// Routes COO-P12 (préparation 2 m² fixe / pliage / bus, ECR-COO-09) : parse → service → réponse. Aucune règle ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  ComptagePliageSchema,
  CorrigerIntituleSchema,
  EncollerQuerySchema,
  EncollerSchema,
  EnregistrerEncollerSchema,
  LibererSemaineSchema,
  LignesSelectionSchema,
  ModifierQuantiteSchema,
  RendreLaMainSchema,
  ResultatLiberationSchema,
  ResultatUnitaireSchema,
  SyntheseSchema,
  UnitaireQuerySchema,
  UnitaireSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { identiteCoordination } from './permissions.ts'
import { idem } from './routes.ts'
import { creerUnites, libererSemaine } from './unitaire-creation.ts'
import {
  comptagePliage,
  corrigerIntitule,
  enregistrerEncollage,
  lireEncollage,
  listerUnitaire,
  modifierQuantite,
  preparerSelection,
  rendreLaMain,
  retirerUnites,
  syntheseUnitaire,
} from './unitaire.ts'

export function unitaireRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.get(
    '/coordination/unitaire',
    { schema: { querystring: UnitaireQuerySchema, response: { 200: UnitaireSchema } } },
    (request) => listerUnitaire(db, identiteCoordination(request), request.query),
  )
  r.get(
    '/coordination/unitaire/synthese',
    { schema: { querystring: UnitaireQuerySchema, response: { 200: SyntheseSchema } } },
    (request) => syntheseUnitaire(db, identiteCoordination(request), request.query),
  )
  r.post(
    '/coordination/unitaire/quantite',
    { schema: { body: ModifierQuantiteSchema, response: { 200: ResultatUnitaireSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => modifierQuantite(tx, identity, request.body)),
  )
  r.post(
    '/coordination/unitaire/corriger-intitule',
    { schema: { body: CorrigerIntituleSchema, response: { 200: ResultatUnitaireSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => corrigerIntitule(tx, identity, request.body)),
  )
  r.post(
    '/coordination/unitaire/rendre-la-main',
    { schema: { body: RendreLaMainSchema, response: { 200: ResultatUnitaireSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => rendreLaMain(tx, identity, request.body)),
  )
  r.post(
    '/coordination/unitaire/retirer',
    { schema: { body: LignesSelectionSchema, response: { 200: ResultatUnitaireSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => retirerUnites(tx, identity, request.body)),
  )
  r.post(
    '/coordination/unitaire/preparer',
    { schema: { body: LignesSelectionSchema, response: { 200: ResultatUnitaireSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => preparerSelection(tx, identity, request.body)),
  )
  // RG-COO-240 : libérer la semaine (ne crée pas les UM, Q-265 option (c)).
  r.post(
    '/coordination/unitaire/liberer',
    { schema: { body: LibererSemaineSchema, response: { 200: ResultatLiberationSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => libererSemaine(tx, identity, request.body)),
  )
  // RG-COO-260 / 261 / 262 : « Colisage » = création des UM de la sélection.
  r.post(
    '/coordination/unitaire/colisage',
    { schema: { body: LignesSelectionSchema, response: { 200: ResultatUnitaireSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => creerUnites(tx, identity, request.body)),
  )
  r.post(
    '/coordination/unitaire/comptage',
    { schema: { body: ComptagePliageSchema, response: { 200: ResultatUnitaireSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => comptagePliage(tx, identity, request.body)),
  )
  r.get(
    '/coordination/unitaire/encoller',
    { schema: { querystring: EncollerQuerySchema, response: { 200: EncollerSchema } } },
    (request) => lireEncollage(db, identiteCoordination(request), request.query),
  )
  r.post(
    '/coordination/unitaire/encoller',
    { schema: { body: EnregistrerEncollerSchema, response: { 200: EncollerSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => enregistrerEncollage(tx, identity, request.body)),
  )
}
