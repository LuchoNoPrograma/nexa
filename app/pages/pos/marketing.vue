<script setup lang="ts">
import {
  REDES_SOCIALES,
  enlaceRed,
  textoCompleto,
  type MarketingPublicacion,
  type RedSocial,
} from '~~/shared/utils/marketing'
import { recomendacionesMarketing } from '~~/shared/utils/recomendaciones/marketing'
import type { Recomendacion } from '~~/shared/utils/recomendaciones/tipos'

definePageMeta({
  layout: 'pos',
  posTitle: 'Marketing',
})

useHead({
  title: 'Marketing | NEXA',
})

type MarketingRecoData = {
  publicadasEstaSemana: number
  productosBajoMovimiento: number
  productosSinImagen: number
}

type MarketingResponse = {
  actual: MarketingPublicacion | null
  publicadas: number
  totalProductos: number
  marketingConfig: MarketingConfig
  recoData: MarketingRecoData
}

type MarketingConfig = {
  contacto: string | null
  ubicacion: string | null
  ciudad: string
  departamento: string
  confirmado: boolean
}

// Carga inicial: solo lee lo guardado, NO llama a la IA.
const { data, refresh, status: marketingStatus } = await useFetch<MarketingResponse>('/api/pos/marketing', {
  default: () => ({
    actual: null,
    publicadas: 0,
    totalProductos: 0,
    marketingConfig: {
      contacto: null,
      ubicacion: null,
      ciudad: 'Cobija',
      departamento: 'Pando',
      confirmado: false,
    },
    recoData: {
      publicadasEstaSemana: 0,
      productosBajoMovimiento: 0,
      productosSinImagen: 0,
    },
  }),
})

// La API puede devolver la última publicación guardada, pero la pantalla no debe
// retomarla al volver desde otro menú. Solo mostramos lo generado en esta visita.
const publicacionActual = ref<MarketingPublicacion | null>(null)
const post = computed(() => publicacionActual.value)
const sinProductos = computed(() => (data.value?.totalProductos ?? 0) === 0)

// El texto es editable antes de publicar; el usuario puede ajustar el borrador.
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
type Objetivo = { id: Modo; titulo: string; desc: string; img: string; tone: string; accion: string }

const OBJETIVOS: Objetivo[] = [
  {
    id: 'clientes',
    titulo: 'Atraer clientes',
    desc: 'Haru prepara una publicación para que más personas conozcan tu negocio.',
    img: '/haru/marketing/atraer-clientes.jpg',
    tone: 'green',
    accion: 'Difundir',
  },
  {
    id: 'sobrante',
    titulo: 'Vender lo que me sobra',
    desc: 'Convierte el stock acumulado en una oferta simple para vender hoy.',
    img: '/haru/marketing/vender-sobrante.jpg',
    tone: 'amber',
    accion: 'Ofertar',
  },
  {
    id: 'combo',
    titulo: 'Armar un combo',
    desc: 'Elige productos y Haru los presenta como una promoción atractiva.',
    img: '/haru/marketing/armar-combo.jpg',
    tone: 'blue',
    accion: 'Combinar',
  },
  {
    id: 'producto',
    titulo: 'Ofrecer producto',
    desc: 'Escoge un producto específico y Haru crea el texto para publicarlo.',
    img: '/haru/marketing/ofrecer-producto.jpg',
    tone: 'mint',
    accion: 'Publicar',
  },
]

type ProductoOpcion = { id: string; name: string; category: string | null; kind: string }

// Muestra el selector de objetivo al entrar o al pedir "otra idea".
const mostrarSelector = ref(false)

// Objetivo elegido (la tarjeta seleccionada).
const objetivoSel = ref<Objetivo | null>(null)
const modoActual = computed<Modo | null>(() => objetivoSel.value?.id ?? null)

// Indicación libre del usuario para orientar la publicación.
const nota = ref('')
const notaValida = computed(() => nota.value.trim().length >= 5)
const notaPlaceholder = computed(() => {
  const placeholders: Partial<Record<Modo, string>> = {
    clientes: 'Ej: quiero atraer estudiantes con una publicación alegre para el fin de semana',
    sobrante: 'Ej: quiero venderlo esta semana, sin inventar descuentos',
    combo: 'Ej: preséntalo como una opción para compartir en familia',
    producto: 'Ej: destaca el precio y que pueden pedirlo por WhatsApp',
  }
  return modoActual.value
    ? placeholders[modoActual.value]!
    : 'Primero elige una opción arriba y luego escribe qué quieres comunicar'
})

// Productos para combo / producto específico.
const productos = ref<ProductoOpcion[]>([])
const cargandoProductos = ref(false)
const productoElegido = ref<string>('')
const comboIds = ref<string[]>([])
const configDialogVisible = ref(false)
const guardandoConfig = ref(false)
const configError = ref('')
const configForm = reactive({
  countryDialCode: '+591',
  phone: '',
  ubicacion: '',
})

const marketingDialCodes = ['+591', '+51', '+55']

function splitMarketingPhone(value?: string | null) {
  const rawValue = (value ?? '').trim()
  const cleanValue = rawValue.replace(/\D/g, '')
  const dialCode = marketingDialCodes
    .map(code => code.replace(/\D/g, ''))
    .sort((a, b) => b.length - a.length)
    .find(code => cleanValue.startsWith(code))

  if (dialCode) {
    return {
      countryDialCode: `+${dialCode}`,
      phone: cleanValue.slice(dialCode.length),
    }
  }

  return {
    countryDialCode: '+591',
    phone: cleanValue || rawValue,
  }
}

const marketingConfig = computed(() => data.value?.marketingConfig ?? {
  contacto: null,
  ubicacion: null,
  ciudad: 'Cobija',
  departamento: 'Pando',
  confirmado: false,
})

const necesitaConfigMarketing = computed(() => {
  const config = marketingConfig.value
  return !config.confirmado || !config.contacto?.trim() || !config.ubicacion?.trim()
})

function syncConfigForm() {
  const config = marketingConfig.value
  const phoneData = splitMarketingPhone(config.contacto)
  configForm.countryDialCode = phoneData.countryDialCode
  configForm.phone = phoneData.phone
  configForm.ubicacion = config.ubicacion ?? ''
}

