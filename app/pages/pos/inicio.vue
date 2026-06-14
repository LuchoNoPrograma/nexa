<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Inicio',
})

useHead({
  title: 'Inicio | IMPULSA',
})

const { currentWeather, weatherDays, weatherStatus } = await useCobijaWeather()

// Diagnóstico del negocio (alimenta la tarjeta de progreso y el CTA).
const { data: diagData } = await useFetch('/api/diagnostico/latest', { default: () => null })
const diagnostico = computed(() => diagData.value?.diagnostico ?? null)
const diagnosticoEstado = computed(() => diagData.value?.estado ?? 'pendiente')
const saludNegocio = computed(() => diagnostico.value?.saludGeneral ?? null)

// Paleta calma unificada: 3 familias en vez de 8.
//  - verde de marca (protagonista) · ámbar cálido (acento puntual) · neutro slate.
const toneClasses = {
  green: 'bg-primary-50 text-primary-700',
  emerald: 'bg-primary-50 text-primary-700',
  mint: 'bg-primary-50 text-primary-700',
  lime: 'bg-primary-50 text-primary-700',
  amber: 'bg-amber-50 text-amber-700',
  yellow: 'bg-amber-50 text-amber-700',
  red: 'bg-amber-50 text-amber-700',
  violet: 'bg-slate-100 text-slate-600',
} as const

type Tone = keyof typeof toneClasses

const continueItems = computed<{ label: string; desc: string; icon: string; tone: Tone; progress: number; action: string; to?: string }[]>(() => [
  {
    label: 'Diagnóstico general',
    desc: diagnostico.value ? 'Evaluación de tu negocio' : 'Conoce el estado de tu negocio',
    icon: 'pi pi-chart-line',
    tone: 'violet',
    progress: saludNegocio.value ?? 0,
    action: diagnostico.value ? 'Ver' : 'Iniciar',
    to: '/pos/diagnostico',
  },
  { label: 'Calculadora de precios', desc: 'Define precios justos y competitivos', icon: 'pi pi-calculator', tone: 'green', progress: 42, action: 'Continuar' },
  { label: 'Plan de marketing', desc: 'Estrategias para atraer más clientes', icon: 'pi pi-briefcase', tone: 'amber', progress: 24, action: 'Continuar' },
])

const usedTools: { label: string; desc: string; icon: string; tone: Tone; uses: string; to?: string }[] = [
  { label: 'Calculadora de precios', desc: 'Define precios ideales para tus productos', icon: 'pi pi-calculator', tone: 'violet', uses: '12 usos', to: undefined },
  { label: 'Control de ventas', desc: 'Lleva un registro de tus ventas diarias', icon: 'pi pi-chart-bar', tone: 'green', uses: '9 usos', to: '/pos' },
  { label: 'Control de gastos', desc: 'Administra tus gastos e inversiones', icon: 'pi pi-wallet', tone: 'red', uses: '4 usos', to: undefined },
  { label: 'Generador de ideas', desc: 'Ideas de negocio personalizadas', icon: 'pi pi-lightbulb', tone: 'yellow', uses: '2 usos', to: undefined },
]

const summaryCards = computed<{ label: string; value: string; icon: string; tone: Tone; chart?: string; bar?: number }[]>(() => [
  { label: 'Diagnósticos realizados', value: diagnostico.value ? '1' : '0', icon: 'pi pi-briefcase', tone: 'green', chart: 'up' },
  { label: 'Herramientas usadas', value: '27', icon: 'pi pi-wrench', tone: 'mint', chart: 'up' },
  { label: 'Salud del negocio', value: saludNegocio.value !== null ? `${saludNegocio.value}%` : '—', icon: 'pi pi-chart-line', tone: 'lime', bar: saludNegocio.value ?? 0 },
  { label: 'Impacto generado', value: '+18%', icon: 'pi pi-compass', tone: 'emerald', chart: 'steady' },
])

const suggestions = [
  { label: 'Potencia tu negocio en Pando', desc: 'Revisa tus productos estrella y prepara una campaña para WhatsApp.', image: '/pos-inicio-hero.jpg' },
  { label: 'Mejora tus precios esta semana', desc: 'Actualiza costos y margen antes de lanzar promociones.', image: '/hero-bg.jpg' },
]

function go(to?: string) {
  if (to) {
    void navigateTo(to)
  }
}
</script>

