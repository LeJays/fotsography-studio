import { z } from 'zod'

const dateField = z.string().date('Date invalide.')

export const createProjectSchema = z
  .object({
    clientId: z.string().uuid('Client invalide.'),
    eventName: z.string().trim().min(2, 'Le nom de l’événement est requis.').max(160),
    eventLocation: z.string().trim().min(2, 'Le lieu est requis.').max(300),
    eventDate: dateField,
    globalDeliveryDate: dateField,
    totalAmount: z.coerce.number().int().positive('Le montant doit être supérieur à zéro.'),
    collectAdvanceNow: z.boolean().optional(),
    status: z.enum(['DRAFT', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED']).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.globalDeliveryDate >= data.eventDate, {
    message: 'La livraison globale doit être postérieure à l’événement.',
    path: ['globalDeliveryDate'],
  })

export type CreateProjectInput = z.infer<typeof createProjectSchema>
