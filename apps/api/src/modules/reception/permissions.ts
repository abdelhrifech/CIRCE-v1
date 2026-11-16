// Codes d'erreur et règles du module Réception (RECEPTION_REGLES_METIER.md RG-REC-001 à 009).
// La matrice rôle → permission est dans core/permissions/catalogue.ts (source unique).
import type { PermissionCode } from '@circe/shared'
import type { Identity } from '../../core/identity.ts'
import { assertPermission, assertPlateforme } from '../../core/permissions/permissions.ts'

export const REC = {
  accesRefuse: { code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' },
  validationReservee: { code: 'REC_VALIDATION_RESERVEE', regle: 'RG-REC-003' },
  perimetre: { code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' },
  version: { code: 'REC_CONFLIT_VERSION', regle: 'RG-REC-009' },
  idempotence: { code: 'REC_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' },
} as const

// RG-REC-002 : droit vérifié dans le service ; RG-REC-003 pour la validation admin.
export function assertDroitReception(identity: Identity, code: PermissionCode): void {
  const erreur = code === 'validation_admin.valider' ? REC.validationReservee : REC.accesRefuse
  assertPermission(identity, code, {
    ...erreur,
    message:
      code === 'validation_admin.valider'
        ? 'Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation admin et Instruction OK.'
        : "Vous n'avez pas le droit d'effectuer cette action.",
  })
}

// RG-REC-001 : la plateforme de l'objet est revérifiée côté serveur.
export function assertPerimetreReception(identity: Identity, plateformeId: number): void {
  assertPlateforme(identity, plateformeId, REC.perimetre)
}
