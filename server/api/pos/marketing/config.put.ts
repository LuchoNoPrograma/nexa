import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, requireStoreAccess } from '../../../utils/posCatalog'

type MarketingConfigBody = {
  contacto?: string
  countryDialCode?: string
  phone?: string
  ubicacion?: string
}

function compactText(value: unknown, max: number) {
  return cleanText(value).replace(/\s+/g, ' ').slice(0, max)
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

const allowedDialCodes = new Set(['591', '51', '55'])

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'haru.usar')
  await ensureDatabase()

  const body = await readBody<MarketingConfigBody | null>(event)
  const localPhone = normalizePhone(cleanText(body?.phone))
  const countryDialCode = normalizePhone(cleanText(body?.countryDialCode) || '+591')
  const contacto = localPhone
    ? `${countryDialCode}${localPhone}`
    : normalizePhone(compactText(body?.contacto, 60))
  const ubicacion = compactText(body?.ubicacion, 160)

  if (localPhone && !allowedDialCodes.has(countryDialCode)) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona un codigo de pais valido.' })
  }

  if (localPhone && (localPhone.length < 7 || localPhone.length > 12 || contacto.length > 15)) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa un numero de celular valido.' })
  }

  if (!localPhone && contacto.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa un contacto comercial valido para tus publicaciones.' })
  }

  if (ubicacion.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa una ubicacion publica del negocio.' })
  }

  const result = await pool.query<{
    contacto: string | null
    ubicacion: string | null
    confirmado: boolean
  }>(
    `
      update tienda
      set
        telefono_whatsapp = $2,
        direccion_publica = $3,
        marketing_contacto_confirmado = true,
        updated_at = now()
      where id = $1
      returning
        telefono_whatsapp as contacto,
        direccion_publica as ubicacion,
        marketing_contacto_confirmado as confirmado
    `,
    [session.storeId, contacto, ubicacion],
  )

  return { config: result.rows[0] }
})
