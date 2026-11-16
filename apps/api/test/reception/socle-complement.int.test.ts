// REC-P01 — compléments de tests écrits À PARTIR DES RÈGLES (RECEPTION_REGLES_METIER.md §2, §3.2, §4 ;
// COORDINATION_REGLES_METIER.md RG-X-016, RG-X-060 ; QUESTIONS_OUVERTES.md Q-001, Q-003, Q-108, Q-136,
// Q-349). Ne duplique pas test/reception/socle.int.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ErrorResponseSchema, StockAfficheSchema, type Role } from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb } from '../../src/core/db.ts'
import { withIdempotency } from '../../src/core/idempotency.ts'
import type { Identity } from '../../src/core/identity.ts'
import { withTransaction, type Tx } from '../../src/core/transaction.ts'
import type { StatutReception, TypeMouvement } from '../../src/generated/prisma/client.ts'
import { REC } from '../../src/modules/reception/permissions.ts'
import { rattacher, retirerRattachement } from '../../src/modules/reception/rattachement.ts'
import { changerStatutReception } from '../../src/modules/reception/service.ts'
import {
  enregistrerMouvement,
  quantiteRepartie,
  recuLigne,
  stockAffiche,
} from '../../src/modules/reception/stock.ts'
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

const erreur = (body: unknown) => ErrorResponseSchema.parse(body)

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
  return { plateforme, user, identity, headers: devHeaders(user.identifiantExterne) }
}

async function afficheAvecStock(plateformeId: number, identity: Identity, stock: number) {
  const affiche = await f.createAffiche(db, { plateformeId, quantite: 0, statut: 'ORPHELINE' })
  if (stock !== 0) {
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: stock,
      }),
    )
  }
  return affiche
}

function lier(identity: Identity, afficheId: number, ligneAttendueId: number, quantite: number) {
  return withTransaction(db, (tx) =>
    rattacher(tx, identity, {
      permission: 'affiche.rattachement.modifier',
      afficheId,
      ligneAttendueId,
      quantite,
      mode: 'BL',
    }),
  )
}

const lire = <T>(fn: (tx: Tx) => Promise<T>) => withTransaction(db, fn)

// Matrice §2, ligne « Consulter la Liste des affiches, la fiche affiche et la fiche réception » :
// coord ✔*, cheq ✔*, recep ✔, expe ✘*, admin ✔ (super-utilisateur, Q-421), com ✔ (lecture). ✔* accordé, ✘* refusé (Q-136, Q-349).
const CONSULTATION: Record<Role, boolean> = {
  coord: true,
  cheq: true,
  recep: true,
  expe: false,
  admin: true,
  com: true,
}
const PROFILS = Object.keys(CONSULTATION) as Role[]

// ─────────────────────────── RG-REC-002 : permissions par profil, endpoints REC-P01 ───────────────────────────

describe('RG-REC-002 GET /api/receptions/:id — chaque profil (REC §2)', () => {
  it.each(PROFILS)('RG-REC-002 profil %s : autorisé selon la matrice §2', async (role) => {
    const { plateforme, headers } = await contexte([role])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({ method: 'GET', url: `/api/receptions/${reception.id}`, headers })
    if (CONSULTATION[role]) {
      expect(r.statusCode).toBe(200)
    } else {
      expect(r.statusCode).toBe(403)
      expect(erreur(r.json())).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
    }
  })
})

describe('RG-REC-002 GET /api/affiches/:id/stock — chaque profil (REC §2, fiche affiche)', () => {
  it.each(PROFILS)('RG-REC-002 profil %s : autorisé selon la matrice §2', async (role) => {
    const { plateforme, headers } = await contexte([role])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id })
    const r = await app.inject({ method: 'GET', url: `/api/affiches/${affiche.id}/stock`, headers })
    if (CONSULTATION[role]) {
      expect(r.statusCode).toBe(200)
    } else {
      expect(r.statusCode).toBe(403)
      expect(erreur(r.json())).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
    }
  })
})

describe('RG-REC-074 DELETE /api/receptions/:id — aucun profil ne supprime', () => {
  it.each(PROFILS)(
    'RG-REC-074 profil %s : refus (409 si la réception lui est visible, 403 sinon) et réception conservée',
    async (role) => {
      const { plateforme, headers } = await contexte([role])
      const reception = await f.createReception(db, { plateformeId: plateforme.id })
      const r = await app.inject({
        method: 'DELETE',
        url: `/api/receptions/${reception.id}`,
        headers,
      })
      if (CONSULTATION[role]) {
        expect(r.statusCode).toBe(409)
        expect(erreur(r.json())).toMatchObject({
          code: 'REC_SUPPRESSION_INTERDITE',
          regle: 'RG-REC-074',
        })
      } else {
        expect(r.statusCode).toBe(403)
        expect(erreur(r.json()).regle).toBe('RG-REC-002')
      }
      const apres = await db.reception.findUniqueOrThrow({ where: { id: reception.id } })
      expect(apres).toMatchObject({ statut: 'A_CONTROLER', version: 1 })
    },
  )

  it('RG-REC-074 la réception reste en base même pour une réception contrôlée (coord)', async () => {
    const { plateforme, headers } = await contexte(['coord'])
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: 'CONTROLEE',
    })
    const r = await app.inject({
      method: 'DELETE',
      url: `/api/receptions/${reception.id}`,
      headers,
    })
    expect(r.statusCode).toBe(409)
    expect(await db.reception.count({ where: { id: reception.id } })).toBe(1)
  })

  it('RG-REC-001 DELETE d’une réception hors périmètre : 403 REC_PERIMETRE_INTERDIT, réception conservée', async () => {
    const { headers } = await contexte(['coord'])
    const autre = await f.createReception(db)
    const r = await app.inject({ method: 'DELETE', url: `/api/receptions/${autre.id}`, headers })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
    expect(await db.reception.count({ where: { id: autre.id } })).toBe(1)
  })
})

