/**
 * Vérification de la logique de cumul des pénalités (sans base de données).
 *   node scripts/penalty-check.ts
 */
import { describePenalty, type PenaltySettings, type PenaltyTaskRow } from '../server/services/penalties.ts'

const settings: PenaltySettings = { enabled: true, amount: 10000, intervalDays: 2 }
const now = new Date(Date.UTC(2026, 5, 15, 12, 0, 0))

const task = (overrides: Partial<PenaltyTaskRow> = {}): PenaltyTaskRow => ({
  id: 'task',
  deliveryDate: new Date(Date.UTC(2026, 5, 10)), // 10 juin à minuit UTC
  status: 'PENDING',
  archivedAt: null,
  latePenaltyBlocks: 0,
  latePenaltyAccrued: 0,
  latePenaltyFinalizedAt: null,
  assignedUser: { id: 'u1', name: 'Membre', role: 'EDITOR' },
  ...overrides,
})

let failures = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${name}${info ? ` — ${info}` : ''}`)
  if (!ok) failures += 1
}

// Jours de retard du 10/06 → 15/06 = 5 jours.
const fiveLate = { ...task(), latePenaltyBlocks: 2, latePenaltyAccrued: 20000 }
const snap = describePenalty(fiveLate, settings, now)
check('5 jours de retard → ceil(5/2)=3 tranches', snap.blocks === 3 && snap.accrued === 30000, `${snap.blocks} tranches / ${snap.accrued}`)
check('cumul en cours', snap.running === true)

const sameDay = describePenalty(task({ deliveryDate: new Date(Date.UTC(2026, 5, 15)) }), settings, now)
check('le jour même → 0 pénalité', sameDay.blocks === 0 && sameDay.running === false)

const oneLate = describePenalty(task({ deliveryDate: new Date(Date.UTC(2026, 5, 14)) }), settings, now)
check('1 jour de retard → 1 tranche (10 000)', oneLate.blocks === 1 && oneLate.accrued === 10000)

const threeLate = describePenalty(task({ deliveryDate: new Date(Date.UTC(2026, 5, 12)) }), settings, now)
check('3 jours de retard → 2 tranches (20 000)', threeLate.blocks === 2 && threeLate.accrued === 20000)

const submitted = describePenalty(task({ status: 'IN_REVIEW', latePenaltyBlocks: 1, latePenaltyAccrued: 10000 }), settings, now)
check('travail envoyé → figé + dernier cumul jusqu’à l’envoi', submitted.running === false && submitted.finalizedAt !== null && submitted.blocks === 3 && submitted.accrued === 30000, `${submitted.blocks} tranches / ${submitted.accrued}`)

const frozen = describePenalty(task({ latePenaltyFinalizedAt: new Date(Date.UTC(2026, 5, 13)), latePenaltyBlocks: 1, latePenaltyAccrued: 10000 }), settings, now)
check('déjà figé → inchangé (changed=false)', frozen.changed === false && frozen.blocks === 1 && frozen.running === false)

const disabled = describePenalty(task(), { ...settings, enabled: false }, now)
check('option décochée → aucun cumul nouveau', disabled.blocks === 0 && disabled.running === false && disabled.changed === false)

const keptDebt = describePenalty(task({ latePenaltyBlocks: 2, latePenaltyAccrued: 20000 }), { ...settings, enabled: false }, now)
check('option décochée → dette existante conservée', keptDebt.accrued === 20000 && keptDebt.changed === false)

const admin = describePenalty(task({ assignedUser: { id: 'a', name: 'Admin', role: 'ADMIN' } }), settings, now)
check('tâche assignée à l’admin → jamais pénalisée', admin.blocks === 0 && admin.running === false)

const archived = describePenalty(task({ archivedAt: now, latePenaltyBlocks: 1, latePenaltyAccrued: 10000 }), settings, now)
check('tâche archivée → figée (cumul jusqu’à l’archivage)', archived.finalizedAt !== null && archived.running === false && archived.blocks === 3 && archived.accrued === 30000)

// Ne jamais diminuer un cumul acquis (date repoussée après coup).
const noDecrease = describePenalty(task({ deliveryDate: new Date(Date.UTC(2026, 6, 1)), latePenaltyBlocks: 3, latePenaltyAccrued: 30000 }), settings, now)
check('cumul acquis jamais diminué', noDecrease.blocks === 3 && noDecrease.accrued === 30000 && noDecrease.changed === false)

// Delta au montant courant si le montant a changé entre-temps.
const changedAmount = describePenalty(task({ latePenaltyBlocks: 1, latePenaltyAccrued: 10000 }), { ...settings, amount: 5000 }, now)
check('nouvelles tranches au montant courant', changedAmount.blocks === 3 && changedAmount.accrued === 20000, `${changedAmount.accrued} (1×10 000 acquis + 2×5 000)`)

void fiveLate
console.log(failures === 0 ? '\nToutes les vérifications de calcul sont passées.\n' : `\n${failures} échec(s).\n`)
process.exit(failures > 0 ? 1 : 0)
