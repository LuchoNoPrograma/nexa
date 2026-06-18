export type OfflineMeta = {
  key: string
  value: unknown
}

const DB_NAME = 'nexa-pos-offline'
const DB_VERSION = 2

let dbPromise: Promise<IDBDatabase> | null = null

export function useOfflineDb() {
  function openDb() {
    if (!import.meta.client) {
      return Promise.reject(new Error('IndexedDB solo esta disponible en el navegador.'))
    }

    if (dbPromise) {
      return dbPromise
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = request.result
        const tx = request.transaction
        let queueStore: IDBObjectStore | null = null

        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' }).createIndex('storeId', 'storeId')
        }

        if (!db.objectStoreNames.contains('queue')) {
          queueStore = db.createObjectStore('queue', { keyPath: 'id' })
          queueStore.createIndex('storeId', 'storeId')
          queueStore.createIndex('type', 'type')
          queueStore.createIndex('status', 'status')
        } else if (tx) {
          queueStore = tx.objectStore('queue')
        }

        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }

        if (event.oldVersion < 2 && tx && queueStore && db.objectStoreNames.contains('sales')) {
          const cursorRequest = tx.objectStore('sales').openCursor()
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result
            if (!cursor) {
              return
            }

            const sale = cursor.value
            queueStore?.put({
              ...sale,
              type: 'pos.sale.create',
            })
            cursor.continue()
          }
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'))
    })

    return dbPromise
  }

  function requestToPromise<T>(request: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Operacion local fallida.'))
    })
  }

  function transactionDone(tx: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Transaccion local fallida.'))
      tx.onabort = () => reject(tx.error ?? new Error('Transaccion local cancelada.'))
    })
  }

  async function readAllFromIndex<T>(storeName: string, indexName: string, value: string) {
    const db = await openDb()
    const tx = db.transaction(storeName, 'readonly')
    const rows = await requestToPromise<T[]>(tx.objectStore(storeName).index(indexName).getAll(value))
    await transactionDone(tx)
    return rows
  }

  async function putMeta(key: string, value: unknown) {
    const db = await openDb()
    const tx = db.transaction('meta', 'readwrite')
    tx.objectStore('meta').put({ key, value } satisfies OfflineMeta)
    await transactionDone(tx)
  }

  async function getMeta<T>(key: string) {
    const db = await openDb()
    const tx = db.transaction('meta', 'readonly')
    const row = await requestToPromise<OfflineMeta | undefined>(tx.objectStore('meta').get(key))
    await transactionDone(tx)
    return row?.value as T | undefined
  }

  return {
    openDb,
    requestToPromise,
    transactionDone,
    readAllFromIndex,
    putMeta,
    getMeta,
  }
}
