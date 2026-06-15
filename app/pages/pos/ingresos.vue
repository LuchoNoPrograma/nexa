<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Ingresos',
  alias: ['/pos/finanzas/ingresos'],
})

useHead({
  title: 'Ingresos | NEXA',
})

type PeriodKey = 'today' | 'week' | 'month'
type Tone = 'green' | 'blue' | 'gold' | 'orange'
type PaymentMethod = 'Efectivo' | 'QR'

interface MetricCard {
  label: string
  value: string
  meta: string
  icon: string
  tone: Tone
}

interface SaleRow {
  time: string
  product: string
  category: string
  qty: number
  unitPrice: number
  total: number
  method: PaymentMethod
}

interface TrendRow {
  label: string
  range: string
  sales: number
  target?: number
  transactions: number
}

interface MonthComparisonRow {
  label: string
  sales: number
  target: number
}

const periodOptions = [
  { label: 'Hoy', value: 'today' },
  { label: 'Semana', value: 'week' },
  { label: 'Mes', value: 'month' },
]

const activePeriod = ref<PeriodKey>('today')
const searchTerm = ref('')
const exportDialogVisible = ref(false)

const todaySales: SaleRow[] = [
  { time: '09:15', product: 'Cono Soft', category: 'Helados', qty: 3, unitPrice: 7, total: 21, method: 'Efectivo' },
  { time: '10:30', product: 'Bowl Açaí', category: 'Bebidas', qty: 2, unitPrice: 35, total: 70, method: 'QR' },
  { time: '11:20', product: 'Batido Açaí', category: 'Bebidas', qty: 1, unitPrice: 16, total: 16, method: 'Efectivo' },
  { time: '12:10', product: 'Cono Soft', category: 'Helados', qty: 2, unitPrice: 7, total: 14, method: 'Efectivo' },
  { time: '13:45', product: 'Café Frío', category: 'Bebidas', qty: 1, unitPrice: 12, total: 12, method: 'QR' },
  { time: '15:30', product: 'Bowl Açaí', category: 'Bebidas', qty: 2, unitPrice: 35, total: 70, method: 'Efectivo' },
  { time: '16:15', product: 'Cono Soft', category: 'Helados', qty: 4, unitPrice: 7, total: 28, method: 'Efectivo' },
  { time: '17:20', product: 'Batido Açaí', category: 'Bebidas', qty: 1, unitPrice: 16, total: 16, method: 'QR' },
]

const weekRows: TrendRow[] = [
  { label: 'Lunes', range: '20 Mayo', sales: 310, target: 340, transactions: 9 },
  { label: 'Martes', range: '21 Mayo', sales: 420, target: 340, transactions: 12 },
  { label: 'Miércoles', range: '22 Mayo', sales: 360, target: 340, transactions: 11 },
  { label: 'Jueves', range: '23 Mayo', sales: 510, target: 340, transactions: 15 },
  { label: 'Viernes', range: '24 Mayo', sales: 620, target: 340, transactions: 18 },
  { label: 'Sábado', range: '25 Mayo', sales: 180, target: 340, transactions: 6 },
  { label: 'Domingo', range: '26 Mayo', sales: 50, target: 340, transactions: 2 },
]

const monthRows: TrendRow[] = [
  { label: 'Semana 1', range: '1 - 7 Mayo', sales: 1850, target: 2200, transactions: 55 },
  { label: 'Semana 2', range: '8 - 14 Mayo', sales: 2120, target: 2200, transactions: 63 },
  { label: 'Semana 3', range: '15 - 21 Mayo', sales: 1980, target: 2200, transactions: 59 },
  { label: 'Semana 4', range: '22 - 31 Mayo', sales: 2450, target: 2200, transactions: 73 },
]

const monthlyComparisonRows: MonthComparisonRow[] = [
  { label: 'Ene', sales: 6200, target: 8000 },
  { label: 'Feb', sales: 7100, target: 8000 },
  { label: 'Mar', sales: 6900, target: 8000 },
  { label: 'Abr', sales: 7190, target: 8000 },
  { label: 'Mayo', sales: 8400, target: 8000 },
]

