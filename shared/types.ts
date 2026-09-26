import type { AuthRole, StaffRole } from './consts.ts'

/** Utilisateur connecté, tel que renvoyé par l'API (jamais de mot de passe). */
export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string
  role: AuthRole
  isActive: boolean
  mustChangePassword: boolean
}

export interface AuthResponse {
  user: AuthUser
}

export interface LoginPayload {
  /** Adresse email (`awa@studio.com`) OU nom complet (`Awa Traoré`). */
  identifier: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  phone: string
  password: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword?: string
}

/** Indique si l'installation initiale (création du compte admin) est encore requise. */
export interface SetupStatus {
  needsAdmin: boolean
}

/** Membre de l'équipe affiché dans la page « Équipe ». */
export interface UserSummary {
  id: string
  name: string
  email: string
  phone: string
  role: AuthRole
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface CreateUserPayload {
  name: string
  email: string
  phone: string
  role: StaffRole
  password: string
}

/** Membre proposé pour l'assignation d'une tâche (admin + assistant) — sans coordonnées personnelles. */
export interface AssignableUser {
  id: string
  name: string
  role: AuthRole
  isActive: boolean
}

export interface UpdateUserPayload {
  name?: string
  phone?: string
  role?: StaffRole
  isActive?: boolean
}

/* ----------------------------------- Clients ----------------------------------- */

export interface ClientSummary {
  id: string
  name: string
  email: string | null
  phone: string
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  createdByName: string | null
  projectCount: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
}

export interface ClientProjectSummary {
  id: string
  eventName: string
  eventLocation: string
  eventDate: string
  globalDeliveryDate: string
  totalAmount: number
  advanceAmount: number
  intermediateAmount: number
  finalAmount: number
  status: 'DRAFT' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED'
  paidAmount: number
  remainingAmount: number
  createdAt: string
}

export interface ClientDetail extends ClientSummary {
  projects: ClientProjectSummary[]
}

export interface CreateClientPayload {
  name: string
  email?: string | null
  phone: string
  address?: string | null
  notes?: string | null
}

export interface UpdateClientPayload {
  name?: string
  email?: string | null
  phone?: string
  address?: string | null
  notes?: string | null
}

/* ----------------------------------- Projets ----------------------------------- */

export type ProjectStatus = 'DRAFT' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED'

export interface ProjectSummary {
  id: string
  clientId: string
  clientName: string
  eventName: string
  eventLocation: string
  eventDate: string
  globalDeliveryDate: string
  totalAmount: number
  advanceAmount: number
  intermediateAmount: number
  finalAmount: number
  status: ProjectStatus
  paidAmount: number
  remainingAmount: number
  createdAt: string
}

export interface ProjectDetail extends ProjectSummary {
  notes: string | null
  payments: PaymentSummary[]
  receipts: ReceiptSummary[]
  expenses: ProjectExpenseSummary[]
}

export interface ProjectExpenseSummary {
  id: string
  activityName: string
  description: string
  supplier: string | null
  amount: number
  expenseDate: string
}

export type PaymentType = 'ADVANCE_30' | 'INTERMEDIATE_50' | 'FINAL_20' | 'CUSTOM'
export type PaymentMethod = 'CASH' | 'MOMO' | 'BANK'

export interface PaymentSummary {
  id: string
  type: PaymentType
  method: PaymentMethod
  amount: number
  paymentDate: string
  reference: string | null
  notes: string | null
  receivedByName: string | null
}

export interface ReceiptSummary {
  id: string
  number: string
  type: PaymentType
  paymentId: string | null
  amount: number
  issuedAt: string
  isFinalInvoice: boolean
}

export interface CreateProjectPayload {
  clientId: string
  eventName: string
  eventLocation: string
  eventDate: string
  globalDeliveryDate: string
  totalAmount: number
  /** Par défaut, l'avance est enregistrée avec la création du projet. */
  collectAdvanceNow?: boolean
  status?: ProjectStatus
  notes?: string
}

export interface CreatePaymentPayload {
  type: PaymentType
  method: PaymentMethod
  amount?: number
  paymentDate: string
  reference?: string
  notes?: string
}

export interface FinanceProjectSummary { id: string; eventName: string; clientName: string; totalAmount: number; paidAmount: number; remainingAmount: number; expenseAmount: number; memberPayout: number; margin: number }
export interface FinanceMemberSummary { id: string; name: string; payout: number; taskCount: number }
export interface FinanceOverview { totalRevenue: number; collected: number; remaining: number; expenses: number; memberPayouts: number; netMargin: number; projects: FinanceProjectSummary[]; members: FinanceMemberSummary[] }

/** Vue de pilotage destinée à l'admin et à l'assistant : aucune donnée financière. */
export interface OperationsProjectSummary {
  id: string
  eventName: string
  clientName: string
  eventLocation: string
  eventDate: string
  globalDeliveryDate: string
  status: ProjectStatus
  taskCount: number
  pendingTaskCount: number
  reviewTaskCount: number
  completedTaskCount: number
  nextTaskDeliveryDate: string | null
}

export interface OperationsOverview {
  projects: OperationsProjectSummary[]
  totalTaskCount: number
  pendingTaskCount: number
  reviewTaskCount: number
  completedTaskCount: number
}

/* -------------------------------- Activités / tâches ------------------------------- */

export interface ActivitySummary {
  id: string
  projectId: string
  projectName: string
  name: string
  description: string | null
  expenseCount: number
  expenseAmount: number
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
}

export interface ExpenseSummary {
  id: string
  activityId: string
  description: string
  supplier: string | null
  amount: number
  expenseDate: string
  createdByName: string | null
}

export interface TaskPayoutSummary {
  id: string
  amount: number
  method: PaymentMethod
  reference: string | null
  note: string | null
  receiptNumber: string | null
  paidAt: string
  paidByName: string | null
}

export type TaskReviewDecision = 'APPROVED' | 'RETURNED'

export interface TaskReviewSummary {
  id: string
  decision: TaskReviewDecision
  note: string | null
  reviewedAt: string
  reviewedByName: string | null
}

export interface TaskSummary {
  id: string
  name: string
  activityId: string
  activityName: string
  projectName: string
  assignedUserId: string
  assignedUserName: string
  deliveryDate: string
  status: 'PENDING' | 'IN_REVIEW' | 'COMPLETED'
  proofLink: string | null
  memberPayout: number | null
  payoutPaidAt: string | null
  clientPriceShare?: number | null
  /** Historique des versements — visible uniquement par l'admin et l'assigné. */
  payouts?: TaskPayoutSummary[]
  /** Total déjà versé — visible uniquement par l'admin et l'assigné. */
  paidPayout?: number
  /** Reste à verser — visible uniquement par l'admin et l'assigné. */
  payoutRemaining?: number
  /** Historique des validations/renvois par l'admin. */
  reviews?: TaskReviewSummary[]
}

export interface PayoutTaskPayload {
  amount: number
  method?: PaymentMethod
  reference?: string
  note?: string
}

export interface ReviewTaskPayload {
  decision: TaskReviewDecision
  note?: string
}

export interface CreateActivityPayload { projectId: string; name: string; description?: string }
export interface CreateTaskPayload { activityId: string; assignedUserId: string; name: string; clientPriceShare?: number; memberPayout?: number }
export interface CreateExpensePayload { activityId: string; description: string; supplier?: string; amount: number; expenseDate: string }
export interface UpdateExpensePayload { description?: string; supplier?: string; amount?: number; expenseDate?: string }