<template>
  <div class="home">
    <section
      class="relative flex min-h-36 items-center overflow-hidden rounded-xl border border-[#e7eee8]/70 bg-[linear-gradient(90deg,rgba(4,12,8,0.9)_0%,rgba(5,20,10,0.72)_28%,rgba(8,38,18,0.2)_56%,rgba(4,12,8,0.04)_100%),url('/pos-inicio-hero.jpg')] bg-cover bg-center text-white shadow-lg xl:min-h-44 2xl:min-h-52 max-[700px]:min-h-32 max-[700px]:bg-[linear-gradient(90deg,rgba(4,12,8,0.92)_0%,rgba(5,20,10,0.76)_56%,rgba(4,12,8,0.14)_100%),url('/pos-inicio-hero.jpg')] max-[700px]:bg-[61%_center]"
    >
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_110%_at_92%_50%,rgba(52,132,49,0.2),rgba(52,132,49,0)_64%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
      <div class="relative z-[1] max-w-sm px-8 py-5 max-[700px]:max-w-xs max-[700px]:px-6 max-[700px]:py-4">
        <h1 class="m-0 font-display text-lg font-black leading-tight tracking-normal sm:text-xl">
          Impulsamos a los emprendedores<br>de nuestra
          <span class="inline-flex items-center gap-1 text-[#58d95b]">
            Amazonía
            <img class="h-5 w-5 flex-none object-contain" src="/leaf-icon.svg" alt="" aria-hidden="true">
          </span>
        </h1>
        <p class="mt-3 max-w-xs text-xs font-bold leading-snug text-white/90">Herramientas inteligentes, decisiones claras<br>y crecimiento sostenible.</p>
      </div>
    </section>

    <NuxtLink v-if="diagnosticoEstado !== 'completado'" to="/pos/diagnostico" class="diag-cta">
      <span class="diag-cta__icon"><i class="pi pi-sparkles" aria-hidden="true" /></span>
      <div class="diag-cta__copy">
        <strong>Haz el diagnóstico rápido de tu negocio</strong>
        <small>Responde 10 preguntas (2-3 min) y recibe recomendaciones personalizadas de NEXA.</small>
      </div>
      <span class="diag-cta__btn">Empezar <i class="pi pi-arrow-right" aria-hidden="true" /></span>
    </NuxtLink>

    <section class="weather-card">
      <div class="weather-main">
        <span class="card-kicker"><i class="pi pi-map-marker" aria-hidden="true" />Ahora en Cobija, Pando</span>
        <div class="weather-now">
          <img :src="currentWeather.icon" class="weather-now__icon" alt="" aria-hidden="true">
          <div>
            <strong>{{ currentWeather.temp }}°C</strong>
            <span>{{ currentWeather.condition }}</span>
            <small>Sensación térmica {{ currentWeather.feelsLike }}°C · {{ weatherStatus }}</small>
          </div>
        </div>
      </div>

      <div class="weather-metrics">
        <div>
          <small>Viento</small>
          <strong><img src="/weather/wind-icon.svg" alt="" aria-hidden="true">{{ currentWeather.wind }} km/h</strong>
        </div>
        <div>
          <small>Humedad</small>
          <strong><img src="/weather/cloud-color-icon.svg" alt="" aria-hidden="true">{{ currentWeather.humidity }}%</strong>
        </div>
        <div>
          <small>Prob. de lluvia</small>
          <strong><img src="/weather/water-drop-icon.svg" alt="" aria-hidden="true">{{ currentWeather.rain }}%</strong>
        </div>
      </div>

      <div class="forecast-block">
        <span class="forecast-title">Pronóstico de 5 días</span>
        <div class="forecast">
          <article v-for="day in weatherDays" :key="day.day" :class="{ 'is-today': day.day === 'Hoy' }">
            <strong>{{ day.day }}</strong>
            <img :src="day.icon" alt="" aria-hidden="true">
            <span>{{ day.temp }}</span>
            <small><img src="/weather/water-drop-icon.svg" alt="" aria-hidden="true">Lluvia {{ day.rain }}%</small>
          </article>
        </div>
      </div>
    </section>

    <div class="home-grid">
      <section class="panel continue-panel">
        <header class="panel-head">
          <h2><i class="pi pi-refresh" aria-hidden="true" />Continuar donde lo dejaste</h2>
        </header>

        <article v-for="item in continueItems" :key="item.label" class="continue-item">
          <span class="tool-icon" :class="toneClasses[item.tone]"><i :class="item.icon" aria-hidden="true" /></span>
          <div>
            <strong>{{ item.label }}</strong>
            <small>{{ item.desc }}</small>
            <span class="progress-track"><span :style="{ width: `${item.progress}%` }" /></span>
          </div>
          <em>{{ item.progress }}%</em>
          <button type="button" @click="go(item.to)">{{ item.action }}</button>
        </article>

        <a class="panel-link" href="#">Ver todo mi progreso <i class="pi pi-arrow-right" aria-hidden="true" /></a>
      </section>

      <section class="panel tools-panel">
        <header class="panel-head">
          <h2><i class="pi pi-bolt" aria-hidden="true" />Herramientas más usadas</h2>
        </header>

        <button
          v-for="tool in usedTools"
          :key="tool.label"
          type="button"
          class="used-tool"
          :class="{ 'is-disabled': !tool.to }"
          @click="go(tool.to)"
        >
          <span class="tool-icon" :class="toneClasses[tool.tone]"><i :class="tool.icon" aria-hidden="true" /></span>
          <span>
            <strong>{{ tool.label }}</strong>
            <small>{{ tool.desc }}</small>
          </span>
          <em>{{ tool.uses }}</em>
          <i class="pi pi-chevron-right" aria-hidden="true" />
        </button>
      </section>

      <section class="panel summary-panel">
        <header class="panel-head">
          <h2><i class="pi pi-chart-bar" aria-hidden="true" />Resumen de tu negocio</h2>
        </header>

        <div class="summary-grid">
          <article v-for="card in summaryCards" :key="card.label" class="summary-card">
            <div>
              <span class="tool-icon" :class="toneClasses[card.tone]"><i :class="card.icon" aria-hidden="true" /></span>
              <small>{{ card.label }}</small>
            </div>
            <strong>{{ card.value }}</strong>
            <span v-if="card.bar" class="progress-track"><span :style="{ width: `${card.bar}%` }" /></span>
            <svg v-else viewBox="0 0 96 24" aria-hidden="true">
              <path d="M2 18 C14 19 18 11 30 13 S48 20 58 12 72 4 94 7" />
            </svg>
          </article>
        </div>
      </section>
    </div>

    <div class="bottom-grid">
      <section class="panel suggestions-panel">
        <header class="panel-head">
          <h2><i class="pi pi-sparkles" aria-hidden="true" />Sugerencias para ti</h2>
        </header>

        <article v-for="item in suggestions" :key="item.label" class="suggestion">
          <img :src="item.image" alt="" aria-hidden="true">
          <div>
            <strong>{{ item.label }}</strong>
            <p>{{ item.desc }}</p>
          </div>
        </article>
      </section>

      <section class="ai-card">
        <div>
          <span class="card-kicker"><i class="pi pi-comments" aria-hidden="true" />Habla con IMPULSA, tu asistente IA</span>
          <h2>¿En qué puedo ayudarte hoy?</h2>
          <p>Consulta ideas de venta, precios, promociones o próximos pasos para tu negocio.</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: 14px;
  color: #102016;
}

