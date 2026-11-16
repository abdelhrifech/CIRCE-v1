// Routes D-05 (référentiel des destinataires, ECR-ADM-07) : parse → service → réponse. Aucune règle métier ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  CreerDestinataireSchema,
  DestinataireLigneSchema,
  DestinatairesQuerySchema,
  DestinatairesReferentielSchema,
  ModifierDestinataireSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { withTransaction } from '../../core/transaction.ts'
import { creerDestinataire, listerDestinataires, modifierDestinataire } from './destinataires.ts'
import { identiteCoordination } from './permissions.ts'
import { idem } from './routes.ts'

const IdParam = z.object({ id: z.coerce.number().int().positive() })

export function destinatairesRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.get(
    '/coordination/destinataires',
    {
      schema: {
        querystring: DestinatairesQuerySchema,
        response: { 200: DestinatairesReferentielSchema },
      },
    },
    (request) => listerDestinataires(db, identiteCoordination(request), request.query),
  )
  r.post(
    '/coordination/destinataires',
    { schema: { body: CreerDestinataireSchema, response: { 200: DestinataireLigneSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => creerDestinataire(tx, identity, request.body)),
  )
  r.patch(
    '/coordination/destinataires/:id',
    {
      schema: {
        params: IdParam,
        body: ModifierDestinataireSchema,
        response: { 200: DestinataireLigneSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        modifierDestinataire(tx, identiteCoordination(request), request.params.id, request.body),
      ),
  )
}
