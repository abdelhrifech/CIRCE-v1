import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'

// COO-P09 — Trains : identifiant, positions, faces, couverture, fractionnement, liste ECR-COO-05 (RG-COO-200 à
// 209, 218 à 229, 307, 308). L'« unité de production » (le train) est CALCULÉE à partir des faces
// (`tf_face_train`) : HYPOTHÈSE Q-250 ; son statut à 7 valeurs se déduit du statut des faces et de la
// couverture des visuels (RG-COO-208, Q-251).

const n = z.number().int()
const nn = n.nullable()
const s = z.string().nullable()

/** Statut d'unité de la cible (maquette `M.STATUTS`, ECR-ADM-03) ; correspondance legacy : Q-250. */
export const STATUTS_UNITE = [
  'EN_ATTENTE',
  'PRET',
  'EN_PROD',
  'PRODUIT',
  'COLISE',
  'EXPEDIE',
  'LIVRE',
] as const
export const StatutUniteSchema = z.enum(STATUTS_UNITE)
export type StatutUnite = z.infer<typeof StatutUniteSchema>

/** RG-COO-223 : point de non-retour (EN_PROD et au-delà). */
export const STATUTS_UNITE_EN_PRODUCTION: readonly StatutUnite[] = [
  'EN_PROD',
  'PRODUIT',
  'COLISE',
  'EXPEDIE',
  'LIVRE',
]

/** Origine d'un train : calculé à l'Instruction OK, train d'entretien calculé, ou créé par la Coordination. */
export const ORIGINES_TRAIN = ['CALCULE', 'ENTRETIEN', 'PRE_TEST', 'ENTRETIEN_AJOUTE'] as const
export const OrigineTrainSchema = z.enum(ORIGINES_TRAIN)

/** État d'une position (pastille A, B, C… : reçu, manquant, fractionné). */
export const EtatPositionSchema = z.enum(['OK', 'MANQUANT', 'FRACTIONNE'])
export type EtatPosition = z.infer<typeof EtatPositionSchema>

/** RG-COO-225 : motifs de suppression d'un train (ECR-COO-05e). */
export const MOTIFS_SUPPRESSION_TRAIN = [
  'Affichage qui ne se fait pas',
  'Ville de Paris : affiche à ne pas poser',
  'Pré-test annulé',
  'Autre',
] as const

const SemaineQuery = SemaineIsoSchema.optional()

const liste = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(schema).optional(),
  )

/** RG-COO-228 : filtres de la liste des trains (périmètre d'ateliers de l'utilisateur). */
export const TrainsQuerySchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  /** Semaine de départ (AAAA-Wss) ; défaut : semaine suivante. */
  depart: SemaineQuery,
  atelier: z.coerce.number().int().positive().optional(),
  statut: liste(StatutUniteSchema),
  destinataire: z.string().trim().min(1).max(100).optional(),
  annonceur: z.string().trim().min(1).max(100).optional(),
  /** Trains contenant l'un des thèmes (choix multiple). */
  theme: liste(z.string().trim().min(1).max(100)),
  afficheur: z.string().trim().min(1).max(100).optional(),
  /** « Trains de » n visuels (1 à 4, et au-delà selon le paramètre). */
  trainsDe: z.coerce.number().int().min(1).max(9).optional(),
})
export type TrainsQuery = z.infer<typeof TrainsQuerySchema>

export const PositionTrainSchema = z.object({
  lettre: z.string(),
  faceId: n,
  contNum: nn,
  annonceur: s,
  theme: s,
  repiquage: s,
  etat: EtatPositionSchema,
  ftType: s,
})
export type PositionTrain = z.infer<typeof PositionTrainSchema>

export const TrainVersionSchema = z.object({ trainId: z.string(), version: z.string() })
export type TrainVersion = z.infer<typeof TrainVersionSchema>

