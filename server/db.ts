import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

/**
 * Client Prisma côté serveur uniquement (Neon / PostgreSQL).
 * Ne jamais importer ce fichier depuis du code React : la chaîne de connexion
 * resterait exposée dans le navigateur.
 */
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL est introuvable. Ajoutez la chaîne de connexion Neon dans le fichier .env (voir README).",
  )
}

// Neon (pooler) coupe les connexions inactives : on borne les timeouts pour
// éviter les erreurs "Connection terminated unexpectedly".
const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
})

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect()
  await pool.end()
}
