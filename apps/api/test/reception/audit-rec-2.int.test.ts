// REC-P04 à P10 — tests demandés par la 2e passe d'audit : paires nominal / rejet manquantes
// (RG-REC-056, 080, 081, 087, 102, 121, 122, 145) et cas portés sous l'ID de la règle (065, 067, 072, 082).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AlertesSchema,
  ControleSchema,
  FeuillesSchema,
  InconnueCreeeSchema,
  InconnuesSchema,
  ListeAffichesSchema,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  ligne,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const controle = async (id: number, headers: Record<string, string>) =>
  ControleSchema.parse((await get(ctx, `/api/receptions/${String(id)}/controle`, headers)).json())

describe('RG-REC-056 contrôle : une ligne par affiche de la palette', () => {
  it('RG-REC-056 le contrôle d’une palette de deux affiches montre deux lignes', async () => {
    const s = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 3 },
      { ligneAttendueId: l2.id, quantite: 4 },
    ])
    const r = await post(ctx, '/api/receptions', s.headers, bl)
    const c = await controle(r.json<{ receptionId: number }>().receptionId, s.headers)
    expect(c.lignes.map((l) => l.quantiteBl).sort()).toEqual([3, 4])
  })

  it('RG-REC-056 un contrôle qui omet une affiche est refusé (400, règle citée)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const c = await controle(rv.receptionId, s.headers)
    const r = await post(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, s.headers, {
      version: c.version,
      controleurId: s.user.id,
      lignes: [{ afficheId: 999999999, qteComptee: 1, allee: 'A', rayon: '1' }],
    })
    expect(r.statusCode).toBe(400)
    expect(erreur(r)).toMatchObject({ code: 'REC_CONTROLE_LIGNES', regle: 'RG-REC-056' })
  })
})