const periodCopy = {
  today: {
    title: 'Ingresos',
    subtitle: 'Ventas realizadas hoy · Martes, 20 de mayo de 2026',
    panelTitle: 'Ventas realizadas hoy',
    sideTitle: 'Resumen del día',
    comparisonTitle: 'Comparación con ayer',
    advice: [
      'Las ventas de hoy están 14.6% arriba de ayer.',
      'Bowl Açaí concentra la mayor venta; conviene mantenerlo visible en el mostrador.',
    ],
  },
  week: {
    title: 'Ingresos',
    subtitle: 'Semana actual · 20 al 26 de mayo de 2026',
    panelTitle: 'Ingresos por día',
    sideTitle: 'Resumen semanal',
    comparisonTitle: 'Comparación con semana anterior',
    advice: [
      'Viernes es el día más fuerte de la semana.',
      'Sábado y domingo están bajos; una promoción simple puede recuperar tráfico.',
    ],
  },
  month: {
    title: 'Ingresos',
    subtitle: 'Mes actual · Mayo 2026',
    panelTitle: 'Ingresos por semana',
    sideTitle: 'Resumen mensual',
    comparisonTitle: 'Comparación con mes anterior',
    advice: [
      'La Semana 4 superó la meta y explica buena parte del crecimiento mensual.',
      'Mantén el seguimiento semanal; es más accionable que mirar solo el total del mes.',
    ],
  },
} satisfies Record<PeriodKey, {
  title: string
  subtitle: string
  panelTitle: string
  sideTitle: string
  comparisonTitle: string
  advice: string[]
}>

const currentCopy = computed(() => periodCopy[activePeriod.value])
const trendRows = computed(() => activePeriod.value === 'month' ? monthRows : weekRows)
const maxTrendValue = computed(() => Math.max(...trendRows.value.map((row) => row.sales), 1))
const trendTotal = computed(() => trendRows.value.reduce((sum, row) => sum + row.sales, 0))
const trendTransactions = computed(() => trendRows.value.reduce((sum, row) => sum + row.transactions, 0))
const trendAverageTicket = computed(() => trendTotal.value / Math.max(trendTransactions.value, 1))
const bestTrendRow = computed(() => trendRows.value.reduce((best, row) => row.sales > best.sales ? row : best, trendRows.value[0]))
const bestMonthRow = computed(() => monthlyComparisonRows.reduce((best, row) => row.sales > best.sales ? row : best, monthlyComparisonRows[0]))
const maxMonthlyComparisonValue = computed(() => Math.max(...monthlyComparisonRows.map((row) => row.sales), 1))
const currentMonthComparison = computed(() => monthlyComparisonRows[monthlyComparisonRows.length - 1])
const previousMonthComparison = computed(() => monthlyComparisonRows[monthlyComparisonRows.length - 2])
const currentMonthVariation = computed(() => {
  const previous = previousMonthComparison.value?.sales || 0

  if (previous === 0) {
    return 0
  }

  return ((currentMonthComparison.value.sales - previous) / previous) * 100
})
const monthsOverTarget = computed(() => monthlyComparisonRows.filter((row) => row.sales >= row.target).length)

const todayTotal = computed(() => todaySales.reduce((sum, row) => sum + row.total, 0))
const todayTransactions = computed(() => todaySales.reduce((sum, row) => sum + row.qty, 0))
const todayAverageTicket = computed(() => todayTotal.value / Math.max(todayTransactions.value, 1))

