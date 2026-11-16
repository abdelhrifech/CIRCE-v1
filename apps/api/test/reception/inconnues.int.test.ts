// REC-P07 — réceptions inconnues (ECR-REC-04, ECR-REC-08) : RG-REC-095 à 120.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AlertesSchema,
  CandidatsSchema,
  InconnueCreeeSchema,
  InconnuesSchema,
  SuggestionsIntitulesSchema,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  ligne,
  photo,
  post,
  site,
} from '../support/reception.ts'
import { statutInconnueDe } from '../../src/modules/reception/inconnues.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

type Site = Awaited<ReturnType<typeof site>>

async function formulaire(s: Site, surcharge: Record<string, unknown> = {}) {
  return {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    annonceur: 'Lu sur affiche',
    theme: 'Description',
    imprimeurId: null,
    quantite: 12,
    allee: 'x',
    rayon: '4',
    photoAfficheId: null,
    photoBlId: await photo(ctx, s.headers),
    sansBl: false,
    numeroBl: 'BL-INC',
    ...surcharge,
  }
}

async function inconnue(s: Site, surcharge: Record<string, unknown> = {}) {
  const r = await post(ctx, '/api/receptions-inconnues', s.headers, await formulaire(s, surcharge))
  if (r.statusCode !== 201) throw new Error(r.body)
  return InconnueCreeeSchema.parse(r.json())
}

describe('REC-P07 Création', () => {
  it('RG-REC-099 crée une réception À identifier hors sas, une affiche ORPHELINE (feuille temporaire), un mouvement', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    expect(c.message).toBe(
      `Réception inconnue R${String(c.receptionId)} : affiche ${String(c.afficheId)} rangée en X-4. La Coordination est prévenue (Pilotage › Alertes).`,
    )
    expect(await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).toMatchObject({
      statut: 'A_IDENTIFIER',
      estInconnue: true,
    })
    expect(await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).toMatchObject({
      statut: 'ORPHELINE',
      typeFeuille: 'TEMPORAIRE',
      allee: 'X',
      rayon: '4',
      contAnnonc: 'Lu sur affiche',
    })
    expect(await db.mouvement.findMany({ where: { afficheId: c.afficheId } })).toMatchObject([
      { type: 'RECEPTION', quantite: 12 },
    ])
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(c.receptionId), action: 'CREATION_RECEPTION_INCONNUE' },
      }),
    ).toBe(1)
  })

  it.each([[0], [-3]])('RG-REC-096 refuse une quantité comptée de %i (422)', async (q) => {
    const s = await site(ctx)
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaire(s, { quantite: q }),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_QTE_INCONNUE_OBLIGATOIRE', regle: 'RG-REC-096' })
  })

  it('RG-REC-097 refuse une allée ou un rayon vide (422)', async () => {
    const s = await site(ctx)
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaire(s, { rayon: '' }),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      code: 'REC_ALLEE_RAYON_INCONNUE_OBLIGATOIRES',
      regle: 'RG-REC-097',
    })
  })

  it('RG-REC-098 photo du BL obligatoire sauf palette sans BL', async () => {
    const s = await site(ctx)
    const refus = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaire(s, { photoBlId: null }),
    )
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus).regle).toBe('RG-REC-098')
    const c = await inconnue(s, { photoBlId: null, sansBl: true })
    const rec = await db.reception.findUniqueOrThrow({
      where: { id: c.receptionId },
      include: { livraison: true },
    })
    expect(rec.livraison?.reference).toBe('Sans BL')
  })

  it('RG-REC-117 rien n’est écrit si un contrôle échoue', async () => {
    const s = await site(ctx)
    const avant = await db.affiche.count({ where: { plateformeId: s.plateforme.id } })
    await post(ctx, '/api/receptions-inconnues', s.headers, await formulaire(s, { quantite: 0 }))
    expect(await db.affiche.count({ where: { plateformeId: s.plateforme.id } })).toBe(avant)
  })

  it.each([['cheq'], ['com']] as const)(
    'RG-REC-002 le profil %s ne crée pas de réception inconnue (403)',
    async (role) => {
      const s = await site(ctx)
      const intrus = await autre(ctx, s.plateforme.id, [role])
      const r = await post(ctx, '/api/receptions-inconnues', intrus.headers, await formulaire(s))
      expect(r.statusCode).toBe(403)
    },
  )

  it('RG-REC-001 refuse la création sur un site hors périmètre (403)', async () => {
    const s = await site(ctx)
    const ailleurs = await f.createPlateforme(db)
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaire(s, { plateformeId: ailleurs.id }),
    )
    expect(r.statusCode).toBe(403)
  })

  it('RG-REC-100 suggère les intitulés de l’autre plateforme dès 3 caractères', async () => {
    const s = await site(ctx)
    const autreSite = await f.createPlateforme(db)
    const marque = `Marque${String(Date.now())}`
    await f.createAffiche(db, {
      plateformeId: autreSite.id,
      contAnnonc: marque,
      theme: 'Thème Wissous',
    })
    const url = (a: string) =>
      `/api/receptions-inconnues/suggestions?plateformeId=${String(s.plateforme.id)}&annonceur=${encodeURIComponent(a)}`
    expect(
      SuggestionsIntitulesSchema.parse((await get(ctx, url('Ma'), s.headers)).json()).suggestions,
    ).toEqual([])
    const r = SuggestionsIntitulesSchema.parse((await get(ctx, url(marque), s.headers)).json())
    expect(r.suggestions).toMatchObject([{ intitule: 'Thème Wissous', site: autreSite.nom }])
  })
})

