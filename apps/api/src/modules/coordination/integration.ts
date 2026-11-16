// COO-P01 — intégration des flux Broadcast (actions posées par Circé, acteur « Circé (automatique) ») :
// instructions (RG-COO-041), préparation du dossier (RG-COO-063), annulation du dossier (RG-COO-062,
// RG-X-065). Appelées par le passage d'intégration (integration-broadcast.ts, COO-P06) ; aucune route
// utilisateur ne les appelle directement (RG-COO-063 : « jamais par un utilisateur de Circé »).
import { formatSemaineIso } from '@circe/shared'
import { ConflictError } from '../../core/errors.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { COO } from './permissions.ts'
import { effetsLigneModifiee } from './effets-validation.ts'
import { mettreAJourLigneAttendue } from './lignes-maj.ts'
import { TRANSITIONS_DOSSIER, TRANSITIONS_INSTRUCTION_SYSTEME } from './statuts.ts'

import { CIRCE_AUTOMATIQUE } from './integration-commun.ts'
import { evaluerInstructionOkAuto, rouvrirInstructionOk } from './instruction-ok.ts'

export { CIRCE_AUTOMATIQUE }

/** RG-COO-041 : entretien par défaut (%) et position standard (tr_instruction_plus 0). */
const ENTRETIEN_DEFAUT = 8
const POSITION_STANDARD = 0

export interface InstructionBroadcast {
  code: string
  type: 'contrat' | 'reseau'
  contNum: number
  semaine: { annee: number; semaine: number }
  atelierId: number | null
  annonceur: string | null
  commentaire: string | null
  /** RG-COO-041 conditions : `sect_code_centre` non nul et `talr_trait = '1'`. */
  sectCodeCentre: number | null
  talrTrait: string
  /** RG-COO-048 : % d'entretien saisi dans Broadcast (repris sans ressaisie) ; à défaut 8 %. */
  entretien?: number | null
  /** RG-COO-041 : détails de l'instruction (annule-et-remplace à chaque intégration). */
  details?: {
    cadrIdent: number | null
    cadreLib: string | null
    supportId: number | null
    typePreparationId: number | null
    afchIdent: number | null
    theme: string | null
    repiquageIdent: number | null
    repiquage: string | null
    type: string | null
  }[]
  /** RG-COO-041 : visuels (thème, pourcentage) mis à jour, repérés par n° d'affichage Broadcast. */
  visuels?: {
    afchIdent: number
    supportId: number | null
    typePreparationId: number | null
    theme: string | null
    pourcentage: number | null
  }[]
}

// RG-COO-041 : « annule-et-remplace des détails ; mise à jour des visuels (thème, pourcentage) ».
// Un visuel existant garde ses valeurs d'origine (theme_ori, pourcentage_ori) ; un nouveau visuel les reçoit.
async function remplacerDetailsEtVisuels(tx: Tx, d: InstructionBroadcast) {
  if (d.details) {
    await tx.instructionDetail.deleteMany({ where: { instructionCode: d.code } })
    for (const det of d.details) {
      await tx.instructionDetail.create({ data: { ...det, instructionCode: d.code } })
    }
  }
  for (const v of d.visuels ?? []) {
    const existant = await tx.instructionVisuel.findFirst({
      where: { instructionCode: d.code, afchIdent: v.afchIdent },
    })
    if (existant) {
      await tx.instructionVisuel.update({
        where: { id: existant.id },
        data: { theme: v.theme, pourcentage: v.pourcentage },
      })
    } else {
      await tx.instructionVisuel.create({
        data: {
          instructionCode: d.code,
          afchIdent: v.afchIdent,
          supportId: v.supportId,
          typePreparationId: v.typePreparationId,
          theme: v.theme,
          themeOri: v.theme,
          pourcentage: v.pourcentage,
          pourcentageOri: v.pourcentage,
          statut: 'EN_COURS',
        },
      })
    }
  }
}

export type ResultatIntegration =
  'CREEE' | 'MISE_A_JOUR' | 'ROUVERTE' | 'IGNOREE' | 'NON_MISE_A_JOUR' | 'NON_ELIGIBLE'

