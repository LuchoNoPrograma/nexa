import { ensureDatabase, pool } from '../../utils/db'
import { requireStoreAccess } from '../../utils/posCatalog'

type DiagnosticoRow = {
  id: string
  saludGeneral: number | null
  nivel: string | null
  scoreVentas: number | null
  scoreFinanzas: number | null
  scoreMarketing: number | null
  scoreInventario: number | null
  rubro: string | null
  canalPrincipal: string | null
  problemaPrincipal: string | null
  resultado: Record<string, unknown>
  completadoAt: string | null
  createdAt: string
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()

  const result = await pool.query<DiagnosticoRow>(
    `
      select
        id,
        salud_general as "saludGeneral",
        nivel,
        score_ventas as "scoreVentas",
        score_finanzas as "scoreFinanzas",
        score_marketing as "scoreMarketing",
        score_inventario as "scoreInventario",
        rubro,
        canal_venta_principal as "canalPrincipal",
        problema_principal as "problemaPrincipal",
        resultado,
        completado_at as "completadoAt",
        created_at as "createdAt"
      from diagnostico
      where tienda_id = $1 and completado_at is not null
      order by created_at desc
      limit 1
    `,
    [session.storeId],
  )

  return {
    estado: session.onboardingDiagnostico ?? 'pendiente',
    diagnostico: result.rows[0] ?? null,
  }
})
