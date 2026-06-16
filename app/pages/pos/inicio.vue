<script setup lang="ts">
import type { PosCashMovement } from '~/composables/usePosCashRegister'

definePageMeta({
  layout: 'pos',
  posTitle: 'Inicio',
})

useHead({
  title: 'Inicio | NEXA',
})

const session = usePosSession()

// Diagnóstico del negocio (alimenta el CTA de onboarding).
const { data: diagData } = await useFetch('/api/diagnostico/latest', { default: () => null })
const diagnosticoEstado = computed(() => diagData.value?.estado ?? 'pendiente')

// Caja de hoy: el mismo dato que muestra /pos/caja, leído de la BD.
type CashOverview = {
  session: { status: 'abierta' | 'cerrada' } | null
  movements: PosCashMovement[]
}
const { data: cashData } = await useFetch<CashOverview>('/api/pos/cash', { default: () => null })

// Total de ventas del turno (igual que en la caja: ingresos por venta).
const salesTotal = computed(() => (cashData.value?.movements ?? [])
  .filter(movement => movement.type === 'Ingreso' && movement.source === 'venta')
  .reduce((sum, movement) => sum + movement.amount, 0))

// Primer nombre para un saludo cercano (heurística: lenguaje del mundo real).
const firstName = computed(() => {
  const name = session.value?.name?.trim()
  if (!name) {
    return 'emprendedor'
  }
  return name.split(/\s+/)[0]
})

// Por ahora solo bolivianos (BOB).
const nf = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const salesText = computed(() => nf.format(salesTotal.value))

// Accesos rápidos: pocos, grandes y reconocibles (Nielsen: reconocer > recordar).
const quickActions: { label: string; icon: string; to?: string }[] = [
  { label: 'Ventas', icon: 'pi pi-shopping-cart', to: '/pos' },
  { label: 'Caja', icon: 'pi pi-wallet', to: '/pos/caja' },
  { label: 'Inventario', icon: 'pi pi-box', to: '/pos/catalogo' },
  { label: 'Finanzas', icon: 'pi pi-chart-pie' },
]

// Sugerencias en forma de pregunta: lenguaje cercano para gente de 20 a 60.
const helpCards: { title: string; desc: string; icon: string; tone: string; action: string; to?: string }[] = [
  { title: '¿Estoy ganando o perdiendo?', desc: 'Revisa tus ingresos y gastos del mes.', icon: 'pi pi-chart-line', tone: 'green', action: 'Ver finanzas', to: '/pos/finanzas' },
  { title: '¿Cómo vendo más?', desc: 'Recibe ideas para atraer compradores.', icon: 'pi pi-users', tone: 'amber', action: 'Empezar', to: '/pos/diagnostico' },
  { title: '¿Qué publico en mis redes?', desc: 'Haru te crea publicaciones listas para compartir.', icon: 'pi pi-megaphone', tone: 'green', action: 'Crear publicación', to: '/pos/marketing' },
]

function go(to?: string) {
  if (to) {
    void navigateTo(to)
  }
}
</script>

<template>
  <div class="home">
    <!-- Saludo: estado del sistema visible y cercano -->
    <header class="greeting">
      <p class="greeting__hi">¡Hola, {{ firstName }}! 👋</p>
      <h1 class="greeting__q">¿Qué quieres hacer hoy?</h1>
    </header>

    <!-- CAJA (arriba): el dato más importante del negocio, bien grande -->
    <section class="cash" aria-labelledby="cash-title">
      <div class="cash__head">
        <h2 id="cash-title"><i class="pi pi-wallet" aria-hidden="true" />Caja de hoy</h2>
        <NuxtLink to="/pos/caja" class="cash__link">Ver caja <i class="pi pi-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>

      <p class="cash__label">Total de ventas</p>
      <div class="cash__totals">
        <article>
          <span class="cash__amount"><em>Bs</em>{{ salesText }}</span>
          <small>Bolivianos (BOB)</small>
        </article>
      </div>

      <div class="cash__actions">
        <button
          v-for="action in quickActions"
          :key="action.label"
          type="button"
          @click="go(action.to)"
        >
          <span class="qa-icon"><i :class="action.icon" aria-hidden="true" /></span>
          {{ action.label }}
        </button>
      </div>
    </section>

    <!-- Diagnóstico: CTA puntual, solo si aún no lo completa -->
    <NuxtLink v-if="diagnosticoEstado !== 'completado'" to="/pos/diagnostico" class="diag-cta">
      <span class="diag-cta__icon"><i class="pi pi-sparkles" aria-hidden="true" /></span>
      <div class="diag-cta__copy">
        <strong>Haz el diagnóstico de tu negocio</strong>
        <small>10 preguntas (2-3 min) y recibes recomendaciones de NEXA.</small>
      </div>
      <span class="diag-cta__btn">Empezar <i class="pi pi-arrow-right" aria-hidden="true" /></span>
    </NuxtLink>

    <!-- SUGERENCIAS (abajo): preguntas frecuentes en lenguaje simple -->
    <section class="suggest" aria-labelledby="suggest-title">
      <h2 id="suggest-title" class="suggest__title">Sugerencias para ti</h2>
      <div class="suggest__grid">
        <button
          v-for="card in helpCards"
          :key="card.title"
          type="button"
          class="suggest__card"
          :class="`is-${card.tone}`"
          @click="go(card.to)"
        >
          <span class="suggest__icon"><i :class="card.icon" aria-hidden="true" /></span>
          <strong>{{ card.title }}</strong>
          <small>{{ card.desc }}</small>
          <span class="suggest__cta">{{ card.action }} <i class="pi pi-arrow-right" aria-hidden="true" /></span>
        </button>
      </div>
    </section>

    <!-- Haru: asistente IA -->
    <section class="naru">
      <div class="naru__copy">
        <span class="naru__kicker"><i class="pi pi-sparkles" aria-hidden="true" />El asistente IA de NEXA</span>
        <h2>Soy Haru, pregúntame lo que quieras</h2>
        <p>Ideas de venta, precios, promociones o el siguiente paso para tu negocio.</p>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true" class="naru__mascot">
    </section>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
  color: #102016;
}

