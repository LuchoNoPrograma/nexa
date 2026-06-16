<script setup lang="ts">
import { PLANES, formatoBs, costoMensualEquivalente, ahorroAnualBs, type Plan } from '~~/shared/utils/planes'

const props = withDefaults(defineProps<{
  // Plan preseleccionado (por defecto el destacado).
  modelValue?: string
  // Texto del botón principal.
  ctaLabel?: string
  // Plan que la tienda ya tiene activo (muestra "Tu plan actual").
  planActual?: string
}>(), {
  ctaLabel: 'Comenzar ahora',
  planActual: 'free',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'seleccionar': [value: string]
}>()

const destacado = PLANES.find(p => p.destacado)?.codigo ?? PLANES[0]?.codigo ?? 'free'
const elegido = ref(props.modelValue ?? destacado)

watch(() => props.modelValue, (v) => {
  if (v && v !== elegido.value) {
    elegido.value = v
  }
})

function elegir(codigo: string) {
  elegido.value = codigo
  emit('update:modelValue', codigo)
}

function confirmar() {
  emit('seleccionar', elegido.value)
}

const ahorro = ahorroAnualBs()

// Etiqueta de ahorro para la tarjeta anual ("Ahorras Bs 30").
function ahorroLabel(plan: Plan): string | null {
  if (plan.periodo === 'anual' && ahorro > 0) {
    return `Ahorras ${formatoBs(ahorro)}`
  }
  return null
}

// Línea secundaria de precio: equivalente mensual del plan anual.
function equivalente(plan: Plan): string | null {
  if (plan.periodo === 'anual') {
    return `${formatoBs(costoMensualEquivalente(plan))} / mes`
  }
  return null
}
</script>

<template>
  <div class="plan-selector">
    <div class="plan-grid">
      <button
        v-for="(plan, i) in PLANES"
        :key="plan.codigo"
        type="button"
        class="plan-card"
        :class="{ 'is-selected': elegido === plan.codigo, 'is-featured': plan.destacado }"
        :style="{ '--i': i }"
        @click="elegir(plan.codigo)"
      >
        <span v-if="plan.destacado" class="plan-card__badge">
          <i class="pi pi-star-fill" /> Recomendado
        </span>
        <span v-else-if="ahorroLabel(plan)" class="plan-card__badge plan-card__badge--save">
          {{ ahorroLabel(plan) }}
        </span>

        <header class="plan-card__head">
          <span class="plan-card__radio"><i class="pi pi-check" /></span>
          <strong class="plan-card__name">{{ plan.nombre }}</strong>
          <span v-if="props.planActual === plan.codigo" class="plan-card__current">Tu plan actual</span>
        </header>

        <div class="plan-card__price">
          <strong>{{ plan.precioBs === 0 ? 'Bs 0' : formatoBs(plan.precioBs) }}</strong>
          <small>{{ plan.unidad }}</small>
          <span v-if="equivalente(plan)" class="plan-card__equiv">{{ equivalente(plan) }}</span>
        </div>

        <p class="plan-card__resumen">{{ plan.resumen }}</p>

        <ul class="plan-card__benefits">
          <li v-for="(b, bi) in plan.beneficios" :key="bi">
            <i class="pi pi-check" /> {{ b }}
          </li>
        </ul>
      </button>
    </div>

    <button type="button" class="plan-cta" @click="confirmar">
      <i class="pi pi-shopping-cart" /> {{ props.ctaLabel }}
    </button>

    <p class="plan-foot">
      <i class="pi pi-shield" /> Pago 100% seguro y protegido · Cancela cuando quieras
    </p>
  </div>
</template>

<style scoped>
.plan-selector {
  display: grid;
  gap: 16px;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.plan-card {
  position: relative;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 20px 18px;
  border: 2px solid #e7eee8;
  border-radius: 18px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  animation: plan-rise 0.5s ease both;
  animation-delay: calc(var(--i) * 90ms);
}

.plan-card:hover {
  border-color: #9fd9a6;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.07);
}

.plan-card.is-selected {
  border-color: #0b6f38;
  box-shadow: 0 14px 28px rgba(15, 158, 46, 0.18);
}

.plan-card.is-featured {
  border-color: #cdebd1;
}

.plan-card.is-featured.is-selected {
  border-color: #0b6f38;
}

.plan-card__badge {
  position: absolute;
  top: -11px;
  left: 18px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  background: linear-gradient(150deg, #0b6f38, #0a6f1f);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 900;
  box-shadow: 0 8px 16px rgba(14, 111, 32, 0.26);
}

.plan-card__badge--save {
  background: #1f9e8a;
  box-shadow: 0 8px 16px rgba(31, 158, 138, 0.26);
}

.plan-card__head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.plan-card__radio {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 2px solid #cdd9cf;
  color: transparent;
  font-size: 0.66rem;
  transition: all 0.2s ease;
}

.plan-card.is-selected .plan-card__radio {
  border-color: #0b6f38;
  background: #0b6f38;
  color: #fff;
}

.plan-card__name {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 1.02rem;
  font-weight: 900;
  color: #102016;
}

.plan-card__current {
  margin-left: auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: #eef3ee;
  color: #5d6b61;
  font-size: 0.66rem;
  font-weight: 900;
}

.plan-card__price {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}

.plan-card__price strong {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 1.8rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #102016;
  line-height: 1;
}

.plan-card__price small {
  font-size: 0.78rem;
  font-weight: 800;
  color: #8a978d;
}

.plan-card__equiv {
  width: 100%;
  font-size: 0.74rem;
  font-weight: 800;
  color: #1f9e8a;
}

.plan-card__resumen {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
  color: #5d6b61;
  line-height: 1.4;
}

.plan-card__benefits {
  display: grid;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.plan-card__benefits li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #294232;
  line-height: 1.35;
}

.plan-card__benefits i {
  margin-top: 2px;
  color: #0b6f38;
  font-size: 0.72rem;
}

.plan-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 15px 22px;
  border: 0;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(150deg, #0b6f38, #0a6f1f);
  font-size: 1rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 14px 26px rgba(14, 111, 32, 0.26);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.plan-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px rgba(14, 111, 32, 0.32);
}

.plan-foot {
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #8a978d;
}

.plan-foot i {
  color: #0b6f38;
}

@keyframes plan-rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .plan-card { animation: none !important; }
}

@media (max-width: 820px) {
  .plan-grid { grid-template-columns: 1fr; }
}
</style>
