import process from 'node:process'
import pg from 'pg'
import { hashPassword } from './password'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/nexa'
const isProduction = process.env.NODE_ENV === 'production'
const superAdminEmail = process.env.NEXA_SUPER_ADMIN_EMAIL
const superAdminPassword = process.env.NEXA_SUPER_ADMIN_PASSWORD
const hasAdminCredentials = Boolean(superAdminEmail && superAdminPassword)
const seedDemo = isProduction ? hasAdminCredentials : true
const seedDemoProducts = process.env.NEXA_SEED_DEMO_PRODUCTS !== 'false'
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
  const email = superAdminEmail ?? (isProduction ? undefined : 'admin@nexa.bo')
  const password = superAdminPassword ?? (isProduction ? undefined : 'NexaAdmin2026!')

  if (!email || !password) {
    throw new Error('Configura NEXA_SUPER_ADMIN_EMAIL/NEXA_SUPER_ADMIN_PASSWORD para crear la demo inicial.')
  }

  const passwordHash = await hashPassword(password)

  const userResult = await pool.query<{ id: string }>(
    `
      insert into usuario (email, nombre, password_hash, estado, ultimo_acceso_at)
      values ($1, 'Super Admin NEXA', $2, 'activo', now())
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
        'Tienda Demo NEXA',
        'tienda-demo-nexa',
        'Abarrotes',
        'Tienda base de abarrotes bolivianos para probar el punto de venta de NEXA.',
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
  await seedDefaultEmployee(storeId)

  if (seedDemoProducts) {
    await seedProducts(storeId)
  }

  await seedInitialCashData(storeId, userId)
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

async function seedDefaultEmployee(storeId: string) {
  await pool.query(
    `
      insert into nomina_config (tienda_id, salario_minimo_mensual, horas_mensuales_referencia, semanas_por_mes)
      values ($1, 3300, 207.84, 4.33)
      on conflict (tienda_id) do update
      set
        salario_minimo_mensual = coalesce(nomina_config.salario_minimo_mensual, excluded.salario_minimo_mensual),
        horas_mensuales_referencia = coalesce(nomina_config.horas_mensuales_referencia, excluded.horas_mensuales_referencia),
        semanas_por_mes = coalesce(nomina_config.semanas_por_mes, excluded.semanas_por_mes),
        updated_at = now()
    `,
    [storeId],
  )

  await pool.query(
    `
      with empleado_base as (
        insert into empleado (tienda_id, nombre, puesto, color, orden, numero)
        select $1, 'Empleado 1', 'Atención y caja', '#22c55e', 0, 1
        where not exists (
          select 1
          from empleado
          where tienda_id = $1
            and activo = true
        )
        returning id, tienda_id
      ),
      empleado_objetivo as (
        select id, tienda_id from empleado_base
        union all
        select id, tienda_id
        from empleado
        where tienda_id = $1
          and activo = true
        order by id
        limit 1
      )
      insert into empleado_horario (empleado_id, tienda_id, slots, horas_semanales)
      select
        id,
        tienda_id,
        '[
          {"dia":1,"hora":14},{"dia":1,"hora":15},{"dia":1,"hora":16},{"dia":1,"hora":17},{"dia":1,"hora":18},{"dia":1,"hora":19},
          {"dia":2,"hora":14},{"dia":2,"hora":15},{"dia":2,"hora":16},{"dia":2,"hora":17},{"dia":2,"hora":18},{"dia":2,"hora":19},
          {"dia":3,"hora":14},{"dia":3,"hora":15},{"dia":3,"hora":16},{"dia":3,"hora":17},{"dia":3,"hora":18},{"dia":3,"hora":19},
          {"dia":4,"hora":14},{"dia":4,"hora":15},{"dia":4,"hora":16},{"dia":4,"hora":17},{"dia":4,"hora":18},{"dia":4,"hora":19},
          {"dia":5,"hora":14},{"dia":5,"hora":15},{"dia":5,"hora":16},{"dia":5,"hora":17},{"dia":5,"hora":18},{"dia":5,"hora":19}
        ]'::jsonb,
        30
      from empleado_objetivo
      on conflict (empleado_id) do nothing
    `,
    [storeId],
  )
}

// Dato inicial de caja: solo una sesión abierta con su saldo inicial en
// bolivianos (BOB). No se siembran ventas ni movimientos de ejemplo: el turno
// arranca limpio y todo lo demás entra por el POS con datos reales.
const INITIAL_CASH_FLOAT_BOB = 200

async function seedInitialCashData(storeId: string, userId: string) {
  await pool.query(
    `
      insert into caja_sesion (tienda_id, usuario_id, saldo_inicial, saldo_esperado, notas)
      select $1, $2, $3, $3, 'Caja abierta para ventas del turno'
      where not exists (
        select 1
        from caja_sesion
        where tienda_id = $1
          and estado = 'abierta'
      )
    `,
    [storeId, userId, INITIAL_CASH_FLOAT_BOB],
  )
}
