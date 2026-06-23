<script setup lang="ts">
import { costingTypePorDefecto } from '~~/shared/utils/finanzas'
import type { CatalogCategory, CatalogProduct, CostComponent } from '~/stores/catalog'

type VariantForm = {
  name: string
  sku: string
  barcode: string
  cost: number | null
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
  costingType: CatalogProduct['costingType']
  unit: string
  cost: number
  price: number
  stock: number
  minStock: number
  maxStock: number | null
  minMargin: number | null
  imageUrl: string
  icon: string
  visiblePos: boolean
  variants: VariantForm[]
  costComponents: CostComponent[]
}

type ChipKey = 'todos' | 'productos' | 'servicios' | 'stockBajo' | 'combos'

type StockMovement = {
  id: string
  type: 'entrada' | 'salida' | 'ajuste'
  origin: 'venta' | 'compra' | 'manual' | 'devolucion'
  quantity: number
  previousStock: number
  newStock: number
  cost: number | null
  notes: string | null
  createdAt: string
  variantName: string | null
  userName: string | null
}

const catalogStore = useCatalogStore()
const {
  catalogProducts: products,
  categories,
  catalogLoading: loading,
  catalogError: storeCatalogError,
} = storeToRefs(catalogStore)
const saving = ref(false)
const productDialogOpen = ref(false)
const categoryDialogOpen = ref(false)
const stockDialogOpen = ref(false)
const historyDialogOpen = ref(false)
const catalogError = ref('')
const categoryDialogFromProduct = ref(false)

const searchTerm = ref('')
const activeChip = ref<ChipKey>('todos')
const selectedCategoryId = ref<string | null>(null)
const stockProduct = ref<CatalogProduct | null>(null)
const stockMode = ref<'sumar' | 'restar' | 'fijar'>('sumar')
const stockAmount = ref(0)
const stockReason = ref('recuento')
const stockBranch = ref('Matriz')
const stockNotes = ref('')
const historyProduct = ref<CatalogProduct | null>(null)
const historyRows = ref<StockMovement[]>([])
const historyLoading = ref(false)

const categoryForm = reactive({
  id: null as string | null,
  name: '',
  description: '',
  icon: 'pi pi-box',
  active: true,
})

const kindOptions = [
  { label: 'Producto', value: 'producto', icon: '📦', hint: 'Algo físico que vendes' },
  { label: 'Servicio', value: 'servicio', icon: '🛠️', hint: 'Trabajo o atención' },
  { label: 'Combo', value: 'combo', icon: '🎁', hint: 'Varios productos juntos' },
]

// Para productos físicos el dueño elige cómo calcula el costo. Para "servicio"
// y "combo" el tipo de costeo es automático, por eso no se muestra el selector.
const costingTypeOptions = [
  {
    label: 'Comercial',
    value: 'reventa',
    icon: '🛒',
    description: 'Lo compras hecho y lo revendes con ganancia.',
  },
  {
    label: 'Producción',
    value: 'produccion',
    icon: '👩‍🍳',
    description: 'Lo preparas o armas con insumos.',
  },
]

// Margen por unidad sugerido según el tipo (el dueño igual puede cambiarlo).
const defaultMarginByCostingType: Record<CatalogProduct['costingType'], number> = {
  reventa: 25,
  produccion: 30,
  servicio: 30,
}

// Lista cerrada de unidades de venta para no dejar texto libre.
const unitOptions = [
  { label: 'Unidad', value: 'unidad' },
  { label: 'Kilogramo (kg)', value: 'kg' },
  { label: 'Gramo (g)', value: 'g' },
  { label: 'Libra (lb)', value: 'lb' },
  { label: 'Litro (L)', value: 'litro' },
  { label: 'Mililitro (ml)', value: 'ml' },
  { label: 'Metro (m)', value: 'metro' },
  { label: 'Caja', value: 'caja' },
  { label: 'Paquete', value: 'paquete' },
  { label: 'Docena', value: 'docena' },
  { label: 'Par', value: 'par' },
  { label: 'Porción', value: 'porcion' },
  { label: 'Hora', value: 'hora' },
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

const primeIconOptions = [
  { label: 'Caja', value: 'pi pi-box' },
  { label: 'Etiqueta', value: 'pi pi-tag' },
  { label: 'Etiquetas', value: 'pi pi-tags' },
  { label: 'Carrito', value: 'pi pi-shopping-cart' },
  { label: 'Bolsa', value: 'pi pi-shopping-bag' },
  { label: 'Tienda', value: 'pi pi-shop' },
  { label: 'Café', value: 'pi pi-cup' },
  { label: 'Gift / Regalo', value: 'pi pi-gift' },
  { label: 'Estrella', value: 'pi pi-star' },
  { label: 'Corazón', value: 'pi pi-heart' },
  { label: 'Rayo', value: 'pi pi-bolt' },
  { label: 'Llave inglesa', value: 'pi pi-wrench' },
  { label: 'Maletín', value: 'pi pi-briefcase' },
  { label: 'Pastilla / Salud', value: 'pi pi-heart-fill' },
  { label: 'Camión', value: 'pi pi-truck' },
  { label: 'Casa', value: 'pi pi-home' },
  { label: 'Reloj', value: 'pi pi-clock' },
  { label: 'Calendario', value: 'pi pi-calendar' },
  { label: 'Usuario', value: 'pi pi-user' },
  { label: 'Cámara', value: 'pi pi-camera' },
  { label: 'Imagen', value: 'pi pi-image' },
  { label: 'Móvil', value: 'pi pi-mobile' },
  { label: 'Escritorio', value: 'pi pi-desktop' },
  { label: 'Libro', value: 'pi pi-book' },
  { label: 'Mapa', value: 'pi pi-map-marker' },
  { label: 'Dinero', value: 'pi pi-dollar' },
  { label: 'Tarjeta', value: 'pi pi-credit-card' },
  { label: 'Paleta / Colores', value: 'pi pi-palette' },
  { label: 'Llave', value: 'pi pi-key' },
  { label: 'Globo', value: 'pi pi-globe' },
]

const session = usePosSession()
const storeDefaultMargin = computed(() => session.value?.defaultMargin ?? 20)

const sections = reactive({
  codes: false,
  advanced: false,
  variants: false,
  cost: true,
})

function toggleSection(key: keyof typeof sections) {
  sections[key] = !sections[key]
}

const productFilters: { key: ChipKey; label: string }[] = [
  { key: 'todos', label: 'Todo' },
  { key: 'productos', label: 'Productos' },
  { key: 'servicios', label: 'Servicios' },
  { key: 'stockBajo', label: 'Stock bajo' },
  { key: 'combos', label: 'Combos' },
]

const form = reactive<ProductForm>(emptyProductForm())

// Emoji libre fuera del catálogo: refleja form.icon cuando no es uno de los predefinidos
const customEmojiModel = computed({
  get: () => (form.icon && !emojiOptions.includes(form.icon) ? form.icon : ''),
  set: (value: string) => {
    form.icon = value.trim()
  },
})

// Si un producto viejo tiene una unidad que no está en la lista cerrada, la
// agregamos para no perderla al editar.
const unitSelectOptions = computed(() => {
  const known = unitOptions.some((option) => option.value === form.unit)
  if (form.unit && !known) {
    return [...unitOptions, { label: form.unit, value: form.unit }]
  }
  return unitOptions
})

const lowStockCount = computed(() =>
  products.value.filter((product) => product.kind === 'producto' && product.stock <= product.minStock).length,
)
const noStockCount = computed(() =>
  products.value.filter((product) => product.kind === 'producto' && product.stock <= 0).length,
)
const stockManagedProducts = computed(() => products.value.filter((product) => product.kind !== 'servicio'))
const inventorySale = computed(() => stockManagedProducts.value.reduce((sum, product) => sum + product.price * product.stock, 0))

const categoryOptions = computed(() => [
  { label: 'Sin categoría', value: null },
  ...categories.value
    .filter((category) => category.active)
    .map((category) => ({ label: category.name, value: category.id })),
])

const chipCounts = computed(() => {
  const counts = {} as Record<ChipKey, number>
  for (const filter of productFilters) {
    counts[filter.key] = products.value
      .filter((product) => matchesCategory(product))
      .filter((product) => matchesChip(product, filter.key)).length
  }
  return counts
})

const categoryFilters = computed(() => [
  { id: null, name: 'Todas', count: products.value.length },
  ...categories.value
    .filter((category) => category.active)
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: products.value.filter((product) => product.categoryId === category.id).length,
    })),
])

