import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'

// COO-P13 — Colis, expédition et fin de journée (ECR-EXP-01 « Scan et colisage », ECR-EXP-02 « Colis ») :
// RG-COO-263 à 271, 280. Hypothèses : Q-197 (cette session), Q-272, Q-273, Q-284, Q-285, Q-375. La construction /
// création des UM (RG-COO-260 à 262) et la libération de la semaine restent BLOQUÉES par Q-265 : les UM
// consommées ici existent déjà. L'intégration AMT (RG-COO-272 à 276) n'est pas reprise (Q-274).

const n = z.number().int()
const s = z.string().nullable()

/**
 * Statuts d'un colis (rpc_statut legacy : 1, 7, 8) : « Colis ouvert », « Clos · à expédier », « Expédié ».
 * « Livré » (preuve de livraison Geodis) n'est pas modélisé (Q-284, module Expédition / interfaces).
 */
export const STATUTS_COLIS = ['EN_COURS', 'A_EXPEDIER', 'TERMINE'] as const
export const StatutColisSchema = z.enum(STATUTS_COLIS)
export type StatutColis = z.infer<typeof StatutColisSchema>

export const COLIS_QUERY_MAX = 100

/** Filtres communs des vues d'expédition : N° de dossier, Départ (semaine ISO), Destinataire, Statut, Atelier. */
export const ColisQuerySchema = z.object({
  type: z.enum(['fixe', 'pliage']).optional(),
  dossier: z.coerce.number().int().positive().optional(),
  depart: SemaineIsoSchema.optional(),
  destinataire: z.string().trim().min(1).max(100).optional(),
  statut: StatutColisSchema.optional(),
  atelier: z.coerce.number().int().positive().optional(),
})
export type ColisQuery = z.infer<typeof ColisQuerySchema>

const destinataireRef = z.object({ id: n, nom: z.string() })
const atelierRef = z.object({ id: n, libelle: z.string(), plateforme: z.string() })

export const UniteColisLigneSchema = z.object({
  uniteId: n,
  /** Code barre de l'UM (RG-COO-261) ou `UM-<id>` quand elle n'en a pas. */
  code: z.string(),
  dossier: n.nullable(),
  theme: s,
  annonceur: s,
  /** uc_qte : quantité de l'UM placée dans CE colis (RG-COO-264). */
  quantite: n,
  /** UM_qte : quantité totale de l'UM. */
  quantiteTotale: n.nullable(),
  statutUnite: z.string(),
})
export type UniteColisLigne = z.infer<typeof UniteColisLigneSchema>

export const TrainColisLigneSchema = z.object({
  trainId: z.string(),
  dossier: n.nullable(),
  theme: s,
  faces: n,
  statut: z.string(),
})
export type TrainColisLigne = z.infer<typeof TrainColisLigneSchema>

export const ColisLigneSchema = z.object({
  id: n,
  /** `C-` + n° sur 18 chiffres (RG-COO-266). */
  code: z.string(),
  statut: StatutColisSchema,
  destinataire: destinataireRef,
  atelier: atelierRef,
  nbUnites: n,
  nbTrains: n,
  /** Somme des quantités placées (UM) ou des faces (trains). */
  quantite: n,
  /** RG-COO-263 : poids recalculé (minimum 1 kg). */
  poids: z.number().nullable(),
  /** Départ (semaine ISO) de l'UM ou du train le plus proche ; null si inconnu. */
  depart: z.string().nullable(),
  /** Date de clôture du colis (colis_dat_expe legacy, posée par « Expédier » : colonne « Clos le »). */
  dateExpedition: z.string().nullable(),
  /** Date de la fin de journée (transition vers « Expédié » : colonne « Expédié le ») ; null tant que non expédié. */
  expedieLe: z.string().nullable(),
  codeExterne: s,
  transporteur: n.nullable(),
  tarif: s,
  version: n,
})
export type ColisLigne = z.infer<typeof ColisLigneSchema>

