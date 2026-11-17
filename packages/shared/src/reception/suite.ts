import { z } from 'zod'
import { ConstatNcSchema } from '../nonconformite.ts'
import { EtatValidationSchema, MotifDouteSchema } from '../coordination.ts'
import { ModeRattachementSchema } from './schemas.ts'
import { DateJourSchema } from '../semaines.ts'

// REC-P05 à REC-P10 — sas et contrôle, impressions, réceptions inconnues, liste et fiche des affiches,
// stock (rebut), alertes, paramètres et référentiels.

const iso = z.string()
const n = z.number().int()

// ── REC-P05 : sas et contrôle ──
export const RetardSchema = z.enum(['NON', 'RETARD', 'DOUBLE'])
export const PaletteSasSchema = z.object({
  receptionId: n,
  version: n,
  estInconnue: z.boolean(),
  arrivee: iso,
  aControlerDepuis: iso,
  attenteMinutes: n,
  retard: RetardSchema,
  site: z.object({ id: n, nom: z.string() }),
  bl: z.string().nullable(),
  imprimeur: z.string().nullable(),
  nombreAffiches: n,
  quantiteBl: n,
  dechargePar: z.string().nullable(),
})
export const SasSchema = z.object({
  palettes: z.array(PaletteSasSchema),
  delaiControleHeures: n,
  nombreEnRetard: n,
})
export type Sas = z.infer<typeof SasSchema>

export const NON_CONFORMITES = [
  'CONFORME',
  'VISUEL_NON_CONFORME',
  'QUANTITE',
  'AFFICHE_ABIMEE',
  'BANDEAU_MANQUANT',
  'AUTRE',
] as const
export const NonConformiteSchema = z.enum(NON_CONFORMITES)

export const LigneControleSchema = z.object({
  afficheId: n,
  version: n,
  complement: z.boolean(),
  orpheline: z.boolean(),
  annonceur: z.string().nullable(),
  theme: z.string().nullable(),
  dossiers: z.array(n),
  format: z.string(),
  quantiteBl: n,
  /** RG-REC-066 : attendu des lignes rattachées (sans entretien, Q-178 (19)). */
  attendu: n,
  /** Quantité comptée au contrôle (BL + écarts de contrôle de cette réception) ; null avant le contrôle. */
  qteComptee: n.nullable(),
  /** ECR-REC-06 : reçu (Σ liens actifs) et statut de l'affiche. */
  recu: n,
  statutAffiche: z.enum(['IDENTIFIEE', 'ORPHELINE']),
  feuille: z.enum(['TEMPORAIRE', 'DEFINITIVE']).nullable(),
  allee: z.string().nullable(),
  rayon: z.string().nullable(),
  surplusEntretien: n.nullable(),
})
export const ControleSchema = z.object({
  receptionId: n,
  version: n,
  statut: z.enum(['A_IDENTIFIER', 'A_CONTROLER', 'CONTROLEE']),
  estInconnue: z.boolean(),
  lectureSeule: z.boolean(),
  arrivee: iso,
  site: z.object({ id: n, nom: z.string() }),
  bl: z.string().nullable(),
  photoBlId: n.nullable(),
  imprimeur: z.object({ id: n, libelle: z.string() }).nullable(),
  transporteur: z.string().nullable(),
  nbColis: n.nullable(),
  dechargePar: z.string().nullable(),
  controleur: z.string().nullable(),
  controleLe: iso.nullable(),
  ecartReceptionPourcent: z.number(),
  comptageMorceauSeuil: n,
  lignes: z.array(LigneControleSchema),
})
export type Controle = z.infer<typeof ControleSchema>

export const ValiderControleSchema = z.object({
  version: n,
  controleurId: n.nullable(),
  /** RG-REC-068 : imprimeur corrigé (réception inconnue seulement). */
  imprimeurId: n.nullable().default(null),
  lignes: z
    .array(
      z.object({
        afficheId: n,
        qteComptee: n,
        allee: z.string().trim().max(10).default(''),
        rayon: z.string().trim().max(10).default(''),
        rebut: n.default(0),
        nonConformite: NonConformiteSchema.default('CONFORME'),
        surplusEntretien: n.nullable().default(null),
      }),
    )
    .min(1),
})
export type ValiderControle = z.infer<typeof ValiderControleSchema>
export const ControleValideSchema = z.object({
  receptionId: n,
  version: n,
  affiches: z.array(n),
  message: z.string(),
})