const metrics = computed<MetricCard[]>(() => {
  if (activePeriod.value === 'today') {
    return [
      { label: 'Total vendido', value: money(todayTotal.value), meta: '+14.6% vs. ayer', icon: 'pi pi-wallet', tone: 'green' },
      { label: 'Número de ventas', value: String(todayTransactions.value), meta: '3 más que ayer', icon: 'pi pi-receipt', tone: 'blue' },
      { label: 'Ticket promedio', value: money(todayAverageTicket.value), meta: '+12.3% vs. ayer', icon: 'pi pi-chart-bar', tone: 'gold' },
      { label: 'Producto más vendido', value: 'Bowl Açaí', meta: '4 unidades vendidas', icon: 'pi pi-star', tone: 'orange' },
    ]
  }

  if (activePeriod.value === 'week') {
    return [
      { label: 'Total semanal', value: money(trendTotal.value), meta: '+8.2% vs. semana anterior', icon: 'pi pi-wallet', tone: 'green' },
      { label: 'Ventas registradas', value: String(trendTransactions.value), meta: 'Promedio diario: 10', icon: 'pi pi-receipt', tone: 'blue' },
      { label: 'Ticket promedio', value: money(trendAverageTicket.value), meta: 'Calculado por venta', icon: 'pi pi-chart-bar', tone: 'gold' },
      { label: 'Mejor día', value: bestTrendRow.value.label, meta: money(bestTrendRow.value.sales), icon: 'pi pi-calendar-plus', tone: 'orange' },
    ]
  }

  return [
    { label: 'Total mensual', value: money(trendTotal.value), meta: '+16.8% vs. mes anterior', icon: 'pi pi-wallet', tone: 'green' },
    { label: 'Ventas registradas', value: String(trendTransactions.value), meta: 'Acumulado del mes', icon: 'pi pi-receipt', tone: 'blue' },
    { label: 'Ticket promedio', value: money(trendAverageTicket.value), meta: 'Promedio del mes', icon: 'pi pi-chart-bar', tone: 'gold' },
    { label: 'Mejor mes reciente', value: bestMonthRow.value.label, meta: money(bestMonthRow.value.sales), icon: 'pi pi-trophy', tone: 'orange' },
  ]
})

const visibleSales = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  if (!term) {
    return todaySales
  }

  return todaySales.filter((row) => [
    row.time,
    row.product,
    row.category,
    row.method,
  ].some((value) => value.toLowerCase().includes(term)))
})

const paymentSummary = computed(() => {
  const methods: PaymentMethod[] = ['Efectivo', 'QR']
  return methods.map((method) => {
    const total = todaySales
      .filter((row) => row.method === method)
      .reduce((sum, row) => sum + row.total, 0)

    return {
      method,
      total,
      percent: todayTotal.value === 0 ? 0 : Math.round((total / todayTotal.value) * 100),
    }
  })
})

const sideSummary = computed(() => {
  if (activePeriod.value === 'today') {
    return [
      { label: 'Hora de mayor venta', value: '15:00 - 17:00', icon: 'pi pi-clock', tone: 'green' },
      ...paymentSummary.value.map((item) => ({
        label: `Ventas con ${item.method}`,
        value: `${money(item.total)} (${item.percent}%)`,
        icon: item.method === 'Efectivo' ? 'pi pi-money-bill' : 'pi pi-qrcode',
        tone: item.method === 'Efectivo' ? 'green' : 'blue',
      })),
    ]
  }

  return [
    { label: activePeriod.value === 'week' ? 'Mejor día' : 'Mejor semana', value: `${bestTrendRow.value.label} · ${money(bestTrendRow.value.sales)}`, icon: 'pi pi-star', tone: 'green' },
    { label: 'Promedio por periodo', value: money(trendTotal.value / trendRows.value.length), icon: 'pi pi-chart-line', tone: 'blue' },
    { label: 'Meta de referencia', value: activePeriod.value === 'week' ? 'Bs. 340 por día' : 'Bs. 8,000 por mes', icon: 'pi pi-bullseye', tone: 'gold' },
  ]
})

const comparisons = computed(() => {
  if (activePeriod.value === 'today') {
    return [
      { label: 'Total vendido', value: '+ Bs. 74.00', percent: '+14.6%' },
      { label: 'Número de ventas', value: '+ 3', percent: '+20%' },
      { label: 'Ticket promedio', value: '+ Bs. 3.52', percent: '+12.3%' },
    ]
  }

  if (activePeriod.value === 'week') {
    return [
      { label: 'Total semanal', value: '+ Bs. 185.00', percent: '+8.2%' },
      { label: 'Ventas registradas', value: '+ 6', percent: '+9.0%' },
      { label: 'Promedio diario', value: '+ Bs. 26.40', percent: '+8.2%' },
    ]
  }

  return [
    { label: 'Total vs. abril', value: '+ Bs. 1,210.00', percent: '+16.8%' },
    { label: 'Ventas registradas', value: '+ 18', percent: '+7.7%' },
    { label: 'Meses sobre meta', value: `${monthsOverTarget.value} de ${monthlyComparisonRows.length}`, percent: `${Math.round((monthsOverTarget.value / monthlyComparisonRows.length) * 100)}%` },
  ]
})

