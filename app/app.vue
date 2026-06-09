<script setup lang="ts">
const route = useRoute()
const pageTransition = computed(() => route.path.startsWith('/pos') ? { name: 'pos-page' } : false)
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage :transition="pageTransition" />
  </NuxtLayout>
</template>
