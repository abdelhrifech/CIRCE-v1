import { z } from 'zod'

// Étape 8 (D-05) — Référentiel des destinataires (ECR-ADM-07 « Destinataires et afficheurs », tr_destinataire,
// tr_dest_adresse, tr_ate_dest_trans) : gestion minimale nécessaire à la Coordination (grain de la ligne de préparation,
// dispatch O/N de RG-COO-260, départs et colis). Hypothèses : Q-403.

const n = z.number().int()
const s = z.string().nullable()

export const DISPATCH_DESTINATAIRE = ['O', 'N'] as const
export const DispatchDestinataireSchema = z.enum(DISPATCH_DESTINATAIRE)

export const AdressePrincipaleSchema = z.object({
  adresse1: s,
  adresse2: s,
  codePostal: s,
  localite: s,
})
export type AdressePrincipale = z.infer<typeof AdressePrincipaleSchema>

export const DestinataireLigneSchema = z.object({
  id: n,
  /** Nom d'origine (clé d'intégration Broadcast, non modifiable). */
  nomOrigine: z.string(),
  /** Libellé affiché : le nom saisi, à défaut le nom d'origine. */
  nom: z.string(),
  actif: z.boolean(),
  /** RG-COO-260 : `O` = un changement d'afficheur clôt l'UM ; `N` (ou vide) = afficheur effacé. */
  dispatch: z.string().nullable(),
  mail: s,
  telephone: s,
  adresse: AdressePrincipaleSchema.nullable(),
  /** Nombre de transports par défaut (couples destinataire × atelier, RG-COO-120), en lecture seule. */
  nbTransports: n,
  /** Référencé par des lignes, UM, faces ou colis : jamais supprimé, désactivation seule. */
  utilise: z.boolean(),
  version: n,
})
export type DestinataireLigne = z.infer<typeof DestinataireLigneSchema>

export const DestinatairesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  actif: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})
export type DestinatairesQuery = z.infer<typeof DestinatairesQuerySchema>

export const DestinatairesReferentielSchema = z.object({
  destinataires: z.array(DestinataireLigneSchema),
})

const texte = (max: number) => z.string().trim().min(1).max(max)

export const CreerDestinataireSchema = z.object({
  nomOrigine: texte(100),
  nom: texte(100).optional(),
  dispatch: DispatchDestinataireSchema.optional(),
  mail: texte(200).optional(),
  telephone: texte(30).optional(),
  adresse: z
    .object({
      adresse1: texte(100).optional(),
      adresse2: texte(100).optional(),
      codePostal: texte(10).optional(),
      localite: texte(100).optional(),
    })
    .optional(),
})
export type CreerDestinataire = z.infer<typeof CreerDestinataireSchema>

export const ModifierDestinataireSchema = z.object({
  version: n.positive(),
  nom: texte(100).nullable().optional(),
  dispatch: DispatchDestinataireSchema.nullable().optional(),
  mail: texte(200).nullable().optional(),
  telephone: texte(30).nullable().optional(),
  adresse: z
    .object({
      adresse1: texte(100).nullable().optional(),
      adresse2: texte(100).nullable().optional(),
      codePostal: texte(10).nullable().optional(),
      localite: texte(100).nullable().optional(),
    })
    .optional(),
  actif: z.boolean().optional(),
})
export type ModifierDestinataire = z.infer<typeof ModifierDestinataireSchema>
