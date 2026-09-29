import { createProjectSchema } from '../../shared/schemas/project.ts'
import { computePaymentPlan, computeRemaining } from '../../shared/money.ts'
import type { CreateProjectPayload, ProjectDetail, ProjectSummary, ReceiptSummary } from '../../shared/types.ts'
import { fromDateInputValue } from '../../shared/dates.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'

const toPayment = (payment: { id: string; type: 'ADVANCE_30' | 'INTERMEDIATE_50' | 'FINAL_20' | 'CUSTOM'; method: 'CASH' | 'MOMO' | 'BANK'; amount: number; paymentDate: Date; reference: string | null; notes: string | null; receivedBy: { name: string } | null }) => ({
  id: payment.id, type: payment.type, method: payment.method, amount: payment.amount, paymentDate: payment.paymentDate.toISOString(), reference: payment.reference, notes: payment.notes, receivedByName: payment.receivedBy?.name ?? null,
})
const toReceipt = (receipt: { id: string; number: string; type: 'ADVANCE_30' | 'INTERMEDIATE_50' | 'FINAL_20' | 'CUSTOM'; paymentId: string | null; amount: number; issuedAt: Date; snapshot: unknown }): ReceiptSummary => ({ id: receipt.id, number: receipt.number, type: receipt.type, paymentId: receipt.paymentId, amount: receipt.amount, issuedAt: receipt.issuedAt.toISOString(), isFinalInvoice: Boolean((receipt.snapshot as { documentType?: string } | null)?.documentType === 'FINAL_INVOICE') })
const receiptNumber = async (prefix: string): Promise<string> => {
  const count = await prisma.receipt.count()
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
}

const toProjectSummary = (project: {
  id: string; clientId: string; eventName: string; eventLocation: string; eventDate: Date; globalDeliveryDate: Date
  totalAmount: number; advanceAmount: number; intermediateAmount: number; finalAmount: number
  status: ProjectSummary['status']; createdAt: Date; client: { name: string }; payments: { amount: number }[]
}, includeAmounts: boolean): ProjectSummary => {
  const paidAmount = project.payments.reduce((total, payment) => total + payment.amount, 0)
  return {
    id: project.id, clientId: project.clientId, clientName: project.client.name,
    eventName: project.eventName, eventLocation: project.eventLocation,
    eventDate: project.eventDate.toISOString(), globalDeliveryDate: project.globalDeliveryDate.toISOString(),
    // L'assistant pilote les projets sans accéder aux montants.
    totalAmount: includeAmounts ? project.totalAmount : 0, advanceAmount: includeAmounts ? project.advanceAmount : 0,
    intermediateAmount: includeAmounts ? project.intermediateAmount : 0, finalAmount: includeAmounts ? project.finalAmount : 0,
    status: project.status, paidAmount: includeAmounts ? paidAmount : 0,
    remainingAmount: includeAmounts ? computeRemaining(project.totalAmount, paidAmount) : 0,
    createdAt: project.createdAt.toISOString(),
  }
}

const listProjects = async (ctx: RouteContext): Promise<void> => {
  await prisma.project.updateMany({
    where: { archivedAt: null, status: 'DRAFT', activities: { some: { archivedAt: null } } },
    data: { status: 'IN_PROGRESS' },
  })
  const projects = await prisma.project.findMany({
    where: { archivedAt: null }, orderBy: { eventDate: 'desc' },
    include: { client: { select: { name: true } }, payments: { where: { archivedAt: null }, select: { amount: true } } },
  })
  sendJson(ctx.res, 200, { projects: projects.map((project) => toProjectSummary(project, ctx.actor?.role === 'ADMIN')) })
}

