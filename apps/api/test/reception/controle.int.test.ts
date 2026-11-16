// REC-P05 — sas et contrôle de la palette (ECR-REC-02) : RG-REC-053 à 072.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ControleSchema, ControleValideSchema, SasSchema } from '@circe/shared'
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
import { retardDe } from '../../src/modules/reception/controle.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

async function palette(qte = 10) {
  const s = await site(ctx)
  const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, qte)
  return { ...s, ...rv }
}

async function controle(p: Awaited<ReturnType<typeof palette>>) {
  return ControleSchema.parse(
    (await get(ctx, `/api/receptions/${String(p.receptionId)}/controle`, p.headers)).json(),
  )
}

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
      allee: 'b',
      rayon: '7',
      ...surcharge,
    })),
  }
}

describe('REC-P05 Sas', () => {
  it('RG-REC-053 le sas liste les réceptions À contrôler du site, avec quantité du BL et nombre d’affiches', async () => {
    const p = await palette(6)
    const r = await get(
      ctx,
      `/api/receptions/sas?q=${encodeURIComponent(p.bl.numeroBl)}`,
      p.headers,
    )
    expect(r.statusCode).toBe(200)
    const sas = SasSchema.parse(r.json())
    expect(sas.palettes).toHaveLength(1)
    expect(sas.palettes[0]).toMatchObject({
      receptionId: p.receptionId,
      nombreAffiches: 1,
      quantiteBl: 6,
      retard: 'NON',
      bl: p.bl.numeroBl,
    })
  })

  it('RG-REC-071 une réception inconnue À identifier n’est pas dans le sas', async () => {
    const s = await site(ctx)
    const rec = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
    })
    const sas = SasSchema.parse((await get(ctx, '/api/receptions/sas', s.headers)).json())
    expect(sas.palettes.map((x) => x.receptionId)).not.toContain(rec.id)
  })

  it('RG-REC-055 retard au-delà du délai, « double » au-delà de 2 × le délai', () => {
    expect(retardDe(24 * 60, 24)).toBe('NON')
    expect(retardDe(24 * 60 + 1, 24)).toBe('RETARD')
    expect(retardDe(48 * 60 + 1, 24)).toBe('DOUBLE')
  })

  it('RG-REC-001 le contrôle d’une palette hors périmètre est refusé (403)', async () => {
    const p = await palette()
    const intrus = await site(ctx)
    expect(
      (await get(ctx, `/api/receptions/${String(p.receptionId)}/controle`, intrus.headers))
        .statusCode,
    ).toBe(403)
  })
})

