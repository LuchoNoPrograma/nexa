import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import tailwindcss from '@tailwindcss/vite'

const NexaPrimePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e8f6ee',
      100: '#ccebd8',
      200: '#98d3b0',
      300: '#74d28f',
      400: '#2fb452',
      500: '#0b982f',
      600: '#087a28',
      700: '#066322',
      800: '#022c14',
      900: '#021f0f',
      950: '#011408',
    },
  },
})

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@nuxt/icon',
    '@primevue/nuxt-module',
  ],
  icon: {
    // Iconos coloridos/3D (Fluent Emoji) servidos localmente, sin llamadas externas.
    serverBundle: 'local',
  },
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
        { name: 'theme-color', content: '#0b982f' },
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
        preset: NexaPrimePreset,
        options: {
          prefix: 'p',
          darkModeSelector: 'light',
          cssLayer: false,
        },
      },
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      // Pre-bundle de devtools para evitar recargas completas en desarrollo.
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ],
    },
  },
})
