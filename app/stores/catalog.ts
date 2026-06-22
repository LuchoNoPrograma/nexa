import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usePosOfflineProducts } from '~/composables/pos/offline/usePosOfflineProducts'
import { useSessionStore } from '~/stores/session'

export type PosSaleProduct = {
  id: string
  name: string
  category: string
  price: number
  stock: number
  kind: 'producto' | 'servicio' | 'combo'
}

export type CatalogCategory = {
  id: string
  name: string
  description: string | null
  icon: string | null
  active: boolean
  productCount: number
}

export type ProductVariant = {
  id?: string
  name: string
  sku: string | null
  barcode: string | null
  cost: number | null
  price: number | null
  stock: number
}

export type CostComponent = {
  tipo: 'materia_prima' | 'mano_obra' | 'insumo' | 'otro'
  nombre: string
  monto: number
}

export type CatalogProduct = {
  id: string
  categoryId: string | null
  categoryName: string | null
  sku: string | null
  barcode: string | null
  name: string
  description: string | null
  kind: 'producto' | 'servicio' | 'combo'
  costingType: 'reventa' | 'produccion' | 'servicio'
  unit: string
  cost: number
  price: number
  stock: number
  minStock: number
  maxStock: number | null
  minMargin: number | null
  imageUrl: string | null
  icon: string | null
  visiblePos: boolean
  variants: ProductVariant[]
  costComponents: CostComponent[]
}

const CACHE_MS = 45_000

