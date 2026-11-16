import { ErrorResponseSchema, type ErrorResponse } from '@circe/shared'
import type { ZodType } from 'zod'
import { getSiteId } from './site.ts'

/** Famille d'erreur, pour adapter le message et l'action proposée (CLAUDE.md §6). */
export type ApiErrorKind =
  | 'validation' // 400
  | 'non_authentifie' // 401
  | 'interdit' // 403
  | 'introuvable' // 404
  | 'conflit' // 409 : version, transition interdite, idempotence
  | 'regle_metier' // 422 : `regle` porte l'ID de la RG
  | 'serveur' // 5xx
  | 'reseau' // pas de réponse exploitable

export function kindOf(status: number): ApiErrorKind {
  if (status === 400) return 'validation'
  if (status === 401) return 'non_authentifie'
  if (status === 403) return 'interdit'
  if (status === 404) return 'introuvable'
  if (status === 409) return 'conflit'
  if (status === 422) return 'regle_metier'
  if (status >= 500) return 'serveur'
  return 'reseau'
}

/** Erreur d'API normalisée { code, message, details?, regle? } + statut HTTP. */
export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  readonly body: ErrorResponse

  constructor(status: number, body: ErrorResponse) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kindOf(status)
    this.body = body
  }
}

type UnauthorizedHandler = (error: ApiError) => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Point d'accroche global pour les 401 (ex. renvoi vers la connexion quand Q-001 sera tranchée). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

async function toApiError(response: Response): Promise<ApiError> {
  const parsed = ErrorResponseSchema.safeParse(await response.json().catch(() => null))
  return new ApiError(
    response.status,
    parsed.success
      ? parsed.data
      : { code: 'ERREUR_RESEAU', message: `Erreur HTTP ${response.status}` },
  )
}

export interface RequestOptions<T> {
  schema: ZodType<T>
  body?: unknown
  /** Site choisi dans le bandeau (RG-REC-001), revérifié par le serveur. */
  siteId?: number | null
  /**
   * RG-REC-008 : clé d'idempotence des POST de création / transition. `true` = clé générée pour cet
   * appel ; passer une chaîne pour réutiliser la même clé lors d'un nouvel essai.
   */
  idempotencyKey?: string | true
  signal?: AbortSignal
}

/** Appel typé : la réponse est validée par le schéma Zod partagé ; toute erreur devient ApiError. */
export async function apiRequest<T>(
  method: string,
  path: string,
  options: RequestOptions<T>,
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  // EX-TRA-006 : le site du bandeau accompagne tous les appels (sauf si l'appelant en impose un).
  const siteId = options.siteId === undefined ? getSiteId() : options.siteId
  if (siteId != null) headers['x-site-id'] = String(siteId)
  if (options.idempotencyKey !== undefined) {
    headers['idempotency-key'] =
      options.idempotencyKey === true ? crypto.randomUUID() : options.idempotencyKey
  }
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch {
    throw new ApiError(0, { code: 'ERREUR_RESEAU', message: 'Le serveur est injoignable' })
  }
  if (!response.ok) {
    const error = await toApiError(response)
    if (error.kind === 'non_authentifie') onUnauthorized?.(error)
    throw error
  }
  const parsed = options.schema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) {
    throw new ApiError(response.status, {
      code: 'REPONSE_INVALIDE',
      message: 'Réponse du serveur inattendue',
    })
  }
  return parsed.data
}

/** GET typé. Le contrat de /api/health renvoie son corps typé aussi en 503 : il est accepté. */
export async function apiGet<T>(
  path: string,
  schema: ZodType<T>,
  init?: { signal?: AbortSignal },
): Promise<T> {
  const siteId = getSiteId()
  const response = await fetch(path, {
    headers: {
      accept: 'application/json',
      ...(siteId === null ? {} : { 'x-site-id': String(siteId) }),
    },
    signal: init?.signal,
  })
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null)
  const parsed = schema.safeParse(body)
  if (parsed.success) return parsed.data
  const error = await toApiError(response)
  if (error.kind === 'non_authentifie') onUnauthorized?.(error)
  throw error
}

export const apiPost = <T>(path: string, options: RequestOptions<T>) =>
  apiRequest('POST', path, { idempotencyKey: true, ...options })
export const apiPatch = <T>(path: string, options: RequestOptions<T>) =>
  apiRequest('PATCH', path, options)
