import { readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import {
  assertCategoryBelongsToStore,
  booleanOrDefault,
  cleanText,
  ensureProductName,
  mapUniqueConstraint,
  nullableNumber,
  nullableText,
  numberOrZero,
  parseVariants,
  productCostingType,
  productKind,
  replaceProductVariants,
  requireStoreAccess,
} from '../../../utils/posCatalog'

type ProductBody = {
  categoryId?: string | null
  sku?: string | null
  barcode?: string | null
  name?: string
  description?: string | null
  kind?: string
  costingType?: string
  unit?: string
  cost?: number
  price?: number
  stock?: number
  minStock?: number
  maxStock?: number | null
  minMargin?: number | null
  imageUrl?: string | null
  icon?: string | null
  visiblePos?: boolean
  variants?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'producto.gestionar')
  await ensureDatabase()

  const body = await readBody<ProductBody>(event)
  const categoryId = await assertCategoryBelongsToStore(body.categoryId, session.storeId)
  const name = ensureProductName(body.name)
  const kind = productKind(body.kind)
  const costingType = productCostingType(body.costingType, kind)
  const initialStock = kind === 'servicio' ? 0 : numberOrZero(body.stock)
  const variants = parseVariants(body.variants)

  const client = await pool.connect()

  try {
    await client.query('begin')

    const result = await client.query(
      `
        insert into producto (
          tienda_id,
          categoria_id,
          sku,
          codigo_barras,
          nombre,
          descripcion,
          tipo,
          tipo_costeo,
          unidad,
          costo_unitario,
          precio_venta,
          stock_actual,
          stock_minimo,
          stock_maximo,
          margen_minimo,
          imagen_url,
          icono,
          visible_pos,
          activo
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true)
        returning id
      `,
      [
        session.storeId,
        categoryId,
        nullableText(body.sku),
        nullableText(body.barcode),
        name,
        nullableText(body.description),
        kind,
        costingType,
        cleanText(body.unit, 'unidad') || 'unidad',
        numberOrZero(body.cost),
        numberOrZero(body.price),
        initialStock,
        numberOrZero(body.minStock),
        nullableNumber(body.maxStock),
        nullableNumber(body.minMargin),
        nullableText(body.imageUrl),
        nullableText(body.icon),
        booleanOrDefault(body.visiblePos, true),
      ],
    )

    const productId = result.rows[0].id as string
    await replaceProductVariants(client, productId, variants)

    if (initialStock > 0) {
      const adjustmentResult = await client.query<{ id: string }>(
        `
          insert into inventario_ajuste (
            tienda_id,
            producto_id,
            usuario_id,
            tipo,
            motivo,
            cantidad,
            stock_anterior,
            stock_nuevo,
            notas
          )
          values ($1, $2, $3, 'fijar', 'recuento', $4, 0, $4, 'Stock inicial del producto')
          returning id
        `,
        [session.storeId, productId, session.id, initialStock],
      )

      await client.query(
        `
          insert into inventario_movimiento (
            tienda_id,
            producto_id,
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
          values ($1, $2, $3, $4, 'entrada', 'manual', $5, 0, $5, $6, 'Stock inicial del producto')
        `,
        [session.storeId, productId, session.id, adjustmentResult.rows[0].id, initialStock, numberOrZero(body.cost)],
      )
    }

    await client.query('commit')

    return { id: productId }
  } catch (error) {
    await client.query('rollback')
    mapUniqueConstraint(error)
  } finally {
    client.release()
  }
})
