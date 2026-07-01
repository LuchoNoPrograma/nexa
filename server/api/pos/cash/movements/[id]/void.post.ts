import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../../utils/db'
import { cleanText, requireStoreSession } from '../../../../../utils/posCatalog'
import { getCashOverview } from '../../../../../utils/posCash'

type VoidMovementBody = {
  reason?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const movementId = cleanText(getRouterParam(event, 'id'))
  const body = await readBody<VoidMovementBody>(event)
  const reason = cleanText(body.reason)

  if (!movementId) {
    throw createError({ statusCode: 400, statusMessage: 'Movimiento inválido.' })
  }

  if (reason.length < 4) {
    throw createError({ statusCode: 400, statusMessage: 'Indica el motivo de la anulación.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    const result = await client.query<{
      status: string
      saleId: string | null
      cashSessionStatus: string | null
      ownerId: string | null
    }>(
      `
        select
          cm.estado as status,
          cm.venta_id as "saleId",
          cs.estado as "cashSessionStatus",
          t.owner_id as "ownerId"
        from caja_movimiento cm
        join tienda t on t.id = cm.tienda_id
        left join caja_sesion cs on cs.id = cm.caja_sesion_id
        where cm.id = $1
          and cm.tienda_id = $2
        for update of cm
      `,
      [movementId, session.storeId],
    )

    const movement = result.rows[0]

    if (!movement) {
      throw createError({ statusCode: 404, statusMessage: 'Movimiento no encontrado.' })
    }

    if (movement.ownerId !== session.id) {
      throw createError({ statusCode: 403, statusMessage: 'Solo el dueño de la tienda puede anular movimientos.' })
    }

    if (movement.saleId) {
      throw createError({ statusCode: 409, statusMessage: 'Las ventas deben anularse desde su propia acción.' })
    }

    if (movement.status === 'anulado') {
      throw createError({ statusCode: 409, statusMessage: 'Este movimiento ya fue anulado.' })
    }

    if (movement.cashSessionStatus !== 'abierta') {
      throw createError({ statusCode: 409, statusMessage: 'No se puede anular un movimiento de una caja cerrada.' })
    }

    await client.query(
      `
        update caja_movimiento
        set
          estado = 'anulado',
          notas = concat_ws(E'\n', nullif(notas, ''), $3),
          updated_at = now()
        where id = $1
          and tienda_id = $2
      `,
      [movementId, session.storeId, `Anulación: ${reason}`],
    )

    const overview = await getCashOverview(client, session.storeId)
    await client.query('commit')

    return overview
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
