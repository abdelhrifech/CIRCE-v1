import { z } from 'zod'
export const SuiviAtelierQuerySchema = z.object({
  pour: z.enum(['fixe', 'pliage', 'deroulant']).optional(),
  dossier: z.coerce.number().int().positive().optional(),
  depart: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
})
export const SuiviAtelierSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      dossier: z.number().int().nullable(),
      annonceur: z.string().nullable(),
      theme: z.string().nullable(),
      format: z.string(),
      site: z.string(),
      atelier: z.string(),
      depart: z.string(),
      preparation: z.string(),
      reception: z.string(),
      production: z.string(),
      expedition: z.string(),
      nc: z.number().int(),
      attendu: z.number().nullable(),
      recu: z.number(),
      validees: z.number(),
      affiches: z.array(z.number()),
    }),
  ),
})
export type SuiviAtelier = z.infer<typeof SuiviAtelierSchema>['items'][number]

export const AnalyseProductionQuerySchema = z
  .object({
    du: z.iso.date().optional(),
    au: z.iso.date().optional(),
    atelier: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => !q.du || !q.au || q.du <= q.au, 'La date de fin doit suivre la date de début.')
export const AnalyseProductionSchema = z.object({
  nombreRouleurs: z.number().int().nonnegative(),
  ateliers: z.array(z.object({ id: z.number(), libelle: z.string(), plateforme: z.string() })),
  trains: z.array(
    z.object({
      id: z.string(),
      rouleur: z.string().nullable(),
      machine: z.string().nullable(),
      atelier: z.string(),
      site: z.string(),
      depart: z.string(),
      statut: z.string(),
    }),
  ),
})
