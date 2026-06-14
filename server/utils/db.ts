import process from 'node:process'
import pg from 'pg'
import { hashPassword } from './password'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/impulsa'
const isProduction = process.env.NODE_ENV === 'production'
const superAdminEmail = process.env.IMPULSA_SUPER_ADMIN_EMAIL ?? process.env.NEXA_SUPER_ADMIN_EMAIL
const superAdminPassword = process.env.IMPULSA_SUPER_ADMIN_PASSWORD ?? process.env.NEXA_SUPER_ADMIN_PASSWORD
const hasAdminCredentials = Boolean(superAdminEmail && superAdminPassword)
const seedDemo = isProduction ? hasAdminCredentials : true
const seedDemoProducts = process.env.IMPULSA_SEED_DEMO_PRODUCTS !== 'false'
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
  const email = superAdminEmail ?? (isProduction ? undefined : 'admin@impulsa.bo')
  const password = superAdminPassword ?? (isProduction ? undefined : 'ImpulsaAdmin2026!')

  if (!email || !password) {
    throw new Error('Configura IMPULSA_SUPER_ADMIN_EMAIL/IMPULSA_SUPER_ADMIN_PASSWORD o NEXA_SUPER_ADMIN_EMAIL/NEXA_SUPER_ADMIN_PASSWORD para crear la demo inicial.')
  }

  const passwordHash = await hashPassword(password)

  const userResult = await pool.query<{ id: string }>(
    `
      insert into usuario (email, nombre, password_hash, estado, ultimo_acceso_at)
      values ($1, 'Super Admin IMPULSA', $2, 'activo', now())
      on conflict (email) do update
      set
        nombre = excluded.nombre,
        password_hash = excluded.password_hash,
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
        'Tienda base de abarrotes bolivianos para probar el punto de venta de IMPULSA.',
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
  await pool.query(
    `
      select aplicar_catalogo_plantilla($1, 'minimarket_abarrotes', true)
    `,
    [storeId],
  )
}
