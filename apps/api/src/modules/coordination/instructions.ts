// COO-P01 — changement de statut d'une instruction par la Coordination (RG-COO-040, 045, 046, 061, 160).
import type { ChangerStatutInstruction, PermissionCode } from '@circe/shared'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { StatutInstruction } from '../../generated/prisma/client.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import { regleTransitionInstruction, TRANSITIONS_INSTRUCTION_UTILISATEUR } from './statuts.ts'

/** Droit exigé par transition : annuler / remettre à traiter (RG-COO-045) ; retour arrière de l'IOK (RG-COO-046). */
function permissionPour(de: StatutInstruction, vers: StatutInstruction): PermissionCode {
  return vers === 'ANNULE' || de === 'ANNULE' ? 'instruction.annuler' : 'instruction.instruction_ok'
}

// RG-COO-046 / RG-COO-206 : repasser une instruction INSTRUCTION_OK → EN_COURS / A_TRAITER / ANNULE efface le calcul des
// trains : faces d'entretien non « à imprimer » supprimées ; autres faces non « à imprimer » remises à blanc
// (thème, repiquage, visuel, train, version vidés ; statut = statut demandé). Source :
// circe-develop BDD/.../p_u_statut_preparation.sql:24-64.
export async function effacerCalculTrains(
  tx: Tx,
  instructionCode: string,
  vers: 'A_TRAITER' | 'EN_COURS' | 'ANNULE',
) {
  const supprimees = await tx.faceTrain.deleteMany({
    where: { instructionCode, ftType: 'entretien', NOT: { statut: 'A_IMPRIMER' } },
  })
  const remises = await tx.faceTrain.updateMany({
    where: { instructionCode, NOT: { statut: 'A_IMPRIMER' } },
    data: {
      statut: vers,
      theme: null,
      themeId: null,
      repiquage: null,
      repiquageId: null,
      visuelId: null,
      trainId: null,
      versionTrain: null,
      // RG-COO-206 : le calcul est effacé, une position fractionnée redevient attendue au recalcul.
      fractionnee: false,
      ...bumpVersion,
    },
  })
  return { facesSupprimees: supprimees.count, facesRemisesABlanc: remises.count }
}

// RG-COO-040 / RG-COO-045 / RG-COO-046 : transition demandée par la Coordination, dans UNE transaction :
// droit (RG-COO-165, 168) → périmètre (RG-COO-167) → table de transitions (409) → version (409) →
// effacement du calcul des trains si l'instruction était INSTRUCTION_OK → historique (RG-COO-061) et
// journal nominatif (RG-COO-160). RG-COO-001 : aucune garde ne lit la validation admin.
export async function changerStatutInstruction(
  tx: Tx,
  identity: Identity,
  code: string,
  input: ChangerStatutInstruction,
) {
  const instruction = await tx.instruction.findUnique({
    where: { code },
    include: {
      atelier: { select: { id: true, plateformeId: true } },
      dossier: { select: { statut: true } },
    },
  })
  if (!instruction) throw new NotFoundError('Instruction introuvable')
  assertDroitCoordination(identity, permissionPour(instruction.statut, input.vers))
  assertPerimetreAtelier(identity, instruction.atelier)
  // RG-COO-062 (HYPOTHÈSE Q-182 (9)) : l'Instruction OK d'un dossier annulé est sans objet → aucune
  // transition demandée par un utilisateur (409).
  if (instruction.dossier?.statut === 'ANNULE') {
    throw new ConflictError('Dossier annulé : l’instruction est sans objet.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-062',
    })
  }
  const regle = regleTransitionInstruction(instruction.statut, input.vers)
  assertTransition(TRANSITIONS_INSTRUCTION_UTILISATEUR, instruction.statut, input.vers, { regle })
  const version = await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.instruction.updateMany({
        where: { code, ...where },
        data: { statut: input.vers, updatedById: identity.userId, ...bumpVersion },
      }),
    ...COO.version,
  })
  const effacement =
    instruction.statut === 'INSTRUCTION_OK'
      ? await effacerCalculTrains(tx, code, input.vers)
      : { facesSupprimees: 0, facesRemisesABlanc: 0 }
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: code,
    ancien: instruction.statut,
    nouveau: input.vers,
    parId: identity.userId,
    regle,
  })
  await ecrireJournal(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: code,
    action: 'CHANGEMENT_STATUT_INSTRUCTION',
    parId: identity.userId,
    ancienneValeur: instruction.statut,
    nouvelleValeur: input.vers,
    donnees: effacement,
  })
  const libelle = { A_TRAITER: 'À traiter', EN_COURS: 'En cours', ANNULE: 'Annulé' }[input.vers]
  return {
    code,
    version,
    statut: input.vers,
    ...effacement,
    message:
      `Instruction ${code} : ${libelle}.` +
      (effacement.facesSupprimees + effacement.facesRemisesABlanc > 0
        ? ` Calcul des trains effacé (${String(effacement.facesRemisesABlanc)} face(s) remise(s) à blanc, ${String(effacement.facesSupprimees)} face(s) d'entretien supprimée(s)).`
        : ''),
  }
}
