import { z } from 'zod'

export const createTaskSchema = z.object({
  activityId: z.string().uuid('Activité invalide.'),
  assignedUserId: z.string().uuid('Membre invalide.'),
  name: z.string().trim().min(2, 'Le nom de la tâche est requis.').max(160),
  description: z.string().trim().max(2000).optional(),
  deliveryDate: z.string().trim().optional(),
  clientPriceShare: z.coerce.number().int().min(0).optional(),
  memberPayout: z.coerce.number().int().min(0).optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const updateTaskSchema = createTaskSchema
  .omit({ activityId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Aucune modification fournie.')

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

export const updateOwnTaskSchema = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'COMPLETED']),
  /** Si omis, la preuve déjà enregistrée est conservée (le contrôle d'obligatoire est fait côté serveur). */
  proofLink: z.string().trim().url('Le lien de preuve doit être valide.').optional().or(z.literal('')),
})

export type UpdateOwnTaskInput = z.infer<typeof updateOwnTaskSchema>

/** Versement de la rémunération d'un membre : total ou tranche, l'admin paie ce qu'il veut. */
export const payoutTaskSchema = z.object({
  amount: z.coerce.number().int().positive('Le montant doit être supérieur à zéro.'),
  method: z.enum(['CASH', 'MOMO', 'BANK']).optional(),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
})

export type PayoutTaskInput = z.infer<typeof payoutTaskSchema>

/** Validation ou renvoi d'une tâche terminée par l'admin ; le renvoi exige une raison. */
export const reviewTaskSchema = z
  .object({
    decision: z.enum(['APPROVED', 'RETURNED']),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.decision !== 'RETURNED' || Boolean(data.note?.trim()), {
    message: 'Indiquez la raison du renvoi et les corrections attendues.',
    path: ['note'],
  })

export type ReviewTaskInput = z.infer<typeof reviewTaskSchema>
