// Routes du déblocage des préparations (COO-P08) : parse → service → réponse.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  DebloquerGroupeResultatSchema,
  DebloquerGroupeSchema,
  ListeDeblocagesSchema,
  RechercheDeblocageQuerySchema,
  ResultatRechercheDeblocageSchema,
  SuiviDeblocageQuerySchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { identiteCoordination } from './permissions.ts'
import { debloquerGroupe, listerDeblocages, rechercherDeblocables } from './deblocage.ts'
import { idem } from './routes.ts'

export function deblocageRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // RG-COO-140 / 141 / 142 : recherche des groupes de préparation débloquables.
  r.get(
    '/coordination/deblocage/groupes',
    {
      schema: {
        querystring: RechercheDeblocageQuerySchema,
        response: { 200: ResultatRechercheDeblocageSchema },
      },
    },
    (request) => rechercherDeblocables(db, identiteCoordination(request), request.query),
  )
  // RG-COO-145 / 151 : « Rendre la main à la Pré-Prod » (déblocage d'un groupe).
  r.post(
    '/coordination/deblocage/groupes',
    { schema: { body: DebloquerGroupeSchema, response: { 200: DebloquerGroupeResultatSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => debloquerGroupe(tx, identity, request.body)),
  )
  // RG-COO-149 : « Préparations débloquées ».
  r.get(
    '/coordination/deblocage/suivi',
    {
      schema: { querystring: SuiviDeblocageQuerySchema, response: { 200: ListeDeblocagesSchema } },
    },
    (request) => listerDeblocages(db, identiteCoordination(request), request.query),
  )
}