// ── REC-P06 : feuilles de stock et impressions ──
export const FeuilleSchema = z.object({
  photoId: n.nullable().optional(),
  afficheId: n,
  codeBarres: z.string(),
  type: z.enum(['DEFINITIVE', 'TEMPORAIRE']),
  fondJaune: z.boolean(),
  format: z.string(),
  dateReception: iso,
  adressage: z.string(),
  quantite: n,
  dossiers: z.array(n),
  semaines: z.array(z.string()),
  premierDepart: z.string().nullable(),
  annonceur: z.string().nullable(),
  theme: z.string().nullable(),
  repiquage: z.string().nullable(),
  commentaire: z.string().nullable(),
  aConserver: z.boolean(),
  lignes: z.array(
    z.object({
      dossier: n.nullable(),
      theme: z.string().nullable(),
      annonceur: z.string().nullable(),
      format: z.string().nullable(),
      depart: z.string(),
      qtePrepa: n,
      da: n.nullable(),
    }),
  ),
})
export type Feuille = z.infer<typeof FeuilleSchema>
export const FeuillesSchema = z.object({
  feuilles: z.array(FeuilleSchema),
  exemplairesParDefaut: n,
})

export const ImpressionSchema = z.object({
  nonConformites: z
    .array(z.object({ id: z.number().int().positive(), version: z.number().int().positive() }))
    .max(100)
    .optional(),
  afficheIds: z.array(n).min(1).max(500),
  /** FEUILLE, ETIQUETTE_RACK ou les deux (RG-REC-086). */
  contenu: z.enum(['FEUILLE', 'ETIQUETTE_RACK', 'FEUILLE_ET_ETIQUETTE']),
  exemplaires: n,
})
export const ImpressionResultatSchema = z.object({ afficheIds: z.array(n), message: z.string() })

export const RangementSchema = z.object({
  affiches: z
    .array(
      z.object({
        id: n,
        version: n,
        allee: z.string().trim().max(10),
        rayon: z.string().trim().max(10),
      }),
    )
    .min(1),
})

// ── REC-P07 : réceptions inconnues ──
export const STATUTS_INCONNUE = [
  'A_IDENTIFIER',
  'INTROUVABLE',
  'RATTACHEE_A_CONTROLER',
  'CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER',
  'RATTACHEE_FEUILLE_DEFINITIVE',
] as const
export const StatutInconnueSchema = z.enum(STATUTS_INCONNUE)
export type StatutInconnue = z.infer<typeof StatutInconnueSchema>

export const CreerInconnueSchema = z.object({
  nonConformite: ConstatNcSchema.optional(),
  plateformeId: n,
  supportId: n,
  annonceur: z.string().trim().max(100).default(''),
  theme: z.string().trim().max(250).default(''),
  imprimeurId: n.nullable().default(null),
  quantite: n,
  allee: z.string().trim().max(10).default(''),
  rayon: z.string().trim().max(10).default(''),
  photoAfficheId: n.nullable().default(null),
  photoBlId: n.nullable().default(null),
  /** RG-REC-098 : palette arrivée sans BL (n° de BL « — ») : pas de photo du BL. */
  sansBl: z.boolean().default(false),
  numeroBl: z.string().trim().max(50).default(''),
})
export type CreerInconnue = z.infer<typeof CreerInconnueSchema>
export const InconnueCreeeSchema = z.object({ receptionId: n, afficheId: n, message: z.string() })

export const InconnueSchema = z.object({
  afficheId: n,
  version: n,
  receptionId: n,
  receptionVersion: n,
  annonceur: z.string().nullable(),
  description: z.string().nullable(),
  site: z.object({ id: n, nom: z.string() }),
  quantite: n,
  recueLe: iso,
  enAttenteMinutes: n.nullable(),
  enRetard: z.boolean(),
  statut: StatutInconnueSchema,
  signaleLe: iso.nullable(),
  dossiers: z.array(n),
  emplacement: z.string(),
  format: z.string(),
  imprimeur: z.string().nullable(),
  feuille: z.enum(['TEMPORAIRE', 'DEFINITIVE']).nullable(),
  photoId: n.nullable(),
})
export const InconnuesSchema = z.object({
  items: z.array(InconnueSchema),
  filtreStatut: z.array(StatutInconnueSchema),
})

export const CandidatSchema = z.object({
  ligneAttendueId: n,
  dossier: n.nullable(),
  da: n.nullable(),
  annonceur: z.string().nullable(),
  theme: z.string().nullable(),
  format: z.string().nullable(),
  depart: z.string(),
  attendu: n,
  reste: n,
})
export const CandidatsSchema = z.object({ candidats: z.array(CandidatSchema) })

export const RattacherInconnueSchema = z.object({
  version: n,
  lignes: z.array(z.object({ ligneAttendueId: n, quantite: n })),
})
export const SignalerSchema = z.object({ receptionVersion: n })
export const SignalementSchema = z.object({ afficheId: n, receptionId: n, message: z.string() })

