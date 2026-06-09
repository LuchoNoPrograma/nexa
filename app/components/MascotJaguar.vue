<script setup lang="ts">
// Kenchita, la mascota jaguar de NEXA.
//  - variant="full" → cuerpo completo (object-contain).
//  - variant="head" → recorte a la cabeza para avatares (usa el recuadro
//    x[260-820] y[60-620] del PNG 1122x1402, centrado en la cara).
withDefaults(defineProps<{ variant?: 'full' | 'head' }>(), { variant: 'full' })
</script>

<template>
  <span class="mascot" :class="`mascot--${variant}`">
    <img src="/kenchita.png" alt="Kenchita, el jaguar asesor de NEXA" loading="lazy" decoding="async" />
  </span>
</template>
