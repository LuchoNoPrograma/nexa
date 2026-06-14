<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Finanzas',
})

useHead({
  title: 'Finanzas | NEXA',
})

type Tone = 'green' | 'red' | 'blue' | 'purple'

const toneClasses: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-orange-50 text-orange-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-violet-50 text-violet-600',
}

const metrics = [
  { label: 'Mis ingresos', value: 'Bs. 48,750', hint: 'vs. mes anterior', delta: '+18.4%', icon: 'pi pi-wallet', tone: 'green' as Tone },
  { label: 'Gastos realizados', value: 'Bs. 23,860', hint: 'vs. mes anterior', delta: '+9.7%', icon: 'pi pi-credit-card', tone: 'red' as Tone },
  { label: 'Ganancia neta', value: 'Bs. 24,890', hint: 'vs. mes anterior', delta: '+25.6%', icon: 'pi pi-chart-line', tone: 'green' as Tone },
  { label: 'Mis ventas diarias', value: 'Bs. 24,890', hint: 'Promedio diario', delta: '+14.2%', icon: 'pi pi-shopping-bag', tone: 'blue' as Tone },
  { label: 'Saldo disponible', value: 'Bs. 62,340', hint: 'En caja y bancos', delta: '+12.3%', icon: 'pi pi-database', tone: 'purple' as Tone },
]

const incomeRows = [
  { date: '24 May 2026', concept: 'Venta de productos', amount: 12450 },
  { date: '22 May 2026', concept: 'Servicio de consultoría', amount: 8900 },
  { date: '20 May 2026', concept: 'Venta de productos', amount: 7600 },
  { date: '18 May 2026', concept: 'Suscripción mensual', amount: 4600 },
]

const expenseRows = [
  { label: 'Servicios', amount: 7250, percent: 30, color: '#0f9e2e' },
  { label: 'Compras', amount: 6380, percent: 26, color: '#ffad0a' },
  { label: 'Sueldos', amount: 5640, percent: 23, color: '#3b82f6' },
  { label: 'Transporte', amount: 2450, percent: 10, color: '#2563eb' },
  { label: 'Publicidad', amount: 2140, percent: 9, color: '#8b5cf6' },
]

const dailySales = [
  { day: 'Lun', value: 27000 },
  { day: 'Mar', value: 18000 },
  { day: 'Mié', value: 32000 },
  { day: 'Jue', value: 26000 },
  { day: 'Vie', value: 16500 },
  { day: 'Dom', value: 29500 },
]

const topProducts = [
  { product: 'Bowl Açaí', sales: 12500, units: 250, profit: 2500, margin: 25, tone: 'green' },
  { product: 'Batidos', sales: 8400, units: 200, profit: 1200, margin: 14, tone: 'amber' },
  { product: 'Café', sales: 4800, units: 160, profit: 600, margin: 12, tone: 'amber' },
  { product: 'Conos', sales: 6200, units: 140, profit: 400, margin: 6, tone: 'red' },
  { product: 'Otros', sales: 3100, units: 120, profit: 300, margin: 10, tone: 'blue' },
]

const cost = ref(15)
const indirectCosts = ref(5)
const margin = ref(40)
const searchTerm = ref('')
const activeFilter = ref('overview')
const selectedPeriod = ref('may')

const periodOptions = [
  { label: 'Mayo 2026', value: 'may' },
  { label: 'Abril 2026', value: 'apr' },
  { label: 'Últimos 90 días', value: 'quarter' },
]

const financeFilters = [
  { key: 'overview', label: 'Resumen', count: 6 },
  { key: 'income', label: 'Ingresos', count: incomeRows.length },
  { key: 'expenses', label: 'Gastos', count: expenseRows.length },
  { key: 'prices', label: 'Precios', count: 1 },
]

const baseCost = computed(() => Number(cost.value || 0) + Number(indirectCosts.value || 0))
const recommendedPrice = computed(() => baseCost.value * (1 + Number(margin.value || 0) / 100))
const monthlyFixedCosts = 30000
const breakEvenUnits = computed(() => Math.ceil(monthlyFixedCosts / Math.max(recommendedPrice.value - baseCost.value, 1)))

const currencyFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(value: number) {
  return `Bs. ${currencyFormatter.format(value)}`
}

function compactMoney(value: number) {
  return `Bs. ${new Intl.NumberFormat('es-BO').format(value)}`
}
</script>

<template>
  <div class="finance-dashboard">
    <div class="finance-breadcrumb">
      <nav class="crumbs" aria-label="Ruta de finanzas">
        <span>Finanzas</span>
        <i class="pi pi-angle-right" aria-hidden="true" />
        <strong>Dashboard</strong>
      </nav>

      <div class="crumb-actions">
        <Select v-model="selectedPeriod" :options="periodOptions" optionLabel="label" optionValue="value" size="small" />
        <Button type="button" text rounded icon="pi pi-refresh" aria-label="Actualizar finanzas" />
      </div>
    </div>

    <section class="finance-heading">
      <div>
        <h2>Finanzas</h2>
        <p>Controla ingresos, gastos, precios y rentabilidad con datos listos para decidir.</p>
      </div>

      <div class="finance-heading__actions">
        <Button type="button" icon="pi pi-chart-bar" label="Ver reporte" outlined severity="success" />
        <Button type="button" icon="pi pi-plus" label="Registrar movimiento" severity="success" />
      </div>
    </section>

    <section class="finance-metrics" aria-label="Resumen financiero">
      <article v-for="metric in metrics" :key="metric.label" class="metric-card">
        <span class="metric-card__icon" :class="toneClasses[metric.tone]">
          <i :class="metric.icon" aria-hidden="true" />
        </span>
        <div>
          <small>{{ metric.label }}</small>
          <strong>{{ metric.value }}</strong>
          <span>
            {{ metric.hint }}
            <b :class="metric.tone === 'red' ? 'text-orange-600' : 'text-emerald-600'">
              <i class="pi pi-arrow-up" aria-hidden="true" /> {{ metric.delta }}
            </b>
          </span>
        </div>
      </article>
    </section>

    <div class="finance-toolbar">
      <IconField class="finance-search">
        <InputIcon>
          <i class="pi pi-search" />
        </InputIcon>
        <InputText v-model="searchTerm" placeholder="Buscar ingresos, gastos, productos o categorías..." />
      </IconField>

      <div class="finance-chips" role="tablist" aria-label="Filtros rápidos de finanzas">
        <button
          v-for="filter in financeFilters"
          :key="filter.key"
          type="button"
          class="finance-chip"
          :class="{ 'is-active': activeFilter === filter.key }"
          role="tab"
          :aria-selected="activeFilter === filter.key"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }}
          <span>{{ filter.count }}</span>
        </button>
      </div>
    </div>

    <section class="finance-board" aria-label="Paneles del módulo de finanzas">
      <article class="finance-panel income-panel">
        <header class="panel-head">
          <h2>1. Mis ingresos</h2>
          <Button type="button" text size="small" severity="success" icon="pi pi-arrow-right" label="Ver ingresos" @click="navigateTo('/pos/ingresos')" />
        </header>

        <div class="income-layout">
          <div>
            <DataTable :value="incomeRows" size="small" class="finance-table">
              <Column field="date" header="Fecha" />
              <Column field="concept" header="Concepto" />
              <Column header="Monto">
                <template #body="{ data }">
                  <strong class="amount-positive">{{ compactMoney(data.amount) }}</strong>
                </template>
              </Column>
            </DataTable>

            <footer class="panel-total">
              <span>Total ingresos</span>
              <strong>Bs. 48,750</strong>
            </footer>
          </div>

          <div class="income-chart">
            <span>Evolución de ingresos</span>
            <small>Últimos 6 meses</small>
            <svg viewBox="0 0 190 106" aria-hidden="true">
              <path class="grid-line" d="M10 82 H178 M10 60 H178 M10 38 H178" />
              <path class="chart-area" d="M12 86 L34 76 L56 68 L78 58 L100 62 L122 42 L144 46 L166 28 L180 12 L180 92 L12 92 Z" />
              <path class="chart-line" d="M12 86 L34 76 L56 68 L78 58 L100 62 L122 42 L144 46 L166 28 L180 12" />
              <g class="chart-dots">
                <circle cx="12" cy="86" r="3" />
                <circle cx="78" cy="58" r="3" />
                <circle cx="122" cy="42" r="3" />
                <circle cx="180" cy="12" r="3" />
              </g>
            </svg>
            <div class="months"><span>Dic</span><span>Ene</span><span>Feb</span><span>Mar</span><span>Abr</span><span>May</span></div>
          </div>
        </div>
      </article>

      <article class="finance-panel expenses-panel">
        <header class="panel-head">
          <h2>2. Gastos realizados</h2>
        </header>

        <div class="expense-layout">
          <div class="donut" aria-label="Total de gastos por categoría">
            <span>Bs. 23,860</span>
            <small>Total gastos</small>
          </div>

          <div class="expense-list">
            <div v-for="row in expenseRows" :key="row.label" class="expense-row">
              <span :style="{ backgroundColor: row.color }" />
              <strong>{{ row.label }}</strong>
              <em>{{ compactMoney(row.amount) }}</em>
              <small>{{ row.percent }}%</small>
            </div>
          </div>
        </div>
      </article>

      <article class="finance-panel calculator-panel">
        <header class="panel-head">
          <h2>3. ¿Cuánto costará mi producto?</h2>
        </header>

        <div class="formula-row" aria-label="Fórmula de precio">
          <span>Costo de producción</span>
          <b>+</b>
          <span>Gastos indirectos</span>
          <b>+</b>
          <span>Margen de ganancia</span>
          <b>=</b>
          <span>Precio de venta</span>
        </div>

        <div class="calc-layout">
          <div class="calc-inputs">
            <label>
              <span>Costo unitario</span>
              <InputNumber v-model="cost" input-id="cost" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
            </label>
            <label>
              <span>Gastos indirectos</span>
              <InputNumber v-model="indirectCosts" input-id="indirect-costs" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
            </label>
            <label>
              <span>Margen (%)</span>
              <InputNumber v-model="margin" input-id="margin" suffix=" %" :min="0" :max="300" fluid />
            </label>
          </div>

          <div class="price-card">
            <small>Precio recomendado</small>
            <strong>{{ money(recommendedPrice) }}</strong>
            <span>Por unidad <i class="pi pi-star-fill" aria-hidden="true" /></span>
          </div>
        </div>

        <Message severity="success" size="small" icon="pi pi-info-circle">
          Calcula el precio ideal para cubrir tus costos y obtener la ganancia que deseas.
        </Message>
      </article>

      <article class="finance-panel balance-panel">
        <header class="panel-head">
          <h2>4. Cantidad que debería vender</h2>
        </header>

        <div class="balance-layout">
          <div class="units-card">
            <small>Debes vender</small>
            <strong>{{ breakEvenUnits }}</strong>
            <span>unidades</span>
            <em>para cubrir todos tus costos y gastos.</em>
            <i class="pi pi-bullseye" aria-hidden="true" />
          </div>

          <div class="break-chart">
            <span>Costos vs. Ingresos</span>
            <svg viewBox="0 0 370 200" aria-hidden="true">
              <path class="grid-line" d="M34 168 H348 M34 124 H348 M34 80 H348 M34 36 H348" />
              <path class="axis-line" d="M34 20 V168 H350" />
              <path class="cost-line" d="M36 154 L348 74" />
              <path class="income-line" d="M36 170 L348 28" />
              <path class="break-line" d="M218 62 V168" />
              <circle cx="218" cy="84" r="7" />
              <text x="232" y="112">Punto de equilibrio</text>
              <text x="232" y="129">{{ breakEvenUnits }} unidades</text>
            </svg>
          </div>
        </div>
      </article>

      <article class="finance-panel daily-panel">
        <header class="panel-head">
          <h2>5. Mis ventas diarias</h2>
        </header>

        <div class="daily-layout">
          <div class="daily-summary">
            <small>Promedio diario</small>
            <strong>Bs. 24,890</strong>
            <b><i class="pi pi-arrow-up" aria-hidden="true" /> 14.2%</b>
            <span>vs. mes anterior</span>
          </div>

          <div class="bar-chart">
            <span>Ventas por día (últimos 7 días)</span>
            <div class="bars">
              <div v-for="day in dailySales" :key="day.day">
                <i :style="{ height: `${Math.max(28, day.value / 360)}px` }" />
                <small>{{ day.day }}</small>
              </div>
            </div>
          </div>
        </div>

        <Message severity="success" size="small" icon="pi pi-calendar">
          Lleva un control diario de tus ventas y conoce tu promedio para mejorar tu planificación.
        </Message>
      </article>

      <article class="finance-panel products-panel">
        <header class="panel-head">
          <h2>6. ¿Qué producto sale más?</h2>
        </header>

        <DataTable :value="topProducts" size="small" class="finance-table product-table">
          <Column field="product" header="Producto" />
          <Column header="Ventas">
            <template #body="{ data }">{{ compactMoney(data.sales) }}</template>
          </Column>
          <Column field="units" header="Unidades" />
          <Column header="Ganancia">
            <template #body="{ data }">{{ compactMoney(data.profit) }}</template>
          </Column>
          <Column header="Margen">
            <template #body="{ data }">
              <div class="margin-cell">
                <span>{{ data.margin }}%</span>
                <i :class="`is-${data.tone}`" :style="{ width: `${Math.max(data.margin * 2.1, 18)}px` }" />
              </div>
            </template>
          </Column>
        </DataTable>

        <Message severity="warn" size="small" icon="pi pi-star">
          Conoce qué productos generan más ganancias y cuáles puedes mejorar.
        </Message>
      </article>
    </section>

    <section class="finance-footer-grid">
      <article class="info-panel module-panel">
        <div>
          <h2><i class="pi pi-chart-bar" aria-hidden="true" /> ¿Qué puedes ver en este módulo?</h2>
          <p>Toda la información financiera de tu negocio en un solo lugar para tomar mejores decisiones.</p>
          <ul>
            <li><i class="pi pi-check" /> Resumen de ingresos y gastos</li>
            <li><i class="pi pi-check" /> Evolución de tus ventas</li>
            <li><i class="pi pi-check" /> Rentabilidad por producto</li>
            <li><i class="pi pi-check" /> Gastos por categoría</li>
            <li><i class="pi pi-check" /> Flujo de caja</li>
            <li><i class="pi pi-check" /> Y mucho más...</li>
          </ul>
        </div>
        <div class="monitor-illustration" aria-hidden="true">
          <i class="pi pi-desktop" />
          <span />
        </div>
      </article>

      <article class="info-panel register-panel">
        <h2><i class="pi pi-dollar" aria-hidden="true" /> ¿Qué puedes registrar en tu negocio?</h2>
        <p>Registra tus operaciones de forma rápida y sencilla para mantener tu información siempre actualizada.</p>

        <div class="register-grid">
          <div>
            <i class="pi pi-dollar" />
            <strong>Ingresos</strong>
            <span>Registra ventas o entradas de dinero.</span>
          </div>
          <div>
            <i class="pi pi-credit-card is-orange" />
            <strong>Gastos</strong>
            <span>Registra tus gastos y desembolsos.</span>
          </div>
          <div>
            <i class="pi pi-shopping-cart is-blue" />
            <strong>Ventas</strong>
            <span>Registra ventas diarias.</span>
          </div>
          <div>
            <i class="pi pi-database is-purple" />
            <strong>Costos</strong>
            <span>Registra costos de tus productos.</span>
          </div>
        </div>

        <small>Una vez guardado, el registro se reflejará automáticamente en el dashboard y en los reportes.</small>
      </article>
    </section>
  </div>
