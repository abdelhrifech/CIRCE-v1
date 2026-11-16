import { z } from 'zod'
import { ROLES, RoleSchema } from './roles.ts'
import { TypeAlerteSchema, type TypeAlerte } from './alertes.ts'

// Étape 8, lot 3 — D-04 référentiels de réception (ECR-ADM-07, RG-REC-035 / 179), D-03 plateformes (RG-ADM-040 à 044
// provisoires), D-08 règles d'alerte (ECR-ADM-04, RG-REC-190, Q-375). Hypothèses : Q-407, Q-408.

const n = z.number().int()

// ───────────────────────────── D-04 : agents de réception (contrôleurs) ─────────────────────────────

/** Un agent de réception = un utilisateur au rôle `recep` (Q-177 (1)) : lecture seule, géré par « Utilisateurs ». */
export const AgentReceptionAdminSchema = z.object({
  id: n,
  identifiantExterne: z.string(),
  nom: z.string().nullable(),
  actif: z.boolean(),
  plateformes: z.array(z.string()),
})
export const AgentsReceptionAdminSchema = z.object({
  agents: z.array(AgentReceptionAdminSchema),
  total: n,
})
export type AgentReceptionAdmin = z.infer<typeof AgentReceptionAdminSchema>
export type AgentsReceptionAdmin = z.infer<typeof AgentsReceptionAdminSchema>
export type PlateformesAdmin = z.infer<typeof PlateformesAdminSchema>

// ───────────────────────────── D-03 : plateformes ─────────────────────────────

const texteOpt = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((s) => (s === '' ? null : s))
    .nullable()

/** Adresse mail : syntaxe minimale (la valeur d'existant n'était pas contrôlée : RG-ADM-042, Q-407 (3)). */
export const AdresseMailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Adresse trop longue (254 caractères au plus).')
  .regex(/^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/, 'Adresse mail invalide.')

export const ImprimantePlateformeSchema = z.object({
  id: n,
  nom: z.string(),
  actif: z.boolean(),
  version: n,
})
export const MailPlateformeSchema = z.object({ id: n, adresse: z.string() })

export const PlateformeAdminSchema = z.object({
  id: n,
  nom: z.string(),
  adresse1: z.string().nullable(),
  adresse2: z.string().nullable(),
  codePostal: z.string().nullable(),
  localite: z.string().nullable(),
  telephone: z.string().nullable(),
  /** `plt_mail` : adresses du mail de déblocage, séparées par des virgules (RG-ADM-044). */
  mailDeblocage: z.string().nullable(),
  idSiteCcf: n.nullable(),
  /** Adresses du mail de réception d'affiches (RG-ADM-042 / 043). */
  mailsReception: z.array(MailPlateformeSchema),
  imprimantes: z.array(ImprimantePlateformeSchema),
  version: n,
})
export type PlateformeAdmin = z.infer<typeof PlateformeAdminSchema>
export const PlateformesAdminSchema = z.object({
  plateformes: z.array(PlateformeAdminSchema),
  total: n,
})
export const PlateformesQuerySchema = z.object({ q: z.string().trim().min(1).max(100).optional() })

/** RG-ADM-040 : longueurs des colonnes d'existant (code postal 5, téléphone 14, mail 500) contrôlées ici (400). */
export const ModifierPlateformeSchema = z
  .object({
    version: n.positive(),
    nom: z.string().trim().min(1, 'Le nom est obligatoire.').max(150).optional(),
    adresse1: texteOpt(150, 'Adresse trop longue (150 caractères au plus).').optional(),
    adresse2: texteOpt(150, 'Adresse trop longue (150 caractères au plus).').optional(),
    codePostal: texteOpt(5, 'Code postal : 5 caractères au plus.').optional(),
    localite: texteOpt(100, 'Localité trop longue (100 caractères au plus).').optional(),
    telephone: texteOpt(14, 'Téléphone : 14 caractères au plus.').optional(),
    mailDeblocage: texteOpt(500, 'Mail : 500 caractères au plus.')
      .refine(
        (v) =>
          v === null ||
          v
            .split(',')
            .map((a) => a.trim())
            .every((a) => /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(a)),
        'Mail de déblocage : adresses valides séparées par des virgules.',
      )
      .optional(),
    idSiteCcf: n.positive().nullable().optional(),
  })
  .strict()
