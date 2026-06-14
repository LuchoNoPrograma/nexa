import { createError } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { requireStoreSession } from '../../utils/posCatalog'

// Rehacer diagnóstico: borra los diagnósticos de la tienda y deja el onboarding
// como "pendiente" para volver a tomarlo desde cero.
// - En desarrollo siempre está disponible.
// - En producción se permite solo a super_admin (para reiniciar la demo).
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)

  if (!import.meta.dev && session.role !== 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado para reiniciar el diagnóstico.' })
  }

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
