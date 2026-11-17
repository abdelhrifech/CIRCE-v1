import { z } from 'zod'

// COO-P01 — socle Coordination : statuts d'instruction et de préparation du dossier, liste ECR-COO-01.

const n = z.number().int()

/** RG-COO-040 : statuts de l'instruction (grain dossier × semaine × atelier), codes legacy 0 à 5. */
export const STATUTS_INSTRUCTION = [
  'A_TRAITER',
  'EN_COURS',
  'INSTRUCTION_OK',
  'ERREUR',
  'ANNULE',
  'PRET_A_PRODUIRE',
] as const
export const StatutInstructionSchema = z.enum(STATUTS_INSTRUCTION)
export type StatutInstruction = z.infer<typeof StatutInstructionSchema>

/** RG-COO-063 : statut de préparation du dossier (persisté). */
export const STATUTS_PREPARATION = ['A_TRAITER', 'PREPARATION_RECUE', 'ANNULE'] as const
export const StatutPreparationSchema = z.enum(STATUTS_PREPARATION)

/** RG-COO-045 / RG-COO-046 : statuts qu'un utilisateur peut demander (les autres sont posés par Circé). */
export const ChangerStatutInstructionSchema = z.object({
  version: n,
  vers: z.enum(['A_TRAITER', 'EN_COURS', 'ANNULE']),
})
export type ChangerStatutInstruction = z.infer<typeof ChangerStatutInstructionSchema>

export const InstructionResumeSchema = z.object({
  code: z.string(),
  version: n,
  statut: StatutInstructionSchema,
  atelier: z.object({ id: n, libelle: z.string(), plateforme: z.string() }).nullable(),
  depart: z.string().nullable(),
  type: z.string().nullable(),
  commentaire: z.string().nullable(),
  /** Transitions qu'un utilisateur peut demander depuis ce statut (le serveur reste juge). */
  actions: z.array(z.enum(['A_TRAITER', 'EN_COURS', 'ANNULE', 'INSTRUCTION_OK'])),
  /** RG-COO-042 / 044 : mode de l'Instruction OK (« automatique » / « après contrôle »). */
  iokMode: z.enum(['AUTO', 'MANUEL']).nullable(),
  entretien: n.nullable(),
  position: n.nullable(),
  /** RG-COO-042 / 055 : motifs qui gardent l'instruction « En cours » (commentaire, exceptions, répartition, écart). */
  motifs: z.array(z.enum(['COMMENTAIRE', 'EXCEPTIONS', 'REPARTITION', 'ECART'])),
  /** RG-COO-059 : position proposée d'après le commentaire de prépa (jamais appliquée seule). */
  positionProposee: n.nullable(),
})

// ── COO-P03 : validation admin (calculée, RG-COO-007 / RG-COO-019) ──
/** RG-COO-007 : état de validation d'une affiche (calculé, jamais saisi). */
export const ETATS_VALIDATION = [
  'RECEPTION_INCONNUE',
  'VALIDEE',
  'A_CONFIRMER_DOUTE',
  'A_CONFIRMER_PROPOSE',
] as const
export const EtatValidationSchema = z.enum(ETATS_VALIDATION)
export type EtatValidation = z.infer<typeof EtatValidationSchema>
/** RG-COO-006 : motifs de doute (calculés, cumulables). */
/** LIGNE_FERMEE : lien vers une ligne attendue fermée, à re-rattacher (RG-COO-005 (a), RG-X-055, Q-185 (10)). */
export const MOTIFS_DOUTE = [
  'BL',
  'FORMAT',
  'THEME',
  'MULTI',
  'SANS_IP',
  'ANNULEE',
  'LIGNE_FERMEE',
] as const
export const MotifDouteSchema = z.enum(MOTIFS_DOUTE)
export type MotifDoute = z.infer<typeof MotifDouteSchema>
/** RG-COO-019 : pastille « Validation admin » du dossier. */
export const ETATS_VALIDATION_DOSSIER = [
  'SANS_OBJET',
  'A_CONFIRMER',
  'VALIDEE',
  'AUCUNE_AFFICHE_RECUE',
] as const
export const EtatValidationDossierSchema = z.enum(ETATS_VALIDATION_DOSSIER)
export const ValidationDossierSchema = z.object({
  etat: EtatValidationDossierSchema,
  /** Affiches à confirmer (proposées + à doute). */
  aConfirmer: n,
  doutes: n,
  /** RG-COO-011 : dossier « cas sûr » (pré-coché). */
  casSur: z.boolean(),
})

