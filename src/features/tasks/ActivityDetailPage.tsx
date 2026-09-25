import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDate, toDateInputValue, todayInputValue } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { ActivitySummary, ExpenseSummary, TaskSummary, UserSummary } from '../../../shared/types.ts'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  TableWrapper,
  Td,
  Th,
} from '../../components/ui'
import {
  ApiError,
  archiveActivityApi,
  archiveExpenseApi,
  archiveTaskApi,
  createExpenseApi,
  createTaskApi,
  fetchActivities,
  fetchExpenses,
  fetchTasks,
  fetchUsers,
  updateActivityApi,
  updateExpenseApi,
  updateTaskApi,
} from '../../lib/api'

const taskStatusLabels: Record<TaskSummary['status'], string> = {
  PENDING: 'À faire',
  IN_REVIEW: 'À vérifier',
  COMPLETED: 'Terminée',
}

const taskStatusTones: Record<TaskSummary['status'], 'gold' | 'green' | 'gray'> = {
  PENDING: 'gray',
  IN_REVIEW: 'gold',
  COMPLETED: 'green',
}

const amountFromForm = (form: FormData, field: string): number => {
  const value = Number(form.get(field) ?? 0)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/** Fiche de second niveau : une activité et les tâches qui lui sont affectées. */
export const ActivityDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<ActivitySummary | null>(null)
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [expenses, setExpenses] = useState<ExpenseSummary[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskSummary | null>(null)
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseSummary | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const [activitiesResponse, tasksResponse, usersResponse, expensesResponse] = await Promise.all([
        fetchActivities(),
        fetchTasks(id),
        fetchUsers(),
        fetchExpenses(id),
      ])
      setActivity(activitiesResponse.activities.find((item) => item.id === id) ?? null)
      setTasks(tasksResponse.tasks)
      setUsers(usersResponse.users.filter((user) => user.isActive && user.role !== 'CLIENT'))
      setExpenses(expensesResponse.expenses)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Chargement de l’activité impossible.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const openCreateTaskModal = () => {
    setEditingTask(null)
    setError('')
    setIsTaskModalOpen(true)
  }

  const openCreateExpenseModal = () => {
    setEditingExpense(null)
    setError('')
    setIsExpenseModalOpen(true)
  }

  const openEditExpenseModal = (expense: ExpenseSummary) => {
    setEditingExpense(expense)
    setError('')
    setIsExpenseModalOpen(true)
  }

  const saveExpense = async (form: FormData) => {
    if (!activity) return
    const description = String(form.get('description') ?? '').trim()
    const amount = Number(form.get('amount'))
    const expenseDate = String(form.get('expenseDate') ?? '')
    if (!description || !Number.isFinite(amount) || amount <= 0 || !expenseDate) {
      setError('La description, le montant et la date de la dépense sont obligatoires.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const payload = { description, amount: Math.round(amount), expenseDate, supplier: String(form.get('supplier') ?? '').trim() }
      if (editingExpense) {
        await updateExpenseApi(editingExpense.id, payload)
        setFeedback('Dépense mise à jour.')
      } else {
        await createExpenseApi({ activityId: activity.id, ...payload })
        setFeedback('Dépense ajoutée à l’activité.')
      }
      setIsExpenseModalOpen(false)
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Enregistrement de la dépense impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeExpense = async (expense: ExpenseSummary) => {
    if (!window.confirm(`Supprimer la dépense « ${expense.description} » ?`)) return
    setError('')
    try {
      await archiveExpenseApi(expense.id)
      setFeedback('Dépense supprimée.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Suppression de la dépense impossible.')
    }
  }

  const openEditTaskModal = (task: TaskSummary) => {
    setEditingTask(task)
    setError('')
    setIsTaskModalOpen(true)
  }

  const closeTaskModal = () => {
    if (!isSaving) setIsTaskModalOpen(false)
  }

  const saveTask = async (form: FormData) => {
    if (!activity) return
    const name = String(form.get('name') ?? '').trim()
    const assignedUserId = String(form.get('assignedUserId') ?? '')
    if (!name || !assignedUserId) {
      setError('Le membre et le nom de la tâche sont obligatoires.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const payload = {
        assignedUserId,
        name,
        clientPriceShare: amountFromForm(form, 'clientPriceShare'),
        memberPayout: amountFromForm(form, 'memberPayout'),
      }
      if (editingTask) {
        await updateTaskApi(editingTask.id, payload)
        setFeedback('Tâche mise à jour.')
      } else {
        await createTaskApi({ activityId: activity.id, ...payload })
        setFeedback('Tâche distribuée. Sa date de livraison est calculée automatiquement à J‑5.')
      }
      setIsTaskModalOpen(false)
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Enregistrement de la tâche impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeTask = async (task: TaskSummary) => {
    if (!window.confirm(`Supprimer la tâche « ${task.name} » ?`)) return
    setError('')
    try {
      await archiveTaskApi(task.id)
      setFeedback('Tâche supprimée.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Suppression de la tâche impossible.')
    }
  }

  const saveActivity = async (form: FormData) => {
    if (!activity) return
    const name = String(form.get('name') ?? '').trim()
    if (!name) {
      setError('Le nom de l’activité est obligatoire.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await updateActivityApi(activity.id, {
        name,
        description: String(form.get('description') ?? '').trim(),
      })
      setIsActivityModalOpen(false)
      setFeedback('Activité mise à jour.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Modification de l’activité impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeActivity = async () => {
    if (!activity || !window.confirm(`Supprimer l’activité « ${activity.name} » et ses tâches ?`)) return
    try {
      await archiveActivityApi(activity.id)
      navigate('/taches')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Suppression de l’activité impossible.')
    }
  }

  if (isLoading) {
    return <Card className="p-12 text-center text-sm text-studio-dark/55">Chargement de la fiche activité…</Card>
  }

  if (!activity) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{error || 'Activité introuvable.'}</Alert>
        <Link to="/taches">
          <Button variant="secondary"><ArrowLeft className="h-4 w-4" />Retour aux activités</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/taches" className="inline-flex items-center gap-1 text-sm text-studio-terracotta hover:underline">
        <ArrowLeft className="h-4 w-4" /> Toutes les activités
      </Link>

      <PageHeader
        title={activity.name}
        subtitle={`${activity.projectName} — ${activity.description || 'Gestion des tâches de cette activité.'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setIsActivityModalOpen(true)}>
              <Pencil className="h-4 w-4" /> Modifier l’activité
            </Button>
            <Button variant="danger" onClick={() => void removeActivity()}>
              <Trash2 className="h-4 w-4" /> Supprimer l’activité
            </Button>
          </div>
        }
      />

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-studio-terracotta">Projet</p>
        <p className="font-serif text-xl font-bold text-studio-dark">{activity.projectName}</p>
        <p className="text-sm text-studio-dark/60">{activity.description || 'Aucune description renseignée.'}</p>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-studio-dark">Tâches de l’activité</h2>
            <p className="mt-1 text-sm text-studio-dark/55">
              {tasks.length} {tasks.length > 1 ? 'tâches' : 'tâche'} distribuée{tasks.length > 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={openCreateTaskModal} disabled={users.length === 0}>
            <Plus className="h-4 w-4" /> Nouvelle tâche
          </Button>
        </div>

        {users.length === 0 ? (
          <Alert tone="info">Aucun membre actif ne peut recevoir une tâche pour le moment.</Alert>
        ) : null}

        {tasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Aucune tâche dans cette activité"
            description="Distribuez la première tâche à un membre de l’équipe."
            action={<Button onClick={openCreateTaskModal} disabled={users.length === 0}><Plus className="h-4 w-4" />Distribuer une tâche</Button>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <Card key={task.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-studio-terracotta">{task.projectName}</p>
                    <Link to={`/taches/${task.id}`} className="mt-1 block font-serif text-lg font-bold text-studio-dark hover:text-studio-terracotta">{task.name}</Link>
                  </div>
                  <Badge tone={taskStatusTones[task.status]}>
                    {task.status === 'COMPLETED' ? <CheckCircle2 className="h-3 w-3" /> : null}
                    {taskStatusLabels[task.status]}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-studio-dark/70">
                  <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-studio-terracotta" />{task.assignedUserName}</p>
                  <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-studio-terracotta" />À livrer le {formatDate(task.deliveryDate)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-studio-dark/10 pt-3 text-sm">
                  <div>
                    <p className="text-xs text-studio-dark/45">Part client</p>
                    <strong>{formatAmount(task.clientPriceShare ?? 0)}</strong>
                  </div>
                  <div>
                    <p className="text-xs text-studio-dark/45">Rémunération membre</p>
                    <strong className="text-green-700">{formatAmount(task.memberPayout ?? 0)}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-studio-dark/10 pt-3">
                  <Button variant="secondary" size="sm" onClick={() => openEditTaskModal(task)}>
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void removeTask(task)}>
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-studio-dark">Dépenses de l’activité</h2>
            <p className="mt-1 text-sm text-studio-dark/55">Historique des frais engagés pour cette activité.</p>
          </div>
          <Button onClick={openCreateExpenseModal}><Plus className="h-4 w-4" /> Ajouter une dépense</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-studio-dark/45">Total des dépenses</p><p className="mt-1 font-serif text-xl font-bold text-studio-dark">{formatAmount(expenses.reduce((total, expense) => total + expense.amount, 0))}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-studio-dark/45">Dépenses enregistrées</p><p className="mt-1 font-serif text-xl font-bold text-studio-dark">{expenses.length}</p></Card>
        </div>

        {expenses.length === 0 ? (
          <EmptyState icon={<Plus className="h-6 w-6" />} title="Aucune dépense enregistrée" description="Ajoutez les achats, transports, locations ou autres frais liés à cette activité." action={<Button onClick={openCreateExpenseModal}><Plus className="h-4 w-4" /> Ajouter une dépense</Button>} />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Dépense</Th><Th>Fournisseur</Th><Th>Date</Th><Th>Montant</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>{expenses.map((expense) => <tr key={expense.id}><Td><span className="font-medium">{expense.description}</span></Td><Td>{expense.supplier || '—'}</Td><Td>{formatDate(expense.expenseDate)}</Td><Td><strong>{formatAmount(expense.amount)}</strong></Td><Td className="text-right"><div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => openEditExpenseModal(expense)}><Pencil className="h-3.5 w-3.5" /> Modifier</Button><Button variant="danger" size="sm" onClick={() => void removeExpense(expense)}><Trash2 className="h-3.5 w-3.5" /> Supprimer</Button></div></Td></tr>)}</tbody>
          </TableWrapper>
        )}
      </section>

      <Modal
        open={isExpenseModalOpen}
        onClose={() => !isSaving && setIsExpenseModalOpen(false)}
        title={editingExpense ? 'Modifier la dépense' : 'Ajouter une dépense'}
        subtitle="Cette dépense sera rattachée uniquement à cette activité."
      >
        <form key={editingExpense?.id ?? 'new-expense'} className="space-y-4" action={(form) => void saveExpense(form)}>
          <Field label="Description *"><Input name="description" defaultValue={editingExpense?.description ?? ''} required autoFocus placeholder="Ex. Location d’éclairage" /></Field>
          <Field label="Fournisseur / bénéficiaire"><Input name="supplier" defaultValue={editingExpense?.supplier ?? ''} placeholder="Ex. Studio Lumière" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Montant (FCFA) *"><Input name="amount" type="number" min="1" defaultValue={editingExpense?.amount ?? ''} required /></Field>
            <Field label="Date de dépense *"><Input name="expenseDate" type="date" defaultValue={editingExpense ? toDateInputValue(editingExpense.expenseDate) : todayInputValue()} required /></Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4"><Button variant="ghost" onClick={() => setIsExpenseModalOpen(false)}>Annuler</Button><Button type="submit" loading={isSaving}>{editingExpense ? 'Enregistrer' : 'Ajouter la dépense'}</Button></div>
        </form>
      </Modal>

      <Modal
        open={isTaskModalOpen}
        onClose={closeTaskModal}
        title={editingTask ? 'Modifier la tâche' : 'Distribuer une tâche'}
        subtitle="La date de livraison est calculée automatiquement à J‑5 de la livraison globale du projet."
      >
        <form key={editingTask?.id ?? 'new-task'} className="space-y-4" action={(form) => void saveTask(form)}>
          <Field label="Membre responsable *">
            <Select name="assignedUserId" defaultValue={editingTask?.assignedUserId ?? users[0]?.id ?? ''}>
              <option value="">Sélectionnez un membre</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </Select>
          </Field>
          <Field label="Nom de la tâche *">
            <Input name="name" defaultValue={editingTask?.name ?? ''} required autoFocus placeholder="Ex. Retouche de la galerie" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Part client (FCFA)">
              <Input name="clientPriceShare" type="number" min="0" defaultValue={editingTask?.clientPriceShare ?? 0} />
            </Field>
            <Field label="Rémunération membre (FCFA)">
              <Input name="memberPayout" type="number" min="0" defaultValue={editingTask?.memberPayout ?? 0} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4">
            <Button variant="ghost" onClick={closeTaskModal}>Annuler</Button>
            <Button type="submit" loading={isSaving}>{editingTask ? 'Enregistrer' : 'Distribuer'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isActivityModalOpen}
        onClose={() => !isSaving && setIsActivityModalOpen(false)}
        title="Modifier l’activité"
        subtitle="Mettez à jour les informations affichées sur cette fiche."
      >
        <form className="space-y-4" action={(form) => void saveActivity(form)}>
          <Field label="Nom de l’activité *">
            <Input name="name" defaultValue={activity.name} required autoFocus />
          </Field>
          <Field label="Description">
            <Input name="description" defaultValue={activity.description ?? ''} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4">
            <Button variant="ghost" onClick={() => setIsActivityModalOpen(false)}>Annuler</Button>
            <Button type="submit" loading={isSaving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
