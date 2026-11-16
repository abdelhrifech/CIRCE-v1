import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'
import { EtatPositionSchema, StatutUniteSchema, TrainVersionSchema } from './coordination-trains.ts'

// COO-P11 — Roulage : suivi 8 m² (RG-COO-234, 237, ECR-COO-08), dispatch des rouleurs (RG-COO-291 à 296,
// ECR-COO-10), référentiel des rouleurs (RG-COO-297), bagues et étiquettes (RG-COO-298 à 303, ECR-COO-11).
// Hypothèses : Q-195 (cette session). L'impression physique n'est pas pilotée (Q-002, Q-287) : la bague est posée
// en base et l'étiquette est un aperçu navigateur ; l'algorithme de répartition cible n'est pas connu (Q-276).

const n = z.number().int()
const s = z.string().nullable()
const atelierRef = z.object({ id: n, libelle: z.string(), plateforme: z.string() })

// ── Rouleurs (RG-COO-297) ──

export const RouleurRefSchema = z.object({ id: n, nom: z.string(), poste: s })
export type RouleurRef = z.infer<typeof RouleurRefSchema>

export const RouleurLigneSchema = z.object({
  id: n,
  nom: z.string(),
  poste: s,
  atelier: atelierRef.nullable(),
  /** Désactivé = date de fin passée ; il n'est plus proposé dans les listes de choix. */
  actif: z.boolean(),
  /** Référencé par une face de train ou une bague : suppression refusée (409), désactivation seule. */
  utilise: z.boolean(),
  version: n,
})
export type RouleurLigne = z.infer<typeof RouleurLigneSchema>
export const RouleursReferentielSchema = z.object({ rouleurs: z.array(RouleurLigneSchema) })

export const CreerRouleurSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  poste: z.string().trim().min(1).max(50).optional(),
  atelierId: n.positive(),
})
export type CreerRouleur = z.infer<typeof CreerRouleurSchema>
export const ModifierRouleurSchema = z.object({
  version: n.positive(),
  nom: z.string().trim().min(1).max(100).optional(),
  poste: z.string().trim().min(1).max(50).nullable().optional(),
  actif: z.boolean().optional(),
})
export type ModifierRouleur = z.infer<typeof ModifierRouleurSchema>

// ── Dispatch du roulage (ECR-COO-10) ──

export const STATUTS_DISPATCH = ['PRET', 'EN_PROD'] as const

/** RG-COO-291 : filtres du dispatch (N° de dossier, Départ, Statut, Destinataire) d'un atelier déroulant. */
export const DispatchQuerySchema = z.object({
  atelier: z.coerce.number().int().positive().optional(),
  dossier: z.coerce.number().int().positive().optional(),
  depart: SemaineIsoSchema.optional(),
  statut: z.enum(STATUTS_DISPATCH).optional(),
  destinataire: z.string().trim().min(1).max(100).optional(),
})
export type DispatchQuery = z.infer<typeof DispatchQuerySchema>

export const LigneDispatchSchema = z.object({
  /** Clé de ligne = identifiant du premier train de la ligne. */
  cle: z.string(),
  /** Trains identiques regroupés (« Trains »), avec leur version (RG-COO-308). */
  trains: z.array(TrainVersionSchema),
  destinataire: s,
  depart: z.string(),
  positions: z.array(
    z.object({ lettre: z.string(), annonceur: s, theme: s, etat: EtatPositionSchema }),
  ),
  nb: n,
  /** RG-COO-292 : faces = nb × positions non fractionnées. */
  faces: n,
  statut: z.enum(STATUTS_DISPATCH),
  rouleur: RouleurRefSchema.nullable(),
  /** RG-COO-294 : non affecté partant dans moins de 36 h (teinte critique) ; sinon non affecté = avertissement. */
  urgent: z.boolean(),
})
export type LigneDispatch = z.infer<typeof LigneDispatchSchema>

export const ChargeRouleurSchema = z.object({
  rouleurId: n,
  nom: z.string(),
  poste: s,
  trains: n,
  faces: n,
  /** Charge en % de la moyenne des rouleurs du site (RG-COO-292) ; 100 = moyenne. */
  chargePct: n,
  destinataires: z.array(z.string()),
  /** RG-COO-295 : charge supérieure au seuil (115 % par défaut). */
  surcharge: z.boolean(),
})
export type ChargeRouleur = z.infer<typeof ChargeRouleurSchema>

export const DispatchSchema = z.object({
  /** Atelier déroulant affiché ; null = « Aucun atelier déroulant sur ce site. » */
  atelier: atelierRef.nullable(),
  ateliers: z.array(atelierRef),
  lignes: z.array(LigneDispatchSchema),
  indicateurs: z.object({ trainsARouler: n, faces: n, nonAffectes: n }),
  charge: z.array(ChargeRouleurSchema),
  alertes: z.object({
    /** Trains non affectés partant dans moins de `seuilDepartHeures` heures (callout critique). */
    departProche: n,
    seuilDepartHeures: n,
    seuilSurchargePct: n,
    surcharges: z.array(z.object({ rouleur: z.string(), chargePct: n })),
  }),
  rouleurs: z.array(RouleurRefSchema),
  /** RG-COO-293 : la règle de répartition est SIMULÉE (moteur cible non fourni, Q-276). */
  moteurSimule: z.literal(true),
})
export type Dispatch = z.infer<typeof DispatchSchema>

