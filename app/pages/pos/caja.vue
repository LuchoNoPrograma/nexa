<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Caja',
})

useHead({
  title: 'Caja | NEXA',
})

type CashStatus = 'abierta' | 'cerrada'
type MovementType = 'Ingreso' | 'Egreso'
type PaymentMethod = 'Efectivo' | 'QR' | 'Tarjeta'

interface CashMovement {
  id: number
  time: string
  concept: string
  type: MovementType
  method: PaymentMethod
  amount: number
  note?: string
}

const currencyFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const cashStatus = ref<CashStatus>('abierta')
const registerName = ref('Caja principal')
const openedBy = ref('María López')
const openedAt = ref('08:00')
const openingFloat = ref(300)
const countedCash = ref(1230)
const desiredFloat = ref(300)
const closingNote = ref('')
const closedAt = ref('')
const lastPrintedAt = ref('')

const openDialogVisible = ref(false)
const movementDialogVisible = ref(false)
const arqueoDialogVisible = ref(false)
const productDialogVisible = ref(false)
const closeDialogVisible = ref(false)

const openingForm = reactive({
  registerName: 'Caja principal',
  openedBy: 'María López',
  openingFloat: 300,
  note: '',
})

const movementForm = reactive({
  type: 'Ingreso' as MovementType,
  method: 'Efectivo' as PaymentMethod,
  concept: '',
  amount: 0,
  note: '',
})

const movements = ref<CashMovement[]>([
  { id: 1, time: '08:35', concept: 'Venta de mostrador', type: 'Ingreso', method: 'Efectivo', amount: 420 },
  { id: 2, time: '09:10', concept: 'Venta con QR', type: 'Ingreso', method: 'QR', amount: 680 },
  { id: 3, time: '10:25', concept: 'Compra de bolsas', type: 'Egreso', method: 'Efectivo', amount: 45 },
  { id: 4, time: '11:50', concept: 'Venta de mostrador', type: 'Ingreso', method: 'Efectivo', amount: 360 },
  { id: 5, time: '14:15', concept: 'Venta con tarjeta', type: 'Ingreso', method: 'Tarjeta', amount: 520 },
  { id: 6, time: '15:40', concept: 'Retiro para depósito', type: 'Egreso', method: 'Efectivo', amount: 110 },
])

// Ventas por producto del turno (demo: aún no hay módulo de ventas real).
const productSales = ref([
  { name: 'Coca-Cola 2L', qty: 14, total: 168 },
  { name: 'Pan de molde', qty: 9, total: 81 },
  { name: 'Aceite 900 ml', qty: 5, total: 90 },
  { name: 'Arroz 1 kg', qty: 7, total: 70 },
  { name: 'Leche entera 1 L', qty: 6, total: 42 },
])

const movementTypes: MovementType[] = ['Ingreso', 'Egreso']
const paymentMethods: PaymentMethod[] = ['Efectivo', 'QR', 'Tarjeta']

const currentTime = computed(() => {
  const now = new Date()
  return now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
})

const cashIncome = computed(() => movements.value
  .filter((movement) => movement.type === 'Ingreso' && movement.method === 'Efectivo')
  .reduce((sum, movement) => sum + movement.amount, 0))

const cashOutcome = computed(() => movements.value
  .filter((movement) => movement.type === 'Egreso' && movement.method === 'Efectivo')
  .reduce((sum, movement) => sum + movement.amount, 0))

const expectedCash = computed(() => openingFloat.value + cashIncome.value - cashOutcome.value)

const countedDifference = computed(() => Number(countedCash.value || 0) - expectedCash.value)

const totalSales = computed(() => movements.value
  .filter((movement) => movement.type === 'Ingreso')
  .reduce((sum, movement) => sum + movement.amount, 0))

const movementCount = computed(() => movements.value.length)

const depositAmount = computed(() => Math.max(Number(countedCash.value || 0) - Number(desiredFloat.value || 0), 0))

