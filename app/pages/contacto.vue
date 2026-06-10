<script setup lang="ts">
definePageMeta({
  layout: 'public',
})

const numero = '59111523216'
const mensaje = encodeURIComponent('¡Hola NEXA! 👋 Me interesa conocer más sobre cómo Kenchita puede ayudar a mi negocio.')
const waLink = `https://wa.me/${numero}?text=${mensaje}`

const emailForm = reactive({
  nombre: '',
  telefono: '',
  rubro: '',
  mensaje: '',
})

const isSendingContact = ref(false)
const contactStatus = ref<'idle' | 'success' | 'error'>('idle')
const contactFeedback = ref('')

async function submitContact() {
  if (isSendingContact.value) {
    return
  }

  contactStatus.value = 'idle'
  contactFeedback.value = ''
  isSendingContact.value = true

  try {
    const response = await $fetch<{ message: string }>('/api/contacto', {
      method: 'POST',
      body: {
        nombre: emailForm.nombre,
        telefono: emailForm.telefono,
        rubro: emailForm.rubro,
        mensaje: emailForm.mensaje,
      },
    })

    contactStatus.value = 'success'
    contactFeedback.value = response.message
    emailForm.nombre = ''
    emailForm.telefono = ''
    emailForm.rubro = ''
    emailForm.mensaje = ''
  } catch (error) {
    contactStatus.value = 'error'
    contactFeedback.value = typeof error === 'object' && error && 'data' in error
      ? String((error.data as { statusMessage?: string }).statusMessage ?? 'No se pudo registrar la consulta. Intenta nuevamente.')
      : 'No se pudo registrar la consulta. Intenta nuevamente.'
  } finally {
    isSendingContact.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-white">
    <section class="mx-auto grid w-[min(1180px,calc(100%-32px))] items-start gap-10 pt-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div v-reveal>
        <h1 class="font-display text-[clamp(2.3rem,5vw,4.1rem)] font-extrabold leading-[1.04] tracking-tight text-[#0c1f12]">
          ¿Conversamos?
        </h1>
        <p class="mt-5 text-lg font-medium leading-8 text-[#5a6b5f]">
          Si tienes alguna pregunta, no dudes en enviarnos un mensaje. Estamos para ayudarte.
        </p>
        <p class="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#1f2d23]">
          <i class="pi pi-map-marker text-primary-600" />
          Cobija, Pando · Bolivia
        </p>

        <article class="mt-8 rounded-[28px] border border-[#d7ebd9] bg-primary-50 p-6 shadow-[0_18px_44px_rgba(15,158,46,0.10)]">
          <div class="flex items-start gap-4">
            <div>
              <h2 class="font-display text-xl font-extrabold text-[#0c1f12]">Atención rápida por WhatsApp</h2>
              <p class="mt-2 text-sm font-medium leading-6 text-[#5a6b5f]">
                Escríbenos y te responderemos con orientación clara para tu negocio.
              </p>
            </div>
          </div>

          <a
            :href="waLink"
            target="_blank"
            rel="noopener noreferrer"
            class="contact-action-link btn-shine mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-3.5 text-sm font-bold shadow-[0_14px_30px_rgba(15,158,46,0.24)] transition hover:bg-primary-600 sm:w-auto"
          >
            <i class="pi pi-whatsapp" />
            Escribir por WhatsApp
          </a>
        </article>
      </div>

      <div class="grid gap-5" v-reveal="{ delay: 120 }">
        <form class="rounded-[28px] border border-[#e7efe7] bg-[#f7fbf7] p-6 shadow-[0_24px_60px_rgba(12,31,18,0.08)]" @submit.prevent="submitContact">
          <div class="mb-6">
            <h2 class="font-display text-xl font-extrabold text-[#0c1f12]">Enviar consulta</h2>
            <p class="mt-2 text-sm font-medium leading-6 text-[#5a6b5f]">
              Completa tus datos y registraremos tu consulta para responderte por celular.
            </p>
          </div>

          <div class="grid gap-5 sm:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-bold text-[#1f2d23]">Nombre</span>
              <InputText v-model="emailForm.nombre" placeholder="Tu nombre" class="!rounded-2xl" required />
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-bold text-[#1f2d23]">Celular</span>
              <InputText v-model="emailForm.telefono" placeholder="+591 ..." class="!rounded-2xl" />
            </label>
            <label class="grid gap-2 sm:col-span-2">
              <span class="text-sm font-bold text-[#1f2d23]">Tipo de negocio</span>
              <InputText v-model="emailForm.rubro" placeholder="Abarrotes, comida, ropa, servicios..." class="!rounded-2xl" />
            </label>
            <label class="grid gap-2 sm:col-span-2">
              <span class="text-sm font-bold text-[#1f2d23]">Mensaje</span>
              <Textarea v-model="emailForm.mensaje" rows="5" placeholder="Cuéntanos cómo podemos ayudarte" class="!rounded-2xl" required />
            </label>
          </div>

          <p
            v-if="contactFeedback"
            class="mt-5 rounded-2xl border px-4 py-3 text-sm font-bold"
            :class="contactStatus === 'success'
              ? 'border-primary-100 bg-primary-50 text-primary-700'
              : 'border-red-100 bg-red-50 text-red-700'"
          >
            {{ contactFeedback }}
          </p>

          <Button
            type="submit"
            label="Enviar consulta"
            icon="pi pi-envelope"
            :loading="isSendingContact"
            class="btn-shine !mt-6 !rounded-full !border-0 !bg-primary-500 !px-6 !py-3.5 !text-sm !font-bold !text-white hover:!bg-primary-600"
          />
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
.contact-action-link,
.contact-action-link:hover,
.contact-action-link:focus,
.contact-action-link:active,
.contact-action-link:visited {
  color: #fff;
}

.contact-action-link i {
  color: inherit;
}
</style>
