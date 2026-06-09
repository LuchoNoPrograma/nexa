<script setup lang="ts">
type CatalogCategory = {
  id: string
  name: string
  description: string | null
  icon: string | null
  active: boolean
  productCount: number
}

type ProductVariant = {
  id?: string
  name: string
  sku: string | null
  barcode: string | null
  cost: number | null
  price: number | null
  stock: number
}

type CatalogProduct = {
  id: string
  categoryId: string | null
  categoryName: string | null
  sku: string | null
  barcode: string | null
  name: string
  description: string | null
  kind: 'producto' | 'servicio' | 'combo'
  unit: string
  cost: number
  price: number
  stock: number
  minStock: number
  maxStock: number | null
  minMargin: number | null
  imageUrl: string | null
  icon: string | null
  variablePrice: boolean
  visibleCatalog: boolean
  visiblePos: boolean
  active: boolean
  variants: ProductVariant[]
}

type VariantForm = {
  name: string
  sku: string
  price: number | null
  stock: number
}

type ProductForm = {
  id: string | null
  categoryId: string | null
  sku: string
  barcode: string
  name: string
  description: string
  kind: CatalogProduct['kind']
  unit: string
  cost: number
  price: number
  stock: number
  minStock: number
  maxStock: number | null
  minMargin: number | null
  imageUrl: string
  icon: string
  variablePrice: boolean
  visibleCatalog: boolean
  visiblePos: boolean
  active: boolean
  variants: VariantForm[]
}

type ChipKey = 'todos' | 'productos' | 'servicios' | 'stockBajo' | 'combos'

const products = ref<CatalogProduct[]>([])
const categories = ref<CatalogCategory[]>([])
const loading = ref(true)
const saving = ref(false)
const productDialogOpen = ref(false)
const categoryDialogOpen = ref(false)
const stockDialogOpen = ref(false)
const catalogError = ref('')

const searchTerm = ref('')
const activeChip = ref<ChipKey>('todos')
const selectedProduct = ref<CatalogProduct | null>(null)
const viewScope = ref('global')
const stockProduct = ref<CatalogProduct | null>(null)
const stockMode = ref<'sumar' | 'restar' | 'fijar'>('sumar')
const stockAmount = ref(0)
const stockReason = ref('recuento')
const stockBranch = ref('Matriz')
const stockNotes = ref('')

const categoryForm = reactive({
  id: null as string | null,
  name: '',
  description: '',
  icon: 'pi pi-box',
  active: true,
})

const kindOptions = [
  { label: 'Producto', value: 'producto' },
  { label: 'Servicio', value: 'servicio' },
  { label: 'Combo', value: 'combo' },
]

const stockReasons = [
  { label: 'Compra recibida', value: 'compra_recibida' },
  { label: 'Producto dañado', value: 'producto_daniado' },
  { label: 'Devolución', value: 'devolucion' },
  { label: 'Recuento', value: 'recuento' },
  { label: 'Traslado', value: 'traslado' },
  { label: 'Otro', value: 'otro' },
]

const emojiOptions = ['📦', '🛒', '🥤', '🍞', '🥛', '🧴', '💊', '👕', '🔧', '⚽', '🎁', '🐾', '💄', '🚗', '🍎', '🧼']

const session = usePosSession()
const storeDefaultMargin = computed(() => session.value?.defaultMargin ?? 20)

const sections = reactive({
  codes: false,
  advanced: false,
  variants: false,
})

function toggleSection(key: keyof typeof sections) {
  sections[key] = !sections[key]
}

const viewScopes = [
  { label: 'Vista global', value: 'global' },
  { label: 'Solo visibles en POS', value: 'pos' },
  { label: 'Solo catálogo público', value: 'catalog' },
]

const productFilters: { key: ChipKey; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'productos', label: 'Productos' },
  { key: 'servicios', label: 'Servicios' },
  { key: 'stockBajo', label: 'Stock bajo' },
  { key: 'combos', label: 'Combos' },
]

const form = reactive<ProductForm>(emptyProductForm())

const lowStockCount = computed(() =>
  products.value.filter((product) => product.active && product.kind === 'producto' && product.stock <= product.minStock).length,
)
const noStockCount = computed(() =>
  products.value.filter((product) => product.active && product.kind === 'producto' && product.stock <= 0).length,
)
const inventoryCost = computed(() => products.value.reduce((sum, product) => sum + product.cost * product.stock, 0))
const inventorySale = computed(() => products.value.reduce((sum, product) => sum + product.price * product.stock, 0))

const categoryOptions = computed(() => [
  { label: 'Sin categoría', value: null },
  ...categories.value
    .filter((category) => category.active)
    .map((category) => ({ label: category.name, value: category.id })),
])

const chipCounts = computed(() => {
  const counts = {} as Record<ChipKey, number>
  for (const filter of productFilters) {
    counts[filter.key] = products.value.filter((product) => matchesChip(product, filter.key)).length
  }
  return counts
})

const scopedProducts = computed(() =>
  products.value.filter((product) => {
    if (viewScope.value === 'pos') {
      return product.visiblePos
    }
    if (viewScope.value === 'catalog') {
      return product.visibleCatalog
    }
    return true
  }),
)

const filteredProducts = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()

  return scopedProducts.value.filter((product) => {
    if (!matchesChip(product, activeChip.value)) {
      return false
    }
    if (!query) {
      return true
    }
    return [product.name, product.sku, product.barcode, product.categoryName].some((value) =>
      value?.toLowerCase().includes(query),
    )
  })
})

