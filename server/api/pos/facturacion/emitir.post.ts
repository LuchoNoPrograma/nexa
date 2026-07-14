import { createError, readBody } from 'h3'
import {
  SIAT_CODIGO_PRODUCTO_SIN_DEFAULT,
  SIAT_TIPO_EMISION,
  SIAT_TIPO_FACTURA,
  SIAT_UNIDAD_MEDIDA_DEFAULT,
  generarCuf,
} from '../../../../shared/utils/facturacion'
import { ensureDatabase, pool } from '../../../utils/db'
import {
  getCufdVigente,
  requireFacturacionConfig,
  siguienteNumeroFactura,
} from '../../../utils/facturacionStore'
import { cleanText, nullableText, requireStoreAccess } from '../../../utils/posCatalog'
import { generarXmlFactura, recepcionFactura } from '../../../utils/siat'
import { encryptSecret } from '../../../utils/secrets'

type EmitirBody = {
  ventaId?: string
  cliente?: {
    tipoDocumento?: number
    numeroDocumento?: string
    complemento?: string
    razonSocial?: string
    correo?: string
  }
  codigoMetodoPago?: number
  numeroTarjeta?: string
}

function maskedCardNumber(value: unknown) {
  const digits = cleanText(value).replace(/\D/g, '')
  if (!digits) {
    return null
  }
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'pos.vender')
  await ensureDatabase()

  const body = await readBody<EmitirBody>(event)
  const ventaId = cleanText(body.ventaId)

  if (!ventaId) {
    throw createError({ statusCode: 400, statusMessage: 'Indica la venta a facturar.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    const config = await requireFacturacionConfig(client, session.storeId)

    if (!config.cuis) {
      throw createError({ statusCode: 409, statusMessage: 'Solicita primero el CUIS del punto de venta.' })
    }

    const cufd = await getCufdVigente(client, config.id)

    if (!cufd) {
      throw createError({ statusCode: 409, statusMessage: 'No hay CUFD vigente. Solicita el codigo del dia.' })
    }

    const ventaResult = await client.query(
      `
        select v.id, v.numero, v.estado, v.total, v.descuento
        from venta v
        where v.id = $1 and v.tienda_id = $2
        limit 1
      `,
      [ventaId, session.storeId],
    )

    const venta = ventaResult.rows[0]

    if (!venta) {
      throw createError({ statusCode: 404, statusMessage: 'Venta no encontrada.' })
    }

    if (venta.estado === 'anulada') {
      throw createError({ statusCode: 409, statusMessage: 'No se puede facturar una venta anulada.' })
    }

    const facturaExistente = await client.query<{ id: string }>(
      `select id from factura where venta_id = $1 and estado <> 'rechazada' limit 1`,
      [ventaId],
    )

    if (facturaExistente.rowCount) {
      throw createError({ statusCode: 409, statusMessage: 'Esta venta ya tiene una factura en proceso o emitida. Revisa su estado antes de reintentar.' })
    }

    const itemsResult = await client.query(
      `
        select vi.producto_id, vi.nombre_producto, vi.cantidad, vi.precio_unitario, vi.descuento, vi.subtotal
        from venta_item vi
        where vi.venta_id = $1
        order by vi.created_at
      `,
      [ventaId],
    )

    if (!itemsResult.rowCount) {
      throw createError({ statusCode: 409, statusMessage: 'La venta no tiene items para facturar.' })
    }

    const fechaEmision = new Date()
    const numeroFactura = await siguienteNumeroFactura(client, config.id)
    const actividad = config.codigoActividad ?? '620000'
    const leyenda = 'Ley N° 453: El proveedor debe entregar el producto en las condiciones ofertadas.'

    const cuf = generarCuf({
      nit: config.nit,
      fechaEmision,
      codigoSucursal: config.codigoSucursal,
      modalidad: config.modalidad,
      tipoEmision: SIAT_TIPO_EMISION.enLinea,
      tipoFactura: SIAT_TIPO_FACTURA.conCreditoFiscal,
      codigoDocumentoSector: config.codigoDocumentoSector,
      numeroFactura,
      codigoPuntoVenta: config.codigoPuntoVenta,
      codigoControlCufd: cufd.codigoControl,
    })

    const clienteBody = body.cliente ?? {}
    const tipoDocumento = Number(clienteBody.tipoDocumento ?? 1)
    const numeroDocumento = cleanText(clienteBody.numeroDocumento) || '0'
    const razonSocialCliente = cleanText(clienteBody.razonSocial) || 'S/N'
    const codigoMetodoPago = Number(body.codigoMetodoPago ?? 1)
    const numeroTarjeta = maskedCardNumber(body.numeroTarjeta)
    const total = Number(venta.total)

    const xml = generarXmlFactura(
      {
        nitEmisor: config.nit,
        razonSocialEmisor: config.razonSocial,
        municipio: config.municipio ?? 'La Paz',
        telefono: config.telefono,
        numeroFactura,
        cuf,
        cufd: cufd.codigo,
        codigoSucursal: config.codigoSucursal,
        direccion: cufd.direccion ?? config.direccion ?? '',
        codigoPuntoVenta: config.codigoPuntoVenta,
        fechaEmision,
        nombreRazonSocial: razonSocialCliente,
        codigoTipoDocumentoIdentidad: tipoDocumento,
        numeroDocumento,
        complemento: nullableText(clienteBody.complemento),
        codigoCliente: numeroDocumento,
        codigoMetodoPago,
        numeroTarjeta,
        montoTotal: total,
        montoTotalSujetoIva: total,
        codigoMoneda: 1,
        tipoCambio: 1,
        montoTotalMoneda: total,
        montoGiftCard: null,
        descuentoAdicional: Number(venta.descuento) || 0,
        codigoExcepcion: null,
        cafc: null,
        leyenda,
        usuario: session.email ?? 'pos',
        codigoDocumentoSector: config.codigoDocumentoSector,
      },
      itemsResult.rows.map(item => ({
        actividadEconomica: actividad,
        codigoProductoSin: SIAT_CODIGO_PRODUCTO_SIN_DEFAULT,
        codigoProducto: item.producto_id ?? 'ITEM',
        descripcion: item.nombre_producto,
        cantidad: Number(item.cantidad),
        unidadMedida: SIAT_UNIDAD_MEDIDA_DEFAULT,
        precioUnitario: Number(item.precio_unitario),
        montoDescuento: Number(item.descuento) || 0,
        subTotal: Number(item.subtotal),
      })),
    )

    const facturaResult = await client.query<{ id: string }>(
      `
        insert into factura (
          tienda_id, config_id, cufd_id, venta_id, usuario_id, numero_factura, cuf,
          estado, fecha_emision, tipo_documento_identidad, numero_documento_cliente,
          complemento_documento, razon_social_cliente, correo_cliente,
          codigo_metodo_pago, numero_tarjeta, monto_total, monto_total_sujeto_iva,
          descuento_adicional, leyenda, xml
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'borrador', $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, $17, $18, $19)
        returning id
      `,
      [
        session.storeId,
        config.id,
        cufd.id,
        ventaId,
        session.id ?? null,
        numeroFactura,
        cuf,
        fechaEmision,
        tipoDocumento,
        encryptSecret(numeroDocumento),
        nullableText(clienteBody.complemento) ? encryptSecret(cleanText(clienteBody.complemento)) : null,
        encryptSecret(razonSocialCliente),
        nullableText(clienteBody.correo) ? encryptSecret(cleanText(clienteBody.correo)) : null,
        codigoMetodoPago,
        numeroTarjeta,
        total,
        Number(venta.descuento) || 0,
        leyenda,
        encryptSecret(xml),
      ],
    )

    const facturaId = facturaResult.rows[0]?.id
    await client.query('commit')

    // El envio al SIN se hace fuera de la transaccion: la factura ya quedo
    // registrada como borrador y el resultado actualiza su estado.
    const respuesta = await recepcionFactura(config, cufd.codigo, xml, fechaEmision)
    const aceptada = respuesta.transaccion && respuesta.codigoEstado === '908'
    const estado = aceptada ? 'emitida' : respuesta.codigoEstado === '904' ? 'observada' : 'rechazada'

    await pool.query(
      `
        update factura
        set estado = $2, codigo_recepcion = $3, mensajes_sin = $4::jsonb, updated_at = now()
        where id = $1
      `,
      [facturaId, estado, respuesta.codigoRecepcion, JSON.stringify(respuesta.mensajes)],
    )

    return {
      ok: aceptada,
      facturaId,
      numeroFactura,
      cuf,
      estado,
      mensajes: respuesta.mensajes,
    }
  }
  catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  }
  finally {
    client.release()
  }
})
