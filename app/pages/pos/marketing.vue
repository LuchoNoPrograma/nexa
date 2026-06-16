<script setup lang="ts">
import {
  REDES_SOCIALES,
  enlaceRed,
  textoCompleto,
  type MarketingPublicacion,
  type RedSocial,
} from '~~/shared/utils/marketing'

definePageMeta({
  layout: 'pos',
  posTitle: 'Marketing',
})

useHead({
  title: 'Marketing | NEXA',
})

type MarketingResponse = {
  actual: MarketingPublicacion | null
  publicadas: number
  totalProductos: number
}

// Carga inicial: solo lee lo guardado, NO llama a la IA.
const { data } = await useFetch<MarketingResponse>('/api/pos/marketing', {
  default: () => ({ actual: null, publicadas: 0, totalProductos: 0 }),
})

const post = computed(() => data.value?.actual ?? null)
const sinProductos = computed(() => (data.value?.totalProductos ?? 0) === 0)

// El texto es editable antes de publicar (Haru deja el borrador, el usuario ajusta).
// Incluye los hashtags al final: el usuario edita todo en un solo lugar.
const textoEditable = ref('')

// Marca si ya se compartió esta publicación, para mostrar el llamado a crear otra.
// Se reinicia cada vez que llega una nueva idea.
const publicado = ref(false)

watch(post, (value) => {
  textoEditable.value = value ? textoCompleto(value) : ''
  publicado.value = false
}, { immediate: true })

// --- Objetivo antes de generar ---
type Modo = 'clientes' | 'sobrante' | 'combo' | 'producto'
type Objetivo = { id: Modo; titulo: string; desc: string; icon: string }

const OBJETIVOS: Objetivo[] = [
  { id: 'clientes', titulo: 'Atraer clientes', desc: 'Muestra un producto para que lleguen más compradores.', icon: 'pi pi-users' },
  { id: 'sobrante', titulo: 'Vender lo que me sobra', desc: 'Una oferta de lo que tienes de más en stock.', icon: 'pi pi-box' },
  { id: 'combo', titulo: 'Armar un combo', desc: 'Elige los productos y arma una promoción.', icon: 'pi pi-th-large' },
  { id: 'producto', titulo: 'Promocionar un producto', desc: 'Tú eliges cuál quieres publicar.', icon: 'pi pi-tag' },
]

// Guía de video: estructura probada para reels/TikTok (gancho → muestra → convence → invita).
// Es la misma para cualquier publicación, por eso vive en el front y no la genera la IA.
const VIDEO_PASOS = [
  { n: 1, titulo: 'Engancha', desc: 'En los primeros 3 segundos di algo llamativo o una pregunta, para que no sigan de largo.' },
  { n: 2, titulo: 'Muestra', desc: 'Enseña el producto de cerca, que se vea bien y dé ganas de comprarlo.' },
  { n: 3, titulo: 'Convence', desc: 'Di el precio o el beneficio: “solo Bs X”, “alcanza para toda la familia”.' },
  { n: 4, titulo: 'Invita', desc: 'Cierra pidiendo la acción: “escríbenos”, “pásate hoy”, “pídelo ya”.' },
]

const VIDEO_TIPS = [
  { icon: 'pi pi-mobile', texto: 'Graba con el celular parado (vertical)' },
  { icon: 'pi pi-clock', texto: 'Que dure entre 15 y 30 segundos' },
  { icon: 'pi pi-sun', texto: 'Busca buena luz, de preferencia natural' },
  { icon: 'pi pi-volume-up', texto: 'Acompáñalo con una canción de moda' },
]

type ProductoOpcion = { id: string; name: string; category: string | null; kind: string }

// Muestra el selector de objetivo (al entrar sin publicación o al pedir "otra idea").
const mostrarSelector = ref(false)

// Objetivo elegido (la tarjeta seleccionada).
const objetivoSel = ref<Objetivo | null>(null)
const modoActual = computed<Modo | null>(() => objetivoSel.value?.id ?? null)

// Indicación libre del usuario (se manda a Haru tal cual).
const nota = ref('')

// Productos para combo / producto específico.
const productos = ref<ProductoOpcion[]>([])
const cargandoProductos = ref(false)
const productoElegido = ref<string>('')
const comboIds = ref<string[]>([])

