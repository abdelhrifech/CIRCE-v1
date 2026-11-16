import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'

// COO-P07 — Pilotage › Alertes (ECR-TRA-01, transverse) : alertes Réception (RG-REC-182 à 189) et
// Coordination / Pré-Prod (RG-COO-030 à 033, 053, 066 à 075, 086, 103, 116, 122), et Vérification des thèmes
// (ECR-THM-01 / 02 / 03, RG-COO-068 à 070).

const n = z.number().int()

/** ECR-TRA-01 (maquette `TYPES`) + `INTEGRATION` (alertes techniques RG-COO-103 / 116 / 122 / 081, sans
 * type dans la maquette : HYPOTHÈSE Q-190 (6)). */
export const TYPES_ALERTE = [
  'NC_BLOQUANTE',
  'MANQUANT',
  'ECART',
  'SANS_IP',
  'ORPHELINE',
  'DOSSIER_INTROUVABLE',
  'VALIDATION_ADMIN',
  'CONTROLE_RETARD',
  'IP_MANQUANTES',
  'ECART_BC',
  'THEMES_PROCHES',
  'ANNONCEURS_PROCHES',
  'THEME_BC',
  'DM_FICHIER',
  'APRES_LIBERATION',
  'DEPART_RISQUE',
  'THEME_MODIF',
  'FEUILLE_DEFINITIVE',
  'INTEGRATION',
] as const
export const TypeAlerteSchema = z.enum(TYPES_ALERTE)
export type TypeAlerte = z.infer<typeof TypeAlerteSchema>

/** Libellés des types (maquette `TYPES`, mot pour mot). */
export const LIBELLES_TYPES_ALERTE: Record<TypeAlerte, string> = {
  NC_BLOQUANTE: 'Non-conformité bloquante à la réception',
  MANQUANT: 'Visuel manquant ou partiel',
  ECART: 'Écart de réception > 10 %',
  SANS_IP: 'Réception sans IP',
  ORPHELINE: 'Réception inconnue à identifier',
  DOSSIER_INTROUVABLE: 'Réception inconnue : dossier introuvable',
  VALIDATION_ADMIN: 'Validation admin à confirmer (doute)',
  CONTROLE_RETARD: 'Palette à contrôler en retard',
  IP_MANQUANTES: 'Préparation non reçue',
  ECART_BC: 'Écart Broadcast / Circé',
  THEMES_PROCHES: 'Thèmes proches à vérifier',
  ANNONCEURS_PROCHES: 'Annonceurs proches à vérifier',
  THEME_BC: 'Thème modifié dans Broadcast',
  DM_FICHIER: 'Dernière minute sur fichier envoyé',
  APRES_LIBERATION: 'Rajout après préparation',
  DEPART_RISQUE: 'Départ camion à risque',
  THEME_MODIF: 'Feuille de stock à refaire',
  FEUILLE_DEFINITIVE: 'Feuille de stock définitive à imprimer',
  INTEGRATION: 'Intégration Broadcast',
}

/** Gravités de la maquette (`SEVS`) : critical, serious (« Important », Q-220), warning, info. */
export const GRAVITES_ALERTE = ['CRITIQUE', 'IMPORTANT', 'A_SURVEILLER', 'INFORMATION'] as const
export const GraviteAlerteSchema = z.enum(GRAVITES_ALERTE)
export type GraviteAlerte = z.infer<typeof GraviteAlerteSchema>
export const LIBELLES_GRAVITES: Record<GraviteAlerte, { libelle: string; sous: string }> = {
  CRITIQUE: { libelle: 'Critiques', sous: 'à traiter tout de suite' },
  IMPORTANT: { libelle: 'Importantes', sous: 'dans la journée' },
  A_SURVEILLER: { libelle: 'À surveiller', sous: 'avant le départ' },
  INFORMATION: { libelle: 'Pour information', sous: '' },
}

