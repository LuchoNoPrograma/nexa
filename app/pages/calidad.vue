<script setup lang="ts">
definePageMeta({
  layout: 'public',
})

const values = [
  {
    icon: 'pi pi-sparkles',
    title: 'Innovación',
    text: 'IMPULSA promueve el uso de herramientas digitales como medio para mejorar la gestión empresarial y responder a las nuevas necesidades del mercado.',
  },
  {
    icon: 'pi pi-unlock',
    title: 'Accesibilidad',
    text: 'La plataforma busca ofrecer soluciones fáciles de usar, comprensibles y adaptadas a la realidad de los pequeños negocios y emprendimientos.',
  },
  {
    icon: 'pi pi-heart',
    title: 'Compromiso',
    text: 'IMPULSA se orienta a apoyar el crecimiento de los usuarios, brindando herramientas y recomendaciones que contribuyan al fortalecimiento de sus negocios.',
  },
  {
    icon: 'pi pi-shield',
    title: 'Confianza',
    text: 'La marca busca generar seguridad en los usuarios mediante información clara, orientación práctica y apoyo en la toma de decisiones empresariales.',
  },
  {
    icon: 'pi pi-check-circle',
    title: 'Practicidad',
    text: 'Las funciones de la plataforma estarán diseñadas para ser aplicables a la realidad cotidiana de los negocios, evitando procesos complejos o difíciles de utilizar.',
  },
  {
    icon: 'pi pi-chart-line',
    title: 'Crecimiento',
    text: 'IMPULSA impulsa la mejora continua de los negocios, apoyando su organización, presencia comercial y desarrollo competitivo.',
  },
]

const qualityCriteria = [
  {
    icon: 'pi pi-comments',
    title: 'Lenguaje claro',
    text: 'La comunicación evita tecnicismos innecesarios y se centra en problemas cotidianos del negocio.',
  },
  {
    icon: 'pi pi-calculator',
    title: 'Decisiones con datos',
    text: 'Los módulos deben ayudar a calcular costos, controlar gastos, revisar rentabilidad y definir precios con mayor criterio.',
  },
  {
    icon: 'pi pi-mobile',
    title: 'Acceso simple',
    text: 'La experiencia debe funcionar bien para emprendedores que usan principalmente celular y canales como WhatsApp.',
  },
  {
    icon: 'pi pi-briefcase',
    title: 'Aplicación real',
    text: 'Cada función debe resolver una necesidad concreta: vender mejor, organizar recursos o fortalecer la imagen comercial.',
  },
]

const standards = ['Útil para microempresas', 'Fácil de entender', 'Orientado a Cobija', 'Práctico para el día a día', 'Preparado para crecer']
</script>

<template>
  <main class="quality-page min-h-screen bg-[#fbfdfb] text-[#0c1f12]">
    <section class="mx-auto w-[min(1080px,calc(100%-32px))] py-16">
      <div v-reveal class="max-w-3xl">
        <span class="section-eyebrow"><i class="pi pi-verified" />Calidad</span>
        <h1 class="font-display mt-5 text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-tight text-[#0c1f12]">
          Calidad significa que IMPULSA sea útil, clara y aplicable
        </h1>
        <p class="mt-5 text-lg font-medium leading-8 text-[#5a6b5f]">
          La calidad del proyecto no se mide solo por tecnología. Se mide por su capacidad de ayudar a negocios reales a organizarse, decidir mejor y crecer sin procesos complicados.
        </p>
      </div>

      <div class="mt-10 flex flex-wrap gap-3" v-reveal="{ delay: 120 }">
        <span v-for="standard in standards" :key="standard" class="quality-pill">
          <i class="pi pi-check" />{{ standard }}
        </span>
      </div>
    </section>

    <section class="border-y border-[#e8f0e9] bg-white py-14">
      <div class="mx-auto w-[min(1080px,calc(100%-32px))]">
        <div v-reveal class="max-w-2xl">
          <span class="section-eyebrow"><i class="pi pi-star" />Valores</span>
          <h2 class="font-display mt-4 text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-tight text-[#0c1f12]">
            Valores que sostienen la calidad
          </h2>
          <p class="mt-4 text-base font-medium leading-8 text-[#5a6b5f]">
            Estos principios vienen de la identidad estratégica del proyecto y guían cómo se diseña, comunica y valida la plataforma.
          </p>
        </div>

        <div class="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="(value, index) in values" :key="value.title" v-reveal="{ variant: 'scale', delay: index * 70, blur: true }" class="value-card">
            <span class="card-icon"><i :class="value.icon" /></span>
            <h3>{{ value.title }}</h3>
            <p>{{ value.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="mx-auto grid w-[min(1080px,calc(100%-32px))] gap-8 py-16 lg:grid-cols-[0.85fr_1.15fr]">
      <aside v-reveal="{ variant: 'left' }" class="quality-panel">
        <span>Enfoque</span>
        <h2 class="font-display">Criterios para evaluar la experiencia</h2>
        <p>
          IMPULSA debe sentirse como apoyo empresarial cercano: accesible para empezar, práctico para usar y confiable para decidir.
        </p>
      </aside>

      <div class="grid gap-4 sm:grid-cols-2">
        <article v-for="(item, index) in qualityCriteria" :key="item.title" v-reveal="{ variant: 'right', delay: index * 90 }" class="criterion-card">
          <span class="card-icon"><i :class="item.icon" /></span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.quality-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid #dbe8dc;
  border-radius: 999px;
  background: #fff;
  color: #0a6f1f;
  font-size: 0.86rem;
  font-weight: 800;
  box-shadow: 0 10px 28px rgba(12, 31, 18, 0.04);
}

.quality-pill i {
  color: var(--primary-600);
  font-size: 0.78rem;
}

.value-card,
.criterion-card,
.quality-panel {
  border: 1px solid #e0ebe2;
  box-shadow: 0 14px 36px rgba(12, 31, 18, 0.05);
}

.value-card,
.criterion-card {
  min-height: 220px;
  padding: 24px;
  border-radius: 22px;
  background: #fff;
}

.card-icon {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 16px;
  background: var(--primary-50);
  color: var(--primary-700);
  font-size: 1rem;
}

.value-card h3,
.criterion-card h3 {
  margin: 18px 0 10px;
  color: #0c1f12;
  font-size: 1.08rem;
  font-weight: 900;
}

.value-card p,
.criterion-card p,
.quality-panel p {
  margin: 0;
  color: #5a6b5f;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.7;
}

.quality-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 360px;
  padding: clamp(26px, 4vw, 36px);
  border-radius: 26px;
  background: #04200d;
  color: #fff;
}

.quality-panel span {
  color: #bfeac8;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
}

.quality-panel h2 {
  margin: 12px 0 18px;
  max-width: 360px;
  font-size: clamp(1.9rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1.05;
}

.quality-panel p {
  color: #d9f5df;
}
</style>