// ── REC-P08 : liste et fiche des affiches ──
export const TAGS_AFFICHE = [
  'A_CONTROLER',
  'RECEPTION_INCONNUE',
  'COMPLEMENT',
  'FEUILLE_A_REFAIRE',
  'FEUILLE_A_IMPRIMER',
] as const
export const TagAfficheSchema = z.enum(TAGS_AFFICHE)

export const AfficheListeSchema = z.object({
  version: n.optional(),
  zonePicking: z.boolean().optional(),
  fusionneeHeritee: z.boolean().optional(),
  id: n,
  validation: z.enum(['RECEPTION_INCONNUE', 'VALIDEE', 'A_CONFIRMER_PROPOSE', 'A_CONFIRMER_DOUTE']),
  recueLe: iso,
  annonceur: z.string().nullable(),
  theme: z.string().nullable(),
  dossiers: z.array(n),
  departs: z.array(z.string()),
  multiSemaines: z.boolean(),
  enStock: n,
  rebut: n,
  emplacement: z.string(),
  statut: z.enum(['IDENTIFIEE', 'ORPHELINE']),
  tags: z.array(TagAfficheSchema),
  receptionId: n.nullable(),
  site: z.object({ id: n, nom: z.string() }),
  format: z.string(),
  imprimeur: z.string().nullable(),
  recu: n,
  controleur: z.string().nullable(),
  feuille: z.enum(['TEMPORAIRE', 'DEFINITIVE']).nullable(),
  /** RG-COO-025 : « à traiter » = non rebutée, non fusionnée, ET (non validée OU sans ligne attendue). */
  aTraiter: z.boolean(),
})
export const ListeAffichesSchema = z.object({
  items: z.array(AfficheListeSchema),
  total: n,
  page: n,
  pageSize: n,
})

