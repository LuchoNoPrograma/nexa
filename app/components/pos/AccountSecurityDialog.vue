<script setup lang="ts">
const visible = ref(false)
const setupReady = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const form = reactive({ password: '', confirmPassword: '' })

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const session = computed(() => sessionStore.session)
const canSave = computed(() =>
  form.password.length >= 10
  && form.password.length <= 128
  && form.password === form.confirmPassword,
)

function resetForm() {
  form.password = ''
  form.confirmPassword = ''
}

function openDialog() {
  errorMessage.value = ''
  successMessage.value = ''
  visible.value = true
}

async function clearSecurityQuery() {
  if (!route.query.security) {
    return
  }

  const query = { ...route.query }
  delete query.security
  await router.replace({ path: route.path, query })
}

async function savePassword() {
  if (saving.value || !canSave.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch('/api/auth/password', {
      method: 'POST',
      body: { password: form.password },
    })
    await sessionStore.load({ force: true })
    setupReady.value = false
    successMessage.value = 'Contraseña creada. Ya puedes ingresar con Google o con tu correo.'
    resetForm()
    await clearSecurityQuery()
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }; statusMessage?: string }
    errorMessage.value = fetchError.data?.statusMessage
      ?? fetchError.statusMessage
      ?? 'No se pudo crear la contraseña.'
  } finally {
    saving.value = false
  }
}

function handleSecurityReturn() {
  const status = route.query.security
  if (typeof status !== 'string') {
    return
  }

  openDialog()
  if (status === 'password') {
    setupReady.value = true
  } else if (status === 'google') {
    successMessage.value = 'Google quedó vinculado a tu cuenta.'
    void sessionStore.load({ force: true })
    void clearSecurityQuery()
  } else if (status === 'cancelado') {
    errorMessage.value = 'Cancelaste la verificación. No se realizaron cambios.'
    void clearSecurityQuery()
  } else {
    errorMessage.value = 'No se pudo verificar el método de acceso. Intenta nuevamente.'
    void clearSecurityQuery()
  }
}

function handleOpenRequest() {
  setupReady.value = false
  resetForm()
  openDialog()
}

onMounted(() => {
  window.addEventListener('nexa:open-account-security', handleOpenRequest)
  handleSecurityReturn()
})

onBeforeUnmount(() => window.removeEventListener('nexa:open-account-security', handleOpenRequest))
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Seguridad de la cuenta"
    :draggable="false"
    class="account-security-dialog"
    :style="{ width: 'min(92vw, 520px)' }"
    @hide="clearSecurityQuery"
  >
    <div class="account-security">
      <div class="account-security__identity">
        <span class="account-security__avatar" aria-hidden="true">
          <i class="pi pi-shield" />
        </span>
        <div>
          <strong>{{ session?.name }}</strong>
          <span>{{ session?.email || 'Cuenta NEXA' }}</span>
        </div>
      </div>

      <div class="account-security__methods" aria-label="Métodos de acceso">
        <div class="account-security__method">
          <span class="account-security__method-icon account-security__method-icon--google" aria-hidden="true">
            <i class="pi pi-google" />
          </span>
          <div>
            <strong>Google</strong>
            <span>{{ session?.hasGoogle ? 'Conectado' : 'No conectado' }}</span>
          </div>
          <i v-if="session?.hasGoogle" class="pi pi-check-circle account-security__ok" aria-label="Conectado" />
          <a
            v-else
            href="/api/auth/oauth/google/start?intent=link_google"
            class="account-security__connect"
          >
            Conectar
          </a>
        </div>

        <div class="account-security__method">
          <span class="account-security__method-icon" aria-hidden="true">
            <i class="pi pi-key" />
          </span>
          <div>
            <strong>Correo y contraseña</strong>
            <span>{{ session?.hasPassword ? 'Contraseña activa' : 'Sin contraseña' }}</span>
          </div>
          <i v-if="session?.hasPassword" class="pi pi-check-circle account-security__ok" aria-label="Activo" />
        </div>
      </div>

      <Message v-if="successMessage" severity="success" size="small">{{ successMessage }}</Message>
      <Message v-if="errorMessage" severity="error" size="small">{{ errorMessage }}</Message>

      <form v-if="setupReady && !session?.hasPassword" class="account-security__form" @submit.prevent="savePassword">
        <div class="account-security__field">
          <label for="account-new-password">Nueva contraseña</label>
          <Password
            v-model="form.password"
            input-id="account-new-password"
            name="newPassword"
            autocomplete="new-password"
            :feedback="false"
            toggle-mask
            fluid
            :disabled="saving"
          />
          <small>Usa entre 10 y 128 caracteres.</small>
        </div>

        <div class="account-security__field">
          <label for="account-confirm-password">Confirmar contraseña</label>
          <Password
            v-model="form.confirmPassword"
            input-id="account-confirm-password"
            name="confirmPassword"
            autocomplete="new-password"
            :feedback="false"
            toggle-mask
            fluid
            :invalid="Boolean(form.confirmPassword && form.password !== form.confirmPassword)"
            :disabled="saving"
          />
        </div>

        <Button
          type="submit"
          label="Crear contraseña"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!canSave"
        />
      </form>

      <div v-else-if="!session?.hasPassword && session?.hasGoogle" class="account-security__action">
        <a href="/api/auth/oauth/google/start?intent=set_password">
          <i class="pi pi-google" aria-hidden="true" />
          Verificar con Google y crear contraseña
        </a>
        <small>La verificación confirma que eres quien controla la cuenta antes de agregar otro acceso.</small>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
