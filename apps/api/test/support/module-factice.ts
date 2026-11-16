// Endpoints FACTICES du socle (tests uniquement) : ils exercent les helpers sur de vraies tables
// (Parametre, Reception) sans porter de règle métier. Les routes ne contiennent aucune logique :
// tout est dans les fonctions « service » ci-dessous (CLAUDE.md §6).
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { makeListQuerySchema, pageSchema } from '@circe/shared'
import { z } from 'zod'
import type { Db } from '../../src/core/db.ts'
import { BusinessError, NotFoundError } from '../../src/core/errors.ts'
import {
  requireIdempotencyKey,
  sendIdempotent,
  withIdempotency,
} from '../../src/core/idempotency.ts'
import { requireIdentity, type Identity } from '../../src/core/identity.ts'
import { toPage, toPrismaOrderBy, toPrismaPage } from '../../src/core/pagination.ts'
import { assertPermission, assertPlateforme } from '../../src/core/permissions/permissions.ts'
import { assertTransition, type Transitions } from '../../src/core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../src/core/tracabilite.ts'
import { withTransaction, type Tx } from '../../src/core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../src/core/versioning.ts'

const ParametreSchema = z.object({
  id: z.number(),
  cle: z.string(),
  valeur: z.string(),
  version: z.number(),
})
const CreerSchema = z.object({ cle: z.string().min(1), valeur: z.string() })
const ModifierSchema = z.object({ valeur: z.string(), version: z.number().int() })
const ListeSchema = makeListQuerySchema({
  sortable: ['cle', 'createdAt'] as const,
  defaultSort: 'cle',
  filters: { prefixe: z.string().optional() },
})

type StatutFactice = 'A_IDENTIFIER' | 'A_CONTROLER' | 'CONTROLEE'
const TRANSITIONS: Transitions<StatutFactice> = {
  A_IDENTIFIER: ['A_CONTROLER'],
  A_CONTROLER: ['CONTROLEE', 'A_IDENTIFIER'],
  CONTROLEE: ['A_IDENTIFIER'],
}

async function creerParametre(tx: Tx, identity: Identity, input: z.infer<typeof CreerSchema>) {
  const parametre = await tx.parametre.create({ data: input })
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: parametre.id,
    action: 'CREATION_AFFICHE',
    parId: identity.userId,
    nouvelleValeur: input.valeur,
    complement: 'module-factice',
  })
  return {
    id: parametre.id,
    cle: parametre.cle,
    valeur: parametre.valeur,
    version: parametre.version,
  }
}

async function modifierParametre(
  db: Db,
  identity: Identity,
  id: number,
  input: z.infer<typeof ModifierSchema>,
) {
  assertPermission(identity, 'parametrage.gerer')
  return withTransaction(db, async (tx) => {
    const version = await updateWithVersion({
      expectedVersion: input.version,
      update: (where) =>
        tx.parametre.updateMany({
          where: { id, ...where },
          data: { valeur: input.valeur, ...bumpVersion },
        }),
      exists: async () => (await tx.parametre.count({ where: { id } })) > 0,
    })
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: id,
      action: 'MODIFICATION_THEME',
      parId: identity.userId,
    })
    return { id, version }
  })
}

async function echouerApresEcriture(db: Db, identity: Identity, cle: string) {
  assertPermission(identity, 'parametrage.gerer')
  return withTransaction(db, async (tx) => {
    await creerParametre(tx, identity, { cle, valeur: 'temporaire' })
    throw new BusinessError('Échec volontaire après écriture', { regle: 'RG-TEST-ROLLBACK' })
  })
}

async function controlerReception(db: Db, identity: Identity, id: number, version: number) {
  assertPermission(identity, 'reception.controler')
  return withTransaction(db, async (tx) => {
    const reception = await tx.reception.findUnique({ where: { id } })
    if (!reception) throw new NotFoundError()
    assertPlateforme(identity, reception.plateformeId)
    assertTransition(TRANSITIONS, reception.statut, 'CONTROLEE', { regle: 'RG-REC-070' })
    const nouvelle = await updateWithVersion({
      expectedVersion: version,
      update: (where) =>
        tx.reception.updateMany({
          where: { id, ...where },
          data: { statut: 'CONTROLEE', controleLe: new Date(), ...bumpVersion },
        }),
      code: 'REC_CONFLIT_VERSION',
    })
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'RECEPTION',
      entiteId: id,
      ancien: reception.statut,
      nouveau: 'CONTROLEE',
      parId: identity.userId,
      regle: 'RG-REC-069',
    })
    return { id, statut: 'CONTROLEE', version: nouvelle }
  })
}

async function listerParametres(db: Db, query: z.infer<typeof ListeSchema>) {
  const where = query.prefixe ? { cle: { startsWith: query.prefixe } } : {}
  const [items, total] = await Promise.all([
    db.parametre.findMany({ where, orderBy: toPrismaOrderBy(query.sort), ...toPrismaPage(query) }),
    db.parametre.count({ where }),
  ])
  return toPage(
    items.map((p) => ({ id: p.id, cle: p.cle, valeur: p.valeur, version: p.version })),
    total,
    query,
  )
}

export function routesFactices(db: Db) {
  return (api: FastifyInstance) => {
    const r = api.withTypeProvider<ZodTypeProvider>()

    r.post('/_test/parametres', { schema: { body: CreerSchema } }, async (request, reply) => {
      const identity = requireIdentity(request)
      assertPermission(identity, 'parametrage.gerer')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(
        db,
        {
          userId: identity.userId,
          key,
          method: 'POST',
          path: request.url,
          body: request.body,
          code: 'IDEMPOTENCE_CONFLIT',
          regle: 'RG-REC-008',
        },
        async (tx) => ({ status: 201, body: await creerParametre(tx, identity, request.body) }),
      )
      return sendIdempotent(reply, result)
    })

    r.patch(
      '/_test/parametres/:id',
      { schema: { params: z.object({ id: z.coerce.number().int() }), body: ModifierSchema } },
      (request) => modifierParametre(db, requireIdentity(request), request.params.id, request.body),
    )

    r.post('/_test/echec', { schema: { body: z.object({ cle: z.string() }) } }, (request) =>
      echouerApresEcriture(db, requireIdentity(request), request.body.cle),
    )

    r.post(
      '/_test/receptions/:id/controler',
      {
        schema: {
          params: z.object({ id: z.coerce.number().int() }),
          body: z.object({ version: z.number().int() }),
        },
      },
      (request) =>
        controlerReception(db, requireIdentity(request), request.params.id, request.body.version),
    )

    r.get(
      '/_test/parametres',
      { schema: { querystring: ListeSchema, response: { 200: pageSchema(ParametreSchema) } } },
      (request) => listerParametres(db, request.query),
    )
  }
}
