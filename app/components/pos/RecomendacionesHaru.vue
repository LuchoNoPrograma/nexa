<script setup lang="ts">
import type { Recomendacion } from '~~/shared/utils/recomendaciones/tipos'

// Panel reutilizable de recomendaciones de Haru. Cada vista calcula la lista con su
// propio motor de reglas (shared/utils/recomendaciones/*) y la pasa aquí; este
// componente solo muestra y avisa cuándo el usuario actúa.
//
// Dos presentaciones del encabezado, según el mockup de cada vista:
// - Sin `subtitulo`: kicker "Te recomienda:" subrayado (Marketing, Finanzas).
// - Con `subtitulo`: título + bajada ("Análisis del turno actual…") (Caja).
const props = withDefaults(defineProps<{
  items: Recomendacion[]
  titulo?: string
  subtitulo?: string
  // Títulos de cada tarjeta en mayúscula y coloreados por tono (estilo Marketing).
  titulosMayuscula?: boolean
  botonLabel?: string
  nota?: string
}>(), {
  titulo: 'Te recomienda:',
  subtitulo: '',
  titulosMayuscula: false,
  botonLabel: 'Hablar con Haru',
  nota: 'Estoy aquí para ayudarte a crecer.',
})

const emit = defineEmits<{
  // El usuario tocó una recomendación con accion.tipo === 'evento'. La vista decide
  // qué hacer con el valor (ej: preseleccionar un objetivo de publicación).
  (e: 'accion', reco: Recomendacion): void
  // El usuario tocó el botón principal del panel.
  (e: 'principal'): void
}>()

function activar(reco: Recomendacion) {
  if (!reco.accion) {
    return
  }
  if (reco.accion.tipo === 'ruta') {
    void navigateTo(reco.accion.valor)
    return
  }
  if (reco.accion.tipo === 'haru') {
    emit('principal')
    return
  }
  emit('accion', reco)
}

const hayItems = computed(() => props.items.length > 0)
</script>

<template>
  <aside class="reco" :class="{ 'is-mayuscula': titulosMayuscula }" aria-label="Recomendaciones de Haru">
    <header class="reco__head">
      <div class="reco__id">
        <strong>HARU</strong>
        <small>Tu asesor empresarial inteligente</small>
      </div>
      <img src="/haru.png" alt="" aria-hidden="true" class="reco__mascot">
    </header>

    <div v-if="subtitulo" class="reco__intro">
      <strong>{{ titulo }}</strong>
      <small>{{ subtitulo }}</small>
    </div>
    <span v-else class="reco__kicker">{{ titulo }}</span>

    <ul v-if="hayItems" class="reco__list">
      <li
        v-for="reco in items"
        :key="reco.id"
        class="reco-item"
        :class="[`is-${reco.tono}`, { 'is-clickable': reco.accion }]"
        :role="reco.accion ? 'button' : undefined"
        :tabindex="reco.accion ? 0 : undefined"
        @click="activar(reco)"
        @keydown.enter.prevent="activar(reco)"
        @keydown.space.prevent="activar(reco)"
      >
        <span class="reco-item__dot" aria-hidden="true">
          <i :class="reco.icono" />
        </span>
        <div class="reco-item__body">
          <strong>{{ reco.titulo }}</strong>
          <p>{{ reco.texto }}</p>
        </div>
      </li>
    </ul>

    <button type="button" class="reco__haru" @click="emit('principal')">
      <i class="pi pi-comments" aria-hidden="true" />
      {{ botonLabel }}
      <i class="pi pi-arrow-right reco__haru-arrow" aria-hidden="true" />
    </button>
    <p v-if="nota" class="reco__note">{{ nota }}</p>
  </aside>
</template>

<style scoped>
.reco {
  display: grid;
  align-content: start;
  gap: 13px;
  padding: 18px;
  border: 1px solid #dceadf;
  border-radius: 18px;
  background: #f1faf3;
}

.reco__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 64px;
}

.reco__id {
  display: grid;
  gap: 2px;
}

.reco__id strong {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.01em;
  color: #0b7a2a;
}

.reco__id small {
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.3;
  color: #5c6b60;
  max-width: 150px;
}

.reco__mascot {
  width: 96px;
  height: auto;
  flex: 0 0 auto;
  margin: -14px -4px -8px 0;
  filter: drop-shadow(0 8px 14px rgba(10, 111, 32, 0.18));
}

/* Encabezado tipo "Te recomienda:" subrayado (Marketing / Finanzas). */
.reco__kicker {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1rem;
  font-weight: 800;
  color: #0b6f38;
  border-bottom: 2.5px solid #f2c200;
  padding-bottom: 2px;
  width: max-content;
}

/* Encabezado con título + bajada (Caja: "Análisis del turno actual"). */
.reco__intro {
  display: grid;
  gap: 2px;
}

.reco__intro strong {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.02rem;
  font-weight: 900;
  color: #102016;
}

.reco__intro small {
  font-size: 0.78rem;
  font-weight: 600;
  color: #5c6b60;
}

.reco__list {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.reco-item {
  display: flex;
  gap: 11px;
  padding: 12px 13px;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);
  text-align: left;
}

.reco-item.is-clickable {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.reco-item.is-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.09);
}

.reco-item.is-clickable:focus-visible {
  outline: 2px solid #0b6f38;
  outline-offset: 2px;
}

.reco-item__dot {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 50%;
  font-size: 1.15rem;
}

/* El tono pinta el círculo: lectura rápida de la intención. */
.reco-item.is-positivo .reco-item__dot { background: #e3f6e9; color: #0a8f3a; }
.reco-item.is-oportunidad .reco-item__dot { background: #fdf0d3; color: #c08006; }
.reco-item.is-alerta .reco-item__dot { background: #fdeceb; color: #d23b30; }
.reco-item.is-info .reco-item__dot { background: #e4f0ff; color: #1665c7; }

.reco-item__body {
  display: grid;
  gap: 3px;
  min-width: 0;
}

/* Título normal por defecto (Finanzas / Caja): oscuro, en caja de oración. */
.reco-item__body strong {
  font-size: 0.86rem;
  font-weight: 850;
  color: #102016;
}

.reco-item__body p {
  margin: 0;
  font-size: 0.79rem;
  font-weight: 600;
  line-height: 1.42;
  color: #5c6b60;
}

/* Variante Marketing: título en mayúscula y coloreado por tono. */
.reco.is-mayuscula .reco-item__body strong {
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.reco.is-mayuscula .reco-item.is-positivo .reco-item__body strong { color: #0a7f33; }
.reco.is-mayuscula .reco-item.is-oportunidad .reco-item__body strong { color: #b3790c; }
.reco.is-mayuscula .reco-item.is-alerta .reco-item__body strong { color: #c5362c; }
.reco.is-mayuscula .reco-item.is-info .reco-item__body strong { color: #155fbb; }

.reco__haru {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 3px;
  padding: 13px 18px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(120deg, #0a6f1f, #0b6f38);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 12px 22px rgba(10, 111, 32, 0.24);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.reco__haru:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(10, 111, 32, 0.3);
}

.reco__haru-arrow {
  font-size: 0.78rem;
  transition: transform 0.15s ease;
}

.reco__haru:hover .reco__haru-arrow {
  transform: translateX(3px);
}

.reco__note {
  margin: 0;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 600;
  color: #6b7a6f;
}

/* En teléfonos angostos el jaguar se achica para no competir con el texto. */
@media (max-width: 380px) {
  .reco {
    padding: 15px;
  }

  .reco__mascot {
    width: 76px;
  }

  .reco__id strong {
    font-size: 1.32rem;
  }
}
</style>
