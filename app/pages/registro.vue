<script setup lang="ts">
definePageMeta({
  layout: false,
})

useHead({
  title: 'Crea tu cuenta | NEXA',
  meta: [
    {
      name: 'description',
      content: 'Registra tu negocio en NEXA y empieza a gestionar tus ventas, tu inventario y tus precios con la ayuda de Haru.',
    },
  ],
})

const form = reactive({
  fullName: '',
  countryDialCode: '+591',
  phone: '',
  businessName: '',
  city: 'Cobija, Pando',
  password: '',
  confirmPassword: '',
})

const loading = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)

type CountryCode = {
  name: string
  iso2: string
  dialCode: string
  example: string
  flagUrl: string
}

const { data: countryData } = await useFetch<{ countries: CountryCode[] }>('/api/metadata/country-codes', {
  default: () => ({
    countries: [
      { name: 'Bolivia', iso2: 'BO', dialCode: '+591', example: '71234567', flagUrl: '/flags/bo.svg' },
      { name: 'Peru', iso2: 'PE', dialCode: '+51', example: '987654321', flagUrl: '/flags/pe.svg' },
      { name: 'Brasil', iso2: 'BR', dialCode: '+55', example: '11987654321', flagUrl: '/flags/br.svg' },
    ],
  }),
})

const countryOptions = computed(() => countryData.value?.countries ?? [])
const selectedCountry = computed(() =>
  countryOptions.value.find(country => country.dialCode === form.countryDialCode) ?? countryOptions.value[0],
)

const canSubmit = computed(() =>
  form.fullName.trim().length >= 3
  && form.phone.replace(/\D/g, '').length >= 7
  && form.businessName.trim().length >= 2
  && form.city.trim().length >= 2
  && form.password.length >= 6
  && form.password === form.confirmPassword,
)

