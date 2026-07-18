<script setup lang="ts">
import { CATEGORIAS_EGRESO } from '~~/shared/utils/finanzas'

definePageMeta({
  layout: 'pos',
  posTitle: 'Gastos',
  alias: ['/pos/finanzas/gastos'],
})

useHead({
  title: 'Gastos | NEXA',
})

type PeriodKey = 'today' | 'week' | 'month'
type Tone = 'green' | 'blue' | 'gold' | 'orange' | 'purple' | 'red'
type ExpenseKind = 'Inventario' | 'Operativo'
type Method = 'Efectivo' | 'QR' | 'Transferencia'
type FundSource = 'business' | 'cash'
type KindFilter = 'todos' | ExpenseKind

interface ExpenseRow {
  id: string
  date: string
  cashLabel: string
  concept: string
  category: string
  kind: ExpenseKind
  method: Method
  amount: number
  // Solo para compras de inventario: a quién se le compró.
  supplier?: string
}

interface MetricCard {
  label: string
  value: string
  meta: string
  icon: string
  tone: Tone
}

const periodOptions = [
  { label: 'Hoy', value: 'today' },
  { label: 'Semana', value: 'week' },
  { label: 'Mes', value: 'month' },
]

// Color por valor de categoría (taxonomía contable compartida con Finanzas).
const categoryColorByValue: Record<string, string> = {
  sueldos: '#22c55e',
  alquiler: '#ec4899',
  servicios_basicos: '#3b82f6',
  transporte: '#f59e0b',
  publicidad: '#8b5cf6',
  mantenimiento: '#14b8a6',
  otros_gastos: '#94a3b8',
  materia_prima: '#0ea5e9',
  compra_inventario: '#06b6d4',
  gasto_financiero: '#ef4444',
}

// Color por etiqueta amigable (lo usa el desglose operativo de abajo, que agrupa
// por la etiqueta visible de cada gasto).
const categoryColors: Record<string, string> = Object.fromEntries(
  CATEGORIAS_EGRESO.map((c) => [c.label, categoryColorByValue[c.value] ?? '#94a3b8']),
)

// Convierte el valor crudo de la categoría (BD) en etiqueta + tipo + color.
function categoryMeta(value: string) {
  const found = CATEGORIAS_EGRESO.find((c) => c.value === value)
  return {
    label: found?.label ?? 'Otros gastos',
    kind: (found?.grupo === 'inventario' ? 'Inventario' : 'Operativo') as ExpenseKind,
    color: categoryColorByValue[value] ?? '#94a3b8',
  }
}

const session = usePosSession()
const cashRegister = usePosCashRegister()
const isLimitedCashier = computed(() => Boolean(
  session.value?.roles.includes('cajero')
  && !session.value?.permisos.includes('reporte.ver'),
))
const activePeriod = ref<PeriodKey>(isLimitedCashier.value ? 'today' : 'month')
const kindFilter = ref<KindFilter>('todos')
const searchTerm = ref('')
const registerDialogVisible = ref(false)
const cashMovementVoidDialog = useCashMovementVoidDialog()
const voidingMovementId = ref('')
const canVoidMovements = computed(() => session.value?.roles.includes('propietario') ?? false)
const cashStatus = cashRegister.cashStatus
const cashLoading = cashRegister.isLoading
const cashLoadReady = ref(false)
const canRegisterExpense = computed(() => cashLoadReady.value
  && !cashLoading.value
  && (cashStatus.value === 'abierta' || !isLimitedCashier.value))
const currentCashAvailable = computed(() => {
  const openingFloat = Number(cashRegister.cashSession.value?.openingFloat ?? 0)

  return cashRegister.movements.value.reduce((balance, movement) => {
    if (movement.method !== 'Efectivo') {
      return balance
    }

    return movement.type === 'Ingreso'
      ? balance + movement.amount
      : balance - movement.amount
  }, openingFloat)
})

onMounted(async () => {
  try {
    await cashRegister.loadCashData({ force: true })
  } catch {
    // El servidor vuelve a validar la caja al guardar.
  } finally {
    cashLoadReady.value = true
  }
})

const hoyTexto = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/La_Paz',
}).format(new Date())
const mesTexto = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric', timeZone: 'America/La_Paz' }).format(new Date())
const currentCopy = computed(() => {
  if (activePeriod.value === 'today') return { subtitle: `Día calendario · ${hoyTexto} · incluye todos los turnos` }
  if (activePeriod.value === 'week') return { subtitle: 'Semana actual · incluye todos los turnos' }
  return { subtitle: `Mes actual · ${mesTexto} · incluye todos los turnos` }
})

// --- Gastos reales del periodo (API) ---
type ApiGasto = {
  id: string
  fecha: string
  categoria: string
  concepto: string
  metodo: string
  monto: number
  cashSessionId: string | null
  cashOpenedAt: string | null
}
type TrendRow = { label: string, range: string, sales: number, transactions: number }
type MonthRow = { label: string, sales: number }
type GastosResponse = { gastos: ApiGasto[], semana: TrendRow[], semanas: TrendRow[], meses: MonthRow[] }