// RG-COO-041 : création (EN_COURS, entretien 8 %, position standard) ou mise à jour selon le statut :
// INSTRUCTION_OK → rouverte puis mise à jour (RG-COO-054, Q-204 option b : renvoi avant l'export) ;
// PRET_A_PRODUIRE → ignorée, tracée (RG-COO-053 : plus d'oubli silencieux) ;
// ANNULE → non mise à jour ; ERREUR → EN_COURS ; A_TRAITER / EN_COURS → annonceur et commentaire mis à
// jour, statut EN_COURS. RG-COO-061 : historique de toute transition, même automatique.
export async function integrerInstruction(
  tx: Tx,
  d: InstructionBroadcast,
): Promise<ResultatIntegration> {
  if (d.sectCodeCentre === null || d.talrTrait !== '1') return 'NON_ELIGIBLE'
  const dossier = await tx.dossier.findUnique({
    where: { contNum: d.contNum },
    select: { id: true },
  })
  const existante = await tx.instruction.findUnique({ where: { code: d.code } })
  if (!existante) {
    await tx.instruction.create({
      data: {
        code: d.code,
        dossierId: dossier?.id ?? null,
        atelierId: d.atelierId,
        statut: 'EN_COURS',
        typeInstruction: d.type,
        contNum: d.contNum,
        contAnbas: d.semaine.annee,
        contSembas: d.semaine.semaine,
        annonceur: d.annonceur,
        commentaire: d.commentaire,
        entretien: d.entretien ?? ENTRETIEN_DEFAUT,
        tipInsCode: POSITION_STANDARD,
      },
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'INSTRUCTION',
      entiteId: d.code,
      ancien: null,
      nouveau: 'EN_COURS',
      parId: null,
      motif: CIRCE_AUTOMATIQUE,
      regle: 'RG-COO-041',
    })
    await ecrireJournal(tx, {
      typeEntite: 'INSTRUCTION',
      entiteId: d.code,
      action: 'INTEGRATION_INSTRUCTION',
      parId: null,
      nouvelleValeur: 'EN_COURS',
      complement: CIRCE_AUTOMATIQUE,
    })
    await remplacerDetailsEtVisuels(tx, d)
    // RG-COO-042 (Q-204 b) : Instruction OK automatique si la prépa est reçue et la règle respectée.
    await evaluerInstructionOkAuto(tx, d.code)
    return 'CREEE'
  }
  // RG-COO-054 (Q-204 b) : renvoi avant l'export → l'Instruction OK est rouverte, puis l'instruction est
  // mise à jour comme une instruction « En cours ».
  let rouverte = false
  let courante = existante
  if (existante.statut === 'INSTRUCTION_OK') {
    await rouvrirInstructionOk(tx, d.code)
    courante = await tx.instruction.findUniqueOrThrow({ where: { code: d.code } })
    rouverte = true
  }
  if (courante.statut === 'PRET_A_PRODUIRE' || courante.statut === 'ANNULE') {
    // RG-COO-053 : renvoi ignoré, jamais silencieux (l'alerte « Rajout après préparation » est COO-P05).
    await ecrireJournal(tx, {
      typeEntite: 'INSTRUCTION',
      entiteId: d.code,
      action: 'RENVOI_BROADCAST_IGNORE',
      parId: null,
      ancienneValeur: courante.statut,
      complement: CIRCE_AUTOMATIQUE,
    })
    return courante.statut === 'ANNULE' ? 'NON_MISE_A_JOUR' : 'IGNOREE'
  }
  const change = courante.statut !== 'EN_COURS'
  if (change) {
    assertTransition(TRANSITIONS_INSTRUCTION_SYSTEME, courante.statut, 'EN_COURS', {
      regle: 'RG-COO-041',
    })
  }
  await updateWithVersion({
    expectedVersion: courante.version,
    update: (where) =>
      tx.instruction.updateMany({
        where: { code: d.code, ...where },
        data: {
          statut: 'EN_COURS',
          annonceur: d.annonceur,
          commentaire: d.commentaire,
          dossierId: courante.dossierId ?? dossier?.id ?? null,
          ...(d.entretien != null ? { entretien: d.entretien } : {}),
          ...bumpVersion,
        },
      }),
    ...COO.version,
  })
  if (change) {
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'INSTRUCTION',
      entiteId: d.code,
      ancien: courante.statut,
      nouveau: 'EN_COURS',
      parId: null,
      motif: CIRCE_AUTOMATIQUE,
      regle: 'RG-COO-041',
    })
  }
  await ecrireJournal(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: d.code,
    action: 'INTEGRATION_INSTRUCTION',
    parId: null,
    ancienneValeur: courante.statut,
    nouvelleValeur: 'EN_COURS',
    complement: CIRCE_AUTOMATIQUE,
  })
  await remplacerDetailsEtVisuels(tx, d)
  await evaluerInstructionOkAuto(tx, d.code)
  return rouverte ? 'ROUVERTE' : 'MISE_A_JOUR'
}

