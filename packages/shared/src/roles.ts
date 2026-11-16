import { z } from 'zod'

// HYPOTHÈSE (Q-003) : 6 rôles provisoires issus de la maquette (M.ROLES).
export const ROLES = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com'] as const
export const RoleSchema = z.enum(ROLES)
export type Role = z.infer<typeof RoleSchema>
