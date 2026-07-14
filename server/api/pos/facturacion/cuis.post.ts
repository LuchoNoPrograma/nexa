import { createError } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireFacturacionConfig } from '../../../utils/facturacionStore'
import { requireStoreAccess } from '../../../utils/posCatalog'
import { solicitarCuis } from '../../../utils/siat'

// Solicita el CUIS (codigo unico de inicio de sistemas) al SIN. Se hace una
// vez por punto de venta y tiene vigencia aproximada de un anio.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()

  const config = await requireFacturacionConfig(pool, session.storeId)
  const respuesta = await solicitarCuis(config)

  if (!respuesta.codigo) {
    throw createError({
      statusCode: 502,
      statusMessage: respuesta.mensajes[0]?.descripcion ?? 'El SIN no devolvio un CUIS.',
    })
  }

  await pool.query(
    `
      update facturacion_config
      set cuis = $2, cuis_vigencia = $3, estado = 'pruebas', updated_at = now()
      where id = $1
    `,
    [config.id, respuesta.codigo, respuesta.fechaVigencia],
  )

  return { ok: true, cuis: respuesta.codigo, fechaVigencia: respuesta.fechaVigencia }
})
