import { formatAmount } from '../../shared/money.ts'
import { payPenaltySchema } from '../../shared/schemas/task.ts'
import type { PenaltyMemberSummary, PenaltyOverview, PenaltyPaymentSummary, PenaltyTaskSummary } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'
import {
  describePenalty,
  loadPenaltySettings,
  memberPenaltyBalance,
  syncMemberPenalties,
  syncTaskPenalty,
  type PenaltyPaymentRow,
} from '../services/penalties.ts'

/** Sérialise un règlement de pénalité pour l'historique de traçabilité. */
const toPayment = (row: PenaltyPaymentRow): PenaltyPaymentSummary => ({
  id: row.id,
  userId: row.userId,
  userName: row.user?.name ?? '—',
  amount: row.amount,
  kind: row.kind,
  method: row.method,
  reference: row.reference,
  note: row.note,
  taskId: row.taskId,
  taskName: row.task?.name ?? null,
  receiptNumber: row.receiptNumber,
  paidAt: row.paidAt.toISOString(),
  paidByName: row.paidBy?.name ?? null,
})

/** Vue d'ensemble (admin + assistant) : soldes par membre, tâches pénalisées et historique des règlements. */
const overview = async (ctx: RouteContext): Promise<void> => {
  const settings = await loadPenaltySettings()
  const now = new Date()

  // 1. Synchronise tous les cumuls encore en cours (idempotent).
  const running = await prisma.task.findMany({
    where: { latePenaltyFinalizedAt: null },
    include: { assignedUser: { select: { id: true, name: true, role: true } } },
  })
  for (const task of running) await syncTaskPenalty(task, settings, now)

  // 2. Tâches ayant accumulé une pénalité (y compris archivées : la dette reste due).
  const penalized = await prisma.task.findMany({
    where: { latePenaltyAccrued: { gt: 0 } },
    include: {
      assignedUser: { select: { id: true, name: true, role: true } },
      activity: { select: { name: true, project: { select: { eventName: true } } } },
    },
    orderBy: { deliveryDate: 'desc' },
  })

  // 3. Historique complet des règlements (paiements directs + déductions sur versements).
  const payments = await prisma.penaltyPayment.findMany({
    orderBy: { paidAt: 'desc' },
    include: {
      user: { select: { name: true } },
      paidBy: { select: { name: true } },
      task: { select: { name: true } },
    },
  })

  // 4. Regroupe par membre : accumulé, payé, solde dû.
  const members = new Map<string, PenaltyMemberSummary>()
  const taskLists = new Map<string, PenaltyTaskSummary[]>()
  for (const task of penalized) {
    const snapshot = describePenalty(task, settings, now)
    const entry = members.get(task.assignedUser.id) ?? {
      userId: task.assignedUser.id,
      name: task.assignedUser.name,
      role: task.assignedUser.role as PenaltyMemberSummary['role'],
      accrued: 0,
      paid: 0,
      balance: 0,
      tasks: [],
    }
    entry.accrued += task.latePenaltyAccrued
    members.set(entry.userId, entry)
    const list = taskLists.get(entry.userId) ?? []
    list.push({
      id: task.id,
      name: task.name,
      projectName: task.activity.project.eventName,
      activityName: task.activity.name,
      deliveryDate: task.deliveryDate.toISOString(),
      status: task.status,
      blocks: snapshot.blocks,
      accrued: task.latePenaltyAccrued,
      daysLate: snapshot.daysLate,
      running: snapshot.running,
      finalizedAt: task.latePenaltyFinalizedAt?.toISOString() ?? null,
    })
    taskLists.set(entry.userId, list)
  }

  const paidByMember = new Map<string, number>()
  for (const payment of payments) {
    paidByMember.set(payment.userId, (paidByMember.get(payment.userId) ?? 0) + payment.amount)
    if (!members.has(payment.userId)) {
      const user = await prisma.user.findFirst({ where: { id: payment.userId }, select: { name: true, role: true } })
      if (user) {
        members.set(payment.userId, {
          userId: payment.userId,
          name: user.name,
          role: user.role,
          accrued: 0,
          paid: 0,
          balance: 0,
          tasks: [],
        })
      }
    }
  }

  const rows = [...members.values()].map((member) => {
    const paid = paidByMember.get(member.userId) ?? 0
    return { ...member, paid, balance: Math.max(0, member.accrued - paid), tasks: taskLists.get(member.userId) ?? [] }
  })
  rows.sort((a, b) => b.balance - a.balance || b.accrued - a.accrued)

  const totals = rows.reduce(
    (acc, member) => ({ accrued: acc.accrued + member.accrued, paid: acc.paid + member.paid, balance: acc.balance + member.balance }),
    { accrued: 0, paid: 0, balance: 0 },
  )

  const payload: PenaltyOverview = {
    enabled: settings.enabled,
    amount: settings.amount,
    intervalDays: settings.intervalDays,
    totals,
    members: rows,
    payments: payments.map(toPayment),
  }
  sendJson(ctx.res, 200, { overview: payload })
}

/**
 * Paiement (total ou partiel) d'une pénalité — par l'admin ou l'assistant.
 * Chaque règlement est enregistré pour la traçabilité ; le solde se met à jour tout seul.
 */
const payPenalty = async (ctx: RouteContext): Promise<void> => {
  const settings = await loadPenaltySettings()
  const data = bodyOf<{ userId: string; amount: number; method?: 'CASH' | 'MOMO' | 'BANK'; reference?: string; note?: string }>(ctx)
  const member = await prisma.user.findFirst({ where: { id: data.userId, archivedAt: null } })
  if (!member) throw new HttpError(404, 'Membre introuvable.')
  if (member.role === 'ADMIN' || member.role === 'CLIENT') throw new HttpError(400, 'Ce membre ne peut pas être redevable d’une pénalité.')

  // Synchronise les cumuls du membre avant de contrôler le solde.
  await syncMemberPenalties(member.id, settings)
  const { balance } = await memberPenaltyBalance(member.id)
  if (balance <= 0) throw new HttpError(409, 'Aucune pénalité n’est due par ce membre.')
  if (data.amount > balance) throw new HttpError(400, `Le montant dépasse le solde dû (${formatAmount(balance)}).`)

  const payment = await prisma.penaltyPayment.create({
    data: {
      userId: member.id,
      amount: data.amount,
      kind: 'MANUAL',
      method: data.method ?? 'CASH',
      reference: data.reference?.trim() || null,
      note: data.note?.trim() || null,
      paidById: ctx.actor?.id ?? null,
    },
    include: {
      user: { select: { name: true } },
      paidBy: { select: { name: true } },
      task: { select: { name: true } },
    },
  })
  await recordAudit({
    actorId: ctx.actor?.id,
    action: 'penalty.payment',
    entity: 'PenaltyPayment',
    entityId: payment.id,
    payload: { userId: member.id, amount: data.amount, balanceAfter: balance - data.amount },
  })
  sendJson(ctx.res, 201, { payment: toPayment(payment), balance: balance - data.amount })
}

export const penaltyRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/penalties', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT')], handler: overview },
  { method: 'POST', path: '/api/penalties/payments', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT'), validateBody(payPenaltySchema)], handler: payPenalty },
]
