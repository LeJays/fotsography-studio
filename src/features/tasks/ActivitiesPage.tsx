import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, FolderKanban, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ActivitySummary, ProjectSummary, TaskSummary } from '../../../shared/types.ts'
import { formatAmount } from '../../../shared/money.ts'
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
  Textarea,
} from '../../components/ui'
import {
  ApiError,
  archiveActivityApi,
  createActivityApi,
  fetchActivities,
  fetchProjects,
  fetchTasks,
  updateActivityApi,
} from '../../lib/api'

/** Page de premier niveau : les activités d'un projet, puis la fiche de chaque activité. */
export const ActivitiesPage = () => {
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<ActivitySummary | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [activitiesResponse, projectsResponse, tasksResponse] = await Promise.all([
        fetchActivities(),
        fetchProjects(),
        fetchTasks(),
      ])
      setActivities(activitiesResponse.activities)
      setProjects(projectsResponse.projects)
      setTasks(tasksResponse.tasks)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Chargement des activités impossible.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) counts.set(task.activityId, (counts.get(task.activityId) ?? 0) + 1)
    return counts
  }, [tasks])

  const openCreateModal = () => {
    setSelectedActivity(null)
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (activity: ActivitySummary) => {
    setSelectedActivity(activity)
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (!isSaving) setIsModalOpen(false)
  }

  const saveActivity = async (form: FormData) => {
    const name = String(form.get('name') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const projectId = String(form.get('projectId') ?? '')

    if (!name || !projectId) {
      setError('Le projet et le nom de l’activité sont obligatoires.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      if (selectedActivity) {
        await updateActivityApi(selectedActivity.id, { name, description })
        setFeedback('Activité mise à jour.')
      } else {
        await createActivityApi({ projectId, name, description })
        setFeedback('Activité créée. Vous pouvez maintenant lui distribuer des tâches.')
      }
      setIsModalOpen(false)
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Enregistrement de l’activité impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeActivity = async (activity: ActivitySummary) => {
    if (!window.confirm(`Supprimer l’activité « ${activity.name} » ?`)) return
    setError('')
    try {
      await archiveActivityApi(activity.id)
      setFeedback('Activité supprimée.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Suppression de l’activité impossible.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activités & tâches"
        subtitle="Choisissez une activité pour consulter son équipe et distribuer son travail."
        actions={
          <Button onClick={openCreateModal} disabled={isLoading || projects.length === 0}>
            <Plus className="h-4 w-4" /> Nouvelle activité
          </Button>
        }
      />

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!isLoading && projects.length === 0 ? (
        <Alert tone="info" title="Aucun projet disponible">
          Créez d’abord un projet pour pouvoir lui rattacher des activités.
        </Alert>
      ) : null}

      {isLoading ? (
        <Card className="p-12 text-center text-sm text-studio-dark/55">Chargement des activités…</Card>
      ) : activities.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" />}
          title="Aucune activité"
          description="Une activité regroupe les tâches d’un même événement, par exemple le shooting ou les retouches."
          action={<Button onClick={openCreateModal} disabled={projects.length === 0}><Plus className="h-4 w-4" />Créer une activité</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => {
            const activityTaskCount = taskCounts.get(activity.id) ?? 0
            return (
              <Card key={activity.id} className="flex h-full flex-col space-y-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-studio-terracotta">
                    {activity.projectName}
                  </p>
                  <h2 className="mt-1 font-serif text-xl font-bold text-studio-dark">{activity.name}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-studio-dark/60">
                    {activity.description || 'Aucune description pour cette activité.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-studio-dark/10 pt-3">
                  <div className="flex flex-wrap gap-2">
                  <Badge tone={activityTaskCount > 0 ? 'gold' : 'gray'}>
                      <ListChecks className="h-3 w-3" />
                      {activityTaskCount} {activityTaskCount > 1 ? 'tâches' : 'tâche'}
                  </Badge>
                  <Badge tone={activity.status === 'COMPLETED' ? 'green' : activity.status === 'IN_PROGRESS' ? 'gold' : 'gray'}>{activity.status === 'PENDING' ? 'En attente' : activity.status === 'IN_PROGRESS' ? 'En cours' : 'Terminée'}</Badge>
                    <Badge tone={activity.expenseCount > 0 ? 'green' : 'gray'}>
                      {formatAmount(activity.expenseAmount)} de dépenses
                    </Badge>
                  </div>
                  <Link to={`/activites/${activity.id}`}>
                    <Button variant="secondary" size="sm">
                      Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-studio-dark/10 pt-3">
                  <Button variant="secondary" size="sm" onClick={() => openEditModal(activity)}>
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void removeActivity(activity)}>
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={selectedActivity ? 'Modifier l’activité' : 'Nouvelle activité'}
        subtitle={selectedActivity ? 'Mettez à jour le nom et la description.' : 'Rattachez une nouvelle activité à un projet.'}
      >
        <form className="space-y-4" action={(form) => void saveActivity(form)}>
          <Field label="Projet *" hint="Le projet est lié à l’activite et ne peut pas être modifié ensuite.">
            <Select
              name="projectId"
              defaultValue={selectedActivity?.projectId ?? projects[0]?.id ?? ''}
              disabled={Boolean(selectedActivity)}
            >
              <option value="">Sélectionnez un projet</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.eventName} — {project.clientName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nom de l’activité *" hint="Exemple : Shooting Jour J, retouches, livraison des fichiers.">
            <Input name="name" defaultValue={selectedActivity?.name ?? ''} required autoFocus />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={selectedActivity?.description ?? ''} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4">
            <Button variant="ghost" onClick={closeModal}>Annuler</Button>
            <Button type="submit" loading={isSaving}>
              {selectedActivity ? 'Enregistrer' : 'Créer l’activité'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
