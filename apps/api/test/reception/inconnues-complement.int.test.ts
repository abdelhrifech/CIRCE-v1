// REC-P07 — réceptions inconnues : tests COMPLÉMENTAIRES écrits depuis RECEPTION_REGLES_METIER.md
// (RG-REC-095 à 120 ; §2 matrice ; §3.2 RECEPTION_INCONNUE, AFFICHE, VALIDATION_ADMIN) et
// core/permissions/catalogue.ts. Ne duplique pas inconnues.int.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AlertesSchema, InconnueCreeeSchema, InconnuesSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  contexteReception,
  erreur,
  get,
  idem,
  ligne,
  photo,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

type Site = Awaited<ReturnType<typeof site>>

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

const rattacherInconnue = (
  afficheId: number,
  headers: Record<string, string>,
  corps: { version: number; lignes: { ligneAttendueId: number; quantite: number }[] },
) => post(ctx, `/api/affiches/${String(afficheId)}/rattacher-inconnue`, headers, corps)

const signaler = (afficheId: number, headers: Record<string, string>, receptionVersion: number) =>
  post(ctx, `/api/affiches/${String(afficheId)}/signaler`, headers, { receptionVersion })

const cles = async (headers: Record<string, string>) =>
  AlertesSchema.parse((await get(ctx, '/api/alertes/reception', headers)).json()).alertes.map(
    (a) => a.cle,
  )

describe('REC-P07 Création : valeurs limites, refus, effets', () => {
  it('RG-REC-096 valeur limite : une quantité comptée de 1 est acceptée', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 1 })
    expect(await db.mouvement.findMany({ where: { afficheId: c.afficheId } })).toMatchObject([
      { type: 'RECEPTION', quantite: 1 },
    ])
  })

  it.each([
    ['allée vide', { allee: '' }],
    ['allée et rayon blancs', { allee: '  ', rayon: '  ' }],
  ] as const)('RG-REC-097 refuse %s (422), rien n’est écrit', async (_cas, surcharge) => {
    const s = await site(ctx)
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaire(s, surcharge),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      code: 'REC_ALLEE_RAYON_INCONNUE_OBLIGATOIRES',
      regle: 'RG-REC-097',
    })
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })

  it('RG-REC-099 / RG-REC-185 la création prévient la Coordination (alerte « Réception inconnue à identifier »)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    expect(await cles(s.headers)).toContain(`RG-REC-185:${String(c.receptionId)}`)
  })

  it('RG-REC-083 / RG-REC-099 la feuille posée à la création est TEMPORAIRE et porte l’allée tampon', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { allee: 'x', rayon: '9' })
    expect(await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).toMatchObject({
      typeFeuille: 'TEMPORAIRE',
      allee: 'X',
      rayon: '9',
    })
  })

  it.each([['coord'], ['recep']] as const)(
    'RG-REC-002 le profil %s crée une réception inconnue',
    async (role) => {
      const s = await site(ctx, [role])
      const r = await post(ctx, '/api/receptions-inconnues', s.headers, await formulaire(s))
      expect(r.statusCode).toBe(201)
    },
  )

  it.each([['expe'], ['com']] as const)(
    'RG-REC-002 le profil %s ne crée pas de réception inconnue (403), rien n’est écrit',
    async (role) => {
      const s = await site(ctx)
      const intrus = await autre(ctx, s.plateforme.id, [role])
      const r = await post(ctx, '/api/receptions-inconnues', intrus.headers, await formulaire(s))
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'REC_ACCES_REFUSE', regle: 'RG-REC-002' })
      expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    },
  )

  it('RG-REC-008 rejeu de la création avec la même clé : une seule réception, une seule affiche', async () => {
    const s = await site(ctx)
    const corps = await formulaire(s)
    const h = { ...s.headers, ...idem() }
    const a = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions-inconnues',
      headers: h,
      payload: corps,
    })
    const b = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions-inconnues',
      headers: h,
      payload: corps,
    })
    expect(a.statusCode).toBe(201)
    expect(b.json()).toEqual(a.json())
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(1)
    expect(await db.affiche.count({ where: { plateformeId: s.plateforme.id } })).toBe(1)
  })

  it('RG-REC-008 même clé, corps différent : 409 REC_IDEMPOTENCE_CONFLIT', async () => {
    const s = await site(ctx)
    const corps = await formulaire(s)
    const h = { ...s.headers, ...idem() }
    await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions-inconnues',
      headers: h,
      payload: corps,
    })
    const b = await ctx.app.inject({
      method: 'POST',
      url: '/api/receptions-inconnues',
      headers: h,
      payload: { ...corps, quantite: 13 },
    })
    expect(b.statusCode).toBe(409)
    expect(erreur(b)).toMatchObject({ code: 'REC_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' })
  })

  it('RG-REC-117 atomicité : une panne à l’écriture du mouvement ne laisse ni réception, ni affiche, ni livraison', async () => {
    const s = await site(ctx)
    const corps = await formulaire(s, {
      quantite: 4321,
      numeroBl: `BL-PANNE-${String(Date.now())}`,
    })
    const r = await avecPanne('panne_inconnue', 'mouvement', 'NEW.quantite = 4321', () =>
      post(ctx, '/api/receptions-inconnues', s.headers, corps),
    )
    expect(r.statusCode).toBe(500)
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(await db.affiche.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(await db.livraison.count({ where: { reference: corps.numeroBl } })).toBe(0)
  })
})

