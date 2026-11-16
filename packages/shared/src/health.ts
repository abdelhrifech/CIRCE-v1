import { z } from 'zod'

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  database: z.enum(['up', 'down']),
  time: z.string(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>
