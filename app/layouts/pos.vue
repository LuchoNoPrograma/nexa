<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'

const route = useRoute()
const router = useRouter()
const session = usePosSession()
const sessionStore = useSessionStore()
const { puede } = useAcceso()
const { open: openHaru } = useHaruChat()
const { isLoading: isRouteLoading } = useLoadingIndicator({
  duration: 1000,
  throttle: 120,
  hideDelay: 0,
  resetDelay: 0,
})
const mobileMenuOpen = ref(false)
const moreMenuOpen = ref(false)
const supportDialogOpen = ref(false)
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(250)
const isResizingSidebar = ref(false)

const SIDEBAR_KEY = 'nexa-pos-sidebar-collapsed'
const SIDEBAR_WIDTH_KEY = 'nexa-pos-sidebar-width'
const SIDEBAR_DEFAULT_WIDTH = 230
const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 360
const SIDEBAR_COLLAPSED_WIDTH = 76
const SIDEBAR_KEYBOARD_STEP = 12
const SUPPORT_COUNTRY_DIAL_CODE = '+591'
const SUPPORT_PHONE = '71117696'
const SUPPORT_WHATSAPP_URL = `https://wa.me/591${SUPPORT_PHONE}`

let removeRouteBeforeGuard: (() => void) | undefined

const currentSidebarWidth = computed(() => sidebarCollapsed.value ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth.value)

function isDesktop() {
  return import.meta.client && window.innerWidth > 760
}

function clampSidebarWidth(value: number) {
  return Math.min(Math.max(value, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH)
}

function saveSidebarState() {
  if (!import.meta.client) {
    return
  }

  localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
}

function setSidebarWidth(width: number, persist = true) {
  sidebarWidth.value = clampSidebarWidth(width)
  sidebarCollapsed.value = false

  if (persist) {
    saveSidebarState()
  }
}

function toggleMenu() {
  if (isDesktop()) {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveSidebarState()
  } else {
    mobileMenuOpen.value = true
  }
}

function openBusinessProfile() {
  window.dispatchEvent(new CustomEvent('nexa:open-business-profile'))
}

function openAccountSecurity() {
  moreMenuOpen.value = false
  window.dispatchEvent(new CustomEvent('nexa:open-account-security'))
}

function openSupport() {
  mobileMenuOpen.value = false
  moreMenuOpen.value = false
  supportDialogOpen.value = true
}

function restoreSidebarWidth() {
  setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
}

function startSidebarResize(event: PointerEvent) {
  if (!isDesktop()) {
    return
  }

  event.preventDefault()
  sidebarCollapsed.value = false
  isResizingSidebar.value = true
  document.body.classList.add('is-resizing-pos-sidebar')

  const pointerId = event.pointerId
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(pointerId)

  function onPointerMove(moveEvent: PointerEvent) {
    setSidebarWidth(moveEvent.clientX, false)
  }

  function onPointerUp() {
    isResizingSidebar.value = false
    document.body.classList.remove('is-resizing-pos-sidebar')

    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }

    saveSidebarState()
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onSidebarResizeKeydown(event: KeyboardEvent) {
  if (!isDesktop()) {
    return
  }

  const actions: Record<string, () => void> = {
    ArrowLeft: () => setSidebarWidth(sidebarWidth.value - SIDEBAR_KEYBOARD_STEP),
    ArrowRight: () => setSidebarWidth(sidebarWidth.value + SIDEBAR_KEYBOARD_STEP),
    Home: () => setSidebarWidth(SIDEBAR_MIN_WIDTH),
    End: () => setSidebarWidth(SIDEBAR_MAX_WIDTH),
    Enter: restoreSidebarWidth,
  }

  const action = actions[event.key]

  if (!action) {
    return
  }

  event.preventDefault()
  action()
}

// `acceso` es una expresión que evalúa `tieneAcceso`. Finanzas admite a la
// cajera solo para mostrarle el hijo Gastos; resumen e ingresos siguen cerrados.
interface SidebarItem {
  label: string
  icon: string
  to?: string
  acceso?: string
  superAdminOnly?: boolean
  aliases?: string[]
  activePaths?: string[]
  children?: SidebarItem[]
}

const isSuperAdmin = computed(() => session.value?.role === 'super_admin')

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', icon: 'pi pi-home', to: '/pos/inicio', aliases: ['principal', 'portada', 'comenzar'] },
  { label: 'Caja', icon: 'pi pi-wallet', to: '/pos/caja', acceso: 'CAJA', aliases: ['cobrar', 'cobro', 'movimientos de caja'] },
  { label: 'Ventas', icon: 'pi pi-shopping-cart', to: '/pos', acceso: 'VENDER', aliases: ['venta', 'vender', 'nueva venta', 'realizar venta', 'hacer venta'] },
  { label: 'Marketing', icon: 'pi pi-megaphone', to: '/pos/marketing', acceso: 'HARU', aliases: ['publicidad', 'promocion', 'redes sociales'] },
  { label: 'Inventario', icon: 'pi pi-box', to: '/pos/catalogo', acceso: 'INVENTARIO', aliases: ['producto', 'productos', 'stock', 'catalogo', 'existencias'] },
  {
    label: 'Finanzas',
    icon: 'pi pi-chart-pie',
    acceso: 'REPORTE || CAJERO',
    children: [
      { label: 'Resumen financiero', icon: 'pi pi-chart-pie', to: '/pos/finanzas', acceso: 'REPORTE', aliases: ['finanzas', 'resumen', 'resumen de finanzas'] },
      { label: 'Ingresos', icon: 'pi pi-dollar', to: '/pos/ingresos', acceso: 'REPORTE', aliases: ['ingreso', 'entrada de dinero', 'ganancias'] },
      { label: 'Gastos', icon: 'pi pi-shopping-bag', to: '/pos/gastos', acceso: 'REPORTE || CAJERO', aliases: ['gasto', 'egreso', 'egresos', 'salida de dinero', 'registrar gasto'] },
    ],
  },
  { label: 'Planilla', icon: 'pi pi-users', to: '/pos/sueldos', acceso: 'CONFIG', aliases: ['sueldo', 'sueldos', 'empleado', 'empleados', 'personal'] },
  { label: 'Reportes', icon: 'pi pi-chart-bar', acceso: 'REPORTE' },
  { label: 'Diagnóstico', icon: 'pi pi-chart-line', to: '/pos/diagnostico', acceso: 'CONFIG', aliases: ['diagnostico empresarial', 'evaluacion', 'evaluar negocio'] },
  { label: 'Planes', icon: 'pi pi-bolt', to: '/pos/planes', acceso: 'CONFIG', aliases: ['plan', 'suscripcion', 'membresia'] },
  { label: 'Administración', icon: 'pi pi-shield', to: '/pos/admin/usuarios', acceso: 'CONFIG', superAdminOnly: true, aliases: ['administrar', 'usuarios', 'tiendas', 'soporte'], activePaths: ['/pos/admin/tiendas', '/pos/admin/usuarios'] },
]

// Módulos visibles según el rol/permiso de la sesión.
const visibleSidebarItems = computed(() => sidebarItems.filter(item =>
  puede(item.acceso) && (!item.superAdminOnly || isSuperAdmin.value),
))

const navigationQuery = ref('')
const navigationSearchFocused = ref(false)
const navigationMessage = ref('')
const isListening = ref(false)

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>
}

