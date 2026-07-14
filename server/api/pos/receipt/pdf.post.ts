import { createError, readBody, setHeader } from 'h3'
import { renderThermalHtmlToPdf } from '../../../utils/pdf'
import { requireStoreAccess } from '../../../utils/posCatalog'
import { assertRateLimit } from '../../../utils/rateLimit'
import { renderThermalDocumentHtml, type ThermalDocument } from '../../../utils/thermalDocuments'

type ReceiptPdfBody = {
  filename?: string
  document?: ThermalDocument
}

function safeFilename(value: unknown) {
  if (typeof value !== 'string') {
    return 'comprobante.pdf'
  }

  const cleaned = value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-zA-Z0-9.-]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase()

  return cleaned.endsWith('.pdf') ? cleaned : `${cleaned || 'comprobante'}.pdf`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validateThermalDocument(value: unknown): ThermalDocument {
  if (!isRecord(value)) {
    throw createError({ statusCode: 400, statusMessage: 'El documento es requerido.' })
  }

  if (value.type !== 'sale' && value.type !== 'cash-report') {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de documento no soportado.' })
  }

  return value as ThermalDocument
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'VENDER || CAJA || REPORTE')

  await assertRateLimit(event, {
    namespace: 'pos.receipt.pdf',
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyParts: [session.id, session.storeId],
    message: 'Espera un momento antes de generar otro PDF.',
  })

  const body = await readBody<ReceiptPdfBody>(event)
  const document = validateThermalDocument(body.document)
  const filename = safeFilename(body.filename)
  const html = renderThermalDocumentHtml(document)
  const pdf = await renderThermalHtmlToPdf(html)

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return pdf
})
