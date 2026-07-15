import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { cleanText, numberOrZero, requireStoreAccess } from '../../utils/posCatalog'
import { getCashOverview, requireOpenCashSession } from '../../utils/posCash'
import { tieneAcceso } from '~~/shared/utils/acceso'

type SaleItemBody = {
  id?: string
  name?: string
  quantity?: number
  price?: number
}

type PaymentLineBody = {
  label?: string
  amount?: number
}

type SaleBody = {
  clientOperationId?: string
  occurredAt?: string
  number?: string
  subtotal?: number
  discount?: number
  total?: number
  items?: SaleItemBody[]
  paymentLines?: PaymentLineBody[]
}

const MAX_SALE_ITEMS = 100
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const MAX_OFFLINE_AGE_MS = 365 * 24 * 60 * 60 * 1000

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function sameMoney(left: number, right: number) {
  return Math.abs(roundMoney(left) - roundMoney(right)) < 0.01
}

function saleOccurredAt(value: unknown, clientOperationId: string) {
  const explicitTime = typeof value === 'string' ? Date.parse(value) : Number.NaN
  const operationTime = Number(clientOperationId.match(/^OFF-[^-]+-(\d{13})-/)?.[1] ?? Number.NaN)
  const timestamp = Number.isFinite(explicitTime) ? explicitTime : operationTime
  const now = Date.now()

  if (!Number.isFinite(timestamp) || timestamp > now + MAX_CLOCK_SKEW_MS || timestamp < now - MAX_OFFLINE_AGE_MS) {
    return new Date()
  }

  return new Date(timestamp)
}

