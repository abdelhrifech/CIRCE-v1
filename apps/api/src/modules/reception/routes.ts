// Routes du socle Réception (REC-P01) : parse → service → réponse ; aucune règle ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  BonLivraisonSchema,
  CompteursReceptionSchema,
  EnvoiPhotoSchema,
  PhotoSchema,
  ReferentielsReceptionSchema,
  VerificationBlSchema,
  VisuelLigneSchema,
  IdParamSchema,
  ListeAttenduesQuerySchema,
  ListeAttenduesResponseSchema,
  ReceptionDetailSchema,
  StockAfficheSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdempotencyKey, sendIdempotent, withIdempotency } from '../../core/idempotency.ts'
import { requireIdentity } from '../../core/identity.ts'
import { REC } from './permissions.ts'
import { listerReceptionsAttendues } from './attendues.ts'
import { verifierBonDeLivraison } from './bon-livraison.ts'
import { enregistrerPhoto, lirePhoto } from './photos.ts'
import { referentielsReception } from './referentiels.ts'
import { lireVisuel } from './visuel.ts'
import { compteursReception } from './compteurs.ts'
import * as service from './service.ts'

export function receptionRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // REC-P03 : photo du BL (RG-REC-026/027), référentiels (RG-REC-035), vérification du BL, modale Visuel.
  r.post(
    '/photos',
    {
      bodyLimit: 15 * 1024 * 1024,
      schema: { body: EnvoiPhotoSchema, response: { 201: PhotoSchema } },
    },
    async (request, reply) => {
      const identity = requireIdentity(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(
        db,
        {
          userId: identity.userId,
          key,
          method: 'POST',
          path: '/api/photos',
          body: request.body,
          ...REC.idempotence,
        },
        async (tx) => ({ status: 201, body: await enregistrerPhoto(tx, identity, request.body) }),
      )
      return sendIdempotent(reply, result)
    },
  )
  r.get('/photos/:id', { schema: { params: IdParamSchema } }, async (request, reply) => {
    const photo = await lirePhoto(db, requireIdentity(request), request.params.id)
    return reply
      .header('content-type', photo.mimeType)
      .header('x-content-type-options', 'nosniff')
      .header(
        'content-disposition',
        `inline; filename="${encodeURIComponent(photo.intitule ?? 'photo')}"`,
      )
      .send(photo.octets)
  })
  r.get(
    '/reception/referentiels',
    { schema: { response: { 200: ReferentielsReceptionSchema } } },
    (request) => referentielsReception(db, requireIdentity(request)),
  )
  r.post(
    '/receptions/verification',
    { schema: { body: BonLivraisonSchema, response: { 200: VerificationBlSchema } } },
    (request) => verifierBonDeLivraison(db, requireIdentity(request), request.body),
  )
  r.get(
    '/lignes-attendues/:id/visuel',
    { schema: { params: IdParamSchema, response: { 200: VisuelLigneSchema } } },
    (request) => lireVisuel(db, requireIdentity(request), request.params.id),
  )

  // REC-P02 : réceptions attendues (ECR-REC-01) et badges du menu (RG-REC-010).
  r.get(
    '/receptions-attendues',
    {
      schema: {
        querystring: ListeAttenduesQuerySchema,
        response: { 200: ListeAttenduesResponseSchema },
      },
    },
    (request) => listerReceptionsAttendues(db, requireIdentity(request), request.query),
  )
  r.get(
    '/reception/compteurs',
    { schema: { response: { 200: CompteursReceptionSchema } } },
    (request) => compteursReception(db, requireIdentity(request)),
  )

  r.get(
    '/receptions/:id',
    { schema: { params: IdParamSchema, response: { 200: ReceptionDetailSchema } } },
    (request) => service.lireReception(db, requireIdentity(request), request.params.id),
  )

  // RG-REC-074 : la route existe pour répondre explicitement 409.
  r.delete('/receptions/:id', { schema: { params: IdParamSchema } }, (request) =>
    service.supprimerReception(db, requireIdentity(request), request.params.id),
  )

  r.get(
    '/affiches/:id/stock',
    { schema: { params: IdParamSchema, response: { 200: StockAfficheSchema } } },
    (request) => service.lireStockAffiche(db, requireIdentity(request), request.params.id),
  )

  // RG-REC-151 : mouvements append-only → 409 sur modification / suppression.
  for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
    r.route({
      method,
      url: '/mouvements/:id',
      schema: { params: IdParamSchema },
      handler: (request) =>
        service.modifierMouvement(db, requireIdentity(request), request.params.id),
    })
  }
}
