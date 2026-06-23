import { getQuery } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'

// Lista de gastos (egresos confirmados) del periodo + totales + tendencia. Alimenta
// la página Gastos con datos reales. Periodo: 'today' | 'week' | 'month'.
// La tendencia (por día / por semana / últimos meses) viene siempre, para que la
// página la muestre igual que en Ingresos sin pedir otra vez al servidor.
type Periodo = 'today' | 'week' | 'month'

const DIAS_DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Mismo conjunto que la lista de gastos (egresos confirmados que no son venta ni
// compra registrada). $1 = tienda. Se usa como CTE en cada agregado de tendencia.
const EGRESOS_CTE = `
  select cm.fecha, cm.monto
  from caja_movimiento cm
  where cm.tienda_id = $1
    and cm.tipo = 'egreso'
    and cm.estado = 'confirmado'
    and cm.venta_id is null
    and cm.compra_id is null
`

function rangoSql(periodo: Periodo): string {
  if (periodo === 'today') return "fecha >= date_trunc('day', now())"
  if (periodo === 'week') return "fecha >= date_trunc('week', now())"
  return "fecha >= date_trunc('month', now())"
}

type DiaRow = { dow: number, range: string, sales: number, transactions: number }
type DiaMesRow = { day: number, sales: number, transactions: number }
type MesRow = { month_idx: number, sales: number }

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const periodo = (getQuery(event).periodo as Periodo) || 'month'
  const filtro = rangoSql(['today', 'week', 'month'].includes(periodo) ? periodo : 'month')
  const id = [session.storeId]

  const [lista, dias, diasMes, meses] = await Promise.all([
    pool.query(
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
      id,
    ),
    // Gastos por día de la semana actual (lunes a domingo, con días en cero).
    pool.query<DiaRow>(
      `
        with egresos as (${EGRESOS_CTE})
        select
          extract(dow from d.dia)::int as dow,
          to_char(d.dia, 'DD/MM') as range,
          coalesce(sum(e.monto), 0)::float as sales,
          count(e.fecha)::int as transactions
        from generate_series(
          date_trunc('week', now()),
          date_trunc('week', now()) + interval '6 days',
          interval '1 day'
        ) d(dia)
        left join egresos e on e.fecha >= d.dia and e.fecha < d.dia + interval '1 day'
        group by d.dia
        order by d.dia
      `,
      id,
    ),
    // Gastos por día del mes actual (para agrupar en semanas).
    pool.query<DiaMesRow>(
      `
        with egresos as (${EGRESOS_CTE})
        select
          extract(day from d.dia)::int as day,
          coalesce(sum(e.monto), 0)::float as sales,
          count(e.fecha)::int as transactions
        from generate_series(
          date_trunc('month', now()),
          date_trunc('month', now()) + interval '1 month' - interval '1 day',
          interval '1 day'
        ) d(dia)
        left join egresos e on e.fecha >= d.dia and e.fecha < d.dia + interval '1 day'
        group by d.dia
        order by d.dia
      `,
      id,
    ),
    // Gastos de los últimos 6 meses (para la comparativa mensual).
    pool.query<MesRow>(
      `
        with egresos as (${EGRESOS_CTE})
        select
          extract(month from m.mes)::int as month_idx,
          coalesce(sum(e.monto), 0)::float as sales
        from generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) m(mes)
        left join egresos e on e.fecha >= m.mes and e.fecha < m.mes + interval '1 month'
        group by m.mes
        order by m.mes
      `,
      id,
    ),
  ])

  const semana = dias.rows.map(row => ({
    label: DIAS_DOW[row.dow] ?? '',
    range: row.range,
    sales: row.sales,
    transactions: row.transactions,
  }))

  const semanasMap = new Map<number, { dias: number[], sales: number, transactions: number }>()
  for (const row of diasMes.rows) {
    const bucket = Math.floor((row.day - 1) / 7)
    const actual = semanasMap.get(bucket) ?? { dias: [], sales: 0, transactions: 0 }
    actual.dias.push(row.day)
    actual.sales += row.sales
    actual.transactions += row.transactions
    semanasMap.set(bucket, actual)
  }
  const semanas = [...semanasMap.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, v]) => ({
    label: `Semana ${bucket + 1}`,
    range: `${Math.min(...v.dias)} - ${Math.max(...v.dias)}`,
    sales: v.sales,
    transactions: v.transactions,
  }))

  const mesesLista = meses.rows.map(row => ({
    label: MESES[row.month_idx - 1] ?? '',
    sales: row.sales,
  }))

  return {
    gastos: lista.rows,
    semana,
    semanas,
    meses: mesesLista,
  }
})
