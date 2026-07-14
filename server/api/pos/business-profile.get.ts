import { ensureDatabase, pool } from '../../utils/db'
import { requireStoreAccess } from '../../utils/posCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()

  const result = await pool.query(
    `select nombre as "businessName", telefono_whatsapp as contacto,
            direccion_publica as ubicacion,
            perfil_negocio_confirmado as confirmado
       from tienda where id = $1 limit 1`,
    [session.storeId],
  )

  return { profile: result.rows[0] }
})
