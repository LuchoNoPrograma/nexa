import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const keyLength = 64

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer

  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  // Las cuentas creadas solo con OAuth no tienen contraseña local (password_hash
  // null). Sin esta guarda, intentar login por correo en esas cuentas rompía con
  // un TypeError al hacer null.split('$').
  if (!storedHash) {
    return false
  }

  const [algorithm, salt, key] = storedHash.split('$')

  if (algorithm !== 'scrypt' || !salt || !key) {
    return false
  }

  const hashedBuffer = Buffer.from(key, 'hex')
  const derivedKey = await scrypt(password, salt, hashedBuffer.length) as Buffer

  return hashedBuffer.length === derivedKey.length && timingSafeEqual(hashedBuffer, derivedKey)
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
