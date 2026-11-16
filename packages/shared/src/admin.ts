import { z } from 'zod'
import { RoleSchema } from './roles.ts'

// Étape 8, lot 2 — Administration minimale nécessaire à Réception et Coordination :
//   D-06 paramètres métier (ECR-ADM-05, EX-TRA-041), D-02 sites et ateliers (ECR-ADM-01, lecture),
//   D-01 utilisateurs, rôles et périmètre (RG-ADM-010 à 017 provisoires, Q-320). Hypothèses : Q-405, Q-406.

const n = z.number().int()

// ───────────────────────────── D-06 : paramètres métier ─────────────────────────────

export type FormatParametre =
  | { type: 'entier'; min: number; max: number; unite?: string }
  | { type: 'decimal'; min: number; max: number }
  | { type: 'enum'; valeurs: readonly string[] }
  /** Liste d'identifiants d'ateliers existants, séparés par « ; » (vide admise). */
  | { type: 'liste-ateliers' }
  /** Liste d'identifiants de types de préparation existants, séparés par « ; » (vide admise). */
  | { type: 'liste-types-preparation' }
  /** Horaires « HH:MM » séparés par « ; » (vide = traitement désactivé : D-20, Q-410). */
  | { type: 'horaires' }
  /** Valeur structurée (couples, horaires, motifs) : affichée, non modifiable sans maquette (Q-405). */
  | { type: 'structure'; raison: string }

export interface DefinitionParametre {
  cle: string
  groupe:
    | 'Réception'
    | 'Coordination'
    | 'Trains'
    | 'Dispatch'
    | 'Alertes'
    | 'Intégration'
    | 'Planification'
  libelle: string
  format: FormatParametre
  /** Source de la règle ou de la valeur (fiche ECR, RG, Q). */
  source: string
}

const STRUCTURE_ECR =
  'Valeur structurée : ECR-ADM-05 la présente en lecture seule, aucun format d’édition n’est maquetté (Q-405)'
const STRUCTURE_INTEGRATION =
  'Configuration technique de l’intégration Broadcast, reprise des identifiants legacy (Q-319, Q-005) : non éditable'

