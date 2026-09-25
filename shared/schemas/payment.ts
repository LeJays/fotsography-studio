import { z } from 'zod'

export const createPaymentSchema = z.object({
  type: z.enum(['ADVANCE_30', 'INTERMEDIATE_50', 'FINAL_20', 'CUSTOM']),
  method: z.enum(['CASH', 'MOMO', 'BANK']),
  amount: z.coerce.number().int().positive('Le montant doit être supérieur à zéro.').optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La date de paiement est invalide.'),
  reference: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'CUSTOM' && !data.amount) {
    ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Le montant est requis pour un versement libre.' })
  }
})
