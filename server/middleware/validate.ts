import type { ZodType } from 'zod'
import { HttpError, readJsonBody } from '../http.ts'
import type { Middleware } from '../router.ts'

/** Message lisible pour la première erreur d'un schéma zod. */
export const firstIssueMessage = (error: {
  issues: Array<{ code?: string; message: string }>
}): string => {
  const [issue] = error.issues

  if (!issue) return 'Données invalides.'
  if (issue.code === 'invalid_type') return 'Champs obligatoires manquants ou invalides.'

  return issue.message
}

/** Valide le corps JSON de la requête et l'expose via `ctx.body`. */
export const validateBody = (schema: ZodType): Middleware => async (ctx, next) => {
  const result = schema.safeParse(await readJsonBody(ctx.req))

  if (!result.success) {
    throw new HttpError(422, firstIssueMessage(result.error), result.error.issues)
  }

  ctx.body = result.data
  await next()
}

/** Valide les paramètres de l'URL (`?search=…&page=2`) et les expose via `ctx.body`. */
export const validateQuery = (schema: ZodType): Middleware => async (ctx, next) => {
  const raw: Record<string, string> = {}
  ctx.url.searchParams.forEach((value, key) => {
    raw[key] = value
  })

  const result = schema.safeParse(raw)

  if (!result.success) {
    throw new HttpError(422, firstIssueMessage(result.error), result.error.issues)
  }

  ctx.body = result.data
  await next()
}

/** Récupère le corps validé avec un type sûr. */
export const bodyOf = <T>(ctx: { body: unknown }): T => ctx.body as T
