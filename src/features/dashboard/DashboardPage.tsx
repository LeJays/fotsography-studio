import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleDollarSign, Clock3, FolderKanban, ListChecks, TriangleAlert } from 'lucide-react'
import { formatDateShort } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { FinanceOverview, OperationsOverview, ProjectSummary, TaskSummary } from '../../../shared/types.ts'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { ApiError, fetchFinances, fetchOperationsOverview, fetchProjects, fetchTasks } from '../../lib/api'

const emptyFinance: FinanceOverview = { totalRevenue: 0, collected: 0, remaining: 0, expenses: 0, memberPayouts: 0, netMargin: 0, projects: [], members: [] }
const emptyOperations: OperationsOverview = { projects: [], totalTaskCount: 0, pendingTaskCount: 0, reviewTaskCount: 0, completedTaskCount: 0 }
const paymentPercent = (project: ProjectSummary) => project.totalAmount ? Math.min(100, Math.round((project.paidAmount / project.totalAmount) * 100)) : 0
const paymentColor = (value: number) => value >= 100 ? 'bg-green-600' : value >= 50 ? 'bg-studio-gold' : 'bg-red-500'
const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
const timeLabel = (date: string | null) => {
  if (!date) return 'Aucune tâche en attente'
  const days = daysUntil(date)
  if (days < 0) return `${Math.abs(days)} j de retard`
  if (days === 0) return 'À livrer aujourd’hui'
  if (days === 1) return 'À livrer demain'
  return `${days} j de marge`
}
const timeTone = (date: string | null): 'red' | 'gold' | 'green' | 'gray' => {
  if (!date) return 'gray'
  const days = daysUntil(date)
  return days < 0 ? 'red' : days <= 3 ? 'gold' : 'green'
}

