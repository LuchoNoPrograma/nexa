<script setup lang="ts">
definePageMeta({
  layout: 'public',
})

const menuItems = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Herramientas', href: '#herramientas' },
  { label: 'Conoce a Haru', href: '#como-funciona' },
  { label: 'Contacto', href: '#contacto' },
]

const socials = [
  { icon: 'pi pi-facebook', label: 'Facebook', href: '#' },
  { icon: 'pi pi-instagram', label: 'Instagram', href: '#' },
  { icon: 'pi pi-tiktok', label: 'TikTok', href: '#' },
  { icon: 'pi pi-whatsapp', label: 'WhatsApp', href: '#' },
]

// Tarjetas "Herramientas para crecer" (las imágenes las provee el equipo)
const tools = [
  {
    title: 'Haru · Asesor 24/7',
    src: '/tools/haru-asesor.jpg',
    alt: 'Haru, el jaguar asesor de NEXA, trabajando frente a la computadora en una oficina',
  },
  {
    title: 'Finanzas',
    src: '/tools/finanzas.jpg',
    alt: 'Billetes, monedas y un cuaderno de cuentas de un pequeño negocio',
  },
  {
    title: 'Marketing y ventas',
    src: '/tools/marketing.jpg',
    alt: 'Teléfono mostrando íconos de redes sociales para promocionar un negocio',
    pos: '50% 18%',
  },
  {
    title: 'Inventario',
    src: '/tools/inventario.jpg',
    alt: 'Estantería de tienda con productos ordenados para control de inventario',
  },
]
</script>