describe('RG-REC-151 PUT|PATCH|DELETE /api/mouvements/:id — aucun profil ne modifie', () => {
  const cas = PROFILS.flatMap((role) =>
    (['PUT', 'PATCH', 'DELETE'] as const).map((method) => [role, method] as const),
  )
  it.each(cas)('RG-REC-151 profil %s, %s : refus et mouvement intact', async (role, method) => {
    const { plateforme, headers } = await contexte([role])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id })
    const mouvement = await f.createMouvement(db, { afficheId: affiche.id, quantite: 7 })
    const r = await app.inject({
      method,
      url: `/api/mouvements/${mouvement.id}`,
      headers,
      payload: { quantite: 1 },
    })
    if (CONSULTATION[role]) {
      expect(r.statusCode).toBe(409)
      expect(erreur(r.json())).toMatchObject({
        code: 'REC_MOUVEMENT_IMMUABLE',
        regle: 'RG-REC-151',
      })
    } else {
      expect(r.statusCode).toBe(403)
    }
    const apres = await db.mouvement.findUniqueOrThrow({ where: { id: mouvement.id } })
    expect(apres.quantite).toBe(7)
    expect(await db.mouvement.count({ where: { afficheId: affiche.id } })).toBe(1)
  })

  it('RG-REC-151 mouvement inexistant : 404', async () => {
    const { headers } = await contexte()
    const r = await app.inject({ method: 'DELETE', url: '/api/mouvements/999999999', headers })
    expect(r.statusCode).toBe(404)
  })

  it('RG-REC-001 mouvement d’une affiche hors périmètre : 403 REC_PERIMETRE_INTERDIT', async () => {
    const { headers } = await contexte()
    const mouvement = await f.createMouvement(db)
    const r = await app.inject({ method: 'PUT', url: `/api/mouvements/${mouvement.id}`, headers })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })
})

// ─────────────────────────── RG-REC-004 : identité obligatoire ───────────────────────────

describe('RG-REC-004 toute requête REC-P01 exige un utilisateur authentifié identifiable', () => {
  it.each([
    ['DELETE', '/api/receptions/1'],
    ['GET', '/api/affiches/1/stock'],
    ['PUT', '/api/mouvements/1'],
    ['PATCH', '/api/mouvements/1'],
    ['DELETE', '/api/mouvements/1'],
  ] as const)('RG-REC-004 %s %s sans identité : 401', async (method, url) => {
    const r = await app.inject({ method, url })
    expect(r.statusCode).toBe(401)
  })

  it('RG-REC-004 utilisateur inconnu (signature valide) : 401', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/receptions/1',
      headers: devHeaders('utilisateur.inexistant.rec-p01'),
    })
    expect(r.statusCode).toBe(401)
  })

  it('RG-REC-004 utilisateur désactivé : 401', async () => {
    const { plateforme, user, headers } = await contexte()
    await db.utilisateur.update({ where: { id: user.id }, data: { actif: false } })
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({ method: 'GET', url: `/api/receptions/${reception.id}`, headers })
    expect(r.statusCode).toBe(401)
  })
})

// ─────────────────────────── RG-REC-001 : périmètre ───────────────────────────

