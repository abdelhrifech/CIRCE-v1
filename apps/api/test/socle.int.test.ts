// Socle backend (étape 4) sur un endpoint factice et la base de test : 401, 403, 409 (version,
// transition, idempotence), rejeu idempotent, rollback de transaction, pagination, périmètre, /api/me.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ErrorResponseSchema, MeResponseSchema, PERMISSION_CODES } from '@circe/shared'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/core/config.ts'
import { createDb } from '../src/core/db.ts'
import { CATALOGUE_PERMISSIONS } from '../src/core/permissions/catalogue.ts'
import { seedRef } from '../src/reference/seed-ref.ts'
import * as f from './factories/index.ts'
import { devHeaders } from './support/identite.ts'
import { routesFactices } from './support/module-factice.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance

beforeAll(async () => {
  await seedRef(db)
  app = buildApp({ config, db, closeDb: () => db.$disconnect(), routes: routesFactices(db) })
  await app.ready()
})
afterAll(async () => {
  await app.close()
})

async function utilisateur(roles: string[], plateformeIds: number[] = []) {
  const user = await f.createUtilisateurAvecRoles(
    db,
    roles,
    plateformeIds.map((plateformeId) => ({ plateformeId })),
  )
  return user.identifiantExterne
}

function erreur(body: unknown) {
  return ErrorResponseSchema.parse(body)
}

describe('identité et contexte (RG-REC-001, RG-REC-004, Q-001)', () => {
  it('RG-REC-004 refuse une écriture sans identité (401)', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      payload: { cle: 'x', valeur: '1' },
    })
    expect(r.statusCode).toBe(401)
    expect(erreur(r.json()).code).toBe('NON_AUTHENTIFIE')
  })

  it('refuse un utilisateur inconnu ou inactif (401)', async () => {
    const inconnu = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: devHeaders('personne'),
    })
    expect(inconnu.statusCode).toBe(401)
    const inactif = await f.createUtilisateur(db, { actif: false })
    const r = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: devHeaders(inactif.identifiantExterne),
    })
    expect(r.statusCode).toBe(401)
  })

  it('GET /api/me renvoie rôles, périmètre et permissions calculées par le serveur', async () => {
    const plateforme = await f.createPlateforme(db)
    const id = await utilisateur(['coord'], [plateforme.id])
    const r = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: devHeaders(id, plateforme.id),
    })
    expect(r.statusCode).toBe(200)
    const me = MeResponseSchema.parse(r.json())
    expect(me.roles).toEqual(['coord'])
    expect(me.siteId).toBe(plateforme.id)
    expect(me.perimetre.plateformeIds).toEqual([plateforme.id])
    expect(me.permissions).toContain('validation_admin.valider')
    expect(me.permissions).not.toContain('reception.controler')
  })

  it('RG-REC-001 refuse un site hors périmètre dans l’en-tête x-site-id (403)', async () => {
    const plateforme = await f.createPlateforme(db)
    const autre = await f.createPlateforme(db)
    const id = await utilisateur(['recep'], [plateforme.id])
    const r = await app.inject({ method: 'GET', url: '/api/me', headers: devHeaders(id, autre.id) })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })
})

describe('permissions (RG-REC-002, RG-COO-165)', () => {
  it('RG-REC-002 refuse l’action à un rôle non autorisé (403 PERMISSION)', async () => {
    const id = await utilisateur(['recep'])
    const r = await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      headers: { ...devHeaders(id), 'idempotency-key': 'k-403' },
      payload: { cle: 'refus', valeur: '1' },
    })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'PERMISSION', regle: 'RG-REC-002' })
    expect(await db.parametre.count({ where: { cle: 'refus' } })).toBe(0)
    expect(await db.cleIdempotence.count({ where: { cle: 'k-403' } })).toBe(0)
  })

  it('RG-REC-002 autorise l’action au rôle prévu par la matrice', async () => {
    const id = await utilisateur(['admin'])
    const r = await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      headers: { ...devHeaders(id), 'idempotency-key': 'k-ok' },
      payload: { cle: 'autorise', valeur: '1' },
    })
    expect(r.statusCode).toBe(201)
  })

  it('seed:ref recopie exactement le catalogue des permissions en base', async () => {
    const lignes = await db.rolePermission.findMany({ include: { role: true, permission: true } })
    for (const code of PERMISSION_CODES) {
      const enBase = lignes
        .filter((l) => l.permission.code === code)
        .map((l) => l.role.code)
        .sort()
      expect(enBase, code).toEqual([...CATALOGUE_PERMISSIONS[code].roles].sort())
    }
  })
})

