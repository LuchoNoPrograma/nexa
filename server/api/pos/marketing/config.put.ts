import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, requireStoreAccess } from '../../../utils/posCatalog'

type MarketingConfigBody = {
  contacto?: string
  ubicacion?: string
}

function compactText(value: unknown, max: number) {
  return cleanText(value).replace(/\s+/g, ' ').slice(0, max)
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'haru.usar')
  await ensureDatabase()

  const body = await readBody<MarketingConfigBody | null>(event)
  const contacto = compactText(body?.contacto, 60)
  const ubicacion = compactText(body?.ubicacion, 160)

  if (contacto.length < 6) {
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
