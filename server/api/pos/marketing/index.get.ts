import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreSession } from '../../../utils/posCatalog'
import type { MarketingPublicacion } from '~~/shared/utils/marketing'

// Lectura del módulo de Marketing. NO consume IA: solo devuelve la publicación
// sugerida ya guardada (si existe) y el conteo de productos disponibles para
// generar contenido. La IA se invoca aparte, al pulsar "generar".
export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const [actualResult, publicadasResult, productosResult] = await Promise.all([
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
  ])

  return {
    actual: actualResult.rows[0] ?? null,
    publicadas: publicadasResult.rows[0]?.total ?? 0,
    totalProductos: productosResult.rows[0]?.total ?? 0,
  }
})