interface SpeechRecognitionErrorEventLike {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

let activeRecognition: SpeechRecognitionLike | undefined

const searchableSidebarItems = computed(() => visibleSidebarItems.value.flatMap((item) => {
  if (item.children) {
    return item.children.filter(child => puede(child.acceso) && child.to)
  }

  return item.to ? [item] : []
}))

function normalizeNavigationText(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(?:quiero|quisiera|necesito|puedes|podrias|por favor|llevame|llevarme|mandame|mandar|mostrar|muestra|abrir|abre|entrar|entra|navegar|dirigirme|ir|voy|vamos|hacia|hasta|a|al|el|la|los|las|un|una|de|del|seccion|modulo|pagina)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function navigationScore(item: SidebarItem, query: string) {
  const normalizedQuery = normalizeNavigationText(query)
  if (!normalizedQuery) {
    return 0
  }

  const terms = [item.label, ...(item.aliases ?? [])].map(normalizeNavigationText)
  let bestScore = 0

  for (const term of terms) {
    if (term === normalizedQuery) {
      bestScore = Math.max(bestScore, 100)
    } else if (normalizedQuery.includes(term)) {
      bestScore = Math.max(bestScore, 80 + Math.min(term.length, 15))
    } else if (term.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 60)
    } else {
      const queryWords = normalizedQuery.split(' ')
      const termWords = term.split(' ')
      const matches = queryWords.filter(word => termWords.some(termWord => termWord.startsWith(word) || word.startsWith(termWord)))
      if (matches.length) {
        bestScore = Math.max(bestScore, 30 + matches.length * 10)
      }
    }
  }

  return bestScore
}

const navigationMatches = computed(() => {
  if (!normalizeNavigationText(navigationQuery.value)) {
    return []
  }

  return searchableSidebarItems.value
    .map(item => ({ item, score: navigationScore(item, navigationQuery.value) }))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(match => match.item)
})

const showNavigationResults = computed(() => navigationSearchFocused.value && Boolean(navigationQuery.value.trim()))

function goToNavigationItem(item: SidebarItem) {
  if (!item.to) {
    return
  }

  navigationQuery.value = ''
  navigationMessage.value = ''
  navigationSearchFocused.value = false
  selectModule(item.to)
}

function submitNavigationQuery() {
  const [firstMatch] = navigationMatches.value
  if (firstMatch) {
    goToNavigationItem(firstMatch)
    return
  }

  navigationMessage.value = 'No encontré ese módulo'
}

function closeNavigationResults() {
  window.setTimeout(() => {
    navigationSearchFocused.value = false
  }, 140)
}

function stopListening() {
  activeRecognition?.stop()
}

async function requestMicrophonePermission() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    navigationMessage.value = 'El micrófono requiere HTTPS o localhost'
    return false
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      navigationMessage.value = 'Micrófono bloqueado. Habilítalo en el candado de la barra de direcciones'
    } else if (error instanceof DOMException && error.name === 'NotFoundError') {
      navigationMessage.value = 'No encontré un micrófono conectado'
    } else {
      navigationMessage.value = 'No pude acceder al micrófono'
    }
    return false
  }
}

async function toggleVoiceNavigation() {
  if (!import.meta.client) {
    return
  }

  if (isListening.value) {
    stopListening()
    return
  }

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

  if (!Recognition) {
    navigationMessage.value = 'Voz no disponible aquí; usa Chrome/Edge o escribe el módulo'
    return
  }

  navigationMessage.value = 'Solicitando acceso al micrófono…'
  const hasMicrophonePermission = await requestMicrophonePermission()
  if (!hasMicrophonePermission) {
    return
  }

  navigationMessage.value = 'Escuchando…'
  const recognition = new Recognition()
  activeRecognition = recognition
  recognition.lang = 'es-BO'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ''
    navigationQuery.value = transcript
    navigationSearchFocused.value = true
    navigationMessage.value = transcript ? `Escuché: “${transcript}”` : 'No pude entenderte'
    nextTick(() => submitNavigationQuery())
  }
  recognition.onerror = (event) => {
    navigationMessage.value = event.error === 'not-allowed'
      ? 'Necesito permiso para usar el micrófono'
      : 'No pude escuchar. Intenta nuevamente'
  }
  recognition.onend = () => {
    isListening.value = false
    activeRecognition = undefined
    if (navigationMessage.value === 'Escuchando…') {
      navigationMessage.value = 'No pude escuchar. Intenta nuevamente'
    }
  }

  isListening.value = true
  try {
    recognition.start()
  } catch {
    isListening.value = false
    activeRecognition = undefined
    navigationMessage.value = 'No pude activar el micrófono'
  }
}

// Bottom nav móvil: Inicio · Caja · [Ventas FAB] · Inventario · Más.
// Ventas es la acción principal, va en el FAB central elevado.
const bottomNavLeft = computed(() =>
  [
    { label: 'Inicio', icon: 'pi pi-home', to: '/pos/inicio' },
    { label: 'Caja', icon: 'pi pi-wallet', to: '/pos/caja', acceso: 'CAJA' },
  ].filter(item => puede(item.acceso))
)

const bottomNavRight = computed(() =>
  [
    { label: 'Inventario', icon: 'pi pi-box', to: '/pos/catalogo', acceso: 'INVENTARIO' },
  ].filter(item => puede(item.acceso))
)

const canSell = computed(() => puede('VENDER'))

const moreNavItems = computed(() => {
  const items: SidebarItem[] = [
    {
      label: 'Finanzas',
      icon: 'pi pi-chart-pie',
      to: puede('REPORTE') ? '/pos/finanzas' : '/pos/gastos',
      acceso: 'REPORTE || CAJERO',
    },
    { label: 'Marketing', icon: 'pi pi-megaphone', to: '/pos/marketing', acceso: 'CONFIG' },
    { label: 'Planilla', icon: 'pi pi-users', to: '/pos/sueldos', acceso: 'CONFIG' },
    { label: 'Diagnóstico', icon: 'pi pi-chart-line', to: '/pos/diagnostico', acceso: 'CONFIG' },
    { label: 'Planes', icon: 'pi pi-bolt', to: '/pos/planes', acceso: 'CONFIG' },
    { label: 'Administración', icon: 'pi pi-shield', to: '/pos/admin/usuarios', acceso: 'CONFIG', superAdminOnly: true },
  ]

  return items.filter(item => puede(item.acceso) && (!item.superAdminOnly || isSuperAdmin.value))
})

function isBottomNavActive(item: { to: string }) {
  if (item.to === '/pos/finanzas') {
    return ['/pos/finanzas', '/pos/ingresos', '/pos/gastos'].includes(route.path)
  }
  return route.path === item.to
}

const isSellActive = computed(() => route.path === '/pos')

// Acceso requerido por ruta, para bloquear navegación directa (URL) a un módulo
// sin permiso. Incluye la ruta principal y sus `activePaths`.
const accesoPorRuta = new Map<string, string | undefined>()
for (const item of sidebarItems) {
  const entradas = item.children ?? [item]
  for (const entrada of entradas) {
    if (entrada.to) {
      accesoPorRuta.set(entrada.to, entrada.acceso)
    }
    for (const path of entrada.activePaths ?? []) {
      accesoPorRuta.set(path, entrada.acceso)
    }
  }
}

function rutaPermitida(path: string) {
  if (path.startsWith('/pos/admin') && !isSuperAdmin.value) {
    return false
  }

  if (
    path === '/pos/diagnostico'
    && session.value?.storeId
    && session.value.onboardingDiagnostico !== 'completado'
  ) {
    return true
  }

  const acceso = accesoPorRuta.get(path)
  return acceso ? puede(acceso) : true
}

const activeTitle = computed(() => String(route.meta.posTitle ?? 'Ventas'))