const getProject = async (ctx: RouteContext): Promise<void> => {
  await prisma.project.updateMany({
    where: { id: ctx.params.id, archivedAt: null, status: 'DRAFT', activities: { some: { archivedAt: null } } },
    data: { status: 'IN_PROGRESS' },
  })
  const project = await prisma.project.findFirst({
    where: { id: ctx.params.id, archivedAt: null },
    include: { client: { select: { name: true, phone: true, email: true } }, payments: { where: { archivedAt: null }, include: { receivedBy: { select: { name: true } } }, orderBy: { paymentDate: 'desc' } }, receipts: { orderBy: { issuedAt: 'desc' } }, activities: { where: { archivedAt: null }, include: { expenses: { where: { archivedAt: null }, orderBy: { expenseDate: 'asc' } } } } },
  })
  if (!project) throw new HttpError(404, 'Projet introuvable.')
  const isAdmin = ctx.actor?.role === 'ADMIN'
  const summary = toProjectSummary(project, isAdmin)
  // Paiements, reçus et dépenses restent réservés à l'admin.
  const detail: ProjectDetail = { ...summary, notes: project.notes, clientPhone: project.client.phone ?? null, clientEmail: project.client.email ?? null, payments: isAdmin ? project.payments.map(toPayment) : [], receipts: isAdmin ? project.receipts.map(toReceipt) : [], expenses: isAdmin ? project.activities.flatMap((activity) => activity.expenses.map((expense) => ({ id: expense.id, activityName: activity.name, description: expense.description, supplier: expense.supplier, amount: expense.amount, expenseDate: expense.expenseDate.toISOString() }))) : [] }
  sendJson(ctx.res, 200, { project: detail })
}

const createProject = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<CreateProjectPayload>(ctx)
  const client = await prisma.client.findFirst({ where: { id: data.clientId, archivedAt: null } })
  if (!client) throw new HttpError(404, 'Client introuvable.')
  const plan = computePaymentPlan(data.totalAmount)
  const project = await prisma.project.create({
    data: {
      clientId: data.clientId, eventName: data.eventName, eventLocation: data.eventLocation,
      eventDate: fromDateInputValue(data.eventDate), globalDeliveryDate: fromDateInputValue(data.globalDeliveryDate),
      totalAmount: plan.total, advanceAmount: plan.advance, intermediateAmount: plan.intermediate,
      finalAmount: plan.final, status: data.status ?? 'IN_PROGRESS', notes: data.notes || null,
      createdById: ctx.actor?.id ?? null,
      ...(data.collectAdvanceNow !== false ? { payments: { create: { type: 'ADVANCE_30', amount: plan.advance, receivedById: ctx.actor?.id ?? null } } } : {}),
    },
    include: { client: { select: { name: true } }, payments: { select: { amount: true } } },
  })
  if (data.collectAdvanceNow !== false) {
    const advancePayment = await prisma.payment.findFirst({ where: { projectId: project.id, type: 'ADVANCE_30', archivedAt: null }, orderBy: { createdAt: 'desc' } })
    if (advancePayment) {
      const settings = await prisma.studioSettings.upsert({ where: { id: 'studio' }, update: {}, create: {} })
      await prisma.receipt.create({ data: { number: await receiptNumber(settings.receiptPrefix), type: advancePayment.type, projectId: project.id, paymentId: advancePayment.id, amount: advancePayment.amount, snapshot: { documentType: 'PAYMENT_RECEIPT', studioName: settings.name, clientName: project.client.name, eventName: project.eventName, totalAmount: project.totalAmount, paidAmount: advancePayment.amount, payment: { type: advancePayment.type, method: advancePayment.method, amount: advancePayment.amount, paymentDate: advancePayment.paymentDate.toISOString(), reference: advancePayment.reference } }, createdById: ctx.actor?.id ?? null } })
    }
  }
  await recordAudit({ actorId: ctx.actor?.id, action: 'project.create', entity: 'Project', entityId: project.id, payload: { clientId: project.clientId, eventName: project.eventName, advanceCollected: data.collectAdvanceNow !== false } })
  sendJson(ctx.res, 201, { project: toProjectSummary(project, true) })
}

export const projectRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/projects', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT')], handler: listProjects },
  { method: 'GET', path: '/api/projects/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT')], handler: getProject },
  { method: 'POST', path: '/api/projects', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(createProjectSchema)], handler: createProject },
]
