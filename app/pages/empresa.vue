<script setup lang="ts">
definePageMeta({
  layout: 'public',
})

const pillars = [
  {
    icon: 'pi pi-map-marker',
    title: 'Origen local',
    text: 'IMPULSA nace en Cobija para responder a negocios que necesitan vender mejor, organizarse y usar tecnología sin complejidad.',
  },
  {
    icon: 'pi pi-briefcase',
    title: 'Enfoque empresarial',
    text: 'La plataforma combina asesoramiento digital, soporte operativo POS, precios rentables, branding y catálogo por WhatsApp.',
  },
  {
    icon: 'pi pi-sparkles',
    title: 'Asesoría con IA',
    text: 'Haru IA entrega recomendaciones prácticas por rubro, con lenguaje claro y contexto del mercado local.',
  },
]

const modules = ['Soporte POS', 'Haru IA', 'Calculadora de precios', 'Marketing y branding', 'Catálogo WhatsApp']
</script>

<template>
  <main class="min-h-screen bg-white">
    <section class="mx-auto grid w-[min(1240px,calc(100%-32px))] items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <span class="section-eyebrow"><i class="pi pi-building" />Empresa</span>
        <h1 class="font-display mt-5 max-w-3xl text-[clamp(2.35rem,5vw,4.5rem)] font-extrabold leading-[1.03] tracking-tight text-[#0c1f12]">
          Tecnología empresarial para microempresas de Cobija
        </h1>
        <p class="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#5a6b5f]">
          IMPULSA es un MVP académico y estudio de factibilidad para una plataforma web de asesoramiento empresarial digital con proyección nacional.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <Button label="Ver herramientas" icon="pi pi-arrow-right" icon-pos="right" class="btn-shine !rounded-full !border-0 !bg-primary-500 !px-6 !py-3 !font-bold !text-white" />
          <NuxtLink to="/contacto" class="inline-flex items-center gap-2 rounded-full border border-[#dbe8dc] px-6 py-3 text-sm font-bold text-[#0a6f1f] transition hover:border-primary-300 hover:bg-primary-50">
            Contactar equipo
          </NuxtLink>
        </div>
      </div>

      <div class="rounded-[28px] border border-[#e7efe7] bg-[#f7fbf7] p-5 shadow-[0_24px_60px_rgba(12,31,18,0.08)]">
        <div class="overflow-hidden rounded-3xl bg-[#04200d] p-6 text-white">
          <div class="flex items-center justify-between border-b border-white/10 pb-5">
            <div>
              <span class="text-xs font-bold uppercase tracking-[0.16em] text-[#bfeac8]">IMPULSA</span>
              <h2 class="font-display mt-1 text-2xl font-extrabold">Panel de crecimiento</h2>
            </div>
            <span class="grid h-12 w-12 place-items-center rounded-2xl bg-primary-500 text-xl"><i class="pi pi-chart-line" /></span>
          </div>
          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <div v-for="module in modules" :key="module" class="rounded-2xl border border-white/10 bg-white/10 p-4">
              <span class="text-sm font-bold">{{ module }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto w-[min(1240px,calc(100%-32px))] pb-16">
      <div class="grid gap-5 md:grid-cols-3">
        <article v-for="pillar in pillars" :key="pillar.title" class="rounded-3xl border border-[#e7efe7] bg-white p-7 shadow-[0_14px_40px_rgba(12,31,18,0.05)]">
          <span class="tool-ic"><i :class="pillar.icon" /></span>
          <h2 class="font-display mt-5 text-xl font-extrabold text-[#0c1f12]">{{ pillar.title }}</h2>
          <p class="mt-3 text-sm font-medium leading-7 text-[#5a6b5f]">{{ pillar.text }}</p>
        </article>
      </div>
    </section>
  </main>
</template>
