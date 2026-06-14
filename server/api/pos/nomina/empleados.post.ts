import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'
import { COLORES_EMPLEADO } from '~~/shared/utils/nomina'

type EmpleadoBody = {
  nombre?: string
  puesto?: string
  color?: string
}

// Crea un trabajador para la tienda. Asigna orden y color por defecto.
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  const body = await readBody<EmpleadoBody>(event)
  await ensureDatabase()

  const ordenRes = await pool.query<{ next: number }>(
    `select coalesce(max(orden) + 1, 0) as next from empleado where tienda_id = $1`,
    [session.storeId],
  )
  const orden = ordenRes.rows[0]?.next ?? 0
  const nombre = (body?.nombre ?? '').trim() || `Trabajador ${orden + 1}`
  const color = body?.color?.trim() || COLORES_EMPLEADO[orden % COLORES_EMPLEADO.length]

  if (orden >= 50) {
    throw createError({ statusCode: 400, statusMessage: 'Límite de trabajadores alcanzado.' })
  }

  const result = await pool.query(
    `
      insert into empleado (tienda_id, nombre, puesto, color, orden)
      values ($1, $2, $3, $4, $5)
      returning id, nombre, puesto, color, orden
    `,
    [session.storeId, nombre, body?.puesto?.trim() || null, color, orden],
  )

  return {
    empleado: {
      ...result.rows[0],
      slots: [],
      horasSemanales: 0,
    },
  }
})