const filteredProducts = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()

  return products.value.filter((product) => {
    if (!matchesCategory(product)) {
      return false
    }
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
  return `${shown} de ${products.value.length} ítems visibles`
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
  () => form.kind,
  (kind) => {
    if (kind === 'servicio') {
      form.costingType = 'servicio'
    } else if (kind === 'combo' && form.costingType === 'reventa') {
      form.costingType = 'produccion'
    } else if (kind === 'producto' && form.costingType === 'servicio') {
      form.costingType = 'reventa'
    }

    if (kind !== 'servicio') {
      return
    }

    form.stock = 0
    form.minStock = 0
    form.maxStock = null
    form.variants = []
  },
)

// Al llegar desde "Registrar ingreso/gasto → inventario" abrimos directo el diálogo
// para registrar la mercadería que entró (?accion=entrada).
const route = useRoute()
onMounted(async () => {
  await loadCatalog()
  if (route.query.accion === 'entrada') {
    openCreateProduct()
  }
})

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

function matchesCategory(product: CatalogProduct) {
  return selectedCategoryId.value === null || product.categoryId === selectedCategoryId.value
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
    costingType: 'reventa',
    unit: 'unidad',
    cost: null,
    price: 0,
    stock: 0,
    minStock: 0,
    maxStock: null,
    minMargin: null,
    imageUrl: '',
    icon: '',
    visiblePos: true,
    variants: [],
    costComponents: [],
  }
}

function resetSections() {
  sections.codes = false
  sections.advanced = false
  sections.variants = false
  // El desglose de costo arranca abierto: es parte central de fijar el precio,
  // no un extra escondido. Si se deja cerrado se ve como una línea y "desaparece".
  sections.cost = true
}

function resetForm() {
  Object.assign(form, emptyProductForm())
  resetSections()
  catalogError.value = ''
}

function openCreateProduct() {
  resetForm()
  // Pre-llena el tipo de costeo desde el tipo de negocio global de la tienda
  // (definido en el diagnóstico). El dueño puede cambiarlo por producto.
  form.costingType = costingTypePorDefecto(session.value?.tipoNegocio ?? null)
  productDialogOpen.value = true
}

const liveProfit = computed(() => {
  const profit = form.price - form.cost
  const margin = form.price > 0 ? (profit / form.price) * 100 : 0
  return { profit, margin }
})

// --- Desglose de costo (opcional): materia prima, mano de obra, insumos, otros ---
const costComponentTypes: { value: CostComponent['tipo'], label: string, icon: string }[] = [
  { value: 'materia_prima', label: 'Materia prima', icon: '🧺' },
  { value: 'mano_obra', label: 'Mano de obra', icon: '⏱️' },
  { value: 'insumo', label: 'Insumos', icon: '🧴' },
  { value: 'otro', label: 'Otros', icon: '➕' },
]

const costComponentsTotal = computed(() =>
  form.costComponents.reduce((sum, component) => sum + (Number(component.monto) || 0), 0),
)
// Cuando hay desglose, su suma manda sobre el campo Costo (y lo bloquea).
const usesCostBreakdown = computed(() => form.costComponents.length > 0)

watch([costComponentsTotal, usesCostBreakdown], ([total, uses]) => {
  if (uses) {
    form.cost = total
  }
})

function addCostComponent(tipo: CostComponent['tipo'] = 'materia_prima') {
  form.costComponents.push({ tipo, nombre: '', monto: 0 })
  sections.cost = true
}

function removeCostComponent(index: number) {
  form.costComponents.splice(index, 1)
}

const costingTypeLabels: Record<CatalogProduct['costingType'], string> = {
  reventa: 'comercial',
  produccion: 'producción',
  servicio: 'servicio',
}
const costingTypeLabel = computed(() => costingTypeLabels[form.costingType] ?? 'este tipo')
const typeDefaultMargin = computed(
  () => defaultMarginByCostingType[form.costingType] ?? storeDefaultMargin.value ?? 0,
)
const targetMargin = computed(() => Number(form.minMargin ?? typeDefaultMargin.value))
const suggestedPrice = computed(() => {
  const margin = Math.min(Math.max(targetMargin.value, 0), 95)
  if (form.cost <= 0 || margin <= 0) {
    return form.cost
  }
  return form.cost / (1 - margin / 100)
})
const suggestedProfit = computed(() => Math.max(suggestedPrice.value - form.cost, 0))

function applySuggestedPrice() {
  form.price = Number(suggestedPrice.value.toFixed(2))
}

// --- Foto del producto ---
// Por ahora la imagen se guarda comprimida dentro de la base de datos (base64).
// Más adelante migraremos a un storage de archivos real.
const imageInput = ref<HTMLInputElement | null>(null)
const imageProcessing = ref(false)

function pickImage() {
  imageInput.value?.click()
}

function clearImage() {
  form.imageUrl = ''
  if (imageInput.value) {
    imageInput.value.value = ''
  }
}

