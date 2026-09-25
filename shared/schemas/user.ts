import { z } from 'zod'
import { emailField, nameField, passwordField, phoneField } from './auth.ts'

/** Rôles internes qu'un administrateur peut attribuer à un membre. */
export const staffRoleField = z.enum([
  'ADMIN',
  'PHOTOGRAPHER',
  'VIDEOGRAPHER',
  'EDITOR',
  'ASSISTANT',
])

export const createUserSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  role: staffRoleField,
  password: passwordField,
})

export const updateUserSchema = z
  .object({
    name: nameField.optional(),
    phone: phoneField.optional(),
    role: staffRoleField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Aucune modification fournie.',
  })

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
