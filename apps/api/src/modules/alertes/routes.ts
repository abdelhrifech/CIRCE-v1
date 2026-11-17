// Routes de Pilotage › Alertes (ECR-TRA-01, COO-P07) : parse → service → réponse ; aucune règle ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  AcquitterAlertesResultatSchema,
  AcquitterAlertesSchema,
  ListeAlertesQuerySchema,
  ListeAlertesSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdempotencyKey, sendIdempotent, withIdempotency } from '../../core/idempotency.ts'
import { requireIdentity } from '../../core/identity.ts'
import { COO } from '../coordination/permissions.ts'
import { restaurerAlertes, acquitterAlertes, listerAlertesPilotage } from './service.ts'

export function alertesRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.get(
    '/alertes',
    { schema: { querystring: ListeAlertesQuerySchema, response: { 200: ListeAlertesSchema } } },
    (request) => listerAlertesPilotage(db, requireIdentity(request), request.query),
  )

  r.post(
    '/alertes/acquittements',
    { schema: { body: AcquitterAlertesSchema, response: { 200: AcquitterAlertesResultatSchema } } },
    async (request, reply) => {
      const identity = requireIdentity(request)
      const result = await withIdempotency(
        db,
        {
          userId: identity.userId,
          key: requireIdempotencyKey(request),
          method: 'POST',
          path: request.url.split('?')[0] ?? request.url,
          body: request.body,
          ...COO.idempotence,
        },
        async (tx) => ({
          status: 200,
          body: await acquitterAlertes(tx, identity, request.body.cles),
        }),
      )
      return sendIdempotent(reply, result)
    },
  )
  r.post(
    '/alertes/restaurations',
    { schema: { body: AcquitterAlertesSchema, response: { 200: AcquitterAlertesResultatSchema } } },
    async (request, reply) => {
      const identity = requireIdentity(request)
      const result = await withIdempotency(
        db,
        {
          userId: identity.userId,
          key: requireIdempotencyKey(request),
          method: 'POST',
          path: request.url.split('?')[0] ?? request.url,
          body: request.body,
          ...COO.idempotence,
        },
        async (tx) => ({
          status: 200,
          body: await restaurerAlertes(tx, identity, request.body.cles),
        }),
      )
      return sendIdempotent(reply, result)
    },
  )
}