/** RG-COO-294 : affectation immédiate d'un rouleur (null = « Non affecté »). */
export const AffecterDispatchSchema = z.object({
  trains: z.array(TrainVersionSchema).min(1).max(500),
  rouleurId: n.positive().nullable(),
})
export type AffecterDispatch = z.infer<typeof AffecterDispatchSchema>

/** RG-COO-293 / 294 : « Proposer une répartition » et « Tout désaffecter » portent sur les trains affichés. */
export const RepartitionDispatchSchema = z.object({
  atelierId: n.positive(),
  trains: z.array(TrainVersionSchema).min(1).max(500),
})
export type RepartitionDispatch = z.infer<typeof RepartitionDispatchSchema>

export const ResultatDispatchSchema = z.object({ message: z.string(), nombre: n })

/** RG-COO-296 : liste de picking d'un rouleur. */
export const PickingQuerySchema = z.object({
  rouleur: z.coerce.number().int().positive(),
  depart: SemaineIsoSchema.optional(),
})
export const PickingSchema = z.object({
  rouleur: RouleurRefSchema,
  lignes: z.array(
    z.object({
      emplacement: s,
      numAffiche: n.nullable(),
      annonceur: s,
      theme: s,
      quantite: n,
    }),
  ),
})
export type Picking = z.infer<typeof PickingSchema>

// ── Bagues et étiquettes (ECR-COO-11) ──

export const FILTRES_BAGUE = ['A_IMPRIMER', 'IMPRIMEES', 'SANS_BAGUE'] as const
export const FiltreBagueSchema = z.enum(FILTRES_BAGUE)
export type FiltreBague = z.infer<typeof FiltreBagueSchema>

/** RG-COO-298 : filtres (défaut « À imprimer »). Le poste (machine) n'est pas repris : D-02. */
export const BaguesQuerySchema = z.object({
  dossier: z.coerce.number().int().positive().optional(),
  depart: SemaineIsoSchema.optional(),
  atelier: z.coerce.number().int().positive().optional(),
  bague: FiltreBagueSchema.optional(),
  destinataire: z.string().trim().min(1).max(100).optional(),
})
export type BaguesQuery = z.infer<typeof BaguesQuerySchema>

export const TexteBagueSchema = z.object({
  lettre: z.string(),
  annonceur: s,
  theme: s,
  /** Tag « modifié » : le texte imprimé diffère de celui du visuel. */
  modifie: z.boolean(),
})
export type TexteBague = z.infer<typeof TexteBagueSchema>

export const BagueImprimeeSchema = z.object({
  numero: n,
  imprimeeLe: z.string(),
  par: s,
  rouleur: s,
  reimpressions: n,
  modifiee: z.boolean(),
  /** Version de la bague (verrou optimiste de la modification / réimpression, RG-COO-308). */
  version: n,
})
export type BagueImprimee = z.infer<typeof BagueImprimeeSchema>

export const LigneBagueSchema = z.object({
  trainId: z.string(),
  /** Version du train (impression). */
  version: z.string(),
  /** « Train » ; les unités UM (rouleau) et lot relèvent de Q-265 (création des UM). */
  type: z.literal('TRAIN'),
  atelier: atelierRef.nullable(),
  /** Poste (machine) : référentiel non repris (D-02) → null = « Sans machine ». */
  poste: s,
  destinataire: s,
  afficheur: s,
  depart: z.string(),
  textes: z.array(TexteBagueSchema),
  statut: StatutUniteSchema,
  bague: BagueImprimeeSchema.nullable(),
  /** RG-COO-299 : unité « Prêt à produire » (faces « A imprimer ») sans bague : imprimable. */
  imprimable: z.boolean(),
})
export type LigneBague = z.infer<typeof LigneBagueSchema>

export const BaguesSchema = z.object({
  lignes: z.array(LigneBagueSchema),
  ateliers: z.array(atelierRef),
})
export type Bagues = z.infer<typeof BaguesSchema>

/** RG-COO-302 : contenu d'une étiquette bague (aperçu navigateur ; code-barres : texte du numéro). */
export const ApercuBagueSchema = z.object({
  numero: n.nullable(),
  codeBarre: z.string(),
  trainId: z.string(),
  nbAff: n,
  destinataire: s,
  afficheur: s,
  atelier: s,
  depart: z.string(),
  rouleur: s,
  lignes: z.array(
    z.object({
      dossier: z.number().int().nullable(),
      annonceur: s,
      lettre: z.string(),
      theme: s,
      modifie: z.boolean(),
    }),
  ),
})
export type ApercuBague = z.infer<typeof ApercuBagueSchema>
export const ApercusBaguesSchema = z.object({
  bagues: z.array(ApercuBagueSchema),
  total: n,
})
export const ApercuBaguesQuerySchema = z.object({
  trains: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(z.string().min(1).max(30)).min(1).max(200),
  ),
})

