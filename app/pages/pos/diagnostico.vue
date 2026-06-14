<script setup lang="ts">
import {
  PREGUNTAS_DIAGNOSTICO,
  PASOS_DIAGNOSTICO,
  type DiagnosticoRespuestas,
} from '~~/shared/utils/diagnostico'

definePageMeta({
  layout: 'pos',
  posTitle: 'Diagnóstico',
})

useHead({ title: 'Diagnóstico de tu negocio | IMPULSA' })

type AreaScores = { ventas: number; finanzas: number; marketing: number; inventario: number | null }
type ResultadoView = {
  saludGeneral: number
  nivel: 'bajo' | 'medio' | 'alto'
  areas: AreaScores
  problemas: string[]
  recomendaciones: string[]
  mensajeNivel: string
  recomendacionPrincipal: string
}

const session = usePosSession()

const vista = ref<'intro' | 'wizard' | 'resultado'>('intro')
const cargando = ref(true)
const enviando = ref(false)
const error = ref('')

const respuestas = reactive<DiagnosticoRespuestas>({})
const indice = ref(0)
const direccion = ref<'next' | 'prev'>('next')
const resultado = ref<ResultadoView | null>(null)
// Progreso 0..1 que anima de golpe todas las donas (salud + áreas).
const anim = ref(0)

// Si q8 = "No aplica", la pregunta de inventario perdido (q9) se omite.
const preguntasActivas = computed(() =>
  PREGUNTAS_DIAGNOSTICO.filter(p => !(respuestas.q8 === 'no_aplica' && p.id === 'q9')),
)
const total = computed(() => preguntasActivas.value.length)
const preguntaActual = computed(() => preguntasActivas.value[Math.min(indice.value, total.value - 1)])
const pasoActual = computed(() => PASOS_DIAGNOSTICO.find(p => p.numero === preguntaActual.value?.paso))
const progreso = computed(() => Math.round(((indice.value + 1) / total.value) * 100))
const esUltima = computed(() => indice.value >= total.value - 1)
const respondioActual = computed(() => Boolean(respuestas[preguntaActual.value?.id ?? '']))

// Mensajes del jaguar que rotan según el avance.
const animoJaguar = computed(() => {
  if (indice.value === 0) {
    return 'No te preocupes si no tienes datos exactos, puedes responder con aproximados.'
  }
  if (esUltima.value) {
    return '¡Última pregunta! Ya casi tenemos tu diagnóstico.'
  }
  if (progreso.value >= 50) {
    return 'Vamos muy bien, ya estamos entendiendo tu negocio.'
  }
  return preguntaActual.value?.ayuda ?? 'No hay respuestas buenas o malas, esto es para ayudarte.'
})

onMounted(async () => {
  try {
    const data = await $fetch<{ estado: string; diagnostico: any }>('/api/diagnostico/latest')
    if (data.diagnostico) {
      resultado.value = normalizarDesdeRow(data.diagnostico)
      vista.value = 'resultado'
      animarResultado()
    }
  } catch {
    // Sin diagnóstico previo: arrancamos en la intro.
  } finally {
    cargando.value = false
  }
})

function iniciar() {
  vista.value = 'wizard'
}

function seleccionar(value: string) {
  const id = preguntaActual.value?.id
  if (!id) {
    return
  }
  respuestas[id] = value
  if (!esUltima.value) {
    setTimeout(avanzar, 260)
  }
}

function avanzar() {
  if (!respondioActual.value || enviando.value) {
    return
  }
  if (esUltima.value) {
    void enviar()
    return
  }
  direccion.value = 'next'
  indice.value = Math.min(indice.value + 1, total.value - 1)
}

function retroceder() {
  if (indice.value === 0) {
    vista.value = 'intro'
    return
  }
  direccion.value = 'prev'
  indice.value -= 1
}

async function enviar() {
  enviando.value = true
  error.value = ''
  try {
    const data = await $fetch<{ resultado: ResultadoView }>('/api/diagnostico', {
      method: 'POST',
      body: { respuestas: { ...respuestas } },
    })
    resultado.value = data.resultado
    if (session.value) {
      session.value = { ...session.value, onboardingDiagnostico: 'completado' }
    }
    vista.value = 'resultado'
    await nextTick()
    animarResultado()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'No pudimos guardar tu diagnóstico. Intenta de nuevo.'
  } finally {
    enviando.value = false
  }
}

