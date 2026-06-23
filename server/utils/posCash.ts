import { createError } from 'h3'
import type { PoolClient } from 'pg'

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
  note?: string
}

export type CashProductSaleSummary = {
  name: string
  qty: number
  total: number
}

export type CashOverview = {
  session: CashSessionSummary | null
  movements: CashMovementSummary[]
  productSales: CashProductSaleSummary[]
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

function methodLabel(value: string | null): CashMovementSummary['method'] {
  if (value === 'qr' || value === 'transferencia') {
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
        to_char(cs.abierta_at, 'HH24:MI') as "openedAt",
        case when cs.cerrada_at is null then null else to_char(cs.cerrada_at, 'HH24:MI') end as "closedAt",
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

export async function requireOpenCashSession(client: PoolClient, storeId: string) {
  const cashSessionId = await getOpenCashSession(client, storeId)

  if (!cashSessionId) {
    throw createError({ statusCode: 409, statusMessage: 'Abre caja antes de vender.' })
  }

  return cashSessionId
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
    return { session: null, movements: [], productSales: [] }
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
    note: string | null
  }>(
    `
      select
        cm.id,
        to_char(cm.fecha, 'HH24:MI') as time,
        cm.concepto as concept,
        cm.tipo as type,
        cm.metodo as method,
        cm.monto::float as amount,
        cm.venta_id as "ventaId",
        cm.estado as status,
        cm.notas as note
      from caja_movimiento cm
      where cm.tienda_id = $1
        and cm.caja_sesion_id = $2
        and cm.estado <> 'anulado'
      order by cm.fecha desc, cm.created_at desc
    `,
    [storeId, session.id],
  )

  const productResult = await client.query<CashProductSaleSummary>(
    `
      select
        vi.nombre_producto as name,
        sum(vi.cantidad)::float as qty,
        sum(vi.subtotal)::float as total
      from venta v
      join venta_item vi on vi.venta_id = v.id
      where v.tienda_id = $1
        and v.caja_sesion_id = $2
        and v.estado <> 'anulada'
      group by vi.nombre_producto
      order by total desc, name asc
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
      note: movement.note ?? undefined,
    })),
    productSales: productResult.rows,
  }
}
