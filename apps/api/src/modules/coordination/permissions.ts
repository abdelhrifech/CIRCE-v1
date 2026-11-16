// Codes d'erreur et contrôles de droits du module Coordination (RG-COO-165 à 168).
// La matrice rôle → permission est dans core/permissions/catalogue.ts (source unique).
import type { PermissionCode } from '@circe/shared'
import type { FastifyRequest } from 'fastify'
import { identiteDuSite, requireIdentity, type Identity } from '../../core/identity.ts'
import {
  assertAtelier,
  assertPermission,
  canAccessAtelier,
} from '../../core/permissions/permissions.ts'
import type { Db } from '../../core/db.ts'
import { ForbiddenError, NotFoundError } from '../../core/errors.ts'
import type { Tx } from '../../core/transaction.ts'

export const COO = {
  perimetre: { code: 'COO_PERIMETRE_INTERDIT', regle: 'RG-COO-167' },
  version: { code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-040' },
  // Doubles soumissions (CLAUDE.md §6) : même règle transverse que la Réception (HYPOTHÈSE Q-182 (13)).
  idempotence: { code: 'COO_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' },
} as const

// RG-COO-165 : droit vérifié dans le service (403 PERMISSION) ; RG-COO-168 : le rôle Commerce est en
// lecture seule (403 citant RG-COO-168 quand il ne détient pas le droit demandé). `regle` : RG propre à
// l'action (ex. RG-COO-009 pour la validation admin), RG-COO-165 par défaut.
export function assertDroitCoordination(
  identity: Identity,
  code: PermissionCode,
  regle = 'RG-COO-165',
): void {
  const commerceSeul = identity.roles.length > 0 && identity.roles.every((r) => r === 'com')
  assertPermission(identity, code, {
    code: 'PERMISSION',
    regle: commerceSeul ? 'RG-COO-168' : regle,
    // RG-COO-009 : message de la maquette, reformulé (pas de choix du rôle en haut de page en V2, Q-186 (10)).
    message: commerceSeul
      ? 'Le rôle Commerce consulte sans agir.'
      : regle === 'RG-COO-009'
        ? 'Réservé à la Coordination : la validation admin est faite par les rôles Coordination et administrateur.'
        : "Vous n'avez pas le droit d'effectuer cette action.",
  })
}

// RG-COO-167 : périmètre (site, atelier) de l'utilisateur, revérifié côté serveur ; une instruction sans
// atelier n'est visible que des utilisateurs de tous les sites (HYPOTHÈSE Q-182).
export function peutVoirAtelier(
  identity: Identity,
  atelier: { id: number; plateformeId: number } | null,
): boolean {
  if (identity.perimetre.toutesPlateformes) return true
  return atelier !== null && canAccessAtelier(identity, atelier.plateformeId, atelier.id)
}

export function assertPerimetreAtelier(
  identity: Identity,
  atelier: { id: number; plateformeId: number } | null,
): void {
  if (identity.perimetre.toutesPlateformes) return
  if (!atelier) {
    throw new ForbiddenError(
      "Cette instruction n'est rattachée à aucun atelier de votre périmètre.",
      COO.perimetre,
    )
  }
  assertAtelier(identity, atelier.plateformeId, atelier.id, COO.perimetre)
}

// RG-COO-167 : un dossier est dans le périmètre si une de ses instructions est sur un atelier du périmètre ou
// une de ses lignes attendues sur un site du périmètre ; sinon 403.
export async function dossierDuPerimetre(tx: Db | Tx, identity: Identity, dossierId: number) {
  const dossier = await tx.dossier.findUnique({
    where: { id: dossierId },
    include: {
      instructions: { include: { atelier: { select: { id: true, plateformeId: true } } } },
    },
  })
  if (!dossier) throw new NotFoundError('Dossier introuvable')
  if (identity.perimetre.toutesPlateformes) return dossier
  if (dossier.instructions.some((x) => peutVoirAtelier(identity, x.atelier))) return dossier
  const lignes = await tx.receptionAttendue.count({
    where: { contNum: dossier.contNum, plateformeId: { in: identity.perimetre.plateformeIds } },
  })
  if (lignes > 0) return dossier
  throw new ForbiddenError("Ce dossier n'est pas dans votre périmètre.", COO.perimetre)
}

// RG-COO-167 / Q-173 : identité de la requête avec le périmètre restreint au site choisi dans le bandeau
// (x-site-id). Toutes les routes de Coordination (listes, fiches, actions) passent par ce point d'entrée.
export function identiteCoordination(request: FastifyRequest): Identity {
  return identiteDuSite(requireIdentity(request))
}
