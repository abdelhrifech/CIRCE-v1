// REC-P01 — socle Réception sur la base de test : endpoints de lecture, refus explicites (409),
// stock = Σ mouvements, lien n–n avec quantité, machines d'états, historique, journal.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ErrorResponseSchema, ReceptionDetailSchema, StockAfficheSchema } from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb } from '../../src/core/db.ts'
import type { Identity } from '../../src/core/identity.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { rattacher, retirerRattachement } from '../../src/modules/reception/rattachement.ts'
import { changerStatutReception } from '../../src/modules/reception/service.ts'
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

const erreur = (body: unknown) => ErrorResponseSchema.parse(body)

async function contexte(roles: string[] = ['recep']) {
  const plateforme = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [{ plateformeId: plateforme.id }])
  const identity: Identity = {
    userId: user.id,
    identifiantExterne: user.identifiantExterne,
    nom: user.nom,
    roles: roles as Identity['roles'],
    perimetre: {
      toutesPlateformes: roles.includes('admin'),
      plateformeIds: [plateforme.id],
      lignes: [{ plateformeId: plateforme.id, atelierId: null }],
    },
    siteId: null,
  }
  return { plateforme, user, identity, headers: devHeaders(user.identifiantExterne) }
}

describe('GET /api/receptions/:id', () => {
  it('RG-REC-002 renvoie la réception, son BL et son historique de statut', async () => {
    const { plateforme, identity, headers } = await contexte()
    const livraison = await f.createLivraison(db, { reference: 'BL-42' })
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      livraisonId: livraison.id,
    })
    await withTransaction(db, (tx) =>
      changerStatutReception(tx, identity, {
        permission: 'reception.valider',
        id: reception.id,
        vers: 'CONTROLEE',
        expectedVersion: 1,
        regle: 'RG-REC-069',
      }),
    )
    const r = await app.inject({ method: 'GET', url: `/api/receptions/${reception.id}`, headers })
    expect(r.statusCode).toBe(200)
    const detail = ReceptionDetailSchema.parse(r.json())
    expect(detail).toMatchObject({ statut: 'CONTROLEE', version: 2, referenceBl: 'BL-42' })
    expect(detail.historique).toEqual([
      expect.objectContaining({ ancien: 'A_CONTROLER', nouveau: 'CONTROLEE', par: identity.nom }),
    ])
  })

  it('RG-REC-004 répond 401 sans identité', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/receptions/1' })
    expect(r.statusCode).toBe(401)
  })

  it('RG-REC-002 refuse un rôle sans droit de consultation (expe) : 403 REC_ACCES_REFUSE', async () => {
    const { plateforme, headers } = await contexte(['expe'])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({ method: 'GET', url: `/api/receptions/${reception.id}`, headers })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
  })

  it('RG-REC-001 refuse une réception d’une plateforme hors périmètre : 403 REC_PERIMETRE_INTERDIT', async () => {
    const { headers } = await contexte()
    const autre = await f.createReception(db)
    const r = await app.inject({ method: 'GET', url: `/api/receptions/${autre.id}`, headers })
    expect(r.statusCode).toBe(403)
    expect(erreur(r.json())).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })

  it('RG-COO-168 le rôle Commerce consulte en lecture (200)', async () => {
    const { plateforme, headers } = await contexte(['com'])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({ method: 'GET', url: `/api/receptions/${reception.id}`, headers })
    expect(r.statusCode).toBe(200)
  })

  it('répond 404 sur une réception inexistante et 400 sur un identifiant invalide', async () => {
    const { headers } = await contexte()
    expect(
      (await app.inject({ method: 'GET', url: '/api/receptions/999999999', headers })).statusCode,
    ).toBe(404)
    expect(
      (await app.inject({ method: 'GET', url: '/api/receptions/abc', headers })).statusCode,
    ).toBe(400)
  })
})

