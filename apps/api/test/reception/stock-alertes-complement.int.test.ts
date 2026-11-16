// REC-P09 / REC-P10 — rebut, mouvements manuels, alertes, paramètres, référentiels : tests
// COMPLÉMENTAIRES écrits depuis RECEPTION_REGLES_METIER.md (RG-REC-151 à 189 ; §2 matrice) et
// core/permissions/catalogue.ts. Ne duplique pas stock-alertes-admin.int.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AlertesSchema, ParametresReceptionSchema, ReferentielLigneSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  idem,
  ligne,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// RG-REC-009 : le PUT porte les valeurs lues (precedent), relues juste avant l'écriture.
const put = async (headers: Record<string, string>, url: string, payload: object) => {
  const lu = await ctx.app.inject({ method: 'GET', url, headers })
  // Sans droit de lecture, le refus attendu est celui du PUT : le corps est renvoyé tel quel.
  const precedent: unknown = lu.statusCode === 200 ? lu.json() : payload
  return ctx.app.inject({ method: 'PUT', url, headers, payload: { ...payload, precedent } })
}

const cles = async (headers: Record<string, string>) =>
  AlertesSchema.parse((await get(ctx, '/api/alertes/reception', headers)).json()).alertes.map(
    (a) => a.cle,
  )

const rebut = (afficheId: number, headers: Record<string, string>, quantite: number) =>
  post(ctx, `/api/affiches/${String(afficheId)}/rebut`, headers, { quantite, motif: 'AUTRE' })

describe('REC-P09 Mise au rebut (RG-REC-156)', () => {
  it('RG-REC-156 valeur limite : rebut = disponible accepté (stock 0)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const r = await rebut(rv.afficheId, s.headers, 5)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ afficheId: rv.afficheId, stock: 0 })
  })

  it('RG-REC-156 valeur limite : rebut de 1 accepté ; quantité négative refusée', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    expect((await rebut(rv.afficheId, s.headers, 1)).statusCode).toBe(200)
    const r = await rebut(rv.afficheId, s.headers, -2)
    expect([400, 422]).toContain(r.statusCode)
    expect(
      await db.mouvement.count({ where: { afficheId: rv.afficheId, type: 'MISE_AU_REBUT' } }),
    ).toBe(1)
  })

  it('RG-REC-156 un motif hors liste est refusé (400)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const r = await post(ctx, `/api/affiches/${String(rv.afficheId)}/rebut`, s.headers, {
      quantite: 1,
      motif: 'INVENTE',
    })
    expect(r.statusCode).toBe(400)
  })

  it('RG-REC-156 deux rebuts successifs ne dépassent jamais le disponible (3 + 3 sur 5 → 200 puis 422)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const u = await autre(ctx, s.plateforme.id, ['cheq'])
    const [a, b] = await Promise.all([
      rebut(rv.afficheId, s.headers, 3),
      rebut(rv.afficheId, u.headers, 3),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 422])
    const mvts = await db.mouvement.findMany({ where: { afficheId: rv.afficheId } })
    expect(mvts.reduce((t, m) => t + m.quantite, 0)).toBe(2)
  })

  it.each([['cheq'], ['recep']] as const)('RG-REC-002 le profil %s met au rebut', async (role) => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const u = await autre(ctx, s.plateforme.id, [role])
    expect((await rebut(rv.afficheId, u.headers, 1)).statusCode).toBe(200)
  })

  it('RG-REC-002 le profil coord ne met pas au rebut (403), aucun mouvement', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const u = await autre(ctx, s.plateforme.id, ['coord'])
    const r = await rebut(rv.afficheId, u.headers, 1)
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
    expect(
      await db.mouvement.count({ where: { afficheId: rv.afficheId, type: 'MISE_AU_REBUT' } }),
    ).toBe(0)
  })

  it('RG-REC-001 mettre au rebut une affiche hors périmètre : 403', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db)
    await f.createMouvement(db, {
      afficheId: a.id,
      type: 'RECEPTION',
      quantite: 5,
      date: new Date(),
    })
    expect((await rebut(a.id, s.headers, 1)).statusCode).toBe(403)
  })

  it('RG-REC-008 rejeu du rebut avec la même clé : un seul mouvement', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const h = { ...s.headers, ...idem() }
    const url = `/api/affiches/${String(rv.afficheId)}/rebut`
    const corps = { quantite: 2, motif: 'AUTRE' }
    const a = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    const b = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    expect(b.json()).toEqual(a.json())
    expect(
      await db.mouvement.count({ where: { afficheId: rv.afficheId, type: 'MISE_AU_REBUT' } }),
    ).toBe(1)
  })

  it('RG-REC-008 même clé, corps différent : 409 REC_IDEMPOTENCE_CONFLIT', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const h = { ...s.headers, ...idem() }
    const url = `/api/affiches/${String(rv.afficheId)}/rebut`
    await ctx.app.inject({
      method: 'POST',
      url,
      headers: h,
      payload: { quantite: 1, motif: 'AUTRE' },
    })
    const b = await ctx.app.inject({
      method: 'POST',
      url,
      headers: h,
      payload: { quantite: 2, motif: 'AUTRE' },
    })
    expect(b.statusCode).toBe(409)
    expect(erreur(b)).toMatchObject({ code: 'REC_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' })
  })

  it.each([['cheq'], ['expe'], ['com']] as const)(
    'RG-REC-155 ajout / sortie manuels refusés au profil %s tant que Q-117 est ouverte (403)',
    async (role) => {
      const s = await site(ctx, [role])
      const a = await f.createAffiche(db, { plateformeId: s.plateforme.id })
      const r = await post(ctx, `/api/affiches/${String(a.id)}/mouvements-manuels`, s.headers, {
        sens: 'SORTIE',
        quantite: 1,
      })
      expect(r.statusCode).toBe(403)
      expect(await db.mouvement.count({ where: { afficheId: a.id } })).toBe(0)
    },
  )
})

