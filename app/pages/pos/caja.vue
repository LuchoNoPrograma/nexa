<script setup lang="ts">
import type {
  PosCashMovement as CashMovement,
  PosCashMovementType as MovementType,
  PosCashPaymentMethod as PaymentMethod,
} from '~/stores/cash'

definePageMeta({
  layout: 'pos',
  posTitle: 'Caja',
})

useHead({
  title: 'Caja | NEXA',
})

const currencyFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const cashRegister = usePosCashRegister()
const session = usePosSession()
const cashStatus = cashRegister.cashStatus
const movements = cashRegister.movements
const productSales = cashRegister.productSales
const registerName = ref('Caja principal')
const openedBy = ref('Responsable de caja')
const openedAt = ref('')
const openingFloat = ref(0)
const countedCash = ref(0)
const desiredFloat = ref(0)
const closingNote = ref('')
const closedAt = ref('')
const lastPrintedAt = ref('')
const cashLoadError = ref('')

const openDialogVisible = ref(false)
const movementDialogVisible = ref(false)
const arqueoDialogVisible = ref(false)
const productDialogVisible = ref(false)
const closeDialogVisible = ref(false)

const openingForm = reactive({
  registerName: 'Caja principal',
  openedBy: 'Responsable de caja',
  openingFloat: 0,
  note: '',
})

const movementForm = reactive({
  type: 'Ingreso' as MovementType,
  method: 'Efectivo' as PaymentMethod,
  concept: '',
  amount: 0,
  note: '',
})

const movementTypes: MovementType[] = ['Ingreso', 'Egreso']
const paymentMethods: PaymentMethod[] = ['Efectivo', 'QR']

const currentTime = computed(() => {
  const now = new Date()
  return now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
})

onMounted(async () => {
  registerName.value = session.value?.store?.trim() || 'Caja principal'
  openedBy.value = session.value?.name?.trim() || 'Responsable de caja'
  openingForm.registerName = registerName.value
  openingForm.openedBy = openedBy.value

  try {
    await cashRegister.loadCashData()
  } catch {
    cashLoadError.value = 'No se pudo cargar la caja desde la base de datos.'
  }
})

watch(() => cashRegister.cashSession.value, (cashSession) => {
  if (!cashSession) {
    cashStatus.value = 'cerrada'
    registerName.value = session.value?.store?.trim() || registerName.value || 'Caja principal'
    openedBy.value = session.value?.name?.trim() || 'Responsable de caja'
    openedAt.value = ''
    openingFloat.value = 0
    countedCash.value = 0
    desiredFloat.value = 0
    closedAt.value = ''
    closingNote.value = ''
    return
  }

  cashStatus.value = cashSession.status
  openingFloat.value = cashSession.openingFloat
  countedCash.value = cashSession.countedCash ?? (cashSession.status === 'cerrada' ? cashSession.expectedCash : cashSession.openingFloat)
  desiredFloat.value = cashSession.openingFloat
  openedAt.value = cashSession.openedAt
  closedAt.value = cashSession.closedAt ?? ''
  openedBy.value = cashSession.openedBy
  closingNote.value = cashSession.notes ?? ''
}, { immediate: true })

const cashIncome = computed(() => movements.value
  .filter((movement) => movement.type === 'Ingreso' && movement.method === 'Efectivo')
  .reduce((sum, movement) => sum + movement.amount, 0))

const cashOutcome = computed(() => movements.value
  .filter((movement) => movement.type === 'Egreso' && movement.method === 'Efectivo')
  .reduce((sum, movement) => sum + movement.amount, 0))

const expectedCash = computed(() => {
  const dbSession = cashRegister.cashSession.value
  if (dbSession?.status === 'cerrada') {
    return Number(dbSession.expectedCash || 0)
  }

  return openingFloat.value + cashIncome.value - cashOutcome.value
})

const countedDifference = computed(() => Number(countedCash.value || 0) - expectedCash.value)

const totalSales = computed(() => movements.value
  .filter((movement) => movement.type === 'Ingreso' && movement.source === 'venta')
  .reduce((sum, movement) => sum + movement.amount, 0))

const salesReadyToClose = computed(() => movements.value
  .filter((movement) => movement.source === 'venta' && movement.status === 'por_cerrar').length)

const depositAmount = computed(() => Math.max(Number(countedCash.value || 0) - Number(desiredFloat.value || 0), 0))

const productUnits = computed(() => productSales.value.reduce((sum, item) => sum + item.qty, 0))
const productTotal = computed(() => productSales.value.reduce((sum, item) => sum + item.total, 0))
const productRanking = computed(() => [...productSales.value].sort((a, b) => b.total - a.total))

