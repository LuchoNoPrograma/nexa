import type { PosSession } from '~/stores/session'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/pos')) {
    return
  }

  const sessionStore = useSessionStore()

  try {
    if (!sessionStore.session) {
      if (import.meta.server) {
        const requestFetch = useRequestFetch()
        const response = await requestFetch<{ user: PosSession }>('/api/auth/session')
        sessionStore.setSession(response.user)
      }
      else {
        await sessionStore.load()
      }
    }

    const session = sessionStore.session
    if (to.path.startsWith('/pos/admin')) {
      return session?.role === 'super_admin'
        ? undefined
        : navigateTo('/pos/inicio')
    }

    if (
      session?.storeId
      && session.onboardingDiagnostico !== 'completado'
      && to.path !== '/pos/diagnostico'
    ) {
      return navigateTo('/pos/diagnostico')
    }
  }
  catch {
    return navigateTo('/login')
  }
})