export type ModifierPlateforme = z.infer<typeof ModifierPlateformeSchema>

export const AjouterMailPlateformeSchema = z.object({ adresse: AdresseMailSchema })
export const AjouterImprimanteSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom de l’imprimante est obligatoire.').max(150),
})
export const ModifierImprimanteSchema = z.object({ actif: z.boolean(), version: n.positive() })

// ───────────────────────────── D-08 : règles d'alerte ─────────────────────────────

/** Canaux de la maquette ECR-ADM-04 (mot pour mot) ; aucun mail ne part (Q-375). */
export const CANAUX_ALERTE = [
  'BANDEAU',
  'BANDEAU_MAIL',
  'BANDEAU_MAIL_IMMEDIAT',
  'BANDEAU_DIGEST_7H',
  'DESACTIVEE',
] as const
export const CanalAlerteSchema = z.enum(CANAUX_ALERTE)
export type CanalAlerte = z.infer<typeof CanalAlerteSchema>
export const LIBELLES_CANAUX: Record<CanalAlerte, string> = {
  BANDEAU: 'Bandeau',
  BANDEAU_MAIL: 'Bandeau + mail',
  BANDEAU_MAIL_IMMEDIAT: 'Bandeau + mail immédiat',
  BANDEAU_DIGEST_7H: 'Bandeau + digest 7h',
  DESACTIVEE: 'Désactivée',
}
/** Libellé d'un rôle destinataire, aligné sur les alertes calculées (`DESTINATAIRES`). */
export const LIBELLES_DESTINATAIRES: Record<(typeof ROLES)[number], string> = {
  coord: 'Coordination',
  cheq: 'Chefs d’équipe',
  recep: 'Réception',
  admin: 'Administrateur',
  expe: 'Expédition',
  com: 'Commerce',
}

/** Déclencheur et seuil de chaque type (lecture seule : maquette ECR-ADM-04, « seul le canal est modifiable » ;
 * les seuils réels sont des paramètres métier, D-06). `calculee` = le type est produit par le code actuel. */
