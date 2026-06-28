import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { cleanText, requireStoreAccess } from '../../utils/posCatalog'

type ProfileBody = { businessName?: string; countryDialCode?: string; phone?: string; ubicacion?: string }

function digits(value: unknown) {
  return cleanText(value).replace(/\D/g, '')
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54) || 'tienda'
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()
  const body = await readBody<ProfileBody>(event)
  const businessName = cleanText(body.businessName)
  const dialCode = digits(body.countryDialCode || '+591')
  const phone = digits(body.phone)
  const ubicacion = cleanText(body.ubicacion)

  if (businessName.length < 2 || businessName.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa el nombre de tu negocio.' })
  }
  if (!['591', '51', '55'].includes(dialCode) || phone.length < 7 || phone.length > 12) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa un numero de contacto valido.' })
  }
  if (ubicacion.length < 3 || ubicacion.length > 160) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa una ubicacion publica valida.' })
  }

  const duplicate = await pool.query(
    `select 1 from tienda where id <> $1 and lower(trim(nombre)) = lower(trim($2)) limit 1`,
    [session.storeId, businessName],
  )
  if (duplicate.rowCount) {
    throw createError({ statusCode: 409, statusMessage: 'Ya existe un negocio con ese nombre en NEXA.' })
  }

  const baseSlug = slugify(businessName)
  const slugResult = await pool.query(
    `select case when exists(select 1 from tienda where slug = $2 and id <> $1)
      then $2 || '-' || substr($1::text, 1, 8) else $2 end as slug`,
    [session.storeId, baseSlug],
  )

  await pool.query(
    `update tienda set nombre = $2, slug = $3, telefono_whatsapp = $4,
       direccion_publica = $5, marketing_contacto_confirmado = true,
       perfil_negocio_confirmado = true, updated_at = now() where id = $1`,
    [session.storeId, businessName, slugResult.rows[0].slug, `${dialCode}${phone}`, ubicacion],
  )

  return { ok: true }
})
