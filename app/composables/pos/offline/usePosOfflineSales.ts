import { useOfflineQueue } from '~/composables/offline/useOfflineQueue'

export type PosOfflineSalePayload = {
  clientOperationId: string
  number: string
  items: Array<{
    id: string
    name: string
    quantity: number
    price: number
  }>
  paymentLines: Array<{
    label: string
    amount: number
  }>
  subtotal: number
  discount: number
  total: number
}

const SALE_CREATE_TYPE = 'pos.sale.create'

export function usePosOfflineSales() {
  const queue = useOfflineQueue()

  function createOperationId(storeId: string | null | undefined) {
    const storePart = storeId?.slice(0, 8) || 'local'
    const random = Math.random().toString(36).slice(2, 8).toUpperCase()
    return `OFF-${storePart}-${Date.now()}-${random}`
  }

  async function queueCreate(storeId: string, payload: PosOfflineSalePayload) {
    return await queue.add({
      id: payload.clientOperationId,
      storeId,
      type: SALE_CREATE_TYPE,
      payload,
    })
  }

  async function pendingCount(storeId: string) {
    return (await queue.pending<PosOfflineSalePayload>(storeId, SALE_CREATE_TYPE)).length
  }

  async function sync(storeId: string, sendSale: (payload: PosOfflineSalePayload) => Promise<unknown>) {
    const sales = await queue.pending<PosOfflineSalePayload>(storeId, SALE_CREATE_TYPE)

    for (const sale of sales) {
      try {
        await queue.markSyncing(sale)
        await sendSale(sale.payload)
        await queue.remove(sale.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo sincronizar la venta.'
        await queue.markError(sale, message)
        break
      }
    }
  }

  return {
    createOperationId,
    queueCreate,
    pendingCount,
    sync,
  }
}
