import { createError, getRequestHeader, readBody, setCookie } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { assertLoginAllowed, clearLoginFailures, getLoginRateLimitKey, recordLoginFailure } from '../../utils/loginRateLimit'
import { completePendingOAuthLink } from '../../utils/oauth'
import { createSessionToken, hashSessionToken, verifyPassword } from '../../utils/password'
import { assertRateLimit } from '../../utils/rateLimit'

const SESSION_DAYS = {
  normal: 7,
  remembered: 90,
} as const

type LoginBody = {
  identificador?: string
  email?: string
  password?: string
  remember?: boolean
}

export default defineEventHandler(async (event) => {
  await ensureDatabase()

  const body = await readBody<LoginBody>(event)
  // Se acepta correo, carnet de identidad (CI) o celular como identificador.
  const identificador = (body.identificador ?? body.email ?? '').trim()
  const identificadorTelefono = identificador.replace(/\D/g, '')
  const password = body.password ?? ''

  if (!identificador || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Correo/CI/celular y contraseña son requeridos.' })
  }

  const rateLimitKey = getLoginRateLimitKey(event, identificador.toLowerCase())
  await assertRateLimit(event, {
    namespace: 'login',
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
    keyParts: [identificador.toLowerCase()],
    message: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
  })
  assertLoginAllowed(rateLimitKey)

  const userResult = await pool.query<{
    id: string
    email: string
    name: string
    password_hash: string | null
  }>(
    `
      select id, email, nombre as name, password_hash
      from usuario
      where (
          lower(email) = lower($1)
          or ci = $1
          or ($2 <> '' and telefono = $2)
          or (
            $2 <> ''
            and length($2) >= 7
            and right(telefono, length($2)) = $2
            and (
              select count(*)
              from usuario u2
              where u2.estado = 'activo'
                and right(u2.telefono, length($2)) = $2
            ) = 1
          )
        )
        and estado = 'activo'
      limit 1
    `,
    [identificador, identificadorTelefono],
  )

  const user = userResult.rows[0]

  if (!user) {
    recordLoginFailure(rateLimitKey)
    throw createError({ statusCode: 401, statusMessage: 'Credenciales invalidas o metodo de acceso incorrecto.' })
  }

  // Cuenta creada solo con Google: no tiene contraseña local. Se guía al usuario
  // al método correcto en lugar de dar un "credenciales inválidas" confuso.
  if (!user.password_hash) {
    recordLoginFailure(rateLimitKey)
    throw createError({ statusCode: 401, statusMessage: 'Credenciales invalidas o metodo de acceso incorrecto.' })
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    recordLoginFailure(rateLimitKey)
    throw createError({ statusCode: 401, statusMessage: 'Credenciales invalidas o metodo de acceso incorrecto.' })
  }

  clearLoginFailures(rateLimitKey)
  const oauthLinked = await completePendingOAuthLink(event, user.id)

  const token = createSessionToken()
  const maxAge = (body.remember ? SESSION_DAYS.remembered : SESSION_DAYS.normal) * 24 * 60 * 60
  const expiresAt = new Date(Date.now() + maxAge * 1000)

  await pool.query(
    `
      insert into sesion (usuario_id, tienda_id, token_hash, user_agent, ip, expires_at)
      values (
        $1,
        (select tienda_id from tienda_usuario where usuario_id = $1 and estado = 'activo' order by created_at asc limit 1),
        $2,
        $3,
        $4,
        $5
      )
    `,
    [
      user.id,
      hashSessionToken(token),
      getRequestHeader(event, 'user-agent') ?? null,
      getRequestHeader(event, 'x-forwarded-for') ?? event.node.req.socket.remoteAddress ?? null,
      expiresAt,
    ],
  )

  await pool.query('update usuario set ultimo_acceso_at = now(), updated_at = now() where id = $1', [user.id])

  setCookie(event, 'nexa_session_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
    maxAge,
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    oauthLinked,
  }
})