watch(marketingConfig, () => {
  if (!configDialogVisible.value) {
    syncConfigForm()
  }
}, { immediate: true })

onMounted(() => {
  if (marketingStatus.value === 'success' && necesitaConfigMarketing.value) {
    configDialogVisible.value = true
  }
})

function pedirConfigMarketing() {
  syncConfigForm()
  configError.value = ''
  configDialogVisible.value = true
}

async function guardarConfigMarketing() {
  configError.value = ''
  guardandoConfig.value = true
  try {
    await $fetch('/api/pos/marketing/config', {
      method: 'PUT',
      body: {
        countryDialCode: configForm.countryDialCode,
        phone: configForm.phone,
        ubicacion: configForm.ubicacion,
      },
    })
    await refresh()
    configDialogVisible.value = false
    flash('Datos públicos guardados')
  } catch (error: unknown) {
    const dataError = (error as { data?: { statusMessage?: string } })?.data
    configError.value = dataError?.statusMessage ?? 'No se pudo guardar la configuración.'
  } finally {
    guardandoConfig.value = false
  }
}

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
  if (!modoActual.value || !notaValida.value) {
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
  if (necesitaConfigMarketing.value) {
    pedirConfigMarketing()
    return
  }
  const modo = modoActual.value
  if (!modo) {
    mostrarErrorHaru('Elige qué quieres lograr antes de pedirle ayuda a Haru.', 'Selecciona una de las tarjetas: atraer clientes, vender sobrante, armar combo u ofrecer producto.')
    return
  }
  if (!notaValida.value) {
    mostrarErrorHaru('Cuéntale a Haru qué quieres comunicar.', 'Escribe una indicación breve de al menos 5 caracteres. Haru no generará contenido sin una instrucción tuya.')
    return
  }
  if (modo === 'combo' && comboIds.value.length < 2) {
    mostrarErrorHaru('Haru necesita al menos 2 productos para armar un combo.', 'Elige productos activos de tu inventario para que el combo tenga sentido comercial.')
    return
  }
  if (modo === 'producto' && !productoElegido.value) {
    mostrarErrorHaru('Elige el producto que quieres ofrecer.', 'Haru no puede crear una publicación sin saber qué producto real debe promocionar.')
    return
  }
  void generar(modo)
}

const generando = ref(false)
const flashMsg = ref('')
let flashTimer: ReturnType<typeof setTimeout> | undefined
let haruDialogTimer: ReturnType<typeof setTimeout> | undefined
let haruThinkingTimer: ReturnType<typeof setInterval> | undefined

type HaruDialogState = 'loading' | 'success' | 'error'

const haruDialogVisible = ref(false)
const haruDialogState = ref<HaruDialogState>('loading')
const haruDialogTitle = ref('')
const haruDialogText = ref('')
const haruDialogDetail = ref('')
const haruThinkingStep = ref(0)
const haruDialogCanClose = computed(() => haruDialogState.value !== 'loading')
const haruDialogShowInventory = computed(() => {
  const text = `${haruDialogText.value} ${haruDialogDetail.value}`.toLowerCase()
  return haruDialogState.value === 'error' && (text.includes('inventario') || text.includes('stock') || text.includes('producto'))
})

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
  if (haruDialogTimer) {
    clearTimeout(haruDialogTimer)
  }
  if (haruThinkingTimer) {
    clearInterval(haruThinkingTimer)
  }
})

function detenerPensamientoHaru() {
  if (haruThinkingTimer) {
    clearInterval(haruThinkingTimer)
    haruThinkingTimer = undefined
  }
}

function abrirDialogHaru(modo: Modo) {
  if (haruDialogTimer) {
    clearTimeout(haruDialogTimer)
  }

  const objetivo = OBJETIVOS.find((obj) => obj.id === modo)?.titulo ?? 'tu publicación'
  const etapas = [
    {
      text: `Estoy revisando los datos reales de ${objetivo.toLowerCase()}.`,
      detail: 'Verifico producto, precio, stock y categoría para trabajar con información real.',
    },
    {
      text: 'Ahora estoy interpretando lo que quieres comunicar.',
      detail: 'Relaciono tu indicación con el objetivo elegido y el contexto de tu negocio.',
    },
    {
      text: 'Estoy buscando el enfoque más atractivo para tus clientes.',
      detail: 'Organizo la idea para que sea clara, útil y fácil de publicar.',
    },
    {
      text: 'Ya estoy redactando la propuesta de publicación.',
      detail: 'Cuido el tono, el llamado a la acción y los datos que no deben inventarse.',
    },
    {
      text: 'Estoy dando una última revisión antes de mostrártela.',
      detail: 'Compruebo que el texto sea coherente con tu producto y tu objetivo.',
    },
  ]

  detenerPensamientoHaru()
  haruDialogState.value = 'loading'
  haruDialogTitle.value = 'Haru está preparando tu publicación'
  haruThinkingStep.value = 0
  haruDialogText.value = etapas[0]!.text
  haruDialogDetail.value = etapas[0]!.detail
  haruDialogVisible.value = true

  haruThinkingTimer = setInterval(() => {
    haruThinkingStep.value = (haruThinkingStep.value + 1) % etapas.length
    const etapa = etapas[haruThinkingStep.value]!
    haruDialogText.value = etapa.text
    haruDialogDetail.value = etapa.detail
  }, 5000)
}

function mostrarExitoHaru() {
  detenerPensamientoHaru()
  haruDialogState.value = 'success'
  haruDialogTitle.value = 'Publicación preparada'
  haruDialogText.value = 'Haru encontró datos suficientes y armó una idea lista para revisar.'
  haruDialogDetail.value = 'Puedes ajustar el texto antes de copiarlo o publicarlo.'
  haruDialogTimer = setTimeout(() => {
    haruDialogVisible.value = false
  }, 900)
}

