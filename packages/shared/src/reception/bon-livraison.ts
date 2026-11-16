import { z } from 'zod'
import { ConstatNcSchema } from '../nonconformite.ts'

// REC-P03 — Panier, photo du BL et bon de livraison (ECR-REC-01, ECR-REC-07, ECR-REC-11, ECR-REC-12).

/** RG-REC-027 / Q-113 (HYPOTHÈSE) : types et taille acceptés pour une photo (BL ou affiche). */
export const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const TAILLE_MAX_PHOTO = 10 * 1024 * 1024

export const EnvoiPhotoSchema = z.object({
  intitule: z.string().trim().min(1).max(250),
  mimeType: z.string(),
  /** Contenu du fichier encodé en base64. */
  contenuBase64: z.string().min(1),
})
export type EnvoiPhoto = z.infer<typeof EnvoiPhotoSchema>

export const PhotoSchema = z.object({
  id: z.number().int(),
  intitule: z.string().nullable(),
  mimeType: z.string(),
  taille: z.number().int(),
})
export type Photo = z.infer<typeof PhotoSchema>

/** RG-REC-035 : listes fermées du bon de livraison. */
export const ReferentielsReceptionSchema = z.object({
  imprimeurs: z.array(z.object({ id: z.number().int(), libelle: z.string() })),
  livreurs: z.array(z.object({ id: z.number().int(), libelle: z.string() })),
  /** Agents avec leurs plateformes : l'écran ne propose que ceux de la plateforme du BL (RG-REC-035). */
  agents: z.array(
    z.object({ id: z.number().int(), nom: z.string(), plateformeIds: z.array(z.number().int()) }),
  ),
  /** ECR-REC-08 : sites du périmètre, avec l'allée tampon des réceptions inconnues (Q-105, par site). */
  plateformes: z.array(
    z.object({ id: z.number().int(), nom: z.string(), alleeInconnues: z.string() }),
  ),
  /** ECR-REC-08 : formats (catégories de support). */
  formats: z.array(z.object({ id: z.number().int(), nom: z.string() })),
})
export type ReferentielsReception = z.infer<typeof ReferentielsReceptionSchema>

export const LignePanierSchema = z.object({
  ligneAttendueId: z.number().int().positive(),
  /** RG-REC-023 : nombre entier ≥ 0 (le refus d'une valeur négative est fait par le service : 400 REC_QTE_NEGATIVE). */
  quantite: z.number().int(),
  cochee: z.boolean(),
})

/** RG-REC-033 : bon de livraison. Les obligations (n° de BL, transporteur, imprimeur) sont contrôlées par le service. */
export const BonLivraisonSchema = z.object({
  lignes: z.array(LignePanierSchema).max(500),
  photoBlId: z.number().int().positive().nullable(),
  /** RG-NEW-REC-001 : déclaration explicite, jamais déduite d'une photo absente. */
  sansBl: z.boolean().optional(),
  numeroBl: z.string().trim().max(50).default(''),
  livreurId: z.number().int().positive().nullable(),
  imprimeurId: z.number().int().positive().nullable(),
  nbColis: z.number().int().min(1, 'Le nombre de colis / palettes est au moins 1.').default(1),
  dechargeParId: z.number().int().positive().nullable().default(null),
})
export type BonLivraison = z.infer<typeof BonLivraisonSchema>

export const VerificationBlSchema = z.object({
  plateformeId: z.number().int(),
  /** RG-REC-034 : date de livraison en lecture = maintenant. */
  dateLivraison: z.string(),
  lignes: z.array(
    z.object({
      ligneAttendueId: z.number().int(),
      quantite: z.number().int(),
      mode: z.enum(['BL', 'MAIN']),
    }),
  ),
  /** RG-REC-023 / Q-166 : lignes cochées à quantité 0, ignorées avec mention. */
  lignesIgnorees: z.array(z.number().int()),
  nombreLignes: z.number().int(),
  nombreAffiches: z.number().int(),
  /** RG-REC-036 / Q-114 : avertissements à confirmer (non bloquants). */
  avertissements: z.array(
    z.object({
      code: z.literal('REC_BL_DOUBLON'),
      message: z.string(),
      receptions: z.array(z.number().int()),
    }),
  ),
})
export type VerificationBl = z.infer<typeof VerificationBlSchema>

/** RG-REC-203 : modale Visuel (données disponibles côté Circé ; l'état des réservations complet est D-10). */
export const VisuelLigneSchema = z.object({
  id: z.number().int(),
  dossier: z.number().int().nullable(),
  da: z.number().int().nullable(),
  site: z.string(),
  atelier: z.string().nullable(),
  format: z.string().nullable(),
  depart: z.string(),
  annonceur: z.string().nullable(),
  theme: z.string().nullable(),
  repiquage: z.string().nullable(),
  recu: z.number().int(),
  attendu: z.number().int(),
  affiches: z.array(
    z.object({ id: z.number().int(), allee: z.string().nullable(), rayon: z.string().nullable() }),
  ),
  exclusion: z.boolean(),
})
export type VisuelLigne = z.infer<typeof VisuelLigneSchema>

/** REC-P04 — « Valider la réception » : le bon de livraison vérifié + compléments, intitulés, confirmation. */
export const ValiderReceptionSchema = BonLivraisonSchema.extend({
  nonConformite: ConstatNcSchema.optional(),
  lignes: z
    .array(
      LignePanierSchema.extend({
        /** RG-REC-040 : « Complément de l'affiche N » (affiche déjà rattachée à cette ligne). */
        complementAfficheId: z.number().int().positive().nullable().default(null),
        /** RG-REC-047 : « Intitulé saisi (sans IP) » quand la ligne n'a pas de thème. */
        intituleSaisi: z.string().trim().max(250).nullable().default(null),
      }),
    )
    .max(500),
  /** RG-REC-036 / Q-114 : confirmation explicite d'un n° de BL déjà réceptionné. */
  confirmerDoublon: z.boolean().default(false),
})
export type ValiderReception = z.infer<typeof ValiderReceptionSchema>

export const ReceptionCreeeSchema = z.object({
  receptionId: z.number().int(),
  affiches: z.array(
    z.object({
      id: z.number().int(),
      ligneAttendueId: z.number().int(),
      quantite: z.number().int(),
      complement: z.boolean(),
    }),
  ),
  lignesIgnorees: z.array(z.number().int()),
  /** RG-X-003 : unités (trains) passées « prêtes à produire » par cette réception. */
  unitesPretes: z.number().int(),
  /** RG-REC-038 : message de confirmation de la maquette (partie Réception). */
  message: z.string(),
})
export type ReceptionCreee = z.infer<typeof ReceptionCreeeSchema>

/** RG-REC-047 / RG-REC-048 : intitulé déjà saisi par l'autre plateforme (« le 1er qui a parlé »). */
export const IntituleSuggereSchema = z
  .object({ intitule: z.string(), site: z.string(), afficheId: z.number().int() })
  .nullable()
