import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'

type ConfigBody = {
  salarioMinimoMensual?: number
  horasMensualesReferencia?: number
  semanasPorMes?: number
}

// Actualiza los parámetros de cálculo de sueldo de la tienda.
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  const body = await readBody<ConfigBody>(event)

  const minimo = Number(body?.salarioMinimoMensual)
  if (!Number.isFinite(minimo) || minimo < 0) {
    throw createError({ statusCode: 400, statusMessage: 'El salario mínimo no es válido.' })
  }

  const horasRef = Number(body?.horasMensualesReferencia)
  const semanas = Number(body?.semanasPorMes)
  await ensureDatabase()

  const result = await pool.query(
    `
      insert into nomina_config (tienda_id, salario_minimo_mensual, horas_mensuales_referencia, semanas_por_mes, updated_at)
      values ($1, $2, coalesce($3, 240), coalesce($4, 4.33), now())
      on conflict (tienda_id) do update set
        salario_minimo_mensual = excluded.salario_minimo_mensual,
        horas_mensuales_referencia = coalesce($3, nomina_config.horas_mensuales_referencia),
        semanas_por_mes = coalesce($4, nomina_config.semanas_por_mes),
        updated_at = now()
      returning
        salario_minimo_mensual::float as "salarioMinimoMensual",
        horas_mensuales_referencia::float as "horasMensualesReferencia",
        semanas_por_mes::float as "semanasPorMes"
    `,
    [
      session.storeId,
      minimo,
      Number.isFinite(horasRef) && horasRef > 0 ? horasRef : null,
      Number.isFinite(semanas) && semanas > 0 ? semanas : null,
    ],
  )

  return { config: result.rows[0] }
})