const esDev = import.meta.dev
const reiniciando = ref(false)

async function rehacer() {
  reiniciando.value = true
  try {
    await $fetch('/api/diagnostico/reiniciar', { method: 'POST' })
    Object.keys(respuestas).forEach(k => delete respuestas[k])
    indice.value = 0
    resultado.value = null
    error.value = ''
    if (session.value) {
      session.value = { ...session.value, onboardingDiagnostico: 'pendiente' }
    }
    vista.value = 'intro'
  } catch {
    error.value = 'No pudimos reiniciar el diagnóstico.'
  } finally {
    reiniciando.value = false
  }
}

async function omitir() {
  try {
    await $fetch('/api/diagnostico/omitir', { method: 'POST' })
    if (session.value) {
      session.value = { ...session.value, onboardingDiagnostico: 'omitido' }
    }
  } catch {
    // Aunque falle, seguimos al inicio para no bloquear al usuario.
  }
  await navigateTo('/pos/inicio')
}

function animarResultado() {
  const inicio = performance.now()
  const duracion = 1100
  anim.value = 0
  function paso(ahora: number) {
    const t = Math.min((ahora - inicio) / duracion, 1)
    anim.value = 1 - Math.pow(1 - t, 3)
    if (t < 1) {
      requestAnimationFrame(paso)
    }
  }
  requestAnimationFrame(paso)
}

function normalizarDesdeRow(row: any): ResultadoView {
  const r = row.resultado ?? {}
  return {
    saludGeneral: row.saludGeneral ?? 0,
    nivel: (row.nivel ?? 'medio') as ResultadoView['nivel'],
    areas: {
      ventas: row.scoreVentas ?? 0,
      finanzas: row.scoreFinanzas ?? 0,
      marketing: row.scoreMarketing ?? 0,
      inventario: row.scoreInventario ?? null,
    },
    problemas: r.problemas ?? [],
    recomendaciones: r.recomendaciones ?? [],
    mensajeNivel: r.mensajeNivel ?? '',
    recomendacionPrincipal: r.recomendacionPrincipal ?? '',
  }
}

// --- Presentación del resultado ---
const NIVEL_META = {
  bajo: { label: 'Nivel inicial', color: '#e0794f', tag: 'Bajo' },
  medio: { label: 'Nivel medio', color: '#d99a2b', tag: 'Medio' },
  alto: { label: 'Buen nivel', color: '#0f9e2e', tag: 'Alto' },
} as const

// Paleta natural y calma (verde marca, teal, terracota suave, slate-azul).
const AREAS_META: { key: keyof AreaScores; label: string; icon: string; color: string }[] = [
  { key: 'ventas', label: 'Ventas', icon: 'pi pi-shopping-cart', color: '#0f9e2e' },
  { key: 'finanzas', label: 'Finanzas', icon: 'pi pi-wallet', color: '#1f9e8a' },
  { key: 'marketing', label: 'Marketing', icon: 'pi pi-megaphone', color: '#c97f3a' },
  { key: 'inventario', label: 'Inventario', icon: 'pi pi-box', color: '#5b7a9e' },
]

const nivelMeta = computed(() => NIVEL_META[resultado.value?.nivel ?? 'medio'])

// Helpers de dona reutilizables (animan con `anim`, 0..1).
function circ(r: number) {
  return 2 * Math.PI * r
}
function dashOffset(score: number, r: number) {
  return circ(r) * (1 - (score / 100) * anim.value)
}
function pct(score: number) {
  return Math.round(score * anim.value)
}
function nivelDeScore(score: number): 'bajo' | 'medio' | 'alto' {
  return score < 40 ? 'bajo' : score < 70 ? 'medio' : 'alto'
}
// Color semántico de la dona por nivel del puntaje (rojo/ámbar/verde).
function colorScore(score: number) {
  return NIVEL_META[nivelDeScore(score)].color
}
function etiquetaNivel(score: number) {
  return NIVEL_META[nivelDeScore(score)].label
}

// Helpers por área (evitan el operador `!` en el template).
function areaAplica(key: keyof AreaScores) {
  return (resultado.value?.areas[key] ?? null) !== null
}
function areaScore(key: keyof AreaScores) {
  return resultado.value?.areas[key] ?? 0
}
</script>

