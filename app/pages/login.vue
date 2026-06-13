<script setup lang="ts">
useHead({
  title: 'Iniciar sesión | IMPULSA',
  meta: [
    {
      name: 'description',
      content: 'Accede a IMPULSA, tu asistente inteligente para analizar, decidir y hacer crecer tu negocio.',
    },
  ],
})

const form = reactive({
  email: 'admin@nexa.bo',
  password: 'NexaAdmin2026!',
  remember: false,
})

const showPassword = ref(false)
const loading = ref(false)
const authError = ref('')

async function onSubmit() {
  authError.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: form.email,
        password: form.password,
        remember: form.remember,
      },
    })

    void navigateTo('/pos/inicio')
  } catch {
    authError.value = 'Credenciales inválidas. Verifica tu correo y contraseña.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <!-- ============ Panel izquierdo · marca + beneficios ============ -->
    <section class="login-showcase" aria-labelledby="login-showcase-title">
      <div class="login-showcase__content">
        <a href="/" class="login-brand" aria-label="IMPULSA inicio">
          <img src="/impulsa-logo-color.webp" alt="" class="brand-logo" aria-hidden="true">
          <span class="font-display">IMPULSA</span>
        </a>

        <div class="login-copy">
          <h1 id="login-showcase-title" class="font-display">
            Tu asistente inteligente para hacer <span class="text-gradient">crecer</span> tu negocio
          </h1>
        </div>
      </div>
    </section>

    <!-- ============ Panel derecho · formulario ============ -->
    <section class="login-panel">
      <div class="login-card">
        <img
          class="login-card__decor login-card__decor--leaf"
          src="/login-card-leaf.webp"
          alt=""
          aria-hidden="true"
        >
        <img
          class="login-card__decor login-card__decor--mascot"
          src="/haru-avatar.webp"
          alt=""
          aria-hidden="true"
        >

        <header class="login-card__header">
          <a href="/" class="login-card__brand" aria-label="IMPULSA inicio">
            <img src="/impulsa-logo-color.webp" alt="" class="brand-logo" aria-hidden="true">
            <span class="font-display">IMPULSA</span>
          </a>
          <p>IA para tu negocio</p>
        </header>

        <div class="login-card__intro">
          <h2 id="login-title" class="font-display">¡Bienvenido de nuevo!</h2>
          <p>Inicia sesión para continuar <span class="login-leaf" aria-hidden="true">🌿</span></p>
        </div>

        <form class="login-form" @submit.prevent="onSubmit">
          <div class="login-field">
            <label for="email">Correo electrónico</label>
            <span class="login-input">
              <i class="pi pi-envelope" aria-hidden="true" />
              <input
                id="email"
                v-model="form.email"
                type="email"
                name="email"
                placeholder="ejemplo@correo.com"
                autocomplete="email"
                required
              >
            </span>
          </div>

          <div class="login-field">
            <label for="password">Contraseña</label>
            <span class="login-input">
              <i class="pi pi-lock" aria-hidden="true" />
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                name="password"
                placeholder="Ingresa tu contraseña"
                autocomplete="current-password"
                required
              >
              <button
                type="button"
                class="login-input__toggle"
                :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
              </button>
            </span>
          </div>

          <div class="login-form__row">
            <label class="login-check">
              <input v-model="form.remember" type="checkbox" name="remember">
              <span>Recordarme</span>
            </label>
            <a href="#recuperar">¿Olvidaste tu contraseña?</a>
          </div>

          <p v-if="authError" class="login-error" role="alert">
            <i class="pi pi-exclamation-triangle" aria-hidden="true" />
            <span>{{ authError }}</span>
          </p>

          <Button
            type="submit"
            :loading="loading"
            class="btn-shine login-submit"
          >
            <span>Iniciar sesión</span>
            <svg class="login-paw" viewBox="0 0 24 24" aria-hidden="true">
              <ellipse cx="6.2" cy="10.2" rx="1.7" ry="2.3" />
              <ellipse cx="10.4" cy="6.8" rx="1.8" ry="2.5" />
              <ellipse cx="14.6" cy="6.8" rx="1.8" ry="2.5" />
              <ellipse cx="18.2" cy="10.6" rx="1.6" ry="2.2" />
              <path d="M12.2 11.1c2.9 0 5.4 1.9 5.4 4.3 0 2-1.7 3.1-3.6 3.1-1 0-1.4-.4-1.8-.4s-.8.4-1.8.4c-1.9 0-3.6-1.1-3.6-3.1 0-2.4 2.5-4.3 5.4-4.3Z" />
            </svg>
          </Button>

          <div class="login-divider">
            <span />
            <small>o continúa con</small>
            <span />
          </div>

          <div class="login-social">
            <button type="button" class="login-social__btn" aria-label="Continuar con Google">
              <i class="pi pi-google" aria-hidden="true" />
              <span>Google</span>
            </button>
            <button type="button" class="login-social__btn" aria-label="Continuar con Facebook">
              <i class="pi pi-facebook" aria-hidden="true" />
              <span>Facebook</span>
            </button>
          </div>
        </form>

        <p class="login-register">
          ¿No tienes cuenta?
          <a href="#registro">Regístrate aquí <span class="login-leaf" aria-hidden="true">🌿</span></a>
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  width: 100%;
  min-width: 100%;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 1.02fr 0.98fr;
  background:
    linear-gradient(90deg, rgba(248, 252, 248, 0.06) 0%, rgba(248, 252, 248, 0.1) 48%, rgba(255, 255, 255, 0.38) 72%, rgba(255, 255, 255, 0.62) 100%),
    url('/login-bg.jpg') left center / cover no-repeat,
    var(--soft);
  color: var(--ink);
  overflow-x: hidden;
  overflow-y: auto;
}

