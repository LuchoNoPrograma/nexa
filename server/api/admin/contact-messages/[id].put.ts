import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireSuperAdmin } from '../../../utils/session'

type ContactMessageUpdateBody = {
  status?: string
}

const allowedStatuses = ['nuevo', 'contactado', 'cerrado'] as const

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  await ensureDatabase()

  const id = getRouterParam(event, 'id')
  const body = await readBody<ContactMessageUpdateBody>(event)
  const status = body.status?.trim()

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Consulta no valida.' })
  }

  if (!allowedStatuses.includes(status as typeof allowedStatuses[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Estado no valido.' })
  }

  const result = await pool.query(
    `
      update contacto_mensaje
      set estado = $2,
          updated_at = now()
      where id = $1
      returning
        id,
        nombre as name,
        telefono as phone,
        rubro as business,
        mensaje as message,
        canal as channel,
        estado as status,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [id, status],
  )

  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: 'Consulta no encontrada.' })
  }

  return { message: result.rows[0] }
})
