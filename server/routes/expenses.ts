import { createExpenseSchema, updateExpenseSchema } from '../../shared/schemas/expense.ts'
import type { CreateExpensePayload, ExpenseSummary, UpdateExpensePayload } from '../../shared/types.ts'
import { fromDateInputValue } from '../../shared/dates.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson, sendNoContent } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'

const expenseInclude = { createdBy: { select: { name: true } } } as const

const toExpense = (expense: {
  id: string; activityId: string; description: string; supplier: string | null; amount: number; expenseDate: Date
  createdBy: { name: string } | null
}): ExpenseSummary => ({
  id: expense.id,
  activityId: expense.activityId,
  description: expense.description,
  supplier: expense.supplier,
  amount: expense.amount,
  expenseDate: expense.expenseDate.toISOString(),
  createdByName: expense.createdBy?.name ?? null,
})

const listExpenses = async (ctx: RouteContext): Promise<void> => {
  const activityId = ctx.url.searchParams.get('activityId')
  if (!activityId) throw new HttpError(422, 'L’activité concernée est requise.')

  const expenses = await prisma.expense.findMany({
    where: { activityId, archivedAt: null },
    include: expenseInclude,
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
  })
  sendJson(ctx.res, 200, { expenses: expenses.map(toExpense) })
}

const createExpense = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<CreateExpensePayload>(ctx)
  const activity = await prisma.activity.findFirst({ where: { id: data.activityId, archivedAt: null } })
  if (!activity) throw new HttpError(404, 'Activité introuvable.')

  const expense = await prisma.expense.create({
    data: {
      activityId: activity.id,
      description: data.description,
      supplier: data.supplier || null,
      amount: data.amount,
      expenseDate: fromDateInputValue(data.expenseDate),
      createdById: ctx.actor?.id ?? null,
    },
    include: expenseInclude,
  })
  await recordAudit({ actorId: ctx.actor?.id, action: 'expense.create', entity: 'Expense', entityId: expense.id, payload: { activityId: activity.id, amount: expense.amount } })
  sendJson(ctx.res, 201, { expense: toExpense(expense) })
}

const updateExpense = async (ctx: RouteContext): Promise<void> => {
  const existing = await prisma.expense.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!existing) throw new HttpError(404, 'Dépense introuvable.')
  const data = bodyOf<UpdateExpensePayload>(ctx)
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      description: data.description ?? undefined,
      supplier: data.supplier === undefined ? undefined : data.supplier || null,
      amount: data.amount ?? undefined,
      expenseDate: data.expenseDate ? fromDateInputValue(data.expenseDate) : undefined,
    },
    include: expenseInclude,
  })
  await recordAudit({ actorId: ctx.actor?.id, action: 'expense.update', entity: 'Expense', entityId: expense.id, payload: data })
  sendJson(ctx.res, 200, { expense: toExpense(expense) })
}

const archiveExpense = async (ctx: RouteContext): Promise<void> => {
  const expense = await prisma.expense.findFirst({ where: { id: ctx.params.id, archivedAt: null } })
  if (!expense) throw new HttpError(404, 'Dépense introuvable.')
  await prisma.expense.update({ where: { id: expense.id }, data: { archivedAt: new Date() } })
  await recordAudit({ actorId: ctx.actor?.id, action: 'expense.archive', entity: 'Expense', entityId: expense.id })
  sendNoContent(ctx.res)
}

export const expenseRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/expenses', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: listExpenses },
  { method: 'POST', path: '/api/expenses', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(createExpenseSchema)], handler: createExpense },
  { method: 'PATCH', path: '/api/expenses/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(updateExpenseSchema)], handler: updateExpense },
  { method: 'DELETE', path: '/api/expenses/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: archiveExpense },
]