<template>
  <div class="diag">
    <!-- ====================== Cargando ====================== -->
    <div v-if="cargando" class="diag-loading">
      <span class="diag-spinner" aria-hidden="true" />
      <p>Preparando tu diagnóstico…</p>
    </div>

    <!-- ====================== Intro ====================== -->
    <Transition name="diag-fade" mode="out-in">
      <section v-if="!cargando && vista === 'intro'" key="intro" class="diag-card diag-intro ">
        <div class="diag-intro__art">
          <img src="/haru-diagnostico.jpg" alt="Haru con el formulario de diagnóstico" class="diag-intro__jaguar">
        </div>
        <div class="diag-intro__copy">
          <span class="diag-kicker"><i class="pi pi-sparkles" /> Diagnóstico rápido</span>
          <h1>Diagnóstico rápido de tu negocio</h1>
          <p>
            Responde unas preguntas sencillas para que NEXA conozca el estado actual de tu
            negocio y te dé recomendaciones personalizadas.
          </p>
          <ul class="diag-facts">
            <li><i class="pi pi-clock" /> 2 a 3 minutos</li>
            <li><i class="pi pi-list-check" /> 10 preguntas · 5 pasos</li>
            <li><i class="pi pi-heart" /> Sin respuestas buenas o malas</li>
          </ul>
          <div class="diag-intro__actions">
            <button type="button" class="diag-btn diag-btn--primary" @click="iniciar">
              <i class="pi pi-play-circle" /> Iniciar diagnóstico
            </button>
            <button type="button" class="diag-btn diag-btn--ghost" @click="omitir">
              Saltar por ahora
            </button>
          </div>
        </div>
      </section>

      <!-- ====================== Wizard ====================== -->
      <section v-else-if="!cargando && vista === 'wizard'" key="wizard" class="diag-card diag-wizard">
        <header class="diag-wizard__head">
          <div class="diag-steps">
            <span
              v-for="paso in PASOS_DIAGNOSTICO"
              :key="paso.numero"
              class="diag-step"
              :class="{
                'is-done': paso.numero < (pasoActual?.numero ?? 1),
                'is-active': paso.numero === pasoActual?.numero,
              }"
            >
              <i :class="paso.numero < (pasoActual?.numero ?? 1) ? 'pi pi-check' : paso.icono" />
            </span>
          </div>
          <button type="button" class="diag-skip" @click="omitir">Saltar <i class="pi pi-times" /></button>
        </header>

        <div class="diag-progress">
          <div class="diag-progress__bar"><span :style="{ width: `${progreso}%` }" /></div>
          <div class="diag-progress__meta">
            <strong>Paso {{ pasoActual?.numero }}: {{ pasoActual?.titulo }}</strong>
            <span>Pregunta {{ indice + 1 }} de {{ total }}</span>
          </div>
        </div>

        <div class="diag-question-wrap">
          <Transition :name="direccion === 'next' ? 'diag-slide-next' : 'diag-slide-prev'" mode="out-in">
            <div :key="preguntaActual?.id" class="diag-question">
              <h2>{{ preguntaActual?.titulo }}</h2>
              <div class="diag-options">
                <button
                  v-for="(op, i) in preguntaActual?.opciones"
                  :key="op.value"
                  type="button"
                  class="diag-option"
                  :class="{ 'is-selected': respuestas[preguntaActual!.id] === op.value }"
                  :style="{ '--i': i }"
                  @click="seleccionar(op.value)"
                >
                  <span class="diag-option__check"><i class="pi pi-check" /></span>
                  <span class="diag-option__label">{{ op.label }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <p v-if="error" class="diag-error"><i class="pi pi-exclamation-triangle" /> {{ error }}</p>

        <footer class="diag-wizard__foot">
          <button type="button" class="diag-btn diag-btn--ghost" @click="retroceder">
            <i class="pi pi-arrow-left" /> Atrás
          </button>
          <div class="diag-jaguar-tip">
            <MascotJaguar variant="head" class="diag-jaguar-tip__avatar" />
            <Transition name="diag-fade" mode="out-in">
              <p :key="animoJaguar">{{ animoJaguar }}</p>
            </Transition>
          </div>
          <button
            type="button"
            class="diag-btn diag-btn--primary"
            :disabled="!respondioActual || enviando"
            @click="avanzar"
          >
            <template v-if="esUltima">
              <i v-if="!enviando" class="pi pi-sparkles" />
              <span v-if="enviando" class="diag-spinner diag-spinner--sm" />
              {{ enviando ? 'Calculando…' : 'Ver mi diagnóstico' }}
            </template>
            <template v-else>
              Siguiente <i class="pi pi-arrow-right" />
            </template>
          </button>
        </footer>
      </section>

      <!-- ====================== Resultado ====================== -->
      <section v-else-if="!cargando && vista === 'resultado' && resultado" key="resultado" class="diag-result">
        <header class="diag-result__title">
          <h1>Tu diagnóstico está listo</h1>
          <p>{{ resultado.mensajeNivel }}</p>
        </header>

        <div class="diag-result__top">
          <!-- Panel izquierdo: estado general -->
          <div class="diag-card diag-overall">
            <span class="diag-overall__kicker">Estado general del negocio</span>
            <div class="diag-overall__main">
              <div class="diag-overall__level">
                <strong :style="{ color: nivelMeta.color }">{{ nivelMeta.tag }}</strong>
                <small>{{ nivelMeta.label }}</small>
              </div>
              <div class="diag-gauge">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="diag-gauge__track" cx="60" cy="60" r="52" />
                  <circle
                    class="diag-gauge__fill"
                    cx="60" cy="60" r="52"
                    :stroke="nivelMeta.color"
                    :stroke-dasharray="circ(52)"
                    :stroke-dashoffset="dashOffset(resultado.saludGeneral, 52)"
                  />
                </svg>
                <div class="diag-gauge__center">
                  <strong :style="{ color: nivelMeta.color }">{{ pct(resultado.saludGeneral) }}%</strong>
                  <small>Salud del negocio</small>
                </div>
              </div>
            </div>
            <div class="diag-overall__tip">
              <i class="pi pi-star-fill" />
              <p>{{ resultado.recomendacionPrincipal }}</p>
            </div>
          </div>

          <!-- Panel derecho: resumen por áreas -->
          <div class="diag-card diag-areas">
            <h3>Resumen por áreas</h3>
            <div class="diag-areas__grid">
              <article
                v-for="(area, i) in AREAS_META"
                :key="area.key"
                class="diag-area"
                :style="{ '--i': i }"
              >
                <span class="diag-area__icon" :style="{ background: `${area.color}1a`, color: area.color }">
                  <i :class="area.icon" />
                </span>
                <strong>{{ area.label }}</strong>

                <template v-if="areaAplica(area.key)">
                  <div class="diag-mini-gauge">
                    <svg viewBox="0 0 80 80" aria-hidden="true">
                      <circle class="diag-mini-gauge__track" cx="40" cy="40" r="32" />
                      <circle
                        class="diag-mini-gauge__fill"
                        cx="40" cy="40" r="32"
                        :stroke="colorScore(areaScore(area.key))"
                        :stroke-dasharray="circ(32)"
                        :stroke-dashoffset="dashOffset(areaScore(area.key), 32)"
                      />
                    </svg>
                    <span :style="{ color: colorScore(areaScore(area.key)) }">
                      {{ pct(areaScore(area.key)) }}%
                    </span>
                  </div>
                  <small :style="{ color: colorScore(areaScore(area.key)) }">
                    {{ etiquetaNivel(areaScore(area.key)) }}
                  </small>
                </template>
                <template v-else>
                  <div class="diag-mini-gauge diag-mini-gauge--na">
                    <svg viewBox="0 0 80 80" aria-hidden="true">
                      <circle class="diag-mini-gauge__track" cx="40" cy="40" r="32" />
                    </svg>
                    <span>—</span>
                  </div>
                  <small class="is-na">No aplica</small>
                </template>
              </article>
            </div>
          </div>
        </div>

        <div class="diag-result__cols">
          <div v-if="resultado.problemas.length" class="diag-card diag-list diag-list--warn">
            <h3><i class="pi pi-exclamation-circle" /> Problemas detectados</h3>
            <ul>
              <li v-for="(p, i) in resultado.problemas" :key="i" :style="{ '--i': i }">
                <i class="pi pi-angle-right" /> {{ p }}
              </li>
            </ul>
          </div>

          <div class="diag-card diag-list diag-list--ok">
            <h3><i class="pi pi-check-circle" /> Recomendaciones de NEXA</h3>
            <ol>
              <li v-for="(r, i) in resultado.recomendaciones" :key="i" :style="{ '--i': i }">
                <span class="diag-num">{{ i + 1 }}</span> {{ r }}
              </li>
            </ol>
          </div>
        </div>

        <div class="diag-result__cta">
          <MascotJaguar variant="head" class="diag-result__cta-avatar" />
          <p>¡Listo! Usa estas recomendaciones para impulsar tu negocio paso a paso.</p>
          <div class="diag-result__cta-actions">
            <button
              v-if="esDev"
              type="button"
              class="diag-btn diag-btn--ghost"
              :disabled="reiniciando"
              @click="rehacer"
            >
              <span v-if="reiniciando" class="diag-spinner diag-spinner--sm" />
              <i v-else class="pi pi-refresh" /> Rehacer (dev)
            </button>
            <NuxtLink to="/pos/inicio" class="diag-btn diag-btn--primary">
              Ir a mi inicio <i class="pi pi-arrow-right" />
            </NuxtLink>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.diag {
  --diag-ink: #102016;
  --diag-line: #e7eee8;
  display: grid;
  gap: 16px;
  color: var(--diag-ink);
  padding-bottom: 8px;
}

.diag-card {
  border: 1px solid var(--diag-line);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

/* ---------- Loading ---------- */
.diag-loading {
  display: grid;
  place-items: center;
  gap: 14px;
  min-height: 320px;
  color: #6b7a6f;
  font-weight: 700;
}

.diag-spinner {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 4px solid #d9ead9;
  border-top-color: #0f9e2e;
  animation: diag-spin 0.8s linear infinite;
}

.diag-spinner--sm {
  width: 18px;
  height: 18px;
  border-width: 3px;
  border-color: rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
}

@keyframes diag-spin {
  to { transform: rotate(360deg); }
}

/* ---------- Intro ---------- */
.diag-intro {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  overflow: hidden;
}

.diag-intro__art {
  position: relative;
  min-height: 320px;
  background: #0a1f12;
  overflow: hidden;
}

.diag-intro__jaguar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  animation: diag-fade-img 0.8s ease both;
}

@keyframes diag-fade-img {
  from { opacity: 0; transform: scale(1.04); }
  to { opacity: 1; transform: scale(1); }
}

.diag-intro__copy {
  padding: clamp(22px, 3vw, 40px);
  display: grid;
  align-content: center;
  gap: 12px;
}

.diag-kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: max-content;
  padding: 6px 12px;
  border-radius: 999px;
  background: #edf7e8;
  color: #2d7c2f;
  font-size: 0.74rem;
  font-weight: 900;
}