function money(value: number) {
  return `Bs. ${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`
}

function targetPercent(row: TrendRow) {
  return Math.round((row.sales / Math.max(row.target || row.sales, 1)) * 100)
}

function exportReport(format: 'PDF' | 'Excel' | 'Imprimir') {
  exportDialogVisible.value = false

  if (format === 'Imprimir' && import.meta.client) {
    window.print()
  }
}
</script>

<template>
  <div class="income-page">
    <section class="income-heading">
      <div class="income-heading__title">
        <span class="heading-icon"><i class="pi pi-dollar" aria-hidden="true" /></span>
        <div>
          <h2>{{ currentCopy.title }}</h2>
          <p>{{ currentCopy.subtitle }}</p>
        </div>
      </div>

      <div class="income-heading__tools">
        <IconField class="income-search">
          <InputIcon>
            <i class="pi pi-search" />
          </InputIcon>
          <InputText v-model="searchTerm" placeholder="Buscar venta, producto o método..." />
        </IconField>

        <Button type="button" icon="pi pi-download" label="Exportar reporte" outlined severity="success" @click="exportDialogVisible = true" />
      </div>
    </section>

    <section class="period-switch" aria-label="Periodo de ingresos">
      <SelectButton v-model="activePeriod" :options="periodOptions" option-label="label" option-value="value" />
      <small>La estructura se mantiene igual; solo cambia el nivel de detalle.</small>
    </section>

    <section class="income-metrics" aria-label="Resumen de ingresos">
      <article v-for="card in metrics" :key="card.label" class="income-metric">
        <span class="income-metric__icon" :class="`is-${card.tone}`">
          <i :class="card.icon" aria-hidden="true" />
        </span>
        <div>
          <small>{{ card.label }}</small>
          <strong>{{ card.value }}</strong>
          <em>{{ card.meta }}</em>
        </div>
      </article>
    </section>

    <section class="income-grid">
      <article class="income-panel main-panel">
        <header class="panel-head">
          <div>
            <span>{{ activePeriod === 'today' ? 'Detalle operativo' : 'Tendencia' }}</span>
            <h2>{{ currentCopy.panelTitle }}</h2>
          </div>
          <Tag :value="activePeriod === 'today' ? 'Hoy' : activePeriod === 'week' ? 'Semana' : 'Mes'" severity="success" />
        </header>

        <DataTable v-if="activePeriod === 'today'" :value="visibleSales" size="small" class="income-table">
          <Column field="time" header="Hora" />
          <Column field="product" header="Producto / Servicio" />
          <Column field="category" header="Categoría" />
          <Column field="qty" header="Cantidad" />
          <Column header="Precio unitario">
            <template #body="{ data }">{{ money(data.unitPrice) }}</template>
          </Column>
          <Column header="Total">
            <template #body="{ data }">
              <strong>{{ money(data.total) }}</strong>
            </template>
          </Column>
          <Column header="Método">
            <template #body="{ data }">
              <span class="payment-method">
                <i :class="data.method === 'Efectivo' ? 'pi pi-money-bill' : data.method === 'QR' ? 'pi pi-qrcode' : 'pi pi-credit-card'" aria-hidden="true" />
                {{ data.method }}
              </span>
            </template>
          </Column>
        </DataTable>

        <div v-else class="trend-layout">
          <div class="trend-chart" aria-label="Gráfico de ingresos del periodo">
            <article v-for="row in trendRows" :key="row.label" class="trend-bar">
              <span>{{ money(row.sales) }}</span>
              <div>
                <b :style="{ height: `${Math.max((row.sales / maxTrendValue) * 100, 8)}%` }" />
              </div>
              <strong>{{ row.label }}</strong>
              <small>{{ row.range }}</small>
            </article>
          </div>

          <DataTable :value="trendRows" size="small" class="income-table trend-table">
            <Column field="label" :header="activePeriod === 'week' ? 'Día' : 'Semana'" />
            <Column field="range" header="Periodo" />
            <Column header="Ingresos">
              <template #body="{ data }">
                <strong>{{ money(data.sales) }}</strong>
              </template>
            </Column>
            <Column header="Meta">
              <template #body="{ data }">{{ money(data.target || 0) }}</template>
            </Column>
            <Column header="Cumplimiento">
              <template #body="{ data }">
                <span class="target-pill" :class="{ 'is-ok': targetPercent(data) >= 100 }">{{ targetPercent(data) }}%</span>
              </template>
            </Column>
          </DataTable>

          <section v-if="activePeriod === 'month'" class="month-comparison" aria-label="Comparativa mensual">
            <header>
              <div>
                <span>Comparativa mensual</span>
                <h3>Últimos 5 meses</h3>
              </div>
              <strong>
                <i class="pi pi-arrow-up" aria-hidden="true" />
                {{ currentMonthVariation.toFixed(1) }}% vs. {{ previousMonthComparison.label }}
              </strong>
            </header>

            <div class="month-bars">
              <article v-for="row in monthlyComparisonRows" :key="row.label" class="month-bar" :class="{ 'is-current': row.label === currentMonthComparison.label }">
                <span>{{ money(row.sales) }}</span>
                <div>
                  <b :style="{ height: `${Math.max((row.sales / maxMonthlyComparisonValue) * 100, 8)}%` }" />
                  <i :style="{ bottom: `${Math.min((row.target / maxMonthlyComparisonValue) * 100, 100)}%` }" />
                </div>
                <strong>{{ row.label }}</strong>
              </article>
            </div>

            <footer>
              <span><b /> Ingresos reales</span>
              <span><i /> Meta mensual</span>
              <em>Mejor mes: {{ bestMonthRow.label }} · {{ money(bestMonthRow.sales) }}</em>
            </footer>
          </section>
        </div>
      </article>

      <aside class="income-side">
        <article class="income-panel side-panel">
          <header class="panel-head">
            <div>
              <span>Lectura rápida</span>
              <h2>{{ currentCopy.sideTitle }}</h2>
            </div>
          </header>

          <div class="side-list">
            <div v-for="item in sideSummary" :key="item.label">
              <span :class="`is-${item.tone}`"><i :class="item.icon" aria-hidden="true" /></span>
              <div>
                <small>{{ item.label }}</small>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
        </article>

        <article class="income-panel side-panel">
          <header class="panel-head">
            <div>
              <span>Contexto</span>
              <h2>{{ currentCopy.comparisonTitle }}</h2>
            </div>
          </header>

          <div class="comparison-list">
            <div v-for="item in comparisons" :key="item.label">
              <span>{{ item.label }}</span>
              <strong><i class="pi pi-arrow-up" aria-hidden="true" /> {{ item.value }} <small>{{ item.percent }}</small></strong>
            </div>
          </div>
        </article>
      </aside>
    </section>

    <section class="ai-advice">
      <span class="ai-advice__icon"><i class="pi pi-lightbulb" aria-hidden="true" /></span>
      <div>
        <h2>Consejo IA</h2>
        <p v-for="line in currentCopy.advice" :key="line">{{ line }}</p>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true">
    </section>

    <Dialog v-model:visible="exportDialogVisible" modal header="Exportar reporte" class="export-dialog">
      <div class="export-options">
        <button type="button" @click="exportReport('PDF')">
          <i class="pi pi-file-pdf" aria-hidden="true" />
          <span>
            <strong>PDF</strong>
            <small>Ideal para imprimir o compartir.</small>
          </span>
        </button>
        <button type="button" @click="exportReport('Excel')">
          <i class="pi pi-file-excel" aria-hidden="true" />
          <span>
            <strong>Excel</strong>
            <small>Para revisar datos y cálculos.</small>
          </span>
        </button>
        <button type="button" @click="exportReport('Imprimir')">
          <i class="pi pi-print" aria-hidden="true" />
          <span>
            <strong>Imprimir</strong>
            <small>Enviar el reporte actual a impresora.</small>
          </span>
        </button>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.income-page {
  display: grid;
  gap: 14px;
  padding: 12px 0 0;
  color: #111827;
}

