import { ensureDatabase, pool } from '../../../utils/db'
import { getCufdVigente, getFacturacionConfig } from '../../../utils/facturacionStore'
import { requireStoreAccess } from '../../../utils/posCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()

  const config = await getFacturacionConfig(pool, session.storeId)

  if (!config) {
    return { config: null, cufd: null }
  }

  const cufd = await getCufdVigente(pool, config.id)
  const { tokenDelegado, ...publicConfig } = config

  return {
    config: { ...publicConfig, tieneToken: Boolean(tokenDelegado) },
    cufd,
  }
})
