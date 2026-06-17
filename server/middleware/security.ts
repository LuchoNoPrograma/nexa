import { createError, getRequestHeader, setResponseHeader } from 'h3'

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function requestOrigin(event: Parameters<typeof getRequestHeader>[0]) {
  const proto = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim()
    || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'host')

  return host ? `${proto}://${host}` : null
}

export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  setResponseHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')

  if (process.env.NODE_ENV === 'production') {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }

  const method = event.node.req.method?.toUpperCase() ?? 'GET'

  if (!event.path.startsWith('/api/') || !unsafeMethods.has(method)) {
    return
  }

  const origin = getRequestHeader(event, 'origin')
  const expectedOrigin = requestOrigin(event)

  if (origin && expectedOrigin && origin !== expectedOrigin) {
    throw createError({ statusCode: 403, statusMessage: 'Origen no permitido.' })
  }
})