const userInitials = computed(() => {
  const name = session.value?.store?.trim()
  if (!name) {
    return 'NX'
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
})

onMounted(() => {
  if (import.meta.client) {
    sidebarCollapsed.value = localStorage.getItem(SIDEBAR_KEY) === '1'
    const storedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    const savedWidth = storedWidth === null ? Number.NaN : Number(storedWidth)

    if (Number.isFinite(savedWidth)) {
      sidebarWidth.value = clampSidebarWidth(savedWidth)
    }

    removeRouteBeforeGuard = router.beforeEach((to) => {
      if (to.path.startsWith('/pos/admin')) {
        return isSuperAdmin.value ? undefined : '/pos/inicio'
      }

      // Bloqueo de onboarding: mientras el diagnóstico no esté completado, toda
      // la app queda bloqueada y se redirige al diagnóstico (obligatorio).
      if (
        session.value
        && session.value.storeId
        && session.value.onboardingDiagnostico !== 'completado'
        && to.path.startsWith('/pos')
        && to.path !== '/pos/diagnostico'
      ) {
        return '/pos/diagnostico'
      }

      // Bloqueo por rol/permiso: si el módulo destino requiere un acceso que la
      // sesión no cumple, se redirige a Inicio (siempre accesible).
      if (session.value && to.path.startsWith('/pos') && !rutaPermitida(to.path)) {
        return '/pos/inicio'
      }
    })
  }
})

onBeforeUnmount(() => {
  activeRecognition?.stop()

  removeRouteBeforeGuard?.()
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
  useCatalogStore().clear()
  useCashStore().clear()
  sessionStore.clear()
  void navigateTo('/login')
}

function isActive(item: { to?: string, activePaths?: string[] }) {
  return Boolean(item.to && (route.path === item.to || item.activePaths?.includes(route.path)))
}

// Grupos desplegables (p. ej. Finanzas). Mostramos solo los hijos permitidos.
function visibleChildren(item: SidebarItem) {
  return (item.children ?? []).filter(child => puede(child.acceso))
}

function isGroupActive(item: SidebarItem) {
  return visibleChildren(item).some(child => isActive(child))
}

// Modelo que consume PrimeVue PanelMenu: un nodo raíz (Finanzas) con sus hijos.
// `command` navega y `class` marca el hijo activo para pintarlo de verde.
function groupModel(item: SidebarItem): MenuItem[] {
  return [{
    key: item.label,
    label: item.label,
    icon: item.icon,
    items: visibleChildren(item).map(child => ({
      key: child.label,
      label: child.label,
      icon: child.icon,
      class: isActive(child) ? 'is-active' : undefined,
      command: () => selectModule(child.to),
    })),
  }]
}

// Finanzas inicia desplegado para que sus accesos estén visibles desde el primer
// ingreso. Después el usuario todavía puede cerrarlo manualmente.
const expandedKeys = ref<Record<string, boolean>>({ Finanzas: true })

watch(() => route.path, () => {
  for (const item of sidebarItems) {
    if (item.children && isGroupActive(item) && expandedKeys.value[item.label] === undefined) {
      expandedKeys.value = { ...expandedKeys.value, [item.label]: true }
    }
  }
}, { immediate: true })

function selectModule(to?: string) {
  mobileMenuOpen.value = false
  moreMenuOpen.value = false

  if (to) {
    void navigateTo(to)
  }
}
</script>

<template>
  <main
    class="pos-page"
    :class="{ 'is-collapsed': sidebarCollapsed, 'is-resizing-sidebar': isResizingSidebar }"
    :style="{
      '--sidebar-w': `${currentSidebarWidth}px`,
      '--sidebar-center-offset': `${currentSidebarWidth / 2}px`,
    }"
  >
    <Drawer v-model:visible="mobileMenuOpen" position="left" class="pos-drawer">
      <template #header>
        <div class="drawer-brand">
          <img src="/nexa-logo-white.webp" alt="" class="brand-logo" aria-hidden="true">
          <strong>NEXA</strong>
        </div>
      </template>

      <nav class="drawer-nav" aria-label="Navegación móvil del POS">
        <form class="navigation-command navigation-command--drawer" role="search" @submit.prevent="submitNavigationQuery">
          <div class="navigation-command__control">
            <i class="pi pi-search navigation-command__search-icon" aria-hidden="true" />
            <input
              v-model="navigationQuery"
              type="search"
              inputmode="search"
              autocomplete="off"
              placeholder="Ir a ventas, gastos..."
              aria-label="Buscar un módulo"
              @focus="navigationSearchFocused = true"
              @blur="closeNavigationResults"
              @input="navigationMessage = ''"
              @keydown.esc="navigationSearchFocused = false"
            >
            <button
              type="button"
              class="navigation-command__voice"
              :class="{ 'is-listening': isListening }"
              :aria-label="isListening ? 'Detener micrófono' : 'Buscar por voz'"
              :aria-pressed="isListening"
              @click="toggleVoiceNavigation"
            >
              <i :class="isListening ? 'pi pi-stop-circle' : 'pi pi-microphone'" aria-hidden="true" />
            </button>
          </div>
          <div v-if="showNavigationResults" class="navigation-command__results">
            <button
              v-for="match in navigationMatches"
              :key="match.to"
              type="button"
              @mousedown.prevent="goToNavigationItem(match)"
            >
              <i :class="match.icon" aria-hidden="true" />
              <span>{{ match.label }}</span>
            </button>
            <p v-if="!navigationMatches.length">No encontré ese módulo</p>
          </div>
          <small v-if="navigationMessage" class="navigation-command__message" role="status">{{ navigationMessage }}</small>
        </form>

        <template v-for="item in visibleSidebarItems" :key="item.label">
          <!-- Grupo desplegable (Finanzas: Resumen / Ingresos / Gastos) -->
          <PanelMenu
            v-if="item.children"
            :model="groupModel(item)"
            v-model:expandedKeys="expandedKeys"
            multiple
            class="sidebar-panelmenu drawer-panelmenu"
            :class="{ 'is-section-active': isGroupActive(item) }"
          />
          <!-- Item simple -->
          <Button
            v-else
            type="button"
            text
            :severity="isActive(item) ? 'success' : 'secondary'"
            :class="{ 'is-active': isActive(item), 'is-disabled': !item.to }"
            :icon="item.icon"
            :label="item.label"
            @click="selectModule(item.to)"
          />
        </template>
      </nav>

      <div class="drawer-support">
        <Button
          type="button"
          text
          severity="secondary"
          icon="pi pi-headphones"
          label="Soporte técnico"
          @click="openSupport"
        />
      </div>
    </Drawer>

    <aside class="app-sidebar" aria-label="Navegación principal">
      <div class="sidebar-head">
        <div class="sidebar-brand">
          <img src="/nexa-logo-white.webp" alt="" class="brand-logo" aria-hidden="true">
          <strong v-show="!sidebarCollapsed">NEXA</strong>
        </div>
        <Button
          type="button"
          class="sidebar-toggle"
          v-tooltip="{ value: sidebarCollapsed ? 'Expandir menú' : 'Replegar menú', showDelay: 150 }"
          :icon="sidebarCollapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
          :aria-label="sidebarCollapsed ? 'Expandir menú' : 'Replegar menú'"
          :aria-expanded="!sidebarCollapsed"
          aria-controls="pos-workspace"
          @click="toggleMenu"
        />
      </div>

      <nav class="sidebar-nav">
        <form class="navigation-command" role="search" @submit.prevent="submitNavigationQuery">
          <template v-if="!sidebarCollapsed">
            <div class="navigation-command__control">
              <i class="pi pi-search navigation-command__search-icon" aria-hidden="true" />
              <input
                v-model="navigationQuery"
                type="search"
                inputmode="search"
                autocomplete="off"
                placeholder="Ir a ventas, gastos..."
                aria-label="Buscar un módulo"
                @focus="navigationSearchFocused = true"
                @blur="closeNavigationResults"
                @input="navigationMessage = ''"
                @keydown.esc="navigationSearchFocused = false"
              >
              <button
                type="button"
                class="navigation-command__voice"
                :class="{ 'is-listening': isListening }"
                :aria-label="isListening ? 'Detener micrófono' : 'Buscar por voz'"
                :aria-pressed="isListening"
                @click="toggleVoiceNavigation"
              >
                <i :class="isListening ? 'pi pi-stop-circle' : 'pi pi-microphone'" aria-hidden="true" />
              </button>
            </div>
            <div v-if="showNavigationResults" class="navigation-command__results">
              <button
                v-for="match in navigationMatches"
                :key="match.to"
                type="button"
                @mousedown.prevent="goToNavigationItem(match)"
              >
                <i :class="match.icon" aria-hidden="true" />
                <span>{{ match.label }}</span>
              </button>
              <p v-if="!navigationMatches.length">No encontré ese módulo</p>
            </div>
            <small v-if="navigationMessage" class="navigation-command__message" role="status">{{ navigationMessage }}</small>
          </template>
          <button
            v-else
            type="button"
            class="navigation-command__collapsed-voice"
            :class="{ 'is-listening': isListening }"
            v-tooltip.right="isListening ? 'Detener micrófono' : 'Ir a un módulo por voz'"
            :aria-label="isListening ? 'Detener micrófono' : 'Ir a un módulo por voz'"
            :aria-pressed="isListening"
            @click="toggleVoiceNavigation"
          >
            <i :class="isListening ? 'pi pi-stop-circle' : 'pi pi-microphone'" aria-hidden="true" />
          </button>
        </form>

        <template v-for="item in visibleSidebarItems" :key="item.label">
          <!-- Grupo desplegable (Finanzas: Resumen / Ingresos / Gastos) -->
          <!-- Replegado: un solo ícono que lleva al primer hijo -->
          <Button
            v-if="item.children && sidebarCollapsed"
            type="button"
            text
            v-tooltip.right="item.label"
            :severity="isGroupActive(item) ? 'success' : 'secondary'"
            :class="{ 'is-active': isGroupActive(item) }"
            :icon="item.icon"
            @click="selectModule(visibleChildren(item)[0]?.to)"
          />
          <!-- Expandido: PanelMenu de PrimeVue (colapso + animación nativos) -->
          <PanelMenu
            v-else-if="item.children"
            :model="groupModel(item)"
            v-model:expandedKeys="expandedKeys"
            multiple
            class="sidebar-panelmenu"
            :class="{ 'is-section-active': isGroupActive(item) }"
          />
          <!-- Item simple -->
          <Button
            v-else
            type="button"
            text
            v-tooltip.right="sidebarCollapsed ? item.label : undefined"
            :severity="isActive(item) ? 'success' : 'secondary'"
            :class="{ 'is-active': isActive(item), 'is-disabled': !item.to }"
            :icon="item.icon"
            :label="sidebarCollapsed ? undefined : item.label"
            @click="selectModule(item.to)"
          />
        </template>
      </nav>

      <div class="sidebar-foot">
        <Button
          type="button"
          text
          v-tooltip.right="sidebarCollapsed ? 'Contactar soporte' : undefined"
          severity="secondary"
          class="sidebar-support-item"
          icon="pi pi-headphones"
          :label="sidebarCollapsed ? undefined : 'Contactar soporte'"
          @click="openSupport"
        />
      </div>
    </aside>

    <div
      class="sidebar-resizer"
      role="separator"
      aria-controls="pos-workspace"
      aria-label="Cambiar ancho del menú lateral"
      aria-orientation="vertical"
      :aria-valuemin="SIDEBAR_MIN_WIDTH"
      :aria-valuemax="SIDEBAR_MAX_WIDTH"
      :aria-valuenow="currentSidebarWidth"
      :aria-valuetext="sidebarCollapsed ? 'Menú replegado' : `${currentSidebarWidth} pixeles`"
      tabindex="0"
      title="Arrastra para cambiar el ancho. Doble click restaura el tamaño."
      @pointerdown="startSidebarResize"
      @dblclick="restoreSidebarWidth"
      @keydown="onSidebarResizeKeydown"
    />

    <section id="pos-workspace" class="pos-workspace">
      <header class="pos-topbar mb-2">
        <button
          type="button"
          class="mobile-menu-button"
          v-tooltip.bottom="{ value: 'Abrir menú', showDelay: 150 }"
          aria-label="Abrir menú"
          aria-controls="pos-workspace"
          :aria-expanded="mobileMenuOpen"
          @click="toggleMenu"
        >
          <i class="pi pi-bars" aria-hidden="true" />
        </button>
        <div class="topbar-title">
          <div class="topbar-title__text">
            <h1>{{ activeTitle }}</h1>
            <small v-if="session?.store">{{ session.store }}</small>
          </div>
        </div>

        <div class="topbar-actions">
          <span v-if="session?.store" class="topbar-location">
            <i class="pi pi-map-marker" aria-hidden="true" />
            <span>{{ session.store }}</span>
          </span>
          <Button type="button" text rounded icon="pi pi-bell" class="topbar-icon-btn" v-tooltip.bottom="{ value: 'Notificaciones', showDelay: 150 }" aria-label="Notificaciones" />
          <Button type="button" text rounded icon="pi pi-question-circle" class="topbar-icon-btn" v-tooltip.bottom="{ value: 'Ayuda', showDelay: 150 }" aria-label="Ayuda" />
          <Button type="button" text rounded icon="pi pi-shield" class="topbar-icon-btn" v-tooltip.bottom="{ value: 'Seguridad de la cuenta', showDelay: 150 }" aria-label="Seguridad de la cuenta" @click="openAccountSecurity" />
          <button type="button" class="user-chip" title="Configurar perfil del negocio" @click="openBusinessProfile">
            <span class="user-chip__avatar">{{ userInitials }}</span>
            <span class="user-chip__meta">
              <strong>{{ session?.store }}</strong>
              <small v-if="session?.role">{{ session.role }}</small>
            </span>
          </button>
          <Button type="button" text rounded icon="pi pi-sign-out" class="topbar-icon-btn" v-tooltip.bottom="{ value: 'Cerrar sesión', showDelay: 150 }" aria-label="Cerrar sesión" @click="logout" />
        </div>
      </header>

      <div
        class="pos-content-shell"
        :aria-busy="isRouteLoading ? 'true' : 'false'"
      >
        <slot />
        <PosLoadingState
          :visible="isRouteLoading"
          mode="overlay"
          label="Cargando sección"
          detail="Preparando la vista"
        />
      </div>
    </section>

    <PosBusinessProfileDialog v-if="puede('CONFIG')" />
    <PosAccountSecurityDialog />

    <!-- Bottom navigation (mobile only): Inicio · Caja · [Ventas] · Inventario · Más -->
    <nav class="pos-bottom-nav" aria-label="Accesos rápidos">
      <button
        v-for="item in bottomNavLeft"
        :key="item.to"
        type="button"
        class="bottom-nav-item"
        :class="{ 'is-active': isBottomNavActive(item) }"
        :aria-label="item.label"
        @click="selectModule(item.to)"
      >
        <i :class="item.icon" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </button>

      <!-- FAB central: Ventas (acción principal) -->
      <div v-if="canSell" class="bottom-nav-fab-slot">
        <button
          type="button"
          class="bottom-nav-fab"
          :class="{ 'is-active': isSellActive }"
          aria-label="Ventas"
          @click="selectModule('/pos')"
        >
          <i class="pi pi-shopping-cart" aria-hidden="true" />
        </button>
        <span class="bottom-nav-fab-label">Ventas</span>
      </div>

      <button
        v-for="item in bottomNavRight"
        :key="item.to"
        type="button"
        class="bottom-nav-item"
        :class="{ 'is-active': isBottomNavActive(item) }"
        :aria-label="item.label"
        @click="selectModule(item.to)"
      >
        <i :class="item.icon" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </button>

      <button
        type="button"
        class="bottom-nav-item"
        :class="{ 'is-active': moreMenuOpen }"
        aria-label="Más opciones"
        @click="moreMenuOpen = true"
      >
        <i class="pi pi-th-large" aria-hidden="true" />
        <span>Más</span>
      </button>
    </nav>

    <!-- More options bottom sheet (mobile only) -->
    <Drawer v-model:visible="moreMenuOpen" position="bottom" class="pos-more-drawer">
      <template #header>
        <span class="more-drawer-title">Más opciones</span>
      </template>
      <div class="more-drawer-grid">
        <button
          v-for="item in moreNavItems"
          :key="item.to"
          type="button"
          class="more-drawer-item"
          :class="{ 'is-active': isActive(item) }"
          @click="selectModule(item.to)"
        >
          <span class="more-drawer-icon">
            <i :class="item.icon" aria-hidden="true" />
          </span>
          <span class="more-drawer-label">{{ item.label }}</span>
        </button>
        <button
          v-if="puede('HARU')"
          type="button"
          class="more-drawer-item more-drawer-item--haru"
          @click="moreMenuOpen = false; openHaru()"
        >
          <span class="more-drawer-icon more-drawer-icon--haru">
            <img src="/haru-chat.png" alt="" aria-hidden="true" class="more-drawer-haru-img" />
          </span>
          <span class="more-drawer-label">Haru IA</span>
        </button>
        <button
          type="button"
          class="more-drawer-item"
          @click="openAccountSecurity"
        >
          <span class="more-drawer-icon">
            <i class="pi pi-shield" aria-hidden="true" />
          </span>
          <span class="more-drawer-label">Seguridad</span>
        </button>
        <button
          type="button"
          class="more-drawer-item more-drawer-item--logout"
          @click="logout"
        >
          <span class="more-drawer-icon">
            <i class="pi pi-sign-out" aria-hidden="true" />
          </span>
          <span class="more-drawer-label">Cerrar sesión</span>
        </button>
      </div>
    </Drawer>

    <Dialog
      v-model:visible="supportDialogOpen"
      modal
      dismissable-mask
      :draggable="false"
      class="support-dialog"
      :style="{ width: 'min(92vw, 430px)' }"
    >
      <template #header>
        <div class="support-dialog__header">
          <span class="support-dialog__icon" aria-hidden="true">
            <i class="pi pi-headphones" />
          </span>
          <div>
            <span>Estamos para ayudarte</span>
            <h2>Soporte técnico NEXA</h2>
          </div>
        </div>
      </template>

      <div class="support-dialog__content">
        <p>¿Tienes alguna duda o inconveniente? Escríbenos por WhatsApp y te ayudaremos con tu cuenta o el uso de la plataforma.</p>

        <div class="support-dialog__phone">
          <label for="support-phone">Número de atención</label>
          <SharedPhoneCountryInput
            :country-dial-code="SUPPORT_COUNTRY_DIAL_CODE"
            :phone="SUPPORT_PHONE"
            input-id="support-phone"
            name="support-phone"
            readonly
          />
          <small><i class="pi pi-clock" aria-hidden="true" /> Atención directa por WhatsApp</small>
        </div>

        <a
          :href="SUPPORT_WHATSAPP_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="support-dialog__action"
        >
          <i class="pi pi-whatsapp" aria-hidden="true" />
          Escribir a soporte
          <i class="pi pi-arrow-up-right" aria-hidden="true" />
        </a>
      </div>
    </Dialog>
  </main>

</template>

<style scoped>
.pos-page {
  --sidebar-w: 250px;
  /* Alto del menú inferior móvil; 0 en desktop/tablet (nav oculto). Lo consume
     la vista de Ventas para apilar su barra de carrito por encima del menú. */
  --pos-bottom-nav-h: 0px;
  position: relative;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  background: #f3f4f6;
  color: #071327;
  transition: grid-template-columns 0.22s ease;
}

.pos-page.is-collapsed {
  --sidebar-w: 76px;
}

.app-sidebar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  height: 100dvh;
  grid-template-rows: auto 1fr auto;
  padding: 14px 10px 14px;
  border-right: 1px solid #0a3a18;
  background: linear-gradient(185deg, #063718 0%, #04250e 60%, #031f0b 100%);
  box-shadow: 10px 0 28px rgba(3, 24, 9, 0.18);
  overflow: hidden;
}

.sidebar-resizer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: calc(var(--sidebar-w) - 5px);
  z-index: 30;
  width: 10px;
  cursor: col-resize;
  touch-action: none;
  outline: 0;
}

