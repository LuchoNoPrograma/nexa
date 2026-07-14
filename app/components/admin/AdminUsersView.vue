<script setup lang="ts">
import { FilterMatchMode } from '@primevue/core/api'

type UserStatus = 'activo' | 'invitado' | 'bloqueado'

type UserRow = {
  id: string
  name: string
  email: string | null
  ci: string | null
  phone: string | null
  access: string
  store: string
  role: string
  status: UserStatus
  hasPassword: boolean
  hasGoogle: boolean
  createdAt: string
  lastAccessAt: string | null
  activeSessions: number
  isCurrentUser: boolean
}

type ApiError = {
  data?: { statusMessage?: string, message?: string }
  statusMessage?: string
  message?: string
}

const users = ref<UserRow[]>([])
const loading = ref(true)
const loadError = ref('')
const saveSuccess = ref('')
const passwordDialogOpen = ref(false)
const selectedUser = ref<UserRow | null>(null)
const savingPassword = ref(false)
const passwordError = ref('')

const passwordForm = reactive({
  password: '',
  confirmPassword: '',
  revokeSessions: true,
  reason: 'Recuperación solicitada por el usuario',
})

const filters = ref({
  global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  role: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
  status: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
})

const roleOptions = computed(() => [...new Set(users.value.map(user => user.role))].sort())
const statusOptions: UserStatus[] = ['activo', 'invitado', 'bloqueado']
const activeUserCount = computed(() => users.value.filter(user => user.status === 'activo').length)
const passwordUserCount = computed(() => users.value.filter(user => user.hasPassword).length)
const googleUserCount = computed(() => users.value.filter(user => user.hasGoogle).length)
const activeSessionCount = computed(() => users.value.reduce((total, user) => total + user.activeSessions, 0))
const canSavePassword = computed(() => Boolean(
  selectedUser.value
  && passwordForm.password.length >= 10
  && passwordForm.password.length <= 128
  && passwordForm.password === passwordForm.confirmPassword
  && !savingPassword.value,
))

const dateFormatter = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/La_Paz',
})

function accessLabel(user: UserRow) {
  return user.email || user.ci || user.phone || 'Sin identificador'
}

function roleSeverity(role: string) {
  return role === 'super_admin' ? 'contrast' : role === 'propietario' ? 'success' : 'info'
}

function statusSeverity(status: UserStatus) {
  return status === 'activo' ? 'success' : status === 'invitado' ? 'warn' : 'danger'
}

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'Nunca'
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || !error) {
    return fallback
  }

  const apiError = error as ApiError
  return apiError.data?.statusMessage
    || apiError.data?.message
    || apiError.statusMessage
    || apiError.message
    || fallback
}

function openPasswordDialog(user: UserRow) {
  if (user.isCurrentUser) {
    return
  }

  selectedUser.value = user
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordForm.revokeSessions = true
  passwordForm.reason = 'Recuperación solicitada por el usuario'
  passwordError.value = ''
  saveSuccess.value = ''
  passwordDialogOpen.value = true
}

function clearPasswordForm() {
  selectedUser.value = null
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordForm.reason = 'Recuperación solicitada por el usuario'
  passwordError.value = ''
}

async function loadUsers() {
  loading.value = true
  loadError.value = ''

  try {
    const response = await $fetch<{ users: UserRow[] }>('/api/admin/users')
    users.value = response.users
  }
  catch (error) {
    loadError.value = getErrorMessage(error, 'No se pudo cargar la administración de usuarios.')
  }
  finally {
    loading.value = false
  }
}

async function refreshUsers() {
  saveSuccess.value = ''
  await loadUsers()
}

