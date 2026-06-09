<script setup lang="ts">
import { FilterMatchMode } from '@primevue/core/api'

type StoreRow = {
  id: string
  name: string
  owner: string
  plan: 'demo' | 'free' | 'pro'
  status: 'activa' | 'pendiente' | 'suspendida'
  city: string
  users: number
}

const stores = ref<StoreRow[]>([])
const loading = ref(true)

const planOptions = ['demo', 'free', 'pro']
const statusOptions = ['activa', 'pendiente', 'suspendida']

const filters = ref({
  global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  name: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  owner: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  city: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  plan: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
  status: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
})

const activeStoreCount = computed(() => stores.value.filter((store) => store.status === 'activa').length)
const totalUserCount = computed(() => stores.value.reduce((sum, store) => sum + store.users, 0))
const pendingStoreCount = computed(() => stores.value.filter((store) => store.status === 'pendiente').length)

function planSeverity(plan: StoreRow['plan']) {
  return plan === 'pro' ? 'success' : plan === 'demo' ? 'info' : 'secondary'
}

function statusSeverity(status: StoreRow['status']) {
  return status === 'activa' ? 'success' : status === 'pendiente' ? 'warn' : 'danger'
}

onMounted(loadStores)

async function loadStores() {
  loading.value = true

  try {
    const response = await $fetch<{ stores: StoreRow[] }>('/api/admin/stores')
    stores.value = response.stores
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
        <h2>Tiendas registradas</h2>
      </div>

      <Button type="button" icon="pi pi-building" label="Nueva tienda" />
    </div>

    <section class="admin-metrics" aria-label="Resumen de tiendas">
      <article>
        <span>Tiendas activas</span>
        <strong>{{ activeStoreCount }}</strong>
      </article>
      <article>
        <span>Usuarios asignados</span>
        <strong>{{ totalUserCount }}</strong>
      </article>
      <article>
        <span>Pendientes</span>
        <strong>{{ pendingStoreCount }}</strong>
      </article>
    </section>

    <DataTable
      v-model:filters="filters"
      :value="stores"
      :loading="loading"
      dataKey="id"
      filterDisplay="row"
      size="small"
      paginator
      :rows="10"
      stripedRows
      :globalFilterFields="['name', 'owner', 'city', 'plan', 'status']"
    >
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-lg font-semibold">Gestión de tiendas</span>
          <IconField>
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText v-model="filters['global'].value" placeholder="Buscar..." />
          </IconField>
        </div>
      </template>
      <template #empty>No se encontraron tiendas.</template>
      <template #loading>Cargando tiendas...</template>

      <Column field="name" header="Tienda" sortable :showFilterMenu="false" style="min-width: 12rem">
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" type="text" placeholder="Buscar tienda" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="owner" header="Propietario" sortable :showFilterMenu="false" style="min-width: 12rem">
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" type="text" placeholder="Buscar propietario" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="city" header="Ciudad" :showFilterMenu="false" style="min-width: 10rem">
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" type="text" placeholder="Buscar ciudad" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="users" header="Usuarios" style="min-width: 7rem" />

      <Column field="plan" header="Plan" :showFilterMenu="false" style="min-width: 10rem">
        <template #body="{ data }">
          <Tag :value="data.plan" :severity="planSeverity(data.plan)" />
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <Select v-model="filterModel.value" :options="planOptions" placeholder="Todos" showClear @change="filterCallback()">
            <template #option="{ option }">
              <Tag :value="option" :severity="planSeverity(option)" />
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
            <Button type="button" icon="pi pi-pencil" text rounded severity="secondary" aria-label="Editar tienda" />
            <Button type="button" icon="pi pi-users" text rounded severity="secondary" aria-label="Gestionar usuarios" />
          </div>
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped src="./admin-view.css"></style>
