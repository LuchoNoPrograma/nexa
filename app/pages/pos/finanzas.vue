<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Finanzas',
})

useHead({
  title: 'Finanzas | NEXA',
})

const session = usePosSession()

// Saludo cercano usando el nombre del negocio (lenguaje del mundo real, 20-60 años).
const storeName = computed(() => session.value?.store?.trim() || 'tu negocio')

type Category = { label: string, amount: number, color: string }
type TrendPoint = { label: string, amount: number }
type Period = {
  label: string
  short: string
  income: number
  balance: number
  expenses: Category[]
  incomeSources: Category[]
  incomeTrend: TrendPoint[]
}

// Datos demo coherentes: cada periodo cuadra (ingresos - gastos = ganancia).
const finances: Record<'este' | 'pasado', Period> = {
  este: {
    label: 'este mes',
    short: 'Este mes',
    income: 48750,
    balance: 62340,
    expenses: [
      { label: 'Compras de productos', amount: 8300, color: '#0b6f38' },
      { label: 'Sueldos', amount: 5640, color: '#22c55e' },
      { label: 'Luz, agua e internet', amount: 4500, color: '#3b82f6' },
      { label: 'Transporte', amount: 2450, color: '#f59e0b' },
      { label: 'Publicidad', amount: 2140, color: '#8b5cf6' },
      { label: 'Otros gastos', amount: 830, color: '#94a3b8' },
    ],
    // De dónde entró el dinero (suma = income).
    incomeSources: [
      { label: 'Ventas en el local', amount: 31000, color: '#0b6f38' },
      { label: 'Delivery', amount: 12750, color: '#22c55e' },
      { label: 'Pedidos especiales', amount: 5000, color: '#3b82f6' },
    ],
    // Ingresos de los últimos 6 meses (el último es este mes).
    incomeTrend: [
      { label: 'Ene', amount: 38000 },
      { label: 'Feb', amount: 41000 },
      { label: 'Mar', amount: 39500 },
      { label: 'Abr', amount: 44000 },
      { label: 'May', amount: 41200 },
      { label: 'Jun', amount: 48750 },
    ],
  },
  pasado: {
    label: 'el mes pasado',
    short: 'Mes pasado',
    income: 41200,
    balance: 56350,
    expenses: [
      { label: 'Compras de productos', amount: 7600, color: '#0b6f38' },
      { label: 'Sueldos', amount: 5200, color: '#22c55e' },
      { label: 'Luz, agua e internet', amount: 4300, color: '#3b82f6' },
      { label: 'Transporte', amount: 2200, color: '#f59e0b' },
      { label: 'Publicidad', amount: 1900, color: '#8b5cf6' },
      { label: 'Otros gastos', amount: 1100, color: '#94a3b8' },
    ],
    incomeSources: [
      { label: 'Ventas en el local', amount: 27000, color: '#0b6f38' },
      { label: 'Delivery', amount: 10200, color: '#22c55e' },
      { label: 'Pedidos especiales', amount: 4000, color: '#3b82f6' },
    ],
    incomeTrend: [
      { label: 'Dic', amount: 35000 },
      { label: 'Ene', amount: 37000 },
      { label: 'Feb', amount: 36500 },
      { label: 'Mar', amount: 40000 },
      { label: 'Abr', amount: 38800 },
      { label: 'May', amount: 41200 },
    ],
  },
}

const period = ref<'este' | 'pasado'>('este')
const periodOptions = [
  { value: 'este' as const, label: 'Este mes' },
  { value: 'pasado' as const, label: 'Mes pasado' },
]

const current = computed(() => finances[period.value])
const periodLabel = computed(() => current.value.label)

function expensesOf(p: Period) {
  return p.expenses.reduce((sum, cat) => sum + cat.amount, 0)
}
function profitOf(p: Period) {
  return p.income - expensesOf(p)
}

const income = computed(() => current.value.income)
const expensesTotal = computed(() => expensesOf(current.value))
const profit = computed(() => profitOf(current.value))
const isProfit = computed(() => profit.value >= 0)
const balance = computed(() => current.value.balance)

// Comparación amable contra el mes anterior (solo cuando estamos viendo "este mes").
const profitDelta = computed(() => period.value === 'este' ? profit.value - profitOf(finances.pasado) : null)

// Categorías con porcentaje calculado para que la tortita siempre cuadre.
const expenseCategories = computed(() => {
  const total = expensesTotal.value || 1
  return current.value.expenses.map(cat => ({
    ...cat,
    percent: Math.round((cat.amount / total) * 100),
  }))
})

// Tortita (dona) de gastos: gradiente cónico generado desde los montos reales.
const donutGradient = computed(() => buildDonut(current.value.expenses, expensesTotal.value))

