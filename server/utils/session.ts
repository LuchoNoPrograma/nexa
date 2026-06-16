import { createError, getCookie } from 'h3'
import { ensureDatabase, pool } from './db'
import { hashSessionToken } from './password'

export type CurrentSession = {
  id: string
  email: string
  name: string
  role: string
  store: string
  storeId: string | null
  defaultMargin: number | null
  onboardingDiagnostico: 'pendiente' | 'completado' | 'omitido' | null
  roles: string[]
  permisos: string[]
}

export async function getCurrentSession(event: Parameters<typeof getCookie>[0]): Promise<CurrentSession | null> {
  await ensureDatabase()

  const token = getCookie(event, 'nexa_session_token')

  if (!token) {
    return null
  }

  const tokenHash = hashSessionToken(token)

  const result = await pool.query<CurrentSession>(
    `
      select
        u.id,
        u.email,
        u.nombre as "name",
        coalesce(platform_role.codigo, store_role.codigo, 'usuario') as "role",
        coalesce(t.nombre, 'Plataforma') as "store",
        t.id as "storeId",
        t.margen_default::float as "defaultMargin",
        t.onboarding_diagnostico as "onboardingDiagnostico"
      from sesion s
      join usuario u on u.id = s.usuario_id
      left join usuario_rol platform_user_role on platform_user_role.usuario_id = u.id and platform_user_role.tienda_id is null
      left join rol platform_role on platform_role.id = platform_user_role.rol_id and platform_role.alcance = 'plataforma'
      left join tienda_usuario tu on tu.usuario_id = u.id and tu.estado = 'activo'
      left join tienda t on t.id = tu.tienda_id and t.activo = true
      left join usuario_rol store_user_role on store_user_role.usuario_id = u.id and store_user_role.tienda_id = t.id
      left join rol store_role on store_role.id = store_user_role.rol_id and store_role.alcance = 'tienda'
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and u.estado = 'activo'
      order by platform_role.codigo = 'super_admin' desc, t.created_at asc
      limit 1
    `,
    [tokenHash],
  )

  const session = result.rows[0] ?? null

  if (!session) {
    return null
  }

  await pool.query('update sesion set last_seen_at = now() where token_hash = $1', [tokenHash])

  // Roles y permisos efectivos: a nivel plataforma (tienda_id null) y de la
  // tienda activa. Alimentan el helper `tieneAcceso` en app y server.
  const accesoResult = await pool.query<{ roles: string[]; permisos: string[] }>(
    `
      select
        coalesce(array_agg(distinct r.codigo) filter (where r.codigo is not null), '{}') as roles,
        coalesce(array_agg(distinct p.codigo) filter (where p.codigo is not null), '{}') as permisos
      from usuario_rol ur
      join rol r on r.id = ur.rol_id and r.activo = true
      left join rol_permiso rp on rp.rol_id = r.id
      left join permiso p on p.id = rp.permiso_id and p.activo = true
      where ur.usuario_id = $1
        and (
          (r.alcance = 'plataforma' and ur.tienda_id is null)
          or (r.alcance = 'tienda' and ur.tienda_id = $2)
        )
    `,
    [session.id, session.storeId],
  )

  session.roles = accesoResult.rows[0]?.roles ?? []
  session.permisos = accesoResult.rows[0]?.permisos ?? []

  return session
}

export async function requireSession(event: Parameters<typeof getCookie>[0]) {
  const session = await getCurrentSession(event)

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  return session
}

export async function requireSuperAdmin(event: Parameters<typeof getCookie>[0]) {
  const session = await requireSession(event)

  if (session.role !== 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' })
  }

  return session
}
