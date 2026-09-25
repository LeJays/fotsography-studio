import 'dotenv/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { AuthRole } from '../../shared/consts.ts'
import type { AuthUser } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { buildCookie, HttpError, readCookie } from '../http.ts'
import type { Middleware } from '../router.ts'
import { toAuthUser } from '../serialize.ts'

const COOKIE_NAME = 'fotsography_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const SECRET = process.env.JWT_SECRET ?? 'fotsography-dev-secret-change-me'

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url')

const sign = (data: string): Buffer => createHmac('sha256', SECRET).update(data).digest()

interface SessionPayload {
  sub: string
  iat: number
  exp: number
}

/** Session signée HS256 (même format qu'un JWT, sans dépendance externe). */
export const signSession = (userId: string, ttlSeconds = SESSION_TTL_SECONDS): string => {
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { sub: userId, iat: issuedAt, exp: issuedAt + ttlSeconds }

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))

  return `${header}.${body}.${base64url(sign(`${header}.${body}`))}`
}

export const verifySession = (token: string): SessionPayload | null => {
  const [header, body, signature] = token.split('.')

  if (!header || !body || !signature) return null

  const expected = sign(`${header}.${body}`)
  const provided = Buffer.from(signature, 'base64url')

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>

    if (!payload.sub || !payload.exp || payload.exp * 1000 <= Date.now()) return null

    return payload as SessionPayload
  } catch {
    return null
  }
}

export const sessionCookie = (token: string): string =>
  buildCookie(COOKIE_NAME, token, {
    maxAge: SESSION_TTL_SECONDS,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'Lax',
    path: '/',
  })

export const expiredSessionCookie = (): string =>
  `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`

/**
 * Charge l'utilisateur de la session depuis la base : le rôle et l'état du compte
 * sont donc toujours à jour (une désactivation coupe l'accès immédiatement).
 */
export const loadActor = async (req: IncomingMessage): Promise<AuthUser | null> => {
  const token = readCookie(req, COOKIE_NAME)

  if (!token) return null

  const session = verifySession(token)

  if (!session) return null

  const user = await prisma.user.findFirst({
    where: { id: session.sub, isActive: true, archivedAt: null },
  })

  return user ? toAuthUser(user) : null
}

export const requireAuth: Middleware = async (ctx, next) => {
  if (!ctx.actor) {
    throw new HttpError(401, 'Session expirée. Reconnectez-vous.')
  }

  await next()
}

export const requireRole = (...roles: AuthRole[]): Middleware => async (ctx, next) => {
  if (!ctx.actor) {
    throw new HttpError(401, 'Session expirée. Reconnectez-vous.')
  }

  if (!roles.includes(ctx.actor.role)) {
    throw new HttpError(403, "Vous n'avez pas les droits pour effectuer cette action.")
  }

  await next()
}