.weather-card,
.panel,
.ai-card {
  border: 1px solid #e7eee8;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.diag-cta {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 14px;
  text-decoration: none;
  color: #fff;
  background: linear-gradient(120deg, #0a6f1f, #14b536);
  box-shadow: 0 12px 26px rgba(14, 111, 32, 0.26);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.diag-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(14, 111, 32, 0.32);
}

.diag-cta__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 1.1rem;
}

.diag-cta__copy {
  display: grid;
  gap: 2px;
}

.diag-cta__copy strong {
  font-size: 0.92rem;
  font-weight: 900;
}

.diag-cta__copy small {
  font-size: 0.76rem;
  font-weight: 600;
  opacity: 0.92;
}

.diag-cta__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 9px 16px;
  border-radius: 10px;
  background: #fff;
  color: #0a6f1f;
  font-size: 0.82rem;
  font-weight: 900;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .diag-cta__btn span,
  .diag-cta { flex-wrap: wrap; }
}

.weather-card {
  display: grid;
  grid-template-columns: 1.1fr 1.45fr 1.35fr;
  gap: 20px;
  align-items: center;
  padding: 16px 18px;
}

.card-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 900;
  color: #284233;
}

.card-kicker i {
  color: #3f8f0a;
  font-size: 0.78rem;
}

.weather-now {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
}

.weather-now__icon {
  width: 50px;
  height: 50px;
  object-fit: contain;
}

.weather-now strong {
  display: block;
  font-size: 2.15rem;
  line-height: 1;
  font-weight: 900;
}

.weather-now span,
.weather-now small,
.weather-metrics small,
.forecast span,
.continue-item small,
.used-tool small,
.summary-card small,
.suggestion p,
.ai-card p {
  color: #718074;
  font-size: 0.72rem;
  font-weight: 700;
}

