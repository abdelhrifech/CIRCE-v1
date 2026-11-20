import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { StocksSchema, FinCampagneSchema, ResultatStocksSchema, semaineIsoDe } from '@circe/shared'
import { contexteReception, site, autre, get, post } from '../support/reception.ts'
import * as f from '../factories/index.ts'
const ctx = contexteReception()
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
let sequence = 9100000
async function dossier(format = '2 m² fixe') {
  const s = await site(ctx),
    support = await f.createSupport(ctx.db, { nom: format }),
    atelier = await f.createAtelier(ctx.db, { plateformeId: s.plateforme.id }),
    num = ++sequence
  const affiche = await f.createAffiche(ctx.db, {
    plateformeId: s.plateforme.id,
    supportId: support.id,
    contNum: num,
    quantite: 100,
    theme: 'Visuel stock',
    contAnnonc: 'Annonceur stock',
  })
  await f.createMouvement(ctx.db, { afficheId: affiche.id, quantite: 100 })
  const l = await f.createReceptionAttendue(ctx.db, {
    plateformeId: s.plateforme.id,
    supportId: support.id,
    atelierId: atelier.id,
    contNum: num,
    theme: 'Visuel stock',
    semAnnee: 2024,
    semNum: 2,
  })
  await f.createRattachement(ctx.db, {
    afficheId: affiche.id,
    ligneAttendueId: l.id,
    quantite: 100,
  })
  return { ...s, support, atelier, affiche, ligne: l, num }
}
async function lire(headers: Record<string, string>, num: number) {
  const response = await get(ctx, `/api/stocks/fin-campagne?dossier=${num}`, headers)
  expect(response.statusCode, response.body).toBe(200)
  return FinCampagneSchema.parse(response.json()).items[0]
}
const cible = (r: NonNullable<Awaited<ReturnType<typeof lire>>>) => ({
  plateformeId: r.plateformeId,
  dossier: r.dossier,
  version: r.version,
  empreinte: r.empreinte,
})
describe('RG-STK-NEW-002 fin de campagne indépendante', () => {
  it('EX-STK-NEW-001 calcule stock depuis mouvements et isole les sites sans écrire', async () => {
    const d = await dossier(),
      ailleurs = await site(ctx)
    await f.createMouvement(ctx.db, {
      afficheId: d.affiche.id,
      type: 'MISE_AU_REBUT',
      quantite: -7,
    })
    const avant = await ctx.db.journalAudit.count()
    const r = await get(ctx, `/api/stocks?dossier=${d.num}`, d.headers)
    const stock = StocksSchema.parse(r.json())
    expect(stock.items[0]?.disponible).toBe(93)
    expect(stock.items[0]?.rebut).toBe(7)
    expect(
      StocksSchema.parse((await get(ctx, `/api/stocks?dossier=${d.num}`, ailleurs.headers)).json())
        .items,
    ).toHaveLength(0)
    expect(await ctx.db.journalAudit.count()).toBe(avant)
  })
  it('RG-STK-NEW-002 Coordination consulte sans agir, admin peut agir, et version périmée refusée', async () => {
    const d = await dossier(),
      coord = await autre(ctx, d.plateforme.id, ['coord']),
      admin = await autre(ctx, d.plateforme.id, ['admin'])
    const r = await lire(coord.headers, d.num)
    expect(r).toBeDefined()
    if (!r) return
    const body = { ...cible(r), decision: 'DETRUIRE' }
    expect(
      (await post(ctx, '/api/stocks/fin-campagne/decision', coord.headers, body)).statusCode,
    ).toBe(403)
    expect(
      (await post(ctx, '/api/stocks/fin-campagne/decision', admin.headers, body)).statusCode,
    ).toBe(200)
    expect(
      (await post(ctx, '/api/stocks/fin-campagne/decision', admin.headers, body)).statusCode,
    ).toBe(409)
    expect(await ctx.db.mouvement.count({ where: { afficheId: d.affiche.id } })).toBe(1)
  })
  it('RG-STK-NEW-001 Expédition consulte Stocks et fait le rebut sans gagner les accès Réception', async () => {
    const d = await dossier(),
      expe = await autre(ctx, d.plateforme.id, ['expe'])
    expect((await get(ctx, `/api/stocks?dossier=${d.num}`, expe.headers)).statusCode).toBe(200)
    expect(
      (await get(ctx, `/api/stocks/mouvements?dossier=${d.num}`, expe.headers)).statusCode,
    ).toBe(200)
    expect((await get(ctx, '/api/affiches', expe.headers)).statusCode).toBe(403)
    expect((await get(ctx, '/api/stocks/fin-campagne', expe.headers)).statusCode).toBe(403)
    expect(
      (
        await post(ctx, '/api/stocks/rebut', expe.headers, {
          affiches: [{ id: d.affiche.id, version: d.affiche.version }],
          quantite: 2,
          motif: 'AUTRE',
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await post(ctx, '/api/stocks/conserver', expe.headers, {
          affiches: [{ id: d.affiche.id, version: d.affiche.version + 1 }],
        })
      ).statusCode,
    ).toBe(403)
  })
  it('RG-STK-NEW-002 renvoi partiel puis destruction : mouvements signés et audit, confirmation obligatoire', async () => {
    const d = await dossier()
    let r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
          ...cible(r),
          decision: 'ENVOYER',
          destinataire: 'Agence',
          quantiteRetour: 30,
        })
      ).statusCode,
    ).toBe(200)
    r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/executer', d.headers, {
          cibles: [cible(r)],
          action: 'RENVOI',
        })
      ).statusCode,
    ).toBe(200)
    r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(r.stock).toBe(70)
    expect(r.decision).toBe('DETRUIRE')
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/executer', d.headers, {
          cibles: [cible(r)],
          action: 'DESTRUCTION',
        })
      ).statusCode,
    ).toBe(422)
    const body = { cibles: [cible(r)], action: 'DESTRUCTION', confirmation: true }
    const out = await post(ctx, '/api/stocks/fin-campagne/executer', d.headers, body)
    expect(out.statusCode).toBe(200)
    expect(ResultatStocksSchema.parse(out.json()).quantite).toBe(70)
    expect((await post(ctx, '/api/stocks/fin-campagne/executer', d.headers, body)).statusCode).toBe(
      409,
    )
    expect((await lire(d.headers, d.num))?.decision).toBe('DETRUIT')
    expect(
      await ctx.db.journalAudit.count({
        where: { typeEntite: 'FIN_CAMPAGNE', entiteId: `${d.plateforme.id}-${d.num}` },
      }),
    ).toBe(3)
    expect(
      (
        await ctx.db.mouvement.findMany({
          where: { afficheId: d.affiche.id, type: { in: ['RENVOI', 'DESTRUCTION'] } },
        })
      ).map((m) => m.quantite),
    ).toEqual([-30, -70])
  })
  it('RG-STK-NEW-002 une allocation vers une autre campagne future bloque la sortie et invalide une ancienne empreinte', async () => {
    const d = await dossier()
    const ancien = await lire(d.headers, d.num)
    if (!ancien) throw new Error('Dossier absent')
    const s = semaineIsoDe(new Date()),
      l = await f.createReceptionAttendue(ctx.db, {
        plateformeId: d.plateforme.id,
        supportId: d.support.id,
        contNum: ++sequence,
        semAnnee: s.annee + 1,
        semNum: 5,
      })
    await f.createRattachement(ctx.db, {
      afficheId: d.affiche.id,
      ligneAttendueId: l.id,
      quantite: 1,
    })
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
          ...cible(ancien),
          decision: 'DETRUIRE',
        })
      ).statusCode,
    ).toBe(409)
    const r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(r.gardes.length).toBeGreaterThan(0)
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
          ...cible(r),
          decision: 'DETRUIRE',
        })
      ).statusCode,
    ).toBe(422)
    expect((await ctx.db.affiche.findUniqueOrThrow({ where: { id: d.affiche.id } })).quantite).toBe(
      100,
    )
  })
  it('RG-STK-NEW-002 une campagne future du même dossier empêche une fin de campagne prématurée', async () => {
    const d = await dossier()
    const s = semaineIsoDe(new Date())
    await f.createReceptionAttendue(ctx.db, {
      plateformeId: d.plateforme.id,
      supportId: d.support.id,
      contNum: d.num,
      semAnnee: s.annee + 1,
      semNum: 1,
    })
    expect(await lire(d.headers, d.num)).toBeUndefined()
  })
  it('RG-STK-NEW-002 les points MUI imposent une opération individuelle et le lot est atomique', async () => {
    const d = await dossier('Scrolling MUI'),
      autreD = await dossier(),
      admin = await autre(ctx, d.plateforme.id, ['admin'])
    const r = await lire(admin.headers, d.num),
      r2 = await lire(admin.headers, autreD.num)
    if (!r || !r2) throw new Error('Dossier absent')
    expect(r.attention).toContain('MUI')
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/executer', admin.headers, {
          cibles: [cible(r2), cible(r)],
          action: 'PROPOSER_DESTRUCTION',
        })
      ).statusCode,
    ).toBe(422)
    expect(
      await ctx.db.finCampagne.count({ where: { dossier: { in: [d.num, autreD.num] } } }),
    ).toBe(0)
  })
  it('RG-STK-NEW-002 une affiche partagée appartient au premier rattachement et ne duplique pas le stock', async () => {
    const d = await dossier(),
      l = await f.createReceptionAttendue(ctx.db, {
        plateformeId: d.plateforme.id,
        supportId: d.support.id,
        contNum: ++sequence,
        semAnnee: 2024,
        semNum: 3,
      })
    await f.createRattachement(ctx.db, {
      afficheId: d.affiche.id,
      ligneAttendueId: l.id,
      quantite: 1,
    })
    const all = FinCampagneSchema.parse(
      (await get(ctx, '/api/stocks/fin-campagne', d.headers)).json(),
    ).items
    expect(all.filter((r) => r.affiches.some((a) => a.id === d.affiche.id))).toHaveLength(1)
    expect(await lire(d.headers, l.contNum ?? 0)).toBeUndefined()
  })
  it('RG-STK-NEW-002 le futur d’un dossier alloué bloque même si la ligne rattachée est passée', async () => {
    const d = await dossier(),
      autreNum = ++sequence,
      s = semaineIsoDe(new Date())
    const l = await f.createReceptionAttendue(ctx.db, {
      plateformeId: d.plateforme.id,
      supportId: d.support.id,
      contNum: autreNum,
      semAnnee: 2024,
      semNum: 3,
    })
    await f.createRattachement(ctx.db, {
      afficheId: d.affiche.id,
      ligneAttendueId: l.id,
      quantite: 1,
    })
    await f.createReceptionAttendue(ctx.db, {
      plateformeId: d.plateforme.id,
      supportId: d.support.id,
      contNum: autreNum,
      semAnnee: s.annee + 1,
      semNum: 3,
    })
    const r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(r.gardes.length).toBeGreaterThan(0)
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
          ...cible(r),
          decision: 'DETRUIRE',
        })
      ).statusCode,
    ).toBe(422)
  })
  it('RG-STK-NEW-002 refuse les semaines ISO impossibles et les conservations passées', async () => {
    const d = await dossier(),
      r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    for (const jusqua of ['zzz', '2027-W53', '2026-W54'])
      expect(
        (
          await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
            ...cible(r),
            decision: 'CONSERVER',
            jusqua,
            motif: 'Test',
          })
        ).statusCode,
      ).toBe(400)
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
          ...cible(r),
          decision: 'CONSERVER',
          jusqua: '2024-W01',
          motif: 'Test',
        })
      ).statusCode,
    ).toBe(422)
  })
  it('RG-STK-NEW-001 un rebut groupé refusé ne débite aucune première ligne et peut être repris sans double débit', async () => {
    const d = await dossier(),
      d2 = await dossier(),
      admin = await autre(ctx, d.plateforme.id, ['admin'])
    await f.createMouvement(ctx.db, {
      afficheId: d2.affiche.id,
      type: 'MISE_AU_REBUT',
      quantite: -99,
    })
    const a1 = await ctx.db.affiche.findUniqueOrThrow({ where: { id: d.affiche.id } }),
      a2 = await ctx.db.affiche.findUniqueOrThrow({ where: { id: d2.affiche.id } })
    const body = {
      affiches: [
        { id: a1.id, version: a1.version },
        { id: a2.id, version: a2.version },
      ],
      quantite: 10,
      motif: 'AUTRE',
    }
    expect((await post(ctx, '/api/stocks/rebut', admin.headers, body)).statusCode).toBe(422)
    expect(await ctx.db.mouvement.count({ where: { afficheId: a1.id } })).toBe(1)
    expect(
      (await post(ctx, '/api/stocks/rebut', admin.headers, { ...body, quantite: 1 })).statusCode,
    ).toBe(200)
    expect(
      (await ctx.db.mouvement.aggregate({ where: { afficheId: a1.id }, _sum: { quantite: true } }))
        ._sum.quantite,
    ).toBe(99)
  })
  it('RG-STK-NEW-002 Bordeaux sur une face de train invalide la fiche et interdit la proposition en lot même seul', async () => {
    const d = await dossier(),
      avant = await lire(d.headers, d.num)
    if (!avant) throw new Error('Dossier absent')
    const dest = await f.createDestinataire(ctx.db, {
      nomOrigine: 'BORDEAUX dépôt',
      nom: 'Dépôt régional',
    })
    await f.createFaceTrain(ctx.db, {
      atelierId: d.atelier.id,
      contNum: d.num,
      destinataireId: dest.id,
      theme: 'Visuel stock',
    })
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
          ...cible(avant),
          decision: 'DETRUIRE',
        })
      ).statusCode,
    ).toBe(409)
    const r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(r.attention.some((a) => a.startsWith('BDX'))).toBe(true)
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/executer', d.headers, {
          cibles: [cible(r)],
          action: 'PROPOSER_DESTRUCTION',
        })
      ).statusCode,
    ).toBe(422)
  })
  it('RG-STK-NEW-002 une ancienne ligne fermée ne masque pas la programmation future d’un dossier lié', async () => {
    const d = await dossier(),
      n = ++sequence,
      s = semaineIsoDe(new Date())
    const l = await f.createReceptionAttendue(ctx.db, {
      plateformeId: d.plateforme.id,
      supportId: d.support.id,
      contNum: n,
      etatLigne: 'ANNULEE',
      semAnnee: 2024,
      semNum: 4,
    })
    await f.createRattachement(ctx.db, {
      afficheId: d.affiche.id,
      ligneAttendueId: l.id,
      quantite: 1,
    })
    await f.createInstruction(ctx.db, {
      atelierId: d.atelier.id,
      contNum: n,
      contAnbas: s.annee + 1,
      contSembas: 5,
    })
    const r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(r.gardes.length).toBeGreaterThan(0)
    expect(
      (
        await post(ctx, '/api/stocks/fin-campagne/decision', d.headers, {
          ...cible(r),
          decision: 'DETRUIRE',
        })
      ).statusCode,
    ).toBe(422)
  })
  it('RG-STK-NEW-002 une instruction future propre au dossier exclut la fin de campagne sans réception attendue future', async () => {
    const d = await dossier(),
      s = semaineIsoDe(new Date())
    await f.createInstruction(ctx.db, {
      atelierId: d.atelier.id,
      contNum: d.num,
      contAnbas: s.annee + 1,
      contSembas: 6,
    })
    expect(await lire(d.headers, d.num)).toBeUndefined()
  })
  it('RG-STK-NEW-002 Bordeaux reste un point d’attention avec quantité nulle', async () => {
    const d = await dossier(),
      dest = await f.createDestinataire(ctx.db, { nomOrigine: 'BORDEAUX' })
    await f.createRepartition(ctx.db, {
      contNum: d.num,
      atelierId: d.atelier.id,
      destinataireId: dest.id,
      qte: null,
    })
    const r = await lire(d.headers, d.num)
    if (!r) throw new Error('Dossier absent')
    expect(r.attention).toContain('BDX 0 %')
  })
  it('RG-STK-NEW-002 une répartition future sans destinataire empêche une sortie prématurée sans attendue future', async () => {
    const d = await dossier(),
      s = semaineIsoDe(new Date())
    await f.createRepartition(ctx.db, {
      contNum: d.num,
      atelierId: d.atelier.id,
      destinataireId: null,
      semAnnee: s.annee + 1,
      semNum: 6,
    })
    expect(await lire(d.headers, d.num)).toBeUndefined()
  })
  it('EX-STK-NEW-001 reçu contrôlé et stock disponible distinguent contrôle, rebut et expédition', async () => {
    const d = await dossier()
    for (const [type, quantite] of [
      ['ECART_CONTROLE', -17],
      ['MISE_AU_REBUT', -3],
      ['EXPEDITION', -10],
    ] as const)
      await f.createMouvement(ctx.db, { afficheId: d.affiche.id, type, quantite })
    const response = await get(ctx, `/api/stocks?dossier=${d.num}`, d.headers)
    expect(response.statusCode).toBe(200)
    expect(StocksSchema.parse(response.json()).items[0]).toMatchObject({
      recu: 83,
      disponible: 70,
      rebut: 3,
      sorties: 10,
    })
  })
})