describe('RG-REC-001 périmètre plateforme / site', () => {
  it('RG-REC-001 GET stock d’une affiche hors périmètre : 403 REC_PERIMETRE_INTERDIT', async () => {
    const { headers } = await contexte()
    const autre = await f.createAffiche(db)
    const r = await app.inject({ method: 'GET', url: `/api/affiches/${autre.id}/stock`, headers })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })

  it('RG-REC-001 utilisateur sans aucune plateforme : 403 sur toute réception', async () => {
    const user = await f.createUtilisateurAvecRoles(db, ['recep'], [])
    const reception = await f.createReception(db)
    const r = await app.inject({
      method: 'GET',
      url: `/api/receptions/${reception.id}`,
      headers: devHeaders(user.identifiantExterne),
    })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })

  it('RG-REC-001 utilisateur à deux plateformes : accède aux deux, pas à une troisième', async () => {
    const p1 = await f.createPlateforme(db)
    const p2 = await f.createPlateforme(db)
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: p1.id }, { plateformeId: p2.id }],
    )
    const headers = devHeaders(user.identifiantExterne)
    const r1 = await f.createReception(db, { plateformeId: p1.id })
    const r2 = await f.createReception(db, { plateformeId: p2.id })
    const r3 = await f.createReception(db)
    const get = (id: number) => app.inject({ method: 'GET', url: `/api/receptions/${id}`, headers })
    expect((await get(r1.id)).statusCode).toBe(200)
    expect((await get(r2.id)).statusCode).toBe(200)
    expect((await get(r3.id)).statusCode).toBe(403)
  })

  it('RG-REC-001 site du bandeau (x-site-id) dans le périmètre : 200', async () => {
    const { plateforme, user } = await contexte()
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({
      method: 'GET',
      url: `/api/receptions/${reception.id}`,
      headers: devHeaders(user.identifiantExterne, plateforme.id),
    })
    expect(r.statusCode).toBe(200)
  })

  it('RG-REC-001 site du bandeau (x-site-id) hors périmètre sur un endpoint Réception : 403', async () => {
    const { plateforme, user } = await contexte()
    const autre = await f.createPlateforme(db)
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({
      method: 'GET',
      url: `/api/receptions/${reception.id}`,
      headers: devHeaders(user.identifiantExterne, autre.id),
    })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })

  it('RG-REC-001 retirer un rattachement d’une affiche hors périmètre : 403, lien inchangé', async () => {
    const proprietaire = await contexte(['coord'])
    const affiche = await afficheAvecStock(proprietaire.plateforme.id, proprietaire.identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: proprietaire.plateforme.id })
    const lien = await lier(proprietaire.identity, affiche.id, ligne.id, 5)
    const etranger = await contexte(['coord'])
    await expect(
      withTransaction(db, (tx) =>
        retirerRattachement(tx, etranger.identity, {
          lienId: lien.id,
          expectedVersion: lien.version,
          permission: 'affiche.rattachement.modifier',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-001' })
    expect((await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })).actif).toBe(
      true,
    )
  })
})

// ─────────────────────────── §3.2 machine RECEPTION ───────────────────────────

describe('§3.2 machine d’états RECEPTION (changerStatutReception)', () => {
  const autorisees: [StatutReception, StatutReception, string][] = [
    ['A_IDENTIFIER', 'A_CONTROLER', 'RG-REC-107'],
    ['A_CONTROLER', 'A_IDENTIFIER', 'RG-REC-114'],
    ['CONTROLEE', 'A_IDENTIFIER', 'RG-REC-114'],
  ]
  it.each(autorisees)(
    'RG-REC-009 transition autorisée %s → %s : statut, version +1, historique, auteur',
    async (de, vers, regle) => {
      const { plateforme, identity } = await contexte(['coord'])
      const reception = await f.createReception(db, { plateformeId: plateforme.id, statut: de })
      await withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          permission: 'reception.valider',
          id: reception.id,
          vers,
          expectedVersion: 1,
          regle,
        }),
      )
      const apres = await db.reception.findUniqueOrThrow({ where: { id: reception.id } })
      expect(apres).toMatchObject({ statut: vers, version: 2, updatedById: identity.userId })
      const histo = await db.statutHistorique.findMany({
        where: { typeEntite: 'RECEPTION', entiteId: String(reception.id) },
      })
      expect(histo).toHaveLength(1)
      expect(histo[0]).toMatchObject({ ancien: de, nouveau: vers, parId: identity.userId })
      expect(histo[0]?.le).toBeInstanceOf(Date)
    },
  )

  const interdites: [StatutReception, StatutReception, string][] = [
    ['A_IDENTIFIER', 'CONTROLEE', 'RG-REC-071'],
    ['CONTROLEE', 'CONTROLEE', 'RG-REC-070'],
    ['A_CONTROLER', 'A_CONTROLER', 'RG-REC-070'],
    ['A_IDENTIFIER', 'A_IDENTIFIER', 'RG-REC-071'],
  ]
  it.each(interdites)(
    '%s → %s interdite : 409 TRANSITION_INTERDITE, statut, version et historique inchangés',
    async (de, vers, regle) => {
      const { plateforme, identity } = await contexte(['coord'])
      const reception = await f.createReception(db, { plateformeId: plateforme.id, statut: de })
      await expect(
        withTransaction(db, (tx) =>
          changerStatutReception(tx, identity, {
            permission: 'reception.valider',
            id: reception.id,
            vers,
            expectedVersion: 1,
            regle,
          }),
        ),
      ).rejects.toMatchObject({ httpStatus: 409, code: 'TRANSITION_INTERDITE' })
      expect(await db.reception.findUniqueOrThrow({ where: { id: reception.id } })).toMatchObject({
        statut: de,
        version: 1,
      })
      expect(
        await db.statutHistorique.count({
          where: { typeEntite: 'RECEPTION', entiteId: String(reception.id) },
        }),
      ).toBe(0)
    },
  )

  it('RG-REC-071 A_IDENTIFIER → CONTROLEE : la règle citée est RG-REC-071', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: 'A_IDENTIFIER',
    })
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          permission: 'reception.valider',
          id: reception.id,
          vers: 'CONTROLEE',
          expectedVersion: 1,
          regle: 'RG-REC-071',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, regle: 'RG-REC-071' })
  })

  it('changerStatutReception sur une réception inexistante : 404', async () => {
    const { identity } = await contexte(['coord'])
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          permission: 'reception.valider',
          id: 999999999,
          vers: 'CONTROLEE',
          expectedVersion: 1,
          regle: 'RG-REC-069',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 404 })
  })
})