export const DossierCoordinationSchema = z.object({
  lignesPreparation: z
    .array(
      z.object({
        id: n,
        type: z.string().nullable(),
        repartition: z.string().nullable(),
        theme: z.string().nullable(),
        repiquage: z.string().nullable(),
        format: z.string().nullable(),
        quantite: n.nullable(),
        destinataire: z.string().nullable(),
        depart: z.string().nullable(),
        atelier: z.string().nullable(),
        dateAffichage: z.string().nullable(),
      }),
    )
    .optional(),
  id: n,
  version: n,
  dossier: n,
  /** RG-COO-066 / 076 : deadline Pré-Prod du premier départ (prépa non reçue), sinon null. */
  deadlinePrepa: z.string().nullable(),
  /** RG-COO-066 : deadline dépassée → teinte critique (ECR-COO-01). */
  deadlineDepassee: z.boolean(),
  /** ECR-COO-01 colonne masquée « Visuels » : nb de thèmes, thème proche (RG-COO-069), modifié dans BC (068). */
  pastillesVisuels: z.object({
    nb: n,
    procheAVerifier: z.boolean(),
    modifieBroadcast: z.boolean(),
  }),
  annonceur: z.string().nullable(),
  preparation: StatutPreparationSchema,
  departs: z.array(z.string()),
  instructions: z.array(InstructionResumeSchema),
  /** RG-COO-055 : écart Broadcast / Circé (qte_BC − qte_Circé), null si non calculable. */
  ecart: n.nullable(),
  /** RG-COO-019 / RG-COO-020 : validation admin du dossier (calculée). */
  validationAdmin: ValidationDossierSchema,
  /** RG-COO-060 : « À faire (Coordination) » (validation à confirmer, Instruction OK en cours ou écart). */
  aFaire: z.boolean(),
  /** RG-COO-057 : date de la dernière demande de correction à Broadcast. */
  correctionDemandeeLe: z.string().nullable(),
})
export type DossierCoordination = z.infer<typeof DossierCoordinationSchema>

