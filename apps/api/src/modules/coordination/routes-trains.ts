// Routes des trains (COO-P09, ECR-COO-05) : parse → service → réponse. Aucune règle métier ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  AnnulerThemeTrainSchema,
  ChangerStatutFacesSchema,
  CreerTrainResultatSchema,
  CreerTrainSchema,
  DebloquerSemaineTrainsSchema,
  DupliquerTrainSchema,
  FicheTrainSchema,
  FractionnerTrainsSchema,
  ListeTrainsSchema,
  OptionsCreationTrainQuerySchema,
  OptionsCreationTrainSchema,
  RaccrocherVisuelSchema,
  ResultatActionTrainsSchema,
  ResultatSimpleSchema,
  SupprimerTrainSchema,
  TrainsQuerySchema,
  VisuelsRaccrochablesQuerySchema,
  VisuelsRaccrochablesSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { identiteCoordination } from './permissions.ts'
import { idem } from './routes.ts'
import {
  annulerThemeTrain,
  changerStatutFaces,
  creerTrain,
  debloquerSemaineTrains,
  dupliquerTrain,
  ficheTrain,
  fractionnerTrains,
  listerTrains,
  optionsCreationTrain,
  raccrocherVisuel,
  supprimerTrain,
  visuelsRaccrochables,
} from './trains.ts'

const TrainParam = z.object({ trainId: z.string().min(1).max(30) })

export function trainsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // ECR-COO-05 / RG-COO-228 : liste des trains.
  r.get(
    '/coordination/trains',
    { schema: { querystring: TrainsQuerySchema, response: { 200: ListeTrainsSchema } } },
    (request) => listerTrains(db, identiteCoordination(request), request.query),
  )
  // RG-COO-224 : options de la modale de création (avant /:trainId).
  r.get(
    '/coordination/trains/options-creation',
    {
      schema: {
        querystring: OptionsCreationTrainQuerySchema,
        response: { 200: OptionsCreationTrainSchema },
      },
    },
    (request) => optionsCreationTrain(db, identiteCoordination(request), request.query.atelier),
  )
  // RG-COO-222 : visuels raccrochables d'un train.
  r.get(
    '/coordination/trains/visuels-raccrochables',
    {
      schema: {
        querystring: VisuelsRaccrochablesQuerySchema,
        response: { 200: VisuelsRaccrochablesSchema },
      },
    },
    (request) => visuelsRaccrochables(db, identiteCoordination(request), request.query.train),
  )
  // ECR-COO-05a : fiche train.
  r.get(
    '/coordination/trains/:trainId',
    { schema: { params: TrainParam, response: { 200: FicheTrainSchema } } },
    (request) => ficheTrain(db, identiteCoordination(request), request.params.trainId),
  )
  // RG-COO-221 : fractionner.
  r.post(
    '/coordination/trains/fractionner',
    { schema: { body: FractionnerTrainsSchema, response: { 200: ResultatActionTrainsSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => fractionnerTrains(tx, identity, request.body)),
  )
  // RG-COO-222 : raccrocher un visuel.
  r.post(
    '/coordination/trains/raccrocher',
    { schema: { body: RaccrocherVisuelSchema, response: { 200: ResultatActionTrainsSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => raccrocherVisuel(tx, identity, request.body)),
  )
  // RG-COO-224 : créer un train de pré-test ou d'entretien.
  r.post(
    '/coordination/trains',
    { schema: { body: CreerTrainSchema, response: { 200: CreerTrainResultatSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => creerTrain(tx, identity, request.body)),
  )
  // RG-COO-225 : supprimer un train (suppression logique, motif).
  r.post(
    '/coordination/trains/:trainId/suppression',
    {
      schema: {
        params: TrainParam,
        body: SupprimerTrainSchema,
        response: { 200: ResultatSimpleSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        supprimerTrain(tx, identity, request.params.trainId, request.body),
      ),
  )
  // RG-COO-218 : changer le statut des faces.
  r.post(
    '/coordination/trains/statut',
    { schema: { body: ChangerStatutFacesSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => changerStatutFaces(tx, identity, request.body)),
  )
  // RG-COO-219 : annuler un thème de train.
  r.post(
    '/coordination/trains/annuler-theme',
    { schema: { body: AnnulerThemeTrainSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => annulerThemeTrain(tx, identity, request.body)),
  )
  // RG-COO-220 : débloquer une semaine.
  r.post(
    '/coordination/trains/debloquer-semaine',
    { schema: { body: DebloquerSemaineTrainsSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        debloquerSemaineTrains(tx, identity, request.body),
      ),
  )
  // RG-COO-226 : dupliquer un train (Administration).
  r.post(
    '/coordination/trains/dupliquer',
    { schema: { body: DupliquerTrainSchema, response: { 200: ResultatSimpleSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => dupliquerTrain(tx, identity, request.body)),
  )
}
