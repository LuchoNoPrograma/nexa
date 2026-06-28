<script setup lang="ts">
import { usePosOfflineSales } from '~/composables/pos/offline/usePosOfflineSales'
import type { PosSaleProduct as Product } from '~/stores/catalog'

type CartLine = Product & {
  quantity: number
}
type CartFlyFeedback = {
  id: number
  name: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

type SaleMode = 'venta' | 'cotizacion'
type PaymentMethod = 'efectivo' | 'qr'
type DiscountMode = 'percent' | 'amount'
type ReceiptPaymentLine = {
  label: string
  amount: number
}
type SaleReceipt = {
  saleId?: string
  voided?: boolean
  number: string
  date: Date
  mode: SaleMode
  seller: string
  items: CartLine[]
  subtotal: number
  discount: number
  discountLabel: string
  total: number
  paymentLines: ReceiptPaymentLine[]
}

const session = usePosSession()
const cashRegister = usePosCashRegister()
const offlineSales = usePosOfflineSales()
const catalogStore = useCatalogStore()
const saleVoidDialog = useSaleVoidDialog()
const {
  saleProducts: products,
  saleProductsLoading: productsLoading,
  offlineNotice,
} = storeToRefs(catalogStore)
const search = ref('')
const discount = ref(0)
const catalogView = ref<'grid' | 'table'>('grid')
const selectedProduct = ref<Product | null>(null)
const productInfoOpen = ref(false)
const checkoutOpen = ref(false)
const receiptOpen = ref(false)
const receiptPdfDownloading = ref(false)
const voidSaleLoading = ref(false)
const discountDialogOpen = ref(false)
const expandedComboIds = ref<Set<string>>(new Set())
const saleMode = ref<SaleMode>('venta')
const paymentMethod = ref<PaymentMethod>('efectivo')
const splitPayment = ref(false)
const secondPaymentMethod = ref<PaymentMethod>('qr')
const primaryPaymentAmount = ref<number | null>(null)
const secondPaymentAmount = ref<number | null>(null)
const includeShipping = ref(false)
const receivedAmount = ref<number | null>(null)
const checkoutScroll = ref<HTMLElement | null>(null)
const cartPanelEl = ref<HTMLElement | null>(null)
const mobileCartBarEl = ref<HTMLElement | null>(null)
const cartOpen = ref(false)
const configuredDiscountSelected = ref(false)
const manualDiscountEnabled = ref(false)
const manualDiscountMode = ref<DiscountMode>('amount')
const manualDiscountValue = ref<number | null>(null)
const appliedDiscountLabel = ref('')
const lastReceipt = ref<SaleReceipt | null>(null)
const cart = ref<CartLine[]>([])
const saleSaveError = ref('')
const pendingSales = ref(0)
const syncingSales = ref(false)
const recentAddedProductId = ref('')
const cartLineFeedback = ref<{ id: number, productId: string, label: string } | null>(null)
const cartPulse = ref(false)
const cartFlyFeedback = ref<CartFlyFeedback | null>(null)
let cartPulseTimer: ReturnType<typeof window.setTimeout> | null = null
let recentAddedTimer: ReturnType<typeof window.setTimeout> | null = null
let cartFlyTimer: ReturnType<typeof window.setTimeout> | null = null
let cartLineFeedbackId = 0
let cartFlyId = 0
const handleOnline = () => {
  void syncPendingSales()
}
const paymentOptions: Array<{ id: PaymentMethod, icon: string, label: string, detail: string }> = [
  { id: 'efectivo', icon: 'pi pi-money-bill', label: 'Efectivo', detail: 'Bolivianos en mano' },
  { id: 'qr', icon: 'pi pi-mobile', label: 'QR / Transferencia', detail: 'Mostrar QR de pago' },
]

// Filtro por categoría (Filtros). '' = todas las categorías.
const categoryFilter = ref<string>('')
const filtersActive = computed(() => categoryFilter.value !== '')

// Categorías disponibles, derivadas de los productos cargados.
const categories = computed(() => {
  const set = new Set<string>()
  for (const product of products.value) {
    if (product.category) {
      set.add(product.category)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const filteredProducts = computed(() => {
  const term = search.value.trim().toLowerCase()

  return products.value.filter((product) => {
    const matchesSearch = !term || product.name.toLowerCase().includes(term)
    const matchesCategory = !categoryFilter.value || product.category === categoryFilter.value
    return matchesSearch && matchesCategory
  })
})

const subtotal = computed(() => cart.value.reduce((sum, line) => sum + line.price * line.quantity, 0))
const total = computed(() => Math.max(subtotal.value - discount.value, 0))
const productCount = computed(() => cart.value.reduce((sum, line) => sum + line.quantity, 0))
const isCashClosed = computed(() => cashRegister.cashStatus.value === 'cerrada')
// En cotización es solo un presupuesto: no requiere caja abierta.
const canCharge = computed(() => {
  if (cart.value.length === 0 || cashRegister.isLoading.value) {
    return false
  }
  return saleMode.value === 'cotizacion' || !isCashClosed.value
})
const chargeButtonLabel = computed(() => {
  if (saleMode.value === 'cotizacion') {
    return `Guardar cotización · Bs ${money(total.value)}`
  }

  if (isCashClosed.value) {
    return 'Abre caja para vender'
  }

  return `Cobrar Bs ${money(total.value)}`
})
const secondPaymentOptions = computed(() => paymentOptions.filter((option) => option.id !== paymentMethod.value))
const splitPaymentTotal = computed(() => Math.max((primaryPaymentAmount.value ?? 0) + (secondPaymentAmount.value ?? 0), 0))
const splitPaymentInvalid = computed(() => splitPayment.value && ((primaryPaymentAmount.value ?? 0) <= 0 || (secondPaymentAmount.value ?? 0) <= 0))
const splitPaymentMismatch = computed(() => splitPayment.value && !splitPaymentInvalid.value && Math.abs(splitPaymentTotal.value - total.value) > 0.009)
const cashPaymentAmount = computed(() => {
  if (!splitPayment.value) {
    return paymentMethod.value === 'efectivo' ? total.value : 0
  }

  if (paymentMethod.value === 'efectivo') {
    return primaryPaymentAmount.value ?? 0
  }

  if (secondPaymentMethod.value === 'efectivo') {
    return secondPaymentAmount.value ?? 0
  }

  return 0
})
const hasCashPayment = computed(() => {
  if (!splitPayment.value) {
    return paymentMethod.value === 'efectivo'
  }

  return paymentMethod.value === 'efectivo' || secondPaymentMethod.value === 'efectivo'
})
const changeAmount = computed(() => Math.max((receivedAmount.value ?? 0) - cashPaymentAmount.value, 0))
const missingCashAmount = computed(() => Math.max(cashPaymentAmount.value - (receivedAmount.value ?? 0), 0))
const cashPaymentInvalid = computed(() => hasCashPayment.value && missingCashAmount.value > 0)
const checkoutInvalid = computed(() => splitPaymentInvalid.value || splitPaymentMismatch.value || cashPaymentInvalid.value)
const canVoidSales = computed(() => session.value?.roles.includes('propietario') ?? false)
const configuredDiscountLine = computed(() => cart.value.find((line) => line.name.toLowerCase().includes('funda para celular')))
const configuredDiscountAmount = computed(() => Math.min((configuredDiscountLine.value?.quantity ?? 0) * 5, subtotal.value))
const discountPreviewAmount = computed(() => {
  if (manualDiscountEnabled.value) {
    const value = Math.max(manualDiscountValue.value ?? 0, 0)
    const amount = manualDiscountMode.value === 'percent' ? subtotal.value * Math.min(value, 100) / 100 : value
    return Math.min(amount, subtotal.value)
  }

  if (configuredDiscountSelected.value) {
    return configuredDiscountAmount.value
  }

  return 0
})
const discountPreviewTotal = computed(() => Math.max(subtotal.value - discountPreviewAmount.value, 0))
onMounted(async () => {
  if (import.meta.client && window.matchMedia('(max-width: 760px)').matches) {
    catalogView.value = 'table'
  }

  await Promise.all([
    loadProducts(),
    cashRegister.loadCashData().catch(() => null),
  ])

  await refreshPendingSales()
  await syncPendingSales()

  if (import.meta.client) {
    window.addEventListener('online', handleOnline)
  }
})

onBeforeUnmount(() => {
  if (cartPulseTimer) {
    window.clearTimeout(cartPulseTimer)
  }

  if (recentAddedTimer) {
    window.clearTimeout(recentAddedTimer)
  }

  if (cartFlyTimer) {
    window.clearTimeout(cartFlyTimer)
  }

  if (import.meta.client) {
    document.body.classList.remove('pos-cart-sheet-open')
    window.removeEventListener('online', handleOnline)
  }
})

// Bloquea el scroll del fondo mientras la hoja del carrito está abierta (solo móvil).
watch(cartOpen, (open) => {
  if (import.meta.client) {
    document.body.classList.toggle('pos-cart-sheet-open', open)
  }
})

watch(splitPayment, (enabled) => {
  if (enabled) {
    resetSplitPayment()
    syncCashReceivedToExpected()
    return
  }

  clearSplitPayment()
  syncCashReceivedToExpected()
})

watch(paymentMethod, () => {
  if (!splitPayment.value) {
    syncCashReceivedToExpected()
    return
  }

  resetSplitPayment()
  syncCashReceivedToExpected()
})

watch(secondPaymentMethod, () => {
  if (splitPayment.value) {
    syncCashReceivedToExpected()
  }
})

function addProduct(product: Product, event?: Event) {
  const line = cart.value.find((current) => current.id === product.id)

  if (line) {
    line.quantity += 1
    showCartFeedback(line, '+1 agregado', event)
    return
  }

  const newLine = { ...product, quantity: 1 }
  cart.value.unshift(newLine)
  showCartFeedback(newLine, 'Nuevo en carrito', event)
}

function decreaseProduct(productId: string) {
  const line = cart.value.find((current) => current.id === productId)

  if (!line) {
    return
  }

  if (line.quantity === 1) {
    return
  }

  line.quantity -= 1
}

function removeProduct(productId: string) {
  cart.value = cart.value.filter((current) => current.id !== productId)
  expandedComboIds.value.delete(productId)
}

function clearSale() {
  cart.value = []
  discount.value = 0
  appliedDiscountLabel.value = ''
  saleMode.value = 'venta'
  resetCheckout()
  cartOpen.value = false
}

function openCart() {
  cartOpen.value = true
}

// Interruptor Venta <-> Cotización. El flujo de cotización ya existe en el panel
// de cobro; aquí damos un acceso claro con aviso para usuarios no técnicos.
async function startQuote() {
  if (saleMode.value === 'cotizacion') {
    saleMode.value = 'venta'
    return
  }

  saleMode.value = 'cotizacion'

  const { default: Swal } = await import('sweetalert2')
  void Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'info',
    title: 'Estás cotizando',
    text: 'No se cobrará. Agrega productos y guarda el presupuesto.',
    showConfirmButton: false,
    timer: 3200,
    timerProgressBar: true,
  })

  if (window.matchMedia('(max-width: 760px)').matches) {
    openCart()
  }
}

// Filtros: popover con las categorías de los productos.
const filtersPop = ref<{ toggle: (e: Event) => void, hide: () => void } | null>(null)

function toggleFilters(event: Event) {
  filtersPop.value?.toggle(event)
}

function pickCategory(category: string) {
  categoryFilter.value = category
  filtersPop.value?.hide()
}

// Scanner por interfaz (lector USB/Bluetooth tipo keyboard-wedge): el lector
// "teclea" el código en el buscador enfocado y manda Enter. Armar el scanner
// solo enfoca el buscador y deja todo listo para escanear en cadena.
const searchInputRef = ref<{ $el?: HTMLInputElement } | null>(null)
const scannerArmed = ref(false)

function armScanner() {
  scannerArmed.value = !scannerArmed.value

  if (scannerArmed.value) {
    search.value = ''
    nextTick(() => searchInputRef.value?.$el?.focus())
  }
}

// Enter en el buscador: con el lector equivale a "fin de código". Agrega el
// único/primer producto coincidente al carrito y limpia para el siguiente.
function onScanEnter() {
  const matches = filteredProducts.value

  if (!matches.length) {
    return
  }

  const product = matches[0]

  if (product) {
    addProduct(product)
    search.value = ''
  }

  if (scannerArmed.value) {
    nextTick(() => searchInputRef.value?.$el?.focus())
  }
}

function closeCart() {
  cartOpen.value = false
}

function chargeSale() {
  if (!canCharge.value) {
    return
  }

  resetCheckout()
  receivedAmount.value = total.value
  checkoutOpen.value = true
  nextTick(() => checkoutScroll.value?.scrollTo({ top: 0 }))
}

async function confirmCharge() {
  if (checkoutInvalid.value) {
    return
  }

  let receipt = buildSaleReceipt()
  saleSaveError.value = ''

  if (receipt.mode === 'venta') {
    const clientOperationId = offlineSales.createOperationId(session.value?.storeId)
    receipt = {
      ...receipt,
      number: clientOperationId,
    }

    try {
      const saleResult = await cashRegister.registerSale({ ...receipt, clientOperationId })
      receipt = {
        ...receipt,
        saleId: saleResult.saleId,
        number: saleResult.saleNumber ?? receipt.number,
      }
      catalogStore.applyLocalStock(receipt.items)
      void catalogStore.saveSaleProductsLocally().catch(() => null)
      void refreshPendingSales()
    } catch {
      const storeId = session.value?.storeId

      if (!storeId) {
        saleSaveError.value = 'No se pudo guardar la venta porque no hay tienda activa.'
        return
      }

      try {
        await offlineSales.queueCreate(storeId, {
          clientOperationId,
          number: receipt.number,
          items: receipt.items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          paymentLines: receipt.paymentLines,
          subtotal: receipt.subtotal,
          discount: receipt.discount,
          total: receipt.total,
        })
      } catch {
        saleSaveError.value = 'No se pudo guardar la venta ni en servidor ni en este dispositivo.'
        return
      }

      catalogStore.applyLocalStock(receipt.items)
      void catalogStore.saveSaleProductsLocally().catch(() => null)
      await refreshPendingSales()
      offlineNotice.value = 'Venta guardada localmente. Se sincronizará cuando vuelva internet.'
    }
  }

  lastReceipt.value = receipt
  checkoutOpen.value = false
  clearSale()
  receiptOpen.value = true
}

// OJO: no reseteamos saleMode aquí. resetCheckout se llama al ABRIR el cobro
// (chargeSale), y borrar el modo cotización justo antes de mostrar el diálogo
// hacía que el tab volviera a "Venta". El modo se reinicia en clearSale (al
// terminar/limpiar la venta).
function resetCheckout() {
  paymentMethod.value = 'efectivo'
  splitPayment.value = false
  clearSplitPayment()
  includeShipping.value = false
  receivedAmount.value = null
}

function resetSplitPayment() {
  secondPaymentMethod.value = secondPaymentOptions.value[0]?.id ?? 'efectivo'
  primaryPaymentAmount.value = total.value
  secondPaymentAmount.value = 0
}

function clearSplitPayment() {
  secondPaymentMethod.value = 'qr'
  primaryPaymentAmount.value = null
  secondPaymentAmount.value = null
}

function syncCashReceivedToExpected() {
  receivedAmount.value = hasCashPayment.value ? cashPaymentAmount.value : null
}

function updatePrimaryPaymentAmount(value: number | null | undefined) {
  const amount = normalizeAmount(value)
  primaryPaymentAmount.value = amount
  secondPaymentAmount.value = Math.max(total.value - amount, 0)
  syncCashReceivedToExpected()
}

function updateSecondPaymentAmount(value: number | null | undefined) {
  const amount = normalizeAmount(value)
  secondPaymentAmount.value = amount
  primaryPaymentAmount.value = Math.max(total.value - amount, 0)
  syncCashReceivedToExpected()
}

function normalizeAmount(value: number | null | undefined) {
  return Math.max(Number(value ?? 0), 0)
}

function buildSaleReceipt(): SaleReceipt {
  return {
    number: `NV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    date: new Date(),
    mode: saleMode.value,
    seller: session.value?.name || 'Responsable de caja',
    items: cart.value.map((line) => ({ ...line })),
    subtotal: subtotal.value,
    discount: discount.value,
    discountLabel: appliedDiscountLabel.value || 'Descuento manual',
    total: total.value,
    paymentLines: buildReceiptPaymentLines(),
  }
}

async function voidLastReceipt() {
  const receipt = lastReceipt.value

  if (!receipt?.saleId || receipt.mode !== 'venta' || receipt.voided || voidSaleLoading.value) {
    return
  }

  const reason = await saleVoidDialog.requestReason()

  if (!reason) {
    return
  }

  voidSaleLoading.value = true
  try {
    await cashRegister.voidSale(receipt.saleId, reason)
    catalogStore.restoreLocalStock(receipt.items)
    void catalogStore.saveSaleProductsLocally().catch(() => null)
    lastReceipt.value = { ...receipt, voided: true }
    await saleVoidDialog.success('Stock y caja fueron actualizados.')
  } catch (error: unknown) {
    const dataError = (error as { data?: { statusMessage?: string } })?.data
    await saleVoidDialog.error(dataError?.statusMessage ?? 'Intenta nuevamente.')
  } finally {
    voidSaleLoading.value = false
  }
}

function buildReceiptPaymentLines(): ReceiptPaymentLine[] {
  if (!splitPayment.value) {
    return [{ label: paymentLabel(paymentMethod.value), amount: total.value }]
  }

  return [
    { label: paymentLabel(paymentMethod.value), amount: primaryPaymentAmount.value ?? 0 },
    { label: paymentLabel(secondPaymentMethod.value), amount: secondPaymentAmount.value ?? 0 },
  ].filter((line) => line.amount > 0)
}

function receiptDate(value: Date) {
  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function receiptPaymentSummary(receipt: SaleReceipt) {
  return receipt.paymentLines.map((line) => line.label.replace(' / Transferencia', '')).join(' + ')
}

function printReceipt() {
  if (!lastReceipt.value) {
    return
  }

  openReceiptWindow(lastReceipt.value, true)
}

async function downloadReceiptPdf() {
  if (!lastReceipt.value || receiptPdfDownloading.value) {
    return
  }

  const receipt = lastReceipt.value
  const filename = `${safeFileName(receipt.mode === 'venta' ? 'nota-venta' : 'cotizacion')}-${safeFileName(receipt.number)}.pdf`

  receiptPdfDownloading.value = true
  const alerta = await notificarCarga({
    titulo: 'Generando PDF',
    texto: 'Preparando el comprobante para descargar...',
  })
  try {
    const response = await fetch('/api/pos/receipt/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        document: buildReceiptPdfDocument(receipt),
      }),
    })

    if (!response.ok) {
      throw new Error('No se pudo generar el PDF.')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    alerta.cerrar()
    await alerta.exito('PDF descargado', 'El comprobante se generó correctamente.')
  } catch {
    alerta.cerrar()
    await alerta.error('No se pudo generar el PDF', 'Intenta nuevamente en unos segundos.')
  } finally {
    receiptPdfDownloading.value = false
  }
}

function buildReceiptPdfDocument(receipt: SaleReceipt) {
  return {
    type: 'sale',
    storeName: storeReceiptName(),
    address: 'Av. Principal #123, Zona Central',
    phone: 'Tel. 70000000',
    docLabel: receipt.mode === 'venta' ? 'Nota de venta' : 'Cotización',
    number: receipt.number,
    dateLabel: receiptDate(receipt.date),
    seller: receipt.seller,
    items: receipt.items.map(line => ({
      name: line.name,
      quantity: line.quantity,
      price: `Bs ${money(line.price)}`,
      total: `Bs ${money(line.price * line.quantity)}`,
      kind: line.kind,
    })),
    subtotal: `Bs ${money(receipt.subtotal)}`,
    discount: receipt.discount > 0
      ? {
          label: receipt.discountLabel,
          amount: `- Bs ${money(receipt.discount)}`,
        }
      : null,
    total: `Bs ${money(receipt.total)}`,
    paymentSummary: receiptPaymentSummary(receipt),
    payments: receipt.paymentLines.map(line => ({
      label: line.label.replace(' / Transferencia', ''),
      amount: `Bs ${money(line.amount)}`,
    })),
    footerNote: 'Este documento no es una factura válida',
    footerStrong: '¡Gracias por su compra!',
  }
}

function openReceiptWindow(receipt: SaleReceipt, autoPrint = false, target = '_blank') {
  const popup = window.open('', target, 'width=420,height=720')

  if (!popup) {
    return
  }

  popup.document.write(buildReceiptHtml(receipt, autoPrint))
  popup.document.close()
}

function buildReceiptHtml(receipt: SaleReceipt, autoPrint = false, screen = true) {
  const styles = buildReceiptTicketStyles({ screen })

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(receipt.number)}</title>
  <style>${styles}</style>
</head>
<body>
  ${buildReceiptTicketMarkup(receipt)}
  ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 120))<\\/script>' : ''}
</body>
</html>`
}

function buildReceiptTicketMarkup(receipt: SaleReceipt) {
  const rows = receipt.items.map((line) => `
    <section class="item">
      <div class="item-main">
        <strong>${escapeHtml(line.name)}</strong>
        <b>Bs ${money(line.price * line.quantity)}</b>
      </div>
      <div class="item-meta">${line.quantity} x Bs ${money(line.price)}</div>
      ${line.kind === 'combo' ? '<ul><li>1x Producto principal del combo</li><li>1x Complemento incluido</li></ul>' : ''}
    </section>
  `).join('')
  const discountRow = receipt.discount > 0
    ? `<div><span>Descuento</span><b>- Bs ${money(receipt.discount)}</b></div><small>${escapeHtml(receipt.discountLabel)}</small>`
    : ''
  const payments = receipt.paymentLines.map((line) => `
    <div><span>${escapeHtml(line.label.replace(' / Transferencia', ''))}</span><b>Bs ${money(line.amount)}</b></div>
  `).join('')

  return `<main class="ticket">
    <header>
      <h1>${escapeHtml(storeReceiptName())}</h1>
      <p>Av. Principal #123, Zona Central</p>
      <p>Tel. 70000000</p>
    </header>
    <section class="doc">
      <span>${receipt.mode === 'venta' ? 'Nota de venta' : 'Cotización'}</span>
      <strong>${escapeHtml(receipt.number)}</strong>
      <small>${receiptDate(receipt.date)}</small>
    </section>
    <section class="meta">
      <div><span>Atendió</span><b>${escapeHtml(receipt.seller)}</b></div>
    </section>
    <div class="section-title">Detalle</div>
    ${rows}
    <div class="section-title">Resumen</div>
    <section class="summary">
      <div><span>Subtotal</span><b>Bs ${money(receipt.subtotal)}</b></div>
      ${discountRow}
    </section>
    <section class="total"><span>Total</span><b>Bs ${money(receipt.total)}</b></section>
    <div class="section-title">Cobro</div>
    <section class="payment">
      <div><span>Método</span><b>${escapeHtml(receiptPaymentSummary(receipt))}</b></div>
      ${payments}
    </section>
    <footer>
      <em>Este documento no es una factura válida</em>
      <strong>¡Gracias por su compra!</strong>
    </footer>
  </main>`
}

function buildReceiptTicketStyles(options: { screen: boolean }) {
  return `
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 10px; }
    .ticket {
      width: 80mm;
      margin: 0 auto;
      padding: 5mm;
      border: 1px solid #111;
      background: #fff;
      color: #000;
      font-family: Arial, sans-serif;
      font-size: 10px;
      line-height: 1.25;
    }
    header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 7px; }
    h1 { margin: 0; font-size: 14px; font-weight: 900; }
    header p { margin: 2px 0 0; font-size: 9px; color: #000; }
    .doc { margin: 8px 0; padding: 6px; border: 1px solid #000; text-align: center; }
    .doc span { display: block; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .doc strong { display: block; margin-top: 2px; font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .doc small { color: #000; }
    .meta { display: grid; gap: 3px; }
    .meta div, .summary div, .payment div, .item-main, .total { display: flex; justify-content: space-between; gap: 8px; }
    .section-title { display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; color: #000; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .section-title:before, .section-title:after { content: ""; height: 1px; flex: 1; background: #000; }
    .item { padding: 5px 0; border-bottom: 1px dashed #000; break-inside: avoid; }
    .item strong, .summary strong, .meta b { font-weight: 900; }
    .item-main strong { min-width: 0; padding-right: 6px; overflow-wrap: anywhere; }
    .item b, .summary b, .payment b, .total b { font: 900 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
    .item-meta, .meta, .payment, small { color: #000; }
    ul { margin: 2px 0 0 8px; padding-left: 8px; color: #000; }
    .summary, .payment { display: grid; gap: 3px; }
    .total { margin-top: 7px; padding-top: 7px; border-top: 2px solid #000; align-items: baseline; font-size: 13px; font-weight: 900; text-transform: uppercase; }
    .total b { font-size: 13px; }
    footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #000; text-align: center; color: #000; font-size: 9px; }
    footer strong { display: block; margin-top: 3px; color: #000; }
    ${options.screen ? '@media screen { body { background: #f3f4f6; padding: 16px; } .ticket { box-shadow: 0 12px 30px rgba(0,0,0,.16); } }' : ''}
  `
}

function safeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-zA-Z0-9-]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase()
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function storeReceiptName() {
  return session.value?.store || 'Mi tienda'
}

function openDiscountDialog() {
  configuredDiscountSelected.value = discount.value > 0 && configuredDiscountAmount.value > 0 && Math.abs(discount.value - configuredDiscountAmount.value) < 0.01
  manualDiscountEnabled.value = discount.value > 0 && !configuredDiscountSelected.value
  manualDiscountMode.value = 'amount'
  manualDiscountValue.value = manualDiscountEnabled.value ? discount.value : null
  discountDialogOpen.value = true
}

function toggleConfiguredDiscount(value: boolean) {
  configuredDiscountSelected.value = value

  if (value) {
    manualDiscountEnabled.value = false
    manualDiscountValue.value = null
  }
}

function toggleManualDiscount(value: boolean) {
  manualDiscountEnabled.value = value

  if (value) {
    configuredDiscountSelected.value = false
    manualDiscountValue.value = manualDiscountValue.value ?? Math.min(100, subtotal.value)
  }
}

function applyDiscount() {
  discount.value = discountPreviewAmount.value
  appliedDiscountLabel.value = discount.value > 0
    ? manualDiscountEnabled.value
      ? 'Descuento manual'
      : 'Bs 5 OFF en Funda para Celular'
    : ''
  discountDialogOpen.value = false
}

function isComboExpanded(productId: string) {
  return expandedComboIds.value.has(productId)
}

function toggleCombo(productId: string) {
  const next = new Set(expandedComboIds.value)

  if (next.has(productId)) {
    next.delete(productId)
  } else {
    next.add(productId)
  }

  expandedComboIds.value = next
}

function openProductInfo(product: Product) {
  selectedProduct.value = product
  productInfoOpen.value = true
}

function handleProductCardKeydown(event: KeyboardEvent, product: Product) {
  if (event.target !== event.currentTarget) {
    return
  }

  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  event.preventDefault()
  addProduct(product, event)
}

function productKindLabel(product: Product) {
  if (product.kind === 'combo') {
    return 'Combo'
  }

  if (product.kind === 'servicio') {
    return 'Servicio'
  }

  return 'Producto'
}

function productModeLabel(product: Product) {
  if (product.kind === 'combo') {
    return 'Venta combinada'
  }

  if (product.kind === 'servicio') {
    return 'Servicio sin inventario'
  }

  return 'Venta unitaria'
}

function paymentLabel(method: PaymentMethod) {
  if (method === 'qr') {
    return 'QR / Transferencia'
  }

  return 'Efectivo'
}

function money(value: number) {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

async function loadProducts() {
  if (catalogStore.hasSaleProducts) {
    catalogStore.refreshSaleProductsInBackground()
    return
  }

  await catalogStore.loadSaleProducts().catch(() => null)
}

async function refreshPendingSales() {
  const storeId = session.value?.storeId
  try {
    pendingSales.value = storeId ? await offlineSales.pendingCount(storeId) : 0
  } catch {
    pendingSales.value = 0
  }
}

async function syncPendingSales() {
  const storeId = session.value?.storeId
  if (!storeId || syncingSales.value) {
    return
  }

  const count = await offlineSales.pendingCount(storeId).catch(() => 0)
  if (!count) {
    pendingSales.value = 0
    return
  }

  syncingSales.value = true
  try {
    await offlineSales.sync(storeId, (payload) => cashRegister.registerSale(payload))
  } finally {
    syncingSales.value = false
    await refreshPendingSales()
  }
}

function showCartFeedback(line: CartLine, label: string, event?: Event) {
  cartLineFeedbackId += 1
  recentAddedProductId.value = line.id
  cartLineFeedback.value = { id: cartLineFeedbackId, productId: line.id, label }
  cartPulse.value = true

  if (recentAddedTimer) {
    window.clearTimeout(recentAddedTimer)
  }

  if (cartPulseTimer) {
    window.clearTimeout(cartPulseTimer)
  }

  recentAddedTimer = window.setTimeout(() => {
    recentAddedProductId.value = ''
    cartLineFeedback.value = null
  }, 1200)

  cartPulseTimer = window.setTimeout(() => {
    cartPulse.value = false
  }, 1200)

  const source = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const isMobile = window.matchMedia('(max-width: 760px)').matches
  const target = isMobile && mobileCartBarEl.value
    ? mobileCartBarEl.value
    : (cartPanelEl.value?.querySelector('.cart-header') ?? cartPanelEl.value)

  if (!source || !(target instanceof HTMLElement) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  if (cartPanelEl.value?.contains(source)) {
    return
  }

  const sourceRect = source.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()

  // El chip mide hasta 178px y se centra con translate(-50%): para que no se
  // salga de la pantalla, acotamos su X al ancho del viewport (con margen).
  const CHIP_HALF = 95
  const MARGIN = 10
  const clampX = (x: number) => Math.min(Math.max(x, CHIP_HALF + MARGIN), window.innerWidth - CHIP_HALF - MARGIN)

  cartFlyId += 1
  cartFlyFeedback.value = {
    id: cartFlyId,
    name: line.name,
    fromX: clampX(sourceRect.left + Math.min(sourceRect.width / 2, 58)),
    fromY: sourceRect.top + Math.min(sourceRect.height / 2, 52),
    toX: clampX(targetRect.left + 34),
    toY: targetRect.top + targetRect.height / 2,
  }

  if (cartFlyTimer) {
    window.clearTimeout(cartFlyTimer)
  }

  cartFlyTimer = window.setTimeout(() => {
    cartFlyFeedback.value = null
  }, 1700)
}

</script>

<template>
  <div class="sale-content">
    <section class="catalog-area">
      <div class="pos-titlebar">
        <div>
          <span>{{ session?.store }}</span>
          <h2>Catálogo Rápido</h2>
        </div>

        <div class="view-switch" aria-label="Vista de catalogo">
          <button
            type="button"
            :class="{ 'is-active': catalogView === 'grid' }"
            aria-label="Vista en cuadrícula"
            @click="catalogView = 'grid'"
          >
            <i class="pi pi-table" aria-hidden="true" />
          </button>
          <button
            type="button"
            :class="{ 'is-active': catalogView === 'table' }"
            aria-label="Vista en tabla"
            @click="catalogView = 'table'"
          >
            <i class="pi pi-list" aria-hidden="true" />
          </button>
        </div>
      </div>

      <header class="pos-toolbar">
        <div class="toolbar-group">
          <span class="toolbar-label">
            <i class="pi pi-layers" aria-hidden="true" />
            Herramientas
          </span>

          <IconField class="toolbar-search">
            <InputIcon class="pi pi-search" />
            <InputText
              ref="searchInputRef"
              v-model="search"
              type="search"
              placeholder="Buscar nombre o escanear"
              autocomplete="off"
              @keyup.enter="onScanEnter"
              @blur="scannerArmed = false"
            />
          </IconField>

          <Button
            type="button"
            class="toolbar-action"
            :class="{ 'is-armed': scannerArmed }"
            icon="pi pi-barcode"
            :label="scannerArmed ? 'Escaneando…' : 'Scanner'"
            outlined
            size="small"
            @click="armScanner"
          />
          <Button
            type="button"
            class="toolbar-action"
            :class="{ 'is-armed': filtersActive }"
            icon="pi pi-filter"
            :label="filtersActive ? categoryFilter : 'Filtros'"
            outlined
            size="small"
            @click="toggleFilters"
          />
        </div>

        <Button
          type="button"
          class="quote-button"
          :class="{ 'is-active': saleMode === 'cotizacion' }"
          icon="pi pi-file-edit"
          :label="saleMode === 'cotizacion' ? 'Cotizando' : 'Cotizar'"
          outlined
          size="small"
          @click="startQuote"
        />
      </header>

      <Popover ref="filtersPop" class="filters-pop">
        <div class="filters-pop__panel">
          <strong class="filters-pop__title">Filtrar por categoría</strong>
          <button
            type="button"
            class="filters-pop__item"
            :class="{ 'is-active': categoryFilter === '' }"
            @click="pickCategory('')"
          >
            <i class="pi pi-th-large" aria-hidden="true" />
            Todas las categorías
          </button>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            class="filters-pop__item"
            :class="{ 'is-active': categoryFilter === category }"
            @click="pickCategory(category)"
          >
            <i class="pi pi-tag" aria-hidden="true" />
            {{ category }}
          </button>
          <p v-if="!categories.length" class="filters-pop__empty">
            Tus productos aún no tienen categorías.
          </p>
        </div>
      </Popover>

      <Message v-if="offlineNotice" severity="warn" size="small" icon="pi pi-wifi">
        {{ offlineNotice }}
      </Message>

      <Message v-if="pendingSales" severity="info" size="small" icon="pi pi-cloud-upload">
        {{ pendingSales }} venta{{ pendingSales === 1 ? '' : 's' }} pendiente{{ pendingSales === 1 ? '' : 's' }} de sincronizar.
        <Button
          type="button"
          text
          size="small"
          icon="pi pi-refresh"
          :label="syncingSales ? 'Sincronizando' : 'Sincronizar'"
          :loading="syncingSales"
          @click="syncPendingSales"
        />
      </Message>

      <div class="catalog-scroll" :class="{ 'is-table': catalogView === 'table' }">
        <!-- Cargando catálogo -->
        <div v-if="productsLoading" class="catalog-empty" role="status" aria-live="polite">
          <span class="catalog-empty__icon"><i class="pi pi-spin pi-spinner" aria-hidden="true" /></span>
          <h3>Cargando tu catálogo…</h3>
          <p>Estamos trayendo tus productos.</p>
        </div>

        <!-- Sin productos en el inventario -->
        <div v-else-if="!products.length" class="catalog-empty">
          <span class="catalog-empty__icon"><i class="pi pi-box" aria-hidden="true" /></span>
          <h3>Aún no tienes productos</h3>
          <p>Agrega productos a tu inventario para empezar a vender desde el catálogo.</p>
          <NuxtLink to="/pos/catalogo" class="catalog-empty__cta">
            <i class="pi pi-plus" aria-hidden="true" />Ir a inventario
          </NuxtLink>
        </div>

        <!-- Búsqueda sin coincidencias -->
        <div v-else-if="!filteredProducts.length" class="catalog-empty">
          <span class="catalog-empty__icon"><i class="pi pi-search" aria-hidden="true" /></span>
          <h3>Sin resultados</h3>
          <p v-if="search.trim()">No encontramos productos para “{{ search }}”. Prueba con otro término.</p>
          <p v-else-if="filtersActive">No hay productos en “{{ categoryFilter }}”.</p>
          <button v-if="filtersActive" type="button" class="catalog-empty__cta" @click="pickCategory('')">
            <i class="pi pi-times" aria-hidden="true" />Quitar filtro
          </button>
        </div>

        <section v-else-if="catalogView === 'grid'" class="product-grid" aria-label="Productos disponibles">
          <article
            v-for="product in filteredProducts"
            :key="product.id"
            role="button"
            tabindex="0"
            class="product-card"
            :class="{ 'is-recently-added': recentAddedProductId === product.id }"
            @click="addProduct(product, $event)"
            @keydown="handleProductCardKeydown($event, product)"
          >
            <button
              type="button"
              class="product-card__info"
              :aria-label="`Ver información de ${product.name}`"
              @click.stop="openProductInfo(product)"
            >
              <i class="pi pi-info-circle" aria-hidden="true" />
            </button>

            <strong>{{ product.name }}</strong>

            <span class="product-card__meta">
              <span class="product-card__icon" :class="{ 'is-combo': product.kind === 'combo' }">
                <img :src="product.imageUrl || '/social-preview-placeholder.jpg'" :alt="product.imageUrl ? product.name : 'Haru, imagen referencial del producto'" loading="lazy" decoding="async" fetchpriority="low">
              </span>
              <span class="product-card__kind">{{ product.kind }}</span>
            </span>

            <span class="product-card__footer">
              <span>Bs <b>{{ money(product.price) }}</b></span>
              <small><i class="pi pi-circle-fill" aria-hidden="true" /> {{ product.stock }}</small>
            </span>
          </article>
        </section>

        <section v-else class="product-table" aria-label="Productos disponibles en tabla">
          <div class="product-table__head" aria-hidden="true">
            <span>Producto</span>
            <span>Precio</span>
            <span>Stock</span>
            <span></span>
          </div>

          <article
            v-for="product in filteredProducts"
            :key="product.id"
            role="button"
            tabindex="0"
            class="product-row"
            :class="{ 'is-recently-added': recentAddedProductId === product.id }"
            @click="addProduct(product, $event)"
            @keydown="handleProductCardKeydown($event, product)"
          >
            <span class="product-row__icon" :class="{ 'is-combo': product.kind === 'combo' }">
              <img :src="product.imageUrl || '/social-preview-placeholder.jpg'" :alt="product.imageUrl ? product.name : 'Haru, imagen referencial del producto'" loading="lazy" decoding="async" fetchpriority="low">
            </span>

            <div class="product-row__info">
              <strong>
                {{ product.name }}
                <span v-if="product.kind === 'combo'" class="product-row__tag is-combo">Combo</span>
              </strong>
              <button type="button" @click.stop="openProductInfo(product)">Ver info</button>
            </div>

            <span class="product-row__price">Bs <b>{{ money(product.price) }}</b></span>
            <span class="product-row__stock">{{ product.stock }}</span>

            <Button
              type="button"
              class="product-row__add"
              icon="pi pi-plus"
              label="Agregar"
              size="small"
              @click.stop="addProduct(product, $event)"
            />
          </article>
        </section>
      </div>

    </section>

    <aside ref="cartPanelEl" class="cart-panel" :class="{ 'is-pulsing': cartPulse, 'is-open': cartOpen, 'is-quote': saleMode === 'cotizacion' }">
      <span class="cart-sheet-handle" aria-hidden="true" />
      <header class="cart-header">
        <div class="flex gap-1 items-center">
          <i :class="saleMode === 'cotizacion' ? 'pi pi-file-edit' : 'pi pi-shopping-cart'" aria-hidden="true" />
          <strong>{{ saleMode === 'cotizacion' ? 'Cotización' : 'Carrito' }}</strong>
          <Badge :value="productCount" :severity="saleMode === 'cotizacion' ? 'warn' : 'success'" />
        </div>
        <button type="button" class="cart-sheet-close" aria-label="Cerrar carrito" @click="closeCart">
          <i class="pi pi-chevron-down" aria-hidden="true" />
        </button>
      </header>

      <section v-if="cart.length" class="cart-lines" aria-label="Productos en carrito">
        <article
          v-for="line in cart"
          :key="line.id"
          class="cart-line"
          :class="{ 'is-combo': line.kind === 'combo', 'is-recently-added': recentAddedProductId === line.id }"
        >
          <div class="cart-line__product">
            <span class="cart-line__thumb">
              <img :src="line.imageUrl || '/social-preview-placeholder.jpg'" :alt="line.imageUrl ? line.name : 'Haru, imagen referencial del producto'" loading="lazy" decoding="async" fetchpriority="low">
            </span>
            <div class="cart-line__product-copy">
              <header class="cart-line__header">
                <strong>{{ line.name }}</strong>
                <span v-if="line.kind === 'combo'" class="cart-line__tag">
                  <i class="pi pi-box" aria-hidden="true" />
                  Combo
                </span>
                <button type="button" :aria-label="`Ver información de ${line.name}`" @click="openProductInfo(line)">
                  <i class="pi pi-info-circle" aria-hidden="true" />
                </button>
              </header>

              <div class="cart-line__info">
                <span>Bs {{ money(line.price) }}</span>
              </div>
            </div>
          </div>

          <div class="cart-line__actions">
            <div class="quantity-feedback">
              <div class="quantity-control">
                <button type="button" :aria-label="`Restar ${line.name}`" @click="decreaseProduct(line.id)">
                  <i class="pi pi-minus" aria-hidden="true" />
                </button>
                <span
                  :key="cartLineFeedback?.productId === line.id ? cartLineFeedback.id : `qty-${line.id}`"
                  :class="{ 'is-updated': cartLineFeedback?.productId === line.id }"
                >
                  # {{ line.quantity }}
                </span>
                <button type="button" :aria-label="`Sumar ${line.name}`" @click="addProduct(line, $event)">
                  <i class="pi pi-plus" aria-hidden="true" />
                </button>
              </div>

              <em
                v-if="cartLineFeedback?.productId === line.id"
                :key="cartLineFeedback.id"
                class="cart-line__feedback"
              >
                <i class="pi pi-check" aria-hidden="true" />
                {{ cartLineFeedback.label }}
              </em>
            </div>

            <strong class="cart-line__subtotal">Bs {{ money(line.price * line.quantity) }}</strong>

            <button type="button" class="cart-line__remove" :aria-label="`Quitar ${line.name}`" @click="removeProduct(line.id)">
              <i class="pi pi-trash" aria-hidden="true" />
            </button>
          </div>

          <div v-if="line.kind === 'combo'" class="cart-line__combo">
            <button type="button" @click="toggleCombo(line.id)">
              <i :class="isComboExpanded(line.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" aria-hidden="true" />
              {{ isComboExpanded(line.id) ? 'Ocultar componentes' : 'Ver componentes' }}
            </button>
            <ul v-if="isComboExpanded(line.id)">
              <li>1x Producto principal del combo</li>
              <li>1x Complemento incluido</li>
            </ul>
          </div>
        </article>
      </section>

      <section v-else class="cart-empty" aria-label="Carrito vacío">
        <i class="pi pi-shopping-cart" aria-hidden="true" />
        <strong>Carrito vacío</strong>
        <span>Agrega productos del catálogo</span>
      </section>

      <footer class="cart-summary">
        <div class="cart-summary__subtotal">
          <span>Subtotal</span>
          <strong>Bs {{ money(subtotal) }}</strong>
        </div>

        <div v-if="discount > 0" class="cart-summary__discount">
          <div>
            <span>Descuentos</span>
            <strong>- Bs {{ money(discount) }}</strong>
          </div>
          <small>{{ appliedDiscountLabel || 'Descuento aplicado' }} <b>- Bs {{ money(discount) }}</b></small>
        </div>

        <button type="button" class="discount-field" @click="openDiscountDialog">
          <i class="pi pi-tag" aria-hidden="true" />
          <span>{{ discount > 0 ? `Descuento Bs ${money(discount)}` : 'Aplicar descuento' }}</span>
        </button>

        <div class="cart-total">
          <span>Total</span>
          <strong>Bs {{ money(total) }}</strong>
        </div>

        <div v-if="discount > 0" class="discount-applied">
          <i class="pi pi-tag" aria-hidden="true" />
          <span>Descuento aplicado (- Bs {{ money(discount) }})</span>
        </div>

        <Message v-if="isCashClosed" severity="warn" size="small" icon="pi pi-lock">
          La caja está cerrada. Abre un turno para cobrar.
        </Message>

        <Button
          type="button"
          class="charge-button"
          :disabled="!canCharge"
          :label="chargeButtonLabel"
          @click="chargeSale"
        />
      </footer>
    </aside>

    <Transition name="cart-scrim">
      <div
        v-if="cartOpen"
        class="cart-sheet-scrim"
        aria-hidden="true"
        @click="closeCart"
      />
    </Transition>

    <button
      ref="mobileCartBarEl"
      type="button"
      class="mobile-cart-bar"
      :class="{ 'is-empty': !cart.length, 'is-quote': saleMode === 'cotizacion' }"
      :aria-label="cart.length ? `Ver carrito, ${productCount} artículos, total Bs ${money(total)}` : 'Carrito vacío'"
      @click="openCart"
    >
      <span class="mobile-cart-bar__icon">
        <i :class="saleMode === 'cotizacion' ? 'pi pi-file-edit' : 'pi pi-shopping-cart'" aria-hidden="true" />
        <span v-if="productCount" class="mobile-cart-bar__count">{{ productCount }}</span>
      </span>
      <span class="mobile-cart-bar__copy">
        <strong>{{ saleMode === 'cotizacion' ? (cart.length ? 'Ver cotización' : 'Cotización') : (cart.length ? 'Ver carrito' : 'Carrito vacío') }}</strong>
        <small>{{ cart.length ? `${productCount} ${productCount === 1 ? 'artículo' : 'artículos'}` : (saleMode === 'cotizacion' ? 'Agrega productos al presupuesto' : 'Agrega productos del catálogo') }}</small>
      </span>
      <span class="mobile-cart-bar__total">
        <small>Total</small>
        <strong>Bs {{ money(total) }}</strong>
      </span>
      <i class="pi pi-chevron-up mobile-cart-bar__chevron" aria-hidden="true" />
    </button>
  </div>

  <Transition name="cart-fly">
    <div
      v-if="cartFlyFeedback"
      :key="cartFlyFeedback.id"
      class="cart-fly-feedback"
      :style="{
        '--from-x': `${cartFlyFeedback.fromX}px`,
        '--from-y': `${cartFlyFeedback.fromY}px`,
        '--to-x': `${cartFlyFeedback.toX}px`,
        '--to-y': `${cartFlyFeedback.toY}px`,
      }"
      aria-hidden="true"
    >
      <span>
        <i class="pi pi-shopping-cart" aria-hidden="true" />
        {{ cartFlyFeedback.name }}
      </span>
    </div>
  </Transition>

  <Dialog
    v-model:visible="discountDialogOpen"
    modal
    dismissable-mask
    :show-header="false"
    class="discount-dialog"
  >
    <section class="discount-panel" aria-label="Aplicar descuento">
      <header class="discount-header">
        <div>
          <i class="pi pi-tag" aria-hidden="true" />
          <h3>Aplicar descuento</h3>
        </div>
        <button type="button" aria-label="Cerrar descuento" @click="discountDialogOpen = false">
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </header>

      <div class="discount-content">
        <section class="discount-block">
          <h4>Descuentos configurados</h4>
          <label class="discount-option" :class="{ 'is-disabled': manualDiscountEnabled || !configuredDiscountLine }">
            <Checkbox
              :model-value="configuredDiscountSelected"
              binary
              :disabled="manualDiscountEnabled || !configuredDiscountLine"
              @update:model-value="toggleConfiguredDiscount"
            />
            <span>
              <strong>Bs 5 OFF en Funda para Celular</strong>
              <small>Bs 5.00 en producto</small>
            </span>
          </label>

          <p v-if="manualDiscountEnabled" class="discount-warning">No se puede combinar con un descuento manual.</p>
        </section>

        <section class="discount-option is-manual" :class="{ 'is-active': manualDiscountEnabled }">
          <Checkbox
            :model-value="manualDiscountEnabled"
            binary
            @update:model-value="toggleManualDiscount"
          />
          <div>
            <strong>Descuento manual (sobre total)</strong>
            <div v-if="manualDiscountEnabled" class="manual-discount">
              <div class="discount-mode-switch">
                <button
                  type="button"
                  :class="{ 'is-active': manualDiscountMode === 'percent' }"
                  @click="manualDiscountMode = 'percent'"
                >
                  <i class="pi pi-percentage" aria-hidden="true" />
                  Porcentaje
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': manualDiscountMode === 'amount' }"
                  @click="manualDiscountMode = 'amount'"
                >
                  <span>Bs</span>
                  Monto fijo
                </button>
              </div>

              <InputNumber
                v-model="manualDiscountValue"
                :min="0"
                :max="manualDiscountMode === 'percent' ? 100 : subtotal"
                :min-fraction-digits="manualDiscountMode === 'amount' ? 2 : 0"
                :max-fraction-digits="manualDiscountMode === 'amount' ? 2 : 0"
                :suffix="manualDiscountMode === 'percent' ? ' %' : undefined"
                :prefix="manualDiscountMode === 'amount' ? 'Bs ' : undefined"
              />
            </div>
          </div>
        </section>

        <section class="discount-summary">
          <div>
            <span>Subtotal</span>
            <strong>Bs {{ money(subtotal) }}</strong>
          </div>
          <div class="is-discount">
            <span>Descuentos</span>
            <strong>- Bs {{ money(discountPreviewAmount) }}</strong>
          </div>
          <div class="is-total">
            <span>Total</span>
            <strong>Bs {{ money(discountPreviewTotal) }}</strong>
          </div>
        </section>
      </div>

      <footer class="discount-footer">
        <Button type="button" label="Cancelar" outlined severity="secondary" @click="discountDialogOpen = false" />
        <Button type="button" label="Aplicar" @click="applyDiscount" />
      </footer>
    </section>
  </Dialog>

  <Dialog
    v-model:visible="checkoutOpen"
    modal
    dismissable-mask
    :show-header="false"
    class="checkout-dialog"
  >
    <section class="checkout-panel" aria-label="Cobro de venta">
      <div ref="checkoutScroll" class="checkout-panel__scroll">
        <header class="checkout-header">
          <div>
            <span>{{ saleMode === 'cotizacion' ? 'Generar cotización' : 'Cobro de venta' }}</span>
            <h3>{{ saleMode === 'cotizacion' ? 'Guardar cotización' : 'Cobrar venta' }}</h3>
          </div>

          <button type="button" aria-label="Cerrar cobro" @click="checkoutOpen = false">
            <i class="pi pi-times" aria-hidden="true" />
          </button>
        </header>

        <div class="sale-mode-switch" aria-label="Tipo de operación">
          <button
            type="button"
            class="sale-mode-card"
            :class="{ 'is-active': saleMode === 'venta' }"
            @click="saleMode = 'venta'"
          >
            <span class="sale-mode-card__icon is-sale">
              <i class="pi pi-shopping-bag" aria-hidden="true" />
            </span>
            <span>
              <strong>Nota de Venta</strong>
              <small>Queda lista para cerrar caja</small>
            </span>
          </button>

          <button
            type="button"
            class="sale-mode-card"
            :class="{ 'is-active': saleMode === 'cotizacion' }"
            @click="saleMode = 'cotizacion'"
          >
            <span class="sale-mode-card__icon is-quote">
              <i class="pi pi-file" aria-hidden="true" />
            </span>
            <span>
              <strong>Cotización</strong>
              <small>Solo presupuesto</small>
            </span>
          </button>
        </div>

        <section class="checkout-total-card">
          <div>
            <span>Total a cobrar</span>
            <div class="checkout-total-card__chips">
              <Badge :value="saleMode === 'venta' ? 'Venta' : 'Cotización'" severity="success" />
            </div>
          </div>
          <strong><span>Bs</span>{{ money(total) }}</strong>
          <section v-if="discount > 0" class="checkout-total-card__breakdown">
            <div>
              <span>Subtotal</span>
              <strong>Bs {{ money(subtotal) }}</strong>
            </div>
            <div class="is-discount">
              <span>Descuentos aplicados</span>
              <strong>- Bs {{ money(discount) }}</strong>
            </div>
            <small>{{ appliedDiscountLabel || 'Descuento manual' }} <b>- Bs {{ money(discount) }}</b></small>
          </section>
        </section>

        <Message v-if="saleMode === 'venta'" severity="info" size="small" icon="pi pi-wallet" class="cash-close-note">
          Esta venta quedará guardada en el turno. En Caja podrás revisar el dinero esperado y cerrar cuando termine la atención.
        </Message>

        <Message v-if="saleSaveError" severity="error" size="small" icon="pi pi-exclamation-triangle">
          {{ saleSaveError }}
        </Message>

        <div class="checkout-grid">
          <section class="checkout-box">
            <header class="checkout-box__title">
              <i class="pi pi-credit-card" aria-hidden="true" />
              <div>
                <strong>Método de pago</strong>
                <span>Elegí cómo paga</span>
              </div>
            </header>

            <div class="payment-options">
              <button
                v-for="method in paymentOptions"
                :key="method.id"
                type="button"
                class="payment-option"
                :class="[`is-${method.id}`, { 'is-active': paymentMethod === method.id }]"
                @click="paymentMethod = method.id"
              >
                <span class="payment-option__icon">
                  <i :class="method.icon" aria-hidden="true" />
                </span>
                <span class="payment-option__copy">
                  <strong>{{ method.label }}</strong>
                  <small>{{ method.detail }}</small>
                </span>
                <span class="payment-option__radio" aria-hidden="true">
                  <span v-if="paymentMethod === method.id" />
                </span>
              </button>
            </div>

            <label class="checkout-toggle">
              <ToggleSwitch v-model="splitPayment" />
              <i class="pi pi-arrow-right-arrow-left" aria-hidden="true" />
              <span>Dividir en dos métodos</span>
            </label>

            <section v-if="splitPayment" class="split-payment-panel">
              <div class="split-payment-panel__title">
                <strong>Segundo método de pago</strong>
                <span>Total requerido: Bs {{ money(total) }}</span>
              </div>

              <div class="second-payment-options" role="group" aria-label="Segundo método de pago">
                <button
                  v-for="method in secondPaymentOptions"
                  :key="method.id"
                  type="button"
                  class="second-payment-option"
                  :class="[`is-${method.id}`, { 'is-active': secondPaymentMethod === method.id }]"
                  @click="secondPaymentMethod = method.id"
                >
                  <i :class="method.icon" aria-hidden="true" />
                  <span>{{ method.id === 'qr' ? 'QR' : method.label }}</span>
                </button>
              </div>

              <div class="split-payment-amounts">
                <label class="split-payment-field">
                  <span>{{ paymentLabel(paymentMethod) }} (Bs)</span>
                  <InputNumber
                    v-model="primaryPaymentAmount"
                    mode="decimal"
                    :min="0"
                    :min-fraction-digits="2"
                    :max-fraction-digits="2"
                    inputmode="decimal"
                    @input="updatePrimaryPaymentAmount($event.value)"
                  />
                </label>

                <label class="split-payment-field">
                  <span>{{ paymentLabel(secondPaymentMethod) }} (Bs)</span>
                  <InputNumber
                    v-model="secondPaymentAmount"
                    mode="decimal"
                    :min="0"
                    :min-fraction-digits="2"
                    :max-fraction-digits="2"
                    inputmode="decimal"
                    @input="updateSecondPaymentAmount($event.value)"
                  />
                </label>
              </div>

              <div v-if="splitPaymentInvalid" class="split-payment-warning">
                <i class="pi pi-exclamation-triangle" aria-hidden="true" />
                <span>Cada método debe tener un monto mayor a 0</span>
              </div>

              <div v-else-if="splitPaymentMismatch" class="split-payment-warning">
                <i class="pi pi-exclamation-triangle" aria-hidden="true" />
                <span>Los montos deben sumar Bs {{ money(total) }}</span>
              </div>
            </section>
          </section>

          <section class="checkout-box">
            <label v-if="hasCashPayment" class="received-field">
              <span>Monto recibido en efectivo</span>
              <InputNumber
                v-model="receivedAmount"
                mode="decimal"
                :min="0"
                :min-fraction-digits="2"
                :max-fraction-digits="2"
                prefix="Bs "
                :placeholder="money(cashPaymentAmount)"
                @input="receivedAmount = $event.value"
              />

              <div v-if="cashPaymentInvalid" class="cash-status is-missing">
                <div>
                  <span>Faltan</span>
                  <strong><small>Bs</small>{{ money(missingCashAmount) }}</strong>
                  <p>El monto recibido es insuficiente</p>
                </div>
                <i class="pi pi-exclamation-triangle" aria-hidden="true" />
              </div>

              <div v-else-if="changeAmount > 0" class="cash-status is-change">
                <div>
                  <span>Vuelto</span>
                  <strong><small>Bs</small>{{ money(changeAmount) }}</strong>
                </div>
                <i class="pi pi-dollar" aria-hidden="true" />
              </div>
            </label>

            <label class="checkout-toggle is-shipping">
              <ToggleSwitch v-model="includeShipping" />
              <i class="pi pi-truck" aria-hidden="true" />
              <span>Incluir envío</span>
            </label>
          </section>
        </div>
      </div>

      <footer class="checkout-footer">
        <Button type="button" label="Cancelar" outlined severity="secondary" @click="checkoutOpen = false" />
        <Button
          type="button"
          :label="saleMode === 'venta' ? 'Cobrar y guardar' : 'Guardar cotización'"
          :disabled="checkoutInvalid"
          @click="confirmCharge"
        />
      </footer>
    </section>
  </Dialog>

  <Dialog
    v-model:visible="receiptOpen"
    modal
    dismissable-mask
    :show-header="false"
    class="receipt-dialog"
  >
    <section v-if="lastReceipt" class="receipt-panel">
      <button type="button" class="receipt-close" aria-label="Cerrar comprobante" title="Cerrar" @click="receiptOpen = false">
        <i class="pi pi-times" aria-hidden="true" />
      </button>

      <aside class="receipt-actions">
        <header class="receipt-actions__header">
          <span>
            <i :class="lastReceipt.voided ? 'pi pi-ban' : 'pi pi-check'" aria-hidden="true" />
            {{ lastReceipt.voided ? 'Venta anulada' : lastReceipt.mode === 'venta' ? 'Venta lista para caja' : 'Cotización guardada' }}
          </span>
        </header>

        <div class="receipt-actions__summary">
          <small>{{ lastReceipt.mode === 'venta' ? 'Nota de venta' : 'Cotización' }}</small>
          <strong>{{ lastReceipt.number }}</strong>
          <b>Bs {{ money(lastReceipt.total) }}</b>
          <time>{{ receiptDate(lastReceipt.date) }}</time>
        </div>

        <div class="receipt-actions__buttons">
          <Button
            type="button"
            label="Descargar PDF"
            icon="pi pi-download"
            :loading="receiptPdfDownloading"
            :disabled="receiptPdfDownloading"
            @click="downloadReceiptPdf"
          />
          <Button type="button" label="Imprimir ticket" icon="pi pi-print" outlined @click="printReceipt" />
          <Button
            v-if="canVoidSales && lastReceipt.mode === 'venta' && lastReceipt.saleId"
            type="button"
            :label="lastReceipt.voided ? 'Venta anulada' : 'Anular venta'"
            icon="pi pi-ban"
            severity="danger"
            outlined
            :loading="voidSaleLoading"
            :disabled="voidSaleLoading || lastReceipt.voided"
            @click="voidLastReceipt"
          />
        </div>
      </aside>

      <article class="thermal-ticket" aria-label="Comprobante de venta">
        <header>
          <h3>{{ storeReceiptName() }}</h3>
          <p>Av. Principal #123, Zona Central</p>
          <p>Tel. 70000000</p>
        </header>

        <section class="thermal-ticket__doc">
          <span>{{ lastReceipt.mode === 'venta' ? 'Nota de venta' : 'Cotización' }}</span>
          <strong>{{ lastReceipt.number }}</strong>
          <small>{{ receiptDate(lastReceipt.date) }}</small>
        </section>

        <section class="thermal-ticket__meta">
          <div>
            <span>Atendió</span>
            <strong>{{ lastReceipt.seller }}</strong>
          </div>
        </section>

        <div class="thermal-ticket__title">Detalle</div>

        <section class="thermal-ticket__items">
          <article v-for="line in lastReceipt.items" :key="line.id" class="thermal-ticket__item">
            <div>
              <strong>{{ line.name }}</strong>
              <b>Bs {{ money(line.price * line.quantity) }}</b>
            </div>
            <small>{{ line.quantity }} x Bs {{ money(line.price) }}</small>
            <ul v-if="line.kind === 'combo'">
              <li>1x Producto principal del combo</li>
              <li>1x Complemento incluido</li>
            </ul>
          </article>
        </section>

        <div class="thermal-ticket__title">Resumen</div>

        <section class="thermal-ticket__summary">
          <div>
            <span>Subtotal</span>
            <strong>Bs {{ money(lastReceipt.subtotal) }}</strong>
          </div>
          <div v-if="lastReceipt.discount > 0" class="is-discount">
            <span>Descuento</span>
            <strong>- Bs {{ money(lastReceipt.discount) }}</strong>
          </div>
          <small v-if="lastReceipt.discount > 0">{{ lastReceipt.discountLabel }}</small>
        </section>

        <section class="thermal-ticket__total">
          <span>Total</span>
          <strong>Bs {{ money(lastReceipt.total) }}</strong>
        </section>

        <div class="thermal-ticket__title">Cobro</div>

        <section class="thermal-ticket__payment">
          <div>
            <span>Método</span>
            <strong>{{ receiptPaymentSummary(lastReceipt) }}</strong>
          </div>
          <div v-for="line in lastReceipt.paymentLines" :key="line.label">
            <span>{{ line.label.replace(' / Transferencia', '') }}</span>
            <strong>Bs {{ money(line.amount) }}</strong>
          </div>
        </section>

        <footer>
          <em>Este documento no es una factura válida</em>
          <strong>¡Gracias por su compra!</strong>
        </footer>
      </article>
    </section>
  </Dialog>

  <Dialog
    v-model:visible="productInfoOpen"
    modal
    dismissable-mask
    :show-header="false"
    class="product-info-dialog"
  >
    <article v-if="selectedProduct" class="product-info">
      <header class="product-info__header">
        <div>
          <span class="product-info__badge">
            <i :class="selectedProduct.kind === 'combo' ? 'pi pi-clone' : 'pi pi-cube'" aria-hidden="true" />
            {{ productKindLabel(selectedProduct) }}
          </span>
          <h3>Ficha del producto</h3>
          <p>Vista rápida del producto y su disponibilidad actual en el POS.</p>
        </div>

        <button type="button" aria-label="Cerrar ficha" @click="productInfoOpen = false">
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </header>

      <section class="product-info__body">
        <div class="product-info__visual" :class="{ 'is-combo': selectedProduct.kind === 'combo' }">
          <img :src="selectedProduct.imageUrl || '/social-preview-placeholder.jpg'" :alt="selectedProduct.imageUrl ? selectedProduct.name : 'Haru, imagen referencial del producto'" decoding="async">
        </div>

        <div class="product-info__main">
          <h4>{{ selectedProduct.name }}</h4>

          <div class="product-info__metrics">
            <div class="metric-card is-price">
              <span>Precio de venta</span>
              <strong>Bs {{ money(selectedProduct.price) }}</strong>
              <small>Precio vigente en el POS</small>
            </div>

            <div class="metric-card is-stock">
              <span>Stock disponible</span>
              <strong>{{ selectedProduct.stock }}</strong>
              <small>Unidades listas para vender.</small>
            </div>

            <div class="metric-card is-mode">
              <span>Modalidad</span>
              <strong>{{ productModeLabel(selectedProduct) }}</strong>
              <small>{{ selectedProduct.kind === 'servicio' ? 'No descuenta inventario físico.' : 'Producto físico de inventario.' }}</small>
            </div>
          </div>
        </div>
      </section>

      <section class="product-info__features">
        <h4>Características</h4>
        <dl>
          <div>
            <dt>Categoría</dt>
            <dd>{{ selectedProduct.category }}</dd>
          </div>
        </dl>
      </section>
    </article>
  </Dialog>
</template>

<style scoped>
.sale-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 34px;
  margin-top: 0;
}

.catalog-area {
  --catalog-sticky-top: 60px;
  display: grid;
  height: calc(100dvh - var(--catalog-sticky-top) - 12px);
  max-height: calc(100dvh - var(--catalog-sticky-top) - 12px);
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  min-width: 0;
}

.pos-toolbar {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 10px;
  border: 1px solid #dde4ec;
  border-radius: 8px;
  background: #ffffff;
}

.toolbar-group {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  overflow-x: auto;
}

.toolbar-label {
  display: inline-flex;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: #ffffff;
  color: #8091a8;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Buscador con IconField de PrimeVue: el InputText lleva la píldora. */
.toolbar-search {
  display: block;
  flex: 0 0 auto;
  width: 200px;
}

.toolbar-search :deep(.p-inputtext) {
  width: 100%;
  height: 34px;
  padding-block: 0;
  border-radius: 999px;
  border-color: #d9e1ea;
  color: #17335c;
  font-size: 0.82rem;
  font-weight: 700;
}

.toolbar-search :deep(.p-inputtext::placeholder) {
  color: #9aa7b8;
  font-weight: 600;
}

.toolbar-search :deep(.p-inputicon) {
  color: #8091a8;
}

.quote-button {
  border-color: #f3c15e !important;
  color: #a65300 !important;
  background: #fffaf0 !important;
}

/* Scanner armado / filtro activo: resaltado verde. */
.toolbar-action.is-armed {
  border-color: var(--primary-500) !important;
  color: #ffffff !important;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-700)) !important;
}

/* Cotizar activo: el botón ámbar se rellena para indicar el modo. */
.quote-button.is-active {
  color: #ffffff !important;
  border-color: #d98b1e !important;
  background: linear-gradient(135deg, #f3a83a, #d97a14) !important;
}

/* Popover de filtros por categoría. */
.filters-pop__panel {
  display: grid;
  gap: 4px;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
}

.filters-pop__title {
  padding: 2px 6px 6px;
  color: #6b778a;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.filters-pop__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #f5f8fb;
  color: #17335c;
  font-size: 0.9rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease;
}

.filters-pop__item:hover {
  background: #eef4fa;
}

.filters-pop__item.is-active {
  color: #ffffff;
  border-color: transparent;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-700));
}

.filters-pop__item i {
  font-size: 0.95rem;
}

.filters-pop__empty {
  margin: 0;
  padding: 8px 6px;
  color: #6b778a;
  font-size: 0.82rem;
}

.pos-titlebar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 0 10px;
}

.pos-titlebar span {
  display: block;
  margin-bottom: 4px;
  color: #6b778a;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pos-titlebar h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 900;
}

.view-switch {
  display: inline-flex;
  padding: 3px;
  border: 1px solid #dce4ec;
  border-radius: 8px;
  background: #ffffff;
}

.view-switch button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  color: #8190a4;
  background: transparent;
  cursor: pointer;
}

.view-switch button.is-active {
  color: #ffffff;
  background: #0b6f38;
}

.view-switch button:focus-visible,
.product-card:focus-visible,
.product-card__info:focus-visible,
.product-row__info button:focus-visible,
.sale-mode-card:focus-visible,
.payment-option:focus-visible,
.checkout-header button:focus-visible,
.product-info__header button:focus-visible,
.cart-line__remove:focus-visible {
  outline: 3px solid rgba(15, 158, 46, 0.25);
  outline-offset: 2px;
}

.catalog-scroll {
  min-height: 0;
  overflow-y: auto;
  padding-right: 3px;
  overscroll-behavior: contain;
}

/* --- Estado vacío / feedback inicial del catálogo --- */
.catalog-empty {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 10px;
  min-height: 280px;
  padding: 40px 24px;
  text-align: center;
}

.catalog-empty__icon {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: #e8f6ec;
  color: #1c7a2c;
  font-size: 1.6rem;
}

.catalog-empty h3 {
  margin: 4px 0 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.15rem;
  font-weight: 900;
  color: #1f2a22;
}

.catalog-empty p {
  margin: 0;
  max-width: 380px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #5c6b60;
  line-height: 1.45;
}

.catalog-empty__cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 9px 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 800;
  box-shadow: 0 8px 16px rgba(3, 24, 9, 0.18);
  transition: filter 0.15s ease;
}

