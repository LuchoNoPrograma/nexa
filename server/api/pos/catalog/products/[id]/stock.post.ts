import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../../utils/db'
import { cleanText, nullableText, numberOrZero, requireStoreAccess } from '../../../../../utils/posCatalog'

const adjustmentTypes = ['sumar', 'restar', 'fijar'] as const
const adjustmentReasons = ['compra_recibida', 'producto_daniado', 'devolucion', 'recuento', 'traslado', 'otro'] as const

type AdjustmentType = typeof adjustmentTypes[number]
type AdjustmentReason = typeof adjustmentReasons[number]

type StockAdjustmentBody = {
  type?: AdjustmentType
  reason?: AdjustmentReason
  quantity?: number
  branch?: string
  notes?: string | null
  variantId?: string | null
}

function parseAdjustmentType(value: unknown): AdjustmentType {
  return adjustmentTypes.includes(value as AdjustmentType) ? value as AdjustmentType : 'sumar'
}

function parseAdjustmentReason(value: unknown): AdjustmentReason {
  return adjustmentReasons.includes(value as AdjustmentReason) ? value as AdjustmentReason : 'recuento'
}

function nextStock(type: AdjustmentType, currentStock: number, quantity: number) {
  if (type === 'sumar') {
    return currentStock + quantity
  }

  if (type === 'restar') {
    return currentStock - quantity
  }

  return quantity
}

function movementType(type: AdjustmentType) {
  if (type === 'sumar') {
    return 'entrada'
  }

  if (type === 'restar') {
    return 'salida'
  }

  return 'ajuste'
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'producto.gestionar')
  await ensureDatabase()

  const productId = getRouterParam(event, 'id')
  const body = await readBody<StockAdjustmentBody>(event)
  const type = parseAdjustmentType(body.type)
  const reason = parseAdjustmentReason(body.reason)
  const quantity = numberOrZero(body.quantity)
  const branch = cleanText(body.branch, 'Matriz') || 'Matriz'
  const notes = nullableText(body.notes)
  const variantId = nullableText(body.variantId)

  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'Producto requerido.' })
  }

  if (quantity <= 0 && type !== 'fijar') {
    throw createError({ statusCode: 400, statusMessage: 'La cantidad debe ser mayor a cero.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    const productResult = await client.query<{ id: string; kind: string; cost: number }>(
      `
        select id, tipo as kind, costo_unitario::float as cost
        from producto
        where id = $1
          and tienda_id = $2
          and activo = true
        for update
      `,
      [productId, session.storeId],
    )

    if (!productResult.rowCount) {
      throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado en esta tienda.' })
    }

    if (productResult.rows[0].kind === 'servicio') {
      throw createError({ statusCode: 400, statusMessage: 'Los servicios no manejan stock.' })
    }

    let currentStock = 0

    if (variantId) {
      const variantResult = await client.query<{ stock: number }>(
        `
          select stock_actual::float as stock
          from producto_variante
          where id = $1
            and producto_id = $2
            and activo = true
          for update
        `,
        [variantId, productId],
      )

      if (!variantResult.rowCount) {
        throw createError({ statusCode: 404, statusMessage: 'Variante no encontrada para este producto.' })
      }

      currentStock = variantResult.rows[0].stock
    } else {
      const stockResult = await client.query<{ stock: number }>(
        `
          select stock_actual::float as stock
          from producto
          where id = $1
            and tienda_id = $2
          for update
        `,
        [productId, session.storeId],
      )

      currentStock = stockResult.rows[0].stock
    }

    const updatedStock = nextStock(type, currentStock, quantity)

    if (updatedStock < 0) {
      throw createError({ statusCode: 400, statusMessage: 'El ajuste no puede dejar stock negativo.' })
    }

    if (variantId) {
      await client.query(
        `
          update producto_variante
          set stock_actual = $3, updated_at = now()
          where id = $1
            and producto_id = $2
        `,
        [variantId, productId, updatedStock],
      )
    } else {
      await client.query(
        `
          update producto
          set stock_actual = $3, updated_at = now()
          where id = $1
            and tienda_id = $2
        `,
        [productId, session.storeId, updatedStock],
      )
    }

    const adjustmentResult = await client.query<{ id: string }>(
      `
        insert into inventario_ajuste (
          tienda_id,
          producto_id,
          producto_variante_id,
          usuario_id,
          tipo,
          motivo,
          sucursal,
          cantidad,
          stock_anterior,
          stock_nuevo,
          notas
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning id
      `,
      [
        session.storeId,
        productId,
        variantId,
        session.id,
        type,
        reason,
        branch,
        quantity,
        currentStock,
        updatedStock,
        notes,
      ],
    )

    await client.query(
      `
        insert into inventario_movimiento (
          tienda_id,
          producto_id,
          producto_variante_id,
          usuario_id,
          ajuste_id,
          tipo,
          origen,
          cantidad,
          stock_anterior,
          stock_nuevo,
          costo_unitario,
          notas
        )
        values ($1, $2, $3, $4, $5, $6, 'manual', $7, $8, $9, $10, $11)
      `,
      [
        session.storeId,
        productId,
        variantId,
        session.id,
        adjustmentResult.rows[0].id,
        movementType(type),
        quantity,
        currentStock,
        updatedStock,
        productResult.rows[0].cost,
        notes,
      ],
    )

    await client.query('commit')

    return {
      productId,
      variantId,
      previousStock: currentStock,
      stock: updatedStock,
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