const paymentBreakdown = computed(() => paymentMethods.map((method) => {
  const income = movements.value
    .filter((movement) => movement.type === 'Ingreso' && movement.method === method && movement.source === 'venta')
    .reduce((sum, movement) => sum + movement.amount, 0)

  return {
    method,
    income,
    count: movements.value.filter((movement) => movement.type === 'Ingreso' && movement.method === method && movement.source === 'venta').length,
  }
}))

// Los 4 accesos grandes de la caja (estilo POS profesional).
const cashTools = computed<{ key: string; label: string; desc: string; icon: string; tone: string; action: () => void }[]>(() => [
  { key: 'movimiento', label: 'Entrada / salida', desc: 'Dinero que entra o sale', icon: 'fluent-emoji:money-with-wings', tone: 'green', action: () => openMovementDialog('Ingreso') },
  { key: 'producto', label: 'Reporte por producto', desc: 'Qué y cuánto se vendió hoy', icon: 'fluent-emoji:package', tone: 'blue', action: () => { productDialogVisible.value = true } },
  { key: 'arqueo', label: 'Arqueo de caja', desc: 'Cuenta el efectivo físico', icon: 'fluent-emoji:abacus', tone: 'amber', action: () => { arqueoDialogVisible.value = true } },
  { key: 'cierre', label: 'Cerrar turno', desc: 'Revisa y termina caja', icon: 'fluent-emoji:check-mark-button', tone: 'slate', action: () => { closeDialogVisible.value = true } },
])

const closeReportRows = computed(() => [
  { label: 'Fondo inicial', value: money(openingFloat.value) },
  { label: 'Ventas y entradas en efectivo', value: money(cashIncome.value) },
  { label: 'Salidas en efectivo', value: money(cashOutcome.value) },
  { label: 'Dinero esperado en caja', value: money(expectedCash.value), strong: true },
  { label: 'Efectivo contado', value: money(Number(countedCash.value || 0)), strong: true },
  { label: 'Diferencia', value: money(countedDifference.value), strong: true, tone: differenceTone.value },
  { label: 'Dejar en caja', value: money(Number(desiredFloat.value || 0)) },
  { label: 'Retirar / depositar', value: money(depositAmount.value) },
])

const sessionDuration = computed(() => {
  if (!cashRegister.cashSession.value) {
    return 'Sin turno abierto'
  }

  return `${openedAt.value} - ${cashStatus.value === 'cerrada' ? closedAt.value : 'en curso'}`
})

const differenceTone = computed(() => {
  const absDifference = Math.abs(countedDifference.value)

  if (absDifference <= 0.01) {
    return 'green'
  }

  if (absDifference <= 5) {
    return 'gold'
  }

  return 'red'
})

const differenceLabel = computed(() => {
  if (Math.abs(countedDifference.value) <= 0.01) {
    return 'Caja cuadrada'
  }

  return countedDifference.value > 0 ? 'Sobrante' : 'Faltante'
})

const differenceHelp = computed(() => {
  if (Math.abs(countedDifference.value) <= 0.01) {
    return 'El conteo coincide con lo esperado.'
  }

  return countedDifference.value > 0
    ? 'Hay más efectivo contado que el esperado.'
    : 'Hay menos efectivo contado que el esperado.'
})

