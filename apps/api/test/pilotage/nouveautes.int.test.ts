import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DispositionTableauSchema,
  DonneesTableauSchema,
  J3DonneesSchema,
  J3Schema,
  TABLEAU_DEFAUT,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { autre, contexteReception, get, post, site } from '../support/reception.ts'
const ctx = contexteReception()
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
async function contexte() {
  const s = await site(ctx, ['coord'])
  await ctx.db.plateforme.update({
    where: { id: s.plateforme.id },
    data: { nom: 'Wissous', idSiteCcf: 1 },
  })
  const dossier = await f.createDossier(ctx.db, { annonceur: 'Annonceur fictif J-3' })
  await f.createReceptionAttendue(ctx.db, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    contNum: dossier.contNum,
    format: '2 m² fixe',
    semAnnee: 2026,
    semNum: 48,
    qteBc: 100,
    source: 'BC',
  })
  const colle = await f.createDossier(ctx.db, { annonceur: 'Annonceur fictif colle' })
  await f.createReceptionAttendue(ctx.db, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    contNum: colle.contNum,
    format: '12 m² Colle',
    semAnnee: 2026,
    semNum: 48,
    qteBc: 50,
    source: 'BC',
  })
  return { ...s, dossier, colle }
}
describe('EX-NEW-J3-001 trois tableaux et suivi manuel', () => {
  it('EX-NEW-J3-001 initialise depuis l’EDR, distingue Wissous 1/2 et ne mélange pas les années', async () => {
    const c = await contexte()
    expect(
      (await post(ctx, '/api/j3/initialiser', c.headers, { semaine: '2026-W48' })).statusCode,
    ).toBe(200)
    const r = J3Schema.parse((await get(ctx, '/api/j3?semaine=2026-W48', c.headers)).json())
    expect(r.sections.find((s) => s.id === 'wis1')?.lignes).toMatchObject([
      {
        candidat: {
          dossier: c.dossier.contNum,
          attendu: 100,
          reste: 100,
          formats: { '2 m² fixe': 100 },
        },
      },
    ])
    expect(r.sections.find((s) => s.id === 'wis2')?.lignes).toMatchObject([
      { candidat: { dossier: c.colle.contNum, reste: 50, formats: { '12 m²': 50 } } },
    ])
    expect(
      J3Schema.parse((await get(ctx, '/api/j3?semaine=2027-W48', c.headers)).json()).sections.every(
        (s) => s.candidats.length === 0,
      ),
    ).toBe(true)
  })
  it('EX-NEW-J3-001 conserve la saisie partagée, refuse concurrence, surcoût négatif et hors périmètre', async () => {
    const c = await contexte()
    await post(ctx, '/api/j3/initialiser', c.headers, { semaine: '2026-W48' })
    const ligne = J3Schema.parse((await get(ctx, '/api/j3?semaine=2026-W48', c.headers)).json())
      .sections[0]?.lignes[0]
    if (!ligne) throw new Error('Ligne J-3 absente')
    const donnees = J3DonneesSchema.parse({
      prepa: 'Gestionnaire fictif',
      go: 'NO GO',
      surPtf: 12.5,
      comm: 'Livraison prévue vendredi',
    })
    expect(
      (
        await post(ctx, `/api/j3/lignes/${ligne.id}`, c.headers, {
          version: ligne.version,
          donnees,
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await post(ctx, `/api/j3/lignes/${ligne.id}`, c.headers, {
          version: ligne.version,
          donnees,
        })
      ).statusCode,
    ).toBe(409)
    expect(
      (
        await post(ctx, `/api/j3/lignes/${ligne.id}`, c.headers, {
          version: ligne.version + 1,
          donnees: { ...donnees, surPtf: -1 },
        })
      ).statusCode,
    ).toBe(400)
    const horsSite = await site(ctx, ['coord'])
    expect(
      (
        await post(ctx, `/api/j3/lignes/${ligne.id}`, horsSite.headers, {
          version: ligne.version + 1,
          donnees,
        })
      ).statusCode,
    ).toBe(403)
    expect((await ctx.db.j3Ligne.findUniqueOrThrow({ where: { id: ligne.id } })).donnees).toContain(
      'Gestionnaire fictif',
    )
  })
  it('EX-NEW-J3-001 retrait conservé à la réouverture, puis ajout explicite, dossier métier intact', async () => {
    const c = await contexte()
    await post(ctx, '/api/j3/initialiser', c.headers, { semaine: '2026-W48' })
    const r = J3Schema.parse((await get(ctx, '/api/j3?semaine=2026-W48', c.headers)).json()),
      section = r.sections.find((s) => s.id === 'wis1'),
      ligne = section?.lignes[0]
    if (!section || !ligne) throw new Error('Ligne J-3 absente')
    expect(
      (await post(ctx, `/api/j3/lignes/${ligne.id}/retirer`, c.headers, { version: ligne.version }))
        .statusCode,
    ).toBe(200)
    await post(ctx, '/api/j3/initialiser', c.headers, { semaine: '2026-W48' })
    expect(
      J3Schema.parse((await get(ctx, '/api/j3?semaine=2026-W48', c.headers)).json()).sections.find(
        (s) => s.id === 'wis1',
      )?.lignes,
    ).toHaveLength(0)
    expect(await ctx.db.dossier.count({ where: { id: c.dossier.id } })).toBe(1)
    expect(
      (
        await post(ctx, '/api/j3/lignes', c.headers, {
          semaine: '2026-W48',
          plateformeId: c.plateforme.id,
          section: 'wis1',
          dossierIds: [c.dossier.id],
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await post(ctx, '/api/j3/lignes', c.headers, {
          semaine: '2026-W48',
          plateformeId: c.plateforme.id,
          section: 'wis2',
          dossierIds: [c.dossier.id],
        })
      ).statusCode,
    ).toBe(422)
  })
})
describe('EX-NEW-PIL-001 tableau personnel', () => {
  it('EX-NEW-PIL-001 disposition et notes isolées par utilisateur, limite 500 caractères et verrou de version', async () => {
    const c = await contexte(),
      autreCoord = await autre(ctx, c.plateforme.id, ['coord'])
    const p = DispositionTableauSchema.parse(
      (await get(ctx, '/api/pilotage/tableau/disposition', c.headers)).json(),
    )
    expect(p.version).toBe(0)
    const carres = [{ ...TABLEAU_DEFAUT[4], texte: 'Note personnelle fictive' }]
    expect(
      (await post(ctx, '/api/pilotage/tableau/disposition', c.headers, { version: 0, carres }))
        .statusCode,
    ).toBe(200)
    expect(
      (await post(ctx, '/api/pilotage/tableau/disposition', c.headers, { version: 0, carres }))
        .statusCode,
    ).toBe(409)
    expect(
      DispositionTableauSchema.parse(
        (await get(ctx, '/api/pilotage/tableau/disposition', autreCoord.headers)).json(),
      ).carres,
    ).toEqual(TABLEAU_DEFAUT)
    expect(
      (
        await post(ctx, '/api/pilotage/tableau/disposition', c.headers, {
          version: 1,
          carres: [{ ...carres[0], texte: 'x'.repeat(501) }],
        })
      ).statusCode,
    ).toBe(400)
    const reception = await autre(ctx, c.plateforme.id, ['recep'])
    expect(
      (await get(ctx, '/api/pilotage/tableau/disposition', reception.headers)).statusCode,
    ).toBe(403)
  })
  it('EX-NEW-PIL-001 données réelles filtrées par site, aucun dossier étranger', async () => {
    const c = await contexte(),
      horsSite = await contexte()
    const r = await get(ctx, '/api/pilotage/tableau', c.headers)
    expect(r.statusCode).toBe(200)
    const data = DonneesTableauSchema.parse(r.json())
    expect(
      Object.values(data.sources)
        .flat()
        .every((l) => !l.dossier.includes(horsSite.dossier.contNum)),
    ).toBe(true)
  })
})
