import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, nullableText, numberOrZero, requireStoreAccess } from '../../../utils/posCatalog'
import { lockCashSession } from '../../../utils/posCash'
import { CATEGORIAS_INGRESO } from '~~/shared/utils/finanzas'

const metodos = ['efectivo', 'qr', 'transferencia', 'tarjeta', 'otro'] as const

type IngresoBody = {
  categoria?: string
  concepto?: string
  monto?: number
  metodo?: string
  fecha?: string | null
  notas?: string | null
}

// Registrar un ingreso que NO es venta de productos (reembolso, aporte, interés…).
// Finanzas lo muestra de inmediato. Si existe un turno abierto y la fecha pertenece
// a ese turno, también se enlaza a caja para que forme parte del arqueo.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'caja.movimiento.crear')
  await ensureDatabase()

  const body = await readBody<IngresoBody>(event)
  const concepto = cleanText(body.concepto)
  const monto = numberOrZero(body.monto)

  if (!concepto) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe de qué es el ingreso.' })
  }
  if (monto <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'El monto debe ser mayor a cero.' })
  }

  // La venta tiene su propio flujo (POS); aquí solo se aceptan otros ingresos.
  const categoria = CATEGORIAS_INGRESO.some((c) => c.value === body.categoria && c.value !== 'venta')
    ? (body.categoria as string)
    : 'otro_ingreso'
  const metodo = metodos.includes(body.metodo as typeof metodos[number]) ? body.metodo : 'efectivo'
  const fecha = nullableText(body.fecha)
  const fechaMs = fecha ? Date.parse(fecha) : Date.now()

  if (!Number.isFinite(fechaMs) || fechaMs > Date.now() + 5 * 60 * 1000) {
    throw createError({ statusCode: 400, statusMessage: 'La fecha del ingreso no es válida.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    const openSessionResult = await client.query<{ id: string }>(
      `
        select id
        from caja_sesion
        where tienda_id = $1
          and estado = 'abierta'
          and abierta_at <= coalesce($2::timestamptz, now())
        order by abierta_at desc
        limit 1
      `,
      [session.storeId, fecha],
    )
    let cashSessionId = openSessionResult.rows[0]?.id ?? null

    if (cashSessionId) {
      await lockCashSession(client, cashSessionId)
      const stillOpen = await client.query<{ id: string }>(
        `
          select id
          from caja_sesion
          where id = $1
            and tienda_id = $2
            and estado = 'abierta'
        `,
        [cashSessionId, session.storeId],
      )
      if (!stillOpen.rows[0]) {
        throw createError({ statusCode: 409, statusMessage: 'El turno se cerró mientras registrabas el ingreso. Revisa el cierre antes de volver a intentarlo.' })
      }
    }

    const result = await client.query<{ id: string }>(
      `
        insert into caja_movimiento (
          tienda_id,
          caja_sesion_id,
          usuario_id,
          tipo,
          categoria,
          concepto,
          metodo,
          monto,
          estado,
          fecha,
          notas
        )
        values (
          $1,
          $2,
          $3,
          'ingreso',
          $4,
          $5,
          $6,
          $7,
          case when $2::uuid is null then 'confirmado' else 'pendiente' end,
          coalesce($8::timestamptz, now()),
          $9
        )
        returning id
      `,
      [
        session.storeId,
        cashSessionId,
        session.id,
        categoria,
        concepto,
        metodo,
        monto,
        fecha,
        nullableText(body.notas),
      ],
    )

    await client.query('commit')
    return { id: result.rows[0]?.id, cashSessionId }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
