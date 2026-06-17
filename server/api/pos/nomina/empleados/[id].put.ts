import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { requireStoreAccess } from '../../../../utils/posCatalog'

type EmpleadoBody = {
  nombre?: string
  puesto?: string
  color?: string
  celular?: string
  fechaNacimiento?: string
  direccion?: string
  valorHora?: number | null
  fechaAlta?: string
}

// Actualiza datos de un empleado de la tienda: nombre, puesto, color y los
// datos de contacto (celular, fecha de nacimiento y dirección).
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  const id = getRouterParam(event, 'id')
  const body = await readBody<EmpleadoBody>(event)
  await ensureDatabase()

  // El valor por hora se puede limpiar (null = vuelve al valor de la tienda),
  // así que se distingue "no enviado" (mantener) de "enviado en null" (limpiar).
  const setValorHora = body?.valorHora !== undefined
  const valorHora = typeof body?.valorHora === 'number' && body.valorHora >= 0 ? body.valorHora : null

  const result = await pool.query(
    `
      update empleado set
        nombre = coalesce($3, nombre),
        puesto = coalesce($4, puesto),
        color = coalesce($5, color),
        celular = coalesce($6, celular),
        fecha_nacimiento = coalesce($7::date, fecha_nacimiento),
        direccion = coalesce($8, direccion),
        valor_hora = case when $9::boolean then $10::numeric else valor_hora end,
        fecha_alta = coalesce($11::date, fecha_alta),
        updated_at = now()
      where id = $1 and tienda_id = $2
      returning id, nombre, puesto, color, orden, numero, celular,
        to_char(fecha_nacimiento, 'YYYY-MM-DD') as "fechaNacimiento", direccion,
        valor_hora::float as "valorHora",
        to_char(fecha_alta, 'YYYY-MM-DD') as "fechaAlta",
        to_char(fecha_baja, 'YYYY-MM-DD') as "fechaBaja"
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
      setValorHora,
      valorHora,
      body?.fechaAlta !== undefined ? (body.fechaAlta.trim() || null) : null,
    ],
  )

  if (!result.rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado.' })
  }

  return { empleado: result.rows[0] }
})
