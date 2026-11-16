import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'
// EX-NEW-J3-001 : champs manuels du classeur J-3 remplacé par les trois tableaux de la maquette.
const texte = z.string().trim().max(2000).default('')
const cout = z.number().min(0).max(1_000_000_000).nullable().default(null)
export const J3DonneesSchema = z.object({
  prepa: texte,
  commerce: texte,
  type: z.enum(['', 'A', 'V']).default(''),
  region: texte,
  ville: texte,
  impact: z.enum(['NON', 'OUI']).default('NON'),
  typeImpact: texte,
  depart: texte,
  go: z.enum(['', 'GO', 'NO GO']).default(''),
  goCond: texte,
  imprimeur: texte,
  comm: texte,
  livPrevue: texte,
  surPtf: cout,
  surTech: cout,
})
export type J3Donnees = z.infer<typeof J3DonneesSchema>
export const J3_SECTIONS = ['wis1', 'wis2', 'nim'] as const
export const J3ContexteSchema = z.object({ semaine: SemaineIsoSchema })
export const J3AjoutSchema = z.object({
  semaine: SemaineIsoSchema,
  section: z.enum(J3_SECTIONS),
  plateformeId: z.number().int().positive(),
  dossierIds: z.array(z.number().int().positive()).min(1).max(500),
})
export const J3MajSchema = z.object({
  version: z.number().int().positive(),
  donnees: J3DonneesSchema,
})
export const J3CandidatSchema = z.object({
  dossierId: z.number().int(),
  dossier: z.number().int(),
  annonceur: z.string(),
  formats: z.record(z.string(), z.number().int()),
  attendu: z.number().int(),
  recu: z.number().int(),
  reste: z.number().int(),
  depart: z.string(),
})
export const J3LigneSchema = z.object({
  id: z.number().int(),
  version: z.number().int(),
  candidat: J3CandidatSchema,
  donnees: J3DonneesSchema,
})
export const J3Schema = z.object({
  semaine: SemaineIsoSchema,
  sections: z.array(
    z.object({
      id: z.enum(J3_SECTIONS),
      nom: z.string(),
      plateformeId: z.number().int(),
      formats: z.array(z.string()),
      modifieLe: z.string().nullable(),
      lignes: z.array(J3LigneSchema),
      candidats: z.array(J3CandidatSchema),
    }),
  ),
})
export type J3Resultat = z.infer<typeof J3Schema>

export const TABLEAU_SOURCES = [
  'sansIP',
  'nonConforme',
  'echeance',
  'j3',
  'va',
  'iok',
  'inconnues',
  'themes',
] as const
export const TableauCarreSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(['compteurs', 'liste', 'notes', 'alertes']),
  large: z.boolean().default(false),
  items: z.array(z.enum(TABLEAU_SOURCES)).max(8).default([]),
  source: z.enum(TABLEAU_SOURCES).default('sansIP'),
  texte: z.string().max(500).default(''),
})
export type TableauCarre = z.infer<typeof TableauCarreSchema>
export const DispositionTableauSchema = z.object({
  version: z.number().int().min(0),
  carres: z
    .array(TableauCarreSchema)
    .max(40)
    .refine(
      (c) => new Set(c.map((w) => w.id)).size === c.length,
      'Les identifiants des carrés doivent être uniques.',
    ),
})
export const LigneTableauSchema = z.object({
  id: z.string(),
  dossier: z.array(z.number().int()),
  annonceur: z.string(),
  theme: z.string(),
  semaines: z.array(z.string()),
  atelierIds: z.array(z.number().int()),
  format: z.string(),
  details: z.string(),
  lien: z.string(),
})
export const DonneesTableauSchema = z.object({
  sources: z.record(z.enum(TABLEAU_SOURCES), z.array(LigneTableauSchema)),
  alertes: z.array(LigneTableauSchema),
})
export type DonneesTableau = z.infer<typeof DonneesTableauSchema>
export const TABLEAU_DEFAUT: TableauCarre[] = [
  {
    id: 'c1',
    type: 'compteurs',
    items: ['sansIP', 'nonConforme', 'echeance', 'j3', 'va', 'iok'],
    source: 'sansIP',
    texte: '',
    large: false,
  },
  { id: 'c5', type: 'alertes', items: [], source: 'sansIP', texte: '', large: false },
  { id: 'c2', type: 'liste', items: [], source: 'sansIP', texte: '', large: false },
  { id: 'c3', type: 'liste', items: [], source: 'echeance', texte: '', large: false },
  { id: 'c4', type: 'notes', items: [], source: 'sansIP', texte: '', large: false },
]
