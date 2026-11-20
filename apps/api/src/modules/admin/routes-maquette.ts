import { z } from 'zod'
import {
  sauverMachine,
  lireBoucles,
  sauverBoucle,
  lireDistributions,
  sauverDistribution,
} from './configuration-atelier.ts'
import { idem } from './routes.ts'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  DistributionInputSchema,
  DistributionSchema,
  DistributionsSchema,
  MachineConfigurationInputSchema,
  MachineConfigurationSchema,
  BoucleTransportInputSchema,
  BoucleTransportSchema,
  BouclesTransportSchema,
  JournalAdminSchema,
  JournalAdminQuerySchema,
  CatalogueStatutsSchema,
  TransportAdminSchema,
  TransportAdminQuerySchema,
  MachinesAdminSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdentity } from '../../core/identity.ts'
import { journalAdmin, catalogueStatuts, transportAdmin, machinesAdmin } from './maquette.ts'
export function adminMaquetteRoutes(app: FastifyInstance, db: Db) {
  const r = app.withTypeProvider<ZodTypeProvider>()
  const Id = z.object({ id: z.coerce.number().int().positive() })
  r.get('/admin/distributions', { schema: { response: { 200: DistributionsSchema } } }, (req) =>
    lireDistributions(db, requireIdentity(req)),
  )
  r.post(
    '/admin/distributions',
    { schema: { body: DistributionInputSchema, response: { 200: DistributionSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => sauverDistribution(tx, i, null, req.body)),
  )
  r.post(
    '/admin/distributions/:id',
    {
      schema: { params: Id, body: DistributionInputSchema, response: { 200: DistributionSchema } },
    },
    (req, reply) =>
      idem(db, req, reply, (tx, i) => sauverDistribution(tx, i, req.params.id, req.body)),
  )
  r.post(
    '/admin/machines',
    {
      schema: {
        body: MachineConfigurationInputSchema,
        response: { 200: MachineConfigurationSchema },
      },
    },
    (req, reply) => idem(db, req, reply, (tx, i) => sauverMachine(tx, i, null, req.body)),
  )
  r.post(
    '/admin/machines/:id',
    {
      schema: {
        params: Id,
        body: MachineConfigurationInputSchema,
        response: { 200: MachineConfigurationSchema },
      },
    },
    (req, reply) => idem(db, req, reply, (tx, i) => sauverMachine(tx, i, req.params.id, req.body)),
  )
  r.get(
    '/admin/transport/boucles',
    { schema: { response: { 200: BouclesTransportSchema } } },
    (req) => lireBoucles(db, requireIdentity(req)),
  )
  r.post(
    '/admin/transport/boucles',
    { schema: { body: BoucleTransportInputSchema, response: { 200: BoucleTransportSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => sauverBoucle(tx, i, null, req.body)),
  )
  r.post(
    '/admin/transport/boucles/:id',
    {
      schema: {
        params: Id,
        body: BoucleTransportInputSchema,
        response: { 200: BoucleTransportSchema },
      },
    },
    (req, reply) => idem(db, req, reply, (tx, i) => sauverBoucle(tx, i, req.params.id, req.body)),
  )
  r.get(
    '/admin/journal',
    { schema: { querystring: JournalAdminQuerySchema, response: { 200: JournalAdminSchema } } },
    (req) => journalAdmin(db, requireIdentity(req), req.query),
  )
  r.get('/admin/statuts', { schema: { response: { 200: CatalogueStatutsSchema } } }, (req) =>
    catalogueStatuts(db, requireIdentity(req)),
  )
  r.get(
    '/admin/transport',
    { schema: { querystring: TransportAdminQuerySchema, response: { 200: TransportAdminSchema } } },
    (req) => transportAdmin(db, requireIdentity(req), req.query),
  )
  r.get('/admin/machines', { schema: { response: { 200: MachinesAdminSchema } } }, (req) =>
    machinesAdmin(db, requireIdentity(req)),
  )
}