.catalog-empty__cta:hover {
  filter: brightness(1.06);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(170px, 1fr));
  gap: 12px;
  align-content: start;
  padding-bottom: 8px;
}

.product-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 166px;
  gap: 8px;
  padding: 10px 10px 12px;
  border: 1px solid #dde4ec;
  border-radius: 8px;
  background: #ffffff;
  text-align: left;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  cursor: pointer;
}

.product-card:hover {
  border-color: #bcd4e8;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.product-card.is-recently-added {
  animation: product-added-pop 1200ms ease both;
  border-color: var(--primary-400);
  box-shadow: 0 14px 28px rgba(15, 158, 46, 0.18);
}

/* Nombre arriba: ocupa el ancho dejando espacio al botón de info. */
.product-card strong {
  padding-right: 30px;
  color: #071327;
  font-size: 0.82rem;
  font-weight: 900;
  line-height: 1.25;
}

/* Fila de ícono + tipo, debajo del nombre. */
.product-card__meta {
  display: inline-flex;
  min-height: 66px;
  align-items: center;
  gap: 10px;
}

.product-card__icon {
  display: grid;
  width: 66px;
  height: 66px;
  flex: 0 0 auto;
  overflow: hidden;
  place-items: center;
  border: 1px solid #e1e8e4;
  border-radius: 10px;
  color: #ffffff;
  background: linear-gradient(135deg, var(--primary-200), var(--primary-500));
}

