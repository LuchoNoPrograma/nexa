import { ensureDatabase, pool } from '../../../utils/db'
import { requireFacturacionConfig } from '../../../utils/facturacionStore'
import { requireStoreAccess } from '../../../utils/posCatalog'
import { operacionesSincronizacion, sincronizarCatalogo } from '../../../utils/siat'

// Descarga los catalogos parametricos del SIAT (leyendas, actividades,
// productos SIN, metodos de pago, etc.) y los guarda por tienda.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()

  const config = await requireFacturacionConfig(pool, session.storeId)
  const resultados: Record<string, number | string> = {}

  for (const tipo of operacionesSincronizacion()) {
    if (tipo === 'fecha_hora') {
      continue
    }

    try {
      const respuesta = await sincronizarCatalogo(config, tipo)

      await pool.query(
        `
          insert into facturacion_catalogo (tienda_id, tipo, datos, sincronizado_at)
          values ($1, $2, $3::jsonb, now())
          on conflict (tienda_id, tipo) do update
          set datos = excluded.datos, sincronizado_at = now()
        `,
        [session.storeId, tipo, JSON.stringify(respuesta.items)],
      )

      resultados[tipo] = respuesta.items.length
    }
    catch (error) {
      resultados[tipo] = error instanceof Error ? error.message : 'error'
    }
  }

  return { ok: true, resultados }
})
