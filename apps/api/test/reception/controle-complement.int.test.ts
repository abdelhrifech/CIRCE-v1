// REC-P05 / REC-P06 — sas, contrôle de la palette, impressions : tests COMPLÉMENTAIRES écrits depuis
// RECEPTION_REGLES_METIER.md (RG-REC-053 à 093 ; §2 matrice ; §3.2 transitions RECEPTION, FEUILLE,
// RECEPTION_INCONNUE). Ne duplique pas controle.int.test.ts ni impressions.int.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ControleSchema, InconnueCreeeSchema, InconnuesSchema, SasSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  idem,
  ligne,
  photo,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

type Site = Awaited<ReturnType<typeof site>>

async function avecPanne<T>(nom: string, table: string, condition: string, run: () => Promise<T>) {
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} BEFORE INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`,
  )
  try {
    return await run()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

async function palette(qte = 10, roles: Parameters<typeof site>[1] = ['recep']) {
  const s = await site(ctx, roles)
  const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, qte)
  return { ...s, ...rv }
}

const lireControle = async (receptionId: number, headers: Record<string, string>) =>
  ControleSchema.parse(
    (await get(ctx, `/api/receptions/${String(receptionId)}/controle`, headers)).json(),
  )

function saisie(
  c: { version: number; lignes: { afficheId: number; quantiteBl: number }[] },
  controleurId: number | null,
  surcharge: Record<string, unknown> = {},
) {
  return {
    version: c.version,
    controleurId,
    lignes: c.lignes.map((l) => ({
      afficheId: l.afficheId,
      qteComptee: l.quantiteBl,
      allee: 'B',
      rayon: '7',
      ...surcharge,
    })),
  }
}

const controler = (receptionId: number, headers: Record<string, string>, corps: unknown) =>
  post(ctx, `/api/receptions/${String(receptionId)}/controle`, headers, corps)

/** Réception inconnue créée puis rattachée (RG-REC-109) : palette A_CONTROLER, affiche IDENTIFIEE. */
async function inconnueRattachee(s: Site, qte = 6) {
  const r = await post(ctx, '/api/receptions-inconnues', s.headers, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    annonceur: 'Lu',
    theme: 'Desc',
    imprimeurId: null,
    quantite: qte,
    allee: 'X',
    rayon: '1',
    photoAfficheId: null,
    photoBlId: await photo(ctx, s.headers),
    sansBl: false,
    numeroBl: `BL-INC-${String(Date.now())}`,
  })
  if (r.statusCode !== 201) throw new Error(r.body)
  const c = InconnueCreeeSchema.parse(r.json())
  const l = await ligne(ctx, s.plateforme.id)
  const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
  const rr = await post(ctx, `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`, s.headers, {
    version: a.version,
    lignes: [{ ligneAttendueId: l.id, quantite: qte }],
  })
  if (rr.statusCode !== 200) throw new Error(rr.body)
  return c
}

const statutInconnue = async (s: Site, afficheId: number) =>
  InconnuesSchema.parse(
    (
      await get(
        ctx,
        '/api/receptions-inconnues?statut=A_IDENTIFIER&statut=INTROUVABLE&statut=RATTACHEE_A_CONTROLER&statut=CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER&statut=RATTACHEE_FEUILLE_DEFINITIVE',
        s.headers,
      )
    ).json(),
  ).items.find((i) => i.afficheId === afficheId)?.statut

describe('REC-P05 Sas (RG-REC-053 / 054)', () => {
  it('RG-REC-053 une palette CONTROLEE sort du sas', async () => {
    const p = await palette()
    const c = await lireControle(p.receptionId, p.headers)
    expect((await controler(p.receptionId, p.headers, saisie(c, p.user.id))).statusCode).toBe(200)
    const sas = SasSchema.parse((await get(ctx, '/api/receptions/sas', p.headers)).json())
    expect(sas.palettes.map((x) => x.receptionId)).not.toContain(p.receptionId)
  })

  it('RG-REC-053 / RG-REC-001 le sas ne montre pas les palettes d’un autre site', async () => {
    const p = await palette()
    const intrus = await site(ctx)
    const sas = SasSchema.parse((await get(ctx, '/api/receptions/sas', intrus.headers)).json())
    expect(sas.palettes.map((x) => x.receptionId)).not.toContain(p.receptionId)
  })

  it('RG-REC-054 le nombre de palettes en retard est recalculé (pas de comptage en dur)', async () => {
    const s = await site(ctx)
    await f.createReception(db, {
      plateformeId: s.plateforme.id,
      aControlerDepuis: new Date(Date.now() - 30 * 3_600_000),
    })
    await f.createReception(db, { plateformeId: s.plateforme.id, aControlerDepuis: new Date() })
    const sas = SasSchema.parse((await get(ctx, '/api/receptions/sas', s.headers)).json())
    expect(sas.palettes).toHaveLength(2)
    expect(sas.nombreEnRetard).toBe(1)
  })

  it.each([['coord'], ['cheq'], ['recep'], ['com']] as const)(
    'RG-REC-002 le profil %s consulte le sas',
    async (role) => {
      const s = await site(ctx, [role])
      expect((await get(ctx, '/api/receptions/sas', s.headers)).statusCode).toBe(200)
    },
  )

  it.each([['expe']] as const)(
    'RG-REC-002 le profil %s ne consulte pas le sas (403)',
    async (role) => {
      const s = await site(ctx, [role])
      const r = await get(ctx, '/api/receptions/sas', s.headers)
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
    },
  )
})

describe('REC-P05 Valider le contrôle : valeurs et refus complémentaires', () => {
  it('RG-REC-057 valeur limite : une quantité comptée de 0 est acceptée', async () => {
    const p = await palette(4)
    const c = await lireControle(p.receptionId, p.headers)
    const r = await controler(p.receptionId, p.headers, saisie(c, p.user.id, { qteComptee: 0 }))
    expect(r.statusCode).toBe(200)
    expect(
      (
        await db.mouvement.findFirstOrThrow({
          where: { afficheId: p.afficheId, type: 'ECART_CONTROLE' },
        })
      ).quantite,
    ).toBe(-4)
  })

  it('RG-REC-058 un écart de comptage au-delà de 10 % ne bloque pas la validation', async () => {
    const p = await palette(10)
    const c = await lireControle(p.receptionId, p.headers)
    expect(c.ecartReceptionPourcent).toBe(10)
    const r = await controler(p.receptionId, p.headers, saisie(c, p.user.id, { qteComptee: 5 }))
    expect(r.statusCode).toBe(200)
  })

  it('RG-REC-059 comptée = BL : aucun mouvement d’écart', async () => {
    const p = await palette(6)
    const c = await lireControle(p.receptionId, p.headers)
    expect((await controler(p.receptionId, p.headers, saisie(c, p.user.id))).statusCode).toBe(200)
    expect(
      await db.mouvement.count({ where: { afficheId: p.afficheId, type: 'ECART_CONTROLE' } }),
    ).toBe(0)
  })

  it('RG-REC-059 comptée > BL : mouvement d’écart positif et reçu de la ligne recalculé', async () => {
    const p = await palette(10)
    const c = await lireControle(p.receptionId, p.headers)
    expect(
      (await controler(p.receptionId, p.headers, saisie(c, p.user.id, { qteComptee: 13 })))
        .statusCode,
    ).toBe(200)
    expect(
      (
        await db.mouvement.findFirstOrThrow({
          where: { afficheId: p.afficheId, type: 'ECART_CONTROLE' },
        })
      ).quantite,
    ).toBe(3)
    // 13 reçus pour 10 attendus : au-delà de 10 % → Surplus (RG-REC-018 / 051).
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: p.ligne.id } })).statut,
    ).toBe('SURPLUS')
  })

  it('RG-REC-060 le seuil de comptage par morceau (30) est fourni à l’écran', async () => {
    const p = await palette(4)
    expect((await lireControle(p.receptionId, p.headers)).comptageMorceauSeuil).toBe(30)
  })

  it.each([
    ['allée vide', { allee: '' }],
    ['allée blanche', { allee: '   ' }],
    ['rayon blanc', { rayon: '  ' }],
  ] as const)('RG-REC-061 refuse %s (422), rien n’est écrit', async (_cas, surcharge) => {
    const p = await palette()
    const c = await lireControle(p.receptionId, p.headers)
    const r = await controler(p.receptionId, p.headers, saisie(c, p.user.id, surcharge))
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_ALLEE_RAYON_OBLIGATOIRES', regle: 'RG-REC-061' })
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
  })

  it('RG-REC-063 un autre agent de réception du site peut être le contrôleur', async () => {
    const p = await palette()
    const agent = await autre(ctx, p.plateforme.id, ['recep'])
    const c = await lireControle(p.receptionId, p.headers)
    expect((await controler(p.receptionId, p.headers, saisie(c, agent.user.id))).statusCode).toBe(
      200,
    )
    expect(
      (await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).controleurId,
    ).toBe(agent.user.id)
  })

  it('RG-REC-063 refuse comme contrôleur un utilisateur du site qui n’est pas agent de réception (422)', async () => {
    const p = await palette()
    const chef = await autre(ctx, p.plateforme.id, ['cheq'])
    const c = await lireControle(p.receptionId, p.headers)
    const r = await controler(p.receptionId, p.headers, saisie(c, chef.user.id))
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-REC-063')
  })

  it('RG-REC-064 valeur limite : rebut = disponible est accepté (stock 0)', async () => {
    const p = await palette(5)
    const c = await lireControle(p.receptionId, p.headers)
    expect(
      (await controler(p.receptionId, p.headers, saisie(c, p.user.id, { rebut: 5 }))).statusCode,
    ).toBe(200)
    const mvts = await db.mouvement.findMany({ where: { afficheId: p.afficheId } })
    expect(mvts.reduce((s, m) => s + m.quantite, 0)).toBe(0)
  })

  it('RG-REC-064 le disponible tient compte de l’écart compté : comptée 3, rebut 4 → 422', async () => {
    const p = await palette(5)
    const c = await lireControle(p.receptionId, p.headers)
    const r = await controler(
      p.receptionId,
      p.headers,
      saisie(c, p.user.id, { qteComptee: 3, rebut: 4 }),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_REBUT_SUPERIEUR_STOCK', regle: 'RG-REC-064' })
    expect(await db.mouvement.count({ where: { afficheId: p.afficheId } })).toBe(1)
  })

  it('RG-REC-065 une non-conformité hors liste est refusée (400)', async () => {
    const p = await palette()
    const c = await lireControle(p.receptionId, p.headers)
    const r = await controler(
      p.receptionId,
      p.headers,
      saisie(c, p.user.id, { nonConformite: 'INVENTEE' }),
    )
    expect(r.statusCode).toBe(400)
  })

  it('RG-REC-068 l’imprimeur d’une réception inconnue rattachée se corrige au contrôle', async () => {
    const s = await site(ctx)
    const inc = await inconnueRattachee(s)
    const imp = await f.createImprimeur(db)
    const c = await lireControle(inc.receptionId, s.headers)
    const r = await controler(inc.receptionId, s.headers, {
      ...saisie(c, s.user.id),
      imprimeurId: imp.id,
    })
    expect(r.statusCode).toBe(200)
    // Le doc ne dit pas où l'imprimeur corrigé est porté : on vérifie l'affiche contrôlée.
    expect((await db.affiche.findUniqueOrThrow({ where: { id: inc.afficheId } })).imprimeurId).toBe(
      imp.id,
    )
  })

  it('RG-REC-068 / RG-REC-035 un imprimeur désactivé est refusé au contrôle d’une inconnue (422)', async () => {
    const s = await site(ctx)
    const inc = await inconnueRattachee(s)
    const imp = await f.createImprimeur(db, { actif: false })
    const c = await lireControle(inc.receptionId, s.headers)
    const r = await controler(inc.receptionId, s.headers, {
      ...saisie(c, s.user.id),
      imprimeurId: imp.id,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_REFERENTIEL_INCONNU')
    expect((await db.reception.findUniqueOrThrow({ where: { id: inc.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
  })

  it('RG-REC-069 après contrôle, le tag « À contrôler » de l’affiche est levé', async () => {
    const p = await palette()
    const avant = (await get(ctx, `/api/affiches/${String(p.afficheId)}`, p.headers)).json<{
      tags: string[]
    }>()
    expect(avant.tags).toContain('A_CONTROLER')
    const c = await lireControle(p.receptionId, p.headers)
    await controler(p.receptionId, p.headers, saisie(c, p.user.id))
    const apres = (await get(ctx, `/api/affiches/${String(p.afficheId)}`, p.headers)).json<{
      tags: string[]
    }>()
    expect(apres.tags).not.toContain('A_CONTROLER')
  })
})

describe('REC-P05 machine d’états RECEPTION_INCONNUE au contrôle (§3.2, RG-REC-072 / 084)', () => {
  it('RG-REC-072 RATTACHEE_A_CONTROLER → (contrôle sans impression) CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER → (impression) RATTACHEE_FEUILLE_DEFINITIVE', async () => {
    const s = await site(ctx)
    const inc = await inconnueRattachee(s)
    expect(await statutInconnue(s, inc.afficheId)).toBe('RATTACHEE_A_CONTROLER')
    const c = await lireControle(inc.receptionId, s.headers)
    expect((await controler(inc.receptionId, s.headers, saisie(c, s.user.id))).statusCode).toBe(200)
    expect(await statutInconnue(s, inc.afficheId)).toBe('CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER')
    const imp = await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [inc.afficheId],
      contenu: 'FEUILLE',
      exemplaires: 1,
    })
    expect(imp.statusCode).toBe(200)
    expect(await statutInconnue(s, inc.afficheId)).toBe('RATTACHEE_FEUILLE_DEFINITIVE')
    expect((await db.affiche.findUniqueOrThrow({ where: { id: inc.afficheId } })).typeFeuille).toBe(
      'DEFINITIVE',
    )
  })

  it('RG-REC-114 / Q-108 retirer le dernier dossier d’une palette CONTROLEE la renvoie À identifier', async () => {
    const p = await palette()
    const c = await lireControle(p.receptionId, p.headers)
    expect((await controler(p.receptionId, p.headers, saisie(c, p.user.id))).statusCode).toBe(200)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.afficheId, actif: true },
    })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, p.headers, {
      lienVersion: lien.version,
    })
    expect(r.statusCode).toBe(200)
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'A_IDENTIFIER',
    )
    expect((await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })).statut).toBe(
      'ORPHELINE',
    )
  })
})

describe('REC-P05 permissions, périmètre, concurrence, idempotence, atomicité du contrôle', () => {
  it.each([['expe'], ['com']] as const)(
    'RG-REC-002 le profil %s ne valide pas le contrôle (403), la palette reste À contrôler',
    async (role) => {
      const p = await palette()
      const intrus = await autre(ctx, p.plateforme.id, [role])
      const c = await lireControle(p.receptionId, p.headers)
      const r = await controler(p.receptionId, intrus.headers, saisie(c, p.user.id))
      expect(r.statusCode).toBe(403)
      expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
        'A_CONTROLER',
      )
    },
  )

  it('RG-REC-001 un agent de réception d’un autre site ne valide pas le contrôle (403)', async () => {
    const p = await palette()
    const intrus = await site(ctx)
    const c = await lireControle(p.receptionId, p.headers)
    const r = await controler(p.receptionId, intrus.headers, saisie(c, intrus.user.id))
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })

  it('RG-REC-009 deux contrôles avec la même version : un seul réussit, l’autre 409', async () => {
    const p = await palette()
    const agent = await autre(ctx, p.plateforme.id, ['recep'])
    const c = await lireControle(p.receptionId, p.headers)
    const [a, b] = await Promise.all([
      controler(p.receptionId, p.headers, saisie(c, p.user.id)),
      controler(p.receptionId, agent.headers, saisie(c, agent.user.id, { qteComptee: 2 })),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'RECEPTION', entiteId: String(p.receptionId), nouveau: 'CONTROLEE' },
      }),
    ).toBe(1)
  })

  it('RG-REC-008 rejeu du contrôle avec la même clé : même réponse, un seul passage à CONTROLEE', async () => {
    const p = await palette(10)
    const c = await lireControle(p.receptionId, p.headers)
    const h = { ...p.headers, ...idem() }
    const corps = saisie(c, p.user.id, { qteComptee: 8 })
    const url = `/api/receptions/${String(p.receptionId)}/controle`
    const a = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    const b = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
    expect(b.json()).toEqual(a.json())
    expect(
      await db.mouvement.count({ where: { afficheId: p.afficheId, type: 'ECART_CONTROLE' } }),
    ).toBe(1)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'RECEPTION', entiteId: String(p.receptionId), nouveau: 'CONTROLEE' },
      }),
    ).toBe(1)
  })

  it('RG-REC-008 même clé, corps différent : 409 REC_IDEMPOTENCE_CONFLIT', async () => {
    const p = await palette(10)
    const c = await lireControle(p.receptionId, p.headers)
    const h = { ...p.headers, ...idem() }
    const url = `/api/receptions/${String(p.receptionId)}/controle`
    await ctx.app.inject({ method: 'POST', url, headers: h, payload: saisie(c, p.user.id) })
    const b = await ctx.app.inject({
      method: 'POST',
      url,
      headers: h,
      payload: saisie(c, p.user.id, { qteComptee: 9 }),
    })
    expect(b.statusCode).toBe(409)
    expect(erreur(b)).toMatchObject({ code: 'REC_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' })
  })

  it('RG-REC-069 atomicité : une panne sur la 2e affiche de la palette n’écrit rien (statut, emplacement, mouvements)', async () => {
    const s = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 10 },
      { ligneAttendueId: l2.id, quantite: 10 },
    ])
    const rec = (await post(ctx, '/api/receptions', s.headers, bl)).json<{
      receptionId: number
      affiches: { id: number }[]
    }>()
    const c = await lireControle(rec.receptionId, s.headers)
    const corps = {
      version: c.version,
      controleurId: s.user.id,
      lignes: c.lignes.map((l, i) => ({
        afficheId: l.afficheId,
        qteComptee: i === 0 ? 9 : 10 + 777,
        allee: 'C',
        rayon: '2',
      })),
    }
    const r = await avecPanne(
      'panne_controle',
      'mouvement',
      "NEW.quantite = 777 AND NEW.type = 'ECART_CONTROLE'",
      () => controler(rec.receptionId, s.headers, corps),
    )
    expect(r.statusCode).toBe(500)
    expect((await db.reception.findUniqueOrThrow({ where: { id: rec.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
    for (const a of rec.affiches) {
      expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
        allee: null,
        rayon: null,
      })
      expect(await db.mouvement.count({ where: { afficheId: a.id, type: 'ECART_CONTROLE' } })).toBe(
        0,
      )
    }
  })
})

describe('REC-P06 Impressions et rangement : compléments', () => {
  it.each([[1], [5]])('RG-REC-086 valeur limite : %i exemplaire(s) accepté(s)', async (n) => {
    const p = await palette(3)
    const r = await post(ctx, '/api/impressions', p.headers, {
      afficheIds: [p.afficheId],
      contenu: 'FEUILLE',
      exemplaires: n,
    })
    expect(r.statusCode).toBe(200)
  })

  it('RG-REC-084 étiquette rack seule sur une affiche orpheline : 409 REC_FEUILLE_DEFINITIVE_IMPOSSIBLE', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      statut: 'ORPHELINE',
      typeFeuille: 'TEMPORAIRE',
    })
    const r = await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [a.id],
      contenu: 'ETIQUETTE_RACK',
      exemplaires: 1,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      code: 'REC_FEUILLE_DEFINITIVE_IMPOSSIBLE',
      regle: 'RG-REC-084',
    })
  })

  it('RG-REC-084 / RG-REC-090 lot mixte (une affiche avec dossier + une orpheline) : 409 et rien n’est écrit pour la première', async () => {
    const p = await palette(3)
    await db.affiche.update({ where: { id: p.afficheId }, data: { feuilleARefaire: true } })
    const orph = await f.createAffiche(db, {
      plateformeId: p.plateforme.id,
      statut: 'ORPHELINE',
      typeFeuille: 'TEMPORAIRE',
    })
    const r = await post(ctx, '/api/impressions', p.headers, {
      afficheIds: [p.afficheId, orph.id],
      contenu: 'FEUILLE_ET_ETIQUETTE',
      exemplaires: 1,
    })
    expect(r.statusCode).toBe(409)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })).toMatchObject({
      feuilleARefaire: true,
      typeFeuille: null,
    })
    expect(
      await db.journalAudit.count({
        where: {
          entiteId: String(p.afficheId),
          action: { in: ['IMPRESSION_FEUILLE', 'IMPRESSION_ETIQUETTE_RACK'] },
        },
      }),
    ).toBe(0)
  })

  it('RG-REC-001 imprimer une affiche hors périmètre : 403, rien n’est journalisé', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db)
    const r = await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [a.id],
      contenu: 'FEUILLE',
      exemplaires: 1,
    })
    expect(r.statusCode).toBe(403)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(a.id), action: 'IMPRESSION_FEUILLE' },
      }),
    ).toBe(0)
  })

  it.each([['coord'], ['recep']] as const)('RG-REC-002 le profil %s imprime', async (role) => {
    const p = await palette(3)
    const u = await autre(ctx, p.plateforme.id, [role])
    const r = await post(ctx, '/api/impressions', u.headers, {
      afficheIds: [p.afficheId],
      contenu: 'FEUILLE',
      exemplaires: 1,
    })
    expect(r.statusCode).toBe(200)
  })

  it('RG-REC-002 le profil com n’imprime pas (403)', async () => {
    const p = await palette(3)
    const u = await autre(ctx, p.plateforme.id, ['com'])
    const r = await post(ctx, '/api/impressions', u.headers, {
      afficheIds: [p.afficheId],
      contenu: 'FEUILLE',
      exemplaires: 1,
    })
    expect(r.statusCode).toBe(403)
  })

  it('RG-REC-008 rejeu d’une impression avec la même clé : une seule écriture au journal', async () => {
    const p = await palette(3)
    const h = { ...p.headers, ...idem() }
    const corps = { afficheIds: [p.afficheId], contenu: 'FEUILLE', exemplaires: 1 }
    const a = await ctx.app.inject({
      method: 'POST',
      url: '/api/impressions',
      headers: h,
      payload: corps,
    })
    const b = await ctx.app.inject({
      method: 'POST',
      url: '/api/impressions',
      headers: h,
      payload: corps,
    })
    expect(b.json()).toEqual(a.json())
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(p.afficheId), action: 'IMPRESSION_FEUILLE' },
      }),
    ).toBe(1)
  })

  it('RG-REC-087 la réimpression lève « Feuille à refaire » (FEUILLE.DEFINITIVE → DEFINITIVE)', async () => {
    const p = await palette(3)
    const corps = { afficheIds: [p.afficheId], contenu: 'FEUILLE', exemplaires: 1 }
    await post(ctx, '/api/impressions', p.headers, corps)
    await db.affiche.update({ where: { id: p.afficheId }, data: { feuilleARefaire: true } })
    expect((await post(ctx, '/api/impressions', p.headers, corps)).statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })).toMatchObject({
      typeFeuille: 'DEFINITIVE',
      feuilleARefaire: false,
    })
  })

  it('RG-REC-088 refuse un rayon sans allée (422)', async () => {
    const p = await palette(3)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })
    const r = await post(ctx, '/api/affiches/rangement', p.headers, {
      affiches: [{ id: a.id, version: a.version, allee: '', rayon: '4' }],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-REC-088')
  })

  it('RG-REC-088 / RG-REC-009 rangement en lot : une version périmée sur la 2e affiche n’écrit rien sur la 1re', async () => {
    const s = await site(ctx)
    const r1 = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    const r2 = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    const [a1, a2] = await Promise.all([
      db.affiche.findUniqueOrThrow({ where: { id: r1.afficheId } }),
      db.affiche.findUniqueOrThrow({ where: { id: r2.afficheId } }),
    ])
    const r = await post(ctx, '/api/affiches/rangement', s.headers, {
      affiches: [
        { id: a1.id, version: a1.version, allee: 'D', rayon: '1' },
        { id: a2.id, version: a2.version - 1, allee: 'D', rayon: '2' },
      ],
    })
    expect(r.statusCode).toBe(409)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a1.id } })).allee).toBeNull()
  })

  it.each([['com'], ['expe']] as const)(
    'RG-REC-002 le profil %s ne range pas (403)',
    async (role) => {
      const p = await palette(3)
      const u = await autre(ctx, p.plateforme.id, [role])
      const a = await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })
      const r = await post(ctx, '/api/affiches/rangement', u.headers, {
        affiches: [{ id: a.id, version: a.version, allee: 'D', rayon: '1' }],
      })
      expect(r.statusCode).toBe(403)
    },
  )

  it('RG-REC-001 ranger une affiche hors périmètre : 403', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db)
    const r = await post(ctx, '/api/affiches/rangement', s.headers, {
      affiches: [{ id: a.id, version: a.version, allee: 'D', rayon: '1' }],
    })
    expect(r.statusCode).toBe(403)
  })

  it('RG-REC-093 / RG-REC-001 édition picking d’une plateforme hors périmètre : 403', async () => {
    const s = await site(ctx)
    const ailleurs = await f.createPlateforme(db)
    const r = await get(
      ctx,
      `/api/edition-picking?plateformeId=${String(ailleurs.id)}&du=2026-01-01&au=2026-12-31`,
      s.headers,
    )
    expect(r.statusCode).toBe(403)
  })
})
