import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type PosSession = {
  id: string
  email: string
  name: string
  role: string
  store: string
  storeId: string | null
  defaultMargin: number | null
  onboardingDiagnostico: 'pendiente' | 'completado' | 'omitido' | null
  tipoNegocio: 'produccion' | 'comercial' | 'servicios' | null
  roles: string[]
  permisos: string[]
}

export const useSessionStore = defineStore('session', () => {
  const session = ref<PosSession | null>(null)
  const loading = ref(false)
  const loadedAt = ref(0)
  let pendingRequest: Promise<PosSession | null> | null = null

  const isAuthenticated = computed(() => Boolean(session.value))
  const storeId = computed(() => session.value?.storeId ?? null)

  async function load(options: { force?: boolean } = {}) {
    if (!options.force && session.value) {
      return session.value
    }

    if (pendingRequest) {
      return pendingRequest
    }

    loading.value = true
    pendingRequest = $fetch<{ user: PosSession }>('/api/auth/session')
      .then((response) => {
        session.value = response.user
        loadedAt.value = Date.now()
        return response.user
      })
      .catch((error) => {
        session.value = null
        throw error
      })
      .finally(() => {
        loading.value = false
        pendingRequest = null
      })

    return pendingRequest
  }

  function setSession(value: PosSession | null) {
    session.value = value
    loadedAt.value = value ? Date.now() : 0
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
