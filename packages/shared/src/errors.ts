import { z } from 'zod'

// Format d'erreur unique de l'API (CLAUDE.md §6) : `regle` = ID de la RG violée.
export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  regle: z.string().optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