describe('REC-P05 Valider le contrôle', () => {
  it('RG-REC-069 / RG-REC-062 contrôle conforme : réception CONTROLEE, contrôleur, emplacement en majuscules, historique', async () => {
    const p = await palette(10)
    const c = await controle(p)
    expect(c.lignes).toHaveLength(1)
    expect(c.lectureSeule).toBe(false)
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(c, p.user.id),
    )
    expect(r.statusCode).toBe(200)
    ControleValideSchema.parse(r.json())
    const rec = await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })
    expect(rec).toMatchObject({ statut: 'CONTROLEE', controleurId: p.user.id })
    expect(rec.controleLe).not.toBeNull()
    expect(await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })).toMatchObject({
      allee: 'B',
      rayon: '7',
    })
    const j = await db.journalAudit.findMany({
      where: {
        typeEntite: 'AFFICHE',
        entiteId: String(p.afficheId),
        action: 'MODIFICATION_EMPLACEMENT',
      },
    })
    expect(j[0]).toMatchObject({
      ancienneValeur: '—-—',
      nouvelleValeur: 'B-7',
      complement: 'sortie de la zone tampon',
    })
    // RG-REC-070 : lecture seule ensuite.
    expect((await controle(p)).lectureSeule).toBe(true)
  })

  it('RG-REC-059 un écart au BL crée un mouvement « Écart de contrôle » signé et ajuste le reçu', async () => {
    const p = await palette(10)
    const c = await controle(p)
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(c, p.user.id, { qteComptee: 8 }),
    )
    expect(r.statusCode).toBe(200)
    const m = await db.mouvement.findFirstOrThrow({
      where: { afficheId: p.afficheId, type: 'ECART_CONTROLE' },
    })
    expect(m.quantite).toBe(-2)
    expect(
      (
        await db.afficheAttendue.findFirstOrThrow({
          where: { afficheId: p.afficheId, actif: true },
        })
      ).quantite,
    ).toBe(8)
  })

  it('RG-REC-064 le rebut au contrôle est un mouvement négatif plafonné au disponible (422 au-delà)', async () => {
    const p = await palette(5)
    const c = await controle(p)
    const refus = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(c, p.user.id, { rebut: 6 }),
    )
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus)).toMatchObject({ code: 'REC_REBUT_SUPERIEUR_STOCK', regle: 'RG-REC-064' })
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
    const ok = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(c, p.user.id, { rebut: 2, nonConformite: 'AFFICHE_ABIMEE' }),
    )
    expect(ok.statusCode).toBe(200)
    const m = await db.mouvement.findFirstOrThrow({
      where: { afficheId: p.afficheId, type: 'MISE_AU_REBUT' },
    })
    expect(m.quantite).toBe(-2)
    // RG-REC-065 : non-conformité historisée.
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(p.afficheId), action: 'NON_CONFORMITE' },
      }),
    ).toBe(1)
  })

  it('RG-REC-066 refuse un surplus en entretien quand le comptage ne dépasse pas l’attendu (422)', async () => {
    const p = await palette(5)
    const c = await controle(p)
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(c, p.user.id, { surplusEntretien: 3 }),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_SURPLUS_ENTRETIEN_INVALIDE', regle: 'RG-REC-066' })
  })

  // Attendu de la ligne = 10 (qteBc) : 13 comptées → « +3 en entretien ».
  it('RG-REC-066 le surplus d’entretien est noté sur l’affiche et historisé', async () => {
    const p = await palette(5)
    const c = await controle(p)
    expect(
      (
        await post(
          ctx,
          `/api/receptions/${String(p.receptionId)}/controle`,
          p.headers,
          saisie(c, p.user.id, { qteComptee: 13, surplusEntretien: 3 }),
        )
      ).statusCode,
    ).toBe(200)
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })).surplusEntretien,
    ).toBe(3)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(p.afficheId), action: 'SURPLUS_ENTRETIEN' },
      }),
    ).toBe(1)
  })

  it('RG-REC-067 refuse le contrôle sans contrôleur (422)', async () => {
    const p = await palette()
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(await controle(p), null),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_CONTROLEUR_OBLIGATOIRE', regle: 'RG-REC-067' })
  })

  it('RG-REC-063 refuse un contrôleur qui n’est pas agent de réception du site (422)', async () => {
    const p = await palette()
    const etranger = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: (await f.createPlateforme(db)).id }],
    )
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(await controle(p), etranger.id),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-REC-063')
  })

  it('RG-REC-061 refuse une affiche sans allée ou rayon (422)', async () => {
    const p = await palette()
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(await controle(p), p.user.id, { rayon: '' }),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_ALLEE_RAYON_OBLIGATOIRES', regle: 'RG-REC-061' })
  })

  it('RG-REC-057 refuse une quantité comptée négative (400)', async () => {
    const p = await palette()
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(await controle(p), p.user.id, { qteComptee: -1 }),
    )
    expect(r.statusCode).toBe(400)
    expect(erreur(r).regle).toBe('RG-REC-057')
  })

  it('RG-REC-056 le contrôle porte sur toutes les affiches de la palette (400 sinon)', async () => {
    const p = await palette()
    const c = await controle(p)
    const r = await post(ctx, `/api/receptions/${String(p.receptionId)}/controle`, p.headers, {
      ...saisie(c, p.user.id),
      lignes: [],
    })
    expect(r.statusCode).toBe(400)
  })

  it('RG-REC-068 l’imprimeur ne se corrige que pour une réception inconnue (422)', async () => {
    const p = await palette()
    const imp = await f.createImprimeur(db)
    const r = await post(ctx, `/api/receptions/${String(p.receptionId)}/controle`, p.headers, {
      ...saisie(await controle(p), p.user.id),
      imprimeurId: imp.id,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_IMPRIMEUR_NON_MODIFIABLE', regle: 'RG-REC-068' })
  })

  it('RG-REC-070 un second contrôle est refusé (409)', async () => {
    const p = await palette()
    const c = await controle(p)
    expect(
      (
        await post(
          ctx,
          `/api/receptions/${String(p.receptionId)}/controle`,
          p.headers,
          saisie(c, p.user.id),
        )
      ).statusCode,
    ).toBe(200)
    const r = await post(
      ctx,
      `/api/receptions/${String(p.receptionId)}/controle`,
      p.headers,
      saisie(await controle(p), p.user.id),
    )
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'REC_CONTROLE_DEJA_FAIT', regle: 'RG-REC-070' })
  })

  it('RG-REC-071 une réception À identifier ne se contrôle pas (409)', async () => {
    const s = await site(ctx)
    const rec = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
    })
    const r = await post(ctx, `/api/receptions/${String(rec.id)}/controle`, s.headers, {
      version: rec.version,
      controleurId: s.user.id,
      lignes: [{ afficheId: 1, qteComptee: 1, allee: 'A', rayon: '1' }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      code: 'REC_CONTROLE_INTERDIT_A_IDENTIFIER',
      regle: 'RG-REC-071',
    })
  })

  it('RG-REC-009 une version périmée est refusée (409) et rien n’est écrit', async () => {
    const p = await palette()
    const c = await controle(p)
    const r = await post(ctx, `/api/receptions/${String(p.receptionId)}/controle`, p.headers, {
      ...saisie(c, p.user.id, { qteComptee: 3 }),
      version: c.version - 1,
    })
    expect(r.statusCode).toBe(409)
    expect(
      await db.mouvement.count({ where: { afficheId: p.afficheId, type: 'ECART_CONTROLE' } }),
    ).toBe(0)
  })

  it.each([['coord'], ['cheq'], ['com']] as const)(
    'RG-REC-002 le profil %s ne valide pas le contrôle (403)',
    async (role) => {
      const p = await palette()
      const intrus = await autre(ctx, p.plateforme.id, [role])
      const r = await post(
        ctx,
        `/api/receptions/${String(p.receptionId)}/controle`,
        intrus.headers,
        saisie(await controle(p), p.user.id),
      )
      expect(r.statusCode).toBe(403)
    },
  )
})
