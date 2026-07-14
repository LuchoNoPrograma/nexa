import { createError, readBody } from 'h3'
import { completeOAuthPasswordSetup } from '../../utils/oauth'
import { hashPassword } from '../../utils/password'
import { assertRateLimit } from '../../utils/rateLimit'
import { requireSession } from '../../utils/session'

type PasswordBody = {
  password?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readBody<PasswordBody>(event)
  const password = body.password ?? ''

  if (password.length < 10 || password.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'La contrasena debe tener entre 10 y 128 caracteres.' })
  }

  await assertRateLimit(event, {
    namespace: 'configurar-password',
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    keyParts: [session.id],
    message: 'Demasiados intentos. Intenta nuevamente mas tarde.',
  })

  const passwordHash = await hashPassword(password)
  await completeOAuthPasswordSetup(event, session.id, passwordHash)

  return { configured: true }
})