// ─────────────────────────── RG-REC-009 : concurrence ───────────────────────────

describe('RG-REC-009 verrouillage optimiste : deux écritures avec la même version', () => {
  it('RG-REC-009 réception : deux transitions successives avec la version 1 → une réussit, l’autre 409', async () => {
    const a = await contexte(['recep'])
    const b = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: a.plateforme.id }])
    const identityB: Identity = { ...a.identity, userId: b.id, nom: b.nom }
    const reception = await f.createReception(db, { plateformeId: a.plateforme.id })
    await withTransaction(db, (tx) =>
      changerStatutReception(tx, a.identity, {
        permission: 'reception.valider',
        id: reception.id,
        vers: 'CONTROLEE',
        expectedVersion: 1,
        regle: 'RG-REC-069',
      }),
    )
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identityB, {
          permission: 'reception.valider',
          id: reception.id,
          vers: 'A_IDENTIFIER',
          expectedVersion: 1,
          regle: 'RG-REC-114',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'REC_CONFLIT_VERSION', regle: 'RG-REC-009' })
    const apres = await db.reception.findUniqueOrThrow({ where: { id: reception.id } })
    expect(apres).toMatchObject({ statut: 'CONTROLEE', version: 2, updatedById: a.identity.userId })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'RECEPTION', entiteId: String(reception.id) },
      }),
    ).toBe(1)
  })

  it('RG-REC-009 réception : deux transitions SIMULTANÉES avec la version 1 → exactement une réussit', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const essais = await Promise.allSettled(
      (['CONTROLEE', 'A_IDENTIFIER'] as const).map((vers) =>
        withTransaction(db, (tx) =>
          changerStatutReception(tx, identity, {
            permission: 'reception.valider',
            id: reception.id,
            vers,
            expectedVersion: 1,
            regle: 'RG-REC-069',
          }),
        ),
      ),
    )
    expect(essais.filter((e) => e.status === 'fulfilled')).toHaveLength(1)
    const rejet = essais.find((e) => e.status === 'rejected')
    expect(rejet?.status === 'rejected' ? rejet.reason : null).toMatchObject({ httpStatus: 409 })
    expect((await db.reception.findUniqueOrThrow({ where: { id: reception.id } })).version).toBe(2)
  })

  it('RG-REC-009 rattachement : deux retraits avec la même version → un seul RETIRE, l’autre 409', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await lier(identity, affiche.id, ligne.id, 4)
    const essais = await Promise.allSettled([
      withTransaction(db, (tx) =>
        retirerRattachement(tx, identity, {
          lienId: lien.id,
          expectedVersion: lien.version,
          permission: 'affiche.rattachement.modifier',
        }),
      ),
      withTransaction(db, (tx) =>
        retirerRattachement(tx, identity, {
          lienId: lien.id,
          expectedVersion: lien.version,
          permission: 'affiche.rattachement.modifier',
        }),
      ),
    ])
    expect(essais.filter((e) => e.status === 'fulfilled')).toHaveLength(1)
    const rejet = essais.find((e) => e.status === 'rejected')
    expect(rejet?.status === 'rejected' ? rejet.reason : null).toMatchObject({ httpStatus: 409 })
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(affiche.id), action: 'AFFICHE_DISSOCIER' },
      }),
    ).toBe(1)
  })

  it('RG-REC-009 affiche : le changement de statut posé par le rattachement incrémente sa version', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const avant = await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })
    await lier(
      identity,
      affiche.id,
      (await f.createReceptionAttendue(db, { plateformeId: plateforme.id })).id,
      3,
    )
    const apres = await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })
    expect(apres.version).toBe(avant.version + 1)
  })
})

// ─────────────────────────── RG-REC-008 : idempotence ───────────────────────────

