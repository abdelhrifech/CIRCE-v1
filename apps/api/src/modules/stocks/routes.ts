import { rebutStock, conserverStock } from './actions.ts'
import { configurationAdmin, sauverConfigurationFinCampagne } from './configuration.ts'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  ConfigurationFinCampagneSchema,
  RebutStockSchema,
  CiblesAffichesStockSchema,
  StocksSchema,
  StockQuerySchema,
  MouvementStockQuerySchema,
  MouvementsStocksSchema,
  FinCampagneQuerySchema,
  FinCampagneSchema,
  DeciderFinCampagneSchema,
  ExecuterFinCampagneSchema,
  ResultatStocksSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdentity } from '../../core/identity.ts'
import { idem } from '../admin/routes.ts'
import { listerStocks, listerMouvementsStocks } from './lecture.ts'
import { listerFinsCampagne, deciderFinCampagne, executerFinCampagne } from './fin-campagne.ts'
export function stocksRoutes(app: FastifyInstance, db: Db) {
  const r = app.withTypeProvider<ZodTypeProvider>()
  r.post(
    '/stocks/rebut',
    { schema: { body: RebutStockSchema, response: { 200: ResultatStocksSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => rebutStock(tx, i, req.body)),
  )
  r.post(
    '/stocks/conserver',
    { schema: { body: CiblesAffichesStockSchema, response: { 200: ResultatStocksSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => conserverStock(tx, i, req.body)),
  )
  r.get(
    '/admin/fin-campagne',
    { schema: { response: { 200: ConfigurationFinCampagneSchema } } },
    (req) => configurationAdmin(db, requireIdentity(req)),
  )
  r.post(
    '/admin/fin-campagne',
    {
      schema: {
        body: ConfigurationFinCampagneSchema,
        response: { 200: ConfigurationFinCampagneSchema },
      },
    },
    (req, reply) =>
      idem(db, req, reply, (tx, i) => sauverConfigurationFinCampagne(tx, i, req.body)),
  )
  r.get(
    '/stocks',
    { schema: { querystring: StockQuerySchema, response: { 200: StocksSchema } } },
    (req) => listerStocks(db, requireIdentity(req), req.query),
  )
  r.get(
    '/stocks/mouvements',
    {
      schema: { querystring: MouvementStockQuerySchema, response: { 200: MouvementsStocksSchema } },
    },
    (req) => listerMouvementsStocks(db, requireIdentity(req), req.query),
  )
  r.get(
    '/stocks/fin-campagne',
    { schema: { querystring: FinCampagneQuerySchema, response: { 200: FinCampagneSchema } } },
    (req) => listerFinsCampagne(db, requireIdentity(req), req.query),
  )
  r.post(
    '/stocks/fin-campagne/decision',
    { schema: { body: DeciderFinCampagneSchema, response: { 200: ResultatStocksSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => deciderFinCampagne(tx, i, req.body)),
  )
  r.post(
    '/stocks/fin-campagne/executer',
    { schema: { body: ExecuterFinCampagneSchema, response: { 200: ResultatStocksSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => executerFinCampagne(tx, i, req.body)),
  )
}
