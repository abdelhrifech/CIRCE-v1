import { z } from 'zod'
export const JournalAdminQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  action: z.string().max(100).optional(),
  objet: z.string().max(100).optional(),
  du: z.iso.date().optional(),
  au: z.iso.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
})
export const JournalAdminSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      date: z.string(),
      par: z.string(),
      objet: z.string(),
      identifiant: z.string(),
      action: z.string(),
      detail: z.string().nullable(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})
export const CatalogueStatutsSchema = z.object({
  items: z.array(
    z.object({
      cle: z.string(),
      domaine: z.string(),
      libelle: z.string(),
      origine: z.string(),
      description: z.string(),
      ecran: z.string(),
    }),
  ),
})
export const TransportAdminQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
})
export const TransportAdminSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  items: z.array(
    z.object({
      id: z.number(),
      site: z.string(),
      atelier: z.string(),
      destinataire: z.string(),
      transporteur: z.number(),
      tarif: z.string(),
    }),
  ),
})

export const MachineConfigurationInputSchema = z.object({
  version: z.number().int().nonnegative(),
  nom: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(100),
  fichier: z.boolean(),
  tiroirsMax: z.number().int().min(1).max(1000).nullable(),
  sortie: z.string().trim().max(200).nullable(),
  repertoire: z.string().trim().max(1000).nullable(),
  bagues: z.string().trim().max(200).nullable(),
})
export const MachineConfigurationSchema = MachineConfigurationInputSchema.extend({
  id: z.number().int().positive(),
})
export const MachinesAdminSchema = z.object({
  machines: z.array(MachineConfigurationSchema),
  parametres: z.array(z.object({ cle: z.string(), valeur: z.string() })),
})
export const BoucleTransportInputSchema = z.object({
  version: z.number().int().nonnegative(),
  plateformeId: z.number().int().positive(),
  nom: z.string().trim().min(1).max(100),
  canal: z.enum(['MILK_RUN', 'MESSAGERIE']),
  jour: z.number().int().min(0).max(7),
  heure: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  destinataires: z.array(z.number().int().positive()).max(500),
})
export const BoucleTransportSchema = BoucleTransportInputSchema.extend({
  id: z.number().int().positive(),
  site: z.string(),
  destinations: z.array(z.string()),
})
export const BouclesTransportSchema = z.object({
  items: z.array(BoucleTransportSchema),
  sites: z.array(z.object({ id: z.number(), nom: z.string() })),
  destinataires: z.array(z.object({ id: z.number(), nom: z.string() })),
})

export const DistributionInputSchema = z.object({
  version: z.number().int().nonnegative(),
  nom: z.string().trim().min(1).max(200),
  plateformeId: z.number().int().positive().nullable(),
  roles: z
    .array(z.enum(['coord', 'cheq', 'recep', 'expe', 'admin', 'com']))
    .min(1)
    .max(6),
  usage: z.string().trim().min(1).max(1000),
})
export const DistributionSchema = DistributionInputSchema.extend({
  id: z.number().int().positive(),
  site: z.string().nullable(),
})
export const DistributionsSchema = z.object({
  items: z.array(DistributionSchema),
  sites: z.array(z.object({ id: z.number(), nom: z.string() })),
})
