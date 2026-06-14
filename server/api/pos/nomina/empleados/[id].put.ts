import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { requireStoreSession } from '../../../../utils/posCatalog'

type EmpleadoBody = {
  nombre?: string
  puesto?: string
  color?: string
}

// Actualiza nombre / puesto / color de un trabajador de la tienda.
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<EmpleadoBody>(event)
  await ensureDatabase()

  const result = await pool.query(
    `
      update empleado set
        nombre = coalesce($3, nombre),
        puesto = coalesce($4, puesto),
        color = coalesce($5, color),
        updated_at = now()
      where id = $1 and tienda_id = $2
      returning id, nombre, puesto, color, orden
    `,
    [
      id,
      session.storeId,
      body?.nombre !== undefined ? body.nombre.trim() : null,
      body?.puesto !== undefined ? (body.puesto.trim() || null) : null,
      body?.color !== undefined ? body.color.trim() : null,
    ],
  )

  if (!result.rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Trabajador no encontrado.' })
  }

  return { empleado: result.rows[0] }
})
