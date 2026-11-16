// Routes REC-P04 à REC-P10 : parse → service → réponse ; aucune règle ici.
// Les POST de création / transition exigent Idempotency-Key (RG-REC-008) ; les PATCH / PUT d'édition
// passent par une transaction et le verrou optimiste (RG-REC-009).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  AlertesSchema,
  CandidatsSchema,
  ChangerThemeSchema,
  ControleSchema,
  ControleValideSchema,
  CreerInconnueSchema,
  EditionPickingQuerySchema,
  EditionPickingSchema,
  FeuillesSchema,
  FicheAfficheSchema,
  IdParamSchema,
  ImpressionResultatSchema,
  ImpressionSchema,
  InconnueCreeeSchema,
  InconnuesQuerySchema,
  InconnuesSchema,
  IntituleSuggereSchema,
  ListeAffichesQuerySchema,
  ListeAffichesSchema,
  ModifierAfficheSchema,
  MouvementManuelSchema,
  ParametresEcritureSchema,
  ParametresReceptionSchema,
  ParametresResultatSchema,
  RangementSchema,
  RattachementInconnueResultatSchema,
  RattacherAfficheSchema,
  RattacherInconnueSchema,
  RebutSchema,
  ReceptionCreeeSchema,
  ReferentielEntreeSchema,
  ReferentielEtatSchema,
  ReferentielLigneSchema,
  ResultatAfficheSchema,
  RetirerLienSchema,
  SasSchema,
  SignalementSchema,
  SignalerSchema,
  SiteQuerySchema,
  StockMisAJourSchema,
  SuggestionsIntitulesSchema,
  ValidationAdminSchema,
  ValiderControleSchema,
  ValiderReceptionSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { requireIdempotencyKey, sendIdempotent, withIdempotency } from '../../core/idempotency.ts'
import { requireIdentity, type Identity } from '../../core/identity.ts'
import { AppError } from '../../core/errors.ts'
import { withTransaction, type Tx } from '../../core/transaction.ts'
import * as admin from './administration.ts'
import * as affiches from './affiches.ts'
import { listerAlertes } from './alertes.ts'
import { lireControle, listerSas, validerControle } from './controle.ts'
import * as impressions from './impressions.ts'
import * as inconnues from './inconnues.ts'
import { REC } from './permissions.ts'
import * as stocks from './stocks.ts'
import { lireIntituleSuggere, validerReception } from './validation.ts'

const RefParamSchema = z.object({ ref: z.enum(['imprimeurs', 'livreurs']) })
const RefIdParamSchema = RefParamSchema.extend({ id: z.coerce.number().int().positive() })

/**
 * RG-REC-046 : une erreur technique pendant une écriture du module (transaction annulée) est rendue
 * « 500 REC_ERREUR_INTERNE » avec le texte legacy ; les erreurs métier passent telles quelles.
 */
async function technique<T>(request: FastifyRequest, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof AppError) throw error
    request.log.error({ err: error }, 'Erreur technique (Réception)')
    throw new AppError(
      500,
      'REC_ERREUR_INTERNE',
      'Une erreur est survenue, merci de contacter le support',
      {
        regle: 'RG-REC-046',
      },
    )
  }
}

/** Écriture non idempotente (PATCH / PUT) : transaction + erreur technique normalisée. */
function ecrire<T>(db: Db, request: FastifyRequest, run: (tx: Tx) => Promise<T>): Promise<T> {
  return technique(request, () => withTransaction(db, run))
}

/** POST idempotent (RG-REC-008) : la clé, l'opération et la réponse sont dans UNE transaction. */
async function idem<T>(
  db: Db,
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  run: (tx: Tx, identity: Identity) => Promise<T>,
) {
  const identity = requireIdentity(request)
  const key = requireIdempotencyKey(request)
  const result = await technique(request, () =>
    withIdempotency(
      db,
      {
        userId: identity.userId,
        key,
        method: 'POST',
        path: request.url.split('?')[0] ?? request.url,
        body: request.body,
        ...REC.idempotence,
      },
      async (tx) => ({ status, body: await run(tx, identity) }),
    ),
  )
  return sendIdempotent(reply, result)
}