describe('REC-P10 Alertes : permissions et levée', () => {
  it.each([['coord'], ['cheq'], ['recep'], ['admin'], ['com']] as const)(
    'RG-REC-002 le profil %s consulte les alertes',
    async (role) => {
      const s = await site(ctx, [role])
      expect((await get(ctx, '/api/alertes/reception', s.headers)).statusCode).toBe(200)
    },
  )

  it('RG-REC-182 une ligne Complète n’est pas en alerte « Visuel non reçu »', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 10)
    expect(await cles(s.headers)).not.toContain(`RG-REC-182:${String(rv.ligne.id)}`)
  })

  it('RG-REC-183 valeur limite : reçu 11 pour 10 (≤ 10 %) → pas d’alerte d’écart', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 11)
    expect(await cles(s.headers)).not.toContain(`RG-REC-183:${String(rv.ligne.id)}`)
  })

  it('RG-REC-187 l’alerte « Feuille définitive à imprimer » est levée à l’impression', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    await db.affiche.update({ where: { id: rv.afficheId }, data: { typeFeuille: 'TEMPORAIRE' } })
    expect(await cles(s.headers)).toContain(`RG-REC-187:${String(rv.afficheId)}`)
    await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'FEUILLE',
      exemplaires: 1,
    })
    expect(await cles(s.headers)).not.toContain(`RG-REC-187:${String(rv.afficheId)}`)
  })

  it('RG-REC-188 l’alerte « Feuilles de stock à refaire » est levée par la réimpression', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    await db.affiche.update({
      where: { id: rv.afficheId },
      data: { typeFeuille: 'DEFINITIVE', feuilleARefaire: true },
    })
    expect(await cles(s.headers)).toContain(`RG-REC-188:${String(rv.afficheId)}`)
    await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'FEUILLE',
      exemplaires: 1,
    })
    expect(await cles(s.headers)).not.toContain(`RG-REC-188:${String(rv.afficheId)}`)
  })

  it('RG-REC-189 une palette CONTROLEE n’est plus en alerte, même ancienne', async () => {
    const s = await site(ctx)
    const r = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'CONTROLEE',
      aControlerDepuis: new Date(Date.now() - 72 * 3_600_000),
    })
    expect(await cles(s.headers)).not.toContain(`RG-REC-189:${String(r.id)}`)
  })

  it('RG-REC-189 valeur limite : 23 h dans le sas (délai 24 h) → pas d’alerte', async () => {
    const s = await site(ctx)
    const r = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      aControlerDepuis: new Date(Date.now() - 23 * 3_600_000),
    })
    expect(await cles(s.headers)).not.toContain(`RG-REC-189:${String(r.id)}`)
  })
})