.income-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.income-heading__title {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.heading-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: #e7f6ea;
  color: #0f9e2e;
  font-size: 1.3rem;
}

.income-heading h2 {
  margin: 0;
  color: #101827;
  font-size: 1.55rem;
  font-weight: 900;
}

.income-heading p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.84rem;
  font-weight: 700;
}

.income-heading__tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.income-search {
  width: 270px;
}

.income-search :deep(.p-inputtext) {
  width: 100%;
  border-radius: 999px;
}

.period-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: #ffffff;
}

.period-switch small {
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 800;
}

.period-switch :deep(.p-selectbutton) {
  flex-wrap: wrap;
}

.income-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.income-metric,
.income-panel,
.ai-advice {
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.income-metric {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 110px;
  padding: 16px;
}

.income-metric__icon,
.side-list > div > span,
.ai-advice__icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  font-size: 1.18rem;
}

.income-metric__icon.is-green,
.side-list .is-green,
.ai-advice__icon {
  background: #e8f7eb;
  color: #0f9e2e;
}

.income-metric__icon.is-blue,
.side-list .is-blue {
  background: #eaf3ff;
  color: #2f7ded;
}

.income-metric__icon.is-gold,
.side-list .is-gold {
  background: #fff8d8;
  color: #9a6b00;
}