// --- Ingresos: de dónde entra el dinero + cómo viene cambiando ---
const incomeSources = computed(() => {
  const total = income.value || 1
  return current.value.incomeSources.map(src => ({
    ...src,
    percent: Math.round((src.amount / total) * 100),
  }))
})

const incomeDonut = computed(() => buildDonut(current.value.incomeSources, income.value))

const incomeTrend = computed(() => current.value.incomeTrend)
const maxTrend = computed(() => Math.max(...incomeTrend.value.map(p => p.amount), 1))
function trendHeight(point: TrendPoint) {
  return `${Math.max((point.amount / maxTrend.value) * 100, 8)}%`
}

// Construye un gradiente cónico (dona) a partir de una lista de montos.
function buildDonut(items: Category[], total: number) {
  const safeTotal = total || 1
  let acc = 0
  const stops = items.map((item) => {
    const from = acc
    acc += (item.amount / safeTotal) * 100
    return `${item.color} ${from}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

const haruTip = computed(() => isProfit.value
  ? 'Revisa tus gastos cada semana. Los gastos chiquitos, juntos, se comen tu ganancia sin que te des cuenta.'
  : 'Este mes gastaste más de lo que vendiste. Mira en qué se fue tu plata y recorta el gasto más grande primero.')

const nf = new Intl.NumberFormat('es-BO')
function bs(value: number) {
  return nf.format(Math.round(value))
}
</script>

<template>
  <div class="fin">
    <!-- Saludo cercano + selector de mes -->
    <header class="fin-greet">
      <div>
        <p class="fin-greet__hi">Hola, {{ storeName }} 👋</p>
        <h1 class="fin-greet__title">Así va tu dinero</h1>
      </div>

      <div class="fin-period" role="group" aria-label="Periodo">
        <button
          v-for="option in periodOptions"
          :key="option.value"
          type="button"
          :class="{ 'is-active': period === option.value }"
          @click="period = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </header>

    <!-- HÉROE: la historia completa en un vistazo -> entró, salió, te quedó -->
    <section class="fin-hero" :class="{ 'is-loss': !isProfit }" aria-label="Resumen del mes">
      <div class="fin-hero__main">
        <small>{{ isProfit ? `Te quedó de ganancia ${periodLabel}` : `Perdiste ${periodLabel}` }}</small>
        <strong><em>Bs</em>{{ bs(Math.abs(profit)) }}</strong>
        <p v-if="profitDelta !== null && profitDelta !== 0" class="fin-hero__delta">
          <i :class="profitDelta > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" aria-hidden="true" />
          Bs {{ bs(Math.abs(profitDelta)) }} {{ profitDelta > 0 ? 'más' : 'menos' }} que el mes pasado
        </p>
        <p v-else class="fin-hero__delta is-muted">Resumen de {{ periodLabel }}</p>
      </div>

      <div class="fin-hero__split">
        <article class="fin-hero__tile is-in">
          <span class="fin-hero__ic"><i class="pi pi-arrow-down-left" aria-hidden="true" /></span>
          <span>
            <small>Entró</small>
            <strong>Bs {{ bs(income) }}</strong>
          </span>
        </article>
        <article class="fin-hero__tile is-out">
          <span class="fin-hero__ic"><i class="pi pi-arrow-up-right" aria-hidden="true" /></span>
          <span>
            <small>Salió</small>
            <strong>Bs {{ bs(expensesTotal) }}</strong>
          </span>
        </article>
      </div>

      <footer class="fin-hero__balance">
        <i class="pi pi-wallet" aria-hidden="true" />
        <span>Tienes disponible en caja y banco</span>
        <strong>Bs {{ bs(balance) }}</strong>
      </footer>
    </section>

    <!-- Dos tarjetas grandes: de dónde entra el dinero / en qué se va -->
    <div class="fin-grid">
      <!-- INGRESOS: gráfica de cómo entra el dinero -->
      <section class="fin-card" aria-label="De dónde entra tu dinero">
        <header class="fin-card__head">
          <div>
            <h2>¿De dónde entra tu dinero?</h2>
            <small>Tus ingresos de {{ periodLabel }}</small>
          </div>
          <NuxtLink to="/pos/ingresos" class="fin-link">Ver ingresos <i class="pi pi-arrow-right" aria-hidden="true" /></NuxtLink>
        </header>

        <!-- Gráfica de barras: cómo vienen cambiando los ingresos -->
        <div class="trend" role="img" aria-label="Ingresos de los últimos meses">
          <div class="trend__bars">
            <div
              v-for="(point, index) in incomeTrend"
              :key="point.label"
              class="trend__col"
              :class="{ 'is-last': index === incomeTrend.length - 1 }"
            >
              <span class="trend__val">Bs {{ bs(point.amount) }}</span>
              <span class="trend__bar" :style="{ height: trendHeight(point) }" />
              <small class="trend__label">{{ point.label }}</small>
            </div>
          </div>
        </div>

        <!-- Desglose: por dónde llegó cada boliviano -->
        <div class="spend">
          <div class="spend__chart">
            <div class="donut" :style="{ background: incomeDonut }" aria-hidden="true">
              <div class="donut__hole">
                <strong>Bs {{ bs(income) }}</strong>
                <small>entró</small>
              </div>
            </div>
          </div>

          <ul class="spend__list">
            <li v-for="src in incomeSources" :key="src.label">
              <span class="spend__dot" :style="{ background: src.color }" />
              <span class="spend__label">{{ src.label }}</span>
              <span class="spend__amount">Bs {{ bs(src.amount) }}</span>
              <span class="spend__pct">{{ src.percent }}%</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- GASTOS: ¿en qué se va tu dinero? -->
      <section class="fin-card" aria-label="En qué se va tu dinero">
        <header class="fin-card__head">
          <div>
            <h2>¿En qué se va tu dinero?</h2>
            <small>Tus gastos de {{ periodLabel }}</small>
          </div>
          <NuxtLink to="/pos/gastos" class="fin-link">Ver gastos <i class="pi pi-arrow-right" aria-hidden="true" /></NuxtLink>
        </header>

        <div class="spend">
          <div class="spend__chart">
            <div class="donut" :style="{ background: donutGradient }" aria-hidden="true">
              <div class="donut__hole">
                <strong>Bs {{ bs(expensesTotal) }}</strong>
                <small>en gastos</small>
              </div>
            </div>
          </div>

          <ul class="spend__list">
            <li v-for="cat in expenseCategories" :key="cat.label">
              <span class="spend__dot" :style="{ background: cat.color }" />
              <span class="spend__label">{{ cat.label }}</span>
              <span class="spend__amount">Bs {{ bs(cat.amount) }}</span>
              <span class="spend__pct">{{ cat.percent }}%</span>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- Consejo de Haru -->
    <section class="haru-tip">
      <div class="haru-tip__copy">
        <span class="haru-tip__kicker"><i class="pi pi-sparkles" aria-hidden="true" />Consejo de Haru</span>
        <p>{{ haruTip }}</p>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true" class="haru-tip__mascot">
    </section>
  </div>
</template>

<style scoped>
.fin {
  display: grid;
  gap: 16px;
  width: min(100%, 920px);
  margin: 0 auto;
  color: #102016;
}

/* Dos tarjetas grandes lado a lado en desktop, apiladas en tablet/móvil. */
.fin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

/* --- Saludo + periodo --- */
.fin-greet {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.fin-greet__hi {
  margin: 0;
  color: #5c6b60;
  font-size: 0.92rem;
  font-weight: 800;
}

.fin-greet__title {
  margin: 2px 0 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1.15;
}

.fin-period {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 4px;
  border: 1px solid #e2ebe4;
  border-radius: 999px;
  background: #fff;
}

.fin-period button {
  border: 0;
  border-radius: 999px;
  padding: 7px 14px;
  background: transparent;
  color: #5c6b60;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.fin-period button.is-active {
  background: #0b6f38;
  color: #fff;
}

/* --- Héroe: entró / salió / te quedó --- */
.fin-hero {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, #0a6f1f 0%, #0e8a28 55%, #0b6f38 100%);
  box-shadow: 0 16px 34px rgba(10, 111, 32, 0.26);
}

.fin-hero.is-loss {
  background: linear-gradient(135deg, #b4451b 0%, #d75a23 55%, #ec6a2c 100%);
  box-shadow: 0 16px 34px rgba(180, 69, 27, 0.26);
}

.fin-hero__main {
  display: grid;
  gap: 4px;
  justify-items: center;
  text-align: center;
}

.fin-hero__main > small {
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.88);
}

.fin-hero__main strong {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 2.6rem;
  font-weight: 900;
  line-height: 1;
}

.fin-hero__main strong em {
  font-size: 1.1rem;
  font-style: normal;
  font-weight: 800;
  opacity: 0.85;
}

.fin-hero__delta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 0;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 0.76rem;
  font-weight: 800;
}

.fin-hero__delta.is-muted {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
}

.fin-hero__split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.fin-hero__tile {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.14);
}

.fin-hero__ic {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

.fin-hero__tile.is-in .fin-hero__ic {
  color: #0a6f1f;
}

.fin-hero__tile.is-out .fin-hero__ic {
  color: #c0501f;
}

.fin-hero__tile small {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}

.fin-hero__tile strong {
  display: block;
  font-size: 1.12rem;
  font-weight: 900;
}

.fin-hero__balance {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.22);
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.fin-hero__balance strong {
  margin-left: auto;
  font-size: 0.96rem;
  font-weight: 900;
  color: #fff;
}

/* --- Tarjetas blancas --- */
.fin-card {
  padding: 18px;
  border: 1px solid #e7eee8;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.fin-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}

.fin-card__head h2 {
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.05rem;
  font-weight: 900;
}

.fin-card__head small {
  color: #6b7a6f;
  font-size: 0.74rem;
  font-weight: 700;
}

.fin-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  color: #1c7a2c;
  font-size: 0.78rem;
  font-weight: 900;
  text-decoration: none;
}

.fin-link:hover {
  text-decoration: underline;
}

/* --- Tortita / dona --- */
.spend {
  display: grid;
  grid-template-columns: 152px minmax(0, 1fr);
  gap: 20px;
  align-items: center;
}

.spend__chart {
  display: grid;
  place-items: center;
}

.donut {
  position: relative;
  width: 148px;
  aspect-ratio: 1;
  border-radius: 50%;
}

.donut__hole {
  position: absolute;
  inset: 23%;
  display: grid;
  place-items: center;
  align-content: center;
  border-radius: 50%;
  background: #fff;
  text-align: center;
  box-shadow: inset 0 0 0 1px #eef3ef;
}

.donut__hole strong {
  font-size: 0.92rem;
  font-weight: 900;
}

.donut__hole small {
  color: #6b7a6f;
  font-size: 0.66rem;
  font-weight: 700;
}

.spend__list {
  display: grid;
  gap: 11px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.spend__list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto 38px;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
}

.spend__dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
}

.spend__label {
  overflow: hidden;
  color: #28352c;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spend__amount {
  color: #46554b;
  font-weight: 800;
  white-space: nowrap;
}

.spend__pct {
  color: #8a958c;
  font-weight: 800;
  text-align: right;
}

/* --- Gráfica de ingresos (barras por mes) --- */
.trend {
  margin-bottom: 18px;
  padding: 14px 4px 0;
  border-bottom: 1px solid #eef3ef;
}

.trend__bars {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  align-items: end;
  gap: 10px;
  height: 132px;
}

.trend__col {
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-items: end;
  justify-items: center;
  gap: 6px;
  height: 100%;
}

.trend__val {
  font-size: 0.6rem;
  font-weight: 800;
  color: #8a958c;
  opacity: 0;
  transition: opacity 0.15s ease;
  white-space: nowrap;
}

.trend__col.is-last .trend__val,
.trend__col:hover .trend__val {
  opacity: 1;
  color: #1c7a2c;
}

.trend__bar {
  width: 100%;
  max-width: 34px;
  align-self: end;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(180deg, #bfe6c4, #8fd49a);
  transition: filter 0.15s ease;
}

.trend__col.is-last .trend__bar {
  background: linear-gradient(180deg, #0b6f38, #0a6f1f);
}

.trend__col:hover .trend__bar {
  filter: brightness(0.96);
}

.trend__label {
  font-size: 0.68rem;
  font-weight: 800;
  color: #6b7a6f;
}

.trend__col.is-last .trend__label {
  color: #1c7a2c;
}

/* --- Consejo de Haru --- */
.haru-tip {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 150px;
  overflow: hidden;
  padding: 20px 165px 20px 22px;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(120deg, #063718, #0e7a26 70%, #14a634);
  box-shadow: 0 16px 34px rgba(6, 55, 24, 0.26);
}

.haru-tip__kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #9af29c;
  font-size: 0.72rem;
  font-weight: 900;
}

.haru-tip__copy p {
  margin: 8px 0 0;
  max-width: 360px;
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.92);
}

.haru-tip__mascot {
  position: absolute;
  right: 12px;
  bottom: 0;
  height: 150px;
  width: auto;
  object-fit: contain;
  object-position: bottom;
  filter: drop-shadow(0 14px 18px rgba(3, 24, 9, 0.34));
  pointer-events: none;
}

/* --- Responsivo --- */
/* Tablet y móvil: las dos tarjetas grandes pasan a una sola columna. */
@media (max-width: 1024px) {
  .fin-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .fin-greet {
    align-items: flex-start;
    flex-direction: column;
  }

  .fin-period {
    width: 100%;
  }

  .fin-period button {
    flex: 1 1 0;
  }

  .fin-hero__main strong {
    font-size: 2.2rem;
  }

  .spend {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 16px;
  }

  .spend__list {
    width: 100%;
  }

  .trend__bars {
    height: 116px;
    gap: 6px;
  }

  .trend__val {
    display: none;
  }

  .haru-tip {
    min-height: 134px;
    padding: 18px 124px 18px 18px;
  }

  .haru-tip__mascot {
    height: 130px;
    right: 6px;
  }
}

@media (max-width: 380px) {
  .fin-hero__split {
    grid-template-columns: 1fr;
  }
}
</style>
