// Cliente SOAP para los servicios web de facturacion del SIAT (SIN Bolivia).
// Los servicios usan SOAP 1.1 con autenticacion por header `apikey`
// (token delegado que entrega el SIN al autorizar el sistema).
// Piloto:     https://pilotosiatservicios.impuestos.gob.bo/v2/...
// Produccion: https://siatservicios.impuestos.gob.bo/v2/...
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import {
  SIAT_AMBIENTE,
  SIAT_TIPO_FACTURA,
  formatoFechaXml,
  type FacturacionConfig,
} from '../../shared/utils/facturacion'

const SIAT_BASE = {
  [SIAT_AMBIENTE.produccion]: 'https://siatservicios.impuestos.gob.bo/v2',
  [SIAT_AMBIENTE.pruebas]: 'https://pilotosiatservicios.impuestos.gob.bo/v2',
} as const

export const SIAT_SERVICIO = {
  codigos: 'FacturacionCodigos',
  sincronizacion: 'FacturacionSincronizacion',
  operaciones: 'FacturacionOperaciones',
  compraVenta: 'ServicioFacturacionCompraVenta',
} as const

type SoapPayload = Record<string, string | number | null | undefined>

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildEnvelope(operation: string, solicitudTag: string, payload: SoapPayload): string {
  const fields = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `<${key}>${escapeXml(String(value))}</${key}>`)
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:siat="https://siat.impuestos.gob.bo/">`
    + `<soapenv:Header/>`
    + `<soapenv:Body><siat:${operation}><${solicitudTag}>${fields}</${solicitudTag}></siat:${operation}></soapenv:Body>`
    + `</soapenv:Envelope>`
}

// Extraccion simple de tags de la respuesta SOAP. Los servicios del SIAT
// devuelven estructuras planas (RespuestaCuis, RespuestaCufd, etc.), por lo
// que no hace falta un parser XML completo.
function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`))
  return match ? match[1].trim() : null
}

function extractAllTags(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'g'))]
    .map(m => m[1].trim())
}

export type SiatRespuesta = {
  transaccion: boolean
  raw: string
  mensajes: { codigo: string | null, descripcion: string | null }[]
}

