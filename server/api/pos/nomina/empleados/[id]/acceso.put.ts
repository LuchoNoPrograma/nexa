import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../../utils/db'
import { requireStoreAccess } from '../../../../../utils/posCatalog'
import { hashPassword } from '../../../../../utils/password'
import { tieneAcceso } from '~~/shared/utils/acceso'

type AccesoBody = {
  rol?: string | null
  ci?: string
  password?: string
}

// Roles de tienda que el módulo de planilla puede asignar a un empleado.
const ROLES_ASIGNABLES = ['cajero', 'administrador'] as const

// Gestiona el acceso (login + rol) de un empleado. Al asignar un rol crea o
// reutiliza un usuario que inicia sesión con su CI; sin rol, le quita el acceso
// a la tienda. Solo quien gestiona configuración de la tienda puede usarlo.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')

  if (!tieneAcceso('CONFIG', { roles: session.roles, permisos: session.permisos })) {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado para gestionar accesos.' })
  }

  const id = getRouterParam(event, 'id')
  const body = await readBody<AccesoBody>(event)
  await ensureDatabase()

  const rol = (body?.rol ?? '').trim().toLowerCase()
  const ci = body?.ci?.trim() || null
  const password = body?.password ?? ''

  const empleadoRes = await pool.query<{ usuario_id: string | null; nombre: string }>(
    `select usuario_id, nombre from empleado where id = $1 and tienda_id = $2 and activo = true`,
    [id, session.storeId],
  )
  const empleado = empleadoRes.rows[0]

  if (!empleado) {
    throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    // Sin rol: se le retira el acceso a la tienda (se conserva el usuario por si
    // luego se le vuelve a dar acceso, pero queda suspendido y sin rol).
    if (!rol) {
      if (empleado.usuario_id) {
        await client.query(
          `delete from usuario_rol where usuario_id = $1 and tienda_id = $2`,
          [empleado.usuario_id, session.storeId],
        )
        await client.query(
          `update tienda_usuario set estado = 'suspendido', updated_at = now()
           where usuario_id = $1 and tienda_id = $2`,
          [empleado.usuario_id, session.storeId],
        )
      }

      await client.query('commit')
      return { rol: null, ci: null, tieneLogin: false }
    }

    if (!ROLES_ASIGNABLES.includes(rol as typeof ROLES_ASIGNABLES[number])) {
      throw createError({ statusCode: 400, statusMessage: 'Rol no válido.' })
    }

    const rolRes = await client.query<{ id: string }>(
      `select id from rol where alcance = 'tienda' and codigo = $1 and tienda_id is null and activo = true limit 1`,
      [rol],
    )
    const rolId = rolRes.rows[0]?.id

    if (!rolId) {
      throw createError({ statusCode: 400, statusMessage: 'No existe el rol solicitado.' })
    }

    let usuarioId = empleado.usuario_id

    if (!usuarioId) {
      // Alta de usuario para el empleado: CI + contraseña son obligatorios.
      if (!ci) {
        throw createError({ statusCode: 400, statusMessage: 'El CI es obligatorio para crear el acceso.' })
      }
      if (password.length < 4) {
        throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener al menos 4 caracteres.' })
      }

      const passwordHash = await hashPassword(password)
      const nuevoUsuario = await client.query<{ id: string }>(
        `insert into usuario (ci, nombre, password_hash, estado)
         values ($1, $2, $3, 'activo')
         returning id`,
        [ci, empleado.nombre, passwordHash],
      )
      usuarioId = nuevoUsuario.rows[0]!.id

      await client.query(
        `update empleado set usuario_id = $1, updated_at = now() where id = $2`,
        [usuarioId, id],
      )
    } else {
      // Usuario existente: se actualizan CI/contraseña solo si se enviaron.
      if (ci) {
        await client.query(`update usuario set ci = $1, updated_at = now() where id = $2`, [ci, usuarioId])
      }
      if (password) {
        if (password.length < 4) {
          throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener al menos 4 caracteres.' })
        }
        await client.query(
          `update usuario set password_hash = $1, updated_at = now() where id = $2`,
          [await hashPassword(password), usuarioId],
        )
      }
    }

    // Membresía activa en la tienda.
    await client.query(
      `insert into tienda_usuario (tienda_id, usuario_id, cargo, estado, joined_at)
       values ($1, $2, $3, 'activo', now())
       on conflict (tienda_id, usuario_id) do update set
         cargo = excluded.cargo,
         estado = 'activo',
         joined_at = coalesce(tienda_usuario.joined_at, now()),
         updated_at = now()`,
      [session.storeId, usuarioId, rol],
    )

    // Un solo rol de tienda por empleado: se reemplaza el anterior.
    await client.query(`delete from usuario_rol where usuario_id = $1 and tienda_id = $2`, [usuarioId, session.storeId])
    await client.query(
      `insert into usuario_rol (usuario_id, rol_id, tienda_id, asignado_por_id)
       values ($1, $2, $3, $4)`,
      [usuarioId, rolId, session.storeId, session.id],
    )

    await client.query('commit')

    const ciRes = await pool.query<{ ci: string | null }>(`select ci from usuario where id = $1`, [usuarioId])

    return { rol, ci: ciRes.rows[0]?.ci ?? null, tieneLogin: true }
  } catch (error) {
    await client.query('rollback')

    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Ya existe un usuario con ese CI.' })
    }

    throw error
  } finally {
    client.release()
  }
})
