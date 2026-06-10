import { ensureDatabase, pool } from '../../utils/db'
import { requireSuperAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  await ensureDatabase()

  const result = await pool.query(
    `
      select
        id,
        nombre as name,
        telefono as phone,
        rubro as business,
        mensaje as message,
        canal as channel,
        estado as status,
        created_at as "createdAt",
        updated_at as "updatedAt"
      from contacto_mensaje
      order by created_at desc
      limit 100
    `,
  )

  return { messages: result.rows }
})
