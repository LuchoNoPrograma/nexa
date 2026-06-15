import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'
import { getCashOverview } from '../../../utils/posCash'

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const client = await pool.connect()

  try {
    return await getCashOverview(client, session.storeId)
  } finally {
    client.release()
  }
})
