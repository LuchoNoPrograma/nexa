import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { cleanText, numberOrZero, requireStoreSession } from '../../../../utils/posCatalog'
import { getCashOverview } from '../../../../utils/posCash'

type VoidSaleBody = {
  reason?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const saleId = cleanText(getRouterParam(event, 'id'))
  const body = await readBody<VoidSaleBody>(event)
  const reason = cleanText(body.reason)

  if (!saleId) {
    throw createError({ statusCode: 400, statusMessage: 'Venta inválida.' })
  }

  if (reason.length < 4) {
    throw createError({ statusCode: 400, statusMessage: 'Indica el motivo de la anulación.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    const saleResult = await client.query<{
      id: string
      status: string
      number: string | null
      cashSessionStatus: string | null
      ownerId: string | null
    }>(
      `
        select
          v.id,
          v.estado as status,
          v.numero as number,
          cs.estado as "cashSessionStatus",
          t.owner_id as "ownerId"
        from venta v
        join tienda t on t.id = v.tienda_id
        left join caja_sesion cs on cs.id = v.caja_sesion_id
        where v.id = $1
          and v.tienda_id = $2
        for update of v
      `,
      [saleId, session.storeId],
    )

    const sale = saleResult.rows[0]

    if (!sale) {
      throw createError({ statusCode: 404, statusMessage: 'Venta no encontrada.' })
    }

    if (sale.ownerId !== session.id) {
      throw createError({ statusCode: 403, statusMessage: 'Solo el dueño de la tienda puede anular ventas.' })
    }

    if (sale.status === 'anulada') {
      throw createError({ statusCode: 409, statusMessage: 'Esta venta ya fue anulada.' })
    }

    if (sale.status !== 'pagada') {
      throw createError({ statusCode: 409, statusMessage: 'Solo se pueden anular ventas pagadas.' })
    }

    if (sale.cashSessionStatus && sale.cashSessionStatus !== 'abierta') {
      throw createError({ statusCode: 409, statusMessage: 'No se puede anular una venta de una caja ya cerrada.' })
    }

    const saleLabel = sale.number ? `Venta ${sale.number}` : 'Venta'
    const note = `Anulación: ${reason}`

    const itemResult = await client.query<{
      productId: string | null
      kind: string
      quantity: number
      cost: number
    }>(
      `
        select
          producto_id as "productId",
          tipo_producto as kind,
          cantidad::float as quantity,
          costo_unitario::float as cost
        from venta_item
        where venta_id = $1
      `,
      [sale.id],
    )

    for (const item of itemResult.rows) {
      if (!item.productId || item.kind === 'servicio') {
        continue
      }

      const productResult = await client.query<{ stock: number }>(
        `
          select stock_actual::float as stock
          from producto
          where id = $1
            and tienda_id = $2
          for update
        `,
        [item.productId, session.storeId],
      )

      const previousStock = Number(productResult.rows[0]?.stock ?? 0)
      const quantity = numberOrZero(item.quantity)
      const nextStock = previousStock + quantity

      await client.query(
        `
          update producto
          set stock_actual = $3, updated_at = now()
          where id = $1
            and tienda_id = $2
        `,
        [item.productId, session.storeId, nextStock],
      )

      await client.query(
        `
          insert into inventario_movimiento (
            tienda_id,
            producto_id,
            usuario_id,
            venta_id,
            tipo,
            origen,
            cantidad,
            stock_anterior,
            stock_nuevo,
            costo_unitario,
            notas
          )
          values ($1, $2, $3, $4, 'entrada', 'devolucion', $5, $6, $7, $8, $9)
        `,
        [session.storeId, item.productId, session.id, sale.id, quantity, previousStock, nextStock, numberOrZero(item.cost), `${saleLabel} anulada. ${note}`],
      )
    }

    await client.query(
      `
        update pago
        set estado = 'anulado', updated_at = now()
        where tienda_id = $1
          and venta_id = $2
          and estado <> 'anulado'
      `,
      [session.storeId, sale.id],
    )

    await client.query(
      `
        update caja_movimiento
        set estado = 'anulado', updated_at = now()
        where tienda_id = $1
          and venta_id = $2
          and estado <> 'anulado'
      `,
      [session.storeId, sale.id],
    )

    await client.query(
      `
        update venta
        set estado = 'anulada',
            anulada_at = now(),
            anulada_por_id = $3,
            anulacion_motivo = $4,
            updated_at = now()
        where tienda_id = $1
          and id = $2
      `,
      [session.storeId, sale.id, session.id, reason],
    )

    const overview = await getCashOverview(client, session.storeId)
    await client.query('commit')

    return overview
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