.weather-now small {
  display: block;
  margin-top: 2px;
}

.weather-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.weather-metrics div {
  display: grid;
  gap: 5px;
}

.weather-metrics strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #182a1d;
  font-size: 0.88rem;
}

.weather-metrics img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.forecast {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.forecast-block {
  display: grid;
  gap: 7px;
}

.forecast-title {
  font-size: 0.72rem;
  font-weight: 900;
  color: #284233;
}

.forecast article {
  display: grid;
  justify-items: center;
  gap: 5px;
  padding: 10px 6px;
  border-radius: 10px;
  background: #fbfdfb;
}

.forecast article.is-today {
  background: #f1f8ed;
}

.forecast strong {
  font-size: 0.72rem;
}

.forecast img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.forecast small {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #7d8a80;
  font-size: 0.66rem;
  font-weight: 800;
}

.forecast small img {
  width: 10px;
  height: 10px;
}

.home-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.05fr;
  gap: 14px;
}

.panel {
  padding: 15px;
}

.panel-head {
  margin-bottom: 12px;
}

.panel-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 0.86rem;
  font-weight: 900;
}

.panel-head i {
  color: #3f8f0a;
  font-size: 0.82rem;
}

.continue-item,
.used-tool {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 11px;
  align-items: center;
  width: 100%;
}

.continue-item {
  padding: 10px 0;
  border-bottom: 1px solid #eff4ef;
}

.continue-item strong,
.used-tool strong,
.suggestion strong {
  display: block;
  font-size: 0.78rem;
  font-weight: 900;
}

.tool-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  font-size: 0.9rem;
}

.progress-track {
  display: block;
  height: 6px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf2ee;
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f7d32, #74c043);
}

.continue-item em,
.used-tool em {
  color: #7f8b82;
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 900;
}

.continue-item button {
  border: 0;
  border-radius: 8px;
  background: #edf7e8;
  color: #2d7c2f;
  font-size: 0.68rem;
  font-weight: 900;
  padding: 7px 10px;
  cursor: pointer;
}

.panel-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #2d7c2f;
  font-size: 0.72rem;
  font-weight: 900;
  text-decoration: none;
}

.used-tool {
  padding: 11px 0;
  border: 0;
  border-bottom: 1px solid #eff4ef;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.used-tool.is-disabled {
  cursor: default;
}

.used-tool > i {
  color: #93a096;
  font-size: 0.7rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  min-height: 120px;
  padding: 13px;
  border-radius: 12px;
  background: #fbfdfb;
}

.summary-card > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-card strong {
  display: block;
  margin-top: 10px;
  font-size: 1.55rem;
  line-height: 1;
  font-weight: 900;
}

.summary-card svg {
  width: 100%;
  height: 31px;
  margin-top: 10px;
}

.summary-card path {
  fill: none;
  stroke: #6fbd61;
  stroke-linecap: round;
  stroke-width: 4;
}

.bottom-grid {
  display: grid;
  grid-template-columns: 0.95fr 1.35fr;
  gap: 14px;
}

.suggestion {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eff4ef;
}

.suggestion img {
  width: 88px;
  height: 58px;
  object-fit: cover;
  border-radius: 10px;
}

.suggestion p {
  margin: 4px 0 0;
  line-height: 1.35;
}

.ai-card {
  position: relative;
  min-height: 166px;
  overflow: hidden;
  padding: 22px 24px;
  background:
    linear-gradient(90deg, rgba(244, 252, 241, 0.96), rgba(244, 252, 241, 0.8) 58%, rgba(244, 252, 241, 0.2)),
    url('/pos-inicio-hero.jpg') center / cover no-repeat;
}

.ai-card h2 {
  margin: 18px 0 7px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1rem;
  font-weight: 900;
}

.ai-card p {
  max-width: 390px;
  margin: 0;
  line-height: 1.45;
}

.ai-card img {
  position: absolute;
  right: 24px;
  bottom: -26px;
  width: 155px;
  filter: drop-shadow(0 16px 18px rgba(19, 52, 23, 0.2));
}

@media (max-width: 1180px) {
  .weather-card,
  .home-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }

  .weather-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .weather-card,
  .panel,
  .ai-card {
    border-radius: 12px;
  }

  .weather-metrics,
  .forecast,
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .continue-item,
  .used-tool {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .continue-item button,
  .used-tool em {
    display: none;
  }

  .suggestion {
    grid-template-columns: 76px minmax(0, 1fr);
  }

  .suggestion img {
    width: 76px;
  }

  .ai-card img {
    right: -12px;
    width: 128px;
  }
}
</style>
