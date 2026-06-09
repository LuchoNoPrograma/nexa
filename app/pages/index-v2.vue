<script setup lang="ts">
const menuItems = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Nosotros', href: '#nosotros' },
  { label: 'Herramientas', href: '#herramientas' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Contacto', href: '#contacto' },
]

const tools = [
  { icon: 'pi pi-calculator', title: 'Calculadora de precios', text: 'Define precios justos y rentables con un desglose claro de costos y ganancia.' },
  { icon: 'pi pi-megaphone', title: 'Marketing y ventas', text: 'Ideas listas para atraer clientes y vender más en TikTok, WhatsApp y Facebook — con la ayuda de Kenchita.' },
  { icon: 'pi pi-palette', title: 'Branding y diseño', text: 'Recomendaciones de nombre, colores e identidad visual para tu negocio — con la ayuda de Kenchita.' },
  { icon: 'pi pi-box', title: 'Gestión de inventario', text: 'Controla productos y existencias de forma simple, sin planillas complicadas.' }
]

const audiences = [
  { emoji: '🛍️', title: 'Tiendas y abarrotes', tone: 'background:#e6f6e8;color:#0f8520' },
  { emoji: '🍔', title: 'Comida y restaurantes', tone: 'background:#fff0df;color:#d87414' },
  { emoji: '👗', title: 'Ropa y boutiques', tone: 'background:#efe8ff;color:#7a4ee5' },
  { emoji: '💄', title: 'Belleza y estética', tone: 'background:#ffe8ef;color:#d94e76' },
]

const products = [
  { name: 'Café tostado 500g', value: 'Bs. 205', color: '#b45309' },
  { name: 'Miel de abeja 250g', value: 'Bs. 160', color: '#eab308' },
  { name: 'Pulpa de asaí 1kg', value: 'Bs. 120', color: '#7c2d12' },
]

const steps = [
  { number: '1', icon: 'pi pi-user-plus', title: 'Registra tu negocio', text: 'Crea tu cuenta gratis y cuéntanos a qué te dedicas. Toma menos de 2 minutos.' },
  { number: '2', icon: 'pi pi-sparkles', title: 'Usa las herramientas y Kenchita', text: 'Pregunta, calcula precios y recibe ideas hechas a la medida de tu negocio.' },
  { number: '3', icon: 'pi pi-chart-line', title: 'Crece y vende más', text: 'Aplica las recomendaciones, mide resultados y haz crecer tus ventas.' },
]

const testimonials = [
  { name: 'María Quispe', role: 'Dueña · Sabores del Acre', initials: 'MQ', text: 'Con NEXA aprendí a poner precios sin perder plata. Kenchita me dio ideas para WhatsApp y mis ventas subieron en dos semanas.' },
  { name: 'Carlos Vargas', role: 'Boutique Amazonía', initials: 'CV', text: 'Lo mejor es que está pensado para negocios como el mío. Todo en simple, sin tecnicismos. Lo uso todos los días.' },
  { name: 'Lucía Mamani', role: 'Belleza Pando', initials: 'LM', text: 'El asesor responde al instante y entiende el mercado local. Es como tener un consultor disponible 24/7.' },
]

const stats = [
  { to: 384, suffix: '', label: 'Negocios de Cobija estudiados' },
  { to: 85, suffix: '%', label: 'Estaría dispuesto a usar una herramienta así' },
  { to: 92, suffix: '%', label: 'Quiere ayuda para calcular bien sus precios' },
  { to: 52, suffix: '%', label: 'No sabe si gana o pierde con sus precios actuales' },
]