export const AlertePilotageSchema = z.object({
  /** Clé stable par objet (dédoublonnage, acquittement) : `VA-<affiche>`, `PP-<dossier>`… */
  cle: z.string(),
  type: TypeAlerteSchema,
  regle: z.string(),
  gravite: GraviteAlerteSchema,
  titre: z.string(),
  message: z.string(),
  lien: z.string(),
  /** Rôles destinataires (non filtrant à l'écran, maquette `roles`). */
  destinataires: z.array(z.string()),
  plateformeId: n.nullable(),
  site: z.string().nullable(),
  /** Semaine de départ ISO (« 2026-W43 ») ou null (alertes sans semaine). */
  depart: z.string().nullable(),
  /** Échéance ou date de l'événement (ISO). */
  date: z.string().nullable(),
  dossiers: z.array(n),
  acquittee: z.object({ par: z.string().nullable(), le: z.string() }).nullable(),
})
export type AlertePilotage = z.infer<typeof AlertePilotageSchema>

const liste = <T extends z.ZodType<string, string>>(item: T) =>
  z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(item))

export const ListeAlertesQuerySchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  /** Semaines de départ (« 2026-W43,2026-W44 ») ; les alertes sans semaine restent affichées. */
  depart: liste(SemaineIsoSchema).optional(),
  gravite: liste(GraviteAlerteSchema).optional(),
  type: liste(TypeAlerteSchema).optional(),
  etat: z.enum(['OUVERTES', 'ACQUITTEES']).default('OUVERTES'),
  site: z.coerce.number().int().optional(),
})
export type ListeAlertesQuery = z.infer<typeof ListeAlertesQuerySchema>

export const ListeAlertesSchema = z.object({
  alertes: z.array(AlertePilotageSchema),
  /** Indicateurs par gravité (tous les filtres sauf la gravité, maquette `F.except`). */
  parGravite: z.record(GraviteAlerteSchema, n),
  /** Pastilles par type (tous les filtres sauf le type). */
  parType: z.record(TypeAlerteSchema, n),
  /** Semaines de départ proposées par défaut (S et S+1, maquette). */
  departsParDefaut: z.array(z.string()),
  peutAcquitter: z.boolean(),
})
export type ListeAlertes = z.infer<typeof ListeAlertesSchema>

export const AcquitterAlertesSchema = z.object({
  cles: z.array(z.string().min(1).max(200)).min(1).max(500),
})
export const AcquitterAlertesResultatSchema = z.object({
  acquittees: n,
  message: z.string(),
})

// ── Vérification des thèmes (ECR-THM-01 / 02 / 03) ──

export const STATUTS_VERIFICATION = [
  'A_VERIFIER',
  'DEMANDE_ENVOYEE',
  'CORRIGE',
  'DIFFERENTS',
  'MEME_INTITULE',
] as const
export const StatutVerificationSchema = z.enum(STATUTS_VERIFICATION)
export type StatutVerification = z.infer<typeof StatutVerificationSchema>

const DossierGroupeSchema = z.object({
  contNum: n,
  annonceur: z.string().nullable(),
  depart: z.string().nullable(),
  /** Libellé de la préparation (Pas encore envoyée / Reçue / Annulé). */
  preparation: z.string(),
  productionLancee: z.boolean(),
  /** Intitulé (thème ou nom) du dossier dans ce groupe. */
  libelles: z.array(z.string()),
  /** Demande en cours sur ce dossier (ancien → nouveau). */
  demande: z
    .object({ ancien: z.string(), nouveau: z.string(), le: z.string(), statut: z.string() })
    .nullable(),
})

export const GroupeThemesSchema = z.object({
  cle: z.string(),
  statut: StatutVerificationSchema,
  annonceur: z.string(),
  libelles: z.array(z.object({ libelle: z.string(), themes: n, dossiers: n })),
  dossiers: z.array(DossierGroupeSchema),
  depart: z.string().nullable(),
  verdict: z.object({ par: z.string().nullable(), le: z.string() }).nullable(),
})
export type GroupeThemes = z.infer<typeof GroupeThemesSchema>

export const ListeThemesProchesSchema = z.object({
  groupes: z.array(GroupeThemesSchema),
  indicateurs: z.object({
    aVerifier: n,
    demandesEnvoyees: n,
    memeIntitule: n,
    dejaTraites: n,
  }),
  seuil: z.number(),
})
export type ListeThemesProches = z.infer<typeof ListeThemesProchesSchema>