/** Registre des paramètres gérés par l'écran « Règles métier » (ECR-ADM-05). Bornes : HYPOTHÈSE Q-405. */
export const PARAMETRES_ADMIN: readonly DefinitionParametre[] = [
  {
    cle: 'reception.ecartReception',
    groupe: 'Réception',
    libelle: 'Écart signalé au-delà de (%)',
    format: { type: 'decimal', min: 0, max: 100 },
    source: 'ECR-ADM-05 ; RG-REC-178',
  },
  {
    cle: 'reception.purgeAttendues',
    groupe: 'Réception',
    libelle: 'Purge des réceptions attendues après (semaines)',
    format: { type: 'entier', min: 1, max: 52, unite: 'semaines' },
    source: 'ECR-ADM-05 ; RG-REC-178',
  },
  {
    cle: 'reception.delaiControle',
    groupe: 'Réception',
    libelle: 'Délai de contrôle des palettes du sas (heures)',
    format: { type: 'entier', min: 1, max: 720, unite: 'heures' },
    source: 'ECR-ADM-05 ; RG-REC-178',
  },
  {
    cle: 'reception.comptageMorceau',
    groupe: 'Réception',
    libelle: 'Comptage manuel par morceau si quantité inférieure à',
    format: { type: 'entier', min: 0, max: 1000 },
    source: 'ECR-ADM-05 ; RG-REC-178',
  },
  {
    cle: 'reception.exemplairesFeuille',
    groupe: 'Réception',
    libelle: 'Feuilles de stock : exemplaires imprimés au contrôle',
    format: { type: 'entier', min: 1, max: 5 },
    source: 'ECR-ADM-05 (min 1, max 5) ; RG-REC-178',
  },
  {
    cle: 'reception.alleeInconnues',
    groupe: 'Réception',
    libelle: 'Allée des réceptions inconnues',
    format: {
      type: 'structure',
      raison: 'Réglée par site dans l’écran Réception (Q-105) : non modifiable ici',
    },
    source: 'ECR-ADM-05 ; Q-105',
  },
  {
    cle: 'coordination.entretienDefaut',
    groupe: 'Coordination',
    libelle: 'Entretien par défaut (%)',
    format: { type: 'entier', min: 0, max: 100, unite: '%' },
    source: 'RG-COO-048 ; Q-224',
  },
  {
    cle: 'coordination.entretienCampagneControlee',
    groupe: 'Coordination',
    libelle: 'Campagne contrôlée : part en entretien (%)',
    format: { type: 'entier', min: 0, max: 100, unite: '%' },
    source: 'RG-COO-048 ; Q-224 ; ECR-ADM-05 (15 %)',
  },
  {
    cle: 'coordination.plafondThemesExportPrepa',
    groupe: 'Coordination',
    libelle: 'Plafond de thèmes de l’export préparation',
    format: { type: 'entier', min: 1, max: 1000 },
    source: 'RG-COO-216 ; Q-254',
  },
  {
    cle: 'coordination.fenetreSemaines',
    groupe: 'Coordination',
    libelle: 'Fenêtre de semaines d’alimentation des réceptions attendues',
    format: { type: 'entier', min: 1, max: 52, unite: 'semaines' },
    source: 'RG-COO-083',
  },
  {
    cle: 'coordination.seuilThemesProches',
    groupe: 'Coordination',
    libelle: 'Seuil de similarité des thèmes proches (0 à 1)',
    format: { type: 'decimal', min: 0, max: 1 },
    source: 'RG-COO-069, 070 ; ECR-ADM-05 (0,85)',
  },
  {
    cle: 'coordination.destinatairesExclus',
    groupe: 'Coordination',
    libelle: 'Destinataires exclus',
    format: { type: 'structure', raison: STRUCTURE_ECR },
    source: 'RG-COO-093 ; Q-227',
  },
  {
    cle: 'coordination.deadlinePrepa',
    groupe: 'Coordination',
    libelle: 'Échéance de la préparation (S-2, jour, heure)',
    format: { type: 'structure', raison: STRUCTURE_ECR },
    source: 'RG-COO-066, 076',
  },
  {
    cle: 'coordination.deadlineReception',
    groupe: 'Coordination',
    libelle: 'Échéance de la réception (S-2, jour, heure)',
    format: { type: 'structure', raison: STRUCTURE_ECR },
    source: 'RG-COO-076 ; Q-266',
  },
  {
    cle: 'coordination.fenetreRajout',
    groupe: 'Coordination',
    libelle: 'Fenêtres de rajout',
    format: { type: 'structure', raison: STRUCTURE_ECR },
    source: 'RG-COO-073 ; Q-222, Q-266',
  },
  {
    cle: 'coordination.supportsBandeau',
    groupe: 'Coordination',
    libelle: 'Supports à bandeau (support:valeur)',
    format: { type: 'structure', raison: STRUCTURE_ECR },
    source: 'RG-COO-095 ; Q-227',
  },
  {
    cle: 'coordination.regroupementsAnnonceurs',
    groupe: 'Coordination',
    libelle: 'Regroupements d’enseignes (motif:valeur)',
    format: { type: 'structure', raison: STRUCTURE_ECR },
    source: 'ECR-ADM-05 (lecture dans la maquette)',
  },
  {
    cle: 'trains.positionsMax',
    groupe: 'Trains',
    libelle: 'Positions max par train',
    format: { type: 'entier', min: 1, max: 12 },
    source: 'RG-COO-209, 222 ; Q-253 (4 ou 6)',
  },
  {
    cle: 'trains.tiroirsMax',
    groupe: 'Trains',
    libelle: 'Tiroirs max d’un fichier Vendôme',
    format: { type: 'entier', min: 1, max: 100 },
    source: 'ECR-GEN-01 ; Q-254',
  },
  {
    cle: 'trains.themesMaxExportPrepa',
    groupe: 'Trains',
    libelle: 'Plafond de couples (thème, repiquage) de l’export préparation',
    format: { type: 'entier', min: 1, max: 1000 },
    source: 'RG-COO-216 ; Q-254',
  },
  {
    cle: 'trains.ateliersExportPrepa',
    groupe: 'Trains',
    libelle: 'Ateliers autorisés à l’export préparation',
    format: { type: 'liste-ateliers' },
    source: 'RG-COO-215 ; Q-193, Q-319',
  },
  {
    cle: 'trains.entretienGrain',
    groupe: 'Trains',
    libelle: 'Grain du calcul des faces d’entretien',
    format: { type: 'enum', valeurs: ['AFFICHEUR', 'VILLE'] },
    source: 'ECR-ADM-05 ; RG-COO-203 ; Q-256',
  },
  {
    cle: 'trains.entretienSeuil',
    groupe: 'Trains',
    libelle: 'Pas d’entretien en dessous de (affiches)',
    format: { type: 'entier', min: 0, max: 1000 },
    source: 'ECR-ADM-05 (défaut 3) ; RG-COO-203',
  },
  {
    cle: 'trains.entretienArrondi',
    groupe: 'Trains',
    libelle: 'Arrondi du nombre de faces d’entretien',
    format: { type: 'enum', valeurs: ['SUPERIEUR', 'PROCHE'] },
    source: 'ECR-ADM-05 ; RG-COO-203 ; Q-256',
  },
  {
    cle: 'dispatch.seuilDepartHeures',
    groupe: 'Dispatch',
    libelle: 'Train non affecté : critique s’il part dans moins de (heures)',
    format: { type: 'entier', min: 1, max: 720, unite: 'heures' },
    source: 'RG-COO-294, 295 ; Q-276, Q-373',
  },
  {
    cle: 'dispatch.seuilChargePct',
    groupe: 'Dispatch',
    libelle: 'Rouleur chargé au-delà de (% de la moyenne)',
    format: { type: 'entier', min: 1, max: 1000, unite: '%' },
    source: 'RG-COO-295 ; Q-276, Q-373',
  },
  {
    cle: 'alertes.departGraveSemaines',
    groupe: 'Alertes',
    libelle: 'Départ grave : nombre de semaines',
    format: { type: 'entier', min: 0, max: 52, unite: 'semaines' },
    source: 'RG-COO-033 ; Q-190',
  },
  {
    cle: 'alertes.joursEvenements',
    groupe: 'Alertes',
    libelle: 'Durée d’affichage des alertes d’événement (jours)',
    format: { type: 'entier', min: 1, max: 60, unite: 'jours' },
    source: 'Q-190 (3)',
  },
  {
    cle: 'integration.timeoutSecondes',
    groupe: 'Intégration',
    libelle: 'Délai maximal d’un passage d’intégration (secondes)',
    format: { type: 'entier', min: 1, max: 86_400, unite: 'secondes' },
    source: 'RG-COO-117 ; Q-188',
  },
  ...(
    [
      ['integration.horaires', 'Horaires de passage'],
      ['integration.sitesPreparation', 'Sites de préparation'],
      ['integration.statutPrepaEnvoyee', 'Statut « préparation envoyée »'],
      ['integration.typePreparationPliage', 'Type de préparation du pliage'],
      ['integration.typesDeroulants', 'Types de préparation déroulants'],
      ['integration.routagePliage', 'Routage du pliage'],
      ['integration.routageFixe', 'Routage du fixe'],
      ['integration.atelierDeroulant', 'Atelier déroulant par site et type'],
      ['integration.transportParAtelier', 'Transport par atelier'],
      ['integration.typesVisuels', 'Types de visuels'],
      ['integration.formatsRetour', 'Formats du retour Broadcast'],
    ] as const
  ).map(([cle, libelle]): DefinitionParametre => ({
    cle,
    groupe: 'Intégration',
    libelle,
    format: { type: 'structure', raison: STRUCTURE_INTEGRATION },
    source: 'RG-COO-103, 120 à 128, 134 ; Q-005, Q-227',
  })),
  // D-20 (Q-410) : horaires des traitements planifiés ; vide = désactivé (aucune valeur supposée).
  ...(
    [
      ['taches.finJourneeColis', 'Fin de journée des colis (horaires)', 'RG-COO-269 ; Q-005'],
      [
        'taches.purgeAttendues',
        'Purge des réceptions attendues (horaires)',
        'RG-REC-180 ; EX-REC-512 ; Q-005',
      ],
      [
        'taches.instructionOkAuto',
        'Instruction OK automatique : rattrapage (horaires)',
        'RG-COO-042 ; Q-006 ; Q-204',
      ],
      [
        'taches.envoiMails',
        'Envoi des mails en file (horaires)',
        'EX-TRA-030 ; RG-ADM-045 ; Q-375',
      ],
    ] as const
  ).map(([cle, libelle, source]): DefinitionParametre => ({
    cle,
    groupe: 'Planification',
    libelle,
    format: { type: 'horaires' },
    source,
  })),
  {
    cle: 'suivi8m2.ateliers',
    groupe: 'Coordination',
    libelle: 'Ateliers suivis en 8 m²',
    format: { type: 'liste-ateliers' },
    source: 'RG-COO-237 ; Q-195, Q-319',
  },
  {
    cle: 'unitaire.typesPliage',
    groupe: 'Coordination',
    libelle: 'Types de préparation du pliage',
    format: { type: 'liste-types-preparation' },
    source: 'RG-COO-247, 248 ; Q-196, Q-319',
  },
  {
    cle: 'unitaire.typesBus',
    groupe: 'Coordination',
    libelle: 'Types de préparation du bus',
    format: { type: 'liste-types-preparation' },
    source: 'RG-COO-305 ; Q-196, Q-279, Q-319',
  },
  {
    cle: 'colis.ateliersMajoration',
    groupe: 'Coordination',
    libelle: 'Ateliers dont le poids du colis est majoré de 3 kg',
    format: { type: 'liste-ateliers' },
    source: 'RG-COO-263 ; Q-197, Q-319',
  },
]

