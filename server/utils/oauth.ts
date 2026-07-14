import process from 'node:process'
import { Google } from 'arctic'
import { createError, deleteCookie, getCookie, getRequestHeader, getRequestURL, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { pool } from './db'
import { createSessionToken, hashSessionToken } from './password'
import { requireSession } from './session'

// Sesion larga para OAuth: la experiencia "iniciar con Google" se asume como
// dispositivo de confianza, igual que el registro (90 dias).
const OAUTH_SESSION_DAYS = 90
const AUTH_INTENT_MINUTES = 10
const OAUTH_LINK_COOKIE = 'nexa_oauth_link_token'
const OAUTH_CONNECT_COOKIE = 'nexa_oauth_connect_token'
const PASSWORD_SETUP_COOKIE = 'nexa_password_setup_token'

// URI de retorno: se deriva del request para ser portable (funciona igual en
// Vercel y en un VPS sin tocar codigo). Si hay un proxy que oculta el host real
// se puede forzar con NEXA_PUBLIC_URL. Debe coincidir EXACTO con la URI que
// registres en Google Cloud Console.
export function getGoogleRedirectURI(event: H3Event) {
  const base = process.env.NEXA_PUBLIC_URL?.replace(/\/+$/, '')
  if (base) {
    return `${base}/api/auth/oauth/google/callback`
  }

  return `${getRequestURL(event).origin}/api/auth/oauth/google/callback`
}

export function getGoogleClient(event: H3Event) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Google OAuth no esta configurado en el servidor.' })
  }

  return new Google(clientId, clientSecret, getGoogleRedirectURI(event))
}

export type GoogleProfile = {
  sub: string
  email: string | null
  emailVerified: boolean
  name: string
  picture: string | null
}

type GoogleResolution =
  | { status: 'authenticated' | 'created', userId: string }
  | { status: 'link_required' | 'conflict' }