</template>

<style scoped>
.finance-dashboard {
  display: grid;
  gap: 14px;
  padding: 12px 0 0;
  color: #102016;
}

.finance-breadcrumb {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.crumbs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 0.86rem;
  font-weight: 700;
}

.crumbs strong {
  color: #0f172a;
}

.crumbs i {
  color: #94a3b8;
  font-size: 0.7rem;
}

.crumb-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.finance-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.finance-heading h2 {
  margin: 0;
  color: #071327;
  font-size: 1.6rem;
  font-weight: 900;
}

.finance-heading p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 600;
}

.finance-heading__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.finance-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.metric-card,
.finance-panel,
.info-panel {
  border: 1px solid #e5ece7;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.metric-card {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
  min-height: 96px;
  padding: 14px 16px;
}

.metric-card__icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 16px;
  font-size: 1.35rem;
}

.metric-card small,
.finance-panel small,
.calc-inputs span,
.formula-row,
.register-grid span,
.info-panel p,
.info-panel small {
  color: #6b7570;
  font-size: 0.72rem;
  font-weight: 800;
}

.metric-card strong {
  display: block;
  margin-top: 3px;
  color: #121c17;
  font-size: 1.08rem;
  font-weight: 900;
}

.metric-card span:not(.metric-card__icon) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  color: #6b7570;
  font-size: 0.68rem;
  font-weight: 800;
}