async function onSubmit() {
  errorMessage.value = ''

  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'Las contraseñas no coinciden.'
    return
  }

  loading.value = true

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: form.fullName,
        phone: form.phone,
        countryDialCode: form.countryDialCode,
        businessName: form.businessName,
        city: form.city,
        password: form.password,
      },
    })

    void navigateTo('/pos/diagnostico')
  } catch (error: any) {
    errorMessage.value = error?.statusMessage || 'No se pudo crear la tienda. Revisa los datos e intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="register-page">
    <section class="register-hero" aria-labelledby="register-title">
      <NuxtLink to="/" class="register-brand" aria-label="NEXA inicio">
        <img src="/nexa-logo-color.webp" alt="" aria-hidden="true">
        <span>NEXA</span>
      </NuxtLink>

      <div class="register-copy">
        <p>Crea tu cuenta</p>
        <h1 id="register-title">Registra tu negocio y empieza a tomar mejores decisiones</h1>
        <span>Lleva tus ventas, tu inventario y tus precios en un solo lugar, con Haru analizando tus datos para decirte dónde actuar. Tu número de celular será tu usuario para iniciar sesión.</span>
      </div>
    </section>

    <section class="register-panel" aria-label="Formulario de registro">
      <form class="register-form" @submit.prevent="onSubmit">
        <header>
          <img src="/nexa-logo-color.webp" alt="" aria-hidden="true">
          <div>
            <h2>Registra tu negocio</h2>
            <p>Completa estos datos para crear tu cuenta en NEXA.</p>
          </div>
        </header>

        <div class="field">
          <label for="fullName">Nombre completo</label>
          <span class="input">
            <i class="pi pi-user" aria-hidden="true" />
            <input
              id="fullName"
              v-model="form.fullName"
              type="text"
              name="fullName"
              autocomplete="name"
              placeholder="Ej. Ana Vargas"
              required
            >
          </span>
        </div>

        <div class="field">
          <label for="phone">Nro. celular</label>
          <InputGroup class="phone-group">
            <InputGroupAddon class="phone-prefix">
              <Select
                v-model="form.countryDialCode"
                :options="countryOptions"
                option-label="name"
                option-value="dialCode"
                aria-label="Código de país"
                class="country-select"
              >
                <template #value="{ value }">
                  <span class="country-value">
                    <img v-if="selectedCountry" :src="selectedCountry.flagUrl" alt="" aria-hidden="true">
                    <span>{{ value }}</span>
                  </span>
                </template>
                <template #option="{ option }">
                  <span class="country-option">
                    <img :src="option.flagUrl" alt="" aria-hidden="true">
                    <strong>{{ option.dialCode }}</strong>
                    <span>{{ option.name }}</span>
                  </span>
                </template>
              </Select>
            </InputGroupAddon>
            <input
              id="phone"
              v-model="form.phone"
              class="phone-input"
              type="tel"
              name="phone"
              autocomplete="tel"
              :placeholder="`Ej. ${selectedCountry?.example ?? '71234567'}`"
              required
            >
          </InputGroup>
        </div>

        <div class="field">
          <label for="businessName">Nombre del negocio</label>
          <span class="input">
            <i class="pi pi-building" aria-hidden="true" />
            <input
              id="businessName"
              v-model="form.businessName"
              type="text"
              name="businessName"
              autocomplete="organization"
              placeholder="Ej. Abarrotes Doña Ana"
              required
            >
          </span>
        </div>

        <div class="field">
          <label for="city">Ciudad</label>
          <span class="input">
            <i class="pi pi-map-marker" aria-hidden="true" />
            <input
              id="city"
              v-model="form.city"
              type="text"
              name="city"
              autocomplete="address-level2"
              required
            >
          </span>
        </div>

        <div class="field">
          <label for="password">Contraseña</label>
          <span class="input">
            <i class="pi pi-lock" aria-hidden="true" />
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="new-password"
              placeholder="Mínimo 6 caracteres"
              required
            >
            <button
              type="button"
              class="input-toggle"
              :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              @click="showPassword = !showPassword"
            >
              <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
            </button>
          </span>
        </div>

        <div class="field">
          <label for="confirmPassword">Confirmar contraseña</label>
          <span class="input">
            <i class="pi pi-shield" aria-hidden="true" />
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              name="confirmPassword"
              autocomplete="new-password"
              placeholder="Repite tu contraseña"
              required
            >
            <button
              type="button"
              class="input-toggle"
              :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              @click="showPassword = !showPassword"
            >
              <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
            </button>
          </span>
        </div>

        <p v-if="errorMessage" class="register-error" role="alert">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          <span>{{ errorMessage }}</span>
        </p>

        <Button type="submit" class="register-submit" :loading="loading" :disabled="!canSubmit">
          Crear mi tienda
          <i class="pi pi-arrow-right" aria-hidden="true" />
        </Button>

        <p class="register-login">
          ¿Ya tienes cuenta?
          <NuxtLink to="/login">Iniciar sesión</NuxtLink>
        </p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.register-page {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
  color: #0b1f3a;
  background:
    linear-gradient(90deg, rgba(7, 24, 46, 0.82), rgba(7, 24, 46, 0.48) 48%, rgba(255, 255, 255, 0.92) 72%),
    url('/pos-inicio-hero.jpg') left center / cover no-repeat,
    #f6faf7;
}

.register-hero {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(28px, 5vw, 72px);
}

.register-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  color: #ffffff;
  text-decoration: none;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 900;
}

.register-brand img {
  height: 1.35em;
  width: auto;
}

.register-copy {
  max-width: 620px;
  padding-bottom: clamp(10px, 5vh, 54px);
  color: #ffffff;
}

