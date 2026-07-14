import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createError, getRouterParam, readMultipartFormData } from 'h3'
import { ensureDatabase, pool } from '../../../../../utils/db'
import { requireStoreAccess } from '../../../../../utils/posCatalog'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxFileSize = 1024 * 1024

function hasValidSignature(data: Buffer, contentType: string) {
  if (contentType === 'image/jpeg') {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  }
  if (contentType === 'image/png') {
    return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (contentType === 'image/webp') {
    return data.length >= 12
      && data.subarray(0, 4).toString('ascii') === 'RIFF'
      && data.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

function requiredConfig(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw createError({ statusCode: 500, statusMessage: `Falta configurar ${name}.` })
  }
  return value
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'producto.gestionar')
  await ensureDatabase()

  const productId = getRouterParam(event, 'id')
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'Producto invalido.' })
  }

  const product = await pool.query(
    'select id from producto where id = $1 and tienda_id = $2 and activo = true',
    [productId, session.storeId],
  )
  if (!product.rowCount) {
    throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado en esta tienda.' })
  }

  const parts = await readMultipartFormData(event)
  const image = parts?.find(part => part.name === 'image' && part.data)
  if (!image) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona una imagen para subir.' })
  }

  const contentType = image.type ?? ''
  if (!allowedTypes.has(contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'Usa una imagen JPEG, PNG o WebP.' })
  }
  if (image.data.byteLength > maxFileSize) {
    throw createError({ statusCode: 413, statusMessage: 'La imagen no puede superar 1 MB.' })
  }
  if (!hasValidSignature(image.data, contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'El contenido del archivo no coincide con una imagen valida.' })
  }

  const supabaseUrl = requiredConfig('SUPABASE_URL').replace(/\/$/, '')
  const secretKey = requiredConfig('SUPABASE_SECRET_KEY')
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'productos'
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const objectPath = `${session.storeId}/${productId}/${randomUUID()}.${extension}`
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const fileData = image.data.buffer.slice(
    image.data.byteOffset,
    image.data.byteOffset + image.data.byteLength,
  ) as ArrayBuffer
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, fileData, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  })

  if (uploadError) {
    console.error('Supabase Storage upload failed', uploadError)
    throw createError({ statusCode: 502, statusMessage: 'No se pudo subir la imagen a Supabase Storage.' })
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  const imageUrl = publicUrlData.publicUrl
  await pool.query(
    'update producto set imagen_url = $1, updated_at = now() where id = $2 and tienda_id = $3',
    [imageUrl, productId, session.storeId],
  )

  return { imageUrl }
})