const statsLine = computed(() => {
  const shown = filteredProducts.value.length
  return `${products.value.length} productos · mostrando ${shown} · ${lowStockCount.value} con stock bajo · ${noStockCount.value} sin stock`
})

const stockResult = computed(() => {
  const currentStock = stockProduct.value?.stock ?? 0

  if (stockMode.value === 'sumar') {
    return currentStock + stockAmount.value
  }

  if (stockMode.value === 'restar') {
    return Math.max(currentStock - stockAmount.value, 0)
  }

  return stockAmount.value
})

watch(
  filteredProducts,
  (list) => {
    if (!list.length) {
      selectedProduct.value = null
      return
    }
    if (!selectedProduct.value || !list.some((product) => product.id === selectedProduct.value?.id)) {
      selectedProduct.value = list[0] ?? null
    }
  },
  { immediate: true },
)

onMounted(loadCatalog)

function matchesChip(product: CatalogProduct, key: ChipKey) {
  if (key === 'productos') {
    return product.kind === 'producto'
  }
  if (key === 'servicios') {
    return product.kind === 'servicio'
  }
  if (key === 'combos') {
    return product.kind === 'combo'
  }
  if (key === 'stockBajo') {
    return product.kind === 'producto' && product.stock <= product.minStock
  }
  return true
}

function emptyProductForm(): ProductForm {
  return {
    id: null,
    categoryId: null,
    sku: '',
    barcode: '',
    name: '',
    description: '',
    kind: 'producto',
    unit: 'unidad',
    cost: 0,
    price: 0,
    stock: 0,
    minStock: 0,
    maxStock: null,
    minMargin: null,
    imageUrl: '',
    icon: '',
    variablePrice: false,
    visibleCatalog: false,
    visiblePos: true,
    active: true,
    variants: [],
  }
}

function resetSections() {
  sections.codes = false
  sections.advanced = false
  sections.variants = false
}

function resetForm() {
  Object.assign(form, emptyProductForm())
  resetSections()
  catalogError.value = ''
}

function openCreateProduct() {
  resetForm()
  productDialogOpen.value = true
}

const liveProfit = computed(() => {
  const profit = form.price - form.cost
  const margin = form.price > 0 ? (profit / form.price) * 100 : 0
  return { profit, margin }
})

function addVariant() {
  form.variants.push({ name: '', sku: '', price: null, stock: 0 })
  sections.variants = true
}

function removeVariant(index: number) {
  form.variants.splice(index, 1)
}

function openCreateCategory() {
  Object.assign(categoryForm, {
    id: null,
    name: '',
    description: '',
    icon: 'pi pi-box',
    active: true,
  })
  catalogError.value = ''
  categoryDialogOpen.value = true
}

function openEditProduct(product: CatalogProduct | null) {
  if (!product) {
    return
  }

  Object.assign(form, {
    id: product.id,
    categoryId: product.categoryId,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    name: product.name,
    description: product.description ?? '',
    kind: product.kind,
    unit: product.unit,
    cost: product.cost,
    price: product.price,
    stock: product.stock,
    minStock: product.minStock,
    maxStock: product.maxStock,
    minMargin: product.minMargin,
    imageUrl: product.imageUrl ?? '',
    icon: product.icon ?? '',
    variablePrice: product.variablePrice,
    visibleCatalog: product.visibleCatalog,
    visiblePos: product.visiblePos,
    active: product.active,
    variants: (product.variants ?? []).map((variant) => ({
      name: variant.name,
      sku: variant.sku ?? '',
      price: variant.price,
      stock: variant.stock,
    })),
  })
  resetSections()
  sections.variants = form.variants.length > 0
  catalogError.value = ''
  productDialogOpen.value = true
}

function openStockAdjustment(product: CatalogProduct | null) {
  if (!product || product.kind === 'servicio') {
    return
  }

  stockProduct.value = product
  stockMode.value = 'sumar'
  stockAmount.value = 0
  stockReason.value = 'recuento'
  stockBranch.value = 'Matriz'
  stockNotes.value = ''
  catalogError.value = ''
  stockDialogOpen.value = true
}

