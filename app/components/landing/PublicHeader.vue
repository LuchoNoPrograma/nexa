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
  { label: 'Haru IA', to: '/#como-funciona' },
  { label: 'Contacto', to: '/contacto' },
]

const socials = [
  { icon: 'pi pi-facebook', label: 'Facebook', href: '#' },
  { icon: 'pi pi-instagram', label: 'Instagram', href: '#' },
  { icon: 'pi pi-youtube', label: 'YouTube', href: '#' },
  { icon: 'pi pi-whatsapp', label: 'WhatsApp', href: '#' },
]

const scrolled = ref(false)
const mobileOpen = ref(false)

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

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})

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
          <img src="/nexa-logo-color.webp" alt="" class="site-logo" aria-hidden="true">
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
            class="hidden text-sm font-semibold text-[#1f2d23] hover:text-primary-600 lg:inline-flex lg:items-center lg:gap-2"
          >
            <i class="pi pi-sign-in" />Iniciar sesión
          </NuxtLink>
          <NuxtLink to="/login" class="hidden lg:inline-flex">
            <Button
              label="Comenzar gratis"
              icon="pi pi-arrow-right"
              icon-pos="right"
              class="btn-shine !rounded-full !border-0 !bg-primary-500 !px-5 !py-2.5 !font-bold !text-white"
            />
          </NuxtLink>
          <Button
            icon="pi pi-bars"
            text
            rounded
            class="!text-primary-700 lg:!hidden"
            aria-label="Abrir menú"
            @click="mobileOpen = true"
          />
        </div>
      </div>
    </div>

    <Drawer
      v-model:visible="mobileOpen"
      position="right"
      class="public-mobile-drawer !w-[min(86vw,360px)]"
      :pt="{ root: { class: 'lg:!hidden' } }"
    >
      <template #header>
        <NuxtLink to="/" class="flex items-center gap-2.5" aria-label="NEXA inicio" @click="mobileOpen = false">
          <img src="/nexa-logo-color.webp" alt="" class="h-9 w-9 object-contain" aria-hidden="true">
          <span class="font-display text-[1.25rem] font-extrabold tracking-tight text-[#1f2d23]">NEXA</span>
        </NuxtLink>
      </template>

      <nav class="flex flex-col gap-1" aria-label="Navegación principal">
        <NuxtLink
          v-for="item in mainMenu"
          :key="item.label"
          :to="item.to"
          class="mobile-nav-link"
          :class="{ 'is-active': isMainActive(item) }"
          @click="mobileOpen = false"
        >
          {{ item.label }}
        </NuxtLink>

        <span class="mt-4 mb-1 px-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#9aa89e]">
          Institucional
        </span>
        <NuxtLink
          v-for="item in topMenu"
          :key="item.label"
          :to="item.to"
          class="mobile-nav-link"
          :class="{ 'is-active': isTopActive(item.to) }"
          @click="mobileOpen = false"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="mt-6 flex flex-col gap-3 border-t border-[#eef1ee] pt-6">
        <NuxtLink to="/login" class="block" @click="mobileOpen = false">
          <Button
            label="Iniciar sesión"
            icon="pi pi-sign-in"
            outlined
            class="!w-full !justify-center !rounded-full !border-primary-500 !py-2.5 !font-bold !text-primary-700"
          />
        </NuxtLink>
        <NuxtLink to="/login" class="block" @click="mobileOpen = false">
          <Button
            label="Comenzar gratis"
            icon="pi pi-arrow-right"
            icon-pos="right"
            class="btn-shine !w-full !justify-center !rounded-full !border-0 !bg-primary-500 !py-2.5 !font-bold !text-white"
          />
        </NuxtLink>
      </div>

      <div class="mt-6 flex items-center gap-2 border-t border-[#eef1ee] pt-6">
        <a
          v-for="social in socials"
          :key="social.label"
          :href="social.href"
          class="grid h-10 w-10 place-items-center rounded-full bg-[#f3f6f3] text-primary-700 transition hover:bg-primary-50"
          :aria-label="social.label"
        >
          <i :class="social.icon" />
        </a>
      </div>
    </Drawer>
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

.mobile-nav-link {
  display: flex;
  align-items: center;
  padding: 0.7rem 0.75rem;
  border-radius: 12px;
  color: #1f2d23;
  font-size: 0.95rem;
  font-weight: 700;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.mobile-nav-link:hover {
  background: #f3f6f3;
}

.mobile-nav-link.is-active {
  background: var(--p-primary-50, #ecfdf3);
  color: var(--p-primary-700, #1f7a3d);
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
