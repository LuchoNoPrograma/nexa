import { createError, getRequestHeader, readBody } from 'h3'
import { ensureDatabase, pool } from '../utils/db'

type ContactBody = {
  nombre?: string
  telefono?: string
  rubro?: string
  mensaje?: string
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, maxLength)
}

export default defineEventHandler(async (event) => {
  await ensureDatabase()

  const body = await readBody<ContactBody>(event)
  const nombre = cleanText(body.nombre, 120)
  const telefono = cleanText(body.telefono, 40)
  const rubro = cleanText(body.rubro, 120)
  const mensaje = cleanText(body.mensaje, 1200)

  if (nombre.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'El nombre es requerido.' })
  }

  if (mensaje.length < 10) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe un mensaje un poco mas detallado.' })
  }

  const result = await pool.query<{ id: string }>(
    `
      insert into contacto_mensaje (
        nombre,
        telefono,
        rubro,
        mensaje,
        canal,
        estado,
        ip,
        user_agent
      )
      values ($1, $2, $3, $4, 'formulario', 'nuevo', $5, $6)
      returning id
    `,
    [
      nombre,
      telefono || null,
      rubro || null,
      mensaje,
      getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ?? event.node.req.socket.remoteAddress ?? null,
      getRequestHeader(event, 'user-agent') ?? null,
    ],
  )

  return {
    ok: true,
    message: 'Tu consulta fue registrada. Te contactaremos pronto.',
    id: result.rows[0]?.id,
  }
})
