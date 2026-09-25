import type { User } from '@prisma/client'
import { STAFF_ROLES } from '../../shared/consts.ts'
import { createUserSchema, updateUserSchema } from '../../shared/schemas/user.ts'
import type { CreateUserPayload, UserSummary, UpdateUserPayload } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson, sendNoContent } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import { hashPassword } from '../password.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { toUserSummary } from '../serialize.ts'
import { recordAudit } from '../services/audit.ts'

const activeMembers = () =>
  prisma.user.findMany({
    where: { archivedAt: null },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

const loadUser = async (id: string): Promise<User> => {
  const user = await prisma.user.findFirst({ where: { id, archivedAt: null } })

  if (!user) {
    throw new HttpError(404, 'Membre introuvable.')
  }

  return user
}

const countActiveAdmins = async (): Promise<number> =>
  prisma.user.count({ where: { role: 'ADMIN', isActive: true, archivedAt: null } })

/** GET /api/users — liste de l'équipe (administrateurs uniquement). */
const listUsers = async (ctx: RouteContext): Promise<void> => {
  const users = await activeMembers()
  sendJson(ctx.res, 200, { users: users.map(toUserSummary) } satisfies { users: UserSummary[] })
}

/** POST /api/users — l'admin crée un membre et lui attribue un rôle. */
const createUser = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<CreateUserPayload>(ctx)
  const actor = ctx.actor

  const existing = await prisma.user.findUnique({ where: { email: data.email } })

  if (existing) {
    throw new HttpError(409, 'Un compte existe déjà avec cette adresse email.')
  }

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      password: hashPassword(data.password),
      mustChangePassword: true,
      createdById: actor?.id ?? null,
    },
  })

  await recordAudit({
    actorId: actor?.id,
    action: 'user.create',
    entity: 'User',
    entityId: created.id,
    payload: { email: created.email, role: created.role },
  })

  sendJson(ctx.res, 201, { user: toUserSummary(created) } satisfies { user: UserSummary })
}

/** PATCH /api/users/:id — nom, téléphone, rôle, activation. */
const updateUser = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<UpdateUserPayload>(ctx)
  const actor = ctx.actor
  const { id } = ctx.params

  const user = await loadUser(id)

  if (data.role && data.role !== user.role) {
    if (!(STAFF_ROLES as readonly string[]).includes(data.role)) {
      throw new HttpError(422, 'Rôle invalide.')
    }

    if (user.role === 'ADMIN' && (await countActiveAdmins()) <= 1) {
      throw new HttpError(400, 'Impossible de retirer le dernier administrateur actif.')
    }
  }

  if (data.isActive === false && user.role === 'ADMIN' && (await countActiveAdmins()) <= 1) {
    throw new HttpError(400, 'Impossible de désactiver le dernier administrateur actif.')
  }

  if (data.isActive === false && user.id === actor?.id) {
    throw new HttpError(400, 'Vous ne pouvez pas désactiver votre propre compte.')
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: data.name ?? undefined,
      phone: data.phone ?? undefined,
      role: data.role ?? undefined,
      isActive: data.isActive ?? undefined,
    },
  })

  await recordAudit({
    actorId: actor?.id,
    action: 'user.update',
    entity: 'User',
    entityId: updated.id,
    payload: data,
  })

  sendJson(ctx.res, 200, { user: toUserSummary(updated) } satisfies { user: UserSummary })
}

/** DELETE /api/users/:id — archivage (jamais de suppression physique). */
const archiveUser = async (ctx: RouteContext): Promise<void> => {
  const actor = ctx.actor
  const user = await loadUser(ctx.params.id)

  if (user.id === actor?.id) {
    throw new HttpError(400, 'Vous ne pouvez pas archiver votre propre compte.')
  }

  if (user.role === 'ADMIN' && (await countActiveAdmins()) <= 1) {
    throw new HttpError(400, 'Impossible d’archiver le dernier administrateur actif.')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { archivedAt: new Date(), isActive: false },
  })

  await recordAudit({
    actorId: actor?.id,
    action: 'user.archive',
    entity: 'User',
    entityId: user.id,
    payload: { email: user.email },
  })

  sendNoContent(ctx.res)
}

export const userRoutes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/api/users',
    auth: true,
    middlewares: [requireAuth, requireRole('ADMIN')],
    handler: listUsers,
  },
  {
    method: 'POST',
    path: '/api/users',
    auth: true,
    middlewares: [requireAuth, requireRole('ADMIN'), validateBody(createUserSchema)],
    handler: createUser,
  },
  {
    method: 'PATCH',
    path: '/api/users/:id',
    auth: true,
    middlewares: [requireAuth, requireRole('ADMIN'), validateBody(updateUserSchema)],
    handler: updateUser,
  },
  {
    method: 'DELETE',
    path: '/api/users/:id',
    auth: true,
    middlewares: [requireAuth, requireRole('ADMIN')],
    handler: archiveUser,
  },
]
