// Machine d'états des faces de train (COORDINATION_REGLES_METIER.md Partie B §3.2, « Face de train »).
// Toute transition absente est INTERDITE : 409 TRANSITION_INTERDITE (CLAUDE.md §6, RG-COO-307).
import type { StatutUnite } from '@circe/shared'
import type { Transitions } from '../../core/state-machine.ts'
import type { StatutInstruction, StatutProduction } from '../../generated/prisma/client.ts'

/**
 * Faces de train (`tf_face_train.rpc_statut`) :
 * 0 / 1 / 3 → 2 (Instruction OK, RG-COO-200 à 203) ; 2 → 0 / 1 / 4 (retour arrière, RG-COO-206) ;
 * 2 → 5 (export RG-COO-210, « Changer statut » RG-COO-218) ; 2 / 5 → 4 (anti-doublon RG-COO-205, suppression
 * RG-COO-225, annulation de thème RG-COO-219 depuis 5) ; 5 → 2 (débloquer semaine RG-COO-220) ;
 * 5 → 9 (export préparation RG-COO-215) ; 5 / 9 → 10 (au roulage RG-COO-217, 218) ; 10 / 9 → 5 (« Changer
 * statut : A imprimer », RG-COO-218) ; 5 / 9 / 10 → 7 (colis RG-COO-270) ; 7 → 8 (fin de journée RG-COO-269).
 */
export const TRANSITIONS_FACE: Transitions<StatutProduction> = {
  A_TRAITER: ['INSTRUCTION_OK'],
  EN_COURS: ['INSTRUCTION_OK'],
  ERREUR: ['INSTRUCTION_OK'],
  INSTRUCTION_OK: ['A_TRAITER', 'EN_COURS', 'ANNULE', 'A_IMPRIMER'],
  A_IMPRIMER: ['INSTRUCTION_OK', 'ANNULE', 'EXPORT_PREPA', 'AU_ROULAGE', 'A_EXPEDIER'],
  EXPORT_PREPA: ['AU_ROULAGE', 'A_IMPRIMER', 'A_EXPEDIER'],
  AU_ROULAGE: ['A_IMPRIMER', 'A_EXPEDIER'],
  A_EXPEDIER: ['TERMINE'],
  PREPARE: [],
  TERMINE: [],
  ANNULE: [],
}

/**
 * RG-COO-218 : « Changer statut » demandé par l'utilisateur, contrôlé côté serveur (le legacy ne contrôlait
 * que le front). Liste des trains : 2 → 5 et 5 → 10 ; Préparation : 10 / 5 / 9 → 5.
 */
export const CHANGER_STATUT_LISTE: Transitions<StatutProduction> = {
  A_TRAITER: [],
  EN_COURS: [],
  ERREUR: [],
  INSTRUCTION_OK: ['A_IMPRIMER'],
  A_IMPRIMER: ['AU_ROULAGE'],
  EXPORT_PREPA: [],
  AU_ROULAGE: [],
  A_EXPEDIER: [],
  PREPARE: [],
  TERMINE: [],
  ANNULE: [],
}
export const CHANGER_STATUT_PREPARATION: Transitions<StatutProduction> = {
  A_TRAITER: [],
  EN_COURS: [],
  ERREUR: [],
  INSTRUCTION_OK: [],
  A_IMPRIMER: ['A_IMPRIMER'],
  EXPORT_PREPA: ['A_IMPRIMER'],
  AU_ROULAGE: ['A_IMPRIMER'],
  A_EXPEDIER: [],
  PREPARE: [],
  TERMINE: [],
  ANNULE: [],
}

/**
 * HYPOTHÈSE Q-250 : statut de l'unité de production (train) déduit du statut de ses faces ; en amont de la
 * production (faces 2 ou 5), EN_ATTENTE / PRET selon la couverture des visuels (RG-COO-208, Q-251).
 * 9 / 10 → EN_PROD ; 6 → PRODUIT ; 7 → COLISE ; 8 → EXPEDIE (LIVRE : preuve de livraison, module EXP).
 */
export function statutUnite(statuts: readonly StatutProduction[], couvert: boolean): StatutUnite {
  if (statuts.includes('TERMINE')) return 'EXPEDIE'
  if (statuts.includes('A_EXPEDIER')) return 'COLISE'
  if (statuts.includes('PREPARE')) return 'PRODUIT'
  if (statuts.includes('AU_ROULAGE') || statuts.includes('EXPORT_PREPA')) return 'EN_PROD'
  return couvert ? 'PRET' : 'EN_ATTENTE'
}

/**
 * RG-COO-220 : « Débloquer semaine » : instruction PRET_A_PRODUIRE (5, posée par l'export) → INSTRUCTION_OK (2).
 * Seule transition d'instruction propre aux trains ; les autres sont dans statuts.ts (COO-P01).
 */
export const TRANSITIONS_INSTRUCTION_TRAINS: Transitions<StatutInstruction> = {
  A_TRAITER: [],
  EN_COURS: [],
  INSTRUCTION_OK: [],
  ERREUR: [],
  ANNULE: [],
  PRET_A_PRODUIRE: ['INSTRUCTION_OK'],
}

/**
 * RG-COO-210 / 211 : l'export des trains du jeudi pose l'instruction « Prêt à produire » (5) ; seule transition
 * d'instruction propre à l'export (le retour 5 → 2 est TRANSITIONS_INSTRUCTION_TRAINS, RG-COO-220).
 */
export const TRANSITIONS_INSTRUCTION_EXPORT: Transitions<StatutInstruction> = {
  A_TRAITER: [],
  EN_COURS: [],
  INSTRUCTION_OK: ['PRET_A_PRODUIRE'],
  ERREUR: [],
  ANNULE: [],
  PRET_A_PRODUIRE: [],
}
