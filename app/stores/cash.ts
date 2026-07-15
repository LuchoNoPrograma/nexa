import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePosOfflineCash } from '~/composables/pos/offline/usePosOfflineCash'
import { useSessionStore } from '~/stores/session'

export type PosCashStatus = 'abierta' | 'cerrada'
export type PosCashMovementType = 'Ingreso' | 'Egreso'
export type PosCashPaymentMethod = 'Efectivo' | 'QR'
export type PosCashMovementSource = 'venta' | 'manual'
export type PosCashMovementStatus = 'por_cerrar' | 'cerrado'

export type PosCashMovement = {
  id: string
  saleId?: string
  time: string
  concept: string
  type: PosCashMovementType
  method: PosCashPaymentMethod
  amount: number
  source: PosCashMovementSource
  status: PosCashMovementStatus
  canVoid?: boolean
  note?: string
}

export type PosCashProductSale = {
  productId: string | null
  name: string
  qty: number
  total: number
}

type PosSalePaymentLine = {
  label: string
  amount: number
}

type PosSaleLine = {
  id: string
  name: string
  quantity: number
  price: number
}

export type RegisterSaleInput = {
  clientOperationId?: string
  cashSessionId?: string
  occurredAt?: string
  number: string
  items: PosSaleLine[]
  paymentLines: PosSalePaymentLine[]
  subtotal: number
  discount: number
  total: number
}

type CashSessionPayload = {
  id: string
  status: PosCashStatus
  openingFloat: number
  expectedCash: number
  countedCash: number | null
  difference: number | null
  openedAt: string
  closedAt: string | null
  openedBy: string
  notes: string | null
}

type CashOverviewPayload = {
  session: CashSessionPayload | null
  movements: PosCashMovement[]
  productSales: PosCashProductSale[]
  lastSaleSequence: number
  saleId?: string
  saleNumber?: string
}

const CACHE_MS = 20_000