describe('RG-REC-008 idempotence d’un rattachement (withIdempotency + rattacher)', () => {
  async function rattacherIdempotent(
    identity: Identity,
    cle: string,
    body: { afficheId: number; ligneAttendueId: number; quantite: number },
  ) {
    return withIdempotency(
      db,
      {
        userId: identity.userId,
        key: cle,
        method: 'POST',
        path: `/api/affiches/${body.afficheId}/rattachements`,
        body,
        ...REC.idempotence,
      },
      async (tx) => {
        const lien = await rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          ...body,
          mode: 'MAIN',
        })
        return { status: 201, body: { id: lien.id } }
      },
    )
  }

  it('RG-REC-008 même clé, même corps : un seul lien, un seul journal, réponse rejouée', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const body = { afficheId: affiche.id, ligneAttendueId: ligne.id, quantite: 4 }
    const r1 = await rattacherIdempotent(identity, 'rec-p01-cle-1', body)
    const r2 = await rattacherIdempotent(identity, 'rec-p01-cle-1', body)
    expect(r1.replayed).toBe(false)
    expect(r2).toMatchObject({ replayed: true, status: 201, body: r1.body })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(affiche.id), action: 'AFFICHE_ASSOCIER' },
      }),
    ).toBe(1)
  })

  it('RG-REC-008 même clé, corps différent : 409 REC_IDEMPOTENCE_CONFLIT, aucun second lien', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await rattacherIdempotent(identity, 'rec-p01-cle-2', {
      afficheId: affiche.id,
      ligneAttendueId: ligne.id,
      quantite: 4,
    })
    await expect(
      rattacherIdempotent(identity, 'rec-p01-cle-2', {
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: 5,
      }),
    ).rejects.toMatchObject({
      httpStatus: 409,
      code: 'REC_IDEMPOTENCE_CONFLIT',
      regle: 'RG-REC-008',
    })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(1)
  })

  it('RG-REC-008 échec métier : la clé n’est pas consommée, aucune écriture ; rejouable après correction', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const body = { afficheId: affiche.id, ligneAttendueId: ligne.id, quantite: 11 }
    await expect(rattacherIdempotent(identity, 'rec-p01-cle-3', body)).rejects.toMatchObject({
      httpStatus: 422,
      regle: 'RG-X-060',
    })
    expect(
      await db.cleIdempotence.count({
        where: { utilisateurId: identity.userId, cle: 'rec-p01-cle-3' },
      }),
    ).toBe(0)
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(0)
  })
})

// ─────────────────────────── Transactions : pas d’écriture partielle ───────────────────────────

describe('RG-REC-005 / CLAUDE.md §6 atomicité : échec au milieu → aucune écriture partielle', () => {
  it('RG-REC-005 rattachement puis panne : ni lien, ni statut, ni historique, ni journal', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    // Version relue après le mouvement de stock (écriture versionnée, RG-REC-009).
    const versionAvant = (await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).version
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await expect(
      withTransaction(db, async (tx) => {
        await rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: 5,
          mode: 'BL',
        })
        throw new Error('panne simulée après le rattachement')
      }),
    ).rejects.toThrow('panne simulée')
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(0)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).toMatchObject({
      statut: 'ORPHELINE',
      version: versionAvant,
    })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'AFFICHE', entiteId: String(affiche.id) },
      }),
    ).toBe(0)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(affiche.id), action: 'AFFICHE_ASSOCIER' },
      }),
    ).toBe(0)
  })

  it('RG-REC-154 mouvement puis panne : ni mouvement, ni journal, quantite de l’affiche inchangée', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    await expect(
      withTransaction(db, async (tx) => {
        await enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'COMPLEMENT',
          quantite: 5,
        })
        throw new Error('panne simulée après le mouvement')
      }),
    ).rejects.toThrow('panne simulée')
    expect(await db.mouvement.count({ where: { afficheId: affiche.id } })).toBe(1)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).quantite).toBe(10)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(affiche.id), action: 'MOUVEMENT_STOCK' },
      }),
    ).toBe(1)
  })

  it('RG-REC-009 transition puis panne : statut, version et historique de la réception inchangés', async () => {
    const { plateforme, identity } = await contexte()
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    await expect(
      withTransaction(db, async (tx) => {
        await changerStatutReception(tx, identity, {
          permission: 'reception.valider',
          id: reception.id,
          vers: 'CONTROLEE',
          expectedVersion: 1,
          regle: 'RG-REC-069',
        })
        throw new Error('panne simulée après la transition')
      }),
    ).rejects.toThrow('panne simulée')
    expect(await db.reception.findUniqueOrThrow({ where: { id: reception.id } })).toMatchObject({
      statut: 'A_CONTROLER',
      version: 1,
    })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'RECEPTION', entiteId: String(reception.id) },
      }),
    ).toBe(0)
  })
})

// ─────────────────────────── RG-REC-004 / 006 / 007 : traçabilité ───────────────────────────

