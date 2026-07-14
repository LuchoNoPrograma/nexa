<script setup lang="ts">
import { FilterMatchMode } from '@primevue/core/api'

type UserRow = {
  id: string
  name: string
  email: string | null
  ci: string | null
  phone: string | null
  access: string
  store: string
  role: 'super_admin' | 'propietario' | 'administrador' | 'cajero'
  status: 'activo' | 'invitado' | 'bloqueado'
}

const users = ref<UserRow[]>([])
const loading = ref(true)

const roleOptions = ['super_admin', 'propietario', 'administrador', 'cajero']
const statusOptions = ['activo', 'invitado', 'bloqueado']

const filters = ref({
  global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  name: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  access: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  store: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  role: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
  status: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
})

const activeUserCount = computed(() => users.value.filter((user) => user.status === 'activo').length)
const storeUserCount = computed(() => users.value.filter((user) => user.store !== 'Plataforma').length)
const usersWithAccessCount = computed(() => users.value.filter((user) => user.email || user.ci || user.phone).length)

function accessLabel(user: UserRow) {
  return user.email || user.ci || user.phone || 'Sin identificador'
}

function roleSeverity(role: UserRow['role']) {
  return role === 'super_admin' ? 'contrast' : role === 'propietario' ? 'success' : 'info'
}

function statusSeverity(status: UserRow['status']) {
  return status === 'activo' ? 'success' : status === 'invitado' ? 'warn' : 'danger'
}

onMounted(loadUsers)

async function loadUsers() {
  loading.value = true

  try {
    const response = await $fetch<{ users: UserRow[] }>('/api/admin/users')
    users.value = response.users
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="admin-workspace">
    <div class="admin-heading">
      <div>
        <div class="admin-heading__meta">
          <span>Administración de plataforma</span>
          <Tag value="BD local" severity="success" />
        </div>
        <h2>Usuarios y accesos</h2>
      </div>

      <Button type="button" icon="pi pi-user-plus" label="Invitar usuario" />
    </div>

    <section class="admin-metrics" aria-label="Resumen de usuarios">
      <article>
        <span>Usuarios activos</span>
        <strong>{{ activeUserCount }}</strong>
      </article>
      <article>
        <span>En tiendas</span>
        <strong>{{ storeUserCount }}</strong>
      </article>
      <article>
        <span>Con acceso</span>
        <strong>{{ usersWithAccessCount }}</strong>
      </article>
    </section>

    <DataTable
      v-model:filters="filters"
      :value="users"
      :loading="loading"
      dataKey="id"
      filterDisplay="row"
      size="small"
      paginator
      :rows="10"
      stripedRows
      :globalFilterFields="['name', 'email', 'ci', 'phone', 'store', 'role', 'status']"
    >
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-lg font-semibold">Gestión de usuarios</span>
          <IconField>
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText v-model="filters['global'].value" placeholder="Buscar..." />
          </IconField>
        </div>
      </template>
      <template #empty>No se encontraron usuarios.</template>
      <template #loading>
        <PosLoadingState
          mode="compact"
          label="Cargando usuarios"
          detail="Actualizando accesos y roles"
        />
      </template>

      <Column field="name" header="Usuario" sortable :showFilterMenu="false" style="min-width: 12rem">
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" type="text" placeholder="Buscar usuario" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="access" header="Acceso" :showFilterMenu="false" style="min-width: 14rem">
        <template #body="{ data }">
          <span>{{ accessLabel(data) }}</span>
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" type="text" placeholder="Buscar correo, CI o celular" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="store" header="Tienda" sortable :showFilterMenu="false" style="min-width: 12rem">
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" type="text" placeholder="Buscar tienda" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="role" header="Rol" :showFilterMenu="false" style="min-width: 10rem">
        <template #body="{ data }">
          <Tag :value="data.role" :severity="roleSeverity(data.role)" />
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <Select v-model="filterModel.value" :options="roleOptions" placeholder="Todos" showClear @change="filterCallback()">
            <template #option="{ option }">
              <Tag :value="option" :severity="roleSeverity(option)" />
            </template>
          </Select>
        </template>
      </Column>

      <Column field="status" header="Estado" :showFilterMenu="false" style="min-width: 10rem">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <Select v-model="filterModel.value" :options="statusOptions" placeholder="Todos" showClear @change="filterCallback()">
            <template #option="{ option }">
              <Tag :value="option" :severity="statusSeverity(option)" />
            </template>
          </Select>
        </template>
      </Column>

      <Column header="Acciones" style="min-width: 8rem">
        <template #body>
          <div class="flex gap-1">
            <Button type="button" icon="pi pi-key" text rounded severity="secondary" aria-label="Cambiar rol" />
            <Button type="button" icon="pi pi-pencil" text rounded severity="secondary" aria-label="Editar usuario" />
          </div>
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped src="./admin-view.css"></style>
