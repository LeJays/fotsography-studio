import { createPaymentSchema } from '../../shared/schemas/payment.ts'
import type { CreatePaymentPayload, PaymentSummary, PaymentType } from '../../shared/types.ts'
import { fromDateInputValue } from '../../shared/dates.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'

const receiptNumber = async (prefix: string): Promise<string> => {
  const count = await prisma.receipt.count()
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
}

const toPayment = (payment: { id: string; type: PaymentType; method: 'CASH' | 'MOMO' | 'BANK'; amount: number; paymentDate: Date; reference: string | null; notes: string | null; receivedBy: { name: string } | null }): PaymentSummary => ({
  id: payment.id, type: payment.type, method: payment.method, amount: payment.amount,
  paymentDate: payment.paymentDate.toISOString(), reference: payment.reference, notes: payment.notes,
  receivedByName: payment.receivedBy?.name ?? null,
})

const milestoneAmount = (type: PaymentType, project: { advanceAmount: number; intermediateAmount: number; finalAmount: number }, requested: number | undefined): number => {
  if (type === 'ADVANCE_30') return project.advanceAmount
  if (type === 'INTERMEDIATE_50') return project.intermediateAmount
  if (type === 'FINAL_20') return project.finalAmount
  return requested ?? 0
}

const createPayment = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<CreatePaymentPayload>(ctx)
  const project = await prisma.project.findFirst({
    where: { id: ctx.params.projectId, archivedAt: null },
    include: { client: { select: { name: true } }, payments: { where: { archivedAt: null }, select: { type: true, amount: true } } },
  })
  if (!project) throw new HttpError(404, 'Projet introuvable.')
  if (project.status === 'CANCELLED') throw new HttpError(400, 'Impossible d’enregistrer un paiement sur un projet annulé.')

  if (data.type !== 'CUSTOM' && project.payments.some((payment) => payment.type === data.type)) {
    throw new HttpError(409, 'Ce jalon de paiement est déjà enregistré pour ce projet.')
  }

  const amount = milestoneAmount(data.type, project, data.amount)
  const paidAmount = project.payments.reduce((total, payment) => total + payment.amount, 0)
  if (amount <= 0 || paidAmount + amount > project.totalAmount) {
    throw new HttpError(400, 'Le paiement dépasse le solde restant à percevoir.')
  }

  const payment = await prisma.payment.create({
    data: { projectId: project.id, type: data.type, method: data.method, amount, paymentDate: fromDateInputValue(data.paymentDate), reference: data.reference || null, notes: data.notes || null, receivedById: ctx.actor?.id ?? null },
    include: { receivedBy: { select: { name: true } } },
  })
  const settings = await prisma.studioSettings.upsert({ where: { id: 'studio' }, update: {}, create: {} })
  const receipt = await prisma.receipt.create({
    data: {
      number: await receiptNumber(settings.receiptPrefix), type: payment.type, projectId: project.id, paymentId: payment.id, amount,
      snapshot: { documentType: 'PAYMENT_RECEIPT', studioName: settings.name, clientName: project.client.name, eventName: project.eventName, totalAmount: project.totalAmount, paidAmount: paidAmount + amount, payment: { type: payment.type, method: payment.method, amount, paymentDate: payment.paymentDate.toISOString(), reference: payment.reference } },
      createdById: ctx.actor?.id ?? null,
    },
  })
  const finalReceipt = paidAmount + amount === project.totalAmount
    ? await prisma.receipt.create({ data: { number: await receiptNumber(settings.receiptPrefix), type: 'FINAL_20', projectId: project.id, amount: project.totalAmount, snapshot: { documentType: 'FINAL_INVOICE', studioName: settings.name, clientName: project.client.name, eventName: project.eventName, totalAmount: project.totalAmount, paidAmount: paidAmount + amount }, createdById: ctx.actor?.id ?? null } })
    : null
  await recordAudit({ actorId: ctx.actor?.id, action: 'payment.create', entity: 'Payment', entityId: payment.id, payload: { projectId: project.id, type: payment.type, amount } })
  sendJson(ctx.res, 201, { payment: toPayment(payment), receipt: { id: receipt.id, number: receipt.number }, finalReceipt: finalReceipt ? { id: finalReceipt.id, number: finalReceipt.number } : null })
}

export const paymentRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/projects/:projectId/payments', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(createPaymentSchema)], handler: createPayment },
]
