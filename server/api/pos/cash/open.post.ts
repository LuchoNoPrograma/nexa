import { readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { nullableText, numberOrZero, requireStoreAccess } from '../../../utils/posCatalog'
import { createCashSession, getCashOverview } from '../../../utils/posCash'

type OpenCashBody = {
  openingFloat?: number
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'caja.abrir')
  await ensureDatabase()

  const body = await readBody<OpenCashBody>(event)
  const openingFloat = Number.isFinite(Number(body.openingFloat)) ? numberOrZero(body.openingFloat) : 200
  const notes = nullableText(body.notes)
  const client = await pool.connect()

  try {
    await client.query('begin')
    await createCashSession(client, session.storeId, session.id, openingFloat, notes)
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