describe('REC-P07 Liste', () => {
  it('RG-REC-102 statuts calculés', () => {
    const base = {
      liensActifs: 0,
      signaleLe: null,
      statutReception: 'A_IDENTIFIER' as const,
      typeFeuille: 'TEMPORAIRE' as const,
      feuilleARefaire: false,
    }
    expect(statutInconnueDe(base)).toBe('A_IDENTIFIER')
    expect(statutInconnueDe({ ...base, signaleLe: new Date() })).toBe('INTROUVABLE')
    expect(statutInconnueDe({ ...base, liensActifs: 1, statutReception: 'A_CONTROLER' })).toBe(
      'RATTACHEE_A_CONTROLER',
    )
    expect(
      statutInconnueDe({
        ...base,
        liensActifs: 1,
        statutReception: 'CONTROLEE',
        feuilleARefaire: true,
      }),
    ).toBe('CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER')
    expect(
      statutInconnueDe({
        ...base,
        liensActifs: 1,
        statutReception: 'CONTROLEE',
        typeFeuille: 'DEFINITIVE',
      }),
    ).toBe('RATTACHEE_FEUILLE_DEFINITIVE')
  })

  it('RG-REC-101 / RG-REC-102 / RG-REC-103 liste du site, filtre par défaut sans « Rattachée, feuille définitive », attente et retard', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    await db.reception.update({
      where: { id: c.receptionId },
      data: { dateArrivee: new Date(Date.now() - 30 * 3_600_000) },
    })
    const r = await get(ctx, '/api/receptions-inconnues', s.headers)
    expect(r.statusCode).toBe(200)
    const liste = InconnuesSchema.parse(r.json())
    expect(liste.filtreStatut).not.toContain('RATTACHEE_FEUILLE_DEFINITIVE')
    expect(liste.items).toHaveLength(1)
    expect(liste.items[0]).toMatchObject({
      afficheId: c.afficheId,
      statut: 'A_IDENTIFIER',
      enRetard: true,
      emplacement: 'X-4',
      quantite: 12,
    })
    const filtree = InconnuesSchema.parse(
      (await get(ctx, '/api/receptions-inconnues?statut=INTROUVABLE', s.headers)).json(),
    )
    expect(filtree.items).toHaveLength(0)
  })

  it.each([['cheq'], ['com']] as const)(
    'RG-REC-002 le profil %s ne consulte pas les réceptions inconnues (403)',
    async (role) => {
      const s = await site(ctx)
      const intrus = await autre(ctx, s.plateforme.id, [role])
      expect((await get(ctx, '/api/receptions-inconnues', intrus.headers)).statusCode).toBe(403)
    },
  )
})

