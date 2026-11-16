// REC-P04 — « Valider la réception » : tests COMPLÉMENTAIRES écrits depuis RECEPTION_REGLES_METIER.md
// (RG-REC-037 à 051, RG-REC-001/002/008/009 ; §2 matrice ; §3.2 transitions). Ne duplique pas
// validation.int.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ReceptionCreeeSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
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

/** Déclencheur SQLite qui fait échouer une insertion au milieu de la transaction (RG-REC-046). */
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

describe('REC-P04 RG-REC-037 ordre des refus', () => {
  it('RG-REC-037 (1) panier vide : REC_PANIER_VIDE avant toute autre garde (photo, champs)', async () => {
    const s = await site(ctx)
    const r = await post(ctx, '/api/receptions', s.headers, {
      lignes: [],
      photoBlId: null,
      numeroBl: '',
      livreurId: null,
      imprimeurId: null,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_PANIER_VIDE')
  })

  it('RG-REC-037 (2) aucune ligne cochée : REC_AUCUNE_LIGNE_COCHEE avant photo et champs', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const r = await post(ctx, '/api/receptions', s.headers, {
      lignes: [{ ligneAttendueId: l.id, quantite: 2, cochee: false }],
      photoBlId: null,
      numeroBl: '',
      livreurId: null,
      imprimeurId: null,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_AUCUNE_LIGNE_COCHEE')
  })

  it('RG-REC-037 (3) deux plateformes : REC_BL_DEUX_PLATEFORMES avant photo et champs', async () => {
    const [p1, p2] = await Promise.all([f.createPlateforme(db), f.createPlateforme(db)])
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: p1.id }, { plateformeId: p2.id }],
    )
    const headers = devHeaders(user.identifiantExterne)
    const [l1, l2] = await Promise.all([ligne(ctx, p1.id), ligne(ctx, p2.id)])
    const r = await post(ctx, '/api/receptions', headers, {
      lignes: [
        { ligneAttendueId: l1.id, quantite: 2, cochee: true },
        { ligneAttendueId: l2.id, quantite: 2, cochee: true },
      ],
      photoBlId: null,
      numeroBl: '',
      livreurId: null,
      imprimeurId: null,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_BL_DEUX_PLATEFORMES')
  })

  it('RG-REC-037 (4) photo manquante : REC_PHOTO_BL_MANQUANTE avant les champs obligatoires', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const r = await post(ctx, '/api/receptions', s.headers, {
      lignes: [{ ligneAttendueId: l.id, quantite: 2, cochee: true }],
      photoBlId: null,
      numeroBl: '',
      livreurId: null,
      imprimeurId: null,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_PHOTO_BL_MANQUANTE')
  })

  it.each([
    ['numeroBl', { numeroBl: '   ' }],
    ['transporteur', { livreurId: null }],
    ['imprimeur', { imprimeurId: null }],
  ] as const)(
    'RG-REC-037 (5) %s absent : REC_BL_CHAMPS_OBLIGATOIRES, rien n’est écrit',
    async (_champ, surcharge) => {
      const s = await site(ctx)
      const l = await ligne(ctx, s.plateforme.id)
      const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 2 }])
      const r = await post(ctx, '/api/receptions', s.headers, { ...bl, ...surcharge })
      expect(r.statusCode).toBe(422)
      expect(erreur(r).code).toBe('REC_BL_CHAMPS_OBLIGATOIRES')
      expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    },
  )
})