.diag-intro__copy h1 {
  margin: 0;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: clamp(1.5rem, 2.6vw, 2.05rem);
  font-weight: 900;
  line-height: 1.12;
  letter-spacing: -0.02em;
}

.diag-intro__copy p {
  margin: 0;
  max-width: 46ch;
  color: #5d6b61;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.55;
}

.diag-facts {
  display: grid;
  gap: 8px;
  margin: 6px 0 4px;
  padding: 0;
  list-style: none;
}

.diag-facts li {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.86rem;
  font-weight: 800;
  color: #294232;
}

.diag-facts i {
  color: #0f9e2e;
}

.diag-intro__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

/* ---------- Botones ---------- */
.diag-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 12px 22px;
  border: 0;
  border-radius: 12px;
  font-size: 0.92rem;
  font-weight: 900;
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.diag-btn--primary {
  color: #fff;
  background: linear-gradient(150deg, #14b536, #0a6f1f);
  box-shadow: 0 14px 26px rgba(14, 111, 32, 0.26);
}

.diag-btn--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px rgba(14, 111, 32, 0.32);
}

.diag-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.diag-btn--ghost {
  color: #4a5a4f;
  background: #f1f5f1;
}

.diag-btn--ghost:hover {
  background: #e6ede6;
}

/* ---------- Wizard ---------- */
.diag-wizard {
  padding: clamp(18px, 2.4vw, 28px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  /* El card llena el alto visible de la pantalla (igual que .pos-content-shell:
     100dvh - topbar/paddings). Es un MÍNIMO: si el contenido es más alto,
     el card crece y la página hace scroll. Así el footer queda fijo abajo
     sin saltos y sin números mágicos. */
  min-height: calc(100dvh - 130px);
}

.diag-wizard__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.diag-steps {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diag-step {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #f1f5f1;
  color: #9bab9f;
  font-size: 0.95rem;
  transition: all 0.3s ease;
}

.diag-step.is-active {
  background: #0f9e2e;
  color: #fff;
  transform: scale(1.08);
  box-shadow: 0 8px 18px rgba(15, 158, 46, 0.3);
}

.diag-step.is-done {
  background: #d5f1d9;
  color: #0a6f1f;
}

.diag-skip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: #93a096;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.diag-skip:hover {
  color: #5d6b61;
}

.diag-progress {
  display: grid;
  gap: 8px;
}

.diag-progress__bar {
  height: 9px;
  border-radius: 999px;
  background: #edf2ee;
  overflow: hidden;
}

.diag-progress__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f7d32, #74c043);
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.diag-progress__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.78rem;
}

