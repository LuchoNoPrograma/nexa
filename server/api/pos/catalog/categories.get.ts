import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const result = await pool.query(
    `
      select
        c.id,
        c.nombre as name,
        c.descripcion as description,
        c.icono as icon,
        c.activo as active,
        count(p.id)::int as "productCount"
      from categoria c
      left join producto p on p.categoria_id = c.id and p.activo = true
      where c.tienda_id = $1
      group by c.id
      order by c.orden asc, c.nombre asc
    `,
    [session.storeId],
  )

  return { categories: result.rows }
})
