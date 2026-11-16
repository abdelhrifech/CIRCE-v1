import type { Ton } from '../ui/pastille.tsx'

// Libellés de la maquette ECR-COO-01 / 02 pour les codes de l'API.
export const PREPARATION: Record<string, { libelle: string; ton: Ton }> = {
  A_TRAITER: { libelle: 'Pas encore envoyée', ton: 'info' },
  PREPARATION_RECUE: { libelle: 'Reçue', ton: 'ok' },
  ANNULE: { libelle: 'Annulé', ton: 'neutre' },
}

export const INSTRUCTION: Record<string, { libelle: string; ton: Ton }> = {
  A_TRAITER: { libelle: 'À traiter · prépa pas reçue', ton: 'info' },
  EN_COURS: { libelle: 'En cours', ton: 'surveiller' },
  INSTRUCTION_OK: { libelle: 'Instruction ok', ton: 'ok' },
  ERREUR: { libelle: 'Erreur', ton: 'important' },
  ANNULE: { libelle: 'Annulé', ton: 'neutre' },
  PRET_A_PRODUIRE: { libelle: 'Prêt à produire', ton: 'ok' },
}

export const MOTIF: Record<string, string> = {
  COMMENTAIRE: 'commentaire',
  EXCEPTIONS: 'exceptions ≠ quantité',
  REPARTITION: 'répartition ≠ 100 %',
  ECART: 'écart',
}

export const POSITION: Record<number, string> = {
  0: 'Standard',
  1: 'Début de train',
  2: 'Fin de train',
  3: 'Fin de train − 1',
  4: 'Milieu de train',
}

/** Libellé de l'Instruction OK selon le mode (RG-COO-042 / 044) et les motifs « En cours ». */
export function libelleInstruction(
  i: { statut: string; iokMode: 'AUTO' | 'MANUEL' | null; motifs: string[] },
  preparation: string,
): string {
  // RG-COO-052 / maquette `C.instrOK` = ATTENTE : prépa pas reçue → « À traiter · prépa pas reçue ».
  if (
    (i.statut === 'EN_COURS' || i.statut === 'A_TRAITER') &&
    preparation !== 'PREPARATION_RECUE'
  ) {
    return 'À traiter · prépa pas reçue'
  }
  if (i.statut === 'INSTRUCTION_OK') {
    return i.iokMode === 'AUTO' ? 'Instruction ok · automatique' : 'Instruction ok · après contrôle'
  }
  if (i.statut === 'EN_COURS' && i.motifs.length > 0) {
    return `En cours · ${i.motifs.map((m) => MOTIF[m] ?? m).join(', ')}`
  }
  return INSTRUCTION[i.statut]?.libelle ?? i.statut
}

export const semaine = (iso: string) => `S${iso.slice(-2)}`

/** Libellés métier des actions du journal (frise de la fiche dossier, RG-COO-160). */
export const ACTION_HISTORIQUE: Record<string, string> = {
  CHANGEMENT_STATUT_INSTRUCTION: 'Changement de statut',
  INSTRUCTION_OK: 'Instruction ok (après contrôle)',
  INSTRUCTION_OK_AUTOMATIQUE: 'Instruction ok (automatique)',
  REOUVERTURE_INSTRUCTION_OK: 'Instruction ok rouverte (renvoi de prépa)',
  MODIFICATION_INSTRUCTION_PLUS: 'Modification',
  INTEGRATION_INSTRUCTION: 'Intégration Broadcast',
  INTEGRATION_PREPARATION: 'Préparation reçue',
  RENVOI_BROADCAST_IGNORE: 'Renvoi Broadcast ignoré',
  ANNULATION_DOSSIER: 'Dossier annulé',
  APPLICATION_VERSION_BROADCAST: 'Version Broadcast appliquée',
  DEMANDE_CORRECTION_BROADCAST: 'Correction demandée à Broadcast',
  VALIDATION_ADMIN: 'Validation admin confirmée',
  ANNULATION_VALIDATION_ADMIN: 'Validation admin annulée',
}

/** RG-COO-007 : état de validation d'une affiche (libellés et teintes de la maquette). */
export const ETAT_VALIDATION: Record<string, { libelle: string; ton: Ton }> = {
  VALIDEE: { libelle: 'Validée par la Coordination', ton: 'ok' },
  A_CONFIRMER_PROPOSE: { libelle: 'À confirmer : rattachement proposé', ton: 'info' },
  A_CONFIRMER_DOUTE: { libelle: 'À confirmer : doute', ton: 'surveiller' },
  RECEPTION_INCONNUE: { libelle: 'Réception inconnue', ton: 'important' },
}

/** RG-COO-006 : libellés des motifs de doute. */
export const MOTIF_DOUTE: Record<string, string> = {
  BL: 'Rattachée sans le n° du BL',
  FORMAT: 'Format différent',
  THEME: 'Plusieurs thèmes possibles',
  MULTI: 'Répartition à confirmer',
  SANS_IP: 'IP pas saisies',
  ANNULEE: 'Validation annulée : à refaire',
  LIGNE_FERMEE: 'Ligne attendue fermée : à re-rattacher',
}

/** RG-COO-019 : pastille « Validation admin » du dossier. */
export function pastilleValidation(v: { etat: string; aConfirmer: number; doutes: number }): {
  libelle: string
  ton: Ton
} {
  if (v.etat === 'SANS_OBJET') return { libelle: '—', ton: 'neutre' }
  if (v.etat === 'VALIDEE') return { libelle: 'Validée', ton: 'ok' }
  if (v.etat === 'AUCUNE_AFFICHE_RECUE') return { libelle: 'Aucune affiche reçue', ton: 'info' }
  return {
    libelle: `À confirmer (${String(v.aConfirmer)}${v.doutes ? `, dont ${String(v.doutes)} ${v.doutes > 1 ? 'doutes' : 'doute'}` : ''})`,
    ton: v.doutes ? 'surveiller' : 'info',
  }
}