<template>
  <main class="page-boot min-h-screen bg-white text-[#0c1f12]" id="inicio">
    <!-- Hero -->
    <section class="mx-auto w-[min(1240px,calc(100%-32px))] pt-6">
      <div class="hero2">
        <img
          :src="'/hero-nexa-digital.webp'"
          alt="Equipo de trabajo revisando una estrategia digital en una oficina"
          class="hero2__bg"
          loading="eager"
        />
        <div class="hero2__scrim" />

        <div class="hero2__copy">
          <span class="hero2__pill"><span class="hero2__dot" />Cobija, Pando · Bolivia</span>
          <h1 class="hero2__title font-display">
            Vende más y pon <span class="text-gradient-warm">precios con cabeza</span>
          </h1>
          <p class="hero2__sub">Tu asesor inteligente con IA, hecho en Cobija para los emprendedores de la Amazonía boliviana.</p>
          <div class="hero2__cta">
            <NuxtLink to="/registro" class="inline-flex">
              <Button label="Comenzar gratis" icon="pi pi-arrow-right" iconPos="right" class="btn-shine !w-max !rounded-full !border-0 !bg-primary-400 !px-7 !py-3.5 !text-base !font-bold !text-[#04200d]" />
            </NuxtLink>
            <NuxtLink to="/login" class="hero2__login">
              <i class="pi pi-sign-in" />Iniciar sesión
            </NuxtLink>
          </div>
          <span class="hero2__badge"><i class="pi pi-chart-bar" />Basado en un estudio a 384 negocios de Cobija</span>
        </div>
      </div>
    </section>

    <!-- Herramientas para crecer -->
    <section id="herramientas" class="mx-auto w-[min(1240px,calc(100%-32px))] py-20">
      <h2 class="section-title text-center" v-reveal>Herramientas para crecer</h2>

      <div class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="(tool, i) in tools" :key="tool.title" v-reveal="{ variant: 'scale', delay: i * 120, blur: true }">
          <article class="grow-card">
            <img :src="tool.src" :alt="tool.alt" class="grow-card__img" :style="tool.pos ? { objectPosition: tool.pos } : null" loading="lazy" />
            <div class="grow-card__scrim" />
            <div class="grow-card__body">
              <h3 class="grow-card__title font-display">{{ tool.title }}</h3>
              <a href="#" class="grow-card__link">Explorar<i class="pi pi-arrow-right text-xs" /></a>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Conoce a Haru -->
    <section id="como-funciona" class="mx-auto w-[min(1240px,calc(100%-32px))] pb-20">
      <div class="grid items-stretch gap-8 lg:grid-cols-2">
        <div class="pam-photo" v-reveal="{ variant: 'left' }">
          <img
            :src="'/haru-conoce-cta.jpg'"
            alt="Haru, el jaguar asesor de NEXA, en la selva amazónica"
            class="pam-photo__img"
            loading="lazy"
          />
        </div>

        <div class="pam-panel" v-reveal="{ variant: 'right', delay: 120 }">
          <h2 class="section-title">Conoce a <span class="text-primary-600">Haru</span>,<br />tu asesor con IA</h2>
          <p class="section-lead !mt-4 max-w-md">
            Haru analiza los datos reales de tu negocio y te dice exactamente dónde actuar.
          </p>

          <!-- Ventana de chat: demo con datos reales del negocio -->
          <div class="chat-win mt-6">
            <header class="chat-win__head">
              <span class="chat-ava chat-ava--ai">
                <img src="/haru-chat.png" alt="Haru, el jaguar asesor de NEXA" />
              </span>
              <div>
                <strong>Haru</strong>
                <small><span class="chat-win__dot" />En línea · analizando tu negocio</small>
              </div>
            </header>

            <div class="chat-win__body">
              <!-- Pregunta del usuario -->
              <div class="flex items-end justify-end gap-2.5">
                <div class="chat-bubble-user !ml-0 !max-w-[80%] !text-sm">¿Qué productos no se están vendiendo?</div>
                <span class="chat-ava chat-ava--user"><i class="pi pi-user" /></span>
              </div>

              <!-- Respuesta de Haru -->
              <div class="flex items-start gap-2.5">
                <span class="chat-ava chat-ava--ai">
                  <img src="/haru-chat.png" alt="Haru, el jaguar asesor de NEXA" />
                </span>
                <div class="chat-bubble-ai !max-w-[94%] !p-3.5 sm:!p-4">
                  <p class="mb-3 text-sm font-semibold text-[#1f2d23]">Revisé tu inventario y tus ventas de los últimos 30 días 👇</p>

                  <div class="insight insight--alert">
                    <span class="insight__icon"><i class="pi pi-exclamation-triangle" /></span>
                    <div>
                      <strong>Stock detenido — Audífonos Bluetooth A19</strong>
                      <p>18 unidades en stock · solo 2 vendidas en 3 semanas</p>
                      <p class="insight__figure">Capital inmovilizado: <b>Bs. 1.260</b></p>
                    </div>
                  </div>

                  <div class="insight insight--win">
                    <span class="insight__icon"><i class="pi pi-star-fill" /></span>
                    <div>
                      <strong>Tu producto estrella — Cargador USB-C</strong>
                      <p>Se agotó 2 veces este mes. Conviene reabastecer ya.</p>
                    </div>
                  </div>

                  <div class="insight insight--action">
                    <span class="insight__icon"><i class="pi pi-lightbulb" /></span>
                    <div>
                      <strong>Mi recomendación:</strong>
                      <p>Arma un combo “Audífonos + Cargador” a <b>Bs. 95</b> para mover el stock detenido, y promociónalo en tu estado de WhatsApp este fin de semana.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-7 flex flex-wrap items-center gap-3">
            <Button label="Hablar con Haru" icon="pi pi-comments" class="btn-shine !w-max !rounded-full !border-0 !bg-primary-500 !px-6 !py-3 !font-bold !text-white" />
            <span class="data-pill"><i class="pi pi-database" />Analizó 42 productos · 128 ventas</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA band -->
    <section id="contacto" class="mx-auto w-[min(1240px,calc(100%-32px))] pb-20">
      <div class="aurora leaf-texture cta2" v-reveal="{ variant: 'scale', blur: true }">
        <div class="cta2__copy">
          <h2 class="font-display text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            Empieza a hacer <span class="text-gradient">crecer tu negocio</span> hoy
          </h2>
          <p class="mt-4 max-w-md text-base font-medium text-[#d9f5df]">
            Crea tu cuenta gratis y descubre todo lo que NEXA y Haru pueden hacer por tu negocio.
          </p>
          <NuxtLink to="/registro" class="mt-7 inline-flex">
            <Button label="Comenzar gratis" icon="pi pi-arrow-right" iconPos="right" class="btn-shine !w-max !rounded-full !border-0 !bg-primary-400 !px-7 !py-3.5 !text-base !font-bold !text-[#04200d]" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer id="nosotros" class="bg-[#04200d] text-white">
      <div class="mx-auto grid w-[min(1240px,calc(100%-32px))] gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <a href="#inicio" class="flex items-center gap-3">
            <img src="/nexa-logo-white.webp" alt="" class="site-logo site-logo--footer" aria-hidden="true" />
            <span class="leading-none">
              <span class="font-display block text-[1.6rem] font-extrabold">NEXA</span>
              <span class="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#bfeac8]">IA para tu negocio</span>
            </span>
          </a>
          <p class="mt-5 max-w-xs text-sm font-medium leading-7 text-[#bfeac8]">
            Hecho en Cobija, Pando · Bolivia
          </p>
          <div class="mt-6 flex gap-2.5">
            <a v-for="s in socials" :key="s.label" :href="s.href" class="social-btn" :aria-label="s.label"><i :class="s.icon" /></a>
          </div>
        </div>

        <div>
          <h3 class="footer-title">Enlaces rápidos</h3>
          <a v-for="item in menuItems" :key="item.label" class="footer-link" :href="item.href">{{ item.label }}</a>
        </div>

        <div>
          <h3 class="footer-title">Legal</h3>
          <a class="footer-link" href="#">Términos y condiciones</a>
          <a class="footer-link" href="#">Política de privacidad</a>
        </div>

        <div>
          <h3 class="footer-title">Contacto</h3>
          <span class="footer-link"><i class="pi pi-map-marker mr-2" />Cobija, Pando · Bolivia</span>
          <span class="footer-link"><i class="pi pi-phone mr-2" />+591 1152 3216</span>
        </div>
      </div>

      <div class="border-t border-[#16431d]">
        <div class="mx-auto w-[min(1240px,calc(100%-32px))] py-6 text-center text-xs font-semibold text-[#bfeac8]">
          © {{ new Date().getFullYear() }} NEXA · Hecho con 💚 en Cobija, Pando — Bolivia
        </div>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.site-logo {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  object-fit: contain;
}
.site-logo--footer {
  width: 44px;
  height: 44px;
}

