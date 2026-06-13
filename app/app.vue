<script setup lang="ts">
const route = useRoute()
const session = usePosSession()
const pageTransition = computed(() => route.path.startsWith('/pos') ? { name: 'pos-page' } : false)
const showHaruChat = computed(() => route.path.startsWith('/pos') && Boolean(session.value))
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage :transition="pageTransition" />
  </NuxtLayout>
  <HaruChatBubble v-if="showHaruChat" />
</template>
