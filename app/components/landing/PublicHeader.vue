<script setup lang="ts">
const route = useRoute()

const topMenu = [
  { label: 'Empresa', to: '/empresa' },
  { label: 'Calidad', to: '/calidad' },
  { label: 'Contacto', to: '/contacto' },
]

const mainMenu = [
  { label: 'Inicio', to: '/', exact: true },
  { label: 'Herramientas', to: '/#herramientas' },
  { label: 'Kenchita IA', to: '/#como-funciona' },
  { label: 'Contacto', to: '/contacto' },
]

const socials = [
  { icon: 'pi pi-facebook', label: 'Facebook', href: '#' },
  { icon: 'pi pi-instagram', label: 'Instagram', href: '#' },
  { icon: 'pi pi-youtube', label: 'YouTube', href: '#' },
  { icon: 'pi pi-whatsapp', label: 'WhatsApp', href: '#' },
]

const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 20
}

function isTopActive(to: string) {
  return route.path === to
}

function isMainActive(item: { to: string, exact?: boolean }) {
  if (item.exact) {
    return route.path === '/'
  }

  return route.fullPath === item.to
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header class="public-shell-header" :class="{ 'is-solid': scrolled }">
    <div class="public-topbar">
      <div class="public-topbar__inner">
        <nav class="public-topbar__nav" aria-label="Navegación institucional">
          <NuxtLink
            v-for="item in topMenu"
            :key="item.label"
            :to="item.to"
            class="public-topbar__link"
            :class="{ 'is-active': isTopActive(item.to) }"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="public-topbar__right">
          <span class="hidden text-[0.74rem] font-bold uppercase tracking-[0.12em] text-[#d9f5df] md:inline">
            Cobija · Bolivia
          </span>
          <a
            v-for="social in socials"
            :key="social.label"
            :href="social.href"
            class="public-topbar__social"
            :aria-label="social.label"
          >
            <i :class="social.icon" />
          </a>
        </div>
      </div>
    </div>

    <div class="public-mainbar">
      <div class="public-mainbar__inner">
        <NuxtLink to="/" class="flex items-center gap-2.5" aria-label="NEXA inicio">
          <img src="/nexa-logo.png" alt="" class="site-logo" aria-hidden="true">
          <span class="leading-none">
            <span class="font-display block text-[1.5rem] font-extrabold tracking-tight">NEXA</span>
            <span class="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#7a8a7e]">IA para tu negocio</span>
          </span>
        </NuxtLink>

        <nav class="hidden items-center gap-8 text-sm font-semibold lg:flex" aria-label="Navegación principal">
          <NuxtLink
            v-for="item in mainMenu"
            :key="item.label"
            :to="item.to"
            class="nav-link"
            :class="{ 'is-active': isMainActive(item) }"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <NuxtLink
            to="/login"
            class="hidden text-sm font-semibold text-[#1f2d23] hover:text-primary-600 sm:inline-flex sm:items-center sm:gap-2"
          >
            <i class="pi pi-sign-in" />Iniciar sesión
          </NuxtLink>
          <Button
            label="Comenzar gratis"
            icon="pi pi-arrow-right"
            icon-pos="right"
            class="btn-shine !rounded-full !border-0 !bg-primary-500 !px-5 !py-2.5 !font-bold !text-white"
          />
          <Button icon="pi pi-bars" text rounded class="!text-primary-700 lg:!hidden" aria-label="Abrir menú" />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.public-shell-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: #fff;
  transition: box-shadow 0.3s ease;
}

.public-shell-header.is-solid {
  box-shadow: 0 6px 24px rgba(12, 31, 18, 0.08);
}

.public-topbar {
  background: #04200d;
  color: #fff;
}

.public-topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(1240px, calc(100% - 32px));
  min-height: 42px;
  margin: 0 auto;
}

.public-topbar__nav,
.public-topbar__right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.public-topbar__right {
  gap: 8px;
}

.public-topbar__link {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 2px solid transparent;
  color: #d9f5df;
  font-size: 0.82rem;
  font-weight: 800;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.public-topbar__link:hover,
.public-topbar__link.is-active {
  border-color: #f2c200;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.public-topbar__social {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  color: #bfeac8;
  font-size: 0.82rem;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.public-topbar__social:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.public-mainbar {
  border-bottom: 1px solid #eef1ee;
  background: #fff;
}

.public-mainbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(1240px, calc(100% - 32px));
  height: 76px;
  margin: 0 auto;
}

.site-logo {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  object-fit: contain;
}

@media (max-width: 640px) {
  .public-topbar__inner {
    width: min(100% - 20px, 1240px);
  }

  .public-topbar__link {
    padding: 0 9px;
    font-size: 0.76rem;
  }

  .public-topbar__social {
    display: none;
  }

  .public-mainbar__inner {
    width: min(100% - 24px, 1240px);
    height: 70px;
  }
}
</style>