async function savePassword() {
  const user = selectedUser.value
  if (!user || !canSavePassword.value) {
    return
  }

  savingPassword.value = true
  passwordError.value = ''
  saveSuccess.value = ''

  try {
    const response = await $fetch<{ sessionsRevoked: number }>(`/api/admin/users/${user.id}/password`, {
      method: 'PUT',
      body: {
        password: passwordForm.password,
        revokeSessions: passwordForm.revokeSessions,
        reason: passwordForm.reason,
      },
    })

    passwordDialogOpen.value = false
    await loadUsers()
    saveSuccess.value = response.sessionsRevoked
      ? `Contraseña actualizada. Se cerraron ${response.sessionsRevoked} sesiones del usuario.`
      : 'Contraseña actualizada. El nuevo acceso ya está disponible.'
  }
  catch (error) {
    passwordError.value = getErrorMessage(error, 'No se pudo establecer la contraseña.')
  }
  finally {
    savingPassword.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <section class="admin-workspace admin-users">
    <div class="admin-heading">
      <div>
        <div class="admin-heading__meta">
          <span>Administración de plataforma</span>
          <Tag value="Solo superadmin" severity="contrast" />
        </div>
        <h2>Usuarios y accesos</h2>
      </div>

      <Button
        v-tooltip.left="'Actualizar usuarios'"
        type="button"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        aria-label="Actualizar usuarios"
        :loading="loading"
        @click="refreshUsers"
      />
    </div>

    <section class="admin-metrics admin-users__metrics" aria-label="Resumen de usuarios">
      <article>
        <span>Usuarios activos</span>
        <strong>{{ activeUserCount }}</strong>
      </article>
      <article>
        <span>Con contraseña</span>
        <strong>{{ passwordUserCount }}</strong>
      </article>
      <article>
        <span>Con Google</span>
        <strong>{{ googleUserCount }}</strong>
      </article>
      <article>
        <span>Sesiones activas</span>
        <strong>{{ activeSessionCount }}</strong>
      </article>
    </section>

    <Message v-if="loadError" severity="error" :closable="false">
      {{ loadError }}
    </Message>

    <Message v-if="saveSuccess" severity="success" :closable="false">
      {{ saveSuccess }}
    </Message>

    <DataTable
      v-model:filters="filters"
      :value="users"
      :loading="loading"
      dataKey="id"
      size="small"
      paginator
      :rows="15"
      :rowsPerPageOptions="[15, 30, 50]"
      stripedRows
      scrollable
      :globalFilterFields="['name', 'email', 'ci', 'phone', 'store', 'role', 'status']"
    >
      <template #header>
        <div class="admin-users__toolbar">
          <strong>Gestión de usuarios</strong>
          <div class="admin-users__filters">
            <IconField>
              <InputIcon>
                <i class="pi pi-search" />
              </InputIcon>
              <InputText v-model="filters.global.value" placeholder="Nombre, tienda, correo, CI o celular" />
            </IconField>
            <Select
              v-model="filters.role.value"
              :options="roleOptions"
              placeholder="Todos los roles"
              showClear
            />
            <Select
              v-model="filters.status.value"
              :options="statusOptions"
              placeholder="Todos los estados"
              showClear
            />
          </div>
        </div>
      </template>
      <template #empty>No se encontraron usuarios.</template>
      <template #loading>
        <PosLoadingState
          mode="compact"
          label="Cargando usuarios"
          detail="Actualizando accesos, tiendas y sesiones"
        />
      </template>

      <Column field="name" header="Usuario" sortable style="min-width: 13rem">
        <template #body="{ data }">
          <div class="admin-users__identity">
            <strong>{{ data.name }}</strong>
            <span>Creado {{ formatDate(data.createdAt) }}</span>
          </div>
        </template>
      </Column>

      <Column field="access" header="Identificador" style="min-width: 15rem">
        <template #body="{ data }">
          <div class="admin-users__access">
            <span>{{ accessLabel(data) }}</span>
            <div>
              <Tag v-if="data.hasPassword" value="Contraseña" severity="secondary" />
              <Tag v-if="data.hasGoogle" value="Google" severity="info" />
              <Tag v-if="!data.hasPassword && !data.hasGoogle" value="Sin credencial" severity="danger" />
            </div>
          </div>
        </template>
      </Column>

      <Column field="store" header="Tienda" sortable style="min-width: 14rem" />

      <Column field="role" header="Rol" sortable style="min-width: 10rem">
        <template #body="{ data }">
          <Tag :value="data.role" :severity="roleSeverity(data.role)" />
        </template>
      </Column>

      <Column field="status" header="Estado" sortable style="min-width: 9rem">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>

      <Column field="lastAccessAt" header="Último acceso" sortable style="min-width: 12rem">
        <template #body="{ data }">
          {{ formatDate(data.lastAccessAt) }}
        </template>
      </Column>

      <Column field="activeSessions" header="Sesiones" sortable style="min-width: 7rem">
        <template #body="{ data }">
          <Tag :value="String(data.activeSessions)" :severity="data.activeSessions ? 'success' : 'secondary'" />
        </template>
      </Column>

      <Column header="Acciones" frozen alignFrozen="right" style="min-width: 6rem">
        <template #body="{ data }">
          <Button
            v-tooltip.left="data.isCurrentUser ? 'No puedes cambiar tu propia contraseña desde este panel' : 'Establecer contraseña'"
            type="button"
            icon="pi pi-key"
            text
            rounded
            severity="secondary"
            :disabled="data.isCurrentUser"
            :aria-label="`Establecer contraseña de ${data.name}`"
            @click="openPasswordDialog(data)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="passwordDialogOpen"
      modal
      class="admin-password-dialog"
      :header="selectedUser ? `Establecer contraseña · ${selectedUser.name}` : 'Establecer contraseña'"
      :style="{ width: 'min(92vw, 480px)' }"
      :draggable="false"
      @hide="clearPasswordForm"
    >
      <form class="admin-password" @submit.prevent="savePassword">
        <div v-if="selectedUser" class="admin-password__summary">
          <i class="pi pi-user" aria-hidden="true" />
          <div>
            <strong>{{ selectedUser.store }}</strong>
            <span>{{ accessLabel(selectedUser) }} · {{ selectedUser.role }}</span>
          </div>
        </div>

        <Message v-if="selectedUser?.hasGoogle" severity="info" :closable="false">
          Google seguirá conectado. El usuario podrá entrar con cualquiera de los dos métodos.
        </Message>

        <div class="admin-password__field">
          <label for="admin-user-password">Nueva contraseña</label>
          <Password
            v-model="passwordForm.password"
            input-id="admin-user-password"
            name="newPassword"
            autocomplete="new-password"
            :feedback="false"
            toggle-mask
            fluid
            :disabled="savingPassword"
          />
          <small>Entre 10 y 128 caracteres. La contraseña anterior no se puede consultar.</small>
        </div>

        <div class="admin-password__field">
          <label for="admin-user-password-confirm">Confirmar contraseña</label>
          <Password
            v-model="passwordForm.confirmPassword"
            input-id="admin-user-password-confirm"
            name="confirmPassword"
            autocomplete="new-password"
            :feedback="false"
            toggle-mask
            fluid
            :invalid="Boolean(passwordForm.confirmPassword && passwordForm.password !== passwordForm.confirmPassword)"
            :disabled="savingPassword"
          />
        </div>

        <div class="admin-password__field">
          <label for="admin-user-password-reason">Motivo de soporte</label>
          <InputText
            id="admin-user-password-reason"
            v-model="passwordForm.reason"
            maxlength="200"
            :disabled="savingPassword"
          />
        </div>

        <label class="admin-password__sessions" for="admin-user-revoke-sessions">
          <Checkbox
            v-model="passwordForm.revokeSessions"
            input-id="admin-user-revoke-sessions"
            binary
            :disabled="savingPassword"
          />
          <span>
            <strong>Cerrar sesiones existentes</strong>
            <small>El usuario deberá entrar nuevamente con su nueva contraseña.</small>
          </span>
        </label>

        <Message v-if="passwordError" severity="error" :closable="false">
          {{ passwordError }}
        </Message>
      </form>

      <template #footer>
        <Button
          type="button"
          label="Cancelar"
          severity="secondary"
          text
          :disabled="savingPassword"
          @click="passwordDialogOpen = false"
        />
        <Button
          type="button"
          label="Guardar contraseña"
          icon="pi pi-check"
          :loading="savingPassword"
          :disabled="!canSavePassword"
          @click="savePassword"
        />
      </template>
    </Dialog>
  </section>
</template>

<style scoped src="./admin-view.css"></style>

<style scoped>
.admin-users__metrics {
  grid-template-columns: repeat(4, minmax(140px, 1fr));
}

.admin-users__toolbar,
.admin-users__filters,
.admin-users__access > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-users__toolbar {
  justify-content: space-between;
}

.admin-users__toolbar > strong {
  color: #0b1f3a;
  font-size: 1rem;
}

.admin-users__filters :deep(.p-inputtext) {
  min-width: min(320px, 34vw);
}

.admin-users__identity,
.admin-users__access {
  display: grid;
  gap: 4px;
}

.admin-users__identity strong,
.admin-users__access > span {
  color: #142033;
  font-weight: 800;
}

.admin-users__identity span {
  color: #718096;
  font-size: 0.74rem;
}

:global(.admin-password-dialog.p-dialog) {
  overflow: hidden;
  border: 1px solid #dfe8e2;
  border-radius: 8px;
}

.admin-password {
  display: grid;
  gap: 16px;
}

.admin-password__summary {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5ece7;
}

.admin-password__summary > i {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 8px;
  color: #ffffff;
  background: #0b1f3a;
}

.admin-password__summary div,
.admin-password__field,
.admin-password__sessions span {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.admin-password__summary strong,
.admin-password__field label,
.admin-password__sessions strong {
  color: #223128;
  font-size: 0.82rem;
  font-weight: 850;
}

.admin-password__summary span,
.admin-password__field small,
.admin-password__sessions small {
  color: #68766d;
  font-size: 0.74rem;
  line-height: 1.45;
}

.admin-password__summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-password__sessions {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dfe7e2;
  border-radius: 8px;
  background: #f7faf8;
  cursor: pointer;
}

@media (max-width: 900px) {
  .admin-users__metrics {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }

  .admin-users__toolbar,
  .admin-users__filters {
    align-items: stretch;
    flex-direction: column;
  }

  .admin-users__filters :deep(.p-inputtext) {
    width: 100%;
    min-width: 0;
  }
}

@media (max-width: 520px) {
  .admin-users__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