// RG-COO-041 : chapeau d'instruction manquant (faces reçues sans instructions) créé À traiter, type
// « contrat », utilisateur « BC » ; sans effet s'il existe déjà.
export async function creerChapeauATraiter(
  tx: Tx,
  d: {
    code: string
    contNum: number
    semaine: { annee: number; semaine: number }
    atelierId: number | null
  },
): Promise<'CREEE' | 'EXISTANTE'> {
  if (await tx.instruction.findUnique({ where: { code: d.code }, select: { code: true } }))
    return 'EXISTANTE'
  const dossier = await tx.dossier.findUnique({
    where: { contNum: d.contNum },
    select: { id: true },
  })
  await tx.instruction.create({
    data: {
      code: d.code,
      dossierId: dossier?.id ?? null,
      atelierId: d.atelierId,
      statut: 'A_TRAITER',
      typeInstruction: 'contrat',
      contNum: d.contNum,
      contAnbas: d.semaine.annee,
      contSembas: d.semaine.semaine,
    },
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: d.code,
    ancien: null,
    nouveau: 'A_TRAITER',
    parId: null,
    motif: 'BC',
    regle: 'RG-COO-041',
  })
  // RG-COO-160 : la création automatique est aussi journalisée (acteur « BC », RG-COO-041).
  await ecrireJournal(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: d.code,
    action: 'INTEGRATION_INSTRUCTION',
    parId: null,
    nouvelleValeur: 'A_TRAITER',
    complement: 'BC',
  })
  return 'CREEE'
}

/** Changement de statut de préparation d'un dossier par Circé (machine d'états + version + historique). */
async function changerStatutDossier(
  tx: Tx,
  dossier: {
    id: number
    contNum: number
    statut: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE'
    version: number
  },
  vers: 'PREPARATION_RECUE' | 'ANNULE',
  regle: string,
) {
  assertTransition(TRANSITIONS_DOSSIER, dossier.statut, vers, { regle })
  await updateWithVersion({
    expectedVersion: dossier.version,
    update: (where) =>
      tx.dossier.updateMany({
        where: { id: dossier.id, ...where },
        data: { statut: vers, ...bumpVersion },
      }),
    ...COO.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'DOSSIER',
    entiteId: dossier.contNum,
    ancien: dossier.statut,
    nouveau: vers,
    parId: null,
    motif: CIRCE_AUTOMATIQUE,
    regle,
  })
}