const { data: gastosData, refresh: refreshGastos } = await useFetch<GastosResponse>('/api/pos/gastos', {
  query: computed(() => ({ periodo: activePeriod.value })),
  watch: [activePeriod],
  default: () => ({ gastos: [], semana: [], semanas: [], meses: [] }),
})

const methodFromApi: Record<string, Method> = {
  efectivo: 'Efectivo',
  qr: 'QR',
  transferencia: 'Transferencia',
  tarjeta: 'Transferencia',
  otro: 'Efectivo',
}

function formatExpenseDate(iso: string) {
  const d = new Date(iso)
  if (activePeriod.value === 'today') return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/La_Paz' })
  if (activePeriod.value === 'week') return d.toLocaleDateString('es-BO', { weekday: 'short', timeZone: 'America/La_Paz' })
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', timeZone: 'America/La_Paz' })
}

function cashSessionLabel(openedAt: string | null) {
  if (!openedAt) return 'Fondos del negocio'

  const date = new Date(openedAt)
  const day = date.toLocaleDateString('es-BO', {
    day: '2-digit', month: '2-digit', timeZone: 'America/La_Paz',
  })
  const time = date.toLocaleTimeString('es-BO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/La_Paz',
  })
  return `Caja ${day} · ${time}`
}

const rows = computed<ExpenseRow[]>(() => (gastosData.value?.gastos ?? []).map((g) => {
  const meta = categoryMeta(g.categoria)
  return {
    id: g.id,
    date: formatExpenseDate(g.fecha),
    cashLabel: cashSessionLabel(g.cashOpenedAt),
    concept: g.concepto,
    category: meta.label,
    kind: meta.kind,
    method: methodFromApi[g.metodo] ?? 'Efectivo',
    amount: g.monto,
  }
}))

const total = computed(() => rows.value.reduce((sum, row) => sum + row.amount, 0))
const inventoryTotal = computed(() => rows.value.filter(r => r.kind === 'Inventario').reduce((sum, r) => sum + r.amount, 0))
const operativeTotal = computed(() => rows.value.filter(r => r.kind === 'Operativo').reduce((sum, r) => sum + r.amount, 0))
const inventoryCount = computed(() => rows.value.filter(r => r.kind === 'Inventario').length)
const operativeCount = computed(() => rows.value.filter(r => r.kind === 'Operativo').length)

function sharePercent(part: number) {
  return total.value === 0 ? 0 : Math.round((part / total.value) * 100)
}