.income-metric__icon.is-orange {
  background: #fff0e8;
  color: #ff6b2c;
}

.income-metric small,
.side-list small,
.panel-head span {
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 800;
}

.income-metric strong {
  display: block;
  margin-top: 6px;
  color: #111827;
  font-size: 1.12rem;
  font-weight: 900;
}

.income-metric em {
  display: block;
  margin-top: 8px;
  color: #0f9e2e;
  font-size: 0.74rem;
  font-style: normal;
  font-weight: 900;
}

.income-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}

.income-panel {
  min-width: 0;
  overflow: hidden;
}

.main-panel,
.side-panel {
  padding: 16px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-head h2 {
  margin: 2px 0 0;
  color: #111827;
  font-size: 0.98rem;
  font-weight: 900;
}

.income-table :deep(.p-datatable-header-cell),
.income-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.68rem 0.55rem;
  border-color: #edf1f5;
  background: transparent;
  color: #172033;
  font-size: 0.78rem;
}

.income-table :deep(.p-datatable-header-cell) {
  color: #334155;
  font-weight: 900;
}

.payment-method {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.payment-method i {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  background: #edf8ef;
  color: #0f9e2e;
  font-size: 0.72rem;
}

.trend-layout {
  display: grid;
  gap: 16px;
}

.trend-chart {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 12px;
  min-height: 260px;
  padding: 12px 8px 2px;
  border-bottom: 1px solid #edf1f5;
}

.trend-bar {
  display: grid;
  grid-template-rows: auto 150px auto auto;
  gap: 7px;
  align-items: end;
  min-width: 0;
  text-align: center;
}

.trend-bar span {
  color: #0f172a;
  font-size: 0.72rem;
  font-weight: 900;
}

.trend-bar div {
  display: flex;
  align-items: end;
  justify-content: center;
  height: 150px;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.trend-bar b {
  width: min(52px, 68%);
  min-height: 12px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #12a83a, #047021);
  box-shadow: 0 10px 18px rgba(15, 158, 46, 0.18);
}

.trend-bar strong {
  overflow-wrap: anywhere;
  color: #172033;
  font-size: 0.75rem;
  font-weight: 900;
}

.trend-bar small {
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 800;
}

.target-pill {
  display: inline-flex;
  min-width: 48px;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 999px;
  background: #fff8d8;
  color: #9a6b00;
  font-size: 0.72rem;
  font-weight: 900;
}

.target-pill.is-ok {
  background: #e8f7eb;
  color: #0f9e2e;
}

.month-comparison {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: #fbfdfb;
}

.month-comparison header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.month-comparison header span {
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 800;
}

.month-comparison h3 {
  margin: 2px 0 0;
  color: #111827;
  font-size: 0.92rem;
  font-weight: 900;
}

.month-comparison header > strong {
  color: #0f9e2e;
  font-size: 0.82rem;
  font-weight: 900;
  white-space: nowrap;
}

.month-bars {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  min-height: 170px;
}

.month-bar {
  display: grid;
  grid-template-rows: auto 112px auto;
  gap: 6px;
  align-items: end;
  min-width: 0;
  text-align: center;
}

.month-bar > span {
  color: #334155;
  font-size: 0.68rem;
  font-weight: 900;
}

.month-bar > div {
  position: relative;
  display: flex;
  align-items: end;
  justify-content: center;
  height: 112px;
  overflow: hidden;
  border-radius: 7px;
  background: #f1f5f9;
}

.month-bar b {
  width: min(44px, 62%);
  min-height: 10px;
  border-radius: 7px 7px 0 0;
  background: linear-gradient(180deg, #2bbf55, #08742a);
}

.month-bar i {
  position: absolute;
  right: 10%;
  left: 10%;
  height: 0;
  border-top: 1px dashed #f59e0b;
}

.month-bar strong {
  color: #334155;
  font-size: 0.72rem;
  font-weight: 900;
}

.month-bar.is-current > span,
.month-bar.is-current strong {
  color: #0f9e2e;
}

.month-comparison footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
}

.month-comparison footer span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.month-comparison footer b,
.month-comparison footer i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.month-comparison footer b {
  background: #0f9e2e;
}

.month-comparison footer i {
  border: 1px dashed #f59e0b;
}

.month-comparison footer em {
  margin-left: auto;
  color: #0f172a;
  font-style: normal;
}

.income-side {
  display: grid;
  gap: 14px;
}

.side-list {
  display: grid;
}

.side-list > div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 13px 0;
  border-top: 1px solid #edf1f5;
}

.side-list strong {
  display: block;
  margin-top: 3px;
  font-size: 0.84rem;
  font-weight: 900;
}

.comparison-list {
  display: grid;
  gap: 14px;
  padding-top: 6px;
}

.comparison-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #334155;
  font-size: 0.82rem;
  font-weight: 800;
}

