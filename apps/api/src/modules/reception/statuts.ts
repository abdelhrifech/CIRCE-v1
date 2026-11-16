// Machines d'états du module Réception (RECEPTION_REGLES_METIER.md §3.2). Toute transition absente
// est INTERDITE : 409 TRANSITION_INTERDITE (CLAUDE.md §6). Chaque transition écrit un historique.
import type { Transitions } from '../../core/state-machine.ts'
import type {
  StatutAffiche,
  StatutLigneAttendue,
  StatutReception,
} from '../../generated/prisma/client.ts'

/**
 * RECEPTION.* — A_IDENTIFIER → A_CONTROLER (rattacher, RG-REC-107/108) ; A_CONTROLER → CONTROLEE
 * (valider le contrôle, RG-REC-069) ; A_CONTROLER / CONTROLEE → A_IDENTIFIER (retrait du dernier dossier,
 * RG-REC-114, HYPOTHÈSE Q-108). Interdits : CONTROLEE → A_CONTROLER (RG-REC-070).
 * La création (∅ → A_CONTROLER ou A_IDENTIFIER) n'est pas une transition (RG-REC-037, 095).
 */
export const TRANSITIONS_RECEPTION: Transitions<StatutReception> = {
  A_IDENTIFIER: ['A_CONTROLER'],
  A_CONTROLER: ['CONTROLEE', 'A_IDENTIFIER'],
  CONTROLEE: ['A_IDENTIFIER'],
}

/** AFFICHE.* — ORPHELINE → IDENTIFIEE (rattacher) ; IDENTIFIEE → ORPHELINE (dernier lien retiré, RG-REC-114). */
export const TRANSITIONS_AFFICHE: Transitions<StatutAffiche> = {
  ORPHELINE: ['IDENTIFIEE'],
  IDENTIFIEE: ['ORPHELINE'],
}

/** RATTACHEMENT : ACTIF → RETIRE seulement ; un lien retiré n'est jamais réactivé (RG-REC-137, RG-COO-088). */
export type EtatRattachement = 'ACTIF' | 'RETIRE'
export const TRANSITIONS_RATTACHEMENT: Transitions<EtatRattachement> = {
  ACTIF: ['RETIRE'],
  RETIRE: [],
}

/** RG citée dans le 409 d'une transition de réception interdite (§3.2 « Transitions interdites notables »). */
export function regleTransitionInterditeReception(
  de: StatutReception,
  vers: StatutReception,
): string | null {
  if (de === 'A_IDENTIFIER' && vers === 'CONTROLEE') return 'RG-REC-071'
  if (de === 'CONTROLEE' && (vers === 'CONTROLEE' || vers === 'A_CONTROLER')) return 'RG-REC-070'
  return null
}

/**
 * LIGNE_ATTENDUE.* (§3.2) : statut CALCULÉ (RG-REC-018) — toute transition entre deux statuts différents
 * est autorisée quand le reçu change (réception, rattachement, retrait, écart de contrôle) ; une
 * « transition » vers le même statut n'existe pas (aucune écriture, aucun historique).
 */
export const TRANSITIONS_LIGNE: Transitions<StatutLigneAttendue> = {
  ATTENDUE: ['PARTIELLE', 'COMPLETE', 'SURPLUS'],
  PARTIELLE: ['ATTENDUE', 'COMPLETE', 'SURPLUS'],
  COMPLETE: ['ATTENDUE', 'PARTIELLE', 'SURPLUS'],
  SURPLUS: ['ATTENDUE', 'PARTIELLE', 'COMPLETE'],
}
