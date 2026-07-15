import { useOfflineDb } from '~/composables/offline/useOfflineDb'

type PosCashStatus = 'abierta' | 'cerrada'

function cashStatusKey(storeId: string) {
  return `${storeId}:cashStatus`
}

function cashSessionIdKey(storeId: string) {
  return `${storeId}:cashSessionId`
}

export function usePosOfflineCash() {
  const offlineDb = useOfflineDb()

  async function saveStatus(storeId: string, status: PosCashStatus, sessionId: string | null) {
    await Promise.all([
      offlineDb.putMeta(cashStatusKey(storeId), status),
      offlineDb.putMeta(cashSessionIdKey(storeId), sessionId),
    ])
  }

  async function getStatus(storeId: string) {
    const status = await offlineDb.getMeta<PosCashStatus>(cashStatusKey(storeId))
    return status === 'abierta' || status === 'cerrada' ? status : null
  }

  async function getSessionId(storeId: string) {
    const sessionId = await offlineDb.getMeta<unknown>(cashSessionIdKey(storeId))
    return typeof sessionId === 'string' && sessionId ? sessionId : null
  }

  return {
    saveStatus,
    getStatus,
    getSessionId,
  }
}