export const ParametreAdminSchema = z.object({
  cle: z.string(),
  groupe: z.string(),
  libelle: z.string(),
  valeur: z.string(),
  /** Valeur initiale issue des règles (seed) ; jamais une valeur MOCK. */
  valeurParDefaut: z.string(),
  description: z.string().nullable(),
  source: z.string(),
  format: z.object({
    type: z.enum([
      'entier',
      'decimal',
      'enum',
      'liste-ateliers',
      'liste-types-preparation',
      'horaires',
      'structure',
    ]),
    min: z.number().optional(),
    max: z.number().optional(),
    unite: z.string().optional(),
    valeurs: z.array(z.string()).optional(),
    raison: z.string().optional(),
  }),
  modifiable: z.boolean(),
  /** Version de la ligne en base ; 0 tant que la valeur initiale n'a jamais été écrite. */
  version: n,
  modifieLe: z.string().nullable(),
})
export type ParametreAdmin = z.infer<typeof ParametreAdminSchema>
export const ParametresAdminSchema = z.object({ parametres: z.array(ParametreAdminSchema) })

export const ModifierParametreSchema = z.object({
  valeur: z.string().max(500),
  /** Version lue ; 0 si le paramètre n'a jamais été écrit. */
  version: n.min(0),
})
export type ModifierParametre = z.infer<typeof ModifierParametreSchema>

