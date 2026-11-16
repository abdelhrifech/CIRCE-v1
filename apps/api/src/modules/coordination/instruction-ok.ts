// COO-P02 — Instruction OK : règle de Nariman (RG-COO-042, 133), répartition à 100 % (RG-COO-043), manuelle
// après contrôle (RG-COO-044), grain atelier × plateforme (RG-COO-051), pas avant la prépa (RG-COO-052),
// réouverture sur renvoi de prépa avant l'export (RG-COO-054). Q-204 TRANCHÉE : option (b).
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { effacerCalculTrains } from './instructions.ts'
import { CIRCE_AUTOMATIQUE } from './integration-commun.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import { TRANSITIONS_INSTRUCTION_SYSTEME, TRANSITIONS_INSTRUCTION_UTILISATEUR } from './statuts.ts'
import { calculerTrains } from './trains-calcul.ts'

export interface DonneesNariman {
  commentaire: string | null
  /** Nombre d'exceptions de la prépa (lignes de détail d'instruction, HYPOTHÈSE Q-183 (1)). */
  exceptions: number
  /** Quantité hors entretien (faces non « entretien » de l'instruction, HYPOTHÈSE Q-183 (1)). */
  quantite: number
  repartitionA100: boolean
  /** RG-COO-055 : écart Broadcast / Circé du dossier (null = non calculable). */
  ecart: number | null
}

export type MotifEnCours = 'COMMENTAIRE' | 'EXCEPTIONS' | 'REPARTITION' | 'ECART'

// RG-COO-042 (règle de Nariman, HYPOTHÈSE Q-205) : commentaire vide ET exceptions = quantité hors entretien ET
// répartition à 100 % (RG-COO-043) ; RG-COO-055 : un écart Broadcast / Circé non nul garde l'instruction
// « En cours ». Fonction pure : renvoie les motifs qui empêchent l'Instruction OK automatique.
export function motifsNariman(d: DonneesNariman): MotifEnCours[] {
  const motifs: MotifEnCours[] = []
  if (d.commentaire !== null && d.commentaire.trim() !== '') motifs.push('COMMENTAIRE')
  if (d.exceptions !== d.quantite) motifs.push('EXCEPTIONS')
  if (!d.repartitionA100) motifs.push('REPARTITION')
  if (d.ecart !== null && d.ecart !== 0) motifs.push('ECART')
  return motifs
}

// RG-COO-043 : Σ pourcentages des thèmes = 100 pour chaque couple (dimension, type de préparation) ;
// dimension = support du visuel (HYPOTHÈSE Q-183 (2)) ; sans visuel, rien à répartir (conforme).
export async function repartitionA100(tx: Db | Tx, instructionCode: string): Promise<boolean> {
  const visuels = await tx.instructionVisuel.findMany({
    where: { instructionCode },
    select: { supportId: true, typePreparationId: true, pourcentage: true },
  })
  const sommes = new Map<string, number>()
  for (const v of visuels) {
    const cle = `${String(v.supportId)}|${String(v.typePreparationId)}`
    sommes.set(cle, (sommes.get(cle) ?? 0) + Number(v.pourcentage ?? 0))
  }
  return [...sommes.values()].every((s) => Math.abs(s - 100) < 1e-6)
}

// RG-COO-055 : écart = Σ qte_BC − Σ qte_Circé (prépa) sur les lignes attendues actives du dossier, hors thèmes
// exclus « ne pas afficher / reste en place » (Q-209) ; null tant qu'aucune quantité de prépa n'est connue.
// RG-COO-051 / RG-COO-167 (HYPOTHÈSE Q-183 (11)) : `plateformes` limite l'écart aux lignes d'un site (grain
// atelier × plateforme) ou du périmètre de l'utilisateur ; null = toutes les lignes.
export async function ecartDossier(
  tx: Db | Tx,
  contNum: number,
  plateformes: number[] | null = null,
): Promise<number | null> {
  const lignes = await tx.receptionAttendue.findMany({
    where: {
      contNum,
      etatLigne: 'ACTIVE',
      themeExclu: false,
      ...(plateformes ? { plateformeId: { in: plateformes } } : {}),
    },
    select: { qteBc: true, qtePrepa: true },
  })
  return ecartDeLignes(lignes)
}

/**
 * RG-COO-055 : écart Broadcast / Circé calculé sur des lignes DÉJÀ lues (actives, thème non exclu, du périmètre) ; même
 * calcul que `ecartDossier`, sans requête (ANO-062 : la liste des dossiers ne fait plus une requête par dossier).
 */
