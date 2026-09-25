import { z } from 'zod'

export const createTaskSchema = z.object({
  activityId: z.string().uuid('Activité invalide.'),
  assignedUserId: z.string().uuid('Membre invalide.'),
  name: z.string().trim().min(2, 'Le nom de la tâche est requis.').max(160),
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
  proofLink: z.string().trim().url('Le lien de preuve doit être valide.').optional().or(z.literal('')),
}).refine((data) => data.status !== 'COMPLETED' || Boolean(data.proofLink?.trim()), {
  message: 'Une preuve (lien photo ou vidéo) est obligatoire pour terminer la tâche.', path: ['proofLink'],
})