function authIntentCookieOptions(maxAge = AUTH_INTENT_MINUTES * 60, sameSite: 'strict' | 'lax' = 'strict') {
  return {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

async function clearExpiredAuthIntents() {
  await pool.query(`delete from auth_intent where expires_at <= now() or consumed_at is not null`)
}

async function createAuthIntent(input: {
  type: 'link_oauth' | 'connect_oauth' | 'set_password'
  userId: string
  provider?: string
  providerSub?: string
  email?: string | null
  avatarUrl?: string | null
}) {
  await clearExpiredAuthIntents()

  const token = createSessionToken()
  const expiresAt = new Date(Date.now() + AUTH_INTENT_MINUTES * 60 * 1000)
  await pool.query(
    `
      insert into auth_intent (
        token_hash, tipo, usuario_id, provider, provider_sub, email, avatar_url, expires_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      hashSessionToken(token),
      input.type,
      input.userId,
      input.provider ?? null,
      input.providerSub ?? null,
      input.email ?? null,
      input.avatarUrl ?? null,
      expiresAt,
    ],
  )

  return token
}

async function beginGoogleAccountLink(event: H3Event, userId: string, profile: GoogleProfile) {
  await pool.query(
    `delete from auth_intent where tipo = 'link_oauth' and usuario_id = $1`,
    [userId],
  )
  const token = await createAuthIntent({
    type: 'link_oauth',
    userId,
    provider: 'google',
    providerSub: profile.sub,
    email: profile.email,
    avatarUrl: profile.picture,
  })

  setCookie(event, OAUTH_LINK_COOKIE, token, authIntentCookieOptions())
}

export async function prepareCurrentUserGoogleLink(event: H3Event, userId: string) {
  await pool.query(`delete from auth_intent where tipo = 'connect_oauth' and usuario_id = $1`, [userId])
  const token = await createAuthIntent({ type: 'connect_oauth', userId, provider: 'google' })

  // Esta cookie debe volver en la navegacion GET desde Google. El token es opaco,
  // de un solo uso y solo su hash existe en la base de datos.
  setCookie(event, OAUTH_CONNECT_COOKIE, token, authIntentCookieOptions(AUTH_INTENT_MINUTES * 60, 'lax'))
}

// Emite la sesion exactamente como login/register: token aleatorio opaco,
// hasheado en BD, cookie httpOnly. La unica diferencia es sameSite='lax' en vez
// de 'strict': el navegador vuelve de Google con una navegacion cross-site y una
// cookie 'strict' no se enviaria en el redirect posterior (quedaria "deslogueado
// hasta refrescar"). 'lax' se envia en navegaciones top-level GET, que es el caso.
export async function issueOAuthSession(event: H3Event, userId: string) {
  const token = createSessionToken()
  const maxAge = OAUTH_SESSION_DAYS * 24 * 60 * 60
  const expiresAt = new Date(Date.now() + maxAge * 1000)

  await pool.query(
    `
      insert into sesion (usuario_id, token_hash, user_agent, ip, expires_at)
      values ($1, $2, $3, $4, $5)
    `,
    [
      userId,
      hashSessionToken(token),
      getRequestHeader(event, 'user-agent') ?? null,
      getRequestHeader(event, 'x-forwarded-for') ?? event.node.req.socket.remoteAddress ?? null,
      expiresAt,
    ],
  )

  await pool.query('update usuario set ultimo_acceso_at = now(), updated_at = now() where id = $1', [userId])

  setCookie(event, 'nexa_session_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
    maxAge,
  })
}

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54) || 'tienda'
}

async function uniqueStoreSlug(client: { query: typeof pool.query }, baseName: string) {
  const base = toSlug(baseName)

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const slug = `${base}${suffix}`.slice(0, 64).replace(/-+$/g, '')
    const existing = await client.query('select 1 from tienda where slug = $1 limit 1', [slug])

    if (!existing.rowCount) {
      return slug
    }
  }

  return `${base.slice(0, 45)}-${Date.now().toString(36)}`
}

// Resuelve el usuario detras de un perfil de Google. Un correo coincidente solo
// propone la vinculacion: no concede acceso hasta que el usuario autentique
// tambien la cuenta local.
export async function resolveGoogleUser(event: H3Event, profile: GoogleProfile): Promise<GoogleResolution> {
  const linked = await pool.query<{ id: string }>(
    `select id from usuario where oauth_provider = 'google' and oauth_sub = $1 limit 1`,
    [profile.sub],
  )

  if (linked.rows[0]) {
    return { status: 'authenticated', userId: linked.rows[0].id }
  }

  if (profile.email && profile.emailVerified) {
    const existing = await pool.query<{ id: string; password_hash: string | null }>(
      `select id, password_hash from usuario where lower(email) = $1 and estado <> 'bloqueado' limit 1`,
      [profile.email],
    )

    if (existing.rows[0]) {
      if (!existing.rows[0].password_hash) {
        return { status: 'conflict' }
      }

      await beginGoogleAccountLink(event, existing.rows[0].id, profile)
      return { status: 'link_required' }
    }
  }

  const userId = await createGoogleUserWithStore(profile)
  return { status: 'created', userId }
}

export async function completePendingOAuthLink(event: H3Event, authenticatedUserId: string) {
  const token = getCookie(event, OAUTH_LINK_COOKIE)
  if (!token) {
    return false
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    const intentResult = await client.query<{
      id: string
      user_id: string
      provider: string
      provider_sub: string
      avatar_url: string | null
    }>(
      `
        select id, usuario_id as user_id, provider, provider_sub, avatar_url
        from auth_intent
        where token_hash = $1
          and tipo = 'link_oauth'
          and consumed_at is null
          and expires_at > now()
        for update
      `,
      [hashSessionToken(token)],
    )
    const intent = intentResult.rows[0]

    if (!intent || intent.user_id !== authenticatedUserId) {
      throw createError({
        statusCode: 409,
        statusMessage: 'No se pudo confirmar la vinculacion con Google. Inicia el proceso nuevamente.',
      })
    }

    const owner = await client.query<{ id: string }>(
      `select id from usuario where oauth_provider = $1 and oauth_sub = $2 limit 1`,
      [intent.provider, intent.provider_sub],
    )
    if (owner.rows[0] && owner.rows[0].id !== authenticatedUserId) {
      throw createError({ statusCode: 409, statusMessage: 'Esta cuenta de Google ya esta vinculada.' })
    }

    const updated = await client.query(
      `
        update usuario
        set oauth_provider = $2,
            oauth_sub = $3,
            avatar_url = coalesce(avatar_url, $4),
            updated_at = now()
        where id = $1
          and (oauth_provider is null or (oauth_provider = $2 and oauth_sub = $3))
      `,
      [authenticatedUserId, intent.provider, intent.provider_sub, intent.avatar_url],
    )
    if (updated.rowCount !== 1) {
      throw createError({ statusCode: 409, statusMessage: 'La cuenta ya tiene otro acceso externo vinculado.' })
    }

    await client.query(`update auth_intent set consumed_at = now() where id = $1`, [intent.id])
    await client.query('commit')
    deleteCookie(event, OAUTH_LINK_COOKIE, { path: '/' })
    return true
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function completeCurrentUserGoogleLink(event: H3Event, profile: GoogleProfile) {
  const token = getCookie(event, OAUTH_CONNECT_COOKIE)
  if (!token) {
    throw createError({ statusCode: 403, statusMessage: 'La vinculacion vencio. Intenta nuevamente.' })
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    const intentResult = await client.query<{ id: string; user_id: string; provider: string }>(
      `
        select id, usuario_id as user_id, provider
        from auth_intent
        where token_hash = $1
          and tipo = 'connect_oauth'
          and consumed_at is null
          and expires_at > now()
        for update
      `,
      [hashSessionToken(token)],
    )
    const intent = intentResult.rows[0]

    if (!intent || intent.provider !== 'google') {
      throw createError({ statusCode: 403, statusMessage: 'La vinculacion vencio. Intenta nuevamente.' })
    }

    const owner = await client.query<{ id: string }>(
      `select id from usuario where oauth_provider = 'google' and oauth_sub = $1 limit 1`,
      [profile.sub],
    )
    if (owner.rows[0] && owner.rows[0].id !== intent.user_id) {
      throw createError({ statusCode: 409, statusMessage: 'Esta cuenta de Google ya esta vinculada.' })
    }

    const updated = await client.query(
      `
        update usuario
        set oauth_provider = 'google',
            oauth_sub = $2,
            avatar_url = coalesce(avatar_url, $3),
            updated_at = now()
        where id = $1
          and (oauth_provider is null or (oauth_provider = 'google' and oauth_sub = $2))
      `,
      [intent.user_id, profile.sub, profile.picture],
    )
    if (updated.rowCount !== 1) {
      throw createError({ statusCode: 409, statusMessage: 'La cuenta ya tiene otro acceso externo vinculado.' })
    }

    await client.query(`update auth_intent set consumed_at = now() where id = $1`, [intent.id])
    await client.query('commit')
    deleteCookie(event, OAUTH_CONNECT_COOKIE, { path: '/' })
    return intent.user_id
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function prepareOAuthPasswordSetup(event: H3Event, profile: GoogleProfile) {
  const session = await requireSession(event)
  const user = await pool.query<{ id: string }>(
    `
      select id
      from usuario
      where id = $1
        and oauth_provider = 'google'
        and oauth_sub = $2
        and password_hash is null
        and estado = 'activo'
      limit 1
    `,
    [session.id, profile.sub],
  )

  if (!user.rows[0]) {
    throw createError({ statusCode: 403, statusMessage: 'No se pudo verificar el acceso con Google.' })
  }

  await pool.query(`delete from auth_intent where tipo = 'set_password' and usuario_id = $1`, [session.id])
  const token = await createAuthIntent({ type: 'set_password', userId: session.id })
  setCookie(event, PASSWORD_SETUP_COOKIE, token, authIntentCookieOptions())
  return session
}

export async function completeOAuthPasswordSetup(event: H3Event, userId: string, passwordHash: string) {
  const token = getCookie(event, PASSWORD_SETUP_COOKIE)
  if (!token) {
    throw createError({ statusCode: 403, statusMessage: 'Vuelve a verificar tu cuenta con Google.' })
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    const intentResult = await client.query<{ id: string; user_id: string }>(
      `
        select id, usuario_id as user_id
        from auth_intent
        where token_hash = $1
          and tipo = 'set_password'
          and consumed_at is null
          and expires_at > now()
        for update
      `,
      [hashSessionToken(token)],
    )
    const intent = intentResult.rows[0]

    if (!intent || intent.user_id !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'La verificacion vencio. Intenta nuevamente.' })
    }

    const updated = await client.query(
      `
        update usuario
        set password_hash = $2, updated_at = now()
        where id = $1
          and password_hash is null
          and oauth_provider is not null
          and oauth_sub is not null
      `,
      [userId, passwordHash],
    )
    if (updated.rowCount !== 1) {
      throw createError({ statusCode: 409, statusMessage: 'La cuenta ya tiene una contrasena configurada.' })
    }

    await client.query(`update auth_intent set consumed_at = now() where id = $1`, [intent.id])
    await client.query('commit')
    deleteCookie(event, PASSWORD_SETUP_COOKIE, { path: '/' })
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

// Alta de un usuario nuevo via Google + su tienda demo. Replica el aprovisionamiento
// del registro por correo (tienda, rol propietario, nomina, empleado, caja) para
// que la experiencia inicial sea identica. Se mantiene aparte de register.post.ts
// a proposito: no tocamos el flujo de registro que ya funciona.
async function createGoogleUserWithStore(profile: GoogleProfile): Promise<string> {
  const firstName = profile.name.split(/\s+/)[0] || 'tu negocio'
  const businessName = `Negocio de ${firstName}`.slice(0, 120)
  const client = await pool.connect()

  try {
    await client.query('begin')

    // Si el correo ya esta tomado por otra cuenta (p. ej. no verificado y no se
    // vinculo arriba), se guarda null para no chocar con el unique de email: la
    // cuenta sigue identificada por (google, sub).
    let email = profile.email
    if (email) {
      const taken = await client.query('select 1 from usuario where lower(email) = $1 limit 1', [email])
      if (taken.rowCount) {
        email = null
      }
    }

    const userResult = await client.query<{ id: string }>(
      `
        insert into usuario (email, nombre, avatar_url, oauth_provider, oauth_sub, estado, ultimo_acceso_at)
        values ($1, $2, $3, 'google', $4, 'activo', now())
        returning id
      `,
      [email, profile.name, profile.picture, profile.sub],
    )
    const userId = userResult.rows[0]!.id

    const slug = await uniqueStoreSlug(client, businessName)
    const storeResult = await client.query<{ id: string }>(
      `
        insert into tienda (owner_id, nombre, slug, ciudad, departamento, pais, plan, activo, perfil_negocio_confirmado)
        values ($1, $2, $3, 'Cobija', 'Pando', 'Bolivia', 'demo', true, false)
        returning id
      `,
      [userId, businessName, slug],
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

    await client.query('commit')

    return userId
  } catch (error) {
    await client.query('rollback')

    // Carrera: dos peticiones del mismo Google (doble clic / dos pestañas) crearon
    // la cuenta a la vez. El índice único (oauth_provider, oauth_sub) rechaza la
    // segunda con 23505. No es un error real: la cuenta ya existe, la devolvemos.
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      const existing = await pool.query<{ id: string }>(
        `select id from usuario where oauth_provider = 'google' and oauth_sub = $1 limit 1`,
        [profile.sub],
      )

      if (existing.rows[0]) {
        return existing.rows[0].id
      }
    }

    throw error
  } finally {
    client.release()
  }
}