describe('REC-P04 effets de « Valider la réception »', () => {
  it('RG-REC-038 la réception créée entre dans le sas (A_CONTROLER, aControlerDepuis posé, une seule réception pour le BL)', async () => {
    const s = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 3 },
      { ligneAttendueId: l2.id, quantite: 4 },
    ])
    const r = await post(ctx, '/api/receptions', s.headers, bl)
    expect(r.statusCode).toBe(201)
    const body = ReceptionCreeeSchema.parse(r.json())
    const recs = await db.reception.findMany({ where: { plateformeId: s.plateforme.id } })
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ id: body.receptionId, statut: 'A_CONTROLER' })
    expect(recs[0]?.aControlerDepuis).not.toBeNull()
    expect(body.message).toContain('étape 2')
  })

  it('RG-REC-039 une affiche créée par ligne cochée, chacune historisée « CreationAffiche »', async () => {
    const s = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 3 },
      { ligneAttendueId: l2.id, quantite: 4 },
    ])
    const body = ReceptionCreeeSchema.parse(
      (await post(ctx, '/api/receptions', s.headers, bl)).json(),
    )
    expect(body.affiches).toHaveLength(2)
    for (const a of body.affiches) {
      expect(
        await db.journalAudit.count({
          where: { typeEntite: 'AFFICHE', entiteId: String(a.id), action: 'CREATION_AFFICHE' },
        }),
      ).toBe(1)
    }
  })

  it('RG-REC-039 un complément ne recrée pas l’affiche (pas de second « CreationAffiche »)', async () => {
    const s = await site(ctx)
    const r1 = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: r1.ligne.id, quantite: 2, complementAfficheId: r1.afficheId },
    ])
    expect((await post(ctx, '/api/receptions', s.headers, bl)).statusCode).toBe(201)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(r1.afficheId), action: 'CREATION_AFFICHE' },
      }),
    ).toBe(1)
    expect(await db.affiche.count({ where: { plateformeId: s.plateforme.id } })).toBe(1)
  })

  it('RG-REC-040 NumeroLivraison = nombre d’associations + 1 (1, 2, 3)', async () => {
    const s = await site(ctx)
    const r1 = await receptionValidee(ctx, s.headers, s.plateforme.id, 2)
    for (let i = 0; i < 2; i++) {
      const bl = await bonDeLivraison(ctx, s.headers, [
        { ligneAttendueId: r1.ligne.id, quantite: 1, complementAfficheId: r1.afficheId },
      ])
      expect((await post(ctx, '/api/receptions', s.headers, bl)).statusCode).toBe(201)
    }
    const assos = await db.livraisonAffiche.findMany({
      where: { afficheId: r1.afficheId },
      orderBy: { id: 'asc' },
    })
    expect(assos.map((a) => a.numeroLivraison)).toEqual([1, 2, 3])
  })

  it('RG-REC-041 un mouvement de réception par ligne, quantité = qté du BL, rattaché à la réception', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 7)
    const mvts = await db.mouvement.findMany({ where: { afficheId: rv.afficheId } })
    expect(mvts).toHaveLength(1)
    expect(mvts[0]).toMatchObject({ type: 'RECEPTION', quantite: 7, receptionId: rv.receptionId })
    expect(mvts[0]?.createdById).not.toBeNull()
  })

  it('RG-REC-044 « affiche reçue » = oui dès l’arrivée : le mouvement de réception existe avant tout contrôle', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    expect((await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
    expect(
      await db.mouvement.count({ where: { afficheId: rv.afficheId, type: 'RECEPTION' } }),
    ).toBe(1)
  })
})

describe('REC-P04 statut de la ligne attendue (RG-REC-018 / 050 / 051)', () => {
  // Attendu = 10 (qteBc posé par le helper `ligne`) ; seuil = 10 % (valeur de référence).
  it.each([
    [9, 'PARTIELLE'],
    [10, 'COMPLETE'],
    [11, 'COMPLETE'],
    [12, 'SURPLUS'],
  ] as const)(
    'RG-REC-051 / RG-REC-050 reçu %i pour 10 attendus → %s (surplus strictement au-delà de 10 %)',
    async (qte, statut) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, qte)
      expect(
        (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).statut,
      ).toBe(statut)
    },
  )
})

describe('REC-P04 permissions (RG-REC-002, §2 « Valider la réception »)', () => {
  it('RG-REC-002 le profil recep peut valider une réception', async () => {
    const s = await site(ctx, ['recep'])
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 1 }])
    expect((await post(ctx, '/api/receptions', s.headers, bl)).statusCode).toBe(201)
  })

  it('RG-REC-002 le profil com ne valide pas une réception (403 REC_ACCES_REFUSE), rien n’est écrit', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 1 }])
    const com = await autre(ctx, s.plateforme.id, ['com'])
    const r = await post(ctx, '/api/receptions', com.headers, bl)
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })

  it('RG-REC-004 refuse une requête non authentifiée (401)', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 1 }])
    const r = await post(ctx, '/api/receptions', {}, bl)
    expect(r.statusCode).toBe(401)
  })
})