export interface CatalogueRegleAlerte {
  declencheur: string
  seuil: string | null
  /** Paramètre métier qui porte le seuil (valeur courante lue par l'API). */
  parametre?: string
  regles: string[]
  calculee: boolean
}
export const CATALOGUE_ALERTES: Record<TypeAlerte, CatalogueRegleAlerte> = {
  MANQUANT: {
    declencheur: 'Visuel non reçu ou reçu en partie pour un départ en S ou S+1',
    seuil: 'Départ en S : critique (non reçu) ou important (partiel) ; S+1 : à surveiller',
    regles: ['RG-REC-182'],
    calculee: true,
  },
  ECART: {
    declencheur: 'Quantité reçue au-delà du seuil d’écart',
    seuil: 'Écart de réception (%)',
    parametre: 'reception.ecartReception',
    regles: ['RG-REC-183'],
    calculee: true,
  },
  SANS_IP: {
    declencheur: 'Affiche reçue sur un dossier sans instructions de pose',
    seuil: null,
    regles: ['RG-COO-071', 'RG-REC-184'],
    calculee: true,
  },
  ORPHELINE: {
    declencheur: 'Réception inconnue à identifier',
    seuil: 'Importante après le délai de contrôle (h)',
    parametre: 'reception.delaiControle',
    regles: ['RG-REC-185'],
    calculee: true,
  },
  DOSSIER_INTROUVABLE: {
    declencheur: 'Réception inconnue signalée « dossier introuvable »',
    seuil: null,
    regles: ['RG-REC-186'],
    calculee: true,
  },
  VALIDATION_ADMIN: {
    declencheur: 'Validation admin à confirmer (doute)',
    seuil: null,
    regles: ['RG-COO-033'],
    calculee: true,
  },
  CONTROLE_RETARD: {
    declencheur: 'Palette dans le sas depuis plus que le délai de contrôle',
    seuil: 'Délai (h) ; importante au double',
    parametre: 'reception.delaiControle',
    regles: ['RG-REC-189'],
    calculee: true,
  },
  IP_MANQUANTES: {
    declencheur: 'Préparation non reçue à l’échéance',
    seuil: 'Jeudi de S-2, 16 h',
    regles: ['RG-COO-066'],
    calculee: true,
  },
  ECART_BC: {
    declencheur: 'Écart Broadcast / Circé sur la quantité d’un dossier',
    seuil: null,
    regles: ['RG-COO-031', 'RG-COO-032'],
    calculee: true,
  },
  THEMES_PROCHES: {
    declencheur: 'Thèmes proches d’un même annonceur à vérifier',
    seuil: 'Seuil de similarité des thèmes',
    regles: ['RG-COO-069'],
    calculee: true,
  },
  ANNONCEURS_PROCHES: {
    declencheur: 'Annonceurs proches à vérifier',
    seuil: null,
    regles: ['RG-COO-070'],
    calculee: true,
  },
  THEME_BC: {
    declencheur: 'Thème modifié dans Broadcast après validation',
    seuil: null,
    regles: ['RG-COO-068'],
    calculee: true,
  },
  DM_FICHIER: {
    declencheur: 'Rajout de dernière minute sur un train déjà en production',
    seuil: null,
    regles: ['RG-X-077'],
    calculee: true,
  },
  APRES_LIBERATION: {
    declencheur: 'Rajout après la préparation (après libération de la semaine)',
    seuil: 'Fenêtre de rajout',
    parametre: 'coordination.fenetreRajout',
    regles: ['RG-COO-073', 'RG-X-076', 'RG-X-011'],
    calculee: true,
  },
  DEPART_RISQUE: {
    declencheur: 'Départ camion à risque (maquette : 72 h ; critique sous 36 h)',
    seuil: 'Valeurs de maquette sans source (Q-373)',
    regles: [],
    calculee: false,
  },
  THEME_MODIF: {
    declencheur: 'Feuille de stock à refaire (thème modifié)',
    seuil: null,
    regles: ['RG-REC-188'],
    calculee: true,
  },
  NC_BLOQUANTE: {
    declencheur: 'Non-conformité bloquante sans décision de la Préproduction',
    seuil: null,
    regles: ['RG-NEW-NC-002'],
    calculee: true,
  },
  FEUILLE_DEFINITIVE: {
    declencheur:
      'Feuille de stock définitive à imprimer (feuille temporaire sur affiche rattachée)',
    seuil: null,
    regles: ['RG-REC-187'],
    calculee: true,
  },
  INTEGRATION: {
    declencheur: 'Échec ou anomalie d’intégration Broadcast',
    seuil: null,
    regles: ['RG-COO-103', 'RG-COO-116', 'RG-COO-122', 'RG-COO-145'],
    calculee: true,
  },
}

export const RegleAlerteAdminSchema = z.object({
  type: TypeAlerteSchema,
  libelle: z.string(),
  declencheur: z.string(),
  seuil: z.string().nullable(),
  /** Valeur courante du paramètre qui porte le seuil (D-06), ou null. */
  valeurSeuil: z.string().nullable(),
  regles: z.array(z.string()),
  calculee: z.boolean(),
  canal: CanalAlerteSchema,
  /** Rôles destinataires configurés ; vide = destinataires calculés par défaut. */
  destinataires: z.array(RoleSchema),
  /** 0 = jamais modifiée (valeurs par défaut). */
  version: n,
})
export type RegleAlerteAdmin = z.infer<typeof RegleAlerteAdminSchema>
export const ReglesAlerteAdminSchema = z.object({ regles: z.array(RegleAlerteAdminSchema) })

export const ModifierRegleAlerteSchema = z.object({
  /** Version lue (0 si la règle n'a jamais été modifiée). */
  version: n.min(0),
  canal: CanalAlerteSchema,
  destinataires: z.array(RoleSchema).max(ROLES.length).default([]),
})
export type ModifierRegleAlerte = z.infer<typeof ModifierRegleAlerteSchema>
