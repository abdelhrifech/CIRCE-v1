// REC-P06 — feuilles de stock, étiquettes rack, rangement, édition picking : RG-REC-079 à 093.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { EditionPickingSchema, FeuillesSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  contexteReception,
  erreur,
  get,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'
import { codeBarres } from '../../src/modules/reception/impressions.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

describe('REC-P06 Feuilles de stock', () => {
  it('RG-REC-079 code-barres « A- » + 13 chiffres', () => {
    expect(codeBarres(42)).toBe('A-0000000000042')
  })

  it('RG-REC-080 / RG-REC-081 / RG-REC-084 feuille définitive : quantité = Σ mouvements, 1er départ, dossiers', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 9)
    await f.createMouvement(db, {
      afficheId: rv.afficheId,
      type: 'MISE_AU_REBUT',
      quantite: -2,
      date: new Date(),
    })
    const r = await get(ctx, `/api/feuilles?ids=${String(rv.afficheId)}`, s.headers)
    expect(r.statusCode).toBe(200)
    const { feuilles, exemplairesParDefaut } = FeuillesSchema.parse(r.json())
    expect(exemplairesParDefaut).toBe(2)
    expect(feuilles[0]).toMatchObject({
      type: 'DEFINITIVE',
      quantite: 7,
      dossiers: [rv.ligne.contNum],
      fondJaune: false,
      codeBarres: codeBarres(rv.afficheId),
    })
    expect(feuilles[0]?.premierDepart).toBe(feuilles[0]?.semaines[0])
  })

  it('RG-REC-082 fond jaune pour un dossier multi-semaines', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 10)
    const l2 = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      contNum: rv.ligne.contNum,
      semAnnee: 2099,
      semNum: 2,
      qteBc: 10,
    })
    await f.createRattachement(db, {
      afficheId: rv.afficheId,
      ligneAttendueId: l2.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const { feuilles } = FeuillesSchema.parse(
      (await get(ctx, `/api/feuilles?ids=${String(rv.afficheId)}`, s.headers)).json(),
    )
    expect(feuilles[0]?.fondJaune).toBe(true)
  })

  it('RG-REC-083 feuille temporaire pour une affiche sans dossier (pas de fond jaune)', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, statut: 'ORPHELINE' })
    const { feuilles } = FeuillesSchema.parse(
      (await get(ctx, `/api/feuilles?ids=${String(a.id)}`, s.headers)).json(),
    )
    expect(feuilles[0]).toMatchObject({ type: 'TEMPORAIRE', fondJaune: false })
  })

  it('RG-REC-001 feuille d’une affiche hors périmètre : 403', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db)
    expect((await get(ctx, `/api/feuilles?ids=${String(a.id)}`, s.headers)).statusCode).toBe(403)
  })
})

describe('REC-P06 Impressions', () => {
  it('RG-REC-085 / RG-REC-090 / RG-REC-091 imprimer note le type de feuille, lève « Feuille à refaire » et journalise', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    await db.affiche.update({ where: { id: rv.afficheId }, data: { feuilleARefaire: true } })
    const r = await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'FEUILLE_ET_ETIQUETTE',
      exemplaires: 2,
    })
    expect(r.statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      typeFeuille: 'DEFINITIVE',
      feuilleARefaire: false,
    })
    expect(
      await db.journalAudit.count({
        where: {
          entiteId: String(rv.afficheId),
          action: { in: ['IMPRESSION_FEUILLE', 'IMPRESSION_ETIQUETTE_RACK'] },
        },
      }),
    ).toBe(2)
  })

  it.each([[0], [6]])('RG-REC-086 refuse %i exemplaire(s) (1 à 5)', async (n) => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const r = await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'FEUILLE',
      exemplaires: n,
    })
    expect(r.statusCode).toBe(400)
    expect(erreur(r).regle).toBe('RG-REC-086')
  })

  it('RG-REC-084 pas d’étiquette rack sans dossier (409), rien n’est écrit', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      statut: 'ORPHELINE',
      typeFeuille: 'TEMPORAIRE',
    })
    const r = await post(ctx, '/api/impressions', s.headers, {
      afficheIds: [a.id],
      contenu: 'FEUILLE_ET_ETIQUETTE',
      exemplaires: 1,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      code: 'REC_FEUILLE_DEFINITIVE_IMPOSSIBLE',
      regle: 'RG-REC-084',
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(a.id), action: 'IMPRESSION_FEUILLE' },
      }),
    ).toBe(0)
  })

  it('RG-REC-087 une réimpression est possible (feuille déjà imprimée)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const corps = { afficheIds: [rv.afficheId], contenu: 'FEUILLE', exemplaires: 1 }
    expect((await post(ctx, '/api/impressions', s.headers, corps)).statusCode).toBe(200)
    expect((await post(ctx, '/api/impressions', s.headers, corps)).statusCode).toBe(200)
  })

  it.each([['com'], ['expe']] as const)(
    'RG-REC-002 le profil %s ne peut pas imprimer (403)',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      const intrus = await autre(ctx, s.plateforme.id, [role])
      expect(
        (
          await post(ctx, '/api/impressions', intrus.headers, {
            afficheIds: [rv.afficheId],
            contenu: 'FEUILLE',
            exemplaires: 1,
          })
        ).statusCode,
      ).toBe(403)
    },
  )

  it('RG-REC-002 le profil cheq peut imprimer', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const cheq = await autre(ctx, s.plateforme.id, ['cheq'])
    expect(
      (
        await post(ctx, '/api/impressions', cheq.headers, {
          afficheIds: [rv.afficheId],
          contenu: 'FEUILLE',
          exemplaires: 1,
        })
      ).statusCode,
    ).toBe(200)
  })
})