const productUnits = computed(() => productSales.value.reduce((sum, item) => sum + item.qty, 0))
const productTotal = computed(() => productSales.value.reduce((sum, item) => sum + item.total, 0))
const productRanking = computed(() => [...productSales.value].sort((a, b) => b.total - a.total))

const paymentBreakdown = computed(() => paymentMethods.map((method) => {
  const income = movements.value
    .filter((movement) => movement.type === 'Ingreso' && movement.method === method)
    .reduce((sum, movement) => sum + movement.amount, 0)

  return {
    method,
    income,
    count: movements.value.filter((movement) => movement.type === 'Ingreso' && movement.method === method).length,
  }
}))

// Los 4 accesos grandes de la caja (estilo POS profesional).
const cashTools = computed<{ key: string; label: string; desc: string; icon: string; tone: string; action: () => void }[]>(() => [
  { key: 'movimiento', label: 'Registrar movimiento', desc: 'Ingreso o egreso de efectivo', icon: 'pi pi-plus-circle', tone: 'green', action: () => openMovementDialog('Ingreso') },
  { key: 'producto', label: 'Reporte por producto', desc: 'Qué y cuánto se vendió hoy', icon: 'pi pi-box', tone: 'blue', action: () => { productDialogVisible.value = true } },
  { key: 'arqueo', label: 'Arqueo de caja', desc: 'Cuenta el efectivo físico', icon: 'pi pi-calculator', tone: 'amber', action: () => { arqueoDialogVisible.value = true } },
  { key: 'cierre', label: 'Reporte de cierre', desc: 'Cuadra e imprime el turno', icon: 'pi pi-file-check', tone: 'slate', action: () => { closeDialogVisible.value = true } },
])

const closeReportRows = computed(() => [
  { label: 'Fondo inicial', value: money(openingFloat.value) },
  { label: 'Ingresos en efectivo', value: money(cashIncome.value) },
  { label: 'Egresos en efectivo', value: money(cashOutcome.value) },
  { label: 'Efectivo esperado', value: money(expectedCash.value), strong: true },
  { label: 'Efectivo contado', value: money(Number(countedCash.value || 0)), strong: true },
  { label: 'Diferencia', value: money(countedDifference.value), strong: true, tone: differenceTone.value },
  { label: 'Dejar en caja', value: money(Number(desiredFloat.value || 0)) },
  { label: 'Retirar / depositar', value: money(depositAmount.value) },
])

const sessionDuration = computed(() => `${openedAt.value} - ${cashStatus.value === 'cerrada' ? closedAt.value : 'en curso'}`)

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

function resetMovementForm() {
  movementForm.type = 'Ingreso'
  movementForm.method = 'Efectivo'
  movementForm.concept = ''
  movementForm.amount = 0
  movementForm.note = ''
}

function openCashSession() {
  registerName.value = openingForm.registerName.trim() || 'Caja principal'
  openedBy.value = openingForm.openedBy.trim() || 'Responsable de caja'
  openingFloat.value = Number(openingForm.openingFloat || 0)
  countedCash.value = openingFloat.value
  desiredFloat.value = openingFloat.value
  openedAt.value = currentTime.value
  closedAt.value = ''
  closingNote.value = openingForm.note.trim()
  movements.value = []
  cashStatus.value = 'abierta'
  openDialogVisible.value = false
}

function openMovementDialog(type: MovementType) {
  resetMovementForm()
  movementForm.type = type
  movementDialogVisible.value = true
}

function saveMovement() {
  if (!movementForm.concept.trim() || Number(movementForm.amount || 0) <= 0) {
    return
  }

  movements.value.unshift({
    id: Date.now(),
    time: currentTime.value,
    concept: movementForm.concept.trim(),
    type: movementForm.type,
    method: movementForm.method,
    amount: Number(movementForm.amount || 0),
    note: movementForm.note.trim() || undefined,
  })

  movementDialogVisible.value = false
  resetMovementForm()
}

