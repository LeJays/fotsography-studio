import { changePasswordSchema, loginSchema, registerAdminSchema } from '../../shared/schemas/auth.ts'
import type {
  AuthResponse,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  SetupStatus,
} from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson, sendNoContent } from '../http.ts'
import { expiredSessionCookie, requireAuth, sessionCookie, signSession } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import { hashPassword, verifyPassword } from '../password.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { toAuthUser } from '../serialize.ts'
import { recordAudit } from '../services/audit.ts'

const sessionHeaders = (userId: string): Record<string, string> => ({
  'Set-Cookie': sessionCookie(signSession(userId)),
})

const publicSignupAllowed = (): boolean => process.env.ALLOW_PUBLIC_ADMIN_SIGNUP === 'true'

const hasAdmin = async (): Promise<boolean> =>
  (await prisma.user.count({ where: { role: 'ADMIN', archivedAt: null } })) > 0

/** POST /api/auth/register — création du compte admin principal (première installation). */
const register = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<RegisterPayload>(ctx)

  if (!publicSignupAllowed() && (await hasAdmin())) {
    throw new HttpError(
      403,
      'Un administrateur existe déjà. Demandez-lui de créer votre compte depuis la page Équipe.',
    )
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } })

  if (existing) {
    throw new HttpError(409, 'Un compte existe déjà avec cette adresse email.')
  }

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: hashPassword(data.password),
      role: 'ADMIN',
    },
  })

  await recordAudit({
    actorId: created.id,
    action: 'auth.register',
    entity: 'User',
    entityId: created.id,
    payload: { email: created.email, role: created.role },
  })

  sendJson(ctx.res, 201, { user: toAuthUser(created) } satisfies AuthResponse, sessionHeaders(created.id))
}

/** POST /api/auth/login — email OU nom complet + mot de passe. */
const login = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<LoginPayload>(ctx)

  const user = data.identifier.includes('@')
    ? await prisma.user.findFirst({
        where: { email: data.identifier.toLowerCase(), archivedAt: null },
      })
    : ((await prisma.user.findMany({
        where: { name: { equals: data.identifier, mode: 'insensitive' }, archivedAt: null },
        take: 2,
      }))[0] ?? null)

  if (!user || !verifyPassword(data.password, user.password)) {
    throw new HttpError(401, 'Email, nom ou mot de passe incorrect.')
  }

  if (!user.isActive) {
    throw new HttpError(403, "Ce compte est désactivé. Contactez l'administrateur du studio.")
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  await recordAudit({ actorId: user.id, action: 'auth.login', entity: 'User', entityId: user.id })

  sendJson(ctx.res, 200, { user: toAuthUser(user) } satisfies AuthResponse, sessionHeaders(user.id))
}

/** POST /api/auth/logout */
const logout = async (ctx: RouteContext): Promise<void> => {
  sendNoContent(ctx.res, { 'Set-Cookie': expiredSessionCookie() })
}

/** GET /api/auth/me — session courante (le front s'en sert au démarrage). */
const me = async (ctx: RouteContext): Promise<void> => {
  if (!ctx.actor) {
    throw new HttpError(401, 'Session expirée. Reconnectez-vous.')
  }

  sendJson(ctx.res, 200, { user: ctx.actor } satisfies AuthResponse)
}

/** POST /api/auth/password — changement de mot de passe par l'utilisateur connecté. */
const changePassword = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<ChangePasswordPayload>(ctx)
  const actor = ctx.actor

  if (!actor) {
    throw new HttpError(401, 'Session expirée. Reconnectez-vous.')
  }

  const user = await prisma.user.findUnique({ where: { id: actor.id } })

  if (!user || !verifyPassword(data.currentPassword, user.password)) {
    throw new HttpError(400, 'Mot de passe actuel incorrect.')
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: hashPassword(data.newPassword), mustChangePassword: false },
  })

  await recordAudit({
    actorId: updated.id,
    action: 'auth.password',
    entity: 'User',
    entityId: updated.id,
  })

  sendJson(ctx.res, 200, { user: toAuthUser(updated) } satisfies AuthResponse)
}

/** GET /api/auth/setup-status — l'écran de connexion affiche l'inscription seulement si besoin. */
const setupStatus = async (ctx: RouteContext): Promise<void> => {
  const needsAdmin = !publicSignupAllowed() && !(await hasAdmin())
  sendJson(ctx.res, 200, { needsAdmin } satisfies SetupStatus)
}

export const authRoutes: RouteDefinition[] = [
  {
    method: 'POST',
    path: '/api/auth/register',
    middlewares: [validateBody(registerAdminSchema)],
    handler: register,
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    middlewares: [validateBody(loginSchema)],
    handler: login,
  },
  { method: 'POST', path: '/api/auth/logout', handler: logout },
  { method: 'GET', path: '/api/auth/me', auth: true, middlewares: [requireAuth], handler: me },
  {
    method: 'POST',
    path: '/api/auth/password',
    auth: true,
    middlewares: [requireAuth, validateBody(changePasswordSchema)],
    handler: changePassword,
  },
  { method: 'GET', path: '/api/auth/setup-status', handler: setupStatus },
]
