import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { ArrowLeft, CalendarDays, Download, Eye, MapPin, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PAYMENT_TYPE_LABELS } from '../../../shared/consts.ts'
import { formatDate, todayInputValue } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { PaymentType, ProjectDetail, ProjectStatus } from '../../../shared/types.ts'
import { Badge, Button, Card, Field, Input, Modal, Select, Skeleton, StatCard, StatsSkeleton, TableWrapper, Td, Textarea, Th, useToast } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { ApiError, createPaymentApi, fetchProject } from '../../lib/api'
import { downloadReceiptPdf, previewReceiptPdf } from '../../lib/receiptPdf'

const labels: Record<ProjectStatus, string> = { DRAFT: 'Brouillon', IN_PROGRESS: 'En cours', DELIVERED: 'Livré', CANCELLED: 'Annulé' }
const tones: Record<ProjectStatus, 'gold' | 'green' | 'red' | 'gray'> = { DRAFT: 'gray', IN_PROGRESS: 'gold', DELIVERED: 'green', CANCELLED: 'red' }
const methodLabels = { CASH: 'Espèces', MOMO: 'Mobile Money', BANK: 'Virement bancaire' } as const

/** Barre de progression segmentée avec légende. */
const ProgressBar = ({ segments }: { segments: { color: string; pct: number }[] }) => (
  <div className="relative h-4 w-full overflow-hidden rounded-full bg-studio-dark/10" role="presentation">
    {segments.reduce<{ offset: number; nodes: React.ReactNode[] }>(
      (acc, seg) => {
        if (seg.pct > 0) {
          acc.nodes.push(
            <div
              key={acc.offset}
              className={`absolute top-0 h-full transition-all ${seg.color}`}
              style={{ left: `${acc.offset}%`, width: `${seg.pct}%` }}
            />,
          )
        }
        return { offset: acc.offset + seg.pct, nodes: acc.nodes }
      },
      { offset: 0, nodes: [] },
    ).nodes}
  </div>
)

