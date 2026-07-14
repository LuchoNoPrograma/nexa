import { ensureDatabase, pool } from '../../utils/db'
import { requireSuperAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireSuperAdmin(event)
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
        coalesce((
          select string_agg(distinct t.nombre, ', ' order by t.nombre)
          from tienda_usuario tu
          join tienda t on t.id = tu.tienda_id
          where tu.usuario_id = u.id
        ), 'Plataforma') as store,
        coalesce((
          select r.codigo
          from usuario_rol ur
          join rol r on r.id = ur.rol_id
          where ur.usuario_id = u.id
          order by
            case r.codigo
              when 'super_admin' then 1
              when 'propietario' then 2
              when 'administrador' then 3
              when 'cajero' then 4
              else 5
            end,
            r.codigo
          limit 1
        ), 'usuario') as role,
        u.estado as status,
        (u.password_hash is not null) as "hasPassword",
        (u.oauth_provider = 'google' and u.oauth_sub is not null) as "hasGoogle",
        u.created_at as "createdAt",
        u.ultimo_acceso_at as "lastAccessAt",
        (
          select count(*)::integer
          from sesion s
          where s.usuario_id = u.id
            and s.revoked_at is null
            and s.expires_at > now()
        ) as "activeSessions",
        (u.id = $1) as "isCurrentUser"
      from usuario u
      order by u.created_at desc
    `,
    [session.id],
  )

  return { users: result.rows }
})
