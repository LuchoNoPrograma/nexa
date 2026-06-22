<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'

const route = useRoute()
const router = useRouter()
const session = usePosSession()
const sessionStore = useSessionStore()
const { puede } = useAcceso()
const { open: openHaru } = useHaruChat()
const isReady = ref(false)
const isRouteLoading = ref(false)
const mobileMenuOpen = ref(false)
const moreMenuOpen = ref(false)
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
const ROUTE_LOADING_MIN_MS = 240

let routeLoadingStartedAt = 0
let routeLoadingTimer: ReturnType<typeof setTimeout> | undefined
let removeRouteBeforeGuard: (() => void) | undefined
let removeRouteAfterGuard: (() => void) | undefined
let removeRouteErrorGuard: (() => void) | undefined

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

// `acceso` es una expresión que evalúa `tieneAcceso`. Un cajero solo cumple
// CAJA y VENDER, así que ve únicamente esos módulos (más Inicio, sin gating).
interface SidebarItem {
  label: string
  icon: string
  to?: string
  acceso?: string
  activePaths?: string[]
  children?: SidebarItem[]
}

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', icon: 'pi pi-home', to: '/pos/inicio' },
  { label: 'Caja', icon: 'pi pi-wallet', to: '/pos/caja', acceso: 'CAJA' },
  { label: 'Ventas', icon: 'pi pi-shopping-cart', to: '/pos', acceso: 'VENDER' },
  { label: 'Marketing', icon: 'pi pi-megaphone', to: '/pos/marketing', acceso: 'CONFIG' },
  { label: 'Inventario', icon: 'pi pi-box', to: '/pos/catalogo', acceso: 'INVENTARIO' },
  {
    label: 'Finanzas',
    icon: 'pi pi-chart-pie',
    acceso: 'REPORTE',
    children: [
      { label: 'Resumen financiero', icon: 'pi pi-chart-pie', to: '/pos/finanzas', acceso: 'REPORTE' },
      { label: 'Ingresos', icon: 'pi pi-dollar', to: '/pos/ingresos', acceso: 'REPORTE' },
      { label: 'Gastos', icon: 'pi pi-shopping-bag', to: '/pos/gastos', acceso: 'REPORTE' },
    ],
  },
  { label: 'Planilla', icon: 'pi pi-users', to: '/pos/sueldos', acceso: 'CONFIG' },
  { label: 'Reportes', icon: 'pi pi-chart-bar', acceso: 'REPORTE' },
  { label: 'Diagnóstico', icon: 'pi pi-chart-line', to: '/pos/diagnostico', acceso: 'CONFIG' },
  { label: 'Planes', icon: 'pi pi-bolt', to: '/pos/planes', acceso: 'CONFIG' },
  { label: 'Configuración', icon: 'pi pi-cog', to: '/pos/admin/tiendas', acceso: 'CONFIG', activePaths: ['/pos/admin/tiendas', '/pos/admin/usuarios'] },
]

// Módulos visibles según el rol/permiso de la sesión.
const visibleSidebarItems = computed(() => sidebarItems.filter(item => puede(item.acceso)))

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

const moreNavItems = computed(() =>
  [
    { label: 'Finanzas', icon: 'pi pi-chart-pie', to: '/pos/finanzas', acceso: 'REPORTE' },
    { label: 'Marketing', icon: 'pi pi-megaphone', to: '/pos/marketing', acceso: 'CONFIG' },
    { label: 'Planilla', icon: 'pi pi-users', to: '/pos/sueldos', acceso: 'CONFIG' },
    { label: 'Diagnóstico', icon: 'pi pi-chart-line', to: '/pos/diagnostico', acceso: 'CONFIG' },
    { label: 'Planes', icon: 'pi pi-bolt', to: '/pos/planes', acceso: 'CONFIG' },
    { label: 'Configuración', icon: 'pi pi-cog', to: '/pos/admin/tiendas', acceso: 'CONFIG' },
  ].filter(item => puede(item.acceso))
)

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
  const name = session.value?.name?.trim()
  if (!name) {
    return 'NX'
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
})

function startRouteLoading() {
  if (routeLoadingTimer) {
    clearTimeout(routeLoadingTimer)
    routeLoadingTimer = undefined
  }

  routeLoadingStartedAt = Date.now()
  isRouteLoading.value = true
}