.metric-card b {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.finance-toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 0.95fr) minmax(0, 1.25fr);
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.finance-search {
  width: 100%;
}

.finance-search :deep(.p-inputtext) {
  width: 100%;
  border-radius: 10px;
  font-size: 0.82rem;
}

.finance-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.finance-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #dbe5df;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 900;
}

.finance-chip span {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.66rem;
}

.finance-chip.is-active {
  border-color: rgba(15, 158, 46, 0.26);
  background: #ecfdf0;
  color: #0a6f1f;
}

.finance-chip.is-active span {
  background: #0f9e2e;
  color: #ffffff;
}

.finance-board {
  display: grid;
  grid-template-columns: minmax(330px, 1.12fr) minmax(300px, 0.95fr) minmax(330px, 1fr);
  gap: 12px;
}

.finance-panel {
  min-width: 0;
  padding: 16px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.panel-head h2 {
  margin: 0;
  color: #17221b;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 0.95rem;
  font-weight: 900;
  letter-spacing: 0;
}

.income-panel,
.balance-panel {
  grid-column: span 1;
}

.income-layout,
.expense-layout,
.balance-layout,
.daily-layout {
  display: grid;
  gap: 16px;
}

.income-layout,
.balance-layout {
  grid-template-columns: minmax(0, 1fr) minmax(165px, 0.75fr);
  align-items: center;
}

.expense-layout {
  grid-template-columns: 150px minmax(190px, 1fr);
  align-items: center;
}

.finance-table :deep(.p-datatable-header-cell),
.finance-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.45rem 0.4rem;
  border-color: transparent;
  background: transparent;
  color: #253029;
  font-size: 0.7rem;
}