.product-card__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 180ms ease;
}

.product-card:hover .product-card__icon img {
  transform: scale(1.035);
}

.product-card__icon.is-combo {
  color: #a65300;
  background: linear-gradient(135deg, #ffe89c, #ffd269);
}

.product-card__kind {
  font-size: 0.58rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b778a;
}

.product-card__info {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid var(--primary-300);
  border-radius: 7px;
  color: var(--primary-600);
  background: var(--primary-50);
  padding: 0;
  cursor: pointer;
}

.product-chip {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  border: 1px solid #f4c65f;
  border-radius: 999px;
  color: #9a4d00;
  background: #fffbeb;
  font-size: 0.62rem;
  font-weight: 800;
}

.product-card__footer {
  display: flex;
  margin-top: auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #536175;
  font-size: 0.72rem;
}

.product-card__footer b {
  color: #071327;
  font-size: 1.05rem;
  font-weight: 900;
}

.product-card__footer small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #009879;
  font-weight: 900;
}

.product-table {
  overflow: visible;
  border: 1px solid #dde4ec;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
}

.product-table__head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #ffffff;
}

.product-table__head,
.product-row {
  display: grid;
  grid-template-columns: 34px minmax(220px, 1fr) 120px 90px 112px;
  align-items: center;
  column-gap: 12px;
}

