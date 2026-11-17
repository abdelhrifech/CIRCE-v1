import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'

// COO-P12 — Préparation 2 m² fixe, pliage et bus (écran « unitaire », ECR-COO-09) : liste des unités avec entretien
// à l'afficheur (RG-COO-238, 290), quantité à produire (RG-COO-239), rendre la main (RG-COO-243), corriger l'intitulé
// (RG-COO-244), fiche de synthèse (RG-COO-246), pliage (RG-COO-247), retirer / préparer (RG-COO-249, 250), quantités
// à encoller du Bus (RG-COO-304). Hypothèses : Q-196. Étape 8 (Q-265, option (c) retenue par défaut) : « Libérer la
// semaine » (RG-COO-240 à 242, RG-X-076) ne crée pas les UM ; « Colisage » les crée (RG-COO-260 à 262).

const n = z.number().int()
const s = z.string().nullable()

export const TYPES_UNITAIRE = ['fixe', 'pliage', 'bus'] as const
export const TypeUnitaireSchema = z.enum(TYPES_UNITAIRE)
export type TypeUnitaire = z.infer<typeof TypeUnitaireSchema>

export const STATUTS_UNITE_UNITAIRE = [
  'A_TRAITER',
  'EN_COURS',
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'AU_ROULAGE',
  'EXPORT_PREPA',
  'A_IMPRIMER',
  'INSTRUCTION_OK',
] as const
export const StatutUniteUnitaireSchema = z.enum(STATUTS_UNITE_UNITAIRE)

/** Référence d'une ligne (répartition) avec sa version : verrou optimiste de chaque écriture. */
export const RefRepartitionSchema = z.object({ id: n.positive(), version: n.min(0) })
export type RefRepartition = z.infer<typeof RefRepartitionSchema>

/** Repères filtrables : main rendue (RG-COO-243), « à libérer » (RG-COO-241), « arrivé après libération » (RG-COO-242). */
export const REPERES_UNITAIRE = ['RENDU', 'A_LIBERER', 'APRES_LIBERATION'] as const

export const UnitaireQuerySchema = z.object({
  type: TypeUnitaireSchema.default('fixe'),
  atelier: z.coerce.number().int().positive().optional(),
  depart: SemaineIsoSchema.optional(),
  dossier: z.coerce.number().int().positive().optional(),
  annonceur: z.string().trim().min(1).max(100).optional(),
  statut: StatutUniteUnitaireSchema.optional(),
  destinataire: z.string().trim().min(1).max(100).optional(),
  afficheur: z.string().trim().min(1).max(100).optional(),
  repere: z.enum(REPERES_UNITAIRE).optional(),
})
export type UnitaireQuery = z.infer<typeof UnitaireQuerySchema>

export const AfficheIndicativeSchema = z.enum(['VALIDEE', 'PROPOSEE', 'AUCUNE'])

export const LigneUnitaireSchema = z.object({
  /** Clé stable de la ligne (dossier × thème × destinataire × semaine × repiquage), RG-COO-248. */
  cle: z.string(),
  refs: z.array(RefRepartitionSchema),
  /** Code d'unité : `UM-nnnn` (fixe), `PL-nnnn` (pliage), `BU-nnnn` (bus) ; null tant qu'aucune UM n'existe. */
  unite: z.object({ id: n, code: z.string(), statut: z.string() }).nullable(),
  detailsUm: z
    .object({
      commentaires: z.array(z.string()),
      preparations: z.array(z.string()),
      colis: z.array(z.string()),
      repartitions: z.array(z.string()),
      affiches: z.array(z.number()),
      quantitePreparee: z.number(),
      creation: z.string().nullable(),
    })
    .optional(),
  type: TypeUnitaireSchema,
  typePreparation: s,
  atelier: z.object({ id: n, libelle: z.string(), plateforme: z.string(), plateformeId: n }),
  dossier: n.nullable(),
  annonceur: s,
  theme: s,
  repiquage: s,
  destinataire: s,
  /** HYPOTHÈSE Q-196 : l'afficheur d'une répartition est son destinataire. */
  afficheur: s,
  format: s,
  qte: n,
  entretien: n,
  total: n,
  /** Calcul de l'entretien (info-bulle RG-COO-238) : % appliqué et valeur cible. */
  pourcentageEntretien: z.number(),
  statut: z.string(),
  depart: z.string().nullable(),
  /** RG-COO-245 : jour d'affichage de la ligne (`rpc_dat_aff`). */
  jourAffichage: z.string().nullable(),
  corrigeePlateforme: z.boolean(),
  rendue: z.boolean(),
  /** RG-COO-241 : ligne « à libérer » (statut A traiter, semaine non libérée) ; repère dérivé de l'absence de libération. */
  aLiberer: z.boolean(),
  /** RG-COO-242 : préparation reçue après la libération de sa semaine (repère « Arrivé après libération »). */
  apresLiberation: z.boolean(),
  /** Unité en production (statut Préparé ou au-delà) : point de non-retour (RG-COO-223). */
  enProduction: z.boolean(),
  /** RG-COO-290 : affiche reçue indicative (✓ validée, • proposée), sans effet sur les actions. */
  afficheRecue: AfficheIndicativeSchema,
})
export type LigneUnitaire = z.infer<typeof LigneUnitaireSchema>

export const SemaineLiberationSchema = z.object({
  atelierId: n,
  atelier: z.string(),
  depart: z.string(),
  /** Date de libération ; null tant que la semaine n'est pas libérée. */
  libereeLe: z.string().nullable(),
  libereePar: z.string().nullable(),
  /** Lignes « à libérer » (RG-COO-241). */
  lignesALiberer: n,
  /** Dossiers arrivés après la libération (RG-COO-242, RG-X-076). */
  dossiersApres: z.array(n),
})
export type SemaineLiberation = z.infer<typeof SemaineLiberationSchema>