.sidebar-resizer::before {
  content: "";
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 4px;
  width: 2px;
  border-radius: 999px;
  background: transparent;
  transition:
    width 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.sidebar-resizer:hover::before,
.sidebar-resizer:focus-visible::before,
.is-resizing-sidebar .sidebar-resizer::before {
  width: 3px;
  background: #12b886;
  box-shadow: 0 0 0 4px rgba(18, 184, 134, 0.14);
}

.sidebar-resizer:focus-visible::before {
  background: #008060;
}

.pos-page.is-resizing-sidebar {
  user-select: none;
  transition: none;
}

.pos-page.is-resizing-sidebar .app-sidebar,
.pos-page.is-resizing-sidebar .pos-workspace {
  pointer-events: none;
}

:global(body.is-resizing-pos-sidebar) {
  cursor: col-resize;
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 20px;
  padding: 0 2px;
}

.sidebar-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  color: #ffffff;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.12rem;
  font-weight: 900;
}

.brand-logo {
  height: 1.7em;
  width: auto;
  flex: 0 0 auto;
  object-fit: contain;
}

.drawer-brand .brand-logo {
  height: 1.6em;
}

.sidebar-toggle {
  flex: 0 0 auto;
  width: 30px !important;
  height: 30px !important;
  border-radius: 9px !important;
  color: rgba(255, 255, 255, 0.82) !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.sidebar-toggle:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.32) !important;
}

