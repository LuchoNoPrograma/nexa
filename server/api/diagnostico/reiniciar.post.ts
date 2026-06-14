import { createError } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { requireStoreSession } from '../../utils/posCatalog'

// Rehacer diagnóstico (solo desarrollo): borra los diagnósticos de la tienda y
// deja el onboarding como "pendiente" para volver a tomarlo desde cero.
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 403, statusMessage: 'Disponible solo en desarrollo.' })
  }

  const session = await requireStoreSession(event)
  await ensureDatabase()

  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('delete from diagnostico where tienda_id = $1', [session.storeId])
    await client.query(
      `update tienda set onboarding_diagnostico = 'pendiente', updated_at = now() where id = $1`,
      [session.storeId],
    )
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }

  return { estado: 'pendiente' as const }
})