describe('RG-REC-074 aucune suppression ni annulation de réception', () => {
  it('RG-REC-074 DELETE répond 409 et la réception reste en base', async () => {
    const { plateforme, headers } = await contexte(['coord'])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    const r = await app.inject({
      method: 'DELETE',
      url: `/api/receptions/${reception.id}`,
      headers,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r.json())).toMatchObject({
      code: 'REC_SUPPRESSION_INTERDITE',
      regle: 'RG-REC-074',
    })
    expect(await db.reception.count({ where: { id: reception.id } })).toBe(1)
  })

  it('RG-REC-074 DELETE d’une réception inexistante : 404', async () => {
    const { headers } = await contexte(['coord'])
    expect(
      (await app.inject({ method: 'DELETE', url: '/api/receptions/999999999', headers }))
        .statusCode,
    ).toBe(404)
  })
})

describe('RG-REC-151 mouvements append-only', () => {
  it.each(['PUT', 'PATCH', 'DELETE'] as const)(
    'RG-REC-151 %s /api/mouvements/:id répond 409',
    async (method) => {
      const { plateforme, headers } = await contexte()
      const affiche = await f.createAffiche(db, { plateformeId: plateforme.id })
      const mouvement = await f.createMouvement(db, { afficheId: affiche.id, quantite: 10 })
      const r = await app.inject({
        method,
        url: `/api/mouvements/${mouvement.id}`,
        headers,
        payload: {},
      })
      expect(r.statusCode).toBe(409)
      expect(erreur(r.json())).toMatchObject({
        code: 'REC_MOUVEMENT_IMMUABLE',
        regle: 'RG-REC-151',
      })
      expect((await db.mouvement.findUniqueOrThrow({ where: { id: mouvement.id } })).quantite).toBe(
        10,
      )
    },
  )

  it('RG-REC-151 refuse une quantité nulle ou un sens contraire au type (422)', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'RECEPTION',
          quantite: 0,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, regle: 'RG-REC-151' })
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'MISE_AU_REBUT',
          quantite: 5,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, regle: 'RG-REC-153' })
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'RECEPTION',
          quantite: -5,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, regle: 'RG-REC-153' })
    expect(await db.mouvement.count({ where: { afficheId: affiche.id } })).toBe(0)
  })
})

describe('RG-REC-153 / RG-REC-154 stock = Σ mouvements (une seule vérité)', () => {
  it('RG-REC-153 le stock est la somme des mouvements, rebut négatif compris', async () => {
    const { plateforme, identity, headers } = await contexte()
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await withTransaction(db, async (tx) => {
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 100,
      })
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'COMPLEMENT',
        quantite: 20,
      })
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'MISE_AU_REBUT',
        quantite: -15,
      })
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'ECART_CONTROLE',
        quantite: -5,
      })
    })
    const r = await app.inject({ method: 'GET', url: `/api/affiches/${affiche.id}/stock`, headers })
    expect(r.statusCode).toBe(200)
    expect(StockAfficheSchema.parse(r.json()).stock).toBe(100)
  })

  it('RG-REC-154 la colonne quantite de l’affiche est recalculée depuis les mouvements', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 999 })
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 40,
      }),
    )
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).quantite).toBe(40)
  })

  it('RG-REC-004 chaque mouvement porte son auteur et écrit le journal', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    const { mouvement } = await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 10,
      }),
    )
    expect(mouvement.createdById).toBe(identity.userId)
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'AFFICHE',
          entiteId: String(affiche.id),
          action: 'MOUVEMENT_STOCK',
          parId: identity.userId,
        },
      }),
    ).toBe(1)
  })
})

