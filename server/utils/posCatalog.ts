import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { PoolClient } from 'pg'
import { tieneAcceso } from '~~/shared/utils/acceso'
import { pool } from './db'
import { requireSession } from './session'

export type StoreSession = Awaited<ReturnType<typeof requireSession>> & {
  storeId: string
}

const productKinds = ['producto', 'servicio', 'combo'] as const
const productCostingTypes = ['reventa', 'produccion', 'servicio'] as const

export async function requireStoreSession(event: H3Event): Promise<StoreSession> {
  const session = await requireSession(event)

  if (!session.storeId) {
    throw createError({ statusCode: 403, statusMessage: 'No hay una tienda activa para operar.' })
  }

  return session as StoreSession
}

export async function requireStoreAccess(event: H3Event, access: string): Promise<StoreSession> {
  const session = await requireStoreSession(event)

  if (!tieneAcceso(access, session)) {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado para esta operacion.' })
  }

  return session
}

export function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

export function nullableText(value: unknown) {
  const text = cleanText(value)
  return text || null
}

export function numberOrZero(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0
}

export function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null
}

export type VariantInput = {
  name: string
  sku: string | null
  barcode: string | null
  cost: number | null
  price: number | null
  stock: number
}

export function parseVariants(value: unknown): VariantInput[] {
  if (!Array.isArray(value)) {
    return []
  }

  const variants: VariantInput[] = []

  for (const raw of value) {
    if (typeof raw !== 'object' || !raw) {
      continue
    }

    const entry = raw as Record<string, unknown>
    const name = cleanText(entry.name)

    if (!name) {
      continue
    }

    variants.push({
      name,
      sku: nullableText(entry.sku),
      barcode: nullableText(entry.barcode),
      cost: nullableNumber(entry.cost),
      price: nullableNumber(entry.price),
      stock: numberOrZero(entry.stock),
    })
  }

  return variants
}

export async function replaceProductVariants(client: PoolClient, productId: string, variants: VariantInput[]) {
  await client.query('delete from producto_variante where producto_id = $1', [productId])

  for (const [index, variant] of variants.entries()) {
    await client.query(
      `
        insert into producto_variante (
          producto_id, nombre, sku, codigo_barras, costo_unitario, precio_venta, stock_actual, orden
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [productId, variant.name, variant.sku, variant.barcode, variant.cost, variant.price, variant.stock, index],
    )
  }
}

const costComponentTypes = ['materia_prima', 'mano_obra', 'insumo', 'otro'] as const

export type CostComponentInput = {
  tipo: typeof costComponentTypes[number]
  nombre: string
  monto: number
}

// Desglose opcional del costo directo del producto. Tolerante: ignora renglones
// sin nombre. Si la lista llega vacía, el producto guarda su costo como un solo
// número (sin componentes).
export function parseCostComponents(value: unknown): CostComponentInput[] {
  if (!Array.isArray(value)) {
    return []
  }

  const components: CostComponentInput[] = []

  for (const raw of value) {
    if (typeof raw !== 'object' || !raw) {
      continue
    }

    const entry = raw as Record<string, unknown>
    const nombre = cleanText(entry.nombre ?? entry.name)

    if (!nombre) {
      continue
    }

    const tipo = costComponentTypes.includes(entry.tipo as typeof costComponentTypes[number])
      ? (entry.tipo as typeof costComponentTypes[number])
      : 'otro'

    components.push({ tipo, nombre, monto: numberOrZero(entry.monto) })
  }

  return components
}

export async function replaceProductCostComponents(client: PoolClient, productId: string, components: CostComponentInput[]) {
  await client.query('delete from producto_costo_componente where producto_id = $1', [productId])

  for (const [index, component] of components.entries()) {
    await client.query(
      `
        insert into producto_costo_componente (producto_id, tipo, nombre, monto, orden)
        values ($1, $2, $3, $4, $5)
      `,
      [productId, component.tipo, component.nombre, component.monto, index],
    )
  }
}

export function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function productKind(value: unknown): typeof productKinds[number] {
  return productKinds.includes(value as typeof productKinds[number]) ? value as typeof productKinds[number] : 'producto'
}

export function productCostingType(value: unknown, kind: ReturnType<typeof productKind> = 'producto'): typeof productCostingTypes[number] {
  if (productCostingTypes.includes(value as typeof productCostingTypes[number])) {
    return value as typeof productCostingTypes[number]
  }

  if (kind === 'servicio') {
    return 'servicio'
  }

  if (kind === 'combo') {
    return 'produccion'
  }

  return 'reventa'
}

export async function assertCategoryBelongsToStore(categoryId: unknown, storeId: string) {
  const cleanCategoryId = nullableText(categoryId)

  if (!cleanCategoryId) {
    return null
  }

  const categoryResult = await pool.query(
    'select 1 from categoria where id = $1 and tienda_id = $2 and activo = true limit 1',
    [cleanCategoryId, storeId],
  )

  if (!categoryResult.rowCount) {
    throw createError({ statusCode: 400, statusMessage: 'La categoria no pertenece a la tienda activa.' })
  }

  return cleanCategoryId
}

export function ensureProductName(value: unknown) {
  const name = cleanText(value)

  if (name.length < 2 || name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'El producto requiere un nombre entre 2 y 120 caracteres.' })
  }

  return name
}

export function ensureCategoryName(value: unknown) {
  const name = cleanText(value)

  if (name.length < 2 || name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'La categoria requiere un nombre entre 2 y 80 caracteres.' })
  }

  return name
}

export function mapUniqueConstraint(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
    throw createError({ statusCode: 409, statusMessage: 'Ya existe un registro con ese codigo en esta tienda.' })
  }

  throw error
}
