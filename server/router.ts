import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AuthUser } from '../shared/types.ts'
import { HttpError, sendJson } from './http.ts'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** Contexte transmis à chaque middleware et handler. */
export interface RouteContext {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  params: Record<string, string>
  body: unknown
  /** Renseigné lorsque la route déclare `auth: true`. */
  actor: AuthUser | null
}

export type Handler = (ctx: RouteContext) => Promise<void> | void

export type Middleware = (ctx: RouteContext, next: () => Promise<void>) => Promise<void>

export interface RouteDefinition {
  method: HttpMethod
  /** `/api/clients/:id` → `ctx.params.id` */
  path: string
  /** Charge l'utilisateur de la session (cookie) avant les middlewares. */
  auth?: boolean
  middlewares?: Middleware[]
  handler: Handler
}

export type ActorLoader = (req: IncomingMessage) => Promise<AuthUser | null>

const splitPath = (path: string): string[] => path.split('/').filter(Boolean)

const matchPath = (
  routeParts: string[],
  pathParts: string[],
): Record<string, string> | null => {
  if (routeParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}

  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index]
    const pathPart = pathParts[index]

    if (routePart.startsWith(':')) {
      if (!pathPart) return null
      params[routePart.slice(1)] = decodeURIComponent(pathPart)
      continue
    }

    if (routePart !== pathPart) return null
  }

  return params
}

const runChain = async (route: RouteDefinition, ctx: RouteContext): Promise<void> => {
  const chain = route.middlewares ?? []
  let index = -1

  const next = async (): Promise<void> => {
    index += 1
    const middleware = chain[index]

    if (!middleware) {
      await route.handler(ctx)
      return
    }

    await middleware(ctx, next)
  }

  await next()

  // Aucun handler n'a répondu : on évite une requête pendante.
  if (!ctx.res.writableEnded) {
    sendJson(ctx.res, 204, {})
  }
}

export const createRouter = (routes: RouteDefinition[], loadActor?: ActorLoader) => {
  const compiled = routes.map((route) => ({
    route,
    parts: splitPath(route.path),
  }))

  return async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> => {
    const requestParts = splitPath(url.pathname)

    const matches = compiled.filter(({ parts }) => matchPath(parts, requestParts) !== null)

    if (matches.length === 0) {
      sendJson(res, 404, { error: `Route introuvable : ${req.method} ${url.pathname}` })
      return
    }

    const match = matches.find(({ route }) => route.method === req.method)

    if (!match) {
      const allowed = [...new Set(matches.map(({ route }) => route.method))].join(', ')
      sendJson(res, 405, { error: `Méthode non autorisée. Méthodes acceptées : ${allowed}` })
      return
    }

    const ctx: RouteContext = {
      req,
      res,
      url,
      params: matchPath(match.parts, requestParts) ?? {},
      body: undefined,
      actor: null,
    }

    if (match.route.auth && loadActor) {
      ctx.actor = await loadActor(req)
    }

    await runChain(match.route, ctx)
  }
}

export { HttpError }
