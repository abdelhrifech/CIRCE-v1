// ÉTAPE 7 — CONCURRENCE entre Réception et Coordination (cellules K-nn de la matrice d'impact) : actions
// SIMULTANÉES (Promise.all de requêtes réelles sur l'API) sur une réception et la coordination liée →
// un seul gagnant, l'autre 409 (version / transition), aucun état incohérent. Verrou optimiste (`version`),
// transaction unique par action, double soumission (Idempotency-Key). Sources : CLAUDE.md §6, RG-X-028,
// RG-X-050, 051, 054, 058, 063, 065.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { withTransaction } from '../../src/core/transaction.ts'
import { annulerDossier } from '../../src/modules/coordination/integration.ts'
import {
  affiche,
  fiche,
  inconnue,
  monde,
  mouvements,
  nouvelleLigne,
  receptionDe,
  recevoir,
  stock,
  valider,
  type Monde,
} from '../support/interactions.ts'
import { bonDeLivraison, contexteReception, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const codes = (rs: { statusCode: number }[]) => rs.map((r) => r.statusCode).sort((a, b) => a - b)
const journal = (typeEntite: 'AFFICHE' | 'DOSSIER', id: number | string, action: string) =>
  db.journalAudit.count({ where: { typeEntite, entiteId: String(id), action: action as never } })

async function controler(m: Monde, receptionId: number) {
  const lec = (
    await ctx.app.inject({
      method: 'GET',
      url: `/api/receptions/${String(receptionId)}/controle`,
      headers: m.headers,
    })
  ).json<{ version: number; lignes: { afficheId: number; quantiteBl: number }[] }>()
  return post(ctx, `/api/receptions/${String(receptionId)}/controle`, m.headers, {
    version: lec.version,
    controleurId: m.user.id,
    lignes: lec.lignes.map((l) => ({
      afficheId: l.afficheId,
      qteComptee: l.quantiteBl,
      allee: 'a',
      rayon: '3',
    })),
  })
}

describe('K-01 / K-02 deux coordinateurs sur la même affiche (RG-X-050, RG-COO-008)', () => {
  it('K-01 deux validations simultanées (même version) : un 200, un 409 ; une seule trace, un seul « par / le »', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    const v = (await affiche(ctx, rv.afficheId)).version
    const rs = await Promise.all([
      valider(ctx, m.coord.headers, rv.afficheId, true, v),
      valider(ctx, m.admin.headers, rv.afficheId, true, v),
    ])
    expect(codes(rs)).toEqual([200, 409])
    expect(await journal('AFFICHE', rv.afficheId, 'VALIDATION_ADMIN')).toBe(1)
    const a = await affiche(ctx, rv.afficheId)
    expect(a).toMatchObject({ validationAdmin: true, version: v + 1 })
    expect([m.coord.user.id, m.admin.user.id]).toContain(a.validationAdminParId)
  })

  it('K-02 deux annulations simultanées de la même validation : un 200, un 409 ; validation annulée une seule fois, stock inchangé', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const v = (await affiche(ctx, rv.afficheId)).version
    const avant = (await mouvements(ctx, rv.afficheId)).length
    const rs = await Promise.all([
      valider(ctx, m.coord.headers, rv.afficheId, false, v),
      valider(ctx, m.admin.headers, rv.afficheId, false, v),
    ])
    expect(codes(rs)).toEqual([200, 409])
    expect(await journal('AFFICHE', rv.afficheId, 'ANNULATION_VALIDATION_ADMIN')).toBe(1)
    expect((await mouvements(ctx, rv.afficheId)).length).toBe(avant)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      validationAdmin: false,
      validationAnnulee: true,
    })
  })

  it('K-02 valider ∥ annuler la validation sur une affiche validée : l’état final est celui du dernier commit, jamais mixte (par/le cohérents avec le booléen)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const v = (await affiche(ctx, rv.afficheId)).version
    const rs = await Promise.all([
      valider(ctx, m.coord.headers, rv.afficheId, false, v),
      valider(ctx, m.admin.headers, rv.afficheId, true, v),
    ])
    expect(codes(rs).filter((c) => c === 200).length).toBeLessThanOrEqual(1)
    const a = await affiche(ctx, rv.afficheId)
    expect(a.validationAdmin).toBe(a.validationAdminParId !== null)
    expect(a.validationAdmin).toBe(a.validationAdminLe !== null)
  })
})

