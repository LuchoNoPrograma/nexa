import process from 'node:process'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createError } from 'h3'

const PREFIX = 'enc:v1'

export function isEncryptedSecret(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${PREFIX}:`))
}

function encryptionKey() {
  const secret = process.env.NEXA_DATA_ENCRYPTION_KEY?.trim()
  if (!secret || secret.length < 32) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Configura NEXA_DATA_ENCRYPTION_KEY con al menos 32 caracteres.',
    })
  }

  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptSecret(value: string | null | undefined) {
  if (!value || !isEncryptedSecret(value)) {
    return value ?? null
  }

  const [, , ivValue, tagValue, encryptedValue] = value.split(':')
  if (!ivValue || !tagValue || !encryptedValue) {
    throw createError({ statusCode: 500, statusMessage: 'El secreto almacenado tiene un formato invalido.' })
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  }
  catch {
    throw createError({ statusCode: 500, statusMessage: 'No se pudo descifrar una credencial del servidor.' })
  }
}
