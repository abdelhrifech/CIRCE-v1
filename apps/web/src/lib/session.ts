import { MeResponseSchema, type MeResponse, type PermissionCode } from '@circe/shared'
import { redirect } from '@tanstack/react-router'
import { ApiError, apiRequest } from './api-client.ts'
import { getSiteId, setSiteId } from './site.ts'

let current: Promise<MeResponse> | null = null

/** Identité et permissions de l'utilisateur, chargées une fois (GET /api/me). */
export function getMe(): Promise<MeResponse> {
  current ??= apiRequest('GET', '/api/me', { schema: MeResponseSchema })
    .catch((error: unknown) => {
      // Site mémorisé hors du périmètre (changement de profil) : retour à « Tous les sites », un seul nouvel essai.
      if (error instanceof ApiError && error.status === 403 && getSiteId() !== null) {
        setSiteId(null)
        return apiRequest('GET', '/api/me', { schema: MeResponseSchema })
      }
      throw error
    })
    .catch((error: unknown) => {
      current = null
      throw error
    })
  return current
}

export function resetMe(): void {
  current = null
}

/** Confort d'affichage seulement : le serveur reste juge (RG-REC-002). */
export function can(
  me: Pick<MeResponse, 'permissions'> | null | undefined,
  code: PermissionCode,
): boolean {
  return me?.permissions.includes(code) ?? false
}

export type MotifRefus = 'interdit' | 'non_authentifie' | 'erreur'

/** Décision de la garde : null = accès autorisé, sinon motif du refus. Testable sans routeur. */
export async function verifierPermission(
  code: PermissionCode,
  chargerMe: () => Promise<MeResponse> = getMe,
): Promise<MotifRefus | null> {
  try {
    return can(await chargerMe(), code) ? null : 'interdit'
  } catch (error) {
    return error instanceof ApiError && error.kind === 'non_authentifie'
      ? 'non_authentifie'
      : 'erreur'
  }
}

/**
 * Garde de route (beforeLoad) : redirige vers /acces-refuse si la permission manque ou si l'utilisateur
 * n'est pas identifié. Confort d'affichage seulement : le serveur reste juge (RG-REC-002). Côté serveur
 * (SSR) la garde ne fait rien : l'identité de dev n'existe que dans les appels /api.
 */
export function requirePermission(code: PermissionCode) {
  return async () => {
    if (import.meta.env.SSR) return
    const motif = await verifierPermission(code)
    if (motif) redirect({ to: '/acces-refuse', search: { permission: code, motif }, throw: true })
  }
}