export function ecartDeLignes(
  lignes: { qteBc: number | null; qtePrepa: number | null }[],
): number | null {
  if (!lignes.some((l) => l.qtePrepa !== null)) return null
  return lignes.reduce((s, l) => s + (l.qteBc ?? 0) - (l.qtePrepa ?? 0), 0)
}

export async function donneesNariman(
  tx: Db | Tx,
  instruction: {
    code: string
    commentaire: string | null
    contNum: number | null
    atelierId: number | null
  },
): Promise<DonneesNariman> {
  // RG-COO-051 : l'écart d'une instruction se lit sur les lignes de la plateforme de son atelier.
  const atelier =
    instruction.atelierId === null
      ? null
      : await tx.atelier.findUnique({
          where: { id: instruction.atelierId },
          select: { plateformeId: true },
        })
  return {
    commentaire: instruction.commentaire,
    exceptions: await tx.instructionDetail.count({ where: { instructionCode: instruction.code } }),
    quantite: await tx.faceTrain.count({
      where: {
        instructionCode: instruction.code,
        OR: [{ ftType: null }, { NOT: { ftType: 'entretien' } }],
      },
    }),
    repartitionA100: await repartitionA100(tx, instruction.code),
    ecart:
      instruction.contNum === null
        ? null
        : await ecartDossier(tx, instruction.contNum, atelier ? [atelier.plateformeId] : null),
  }
}

type Acteur = { mode: 'MANUEL'; identity: Identity } | { mode: 'AUTO' }

// Passage EN_COURS → INSTRUCTION_OK sous verrou de version, avec historique et journal (RG-COO-061, 160).
// Le calcul des trains déclenché par l'Instruction OK est fait par calculerTrains (COO-P09).
async function passerInstructionOk(tx: Tx, code: string, version: number, acteur: Acteur) {
  const instruction = await tx.instruction.findUnique({
    where: { code },
    include: {
      dossier: { select: { statut: true } },
      atelier: { select: { id: true, plateformeId: true } },
    },
  })
  if (!instruction) throw new NotFoundError(`Instruction ${code} introuvable`)
  if (acteur.mode === 'MANUEL') assertPerimetreAtelier(acteur.identity, instruction.atelier)
  // RG-COO-062 : dossier annulé → sans objet.
  if (instruction.dossier?.statut === 'ANNULE') {
    throw new ConflictError('Dossier annulé : l’instruction est sans objet.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-062',
    })
  }
  const regle = acteur.mode === 'AUTO' ? 'RG-COO-042' : 'RG-COO-044'
  assertTransition(
    acteur.mode === 'AUTO' ? TRANSITIONS_INSTRUCTION_SYSTEME : TRANSITIONS_INSTRUCTION_UTILISATEUR,
    instruction.statut,
    'INSTRUCTION_OK',
    { regle },
  )
  // RG-COO-052 : pas d'Instruction OK avant la prépa.
  if (instruction.dossier?.statut !== 'PREPARATION_RECUE') {
    throw new BusinessError(
      `Instruction ${code} : la prépa n’est pas encore reçue (« À traiter · prépa pas reçue »).`,
      { code: 'COO_PREPA_NON_RECUE', regle: 'RG-COO-052' },
    )
  }
  // RG-COO-043 : répartition des thèmes à 100 %.
  if (!(await repartitionA100(tx, code))) {
    throw new BusinessError('La répartition des thèmes n’est pas à 100 % !', {
      code: 'COO_REPARTITION_INCOMPLETE',
      regle: 'RG-COO-043',
      details: { instruction: code },
    })
  }
  const parId = acteur.mode === 'MANUEL' ? acteur.identity.userId : null
  const nouvelle = await updateWithVersion({
    expectedVersion: version,
    update: (where) =>
      tx.instruction.updateMany({
        where: { code, ...where },
        data: {
          statut: 'INSTRUCTION_OK',
          iokMode: acteur.mode,
          iokParId: parId,
          iokLe: new Date(),
          updatedById: parId,
          ...bumpVersion,
        },
      }),
    ...COO.version,
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: code,
    ancien: instruction.statut,
    nouveau: 'INSTRUCTION_OK',
    parId,
    regle,
    motif:
      acteur.mode === 'AUTO'
        ? 'Instruction ok automatique (règle automatique)'
        : 'Instruction ok après contrôle',
  })
  await ecrireJournal(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: code,
    action: acteur.mode === 'AUTO' ? 'INSTRUCTION_OK_AUTOMATIQUE' : 'INSTRUCTION_OK',
    parId,
    ancienneValeur: instruction.statut,
    nouvelleValeur: 'INSTRUCTION_OK',
    ...(acteur.mode === 'AUTO' ? { complement: CIRCE_AUTOMATIQUE } : {}),
  })
  // RG-COO-200 à 203, 205 (COO-P09) : calcul des trains dans la même transaction.
  await calculerTrains(tx, code, parId)
  return nouvelle
}

