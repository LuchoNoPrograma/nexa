import { createError, getRouterParam } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { requireStoreAccess } from '../../../../utils/posCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'producto.gestionar')
  await ensureDatabase()

  const productId = getRouterParam(event, 'id')
  const result = await pool.query(
    `
      update producto
      set activo = false, visible_pos = false, updated_at = now()
      where id = $1
        and tienda_id = $2
      returning id
    `,
    [productId, session.storeId],
  )

  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado en esta tienda.' })
  }

  return { ok: true }
})