.sidebar-toggle:focus-visible {
  outline: 2px solid var(--primary-300) !important;
  outline-offset: 2px;
}

.is-collapsed .sidebar-head {
  flex-direction: column;
  gap: 12px;
}

.sidebar-nav {
  display: grid;
  align-content: start;
  gap: 5px;
  width: 100%;
  min-height: 0;
  padding-right: 2px;
  overflow-y: auto;
}

.navigation-command {
  position: relative;
  width: 100%;
  margin-bottom: 7px;
}

.navigation-command__control {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 34px;
  align-items: center;
  min-height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.navigation-command__control:focus-within {
  border-color: rgba(110, 231, 183, 0.72);
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 0 0 3px rgba(18, 184, 134, 0.14);
}

.navigation-command__search-icon {
  padding-left: 8px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.72rem;
}

.navigation-command input {
  min-width: 0;
  width: 100%;
  height: 36px;
  padding: 0 4px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #ffffff;
  font: inherit;
  font-size: 0.73rem;
  font-weight: 650;
}

.navigation-command input::placeholder {
  color: rgba(255, 255, 255, 0.58);
}

.navigation-command input::-webkit-search-cancel-button {
  display: none;
}

.navigation-command__voice,
.navigation-command__collapsed-voice {
  display: grid;
  place-items: center;
  border: 0;
  color: rgba(255, 255, 255, 0.84);
  background: transparent;
  cursor: pointer;
  transition: color 0.16s ease, background 0.16s ease, transform 0.16s ease;
}

.navigation-command__voice {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.navigation-command__voice:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.13);
}