describe('RG-REC-065 / 067 / 072 cas portant l’ID de la règle', () => {
  it('RG-REC-065 une non-conformité hors de la liste fermée est refusée (400, validation du schéma)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const c = await controle(rv.receptionId, s.headers)
    const r = await post(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, s.headers, {
      version: c.version,
      controleurId: s.user.id,
      lignes: c.lignes.map((l) => ({
        afficheId: l.afficheId,
        qteComptee: l.quantiteBl,
        allee: 'A',
        rayon: '1',
        nonConformite: 'INVENTEE',
      })),
    })
    expect(r.statusCode).toBe(400)
  })

  it('RG-REC-067 le contrôleur choisi est enregistré sur la réception', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const c = await controle(rv.receptionId, s.headers)
    const r = await post(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, s.headers, {
      version: c.version,
      controleurId: s.user.id,
      lignes: c.lignes.map((l) => ({
        afficheId: l.afficheId,
        qteComptee: l.quantiteBl,
        allee: 'A',
        rayon: '1',
      })),
    })
    expect(r.statusCode).toBe(200)
    expect(
      (await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })).controleurId,
    ).toBe(s.user.id)
  })

  it('RG-REC-072 une réception inconnue rattachée se contrôle, imprimeur corrigé sur l’affiche', async () => {
    const s = await site(ctx)
    const c = InconnueCreeeSchema.parse(
      (
        await post(ctx, '/api/receptions-inconnues', s.headers, {
          plateformeId: s.plateforme.id,
          supportId: s.support.id,
          quantite: 4,
          allee: 'X',
          rayon: '2',
          sansBl: true,
        })
      ).json(),
    )
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await post(ctx, `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 4 }],
    })
    const imp = await f.createImprimeur(db)
    const k = await controle(c.receptionId, s.headers)
    expect(k.estInconnue).toBe(true)
    const r = await post(ctx, `/api/receptions/${String(c.receptionId)}/controle`, s.headers, {
      version: k.version,
      controleurId: s.user.id,
      imprimeurId: imp.id,
      lignes: k.lignes.map((x) => ({
        afficheId: x.afficheId,
        qteComptee: 4,
        allee: 'B',
        rayon: '3',
      })),
    })
    expect(r.statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).imprimeurId).toBe(
      imp.id,
    )
  })

  it('RG-REC-072 une réception inconnue non rattachée (À identifier) ne se contrôle pas (409)', async () => {
    const s = await site(ctx)
    const c = InconnueCreeeSchema.parse(
      (
        await post(ctx, '/api/receptions-inconnues', s.headers, {
          plateformeId: s.plateforme.id,
          supportId: s.support.id,
          quantite: 4,
          allee: 'X',
          rayon: '2',
          sansBl: true,
        })
      ).json(),
    )
    const k = await controle(c.receptionId, s.headers)
    const r = await post(ctx, `/api/receptions/${String(c.receptionId)}/controle`, s.headers, {
      version: k.version,
      controleurId: s.user.id,
      lignes: k.lignes.map((x) => ({
        afficheId: x.afficheId,
        qteComptee: 4,
        allee: 'B',
        rayon: '3',
      })),
    })
    expect(r.statusCode).toBe(409)
  })
})

describe('RG-REC-080 / 081 / 082 / 087 feuilles de stock', () => {
  const feuille = async (id: number, headers: Record<string, string>) =>
    FeuillesSchema.parse((await get(ctx, `/api/feuilles?ids=${String(id)}`, headers)).json())
      .feuilles[0]

  it('RG-REC-080 sans mouvement la quantité imprimée est 0, jamais le cache affiche.quantite', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, quantite: 100 })
    expect((await feuille(a.id, s.headers))?.quantite).toBe(0)
  })

  it('RG-REC-081 sans dossier rattaché, pas de 1er départ', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, statut: 'ORPHELINE' })
    expect((await feuille(a.id, s.headers))?.premierDepart).toBeNull()
  })

  it('RG-REC-082 un dossier sur une seule semaine n’a pas de fond jaune', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    const fe = await feuille(rv.afficheId, s.headers)
    expect(fe?.semaines).toHaveLength(1)
    expect(fe?.fondJaune).toBe(false)
  })

  it('RG-REC-087 la réimpression d’une affiche hors périmètre est refusée (403), rien n’est journalisé', async () => {
    const s = await site(ctx)
    const ailleurs = await f.createAffiche(db)
    const r = await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [ailleurs.id],
      contenu: 'FEUILLE',
      exemplaires: 1,
    })
    expect(r.statusCode).toBe(403)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(ailleurs.id), action: 'IMPRESSION_FEUILLE' },
      }),
    ).toBe(0)
  })
})

describe('RG-REC-102 / 121 / 122 listes', () => {
  it('RG-REC-102 un statut de filtre inconnu est refusé (400)', async () => {
    const s = await site(ctx)
    expect((await get(ctx, '/api/receptions-inconnues?statut=PERDUE', s.headers)).statusCode).toBe(
      400,
    )
  })

  it('RG-REC-121 liste vide pour un site sans affiche', async () => {
    const s = await site(ctx)
    const l = ListeAffichesSchema.parse((await get(ctx, '/api/affiches', s.headers)).json())
    expect(l).toMatchObject({ items: [], total: 0 })
  })

  it('RG-REC-121 une taille de page au-delà de 100 est refusée (400)', async () => {
    const s = await site(ctx)
    expect((await get(ctx, '/api/affiches?pageSize=500', s.headers)).statusCode).toBe(400)
  })

  it.each([['depart=S43'], ['tag=PERDUE'], ['dossier=abc']])(
    'RG-REC-122 un filtre invalide (%s) est refusé (400)',
    async (q) => {
      const s = await site(ctx)
      expect((await get(ctx, `/api/affiches?${q}`, s.headers)).statusCode).toBe(400)
    },
  )
})

describe('RG-REC-145 « Affiche à conserver »', () => {
  it.each([['com'], ['expe']] as const)(
    'RG-REC-145 le profil %s ne coche pas « à conserver » (403), rien n’est écrit',
    async (role) => {
      const s = await site(ctx)
      const a = await f.createAffiche(db, { plateformeId: s.plateforme.id })
      const intrus = await autre(ctx, s.plateforme.id, [role])
      const r = await ctx.app.inject({
        method: 'PATCH',
        url: `/api/affiches/${String(a.id)}`,
        headers: intrus.headers,
        payload: { version: a.version, aConserver: true },
      })
      expect(r.statusCode).toBe(403)
      expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).aConserver).toBe(false)
    },
  )

  it('RG-REC-145 le profil cheq coche « à conserver »', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    const cheq = await autre(ctx, s.plateforme.id, ['cheq'])
    const r = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/affiches/${String(a.id)}`,
      headers: cheq.headers,
      payload: { version: a.version, aConserver: true },
    })
    expect(r.statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).aConserver).toBe(true)
  })
})

