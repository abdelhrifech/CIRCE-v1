// Routes d'administration (étape 8, lot 2) : parse → service → réponse. Aucune règle métier ici.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  AgentsReceptionAdminSchema,
  AjouterImprimanteSchema,
  AjouterMailPlateformeSchema,
  CreerUtilisateurSchema,
  HistoriqueParametreSchema,
  ModifierImprimanteSchema,
  ModifierParametreSchema,
  ModifierPlateformeSchema,
  ModifierRegleAlerteSchema,
  ModifierUtilisateurSchema,
  ParametreAdminSchema,
  ParametresAdminSchema,
  PlateformeAdminSchema,
  PlateformesAdminSchema,
  PlateformesQuerySchema,
  RegleAlerteAdminSchema,
  ReglesAlerteAdminSchema,
  TypeAlerteSchema,
  SitesAdminSchema,
  SitesQuerySchema,
  UtilisateurAdminSchema,
  UtilisateursAdminSchema,
  UtilisateursQuerySchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdempotencyKey, sendIdempotent, withIdempotency } from '../../core/idempotency.ts'
import { requireIdentity, type Identity } from '../../core/identity.ts'
import { withTransaction, type Tx } from '../../core/transaction.ts'
import { ADM } from './permissions.ts'
import { historiqueParametre, listerParametres, modifierParametre } from './parametres.ts'
import { listerReglesAlerte, modifierRegleAlerte } from './alertes-regles.ts'
import {
  ajouterImprimante,
  ajouterMailPlateforme,
  changerEtatImprimante,
  listerPlateformes,
  modifierPlateforme,
  supprimerMailPlateforme,
} from './plateformes.ts'
import { listerAgentsReception } from './referentiels-reception.ts'
import { listerSites } from './sites.ts'
import { creerUtilisateur, listerUtilisateurs, modifierUtilisateur } from './utilisateurs.ts'

const IdParam = z.object({ id: z.coerce.number().int().positive() })
const PlateformeParam = z.object({ id: z.coerce.number().int().positive() })
const PlateformeMailParam = z.object({
  id: z.coerce.number().int().positive(),
  adresseId: z.coerce.number().int().positive(),
})
const PlateformeImprimanteParam = z.object({
  id: z.coerce.number().int().positive(),
  imprimanteId: z.coerce.number().int().positive(),
})
const TypeAlerteParam = z.object({ type: TypeAlerteSchema })
const CleParam = z.object({ cle: z.string().min(1).max(100) })

/** POST idempotent : la clé, l'opération et la réponse sont dans UNE transaction. */
export async function idem<T>(
  db: Db,
  request: FastifyRequest,
  reply: FastifyReply,
  run: (tx: Tx, identity: Identity) => Promise<T>,
) {
  const identity = requireIdentity(request)
  const result = await withIdempotency(
    db,
    {
      userId: identity.userId,
      key: requireIdempotencyKey(request),
      method: 'POST',
      path: request.url.split('?')[0] ?? request.url,
      body: request.body,
      ...ADM.idempotence,
    },
    async (tx) => ({ status: 200, body: await run(tx, identity) }),
  )
  return sendIdempotent(reply, result)
}

