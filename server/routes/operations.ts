import type { OperationsOverview, OperationsProjectSummary } from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'

/**
 * Synthèse strictement opérationnelle. Elle est volontairement distincte des
 * projets financiers afin que l'assistant ne reçoive jamais de montants.
 */
const getOperationsOverview = async (ctx: RouteContext): Promise<void> => {
  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    include: {
      client: { select: { name: true } },
      activities: {
        where: { archivedAt: null },
        include: { tasks: { where: { archivedAt: null }, select: { status: true, deliveryDate: true } } },
      },
    },
    orderBy: { globalDeliveryDate: 'asc' },
  })

  const summaries: OperationsProjectSummary[] = projects.map((project) => {
    const tasks = project.activities.flatMap((activity) => activity.tasks)
    const nextTask = [...tasks]
      .filter((task) => task.status !== 'COMPLETED')
      .sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime())[0]

    return {
      id: project.id,
      eventName: project.eventName,
      clientName: project.client.name,
      eventLocation: project.eventLocation,
      eventDate: project.eventDate.toISOString(),
      globalDeliveryDate: project.globalDeliveryDate.toISOString(),
      status: project.status,
      taskCount: tasks.length,
      pendingTaskCount: tasks.filter((task) => task.status === 'PENDING').length,
      reviewTaskCount: tasks.filter((task) => task.status === 'IN_REVIEW').length,
      completedTaskCount: tasks.filter((task) => task.status === 'COMPLETED').length,
      nextTaskDeliveryDate: nextTask?.deliveryDate.toISOString() ?? null,
    }
  })

  const overview: OperationsOverview = {
    projects: summaries,
    totalTaskCount: summaries.reduce((total, project) => total + project.taskCount, 0),
    pendingTaskCount: summaries.reduce((total, project) => total + project.pendingTaskCount, 0),
    reviewTaskCount: summaries.reduce((total, project) => total + project.reviewTaskCount, 0),
    completedTaskCount: summaries.reduce((total, project) => total + project.completedTaskCount, 0),
  }

  sendJson(ctx.res, 200, { overview })
}

export const operationRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/operations/overview', auth: true, middlewares: [requireAuth, requireRole('ADMIN', 'ASSISTANT')], handler: getOperationsOverview },
]
