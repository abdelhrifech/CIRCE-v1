import type { FastifyInstance, FastifyRequest } from 'fastify'
import { RoleSchema, type Role } from '@circe/shared'
import { DEV_IDENTITY_HEADER, readDevIdentity } from '@circe/shared/dev-identity'
import type { Config } from './config.ts'
import type { Db } from './db.ts'
import { ForbiddenError, UnauthorizedError, ValidationError } from './errors.ts'

export { DEV_IDENTITY_HEADER }
export const SITE_HEADER = 'x-site-id'

export interface LignePerimetre {
  plateformeId: number
  /** null = tous les ateliers de la plateforme. */
  atelierId: number | null
}

/** Contexte d'identité d'une requête (userId, profils, périmètre, site choisi). */
export interface Identity {
  userId: number
  identifiantExterne: string
  nom: string | null
  roles: Role[]
  perimetre: {
    /** RG-COO-167 : l'administrateur voit tous les sites. */
    toutesPlateformes: boolean
    plateformeIds: number[]
    lignes: LignePerimetre[]
  }
  /** Site choisi dans le bandeau (en-tête x-site-id), vérifié dans le périmètre (RG-REC-001). */
  siteId: number | null
}

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity | null
  }
}

/** Charge l'utilisateur actif, ses rôles et son périmètre. null si inconnu ou inactif. */
export type IdentityLoader = (
  identifiantExterne: string,
) => Promise<Omit<Identity, 'siteId'> | null>

export function dbIdentityLoader(db: Db): IdentityLoader {
  return async (identifiantExterne) => {
    const user = await db.utilisateur.findUnique({
      where: { identifiantExterne },
      include: { roles: { include: { role: true } }, perimetres: true },
    })
    if (!user?.actif) return null
    const roles = user.roles
      .map((r) => RoleSchema.safeParse(r.role.code))
      .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    const lignes = user.perimetres.map((p) => ({
      plateformeId: p.plateformeId,
      atelierId: p.atelierId,
    }))
    return {
      userId: user.id,
      identifiantExterne: user.identifiantExterne,
      nom: user.nom,
      roles,
      perimetre: {
        toutesPlateformes: roles.includes('admin'),
        plateformeIds: [...new Set(lignes.map((l) => l.plateformeId))],
        lignes,
      },
    }
  }
}

function parseSiteId(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return null
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isInteger(value) || value <= 0)
    throw new ValidationError('En-tête x-site-id invalide', { code: 'SITE_INVALIDE' })
  return value
}

/**
 * Résout l'identité de chaque requête (request.identity). Sans en-tête : requête anonyme (null) ;
 * c'est le service qui exige l'identité (requireIdentity) et les permissions.
 * HYPOTHÈSE (Q-001) : seul le fournisseur de dev existe (en-tête signé HMAC), refusé en production
 * par loadConfig. L'en-tête ne porte que l'identifiant : rôles et périmètre sont relus en base.
 */
export function resolveIdentity(
  app: FastifyInstance,
  config: Config,
  loader: IdentityLoader,
): void {
  app.decorateRequest('identity', null)
  app.addHook('onRequest', async (request) => {
    const header = request.headers[DEV_IDENTITY_HEADER]
    if (header === undefined) return
    const secret = config.DEV_IDENTITY_SECRET
    if (typeof header !== 'string' || !secret) throw new UnauthorizedError('Identité mal formée')
    const payload = readDevIdentity(header, secret)
    if (!payload) throw new UnauthorizedError('Signature d’identité invalide')
    const loaded = await loader(payload.sub)
    if (!loaded) throw new UnauthorizedError('Utilisateur inconnu ou inactif')
    const siteId = parseSiteId(request.headers[SITE_HEADER])
    if (
      siteId !== null &&
      !loaded.perimetre.toutesPlateformes &&
      !loaded.perimetre.plateformeIds.includes(siteId)
    ) {
      throw new ForbiddenError("Cette plateforme n'est pas dans votre périmètre.", {
        code: 'REC_PERIMETRE_INTERDIT',
        regle: 'RG-REC-001',
        details: { plateformeId: siteId },
      })
    }
    request.identity = { ...loaded, siteId }
  })
}

/**
 * RG-COO-167 / Q-173 : le site choisi dans le bandeau (en-tête x-site-id) vaut pour toute l'application : le
 * périmètre de l'utilisateur est restreint à ce site (lignes de périmètre du site, ou le site entier pour
 * l'administrateur). Sans site choisi, l'identité est inchangée. Le site est déjà vérifié dans le périmètre par
 * resolveIdentity.
 */
export function identiteDuSite(identity: Identity): Identity {
  const { siteId } = identity
  if (siteId === null) return identity
  const lignes = identity.perimetre.toutesPlateformes
    ? [{ plateformeId: siteId, atelierId: null }]
    : identity.perimetre.lignes.filter((l) => l.plateformeId === siteId)
  return {
    ...identity,
    perimetre: { toutesPlateformes: false, plateformeIds: [siteId], lignes },
  }
}

/** RG-REC-004 : toute écriture exige un utilisateur authentifié ; 401 sinon. */
export function requireIdentity(request: FastifyRequest): Identity {
  if (!request.identity) throw new UnauthorizedError()
  return request.identity
}
