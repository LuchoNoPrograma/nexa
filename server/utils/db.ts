import process from 'node:process'
import pg from 'pg'
import { hashPassword } from './password'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/impulsa'
const isProduction = process.env.NODE_ENV === 'production'
const hasAdminCredentials = Boolean(process.env.IMPULSA_SUPER_ADMIN_EMAIL && process.env.IMPULSA_SUPER_ADMIN_PASSWORD)
const seedDemo = isProduction ? hasAdminCredentials : true
const seedDemoProducts = process.env.IMPULSA_SEED_DEMO_PRODUCTS === 'true'
const poolMax = Number(process.env.DATABASE_POOL_MAX ?? (isProduction ? 1 : 10))
const useSsl =
  process.env.DATABASE_SSL !== 'false' && (
    process.env.DATABASE_SSL === 'true'
  || connectionString.includes('supabase.co')
  || connectionString.includes('pooler.supabase.com')
  )

export const pool = new Pool({
  connectionString,
  max: Number.isFinite(poolMax) ? poolMax : 3,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
})

let ready: Promise<void> | null = null

export function ensureDatabase() {
  ready ??= prepareDatabase()
  return ready
}

async function prepareDatabase() {
  if (seedDemo) {
    await seedLocalData()
  }
}

async function seedLocalData() {
  const email = process.env.IMPULSA_SUPER_ADMIN_EMAIL ?? (isProduction ? undefined : 'admin@impulsa.bo')
  const password = process.env.IMPULSA_SUPER_ADMIN_PASSWORD ?? (isProduction ? undefined : 'ImpulsaAdmin2026!')

  if (!email || !password) {
    throw new Error('Configura IMPULSA_SUPER_ADMIN_EMAIL y IMPULSA_SUPER_ADMIN_PASSWORD para crear la demo inicial.')
  }

  const passwordHash = await hashPassword(password)

  const userResult = await pool.query<{ id: string }>(
    `
      insert into usuario (email, nombre, password_hash, estado, ultimo_acceso_at)
      values ($1, 'Super Admin IMPULSA', $2, 'activo', now())
      on conflict (email) do update
      set
        nombre = excluded.nombre,
        estado = 'activo',
        updated_at = now()
      returning id
    `,
    [email, passwordHash],
  )

  const userId = userResult.rows[0]?.id

  if (!userId) {
    throw new Error('No se pudo crear el usuario super admin local.')
  }

  const storeResult = await pool.query<{ id: string }>(
    `
      insert into tienda (owner_id, nombre, slug, rubro, descripcion, ciudad, departamento, pais, plan, activo)
      values (
        $1,
        'Tienda Demo IMPULSA',
        'tienda-demo-impulsa',
        'Abarrotes',
        'Tienda base para probar el punto de venta de IMPULSA.',
        'Cobija',
        'Pando',
        'Bolivia',
        'demo',
        true
      )
      on conflict (slug) do update
      set
        owner_id = excluded.owner_id,
        nombre = excluded.nombre,
        rubro = excluded.rubro,
        descripcion = excluded.descripcion,
        plan = excluded.plan,
        activo = true,
        updated_at = now()
      returning id
    `,
    [userId],
  )

  const storeId = storeResult.rows[0]?.id

  if (!storeId) {
    throw new Error('No se pudo crear la tienda demo local.')
  }

  await pool.query(
    `
      insert into tienda_usuario (tienda_id, usuario_id, cargo, estado, joined_at)
      values ($1, $2, 'Propietario', 'activo', now())
      on conflict (tienda_id, usuario_id) do update
      set
        cargo = excluded.cargo,
        estado = 'activo',
        joined_at = coalesce(tienda_usuario.joined_at, now()),
        updated_at = now()
    `,
    [storeId, userId],
  )

  await assignRole(userId, 'super_admin')
  await assignRole(userId, 'propietario', storeId)

  if (seedDemoProducts) {
    await seedProducts(storeId)
  }
}

async function assignRole(userId: string, roleCode: string, storeId: string | null = null) {
  const roleResult = await pool.query<{ id: string }>(
    `
      select id
      from rol
      where codigo = $1
        and tienda_id is null
      limit 1
    `,
    [roleCode],
  )

  const roleId = roleResult.rows[0]?.id

  if (!roleId) {
    throw new Error(`No existe el rol local ${roleCode}.`)
  }

  await pool.query(
    `
      insert into usuario_rol (usuario_id, rol_id, tienda_id)
      values ($1, $2, $3)
      on conflict do nothing
    `,
    [userId, roleId, storeId],
  )
}

async function seedProducts(storeId: string) {
  const categories = ['Abarrotes', 'Bebidas', 'Combos', 'Lacteos', 'Panaderia']

  for (const [index, name] of categories.entries()) {
    await pool.query(
      `
        insert into categoria (tienda_id, nombre, orden)
        values ($1, $2, $3)
        on conflict (tienda_id, nombre) do nothing
      `,
      [storeId, name, index],
    )
  }

  await pool.query(
    `
      insert into producto (tienda_id, categoria_id, sku, nombre, tipo, precio_venta, stock_actual, precio_variable, visible_pos, orden_catalogo)
      select $1, c.id, p.sku, p.nombre, p.tipo, p.precio_venta, p.stock_actual, p.precio_variable, true, p.orden_catalogo
      from (
        values
          ('ACEITE-1L', 'Aceite Fino 1L', 'Abarrotes', 'producto', 15.00::numeric, 43.00::numeric, false, 1),
          ('AGUA-25L', 'Agua Vital 2.5L', 'Bebidas', 'producto', 5.00::numeric, 111.00::numeric, false, 2),
          ('ARROZ-1KG', 'Arroz Grano de Oro 1kg', 'Abarrotes', 'producto', 8.50::numeric, 85.00::numeric, false, 3),
          ('AZUCAR-1KG', 'Azucar Guabira 1kg', 'Abarrotes', 'producto', 7.00::numeric, 50.00::numeric, false, 4),
          ('COCA-2L', 'Coca Cola 2L', 'Bebidas', 'producto', 13.00::numeric, 136.00::numeric, true, 5),
          ('COMBO-COCINA', 'Combo Cocina Basica', 'Combos', 'combo', 30.15::numeric, 43.00::numeric, false, 6),
          ('LECHE-1L', 'Leche Pil 1L', 'Lacteos', 'producto', 6.50::numeric, 27.00::numeric, false, 7),
          ('PAN-MOLDE', 'Pan Molde Familiar', 'Panaderia', 'producto', 12.00::numeric, 18.00::numeric, false, 8)
      ) as p(sku, nombre, categoria, tipo, precio_venta, stock_actual, precio_variable, orden_catalogo)
      join categoria c on c.tienda_id = $1 and c.nombre = p.categoria
      on conflict (tienda_id, sku) where sku is not null do update
      set
        nombre = excluded.nombre,
        categoria_id = excluded.categoria_id,
        tipo = excluded.tipo,
        precio_venta = excluded.precio_venta,
        precio_variable = excluded.precio_variable,
        visible_pos = true,
        orden_catalogo = excluded.orden_catalogo,
        updated_at = now()
    `,
    [storeId],
  )
}
