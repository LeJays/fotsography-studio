import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, HandCoins } from 'lucide-react'
import { formatDate } from '../../../shared/dates.ts'
import { formatAmount } from '../../../shared/money.ts'
import type { PenaltyMemberSummary, PenaltyOverview, PaymentMethod } from '../../../shared/types.ts'
import { Badge, Button, Card, Field, Input, Modal, Select, StatCard, TableWrapper, Td, Th, useToast } from '../../components/ui'
import { ApiError, fetchPenaltiesApi, payPenaltyApi } from '../../lib/api'

const METHOD_LABELS: Record<PaymentMethod, string> = { CASH: 'Espèces', MOMO: 'Mobile Money', BANK: 'Virement bancaire' }
const KIND_LABELS = { MANUAL: 'Paiement direct', WITHDRAWN: 'Déduction sur versement' } as const

/**
 * Suivi des pénalités de retard (admin) : solde par membre, tâches pénalisées
 * et historique complet des règlements (paiements directs + déductions).
 */
export const PenaltiesPanel = () => {
  const toast = useToast()
  const [overview, setOverview] = useState<PenaltyOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<{ userId: string; name: string; balance: number } | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setOverview((await fetchPenaltiesApi()).overview)
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Chargement des pénalités impossible.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const openPayment = (member: PenaltyMemberSummary) => {
    setTarget({ userId: member.userId, name: member.name, balance: member.balance })
    setAmount(String(member.balance))
    setMethod('CASH')
    setReference('')
    setNote('')
  }

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault()
    if (!target) return

    const value = Math.round(Number(amount))
    if (!value || value <= 0) {
      toast.error('Indiquez le montant du règlement.')
      return
    }

    if (value > target.balance) {
      toast.error(`Le montant dépasse le solde dû (${formatAmount(target.balance)}).`)
      return
    }

    setSaving(true)

    try {
      const result = await payPenaltyApi({
        userId: target.userId,
        amount: value,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      })

      toast.success(
        `Règlement de ${formatAmount(value)} enregistré pour ${target.name}. Solde restant : ${formatAmount(result.balance)}.`,
      )
      setTarget(null)
      await load()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Card className="p-8 text-center text-sm text-studio-dark/55">Chargement des pénalités…</Card>
  }

  if (!overview) {
    return null
  }

  const tasks = overview.members.flatMap((member) =>
    member.tasks.map((task) => ({ ...task, memberName: member.name })),
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-studio-dark">Pénalités de retard</h2>
          <p className="mt-1 text-sm text-studio-dark/55">
            {overview.enabled
              ? `Option active : ${formatAmount(overview.amount)} de tranche tous les ${overview.intervalDays} jours (dès 1 jour de retard).`
              : 'Option désactivée — seul l’administrateur peut l’activer dans les Réglages du studio.'}
          </p>
        </div>
        <Badge tone={overview.enabled ? 'green' : 'gray'} dot>
          {overview.enabled ? 'Active' : 'Désactivée'}
        </Badge>
      </div>

      <div className="studio-stagger grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pénalités accumulées"
          value={formatAmount(overview.totals.accrued)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Règlements enregistrés"
          value={formatAmount(overview.totals.paid)}
          icon={<HandCoins className="h-5 w-5" />}
        />
        <StatCard label="Reste dû par l’équipe" value={formatAmount(overview.totals.balance)} />
      </div>

      <Card className="space-y-4">
        <div>
          <h3 className="font-serif text-lg font-bold">Solde par membre</h3>
          <p className="text-xs text-studio-dark/55">Le solde dû est retenu automatiquement sur le prochain versement.</p>
        </div>

        {overview.members.length === 0 ? (
          <p className="text-sm text-studio-dark/55">Aucune pénalité enregistrée pour le moment.</p>
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Membre</Th>
                <Th>Accumulé</Th>
                <Th>Payé</Th>
                <Th>Solde dû</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {overview.members.map((member) => (
                <tr key={member.userId}>
                  <Td>
                    <strong>{member.name}</strong>
                    <span className="block text-xs text-studio-dark/50">
                      {member.tasks.length} tâche{member.tasks.length > 1 ? 's' : ''} pénalisée{member.tasks.length > 1 ? 's' : ''}
                    </span>
                  </Td>
                  <Td>{formatAmount(member.accrued)}</Td>
                  <Td className="text-green-700">{formatAmount(member.paid)}</Td>
                  <Td>
                    <strong className={member.balance > 0 ? 'text-red-600' : 'text-green-700'}>
                      {formatAmount(member.balance)}
                    </strong>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" disabled={member.balance <= 0} onClick={() => openPayment(member)}>
                      <HandCoins className="h-3.5 w-3.5" /> Encaisser
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </Card>

      {tasks.length > 0 ? (
        <Card className="space-y-4">
          <div>
            <h3 className="font-serif text-lg font-bold">Tâches pénalisées</h3>
            <p className="text-xs text-studio-dark/55">Le cumul s’arrête dès que le membre envoie son travail.</p>
          </div>

          <TableWrapper>
            <thead>
              <tr>
                <Th>Tâche</Th>
                <Th>Membre</Th>
                <Th>Livraison prévue</Th>
                <Th>Retard</Th>
                <Th>Tranches</Th>
                <Th>Montant</Th>
                <Th>État</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <Td>
                    <strong>{task.name}</strong>
                    <span className="block text-xs text-studio-dark/50">
                      {task.projectName} · {task.activityName}
                    </span>
                  </Td>
                  <Td>{task.memberName}</Td>
                  <Td className="whitespace-nowrap">{formatDate(task.deliveryDate)}</Td>
                  <Td>{task.daysLate} j</Td>
                  <Td>{task.blocks}</Td>
                  <Td>
                    <strong className="text-red-600">{formatAmount(task.accrued)}</strong>
                  </Td>
                  <Td>
                    {task.running ? <Badge tone="red" dot>En cumul</Badge> : <Badge tone="green">Figée</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div>
          <h3 className="font-serif text-lg font-bold">Historique des règlements</h3>
          <p className="text-xs text-studio-dark/55">Traçabilité complète : paiements directs et déductions sur versements.</p>
        </div>

        {overview.payments.length === 0 ? (
          <p className="text-sm text-studio-dark/55">Aucun règlement de pénalité enregistré.</p>
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Membre</Th>
                <Th>Montant</Th>
                <Th>Type</Th>
                <Th>Moyen</Th>
                <Th>Référence</Th>
                <Th>Tâche</Th>
                <Th>Reçu</Th>
                <Th>Par</Th>
              </tr>
            </thead>
            <tbody>
              {overview.payments.map((payment) => (
                <tr key={payment.id}>
                  <Td className="whitespace-nowrap">{formatDate(payment.paidAt)}</Td>
                  <Td>{payment.userName}</Td>
                  <Td>
                    <strong>{formatAmount(payment.amount)}</strong>
                  </Td>
                  <Td>
                    <Badge tone={payment.kind === 'WITHDRAWN' ? 'gold' : 'green'}>{KIND_LABELS[payment.kind]}</Badge>
                  </Td>
                  <Td>{METHOD_LABELS[payment.method]}</Td>
                  <Td>{payment.reference || '—'}</Td>
                  <Td>{payment.taskName || '—'}</Td>
                  <Td className="whitespace-nowrap">{payment.receiptNumber || '—'}</Td>
                  <Td>{payment.paidByName || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </Card>

      <Modal
        open={target !== null}
        onClose={() => !saving && setTarget(null)}
        title="Enregistrer un règlement de pénalité"
        subtitle={
          target
            ? `${target.name} — solde dû : ${formatAmount(target.balance)}. Le paiement partiel est autorisé.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Annuler
            </Button>
            <Button form="penalty-form" type="submit" loading={saving}>
              <HandCoins className="h-4 w-4" /> Enregistrer le règlement
            </Button>
          </>
        }
      >
        <form id="penalty-form" onSubmit={submitPayment} className="space-y-4">
          <Field label={`Montant à régler (solde dû : ${formatAmount(target?.balance ?? 0)})`}>
            <Input
              type="number"
              min={1}
              max={target?.balance ?? 0}
              required
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Moyen de paiement">
              <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                <option value="CASH">Espèces</option>
                <option value="MOMO">Mobile Money</option>
                <option value="BANK">Virement bancaire</option>
              </Select>
            </Field>

            <Field label="Référence (facultatif)">
              <Input
                placeholder="N° transaction…"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Note (facultatif)">
            <Input
              placeholder="Contexte du règlement…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          <p className="text-xs text-studio-dark/50">
            Enregistrez ce que le membre paye, même partiellement : le reste reste dû et sera déduit automatiquement sur son prochain versement.
          </p>
        </form>
      </Modal>
    </section>
  )
}

