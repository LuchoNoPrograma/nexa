import { createError } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireFacturacionConfig } from '../../../utils/facturacionStore'
import { requireStoreAccess } from '../../../utils/posCatalog'
import { solicitarCufd } from '../../../utils/siat'

// Solicita el CUFD del dia al SIN. Debe renovarse cada 24 horas (o al abrir
// el turno); su codigo de control forma parte del CUF de cada factura.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'caja.abrir')
  await ensureDatabase()

  const config = await requireFacturacionConfig(pool, session.storeId)
  const respuesta = await solicitarCufd(config)

  if (!respuesta.codigo || !respuesta.codigoControl) {
    throw createError({
      statusCode: 502,
      statusMessage: respuesta.mensajes[0]?.descripcion ?? 'El SIN no devolvio un CUFD.',
    })
  }

  const result = await pool.query<{ id: string }>(
    `
      insert into facturacion_cufd (config_id, tienda_id, codigo, codigo_control, direccion, fecha_vigencia)
      values ($1, $2, $3, $4, $5, $6)
      returning id
    `,
    [
      config.id,
      session.storeId,
      respuesta.codigo,
      respuesta.codigoControl,
      respuesta.direccion,
      respuesta.fechaVigencia,
    ],
  )

  return {
    ok: true,
    cufdId: result.rows[0]?.id,
    codigo: respuesta.codigo,
    fechaVigencia: respuesta.fechaVigencia,
  }
})
