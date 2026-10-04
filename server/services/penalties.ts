import { startOfDay } from '../../shared/dates.ts'
import { prisma } from '../db.ts'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Réglages de pénalité de retard effectifs. */
export interface PenaltySettings {
  enabled: boolean
  amount: number
  intervalDays: number
}

/** Charge les réglages studio (upsert idempotent) et en dérive les paramètres de pénalité. */
export const loadPenaltySettings = async (): Promise<PenaltySettings> => {
  const settings = await prisma.studioSettings.upsert({ where: { id: 'studio' }, update: {}, create: {} })
  return {
    enabled: settings.latePenaltyEnabled,
    amount: Math.max(0, settings.latePenaltyAmount),
    intervalDays: Math.max(1, settings.latePenaltyIntervalDays),
  }
}

/** Ligne de tâche minimale nécessaire au calcul / à la synchronisation d'une pénalité. */
export interface PenaltyTaskRow {
  id: string
  deliveryDate: Date
  status: 'PENDING' | 'IN_REVIEW' | 'COMPLETED'
  archivedAt: Date | null
  latePenaltyBlocks: number
  latePenaltyAccrued: number
  latePenaltyFinalizedAt: Date | null
  assignedUser: { id: string; name: string; role: string }
}

/** État du cumul de pénalité d'une tâche au moment du calcul. */
export interface PenaltySnapshot {
  daysLate: number
  blocks: number
  accrued: number
  /** La date est dépassée, le travail pas encore envoyé et l'option active. */
  running: boolean
  finalizedAt: Date | null
  /** La cible calculée diffère de la base : une écriture est nécessaire. */
  changed: boolean
}

/** Jours calendaires entiers de retard (minuit UTC de la date de livraison → `now`). */
export const lateDays = (deliveryDate: Date, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - startOfDay(deliveryDate).getTime()) / MS_PER_DAY))

/**
 * Calcule l'état du cumul sans écrire en base.
 *
 * Règles :
 * - l'option est active et la tâche est assignée à un membre (pas à l'admin) ;
 * - premier cumul dès 1 jour de retard, puis une tranche tous les `intervalDays` jours
 *   → `ceil(joursRetard / intervalDays) × montant` ;
 * - le cumul ne diminue jamais (une date repoussée après coup ne gomme pas l'acquis) ;
 * - le cumul se fige (travail envoyé, tâche archivée) mais les dettes déjà acquises restent ;
 * - si l'option est décochée, aucun nouveau cumul n'est ajouté, les dettes restent dues.
 */
export const describePenalty = (task: PenaltyTaskRow, settings: PenaltySettings, now: Date = new Date()): PenaltySnapshot => {
  const daysLate = lateDays(task.deliveryDate, now)

  // Déjà figé : le cumul est acquis, on ne touche plus rien.
  if (task.latePenaltyFinalizedAt) {
    return { daysLate, blocks: task.latePenaltyBlocks, accrued: task.latePenaltyAccrued, running: false, finalizedAt: task.latePenaltyFinalizedAt, changed: false }
  }

  const eligible = settings.enabled && task.assignedUser.role !== 'ADMIN'
  // Dernier cumul à l'instant de la finalisation (travail envoyé ou tâche archivée).
  if (task.archivedAt || task.status !== 'PENDING') {
    let blocks = task.latePenaltyBlocks
    let accrued = task.latePenaltyAccrued
    if (eligible && daysLate >= 1) {
      const target = Math.ceil(daysLate / settings.intervalDays)
      if (target > blocks) {
        accrued += (target - blocks) * settings.amount
        blocks = target
      }
    }
    return { daysLate, blocks, accrued, running: false, finalizedAt: now, changed: true }
  }

  if (!eligible) {
    return { daysLate, blocks: task.latePenaltyBlocks, accrued: task.latePenaltyAccrued, running: false, finalizedAt: null, changed: false }
  }

  const target = daysLate >= 1 ? Math.ceil(daysLate / settings.intervalDays) : 0
  if (target > task.latePenaltyBlocks) {
    const accrued = task.latePenaltyAccrued + (target - task.latePenaltyBlocks) * settings.amount
    return { daysLate, blocks: target, accrued, running: true, finalizedAt: null, changed: true }
  }
  return { daysLate, blocks: task.latePenaltyBlocks, accrued: task.latePenaltyAccrued, running: daysLate >= 1, finalizedAt: null, changed: false }
}

/**
 * Calcule le cumul ET le persiste si nécessaire (appel idempotent).
 * À enchaîner sur les lectures/écritures de tâches pour que les chiffres soient toujours à jour.
 */
export const syncTaskPenalty = async (task: PenaltyTaskRow, settings: PenaltySettings, now: Date = new Date()): Promise<PenaltySnapshot> => {
  const snapshot = describePenalty(task, settings, now)
  if (!snapshot.changed) return snapshot
  await prisma.task.update({
    where: { id: task.id },
    data: { latePenaltyBlocks: snapshot.blocks, latePenaltyAccrued: snapshot.accrued, latePenaltyFinalizedAt: snapshot.finalizedAt },
  })
  return snapshot
}

/** Synchronise toutes les tâches non finalisées d'un membre (utilisé avant un solde ou un paiement). */
export const syncMemberPenalties = async (userId: string, settings: PenaltySettings): Promise<void> => {
  const tasks = await prisma.task.findMany({
    where: { assignedUserId: userId, latePenaltyFinalizedAt: null },
    include: { assignedUser: { select: { id: true, name: true, role: true } } },
  })
  for (const task of tasks) await syncTaskPenalty(task, settings)
}

/** Ligne `PenaltyPayment` avec les relations utilisées par les sérialiseurs. */
export interface PenaltyPaymentRow {
  id: string
  userId: string
  amount: number
  kind: 'MANUAL' | 'WITHDRAWN'
  method: 'CASH' | 'MOMO' | 'BANK'
  reference: string | null
  note: string | null
  taskId: string | null
  receiptNumber: string | null
  paidAt: Date
  user?: { name: string } | null
  paidBy?: { name: string } | null
  task?: { name: string } | null
}

/** Solde de pénalités d'un membre : total accumulé sur ses tâches − règlements enregistrés. */
export const memberPenaltyBalance = async (
  userId: string,
): Promise<{ accrued: number; paid: number; balance: number }> => {
  const tasks = await prisma.task.findMany({
    where: { assignedUserId: userId, latePenaltyAccrued: { gt: 0 } },
    select: { latePenaltyAccrued: true },
  })
  const accrued = tasks.reduce((total, task) => total + task.latePenaltyAccrued, 0)
  const payments = await prisma.penaltyPayment.aggregate({ where: { userId }, _sum: { amount: true } })
  const paid = payments._sum.amount ?? 0
  return { accrued, paid, balance: Math.max(0, accrued - paid) }
}
