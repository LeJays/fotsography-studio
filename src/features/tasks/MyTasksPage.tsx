import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CircleCheck, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { TaskSummary } from '../../../shared/types.ts'
import { Alert, Badge, Card, EmptyState, PageHeader } from '../../components/ui'
import { ApiError, fetchTasks } from '../../lib/api'

export const MyTasksPage = () => {
  const [tasks, setTasks] = useState<TaskSummary[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { try { setTasks((await fetchTasks()).tasks) } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Chargement des tâches impossible.') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  return <div className="space-y-6"><PageHeader title="Mes tâches" subtitle="Ouvrez une tâche pour mettre à jour son avancement, ajouter votre preuve et consulter son paiement." />{error ? <Alert tone="error">{error}</Alert> : null}{loading ? <Card className="p-12 text-center text-sm text-studio-dark/55">Chargement de vos tâches…</Card> : tasks.length === 0 ? <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Aucune tâche pour le moment" description="Vos tâches assignées apparaîtront ici." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => <Link key={task.id} to={`/taches/${task.id}`} className="block"><Card className="h-full space-y-3 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-studio-terracotta">{task.projectName} · {task.activityName}</p><h2 className="mt-1 font-serif text-lg font-bold">{task.name}</h2></div><Badge tone={task.status === 'COMPLETED' ? 'green' : task.status === 'IN_REVIEW' ? 'gold' : 'gray'}>{task.status === 'PENDING' ? 'À faire' : task.status === 'IN_REVIEW' ? 'En cours' : 'Terminée'}</Badge></div><p className="flex gap-2 text-sm"><CalendarDays className="h-4 w-4 text-studio-terracotta" />À livrer le {formatDate(task.deliveryDate)}</p><div className="border-t border-studio-dark/10 pt-3"><p className="text-xs text-studio-dark/45">Ma rémunération</p><strong className={task.payoutPaidAt ? 'text-green-700' : 'text-studio-dark'}>{formatAmount(task.memberPayout ?? 0)}</strong><p className="mt-1 flex items-center gap-1 text-xs text-studio-dark/55">{task.payoutPaidAt ? <><CircleCheck className="h-3.5 w-3.5 text-green-700" />Payée</> : 'En attente de paiement'}</p></div></Card></Link>)}</div>}<p className="text-xs text-studio-dark/45">Les montants facturés au client restent confidentiels.</p></div>
}