export const HistoriqueColisSchema = z.object({
  de: s,
  vers: z.string(),
  le: z.string(),
  par: s,
  motif: s,
})

export const FicheColisSchema = ColisLigneSchema.extend({
  commentaire: s,
  formatCode: n,
  unites: z.array(UniteColisLigneSchema),
  trains: z.array(TrainColisLigneSchema),
  historique: z.array(HistoriqueColisSchema),
})
export type FicheColis = z.infer<typeof FicheColisSchema>

export const ListeColisSchema = z.object({
  colis: z.array(ColisLigneSchema),
  /** ECR-EXP-02 : colis clos à expédier, expédiés (Livré : Q-284, non calculable). */
  indicateurs: z.object({ clos: n, expedies: n, livres: n.nullable() }),
  total: n,
})
export type ListeColis = z.infer<typeof ListeColisSchema>

// ── ECR-EXP-01 : unités à coliser ──

export const UniteAColiserSchema = z.object({
  type: z.literal('UM'),
  /** UM : identifiant ; train : voir `trainId`. */
  uniteId: n,
  code: z.string(),
  dossier: n.nullable(),
  theme: s,
  afficheur: s,
  /** Quantité restant à placer dans un colis (UM_qte − Σ uc_qte). */
  quantite: n,
  statut: z.string(),
})
export const TrainAColiserSchema = z.object({
  type: z.literal('TRAIN'),
  trainId: z.string(),
  dossier: n.nullable(),
  theme: s,
  afficheur: s,
  faces: n,
  statut: z.string(),
})
export const GroupeAColiserSchema = z.object({
  destinataire: destinataireRef,
  atelier: atelierRef,
  depart: z.string().nullable(),
  unites: z.array(z.union([UniteAColiserSchema, TrainAColiserSchema])),
})
export type GroupeAColiser = z.infer<typeof GroupeAColiserSchema>

export const AColiserSchema = z.object({
  groupes: z.array(GroupeAColiserSchema),
  /** « Colis en cours » : colis ouverts du périmètre. */
  colisOuverts: z.array(ColisLigneSchema),
  indicateurs: z.object({
    aColiser: n,
    clos: n,
    expedies: n,
    /** Q-284 : preuve de livraison Geodis non modélisée. */
    livres: n.nullable(),
  }),
})
export type AColiser = z.infer<typeof AColiserSchema>

// ── Actions ──

export const IdColisParamSchema = z.object({ id: z.coerce.number().int().positive() })

export const CreerColisSchema = z.object({
  atelierId: n.positive(),
  destinataireId: n.positive(),
})
export type CreerColis = z.infer<typeof CreerColisSchema>

/** `code` : code barre de l'UM (« scan ») ou `UM-<id>`. `quantite` (uc_qte) : par défaut le reste à placer. */
export const AjouterUniteSchema = z.object({
  version: n.positive(),
  code: z.string().trim().min(1).max(100),
  quantite: n.positive().optional(),
})
export type AjouterUnite = z.infer<typeof AjouterUniteSchema>

export const AjouterTrainSchema = z.object({
  version: n.positive(),
  trainId: z.string().trim().min(1).max(30),
})
export type AjouterTrain = z.infer<typeof AjouterTrainSchema>

export const RetirerColisSchema = z
  .object({
    version: n.positive(),
    unites: z.array(n.positive()).max(500).default([]),
    trains: z.array(z.string().trim().min(1).max(30)).max(500).default([]),
    /** « Tout retirer ». */
    tout: z.boolean().default(false),
  })
  .refine((v) => v.tout || v.unites.length > 0 || v.trains.length > 0, {
    message: 'Cochez les unités à retirer du colis.',
  })
export type RetirerColis = z.infer<typeof RetirerColisSchema>

export const VersionColisSchema = z.object({ version: n.positive() })
export type VersionColis = z.infer<typeof VersionColisSchema>

