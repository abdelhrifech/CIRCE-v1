import { analyserProduction } from './analyse.ts'
import { suiviAtelier } from './suivis.ts'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  AnalyseProductionQuerySchema,
  AnalyseProductionSchema,
  SuiviAtelierSchema,
  SuiviAtelierQuerySchema,
  DispositionTableauSchema,
  DonneesTableauSchema,
  J3AjoutSchema,
  J3ContexteSchema,
  J3DonneesSchema,
  J3MajSchema,
  J3Schema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdentity } from '../../core/identity.ts'
import { idem } from '../admin/routes.ts'
import { ajouterJ3, initialiserJ3, lireJ3, modifierJ3, retirerJ3 } from './j3.ts'
import { donneesTableau, lireDisposition, sauverDisposition } from './tableau.ts'
const Id = z.object({ id: z.coerce.number().int().positive() })
export function nouveauPilotageRoutes(app: FastifyInstance, db: Db) {
  const r = app.withTypeProvider<ZodTypeProvider>()
  r.get(
    '/pilotage/analyse',
    {
      schema: {
        querystring: AnalyseProductionQuerySchema,
        response: { 200: AnalyseProductionSchema },
      },
    },
    (req) => analyserProduction(db, requireIdentity(req), req.query),
  )
  r.get(
    '/pilotage/suivi',
    { schema: { querystring: SuiviAtelierQuerySchema, response: { 200: SuiviAtelierSchema } } },
    (req) => suiviAtelier(db, requireIdentity(req), req.query),
  )
  r.get('/j3', { schema: { querystring: J3ContexteSchema, response: { 200: J3Schema } } }, (req) =>
    lireJ3(db, requireIdentity(req), req.query.semaine),
  )
  r.post(
    '/j3/initialiser',
    {
      schema: { body: J3ContexteSchema, response: { 200: z.object({ initialise: z.boolean() }) } },
    },
    (req, reply) => idem(db, req, reply, (tx, i) => initialiserJ3(tx, i, req.body.semaine)),
  )
  r.post(
    '/j3/lignes',
    { schema: { body: J3AjoutSchema, response: { 200: z.object({ message: z.string() }) } } },
    (req, reply) => idem(db, req, reply, (tx, i) => ajouterJ3(tx, i, req.body)),
  )
  r.post(
    '/j3/lignes/:id',
    {
      schema: {
        params: Id,
        body: J3MajSchema,
        response: {
          200: z.object({
            version: z.number().int(),
            donnees: J3DonneesSchema,
            modifieLe: z.string(),
          }),
        },
      },
    },
    (req, reply) => idem(db, req, reply, (tx, i) => modifierJ3(tx, i, req.params.id, req.body)),
  )
  r.post(
    '/j3/lignes/:id/retirer',
    {
      schema: {
        params: Id,
        body: z.object({ version: z.number().int().positive() }),
        response: { 200: z.object({ message: z.string() }) },
      },
    },
    (req, reply) =>
      idem(db, req, reply, (tx, i) => retirerJ3(tx, i, req.params.id, req.body.version)),
  )
  r.get('/pilotage/tableau', { schema: { response: { 200: DonneesTableauSchema } } }, (req) =>
    donneesTableau(db, requireIdentity(req)),
  )
  r.get(
    '/pilotage/tableau/disposition',
    { schema: { response: { 200: DispositionTableauSchema } } },
    (req) => lireDisposition(db, requireIdentity(req)),
  )
  r.post(
    '/pilotage/tableau/disposition',
    { schema: { body: DispositionTableauSchema, response: { 200: DispositionTableauSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => sauverDisposition(tx, i, req.body)),
  )
}