// 3e passe d'audit : paires complétées (RG-REC-038, 041, 061, 065, 103) et cas contraires (083, 186).
describe('3e passe : paires nominal / rejet', () => {
  const valider = async (
    s: Awaited<ReturnType<typeof site>>,
    receptionId: number,
    surcharge: Record<string, unknown> = {},
  ) => {
    const c = await controle(receptionId, s.headers)
    return post(ctx, `/api/receptions/${String(receptionId)}/controle`, s.headers, {
      version: c.version,
      controleurId: s.user.id,
      lignes: c.lignes.map((l) => ({
        afficheId: l.afficheId,
        qteComptee: l.quantiteBl,
        allee: 'C',
        rayon: '5',
        ...surcharge,
      })),
    })
  }

  it('RG-REC-065 une non-conformité de la liste est acceptée et historisée (sans mouvement)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    expect(
      (await valider(s, rv.receptionId, { nonConformite: 'BANDEAU_MANQUANT' })).statusCode,
    ).toBe(200)
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: String(rv.afficheId), action: 'NON_CONFORMITE' },
    })
    expect(j.nouvelleValeur).toBe('BANDEAU_MANQUANT')
    expect(
      await db.mouvement.count({ where: { afficheId: rv.afficheId, type: 'MISE_AU_REBUT' } }),
    ).toBe(0)
  })

  it('RG-REC-061 allée et rayon saisis : contrôle accepté, emplacement posé', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    expect((await valider(s, rv.receptionId)).statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      allee: 'C',
      rayon: '5',
    })
  })

  it('RG-REC-041 une ligne à quantité 0 ne crée ni affiche ni mouvement', async () => {
    const s = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 2 },
      { ligneAttendueId: l2.id, quantite: 0 },
    ])
    expect((await post(ctx, '/api/receptions', s.headers, bl)).statusCode).toBe(201)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l2.id } })).toBe(0)
    expect(
      await db.mouvement.count({
        where: { affiche: { rattachements: { some: { ligneAttendueId: l2.id } } } },
      }),
    ).toBe(0)
  })

  it('RG-REC-038 une validation refusée ne crée aucune réception ni livraison', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    const avant = await db.reception.count({ where: { plateformeId: s.plateforme.id } })
    expect(
      (await post(ctx, '/api/receptions', s.headers, { ...bl, imprimeurId: null })).statusCode,
    ).toBe(422)
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(avant)
    expect(await db.livraison.count({ where: { reference: bl.numeroBl } })).toBe(0)
  })

  const inconnue = async (s: Awaited<ReturnType<typeof site>>) =>
    InconnueCreeeSchema.parse(
      (
        await post(ctx, '/api/receptions-inconnues', s.headers, {
          plateformeId: s.plateforme.id,
          supportId: s.support.id,
          quantite: 3,
          allee: 'X',
          rayon: '1',
          sansBl: true,
        })
      ).json(),
    )

  it('RG-REC-103 moins de 24 h d’attente : pas en retard', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const item = InconnuesSchema.parse(
      (await get(ctx, '/api/receptions-inconnues', s.headers)).json(),
    ).items.find((i) => i.afficheId === c.afficheId)
    expect(item?.enRetard).toBe(false)
    expect(item?.enAttenteMinutes).not.toBeNull()
  })

  it('RG-REC-103 une fois rattachée, « En attente depuis » est vide (—) et non en retard', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    await db.reception.update({
      where: { id: c.receptionId },
      data: { dateArrivee: new Date(Date.now() - 30 * 3_600_000) },
    })
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await post(ctx, `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 3 }],
    })
    const item = InconnuesSchema.parse(
      (await get(ctx, '/api/receptions-inconnues', s.headers)).json(),
    ).items.find((i) => i.afficheId === c.afficheId)
    expect(item).toMatchObject({ enAttenteMinutes: null, enRetard: false })
  })

  it('RG-REC-083 une affiche avec dossier n’a pas de feuille temporaire', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 2)
    const { feuilles } = FeuillesSchema.parse(
      (await get(ctx, `/api/feuilles?ids=${String(rv.afficheId)}`, s.headers)).json(),
    )
    expect(feuilles[0]?.type).not.toBe('TEMPORAIRE')
  })

  it('RG-REC-186 / RG-COO-072 rejet : une réception inconnue non signalée ne lève pas « Dossier introuvable »', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const { alertes } = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    )
    expect(alertes.map((x) => x.cle)).not.toContain(`RG-REC-186:${String(c.receptionId)}`)
  })
})
