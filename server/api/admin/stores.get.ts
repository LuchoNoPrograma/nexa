import { ensureDatabase, pool } from '../../utils/db'
import { requireSuperAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  await ensureDatabase()

  const result = await pool.query(
    `
      select
        t.id,
        t.nombre as name,
        coalesce(owner.nombre, 'Sin propietario') as owner,
        t.plan,
        case when t.activo then 'activa' else 'suspendida' end as status,
        t.ciudad as city,
        count(tu.usuario_id)::int as users
      from tienda t
      left join usuario owner on owner.id = t.owner_id
      left join tienda_usuario tu on tu.tienda_id = t.id and tu.estado = 'activo'
      group by t.id, owner.nombre
      order by t.created_at asc
    `,
  )

  return { stores: result.rows }
})