describe('RG-REC-004 / RG-REC-006 / RG-REC-007 traçabilité des rattachements', () => {
  it('RG-REC-004 le rattachement garde créé par / créé le et le journal nomme l’auteur', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const avant = new Date(Date.now() - 1000)
    const lien = await lier(identity, affiche.id, ligne.id, 3)
    const stocke = await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })
    expect(stocke).toMatchObject({ creePar: identity.userId, actif: true, retirePar: null })
    expect(stocke.creeLe.getTime()).toBeGreaterThanOrEqual(avant.getTime())
    const journal = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: String(affiche.id), action: 'AFFICHE_ASSOCIER' },
    })
    expect(journal.parId).toBe(identity.userId)
    expect(journal.le.getTime()).toBeGreaterThanOrEqual(avant.getTime())
  })

  it('RG-REC-004 le mouvement porte auteur et date', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 0)
    const { mouvement } = await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 3,
      }),
    )
    expect(mouvement.createdById).toBe(identity.userId)
    expect(mouvement.date).toBeInstanceOf(Date)
    expect(mouvement.createdAt).toBeInstanceOf(Date)
  })

  it('RG-REC-006 retrait du dernier lien : historique AFFICHE IDENTIFIEE → ORPHELINE avec l’auteur', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await lier(identity, affiche.id, ligne.id, 10)
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    const histo = await db.statutHistorique.findMany({
      where: { typeEntite: 'AFFICHE', entiteId: String(affiche.id) },
      orderBy: { id: 'asc' },
    })
    expect(histo.map((h) => [h.ancien, h.nouveau, h.parId])).toEqual([
      ['ORPHELINE', 'IDENTIFIEE', identity.userId],
      ['IDENTIFIEE', 'ORPHELINE', identity.userId],
    ])
  })

  it('RG-REC-007 la dissociation a sa propre action, porte l’id de l’AFFICHE, et n’écrit pas d’association', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await lier(identity, affiche.id, ligne.id, 2)
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    const dissociations = (
      await db.journalAudit.findMany({ where: { action: 'AFFICHE_DISSOCIER' } })
    ).filter(
      (j) =>
        j.donnees !== null && (JSON.parse(j.donnees) as { lienId?: number }).lienId === lien.id,
    )
    expect(dissociations).toHaveLength(1)
    expect(dissociations[0]).toMatchObject({
      typeEntite: 'AFFICHE',
      entiteId: String(affiche.id),
      parId: identity.userId,
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(affiche.id), action: 'AFFICHE_ASSOCIER' },
      }),
    ).toBe(1)
  })
})

// ─────────────────────────── RATTACHEMENT : machine et RG-REC-049 ───────────────────────────

describe('§3.2 machine RATTACHEMENT et RG-REC-049', () => {
  it('RG-REC-137 un lien retiré n’est jamais réactivé : un NOUVEAU lien vers la même ligne est créé', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const premier = await lier(identity, affiche.id, ligne.id, 6)
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: premier.id,
        expectedVersion: premier.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    const second = await lier(identity, affiche.id, ligne.id, 8)
    expect(second.id).not.toBe(premier.id)
    expect(await db.afficheAttendue.findUniqueOrThrow({ where: { id: premier.id } })).toMatchObject(
      { actif: false, quantite: 6 },
    )
    expect(await lire((tx) => recuLigne(tx, ligne.id))).toBe(8)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).statut).toBe(
      'IDENTIFIEE',
    )
  })

  it('RG-REC-137 retirer un rattachement inexistant : 404', async () => {
    const { identity } = await contexte(['coord'])
    await expect(
      withTransaction(db, (tx) =>
        retirerRattachement(tx, identity, {
          lienId: 999999999,
          expectedVersion: 1,
          permission: 'affiche.rattachement.modifier',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 404 })
  })

  it('RG-REC-049 valeur limite : quantité 1 acceptée', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 1)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await lier(identity, affiche.id, ligne.id, 1)
    expect(lien.quantite).toBe(1)
  })

  it.each([-1, 0.5, 1.5])(
    'RG-REC-049 quantité %s refusée (422 REC_RATTACHEMENT_QUANTITE) sans écriture',
    async (quantite) => {
      const { plateforme, identity } = await contexte()
      const affiche = await afficheAvecStock(plateforme.id, identity, 10)
      const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
      await expect(lier(identity, affiche.id, ligne.id, quantite)).rejects.toMatchObject({
        httpStatus: 422,
        code: 'REC_RATTACHEMENT_QUANTITE',
        regle: 'RG-REC-049',
      })
      expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(0)
    },
  )

  it('RG-REC-049 sans limite de nombre : une affiche rattachée à 33 dossiers', async () => {
    const { plateforme, identity, headers } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 33)
    for (let i = 0; i < 33; i++) {
      const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
      await lier(identity, affiche.id, ligne.id, 1)
    }
    const stock = StockAfficheSchema.parse(
      (
        await app.inject({ method: 'GET', url: `/api/affiches/${affiche.id}/stock`, headers })
      ).json(),
    )
    expect(stock.rattachements).toHaveLength(33)
    expect(stock).toMatchObject({ stock: 33, quantiteRepartie: 33, nonRepartie: 0 })
  })

  it('RG-REC-049 rattacher à une ligne attendue inexistante : 404, rien écrit', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    await expect(lier(identity, affiche.id, 999999999, 1)).rejects.toMatchObject({
      httpStatus: 404,
    })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(0)
  })
})

// ─────────────────────────── RG-X-060 / RG-X-016 / RG-REC-153 ───────────────────────────