export const HistoriqueParametreSchema = z.object({
  cle: z.string(),
  historique: z.array(
    z.object({
      le: z.string(),
      par: z.string().nullable(),
      ancienneValeur: z.string().nullable(),
      nouvelleValeur: z.string().nullable(),
    }),
  ),
})

// ───────────────────────────── D-02 : sites et ateliers (lecture) ─────────────────────────────

export const AtelierAdminSchema = z.object({
  id: n,
  libelle: z.string(),
  /** FIXE = unitaire (2 m² fixe, pliage) ; SCROLL = trains déroulants (ECR-ADM-01 « Mode »). */
  type: z.enum(['FIXE', 'SCROLL']),
  codeAmt: n.nullable(),
})
export const SiteAdminSchema = z.object({
  id: n,
  nom: z.string(),
  localite: z.string().nullable(),
  mail: z.string().nullable(),
  idSiteCcf: n.nullable(),
  ateliers: z.array(AtelierAdminSchema),
})
export const SitesQuerySchema = z.object({ q: z.string().trim().min(1).max(100).optional() })
/** Les 200 premiers sites par nom ; `total` = nombre de sites correspondant au filtre. */
export const SitesAdminSchema = z.object({ sites: z.array(SiteAdminSchema), total: n })
export type SiteAdmin = z.infer<typeof SiteAdminSchema>

