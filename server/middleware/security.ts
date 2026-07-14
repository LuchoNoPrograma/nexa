import { createError, getRequestHeader, setResponseHeader } from 'h3'

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function requestOrigin(event: Parameters<typeof getRequestHeader>[0]) {
  const canonicalOrigin = process.env.NEXA_PUBLIC_URL?.replace(/\/+$/, '')
  if (canonicalOrigin) {
    return canonicalOrigin
  }

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
  // La navegación por voz necesita micrófono en el propio origen. Cámara y
  // geolocalización continúan bloqueadas y ningún iframe externo recibe acceso.
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')
  setResponseHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
  if (process.env.NODE_ENV === 'production') {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    setResponseHeader(event, 'Content-Security-Policy', [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.open-meteo.com",
    ].join('; '))
  }

  const method = event.node.req.method?.toUpperCase() ?? 'GET'

  if (!event.path.startsWith('/api/') || !unsafeMethods.has(method)) {
    return
  }

  const origin = getRequestHeader(event, 'origin')
  const expectedOrigin = requestOrigin(event)

  if (process.env.NODE_ENV === 'production' && (!origin || !expectedOrigin)) {
    throw createError({ statusCode: 403, statusMessage: 'No se pudo verificar el origen de la solicitud.' })
  }

  if (origin && expectedOrigin && origin !== expectedOrigin) {
    throw createError({ statusCode: 403, statusMessage: 'Origen no permitido.' })
  }
})
