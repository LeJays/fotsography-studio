import type { TaskSummary } from '../../../shared/types.ts'
import { Badge } from '../../components/ui'

export const STATUS_LABELS: Record<TaskSummary['status'], string> = {
  PENDING: 'À faire',
  IN_REVIEW: 'En cours',
  COMPLETED: 'Terminée',
}

export const STATUS_TONES: Record<TaskSummary['status'], 'gray' | 'gold' | 'green'> = {
  PENDING: 'gray',
  IN_REVIEW: 'gold',
  COMPLETED: 'green',
}

/** Chaîne de progression : À faire → En cours → Terminée (puis retour à À faire). */
export const nextStatus = (status: TaskSummary['status']): TaskSummary['status'] =>
  status === 'PENDING' ? 'IN_REVIEW' : status === 'IN_REVIEW' ? 'COMPLETED' : 'PENDING'

/** Dernière décision de l'admin sur la tâche, s'il y en a une. */
export const lastReview = (task: TaskSummary) => task.reviews?.[0]

/**
 * Statut de la tâche.
 * - Validée par l'admin : badge vert verrouillé.
 * - `onCycle` fourni : pastille cliquable qui fait avancer le statut d'un cran.
 * - Sinon : simple badge d'affichage.
 */
export const StatusPill = ({ task, onCycle }: { task: TaskSummary; onCycle?: (task: TaskSummary) => void }) => {
  const review = lastReview(task)
  if (review?.decision === 'APPROVED' && task.status === 'COMPLETED') {
    return <Badge tone="green">Validée</Badge>
  }
  if (!onCycle) return <Badge tone={STATUS_TONES[task.status]}>{STATUS_LABELS[task.status]}</Badge>
  return (
    <button
      type="button"
      title={`Statut actuel : ${STATUS_LABELS[task.status]} — cliquer pour passer à ${STATUS_LABELS[nextStatus(task.status)]}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onCycle(task)
      }}
      className="rounded-full outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-studio-gold/50"
    >
      <Badge tone={STATUS_TONES[task.status]}>{STATUS_LABELS[task.status]} →</Badge>
    </button>
  )
}
