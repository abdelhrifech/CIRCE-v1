import type { FastifyInstance } from 'fastify'
import { metrics } from '@opentelemetry/api'

// Technical observations only: no dossier, user, centre, payload or raw URL in metric labels.
export function registerHttpMetrics(app: FastifyInstance) {
  const meter = metrics.getMeter('circe.api')
  const duration = meter.createHistogram('http.server.request.duration', {
    unit: 's',
    description: 'HTTP server request duration',
  })
  const requests = meter.createCounter('circe_api_requests', {
    unit: '{request}',
    description: 'Completed API requests',
  })
  app.addHook('onResponse', async (request, reply) => {
    const attributes = {
      'http.request.method': request.method,
      'http.route': request.routeOptions.url ?? 'unmatched',
      'http.response.status_code': reply.statusCode,
    }
    duration.record(reply.elapsedTime / 1000, attributes)
    requests.add(1, attributes)
  })
}
