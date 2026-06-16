<script setup lang="ts">
definePageMeta({
  layout: 'pos',
  posTitle: 'Planes',
})

useHead({ title: 'Planes | NEXA' })

const session = usePosSession()

// En "solo visualización" no hay catálogo en BD: el plan activo de la tienda no
// se persiste todavía, así que asumimos el gratuito como punto de partida.
const planActual = ref('free')
const seleccionado = ref('')

function onSeleccionar(codigo: string) {
  // Placeholder de "solo visualización": registramos la intención en cliente.
  // Aquí se conectará el flujo de pago en una fase posterior.
  seleccionado.value = codigo
}
</script>

<template>
  <div class="planes">
    <header class="planes-hero">
      <MascotJaguar variant="head" class="planes-hero__avatar" />
      <div class="planes-hero__copy">
        <span class="planes-kicker"><i class="pi pi-bolt" /> Elige tu plan</span>
        <h1>Potencia tu negocio con NEXA</h1>
        <p>Empieza gratis y mejora cuando lo necesites. Sin permanencia, cancela cuando quieras.</p>
      </div>
    </header>

    <PosPlanSelector
      v-model="seleccionado"
      :plan-actual="planActual"
      cta-label="Mejorar mi plan"
      @seleccionar="onSeleccionar"
    />

    <p v-if="seleccionado" class="planes-aviso">
      <i class="pi pi-info-circle" />
      Elegiste el plan <strong>{{ seleccionado }}</strong>. El pago en línea estará disponible muy pronto.
    </p>
  </div>
</template>

<style scoped>
.planes {
  display: grid;
  gap: 22px;
  max-width: 1040px;
  margin: 0 auto;
  padding-bottom: 12px;
}

.planes-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 24px;
  border-radius: 20px;
  background: linear-gradient(120deg, #edf7e8, #f4faf2);
  border: 1px solid #dcecdc;
}

.planes-hero__avatar {
  width: 60px;
  height: 60px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #d5f1d9;
  box-shadow: 0 6px 14px rgba(15, 158, 46, 0.16);
}

.planes-hero__copy {
  display: grid;
  gap: 5px;
}

.planes-kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: max-content;
  padding: 5px 11px;
  border-radius: 999px;
  background: #fff;
  color: #2d7c2f;
  font-size: 0.72rem;
  font-weight: 900;
}

.planes-hero__copy h1 {
  margin: 0;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: clamp(1.4rem, 2.4vw, 1.9rem);
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #102016;
}

.planes-hero__copy p {
  margin: 0;
  color: #5d6b61;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.5;
}

.planes-aviso {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 14px;
  background: #f4faf2;
  border: 1px solid #e2efe0;
  font-size: 0.86rem;
  font-weight: 700;
  color: #2f4a37;
}

.planes-aviso i {
  color: #0b6f38;
}

.planes-aviso strong {
  text-transform: capitalize;
}

@media (max-width: 640px) {
  .planes-hero { flex-direction: column; text-align: center; }
  .planes-kicker { margin: 0 auto; }
}
</style>
