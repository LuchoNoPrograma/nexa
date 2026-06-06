<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    to: number
    duration?: number
    prefix?: string
    suffix?: string
    decimals?: number
  }>(),
  { duration: 1700, prefix: '', suffix: '', decimals: 0 },
)

const el = ref<HTMLElement | null>(null)
const display = ref(0)
let started = false

const formatted = computed(() =>
  display.value.toLocaleString('es-BO', {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  }),
)

function animate() {
  if (started) return
  started = true
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / props.duration)
    const eased = 1 - Math.pow(1 - p, 3)
    display.value = eased * props.to
    if (p < 1) requestAnimationFrame(step)
    else display.value = props.to
  }
  requestAnimationFrame(step)
}

onMounted(() => {
  if (!el.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    display.value = props.to
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          animate()
          io.disconnect()
        }
      }
    },
    { threshold: 0.4 },
  )
  io.observe(el.value)
})
</script>

<template>
  <span ref="el">{{ prefix }}{{ formatted }}{{ suffix }}</span>
</template>
