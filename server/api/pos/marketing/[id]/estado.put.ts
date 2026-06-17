import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { requireStoreAccess } from '../../../../utils/posCatalog'

type EstadoBody = {
  estado?: string
}

const ESTADOS_VALIDOS = ['sugerida', 'publicada', 'descartada'] as const

// Cambia el estado de una publicación: marcarla como publicada (cuando el usuario
// la comparte) o descartarla. No consume IA.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'haru.usar')
  await ensureDatabase()

  const id = getRouterParam(event, 'id')
  const body = await readBody<EstadoBody | null>(event)
  const estado = String(body?.estado ?? '')

  if (!ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Estado no válido.' })
  }

  const result = await pool.query(
    `
      update marketing_publicacion
      set
        estado = $3,
        publicado_at = case when $3 = 'publicada' then now() else publicado_at end,
        updated_at = now()
      where id = $1 and tienda_id = $2
      returning id
    `,
    [id, session.storeId, estado],
  )

  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: 'Publicación no encontrada.' })
  }

  return { ok: true }
})
