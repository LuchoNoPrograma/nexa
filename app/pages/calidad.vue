<script setup lang="ts">
definePageMeta({
  layout: 'public',
})

const qualityItems = [
  {
    icon: 'pi pi-shield',
    title: 'Datos protegidos',
    text: 'La arquitectura prevista usa Supabase, PostgreSQL y RLS para aislar la información de cada tienda.',
  },
  {
    icon: 'pi pi-check-circle',
    title: 'Decisiones claras',
    text: 'La calculadora muestra costos, margen y precio recomendado para que el emprendedor entienda el resultado.',
  },
  {
    icon: 'pi pi-users',
    title: 'Diseño para usuarios reales',
    text: 'Las pantallas priorizan lenguaje en español, flujos simples y acciones útiles para microempresas.',
  },
  {
    icon: 'pi pi-refresh',
    title: 'Mejora continua',
    text: 'El soporte POS existe para generar datos de negocio que luego alimenten recomendaciones más precisas.',
  },
]

const standards = ['Accesible para microempresas', 'Sin pasarela en MVP', 'Catálogo por WhatsApp', 'IA desde servidor', 'Una base multi-tenant']
</script>

<template>
  <main class="min-h-screen bg-[#fbfdfb]">
    <section class="mx-auto w-[min(1180px,calc(100%-32px))] py-14">
      <div class="mx-auto max-w-3xl text-center">
        <span class="section-eyebrow"><i class="pi pi-verified" />Calidad</span>
        <h1 class="font-display mt-5 text-[clamp(2.25rem,5vw,4.2rem)] font-extrabold leading-[1.04] tracking-tight text-[#0c1f12]">
          Calidad práctica para una demo sólida y escalable
        </h1>
        <p class="mt-5 text-lg font-medium leading-8 text-[#5a6b5f]">
          NEXA prioriza una experiencia pulida en landing y Kenchita IA, con soporte operativo suficiente para demostrar valor sin sobredimensionar el MVP.
        </p>
      </div>

      <div class="mt-12 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <aside class="rounded-[28px] bg-[#04200d] p-7 text-white shadow-[0_24px_60px_rgba(4,32,13,0.18)]">
          <span class="text-xs font-bold uppercase tracking-[0.16em] text-[#bfeac8]">Criterios del MVP</span>
          <h2 class="font-display mt-3 text-3xl font-extrabold leading-tight">Lo que se cuida desde el inicio</h2>
          <div class="mt-7 grid gap-3">
            <span v-for="standard in standards" :key="standard" class="inline-flex items-center gap-3 rounded-2xl bg-white/10 p-4 text-sm font-bold">
              <i class="pi pi-check text-[#f2c200]" />{{ standard }}
            </span>
          </div>
        </aside>

        <div class="grid gap-5 sm:grid-cols-2">
          <article v-for="item in qualityItems" :key="item.title" class="rounded-3xl border border-[#e7efe7] bg-white p-7 shadow-[0_14px_40px_rgba(12,31,18,0.05)]">
            <span class="grid h-12 w-12 place-items-center rounded-2xl bg-primary-50 text-xl text-primary-600">
              <i :class="item.icon" />
            </span>
            <h2 class="font-display mt-5 text-lg font-extrabold text-[#0c1f12]">{{ item.title }}</h2>
            <p class="mt-3 text-sm font-medium leading-7 text-[#5a6b5f]">{{ item.text }}</p>
          </article>
        </div>
      </div>
    </section>
  </main>
</template>
