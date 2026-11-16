// Ligne attendue : attendu, reçu, reste, statut (RG-REC-017, RG-REC-018) et contrôle (RG-REC-019).
import type { ControleLigne, StatutLigne } from '@circe/shared'
import type { Identity } from '../../core/identity.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { SourceLigne, StatutReception } from '../../generated/prisma/client.ts'
import { lireParametreNombre } from './parametres.ts'
import { REC } from './permissions.ts'
import * as repo from './repository.ts'
import { TRANSITIONS_LIGNE } from './statuts.ts'

// RG-REC-017 : l'attendu vient de Broadcast (ligne BC) ou de la prépa (ligne PREPA).
export function attenduDe(ligne: {
  source: SourceLigne
  qteBc: number | null
  qtePrepa: number | null
}): number {
  return (
    (ligne.source === 'PREPA'
      ? (ligne.qtePrepa ?? ligne.qteBc)
      : (ligne.qteBc ?? ligne.qtePrepa)) ?? 0
  )
}

// RG-REC-017 : reste = max(0, attendu − reçu).
export function resteDe(attendu: number, recu: number): number {
  return Math.max(0, attendu - recu)
}

// RG-REC-018 : Attendue (reçu = 0) ; Partielle (0 < reçu < attendu) ; Complète (attendu ≤ reçu ≤
// attendu × (1 + écart)) ; Surplus (reçu > attendu × (1 + écart), strictement). Écart = paramètre en %.
// RG-REC-050 : réception partielle → Partielle ; RG-REC-051 : au-delà de attendu × (1 + écart) → Surplus.
export function statutLigneDe(attendu: number, recu: number, ecartPourcent: number): StatutLigne {
  if (recu <= 0) return 'ATTENDUE'
  if (recu < attendu) return 'PARTIELLE'
  if (recu * 100 > attendu * (100 + ecartPourcent)) return 'SURPLUS'
  return 'COMPLETE'
}

// RG-REC-019 : « Rien reçu » sans affiche rattachée ; « À contrôler » si au moins une affiche rattachée
// est sur une palette non contrôlée ; sinon « Contrôlée ». HYPOTHÈSE Q-174 : une affiche sans réception
// (donnée reprise du legacy) compte comme contrôlée.
export function controleDe(statutsReceptions: (StatutReception | null)[]): ControleLigne {
  if (statutsReceptions.length === 0) return 'RIEN_RECU'
  return statutsReceptions.some((s) => s !== null && s !== 'CONTROLEE')
    ? 'A_CONTROLER'
    : 'CONTROLEE'
}

// RG-REC-018 / RG-X-004 : statut calculé UNE fois à chaque événement (rattacher, retirer, contrôle avec écart),
// persisté (Q-300) et lu par tous les écrans (dont la Coordination : RG-X-004) ; tout changement est historisé (CLAUDE.md §6).
// RG-X-004 : le statut de ligne calculé ici est lu tel quel par la Coordination.
export async function recalculerLigne(tx: Tx, identity: Identity | null, ligneAttendueId: number) {
  const ligne = await tx.receptionAttendue.findUniqueOrThrow({ where: { id: ligneAttendueId } })
  const recu = await repo.sommeRattachementsLigne(tx, ligneAttendueId)
  const ecart = await lireParametreNombre(tx, 'reception.ecartReception', ligne.plateformeId)
  const statut = statutLigneDe(attenduDe(ligne), recu, ecart)
  if (statut === ligne.statut) return { statut, recu }
  assertTransition(TRANSITIONS_LIGNE, ligne.statut, statut, { regle: 'RG-REC-018' })
  await updateWithVersion({
    expectedVersion: ligne.version,
    update: (where) =>
      tx.receptionAttendue.updateMany({
        where: { id: ligneAttendueId, ...where },
        data: { statut, updatedById: identity?.userId ?? null, ...bumpVersion },
      }),
    ...REC.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'LIGNE_ATTENDUE',
    entiteId: ligneAttendueId,
    ancien: ligne.statut,
    nouveau: statut,
    parId: identity?.userId ?? null,
    regle: 'RG-REC-018',
  })
  return { statut, recu }
}
