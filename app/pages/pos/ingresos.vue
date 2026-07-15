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
type PaymentMethod = 'Efectivo' | 'QR' | 'Transferencia' | 'Mixto'

interface MetricCard {
  label: string
  value: string
  meta: string
  icon: string
  tone: Tone
}

interface SaleRow {
  movementId: string | null
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
  transactions: number
}

interface MonthComparisonRow {
  label: string
  sales: number
}

// Respuesta real de /api/pos/ingresos (datos del negocio, sin metas inventadas).
type IngresosResponse = {
  ventas: SaleRow[]
  semana: TrendRow[]
  semanas: TrendRow[]
  meses: MonthComparisonRow[]
  topProducto: { name: string, qty: number } | null
  resumenHoy: {
    totalIngresos: number
    totalVentas: number
    otrosIngresos: number
    ventas: number
    movimientos: number
  }
  comparativas: {
    hoyVsAyer: number | null
    semanaVsAnterior: number | null
    mesVsAnterior: number | null
  }
}

const periodOptions = [
  { label: 'Día', value: 'today' },
  { label: 'Semana', value: 'week' },
  { label: 'Mes', value: 'month' },
]

const activePeriod = ref<PeriodKey>('today')
const searchTerm = ref('')
const session = usePosSession()
const cashMovementVoidDialog = useCashMovementVoidDialog()
const voidingMovementId = ref('')
const canVoidMovements = computed(() => session.value?.roles.includes('propietario') ?? false)

// Datos REALES del negocio. Una sola lectura: el usuario alterna Día/Semana/Mes
// sin volver a pedir al servidor (todo viene en la misma respuesta).
const { data, refresh } = await useFetch<IngresosResponse>('/api/pos/ingresos', {
  default: () => ({
    ventas: [],
    semana: [],
    semanas: [],
    meses: [],
    topProducto: null,
    resumenHoy: { totalIngresos: 0, totalVentas: 0, otrosIngresos: 0, ventas: 0, movimientos: 0 },
    comparativas: { hoyVsAyer: null, semanaVsAnterior: null, mesVsAnterior: null },
  }),
})

const todaySales = computed<SaleRow[]>(() => data.value?.ventas ?? [])
const weekRows = computed<TrendRow[]>(() => data.value?.semana ?? [])
const monthRows = computed<TrendRow[]>(() => data.value?.semanas ?? [])
const monthlyComparisonRows = computed<MonthComparisonRow[]>(() => data.value?.meses ?? [])

function money(value: number) {
  return `Bs. ${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`
}