export const useCashStore = defineStore('cash', () => {
  const sessionStore = useSessionStore()
  const offlineCash = usePosOfflineCash()

  const cashStatus = ref<PosCashStatus>('cerrada')
  const movements = ref<PosCashMovement[]>([])
  const productSales = ref<PosCashProductSale[]>([])
  const cashSession = ref<CashSessionPayload | null>(null)
  const cashSessionId = ref<string | null>(null)
  const lastSaleSequence = ref(0)
  const saleSequenceReady = ref(false)
  const isLoading = ref(false)
  const loadedAt = ref(0)
  let pendingRequest: Promise<void> | null = null
  let version = 0

  function isFresh() {
    return loadedAt.value > 0 && Date.now() - loadedAt.value < CACHE_MS
  }

  function applyOverview(overview: CashOverviewPayload) {
    const previousSessionId = cashSessionId.value
    const nextSessionId = overview.session?.id ?? null
    const serverSequence = Math.max(Math.floor(Number(overview.lastSaleSequence ?? 0)), 0)

    cashSession.value = overview.session
    cashSessionId.value = nextSessionId
    cashStatus.value = overview.session?.status ?? 'cerrada'
    movements.value = overview.movements
    productSales.value = overview.productSales
    lastSaleSequence.value = previousSessionId === nextSessionId
      ? Math.max(lastSaleSequence.value, serverSequence)
      : serverSequence
    saleSequenceReady.value = Boolean(nextSessionId)
    loadedAt.value = Date.now()

    if (sessionStore.session?.storeId) {
      void offlineCash.saveStatus(
        sessionStore.session.storeId,
        cashStatus.value,
        cashSessionId.value,
        lastSaleSequence.value,
      ).catch(() => null)
    }
  }

  async function loadCashData(options: { force?: boolean, background?: boolean } = {}) {
    if (!options.force && isFresh()) {
      return
    }

    if (pendingRequest) {
      return pendingRequest
    }

    if (!options.background || !loadedAt.value) {
      isLoading.value = true
    }

    const requestVersion = version
    pendingRequest = $fetch<CashOverviewPayload>('/api/pos/cash')
      .then((overview) => {
        if (requestVersion !== version) {
          return
        }

        applyOverview(overview)
      })
      .catch(async (error) => {
        if (requestVersion !== version) {
          return
        }

        const storeId = sessionStore.session?.storeId
        if (!storeId) {
          throw error
        }

        const [localStatus, localCashSessionId] = await Promise.all([
          offlineCash.getStatus(storeId),
          offlineCash.getSessionId(storeId),
        ])
        if (!localStatus) {
          throw error
        }

        cashStatus.value = localStatus
        cashSessionId.value = localCashSessionId
        const localSaleSequence = localCashSessionId
          ? await offlineCash.getSaleSequence(storeId, localCashSessionId)
          : null
        lastSaleSequence.value = localSaleSequence ?? 0
        saleSequenceReady.value = localSaleSequence !== null
      })
      .finally(() => {
        if (requestVersion !== version) {
          return
        }

        isLoading.value = false
        pendingRequest = null
      })

    return pendingRequest
  }

  function refreshInBackground() {
    if (!loadedAt.value || isFresh()) {
      return
    }

    void loadCashData({ force: true, background: true }).catch(() => null)
  }

  async function addManualMovement(input: Omit<PosCashMovement, 'id' | 'time' | 'source' | 'status'>) {
    applyOverview(await $fetch<CashOverviewPayload>('/api/pos/cash/movements', {
      method: 'POST',
      body: input,
    }))
  }

  async function registerSale(input: RegisterSaleInput) {
    const overview = await $fetch<CashOverviewPayload>('/api/pos/sales', {
      method: 'POST',
      body: input,
    })

    applyOverview(overview)
    return overview
  }

  async function reserveSaleSequence() {
    const storeId = sessionStore.session?.storeId
    const sessionId = cashSessionId.value

    if (!storeId || !sessionId || !saleSequenceReady.value) {
      return null
    }

    const sequence = await offlineCash.reserveSaleSequence(storeId, sessionId, lastSaleSequence.value)
    lastSaleSequence.value = sequence
    return sequence
  }

  async function voidSale(saleId: string, reason: string) {
    applyOverview(await $fetch<CashOverviewPayload>(`/api/pos/sales/${saleId}/void`, {
      method: 'POST',
      body: { reason },
    }))
  }

  async function voidManualMovement(movementId: string, reason: string) {
    applyOverview(await $fetch<CashOverviewPayload>(`/api/pos/cash/movements/${movementId}/void`, {
      method: 'POST',
      body: { reason },
    }))
  }

  async function closeTurn(countedCash: number, notes?: string) {
    applyOverview(await $fetch<CashOverviewPayload>('/api/pos/cash/close', {
      method: 'POST',
      body: { countedCash, notes },
    }))
  }

  async function openTurn(openingFloat = 200, notes?: string) {
    applyOverview(await $fetch<CashOverviewPayload>('/api/pos/cash/open', {
      method: 'POST',
      body: { openingFloat, notes },
    }))
  }

  function clear() {
    version += 1
    cashStatus.value = 'cerrada'
    movements.value = []
    productSales.value = []
    cashSession.value = null
    cashSessionId.value = null
    lastSaleSequence.value = 0
    saleSequenceReady.value = false
    isLoading.value = false
    loadedAt.value = 0
    pendingRequest = null
  }

  return {
    cashStatus,
    cashSession,
    cashSessionId,
    lastSaleSequence,
    movements,
    productSales,
    isLoading,
    loadedAt,
    loadCashData,
    refreshInBackground,
    addManualMovement,
    registerSale,
    reserveSaleSequence,
    voidSale,
    voidManualMovement,
    closeTurn,
    openTurn,
    clear,
  }
})
