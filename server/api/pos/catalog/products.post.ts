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
  productKind,
  replaceProductVariants,
  requireStoreSession,
} from '../../../utils/posCatalog'

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
  stock?: number
  minStock?: number
  maxStock?: number | null
  minMargin?: number | null
  imageUrl?: string | null
  icon?: string | null
  variablePrice?: boolean
  visibleCatalog?: boolean
  visiblePos?: boolean
  variants?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const body = await readBody<ProductBody>(event)
  const categoryId = await assertCategoryBelongsToStore(body.categoryId, session.storeId)
  const name = ensureProductName(body.name)
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
          unidad,
          costo_unitario,
          precio_venta,
          stock_actual,
          stock_minimo,
          stock_maximo,
          margen_minimo,
          imagen_url,
          icono,
          precio_variable,
          visible_catalogo,
          visible_pos,
          activo
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, true)
        returning id
      `,
      [
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
        numberOrZero(body.stock),
        numberOrZero(body.minStock),
        nullableNumber(body.maxStock),
        nullableNumber(body.minMargin),
        nullableText(body.imageUrl),
        nullableText(body.icon),
        booleanOrDefault(body.variablePrice, false),
        booleanOrDefault(body.visibleCatalog, false),
        booleanOrDefault(body.visiblePos, true),
      ],
    )

    const productId = result.rows[0].id as string
    await replaceProductVariants(client, productId, variants)
    await client.query('commit')

    return { id: productId }
  } catch (error) {
    await client.query('rollback')
    mapUniqueConstraint(error)
  } finally {
    client.release()
  }
})