async function cargarProductos() {
  if (productos.value.length || cargandoProductos.value) {
    return
  }
  cargandoProductos.value = true
  try {
    const result = await $fetch<{ products: ProductoOpcion[] }>('/api/pos/products')
    productos.value = (result.products ?? []).filter((p) => p.kind === 'producto')
  } catch {
    productos.value = []
  } finally {
    cargandoProductos.value = false
  }
}

// Carga los productos en cuanto el objetivo los necesita.
watch(modoActual, (modo) => {
  if (modo === 'combo' || modo === 'producto') {
    void cargarProductos()
  }
})

const puedeCrear = computed(() => {
  if (!modoActual.value) {
    return false
  }
  if (modoActual.value === 'combo') {
    return comboIds.value.length >= 2
  }
  if (modoActual.value === 'producto') {
    return Boolean(productoElegido.value)
  }
  return true
})

function abrirSelector() {
  objetivoSel.value = null
  productoElegido.value = ''
  comboIds.value = []
  nota.value = ''
  mostrarSelector.value = true
}

function cerrarSelector() {
  mostrarSelector.value = false
}

function crear() {
  const modo = modoActual.value
  if (!modo) {
    flash('Elige qué quieres lograr.')
    return
  }
  if (modo === 'combo' && comboIds.value.length < 2) {
    flash('Elige al menos 2 productos para el combo.')
    return
  }
  if (modo === 'producto' && !productoElegido.value) {
    flash('Elige un producto.')
    return
  }
  void generar(modo)
}

const generando = ref(false)
const flashMsg = ref('')
let flashTimer: ReturnType<typeof setTimeout> | undefined

function flash(message: string) {
  flashMsg.value = message
  if (flashTimer) {
    clearTimeout(flashTimer)
  }
  flashTimer = setTimeout(() => {
    flashMsg.value = ''
  }, 2400)
}

onBeforeUnmount(() => {
  if (flashTimer) {
    clearTimeout(flashTimer)
  }
})

// Los hashtags ya viven dentro del textarea, así que el texto a copiar/publicar es tal cual.
const textoParaCopiar = computed(() => textoEditable.value)

// Identidad de la tienda para la cabecera del preview (usuario y avatar).
const session = usePosSession()
const storeName = computed(() => session.value?.store ?? 'Tu negocio')
const storeInitial = computed(() => storeName.value.trim().charAt(0).toUpperCase() || 'N')
const storeUser = computed(() => storeName.value.toLowerCase().replace(/\s+/g, '').slice(0, 20) || 'tunegocio')

// Red activa: define qué mockup de preview se muestra (y a dónde se publica).
const redActivaId = ref<RedSocial['id']>('instagram')
const redActiva = computed(() => REDES_SOCIALES.find((r) => r.id === redActivaId.value) ?? REDES_SOCIALES[0]!)

// Texto sin hashtags para mostrar la cabecera del caption por separado cuando hace falta.
const textoVista = computed(() => textoEditable.value.trim())

async function copiar(texto: string, mensaje: string) {
  try {
    await navigator.clipboard.writeText(texto)
    flash(mensaje)
  } catch {
    flash('No se pudo copiar, intenta de nuevo.')
  }
}

async function generar(modo: Modo) {
  if (generando.value) {
    return
  }
  generando.value = true
  try {
    const result = await $fetch<{ actual: MarketingPublicacion }>('/api/pos/marketing/generar', {
      method: 'POST',
      body: {
        modo,
        productoId: modo === 'producto' ? productoElegido.value : null,
        productoIds: modo === 'combo' ? comboIds.value : null,
        nota: nota.value.trim() || null,
      },
    })
    data.value = {
      actual: result.actual,
      publicadas: data.value?.publicadas ?? 0,
      totalProductos: data.value?.totalProductos ?? 0,
    }
    cerrarSelector()
    flash('Haru preparó una nueva publicación ✨')
  } catch (error: unknown) {
    const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
    flash(message ?? 'No se pudo generar la publicación.')
  } finally {
    generando.value = false
  }
}