export const LigneTrainSchema = z.object({
  /** Clé de ligne = identifiant du premier train de la ligne. */
  cle: z.string(),
  /** Trains identiques regroupés sur la ligne (« Nb trains »), avec leur version (RG-COO-308). */
  trains: z.array(TrainVersionSchema),
  origine: OrigineTrainSchema,
  atelier: z.object({ id: n, libelle: z.string(), plateforme: z.string() }).nullable(),
  /** Machine : référentiel non repris (D-02, Q-319) → null. */
  machine: s,
  destinataire: s,
  afficheur: s,
  positions: z.array(PositionTrainSchema),
  nb: n,
  depart: z.string(),
  semaineDepart: z.object({ annee: n, semaine: n }),
  statut: StatutUniteSchema,
  fractionne: z.boolean(),
  /** RG-COO-229 : n° de panneau Broadcast, renvoyé seulement aux profils autorisés (sinon null). */
  panneauxBc: z.array(z.string()).nullable(),
  /** RG-COO-235 : « Fait » si tous les visuels non fractionnés du train sont pré-assemblés. */
  preAssemble: z.boolean(),
  /** RG-COO-235 / 236 : rouleur du train (nom) ; null = « — ». */
  rouleur: s,
  /** ECR-COO-05 colonne masquée « Fichier » : lot de génération (G-nnnn) qui contient le train. */
  fichier: s,
  /** ECR-COO-05 colonne masquée « Modifications » : nombre de modifications tracées du train. */
  modifications: n,
  /** RG-COO-235 colonne masquée « Bague » : numéros des bagues imprimées des trains de la ligne (RG-COO-299). */
  bagues: z.array(n),
  /** Nombre total de réimpressions des bagues de la ligne (« réimprimée n fois », RG-COO-301). */
  reimpressions: n,
})
export type LigneTrain = z.infer<typeof LigneTrainSchema>

export const ListeTrainsSchema = z.object({
  semaine: z.object({ annee: n, semaine: n }),
  lignes: z.array(LigneTrainSchema),
  indicateurs: z.object({
    aProduire: n,
    enAttente: n,
    prets: n,
    enProduction: n,
    colisesExpedies: n,
  }),
  /** Encadré « À faire par la Coordination avant l'export du jeudi 14 h » : instructions pas encore OK. */
  aFaire: z.object({ instructions: n, dossiers: n }),
  positionsMax: n,
  /** Ateliers déroulants du périmètre (filtre Atelier). */
  ateliers: z.array(z.object({ id: n, libelle: z.string(), plateforme: z.string() })),
})
export type ListeTrains = z.infer<typeof ListeTrainsSchema>

export const ModificationTraceeSchema = z.object({
  le: z.string(),
  par: s,
  action: z.string(),
  detail: s,
})

export const FicheTrainSchema = z.object({
  trainId: z.string(),
  version: z.string(),
  origine: OrigineTrainSchema,
  statut: StatutUniteSchema,
  fractionne: z.boolean(),
  atelier: z.object({ id: n, libelle: z.string(), plateforme: z.string() }).nullable(),
  destinataire: s,
  afficheur: s,
  depart: z.string(),
  panneauxBc: z.array(z.string()).nullable(),
  positions: z.array(
    PositionTrainSchema.extend({
      recu: n,
      attendu: n,
      emplacement: s,
    }),
  ),
  modifications: z.array(ModificationTraceeSchema),
  /** RG-COO-299 / 301 : bague imprimée du train (null = pas encore imprimée) ; « Réimprimer la bague… » (ECR-COO-11c). */
  bague: z
    .object({
      numero: n,
      version: n,
      imprimeeLe: z.string(),
      rouleur: s,
      reimpressions: n,
      modifiee: z.boolean(),
    })
    .nullable(),
})
export type FicheTrain = z.infer<typeof FicheTrainSchema>

/** RG-COO-221 / 308 : fractionner une sélection (unitaire ou en masse). */
export const FractionnerTrainsSchema = z.object({
  trains: z.array(TrainVersionSchema).min(1).max(500),
})
export type FractionnerTrains = z.infer<typeof FractionnerTrainsSchema>

export const ResultatActionTrainsSchema = z.object({
  traites: z.array(z.string()),
  ecartes: z.array(z.object({ trainId: z.string(), raison: z.string() })),
  message: z.string(),
})
export type ResultatActionTrains = z.infer<typeof ResultatActionTrainsSchema>

/** RG-COO-222 : visuels proposés au raccrochage (même site, semaine, atelier ; non annulés). */
export const VisuelRaccrochableSchema = z.object({
  visuelId: n,
  contNum: nn,
  annonceur: s,
  theme: z.string(),
})
export const VisuelsRaccrochablesSchema = z.object({ visuels: z.array(VisuelRaccrochableSchema) })
export const VisuelsRaccrochablesQuerySchema = z.object({
  train: z.string().min(1).max(30),
})

export const RaccrocherVisuelSchema = z.object({
  visuelId: n.positive(),
  trains: z.array(TrainVersionSchema).min(1).max(500),
})
export type RaccrocherVisuel = z.infer<typeof RaccrocherVisuelSchema>

