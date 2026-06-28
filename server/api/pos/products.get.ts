import { requireSession } from '../../utils/session'
import { ensureDatabase, pool } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  await ensureDatabase()

  if (!session.storeId) {
    return { products: [] }
  }

  const result = await pool.query(
    `
      select
        p.id,
        p.nombre as name,
        c.nombre as category,
        p.precio_venta::float as price,
        p.stock_actual::float as stock,
        p.tipo as kind,
        p.imagen_url as "imageUrl"
      from producto p
      left join categoria c on c.id = p.categoria_id
      where p.tienda_id = $1
        and p.visible_pos = true
        and p.activo = true
      order by p.orden_catalogo asc, p.nombre asc
    `,
    [session.storeId],
  )

  return { products: result.rows }
})
