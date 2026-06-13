<script setup lang="ts">
const route = useRoute()
const session = usePosSession()
const showHaruChat = computed(() => route.path.startsWith('/pos') && Boolean(session.value))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <NuxtRouteAnnouncer />
  <HaruChatBubble v-if="showHaruChat" />
</template>
