import { usePosOfflineCash } from '~/composables/pos/offline/usePosOfflineCash'

export type PosCashStatus = 'abierta' | 'cerrada'
export type PosCashMovementType = 'Ingreso' | 'Egreso'
export type PosCashPaymentMethod = 'Efectivo' | 'QR'
export type PosCashMovementSource = 'venta' | 'manual'
export type PosCashMovementStatus = 'por_cerrar' | 'cerrado'

export type PosCashMovement = {
  id: string
  time: string
  concept: string
  type: PosCashMovementType
  method: PosCashPaymentMethod
  amount: number
  source: PosCashMovementSource
  status: PosCashMovementStatus
  note?: string
}

export type PosCashProductSale = {
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

type RegisterSaleInput = {
  clientOperationId?: string
  number: string
  items: PosSaleLine[]
  paymentLines: PosSalePaymentLine[]
  subtotal: number
  discount: number
  total: number
}

type CashSessionPayload = {
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
  saleNumber?: string
}

export function usePosCashRegister() {
  const session = usePosSession()
  const offlineCash = usePosOfflineCash()
  const cashStatus = useState<PosCashStatus>('nexa-pos-cash-status', () => 'cerrada')
  const movements = useState<PosCashMovement[]>('nexa-pos-cash-movements', () => [])
  const productSales = useState<PosCashProductSale[]>('nexa-pos-cash-product-sales', () => [])
  const cashSession = useState<CashSessionPayload | null>('nexa-pos-cash-session', () => null)
  const isLoading = useState('nexa-pos-cash-loading', () => false)

  function applyOverview(overview: CashOverviewPayload) {
    cashSession.value = overview.session
    cashStatus.value = overview.session?.status ?? 'cerrada'
    movements.value = overview.movements
    productSales.value = overview.productSales

    if (session.value?.storeId) {
      void offlineCash.saveStatus(session.value.storeId, cashStatus.value).catch(() => null)
    }
  }

  async function loadCashData() {
    isLoading.value = true

    try {
      applyOverview(await $fetch<CashOverviewPayload>('/api/pos/cash'))
    } catch (error) {
      if (!session.value?.storeId) {
        throw error
      }

      const localStatus = await offlineCash.getStatus(session.value.storeId)
      if (!localStatus) {
        throw error
      }

      cashStatus.value = localStatus
    } finally {
      isLoading.value = false
    }
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

  return {
    cashStatus,
    cashSession,
    movements,
    productSales,
    isLoading,
    loadCashData,
    addManualMovement,
    registerSale,
    closeTurn,
    openTurn,
  }
}
