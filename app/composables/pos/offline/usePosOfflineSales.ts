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

type PosRequestError = {
  status?: number
  statusCode?: number
  response?: { status?: number }
  data?: { statusCode?: number; statusMessage?: string; message?: string }
  statusMessage?: string
  message?: string
}

export type PosOfflineSyncResult = {
  total: number
  synced: number
  failures: Array<{ id: string; message: string; status: number | null }>
}

export function posRequestErrorStatus(error: unknown) {
  const requestError = error as PosRequestError
  const status = requestError.statusCode
    ?? requestError.status
    ?? requestError.response?.status
    ?? requestError.data?.statusCode

  return typeof status === 'number' ? status : null
}

export function posRequestErrorMessage(error: unknown, fallback: string) {
  const requestError = error as PosRequestError

  return requestError.data?.statusMessage
    || requestError.data?.message
    || requestError.statusMessage
    || requestError.message
    || fallback
}

export function shouldQueuePosSale(error: unknown) {
  const status = posRequestErrorStatus(error)
  return status === null || status === 0 || status === 408 || status === 429 || status >= 500
}

function shouldStopSync(error: unknown) {
  const status = posRequestErrorStatus(error)
  return shouldQueuePosSale(error) || status === 401 || status === 403
}

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
    const result: PosOfflineSyncResult = {
      total: sales.length,
      synced: 0,
      failures: [],
    }

    for (const sale of sales) {
      try {
        await queue.markSyncing(sale)
        await sendSale(sale.payload)
        await queue.remove(sale.id)
        result.synced += 1
      } catch (error) {
        const message = posRequestErrorMessage(error, 'No se pudo sincronizar la venta.')
        await queue.markError(sale, message)
        result.failures.push({ id: sale.id, message, status: posRequestErrorStatus(error) })

        // Un conflicto de una venta no debe bloquear las demas. En cambio, si
        // el servidor no responde o la sesion ya no sirve, evitamos reintentar
        // toda la cola contra el mismo error global.
        if (shouldStopSync(error)) {
          break
        }
      }
    }

    return result
  }

  return {
    createOperationId,
    queueCreate,
    pendingCount,
    sync,
  }
}
