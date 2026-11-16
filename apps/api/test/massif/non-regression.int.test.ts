// Étape 9 — tests de NON-RÉGRESSION des anomalies trouvées par les JDD massifs (numérotation NR-<nnn> = ANO-<nnn>,
// après ANO-060 de l'étape 8). Intégration seulement : API réelle sur la base de test, données propres au test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FicheDossierSchema, ListeDossiersSchema } from '@circe/shared'
import { proches, ratio, simplifier } from '../../src/modules/coordination/themes.ts'
import * as f from '../factories/index.ts'
import { creerRng } from '../jdd/prng.ts'
import { contexteReception, erreur, get, post, site } from '../support/reception.ts'
import { siteDeroulant } from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

describe('NR-061 ANO-061 : un mouvement négatif ne rend jamais le stock négatif (RG-REC-064, RG-REC-151, Q-417)', () => {
  /** Palette de 17 affiches dont 16 sont mises au rebut : stock 1, palette « À contrôler ». */
  async function paletteApresRebut() {
    const s = await site(ctx, ['recep'])
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      qteBc: 17,
      semAnnee: 2026,
      semNum: 45,
    })
    const bl = {
      lignes: [{ ligneAttendueId: l.id, quantite: 17, cochee: true }],
      photoBlId: (await f.createPhoto(db, { taille: 16, createdById: s.user.id })).id,
      numeroBl: `BL-NR061-${String(f.next())}`,
      livreurId: (await f.createLivreur(db)).id,
      imprimeurId: (await f.createImprimeur(db)).id,
      nbColis: 1,
      dechargeParId: null,
    }
    const r = await post(ctx, '/api/receptions', s.headers, bl)
    expect(r.statusCode, r.body).toBe(201)
    const { receptionId, affiches } = r.json<{ receptionId: number; affiches: { id: number }[] }>()
    const afficheId = affiches[0]?.id ?? 0
    const rebut = await post(ctx, `/api/affiches/${String(afficheId)}/rebut`, s.headers, {
      quantite: 16,
      motif: 'AFFICHE_DECHIREE',
    })
    expect(rebut.statusCode, rebut.body).toBe(200)
    return { ...s, receptionId, afficheId }
  }
  const controle = async (p: Awaited<ReturnType<typeof paletteApresRebut>>, comptee: number) => {
    const c = (
      await get(ctx, `/api/receptions/${String(p.receptionId)}/controle`, p.headers)
    ).json<{
      version: number
    }>()
    return post(ctx, `/api/receptions/${String(p.receptionId)}/controle`, p.headers, {
      version: c.version,
      controleurId: p.user.id,
      lignes: [{ afficheId: p.afficheId, qteComptee: comptee, allee: 'A', rayon: '1' }],
    })
  }
  const stock = async (afficheId: number) =>
    (await db.mouvement.aggregate({ where: { afficheId }, _sum: { quantite: true } }))._sum
      .quantite ?? 0

  it('NR-061 RG-REC-064 un contrôle dont l’écart (comptée 8 pour 17 au BL) ferait passer le stock de 1 à −8 est refusé en 422 REC_STOCK_NEGATIF : stock, palette et mouvements inchangés', async () => {
    const p = await paletteApresRebut()
    expect(await stock(p.afficheId)).toBe(1)
    const avant = await db.mouvement.count({ where: { afficheId: p.afficheId } })
    const r = await controle(p, 8)
    expect(r.statusCode, r.body).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_STOCK_NEGATIF', regle: 'RG-REC-064' })
    expect(await stock(p.afficheId)).toBe(1)
    expect(await db.mouvement.count({ where: { afficheId: p.afficheId } })).toBe(avant)
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
  })

  it('NR-061 RG-REC-064 borne : un écart qui ramène le stock à exactement 0 (comptée 16 pour 17, stock 1) est accepté ; le stock vaut 0', async () => {
    const p = await paletteApresRebut()
    const r = await controle(p, 16)
    expect(r.statusCode, r.body).toBe(200)
    expect(await stock(p.afficheId)).toBe(0)
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'CONTROLEE',
    )
  })

  it('NR-061 RG-REC-064 un écart positif ou nul reste accepté (comptée 17 pour 17) : la garde ne vise que les sorties', async () => {
    const p = await paletteApresRebut()
    const r = await controle(p, 17)
    expect(r.statusCode, r.body).toBe(200)
    expect(await stock(p.afficheId)).toBe(1)
  })
})