function finishRouteLoading() {
  const elapsed = Date.now() - routeLoadingStartedAt
  const remaining = Math.max(0, ROUTE_LOADING_MIN_MS - elapsed)

  if (routeLoadingTimer) {
    clearTimeout(routeLoadingTimer)
  }

  routeLoadingTimer = setTimeout(() => {
    isRouteLoading.value = false
    routeLoadingTimer = undefined
  }, remaining)
}

onMounted(async () => {
  if (import.meta.client) {
    sidebarCollapsed.value = localStorage.getItem(SIDEBAR_KEY) === '1'
    const storedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    const savedWidth = storedWidth === null ? Number.NaN : Number(storedWidth)

    if (Number.isFinite(savedWidth)) {
      sidebarWidth.value = clampSidebarWidth(savedWidth)
    }

    removeRouteBeforeGuard = router.beforeEach((to, from) => {
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

      const isPosNavigation = to.path.startsWith('/pos') || from.path.startsWith('/pos')

      if (isPosNavigation && to.fullPath !== from.fullPath) {
        startRouteLoading()
      }
    })

    removeRouteAfterGuard = router.afterEach((to, from) => {
      const isPosNavigation = to.path.startsWith('/pos') || from.path.startsWith('/pos')

      if (isPosNavigation && to.fullPath !== from.fullPath) {
        finishRouteLoading()
      }
    })

    removeRouteErrorGuard = router.onError(() => {
      finishRouteLoading()
    })
  }

  try {
    const user = await sessionStore.load()

    // Onboarding obligatorio: hasta que el diagnóstico esté "completado",
    // mandamos al diagnóstico y la app permanece bloqueada (ver beforeEach).
    if (
      user?.storeId
      && user.onboardingDiagnostico !== 'completado'
      && route.path !== '/pos/diagnostico'
    ) {
      await navigateTo('/pos/diagnostico')
    }

    isReady.value = true
  } catch {
    void navigateTo('/login')
  }
})

