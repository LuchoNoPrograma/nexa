<script setup lang="ts">
type BusinessProfile = {
  businessName: string
  contacto: string | null
  ubicacion: string | null
  confirmado: boolean
}

const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const profileConfirmed = ref(true)
const form = reactive({ businessName: '', countryDialCode: '+591', phone: '', ubicacion: '' })
const sessionStore = useSessionStore()

function splitPhone(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '')
  const dialCode = ['591', '51', '55'].find(code => digits.startsWith(code)) ?? '591'
  return { countryDialCode: `+${dialCode}`, phone: digits.slice(dialCode.length) }
}

async function loadProfile(open = false) {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ profile: BusinessProfile }>('/api/pos/business-profile')
    const phone = splitPhone(result.profile.contacto)
    form.businessName = result.profile.businessName
    form.countryDialCode = phone.countryDialCode
    form.phone = phone.phone
    form.ubicacion = result.profile.ubicacion ?? ''
    const profileComplete = result.profile.confirmado
      && Boolean(result.profile.contacto?.trim())
      && Boolean(result.profile.ubicacion?.trim())
    profileConfirmed.value = profileComplete
    if (open || !profileComplete) visible.value = true
  } catch {
    errorMessage.value = 'No se pudo cargar el perfil del negocio.'
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/pos/business-profile', { method: 'PUT', body: form })
    profileConfirmed.value = true
    visible.value = false
    await sessionStore.load({ force: true })
    window.dispatchEvent(new CustomEvent('nexa:business-profile-saved'))
  } catch (error: unknown) {
    errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
      ?? 'No se pudo guardar el perfil.'
  } finally {
    saving.value = false
  }
}

function requestOpen() {
  void loadProfile(true)
}

onMounted(() => {
  window.addEventListener('nexa:open-business-profile', requestOpen)
  void loadProfile(false)
})

onBeforeUnmount(() => window.removeEventListener('nexa:open-business-profile', requestOpen))
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Perfil del negocio"
    :closable="profileConfirmed && !saving"
    :close-on-escape="profileConfirmed && !saving"
    :dismissable-mask="false"
    class="business-profile-dialog"
  >
    <form class="business-profile" @submit.prevent="saveProfile">
      <header class="business-profile__head">
        <span class="business-profile__icon"><i class="pi pi-megaphone" aria-hidden="true" /></span>
        <div class="business-profile__copy">
          <span>Datos para publicidad</span>
          <h2>Perfil del negocio</h2>
          <p>Estos datos identifican tu negocio y se usan en tus imágenes y publicaciones.</p>
        </div>
      </header>

      <div class="business-profile__field">
        <label for="business-profile-name">Nombre del negocio</label>
        <InputText id="business-profile-name" v-model="form.businessName" maxlength="120" fluid :disabled="loading || saving" required />
      </div>

      <div class="business-profile__field">
        <label for="business-profile-phone">Contacto comercial</label>
        <SharedPhoneCountryInput
          v-model:country-dial-code="form.countryDialCode"
          v-model:phone="form.phone"
          input-id="business-profile-phone"
          name="businessProfilePhone"
          autocomplete="tel"
          :disabled="loading || saving"
          required
        />
      </div>

      <div class="business-profile__field">
        <label for="business-profile-location">Ubicación pública</label>
        <InputText id="business-profile-location" v-model="form.ubicacion" maxlength="160" fluid :disabled="loading || saving" required />
      </div>

      <Message v-if="errorMessage" severity="error" size="small">{{ errorMessage }}</Message>

      <div class="business-profile__actions">
        <Button v-if="profileConfirmed" type="button" label="Cancelar" severity="secondary" text :disabled="saving" @click="visible = false" />
        <Button type="submit" label="Guardar perfil" icon="pi pi-check" :loading="saving" :disabled="loading" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
:global(.business-profile-dialog.p-dialog) {
  width: min(92vw, 480px);
  overflow: hidden;
  border: 1px solid #e5ebe7;
  border-radius: 18px;
}

:global(.business-profile-dialog .p-dialog-header) {
  display: none;
}

:global(.business-profile-dialog .p-dialog-content) {
  padding: 0;
}

.business-profile {
  display: grid;
  gap: 17px;
  padding: 26px;
  border-top: 5px solid #f2c200;
  background: #ffffff;
}

.business-profile__head {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
}

.business-profile__icon {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 14px;
  background: #fff8d7;
  color: #8a6500;
  font-size: 1.65rem;
}

.business-profile__copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.business-profile__copy > span {
  color: #8a6500;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.business-profile__copy h2,
.business-profile__copy p {
  margin: 0;
}

.business-profile__copy h2 {
  color: #071327;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.18rem;
  font-weight: 900;
}

.business-profile__copy p {
  color: #52615a;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.45;
}

.business-profile__field {
  display: grid;
  gap: 7px;
}

.business-profile__field label {
  color: #26372c;
  font-size: 0.82rem;
  font-weight: 850;
}

.business-profile__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

@media (max-width: 520px) {
  .business-profile { padding: 22px 18px; }
  .business-profile__head { grid-template-columns: 48px minmax(0, 1fr); }
  .business-profile__icon { width: 48px; height: 48px; font-size: 1.35rem; }
  .business-profile__actions { flex-wrap: wrap; }
}
</style>
