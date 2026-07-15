import { useOfflineDb } from '~/composables/offline/useOfflineDb'

type PosCashStatus = 'abierta' | 'cerrada'

function cashStatusKey(storeId: string) {
  return `${storeId}:cashStatus`
}

function cashSessionIdKey(storeId: string) {
  return `${storeId}:cashSessionId`
}

function saleSequenceKey(storeId: string, sessionId: string) {
  return `${storeId}:${sessionId}:lastSaleSequence`
}

function normalizedSequence(value: unknown) {
  const sequence = Math.floor(Number(value))
  return Number.isFinite(sequence) && sequence > 0 ? sequence : 0
}

export function usePosOfflineCash() {
  const offlineDb = useOfflineDb()

  async function reserveSaleSequence(storeId: string, sessionId: string, minimumSequence: number) {
    const key = saleSequenceKey(storeId, sessionId)
    const db = await offlineDb.openDb()
    // La transacción serializa reservas simultáneas hechas desde varias pestañas.
    const tx = db.transaction('meta', 'readwrite')
    const store = tx.objectStore('meta')
    const current = await offlineDb.requestToPromise<{ key: string, value: unknown } | undefined>(store.get(key))
    const nextSequence = Math.max(normalizedSequence(current?.value), normalizedSequence(minimumSequence)) + 1

    store.put({ key, value: nextSequence })
    await offlineDb.transactionDone(tx)
    return nextSequence
  }

  async function saveStatus(
    storeId: string,
    status: PosCashStatus,
    sessionId: string | null,
    lastSaleSequence = 0,
  ) {
    const db = await offlineDb.openDb()
    const tx = db.transaction('meta', 'readwrite')
    const store = tx.objectStore('meta')

    store.put({ key: cashStatusKey(storeId), value: status })
    store.put({ key: cashSessionIdKey(storeId), value: sessionId })
    if (sessionId) {
      const key = saleSequenceKey(storeId, sessionId)
      const current = await offlineDb.requestToPromise<{ key: string, value: unknown } | undefined>(store.get(key))
      store.put({ key, value: Math.max(normalizedSequence(current?.value), normalizedSequence(lastSaleSequence)) })
    }

    await offlineDb.transactionDone(tx)
  }

  async function getStatus(storeId: string) {
    const status = await offlineDb.getMeta<PosCashStatus>(cashStatusKey(storeId))
    return status === 'abierta' || status === 'cerrada' ? status : null
  }

  async function getSessionId(storeId: string) {
    const sessionId = await offlineDb.getMeta<unknown>(cashSessionIdKey(storeId))
    return typeof sessionId === 'string' && sessionId ? sessionId : null
  }

  async function getSaleSequence(storeId: string, sessionId: string) {
    const sequence = await offlineDb.getMeta(saleSequenceKey(storeId, sessionId))
    return sequence === undefined ? null : normalizedSequence(sequence)
  }

  return {
    saveStatus,
    getStatus,
    getSessionId,
    getSaleSequence,
    reserveSaleSequence,
  }
}
