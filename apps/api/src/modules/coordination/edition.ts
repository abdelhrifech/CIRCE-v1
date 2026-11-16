// COO-P02 — saisie de la Coordination sur une instruction (RG-COO-047, 048, 050, 059), écart et version
// Broadcast (RG-COO-055, 056), demande de correction à Broadcast (RG-COO-057).
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { mettreEnFileMail } from '../mails/file.ts'
import { ecartDossier } from './instruction-ok.ts'
import { mettreAJourLigneAttendue } from './lignes-maj.ts'
import {
  assertDroitCoordination,
  assertPerimetreAtelier,
  COO,
  dossierDuPerimetre,
} from './permissions.ts'

/** RG-COO-050 : positions (tr_instruction_plus) ; RG-COO-048 : entretien 0 à 30 %. */
export const POSITIONS = [0, 1, 2, 3, 4] as const
const ENTRETIEN_MAX = 30

// RG-COO-059 (HYPOTHÈSE Q-224) : un commentaire de prépa qui demande « début » ou « fin » de train fait
// PROPOSER la position correspondante ; jamais appliquée sans action de la Coordination.
export function positionProposee(commentaire: string | null): 1 | 2 | null {
  if (!commentaire) return null
  if (/d[ée]but\s+de\s+train|en\s+t[êe]te/i.test(commentaire)) return 1
  if (/fin\s+de\s+train/i.test(commentaire)) return 2
  return null
}

// RG-COO-047 : annonceur, entretien, position figés en INSTRUCTION_OK / PRET_A_PRODUIRE (409) ; le commentaire
// reste modifiable. RG-COO-048 / RG-COO-050 : entretien et position modifiables seulement « En cours ».
// Une modification d'annonceur est répercutée sur toutes les faces de l'instruction.
export async function modifierInstruction(
  tx: Tx,
  identity: Identity,
  code: string,
  input: {
    version: number
    entretien?: number
    position?: number
    annonceur?: string
    commentaire?: string
  },
) {
  assertDroitCoordination(identity, 'instruction.modifier')
  const i = await tx.instruction.findUnique({
    where: { code },
    include: {
      atelier: { select: { id: true, plateformeId: true } },
      dossier: { select: { statut: true } },
    },
  })
  if (!i) throw new NotFoundError('Instruction introuvable')
  assertPerimetreAtelier(identity, i.atelier)
  const change = {
    entretien: input.entretien !== undefined && input.entretien !== i.entretien,
    position: input.position !== undefined && input.position !== i.tipInsCode,
    annonceur: input.annonceur !== undefined && input.annonceur !== i.annonceur,
  }
  const champsGeles = change.entretien || change.position || change.annonceur
  if (champsGeles && (i.statut === 'INSTRUCTION_OK' || i.statut === 'PRET_A_PRODUIRE')) {
    throw new ConflictError(
      'Entretien repris de Broadcast : modifiable seulement quand l’Instruction OK se fait après contrôle (dossier « En cours »).',
      { code: 'COO_INSTRUCTION_FIGEE', regle: 'RG-COO-047' },
    )
  }
  // RG-COO-048 / RG-COO-050 / RG-COO-052 (HYPOTHÈSE Q-183 (18)) : saisie seulement « En cours » ET prépa reçue
  // (état ATTENTE de la maquette non modifiable).
  if (
    (change.entretien || change.position) &&
    (i.statut !== 'EN_COURS' || i.dossier?.statut !== 'PREPARATION_RECUE')
  ) {
    throw new ConflictError(
      'Entretien et position se modifient seulement sur une instruction « En cours ».',
      {
        code: 'COO_INSTRUCTION_FIGEE',
        regle: change.entretien ? 'RG-COO-048' : 'RG-COO-050',
      },
    )
  }
  if (
    input.entretien !== undefined &&
    (!Number.isInteger(input.entretien) || input.entretien < 0 || input.entretien > ENTRETIEN_MAX)
  ) {
    throw new BusinessError('L’entretien est un pourcentage entier de 0 à 30.', {
      code: 'COO_ENTRETIEN_HORS_BORNES',
      regle: 'RG-COO-048',
    })
  }
  if (input.position !== undefined && !(POSITIONS as readonly number[]).includes(input.position)) {
    throw new BusinessError(
      'Position inconnue (0 standard, 1 début, 2 fin, 3 fin − 1, 4 milieu).',
      { code: 'COO_POSITION_INCONNUE', regle: 'RG-COO-050' },
    )
  }
  const version = await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.instruction.updateMany({
        where: { code, ...where },
        data: {
          ...(input.entretien !== undefined ? { entretien: input.entretien } : {}),
          ...(input.position !== undefined ? { tipInsCode: input.position } : {}),
          ...(input.annonceur !== undefined ? { annonceur: input.annonceur } : {}),
          ...(input.commentaire !== undefined ? { commentaire: input.commentaire } : {}),
          updatedById: identity.userId,
          ...bumpVersion,
        },
      }),
    ...COO.version,
  })
  if (change.annonceur) {
    await tx.faceTrain.updateMany({
      where: { instructionCode: code },
      data: { contAnnonc: input.annonceur ?? null, ...bumpVersion },
    })
  }
  // RG-COO-160 : « ModificationInstructionPlus » nominative, une ligne par champ changé.
  const lignes: [string, string | number | null, string | number | null | undefined][] = []
  if (change.entretien) lignes.push(['entretien', i.entretien, input.entretien])
  if (change.position) lignes.push(['position', i.tipInsCode, input.position])
  if (change.annonceur) lignes.push(['annonceur', i.annonceur, input.annonceur])
  if (input.commentaire !== undefined && input.commentaire !== i.commentaire)
    lignes.push(['commentaire', i.commentaire, input.commentaire])
  for (const [champ, avant, apres] of lignes) {
    await ecrireJournal(tx, {
      typeEntite: 'INSTRUCTION',
      entiteId: code,
      action: 'MODIFICATION_INSTRUCTION_PLUS',
      parId: identity.userId,
      ancienneValeur: avant === null ? null : String(avant),
      nouvelleValeur: apres == null ? null : String(apres),
      complement: champ,
    })
  }
  return { code, version, message: `Instruction ${code} modifiée.` }
}

