import Aura from '@primeuix/themes/aura'
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@primevue/nuxt-module',
  ],
  css: [
    '~/assets/css/main.css',
    'primeicons/primeicons.css',
  ],
  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'NEXA — IA para hacer crecer tu negocio | Cobija, Pando',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'NEXA es tu asistente inteligente que te ayuda a vender más, atraer clientes y poner precios justos. Hecho en la Amazonía boliviana.',
        },
        { name: 'theme-color', content: '#04200d' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap',
        },
      ],
    },
  },
  primevue: {
    options: {
      ripple: true,
      inputVariant: 'filled',
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: 'system',
          cssLayer: false,
        },
      },
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
})
