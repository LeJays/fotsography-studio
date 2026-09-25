import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '../consts.ts'

/** Normalise un email : espaces retirés + minuscules (types d'entrée/sortie identiques). */
export const emailField = z.string().trim().toLowerCase().pipe(z.email('Adresse email invalide.'))

const trimmed = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value)

export const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`)

export const nameField = z
  .string()
  .trim()
  .min(2, 'Le nom complet doit contenir au moins 2 caractères.')

export const phoneField = z.string().trim().min(8, 'Numéro de téléphone invalide.')

/** Connexion : email OU nom complet + mot de passe. */
export const loginSchema = z.object({
  identifier: z.preprocess(trimmed, z.string().min(1, 'Saisissez votre email ou votre nom.')),
  password: z.string().min(1, 'Mot de passe requis.'),
})

/** Création du compte administrateur principal (première installation). */
export const registerAdminSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  password: passwordField,
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis.'),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'Confirmation requise.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterAdminInput = z.infer<typeof registerAdminSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
