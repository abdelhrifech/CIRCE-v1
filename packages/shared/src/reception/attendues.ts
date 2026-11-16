import { z } from 'zod'
import { estSemaineIso } from '../semaines.ts'

// REC-P02 — Réceptions attendues (ECR-REC-01, tableau « Réceptions attendues »).

/** RG-REC-018 : statut de la ligne attendue. */
export const STATUTS_LIGNE = ['ATTENDUE', 'PARTIELLE', 'COMPLETE', 'SURPLUS'] as const
export const StatutLigneSchema = z.enum(STATUTS_LIGNE)
export type StatutLigne = z.infer<typeof StatutLigneSchema>

/** RG-REC-019 : colonne Contrôle. */
export const CONTROLES_LIGNE = ['RIEN_RECU', 'A_CONTROLER', 'CONTROLEE'] as const
export const ControleLigneSchema = z.enum(CONTROLES_LIGNE)
export type ControleLigne = z.infer<typeof ControleLigneSchema>

/** RG-REC-013 : n° de dossier = 6 chiffres, suffixe « -W » de la 2e plateforme accepté (RG-REC-025). */
export const NUMERO_DOSSIER = /^[0-9]{6}(-W)?$/
export const MESSAGE_DOSSIER_FORMAT =
  'Le n° de dossier doit comporter 6 chiffres (ex. 100000 ou 100000-W).'

/** Semaine ISO « 2026-W43 » (RG-REC-015, RG-COO-083). */
export const SEMAINE_ISO = /^(\d{4})-W(\d{2})$/
export const SemaineIsoSchema = z
  .string()
  .regex(SEMAINE_ISO, 'Semaine attendue au format AAAA-Wss (ex. 2026-W43)')
  // ANO-042 : semaine réelle (2026 a 53 semaines ISO, 2027 en a 52 : 2027-W53 est refusée).
  .refine(estSemaineIso, 'Semaine ISO inexistante (2026 : 53 semaines, 2027 : 52)')

/** Liste « a,b,c » en query string → tableau ; vide = aucun filtre. */
function liste<T extends z.ZodType<unknown, string>>(item: T) {
  return z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(item))
}

export const TRIS_ATTENDUES = [
  'dossier',
  'annonceur',
  'theme',
  'depart',
  'recu',
  'attendu',
  'reste',
  'statut',
  'controle',
  'site',
] as const

export const ListeAttenduesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(TRIS_ATTENDUES).default('depart'),
  ordre: z.enum(['asc', 'desc']).default('asc'),
  /** RG-REC-012 : recherche à la frappe — n° de dossier, de DA, annonceur ; plusieurs valeurs. */
  q: z.string().trim().max(2000).optional(),
  /** RG-REC-013 : filtre par n° de dossier exact (format contrôlé par le service : 400 REC_DOSSIER_FORMAT). */
  dossier: liste(z.string().min(1)),
  /** RG-REC-016 : par défaut Attendue + Partielle. `tous` = aucune restriction. */
  statut: z.string().optional(),
  /**
   * RG-REC-015 : semaines de départ ISO ; par défaut la semaine courante et les suivantes.
   * RG-REC-016 : `tous` = aucune restriction de semaine (« aucune coche = tout », « Masqués par Départ — Afficher »).
   */
  depart: z
    .string()
    .optional()
    .transform((v) =>
      v === 'tous'
        ? 'tous'
        : v
          ? v
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
    )
    .pipe(z.union([z.literal('tous'), z.array(SemaineIsoSchema)])),
  format: liste(z.string().min(1)),
  controle: liste(ControleLigneSchema),
  annonceur: liste(z.string().min(1)),
})
export type ListeAttenduesQuery = z.infer<typeof ListeAttenduesQuerySchema>

export const LigneAttendueSchema = z.object({
  id: z.number().int(),
  version: z.number().int(),
  site: z.object({ id: z.number().int(), nom: z.string() }),
  dossier: z.number().int().nullable(),
  da: z.number().int().nullable(),
  annonceur: z.string().nullable(),
  theme: z.string().nullable(),
  format: z.string().nullable(),
  depart: z.string(),
  attendu: z.number().int(),
  recu: z.number().int(),
  reste: z.number().int(),
  statut: StatutLigneSchema,
  controle: ControleLigneSchema,
  affiches: z.array(z.number().int()),
  /** RG-REC-020 : affichage seul ; source non tranchée (Q-134) → null = « — ». */
  livraisonPrevue: z.string().nullable(),
})
export type LigneAttendue = z.infer<typeof LigneAttendueSchema>

const CompteurSchema = z.object({ valeur: z.string(), nombre: z.number().int() })

export const ListeAttenduesResponseSchema = z.object({
  items: z.array(LigneAttendueSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** Filtres réellement appliqués (valeurs par défaut comprises). */
  filtres: z.object({
    statut: z.array(StatutLigneSchema),
    depart: z.array(z.string()),
    format: z.array(z.string()),
    controle: z.array(ControleLigneSchema),
    annonceur: z.array(z.string()),
  }),
  /** RG-REC-016 : compteurs par valeur (sur le site et la recherche, hors filtre concerné). */
  compteurs: z.object({
    statut: z.array(CompteurSchema),
    depart: z.array(CompteurSchema),
    format: z.array(CompteurSchema),
    controle: z.array(CompteurSchema),
    annonceur: z.array(CompteurSchema),
  }),
  /** RG-REC-012 : valeurs recherchées sans aucune ligne, ou masquées par un filtre. */
  recherche: z.object({
    absents: z.array(z.string()),
    masques: z.array(z.object({ valeur: z.string(), filtres: z.array(z.string()) })),
  }),
  /** RG-REC-014 : site sans aucune ligne à proposer. */
  aucuneLigneSurLeSite: z.boolean(),
})
export type ListeAttenduesResponse = z.infer<typeof ListeAttenduesResponseSchema>

/** RG-REC-010 : badges du menu Réception. */
export const CompteursReceptionSchema = z.object({
  /** null si l'utilisateur ne peut pas consulter le sas. */
  palettesAControler: z.number().int().nullable(),
  /** null si l'utilisateur ne peut pas consulter les réceptions inconnues. */
  affichesOrphelines: z.number().int().nullable(),
})
export type CompteursReception = z.infer<typeof CompteursReceptionSchema>