.finance-table :deep(.p-datatable-header-cell) {
  color: #4e5b53;
  font-weight: 900;
}

.finance-table :deep(.p-datatable-tbody > tr) {
  background: transparent;
}

.amount-positive,
.panel-total strong {
  color: #0f9e2e;
}

.panel-total {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid #eef3ef;
  font-size: 0.78rem;
  font-weight: 900;
}

.income-chart span,
.break-chart span,
.bar-chart span {
  display: block;
  color: #253029;
  font-size: 0.72rem;
  font-weight: 900;
}

.income-chart svg,
.break-chart svg {
  width: 100%;
  overflow: visible;
}

.grid-line {
  fill: none;
  stroke: #e9f0eb;
  stroke-width: 1;
}

.axis-line {
  fill: none;
  stroke: #cbd7cf;
  stroke-width: 1.5;
}

.chart-area {
  fill: rgba(15, 158, 46, 0.12);
}

.chart-line,
.income-line {
  fill: none;
  stroke: #0f8f29;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 4;
}

.chart-dots circle,
.break-chart circle {
  fill: #0f9e2e;
  stroke: #ffffff;
  stroke-width: 3;
}

.months {
  display: flex;
  justify-content: space-between;
  color: #6b7570;
  font-size: 0.64rem;
  font-weight: 800;
}