async function onImagePick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  catalogError.value = ''

  if (!file.type.startsWith('image/')) {
    catalogError.value = 'El archivo debe ser una imagen.'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    catalogError.value = 'La imagen es muy pesada. Usa una foto de menos de 8 MB.'
    return
  }

  imageProcessing.value = true
  try {
    form.imageUrl = await compressImage(file)
    form.icon = ''
  } catch {
    catalogError.value = 'No se pudo procesar la imagen. Intenta con otra.'
  } finally {
    imageProcessing.value = false
    input.value = ''
  }
}

// Reduce la foto a 480px de lado máximo y la exporta como JPEG para que el
// base64 quede liviano (≈30-80 KB) antes de guardarlo.
function compressImage(file: File, maxSize = 480, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.round(image.width * scale)
        const height = Math.round(image.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('canvas'))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.onerror = () => reject(new Error('image'))
      image.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('reader'))
    reader.readAsDataURL(file)
  })
}

function addVariant() {
  form.variants.push({ name: '', sku: '', barcode: '', cost: null, price: null, stock: 0 })
  sections.variants = true
}

function removeVariant(index: number) {
  form.variants.splice(index, 1)
}

function openCreateCategory(fromProduct = false) {
  Object.assign(categoryForm, {
    id: null,
    name: '',
    description: '',
    icon: 'pi pi-box',
    active: true,
  })
  categoryDialogFromProduct.value = fromProduct
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
    costingType: product.costingType,
    unit: product.unit,
    cost: product.cost,
    price: product.price,
    stock: product.stock,
    minStock: product.minStock,
    maxStock: product.maxStock,
    minMargin: product.minMargin,
    imageUrl: product.imageUrl ?? '',
    icon: product.icon ?? '',
    visiblePos: product.visiblePos,
    variants: (product.variants ?? []).map((variant) => ({
      name: variant.name,
      sku: variant.sku ?? '',
      barcode: variant.barcode ?? '',
      cost: variant.cost,
      price: variant.price,
      stock: variant.stock,
    })),
    costComponents: (product.costComponents ?? []).map((component) => ({
      tipo: component.tipo,
      nombre: component.nombre,
      monto: component.monto,
    })),
  })
  resetSections()
  sections.variants = form.variants.length > 0
  sections.cost = form.costComponents.length > 0
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

function movementLabel(type: StockMovement['type']) {
  if (type === 'entrada') {
    return 'Entrada'
  }

  if (type === 'salida') {
    return 'Salida'
  }

  return 'Ajuste'
}