function closeCashSession(printAfterClose = false) {
  cashStatus.value = 'cerrada'
  closedAt.value = currentTime.value
  closeDialogVisible.value = false

  if (printAfterClose) {
    printClosureReport()
  }
}

function reopenForDemo() {
  openingForm.registerName = registerName.value
  openingForm.openedBy = openedBy.value
  openingForm.openingFloat = Number(desiredFloat.value || openingFloat.value || 0)
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

function printClosureReport() {
  if (!import.meta.client) {
    return
  }

  lastPrintedAt.value = currentTime.value

  const rows = closeReportRows.value.map((row) => `
    <tr class="${row.strong ? 'strong' : ''}">
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(row.value)}</td>
    </tr>
  `).join('')

  const payments = paymentBreakdown.value.map((item) => `
    <tr>
      <td>${escapeHtml(item.method)}</td>
      <td>${item.count}</td>
      <td>${escapeHtml(money(item.income))}</td>
    </tr>
  `).join('')

  const activity = movements.value.map((movement) => `
    <tr>
      <td>${escapeHtml(movement.time)}</td>
      <td>${escapeHtml(movement.concept)}</td>
      <td>${escapeHtml(movement.type)}</td>
      <td>${escapeHtml(movement.method)}</td>
      <td>${escapeHtml(`${movementSign(movement.type)} ${money(movement.amount)}`)}</td>
    </tr>
  `).join('')

  const reportWindow = window.open('', 'nexa-cierre-caja', 'width=820,height=900')

  if (!reportWindow) {
    window.print()
    return
  }

  reportWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Reporte de cierre de caja - NEXA</title>
        <style>
          body { margin: 0; padding: 28px; color: #111827; font-family: Arial, sans-serif; }
          header { border-bottom: 2px solid #0B1F3A; padding-bottom: 14px; margin-bottom: 18px; }
          h1 { margin: 0; color: #0B1F3A; font-size: 22px; }
          p { margin: 4px 0; color: #4b5563; font-size: 12px; }
          section { margin-top: 18px; }
          h2 { margin: 0 0 8px; color: #0B1F3A; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          td, th { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
          td:last-child, th:last-child { text-align: right; }
          .strong td { font-weight: 700; background: #f8fafc; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 42px; }
          .signature { border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
          @media print { body { padding: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <h1>NEXA - Reporte de cierre de caja</h1>
          <p>${escapeHtml(registerName.value)} · Responsable: ${escapeHtml(openedBy.value)}</p>
          <p>Turno: ${escapeHtml(sessionDuration.value)} · Impreso: ${escapeHtml(lastPrintedAt.value)}</p>
        </header>

        <section>
          <h2>Arqueo</h2>
          <table><tbody>${rows}</tbody></table>
        </section>

        <section>
          <h2>Ventas por método de pago</h2>
          <table>
            <thead><tr><th>Método</th><th>Operaciones</th><th>Total</th></tr></thead>
            <tbody>${payments}</tbody>
          </table>
        </section>

        <section>
          <h2>Movimientos del turno</h2>
          <table>
            <thead><tr><th>Hora</th><th>Concepto</th><th>Tipo</th><th>Método</th><th>Monto</th></tr></thead>
            <tbody>${activity}</tbody>
          </table>
        </section>

        <section>
          <h2>Observación</h2>
          <p>${escapeHtml(closingNote.value || 'Sin observaciones.')}</p>
        </section>

        <div class="signatures">
          <div class="signature">Responsable de caja</div>
          <div class="signature">Supervisor / propietario</div>
        </div>

        <script>window.addEventListener("load", () => setTimeout(() => window.print(), 120))<\\/script>
      </body>
    </html>
  `)
  reportWindow.document.close()
}

function printProductReport() {
  if (!import.meta.client) {
    return
  }

  const rows = productRanking.value.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.qty}</td>
      <td>${escapeHtml(money(item.total))}</td>
    </tr>
  `).join('')

  const reportWindow = window.open('', 'nexa-reporte-productos', 'width=720,height=900')

  if (!reportWindow) {
    window.print()
    return
  }

  reportWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Reporte por producto - NEXA</title>
        <style>
          body { margin: 0; padding: 28px; color: #111827; font-family: Arial, sans-serif; }
          header { border-bottom: 2px solid #0B1F3A; padding-bottom: 14px; margin-bottom: 18px; }
          h1 { margin: 0; color: #0B1F3A; font-size: 22px; }
          p { margin: 4px 0; color: #4b5563; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
          td, th { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
          td:nth-child(2), th:nth-child(2), td:last-child, th:last-child { text-align: right; }
          tfoot td { font-weight: 700; background: #f8fafc; }
          @media print { body { padding: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <h1>NEXA - Reporte por producto</h1>
          <p>${escapeHtml(registerName.value)} · Turno: ${escapeHtml(sessionDuration.value)}</p>
        </header>
        <table>
          <thead><tr><th>Producto</th><th>Unidades</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td>Total</td><td>${productUnits.value}</td><td>${escapeHtml(money(productTotal.value))}</td></tr>
          </tfoot>
        </table>
        <script>window.addEventListener("load", () => setTimeout(() => window.print(), 120))<\\/script>
      </body>
    </html>
  `)
  reportWindow.document.close()
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
          <span><em>Efectivo esperado</em>{{ money(expectedCash) }}</span>
          <span><em>Movimientos</em>{{ movementCount }}</span>
        </div>
      </div>

      <Button
        v-if="cashStatus === 'cerrada'"
        type="button"
        icon="pi pi-unlock"
        label="Abrir caja"
        severity="success"
        class="cash-open-btn"
        @click="reopenForDemo"
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
        <span class="cash-tool__icon"><i :class="tool.icon" aria-hidden="true" /></span>
        <strong>{{ tool.label }}</strong>
        <small>{{ tool.desc }}</small>
      </button>
    </section>

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
          severity="success"
          :disabled="cashStatus === 'cerrada'"
          @click="openMovementDialog('Ingreso')"
        />
      </header>

      <ul class="move-list">
        <li v-for="movement in movements" :key="movement.id">
          <span class="move-time">{{ movement.time }}</span>
          <span class="move-main">
            <strong>{{ movement.concept }}</strong>
            <small>{{ movement.method }}</small>
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
          <Button type="submit" label="Abrir caja" icon="pi pi-unlock" severity="success" />
        </footer>
      </form>
    </Dialog>

    <!-- Diálogo: registrar movimiento -->
    <Dialog v-model:visible="movementDialogVisible" modal header="Registrar movimiento" class="cash-dialog">
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
          Este movimiento aparecerá en el reporte, pero no cambia el efectivo físico esperado.
        </Message>

        <footer>
          <Button type="button" label="Cancelar" outlined severity="secondary" @click="movementDialogVisible = false" />
          <Button type="submit" label="Guardar movimiento" icon="pi pi-check" :disabled="!movementForm.concept.trim() || Number(movementForm.amount || 0) <= 0" />
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
          <div><span>Efectivo esperado</span><strong>{{ money(expectedCash) }}</strong></div>
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
        <Button type="button" label="Continuar al cierre" icon="pi pi-arrow-right" severity="danger" :disabled="cashStatus === 'cerrada'" @click="arqueoDialogVisible = false; closeDialogVisible = true" />
      </template>
    </Dialog>

    <!-- Diálogo: reporte de cierre -->
    <Dialog v-model:visible="closeDialogVisible" modal header="Reporte de cierre de caja" class="cash-dialog close-dialog">
      <div class="close-content">
        <Message severity="warn" icon="pi pi-exclamation-triangle">
          Al cerrar, el turno queda finalizado para revisión. Revisa el efectivo contado antes de imprimir.
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
            <span>Observación del cierre</span>
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
        <Button type="button" label="Solo cerrar" severity="danger" outlined @click="closeCashSession(false)" />
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
  width: 48px;
  height: 48px;
  border-radius: 14px;
  font-size: 1.35rem;
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
    font-size: 1.2rem;
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