.product-table__head {
  min-height: 26px;
  padding: 0 10px;
  border-bottom: 1px solid #e7edf4;
  color: #66758d;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.product-table__head span:first-child {
  grid-column: 2;
}

.product-row {
  min-height: 47px;
  padding: 6px 10px;
  border-bottom: 1px solid #edf1f6;
}

.product-row:last-child {
  border-bottom: 0;
}

.product-row:hover {
  background: #f8fbff;
}

.product-row__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 8px;
  color: var(--primary-700);
  background: var(--primary-100);
}

.product-row__icon.is-combo {
  color: #a65300;
  background: #ffe59b;
}

.product-row__icon {
  overflow: hidden;
}

.product-row__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-row__info {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.product-row__info strong {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  color: #071327;
  font-size: 0.84rem;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-row__info button {
  width: max-content;
  border: 0;
  padding: 0;
  color: var(--primary-600);
  background: transparent;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
}

.product-row__tag {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 2px 5px;
  border-radius: 4px;
  color: #a65300;
  background: #fff1b8;
  font-size: 0.5rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.product-row__tag.is-combo {
  background: #ffe3a3;
}

.product-row__price {
  color: #17335c;
  font-size: 0.72rem;
}

.product-row__price b {
  color: #071327;
  font-size: 0.9rem;
  font-weight: 900;
}

.product-row__stock {
  color: #071327;
  font-size: 0.82rem;
  font-weight: 800;
}

.product-row__add {
  min-width: 80px;
  border-radius: 8px !important;
  justify-content: center;
  font-weight: 900 !important;
}

.cart-panel {
  --cart-sticky-top: 60px;
  position: sticky;
  top: var(--cart-sticky-top);
  display: grid;
  height: calc(100dvh - var(--cart-sticky-top) - 12px);
  max-height: calc(100dvh - var(--cart-sticky-top) - 12px);
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 1px solid #e7edf4;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1);
}

.cart-panel.is-pulsing {
  animation: cart-panel-pulse 1200ms ease both;
}

/* Elementos exclusivos de la hoja inferior móvil: ocultos en escritorio. */
.cart-sheet-handle,
.cart-sheet-close,
.mobile-cart-bar,
.cart-sheet-scrim {
  display: none;
}

.cart-header,
.cart-summary__subtotal,
.cart-summary__discount > div,
.cart-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cart-header {
  min-height: 41px;
  margin: 0 14px;
  padding: 0;
  border-bottom: 1px solid #dfe7f0;
}

/* Modo cotización: acento ámbar en el carrito para que se note el cambio. */
.cart-panel.is-quote {
  border-color: #f0c277;
  box-shadow: 0 8px 22px rgba(217, 122, 20, 0.12);
}

.cart-panel.is-quote .cart-header {
  border-bottom-color: #f0d49a;
}

.cart-panel.is-quote .cart-header > div i,
.cart-panel.is-quote .cart-header > div strong {
  color: #b9700f;
}

/* La barra móvil del carrito también vira a ámbar al cotizar. */
.mobile-cart-bar.is-quote:not(.is-empty) {
  background: linear-gradient(135deg, #f3a83a, #d97a14);
  box-shadow: 0 14px 30px rgba(217, 122, 20, 0.34);
}

.mobile-cart-bar.is-quote .mobile-cart-bar__count {
  color: #b9700f;
}

.cart-lines {
  display: grid;
  align-content: start;
  gap: 7px;
  min-height: 0;
  padding: 12px 14px;
  overflow-y: auto;
}

.cart-line {
  position: relative;
  display: grid;
  gap: 9px;
  padding: 9px 10px 8px;
  border: 1px solid #e3e9ef;
  border-radius: 8px;
  background: #ffffff;
  overflow: visible;
}

.cart-line.is-recently-added {
  animation: cart-line-added 1200ms ease both;
  border-color: var(--primary-400);
}

.cart-line.is-combo {
  border-left: 3px solid #f59e0b;
}

.cart-line__product {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: stretch;
  gap: 9px;
}

.cart-line__thumb {
  display: grid;
  width: 42px;
  height: 42px;
  overflow: hidden;
  place-items: center;
  align-self: center;
  border: 1px solid #e3e9ef;
  border-radius: 8px;
  color: var(--primary-600);
  background: #f2f7f4;
}

.cart-line__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cart-line__product-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.cart-line__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 22px;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cart-line__header strong {
  min-width: 0;
  overflow: hidden;
  color: #071327;
  font-size: 0.84rem;
  font-weight: 900;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cart-line__header button {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 0;
  color: #64748b;
  background: transparent;
  cursor: pointer;
}

.cart-line__tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border: 1px solid #fb923c;
  border-radius: 4px;
  color: #c2410c;
  background: #fff7ed;
  font-size: 0.48rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cart-line__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding-bottom: 9px;
  border-bottom: 1px solid #edf1f6;
}

.cart-line__info span {
  flex: 0 0 auto;
  max-width: 100%;
  padding: 4px 9px;
  border: 1px solid #dfe7f0;
  border-radius: 7px;
  color: #071327;
  background: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0;
}

.cart-line__feedback {
  display: inline-flex;
  min-width: 0;
  max-width: 116px;
  height: 24px;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  padding: 0 8px;
  border: 1px solid var(--primary-200);
  border-radius: 999px;
  color: var(--primary-700);
  background: var(--primary-50);
  font-size: 0.62rem;
  font-style: normal;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
  animation: cart-feedback-chip 1200ms ease both;
}

.cart-line__feedback i {
  flex: 0 0 auto;
  font-size: 0.62rem;
}

.cart-line__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 30px;
  align-items: center;
  gap: 10px;
}

.quantity-feedback {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.quantity-control {
  display: inline-grid;
  flex: 0 0 auto;
  grid-template-columns: 28px minmax(34px, auto) 28px;
  align-items: center;
  overflow: hidden;
  border: 1px solid #dce4ec;
  border-radius: 9px;
  background: #ffffff;
}

.quantity-control span {
  display: grid;
  min-width: 34px;
  height: 28px;
  place-items: center;
  color: var(--primary-700);
  background: var(--primary-50);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0;
}

.quantity-control span.is-updated {
  animation: quantity-updated 1200ms ease both;
}

.quantity-control button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.cart-line__subtotal {
  color: #071327;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.86rem;
  font-weight: 900;
  letter-spacing: 0;
  text-align: right;
}

.cart-line__remove {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #fecaca;
  border-radius: 7px;
  color: #ef4444;
  background: #fff1f2;
  cursor: pointer;
}

.cart-line__combo {
  display: grid;
  gap: 2px;
  margin-top: -3px;
  color: #64748b;
  font-size: 0.68rem;
}

.cart-line__combo button {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 4px;
  border: 0;
  padding: 0;
  color: #ea580c;
  background: transparent;
  font-size: 0.68rem;
  cursor: pointer;
}

.cart-line__combo ul {
  display: grid;
  gap: 1px;
  margin: 0;
  padding-left: 11px;
  list-style: none;
}

.cart-line__combo li::before {
  content: "• ";
  color: #64748b;
}

.cart-empty {
  display: grid;
  place-content: center;
  place-items: center;
  gap: 8px;
  color: #9aa4b2;
  text-align: center;
}

.cart-empty i {
  color: #c9d0d9;
  font-size: 2.6rem;
}

.cart-summary {
  position: relative;
  display: grid;
  gap: 9px;
  padding: 10px 14px 16px;
  border-top: 1px solid #e1e7ee;
}

.cart-summary__subtotal {
  padding-bottom: 8px;
  color: #64748b;
  font-size: 0.72rem;
}

.cart-summary__subtotal strong {
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
}

.cart-summary__discount {
  display: grid;
  gap: 3px;
  margin-top: -5px;
  padding-bottom: 8px;
  border-bottom: 1px solid #dfe7f0;
}

.cart-summary__discount > div {
  color: #dc2626;
  font-size: 0.72rem;
  font-weight: 900;
}

.cart-summary__discount strong,
.cart-summary__discount small b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  letter-spacing: 0;
}

.cart-summary__discount small {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #94a3b8;
  font-size: 0.68rem;
  font-weight: 700;
}

.cart-summary__discount small b {
  color: #94a3b8;
  font-weight: 700;
}

.discount-field {
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #e3e9ef;
  border-radius: 8px;
  color: #8a94a3;
  background: #ffffff;
  cursor: pointer;
}

.discount-field span {
  min-width: 0;
  color: #17335c;
  text-align: center;
  font-weight: 800;
}

.cart-total strong {
  color: var(--primary-500);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 1.45rem;
  letter-spacing: 0;
}

.discount-applied {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--primary-500);
  border-radius: 8px;
  color: var(--primary-700);
  background: var(--primary-50);
  font-size: 0.78rem;
  font-weight: 900;
}

.charge-button {
  min-height: 50px;
  border-radius: 8px !important;
  justify-content: center;
  font-weight: 900 !important;
  text-transform: uppercase;
}

:global(.product-info-dialog.p-dialog) {
  width: min(640px, calc(100vw - 32px));
  overflow: hidden;
  border: 0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.28);
}

:global(.checkout-dialog.p-dialog) {
  width: min(860px, calc(100vw - 32px));
  max-height: calc(100dvh - 16px);
  overflow: hidden;
  border: 0;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

:global(.checkout-dialog .p-dialog-content) {
  padding: 0 !important;
  background: #ffffff !important;
}

:global(.discount-dialog.p-dialog) {
  width: min(520px, calc(100vw - 32px));
  overflow: hidden;
  border: 0;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}

:global(.discount-dialog .p-dialog-content) {
  padding: 0 !important;
  background: #ffffff !important;
}

:global(.receipt-dialog.p-dialog) {
  width: min(900px, calc(100vw - 24px));
  overflow: hidden;
  border: 0;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.26);
}

:global(.receipt-dialog .p-dialog-content) {
  padding: 0 !important;
  background: #f4f6f5 !important;
}

:global(.product-info-dialog .p-dialog-content) {
  padding: 0 !important;
  border-radius: 16px;
  background: #ffffff !important;
}

:global(.p-dialog-mask) {
  backdrop-filter: blur(5px);
}

.discount-panel {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.discount-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.discount-header > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.discount-header h3 {
  margin: 0;
  color: #071327;
  font-size: 1rem;
  font-weight: 900;
}

.discount-header i {
  color: #f97316;
  font-size: 1.1rem;
}

.discount-header button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid #fecaca;
  border-radius: 9px;
  color: #dc2626;
  background: #fff1f2;
  cursor: pointer;
}

.discount-header button i {
  color: currentColor;
}

.discount-header button:hover,
.checkout-header button:hover,
.product-info__header button:hover {
  color: #ffffff;
  background: #dc2626;
}

.discount-content {
  display: grid;
  gap: 12px;
}

.discount-block {
  display: grid;
  gap: 10px;
}

.discount-block h4 {
  margin: 0;
  color: #17335c;
  font-size: 0.76rem;
  font-weight: 900;
}

.discount-option {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 10px;
  border: 1px solid #dfe7f0;
  border-radius: 9px;
  background: #ffffff;
}

.discount-option.is-disabled {
  color: #94a3b8;
  background: #f8fafc;
}

.discount-option.is-manual {
  align-items: start;
}

.discount-option.is-manual.is-active {
  background: #fbfdff;
}

.discount-option strong,
.discount-option small {
  display: block;
}

.discount-option strong {
  color: #17335c;
  font-size: 0.82rem;
  font-weight: 900;
}

.discount-option small {
  margin-top: 2px;
  color: #64748b;
  font-size: 0.72rem;
}

.discount-warning {
  margin: -2px 0 0;
  padding: 6px 8px;
  border: 1px solid #fde68a;
  border-radius: 7px;
  color: #b45309;
  background: #fffbeb;
  font-size: 0.72rem;
}

.manual-discount {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.discount-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.discount-mode-switch button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid #d6e0eb;
  border-radius: 8px;
  color: #17335c;
  background: #ffffff;
  font-size: 0.78rem;
  font-weight: 900;
  cursor: pointer;
}

.discount-mode-switch button.is-active {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.manual-discount :deep(.p-inputnumber),
.manual-discount :deep(.p-inputnumber-input) {
  width: 100%;
}

.manual-discount :deep(.p-inputnumber-input) {
  min-height: 38px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-weight: 900;
}

.discount-summary {
  display: grid;
  padding: 10px 12px;
  border: 1px solid #dfe7f0;
  border-radius: 9px;
  background: #f8fafc;
}

.discount-summary div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
  color: #64748b;
  font-size: 0.78rem;
}

.discount-summary strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-weight: 800;
}