/* ---- Hero (full-bleed con foto de fondo) ---- */
.hero2 {
  position: relative;
  display: flex;
  align-items: center;
  overflow: hidden;
  min-height: clamp(420px, 46vw, 560px);
  border-radius: 28px;
  background: #053d17;
  box-shadow: 0 30px 70px rgba(4, 32, 13, 0.28);
}
.hero2__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
  transform: scale(1.03);
  /* focus-pull al cargar (entra desenfocada y se enfoca), luego ken-burns */
  animation:
    hero-img-in 1.6s cubic-bezier(0.16, 1, 0.3, 1) both,
    hero-zoom 22s ease-in-out 1.6s infinite alternate;
}
/* la imagen entra desenfocada y se aclara — “focus pull” cinematográfico */
@keyframes hero-img-in {
  from { opacity: 0; filter: blur(20px) saturate(1.3); }
  to { opacity: 1; filter: blur(0) saturate(1); }
}
.hero2__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(3, 26, 11, 0.92) 0%, rgba(3, 26, 11, 0.74) 32%, rgba(3, 26, 11, 0.32) 58%, rgba(3, 26, 11, 0.05) 80%, transparent 100%),
    linear-gradient(180deg, rgba(3, 26, 11, 0.35) 0%, transparent 30%, transparent 70%, rgba(3, 26, 11, 0.4) 100%);
}
.hero2__copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  max-width: 560px;
  padding: clamp(32px, 5vw, 64px);
}
/* entrada escalonada del texto: pill → título → subtítulo → CTA → badge.
   Cada línea sube y se enfoca; delays largos para un ritmo pausado. */
.hero2__copy > * {
  animation: hero-line-in 0.95s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.hero2__copy > *:nth-child(1) { animation-delay: 0.5s; }
.hero2__copy > *:nth-child(2) { animation-delay: 0.66s; }
.hero2__copy > *:nth-child(3) { animation-delay: 0.82s; }
.hero2__copy > *:nth-child(4) { animation-delay: 0.98s; }
.hero2__copy > *:nth-child(5) { animation-delay: 1.14s; }
@keyframes hero-line-in {
  from { opacity: 0; transform: translateY(28px); filter: blur(5px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}
.hero2__pill {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #eafff0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.hero2__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--lime);
  box-shadow: 0 0 10px var(--lime);
}
.hero2__title {
  font-size: clamp(2.2rem, 4vw, 3.6rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: #fff;
}
.hero2__sub {
  max-width: 460px;
  font-size: clamp(1rem, 1.4vw, 1.18rem);
  font-weight: 500;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
}
.hero2__cta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 22px;
  margin-top: 4px;
}
.hero2__login {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #eafff0;
  transition: color 0.2s ease;
}
.hero2__login:hover {
  color: var(--lime);
}
.hero2__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #d9f5df;
  font-size: 0.78rem;
  font-weight: 600;
}
/* ---- Tarjetas "Herramientas para crecer" ---- */
.grow-card {
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: 20px;
  background: linear-gradient(160deg, #0a5a20, #04270f);
  box-shadow: 0 14px 36px rgba(12, 31, 18, 0.12);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease;
}
.grow-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 26px 60px rgba(15, 158, 46, 0.22);
}
.grow-card__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.grow-card:hover .grow-card__img {
  transform: scale(1.06);
}
.grow-card__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 35%, rgba(3, 26, 11, 0.85) 100%);
}
.grow-card__body {
  position: absolute;
  inset: auto 0 0 0;
  padding: 20px;
  color: #fff;
}
.grow-card__title {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.2;
}
.grow-card__link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  background: transparent;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  transition: background 0.25s ease, border-color 0.25s ease, gap 0.25s ease;
}
.grow-card__link:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: #fff;
  gap: 12px;
}