.register-copy p {
  margin: 0 0 12px;
  color: #f2c200;
  font-size: 0.86rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.register-copy h1 {
  margin: 0;
  max-width: 680px;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: clamp(2.1rem, 5.6vw, 5.2rem);
  font-weight: 900;
  line-height: 0.98;
}

.register-copy span {
  display: block;
  max-width: 480px;
  margin-top: 18px;
  color: rgba(255, 255, 255, 0.86);
  font-size: clamp(0.98rem, 1.5vw, 1.1rem);
  font-weight: 650;
  line-height: 1.55;
}

.register-panel {
  display: grid;
  min-height: 100dvh;
  align-items: center;
  padding: clamp(22px, 4vw, 56px);
}

.register-form {
  display: grid;
  gap: 14px;
  width: min(100%, 420px);
  justify-self: center;
  padding: clamp(22px, 3vw, 34px);
  border: 1px solid rgba(11, 31, 58, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 70px rgba(11, 31, 58, 0.16);
}

.register-form header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 4px;
}

.register-form header img {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.register-form h2 {
  margin: 0;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1.35rem;
  font-weight: 900;
}

.register-form header p {
  margin: 3px 0 0;
  color: #5b6675;
  font-size: 0.88rem;
  font-weight: 650;
}

.field {
  display: grid;
  gap: 6px;
}

.field label {
  color: #162235;
  font-size: 0.8rem;
  font-weight: 850;
}

.input {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 13px;
  border: 1.5px solid #dce5df;
  border-radius: 12px;
  background: #ffffff;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.input:focus-within {
  border-color: #0b982f;
  box-shadow: 0 0 0 4px rgba(11, 152, 47, 0.12);
  transform: translateY(-1px);
}

.input > i {
  color: #087a28;
}

.input input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #0b1f3a;
  background: transparent;
  font-size: 0.92rem;
  font-weight: 700;
}

.input input::placeholder {
  color: #8a93a1;
  font-weight: 550;
}

.input-toggle {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: #087a28;
  background: rgba(11, 152, 47, 0.08);
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}

.input-toggle:hover {
  color: #ffffff;
  background: #0b982f;
}

.phone-group {
  min-height: 44px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  border: 1.5px solid #dce5df;
  border-radius: 12px;
  background: #ffffff;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.phone-group :deep(.p-inputgroupaddon) {
  padding: 0;
  border: 0;
  border-radius: 10px 0 0 10px;
  background: #f1f8f3;
}

.country-select {
  min-width: 124px;
  height: 100%;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.country-select :deep(.p-select-label) {
  display: inline-flex;
  align-items: center;
  padding: 0 6px 0 12px;
  color: #087a28;
  font-size: 0.9rem;
  font-weight: 900;
}

.country-select :deep(.p-select-dropdown) {
  width: 24px;
  color: #087a28;
}

.country-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #087a28;
  font-weight: 900;
}

.country-value img,
.country-option img {
  width: 22px;
  height: 16px;
  border-radius: 3px;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(11, 31, 58, 0.1);
}

.country-option {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.country-option strong {
  color: #087a28;
}

.phone-input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-left: 1px solid #dce5df;
  border-radius: 0 10px 10px 0;
  outline: 0;
  color: #0b1f3a;
  background: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.phone-group:focus-within :deep(.p-inputgroupaddon),
.phone-group:focus-within .phone-input {
  border-color: rgba(11, 152, 47, 0.24);
}

.phone-group:focus-within {
  border-color: #0b982f;
  box-shadow: 0 0 0 4px rgba(11, 152, 47, 0.12);
  transform: translateY(-1px);
}

.phone-input::placeholder {
  color: #8a93a1;
  font-weight: 550;
}

.register-error {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(185, 28, 28, 0.18);
  border-radius: 12px;
  color: #9f1239;
  background: #fff1f2;
  font-size: 0.88rem;
  font-weight: 800;
}

.register-submit {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  margin-top: 2px;
  border: 0 !important;
  border-radius: 12px !important;
  color: #ffffff !important;
  background: linear-gradient(135deg, #0b982f 0%, #087a28 100%) !important;
  font-weight: 900 !important;
  box-shadow: 0 16px 28px rgba(8, 122, 40, 0.28);
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
}

.register-submit:enabled:hover {
  filter: brightness(1.06);
  box-shadow: 0 18px 34px rgba(8, 122, 40, 0.34);
  transform: translateY(-1px);
}

.register-submit:focus-visible {
  outline: 3px solid rgba(11, 152, 47, 0.22);
  outline-offset: 3px;
}

.register-login {
  margin: 0;
  color: #4c5a6c;
  font-size: 0.88rem;
  font-weight: 700;
  text-align: center;
}

.register-login a {
  color: #087a28;
  font-weight: 900;
  text-decoration: none;
}

.register-login a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 980px) {
  .register-page {
    grid-template-columns: 1fr;
    background:
      linear-gradient(180deg, rgba(7, 24, 46, 0.78), rgba(7, 24, 46, 0.3) 38%, rgba(255, 255, 255, 0.94) 58%),
      url('/pos-inicio-hero.jpg') center top / cover no-repeat,
      #f6faf7;
  }

  .register-hero {
    min-height: auto;
    padding: 24px 22px 10px;
  }

  .register-copy {
    padding: 46px 0 24px;
  }

  .register-copy h1 {
    max-width: 560px;
    font-size: clamp(2rem, 11vw, 4rem);
  }

  .register-panel {
    min-height: auto;
    padding: 0 18px 28px;
  }
}

@media (max-width: 460px) {
  .register-form {
    padding: 22px 18px;
    border-radius: 16px;
  }

  .register-form header {
    align-items: flex-start;
  }
}
</style>
