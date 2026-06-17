import { deleteCookie, getCookie } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { hashSessionToken } from '../../utils/password'

export default defineEventHandler(async (event) => {
  await ensureDatabase()

  const token = getCookie(event, 'nexa_session_token')

  if (token) {
    await pool.query(
      'update sesion set revoked_at = now() where token_hash = $1 and revoked_at is null',
      [hashSessionToken(token)],
    )
  }

  deleteCookie(event, 'nexa_session_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return { ok: true }
})