describe('RG-REC-049 / RG-X-060 / RG-X-016 lien plusieurs-à-plusieurs, reçu compté une fois', () => {
  async function afficheAvecStock(
    plateformeId: number,
    identity: Identity,
    stock: number,
    statut: 'ORPHELINE' | 'IDENTIFIEE' = 'ORPHELINE',
  ) {
    const affiche = await f.createAffiche(db, { plateformeId, quantite: 0, statut })
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: stock,
      }),
    )
    return affiche
  }

  it('RG-X-060 une affiche de 100 sur 3 dossiers (50/30/20) : reçu total 100, une ligne par dossier', async () => {
    const { plateforme, identity, headers } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 100)
    for (const quantite of [50, 30, 20]) {
      const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
      await withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite,
          mode: 'BL',
        }),
      )
    }
    const stock = StockAfficheSchema.parse(
      (
        await app.inject({ method: 'GET', url: `/api/affiches/${affiche.id}/stock`, headers })
      ).json(),
    )
    expect(stock).toMatchObject({ stock: 100, quantiteRepartie: 100, nonRepartie: 0 })
    expect(stock.rattachements.map((l) => l.quantite)).toEqual([50, 30, 20])
    expect(new Set(stock.rattachements.map((l) => l.contNum)).size).toBe(3)
  })

  it('RG-X-060 refuse une répartition qui dépasse la quantité reçue (422) sans rien écrire', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 100)
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: l1.id,
        quantite: 80,
        mode: 'BL',
      }),
    )
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: l2.id,
          quantite: 21,
          mode: 'MAIN',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'REC_REPARTITION_DEPASSE', regle: 'RG-X-060' })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(1)
  })

  it('RG-REC-049 refuse une quantité rattachée inférieure à 1 (422)', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: 0,
          mode: 'BL',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422, regle: 'RG-REC-049' })
  })

  it('RG-REC-176 le premier rattachement pose IDENTIFIEE (historique + journal AFFICHE_ASSOCIER)', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: 10,
        mode: 'VISUEL',
      }),
    )
    const apres = await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })
    expect(apres.statut).toBe('IDENTIFIEE')
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'AFFICHE', entiteId: String(affiche.id), nouveau: 'IDENTIFIEE' },
      }),
    ).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(affiche.id), action: 'AFFICHE_ASSOCIER' },
      }),
    ).toBe(1)
  })

  it('RG-COO-088 refuse un second lien actif vers la même ligne (409)', async () => {
    const { plateforme, identity } = await contexte()
    const affiche = await afficheAvecStock(plateforme.id, identity, 10)
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: 5,
        mode: 'BL',
      }),
    )
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: 5,
          mode: 'BL',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, regle: 'RG-COO-088' })
  })

  it('RG-REC-001 refuse le rattachement d’une affiche hors périmètre (403)', async () => {
    const { identity } = await contexte()
    const autre = await f.createAffiche(db)
    const ligne = await f.createReceptionAttendue(db)
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: autre.id,
          ligneAttendueId: ligne.id,
          quantite: 1,
          mode: 'BL',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-001' })
  })
})