export const UnitaireSchema = z.object({
  type: TypeUnitaireSchema,
  ateliers: z.array(
    z.object({ id: n, libelle: z.string(), plateforme: z.string(), plateformeId: n }),
  ),
  lignes: z.array(LigneUnitaireSchema),
  /** Thèmes exclus par Broadcast, sortis automatiquement de la liste (annotation). */
  themesExclus: z.array(z.string()),
  /** RG-COO-240 / 241 / 242 : état de la libération de chaque semaine de départ affichée (par atelier). */
  liberation: z.object({
    disponible: z.boolean(),
    semaines: z.array(SemaineLiberationSchema),
  }),
})
export type Unitaire = z.infer<typeof UnitaireSchema>

// ── RG-COO-239 : modifier la quantité à produire ──
export const ModifierQuantiteSchema = z.object({
  id: n.positive(),
  version: n.min(0),
  quantite: n.min(0),
})
export type ModifierQuantite = z.infer<typeof ModifierQuantiteSchema>

// ── RG-COO-244 : corriger l'intitulé (les champs vides sont refusés par le service : message métier) ──
export const CorrigerIntituleSchema = z.object({
  id: n.positive(),
  version: n.min(0),
  annonceur: z.string().max(200),
  theme: z.string().max(200),
  prevenirPreProd: z.boolean().default(true),
})
export type CorrigerIntitule = z.infer<typeof CorrigerIntituleSchema>

// ── RG-COO-243 : rendre la main à la Pré-Prod ──
export const RendreLaMainSchema = z.object({
  lignes: z.array(RefRepartitionSchema).min(1).max(2000),
  motif: z.string().trim().max(200).optional(),
})
export type RendreLaMain = z.infer<typeof RendreLaMainSchema>

// ── RG-COO-249 / 250 : retirer, préparer ──
export const LignesSelectionSchema = z.object({
  lignes: z.array(RefRepartitionSchema).min(1).max(2000),
})
export type LignesSelection = z.infer<typeof LignesSelectionSchema>

// ── RG-COO-247 : comptage du pliage ──
export const ComptagePliageSchema = z.object({
  lignes: z.array(RefRepartitionSchema).min(1).max(2000),
  /** Affiches comptées ; défaut côté écran = attendu. */
  comptees: n.min(0),
})
export type ComptagePliage = z.infer<typeof ComptagePliageSchema>

export const ResultatUnitaireSchema = z.object({
  message: z.string(),
  traitees: n,
  /** Unités déjà en production, non touchées (RG-COO-243). */
  enProduction: n.default(0),
  ecart: n.nullable().default(null),
  /** Mail à la Pré-Prod : consigné, non envoyé (Q-375). */
  mailStatut: z.string().nullable().default(null),
})
export type ResultatUnitaire = z.infer<typeof ResultatUnitaireSchema>

// ── RG-COO-246 : fiche de synthèse (groupée par destinataire) ──
export const SyntheseSchema = z.object({
  type: TypeUnitaireSchema,
  groupes: z.array(
    z.object({
      destinataire: z.string(),
      lignes: z.array(
        z.object({
          dossier: n.nullable(),
          annonceur: s,
          theme: s,
          repiquage: s,
          format: s,
          qte: n,
          entretien: n,
          total: n,
        }),
      ),
      qte: n,
      entretien: n,
      total: n,
    }),
  ),
  qte: n,
  entretien: n,
  total: n,
})
export type Synthese = z.infer<typeof SyntheseSchema>

// ── RG-COO-304 : quantités à encoller (Bus) ──
export const EncollerQuerySchema = z.object({
  plateforme: z.coerce.number().int().positive().optional(),
  depart: SemaineIsoSchema.optional(),
})
export type EncollerQuery = z.infer<typeof EncollerQuerySchema>

export const CentreEncollerSchema = z.object({
  destinataireId: n,
  centre: z.string(),
  commande: n,
  /** Calcul Broadcast (+8 % +20 %), HYPOTHÈSE Q-196. */
  calculBroadcast: n,
  ajustement: z.number(),
  aEncoller: n,
})
export const EncollerSchema = z.object({
  plateformeId: n,
  depart: z.string(),
  ajustementGlobal: z.number(),
  version: n,
  centres: z.array(CentreEncollerSchema),
  total: n,
})
export type Encoller = z.infer<typeof EncollerSchema>

export const EnregistrerEncollerSchema = z.object({
  plateformeId: n.positive(),
  depart: SemaineIsoSchema,
  ajustementGlobal: z.number().min(-100).max(1000),
  centres: z
    .array(z.object({ destinataireId: n.positive(), ajustement: z.number().min(-100).max(1000) }))
    .max(500),
  version: n.min(0),
})
export type EnregistrerEncoller = z.infer<typeof EnregistrerEncollerSchema>

// ── RG-COO-240 : libérer la semaine (ne crée pas les UM, Q-265 option (c)) ──
export const LibererSemaineSchema = z.object({
  atelierId: n.positive(),
  depart: SemaineIsoSchema,
})
export type LibererSemaine = z.infer<typeof LibererSemaineSchema>
export const ResultatLiberationSchema = z.object({
  message: z.string(),
  atelierId: n,
  depart: z.string(),
  libereeLe: z.string(),
  /** Dossiers inscrits à l'historique « Libéré vers l'atelier ». */
  dossiers: n,
  /** Dossiers dont des affiches restent à confirmer (information du toast, la libération ne les attend pas). */
  dossiersAConfirmer: n,
})
export type ResultatLiberation = z.infer<typeof ResultatLiberationSchema>
