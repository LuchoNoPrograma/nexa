import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'

// Estado completo de nómina de la tienda: configuración de cálculo + empleados
// con su planilla semanal (celdas marcadas y horas).
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  // Config de la tienda (la crea con valores por defecto si aún no existe).
  const configRes = await pool.query(
    `
      insert into nomina_config (tienda_id)
      values ($1)
      on conflict (tienda_id) do update set tienda_id = excluded.tienda_id
      returning
        salario_minimo_mensual::float as "salarioMinimoMensual",
        horas_mensuales_referencia::float as "horasMensualesReferencia",
        semanas_por_mes::float as "semanasPorMes"
    `,
    [session.storeId],
  )

  const empleadosRes = await pool.query(
    `
      select
        e.id,
        e.nombre,
        e.puesto,
        e.color,
        e.orden,
        coalesce(h.slots, '[]'::jsonb) as slots,
        coalesce(h.horas_semanales, 0)::float as "horasSemanales"
      from empleado e
      left join empleado_horario h on h.empleado_id = e.id
      where e.tienda_id = $1 and e.activo = true
      order by e.orden asc, e.created_at asc
    `,
    [session.storeId],
  )

  return {
    config: configRes.rows[0],
    empleados: empleadosRes.rows,
  }
})