function mostrarErrorHaru(message: string, detail?: string) {
  detenerPensamientoHaru()
  if (haruDialogTimer) {
    clearTimeout(haruDialogTimer)
  }
  haruDialogState.value = 'error'
  haruDialogTitle.value = 'Haru necesita más datos'
  haruDialogText.value = message
  haruDialogDetail.value = detail ?? 'Revisa tus productos activos, stock o selección actual y vuelve a intentarlo.'
  haruDialogVisible.value = true
}

function cerrarDialogHaru() {
  if (!haruDialogCanClose.value) {
    return
  }
  haruDialogVisible.value = false
}

async function irAInventarioDesdeHaru() {
  haruDialogVisible.value = false
  await navigateTo('/pos/catalogo')
}

// Los hashtags ya viven dentro del textarea, así que el texto a copiar/publicar es tal cual.
const textoParaCopiar = computed(() => textoEditable.value)

// Identidad de la tienda para la cabecera del preview (usuario y avatar).
const session = usePosSession()
const storeName = computed(() => session.value?.store ?? 'Tu negocio')
const storeInitial = computed(() => storeName.value.trim().charAt(0).toUpperCase() || 'N')
const storeUser = computed(() => storeName.value.toLowerCase().replace(/\s+/g, '').slice(0, 20) || 'tunegocio')