describe('RG-REC-137 / RG-REC-114 / RG-REC-007 retrait d’un rattachement', () => {
  it('RG-REC-114 retirer le dernier lien : RETIRE (par, le), affiche ORPHELINE, journal AFFICHE_DISSOCIER', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await f.createAffiche(db, {
      plateformeId: plateforme.id,
      quantite: 0,
      statut: 'ORPHELINE',
    })
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 10,
      }),
    )
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: 10,
        mode: 'BL',
      }),
    )
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    const lienApres = await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })
    expect(lienApres).toMatchObject({ actif: false, retirePar: identity.userId })
    expect(lienApres.retireLe).toBeInstanceOf(Date)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).statut).toBe(
      'ORPHELINE',
    )
    const journal = await db.journalAudit.findMany({
      where: { entiteId: String(affiche.id), action: 'AFFICHE_DISSOCIER' },
    })
    expect(journal).toHaveLength(1)
  })

  it('RG-REC-137 retirer un lien déjà retiré : 409 TRANSITION_INTERDITE', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 10,
      }),
    )
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: 3,
        mode: 'BL',
      }),
    )
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    await expect(
      withTransaction(db, (tx) =>
        retirerRattachement(tx, identity, {
          lienId: lien.id,
          expectedVersion: lien.version + 1,
          permission: 'affiche.rattachement.modifier',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'TRANSITION_INTERDITE', regle: 'RG-REC-137' })
  })

  it('RG-REC-009 retirer avec une version périmée : 409 REC_CONFLIT_VERSION, lien inchangé', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 10,
      }),
    )
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: 3,
        mode: 'BL',
      }),
    )
    await expect(
      withTransaction(db, (tx) =>
        retirerRattachement(tx, identity, {
          lienId: lien.id,
          expectedVersion: 99,
          permission: 'affiche.rattachement.modifier',
        }),
      ),
    ).rejects.toMatchObject({
      httpStatus: 409,
      code: 'REC_CONFLIT_VERSION',
    })
    expect((await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })).actif).toBe(
      true,
    )
  })

  it('RG-REC-114 retirer un lien parmi deux : l’affiche reste IDENTIFIEE', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await f.createAffiche(db, {
      plateformeId: plateforme.id,
      quantite: 0,
      statut: 'ORPHELINE',
    })
    await withTransaction(db, (tx) =>
      enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 10,
      }),
    )
    const l1 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const l2 = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    const lien = await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: l1.id,
        quantite: 5,
        mode: 'BL',
      }),
    )
    await withTransaction(db, (tx) =>
      rattacher(tx, identity, {
        permission: 'affiche.rattachement.modifier',
        afficheId: affiche.id,
        ligneAttendueId: l2.id,
        quantite: 5,
        mode: 'BL',
      }),
    )
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'affiche.rattachement.modifier',
      }),
    )
    expect((await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).statut).toBe(
      'IDENTIFIEE',
    )
  })
})

describe('changerStatutReception (machine d’états + version + historique)', () => {
  it('RG-REC-070 CONTROLEE → A_CONTROLER : 409 TRANSITION_INTERDITE sans historique', async () => {
    const { plateforme, identity } = await contexte()
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: 'CONTROLEE',
    })
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          permission: 'reception.valider',
          id: reception.id,
          vers: 'A_CONTROLER',
          expectedVersion: 1,
          regle: 'RG-REC-070',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'TRANSITION_INTERDITE', regle: 'RG-REC-070' })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'RECEPTION', entiteId: String(reception.id) },
      }),
    ).toBe(0)
  })

  it('RG-REC-009 version périmée : 409 REC_CONFLIT_VERSION, statut inchangé', async () => {
    const { plateforme, identity } = await contexte()
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          permission: 'reception.valider',
          id: reception.id,
          vers: 'CONTROLEE',
          expectedVersion: 7,
          regle: 'RG-REC-069',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'REC_CONFLIT_VERSION', regle: 'RG-REC-009' })
    expect((await db.reception.findUniqueOrThrow({ where: { id: reception.id } })).statut).toBe(
      'A_CONTROLER',
    )
  })

  it('RG-REC-001 hors périmètre : 403', async () => {
    const { identity } = await contexte()
    const autre = await f.createReception(db)
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          permission: 'reception.valider',
          id: autre.id,
          vers: 'CONTROLEE',
          expectedVersion: 1,
          regle: 'RG-REC-069',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-001' })
  })
})

describe('RG-REC-176 ce qui se calcule ne se coche jamais', () => {
  it('RG-REC-176 aucune route n’écrit un statut ou un tag d’affiche', () => {
    for (const method of ['POST', 'PUT', 'PATCH'] as const) {
      for (const url of ['/api/affiches/:id/statut', '/api/affiches/:id/tags']) {
        expect(app.hasRoute({ method, url }), `${method} ${url}`).toBe(false)
      }
    }
  })

  // PATCH /api/affiches/:id existe pour la fiche (RG-REC-131) : il n'accepte ni statut ni tag.
  it('RG-REC-176 la modification de la fiche ignore statut et tags envoyés', async () => {
    const { plateforme, user } = await contexte(['recep'])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, statut: 'ORPHELINE' })
    const r = await app.inject({
      method: 'PATCH',
      url: `/api/affiches/${String(affiche.id)}`,
      headers: devHeaders(user.identifiantExterne),
      payload: {
        version: affiche.version,
        statut: 'IDENTIFIEE',
        feuilleARefaire: true,
        validationAdmin: true,
        tags: ['COMPLEMENT'],
      },
    })
    expect(r.statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } })).toMatchObject({
      statut: 'ORPHELINE',
      feuilleARefaire: false,
      validationAdmin: false,
    })
  })
})