export const ListeDossiersQuerySchema = z.object({
  dossier: z.coerce.number().int().optional(),
  preparation: StatutPreparationSchema.optional(),
  atelierId: z.coerce.number().int().optional(),
  /** RG-COO-060 : « À faire (Coordination) » / « Rien à faire » ; absent = tous. */
  aFaire: z.enum(['A_FAIRE', 'RIEN']).optional(),
  /** RG-COO-019 : filtre « Validation admin ». */
  va: z.enum(['A_CONFIRMER', 'VALIDEE', 'AUCUNE_AFFICHE_RECUE']).optional(),
  /** ECR-COO-05 « Voir les dossiers » : seuls les dossiers ayant une instruction d'un atelier déroulant. */
  pour: z.enum(['DEROULANT', 'FIXE', 'PLIAGE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})
export type ListeDossiersQuery = z.infer<typeof ListeDossiersQuerySchema>

export const ListeDossiersSchema = z.object({
  items: z.array(DossierCoordinationSchema),
  total: n,
  /** RG-COO-011 : nombre de dossiers « cas sûrs » sous le filtre courant (bouton « Cocher les cas sûrs (n) »). */
  casSurs: n,
  page: n,
  pageSize: n,
})

export const StatutInstructionChangeSchema = z.object({
  code: z.string(),
  version: n,
  statut: StatutInstructionSchema,
  facesSupprimees: n,
  facesRemisesABlanc: n,
  message: z.string(),
})

/** RG-COO-167 : ateliers du périmètre de l'utilisateur (liste de choix « Atelier »). */
export const AteliersPerimetreSchema = z.object({
  ateliers: z.array(z.object({ id: n, libelle: z.string(), plateforme: z.string() })),
})

export const CodeInstructionParamSchema = z.object({ code: z.string().min(1).max(18) })

// ── COO-P02 ──
export const InstructionOkSchema = z.object({
  instructions: z
    .array(z.object({ code: z.string().min(1).max(18), version: n }))
    .min(1)
    .max(200),
})
export const InstructionOkResultatSchema = z.object({
  instructions: z.array(z.object({ code: z.string(), version: n })),
  message: z.string(),
})

/** RG-COO-047 / 048 / 050 : champs saisis par la Coordination (entretien 0-30, position 0-4). */
export const ModifierInstructionSchema = z.object({
  version: n,
  entretien: n.optional(),
  position: n.optional(),
  annonceur: z.string().trim().max(100).optional(),
  commentaire: z.string().trim().max(2000).optional(),
})
export const InstructionModifieeSchema = z.object({
  code: z.string(),
  version: n,
  message: z.string(),
})

export const AppliquerVersionBroadcastSchema = z.object({ version: n })
export const VersionBroadcastResultatSchema = z.object({
  dossierId: n,
  ecart: n,
  message: z.string(),
})

export const DemandeCorrectionSchema = z.object({ note: z.string().trim().max(2000).default('') })
export const DemandeCorrectionResultatSchema = z.object({
  demandeId: n,
  dejaDemandeeLe: z.string().nullable(),
  mailEnvoye: z.boolean(),
  message: z.string(),
})

/** Une affiche reçue d'un dossier et sa validation admin (ECR-COO-02, ECR-COO-03). */
export const AfficheValidationSchema = z.object({
  id: n,
  version: n,
  theme: z.string().nullable(),
  /** Quantité rattachée à ce dossier (information ; jamais une condition, RG-COO-016). */
  quantite: n,
  /** ECR-COO-02 « Thème (quantité) » : une entrée par ligne du dossier. */
  themes: z.array(z.object({ theme: z.string().nullable(), quantite: n })),
  /** ECR-COO-02 « Reçue » : quantité reçue de l'affiche. */
  quantiteRecue: n,
  recueLe: z.string(),
  emplacement: z.string().nullable(),
  etat: EtatValidationSchema,
  motifs: z.array(MotifDouteSchema),
  validePar: z.string().nullable(),
  valideLe: z.string().nullable(),
  /** RG-COO-024 : « reçue et associée » (lien actif ET validée) envoyé au prochain retour vers Broadcast. */
  estAssociee: z.boolean(),
})
export type AfficheValidation = z.infer<typeof AfficheValidationSchema>

/** RG-COO-008 / RG-COO-014 : « Valider » / « Annuler la validation » d'une affiche (fiche dossier). */
export const ChangerValidationAfficheSchema = z.object({ version: n, valider: z.boolean() })
export const ValidationAfficheResultatSchema = z.object({
  afficheId: n,
  version: n,
  message: z.string(),
})
export const IdAfficheParamSchema = z.object({ id: z.coerce.number().int().positive() })

/** RG-COO-023 : étiquettes rack à imprimer, groupées par plateforme. */
export const EtiquettesRackSchema = z.object({
  groupes: z.array(z.object({ plateformeId: n, plateforme: z.string(), afficheIds: z.array(n) })),
})

/** RG-COO-010 / 012 / 013 : « Valider la sélection ». */
export const ValiderSelectionSchema = z
  .object({
    // RG-COO-010 / Q-203 : aucun plafond de taille de lot (ANO-026).
    dossierIds: z.array(z.number().int().positive()).default([]),
    /** RG-NEW-REC-004 : validation limitée aux affiches sélectionnées. */
    afficheIds: z.array(z.number().int().positive()).min(1).max(500).optional(),
    /** RG-COO-012 : confirmation explicite des affiches à doute listées dans `doutes` (vues dans la modale). */
    confirmerDoutes: z.boolean().default(false),
    doutes: z.array(z.object({ id: n, version: n })).default([]),
    /** ECR-COO-03 : « Confirmer les n sans doute seulement ». */
    sansDouteSeulement: z.boolean().default(false),
  })
  .refine((v) => v.dossierIds.length > 0 || (v.afficheIds?.length ?? 0) > 0, {
    message: 'Sélectionnez au moins une affiche ou un dossier.',
  })
export type ValiderSelection = z.infer<typeof ValiderSelectionSchema>
export const ValiderSelectionResultatSchema = z.object({
  confirmees: z.array(z.object({ id: n, version: n })),
  ignorees: z.array(
    z.object({
      id: n,
      raison: z.enum([
        'DOUTE_NON_CONFIRME',
        'DOUTE_NON_VU',
        'VERSION',
        'PLUS_A_CONFIRMER',
        'FUSIONNEE',
      ]),
    }),
  ),
  message: z.string(),
})
/** RG-COO-012 : `details` du refus 422 (contenu de la modale ECR-COO-03). */
export const DoutesAConfirmerSchema = z.object({
  sansDoute: n,
  doutes: z.array(AfficheValidationSchema.extend({ dossier: n })),
})

/** ECR-COO-02 — fiche dossier. */
export const FicheDossierSchema = DossierCoordinationSchema.extend({
  visuels: z.array(
    z.object({
      instruction: z.string(),
      afchIdent: n.nullable(),
      theme: z.string().nullable(),
      pourcentage: z.number().nullable(),
      pourcentageBroadcast: z.number().nullable(),
    }),
  ),
  lignes: z.array(
    z.object({
      id: n,
      theme: z.string().nullable(),
      format: z.string().nullable(),
      depart: z.string(),
      qteBc: n.nullable(),
      qtePrepa: n.nullable(),
      exclu: z.boolean(),
      /** ECR-COO-02 : nombre d'affiches reçues rattachées à la ligne (0 → « Pas encore reçue »). */
      affichesRecues: n,
      /** RG-COO-026 : état des réservations — « • » proposée dès la réception, « ✓ » validée. */
      affiches: z.array(z.object({ id: n, marque: z.enum(['•', '✓']) })),
      /** RG-COO-021 : n° d'affiche visibles au suivi de production (validée ET ligne de source PREPA). */
      numerosSuiviProd: z.array(n),
      etatLigne: z.enum(['ACTIVE', 'ANNULEE']),
    }),
  ),
  /** ECR-COO-02 / RG-COO-068 : thème modifié dans Broadcast (« Reprendre la version Broadcast »). */
  themesModifies: z.array(
    z.object({
      ligneAttendueId: n,
      version: n,
      themeCirce: z.string().nullable(),
      themeBroadcast: z.string().nullable(),
      productionLancee: z.boolean(),
    }),
  ),
  /** ECR-COO-02 / RG-COO-069 : groupes de thèmes proches à vérifier du dossier. */
  themesProches: z.array(
    z.object({ cle: z.string(), libelles: z.array(z.string()), autresDossiers: z.array(n) }),
  ),
  /** RG-COO-032 : affiches rattachées à une ligne annulée, à re-rattacher (alerte Coordination). */
  aReRattacher: z.array(z.object({ afficheId: n, theme: z.string().nullable() })),
  /** ECR-COO-02 : « Affiches reçues et validation admin » (RG-COO-006 / 007). */
  affiches: z.array(AfficheValidationSchema),
  /** ECR-COO-02 : frise d'historique (dossier et instructions), RG-COO-160. */
  historique: z.array(
    z.object({
      le: z.string(),
      objet: z.string(),
      action: z.string(),
      ancien: z.string().nullable(),
      nouveau: z.string().nullable(),
      par: z.string().nullable(),
    }),
  ),
  corrections: z.array(
    z.object({
      le: z.string(),
      note: z.string().nullable(),
      par: z.string().nullable(),
      mailEnvoye: z.boolean(),
    }),
  ),
})
export type FicheDossier = z.infer<typeof FicheDossierSchema>
export const IdDossierParamSchema = z.object({ id: z.coerce.number().int().positive() })
