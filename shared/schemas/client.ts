import { z } from 'zod'
import { nameField, phoneField } from './auth.ts'

/** Schéma de validation pour la création d'un client. */
export const createClientSchema = z.object({
  name: nameField,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Adresse email invalide.'))
    .or(z.literal(''))
    .optional(),
  phone: phoneField,
  address: z.string().trim().max(300, 'L’adresse ne doit pas dépasser 300 caractères.').optional(),
  notes: z.string().trim().max(1000, 'Les notes ne doivent pas dépasser 1000 caractères.').optional(),
})

/** Schéma de validation pour la mise à jour d'un client. */
export const updateClientSchema = z
  .object({
    name: nameField.optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email('Adresse email invalide.'))
      .or(z.literal(''))
      .optional(),
    phone: phoneField.optional(),
    address: z.string().trim().max(300, 'L’adresse ne doit pas dépasser 300 caractères.').optional(),
    notes: z.string().trim().max(1000, 'Les notes ne doivent pas dépasser 1000 caractères.').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Aucune modification fournie.',
  })

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
