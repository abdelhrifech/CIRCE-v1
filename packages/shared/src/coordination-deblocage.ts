import { z } from 'zod'
import { DateJourSchema } from './semaines.ts'

// COO-P08 — Déblocage des préparations et « Rendre la main à la Pré-Prod » (RG-COO-140 à 152, 277 à 279 ;
// HYPOTHÈSES Q-217, Q-218, Q-382, Q-191). Écran « Déblocage des préparations » (recherche + action) et
// « Préparations débloquées » (suivi). Le déblocage legacy (Administration) est l'action « Rendre la main ».

const n = z.number().int()
const nn = n.nullable()

/** RG-COO-141 : UM si une répartition Circé correspond au groupe, sinon TRAIN (déroulant). */
export const TYPES_GROUPE_PREPARATION = ['UM', 'TRAIN'] as const
export const TypeGroupePreparationSchema = z.enum(TYPES_GROUPE_PREPARATION)

/** Machine d'états du groupe (§3.2.e) : INTEGRE → DEBLOQUE (toute autre transition : 409). */
export const ETATS_GROUPE_PREPARATION = ['INTEGRE', 'DEBLOQUE'] as const
export const EtatGroupePreparationSchema = z.enum(ETATS_GROUPE_PREPARATION)

/** RG-COO-142 : statut d'avancement legacy (`StatutPrepa`) : None (débloquable) / En cours. */
export const StatutPrepaSchema = z.enum(['NONE', 'EN_COURS'])

/** RG-COO-140 : au moins un critère, sinon liste vide. */
export const RechercheDeblocageQuerySchema = z.object({
  preparation: z.coerce.number().int().positive().optional(),
  dossier: z.coerce.number().int().positive().optional(),
})
export type RechercheDeblocageQuery = z.infer<typeof RechercheDeblocageQuerySchema>

export const UniteBloquanteSchema = z.object({
  id: n,
  plateforme: z.string().nullable(),
  atelier: z.string().nullable(),
  codeBarre: z.string().nullable(),
  contNum: nn,
  theme: z.string().nullable(),
  statut: z.string(),
})

export const GroupeDeblocableSchema = z.object({
  /** Clé opaque du groupe, renvoyée telle quelle à l'action (le serveur recalcule tout). */
  cle: z.string(),
  type: TypeGroupePreparationSchema,
  etat: EtatGroupePreparationSchema,
  idPreparationChapeau: nn,
  idGroupePreparation: nn,
  contNum: n,
  annonceur: z.string().nullable(),
  semaine: z.object({ annee: n, semaine: n }),
  /** Tranches dossier × semaine du groupe (un groupe Broadcast peut en couvrir plusieurs) : le contrôle et
   * l'annulation portent sur le groupe ENTIER (RG-COO-143, 277, 278). `contNum` / `semaine` = 1re tranche. */
  tranches: z.array(
    z.object({
      contNum: n,
      semaine: z.object({ annee: n, semaine: n }),
      quantite: n,
      repartitionsActives: n,
    }),
  ),
  idSurface: nn,
  surface: z.string().nullable(),
  idSiteCcf: nn,
  site: z.string().nullable(),
  idTypePreparation: nn,
  typePreparation: z.string().nullable(),
  quantite: nn,
  statutPrepa: StatutPrepaSchema.nullable(),
  /** Décidé par le serveur (RG-COO-143 / 144 / 277) : le front n'en recalcule rien. */
  deblocable: z.boolean(),
  motifBlocage: z.string().nullable(),
  regleBlocage: z.string().nullable(),
  unitesBloquantes: z.array(UniteBloquanteSchema),
  repartitionsActives: n,
})
export type GroupeDeblocable = z.infer<typeof GroupeDeblocableSchema>

export const ResultatRechercheDeblocageSchema = z.object({
  groupes: z.array(GroupeDeblocableSchema),
  /** RG-COO-140 : message de grille vide quand aucun critère n'est saisi. */
  message: z.string().nullable(),
  /** RG-COO-141 : traces « aucune règle pour l'atelier », « site CCF introuvable ». */
  avertissements: z.array(z.string()),
})
export type ResultatRechercheDeblocage = z.infer<typeof ResultatRechercheDeblocageSchema>

/** RG-COO-151 / 243 : motif par défaut de « Rendre la main à la Pré-Prod » (maquette ECR-COO-09b). */
export const MOTIF_RENDRE_MAIN_DEFAUT = 'Changement de visuel demandé par le client'

export const DebloquerGroupeSchema = z.object({
  cle: z.string().min(1).max(200),
  motif: z.string().max(500).optional(),
})
export type DebloquerGroupe = z.infer<typeof DebloquerGroupeSchema>

export const DebloquerGroupeResultatSchema = z.object({
  message: z.string(),
  deblocageId: n,
  repartitionsAnnulees: n,
  unitesAnnulees: n,
  mailEnvoye: z.boolean(),
})

/** RG-COO-149 : période (dates ISO jour), défaut = le dernier mois. */
export const SuiviDeblocageQuerySchema = z.object({
  du: DateJourSchema.optional(),
  au: DateJourSchema.optional(),
})
export type SuiviDeblocageQuery = z.infer<typeof SuiviDeblocageQuerySchema>

export const DeblocageSuiviSchema = z.object({
  id: n,
  le: z.string(),
  par: z.string().nullable(),
  type: TypeGroupePreparationSchema,
  idPreparationChapeau: nn,
  idGroupePreparation: nn,
  contNum: n,
  annonceur: z.string().nullable(),
  semaine: z.object({ annee: n, semaine: n }),
  site: z.string().nullable(),
  typePreparation: z.string().nullable(),
  quantite: nn,
  motif: z.string(),
  repartitionsAnnulees: n,
  unitesAnnulees: n,
  mailStatut: z.string(),
})
export const ListeDeblocagesSchema = z.object({
  du: z.string(),
  au: z.string(),
  deblocages: z.array(DeblocageSuiviSchema),
})
export type ListeDeblocages = z.infer<typeof ListeDeblocagesSchema>
