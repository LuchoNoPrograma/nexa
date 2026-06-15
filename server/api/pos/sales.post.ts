import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../utils/db'
import { cleanText, numberOrZero, requireStoreSession } from '../../utils/posCatalog'
import { getCashOverview, requireOpenCashSession } from '../../utils/posCash'

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
  number?: string
  subtotal?: number
  discount?: number
  total?: number
  items?: SaleItemBody[]
  paymentLines?: PaymentLineBody[]
}

function dbPaymentMethod(label: unknown) {
  const normalized = cleanText(label).toLowerCase()

  if (normalized.includes('qr') || normalized.includes('transferencia')) {
    return 'qr'
  }

  return 'efectivo'
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreSession(event)
  await ensureDatabase()

  const body = await readBody<SaleBody>(event)
  const items = Array.isArray(body.items) ? body.items : []
  const paymentLines = Array.isArray(body.paymentLines) ? body.paymentLines : []

  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'Agrega productos para vender.' })
  }

  const total = numberOrZero(body.total)

  if (total <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'El total debe ser mayor a cero.' })
  }

  const client = await pool.connect()

  try {
    await client.query('begin')
    const cashSessionId = await requireOpenCashSession(client, session.storeId)
    const saleCodeResult = await client.query<{ sequence: number; saleTime: string }>(
      `
        select
          (count(*) + 1)::int as sequence,
          to_char(now(), 'HH24:MI') as "saleTime"
        from venta
        where tienda_id = $1
          and caja_sesion_id = $2
          and estado <> 'anulada'
      `,
      [session.storeId, cashSessionId],
    )
    const saleSequence = saleCodeResult.rows[0]?.sequence ?? 1
    const saleTime = saleCodeResult.rows[0]?.saleTime ?? new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
    const cashSaleCode = `C${saleSequence} ${saleTime}`
    const saleNumber = `C${saleSequence}-${cashSessionId.slice(0, 8)}-${saleTime.replace(':', '')}`

    const saleResult = await client.query<{ id: string }>(
      `
        insert into venta (
          tienda_id,
          usuario_id,
          caja_sesion_id,
          numero,
          canal,
          estado,
          subtotal,
          descuento,
          total,
          notas
        )
        values ($1, $2, $3, $4, 'pos', 'pagada', $5, $6, $7, $8)
        returning id
      `,
      [
        session.storeId,
        session.id,
        cashSessionId,
        saleNumber,
        numberOrZero(body.subtotal),
        numberOrZero(body.discount),
        total,
        null,
      ],
    )

    const saleId = saleResult.rows[0].id

    for (const item of items) {
      const productId = cleanText(item.id)
      const quantity = numberOrZero(item.quantity)
      const price = numberOrZero(item.price)

      if (!productId || quantity <= 0 || price <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Revisa los productos de la venta.' })
      }

      const productResult = await client.query<{
        id: string
        name: string
        kind: string
        cost: number
        stock: number
      }>(
        `
          select
            id,
            nombre as name,
            tipo as kind,
            costo_unitario::float as cost,
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

      const subtotal = quantity * price

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
        [saleId, product.id, product.name, product.kind, quantity, product.cost, price, subtotal],
      )

      if (product.kind !== 'servicio') {
        const nextStock = Math.max(product.stock - quantity, 0)

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
          [session.storeId, product.id, session.id, saleId, quantity, product.stock, nextStock, product.cost, `Venta ${cashSaleCode}`],
        )
      }
    }

    const validPaymentLines = paymentLines
      .map((line) => ({ label: cleanText(line.label, 'Efectivo'), amount: numberOrZero(line.amount) }))
      .filter((line) => line.amount > 0)

    if (!validPaymentLines.length) {
      validPaymentLines.push({ label: 'Efectivo', amount: total })
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
            notas
          )
          values ($1, $2, $3, $4, 'ingreso', $5, 'confirmado', $6, $7)
          returning id
        `,
        [session.storeId, saleId, cashSessionId, session.id, method, payment.amount, `Cobro de venta ${cashSaleCode}`],
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
            notas
          )
          values ($1, $2, $3, $4, $5, 'ingreso', 'venta', $6, $7, $8, 'pendiente', 'Listo para revisar al cerrar caja')
        `,
        [session.storeId, cashSessionId, paymentResult.rows[0].id, saleId, session.id, `Venta ${cashSaleCode}`, method, payment.amount],
      )
    }

    const overview = await getCashOverview(client, session.storeId)
    await client.query('commit')

    return { ...overview, saleNumber: cashSaleCode }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