export async function soapCall(
  config: Pick<FacturacionConfig, 'ambiente' | 'tokenDelegado'>,
  servicio: string,
  operation: string,
  solicitudTag: string,
  payload: SoapPayload,
): Promise<string> {
  const base = SIAT_BASE[config.ambiente as keyof typeof SIAT_BASE]

  if (!base) {
    throw new Error(`Ambiente SIAT invalido: ${config.ambiente}`)
  }

  if (!config.tokenDelegado) {
    throw new Error('Configura el token delegado (apikey) entregado por el SIN.')
  }

  const response = await fetch(`${base}/${servicio}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'apikey': `TokenApi ${config.tokenDelegado}`,
      'SOAPAction': '',
    },
    body: buildEnvelope(operation, solicitudTag, payload),
    signal: AbortSignal.timeout(30_000),
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`SIAT ${servicio}/${operation} fallo (${response.status}): ${text.slice(0, 500)}`)
  }

  return text
}

function parseRespuesta(xml: string): SiatRespuesta {
  const codigos = extractAllTags(xml, 'codigo')
  const descripciones = extractAllTags(xml, 'descripcion')

  return {
    transaccion: extractTag(xml, 'transaccion') === 'true',
    raw: xml,
    mensajes: descripciones.map((descripcion, index) => ({
      codigo: codigos[index] ?? null,
      descripcion,
    })),
  }
}

function basePayload(config: FacturacionConfig): SoapPayload {
  return {
    codigoAmbiente: config.ambiente,
    codigoSistema: config.codigoSistema,
    nit: config.nit,
    codigoSucursal: config.codigoSucursal,
  }
}

// --- FacturacionCodigos -----------------------------------------------------

export async function solicitarCuis(config: FacturacionConfig) {
  const xml = await soapCall(config, SIAT_SERVICIO.codigos, 'cuis', 'SolicitudCuis', {
    ...basePayload(config),
    codigoModalidad: config.modalidad,
    codigoPuntoVenta: config.codigoPuntoVenta,
  })

  return {
    ...parseRespuesta(xml),
    codigo: extractTag(xml, 'codigo'),
    fechaVigencia: extractTag(xml, 'fechaVigencia'),
  }
}

export async function solicitarCufd(config: FacturacionConfig) {
  if (!config.cuis) {
    throw new Error('Solicita primero el CUIS del punto de venta.')
  }

  const xml = await soapCall(config, SIAT_SERVICIO.codigos, 'cufd', 'SolicitudCufd', {
    ...basePayload(config),
    codigoModalidad: config.modalidad,
    codigoPuntoVenta: config.codigoPuntoVenta,
    cuis: config.cuis,
  })

  return {
    ...parseRespuesta(xml),
    codigo: extractTag(xml, 'codigo'),
    codigoControl: extractTag(xml, 'codigoControl'),
    direccion: extractTag(xml, 'direccion'),
    fechaVigencia: extractTag(xml, 'fechaVigencia'),
  }
}

// --- FacturacionSincronizacion ----------------------------------------------

const SINCRONIZACION_OPERACIONES: Record<string, string> = {
  fecha_hora: 'sincronizarFechaHora',
  actividades: 'sincronizarActividades',
  leyendas: 'sincronizarListaLeyendasFactura',
  productos_sin: 'sincronizarListaProductosServicios',
  metodos_pago: 'sincronizarParametricaTipoMetodoPago',
  unidades_medida: 'sincronizarParametricaUnidadMedida',
  motivos_anulacion: 'sincronizarParametricaMotivoAnulacion',
  documentos_identidad: 'sincronizarParametricaTipoDocumentoIdentidad',
  eventos_significativos: 'sincronizarParametricaEventosSignificativos',
}

export function operacionesSincronizacion() {
  return Object.keys(SINCRONIZACION_OPERACIONES)
}

export async function sincronizarCatalogo(config: FacturacionConfig, tipo: string) {
  const operacion = SINCRONIZACION_OPERACIONES[tipo]

  if (!operacion) {
    throw new Error(`Catalogo desconocido: ${tipo}`)
  }

  const xml = await soapCall(config, SIAT_SERVICIO.sincronizacion, operacion, 'SolicitudSincronizacion', {
    ...basePayload(config),
    codigoPuntoVenta: config.codigoPuntoVenta,
    cuis: config.cuis,
  })

  // Cada item del listado llega como <listaCodigos|listaActividades|...> con
  // pares codigo/descripcion; los guardamos normalizados.
  const codigos = extractAllTags(xml, 'codigoClasificador')
  const descripciones = extractAllTags(xml, 'descripcion')

  return {
    ...parseRespuesta(xml),
    items: codigos.map((codigo, index) => ({
      codigo,
      descripcion: descripciones[index] ?? '',
    })),
  }
}

// --- ServicioFacturacionCompraVenta -----------------------------------------

// El XML de la factura viaja comprimido con gzip, en base64, junto a su
// hash SHA-256 en hexadecimal.
export function empaquetarFactura(xmlFactura: string) {
  const comprimido = gzipSync(Buffer.from(xmlFactura, 'utf-8'))

  return {
    archivo: comprimido.toString('base64'),
    hashArchivo: createHash('sha256').update(comprimido).digest('hex'),
  }
}

export async function recepcionFactura(
  config: FacturacionConfig,
  cufd: string,
  xmlFactura: string,
  fechaEnvio: Date,
) {
  const { archivo, hashArchivo } = empaquetarFactura(xmlFactura)

  const xml = await soapCall(config, SIAT_SERVICIO.compraVenta, 'recepcionFactura', 'SolicitudServicioRecepcionFactura', {
    ...basePayload(config),
    codigoDocumentoSector: config.codigoDocumentoSector,
    codigoEmision: 1,
    codigoModalidad: config.modalidad,
    codigoPuntoVenta: config.codigoPuntoVenta,
    cufd,
    cuis: config.cuis,
    tipoFacturaDocumento: SIAT_TIPO_FACTURA.conCreditoFiscal,
    archivo,
    fechaEnvio: formatoFechaXml(fechaEnvio),
    hashArchivo,
  })

  return {
    ...parseRespuesta(xml),
    codigoRecepcion: extractTag(xml, 'codigoRecepcion'),
    codigoEstado: extractTag(xml, 'codigoEstado'),
  }
}

export async function anulacionFactura(
  config: FacturacionConfig,
  cufd: string,
  cuf: string,
  codigoMotivo: number,
) {
  const xml = await soapCall(config, SIAT_SERVICIO.compraVenta, 'anulacionFactura', 'SolicitudServicioAnulacionFactura', {
    ...basePayload(config),
    codigoDocumentoSector: config.codigoDocumentoSector,
    codigoEmision: 1,
    codigoModalidad: config.modalidad,
    codigoPuntoVenta: config.codigoPuntoVenta,
    cufd,
    cuis: config.cuis,
    tipoFacturaDocumento: SIAT_TIPO_FACTURA.conCreditoFiscal,
    codigoMotivo,
    cuf,
  })

  return {
    ...parseRespuesta(xml),
    codigoEstado: extractTag(xml, 'codigoEstado'),
  }
}

export async function verificacionEstadoFactura(config: FacturacionConfig, cufd: string, cuf: string) {
  const xml = await soapCall(config, SIAT_SERVICIO.compraVenta, 'verificacionEstadoFactura', 'SolicitudServicioVerificacionEstadoFactura', {
    ...basePayload(config),
    codigoDocumentoSector: config.codigoDocumentoSector,
    codigoEmision: 1,
    codigoModalidad: config.modalidad,
    codigoPuntoVenta: config.codigoPuntoVenta,
    cufd,
    cuis: config.cuis,
    tipoFacturaDocumento: SIAT_TIPO_FACTURA.conCreditoFiscal,
    cuf,
  })

  return {
    ...parseRespuesta(xml),
    codigoEstado: extractTag(xml, 'codigoEstado'),
  }
}

// --- XML de la factura (documento sector compra-venta) -----------------------

export type FacturaXmlCabecera = {
  nitEmisor: string
  razonSocialEmisor: string
  municipio: string
  telefono: string | null
  numeroFactura: number
  cuf: string
  cufd: string
  codigoSucursal: number
  direccion: string
  codigoPuntoVenta: number
  fechaEmision: Date
  nombreRazonSocial: string
  codigoTipoDocumentoIdentidad: number
  numeroDocumento: string
  complemento: string | null
  codigoCliente: string
  codigoMetodoPago: number
  numeroTarjeta: string | null
  montoTotal: number
  montoTotalSujetoIva: number
  codigoMoneda: number
  tipoCambio: number
  montoTotalMoneda: number
  montoGiftCard: number | null
  descuentoAdicional: number
  codigoExcepcion: number | null
  cafc: string | null
  leyenda: string
  usuario: string
  codigoDocumentoSector: number
}

export type FacturaXmlDetalle = {
  actividadEconomica: string
  codigoProductoSin: string
  codigoProducto: string
  descripcion: string
  cantidad: number
  unidadMedida: number
  precioUnitario: number
  montoDescuento: number
  subTotal: number
}

function xmlField(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return `<${name} xsi:nil="true"/>`
  }
  return `<${name}>${escapeXml(String(value))}</${name}>`
}

// Genera el XML segun el esquema facturaComputarizadaCompraVenta.xsd
// (modalidad 2). Para modalidad electronica (1) el documento raiz cambia a
// facturaElectronicaCompraVenta y debe firmarse con XMLDSig y certificado
// digital emitido por ADSIB o entidad certificadora autorizada.
export function generarXmlFactura(cabecera: FacturaXmlCabecera, detalles: FacturaXmlDetalle[]): string {
  const cabeceraXml = [
    xmlField('nitEmisor', cabecera.nitEmisor),
    xmlField('razonSocialEmisor', cabecera.razonSocialEmisor),
    xmlField('municipio', cabecera.municipio),
    xmlField('telefono', cabecera.telefono),
    xmlField('numeroFactura', cabecera.numeroFactura),
    xmlField('cuf', cabecera.cuf),
    xmlField('cufd', cabecera.cufd),
    xmlField('codigoSucursal', cabecera.codigoSucursal),
    xmlField('direccion', cabecera.direccion),
    xmlField('codigoPuntoVenta', cabecera.codigoPuntoVenta),
    xmlField('fechaEmision', formatoFechaXml(cabecera.fechaEmision)),
    xmlField('nombreRazonSocial', cabecera.nombreRazonSocial),
    xmlField('codigoTipoDocumentoIdentidad', cabecera.codigoTipoDocumentoIdentidad),
    xmlField('numeroDocumento', cabecera.numeroDocumento),
    xmlField('complemento', cabecera.complemento),
    xmlField('codigoCliente', cabecera.codigoCliente),
    xmlField('codigoMetodoPago', cabecera.codigoMetodoPago),
    xmlField('numeroTarjeta', cabecera.numeroTarjeta),
    xmlField('montoTotal', cabecera.montoTotal.toFixed(2)),
    xmlField('montoTotalSujetoIva', cabecera.montoTotalSujetoIva.toFixed(2)),
    xmlField('codigoMoneda', cabecera.codigoMoneda),
    xmlField('tipoCambio', cabecera.tipoCambio),
    xmlField('montoTotalMoneda', cabecera.montoTotalMoneda.toFixed(2)),
    xmlField('montoGiftCard', cabecera.montoGiftCard),
    xmlField('descuentoAdicional', cabecera.descuentoAdicional.toFixed(2)),
    xmlField('codigoExcepcion', cabecera.codigoExcepcion),
    xmlField('cafc', cabecera.cafc),
    xmlField('leyenda', cabecera.leyenda),
    xmlField('usuario', cabecera.usuario),
    xmlField('codigoDocumentoSector', cabecera.codigoDocumentoSector),
  ].join('')

  const detallesXml = detalles.map(detalle => '<detalle>' + [
    xmlField('actividadEconomica', detalle.actividadEconomica),
    xmlField('codigoProductoSin', detalle.codigoProductoSin),
    xmlField('codigoProducto', detalle.codigoProducto),
    xmlField('descripcion', detalle.descripcion),
    xmlField('cantidad', detalle.cantidad),
    xmlField('unidadMedida', detalle.unidadMedida),
    xmlField('precioUnitario', detalle.precioUnitario.toFixed(2)),
    xmlField('montoDescuento', detalle.montoDescuento.toFixed(2)),
    xmlField('subTotal', detalle.subTotal.toFixed(2)),
  ].join('') + '</detalle>').join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<facturaComputarizadaCompraVenta xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="facturaComputarizadaCompraVenta.xsd">`
    + `<cabecera>${cabeceraXml}</cabecera>`
    + detallesXml
    + `</facturaComputarizadaCompraVenta>`
}
