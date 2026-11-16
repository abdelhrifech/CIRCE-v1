// REC-P01 — corrections après l'audit spec-auditor : périmètre de la ligne, affiche absente (404),
// écritures versionnées de l'affiche (RG-REC-009), concurrence sur la répartition (RG-X-060),
// droits en écriture pour les 6 profils (RG-REC-002), en-tête x-site-id invalide (400).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Role } from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb } from '../../src/core/db.ts'
import type { Identity } from '../../src/core/identity.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { rattacher, retirerRattachement } from '../../src/modules/reception/rattachement.ts'
import { enregistrerMouvement } from '../../src/modules/reception/stock.ts'
import { seedRef } from '../../src/reference/seed-ref.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance

beforeAll(async () => {
  await seedRef(db)
  app = buildApp({ config, db, closeDb: () => db.$disconnect() })
  await app.ready()
})
afterAll(async () => {
  await app.close()
})

async function contexte(roles: Role[] = ['recep']) {
  const plateforme = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [{ plateformeId: plateforme.id }])
  const identity: Identity = {
    userId: user.id,
    identifiantExterne: user.identifiantExterne,
    nom: user.nom,
    roles,
    perimetre: {
      toutesPlateformes: roles.includes('admin'),
      plateformeIds: [plateforme.id],
      lignes: [{ plateformeId: plateforme.id, atelierId: null }],
    },
    siteId: null,
  }
  return { plateforme, user, identity }
}

async function afficheAvecStock(plateformeId: number, stock: number) {
  const { identity } = await contexte(['coord'])
  const coord: Identity = {
    ...identity,
    perimetre: {
      toutesPlateformes: false,
      plateformeIds: [plateformeId],
      lignes: [{ plateformeId, atelierId: null }],
    },
  }
  const affiche = await f.createAffiche(db, { plateformeId, quantite: 0, statut: 'ORPHELINE' })
  await withTransaction(db, (tx) =>
    enregistrerMouvement(tx, coord, {
      permission: 'reception.valider',
      afficheId: affiche.id,
      type: 'RECEPTION',
      quantite: stock,
    }),
  )
  return db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })
}

describe('RG-REC-001 périmètre contrôlé dans les écritures', () => {
  it('RG-REC-001 rattacher à une ligne attendue d’une plateforme hors périmètre : 403, rien d’écrit', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, 10)
    const ligneAilleurs = await f.createReceptionAttendue(db)
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: ligneAilleurs.id,
          quantite: 1,
          mode: 'MAIN',
        }),
      ),
    ).rejects.toMatchObject({
      httpStatus: 403,
      code: 'REC_PERIMETRE_INTERDIT',
      regle: 'RG-REC-001',
    })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(0)
  })

  it('RG-REC-001 mouvement sur une affiche hors périmètre : 403, aucun mouvement', async () => {
    const { identity } = await contexte()
    const ailleurs = await f.createAffiche(db, { quantite: 0 })
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: ailleurs.id,
          type: 'RECEPTION',
          quantite: 1,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-001' })
    expect(await db.mouvement.count({ where: { afficheId: ailleurs.id } })).toBe(0)
  })

  it('RG-REC-151 mouvement sur une affiche inexistante : 404 (et non une erreur de clé étrangère)', async () => {
    const { identity } = await contexte()
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: 999_999_999,
          type: 'RECEPTION',
          quantite: 1,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 404 })
  })
})

describe('RG-REC-009 toute écriture sur l’affiche est versionnée', () => {
  it('RG-REC-009 un mouvement incrémente la version de l’affiche', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 5,
      }),
    )
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).version).toBe(
      affiche.version + 1,
    )
  })

  it('RG-REC-009 un mouvement avec une version d’affiche périmée : 409 REC_CONFLIT_VERSION, aucun mouvement', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'RECEPTION',
          quantite: 5,
          expectedAfficheVersion: affiche.version + 3,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'REC_CONFLIT_VERSION', regle: 'RG-REC-009' })
    expect(await db.mouvement.count({ where: { afficheId: affiche.id } })).toBe(0)
  })

  it('RG-REC-009 rattacher une affiche déjà IDENTIFIEE incrémente aussi sa version', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, 10)
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: l1.id,
        quantite: 2,
        mode: 'BL',
      }),
    )
    const v1 = (await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).version
    await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: l2.id,
        quantite: 2,
        mode: 'BL',
      }),
    )
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).version).toBe(v1 + 1)
  })

  it('RG-X-060 deux rattachements partant de la même version : le second est refusé (409), la répartition ne dépasse jamais le reçu', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, 100)
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const versionVue = affiche.version
    await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: l1.id,
        quantite: 60,
        mode: 'BL',
        expectedAfficheVersion: versionVue,
      }),
    )
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: l2.id,
          quantite: 30,
          mode: 'BL',
          expectedAfficheVersion: versionVue,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'REC_CONFLIT_VERSION' })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id, actif: true } })).toBe(
      1,
    )
  })
})