/** RG-COO-224 : créer un train de pré-test ou d'entretien (ECR-COO-05c). */
export const CreerTrainSchema = z.object({
  atelierId: n.positive(),
  depart: SemaineIsoSchema,
  type: z.enum(['PRE_TEST', 'ENTRETIEN_AJOUTE']),
  nombre: n.min(1).max(9),
  visuelId: n.positive().nullable(),
  destinataireId: n.positive().nullable(),
})
export type CreerTrain = z.infer<typeof CreerTrainSchema>
export const CreerTrainResultatSchema = z.object({
  trains: z.array(z.string()),
  message: z.string(),
})

/** Options de la modale de création (ateliers déroulants, visuels, destinataires du site). */
export const OptionsCreationTrainSchema = z.object({
  ateliers: z.array(z.object({ id: n, libelle: z.string(), plateforme: z.string() })),
  visuels: z.array(
    VisuelRaccrochableSchema.extend({ semaine: z.object({ annee: n, semaine: n }) }),
  ),
  destinataires: z.array(z.object({ id: n, nom: z.string() })),
  semaineMin: z.object({ annee: n, semaine: n }),
})
export const OptionsCreationTrainQuerySchema = z.object({
  atelier: z.coerce.number().int().positive().optional(),
})

/** RG-COO-225 : supprimer un train avec motif (suppression logique). */
export const SupprimerTrainSchema = z.object({
  version: z.string(),
  motif: z.enum(MOTIFS_SUPPRESSION_TRAIN),
  precision: z.string().trim().max(200).optional(),
})
export type SupprimerTrain = z.infer<typeof SupprimerTrainSchema>

/** RG-COO-218 : « Changer statut » des faces (Liste des trains : 2 → 5, 5 → 10 ; Préparation : 10/5/9 → 5). */
export const ChangerStatutFacesSchema = z.object({
  trains: z.array(TrainVersionSchema).min(1).max(500),
  vers: z.enum(['A_IMPRIMER', 'AU_ROULAGE']),
  /** Écran d'origine : LISTE (2 → 5, 5 → 10) ou PREPARATION (10 / 5 / 9 → 5). */
  ecran: z.enum(['LISTE', 'PREPARATION']),
  /** RG-COO-217 : rouleur obligatoire pour le passage « Au roulage ». */
  rouleurId: n.positive().optional(),
})
export type ChangerStatutFaces = z.infer<typeof ChangerStatutFacesSchema>

/** RG-COO-219 : annuler un thème de train (faces « A imprimer » du thème). */
export const AnnulerThemeTrainSchema = z.object({
  atelierId: n.positive(),
  depart: SemaineIsoSchema,
  contNum: n.positive(),
  theme: z.string().min(1).max(100),
})
export type AnnulerThemeTrain = z.infer<typeof AnnulerThemeTrainSchema>

/** RG-COO-220 : débloquer une semaine d'un atelier (faces et instructions 5 → 2). */
export const DebloquerSemaineTrainsSchema = z.object({
  atelierId: n.positive(),
  depart: SemaineIsoSchema,
})
export type DebloquerSemaineTrains = z.infer<typeof DebloquerSemaineTrainsSchema>

/** RG-COO-226 : dupliquer un train (Administration). */
export const DupliquerTrainSchema = z.object({
  trainSource: z.string().regex(/^\d{1,20}$/, 'Identifiant de train numérique attendu'),
  trainCible: z.string().regex(/^\d{1,18}$/, 'Identifiant de train numérique attendu'),
  afficheur: z.string().trim().min(1).max(50),
  nombre: n.min(1).max(50),
})
export type DupliquerTrain = z.infer<typeof DupliquerTrainSchema>

export const ResultatSimpleSchema = z.object({ message: z.string(), nombre: n })

/**
 * RG-COO-227 : « Sélectionner les N premiers trains » : coche les lignes, dans l'ordre d'affichage, jusqu'à N
 * trains cumulés (somme des `nb`) sans couper une ligne. Renvoie les clés cochées et, si la ligne suivante
 * dépasserait N, le message de la maquette.
 */
export function selectionnerPremiers(
  lignes: readonly { cle: string; nb: number }[],
  n: number,
): { cles: string[]; trains: number; message: string | null } {
  const cles: string[] = []
  let total = 0
  for (const l of lignes) {
    if (total + l.nb > n) {
      return {
        cles,
        trains: total,
        message: `${String(total)} train(s) sélectionné(s), sur ${String(cles.length)} ligne(s)… la ligne suivante en compte ${String(l.nb)} et dépasserait ${String(n)}.`,
      }
    }
    cles.push(l.cle)
    total += l.nb
  }
  return { cles, trains: total, message: null }
}
