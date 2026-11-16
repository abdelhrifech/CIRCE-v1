import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'
import { EnvoiPhotoSchema } from './reception/bon-livraison.ts'
// BUS-03 : codes stables des cinq formats, indépendants des libellés modifiables.
export const BUS_FORMATS = [
  { code: 'AR1', nom: 'Arrière 1', verni: false },
  { code: 'AR2', nom: 'Arrière 2', verni: false },
  { code: 'FG', nom: 'Flanc gauche', verni: false },
  { code: 'FD', nom: 'Flanc droit', verni: false },
  { code: 'AV', nom: 'Avant', verni: true },
] as const
export const BusFormatCodeSchema = z.enum(['AR1', 'AR2', 'FG', 'FD', 'AV'])
const n = z.number().int().nonnegative()
const code = z.string().trim().min(1).max(100)
export const BusReferencesSchema = z.object({
  dsps: z
    .array(z.object({ code, nom: code, plateformeId: z.number().int().positive().nullable() }))
    .max(500),
  centres: z.array(z.object({ code, nom: code, dspCode: code })).max(5000),
  formats: z
    .array(
      z.object({
        code: BusFormatCodeSchema,
        supportId: z.number().int().positive(),
        patrimoineCode: z.string().trim().max(100).default(''),
        libelleBroadcast: z.string().trim().max(250).default(''),
      }),
    )
    .max(5),
  parcs: z
    .array(
      z.object({
        centreCode: code,
        parc: code,
        formatCode: BusFormatCodeSchema,
        cadastre: n,
        terrain: n,
      }),
    )
    .max(20000),
})
export const BusReferencesVersionSchema = BusReferencesSchema.extend({ version: n })
export type BusReferences = z.infer<typeof BusReferencesSchema>
// BUS-01/02/03 : contrat interne d'intégration ; les quantités amont sont requises, jamais reconstituées à partir des libellés.
export const BusLigneBroadcastSchema = z.object({
  idExterne: code,
  contNum: z.number().int().positive(),
  annonceur: code,
  themeCode: code,
  theme: code,
  centreCode: code,
  parc: code,
  formatCode: BusFormatCodeSchema,
  semaine: SemaineIsoSchema,
  finPose: SemaineIsoSchema,
  vendu: n,
  quantiteBroadcast: n,
  attendu: n,
  entretienPourcent: z.number().min(0).max(1000),
  resteEnPlace: z.boolean().default(false),
})
export type BusLigneBroadcast = z.infer<typeof BusLigneBroadcastSchema>
export const BusAjusterSchema = z.object({
  version: z.number().int().positive(),
  quantite: n.nullable(),
  motif: z.string().trim().max(1000).default(''),
})
export const BusReceptionSchema = z.object({
  ligneAttendueId: z.number().int().positive(),
  quantite: z.number().int().positive(),
  date: z.coerce.date(),
  bl: z.string().trim().max(50).default(''),
  entretien: z.boolean(),
  themeConforme: z.boolean(),
  photo: EnvoiPhotoSchema,
  tenue: z.enum(['', 'OK', 'KO']).default(''),
  allongement: z.enum(['', 'OK', 'KO']).default(''),
  massicotage: z.enum(['', 'OK', 'KO']).default(''),
  nc: z.enum(['', 'ROULE', 'FORMAT']).default(''),
  commentaire: z.string().trim().max(4000).default(''),
})
export type BusReception = z.infer<typeof BusReceptionSchema>
export const BusLigneSchema = z.object({
  id: z.number().int(),
  idExterne: z.string(),
  version: z.number().int(),
  plateformeId: z.number().int(),
  dossierId: z.number().int(),
  dossier: z.number().int(),
  annonceur: z.string(),
  theme: z.string(),
  themeCode: z.string(),
  ligneAttendueId: z.number().int(),
  centreCode: z.string(),
  centre: z.string(),
  dspCode: z.string(),
  dsp: z.string(),
  parc: z.string(),
  formatCode: BusFormatCodeSchema,
  format: z.string(),
  verni: z.boolean(),
  semaine: SemaineIsoSchema,
  finPose: SemaineIsoSchema,
  vendu: n,
  quantiteBroadcast: n,
  attendu: n,
  entretienPourcent: z.number(),
  quantiteAjustee: n.nullable(),
  aEncoller: n,
  cadastre: n.nullable(),
  terrain: n.nullable(),
  ajustePar: z.string().nullable(),
  ajusteLe: z.string().nullable(),
  resteEnPlace: z.boolean(),
  verrouillee: z.boolean(),
})
export type BusLigne = z.infer<typeof BusLigneSchema>
export const BusVisuelSchema = z.object({
  ligneAttendueId: z.number().int(),
  dossier: z.number().int(),
  dossierId: z.number().int(),
  annonceur: z.string(),
  theme: z.string(),
  semaine: SemaineIsoSchema,
  finPose: SemaineIsoSchema,
  plateformeId: z.number().int(),
  attendu: n,
  recu: n,
  reste: n,
  aEncoller: n,
  statut: z.enum(['ATTENDUE', 'PARTIELLE', 'COMPLETE', 'SURPLUS']),
  echeance: z.string(),
  anomalies: z.array(z.string()),
  pret: z.boolean(),
  formats: z.array(z.string()),
  centres: z.array(z.string()),
  dsps: z.array(z.string()),
  affiches: z.array(z.number().int()),
})
export type BusVisuel = z.infer<typeof BusVisuelSchema>
export const BusReceptionLueSchema = z.object({
  id: z.number().int(),
  receptionId: z.number().int(),
  ligneAttendueId: z.number().int(),
  date: z.string(),
  bl: z.string(),
  quantite: n,
  entretien: z.boolean(),
  themeConforme: z.boolean(),
  photoId: z.number().int(),
  tenue: z.string(),
  allongement: z.string(),
  massicotage: z.string(),
  nc: z.string(),
  commentaire: z.string(),
  auteur: z.string(),
})
export const BusSchema = z.object({
  lignes: z.array(BusLigneSchema),
  visuels: z.array(BusVisuelSchema),
  receptions: z.array(BusReceptionLueSchema),
  sansDossier: z.array(
    z.object({
      afficheId: z.number().int(),
      version: z.number().int(),
      receptionId: z.number().int(),
      annonceur: z.string().nullable(),
      theme: z.string().nullable(),
      quantite: n,
      bl: z.string().nullable(),
      date: z.string(),
      plateformeId: z.number().int(),
    }),
  ),
})
export type BusResultat = z.infer<typeof BusSchema>
export const BusHistoriqueSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      ligneId: z.number().int(),
      date: z.string(),
      auteur: z.string(),
      avant: z.string().nullable(),
      apres: z.string().nullable(),
      motif: z.string().nullable(),
    }),
  ),
})
