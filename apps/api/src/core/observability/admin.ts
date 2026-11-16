import Fastify from 'fastify'
import { checkHealth, type HealthDb } from '../../modules/health/service.ts'

// EXP-020/021: isolated listener, no business routes and no identity middleware.
export function buildAdminServer(db: HealthDb, timeoutMs = 2000) {
  const app = Fastify({ logger: false })
  let draining = false
  const isDraining = () => draining
  app.get('/healthz/live', () => Promise.resolve({ status: 'alive' }))
  app.get('/healthz/ready', async (_request, reply) => {
    if (draining) return reply.code(503).send({ status: 'not_ready' })
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const health = await Promise.race([
        checkHealth(db),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => {
            resolve(null)
          }, timeoutMs)
        }),
      ])
      const ready = !isDraining() && health?.status === 'ok'
      return await reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'not_ready' })
    } finally {
      if (timer) clearTimeout(timer)
    }
  })
  return {
    app,
    setDraining: () => {
      draining = true
    },
  }
}

export const adminOpenApi = {
  openapi: '3.1.0',
  info: {
    title: 'CIRCE administration probes',
    version: '1.0.0',
    description:
      'Port technique 9180, distinct de l’API. Ne pas exposer ce port par la route utilisateur.',
  },
  servers: [
    {
      url: 'http://localhost:9180',
      description: 'Port d’administration ; hôte configurable par environnement.',
    },
  ],
  paths: {
    '/healthz/live': {
      get: {
        operationId: 'liveness',
        description: 'Processus actif, sans accès à la base ni au collecteur.',
        responses: {
          '200': {
            description: 'Processus actif',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { const: 'alive' } },
                },
              },
            },
          },
        },
      },
    },
    '/healthz/ready': {
      get: {
        operationId: 'readiness',
        description: 'Base indispensable disponible dans le délai technique ; 503 pendant l’arrêt.',
        responses: {
          '200': {
            description: 'Prêt à recevoir des requêtes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { const: 'ready' } },
                },
              },
            },
          },
          '503': {
            description: 'Dépendance indisponible, délai dépassé ou arrêt en cours',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { const: 'not_ready' } },
                },
              },
            },
          },
        },
      },
    },
  },
}
