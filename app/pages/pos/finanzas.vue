<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Finanzas',
})

useHead({
  title: 'Finanzas | NEXA',
})

type Tone = 'green' | 'red' | 'amber' | 'blue'

const toneClasses: Record<Tone, string> = {
  green: 'bg-primary-50 text-primary-700',
  red: 'bg-red-50 text-red-500',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
}

const metrics = [
  { label: 'Ingresos del mes', value: 'Bs. 48,750', hint: 'vs. mes anterior', delta: '+18.4%', icon: 'pi pi-wallet', tone: 'green' as Tone },
  { label: 'Gastos del mes', value: 'Bs. 23,860', hint: 'vs. mes anterior', delta: '+9.7%', icon: 'pi pi-credit-card', tone: 'red' as Tone },
  { label: 'Utilidad neta', value: 'Bs. 24,890', hint: 'vs. mes anterior', delta: '+25.6%', icon: 'pi pi-chart-line', tone: 'green' as Tone },
  { label: 'Saldo disponible', value: 'Bs. 62,340', hint: 'vs. mes anterior', delta: '+12.3%', icon: 'pi pi-database', tone: 'green' as Tone },
]

const incomeRows = [
  { date: '24 May 2026', concept: 'Venta de productos', amount: 12450 },
  { date: '22 May 2026', concept: 'Servicio de consultoría', amount: 6700 },
  { date: '20 May 2026', concept: 'Venta de productos', amount: 7300 },
  { date: '18 May 2026', concept: 'Suscripción mensual', amount: 4500 },
]

const expenseRows = [
  { label: 'Servicios', amount: 7250, percent: 30, color: '#0f9e2e' },
  { label: 'Compras', amount: 6200, percent: 26, color: '#f6a623' },
  { label: 'Salarios', amount: 5600, percent: 23, color: '#3b82f6' },
  { label: 'Transporte', amount: 2450, percent: 10, color: '#8b5cf6' },
  { label: 'Publicidad', amount: 2240, percent: 9, color: '#ef4444' },
]

const cashCards = [
  { label: 'Ingresos', value: 'Bs. 48,750', delta: '+18.4%', trend: 'M 2 21 C 14 18 18 10 29 12 S 47 20 58 10 72 2 94 6', tone: 'green' as Tone },
  { label: 'Gastos', value: 'Bs. 23,860', delta: '+9.7%', trend: 'M 2 8 C 14 4 18 16 29 12 S 47 5 58 15 72 23 94 18', tone: 'red' as Tone },
  { label: 'Saldo disponible', value: 'Bs. 62,340', delta: '+12.3%', trend: 'M 2 19 C 18 18 22 14 34 14 S 52 15 62 9 76 4 94 5', tone: 'green' as Tone },
]

const cost = ref(80)
const fixedCosts = ref(15)
const margin = ref(30)

const baseCost = computed(() => Number(cost.value || 0) + Number(fixedCosts.value || 0))
const recommendedPrice = computed(() => baseCost.value * (1 + Number(margin.value || 0) / 100))
const unitProfit = computed(() => recommendedPrice.value - baseCost.value)

const currencyFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(value: number) {
  return `Bs. ${currencyFormatter.format(value)}`
}
</script>

