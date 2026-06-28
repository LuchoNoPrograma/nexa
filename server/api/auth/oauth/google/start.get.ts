import process from 'node:process'
import { generateCodeVerifier, generateState } from 'arctic'
import { sendRedirect, setCookie } from 'h3'
import { getGoogleClient } from '../../../../utils/oauth'

// Paso 1 del flujo Authorization Code + PKCE: generamos `state` (anti-CSRF) y
// `codeVerifier` (PKCE), los guardamos en cookies cortas y redirigimos a Google.
export default defineEventHandler((event) => {
  const google = getGoogleClient(event)
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])

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

  return sendRedirect(event, url.toString())
})
