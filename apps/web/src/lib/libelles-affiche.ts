import type { Ton } from '../components/ui/pastille.tsx'

// Libellés de la maquette (ECR-REC-03 / 04 / 05) pour les codes de l'API.
export const LIBELLE_TAG: Record<string, { libelle: string; ton: Ton }> = {
  FEUILLE_A_IMPRIMER: { libelle: 'Feuille à imprimer', ton: 'surveiller' },
  A_CONTROLER: { libelle: 'À contrôler', ton: 'surveiller' },
  RECEPTION_INCONNUE: { libelle: 'Réception inconnue', ton: 'info' },
  COMPLEMENT: { libelle: 'Complément', ton: 'surveiller' },
  FEUILLE_A_REFAIRE: { libelle: 'Feuille à refaire', ton: 'surveiller' },
}

export const LIBELLE_STATUT_INCONNUE: Record<string, { libelle: string; ton: Ton }> = {
  A_IDENTIFIER: { libelle: 'À identifier', ton: 'surveiller' },
  INTROUVABLE: { libelle: 'Introuvable : alerte à la Coordination', ton: 'important' },
  RATTACHEE_A_CONTROLER: { libelle: 'Rattachée, à contrôler', ton: 'surveiller' },
  CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER: {
    libelle: 'Contrôlée, feuille définitive à imprimer',
    ton: 'surveiller',
  },
  RATTACHEE_FEUILLE_DEFINITIVE: { libelle: 'Rattachée, feuille définitive', ton: 'ok' },
}

export const LIBELLE_MOUVEMENT: Record<string, string> = {
  RECEPTION: 'Réception',
  COMPLEMENT: 'Réception (complément)',
  ECART_CONTROLE: 'Contrôle (écart au BL)',
  MISE_AU_REBUT: 'Mise au rebut',
  AJOUT_MANUEL: 'Ajout manuel',
  SORTIE_MANUELLE: 'Sortie manuelle',
  EXPEDITION: 'Expédition',
  FUSION: 'Fusion',
  RENVOI: 'Renvoi',
  DESTRUCTION: 'Destruction',
}

export const LIBELLE_STATUT_RECEPTION: Record<string, { libelle: string; ton: Ton }> = {
  A_IDENTIFIER: { libelle: 'À identifier par la Coordination (zone tampon)', ton: 'important' },
  A_CONTROLER: { libelle: 'Palette à contrôler', ton: 'surveiller' },
  CONTROLEE: { libelle: 'Contrôlée', ton: 'ok' },
}

/** Départs « S43+S44 » à partir des semaines ISO « 2026-W43 ». */
export const departs = (semaines: string[]) =>
  semaines.map((s) => `S${s.slice(-2)}`).join('+') || '—'
