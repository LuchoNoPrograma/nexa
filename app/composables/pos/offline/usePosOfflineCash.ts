import { useOfflineDb } from '~/composables/offline/useOfflineDb'

type PosCashStatus = 'abierta' | 'cerrada'

function cashStatusKey(storeId: string) {
  return `${storeId}:cashStatus`
}

export function usePosOfflineCash() {
  const offlineDb = useOfflineDb()

  async function saveStatus(storeId: string, status: PosCashStatus) {
    await offlineDb.putMeta(cashStatusKey(storeId), status)
  }

  async function getStatus(storeId: string) {
    const status = await offlineDb.getMeta<PosCashStatus>(cashStatusKey(storeId))
    return status === 'abierta' || status === 'cerrada' ? status : null
  }

  return {
    saveStatus,
    getStatus,
  }
}
