import { createError } from 'h3'
import type { PoolClient } from 'pg'

export const CASH_LATE_SALE_NOTE = 'Venta offline conciliada con su turno original'

export function visibleCashSaleNumber(value: unknown) {
  const match = String(value ?? '').trim().match(/^C\d+/i)
  return match?.[0]?.toUpperCase()
}

export type CashSessionSummary = {
  id: string
  status: 'abierta' | 'cerrada'
  openingFloat: number
  expectedCash: number
  countedCash: number | null
  difference: number | null
  openedAt: string
  closedAt: string | null
  openedBy: string
  notes: string | null
}

export type CashMovementSummary = {
  id: string
  saleId?: string
  time: string
  concept: string
  type: 'Ingreso' | 'Egreso'
  method: 'Efectivo' | 'QR'
  amount: number
  source: 'venta' | 'manual'
  status: 'por_cerrar' | 'cerrado'
  canVoid?: boolean
  note?: string
}

export type CashProductSaleSummary = {
  productId: string | null
  name: string
  qty: number
  total: number
}

export type CashOverview = {
  session: CashSessionSummary | null
  movements: CashMovementSummary[]
  productSales: CashProductSaleSummary[]
  lastSaleSequence: number
}

type CashSessionRow = {
  id: string
  status: 'abierta' | 'cerrada'
  openingFloat: number
  expectedCash: number
  countedCash: number | null
  difference: number | null
  openedAt: string
  closedAt: string | null
  openedBy: string | null
  notes: string | null
}

type CashSessionForSale = {
  id: string
  status: 'abierta' | 'cerrada'
  openedAt: Date
  closedAt: Date | null
}

function methodLabel(value: string | null): CashMovementSummary['method'] {
  if (value && value !== 'efectivo') {
    return 'QR'
  }

  return 'Efectivo'
}

function movementTypeLabel(value: string): CashMovementSummary['type'] {
  return value === 'egreso' ? 'Egreso' : 'Ingreso'
}

function movementStatusLabel(value: string): CashMovementSummary['status'] {
  return value === 'confirmado' ? 'cerrado' : 'por_cerrar'
}

export async function getLatestCashSession(client: PoolClient, storeId: string) {
  const result = await client.query<CashSessionRow>(
    `
      select
        cs.id,
        cs.estado as status,
        cs.saldo_inicial::float as "openingFloat",
        cs.saldo_esperado::float as "expectedCash",
        cs.saldo_contado::float as "countedCash",
        cs.diferencia::float as difference,
        to_char(cs.abierta_at at time zone 'America/La_Paz', 'HH24:MI') as "openedAt",
        case
          when cs.cerrada_at is null then null
          else to_char(cs.cerrada_at at time zone 'America/La_Paz', 'HH24:MI')
        end as "closedAt",
        u.nombre as "openedBy",
        cs.notas as notes
      from caja_sesion cs
      left join usuario u on u.id = cs.usuario_id
      where cs.tienda_id = $1
      order by (cs.estado = 'abierta') desc, cs.abierta_at desc
      limit 1
    `,
    [storeId],
  )

  return result.rows[0] ?? null
}

export async function getOpenCashSession(client: PoolClient, storeId: string) {
  const result = await client.query<{ id: string }>(
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

  return result.rows[0]?.id ?? null
}

export async function requireOpenCashSession(
  client: PoolClient,
  storeId: string,
  missingSessionMessage = 'Abre caja antes de vender.',
) {
  const cashSessionId = await getOpenCashSession(client, storeId)

  if (!cashSessionId) {
    throw createError({ statusCode: 409, statusMessage: missingSessionMessage })
  }

  return cashSessionId
}

export async function lockCashSession(client: PoolClient, cashSessionId: string) {
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [cashSessionId])
}

export async function requireLockedOpenCashSession(
  client: PoolClient,
  storeId: string,
  missingSessionMessage?: string,
) {
  const cashSessionId = await requireOpenCashSession(client, storeId, missingSessionMessage)
  await lockCashSession(client, cashSessionId)

  const result = await client.query<{ id: string }>(
    `
      select id
      from caja_sesion
      where id = $1
        and tienda_id = $2
        and estado = 'abierta'
      limit 1
    `,
    [cashSessionId, storeId],
  )

  if (!result.rows[0]) {
    throw createError({ statusCode: 409, statusMessage: 'El turno fue cerrado por otra operación.' })
  }

  return cashSessionId
}

export async function resolveCashSessionForSale(
  client: PoolClient,
  storeId: string,
  occurredAt: Date,
  requestedSessionId?: string,
) {
  const sessionIdResult = requestedSessionId
    ? await client.query<{ id: string }>(
        `
          select id
          from caja_sesion
          where id = $1
            and tienda_id = $2
          limit 1
        `,
        [requestedSessionId, storeId],
      )
    : await client.query<{ id: string }>(
        `
          select id
          from caja_sesion
          where tienda_id = $1
            and abierta_at <= $2::timestamptz
            and (cerrada_at is null or cerrada_at >= $2::timestamptz)
          order by abierta_at desc
          limit 1
        `,
        [storeId, occurredAt],
      )

  const cashSessionId = sessionIdResult.rows[0]?.id
  if (!cashSessionId) {
    throw createError({
      statusCode: 409,
      statusMessage: requestedSessionId
        ? 'El turno original de esta venta ya no está disponible.'
        : 'No se encontró el turno en el que se realizó esta venta.',
    })
  }

  await lockCashSession(client, cashSessionId)

  const sessionResult = await client.query<CashSessionForSale>(
    `
      select
        id,
        estado as status,
        abierta_at as "openedAt",
        cerrada_at as "closedAt"
      from caja_sesion
      where id = $1
        and tienda_id = $2
      limit 1
    `,
    [cashSessionId, storeId],
  )
  const cashSession = sessionResult.rows[0]

  if (!cashSession) {
    throw createError({ statusCode: 409, statusMessage: 'El turno de caja ya no está disponible.' })
  }

  const toleranceMs = 5 * 60 * 1000
  const occurredAtMs = occurredAt.getTime()
  const openedAtMs = new Date(cashSession.openedAt).getTime()
  const closedAtMs = cashSession.closedAt ? new Date(cashSession.closedAt).getTime() : null
  const belongsToSession = occurredAtMs >= openedAtMs - toleranceMs
    && (closedAtMs === null || occurredAtMs <= closedAtMs + toleranceMs)

  if (!belongsToSession) {
    throw createError({
      statusCode: 409,
      statusMessage: 'La hora de la venta no corresponde al turno de caja indicado.',
    })
  }

  return cashSession
}

