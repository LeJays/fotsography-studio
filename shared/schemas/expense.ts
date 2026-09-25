import { z } from 'zod'

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La date de dépense est invalide.')

export const createExpenseSchema = z.object({
  activityId: z.string().uuid('Activité invalide.'),
  description: z.string().trim().min(2, 'La description de la dépense est requise.').max(240),
  supplier: z.string().trim().max(160).optional(),
  amount: z.coerce.number().int('Le montant doit être un nombre entier.').positive('Le montant doit être supérieur à zéro.'),
  expenseDate: dateInput,
})

export const updateExpenseSchema = createExpenseSchema
  .omit({ activityId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Aucune modification fournie.')
