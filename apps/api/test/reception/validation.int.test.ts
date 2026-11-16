// REC-P04 — « Valider la réception » (POST /api/receptions) : RG-REC-036 à 048, RG-REC-008.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ReceptionCreeeSchema } from '@circe/shared'
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

describe('REC-P04 Valider la réception', () => {
  it('RG-NEW-REC-001 Sans BL autorise photo, numéro et imprimeur absents, conserve le doute et évite les faux doublons', async () => {
    const { plateforme, headers } = await site(ctx)
    for (let i = 0; i < 2; i++) {
      const l = await ligne(ctx, plateforme.id)
      const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 7 }])
      const r = await post(ctx, '/api/receptions', headers, {
        ...bl,
        sansBl: true,
        photoBlId: null,
        numeroBl: '',
        imprimeurId: null,
      })
      expect(r.statusCode).toBe(201)
      const body = ReceptionCreeeSchema.parse(r.json())
      const rec = await db.reception.findUniqueOrThrow({
        where: { id: body.receptionId },
        include: { livraison: true },
      })
      expect(rec.photoBlId).toBeNull()
      expect(rec.livraison?.reference).toBe('Sans BL')
      expect(rec.livraison?.imprimeurId).toBeNull()
      expect(await db.afficheAttendue.findMany({ where: { ligneAttendueId: l.id } })).toMatchObject(
        [{ mode: 'MAIN' }],
      )
    }
  })

  it('RG-NEW-REC-001 refuse sans transporteur et ne dispense pas des obligations quand une photo est jointe', async () => {
    const { plateforme, headers } = await site(ctx)
    const l = await ligne(ctx, plateforme.id)
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 7 }])
    const sansTransporteur = await post(ctx, '/api/receptions', headers, {
      ...bl,
      sansBl: true,
      photoBlId: null,
      livreurId: null,
    })
    expect(sansTransporteur.statusCode).toBe(422)
    const avecPhoto = await post(ctx, '/api/receptions', headers, {
      ...bl,
      sansBl: true,
      numeroBl: '',
      imprimeurId: null,
    })
    expect(avecPhoto.statusCode).toBe(422)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l.id } })).toBe(0)
  })

  it('RG-REC-038 / RG-REC-039 / RG-REC-041 / RG-REC-042 crée une réception À contrôler, une affiche IDENTIFIEE, un mouvement et un lien', async () => {
    const { plateforme, headers } = await site(ctx)
    const l = await ligne(ctx, plateforme.id, { annonceur: 'ACME' })
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 7 }])
    const r = await post(ctx, '/api/receptions', headers, bl)
    expect(r.statusCode).toBe(201)
    const body = ReceptionCreeeSchema.parse(r.json())
    const rec = await db.reception.findUniqueOrThrow({
      where: { id: body.receptionId },
      include: { livraison: true },
    })
    expect(rec.statut).toBe('A_CONTROLER')
    expect(rec.aControlerDepuis).not.toBeNull()
    expect(rec.photoBlId).toBe(bl.photoBlId)
    expect(rec.livraison?.reference).toBe(bl.numeroBl)
    const afficheId = body.affiches[0]?.id ?? 0
    const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
    expect(a).toMatchObject({
      statut: 'IDENTIFIEE',
      receptionId: rec.id,
      contAnnonc: 'ACME',
      theme: l.theme,
      quantite: 7,
      conservation: 20,
    })
    const mvts = await db.mouvement.findMany({ where: { afficheId } })
    expect(mvts).toHaveLength(1)
    expect(mvts[0]).toMatchObject({ type: 'RECEPTION', quantite: 7, receptionId: rec.id })
    const liens = await db.afficheAttendue.findMany({ where: { afficheId, actif: true } })
    expect(liens).toMatchObject([{ ligneAttendueId: l.id, quantite: 7, mode: 'BL' }])
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'PARTIELLE',
    )
    const hist = await db.statutHistorique.findMany({
      where: { typeEntite: 'RECEPTION', entiteId: String(rec.id) },
    })
    expect(hist.map((h) => h.nouveau)).toEqual(['A_CONTROLER'])
  })

  it('RG-REC-023 une ligne décochée ou à 0 est ignorée (pas d’affiche)', async () => {
    const { plateforme, headers } = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, plateforme.id), ligne(ctx, plateforme.id)])
    const bl = await bonDeLivraison(ctx, headers, [
      { ligneAttendueId: l1.id, quantite: 3 },
      { ligneAttendueId: l2.id, quantite: 0 },
    ])
    const r = await post(ctx, '/api/receptions', headers, bl)
    expect(r.statusCode).toBe(201)
    const body = ReceptionCreeeSchema.parse(r.json())
    expect(body.affiches).toHaveLength(1)
    expect(body.lignesIgnorees).toEqual([l2.id])
  })

  it('RG-REC-008 une double soumission ne crée qu’une réception', async () => {
    const { plateforme, headers } = await site(ctx)
    const l = await ligne(ctx, plateforme.id)
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    const h = { ...headers, ...idem() }
    const a = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions',
      headers: h,
      payload: bl,
    })
    const b = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions',
      headers: h,
      payload: bl,
    })
    expect(b.json()).toEqual(a.json())
    expect(b.headers['idempotent-replayed']).toBe('true')
    expect(
      await db.affiche.count({ where: { rattachements: { some: { ligneAttendueId: l.id } } } }),
    ).toBe(1)
  })

  it('RG-REC-008 refuse la création sans Idempotency-Key (400)', async () => {
    const { plateforme, headers } = await site(ctx)
    const l = await ligne(ctx, plateforme.id)
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    const r = await post(ctx, '/api/receptions', headers, bl, false)
    expect(r.statusCode).toBe(400)
  })

  it('RG-REC-036 un n° de BL déjà réceptionné exige une confirmation (409), puis passe avec confirmerDoublon', async () => {
    const { plateforme, headers } = await site(ctx)
    const premier = await receptionValidee(ctx, headers, plateforme.id, 2)
    const l = await ligne(ctx, plateforme.id)
    const bl = {
      ...(await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])),
      numeroBl: premier.bl.numeroBl,
    }
    const refus = await post(ctx, '/api/receptions', headers, bl)
    expect(refus.statusCode).toBe(409)
    expect(erreur(refus)).toMatchObject({ code: 'REC_BL_DOUBLON', regle: 'RG-REC-036' })
    const ok = await post(ctx, '/api/receptions', headers, { ...bl, confirmerDoublon: true })
    expect(ok.statusCode).toBe(201)
  })

  it('RG-REC-047 / RG-REC-113 (a) une ligne sans IP (sans thème) exige l’intitulé lu sur l’affiche (422), qui devient le thème', async () => {
    const { plateforme, headers } = await site(ctx)
    const l = await ligne(ctx, plateforme.id, { theme: null, themeCle: null })
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    const refus = await post(ctx, '/api/receptions', headers, bl)
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus)).toMatchObject({ code: 'REC_INTITULE_REQUIS', regle: 'RG-REC-047' })
    const ok = await post(ctx, '/api/receptions', headers, {
      ...bl,
      lignes: [{ ...bl.lignes[0], intituleSaisi: 'Lu sur l’affiche' }],
    })
    expect(ok.statusCode).toBe(201)
    const id = ReceptionCreeeSchema.parse(ok.json()).affiches[0]?.id ?? 0
    expect((await db.affiche.findUniqueOrThrow({ where: { id } })).theme).toBe('Lu sur l’affiche')
  })

  it('RG-REC-048 l’intitulé déjà saisi par l’autre plateforme est suggéré', async () => {
    const { plateforme, headers } = await site(ctx)
    const autreSite = await f.createPlateforme(db)
    const l = await ligne(ctx, plateforme.id, {
      theme: null,
      themeCle: null,
      contNum: 777000 + Math.floor(Math.random() * 999),
    })
    await f.createAffiche(db, {
      plateformeId: autreSite.id,
      contNum: l.contNum,
      theme: 'Intitulé Wissous',
    })
    const r = await get(ctx, `/api/lignes-attendues/${String(l.id)}/intitule-suggere`, headers)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ intitule: 'Intitulé Wissous', site: autreSite.nom })
  })

  it('RG-REC-001 l’intitulé suggéré d’une ligne hors périmètre est refusé (403)', async () => {
    const { headers } = await site(ctx)
    const l = await f.createReceptionAttendue(db)
    const r = await get(ctx, `/api/lignes-attendues/${String(l.id)}/intitule-suggere`, headers)
    expect(r.statusCode).toBe(403)
  })

  it('RG-REC-040 un complément ajoute la quantité à la MÊME affiche (mouvement COMPLEMENT, lien augmenté)', async () => {
    const { plateforme, headers } = await site(ctx)
    const r1 = await receptionValidee(ctx, headers, plateforme.id, 4)
    const bl = await bonDeLivraison(ctx, headers, [
      { ligneAttendueId: r1.ligne.id, quantite: 5, complementAfficheId: r1.afficheId },
    ])
    const r = await post(ctx, '/api/receptions', headers, bl)
    expect(r.statusCode).toBe(201)
    const body = ReceptionCreeeSchema.parse(r.json())
    expect(body.affiches).toEqual([
      { id: r1.afficheId, ligneAttendueId: r1.ligne.id, quantite: 5, complement: true },
    ])
    const mvts = await db.mouvement.findMany({
      where: { afficheId: r1.afficheId },
      orderBy: { id: 'asc' },
    })
    expect(mvts.map((m) => [m.type, m.quantite])).toEqual([
      ['RECEPTION', 4],
      ['COMPLEMENT', 5],
    ])
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: r1.afficheId, actif: true },
    })
    expect(lien.quantite).toBe(9)
    expect(await db.livraisonAffiche.count({ where: { afficheId: r1.afficheId } })).toBe(2)
  })

  it('RG-REC-040 refuse un complément quand le visuel n’est pas reçu en partie (ligne Complète, 422)', async () => {
    const { plateforme, headers } = await site(ctx)
    const r1 = await receptionValidee(ctx, headers, plateforme.id, 10)
    const bl = await bonDeLivraison(ctx, headers, [
      { ligneAttendueId: r1.ligne.id, quantite: 2, complementAfficheId: r1.afficheId },
    ])
    const r = await post(ctx, '/api/receptions', headers, bl)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_COMPLEMENT_INVALIDE', regle: 'RG-REC-040' })
  })

  it('RG-REC-040 refuse un complément sur une affiche non reçue sur cette ligne (422) — rien n’est écrit (RG-REC-046)', async () => {
    const { plateforme, headers } = await site(ctx)
    const r1 = await receptionValidee(ctx, headers, plateforme.id, 4)
    const l2 = await ligne(ctx, plateforme.id)
    const avant = await db.reception.count()
    const bl = await bonDeLivraison(ctx, headers, [
      { ligneAttendueId: l2.id, quantite: 5, complementAfficheId: r1.afficheId },
    ])
    const r = await post(ctx, '/api/receptions', headers, bl)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_COMPLEMENT_INVALIDE', regle: 'RG-REC-040' })
    expect(await db.reception.count()).toBe(avant)
    expect(await db.livraison.count({ where: { reference: bl.numeroBl } })).toBe(0)
  })

  it('RG-REC-026 refuse la validation sans photo du BL (422)', async () => {
    const { plateforme, headers } = await site(ctx)
    const l = await ligne(ctx, plateforme.id)
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    const r = await post(ctx, '/api/receptions', headers, { ...bl, photoBlId: null })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-REC-026')
  })

  it.each([['cheq'], ['com'], ['expe']] as const)(
    'RG-REC-002 le profil %s ne peut pas valider une réception (403)',
    async (role) => {
      const { plateforme, headers } = await site(ctx)
      const l = await ligne(ctx, plateforme.id)
      const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])
      const intrus = await autre(ctx, plateforme.id, [role])
      const r = await post(ctx, '/api/receptions', intrus.headers, bl)
      expect(r.statusCode).toBe(403)
    },
  )

  it('RG-REC-002 le profil coord peut valider une réception', async () => {
    const { plateforme, headers } = await site(ctx, ['coord'])
    const l = await ligne(ctx, plateforme.id)
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    expect((await post(ctx, '/api/receptions', headers, bl)).statusCode).toBe(201)
  })

  it('RG-REC-001 refuse une ligne hors périmètre (403) sans rien écrire', async () => {
    const { headers } = await site(ctx)
    const l = await f.createReceptionAttendue(db)
    const bl = await bonDeLivraison(ctx, headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    const r = await post(ctx, '/api/receptions', headers, bl)
    expect(r.statusCode).toBe(403)
    expect(await db.livraison.count({ where: { reference: bl.numeroBl } })).toBe(0)
  })
})