export const DashboardPage = () => {
  const { user, isAdmin } = useAuth()
  const isAssistant = user?.role === 'ASSISTANT'
  const [finance, setFinance] = useState(emptyFinance)
  const [operations, setOperations] = useState(emptyOperations)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      if (isAdmin) {
        const [financeResponse, projectResponse, taskResponse] = await Promise.all([fetchFinances(), fetchProjects(), fetchTasks()])
        setFinance(financeResponse.overview); setProjects(projectResponse.projects); setTasks(taskResponse.tasks)
      } else if (isAssistant) {
        setOperations((await fetchOperationsOverview()).overview)
      } else {
        setTasks((await fetchTasks()).tasks)
      }
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Chargement du tableau de bord impossible.')
    } finally { setLoading(false) }
  }, [isAdmin, isAssistant])

  useEffect(() => { void load() }, [load])

  const upcoming = useMemo(() => [...tasks].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)).slice(0, 5), [tasks])
  const active = projects.filter((project) => project.status === 'IN_PROGRESS').slice(0, 5)
  const atRisk = operations.projects.filter((project) => project.nextTaskDeliveryDate && daysUntil(project.nextTaskDeliveryDate) <= 3 && project.completedTaskCount < project.taskCount)

  return <div className="space-y-6">
    <PageHeader
      title={`Bonjour ${user?.name.split(' ')[0] ?? ''} 👋`}
      subtitle={isAdmin ? 'Vue opérationnelle et financière du studio.' : isAssistant ? 'Pilotage opérationnel des projets, sans données financières.' : 'Vos prochaines tâches et échéances.'}
      actions={isAdmin ? <Link to="/projets"><Button size="sm">Nouveau projet</Button></Link> : null}
    />
    {error ? <Alert tone="error">{error}</Alert> : null}
    {loading ? <Card className="p-12 text-center text-sm text-studio-dark/55">Chargement du tableau de bord…</Card> : isAdmin ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Projets en cours" value={active.length.toString()} icon={<FolderKanban className="h-5 w-5" />} /><StatCard label="Encaissé" value={formatAmount(finance.collected)} icon={<CircleDollarSign className="h-5 w-5" />} /><StatCard label="Reste à encaisser" value={formatAmount(finance.remaining)} /><StatCard label="Marge nette" value={formatAmount(finance.netMargin)} /></div>
      <div className="grid gap-5 xl:grid-cols-2"><Card><h2 className="font-serif text-xl font-bold">Projets à suivre</h2><div className="mt-4 space-y-4">{active.length ? active.map((project) => <Link key={project.id} to={`/projets/${project.id}`} className="block rounded-lg border border-studio-dark/10 p-3 hover:bg-studio-dark/[0.02]"><div className="flex justify-between gap-3"><div><strong>{project.eventName}</strong><p className="text-xs text-studio-dark/50">{project.clientName}</p></div><span className="text-sm font-semibold">{formatAmount(project.remainingAmount)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-studio-dark/10"><div className={`h-full ${paymentColor(paymentPercent(project))}`} style={{ width: `${paymentPercent(project)}%` }} /></div></Link>) : <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="Aucun projet en cours" description="Les projets actifs apparaîtront ici." />}</div></Card><Card><h2 className="font-serif text-xl font-bold">Prochaines échéances</h2><div className="mt-4 space-y-3">{upcoming.length ? upcoming.map((task) => <div key={task.id} className="flex items-center justify-between gap-3 border-b border-studio-dark/10 pb-3"><div><strong className="text-sm">{task.name}</strong><p className="text-xs text-studio-dark/50">{task.assignedUserName} · {task.projectName}</p></div><span className="text-xs font-semibold text-studio-terracotta">{formatDateShort(task.deliveryDate)}</span></div>) : <EmptyState icon={<ListChecks className="h-5 w-5" />} title="Aucune échéance" description="Les tâches attribuées apparaîtront ici." />}</div></Card></div>
    </> : isAssistant ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Projets actifs" value={operations.projects.filter((project) => project.status === 'IN_PROGRESS').length.toString()} icon={<FolderKanban className="h-5 w-5" />} /><StatCard label="Tâches à faire" value={operations.pendingTaskCount.toString()} icon={<ListChecks className="h-5 w-5" />} /><StatCard label="En vérification" value={operations.reviewTaskCount.toString()} /><StatCard label="À surveiller" value={atRisk.length.toString()} icon={<TriangleAlert className="h-5 w-5" />} /></div>
      {atRisk.length ? <Alert tone="info">{atRisk.length} projet{atRisk.length > 1 ? 's demandent' : ' demande'} une attention rapide : une tâche est proche de son échéance ou en retard.</Alert> : null}
      <Card><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="font-serif text-xl font-bold">Évolution des tâches par projet</h2><p className="mt-1 text-sm text-studio-dark/55">Répartition des tâches et marge avant la prochaine livraison.</p></div><span className="text-sm text-studio-dark/55">{operations.completedTaskCount} / {operations.totalTaskCount} tâches terminées</span></div><div className="mt-5 space-y-5">{operations.projects.length ? operations.projects.map((project) => { const total = project.taskCount || 1; return <div key={project.id} className="rounded-lg border border-studio-dark/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-studio-dark">{project.eventName}</h3><p className="text-xs text-studio-dark/55">{project.clientName} · Livraison globale : {formatDateShort(project.globalDeliveryDate)}</p></div><Badge tone={timeTone(project.nextTaskDeliveryDate)}><Clock3 className="h-3.5 w-3.5" />{timeLabel(project.nextTaskDeliveryDate)}</Badge></div><div className="mt-4 flex h-2 overflow-hidden rounded-full bg-studio-dark/10"><div className="bg-green-600" style={{ width: `${(project.completedTaskCount / total) * 100}%` }} /><div className="bg-studio-gold" style={{ width: `${(project.reviewTaskCount / total) * 100}%` }} /><div className="bg-studio-terracotta" style={{ width: `${(project.pendingTaskCount / total) * 100}%` }} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-studio-dark/65"><span>{project.completedTaskCount} terminée{project.completedTaskCount > 1 ? 's' : ''}</span><span>{project.reviewTaskCount} en vérification</span><span>{project.pendingTaskCount} à faire</span></div></div> }) : <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="Aucun projet" description="Les projets actifs du studio apparaîtront ici." />}</div></Card>
    </> : <>
      <div className="grid gap-4 sm:grid-cols-2"><StatCard label="Mes tâches à livrer" value={tasks.length.toString()} icon={<ListChecks className="h-5 w-5" />} /><StatCard label="Terminées" value={tasks.filter((task) => task.status === 'COMPLETED').length.toString()} /></div><Card><h2 className="font-serif text-xl font-bold">Mes prochaines échéances</h2><div className="mt-4 space-y-3">{upcoming.map((task) => <div key={task.id} className="flex justify-between"><span>{task.name}</span><span className="text-sm text-studio-terracotta">{formatDateShort(task.deliveryDate)}</span></div>)}</div></Card>
    </>}
  </div>
}
