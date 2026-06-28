import { deleteCookie, getCookie, getQuery, sendRedirect } from 'h3'
import { ensureDatabase } from '../../../../utils/db'
import { getGoogleClient, issueOAuthSession, resolveGoogleUser } from '../../../../utils/oauth'
import type { GoogleProfile } from '../../../../utils/oauth'

type GoogleUserInfo = {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

// Paso 2: Google nos devuelve aqui con `code` + `state`. Validamos el state,
// intercambiamos el code por tokens, leemos el perfil, resolvemos/creamos el
// usuario y emitimos la sesion NEXA (misma cookie de siempre). Cualquier fallo
// redirige a /login con un motivo, nunca rompe.
export default defineEventHandler(async (event) => {
  await ensureDatabase()

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''
  const storedState = getCookie(event, 'google_oauth_state')
  const codeVerifier = getCookie(event, 'google_oauth_verifier')

  // Las cookies del roundtrip ya cumplieron su funcion: se limpian siempre.
  deleteCookie(event, 'google_oauth_state', { path: '/' })
  deleteCookie(event, 'google_oauth_verifier', { path: '/' })

  // El usuario cancelo el consentimiento en Google.
  if (typeof query.error === 'string') {
    return sendRedirect(event, '/login?oauth=cancelado')
  }

  // Validacion anti-CSRF: el state de la URL debe coincidir con el de la cookie.
  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return sendRedirect(event, '/login?oauth=error')
  }

  let profile: GoogleProfile

  try {
    const google = getGoogleClient(event)
    const tokens = await google.validateAuthorizationCode(code, codeVerifier)

    const info = await $fetch<GoogleUserInfo>('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    })

    if (!info?.sub) {
      return sendRedirect(event, '/login?oauth=error')
    }

    profile = {
      sub: info.sub,
      email: info.email ? info.email.trim().toLowerCase() : null,
      emailVerified: info.email_verified === true,
      name: info.name?.trim() || 'Usuario NEXA',
      picture: info.picture ?? null,
    }
  } catch {
    return sendRedirect(event, '/login?oauth=error')
  }

  const userId = await resolveGoogleUser(profile)
  await issueOAuthSession(event, userId)

  return sendRedirect(event, '/pos/inicio')
})
