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

/** Réinitialisation admin d'un mot de passe — corps accepté par l'API. */
export const resetPasswordSchema = z.object({
  password: passwordField,
})

/** Formulaire de réinitialisation (client) : mot de passe + confirmation. */
export const resetPasswordFormSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, 'Confirmation requise.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordFormSchema>