describe('RG-X-060 / RG-X-016 / RG-REC-153 reçu compté une fois, liens actifs uniquement', () => {
  it('RG-X-060 valeur limite : répartition égale à la quantité reçue acceptée (80 + 20 = 100)', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 100)
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await lier(identity, affiche.id, l1.id, 80)
    await lier(identity, affiche.id, l2.id, 20)
    expect(await lire((tx) => quantiteRepartie(tx, affiche.id))).toBe(100)
  })

  it('RG-X-060 affiche sans mouvement (reçu 0) : tout rattachement est refusé (422)', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 0)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await expect(lier(identity, affiche.id, ligne.id, 1)).rejects.toMatchObject({
      httpStatus: 422,
      code: 'REC_REPARTITION_DEPASSE',
      regle: 'RG-X-060',
    })
  })

  it('RG-X-060 la quantité d’un lien retiré est libérée pour un autre dossier', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await lier(identity, affiche.id, l1.id, 10)
    await expect(lier(identity, affiche.id, l2.id, 1)).rejects.toMatchObject({ httpStatus: 422 })
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    await lier(identity, affiche.id, l2.id, 10)
    expect(await lire((tx) => quantiteRepartie(tx, affiche.id))).toBe(10)
  })

  it('RG-X-060 deux rattachements SIMULTANÉS dépassant ensemble le reçu : un seul passe', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 100)
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const essais = await Promise.allSettled([
      lier(identity, affiche.id, l1.id, 60),
      lier(identity, affiche.id, l2.id, 60),
    ])
    expect(essais.filter((e) => e.status === 'fulfilled')).toHaveLength(1)
    expect(await lire((tx) => quantiteRepartie(tx, affiche.id))).toBe(60)
  })

  it('RG-X-060 plusieurs affiches sur une même ligne : reçu de la ligne = Σ liens, chaque affiche ≤ son reçu', async () => {
    const { plateforme, identity } = await contexte()
    const a1 = await afficheAvecStock(plateforme.id, identity, 100)
    const a2 = await afficheAvecStock(plateforme.id, identity, 50)
    const commune = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const autre = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await lier(identity, a1.id, commune.id, 60)
    await lier(identity, a1.id, autre.id, 40)
    await lier(identity, a2.id, commune.id, 50)
    expect(await lire((tx) => recuLigne(tx, commune.id))).toBe(110)
    expect(await lire((tx) => recuLigne(tx, autre.id))).toBe(40)
    // Total des reçus par ligne = total des stocks : aucune quantité comptée deux fois.
    const stocks =
      (await lire((tx) => stockAffiche(tx, a1.id))) + (await lire((tx) => stockAffiche(tx, a2.id)))
    expect(stocks).toBe(150)
    // a2 est entièrement réparti : même si l’autre ligne a de la place, refus.
    await expect(lier(identity, a2.id, autre.id, 1)).rejects.toMatchObject({
      httpStatus: 422,
      regle: 'RG-X-060',
    })
  })

  it('RG-X-016 dossier multi-semaines : une ligne par semaine, reçu de l’affiche compté une fois', async () => {
    const { plateforme, identity, headers } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 100)
    const s10 = await f.createReceptionAttendue(db, {
      plateformeId: plateforme.id,
      contNum: 777001,
      semNum: 10,
    })
    const s11 = await f.createReceptionAttendue(db, {
      plateformeId: plateforme.id,
      contNum: 777001,
      semNum: 11,
    })
    await lier(identity, affiche.id, s10.id, 60)
    await lier(identity, affiche.id, s11.id, 40)
    const stock = StockAfficheSchema.parse(
      (
        await app.inject({ method: 'GET', url: `/api/affiches/${affiche.id}/stock`, headers })
      ).json(),
    )
    expect(stock).toMatchObject({ stock: 100, quantiteRepartie: 100 })
    expect(stock.rattachements).toHaveLength(2)
    await expect(
      lier(
        identity,
        affiche.id,
        (await f.createReceptionAttendue(db, { plateformeId: plateforme.id })).id,
        1,
      ),
    ).rejects.toMatchObject({ httpStatus: 422, regle: 'RG-X-060' })
  })

  it('RG-REC-153 reçu d’une ligne = Σ liens ACTIFS uniquement (un lien retiré ne compte plus)', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const a1 = await afficheAvecStock(plateforme.id, identity, 30)
    const a2 = await afficheAvecStock(plateforme.id, identity, 20)
    const a3 = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await lier(identity, a1.id, ligne.id, 30)
    await lier(identity, a2.id, ligne.id, 20)
    const retire = await lier(identity, a3.id, ligne.id, 10)
    expect(await lire((tx) => recuLigne(tx, ligne.id))).toBe(60)
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: retire.id,
        expectedVersion: retire.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    expect(await lire((tx) => recuLigne(tx, ligne.id))).toBe(50)
  })

  it('RG-REC-153 ligne sans rattachement : reçu 0', async () => {
    const ligne = await f.createReceptionAttendue(db)
    expect(await lire((tx) => recuLigne(tx, ligne.id))).toBe(0)
  })

  it('RG-REC-153 le rebut réduit le stock mais pas le reçu de la ligne (RG-REC-017)', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 50)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await lier(identity, affiche.id, ligne.id, 50)
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'MISE_AU_REBUT',
        quantite: -10,
      }),
    )
    expect(await lire((tx) => stockAffiche(tx, affiche.id))).toBe(40)
    expect(await lire((tx) => recuLigne(tx, ligne.id))).toBe(50)
  })

  it('RG-REC-153 GET stock : les liens retirés ne figurent ni dans la liste ni dans la quantité répartie', async () => {
    const { plateforme, identity, headers } = await contexte(['coord'])
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await lier(identity, affiche.id, l1.id, 4)
    await lier(identity, affiche.id, l2.id, 3)
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    const stock = StockAfficheSchema.parse(
      (
        await app.inject({ method: 'GET', url: `/api/affiches/${affiche.id}/stock`, headers })
      ).json(),
    )
    expect(stock).toMatchObject({ stock: 10, quantiteRepartie: 3, nonRepartie: 7 })
    expect(stock.rattachements.map((l) => l.ligneAttendueId)).toEqual([l2.id])
  })

  it('RG-REC-153 GET stock d’une affiche sans mouvement : stock 0 ; affiche inexistante : 404', async () => {
    const { plateforme, headers } = await contexte()
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 999 })
    const r = await app.inject({ method: 'GET', url: `/api/affiches/${affiche.id}/stock`, headers })
    expect(StockAfficheSchema.parse(r.json())).toMatchObject({ stock: 0, quantiteRepartie: 0 })
    expect(
      (await app.inject({ method: 'GET', url: '/api/affiches/999999999/stock', headers }))
        .statusCode,
    ).toBe(404)
  })
})

