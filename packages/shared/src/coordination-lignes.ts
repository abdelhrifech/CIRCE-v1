import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'

// COO-P05 — lignes attendues : état des réservations vivant (ECR-PIL-03, RG-COO-101, 107, 108), suivi de
// production (RG-COO-105, 106), suppression interdite (RG-COO-089).

const n = z.number().int()

/** RG-COO-107 : « Afficher par » (grain). Grains servis (HYPOTHÈSE Q-187 (6)) : les grains destinataire,
 * afficheur, unité, colis et départ camion dépendent des données de préparation (COO-P12 / P13). */
export const GRAINS_RESERVATIONS = ['DOSSIER', 'DA', 'THEME', 'FORMAT'] as const
/** Libellés de « Afficher par » (maquette `PAR`). */
export const LIBELLES_GRAINS: Record<(typeof GRAINS_RESERVATIONS)[number], string> = {
  DOSSIER: 'Dossier',
  DA: 'DA : dossier × type de réalisation × plateforme',
  THEME: 'Thème (dossier × thème)',
  FORMAT: 'Format (tous dossiers)',
}
export const GrainReservationsSchema = z.enum(GRAINS_RESERVATIONS)
export type GrainReservations = z.infer<typeof GrainReservationsSchema>

/** RG-COO-107 : « Où en est-il », du moins avancé au plus avancé ; ANNULE à part. */
export const ETAPES_RESERVATION = [
  'DA_ACTIVEE',
  'IP_SAISIES',
  'PREPA_RECUE',
  'RECUES_EN_PARTIE',
  'VALIDATION_A_CONFIRMER',
  'EN_PRODUCTION',
  'PRODUIT',
  'EXPEDIE',
  'LIVRE',
  'ANNULE',
] as const
export const EtapeReservationSchema = z.enum(ETAPES_RESERVATION)
export type EtapeReservation = z.infer<typeof EtapeReservationSchema>

/** ECR-PIL-03 (maquette `PHASES`) : étapes de chaque indicateur ; un clic sur la tuile filtre ces étapes. */
export const PHASES_RESERVATION = {
  enPreProduction: ['DA_ACTIVEE', 'IP_SAISIES', 'VALIDATION_A_CONFIRMER'],
  affichesAttendues: ['PREPA_RECUE', 'RECUES_EN_PARTIE'],
  enProduction: ['EN_PRODUCTION'],
  produitsOuExpedies: ['PRODUIT', 'EXPEDIE', 'LIVRE'],
} as const satisfies Record<string, readonly EtapeReservation[]>

export const AFFICHE_RECUE = ['OUI', 'OUI_SURPLUS', 'PARTIELLE', 'NON', 'SANS_ATTENDU'] as const
export const AfficheRecueSchema = z.enum(AFFICHE_RECUE)

export const ReservationsQuerySchema = z.object({
  grain: GrainReservationsSchema.default('THEME'),
  dossier: z.coerce.number().int().optional(),
  /** Semaine de départ ISO « 2026-W43 ». */
  depart: SemaineIsoSchema.optional(),
  atelierId: z.coerce.number().int().optional(),
  plateformeId: z.coerce.number().int().optional(),
  /** Une ou plusieurs étapes (« A,B » ou paramètre répété) : une tuile filtre toutes ses étapes. */
  ou: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(EtapeReservationSchema).min(1).optional(),
  ),
  annonceur: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})
export type ReservationsQuery = z.infer<typeof ReservationsQuerySchema>

export const NumeroAfficheSchema = z.object({ id: n, marque: z.enum(['✓', '•']) })

export const LigneReservationSchema = z.object({
  cle: z.string(),
  /** Dossier (null au grain Format). */
  dossier: n.nullable(),
  dossierId: n.nullable(),
  dossiers: n,
  themes: n,
  annonceur: z.string().nullable(),
  /** Thème ; null = visuel provisoire (IP à saisir). */
  visuel: z.string().nullable(),
  format: z.string().nullable(),
  plateforme: z.string().nullable(),
  departs: z.array(z.string()),
  ou: EtapeReservationSchema,
  attendu: n,
  recu: n,
  resteARecevoir: n,
  afficheRecue: AfficheRecueSchema.nullable(),
  numerosAffiche: z.array(NumeroAfficheSchema),
  reperes: z.array(z.enum(['MULTI_SEMAINES', 'PROVISOIRE'])),
  /** Liseré de la ligne (maquette `tone`) : critique si DA / IP après la deadline Pré-Prod ou affiches attendues
   * pour un départ ≤ semaine en cours ; à surveiller si DA ou reçues en partie ; info si validation à confirmer ;
   * OK si produit, expédié ou livré. */
  lisere: z.enum(['critique', 'surveiller', 'info', 'ok']).nullable(),
})
export type LigneReservation = z.infer<typeof LigneReservationSchema>

export const ReservationsSchema = z.object({
  items: z.array(LigneReservationSchema),
  total: n,
  page: n,
  pageSize: n,
  /** RG-COO-107 : indicateurs (un dossier compte à l'étape la moins avancée de ses lignes). */
  indicateurs: z.object({
    dossiers: n,
    enPreProduction: n,
    affichesAttendues: n,
    enProduction: n,
    produitsOuExpedies: n,
  }),
  /** Totaux en pied (reçu et reste comptés une fois par thème, RG-COO-101). */
  totaux: z.object({ attendu: n, recu: n, resteARecevoir: n }),
})
export type Reservations = z.infer<typeof ReservationsSchema>

export const SuiviProductionQuerySchema = z.object({
  atelierId: z.coerce.number().int().optional(),
  dossier: z.coerce.number().int().optional(),
})

export const LigneSuiviProductionSchema = z.object({
  ligneAttendueId: n,
  dossier: n.nullable(),
  annonceur: z.string().nullable(),
  theme: z.string().nullable(),
  format: z.string().nullable(),
  atelierId: n.nullable(),
  depart: z.string(),
  attendu: n,
  recu: n,
  /** RG-COO-021 / 105 : n° d'affiche visible seulement validée et liée à une ligne PREPA. */
  numerosAffiche: z.array(n),
  repartitions: z.array(
    z.object({ id: n, statut: z.string(), qte: n.nullable(), destinataire: z.string().nullable() }),
  ),
  faces: z.array(z.object({ statut: z.string(), nombre: n })),
})
export const SuiviProductionSchema = z.object({ items: z.array(LigneSuiviProductionSchema) })
export type SuiviProduction = z.infer<typeof SuiviProductionSchema>

export const IdLigneAttendueParamSchema = z.object({ id: z.coerce.number().int().min(1) })
