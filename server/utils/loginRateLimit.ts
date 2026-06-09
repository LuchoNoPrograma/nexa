import { createError, getRequestHeader } from 'h3'

const maxAttempts = 5
const windowMs = 15 * 60 * 1000
const blockMs = 15 * 60 * 1000

type LoginAttempt = {
  count: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const attempts = new Map<string, LoginAttempt>()

export function getLoginRateLimitKey(event: Parameters<typeof getRequestHeader>[0], email: string) {
  const forwardedFor = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwardedFor || event.node.req.socket.remoteAddress || 'unknown'

  return `${ip}:${email.toLowerCase()}`
}

export function assertLoginAllowed(key: string) {
  const now = Date.now()
  const current = attempts.get(key)

  if (!current) {
    return
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
    })
  }

  if (now - current.firstAttemptAt > windowMs) {
    attempts.delete(key)
  }
}

export function recordLoginFailure(key: string) {
  const now = Date.now()
  const current = attempts.get(key)

  if (!current || now - current.firstAttemptAt > windowMs) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: null,
    })
    return
  }

  const count = current.count + 1

  attempts.set(key, {
    count,
    firstAttemptAt: current.firstAttemptAt,
    blockedUntil: count >= maxAttempts ? now + blockMs : null,
  })
}

export function clearLoginFailures(key: string) {
  attempts.delete(key)
}
