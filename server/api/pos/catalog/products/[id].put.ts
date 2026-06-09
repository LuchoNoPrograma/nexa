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
  productKind,
  replaceProductVariants,
  requireStoreSession,
} from '../../../../utils/posCatalog'

type ProductBody = {
  categoryId?: string | null
  sku?: string | null
  barcode?: string | null
  name?: string
  description?: string | null
  kind?: string
  unit?: string
  cost?: number
  price?: number
  minStock?: number
  maxStock?: number | null
  minMargin?: number | null
  imageUrl?: string | null
  icon?: string | null
  variablePrice?: boolean
  visibleCatalog?: boolean
  visiblePos?: boolean
  active?: boolean
  variants?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const productId = getRouterParam(event, 'id')
  const body = await readBody<ProductBody>(event)
  const categoryId = await assertCategoryBelongsToStore(body.categoryId, session.storeId)
  const name = ensureProductName(body.name)
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
          unidad = $9,
          costo_unitario = $10,
          precio_venta = $11,
          stock_minimo = $12,
          stock_maximo = $13,
          margen_minimo = $14,
          imagen_url = $15,
          icono = $16,
          precio_variable = $17,
          visible_catalogo = $18,
          visible_pos = $19,
          activo = $20,
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
        productKind(body.kind),
        cleanText(body.unit, 'unidad') || 'unidad',
        numberOrZero(body.cost),
        numberOrZero(body.price),
        numberOrZero(body.minStock),
        nullableNumber(body.maxStock),
        nullableNumber(body.minMargin),
        nullableText(body.imageUrl),
        nullableText(body.icon),
        booleanOrDefault(body.variablePrice, false),
        booleanOrDefault(body.visibleCatalog, false),
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