describe('REC-P10 Paramètres (RG-REC-178)', () => {
  it.each([[1], [5]])('RG-REC-178 valeur limite : %i exemplaire(s) accepté(s)', async (n) => {
    const s = await site(ctx, ['admin'])
    const url = `/api/parametres/reception?site=${String(s.plateforme.id)}`
    const actuels = ParametresReceptionSchema.parse((await get(ctx, url, s.headers)).json())
    try {
      expect((await put(s.headers, url, { ...actuels, exemplairesFeuille: n })).statusCode).toBe(
        200,
      )
    } finally {
      // Q-105 : seul l'allée tampon est par site ; les exemplaires sont GLOBAUX → valeur restaurée.
      await put(s.headers, url, actuels)
    }
  })

  it.each([
    ['ecartReception', 101],
    ['ecartReception', -1],
    ['delaiControle', 0],
    ['alleeInconnues', ''],
  ] as const)('RG-REC-178 refuse %s = %s (400)', async (cle, valeur) => {
    const s = await site(ctx, ['admin'])
    const url = `/api/parametres/reception?site=${String(s.plateforme.id)}`
    const actuels = ParametresReceptionSchema.parse((await get(ctx, url, s.headers)).json())
    expect((await put(s.headers, url, { ...actuels, [cle]: valeur })).statusCode).toBe(400)
  })

  it.each([['coord'], ['cheq'], ['recep'], ['expe'], ['com']] as const)(
    'RG-REC-178 le profil %s n’enregistre pas les paramètres (403), rien n’est écrit',
    async (role) => {
      const s = await site(ctx, [role])
      const avant = await db.parametre.count()
      const r = await put(s.headers, `/api/parametres/reception?site=${String(s.plateforme.id)}`, {
        ecartReception: 10,
        purgeAttendues: 4,
        delaiControle: 24,
        comptageMorceau: 30,
        exemplairesFeuille: 2,
        alleeInconnues: 'Q',
      })
      expect(r.statusCode).toBe(403)
      expect(await db.parametre.count()).toBe(avant)
    },
  )

  it.each([['cheq'], ['expe'], ['com']] as const)(
    'RG-REC-178 le profil %s ne lit pas le paramétrage (403)',
    async (role) => {
      const s = await site(ctx, [role])
      expect((await get(ctx, '/api/parametres/reception', s.headers)).statusCode).toBe(403)
    },
  )

  // CONFLIT DE SOURCES Q-179 : REC §2 (« tous rôles : périmètre par site conservé ») contre RG-COO-167
  // (« l'admin voit tous les sites », retenu par HYPOTHÈSE). Ce test décrit l'alternative : il reste en
  // échec attendu tant que Q-179 n'est pas tranchée dans ce sens (RG-REC-001).
  it.fails(
    'RG-REC-001 l’administrateur ne règle pas un site hors de son périmètre (403)',
    async () => {
      const s = await site(ctx, ['admin'])
      const ailleurs = await f.createPlateforme(db)
      const r = await get(ctx, `/api/parametres/reception?site=${String(ailleurs.id)}`, s.headers)
      expect(r.statusCode).toBe(403)
    },
  )

  it('RG-REC-178 / RG-REC-051 le seuil d’écart paramétré est appliqué au statut Surplus (20 % : 12/10 reste Complète)', async () => {
    const admin = await site(ctx, ['admin'])
    const actuels = ParametresReceptionSchema.parse(
      (await get(ctx, '/api/parametres/reception', admin.headers)).json(),
    )
    try {
      expect(
        (await put(admin.headers, '/api/parametres/reception', { ...actuels, ecartReception: 20 }))
          .statusCode,
      ).toBe(200)
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 12)
      expect(
        (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).statut,
      ).toBe('COMPLETE')
    } finally {
      await put(admin.headers, '/api/parametres/reception', actuels)
    }
  })
})

describe('REC-P10 Référentiels (RG-REC-179 / 035)', () => {
  it('RG-REC-179 libellé vide refusé (400)', async () => {
    const s = await site(ctx, ['admin'])
    expect(
      (await post(ctx, '/api/referentiels/livreurs', s.headers, { libelle: '  ' })).statusCode,
    ).toBe(400)
  })

  it('RG-REC-179 doublon de livreur (casse différente) refusé (409)', async () => {
    const s = await site(ctx, ['admin'])
    const libelle = `Livreur ${String(Date.now())}`
    expect((await post(ctx, '/api/referentiels/livreurs', s.headers, { libelle })).statusCode).toBe(
      201,
    )
    const r = await post(ctx, '/api/referentiels/livreurs', s.headers, {
      libelle: libelle.toLowerCase(),
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-179')
  })

  it.each([['cheq'], ['expe'], ['com']] as const)(
    'RG-REC-179 le profil %s ne gère pas les référentiels (403)',
    async (role) => {
      const s = await site(ctx, [role])
      expect(
        (await post(ctx, '/api/referentiels/livreurs', s.headers, { libelle: 'X' })).statusCode,
      ).toBe(403)
    },
  )

  it.each([['coord'], ['recep']] as const)(
    'RG-REC-179 le profil %s ne désactive pas une entrée de référentiel (403)',
    async (role) => {
      const s = await site(ctx, [role])
      const imp = await f.createImprimeur(db)
      const r = await ctx.app.inject({
        method: 'PATCH',
        url: `/api/referentiels/imprimeurs/${String(imp.id)}`,
        headers: s.headers,
        payload: { actif: false, version: imp.version },
      })
      expect(r.statusCode).toBe(403)
      expect((await db.imprimeur.findUniqueOrThrow({ where: { id: imp.id } })).actif).toBe(true)
    },
  )

  it('RG-REC-009 deux désactivations avec la même version : une seule réussit, l’autre 409', async () => {
    const s = await site(ctx, ['admin'])
    const cree = ReferentielLigneSchema.parse(
      (
        await post(ctx, '/api/referentiels/livreurs', s.headers, {
          libelle: `Livreur conc ${String(Date.now())}`,
        })
      ).json(),
    )
    const patchRef = (actif: boolean) =>
      ctx.app.inject({
        method: 'PATCH',
        url: `/api/referentiels/livreurs/${String(cree.id)}`,
        headers: s.headers,
        payload: { actif, version: cree.version },
      })
    const [a, b] = await Promise.all([patchRef(false), patchRef(false)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-REC-179 / RG-REC-035 un livreur désactivé n’est plus accepté à « Valider la réception » (422)', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 1 }])
    await db.livreur.update({ where: { id: bl.livreurId }, data: { actif: false } })
    const r = await post(ctx, '/api/receptions', s.headers, bl)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_REFERENTIEL_INCONNU')
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })
})