// RG-COO-056 / RG-X-064 (HYPOTHÈSE Q-225) : « Appliquer la version Broadcast » = annule et remplace : la quantité Broadcast
// (qte_BC) devient la quantité Circé (qte_prépa) des lignes actives non exclues ; le reçu / statut des lignes
// attendues est recalculé dans la MÊME transaction (RG-REC-018, côté Réception) ; l'écart retombe à 0.
// Le recalcul des trains non produits et le signalement des trains en production relèvent de coo2.
export async function appliquerVersionBroadcast(
  tx: Tx,
  identity: Identity,
  dossierId: number,
  version: number,
) {
  assertDroitCoordination(identity, 'broadcast.version.appliquer')
  const dossier = await dossierDuPerimetre(tx, identity, dossierId)
  if (dossier.statut === 'ANNULE') {
    throw new ConflictError('Dossier annulé : rien à aligner.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-062',
    })
  }
  // RG-COO-167 (ANO-024) : seules les lignes du périmètre de l'utilisateur sont lues et alignées.
  const plateformes = identity.perimetre.toutesPlateformes ? null : identity.perimetre.plateformeIds
  const ecart = await ecartDossier(tx, dossier.contNum, plateformes)
  if (ecart === null || ecart === 0) {
    throw new ConflictError('Aucun écart Broadcast / Circé à corriger sur ce dossier.', {
      code: 'COO_SANS_ECART',
      regle: 'RG-COO-056',
    })
  }
  await updateWithVersion({
    expectedVersion: version,
    update: (where) =>
      tx.dossier.updateMany({
        where: { id: dossierId, ...where },
        data: { updatedById: identity.userId, ...bumpVersion },
      }),
    ...COO.version,
  })
  const lignes = await tx.receptionAttendue.findMany({
    where: {
      contNum: dossier.contNum,
      etatLigne: 'ACTIVE',
      themeExclu: false,
      ...(plateformes ? { plateformeId: { in: plateformes } } : {}),
    },
  })
  for (const l of lignes) {
    if ((l.qtePrepa ?? null) === (l.qteBc ?? null)) continue
    // RG-COO-031 : la quantité change ; une affiche validée garde sa validation (alerte seule).
    await mettreAJourLigneAttendue(tx, l.id, { qtePrepa: l.qteBc }, 'BROADCAST', identity)
  }
  await ecrireJournal(tx, {
    typeEntite: 'DOSSIER',
    entiteId: dossier.contNum,
    action: 'APPLICATION_VERSION_BROADCAST',
    parId: identity.userId,
    ancienneValeur: `écart ${String(ecart)}`,
    nouvelleValeur: 'écart 0',
  })
  return {
    dossierId,
    ecart: 0,
    message: `Version Broadcast appliquée au dossier ${String(dossier.contNum)} : écart corrigé (${String(ecart)}).`,
  }
}

