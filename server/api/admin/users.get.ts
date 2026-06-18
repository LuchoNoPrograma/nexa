import { ensureDatabase, pool } from '../../utils/db'
import { requireSuperAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  await ensureDatabase()

  const result = await pool.query(
    `
      select
        u.id,
        u.nombre as name,
        u.email,
        u.ci,
        u.telefono as phone,
        coalesce(u.email, u.ci, u.telefono, 'Sin identificador') as access,
        coalesce(string_agg(distinct t.nombre, ', ') filter (where t.id is not null), 'Plataforma') as store,
        coalesce(platform_role.codigo, max(store_role.codigo), 'usuario') as role,
        u.estado as status
      from usuario u
      left join usuario_rol platform_user_role on platform_user_role.usuario_id = u.id and platform_user_role.tienda_id is null
      left join rol platform_role on platform_role.id = platform_user_role.rol_id and platform_role.alcance = 'plataforma'
      left join tienda_usuario tu on tu.usuario_id = u.id
      left join tienda t on t.id = tu.tienda_id
      left join usuario_rol store_user_role on store_user_role.usuario_id = u.id and store_user_role.tienda_id = t.id
      left join rol store_role on store_role.id = store_user_role.rol_id and store_role.alcance = 'tienda'
      group by u.id, platform_role.codigo
      order by u.created_at asc
    `,
  )

  return { users: result.rows }
})
