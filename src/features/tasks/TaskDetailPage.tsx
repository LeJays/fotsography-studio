import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Download, Eye, ExternalLink, Undo2, Wallet } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { formatDate } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { PaymentMethod, TaskSummary } from '../../../shared/types.ts'
import { Button, Card, Field, Input, Modal, PageHeader, Select, StatCard, TableWrapper, Td, Textarea, Th, useConfirm, useToast } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { ApiError, fetchTask, payTaskPayoutApi, reviewTaskApi, updateOwnTaskApi } from '../../lib/api'
import { downloadTaskPayoutReceipt, previewTaskPayoutReceipt } from '../../lib/receiptPdf'
import { lastReview, nextStatus, StatusPill, STATUS_LABELS } from './taskStatus'

const METHOD_LABELS: Record<PaymentMethod, string> = { CASH: 'Espèces', MOMO: 'Mobile Money', BANK: 'Virement' }

export const TaskDetailPage = () => {
  const { id } = useParams<{ id: string }>(); const { user, isAdmin } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [task, setTask] = useState<TaskSummary | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false)
  // Retour de l'admin (raison + corrections demandées)
  const [returnOpen, setReturnOpen] = useState(false); const [returnNote, setReturnNote] = useState('')
  // Versement de la rémunération (total ou tranche)
  const [payoutAmount, setPayoutAmount] = useState(''); const [payoutMethod, setPayoutMethod] = useState<PaymentMethod>('CASH'); const [payoutReference, setPayoutReference] = useState(''); const [payoutNote, setPayoutNote] = useState('')
  const load = useCallback(async () => { if (!id) return; try { setTask((await fetchTask(id)).task); setPayoutAmount('') } catch (reason) { toast.error(reason instanceof ApiError ? reason.message : 'Chargement de la tâche impossible.') } finally { setLoading(false) } }, [id, toast])
  useEffect(() => { void load() }, [load])
  // Pré-remplit le montant du prochain versement avec le reste à payer.
  useEffect(() => { if (task && payoutAmount === '') setPayoutAmount(String(task.payoutRemaining ?? 0)) }, [task, payoutAmount])
  const saveProgress = async (form: FormData) => { if (!task) return; const status = String(form.get('status')) as TaskSummary['status']; const proofLink = String(form.get('proofLink') ?? '').trim(); if (status === 'COMPLETED' && !proofLink && !task.proofLink) { toast.error('Ajoutez le lien de la photo ou de la vidéo avant de terminer la tâche.'); return } setSaving(true); try { await updateOwnTaskApi(task.id, { status, ...(proofLink ? { proofLink } : {}) }); toast.success('Avancement mis à jour.'); await load() } catch (reason) { toast.error(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.') } finally { setSaving(false) } }
  /** Cycle du badge en haut à droite : À faire → En cours → Terminée. */
  const cycle = async (current: TaskSummary) => { if (saving) return; const target = nextStatus(current.status); if (target === 'COMPLETED' && !current.proofLink) { toast.error('Ajoutez d’abord le lien de la preuve (formulaire « Avancement » ci-dessous) avant de terminer la tâche.'); return } setSaving(true); try { await updateOwnTaskApi(current.id, { status: target }); toast.success(`Statut mis à jour : ${STATUS_LABELS[target]}.`); await load() } catch (reason) { toast.error(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.') } finally { setSaving(false) } }
  const approve = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'Valider la tâche',
      message: 'Valider définitivement cette tâche ? Son statut sera verrouillé pour le membre.',
      confirmText: 'Valider',
      variant: 'primary',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await reviewTaskApi(task.id, { decision: 'APPROVED' });
      toast.success('Tâche validée.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Validation impossible.');
    } finally {
      setSaving(false);
    }
  }
  const sendBack = async () => { if (!task) return; const note = returnNote.trim(); if (!note) { toast.error('Décrivez la raison du renvoi et les corrections attendues.'); return } setSaving(true); try { await reviewTaskApi(task.id, { decision: 'RETURNED', note }); toast.success('Tâche renvoyée au membre avec vos instructions.'); setReturnOpen(false); setReturnNote(''); await load() } catch (reason) { toast.error(reason instanceof ApiError ? reason.message : 'Renvoi impossible.') } finally { setSaving(false) } }
  const pay = async (event: FormEvent) => { event.preventDefault(); if (!task) return; const amount = Math.round(Number(payoutAmount)); const rest = task.payoutRemaining ?? 0; if (!amount || amount <= 0) { toast.error('Indiquez le montant du versement.'); return } if (amount > rest) { toast.error(`Le montant dépasse le reste à payer (${formatAmount(rest)}).`); return } setSaving(true); try { await payTaskPayoutApi(task.id, { amount, method: payoutMethod, reference: payoutReference.trim() || undefined, note: payoutNote.trim() || undefined }); toast.success(`Versement de ${formatAmount(amount)} enregistré.`); setPayoutReference(''); setPayoutNote(''); await load() } catch (reason) { toast.error(reason instanceof ApiError ? reason.message : 'Paiement impossible.') } finally { setSaving(false) } }
  if (loading) return <Card className="p-12 text-center text-sm text-studio-dark/55">Chargement de la tâche…</Card>
  if (!task) return <div className="space-y-4"><div className="rounded-xl border border-studio-terracotta/30 bg-studio-terracotta/10 px-4 py-3 text-sm text-studio-terracotta">Tâche introuvable ou vous n’avez pas accès à cette fiche.</div><Link to="/mes-taches"><Button variant="secondary"><ArrowLeft className="h-4 w-4" />Retour</Button></Link></div>
  const isAssignee = user?.id === task.assignedUserId
  const review = lastReview(task)
  const approved = review?.decision === 'APPROVED' && task.status === 'COMPLETED'
  const pendingReview = isAdmin && task.status === 'COMPLETED' && !approved
  const returnedNotice = review?.decision === 'RETURNED' && task.status !== 'COMPLETED'
  const remaining = task.payoutRemaining ?? 0
  const paidPayout = task.paidPayout ?? 0
  const payouts = task.payouts ?? []
  return (
    <div className="space-y-6">
      <Link to={isAssignee ? '/mes-taches' : `/activites/${task.activityId}`} className="inline-flex items-center gap-1 text-sm text-studio-terracotta hover:underline"><ArrowLeft className="h-4 w-4" />Retour aux tâches</Link>
      <PageHeader
        title={task.name}
        subtitle={`${task.projectName} · ${task.activityName}`}
        actions={<StatusPill task={task} onCycle={isAssignee ? cycle : undefined} />}
      />
      {returnedNotice ? (
        <div className="flex items-start gap-3 rounded-studio border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200/70">
          <div>
            <p className="font-semibold">Tâche renvoyée par {review?.reviewedByName ?? 'l’admin'} le {formatDate(review?.reviewedAt ?? task.deliveryDate)}</p>
            <p className="mt-1">{review?.note}</p>
          </div>
        </div>
      ) : null}
      {approved ? (
        <div className="flex items-start gap-3 rounded-studio border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200/70">
          <div>
            <p className="font-semibold">Tâche validée</p>
            <p className="mt-0.5">Validée par {review?.reviewedByName ?? 'l’admin'} le {formatDate(review?.reviewedAt ?? task.deliveryDate)}.</p>
          </div>
        </div>
      ) : null}
      {pendingReview ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-studio-gold/40 bg-studio-gold/10">
          <div>
            <h2 className="font-serif text-xl font-bold">Tâche terminée — à contrôler</h2>
            <p className="text-sm text-studio-dark/60">Validez le travail, ou renvoyez-le au membre en précisant la raison et les corrections attendues.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void approve()} disabled={saving}><CheckCircle2 className="h-4 w-4" />Valider</Button>
            <Button variant="secondary" onClick={() => { setReturnNote(''); setReturnOpen(true) }} disabled={saving}><Undo2 className="h-4 w-4" />Renvoyer</Button>
          </div>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Statut" value={STATUS_LABELS[task.status]} />
        <StatCard label="À livrer le" value={formatDate(task.deliveryDate)} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Responsable" value={task.assignedUserName} />
      </div>
      <Card className="space-y-3">
        <h2 className="font-serif text-xl font-bold">Informations de la tâche</h2>
        <p><strong>Projet :</strong> {task.projectName}</p>
        <p><strong>Activité :</strong> {task.activityName}</p>
        {task.description ? (
          <div className="rounded-lg border border-studio-dark/10 bg-studio-cream/40 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-studio-dark/45">Description</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-studio-dark/80">{task.description}</p>
          </div>
        ) : null}
        {task.proofLink ? <p><strong>Preuve :</strong> <a className="inline-flex items-center gap-1 text-studio-terracotta underline" href={task.proofLink} target="_blank" rel="noreferrer">Ouvrir la photo ou vidéo <ExternalLink className="h-3.5 w-3.5" /></a></p> : <p className="text-studio-dark/55">Aucune preuve envoyée pour le moment.</p>}
      </Card>
      <form action={saveProgress} className="grid gap-4 rounded-3xl border border-studio-dark/10 bg-white p-6 shadow-sm md:grid-cols-3">
        <Field label="Avancement" htmlFor="status">
          <Select name="status" id="status" key={task.status} defaultValue={task.status}>
            <option value="PENDING">À faire</option>
            <option value="IN_REVIEW">En cours</option>
            <option value="COMPLETED">Terminée</option>
          </Select>
        </Field>
        <Field label="Lien de la preuve (photo ou vidéo)" htmlFor="proofLink">
          <Input name="proofLink" id="proofLink" type="url" placeholder="https://…" defaultValue={task.proofLink ?? ''} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" loading={saving} disabled={!isAssignee}>Mettre à jour</Button>
        </div>
      </form>
      {isAssignee || isAdmin ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-bold">{isAdmin ? 'Rémunération de la tâche' : 'Ma rémunération'}</h2>
              <p className="mt-1 text-sm text-studio-dark/60">Montant prévu : {task.memberPayout ? formatAmount(task.memberPayout) : 'aucune rémunération'}</p>
            </div>
            <p className={!task.memberPayout ? 'text-sm text-studio-dark/50' : remaining === 0 && paidPayout > 0 ? 'text-sm font-semibold text-green-700' : 'text-sm font-semibold text-studio-terracotta'}>
              {!task.memberPayout ? 'Aucune rémunération' : paidPayout > 0 ? `Versé ${formatAmount(paidPayout)} · reste ${formatAmount(remaining)}` : 'En attente de paiement'}
            </p>
          </div>
          {isAdmin ? (
            !task.memberPayout ? (
              <p className="border-t border-studio-dark/10 pt-4 text-sm text-studio-dark/55">Aucune rémunération membre n’est prévue pour cette tâche.</p>
            ) : remaining > 0 ? (
              <form onSubmit={pay} className="grid gap-3 border-t border-studio-dark/10 pt-4 md:grid-cols-2">
                <Field label={`Montant à verser — reste ${formatAmount(remaining)}`} htmlFor="payoutAmount">
                  <Input id="payoutAmount" type="number" min={1} max={remaining} required value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} />
                </Field>
                <Field label="Moyen de paiement" htmlFor="payoutMethod">
                  <Select id="payoutMethod" value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as PaymentMethod)}>
                    <option value="CASH">Espèces</option>
                    <option value="MOMO">Mobile Money</option>
                    <option value="BANK">Virement bancaire</option>
                  </Select>
                </Field>
                <Field label="Référence (facultatif)" htmlFor="payoutReference">
                  <Input id="payoutReference" placeholder="N° transaction…" value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} />
                </Field>
                <Field label="Note (facultatif)" htmlFor="payoutNote">
                  <Input id="payoutNote" placeholder="Contexte du versement…" value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} />
                </Field>
                <div className="md:col-span-2">
                  <Button type="submit" loading={saving}><Wallet className="h-4 w-4" />Enregistrer le versement{Math.round(Number(payoutAmount)) > 0 ? ` de ${formatAmount(Math.round(Number(payoutAmount)))}` : ''}</Button>
                </div>
              </form>
            ) : (
              <p className="border-t border-studio-dark/10 pt-4 text-sm font-semibold text-green-700">Rémunération entièrement payée.</p>
            )
          ) : null}
          <div className="border-t border-studio-dark/10 pt-4">
            <h3 className="font-serif text-lg font-bold">Historique des versements</h3>
            {payouts.length === 0 ? (
              <p className="mt-2 text-sm text-studio-dark/55">Aucun versement enregistré pour le moment.</p>
            ) : (
              <TableWrapper className="mt-2">
                <thead>
                  <tr><Th>Date</Th><Th>Montant</Th><Th>Moyen</Th><Th>Référence</Th><Th>Par</Th><Th>Reçu</Th></tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <Td>{formatDate(payout.paidAt)}</Td>
                      <Td><strong>{formatAmount(payout.amount)}</strong></Td>
                      <Td>{METHOD_LABELS[payout.method]}</Td>
                      <Td>{payout.reference || '—'}</Td>
                      <Td>{payout.paidByName || '—'}</Td>
                      <Td>
                        {payout.receiptNumber ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" title="Voir le reçu" onClick={() => void previewTaskPayoutReceipt(task, payout)}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="secondary" onClick={() => void downloadTaskPayoutReceipt(task, payout)}><Download className="h-3.5 w-3.5" /> PDF</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-studio-dark/45">Indisponible</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </div>
        </Card>
      ) : null}
      <Modal
        open={returnOpen}
        title="Renvoyer la tâche"
        subtitle={`Précisez la raison du renvoi et ce qu'il faut modifier sur le travail de ${task.assignedUserName}.`}
        onClose={() => setReturnOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturnOpen(false)}>Annuler</Button>
            <Button onClick={() => void sendBack()} loading={saving}><Undo2 className="h-4 w-4" />Renvoyer au membre</Button>
          </>
        }
      >
        <form onSubmit={(event) => { event.preventDefault(); void sendBack() }} className="space-y-4">
          <Field label="Raison du renvoi et corrections demandées" htmlFor="returnNote">
            <Textarea
              id="returnNote"
              required
              autoFocus
              rows={5}
              placeholder="Ex. : le cadrage de la 3e photo est floue, recadrer ; ajouter la version horizontale de la vidéo de clôture…"
              value={returnNote}
              onChange={(event) => setReturnNote(event.target.value)}
            />
          </Field>
          <p className="text-xs text-studio-dark/50">La tâche repassera en « À faire » et votre note s’affichera sur la fiche du membre.</p>
        </form>
      </Modal>
    </div>
  )
}