describe('RG-REC-002 écritures : autorisé ET refusé pour chacun des 6 profils (REC §2, Q-349)', () => {
  // affiche.rattachement.modifier : coord ✔, admin ✔ (COO §2), recep ✔(cond.) ; cheq « ? » refusé ; expe, com ✘.
  const RATTACHER: [Role, boolean][] = [
    ['coord', true],
    ['admin', true],
    ['recep', true],
    ['cheq', false],
    ['expe', false],
    ['com', false],
  ]
  it.each(RATTACHER)(
    'RG-REC-002 rattacher / retirer par %s : autorisé = %s',
    async (role, autorise) => {
      const { plateforme, identity } = await contexte([role])
      const affiche = await afficheAvecStock(plateforme.id, 10)
      const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
      const run = withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: 1,
          mode: 'MAIN',
        }),
      )
      if (!autorise) {
        await expect(run).rejects.toMatchObject({
          httpStatus: 403,
          code: 'REC_ACCES_REFUSE',
          regle: 'RG-REC-002',
        })
        return
      }
      const lien = await run
      await expect(
        withTransaction(db, (tx) =>
          retirerRattachement(tx, identity, {
            lienId: lien.id,
            expectedVersion: lien.version,
            permission: 'affiche.rattachement.modifier',
          }),
        ),
      ).resolves.toBeUndefined()
    },
  )

  it.each(RATTACHER.filter(([, ok]) => !ok))(
    'RG-REC-002 retirer un lien refusé à %s (403, lien actif)',
    async (role) => {
      const { plateforme } = await contexte()
      const affiche = await afficheAvecStock(plateforme.id, 10)
      const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
      const lien = await f.createRattachement(db, {
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: 1,
      })
      const { identity } = await contexte([role])
      const meme: Identity = {
        ...identity,
        perimetre: {
          toutesPlateformes: false,
          plateformeIds: [plateforme.id],
          lignes: [{ plateformeId: plateforme.id, atelierId: null }],
        },
      }
      await expect(
        withTransaction(db, (tx) =>
          retirerRattachement(tx, meme, {
            lienId: lien.id,
            expectedVersion: lien.version,
            permission: 'affiche.rattachement.modifier',
          }),
        ),
      ).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-002' })
      expect((await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })).actif).toBe(
        true,
      )
    },
  )

  // reception.valider (mouvement de réception) : coord ✔*, recep ✔ ; cheq « ? » refusé ; expe, com ✘ (admin : super-utilisateur Q-421).
  const MOUVEMENT: [Role, boolean][] = [
    ['coord', true],
    ['recep', true],
    ['cheq', false],
    ['expe', false],
    ['com', false],
  ]
  it.each(MOUVEMENT)(
    'RG-REC-002 mouvement de réception par %s : autorisé = %s',
    async (role, autorise) => {
      const { plateforme, identity } = await contexte([role])
      const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
      const run = withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'RECEPTION',
          quantite: 3,
        }),
      )
      if (autorise) {
        await expect(run).resolves.toMatchObject({ stock: 3 })
      } else {
        await expect(run).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-002' })
        expect(await db.mouvement.count({ where: { afficheId: affiche.id } })).toBe(0)
      }
    },
  )
})

describe('en-tête de site', () => {
  it('RG-REC-001 un x-site-id non numérique est une erreur de validation (400)', async () => {
    const { user } = await contexte()
    const r = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { ...devHeaders(user.identifiantExterne), 'x-site-id': 'abc' },
    })
    expect(r.statusCode).toBe(400)
    expect(r.json<{ code: string }>().code).toBe('SITE_INVALIDE')
  })
})
