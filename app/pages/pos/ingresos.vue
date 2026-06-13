<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Ingresos',
  alias: ['/pos/finanzas/ingresos'],
})

useHead({
  title: 'Ingresos | IMPULSA',
})

type SaleTone = 'green' | 'blue'

const searchTerm = ref('')

const summaryCards = [
  { label: 'Total de ventas hoy', value: 'Bs. 580.00', meta: '+14.6% vs. ayer', icon: 'pi pi-calendar', tone: 'green' },
  { label: 'Número de ventas', value: '18', meta: 'vs. ayer: 15   +20%', icon: 'pi pi-receipt', tone: 'blue' },
  { label: 'Ticket promedio', value: 'Bs. 32.22', meta: 'vs. ayer: Bs. 28.70   +12.3%', icon: 'pi pi-chart-bar', tone: 'purple' },
  { label: 'Producto más vendido', value: 'Bowl Açaí', meta: '8 unidades vendidas', icon: 'pi pi-star', tone: 'orange' },
]

const salesRows: { time: string, product: string, icon: string, category: string, categoryTone: SaleTone, qty: number, unitPrice: number, total: number, method: string }[] = [
  { time: '09:15 AM', product: 'Cono Soft', icon: '🍦', category: 'Helados', categoryTone: 'green', qty: 3, unitPrice: 7, total: 21, method: 'Efectivo' },
  { time: '10:30 AM', product: 'Bowl Açaí', icon: '🥣', category: 'Bebidas', categoryTone: 'blue', qty: 2, unitPrice: 35, total: 70, method: 'Tarjeta' },
  { time: '11:20 AM', product: 'Batido Açaí', icon: '🥤', category: 'Bebidas', categoryTone: 'blue', qty: 1, unitPrice: 16, total: 16, method: 'Efectivo' },
  { time: '12:10 PM', product: 'Cono Soft', icon: '🍦', category: 'Helados', categoryTone: 'green', qty: 2, unitPrice: 7, total: 14, method: 'Efectivo' },
  { time: '01:45 PM', product: 'Café Frío', icon: '🧋', category: 'Bebidas', categoryTone: 'blue', qty: 1, unitPrice: 12, total: 12, method: 'Tarjeta' },
  { time: '03:30 PM', product: 'Bowl Açaí', icon: '🥣', category: 'Bebidas', categoryTone: 'blue', qty: 2, unitPrice: 35, total: 70, method: 'Efectivo' },
  { time: '04:15 PM', product: 'Cono Soft', icon: '🍦', category: 'Helados', categoryTone: 'green', qty: 4, unitPrice: 7, total: 28, method: 'Efectivo' },
  { time: '05:20 PM', product: 'Batido Açaí', icon: '🥤', category: 'Bebidas', categoryTone: 'blue', qty: 1, unitPrice: 16, total: 16, method: 'Tarjeta' },
]

const daySummary = [
  { label: 'Hora de mayor venta', value: '04:00 PM - 05:00 PM', icon: 'pi pi-clock', tone: 'green' },
  { label: 'Ventas en efectivo', value: 'Bs. 119.00 (59%)', icon: 'pi pi-money-bill', tone: 'green' },
  { label: 'Ventas con tarjeta', value: 'Bs. 82.00 (41%)', icon: 'pi pi-credit-card', tone: 'blue' },
]

const comparisons = [
  { label: 'Total de ventas', value: 'Bs. 74.00 (14.6%)' },
  { label: 'Número de ventas', value: '3 (20%)' },
  { label: 'Ticket promedio', value: 'Bs. 3.52 (12.3%)' },
]

function money(value: number) {
  return `Bs. ${value.toFixed(2)}`
}
</script>

<template>
  <div class="income-page">
    <div class="income-breadcrumb">
      <nav class="crumbs" aria-label="Ruta de ingresos">
        <span>Finanzas</span>
        <i class="pi pi-angle-right" aria-hidden="true" />
        <strong>Ingresos</strong>
      </nav>

      <div class="crumb-actions">
        <Button type="button" text size="small" icon="pi pi-calendar" label="Hoy" />
        <Button type="button" text rounded icon="pi pi-refresh" aria-label="Recargar ingresos" />
      </div>
    </div>

    <section class="income-heading">
      <div class="income-heading__title">
        <span class="heading-icon"><i class="pi pi-dollar" aria-hidden="true" /></span>
        <div>
          <h2>Ingresos Hoy</h2>
          <p>Ventas realizadas hoy · Martes, 20 de mayo de 2026</p>
        </div>
      </div>

      <div class="income-heading__tools">
        <IconField class="income-search">
          <InputIcon>
            <i class="pi pi-search" />
          </InputIcon>
          <InputText v-model="searchTerm" placeholder="Buscar..." />
        </IconField>
      </div>
    </section>

    <section class="income-metrics" aria-label="Resumen de ingresos">
      <article v-for="card in summaryCards" :key="card.label" class="income-metric">
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
      <article class="income-panel sales-panel">
        <header class="panel-head">
          <h2>Ventas realizadas hoy</h2>
          <Tag value="Actualización en tiempo real" severity="success" icon="pi pi-circle-fill" />
        </header>

        <DataTable :value="salesRows" size="small" class="income-table">
          <Column field="time" header="Hora" />
          <Column header="Producto / Servicio">
            <template #body="{ data }">
              <div class="product-cell">
                <span>{{ data.icon }}</span>
                <strong>{{ data.product }}</strong>
              </div>
            </template>
          </Column>
          <Column header="Categoría">
            <template #body="{ data }">
              <Tag :value="data.category" :severity="data.categoryTone === 'green' ? 'success' : 'info'" />
            </template>
          </Column>
          <Column field="qty" header="Cantidad" />
          <Column header="Precio unitario">
            <template #body="{ data }">{{ money(data.unitPrice) }}</template>
          </Column>
          <Column header="Total">
            <template #body="{ data }">
              <strong>{{ money(data.total) }}</strong>
            </template>
          </Column>
          <Column header="Método de pago">
            <template #body="{ data }">
              <span class="payment-method">
                <i :class="data.method === 'Efectivo' ? 'pi pi-money-bill' : 'pi pi-credit-card'" aria-hidden="true" />
                {{ data.method }}
              </span>
            </template>
          </Column>
        </DataTable>

        <footer class="table-footer">
          <Button type="button" text severity="secondary" label="Ver todas las ventas de hoy" icon="pi pi-angle-down" icon-pos="right" />
        </footer>
      </article>

      <aside class="income-side">
        <article class="income-panel side-panel">
          <header class="panel-head">
            <h2><i class="pi pi-chart-bar" aria-hidden="true" /> Resumen del día</h2>
          </header>

          <div class="side-list">
            <div v-for="item in daySummary" :key="item.label">
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
            <h2><i class="pi pi-chart-line" aria-hidden="true" /> Comparación con ayer</h2>
          </header>

          <div class="comparison-list">
            <div v-for="item in comparisons" :key="item.label">
              <span>{{ item.label }}</span>
              <strong><i class="pi pi-arrow-up" aria-hidden="true" /> {{ item.value }}</strong>
            </div>
          </div>

          <footer>Ayer: <strong>Bs. 506.00</strong></footer>
        </article>
      </aside>
    </section>

    <section class="ai-advice">
      <span class="ai-advice__icon"><i class="pi pi-lightbulb" aria-hidden="true" /></span>
      <div>
        <h2>Consejo IA</h2>
        <p>¡Excelente día! Tus ventas han aumentado 14.6% respecto a ayer.</p>
        <p>El Bowl Açaí es tu producto estrella del día.</p>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true">
    </section>
  </div>
