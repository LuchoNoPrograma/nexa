import { createHash } from 'node:crypto'
import { createError, getRequestHeader, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'
import { pool } from './db'

type RateLimitOptions = {
  namespace: string
  maxRequests: number
  windowMs: number
  keyParts?: Array<string | null | undefined>
  message?: string
}

function clientIp(event: H3Event) {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || event.node.req.socket.remoteAddress
    || 'unknown'
}

export async function assertRateLimit(event: H3Event, options: RateLimitOptions) {
  const rawKey = [
    options.namespace,
    clientIp(event),
    ...(options.keyParts ?? []).filter(Boolean),
  ].join(':')
  const key = createHash('sha256').update(rawKey).digest('hex')
  const nextReset = new Date(Date.now() + options.windowMs)
  const result = await pool.query<{ count: number, resetAt: Date }>(
    `
      with cleanup as (
        delete from api_rate_limit
        where reset_at < now() - interval '1 day'
      )
      insert into api_rate_limit (key_hash, count, reset_at)
      values ($1, 1, $2)
      on conflict (key_hash) do update
      set
        count = case
          when api_rate_limit.reset_at <= now() then 1
          else api_rate_limit.count + 1
        end,
        reset_at = case
          when api_rate_limit.reset_at <= now() then excluded.reset_at
          else api_rate_limit.reset_at
        end
      returning count, reset_at as "resetAt"
    `,
    [key, nextReset],
  )
  const current = result.rows[0]

  if (current && current.count > options.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(current.resetAt).getTime() - Date.now()) / 1000))
    setResponseHeader(event, 'Retry-After', String(retryAfterSeconds))

    throw createError({
      statusCode: 429,
      statusMessage: options.message ?? 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
      data: {
        retryAfterSeconds,
      },
    })
  }

}
