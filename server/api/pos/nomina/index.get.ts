import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'
import {
  HORAS_MENSUALES_REFERENCIA,
  SEMANAS_POR_MES,
  calcularSueldo,
  type NominaConfig,
} from '~~/shared/utils/nomina'

// Estado completo de nómina de la tienda: configuración de cálculo + empleados
// con su planilla semanal (celdas marcadas y horas) + el costo laboral mensual
// estimado (para que Finanzas/Reportes lo consuman).
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
        e.numero,
        e.celular,
        to_char(e.fecha_nacimiento, 'YYYY-MM-DD') as "fechaNacimiento",
        e.direccion,
        u.ci,
        (u.id is not null) as "tieneLogin",
        r.codigo as rol,
        e.valor_hora::float as "valorHora",
        to_char(e.fecha_alta, 'YYYY-MM-DD') as "fechaAlta",
        to_char(e.fecha_baja, 'YYYY-MM-DD') as "fechaBaja",
        coalesce(h.slots, '[]'::jsonb) as slots,
        coalesce(h.horas_semanales, 0)::float as "horasSemanales"
      from empleado e
      left join empleado_horario h on h.empleado_id = e.id
      left join usuario u on u.id = e.usuario_id and u.estado = 'activo'
      left join usuario_rol ur on ur.usuario_id = e.usuario_id and ur.tienda_id = e.tienda_id
      left join rol r on r.id = ur.rol_id and r.alcance = 'tienda' and r.activo = true
      where e.tienda_id = $1 and e.activo = true
      order by e.orden asc, e.created_at asc
    `,
    [session.storeId],
  )

  // Costo laboral mensual estimado. Se usa la jornada legal canónica (no el
  // valor histórico que pueda tener la BD) para que cuadre con la planilla.
  const config: NominaConfig = {
    salarioMinimoMensual: configRes.rows[0]?.salarioMinimoMensual ?? 0,
    horasMensualesReferencia: HORAS_MENSUALES_REFERENCIA,
    semanasPorMes: SEMANAS_POR_MES,
  }

  const costoLaboralMensual = empleadosRes.rows.reduce(
    (total, e) => total + calcularSueldo(e.horasSemanales, config, e.valorHora).sueldoMensual,
    0,
  )

  return {
    config: configRes.rows[0],
    empleados: empleadosRes.rows,
    resumen: {
      empleados: empleadosRes.rows.length,
      costoLaboralMensual,
    },
  }
})
