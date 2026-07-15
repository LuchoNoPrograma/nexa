import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { nullableText, numberOrZero, requireStoreAccess } from '../../../utils/posCatalog'
import { getCashOverview, requireLockedOpenCashSession } from '../../../utils/posCash'

type CloseCashBody = {
  countedCash?: number
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'caja.cerrar')
  await ensureDatabase()

  const body = await readBody<CloseCashBody>(event)
  if (typeof body.countedCash !== 'number' || !Number.isFinite(body.countedCash) || body.countedCash < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa el efectivo contado antes de cerrar el turno.' })
  }
  const countedCash = numberOrZero(body.countedCash)
  const notes = nullableText(body.notes)
  const client = await pool.connect()

  try {
    await client.query('begin')
    const cashSessionId = await requireLockedOpenCashSession(client, session.storeId)

    const totalsResult = await client.query<{ openingFloat: number; cashIncome: number; cashOutcome: number }>(
      `
        select
          cs.saldo_inicial::float as "openingFloat",
          coalesce(sum(cm.monto) filter (
            where cm.tipo = 'ingreso'
              and cm.metodo = 'efectivo'
              and cm.estado <> 'anulado'
          ), 0)::float as "cashIncome",
          coalesce(sum(cm.monto) filter (
            where cm.tipo = 'egreso'
              and cm.metodo = 'efectivo'
              and cm.estado <> 'anulado'
          ), 0)::float as "cashOutcome"
        from caja_sesion cs
        left join caja_movimiento cm on cm.caja_sesion_id = cs.id
        where cs.id = $1
          and cs.tienda_id = $2
          and cs.estado = 'abierta'
        group by cs.id
      `,
      [cashSessionId, session.storeId],
    )

    const totals = totalsResult.rows[0]

    if (!totals) {
      throw createError({ statusCode: 409, statusMessage: 'El turno ya fue cerrado por otra operación.' })
    }

    const expectedCash = totals.openingFloat + totals.cashIncome - totals.cashOutcome
    const difference = countedCash - expectedCash

    await client.query(
      `
        update caja_movimiento
        set estado = 'confirmado', updated_at = now()
        where caja_sesion_id = $1
          and tienda_id = $2
          and estado = 'pendiente'
      `,
      [cashSessionId, session.storeId],
    )

    await client.query(
      `
        update caja_sesion
        set
          estado = 'cerrada',
          saldo_esperado = $3,
          saldo_contado = $4,
          diferencia = $5,
          cerrada_at = now(),
          notas = $6,
          updated_at = now()
        where id = $1
          and tienda_id = $2
          and estado = 'abierta'
      `,
      [cashSessionId, session.storeId, expectedCash, countedCash, difference, notes],
    )

    const overview = await getCashOverview(client, session.storeId)
    await client.query('commit')

    return overview
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
