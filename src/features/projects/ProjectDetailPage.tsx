import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Download, Eye, MapPin, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PAYMENT_TYPE_LABELS } from '../../../shared/consts.ts'
import { formatDate, todayInputValue } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { PaymentType, ProjectDetail, ProjectStatus } from '../../../shared/types.ts'
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, StatCard, TableWrapper, Td, Textarea, Th } from '../../components/ui'
import { ApiError, createPaymentApi, fetchProject } from '../../lib/api'
import { downloadReceiptPdf, previewReceiptPdf } from '../../lib/receiptPdf'

const labels: Record<ProjectStatus, string> = { DRAFT: 'Brouillon', IN_PROGRESS: 'En cours', DELIVERED: 'Livré', CANCELLED: 'Annulé' }
const tones: Record<ProjectStatus, 'gold' | 'green' | 'red' | 'gray'> = { DRAFT: 'gray', IN_PROGRESS: 'gold', DELIVERED: 'green', CANCELLED: 'red' }
const methodLabels = { CASH: 'Espèces', MOMO: 'Mobile Money', BANK: 'Virement bancaire' } as const

export const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<PaymentType>('INTERMEDIATE_50')
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setProject((await fetchProject(id)).project)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Chargement du projet impossible.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const registeredMilestones = useMemo(() => new Set(project?.payments.filter((payment) => payment.type !== 'CUSTOM').map((payment) => payment.type) ?? []), [project])
  const paymentReceipt = (paymentId: string) => project?.receipts.find((receipt) => receipt.paymentId === paymentId)
  const finalReceipt = project?.receipts.find((receipt) => receipt.isFinalInvoice)
  const selectedAmount = paymentType === 'ADVANCE_30' ? project?.advanceAmount : paymentType === 'INTERMEDIATE_50' ? project?.intermediateAmount : paymentType === 'FINAL_20' ? project?.finalAmount : null

  const openPayment = () => {
    const next = (['INTERMEDIATE_50', 'FINAL_20'] as PaymentType[]).find((type) => !registeredMilestones.has(type)) ?? 'CUSTOM'
    setPaymentType(next)
    setError('')
    setIsPaymentOpen(true)
  }

  const savePayment = async (form: FormData) => {
    if (!project) return
    const type = String(form.get('type')) as PaymentType
    const customAmount = Number(form.get('amount'))
    const paymentDate = String(form.get('paymentDate') ?? '')
    if (!paymentDate || (type === 'CUSTOM' && (!Number.isFinite(customAmount) || customAmount <= 0))) {
      setError('Renseignez une date et un montant valide pour un versement libre.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await createPaymentApi(project.id, {
        type,
        method: String(form.get('method')) as 'CASH' | 'MOMO' | 'BANK',
        amount: type === 'CUSTOM' ? Math.round(customAmount) : undefined,
        paymentDate,
        reference: String(form.get('reference') ?? '').trim(),
        notes: String(form.get('notes') ?? '').trim(),
      })
      setIsPaymentOpen(false)
      setFeedback('Paiement enregistré dans l’historique du projet.')
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Enregistrement du paiement impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <Card className="p-12 text-center text-sm text-studio-dark/55">Chargement du projet…</Card>
  if (!project) return <div className="space-y-4"><Alert tone="error">{error || 'Projet introuvable.'}</Alert><Link to="/projets"><Button variant="secondary"><ArrowLeft className="h-4 w-4" />Retour aux projets</Button></Link></div>

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><Link to="/projets"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link><div><p className="text-xs font-semibold uppercase tracking-wide text-studio-terracotta">{project.clientName}</p><h1 className="font-serif text-2xl font-bold text-studio-dark">{project.eventName}</h1><p className="mt-1 flex items-center gap-2 text-sm text-studio-dark/55"><MapPin className="h-4 w-4" />{project.eventLocation} <CalendarDays className="ml-2 h-4 w-4" />{formatDate(project.eventDate)}</p></div></div><Badge tone={tones[project.status]}>{labels[project.status]}</Badge></div>

    {feedback ? <Alert tone="success">{feedback}</Alert> : null}
    {error ? <Alert tone="error">{error}</Alert> : null}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Montant total" value={formatAmount(project.totalAmount)} /><StatCard label="Encaissé" value={formatAmount(project.paidAmount)} /><StatCard label="Reste à percevoir" value={formatAmount(project.remainingAmount)} /><StatCard label="Livraison globale" value={formatDate(project.globalDeliveryDate)} /></div>

    <Card className="space-y-3 text-sm"><p><strong>Plan de paiement :</strong> avance {formatAmount(project.advanceAmount)} · intermédiaire {formatAmount(project.intermediateAmount)} · solde {formatAmount(project.finalAmount)}</p>{project.notes ? <p className="whitespace-pre-line text-studio-dark/70">{project.notes}</p> : null}<Link to="/taches" className="inline-block font-semibold text-studio-terracotta hover:underline">Gérer les activités et tâches</Link></Card>

    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl font-bold text-studio-dark">Paiements</h2><p className="mt-1 text-sm text-studio-dark/55">Historique des encaissements reçus pour ce projet.</p></div><Button onClick={openPayment} disabled={project.remainingAmount === 0 || project.status === 'CANCELLED'}><Plus className="h-4 w-4" /> Enregistrer un paiement</Button></div>
      {project.payments.length === 0 ? <Card className="text-sm text-studio-dark/55">Aucun paiement enregistré.</Card> : <TableWrapper><thead><tr><Th>Jalon</Th><Th>Date</Th><Th>Moyen</Th><Th>Référence</Th><Th>Montant</Th><Th>Reçu</Th></tr></thead><tbody>{project.payments.map((payment) => { const receipt = paymentReceipt(payment.id); return <tr key={payment.id}><Td><Badge tone={payment.type === 'FINAL_20' ? 'green' : payment.type === 'CUSTOM' ? 'gray' : 'gold'}>{PAYMENT_TYPE_LABELS[payment.type]}</Badge></Td><Td>{formatDate(payment.paymentDate)}</Td><Td>{methodLabels[payment.method]}</Td><Td>{payment.reference || '—'}</Td><Td><strong>{formatAmount(payment.amount)}</strong></Td><Td>{receipt ? <Button size="sm" variant="secondary" onClick={() => void downloadReceiptPdf(project, receipt, payment)}><Download className="h-3.5 w-3.5" /> PDF</Button> : <span className="text-xs text-studio-dark/45">Indisponible</span>}</Td></tr> })}</tbody></TableWrapper>}
      {finalReceipt ? <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 border-studio-gold/40 bg-studio-gold/10"><div><h3 className="font-semibold text-studio-dark">Facture finale disponible</h3><p className="text-sm text-studio-dark/60">Le projet est entièrement réglé.</p></div><Button variant="secondary" onClick={() => void downloadReceiptPdf(project, finalReceipt)}><Download className="h-4 w-4" /> Télécharger la facture finale</Button></Card> : null}
    </section>

    <Modal open={isPaymentOpen} onClose={() => !isSaving && setIsPaymentOpen(false)} title="Enregistrer un paiement" subtitle="Les jalons 30 %, 50 % et 20 % reprennent automatiquement leur montant prévu.">
      <form className="space-y-4" action={(form) => void savePayment(form)}>
        <Field label="Type de paiement *"><Select name="type" value={paymentType} onChange={(event) => setPaymentType(event.target.value as PaymentType)}><option value="ADVANCE_30" disabled={registeredMilestones.has('ADVANCE_30')}>Avance 30 % — {formatAmount(project.advanceAmount)}</option><option value="INTERMEDIATE_50" disabled={registeredMilestones.has('INTERMEDIATE_50')}>Intermédiaire 50 % — {formatAmount(project.intermediateAmount)}</option><option value="FINAL_20" disabled={registeredMilestones.has('FINAL_20')}>Solde 20 % — {formatAmount(project.finalAmount)}</option><option value="CUSTOM">Versement libre</option></Select></Field>
        {paymentType === 'CUSTOM' ? <Field label="Montant (FCFA) *"><Input name="amount" type="number" min="1" required autoFocus /></Field> : <Card className="p-4 text-sm"><span className="text-studio-dark/55">Montant à enregistrer</span><p className="mt-1 font-serif text-xl font-bold text-studio-dark">{formatAmount(selectedAmount ?? 0)}</p></Card>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Moyen de paiement *"><Select name="method" defaultValue="MOMO"><option value="MOMO">Mobile Money</option><option value="CASH">Espèces</option><option value="BANK">Virement bancaire</option></Select></Field><Field label="Date de paiement *"><Input name="paymentDate" type="date" defaultValue={todayInputValue()} required /></Field></div>
        <Field label="Référence"><Input name="reference" placeholder="Ex. Transaction MTN MoMo" /></Field><Field label="Note"><Textarea name="notes" placeholder="Information complémentaire facultative" /></Field>
        <div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4"><Button variant="ghost" onClick={() => setIsPaymentOpen(false)}>Annuler</Button><Button type="submit" loading={isSaving}>Enregistrer</Button></div>
      </form>
    </Modal>
  </div>
}