describe('K-03 valider ∥ retirer le dernier dossier (RG-X-058, RG-X-063)', () => {
  it('K-03 jamais d’affiche ORPHELINE validée : validation et retrait simultanés, un seul ordre gagne, palette cohérente', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    const v = (await affiche(ctx, rv.afficheId)).version
    const rs = await Promise.all([
      valider(ctx, m.coord.headers, rv.afficheId, true, v),
      post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, m.headers, {
        lienVersion: lien.version,
      }),
    ])
    for (const r of rs) expect([200, 409]).toContain(r.statusCode)
    // Au moins un gagnant : jamais deux refus (les deux requêtes portent des versions valides au départ).
    expect(codes(rs)).toContain(200)
    const a = await affiche(ctx, rv.afficheId)
    const rec = await receptionDe(ctx, rv.receptionId)
    if (a.statut === 'ORPHELINE') {
      expect(a.validationAdmin).toBe(false)
      expect(rec.statut).toBe('A_IDENTIFIER')
      expect(await db.afficheAttendue.count({ where: { afficheId: a.id, actif: true } })).toBe(0)
    } else {
      expect(await db.afficheAttendue.count({ where: { afficheId: a.id, actif: true } })).toBe(1)
      expect(rec.statut).toBe('A_CONTROLER')
    }
    expect(await stock(ctx, rv.afficheId)).toBe(5)
  })
})

// L'annulation d'un dossier n'a pas de route HTTP : elle n'arrive que par le flux d'intégration Broadcast
// (`annulerDossier`, appelé par `integration-flux.ts`). La course est donc jouée entre la requête HTTP de
// réception et l'appel du service d'annulation, dans sa propre transaction.
describe('K-04 réception ∥ annulation du dossier (RG-X-065, RG-REC-014)', () => {
  it('K-04 la réception réussit (puis la ligne annulée est signalée) ou est refusée sans RIEN écrire ; jamais d’affiche sur une ligne sans alerte', async () => {
    const m = await monde(ctx)
    const l = await nouvelleLigne(ctx, m, { theme: 'Course' })
    const bl = await bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 3 }])
    const [r] = await Promise.all([
      post(ctx, '/api/receptions', m.headers, bl),
      withTransaction(db, (tx) => annulerDossier(tx, m.dossier.contNum)),
    ])
    expect([201, 422, 409]).toContain(r.statusCode)
    const affiches = await db.affiche.count({ where: { plateformeId: m.plateforme.id } })
    if (r.statusCode === 201) {
      expect(affiches).toBe(1)
      expect((await fiche(ctx, m)).aReRattacher).toHaveLength(1)
    } else {
      expect(affiches).toBe(0)
      expect(await db.reception.count({ where: { plateformeId: m.plateforme.id } })).toBe(0)
      expect(await db.livraison.count({ where: { reference: bl.numeroBl } })).toBe(0)
    }
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).etatLigne).toBe(
      'ANNULEE',
    )
  })
})

describe('K-05 « Valider la sélection » en double (RG-COO-010, Q-203)', () => {
  it('K-05 deux lots identiques simultanés : chaque affiche est confirmée UNE fois (l’autre lot l’ignore), une seule trace par affiche', async () => {
    const m = await monde(ctx)
    const a1 = await recevoir(ctx, m, 2, { theme: 'T1' })
    const a2 = await recevoir(ctx, m, 2, { theme: 'T2' })
    const rs = await Promise.all([
      post(ctx, '/api/coordination/validation-admin', m.coord.headers, {
        dossierIds: [m.dossier.id],
      }),
      post(ctx, '/api/coordination/validation-admin', m.admin.headers, {
        dossierIds: [m.dossier.id],
      }),
    ])
    for (const r of rs) expect([200, 409, 422]).toContain(r.statusCode)
    for (const rv of [a1, a2]) {
      expect(await journal('AFFICHE', rv.afficheId, 'VALIDATION_ADMIN')).toBe(1)
      expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(true)
    }
  })
})

describe('K-06 double soumission (Idempotency-Key)', () => {
  it('K-06 même clé envoyée deux fois en parallèle : un seul effet (une validation, une trace), réponses identiques', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 4)
    const cle = idem()
    const v = (await affiche(ctx, rv.afficheId)).version
    const rs = await Promise.all([
      valider(ctx, m.coord.headers, rv.afficheId, true, v, cle),
      valider(ctx, m.coord.headers, rv.afficheId, true, v, cle),
    ])
    for (const r of rs) expect([200, 409]).toContain(r.statusCode)
    expect(rs.some((r) => r.statusCode === 200)).toBe(true)
    // Réponses identiques : toute réponse 200 est le MÊME résultat rejoué (même corps).
    const ok = rs.filter((r) => r.statusCode === 200)
    for (const r of ok) expect(r.json()).toEqual(ok[0]?.json())
    expect(await journal('AFFICHE', rv.afficheId, 'VALIDATION_ADMIN')).toBe(1)
    expect((await affiche(ctx, rv.afficheId)).version).toBe(v + 1)
  })

  it('K-06 réception : le même BL soumis deux fois avec la même clé crée UNE réception, UNE affiche, UN mouvement', async () => {
    const m = await monde(ctx)
    const l = await nouvelleLigne(ctx, m, { theme: 'Double' })
    const bl = await bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 3 }])
    const cle = idem()
    const envoi = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/receptions',
        headers: { ...m.headers, ...cle },
        payload: bl,
      })
    const rs = await Promise.all([envoi(), envoi()])
    for (const r of rs) expect([201, 409]).toContain(r.statusCode)
    expect(await db.reception.count({ where: { plateformeId: m.plateforme.id } })).toBe(1)
    expect(await db.affiche.count({ where: { plateformeId: m.plateforme.id } })).toBe(1)
    expect(
      await db.mouvement.count({ where: { affiche: { plateformeId: m.plateforme.id } } }),
    ).toBe(1)
  })
})

