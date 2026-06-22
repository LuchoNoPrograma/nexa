import { getQuery } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'

// Lista de gastos (egresos confirmados) del periodo + totales. Alimenta la página
// Gastos con datos reales. Periodo: 'today' | 'week' | 'month'.
type Periodo = 'today' | 'week' | 'month'

function rangoSql(periodo: Periodo): string {
  if (periodo === 'today') return "fecha >= date_trunc('day', now())"
  if (periodo === 'week') return "fecha >= date_trunc('week', now())"
  return "fecha >= date_trunc('month', now())"
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const periodo = (getQuery(event).periodo as Periodo) || 'month'
  const filtro = rangoSql(['today', 'week', 'month'].includes(periodo) ? periodo : 'month')

  const result = await pool.query(
    `
      select
        id,
        fecha,
        categoria,
        concepto,
        coalesce(metodo, 'efectivo') as metodo,
        monto::float as monto
      from caja_movimiento
      where tienda_id = $1
        and tipo = 'egreso'
        and estado = 'confirmado'
        and venta_id is null
        and compra_id is null
        and ${filtro}
      order by fecha desc, created_at desc
    `,
    [session.storeId],
  )

  return { gastos: result.rows }
})