.discount-summary .is-discount {
  color: #dc2626;
}

.discount-summary .is-total {
  margin-top: 5px;
  padding-top: 8px;
  border-top: 1px solid #dfe7f0;
  color: var(--primary-600);
  font-size: 0.92rem;
  font-weight: 900;
}

.discount-summary .is-total strong {
  color: var(--primary-600);
  font-size: 0.92rem;
  font-weight: 900;
}

.discount-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.discount-footer :deep(.p-button) {
  min-height: 34px;
  border-radius: 8px;
  font-weight: 900;
}

.receipt-panel {
  position: relative;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  min-height: min(620px, calc(100dvh - 32px));
  background: #f4f6f5;
}

.receipt-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 3;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
  background: #fff1f2;
  box-shadow: 0 8px 18px rgba(220, 38, 38, 0.12);
  cursor: pointer;
}

.receipt-close:hover {
  color: #ffffff;
  background: #dc2626;
}

.receipt-actions {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 18px;
  color: #0c1f12;
  background: #ffffff;
  border-right: 1px solid #d9e2dc;
}

.receipt-actions__header > span {
  display: inline-flex;
  width: max-content;
  max-width: 100%;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border: 1px solid var(--primary-200);
  border-radius: 999px;
  color: var(--primary-700);
  background: var(--primary-50);
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.receipt-actions__summary {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid #d9e2dc;
  border-radius: 12px;
  background: #fbfdfb;
}

.receipt-actions small {
  color: #5a6b5f;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.receipt-actions strong,
.receipt-actions b,
.receipt-actions time {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  letter-spacing: 0;
}

.receipt-actions strong {
  color: #0c1f12;
  font-size: 1.1rem;
}

.receipt-actions b {
  color: var(--primary-700);
  font-size: 2.1rem;
  line-height: 1;
}

.receipt-actions time {
  color: #5a6b5f;
  font-size: 0.78rem;
}

.receipt-actions__buttons {
  display: grid;
  gap: 10px;
}

.receipt-actions :deep(.p-button) {
  width: 100%;
  justify-content: center;
  border-radius: 8px;
  font-weight: 900;
}

.receipt-actions :deep(.p-button-outlined) {
  border-color: #0c1f12;
  color: #0c1f12;
  background: #ffffff;
}

.thermal-ticket {
  width: 80mm;
  min-height: 560px;
  margin: 18px auto;
  padding: 14px 16px;
  border: 1px solid #111111;
  background: #ffffff;
  color: #000000;
  font-size: 10px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.12);
}

.thermal-ticket header {
  padding-bottom: 7px;
  border-bottom: 1px solid #000000;
  text-align: center;
}

.thermal-ticket h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 900;
}

