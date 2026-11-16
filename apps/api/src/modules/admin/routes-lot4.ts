// Routes D-19 (file des mails) et D-20 (traitements planifiés) : parse → service → réponse. Aucune règle ici.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  ExecutionTacheSchema,
  ExecutionsQuerySchema,
  ListeExecutionsSchema,
  ListeMailsSchema,
  ListeTachesSchema,
  MailFileSchema,
  MailsQuerySchema,
  RelancerMailSchema,
  ResultatTraitementMailsSchema,
  TacheParamSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdempotencyKey } from '../../core/idempotency.ts'
import { requireIdentity } from '../../core/identity.ts'
import type { MailPort } from '../../core/ports/mail.ts'
import { listerMails, relancerMail, traiterMailsManuel } from '../mails/admin.ts'
import {
  executerTache,
  listerExecutions,
  listerTaches,
  type ContexteTaches,
} from '../taches/service.ts'
import { idem } from './routes.ts'

const IdParam = z.object({ id: z.coerce.number().int().positive() })

export function adminLot4Routes(
  app: FastifyInstance,
  db: Db,
  mail: MailPort,
  ordonnanceurActif: boolean,
): void {
  const r = app.withTypeProvider<ZodTypeProvider>()
  const ctx: ContexteTaches = { db, mail }

  // D-19 : file des mails.
  r.get(
    '/admin/file-envoi',
    { schema: { querystring: MailsQuerySchema, response: { 200: ListeMailsSchema } } },
    (request) => listerMails(db, requireIdentity(request), mail, request.query),
  )
  r.post(
    '/admin/file-envoi/traiter',
    { schema: { response: { 200: ResultatTraitementMailsSchema } } },
    (request) => {
      // L'envoi n'est jamais fait dans une transaction : pas de rejeu stocké (withIdempotency ouvre une transaction),
      // mais la clé reste exigée ; un double clic est sans effet (réservation atomique des lignes de la file).
      const identity = requireIdentity(request)
      requireIdempotencyKey(request)
      return traiterMailsManuel(db, identity, mail)
    },
  )
  r.post(
    '/admin/file-envoi/:id/relancer',
    { schema: { params: IdParam, body: RelancerMailSchema, response: { 200: MailFileSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        relancerMail(tx, identity, request.params.id, request.body.version),
      ),
  )

  // D-20 : traitements planifiés.
  r.get('/admin/taches', { schema: { response: { 200: ListeTachesSchema } } }, (request) =>
    listerTaches(db, requireIdentity(request), ordonnanceurActif),
  )
  r.get(
    '/admin/taches/executions',
    { schema: { querystring: ExecutionsQuerySchema, response: { 200: ListeExecutionsSchema } } },
    async (request) => ({
      executions: await listerExecutions(db, requireIdentity(request), request.query),
    }),
  )
  r.post(
    '/admin/taches/:tache/executer',
    { schema: { params: TacheParamSchema, response: { 200: ExecutionTacheSchema } } },
    (request) => {
      // Les tâches ouvrent leurs propres transactions (SQLite : pas de transaction imbriquée) : pas de rejeu stocké ;
      // la clé reste exigée, le verrou (409 TACHE_DEJA_EN_COURS) et l'idempotence propre de la tâche évitent tout double effet.
      const identity = requireIdentity(request)
      requireIdempotencyKey(request)
      return executerTache(ctx, request.params.tache, { declencheur: 'MANUEL', identity })
    },
  )
}
