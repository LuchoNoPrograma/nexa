<script setup lang="ts">
import { tieneAcceso } from '~~/shared/utils/acceso'

const route = useRoute()
const session = usePosSession()
// El chat flotante se oculta en el diagnóstico (onboarding a pantalla completa)
// y mientras el onboarding no esté completado.
const showHaruChat = computed(() =>
  route.path.startsWith('/pos')
  && route.path !== '/pos/diagnostico'
  && Boolean(session.value)
  && session.value?.onboardingDiagnostico === 'completado'
  && tieneAcceso('HARU', session.value!),
)
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <NuxtRouteAnnouncer />
  <HaruChatBubble v-if="showHaruChat" />
</template>
