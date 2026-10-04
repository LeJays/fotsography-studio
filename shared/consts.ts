/** Constantes métier partagées entre le serveur (Node) et le front (React). */

export const ROLES = [
  'ADMIN',
  'PHOTOGRAPHER',
  'VIDEOGRAPHER',
  'EDITOR',
  'ASSISTANT',
  'CLIENT',
] as const

export type AuthRole = (typeof ROLES)[number]

/** Rôles internes au studio (les membres que l'admin peut créer). */
export const STAFF_ROLES = ['ADMIN', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'EDITOR', 'ASSISTANT'] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export const ROLE_LABELS: Record<AuthRole, string> = {
  ADMIN: 'Administrateur',
  PHOTOGRAPHER: 'Photographe',
  VIDEOGRAPHER: 'Vidéaste',
  EDITOR: 'Monteur / Retoucheur',
  ASSISTANT: 'Assistant',
  CLIENT: 'Client',
}

export const CURRENCY = 'FCFA'

/** Nombre de jours avant la livraison globale pour la livraison d'une tâche. */
export const TASK_DELIVERY_LEAD_DAYS = 5

/** Montant (FCFA) d'une tranche de pénalité pour une tâche livrée en retard. */
export const LATE_PENALTY_AMOUNT = 10000

/** Fréquence du cumul de pénalité : une tranche tous les 2 jours (première tranche dès 1 jour de retard). */
export const LATE_PENALTY_INTERVAL_DAYS = 2

export const MIN_PASSWORD_LENGTH = 6

/** Fourchettes du plan de paiement par défaut (30 % / 50 % / 20 %). */
export const DEFAULT_PAYMENT_PERCENTAGES = {
  advance: 30,
  intermediate: 50,
  final: 20,
} as const

export const TASK_STATUS_LABELS = {
  PENDING: 'À faire',
  IN_REVIEW: 'En vérification',
  COMPLETED: 'Terminée',
} as const

export const PROJECT_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  IN_PROGRESS: 'En cours',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
} as const

export const PAYMENT_TYPE_LABELS = {
  ADVANCE_30: 'Avance 30 %',
  INTERMEDIATE_50: 'Intermédiaire 50 %',
  FINAL_20: 'Solde 20 %',
  CUSTOM: 'Versement libre',
} as const