.navigation-command__voice:focus-visible,
.navigation-command__collapsed-voice:focus-visible {
  outline: 2px solid #6ee7b7;
  outline-offset: 2px;
}

.navigation-command__voice.is-listening,
.navigation-command__collapsed-voice.is-listening {
  color: #ffffff;
  background: #e53e3e;
  animation: navigation-listening-pulse 1.25s ease-in-out infinite;
}

.navigation-command__results {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  z-index: 50;
  display: grid;
  width: 100%;
  padding: 5px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.25);
}

.navigation-command__results button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 34px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  color: #163424;
  background: transparent;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 750;
  text-align: left;
  cursor: pointer;
}

.navigation-command__results button:hover,
.navigation-command__results button:focus-visible {
  outline: 0;
  color: #075c28;
  background: #edfdf5;
}

.navigation-command__results p {
  margin: 0;
  padding: 9px;
  color: #64748b;
  font-size: 0.75rem;
}

.navigation-command__message {
  display: block;
  padding: 5px 4px 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.66rem;
  line-height: 1.25;
}

.navigation-command__collapsed-voice {
  width: 42px;
  height: 38px;
  margin: 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
}

.navigation-command__collapsed-voice:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
}

.navigation-command--drawer {
  margin-bottom: 12px;
}

.navigation-command--drawer .navigation-command__control {
  border-color: #d7e2da;
  background: #f5f8f6;
}

.navigation-command--drawer .navigation-command__control:focus-within {
  border-color: var(--primary-500);
  background: #ffffff;
}

.navigation-command--drawer .navigation-command__search-icon,
.navigation-command--drawer input::placeholder {
  color: #718078;
}

.navigation-command--drawer input {
  color: #163424;
}

.navigation-command--drawer .navigation-command__voice {
  color: #385647;
}

.navigation-command--drawer .navigation-command__voice:hover {
  color: var(--primary-700);
  background: #e7f8ee;
}

.navigation-command--drawer .navigation-command__message {
  color: #64748b;
}

@keyframes navigation-listening-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.35); }
  50% { box-shadow: 0 0 0 5px rgba(229, 62, 62, 0); }
}

.sidebar-nav :deep(.p-button),
.drawer-nav :deep(.p-button),
.sidebar-support-item {
  justify-content: flex-start;
  width: 100%;
  min-height: 31px;
  padding: 0 8px !important;
  border-radius: 8px !important;
  font-size: 0.82rem !important;
  font-weight: 800 !important;
}

/* --- Items del sidebar (fondo verde oscuro -> texto claro) --- */
.sidebar-nav :deep(.p-button),
.sidebar-support-item {
  color: rgba(255, 255, 255, 0.82) !important;
}

.sidebar-nav :deep(.p-button:not(.is-disabled):hover),
.sidebar-support-item:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.sidebar-nav :deep(.p-button.is-active) {
  color: #ffffff !important;
  background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%) !important;
  box-shadow: 0 8px 16px rgba(3, 24, 9, 0.4) !important;
}

.sidebar-nav :deep(.p-button.is-active:hover) {
  color: #ffffff !important;
  background: linear-gradient(135deg, var(--primary-400) 0%, var(--primary-600) 100%) !important;
}

.sidebar-nav :deep(.p-button.is-disabled) {
  opacity: 0.42;
  cursor: default;
}

.sidebar-nav :deep(.p-button.is-disabled:hover) {
  color: rgba(255, 255, 255, 0.82) !important;
  background: transparent !important;
}

/* --- Items del drawer móvil (fondo blanco -> texto oscuro) --- */
.drawer-nav :deep(.p-button) {
  color: #203049 !important;
}

.drawer-nav :deep(.p-button:not(.is-disabled):hover) {
  color: var(--primary-700) !important;
  background: #edfdf5 !important;
}

.drawer-nav :deep(.p-button.is-active) {
  color: #ffffff !important;
  background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%) !important;
  box-shadow: 0 8px 16px rgba(10, 111, 31, 0.24) !important;
}

.drawer-nav :deep(.p-button.is-disabled) {
  opacity: 0.48;
  cursor: default;
}

.drawer-nav :deep(.p-button.is-disabled:hover) {
  color: #203049 !important;
  background: transparent !important;
}

/* --- Grupo desplegable con PrimeVue PanelMenu (Finanzas) --- */
/* Quitamos fondos/bordes/padding del preset para que se funda con el sidebar. */
.sidebar-panelmenu,
.sidebar-panelmenu :deep(.p-panelmenu-panel),
.sidebar-panelmenu :deep(.p-panelmenu-content) {
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
}

/* Los wrappers -content traen su propio hover claro del preset: lo anulamos,
   así el estado (hover/activo) lo lleva solo el -link de abajo. */
.sidebar-panelmenu :deep(.p-panelmenu-header-content),
.sidebar-panelmenu :deep(.p-panelmenu-header-content:hover),
.sidebar-panelmenu :deep(.p-panelmenu-item-content),
.sidebar-panelmenu :deep(.p-panelmenu-item-content:hover) {
  background: transparent !important;
  border: 0 !important;
}

/* Cabecera e ítems con el mismo aspecto que los demás botones del nav. */
.sidebar-panelmenu :deep(.p-panelmenu-header-link),
.sidebar-panelmenu :deep(.p-panelmenu-item-link) {
  min-height: 31px;
  gap: 8px;
  padding: 0 8px !important;
  border-radius: 8px !important;
  font-size: 0.82rem !important;
  font-weight: 800 !important;
  transition: background 0.15s ease, color 0.15s ease;
}

/* Mismo tono que los <Button> del nav: Aura pinta los spans de ícono/label con
   su color "muted" propio, así que forzamos el color en TODOS los elementos. */
.sidebar-panelmenu :deep(.p-panelmenu-header-link),
.sidebar-panelmenu :deep(.p-panelmenu-header-icon),
.sidebar-panelmenu :deep(.p-panelmenu-header-label),
.sidebar-panelmenu :deep(.p-panelmenu-submenu-icon),
.sidebar-panelmenu :deep(.p-panelmenu-item-link),
.sidebar-panelmenu :deep(.p-panelmenu-item-icon),
.sidebar-panelmenu :deep(.p-panelmenu-item-label) {
  color: rgba(255, 255, 255, 0.82) !important;
}

.sidebar-panelmenu :deep(.p-panelmenu-header-content:hover) *,
.sidebar-panelmenu :deep(.p-panelmenu-item-content:hover) * {
  color: #ffffff !important;
}

.sidebar-panelmenu :deep(.p-panelmenu-header-link:hover),
.sidebar-panelmenu :deep(.p-panelmenu-item-link:hover) {
  background: rgba(255, 255, 255, 0.1) !important;
}

/* El chevron (PrimeVue alterna right/down) va a la derecha. */
.sidebar-panelmenu :deep(.p-panelmenu-header-icon) {
  order: 0;
}
.sidebar-panelmenu :deep(.p-panelmenu-header-label) {
  order: 1;
}
.sidebar-panelmenu :deep(.p-panelmenu-submenu-icon) {
  order: 2;
  width: 0.85rem;
  height: 0.85rem;
  margin-left: auto;
}