export const ExpedierColisSchema = z.object({
  version: n.positive(),
  /** Code externe du transporteur ; « ETIQUETTES » est remis à vide (RG-COO-268). */
  codeExterne: z.string().trim().min(1).max(50).optional(),
  commentaire: z.string().trim().min(1).max(200).optional(),
  formatCode: n.positive().max(99).optional(),
})
export type ExpedierColis = z.infer<typeof ExpedierColisSchema>

/** `colis` est null quand le colis, vidé, a été supprimé (« colis vidé supprimé », ECR-EXP-01). */
export const ResultatColisSchema = z.object({
  colis: FicheColisSchema.nullable(),
  supprime: z.boolean(),
  message: z.string(),
})
export type ResultatColis = z.infer<typeof ResultatColisSchema>

export const FinDeJourneeSchema = z.object({}).strict()
export type FinDeJournee = z.infer<typeof FinDeJourneeSchema>

export const ResultatFinDeJourneeSchema = z.object({
  /** Colis passés « Expédié » (A expédier → Terminé). */
  colis: z.array(n),
  unites: n,
  faces: n,
  /** RG-X-087 : mouvements de stock « Expédition » créés dans la même transaction. */
  sortiesStock: n,
  /** Quantités qu'aucun stock d'affiche ne couvrait (aucune sortie négative : Q-197 (9)). */
  manquants: z.array(
    z.object({
      colis: n,
      uniteId: n,
      manquant: n,
      raison: z.enum(['STOCK_INSUFFISANT', 'AUCUNE_AFFICHE']),
    }),
  ),
  message: z.string(),
})
export type ResultatFinDeJournee = z.infer<typeof ResultatFinDeJourneeSchema>

// ── ECR-EXP-03 : Départs camions (D-14, lecture seule, HYPOTHÈSES Q-411) ──

/** Filtres de ECR-EXP-03 : mêmes que ECR-EXP-01 (N° de dossier, Départ, Destinataire, Atelier). */
export const DepartsCamionsQuerySchema = ColisQuerySchema.omit({ statut: true })
export type DepartsCamionsQuery = z.infer<typeof DepartsCamionsQuerySchema>

/** Gravité du liseré (maquette) : critique = unités en attente et départ < 36 h ; attention = en attente ; prêt = tout colisé / parti. */
export const GRAVITES_DEPART = ['CRITIQUE', 'ATTENTION', 'PRET', 'AUCUNE'] as const
export const GraviteDepartSchema = z.enum(GRAVITES_DEPART)
export type GraviteDepart = z.infer<typeof GraviteDepartSchema>

export const DepartCamionLigneSchema = z.object({
  /** Départ (semaine ISO) : le jour et l'heure de départ du camion ne sont pas modélisés (Q-403, Q-411). */
  depart: z.string(),
  /** Date de départ la plus proche des trains du groupe (null pour des UM seules). */
  departLe: z.string().nullable(),
  /** « Destinations » : le destinataire (la boucle de transport n'est pas modélisée, Q-403). */
  destinataire: destinataireRef,
  plateforme: z.string(),
  unites: n,
  /** Unités colisées ou parties (Colisé, Expédié, Livré ; UM « A expédier » / « Terminé »). */
  colisees: n,
  /** Unités en production, produites, ou UM « En cours » / « Préparé ». */
  enCours: n,
  /** Trains non couverts (visuels manquants). */
  enAttente: n,
  /** Pourcentage d'unités colisées ou parties (0 à 100). */
  avancement: n,
  gravite: GraviteDepartSchema,
})
export type DepartCamionLigne = z.infer<typeof DepartCamionLigneSchema>

export const DepartsCamionsSchema = z.object({
  departs: z.array(DepartCamionLigneSchema),
  indicateurs: z.object({ unites: n, colisees: n, enCours: n, enAttente: n }),
  /** Fenêtre appliquée quand aucun départ n'est filtré : départs depuis cette semaine ISO. */
  depuis: z.string().nullable(),
})
export type DepartsCamions = z.infer<typeof DepartsCamionsSchema>
