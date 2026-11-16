import { lireSemaineIso, type ControleLigne, type StatutLigne } from '@circe/shared'

/** Libellés de la maquette ECR-REC-01 (statuts RG-REC-018, contrôle RG-REC-019). */
export const LIBELLE_STATUT: Record<StatutLigne, string> = {
  ATTENDUE: 'Attendue',
  PARTIELLE: 'Partielle',
  COMPLETE: 'Complète',
  SURPLUS: 'Surplus',
}

export const LIBELLE_CONTROLE: Record<ControleLigne, string> = {
  RIEN_RECU: 'Rien reçu',
  A_CONTROLER: 'À contrôler',
  CONTROLEE: 'Contrôlée',
}

/** « 2026-W43 » → « S43 » (l'année n'est ajoutée que si elle diffère de l'année de référence). */
export function libelleSemaine(valeur: string, anneeReference: number): string {
  const { annee, semaine } = lireSemaineIso(valeur)
  const s = `S${String(semaine).padStart(2, '0')}`
  return annee === anneeReference ? s : `${s} ${annee}`
}
