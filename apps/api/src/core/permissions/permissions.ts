import { PERMISSION_CODES, type PermissionCode, type Role } from '@circe/shared'
import { ForbiddenError } from '../errors.ts'
import type { Identity } from '../identity.ts'
import { CATALOGUE_PERMISSIONS } from './catalogue.ts'

// Q-421 — HYPOTHÈSE PRISE (consigne de l'utilisateur du 2026-11-06) : le rôle `admin` a TOUS les droits
// (super-utilisateur), y compris ceux que la matrice des RG réserve à d'autres profils. Le périmètre
// site/atelier (RG-REC-001, RG-COO-167) et les règles d'état restent appliqués.
function estSuperAdmin(roles: readonly Role[]): boolean {
  return roles.includes('admin')
}

/** Permissions accordées à un ensemble de rôles (union). */
export function permissionsOf(roles: readonly Role[]): PermissionCode[] {
  if (estSuperAdmin(roles)) return [...PERMISSION_CODES]
  return PERMISSION_CODES.filter((code) =>
    CATALOGUE_PERMISSIONS[code].roles.some((role) => roles.includes(role)),
  )
}

export function hasPermission(identity: Pick<Identity, 'roles'>, code: PermissionCode): boolean {
  if (estSuperAdmin(identity.roles)) return true
  return CATALOGUE_PERMISSIONS[code].roles.some((role) => identity.roles.includes(role))
}

interface DenyOptions {
  /** Code d'erreur du module (ex. REC_ACCES_REFUSE, PERMISSION). */
  code?: string
  /** RG à citer dans l'erreur 403 (ex. RG-REC-003, RG-COO-009). */
  regle?: string
  message?: string
}

/** RG-REC-002 / RG-COO-165 : contrôle du droit DANS le service ; 403 sinon. */
export function assertPermission(
  identity: Identity,
  code: PermissionCode,
  options: DenyOptions = {},
): void {
  if (hasPermission(identity, code)) return
  throw new ForbiddenError(
    options.message ?? "Vous n'avez pas le droit d'effectuer cette action.",
    {
      code: options.code ?? 'PERMISSION',
      regle: options.regle ?? 'RG-REC-002',
      details: { permission: code },
    },
  )
}

/** RG-REC-001 / RG-COO-167 : la plateforme transmise par le client est revérifiée côté serveur. */
export function canAccessPlateforme(identity: Identity, plateformeId: number): boolean {
  return (
    identity.perimetre.toutesPlateformes || identity.perimetre.plateformeIds.includes(plateformeId)
  )
}

export function assertPlateforme(
  identity: Identity,
  plateformeId: number,
  options: DenyOptions = {},
): void {
  if (canAccessPlateforme(identity, plateformeId)) return
  throw new ForbiddenError(options.message ?? "Cette plateforme n'est pas dans votre périmètre.", {
    code: options.code ?? 'REC_PERIMETRE_INTERDIT',
    regle: options.regle ?? 'RG-REC-001',
    details: { plateformeId },
  })
}

/** RG-COO-167 : périmètre atelier (une ligne de périmètre sans atelier couvre tous les ateliers du site). */
export function canAccessAtelier(
  identity: Identity,
  plateformeId: number,
  atelierId: number,
): boolean {
  if (identity.perimetre.toutesPlateformes) return true
  return identity.perimetre.lignes.some(
    (l) => l.plateformeId === plateformeId && (l.atelierId === null || l.atelierId === atelierId),
  )
}

export function assertAtelier(
  identity: Identity,
  plateformeId: number,
  atelierId: number,
  options: DenyOptions = {},
): void {
  if (canAccessAtelier(identity, plateformeId, atelierId)) return
  throw new ForbiddenError(options.message ?? "Cet atelier n'est pas dans votre périmètre.", {
    code: options.code ?? 'PERIMETRE_INTERDIT',
    regle: options.regle ?? 'RG-COO-167',
    details: { plateformeId, atelierId },
  })
}
