import { z } from 'zod'
import { PERMISSION_CODES } from './permissions.ts'
import { RoleSchema } from './roles.ts'

/** GET /api/me : identité résolue et permissions calculées par le serveur. */
export const MeResponseSchema = z.object({
  userId: z.number().int(),
  identifiantExterne: z.string(),
  nom: z.string().nullable(),
  roles: z.array(RoleSchema),
  permissions: z.array(z.enum(PERMISSION_CODES)),
  perimetre: z.object({
    toutesPlateformes: z.boolean(),
    plateformeIds: z.array(z.number().int()),
  }),
  siteId: z.number().int().nullable(),
})
export type MeResponse = z.infer<typeof MeResponseSchema>

/** GET /api/me/sites : sites (plateformes) du périmètre de l'utilisateur, pour le sélecteur de site du bandeau (EX-TRA-006). */
export const MesSitesSchema = z.object({
  sites: z.array(z.object({ id: z.number().int(), nom: z.string() })),
})
export type MesSites = z.infer<typeof MesSitesSchema>
