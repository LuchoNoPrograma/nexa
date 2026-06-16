import { createError, getRouterParam } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { requireStoreSession } from '../../../../utils/posCatalog'

// Elimina (baja lógica) un trabajador de la tienda.
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  const id = getRouterParam(event, 'id')
  await ensureDatabase()

  const result = await pool.query(
    `
      update empleado set activo = false, fecha_baja = current_date, updated_at = now()
      where id = $1 and tienda_id = $2 and activo = true
      returning id
    `,
    [id, session.storeId],
  )

  if (!result.rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Trabajador no encontrado.' })
  }

  return { ok: true }
})
