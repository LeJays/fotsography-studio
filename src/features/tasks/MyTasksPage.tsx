import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, CircleCheck, ListChecks, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { TaskSummary } from '../../../shared/types.ts'
import { Button, Card, CardGridSkeleton, EmptyState, Field, Input, Modal, PageHeader, useToast } from '../../components/ui'
import { ApiError, fetchMyTasks, updateOwnTaskApi } from '../../lib/api'
import { lastReview, nextStatus, StatusPill } from './taskStatus'

export const MyTasksPage = () => {
  const toast = useToast()
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [proofTask, setProofTask] = useState<TaskSummary | null>(null)
  const [proofLink, setProofLink] = useState('')

  const load = useCallback(async () => {
    try {
      setTasks((await fetchMyTasks()).tasks)
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Chargement des tâches impossible.')
    } finally {
      setLoading(false)
    }
  }, [toast])
  useEffect(() => { void load() }, [load])

  /** Fait avancer le statut d'un cran : À faire → En cours → Terminée (boucle). */
  const cycle = async (task: TaskSummary) => {
    if (busyId) return
    const target = nextStatus(task.status)
    // Terminer une tâche exige une preuve : si aucune n'existe encore, on demande son lien.
    if (target === 'COMPLETED' && !task.proofLink) {
      setProofTask(task)
      setProofLink('')
      return
    }
    setBusyId(task.id)
    try {
      await updateOwnTaskApi(task.id, { status: target })
      toast.success(`« ${task.name} » : statut mis à jour.`)
      await load()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.')
    } finally {
      setBusyId(null)
    }
  }

  const submitProof = async (event: FormEvent) => {
    event.preventDefault()
    if (!proofTask) return
    const link = proofLink.trim()
    if (!link) {
      toast.error('Ajoutez le lien de la preuve avant de terminer la tâche.')
      return
    }
    setBusyId(proofTask.id)
    try {
      await updateOwnTaskApi(proofTask.id, { status: 'COMPLETED', proofLink: link })
      toast.success(`« ${proofTask.name} » marquée comme terminée.`)
      setProofTask(null)
      await load()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes tâches"
        subtitle="Cliquez sur le statut (en haut à droite de chaque carte) pour faire avancer la tâche : à faire → en cours → terminée."
      />
      {loading ? (
        <CardGridSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Aucune tâche pour le moment" description="Vos tâches assignées apparaîtront ici." />
      ) : (
        <div className="studio-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const review = lastReview(task)
            const returned = review?.decision === 'RETURNED' && task.status !== 'COMPLETED'
            const approved = review?.decision === 'APPROVED' && task.status === 'COMPLETED'
            const paid = (task.paidPayout ?? 0) > 0
            const fullyPaid = paid && (task.payoutRemaining ?? 0) === 0
            return (
              <Card key={task.id} className="flex h-full flex-col space-y-3 transition duration-200 hover:-translate-y-0.5 hover:border-studio-gold/40 hover:shadow-studio-lift">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-studio-terracotta">{task.projectName} · {task.activityName}</p>
                    <h2 className="mt-1 font-serif text-lg font-bold">
                      <Link to={`/taches/${task.id}`} className="hover:text-studio-terracotta">{task.name}</Link>
                    </h2>
                    {task.description ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-studio-dark/60">{task.description}</p>
                    ) : null}
                  </div>
                  <StatusPill task={task} onCycle={cycle} />
                </div>
                <p className="flex gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-studio-terracotta" />
                  À livrer le {formatDate(task.deliveryDate)}
                </p>
                {returned ? (
                  <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span><strong>Renvoyée :</strong> {review?.note}</span>
                  </p>
                ) : null}
                {approved ? (
                  <p className="flex items-start gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                    <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Validée par l’admin.
                  </p>
                ) : null}
                <div className="mt-auto border-t border-studio-dark/10 pt-3">
                  <p className="text-xs text-studio-dark/45">Ma rémunération</p>
                  <strong className={fullyPaid ? 'text-green-700' : 'text-studio-dark'}>{formatAmount(task.memberPayout ?? 0)}</strong>
                  <p className="mt-1 flex items-center gap-1 text-xs text-studio-dark/55">
                    {fullyPaid ? (
                      <><CircleCheck className="h-3.5 w-3.5 text-green-700" />Payée intégralement</>
                    ) : paid ? (
                      <>Versé {formatAmount(task.paidPayout ?? 0)} · reste {formatAmount(task.payoutRemaining ?? 0)}</>
                    ) : (
                      'En attente de paiement'
                    )}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <Modal
        open={proofTask !== null}
        title="Preuve de réalisation"
        subtitle={`Ajoutez le lien de la photo ou de la vidéo pour terminer « ${proofTask?.name ?? ''} ».`}
        onClose={() => setProofTask(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setProofTask(null)}>Annuler</Button>
            <Button onClick={(event) => void submitProof(event)} loading={busyId === proofTask?.id}>Marquer terminée</Button>
          </>
        }
      >
        <form onSubmit={submitProof} className="space-y-4">
          <Field label="Lien de la preuve (photo ou vidéo)">
            <Input
              type="url"
              required
              autoFocus
              placeholder="https://…"
              value={proofLink}
              onChange={(event) => setProofLink(event.target.value)}
            />
          </Field>
          <p className="text-xs text-studio-dark/50">La tâche passera en « Terminée » et sera soumise à la validation de l’admin.</p>
        </form>
      </Modal>
      <p className="text-xs text-studio-dark/45">Les montants facturés au client restent confidentiels.</p>
    </div>
  )
}
