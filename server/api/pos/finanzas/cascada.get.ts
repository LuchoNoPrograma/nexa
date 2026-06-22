import { getQuery } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'
import { calcularFinanzas, grupoContable, type FinanzasInput } from '~~/shared/utils/finanzas'

// Cascada de Utilidad Neta calculada de datos REALES del negocio:
//  - Ventas y Costo de Ventas salen de las ventas registradas en el POS.
//  - Gastos (operativos/financieros) y Otros ingresos salen de caja_movimiento.
// Periodo: 'este' (mes actual) o 'pasado' (mes anterior).

type Periodo = 'este' | 'pasado'

function rangoMes(periodo: Periodo): { desde: string, hasta: string } {
  // Límites del mes en SQL (se calculan en la consulta con date_trunc), aquí solo
  // devolvemos el offset de meses hacia atrás.
  return periodo === 'pasado'
    ? { desde: "date_trunc('month', now()) - interval '1 month'", hasta: "date_trunc('month', now())" }
    : { desde: "date_trunc('month', now())", hasta: "date_trunc('month', now()) + interval '1 month'" }
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const query = getQuery(event)
  const periodo: Periodo = query.periodo === 'pasado' ? 'pasado' : 'este'
  const { desde, hasta } = rangoMes(periodo)

  const client = await pool.connect()
  try {
    // Ventas del periodo + Costo de Ventas, de ventas no anuladas ni cotizaciones.
    const ventasResult = await client.query<{ ventas: string, costo: string }>(
      `
        select
          coalesce(sum(v.total), 0) as ventas,
          coalesce(sum(coalesce(vi.costo, 0)), 0) as costo
        from venta v
        left join (
          select venta_id, sum(costo_unitario * cantidad) as costo
          from venta_item
          group by venta_id
        ) vi on vi.venta_id = v.id
        where v.tienda_id = $1
          and v.estado not in ('anulada', 'cotizacion')
          and v.fecha >= ${desde}
          and v.fecha < ${hasta}
      `,
      [session.storeId],
    )

    // Movimientos de caja confirmados del periodo, agrupados por tipo + categoría
    // para clasificarlos en grupos contables con el motor compartido.
    const movsResult = await client.query<{ tipo: 'ingreso' | 'egreso', categoria: string, monto: string }>(
      `
        select tipo, categoria, coalesce(sum(monto), 0) as monto
        from caja_movimiento
        where tienda_id = $1
          and estado = 'confirmado'
          and venta_id is null
          and compra_id is null
          and fecha >= ${desde}
          and fecha < ${hasta}
        group by tipo, categoria
      `,
      [session.storeId],
    )

    let gastosOperativos = 0
    let gastosFinancieros = 0
    let otrosIngresos = 0
    for (const row of movsResult.rows) {
      const monto = Number(row.monto) || 0
      const grupo = grupoContable(row.tipo, row.categoria)
      if (grupo === 'gasto_operativo') gastosOperativos += monto
      else if (grupo === 'gasto_financiero') gastosFinancieros += monto
      else if (grupo === 'otro_ingreso') otrosIngresos += monto
      // 'inventario' (compra de mercadería) no entra: el costo va por Costo de
      // Ventas cuando se vende. 'venta' manual ya cuenta en la tabla venta.
    }

    const input: FinanzasInput = {
      ventasPeriodo: Number(ventasResult.rows[0]?.ventas) || 0,
      costoVentas: Number(ventasResult.rows[0]?.costo) || 0,
      gastosOperativos,
      gastosFinancieros,
      otrosIngresos,
    }

    return { periodo, ...calcularFinanzas(input) }
  } finally {
    client.release()
  }
})
