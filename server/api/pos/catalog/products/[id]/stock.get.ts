import { createError, getRouterParam } from 'h3'
import { ensureDatabase, pool } from '../../../../../utils/db'
import { requireStoreSession } from '../../../../../utils/posCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const productId = getRouterParam(event, 'id')

  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'Producto requerido.' })
  }

  const productResult = await pool.query(
    `
      select 1
      from producto
      where id = $1
        and tienda_id = $2
      limit 1
    `,
    [productId, session.storeId],
  )

  if (!productResult.rowCount) {
    throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado en esta tienda.' })
  }

  const result = await pool.query(
    `
      select
        im.id,
        im.tipo as type,
        im.origen as origin,
        im.cantidad::float as quantity,
        im.stock_anterior::float as "previousStock",
        im.stock_nuevo::float as "newStock",
        im.costo_unitario::float as cost,
        im.notas as notes,
        im.created_at as "createdAt",
        pv.nombre as "variantName",
        u.nombre as "userName"
      from inventario_movimiento im
      left join producto_variante pv on pv.id = im.producto_variante_id
      left join usuario u on u.id = im.usuario_id
      where im.tienda_id = $1
        and im.producto_id = $2
      order by im.created_at desc
      limit 80
    `,
    [session.storeId, productId],
  )

  return { movements: result.rows }
})
