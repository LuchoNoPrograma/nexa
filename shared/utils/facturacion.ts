// Dominio de facturacion electronica SIAT (SIN Bolivia).
// Referencia: https://siatinfo.impuestos.gob.bo (RND 102100000011 y conexas).
// Todo lo de este archivo es puro (sin IO) para poder probarse aislado.

export const SIAT_AMBIENTE = {
  produccion: 1,
  pruebas: 2,
} as const

export const SIAT_MODALIDAD = {
  electronica: 1,
  computarizada: 2,
} as const

export const SIAT_TIPO_EMISION = {
  enLinea: 1,
  fueraDeLinea: 2,
  masiva: 3,
} as const

// 1 = factura con derecho a credito fiscal (caso general compra-venta).
export const SIAT_TIPO_FACTURA = {
  conCreditoFiscal: 1,
  sinCreditoFiscal: 2,
} as const

export const SIAT_DOCUMENTO_SECTOR = {
  compraVenta: 1,
} as const

export const SIAT_TIPO_DOCUMENTO_IDENTIDAD = [
  { codigo: 1, descripcion: 'CI - Cedula de identidad' },
  { codigo: 2, descripcion: 'CEX - Cedula de identidad de extranjero' },
  { codigo: 3, descripcion: 'PAS - Pasaporte' },
  { codigo: 4, descripcion: 'OD - Otro documento de identidad' },
  { codigo: 5, descripcion: 'NIT - Numero de identificacion tributaria' },
] as const

// Subconjunto usual del catalogo de metodos de pago del SIAT. La lista
// completa se obtiene con sincronizarParametricaTipoMetodoPago.
export const SIAT_METODO_PAGO = [
  { codigo: 1, descripcion: 'Efectivo' },
  { codigo: 2, descripcion: 'Tarjeta' },
  { codigo: 7, descripcion: 'Transferencia bancaria' },
  { codigo: 33, descripcion: 'Efectivo + Tarjeta' },
] as const

// Unidad de medida generica "Unidad (Bienes)" del catalogo SIAT.
export const SIAT_UNIDAD_MEDIDA_DEFAULT = 58
// Codigo de producto SIN generico para servicios/varios cuando no se mapeo
// el catalogo oficial de productos y servicios.
export const SIAT_CODIGO_PRODUCTO_SIN_DEFAULT = '99100'

export const SIAT_MOTIVO_ANULACION = [
  { codigo: 1, descripcion: 'Factura mal emitida' },
  { codigo: 2, descripcion: 'Nota de credito-debito mal emitida' },
  { codigo: 3, descripcion: 'Datos de emision incorrectos' },
  { codigo: 4, descripcion: 'Factura o nota de credito-debito devuelta' },
] as const

export const FACTURA_ESTADOS = ['borrador', 'emitida', 'observada', 'rechazada', 'anulada'] as const
export type FacturaEstado = (typeof FACTURA_ESTADOS)[number]

export type FacturacionConfig = {
  nit: string
  razonSocial: string
  municipio: string | null
  telefono: string | null
  direccion: string | null
  modalidad: number
  ambiente: number
  codigoSistema: string | null
  codigoSucursal: number
  codigoPuntoVenta: number
  codigoActividad: string | null
  codigoDocumentoSector: number
  tokenDelegado: string | null
  cuis: string | null
  estado: string
}

export type CufInput = {
  nit: string
  fechaEmision: Date
  codigoSucursal: number
  modalidad: number
  tipoEmision: number
  tipoFactura: number
  codigoDocumentoSector: number
  numeroFactura: number
  codigoPuntoVenta: number
  codigoControlCufd: string
}

// Fecha en formato SIAT: yyyyMMddHHmmssSSS (hora local de Bolivia, UTC-4).
export function formatoFechaSiat(fecha: Date): string {
  const bolivia = new Date(fecha.getTime() - 4 * 60 * 60 * 1000)
  const pad = (value: number, length: number) => String(value).padStart(length, '0')

  return (
    pad(bolivia.getUTCFullYear(), 4)
    + pad(bolivia.getUTCMonth() + 1, 2)
    + pad(bolivia.getUTCDate(), 2)
    + pad(bolivia.getUTCHours(), 2)
    + pad(bolivia.getUTCMinutes(), 2)
    + pad(bolivia.getUTCSeconds(), 2)
    + pad(bolivia.getUTCMilliseconds(), 3)
  )
}

// Fecha-hora para el XML de la factura: yyyy-MM-ddTHH:mm:ss.SSS (hora Bolivia).
export function formatoFechaXml(fecha: Date): string {
  const compacta = formatoFechaSiat(fecha)
  return `${compacta.slice(0, 4)}-${compacta.slice(4, 6)}-${compacta.slice(6, 8)}`
    + `T${compacta.slice(8, 10)}:${compacta.slice(10, 12)}:${compacta.slice(12, 14)}.${compacta.slice(14, 17)}`
}

// Digito verificador modulo 11 segun especificacion SIAT: multiplicadores
// ciclicos 2..9 desde el digito menos significativo; 10 -> 1, 11 -> 0.
export function modulo11(dato: string): string {
  let suma = 0
  let multiplicador = 2

  for (let i = dato.length - 1; i >= 0; i--) {
    suma += Number(dato[i]) * multiplicador
    multiplicador = multiplicador === 9 ? 2 : multiplicador + 1
  }

  const digito = 11 - (suma % 11)

  if (digito === 11) return '0'
  if (digito === 10) return '1'
  return String(digito)
}

// CUF (codigo unico de factura): se concatenan los campos con padding fijo
// (53 digitos), se agrega el verificador modulo 11, se convierte el numero a
// base 16 y se le anexa el codigo de control del CUFD vigente.
export function generarCuf(input: CufInput): string {
  const base =
    input.nit.replace(/\D/g, '').padStart(13, '0')
    + formatoFechaSiat(input.fechaEmision)
    + String(input.codigoSucursal).padStart(4, '0')
    + String(input.modalidad)
    + String(input.tipoEmision)
    + String(input.tipoFactura)
    + String(input.codigoDocumentoSector).padStart(2, '0')
    + String(input.numeroFactura).padStart(10, '0')
    + String(input.codigoPuntoVenta).padStart(4, '0')

  const conVerificador = base + modulo11(base)
  const hexadecimal = BigInt(conVerificador).toString(16).toUpperCase()

  return hexadecimal + input.codigoControlCufd
}

export function esNitValido(nit: string): boolean {
  const limpio = nit.replace(/\D/g, '')
  return limpio.length >= 5 && limpio.length <= 13
}

export function descripcionMotivoAnulacion(codigo: number): string {
  return SIAT_MOTIVO_ANULACION.find(m => m.codigo === codigo)?.descripcion ?? 'Motivo desconocido'
}