describe('REC-P07 Liste (RG-REC-101) : permissions et périmètre', () => {
  it.each([['coord'], ['recep']] as const)(
    'RG-REC-002 le profil %s consulte les réceptions inconnues',
    async (role) => {
      const s = await site(ctx, [role])
      expect((await get(ctx, '/api/receptions-inconnues', s.headers)).statusCode).toBe(200)
    },
  )

  // HYPOTHÈSE Q-186 (11) (audit COO-P04) : l'admin, qui rattache (COO §2), consulte l'écran ECR-REC-04.
  it.each([['expe']] as const)(
    'RG-REC-002 le profil %s ne consulte pas les réceptions inconnues (403)',
    async (role) => {
      const s = await site(ctx, [role])
      expect((await get(ctx, '/api/receptions-inconnues', s.headers)).statusCode).toBe(403)
    },
  )

  it('RG-REC-002 / RG-X-051 le profil admin consulte les réceptions inconnues (200, Q-186 (11))', async () => {
    const s = await site(ctx, ['admin'])
    expect((await get(ctx, '/api/receptions-inconnues', s.headers)).statusCode).toBe(200)
  })

  it('RG-REC-101 / RG-REC-001 une réception inconnue d’un autre site n’apparaît pas', async () => {
    const s = await site(ctx)
    const ailleurs = await site(ctx)
    const c = await inconnue(ailleurs)
    const liste = InconnuesSchema.parse(
      (await get(ctx, '/api/receptions-inconnues', s.headers)).json(),
    )
    expect(liste.items.map((i) => i.afficheId)).not.toContain(c.afficheId)
  })
})

describe('REC-P07 Identifier et rattacher : compléments', () => {
  it('RG-REC-105 valeur limite : une recherche de 2 caractères est acceptée', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const r = await get(ctx, `/api/affiches/${String(c.afficheId)}/candidats?q=ab`, s.headers)
    expect(r.statusCode).toBe(200)
  })

  it('RG-REC-108 valeur limite : une répartition égale à la quantité reçue est acceptée', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 12 })
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version,
      lignes: [
        { ligneAttendueId: l1.id, quantite: 7 },
        { ligneAttendueId: l2.id, quantite: 5 },
      ],
    })
    expect(r.statusCode).toBe(200)
  })

  it('RG-REC-109 le rattachement recalcule le reçu de la ligne attendue (Attendue → Partielle)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 4 })
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 4 }],
    })
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'PARTIELLE',
    )
  })

  it('RG-REC-109 / RG-REC-185 une fois rattachée, l’alerte « Réception inconnue à identifier » disparaît', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    expect(await cles(s.headers)).not.toContain(`RG-REC-185:${String(c.receptionId)}`)
  })

  it('RG-REC-107 « Rattacher » (écran inconnues) sur une affiche reçue avec dossier connu : 409', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await rattacherInconnue(rv.afficheId, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 1 }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-107')
  })

  it('RG-REC-111 / RG-REC-118 le profil admin rattache (catalogue) et cela vaut validation', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const admin = await autre(ctx, s.plateforme.id, ['admin'])
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await rattacherInconnue(c.afficheId, admin.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ validee: true })
  })

  it('RG-REC-118 le profil expe ne rattache pas (403), l’affiche reste orpheline', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const expe = await autre(ctx, s.plateforme.id, ['expe'])
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await rattacherInconnue(c.afficheId, expe.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    expect(r.statusCode).toBe(403)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).statut).toBe(
      'ORPHELINE',
    )
  })

  it('RG-REC-001 rattacher à une ligne attendue d’un autre site : 403, rien n’est écrit', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const dehors = await f.createReceptionAttendue(db)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: dehors.id, quantite: 2 }],
    })
    expect(r.statusCode).toBe(403)
    expect(await db.afficheAttendue.count({ where: { afficheId: c.afficheId } })).toBe(0)
  })

  it('RG-REC-001 rattacher une affiche inconnue d’un autre site : 403', async () => {
    const s = await site(ctx)
    const ailleurs = await site(ctx)
    const c = await inconnue(ailleurs)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    expect(r.statusCode).toBe(403)
  })

  it('RG-REC-009 rattacher avec une version périmée : 409 REC_CONFLIT_VERSION, rien n’est écrit', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version - 1,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'REC_CONFLIT_VERSION', regle: 'RG-REC-009' })
    expect(await db.afficheAttendue.count({ where: { afficheId: c.afficheId } })).toBe(0)
    expect((await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).statut).toBe(
      'A_IDENTIFIER',
    )
  })

  it('RG-REC-009 deux rattachements avec la même version : un seul réussit, l’autre 409', async () => {
    const s = await site(ctx)
    const coord = await autre(ctx, s.plateforme.id, ['coord'])
    const c = await inconnue(s)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const [r1, r2] = await Promise.all([
      rattacherInconnue(c.afficheId, s.headers, {
        version: a.version,
        lignes: [{ ligneAttendueId: l1.id, quantite: 2 }],
      }),
      rattacherInconnue(c.afficheId, coord.headers, {
        version: a.version,
        lignes: [{ ligneAttendueId: l2.id, quantite: 3 }],
      }),
    ])
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409])
    expect(await db.afficheAttendue.count({ where: { afficheId: c.afficheId, actif: true } })).toBe(
      1,
    )
  })

  it('RG-REC-008 rejeu du rattachement avec la même clé : un seul lien par dossier', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const h = { ...s.headers, ...idem() }
    const url = `/api/affiches/${String(c.afficheId)}/rattacher-inconnue`
    const corps = { version: a.version, lignes: [{ ligneAttendueId: l.id, quantite: 2 }] }
    const r1 = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    const r2 = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    expect(r1.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(await db.afficheAttendue.count({ where: { afficheId: c.afficheId } })).toBe(1)
  })

  it('RG-REC-109 atomicité : une panne sur le 2e lien ne laisse ni lien, ni changement de statut', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 12 })
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await avecPanne(
      'panne_rattacher',
      'asso_affiche_visuel',
      `NEW.ligne_attendue_id = ${String(l2.id)}`,
      () =>
        rattacherInconnue(c.afficheId, s.headers, {
          version: a.version,
          lignes: [
            { ligneAttendueId: l1.id, quantite: 3 },
            { ligneAttendueId: l2.id, quantite: 4 },
          ],
        }),
    )
    expect(r.statusCode).toBe(500)
    expect(await db.afficheAttendue.count({ where: { afficheId: c.afficheId } })).toBe(0)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).toMatchObject({
      statut: 'ORPHELINE',
      version: a.version,
    })
    expect((await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).statut).toBe(
      'A_IDENTIFIER',
    )
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l1.id } })).statut).toBe(
      'ATTENDUE',
    )
  })
})

