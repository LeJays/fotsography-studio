import { prisma } from '../db.ts'

interface AuditEntry {
  actorId?: string | null
  action: string
  entity: string
  entityId?: string | null
  payload?: unknown
}

/**
 * Journal d'audit (traçabilité des opérations sensibles : paiements, rôles, comptes).
 * Ne fait jamais échouer la requête appelante.
 */
export const recordAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        payload: entry.payload === undefined ? undefined : (entry.payload as object),
      },
    })
  } catch (error) {
    console.error("[audit] impossible d'enregistrer l'entrée :", error)
  }
}