:global(.account-security-dialog.p-dialog) {
  overflow: hidden;
  border: 1px solid #dfe8e2;
  border-radius: 8px;
}

:global(.account-security-dialog .p-dialog-header) {
  padding: 20px 22px 12px;
}

:global(.account-security-dialog .p-dialog-title) {
  color: #0b1f3a;
  font-size: 1.05rem;
  font-weight: 900;
}

:global(.account-security-dialog .p-dialog-content) {
  padding: 8px 22px 22px;
}

.account-security {
  display: grid;
  gap: 18px;
}

.account-security__identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e7eee9;
}

.account-security__avatar,
.account-security__method-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: #ffffff;
  background: #0b1f3a;
}

.account-security__avatar {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  font-size: 1.1rem;
}

.account-security__identity div,
.account-security__method div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.account-security__identity strong,
.account-security__method strong {
  color: #15251b;
  font-size: 0.9rem;
  font-weight: 850;
}

.account-security__identity span:not(.account-security__avatar),
.account-security__method span:not(.account-security__method-icon) {
  overflow: hidden;
  color: #66746b;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-security__methods {
  display: grid;
  border-block: 1px solid #e4ebe6;
}

.account-security__method {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 10px 2px;
}

.account-security__method + .account-security__method {
  border-top: 1px solid #edf2ee;
}

.account-security__method-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #eef3ef;
  color: #0b1f3a;
}

.account-security__method-icon--google {
  background: #f3f6fb;
  color: #2458a6;
}

.account-security__ok {
  color: #0b982f;
  font-size: 1.05rem;
}

.account-security__connect,
.account-security__action a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  border-radius: 8px;
  color: #ffffff;
  background: #087a28;
  font-size: 0.82rem;
  font-weight: 850;
  text-decoration: none;
}

.account-security__connect {
  padding: 0 13px;
}

.account-security__form,
.account-security__field,
.account-security__action {
  display: grid;
  gap: 10px;
}

.account-security__field label {
  color: #26372c;
  font-size: 0.82rem;
  font-weight: 800;
}

.account-security__field small,
.account-security__action small {
  color: #6b776f;
  font-size: 0.75rem;
  line-height: 1.45;
}

.account-security__action a {
  min-height: 44px;
  padding: 0 16px;
}

@media (max-width: 520px) {
  :global(.account-security-dialog .p-dialog-header) {
    padding: 18px 16px 10px;
  }

  :global(.account-security-dialog .p-dialog-content) {
    padding: 8px 16px 18px;
  }
}
</style>