.thermal-ticket p {
  margin: 2px 0 0;
  color: #000000;
  font-size: 9px;
}

.thermal-ticket__doc {
  margin: 8px 0;
  padding: 6px;
  border: 1px solid #000000;
  border-radius: 0;
  background: #ffffff;
  text-align: center;
}

.thermal-ticket__doc span,
.thermal-ticket__title {
  color: #000000;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.thermal-ticket__doc strong {
  display: block;
  margin-top: 2px;
  color: #000000;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}

.thermal-ticket__doc small {
  color: #000000;
}

.thermal-ticket__meta {
  display: grid;
  gap: 3px;
}

.thermal-ticket__meta div,
.thermal-ticket__item > div,
.thermal-ticket__summary div,
.thermal-ticket__total,
.thermal-ticket__payment div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.thermal-ticket__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 4px;
}

.thermal-ticket__title::before,
.thermal-ticket__title::after {
  content: "";
  height: 1px;
  flex: 1;
  background: #000000;
}

.thermal-ticket__item {
  padding: 5px 0;
  border-bottom: 1px dashed #000000;
}

.thermal-ticket__item strong,
.thermal-ticket__meta strong {
  font-weight: 900;
}

.thermal-ticket__item b,
.thermal-ticket__summary strong,
.thermal-ticket__total strong,
.thermal-ticket__payment strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-weight: 900;
  white-space: nowrap;
}