/* Padre con una ruta hija activa: solo texto blanco, sin relleno. */
.sidebar-panelmenu.is-section-active :deep(.p-panelmenu-header-link),
.sidebar-panelmenu.is-section-active :deep(.p-panelmenu-header-icon),
.sidebar-panelmenu.is-section-active :deep(.p-panelmenu-header-label),
.sidebar-panelmenu.is-section-active :deep(.p-panelmenu-submenu-icon) {
  color: #ffffff !important;
}

/* Submenú indentado con guía vertical a la izquierda. */
.sidebar-panelmenu :deep(.p-panelmenu-root-list) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 5px 0 0 16px;
  padding-left: 9px;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  list-style: none;
}

.sidebar-panelmenu :deep(.p-panelmenu-item-link) {
  min-height: 29px;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
}

/* Hijo activo: la pastilla verde (mismo gradiente que el resto). */
.sidebar-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-link),
.sidebar-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-icon),
.sidebar-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-label) {
  color: #ffffff !important;
}
.sidebar-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-link) {
  background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%) !important;
  box-shadow: 0 8px 16px rgba(3, 24, 9, 0.4) !important;
}

/* --- Variante del drawer móvil (fondo claro -> texto oscuro) --- */
.drawer-panelmenu :deep(.p-panelmenu-header-link),
.drawer-panelmenu :deep(.p-panelmenu-header-icon),
.drawer-panelmenu :deep(.p-panelmenu-header-label),
.drawer-panelmenu :deep(.p-panelmenu-submenu-icon),
.drawer-panelmenu :deep(.p-panelmenu-item-link),
.drawer-panelmenu :deep(.p-panelmenu-item-icon),
.drawer-panelmenu :deep(.p-panelmenu-item-label) {
  color: #203049 !important;
}

.drawer-panelmenu :deep(.p-panelmenu-header-content:hover) *,
.drawer-panelmenu :deep(.p-panelmenu-item-content:hover) * {
  color: var(--primary-700) !important;
}

.drawer-panelmenu :deep(.p-panelmenu-header-link:hover),
.drawer-panelmenu :deep(.p-panelmenu-item-link:hover) {
  background: #edfdf5 !important;
}

.drawer-panelmenu.is-section-active :deep(.p-panelmenu-header-link),
.drawer-panelmenu.is-section-active :deep(.p-panelmenu-header-icon),
.drawer-panelmenu.is-section-active :deep(.p-panelmenu-header-label),
.drawer-panelmenu.is-section-active :deep(.p-panelmenu-submenu-icon) {
  color: var(--primary-700) !important;
}

.drawer-panelmenu :deep(.p-panelmenu-root-list) {
  border-left-color: rgba(32, 48, 73, 0.16);
}

.drawer-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-link),
.drawer-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-icon),
.drawer-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-label) {
  color: #ffffff !important;
}
.drawer-panelmenu :deep(.p-panelmenu-item.is-active > .p-panelmenu-item-content .p-panelmenu-item-link) {
  background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%) !important;
  box-shadow: 0 8px 16px rgba(10, 111, 31, 0.24) !important;
}

