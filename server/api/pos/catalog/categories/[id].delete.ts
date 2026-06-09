import { createError, getRouterParam } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { requireStoreSession } from '../../../../utils/posCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const categoryId = getRouterParam(event, 'id')

  await pool.query('begin')

  try {
    const categoryResult = await pool.query(
      `
        update categoria
        set activo = false, updated_at = now()
        where id = $1
          and tienda_id = $2
        returning id
      `,
      [categoryId, session.storeId],
    )

    if (!categoryResult.rowCount) {
      throw createError({ statusCode: 404, statusMessage: 'Categoria no encontrada en esta tienda.' })
    }

    await pool.query(
      `
        update producto
        set categoria_id = null, updated_at = now()
        where categoria_id = $1
          and tienda_id = $2
      `,
      [categoryId, session.storeId],
    )

    await pool.query('commit')
    return { ok: true }
  } catch (error) {
    await pool.query('rollback')
    throw error
  }
})
