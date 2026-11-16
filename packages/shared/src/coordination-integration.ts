import { z } from 'zod'
import { BusLigneBroadcastSchema } from './bus.ts'

// COO-P06 — intégration Broadcast : contrat d'entrée d'un lot (cinq flux, RG-COO-104), journal de chargement
// (RG-COO-116), « Rafraîchir un dossier » (RG-COO-132). La récupération chez Broadcast (procédures INTERFACE /
// EXTPLAY, webapicirce, planification réelle) est inconnue (Q-005, BLOQUÉ) : le lot est un contrat interne
// (HYPOTHÈSE Q-188 (1)). RG-COO-092 : une colonne attendue absente fait échouer la lecture (aucune valeur par
// défaut silencieuse) : tous les champs sont REQUIS, `null` explicite quand Broadcast n'a pas de valeur.

const n = z.number().int()
const nn = n.nullable()
const s = z.string().nullable()
const SemaineSchema = z.object({ annee: n.min(2000).max(2100), semaine: n.min(1).max(53) })
const DateSchema = z.coerce.date()

/** Destinataire désigné par sa clé PEX et son type de destination (RG-COO-119). */
export const CleDestinataireSchema = z.object({ type: n.min(1).max(5), clePex: n })

/** Flux 1 (RG-COO-091, 092) : ligne de l'état des réservations (P_CirceEtatReservation_New). */
export const LigneEtatReservationsSchema = z.object({
  idSiteCcf: nn,
  destinataire: s,
  contNum: n.positive(),
  annonceur: s,
  idSurface: nn,
  idFormat: nn,
  idPreparationChapeau: nn,
  idTypePreparation: nn,
  surface: s,
  format: s,
  idTheme: nn,
  theme: s,
  idThemeBandeau: nn,
  bandeau: s,
  idDaChapeau: nn,
  semaine: SemaineSchema,
  quantite: n.min(0),
  estResteEnPlace: z.boolean(),
  statutPreparation: s,
  assistantCommercial: s,
  assistantLogistique: s,
})
export type LigneEtatReservations = z.infer<typeof LigneEtatReservationsSchema>

/** Flux destinataires (RG-COO-118, 119) : adresse de livraison afficheur (P_GetAdresseLivraisonAfficheur). */
export const DestinataireBroadcastSchema = z.object({
  type: n.min(1).max(5),
  clePex: n,
  nom: z.string().min(1),
  adresse1: s,
  adresse2: s,
  codePostal: s,
  localite: s,
  lieuDit: s,
  pointRemise: s,
  mail: s,
  telephone: s,
  dateDebutPivot: DateSchema.nullable(),
  dateFinPivot: DateSchema.nullable(),
})
export type DestinataireBroadcast = z.infer<typeof DestinataireBroadcastSchema>

/** Flux préparation fixe / pliage (RG-COO-121, 122) : un groupe de préparation Broadcast et ses détails. */
export const DetailPreparationSchema = z.object({
  idPreparationDetail: n,
  contNum: n.positive(),
  idTypePreparation: n,
  supportId: nn,
  destinataire: CleDestinataireSchema.nullable(),
  annonceur: s,
  theme: s,
  repiquage: s,
  repiquageId: nn,
  quantite: n.min(0),
  semaine: SemaineSchema,
  dateAffichage: DateSchema.nullable(),
  numAfficheAmt: nn,
  /** rpc_statut de la ligne de travail (4 = annulée : non prise, RG-COO-121). */
  statutTravail: n,
  /** RG-COO-124 (HYPOTHÈSE Q-196) : `QuantiteEntretien` de Broadcast et date du premier départ (réalignement). */
  quantiteEntretien: nn.optional(),
  datePremierDepart: DateSchema.nullable().optional(),
})
export const GroupePreparationSchema = z.object({
  idGroupe: n,
  idSiteCcf: nn,
  /** Statut Broadcast du groupe (133 = envoyée, RG-COO-121 / 125). */
  statutBroadcast: n,
  details: z.array(DetailPreparationSchema),
})
export type GroupePreparation = z.infer<typeof GroupePreparationSchema>

/** Flux trains (RG-COO-126, 127, 129 à 131) : face d'un train d'affiches Broadcast. */
export const FaceBroadcastSchema = z.object({
  /** Id de la ligne côté INTERFACE (supprimé côté PEX après intégration, RG-COO-131). */
  idInterface: n,
  contNum: n.positive(),
  annonceur: s,
  semaine: SemaineSchema,
  depart: SemaineSchema,
  dateDepart: DateSchema,
  idSurface: nn,
  idSiteCcf: nn,
  cadrIdent: n,
  cadreLib: s,
  theme: s,
  themeId: nn,
  repiquage: s,
  repiquageId: nn,
  supportId: nn,
  destinataire: CleDestinataireSchema.nullable(),
  refPanel: s,
  afficheurId: nn,
  afficheurNom: s,
  ftType: s,
  /** `Traitement = 'E'` (lot marqué) et `IdTypeDestinationDA` non nul : face à intégrer. */
  traitement: z.string(),
  idTypeDestinationDa: nn,
  /** RG-COO-200 / 202 (COO-P09, HYPOTHÈSE Q-192 (1)) : emplacement legacy (secteur, département, commune,
   * n° d'emplacement, adresse), n° de train de l'emplacement et rang de la face. Optionnels : sans emplacement,
   * l'identifiant de train ne se calcule pas (RG-COO-205 (3)). */
  emplSectCode: nn.optional(),
  emplDepaCode: s.optional(),
  commNumord: nn.optional(),
  emplNumord: nn.optional(),
  emplAdresse1: s.optional(),
  train: nn.optional(),
  rang: nn.optional(),
})
export type FaceBroadcast = z.infer<typeof FaceBroadcastSchema>