/* --- Item de soporte al final --- */
.sidebar-foot {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-support-item {
  min-height: 38px !important;
}

.sidebar-support-item:hover {
  color: #ffffff !important;
  background: rgba(242, 194, 0, 0.14) !important;
}

.drawer-support {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e4e9e6;
}

.drawer-support :deep(.p-button) {
  width: 100%;
  justify-content: flex-start;
  color: #0b1f3a;
}

:global(.support-dialog.p-dialog) {
  overflow: hidden;
  border: 1px solid rgba(11, 31, 58, 0.08);
  border-radius: 24px;
  box-shadow: 0 26px 70px rgba(6, 25, 15, 0.24);
}

:global(.support-dialog .p-dialog-header) {
  padding: 24px 24px 14px;
  background: linear-gradient(145deg, #f7fbf8 0%, #ffffff 72%);
}

:global(.support-dialog .p-dialog-content) {
  padding: 0 24px 24px;
  background: #ffffff;
}

.support-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.support-dialog__icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 16px;
  color: #ffffff;
  background: linear-gradient(145deg, #0b982f, #086b24);
  box-shadow: 0 10px 24px rgba(11, 152, 47, 0.23);
  font-size: 1.2rem;
}

.support-dialog__header span:not(.support-dialog__icon) {
  display: block;
  margin-bottom: 3px;
  color: #6d7b72;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.support-dialog__header h2 {
  margin: 0;
  color: #0b1f3a;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.15rem;
  font-weight: 900;
}

.support-dialog__content > p {
  margin: 0 0 20px;
  color: #526057;
  line-height: 1.65;
}

.support-dialog__phone label {
  display: block;
  margin-bottom: 8px;
  color: #25372c;
  font-size: 0.82rem;
  font-weight: 800;
}

.support-dialog__phone small {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: #748077;
  font-size: 0.76rem;
}

.support-dialog__action {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
  border-radius: 14px;
  color: #ffffff;
  background: #087a28;
  box-shadow: 0 10px 22px rgba(8, 122, 40, 0.2);
  font-weight: 850;
  text-decoration: none;
  transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.support-dialog__action .pi-arrow-up-right {
  margin-left: auto;
  margin-right: 16px;
  font-size: 0.78rem;
  opacity: 0.74;
}

.support-dialog__action .pi-whatsapp {
  margin-left: auto;
  font-size: 1.1rem;
}

.support-dialog__action:hover {
  color: #ffffff;
  background: #096b26;
  box-shadow: 0 14px 28px rgba(8, 122, 40, 0.25);
  transform: translateY(-1px);
}

.support-dialog__action:focus-visible {
  outline: 3px solid rgba(242, 194, 0, 0.55);
  outline-offset: 3px;
}

.is-collapsed .sidebar-foot {
  justify-items: center;
  display: grid;
}

.is-collapsed .sidebar-support-item {
  width: 44px !important;
  justify-content: center !important;
  padding: 0 !important;
}

.is-collapsed .sidebar-support-item :deep(.p-button-icon) {
  margin: 0;
}

.is-collapsed .sidebar-nav {
  justify-items: center;
}

.is-collapsed .sidebar-nav :deep(.p-button) {
  width: 44px;
  justify-content: center;
  padding: 0 !important;
}

.is-collapsed .sidebar-nav :deep(.p-button .p-button-icon) {
  margin: 0;
}

.pos-workspace {
  min-width: 0;
  padding: 16px 14px 24px 20px;
  overflow-x: hidden;
}

.pos-topbar {
  position: relative;
  display: flex;
  min-height: 66px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 18px;
  border-radius: 16px;
  background: #ffffff;
  color: #0f1f17;
  border: 1px solid #e4ebe6;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.pos-content-shell {
  position: relative;
  min-height: calc(100dvh - 122px);
}

.pos-topbar > div,
.drawer-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.topbar-title__text {
  display: grid;
  gap: 1px;
  line-height: 1.1;
}

.pos-topbar h1 {
  margin: 0;
  font-size: 1.22rem;
  font-weight: 900;
  letter-spacing: 0.01em;
}

.pos-topbar h1 {
  color: #0f1f17;
}

.topbar-title__text small {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--primary-700);
}

.topbar-location {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid #e0e8e2;
  background: var(--primary-50);
  color: var(--primary-800);
  font-size: 0.78rem;
  font-weight: 800;
}

.topbar-location i {
  color: var(--primary-600);
  font-size: 0.85rem;
}

.topbar-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 5px 14px 5px 5px;
  border-radius: 999px;
  background: #f1f5f2;
  border: 1px solid #e4ebe6;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.user-chip:hover { border-color: #b9d0c1; background: #eaf6ed; }

.user-chip__avatar {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-700));
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.user-chip__meta {
  display: grid;
  gap: 1px;
  line-height: 1.05;
}

.user-chip__meta strong {
  font-size: 0.84rem;
  font-weight: 800;
  color: #0f1f17;
}

.user-chip__meta small {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: capitalize;
  color: var(--primary-700);
}

.topbar-actions :deep(.p-button) {
  width: 2.4rem;
  height: 2.4rem;
  color: #46555c !important;
  background: #f1f5f2 !important;
  border: 1px solid #e4ebe6 !important;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.topbar-actions :deep(.p-button:hover) {
  color: var(--primary-700) !important;
  background: var(--primary-50) !important;
  transform: translateY(-1px);
}

.mobile-menu-button {
  display: none !important;
  width: 2.4rem !important;
  height: 2.4rem !important;
  place-items: center;
  appearance: none;
  border-radius: 11px !important;
  color: #46555c !important;
  background: #f1f5f2 !important;
  border: 1px solid #e4ebe6 !important;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.mobile-menu-button:hover {
  color: var(--primary-700) !important;
  background: var(--primary-50) !important;
}

.mobile-menu-button:focus-visible {
  outline: 2px solid var(--primary-300) !important;
  outline-offset: 2px;
}

.drawer-brand {
  color: #071327;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.1rem;
  font-weight: 900;
}

.drawer-nav {
  display: grid;
  gap: 6px;
  padding-top: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .bottom-nav-fab,
  .bottom-nav-fab i {
    transition: none;
  }
}

@media (max-width: 1120px) {
  .pos-page {
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .pos-page {
    grid-template-columns: 1fr;
    padding: 8px 8px 0;
    --pos-bottom-nav-h: calc(60px + env(safe-area-inset-bottom, 0px));
  }

  .app-sidebar {
    display: none;
  }

  .sidebar-resizer {
    display: none;
  }

  .mobile-menu-button {
    display: none !important;
  }

  /* Header oculto en mobile — bottom nav lo reemplaza */
  .pos-topbar {
    display: none;
  }

  /* Espacio inferior para no quedar detrás del bottom nav */
  .pos-workspace {
    padding-bottom: var(--pos-bottom-nav-h);
    padding-top: 0;
  }

  .pos-content-shell {
    min-height: calc(100dvh - 76px);
  }
}

/* ─── Bottom nav ─────────────────────────────────────────────────── */
.pos-bottom-nav {
  display: none;
}

@media (max-width: 760px) {
  .pos-bottom-nav {
    display: flex;
    align-items: stretch;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    background: #ffffff;
    border-top: 1px solid #e4ebe6;
    box-shadow: 0 -4px 20px rgba(11, 31, 58, 0.09);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    /* el FAB central sobresale por encima del borde superior */
    overflow: visible;
  }

  .bottom-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 10px 4px;
    min-height: 60px;
    background: none;
    border: none;
    cursor: pointer;
    color: #9aabb5;
    transition: color 0.15s ease;
  }

  .bottom-nav-item i {
    font-size: 1.3rem;
    line-height: 1;
    transition: transform 0.15s ease;
  }

  .bottom-nav-item span {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1;
    white-space: nowrap;
  }

  .bottom-nav-item.is-active {
    color: var(--primary-600);
  }

  .bottom-nav-item.is-active i {
    transform: translateY(-2px);
  }

  .bottom-nav-item:hover {
    color: var(--primary-500);
  }

  /* ── FAB central: Ventas ───────────────────────────────────────── */
  .bottom-nav-fab-slot {
    position: relative;
    flex: 1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-height: 60px;
    padding-bottom: 8px;
  }

  .bottom-nav-fab {
    position: absolute;
    top: -24px;
    left: 50%;
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    /* el aro blanco lo funde con la barra (efecto "encastrado") */
    border: 4px solid #ffffff;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-400) 0%, var(--primary-600) 100%);
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(15, 158, 46, 0.42);
    transform: translateX(-50%);
    /* el anclaje (top/tamaño) va lento y con resorte; el feedback táctil rápido */
    transition:
      top 0.34s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.34s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.34s cubic-bezier(0.22, 1, 0.36, 1),
      border-width 0.34s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.16s ease,
      box-shadow 0.28s ease,
      filter 0.16s ease;
  }

  .bottom-nav-fab i {
    font-size: 1.5rem;
    line-height: 1;
    transition: font-size 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .bottom-nav-fab:hover {
    transform: translateX(-50%) translateY(-3px);
    box-shadow: 0 14px 28px rgba(15, 158, 46, 0.5);
    filter: brightness(1.04);
  }

  .bottom-nav-fab:focus-visible {
    outline: 3px solid var(--primary-200);
    outline-offset: 3px;
  }

  /* En la página de Ventas el FAB baja al nivel de los demás ítems para no
     chocar con la barra del carrito, pero conserva su círculo verde. */
  .bottom-nav-fab.is-active {
    top: 6px;
    width: 40px;
    height: 40px;
    border-width: 0;
    box-shadow: 0 4px 12px rgba(15, 158, 46, 0.32);
  }

  .bottom-nav-fab.is-active i {
    font-size: 1.15rem;
  }

  .bottom-nav-fab.is-active:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 7px 16px rgba(15, 158, 46, 0.4);
  }

  .bottom-nav-fab-label {
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1;
    color: var(--primary-600);
  }
}

/* ─── More drawer ─────────────────────────────────────────────────
   El Drawer se teleporta al <body> vía Portal, así que los estilos
   scoped con :deep() no llegan. Los estilos reales están en el bloque
   <style> global al final del archivo.
──────────────────────────────────────────────────────────────────── */

.more-drawer-title {
  font-size: 1rem;
  font-weight: 800;
  color: #0f1f17;
}

.more-drawer-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 4px 0 8px;
}

.more-drawer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 14px 8px;
  border-radius: 14px;
  background: #f5f7f6;
  border: 1px solid #e8eee9;
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease;
}

.more-drawer-item:hover {
  background: #edfdf5;
  border-color: var(--primary-200);
}

.more-drawer-item.is-active {
  background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-700) 100%);
  border-color: transparent;
}

.more-drawer-item.is-active .more-drawer-icon,
.more-drawer-item.is-active .more-drawer-label {
  color: #ffffff;
}

.more-drawer-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--primary-700);
  font-size: 1.15rem;
}

.more-drawer-item.is-active .more-drawer-icon {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.more-drawer-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #203049;
  letter-spacing: 0.01em;
  text-align: center;
  line-height: 1.2;
}

.more-drawer-item--logout .more-drawer-icon {
  color: #c0392b;
}

.more-drawer-item--logout .more-drawer-label {
  color: #c0392b;
}

.more-drawer-item--logout:hover {
  background: #fff5f5;
  border-color: #f5c6c6;
}

.more-drawer-icon--haru {
  background: linear-gradient(135deg, #e8f5fe 0%, #d0eaff 100%);
}

.more-drawer-haru-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.more-drawer-item--haru:hover {
  background: #edf6ff;
  border-color: #b3d9ff;
}

</style>

<!-- Global: el Drawer se teleporta al <body>, los scoped no aplican -->
<style>
/* PrimeVue hardcodea height: 10rem en .p-drawer-bottom .p-drawer.
   Estos overrides globales lo convierten en auto-height con límite. */
.pos-more-drawer {
  height: auto !important;
  max-height: 80vh !important;
  border-radius: 20px 20px 0 0 !important;
}

.pos-more-drawer .p-drawer-content {
  /* flex-grow: 1 + height: 100% del preset → quita la altura fija */
  height: auto !important;
  flex: 0 0 auto !important;
  overflow-y: auto;
}
</style>
