import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  ImpressionNcSchema,
  ImpressionNcResultatSchema,
  DeclarantsSchema,
  CasNcListeSchema,
  DeclarerNcSchema,
  DeciderNcSchema,
  ListeNcSchema,
  NcSchema,
  RepondreNcSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdentity } from '../../core/identity.ts'
import { idem } from '../admin/routes.ts'
import {
  imprimerNc,
  declarerNc,
  casNc,
  repondreNc,
  deciderNc,
  lireDeclarants,
  lireJustificatif,
  listerNc,
  sauverDeclarants,
} from './service.ts'
const Id = z.object({ id: z.coerce.number().int().positive() })
export function nonConformiteRoutes(app: FastifyInstance, db: Db) {
  const r = app.withTypeProvider<ZodTypeProvider>()
  r.post(
    '/non-conformites/impressions',
    { schema: { body: ImpressionNcSchema, response: { 200: ImpressionNcResultatSchema } } },
    (req, reply) => idem(db, req, reply, (tx, i) => imprimerNc(tx, i, req.body.ncs)),
  )
  r.get(
    '/non-conformites',
    {
      schema: {
        querystring: z.object({ type: z.enum(['RECEPTION', 'AGENCE']).optional() }),
        response: { 200: ListeNcSchema },
      },
    },
    (req) => listerNc(db, requireIdentity(req), req.query.type),
  )
  r.get(
    '/non-conformites/cas',
    {
      schema: {
        querystring: z.object({ q: z.string().trim().min(2).max(200) }),
        response: { 200: CasNcListeSchema },
      },
    },
    (req) => casNc(db, requireIdentity(req), req.query.q),
  )
  r.post(
    '/non-conformites',
    {
      bodyLimit: 30 * 1024 * 1024,
      schema: { body: DeclarerNcSchema, response: { 200: NcSchema } },
    },
    (req, reply) => idem(db, req, reply, (tx, identity) => declarerNc(tx, identity, req.body)),
  )
  r.post(
    '/non-conformites/:id/decision',
    { schema: { params: Id, body: DeciderNcSchema, response: { 200: NcSchema } } },
    (req, reply) =>
      idem(db, req, reply, (tx, identity) => deciderNc(tx, identity, req.params.id, req.body)),
  )
  r.post(
    '/non-conformites/:id/reponse',
    { schema: { params: Id, body: RepondreNcSchema, response: { 200: NcSchema } } },
    (req, reply) =>
      idem(db, req, reply, (tx, identity) => repondreNc(tx, identity, req.params.id, req.body)),
  )
  r.get('/non-conformites/fichiers/:id', { schema: { params: Id } }, async (req, reply) => {
    const f = await lireJustificatif(db, requireIdentity(req), req.params.id)
    return reply
      .header('Content-Type', f.mimeType)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.nom)}`)
      .send(Buffer.from(f.contenu))
  })
  r.get('/non-conformites/declarants', { schema: { response: { 200: DeclarantsSchema } } }, (req) =>
    lireDeclarants(db, requireIdentity(req)),
  )
  r.post(
    '/non-conformites/declarants',
    { schema: { body: DeclarantsSchema, response: { 200: DeclarantsSchema } } },
    (req, reply) =>
      idem(db, req, reply, (tx, identity) => sauverDeclarants(tx, identity, req.body)),
  )
}
