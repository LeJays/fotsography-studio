import type { TaskSummary } from '../../shared/types.ts'

/** Dernière décision de l'admin — l'historique est trié du plus récent au plus ancien. */
const lastReview = (task: TaskSummary) => task.reviews?.[0]

/** Terminée : livrée au moins une fois (statut actuel « Terminée » ou historique de validation). */
export const wasDelivered = (task: TaskSummary): boolean =>
  task.status === 'COMPLETED' || (task.reviews?.length ?? 0) > 0

/** Validée : la dernière décision de l'admin est une approbation. */
export const isApproved = (task: TaskSummary): boolean =>
  lastReview(task)?.decision === 'APPROVED'

/** Renvoyée au moins une fois par l'admin (corrections demandées). */
export const wasReturned = (task: TaskSummary): boolean =>
  task.reviews?.some((review) => review.decision === 'RETURNED') ?? false

/** Validée du premier coup : approuvée sans aucun renvoi préalable. */
export const isFirstPassApproval = (task: TaskSummary): boolean =>
  isApproved(task) && !wasReturned(task)

/** Pourcentage arrondi, protégé contre la division par zéro. */
export const percent = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0

/** Agrégats utilisés par le graphe comparatif du tableau de bord admin. */
export interface TaskStudyStats {
  total: number
  delivered: number
  approved: number
  approvedFirstPass: number
  returned: number
}

export const computeStudyStats = (tasks: TaskSummary[]): TaskStudyStats => ({
  total: tasks.length,
  delivered: tasks.filter(wasDelivered).length,
  approved: tasks.filter(isApproved).length,
  approvedFirstPass: tasks.filter(isFirstPassApproval).length,
  returned: tasks.filter(wasReturned).length,
})

/** Ligne du classement des membres. */
export interface MemberStudyStats extends TaskStudyStats {
  userId: string
  name: string
  /** % de tâches validées (validées / total). */
  approvalRate: number
  /** % de tâches validées du premier coup (validées 1er coup / total) — critère de classement. */
  firstPassRate: number
}

/**
 * Statistiques par membre, triées par % validées du premier coup puis par volume :
 * à égalité de %, le membre ayant le plus de validations du premier coup remonte.
 */
export const computeMemberStats = (tasks: TaskSummary[]): MemberStudyStats[] => {
  const groups = new Map<string, TaskSummary[]>()
  for (const task of tasks) {
    const group = groups.get(task.assignedUserId)
    if (group) group.push(task)
    else groups.set(task.assignedUserId, [task])
  }
  return [...groups.entries()]
    .map(([userId, memberTasks]) => {
      const stats = computeStudyStats(memberTasks)
      return {
        userId,
        name: memberTasks[0]?.assignedUserName ?? 'Membre',
        ...stats,
        approvalRate: percent(stats.approved, stats.total),
        firstPassRate: percent(stats.approvedFirstPass, stats.total),
      }
    })
    .sort(
      (a, b) =>
        b.firstPassRate - a.firstPassRate ||
        b.approvedFirstPass - a.approvedFirstPass ||
        b.approved - a.approved ||
        b.total - a.total,
    )
}
