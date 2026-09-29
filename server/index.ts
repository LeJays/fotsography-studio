import 'dotenv/config'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
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


/**
 * Port d'écoute : les hébergeurs cloud (Render, Fly…) injectent `PORT`,
 * `API_PORT` reste prioritaire en local, 3001 en dernier recours.
 */
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)

/** Dossier du front compilé (`npm run build`), servi hors `/api` en production. */
const distDir = fileURLToPath(new URL('../dist', import.meta.url))

/** Content-Type minimal pour les assets générés par Vite. */
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/**
 * Sert le front `dist/` (SPA) : fichier statique s'il existe, sinon repli sur
 * `index.html` pour que les routes react-router fonctionnent au rafraîchissement.
 * Seules les requêtes GET/HEAD sont acceptées ; toute requête hors `dist/` (« ../ »)
 * est rejetée sur le repli.
 */
const serveStatic = (req: IncomingMessage, res: ServerResponse, url: URL): void => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Méthode non autorisée pour les fichiers statiques.' })
    return
  }

  if (!existsSync(distDir)) {
    sendJson(res, 404, { error: 'Front non compilé : exécutez `npm run build` (dossier dist/ introuvable).' })
    return
  }

  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    pathname = '/'
  }

  const candidate = normalize(join(distDir, pathname))
  const insideDist = candidate === distDir || candidate.startsWith(distDir + sep)
  const filePath = insideDist && existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : join(distDir, 'index.html')

  res.setHeader('Content-Type', contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
  if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!res.writableEnded) sendJson(res, 500, { error: 'Lecture du fichier impossible.' })
  })
  stream.pipe(res)
}

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

  // `/api/*` → routeur API ; tout le reste → front compilé (production).
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    void router(req, res, url).catch((error: unknown) => sendError(res, error))
    return
  }

  try {
    serveStatic(req, res, url)
  } catch (error: unknown) {
    sendError(res, error)
  }
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
