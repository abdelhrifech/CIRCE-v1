import { z } from 'zod'

// RG-NEW-NC-002 — maquette nonconformite.js (10/11), portée et décision uniques.
export const NC_BLOQUANTES = [
  'Affiches trempées ou abîmées',
  'Encre qui a coulé',
  'Erreur de format (ex. scro reçu à la place de colle)',
  'Erreur de papier',
  'Casse à la production',
  'Thèmes mélangés',
  'Formats mélangés',
  'Palettes non conformes',
] as const
export const NC_NON_BLOQUANTES = [
  'Rouleaux au lieu de palettes',
  'BL non conforme',
  'Papier de mauvaise qualité',
] as const
export const NC_A_PRECISER = ['Croix mal positionnées', 'Écart de quantité'] as const
export const NC_TYPES = [...NC_BLOQUANTES, ...NC_A_PRECISER, ...NC_NON_BLOQUANTES] as const
export const NC_DECISIONS = [
  'Décision Commerce',
  'OK préparation en l’état',
  'Nouvelle impression/Livraison',
  'Nouvelle préparation',
  'NON JUSTIFIE',
  'Pas de stock d’affiche',
  'RAF',
  'À traiter par la plateforme',
  'Traité par la plateforme',
] as const
export const NC_CONTROLES = [
  'Contrôle du visuel',
  'Format NC',
  'Etat des affiches',
  'Encre pas sèche',
] as const
export const NC_TYPES_AGENCE = [
  'Affiches Non Reçues ou Quantité livrée insuffisante',
  'Assemblage Non Conforme',
  'Bandeaux non reçus',
  'Palette/Colis/Affiches reçus abîmés',
  'Papier de mauvaise qualité / Qualité zip',
  'Reçu mauvaises affiches / bandeaux',
] as const
export const NC_FORMATS = [
  '12 m² Colle',
  '2 m² déroulant',
  '2 m² fixe',
  '4 m² Colle',
  '4 m² déroulant',
  '8 m² Colle',
  '8 m² déroulant',
  'BUS',
  'Autre format',
] as const
export const NC_STATUTS = [
  'Pour statistique',
  'À décider',
  'En cours plateforme',
  'Traitée',
] as const
const texte = z.string().trim().max(4000).default('')
const liste = z.array(z.string().trim().min(1).max(250)).max(50).default([])
export const NcDonneesSchema = z.object({
  declarant: texte,
  region: texte,
  afficheur: texte,
  dossier: texte,
  semaine: texte,
  quantite: texte,
  annonceur: texte,
  theme: texte,
  formats: z.array(z.enum(NC_FORMATS)).default([]),
  lieu: texte,
  dateAff: texte,
  types: liste,
  imprimeur: texte,
  imprimeurAutre: texte,
  transporteur: texte,
  transporteurAutre: texte,
  avarie: z.enum(['', 'OUI', 'NON']).default(''),
  controlePossible: z.enum(['Oui', 'Non']).default('Oui'),
  controle: z.array(z.enum(NC_CONTROLES)).default([]),
  detailVisuel: z.array(z.enum(['Thèmes', 'Qualité impression'])).default([]),
  statutEtat: z.enum(['', 'Non utilisable', 'Partiellement utilisables']).default(''),
  commentaire: texte,
  commentaireNC: texte,
  numeroAffichesManquantes: texte,
  gestionnaire: texte,
  admin: texte,
  actionPreprod: texte,
  actionPlateforme: texte,
  decisionPlateforme: texte,
  commentaireDecisionPlateforme: texte,
  reception: liste,
  ncCond: texte,
  ncBL: liste,
  reserve: texte,
  numerosManquants: texte,
  nbAffichesManquantes: texte,
  mesureCm2: texte,
  commentaireAgence: texte,
  ncQtesBT: texte,
  nbColis: texte,
  nbPalettes: texte,
  qteRecue: texte,
  qteManquante: texte,
})
export const CasNcSchema = z.object({
  afficheId: z.number().int(),
  plateformeId: z.number().int(),
  plateforme: z.string(),
  validation: z.boolean(),
  donnees: NcDonneesSchema,
})
export const CasNcListeSchema = z.object({ items: z.array(CasNcSchema) })
export type CasNc = z.infer<typeof CasNcSchema>
export type NcDonnees = z.infer<typeof NcDonneesSchema>
export function porteeNc(types: readonly string[]): boolean | null {
  if (types.some((t) => (NC_BLOQUANTES as readonly string[]).includes(t))) return true
  if (types.length && types.every((t) => (NC_NON_BLOQUANTES as readonly string[]).includes(t)))
    return false
  return null
}
export function statutNc(
  bloquante: boolean | null,
  decisions: readonly string[],
): (typeof NC_STATUTS)[number] {
  if (bloquante === false) return 'Pour statistique'
  if (!decisions.length) return 'À décider'
  if (decisions.includes('Traité par la plateforme')) return 'Traitée'
  return decisions.some((d) =>
    [
      'Décision Commerce',
      'Nouvelle impression/Livraison',
      'Nouvelle préparation',
      'Pas de stock d’affiche',
      'À traiter par la plateforme',
    ].includes(d),
  )
    ? 'En cours plateforme'
    : 'Traitée'
}
export const NcFichierEnvoiSchema = z.object({
  nom: z.string().trim().min(1).max(250),
  mimeType: z.string().max(150),
  contenuBase64: z.string().min(1).max(14_000_000),
})
export const DeclarerNcSchema = z.object({
  plateformeId: z.number().int().positive(),
  type: z.enum(['RECEPTION', 'AGENCE']),
  receptionId: z.number().int().positive().optional(),
  afficheIds: z.array(z.number().int().positive()).max(500).default([]),
  bloquante: z.boolean().nullable().default(null),
  donnees: NcDonneesSchema,
  fichiers: z.array(NcFichierEnvoiSchema).max(10).default([]),
})
export type DeclarerNc = z.infer<typeof DeclarerNcSchema>
export const ReponseNcSchema = z.object({
  date: z.string(),
  auteur: z.string(),
  traite: z.boolean(),
  commentaire: z.string(),
})
export const RepondreNcSchema = z.object({
  version: z.number().int().positive(),
  traite: z.boolean(),
  commentaire: texte,
})
export type RepondreNc = z.infer<typeof RepondreNcSchema>
export const NcSchema = z.object({
  id: z.number().int(),
  version: z.number().int(),
  plateformeId: z.number().int(),
  plateforme: z.string(),
  type: z.enum(['RECEPTION', 'AGENCE']),
  origine: z.string(),
  receptionId: z.number().int().nullable(),
  afficheIds: z.array(z.number().int()),
  bloquante: z.boolean().nullable(),
  donnees: NcDonneesSchema,
  decisions: z.array(z.enum(NC_DECISIONS)),
  statut: z.enum(NC_STATUTS),
  creeLe: z.string(),
  modifieLe: z.string(),
  auteur: z.string(),
  commentaireDecision: z.string(),
  reponses: z.array(ReponseNcSchema).default([]),
  feuilleImprimeeLe: z.string().nullable().default(null),
  fichiers: z.array(
    z.object({
      id: z.number().int(),
      nom: z.string(),
      taille: z.number().int(),
      mimeType: z.string(),
    }),
  ),
})
export type Nc = z.infer<typeof NcSchema>
export const ListeNcSchema = z.object({ items: z.array(NcSchema) })
export const DeciderNcSchema = z.object({
  version: z.number().int().positive(),
  decisions: z.array(z.enum(NC_DECISIONS)).min(1).max(9),
  commentaire: texte,
})
export type DeciderNc = z.infer<typeof DeciderNcSchema>
export const DeclarantsSchema = z.object({
  version: z.number().int(),
  noms: z.array(z.string().trim().min(1).max(200)).max(5000),
})

export const ConstatNcSchema = z.object({
  fichiers: z.array(NcFichierEnvoiSchema).max(10).optional(),
  types: z.array(z.enum(NC_TYPES)).min(1).max(20),
  bloquante: z.boolean().nullable().default(null),
  commentaire: z.string().trim().max(4000).default(''),
})
export type ConstatNc = z.infer<typeof ConstatNcSchema>

export const ImpressionNcSchema = z.object({
  ncs: z
    .array(z.object({ id: z.number().int().positive(), version: z.number().int().positive() }))
    .min(1)
    .max(100),
})
export const ImpressionNcResultatSchema = z.object({ imprimees: z.number().int(), le: z.string() })