export function receptionSuiteRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // ── REC-P04 : « Valider la réception » ──
  r.post(
    '/receptions',
    { schema: { body: ValiderReceptionSchema, response: { 201: ReceptionCreeeSchema } } },
    (request, reply) =>
      idem(db, request, reply, 201, (tx, identity) => validerReception(tx, identity, request.body)),
  )
  r.get(
    '/lignes-attendues/:id/intitule-suggere',
    { schema: { params: IdParamSchema, response: { 200: IntituleSuggereSchema } } },
    (request) => lireIntituleSuggere(db, requireIdentity(request), request.params.id),
  )

  // ── REC-P05 : sas et contrôle ──
  r.get(
    '/receptions/sas',
    {
      schema: { querystring: z.object({ q: z.string().optional() }), response: { 200: SasSchema } },
    },
    (request) => listerSas(db, requireIdentity(request), request.query.q),
  )
  r.get(
    '/receptions/:id/controle',
    { schema: { params: IdParamSchema, response: { 200: ControleSchema } } },
    (request) => lireControle(db, requireIdentity(request), request.params.id),
  )
  r.post(
    '/receptions/:id/controle',
    {
      schema: {
        params: IdParamSchema,
        body: ValiderControleSchema,
        response: { 200: ControleValideSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        validerControle(tx, identity, request.params.id, request.body),
      ),
  )

  // ── REC-P06 : feuilles de stock, impressions, rangement, édition picking ──
  r.get(
    '/feuilles',
    {
      schema: {
        querystring: z.object({
          ids: z.string().regex(/^\d+(,\d+)*$/, 'Liste d’identifiants invalide'),
        }),
        response: { 200: FeuillesSchema },
      },
    },
    (request) =>
      impressions.lireFeuilles(
        db,
        requireIdentity(request),
        request.query.ids.split(',').map(Number),
      ),
  )
  r.post(
    '/impressions',
    { schema: { body: ImpressionSchema, response: { 200: ImpressionResultatSchema } } },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        impressions.enregistrerImpression(tx, identity, request.body),
      ),
  )
  r.post(
    '/affiches/rangement',
    { schema: { body: RangementSchema, response: { 200: ImpressionResultatSchema } } },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        impressions.ranger(tx, identity, request.body.affiches),
      ),
  )
  r.get(
    '/edition-picking',
    { schema: { querystring: EditionPickingQuerySchema, response: { 200: EditionPickingSchema } } },
    (request) =>
      impressions.editionPicking(
        db,
        requireIdentity(request),
        request.query.plateformeId,
        new Date(`${request.query.du}T00:00:00.000Z`),
        new Date(`${request.query.au}T23:59:59.999Z`),
      ),
  )

  // ── REC-P07 : réceptions inconnues ──
  r.post(
    '/receptions-inconnues',
    { schema: { body: CreerInconnueSchema, response: { 201: InconnueCreeeSchema } } },
    (request, reply) =>
      idem(db, request, reply, 201, (tx, identity) =>
        inconnues.creerReceptionInconnue(tx, identity, request.body),
      ),
  )
  r.get(
    '/receptions-inconnues',
    { schema: { querystring: InconnuesQuerySchema, response: { 200: InconnuesSchema } } },
    (request) => inconnues.listerInconnues(db, requireIdentity(request), request.query.statut),
  )
  r.get(
    '/receptions-inconnues/suggestions',
    {
      schema: {
        querystring: z.object({
          plateformeId: z.coerce.number().int(),
          annonceur: z.string().default(''),
        }),
        response: { 200: SuggestionsIntitulesSchema },
      },
    },
    (request) =>
      inconnues.suggestionsIntitules(
        db,
        requireIdentity(request),
        request.query.plateformeId,
        request.query.annonceur,
      ),
  )
  r.get(
    '/affiches/:id/candidats',
    {
      schema: {
        params: IdParamSchema,
        querystring: z.object({
          q: z.string().default(''),
          tri: z.enum(['depart', 'reste']).optional(),
          max: z.coerce.number().int().min(1).max(20).optional(),
        }),
        response: { 200: CandidatsSchema },
      },
    },
    (request) =>
      inconnues.chercherCandidats(
        db,
        requireIdentity(request),
        request.params.id,
        request.query.q,
        {
          ...(request.query.tri ? { tri: request.query.tri } : {}),
          ...(request.query.max ? { max: request.query.max } : {}),
        },
      ),
  )
  r.post(
    '/affiches/:id/rattacher-inconnue',
    {
      schema: {
        params: IdParamSchema,
        body: RattacherInconnueSchema,
        response: { 200: RattachementInconnueResultatSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        inconnues.rattacherInconnue(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/affiches/:id/signaler',
    {
      schema: { params: IdParamSchema, body: SignalerSchema, response: { 200: SignalementSchema } },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        inconnues.signalerIntrouvable(
          tx,
          identity,
          request.params.id,
          request.body.receptionVersion,
        ),
      ),
  )

  // ── REC-P08 : liste et fiche des affiches ──
  r.get(
    '/affiches',
    { schema: { querystring: ListeAffichesQuerySchema, response: { 200: ListeAffichesSchema } } },
    (request) => affiches.listerAffiches(db, requireIdentity(request), request.query),
  )
  r.get(
    '/affiches/:id',
    { schema: { params: IdParamSchema, response: { 200: FicheAfficheSchema } } },
    (request) => affiches.lireFicheAffiche(db, requireIdentity(request), request.params.id),
  )
  r.patch(
    '/affiches/:id',
    {
      schema: {
        params: IdParamSchema,
        body: ModifierAfficheSchema,
        response: { 200: ResultatAfficheSchema },
      },
    },
    (request) =>
      ecrire(db, request, (tx) =>
        affiches.modifierAffiche(tx, requireIdentity(request), request.params.id, request.body),
      ),
  )
  r.post(
    '/affiches/:id/rattachements',
    {
      schema: {
        params: IdParamSchema,
        body: RattacherAfficheSchema,
        response: { 200: ResultatAfficheSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        affiches.rattacherAutreDossier(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/affiches/:id/changer-theme',
    {
      schema: {
        params: IdParamSchema,
        body: ChangerThemeSchema,
        response: { 200: ResultatAfficheSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        affiches.changerTheme(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/rattachements/:id/retrait',
    {
      schema: {
        params: IdParamSchema,
        body: RetirerLienSchema,
        response: { 200: ResultatAfficheSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        affiches.retirerLien(tx, identity, request.params.id, request.body.lienVersion),
      ),
  )
  r.post(
    '/affiches/:id/validation-admin',
    {
      schema: {
        params: IdParamSchema,
        body: ValidationAdminSchema,
        response: { 200: ResultatAfficheSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        affiches.changerValidationAdmin(tx, identity, request.params.id, request.body),
      ),
  )

  // ── REC-P09 : stock ──
  r.post(
    '/affiches/:id/rebut',
    {
      schema: { params: IdParamSchema, body: RebutSchema, response: { 200: StockMisAJourSchema } },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        stocks.mettreAuRebut(tx, identity, request.params.id, request.body),
      ),
  )
  r.post(
    '/affiches/:id/mouvements-manuels',
    {
      schema: {
        params: IdParamSchema,
        body: MouvementManuelSchema,
        response: { 200: StockMisAJourSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 200, (tx, identity) =>
        stocks.mouvementManuel(tx, identity, request.params.id, request.body),
      ),
  )

  // ── REC-P10 : alertes, paramètres, référentiels ──
  r.get('/alertes/reception', { schema: { response: { 200: AlertesSchema } } }, (request) =>
    listerAlertes(db, requireIdentity(request)),
  )
  r.get(
    '/parametres/reception',
    { schema: { querystring: SiteQuerySchema, response: { 200: ParametresReceptionSchema } } },
    (request) =>
      admin.lireParametresReception(db, requireIdentity(request), request.query.site ?? null),
  )
  r.put(
    '/parametres/reception',
    {
      schema: {
        querystring: SiteQuerySchema,
        body: ParametresEcritureSchema,
        response: { 200: ParametresResultatSchema },
      },
    },
    (request) =>
      ecrire(db, request, (tx) =>
        admin.ecrireParametresReception(
          tx,
          requireIdentity(request),
          request.query.site ?? null,
          request.body,
        ),
      ),
  )
  r.get(
    '/referentiels/:ref',
    { schema: { params: RefParamSchema, response: { 200: z.array(ReferentielLigneSchema) } } },
    (request) => admin.listerReferentiel(db, requireIdentity(request), request.params.ref),
  )
  r.post(
    '/referentiels/:ref',
    {
      schema: {
        params: RefParamSchema,
        body: ReferentielEntreeSchema,
        response: { 201: ReferentielLigneSchema },
      },
    },
    (request, reply) =>
      idem(db, request, reply, 201, (tx, identity) =>
        admin.ajouterReferentiel(tx, identity, request.params.ref, request.body.libelle),
      ),
  )
  r.patch(
    '/referentiels/:ref/:id',
    {
      schema: {
        params: RefIdParamSchema,
        body: ReferentielEtatSchema,
        response: { 200: ReferentielLigneSchema },
      },
    },
    (request) =>
      ecrire(db, request, (tx) =>
        admin.changerEtatReferentiel(
          tx,
          requireIdentity(request),
          request.params.ref,
          request.params.id,
          request.body,
        ),
      ),
  )
}
