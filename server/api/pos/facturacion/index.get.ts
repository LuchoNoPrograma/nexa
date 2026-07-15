import { getQuery } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreAccess } from '../../../utils/posCatalog'
import { visibleCashSaleNumber } from '../../../utils/posCash'
import { decryptSecret } from '../../../utils/secrets'

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'reporte.ver')
  await ensureDatabase()

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit ?? 50) || 50, 200)

  const result = await pool.query(
    `
      select
        f.id,
        f.numero_factura,
        f.cuf,
        f.estado,
        f.fecha_emision,
        f.razon_social_cliente,
        f.numero_documento_cliente,
        f.monto_total,
        f.codigo_motivo_anulacion,
        f.venta_id,
        v.numero as venta_numero
      from factura f
      left join venta v on v.id = f.venta_id
      where f.tienda_id = $1
      order by f.fecha_emision desc nulls last, f.created_at desc
      limit $2
    `,
    [session.storeId, limit],
  )

  return {
    facturas: result.rows.map(row => ({
      ...row,
      venta_numero: visibleCashSaleNumber(row.venta_numero) ?? null,
      razon_social_cliente: decryptSecret(row.razon_social_cliente),
      numero_documento_cliente: decryptSecret(row.numero_documento_cliente),
    })),
  }
})
