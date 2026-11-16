// Routes de la vérification des thèmes (COO-P07, ECR-THM-01 / 02 / 03) : parse → service → réponse.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  DemanderCorrectionThemeSchema,
  ListeAnnonceursProchesSchema,
  ListeThemesModifiesSchema,
  ListeThemesProchesSchema,
  ListeVerificationQuerySchema,
  ReprendreThemeBroadcastResultatSchema,
  ReprendreThemeBroadcastSchema,
  ReprendreThemesDossierSchema,
  ResultatVerificationSchema,
  VerdictVerificationSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { identiteCoordination } from './permissions.ts'
import { idem } from './routes.ts'
import {
  demanderCorrectionTheme,
  listerAnnonceursProches,
  listerThemesModifies,
  listerThemesProches,
  reprendreThemeBroadcast,
  reprendreThemesDossier,
  trancherVerification,
} from './themes.ts'

const IdParams = z.object({ id: z.coerce.number().int().positive() })

export function themesRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.get(
    '/coordination/themes/proches',
    {
      schema: {
        querystring: ListeVerificationQuerySchema,
        response: { 200: ListeThemesProchesSchema },
      },
    },
    (request) => listerThemesProches(db, identiteCoordination(request), request.query),
  )
  r.get(
    '/coordination/themes/annonceurs',
    {
      schema: {
        querystring: ListeVerificationQuerySchema,
        response: { 200: ListeAnnonceursProchesSchema },
      },
    },
    (request) => listerAnnonceursProches(db, identiteCoordination(request), request.query),
  )
  r.get(
    '/coordination/themes/broadcast',
    {
      schema: {
        querystring: ListeVerificationQuerySchema,
        response: { 200: ListeThemesModifiesSchema },
      },
    },
    (request) => listerThemesModifies(db, identiteCoordination(request), request.query),
  )

  // RG-COO-069 / 070 : « Demander la correction dans Broadcast ».
  r.post(
    '/coordination/themes/demandes',
    {
      schema: {
        body: DemanderCorrectionThemeSchema,
        response: { 200: ResultatVerificationSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        demanderCorrectionTheme(tx, identity, request.body),
      ),
  )
  // RG-COO-069 / 070 : « Visuels / Annonceurs différents », « Rouvrir ».
  r.post(
    '/coordination/themes/verdicts',
    { schema: { body: VerdictVerificationSchema, response: { 200: ResultatVerificationSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => trancherVerification(tx, identity, request.body)),
  )
  // RG-COO-068 : « Reprendre la version Broadcast » de toutes les lignes modifiées d'un dossier (une transaction).
  r.post(
    '/coordination/themes/broadcast/reprendre-dossier',
    {
      schema: {
        body: ReprendreThemesDossierSchema,
        response: { 200: ReprendreThemeBroadcastResultatSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        reprendreThemesDossier(tx, identity, request.body),
      ),
  )
  // RG-COO-068 : « Reprendre la version Broadcast » d'une ligne attendue.
  r.post(
    '/coordination/themes/broadcast/:id/reprendre',
    {
      schema: {
        params: IdParams,
        body: ReprendreThemeBroadcastSchema,
        response: { 200: ReprendreThemeBroadcastResultatSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        reprendreThemeBroadcast(tx, identity, request.params.id, request.body.version),
      ),
  )
}
