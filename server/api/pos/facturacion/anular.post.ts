import { createError, readBody } from 'h3'
import { SIAT_MOTIVO_ANULACION } from '../../../../shared/utils/facturacion'
import { ensureDatabase, pool } from '../../../utils/db'
import { getCufdVigente, requireFacturacionConfig } from '../../../utils/facturacionStore'
import { cleanText, requireStoreAccess } from '../../../utils/posCatalog'
import { anulacionFactura } from '../../../utils/siat'

type AnularBody = {
  facturaId?: string
  codigoMotivo?: number
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'pos.vender')
  await ensureDatabase()

  const body = await readBody<AnularBody>(event)
  const facturaId = cleanText(body.facturaId)
  const codigoMotivo = Number(body.codigoMotivo ?? 1)

  if (!facturaId) {
    throw createError({ statusCode: 400, statusMessage: 'Indica la factura a anular.' })
  }

  if (!SIAT_MOTIVO_ANULACION.some(m => m.codigo === codigoMotivo)) {
    throw createError({ statusCode: 400, statusMessage: 'Motivo de anulacion invalido.' })
  }

  const facturaResult = await pool.query(
    `
      select id, cuf, estado
      from factura
      where id = $1 and tienda_id = $2
      limit 1
    `,
    [facturaId, session.storeId],
  )

  const factura = facturaResult.rows[0]

  if (!factura) {
    throw createError({ statusCode: 404, statusMessage: 'Factura no encontrada.' })
  }

  if (factura.estado !== 'emitida' && factura.estado !== 'observada') {
    throw createError({ statusCode: 409, statusMessage: 'Solo se pueden anular facturas emitidas.' })
  }

  const config = await requireFacturacionConfig(pool, session.storeId)
  const cufd = await getCufdVigente(pool, config.id)

  if (!cufd) {
    throw createError({ statusCode: 409, statusMessage: 'No hay CUFD vigente. Solicita el codigo del dia.' })
  }

  const respuesta = await anulacionFactura(config, cufd.codigo, factura.cuf, codigoMotivo)
  // 905 = anulacion confirmada por el SIN.
  const anulada = respuesta.transaccion && respuesta.codigoEstado === '905'

  if (anulada) {
    await pool.query(
      `
        update factura
        set estado = 'anulada', codigo_motivo_anulacion = $2, mensajes_sin = $3::jsonb, updated_at = now()
        where id = $1
      `,
      [facturaId, codigoMotivo, JSON.stringify(respuesta.mensajes)],
    )
  }

  return { ok: anulada, estado: anulada ? 'anulada' : factura.estado, mensajes: respuesta.mensajes }
})