export const useCatalogStore = defineStore('catalog', () => {
  const sessionStore = useSessionStore()
  const offlineProducts = usePosOfflineProducts()

  const saleProducts = ref<PosSaleProduct[]>([])
  const catalogProducts = ref<CatalogProduct[]>([])
  const categories = ref<CatalogCategory[]>([])
  const saleProductsLoading = ref(false)
  const catalogLoading = ref(false)
  const saleProductsError = ref('')
  const catalogError = ref('')
  const offlineNotice = ref('')
  const saleProductsLoadedAt = ref(0)
  const catalogLoadedAt = ref(0)

  let saleProductsRequest: Promise<PosSaleProduct[]> | null = null
  let catalogRequest: Promise<void> | null = null
  let version = 0

  const hasSaleProducts = computed(() => saleProducts.value.length > 0)
  const hasCatalog = computed(() => catalogProducts.value.length > 0 || categories.value.length > 0)

  function isFresh(timestamp: number) {
    return timestamp > 0 && Date.now() - timestamp < CACHE_MS
  }

  async function loadSaleProducts(options: { force?: boolean, background?: boolean } = {}) {
    if (!options.force && isFresh(saleProductsLoadedAt.value)) {
      return saleProducts.value
    }

    if (saleProductsRequest) {
      return saleProductsRequest
    }

    if (!options.background || !saleProducts.value.length) {
      saleProductsLoading.value = true
    }
    saleProductsError.value = ''
    offlineNotice.value = ''

    const requestVersion = version
    saleProductsRequest = $fetch<{ products: PosSaleProduct[] }>('/api/pos/products')
      .then((response) => {
        if (requestVersion !== version) {
          return saleProducts.value
        }

        saleProducts.value = response.products
        saleProductsLoadedAt.value = Date.now()
        void saveSaleProductsLocally().catch(() => null)
        return saleProducts.value
      })
      .catch(async (error) => {
        if (requestVersion !== version) {
          return saleProducts.value
        }

        const storeId = sessionStore.session?.storeId
        const localProducts = storeId ? await offlineProducts.list(storeId).catch(() => []) : []

        if (localProducts.length) {
          saleProducts.value = localProducts
          saleProductsLoadedAt.value = Date.now()
          offlineNotice.value = 'Catálogo cargado desde este dispositivo. Los cambios se actualizarán al volver internet.'
          return saleProducts.value
        }

        saleProductsError.value = 'No se pudo cargar el catálogo. Abre el POS con internet al menos una vez para vender offline.'
        offlineNotice.value = saleProductsError.value
        throw error
      })
      .finally(() => {
        if (requestVersion !== version) {
          return
        }

        saleProductsLoading.value = false
        saleProductsRequest = null
      })

    return saleProductsRequest
  }

  function refreshSaleProductsInBackground() {
    if (!hasSaleProducts.value || isFresh(saleProductsLoadedAt.value)) {
      return
    }

    void loadSaleProducts({ force: true, background: true }).catch(() => null)
  }

  async function loadCatalog(options: { force?: boolean, background?: boolean } = {}) {
    if (!options.force && isFresh(catalogLoadedAt.value)) {
      return
    }

    if (catalogRequest) {
      return catalogRequest
    }

    if (!options.background || !hasCatalog.value) {
      catalogLoading.value = true
    }
    catalogError.value = ''

    const requestVersion = version
    catalogRequest = Promise.all([
      $fetch<{ products: CatalogProduct[] }>('/api/pos/catalog/products'),
      $fetch<{ categories: CatalogCategory[] }>('/api/pos/catalog/categories'),
    ])
      .then(([productResponse, categoryResponse]) => {
        if (requestVersion !== version) {
          return
        }

        catalogProducts.value = productResponse.products
        categories.value = categoryResponse.categories
        catalogLoadedAt.value = Date.now()
      })
      .catch((error) => {
        if (requestVersion !== version) {
          return
        }

        catalogError.value = 'No se pudo cargar el catálogo de la tienda.'
        throw error
      })
      .finally(() => {
        if (requestVersion !== version) {
          return
        }

        catalogLoading.value = false
        catalogRequest = null
      })

    return catalogRequest
  }

  function refreshCatalogInBackground() {
    if (!hasCatalog.value || isFresh(catalogLoadedAt.value)) {
      return
    }

    void loadCatalog({ force: true, background: true }).catch(() => null)
  }

  async function saveSaleProductsLocally() {
    const storeId = sessionStore.session?.storeId
    if (!storeId) {
      return
    }

    await offlineProducts.save(storeId, saleProducts.value)
  }

  function applyLocalStock(items: Array<{ id: string, quantity: number, kind: PosSaleProduct['kind'] }>) {
    for (const item of items) {
      if (item.kind === 'servicio') {
        continue
      }

      const saleProduct = saleProducts.value.find((current) => current.id === item.id)
      if (saleProduct) {
        saleProduct.stock = Math.max(saleProduct.stock - item.quantity, 0)
      }

      const catalogProduct = catalogProducts.value.find((current) => current.id === item.id)
      if (catalogProduct) {
        catalogProduct.stock = Math.max(catalogProduct.stock - item.quantity, 0)
      }
    }
  }

  function invalidateCatalog() {
    catalogLoadedAt.value = 0
    saleProductsLoadedAt.value = 0
  }

  function clear() {
    version += 1
    saleProducts.value = []
    catalogProducts.value = []
    categories.value = []
    saleProductsLoading.value = false
    catalogLoading.value = false
    saleProductsError.value = ''
    catalogError.value = ''
    offlineNotice.value = ''
    saleProductsLoadedAt.value = 0
    catalogLoadedAt.value = 0
    saleProductsRequest = null
    catalogRequest = null
  }

  return {
    saleProducts,
    catalogProducts,
    categories,
    saleProductsLoading,
    catalogLoading,
    saleProductsError,
    catalogError,
    offlineNotice,
    saleProductsLoadedAt,
    catalogLoadedAt,
    hasSaleProducts,
    hasCatalog,
    loadSaleProducts,
    refreshSaleProductsInBackground,
    loadCatalog,
    refreshCatalogInBackground,
    saveSaleProductsLocally,
    applyLocalStock,
    invalidateCatalog,
    clear,
  }
})