onBeforeUnmount(() => {
  if (routeLoadingTimer) {
    clearTimeout(routeLoadingTimer)
  }

  removeRouteBeforeGuard?.()
  removeRouteAfterGuard?.()
  removeRouteErrorGuard?.()
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

// Estado de apertura controlado por PanelMenu. Lo abrimos automáticamente la
// primera vez que una de sus rutas está activa; después manda el usuario (por
// eso el guard `=== undefined`: no reabrimos un grupo que el usuario cerró).
const expandedKeys = ref<Record<string, boolean>>({})

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
    v-show="isReady"
    class="pos-page"
    :class="{ 'is-collapsed': sidebarCollapsed, 'is-resizing-sidebar': isResizingSidebar }"
    :style="{ '--sidebar-w': `${currentSidebarWidth}px` }"
  >
    <Drawer v-model:visible="mobileMenuOpen" position="left" class="pos-drawer">
      <template #header>
        <div class="drawer-brand">
          <img src="/nexa-logo-white.webp" alt="" class="brand-logo" aria-hidden="true">
          <strong>NEXA</strong>
        </div>
      </template>

      <nav class="drawer-nav" aria-label="Navegación móvil del POS">
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
          <div class="user-chip">
            <span class="user-chip__avatar">{{ userInitials }}</span>
            <span class="user-chip__meta">
              <strong>{{ session?.name }}</strong>
              <small v-if="session?.role">{{ session.role }}</small>
            </span>
          </div>
          <Button type="button" text rounded icon="pi pi-sign-out" class="topbar-icon-btn" v-tooltip.bottom="{ value: 'Cerrar sesión', showDelay: 150 }" aria-label="Cerrar sesión" @click="logout" />
        </div>
      </header>

      <div class="pos-content-shell" :class="{ 'is-loading': isRouteLoading }">
        <slot />
        <Transition name="pos-route-feedback">
          <div v-if="isRouteLoading" class="pos-route-feedback" role="status" aria-live="polite" aria-label="Cargando sección">
            <div class="pos-route-feedback__panel">
              <span class="pos-route-feedback__spinner" aria-hidden="true">
                <img src="/nexa-logo-color.webp" alt="">
              </span>
              <span class="pos-route-feedback__copy">Cargando sección</span>
            </div>
          </div>
        </Transition>
      </div>
    </section>

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
  </main>

  <main v-if="!isReady" class="pos-loading">
    <div class="pos-loading__card" role="status" aria-live="polite" aria-label="Abriendo punto de venta">
      <div class="pos-loading__spinner" aria-hidden="true">
        <span class="pos-loading__ring pos-loading__ring--outer" />
        <span class="pos-loading__mark">
          <img src="/nexa-logo-color.webp" alt="">
        </span>
      </div>
      <p class="pos-loading__text">
        Abriendo punto de venta<span class="pos-loading__dots"><span>.</span><span>.</span><span>.</span></span>
      </p>
      <span class="pos-loading__bar" aria-hidden="true" />
    </div>
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

.pos-content-shell.is-loading {
  overflow: hidden;
}

.pos-route-feedback {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: 24px;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 42%, rgba(15, 158, 46, 0.12), rgba(255, 255, 255, 0) 34%),
    rgba(243, 244, 246, 0.72);
  backdrop-filter: blur(3px);
}

.pos-route-feedback__panel {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 16px 10px 12px;
  border: 1px solid rgba(11, 31, 58, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  color: #0b1f3a;
  box-shadow: 0 14px 32px rgba(11, 31, 58, 0.12);
}

.pos-route-feedback__spinner {
  position: relative;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgba(11, 31, 58, 0.1);
}

.pos-route-feedback__spinner::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  border: 2px solid rgba(11, 31, 58, 0.1);
  border-top-color: #0b1f3a;
  border-right-color: #16a34a;
  animation: pos-route-feedback-spin 0.9s linear infinite;
}

.pos-route-feedback__spinner img {
  position: relative;
  z-index: 1;
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.pos-route-feedback__copy {
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0;
}

.pos-route-feedback-enter-active,
.pos-route-feedback-leave-active {
  transition: opacity 0.14s ease;
}

.pos-route-feedback-enter-from,
.pos-route-feedback-leave-to {
  opacity: 0;
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
}

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

.pos-loading {
  min-height: 100dvh;
  display: grid;
  place-content: center;
  place-items: center;
  padding: 24px;
  background: #f5f7fb;
  color: var(--brand-700);
  font-weight: 800;
}

.pos-loading__card {
  display: grid;
  justify-items: center;
  gap: 16px;
  width: min(100%, 280px);
  padding: 28px 26px 24px;
  border: 1px solid rgba(11, 31, 58, 0.1);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(11, 31, 58, 0.1);
}

.pos-loading__spinner {
  position: relative;
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
}

.pos-loading__ring {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
}

.pos-loading__ring--outer {
  inset: 0;
  border-radius: 50%;
  border: 3px solid rgba(11, 31, 58, 0.1);
  border-top-color: #0b1f3a;
  border-right-color: #16a34a;
  animation: pos-loading-spin 1.05s linear infinite;
}

.pos-loading__mark {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(11, 31, 58, 0.08);
  box-shadow: 0 10px 24px rgba(11, 31, 58, 0.1);
}

.pos-loading__mark img {
  width: 38px;
  height: 38px;
  object-fit: contain;
}

.pos-loading__text {
  margin: 0;
  color: #0b1f3a;
  font-size: 0.96rem;
  letter-spacing: 0;
  text-align: center;
}

.pos-loading__bar {
  position: relative;
  width: min(100%, 190px);
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(11, 31, 58, 0.1);
}

.pos-loading__bar::before {
  content: "";
  position: absolute;
  inset: 0;
  width: 40%;
  border-radius: inherit;
  background: #0b1f3a;
  animation: pos-loading-bar 1.35s ease-in-out infinite;
}

.pos-loading__dots span {
  display: inline-block;
  animation: pos-loading-dots 1.4s ease-in-out infinite;
}

.pos-loading__dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.pos-loading__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pos-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pos-loading-dots {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

@keyframes pos-loading-bar {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(230%);
  }
}

@keyframes pos-route-feedback-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pos-loading__ring,
  .pos-loading__bar::before,
  .pos-loading__dots span,
  .pos-route-feedback__spinner::before {
    animation: none;
  }

  .pos-route-feedback-enter-active,
  .pos-route-feedback-leave-active {
    transition: none;
  }

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
