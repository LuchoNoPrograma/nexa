import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const result = await pool.query(
    `
      select
        p.id,
        p.categoria_id as "categoryId",
        c.nombre as "categoryName",
        p.sku,
        p.codigo_barras as barcode,
        p.nombre as name,
        p.descripcion as description,
        p.tipo as kind,
        coalesce(p.tipo_costeo, case when p.tipo = 'servicio' then 'servicio' when p.tipo = 'combo' then 'produccion' else 'reventa' end) as "costingType",
        p.unidad as unit,
        p.costo_unitario::float as cost,
        p.precio_venta::float as price,
        p.stock_actual::float as stock,
        p.stock_minimo::float as "minStock",
        p.stock_maximo::float as "maxStock",
        p.margen_minimo::float as "minMargin",
        p.imagen_url as "imageUrl",
        p.icono as icon,
        p.visible_pos as "visiblePos",
        p.updated_at as "updatedAt",
        coalesce(v.variants, '[]'::json) as variants
      from producto p
      left join categoria c on c.id = p.categoria_id and c.tienda_id = p.tienda_id
      left join lateral (
        select json_agg(
          json_build_object(
            'id', pv.id,
            'name', pv.nombre,
            'sku', pv.sku,
            'barcode', pv.codigo_barras,
            'cost', pv.costo_unitario::float,
            'price', pv.precio_venta::float,
            'stock', pv.stock_actual::float
          )
          order by pv.orden asc, pv.nombre asc
        ) as variants
        from producto_variante pv
        where pv.producto_id = p.id and pv.activo = true
      ) v on true
      where p.tienda_id = $1
        and p.activo = true
      order by p.orden_catalogo asc, p.nombre asc
    `,
    [session.storeId],
  )

  return { products: result.rows }
})
