import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Hachage des mots de passe avec scrypt (module `node:crypto`), sans dépendance
 * externe. Format stocké en base : `scrypt:<sel hex>:<hash hex>`.
 */
const ALGORITHM = 'scrypt'
const KEY_LENGTH = 64

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')

  return `${ALGORITHM}:${salt}:${hash}`
}

export const verifyPassword = (password: string, storedPassword: string): boolean => {
  const [algorithm, salt, hash] = storedPassword.split(':')

  if (algorithm !== ALGORITHM || !salt || !hash) {
    return false
  }

  const expected = Buffer.from(hash, 'hex')
  const candidate = scryptSync(password, salt, expected.length)

  return expected.length === candidate.length && timingSafeEqual(expected, candidate)
}