/* ---- Conoce a Haru ---- */
.pam-photo {
  position: relative;
  overflow: hidden;
  min-height: 420px;
  border-radius: 24px;
  background: linear-gradient(160deg, #0a5a20, #04270f);
  box-shadow: 0 24px 60px rgba(4, 32, 13, 0.22);
}
.pam-photo__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pam-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(28px, 3vw, 44px);
  border-radius: 24px;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 24px 60px rgba(12, 31, 18, 0.08);
}
/* avatares del chat (junto a cada burbuja) */
.chat-ava {
  display: grid;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
}
.chat-ava--user {
  background: #e6ece8;
  color: #5a6b5f;
  font-size: 0.85rem;
}
.chat-ava--ai {
  background: #f3faf2;
  border: 1px solid var(--line);
}
.chat-ava--ai img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 22%;
}

/* ventana de chat (demo con datos del negocio) */
.chat-win {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: #fff;
  box-shadow: 0 14px 40px rgba(12, 31, 18, 0.08);
}
.chat-win__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  background: #f7fbf7;
}
.chat-win__head strong {
  display: block;
  font-size: 0.88rem;
  font-weight: 800;
  color: #11251a;
  line-height: 1.2;
}
.chat-win__head small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #3c5a46;
}
.chat-win__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary-500);
  box-shadow: 0 0 8px rgba(15, 158, 46, 0.6);
}
.chat-win__body {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: #fbfdfb;
}

/* tarjetas de insight dentro de la respuesta de Haru */
.insight {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--line);
  border-left-width: 4px;
}
.insight + .insight {
  margin-top: 10px;
}
.insight strong {
  display: block;
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1.35;
  color: #16271c;
}
.insight p {
  margin: 3px 0 0;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
  color: #42554a;
}
.insight__icon {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  font-size: 0.8rem;
}
.insight--alert {
  border-left-color: #f59e0b;
}
.insight--alert .insight__icon {
  background: #fef3c7;
  color: #b45309;
}
.insight--alert .insight__figure b {
  color: #b45309;
  font-weight: 800;
}
.insight--win {
  border-left-color: var(--primary-500);
}
.insight--win .insight__icon {
  background: var(--primary-50);
  color: var(--primary-600);
}
.insight--action {
  border-color: transparent;
  border-left-color: var(--lime);
  background: linear-gradient(160deg, var(--primary-600), var(--primary-800));
  box-shadow: 0 10px 24px rgba(15, 158, 46, 0.25);
}
.insight--action strong {
  color: #fff;
}
.insight--action p {
  color: #d9f5df;
}
.insight--action p b {
  color: #fff;
  font-weight: 800;
}
.insight--action .insight__icon {
  background: rgba(255, 255, 255, 0.16);
  color: #d4f56a;
}

/* indicador de datos analizados */
.data-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--primary-100);
  background: var(--primary-50);
  color: var(--primary-700);
  font-size: 0.74rem;
  font-weight: 700;
}
.data-pill i {
  font-size: 0.72rem;
}

/* ---- CTA band ---- */
.cta2 {
  position: relative;
  display: flex;
  align-items: center;
  overflow: hidden;
  min-height: 260px;
  border-radius: 28px;
  padding: clamp(32px, 4vw, 56px);
  box-shadow: 0 24px 60px rgba(4, 32, 13, 0.22);
  /* foto de fondo (pos-inicio-hero) con degradado verde para legibilidad */
  background:
    linear-gradient(90deg, rgba(4, 32, 13, 0.95) 0%, rgba(5, 40, 18, 0.86) 42%, rgba(5, 40, 18, 0.58) 72%, rgba(5, 40, 18, 0.42) 100%),
    url('/pos-inicio-hero.jpg') center / cover no-repeat;
}
.cta2__copy {
  position: relative;
  z-index: 2;
  max-width: 560px;
}
.cta2__mascot {
  position: absolute;
  z-index: 1;
  right: clamp(8px, 3vw, 48px);
  bottom: 0;
  width: clamp(180px, 22vw, 280px);
  height: clamp(200px, 26vw, 320px);
}

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .hero2 {
    min-height: 480px;
  }
  /* en móvil la foto va centrada y oscurecemos parejo para legibilidad */
  .hero2__bg {
    object-position: 70% center;
  }
  .hero2__scrim {
    background:
      linear-gradient(180deg, rgba(3, 26, 11, 0.62) 0%, rgba(3, 26, 11, 0.4) 36%, rgba(3, 26, 11, 0.72) 100%);
  }
  .hero2__copy {
    max-width: 100%;
  }
  /* en móvil los CTA se apilan: más aire entre "Comenzar gratis" e "Iniciar sesión" */
  .hero2__cta {
    gap: 18px 22px;
  }
  .pam-photo {
    min-height: 280px;
  }
  .cta2__mascot {
    opacity: 0.28;
  }
  .cta2__copy {
    max-width: 100%;
  }
}
</style>
