import { z } from 'zod'

export const createActivitySchema = z.object({
  projectId: z.string().uuid('Projet invalide.'),
  name: z.string().trim().min(2, 'Le nom de l’activité est requis.').max(160),
  description: z.string().trim().max(1000).optional(),
})

export type CreateActivityInput = z.infer<typeof createActivitySchema>

export const updateActivitySchema = createActivitySchema
  .omit({ projectId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Aucune modification fournie.')

export type UpdateActivityInput = z.infer<typeof updateActivitySchema>
