import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import tailwindcss from '@tailwindcss/vite'

const NexaPrimePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#ecfdf0',
      100: '#d5f8dc',
      200: '#aef0bd',
      300: '#75e592',
      400: '#35d35c',
      500: '#0f9e2e',
      600: '#0c8a28',
      700: '#0a6f1f',
      800: '#09581b',
      900: '#084818',
      950: '#04270c',
    },
  },
})

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
        { name: 'theme-color', content: '#0f9e2e' },
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
  },
})