.thermal-ticket__item small,
.thermal-ticket__meta span,
.thermal-ticket__payment span,
.thermal-ticket__summary span,
.thermal-ticket__summary small {
  color: #000000;
}

.thermal-ticket__item ul {
  margin: 2px 0 0 8px;
  padding-left: 8px;
  color: #000000;
}

.thermal-ticket__summary,
.thermal-ticket__payment {
  display: grid;
  gap: 3px;
}

.thermal-ticket__summary .is-discount,
.thermal-ticket__summary .is-discount span {
  color: #000000;
}

.thermal-ticket__total {
  align-items: baseline;
  margin-top: 7px;
  padding-top: 7px;
  border-top: 2px solid #000000;
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
}

.thermal-ticket footer {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #000000;
  color: #000000;
  text-align: center;
}

.thermal-ticket footer strong {
  display: block;
  margin-top: 3px;
  color: #000000;
}

.checkout-panel {
  display: flex;
  max-height: calc(100dvh - 16px);
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 12px;
}

.checkout-panel__scroll {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: 12px;
  overflow-y: auto;
  padding: 2px 2px 4px;
}

.checkout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.checkout-header span {
  display: block;
  color: var(--primary-500);
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.checkout-header h3 {
  margin: 3px 0 0;
  color: #0f172a;
  font-size: 1.15rem;
  font-weight: 900;
}

.checkout-header button {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
  background: #fff1f2;
  cursor: pointer;
}

.sale-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 5px;
  border: 1px solid #e2e8f0;
  border-radius: 15px;
  background: #f8fafc;
}

.sale-mode-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 54px;
  padding: 9px 12px;
  border: 1.5px solid transparent;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.sale-mode-card.is-active {
  border-color: #3b82f6;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.18), 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.sale-mode-card__icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  font-size: 1rem;
}

.sale-mode-card__icon.is-sale {
  color: #ffffff;
  background: #3b82f6;
}

.sale-mode-card__icon.is-quote {
  color: #d97706;
  background: rgba(245, 158, 11, 0.1);
}

.sale-mode-card strong,
.sale-mode-card small {
  display: block;
}

.sale-mode-card strong {
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 900;
  line-height: 1.15;
}

.sale-mode-card.is-active strong {
  color: #1d4ed8;
}

.sale-mode-card small {
  margin-top: 2px;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
}

.checkout-total-card {
  position: relative;
  display: grid;
  min-height: 92px;
  align-content: center;
  gap: 7px;
  overflow: hidden;
  padding: 13px 18px;
  border: 1px solid #a7f3d0;
  border-radius: 18px;
  background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 90%);
}

.checkout-total-card::after {
  content: "";
  position: absolute;
  top: -44px;
  right: -28px;
  width: 122px;
  height: 122px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-500) 7%, transparent);
}

.checkout-total-card > div,
.checkout-total-card > strong {
  position: relative;
  z-index: 1;
}

.checkout-total-card > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.checkout-total-card > div > span {
  color: var(--primary-700);
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.checkout-total-card__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}

.checkout-total-card > strong {
  color: var(--primary-700);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: clamp(1.8rem, 4.7vw, 2.55rem);
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.checkout-total-card > strong span {
  margin-right: 8px;
  font-size: 0.48em;
  font-weight: 800;
  opacity: 0.72;
}

.checkout-total-card__breakdown {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 3px;
  padding-top: 7px;
  border-top: 1px dashed #a7f3d0;
}

.checkout-total-card__breakdown div,
.checkout-total-card__breakdown small {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.checkout-total-card__breakdown span,
.checkout-total-card__breakdown small {
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 700;
}

.checkout-total-card__breakdown strong,
.checkout-total-card__breakdown b {
  color: var(--primary-700);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.72rem;
  font-weight: 900;
}

.checkout-total-card__breakdown .is-discount span,
.checkout-total-card__breakdown .is-discount strong {
  color: var(--primary-700);
}

.checkout-total-card__breakdown small {
  color: #94a3b8;
}

.checkout-total-card__breakdown small b {
  color: #94a3b8;
}

.checkout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.checkout-box {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  border: 1px solid #dbe3ef;
  border-radius: 18px;
  background: #fbfdff;
}

.checkout-box__title {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 58px;
  padding: 11px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #ffffff;
}

.checkout-box__title i {
  color: var(--primary-500);
}

.checkout-box__title strong,
.checkout-box__title span {
  display: block;
}

.checkout-box__title strong {
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 900;
  line-height: 1.1;
}

.checkout-box__title span {
  margin-top: 2px;
  color: #64748b;
  font-size: 0.72rem;
}

.payment-options {
  display: grid;
  gap: 10px;
}

.payment-option {
  --payment-color: var(--primary-500);
  --payment-strong: var(--primary-700);
  --payment-tint: color-mix(in srgb, var(--payment-color) 10%, transparent);
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 11px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
}

.payment-option.is-qr {
  --payment-color: #3b82f6;
  --payment-strong: #1d4ed8;
  --payment-tint: rgba(59, 130, 246, 0.1);
}

.payment-option.is-active {
  border: 2px solid var(--payment-color);
  background: var(--payment-tint);
  box-shadow: inset 0 0 0 1px var(--payment-color), 0 0 0 3px color-mix(in srgb, var(--payment-color) 10%, transparent);
}

.payment-option__icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  color: var(--payment-color);
  background: var(--payment-tint);
  font-size: 1.25rem;
}

.payment-option.is-active .payment-option__icon {
  color: #ffffff;
  background: var(--payment-color);
}

.payment-option.is-active .payment-option__copy strong {
  color: var(--payment-strong);
}

.payment-option__copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.payment-option__copy strong {
  overflow: hidden;
  color: #0f172a;
  font-size: 0.96rem;
  font-weight: 900;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payment-option__copy small {
  color: #64748b;
  font-size: 0.72rem;
}

.payment-option__radio {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
}

.payment-option.is-active .payment-option__radio {
  border-color: var(--payment-color);
}

.payment-option__radio span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--payment-color);
}

.checkout-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  color: #1e293b;
  background: #f8fafc;
  cursor: pointer;
}

.checkout-toggle i {
  color: #475569;
}

.checkout-toggle span {
  font-size: 0.88rem;
  font-weight: 800;
}

.split-payment-panel {
  display: grid;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid #ddd6fe;
  border-radius: 16px;
  background: #f6f2ff;
}

.split-payment-panel__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.split-payment-panel__title strong {
  color: #1e1b4b;
  font-size: 0.86rem;
  font-weight: 900;
}

.split-payment-panel__title span {
  color: #6d5fb5;
  font-size: 0.7rem;
  font-weight: 800;
  white-space: nowrap;
}

.second-payment-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.second-payment-option {
  --payment-color: var(--primary-500);
  --payment-strong: var(--primary-700);
  --payment-tint: var(--primary-50);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 32px;
  padding: 7px 10px;
  border: 1px solid #d6dce7;
  border-radius: 9px;
  color: #475569;
  background: #ffffff;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.14s ease, color 0.14s ease, background 0.14s ease;
}

.second-payment-option.is-qr {
  --payment-color: #3b82f6;
  --payment-strong: #1d4ed8;
  --payment-tint: rgba(59, 130, 246, 0.1);
}

.second-payment-option.is-active {
  border-color: var(--payment-color);
  color: var(--payment-strong);
  background: var(--payment-tint);
  box-shadow: inset 0 0 0 1px var(--payment-color);
}

.second-payment-option i {
  flex: 0 0 auto;
  font-size: 0.82rem;
}

.second-payment-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split-payment-amounts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.split-payment-field {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.split-payment-field > span {
  overflow: hidden;
  color: #475569;
  font-size: 0.72rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split-payment-field :deep(.p-inputnumber),
.split-payment-field :deep(.p-inputnumber-input) {
  width: 100%;
}

.split-payment-field :deep(.p-inputnumber-input) {
  min-height: 36px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-weight: 900;
}

.split-payment-warning {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 7px 10px;
  border: 1px solid #fecaca;
  border-radius: 9px;
  color: #dc2626;
  background: #fff1f2;
  font-size: 0.76rem;
  font-weight: 900;
}

.split-payment-warning i {
  flex: 0 0 auto;
  font-size: 0.82rem;
}

.received-field {
  display: grid;
  gap: 7px;
  padding: 13px 14px;
  border: 1px solid #a7f3d0;
  border-radius: 16px;
  background: #ecfdf5;
}

.received-field > span {
  color: #475569;
  font-size: 0.74rem;
  font-weight: 800;
}

.received-field :deep(.p-inputnumber),
.received-field :deep(.p-inputnumber-input) {
  width: 100%;
}

.received-field :deep(.p-inputnumber-input) {
  min-height: 42px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-weight: 900;
}

.cash-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 86px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
}

.cash-status > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.cash-status span {
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cash-status strong {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 1.55rem;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.1;
}

.cash-status strong small {
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 800;
}

.cash-status p {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
}

.cash-status > i {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  color: #ffffff;
  font-size: 1.1rem;
}

.cash-status.is-missing {
  border: 1px solid #fca5a5;
  color: #dc2626;
  background: #fff7f7;
}

.cash-status.is-missing > i {
  background: #dc2626;
}

.cash-status.is-change {
  border: 1px solid #bbf7d0;
  color: var(--primary-700);
  background: #ffffff;
}

.cash-status.is-change > i {
  background: var(--primary-500);
}

.checkout-footer {
  display: grid;
  grid-template-columns: minmax(130px, 38%) 1fr;
  gap: 10px;
  flex: 0 0 auto;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
}

.checkout-footer :deep(.p-button) {
  min-height: 46px;
  border-radius: 12px;
  justify-content: center;
  font-weight: 900;
}

.product-info {
  color: #071327;
}

.product-info__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 18px 16px;
  border-bottom: 1px solid #e3e9ef;
  background: #fbfdff;
}

.product-info__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 21px;
  padding: 0 9px;
  border: 1px solid var(--primary-300);
  border-radius: 999px;
  color: var(--primary-700);
  background: var(--primary-50);
  font-size: 0.66rem;
  font-weight: 900;
}

.product-info__header h3,
.product-info__header p,
.product-info__main h4,
.product-info__features h4 {
  margin: 0;
}

.product-info__header h3 {
  margin-top: 8px;
  font-size: 1rem;
  font-weight: 900;
}

.product-info__header p {
  margin-top: 5px;
  color: #66758d;
  font-size: 0.78rem;
}

.product-info__header button {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #fecaca;
  border-radius: 12px;
  color: #dc2626;
  background: #fff1f2;
  cursor: pointer;
}

.product-info__body {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 14px;
  padding: 18px;
}

