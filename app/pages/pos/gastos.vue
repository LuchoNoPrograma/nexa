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
type KindFilter = 'todos' | ExpenseKind

interface ExpenseRow {
  id: string
  date: string
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

const periodCopy: Record<PeriodKey, { subtitle: string, advice: string[] }> = {
  today: {
    subtitle: 'Gastos realizados hoy · Lunes, 15 de junio de 2026',
    advice: [
      'Separa la compra de fruta como inversión de inventario, no como gasto perdido.',
      'Transporte y publicidad son pequeños, pero repetidos. Ponles un límite diario.',
    ],
  },
  week: {
    subtitle: 'Semana actual · 9 al 15 de junio de 2026',
    advice: [
      'Las compras de inventario están dentro de una reposición normal; compáralas con ventas antes de recortar.',
      'Publicidad debe medirse por pedidos generados. Si no trae ventas, baja el monto la próxima semana.',
    ],
  },
  month: {
    subtitle: 'Mes actual · Junio 2026',
    advice: [
      'Inventario no es pérdida inmediata: revisa si esa mercadería rota antes de volver a comprar.',
      'Sueldos deben leerse contra ventas del mes. Si ventas bajan, ajusta turnos antes que calidad.',
    ],
  },
}

const activePeriod = ref<PeriodKey>('month')
const kindFilter = ref<KindFilter>('todos')
const searchTerm = ref('')
const registerDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const session = usePosSession()
const cashMovementVoidDialog = useCashMovementVoidDialog()
const voidingMovementId = ref('')
const canVoidMovements = computed(() => session.value?.roles.includes('propietario') ?? false)

const currentCopy = computed(() => periodCopy[activePeriod.value])

// --- Gastos reales del periodo (API) ---
type ApiGasto = { id: string, fecha: string, categoria: string, concepto: string, metodo: string, monto: number }
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
  if (activePeriod.value === 'today') return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  if (activePeriod.value === 'week') return d.toLocaleDateString('es-BO', { weekday: 'short' })
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
}

const rows = computed<ExpenseRow[]>(() => (gastosData.value?.gastos ?? []).map((g) => {
  const meta = categoryMeta(g.categoria)
  return {
    id: g.id,
    date: formatExpenseDate(g.fecha),
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

// Top de compras de inventario (a quién/qué le compraste más).
const topPurchases = computed(() => rows.value
  .filter(r => r.kind === 'Inventario')
  .sort((a, b) => b.amount - a.amount)
  .slice(0, 4))

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
  { label: 'Compras de inventario', value: money(inventoryTotal.value), meta: `${sharePercent(inventoryTotal.value)}% · sube tu stock`, icon: 'fluent-emoji:package', tone: 'blue' },
  { label: 'Gastos operativos', value: money(operativeTotal.value), meta: `${sharePercent(operativeTotal.value)}% · dinero consumido`, icon: 'fluent-emoji:high-voltage', tone: 'orange' },
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
    const matchesTerm = !term || [row.concept, row.category, row.method, row.supplier ?? '']
      .some(value => value.toLowerCase().includes(term))

    return matchesKind && matchesTerm
  })
})

// --- Registrar gasto (persiste en BD) ---
// Categorías operativas/financieras (la de inventario se elige con el tipo de gasto).
const categoryOptions = CATEGORIAS_EGRESO
  .filter((c) => c.grupo !== 'inventario')
  .map((c) => ({ label: c.label, value: c.value }))
const methodOptions: Method[] = ['Efectivo', 'QR', 'Transferencia']

const registerForm = reactive({
  kind: 'Operativo' as ExpenseKind,
  concept: '',
  category: 'alquiler',
  supplier: '',
  method: 'Efectivo' as Method,
  amount: 0,
})
const savingExpense = ref(false)
const registerError = ref('')

const canSaveExpense = computed(() => registerForm.concept.trim().length > 0 && Number(registerForm.amount || 0) > 0)