function movementSeverity(type: StockMovement['type']) {
  if (type === 'entrada') {
    return 'success'
  }

  if (type === 'salida') {
    return 'danger'
  }

  return 'info'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function loadCatalog() {
  catalogError.value = ''

  if (catalogStore.hasCatalog) {
    catalogStore.refreshCatalogInBackground()
    return
  }

  await catalogStore.loadCatalog().catch(() => {
    catalogError.value = storeCatalogError.value || 'No se pudo cargar el catálogo de la tienda.'
  })
}

async function refreshCatalog() {
  catalogError.value = ''
  await catalogStore.loadCatalog({ force: true }).catch(() => {
    catalogError.value = storeCatalogError.value || 'No se pudo cargar el catálogo de la tienda.'
  })
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
    costingType: form.costingType,
    unit: form.unit,
    cost: form.cost,
    price: form.price,
    stock: form.stock,
    minStock: form.minStock,
    maxStock: form.maxStock,
    minMargin: form.minMargin,
    imageUrl: form.imageUrl,
    icon: form.icon,
    visiblePos: form.visiblePos,
    variants: form.variants
      .filter((variant) => variant.name.trim())
      .map((variant) => ({
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        cost: variant.cost,
        price: variant.price,
        stock: variant.stock,
      })),
    costComponents: form.costComponents
      .filter((component) => component.nombre.trim())
      .map((component) => ({
        tipo: component.tipo,
        nombre: component.nombre,
        monto: component.monto,
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
    catalogStore.invalidateCatalog()
    await catalogStore.loadCatalog({ force: true })
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
      active: true,
    }

    if (categoryForm.id) {
      await $fetch(`/api/pos/catalog/categories/${categoryForm.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      const response = await $fetch<{ category: CatalogCategory }>('/api/pos/catalog/categories', {
        method: 'POST',
        body: payload,
      })
      if (categoryDialogFromProduct.value) {
        form.categoryId = response.category.id
      }
    }

    categoryDialogOpen.value = false
    categoryDialogFromProduct.value = false
    catalogStore.invalidateCatalog()
    await catalogStore.loadCatalog({ force: true })
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
    catalogStore.invalidateCatalog()
    await catalogStore.loadCatalog({ force: true })
  } catch (error) {
    catalogError.value = error instanceof Error ? error.message : 'No se pudo ajustar el stock.'
  } finally {
    saving.value = false
  }
}

async function openStockHistory(product: CatalogProduct | null) {
  if (!product || product.kind === 'servicio') {
    return
  }

  historyProduct.value = product
  historyRows.value = []
  historyLoading.value = true
  catalogError.value = ''
  historyDialogOpen.value = true

  try {
    const response = await $fetch<{ movements: StockMovement[] }>(`/api/pos/catalog/products/${product.id}/stock`)
    historyRows.value = response.movements
  } catch {
    catalogError.value = 'No se pudo cargar el historial de stock.'
  } finally {
    historyLoading.value = false
  }
}
</script>

<template>
  <section class="catalog-workspace">
    <header class="catalog-header">
      <div class="catalog-heading">
        <span class="catalog-eyebrow">{{ session?.store }}</span>
        <h2>Inventario</h2>
        <p>Productos, servicios, precios, costos por unidad y stock.</p>
      </div>

      <div class="catalog-primary-actions">
        <Button type="button" text size="small" icon="pi pi-refresh" label="Actualizar" :loading="loading" @click="refreshCatalog" />
        <Button type="button" icon="pi pi-plus" label="Nuevo producto" class="new-product-button" @click="openCreateProduct" />
      </div>
    </header>

    <Message v-if="catalogError" severity="error" :closable="false">
      {{ catalogError }}
    </Message>

    <section class="catalog-summary" aria-label="Resumen del inventario">
      <article>
        <span>Ítems</span>
        <strong>{{ products.length }}</strong>
      </article>
      <article>
        <span>Stock bajo</span>
        <strong :class="{ 'is-danger': lowStockCount > 0 }">{{ lowStockCount }}</strong>
      </article>
      <article>
        <span>Sin stock</span>
        <strong :class="{ 'is-danger': noStockCount > 0 }">{{ noStockCount }}</strong>
      </article>
      <article>
        <span>Valor venta</span>
        <strong>Bs {{ money(inventorySale) }}</strong>
      </article>
    </section>

    <section class="category-strip" aria-label="Categorías">
      <div class="category-strip__list">
        <button
          v-for="category in categoryFilters"
          :key="category.id ?? 'all'"
          type="button"
          class="category-pill"
          :class="{ 'is-active': selectedCategoryId === category.id }"
          @click="selectedCategoryId = category.id"
        >
          <span>{{ category.name }}</span>
          <small>{{ category.count }}</small>
        </button>
      </div>
      <Button type="button" text size="small" icon="pi pi-tags" label="Nueva categoría" @click="openCreateCategory()" />
    </section>

    <section class="catalog-toolbar" aria-label="Búsqueda y filtros">
      <IconField class="catalog-search">
        <InputIcon>
          <i class="pi pi-search" />
        </InputIcon>
        <InputText v-model="searchTerm" placeholder="Buscar producto, SKU o código de barras" />
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
    </section>

    <section class="product-list-panel" aria-label="Lista de productos">
      <header class="product-list-head">
        <strong>{{ statsLine }}</strong>
        <span>Precio, costo y stock listos para venta</span>
      </header>

      <DataTable
        :value="filteredProducts"
        :loading="loading"
        dataKey="id"
        size="small"
        paginator
        :rows="12"
        class="catalog-table"
      >
        <template #empty>
          <div class="empty-products">
            <i class="pi pi-box" aria-hidden="true" />
            <strong>No hay productos con estos filtros</strong>
            <span>Cambia la búsqueda o crea un producto nuevo.</span>
            <Button type="button" icon="pi pi-plus" label="Nuevo producto" @click="openCreateProduct" />
          </div>
        </template>
        <template #loading>Cargando productos...</template>

        <Column header="Producto" style="min-width: 18rem">
          <template #body="{ data }">
            <div class="product-cell">
              <span class="product-thumb">
                <img v-if="data.imageUrl" :src="data.imageUrl" :alt="data.name" />
                <span v-else-if="data.icon" class="thumb-emoji">{{ data.icon }}</span>
                <i v-else :class="productIcon(data)" aria-hidden="true" />
              </span>
              <div class="product-cell__text">
                <strong>{{ data.name }}</strong>
                <small>{{ data.categoryName || 'Sin categoría' }} · {{ data.sku ? `SKU ${data.sku}` : 'Sin SKU' }}</small>
              </div>
            </div>
          </template>
        </Column>

        <Column field="price" header="Precio venta" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <span class="cell-label">Precio venta</span>
            <strong class="cell-price">Bs {{ money(data.price) }}</strong>
          </template>
        </Column>

        <Column field="cost" header="Costo" sortable style="min-width: 7rem">
          <template #body="{ data }">
            <span class="cell-label">Costo</span>
            <span class="cell-muted">Bs {{ money(data.cost) }}</span>
          </template>
        </Column>

        <Column header="Margen" style="min-width: 6.5rem">
          <template #body="{ data }">
            <span class="cell-label">Margen</span>
            <span class="margin-pill">{{ margin(data) }}</span>
          </template>
        </Column>

        <Column field="stock" header="Stock" sortable style="min-width: 7rem">
          <template #body="{ data }">
            <span class="cell-label">Stock</span>
            <span v-if="data.kind === 'servicio'" class="cell-muted">No aplica</span>
            <span v-else class="stock-pill" :class="{ 'is-low': isLowStock(data) }">{{ data.stock }}</span>
          </template>
        </Column>

        <Column header="Señales" style="min-width: 9rem">
          <template #body="{ data }">
            <span class="cell-label">Señales</span>
            <div class="signal-badges">
              <span v-if="data.visiblePos" class="signal-badge is-sale">A la venta</span>
              <span v-if="isLowStock(data)" class="signal-badge is-low">Stock bajo</span>
            </div>
          </template>
        </Column>

        <Column header="Acciones" style="min-width: 13rem">
          <template #body="{ data }">
            <div class="row-actions">
              <Button type="button" size="small" icon="pi pi-pencil" label="Editar" outlined severity="secondary" @click.stop="openEditProduct(data)" />
              <Button
                type="button"
                size="small"
                icon="pi pi-sliders-h"
                label="Stock"
                outlined
                severity="secondary"
                :disabled="data.kind === 'servicio'"
                @click.stop="openStockAdjustment(data)"
              />
              <Button
                type="button"
                size="small"
                text
                icon="pi pi-history"
                aria-label="Historial"
                :disabled="data.kind === 'servicio'"
                @click.stop="openStockHistory(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="productDialogOpen"
      modal
      :header="form.id ? 'Editar producto' : 'Crear producto'"
      class="product-dialog"
      :style="{ width: 'min(860px, calc(100vw - 24px))' }"
    >
      <form class="pform" @submit.prevent="saveProduct">
        <div class="pform-body">
          <!-- Nombre -->
          <div class="pfield">
            <label for="product-name">Nombre <span class="req">*</span></label>
            <InputText id="product-name" v-model="form.name" autocomplete="off" placeholder="Ej. Coca Cola, Leche Pil, Pan..." />
          </div>

          <div class="product-main-grid">
            <div class="pfield">
              <label for="product-kind">Tipo</label>
              <Select
                id="product-kind"
                v-model="form.kind"
                :options="kindOptions"
                optionLabel="label"
                optionValue="value"
                fluid
              />
            </div>

            <div class="pfield">
              <label for="product-category">Categoría / Rubro</label>
              <div class="category-picker">
                <Select id="product-category" v-model="form.categoryId" :options="categoryOptions" optionLabel="label" optionValue="value" fluid />
                <Button
                  type="button"
                  icon="pi pi-plus"
                  label="Nueva"
                  outlined
                  @click="openCreateCategory(true)"
                />
              </div>
            </div>
          </div>

          <!-- Costo por partes (opcional): siempre visible, sin plegar -->
          <div v-if="form.kind !== 'combo'" class="cost-section">
            <p class="step-heading"><i class="pi pi-calculator" aria-hidden="true" /> Costo por partes <span class="step-heading__opt">opcional</span></p>

            <div v-if="form.kind === 'producto'" class="pfield">
              <label for="product-costing-type">Tipo de costo</label>
              <Select
                id="product-costing-type"
                v-model="form.costingType"
                :options="costingTypeOptions"
                optionLabel="label"
                optionValue="value"
                fluid
              />
            </div>

            <p class="cost-hint">Anota cuánto te cuesta cada parte de <strong>1 {{ form.unit || 'unidad' }}</strong> y NEXA lo suma.</p>

            <div v-for="(component, index) in form.costComponents" :key="index" class="cost-row">
              <Select
                v-model="component.tipo"
                :options="costComponentTypes"
                optionLabel="label"
                optionValue="value"
                class="cost-row__type"
              />
              <InputText v-model="component.nombre" placeholder="Ej. Harina, queso…" class="cost-row__name" />
              <InputNumber
                v-model="component.monto"
                prefix="Bs "
                :min="0"
                :minFractionDigits="2"
                :maxFractionDigits="2"
                class="cost-row__amount"
              />
              <Button type="button" class="cost-row__remove" icon="pi pi-times" text rounded severity="secondary" aria-label="Quitar" @click="removeCostComponent(index)" />
            </div>

            <Button
              type="button"
              icon="pi pi-plus"
              :label="form.costComponents.length ? 'Agregar otro costo' : 'Agregar un costo'"
              outlined
              @click="addCostComponent()"
            />

            <div v-if="form.costComponents.length" class="cost-breakdown__total">
              <span>Costo total por unidad</span>
              <strong>Bs {{ money(costComponentsTotal) }}</strong>
            </div>
          </div>

          <!-- Costo / margen por unidad -->
          <p class="step-heading"><i class="pi pi-tag" aria-hidden="true" /> Costo y precio de venta</p>
          <div class="pgrid">
            <div class="pfield">
              <label for="product-cost">Costo por unidad</label>
              <InputNumber
                id="product-cost"
                v-model="form.cost"
                prefix="Bs "
                :min="0"
                :minFractionDigits="2"
                :maxFractionDigits="2"
                :disabled="usesCostBreakdown"
                fluid
              />
              <small v-if="usesCostBreakdown" class="field-help">Se calcula del desglose de arriba.</small>
            </div>
            <div class="pfield">
              <label for="product-margin">Margen deseado por unidad</label>
              <InputNumber
                id="product-margin"
                v-model="form.minMargin"
                suffix=" %"
                :min="0"
                :max="95"
                :placeholder="`Sugerido: ${typeDefaultMargin}%`"
                fluid
              />
              <small class="field-help">Cuánto quieres ganar sobre el costo. El resultado del mes lo ves en Finanzas.</small>
            </div>
          </div>

          <div class="price-helper">
            <div class="price-helper__main">
              <span class="price-helper__icon"><i class="pi pi-sparkles" aria-hidden="true" /></span>
              <div class="price-helper__text">
                <small>Te sugerimos vender a</small>
                <strong>Bs {{ money(suggestedPrice) }}</strong>
                <em>Para ganar Bs {{ money(suggestedProfit) }} en cada venta</em>
              </div>
            </div>
            <Button
              type="button"
              size="small"
              icon="pi pi-check"
              label="Usar este precio"
              :disabled="form.cost <= 0 || suggestedPrice <= 0"
              @click="applySuggestedPrice"
            />
          </div>

          <!-- Ganancia en vivo -->
          <div class="profit-box" :class="{ 'is-negative': liveProfit.profit < 0, 'is-positive': liveProfit.profit > 0 }">
            <span class="profit-box__label">
              <i :class="liveProfit.profit < 0 ? 'pi pi-exclamation-triangle' : 'pi pi-wallet'" aria-hidden="true" />
              {{ liveProfit.profit < 0 ? 'Estás perdiendo en cada venta' : 'Ganas con este precio' }}
            </span>
            <strong>Bs {{ money(liveProfit.profit) }} <span class="profit-box__margin">({{ liveProfit.margin.toFixed(0) }}%)</span></strong>
          </div>

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
              <InputNumber id="product-stock" v-model="form.stock" :min="0" :maxFractionDigits="2" :disabled="Boolean(form.id) || form.kind === 'servicio'" fluid />
              <small v-if="form.kind === 'servicio'" class="field-help">Los servicios no manejan stock.</small>
              <small v-else-if="form.id" class="field-help">Usa Ajustar stock para registrar movimientos.</small>
            </div>
          </div>

          <!-- Sección: Códigos e imagen -->
          <button type="button" class="section-toggle" :class="{ 'is-open': sections.codes }" @click="toggleSection('codes')">
            <span><i class="pi pi-chevron-right" aria-hidden="true" /> Códigos e imagen</span>
            <small>Código de barras, unidad, foto</small>
          </button>
          <div v-show="sections.codes" class="section-body">
            <div class="pgrid">
              <div class="pfield">
                <label for="product-barcode">Código de barras</label>
                <InputText id="product-barcode" v-model="form.barcode" autocomplete="off" placeholder="Escanea o escribe el código" />
              </div>
              <div class="pfield">
                <label for="product-unit">Unidad de venta</label>
                <Select id="product-unit" v-model="form.unit" :options="unitSelectOptions" optionLabel="label" optionValue="value" fluid />
              </div>
            </div>
            <div class="pfield">
              <label>Foto del producto</label>
              <div class="image-row">
                <span class="image-preview">
                  <img v-if="form.imageUrl" :src="form.imageUrl" alt="Vista previa" />
                  <span v-else-if="form.icon">{{ form.icon }}</span>
                  <i v-else class="pi pi-image" aria-hidden="true" />
                </span>
                <div class="image-picker">
                  <input ref="imageInput" type="file" accept="image/*" capture="environment" hidden @change="onImagePick" />
                  <div class="image-actions">
                    <Button
                      type="button"
                      size="small"
                      icon="pi pi-camera"
                      :label="form.imageUrl ? 'Cambiar foto' : 'Subir foto'"
                      :loading="imageProcessing"
                      @click="pickImage"
                    />
                    <Button
                      v-if="form.imageUrl"
                      type="button"
                      size="small"
                      icon="pi pi-trash"
                      label="Quitar"
                      outlined
                      severity="secondary"
                      @click="clearImage"
                    />
                  </div>
                  <small class="field-help">Toma o elige una foto. Si no, usa un emoji:</small>
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
                    <span
                      v-if="form.icon && !emojiOptions.includes(form.icon)"
                      class="emoji-btn is-active is-custom"
                    >
                      {{ form.icon }}
                    </span>
                  </div>
                  <div class="emoji-custom">
                    <input
                      v-model="customEmojiModel"
                      type="text"
                      class="emoji-custom__input"
                      inputmode="text"
                      maxlength="8"
                      placeholder="Otro emoji 😀"
                      aria-label="Escribe o pega otro emoji"
                    >
                    <small class="field-help">Abre el teclado de emojis del sistema (Win + . / ⌘ + Ctrl + Espacio) y elige el que quieras.</small>
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
                <InputNumber id="product-min-stock" v-model="form.minStock" :min="0" :maxFractionDigits="2" :disabled="form.kind === 'servicio'" fluid />
              </div>
              <div class="pfield">
                <label for="product-max-stock">Stock máximo</label>
                <InputNumber id="product-max-stock" v-model="form.maxStock" :min="0" :maxFractionDigits="2" :disabled="form.kind === 'servicio'" placeholder="Opcional" fluid />
              </div>
            </div>
            <div class="pfield">
              <label for="product-description">Descripción</label>
              <Textarea id="product-description" v-model="form.description" rows="2" autoResize />
            </div>
            <div class="check-row">
              <label>
                <Checkbox v-model="form.visiblePos" binary />
                <span>
                  Mostrar en la pantalla de venta
                  <small>Si lo apagas, no aparece para cobrar.</small>
                </span>
              </label>
            </div>
          </div>

          <!-- Sección: Variantes -->
          <button
            type="button"
            class="section-toggle"
            :class="{ 'is-open': sections.variants, 'is-disabled': form.kind === 'servicio' }"
            :disabled="form.kind === 'servicio'"
            @click="toggleSection('variants')"
          >
            <span><i class="pi pi-chevron-right" aria-hidden="true" /> Variantes</span>
            <small>{{ form.kind === 'servicio' ? 'No aplica a servicios' : form.variants.length ? `${form.variants.length} variante(s)` : 'Sin variantes' }}</small>
          </button>
          <div v-show="sections.variants" class="section-body">
            <div v-for="(variant, index) in form.variants" :key="index" class="variant-row">
              <InputText v-model="variant.name" placeholder="Nombre (ej. Talla M)" class="variant-name" />
              <InputNumber v-model="variant.cost" mode="decimal" :min="0" :minFractionDigits="2" :maxFractionDigits="2" placeholder="Costo" class="variant-cost" />
              <InputNumber v-model="variant.price" mode="decimal" :min="0" :minFractionDigits="2" :maxFractionDigits="2" placeholder="Precio" class="variant-price" />
              <InputNumber v-model="variant.stock" :min="0" :maxFractionDigits="2" placeholder="Stock" class="variant-stock" />
              <Button type="button" icon="pi pi-times" text rounded severity="danger" aria-label="Quitar variante" @click="removeVariant(index)" />
            </div>
            <Button type="button" icon="pi pi-plus" label="Agregar variante" text size="small" @click="addVariant" />
          </div>
        </div>

        <footer class="pform-footer">
          <Button type="button" outlined label="Cancelar" severity="secondary" @click="productDialogOpen = false" />
          <Button type="submit" :label="form.id ? 'Guardar cambios' : 'Crear producto'" :loading="saving" />
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
          <Button type="submit" label="Confirmar ajuste" :loading="saving" />
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
          <div class="icon-picker">
            <span class="icon-picker__preview" aria-hidden="true">
              <i v-if="categoryForm.icon" :class="categoryForm.icon" />
              <i v-else class="pi pi-image is-empty" />
            </span>
            <Select
              id="category-icon"
              v-model="categoryForm.icon"
              :options="primeIconOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Elegí un icono"
              showClear
              filter
              :filterFields="['label', 'value']"
              class="icon-picker__select"
            >
              <template #value="{ value, placeholder }">
                <span v-if="value" class="icon-option">
                  <i :class="value" aria-hidden="true" />
                  <span>{{ primeIconOptions.find((opt) => opt.value === value)?.label ?? value }}</span>
                </span>
                <span v-else class="icon-option icon-option--placeholder">{{ placeholder }}</span>
              </template>
              <template #option="{ option }">
                <span class="icon-option">
                  <i :class="option.value" aria-hidden="true" />
                  <span>{{ option.label }}</span>
                </span>
              </template>
            </Select>
          </div>
        </div>
        <footer class="dialog-actions">
          <Button type="button" label="Cancelar" severity="secondary" outlined @click="categoryDialogOpen = false; categoryDialogFromProduct = false" />
          <Button type="submit" label="Guardar categoría" :loading="saving" />
        </footer>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="historyDialogOpen"
      modal
      :header="historyProduct ? `Historial de stock · ${historyProduct.name}` : 'Historial de stock'"
      :style="{ width: 'min(760px, calc(100vw - 32px))' }"
    >
      <DataTable :value="historyRows" :loading="historyLoading" size="small" class="history-table">
        <template #empty>No hay movimientos registrados para este producto.</template>
        <Column header="Fecha" style="min-width: 9.5rem">
          <template #body="{ data }">
            <span class="cell-muted">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
        <Column header="Tipo" style="min-width: 7rem">
          <template #body="{ data }">
            <Tag :value="movementLabel(data.type)" :severity="movementSeverity(data.type)" rounded />
          </template>
        </Column>
        <Column field="origin" header="Origen" style="min-width: 7rem" />
        <Column header="Cantidad" style="min-width: 7rem">
          <template #body="{ data }">
            <strong>{{ data.quantity }}</strong>
          </template>
        </Column>
        <Column header="Stock" style="min-width: 8rem">
          <template #body="{ data }">
            <span>{{ data.previousStock }} → {{ data.newStock }}</span>
          </template>
        </Column>
        <Column header="Detalle" style="min-width: 12rem">
          <template #body="{ data }">
            <span class="cell-muted">{{ data.variantName || data.notes || 'Sin detalle' }}</span>
          </template>
        </Column>
      </DataTable>
    </Dialog>
  </section>
</template>

<style scoped>
.catalog-workspace {
  --catalog-accent: #0b982f;
  --catalog-accent-strong: #066322;
  --catalog-accent-soft: #e4f4ea;
  display: grid;
  gap: 12px;
  padding: 8px 0 0;
}

.catalog-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: end;
}

.catalog-heading {
  display: grid;
  gap: 4px;
}

.catalog-eyebrow {
  color: #6b778a;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.catalog-heading h2 {
  margin: 0;
  color: #071327;
  font-size: clamp(1.4rem, 2.2vw, 2rem);
  font-weight: 950;
  line-height: 1.05;
}

.catalog-heading p {
  margin: 0;
  max-width: 62ch;
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 650;
  line-height: 1.45;
}

.catalog-primary-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.new-product-button {
  min-height: 42px;
  font-weight: 900 !important;
}

.catalog-toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 460px) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.catalog-search :deep(.p-inputtext) {
  width: 100%;
  min-height: 44px;
  border-radius: 12px;
  font-weight: 650;
}

.catalog-chips,
.category-strip__list {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.chip,
.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  border: 1px solid #dfe7e2;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.chip {
  padding: 8px 13px;
}

.category-pill {
  padding: 7px 12px;
}

.chip:hover,
.category-pill:hover {
  border-color: #b9d9c2;
  background: #f5fbf6;
}

.chip.is-active,
.category-pill.is-active {
  border-color: var(--catalog-accent);
  background: var(--catalog-accent);
  color: #ffffff;
}

.chip__count,
.category-pill small {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #eef2f6;
  color: #475569;
  font-size: 0.7rem;
  font-weight: 900;
}

.chip.is-active .chip__count,
.category-pill.is-active small {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.catalog-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.catalog-summary article {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}

.catalog-summary span {
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 850;
}

.catalog-summary strong {
  color: #0f172a;
  font-size: 1.05rem;
  font-weight: 950;
}

.catalog-summary .is-danger {
  color: #b45309;
}

.category-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.product-list-panel {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.product-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid #eef2f6;
}

.product-list-head strong {
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 900;
}

.product-list-head span {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 650;
}

.catalog-table {
  font-size: 0.88rem;
}

.cell-label {
  display: none;
}

.catalog-table :deep(.p-datatable-thead > tr > th) {
  color: #64748b;
  background: #f8fafc;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.catalog-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.catalog-table :deep(.p-datatable-tbody > tr:hover) {
  background: #f8fcf9;
}

.product-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 11px;
}

.product-thumb {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  color: #64748b;
  background: #f1f5f9;
  font-size: 1rem;
}

.product-cell__text {
  min-width: 0;
}

.product-cell__text strong {
  display: block;
  overflow: hidden;
  color: #0f172a;
  font-size: 0.92rem;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-cell__text small {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-muted {
  color: #64748b;
  font-weight: 650;
}

.cell-price {
  color: #0f172a;
  font-weight: 950;
}

.margin-pill,
.stock-pill,
.signal-badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 900;
}

.margin-pill {
  color: #166534;
  background: #dcfce7;
}

.stock-pill {
  color: #0f172a;
  background: #eef2f6;
}

.stock-pill.is-low {
  color: #92400e;
  background: #fef3c7;
}

.signal-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.signal-badge.is-sale {
  color: #166534;
  background: #dcfce7;
}

.signal-badge.is-low {
  color: #92400e;
  background: #fef3c7;
}

.stock-low {
  color: #b45309;
  font-weight: 900;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.empty-products {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 34px 16px;
  color: #64748b;
  text-align: center;
}

.empty-products i {
  color: #94a3b8;
  font-size: 2rem;
}

.empty-products strong {
  color: #0f172a;
  font-size: 1rem;
}

.empty-products span {
  margin-bottom: 6px;
  font-size: 0.86rem;
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
.category-form {
  display: grid;
  gap: 14px;
  min-width: min(420px, calc(100vw - 44px));
}

.field {
  display: grid;
  gap: 6px;
}

.icon-picker {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-picker__preview {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 1.25rem;
}

.icon-picker__preview .is-empty {
  color: #94a3b8;
}

.icon-picker__select {
  flex: 1 1 auto;
  min-width: 0;
}

.icon-option {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.icon-option i {
  font-size: 1.05rem;
  color: #334155;
}

.icon-option--placeholder {
  color: #94a3b8;
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

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

/* --- Thumbnails (imagen / emoji) --- */
.product-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-thumb {
  overflow: hidden;
}

.thumb-emoji {
  line-height: 1;
}

.product-thumb .thumb-emoji {
  font-size: 1.1rem;
}

/* --- Diálogo de producto (registro amigable) --- */
.product-dialog :deep(.p-dialog-content) {
  padding: 0;
}

.product-dialog :deep(.p-dialog-header) {
  padding: 18px 22px;
}

.pform {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pform-body {
  display: grid;
  gap: 16px;
  max-height: min(72vh, 660px);
  overflow-y: auto;
  padding: 18px 22px;
}

.pform-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid #eef2f6;
}

/* Campos */
.pfield {
  display: grid;
  gap: 6px;
}

.product-main-grid {
  display: grid;
  grid-template-columns: minmax(180px, 0.45fr) minmax(0, 1fr);
  gap: 14px;
}

.pgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(240px, 1fr));
  gap: 14px;
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

/* Campo de costo calculado automáticamente: se ve "tranquilo", no roto. */
.pfield :deep(.p-inputnumber-input:disabled),
.pfield :deep(.p-inputtext:disabled) {
  background: #f8fafc;
  border-style: dashed;
  color: #475569;
  opacity: 1;
  -webkit-text-fill-color: #475569;
}

.category-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: 8px;
  align-items: center;
}

.category-picker :deep(.p-select) {
  min-width: 0;
  min-height: 44px;
}

.category-picker :deep(.p-select-label) {
  display: flex;
  align-items: center;
}

.category-picker :deep(.p-button) {
  height: 100%;
  min-height: 44px;
  white-space: nowrap;
}

.price-helper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid #d4ede0;
  border-radius: 14px;
  background: linear-gradient(135deg, #f3fbf6 0%, #ffffff 70%);
}

.price-helper__main {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.price-helper__text {
  min-width: 0;
}

/* El botón no debe encogerse ni truncarse. */
.price-helper :deep(.p-button) {
  flex: 0 0 auto;
  white-space: nowrap;
  border-radius: 10px;
}

.price-helper__icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  background: #dcfce7;
  color: #16a34a;
  font-size: 1.1rem;
}

.price-helper small,
.price-helper strong,
.price-helper em {
  display: block;
}

.price-helper small {
  color: #15803d;
  font-size: 0.74rem;
  font-weight: 700;
}

.price-helper strong {
  margin-top: 1px;
  color: #0f172a;
  font-size: 1.32rem;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.price-helper em {
  margin-top: 2px;
  color: #64748b;
  font-size: 0.74rem;
  font-style: normal;
  font-weight: 600;
}

/* Ganancia en vivo */
.profit-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 12px;
  background: #f1f5f9;
  font-size: 0.82rem;
}

.profit-box.is-positive {
  background: #f0fdf4;
}

.profit-box.is-negative {
  background: #fef2f2;
}

.profit-box__label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #64748b;
  font-weight: 600;
}

.profit-box__label i {
  font-size: 0.85rem;
}

.profit-box.is-positive .profit-box__label {
  color: #15803d;
}

.profit-box.is-negative .profit-box__label {
  color: #dc2626;
}

.profit-box strong {
  color: #0f172a;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.profit-box__margin {
  font-weight: 600;
  color: #94a3b8;
}

.profit-box.is-positive strong {
  color: #15803d;
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

.section-toggle:disabled,
.section-toggle.is-disabled {
  cursor: not-allowed;
  opacity: 0.62;
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

/* Encabezado de paso dentro del formulario */
.step-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 -4px;
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
}

.step-heading i {
  color: #16a34a;
  font-size: 0.95rem;
}

.step-heading__opt {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 999px;
}

/* Bloque "Costo por partes": simple, siempre visible */
.cost-section {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e8edf3;
  border-radius: 14px;
  background: #f8fafc;
}

.cost-hint {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
}

/* Panel "Calcular costo por partes": bloque contenido y prominente */
.cost-panel {
  margin: 4px 0;
  border: 1px solid #d7e3ee;
  border-radius: 16px;
  background: #f8fafc;
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.cost-panel.is-open {
  border-color: #bbf7d0;
  background: #ffffff;
  box-shadow: 0 6px 20px -12px rgba(22, 163, 74, 0.45);
}

.cost-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 16px 18px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.cost-panel__title {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 1.02rem;
  font-weight: 800;
}

.cost-panel__title small {
  display: block;
  margin-top: 3px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #94a3b8;
}

.cost-panel__badge {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 11px;
  background: #f0fdf4;
  color: #16a34a;
  font-size: 1.05rem;
}

.cost-panel__chevron {
  flex: 0 0 auto;
  color: #94a3b8;
  font-size: 0.9rem;
  transition: transform 0.18s ease;
}

.cost-panel.is-open .cost-panel__chevron {
  transform: rotate(180deg);
}

.cost-panel__body {
  display: grid;
  gap: 14px;
  padding: 2px 18px 18px;
  border-top: 1px solid #f1f5f9;
}

/* Desglose de costo */
.cost-breakdown__intro {
  margin: 0;
  font-size: 0.85rem;
  color: #5c6b60;
}

/* Estado vacío del desglose: guía amable en vez de un botón solitario */
.cost-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 20px 16px;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  background: #fafbfc;
  text-align: center;
}

.cost-empty__icon {
  font-size: 1.7rem;
  line-height: 1;
}

.cost-empty__title {
  margin: 2px 0 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.cost-empty__hint {
  margin: 0;
  font-size: 0.8rem;
  color: #94a3b8;
}

.cost-empty__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 4px 0 8px;
}

.cost-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #ffffff;
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.cost-chip:hover {
  border-color: #86efac;
  background: #f0fdf4;
  color: #15803d;
}

/* Fila de costo: layout que SIEMPRE cabe, sin importar el ancho del modal.
   Nombre arriba a todo el ancho; abajo tipo · monto · quitar. */
.cost-row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto;
  grid-template-areas:
    "name name name"
    "type amount remove";
  gap: 8px;
  align-items: center;
  padding: 10px;
  border: 1px solid #e8edf3;
  border-radius: 12px;
  background: #ffffff;
}

.cost-row__name { grid-area: name; }
.cost-row__type { grid-area: type; }
.cost-row__amount { grid-area: amount; }
.cost-row__remove { grid-area: remove; justify-self: end; }

/* Los inputs deben poder encogerse dentro de su celda (sin desbordar). */
.cost-row :deep(.p-inputtext),
.cost-row :deep(.p-inputnumber),
.cost-row :deep(.p-select),
.cost-row :deep(.p-inputnumber-input) {
  width: 100%;
  min-width: 0;
}

.cost-breakdown__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f1f8f3;
  border: 1px dashed #bfe0cb;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;
  color: #06351c;
}

.cost-breakdown__total strong {
  font-size: 1.1rem;
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

.image-actions {
  display: flex;
  flex-wrap: wrap;
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
  border-color: var(--catalog-accent);
  background: var(--catalog-accent-soft);
}

.emoji-btn.is-custom {
  display: inline-grid;
  place-items: center;
}

.emoji-custom {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.emoji-custom__input {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  font-size: 1.1rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.emoji-custom__input:focus {
  border-color: var(--catalog-accent);
  box-shadow: 0 0 0 3px var(--catalog-accent-soft);
}

/* Checks */
.check-row {
  display: grid;
  gap: 12px;
}

.check-row label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.86rem;
  font-weight: 700;
  color: #1e293b;
  cursor: pointer;
}

.check-row label span {
  display: grid;
  gap: 2px;
}

.check-row label small {
  font-size: 0.72rem;
  font-weight: 600;
  color: #94a3b8;
}

/* Variantes */
.variant-row {
  display: grid;
  grid-template-columns: minmax(150px, 1.6fr) 100px 100px 90px auto;
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
  border-color: var(--catalog-accent);
  background: var(--catalog-accent-strong);
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
  .product-main-grid {
    grid-template-columns: 1fr;
  }

  .category-picker {
    grid-template-columns: 1fr;
  }

  .variant-row {
    grid-template-columns: 1fr;
  }

  .variant-row :deep(.p-button) {
    justify-self: end;
  }
}

@media (max-width: 1100px) {
  .catalog-toolbar {
    grid-template-columns: 1fr;
  }

  .catalog-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .category-strip {
    grid-template-columns: 1fr;
  }

  .category-strip :deep(.p-button) {
    justify-self: start;
  }
}

@media (max-width: 720px) {
  .product-dialog :deep(.p-dialog-header) {
    padding: 16px;
  }

  .pform-body {
    max-height: min(74vh, 620px);
    padding: 14px 16px 16px;
  }

  .pform-footer {
    padding: 12px 16px;
  }

  .catalog-header {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .catalog-primary-actions {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .new-product-button {
    flex: 1 1 180px;
  }

  .catalog-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .product-list-head {
    display: grid;
  }

  /* La tabla se convierte en tarjetas apiladas (como el carrito en venta) */
  .cell-label {
    display: inline-flex;
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .catalog-table :deep(.p-datatable-thead) {
    display: none;
  }

  .catalog-table :deep(.p-datatable-table),
  .catalog-table :deep(.p-datatable-tbody),
  .catalog-table :deep(.p-datatable-tbody > tr) {
    display: block;
    width: 100%;
  }

  .catalog-table :deep(.p-datatable-tbody > tr) {
    margin: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
    overflow: hidden;
  }

  .catalog-table :deep(.p-datatable-tbody > tr > td) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0 !important;
    width: 100%;
    border: none;
    padding: 10px 14px;
    text-align: right;
  }

  /* Celda Producto: encabezado de la tarjeta, ocupa toda la fila */
  .catalog-table :deep(.p-datatable-tbody > tr > td:first-child) {
    justify-content: flex-start;
    text-align: left;
    background: #f8fafc;
    border-bottom: 1px solid #eef2f6;
  }

  /* Celda Acciones: botones a lo ancho */
  .catalog-table :deep(.p-datatable-tbody > tr > td:last-child) {
    border-top: 1px solid #eef2f6;
  }

  .row-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .pgrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .pform-footer {
    display: grid;
    grid-template-columns: 1fr;
  }

  .pform-footer :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .row-actions :deep(.p-button-label) {
    display: none;
  }

  .row-actions :deep(.p-button) {
    width: 2.25rem;
    padding-inline: 0;
  }

  /* En móvil la tarjeta de precio recomendado se apila: el botón "Aplicar"
     pasa abajo a todo el ancho para no comprimirse contra el texto. */
  .price-helper {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .price-helper :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }
}
</style>
