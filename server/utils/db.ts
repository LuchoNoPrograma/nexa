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
        insert into empleado (tienda_id, nombre, puesto, color, orden)
        select $1, 'Trabajador 1', 'Atención y caja', '#22c55e', 0
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

async function seedInitialCashData(storeId: string, userId: string) {
  const client = await pool.connect()

  try {
    await client.query('begin')

    const openSessionResult = await client.query<{ id: string }>(
      `
        select id
        from caja_sesion
        where tienda_id = $1
          and estado = 'abierta'
        order by abierta_at desc
        limit 1
      `,
      [storeId],
    )

    let cashSessionId = openSessionResult.rows[0]?.id

    if (!cashSessionId) {
      const createdSession = await client.query<{ id: string }>(
        `
          insert into caja_sesion (tienda_id, usuario_id, saldo_inicial, saldo_esperado, notas)
          values ($1, $2, 200, 200, 'Caja abierta para ventas del turno')
          returning id
        `,
        [storeId, userId],
      )

      cashSessionId = createdSession.rows[0].id
    }

    const seededResult = await client.query(
      `
        select 1
        from caja_movimiento
        where tienda_id = $1
          and caja_sesion_id = $2
          and concepto in ('Venta C1 09:15', 'Venta C2 09:40')
        limit 1
      `,
      [storeId, cashSessionId],
    )

    if (seededResult.rowCount) {
      await client.query('commit')
      return
    }

    type SeedProduct = {
      id: string
      name: string
      kind: string
      cost: number
      price: number
      stock: number
    }

    const productResult = await client.query<SeedProduct>(
      `
        select
          id,
          nombre as name,
          tipo as kind,
          costo_unitario::float as cost,
          precio_venta::float as price,
          stock_actual::float as stock
        from producto
        where tienda_id = $1
          and visible_pos = true
          and activo = true
        order by orden_catalogo asc, nombre asc
        limit 5
      `,
      [storeId],
    )

    if (!productResult.rowCount) {
      await client.query('commit')
      return
    }

    const firstProduct = productResult.rows[0]!

    async function insertInitialSale(cashCode: string, saleTime: string, paymentMethod: 'efectivo' | 'qr', items: Array<{ product: SeedProduct; quantity: number }>) {
      const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
      const saleNumber = `${cashCode}-${cashSessionId.slice(0, 8)}-${saleTime.replace(':', '')}`
      const cashSaleCode = `${cashCode} ${saleTime}`
      const saleResult = await client.query<{ id: string }>(
        `
          insert into venta (
            tienda_id,
            usuario_id,
            caja_sesion_id,
            numero,
            canal,
            estado,
            subtotal,
            descuento,
            total,
            fecha,
            notas
          )
          values ($1, $2, $3, $4, 'pos', 'pagada', $5, 0, $5, date_trunc('day', now()) + $6::time, 'Venta de mostrador')
          returning id
        `,
        [storeId, userId, cashSessionId, saleNumber, subtotal, saleTime],
      )

      const saleId = saleResult.rows[0].id

      for (const item of items) {
        const lineSubtotal = item.product.price * item.quantity

        await client.query(
          `
            insert into venta_item (
              venta_id,
              producto_id,
              nombre_producto,
              tipo_producto,
              cantidad,
              costo_unitario,
              precio_unitario,
              subtotal
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [saleId, item.product.id, item.product.name, item.product.kind, item.quantity, item.product.cost, item.product.price, lineSubtotal],
        )
      }

      const paymentResult = await client.query<{ id: string }>(
        `
          insert into pago (
            tienda_id,
            venta_id,
            caja_sesion_id,
            usuario_id,
            tipo,
            metodo,
            estado,
            monto,
            fecha,
            notas
          )
          values ($1, $2, $3, $4, 'ingreso', $5, 'confirmado', $6, date_trunc('day', now()) + $7::time, $8)
          returning id
        `,
        [storeId, saleId, cashSessionId, userId, paymentMethod, subtotal, saleTime, `Cobro ${cashSaleCode}`],
      )

      await client.query(
        `
          insert into caja_movimiento (
            tienda_id,
            caja_sesion_id,
            pago_id,
            venta_id,
            usuario_id,
            tipo,
            categoria,
            concepto,
            metodo,
            monto,
            estado,
            fecha,
            notas
          )
          values ($1, $2, $3, $4, $5, 'ingreso', 'venta', $6, $7, $8, 'pendiente', date_trunc('day', now()) + $9::time, 'Listo para revisar al cerrar caja')
        `,
        [storeId, cashSessionId, paymentResult.rows[0].id, saleId, userId, `Venta ${cashSaleCode}`, paymentMethod, subtotal, saleTime],
      )
    }

    await insertInitialSale('C1', '09:15', 'efectivo', [
      { product: firstProduct, quantity: 2 },
      { product: productResult.rows[1] ?? firstProduct, quantity: 1 },
    ])

    await insertInitialSale('C2', '09:40', 'qr', [
      { product: productResult.rows[2] ?? firstProduct, quantity: 3 },
    ])

    await client.query(
      `
        insert into caja_movimiento (
          tienda_id,
          caja_sesion_id,
          usuario_id,
          tipo,
          categoria,
          concepto,
          metodo,
          monto,
          estado,
          fecha,
          notas
        )
        values ($1, $2, $3, 'egreso', 'manual', 'Compra de bolsas', 'efectivo', 45, 'pendiente', date_trunc('day', now()) + '10:25'::time, 'Salida registrada en el turno')
      `,
      [storeId, cashSessionId, userId],
    )

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