function money(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}Bs. ${currencyFormatter.format(Math.abs(value || 0))}`
}

function formatSigned(value: number) {
  if (Math.abs(value) <= 0.01) {
    return money(0)
  }

  return value > 0 ? `+${money(value)}` : money(value)
}

function movementClass(type: MovementType) {
  return type === 'Ingreso' ? 'text-emerald-700' : 'text-red-600'
}

function movementSign(type: MovementType) {
  return type === 'Ingreso' ? '+' : '-'
}

function movementStatusLabel(movement: CashMovement) {
  if (movement.status === 'cerrado') {
    return 'Cerrado'
  }

  return movement.source === 'venta' ? 'Por cerrar' : 'En turno'
}

function resetMovementForm() {
  movementForm.type = 'Ingreso'
  movementForm.method = 'Efectivo'
  movementForm.concept = ''
  movementForm.amount = 0
  movementForm.note = ''
}

async function openCashSession() {
  registerName.value = openingForm.registerName.trim() || 'Caja principal'
  openedBy.value = openingForm.openedBy.trim() || 'Responsable de caja'
  openingFloat.value = Number(openingForm.openingFloat || 0)
  countedCash.value = openingFloat.value
  desiredFloat.value = openingFloat.value
  openedAt.value = currentTime.value
  closedAt.value = ''
  closingNote.value = openingForm.note.trim()
  await cashRegister.openTurn(openingFloat.value, closingNote.value)
  openDialogVisible.value = false
}

function openMovementDialog(type: MovementType) {
  resetMovementForm()
  movementForm.type = type
  movementDialogVisible.value = true
}

async function saveMovement() {
  if (!movementForm.concept.trim() || Number(movementForm.amount || 0) <= 0) {
    return
  }

  await cashRegister.addManualMovement({
    concept: movementForm.concept.trim(),
    type: movementForm.type,
    method: movementForm.method,
    amount: Number(movementForm.amount || 0),
    note: movementForm.note.trim() || undefined,
  })

  movementDialogVisible.value = false
  resetMovementForm()
}

async function closeCashSession(printAfterClose = false) {
  await cashRegister.closeTurn(Number(countedCash.value || 0), closingNote.value)
  closedAt.value = currentTime.value
  closeDialogVisible.value = false

  if (printAfterClose) {
    printClosureReport()
  }
}

function reopenCashSession() {
  openingForm.registerName = session.value?.store?.trim() || registerName.value || 'Caja principal'
  openingForm.openedBy = session.value?.name?.trim() || openedBy.value || 'Responsable de caja'
  openingForm.openingFloat = Number(desiredFloat.value || 0)
  openingForm.note = ''
  openDialogVisible.value = true
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function storeReportName() {
  return session.value?.store || registerName.value || 'Mi tienda'
}

function reportLongDate() {
  const formatted = new Date().toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function reportShortDate() {
  return new Date().toLocaleDateString('es-BO', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

// CSS común para tickets de 80mm (mismo estilo que el comprobante de venta).
function thermalCss() {
  return `
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 10px; }
    .ticket { width: 72mm; margin: 0 auto; padding: 2mm 0; }
    header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 5px; }
    h1 { margin: 0; font-size: 14px; font-weight: 900; }
    header p { margin: 2px 0 0; font-size: 9px; }
    .doc { margin: 6px 0; padding: 5px; border: 1px solid #000; text-align: center; }
    .doc span { display: block; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .doc strong { display: block; margin-top: 2px; font: 900 12px ui-monospace, monospace; }
    .doc small { display: block; margin-top: 2px; font-size: 8px; }
    .section-title { display: flex; align-items: center; gap: 8px; margin: 8px 0 2px; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .section-title:before, .section-title:after { content: ""; height: 1px; flex: 1; background: #000; }
    table.rpt { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.rpt td, table.rpt th { padding: 2px 0; font-size: 10px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    table.rpt th { font-size: 8px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; }
    table.rpt td small, table.rpt .sub { display: block; font-size: 8px; }
    table.rpt .amt { text-align: right; font: 900 10px ui-monospace, monospace; white-space: nowrap; width: 22mm; }
    table.rpt th.amt { font-size: 8px; }
    table.rpt .qty { text-align: right; font: 900 10px ui-monospace, monospace; width: 9mm; }
    table.rpt .time { font: 900 9px ui-monospace, monospace; width: 13mm; }
    table.rpt tr.line td { border-bottom: 1px dashed #000; }
    table.rpt tr.strong td { border-top: 1px solid #000; font-weight: 900; padding-top: 4px; }
    table.rpt tr.strong .amt { font-size: 11px; }
    .grand { margin-top: 6px; padding-top: 6px; border-top: 2px solid #000; display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; font-weight: 900; }
    .grand b { font: 900 12px ui-monospace, monospace; }
    .sign { margin-top: 24px; text-align: center; }
    .sign .line { border-top: 1px solid #000; margin: 0 6mm; padding-top: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    footer { margin-top: 10px; padding-top: 7px; border-top: 1px solid #000; text-align: center; font-size: 9px; }
    footer strong { display: block; margin-top: 3px; }
    @media screen { body { background: #f3f4f6; padding: 16px; } .ticket { background: #fff; min-height: 100vh; padding: 5mm; box-shadow: 0 12px 30px rgba(0,0,0,.16); } }
  `
}

function openThermalReport(name: string, title: string, bodyHtml: string) {
  if (!import.meta.client) {
    return
  }

  const reportWindow = window.open('', name, 'width=420,height=720')

  if (!reportWindow) {
    window.print()
    return
  }

  // document.open() reinicia el documento: si la ventana (por su nombre) ya
  // existía de una impresión previa, sin esto el evento load no vuelve a
  // dispararse y no se imprime.
  reportWindow.document.open()
  reportWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${thermalCss()}</style>
</head>
<body>
  <main class="ticket">${bodyHtml}</main>
</body>
</html>`)
  reportWindow.document.close()
  reportWindow.focus()

  // Imprimimos desde la ventana padre (no desde un script inline) para que
  // funcione también cuando la ventana se reutiliza entre impresiones.
  setTimeout(() => {
    try {
      reportWindow.print()
    } catch {
      reportWindow.focus()
    }
  }, 300)
}

// Totales auxiliares que comparten arqueo y cierre.
function reportTotals() {
  const otrosIngresos = movements.value
    .filter((movement) => movement.type === 'Ingreso' && movement.source === 'manual')
    .reduce((sum, movement) => sum + movement.amount, 0)

  const egresos = movements.value
    .filter((movement) => movement.type === 'Egreso')
    .reduce((sum, movement) => sum + movement.amount, 0)

  return {
    otrosIngresos,
    egresos,
    totalMovimiento: totalSales.value + otrosIngresos - egresos,
  }
}

function reportHeaderHtml(docTitle: string, docSubtitle: string) {
  return `
    <header>
      <h1>${escapeHtml(storeReportName())}</h1>
      <p>${escapeHtml(registerName.value)}</p>
      <p>Responsable: ${escapeHtml(openedBy.value)}</p>
    </header>
    <section class="doc">
      <span>${escapeHtml(docTitle)}</span>
      <strong>${escapeHtml(reportShortDate())}</strong>
      <small>${escapeHtml(docSubtitle)}</small>
    </section>`
}

// Arqueo de caja: resumen financiero en tabla (Ingresos / Egresos / Totales).
function printArqueoReport() {
  if (!import.meta.client) {
    return
  }

  lastPrintedAt.value = currentTime.value
  const { otrosIngresos, egresos, totalMovimiento } = reportTotals()

  const ventaRows = paymentBreakdown.value
    .map((item) => `<tr><td>${escapeHtml(item.method)}</td><td class="amt">${escapeHtml(money(item.income))}</td></tr>`)
    .join('')

  const body = `
    ${reportHeaderHtml('Arqueo de caja', 'Expresado en bolivianos')}

    <div class="section-title">Ingresos</div>
    <table class="rpt">
      ${ventaRows}
      <tr class="strong"><td>Total ventas</td><td class="amt">${escapeHtml(money(totalSales.value))}</td></tr>
    </table>

    <div class="section-title">Otros ingresos</div>
    <table class="rpt">
      <tr><td>Ingresos</td><td class="amt">${escapeHtml(money(otrosIngresos))}</td></tr>
    </table>

    <div class="section-title">Egresos</div>
    <table class="rpt">
      <tr><td>Egresos</td><td class="amt">${escapeHtml(money(egresos))}</td></tr>
    </table>

    <div class="grand"><span>Total efectivo en caja</span><b>${escapeHtml(money(expectedCash.value))}</b></div>
    <div class="grand"><span>Total movimiento en caja</span><b>${escapeHtml(money(totalMovimiento))}</b></div>

    <div class="sign"><div class="line">Firma y sello cajero</div></div>
    <footer>
      <em>Turno: ${escapeHtml(sessionDuration.value)} · Impreso: ${escapeHtml(lastPrintedAt.value)}</em>
      <strong>${escapeHtml(reportLongDate())}</strong>
    </footer>
  `

  openThermalReport('nexa-arqueo-caja', 'Arqueo de caja - NEXA', body)
}

// Cierre de caja: bitácora de movimientos (Hora / Detalle / Total) + resumen.
function printClosureReport() {
  if (!import.meta.client) {
    return
  }

  lastPrintedAt.value = currentTime.value
  const { otrosIngresos, egresos, totalMovimiento } = reportTotals()

  // Movimientos del más reciente al más antiguo, como en el ticket de ejemplo.
  const ordered = [...movements.value].reverse()
  const cierreRow = cashStatus.value === 'cerrada'
    ? `<tr class="line"><td class="time">${escapeHtml(closedAt.value || lastPrintedAt.value)}</td><td>Se generó el cierre</td><td class="amt"></td></tr>`
    : ''

  const movRows = ordered.length
    ? ordered.map((movement) => `
        <tr class="line">
          <td class="time">${escapeHtml(movement.time)}</td>
          <td>${escapeHtml(movement.concept)}<span class="sub">${escapeHtml(movement.method)} · ${escapeHtml(movementStatusLabel(movement))}</span></td>
          <td class="amt">${escapeHtml(`${movementSign(movement.type)} ${money(movement.amount)}`)}</td>
        </tr>
      `).join('')
    : '<tr class="line"><td colspan="3">Sin movimientos en el turno.</td></tr>'

  const body = `
    ${reportHeaderHtml('Cierre de caja', 'Detalle de movimientos del turno')}

    <table class="rpt">
      <thead><tr><th class="time">Hora</th><th>Detalle</th><th class="amt">Total Bs</th></tr></thead>
      <tbody>
        ${cierreRow}
        ${movRows}
      </tbody>
    </table>

    <div class="section-title">Resumen</div>
    <table class="rpt">
      <tr><td>Total ventas</td><td class="amt">${escapeHtml(money(totalSales.value))}</td></tr>
      <tr><td>Otros ingresos</td><td class="amt">${escapeHtml(money(otrosIngresos))}</td></tr>
      <tr><td>Egresos</td><td class="amt">${escapeHtml(money(egresos))}</td></tr>
      <tr class="strong"><td>Total movimiento en caja</td><td class="amt">${escapeHtml(money(totalMovimiento))}</td></tr>
      <tr class="strong"><td>Total efectivo en caja</td><td class="amt">${escapeHtml(money(expectedCash.value))}</td></tr>
    </table>

    <div class="section-title">Observación</div>
    <table class="rpt"><tr><td colspan="3">${escapeHtml(closingNote.value || 'Sin observaciones.')}</td></tr></table>

    <div class="sign"><div class="line">Firma y sello cajero</div></div>
    <footer>
      <em>Turno: ${escapeHtml(sessionDuration.value)} · Impreso: ${escapeHtml(lastPrintedAt.value)}</em>
      <strong>¡Buena suerte!</strong>
    </footer>
  `

  openThermalReport('nexa-cierre-caja', 'Cierre de caja - NEXA', body)
}

function printProductReport() {
  if (!import.meta.client) {
    return
  }

  const rows = productRanking.value.length
    ? productRanking.value.map((item) => `
        <tr class="line">
          <td>${escapeHtml(item.name)}</td>
          <td class="qty">${item.qty}</td>
          <td class="amt">${escapeHtml(money(item.total))}</td>
        </tr>
      `).join('')
    : '<tr class="line"><td colspan="3">Sin ventas registradas.</td></tr>'

  const body = `
    ${reportHeaderHtml('Reporte por producto', 'Total mercadería vendida')}

    <table class="rpt">
      <thead><tr><th>Detalle</th><th class="qty">C.</th><th class="amt">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tr class="strong"><td>Total (${productUnits.value} u.)</td><td class="qty"></td><td class="amt">${escapeHtml(money(productTotal.value))}</td></tr>
    </table>

    <footer>
      <em>Turno: ${escapeHtml(sessionDuration.value)}</em>
      <strong>${escapeHtml(reportLongDate())}</strong>
    </footer>
  `

  openThermalReport('nexa-reporte-productos', 'Reporte por producto - NEXA', body)
}
</script>

<template>
  <div class="cash-page">
    <!-- Encabezado: estado del turno + total del día bien visible -->
    <section class="cash-top">
      <div class="cash-state" :class="cashStatus === 'abierta' ? 'is-open' : 'is-closed'">
        <span class="state-dot" aria-hidden="true" />
        <div>
          <strong>{{ cashStatus === 'abierta' ? 'Caja abierta' : 'Caja cerrada' }}</strong>
          <small>{{ registerName }} · {{ sessionDuration }}</small>
        </div>
      </div>

      <div class="cash-balance">
        <small>Ventas del turno</small>
        <strong>{{ money(totalSales) }}</strong>
        <div class="cash-balance__stats">
          <span><em>Dinero esperado</em>{{ money(expectedCash) }}</span>
          <span><em>Ventas por cerrar</em>{{ salesReadyToClose }}</span>
        </div>
      </div>

      <Button
        v-if="cashStatus === 'cerrada'"
        type="button"
        icon="pi pi-unlock"
        label="Abrir caja"
        class="cash-open-btn"
        @click="reopenCashSession"
      />
    </section>

    <!-- 4 botones grandes: lo esencial de una caja profesional -->
    <section class="cash-tools" aria-label="Acciones de caja">
      <button
        v-for="tool in cashTools"
        :key="tool.key"
        type="button"
        class="cash-tool"
        :class="`is-${tool.tone}`"
        :disabled="cashStatus === 'cerrada'"
        @click="tool.action"
      >
        <span class="cash-tool__icon"><Icon :name="tool.icon" aria-hidden="true" /></span>
        <strong>{{ tool.label }}</strong>
        <small>{{ tool.desc }}</small>
      </button>
    </section>

    <Message v-if="salesReadyToClose > 0 && cashStatus === 'abierta'" severity="info" size="small" icon="pi pi-info-circle">
      Hay {{ salesReadyToClose }} venta{{ salesReadyToClose === 1 ? '' : 's' }} lista{{ salesReadyToClose === 1 ? '' : 's' }} para revisar y cerrar al final del turno.
    </Message>

    <Message v-if="cashLoadError" severity="error" size="small" icon="pi pi-exclamation-triangle">
      {{ cashLoadError }}
    </Message>

    <!-- Movimientos del día: lista simple y legible -->
    <section class="panel moves-panel">
      <header class="panel-head">
        <div>
          <span>Registro del turno</span>
          <h2>Movimientos de hoy</h2>
        </div>
        <Button
          type="button"
          icon="pi pi-plus"
          label="Movimiento"
          size="small"
          :disabled="cashStatus === 'cerrada'"
          @click="openMovementDialog('Ingreso')"
        />
      </header>

      <ul class="move-list">
        <li v-for="movement in movements" :key="movement.id">
          <span class="move-time">{{ movement.time }}</span>
          <span class="move-main">
            <strong>{{ movement.concept }}</strong>
            <small>{{ movement.method }} · {{ movementStatusLabel(movement) }}</small>
          </span>
          <strong class="move-amount" :class="movementClass(movement.type)">
            {{ movementSign(movement.type) }} {{ money(movement.amount) }}
          </strong>
        </li>
        <li v-if="!movements.length" class="move-empty">Aún no hay movimientos en este turno.</li>
      </ul>
    </section>

    <!-- Diálogo: abrir caja -->
    <Dialog v-model:visible="openDialogVisible" modal header="Abrir caja" class="cash-dialog">
      <form class="dialog-form" @submit.prevent="openCashSession">
        <label class="field">
          <span>Caja</span>
          <InputText v-model="openingForm.registerName" />
        </label>
        <label class="field">
          <span>Responsable</span>
          <InputText v-model="openingForm.openedBy" />
        </label>
        <label class="field">
          <span>Fondo inicial para cambio</span>
          <InputNumber v-model="openingForm.openingFloat" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
        </label>
        <label class="field full">
          <span>Nota de apertura</span>
          <Textarea v-model="openingForm.note" rows="3" auto-resize />
        </label>

        <footer>
          <Button type="button" label="Cancelar" outlined severity="secondary" @click="openDialogVisible = false" />
          <Button type="submit" label="Abrir caja" icon="pi pi-unlock" />
        </footer>
      </form>
    </Dialog>

    <!-- Diálogo: registrar movimiento -->
    <Dialog v-model:visible="movementDialogVisible" modal header="Registrar entrada o salida" class="cash-dialog">
      <form class="dialog-form" @submit.prevent="saveMovement">
        <label class="field">
          <span>Tipo</span>
          <SelectButton v-model="movementForm.type" :options="movementTypes" />
        </label>
        <label class="field">
          <span>Método</span>
          <Select v-model="movementForm.method" :options="paymentMethods" fluid />
        </label>
        <label class="field full">
          <span>Concepto</span>
          <InputText v-model="movementForm.concept" placeholder="Ej. Retiro para depósito" />
        </label>
        <label class="field">
          <span>Monto</span>
          <InputNumber v-model="movementForm.amount" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
        </label>
        <label class="field full">
          <span>Nota opcional</span>
          <Textarea v-model="movementForm.note" rows="3" auto-resize />
        </label>

        <Message v-if="movementForm.method !== 'Efectivo'" severity="info" size="small" icon="pi pi-info-circle">
          Se guardará para el cierre, pero no cambia el efectivo que cuentas en la caja.
        </Message>

        <footer>
          <Button type="button" label="Cancelar" outlined severity="secondary" @click="movementDialogVisible = false" />
          <Button type="submit" label="Guardar" icon="pi pi-check" :disabled="!movementForm.concept.trim() || Number(movementForm.amount || 0) <= 0" />
        </footer>
      </form>
    </Dialog>

    <!-- Diálogo: reporte por producto -->
    <Dialog v-model:visible="productDialogVisible" modal header="Reporte por producto" class="cash-dialog">
      <div class="report-block">
        <div class="report-totals">
          <div>
            <small>Unidades vendidas</small>
            <strong>{{ productUnits }}</strong>
          </div>
          <div>
            <small>Total vendido</small>
            <strong>{{ money(productTotal) }}</strong>
          </div>
        </div>

        <ul class="product-list">
          <li v-for="(item, index) in productRanking" :key="item.name">
            <b>{{ index + 1 }}</b>
            <span class="product-main">
              <strong>{{ item.name }}</strong>
              <small>{{ item.qty }} unidades</small>
            </span>
            <strong class="product-total">{{ money(item.total) }}</strong>
          </li>
        </ul>
      </div>

      <template #footer>
        <Button type="button" label="Cerrar" outlined severity="secondary" @click="productDialogVisible = false" />
        <Button type="button" label="Imprimir" icon="pi pi-print" @click="printProductReport" />
      </template>
    </Dialog>

    <!-- Diálogo: arqueo de caja -->
    <Dialog v-model:visible="arqueoDialogVisible" modal header="Arqueo de caja" class="cash-dialog">
      <div class="arqueo-block">
        <p class="arqueo-hint">Cuenta el efectivo físico que tienes en la caja y compáralo con lo esperado.</p>

        <label class="field">
          <span>Efectivo contado</span>
          <InputNumber v-model="countedCash" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
        </label>

        <div class="report-rows">
          <div><span>Dinero esperado</span><strong>{{ money(expectedCash) }}</strong></div>
          <div><span>Efectivo contado</span><strong>{{ money(Number(countedCash || 0)) }}</strong></div>
        </div>

        <div class="difference-box" :class="`is-${differenceTone}`">
          <span>{{ differenceLabel }}</span>
          <strong>{{ formatSigned(countedDifference) }}</strong>
          <small>{{ differenceHelp }}</small>
        </div>
      </div>

      <template #footer>
        <Button type="button" label="Cerrar" outlined severity="secondary" @click="arqueoDialogVisible = false" />
        <Button type="button" label="Imprimir arqueo" icon="pi pi-print" outlined @click="printArqueoReport" />
        <Button type="button" label="Continuar al cierre" icon="pi pi-arrow-right" severity="danger" :disabled="cashStatus === 'cerrada'" @click="arqueoDialogVisible = false; closeDialogVisible = true" />
      </template>
    </Dialog>

    <!-- Diálogo: reporte de cierre -->
    <Dialog v-model:visible="closeDialogVisible" modal header="Cerrar caja" class="cash-dialog close-dialog">
      <div class="close-content">
        <Message severity="warn" icon="pi pi-exclamation-triangle">
          Revisa el dinero contado antes de cerrar. Luego el turno quedará guardado.
        </Message>

        <div class="close-fields">
          <label class="field">
            <span>Efectivo contado</span>
            <InputNumber v-model="countedCash" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>
          <label class="field">
            <span>Fondo que quedará para mañana</span>
            <InputNumber v-model="desiredFloat" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>
          <label class="field full">
            <span>Nota para recordar</span>
            <Textarea v-model="closingNote" rows="3" auto-resize placeholder="Ej. Faltan Bs. 2 por cambio entregado sin moneda exacta." />
          </label>
        </div>

        <div class="report-rows">
          <div v-for="row in closeReportRows" :key="row.label" :class="{ strong: row.strong, [`is-${row.tone}`]: row.tone }">
            <span>{{ row.label }}</span>
            <strong>{{ row.value }}</strong>
          </div>
        </div>

        <Message v-if="lastPrintedAt" severity="success" size="small" icon="pi pi-check">
          Último reporte enviado a impresión: {{ lastPrintedAt }}
        </Message>
      </div>

      <template #footer>
        <Button type="button" label="Cancelar" outlined severity="secondary" @click="closeDialogVisible = false" />
        <Button type="button" label="Cerrar turno" severity="danger" outlined @click="closeCashSession(false)" />
        <Button type="button" label="Cerrar e imprimir" icon="pi pi-print" severity="danger" @click="closeCashSession(true)" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.cash-page {
  display: grid;
  gap: 16px;
  max-width: 860px;
  margin: 0 auto;
  color: #102016;
}

.cash-top,
.panel {
  border: 1px solid #e7eee8;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

/* --- Encabezado --- */
.cash-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
}

.cash-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 12px;
  color: #ffffff;
}

.cash-state.is-open {
  background: linear-gradient(135deg, #0a6f1f, #0e8a28);
}

.cash-state.is-closed {
  background: #374151;
}

.state-dot {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #10d99b;
  box-shadow: 0 0 0 6px rgba(16, 217, 155, 0.18);
}

.cash-state.is-closed .state-dot {
  background: #cbd5e1;
  box-shadow: 0 0 0 6px rgba(203, 213, 225, 0.16);
}

.cash-state strong {
  display: block;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 0.86rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cash-state small {
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.72rem;
  font-weight: 700;
}

.cash-balance > small {
  font-size: 0.74rem;
  font-weight: 800;
  color: #718074;
}

.cash-balance > strong {
  display: block;
  margin: 2px 0 8px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.9rem;
  line-height: 1;
  font-weight: 900;
}

.cash-balance__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.cash-balance__stats span {
  display: grid;
  gap: 1px;
  font-size: 0.86rem;
  font-weight: 900;
  color: #1c3a24;
}

.cash-balance__stats em {
  font-style: normal;
  font-size: 0.68rem;
  font-weight: 800;
  color: #718074;
}

.cash-open-btn {
  align-self: center;
}

/* --- 4 botones grandes --- */
.cash-tools {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.cash-tool {
  display: grid;
  gap: 6px;
  padding: 18px 16px;
  border: 1px solid #e7eee8;
  border-radius: 16px;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.cash-tool:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: #cfe3c6;
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
}

.cash-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cash-tool__icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 16px;
  font-size: 2.5rem;
  line-height: 1;
}

.cash-tool.is-green .cash-tool__icon {
  background: #eaf6e7;
  color: #1c7a2c;
}

.cash-tool.is-blue .cash-tool__icon {
  background: #e8f2ff;
  color: #0b4a7a;
}

.cash-tool.is-amber .cash-tool__icon {
  background: #fdf2dc;
  color: #b9781a;
}

.cash-tool.is-slate .cash-tool__icon {
  background: #eef1f4;
  color: #5b6675;
}

.cash-tool strong {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 0.92rem;
  font-weight: 900;
  line-height: 1.2;
}

.cash-tool small {
  font-size: 0.74rem;
  font-weight: 600;
  color: #6b7a6f;
  line-height: 1.35;
}

/* --- Panel de movimientos --- */
.panel {
  padding: 16px 18px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.panel-head span {
  font-size: 0.72rem;
  font-weight: 800;
  color: #718074;
}

.panel-head h2 {
  margin: 2px 0 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 0.98rem;
  font-weight: 900;
}

.move-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.move-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 11px 12px;
  border-radius: 12px;
  background: #f8fbf8;
}

.move-time {
  font-size: 0.74rem;
  font-weight: 800;
  color: #718074;
}

.move-main strong {
  display: block;
  font-size: 0.84rem;
  font-weight: 800;
}

.move-main small {
  font-size: 0.72rem;
  font-weight: 700;
  color: #718074;
}

.move-amount {
  font-size: 0.9rem;
  font-weight: 900;
}

.move-empty {
  justify-content: center;
  color: #718074;
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
}

.text-emerald-700 {
  color: #047857;
}

.text-red-600 {
  color: #dc2626;
}

/* --- Diálogos --- */
.cash-dialog {
  width: min(560px, calc(100vw - 24px));
}

.close-dialog {
  width: min(720px, calc(100vw - 24px));
}

.dialog-form,
.close-content,
.report-block,
.arqueo-block {
  display: grid;
  gap: 14px;
}

.dialog-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dialog-form .full,
.dialog-form footer,
.close-fields .full {
  grid-column: 1 / -1;
}

.dialog-form footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.close-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: #3b4a40;
  font-size: 0.74rem;
  font-weight: 900;
}

.field :deep(.p-inputtext),
.field :deep(.p-inputnumber-input),
.field :deep(.p-select),
.field :deep(.p-textarea) {
  width: 100%;
  font-size: 0.86rem;
}

/* --- Reporte por producto --- */
.report-totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.report-totals div {
  display: grid;
  gap: 3px;
  padding: 13px;
  border-radius: 12px;
  background: #f3faf2;
}

.report-totals small {
  font-size: 0.72rem;
  font-weight: 800;
  color: #718074;
}

.report-totals strong {
  font-size: 1.3rem;
  font-weight: 900;
}

.product-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.product-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fbf8;
}

.product-list b {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 999px;
  background: #0a6f1f;
  color: #fff;
  font-size: 0.74rem;
  font-weight: 900;
}

.product-main strong {
  display: block;
  font-size: 0.84rem;
  font-weight: 800;
}

.product-main small {
  font-size: 0.72rem;
  font-weight: 700;
  color: #718074;
}

.product-total {
  font-size: 0.88rem;
  font-weight: 900;
}

/* --- Arqueo / cierre --- */
.arqueo-hint {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: #5c6b60;
  line-height: 1.4;
}

.report-rows {
  display: grid;
  gap: 8px;
}

.report-rows div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 10px;
  background: #f8fbf8;
}

.report-rows span {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5c6b60;
}

.report-rows strong {
  font-size: 0.84rem;
  font-weight: 900;
}

.report-rows .strong {
  background: #eef8f1;
}

.report-rows .is-green strong {
  color: #0a6f1f;
}

.report-rows .is-gold strong {
  color: #806000;
}

.report-rows .is-red strong {
  color: #dc2626;
}

.difference-box {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.difference-box span {
  font-size: 0.74rem;
  font-weight: 900;
  text-transform: uppercase;
}

.difference-box strong {
  font-size: 1.6rem;
  line-height: 1;
  font-weight: 900;
}

.difference-box small {
  line-height: 1.35;
}

.difference-box.is-green {
  border-color: #c9f4d4;
  background: #ecfdf0;
  color: #0a6f1f;
}

.difference-box.is-gold {
  border-color: #f8e7a1;
  background: #fff9db;
  color: #806000;
}

.difference-box.is-red {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

/* --- Responsivo --- */
@media (max-width: 760px) {
  .cash-top {
    grid-template-columns: 1fr;
  }

  .cash-tools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .cash-open-btn {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .cash-tool {
    padding: 14px 12px;
  }

  .cash-tool__icon {
    width: 42px;
    height: 42px;
    font-size: 1.65rem;
  }

  .dialog-form,
  .close-fields,
  .report-totals {
    grid-template-columns: 1fr;
  }

  .cash-balance > strong {
    font-size: 1.6rem;
  }
}
</style>
