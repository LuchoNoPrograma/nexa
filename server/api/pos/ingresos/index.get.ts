import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'

// Datos REALES de ingresos del negocio para la página de Ingresos.
// "Ingreso" = ventas (venta/venta_item) + otros ingresos registrados en caja
// (caja_movimiento tipo ingreso que no son venta ni compra: reembolsos, aportes,
// movimientos manuales). Se incluyen apenas se registran (pendiente o confirmado),
// para que el dueño vea de inmediato lo que cargó, no solo al cerrar el turno.
// Se devuelve todo en una sola lectura para alternar Hoy/Semana/Mes sin re-pedir.

const DIAS_DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Fuente unificada de ingresos (fecha, monto). $1 = tienda. Se usa como CTE en cada
// consulta; $1 se repite, lo que PostgreSQL permite sin problema.
const INGRESOS_CTE = `
  select v.fecha, v.total as monto
  from venta v
  where v.tienda_id = $1 and v.estado not in ('anulada', 'cotizacion')
  union all
  select cm.fecha, cm.monto
  from caja_movimiento cm
  where cm.tienda_id = $1
    and cm.tipo = 'ingreso'
    and cm.estado <> 'anulado'
    and cm.venta_id is null
    and cm.compra_id is null
`

type DiaRow = { dow: number, range: string, sales: number, transactions: number }
type DiaMesRow = { day: number, sales: number, transactions: number }
type MesRow = { month_idx: number, sales: number }

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const id = [session.storeId]

  const [ingresosHoy, dias, diasMes, meses, topProducto, escalares] = await Promise.all([
    // Detalle de los ingresos de hoy: productos vendidos + otros ingresos registrados.
    pool.query<{
      time: string
      product: string
      category: string
      qty: number
      unitPrice: number
      total: number
      method: string
    }>(
      `
        select time, product, category, qty, "unitPrice", total, method
        from (
          select
            to_char(v.fecha, 'HH24:MI') as time,
            vi.nombre_producto as product,
            coalesce(c.nombre, 'General') as category,
            vi.cantidad::float as qty,
            vi.precio_unitario::float as "unitPrice",
            vi.subtotal::float as total,
            case when pm.metodo ilike 'qr' then 'QR' else 'Efectivo' end as method,
            v.fecha as orden
          from venta v
          join venta_item vi on vi.venta_id = v.id
          left join producto p on p.id = vi.producto_id
          left join categoria c on c.id = p.categoria_id
          left join lateral (
            select metodo from caja_movimiento cm where cm.venta_id = v.id limit 1
          ) pm on true
          where v.tienda_id = $1
            and v.estado not in ('anulada', 'cotizacion')
            and v.fecha >= date_trunc('day', now())
          union all
          select
            to_char(cm.fecha, 'HH24:MI') as time,
            cm.concepto as product,
            'Otro ingreso' as category,
            1::float as qty,
            cm.monto::float as "unitPrice",
            cm.monto::float as total,
            case when cm.metodo ilike 'qr' then 'QR' else 'Efectivo' end as method,
            cm.fecha as orden
          from caja_movimiento cm
          where cm.tienda_id = $1
            and cm.tipo = 'ingreso'
            and cm.estado <> 'anulado'
            and cm.venta_id is null
            and cm.compra_id is null
            and cm.fecha >= date_trunc('day', now())
        ) t
        order by orden
      `,
      id,
    ),
    // Ingresos por día de la semana actual (lunes a domingo, con días en cero).
    pool.query<DiaRow>(
      `
        with ingresos as (${INGRESOS_CTE})
        select
          extract(dow from d.dia)::int as dow,
          to_char(d.dia, 'DD/MM') as range,
          coalesce(sum(i.monto), 0)::float as sales,
          count(i.fecha)::int as transactions
        from generate_series(
          date_trunc('week', now()),
          date_trunc('week', now()) + interval '6 days',
          interval '1 day'
        ) d(dia)
        left join ingresos i on i.fecha >= d.dia and i.fecha < d.dia + interval '1 day'
        group by d.dia
        order by d.dia
      `,
      id,
    ),
    // Ingresos por día del mes actual (para agrupar en semanas).
    pool.query<DiaMesRow>(
      `
        with ingresos as (${INGRESOS_CTE})
        select
          extract(day from d.dia)::int as day,
          coalesce(sum(i.monto), 0)::float as sales,
          count(i.fecha)::int as transactions
        from generate_series(
          date_trunc('month', now()),
          date_trunc('month', now()) + interval '1 month' - interval '1 day',
          interval '1 day'
        ) d(dia)
        left join ingresos i on i.fecha >= d.dia and i.fecha < d.dia + interval '1 day'
        group by d.dia
        order by d.dia
      `,
      id,
    ),
    // Ingresos de los últimos 6 meses (para la comparativa mensual).
    pool.query<MesRow>(
      `
        with ingresos as (${INGRESOS_CTE})
        select
          extract(month from m.mes)::int as month_idx,
          coalesce(sum(i.monto), 0)::float as sales
        from generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) m(mes)
        left join ingresos i on i.fecha >= m.mes and i.fecha < m.mes + interval '1 month'
        group by m.mes
        order by m.mes
      `,
      id,
    ),
    // Producto más vendido hoy (solo ventas reales tienen producto).
    pool.query<{ name: string, qty: number }>(
      `
        select vi.nombre_producto as name, sum(vi.cantidad)::float as qty
        from venta_item vi
        join venta v on v.id = vi.venta_id
        where v.tienda_id = $1
          and v.estado not in ('anulada', 'cotizacion')
          and v.fecha >= date_trunc('day', now())
        group by vi.nombre_producto
        order by qty desc
        limit 1
      `,
      id,
    ),
    // Totales de referencia para las comparativas (hoy / ayer / semana anterior).
    pool.query<{
      ventas_hoy_count: number
      ayer: number
      semana_anterior: number
    }>(
      `
        with ingresos as (${INGRESOS_CTE})
        select
          (select count(*) from ingresos where fecha >= date_trunc('day', now()))::int as ventas_hoy_count,
          coalesce((select sum(monto) from ingresos
            where fecha >= date_trunc('day', now()) - interval '1 day'
              and fecha < date_trunc('day', now())), 0)::float as ayer,
          coalesce((select sum(monto) from ingresos
            where fecha >= date_trunc('week', now()) - interval '1 week'
              and fecha < date_trunc('week', now())), 0)::float as semana_anterior
      `,
      id,
    ),
  ])

  // Semana actual: etiquetas de día en español, con su fecha.
  const semana = dias.rows.map(row => ({
    label: DIAS_DOW[row.dow] ?? '',
    range: row.range,
    sales: row.sales,
    transactions: row.transactions,
  }))

  // Mes actual agrupado en semanas (bloques de 7 días: 1-7, 8-14, …).
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

  // Últimos meses: etiqueta corta en español.
  const mesesLista = meses.rows.map(row => ({
    label: MESES[row.month_idx - 1] ?? '',
    sales: row.sales,
  }))

  const totalHoy = ingresosHoy.rows.reduce((sum, row) => sum + row.total, 0)
  const e = escalares.rows[0]
  const totalMesActual = mesesLista.at(-1)?.sales ?? 0
  const totalMesAnterior = mesesLista.at(-2)?.sales ?? 0
  const totalSemanaActual = semana.reduce((sum, d) => sum + d.sales, 0)

  // Variación porcentual; null cuando no hay base previa para comparar.
  const variacion = (actual: number, previo: number) =>
    previo > 0 ? ((actual - previo) / previo) * 100 : null

  return {
    ventas: ingresosHoy.rows,
    semana,
    semanas,
    meses: mesesLista,
    topProducto: topProducto.rows[0] ?? null,
    resumenHoy: {
      total: totalHoy,
      ventas: e?.ventas_hoy_count ?? 0,
    },
    comparativas: {
      hoyVsAyer: variacion(totalHoy, e?.ayer ?? 0),
      semanaVsAnterior: variacion(totalSemanaActual, e?.semana_anterior ?? 0),
      mesVsAnterior: variacion(totalMesActual, totalMesAnterior),
    },
  }
})
