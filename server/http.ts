import type { IncomingMessage, ServerResponse } from 'node:http'

/** Taille maximale acceptée pour un corps de requête JSON (256 Ko). */
const MAX_BODY_SIZE = 256 * 1024

export class HttpError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length

    if (size > MAX_BODY_SIZE) {
      throw new HttpError(413, 'Requête trop volumineuse.')
    }

    chunks.push(buffer)
  }

  if (chunks.length === 0) {
    throw new HttpError(400, 'Corps de requête manquant.')
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'JSON invalide.')
  }
}

export const sendJson = (
  res: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
): void => {
  const body = JSON.stringify(payload)

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  })
  res.end(body)
}

export const sendNoContent = (res: ServerResponse, headers: Record<string, string> = {}): void => {
  res.writeHead(204, headers)
  res.end()
}

export interface CookieOptions {
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  path?: string
}

const COOKIE_NAME = /^[A-Za-z0-9_-]+$/

export const buildCookie = (name: string, value: string, options: CookieOptions = {}): string => {
  if (!COOKIE_NAME.test(name)) {
    throw new Error(`Nom de cookie invalide : ${name}`)
  }

  const parts = [`${name}=${encodeURIComponent(value)}`]

  parts.push(`Path=${options.path ?? '/'}`)

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  }

  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`)

  return parts.join('; ')
}

export const clearCookie = (name: string, path = '/'): string =>
  `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax`

export const readCookie = (req: IncomingMessage, name: string): string | null => {
  const header = req.headers.cookie

  if (!header) return null

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')

    if (separator === -1) continue

    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim())
    }
  }

  return null
}
