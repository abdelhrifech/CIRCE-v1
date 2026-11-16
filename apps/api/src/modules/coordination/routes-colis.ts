// Routes COO-P13 (colis, expédition, fin de journée ; ECR-EXP-01 / ECR-EXP-02) : parse → service → réponse.
// Aucune règle ici (RG-COO-263 à 271 dans colis.ts).
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  AColiserSchema,
  AjouterTrainSchema,
  AjouterUniteSchema,
  ColisQuerySchema,
  CreerColisSchema,
  DepartsCamionsQuerySchema,
  DepartsCamionsSchema,
  ExpedierColisSchema,
  FicheColisSchema,
  FinDeJourneeSchema,
  IdColisParamSchema,
  ListeColisSchema,
  ResultatColisSchema,
  ResultatFinDeJourneeSchema,
  RetirerColisSchema,
  VersionColisSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import {
  ajouterTrain,
  ajouterUnite,
  creerColis,
  expedierColis,
  finDeJournee,
  lireAColiser,
  lireFicheColis,
  listerColis,
  ouvrirColis,
  retirerDuColis,
  supprimerColis,
} from './colis.ts'
import { lireDepartsCamions } from './departs-camions.ts'
import { identiteCoordination } from './permissions.ts'
import { idem } from './routes.ts'

export function colisRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.get(
    '/coordination/colis',
    { schema: { querystring: ColisQuerySchema, response: { 200: ListeColisSchema } } },
    (request) => listerColis(db, identiteCoordination(request), request.query),
  )
  r.get(
    '/coordination/colis/a-coliser',
    { schema: { querystring: ColisQuerySchema, response: { 200: AColiserSchema } } },
    (request) => lireAColiser(db, identiteCoordination(request), request.query),
  )
  // ECR-EXP-03 « Départs camions » (D-14, lecture seule).
  r.get(
    '/coordination/colis/departs',
    {
      schema: { querystring: DepartsCamionsQuerySchema, response: { 200: DepartsCamionsSchema } },
    },
    (request) => lireDepartsCamions(db, identiteCoordination(request), request.query),
  )
  r.get(
    '/coordination/colis/:id',
    { schema: { params: IdColisParamSchema, response: { 200: FicheColisSchema } } },
    (request) => lireFicheColis(db, identiteCoordination(request), request.params.id),
  )
  r.post(
    '/coordination/colis',
    { schema: { body: CreerColisSchema, response: { 200: ResultatColisSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => creerColis(tx, identity, request.body)),
  )
  r.post(
    '/coordination/colis/fin-de-journee',
    { schema: { body: FinDeJourneeSchema, response: { 200: ResultatFinDeJourneeSchema } } },
    (request, reply) =>
      // RG-COO-269 : une seule transaction pour tous les colis « A expédier » ; délai explicite (défaut Prisma : 5 s).
      idem(db, request, reply, (tx, identity) => finDeJournee(tx, identity), 60_000),
  )
  r.post(
    '/coordination/colis/:id/unites',
    {
      schema: {
        params: IdColisParamSchema,
        body: AjouterUniteSchema,
        response: { 200: ResultatColisSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        ajouterUnite(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/coordination/colis/:id/trains',
    {
      schema: {
        params: IdColisParamSchema,
        body: AjouterTrainSchema,
        response: { 200: ResultatColisSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        ajouterTrain(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/coordination/colis/:id/retirer',
    {
      schema: {
        params: IdColisParamSchema,
        body: RetirerColisSchema,
        response: { 200: ResultatColisSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        retirerDuColis(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/coordination/colis/:id/supprimer',
    {
      schema: {
        params: IdColisParamSchema,
        body: VersionColisSchema,
        response: { 200: ResultatColisSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        supprimerColis(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/coordination/colis/:id/ouvrir',
    {
      schema: {
        params: IdColisParamSchema,
        body: VersionColisSchema,
        response: { 200: ResultatColisSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        ouvrirColis(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/coordination/colis/:id/expedier',
    {
      schema: {
        params: IdColisParamSchema,
        body: ExpedierColisSchema,
        response: { 200: ResultatColisSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        expedierColis(tx, identity, request.params.id, request.body),
      ),
  )
}
