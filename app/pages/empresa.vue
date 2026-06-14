<script setup lang="ts">
definePageMeta({
  layout: 'public',
})

const missionVision = [
  {
    icon: 'pi pi-compass',
    title: 'Misión',
    text: 'Brindar soluciones de asesoramiento empresarial digital que permitan a las microempresas, pequeños negocios y emprendimientos fortalecer su gestión, mejorar la toma de decisiones y potenciar su crecimiento mediante el uso de herramientas tecnológicas accesibles, prácticas e innovadoras.',
  },
  {
    icon: 'pi pi-eye',
    title: 'Visión',
    text: 'Ser una plataforma referente en asesoramiento empresarial digital, reconocida por impulsar la transformación y el desarrollo de microempresas, pequeños negocios y emprendimientos a través de soluciones tecnológicas innovadoras que contribuyan a su competitividad, sostenibilidad y crecimiento en el mercado.',
  },
]

const focusAreas = [
  'Gestión financiera para calcular costos, precios y rentabilidad con más claridad.',
  'Fortalecimiento comercial con recomendaciones prácticas para vender mejor.',
  'Identidad empresarial para mejorar la presentación e imagen del negocio.',
]
</script>

<template>
  <main class="company-page min-h-screen bg-white text-[#0c1f12]">
    <section class="company-intro mx-auto w-[min(1040px,calc(100%-32px))] py-16 sm:py-20">
      <div v-reveal class="max-w-3xl">
        <span class="section-eyebrow"><i class="pi pi-building" />Conócenos</span>
        <h1 class="font-display mt-5 text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-tight text-[#0c1f12]">
          NEXA acompaña el crecimiento de los negocios locales
        </h1>
        <p class="mt-5 text-lg font-medium leading-8 text-[#5a6b5f]">
          Somos una propuesta de plataforma web de asesoramiento empresarial digital pensada para microempresas, pequeños negocios y emprendimientos de Cobija, con proyección nacional.
        </p>
      </div>

      <div class="mt-10 grid gap-4 md:grid-cols-3">
        <article v-for="(area, index) in focusAreas" :key="area" v-reveal="{ variant: 'scale', delay: index * 100, blur: true }" class="focus-card">
          <span>{{ index + 1 }}</span>
          <p>{{ area }}</p>
        </article>
      </div>
    </section>

    <section class="company-band border-y border-[#e8f0e9] bg-[#f7fbf7] py-14">
      <div class="mx-auto w-[min(1040px,calc(100%-32px))]">
        <div v-reveal class="max-w-2xl">
          <span class="section-eyebrow"><i class="pi pi-flag" />Propósito</span>
          <h2 class="font-display mt-4 text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-tight text-[#0c1f12]">
            Misión y visión
          </h2>
        </div>

        <div class="mt-8 grid gap-5 lg:grid-cols-2">
          <article v-for="(item, index) in missionVision" :key="item.title" v-reveal="{ variant: 'left', delay: index * 120 }" class="mv-card">
            <span class="card-icon"><i :class="item.icon" /></span>
            <div>
              <h3 class="font-display">{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="mx-auto w-[min(1040px,calc(100%-32px))] py-16">
      <div v-reveal class="closing-note">
        <span class="section-eyebrow"><i class="pi pi-lightbulb" />Enfoque</span>
        <h2 class="font-display">Más que una herramienta, un apoyo empresarial</h2>
        <p>
          NEXA integra gestión financiera, fortalecimiento comercial e identidad empresarial para que los negocios encuentren en un solo espacio orientación práctica y fácil de aplicar.
        </p>
        <NuxtLink to="/calidad">
          Ver valores y calidad <i class="pi pi-arrow-right" aria-hidden="true" />
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.company-intro {
  position: relative;
}

.company-intro::before {
  position: absolute;
  top: 42px;
  right: 0;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-400) 12%, transparent);
  content: '';
  filter: blur(2px);
}

.focus-card,
.mv-card {
  border: 1px solid #e0ebe2;
  background: #fff;
  box-shadow: 0 14px 36px rgba(12, 31, 18, 0.05);
}

.focus-card {
  min-height: 150px;
  padding: 22px;
  border-radius: 20px;
}

.focus-card span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 13px;
  background: var(--primary-50);
  color: var(--primary-700);
  font-weight: 900;
}

.focus-card p {
  margin: 16px 0 0;
  color: #4f6255;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.65;
}

.mv-card {
  display: flex;
  gap: 16px;
  padding: 24px;
  border-radius: 22px;
}

.mv-card {
  min-height: 235px;
}

.card-icon {
  display: grid;
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 16px;
  background: var(--primary-50);
  color: var(--primary-700);
  font-size: 1rem;
}

.mv-card h3 {
  margin: 0;
  color: #0c1f12;
  font-size: 1.15rem;
  font-weight: 900;
}

.mv-card p {
  margin: 10px 0 0;
  color: #5a6b5f;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.7;
}

.closing-note {
  max-width: 760px;
  padding: clamp(26px, 4vw, 38px);
  border: 1px solid #e0ebe2;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 14px 36px rgba(12, 31, 18, 0.05);
}

.closing-note h2 {
  margin: 14px 0 12px;
  color: #0c1f12;
  font-size: clamp(1.75rem, 4vw, 2.8rem);
  font-weight: 800;
  line-height: 1.1;
}

.closing-note p {
  margin: 0;
  color: #5a6b5f;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.75;
}

.closing-note a {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-top: 22px;
  color: var(--primary-700);
  font-size: 0.92rem;
  font-weight: 900;
}

@media (max-width: 760px) {
  .company-intro::before {
    display: none;
  }

  .mv-card {
    padding: 20px;
  }
}
</style>
