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
  name: string
  quantity: number
  price: number
}

type RegisterSaleInput = {
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
  countedCash: number | null
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
  const cashStatus = useState<PosCashStatus>('nexa-pos-cash-status', () => 'abierta')
  const movements = useState<PosCashMovement[]>('nexa-pos-cash-movements', () => [])
  const productSales = useState<PosCashProductSale[]>('nexa-pos-cash-product-sales', () => [])
  const cashSession = useState<CashSessionPayload | null>('nexa-pos-cash-session', () => ({
    status: 'abierta',
    openingFloat: 200,
    countedCash: null,
    openedAt: '08:00',
    closedAt: null,
    openedBy: 'Responsable de caja',
    notes: null,
  }))
  const isLoading = useState('nexa-pos-cash-loading', () => false)

  function applyOverview(overview: CashOverviewPayload) {
    cashSession.value = overview.session
    cashStatus.value = overview.session?.status ?? 'cerrada'
    movements.value = overview.movements
    productSales.value = overview.productSales
  }

  async function loadCashData() {
    isLoading.value = true

    try {
      applyOverview(await $fetch<CashOverviewPayload>('/api/pos/cash'))
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
