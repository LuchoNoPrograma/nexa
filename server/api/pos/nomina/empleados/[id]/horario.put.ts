import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../../utils/db'
import { requireStoreSession } from '../../../../../utils/posCatalog'
import { normalizarSlots } from '~~/shared/utils/nomina'

type HorarioBody = {
  slots?: unknown
}

// Guarda la planilla semanal (celdas marcadas) de un trabajador.
// Cada celda = 1 hora, así que las horas semanales = cantidad de celdas.
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<HorarioBody>(event)
  await ensureDatabase()

  // Verifica que el trabajador sea de la tienda antes de guardar.
  const empleado = await pool.query<{ id: string }>(
    `select id from empleado where id = $1 and tienda_id = $2 and activo = true`,
    [id, session.storeId],
  )
  if (!empleado.rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Trabajador no encontrado.' })
  }

  const slots = normalizarSlots(body?.slots)
  const horasSemanales = slots.length

  await pool.query(
    `
      insert into empleado_horario (empleado_id, tienda_id, slots, horas_semanales, updated_at)
      values ($1, $2, $3::jsonb, $4, now())
      on conflict (empleado_id) do update set
        slots = excluded.slots,
        horas_semanales = excluded.horas_semanales,
        updated_at = now()
    `,
    [id, session.storeId, JSON.stringify(slots), horasSemanales],
  )

  return { slots, horasSemanales }
})