.product-info__visual {
  display: grid;
  min-height: 132px;
  overflow: hidden;
  place-items: center;
  border: 1px solid var(--primary-100);
  border-radius: 12px;
  color: var(--primary-700);
  background: var(--primary-50);
  font-size: 3rem;
}

.product-info__visual img {
  width: 100%;
  height: 100%;
  min-height: 132px;
  object-fit: cover;
}

.product-info__visual.is-combo {
  color: #a65300;
  background: #fff8e1;
}

.product-info__main {
  min-width: 0;
}

.product-info__main h4 {
  margin-bottom: 12px;
  font-size: 1.25rem;
  font-weight: 900;
  line-height: 1.2;
}

.product-info__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metric-card {
  display: grid;
  min-height: 78px;
  align-content: center;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
}

.metric-card.is-price {
  background: var(--primary-50);
}

.metric-card.is-stock {
  background: #eff6ff;
}

.metric-card.is-mode {
  grid-column: 1 / 2;
  background: var(--primary-50);
}

.metric-card span {
  color: var(--primary-700);
  font-size: 0.68rem;
  font-weight: 900;
}

.metric-card strong {
  color: var(--primary-500);
  font-size: 1.3rem;
  font-weight: 900;
  line-height: 1.05;
}

.metric-card.is-stock strong {
  color: #2563eb;
}

.metric-card.is-mode strong {
  color: var(--primary-700);
  font-size: 1rem;
}

.metric-card small {
  color: #0f766e;
  font-size: 0.72rem;
}

.metric-card.is-stock small {
  color: #2563eb;
}

.product-info__features {
  margin: 0 18px 18px;
  padding: 14px;
  border: 1px solid #dbe5ef;
  border-radius: 12px;
}

.product-info__features h4 {
  margin-bottom: 10px;
  color: #17335c;
  font-size: 0.9rem;
  font-weight: 900;
}

.product-info__features dl,
.product-info__features div {
  margin: 0;
}

.product-info__features div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid #dfe7f0;
  border-radius: 9px;
  background: #fbfdff;
}

.product-info__features dt {
  color: #66758d;
  font-size: 0.76rem;
  font-weight: 900;
}

.product-info__features dd {
  margin: 0;
  color: #071327;
  font-size: 0.78rem;
  font-weight: 900;
}

.cart-fly-feedback {
  position: fixed;
  z-index: 1200;
  left: 0;
  top: 0;
  pointer-events: none;
  transform: translate3d(var(--from-x), var(--from-y), 0) translate(-50%, -50%);
}

.cart-fly-feedback span {
  display: inline-flex;
  max-width: 178px;
  height: 34px;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  padding: 0 11px;
  border: 1px solid var(--primary-400);
  border-radius: 999px;
  color: var(--primary-900);
  background: var(--primary-50);
  box-shadow: 0 14px 30px rgba(15, 158, 46, 0.2);
  font-size: 0.72rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cart-fly-feedback i {
  color: var(--primary-600);
}

.cart-fly-enter-active {
  animation: fly-to-cart 1700ms cubic-bezier(0.18, 0.82, 0.22, 1) forwards;
}

.cart-fly-enter-active span {
  animation: fly-to-cart-scale 1700ms ease forwards;
}

@keyframes fly-to-cart {
  0% {
    opacity: 0;
    transform: translate3d(var(--from-x), var(--from-y), 0) translate(-50%, -50%) scale(0.76);
  }

  12% {
    opacity: 1;
  }

  /* Se mantiene visible y casi quieto un momento antes de salir disparado. */
  62% {
    opacity: 1;
    transform: translate3d(var(--from-x), calc(var(--from-y) - 42px), 0) translate(-50%, -50%) scale(1);
  }

  82% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate3d(var(--to-x), var(--to-y), 0) translate(-50%, -50%) scale(0.46);
  }
}

@keyframes fly-to-cart-scale {
  0% {
    filter: saturate(1);
  }

  72% {
    filter: saturate(1.18);
  }

  100% {
    filter: saturate(1);
  }
}

/* Fundido del fondo oscuro (scrim) de la hoja del carrito en móvil. */
.cart-scrim-enter-active,
.cart-scrim-leave-active {
  transition: opacity 0.28s ease;
}

.cart-scrim-enter-from,
.cart-scrim-leave-to {
  opacity: 0;
}

/* Bloquea el scroll del fondo mientras la hoja del carrito está abierta. */
:global(body.pos-cart-sheet-open) {
  overflow: hidden;
}

@keyframes cart-panel-pulse {
  0%,
  100% {
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1);
  }

  38% {
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1), 0 0 0 4px rgba(0, 166, 100, 0.16);
  }
}

@keyframes product-added-pop {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  45% {
    transform: translateY(-2px) scale(1.015);
  }
}

@keyframes cart-line-added {
  0% {
    background: var(--primary-50);
    transform: translateX(5px);
  }

  100% {
    background: #ffffff;
    transform: translateX(0);
  }
}

@keyframes cart-feedback-chip {
  0% {
    opacity: 0;
    transform: translateY(3px) scale(0.96);
  }

  18%,
  76% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-2px) scale(0.98);
  }
}

@keyframes quantity-updated {
  0%,
  100% {
    color: var(--primary-700);
    background: var(--primary-50);
  }

  42% {
    color: #ffffff;
    background: var(--primary-500);
    box-shadow: 0 0 0 3px rgba(15, 158, 46, 0.14);
  }
}

@media (max-width: 1200px) {
  /* Tablet (incluye iPad Air/Pro en horizontal ~1180-1194px): aquí ya NO cabe
     el catálogo + carrito lado a lado, así que pasamos al carrito como hoja
     inferior. La barra lateral del POS sigue visible, por eso desplazamos la
     hoja y la barra por su ancho (--sidebar-w). En móvil (<=760) estas
     variables se reinician a 0 (sidebar oculto). */
  .sale-content {
    --sheet-left: var(--sidebar-w, 0px);
    --bar-gap: 14px;
    grid-template-columns: 1fr;
    gap: 14px;
    padding-bottom: calc(86px + env(safe-area-inset-bottom));
  }

  /* Apila herramientas y título: la búsqueda y el selector de vista (grilla /
     lista) quedan siempre accesibles, sin recortarse contra el borde derecho. */
  .pos-toolbar,
  .pos-titlebar {
    align-items: flex-start;
    flex-direction: column;
  }

  .pos-titlebar {
    gap: 10px;
  }

  .toolbar-group {
    width: 100%;
    flex-wrap: wrap;
    overflow-x: visible;
  }

  .toolbar-label {
    display: none;
  }

  .toolbar-search {
    order: -1;
    flex: 1 1 100%;
    min-width: 0;
  }

  .toolbar-search :deep(.p-inputtext) {
    height: 42px;
  }

  .catalog-area {
    height: auto;
    max-height: none;
  }

  .catalog-scroll {
    overflow: visible;
    padding-right: 0;
  }

  .catalog-scroll.is-table {
    /* OJO: overflow-x: hidden + overflow-y: visible hace que el spec convierta
       el eje Y en `auto`, creando un scroll interno colapsado (el "cuadrito").
       En móvil las filas son flex y el head se oculta, así que no hay desborde
       horizontal: dejamos visible para que scrollee con la página. */
    overflow: visible;
  }

  /* El catálogo ocupa todo el ancho disponible sin desbordar en tablet. */
  .product-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  /* Filas de producto compactas con botón "+" claro (también en tablet). */
  .product-table__head {
    display: none;
  }

  .product-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 10px;
    cursor: pointer;
  }

  .product-row__icon {
    flex: 0 0 auto;
  }

  .product-row__info {
    flex: 1 1 auto;
    min-width: 0;
  }

  .product-row__info strong {
    white-space: normal;
  }

  .product-row__price {
    flex: 0 0 auto;
    margin-left: auto;
    text-align: right;
    white-space: nowrap;
  }

  .product-row__stock {
    display: none;
  }

  .product-row__add {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 42px;
    min-width: 0;
    height: 42px;
    padding: 0;
    border-radius: 999px !important;
    box-shadow: 0 6px 14px rgba(15, 158, 46, 0.28);
  }

  .product-row__add :deep(.p-button-label) {
    display: none;
  }

  .product-row__add :deep(.p-button-icon) {
    margin: 0;
    font-size: 1.05rem;
  }

  .product-row.is-recently-added {
    background: var(--primary-50);
  }

  /* ====== Carrito como hoja inferior deslizante (bottom sheet) ====== */
  .cart-panel {
    position: fixed;
    top: auto;
    right: 0;
    bottom: 0;
    left: var(--sheet-left);
    z-index: 60;
    height: auto;
    max-height: 88dvh;
    min-height: 0;
    padding-top: 10px;
    border: 0;
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -18px 44px rgba(15, 23, 42, 0.26);
    transform: translateY(110%);
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .cart-panel.is-open {
    transform: translateY(0);
  }

  .cart-panel.is-pulsing {
    /* La hoja está oculta hasta abrirse; evita que el pulse la desplace. */
    animation: none;
  }

  .cart-sheet-handle {
    display: block;
    position: absolute;
    top: 7px;
    left: 50%;
    width: 42px;
    height: 4px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: #cfd8e3;
  }

  .cart-sheet-close {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 999px;
    color: #51607a;
    background: #eef2f7;
    cursor: pointer;
  }

  .cart-sheet-scrim {
    display: block;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: var(--sheet-left);
    z-index: 55;
    background: rgba(8, 19, 39, 0.5);
  }

  /* ====== Barra fija de carrito (siempre visible) ====== */
  .mobile-cart-bar {
    display: flex;
    position: fixed;
    right: var(--bar-gap);
    /* Se apila por encima del menú inferior (en móvil --pos-bottom-nav-h > 0).
       En tablet la variable es 0 y queda pegada al borde como antes. */
    bottom: calc(var(--pos-bottom-nav-h, 0px) + var(--bar-gap));
    left: calc(var(--sheet-left) + var(--bar-gap));
    z-index: 40;
    align-items: center;
    gap: 12px;
    height: 60px;
    padding: 0 12px;
    border: 0;
    border-radius: 14px;
    color: #ffffff;
    background: linear-gradient(135deg, var(--primary-500), var(--primary-700));
    box-shadow: 0 14px 30px rgba(10, 111, 31, 0.34);
    text-align: left;
    cursor: pointer;
  }

  .mobile-cart-bar.is-empty {
    color: #51607a;
    background: #ffffff;
    border: 1px solid #dde4ec;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  }

  .mobile-cart-bar__icon {
    position: relative;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    border-radius: 11px;
    font-size: 1.1rem;
    background: rgba(255, 255, 255, 0.18);
  }

  .mobile-cart-bar.is-empty .mobile-cart-bar__icon {
    background: #f1f5f9;
  }

  .mobile-cart-bar__count {
    position: absolute;
    top: -6px;
    right: -6px;
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    color: var(--primary-700);
    background: #ffffff;
    font-size: 0.7rem;
    font-weight: 900;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .mobile-cart-bar__copy {
    display: grid;
    gap: 1px;
    min-width: 0;
    flex: 1 1 auto;
    line-height: 1.15;
  }

  .mobile-cart-bar__copy strong {
    font-size: 0.92rem;
    font-weight: 900;
  }

  .mobile-cart-bar__copy small {
    overflow: hidden;
    font-size: 0.68rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.82;
  }

  .mobile-cart-bar__total {
    display: grid;
    flex: 0 0 auto;
    justify-items: end;
    gap: 1px;
    line-height: 1.1;
  }

  .mobile-cart-bar.is-empty .mobile-cart-bar__total {
    display: none;
  }

  .mobile-cart-bar__total small {
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.82;
  }

  .mobile-cart-bar__total strong {
    font-size: 1rem;
    font-weight: 900;
  }

  .mobile-cart-bar__chevron {
    flex: 0 0 auto;
    font-size: 0.8rem;
    opacity: 0.85;
  }
}

@media (max-width: 760px) {
  /* En móvil la barra lateral está oculta: la hoja y la barra vuelven al ancho
     completo (offset 0) y con márgenes más ajustados. */
  .sale-content {
    --sheet-left: 0px;
    --bar-gap: 8px;
    /* El menú inferior ya lo libra el padding del workspace (--pos-bottom-nav-h).
       Aquí solo reservamos el alto de la barra de carrito que flota encima. */
    padding-bottom: 88px;
  }

  .product-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }

  .product-info__body {
    grid-template-columns: 1fr;
  }

  .product-info__visual {
    min-height: 110px;
  }

  :global(.checkout-dialog.p-dialog) {
    width: calc(100vw - 20px);
    max-height: calc(100dvh - 20px);
  }

  .receipt-panel {
    grid-template-columns: 1fr;
  }

  .receipt-actions {
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid #d9e2dc;
  }

  .thermal-ticket {
    width: min(80mm, calc(100vw - 48px));
  }

  .checkout-panel {
    max-height: calc(100dvh - 20px);
    padding: 12px;
  }

  .checkout-grid,
  .sale-mode-switch {
    grid-template-columns: 1fr;
  }

  .checkout-total-card > div {
    align-items: flex-start;
    flex-direction: column;
  }

  .checkout-total-card__chips {
    justify-content: flex-start;
  }
}

@media (max-width: 440px) {
  .cart-line__actions {
    grid-template-columns: minmax(0, 1fr) auto 32px;
  }

  .product-info__metrics {
    grid-template-columns: 1fr;
  }

  .metric-card.is-mode {
    grid-column: auto;
  }

  .checkout-box {
    padding: 10px;
  }

  .payment-option {
    gap: 10px;
    padding: 11px;
  }

  .payment-option__icon {
    width: 38px;
    height: 38px;
  }

  .split-payment-panel__title,
  .second-payment-options,
  .split-payment-amounts {
    grid-template-columns: 1fr;
  }

  .split-payment-panel__title {
    display: grid;
  }

  .split-payment-panel__title span {
    white-space: normal;
  }

  .checkout-footer {
    grid-template-columns: 1fr;
  }

  .checkout-footer :deep(.p-button) {
    width: 100%;
  }

  :global(.swal2-container.swal2-bottom-end) {
    padding: 0 12px 14px !important;
  }
}
</style>
