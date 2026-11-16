// Routes COO-P11 (suivi 8 m², dispatch du roulage, bagues, référentiel des rouleurs) : parse → service → réponse.
// Aucune règle métier ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  AffecterDispatchSchema,
  ApercuBaguesQuerySchema,
  ApercusBaguesSchema,
  BaguesQuerySchema,
  BaguesSchema,
  CreerRouleurSchema,
  DispatchQuerySchema,
  DispatchSchema,
  ImpressionBaguesSchema,
  ImprimerBaguesSchema,
  ModifierBagueSchema,
  ModifierRouleurSchema,
  PickingQuerySchema,
  PickingSchema,
  ReimprimerBagueSchema,
  RepartitionDispatchSchema,
  ResultatBagueSchema,
  ResultatDispatchSchema,
  ResultatSaisie8m2Schema,
  RouleurLigneSchema,
  RouleursReferentielSchema,
  Saisie8m2Schema,
  Suivi8m2QuerySchema,
  Suivi8m2Schema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { identiteCoordination } from './permissions.ts'
import { withTransaction } from '../../core/transaction.ts'
import {
  apercuBagues,
  imprimerBagues,
  listerBagues,
  modifierTextesBague,
  reimprimerBague,
} from './bagues.ts'
import { idem } from './routes.ts'
import {
  affecterDispatch,
  dispatchRoulage,
  listePicking,
  proposerRepartition,
  toutDesaffecter,
} from './roulage.ts'
import {
  creerRouleur,
  listerRouleursReferentiel,
  modifierRouleur,
  supprimerRouleur,
} from './rouleurs.ts'
import { saisir8m2, suivi8m2 } from './suivi-8m2.ts'

const IdParam = z.object({ id: z.coerce.number().int().positive() })

export function roulageRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // ── ECR-COO-08 : suivi 8 m² ──
  r.get(
    '/coordination/trains/suivi-8m2',
    { schema: { querystring: Suivi8m2QuerySchema, response: { 200: Suivi8m2Schema } } },
    (request) => suivi8m2(db, identiteCoordination(request), request.query),
  )
  r.post(
    '/coordination/trains/suivi-8m2',
    { schema: { body: Saisie8m2Schema, response: { 200: ResultatSaisie8m2Schema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => saisir8m2(tx, identity, request.body)),
  )

  // ── ECR-COO-10 : dispatch du roulage ──
  r.get(
    '/coordination/dispatch',
    { schema: { querystring: DispatchQuerySchema, response: { 200: DispatchSchema } } },
    (request) => dispatchRoulage(db, identiteCoordination(request), request.query),
  )
  r.post(
    '/coordination/dispatch/affecter',
    { schema: { body: AffecterDispatchSchema, response: { 200: ResultatDispatchSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => affecterDispatch(tx, identity, request.body)),
  )
  r.post(
    '/coordination/dispatch/proposer',
    { schema: { body: RepartitionDispatchSchema, response: { 200: ResultatDispatchSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => proposerRepartition(tx, identity, request.body)),
  )
  r.post(
    '/coordination/dispatch/desaffecter',
    { schema: { body: RepartitionDispatchSchema, response: { 200: ResultatDispatchSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => toutDesaffecter(tx, identity, request.body)),
  )
  r.get(
    '/coordination/dispatch/picking',
    { schema: { querystring: PickingQuerySchema, response: { 200: PickingSchema } } },
    (request) => listePicking(db, identiteCoordination(request), request.query),
  )

  // ── ECR-COO-11 : bagues et étiquettes ──
  r.get(
    '/coordination/bagues',
    { schema: { querystring: BaguesQuerySchema, response: { 200: BaguesSchema } } },
    (request) => listerBagues(db, identiteCoordination(request), request.query),
  )
  r.get(
    '/coordination/bagues/apercu',
    { schema: { querystring: ApercuBaguesQuerySchema, response: { 200: ApercusBaguesSchema } } },
    (request) => apercuBagues(db, identiteCoordination(request), request.query.trains),
  )
  r.post(
    '/coordination/bagues/imprimer',
    { schema: { body: ImprimerBaguesSchema, response: { 200: ImpressionBaguesSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => imprimerBagues(tx, identity, request.body)),
  )
  r.post(
    '/coordination/bagues/modifier',
    { schema: { body: ModifierBagueSchema, response: { 200: ResultatBagueSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => modifierTextesBague(tx, identity, request.body)),
  )
  r.post(
    '/coordination/bagues/reimprimer',
    { schema: { body: ReimprimerBagueSchema, response: { 200: ResultatBagueSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => reimprimerBague(tx, identity, request.body)),
  )

  // ── ECR-ADM-07 : référentiel des rouleurs (RG-COO-297) ──
  r.get(
    '/coordination/rouleurs',
    { schema: { response: { 200: RouleursReferentielSchema } } },
    (request) => listerRouleursReferentiel(db, identiteCoordination(request)),
  )
  r.post(
    '/coordination/rouleurs',
    { schema: { body: CreerRouleurSchema, response: { 200: RouleurLigneSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => creerRouleur(tx, identity, request.body)),
  )
  r.patch(
    '/coordination/rouleurs/:id',
    {
      schema: {
        params: IdParam,
        body: ModifierRouleurSchema,
        response: { 200: RouleurLigneSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        modifierRouleur(tx, identiteCoordination(request), request.params.id, request.body),
      ),
  )
  r.delete(
    '/coordination/rouleurs/:id',
    { schema: { params: IdParam, response: { 204: z.null() } } },
    async (request, reply) => {
      await withTransaction(db, (tx) =>
        supprimerRouleur(tx, identiteCoordination(request), request.params.id),
      )
      return reply.code(204).send(null)
    },
  )
}
