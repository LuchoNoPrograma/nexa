import { readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, ensureCategoryName, mapUniqueConstraint, nullableText, requireStoreAccess } from '../../../utils/posCatalog'

type CategoryBody = {
  name?: string
  description?: string | null
  icon?: string | null
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'producto.gestionar')
  await ensureDatabase()

  const body = await readBody<CategoryBody>(event)
  const name = ensureCategoryName(body.name)

  try {
    const result = await pool.query(
      `
        insert into categoria (tienda_id, nombre, descripcion, icono, activo)
        values ($1, $2, $3, $4, true)
        on conflict (tienda_id, nombre) do update
        set
          descripcion = excluded.descripcion,
          icono = excluded.icono,
          activo = true,
          updated_at = now()
        returning
          id,
          nombre as name,
          descripcion as description,
          icono as icon,
          activo as active,
          0::int as "productCount"
      `,
      [session.storeId, name, nullableText(body.description), cleanText(body.icon, 'pi pi-box') || 'pi pi-box'],
    )

    return { category: result.rows[0] }
  } catch (error) {
    mapUniqueConstraint(error)
  }
})
