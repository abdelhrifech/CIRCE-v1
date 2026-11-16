import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  BusAjusterSchema,
  BusHistoriqueSchema,
  BusReceptionSchema,
  BusReferencesVersionSchema,
  BusSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdentity } from '../../core/identity.ts'
import { idem } from '../admin/routes.ts'
import {
  ajusterBus,
  historiqueBus,
  lireBus,
  lireReferencesBus,
  receptionnerBus,
  sauverReferencesBus,
} from './service.ts'
export function busRoutes(app: FastifyInstance, db: Db) {
  const r = app.withTypeProvider<ZodTypeProvider>()
  r.get('/bus', { schema: { response: { 200: BusSchema } } }, (req) =>
    lireBus(db, requireIdentity(req)),
  )
  r.get('/bus/historique', { schema: { response: { 200: BusHistoriqueSchema } } }, (req) =>
    historiqueBus(db, requireIdentity(req)),
  )
  r.get('/bus/referentiel', { schema: { response: { 200: BusReferencesVersionSchema } } }, (req) =>
    lireReferencesBus(db, requireIdentity(req)),
  )
  r.post(
    '/bus/referentiel',
    { schema: { body: BusReferencesVersionSchema, response: { 200: BusReferencesVersionSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => sauverReferencesBus(tx, i, req.body)),
  )
  r.post(
    '/bus/lignes/:id/ajuster',
    {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: BusAjusterSchema,
        response: { 200: z.object({ message: z.string() }) },
      },
    },
    (req, reply) => idem(db, req, reply, (tx, i) => ajusterBus(tx, i, req.params.id, req.body)),
  )
  r.post(
    '/bus/receptions',
    {
      bodyLimit: 15 * 1024 * 1024,
      schema: {
        body: BusReceptionSchema,
        response: {
          200: z.object({
            receptionId: z.number().int(),
            afficheId: z.number().int(),
            message: z.string(),
          }),
        },
      },
    },
    (req, reply) => idem(db, req, reply, (tx, i) => receptionnerBus(tx, i, req.body)),
  )
}