// RG-COO-063 : à l'intégration de la prépa, le dossier passe A_TRAITER → PREPARATION_RECUE (posé par Circé).
// Un renvoi laisse PREPARATION_RECUE (pas de retour à A_TRAITER) ; un dossier annulé n'est pas rouvert.
// RG-COO-030 / 031 : les lignes de la prépa (thème des IP, quantité prépa) sont mises à jour par
// mettreAJourLigneAttendue, qui applique les effets sur les affiches validées dans la même transaction.
export async function integrerPreparation(
  tx: Tx,
  contNum: number,
  lignes: { ligneAttendueId: number; theme?: string | null; qtePrepa?: number | null }[] = [],
) {
  const dossier = await tx.dossier.findUnique({ where: { contNum } })
  if (!dossier) return 'DOSSIER_INCONNU' as const
  if (dossier.statut === 'ANNULE') return 'DOSSIER_ANNULE' as const
  for (const l of lignes) {
    const ligne = await tx.receptionAttendue.findUnique({ where: { id: l.ligneAttendueId } })
    // Une ligne d'un autre dossier n'est jamais modifiée par cette prépa.
    if (ligne?.contNum !== contNum) continue
    await mettreAJourLigneAttendue(
      tx,
      l.ligneAttendueId,
      {
        ...(l.theme !== undefined ? { theme: l.theme } : {}),
        // RG-COO-086 (chemin unifié avec alimenterDepuisPreparation) : une quantité prépa bascule la ligne
        // en source PREPA.
        ...(l.qtePrepa !== undefined ? { qtePrepa: l.qtePrepa, source: 'PREPA' as const } : {}),
      },
      'PREPA',
    )
  }
  const instructions = await tx.instruction.findMany({
    where: { dossierId: dossier.id },
    select: { code: true, statut: true },
  })
  // RG-COO-057 / §3.1.e (ANO-023) : la prépa renvoyée par Broadcast vaut « Corrigé par Broadcast » : les
  // demandes de correction en cours passent FAITE.
  await tx.demandeCorrection.updateMany({
    where: { dossierId: dossier.id, statut: 'ENVOYEE' },
    data: { statut: 'FAITE', faiteLe: new Date() },
  })
  if (dossier.statut === 'PREPARATION_RECUE') {
    // RG-COO-054 (Q-204 b) : renvoi de prépa avant l'export → Instruction OK rouverte (les instructions
    // exportées, PRET_A_PRODUIRE, ne bougent pas : RG-COO-053) ; puis nouvelle évaluation automatique.
    for (const i of instructions.filter((x) => x.statut === 'INSTRUCTION_OK'))
      await rouvrirInstructionOk(tx, i.code)
    for (const i of instructions) await evaluerInstructionOkAuto(tx, i.code)
    return 'DEJA_RECUE' as const
  }
  await changerStatutDossier(tx, dossier, 'PREPARATION_RECUE', 'RG-COO-063')
  await ecrireJournal(tx, {
    typeEntite: 'DOSSIER',
    entiteId: contNum,
    action: 'INTEGRATION_PREPARATION',
    parId: null,
    ancienneValeur: dossier.statut,
    nouvelleValeur: 'PREPARATION_RECUE',
    complement: CIRCE_AUTOMATIQUE,
  })
  // RG-COO-042 (Q-204 b) : Instruction OK automatique dès l'arrivée de la prépa.
  for (const i of instructions) await evaluerInstructionOkAuto(tx, i.code)
  return 'PREPARATION_RECUE' as const
}

// RG-COO-062 / RG-COO-045 / RG-COO-087 / RG-X-065 : vente annulée → dossier ANNULE ; ses lignes attendues
// actives passent ANNULEE (jamais supprimées) ; les affiches déjà reçues RESTENT en stock (aucun mouvement,
// liens conservés) ; tout dans UNE transaction (RG-X-065 « transaction unique »).
export async function annulerDossier(tx: Tx, contNum: number) {
  const dossier = await tx.dossier.findUnique({ where: { contNum } })
  if (!dossier)
    return { resultat: 'DOSSIER_INCONNU' as const, lignesAnnulees: 0, affichesConservees: 0 }
  if (dossier.statut === 'ANNULE') {
    throw new ConflictError(`Le dossier ${String(contNum)} est déjà annulé.`, {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-062',
    })
  }
  await changerStatutDossier(tx, dossier, 'ANNULE', 'RG-COO-062')
  const lignes = await tx.receptionAttendue.findMany({ where: { contNum, etatLigne: 'ACTIVE' } })
  for (const l of lignes) {
    await updateWithVersion({
      expectedVersion: l.version,
      update: (where) =>
        tx.receptionAttendue.updateMany({
          where: { id: l.id, ...where },
          data: { etatLigne: 'ANNULEE', ...bumpVersion },
        }),
      ...COO.version,
    })
    // RG-COO-032 : ligne annulée portant des affiches rattachées → alerte (calculable), liens et
    // validations conservés.
    await effetsLigneModifiee(
      tx,
      { id: l.id, theme: l.theme, qte: l.qteBc, etatLigne: 'ACTIVE' },
      { theme: l.theme, qte: l.qteBc, etatLigne: 'ANNULEE' },
    )
  }
  const affiches = await tx.afficheAttendue.findMany({
    where: { actif: true, ligneAttendueId: { in: lignes.map((l) => l.id) } },
    select: { afficheId: true },
  })
  const conservees = [...new Set(affiches.map((a) => a.afficheId))]
  await ecrireJournal(tx, {
    typeEntite: 'DOSSIER',
    entiteId: contNum,
    action: 'ANNULATION_DOSSIER',
    parId: null,
    ancienneValeur: dossier.statut,
    nouvelleValeur: 'ANNULE',
    complement: CIRCE_AUTOMATIQUE,
    donnees: {
      lignesAnnulees: lignes.map(
        (l) => formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }) + ':' + String(l.id),
      ),
      affichesConserveesEnStock: conservees,
    },
  })
  return {
    resultat: 'ANNULE' as const,
    lignesAnnulees: lignes.length,
    affichesConservees: conservees.length,
  }
}
