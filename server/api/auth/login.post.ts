import { createError, getRequestHeader, readBody, setCookie } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { assertLoginAllowed, clearLoginFailures, getLoginRateLimitKey, recordLoginFailure } from '../../utils/loginRateLimit'
import { createSessionToken, hashSessionToken, verifyPassword } from '../../utils/password'

type LoginBody = {
  identificador?: string
  email?: string
  password?: string
  remember?: boolean
}

export default defineEventHandler(async (event) => {
  await ensureDatabase()

  const body = await readBody<LoginBody>(event)
  // Se acepta correo o carnet de identidad (CI) como identificador de acceso.
  const identificador = (body.identificador ?? body.email ?? '').trim()
  const password = body.password ?? ''

  if (!identificador || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Correo/CI y contraseña son requeridos.' })
  }

  const rateLimitKey = getLoginRateLimitKey(event, identificador.toLowerCase())
  assertLoginAllowed(rateLimitKey)

  const userResult = await pool.query<{
    id: string
    email: string
    name: string
    password_hash: string
  }>(
    `
      select id, email, nombre as name, password_hash
      from usuario
      where (lower(email) = lower($1) or ci = $1)
        and estado = 'activo'
      limit 1
    `,
    [identificador],
  )

  const user = userResult.rows[0]

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    recordLoginFailure(rateLimitKey)
    throw createError({ statusCode: 401, statusMessage: 'Credenciales invalidas.' })
  }

  clearLoginFailures(rateLimitKey)

  const token = createSessionToken()
  const expiresAt = new Date(Date.now() + (body.remember ? 30 : 1) * 24 * 60 * 60 * 1000)

  await pool.query(
    `
      insert into sesion (usuario_id, token_hash, user_agent, ip, expires_at)
      values ($1, $2, $3, $4, $5)
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
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  }
})
