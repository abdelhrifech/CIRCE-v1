import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BusSchema,
  BusHistoriqueSchema,
  BusLigneBroadcastSchema,
  BusReferencesVersionSchema,
  formatSemaineIso,
  semaineIsoDe,
} from '@circe/shared'
import { integrerLignesBus } from '../../src/modules/bus/service.ts'
import * as f from '../factories/index.ts'
import { autre, contexteReception, get, post, site, PNG } from '../support/reception.ts'
const ctx = contexteReception()
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
async function contexte() {
  const c = await site(ctx, ['recep']),
    admin = await autre(ctx, c.plateforme.id, ['admin']),
    chef = await autre(ctx, c.plateforme.id, ['cheq']),
    commerce = await autre(ctx, c.plateforme.id, ['com'])
  const existant = BusReferencesVersionSchema.parse(
    (await get(ctx, '/api/bus/referentiel', admin.headers)).json(),
  )
  const code = `C${c.plateforme.id}`,
    dsp = `DSP${c.plateforme.id}`
  const formats = existant.formats.length
    ? existant.formats
    : ['AR1', 'AR2', 'FG', 'FD', 'AV'].map((code) => ({
        code,
        supportId: c.support.id,
        patrimoineCode: '',
        libelleBroadcast: '',
      }))
  const refs = {
    version: existant.version,
    dsps: [...existant.dsps, { code: dsp, nom: dsp, plateformeId: c.plateforme.id }],
    centres: [...existant.centres, { code, nom: `Centre fictif ${code}`, dspCode: dsp }],
    formats,
    parcs: [
      ...existant.parcs,
      { centreCode: code, parc: 'A', formatCode: 'AR1', cadastre: 60, terrain: 40 },
    ],
  }
  expect((await post(ctx, '/api/bus/referentiel', admin.headers, refs)).statusCode).toBe(200)
  const supportId = formats[0]?.supportId ?? 0
  const semaine = formatSemaineIso(semaineIsoDe(new Date()))
  const ligne = BusLigneBroadcastSchema.parse({
    idExterne: `L-${code}`,
    contNum: 810000 + c.plateforme.id,
    annonceur: 'Annonceur Bus fictif',
    themeCode: 'T1',
    theme: 'Visuel A',
    centreCode: code,
    parc: 'A',
    formatCode: 'AR1',
    semaine,
    finPose: semaine,
    vendu: 60,
    quantiteBroadcast: 65,
    attendu: 72,
    entretienPourcent: 20,
  })
  await ctx.db.$transaction((tx) => integrerLignesBus(tx, [ligne], new Date()))
  return { ...c, admin, chef, commerce, ligne, supportId }
}
async function lecture(c: Awaited<ReturnType<typeof contexte>>) {
  return BusSchema.parse((await get(ctx, '/api/bus', c.headers)).json())
}
describe('BUS-01 à BUS-25 parcours Nanterre', () => {
  it('BUS-01/03/07 réimporte sans doublon, crée les attendus communs et conserve le format par code stable', async () => {
    const c = await contexte()
    await ctx.db.$transaction((tx) => integrerLignesBus(tx, [c.ligne], new Date()))
    const r = await lecture(c)
    expect(r.lignes).toHaveLength(1)
    expect(r.lignes[0]).toMatchObject({
      formatCode: 'AR1',
      vendu: 60,
      aEncoller: 65,
      attendu: 72,
      terrain: 40,
    })
    expect(r.visuels).toMatchObject([{ attendu: 72, recu: 0, reste: 72 }])
    expect(
      await ctx.db.receptionAttendue.count({
        where: { contNum: c.ligne.contNum, plateformeId: c.plateforme.id },
      }),
    ).toBe(1)
    expect(
      await ctx.db.receptionAttendue.findFirst({ where: { contNum: c.ligne.contNum } }),
    ).toMatchObject({ supportId: c.supportId })
  })
  it('BUS-01 réimport vers une autre semaine recalcule l’ancien attendu ; clés répétées refusées sans écriture', async () => {
    const c = await contexte()
    const avant = (await lecture(c)).lignes[0]
    if (!avant) throw new Error('Ligne Bus absente')
    const semaine = formatSemaineIso(semaineIsoDe(new Date(Date.now() + 7 * 864e5)))
    await ctx.db.$transaction((tx) =>
      integrerLignesBus(tx, [{ ...c.ligne, semaine, finPose: semaine }], new Date()),
    )
    const apres = (await lecture(c)).lignes[0]
    expect(apres?.ligneAttendueId).not.toBe(avant.ligneAttendueId)
    expect(
      await ctx.db.receptionAttendue.findUnique({ where: { id: avant.ligneAttendueId } }),
    ).toMatchObject({ qteBc: 0 })
    expect((await lecture(c)).visuels[0]?.attendu).toBe(72)
    await expect(
      ctx.db.$transaction((tx) => integrerLignesBus(tx, [c.ligne, c.ligne], new Date())),
    ).rejects.toThrow('plusieurs fois')
    expect((await lecture(c)).lignes[0]?.semaine).toBe(semaine)
  })
  it('BUS-19 le nouvel ensemble de données refuse aussi le contournement par l’ancien ajustement global', async () => {
    const c = await contexte()
    const r = await post(ctx, '/api/coordination/unitaire/encoller', c.admin.headers, {
      plateformeId: c.plateforme.id,
      depart: c.ligne.semaine,
      ajustementGlobal: -20,
      centres: [],
      version: 0,
    })
    expect(r.statusCode, r.body).toBe(409)
    expect(r.body).toContain('centre bus, parc et format')
  })
  it('BUS-19/20 ajustement strictement manuel, isolé, historique et vente inchangée ; retour Broadcast possible', async () => {
    const c = await contexte(),
      r = await lecture(c),
      l = r.lignes[0]
    if (!l) throw new Error('Ligne Bus absente')
    expect(
      (
        await post(ctx, `/api/bus/lignes/${l.id}/ajuster`, c.headers, {
          version: l.version,
          quantite: 40,
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await post(ctx, `/api/bus/lignes/${l.id}/ajuster`, c.chef.headers, {
          version: l.version,
          quantite: 40,
          motif: 'Parc constaté',
        })
      ).statusCode,
    ).toBe(200)
    const apres = (await lecture(c)).lignes[0]
    expect(apres).toMatchObject({
      vendu: 60,
      quantiteBroadcast: 65,
      quantiteAjustee: 40,
      aEncoller: 40,
    })
    expect(
      (
        await post(ctx, `/api/bus/lignes/${l.id}/ajuster`, c.admin.headers, {
          version: l.version,
          quantite: 35,
        })
      ).statusCode,
    ).toBe(409)
    expect(
      (
        await post(ctx, `/api/bus/lignes/${l.id}/ajuster`, c.chef.headers, {
          version: apres?.version,
          quantite: -1,
        })
      ).statusCode,
    ).toBe(400)
    await ctx.db.$transaction((tx) => integrerLignesBus(tx, [c.ligne], new Date()))
    expect((await lecture(c)).lignes[0]?.quantiteAjustee).toBe(40)
    const actuelle = (await lecture(c)).lignes[0]
    expect(
      (
        await post(ctx, `/api/bus/lignes/${l.id}/ajuster`, c.chef.headers, {
          version: actuelle?.version,
          quantite: null,
        })
      ).statusCode,
    ).toBe(200)
    expect((await lecture(c)).lignes[0]?.aEncoller).toBe(65)
    const h = BusHistoriqueSchema.parse(
      (await get(ctx, '/api/bus/historique', c.admin.headers)).json(),
    )
    expect(h.items.filter((h) => h.ligneId === l.id)).toMatchObject([
      { avant: '40', apres: '65' },
      { avant: '65', apres: '40', motif: 'Parc constaté' },
    ])
  })
  it('BUS-09/12/13 réception Bus et complément alimentent le stock commun une seule fois, photos accessibles au commerce', async () => {
    const c = await contexte(),
      v = (await lecture(c)).visuels[0]
    if (!v) throw new Error('Visuel Bus absent')
    const base = {
      ligneAttendueId: v.ligneAttendueId,
      date: new Date().toISOString(),
      bl: '',
      entretien: false,
      themeConforme: false,
      photo: { intitule: 'photo-affiche.png', mimeType: 'image/png', contenuBase64: PNG },
      tenue: 'OK',
      nc: 'ROULE',
      commentaire: 'Entretien manquant, thème à vérifier',
    }
    const r = await post(ctx, '/api/bus/receptions', c.headers, { ...base, quantite: 30 })
    expect(r.statusCode).toBe(200)
    const premier = r.json<{ receptionId: number; afficheId: number }>()
    const r2 = await post(ctx, '/api/bus/receptions', c.headers, {
      ...base,
      quantite: 42,
      themeConforme: true,
    })
    expect(r2.statusCode).toBe(200)
    expect(r2.json<{ afficheId: number }>().afficheId).toBe(premier.afficheId)
    const result = await lecture(c)
    expect(result.visuels[0]).toMatchObject({ recu: 72, reste: 0, statut: 'COMPLETE' })
    expect(result.visuels[0]?.anomalies).toContain('Thème non conforme')
    expect(
      await ctx.db.mouvement.aggregate({
        where: { afficheId: premier.afficheId },
        _sum: { quantite: true },
      }),
    ).toMatchObject({ _sum: { quantite: 72 } })
    for (const rec of result.receptions)
      expect((await get(ctx, `/api/photos/${rec.photoId}`, c.commerce.headers)).statusCode).toBe(
        200,
      )
    expect(
      (await post(ctx, '/api/bus/receptions', c.headers, { ...base, quantite: 50 })).statusCode,
    ).toBe(200)
    expect(
      await ctx.db.busControleReception.count({ where: { ligneAttendueId: v.ligneAttendueId } }),
    ).toBe(3)
  })
  it('BUS-20 refuse l’ajustement après lancement et les modifications hors périmètre', async () => {
    const c = await contexte(),
      l = (await lecture(c)).lignes[0]
    if (!l) throw new Error('Ligne Bus absente')
    const autreSite = await site(ctx, ['cheq'])
    expect(
      (
        await post(ctx, `/api/bus/lignes/${l.id}/ajuster`, autreSite.headers, {
          version: l.version,
          quantite: 1,
        })
      ).statusCode,
    ).toBe(403)
    await f.createRepartition(ctx.db, { contNum: c.ligne.contNum, statut: 'PREPARE' })
    expect(
      (
        await post(ctx, `/api/bus/lignes/${l.id}/ajuster`, c.admin.headers, {
          version: l.version,
          quantite: 1,
        })
      ).statusCode,
    ).toBe(409)
  })
})