describe('idempotence (RG-REC-008)', () => {
  it('RG-REC-008 exige l’en-tête Idempotency-Key (400)', async () => {
    const id = await utilisateur(['admin'])
    const r = await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      headers: devHeaders(id),
      payload: { cle: 'sans-cle', valeur: '1' },
    })
    expect(r.statusCode).toBe(400)
    expect(erreur(r.json())).toMatchObject({
      code: 'IDEMPOTENCE_CLE_MANQUANTE',
      regle: 'RG-REC-008',
    })
  })

  it('RG-REC-008 rejoue la réponse initiale sans rien recréer (double soumission)', async () => {
    const id = await utilisateur(['admin'])
    const requete = {
      method: 'POST' as const,
      url: '/api/_test/parametres',
      headers: { ...devHeaders(id), 'idempotency-key': 'double-clic' },
      payload: { cle: 'idem', valeur: '42' },
    }
    const premiere = await app.inject(requete)
    const seconde = await app.inject(requete)
    expect(premiere.statusCode).toBe(201)
    expect(seconde.statusCode).toBe(201)
    expect(seconde.json()).toEqual(premiere.json())
    expect(seconde.headers['idempotent-replayed']).toBe('true')
    expect(await db.parametre.count({ where: { cle: 'idem' } })).toBe(1)
    expect(
      await db.journalAudit.count({
        where: {
          entiteId: String(premiere.json<{ id: number }>().id),
          complement: 'module-factice',
        },
      }),
    ).toBe(1)
  })

  it('RG-REC-008 refuse la même clé avec un autre corps (409)', async () => {
    const id = await utilisateur(['admin'])
    const headers = { ...devHeaders(id), 'idempotency-key': 'meme-cle' }
    await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      headers,
      payload: { cle: 'c1', valeur: '1' },
    })
    const r = await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      headers,
      payload: { cle: 'c2', valeur: '1' },
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r.json())).toMatchObject({ code: 'IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' })
    expect(await db.parametre.count({ where: { cle: 'c2' } })).toBe(0)
  })

  it('la même clé est indépendante d’un utilisateur à l’autre', async () => {
    const a = await utilisateur(['admin'])
    const b = await utilisateur(['admin'])
    const payload = { cle: 'par-utilisateur', valeur: '1' }
    const ra = await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      headers: { ...devHeaders(a), 'idempotency-key': 'k' },
      payload,
    })
    expect(ra.statusCode).toBe(201)
    const rb = await app.inject({
      method: 'POST',
      url: '/api/_test/parametres',
      headers: { ...devHeaders(b), 'idempotency-key': 'k' },
      payload: { ...payload, cle: 'par-utilisateur-2' },
    })
    expect(rb.statusCode).toBe(201)
    expect(rb.headers['idempotent-replayed']).toBeUndefined()
  })
})

describe('verrouillage optimiste (RG-REC-009)', () => {
  it('RG-REC-009 accepte la bonne version et l’incrémente', async () => {
    const id = await utilisateur(['admin'])
    const p = await f.createParametre(db)
    const r = await app.inject({
      method: 'PATCH',
      url: `/api/_test/parametres/${p.id}`,
      headers: devHeaders(id),
      payload: { valeur: 'v2', version: 1 },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ id: p.id, version: 2 })
  })

  it('RG-REC-009 refuse une version périmée (409 CONFLIT_VERSION) sans rien écrire', async () => {
    const id = await utilisateur(['admin'])
    const p = await f.createParametre(db)
    await app.inject({
      method: 'PATCH',
      url: `/api/_test/parametres/${p.id}`,
      headers: devHeaders(id),
      payload: { valeur: 'v2', version: 1 },
    })
    const r = await app.inject({
      method: 'PATCH',
      url: `/api/_test/parametres/${p.id}`,
      headers: devHeaders(id),
      payload: { valeur: 'v3', version: 1 },
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r.json())).toMatchObject({ code: 'CONFLIT_VERSION', regle: 'RG-REC-009' })
    expect((await db.parametre.findUniqueOrThrow({ where: { id: p.id } })).valeur).toBe('v2')
  })

  it('répond 404 sur un élément inexistant', async () => {
    const id = await utilisateur(['admin'])
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/_test/parametres/999999',
      headers: devHeaders(id),
      payload: { valeur: 'x', version: 1 },
    })
    expect(r.statusCode).toBe(404)
  })
})