<template>
  <div class="finance-page">
    <section class="finance-hero">
      <div>
        <span class="section-kicker">
          <i class="pi pi-chart-line" aria-hidden="true" />
          Módulo Finanzas
        </span>
        <h1>Controla la salud económica de tu negocio</h1>
        <p>Ingresos, gastos, utilidad, precios y flujo de caja en una sola vista para tomar mejores decisiones.</p>
      </div>

      <div class="hero-actions">
        <Button type="button" icon="pi pi-chart-bar" label="Ver reporte" outlined severity="success" />
        <Button type="button" icon="pi pi-plus" label="Nuevo registro" severity="success" />
      </div>
    </section>

    <section class="metrics-grid">
      <article v-for="metric in metrics" :key="metric.label" class="metric-card">
        <span class="metric-icon" :class="toneClasses[metric.tone]">
          <i :class="metric.icon" aria-hidden="true" />
        </span>
        <div>
          <small>{{ metric.label }}</small>
          <strong>{{ metric.value }}</strong>
          <span>
            {{ metric.hint }}
            <b :class="metric.tone === 'red' ? 'text-red-500' : 'text-primary-600'">{{ metric.delta }}</b>
          </span>
        </div>
      </article>
    </section>

    <div class="finance-grid">
      <section class="panel income-panel">
        <header class="panel-head">
          <h2>1. Ingresos</h2>
          <Button type="button" text size="small" severity="success" label="Ver detalle" />
        </header>

        <div class="income-content">
          <DataTable :value="incomeRows" size="small" class="finance-table">
            <Column field="date" header="Fecha" />
            <Column field="concept" header="Concepto" />
            <Column header="Monto">
              <template #body="{ data }">
                <strong class="amount-positive">{{ money(data.amount) }}</strong>
              </template>
            </Column>
          </DataTable>

          <div class="mini-chart">
            <small>Evolución de ingresos</small>
            <svg viewBox="0 0 160 82" aria-hidden="true">
              <path class="grid-line" d="M8 68 H154 M8 48 H154 M8 28 H154" />
              <path class="chart-line" d="M10 66 L28 58 L44 62 L60 48 L78 43 L96 30 L112 35 L130 20 L150 12" />
              <path class="chart-area" d="M10 66 L28 58 L44 62 L60 48 L78 43 L96 30 L112 35 L130 20 L150 12 L150 76 L10 76 Z" />
            </svg>
          </div>
        </div>

        <footer class="panel-total">
          <span>Total ingresos</span>
          <strong>Bs. 48,750</strong>
        </footer>
      </section>

      <section class="panel expenses-panel">
        <header class="panel-head">
          <h2>2. Gastos</h2>
          <Button type="button" text size="small" severity="success" label="Ver detalle" />
        </header>

        <div class="expense-content">
          <div class="donut" aria-label="Gastos del mes">
            <span>Bs. 23,860</span>
            <small>Total gastos</small>
          </div>

          <div class="expense-list">
            <div v-for="row in expenseRows" :key="row.label" class="expense-row">
              <span :style="{ backgroundColor: row.color }" />
              <strong>{{ row.label }}</strong>
              <em>{{ money(row.amount) }}</em>
              <small>{{ row.percent }}%</small>
            </div>
          </div>
        </div>
      </section>

      <section class="panel calculator-panel">
        <header class="panel-head">
          <h2><i class="pi pi-calculator" aria-hidden="true" />Calculadora de Precios</h2>
        </header>

        <div class="calc-legend">
          <span><b class="bg-primary-500" />Costo</span>
          <span><b class="bg-amber-400" />Gastos</span>
          <span><b class="bg-sky-500" />Margen</span>
          <span><b class="bg-lime-500" />Precio recomendado</span>
        </div>

        <div class="calc-form">
          <label>
            <span>Costo unitario</span>
            <InputNumber v-model="cost" input-id="cost" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>
          <label>
            <span>Gastos unitarios</span>
            <InputNumber v-model="fixedCosts" input-id="fixed-costs" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>
          <label>
            <span>Margen (%)</span>
            <InputNumber v-model="margin" input-id="margin" suffix=" %" :min="0" :max="300" fluid />
          </label>
        </div>

        <div class="price-result">
          <small>Precio recomendado</small>
          <strong>{{ money(recommendedPrice) }}</strong>
          <span>Por unidad</span>
        </div>

        <div class="calc-breakdown">
          <span>Costo base: <strong>{{ money(baseCost) }}</strong></span>
          <span>Ganancia estimada: <strong>{{ money(unitProfit) }}</strong></span>
        </div>
      </section>

      <section class="panel balance-panel">
        <header class="panel-head">
          <h2>4. Punto de Equilibrio</h2>
          <Button type="button" text size="small" severity="success" label="Ver detalle" />
        </header>

        <div class="balance-content">
          <div class="balance-goal">
            <small>Debes vender</small>
            <strong>315</strong>
            <span>unidades</span>
            <em>para cubrir tus costos totales.</em>
          </div>

          <div class="break-chart">
            <span>Costos vs. Ingresos</span>
            <svg viewBox="0 0 260 130" aria-hidden="true">
              <path class="grid-line" d="M18 108 H248 M18 82 H248 M18 56 H248 M18 30 H248" />
              <path class="cost-line" d="M18 98 L248 34" />
              <path class="income-line" d="M18 112 L248 18" />
              <path class="break-line" d="M160 20 V114" />
              <circle cx="160" cy="55" r="5" />
            </svg>
          </div>
        </div>
      </section>

      <section class="panel cash-panel">
        <header class="panel-head">
          <h2>5. Flujo de Caja</h2>
          <Button type="button" text size="small" severity="success" label="Ver detalle" />
        </header>

        <div class="cash-grid">
          <article v-for="card in cashCards" :key="card.label">
            <small>{{ card.label }}</small>
            <strong>{{ card.value }}</strong>
            <b :class="card.tone === 'red' ? 'text-red-500' : 'text-primary-600'">{{ card.delta }}</b>
            <svg viewBox="0 0 96 26" aria-hidden="true">
              <path :class="card.tone === 'red' ? 'stroke-red-400' : 'stroke-primary-500'" :d="card.trend" />
            </svg>
          </article>
        </div>

        <Message severity="success" size="small" icon="pi pi-check-circle">
          Flujo de caja saludable: tu negocio tiene buen margen de liquidez.
        </Message>
      </section>

      <section class="panel ai-panel">
        <Tag value="PREMIUM" severity="warn" icon="pi pi-crown" />
        <div>
          <span>6. Análisis Financiero IA <i class="pi pi-sparkles" aria-hidden="true" /></span>
          <h2>La IA analiza tu rentabilidad y propone mejoras personalizadas para hacer crecer tu negocio.</h2>
          <Button type="button" icon="pi pi-sparkles" label="Ver análisis con IA" severity="success" />
          <small>Actualizado hoy, 08:30 a.m.</small>
        </div>
        <img src="/kenchita.png" alt="" aria-hidden="true">
      </section>
    </div>
  </div>
