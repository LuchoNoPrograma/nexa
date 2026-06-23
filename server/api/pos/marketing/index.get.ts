import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'
import type { MarketingPublicacion } from '~~/shared/utils/marketing'

// Lectura del módulo de Marketing. NO consume IA: solo devuelve la publicación
// sugerida ya guardada (si existe) y el conteo de productos disponibles para
// generar contenido. La IA se invoca aparte, al pulsar "generar".
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const [
    actualResult,
    publicadasResult,
    productosResult,
    configResult,
    publicadasSemanaResult,
    bajoMovimientoResult,
    sinImagenResult,
  ] = await Promise.all([
    pool.query<MarketingPublicacion>(
      `
        select
          id,
          producto_id as "productoId",
          producto_nombre as "productoNombre",
          titulo,
          texto,
          coalesce(hashtags, '[]'::jsonb) as hashtags,
          idea_video as "ideaVideo",
          mejor_hora as "mejorHora",
          audiencia,
          objetivo,
          impacto,
          imagen_url as "imagenUrl",
          estado,
          publicado_at as "publicadoAt",
          created_at as "createdAt"
        from marketing_publicacion
        where tienda_id = $1 and estado = 'sugerida'
        order by created_at desc
        limit 1
      `,
      [session.storeId],
    ),
    pool.query<{ total: number }>(
      `
        select count(*)::int as total
        from marketing_publicacion
        where tienda_id = $1 and estado = 'publicada'
      `,
      [session.storeId],
    ),
    pool.query<{ total: number }>(
      `
        select count(*)::int as total
        from producto
        where tienda_id = $1 and activo = true
      `,
      [session.storeId],
    ),
    pool.query<{
      contacto: string | null
      ubicacion: string | null
      ciudad: string
      departamento: string
      confirmado: boolean
    }>(
      `
        select
          telefono_whatsapp as contacto,
          direccion_publica as ubicacion,
          ciudad,
          departamento,
          marketing_contacto_confirmado as confirmado
        from tienda
        where id = $1
        limit 1
      `,
      [session.storeId],
    ),
    // Publicaciones compartidas en los últimos 7 días: define el ritmo sugerido.
    pool.query<{ total: number }>(
      `
        select count(*)::int as total
        from marketing_publicacion
        where tienda_id = $1
          and estado = 'publicada'
          and publicado_at >= now() - interval '7 days'
      `,
      [session.storeId],
    ),
    // Productos activos con stock que no se vendieron en los últimos 30 días:
    // candidatos a oferta para liberar inventario parado.
    pool.query<{ total: number }>(
      `
        select count(*)::int as total
        from producto p
        where p.tienda_id = $1
          and p.activo = true
          and p.tipo = 'producto'
          and p.stock_actual > 0
          and not exists (
            select 1
            from venta_item vi
            join venta v on v.id = vi.venta_id
            where vi.producto_id = p.id
              and v.tienda_id = p.tienda_id
              and v.estado <> 'anulada'
              and v.fecha >= now() - interval '30 days'
          )
      `,
      [session.storeId],
    ),
    // Productos activos sin imagen: las publicaciones con foto rinden más.
    pool.query<{ total: number }>(
      `
        select count(*)::int as total
        from producto
        where tienda_id = $1
          and activo = true
          and (imagen_url is null or imagen_url = '')
      `,
      [session.storeId],
    ),
  ])

  return {
    actual: actualResult.rows[0] ?? null,
    publicadas: publicadasResult.rows[0]?.total ?? 0,
    totalProductos: productosResult.rows[0]?.total ?? 0,
    marketingConfig: configResult.rows[0] ?? {
      contacto: null,
      ubicacion: null,
      ciudad: 'Cobija',
      departamento: 'Pando',
      confirmado: false,
    },
    // Datos para el motor de recomendaciones (cliente). Cálculo barato en SQL.
    recoData: {
      publicadasEstaSemana: publicadasSemanaResult.rows[0]?.total ?? 0,
      productosBajoMovimiento: bajoMovimientoResult.rows[0]?.total ?? 0,
      productosSinImagen: sinImagenResult.rows[0]?.total ?? 0,
    },
  }
})