describe('K-07 rattacher ∥ signaler une réception inconnue (RG-X-051, RG-X-054)', () => {
  it('K-07 un seul gagnant ; l’état final est cohérent (rattachée À contrôler, ou signalée À identifier)', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 5)
    const l = await nouvelleLigne(ctx, m, { theme: 'Cible' })
    const a = await affiche(ctx, inc.afficheId)
    const rec = await receptionDe(ctx, inc.receptionId)
    const rs = await Promise.all([
      post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, m.coord.headers, {
        version: a.version,
        lignes: [{ ligneAttendueId: l.id, quantite: 5 }],
      }),
      post(ctx, `/api/affiches/${String(a.id)}/signaler`, m.coord.headers, {
        receptionVersion: rec.version,
      }),
    ])
    for (const r of rs) expect([200, 409, 422]).toContain(r.statusCode)
    const apres = await affiche(ctx, a.id)
    const liens = await db.afficheAttendue.count({ where: { afficheId: a.id, actif: true } })
    const recFin = await receptionDe(ctx, inc.receptionId)
    if (liens === 1) {
      expect(apres.statut).toBe('IDENTIFIEE')
      expect(recFin.statut).toBe('A_CONTROLER')
    } else {
      expect(apres.statut).toBe('ORPHELINE')
      expect(recFin.statut).toBe('A_IDENTIFIER')
    }
    expect(await stock(ctx, a.id)).toBe(5)
  })

  it('K-07 deux rattachements simultanés de la même inconnue : un 200, un 409 ; un seul jeu de liens (Σ = quantité reçue)', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 5)
    const l1 = await nouvelleLigne(ctx, m, { theme: 'C1' })
    const l2 = await nouvelleLigne(ctx, m, { theme: 'C2' })
    const a = await affiche(ctx, inc.afficheId)
    const rs = await Promise.all([
      post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, m.coord.headers, {
        version: a.version,
        lignes: [{ ligneAttendueId: l1.id, quantite: 5 }],
      }),
      post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, m.admin.headers, {
        version: a.version,
        lignes: [{ ligneAttendueId: l2.id, quantite: 5 }],
      }),
    ])
    expect(codes(rs)).toEqual([200, 409])
    expect(
      (
        await db.afficheAttendue.aggregate({
          where: { afficheId: a.id, actif: true },
          _sum: { quantite: true },
        })
      )._sum.quantite,
    ).toBe(5)
  })
})

describe('K-08 contrôle ∥ validation admin : circuits indépendants (RG-X-028)', () => {
  it('K-08 le contrôle (Réception) et la validation (Coordination) simultanés aboutissent TOUS LES DEUX, dans n’importe quel ordre', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 6)
    const rs = await Promise.all([
      controler(m, rv.receptionId),
      valider(ctx, m.coord.headers, rv.afficheId, true),
    ])
    expect(codes(rs)).toEqual([200, 200])
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('CONTROLEE')
    expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(true)
    expect(await stock(ctx, rv.afficheId)).toBe(6)
  })
})

describe('K-09 deux réceptions simultanées sur la même ligne (RG-X-004, RG-X-060)', () => {
  it('K-09 la ligne est recalculée sur le total reçu : Σ stock des affiches = Σ liens actifs = quantités acceptées', async () => {
    const m = await monde(ctx)
    const l = await nouvelleLigne(ctx, m, { theme: 'Deux livraisons', qteBc: 20 })
    const [bl1, bl2] = await Promise.all([
      bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 8 }]),
      bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 7 }]),
    ])
    const rs = await Promise.all([
      post(ctx, '/api/receptions', m.headers, bl1),
      post(ctx, '/api/receptions', m.headers, bl2),
    ])
    for (const r of rs) expect([201, 409]).toContain(r.statusCode)
    expect(rs.some((r) => r.statusCode === 201)).toBe(true)
    const affiches = await db.affiche.findMany({ where: { plateformeId: m.plateforme.id } })
    let totalStock = 0
    for (const a of affiches) totalStock += await stock(ctx, a.id)
    const liens = await db.afficheAttendue.aggregate({
      where: { ligneAttendueId: l.id, actif: true },
      _sum: { quantite: true },
    })
    expect(liens._sum.quantite).toBe(totalStock)
    const attendu = rs.reduce((s, r, k) => s + (r.statusCode === 201 ? ([8, 7][k] ?? 0) : 0), 0)
    expect(totalStock).toBe(attendu)
    const statut = (await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut
    expect(statut).toBe(attendu >= 20 ? 'COMPLETE' : 'PARTIELLE')
  })
})