// Desglose de gastos operativos por categoría (con color y porcentaje).
const operativeCategories = computed(() => {
  const grouped = new Map<string, number>()

  for (const row of rows.value.filter(r => r.kind === 'Operativo')) {
    grouped.set(row.category, (grouped.get(row.category) || 0) + row.amount)
  }

  const totalOperative = operativeTotal.value || 1

  return [...grouped.entries()]
    .map(([label, amount]) => ({
      label,
      amount,
      color: categoryColors[label] || '#94a3b8',
      percent: Math.round((amount / totalOperative) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
})

const advice = computed(() => {
  if (!rows.value.length) {
    return ['No hay gastos registrados en este periodo. Registra solo salidas reales del negocio.']
  }
  const mainCategory = operativeCategories.value[0]
  if (!mainCategory) {
    return ['Las compras de inventario deben compararse con la rotación y las ventas antes de volver a comprar.']
  }
  return [`${mainCategory.label} es tu mayor gasto operativo: ${money(mainCategory.amount)}. Revísalo antes de recortar otras áreas.`]
})

// --- Tendencia (igual que Ingresos): por día en semana, por semana en mes ---
const weekRows = computed<TrendRow[]>(() => gastosData.value?.semana ?? [])
const monthRows = computed<TrendRow[]>(() => gastosData.value?.semanas ?? [])
const monthlyComparisonRows = computed<MonthRow[]>(() => gastosData.value?.meses ?? [])

const trendRows = computed(() => activePeriod.value === 'month' ? monthRows.value : weekRows.value)
const maxTrendValue = computed(() => Math.max(...trendRows.value.map(r => r.sales), 1))
const maxMonthlyComparisonValue = computed(() => Math.max(...monthlyComparisonRows.value.map(r => r.sales), 1))
const currentMonthComparison = computed(() => monthlyComparisonRows.value.at(-1) ?? { label: '—', sales: 0 })
const previousMonthComparison = computed(() => monthlyComparisonRows.value.at(-2) ?? { label: '—', sales: 0 })
const currentMonthVariation = computed(() => {
  const previo = previousMonthComparison.value.sales
  return previo > 0 ? ((currentMonthComparison.value.sales - previo) / previo) * 100 : null
})
const trendPanelTitle = computed(() => activePeriod.value === 'month' ? 'Gastos por semana' : 'Gastos por día')

const metrics = computed<MetricCard[]>(() => [
  { label: 'Total gastado', value: money(total.value), meta: `${rows.value.length} gastos en el periodo`, icon: 'fluent-emoji:money-with-wings', tone: 'red' },
  { label: 'Gastos operativos', value: money(operativeTotal.value), meta: `${sharePercent(operativeTotal.value)}% · dinero consumido`, icon: 'fluent-emoji:high-voltage', tone: 'orange' },
  { label: 'Movimientos', value: String(rows.value.length), meta: activePeriod.value === 'today' ? 'Registrados hoy' : 'En el periodo', icon: 'fluent-emoji:receipt', tone: 'blue' },
])

const kindFilters = computed<{ value: KindFilter, label: string, count: number }[]>(() => [
  { value: 'todos', label: 'Todos', count: rows.value.length },
  { value: 'Inventario', label: 'Inventario', count: inventoryCount.value },
  { value: 'Operativo', label: 'Operativos', count: operativeCount.value },
])

const visibleRows = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  return rows.value.filter((row) => {
    const matchesKind = kindFilter.value === 'todos' || row.kind === kindFilter.value
    const matchesTerm = !term || [row.concept, row.category, row.method, row.cashLabel, row.supplier ?? '']
      .some(value => value.toLowerCase().includes(term))

    return matchesKind && matchesTerm
  })
})

const visibleSubtotal = computed(() => visibleRows.value.reduce((sum, row) => sum + row.amount, 0))

// --- Registrar gasto (persiste en BD) ---
// Categorías operativas/financieras (la de inventario se elige con el tipo de gasto).
const categoryOptions = CATEGORIAS_EGRESO
  .filter((c) => c.grupo !== 'inventario')
  .map((c) => ({ label: c.label, value: c.value }))
const cashierCategoryOptions = CATEGORIAS_EGRESO
  .filter((c) => c.value !== 'compra_inventario')
  .map((c) => ({ label: c.label, value: c.value }))
const methodOptions: Method[] = ['Efectivo', 'QR', 'Transferencia']
const fundSourceOptions = computed<{ label: string, value: FundSource }[]>(() => [
  { label: 'Fondos del negocio', value: 'business' },
  { label: `Caja actual · ${money(currentCashAvailable.value)}`, value: 'cash' },
])

const registerForm = reactive({
  kind: 'Operativo' as ExpenseKind,
  concept: '',
  category: 'alquiler',
  supplier: '',
  method: 'Efectivo' as Method,
  fundSource: 'business' as FundSource,
  amount: 0,
})
const savingExpense = ref(false)
const registerError = ref('')

const usesCurrentCash = computed(() => isLimitedCashier.value
  || (registerForm.method === 'Efectivo' && registerForm.fundSource === 'cash'))
const currentCashInsufficient = computed(() => usesCurrentCash.value
  && Number(registerForm.amount || 0) > currentCashAvailable.value + 0.009)
const canSaveExpense = computed(() => registerForm.concept.trim().length > 0
  && Number(registerForm.amount || 0) > 0
  && (!usesCurrentCash.value || cashStatus.value === 'abierta')
  && !currentCashInsufficient.value)

function openRegisterDialog() {
  if (!canRegisterExpense.value) {
    return
  }

  registerForm.kind = 'Operativo'
  registerForm.concept = ''
  registerForm.category = isLimitedCashier.value ? 'materia_prima' : 'alquiler'
  registerForm.supplier = ''
  registerForm.method = 'Efectivo'
  registerForm.fundSource = 'business'
  registerForm.amount = 0
  registerError.value = ''
  registerDialogVisible.value = true
}

async function saveExpense() {
  if (!canSaveExpense.value || savingExpense.value) {
    return
  }

  savingExpense.value = true
  registerError.value = ''

  try {
    await $fetch('/api/pos/gastos', {
      method: 'POST',
      body: {
        categoria: registerForm.category,
        concepto: registerForm.concept.trim(),
        monto: Number(registerForm.amount || 0),
        metodo: isLimitedCashier.value ? 'efectivo' : registerForm.method.toLowerCase(),
        fundSource: usesCurrentCash.value ? 'current_cash' : 'business_funds',
      },
    })

    registerDialogVisible.value = false
    await Promise.all([
      refreshGastos(),
      cashRegister.loadCashData({ force: true }),
    ])
  } catch (error: unknown) {
    const dataError = (error as { data?: { statusMessage?: string } })?.data
    registerError.value = dataError?.statusMessage
      ?? (error instanceof Error ? error.message : 'No se pudo guardar el gasto.')
  } finally {
    savingExpense.value = false
  }
}

async function voidExpense(row: ExpenseRow) {
  if (!canVoidMovements.value || voidingMovementId.value) {
    return
  }

  const reason = await cashMovementVoidDialog.requestReason('Egreso')
  if (!reason) return

  voidingMovementId.value = row.id
  try {
    await $fetch(`/api/pos/cash/movements/${row.id}/void`, {
      method: 'POST',
      body: { reason },
    })
    await refreshGastos()
    await cashMovementVoidDialog.success('Egreso')
  } catch (error: unknown) {
    const dataError = (error as { data?: { statusMessage?: string } })?.data
    await cashMovementVoidDialog.error(dataError?.statusMessage ?? 'Intenta nuevamente.')
  } finally {
    voidingMovementId.value = ''
  }
}

// Inventario no se guarda como gasto plano: se registra en el inventario (suma stock).
function irAInventario() {
  registerDialogVisible.value = false
  void navigateTo('/pos/catalogo?accion=entrada')
}

function money(value: number) {
  return `Bs. ${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`
}

function methodIcon(method: Method) {
  if (method === 'Efectivo') {
    return 'pi pi-money-bill'
  }

  return method === 'QR' ? 'pi pi-qrcode' : 'pi pi-arrow-right-arrow-left'
}
</script>

<template>
  <div class="expense-page">
    <section class="expense-heading">
      <div class="expense-heading__title">
        <span class="heading-icon"><i class="pi pi-shopping-bag" aria-hidden="true" /></span>
        <div>
          <h2>Gastos</h2>
          <p>{{ currentCopy.subtitle }}</p>
        </div>
      </div>

      <div class="expense-heading__tools">
        <IconField class="expense-search">
          <InputIcon>
            <i class="pi pi-search" />
          </InputIcon>
          <InputText v-model="searchTerm" placeholder="Buscar gasto, proveedor o categoría..." />
        </IconField>

        <Button
          type="button"
          icon="pi pi-plus"
          label="Registrar gasto"
          :loading="!cashLoadReady"
          :disabled="!canRegisterExpense"
          @click="openRegisterDialog"
        />
      </div>
    </section>

    <Message
      v-if="cashLoadReady && cashStatus !== 'abierta'"
      severity="warn"
      icon="pi pi-lock"
      class="cashier-cash-warning"
    >
      <span v-if="isLimitedCashier">La caja está cerrada. Ábrela antes de registrar una salida de efectivo.</span>
      <span v-else>La caja está cerrada. Aún puedes registrar gastos pagados con fondos del negocio.</span>
      <NuxtLink to="/pos/caja">Ir a Caja</NuxtLink>
    </Message>

    <section v-if="isLimitedCashier && canRegisterExpense" class="cashier-balance" aria-label="Efectivo disponible en caja">
      <span><i class="pi pi-wallet" aria-hidden="true" /> Caja abierta</span>
      <div>
        <small>Efectivo disponible</small>
        <strong>{{ money(currentCashAvailable) }}</strong>
      </div>
    </section>

    <section class="period-switch" aria-label="Periodo de gastos">
      <SelectButton v-model="activePeriod" :options="periodOptions" option-label="label" option-value="value" />
    </section>

    <section v-if="!isLimitedCashier" class="expense-metrics" aria-label="Resumen de gastos">
      <article v-for="card in metrics" :key="card.label" class="expense-metric">
        <span class="expense-metric__icon" :class="`is-${card.tone}`">
          <Icon :name="card.icon" aria-hidden="true" />
        </span>
        <div>
          <small>{{ card.label }}</small>
          <strong>{{ card.value }}</strong>
          <em>{{ card.meta }}</em>
        </div>
      </article>
    </section>

    <section v-if="!isLimitedCashier" class="expense-breakdown" aria-label="Gastos por categoria">
      <header>
        <div>
          <span>Distribución</span>
          <h2>Gastos operativos por categoría</h2>
        </div>
        <strong>{{ money(operativeTotal) }}</strong>
      </header>

      <ul v-if="operativeCategories.length">
        <li v-for="cat in operativeCategories" :key="cat.label">
          <span class="expense-breakdown__label"><i :style="{ background: cat.color }" />{{ cat.label }}</span>
          <span class="expense-breakdown__bar"><i :style="{ width: `${cat.percent}%`, background: cat.color }" /></span>
          <strong>{{ money(cat.amount) }}</strong>
        </li>
      </ul>
      <p v-else>No hay gastos operativos en este periodo.</p>

      <Message v-if="inventoryTotal > 0" severity="info" size="small" icon="pi pi-box">
        {{ money(inventoryTotal) }} corresponden a inventario y no se descuentan como gasto operativo.
      </Message>
    </section>

    <!-- Tendencia de gastos (igual que Ingresos): por día en Semana, por semana en Mes -->
    <section v-if="!isLimitedCashier && activePeriod !== 'today'" class="expense-trend" aria-label="Tendencia de gastos">
      <header class="panel-head">
        <div>
          <span>Tendencia</span>
          <h2>{{ trendPanelTitle }}</h2>
        </div>
      </header>

      <div class="trend-chart">
        <article v-for="row in trendRows" :key="row.label" class="trend-bar">
          <span>{{ money(row.sales) }}</span>
          <div><b :style="{ height: `${Math.max((row.sales / maxTrendValue) * 100, 6)}%` }" /></div>
          <strong>{{ row.label }}</strong>
          <small>{{ row.range }}</small>
        </article>
      </div>

      <div v-if="activePeriod === 'month'" class="month-comparison">
        <header class="month-comparison__head">
          <div>
            <span>Comparativa mensual</span>
            <h3>Últimos meses</h3>
          </div>
          <strong v-if="currentMonthVariation !== null" :class="currentMonthVariation > 0 ? 'is-up' : 'is-down'">
            <i :class="currentMonthVariation > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" aria-hidden="true" />
            {{ currentMonthVariation > 0 ? '+' : '' }}{{ currentMonthVariation.toFixed(1) }}% vs. {{ previousMonthComparison.label }}
          </strong>
        </header>
        <div class="month-bars">
          <article
            v-for="row in monthlyComparisonRows"
            :key="row.label"
            class="month-bar"
            :class="{ 'is-current': row.label === currentMonthComparison.label }"
          >
            <span>{{ money(row.sales) }}</span>
            <div><b :style="{ height: `${Math.max((row.sales / maxMonthlyComparisonValue) * 100, 6)}%` }" /></div>
            <strong>{{ row.label }}</strong>
          </article>
        </div>
      </div>
    </section>

    <section class="expense-grid">
      <article class="expense-panel main-panel">
        <header class="panel-head">
          <div>
            <span>Detalle</span>
            <h2>Gastos realizados</h2>
          </div>
          <div v-if="!isLimitedCashier" class="kind-filter" role="group" aria-label="Filtrar por tipo de gasto">
            <button
              v-for="filter in kindFilters"
              :key="filter.value"
              type="button"
              :class="{ 'is-active': kindFilter === filter.value }"
              @click="kindFilter = filter.value"
            >
              {{ filter.label }} <b>{{ filter.count }}</b>
            </button>
          </div>
        </header>

        <ul class="expense-list" :class="{ 'can-void': canVoidMovements }">
          <li v-for="(row, index) in visibleRows" :key="row.concept + row.date + index">
            <span class="expense-date">
              <strong>{{ row.date }}</strong>
              <small>{{ row.cashLabel }}</small>
            </span>
            <span class="expense-main">
              <strong>{{ row.concept }}</strong>
              <small>
                <Tag :value="row.kind" :severity="row.kind === 'Inventario' ? 'info' : 'warn'" />
                {{ row.supplier ? row.supplier : row.category }}
              </small>
            </span>
            <span class="expense-method">
              <i :class="methodIcon(row.method)" aria-hidden="true" />
              {{ row.method }}
            </span>
            <strong class="expense-amount">- {{ money(row.amount) }}</strong>
            <Button
              v-if="canVoidMovements"
              class="expense-void-button"
              v-tooltip.left="'Anular gasto'"
              type="button"
              icon="pi pi-ban"
              aria-label="Anular gasto"
              size="small"
              severity="danger"
              text
              :loading="voidingMovementId === row.id"
              :disabled="Boolean(voidingMovementId)"
              @click="voidExpense(row)"
            />
          </li>
          <li v-if="!visibleRows.length" class="expense-empty">
            No hay gastos que coincidan con el filtro.
          </li>
        </ul>
        <footer class="expense-subtotal">
          <span>
            <small>Subtotal visible</small>
            <b>{{ visibleRows.length }} gastos en el periodo</b>
          </span>
          <strong>- {{ money(visibleSubtotal) }}</strong>
        </footer>
      </article>

    </section>

    <section v-if="!isLimitedCashier" class="ai-advice">
      <span class="ai-advice__icon"><i class="pi pi-lightbulb" aria-hidden="true" /></span>
      <div>
        <h2>Consejo de Haru</h2>
        <p v-for="line in advice" :key="line">{{ line }}</p>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true">
    </section>

    <!-- Diálogo: registrar gasto (persiste en BD vía /api/pos/gastos) -->
    <Dialog v-model:visible="registerDialogVisible" modal header="Registrar gasto" class="expense-dialog">
      <form class="dialog-form" @submit.prevent="saveExpense">
        <label v-if="!isLimitedCashier" class="field full">
          <span>Tipo de gasto</span>
          <SelectButton v-model="registerForm.kind" :options="['Operativo', 'Inventario']" :allow-empty="false" />
        </label>

        <template v-if="isLimitedCashier">
          <Message severity="info" size="small" icon="pi pi-wallet" class="full">
            Esta salida se descontará del efectivo de la caja actual.
          </Message>

          <label class="field full">
            <span>Categoría</span>
            <Select v-model="registerForm.category" :options="cashierCategoryOptions" optionLabel="label" optionValue="value" fluid />
          </label>

          <label class="field full">
            <span>Concepto</span>
            <InputText v-model="registerForm.concept" placeholder="Ej. Compra de harina" />
          </label>

          <label class="field full">
            <span>Monto en efectivo</span>
            <InputNumber v-model="registerForm.amount" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>

          <Message v-if="currentCashInsufficient" severity="warn" size="small" icon="pi pi-wallet" class="full">
            La caja actual solo tiene {{ money(currentCashAvailable) }}.
          </Message>

          <Message v-if="registerError" severity="error" size="small" class="full">{{ registerError }}</Message>

          <footer class="full">
            <Button type="button" label="Cancelar" outlined severity="secondary" @click="registerDialogVisible = false" />
            <Button type="submit" label="Guardar gasto" icon="pi pi-check" :loading="savingExpense" :disabled="!canSaveExpense || savingExpense" />
          </footer>
        </template>

        <!-- Inventario: no es un gasto plano, entra mercadería que suma stock.
             Se registra en el inventario, así que llevamos al usuario allí. -->
        <template v-else-if="registerForm.kind === 'Inventario'">
          <Message severity="info" size="small" icon="pi pi-box" class="full">
            La mercadería que compras suma stock a tus productos. La registramos en tu inventario para que el costo se descuente cuando la vendas.
          </Message>
          <footer class="full">
            <Button type="button" label="Cancelar" outlined severity="secondary" @click="registerDialogVisible = false" />
            <Button type="button" label="Ir a inventario" icon="pi pi-arrow-right" icon-pos="right" @click="irAInventario" />
          </footer>
        </template>

        <template v-else>
          <label class="field">
            <span>Categoría</span>
            <Select v-model="registerForm.category" :options="categoryOptions" optionLabel="label" optionValue="value" fluid />
          </label>

          <label class="field">
            <span>Método de pago</span>
            <Select v-model="registerForm.method" :options="methodOptions" fluid />
          </label>

          <label v-if="registerForm.method === 'Efectivo'" class="field full">
            <span>Origen del dinero</span>
            <SelectButton
              v-model="registerForm.fundSource"
              :options="fundSourceOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
            />
          </label>

          <Message
            v-if="usesCurrentCash && cashStatus !== 'abierta'"
            severity="warn"
            size="small"
            icon="pi pi-lock"
            class="full"
          >
            La caja está cerrada. Ábrela o selecciona “Fondos del negocio”.
          </Message>

          <Message
            v-else-if="currentCashInsufficient"
            severity="warn"
            size="small"
            icon="pi pi-wallet"
            class="full"
          >
            La caja actual solo tiene {{ money(currentCashAvailable) }}. Selecciona “Fondos del negocio” si el dinero no salió de este turno.
          </Message>

          <Message
            v-else-if="!usesCurrentCash"
            severity="info"
            size="small"
            icon="pi pi-building"
            class="full"
          >
            Se registrará como gasto del negocio sin modificar el efectivo de la caja actual.
          </Message>

          <Message
            v-else
            severity="info"
            size="small"
            icon="pi pi-wallet"
            class="full"
          >
            Se descontará del efectivo del turno abierto.
          </Message>

          <label class="field full">
            <span>Concepto</span>
            <InputText v-model="registerForm.concept" placeholder="Ej. Pago de luz" />
          </label>

          <label class="field">
            <span>Monto</span>
            <InputNumber v-model="registerForm.amount" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>

          <Message v-if="registerError" severity="error" size="small" class="full">{{ registerError }}</Message>

          <footer class="full">
            <Button type="button" label="Cancelar" outlined severity="secondary" @click="registerDialogVisible = false" />
            <Button type="submit" label="Guardar gasto" icon="pi pi-check" :loading="savingExpense" :disabled="!canSaveExpense || savingExpense" />
          </footer>
        </template>
      </form>
    </Dialog>

  </div>
</template>

<style scoped>
.expense-page {
  display: grid;
  gap: 14px;
  padding: 12px 0 0;
  color: #111827;
}

.expense-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.expense-heading__title {
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
  background: #fdeaea;
  color: #d23b3b;
  font-size: 1.3rem;
}

.expense-heading h2 {
  margin: 0;
  color: #101827;
  font-size: 1.55rem;
  font-weight: 900;
}

.expense-heading p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.84rem;
  font-weight: 700;
}

.expense-heading__tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.expense-search {
  width: 260px;
}

.expense-search :deep(.p-inputtext) {
  width: 100%;
  border-radius: 999px;
}

.cashier-cash-warning :deep(.p-message-content) {
  width: 100%;
}

.cashier-cash-warning span {
  flex: 1 1 auto;
}

.cashier-cash-warning a {
  flex: 0 0 auto;
  color: #92400e;
  font-weight: 900;
  text-decoration: underline;
}

.cashier-balance {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 16px;
  border-block: 1px solid #dbe7df;
  background: #f7fbf8;
}

.cashier-balance > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0f6d3f;
  font-size: 0.82rem;
  font-weight: 900;
}

