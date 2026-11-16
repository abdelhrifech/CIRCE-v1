// Droits et codes d'erreur de l'administration (étape 8, lot 2 : D-01 utilisateurs, D-02 sites, D-06 paramètres).
import type { PermissionCode } from '@circe/shared'
import type { Identity } from '../../core/identity.ts'
import { assertPermission } from '../../core/permissions/permissions.ts'

export const ADM = {
  version: { code: 'ADM_CONFLIT_VERSION', regle: 'RG-REC-009' },
  // Doubles soumissions (CLAUDE.md §6) : même règle transverse que Réception et Coordination.
  idempotence: { code: 'ADM_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' },
} as const

/** Droit vérifié dans le service (RG-REC-002) : 403 PERMISSION sinon. */
export function assertDroitAdmin(identity: Identity, code: PermissionCode): void {
  assertPermission(identity, code, {
    code: 'PERMISSION',
    regle: 'RG-REC-002',
    message: 'Réservé à l’administrateur.',
  })
}

/** Identifiant technique du compte de l'automate (D-20, Q-410 (3), Q-412) : jamais géré depuis D-01. */
export const IDENTIFIANT_SYSTEME = 'circe-automatique'
export const estCompteTechnique = (identifiant: string): boolean =>
  identifiant.trim().toLowerCase() === IDENTIFIANT_SYSTEME