export function adminRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // D-06 : paramètres métier.
  r.get('/admin/parametres', { schema: { response: { 200: ParametresAdminSchema } } }, (request) =>
    listerParametres(db, requireIdentity(request)),
  )
  r.put(
    '/admin/parametres/:cle',
    {
      schema: {
        params: CleParam,
        body: ModifierParametreSchema,
        response: { 200: ParametreAdminSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        modifierParametre(tx, requireIdentity(request), request.params.cle, request.body),
      ),
  )
  r.get(
    '/admin/parametres/:cle/historique',
    { schema: { params: CleParam, response: { 200: HistoriqueParametreSchema } } },
    (request) => historiqueParametre(db, requireIdentity(request), request.params.cle),
  )

  // D-02 : sites et ateliers (lecture).
  r.get(
    '/admin/sites',
    { schema: { querystring: SitesQuerySchema, response: { 200: SitesAdminSchema } } },
    (request) => listerSites(db, requireIdentity(request), request.query),
  )

  // D-01 : utilisateurs.
  r.get(
    '/admin/utilisateurs',
    {
      schema: { querystring: UtilisateursQuerySchema, response: { 200: UtilisateursAdminSchema } },
    },
    (request) => listerUtilisateurs(db, requireIdentity(request), request.query),
  )
  r.post(
    '/admin/utilisateurs',
    { schema: { body: CreerUtilisateurSchema, response: { 200: UtilisateurAdminSchema } } },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) => creerUtilisateur(tx, identity, request.body)),
  )
  r.patch(
    '/admin/utilisateurs/:id',
    {
      schema: {
        params: IdParam,
        body: ModifierUtilisateurSchema,
        response: { 200: UtilisateurAdminSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        modifierUtilisateur(tx, requireIdentity(request), request.params.id, request.body),
      ),
  )

  // D-04 : agents de réception (contrôleurs) ; imprimeurs et livreurs : /api/referentiels/:ref (REC-P10).
  r.get(
    '/admin/referentiels/agents',
    {
      schema: {
        querystring: SitesQuerySchema,
        response: { 200: AgentsReceptionAdminSchema },
      },
    },
    (request) => listerAgentsReception(db, requireIdentity(request), request.query),
  )

  // D-03 : plateformes (coordonnées, mails de réception, imprimantes).
  r.get(
    '/admin/plateformes',
    { schema: { querystring: PlateformesQuerySchema, response: { 200: PlateformesAdminSchema } } },
    (request) => listerPlateformes(db, requireIdentity(request), request.query),
  )
  r.patch(
    '/admin/plateformes/:id',
    {
      schema: {
        params: PlateformeParam,
        body: ModifierPlateformeSchema,
        response: { 200: PlateformeAdminSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        modifierPlateforme(tx, requireIdentity(request), request.params.id, request.body),
      ),
  )
  r.post(
    '/admin/plateformes/:id/adresses-reception',
    {
      schema: {
        params: PlateformeParam,
        body: AjouterMailPlateformeSchema,
        response: { 200: PlateformeAdminSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        ajouterMailPlateforme(tx, identity, request.params.id, request.body.adresse),
      ),
  )
  r.delete(
    '/admin/plateformes/:id/adresses-reception/:adresseId',
    { schema: { params: PlateformeMailParam, response: { 200: PlateformeAdminSchema } } },
    (request) =>
      withTransaction(db, (tx) =>
        supprimerMailPlateforme(
          tx,
          requireIdentity(request),
          request.params.id,
          request.params.adresseId,
        ),
      ),
  )
  r.post(
    '/admin/plateformes/:id/imprimantes',
    {
      schema: {
        params: PlateformeParam,
        body: AjouterImprimanteSchema,
        response: { 200: PlateformeAdminSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, (tx, identity) =>
        ajouterImprimante(tx, identity, request.params.id, request.body.nom),
      ),
  )
  r.patch(
    '/admin/plateformes/:id/imprimantes/:imprimanteId',
    {
      schema: {
        params: PlateformeImprimanteParam,
        body: ModifierImprimanteSchema,
        response: { 200: PlateformeAdminSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        changerEtatImprimante(
          tx,
          requireIdentity(request),
          request.params.id,
          request.params.imprimanteId,
          request.body,
        ),
      ),
  )

  // D-08 : règles d'alerte (canal, destinataires).
  r.get(
    '/admin/alertes/regles',
    { schema: { response: { 200: ReglesAlerteAdminSchema } } },
    (request) => listerReglesAlerte(db, requireIdentity(request)),
  )
  r.put(
    '/admin/alertes/regles/:type',
    {
      schema: {
        params: TypeAlerteParam,
        body: ModifierRegleAlerteSchema,
        response: { 200: RegleAlerteAdminSchema },
      },
    },
    (request) =>
      withTransaction(db, (tx) =>
        modifierRegleAlerte(tx, requireIdentity(request), request.params.type, request.body),
      ),
  )
}