// Contacto para pedir marketing personalizado (por ahora va a un WhatsApp fijo).
const WHATSAPP_NUMERO = '59171117696'
const whatsappUrl = computed(() => {
  const mensaje = `Hola, quiero marketing personalizado para ${storeName.value}.`
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`
})

// Red activa: define qué mockup de preview se muestra (y a dónde se publica).
const redActivaId = ref<RedSocial['id']>('instagram')
const socialPreviewPlaceholder = '/social-preview-placeholder.jpg'
const redActiva = computed(() => REDES_SOCIALES.find((r) => r.id === redActivaId.value) ?? REDES_SOCIALES[0]!)

// Texto sin hashtags para mostrar la cabecera del caption por separado cuando hace falta.
const textoVista = computed(() => textoEditable.value.trim())
const chatGptUrl = 'https://chatgpt.com/'

function chatGptPromptUrl(prompt: string) {
  const url = new URL(chatGptUrl)
  url.searchParams.set('q', prompt)
  return url.toString()
}

function formatoImagen(red: RedSocial['id']) {
  const formatos: Record<RedSocial['id'], string> = {
    instagram: 'cuadrado 1:1, 1080 x 1080 px',
    facebook: 'horizontal 16:9, 1200 x 675 px',
    whatsapp: 'cuadrado 1:1, 1080 x 1080 px',
    tiktok: 'vertical 9:16, 1080 x 1920 px',
  }
  return formatos[red]
}

function detectarEnfoqueImagen(postActual: MarketingPublicacion) {
  const texto = `${postActual.titulo} ${postActual.texto} ${postActual.objetivo ?? ''}`.toLowerCase()
  if (texto.includes('combo')) {
    return {
      tipo: 'combo',
      titulo: 'Combo',
      instruccion: 'Presenta los productos juntos como un pack promocional ordenado, con un bloque visual de oferta y sensación de ahorro. Debe sentirse como una compra conveniente, no como un collage lleno.',
    }
  }
  if (texto.includes('oferta') || texto.includes('sobr') || texto.includes('stock') || texto.includes('aprovecha')) {
    return {
      tipo: 'oferta',
      titulo: 'Oferta',
      instruccion: 'Construye una pieza de oferta con precio o beneficio bien destacado, sensación de oportunidad y compra inmediata, sin inventar porcentajes de descuento ni urgencia falsa.',
    }
  }
  return {
    tipo: 'producto',
    titulo: 'Producto destacado',
    instruccion: 'Construye una pieza de producto destacado con apariencia de anuncio comercial, no solo una foto del producto.',
  }
}

function precioDesdeTexto(texto: string) {
  const match = texto.match(/\bBs\.?\s*\d+(?:[.,]\d{1,2})?/i)
  return match?.[0]?.replace(/\s+/g, ' ') ?? ''
}

const promptImagenChatGpt = computed(() => {
  if (!post.value) {
    return ''
  }

  const enfoque = detectarEnfoqueImagen(post.value)
  const formato = formatoImagen(redActivaId.value)
  const producto = post.value.productoNombre || post.value.titulo || 'mi producto'
  const caption = textoEditable.value.trim() || post.value.texto
  const precio = precioDesdeTexto(caption)
  const textoImagen = precio ? `${producto} · ${precio}` : producto
  const audiencia = post.value.audiencia || 'clientes locales'
  const objetivo = post.value.objetivo || enfoque.titulo.toLowerCase()
  const config = marketingConfig.value
  const contacto = config.contacto?.trim()
  const ubicacion = config.ubicacion?.trim()
  const ciudad = config.ciudad || 'Cobija'
  const departamento = config.departamento || 'Pando'

  return [
    'Genera una imagen publicitaria para redes sociales.',
    '',
    `Formato: ${formato}, listo para ${redActiva.value.nombre}.`,
    `Marca/nombre visible: ${storeName.value}.`,
    `Ubicación visible: ${ubicacion ? `${ubicacion}, ${ciudad}, ${departamento}, Bolivia` : `${ciudad}, ${departamento}, Bolivia`}.`,
    contacto ? `Contacto visible: ${contacto}.` : 'No muestres contacto si no aparece claramente en estas instrucciones.',
    `Producto/promoción: ${producto}.`,
    precio ? `Precio visible permitido: ${precio}.` : 'No muestres precio si no aparece claramente en estas instrucciones.',
    `Enfoque: ${enfoque.titulo}. ${enfoque.instruccion}`,
    `Audiencia: ${audiencia}. Objetivo: ${objetivo}.`,
    '',
    'Dirección de arte:',
    '- Debe parecer una publicidad terminada para Instagram, no una foto simple ni una plantilla vacía.',
    '- Composición tipo anuncio: producto grande como héroe, titular corto, precio o dato clave en una etiqueta visual y llamado visual a comprar.',
    '- Usa jerarquía clara: producto primero, precio/dato segundo, marca local de forma discreta.',
    '- Integra el nombre de la marca como parte del diseño, por ejemplo en un cartel pequeño, cintillo superior o sello limpio.',
    '- Integra contacto y ubicación en una franja inferior o cartel secundario, legible pero sin competir con el producto.',
    '- Fondo publicitario limpio relacionado con el rubro del producto, con formas suaves, superficie cuidada, luces comerciales y detalles mínimos del contexto.',
    '- Si el rubro es abarrotes/hogar, usa una ambientación de compra familiar limpia: colores frescos, sensación de hogar y consumo diario, sin mostrar una tienda como fondo.',
    '- Colores vivos pero controlados, buen contraste, iluminación profesional, sombras naturales, acabado moderno y confiable.',
    '- Deja aire alrededor del producto y evita llenar la imagen con demasiados elementos, stickers o textos.',
    '- Que el producto se vea real y comprable; evita deformaciones, empaques imposibles, texto ilegible o aspecto de imagen IA descuidada.',
    '',
    'Texto dentro de la imagen:',
    `- Usa solo texto corto y legible: "${textoImagen}".`,
    '- Puedes separar el texto en 2 niveles: nombre del producto y precio/dato clave.',
    '- No copies el caption completo.',
    '- No inventes otras marcas, logos, descuentos, porcentajes, direcciones, delivery, horarios ni datos nuevos.',
    '',
    'Genera la imagen directamente con estos datos.',
  ].join('\n')
})

async function copiar(texto: string, mensaje: string) {
  try {
    await navigator.clipboard.writeText(texto)
    flash(mensaje)
  } catch {
    flash('No se pudo copiar, intenta de nuevo.')
  }
}

async function abrirChatGptImagen() {
  if (necesitaConfigMarketing.value) {
    pedirConfigMarketing()
    return
  }
  const prompt = promptImagenChatGpt.value
  if (!prompt) {
    flash('Primero crea una publicación con Haru.')
    return
  }

  window.open(chatGptPromptUrl(prompt), '_blank', 'noopener')
  await copiar(prompt, 'Prompt copiado. Si ChatGPT no lo carga solo, pégalo ahí.')
}

async function generar(modo: Modo) {
  if (generando.value) {
    return
  }
  generando.value = true
  abrirDialogHaru(modo)
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
    publicacionActual.value = result.actual
    data.value = {
      actual: result.actual,
      publicadas: data.value?.publicadas ?? 0,
      totalProductos: data.value?.totalProductos ?? 0,
      marketingConfig: marketingConfig.value,
      recoData: data.value?.recoData ?? {
        publicadasEstaSemana: 0,
        productosBajoMovimiento: 0,
        productosSinImagen: 0,
      },
    }
    cerrarSelector()
    mostrarExitoHaru()
    flash('Publicación preparada')
  } catch (error: unknown) {
    const dataError = (error as { data?: { statusCode?: number; statusMessage?: string } })?.data
    const message = dataError?.statusMessage ?? 'No se pudo generar la publicación.'
    if (dataError?.statusCode === 400 || message.toLowerCase().includes('haru')) {
      mostrarErrorHaru(message)
    } else {
      haruDialogVisible.value = false
      flash(message)
    }
  } finally {
    detenerPensamientoHaru()
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

// --- Recomendaciones de Haru (motor de reglas, sin IA) ---
// Se recalculan en el cliente a partir de los datos que ya trae la lectura inicial.
const { open: abrirHaru } = useHaruChat()

const recomendaciones = computed<Recomendacion[]>(() =>
  recomendacionesMarketing({
    totalProductos: data.value?.totalProductos ?? 0,
    publicadasEstaSemana: data.value?.recoData?.publicadasEstaSemana ?? 0,
    productosBajoMovimiento: data.value?.recoData?.productosBajoMovimiento ?? 0,
    productosSinImagen: data.value?.recoData?.productosSinImagen ?? 0,
  }),
)

// Acción de una recomendación: abre el selector y, si la regla apunta a un objetivo
// concreto (combo, sobrante…), lo deja preseleccionado para el usuario.
function aplicarReco(reco: Recomendacion) {
  const valor = reco.accion?.valor
  abrirSelector()
  const objetivo = OBJETIVOS.find((obj) => obj.id === valor)
  if (objetivo) {
    objetivoSel.value = objetivo
  }
}
</script>

<template>
  <div class="mkt-shell">
    <div class="mkt">
    <!-- Encabezado: marketing y la acción del día -->
    <header class="mkt-head">
      <div class="mkt-head__copy">
        <span class="mkt-head__kicker">NEXA MARKETING</span>
        <h1>Marketing</h1>
        <p>Lista para copiar y compartir. Solo revisa, ajusta si quieres y publica.</p>
      </div>
      <div class="mkt-head__actions">
        <button type="button" class="btn-ghost" @click="pedirConfigMarketing">
          <i class="pi pi-map-marker" aria-hidden="true" />
          Datos públicos
        </button>
        <button v-if="post && !mostrarSelector" type="button" class="btn-ghost" @click="abrirSelector">
          <i class="pi pi-refresh" aria-hidden="true" />
          Otra idea
        </button>
      </div>
    </header>

    <!-- Estado vacío: sin productos -->
    <section v-if="sinProductos" class="empty">
      <span class="empty__icon"><Icon name="fluent-emoji:package" aria-hidden="true" /></span>
      <h2>Primero agrega un producto</h2>
      <p>Las publicaciones se crean a partir de tus productos. Agrega al menos uno en tu inventario.</p>
      <NuxtLink to="/pos/catalogo" class="btn-primary">
        <i class="pi pi-plus" aria-hidden="true" />Ir a inventario
      </NuxtLink>
    </section>

    <!-- Selector de objetivo: qué quiere lograr el usuario antes de generar -->
    <section v-else-if="!post || mostrarSelector" class="selector">
      <div class="selector__head">
        <div>
          <span class="selector__step">Paso 1 · Elige una opción</span>
          <h2>¿Qué quieres lograr hoy?</h2>
          <p>Toca una tarjeta para indicarle a Haru qué publicación debe preparar.</p>
        </div>
        <button v-if="post" type="button" class="btn-ghost" :disabled="generando" @click="cerrarSelector">
          <i class="pi pi-arrow-left" aria-hidden="true" />Volver
        </button>
      </div>

      <div class="form">
        <!-- Objetivo: cuadritos seleccionables -->
        <div class="obj-grid mb-4">
          <button
            v-for="obj in OBJETIVOS"
            :key="obj.id"
            type="button"
            class="obj"
            :class="[`is-${obj.tone}`, { 'is-active': modoActual === obj.id }]"
            :disabled="generando"
            :aria-pressed="modoActual === obj.id"
            @click="objetivoSel = obj"
          >
            <span class="obj__art">
              <img
                :src="obj.img"
                :alt="obj.titulo"
                loading="lazy"
                decoding="async"
              >
            </span>
            <span class="obj__copy">
              <span class="obj__action">{{ obj.accion }}</span>
              <strong>{{ obj.titulo }}</strong>
              <small>{{ obj.desc }}</small>
              <span class="obj__choice">
                <i :class="modoActual === obj.id ? 'pi pi-check' : 'pi pi-arrow-right'" aria-hidden="true" />
                {{ modoActual === obj.id ? 'Opción seleccionada' : 'Elegir esta opción' }}
              </span>
            </span>
            <i class="pi pi-check-circle obj__check" aria-hidden="true" />
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

          <!-- La instrucción es obligatoria: evita generar contenido sin intención del usuario. -->
          <div class="field">
            <span class="field__step">Paso 2 · Escribe tu indicación</span>
            <span class="field__label">¿Qué quieres que diga la publicación?</span>
            <Textarea
              v-model="nota"
              rows="2"
              auto-resize
              fluid
              maxlength="240"
              :disabled="!modoActual || generando"
              :invalid="nota.length > 0 && !notaValida"
              :placeholder="notaPlaceholder"
            />
            <span class="field__help" :class="{ 'is-ready': notaValida }">
              <i :class="notaValida ? 'pi pi-check-circle' : modoActual ? 'pi pi-info-circle' : 'pi pi-lock'" aria-hidden="true" />
              {{ notaValida ? 'Indicación lista' : modoActual ? 'Obligatorio: Haru no publicará nada sin una instrucción tuya.' : 'Elige una opción para habilitar este campo.' }}
            </span>
          </div>

          <button type="button" class="btn-primary" :disabled="generando || !puedeCrear" @click="crear">
            <i :class="generando ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'" aria-hidden="true" />
            {{ generando ? 'Creando publicación…' : !modoActual ? 'Primero elige una opción' : !notaValida ? 'Escribe una indicación para continuar' : 'Crear publicación' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Publicación lista -->
    <template v-else>
      <!-- Datos rápidos de la recomendación -->
      <div class="hints">
        <div class="hint">
          <span class="hint__icon"><Icon name="fluent-emoji:alarm-clock" aria-hidden="true" /></span>
          <span><small>Mejor hora</small><strong>{{ post.mejorHora || '19:00' }}</strong></span>
        </div>
        <div v-if="post.audiencia" class="hint">
          <span class="hint__icon"><Icon name="fluent-emoji:busts-in-silhouette" aria-hidden="true" /></span>
          <span><small>A quién le gusta</small><strong>{{ post.audiencia }}</strong></span>
        </div>
        <div class="hint">
          <span class="hint__icon"><Icon name="fluent-emoji:star" aria-hidden="true" /></span>
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
                <img v-else :src="socialPreviewPlaceholder" alt="Vista previa para redes sociales">
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
                <img v-else :src="socialPreviewPlaceholder" alt="Vista previa para Facebook">
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
                <div v-else class="pv__ph pv__ph--dark" />
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
                  <img v-else :src="socialPreviewPlaceholder" alt="Vista previa para WhatsApp">
                </div>
                <p class="wa__text">{{ textoVista }}</p>
                <span class="wa__time">{{ post.mejorHora || '11:30' }} <i class="pi pi-check" aria-hidden="true" /></span>
              </div>
            </div>
          </div>

          <div class="field">
            <span class="field__label">Texto y hashtags <small>(puedes cambiarlo)</small></span>
            <textarea v-model="textoEditable" rows="6" maxlength="500" class="field__input" />
            <div class="tool-row">
              <button type="button" class="tool tool--inline" @click="copiar(textoParaCopiar, 'Texto copiado 👍')">
                <i class="pi pi-copy" aria-hidden="true" />Copiar texto
              </button>
              <button type="button" class="tool tool--inline tool--chatgpt" @click="abrirChatGptImagen">
                <i class="pi pi-image" aria-hidden="true" />Imagen con ChatGPT
              </button>
            </div>
          </div>

          <button type="button" class="btn-primary publish-btn" :style="{ '--red': redActiva.color }" @click="publicarEn(redActiva)">
            <i :class="redActiva.icono" aria-hidden="true" />
            Publicar en {{ redActiva.nombre }}
          </button>
          <p class="publish-note"><i class="pi pi-info-circle" aria-hidden="true" />NEXA prepara la publicación y abre la red; subirla la haces tú.</p>

          <!-- Tras publicar: la idea se queda en pantalla y se invita a crear otra -->
          <div v-if="publicado" class="done">
            <p class="done__msg"><i class="pi pi-check-circle" aria-hidden="true" />¡Listo! Ya la compartiste. La publicación sigue aquí por si quieres usarla en otra red.</p>
            <button type="button" class="btn-primary done__btn" :disabled="generando" @click="abrirSelector">
              <i class="pi pi-sparkles" aria-hidden="true" />
              Crear otra publicación
            </button>
          </div>
        </section>

        <!-- Columna secundaria: apoyo para crear la imagen de la publicación -->
        <div class="layout__side">
          <section class="image-ai">
            <span class="image-ai__icon"><i class="pi pi-sparkles" aria-hidden="true" /></span>
            <div>
              <strong>¿Necesitas imagen para esta publicación?</strong>
              <p>Haru arma el prompt con tu producto y abre ChatGPT. Solo pega el texto copiado y adjunta una foto si quieres más precisión.</p>
              <button type="button" class="image-ai__btn" @click="abrirChatGptImagen">
                <i class="pi pi-external-link" aria-hidden="true" />
                Abrir ChatGPT
              </button>
            </div>
          </section>
          <section class="contacto">
            <div class="contacto__body">
              <span class="contacto__icon"><Icon name="fluent-emoji:speech-balloon" aria-hidden="true" /></span>
              <strong>¿Quieres algo más personalizado?</strong>
              <p>Cuéntanos qué necesitas y armamos una estrategia para tu negocio.</p>
              <a class="contacto__btn" :href="whatsappUrl" target="_blank" rel="noopener">
                <i class="pi pi-whatsapp" aria-hidden="true" />
                Hablar con Haru
              </a>
            </div>
          </section>
        </div>
      </div>
    </template>

    <Dialog
      v-model:visible="haruDialogVisible"
      modal
      :closable="haruDialogCanClose"
      :close-on-escape="haruDialogCanClose"
      :dismissable-mask="false"
      class="haru-dialog"
    >
      <div class="haru-feedback" :class="`is-${haruDialogState}`">
        <div class="haru-feedback__visual" aria-hidden="true">
          <span v-if="haruDialogState === 'loading'" class="haru-spinner" />
          <i v-else-if="haruDialogState === 'success'" class="pi pi-check-circle" />
          <i v-else class="pi pi-exclamation-triangle" />
        </div>

        <div class="haru-feedback__copy" aria-live="polite">
          <span class="haru-feedback__kicker">Haru Marketing</span>
          <h2>{{ haruDialogTitle }}</h2>
          <div :key="haruDialogState === 'loading' ? haruThinkingStep : haruDialogState" class="haru-feedback__thought">
            <p>{{ haruDialogText }}</p>
            <small>{{ haruDialogDetail }}</small>
          </div>
        </div>

        <div v-if="haruDialogCanClose" class="haru-feedback__actions">
          <button
            v-if="haruDialogShowInventory"
            type="button"
            class="btn-primary"
            @click="irAInventarioDesdeHaru"
          >
            <i class="pi pi-box" aria-hidden="true" />
            Revisar inventario
          </button>
          <button type="button" class="btn-ghost" @click="cerrarDialogHaru">
            Entendido
          </button>
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="configDialogVisible"
      modal
      :closable="!guardandoConfig && !necesitaConfigMarketing"
      :close-on-escape="!guardandoConfig && !necesitaConfigMarketing"
      :dismissable-mask="false"
      class="marketing-config-dialog"
    >
      <form class="marketing-config" @submit.prevent="guardarConfigMarketing">
        <span class="marketing-config__icon"><i class="pi pi-megaphone" aria-hidden="true" /></span>
        <div class="marketing-config__copy">
          <span class="marketing-config__kicker">Datos para publicidad</span>
          <h2>Confirma el contacto del negocio</h2>
          <p>Usaremos estos datos en las imágenes y textos de marketing. Deben ser públicos del negocio, no necesariamente tus datos personales.</p>
        </div>

        <div class="marketing-config__field">
          <label for="marketing-phone">Contacto comercial</label>
          <SharedPhoneCountryInput
            v-model:country-dial-code="configForm.countryDialCode"
            v-model:phone="configForm.phone"
            input-id="marketing-phone"
            name="marketingPhone"
            autocomplete="tel"
            required
            :disabled="guardandoConfig"
          />
        </div>

        <div class="marketing-config__field">
          <label for="marketing-location">Ubicación pública</label>
          <InputText
            id="marketing-location"
            v-model="configForm.ubicacion"
            fluid
            maxlength="160"
            placeholder="Ej: Av. Principal, zona Central"
            :disabled="guardandoConfig"
          />
        </div>

        <p v-if="configError" class="marketing-config__error" role="alert">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          {{ configError }}
        </p>

        <div class="marketing-config__actions">
          <button
            v-if="!necesitaConfigMarketing"
            type="button"
            class="btn-ghost"
            :disabled="guardandoConfig"
            @click="configDialogVisible = false"
          >
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="guardandoConfig">
            <i :class="guardandoConfig ? 'pi pi-spin pi-spinner' : 'pi pi-check'" aria-hidden="true" />
            {{ guardandoConfig ? 'Guardando…' : 'Guardar datos' }}
          </button>
        </div>
      </form>
    </Dialog>

    <!-- Aviso flotante de acciones -->
    <Transition name="flash">
      <div v-if="flashMsg" class="flash" role="status">{{ flashMsg }}</div>
    </Transition>
    </div>

    <!-- Riel de Haru: recomendaciones y contacto personalizado. -->
    <aside v-if="!sinProductos" class="mkt-rail">
      <PosRecomendacionesHaru
        :items="recomendaciones"
        titulos-mayuscula
        @accion="aplicarReco"
        @principal="abrirHaru"
      />
    </aside>
  </div>
</template>

<style scoped>
/* Shell: contenido principal + panel de recomendaciones de Haru.
   Desktop ≥1100px → dos columnas (panel a la derecha, sticky).
   Móvil → una columna; el panel queda al fondo por orden del DOM. */
.mkt-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  max-width: 1040px;
  margin: 0 auto;
}

.mkt {
  display: grid;
  gap: 16px;
  min-width: 0;
  color: #102016;
}

@media (min-width: 1100px) {
  .mkt-shell {
    grid-template-columns: minmax(0, 1fr) 330px;
    align-items: start;
    max-width: 1400px;
  }

  .mkt-rail {
    position: sticky;
    top: 16px;
  }
}

.mkt-rail {
  display: grid;
  gap: 16px;
  min-width: 0;
}

/* --- Encabezado --- */
.mkt-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.mkt-head__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mkt-head__kicker {
  display: block;
  margin-bottom: 4px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b778a;
}

.mkt-head__copy h1 {
  margin: 0 0 3px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.25rem;
  font-weight: 900;
  line-height: 1.15;
  color: #071327;
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

:global(.haru-dialog.p-dialog) {
  width: min(92vw, 430px);
  border-radius: 20px;
  overflow: hidden;
}

:global(.haru-dialog .p-dialog-header) {
  display: none;
}

:global(.haru-dialog .p-dialog-content) {
  padding: 0;
  border-radius: 20px;
  overflow: hidden;
}

.haru-feedback {
  display: grid;
  justify-items: center;
  gap: 15px;
  padding: 28px 24px 24px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 0%, rgba(14, 138, 40, 0.12), transparent 42%),
    #fff;
}

.haru-feedback__visual {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border-radius: 22px;
  background: #edf8e9;
  color: #0a6f1f;
  font-size: 2.2rem;
}

.haru-feedback.is-error .haru-feedback__visual {
  background: #fff3df;
  color: #c46a12;
}

.haru-feedback.is-success .haru-feedback__visual {
  background: #e8f8ee;
  color: #0a8f3a;
}

.haru-spinner {
  width: 38px;
  height: 38px;
  border: 4px solid rgba(10, 111, 31, 0.18);
  border-top-color: #0a6f1f;
  border-radius: 50%;
  animation: haru-spin 0.8s linear infinite;
}

.haru-feedback__copy {
  display: grid;
  gap: 7px;
}

.haru-feedback__thought {
  display: grid;
  justify-items: center;
  gap: 5px;
  min-height: 67px;
  animation: haru-thought-in 0.32s ease both;
}

.haru-feedback__kicker {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1c7a2c;
}

.haru-feedback__copy h2 {
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.14rem;
  font-weight: 900;
  line-height: 1.18;
  color: #071327;
}

.haru-feedback__copy p {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 750;
  line-height: 1.45;
  color: #233229;
}

.haru-feedback__copy small {
  display: block;
  max-width: 340px;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.45;
  color: #6b7a6f;
}

.haru-feedback__actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding-top: 4px;
  flex-wrap: wrap;
}

.haru-feedback__actions .btn-primary,
.haru-feedback__actions .btn-ghost {
  min-width: 146px;
  justify-content: center;
}

@keyframes haru-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes haru-thought-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:global(.marketing-config-dialog.p-dialog) {
  width: min(92vw, 470px);
  border-radius: 20px;
  overflow: hidden;
}

:global(.marketing-config-dialog .p-dialog-header) {
  display: none;
}

:global(.marketing-config-dialog .p-dialog-content) {
  padding: 0;
  border-radius: 20px;
  overflow: hidden;
}

.marketing-config {
  display: grid;
  gap: 16px;
  padding: 26px;
  background:
    radial-gradient(circle at 100% 0%, rgba(242, 194, 0, 0.16), transparent 40%),
    #fff;
}

.marketing-config__icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: #fff8d7;
  color: #9c7100;
  font-size: 1.7rem;
}

.marketing-config__copy {
  display: grid;
  gap: 7px;
}

.marketing-config__kicker {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9c7100;
}

.marketing-config h2 {
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.16rem;
  font-weight: 900;
  line-height: 1.18;
  color: #071327;
}

.marketing-config p {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 650;
  line-height: 1.45;
  color: #52615a;
}

.marketing-config__field {
  display: grid;
  gap: 7px;
}

.marketing-config__field label,
.marketing-config__field span {
  font-size: 0.82rem;
  font-weight: 850;
  color: #26372c;
}

.marketing-config__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff1f1;
  color: #ad1f2b;
}

.marketing-config__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 2px;
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
  width: 68px;
  height: 68px;
  border-radius: 18px;
  background: var(--brand-soft-tint);
  color: #1c7a2c;
  font-size: 2.6rem;
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

.selector__step {
  display: block;
  margin-bottom: 5px;
  color: #0b6f38;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
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
  width: 100%;
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

.field__step {
  color: #0b6f38;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.field__help {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #7a6550;
  font-size: 0.74rem;
  font-weight: 700;
}

.field__help.is-ready {
  color: #08752d;
}

.form .btn-primary {
  justify-content: center;
  width: 100%;
  margin-top: 2px;
}

.form :deep(.p-textarea) {
  width: 100%;
}

/* Objetivos con Haru como señal visual principal */
.obj-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.obj {
  position: relative;
  display: grid;
  grid-template-rows: 150px 1fr;
  gap: 10px;
  min-height: 284px;
  padding: 12px;
  border: 1.5px solid #e7eee8;
  border-radius: 18px;
  background: linear-gradient(180deg, #fff 0%, #f8fbf7 100%);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.obj::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 5px;
  opacity: 0.76;
}

.obj.is-green::before {
  background: linear-gradient(90deg, #0a6f1f, #14a634);
}

.obj.is-amber::before {
  background: linear-gradient(90deg, #d98b1e, #f2c200);
}

.obj.is-blue::before {
  background: linear-gradient(90deg, #0b5f9e, #24a8db);
}

.obj.is-mint::before {
  background: linear-gradient(90deg, #0b6f38, #2ec4b6);
}

.obj:hover:not(:disabled) {
  transform: translateY(-5px);
  border-color: #2a9147;
  box-shadow: 0 16px 30px rgba(11, 111, 56, 0.15);
}

.obj:focus-visible {
  outline: 3px solid rgba(11, 111, 56, 0.25);
  outline-offset: 3px;
}

.obj.is-active {
  transform: translateY(-3px);
  border-color: #08752d;
  background: linear-gradient(180deg, #ffffff 0%, #eaf7e9 100%);
  box-shadow: 0 0 0 2px #08752d, 0 16px 30px rgba(14, 111, 32, 0.18);
}

.obj:disabled {
  opacity: 0.55;
  cursor: default;
}

.obj__art {
  display: grid;
  place-items: center;
  width: 100%;
  height: 150px;
  border-radius: 16px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 42%, #eef8eb 0%, #f8fbf7 70%);
  transition: transform 0.2s ease;
}

.obj.is-amber .obj__art {
  background: radial-gradient(circle at 50% 42%, #fff3d6 0%, #fbf7ee 70%);
}

.obj.is-blue .obj__art {
  background: radial-gradient(circle at 50% 42%, #e5f6ff 0%, #f4fbff 70%);
}

.obj.is-mint .obj__art {
  background: radial-gradient(circle at 50% 42%, #dff8f3 0%, #f4fbf8 70%);
}

.obj:hover:not(:disabled) .obj__art {
  transform: scale(1.03);
}

.obj__art img {
  width: min(100%, 150px);
  height: 150px;
  object-fit: contain;
  object-position: center;
  mix-blend-mode: multiply;
}

.obj__copy {
  display: grid;
  gap: 5px;
  align-content: start;
}

.obj__action {
  width: max-content;
  max-width: 100%;
  padding: 5px 9px;
  border-radius: 999px;
  background: #edf6e9;
  color: #0b6f38;
  font-size: 0.68rem;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.obj.is-amber .obj__action {
  background: #fff2cd;
  color: #9b6714;
}

.obj.is-blue .obj__action {
  background: #e7f5ff;
  color: #0b5f9e;
}

.obj.is-mint .obj__action {
  background: #def8f1;
  color: #0b6f55;
}

.obj strong {
  font-size: 0.94rem;
  font-weight: 900;
  color: #102016;
  line-height: 1.18;
}

.obj small {
  font-size: 0.77rem;
  font-weight: 600;
  color: #6b7a6f;
  line-height: 1.4;
}

.obj__choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  margin-top: 5px;
  color: #0b6f38;
  font-size: 0.74rem;
  font-weight: 900;
  line-height: 1.2;
}

.obj__choice i {
  font-size: 0.68rem;
  transition: transform 0.15s ease;
}

.obj:hover:not(:disabled) .obj__choice i {
  transform: translateX(3px);
}

.obj.is-active .obj__choice {
  padding: 6px 9px;
  border-radius: 999px;
  background: #08752d;
  color: #fff;
}

.obj.is-active .obj__choice i {
  transform: none;
}

.obj__check {
  position: absolute;
  top: 13px;
  right: 13px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  color: #b8c4ba;
  font-size: 1rem;
  opacity: 0;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
  transition: opacity 0.15s ease, color 0.15s ease;
}

.obj.is-active .obj__check {
  color: #0b6f38;
  opacity: 1;
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

.hint__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: var(--brand-soft-tint);
  color: #1c7a2c;
  font-size: 1.95rem;
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

/* Placeholder: el ícono va como imagen de fondo, centrado, sobre el degradado */
.pv__ph {
  width: 100%;
  height: 100%;
  background-color: #e7efe3;
  background-image: url("/img-placeholder.svg");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 46%;
}

.pv__ph--dark {
  background-color: #1d1d1d;
  opacity: 0.9;
}

/* En formato vertical (TikTok) el ícono más chico para que no domine */
.pv__media--tall .pv__ph {
  background-size: 34%;
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

.tool-row {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.tool--inline {
  width: auto;
  justify-self: start;
  padding: 9px 15px;
  font-size: 0.84rem;
}

.tool--chatgpt {
  background: #f3f7ff;
  color: #1554b8;
}

.tool:hover {
  background: var(--brand-soft-tint);
  color: #1c7a2c;
}

.tool--chatgpt:hover {
  background: #e8f1ff;
  color: #0f4293;
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

/* --- Columna secundaria de la publicación --- */
.layout__side {
  display: grid;
  gap: 16px;
  align-content: start;
}

/* --- Cuadro de marketing personalizado --- */
.contacto {
  position: relative;
  overflow: hidden;
  padding: 22px;
  border-radius: 18px;
  background: #0a6f1f url("/haru-asesor-bg.jpg") 135% center / cover no-repeat;
  box-shadow: 0 12px 28px rgba(10, 111, 32, 0.22);
}

/* Velo verde para que el texto se lea con contraste sobre el fondo */
.contacto::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(7, 64, 20, 0.92) 0%, rgba(7, 64, 20, 0.78) 48%, rgba(7, 64, 20, 0.62) 78%, rgba(7, 64, 20, 0.55) 100%);
}

.contacto__body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
  max-width: calc(100% - 88px);
}

.contacto__icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin-bottom: 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 2.2rem;
}

.contacto strong {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.05rem;
  font-weight: 900;
  color: #fff;
}

.contacto p {
  margin: 0 0 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
}

.contacto__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 22px;
  border-radius: 12px;
  background: #fff;
  color: #0a6f1f;
  font-size: 0.9rem;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.contacto__btn i {
  font-size: 1.05rem;
}

.contacto__btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 26px rgba(0, 0, 0, 0.18);
}

.image-ai {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 13px;
  padding: 18px;
  border: 1px solid #d7e5ff;
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(37, 99, 235, 0.16), transparent 40%),
    linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
  color: #0d2548;
}

.image-ai__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: #fff;
  color: #1554b8;
  box-shadow: 0 12px 24px rgba(21, 84, 184, 0.14);
}

.image-ai strong {
  display: block;
  margin-bottom: 5px;
  font-size: 0.92rem;
  font-weight: 900;
}

.image-ai p {
  margin: 0 0 12px;
  font-size: 0.8rem;
  font-weight: 650;
  line-height: 1.45;
  color: #41617f;
}

.image-ai__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 13px;
  border: 0;
  border-radius: 11px;
  background: #1554b8;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
}

.image-ai__btn:hover {
  transform: translateY(-1px);
  background: #0f4293;
}

/* --- Responsivo --- */
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .obj-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .obj {
    grid-template-rows: 168px 1fr;
    min-height: 286px;
  }

  .obj__art {
    height: 168px;
  }

  .obj__art img {
    width: min(100%, 168px);
    height: 168px;
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

  .obj {
    grid-template-columns: 104px 1fr;
    grid-template-rows: auto;
    align-items: center;
    min-height: 132px;
  }

  .obj__art {
    height: 104px;
    border-radius: 14px;
  }

  .obj__art img {
    width: 104px;
    height: 104px;
  }

  .tab {
    font-size: 0.72rem;
  }

  /* En móvil los iconos vuelven a su tamaño compacto (no agrandados). */
  .empty__icon {
    width: 60px;
    height: 60px;
    font-size: 2rem;
  }

  .obj__icon {
    width: 38px;
    height: 38px;
    font-size: 1.5rem;
  }

  .hint__icon {
    width: 38px;
    height: 38px;
    font-size: 1.4rem;
  }

  .contacto__icon {
    width: 46px;
    height: 46px;
    font-size: 1.7rem;
  }

}
</style>