.diag-progress__meta strong {
  font-weight: 900;
  color: #294232;
}

.diag-progress__meta span {
  color: #8a978d;
  font-weight: 800;
}

/* Contenedor estable: toma el alto sobrante (footer siempre abajo) y
   recorta/contiene la animación de cambio de pregunta. */
.diag-question-wrap {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.diag-question {
  display: grid;
  gap: 16px;
  align-content: start;
}

.diag-question h2 {
  margin: 0;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: clamp(1.15rem, 2vw, 1.5rem);
  font-weight: 900;
  line-height: 1.2;
}

.diag-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 11px;
}

.diag-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 2px solid var(--diag-line);
  border-radius: 14px;
  background: #fbfdfb;
  color: #243228;
  font-size: 0.92rem;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  animation: diag-pop 0.4s ease both;
  animation-delay: calc(var(--i) * 50ms);
}

.diag-option:hover {
  border-color: #9fd9a6;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
}

.diag-option.is-selected {
  border-color: #0f9e2e;
  background: #edf7e8;
  box-shadow: 0 10px 22px rgba(15, 158, 46, 0.18);
}

.diag-option__check {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 2px solid #cdd9cf;
  color: transparent;
  font-size: 0.7rem;
  transition: all 0.2s ease;
}

.diag-option.is-selected .diag-option__check {
  border-color: #0f9e2e;
  background: #0f9e2e;
  color: #fff;
  transform: scale(1.05);
}

