import { Link } from 'react-router-dom'
import { ListChecks, Wallet } from 'lucide-react'
import { formatDate } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { TaskSummary } from '../../../shared/types.ts'
import { Card, EmptyState, StatCard, TableWrapper, Td, Th } from '../../components/ui'
import { computeStudyStats, percent } from '../../lib/taskStats'

const progressColor = (value: number) =>
  value >= 100 ? 'bg-green-600' : value > 0 ? 'bg-studio-gold' : 'bg-studio-terracotta'

/**
 * Bloc « moi » du tableau de bord : statistiques de qualité des tâches
 * (terminées, validées, validées au 1er coup, renvoyées) puis paiement
 * par tâche avec barre d'avancement.
 */
export const MemberStatsPanel = ({ tasks }: { tasks: TaskSummary[] }) => {
  const stats = computeStudyStats(tasks)
  // Seules les tâches dotées d'une rémunération apparaissent dans le tableau des paiements.
  const paidTasks = tasks
    .filter((task) => (task.memberPayout ?? 0) > 0)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Mes tâches" value={stats.total.toString()} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label="Terminées" value={stats.delivered.toString()} hint={`${percent(stats.delivered, stats.total)} % de mes tâches`} />
        <StatCard label="Validées" value={stats.approved.toString()} hint={`${percent(stats.approved, stats.total)} % validées`} />
        <StatCard label="Validées au 1er coup" value={stats.approvedFirstPass.toString()} hint={`${percent(stats.approvedFirstPass, stats.total)} % sans renvoi`} />
        <StatCard label="Renvoyées" value={stats.returned.toString()} hint={stats.returned > 0 ? 'Corrections demandées' : 'Aucun renvoi'} />
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl font-bold">Mes paiements par tâche</h2>
            <p className="mt-1 text-sm text-studio-dark/55">Rémunération prévue, versée et reste à payer, avec l’avancement de chaque tâche.</p>
          </div>
          <span className="text-sm text-studio-dark/55">
            {formatAmount(paidTasks.reduce((total, task) => total + (task.paidPayout ?? 0), 0))} versés
          </span>
        </div>
        {paidTasks.length === 0 ? (
          <EmptyState icon={<Wallet className="h-5 w-5" />} title="Aucune rémunération enregistrée" description="Les tâches rémunérées attribuées à vous apparaîtront ici." />
        ) : (
          <TableWrapper className="mt-4">
            <thead>
              <tr>
                <Th>Tâche</Th>
                <Th>Échéance</Th>
                <Th>Rémunération</Th>
                <Th>Versé</Th>
                <Th>Reste</Th>
                <Th>Avancement</Th>
              </tr>
            </thead>
            <tbody>
              {paidTasks.map((task) => {
                const progress = percent(task.paidPayout ?? 0, task.memberPayout ?? 0)
                return (
                  <tr key={task.id}>
                    <Td>
                      <Link to={`/taches/${task.id}`} className="font-medium text-studio-dark hover:text-studio-terracotta">
                        {task.name}
                      </Link>
                      <span className="block text-xs text-studio-dark/50">
                        {task.projectName} · {task.activityName}
                      </span>
                    </Td>
                    <Td>{formatDate(task.deliveryDate)}</Td>
                    <Td><strong>{formatAmount(task.memberPayout ?? 0)}</strong></Td>
                    <Td>{formatAmount(task.paidPayout ?? 0)}</Td>
                    <Td className={progress >= 100 ? 'text-green-700' : undefined}>
                      {formatAmount(task.payoutRemaining ?? 0)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-studio-dark/10">
                          <div className={`h-full ${progressColor(progress)}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-studio-dark/70">{progress} %</span>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrapper>
        )}
      </Card>
    </div>
  )
}
