import { createTaskSchema, payoutTaskSchema, reviewTaskSchema, updateOwnTaskSchema, updateTaskSchema } from '../../shared/schemas/task.ts'
import { computeTaskDeliveryDate } from '../../shared/dates.ts'
import { formatAmount } from '../../shared/money.ts'
import type { CreateTaskPayload, TaskSummary } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'

/** Versement d'une rémunération — lignes d'historique (total ou tranche), visibles admin + assigné. */
type TaskPayoutRecord = { id: string; amount: number; method: 'CASH' | 'MOMO' | 'BANK'; reference: string | null; note: string | null; receiptNumber: string | null; paidAt: Date; paidBy: { name: string } | null }
type TaskReviewRecord = { id: string; decision: 'APPROVED' | 'RETURNED'; note: string | null; reviewedAt: Date; reviewedBy: { name: string } | null }
const toTask = (task: { id: string; activityId: string; name: string; deliveryDate: Date; status: TaskSummary['status']; proofLink: string | null; memberPayout: number | null; payoutPaidAt: Date | null; clientPriceShare: number | null; activity: { name: string; project: { eventName: string } }; assignedUser: { id: string; name: string }; payouts?: TaskPayoutRecord[]; reviews?: TaskReviewRecord[] }, options: { includeMargin: boolean; includePayout: boolean }): TaskSummary => {
  const payoutList = task.payouts ?? []
  const recordedTotal = payoutList.reduce((total, item) => total + item.amount, 0)
  // Rétrocompatibilité : les tâches payées avant la mise en place de l'historique n'ont pas de lignes de versement.
  const paidTotal = recordedTotal > 0 ? recordedTotal : task.payoutPaidAt ? task.memberPayout ?? 0 : 0
  return {
    id: task.id, name: task.name, activityId: task.activityId, activityName: task.activity.name, projectName: task.activity.project.eventName,
    assignedUserId: task.assignedUser.id, assignedUserName: task.assignedUser.name, deliveryDate: task.deliveryDate.toISOString(),
    status: task.status, proofLink: task.proofLink,
    clientPriceShare: options.includeMargin ? task.clientPriceShare : null,
    memberPayout: options.includePayout ? task.memberPayout : null,
    payoutPaidAt: options.includePayout ? task.payoutPaidAt?.toISOString() ?? null : null,
    ...(options.includePayout
      ? {
          payouts: payoutList.map((item) => ({ id: item.id, amount: item.amount, method: item.method, reference: item.reference, note: item.note, receiptNumber: item.receiptNumber, paidAt: item.paidAt.toISOString(), paidByName: item.paidBy?.name ?? null })),
          paidPayout: paidTotal,
          payoutRemaining: Math.max((task.memberPayout ?? 0) - paidTotal, 0),
        }
      : {}),
    ...(task.reviews
      ? {
          reviews: task.reviews.map((item) => ({ id: item.id, decision: item.decision, note: item.note, reviewedAt: item.reviewedAt.toISOString(), reviewedByName: item.reviewedBy?.name ?? null })),
        }
      : {}),
  }
}
const taskInclude = {
  activity: { select: { name: true, project: { select: { eventName: true } } } },
  assignedUser: { select: { id: true, name: true } },
  payouts: { orderBy: { paidAt: 'desc' }, include: { paidBy: { select: { name: true } } } },
  reviews: { orderBy: { reviewedAt: 'desc' }, include: { reviewedBy: { select: { name: true } } } },
} as const
/** Montants réservés à l'admin (part client) et à l'assigné (sa rémunération). */
const isAdminActor = (ctx: RouteContext): boolean => ctx.actor?.role === 'ADMIN'
const payoutVisible = (ctx: RouteContext, assignedUserId: string): boolean => isAdminActor(ctx) || ctx.actor?.id === assignedUserId
const receiptNumber = async (prefix: string): Promise<string> => {
  const count = await prisma.receipt.count()
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
}
const listTasks = async (ctx: RouteContext): Promise<void> => {
  const isAdmin = isAdminActor(ctx)
  // Admin et assistant pilotent toutes les tâches du studio ; un membre ne voit que les siennes.
  const canSeeAll = isAdmin || ctx.actor?.role === 'ASSISTANT'
  const activityId = ctx.url.searchParams.get('activityId') ?? undefined
  // `mine=true` : uniquement les tâches attribuées à l'utilisateur connecté, y compris pour un admin (page « Mes tâches »).
  const mine = ctx.url.searchParams.get('mine') === 'true'
  const assignedUserId = mine || !canSeeAll ? ctx.actor?.id : undefined
  const tasks = await prisma.task.findMany({ where: { archivedAt: null, ...(activityId ? { activityId } : {}), ...(assignedUserId ? { assignedUserId } : {}) }, include: taskInclude, orderBy: { deliveryDate: 'asc' } })
  sendJson(ctx.res, 200, { tasks: tasks.map((task) => toTask(task, { includeMargin: isAdmin, includePayout: payoutVisible(ctx, task.assignedUserId) })) })
}
const getTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null }, include: taskInclude })
  const canSeeAll = ctx.actor?.role === 'ADMIN' || ctx.actor?.role === 'ASSISTANT'
  if (!task || (!canSeeAll && task.assignedUserId !== ctx.actor?.id)) throw new HttpError(404, 'Tâche introuvable.')
  sendJson(ctx.res, 200, { task: toTask(task, { includeMargin: isAdminActor(ctx), includePayout: payoutVisible(ctx, task.assignedUserId) }) })
}
const createTask = async (ctx: RouteContext): Promise<void> => {
  const isAdmin = isAdminActor(ctx)
  const data = bodyOf<CreateTaskPayload>(ctx)
  const activity = await prisma.activity.findFirst({ where: { id: data.activityId, archivedAt: null }, include: { project: true } })
  if (!activity) throw new HttpError(404, 'Activité introuvable.')
  const member = await prisma.user.findFirst({ where: { id: data.assignedUserId, archivedAt: null, isActive: true, role: { not: 'CLIENT' } } })
  if (!member) throw new HttpError(404, 'Membre introuvable ou inactif.')
  // Les montants ne sont fixés que par l'admin : un assistant distribue la tâche sans saisir d'argent.
  // Une tâche assignée à l'admin ne porte aucune rémunération membre : seul le montant client est suivi.
  const task = await prisma.task.create({ data: { activityId: activity.id, assignedUserId: member.id, name: data.name, clientPriceShare: isAdmin ? data.clientPriceShare ?? null : null, memberPayout: isAdmin && member.role !== 'ADMIN' ? data.memberPayout ?? null : null, deliveryDate: computeTaskDeliveryDate(activity.project.globalDeliveryDate) }, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.create', entity: 'Task', entityId: task.id, payload: { activityId: task.activityId, assignedUserId: task.assignedUserId } })
  sendJson(ctx.res, 201, { task: toTask(task, { includeMargin: isAdmin, includePayout: payoutVisible(ctx, task.assignedUserId) }) })
}
const updateTask = async (ctx: RouteContext): Promise<void> => {
  const isAdmin = isAdminActor(ctx)
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!task) throw new HttpError(404, 'Tâche introuvable.')
  const data = bodyOf<{ assignedUserId?: string; name?: string; clientPriceShare?: number; memberPayout?: number }>(ctx)
  // Rôle du responsable final (nouveau ou actuel) : l'admin ne perçoit pas de rémunération membre.
  const targetUserId = data.assignedUserId ?? task.assignedUserId
  const member = await prisma.user.findFirst({ where: { id: targetUserId, archivedAt: null, isActive: true, role: { not: 'CLIENT' } } })
  if (data.assignedUserId && !member) throw new HttpError(404, 'Membre introuvable ou inactif.')
  // Un assistant peut réassigner ou renommer une tâche, mais ne touche jamais aux montants.
  const updated = await prisma.task.update({ where: { id: task.id }, data: { assignedUserId: data.assignedUserId ?? undefined, name: data.name ?? undefined, ...(isAdmin ? { clientPriceShare: data.clientPriceShare ?? undefined, memberPayout: member?.role === 'ADMIN' ? null : data.memberPayout ?? undefined } : {}) }, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.update', entity: 'Task', entityId: updated.id, payload: data })
  sendJson(ctx.res, 200, { task: toTask(updated, { includeMargin: isAdmin, includePayout: payoutVisible(ctx, updated.assignedUserId) }) })
}
const archiveTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!task) throw new HttpError(404, 'Tâche introuvable.')
  await prisma.task.update({ where: { id: task.id }, data: { archivedAt: new Date() } })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.archive', entity: 'Task', entityId: task.id })
  sendJson(ctx.res, 204, {})
}
const updateOwnTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null }, include: { reviews: { orderBy: { reviewedAt: 'desc' }, take: 1 } } })
  if (!task || task.assignedUserId !== ctx.actor?.id) throw new HttpError(404, 'Tâche introuvable.')
  if (task.reviews[0]?.decision === 'APPROVED') throw new HttpError(409, 'Cette tâche a été validée par l’admin : son statut est désormais verrouillé.')
  const data = bodyOf<{ status: TaskSummary['status']; proofLink?: string }>(ctx)
  // Une preuve déjà enregistrée est conservée si le client n'en renvoie pas (cycle de statut rapide depuis « Mes tâches »).
  const nextProof = typeof data.proofLink === 'string' ? data.proofLink.trim() || null : task.proofLink
  if (data.status === 'COMPLETED' && !nextProof) throw new HttpError(400, 'Une preuve (lien photo ou vidéo) est obligatoire pour terminer la tâche.')
  const updated = await prisma.task.update({ where: { id: task.id }, data: { status: data.status, proofLink: nextProof, completedAt: data.status === 'COMPLETED' ? task.completedAt ?? new Date() : null }, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.progress', entity: 'Task', entityId: task.id, payload: { status: data.status } })
  sendJson(ctx.res, 200, { task: toTask(updated, { includeMargin: false, includePayout: payoutVisible(ctx, updated.assignedUserId) }) })
}
/** Versement total ou partiel (tranche) : l'historique est conservé et un reçu est émis à chaque versement. */
const payTaskPayout = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null }, include: { assignedUser: { select: { name: true } }, activity: { include: { project: { include: { client: true } } } }, payouts: { select: { amount: true } } } })
  if (!task) throw new HttpError(404, 'Tâche introuvable.')
  if (!task.memberPayout || task.memberPayout <= 0) throw new HttpError(400, 'Aucune rémunération n’est prévue pour cette tâche.')
  const data = bodyOf<{ amount: number; method?: 'CASH' | 'MOMO' | 'BANK'; reference?: string; note?: string }>(ctx)
  const recordedTotal = task.payouts.reduce((total, item) => total + item.amount, 0)
  // Rétrocompatibilité : une tâche payée avant l'historique est considérée comme entièrement réglée.
  const alreadyPaid = recordedTotal > 0 ? recordedTotal : task.payoutPaidAt ? task.memberPayout : 0
  const remaining = task.memberPayout - alreadyPaid
  if (remaining <= 0) throw new HttpError(409, 'Cette rémunération est déjà entièrement payée.')
  if (data.amount > remaining) throw new HttpError(400, `Le montant dépasse le reste à payer (${formatAmount(remaining)}).`)
  const settings = await prisma.studioSettings.upsert({ where: { id: 'studio' }, update: {}, create: {} })
  const number = await receiptNumber(settings.receiptPrefix)
  await prisma.receipt.create({ data: { number, type: 'CUSTOM', projectId: task.activity.projectId, amount: data.amount, snapshot: { documentType: 'MEMBER_PAYOUT_RECEIPT', studioName: settings.name, clientName: task.activity.project.client.name, taskName: task.name, memberName: task.assignedUser.name, amount: data.amount, paidTotal: alreadyPaid + data.amount, memberPayout: task.memberPayout }, createdById: ctx.actor?.id ?? null } })
  const payout = await prisma.taskPayout.create({ data: { taskId: task.id, amount: data.amount, method: data.method ?? 'CASH', reference: data.reference?.trim() || null, note: data.note?.trim() || null, receiptNumber: number, paidById: ctx.actor?.id ?? null } })
  const updated = await prisma.task.update({ where: { id: task.id }, data: { payoutPaidAt: payout.paidAt }, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: 'task.payout_paid', entity: 'Task', entityId: task.id, payload: { amount: data.amount, remaining: remaining - data.amount } })
  sendJson(ctx.res, 200, { task: toTask(updated, { includeMargin: isAdminActor(ctx), includePayout: true }) })
}
/** Validation (APPROVED) ou renvoi (RETURNED : raison + corrections demandées) d'une tâche terminée — admin. */
const reviewTask = async (ctx: RouteContext): Promise<void> => {
  const task = await prisma.task.findFirst({ where: { id: ctx.params.id, archivedAt: null }, include: taskInclude })
  if (!task) throw new HttpError(404, 'Tâche introuvable.')
  if (task.status !== 'COMPLETED') throw new HttpError(400, 'La tâche doit être terminée avant d’être validée ou renvoyée.')
  const data = bodyOf<{ decision: 'APPROVED' | 'RETURNED'; note?: string }>(ctx)
  const last = task.reviews[0]
  if (data.decision === 'APPROVED' && last?.decision === 'APPROVED') throw new HttpError(409, 'Cette tâche a déjà été validée.')
  const note = data.note?.trim() || null
  if (data.decision === 'RETURNED' && !note) throw new HttpError(422, 'Indiquez la raison du renvoi et les corrections attendues.')
  await prisma.taskReview.create({ data: { taskId: task.id, decision: data.decision, note, reviewedById: ctx.actor?.id ?? null } })
  // Un renvoi repose la tâche en « À faire » pour que le membre reparte sur des bases claires.
  const updated = await prisma.task.update({ where: { id: task.id }, data: data.decision === 'RETURNED' ? { status: 'PENDING', completedAt: null } : {}, include: taskInclude })
  await recordAudit({ actorId: ctx.actor?.id, action: data.decision === 'APPROVED' ? 'task.approved' : 'task.returned', entity: 'Task', entityId: task.id, payload: { note } })
  sendJson(ctx.res, 200, { task: toTask(updated, { includeMargin: isAdminActor(ctx), includePayout: payoutVisible(ctx, task.assignedUserId) }) })
}
export const taskRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/tasks', auth: true, middlewares: [requireAuth], handler: listTasks },
  { method: 'GET', path: '/api/tasks/:id', auth: true, middlewares: [requireAuth], handler: getTask },
  { method: 'POST', path: '/api/tasks', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT'), validateBody(createTaskSchema)], handler: createTask },
  { method: 'PATCH', path: '/api/tasks/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT'), validateBody(updateTaskSchema)], handler: updateTask },
  { method: 'PATCH', path: '/api/tasks/:id/progress', auth: true, middlewares: [requireAuth, validateBody(updateOwnTaskSchema)], handler: updateOwnTask },
  { method: 'POST', path: '/api/tasks/:id/payout', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(payoutTaskSchema)], handler: payTaskPayout },
  { method: 'POST', path: '/api/tasks/:id/review', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(reviewTaskSchema)], handler: reviewTask },
  { method: 'DELETE', path: '/api/tasks/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: archiveTask },
]