/* --- Saludo --- */
.greeting__hi {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 800;
  color: #5c6b60;
}

.greeting__q {
  margin: 2px 0 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1.15;
}

/* --- Caja (protagonista) --- */
.cash {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, #0a6f1f 0%, #0e8a28 55%, #0b6f38 100%);
  box-shadow: 0 16px 34px rgba(10, 111, 32, 0.26);
}

.cash__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cash__head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1rem;
  font-weight: 900;
}

.cash__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 0.76rem;
  font-weight: 800;
  text-decoration: none;
  transition: background 0.15s ease;
}

.cash__link:hover {
  background: rgba(255, 255, 255, 0.3);
}

.cash__label {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.82);
}

.cash__totals {
  display: grid;
  gap: 12px;
}

.cash__totals article {
  display: grid;
  gap: 3px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.14);
  text-align: center;
}

.cash__amount {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  font-size: 1.9rem;
  font-weight: 900;
  line-height: 1.1;
}

.cash__amount em {
  font-size: 0.85rem;
  font-style: normal;
  font-weight: 800;
  opacity: 0.85;
}

.cash__totals small {
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}

.cash__actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.cash__actions button {
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 13px 6px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  color: #1c3a24;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.cash__actions button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(3, 24, 9, 0.22);
}

.qa-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #eaf6e7;
  color: #1c7a2c;
  font-size: 1.05rem;
}

/* --- Diagnóstico CTA --- */
.diag-cta {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  text-decoration: none;
  color: #143a1f;
  background: #f1f8ed;
  border: 1px solid #d8ecd0;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.diag-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(14, 111, 32, 0.14);
}

.diag-cta__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: #dcefd2;
  color: #0e8a28;
  font-size: 1.15rem;
}

.diag-cta__copy {
  display: grid;
  gap: 2px;
}

.diag-cta__copy strong {
  font-size: 0.9rem;
  font-weight: 900;
}

.diag-cta__copy small {
  font-size: 0.76rem;
  font-weight: 600;
  color: #5c6b60;
}

.diag-cta__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 10px 16px;
  border-radius: 11px;
  background: linear-gradient(120deg, #0a6f1f, #0b6f38);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 900;
  white-space: nowrap;
}

/* --- Sugerencias --- */
.suggest__title {
  margin: 0 0 2px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.05rem;
  font-weight: 900;
}

.suggest__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.suggest__card {
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid #e7eee8;
  border-radius: 16px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.suggest__card:hover {
  transform: translateY(-3px);
  border-color: #cfe3c6;
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
}

.suggest__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  font-size: 1.25rem;
}

.is-green .suggest__icon {
  background: #eaf6e7;
  color: #1c7a2c;
}

.is-amber .suggest__icon {
  background: #fdf2dc;
  color: #b9781a;
}

.is-slate .suggest__icon {
  background: #eef1f4;
  color: #5b6675;
}

.suggest__card strong {
  font-size: 0.92rem;
  font-weight: 900;
  line-height: 1.25;
}

.suggest__card small {
  font-size: 0.76rem;
  font-weight: 600;
  color: #6b7a6f;
  line-height: 1.4;
}

.suggest__cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 0.76rem;
  font-weight: 900;
  color: #1c7a2c;
}

.is-slate .suggest__cta {
  color: #8a93a0;
}

/* --- Haru --- */
.naru {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 172px;
  overflow: hidden;
  padding: 20px 175px 20px 22px;
  border-radius: 18px;
  background: linear-gradient(120deg, #063718, #0e7a26 70%, #14a634);
  color: #fff;
  box-shadow: 0 16px 34px rgba(6, 55, 24, 0.26);
}

.naru__kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 900;
  color: #9af29c;
}

.naru__copy h2 {
  margin: 8px 0 5px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.1rem;
  font-weight: 900;
}

.naru__copy p {
  margin: 0;
  max-width: 360px;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.88);
}

.naru__mascot {
  position: absolute;
  right: 16px;
  bottom: 0;
  height: 168px;
  width: auto;
  object-fit: contain;
  object-position: bottom;
  filter: drop-shadow(0 14px 18px rgba(3, 24, 9, 0.34));
  pointer-events: none;
}

/* --- Responsivo --- */
@media (max-width: 640px) {
  .home {
    gap: 14px;
  }

  .greeting__q {
    font-size: 1.3rem;
  }

  .cash {
    padding: 16px;
  }

  .cash__totals {
    gap: 8px;
  }

  .cash__totals article {
    padding: 14px 6px;
  }

  .cash__amount {
    font-size: 1.55rem;
  }

  .cash__actions {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .cash__actions button {
    padding: 11px 4px;
    font-size: 0.68rem;
  }

  .qa-icon {
    width: 36px;
    height: 36px;
    font-size: 0.95rem;
  }

  .suggest__grid {
    grid-template-columns: 1fr;
  }

  .diag-cta {
    flex-wrap: wrap;
  }

  .diag-cta__btn {
    margin-left: 0;
    width: 100%;
    justify-content: center;
  }

  .naru {
    min-height: 150px;
    padding: 18px 130px 18px 18px;
  }

  .naru__mascot {
    height: 142px;
    right: 8px;
  }
}

@media (max-width: 380px) {
  .cash__amount em {
    font-size: 0.7rem;
  }

  .cash__totals small {
    font-size: 0.62rem;
  }
}
</style>
