import 'dotenv/config'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { disconnectDatabase, prisma } from './db.ts'
import { HttpError, sendJson } from './http.ts'
import { loadActor } from './middleware/auth.ts'
import { createRouter, type RouteDefinition } from './router.ts'
import { authRoutes } from './routes/auth.ts'
import { userRoutes } from './routes/users.ts'
import { clientRoutes } from './routes/clients.ts'
import { projectRoutes } from './routes/projects.ts'
import { activityRoutes } from './routes/activities.ts'
import { taskRoutes } from './routes/tasks.ts'
import { expenseRoutes } from './routes/expenses.ts'
import { paymentRoutes } from './routes/payments.ts'
import { financeRoutes } from './routes/finances.ts'
import { operationRoutes } from './routes/operations.ts'
import { settingsRoutes } from './routes/settings.ts'


const port = Number(process.env.API_PORT ?? 3001)

/** GET /api/health — vérifie la connexion Neon. */
const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/api/health',
    handler: async (ctx) => {
      await prisma.$queryRaw`SELECT 1`
      sendJson(ctx.res, 200, { ok: true, database: 'neon', timestamp: new Date().toISOString() })
    },
  },
  ...authRoutes,
  ...userRoutes,
  ...clientRoutes,
  ...projectRoutes,
  ...activityRoutes,
  ...taskRoutes,
  ...expenseRoutes,
  ...paymentRoutes,
  ...financeRoutes,
  ...operationRoutes,
  ...settingsRoutes,
]

const router = createRouter(routes, loadActor)

const sendError = (res: ServerResponse, error: unknown): void => {
  if (res.writableEnded) return

  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.message, details: error.details })
    return
  }

  console.error('[api] erreur inattendue :', error)
  sendJson(res, 500, {
    error: 'Erreur serveur. Vérifiez la connexion Neon (DATABASE_URL) et les logs du terminal.',
  })
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${port}`}`)

  void router(req, res, url).catch((error: unknown) => sendError(res, error))
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[api] le port ${port} est déjà utilisé par un autre processus.`)
    console.error('[api] arrêtez l\'autre instance ou lancez avec API_PORT=3002.')
    process.exit(1)
  }

  console.error('[api] erreur du serveur :', error)
  process.exit(1)
})

server.listen(port, () => {
  const databaseHost = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).host
    : 'DATABASE_URL manquant'

  console.log(`[api] API prête sur http://localhost:${port} (${routes.length} routes)`)
  console.log(`[api] base de données : ${databaseHost}`)
})

const shutdown = async (): Promise<void> => {
  await disconnectDatabase().catch(() => undefined)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
