import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, nullableText, numberOrZero, requireStoreAccess } from '../../../utils/posCatalog'
import { requireLockedOpenCashSession } from '../../../utils/posCash'
import { tieneAcceso } from '~~/shared/utils/acceso'
import { CATEGORIAS_EGRESO } from '~~/shared/utils/finanzas'

const metodos = ['efectivo', 'qr', 'transferencia', 'tarjeta', 'otro'] as const

type GastoBody = {
  categoria?: string
  concepto?: string
  monto?: number
  metodo?: string
  notas?: string | null
}

// Registrar un gasto contra el turno de caja abierto. La cajera registra solo
// salidas en efectivo; los roles con reportes pueden conservar otros métodos.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'caja.movimiento.crear')
  await ensureDatabase()

  const body = await readBody<GastoBody>(event)
  const concepto = cleanText(body.concepto)
  const monto = numberOrZero(body.monto)

  if (!concepto) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe en qué fue el gasto.' })
  }
  if (monto <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'El monto debe ser mayor a cero.' })
  }

  // La categoría debe pertenecer a la taxonomía conocida (cae a 'otros_gastos').
  const categoria = CATEGORIAS_EGRESO.some((c) => c.value === body.categoria)
    ? (body.categoria as string)
    : 'otros_gastos'
  const esCajeroLimitado = session.roles.includes('cajero') && !tieneAcceso('reporte.ver', session)
  const metodo = esCajeroLimitado
    ? 'efectivo'
    : metodos.includes(body.metodo as typeof metodos[number]) ? body.metodo : 'efectivo'
  const client = await pool.connect()

  try {
    await client.query('begin')
    const cashSessionId = await requireLockedOpenCashSession(
      client,
      session.storeId,
      'Abre caja antes de registrar un gasto.',
    )

    let availableCash: number | null = null
    if (metodo === 'efectivo') {
      const balanceResult = await client.query<{ availableCash: number }>(
        `
          select (
            cs.saldo_inicial
            + coalesce(sum(cm.monto) filter (
                where cm.tipo = 'ingreso'
                  and cm.metodo = 'efectivo'
                  and cm.estado <> 'anulado'
              ), 0)
            - coalesce(sum(cm.monto) filter (
                where cm.tipo = 'egreso'
                  and cm.metodo = 'efectivo'
                  and cm.estado <> 'anulado'
              ), 0)
          )::float as "availableCash"
          from caja_sesion cs
          left join caja_movimiento cm
            on cm.caja_sesion_id = cs.id
            and cm.tienda_id = cs.tienda_id
          where cs.id = $1
            and cs.tienda_id = $2
            and cs.estado = 'abierta'
          group by cs.id
        `,
        [cashSessionId, session.storeId],
      )
      availableCash = Number(balanceResult.rows[0]?.availableCash ?? 0)

      if (monto > availableCash + 0.009) {
        throw createError({
          statusCode: 409,
          statusMessage: `No hay suficiente efectivo en caja. Disponible: Bs ${availableCash.toFixed(2)}.`,
        })
      }
    }

    const result = await client.query<{ id: string }>(
      `
        insert into caja_movimiento (
          tienda_id, caja_sesion_id, usuario_id, tipo, categoria, concepto,
          metodo, monto, estado, fecha, notas
        )
        values ($1, $2, $3, 'egreso', $4, $5, $6, $7, 'confirmado', now(), $8)
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
        nullableText(body.notas),
      ],
    )

    await client.query('commit')

    return {
      id: result.rows[0]?.id,
      cashSessionId,
      availableCash: availableCash === null ? null : availableCash - monto,
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