.cashier-balance > div {
  display: grid;
  justify-items: end;
  gap: 2px;
}

.cashier-balance small {
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 800;
}

.cashier-balance strong {
  color: #123c29;
  font-size: 1.25rem;
  font-weight: 900;
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

.expense-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.expense-metric,
.expense-panel,
.ai-advice {
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.expense-metric {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 110px;
  padding: 16px;
}

.expense-metric__icon,
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
.expense-metric__icon {
  width: 58px;
  height: 58px;
  font-size: 2.3rem;
}

.expense-metric__icon.is-green,
.ai-advice__icon {
  background: #e8f7eb;
  color: #0b6f38;
}

.expense-metric__icon.is-blue {
  background: #eaf3ff;
  color: #2f7ded;
}

.expense-metric__icon.is-gold {
  background: #fff8d8;
  color: #9a6b00;
}

.expense-metric__icon.is-orange {
  background: #fff0e8;
  color: #ff6b2c;
}

.expense-metric__icon.is-purple {
  background: #f3eeff;
  color: #8b5cf6;
}

.expense-metric__icon.is-red {
  background: #fdeaea;
  color: #d23b3b;
}

.expense-metric small,
.panel-head span {
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 800;
}

.expense-metric strong {
  display: block;
  margin-top: 6px;
  color: #111827;
  font-size: 1.12rem;
  font-weight: 900;
}

.expense-metric em {
  display: block;
  margin-top: 8px;
  overflow: hidden;
  color: #64748b;
  font-size: 0.74rem;
  font-style: normal;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Grid principal --- */
.expense-grid {
  display: grid;
  gap: 14px;
  align-items: start;
}

.expense-panel {
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

.kind-filter {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 3px;
  border: 1px solid #e5eaf0;
  border-radius: 999px;
  background: #f8fafc;
}

.kind-filter button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  border-radius: 999px;
  padding: 6px 11px;
  background: transparent;
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.kind-filter button b {
  font-size: 0.7rem;
  opacity: 0.8;
}

.kind-filter button.is-active {
  background: #d23b3b;
  color: #fff;
}

.expense-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.expense-list li {
  display: grid;
  grid-template-columns: 94px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 10px;
  background: #f9fafb;
}

.expense-list.can-void li {
  grid-template-columns: 94px minmax(0, 1fr) auto auto 36px;
}

.expense-date {
  display: grid;
  gap: 2px;
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 800;
}

.expense-date strong {
  color: #475569;
  font-size: 0.74rem;
}

.expense-date small {
  color: #7c8899;
  font-size: 0.62rem;
  line-height: 1.25;
}

.expense-main {
  min-width: 0;
}

.expense-main strong {
  display: block;
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-main small {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
}

.expense-main :deep(.p-tag) {
  font-size: 0.62rem;
  font-weight: 900;
  padding: 1px 6px;
}

.expense-method {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #475569;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.expense-method i {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  background: #eef2f7;
  color: #475569;
  font-size: 0.7rem;
}

.expense-amount {
  color: #b91c1c;
  font-size: 0.9rem;
  font-weight: 900;
  white-space: nowrap;
}

.expense-empty {
  display: block;
  padding: 22px 12px;
  color: #94a3b8;
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
}

.expense-subtotal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 12px 14px;
  border-top: 1px solid #eadfdd;
  background: #fff8f7;
}

.expense-subtotal span {
  display: grid;
  gap: 2px;
}

.expense-subtotal small,
.expense-subtotal b {
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 800;
}

.expense-subtotal strong {
  color: #b91c1c;
  font-size: 1rem;
  font-weight: 900;
  white-space: nowrap;
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
  background: linear-gradient(90deg, #ffffff 0%, #f7fff8 68%, #eef9ec 100%);
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

/* --- Diálogos --- */
.expense-dialog {
  width: min(560px, calc(100vw - 24px));
}

.dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.dialog-form .full,
.dialog-form footer {
  grid-column: 1 / -1;
}

.dialog-form footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
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
.field :deep(.p-select) {
  width: 100%;
  font-size: 0.86rem;
}

.field :deep(.p-selectbutton) {
  width: 100%;
}

.field :deep(.p-selectbutton .p-togglebutton) {
  flex: 1 1 0;
}

/* --- Responsivo --- */

@media (max-width: 760px) {
  .expense-heading,
  .expense-heading__tools,
  .period-switch {
    align-items: stretch;
    flex-direction: column;
  }

  .expense-heading__tools,
  .expense-search {
    width: 100%;
  }

  .ai-advice {
    grid-template-columns: 1fr;
  }

  /* Las 3 tarjetas se mantienen en una fila también en móvil, compactas. */
  .expense-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .expense-metric {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-height: 0;
    padding: 12px 10px;
  }

  .expense-metric__icon {
    width: 38px;
    height: 38px;
    font-size: 1.4rem;
  }

  .expense-metric strong {
    margin-top: 2px;
    font-size: 0.92rem;
  }

  .expense-metric small {
    font-size: 0.62rem;
  }

  .expense-metric em {
    margin-top: 4px;
    font-size: 0.62rem;
  }

  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .dialog-form {
    grid-template-columns: 1fr;
  }

  .ai-advice {
    grid-template-columns: auto 1fr;
  }

  .ai-advice img {
    display: none;
  }
}

@media (max-width: 460px) {
  .expense-list li {
    grid-template-columns: 70px minmax(0, 1fr) auto;
  }

  .expense-list.can-void li {
    grid-template-columns: 70px minmax(0, 1fr) auto 36px;
  }

  .expense-method {
    display: none;
  }
}

/* --- Tendencia de gastos (paralelo a Ingresos, tema rojo) --- */
.expense-trend {
  display: grid;
  gap: 18px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #f1e3e0;
  border-radius: 18px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.trend-chart {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  align-items: end;
  gap: 8px;
  min-height: 150px;
}

.trend-bar {
  display: grid;
  justify-items: center;
  gap: 5px;
  align-content: end;
  text-align: center;
}

.trend-bar > span {
  font-size: 0.72rem;
  font-weight: 800;
  color: #b3261e;
}

.trend-bar > div {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 96px;
}

.trend-bar b {
  display: block;
  width: 100%;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #f87171, #dc2626);
}

.trend-bar > strong {
  font-size: 0.76rem;
  font-weight: 800;
  color: #1f2937;
}

.trend-bar > small {
  font-size: 0.68rem;
  color: #94a3b8;
}

.month-comparison {
  display: grid;
  gap: 14px;
  padding-top: 6px;
  border-top: 1px dashed #efe1de;
}

.month-comparison__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.month-comparison__head span {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #94a3b8;
}

.month-comparison__head h3 {
  margin: 2px 0 0;
  font-size: 1rem;
  font-weight: 900;
  color: #1f2937;
}

.month-comparison__head strong {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.82rem;
  font-weight: 900;
}

.month-comparison__head strong.is-up {
  color: #b3261e;
}

.month-comparison__head strong.is-down {
  color: #0a8f3a;
}

.month-bars {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  align-items: end;
  gap: 8px;
  min-height: 130px;
}

.month-bar {
  display: grid;
  justify-items: center;
  gap: 5px;
  align-content: end;
}

.month-bar > span {
  font-size: 0.7rem;
  font-weight: 800;
  color: #6b7280;
}

.month-bar > div {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 84px;
}

.month-bar b {
  display: block;
  width: 100%;
  border-radius: 8px 8px 0 0;
  background: #fca5a5;
}

.month-bar.is-current b {
  background: linear-gradient(180deg, #f87171, #dc2626);
}

.month-bar > strong {
  font-size: 0.74rem;
  font-weight: 800;
  color: #1f2937;
}

.expense-breakdown {
  display: grid;
  gap: 14px;
  padding: 18px 0;
  border-top: 1px solid #e5eaf0;
  border-bottom: 1px solid #e5eaf0;
}

.expense-breakdown > header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.expense-breakdown header span {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.expense-breakdown h2 {
  margin: 3px 0 0;
  font-size: 1rem;
  font-weight: 900;
}

.expense-breakdown > header > strong {
  color: #b91c1c;
  font-size: 1rem;
  white-space: nowrap;
}

.expense-breakdown ul {
  display: grid;
  gap: 11px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.expense-breakdown li {
  display: grid;
  grid-template-columns: minmax(140px, 0.7fr) minmax(120px, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.expense-breakdown__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #334155;
  font-size: 0.8rem;
  font-weight: 800;
}

.expense-breakdown__label i {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.expense-breakdown__bar {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef2f7;
}

.expense-breakdown__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.expense-breakdown li > strong {
  color: #334155;
  font-size: 0.8rem;
  white-space: nowrap;
}

.expense-breakdown > p {
  margin: 0;
  color: #64748b;
  font-size: 0.82rem;
}

@media (max-width: 760px) {
  .expense-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .expense-metric:first-child {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
  }

  .expense-breakdown {
    padding: 14px 0;
  }

  .expense-breakdown > header {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .expense-breakdown li {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px 10px;
  }

  .expense-breakdown__bar {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .expense-list li,
  .expense-list.can-void li {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "date amount"
      "main action";
    gap: 7px 10px;
  }

  .expense-date { grid-area: date; }
  .expense-main { grid-area: main; }
  .expense-method { display: none; }
  .expense-amount { grid-area: amount; }
  .expense-void-button {
    grid-area: action;
    justify-self: end;
  }

  .trend-chart,
  .month-bars {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
  }

  .trend-bar {
    flex: 0 0 84px;
    scroll-snap-align: start;
  }

  .month-bar {
    flex: 0 0 72px;
  }

  :global(.expense-dialog.p-dialog) {
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
  }
}
</style>