// Texto de variación honesto: "+X% vs. ayer" o aviso cuando no hay base previa.
function variacionTexto(pct: number | null, sufijo: string) {
  if (pct === null) {
    return `Sin ${sufijo} para comparar`
  }
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs. ${sufijo}`
}

// Fechas reales para el subtítulo (no fijas).
const hoyTexto = computed(() => new Intl.DateTimeFormat('es-BO', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/La_Paz',
}).format(new Date()))
const mesTexto = computed(() => {
  const t = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric', timeZone: 'America/La_Paz' }).format(new Date())
  return t.charAt(0).toUpperCase() + t.slice(1)
})

const currentCopy = computed(() => {
  if (activePeriod.value === 'today') {
    return { title: 'Ingresos', subtitle: `Día calendario · ${hoyTexto.value} · incluye todos los turnos`, panelTitle: 'Movimientos del día' }
  }
  if (activePeriod.value === 'week') {
    return { title: 'Ingresos', subtitle: 'Semana actual', panelTitle: 'Ingresos por día' }
  }
  return { title: 'Ingresos', subtitle: `Mes actual · ${mesTexto.value}`, panelTitle: 'Ingresos por semana' }
})

const trendRows = computed(() => activePeriod.value === 'month' ? monthRows.value : weekRows.value)
const maxTrendValue = computed(() => Math.max(...trendRows.value.map((row) => row.sales), 1))
const trendTotal = computed(() => trendRows.value.reduce((sum, row) => sum + row.sales, 0))
const trendTransactions = computed(() => trendRows.value.reduce((sum, row) => sum + row.transactions, 0))
const bestTrendRow = computed(() => trendRows.value.reduce(
  (best, row) => row.sales > best.sales ? row : best,
  trendRows.value[0] ?? { label: '—', range: '', sales: 0, transactions: 0 },
))
const bestMonthRow = computed(() => monthlyComparisonRows.value.reduce(
  (best, row) => row.sales > best.sales ? row : best,
  monthlyComparisonRows.value[0] ?? { label: '—', sales: 0 },
))
const maxMonthlyComparisonValue = computed(() => Math.max(...monthlyComparisonRows.value.map((row) => row.sales), 1))
const currentMonthComparison = computed(() => monthlyComparisonRows.value.at(-1) ?? { label: '—', sales: 0 })
const previousMonthComparison = computed(() => monthlyComparisonRows.value.at(-2) ?? { label: '—', sales: 0 })
const currentMonthVariation = computed(() => data.value?.comparativas.mesVsAnterior ?? null)
const todayTotal = computed(() => data.value?.resumenHoy.totalIngresos ?? 0)

const metrics = computed<MetricCard[]>(() => {
  const comp = data.value?.comparativas
  if (activePeriod.value === 'today') {
    const top = data.value?.topProducto
    return [
      { label: 'Ingresos de hoy', value: money(todayTotal.value), meta: variacionTexto(comp?.hoyVsAyer ?? null, 'ayer'), icon: 'fluent-emoji:money-bag', tone: 'green' },
      { label: 'Ventas', value: money(data.value?.resumenHoy.totalVentas ?? 0), meta: `${data.value?.resumenHoy.ventas ?? 0} ventas · ${money(data.value?.resumenHoy.otrosIngresos ?? 0)} otros`, icon: 'fluent-emoji:receipt', tone: 'blue' },
      { label: 'Producto más vendido', value: top?.name ?? 'Sin ventas', meta: top ? `${top.qty} unidades vendidas` : 'Aún no hay ventas hoy', icon: 'fluent-emoji:star', tone: 'orange' },
    ]
  }

  if (activePeriod.value === 'week') {
    return [
      { label: 'Total semanal', value: money(trendTotal.value), meta: variacionTexto(comp?.semanaVsAnterior ?? null, 'semana anterior'), icon: 'fluent-emoji:money-bag', tone: 'green' },
      { label: 'Movimientos', value: String(trendTransactions.value), meta: 'Esta semana', icon: 'fluent-emoji:receipt', tone: 'blue' },
      { label: 'Mejor día', value: bestTrendRow.value.label, meta: money(bestTrendRow.value.sales), icon: 'fluent-emoji:spiral-calendar', tone: 'orange' },
    ]
  }

  return [
    { label: 'Total mensual', value: money(trendTotal.value), meta: variacionTexto(comp?.mesVsAnterior ?? null, 'mes anterior'), icon: 'fluent-emoji:money-bag', tone: 'green' },
    { label: 'Movimientos', value: String(trendTransactions.value), meta: 'Acumulado del mes', icon: 'fluent-emoji:receipt', tone: 'blue' },
    { label: 'Mejor mes reciente', value: bestMonthRow.value.label, meta: money(bestMonthRow.value.sales), icon: 'fluent-emoji:trophy', tone: 'orange' },
  ]
})

// Consejos derivados de los datos reales del periodo (no texto inventado).
const advice = computed<string[]>(() => {
  if (activePeriod.value === 'today') {
    const top = data.value?.topProducto
    if (!todaySales.value.length) {
      return ['Aún no registras ingresos hoy. Comparte una promoción por WhatsApp para arrancar.']
    }
    if (!(data.value?.resumenHoy.ventas ?? 0)) {
      return ['Hay ingresos manuales registrados, pero todavía no ventas. Revisa el POS antes del cierre.']
    }
    return [
      top ? `Hoy "${top.name}" es lo que más se vende. Tenlo a la vista y ofrécelo primero.` : 'Mantén a la vista tus productos más pedidos para vender más rápido.',
      'Revisa tus ventas durante el día, no solo al cierre: así reaccionas a tiempo.',
    ]
  }
  if (activePeriod.value === 'week') {
    if (!trendTotal.value) {
      return ['Esta semana aún no hay ventas registradas.']
    }
    return [`Tu mejor día de la semana es ${bestTrendRow.value.label}. Refuerza stock y atención antes de esa franja.`]
  }
  if (!trendTotal.value) {
    return ['Este mes aún no hay ventas registradas.']
  }
  return [`Tu mejor semana del mes es "${bestTrendRow.value.label}". Repite lo que funcionó ahí.`]
})

const visibleSales = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  if (!term) {
    return todaySales.value
  }

  return todaySales.value.filter((row) => [
    row.time,
    row.product,
    row.category,
    row.method,
  ].some((value) => value.toLowerCase().includes(term)))
})

async function voidIngreso(row: SaleRow) {
  if (!row.movementId || !canVoidMovements.value || voidingMovementId.value) {
    return
  }

  const reason = await cashMovementVoidDialog.requestReason('Ingreso')
  if (!reason) return

  voidingMovementId.value = row.movementId
  try {
    await $fetch(`/api/pos/cash/movements/${row.movementId}/void`, {
      method: 'POST',
      body: { reason },
    })
    await refresh()
    await cashMovementVoidDialog.success('Ingreso')
  } catch (error: unknown) {
    const dataError = (error as { data?: { statusMessage?: string } })?.data
    await cashMovementVoidDialog.error(dataError?.statusMessage ?? 'Intenta nuevamente.')
  } finally {
    voidingMovementId.value = ''
  }
}

// --- Registrar ingreso ---
// Las ventas se registran en el POS; aquí solo se guarda un ingreso manual
// (reembolso, aporte o interés) en caja_movimiento.
type IngresoTipo = 'Otro' | 'Venta'
const tipoOptions: { label: string, value: IngresoTipo }[] = [
  { label: 'Otro ingreso', value: 'Otro' },
  { label: 'Venta', value: 'Venta' },
]
const methodOptions = ['Efectivo', 'QR', 'Transferencia']

const registerDialogVisible = ref(false)
const savingIngreso = ref(false)
const registerError = ref('')
const registerForm = reactive({
  tipo: 'Otro' as IngresoTipo,
  concept: '',
  method: 'Efectivo',
  amount: 0,
})

const canSaveIngreso = computed(() => registerForm.concept.trim().length > 0 && Number(registerForm.amount || 0) > 0)

function openRegisterDialog() {
  registerForm.tipo = 'Otro'
  registerForm.concept = ''
  registerForm.method = 'Efectivo'
  registerForm.amount = 0
  registerError.value = ''
  registerDialogVisible.value = true
}

function irAlPos() {
  registerDialogVisible.value = false
  void navigateTo('/pos')
}

async function saveIngreso() {
  if (!canSaveIngreso.value || savingIngreso.value) {
    return
  }

  savingIngreso.value = true
  registerError.value = ''

  try {
    await $fetch('/api/pos/ingresos', {
      method: 'POST',
      body: {
        categoria: 'otro_ingreso',
        concepto: registerForm.concept.trim(),
        monto: Number(registerForm.amount || 0),
        metodo: registerForm.method.toLowerCase(),
      },
    })

    registerDialogVisible.value = false
    await refresh()
  } catch (error) {
    registerError.value = error instanceof Error ? error.message : 'No se pudo guardar el ingreso.'
  } finally {
    savingIngreso.value = false
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
        <IconField v-if="activePeriod === 'today'" class="income-search">
          <InputIcon>
            <i class="pi pi-search" />
          </InputIcon>
          <InputText v-model="searchTerm" placeholder="Buscar venta, producto o método..." />
        </IconField>

        <Button type="button" icon="pi pi-plus" label="Registrar ingreso" @click="openRegisterDialog" />
      </div>
    </section>

    <section class="period-switch" aria-label="Periodo de ingresos">
      <SelectButton v-model="activePeriod" :options="periodOptions" option-label="label" option-value="value" />
    </section>

    <section class="income-metrics" aria-label="Resumen de ingresos">
      <article v-for="card in metrics" :key="card.label" class="income-metric">
        <span class="income-metric__icon" :class="`is-${card.tone}`">
          <Icon :name="card.icon" aria-hidden="true" />
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
          <Tag :value="activePeriod === 'today' ? 'Día calendario' : activePeriod === 'week' ? 'Semana' : 'Mes'" severity="success" />
        </header>

        <DataTable v-if="activePeriod === 'today'" :value="visibleSales" size="small" class="income-table income-desktop-table">
          <Column field="time" header="Hora" />
          <Column field="product" header="Producto / Servicio" />
          <Column field="category" header="Categoría" />
          <Column field="qty" header="Cantidad" />
          <Column header="Precio neto">
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
          <Column v-if="canVoidMovements" header="Acción">
            <template #body="{ data }">
              <Button
                v-if="data.movementId"
                type="button"
                icon="pi pi-ban"
                label="Anular"
                size="small"
                severity="danger"
                text
                :loading="voidingMovementId === data.movementId"
                :disabled="Boolean(voidingMovementId)"
                @click="voidIngreso(data)"
              />
            </template>
          </Column>
        </DataTable>

        <ul v-if="activePeriod === 'today'" class="income-mobile-list" aria-label="Movimientos de hoy">
          <li v-for="row in visibleSales" :key="`${row.time}-${row.product}-${row.movementId ?? row.total}`">
            <span class="income-mobile-list__time">{{ row.time }}</span>
            <span class="income-mobile-list__main">
              <strong>{{ row.product }}</strong>
              <small>{{ row.category }} · {{ row.method }}<template v-if="row.qty > 1"> · {{ row.qty }} unidades</template></small>
            </span>
            <strong class="income-mobile-list__amount">{{ money(row.total) }}</strong>
            <Button
              v-if="row.movementId && canVoidMovements"
              class="income-mobile-list__void"
              v-tooltip.left="'Anular ingreso'"
              type="button"
              icon="pi pi-ban"
              aria-label="Anular ingreso"
              size="small"
              severity="danger"
              text
              :loading="voidingMovementId === row.movementId"
              :disabled="Boolean(voidingMovementId)"
              @click="voidIngreso(row)"
            />
          </li>
          <li v-if="!visibleSales.length" class="income-mobile-list__empty">No hay ingresos registrados hoy.</li>
        </ul>

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
            <Column header="Movimientos">
              <template #body="{ data }">{{ data.transactions }}</template>
            </Column>
            <Column header="Ingresos">
              <template #body="{ data }">
                <strong>{{ money(data.sales) }}</strong>
              </template>
            </Column>
          </DataTable>

          <section v-if="activePeriod === 'month'" class="month-comparison" aria-label="Comparativa mensual">
            <header>
              <div>
                <span>Comparativa mensual</span>
                <h3>Últimos 5 meses</h3>
              </div>
              <strong v-if="currentMonthVariation !== null">
                <i :class="currentMonthVariation >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" aria-hidden="true" />
                {{ currentMonthVariation >= 0 ? '+' : '' }}{{ currentMonthVariation.toFixed(1) }}% vs. {{ previousMonthComparison.label }}
              </strong>
            </header>

            <div class="month-bars">
              <article v-for="row in monthlyComparisonRows" :key="row.label" class="month-bar" :class="{ 'is-current': row.label === currentMonthComparison.label }">
                <span>{{ money(row.sales) }}</span>
                <div>
                  <b :style="{ height: `${Math.max((row.sales / maxMonthlyComparisonValue) * 100, 8)}%` }" />
                </div>
                <strong>{{ row.label }}</strong>
              </article>
            </div>

            <footer>
              <span><b /> Ingresos del mes</span>
              <em>Mejor mes: {{ bestMonthRow.label }} · {{ money(bestMonthRow.sales) }}</em>
            </footer>
          </section>
        </div>
      </article>

    </section>

    <section class="ai-advice">
      <span class="ai-advice__icon"><i class="pi pi-lightbulb" aria-hidden="true" /></span>
      <div>
        <h2>Consejo IA</h2>
        <p v-for="line in advice" :key="line">{{ line }}</p>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true">
    </section>

    <Dialog v-model:visible="registerDialogVisible" modal header="Registrar ingreso" class="register-dialog">
      <form class="register-form" @submit.prevent="saveIngreso">
        <label class="register-field">
          <span>Tipo de ingreso</span>
          <SelectButton v-model="registerForm.tipo" :options="tipoOptions" option-label="label" option-value="value" :allow-empty="false" />
        </label>

        <!-- Venta real: se registra en el POS con sus productos. -->
        <template v-if="registerForm.tipo === 'Venta'">
          <Message severity="info" size="small" icon="pi pi-shopping-cart">
            Las ventas se registran en el POS para descontar stock y guardar el detalle de productos.
          </Message>
          <footer class="register-actions">
            <Button type="button" label="Cancelar" outlined severity="secondary" @click="registerDialogVisible = false" />
            <Button type="button" label="Ir al POS" icon="pi pi-arrow-right" icon-pos="right" @click="irAlPos" />
          </footer>
        </template>

        <!-- Otro ingreso (no venta): se guarda directo. -->
        <template v-else>
          <label class="register-field">
            <span>Concepto</span>
            <InputText v-model="registerForm.concept" placeholder="Ej. Reembolso, aporte de socio, interés" />
          </label>
          <label class="register-field">
            <span>Método</span>
            <Select v-model="registerForm.method" :options="methodOptions" fluid />
          </label>
          <label class="register-field">
            <span>Monto</span>
            <InputNumber v-model="registerForm.amount" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>

          <Message v-if="registerError" severity="error" size="small">{{ registerError }}</Message>

          <footer class="register-actions">
            <Button type="button" label="Cancelar" outlined severity="secondary" @click="registerDialogVisible = false" />
            <Button type="submit" label="Guardar ingreso" icon="pi pi-check" :loading="savingIngreso" :disabled="!canSaveIngreso || savingIngreso" />
          </footer>
        </template>
      </form>
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
  color: #0b6f38;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
.ai-advice__icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  font-size: 1.18rem;
}

/* Iconos de las 3 tarjetas: grandes en desktop/tablet (se reducen en móvil). */
.income-metric__icon {
  width: 58px;
  height: 58px;
  font-size: 2.3rem;
}

.income-metric__icon.is-green,
.ai-advice__icon {
  background: #e8f7eb;
  color: #0b6f38;
}

.income-metric__icon.is-blue {
  background: #eaf3ff;
  color: #2f7ded;
}

.income-metric__icon.is-gold {
  background: #fff8d8;
  color: #9a6b00;
}

.income-metric__icon.is-orange {
  background: #fff0e8;
  color: #ff6b2c;
}

.income-metric small,
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
  color: #0b6f38;
  font-size: 0.74rem;
  font-style: normal;
  font-weight: 900;
}

.income-grid {
  display: grid;
  gap: 14px;
  align-items: start;
}

.income-panel {
  min-width: 0;
  overflow: hidden;
}

.main-panel {
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
  color: #0b6f38;
  font-size: 0.72rem;
}

.income-mobile-list {
  display: none;
  margin: 0;
  padding: 0;
  list-style: none;
}

.income-mobile-list li {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #edf1f5;
}

.income-mobile-list__time {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
}

.income-mobile-list__main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.income-mobile-list__main strong {
  overflow: hidden;
  color: #172033;
  font-size: 0.84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.income-mobile-list__main small {
  overflow: hidden;
  color: #64748b;
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.income-mobile-list__amount {
  color: #08742a;
  font-size: 0.82rem;
  white-space: nowrap;
}

.income-mobile-list__empty {
  display: block !important;
  color: #64748b;
  text-align: center;
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
  color: #0b6f38;
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

.month-bar strong {
  color: #334155;
  font-size: 0.72rem;
  font-weight: 900;
}

.month-bar.is-current > span,
.month-bar.is-current strong {
  color: #0b6f38;
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

.month-comparison footer b {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #0b6f38;
}

.month-comparison footer em {
  margin-left: auto;
  color: #0f172a;
  font-style: normal;
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

.register-dialog {
  width: min(420px, calc(100vw - 24px));
}

@media (max-width: 1320px) {
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

  .ai-advice {
    grid-template-columns: 1fr;
  }

  .income-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .income-metric:first-child {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
  }

  .income-metric {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-height: 0;
    padding: 12px 10px;
  }

  .income-metric__icon {
    width: 38px;
    height: 38px;
    font-size: 1.4rem;
  }

  .income-metric strong {
    margin-top: 2px;
    font-size: 0.92rem;
  }

  .income-metric small {
    font-size: 0.62rem;
  }

  .income-metric em {
    margin-top: 4px;
    font-size: 0.62rem;
  }

  .main-panel {
    padding: 12px;
  }

  .income-desktop-table,
  .trend-table {
    display: none;
  }

  .income-mobile-list {
    display: block;
  }

  .income-mobile-list li {
    grid-template-columns: 44px minmax(0, 1fr) auto;
    grid-template-areas:
      "time main amount"
      ". main action";
    gap: 6px 10px;
  }

  .income-mobile-list__time { grid-area: time; }
  .income-mobile-list__main { grid-area: main; }
  .income-mobile-list__amount { grid-area: amount; }
  .income-mobile-list__void {
    grid-area: action;
    justify-self: end;
  }

  .trend-chart {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
  }

  .trend-bar {
    flex: 0 0 88px;
    scroll-snap-align: start;
  }

  .month-bars {
    display: flex;
    gap: 10px;
    overflow-x: auto;
  }

  .month-bar {
    flex: 0 0 74px;
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
    display: none;
  }

  :global(.register-dialog.p-dialog) {
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
  }
}

/* Diálogo: registrar ingreso */
.register-form {
  display: grid;
  gap: 14px;
  min-width: min(86vw, 360px);
}

.register-field {
  display: grid;
  gap: 6px;
}

.register-field > span {
  font-size: 0.82rem;
  font-weight: 800;
  color: #26372c;
}

.register-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
