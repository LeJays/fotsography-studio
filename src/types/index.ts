export type UserRole = 'ADMIN' | 'PHOTOGRAPHER' | 'EDITOR' | 'ASSISTANT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export type PaymentType = 'ADVANCE_30' | 'INTERMEDIATE_50' | 'FINAL_20';

export interface Payment {
  id: string;
  projectId: string;
  type: PaymentType;
  amount: number;
  date: string;
  notes?: string;
}

export interface Expense {
  id: string;
  activityId: string;
  description: string;
  amount: number;
  date: string;
}

export interface Task {
  id: string;
  activityId: string;
  assignedUserId: string;
  name: string;
  clientPriceShare: number; // Masqué pour les membres, visible uniquement par l'Admin
  memberPayout: number;     // Rémunération reçue par le membre
  deliveryDate: string;     // Date calculée automatiquement (Project globalDeliveryDate - 5 jours)
  proofLink?: string;       // Lien de vérification envoyé par le membre
  status: 'PENDING' | 'IN_REVIEW' | 'COMPLETED';
}

export interface Activity {
  id: string;
  projectId: string;
  name: string;
  description: string;
  expenses: Expense[];
  tasks: Task[];
}

export interface Project {
  id: string;
  client: Client;
  eventName: string;
  eventLocation: string;
  eventDate: string;
  globalDeliveryDate: string;
  totalAmount: number;
  advanceAmount: number;      // 30% du montant total
  intermediateAmount: number; // 50% du montant total
  finalAmount: number;        // 20% du montant total
  activities: Activity[];
  payments: Payment[];
  status: 'DRAFT' | 'IN_PROGRESS' | 'DELIVERED';
  createdAt: string;
}