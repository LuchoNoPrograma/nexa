import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, nullableText, numberOrZero, requireStoreAccess } from '../../../utils/posCatalog'
import { CATEGORIAS_EGRESO } from '~~/shared/utils/finanzas'

const metodos = ['efectivo', 'qr', 'transferencia', 'tarjeta', 'otro'] as const

type GastoBody = {
  categoria?: string
  concepto?: string
  monto?: number
  metodo?: string
  fecha?: string | null
  notas?: string | null
}

// Registrar un gasto. Persiste en caja_movimiento como egreso CONFIRMADO con su
// categoría contable (alquiler, luz, sueldos…), para que la cascada de Finanzas
// lo tome de inmediato. No exige caja abierta: un gasto fijo (alquiler) no depende
// de que el POS esté abierto.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'caja.movimiento.crear')
  await ensureDatabase()

  const body = await readBody<GastoBody>(event)
  const concepto = cleanText(body.concepto)
  const monto = numberOrZero(body.monto)

  if (!concepto) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe en qué fue el gasto.' })
  }
  if (monto <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'El monto debe ser mayor a cero.' })
  }

  // La categoría debe pertenecer a la taxonomía conocida (cae a 'otros_gastos').
  const categoria = CATEGORIAS_EGRESO.some((c) => c.value === body.categoria)
    ? (body.categoria as string)
    : 'otros_gastos'
  const metodo = metodos.includes(body.metodo as typeof metodos[number]) ? body.metodo : 'efectivo'
  const fecha = nullableText(body.fecha)

  const result = await pool.query<{ id: string }>(
    `
      insert into caja_movimiento (
        tienda_id, usuario_id, tipo, categoria, concepto, metodo, monto, estado, fecha, notas
      )
      values ($1, $2, 'egreso', $3, $4, $5, $6, 'confirmado', coalesce($7::timestamptz, now()), $8)
      returning id
    `,
    [session.storeId, session.id, categoria, concepto, metodo, monto, fecha, nullableText(body.notas)],
  )

  return { id: result.rows[0]?.id }
})
