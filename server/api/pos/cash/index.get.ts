import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreAccess } from '../../../utils/posCatalog'
import { getCashOverview } from '../../../utils/posCash'

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'CAJA || REPORTE')
  await ensureDatabase()

  const client = await pool.connect()

  try {
    return await getCashOverview(client, session.storeId)
  } finally {
    client.release()
  }
})
