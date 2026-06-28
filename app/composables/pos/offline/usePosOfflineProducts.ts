import { useOfflineDb } from '~/composables/offline/useOfflineDb'

export type PosOfflineProduct = {
  id: string
  name: string
  category: string
  price: number
  stock: number
  kind: 'producto' | 'servicio' | 'combo'
  imageUrl: string | null
}

export function usePosOfflineProducts() {
  const offlineDb = useOfflineDb()

  async function save(storeId: string, products: PosOfflineProduct[]) {
    const db = await offlineDb.openDb()
    const tx = db.transaction('products', 'readwrite')
    const store = tx.objectStore('products')
    const previous = await offlineDb.requestToPromise<Array<PosOfflineProduct & { storeId: string }>>(store.index('storeId').getAll(storeId))

    for (const product of previous) {
      store.delete(product.id)
    }

    for (const product of products) {
      store.put({ ...product, storeId })
    }

    await offlineDb.transactionDone(tx)
  }

  async function list(storeId: string) {
    const rows = await offlineDb.readAllFromIndex<PosOfflineProduct & { storeId: string }>('products', 'storeId', storeId)
    return rows.map(({ storeId: _storeId, ...product }) => product)
  }

  return {
    save,
    list,
  }
}
