import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreAccess } from '../../../utils/posCatalog'

// Datos REALES de ingresos del negocio para la página de Ingresos.
// "Ingreso" = ventas (venta/venta_item) + otros ingresos registrados en caja
// (caja_movimiento tipo ingreso que no son venta ni compra: reembolsos, aportes,
// movimientos manuales). Se incluyen apenas se registran (pendiente o confirmado),
// para que el dueño vea de inmediato lo que cargó, no solo al cerrar el turno.
// Se devuelve todo en una sola lectura para alternar Día/Semana/Mes sin re-pedir.

const DIAS_DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Fuente unificada de ingresos (fecha, monto). $1 = tienda. Se usa como CTE en cada
// consulta; $1 se repite, lo que PostgreSQL permite sin problema.
const INGRESOS_CTE = `
  select v.fecha, v.total as monto, 'venta'::text as origen
  from venta v
  where v.tienda_id = $1 and v.estado = 'pagada'
  union all
  select cm.fecha, cm.monto, 'otro_ingreso'::text as origen
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
  const session = await requireStoreAccess(event, 'reporte.ver')
  await ensureDatabase()

  const id = [session.storeId]

  const [ingresosHoy, dias, diasMes, meses, topProducto, escalares] = await Promise.all([
    // Detalle de los ingresos de hoy: productos vendidos + otros ingresos registrados.
    pool.query<{
      movementId: string | null
      cashSessionId: string | null
      cashOpenedAt: string | null
      time: string
      product: string
      category: string
      qty: number
      unitPrice: number
      total: number
      method: string
    }>(
      `
        select "movementId", "cashSessionId", "cashOpenedAt", time, product, category, qty, "unitPrice", total, method
        from (
          select
            null::uuid as "movementId",
            v.caja_sesion_id as "cashSessionId",
            cs.abierta_at as "cashOpenedAt",
            to_char(v.fecha at time zone 'America/La_Paz', 'HH24:MI') as time,
            vi.nombre_producto as product,
            coalesce(c.nombre, 'General') as category,
            vi.cantidad::float as qty,
            (
              case
                when v.subtotal > 0 then vi.precio_unitario * v.total / v.subtotal
                else vi.precio_unitario
              end
            )::float as "unitPrice",
            (
              case
                when v.subtotal > 0 then vi.subtotal * v.total / v.subtotal
                else vi.subtotal
              end
            )::float as total,
            case
              when pm.metodo = 'mixto' then 'Mixto'
              when pm.metodo ilike 'qr' then 'QR'
              when pm.metodo ilike 'transferencia' or pm.metodo ilike 'tarjeta' then 'Transferencia'
              else 'Efectivo'
            end as method,
            v.fecha as orden
          from venta v
          join venta_item vi on vi.venta_id = v.id
          left join producto p on p.id = vi.producto_id
          left join categoria c on c.id = p.categoria_id
          left join caja_sesion cs
            on cs.id = v.caja_sesion_id
            and cs.tienda_id = v.tienda_id
          left join lateral (
            select
              case
                when count(distinct cm.metodo) > 1 then 'mixto'
                else min(cm.metodo)
              end as metodo
            from caja_movimiento cm
            where cm.venta_id = v.id
              and cm.estado <> 'anulado'
          ) pm on true
          where v.tienda_id = $1
            and v.estado = 'pagada'
            and v.fecha >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
            and v.fecha < (date_trunc('day', now() at time zone 'America/La_Paz') + interval '1 day') at time zone 'America/La_Paz'
          union all
          select
            cm.id as "movementId",
            cm.caja_sesion_id as "cashSessionId",
            cs.abierta_at as "cashOpenedAt",
            to_char(cm.fecha at time zone 'America/La_Paz', 'HH24:MI') as time,
            cm.concepto as product,
            'Otro ingreso' as category,
            1::float as qty,
            cm.monto::float as "unitPrice",
            cm.monto::float as total,
            case
              when cm.metodo ilike 'qr' then 'QR'
              when cm.metodo ilike 'transferencia' or cm.metodo ilike 'tarjeta' then 'Transferencia'
              else 'Efectivo'
            end as method,
            cm.fecha as orden
          from caja_movimiento cm
          left join caja_sesion cs
            on cs.id = cm.caja_sesion_id
            and cs.tienda_id = cm.tienda_id
          where cm.tienda_id = $1
            and cm.tipo = 'ingreso'
            and cm.estado <> 'anulado'
            and cm.venta_id is null
            and cm.compra_id is null
            and cm.fecha >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
            and cm.fecha < (date_trunc('day', now() at time zone 'America/La_Paz') + interval '1 day') at time zone 'America/La_Paz'
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
          date_trunc('week', now() at time zone 'America/La_Paz'),
          date_trunc('week', now() at time zone 'America/La_Paz') + interval '6 days',
          interval '1 day'
        ) d(dia)
        left join ingresos i on i.fecha >= d.dia at time zone 'America/La_Paz' and i.fecha < (d.dia + interval '1 day') at time zone 'America/La_Paz'
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
          date_trunc('month', now() at time zone 'America/La_Paz'),
          date_trunc('month', now() at time zone 'America/La_Paz') + interval '1 month' - interval '1 day',
          interval '1 day'
        ) d(dia)
        left join ingresos i on i.fecha >= d.dia at time zone 'America/La_Paz' and i.fecha < (d.dia + interval '1 day') at time zone 'America/La_Paz'
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
          date_trunc('month', now() at time zone 'America/La_Paz') - interval '5 months',
          date_trunc('month', now() at time zone 'America/La_Paz'),
          interval '1 month'
        ) m(mes)
        left join ingresos i on i.fecha >= m.mes at time zone 'America/La_Paz' and i.fecha < (m.mes + interval '1 month') at time zone 'America/La_Paz'
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
          and v.estado = 'pagada'
          and v.fecha >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
          and v.fecha < (date_trunc('day', now() at time zone 'America/La_Paz') + interval '1 day') at time zone 'America/La_Paz'
        group by vi.producto_id, vi.nombre_producto
        order by qty desc
        limit 1
      `,
      id,
    ),
    // Totales de referencia para las comparativas (hoy / ayer / semana anterior).
    pool.query<{
      ventas_hoy_count: number
      movimientos_hoy_count: number
      ventas_hoy_total: number
      otros_hoy_total: number
      ayer: number
      semana_anterior: number
    }>(
      `
        with ingresos as (${INGRESOS_CTE})
        select
          (select count(*) from ingresos
            where origen = 'venta'
              and fecha >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
              and fecha < (date_trunc('day', now() at time zone 'America/La_Paz') + interval '1 day') at time zone 'America/La_Paz')::int as ventas_hoy_count,
          (select count(*) from ingresos
            where fecha >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
              and fecha < (date_trunc('day', now() at time zone 'America/La_Paz') + interval '1 day') at time zone 'America/La_Paz')::int as movimientos_hoy_count,
          coalesce((select sum(monto) from ingresos
            where origen = 'venta'
              and fecha >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
              and fecha < (date_trunc('day', now() at time zone 'America/La_Paz') + interval '1 day') at time zone 'America/La_Paz'), 0)::float as ventas_hoy_total,
          coalesce((select sum(monto) from ingresos
            where origen = 'otro_ingreso'
              and fecha >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
              and fecha < (date_trunc('day', now() at time zone 'America/La_Paz') + interval '1 day') at time zone 'America/La_Paz'), 0)::float as otros_hoy_total,
          coalesce((select sum(monto) from ingresos
            where fecha >= (date_trunc('day', now() at time zone 'America/La_Paz') - interval '1 day') at time zone 'America/La_Paz'
              and fecha < date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'), 0)::float as ayer,
          coalesce((select sum(monto) from ingresos
            where fecha >= (date_trunc('week', now() at time zone 'America/La_Paz') - interval '1 week') at time zone 'America/La_Paz'
              and fecha < date_trunc('week', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'), 0)::float as semana_anterior
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

  const e = escalares.rows[0]
  const totalHoy = (e?.ventas_hoy_total ?? 0) + (e?.otros_hoy_total ?? 0)
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
      totalIngresos: totalHoy,
      totalVentas: e?.ventas_hoy_total ?? 0,
      otrosIngresos: e?.otros_hoy_total ?? 0,
      ventas: e?.ventas_hoy_count ?? 0,
      movimientos: e?.movimientos_hoy_count ?? 0,
    },
    comparativas: {
      hoyVsAyer: variacion(totalHoy, e?.ayer ?? 0),
      semanaVsAnterior: variacion(totalSemanaActual, e?.semana_anterior ?? 0),
      mesVsAnterior: variacion(totalMesActual, totalMesAnterior),
    },
  }
})