/** Widget de suivi financier : ventilation des revenus et marge brute estimée. */
const BudgetBreakdown = ({ project }: { project: ProjectDetail }) => {
  const totalExpenses = project.expenses.reduce((sum, e) => sum + e.amount, 0)
  const allocated = project.taskAllocatedAmount
  const unallocated = Math.max(project.totalAmount - allocated, 0)
  const grossMargin = allocated - totalExpenses
  const isMarginNegative = grossMargin < 0

  const cap = (v: number, max: number) => Math.min(Math.round((v / max) * 100), 100)
  const revPct = project.totalAmount > 0 ? cap : () => 0
  const allocatedPct = revPct(allocated, project.totalAmount)
  const unallocatedPct = revPct(unallocated, project.totalAmount)

  // Sur la barre de marge, la base est `allocated` (= 100 % de la barre).
  const marginBase = allocated > 0 ? allocated : 1
  const expensesPct = Math.min(Math.round((totalExpenses / marginBase) * 100), 100)
  const marginPct = Math.max(100 - expensesPct, 0)

  return (
    <section className="space-y-4" aria-label="Suivi financier du projet">
      <div>
        <h2 className="font-serif text-xl font-bold text-studio-dark">Suivi financier</h2>
        <p className="mt-1 text-sm text-studio-dark/55">
          Ventilation des revenus du projet et estimation de la marge brute.
        </p>
      </div>

      {/* ── Bloc 1 : ventilation des revenus ── */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-studio-dark/45">Revenus — ventilation des tâches</p>
        <div className="flex items-center justify-between text-xs text-studio-dark/40">
          <span>0</span>
          <span>{formatAmount(project.totalAmount)}</span>
        </div>
        <ProgressBar segments={[
          { color: 'bg-studio-terracotta', pct: allocatedPct },
          { color: 'bg-studio-dark/10', pct: unallocatedPct },
        ]} />
        <div className="grid gap-3 pt-1 sm:grid-cols-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-studio-terracotta" aria-hidden="true" />
            <div>
              <p className="font-semibold text-studio-dark">Alloué aux tâches</p>
              <p className="text-studio-dark/60">{formatAmount(allocated)} <span className="text-xs">({allocatedPct} %)</span></p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-studio-dark/10 ring-1 ring-studio-dark/20" aria-hidden="true" />
            <div>
              <p className="font-semibold text-studio-dark">Reste à allouer</p>
              <p className={unallocated === 0 ? 'font-semibold text-studio-terracotta' : 'text-studio-dark/60'}>
                {formatAmount(unallocated)} <span className="text-xs">({unallocatedPct} %)</span>
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Bloc 2 : marge brute ── */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-studio-dark/45">Coûts & marge brute estimée</p>
        {allocated === 0 ? (
          <p className="text-sm text-studio-dark/45 italic">Aucun montant alloué aux tâches — la marge sera calculée dès qu'une tâche aura un montant client.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-studio-dark/40">
              <span>0</span>
              <span>{formatAmount(allocated)} alloués</span>
            </div>
            <ProgressBar segments={[
              { color: 'bg-studio-gold', pct: expensesPct },
              { color: isMarginNegative ? 'bg-red-400' : 'bg-emerald-500', pct: marginPct },
            ]} />
            <div className="grid gap-3 pt-1 sm:grid-cols-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-studio-gold" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-studio-dark">Dépenses</p>
                  <p className="text-studio-dark/60">{formatAmount(totalExpenses)} <span className="text-xs">({expensesPct} %)</span></p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${isMarginNegative ? 'bg-red-400' : 'bg-emerald-500'}`} aria-hidden="true" />
                <div>
                  <p className="font-semibold text-studio-dark">Marge brute</p>
                  <p className={isMarginNegative ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
                    {isMarginNegative ? '−' : '+'}{formatAmount(Math.abs(grossMargin))} <span className="text-xs font-normal">({marginPct} %)</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-studio-dark/10 ring-1 ring-studio-dark/20" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-studio-dark">Non alloué</p>
                  <p className="text-studio-dark/60">{formatAmount(unallocated)}</p>
                </div>
              </div>
            </div>
            {isMarginNegative && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                ⚠ Les dépenses dépassent le montant alloué aux tâches. Vérifiez les saisies ou ajustez les montants.
              </p>
            )}
          </>
        )}
      </Card>
    </section>
  )
}

export const ProjectDetailPage = () => {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)


  const [loading, setLoading] = useState(true)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<PaymentType>('INTERMEDIATE_50')
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setProject((await fetchProject(id)).project)

    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Chargement du projet impossible.')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { void load() }, [load])

  const registeredMilestones = useMemo(() => new Set(project?.payments.filter((payment) => payment.type !== 'CUSTOM').map((payment) => payment.type) ?? []), [project])
  const paymentReceipt = (paymentId: string) => project?.receipts.find((receipt) => receipt.paymentId === paymentId)
  const finalReceipt = project?.receipts.find((receipt) => receipt.isFinalInvoice)
  const selectedAmount = paymentType === 'ADVANCE_30' ? project?.advanceAmount : paymentType === 'INTERMEDIATE_50' ? project?.intermediateAmount : paymentType === 'FINAL_20' ? project?.finalAmount : null

  const openPayment = () => {
    const next = (['INTERMEDIATE_50', 'FINAL_20'] as PaymentType[]).find((type) => !registeredMilestones.has(type)) ?? 'CUSTOM'
    setPaymentType(next)
    setIsPaymentOpen(true)
  }

  const savePayment = async (form: FormData) => {
    if (!project) return
    const type = String(form.get('type')) as PaymentType
    const customAmount = Number(form.get('amount'))
    const paymentDate = String(form.get('paymentDate') ?? '')
    if (!paymentDate || (type === 'CUSTOM' && (!Number.isFinite(customAmount) || customAmount <= 0))) {
      toast.error('Renseignez une date et un montant valide pour un versement libre.')
      return
    }

    setIsSaving(true)

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
      toast.success('Paiement enregistré dans l’historique du projet.')
      await load()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Enregistrement du paiement impossible.')
    } finally {
      setIsSaving(false)
    }
  }
  if (loading) return <div className="space-y-6" aria-hidden="true"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-6 w-64" /></div></div><StatsSkeleton /><Card className="space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></Card></div>
  if (!project) return <div className="space-y-4"><Link to="/projets"><Button variant="secondary"><ArrowLeft className="h-4 w-4" />Retour aux projets</Button></Link></div>

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><Link to="/projets"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link><div><p className="text-xs font-semibold uppercase tracking-wide text-studio-terracotta">{project.clientName}</p><h1 className="font-serif text-2xl font-bold text-studio-dark">{project.eventName}</h1><p className="mt-1 flex items-center gap-2 text-sm text-studio-dark/55"><MapPin className="h-4 w-4" />{project.eventLocation} <CalendarDays className="ml-2 h-4 w-4" />{formatDate(project.eventDate)}</p></div></div><Badge tone={tones[project.status]}>{labels[project.status]}</Badge></div>




    <div className="studio-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {isAdmin ? <StatCard label="Montant total" value={formatAmount(project.totalAmount)} /> : <StatCard label="Client" value={project.clientName} />}
      {isAdmin ? <StatCard label="Encaissé" value={formatAmount(project.paidAmount)} /> : <StatCard label="Lieu" value={project.eventLocation} />}
      {isAdmin ? <StatCard label="Reste à percevoir" value={formatAmount(project.remainingAmount)} /> : <StatCard label="Date de l’événement" value={formatDate(project.eventDate)} />}
      <StatCard label="Livraison globale" value={formatDate(project.globalDeliveryDate)} />
    </div>

    <Card className="space-y-3 text-sm">{isAdmin ? <p><strong>Plan de paiement :</strong> avance {formatAmount(project.advanceAmount)} · intermédiaire {formatAmount(project.intermediateAmount)} · solde {formatAmount(project.finalAmount)}</p> : null}{project.notes ? <p className="whitespace-pre-line text-studio-dark/70">{project.notes}</p> : null}<Link to="/taches" className="inline-block font-semibold text-studio-terracotta hover:underline">Gérer les activités et tâches</Link></Card>

    {isAdmin ? <BudgetBreakdown project={project} /> : null}

    {isAdmin ? <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl font-bold text-studio-dark">Paiements</h2><p className="mt-1 text-sm text-studio-dark/55">Historique des encaissements reçus pour ce projet.</p></div><Button onClick={openPayment} disabled={project.remainingAmount === 0 || project.status === 'CANCELLED'}><Plus className="h-4 w-4" /> Enregistrer un paiement</Button></div>
      {project.payments.length === 0 ? <Card className="text-sm text-studio-dark/55">Aucun paiement enregistré.</Card> : <TableWrapper><thead><tr><Th>Jalon</Th><Th>Date</Th><Th>Moyen</Th><Th>Référence</Th><Th>Montant</Th><Th>Reçu</Th></tr></thead><tbody>{project.payments.map((payment) => { const receipt = paymentReceipt(payment.id); return <tr key={payment.id}><Td><Badge tone={payment.type === 'FINAL_20' ? 'green' : payment.type === 'CUSTOM' ? 'gray' : 'gold'}>{PAYMENT_TYPE_LABELS[payment.type]}</Badge></Td><Td>{formatDate(payment.paymentDate)}</Td><Td>{methodLabels[payment.method]}</Td><Td>{payment.reference || '—'}</Td><Td><strong>{formatAmount(payment.amount)}</strong></Td><Td>{receipt ? <div className="flex items-center gap-1"><Button size="sm" variant="ghost" title="Voir le reçu" onClick={() => void previewReceiptPdf(project, receipt, payment)}><Eye className="h-3.5 w-3.5" /></Button><Button size="sm" variant="secondary" onClick={() => void downloadReceiptPdf(project, receipt, payment)}><Download className="h-3.5 w-3.5" /> PDF</Button></div> : <span className="text-xs text-studio-dark/45">Indisponible</span>}</Td></tr> })}</tbody></TableWrapper>}
      {finalReceipt ? <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 border-studio-gold/40 bg-studio-gold/10"><div><h3 className="font-semibold text-studio-dark">Facture finale disponible</h3><p className="text-sm text-studio-dark/60">Le projet est entièrement réglé.</p></div><div className="flex flex-wrap items-center gap-2"><Button variant="secondary" onClick={() => void previewReceiptPdf(project, finalReceipt)}><Eye className="h-4 w-4" /> Voir la facture</Button><Button variant="secondary" onClick={() => void downloadReceiptPdf(project, finalReceipt)}><Download className="h-4 w-4" /> Télécharger la facture finale</Button></div></Card> : null}
    </section> : null}

    <Modal open={isAdmin && isPaymentOpen} onClose={() => !isSaving && setIsPaymentOpen(false)} title="Enregistrer un paiement" subtitle="Les jalons 30 %, 50 % et 20 % reprennent automatiquement leur montant prévu.">
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
