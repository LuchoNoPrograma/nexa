import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type PosSession = {
  id: string
  email: string | null
  name: string
  role: string
  store: string
  storeId: string | null
  defaultMargin: number | null
  onboardingDiagnostico: 'pendiente' | 'completado' | 'omitido' | null
  tipoNegocio: 'produccion' | 'comercial' | 'servicios' | null
  perfilNegocioConfirmado: boolean
  hasPassword: boolean
  hasGoogle: boolean
  roles: string[]
  permisos: string[]
}

export const useSessionStore = defineStore('session', () => {
  const session = ref<PosSession | null>(null)
  const loading = ref(false)
  const loadedAt = ref(0)
  let pendingRequest: Promise<PosSession | null> | null = null
  let version = 0

  const isAuthenticated = computed(() => Boolean(session.value))
  const storeId = computed(() => session.value?.storeId ?? null)

  async function load(options: { force?: boolean } = {}) {
    if (!options.force && session.value) {
      return session.value
    }

    if (!options.force && pendingRequest) {
      return pendingRequest
    }

    loading.value = true
    const requestVersion = options.force ? ++version : version
    pendingRequest = $fetch<{ user: PosSession }>('/api/auth/session')
      .then((response) => {
        if (requestVersion !== version) {
          return session.value
        }

        session.value = response.user
        loadedAt.value = Date.now()
        return response.user
      })
      .catch((error) => {
        if (requestVersion === version) {
          session.value = null
        }
        throw error
      })
      .finally(() => {
        if (requestVersion === version) {
          loading.value = false
          pendingRequest = null
        }
      })

    return pendingRequest
  }

  function setSession(value: PosSession | null) {
    version += 1
    session.value = value
    loadedAt.value = value ? Date.now() : 0
    pendingRequest = null
    loading.value = false
  }

  function clear() {
    setSession(null)
  }

  return {
    session,
    loading,
    loadedAt,
    isAuthenticated,
    storeId,
    load,
    setSession,
    clear,
  }
})