describe('REC-P06 Ranger avant d’imprimer', () => {
  it('RG-REC-088 enregistre l’emplacement (majuscules) avec historique ; vide = reste en zone tampon', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const rv2 = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const [a, a2] = await Promise.all([
      db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } }),
      db.affiche.findUniqueOrThrow({ where: { id: rv2.afficheId } }),
    ])
    const r = await post(ctx, '/api/affiches/rangement', s.headers, {
      affiches: [
        { id: a.id, version: a.version, allee: 'c', rayon: '3' },
        { id: a2.id, version: a2.version, allee: '', rayon: '' },
      ],
    })
    expect(r.statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
      allee: 'C',
      rayon: '3',
    })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a2.id } })).allee).toBeNull()
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(a.id), action: 'MODIFICATION_EMPLACEMENT' },
      }),
    ).toBe(1)
  })

  it('RG-REC-088 refuse une allée sans rayon (422)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await post(ctx, '/api/affiches/rangement', s.headers, {
      affiches: [{ id: a.id, version: a.version, allee: 'C', rayon: '' }],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-REC-088')
  })

  it('RG-REC-009 refuse un rangement sur une version périmée (409)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await post(ctx, '/api/affiches/rangement', s.headers, {
      affiches: [{ id: a.id, version: a.version - 1, allee: 'C', rayon: '1' }],
    })
    expect(r.statusCode).toBe(409)
  })
})

describe('REC-P06 Édition picking', () => {
  it('RG-REC-093 affiches validées admin hors zone picking, groupées par format puis annonceur', async () => {
    const s = await site(ctx)
    const sup = await f.createSupport(db, { nom: `ZZ-${String(Date.now())}` })
    const entree = new Date('2026-03-10T10:00:00Z')
    const b = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: sup.id,
      validationAdmin: true,
      contAnnonc: 'Beta',
      dateEntree: entree,
    })
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: sup.id,
      validationAdmin: true,
      contAnnonc: 'alpha',
      dateEntree: entree,
    })
    await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: sup.id,
      validationAdmin: false,
      dateEntree: entree,
    })
    await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: sup.id,
      validationAdmin: true,
      zonePicking: true,
      dateEntree: entree,
    })
    await f.createMouvement(db, { afficheId: a.id, type: 'RECEPTION', quantite: 5, date: entree })
    const r = await get(
      ctx,
      `/api/edition-picking?plateformeId=${String(s.plateforme.id)}&du=2026-03-01&au=2026-03-31`,
      s.headers,
    )
    expect(r.statusCode).toBe(200)
    const { lignes } = EditionPickingSchema.parse(r.json())
    expect(lignes.map((l) => l.afficheId)).toEqual([a.id, b.id])
    expect(lignes[0]?.quantite).toBe(5)
  })

  it('ANO-039 rejet : date impossible (2026-02-30) dans la période de l’édition picking → 400', async () => {
    const s = await site(ctx, ['coord'])
    const r = await get(
      ctx,
      `/api/edition-picking?plateformeId=${String(s.plateforme.id)}&du=2026-02-30&au=2026-03-31`,
      s.headers,
    )
    expect(r.statusCode).toBe(400)
  })
})
