// Machines d'états du module Coordination, partie COO-P01 (COORDINATION_REGLES_METIER.md §3.2.b, §3.2.c).
// Toute transition absente est INTERDITE : 409 TRANSITION_INTERDITE (CLAUDE.md §6).
import type { Transitions } from '../../core/state-machine.ts'
import type { StatutDossier, StatutInstruction } from '../../generated/prisma/client.ts'

/**
 * RG-COO-040 — transitions d'instruction demandées par un UTILISATEUR (coord, admin) :
 * A_TRAITER / EN_COURS / INSTRUCTION_OK → ANNULE (RG-COO-045) ; ANNULE → A_TRAITER (RG-COO-045) ;
 * INSTRUCTION_OK → EN_COURS / A_TRAITER (retour arrière, RG-COO-046).
 * EN_COURS → INSTRUCTION_OK (Instruction OK après contrôle, RG-COO-044) ; INSTRUCTION_OK → PRET_A_PRODUIRE est
 * posé par l'export des trains (coo2) ; ERREUR et PRET_A_PRODUIRE n'ont aucune transition utilisateur.
 */
export const TRANSITIONS_INSTRUCTION_UTILISATEUR: Transitions<StatutInstruction> = {
  A_TRAITER: ['ANNULE'],
  EN_COURS: ['ANNULE', 'INSTRUCTION_OK'],
  INSTRUCTION_OK: ['EN_COURS', 'A_TRAITER', 'ANNULE'],
  ERREUR: [],
  ANNULE: ['A_TRAITER'],
  PRET_A_PRODUIRE: [],
}

/**
 * RG-COO-041 — transitions posées par Circé à l'intégration : A_TRAITER → EN_COURS (arrivée des
 * instructions), ERREUR → EN_COURS (intégration suivante). EN_COURS → EN_COURS (renvoi) n'est pas une
 * transition (aucun historique) ; PRET_A_PRODUIRE, ANNULE : renvoi ignoré.
 * Q-204 TRANCHÉE (option b) : EN_COURS → INSTRUCTION_OK automatique (règle de Nariman, RG-COO-042) dès la
 * prépa ; INSTRUCTION_OK → EN_COURS sur renvoi de prépa avant l'export (RG-COO-054).
 */
export const TRANSITIONS_INSTRUCTION_SYSTEME: Transitions<StatutInstruction> = {
  A_TRAITER: ['EN_COURS'],
  EN_COURS: ['INSTRUCTION_OK'],
  INSTRUCTION_OK: ['EN_COURS'],
  ERREUR: ['EN_COURS'],
  ANNULE: [],
  PRET_A_PRODUIRE: [],
}

/** RG-COO-063 / RG-COO-062 — préparation du dossier : posée par Circé seulement ; jamais de retour à A_TRAITER. */
export const TRANSITIONS_DOSSIER: Transitions<StatutDossier> = {
  A_TRAITER: ['PREPARATION_RECUE', 'ANNULE'],
  PREPARATION_RECUE: ['ANNULE'],
  ANNULE: [],
}

/** RG citée par une transition d'instruction demandée par un utilisateur (autorisée ou refusée). */
export function regleTransitionInstruction(de: StatutInstruction, vers: StatutInstruction): string {
  if (vers === 'INSTRUCTION_OK') return 'RG-COO-044'
  if (vers === 'ANNULE' || de === 'ANNULE') return 'RG-COO-045'
  if (de === 'INSTRUCTION_OK' || de === 'PRET_A_PRODUIRE') return 'RG-COO-046'
  return 'RG-COO-040'
}
