import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'
import { COLORES_EMPLEADO } from '~~/shared/utils/nomina'

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

// Crea un empleado para la tienda. El número es monótono por tienda (nunca se
// reutiliza, ni siquiera tras dar de baja a un empleado). Asigna color por defecto.
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  const body = await readBody<EmpleadoBody>(event)
  await ensureDatabase()

  const seqRes = await pool.query<{ orden: number; numero: number }>(
    `
      select
        coalesce(max(orden) + 1, 0) as orden,
        coalesce(max(numero) + 1, 1) as numero
      from empleado
      where tienda_id = $1
    `,
    [session.storeId],
  )
  const orden = seqRes.rows[0]?.orden ?? 0
  const numero = seqRes.rows[0]?.numero ?? 1
  const nombre = (body?.nombre ?? '').trim() || `Empleado ${numero}`
  const color = body?.color?.trim() || COLORES_EMPLEADO[orden % COLORES_EMPLEADO.length]

  if (numero > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Límite de empleados alcanzado.' })
  }

  const valorHora = typeof body?.valorHora === 'number' && body.valorHora >= 0 ? body.valorHora : null

  const result = await pool.query(
    `
      insert into empleado (
        tienda_id, nombre, puesto, color, orden, numero,
        celular, fecha_nacimiento, direccion, valor_hora, fecha_alta
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11::date, current_date))
      returning id, nombre, puesto, color, orden, numero, celular,
        to_char(fecha_nacimiento, 'YYYY-MM-DD') as "fechaNacimiento", direccion,
        valor_hora::float as "valorHora",
        to_char(fecha_alta, 'YYYY-MM-DD') as "fechaAlta",
        to_char(fecha_baja, 'YYYY-MM-DD') as "fechaBaja"
    `,
    [
      session.storeId,
      nombre,
      body?.puesto?.trim() || null,
      color,
      orden,
      numero,
      body?.celular?.trim() || null,
      body?.fechaNacimiento?.trim() || null,
      body?.direccion?.trim() || null,
      valorHora,
      body?.fechaAlta?.trim() || null,
    ],
  )

  return {
    empleado: {
      ...result.rows[0],
      rol: null,
      ci: null,
      tieneLogin: false,
      slots: [],
      horasSemanales: 0,
    },
  }
})