.donut {
  display: grid;
  width: 150px;
  aspect-ratio: 1;
  place-items: center;
  justify-self: center;
  border-radius: 50%;
  background:
    radial-gradient(circle, #ffffff 0 43%, transparent 44%),
    conic-gradient(#0f9e2e 0 30%, #ffad0a 30% 56%, #3b82f6 56% 79%, #2563eb 79% 90%, #8b5cf6 90% 100%);
}

.donut span {
  align-self: end;
  font-size: 0.92rem;
  font-weight: 900;
}

.donut small {
  align-self: start;
}

.expense-list {
  display: grid;
  gap: 10px;
}

.expense-row {
  display: grid;
  grid-template-columns: auto minmax(78px, 1fr) minmax(68px, auto) 34px;
  gap: 10px;
  align-items: center;
  color: #26322a;
  font-size: 0.72rem;
}

.expense-row span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.expense-row strong {
  font-weight: 900;
}

.expense-row em {
  color: #4d5b52;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
}

.formula-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  gap: 7px;
  align-items: center;
  margin-bottom: 14px;
  text-align: center;
}

.formula-row b {
  color: #0f9e2e;
  font-size: 0.9rem;
}

.calc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 138px;
  gap: 12px;
  align-items: stretch;
}

.calc-inputs {
  display: grid;
  grid-template-columns: repeat(3, minmax(92px, 1fr));
  gap: 10px;
}

.calc-inputs label {
  display: grid;
  gap: 7px;
}

.calc-inputs :deep(.p-inputnumber-input) {
  width: 100%;
  min-height: 44px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 800;
}

.price-card {
  display: grid;
  place-items: center;
  min-height: 110px;
  padding: 12px;
  border-radius: 8px;
  background: #eef8ec;
  color: #0a6f1f;
  text-align: center;
}

.price-card strong {
  font-size: 1.42rem;
  font-weight: 900;
}

.price-card span {
  color: #6b7570;
  font-size: 0.68rem;
  font-weight: 900;
}

.price-card i {
  color: #f2b400;
}

.calculator-panel :deep(.p-message),
.daily-panel :deep(.p-message),
.products-panel :deep(.p-message) {
  margin: 12px 0 0;
  border-radius: 8px;
  font-size: 0.72rem;
}

.units-card {
  display: grid;
  justify-items: center;
  align-content: center;
  min-height: 180px;
  padding: 14px;
  border-radius: 8px;
  background: #f4faf2;
  text-align: center;
}

.units-card strong {
  color: #0f8f29;
  font-size: 2.25rem;
  line-height: 1;
  font-weight: 900;
}

.units-card span {
  color: #0a6f1f;
  font-size: 0.9rem;
  font-weight: 900;
}

.units-card em {
  max-width: 130px;
  margin-top: 12px;
  color: #4e5b53;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 800;
}

.units-card i {
  margin-top: 12px;
  color: #0f9e2e;
  font-size: 1.55rem;
}

.cost-line {
  fill: none;
  stroke: #ff5b2e;
  stroke-dasharray: 6 6;
  stroke-linecap: round;
  stroke-width: 3;
}

.break-line {
  fill: none;
  stroke: #80a18c;
  stroke-dasharray: 4 5;
  stroke-width: 2;
}

.break-chart text {
  fill: #4e5b53;
  font-size: 0.7rem;
  font-weight: 800;
}

.daily-layout {
  grid-template-columns: 130px minmax(0, 1fr);
  align-items: center;
}

.daily-summary {
  display: grid;
  gap: 6px;
  min-height: 126px;
  align-content: center;
  padding: 12px;
  border-radius: 8px;
  background: #f5faf2;
}

.daily-summary strong {
  font-size: 1.08rem;
  font-weight: 900;
}

.daily-summary b {
  color: #0f9e2e;
  font-size: 0.78rem;
}