// RG-REC-122 : filtres de la liste ; une affiche sans semaine reste visible au filtre Départ.
export const ListeAffichesQuerySchema = z.object({
  picking: z.enum(['oui', 'non']).optional(),
  validation: z
    .enum(['RECEPTION_INCONNUE', 'VALIDEE', 'A_CONFIRMER_PROPOSE', 'A_CONFIRMER_DOUTE'])
    .optional(),
  dossier: z.coerce.number().int().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  tag: z.enum([...TAGS_AFFICHE, 'ORPHELINE']).optional(),
  supportId: z.coerce.number().int().optional(),
  imprimeurId: z.coerce.number().int().optional(),
  /** RG-COO-025 : seulement les affiches « à traiter » (validation admin ou rattachement à faire). */
  aTraiter: z.enum(['oui']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})
export type ListeAffichesQuery = z.infer<typeof ListeAffichesQuerySchema>

export const FicheAfficheSchema = AfficheListeSchema.extend({
  supportId: n.optional(),
  photoId: n.nullable().optional(),
  repiquage: z.string().nullable().optional(),
  zonePicking: z.boolean().optional(),
  dossierSaisi: n.nullable().optional(),
  version: n,
  commentaire: z.string().nullable(),
  allee: z.string().nullable(),
  rayon: z.string().nullable(),
  aConserver: z.boolean(),
  conservation: n,
  dateDernierDepart: iso.nullable(),
  dernierDepartDepasse: z.boolean(),
  surplusEntretien: n.nullable(),
  imprimeurId: n.nullable(),
  validation: z.object({
    validee: z.boolean(),
    par: z.string().nullable(),
    le: iso.nullable(),
    mode: ModeRattachementSchema.nullable(),
    /** RG-COO-007 / RG-COO-006 : état calculé et motifs de doute (ECR-REC-05, pastille de la fiche). */
    etat: EtatValidationSchema,
    motifs: z.array(MotifDouteSchema),
  }),
  fusionneeHeritee: z.boolean(),
  receptions: z.array(z.object({ id: n, statut: z.string(), arrivee: iso })),
  mouvements: z.array(
    z.object({
      id: n,
      date: iso,
      type: z.string(),
      motif: z.string().nullable(),
      quantite: n,
      par: z.string().nullable(),
      auto: z.boolean(),
      receptionId: n.nullable(),
    }),
  ),
  preparations: z.array(
    z.object({
      lienId: n,
      lienVersion: n,
      ligneAttendueId: n,
      dossier: n.nullable(),
      annonceur: z.string().nullable(),
      theme: z.string().nullable(),
      depart: z.string(),
      quantite: n,
      mode: ModeRattachementSchema,
    }),
  ),
  historique: z.array(
    z.object({
      le: iso,
      action: z.string(),
      ancien: z.string().nullable(),
      nouveau: z.string().nullable(),
      par: z.string().nullable(),
    }),
  ),
})
export type FicheAffiche = z.infer<typeof FicheAfficheSchema>

export const ModifierAfficheSchema = z.object({
  photoId: n.nullable().optional(),
  repiquage: z.string().trim().max(250).optional(),
  conservation: z.number().int().min(1).optional(),
  zonePicking: z.boolean().optional(),
  version: n,
  annonceur: z.string().trim().max(100).optional(),
  theme: z.string().trim().max(250).optional(),
  imprimeurId: n.nullable().optional(),
  allee: z.string().trim().max(10).optional(),
  rayon: z.string().trim().max(10).optional(),
  aConserver: z.boolean().optional(),
  commentaire: z.string().trim().max(2000).optional(),
})
export const RattacherAfficheSchema = z.object({ version: n, ligneAttendueId: n, quantite: n })
export const ChangerThemeSchema = z.object({ version: n, lienId: n, nouvelleLigneId: n })
export const RetirerLienSchema = z.object({ lienVersion: n })
export const ValidationAdminSchema = z.object({ version: n, valider: z.boolean() })

// ── REC-P09 : stock ──
export const MOTIFS_REBUT = [
  'AFFICHE_DECHIREE',
  'MAUVAIS_VISUEL',
  'ERREUR_QUANTITE',
  'AUTRE',
] as const
export const RebutSchema = z.object({ quantite: n, motif: z.enum(MOTIFS_REBUT) })
export const MouvementManuelSchema = z.object({
  sens: z.enum(['AJOUT', 'SORTIE']),
  quantite: n,
  motif: z.string().trim().max(250).default(''),
})
export const StockMisAJourSchema = z.object({ afficheId: n, stock: n })

// ── REC-P10 : alertes, paramètres, référentiels ──
export const GRAVITES = ['CRITIQUE', 'IMPORTANT', 'A_SURVEILLER'] as const
export const AlerteSchema = z.object({
  cle: z.string(),
  type: z.string(),
  regle: z.string(),
  gravite: z.enum(GRAVITES),
  message: z.string(),
  lien: z.string(),
  destinataires: z.array(z.string()),
  plateformeId: n,
  /** COO-P07 (ECR-TRA-01) : dossier, semaine de départ ISO et date de l'alerte, quand ils existent. */
  dossier: n.nullable().optional(),
  depart: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
})
export const AlertesSchema = z.object({ alertes: z.array(AlerteSchema) })
export type Alerte = z.infer<typeof AlerteSchema>

export const ParametresReceptionSchema = z.object({
  ecartReception: z.number().min(0).max(100),
  purgeAttendues: n.min(1).max(52),
  delaiControle: n.min(1).max(720),
  comptageMorceau: n.min(0).max(1000),
  exemplairesFeuille: n.min(1, 'Entre 1 et 5 exemplaires').max(5, 'Entre 1 et 5 exemplaires'),
  alleeInconnues: z.string().trim().min(1).max(10),
})
export type ParametresReception = z.infer<typeof ParametresReceptionSchema>

export const ReferentielEntreeSchema = z.object({ libelle: z.string().trim().min(1).max(150) })
export const ReferentielEtatSchema = z.object({ actif: z.boolean(), version: n })
export const ReferentielLigneSchema = z.object({
  id: n,
  libelle: z.string(),
  actif: z.boolean(),
  version: n,
})
export type ReferentielLigne = z.infer<typeof ReferentielLigneSchema>

export const SuggestionsIntitulesSchema = z.object({
  suggestions: z.array(z.object({ intitule: z.string(), site: z.string(), afficheId: n })),
})
export const InconnuesQuerySchema = z.object({
  statut: z
    .union([StatutInconnueSchema, z.array(StatutInconnueSchema)])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
})
export const RattachementInconnueResultatSchema = z.object({
  afficheId: n,
  receptionId: n,
  validee: z.boolean(),
  /** RG-X-003 : unités (trains) passées « prêtes à produire » par ce rattachement. */
  unitesPretes: z.number().int(),
  message: z.string(),
})
export const ResultatAfficheSchema = z.object({ afficheId: n, message: z.string() })
export const EditionPickingSchema = z.object({
  lignes: z.array(
    z.object({
      afficheId: n,
      codeBarres: z.string(),
      format: z.string(),
      annonceur: z.string(),
      theme: z.string().nullable(),
      quantite: n,
    }),
  ),
})
export const EditionPickingQuerySchema = z.object({
  plateformeId: z.coerce.number().int(),
  du: DateJourSchema,
  au: DateJourSchema,
})
/** RG-REC-178 / RG-REC-009 : écriture avec les valeurs lues (jeton de concurrence : 409 si elles ont changé). */
export const ParametresEcritureSchema = ParametresReceptionSchema.extend({
  precedent: ParametresReceptionSchema,
})
export type ParametresEcriture = z.infer<typeof ParametresEcritureSchema>
export const ParametresResultatSchema = z.object({
  parametres: ParametresReceptionSchema,
  message: z.string(),
})
export const SiteQuerySchema = z.object({ site: z.coerce.number().int().optional() })
