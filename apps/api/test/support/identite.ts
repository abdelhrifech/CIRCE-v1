import { DEV_IDENTITY_HEADER, signDevIdentity } from '@circe/shared/dev-identity'

/** En-têtes d'une requête authentifiée par le fournisseur de dev (Q-001). */
export function devHeaders(identifiantExterne: string, siteId?: number): Record<string, string> {
  const secret = process.env['DEV_IDENTITY_SECRET'] ?? ''
  const headers: Record<string, string> = {
    [DEV_IDENTITY_HEADER]: signDevIdentity({ sub: identifiantExterne }, secret),
  }
  if (siteId !== undefined) headers['x-site-id'] = String(siteId)
  return headers
}