// ─────────────────────────── RG-REC-151 / 153 / 154 : mouvements ───────────────────────────

describe('RG-REC-151 / RG-REC-153 sens et valeurs des mouvements', () => {
  const positifs: TypeMouvement[] = ['RECEPTION', 'COMPLEMENT', 'AJOUT_MANUEL']
  const negatifs: TypeMouvement[] = [
    'MISE_AU_REBUT',
    'SORTIE_MANUELLE',
    'EXPEDITION',
    'RENVOI',
    'DESTRUCTION',
  ]

  it.each(negatifs)('RG-REC-153 %s positif refusé (422 REC_MOUVEMENT_SENS)', async (type) => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 0)
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type,
          quantite: 1,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'REC_MOUVEMENT_SENS', regle: 'RG-REC-153' })
  })

  it.each(positifs)('RG-REC-153 %s négatif refusé (422 REC_MOUVEMENT_SENS)', async (type) => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 0)
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type,
          quantite: -1,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'REC_MOUVEMENT_SENS', regle: 'RG-REC-153' })
  })

  it('RG-REC-151 valeurs limites : +1 et −1 acceptés ; écart de contrôle dans les deux sens', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 0)
    await withTransaction(db, async (tx) => {
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 1,
      })
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'ECART_CONTROLE',
        quantite: 3,
      })
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'ECART_CONTROLE',
        quantite: -2,
      })
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'EXPEDITION',
        quantite: -1,
      })
    })
    expect(await lire((tx) => stockAffiche(tx, affiche.id))).toBe(1)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).quantite).toBe(1)
  })

  it.each([2.5, -0.5])('RG-REC-151 quantité non entière %s refusée (422)', async (quantite) => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 0)
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'ECART_CONTROLE',
          quantite,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, regle: 'RG-REC-151' })
    expect(await db.mouvement.count({ where: { afficheId: affiche.id } })).toBe(0)
  })

  it('RG-REC-154 la colonne quantite suit Σ mouvements après un mouvement négatif', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 30)
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'DESTRUCTION',
        quantite: -30,
      }),
    )
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).quantite).toBe(0)
  })
})

// ─────────────────────────── RG-REC-176 ───────────────────────────

describe('RG-REC-176 aucun statut posé à la main', () => {
  it('RG-REC-176 aucune route d’écriture du statut d’une réception, d’une ligne attendue ou d’un rattachement', () => {
    for (const method of ['POST', 'PUT', 'PATCH'] as const) {
      for (const url of [
        '/api/receptions/:id/statut',
        '/api/lignes-attendues/:id/statut',
        '/api/receptions-attendues/:id/statut',
        '/api/rattachements/:id/statut',
      ]) {
        expect(app.hasRoute({ method, url }), `${method} ${url}`).toBe(false)
      }
    }
  })

  it('RG-REC-176 un second rattachement sur une affiche déjà IDENTIFIEE n’écrit aucun historique de statut', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    await lier(
      identity,
      affiche.id,
      (await f.createReceptionAttendue(db, { plateformeId: plateforme.id })).id,
      3,
    )
    await lier(
      identity,
      affiche.id,
      (await f.createReceptionAttendue(db, { plateformeId: plateforme.id })).id,
      3,
    )
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'AFFICHE', entiteId: String(affiche.id) },
      }),
    ).toBe(1)
  })
})