export async function refreshClosedCashSessionTotals(client: PoolClient, storeId: string, cashSessionId: string) {
  await client.query(
    `
      with totals as (
        select
          cs.id,
          cs.saldo_inicial
            + coalesce(sum(cm.monto) filter (
                where cm.tipo = 'ingreso'
                  and cm.metodo = 'efectivo'
                  and cm.estado <> 'anulado'
              ), 0)
            - coalesce(sum(cm.monto) filter (
                where cm.tipo = 'egreso'
                  and cm.metodo = 'efectivo'
                  and cm.estado <> 'anulado'
              ), 0) as expected_cash
        from caja_sesion cs
        left join caja_movimiento cm
          on cm.caja_sesion_id = cs.id
          and cm.tienda_id = cs.tienda_id
        where cs.id = $1
          and cs.tienda_id = $2
          and cs.estado = 'cerrada'
        group by cs.id
      )
      update caja_sesion cs
      set
        saldo_esperado = totals.expected_cash,
        diferencia = case
          when cs.saldo_contado is null then null
          else cs.saldo_contado - totals.expected_cash
        end,
        updated_at = now()
      from totals
      where cs.id = totals.id
    `,
    [cashSessionId, storeId],
  )
}

export async function createCashSession(client: PoolClient, storeId: string, userId: string, openingFloat = 200, notes: string | null = null) {
  const existingSessionId = await getOpenCashSession(client, storeId)

  if (existingSessionId) {
    return existingSessionId
  }

  const result = await client.query<{ id: string }>(
    `
      insert into caja_sesion (tienda_id, usuario_id, saldo_inicial, saldo_esperado, notas)
      values ($1, $2, $3, $3, $4)
      returning id
    `,
    [storeId, userId, openingFloat, notes],
  )

  return result.rows[0].id
}

export async function getCashOverview(client: PoolClient, storeId: string): Promise<CashOverview> {
  const session = await getLatestCashSession(client, storeId)

  if (!session) {
    return { session: null, movements: [], productSales: [], lastSaleSequence: 0 }
  }

  const movementResult = await client.query<{
    id: string
    time: string
    concept: string
    type: string
    method: string | null
    amount: number
    ventaId: string | null
    status: string
    lateReconciled: boolean
    note: string | null
  }>(
    `
      select
        cm.id,
        to_char(cm.fecha at time zone 'America/La_Paz', 'HH24:MI') as time,
        cm.concepto as concept,
        cm.tipo as type,
        cm.metodo as method,
        cm.monto::float as amount,
        cm.venta_id as "ventaId",
        cm.estado as status,
        (cm.notas = $3) as "lateReconciled",
        cm.notas as note
      from caja_movimiento cm
      where cm.tienda_id = $1
        and cm.caja_sesion_id = $2
        and cm.estado <> 'anulado'
      order by cm.fecha desc, cm.created_at desc
    `,
    [storeId, session.id, CASH_LATE_SALE_NOTE],
  )

  const productResult = await client.query<CashProductSaleSummary>(
    `
      select
        vi.producto_id as "productId",
        vi.nombre_producto as name,
        sum(vi.cantidad)::float as qty,
        sum(
          case
            when v.subtotal > 0 then vi.subtotal * v.total / v.subtotal
            else vi.subtotal
          end
        )::float as total
      from venta v
      join venta_item vi on vi.venta_id = v.id
      where v.tienda_id = $1
        and v.caja_sesion_id = $2
        and v.estado = 'pagada'
      group by vi.producto_id, vi.nombre_producto
      order by total desc, name asc
    `,
    [storeId, session.id],
  )

  const saleSequenceResult = await client.query<{ lastSaleSequence: number }>(
    `
      select count(*)::int as "lastSaleSequence"
      from venta
      where tienda_id = $1
        and caja_sesion_id = $2
    `,
    [storeId, session.id],
  )

  return {
    session: {
      ...session,
      openedBy: session.openedBy ?? 'Responsable de caja',
    },
    movements: movementResult.rows.map((movement) => ({
      id: movement.id,
      saleId: movement.ventaId ?? undefined,
      time: movement.time,
      concept: movement.concept,
      type: movementTypeLabel(movement.type),
      method: methodLabel(movement.method),
      amount: movement.amount,
      source: movement.ventaId ? 'venta' : 'manual',
      status: movementStatusLabel(movement.status),
      canVoid: movement.lateReconciled || undefined,
      note: movement.note ?? undefined,
    })),
    productSales: productResult.rows,
    lastSaleSequence: saleSequenceResult.rows[0]?.lastSaleSequence ?? 0,
  }
}
