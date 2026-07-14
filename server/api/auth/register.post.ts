import { createError, getRequestHeader, readBody, setCookie } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { createSessionToken, hashPassword, hashSessionToken } from '../../utils/password'
import { assertRateLimit } from '../../utils/rateLimit'

type RegisterBody = {
  fullName?: string
  phone?: string
  countryDialCode?: string
  businessName?: string
  city?: string
  password?: string
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

const allowedDialCodes = new Set(['591', '51', '55'])
const REGISTER_SESSION_DAYS = 90

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54) || 'tienda'
}

async function uniqueStoreSlug(baseName: string) {
  const base = toSlug(baseName)

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const slug = `${base}${suffix}`.slice(0, 64).replace(/-+$/g, '')
    const existing = await pool.query('select 1 from tienda where slug = $1 limit 1', [slug])

    if (!existing.rowCount) {
      return slug
    }
  }

  return `${base.slice(0, 45)}-${Date.now().toString(36)}`
}

export default defineEventHandler(async (event) => {
  await ensureDatabase()

  const body = await readBody<RegisterBody>(event)
  const fullName = cleanText(body.fullName)
  const localPhone = normalizePhone(cleanText(body.phone))
  const countryDialCode = normalizePhone(cleanText(body.countryDialCode) || '+591')
  const phone = `${countryDialCode}${localPhone}`
  const businessName = cleanText(body.businessName)
  const city = cleanText(body.city) || 'Cobija'
  const password = body.password ?? ''

  if (fullName.length < 3 || fullName.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa tu nombre completo.' })
  }

  if (!allowedDialCodes.has(countryDialCode)) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona un codigo de pais valido.' })
  }

  if (localPhone.length < 7 || localPhone.length > 12 || phone.length > 15) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa un numero de celular valido.' })
  }

  if (businessName.length < 2 || businessName.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa el nombre de tu negocio.' })
  }

  if (city.length < 2 || city.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa una ciudad valida.' })
  }

  if (password.length < 10 || password.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener entre 10 y 128 caracteres.' })
  }

  await assertRateLimit(event, {
    namespace: 'registro',
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    keyParts: [phone],
    message: 'Se realizaron varios registros desde este dispositivo. Intenta nuevamente mas tarde.',
  })

  const existingPhone = await pool.query<{ nombre: string; created_at: Date }>(
    'select nombre, created_at from usuario where telefono = $1 limit 1',
    [phone],
  )
  if (existingPhone.rowCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ese celular ya tiene una cuenta en NEXA. Inicia sesion con ese celular o usa otro numero.',
      data: {
        reason: 'phone_already_registered',
      },
    })
  }

  const existingBusiness = await pool.query(
    'select 1 from tienda where lower(trim(nombre)) = lower(trim($1)) limit 1',
    [businessName],
  )
  if (existingBusiness.rowCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ya existe un negocio con ese nombre en NEXA. Usa un nombre que permita distinguirlo.',
      data: { reason: 'store_name_already_registered' },
    })
  }

  const passwordHash = await hashPassword(password)
  const slug = await uniqueStoreSlug(businessName)
  const token = createSessionToken()
  const tokenHash = hashSessionToken(token)
  const maxAge = REGISTER_SESSION_DAYS * 24 * 60 * 60
  const expiresAt = new Date(Date.now() + maxAge * 1000)
  const client = await pool.connect()

  try {
    await client.query('begin')

    const userResult = await client.query<{ id: string }>(
      `
        insert into usuario (email, nombre, password_hash, telefono, estado, ultimo_acceso_at)
        values (null, $1, $2, $3, 'activo', now())
        returning id
      `,
      [fullName, passwordHash, phone],
    )
    const userId = userResult.rows[0]!.id

    const storeResult = await client.query<{ id: string }>(
      `
        insert into tienda (
          owner_id, nombre, slug, ciudad, departamento, pais, telefono_whatsapp, plan, activo
        )
        values ($1, $2, $3, $4, 'Pando', 'Bolivia', $5, 'demo', true)
        returning id
      `,
      [userId, businessName, slug, city, phone],
    )
    const storeId = storeResult.rows[0]!.id

    await client.query(
      `
        insert into tienda_usuario (tienda_id, usuario_id, cargo, estado, joined_at)
        values ($1, $2, 'Propietario', 'activo', now())
      `,
      [storeId, userId],
    )

    const roleResult = await client.query<{ id: string }>(
      `select id from rol where alcance = 'tienda' and codigo = 'propietario' and tienda_id is null limit 1`,
    )
    const roleId = roleResult.rows[0]?.id

    if (!roleId) {
      throw createError({ statusCode: 500, statusMessage: 'No existe el rol propietario.' })
    }

    await client.query(
      `insert into usuario_rol (usuario_id, rol_id, tienda_id) values ($1, $2, $3)`,
      [userId, roleId, storeId],
    )

    await client.query(
      `
        insert into nomina_config (tienda_id, salario_minimo_mensual, horas_mensuales_referencia, semanas_por_mes)
        values ($1, 3300, 207.84, 4.33)
        on conflict (tienda_id) do nothing
      `,
      [storeId],
    )

    await client.query(
      `
        insert into empleado (tienda_id, nombre, puesto, color, orden, numero)
        values ($1, 'Empleado 1', 'Atencion y caja', '#22c55e', 0, 1)
      `,
      [storeId],
    )

    await client.query(
      `
        insert into caja_sesion (tienda_id, usuario_id, saldo_inicial, saldo_esperado, notas)
        values ($1, $2, 0, 0, 'Caja inicial del negocio')
      `,
      [storeId, userId],
    )

    await client.query(
      `
        insert into sesion (usuario_id, tienda_id, token_hash, user_agent, ip, expires_at)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        userId,
        storeId,
        tokenHash,
        getRequestHeader(event, 'user-agent') ?? null,
        getRequestHeader(event, 'x-forwarded-for') ?? event.node.req.socket.remoteAddress ?? null,
        expiresAt,
      ],
    )

    await client.query('commit')

    setCookie(event, 'nexa_session_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: expiresAt,
      maxAge,
    })

    return {
      user: { id: userId, name: fullName, phone },
      store: { id: storeId, name: businessName, slug },
    }
  } catch (error) {
    await client.query('rollback')

    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      const constraint = 'constraint' in error && typeof error.constraint === 'string' ? error.constraint : ''

      if (constraint === 'usuario_telefono_unique') {
        throw createError({
          statusCode: 409,
          statusMessage: 'Ese celular ya tiene una cuenta en NEXA. Inicia sesion con ese celular o usa otro numero.',
          data: {
            reason: 'phone_already_registered',
          },
        })
      }

      if (constraint === 'tienda_slug_key') {
        throw createError({
          statusCode: 409,
          statusMessage: 'Ese nombre de negocio ya esta registrado. Cambia el nombre visible de la tienda e intenta nuevamente.',
          data: {
            reason: 'store_name_already_registered',
          },
        })
      }

      throw createError({
        statusCode: 409,
        statusMessage: 'No se pudo crear la cuenta porque uno de los datos ya esta registrado.',
        data: {
          reason: 'unique_constraint',
          constraint,
        },
      })
    }

    throw error
  } finally {
    client.release()
  }
})