function dbPaymentMethod(label: unknown) {
  const normalized = cleanText(label).toLowerCase()

  if (normalized.includes('qr') || normalized.includes('transferencia')) {
    return 'qr'
  }

  return 'efectivo'
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'pos.vender')
  await ensureDatabase()

  const body = await readBody<SaleBody>(event)
  const items = Array.isArray(body.items) ? body.items : []
  const paymentLines = Array.isArray(body.paymentLines) ? body.paymentLines : []

  if (!items.length || items.length > MAX_SALE_ITEMS) {
    throw createError({ statusCode: 400, statusMessage: 'Agrega productos para vender.' })
  }

  const clientOperationId = cleanText(body.clientOperationId)
  if (!clientOperationId || clientOperationId.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'La venta no tiene un identificador de operacion valido.' })
  }
  const occurredAt = saleOccurredAt(body.occurredAt, clientOperationId)

  const client = await pool.connect()

  try {
    await client.query('begin')

    const existingSale = await client.query<{ id: string, number: string | null }>(
      `
        select id, numero as number
        from venta
        where tienda_id = $1
          and client_operation_id = $2
        limit 1
      `,
      [session.storeId, clientOperationId],
    )

    if (existingSale.rowCount) {
      const overview = await getCashOverview(client, session.storeId)
      await client.query('commit')
      return { ...overview, saleId: existingSale.rows[0].id, saleNumber: existingSale.rows[0].number }
    }

    const cashSessionId = await requireOpenCashSession(client, session.storeId)

    // Serializa la numeracion dentro de la caja para evitar que dos cobros
    // simultaneos calculen el mismo count(*) + 1.
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [cashSessionId])

    const saleCodeResult = await client.query<{ sequence: number; saleTime: string }>(
      `
        select
          (count(*) + 1)::int as sequence,
          to_char($3::timestamptz at time zone 'America/La_Paz', 'HH24:MI') as "saleTime"
        from venta
        where tienda_id = $1
          and caja_sesion_id = $2
          and estado <> 'anulada'
      `,
      [session.storeId, cashSessionId, occurredAt],
    )
    const saleSequence = saleCodeResult.rows[0]?.sequence ?? 1
    const saleTime = saleCodeResult.rows[0]?.saleTime ?? new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
    const cashSaleCode = `C${saleSequence} ${saleTime}`
    const saleNumber = `C${saleSequence}-${cashSessionId.slice(0, 8)}-${saleTime.replace(':', '')}`

    const normalizedItems: Array<{
      id: string
      name: string
      kind: string
      cost: number
      price: number
      stock: number
      quantity: number
    }> = []
    const productIds = new Set<string>()
    let calculatedSubtotal = 0

    for (const item of items) {
      const productId = cleanText(item.id)
      const quantity = numberOrZero(item.quantity)

      if (!productId || quantity <= 0 || quantity > 9999) {
        throw createError({ statusCode: 400, statusMessage: 'Revisa los productos de la venta.' })
      }
      if (productIds.has(productId)) {
        throw createError({ statusCode: 400, statusMessage: 'Cada producto debe aparecer una sola vez en la venta.' })
      }
      productIds.add(productId)

      const productResult = await client.query<{
        id: string
        name: string
        kind: string
        cost: number
        price: number
        stock: number
      }>(
        `
          select
            id,
            nombre as name,
            tipo as kind,
            costo_unitario::float as cost,
            precio_venta::float as price,
            stock_actual::float as stock
          from producto
          where id = $1
            and tienda_id = $2
            and activo = true
          for update
        `,
        [productId, session.storeId],
      )

      const product = productResult.rows[0]
      if (!product) {
        throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado.' })
      }

      if (!sameMoney(numberOrZero(item.price), product.price)) {
        throw createError({
          statusCode: 409,
          statusMessage: `El precio de ${product.name} cambio. Actualiza el catalogo antes de cobrar.`,
        })
      }

      normalizedItems.push({ ...product, quantity })
      calculatedSubtotal = roundMoney(calculatedSubtotal + quantity * product.price)
    }

    const discount = roundMoney(numberOrZero(body.discount))
    if (discount > calculatedSubtotal) {
      throw createError({ statusCode: 400, statusMessage: 'El descuento no puede superar el subtotal.' })
    }
    if (discount > 0 && !tieneAcceso('pos.descuento.aplicar', session)) {
      throw createError({ statusCode: 403, statusMessage: 'No autorizado para aplicar descuentos.' })
    }

    const total = roundMoney(calculatedSubtotal - discount)
    if (total <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'El total debe ser mayor a cero.' })
    }
    if (!sameMoney(numberOrZero(body.subtotal), calculatedSubtotal) || !sameMoney(numberOrZero(body.total), total)) {
      throw createError({ statusCode: 409, statusMessage: 'Los totales cambiaron. Revisa la venta antes de cobrar.' })
    }

    const saleResult = await client.query<{ id: string }>(
      `
        insert into venta (
          tienda_id,
          usuario_id,
          caja_sesion_id,
          numero,
          client_operation_id,
          canal,
          estado,
          subtotal,
          descuento,
          total,
          fecha,
          notas
        )
        values ($1, $2, $3, $4, $5, 'pos', 'pagada', $6, $7, $8, $9, $10)
        returning id
      `,
      [
        session.storeId,
        session.id,
        cashSessionId,
        saleNumber,
        clientOperationId,
        calculatedSubtotal,
        discount,
        total,
        occurredAt,
        null,
      ],
    )

    const saleId = saleResult.rows[0].id

    for (const product of normalizedItems) {
      const subtotal = roundMoney(product.quantity * product.price)

      await client.query(
        `
          insert into venta_item (
            venta_id,
            producto_id,
            nombre_producto,
            tipo_producto,
            cantidad,
            costo_unitario,
            precio_unitario,
            subtotal
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [saleId, product.id, product.name, product.kind, product.quantity, product.cost, product.price, subtotal],
      )

      if (product.kind !== 'servicio') {
        // La venta es la fuente financiera principal. Si el inventario estaba
        // desactualizado (un caso frecuente al vender offline), se registra la
        // venta y el faltante queda trazado sin llevar el stock bajo cero.
        const missingStock = Math.max(product.quantity - product.stock, 0)
        const nextStock = Math.max(product.stock - product.quantity, 0)
        const inventoryNote = missingStock > 0
          ? `Venta ${cashSaleCode}. Faltante de inventario: ${missingStock}.`
          : `Venta ${cashSaleCode}`

        await client.query(
          `
            update producto
            set stock_actual = $3, updated_at = now()
            where id = $1
              and tienda_id = $2
          `,
          [product.id, session.storeId, nextStock],
        )

        await client.query(
          `
            insert into inventario_movimiento (
              tienda_id,
              producto_id,
              usuario_id,
              venta_id,
              tipo,
              origen,
              cantidad,
              stock_anterior,
              stock_nuevo,
              costo_unitario,
              notas
            )
            values ($1, $2, $3, $4, 'salida', 'venta', $5, $6, $7, $8, $9)
          `,
          [session.storeId, product.id, session.id, saleId, product.quantity, product.stock, nextStock, product.cost, inventoryNote],
        )
      }
    }

    const validPaymentLines = paymentLines
      .map((line) => ({ label: cleanText(line.label, 'Efectivo'), amount: roundMoney(numberOrZero(line.amount)) }))
      .filter((line) => line.amount > 0)

    if (!validPaymentLines.length) {
      validPaymentLines.push({ label: 'Efectivo', amount: total })
    }

    const paidTotal = roundMoney(validPaymentLines.reduce((sum, payment) => sum + payment.amount, 0))
    if (!sameMoney(paidTotal, total)) {
      throw createError({ statusCode: 400, statusMessage: 'La suma de los pagos debe coincidir con el total.' })
    }

    for (const payment of validPaymentLines) {
      const method = dbPaymentMethod(payment.label)
      const paymentResult = await client.query<{ id: string }>(
        `
          insert into pago (
            tienda_id,
            venta_id,
            caja_sesion_id,
            usuario_id,
            tipo,
            metodo,
            estado,
            monto,
            fecha,
            notas
          )
          values ($1, $2, $3, $4, 'ingreso', $5, 'confirmado', $6, $7, $8)
          returning id
        `,
        [session.storeId, saleId, cashSessionId, session.id, method, payment.amount, occurredAt, `Cobro de venta ${cashSaleCode}`],
      )

      await client.query(
        `
          insert into caja_movimiento (
            tienda_id,
            caja_sesion_id,
            pago_id,
            venta_id,
            usuario_id,
            tipo,
            categoria,
            concepto,
            metodo,
            monto,
            estado,
            fecha,
            notas
          )
          values ($1, $2, $3, $4, $5, 'ingreso', 'venta', $6, $7, $8, 'pendiente', $9, 'Listo para revisar al cerrar caja')
        `,
        [session.storeId, cashSessionId, paymentResult.rows[0].id, saleId, session.id, `Venta ${cashSaleCode}`, method, payment.amount, occurredAt],
      )
    }

    const overview = await getCashOverview(client, session.storeId)
    await client.query('commit')

    return { ...overview, saleId, saleNumber: cashSaleCode }
  } catch (error) {
    await client.query('rollback')
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      const existingSale = await client.query<{ id: string, number: string | null }>(
        `
          select id, numero as number
          from venta
          where tienda_id = $1
            and client_operation_id = $2
          limit 1
        `,
        [session.storeId, clientOperationId],
      )
      const overview = await getCashOverview(client, session.storeId)
      if (existingSale.rows[0]) {
        return { ...overview, saleId: existingSale.rows[0].id, saleNumber: existingSale.rows[0].number }
      }
    }
    const statusCode = typeof error === 'object' && error && 'statusCode' in error
      ? Number(error.statusCode)
      : 500
    if (!Number.isFinite(statusCode) || statusCode >= 500) {
      console.error('[pos:sales:error]', { storeId: session.storeId, clientOperationId }, error)
    } else if (statusCode === 409) {
      const message = typeof error === 'object' && error && 'statusMessage' in error
        ? String(error.statusMessage)
        : 'Conflicto al registrar la venta.'
      console.warn('[pos:sales:conflict]', { storeId: session.storeId, clientOperationId, message })
    }
    throw error
  } finally {
    client.release()
  }
})
