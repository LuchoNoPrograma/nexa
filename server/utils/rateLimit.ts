import { createError, getRequestHeader, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'

type RateLimitOptions = {
  namespace: string
  maxRequests: number
  windowMs: number
  keyParts?: Array<string | null | undefined>
  message?: string
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

function clientIp(event: H3Event) {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || event.node.req.socket.remoteAddress
    || 'unknown'
}

export function assertRateLimit(event: H3Event, options: RateLimitOptions) {
  const now = Date.now()
  const key = [
    options.namespace,
    clientIp(event),
    ...(options.keyParts ?? []).filter(Boolean),
  ].join(':')
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return
  }

  if (current.count >= options.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    setResponseHeader(event, 'Retry-After', String(retryAfterSeconds))

    throw createError({
      statusCode: 429,
      statusMessage: options.message ?? 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
      data: {
        retryAfterSeconds,
      },
    })
  }

  current.count += 1
}
