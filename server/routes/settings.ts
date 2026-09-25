import { z } from 'zod'
import { prisma } from '../db.ts'
import { sendJson } from '../http.ts'
import { requireAuth, requireRole } from '../middleware/auth.ts'
import { bodyOf, validateBody } from '../middleware/validate.ts'
import type { RouteContext, RouteDefinition } from '../router.ts'

const schema = z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().max(300).optional(), phone: z.string().trim().max(50).optional(), email: z.string().trim().email().optional().or(z.literal('')), registrationNumber: z.string().trim().max(100).optional(), currency: z.string().trim().min(2).max(12), receiptPrefix: z.string().trim().min(2).max(20), defaultPercentAdvance: z.coerce.number().int().min(0).max(100), defaultPercentIntermediate: z.coerce.number().int().min(0).max(100), defaultPercentFinal: z.coerce.number().int().min(0).max(100), taskDeliveryLeadDays: z.coerce.number().int().min(0).max(365) }).refine((d) => d.defaultPercentAdvance + d.defaultPercentIntermediate + d.defaultPercentFinal === 100, { message: 'Les pourcentages doivent totaliser 100 %.' })
const get = async (ctx: RouteContext) => { const settings = await prisma.studioSettings.upsert({ where: { id: 'studio' }, update: {}, create: {} }); sendJson(ctx.res, 200, { settings }) }
const update = async (ctx: RouteContext) => { const data = bodyOf<z.infer<typeof schema>>(ctx); const settings = await prisma.studioSettings.upsert({ where: { id: 'studio' }, update: { ...data, address: data.address || null, phone: data.phone || null, email: data.email || null, registrationNumber: data.registrationNumber || null }, create: { id: 'studio', ...data, address: data.address || null, phone: data.phone || null, email: data.email || null, registrationNumber: data.registrationNumber || null } }); sendJson(ctx.res, 200, { settings }) }
export const settingsRoutes: RouteDefinition[] = [{ method: 'GET', path: '/api/settings', auth: true, middlewares: [requireAuth, requireRole('ADMIN')], handler: get }, { method: 'PATCH', path: '/api/settings', auth: true, middlewares: [requireAuth, requireRole('ADMIN'), validateBody(schema)], handler: update }]
