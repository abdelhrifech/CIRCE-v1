import { z } from 'zod'

// Module Réception — socle REC-P01 (statuts, lecture d'une réception, stock d'une affiche).

/** RECEPTION.* (EX-REC-053). « Introuvable » = A_IDENTIFIER + signaleLe (Q-109). */
export const STATUTS_RECEPTION = ['A_IDENTIFIER', 'A_CONTROLER', 'CONTROLEE'] as const
export const StatutReceptionSchema = z.enum(STATUTS_RECEPTION)
export type StatutReception = z.infer<typeof StatutReceptionSchema>

/** AFFICHE.* (EX-REC-054) ; les tags sont calculés (RG-REC-176). */
export const STATUTS_AFFICHE = ['IDENTIFIEE', 'ORPHELINE'] as const
export const StatutAfficheSchema = z.enum(STATUTS_AFFICHE)

export const ModeRattachementSchema = z.enum(['BL', 'VISUEL', 'MAIN'])

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive('Identifiant invalide'),
})

export const HistoriqueStatutSchema = z.object({
  ancien: z.string().nullable(),
  nouveau: z.string(),
  le: z.string(),
  par: z.string().nullable(),
  motif: z.string().nullable(),
})

/** GET /api/receptions/:id : socle de la fiche réception (ECR-REC-06 la complète en REC-P05). */
export const ReceptionDetailSchema = z.object({
  id: z.number().int(),
  plateformeId: z.number().int(),
  statut: StatutReceptionSchema,
  version: z.number().int(),
  dateArrivee: z.string(),
  controleLe: z.string().nullable(),
  controleurNom: z.string().nullable(),
  signaleLe: z.string().nullable(),
  referenceBl: z.string().nullable(),
  nombreAffiches: z.number().int(),
  historique: z.array(HistoriqueStatutSchema),
})
export type ReceptionDetail = z.infer<typeof ReceptionDetailSchema>

/** GET /api/affiches/:id/stock : RG-REC-153 (stock = Σ mouvements) et RG-X-060 (reçu compté une fois). */
export const StockAfficheSchema = z.object({
  afficheId: z.number().int(),
  statut: StatutAfficheSchema,
  stock: z.number().int(),
  quantiteRepartie: z.number().int(),
  nonRepartie: z.number().int(),
  rattachements: z.array(
    z.object({
      id: z.number().int(),
      ligneAttendueId: z.number().int(),
      contNum: z.number().int().nullable(),
      quantite: z.number().int(),
      mode: ModeRattachementSchema,
    }),
  ),
})
export type StockAffiche = z.infer<typeof StockAfficheSchema>
