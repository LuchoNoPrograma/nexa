import { createError, getRouterParam, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../../utils/db'
import { booleanOrDefault, cleanText, ensureCategoryName, mapUniqueConstraint, nullableText, requireStoreAccess } from '../../../../utils/posCatalog'

type CategoryBody = {
  name?: string
  description?: string | null
  icon?: string | null
  active?: boolean
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'producto.gestionar')
  await ensureDatabase()

  const categoryId = getRouterParam(event, 'id')
  const body = await readBody<CategoryBody>(event)
  const name = ensureCategoryName(body.name)

  try {
    const result = await pool.query(
      `
        update categoria
        set
          nombre = $3,
          descripcion = $4,
          icono = $5,
          activo = $6,
          updated_at = now()
        where id = $1
          and tienda_id = $2
        returning id
      `,
      [
        categoryId,
        session.storeId,
        name,
        nullableText(body.description),
        cleanText(body.icon, 'pi pi-box') || 'pi pi-box',
        booleanOrDefault(body.active, true),
      ],
    )

    if (!result.rowCount) {
      throw createError({ statusCode: 404, statusMessage: 'Categoria no encontrada en esta tienda.' })
    }

    return { id: result.rows[0].id }
  } catch (error) {
    mapUniqueConstraint(error)
  }
})
