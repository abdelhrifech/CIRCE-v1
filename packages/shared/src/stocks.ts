import { z } from 'zod'
import { estSemaineIso } from './semaines.ts'
const SemaineIsoSchema = z.string().refine(estSemaineIso, 'Semaine ISO invalide')
const n = z.number().int(),
  s = z.string(),
  texte = z.coerce.string().trim().max(200)
export const StockQuerySchema = z.object({
  q: texte.optional(),
  dossier: texte.optional(),
  depart: SemaineIsoSchema.optional(),
  format: texte.optional(),
  etat: z.enum(['stock', 'epuise', 'conserver', 'rebut']).optional(),
  allee: texte.optional(),
})
export const StockLigneSchema = z.object({
  id: n,
  version: n,
  plateformeId: n,
  site: s,
  annonceur: s.nullable(),
  theme: s.nullable(),
  dossiers: z.array(n),
  semaines: z.array(s),
  emplacement: s,
  allee: s.nullable(),
  format: s,
  recu: n,
  sorties: n,
  rebut: n,
  disponible: n,
  conserver: z.boolean(),
  derniereSortie: s.nullable(),
  fusionnee: z.boolean(),
})
export const StocksSchema = z.object({
  items: z.array(StockLigneSchema),
  indicateurs: z.object({
    disponible: n,
    reliquats: n,
    visuelsConserves: n,
    rebut: n,
    sortiesAujourdhui: n,
  }),
})
export type StockLigne = z.infer<typeof StockLigneSchema>
export type StockQuery = z.infer<typeof StockQuerySchema>
export const MouvementStockQuerySchema = z.object({
  q: texte.optional(),
  dossier: texte.optional(),
  type: texte.optional(),
  auto: z.enum(['oui', 'non']).optional(),
  par: texte.optional(),
  du: z.iso.date().optional(),
  au: z.iso.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
})
export const MouvementsStocksSchema = z.object({
  items: z.array(
    z.object({
      id: n,
      date: s,
      afficheId: n,
      site: s,
      dossiers: z.array(n),
      type: s,
      quantite: n,
      par: s,
      automatique: z.boolean(),
      motif: s.nullable(),
    }),
  ),
  total: n,
  page: n,
  pageSize: n,
})
export const DECISIONS_FIN_CAMPAGNE = [
  'A_DECIDER',
  'CONSERVER',
  'ENVOYER',
  'DETRUIRE',
  'ENVOYE',
  'DETRUIT',
] as const
export const LIBELLES_FIN_CAMPAGNE: Record<(typeof DECISIONS_FIN_CAMPAGNE)[number], string> = {
  A_DECIDER: 'À décider',
  CONSERVER: 'À conserver',
  ENVOYER: 'À renvoyer, puis détruire',
  DETRUIRE: 'À détruire',
  ENVOYE: 'Renvoyé',
  DETRUIT: 'Détruit',
}
export const FinCampagneQuerySchema = z.object({
  q: texte.optional(),
  dossier: texte.optional(),
  decision: z.enum([...DECISIONS_FIN_CAMPAGNE, 'FAIT']).optional(),
  attention: z.enum(['BDX', 'MUI', 'garde', 'aucun']).optional(),
})
export const FinCampagneLigneSchema = z.object({
  cle: s,
  plateformeId: n,
  site: s,
  dossier: n,
  annonceur: s,
  atelier: s,
  formats: z.array(s),
  dernierDepart: s,
  echeance: s,
  delai: n,
  stock: n,
  attention: z.array(s),
  gardes: z.array(s),
  affiches: z.array(StockLigneSchema),
  decision: z.enum(DECISIONS_FIN_CAMPAGNE),
  version: n,
  empreinte: s,
  jusqua: s.nullable(),
  motif: s.nullable(),
  destinataire: s.nullable(),
  quantiteRetour: n.nullable(),
  quantiteEnvoyee: n,
  quantiteDetruite: n,
  modifieLe: s.nullable(),
  par: s.nullable(),
})
export const FinCampagneSchema = z.object({
  items: z.array(FinCampagneLigneSchema),
  indicateurs: z.record(z.enum(DECISIONS_FIN_CAMPAGNE), n),
  peutAgir: z.boolean(),
})
export type FinCampagneLigne = z.infer<typeof FinCampagneLigneSchema>
export const CibleFinCampagneSchema = z.object({
  plateformeId: n.positive(),
  dossier: n.positive(),
  version: n.nonnegative(),
  empreinte: s.min(1).max(128),
})
export const DeciderFinCampagneSchema = CibleFinCampagneSchema.extend({
  decision: z.enum(['A_DECIDER', 'CONSERVER', 'ENVOYER', 'DETRUIRE']),
  jusqua: SemaineIsoSchema.optional(),
  motif: z.string().trim().max(1000).optional(),
  destinataire: z.string().trim().max(200).optional(),
  quantiteRetour: n.positive().optional(),
})
export const ExecuterFinCampagneSchema = z.object({
  cibles: z.array(CibleFinCampagneSchema).min(1).max(100),
  action: z.enum(['PROPOSER_DESTRUCTION', 'RENVOI', 'DESTRUCTION']),
  confirmation: z.boolean().default(false),
})
export const ResultatStocksSchema = z.object({ message: s, quantite: n })

export const CiblesAffichesStockSchema = z.object({
  affiches: z
    .array(z.object({ id: z.number().int().positive(), version: z.number().int().positive() }))
    .min(1)
    .max(100),
})
export const RebutStockSchema = CiblesAffichesStockSchema.extend({
  quantite: z.number().int().positive(),
  motif: z.enum(['AFFICHE_DECHIREE', 'MAUVAIS_VISUEL', 'ERREUR_QUANTITE', 'AUTRE']),
})
export const ConfigurationFinCampagneSchema = z.object({
  version: z.number().int().nonnegative(),
  delais: z.object({
    '2m2': z.number().int().min(1).max(52),
    '8m2': z.number().int().min(1).max(52),
    autres: z.number().int().min(1).max(52),
  }),
  attention: z.array(z.enum(['BDX', 'MUI'])).max(2),
})
