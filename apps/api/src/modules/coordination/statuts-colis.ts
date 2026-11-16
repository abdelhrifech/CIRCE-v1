// Machines d'états du colisage (COORDINATION_REGLES_METIER.md Partie B §3.2 « Colis », « UM », « Face de train »,
// COO-P13). Toute transition absente est INTERDITE : 409 TRANSITION_INTERDITE (CLAUDE.md §6, RG-COO-307).
import type { Transitions } from '../../core/state-machine.ts'
import type { StatutProduction } from '../../generated/prisma/client.ts'

const AUCUN: readonly StatutProduction[] = []

function table(
  def: Partial<Record<StatutProduction, readonly StatutProduction[]>>,
): Transitions<StatutProduction> {
  return {
    A_TRAITER: AUCUN,
    EN_COURS: AUCUN,
    INSTRUCTION_OK: AUCUN,
    ERREUR: AUCUN,
    ANNULE: AUCUN,
    A_IMPRIMER: AUCUN,
    PREPARE: AUCUN,
    A_EXPEDIER: AUCUN,
    TERMINE: AUCUN,
    EXPORT_PREPA: AUCUN,
    AU_ROULAGE: AUCUN,
    ...def,
  }
}

/**
 * §3.2 « Colis » : 1 (En cours, cible « Colis ouvert ») → 7 (A expédier, « Clos ») par « Expédier » (RG-COO-268) ;
 * 7 → 8 (Terminé, « Expédié ») par la fin de journée (RG-COO-269). Un colis clos ne se rouvre pas (décision du
 * 16/10, RG-COO-266, Q-272) : aucune transition 7 / 8 → 1.
 */
export const TRANSITIONS_COLIS = table({ EN_COURS: ['A_EXPEDIER'], A_EXPEDIER: ['TERMINE'] })

/**
 * §3.2 « UM » côté colisage : 1 / 6 → 6 (ajout au colis, RG-COO-265), 6 → 1 (retrait du dernier colis,
 * RG-COO-267), 1 / 6 → 7 (colis expédié, RG-COO-268), 7 → 8 (fin de journée, RG-COO-269). Le reste (1 → 6
 * « Préparer », 1 / 6 → 4 déblocage) est dans TRANSITIONS_UM (COO-P12).
 */
export const TRANSITIONS_UM_COLISAGE = table({
  EN_COURS: ['PREPARE', 'A_EXPEDIER'],
  PREPARE: ['EN_COURS', 'A_EXPEDIER'],
  A_EXPEDIER: ['TERMINE'],
})

/**
 * Face de train sortie d'un colis (RG-COO-267 / 270, HYPOTHÈSE Q-197 (4)) : retour au statut d'avant l'ajout
 * (5, 9 ou 10) ; les autres transitions de la face sont dans TRANSITIONS_FACE (statuts-trains.ts).
 */
export const TRANSITIONS_FACE_RETRAIT_COLIS = table({
  A_EXPEDIER: ['A_IMPRIMER', 'EXPORT_PREPA', 'AU_ROULAGE'],
})

/** Statuts de face qui peuvent entrer dans un colis (RG-COO-270, §3.2 : 5, 9 et 10 → 7). */
export const STATUTS_FACE_COLISABLES: readonly StatutProduction[] = [
  'A_IMPRIMER',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]

/** RG-COO-265 : seules les UM « En cours » (1) ou « Préparé » (6) entrent dans un colis. */
export const STATUTS_UM_COLISABLES: readonly StatutProduction[] = ['EN_COURS', 'PREPARE']