</template>

<style scoped>
.finance-page {
  display: grid;
  gap: 14px;
  color: #102016;
}

.finance-hero,
.metric-card,
.panel {
  border: 1px solid #e7eee8;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.finance-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 134px;
  overflow: hidden;
  padding: 24px 28px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.98), rgba(244, 252, 241, 0.88) 58%, rgba(244, 252, 241, 0.38)),
    url('/tools/finanzas.jpg') center / cover no-repeat;
}

.section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0a6f1f;
  font-size: 0.72rem;
  font-weight: 900;
}

.finance-hero h1 {
  margin: 7px 0 4px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: clamp(1.45rem, 2vw, 2rem);
  font-weight: 900;
  line-height: 1.08;
}

.finance-hero p {
  max-width: 560px;
  margin: 0;
  color: #5f6f64;
  font-size: 0.86rem;
  font-weight: 700;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 15px;
}

.metric-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  font-size: 1.05rem;
}

.metric-card small,
.panel small,
.calc-form span,
.calc-breakdown,
.balance-goal em,
.price-result span {
  color: #718074;
  font-size: 0.7rem;
  font-weight: 800;
}

.metric-card strong {
  display: block;
  margin-top: 3px;
  color: #102016;
  font-size: 1.12rem;
  font-weight: 900;
}

.metric-card span:not(.metric-icon) {
  display: inline-flex;
  gap: 6px;
  color: #718074;
  font-size: 0.68rem;
  font-weight: 800;
}

.finance-grid {
  display: grid;
  grid-template-columns: 1.22fr 1.05fr 1fr;
  gap: 14px;
}

.panel {
  min-width: 0;
  padding: 15px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.panel-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 0.86rem;
  font-weight: 900;
}

.panel-head img {
  width: 15px;
  height: 15px;
}

.income-panel,
.balance-panel {
  grid-column: span 2;
}

.income-content,
.expense-content,
.balance-content {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(180px, 0.85fr);
  gap: 14px;
  align-items: center;
}

.finance-table :deep(.p-datatable-header-cell),
.finance-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.45rem 0.55rem;
  font-size: 0.7rem;
}

.finance-table :deep(.p-datatable-tbody > tr),
.finance-table :deep(.p-datatable-header-cell) {
  background: transparent;
}

.amount-positive,
.panel-total strong {
  color: #0f9e2e;
}

.mini-chart small,
.break-chart span {
  display: block;
  margin-bottom: 8px;
  color: #2d3d31;
  font-size: 0.68rem;
  font-weight: 900;
}

.mini-chart svg,
.break-chart svg,
.cash-grid svg {
  width: 100%;
  overflow: visible;
}

.grid-line {
  fill: none;
  stroke: #edf3ee;
  stroke-width: 1;
}

.chart-area {
  fill: rgba(15, 158, 46, 0.12);
}

.chart-line,
.income-line {
  fill: none;
  stroke: #0f9e2e;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.panel-total {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eef3ef;
  font-size: 0.76rem;
  font-weight: 900;
}