// Header transparente sobre el hero, sólido al hacer scroll
const scrolled = ref(false)
function onScroll() {
  scrolled.value = window.scrollY > 40
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <main class="min-h-screen bg-white text-[#0c1f12]" id="inicio">
    <!-- Header (transparente sobre el hero, sólido al hacer scroll) -->
    <header class="site-header" :class="scrolled ? 'is-solid' : 'is-ghost'">
      <div class="mx-auto flex h-[74px] w-[min(1280px,calc(100%-32px))] items-center justify-between gap-4">
        <a href="#inicio" class="flex items-center gap-2.5" aria-label="NEXA inicio">
          <span class="nexa-mark"><i class="pi pi-bolt" /></span>
          <span class="font-display text-[1.55rem] font-extrabold tracking-tight">NEXA</span>
        </a>

        <nav class="hidden items-center gap-7 text-sm font-semibold lg:flex">
          <a
            v-for="item in menuItems"
            :key="item.label"
            :href="item.href"
            class="nav-link inline-flex items-center gap-1"
            :class="{ 'is-active': item.label === 'Inicio' }"
          >
            {{ item.label }}
            <i v-if="['Nosotros', 'Herramientas'].includes(item.label)" class="pi pi-angle-down text-xs opacity-70" />
          </a>
        </nav>

        <div class="hidden items-center gap-3 md:flex">
          <NuxtLink to="/login" class="header-ghost-btn inline-flex items-center gap-2 text-sm font-semibold">
            <i class="pi pi-sign-in" />Iniciar sesión
          </NuxtLink>
          <Button label="Comenzar gratis" icon="pi pi-arrow-right" iconPos="right" class="btn-shine !rounded-full !border-0 !bg-primary-500 !px-5 !py-2.5 !font-bold !text-white" />
        </div>

        <Button icon="pi pi-bars" text rounded class="header-burger lg:!hidden" aria-label="Abrir menú" />
      </div>
    </header>

    <!-- Hero full-bleed (estilo FORAMA): la imagen de la Amazonía es el fondo -->
    <section class="hero-full">
      <div class="hero-bg" />
      <div class="hero-scrim" />

      <div class="hero-content">
        <span class="hero-pill"><span class="hero-pill-dot" />COBIJA, PANDO · BOLIVIA</span>

        <div class="hero-slide">
          <h1 class="hero-title font-display">
            Vende más, atrae clientes y pon <span class="text-gradient-warm">precios con cabeza</span>
          </h1>
          <p class="hero-sub font-display">NEXA es tu asesor inteligente, hecho en Cobija para los emprendedores de la Amazonía boliviana.</p>
        </div>

        <Button label="Comenzar gratis" icon="pi pi-arrow-right" iconPos="right" class="btn-shine hero-cta !mt-6 !rounded-full !border-0 !px-6 !py-3 !text-sm !font-bold" />
      </div>

      <div class="hero-foot">
        <h4>Vende más, atrae clientes y pon precios justos.</h4>
        <a href="#panel" class="hero-chevron" aria-label="Desplázate hacia abajo"><i class="pi pi-chevron-down text-xl" /></a>
      </div>
    </section>

    <!-- Conoce a Kenchita (chat) — la estrella, primero -->
    <section class="mx-auto w-[min(1180px,calc(100%-28px))] py-16">
      <div class="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div v-reveal>
          <span class="section-eyebrow"><i class="pi pi-comments" />Asesor con IA</span>
          <h2 class="section-title mt-4">Conoce a Kenchita, tu asesor de negocios</h2>
          <p class="section-lead">Pregúntale lo que quieras sobre tu negocio. Kenchita entiende el mercado local y te da respuestas claras y accionables, al instante.</p>
          <ul class="mt-6 space-y-3">
            <li v-for="t in ['Respuestas hechas a la medida de tu rubro', 'Ideas de marketing listas para usar', 'Disponible las 24 horas, todos los días']" :key="t" class="flex items-center gap-3 text-sm font-semibold text-[#1f2d23]">
              <span class="grid h-6 w-6 place-items-center rounded-full bg-primary-50 text-primary-500"><i class="pi pi-check text-xs" /></span>{{ t }}
            </li>
          </ul>
        </div>

        <div class="rounded-3xl border border-[#e5eee4] bg-white p-5 shadow-[0_24px_60px_rgba(12,31,18,0.1)] sm:p-7" v-reveal="{ delay: 120 }">
          <div class="mb-5 flex items-center gap-3 border-b border-[#eef1ee] pb-4">
            <span class="h-12 w-12 overflow-hidden rounded-full bg-[#f3faf2] ring-2 ring-[#e7efe7]"><MascotJaguar variant="head" /></span>
            <div>
              <strong class="block">Kenchita</strong>
              <span class="flex items-center gap-1.5 text-xs font-semibold text-primary-700"><span class="h-2 w-2 rounded-full bg-primary-500" />En línea</span>
            </div>
          </div>

          <div class="space-y-4">
            <div class="chat-bubble-user">¿Cómo atraigo más clientes a mi tienda de comida?</div>
            <div class="chat-bubble-ai">
              <p class="mb-3 text-sm font-semibold text-[#1f2d23]">¡Buena pregunta! Aquí tienes 3 ideas que pueden ayudarte:</p>
              <ol class="space-y-3 text-sm font-medium text-[#344054]">
                <li class="flex"><span class="tip-dot">1</span>Actualiza tu estado de WhatsApp cada día con ofertas y fotos apetitosas.</li>
                <li class="flex"><span class="tip-dot">2</span>Publica promociones cortas y creativas en TikTok y Facebook.</li>
                <li class="flex"><span class="tip-dot">3</span>Ofrece combos especiales y premios por recomendar a un amigo.</li>
              </ol>
            </div>
            <div class="chat-bubble-ai !inline-flex w-max items-center gap-1 typing">
              <span /><span /><span />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Qué ofrecemos (bento) -->
    <section id="herramientas" class="mx-auto w-[min(1180px,calc(100%-28px))] pb-16">
      <div class="mx-auto max-w-2xl text-center" v-reveal>
        <span class="section-eyebrow"><i class="pi pi-wrench" />Herramientas</span>
        <h2 class="section-title mt-4">Qué ofrecemos</h2>
        <p class="section-lead">Herramientas digitales simples y poderosas para ayudarte a emprender y crecer, sin complicaciones.</p>
      </div>

      <div class="mt-12 grid gap-5 lg:grid-cols-3">
        <!-- featured Kenchita card -->
        <article class="pam-feature lg:row-span-2" v-reveal>
          <div class="relative z-10 flex h-full flex-col p-7">
            <span class="chip-soft w-max bg-[#2fe04a]/20 text-[#bfffca]"><i class="pi pi-bolt" />Estrella</span>
            <div class="mx-auto my-4 h-56 w-48"><MascotJaguar variant="full" /></div>
            <h3 class="font-display text-2xl font-extrabold">Kenchita · Tu asesor 24/7</h3>
            <p class="mt-3 text-sm font-medium leading-7 text-[#d9f5df]">
              Un asistente inteligente que conoce tu negocio y responde al instante: marketing, ventas, branding y precios. Como tener un consultor siempre disponible.
            </p>
            <div class="mt-5 flex flex-wrap gap-2">
              <span class="chip-soft bg-white/10 text-white"><i class="pi pi-whatsapp" />WhatsApp</span>
              <span class="chip-soft bg-white/10 text-white"><i class="pi pi-comments" />Chat</span>
              <span class="chip-soft bg-white/10 text-white"><i class="pi pi-clock" />24/7</span>
            </div>
            <Button label="Hablar con Kenchita" icon="pi pi-arrow-right" iconPos="right" class="btn-shine mt-auto !mt-7 !w-max !rounded-full !border-0 !bg-white !px-5 !py-2.5 !font-bold !text-[#053d17]" />
          </div>
        </article>

        <article v-for="(tool, i) in tools" :key="tool.title" class="tool-card" v-reveal="{ delay: i * 80 }">
          <span class="tool-arrow"><i class="pi pi-arrow-up-right" /></span>
          <span class="tool-ic"><i :class="tool.icon" /></span>
          <h3 class="font-display mt-5 text-lg font-bold">{{ tool.title }}</h3>
          <p class="mt-2 text-sm font-medium leading-6 text-[#5a6b5f]">{{ tool.text }}</p>
        </article>
      </div>
    </section>

    <!-- Panel / vista de producto (dashboard) -->
    <section id="panel" class="mx-auto w-[min(1180px,calc(100%-28px))] py-20">
      <div class="mx-auto max-w-2xl text-center" v-reveal>
        <span class="section-eyebrow"><i class="pi pi-desktop" />Tu panel</span>
        <h2 class="section-title mt-4">Todo tu negocio en un solo lugar</h2>
        <p class="section-lead">Ventas, ganancias, inventario y diagnósticos en un panel claro, pensado para emprendedores.</p>
      </div>

      <div class="relative mx-auto mt-12 max-w-[920px]" v-reveal="{ delay: 120 }">
        <div class="mock-window">
          <div class="mock-bar">
            <span class="mock-dot bg-[#ff6058]" />
            <span class="mock-dot bg-[#ffbd2e]" />
            <span class="mock-dot bg-[#28c840]" />
            <span class="ml-3 text-[11px] font-semibold text-[#5a6b5f]">app.nexa.bo/panel</span>
          </div>

          <div class="flex">
            <aside class="hidden w-[150px] shrink-0 bg-[#053d17] p-4 text-white sm:block">
              <div class="mb-6 flex items-center gap-2">
                <span class="nexa-mark small"><i class="pi pi-bolt" /></span>
                <strong class="font-display text-base">NEXA</strong>
              </div>
              <div class="space-y-1.5 text-[11px] font-semibold">
                <span class="flex items-center gap-2 rounded-lg bg-primary-500 px-3 py-2"><i class="pi pi-home" />Inicio</span>
                <span class="flex items-center gap-2 px-3 py-2 text-[#bfeac8]"><i class="pi pi-chart-line" />Diagnóstico</span>
                <span class="flex items-center gap-2 px-3 py-2 text-[#bfeac8]"><i class="pi pi-wrench" />Herramientas</span>
                <span class="flex items-center gap-2 px-3 py-2 text-[#bfeac8]"><i class="pi pi-comments" />Kenchita</span>
              </div>
            </aside>

            <div class="flex-1 bg-white p-5">
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <strong class="block text-sm">Hola, Emprendedor 👋</strong>
                  <span class="text-[11px] font-medium text-[#5a6b5f]">Resumen de hoy</span>
                </div>
                <span class="rounded-full bg-primary-50 px-3 py-1.5 text-[11px] font-bold text-primary-700"><i class="pi pi-map-marker mr-1" />Cobija</span>
              </div>

              <div class="grid grid-cols-3 gap-2.5">
                <div class="metric-card">
                  <i class="pi pi-shopping-cart text-[#9f6bff]" />
                  <span class="label">Venta de hoy</span>
                  <span class="value">Bs. 280</span>
                </div>
                <div class="metric-card">
                  <i class="pi pi-arrow-up-right text-primary-500" />
                  <span class="label">Ganancia</span>
                  <span class="value">Bs. 98</span>
                </div>
                <div class="metric-card">
                  <i class="pi pi-box text-[#09a8c7]" />
                  <span class="label">Stock</span>
                  <span class="value">1.256</span>
                </div>
              </div>

              <div class="mt-3 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                <div class="rounded-xl border border-[#eef1ee] p-3.5">
                  <h3 class="mb-3 text-xs font-bold">Resumen de ventas</h3>
                  <div class="sales-chart">
                    <span v-for="(h, i) in [32, 50, 28, 38, 60, 84]" :key="i" :style="{ height: h + '%', animationDelay: i * 90 + 'ms' }" />
                  </div>
                </div>
                <div class="rounded-xl border border-[#eef1ee] p-3.5">
                  <h3 class="mb-3 text-xs font-bold">Más vendidos</h3>
                  <div class="space-y-2.5">
                    <div v-for="p in products" :key="p.name" class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="h-7 w-7 rounded-lg" :style="{ background: p.color }" />
                        <span class="text-[11px] font-semibold">{{ p.name }}</span>
                      </div>
                      <span class="text-[11px] font-bold text-[#5a6b5f]">{{ p.value }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="float-card float-a hidden sm:block">
          <div class="flex items-center gap-2.5">
            <span class="grid h-9 w-9 place-items-center rounded-lg bg-primary-50 text-primary-500"><i class="pi pi-arrow-up-right" /></span>
            <div>
              <strong class="block text-sm leading-tight">Ganancia</strong>
              <span class="text-[10px] font-semibold text-[#5a6b5f]">calculada al instante</span>
            </div>
          </div>
        </div>

        <div class="float-card float-b hidden sm:block">
          <div class="flex items-center gap-2.5">
            <span class="grid h-9 w-9 place-items-center rounded-lg bg-[#fff4dc] text-[#d87414]"><i class="pi pi-bolt" /></span>
            <div>
              <strong class="block text-sm leading-tight">Asesor Kenchita</strong>
              <span class="text-[10px] font-semibold text-[#5a6b5f]">disponible 24/7</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Trust marquee -->
    <section class="mx-auto w-[min(1240px,calc(100%-24px))] py-10">
      <p class="mb-6 text-center text-xs font-bold uppercase tracking-[0.14em] text-[#8aa890]">Pensado para negocios de todos los rubros</p>
      <div class="marquee">
        <div class="marquee__track">
          <template v-for="n in 2" :key="n">
            <span class="flex items-center gap-2 text-lg font-bold text-[#9fb3a4]"><i class="pi pi-shop" />Tiendas</span>
            <span class="flex items-center gap-2 text-lg font-bold text-[#9fb3a4]"><i class="pi pi-shopping-bag" />Boutiques</span>
            <span class="flex items-center gap-2 text-lg font-bold text-[#9fb3a4]"><i class="pi pi-stop" />Restaurantes</span>
            <span class="flex items-center gap-2 text-lg font-bold text-[#9fb3a4]"><i class="pi pi-heart" />Estética</span>
            <span class="flex items-center gap-2 text-lg font-bold text-[#9fb3a4]"><i class="pi pi-box" />Abarrotes</span>
            <span class="flex items-center gap-2 text-lg font-bold text-[#9fb3a4]"><i class="pi pi-truck" />Delivery</span>
          </template>
        </div>
      </div>
    </section>

    <!-- Amazon roots band -->
    <section id="nosotros" class="mx-auto w-[min(1240px,calc(100%-24px))] py-6">
      <div class="aurora leaf-texture relative grid items-center gap-8 overflow-hidden rounded-[28px] p-7 sm:p-10 lg:grid-cols-[1.1fr_0.9fr]" v-reveal>
        <div class="relative z-10">
          <span class="section-eyebrow !border-white/20 !bg-white/10 !text-[#2fe04a]"><i class="pi pi-globe" />Identidad</span>
          <h2 class="font-display mt-5 text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            Tecnología con <span class="text-gradient">raíces amazónicas</span>
          </h2>
          <p class="mt-5 max-w-[520px] text-base font-medium leading-8 text-[#d9f5df]">
            NEXA nació en Cobija para destacar el talento local y el enorme potencial de nuestra Amazonía. Combinamos inteligencia artificial de punta con un profundo conocimiento del mercado boliviano.
          </p>
          <blockquote class="roots-quote">
            <i class="pi pi-quote-left roots-quote__mark" />
            <p class="font-display text-lg font-semibold leading-7 text-[#eafff0]">NEXA cree en el talento de nuestra gente y en el potencial de nuestra Amazonía.</p>
            <div class="roots-quote__by">
              <span class="nexa-mark small"><i class="pi pi-bolt" /></span>
              <div class="leading-tight">
                <strong class="block text-sm text-white">Equipo NEXA</strong>
                <span class="text-xs font-medium text-[#9dd1a6]">Cobija, Pando · Bolivia</span>
              </div>
            </div>
          </blockquote>
        </div>

        <div class="relative z-10 grid grid-cols-2 gap-4">
          <ImagePlaceholder dark ratio="3 / 4" icon="pi pi-user" label="Emprendedora local" class="row-span-2 roots-fill" />
          <ImagePlaceholder dark ratio="4 / 3" icon="pi pi-image" label="Jaguar · fauna" />
          <ImagePlaceholder dark ratio="4 / 3" icon="pi pi-sun" label="Paisaje · Amazonía" />
        </div>
      </div>
    </section>

    <!-- Cómo funciona -->
    <section id="como-funciona" class="bg-[#f3faf2] py-16">
      <div class="mx-auto w-[min(1180px,calc(100%-28px))]">
        <div class="mx-auto max-w-2xl text-center" v-reveal>
          <span class="section-eyebrow"><i class="pi pi-compass" />Simple y rápido</span>
          <h2 class="section-title mt-4">Cómo funciona</h2>
          <p class="section-lead">En tres pasos sencillos empiezas a tomar mejores decisiones para tu negocio.</p>
        </div>

        <div class="relative mt-12 grid gap-6 md:grid-cols-3">
          <div class="pointer-events-none absolute left-[8%] right-[8%] top-[48px] hidden h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[#2fe04a] via-primary-500 to-primary-700 opacity-80 shadow-[0_0_14px_rgba(47,224,74,0.45)] md:block" />
          <article v-for="(step, i) in steps" :key="step.number" class="step-card" v-reveal="{ delay: i * 120 }">
            <div class="flex items-center justify-between">
              <span class="step-number">{{ step.number }}</span>
              <i :class="step.icon" class="text-2xl text-primary-500" />
            </div>
            <h3 class="font-display mt-5 text-lg font-bold">{{ step.title }}</h3>
            <p class="mt-2 text-sm font-medium leading-6 text-[#5a6b5f]">{{ step.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Stats band -->
    <section class="mx-auto w-[min(1180px,calc(100%-28px))] py-16">
      <div class="aurora leaf-texture relative overflow-hidden rounded-[28px] px-6 py-12" v-reveal>
        <div class="relative z-10 grid gap-8 text-center text-white sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="s in stats" :key="s.label">
            <div class="stat-num text-gradient">
              <StatCounter :to="s.to" :suffix="s.suffix" />
            </div>
            <p class="mt-3 text-sm font-semibold text-[#d9f5df]">{{ s.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Para quién es -->
    <section class="mx-auto w-[min(1180px,calc(100%-28px))] pb-16">
      <div class="mx-auto max-w-2xl text-center" v-reveal>
        <span class="section-eyebrow"><i class="pi pi-users" />Para ti</span>
        <h2 class="section-title mt-4">¿Para quién es NEXA?</h2>
        <p class="section-lead">Pensado para microempresas y emprendedores que quieren modernizarse sin complicarse.</p>
      </div>

      <div class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <article v-for="(a, i) in audiences" :key="a.title" class="audience-card" v-reveal="{ delay: i * 80 }">
          <span class="audience-emoji" :style="a.tone">{{ a.emoji }}</span>
          <strong class="font-display text-center text-base">{{ a.title }}</strong>
        </article>
      </div>
    </section>

    <!-- Testimonios -->
    <section class="mx-auto w-[min(1180px,calc(100%-28px))] pb-16">
      <div class="mx-auto max-w-2xl text-center" v-reveal>
        <span class="section-eyebrow"><i class="pi pi-star-fill" />Testimonios</span>
        <h2 class="section-title mt-4">Lo que dicen los emprendedores</h2>
      </div>

      <div class="mt-12 grid gap-5 md:grid-cols-3">
        <article v-for="(t, i) in testimonials" :key="t.name" class="testimonial-card" v-reveal="{ delay: i * 100 }">
          <div class="mb-4 flex items-center justify-between gap-2">
            <div class="flex text-[#f6a623]">
              <i v-for="n in 5" :key="n" class="pi pi-star-fill text-sm" />
            </div>
            <span class="inline-flex items-center gap-1 rounded-full bg-[#eef1ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7a8a7e]"><i class="pi pi-info-circle text-[10px]" />Ejemplo ilustrativo</span>
          </div>
          <p class="text-sm font-medium leading-7 text-[#344054]">“{{ t.text }}”</p>
          <div class="mt-6 flex items-center gap-3 border-t border-[#eef1ee] pt-5">
            <span class="avatar-ph">{{ t.initials }}</span>
            <div>
              <strong class="block text-sm">{{ t.name }}</strong>
              <span class="text-xs font-medium text-[#5a6b5f]">{{ t.role }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Misión y visión -->
    <section class="mx-auto w-[min(1180px,calc(100%-28px))] pb-16">
      <div class="mx-auto max-w-2xl text-center" v-reveal>
        <span class="section-eyebrow"><i class="pi pi-leaf" />Propósito</span>
        <h2 class="section-title mt-4">Misión y visión</h2>
      </div>

      <div class="mt-12 grid gap-6 lg:grid-cols-2">
        <article class="vp-card" v-reveal>
          <span class="vp-icon"><i class="pi pi-bullseye" /></span>
          <h3 class="vp-title font-display">Misión</h3>
          <p class="vp-text">
            Empoderar a emprendedores, pequeños negocios y profesionales con acceso a soporte en marketing, publicidad y estrategias de venta, ofreciendo orientación clara para aumentar visibilidad, atraer clientes y crecer de forma sostenible.
          </p>
        </article>

        <article class="vp-card" v-reveal="{ delay: 120 }">
          <span class="vp-icon"><i class="pi pi-flag" /></span>
          <h3 class="vp-title font-display">Visión</h3>
          <p class="vp-text">
            Brindar soluciones de asesoramiento empresarial digital que permitan a las microempresas fortalecer su gestión, mejorar la toma de decisiones y potenciar su crecimiento con herramientas accesibles, prácticas e innovadoras.
          </p>
        </article>
      </div>
    </section>

    <!-- CTA band (fondo con Kenchita ya integrado a la derecha) -->
    <section class="mx-auto w-[min(1240px,calc(100%-24px))] pb-16">
      <div class="cta-band relative overflow-hidden" v-reveal>
        <div class="cta-band__scrim" />
        <div class="relative z-10 max-w-[600px] px-7 py-12 sm:px-12 sm:py-14">
          <h2 class="font-display text-[1.9rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            Empieza a hacer <span class="text-primary-300">crecer tu negocio</span> hoy
          </h2>
          <p class="mt-4 max-w-md text-base font-medium text-[#e3ffe8]">
            Únete a la revolución inteligente de la Amazonía. Crea tu cuenta gratis y descubre todo lo que NEXA puede hacer por ti.
          </p>
          <div class="mt-7 flex flex-wrap items-center gap-3">
            <Button label="Comenzar gratis" icon="pi pi-arrow-right" iconPos="right" class="btn-shine !rounded-full !border-0 !bg-primary-400 !px-7 !py-3.5 !text-base !font-bold !text-[#04200d]" />
            <Button label="Hablar con Kenchita" icon="pi pi-comments" outlined class="!rounded-full !border-white/55 !px-7 !py-3.5 !text-base !font-bold !text-white hover:!bg-white/10" />
          </div>
          <p class="mt-5 text-xs font-semibold text-[#cdeed3]"><i class="pi pi-check-circle mr-1" />Gratis · Sin complicaciones</p>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer id="contacto" class="bg-[#04200d] text-white">
      <div class="mx-auto grid w-[min(1240px,calc(100%-28px))] gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <a href="#inicio" class="flex items-center gap-3">
            <span class="nexa-mark"><i class="pi pi-bolt" /></span>
            <span class="leading-none">
              <span class="font-display block text-[1.7rem] font-extrabold">NEXA</span>
              <span class="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#bfeac8]">IA para tu negocio</span>
            </span>
          </a>
          <p class="mt-5 max-w-xs text-sm font-medium leading-7 text-[#bfeac8]">
            NEXA cree en el talento de nuestra gente y en el potencial de nuestra Amazonía.
          </p>
          <div class="mt-6 flex gap-2.5">
            <a v-for="ic in ['pi-facebook', 'pi-instagram', 'pi-whatsapp', 'pi-tiktok', 'pi-youtube']" :key="ic" href="#" class="social-btn" :aria-label="ic"><i :class="`pi ${ic}`" /></a>
          </div>
        </div>

        <div>
          <h3 class="footer-title">Navegación</h3>
          <a v-for="item in menuItems" :key="item.label" class="footer-link" :href="item.href">{{ item.label }}</a>
        </div>

        <div>
          <h3 class="footer-title">Herramientas</h3>
          <a class="footer-link" href="#">Kenchita</a>
          <a class="footer-link" href="#">Calculadora de precios</a>
          <a class="footer-link" href="#">Marketing y ventas</a>
          <a class="footer-link" href="#">Inventario</a>
        </div>

        <div>
          <h3 class="footer-title">Contacto</h3>
          <span class="footer-link"><i class="pi pi-map-marker mr-2" />Cobija, Pando · Bolivia</span>
          <span class="footer-link"><i class="pi pi-envelope mr-2" />hola@nexa.bo</span>
          <span class="footer-link"><i class="pi pi-phone mr-2" />+591 730 12345</span>
        </div>
      </div>

      <div class="border-t border-[#16431d]">
        <div class="mx-auto flex w-[min(1240px,calc(100%-28px))] flex-col items-center justify-between gap-3 py-6 text-xs font-semibold text-[#bfeac8] sm:flex-row">
          <span>© {{ new Date().getFullYear() }} NEXA · Hecho con 💚 en Cobija, Pando — Bolivia</span>
          <div class="flex gap-5">
            <a class="hover:text-white" href="#">Términos</a>
            <a class="hover:text-white" href="#">Privacidad</a>
            <a class="hover:text-white" href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  </main>
</template>
