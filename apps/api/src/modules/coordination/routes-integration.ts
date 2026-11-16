// Routes de l'intégration Broadcast (COO-P06) : parse → service → réponse ; aucune règle ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  LancerPassageSchema,
  PassageIntegrationSchema,
  PassagesIntegrationSchema,
  RafraichirDossierResultatSchema,
  RafraichirDossierSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import {
  requireIdempotencyKey,
  sendIdempotent,
  withIdempotencyEtapes,
} from '../../core/idempotency.ts'
import { requireIdentity } from '../../core/identity.ts'
import type { BroadcastPort } from '../../core/ports/broadcast.ts'
import { lancerPassageManuel, listerPassages, rafraichirDossier } from './integration-broadcast.ts'
import { COO } from './permissions.ts'

export function integrationRoutes(app: FastifyInstance, db: Db, broadcast: BroadcastPort): void {
  const r = app.withTypeProvider<ZodTypeProvider>()
  const ctx = { db, broadcast }

  r.get(
    '/coordination/integration/passages',
    { schema: { response: { 200: PassagesIntegrationSchema } } },
    (request) => listerPassages(ctx, requireIdentity(request)),
  )

  // RG-COO-102 / 103 : passage manuel (administrateur, depuis la source) ; Idempotency-Key, le passage
  // enchaînant plusieurs transactions. Aucun dépôt de lot par cette route (Q-188 (1)).
  r.post(
    '/coordination/integration/passages',
    { schema: { body: LancerPassageSchema, response: { 200: PassageIntegrationSchema } } },
    async (request, reply) => {
      const identity = requireIdentity(request)
      const result = await withIdempotencyEtapes(
        db,
        {
          userId: identity.userId,
          key: requireIdempotencyKey(request),
          method: 'POST',
          path: request.url.split('?')[0] ?? request.url,
          body: request.body,
          ...COO.idempotence,
        },
        async () => ({
          status: 200,
          body: await lancerPassageManuel(ctx, identity),
        }),
      )
      return sendIdempotent(reply, result)
    },
  )

  // RG-COO-132 : « Rafraîchir un dossier ».
  r.post(
    '/coordination/integration/rafraichir-dossier',
    {
      schema: { body: RafraichirDossierSchema, response: { 200: RafraichirDossierResultatSchema } },
    },
    async (request, reply) => {
      const identity = requireIdentity(request)
      const result = await withIdempotencyEtapes(
        db,
        {
          userId: identity.userId,
          key: requireIdempotencyKey(request),
          method: 'POST',
          path: request.url.split('?')[0] ?? request.url,
          body: request.body,
          ...COO.idempotence,
        },
        async () => ({
          status: 200,
          body: await rafraichirDossier(ctx, identity, request.body.contNum),
        }),
      )
      return sendIdempotent(reply, result)
    },
  )
}