describe('RG-REC-002 les fonctions d’écriture vérifient le droit exigé par le parcours appelant', () => {
  it('RG-REC-002 rattacher refusé à l’agent d’expédition : 403 REC_ACCES_REFUSE, rien d’écrit', async () => {
    const { plateforme, identity } = await contexte(['expe'])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id })
    const ligne = await f.createReceptionAttendue(db, { plateformeId: plateforme.id })
    await expect(
      withTransaction(db, (tx) =>
        rattacher(tx, identity, {
          permission: 'affiche.rattachement.modifier',
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: 1,
          mode: 'MAIN',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403, code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id } })).toBe(0)
  })

  it('RG-REC-002 enregistrer un mouvement refusé au rôle Commerce (lecture seule, RG-COO-168)', async () => {
    const { plateforme, identity } = await contexte(['com'])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'reception.valider',
          afficheId: affiche.id,
          type: 'RECEPTION',
          quantite: 5,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-002' })
    expect(await db.mouvement.count({ where: { afficheId: affiche.id } })).toBe(0)
  })

  it('Q-349 un mouvement manuel est refusé à tous tant que Q-117 est ouverte (même à la Coordination)', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const affiche = await f.createAffiche(db, { plateformeId: plateforme.id, quantite: 0 })
    await expect(
      withTransaction(db, (tx) =>
        enregistrerMouvement(tx, identity, {
          permission: 'stock.mouvement_manuel',
          afficheId: affiche.id,
          type: 'AJOUT_MANUEL',
          quantite: 5,
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403 })
  })

  it('RG-REC-002 changer le statut d’une réception exige le droit du parcours (contrôle : recep seul)', async () => {
    const { plateforme, identity } = await contexte(['coord'])
    const reception = await f.createReception(db, { plateformeId: plateforme.id })
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          id: reception.id,
          vers: 'CONTROLEE',
          expectedVersion: 1,
          regle: 'RG-REC-069',
          permission: 'reception.controler',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403, regle: 'RG-REC-002' })
    expect((await db.reception.findUniqueOrThrow({ where: { id: reception.id } })).statut).toBe(
      'A_CONTROLER',
    )
  })
})

describe('§3.2 la RG citée dans un 409 vient de la machine d’états, pas de l’appelant', () => {
  it('RG-REC-071 A_IDENTIFIER → CONTROLEE cite RG-REC-071 (rattacher d’abord)', async () => {
    const { plateforme, identity } = await contexte()
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: 'A_IDENTIFIER',
    })
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          id: reception.id,
          vers: 'CONTROLEE',
          expectedVersion: 1,
          regle: 'RG-REC-069',
          permission: 'reception.controler',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'TRANSITION_INTERDITE', regle: 'RG-REC-071' })
  })

  it('RG-REC-070 CONTROLEE → CONTROLEE cite RG-REC-070 (déjà contrôlée)', async () => {
    const { plateforme, identity } = await contexte()
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: 'CONTROLEE',
    })
    await expect(
      withTransaction(db, (tx) =>
        changerStatutReception(tx, identity, {
          id: reception.id,
          vers: 'CONTROLEE',
          expectedVersion: 1,
          regle: 'RG-REC-069',
          permission: 'reception.controler',
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409, regle: 'RG-REC-070' })
  })
})