.daily-summary span {
  color: #6b7570;
  font-size: 0.68rem;
  font-weight: 800;
}

.bar-chart {
  display: grid;
  gap: 12px;
}

.bars {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: end;
  min-height: 126px;
  padding-left: 10px;
  border-left: 1px solid #e3ece6;
  border-bottom: 1px solid #e3ece6;
}

.bars div {
  display: grid;
  justify-items: center;
  align-items: end;
  gap: 7px;
}

.bars i {
  display: block;
  width: 22px;
  border-radius: 5px 5px 0 0;
  background: #1aa037;
}

.bars small {
  color: #4e5b53;
}

.product-table :deep(.p-datatable-tbody > tr > td) {
  padding-top: 0.38rem;
  padding-bottom: 0.38rem;
}

.margin-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.margin-cell span {
  width: 28px;
  color: #26322a;
  font-size: 0.68rem;
  font-weight: 900;
}

.margin-cell i {
  display: block;
  height: 8px;
  border-radius: 999px;
}

.margin-cell .is-green {
  background: #22a537;
}

.margin-cell .is-amber {
  background: #ffad0a;
}

.margin-cell .is-red {
  background: #ff5b2e;
}

.margin-cell .is-blue {
  background: #3b82f6;
}

.finance-footer-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 12px;
}

.info-panel {
  display: grid;
  gap: 12px;
  padding: 18px 20px;
}

.module-panel {
  grid-template-columns: minmax(0, 1fr) 130px;
  align-items: center;
}

.info-panel h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #0a6f1f;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1rem;
  font-weight: 900;
}

.info-panel p {
  margin: 4px 0 10px;
}

.info-panel ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.info-panel li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #28352c;
  font-size: 0.72rem;
  font-weight: 800;
}

.info-panel li i {
  color: #18a13b;
}

.monitor-illustration {
  display: grid;
  place-items: center;
  justify-self: end;
  width: 116px;
  height: 86px;
  border: 1px solid #cfdcd4;
  border-radius: 8px;
  background: #eef7f1;
  color: #0f9e2e;
  font-size: 2rem;
}

.register-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.register-grid div {
  display: grid;
  gap: 5px;
  justify-items: center;
  text-align: center;
}

.register-grid i {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  background: #e9f8eb;
  color: #0f9e2e;
  font-size: 1.2rem;
}

.register-grid .is-orange {
  background: #fff1e8;
  color: #ff5b2e;
}

.register-grid .is-blue {
  background: #eef5ff;
  color: #2563eb;
}

.register-grid .is-purple {
  background: #f3eeff;
  color: #8b5cf6;
}

.register-grid strong {
  font-size: 0.76rem;
  font-weight: 900;
}

@media (max-width: 1680px) {
  .finance-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .calculator-panel,
  .products-panel {
    grid-column: span 2;
  }

  .calculator-panel .formula-row {
    grid-template-columns: repeat(7, auto);
    justify-content: start;
  }
}

@media (max-width: 1320px) {
  .finance-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 920px) {
  .finance-breadcrumb,
  .finance-heading,
  .finance-heading__actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .finance-heading__actions,
  .crumb-actions {
    width: 100%;
  }

  .finance-metrics,
  .finance-toolbar,
  .finance-board,
  .finance-footer-grid,
  .income-layout,
  .expense-layout,
  .balance-layout,
  .daily-layout,
  .calc-layout,
  .module-panel,
  .info-panel ul,
  .register-grid {
    grid-template-columns: 1fr;
  }

  .finance-chips {
    justify-content: flex-start;
  }

  .calculator-panel,
  .products-panel {
    grid-column: auto;
  }

  .monitor-illustration {
    justify-self: start;
  }
}

@media (max-width: 560px) {
  .finance-panel,
  .info-panel {
    padding: 14px;
  }

  .metric-card {
    min-height: auto;
  }

  .calc-inputs,
  .formula-row {
    grid-template-columns: 1fr;
    text-align: left;
  }

  .formula-row b {
    display: none;
  }

  .bars i {
    width: 16px;
  }
}
</style>
