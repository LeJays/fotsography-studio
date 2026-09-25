import type { User } from '@prisma/client'
import { ROLES, type AuthRole } from '../shared/consts.ts'
import type { AuthUser, UserSummary } from '../shared/types.ts'

const isAuthRole = (value: string): value is AuthRole =>
  (ROLES as readonly string[]).includes(value)

/** Utilisateur connecté — n'expose jamais le mot de passe. */
export const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone ?? '',
  role: isAuthRole(user.role) ? user.role : 'ASSISTANT',
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
})

/** Ligne de la page « Équipe ». */
export const toUserSummary = (user: User): UserSummary => ({
  ...toAuthUser(user),
  lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  createdAt: user.createdAt.toISOString(),
})