</template>

<style scoped>
.income-page {
  display: grid;
  gap: 14px;
  padding: 12px 0 0;
  color: #111827;
}

.income-breadcrumb {
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
}

.heading-icon {
  display: grid;
  width: 48px;
  height: 48px;
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
  display: grid;
  justify-items: end;
  gap: 14px;
}

.income-search {
  width: 260px;
}

.income-search :deep(.p-inputtext) {
  width: 100%;
  border-radius: 999px;
}

.income-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
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
  gap: 16px;
  min-height: 118px;
  padding: 18px;
}

.income-metric__icon,
.side-list span,
.ai-advice__icon {
  display: grid;
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  font-size: 1.25rem;
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

.income-metric__icon.is-purple {
  background: #f3edff;
  color: #8b5cf6;
}

.income-metric__icon.is-orange {
  background: #fff0e8;
  color: #ff6b2c;
}

.income-metric small,
.side-list small {
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 800;
}

.income-metric strong {
  display: block;
  margin-top: 6px;
  color: #111827;
  font-size: 1.22rem;
  font-weight: 900;
}

.income-metric em {
  display: block;
  margin-top: 8px;
  color: #0f9e2e;
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 900;
}

.income-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.income-panel {
  min-width: 0;
  overflow: hidden;
}

.sales-panel {
  padding: 18px 18px 10px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #111827;
  font-size: 0.98rem;
  font-weight: 900;
}

.income-table :deep(.p-datatable-header-cell),
.income-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.72rem 0.55rem;
  border-color: #edf1f5;
  background: transparent;
  color: #172033;
  font-size: 0.78rem;
}

.income-table :deep(.p-datatable-header-cell) {
  color: #334155;
  font-weight: 900;
}

.product-cell,
.payment-method {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.product-cell span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  background: #f1f5f9;
}

.product-cell strong {
  font-weight: 900;
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

.table-footer {
  display: grid;
  place-items: center;
  padding-top: 12px;
}

.income-side {
  display: grid;
  gap: 16px;
}

.side-panel {
  padding: 18px;
}

.side-list {
  display: grid;
}

.side-list > div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  border-top: 1px solid #edf1f5;
}

.side-list strong {
  display: block;
  margin-top: 3px;
  font-weight: 900;
}

.comparison-list {
  display: grid;
  gap: 16px;
  padding: 10px 0 16px;
}

.comparison-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #334155;
  font-size: 0.84rem;
  font-weight: 800;
}

.comparison-list strong {
  color: #0f9e2e;
  white-space: nowrap;
}

.side-panel footer {
  margin: 0 -18px -18px;
  padding: 14px 18px;
  border-top: 1px solid #edf1f5;
  color: #64748b;
  font-weight: 800;
}

.ai-advice {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr 150px;
  gap: 16px;
  align-items: center;
  width: calc(100% - 336px);
  overflow: hidden;
  padding: 18px 22px;
  border-color: rgba(15, 158, 46, 0.3);
  background:
    linear-gradient(90deg, #ffffff 0%, #f7fff8 64%, #eef9ec 100%);
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
  width: 132px;
  transform: translateY(12px);
  filter: drop-shadow(0 18px 22px rgba(15, 23, 42, 0.16));
}

@media (max-width: 1320px) {
  .income-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .income-grid {
    grid-template-columns: 1fr;
  }

  .ai-advice {
    width: 100%;
  }
}

@media (max-width: 760px) {
  .income-breadcrumb,
  .income-heading,
  .income-heading__tools {
    align-items: flex-start;
    flex-direction: column;
    justify-items: stretch;
  }

  .income-heading__tools,
  .income-search {
    width: 100%;
  }

  .income-metrics,
  .ai-advice {
    grid-template-columns: 1fr;
  }

  .ai-advice img {
    justify-self: start;
  }
}
</style>
