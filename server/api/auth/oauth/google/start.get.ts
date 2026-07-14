import process from 'node:process'
import { generateCodeVerifier, generateState } from 'arctic'
import { deleteCookie, getQuery, sendRedirect, setCookie } from 'h3'
import { getGoogleClient, prepareCurrentUserGoogleLink } from '../../../../utils/oauth'
import { requireSession } from '../../../../utils/session'

// Paso 1 del flujo Authorization Code + PKCE: generamos `state` (anti-CSRF) y
// `codeVerifier` (PKCE), los guardamos en cookies cortas y redirigimos a Google.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const intent = query.intent === 'set_password'
    ? 'set_password'
    : query.intent === 'link_google'
      ? 'link_google'
      : 'login'

  if (intent !== 'login') {
    const session = await requireSession(event)
    if (intent === 'set_password' && (session.hasPassword || !session.hasGoogle)) {
      return sendRedirect(event, '/pos/inicio?security=error')
    }
    if (intent === 'link_google') {
      if (session.hasGoogle) {
        return sendRedirect(event, '/pos/inicio?security=error')
      }
      await prepareCurrentUserGoogleLink(event, session.id)
    }
  } else {
    deleteCookie(event, 'nexa_oauth_link_token', { path: '/' })
  }

  const google = getGoogleClient(event)
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])
  if (intent !== 'login') {
    url.searchParams.set('prompt', 'select_account')
  }

  // sameSite='lax' es OBLIGATORIO aqui: el navegador vuelve de Google (cross-site)
  // y con 'strict' estas cookies no se enviarian al callback -> el state nunca
  // coincidiria. httpOnly + secure en prod. Vida corta: el roundtrip dura segundos.
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10,
  }

  setCookie(event, 'google_oauth_state', state, cookieOptions)
  setCookie(event, 'google_oauth_verifier', codeVerifier, cookieOptions)
  setCookie(event, 'google_oauth_intent', intent, cookieOptions)

  return sendRedirect(event, url.toString())
})
