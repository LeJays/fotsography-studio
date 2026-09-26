import { createActivitySchema, updateActivitySchema } from '../../shared/schemas/activity.ts'
import type { ActivitySummary, CreateActivityPayload } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'

const listActivities = async (ctx: RouteContext): Promise<void> => {
  const isAdmin = ctx.actor?.role === 'ADMIN'
  const projectId = ctx.url.searchParams.get('projectId') ?? undefined
  const activities = await prisma.activity.findMany({ where: { archivedAt: null, ...(projectId ? { projectId } : {}) }, include: { project: { select: { eventName: true } }, expenses: { where: { archivedAt: null }, select: { amount: true } } }, orderBy: { createdAt: 'asc' } })
  // Montants de dépenses réservés à l'admin (l'assistant voit le reste de l'activité).
  const result: ActivitySummary[] = activities.map((activity) => ({ id: activity.id, projectId: activity.projectId, projectName: activity.project.eventName, name: activity.name, description: activity.description, status: activity.status, expenseCount: activity.expenses.length, expenseAmount: isAdmin ? activity.expenses.reduce((total, expense) => total + expense.amount, 0) : 0 }))
  sendJson(ctx.res, 200, { activities: result })
}
const createActivity = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<CreateActivityPayload>(ctx)
  const project = await prisma.project.findFirst({ where: { id: data.projectId, archivedAt: null } })
  if (!project) throw new HttpError(404, 'Projet introuvable.')
  const activity = await prisma.activity.create({ data: { projectId: data.projectId, name: data.name, description: data.description || null }, include: { project: { select: { eventName: true } } } })
  await prisma.project.updateMany({ where: { id: activity.projectId, status: 'DRAFT' }, data: { status: 'IN_PROGRESS' } })
  await recordAudit({ actorId: ctx.actor?.id, action: 'activity.create', entity: 'Activity', entityId: activity.id, payload: { projectId: activity.projectId, name: activity.name } })
  sendJson(ctx.res, 201, { activity: { id: activity.id, projectId: activity.projectId, projectName: activity.project.eventName, name: activity.name, description: activity.description, status: activity.status, expenseCount: 0, expenseAmount: 0 } satisfies ActivitySummary })
}
const updateActivity = async (ctx: RouteContext): Promise<void> => {
  const existing = await prisma.activity.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!existing) throw new HttpError(404, 'Activité introuvable.')
  const data = bodyOf<{ name?: string; description?: string }>(ctx)
  const activity = await prisma.activity.update({ where: { id: existing.id }, data: { name: data.name ?? undefined, description: data.description === undefined ? undefined : data.description || null }, include: { project: { select: { eventName: true } } } })
  await recordAudit({ actorId: ctx.actor?.id, action: 'activity.update', entity: 'Activity', entityId: activity.id, payload: data })
  sendJson(ctx.res, 200, { activity: { id: activity.id, projectId: activity.projectId, projectName: activity.project.eventName, name: activity.name, description: activity.description, status: activity.status, expenseCount: 0, expenseAmount: 0 } satisfies ActivitySummary })
}
const archiveActivity = async (ctx: RouteContext): Promise<void> => {
  const activity = await prisma.activity.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!activity) throw new HttpError(404, 'Activité introuvable.')
  await prisma.activity.update({ where: { id: activity.id }, data: { archivedAt: new Date() } })
  await recordAudit({ actorId: ctx.actor?.id, action: 'activity.archive', entity: 'Activity', entityId: activity.id })
  sendJson(ctx.res, 204, {})
}
export const activityRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/activities', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT')], handler: listActivities },
  { method: 'POST', path: '/api/activities', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(createActivitySchema)], handler: createActivity },
  { method: 'PATCH', path: '/api/activities/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(updateActivitySchema)], handler: updateActivity },
  { method: 'DELETE', path: '/api/activities/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: archiveActivity },
]