// Publicar en una red: copia el texto listo, abre la red y marca como publicada.
// No recargamos ni borramos la idea: queda en pantalla y el usuario decide si crea otra.
async function publicarEn(red: RedSocial) {
  if (!post.value) {
    return
  }
  await copiar(textoParaCopiar.value, `Texto copiado. Pégalo en ${red.nombre} 👍`)
  window.open(enlaceRed(red.id, textoParaCopiar.value), '_blank', 'noopener')
  await $fetch(`/api/pos/marketing/${post.value.id}/estado`, {
    method: 'PUT',
    body: { estado: 'publicada' },
  }).catch(() => null)
  publicado.value = true
}
</script>

<template>
  <div class="mkt">
    <!-- Encabezado: Haru y la acción del día -->
    <header class="mkt-head">
      <div class="mkt-head__copy">
        <span class="mkt-head__kicker"><i class="pi pi-sparkles" aria-hidden="true" />Haru, tu asistente</span>
        <h1>Tu publicación de hoy</h1>
        <p>Lista para copiar y compartir. Solo revisa, ajusta si quieres y publica.</p>
      </div>
      <button v-if="post && !mostrarSelector" type="button" class="btn-ghost" @click="abrirSelector">
        <i class="pi pi-refresh" aria-hidden="true" />
        Otra idea
      </button>
    </header>

    <!-- Estado vacío: sin productos -->
    <section v-if="sinProductos" class="empty">
      <span class="empty__icon"><i class="pi pi-box" aria-hidden="true" /></span>
      <h2>Primero agrega un producto</h2>
      <p>Haru crea las publicaciones a partir de tus productos. Agrega al menos uno en tu inventario.</p>
      <NuxtLink to="/pos/catalogo" class="btn-primary">
        <i class="pi pi-plus" aria-hidden="true" />Ir a inventario
      </NuxtLink>
    </section>

    <!-- Selector de objetivo: qué quiere lograr el usuario antes de generar -->
    <section v-else-if="!post || mostrarSelector" class="selector">
      <div class="selector__head">
        <div>
          <h2>¿Qué quieres lograr hoy?</h2>
          <p>Haru arma la publicación con los productos de tu negocio.</p>
        </div>
        <button v-if="post" type="button" class="btn-ghost" :disabled="generando" @click="cerrarSelector">
          <i class="pi pi-arrow-left" aria-hidden="true" />Volver
        </button>
      </div>

      <div class="form">
        <!-- Objetivo: cuadritos seleccionables -->
        <div class="obj-grid">
          <button
            v-for="obj in OBJETIVOS"
            :key="obj.id"
            type="button"
            class="obj"
            :class="{ 'is-active': modoActual === obj.id }"
            :disabled="generando"
            @click="objetivoSel = obj"
          >
            <span class="obj__icon"><i :class="obj.icon" aria-hidden="true" /></span>
            <strong>{{ obj.titulo }}</strong>
            <small>{{ obj.desc }}</small>
          </button>
        </div>

        <div class="form__rest">
          <!-- Combo: elegir varios productos -->
          <div v-if="modoActual === 'combo'" class="field">
            <span class="field__label">Elige los productos del combo <small>(2 o más)</small></span>
            <MultiSelect
              v-model="comboIds"
              :options="productos"
              option-label="name"
              option-value="id"
              :loading="cargandoProductos"
              filter
              display="chip"
              fluid
              placeholder="Selecciona los productos"
            />
          </div>

          <!-- Producto: elegir uno -->
          <div v-else-if="modoActual === 'producto'" class="field">
            <span class="field__label">Elige el producto</span>
            <Select
              v-model="productoElegido"
              :options="productos"
              option-label="name"
              option-value="id"
              :loading="cargandoProductos"
              filter
              fluid
              placeholder="Selecciona un producto"
            />
          </div>

          <!-- Indicación extra del usuario -->
          <div class="field">
            <span class="field__label">¿Algo más que Haru deba saber? <small>(opcional)</small></span>
            <Textarea
              v-model="nota"
              rows="2"
              auto-resize
              fluid
              placeholder="Ej: es para el fin de semana, resáltalo como casero, apunta a estudiantes…"
            />
          </div>

          <button type="button" class="btn-primary" :disabled="generando || !puedeCrear" @click="crear">
            <i :class="generando ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'" aria-hidden="true" />
            {{ generando ? 'Haru está creando…' : 'Crear publicación' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Publicación lista -->
    <template v-else>
      <!-- Datos rápidos de la recomendación -->
      <div class="hints">
        <div class="hint">
          <i class="pi pi-clock" aria-hidden="true" />
          <span><small>Mejor hora</small><strong>{{ post.mejorHora || '19:00' }}</strong></span>
        </div>
        <div v-if="post.audiencia" class="hint">
          <i class="pi pi-users" aria-hidden="true" />
          <span><small>A quién le gusta</small><strong>{{ post.audiencia }}</strong></span>
        </div>
        <div class="hint">
          <i class="pi pi-star-fill" aria-hidden="true" />
          <span>
            <small>Qué tan bueno se ve</small>
            <strong class="stars">
              <i v-for="n in 5" :key="n" class="pi" :class="n <= post.impacto ? 'pi-star-fill' : 'pi-star'" aria-hidden="true" />
            </strong>
          </span>
        </div>
      </div>

      <div class="layout">
        <!-- Tarjeta 1: la publicación con preview por red -->
        <section class="card sheet">
          <header class="sheet__head">
            <h2>Tu publicación</h2>
            <span class="tag-product"><i class="pi pi-tag" aria-hidden="true" />{{ post.productoNombre }}</span>
          </header>

          <!-- Selector de red: cambia el preview y a dónde se publica -->
          <div class="tabs" role="tablist" aria-label="Elige la red social">
            <button
              v-for="red in REDES_SOCIALES"
              :key="red.id"
              type="button"
              class="tab"
              :class="{ 'is-active': redActivaId === red.id }"
              :style="{ '--red': red.color }"
              role="tab"
              :aria-selected="redActivaId === red.id"
              @click="redActivaId = red.id"
            >
              <i :class="red.icono" aria-hidden="true" />
              <span>{{ red.nombre }}</span>
            </button>
          </div>

          <!-- Preview realista según la red elegida -->
          <div class="pv">
            <!-- Instagram -->
            <article v-if="redActivaId === 'instagram'" class="ig">
              <header class="ig__bar">
                <span class="ig__ava">{{ storeInitial }}</span>
                <strong class="ig__user">{{ storeUser }}</strong>
                <i class="pi pi-ellipsis-h ig__more" aria-hidden="true" />
              </header>
              <div class="pv__media pv__media--square">
                <img v-if="post.imagenUrl" :src="post.imagenUrl" :alt="post.productoNombre ?? ''">
                <div v-else class="pv__ph"><i class="pi pi-image" aria-hidden="true" /></div>
              </div>
              <div class="ig__acts">
                <i class="pi pi-heart" aria-hidden="true" />
                <i class="pi pi-comment" aria-hidden="true" />
                <i class="pi pi-send" aria-hidden="true" />
                <i class="pi pi-bookmark ig__save" aria-hidden="true" />
              </div>
              <p class="ig__cap"><strong>{{ storeUser }}</strong> {{ textoVista }}</p>
            </article>

            <!-- Facebook -->
            <article v-else-if="redActivaId === 'facebook'" class="fb">
              <header class="fb__bar">
                <span class="fb__ava">{{ storeInitial }}</span>
                <span class="fb__meta">
                  <strong>{{ storeName }}</strong>
                  <small>Ahora · <i class="pi pi-globe" aria-hidden="true" /></small>
                </span>
                <i class="pi pi-ellipsis-h fb__more" aria-hidden="true" />
              </header>
              <p class="fb__text">{{ textoVista }}</p>
              <div class="pv__media pv__media--wide">
                <img v-if="post.imagenUrl" :src="post.imagenUrl" :alt="post.productoNombre ?? ''">
                <div v-else class="pv__ph"><i class="pi pi-image" aria-hidden="true" /></div>
              </div>
              <div class="fb__acts">
                <span><i class="pi pi-thumbs-up" aria-hidden="true" />Me gusta</span>
                <span><i class="pi pi-comment" aria-hidden="true" />Comentar</span>
                <span><i class="pi pi-share-alt" aria-hidden="true" />Compartir</span>
              </div>
            </article>

            <!-- TikTok -->
            <article v-else-if="redActivaId === 'tiktok'" class="tt">
              <div class="pv__media pv__media--tall">
                <img v-if="post.imagenUrl" :src="post.imagenUrl" :alt="post.productoNombre ?? ''">
                <div v-else class="pv__ph pv__ph--dark"><i class="pi pi-image" aria-hidden="true" /></div>
              </div>
              <div class="tt__rail">
                <span class="tt__ava">{{ storeInitial }}</span>
                <span class="tt__act"><i class="pi pi-heart" aria-hidden="true" /><small>1.2k</small></span>
                <span class="tt__act"><i class="pi pi-comment" aria-hidden="true" /><small>86</small></span>
                <span class="tt__act"><i class="pi pi-bookmark" aria-hidden="true" /><small>40</small></span>
                <span class="tt__act"><i class="pi pi-share-alt" aria-hidden="true" /><small>Enviar</small></span>
              </div>
              <div class="tt__cap">
                <strong>@{{ storeUser }}</strong>
                <p>{{ textoVista }}</p>
                <span class="tt__music"><i class="pi pi-volume-up" aria-hidden="true" />sonido original</span>
              </div>
            </article>

            <!-- WhatsApp -->
            <div v-else class="wa">
              <div class="wa__bubble">
                <div class="pv__media pv__media--square wa__media">
                  <img v-if="post.imagenUrl" :src="post.imagenUrl" :alt="post.productoNombre ?? ''">
                  <div v-else class="pv__ph"><i class="pi pi-image" aria-hidden="true" /></div>
                </div>
                <p class="wa__text">{{ textoVista }}</p>
                <span class="wa__time">{{ post.mejorHora || '11:30' }} <i class="pi pi-check" aria-hidden="true" /></span>
              </div>
            </div>
          </div>

          <div class="field">
            <span class="field__label">Texto y hashtags <small>(puedes cambiarlo)</small></span>
            <textarea v-model="textoEditable" rows="6" maxlength="500" class="field__input" />
            <button type="button" class="tool tool--inline" @click="copiar(textoParaCopiar, 'Texto copiado 👍')">
              <i class="pi pi-copy" aria-hidden="true" />Copiar texto
            </button>
          </div>

          <button type="button" class="btn-primary publish-btn" :style="{ '--red': redActiva.color }" @click="publicarEn(redActiva)">
            <i :class="redActiva.icono" aria-hidden="true" />
            Publicar en {{ redActiva.nombre }}
          </button>
          <p class="publish-note"><i class="pi pi-info-circle" aria-hidden="true" />Haru solo prepara la publicación y te abre la red; subirla la haces tú.</p>

          <!-- Tras publicar: la idea se queda en pantalla y se invita a crear otra -->
          <div v-if="publicado" class="done">
            <p class="done__msg"><i class="pi pi-check-circle" aria-hidden="true" />¡Listo! Ya la compartiste. La publicación sigue aquí por si quieres usarla en otra red.</p>
            <button type="button" class="btn-primary done__btn" :disabled="generando" @click="abrirSelector">
              <i class="pi pi-sparkles" aria-hidden="true" />
              Crear otra publicación
            </button>
          </div>
        </section>

        <!-- Tarjeta 2: idea de video + guía para grabar -->
        <section class="card video">
          <div class="video__lead">
            <span class="video__icon"><i class="pi pi-video" aria-hidden="true" /></span>
            <div>
              <strong>Idea de video</strong>
              <p v-if="post.ideaVideo">{{ post.ideaVideo }}</p>
            </div>
          </div>

          <div class="video__guide">
            <span class="video__sub">Cómo grabarlo, paso a paso</span>
            <ol class="steps">
              <li v-for="paso in VIDEO_PASOS" :key="paso.n" class="step">
                <span class="step__n">{{ paso.n }}</span>
                <span class="step__txt">
                  <strong>{{ paso.titulo }}</strong>
                  <small>{{ paso.desc }}</small>
                </span>
              </li>
            </ol>
          </div>

          <ul class="video__tips">
            <li v-for="tip in VIDEO_TIPS" :key="tip.texto">
              <i :class="tip.icon" aria-hidden="true" />{{ tip.texto }}
            </li>
          </ul>
        </section>
      </div>
    </template>

    <!-- Aviso flotante de acciones -->
    <Transition name="flash">
      <div v-if="flashMsg" class="flash" role="status">{{ flashMsg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.mkt {
  display: grid;
  gap: 16px;
  max-width: 1040px;
  margin: 0 auto;
  color: #102016;
}

/* --- Encabezado --- */
.mkt-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.mkt-head__kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 900;
  color: #1c7a2c;
}

.mkt-head__copy h1 {
  margin: 6px 0 3px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1.15;
}

.mkt-head__copy p {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
  color: #5c6b60;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  border: 1px solid var(--brand-soft-line);
  border-radius: 11px;
  background: #fff;
  color: #1c7a2c;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--brand-soft);
  transform: translateY(-1px);
}

.btn-ghost:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 22px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(120deg, #0a6f1f, #0b6f38);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(10, 111, 32, 0.22);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px rgba(10, 111, 32, 0.28);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: default;
}

/* --- Estado vacío --- */
.empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
  background: #fff;
  border: 1px solid #e7eee8;
  border-radius: 18px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.empty__icon {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: var(--brand-soft-tint);
  color: #1c7a2c;
  font-size: 1.6rem;
}

.empty h2 {
  margin: 4px 0 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.2rem;
  font-weight: 900;
}

.empty p {
  margin: 0 0 8px;
  max-width: 420px;
  font-size: 0.86rem;
  font-weight: 600;
  color: #5c6b60;
  line-height: 1.45;
}

/* --- Selector de objetivo --- */
.selector {
  padding: 22px;
  background: #fff;
  border: 1px solid #e7eee8;
  border-radius: 18px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.selector__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.selector__head h2 {
  margin: 0 0 3px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.15rem;
  font-weight: 900;
}

.selector__head p {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #5c6b60;
}

.form {
  display: grid;
  gap: 18px;
}

.form__rest {
  display: grid;
  gap: 16px;
  max-width: 560px;
}

.form .field {
  display: grid;
  gap: 6px;
}

.form .field__label {
  font-size: 0.82rem;
  font-weight: 800;
  color: #2a3a30;
}

.form .field__label small {
  font-weight: 600;
  color: #8a978c;
}

.form .btn-primary {
  justify-content: center;
  margin-top: 2px;
}

/* Cuadritos de objetivo */
.obj-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}

.obj {
  display: grid;
  gap: 3px;
  padding: 14px;
  border: 1.5px solid #e7eee8;
  border-radius: 14px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.obj:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: var(--brand-soft-line);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
}

.obj.is-active {
  border-color: #0b6f38;
  background: var(--brand-soft);
  box-shadow: 0 10px 22px rgba(14, 111, 32, 0.14);
}

.obj:disabled {
  opacity: 0.55;
  cursor: default;
}

.obj__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  margin-bottom: 3px;
  border-radius: 11px;
  background: var(--brand-soft-tint);
  color: #1c7a2c;
  font-size: 1.1rem;
}

.obj.is-active .obj__icon {
  background: #0b6f38;
  color: #fff;
}

.obj strong {
  font-size: 0.92rem;
  font-weight: 900;
}

.obj small {
  font-size: 0.77rem;
  font-weight: 600;
  color: #6b7a6f;
  line-height: 1.4;
}

/* --- Datos rápidos --- */
.hints {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

/* --- Layout de dos tarjetas --- */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.hint {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 16px;
  background: #fff;
  border: 1px solid #e7eee8;
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.03);
}

.hint > i {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: var(--brand-soft-tint);
  color: #1c7a2c;
  font-size: 1rem;
}

.hint span {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.hint small {
  font-size: 0.68rem;
  font-weight: 700;
  color: #7a887e;
}

.hint strong {
  font-size: 0.92rem;
  font-weight: 900;
  color: #102016;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stars {
  display: inline-flex;
  gap: 2px;
  color: #f2b01e;
  font-size: 0.82rem;
}

.stars .pi-star {
  color: #d8ddd9;
}

/* --- Tarjeta única --- */
.card {
  padding: 20px;
  background: #fff;
  border: 1px solid #e7eee8;
  border-radius: 18px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.sheet {
  display: grid;
  gap: 20px;
  align-content: start;
}

.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.card h2 {
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.1rem;
  font-weight: 900;
}

.tag-product {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: #1c7a2c;
  font-size: 0.74rem;
  font-weight: 800;
}

/* --- Selector de red (tabs) --- */
.tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.tab {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 6px;
  border: 1.5px solid #e7eee8;
  border-radius: 12px;
  background: #fff;
  color: #5c6b60;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.tab i {
  font-size: 1.25rem;
  color: #98a79c;
  transition: color 0.15s ease;
}

.tab:hover {
  border-color: var(--brand-soft-line);
}

.tab.is-active {
  border-color: var(--red);
  background: color-mix(in srgb, var(--red) 8%, #fff);
  color: #102016;
}

.tab.is-active i {
  color: var(--red);
}

/* --- Preview común --- */
.pv {
  display: flex;
  justify-content: center;
}

.pv__media {
  overflow: hidden;
  background: #f3f6f3;
}

.pv__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pv__media--square { aspect-ratio: 1 / 1; }
.pv__media--wide { aspect-ratio: 4 / 3; }
.pv__media--tall { aspect-ratio: 9 / 16; }

.pv__ph {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #9fb0a4;
  background: linear-gradient(135deg, #eef4ec, #e4efe1);
  font-size: 1.8rem;
}

.pv__ph--dark {
  color: #5a5a5a;
  background: linear-gradient(135deg, #2a2a2a, #161616);
}

/* Instagram */
.ig {
  width: 100%;
  max-width: 340px;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.ig__bar {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
}

.ig__ava {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 900;
}

.ig__user {
  font-size: 0.86rem;
  font-weight: 700;
  color: #111;
}

.ig__more {
  margin-left: auto;
  color: #333;
}

.ig__acts {
  display: flex;
  gap: 14px;
  padding: 10px 12px 4px;
  font-size: 1.3rem;
  color: #111;
}

.ig__save { margin-left: auto; }

.ig__cap {
  margin: 0;
  padding: 4px 12px 14px;
  font-size: 0.85rem;
  line-height: 1.45;
  color: #1b2a20;
  white-space: pre-wrap;
}

.ig__cap strong {
  font-weight: 700;
  margin-right: 5px;
}

/* Facebook */
.fb {
  width: 100%;
  max-width: 360px;
  border: 1px solid #e4e6eb;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.fb__bar {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px;
}

.fb__ava {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #1877f2;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 900;
}

.fb__meta {
  display: grid;
  gap: 1px;
}

.fb__meta strong {
  font-size: 0.88rem;
  font-weight: 700;
  color: #050505;
}

.fb__meta small {
  font-size: 0.72rem;
  color: #65676b;
}

.fb__more {
  margin-left: auto;
  color: #65676b;
}

.fb__text {
  margin: 0;
  padding: 0 12px 10px;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #050505;
  white-space: pre-wrap;
}

.fb__acts {
  display: flex;
  justify-content: space-around;
  padding: 6px 4px;
  border-top: 1px solid #e4e6eb;
}

.fb__acts span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #65676b;
}

/* TikTok */
.tt {
  position: relative;
  width: 100%;
  max-width: 260px;
  border-radius: 14px;
  overflow: hidden;
  background: #000;
}

.tt .pv__media--tall { background: #000; }

.tt__rail {
  position: absolute;
  right: 8px;
  bottom: 70px;
  display: grid;
  justify-items: center;
  gap: 16px;
  color: #fff;
}

.tt__ava {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: linear-gradient(135deg, #25f4ee, #fe2c55);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 900;
}

.tt__act {
  display: grid;
  justify-items: center;
  gap: 3px;
  font-size: 1.5rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.tt__act small {
  font-size: 0.68rem;
  font-weight: 700;
}

.tt__cap {
  position: absolute;
  left: 12px;
  right: 60px;
  bottom: 12px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.tt__cap strong {
  font-size: 0.86rem;
  font-weight: 800;
}

.tt__cap p {
  margin: 4px 0 6px;
  font-size: 0.8rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tt__music {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 600;
}

/* WhatsApp */
.wa {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  padding: 14px;
  border-radius: 14px;
  background: #e5ddd5;
}

.wa__bubble {
  width: 100%;
  max-width: 270px;
  padding: 4px;
  border-radius: 10px 10px 2px 10px;
  background: #dcf8c6;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.12);
}

.wa__media {
  border-radius: 7px;
}

.wa__text {
  margin: 0;
  padding: 6px 6px 2px;
  font-size: 0.86rem;
  line-height: 1.4;
  color: #111;
  white-space: pre-wrap;
}

.wa__time {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 6px 4px;
  font-size: 0.68rem;
  color: #667781;
}

.wa__time i { color: #34b7f1; }

.field {
  display: grid;
  gap: 8px;
  margin-bottom: 0;
}

.field__label {
  font-size: 0.9rem;
  font-weight: 800;
  color: #2a3a30;
}

.field__label small {
  font-weight: 600;
  color: #8a978c;
}

.field__input {
  width: 100%;
  padding: 14px 15px;
  border: 1px solid #dbe6dc;
  border-radius: 12px;
  font: inherit;
  font-size: 1rem;
  line-height: 1.55;
  color: #102016;
  resize: vertical;
  background: #fbfdfb;
}

.field__input:focus {
  outline: 2px solid #bfe3b6;
  outline-offset: 1px;
  border-color: #9fd391;
}

/* --- Idea de video (tarjeta aparte) --- */
.video {
  display: grid;
  gap: 16px;
  align-content: start;
  background: var(--brand-soft);
  border-color: var(--brand-soft-line);
}

.video__lead {
  display: flex;
  gap: 12px;
}

.video__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: var(--brand-soft-2);
  color: var(--brand-accent);
  font-size: 1.1rem;
}

.video__lead strong {
  font-size: 0.95rem;
  font-weight: 900;
  color: var(--brand-deep);
}

.video__lead p {
  margin: 3px 0 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--brand-text-soft);
  line-height: 1.5;
}

.video__sub {
  display: block;
  margin-bottom: 10px;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--brand-accent);
}

.steps {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: none;
}

.step {
  display: flex;
  gap: 11px;
  align-items: flex-start;
}

.step__n {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--brand-fill);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 900;
}

.step__txt {
  display: grid;
  gap: 1px;
}

.step__txt strong {
  font-size: 0.92rem;
  font-weight: 900;
  color: var(--brand-deepest);
}

.step__txt small {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--brand-text-soft);
  line-height: 1.5;
}

.video__tips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  margin: 0;
  padding: 14px 0 0;
  list-style: none;
  border-top: 1px dashed var(--brand-soft-divider);
}

.video__tips li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--brand-text-soft);
}

.video__tips i {
  color: var(--brand-accent);
  font-size: 0.95rem;
}

/* --- Publicar --- */
.publish-btn {
  justify-content: center;
  width: 100%;
  background: var(--red);
  box-shadow: 0 12px 24px color-mix(in srgb, var(--red) 28%, transparent);
}

.publish-btn:hover:not(:disabled) {
  box-shadow: 0 16px 30px color-mix(in srgb, var(--red) 34%, transparent);
}

.publish-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: -8px 0 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: #5c6b60;
}

.publish-note i {
  font-size: 0.9rem;
  color: #98a79c;
}

/* Aviso + llamado a crear otra publicación tras compartir */
.done {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-soft-line);
}

.done__msg {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.45;
  color: var(--brand-deep);
}

.done__msg i {
  flex: 0 0 auto;
  margin-top: 1px;
  font-size: 1.1rem;
  color: var(--brand-fill);
}

.done__btn {
  justify-content: center;
  width: 100%;
}

.tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 13px;
  border: 0;
  border-radius: 11px;
  background: #f1f5f2;
  color: #46555c;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.tool--inline {
  width: auto;
  justify-self: start;
  padding: 9px 15px;
  font-size: 0.84rem;
}

.tool:hover {
  background: var(--brand-soft-tint);
  color: #1c7a2c;
}

/* --- Aviso flotante --- */
.flash {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 60;
  padding: 12px 20px;
  border-radius: 999px;
  background: #102016;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 800;
  box-shadow: 0 14px 30px rgba(3, 24, 9, 0.3);
}

.flash-enter-active,
.flash-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.flash-enter-from,
.flash-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

/* --- Responsivo --- */
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .mkt-head__copy h1 {
    font-size: 1.3rem;
  }

  .hints {
    grid-template-columns: 1fr;
  }

  .obj-grid {
    grid-template-columns: 1fr;
  }

  .tab {
    font-size: 0.72rem;
  }

  .video__tips {
    grid-template-columns: 1fr;
  }
}
</style>