// ───────────────────────────── D-01 : utilisateurs, rôles, périmètre ─────────────────────────────

export const PerimetreEntreeSchema = z.object({
  plateformeId: n.positive(),
  /** Absent = tous les ateliers de la plateforme. */
  atelierId: n.positive().nullable().optional(),
})
export type PerimetreEntree = z.infer<typeof PerimetreEntreeSchema>

const identifiant = z
  .string()
  .trim()
  .min(1, 'Identifiant obligatoire')
  .max(100)
  .regex(/^[^\s;]+$/, 'Ni espace ni point-virgule dans l’identifiant')

export const CreerUtilisateurSchema = z.object({
  identifiantExterne: identifiant,
  nom: z.string().trim().min(1).max(100).optional(),
  roles: z.array(RoleSchema).min(1, 'Au moins un rôle').max(6),
  perimetre: z.array(PerimetreEntreeSchema).max(200).default([]),
})
export type CreerUtilisateur = z.infer<typeof CreerUtilisateurSchema>

export const ModifierUtilisateurSchema = z
  .object({
    version: n,
    nom: z.string().trim().min(1).max(100).nullable().optional(),
    actif: z.boolean().optional(),
    roles: z.array(RoleSchema).min(1, 'Au moins un rôle').max(6).optional(),
    perimetre: z.array(PerimetreEntreeSchema).max(200).optional(),
  })
  .refine(
    (v) =>
      v.nom !== undefined ||
      v.actif !== undefined ||
      v.roles !== undefined ||
      v.perimetre !== undefined,
    'Rien à modifier',
  )
export type ModifierUtilisateur = z.infer<typeof ModifierUtilisateurSchema>

export const UtilisateursQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  role: RoleSchema.optional(),
  actif: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

export const UtilisateurAdminSchema = z.object({
  id: n,
  identifiantExterne: z.string(),
  nom: z.string().nullable(),
  actif: z.boolean(),
  roles: z.array(RoleSchema),
  /** L'administrateur voit tous les sites (RG-COO-167) : son périmètre n'est pas une liste. */
  toutesPlateformes: z.boolean(),
  perimetre: z.array(
    z.object({
      plateformeId: n,
      plateforme: z.string(),
      atelierId: n.nullable(),
      atelier: z.string().nullable(),
    }),
  ),
  version: n,
})
export type UtilisateurAdmin = z.infer<typeof UtilisateurAdminSchema>
/** Les 200 premiers par identifiant ; `total` = nombre de comptes correspondant au filtre. */
export const UtilisateursAdminSchema = z.object({
  utilisateurs: z.array(UtilisateurAdminSchema),
  total: n,
})
