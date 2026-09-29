import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { CalendarDays, FolderKanban, MapPin, Plus, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { computeTaskDeliveryDate, formatDateShort } from '../../../shared/dates.ts'
import { computePaymentPlan, formatAmount } from '../../../shared/money.ts'
import { createProjectSchema, type CreateProjectInput } from '../../../shared/schemas/project.ts'
import type { ClientSummary, ProjectStatus, ProjectSummary } from '../../../shared/types.ts'
import { Alert, Badge, Button, Card, CardGridSkeleton, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, Select, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { ApiError, createProjectApi, fetchClients, fetchProjects } from '../../lib/api'

const labels: Record<ProjectStatus, string> = { DRAFT: 'En attente', IN_PROGRESS: 'En cours', DELIVERED: 'Livré', CANCELLED: 'Annulé' }
const tones: Record<ProjectStatus, 'gold' | 'green' | 'red' | 'gray'> = { DRAFT: 'gray', IN_PROGRESS: 'gold', DELIVERED: 'green', CANCELLED: 'red' }
const paymentPercent = (project: ProjectSummary) => project.totalAmount > 0 ? Math.min(100, Math.round((project.paidAmount / project.totalAmount) * 100)) : 0

const ProjectCard = ({ project }: { project: ProjectSummary }) => {
  const { isAdmin } = useAuth()
  const percent = paymentPercent(project)
  return <Link to={`/projets/${project.id}`}>
    <Card className="studio-card-hover h-full space-y-4 p-5 hover:border-studio-gold/40">
      <div className="flex items-start justify-between gap-3"><h2 className="font-serif text-lg font-bold text-studio-dark">{project.eventName}</h2><Badge tone={tones[project.status]} dot>{labels[project.status]}</Badge></div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-studio-dark/60"><span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{project.clientName}</span><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDateShort(project.eventDate)}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{project.eventLocation}</span></div>
      {isAdmin ? <div className="grid grid-cols-2 gap-4 pt-1 text-sm"><div><p className="text-xs text-studio-dark/50">Montant total</p><strong className="font-serif text-base text-studio-dark">{formatAmount(project.totalAmount)}</strong></div><div className="text-right"><p className="text-xs text-studio-dark/50">Encaissé</p><strong className="font-serif text-base text-green-700">{formatAmount(project.paidAmount)}</strong></div></div> : <p className="pt-1 text-[11px] text-studio-dark/45">Montants réservés à l’administrateur.</p>}
      {isAdmin ? <div><ProgressBar value={percent} tone="auto" label={`${percent} %`} /><p className="mt-1.5 text-[11px] text-studio-dark/65">{percent} % encaissé · reste {formatAmount(project.remainingAmount)}</p></div> : null}
      <p className="border-t border-studio-dark/10 pt-3 text-[11px] text-studio-dark/60">Livraison : {formatDateShort(project.globalDeliveryDate)} · remise tâches : {formatDateShort(computeTaskDeliveryDate(project.globalDeliveryDate))}</p>
    </Card>
  </Link>
}

export const ProjectsPage = () => {
  const { isAdmin } = useAuth()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(createProjectSchema), defaultValues: { status: 'DRAFT', collectAdvanceNow: true } })
  const plan = computePaymentPlan(Number(watch('totalAmount')) || 0)

  const load = useCallback(async () => {
    try {
      // La liste des clients (donc la création de projet) est réservée à l'administrateur.
      const [projectResponse, clientResponse] = await Promise.all([fetchProjects(), isAdmin ? fetchClients() : Promise.resolve({ clients: [] as ClientSummary[] })])
      setProjects(projectResponse.projects); setClients(clientResponse.clients); setError('')
    }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Chargement des projets impossible.') }
    finally { setLoading(false) }
  }, [isAdmin])
  useEffect(() => { void load() }, [load])
  const create = () => { reset({ clientId: clients[0]?.id ?? '', eventName: '', eventLocation: '', eventDate: '', globalDeliveryDate: '', totalAmount: 0, collectAdvanceNow: true, status: 'DRAFT', notes: '' }); setOpen(true) }
  const submit = handleSubmit(async (data) => { try { await createProjectApi(data as CreateProjectInput); setOpen(false); setFeedback(data.collectAdvanceNow !== false ? 'Projet créé et avance enregistrée.' : 'Projet créé ; l’avance sera enregistrée plus tard.'); await load() } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Création impossible.') } })

  return <div className="space-y-6">
    <PageHeader title="Projets / Événements" subtitle={isAdmin ? 'Planifiez les événements et suivez les paiements.' : 'Suivi opérationnel des événements du studio.'} actions={isAdmin ? <Button onClick={create} disabled={!clients.length}><Plus className="h-4 w-4" />Nouveau projet</Button> : undefined} />
    {feedback ? <Alert tone="success">{feedback}</Alert> : null}{error ? <Alert tone="error">{error}</Alert> : null}
    {isAdmin && !clients.length && !loading ? <Alert tone="info">Créez d’abord un client pour pouvoir créer un projet.</Alert> : null}
    {loading ? <CardGridSkeleton /> : projects.length === 0 ? <EmptyState icon={<FolderKanban className="h-6 w-6" />} title="Aucun projet enregistré" description={isAdmin ? 'Créez un événement pour établir son plan de paiement.' : 'Les projets préparés par l’administrateur apparaîtront ici.'} action={isAdmin ? <Button onClick={create} disabled={!clients.length}><Plus className="h-4 w-4" />Nouveau projet</Button> : undefined} /> : <div className="studio-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
    <Modal open={isAdmin && open} onClose={() => setOpen(false)} size="lg" title="Nouveau projet" subtitle="Les montants 30 %, 50 % et 20 % sont calculés automatiquement."><form className="space-y-4" onSubmit={submit}><Field label="Client *" error={errors.clientId?.message}><Select {...register('clientId')}><option value="">Sélectionnez un client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></Field><Field label="Nom de l’événement *" error={errors.eventName?.message}><Input {...register('eventName')} autoFocus /></Field><Field label="Lieu *" error={errors.eventLocation?.message}><Input {...register('eventLocation')} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Date de l’événement *" error={errors.eventDate?.message}><Input {...register('eventDate')} type="date" /></Field><Field label="Livraison globale *" error={errors.globalDeliveryDate?.message}><Input {...register('globalDeliveryDate')} type="date" /></Field></div><Field label="Montant total (FCFA) *" error={errors.totalAmount?.message}><Input {...register('totalAmount')} type="number" min="1" /></Field><div className="grid grid-cols-3 gap-2 rounded-lg bg-studio-dark/5 p-3 text-center text-xs"><span>Avance<br /><strong>{formatAmount(plan.advance)}</strong></span><span>Intermédiaire<br /><strong>{formatAmount(plan.intermediate)}</strong></span><span>Solde<br /><strong>{formatAmount(plan.final)}</strong></span></div><label className="flex cursor-pointer items-start gap-3 rounded-lg border border-studio-gold/40 bg-studio-gold/10 p-3 text-sm text-studio-dark"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-studio-dark" {...register('collectAdvanceNow')} /><span><strong>Encaisser l’avance maintenant</strong><span className="mt-0.5 block text-xs text-studio-dark/60">Activé par défaut : {formatAmount(plan.advance)} sera enregistré avec la création du projet. Décochez pour l’enregistrer plus tard.</span></span></label><Field label="Statut"><Select {...register('status')}><option value="DRAFT">Brouillon</option><option value="IN_PROGRESS">En cours</option></Select></Field><Field label="Notes"><Textarea {...register('notes')} /></Field><div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4"><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={isSubmitting}>Créer le projet</Button></div></form></Modal>
  </div>
}