describe('REC-P07 Identifier et rattacher', () => {
  it('RG-REC-105 cherche des dossiers (≥ 2 caractères) sur le site de l’affiche', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id, { annonceur: 'Zorglub' })
    await ligne(ctx, (await f.createPlateforme(db)).id, { annonceur: 'Zorglub' })
    const court = await get(ctx, `/api/affiches/${String(c.afficheId)}/candidats?q=Z`, s.headers)
    expect(court.statusCode).toBe(400)
    expect(erreur(court).regle).toBe('RG-REC-105')
    const r = CandidatsSchema.parse(
      (await get(ctx, `/api/affiches/${String(c.afficheId)}/candidats?q=zorg`, s.headers)).json(),
    )
    expect(r.candidats.map((x) => x.ligneAttendueId)).toEqual([l.id])
    const parDossier = CandidatsSchema.parse(
      (
        await get(
          ctx,
          `/api/affiches/${String(c.afficheId)}/candidats?q=${String(l.contNum)}`,
          s.headers,
        )
      ).json(),
    )
    expect(parDossier.candidats[0]?.ligneAttendueId).toBe(l.id)
  })

  it('RG-REC-109 / RG-REC-110 / RG-REC-120 rattacher par la réception : IDENTIFIEE, palette dans le sas, annonceur du dossier, « à confirmer »', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id, {
      annonceur: 'VRAI ANNONCEUR',
      theme: 'Vrai thème',
    })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await post(
      ctx,
      `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
      s.headers,
      { version: a.version, lignes: [{ ligneAttendueId: l.id, quantite: 12 }] },
    )
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ validee: false })
    const apres = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    expect(apres).toMatchObject({
      statut: 'IDENTIFIEE',
      contAnnonc: 'VRAI ANNONCEUR',
      theme: 'Vrai thème',
      feuilleARefaire: true,
      validationAdmin: false,
      modeRattachement: 'MAIN',
    })
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    expect(rec.statut).toBe('A_CONTROLER')
    expect(rec.aControlerDepuis).not.toBeNull()
    expect(
      InconnuesSchema.parse((await get(ctx, '/api/receptions-inconnues', s.headers)).json())
        .items[0]?.statut,
    ).toBe('RATTACHEE_A_CONTROLER')
  })

  it('RG-REC-110 le libellé saisi est gardé si les IP ne sont pas saisies', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id, { annonceur: 'X', theme: null, themeCle: null })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await post(ctx, `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 5 }],
    })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).theme).toBe(
      'Description',
    )
  })

  it('RG-REC-111 rattacher par la Coordination vaut validation admin', async () => {
    const s = await site(ctx, ['coord'])
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await post(
      ctx,
      `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
      s.headers,
      { version: a.version, lignes: [{ ligneAttendueId: l.id, quantite: 3 }] },
    )
    expect(r.json()).toMatchObject({ validee: true })
    expect(await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).toMatchObject({
      validationAdmin: true,
      validationAdminParId: s.user.id,
    })
  })

  it('RG-REC-107 refuse sans dossier ou avec une quantité 0 (422)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    for (const lignes of [[], [{ ligneAttendueId: l.id, quantite: 0 }]]) {
      const r = await post(
        ctx,
        `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
        s.headers,
        { version: a.version, lignes },
      )
      expect(r.statusCode).toBe(422)
      expect(erreur(r)).toMatchObject({ code: 'REC_RATTACHER_SANS_DOSSIER', regle: 'RG-REC-107' })
    }
  })

  it('RG-REC-107 refuse une affiche qui n’est pas orpheline (409)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await post(ctx, `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    const b = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await post(
      ctx,
      `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
      s.headers,
      { version: b.version, lignes: [{ ligneAttendueId: l.id, quantite: 2 }] },
    )
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-107')
  })

  it('RG-REC-108 refuse une répartition supérieure à la quantité reçue (422) ; inférieure permise', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const trop = await post(
      ctx,
      `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
      s.headers,
      {
        version: a.version,
        lignes: [
          { ligneAttendueId: l1.id, quantite: 8 },
          { ligneAttendueId: l2.id, quantite: 5 },
        ],
      },
    )
    expect(trop.statusCode).toBe(422)
    expect(erreur(trop)).toMatchObject({ code: 'REC_REPARTITION_DEPASSE', regle: 'RG-REC-108' })
    const ok = await post(
      ctx,
      `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
      s.headers,
      {
        version: a.version,
        lignes: [
          { ligneAttendueId: l1.id, quantite: 6 },
          { ligneAttendueId: l2.id, quantite: 5 },
        ],
      },
    )
    expect(ok.statusCode).toBe(200)
    expect(await db.afficheAttendue.count({ where: { afficheId: c.afficheId, actif: true } })).toBe(
      2,
    )
  })

  it.each([['cheq'], ['com']] as const)(
    'RG-REC-118 le profil %s ne rattache pas (403)',
    async (role) => {
      const s = await site(ctx)
      const c = await inconnue(s)
      const l = await ligne(ctx, s.plateforme.id)
      const intrus = await autre(ctx, s.plateforme.id, [role])
      const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
      const r = await post(
        ctx,
        `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
        intrus.headers,
        { version: a.version, lignes: [{ ligneAttendueId: l.id, quantite: 1 }] },
      )
      expect(r.statusCode).toBe(403)
    },
  )

  it('RG-REC-114 retirer le dernier dossier renvoie l’affiche en réception inconnue À identifier', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await post(ctx, `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: c.afficheId, actif: true },
    })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
      lienVersion: lien.version,
    })
    expect(r.statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).statut).toBe(
      'ORPHELINE',
    )
    expect((await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).statut).toBe(
      'A_IDENTIFIER',
    )
  })
})

describe('REC-P07 Signaler « Dossier introuvable »', () => {
  it('RG-REC-112 signale (date posée, journal) ; statut Introuvable ; une seule fois (409)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    const r = await post(ctx, `/api/affiches/${String(c.afficheId)}/signaler`, s.headers, {
      receptionVersion: rec.version,
    })
    expect(r.statusCode).toBe(200)
    expect(
      (await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).signaleLe,
    ).not.toBeNull()
    expect(
      InconnuesSchema.parse((await get(ctx, '/api/receptions-inconnues', s.headers)).json())
        .items[0]?.statut,
    ).toBe('INTROUVABLE')
    const bis = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    const r2 = await post(ctx, `/api/affiches/${String(c.afficheId)}/signaler`, s.headers, {
      receptionVersion: bis.version,
    })
    expect(r2.statusCode).toBe(409)
    expect(erreur(r2)).toMatchObject({ code: 'REC_SIGNALEMENT_INTERDIT', regle: 'RG-REC-112' })
  })

  it('RG-REC-112 une affiche introuvable reste rattachable (§3.2)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    await post(ctx, `/api/affiches/${String(c.afficheId)}/signaler`, s.headers, {
      receptionVersion: rec.version,
    })
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await post(
      ctx,
      `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`,
      s.headers,
      { version: a.version, lignes: [{ ligneAttendueId: l.id, quantite: 1 }] },
    )
    expect(r.statusCode).toBe(200)
  })

  it('RG-REC-002 le profil com ne signale pas (403)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const intrus = await autre(ctx, s.plateforme.id, ['com'])
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    expect(
      (
        await post(ctx, `/api/affiches/${String(c.afficheId)}/signaler`, intrus.headers, {
          receptionVersion: rec.version,
        })
      ).statusCode,
    ).toBe(403)
  })
})

describe('REC-P07 Affiche redevenue orpheline d’une palette normale (RG-REC-114, HYPOTHÈSE Q-180)', () => {
  async function paletteDeDeux(s: Site) {
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 4 },
      { ligneAttendueId: l2.id, quantite: 4 },
    ])
    const r = await post(ctx, '/api/receptions', s.headers, bl)
    const body = r.json<{
      receptionId: number
      affiches: { id: number; ligneAttendueId: number }[]
    }>()
    const a1 = body.affiches.find((a) => a.ligneAttendueId === l1.id)?.id ?? 0
    const a2 = body.affiches.find((a) => a.ligneAttendueId === l2.id)?.id ?? 0
    return { receptionId: body.receptionId, a1, a2, l1 }
  }

  it('RG-REC-114 l’affiche orpheline apparaît dans les réceptions inconnues et se rattache ; la palette reste À contrôler', async () => {
    const s = await site(ctx)
    const p = await paletteDeDeux(s)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.a1, actif: true },
    })
    expect(
      (
        await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
          lienVersion: lien.version,
        })
      ).statusCode,
    ).toBe(200)
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
    const liste = InconnuesSchema.parse(
      (await get(ctx, '/api/receptions-inconnues', s.headers)).json(),
    )
    expect(liste.items.map((i) => i.afficheId)).toEqual([p.a1])
    expect(liste.items[0]?.statut).toBe('A_IDENTIFIER')
    const a = await db.affiche.findUniqueOrThrow({ where: { id: p.a1 } })
    const r = await post(ctx, `/api/affiches/${String(p.a1)}/rattacher-inconnue`, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: p.l1.id, quantite: 4 }],
    })
    expect(r.statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: p.a1 } })).statut).toBe('IDENTIFIEE')
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
  })

  it('RG-REC-114 la réception ne redevient À identifier que lorsque sa dernière affiche perd son dossier', async () => {
    const s = await site(ctx)
    const p = await paletteDeDeux(s)
    for (const afficheId of [p.a1, p.a2]) {
      const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
      await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
        lienVersion: lien.version,
      })
      const attendu = afficheId === p.a1 ? 'A_CONTROLER' : 'A_IDENTIFIER'
      expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
        attendu,
      )
    }
  })

  it('RG-REC-185 une réception normale redevenue À identifier lève l’alerte « Réception inconnue à identifier »', async () => {
    const s = await site(ctx)
    const p = await paletteDeDeux(s)
    for (const afficheId of [p.a1, p.a2]) {
      const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
      await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
        lienVersion: lien.version,
      })
    }
    const { alertes } = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    )
    expect(alertes.map((x) => x.cle)).toContain(`RG-REC-185:${String(p.receptionId)}`)
  })

  it('RG-REC-107 une affiche encore rattachée d’une palette normale n’est pas rattachable comme inconnue (409)', async () => {
    const s = await site(ctx)
    const p = await paletteDeDeux(s)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: p.a2 } })
    const r = await post(ctx, `/api/affiches/${String(p.a2)}/rattacher-inconnue`, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: p.l1.id, quantite: 1 }],
    })
    expect(r.statusCode).toBe(409)
  })
})

describe('REC-P08 Recherche de dossiers triée (RG-REC-136)', () => {
  it('RG-REC-136 tri=reste : propositions par reste décroissant, limitées par max', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const marque = `Tri${String(Date.now())}`
    const petit = await ligne(ctx, s.plateforme.id, { annonceur: marque, qteBc: 2 })
    const grand = await ligne(ctx, s.plateforme.id, { annonceur: marque, qteBc: 50 })
    await ligne(ctx, s.plateforme.id, { annonceur: marque, qteBc: 10 })
    const r = CandidatsSchema.parse(
      (
        await get(
          ctx,
          `/api/affiches/${String(c.afficheId)}/candidats?q=${marque}&tri=reste&max=2`,
          s.headers,
        )
      ).json(),
    )
    expect(r.candidats.map((x) => x.ligneAttendueId)).toEqual([grand.id, expect.any(Number)])
    expect(r.candidats.map((x) => x.ligneAttendueId)).not.toContain(petit.id)
  })

  it('RG-REC-136 refuse un max hors bornes (400)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    expect(
      (await get(ctx, `/api/affiches/${String(c.afficheId)}/candidats?q=ab&max=99`, s.headers))
        .statusCode,
    ).toBe(400)
  })
})
