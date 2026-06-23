import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, nullableText, numberOrZero, requireStoreAccess } from '../../../utils/posCatalog'
import { CATEGORIAS_INGRESO } from '~~/shared/utils/finanzas'

const metodos = ['efectivo', 'qr', 'transferencia', 'tarjeta', 'otro'] as const

type IngresoBody = {
  categoria?: string
  concepto?: string
  monto?: number
  metodo?: string
  fecha?: string | null
  notas?: string | null
}

// Registrar un ingreso que NO es venta de productos (reembolso, aporte, interés…).
// Persiste en caja_movimiento como ingreso CONFIRMADO para que Finanzas lo tome de
// inmediato como "otro ingreso". Las ventas reales se registran desde el POS, no aquí.
// No exige caja abierta: un ingreso puntual no depende de que el POS esté abierto.
export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'caja.movimiento.crear')
  await ensureDatabase()

  const body = await readBody<IngresoBody>(event)
  const concepto = cleanText(body.concepto)
  const monto = numberOrZero(body.monto)

  if (!concepto) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe de qué es el ingreso.' })
  }
  if (monto <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'El monto debe ser mayor a cero.' })
  }

  // La venta tiene su propio flujo (POS); aquí solo se aceptan otros ingresos.
  const categoria = CATEGORIAS_INGRESO.some((c) => c.value === body.categoria && c.value !== 'venta')
    ? (body.categoria as string)
    : 'otro_ingreso'
  const metodo = metodos.includes(body.metodo as typeof metodos[number]) ? body.metodo : 'efectivo'
  const fecha = nullableText(body.fecha)

  const result = await pool.query<{ id: string }>(
    `
      insert into caja_movimiento (
        tienda_id, usuario_id, tipo, categoria, concepto, metodo, monto, estado, fecha, notas
      )
      values ($1, $2, 'ingreso', $3, $4, $5, $6, 'confirmado', coalesce($7::timestamptz, now()), $8)
      returning id
    `,
    [session.storeId, session.id, categoria, concepto, metodo, monto, fecha, nullableText(body.notas)],
  )

  return { id: result.rows[0]?.id }
})