describe('REC-P07 Signaler « Dossier introuvable » : transitions et permissions', () => {
  it('RG-REC-112 / RG-REC-186 le signalement crée l’alerte « Dossier introuvable » et retire « à identifier »', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    expect((await signaler(c.afficheId, s.headers, rec.version)).statusCode).toBe(200)
    const k = await cles(s.headers)
    expect(k).toContain(`RG-REC-186:${String(c.receptionId)}`)
    expect(k).not.toContain(`RG-REC-185:${String(c.receptionId)}`)
  })

  it('RG-REC-112 signaler une inconnue déjà rattachée (RATTACHEE_A_CONTROLER) : 409 REC_SIGNALEMENT_INTERDIT', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    const r = await signaler(c.afficheId, s.headers, rec.version)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'REC_SIGNALEMENT_INTERDIT', regle: 'RG-REC-112' })
    expect(
      (await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).signaleLe,
    ).toBeNull()
  })

  it('RG-REC-112 signaler une affiche reçue avec dossier connu : 409', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })
    const r = await signaler(rv.afficheId, s.headers, rec.version)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-112')
  })

  it('RG-REC-009 signaler avec une version de réception périmée : 409, aucun signalement', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    const r = await signaler(c.afficheId, s.headers, rec.version - 1)
    expect(r.statusCode).toBe(409)
    expect(
      (await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).signaleLe,
    ).toBeNull()
  })

  it.each([['coord'], ['admin']] as const)(
    'RG-REC-002 le profil %s signale « Dossier introuvable » (catalogue)',
    async (role) => {
      const s = await site(ctx)
      const c = await inconnue(s)
      const u = await autre(ctx, s.plateforme.id, [role])
      const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
      expect((await signaler(c.afficheId, u.headers, rec.version)).statusCode).toBe(200)
    },
  )

  it.each([['cheq'], ['expe']] as const)(
    'RG-REC-002 le profil %s ne signale pas (403)',
    async (role) => {
      const s = await site(ctx)
      const c = await inconnue(s)
      const u = await autre(ctx, s.plateforme.id, [role])
      const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
      expect((await signaler(c.afficheId, u.headers, rec.version)).statusCode).toBe(403)
    },
  )

  it('RG-REC-001 signaler une inconnue d’un autre site : 403', async () => {
    const s = await site(ctx)
    const ailleurs = await site(ctx)
    const c = await inconnue(ailleurs)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    expect((await signaler(c.afficheId, s.headers, rec.version)).statusCode).toBe(403)
  })

  it('RG-REC-112 / Q-109 INTROUVABLE → rattachée : la palette passe dans le sas (A_CONTROLER)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    await signaler(c.afficheId, s.headers, rec.version)
    const l = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    await rattacherInconnue(c.afficheId, s.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l.id, quantite: 2 }],
    })
    expect((await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
    const liste = InconnuesSchema.parse(
      (await get(ctx, '/api/receptions-inconnues?statut=RATTACHEE_A_CONTROLER', s.headers)).json(),
    )
    expect(liste.items.map((i) => i.afficheId)).toContain(c.afficheId)
  })
})
