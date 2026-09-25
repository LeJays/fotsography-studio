import type { Prisma } from '@prisma/client'
import { createClientSchema, updateClientSchema } from '../../shared/schemas/client.ts'
import type {
  ClientDetail,
  ClientProjectSummary,
  ClientSummary,
  CreateClientPayload,
  UpdateClientPayload,
} from '../../shared/types.ts'
import { prisma } from '../db.ts'
import { HttpError, sendJson, sendNoContent } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'
import { recordAudit } from '../services/audit.ts'
const activeClientsWhere = (search?: string): Prisma.ClientWhereInput => {
  const base: Prisma.ClientWhereInput = { archivedAt: null }
  if (!search || !search.trim()) return base
  const query = search.trim()
  return {
    ...base,
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { address: { contains: query, mode: 'insensitive' } },
    ],
  }
}

/** GET /api/clients — liste des clients avec recherche et totaux financiers. */
const listClients = async (ctx: RouteContext): Promise<void> => {
  const search = ctx.url.searchParams.get('search') ?? undefined
  const clients = await prisma.client.findMany({
    where: activeClientsWhere(search),
    include: {
      createdBy: { select: { name: true } },
      projects: {
        where: { archivedAt: null },
        select: {
          id: true,
          totalAmount: true,
          payments: { where: { archivedAt: null }, select: { amount: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const summaries: ClientSummary[] = clients.map((client) => {
    let totalAmount = 0
    let paidAmount = 0
    for (const project of client.projects) {
      totalAmount += project.totalAmount
      for (const payment of project.payments) paidAmount += payment.amount
    }
    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      notes: client.notes,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      createdByName: client.createdBy?.name ?? null,
      projectCount: client.projects.length,
      totalAmount,
      paidAmount,
      remainingAmount: Math.max(0, totalAmount - paidAmount),
    }
  })
  sendJson(ctx.res, 200, { clients: summaries })
}



/** GET /api/clients/:id — fiche détaillée d'un client. */
const getClient = async (ctx: RouteContext): Promise<void> => {
  const { id } = ctx.params
  const client = await prisma.client.findFirst({
    where: { id, archivedAt: null },
    include: {
      createdBy: { select: { name: true } },
      projects: {
        where: { archivedAt: null },
        include: {
          payments: { where: { archivedAt: null }, select: { amount: true } },
        },
        orderBy: { eventDate: 'desc' },
      },
    },
  })

  if (!client) throw new HttpError(404, 'Client introuvable ou archivé.')

  let totalAmount = 0
  let paidAmount = 0
  const projects: ClientProjectSummary[] = client.projects.map((project) => {
    const projectPaid = project.payments.reduce((acc, p) => acc + p.amount, 0)
    totalAmount += project.totalAmount
    paidAmount += projectPaid
    return {
      id: project.id,
      eventName: project.eventName,
      eventLocation: project.eventLocation,
      eventDate: project.eventDate.toISOString(),
      globalDeliveryDate: project.globalDeliveryDate.toISOString(),
      totalAmount: project.totalAmount,
      advanceAmount: project.advanceAmount,
      intermediateAmount: project.intermediateAmount,
      finalAmount: project.finalAmount,
      status: project.status,
      paidAmount: projectPaid,
      remainingAmount: Math.max(0, project.totalAmount - projectPaid),
      createdAt: project.createdAt.toISOString(),
    }
  })

  const detail: ClientDetail = {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    notes: client.notes,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    createdByName: client.createdBy?.name ?? null,
    projectCount: client.projects.length,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    projects,
  }

  sendJson(ctx.res, 200, { client: detail })
}

/** POST /api/clients — création d'un nouveau client. */
const createClient = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<CreateClientPayload>(ctx)
  const actor = ctx.actor

  const created = await prisma.client.create({
    data: {
      name: data.name,
      email: data.email ? data.email : null,
      phone: data.phone,
      address: data.address ? data.address : null,
      notes: data.notes ? data.notes : null,
      createdById: actor?.id ?? null,
    },
    include: { createdBy: { select: { name: true } } },
  })

  await recordAudit({
    actorId: actor?.id,
    action: 'client.create',
    entity: 'Client',
    entityId: created.id,
    payload: { name: created.name, phone: created.phone },
  })

  const summary: ClientSummary = {
    id: created.id,
    name: created.name,
    email: created.email,
    phone: created.phone,
    address: created.address,
    notes: created.notes,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    createdByName: created.createdBy?.name ?? null,
    projectCount: 0,
    totalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
  }

  sendJson(ctx.res, 201, { client: summary })
}

/** PATCH /api/clients/:id — modification des coordonnées. */
const updateClient = async (ctx: RouteContext): Promise<void> => {
  const data = bodyOf<UpdateClientPayload>(ctx)
  const actor = ctx.actor
  const { id } = ctx.params

  const existing = await prisma.client.findFirst({ where: { id, archivedAt: null } })
  if (!existing) throw new HttpError(404, 'Client introuvable.')

  const updated = await prisma.client.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      email: data.email !== undefined ? (data.email ? data.email : null) : undefined,
      phone: data.phone ?? undefined,
      address: data.address !== undefined ? (data.address ? data.address : null) : undefined,
      notes: data.notes !== undefined ? (data.notes ? data.notes : null) : undefined,
    },
    include: {
      createdBy: { select: { name: true } },
      projects: {
        where: { archivedAt: null },
        select: {
          id: true,
          totalAmount: true,
          payments: { where: { archivedAt: null }, select: { amount: true } },
        },
      },
    },
  })

  await recordAudit({
    actorId: actor?.id,
    action: 'client.update',
    entity: 'Client',
    entityId: updated.id,
    payload: data,
  })

  let totalAmount = 0
  let paidAmount = 0
  for (const project of updated.projects) {
    totalAmount += project.totalAmount
    for (const payment of project.payments) paidAmount += payment.amount
  }

  const summary: ClientSummary = {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    address: updated.address,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    createdByName: updated.createdBy?.name ?? null,
    projectCount: updated.projects.length,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
  }

  sendJson(ctx.res, 200, { client: summary })
}

/** DELETE /api/clients/:id — archivage logique. */
const archiveClient = async (ctx: RouteContext): Promise<void> => {
  const actor = ctx.actor
  const { id } = ctx.params

  const existing = await prisma.client.findFirst({ where: { id, archivedAt: null } })
  if (!existing) throw new HttpError(404, 'Client introuvable.')

  await prisma.client.update({
    where: { id },
    data: { archivedAt: new Date() },
  })

  await recordAudit({
    actorId: actor?.id,
    action: 'client.archive',
    entity: 'Client',
    entityId: existing.id,
    payload: { name: existing.name },
  })

  sendNoContent(ctx.res)
}

export const clientRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/clients', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: listClients },
  { method: 'GET', path: '/api/clients/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: getClient },
  { method: 'POST', path: '/api/clients', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(createClientSchema)], handler: createClient },
  { method: 'PATCH', path: '/api/clients/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(updateClientSchema)], handler: updateClient },
  { method: 'DELETE', path: '/api/clients/:id', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: archiveClient },
]