// RG-COO-057 (HYPOTHÈSES Q-219, Q-375, Q-409) : la demande de correction est tracée (date, utilisateur, note) ;
// l'état du dossier ne change pas ; un renvoi est possible ; le mail « Pré-Prod » est mis en file dans la même
// transaction (destinataires : adresses des plateformes des lignes actives du dossier dans le périmètre, repli de
// Q-219) ; `mailEnvoye` ne passe à vrai qu'à l'envoi réel.
export async function demanderCorrection(
  tx: Tx,
  identity: Identity,
  dossierId: number,
  note: string,
) {
  assertDroitCoordination(identity, 'broadcast.correction.demander')
  const dossier = await dossierDuPerimetre(tx, identity, dossierId)
  const precedente = await tx.demandeCorrection.findFirst({
    where: { dossierId },
    orderBy: { le: 'desc' },
  })
  const demande = await tx.demandeCorrection.create({
    data: { dossierId, note: note.trim() || null, parId: identity.userId },
  })
  const plateformesLignes = await tx.receptionAttendue.findMany({
    where: {
      contNum: dossier.contNum,
      etatLigne: 'ACTIVE',
      ...(identity.perimetre.toutesPlateformes
        ? {}
        : { plateformeId: { in: identity.perimetre.plateformeIds } }),
    },
    select: { plateformeId: true },
    distinct: ['plateformeId'],
  })
  const adresses = await tx.plateforme.findMany({
    where: { id: { in: plateformesLignes.map((l) => l.plateformeId) } },
    select: { mail: true },
  })
  const miseEnFile = await mettreEnFileMail(tx, {
    type: 'CORRECTION_BROADCAST',
    cle: `CORRECTION_BROADCAST:${String(demande.id)}`,
    source: { type: 'CORRECTION_BROADCAST', id: demande.id },
    destinataires: adresses.map((a) => a.mail),
    sujet: `Demande de correction Broadcast - dossier ${String(dossier.contNum)}${dossier.annonceur ? ` ${dossier.annonceur}` : ''}`,
    corps: [
      `Demande de correction pour le dossier ${String(dossier.contNum)}${dossier.annonceur ? ` (${dossier.annonceur})` : ''}.`,
      ...(demande.note ? [`Note : ${demande.note}`] : []),
      ...(precedente ? ['Renvoi : une demande avait déjà été faite.'] : []),
      `Par : ${identity.nom ?? identity.identifiantExterne}`,
    ].join('\n'),
    parId: identity.userId,
  })
  await ecrireJournal(tx, {
    typeEntite: 'DOSSIER',
    entiteId: dossier.contNum,
    action: 'DEMANDE_CORRECTION_BROADCAST',
    parId: identity.userId,
    nouvelleValeur: demande.note,
    complement: precedente ? 'renvoi' : undefined,
    donnees: { mailFileId: miseEnFile?.id ?? null },
  })
  return {
    demandeId: demande.id,
    dejaDemandeeLe: precedente?.le.toISOString() ?? null,
    mailEnvoye: false,
    message: `Demande de correction enregistrée pour le dossier ${String(dossier.contNum)}${dossier.annonceur ? ` (${dossier.annonceur})` : ''}. Le mail à la Pré-Prod est mis en file d’envoi (Q-375, Q-409).`,
  }
}

// Déplacée dans permissions.ts (supprime l'import circulaire validation-admin ↔ edition) ; ré-exportée.
export { dossierDuPerimetre }