/** Flux instructions (RG-COO-041, 126 à 128) : en-tête d'instruction (le code est calculé, RG-COO-127). */
export const InstructionLueSchema = z.object({
  idInterface: n,
  type: z.enum(['contrat', 'reseau']),
  contNum: n.positive(),
  semaine: SemaineSchema,
  idSurface: nn,
  idSiteCcf: nn,
  annonceur: s,
  commentaire: s,
  sectCodeCentre: nn,
  talrTrait: z.string(),
  entretien: nn,
  /** Contrat « bdx » (RG-COO-128 : visuels en bandeau). */
  origine: s,
  details: z.array(
    z.object({
      cadrIdent: nn,
      cadreLib: s,
      supportId: nn,
      idTypePreparation: nn,
      afchIdent: nn,
      theme: s,
      repiquageIdent: nn,
      repiquage: s,
      type: s,
    }),
  ),
  visuels: z.array(
    z.object({ afchIdent: n, supportId: nn, theme: s, pourcentage: z.number().nullable() }),
  ),
})
export type InstructionLue = z.infer<typeof InstructionLueSchema>

/** Lot d'un passage (RG-COO-104, 115) : `idInterface` = interface de chargement du premier flux. Le lot
 * entre par le connecteur Broadcast (port) ou la commande `integration:lot` (ordonnanceur), jamais par une
 * route utilisateur (Q-188 (1)). */
export const LotIntegrationSchema = z.object({
  idInterface: nn,
  lueLe: DateSchema,
  /** RG-COO-087 / 091 : true = lecture COMPLÈTE de la fenêtre ; seuls ces lots ferment les lignes des dossiers
   * absents de la lecture (un lot partiel ne ferme rien hors de ses dossiers). */
  lectureComplete: z.boolean(),
  etatReservations: z.array(LigneEtatReservationsSchema).optional(),
  /** BUS-01 : lignes de production par centre, parc et format (contrat interne, source réelle Q-005). */
  bus: z.array(BusLigneBroadcastSchema).optional(),
  destinataires: z.array(DestinataireBroadcastSchema).optional(),
  preparations: z.array(GroupePreparationSchema).optional(),
  trains: z.array(FaceBroadcastSchema).optional(),
  instructions: z.array(InstructionLueSchema).optional(),
  /** Ventes annulées dans Broadcast (RG-COO-062, RG-X-065) : n° de dossier. */
  dossiersAnnules: z.array(n.positive()).optional(),
})
export type LotIntegration = z.infer<typeof LotIntegrationSchema>

/** RG-COO-115 / 116 : flux d'un passage, dans l'ordre fixe d'exécution. */
export const FLUX_INTEGRATION = [
  'ETAT_RESERVATIONS',
  'DESTINATAIRES',
  'PREPARATIONS',
  'TRAINS',
  'INSTRUCTIONS',
  'RETOUR_BROADCAST',
] as const
export const FluxIntegrationSchema = z.enum(FLUX_INTEGRATION)
export type FluxIntegration = z.infer<typeof FluxIntegrationSchema>

/** RG-COO-116 : statuts du journal de chargement (legacy FluxChargement) : 1 en cours, 0 succès, 2 échec. */
export const STATUT_FLUX = { EN_COURS: 1, SUCCES: 0, ECHEC: 2 } as const

/** RG-COO-103 : passage manuel lancé depuis la source (aucun dépôt de lot par l'API, Q-188 (1)). */
export const LancerPassageSchema = z.object({}).strict()

export const FluxChargementSchema = z.object({
  id: n,
  flux: FluxIntegrationSchema,
  ordre: n,
  statut: n,
  debut: z.string(),
  fin: z.string().nullable(),
  lues: n,
  creees: n,
  misesAJour: n,
  ignorees: n,
  erreurs: n,
  message: z.string().nullable(),
})
export const PassageIntegrationSchema = z.object({
  id: n,
  declencheur: z.enum(['PLANIFIE', 'MANUEL', 'LOT']),
  par: z.string().nullable(),
  statut: z.enum(['EN_COURS', 'SUCCES', 'ECHEC']),
  debut: z.string(),
  fin: z.string().nullable(),
  message: z.string().nullable(),
  flux: z.array(FluxChargementSchema),
})
export type PassageIntegrationDto = z.infer<typeof PassageIntegrationSchema>
export const PassagesIntegrationSchema = z.object({
  passages: z.array(PassageIntegrationSchema),
  /** RG-COO-125 / 131 / 132 / 134 : messages vers Broadcast en attente d'envoi (Q-005). */
  envoisEnAttente: n,
  /** RG-COO-103 : horaires planifiés (paramètre) et état du planificateur. */
  horaires: z.array(z.string()),
  planificateurActif: z.boolean(),
})

export const RafraichirDossierSchema = z.object({ contNum: n.positive() })
export const RafraichirDossierResultatSchema = z.object({
  contNum: n,
  envoye: z.boolean(),
  message: z.string(),
})