/* ---------------- Showcase (izquierda) ---------------- */
.login-showcase {
  position: relative;
  height: 100%;
  isolation: isolate;
  overflow: hidden;
}

.login-showcase__content {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: min(500px, calc(100% - 48px));
  padding: clamp(28px, 5vh, 56px) 0;
  margin-left: clamp(24px, 6vw, 88px);
}

.login-brand,
.login-card__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  font-size: clamp(1.6rem, 2.6vw, 2.1rem);
  font-weight: 800;
  line-height: 1;
  color: var(--ink);
}

/* Isotipo IMPULSA */
.brand-logo {
  height: 1.5em;
  width: auto;
  flex: 0 0 auto;
  object-fit: contain;
}

.login-copy {
  margin-top: clamp(14px, 2.5vh, 24px);
}

.login-copy h1 {
  max-width: 440px;
  margin: 0;
  font-size: clamp(1.55rem, 2.9vw, 2.35rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: #06361d;
}

/* ---------------- Panel del formulario (derecha) ---------------- */
.login-panel {
  height: 100%;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: clamp(16px, 2.6vh, 28px);
  padding: 1.3vh min(4vw, 56px);
}

.login-card {
  position: relative;
  width: min(408px, 100%);
  padding: clamp(26px, 4vh, 42px) clamp(22px, 3vw, 38px) clamp(62px, 9vh, 92px);
  border: 1px solid rgba(10, 80, 31, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 30px 80px rgba(11, 31, 18, 0.14),
    0 6px 16px rgba(11, 31, 18, 0.06);
  overflow: hidden;
}

.login-card > :not(.login-card__decor) {
  position: relative;
  z-index: 1;
}

.login-card__decor {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  user-select: none;
}

.login-card__decor--leaf {
  top: 6px;
  right: 6px;
  width: clamp(82px, 8vw, 118px);
  opacity: 0.9;
}

.login-card__decor--mascot {
  z-index: 2;
  right: -4px;
  bottom: -6px;
  width: clamp(104px, 9vw, 128px);
  opacity: 0.85;
}

.login-card__header {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.login-card__brand {
  font-size: clamp(1.4rem, 2.4vw, 1.7rem);
}

.login-card__header p {
  margin: 0;
  color: var(--brand-700);
  font-size: 0.82rem;
  font-weight: 800;
}

.login-card__intro {
  margin-top: clamp(12px, 2vh, 20px);
  text-align: center;
}

.login-card__intro h2 {
  margin: 0;
  font-size: clamp(1.15rem, 1.9vw, 1.4rem);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #092517;
}

.login-card__intro p {
  margin: 4px 0 0;
  color: var(--slate);
  font-size: 0.82rem;
  font-weight: 600;
}

.login-card__intro i {
  color: var(--brand);
}

.login-leaf {
  font-size: 0.95em;
  line-height: 1;
}

.login-form {
  display: grid;
  gap: clamp(11px, 1.7vh, 16px);
  margin-top: clamp(12px, 1.8vh, 18px);
}

.login-field {
  display: grid;
  gap: 6px;
}

.login-field label {
  color: #141b2b;
  font-size: 0.8rem;
  font-weight: 800;
}

.login-input {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 13px;
  border: 1.5px solid var(--line);
  border-radius: 11px;
  background: #ffffff;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.login-input:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 4px rgba(15, 158, 46, 0.1);
}

.login-input > i {
  color: var(--brand-700);
  font-size: 1rem;
}

.login-input input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--ink);
  font-size: 0.9rem;
  font-weight: 600;
  background: transparent;
}

.login-input input::placeholder {
  color: #8a8f98;
  font-weight: 500;
}

.login-input__toggle {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #6f7682;
  background: transparent;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.login-input__toggle:hover {
  color: var(--brand-700);
  background: rgba(15, 158, 46, 0.08);
}

.login-form__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 2px;
}

.login-check {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #1b2230;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.login-check input {
  width: 17px;
  height: 17px;
  accent-color: var(--brand);
  cursor: pointer;
}

.login-form__row {
  font-size: 0.82rem;
}

.login-form__row a,
.login-register a {
  color: var(--brand-700);
  font-weight: 800;
}

.login-form__row a:hover,
.login-register a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.login-error {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(185, 28, 28, 0.18);
  border-radius: 12px;
  color: #9f1239;
  background: #fff1f2;
  font-size: 0.9rem;
  font-weight: 700;
}

.login-submit {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 44px;
  margin-top: 2px;
  border: 0 !important;
  border-radius: 11px !important;
  font-size: 0.95rem !important;
  font-weight: 800 !important;
  color: #ffffff !important;
  background: linear-gradient(160deg, var(--brand), var(--brand-700)) !important;
  box-shadow: 0 16px 30px rgba(14, 111, 32, 0.24);
}

.login-paw {
  width: 1.1rem;
  height: 1.1rem;
  flex: 0 0 auto;
  fill: #ffffff;
}

.login-submit:hover {
  background: linear-gradient(160deg, #14b536, var(--brand-600)) !important;
}

.login-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
  margin-top: 2px;
  color: #969aa4;
}

.login-divider span {
  height: 1px;
  background: var(--line);
}

.login-divider small {
  font-size: 0.8rem;
  font-weight: 700;
}

.login-social {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.login-social__btn {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1.5px solid var(--line);
  border-radius: 11px;
  background: #ffffff;
  color: #1d2330;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.login-social__btn:hover {
  border-color: rgba(15, 158, 46, 0.4);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.07);
  transform: translateY(-2px);
}

.login-social__btn i {
  font-size: 1.1rem;
}

.login-social__btn:first-child i {
  color: #ea4335;
}

.login-social__btn:last-child i {
  color: #1877f2;
}

.login-register {
  margin: clamp(10px, 1.5vh, 14px) 0 0;
  padding-right: clamp(0px, 6vw, 56px);
  color: var(--ink);
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
}

.login-security {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  width: min(444px, 100%);
  padding: 11px 16px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  color: #1f2933;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 28px rgba(11, 31, 18, 0.12);
}

.login-security > span {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #dde9de;
  border-radius: 14px;
  color: var(--brand-700);
  background: var(--soft);
}

.login-security p {
  margin: 0;
}

.login-security strong {
  display: block;
  font-size: 0.82rem;
  font-weight: 800;
}

.login-security small {
  display: block;
  margin-top: 2px;
  color: #3d4753;
  font-size: 0.76rem;
  font-weight: 600;
}

/* ---------------- Responsive ---------------- */
@media (max-width: 1080px) {
  .login-page {
    height: auto;
    min-height: 100dvh;
    grid-template-columns: 1fr;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.38) 44%, rgba(255, 255, 255, 0.7) 100%),
      url('/login-bg.jpg') 28% center / cover no-repeat,
      var(--soft);
    overflow-x: hidden;
    overflow-y: auto;
  }

  .login-showcase {
    display: none;
  }

  .login-showcase__content {
    display: none;
  }

  .login-panel {
    min-height: 100dvh;
    height: auto;
    align-content: center;
    padding: 24px 20px;
  }
}

/* Ventana baja: compactamos el título para no invadir el cartel de la imagen */
@media (min-width: 1081px) and (max-height: 820px) {
  .login-showcase__content {
    padding-top: clamp(24px, 4vh, 44px);
  }

  .login-copy {
    margin-top: 14px;
  }

  .login-copy h1 {
    font-size: clamp(1.5rem, 2.7vw, 2.1rem);
    line-height: 1.1;
  }
}

@media (max-width: 640px) {
  .login-card {
    width: min(100%, 390px);
    padding: 30px 20px 42px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
  }

  .login-card__decor--leaf {
    top: 6px;
    right: 6px;
    width: 84px;
  }

  .login-card__decor--mascot {
    right: -6px;
    bottom: -8px;
    width: 100px;
  }

  .login-social {
    gap: 12px;
  }
}

@media (max-width: 380px) {
  .login-card__decor--mascot {
    right: -4px;
    width: 88px;
  }

  .login-social {
    grid-template-columns: 1fr;
  }
}
</style>
