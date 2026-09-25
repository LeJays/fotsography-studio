import { CURRENCY, DEFAULT_PAYMENT_PERCENTAGES } from './consts.ts'

export interface PaymentPercentages {
  advance: number
  intermediate: number
  final: number
}

export interface PaymentPlan {
  total: number
  advance: number
  intermediate: number
  final: number
}

/**
 * Répartit un montant total en avance / intermédiaire / solde.
 * Les montants sont des entiers (FCFA) : le solde absorbe les arrondis pour que
 * `advance + intermediate + final === total`.
 */
export const computePaymentPlan = (
  totalAmount: number,
  percentages: PaymentPercentages = DEFAULT_PAYMENT_PERCENTAGES,
): PaymentPlan => {
  const total = Math.max(0, Math.round(totalAmount))
  const advance = Math.round((total * percentages.advance) / 100)
  const intermediate = Math.round((total * percentages.intermediate) / 100)

  return {
    total,
    advance,
    intermediate,
    final: total - advance - intermediate,
  }
}

export const sumAmounts = (amounts: readonly number[]): number =>
  amounts.reduce((total, amount) => total + (Number.isFinite(amount) ? amount : 0), 0)

export const computeRemaining = (totalAmount: number, paidAmount: number): number =>
  Math.max(0, Math.round(totalAmount) - Math.round(paidAmount))

/**
 * Accepte `1 500 000`, `1500000`, `1 500 000,5` ou un nombre et renvoie un entier.
 * Utile pour les champs de formulaire (saisie libre des montants).
 */
export const parseAmount = (value: string | number): number => {
  if (typeof value === 'number') return Math.round(Number.isFinite(value) ? value : 0)

  const cleaned = value
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

const amountFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export const formatAmount = (amount: number, currency: string = CURRENCY): string =>
  `${amountFormatter.format(Math.round(amount))} ${currency}`

export const formatAmountPlain = (amount: number): string =>
  amountFormatter.format(Math.round(amount))