export const GroupeAnnonceursSchema = z.object({
  cle: z.string(),
  statut: StatutVerificationSchema,
  noms: z.array(z.object({ nom: z.string(), origine: z.enum(['BROADCAST', 'PLATEFORME']) })),
  dossiers: z.array(DossierGroupeSchema),
  depart: z.string().nullable(),
  verdict: z.object({ par: z.string().nullable(), le: z.string() }).nullable(),
})
export const ListeAnnonceursProchesSchema = z.object({
  groupes: z.array(GroupeAnnonceursSchema),
  indicateurs: z.object({ aVerifier: n, demandesEnvoyees: n, dejaTraites: n }),
})
export type ListeAnnonceursProches = z.infer<typeof ListeAnnonceursProchesSchema>

export const ThemeModifieBroadcastSchema = z.object({
  /** Ligne attendue dont le thème Broadcast a changé après la validation. */
  ligneAttendueId: n,
  contNum: n.nullable(),
  annonceur: z.string().nullable(),
  atelier: z.string().nullable(),
  depart: z.string(),
  themeCirce: z.string().nullable(),
  themeBroadcast: z.string().nullable(),
  productionLancee: z.boolean(),
  affiches: z.array(n),
  version: n,
  /** Colonne masquée « Statut pré-production » (ECR-THM-03). */
  preparation: z.string(),
})
export const ListeThemesModifiesSchema = z.object({
  lignes: z.array(ThemeModifieBroadcastSchema),
  indicateurs: z.object({ total: n, productionLancee: n, avantProduction: n }),
})
export type ListeThemesModifies = z.infer<typeof ListeThemesModifiesSchema>

export const ListeVerificationQuerySchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  depart: SemaineIsoSchema.optional(),
  /** TRAITES = « Déjà traités » (corrigés par Broadcast ou différents). */
  etat: z
    .enum([
      'A_VERIFIER',
      'DEMANDE_ENVOYEE',
      'CORRIGE',
      'DIFFERENTS',
      'MEME_INTITULE',
      'TRAITES',
      'TOUS',
    ])
    .default('A_VERIFIER'),
  annonceur: z.string().trim().optional(),
  production: z.enum(['LANCEE', 'AVANT']).optional(),
  /** « + Filtre » Atelier (ECR-THM-01 / 03). */
  atelierId: z.coerce.number().int().optional(),
})
export type ListeVerificationQuery = z.infer<typeof ListeVerificationQuerySchema>

export const DemanderCorrectionThemeSchema = z.object({
  type: z.enum(['THEMES', 'ANNONCEURS']),
  cle: z.string().min(1).max(2000),
  /** Intitulé (ou nom) retenu comme correct. */
  correct: z.string().trim().min(1).max(250),
  note: z.string().trim().max(1000).default(''),
})
export type DemanderCorrectionTheme = z.infer<typeof DemanderCorrectionThemeSchema>

export const VerdictVerificationSchema = z.object({
  type: z.enum(['THEMES', 'ANNONCEURS']),
  cle: z.string().min(1).max(2000),
  /** DIFFERENTS = « Visuels différents » / « Annonceurs différents » ; ROUVRIR = « Rouvrir ». */
  verdict: z.enum(['DIFFERENTS', 'ROUVRIR']),
})
export type VerdictVerification = z.infer<typeof VerdictVerificationSchema>

export const ResultatVerificationSchema = z.object({ message: z.string(), dossiers: n })

export const ReprendreThemeBroadcastSchema = z.object({ version: n })
/** RG-COO-068 : reprise groupée de toutes les lignes modifiées d'un dossier (ECR-COO-02), une transaction. */
export const ReprendreThemesDossierSchema = z.object({
  contNum: n,
  lignes: z.array(z.object({ ligneAttendueId: n, version: n })).min(1),
})
export type ReprendreThemesDossier = z.infer<typeof ReprendreThemesDossierSchema>
export const ReprendreThemeBroadcastResultatSchema = z.object({
  message: z.string(),
  affiches: n,
  productionLancee: z.boolean(),
  mailEnvoye: z.boolean(),
})
