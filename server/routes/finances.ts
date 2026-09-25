import type { FinanceOverview } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'

const listFinances = async (ctx: RouteContext): Promise<void> => {
  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    include: {
      client: { select: { name: true } },
      payments: { where: { archivedAt: null }, select: { amount: true } },
      activities: { where: { archivedAt: null }, include: { expenses: { where: { archivedAt: null }, select: { amount: true } }, tasks: { where: { archivedAt: null }, include: { assignedUser: { select: { id: true, name: true } } } } } },
    },
    orderBy: { eventDate: 'desc' },
  })
  const memberMap = new Map<string, { id: string; name: string; payout: number; taskCount: number }>()
  const rows = projects.map((project) => {
    const paidAmount = project.payments.reduce((total, item) => total + item.amount, 0)
    let expenseAmount = 0
    let memberPayout = 0
    for (const activity of project.activities) {
      expenseAmount += activity.expenses.reduce((total, item) => total + item.amount, 0)
      for (const task of activity.tasks) {
        const payout = task.payoutPaidAt ? task.memberPayout ?? 0 : 0
        memberPayout += payout
        const member = memberMap.get(task.assignedUser.id) ?? { id: task.assignedUser.id, name: task.assignedUser.name, payout: 0, taskCount: 0 }
        member.payout += payout; member.taskCount += 1; memberMap.set(member.id, member)
      }
    }
    return { id: project.id, eventName: project.eventName, clientName: project.client.name, totalAmount: project.totalAmount, paidAmount, remainingAmount: Math.max(0, project.totalAmount - paidAmount), expenseAmount, memberPayout, margin: paidAmount - expenseAmount - memberPayout }
  })
  const overview: FinanceOverview = { totalRevenue: rows.reduce((t, r) => t + r.totalAmount, 0), collected: rows.reduce((t, r) => t + r.paidAmount, 0), remaining: rows.reduce((t, r) => t + r.remainingAmount, 0), expenses: rows.reduce((t, r) => t + r.expenseAmount, 0), memberPayouts: rows.reduce((t, r) => t + r.memberPayout, 0), netMargin: rows.reduce((t, r) => t + r.margin, 0), projects: rows, members: [...memberMap.values()].sort((a, b) => b.payout - a.payout) }
  sendJson(ctx.res, 200, { overview })
}
export const financeRoutes: RouteDefinition[] = [{ method: 'GET', path: '/api/finances', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: listFinances }]