describe('transaction (CLAUDE.md §6)', () => {
  it('annule toutes les écritures si l’opération échoue (rollback) et renvoie 422 avec la règle', async () => {
    const id = await utilisateur(['admin'])
    const journalAvant = await db.journalAudit.count()
    const r = await app.inject({
      method: 'POST',
      url: '/api/_test/echec',
      headers: devHeaders(id),
      payload: { cle: 'jamais-ecrit' },
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r.json())).toMatchObject({ code: 'REGLE_METIER', regle: 'RG-TEST-ROLLBACK' })
    expect(await db.parametre.count({ where: { cle: 'jamais-ecrit' } })).toBe(0)
    expect(await db.journalAudit.count()).toBe(journalAvant)
  })
})

describe('machine d’états et historique de statut (CLAUDE.md §6)', () => {
  it('RG-REC-069 effectue une transition autorisée et écrit l’historique dans la même transaction', async () => {
    const plateforme = await f.createPlateforme(db)
    const id = await utilisateur(['recep'], [plateforme.id])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({
      method: 'POST',
      url: `/api/_test/receptions/${reception.id}/controler`,
      headers: devHeaders(id),
      payload: { version: 1 },
    })
    expect(r.statusCode).toBe(200)
    const histo = await db.statutHistorique.findMany({
      where: { typeEntite: 'RECEPTION', entiteId: String(reception.id) },
    })
    expect(histo).toHaveLength(1)
    expect(histo[0]).toMatchObject({
      ancien: 'A_CONTROLER',
      nouveau: 'CONTROLEE',
      regle: 'RG-REC-069',
    })
  })

  it('RG-REC-070 refuse une transition non listée (409 TRANSITION_INTERDITE) sans historique', async () => {
    const plateforme = await f.createPlateforme(db)
    const id = await utilisateur(['recep'], [plateforme.id])
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: 'CONTROLEE',
    })
    const r = await app.inject({
      method: 'POST',
      url: `/api/_test/receptions/${reception.id}/controler`,
      headers: devHeaders(id),
      payload: { version: 1 },
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r.json())).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-REC-070' })
    expect(
      await db.statutHistorique.count({
        where: { entiteId: String(reception.id), typeEntite: 'RECEPTION' },
      }),
    ).toBe(0)
  })

  it('RG-REC-001 refuse la transition sur une plateforme hors périmètre (403)', async () => {
    const plateforme = await f.createPlateforme(db)
    const autre = await f.createPlateforme(db)
    const id = await utilisateur(['recep'], [plateforme.id])
    const reception = await f.createReception(db, { plateformeId: autre.id })
    const r = await app.inject({
      method: 'POST',
      url: `/api/_test/receptions/${reception.id}/controler`,
      headers: devHeaders(id),
      payload: { version: 1 },
    })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json()).regle).toBe('RG-REC-001')
  })

  it('RG-REC-009 conflit de version sur une transition : code du module REC_CONFLIT_VERSION', async () => {
    const plateforme = await f.createPlateforme(db)
    const id = await utilisateur(['recep'], [plateforme.id])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({
      method: 'POST',
      url: `/api/_test/receptions/${reception.id}/controler`,
      headers: devHeaders(id),
      payload: { version: 5 },
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r.json()).code).toBe('REC_CONFLIT_VERSION')
    expect((await db.reception.findUniqueOrThrow({ where: { id: reception.id } })).statut).toBe(
      'A_CONTROLER',
    )
  })
})

describe('listes : pagination, tri, filtre', () => {
  it('pagine, trie et filtre', async () => {
    for (const cle of ['liste.c', 'liste.a', 'liste.b']) await f.createParametre(db, { cle })
    const r = await app.inject({
      method: 'GET',
      url: '/api/_test/parametres?prefixe=liste.&sort=-cle&page=1&pageSize=2',
    })
    expect(r.statusCode).toBe(200)
    const page = r.json<{
      items: { cle: string }[]
      total: number
      page: number
      pageSize: number
    }>()
    expect(page.total).toBe(3)
    expect(page.items.map((i) => i.cle)).toEqual(['liste.c', 'liste.b'])
    const p2 = await app.inject({
      method: 'GET',
      url: '/api/_test/parametres?prefixe=liste.&sort=-cle&page=2&pageSize=2',
    })
    expect(p2.json<{ items: { cle: string }[] }>().items.map((i) => i.cle)).toEqual(['liste.a'])
  })

  it('refuse un tri sur un champ non autorisé (400)', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/_test/parametres?sort=valeur' })
    expect(r.statusCode).toBe(400)
    expect(erreur(r.json()).code).toBe('VALIDATION')
  })
})