// RG-COO-044 / RG-COO-051 : Instruction OK après contrôle, individuelle ou groupée (toutes les instructions
// cochées, en une seule transaction : tout ou rien). RG-COO-001 : aucune garde ne lit la validation admin.
export async function instructionOkManuelle(
  tx: Tx,
  identity: Identity,
  instructions: { code: string; version: number }[],
) {
  assertDroitCoordination(identity, 'instruction.instruction_ok')
  const resultats = []
  for (const i of instructions)
    resultats.push({
      code: i.code,
      version: await passerInstructionOk(tx, i.code, i.version, { mode: 'MANUEL', identity }),
    })
  return {
    instructions: resultats,
    message: `${String(resultats.length)} instruction(s) en Instruction OK : Circé répartit les visuels sur les trains et crée l'entretien. Les trains partent à l'export du jeudi 14 h (Liste des trains).`,
  }
}

// RG-COO-042 (Q-204 option b) : à l'arrivée de la prépa, toute instruction EN_COURS d'un dossier dont la prépa est
// reçue et qui respecte la règle de Nariman passe Instruction OK automatiquement ; sinon elle reste « En cours ».
export async function evaluerInstructionOkAuto(
  tx: Tx,
  code: string,
): Promise<'INSTRUCTION_OK' | MotifEnCours[] | 'NON_APPLICABLE'> {
  const instruction = await tx.instruction.findUnique({
    where: { code },
    include: { dossier: { select: { statut: true } } },
  })
  if (instruction?.statut !== 'EN_COURS' || instruction.dossier?.statut !== 'PREPARATION_RECUE')
    return 'NON_APPLICABLE'
  const motifs = motifsNariman(await donneesNariman(tx, instruction))
  if (motifs.length > 0) return motifs
  await passerInstructionOk(tx, code, instruction.version, { mode: 'AUTO' })
  return 'INSTRUCTION_OK'
}

// RG-COO-054 (Q-204 option b) : renvoi de prépa avant l'export → INSTRUCTION_OK → EN_COURS, Instruction OK
// effacée (`iok`), calcul des trains effacé (RG-COO-046) ; la validation admin ne bouge pas.
export async function rouvrirInstructionOk(tx: Tx, code: string) {
  const instruction = await tx.instruction.findUniqueOrThrow({ where: { code } })
  // RG-COO-054 : seule une instruction en Instruction OK se rouvre (ANO-022).
  if (instruction.statut !== 'INSTRUCTION_OK') {
    throw new ConflictError(`Instruction ${code} : seule une Instruction OK se rouvre.`, {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-054',
    })
  }
  assertTransition(TRANSITIONS_INSTRUCTION_SYSTEME, instruction.statut, 'EN_COURS', {
    regle: 'RG-COO-054',
  })
  await updateWithVersion({
    expectedVersion: instruction.version,
    update: (where) =>
      tx.instruction.updateMany({
        where: { code, ...where },
        data: { statut: 'EN_COURS', iokMode: null, iokParId: null, iokLe: null, ...bumpVersion },
      }),
    ...COO.version,
  })
  const effacement = await effacerCalculTrains(tx, code, 'EN_COURS')
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: code,
    ancien: 'INSTRUCTION_OK',
    nouveau: 'EN_COURS',
    parId: null,
    motif: CIRCE_AUTOMATIQUE,
    regle: 'RG-COO-054',
  })
  await ecrireJournal(tx, {
    typeEntite: 'INSTRUCTION',
    entiteId: code,
    action: 'REOUVERTURE_INSTRUCTION_OK',
    parId: null,
    ancienneValeur: 'INSTRUCTION_OK',
    nouvelleValeur: 'EN_COURS',
    complement: CIRCE_AUTOMATIQUE,
    donnees: effacement,
  })
  return effacement
}