.comparison-list strong {
  color: #0f9e2e;
  white-space: nowrap;
}

.comparison-list small {
  margin-left: 4px;
  color: #0f9e2e;
  font-size: 0.72rem;
}

.ai-advice {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr 124px;
  gap: 16px;
  align-items: center;
  overflow: hidden;
  padding: 16px 20px;
  border-color: rgba(15, 158, 46, 0.3);
  background:
    linear-gradient(90deg, #ffffff 0%, #f7fff8 68%, #eef9ec 100%);
}

.ai-advice h2 {
  margin: 0 0 8px;
  color: #111827;
  font-size: 0.95rem;
  font-weight: 900;
}

.ai-advice p {
  margin: 3px 0;
  color: #253044;
  font-size: 0.84rem;
  font-weight: 700;
}

.ai-advice img {
  justify-self: end;
  width: 112px;
  transform: translateY(8px);
  filter: drop-shadow(0 18px 22px rgba(15, 23, 42, 0.16));
}

.export-dialog {
  width: min(420px, calc(100vw - 24px));
}

.export-options {
  display: grid;
  gap: 8px;
}

.export-options button {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 12px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  text-align: left;
  cursor: pointer;
}

.export-options button:hover {
  border-color: #b7e3c1;
  background: #f8fff9;
}

.export-options i {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 9px;
  background: #e8f7eb;
  color: #0f9e2e;
}

.export-options strong,
.export-options small {
  display: block;
}

.export-options strong {
  font-size: 0.86rem;
  font-weight: 900;
}

.export-options small {
  margin-top: 2px;
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 700;
}

@media (max-width: 1320px) {
  .income-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .income-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .income-heading,
  .income-heading__tools,
  .period-switch {
    align-items: stretch;
    flex-direction: column;
  }

  .income-heading__tools,
  .income-search {
    width: 100%;
  }

  .income-metrics,
  .ai-advice {
    grid-template-columns: 1fr;
  }

  .main-panel,
  .side-panel {
    padding: 12px;
  }

  .trend-chart {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .month-bars {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .month-comparison header,
  .month-comparison footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .month-comparison footer em {
    margin-left: 0;
  }

  .ai-advice img {
    justify-self: start;
  }
}
</style>
