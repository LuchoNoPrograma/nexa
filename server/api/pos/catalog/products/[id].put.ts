import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
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
} from '../../../../utils/posCatalog'

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
  minStock?: number
  maxStock?: number | null
  minMargin?: number | null
  imageUrl?: string | null
  icon?: string | null
  visiblePos?: boolean
  active?: boolean
  variants?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'producto.gestionar')
  await ensureDatabase()

  const productId = getRouterParam(event, 'id')
  const body = await readBody<ProductBody>(event)
  const categoryId = await assertCategoryBelongsToStore(body.categoryId, session.storeId)
  const name = ensureProductName(body.name)
  const kind = productKind(body.kind)
  const costingType = productCostingType(body.costingType, kind)
  const variants = parseVariants(body.variants)

  const client = await pool.connect()

  try {
    await client.query('begin')

    const result = await client.query(
      `
        update producto
        set
          categoria_id = $3,
          sku = $4,
          codigo_barras = $5,
          nombre = $6,
          descripcion = $7,
          tipo = $8,
          tipo_costeo = $9,
          unidad = $10,
          costo_unitario = $11,
          precio_venta = $12,
          stock_minimo = $13,
          stock_maximo = $14,
          margen_minimo = $15,
          imagen_url = $16,
          icono = $17,
          visible_pos = $18,
          activo = $19,
          updated_at = now()
        where id = $1
          and tienda_id = $2
        returning id
      `,
      [
        productId,
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
        numberOrZero(body.minStock),
        nullableNumber(body.maxStock),
        nullableNumber(body.minMargin),
        nullableText(body.imageUrl),
        nullableText(body.icon),
        booleanOrDefault(body.visiblePos, true),
        booleanOrDefault(body.active, true),
      ],
    )

    if (!result.rowCount) {
      throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado en esta tienda.' })
    }

    await replaceProductVariants(client, productId as string, variants)
    await client.query('commit')

    return { id: result.rows[0].id }
  } catch (error) {
    await client.query('rollback')

    if (typeof error === 'object' && error && 'statusCode' in error) {
      throw error
    }

    mapUniqueConstraint(error)
  } finally {
    client.release()
  }
})
