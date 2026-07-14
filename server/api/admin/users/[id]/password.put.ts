import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { hashPassword } from '../../../../utils/password'
import { requireSuperAdmin } from '../../../../utils/session'

type PasswordBody = {
  password?: string
  revokeSessions?: boolean
  reason?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const session = await requireSuperAdmin(event)
  await ensureDatabase()

  const userId = getRouterParam(event, 'id') ?? ''
  if (!UUID_PATTERN.test(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Usuario inválido.' })
  }
  if (userId === session.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Por seguridad, no puedes cambiar tu propia contraseña desde este panel.',
    })
  }

  const body = await readBody<PasswordBody | null>(event)
  const password = typeof body?.password === 'string' ? body.password : ''
  const revokeSessions = body?.revokeSessions !== false
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : ''

  if (password.length < 10 || password.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener entre 10 y 128 caracteres.' })
  }

  const passwordHash = await hashPassword(password)
  const client = await pool.connect()

  try {
    await client.query('begin')

    const targetResult = await client.query<{ name: string, has_google: boolean }>(
      `
        select
          nombre as name,
          (oauth_provider = 'google' and oauth_sub is not null) as has_google
        from usuario
        where id = $1
        for update
      `,
      [userId],
    )
    const target = targetResult.rows[0]
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado.' })
    }

    await client.query(
      'update usuario set password_hash = $1, updated_at = now() where id = $2',
      [passwordHash, userId],
    )

    await client.query(
      `
        update auth_intent
        set consumed_at = coalesce(consumed_at, now())
        where usuario_id = $1
          and tipo = 'set_password'
          and consumed_at is null
      `,
      [userId],
    )

    let sessionsRevoked = 0
    if (revokeSessions) {
      const revokedResult = await client.query(
        `
          update sesion
          set revoked_at = now()
          where usuario_id = $1
            and revoked_at is null
          returning id
        `,
        [userId],
      )
      sessionsRevoked = revokedResult.rowCount ?? 0
    }

    await client.query('commit')

    console.info('Admin password reset', {
      actorUserId: session.id,
      targetUserId: userId,
      targetHasGoogle: target.has_google,
      sessionsRevoked,
      reason: reason || undefined,
    })

    return {
      user: { id: userId, name: target.name, hasPassword: true, hasGoogle: target.has_google },
      sessionsRevoked,
    }
  }
  catch (error) {
    await client.query('rollback')
    throw error
  }
  finally {
    client.release()
  }
})
