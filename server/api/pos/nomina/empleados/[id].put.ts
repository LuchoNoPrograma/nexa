import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { requireStoreSession } from '../../../../utils/posCatalog'

type EmpleadoBody = {
  nombre?: string
  puesto?: string
  color?: string
  celular?: string
  fechaNacimiento?: string
  direccion?: string
}

// Actualiza datos de un empleado de la tienda: nombre, puesto, color y los
// datos de contacto (celular, fecha de nacimiento y dirección).
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
        celular = coalesce($6, celular),
        fecha_nacimiento = coalesce($7::date, fecha_nacimiento),
        direccion = coalesce($8, direccion),
        updated_at = now()
      where id = $1 and tienda_id = $2
      returning id, nombre, puesto, color, orden, numero, celular,
        to_char(fecha_nacimiento, 'YYYY-MM-DD') as "fechaNacimiento", direccion
    `,
    [
      id,
      session.storeId,
      body?.nombre !== undefined ? body.nombre.trim() : null,
      body?.puesto !== undefined ? (body.puesto.trim() || null) : null,
      body?.color !== undefined ? body.color.trim() : null,
      body?.celular !== undefined ? (body.celular.trim() || null) : null,
      body?.fechaNacimiento !== undefined ? (body.fechaNacimiento.trim() || null) : null,
      body?.direccion !== undefined ? (body.direccion.trim() || null) : null,
    ],
  )

  if (!result.rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado.' })
  }

  return { empleado: result.rows[0] }
})