.diag-wizard__foot {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
}

.diag-jaguar-tip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 14px;
  background: #f4faf2;
  border: 1px solid #e0efe0;
}

.diag-jaguar-tip__avatar {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #d5f1d9;
}

.diag-jaguar-tip p {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: #3c5343;
  line-height: 1.35;
}

.diag-error {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: #fff1f2;
  color: #9f1239;
  font-size: 0.85rem;
  font-weight: 700;
}

/* ---------- Resultado ---------- */
.diag-result {
  display: grid;
  gap: 16px;
}

.diag-result__title {
  display: grid;
  gap: 5px;
  animation: diag-rise 0.5s ease both;
}

.diag-result__title h1 {
  margin: 0;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: clamp(1.4rem, 2.4vw, 1.9rem);
  font-weight: 900;
  letter-spacing: -0.02em;
}

.diag-result__title p {
  margin: 0;
  color: #5d6b61;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.5;
}

/* Dos paneles: estado general (izq) + resumen por áreas (der) */
.diag-result__top {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 16px;
  align-items: stretch;
}

.diag-areas h3,
.diag-list h3 {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 16px;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 0.95rem;
  font-weight: 900;
}

/* ----- Panel estado general ----- */
.diag-overall {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: clamp(18px, 2.4vw, 26px);
  animation: diag-rise 0.5s ease both;
}

.diag-overall__kicker {
  font-size: 0.8rem;
  font-weight: 900;
  color: #5d6b61;
}

.diag-overall__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.diag-overall__level {
  display: grid;
  gap: 2px;
}

.diag-overall__level strong {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: clamp(1.9rem, 4vw, 2.7rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}

.diag-overall__level small {
  font-size: 0.78rem;
  font-weight: 800;
  color: #8a978d;
}

.diag-overall__tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f4faf2;
  border: 1px solid #e2efe0;
}

.diag-overall__tip i {
  color: #e6b800;
  margin-top: 2px;
}

.diag-overall__tip p {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 700;
  color: #2f4a37;
  line-height: 1.45;
}

/* Dona grande (salud) */
.diag-gauge {
  position: relative;
  width: 132px;
  height: 132px;
  flex: 0 0 auto;
}

.diag-gauge svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.diag-gauge__track {
  fill: none;
  stroke: #eef3ee;
  stroke-width: 10;
}

.diag-gauge__fill {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}

.diag-gauge__center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
}

