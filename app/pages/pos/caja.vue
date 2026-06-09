<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Caja',
})

useHead({
  title: 'Caja | NEXA',
})

type MovementType = 'Ingreso' | 'Egreso'
type MovementStatus = 'Confirmado' | 'Pendiente'

const periods = ['Hoy', 'Mayo 2026', 'Abril 2026', 'Marzo 2026']
const accounts = ['Caja principal', 'QR digital', 'Banco']

const selectedPeriod = ref('Mayo 2026')
const selectedAccount = ref('Caja principal')
const initialBalance = ref(12000)
const projectedBalance = ref(24890)

const summary = [
  { label: 'Ventas cobradas', value: 48750, delta: '+18.4%', icon: 'pi pi-arrow-up-right', tone: 'green' },
  { label: 'Gastos pagados', value: 23860, delta: '+9.7%', icon: 'pi pi-arrow-down-left', tone: 'red' },
  { label: 'Saldo esperado', value: 24890, delta: '76% liquidez', icon: 'pi pi-wallet', tone: 'green' },
]

const paymentMethods = [
  { label: 'Efectivo', code: 'EFE', amount: 18400, percent: 38, tone: 'green' },
  { label: 'QR digital', code: 'QR', amount: 21350, percent: 44, tone: 'blue' },
  { label: 'Tarjeta', code: 'TAR', amount: 9000, percent: 18, tone: 'violet' },
]

const recentActivity = [
  { time: '09:20', detail: 'Venta de mostrador', type: 'Ingreso' as MovementType, method: 'QR', amount: 8900, status: 'Confirmado' as MovementStatus },
  { time: '10:15', detail: 'Pago a proveedor', type: 'Egreso' as MovementType, method: 'Efectivo', amount: 3250, status: 'Confirmado' as MovementStatus },
  { time: '12:40', detail: 'Servicio de consultoría', type: 'Ingreso' as MovementType, method: 'QR', amount: 6400, status: 'Confirmado' as MovementStatus },
  { time: '15:05', detail: 'Publicidad digital', type: 'Egreso' as MovementType, method: 'Tarjeta', amount: 2240, status: 'Pendiente' as MovementStatus },
]

const topProducts = [
  { name: 'Combo emprendedor', units: 18, amount: 12600 },
  { name: 'Asesoría express', units: 9, amount: 8100 },
  { name: 'Pack identidad visual', units: 5, amount: 6000 },
]

const reconciliation = computed(() => [
  { label: 'Saldo inicial', value: Number(initialBalance.value || 0) },
  { label: 'Ventas cobradas', value: 48750 },
  { label: 'Gastos registrados', value: -23860 },
  { label: 'Esperado en caja', value: Number(projectedBalance.value || 0) },
])

const currencyFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}Bs. ${currencyFormatter.format(Math.abs(value))}`
}

function movementSeverity(status: MovementStatus) {
  return status === 'Confirmado' ? 'success' : 'warn'
}

function movementClass(type: MovementType) {
  return type === 'Ingreso' ? 'text-primary-600' : 'text-red-500'
}
</script>

<template>
  <div class="cash-page">
    <section class="cash-hero">
      <div class="cash-status">
        <span class="status-dot" aria-hidden="true" />
        <div>
          <strong>Caja abierta</strong>
          <small>0 ventas hoy · Turno iniciado 08:00</small>
        </div>
      </div>

      <div class="cash-title">
        <span><i class="pi pi-wallet" aria-hidden="true" />Flujo de Caja</span>
        <h1>Control diario, conciliación y cierre de turno</h1>
        <p>Diseñado para responder rápido: cuánto hay, qué entró, qué salió y si el cierre cuadra.</p>
      </div>

      <div class="hero-actions">
        <Button type="button" icon="pi pi-file-export" label="Exportar análisis" outlined severity="secondary" />
        <Button type="button" icon="pi pi-plus" label="Nuevo movimiento" severity="success" />
        <Button type="button" icon="pi pi-lock" label="Cerrar caja del día" severity="danger" />
      </div>
    </section>

    <section class="summary-grid" aria-label="Resumen de caja">
      <article v-for="item in summary" :key="item.label" class="summary-card">
        <span class="summary-icon" :class="`is-${item.tone}`">
          <i :class="item.icon" aria-hidden="true" />
        </span>
        <div>
          <small>{{ item.label }}</small>
          <strong>{{ money(item.value) }}</strong>
          <em :class="item.tone === 'red' ? 'text-red-500' : 'text-primary-600'">{{ item.delta }}</em>
        </div>
      </article>
    </section>

    <div class="cash-grid">
      <section class="panel close-panel">
        <header class="panel-head">
          <h2>1. Resumen de flujo de caja</h2>
          <Tag value="En curso" severity="success" />
        </header>

        <div class="close-form">
          <label>
            <span>Periodo</span>
            <Select v-model="selectedPeriod" :options="periods" fluid />
          </label>
          <label>
            <span>Caja / cuenta</span>
            <Select v-model="selectedAccount" :options="accounts" fluid />
          </label>
          <label>
            <span>Saldo inicial</span>
            <InputNumber v-model="initialBalance" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>
          <label>
            <span>Saldo proyectado</span>
            <InputNumber v-model="projectedBalance" mode="decimal" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" fluid />
          </label>
        </div>

        <div class="close-actions">
          <Button type="button" icon="pi pi-refresh" label="Actualizar" severity="success" size="small" />
          <Button type="button" icon="pi pi-eraser" label="Limpiar" outlined severity="secondary" size="small" />
        </div>
      </section>

      <section class="panel result-panel">
        <span>Resultado</span>
        <strong>{{ money(projectedBalance) }}</strong>
        <div>
          <small>Entradas totales <b class="text-primary-600">Bs. 48,750</b></small>
          <small>Salidas totales <b class="text-red-500">Bs. 23,860</b></small>
          <small>Liquidez estimada <b class="text-primary-600">76%</b></small>
        </div>
      </section>

      <section class="panel chart-panel">
        <header class="panel-head">
          <h2>2. Flujo del periodo</h2>
          <div class="chart-legend">
            <span><b class="bg-primary-500" />Ingresos</span>
            <span><b class="bg-orange-500" />Gastos</span>
            <span><b class="bg-emerald-700" />Saldo</span>
          </div>
        </header>

        <svg class="period-chart" viewBox="0 0 430 190" aria-label="Flujo del periodo">
          <path class="grid-line" d="M42 155 H408 M42 118 H408 M42 81 H408 M42 44 H408" />
          <g class="bar-group">
            <rect x="76" y="121" width="26" height="34" />
            <rect class="expense-bar" x="106" y="137" width="26" height="18" />
            <rect x="166" y="105" width="26" height="50" />
            <rect class="expense-bar" x="196" y="129" width="26" height="26" />
            <rect x="256" y="90" width="26" height="65" />
            <rect class="expense-bar" x="286" y="125" width="26" height="30" />
            <rect x="346" y="82" width="26" height="73" />
            <rect class="expense-bar" x="376" y="119" width="26" height="36" />
          </g>
          <path class="saldo-line" d="M88 118 L178 103 L268 82 L358 60" />
          <circle cx="88" cy="118" r="5" /><circle cx="178" cy="103" r="5" /><circle cx="268" cy="82" r="5" /><circle cx="358" cy="60" r="5" />
          <g class="axis-labels">
            <text x="86" y="176">Sem 1</text><text x="176" y="176">Sem 2</text><text x="266" y="176">Sem 3</text><text x="356" y="176">Sem 4</text>
          </g>
        </svg>
      </section>

      <section class="panel methods-panel">
        <header class="panel-head">
          <h2>Métodos de pago</h2>
          <span>3 canales</span>
        </header>

        <div class="payment-list">
          <article v-for="method in paymentMethods" :key="method.label">
            <span class="method-code" :class="`is-${method.tone}`">{{ method.code }}</span>
            <div>
              <strong>{{ method.label }}</strong>
              <span class="progress-track"><b :style="{ width: `${method.percent}%` }" /></span>
            </div>
            <em>{{ money(method.amount) }}<small>{{ method.percent }}%</small></em>
          </article>
        </div>
      </section>

      <section class="panel activity-panel">
        <header class="panel-head">
          <h2>3. Historial de movimientos</h2>
          <Button type="button" text size="small" severity="success" label="Ver historial completo" />
        </header>

        <DataTable :value="recentActivity" size="small" class="cash-table">
          <Column field="time" header="Hora" />
          <Column field="detail" header="Concepto" />
          <Column field="method" header="Método" />
          <Column header="Tipo">
            <template #body="{ data }">
              <strong :class="movementClass(data.type)">{{ data.type }}</strong>
            </template>
          </Column>
          <Column header="Monto">
            <template #body="{ data }">
              <strong :class="movementClass(data.type)">{{ money(data.amount) }}</strong>
            </template>
          </Column>
          <Column header="Estado">
            <template #body="{ data }">
              <Tag :value="data.status" :severity="movementSeverity(data.status)" rounded />
            </template>
          </Column>
        </DataTable>
      </section>

      <section class="panel side-panel">
        <header class="panel-head">
          <h2>Resumen del cierre</h2>
          <Tag value="Conciliación" severity="info" />
        </header>

        <div class="reconcile-list">
          <div v-for="item in reconciliation" :key="item.label">
            <span>{{ item.label }}</span>
            <strong :class="item.value < 0 ? 'text-red-500' : 'text-primary-700'">{{ money(item.value) }}</strong>
          </div>
        </div>

        <Divider />

        <div class="top-products">
          <h3>Top productos</h3>
          <article v-for="product in topProducts" :key="product.name">
            <div>
              <strong>{{ product.name }}</strong>
              <small>{{ product.units }} ventas</small>
            </div>
            <span>{{ money(product.amount) }}</span>
          </article>
        </div>
      </section>

      <section class="panel insight-panel">
        <Message severity="success" icon="pi pi-check-circle">
          Tu flujo de caja está saludable este mes. La recomendación es revisar pagos pendientes antes de cerrar el turno.
        </Message>
        <Button type="button" text severity="success" icon="pi pi-sparkles" label="Ver recomendaciones IA" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.cash-page {
  display: grid;
  gap: 14px;
  color: #102016;
}

.cash-hero,
.summary-card,
.panel {
  border: 1px solid #e7eee8;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.cash-hero {
  display: grid;
  grid-template-columns: minmax(210px, 0.86fr) minmax(300px, 1.35fr) auto;
  gap: 14px;
  align-items: center;
  overflow: hidden;
  padding: 16px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.98), rgba(244, 252, 241, 0.92) 64%, rgba(244, 252, 241, 0.45)),
    url('/tools/finanzas.jpg') center / cover no-repeat;
}

.cash-status {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 13px 14px;
  border-radius: 12px;
  background: #033d2e;
  color: #ffffff;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #10d99b;
  box-shadow: 0 0 0 6px rgba(16, 217, 155, 0.14);
}

.cash-status strong,
.cash-title span,
.panel-head h2,
.top-products h3 {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-weight: 900;
}

.cash-status strong {
  display: block;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cash-status small,
.cash-title p,
.summary-card small,
.panel span,
.panel small,
.payment-list small {
  color: #718074;
  font-size: 0.7rem;
  font-weight: 800;
}

.cash-status small {
  color: rgba(255, 255, 255, 0.74);
}

.cash-title span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #0a6f1f;
  font-size: 0.72rem;
}

.cash-title h1 {
  margin: 6px 0 4px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: clamp(1.12rem, 1.8vw, 1.56rem);
  line-height: 1.1;
}

.cash-title p {
  max-width: 620px;
  margin: 0;
  line-height: 1.45;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  display: flex;
  gap: 13px;
  align-items: center;
  padding: 15px;
}

.summary-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 13px;
  font-size: 1.05rem;
}

.summary-icon.is-green {
  background: #ecfdf0;
  color: #0a6f1f;
}

.summary-icon.is-red {
  background: #fef2f2;
  color: #ef4444;
}

.summary-card strong {
  display: block;
  margin-top: 2px;
  font-size: 1.15rem;
  font-weight: 900;
}

.summary-card em {
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 900;
}

.cash-grid {
  display: grid;
  grid-template-columns: 1.08fr 0.62fr 1.25fr;
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
  margin: 0;
  font-size: 0.86rem;
}

.close-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.close-form label {
  display: grid;
  gap: 6px;
}

.close-form :deep(.p-select),
.close-form :deep(.p-inputnumber-input) {
  width: 100%;
  font-size: 0.78rem;
}

.close-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.result-panel {
  display: grid;
  align-content: center;
  gap: 9px;
  background: #f3faf2;
}

.result-panel > strong {
  color: #0a6f1f;
  font-size: 1.9rem;
  line-height: 1;
  font-weight: 900;
}

.result-panel div {
  display: grid;
  gap: 6px;
}

.result-panel small {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.chart-panel {
  grid-row: span 2;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.chart-legend b {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.period-chart {
  width: 100%;
  min-height: 220px;
}

.grid-line {
  fill: none;
  stroke: #edf3ee;
  stroke-width: 1;
}

.bar-group rect {
  fill: #0f9e2e;
  rx: 6;
}

.bar-group .expense-bar {
  fill: #f97316;
}

.saldo-line {
  fill: none;
  stroke: #0a6f1f;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.period-chart circle {
  fill: #0a6f1f;
  stroke: #ffffff;
  stroke-width: 3;
}

.axis-labels {
  fill: #718074;
  font-size: 0.68rem;
  font-weight: 800;
}

.methods-panel {
  grid-row: span 2;
}

.payment-list {
  display: grid;
  gap: 12px;
}

.payment-list article {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
}

.method-code {
  display: grid;
  width: 42px;
  height: 28px;
  place-items: center;
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 900;
}

.method-code.is-green {
  background: #e8fbef;
  color: #0a6f1f;
}

.method-code.is-blue {
  background: #e8f8ff;
  color: #0284c7;
}

.method-code.is-violet {
  background: #f1ecff;
  color: #7c3aed;
}

.payment-list strong {
  display: block;
  font-size: 0.78rem;
  font-weight: 900;
}

.payment-list em {
  text-align: right;
  font-size: 0.78rem;
  font-style: normal;
  font-weight: 900;
}

.payment-list em small {
  display: block;
}

.progress-track {
  display: block;
  height: 6px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf2ee;
}

.progress-track b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f9e2e, #74c043);
}

.activity-panel {
  grid-column: span 2;
}

.cash-table :deep(.p-datatable-header-cell),
.cash-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.48rem 0.55rem;
  font-size: 0.7rem;
}

.cash-table :deep(.p-datatable-tbody > tr),
.cash-table :deep(.p-datatable-header-cell) {
  background: transparent;
}

.side-panel {
  grid-row: span 2;
}

.reconcile-list {
  display: grid;
  gap: 10px;
}

.reconcile-list div,
.top-products article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.reconcile-list strong,
.top-products span {
  font-size: 0.78rem;
  font-weight: 900;
}

.top-products {
  display: grid;
  gap: 10px;
}

.top-products h3 {
  margin: 0;
  font-size: 0.82rem;
}

.top-products strong {
  display: block;
  font-size: 0.76rem;
}

.insight-panel {
  grid-column: span 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 15px;
}

.insight-panel :deep(.p-message) {
  flex: 1;
  margin: 0;
}

@media (max-width: 1280px) {
  .cash-hero,
  .cash-grid {
    grid-template-columns: 1fr 1fr;
  }

  .cash-title,
  .chart-panel,
  .activity-panel,
  .insight-panel {
    grid-column: span 2;
  }

  .hero-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 820px) {
  .cash-hero,
  .summary-grid,
  .cash-grid,
  .close-form {
    grid-template-columns: 1fr;
  }

  .cash-title,
  .chart-panel,
  .activity-panel,
  .insight-panel {
    grid-column: auto;
  }

  .insight-panel {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .hero-actions,
  .close-actions {
    flex-direction: column;
  }

  .payment-list article {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .payment-list em {
    grid-column: 2;
    text-align: left;
  }
}
</style>