describe('REC-P04 idempotence (RG-REC-008)', () => {
  it('RG-REC-008 même Idempotency-Key avec un corps différent : 409 REC_IDEMPOTENCE_CONFLIT, une seule réception', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 2 }])
    const h = { ...s.headers, ...idem() }
    const a = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions',
      headers: h,
      payload: bl,
    })
    expect(a.statusCode).toBe(201)
    const b = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions',
      headers: h,
      payload: { ...bl, lignes: [{ ...bl.lignes[0], quantite: 3 }] },
    })
    expect(b.statusCode).toBe(409)
    expect(erreur(b)).toMatchObject({ code: 'REC_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' })
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(1)
    expect(
      await db.mouvement.count({ where: { affiche: { plateformeId: s.plateforme.id } } }),
    ).toBe(1)
  })

  it('RG-REC-008 la même clé utilisée par deux utilisateurs différents crée deux réceptions distinctes', async () => {
    const s = await site(ctx)
    const coll = await autre(ctx, s.plateforme.id, ['recep'])
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const cle = idem()
    const bl1 = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l1.id, quantite: 1 }])
    const bl2 = await bonDeLivraison(ctx, coll.headers, [{ ligneAttendueId: l2.id, quantite: 1 }])
    const r1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions',
      headers: { ...s.headers, ...cle },
      payload: bl1,
    })
    const r2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions',
      headers: { ...coll.headers, ...cle },
      payload: bl2,
    })
    expect([r1.statusCode, r2.statusCode]).toEqual([201, 201])
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(2)
  })
})

describe('REC-P04 atomicité (RG-REC-046)', () => {
  it('RG-REC-046 une panne au milieu (2e ligne) n’écrit rien : ni livraison, ni réception, ni affiche, ni mouvement, ni lien', async () => {
    const s = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 3 },
      { ligneAttendueId: l2.id, quantite: 987654 },
    ])
    const r = await avecPanne('panne_rec046', 'mouvement', 'NEW.quantite = 987654', () =>
      post(ctx, '/api/receptions', s.headers, bl),
    )
    expect(r.statusCode).toBe(500)
    expect(await db.livraison.count({ where: { reference: bl.numeroBl } })).toBe(0)
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(await db.affiche.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l1.id } })).toBe(0)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l1.id } })).statut).toBe(
      'ATTENDUE',
    )
    // La clé d'idempotence n'est pas gardée : la même demande corrigée peut être rejouée.
    expect((await post(ctx, '/api/receptions', s.headers, bl)).statusCode).toBe(201)
  })

  // ANO-013 corrigée (routes-suite.ts:technique) : le code générique ERREUR_INTERNE était renvoyé.
  it('RG-REC-046 l’erreur technique porte le code REC_ERREUR_INTERNE', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 987654 }])
    const r = await avecPanne('panne_rec046_code', 'mouvement', 'NEW.quantite = 987654', () =>
      post(ctx, '/api/receptions', s.headers, bl),
    )
    expect(r.statusCode).toBe(500)
    expect(r.json<{ code: string }>().code).toBe('REC_ERREUR_INTERNE')
  })
})

describe('REC-P04 périmètre (RG-REC-001)', () => {
  it('RG-REC-001 un BL mêlant une ligne du périmètre et une ligne hors périmètre est refusé (403), rien n’est écrit', async () => {
    const s = await site(ctx)
    const dedans = await ligne(ctx, s.plateforme.id)
    const dehors = await f.createReceptionAttendue(db)
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: dedans.id, quantite: 1 },
      { ligneAttendueId: dehors.id, quantite: 1 },
    ])
    const r = await post(ctx, '/api/receptions', s.headers, bl)
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })
})
