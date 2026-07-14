<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'small' | 'medium'
  inverse?: boolean
}>(), {
  size: 'medium',
  inverse: false,
})
</script>

<template>
  <span
    class="pos-spinner"
    :class="[`pos-spinner--${size}`, { 'pos-spinner--inverse': inverse }]"
    aria-hidden="true"
  >
    <span v-if="size === 'medium'" class="pos-spinner__mark">
      <img src="/nexa-logo-color.webp" alt="">
    </span>
  </span>
</template>

<style scoped>
.pos-spinner {
  --spinner-size: 42px;
  --spinner-ring: 3px;
  position: relative;
  display: grid;
  width: var(--spinner-size);
  height: var(--spinner-size);
  flex: 0 0 var(--spinner-size);
  place-items: center;
  border-radius: 50%;
}

.pos-spinner::before {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: conic-gradient(
    from 20deg,
    #0b1f3a 0deg 108deg,
    #16a34a 108deg 224deg,
    #f2c200 224deg 258deg,
    rgba(11, 31, 58, 0.1) 258deg 360deg
  );
  content: "";
  animation: pos-spinner-rotate 0.72s linear infinite;
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--spinner-ring)),
    #000 calc(100% - var(--spinner-ring) + 0.5px)
  );
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--spinner-ring)),
    #000 calc(100% - var(--spinner-ring) + 0.5px)
  );
  will-change: transform;
}

.pos-spinner__mark {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid rgba(11, 31, 58, 0.08);
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(11, 31, 58, 0.1);
}

.pos-spinner__mark img {
  width: 21px;
  height: 21px;
  object-fit: contain;
}

.pos-spinner--small {
  --spinner-size: 18px;
  --spinner-ring: 2.5px;
}

.pos-spinner--inverse::before {
  background: conic-gradient(
    from 20deg,
    #ffffff 0deg 176deg,
    #f2c200 176deg 244deg,
    rgba(255, 255, 255, 0.28) 244deg 360deg
  );
}

@keyframes pos-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pos-spinner::before {
    animation: none;
  }
}
</style>
