import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { requireStoreSession } from '../../utils/posCatalog'
import {
  calcularDiagnostico,
  preguntasPendientes,
  type DiagnosticoRespuestas,
} from '~~/shared/utils/diagnostico'

type DiagnosticoBody = {
  respuestas?: DiagnosticoRespuestas
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const body = await readBody<DiagnosticoBody>(event)
  const respuestas = body?.respuestas ?? {}

  const pendientes = preguntasPendientes(respuestas)
  if (pendientes.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Faltan respuestas: ${pendientes.join(', ')}`,
    })
  }

  // Una sola vez: si ya hay un diagnóstico completado, no se vuelve a tomar.
  const yaExiste = await pool.query(
    `select 1 from diagnostico where tienda_id = $1 and completado_at is not null limit 1`,
    [session.storeId],
  )
  if (yaExiste.rowCount && yaExiste.rowCount > 0) {
    throw createError({ statusCode: 409, statusMessage: 'El diagnóstico ya fue completado.' })
  }

  const resultado = calcularDiagnostico(respuestas)
  const resultadoJson = JSON.stringify({
    respuestas,
    problemas: resultado.problemas,
    recomendaciones: resultado.recomendaciones,
    mensajeNivel: resultado.mensajeNivel,
    recomendacionPrincipal: resultado.recomendacionPrincipal,
    version: resultado.version,
  })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const inserted = await client.query<{ id: string }>(
      `
        insert into diagnostico (
          tienda_id, usuario_id, rubro, canal_venta_principal, problema_principal,
          salud_general, nivel, score_ventas, score_finanzas, score_marketing, score_inventario,
          resultado, completado_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, now())
        returning id
      `,
      [
        session.storeId,
        session.id,
        resultado.rubro,
        resultado.canalPrincipal,
        resultado.problemaPrincipal,
        resultado.saludGeneral,
        resultado.nivel,
        resultado.areas.ventas,
        resultado.areas.finanzas,
        resultado.areas.marketing,
        resultado.areas.inventario,
        resultadoJson,
      ],
    )

    await client.query(
      `update tienda set onboarding_diagnostico = 'completado', updated_at = now() where id = $1`,
      [session.storeId],
    )

    await client.query('commit')

    return { id: inserted.rows[0]?.id, resultado }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
