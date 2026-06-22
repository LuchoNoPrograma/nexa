<script setup lang="ts">
import type { ResultadoFinanzas } from '~~/shared/utils/finanzas'

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

const period = ref<'este' | 'pasado'>('este')
const periodOptions = [
  { value: 'este' as const, label: 'Este mes' },
  { value: 'pasado' as const, label: 'Mes pasado' },
]

const periodLabel = computed(() => period.value === 'pasado' ? 'el mes pasado' : 'este mes')
const previousPeriodLabel = computed(() => period.value === 'este' ? 'mes pasado' : 'periodo anterior')

// Construye un gradiente cónico (dona) a partir de una lista de montos.
function buildDonut(items: Category[], total: number) {
  if (total <= 0) {
    return 'conic-gradient(#e5e7eb 0% 100%)'
  }

  const safeTotal = total || 1
  let acc = 0
  const stops = items.map((item) => {
    const from = acc
    acc += (item.amount / safeTotal) * 100
    return `${item.color} ${from}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

const nf = new Intl.NumberFormat('es-BO')
function bs(value: number) {
  return nf.format(Math.round(value))
}

// --- Resultado real del periodo (datos REALES vía API) ---
const { data: cascada } = await useFetch<ResultadoFinanzas & { periodo: string }>(
  '/api/pos/finanzas/cascada',
  {
    query: computed(() => ({ periodo: period.value })),
    watch: [period],
    default: () => null,
  },
)

const netaIsProfit = computed(() => (cascada.value?.utilidadNeta ?? 0) >= 0)
const income = computed(() => {
  const c = cascada.value
  return (c?.ventasPeriodo ?? 0) + (c?.otrosIngresos ?? 0)
})
const expensesTotal = computed(() => {
  const c = cascada.value
  return (c?.costoVentas ?? 0) + (c?.gastosOperativos ?? 0) + (c?.gastosFinancieros ?? 0)
})
const profit = computed(() => cascada.value?.utilidadNeta ?? 0)
const isProfit = computed(() => profit.value >= 0)

const previousProfit = ref<number | null>(null)
watch(
  period,
  async (value) => {
    if (value !== 'este') {
      previousProfit.value = null
      return
    }

    const data = await $fetch<ResultadoFinanzas & { periodo: string }>('/api/pos/finanzas/cascada', {
      query: { periodo: 'pasado' },
    }).catch(() => null)
    previousProfit.value = data?.utilidadNeta ?? null
  },
  { immediate: true },
)

const profitDelta = computed(() => previousProfit.value === null ? null : profit.value - previousProfit.value)

// "¿A dónde va tu dinero?": de cada venta, cuánto se fue en costo, cuánto en
// gastos y cuánto quedó como ganancia. Es la lectura simple que reemplaza la
// cascada contable de 7 pasos: 3 pedazos que siempre suman el 100%.
const resumen = computed(() => {
  const c = cascada.value
  if (!c) return null

  const costo = Math.max(0, c.costoVentas)
  // Gastos netos del periodo (operativos + financieros − otros ingresos).
  const gastos = Math.max(0, c.gastosOperativos + c.gastosFinancieros - c.otrosIngresos)
  const ganancia = c.utilidadNeta
  // Base para los anchos: siempre suman 100% aunque haya pérdida.
  const base = costo + gastos + Math.max(0, ganancia) || 1

  return {
    ventas: c.ventasPeriodo,
    costo,
    gastos,
    ganancia,
    margenNeto: c.margenNeto,
    partes: [
      { clave: 'costo', label: 'Costo de productos', monto: costo, color: '#f59e0b', width: (costo / base) * 100, hint: 'Lo que te costó lo que vendiste' },
      { clave: 'gastos', label: 'Gastos del negocio', monto: gastos, color: '#ef4444', width: (gastos / base) * 100, hint: 'Sueldos, alquiler, luz, transporte…' },
      { clave: 'ganancia', label: 'Tu ganancia', monto: Math.max(0, ganancia), color: '#0b6f38', width: (Math.max(0, ganancia) / base) * 100, hint: 'Lo que te quedó limpio' },
    ],
  }
})

const incomeSources = computed(() => {
  const c = cascada.value
  const sources = [
    { label: 'Ventas del periodo', amount: c?.ventasPeriodo ?? 0, color: '#0b6f38' },
    { label: 'Otros ingresos', amount: c?.otrosIngresos ?? 0, color: '#3b82f6' },
  ].filter((item) => item.amount > 0)

  const total = income.value || 1
  return (sources.length ? sources : [{ label: 'Sin ingresos registrados', amount: 0, color: '#94a3b8' }]).map(src => ({
    ...src,
    percent: Math.round((src.amount / total) * 100),
  }))
})

const incomeDonut = computed(() => buildDonut(incomeSources.value, income.value))

const expenseCategories = computed(() => {
  const c = cascada.value
  const categories = [
    { label: 'Costo de productos vendidos', amount: c?.costoVentas ?? 0, color: '#f59e0b' },
    { label: 'Gastos operativos', amount: c?.gastosOperativos ?? 0, color: '#ef4444' },
    { label: 'Gastos financieros', amount: c?.gastosFinancieros ?? 0, color: '#8b5cf6' },
  ].filter((item) => item.amount > 0)

  const total = expensesTotal.value || 1
  return (categories.length ? categories : [{ label: 'Sin gastos registrados', amount: 0, color: '#94a3b8' }]).map(cat => ({
    ...cat,
    percent: Math.round((cat.amount / total) * 100),
  }))
})

const donutGradient = computed(() => buildDonut(expenseCategories.value, expensesTotal.value))

const haruTip = computed(() => isProfit.value
  ? 'Tu resumen cruza ventas, costo de productos y gastos. Si quieres mejorar la ganancia, empieza por revisar el gasto más grande o los productos con menor margen.'
  : 'Este periodo estás perdiendo dinero. Revisa primero costos de productos, luego gastos operativos y después ajusta precios donde el margen por unidad sea bajo.')

// Frase amable que explica el margen neto (ROS) sin jerga.
const rosTexto = computed(() => {
  const m = cascada.value?.margenNeto
  if (m === null || m === undefined) return 'Aún no registras ventas en este periodo.'
  if (m >= 0) return `De cada Bs 100 que vendes, te quedan Bs ${m.toFixed(2)} de ganancia.`
  return `De cada Bs 100 que vendes, pierdes Bs ${Math.abs(m).toFixed(2)}.`
})
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
          Bs {{ bs(Math.abs(profitDelta)) }} {{ profitDelta > 0 ? 'más' : 'menos' }} que el {{ previousPeriodLabel }}
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
    </section>

    <!-- GANANCIA REAL: lectura simple — a dónde va cada boliviano que vendes -->
    <section v-if="resumen" class="profit" :class="{ 'is-loss': !netaIsProfit }" aria-label="Tu ganancia del periodo">
      <div class="profit__top">
        <div class="profit__headline">
          <small>{{ netaIsProfit ? `Tu ganancia ${periodLabel}` : `Tu pérdida ${periodLabel}` }}</small>
          <strong><em>Bs</em> {{ bs(Math.abs(resumen.ganancia)) }}</strong>
          <span class="profit__ros"><i class="pi pi-sparkles" aria-hidden="true" /> {{ rosTexto }}</span>
        </div>
      </div>

      <!-- Barra: a dónde va tu dinero (siempre suma 100%) -->
      <div class="profit__where">
        <span class="profit__where-title">¿A dónde va tu dinero?</span>
        <div class="moneybar" role="img" aria-label="Reparto de tus ventas">
          <span
            v-for="parte in resumen.partes"
            :key="parte.clave"
            class="moneybar__seg"
            :style="{ width: `${parte.width}%`, background: parte.color }"
            :title="`${parte.label}: Bs ${bs(parte.monto)}`"
          />
        </div>
        <ul class="profit__legend">
          <li v-for="parte in resumen.partes" :key="parte.clave">
            <span class="profit__dot" :style="{ background: parte.color }" />
            <span class="profit__leg-label">
              {{ parte.label }}
              <small>{{ parte.hint }}</small>
            </span>
            <strong class="profit__leg-amount">Bs {{ bs(parte.monto) }}</strong>
          </li>
        </ul>
      </div>

      <p class="profit__note">
        <i class="pi pi-shield" aria-hidden="true" />
        Calculado con tus ventas y gastos reales del periodo. No incluye impuestos.
      </p>
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

/* --- Ganancia real: lectura simple "a dónde va tu dinero" --- */
.profit {
  background: #fff;
  border: 1px solid #e3ece5;
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 10px 30px rgba(11, 31, 58, 0.05);
  display: grid;
  gap: 20px;
}

.profit__headline {
  display: grid;
  gap: 4px;
}

.profit__headline small {
  color: #5c6b60;
  font-weight: 800;
  font-size: 0.95rem;
}

.profit__headline strong {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 2.6rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #0b6f38;
  line-height: 1;
}

.profit.is-loss .profit__headline strong {
  color: #b3261e;
}

.profit__headline strong em {
  font-style: normal;
  font-size: 1.2rem;
  font-weight: 800;
  opacity: 0.7;
  margin-right: 6px;
}

.profit__ros {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 6px;
  background: #eafaf0;
  color: #06351c;
  font-weight: 800;
  font-size: 0.9rem;
  padding: 7px 12px;
  border-radius: 999px;
  width: fit-content;
}

.profit.is-loss .profit__ros {
  background: #fdeaea;
  color: #8f1d17;
}

.profit__where-title {
  display: block;
  font-weight: 800;
  color: #102016;
  margin-bottom: 10px;
}

/* Barra de reparto: segmentos que siempre suman 100% */
.moneybar {
  display: flex;
  height: 22px;
  border-radius: 999px;
  overflow: hidden;
  background: #eef3ef;
}

.moneybar__seg {
  height: 100%;
  transition: width 0.4s ease;
  min-width: 2px;
}

.profit__legend {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.profit__legend li {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: 10px;
}

.profit__dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

.profit__leg-label {
  display: grid;
  gap: 1px;
  font-weight: 800;
  color: #102016;
  min-width: 0;
}

.profit__leg-label small {
  font-weight: 600;
  color: #6b7a70;
  font-size: 0.78rem;
}

.profit__leg-amount {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #102016;
  white-space: nowrap;
}

.profit__note {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7a70;
  font-size: 0.82rem;
  font-weight: 600;
}

@media (max-width: 560px) {
  .profit__headline strong {
    font-size: 2.1rem;
  }
}
</style>
