import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, nullableText, numberOrZero, requireStoreSession } from '../../../utils/posCatalog'
import { getCashOverview, requireOpenCashSession } from '../../../utils/posCash'

const movementTypes = ['Ingreso', 'Egreso'] as const
const paymentMethods = ['Efectivo', 'QR'] as const

type MovementBody = {
  concept?: string
  type?: typeof movementTypes[number]
  method?: typeof paymentMethods[number]
  amount?: number
  note?: string | null
}

function dbType(value: unknown) {
  return value === 'Egreso' ? 'egreso' : 'ingreso'
}

function dbMethod(value: unknown) {
  if (value === 'QR') {
    return 'qr'
  }

  return 'efectivo'
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const body = await readBody<MovementBody>(event)
  const concept = cleanText(body.concept)
  const amount = numberOrZero(body.amount)

  if (!concept) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe un concepto.' })
  }

  if (amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'El monto debe ser mayor a cero.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')
    const cashSessionId = await requireOpenCashSession(client, session.storeId)

    await client.query(
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
          notas
        )
        values ($1, $2, $3, $4, 'manual', $5, $6, $7, 'pendiente', $8)
      `,
      [
        session.storeId,
        cashSessionId,
        session.id,
        dbType(body.type),
        concept,
        dbMethod(body.method),
        amount,
        nullableText(body.note),
      ],
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
