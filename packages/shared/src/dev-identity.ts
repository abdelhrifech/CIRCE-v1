// Fournisseur d'identité de DEV (Q-001 non tranchée) : en-tête `<base64url(json)>.<hmac-sha256 hex>`.
// Export séparé (@circe/shared/dev-identity) : utilise node:crypto, jamais embarqué côté navigateur.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const DEV_IDENTITY_HEADER = 'x-dev-identity'

export interface DevIdentityPayload {
  /** Identifiant externe de l'utilisateur (Utilisateur.identifiantExterne). */
  sub: string
}

function hmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function signDevIdentity(payload: DevIdentityPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${hmac(encoded, secret)}`
}

/** Renvoie le payload si la signature est valide, sinon null. */
export function readDevIdentity(header: string, secret: string): DevIdentityPayload | null {
  const [encoded, signature, ...rest] = header.split('.')
  if (!encoded || !signature || rest.length > 0) return null
  const expected = Buffer.from(hmac(encoded, secret), 'hex')
  const received = Buffer.from(signature, 'hex')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const json: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (
      typeof json === 'object' &&
      json !== null &&
      'sub' in json &&
      typeof json.sub === 'string' &&
      json.sub
    ) {
      return { sub: json.sub }
    }
  } catch {
    return null
  }
  return null
}
