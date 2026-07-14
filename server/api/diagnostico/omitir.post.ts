import { ensureDatabase, pool } from '../../utils/db'
import { requireStoreAccess } from '../../utils/posCatalog'

// "Saltar por ahora": deja el onboarding como omitido para no volver a forzarlo.
// No consume el único intento: el usuario aún puede hacerlo luego desde Inicio
// mientras no haya un diagnóstico completado.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()

  await pool.query(
    `
      update tienda
      set onboarding_diagnostico = 'omitido', updated_at = now()
      where id = $1 and onboarding_diagnostico = 'pendiente'
    `,
    [session.storeId],
  )

  return { estado: 'omitido' as const }
})
