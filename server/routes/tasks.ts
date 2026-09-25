import { createTaskSchema, updateOwnTaskSchema, updateTaskSchema } from '../../shared/schemas/task.ts'
import { computeTaskDeliveryDate } from '../../shared/dates.ts'
import type { CreateTaskPayload, TaskSummary } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'

const toTask = (task: { id: string; activityId: string; name: string; deliveryDate: Date; status: TaskSummary['status']; proofLink: string | null; memberPayout: number | null; payoutPaidAt: Date | null; clientPriceShare: number | null; activity: { name: string; project: { eventName: string } }; assignedUser: { id: string; name: string } }, includeMargin: boolean): TaskSummary => ({ id: task.id, name: task.name, activityId: task.activityId, activityName: task.activity.name, projectName: task.activity.project.eventName, assignedUserId: task.assignedUser.id, assignedUserName: task.assignedUser.name, deliveryDate: task.deliveryDate.toISOString(), status: task.status, proofLink: task.proofLink, memberPayout: task.memberPayout, payoutPaidAt: task.payoutPaidAt?.toISOString() ?? null, ...(includeMargin ? { clientPriceShare: task.clientPriceShare } : {}) })
const taskInclude = { activity: { select: { name: true, project: { select: { eventName: true } } } }, assignedUser: { select: { id: true, name: true } } } as const
const receiptNumber = async (prefix: string): Promise<string> => {
  const count = await prisma.receipt.count()
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
}
const listTasks = async (ctx: RouteContext): Promise<void> => {
  const isAdmin = ctx.actor?.role === 'ADMIN'
  const activityId = ctx.url.searchParams.get('activityId') ?? undefined
  const tasks = await prisma.task.findMany({ where: { archivedAt: null, ...(activityId ? { activityId } : {}), ...(isAdmin ? {} : { assignedUserId: ctx.actor?.id }) }, include: taskInclude, orderBy: { deliveryDate: 'asc' } })
  sendJson(ctx.res, 200, { tasks: tasks.map((task) => toTask(task, isAdmin)) })
}
const getTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null }, include: taskInclude })
  if (!task || (ctx.actor?.role !== 'ADMIN' && task.assignedUserId !== ctx.actor?.id)) throw new HttpError(404, 'Tâche introuvable.')
  sendJson(ctx.res, 200, { task: toTask(task, ctx.actor?.role === 'ADMIN') })
}
const createTask = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<CreateTaskPayload>(ctx)
  const activity = await prisma.activity.findFirst({ where: { id: data.activityId, archivedAt: null }, include: { project: true } })
  if (!activity) throw new HttpError(404, 'Activité introuvable.')
  const member = await prisma.user.findFirst({ where: { id: data.assignedUserId, archivedAt: null, isActive: true } })
  if (!member) throw new HttpError(404, 'Membre introuvable ou inactif.')
  const task = await prisma.task.create({ data: { activityId: activity.id, assignedUserId: member.id, name: data.name, clientPriceShare: data.clientPriceShare ?? null, memberPayout: data.memberPayout ?? null, deliveryDate: computeTaskDeliveryDate(activity.project.globalDeliveryDate) }, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.create', entity: 'Task', entityId: task.id, payload: { activityId: task.activityId, assignedUserId: task.assignedUserId } })
  sendJson(ctx.res, 201, { task: toTask(task, true) })
}
const updateTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!task) throw new HttpError(404, 'Tâche introuvable.')
  const data = bodyOf<{ assignedUserId?: string; name?: string; clientPriceShare?: number; memberPayout?: number }>(ctx)
  if (data.assignedUserId) {
    const member = await prisma.user.findFirst({ where: { id: data.assignedUserId, archivedAt: null, isActive: true } })
    if (!member) throw new HttpError(404, 'Membre introuvable ou inactif.')
  }
  const updated = await prisma.task.update({ where: { id: task.id }, data: { assignedUserId: data.assignedUserId ?? undefined, name: data.name ?? undefined, clientPriceShare: data.clientPriceShare ?? undefined, memberPayout: data.memberPayout ?? undefined }, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.update', entity: 'Task', entityId: updated.id, payload: data })
  sendJson(ctx.res, 200, { task: toTask(updated, true) })
}
const archiveTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!task) throw new HttpError(404, 'Tâche introuvable.')
  await prisma.task.update({ where: { id: task.id }, data: { archivedAt: new Date() } })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.archive', entity: 'Task', entityId: task.id })
  sendJson(ctx.res, 204, {})
}
const updateOwnTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!task || task.assignedUserId !== ctx.actor?.id) throw new HttpError(404, 'Tâche introuvable.')
  const data = bodyOf<{ status: TaskSummary['status']; proofLink?: string }>(ctx)
  const updated = await prisma.task.update({ where: { id: task.id }, data: { status: data.status, proofLink: data.proofLink?.trim() || null, completedAt: data.status === 'COMPLETED' ? new Date() : null }, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.progress', entity: 'Task', entityId: task.id, payload: { status: data.status } })
  sendJson(ctx.res, 200, { task: toTask(updated, false) })
}
const payTaskPayout = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null }, include: { assignedUser: { select: { name: true } }, activity: { include: { project: { include: { client: true } } } } } })
  if (!task) throw new HttpError(404, 'Tâche introuvable.')
  if (task.status !== 'COMPLETED') throw new HttpError(400, 'La tâche doit être terminée avant le paiement.')
  if (!task.memberPayout || task.memberPayout <= 0) throw new HttpError(400, 'Aucune rémunération n’est prévue pour cette tâche.')
  if (task.payoutPaidAt) throw new HttpError(409, 'Cette rémunération a déjà été payée.')
  const updated = await prisma.task.update({ where: { id: task.id }, data: { payoutPaidAt: new Date() }, include: taskInclude })
  const settings = await prisma.studioSettings.upsert({ where: { id: 'studio' }, update: {}, create: {} })
  await prisma.receipt.create({ data: { number: await receiptNumber(settings.receiptPrefix), type: 'CUSTOM', projectId: task.activity.projectId, amount: task.memberPayout, snapshot: { documentType: 'MEMBER_PAYOUT_RECEIPT', studioName: settings.name, clientName: task.activity.project.client.name, taskName: task.name, memberName: task.assignedUser.name, amount: task.memberPayout }, createdById: ctx.actor?.id ?? null } })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.payout_paid', entity: 'Task', entityId: task.id, payload: { amount: task.memberPayout } })
  sendJson(ctx.res, 200, { task: toTask(updated, true) })
}
export const taskRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/tasks', auth: true, middlewares: [requireAuth], handler: listTasks },
  { method: 'GET', path: '/api/tasks/:id', auth: true, middlewares: [requireAuth], handler: getTask },
  { method: 'POST', path: '/api/tasks', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(createTaskSchema)], handler: createTask },
  { method: 'PATCH', path: '/api/tasks/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(updateTaskSchema)], handler: updateTask },
  { method: 'PATCH', path: '/api/tasks/:id/progress', auth: true, middlewares: [requireAuth, validateBody(updateOwnTaskSchema)], handler: updateOwnTask },
  { method: 'POST', path: '/api/tasks/:id/payout', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: payTaskPayout },
  { method: 'DELETE', path: '/api/tasks/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: archiveTask },
]