describe('NR-062 ANO-062 : la liste des dossiers (lecture par lots) donne les mêmes écart et dernière demande de correction que la fiche (RG-COO-055), et la proximité des thèmes reste EXACTE (RG-COO-069)', () => {
  it('NR-062 RG-COO-055 écart Broadcast / Circé et dernière demande de correction : liste = fiche, y compris plusieurs demandes (la plus récente) et un thème exclu ignoré', async () => {
    const s = await siteDeroulant(ctx)
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE', annonceur: 'ANO062' })
    await f.createInstruction(db, {
      dossierId: dossier.id,
      contNum: dossier.contNum,
      atelierId: s.atelier.id,
      statut: 'EN_COURS',
      contAnbas: 2026,
      contSembas: 46,
    })
    const ligne = (data: Parameters<typeof f.createReceptionAttendue>[1]) =>
      f.createReceptionAttendue(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: dossier.contNum,
        semAnnee: 2026,
        semNum: 46,
        ...data,
      })
    await ligne({ theme: 'A', themeCle: 'A', qteBc: 100, qtePrepa: 80 })
    await ligne({ theme: 'B', themeCle: 'B', qteBc: 50, qtePrepa: 60 })
    await ligne({
      theme: 'C exclu',
      themeCle: 'C EXCLU',
      qteBc: 999,
      qtePrepa: 1,
      themeExclu: true,
    })
    await ligne({
      theme: 'D annulée',
      themeCle: 'D ANNULEE',
      qteBc: 999,
      qtePrepa: 1,
      etatLigne: 'ANNULEE',
    })
    const ancienne = new Date('2026-11-01T10:00:00.000Z')
    const recente = new Date('2026-11-03T10:00:00.000Z')
    await db.demandeCorrection.create({
      data: { dossierId: dossier.id, note: 'ancienne', le: ancienne, parId: s.users.coord.id },
    })
    await db.demandeCorrection.create({
      data: { dossierId: dossier.id, note: 'récente', le: recente, parId: s.users.coord.id },
    })
    const h = s.users.coord.headers
    const liste = ListeDossiersSchema.parse(
      (await get(ctx, `/api/coordination/dossiers?dossier=${String(dossier.contNum)}`, h)).json(),
    )
    const item = liste.items.find((i) => i.dossier === dossier.contNum)
    const fiche = FicheDossierSchema.parse(
      (await get(ctx, `/api/coordination/dossiers/${String(dossier.id)}`, h)).json(),
    )
    expect(item?.ecart).toBe(10) // (100 − 80) + (50 − 60)
    expect(item?.correctionDemandeeLe).toBe(recente.toISOString())
    expect(fiche.ecart).toBe(item?.ecart)
    expect(fiche.correctionDemandeeLe).toBe(item?.correctionDemandeeLe)
  })

  it('NR-062 RG-COO-055 un dossier sans quantité de prépa a un écart nul (null) et aucune demande : liste = fiche', async () => {
    const s = await siteDeroulant(ctx)
    const dossier = await f.createDossier(db, { statut: 'A_TRAITER' })
    await f.createInstruction(db, {
      dossierId: dossier.id,
      contNum: dossier.contNum,
      atelierId: s.atelier.id,
      statut: 'A_TRAITER',
      contAnbas: 2026,
      contSembas: 46,
    })
    await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: dossier.contNum,
      qteBc: 30,
      semAnnee: 2026,
      semNum: 46,
    })
    const h = s.users.coord.headers
    const item = ListeDossiersSchema.parse(
      (await get(ctx, `/api/coordination/dossiers?dossier=${String(dossier.contNum)}`, h)).json(),
    ).items.find((i) => i.dossier === dossier.contNum)
    const fiche = FicheDossierSchema.parse(
      (await get(ctx, `/api/coordination/dossiers/${String(dossier.id)}`, h)).json(),
    )
    expect(item?.ecart).toBeNull()
    expect(item?.correctionDemandeeLe).toBeNull()
    expect([fiche.ecart, fiche.correctionDemandeeLe]).toEqual([null, null])
  })

  it('NR-062 RG-COO-069 proches() (mémorisation + bornes de longueur et de caractères communs) = définition de référence (identiques simplifiés, contenu, similarité ≥ seuil) sur 4 000 paires de thèmes', () => {
    const rng = creerRng(62)
    const mots = [
      'Printemps',
      'Rouge',
      'Soldés',
      'été',
      'Collection',
      'Édition',
      'Offre',
      'Promo',
      'Bleu',
      'Nouveauté',
      'Opération',
      'Festival',
    ]
    const theme = () =>
      Array.from({ length: rng.entier(1, 4) }, () => rng.choisir(mots)).join(
        rng.choisir([' ', '-', '  ', ' / ']),
      )
    const base = Array.from({ length: 80 }, theme)
    const variantes = base.flatMap((t) => [
      t.toUpperCase(),
      `${t} 2`,
      t.replace(' ', ''),
      t.slice(0, Math.max(3, t.length - 2)),
    ])
    const referenceProches = (a: string, b: string, seuil: number) => {
      const x = simplifier(a)
      const y = simplifier(b)
      if (x === y) return true
      const [court, long] = x.length <= y.length ? [x, y] : [y, x]
      if (court.length >= 3 && ` ${long} `.includes(` ${court} `)) return true
      return ratio(x, y) >= seuil
    }
    let vrais = 0
    let faux = 0
    for (let i = 0; i < 4000; i++) {
      const a = rng.choisir(i % 2 === 0 ? base : variantes)
      const b = rng.choisir(i % 3 === 0 ? variantes : base)
      for (const seuil of [0.85, 0.5])
        expect(proches(a, b, seuil), `${a} / ${b} / ${String(seuil)}`).toBe(
          referenceProches(a, b, seuil),
        )
      if (referenceProches(a, b, 0.85)) vrais++
      else faux++
    }
    expect(vrais).toBeGreaterThan(100)
    expect(faux).toBeGreaterThan(100)
  })
})

describe('ANO ouvertes (constats des JDD massifs, décisions à valider)', () => {
  it.todo(
    'NR-063 ANO-063 (OUVERTE, Q-418) : la quantité d’une ligne modifiée APRÈS le Colisage (ligne « En cours » dans une UM, RG-COO-239) ne met pas à jour la quantité de l’UM : décider si l’UM suit la ligne ou si la modification est refusée',
  )
  it.todo(
    'NR-064 ANO-064 (OUVERTE, Q-416) : le comptage à zéro (RG-REC-059) laisse un lien actif de quantité 1 sur une affiche au stock 0 (Math.max(1, …), Q-178) : décider du retrait du lien ou du minimum de 1',
  )
})