function applyQuickStockAmount(amount: number) {
  stockAmount.value = Math.max(stockAmount.value + amount, 0)
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function margin(product: CatalogProduct | null) {
  if (!product || product.price <= 0) {
    return '0%'
  }
  return `${Math.round(((product.price - product.cost) / product.price) * 100)}%`
}

function isLowStock(product: CatalogProduct) {
  return product.kind === 'producto' && product.stock <= product.minStock
}

function productIcon(product: CatalogProduct) {
  if (product.kind === 'servicio') {
    return 'pi pi-bolt'
  }
  if (product.kind === 'combo') {
    return 'pi pi-clone'
  }
  return 'pi pi-shopping-cart'
}

async function loadCatalog() {
  loading.value = true
  catalogError.value = ''

  try {
    const [productResponse, categoryResponse] = await Promise.all([
      $fetch<{ products: CatalogProduct[] }>('/api/pos/catalog/products'),
      $fetch<{ categories: CatalogCategory[] }>('/api/pos/catalog/categories'),
    ])

    products.value = productResponse.products
    categories.value = categoryResponse.categories
  } catch {
    catalogError.value = 'No se pudo cargar el catálogo de la tienda.'
  } finally {
    loading.value = false
  }
}

async function saveProduct() {
  catalogError.value = ''

  if (!form.name.trim()) {
    catalogError.value = 'El nombre del producto es obligatorio.'
    return
  }

  saving.value = true

  const payload = {
    categoryId: form.categoryId,
    sku: form.sku,
    barcode: form.barcode,
    name: form.name,
    description: form.description,
    kind: form.kind,
    unit: form.unit,
    cost: form.cost,
    price: form.price,
    stock: form.stock,
    minStock: form.minStock,
    maxStock: form.maxStock,
    minMargin: form.minMargin,
    imageUrl: form.imageUrl,
    icon: form.icon,
    variablePrice: form.variablePrice,
    visibleCatalog: form.visibleCatalog,
    visiblePos: form.visiblePos,
    active: form.active,
    variants: form.variants
      .filter((variant) => variant.name.trim())
      .map((variant) => ({
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        stock: variant.stock,
      })),
  }

  try {
    if (form.id) {
      await $fetch(`/api/pos/catalog/products/${form.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/pos/catalog/products', {
        method: 'POST',
        body: payload,
      })
    }

    productDialogOpen.value = false
    await loadCatalog()
  } catch (error) {
    catalogError.value = error instanceof Error ? error.message : 'No se pudo guardar el producto.'
  } finally {
    saving.value = false
  }
}

async function saveCategory() {
  catalogError.value = ''

  if (!categoryForm.name.trim()) {
    catalogError.value = 'La categoría requiere un nombre.'
    return
  }

  saving.value = true

  try {
    const payload = {
      name: categoryForm.name,
      description: categoryForm.description,
      icon: categoryForm.icon,
      active: categoryForm.active,
    }

    if (categoryForm.id) {
      await $fetch(`/api/pos/catalog/categories/${categoryForm.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/pos/catalog/categories', {
        method: 'POST',
        body: payload,
      })
    }

    categoryDialogOpen.value = false
    await loadCatalog()
  } catch {
    catalogError.value = 'No se pudo guardar la categoría.'
  } finally {
    saving.value = false
  }
}

async function saveStockAdjustment() {
  if (!stockProduct.value) {
    return
  }

  catalogError.value = ''

  if (stockAmount.value <= 0 && stockMode.value !== 'fijar') {
    catalogError.value = 'La cantidad debe ser mayor a cero.'
    return
  }

  if (stockMode.value === 'restar' && stockAmount.value > stockProduct.value.stock) {
    catalogError.value = 'El ajuste no puede dejar stock negativo.'
    return
  }

  saving.value = true

  try {
    await $fetch(`/api/pos/catalog/products/${stockProduct.value.id}/stock`, {
      method: 'POST',
      body: {
        type: stockMode.value,
        quantity: stockAmount.value,
        reason: stockReason.value,
        branch: stockBranch.value,
        notes: stockNotes.value,
      },
    })

    stockDialogOpen.value = false
    await loadCatalog()
  } catch (error) {
    catalogError.value = error instanceof Error ? error.message : 'No se pudo ajustar el stock.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="catalog-workspace">
    <div class="catalog-breadcrumb">
      <nav class="crumbs" aria-label="Ruta del catálogo">
        <span>Catálogo</span>
        <i class="pi pi-angle-right" aria-hidden="true" />
        <strong>Productos</strong>
      </nav>

      <div class="crumb-actions">
        <Button type="button" text size="small" icon="pi pi-tags" label="Categorías" @click="openCreateCategory" />
        <Select v-model="viewScope" :options="viewScopes" optionLabel="label" optionValue="value" size="small" />
        <Button
          type="button"
          text
          rounded
          icon="pi pi-refresh"
          :loading="loading"
          aria-label="Recargar catálogo"
          @click="loadCatalog"
        />
      </div>
    </div>

    <div class="catalog-heading">
      <div class="catalog-heading__text">
        <h2>Productos</h2>
        <p>{{ statsLine }}</p>
      </div>

      <div class="catalog-heading__actions">
        <Button type="button" outlined severity="secondary" icon="pi pi-qrcode" label="Escanear" />
        <Button type="button" outlined severity="secondary" icon="pi pi-upload" label="Importar" />
        <Button type="button" severity="contrast" icon="pi pi-plus" label="Nuevo producto" @click="openCreateProduct" />
      </div>
    </div>

    <Message v-if="catalogError" severity="error" :closable="false">
      {{ catalogError }}
    </Message>

    <section class="catalog-metrics" aria-label="Resumen del catálogo">
      <article>
        <span>Total productos</span>
        <strong>{{ products.length }}</strong>
        <small>en el inventario</small>
      </article>
      <article>
        <span>Valor a costo</span>
        <strong>Bs {{ money(inventoryCost) }}</strong>
        <small>stock valorizado</small>
      </article>
      <article>
        <span>Valor a precio venta</span>
        <strong>Bs {{ money(inventorySale) }}</strong>
        <small>stock valorizado</small>
      </article>
      <article :class="{ 'is-alert': lowStockCount > 0 }">
        <span>Alertas de stock</span>
        <strong>{{ lowStockCount }}</strong>
        <small>{{ lowStockCount > 0 ? 'requieren atención' : 'todo en orden' }}</small>
      </article>
    </section>

    <div class="catalog-toolbar">
      <IconField class="catalog-search">
        <InputIcon>
          <i class="pi pi-search" />
        </InputIcon>
        <InputText v-model="searchTerm" placeholder="Buscar por nombre, SKU o código de barras..." />
      </IconField>

      <div class="catalog-chips" role="tablist" aria-label="Filtros rápidos">
        <button
          v-for="chip in productFilters"
          :key="chip.key"
          type="button"
          class="chip"
          :class="{ 'is-active': activeChip === chip.key }"
          role="tab"
          :aria-selected="activeChip === chip.key"
          @click="activeChip = chip.key"
        >
          {{ chip.label }}
          <span class="chip__count">{{ chipCounts[chip.key] }}</span>
        </button>
      </div>
    </div>

    <div class="catalog-body">
      <div class="catalog-table-card">
        <DataTable
          v-model:selection="selectedProduct"
          :value="filteredProducts"
          :loading="loading"
          dataKey="id"
          selectionMode="single"
          :metaKeySelection="false"
          size="small"
          paginator
          :rows="12"
          class="catalog-table"
        >
          <template #empty>No hay productos que coincidan con el filtro.</template>
          <template #loading>Cargando catálogo...</template>

          <Column header="Producto" style="min-width: 16rem">
            <template #body="{ data }">
              <div class="product-cell">
                <span class="product-thumb">
                  <img v-if="data.imageUrl" :src="data.imageUrl" :alt="data.name" />
                  <span v-else-if="data.icon" class="thumb-emoji">{{ data.icon }}</span>
                  <i v-else :class="productIcon(data)" aria-hidden="true" />
                </span>
                <div class="product-cell__text">
                  <strong>{{ data.name }}</strong>
                  <small>{{ data.sku ? `#${data.sku}` : 'Sin SKU' }}</small>
                </div>
              </div>
            </template>
          </Column>

          <Column header="Categoría" style="min-width: 9rem">
            <template #body="{ data }">
              <span class="cell-muted">{{ data.categoryName || 'Sin categoría' }}</span>
            </template>
          </Column>

          <Column field="price" header="Precio" sortable style="min-width: 7rem">
            <template #body="{ data }">
              <strong class="cell-price">Bs {{ money(data.price) }}</strong>
            </template>
          </Column>

          <Column field="cost" header="Costo" sortable style="min-width: 7rem">
            <template #body="{ data }">
              <span class="cell-muted">Bs {{ money(data.cost) }}</span>
            </template>
          </Column>

          <Column field="stock" header="Stock" sortable style="min-width: 6rem">
            <template #body="{ data }">
              <span :class="{ 'stock-low': isLowStock(data) }">{{ data.stock }}</span>
            </template>
          </Column>

          <Column header="Acciones" style="min-width: 12rem">
            <template #body="{ data }">
              <div class="row-actions">
                <Button type="button" size="small" outlined severity="secondary" label="Editar" @click.stop="openEditProduct(data)" />
                <Button
                  type="button"
                  size="small"
                  outlined
                  severity="secondary"
                  label="Stock"
                  :disabled="data.kind === 'servicio'"
                  @click.stop="openStockAdjustment(data)"
                />
                <Button type="button" size="small" text icon="pi pi-chart-line" label="Historial" disabled v-tooltip.top="'Próximamente'" />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

      <aside class="catalog-detail" aria-label="Detalle del producto">
        <template v-if="selectedProduct">
          <div class="detail-head">
            <span class="detail-thumb">
              <img v-if="selectedProduct.imageUrl" :src="selectedProduct.imageUrl" :alt="selectedProduct.name" />
              <span v-else-if="selectedProduct.icon" class="thumb-emoji">{{ selectedProduct.icon }}</span>
              <i v-else :class="productIcon(selectedProduct)" aria-hidden="true" />
            </span>
            <div class="detail-head__text">
              <strong>{{ selectedProduct.name }}</strong>
              <small>
                {{ selectedProduct.sku ? `#${selectedProduct.sku}` : 'Sin SKU' }}
                · {{ selectedProduct.categoryName || 'Sin categoría' }}
              </small>
            </div>
          </div>

          <div class="detail-grid">
            <div>
              <span>Precio venta</span>
              <strong>Bs {{ money(selectedProduct.price) }}</strong>
            </div>
            <div>
              <span>Costo</span>
              <strong>Bs {{ money(selectedProduct.cost) }}</strong>
            </div>
            <div>
              <span>Margen</span>
              <strong>{{ margin(selectedProduct) }}</strong>
            </div>
            <div>
              <span>Stock total</span>
              <strong :class="{ 'stock-low': isLowStock(selectedProduct) }">{{ selectedProduct.stock }}</strong>
            </div>
          </div>

          <div class="detail-actions">
            <Button
              type="button"
              severity="contrast"
              icon="pi pi-sliders-h"
              label="Ajustar stock"
              :disabled="selectedProduct.kind === 'servicio'"
              @click="openStockAdjustment(selectedProduct)"
            />
            <Button type="button" outlined severity="secondary" icon="pi pi-pencil" label="Editar" @click="openEditProduct(selectedProduct)" />
          </div>
        </template>

        <div v-else class="detail-empty">
          <i class="pi pi-inbox" aria-hidden="true" />
          <p>Selecciona un producto para ver su detalle.</p>
        </div>
      </aside>
    </div>

    <Dialog
      v-model:visible="productDialogOpen"
      modal
      :header="form.id ? 'Editar producto' : 'Nuevo producto'"
      class="product-dialog"
      :style="{ width: 'min(620px, calc(100vw - 32px))' }"
    >
      <form class="pform" @submit.prevent="saveProduct">
        <div class="pform-body">
          <!-- Tipo -->
          <div class="kind-toggle">
            <button
              v-for="option in kindOptions"
              :key="option.value"
              type="button"
              class="kind-toggle__btn"
              :class="{ 'is-active': form.kind === option.value }"
              @click="form.kind = option.value as ProductForm['kind']"
            >
              {{ option.label }}
            </button>
          </div>

          <!-- Nombre -->
          <div class="pfield">
            <label for="product-name">Nombre <span class="req">*</span></label>
            <InputText id="product-name" v-model="form.name" autocomplete="off" placeholder="Ej. Coca Cola, Leche Pil, Pan..." />
          </div>

          <!-- Precio venta / Stock -->
          <div class="pgrid">
            <div class="pfield">
              <label for="product-price">Precio venta <span class="req">*</span></label>
              <InputNumber
                id="product-price"
                v-model="form.price"
                prefix="Bs "
                :min="0"
                :minFractionDigits="2"
                :maxFractionDigits="2"
                fluid
              />
            </div>
            <div class="pfield">
              <label for="product-stock">
                {{ form.id ? 'Stock actual' : 'Stock inicial' }}
                <span v-if="!form.id" class="req">*</span>
              </label>
              <InputNumber id="product-stock" v-model="form.stock" :min="0" :maxFractionDigits="2" :disabled="Boolean(form.id)" fluid />
              <small v-if="form.id" class="field-help">Usa Ajustar stock para registrar movimientos.</small>
            </div>
          </div>

          <!-- Costo / Margen mínimo -->
          <div class="pgrid">
            <div class="pfield">
              <label for="product-cost">Costo</label>
              <InputNumber
                id="product-cost"
                v-model="form.cost"
                prefix="Bs "
                :min="0"
                :minFractionDigits="2"
                :maxFractionDigits="2"
                fluid
              />
            </div>
            <div class="pfield">
              <label for="product-margin">Margen mínimo</label>
              <InputNumber
                id="product-margin"
                v-model="form.minMargin"
                suffix=" %"
                :min="0"
                :max="100"
                :placeholder="`Por defecto: ${storeDefaultMargin}%`"
                fluid
              />
            </div>
          </div>

          <!-- Ganancia en vivo -->
          <div class="profit-box" :class="{ 'is-negative': liveProfit.profit < 0 }">
            <span>Ganancia / margen</span>
            <strong>Bs {{ money(liveProfit.profit) }} · {{ liveProfit.margin.toFixed(1) }}%</strong>
          </div>

          <!-- Categoría -->
          <div class="pfield">
            <label for="product-category">Categoría / Rubro</label>
            <Select id="product-category" v-model="form.categoryId" :options="categoryOptions" optionLabel="label" optionValue="value" fluid />
          </div>

          <!-- Sección: Códigos e imagen -->
          <button type="button" class="section-toggle" :class="{ 'is-open': sections.codes }" @click="toggleSection('codes')">
            <span><i class="pi pi-chevron-right" aria-hidden="true" /> Códigos e imagen</span>
            <small>SKU, código de barras, unidad, foto</small>
          </button>
          <div v-show="sections.codes" class="section-body">
            <div class="pgrid">
              <div class="pfield">
                <label for="product-sku">SKU / Cód. barras</label>
                <InputText id="product-sku" v-model="form.sku" autocomplete="off" placeholder="Auto si vacío" />
              </div>
              <div class="pfield">
                <label for="product-unit">Unidad</label>
                <InputText id="product-unit" v-model="form.unit" autocomplete="off" placeholder="unidad" />
              </div>
            </div>
            <div class="pfield">
              <label for="product-barcode">Código de barras</label>
              <InputText id="product-barcode" v-model="form.barcode" autocomplete="off" />
            </div>
            <div class="pfield">
              <label>Imagen</label>
              <div class="image-row">
                <span class="image-preview">
                  <img v-if="form.imageUrl" :src="form.imageUrl" alt="Vista previa" />
                  <span v-else-if="form.icon">{{ form.icon }}</span>
                  <i v-else class="pi pi-image" aria-hidden="true" />
                </span>
                <div class="image-picker">
                  <InputText v-model="form.imageUrl" placeholder="URL de la foto (opcional)" />
                  <div class="emoji-grid">
                    <button
                      v-for="emoji in emojiOptions"
                      :key="emoji"
                      type="button"
                      class="emoji-btn"
                      :class="{ 'is-active': form.icon === emoji }"
                      @click="form.icon = form.icon === emoji ? '' : emoji"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sección: Detalles avanzados -->
          <button type="button" class="section-toggle" :class="{ 'is-open': sections.advanced }" @click="toggleSection('advanced')">
            <span><i class="pi pi-chevron-right" aria-hidden="true" /> Detalles avanzados</span>
            <small>Stock mín/máx, descripción, visibilidad</small>
          </button>
          <div v-show="sections.advanced" class="section-body">
            <div class="pgrid">
              <div class="pfield">
                <label for="product-min-stock">Stock mínimo</label>
                <InputNumber id="product-min-stock" v-model="form.minStock" :min="0" :maxFractionDigits="2" fluid />
              </div>
              <div class="pfield">
                <label for="product-max-stock">Stock máximo</label>
                <InputNumber id="product-max-stock" v-model="form.maxStock" :min="0" :maxFractionDigits="2" placeholder="Opcional" fluid />
              </div>
            </div>
            <div class="pfield">
              <label for="product-description">Descripción</label>
              <Textarea id="product-description" v-model="form.description" rows="2" autoResize />
            </div>
            <div class="check-row">
              <label><Checkbox v-model="form.visiblePos" binary /> <span>Visible en POS</span></label>
              <label><Checkbox v-model="form.visibleCatalog" binary /> <span>Catálogo público</span></label>
              <label><Checkbox v-model="form.variablePrice" binary /> <span>Precio variable</span></label>
              <label><Checkbox v-model="form.active" binary /> <span>Activo</span></label>
            </div>
          </div>

          <!-- Sección: Variantes -->
          <button type="button" class="section-toggle" :class="{ 'is-open': sections.variants }" @click="toggleSection('variants')">
            <span><i class="pi pi-chevron-right" aria-hidden="true" /> Variantes</span>
            <small>{{ form.variants.length ? `${form.variants.length} variante(s)` : 'Sin variantes' }}</small>
          </button>
          <div v-show="sections.variants" class="section-body">
            <div v-for="(variant, index) in form.variants" :key="index" class="variant-row">
              <InputText v-model="variant.name" placeholder="Nombre (ej. Talla M)" class="variant-name" />
              <InputNumber v-model="variant.price" mode="decimal" :min="0" :minFractionDigits="2" :maxFractionDigits="2" placeholder="Precio" class="variant-price" />
              <InputNumber v-model="variant.stock" :min="0" :maxFractionDigits="2" placeholder="Stock" class="variant-stock" />
              <Button type="button" icon="pi pi-times" text rounded severity="danger" aria-label="Quitar variante" @click="removeVariant(index)" />
            </div>
            <Button type="button" icon="pi pi-plus" label="Agregar variante" text size="small" @click="addVariant" />
          </div>
        </div>

        <footer class="pform-footer">
          <Button type="button" outlined label="Cancelar" severity="secondary" @click="productDialogOpen = false" />
          <Button type="submit" :label="form.id ? 'Guardar cambios' : 'Guardar'"  severity="contrast" :loading="saving" />
        </footer>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="stockDialogOpen"
      modal
      header="Ajustar stock"
      class="stock-dialog"
      :style="{ width: 'min(470px, calc(100vw - 32px))' }"
    >
      <form class="stock-form" @submit.prevent="saveStockAdjustment">
        <header v-if="stockProduct" class="stock-product-head">
          <span class="product-thumb">
            <img v-if="stockProduct.imageUrl" :src="stockProduct.imageUrl" :alt="stockProduct.name" />
            <span v-else-if="stockProduct.icon" class="thumb-emoji">{{ stockProduct.icon }}</span>
            <i v-else :class="productIcon(stockProduct)" aria-hidden="true" />
          </span>
          <div>
            <strong>{{ stockProduct.name }}</strong>
            <small>{{ stockProduct.sku ? `#${stockProduct.sku}` : 'Sin SKU' }}</small>
          </div>
        </header>

        <div class="stock-mode" role="tablist" aria-label="Tipo de ajuste de stock">
          <button type="button" :class="{ 'is-active': stockMode === 'sumar' }" @click="stockMode = 'sumar'">Sumar</button>
          <button type="button" :class="{ 'is-active': stockMode === 'restar' }" @click="stockMode = 'restar'">Restar</button>
          <button type="button" :class="{ 'is-active': stockMode === 'fijar' }" @click="stockMode = 'fijar'">Fijar</button>
        </div>

        <div class="stock-stepper">
          <Button type="button" text icon="pi pi-minus" aria-label="Reducir cantidad" @click="stockAmount = Math.max(stockAmount - 1, 0)" />
          <InputNumber v-model="stockAmount" :min="0" :maxFractionDigits="2" inputClass="stock-stepper-input" />
          <Button type="button" text icon="pi pi-plus" aria-label="Aumentar cantidad" @click="stockAmount += 1" />
        </div>

        <div class="stock-quick">
          <Button type="button" outlined severity="secondary" label="+1" @click="applyQuickStockAmount(1)" />
          <Button type="button" outlined severity="secondary" label="+5" @click="applyQuickStockAmount(5)" />
          <Button type="button" outlined severity="secondary" label="+10" @click="applyQuickStockAmount(10)" />
          <Button type="button" outlined severity="secondary" label="+50" @click="applyQuickStockAmount(50)" />
        </div>

        <div class="stock-result">
          <div>
            <span>Stock actual</span>
            <strong>{{ stockProduct?.stock ?? 0 }}</strong>
          </div>
          <div>
            <span>Resultado</span>
            <strong>{{ stockResult }}</strong>
          </div>
        </div>

        <div class="pfield">
          <label for="stock-branch">Sucursal</label>
          <InputText id="stock-branch" v-model="stockBranch" placeholder="Matriz" />
        </div>

        <div class="pfield">
          <label for="stock-reason">Motivo</label>
          <Select id="stock-reason" v-model="stockReason" :options="stockReasons" optionLabel="label" optionValue="value" fluid />
        </div>

        <div class="pfield">
          <label for="stock-notes">Notas</label>
          <Textarea id="stock-notes" v-model="stockNotes" rows="3" placeholder="Detalle adicional..." autoResize />
        </div>

        <footer class="stock-footer">
          <Button type="button" label="Cancelar" outlined severity="secondary" @click="stockDialogOpen = false" />
          <Button type="submit" label="Confirmar ajuste" severity="contrast" :loading="saving" />
        </footer>
      </form>
    </Dialog>

    <Dialog v-model:visible="categoryDialogOpen" modal :header="categoryForm.id ? 'Editar categoría' : 'Nueva categoría'" class="category-dialog">
      <form class="category-form" @submit.prevent="saveCategory">
        <div class="field">
          <label for="category-name">Nombre</label>
          <InputText id="category-name" v-model="categoryForm.name" autocomplete="off" />
        </div>
        <div class="field">
          <label for="category-description">Descripción</label>
          <Textarea id="category-description" v-model="categoryForm.description" rows="3" autoResize />
        </div>
        <div class="field">
          <label for="category-icon">Icono Prime</label>
          <InputText id="category-icon" v-model="categoryForm.icon" autocomplete="off" placeholder="pi pi-box" />
        </div>
        <label class="category-active">
          <Checkbox v-model="categoryForm.active" binary />
          <span>Categoría activa</span>
        </label>
        <footer class="dialog-actions">
          <Button type="button" label="Cancelar" severity="secondary" outlined @click="categoryDialogOpen = false" />
          <Button type="submit" label="Guardar categoría" :loading="saving" />
        </footer>
      </form>
    </Dialog>
  </section>
</template>

<style scoped>
.catalog-workspace {
  display: grid;
  gap: 14px;
  padding: 12px 0 0;
}

/* --- Breadcrumb --- */
.catalog-breadcrumb {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.crumbs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 0.86rem;
  font-weight: 700;
}

.crumbs strong {
  color: #0f172a;
}

.crumbs i {
  font-size: 0.7rem;
  color: #94a3b8;
}

.crumb-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* --- Heading --- */
.catalog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.catalog-heading__text h2 {
  margin: 0;
  color: #071327;
  font-size: 1.6rem;
  font-weight: 900;
}

.catalog-heading__text p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 600;
}

.catalog-heading__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* --- Metrics --- */
.catalog-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.catalog-metrics article {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.catalog-metrics span {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.catalog-metrics strong {
  color: #0f172a;
  font-size: 1.55rem;
  font-weight: 900;
  line-height: 1.05;
}

.catalog-metrics small {
  color: #94a3b8;
  font-size: 0.74rem;
  font-weight: 600;
}

.catalog-metrics .is-alert strong {
  color: #dc2626;
}

/* --- Toolbar (search + chips) --- */
.catalog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.catalog-search {
  flex: 1 1 280px;
  max-width: 420px;
}

.catalog-search :deep(.p-inputtext) {
  width: 100%;
}

.catalog-chips {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chip:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.chip.is-active {
  border-color: #0f172a;
  background: #0f172a;
  color: #ffffff;
}

.chip__count {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #eef2f6;
  color: #475569;
  font-size: 0.7rem;
  font-weight: 800;
}

.chip.is-active .chip__count {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

/* --- Body: table + detail --- */
.catalog-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}

.catalog-table-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.catalog-table {
  font-size: 0.85rem;
}

.catalog-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.catalog-table :deep(.p-datatable-tbody > tr[aria-selected='true']) {
  box-shadow: inset 3px 0 0 #0f172a;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.product-thumb,
.detail-thumb {
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.product-thumb {
  width: 36px;
  height: 36px;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.product-cell__text strong {
  display: block;
  color: #0f172a;
  font-size: 0.86rem;
  font-weight: 700;
}

.product-cell__text small {
  display: block;
  color: #94a3b8;
  font-size: 0.74rem;
  font-weight: 700;
}

.cell-muted {
  color: #64748b;
}

.cell-price {
  color: #0f172a;
  font-weight: 800;
}

.stock-low {
  color: #b45309;
  font-weight: 900;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* --- Detail panel --- */
.catalog-detail {
  position: sticky;
  top: 14px;
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-thumb {
  width: 56px;
  height: 56px;
  font-size: 1.4rem;
  flex-shrink: 0;
}

.detail-head__text strong {
  display: block;
  color: #0f172a;
  font-size: 1.05rem;
  font-weight: 800;
}

.detail-head__text small {
  display: block;
  margin-top: 2px;
  color: #94a3b8;
  font-size: 0.76rem;
  font-weight: 700;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid > div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid #eef2f6;
  border-radius: 10px;
  background: #f8fafc;
}

.detail-grid span {
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.detail-grid strong {
  color: #0f172a;
  font-size: 1.1rem;
  font-weight: 900;
  line-height: 1;
}

.detail-actions {
  display: grid;
  gap: 8px;
}

.detail-actions :deep(.p-button) {
  width: 100%;
}

.detail-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 30px 10px;
  color: #94a3b8;
  text-align: center;
}

.detail-empty i {
  font-size: 1.8rem;
}

.detail-empty p {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
}

/* Botones blancos nítidos (Escanear, Importar, Editar, Stock) como el mockup */
.catalog-workspace :deep(.p-button-outlined.p-button-secondary) {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
  color: #1e293b !important;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.catalog-workspace :deep(.p-button-outlined.p-button-secondary:hover) {
  background: #f8fafc !important;
  border-color: #cbd5e1 !important;
  color: #0f172a !important;
}

.catalog-workspace :deep(.p-button-outlined.p-button-secondary .p-button-icon) {
  color: #475569;
}

/* --- Dialog forms --- */
.catalog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  min-width: min(760px, calc(100vw - 44px));
}

.category-form {
  display: grid;
  gap: 14px;
  min-width: min(420px, calc(100vw - 44px));
}

.field {
  display: grid;
  gap: 6px;
}

.field.wide,
.dialog-actions.wide,
.form-checks.wide {
  grid-column: 1 / -1;
}

.field label,
.form-checks span {
  color: #17233a;
  font-size: 0.8rem;
  font-weight: 800;
}

.form-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
}

.form-checks label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-active {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #17233a;
  font-size: 0.84rem;
  font-weight: 800;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

/* --- Thumbnails (imagen / emoji) --- */
.product-thumb img,
.detail-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-thumb,
.detail-thumb {
  overflow: hidden;
}

.thumb-emoji {
  line-height: 1;
}

.product-thumb .thumb-emoji {
  font-size: 1.1rem;
}

.detail-thumb .thumb-emoji {
  font-size: 1.7rem;
}

/* --- Diálogo de producto (registro amigable) --- */
.product-dialog :deep(.p-dialog-content) {
  padding: 0;
}

.pform {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pform-body {
  display: grid;
  gap: 14px;
  max-height: min(66vh, 560px);
  overflow-y: auto;
  padding: 18px 20px;
}

.pform-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #eef2f6;
}

/* Toggle de tipo */
.kind-toggle {
  display: flex;
  gap: 6px;
}

.kind-toggle__btn {
  flex: 1;
  height: 34px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.kind-toggle__btn:hover {
  background: #f8fafc;
}

.kind-toggle__btn.is-active {
  border-color: #0f172a;
  background: #0f172a;
  color: #ffffff;
}

/* Campos */
.pfield {
  display: grid;
  gap: 6px;
}

.pgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.pfield label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
}

.field-help {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 700;
}

.pfield .req {
  color: #dc2626;
}

.pfield :deep(.p-inputtext),
.pfield :deep(.p-inputnumber),
.pfield :deep(.p-select) {
  width: 100%;
}

/* Ganancia en vivo */
.profit-box {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 11px 14px;
  border-radius: 8px;
  background: #f1f5f9;
  font-size: 0.82rem;
}

.profit-box span {
  color: #64748b;
}

.profit-box strong {
  color: #0f172a;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.profit-box.is-negative strong {
  color: #dc2626;
}

/* Secciones plegables */
.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 2px;
  border: 0;
  border-top: 1px solid #eef2f6;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.section-toggle > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
  font-size: 0.86rem;
  font-weight: 700;
}

.section-toggle > span i {
  font-size: 0.7rem;
  color: #94a3b8;
  transition: transform 0.18s ease;
}

.section-toggle.is-open > span i {
  transform: rotate(90deg);
}

.section-toggle small {
  color: #94a3b8;
  font-size: 0.74rem;
}

.section-body {
  display: grid;
  gap: 12px;
  padding: 2px 2px 8px;
}

/* Imagen */
.image-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.image-preview {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 1.6rem;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-preview i {
  color: #94a3b8;
}

.image-picker {
  flex: 1;
  display: grid;
  gap: 8px;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.emoji-btn {
  width: 30px;
  height: 30px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  background: #ffffff;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.emoji-btn:hover {
  background: #f8fafc;
}

.emoji-btn.is-active {
  border-color: #0f172a;
  background: #eef2ff;
}

/* Checks */
.check-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}

.check-row label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
}

/* Variantes */
.variant-row {
  display: grid;
  grid-template-columns: 1fr 110px 90px auto;
  gap: 8px;
  align-items: center;
}

.variant-row :deep(.p-inputtext),
.variant-row :deep(.p-inputnumber) {
  width: 100%;
}

/* --- Ajuste de stock --- */
.stock-dialog :deep(.p-dialog-content) {
  padding: 0;
}

.stock-form {
  display: grid;
  gap: 14px;
  padding: 18px 20px 0;
}

.stock-product-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 2px;
}

.stock-product-head strong,
.stock-product-head small {
  display: block;
}

.stock-product-head strong {
  color: #0f172a;
  font-size: 0.92rem;
  font-weight: 900;
}

.stock-product-head small {
  color: #94a3b8;
  font-size: 0.76rem;
  font-weight: 700;
}

.stock-mode {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.stock-mode button {
  height: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
}

.stock-mode button:hover {
  background: #f8fafc;
}

.stock-mode button.is-active {
  border-color: #0f172a;
  background: #0b0f14;
  color: #ffffff;
}

.stock-stepper {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  min-height: 54px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
}

.stock-stepper :deep(.p-button) {
  height: 100%;
  border-radius: 0 !important;
  color: #0f172a !important;
}

.stock-stepper :deep(.p-inputnumber),
.stock-stepper :deep(.p-inputtext) {
  width: 100%;
  height: 100%;
  border: 0 !important;
  border-right: 1px solid #e2e8f0 !important;
  border-left: 1px solid #e2e8f0 !important;
  border-radius: 0 !important;
  background: #ffffff !important;
  text-align: center;
}

.stock-stepper :deep(.stock-stepper-input) {
  color: #0f172a;
  font-size: 1.42rem;
  font-weight: 900;
  text-align: center;
}

.stock-quick {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.stock-quick :deep(.p-button) {
  height: 32px;
  color: #64748b !important;
  font-size: 0.76rem;
  font-weight: 800;
}

.stock-result {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f5f3ef;
}

.stock-result > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.stock-result span {
  color: #7c7a74;
  font-size: 0.76rem;
  font-weight: 700;
}

.stock-result strong {
  color: #111827;
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1;
}

.stock-result > div:first-child strong {
  color: #7c7a74;
  font-size: 0.82rem;
}

.stock-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 2px -20px 0;
  padding: 14px 20px;
  border-top: 1px solid #eef2f6;
  background: #ffffff;
}

@media (max-width: 480px) {
  .variant-row {
    grid-template-columns: 1fr 1fr auto;
  }
}

@media (max-width: 1100px) {
  .catalog-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .catalog-body {
    grid-template-columns: 1fr;
  }

  .catalog-detail {
    position: static;
  }
}

@media (max-width: 720px) {
  .catalog-heading {
    flex-direction: column;
  }

  .catalog-heading__actions {
    flex-wrap: wrap;
  }

  .catalog-metrics {
    grid-template-columns: 1fr;
  }

  .catalog-form {
    grid-template-columns: 1fr;
  }
}
</style>