.donut {
  display: grid;
  width: 142px;
  aspect-ratio: 1;
  place-items: center;
  justify-self: center;
  border-radius: 50%;
  background:
    radial-gradient(circle, #ffffff 0 44%, transparent 45%),
    conic-gradient(#0f9e2e 0 30%, #f6a623 30% 56%, #3b82f6 56% 79%, #8b5cf6 79% 90%, #ef4444 90% 100%);
}

.donut span {
  align-self: end;
  font-size: 0.9rem;
  font-weight: 900;
}

.donut small {
  align-self: start;
}

.expense-list {
  display: grid;
  gap: 9px;
}

.expense-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 8px;
  align-items: center;
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
  color: #4f5d53;
  font-style: normal;
  font-weight: 800;
}

.calculator-panel {
  display: grid;
  align-content: start;
}

.calc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 14px;
}

.calc-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #718074;
  font-size: 0.64rem;
  font-weight: 800;
}

.calc-legend b {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.calc-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.calc-form label {
  display: grid;
  gap: 6px;
}

.calc-form :deep(.p-inputnumber-input) {
  width: 100%;
  font-size: 0.78rem;
}

.price-result {
  display: grid;
  justify-items: center;
  margin-top: 14px;
  padding: 14px;
  border-radius: 12px;
  background: #f0f9e8;
  color: #0a6f1f;
  text-align: center;
}

.price-result strong {
  margin-top: 2px;
  font-size: 1.34rem;
  font-weight: 900;
}

.calc-breakdown {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.balance-goal {
  display: grid;
  justify-items: center;
  align-content: center;
  min-height: 154px;
  border-radius: 12px;
  background: #f8fcf7;
  text-align: center;
}

.balance-goal strong {
  color: #102016;
  font-size: 2.35rem;
  line-height: 1;
  font-weight: 900;
}

.balance-goal span {
  font-size: 0.78rem;
  font-weight: 900;
}

.balance-goal em {
  max-width: 120px;
  margin-top: 8px;
  font-style: normal;
}

.cost-line {
  fill: none;
  stroke: #f6a623;
  stroke-dasharray: 7 6;
  stroke-linecap: round;
  stroke-width: 3;
}

.break-line {
  fill: none;
  stroke: #64748b;
  stroke-dasharray: 5 5;
  stroke-width: 2;
}

.break-chart circle {
  fill: #0f9e2e;
  stroke: #ffffff;
  stroke-width: 3;
}

.cash-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.cash-grid article {
  display: grid;
  gap: 5px;
  padding: 12px;
  border-radius: 12px;
  background: #fbfdfb;
}

.cash-grid strong {
  font-size: 0.88rem;
  font-weight: 900;
}

.cash-grid b {
  font-size: 0.68rem;
}

.cash-grid path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.ai-panel {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  padding: 17px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.96), rgba(254, 252, 232, 0.9) 58%, rgba(254, 252, 232, 0.3)),
    url('/kenchita-selva.jpg') center / cover no-repeat;
}

.ai-panel :deep(.p-tag) {
  position: absolute;
  top: 14px;
  right: 14px;
}

.ai-panel div {
  position: relative;
  z-index: 1;
  max-width: 270px;
  padding-top: 22px;
}

.ai-panel span {
  color: #9a6a00;
  font-size: 0.78rem;
  font-weight: 900;
}

.ai-panel h2 {
  margin: 9px 0 14px;
  font-size: 0.88rem;
  line-height: 1.45;
  font-weight: 900;
}

.ai-panel small {
  display: block;
  margin-top: 12px;
}

.ai-panel img {
  position: absolute;
  right: 10px;
  bottom: -16px;
  width: 156px;
  filter: drop-shadow(0 16px 18px rgba(19, 52, 23, 0.2));
}

@media (max-width: 1220px) {
  .metrics-grid,
  .finance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .calculator-panel,
  .ai-panel {
    grid-column: span 2;
  }
}

@media (max-width: 820px) {
  .finance-hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 20px;
  }

  .hero-actions {
    justify-content: flex-start;
  }

  .metrics-grid,
  .finance-grid,
  .income-content,
  .expense-content,
  .balance-content,
  .cash-grid {
    grid-template-columns: 1fr;
  }

  .income-panel,
  .balance-panel,
  .calculator-panel,
  .ai-panel {
    grid-column: auto;
  }
}

@media (max-width: 560px) {
  .calc-form,
  .calc-breakdown {
    grid-template-columns: 1fr;
  }

  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-card {
    align-items: flex-start;
  }
}
</style>