.diag-gauge__center strong {
  font-size: 1.9rem;
  font-weight: 900;
  line-height: 1;
}

.diag-gauge__center small {
  display: block;
  margin-top: 3px;
  color: #8a978d;
  font-size: 0.66rem;
  font-weight: 800;
}

/* ----- Panel resumen por áreas ----- */
.diag-areas {
  padding: clamp(18px, 2.4vw, 26px);
}

.diag-areas__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.diag-area {
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 14px 8px;
  border: 1px solid var(--diag-line);
  border-radius: 14px;
  background: #fbfdfb;
  text-align: center;
  animation: diag-rise 0.5s ease both;
  animation-delay: calc(var(--i) * 90ms);
}

.diag-area__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 0.92rem;
}

.diag-area > strong {
  font-size: 0.78rem;
  font-weight: 800;
  color: #243228;
  line-height: 1.2;
  min-height: 2.1em;
  display: flex;
  align-items: center;
}

.diag-area > small {
  font-size: 0.72rem;
  font-weight: 800;
}

.diag-area > small.is-na {
  color: #9bab9f;
}

/* Mini dona por área */
.diag-mini-gauge {
  position: relative;
  width: 72px;
  height: 72px;
}

.diag-mini-gauge svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.diag-mini-gauge__track {
  fill: none;
  stroke: #eef3ee;
  stroke-width: 8;
}

.diag-mini-gauge__fill {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
}

.diag-mini-gauge span {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  font-size: 0.92rem;
  font-weight: 900;
}

.diag-mini-gauge--na span {
  color: #b8c4ba;
}

.diag-result__cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.diag-list {
  padding: clamp(18px, 2.4vw, 26px);
}

.diag-list ul,
.diag-list ol {
  display: grid;
  gap: 11px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.diag-list li {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.4;
  animation: diag-slide-in 0.45s ease both;
  animation-delay: calc(var(--i) * 80ms);
}

.diag-list--warn h3 { color: #b4541f; }
.diag-list--warn li i { color: #e0852f; margin-top: 2px; }
.diag-list--ok h3 { color: #0a6f1f; }

.diag-num {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #0f9e2e;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 900;
}

.diag-result__cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  border-radius: 18px;
  background: linear-gradient(120deg, #edf7e8, #f4faf2);
  border: 1px solid #dcecdc;
}

.diag-result__cta-avatar {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #d5f1d9;
  box-shadow: 0 6px 14px rgba(15, 158, 46, 0.16);
}

.diag-result__cta p {
  margin: 0;
  flex: 1 1 200px;
  font-size: 0.92rem;
  font-weight: 800;
  color: #294232;
}

.diag-result__cta-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 10px;
}

.diag-result__cta-actions .diag-btn--ghost {
  background: #fff;
  border: 1px solid #d6e6d6;
}

/* ---------- Animaciones de entrada ---------- */
@keyframes diag-rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes diag-pop {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes diag-slide-in {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Transiciones entre vistas/preguntas */
.diag-fade-enter-active,
.diag-fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.diag-fade-enter-from { opacity: 0; transform: translateY(8px); }
.diag-fade-leave-to { opacity: 0; transform: translateY(-8px); }

.diag-slide-next-enter-active,
.diag-slide-prev-enter-active { transition: opacity 0.32s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1); }
.diag-slide-next-leave-active,
.diag-slide-prev-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; position: absolute; inset: 0; }
.diag-slide-next-enter-from { opacity: 0; transform: translateX(40px); }
.diag-slide-next-leave-to { opacity: 0; transform: translateX(-40px); }
.diag-slide-prev-enter-from { opacity: 0; transform: translateX(-40px); }
.diag-slide-prev-leave-to { opacity: 0; transform: translateX(40px); }

@media (prefers-reduced-motion: reduce) {
  .diag-option,
  .diag-area,
  .diag-list li,
  .diag-intro__jaguar,
  .diag-overall,
  .diag-result__title { animation: none !important; }
}

/* ---------- Responsive ---------- */
@media (max-width: 920px) {
  .diag-intro { grid-template-columns: 1fr; }
  .diag-intro__art { min-height: 200px; }
  .diag-result__top { grid-template-columns: 1fr; }
  .diag-result__cols { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .diag-wizard__foot { grid-template-columns: 1fr 1fr; }
  .diag-jaguar-tip { grid-column: 1 / -1; order: -1; }
  .diag-areas__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
