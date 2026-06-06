<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    icon?: string
    ratio?: string
    dark?: boolean
    rounded?: string
  }>(),
  { icon: 'pi pi-image', ratio: '16 / 10', dark: false, rounded: '20px' },
)
</script>

<template>
  <div
    class="img-ph"
    :class="{ 'img-ph--dark': dark }"
    :style="{ aspectRatio: ratio, borderRadius: rounded }"
  >
    <div class="img-ph__sheen" />
    <div class="img-ph__inner">
      <i :class="icon" />
      <span v-if="label">{{ label }}</span>
    </div>
  </div>
</template>
