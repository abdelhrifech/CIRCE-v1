// Services publics du socle Réception (REC-P01). Ordre imposé (skill circe-endpoint) :
// permission → chargement (404) → périmètre → règles (422) → transition (409) → écritures en transaction.
import type { Prisma } from '../../generated/prisma/client.ts'
import type { PermissionCode, ReceptionDetail, StockAffiche } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { StatutReception } from '../../generated/prisma/client.ts'
import { assertDroitReception, assertPerimetreReception, REC } from './permissions.ts'
import * as repo from './repository.ts'
import { regleTransitionInterditeReception, TRANSITIONS_RECEPTION } from './statuts.ts'

const iso = (d: Date | null) => (d ? d.toISOString() : null)

// Lecture de la réception (socle de ECR-REC-06) : RG-REC-002 (droit), RG-REC-001 (périmètre),
// historique des statuts (CLAUDE.md §6).
export async function lireReception(
  db: Db,
  identity: Identity,
  id: number,
): Promise<ReceptionDetail> {
  assertDroitReception(identity, 'affiche.consulter')
  const reception = await repo.trouverReception(db, id)
  if (!reception) throw new NotFoundError('Réception introuvable')
  assertPerimetreReception(identity, reception.plateformeId)
  const historique = await repo.historiqueReception(db, id)
  return {
    id: reception.id,
    plateformeId: reception.plateformeId,
    statut: reception.statut,
    version: reception.version,
    dateArrivee: reception.dateArrivee.toISOString(),
    controleLe: iso(reception.controleLe),
    controleurNom: reception.controleurNom,
    signaleLe: iso(reception.signaleLe),
    referenceBl: reception.livraison?.reference ?? null,
    nombreAffiches: reception._count.affiches,
    historique: historique.map((h) => ({
      ancien: h.ancien,
      nouveau: h.nouveau,
      le: h.le.toISOString(),
      par: h.par ? (h.par.nom ?? h.par.identifiantExterne) : null,
      motif: h.motif,
    })),
  }
}

// RG-REC-153 / RG-X-060 : stock (Σ mouvements) et répartition par dossier (Σ liens actifs, comptée une fois).
export async function lireStockAffiche(
  db: Db,
  identity: Identity,
  id: number,
): Promise<StockAffiche> {
  assertDroitReception(identity, 'affiche.consulter')
  const affiche = await repo.trouverAffiche(db, id)
  if (!affiche) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, affiche.plateformeId)
  const [stock, liens] = await Promise.all([
    repo.sommeMouvements(db, id),
    repo.rattachementsActifs(db, id),
  ])
  const quantiteRepartie = liens.reduce((s, l) => s + l.quantite, 0)
  return {
    afficheId: id,
    statut: affiche.statut,
    stock,
    quantiteRepartie,
    nonRepartie: stock - quantiteRepartie,
    rattachements: liens.map((l) => ({
      id: l.id,
      ligneAttendueId: l.ligneAttendueId,
      contNum: l.ligneAttendue.contNum,
      quantite: l.quantite,
      mode: l.mode,
    })),
  }
}

// Changement de statut d'une réception, utilisé par les parcours REC-P04, P05, P07 dans leur transaction :
// droit (RG-REC-002) → périmètre (RG-REC-001) → transition (§3.2, 409 avec la RG de la transition
// interdite) → version (RG-REC-009, 409) → historique (la RG de l'appelant justifie la transition).
export async function changerStatutReception(
  tx: Tx,
  identity: Identity,
  input: {
    id: number
    vers: StatutReception
    expectedVersion: number
    regle: string
    /** RG-REC-002 : droit exigé par le parcours appelant (ex. reception.controler). */
    permission: PermissionCode
    motif?: string
    /** Champs écrits avec la transition, sous le même verrou de version (RG-REC-009). */
    data?: Prisma.ReceptionUpdateManyMutationInput
  },
) {
  assertDroitReception(identity, input.permission)
  const reception = await tx.reception.findUnique({ where: { id: input.id } })
  if (!reception) throw new NotFoundError('Réception introuvable')
  assertPerimetreReception(identity, reception.plateformeId)
  assertTransition(TRANSITIONS_RECEPTION, reception.statut, input.vers, {
    regle: regleTransitionInterditeReception(reception.statut, input.vers) ?? input.regle,
  })
  const version = await updateWithVersion({
    expectedVersion: input.expectedVersion,
    update: (where) =>
      tx.reception.updateMany({
        where: { id: input.id, ...where },
        data: { ...input.data, statut: input.vers, updatedById: identity.userId, ...bumpVersion },
      }),
    ...REC.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'RECEPTION',
    entiteId: input.id,
    ancien: reception.statut,
    nouveau: input.vers,
    parId: identity.userId,
    regle: input.regle,
    ...(input.motif ? { motif: input.motif } : {}),
  })
  return version
}

// RG-REC-074 : aucune suppression ni annulation de réception → 409.
// RG-REC-073 (HYPOTHÈSE Q-121) : pas d'édition de l'en-tête ; les quantités se corrigent par écarts de contrôle.
export async function supprimerReception(db: Db, identity: Identity, id: number): Promise<never> {
  assertDroitReception(identity, 'affiche.consulter')
  const reception = await repo.trouverReception(db, id)
  if (!reception) throw new NotFoundError('Réception introuvable')
  assertPerimetreReception(identity, reception.plateformeId)
  throw new ConflictError('Une réception ne peut être ni supprimée ni annulée.', {
    code: 'REC_SUPPRESSION_INTERDITE',
    regle: 'RG-REC-074',
  })
}

// RG-REC-151 : un mouvement n'est jamais modifié ni supprimé → 409 (corriger = nouveau mouvement).
export async function modifierMouvement(db: Db, identity: Identity, id: number): Promise<never> {
  assertDroitReception(identity, 'affiche.consulter')
  const mouvement = await db.mouvement.findUnique({ where: { id }, include: { affiche: true } })
  if (!mouvement) throw new NotFoundError('Mouvement introuvable')
  assertPerimetreReception(identity, mouvement.affiche.plateformeId)
  throw new ConflictError(
    'Un mouvement de stock ne se modifie pas et ne se supprime pas : créez un mouvement correctif.',
    {
      code: 'REC_MOUVEMENT_IMMUABLE',
      regle: 'RG-REC-151',
    },
  )
}