function openRegisterDialog() {
  registerForm.kind = 'Operativo'
  registerForm.concept = ''
  registerForm.category = 'alquiler'
  registerForm.supplier = ''
  registerForm.method = 'Efectivo'
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
        metodo: registerForm.method.toLowerCase(),
      },
    })

    registerDialogVisible.value = false
    await refreshGastos()
  } catch (error) {
    registerError.value = error instanceof Error ? error.message : 'No se pudo guardar el gasto.'
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

function exportReport(format: 'PDF' | 'Excel' | 'Imprimir') {
  exportDialogVisible.value = false

  if (format === 'Imprimir' && import.meta.client) {
    window.print()
  }
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

        <Button type="button" icon="pi pi-download" label="Exportar" outlined @click="exportDialogVisible = true" />
        <Button type="button" icon="pi pi-plus" label="Registrar gasto" @click="openRegisterDialog" />
      </div>
    </section>

    <section class="period-switch" aria-label="Periodo de gastos">
      <SelectButton v-model="activePeriod" :options="periodOptions" option-label="label" option-value="value" />`
    </section>

    <section class="expense-metrics" aria-label="Resumen de gastos">
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

    <!-- Split principal: Compras de inventario vs Gastos operativos (2 cols desktop / 1 col tablet-móvil) -->
    <section class="expense-split" aria-label="Tipos de gasto">
      <article class="split-card is-inventory">
        <header>
          <span class="split-card__icon"><Icon name="fluent-emoji:package" aria-hidden="true" /></span>
          <div>
            <small>Compras de inventario</small>
            <strong>{{ money(inventoryTotal) }}</strong>
          </div>
          <span class="split-card__share">{{ sharePercent(inventoryTotal) }}%</span>
        </header>

        <div class="split-card__bar"><i :style="{ width: `${sharePercent(inventoryTotal)}%` }" /></div>
        <p class="split-card__hint">
          <i class="pi pi-info-circle" aria-hidden="true" />
          Sube tu stock: es dinero que sigues teniendo en mercadería.
        </p>

        <ul v-if="topPurchases.length" class="split-card__list">
          <li v-for="row in topPurchases" :key="row.concept + row.date">
            <span class="dot" />
            <span class="split-card__name">
              <strong>{{ row.concept }}</strong>
              <small>{{ row.supplier }}</small>
            </span>
            <strong class="split-card__amount">{{ money(row.amount) }}</strong>
          </li>
        </ul>
        <p v-else class="split-card__empty">Sin compras de inventario en este periodo.</p>

        <NuxtLink to="/pos/catalogo" class="split-card__link">
          Ver mi inventario <i class="pi pi-arrow-right" aria-hidden="true" />
        </NuxtLink>
      </article>

      <article class="split-card is-operative">
        <header>
          <span class="split-card__icon"><Icon name="fluent-emoji:high-voltage" aria-hidden="true" /></span>
          <div>
            <small>Gastos operativos</small>
            <strong>{{ money(operativeTotal) }}</strong>
          </div>
          <span class="split-card__share">{{ sharePercent(operativeTotal) }}%</span>
        </header>

        <div class="split-card__bar is-operative"><i :style="{ width: `${sharePercent(operativeTotal)}%` }" /></div>
        <p class="split-card__hint">
          <i class="pi pi-info-circle" aria-hidden="true" />
          Dinero consumido (alquiler, sueldos, servicios): no vuelve como stock.
        </p>

        <ul v-if="operativeCategories.length" class="split-card__list">
          <li v-for="cat in operativeCategories" :key="cat.label">
            <span class="dot" :style="{ background: cat.color }" />
            <span class="split-card__name">
              <strong>{{ cat.label }}</strong>
              <small>{{ cat.percent }}% de operativos</small>
            </span>
            <strong class="split-card__amount">{{ money(cat.amount) }}</strong>
          </li>
        </ul>
        <p v-else class="split-card__empty">Sin gastos operativos en este periodo.</p>
      </article>
    </section>

    <!-- Tendencia de gastos (igual que Ingresos): por día en Semana, por semana en Mes -->
    <section v-if="activePeriod !== 'today'" class="expense-trend" aria-label="Tendencia de gastos">
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
          <div class="kind-filter" role="group" aria-label="Filtrar por tipo de gasto">
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

        <ul class="expense-list">
          <li v-for="(row, index) in visibleRows" :key="row.concept + row.date + index">
            <span class="expense-date">{{ row.date }}</span>
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
              type="button"
              icon="pi pi-ban"
              label="Anular"
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
      </article>

    </section>

    <section class="ai-advice">
      <span class="ai-advice__icon"><i class="pi pi-lightbulb" aria-hidden="true" /></span>
      <div>
        <h2>Consejo de Haru</h2>
        <p v-for="line in currentCopy.advice" :key="line">{{ line }}</p>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true">
    </section>

    <!-- Diálogo: registrar gasto (persiste en BD vía /api/pos/gastos) -->
    <Dialog v-model:visible="registerDialogVisible" modal header="Registrar gasto" class="expense-dialog">
      <form class="dialog-form" @submit.prevent="saveExpense">
        <label class="field full">
          <span>Tipo de gasto</span>
          <SelectButton v-model="registerForm.kind" :options="['Operativo', 'Inventario']" :allow-empty="false" />
        </label>

        <!-- Inventario: no es un gasto plano, entra mercadería que suma stock.
             Se registra en el inventario, así que llevamos al usuario allí. -->
        <template v-if="registerForm.kind === 'Inventario'">
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

    <!-- Diálogo: exportar -->
    <Dialog v-model:visible="exportDialogVisible" modal header="Exportar gastos" class="export-dialog">
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
.split-card,
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

/* --- Split: inventario vs operativo (2 cols -> 1 col) --- */
.expense-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.split-card {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.split-card header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.split-card__icon {
  display: grid;
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  font-size: 1.9rem;
}

.split-card.is-inventory .split-card__icon {
  background: #eaf3ff;
  color: #2f7ded;
}

.split-card.is-operative .split-card__icon {
  background: #fff0e8;
  color: #ff6b2c;
}

.split-card header small {
  display: block;
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 800;
}

.split-card header strong {
  display: block;
  margin-top: 2px;
  font-size: 1.5rem;
  font-weight: 900;
}

.split-card__share {
  margin-left: auto;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 0.78rem;
  font-weight: 900;
}

.split-card__bar {
  height: 8px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.split-card__bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2f7ded, #1d4ed8);
}

.split-card__bar.is-operative i {
  background: linear-gradient(90deg, #ff8a4c, #ea580c);
}

.split-card__hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: #5b6b7b;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.4;
}

.split-card__hint i {
  margin-top: 1px;
  color: #94a3b8;
}

.split-card__list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.split-card__list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #2f7ded;
}

.split-card__name {
  min-width: 0;
}

.split-card__name strong {
  display: block;
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split-card__name small {
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
}

.split-card__amount {
  font-size: 0.84rem;
  font-weight: 900;
  white-space: nowrap;
}

.split-card__empty {
  margin: 0;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 700;
}

.split-card__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1c7a2c;
  font-size: 0.8rem;
  font-weight: 900;
  text-decoration: none;
}

.split-card__link:hover {
  text-decoration: underline;
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
  grid-template-columns: 56px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 10px;
  background: #f9fafb;
}

.expense-date {
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 800;
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
  color: #0b6f38;
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

/* --- Responsivo --- */

/* Tablet y móvil: las tarjetas pasan a 1 columna */
@media (max-width: 1024px) {
  .expense-split {
    grid-template-columns: 1fr;
  }
}

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
    grid-template-columns: 48px minmax(0, 1fr) auto;
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
</style>
