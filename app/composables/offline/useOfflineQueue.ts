import { useOfflineDb } from '~/composables/offline/useOfflineDb'

export type OfflineQueueType =
  | 'pos.sale.create'
  | 'inventory.stock.adjust'
  | 'cash.movement.create'
  | 'finance.movement.create'

export type OfflineQueueStatus = 'pendiente' | 'sincronizando' | 'error'

export type OfflineQueueItem<TPayload = unknown> = {
  id: string
  storeId: string
  type: OfflineQueueType
  payload: TPayload
  status: OfflineQueueStatus
  attempts: number
  createdAt: string
  lastError: string | null
}

type QueueInput<TPayload> = {
  id: string
  storeId: string
  type: OfflineQueueType
  payload: TPayload
}

export function useOfflineQueue() {
  const offlineDb = useOfflineDb()

  async function add<TPayload>(input: QueueInput<TPayload>) {
    const item: OfflineQueueItem<TPayload> = {
      ...input,
      status: 'pendiente',
      attempts: 0,
      createdAt: new Date().toISOString(),
      lastError: null,
    }
    const db = await offlineDb.openDb()
    const tx = db.transaction('queue', 'readwrite')
    tx.objectStore('queue').put(item)
    await offlineDb.transactionDone(tx)
    return item
  }

  async function pending<TPayload>(storeId: string, type?: OfflineQueueType) {
    const rows = await offlineDb.readAllFromIndex<OfflineQueueItem<TPayload>>('queue', 'storeId', storeId)
    return rows
      .filter((item) => item.status === 'pendiente' || item.status === 'sincronizando' || item.status === 'error')
      .filter((item) => !type || item.type === type)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async function markSyncing<TPayload>(item: OfflineQueueItem<TPayload>) {
    const db = await offlineDb.openDb()
    const tx = db.transaction('queue', 'readwrite')
    tx.objectStore('queue').put({ ...item, status: 'sincronizando', attempts: item.attempts + 1, lastError: null })
    await offlineDb.transactionDone(tx)
  }

  async function markError<TPayload>(item: OfflineQueueItem<TPayload>, message: string) {
    const db = await offlineDb.openDb()
    const tx = db.transaction('queue', 'readwrite')
    tx.objectStore('queue').put({ ...item, status: 'error', attempts: item.attempts + 1, lastError: message })
    await offlineDb.transactionDone(tx)
  }

  async function remove(id: string) {
    const db = await offlineDb.openDb()
    const tx = db.transaction('queue', 'readwrite')
    tx.objectStore('queue').delete(id)
    await offlineDb.transactionDone(tx)
  }

  return {
    add,
    pending,
    markSyncing,
    markError,
    remove,
  }
}
