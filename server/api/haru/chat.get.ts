import { ensureDatabase, pool } from '../../utils/db'
import { requireSession } from '../../utils/session'

type HaruMessageRow = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  await ensureDatabase()

  if (!session.storeId) {
    return {
      conversationId: null,
      messages: [],
    }
  }

  const conversation = await pool.query<{ id: string }>(
    `
      select id
      from haru_conversacion
      where tienda_id = $1
        and usuario_id = $2
        and estado = 'abierta'
      order by last_message_at desc nulls last, created_at desc
      limit 1
    `,
    [session.storeId, session.id],
  )

  const conversationId = conversation.rows[0]?.id ?? null

  if (!conversationId) {
    return {
      conversationId: null,
      messages: [],
    }
  }

  const messages = await pool.query<HaruMessageRow>(
    `
      select
        id,
        rol as role,
        contenido as content
      from haru_mensaje
      where conversacion_id = $1
        and rol in ('user', 'assistant')
        and coalesce(metadata->>'finishReason', '') <> 'MAX_TOKENS'
      order by created_at asc
    `,
    [conversationId],
  )

  return {
    conversationId,
    messages: messages.rows,
  }
})
