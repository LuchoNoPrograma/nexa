// Scroll-reveal directive: adds `.is-visible` when the element enters the viewport.
// Universal plugin — registers an SSR-safe directive so `v-reveal` resolves during SSR,
// while the IntersectionObserver only runs in the browser.
// Usage: v-reveal  or  v-reveal="{ delay: 120 }"
export default defineNuxtPlugin((nuxtApp) => {
  let io: IntersectionObserver | null = null
  let prefersReduced = false

  if (import.meta.client) {
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io?.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
  }

  nuxtApp.vueApp.directive('reveal', {
    // Keep SSR markup neutral (no hidden state) to avoid a flash before hydration.
    getSSRProps() {
      return {}
    },
    mounted(el: HTMLElement, binding) {
      if (!import.meta.client || prefersReduced) {
        el.classList.add('is-visible')
        return
      }
      el.classList.add('reveal')
      const delay = binding.value?.delay
      if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`)
      io?.observe(el)
    },
    unmounted(el: HTMLElement) {
      io?.unobserve(el)
    },
  })
})
