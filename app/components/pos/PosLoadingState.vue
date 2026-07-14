<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean
  mode?: 'overlay' | 'viewport' | 'section' | 'compact'
  label?: string
  detail?: string
}>(), {
  visible: true,
  mode: 'section',
  label: 'Cargando',
  detail: '',
})
</script>

<template>
  <Transition name="pos-loading-state">
    <div
      v-if="visible"
      class="pos-loading-state"
      :class="`pos-loading-state--${mode}`"
      role="status"
      aria-live="polite"
      :aria-label="label"
    >
      <div class="pos-loading-state__panel">
        <PosLoadingSpinner />
        <span class="pos-loading-state__copy">
          <strong>{{ label }}</strong>
          <small v-if="detail">{{ detail }}</small>
        </span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pos-loading-state {
  z-index: 10;
  display: grid;
  place-items: center;
  color: #0b1f3a;
}

.pos-loading-state--overlay {
  position: absolute;
  inset: 0;
  min-height: 220px;
  padding: 24px;
  background: rgba(243, 244, 246, 0.86);
  pointer-events: auto;
}

.pos-loading-state--viewport {
  position: fixed;
  inset: 0;
  z-index: 1100;
  width: 100vw;
  max-width: none !important;
  padding: 24px;
  background: #f3f4f6;
}

.pos-loading-state--section {
  width: 100%;
  min-height: clamp(240px, 46dvh, 420px);
  padding: 32px 20px;
}

.pos-loading-state--compact {
  width: 100%;
  min-height: 124px;
  padding: 24px 16px;
}

.pos-loading-state__panel {
  display: inline-flex;
  min-width: min(100%, 210px);
  min-height: 64px;
  align-items: center;
  justify-content: center;
  gap: 13px;
  padding: 10px 18px 10px 11px;
  border: 1px solid rgba(11, 31, 58, 0.1);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(11, 31, 58, 0.12);
}

.pos-loading-state--overlay .pos-loading-state__panel {
  position: fixed;
  top: 50%;
  left: calc(50vw + var(--sidebar-center-offset, 0px));
  transform: translate(-50%, -50%);
}

.pos-loading-state__copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.pos-loading-state__copy strong {
  font-size: 0.88rem;
  font-weight: 850;
  line-height: 1.25;
}

.pos-loading-state__copy small {
  color: #68776e;
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.3;
}

.pos-loading-state-enter-active,
.pos-loading-state-leave-active {
  transition: opacity 0.1s ease;
}

.pos-loading-state-enter-from,
.pos-loading-state-leave-to {
  opacity: 0;
}

.pos-loading-state-enter-active .pos-loading-state__panel,
.pos-loading-state-leave-active .pos-loading-state__panel {
  transition: transform 0.1s ease;
}

.pos-loading-state-enter-from:not(.pos-loading-state--overlay) .pos-loading-state__panel {
  transform: translateY(3px);
}

.pos-loading-state--overlay.pos-loading-state-enter-from .pos-loading-state__panel {
  transform: translate(-50%, calc(-50% + 3px));
}

@media (max-width: 760px) {
  .pos-loading-state--overlay .pos-loading-state__panel {
    left: 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pos-loading-state-enter-active,
  .pos-loading-state-leave-active,
  .pos-loading-state__panel {
    transition: none;
  }
}
</style>