/** RG-COO-299 : « Imprimer n bague(s) » : rouleur obligatoire. */
export const ImprimerBaguesSchema = z.object({
  trains: z.array(TrainVersionSchema).min(1).max(500),
  rouleurId: n.positive(),
})
export type ImprimerBagues = z.infer<typeof ImprimerBaguesSchema>

export const ImpressionBaguesSchema = z.object({
  message: z.string(),
  imprimees: n,
  /** Unités de la sélection qui n'étaient pas imprimables, avec la raison. */
  ignorees: z.array(z.object({ trainId: z.string(), raison: z.string() })),
  bagues: z.array(ApercuBagueSchema),
  /** L'impression physique n'est pas pilotée par Circé (Q-002, Q-287) : PDF généré par le navigateur. */
  simulee: z.literal(true),
})
export type ImpressionBagues = z.infer<typeof ImpressionBaguesSchema>

/** RG-COO-300 : textes imprimés par position ; « Enregistrer et réimprimer ». */
export const ModifierBagueSchema = z.object({
  trainId: z.string().min(1).max(30),
  version: n.positive(),
  textes: z
    .array(
      z.object({
        lettre: z.string().min(1).max(5),
        annonceur: z.string().trim().max(100),
        theme: z.string().trim().max(100),
      }),
    )
    .min(1)
    .max(20),
})
export type ModifierBague = z.infer<typeof ModifierBagueSchema>

/** RG-COO-301 : motifs de réimpression. */
export const MOTIFS_REIMPRESSION = [
  'Colis perdu, refait',
  'Bague abîmée ou illisible',
  'Autre',
] as const
export const ReimprimerBagueSchema = z.object({
  trainId: z.string().min(1).max(30),
  version: n.positive(),
  motif: z.enum(MOTIFS_REIMPRESSION),
  precision: z.string().trim().min(1).max(200).optional(),
})
export type ReimprimerBague = z.infer<typeof ReimprimerBagueSchema>

export const ResultatBagueSchema = z.object({
  message: z.string(),
  bague: ApercuBagueSchema,
  reimpressions: n,
  version: n,
})

// ── Suivi 8 m² (ECR-COO-08) ──

export const Suivi8m2QuerySchema = z.object({
  depart: SemaineIsoSchema.optional(),
  atelier: z.coerce.number().int().positive().optional(),
  dossier: z.coerce.number().int().positive().optional(),
  annonceur: z.string().trim().min(1).max(100).optional(),
})
export type Suivi8m2Query = z.infer<typeof Suivi8m2QuerySchema>

export const CHAMPS_8M2 = ['demiesHaut', 'demiesBas', 'finales'] as const
export const Champ8m2Schema = z.enum(CHAMPS_8M2)
export type Champ8m2 = z.infer<typeof Champ8m2Schema>
export const LIBELLE_CHAMP_8M2: Record<Champ8m2, string> = {
  demiesHaut: 'Demies haut',
  demiesBas: 'Demies bas',
  finales: '8 m² finales',
}

export const LigneSuivi8m2Schema = z.object({
  cle: z.string(),
  atelierId: n,
  site: z.string(),
  contNum: z.number().int().nullable(),
  annonceur: s,
  theme: s,
  besoin: n,
  recu: n,
  demiesHaut: n,
  demiesBas: n,
  finales: n,
  /** RG-COO-237 : reste à faire = besoin − finales. */
  resteAFaire: n,
  /** Version de la saisie (0 = aucune saisie encore) : verrou optimiste de la modification. */
  version: n,
})
export type LigneSuivi8m2 = z.infer<typeof LigneSuivi8m2Schema>

export const Suivi8m2Schema = z.object({
  semaine: z.object({ annee: n, semaine: n }),
  lignes: z.array(LigneSuivi8m2Schema),
  /** Ateliers 8 m² (paramètre `suivi8m2.ateliers`, Q-319) ; vide = aucun thème 8 m². */
  ateliers: z.array(atelierRef),
})
export type Suivi8m2 = z.infer<typeof Suivi8m2Schema>

/** RG-COO-237 : saisie en ligne ; entier ≥ 0 (400 sinon). */
export const Saisie8m2Schema = z.object({
  atelierId: n.positive(),
  depart: SemaineIsoSchema,
  contNum: n.positive(),
  theme: z.string().trim().min(1).max(100),
  champ: Champ8m2Schema,
  // Q-195 (10) : saisie libre ≥ 0, sans plafond fonctionnel ; seul le plafond technique d'une colonne entière.
  valeur: n.min(0).max(2_147_483_647),
  version: n.min(0),
})
export type Saisie8m2 = z.infer<typeof Saisie8m2Schema>
export const ResultatSaisie8m2Schema = z.object({
  message: z.string(),
  ligne: LigneSuivi8m2Schema,
})
