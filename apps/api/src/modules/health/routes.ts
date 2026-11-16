import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { HealthResponseSchema } from '@circe/shared'
import { checkHealth, type HealthDb } from './service.ts'

/** Route publique de supervision : GET /api/health (aucune logique métier ici). */
export function healthRoutes(app: FastifyInstance, db: HealthDb): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/health',
      { schema: { response: { 200: HealthResponseSchema, 503: HealthResponseSchema } } },
      async (_request, reply) => {
        const health = await checkHealth(db)
        return reply.status(health.status === 'ok' ? 200 : 503).send(health)
      },
    )
}
