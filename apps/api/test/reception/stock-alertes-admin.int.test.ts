// REC-P09 / REC-P10 — rebut, mouvements manuels, alertes, paramètres, référentiels.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AlertesSchema,
  ParametresReceptionSchema,
  ReferentielLigneSchema,
  semaineIsoDe,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  contexteReception,
  erreur,
  get,
  ligne,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(async () => {
  // Les paramètres globaux reviennent aux valeurs de référence pour les autres fichiers de test.
  await db.parametre.deleteMany({
    where: { cle: { startsWith: 'reception.' }, NOT: { plateformeId: null } },
  })
  await ctx.arreter()
})

describe('REC-P09 Stock', () => {
  it('RG-REC-156 met au rebut (mouvement négatif, motif) dans la limite du disponible', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const r = await post(ctx, `/api/affiches/${String(rv.afficheId)}/rebut`, s.headers, {
      quantite: 2,
      motif: 'AFFICHE_DECHIREE',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ afficheId: rv.afficheId, stock: 3 })
    expect(
      await db.mouvement.findFirstOrThrow({
        where: { afficheId: rv.afficheId, type: 'MISE_AU_REBUT' },
      }),
    ).toMatchObject({ quantite: -2, motif: 'Affiche déchirée' })
  })

  it.each([[0], [6]])('RG-REC-156 refuse un rebut de %i (422)', async (q) => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const r = await post(ctx, `/api/affiches/${String(rv.afficheId)}/rebut`, s.headers, {
      quantite: q,
      motif: 'AUTRE',
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_REBUT_SUPERIEUR_STOCK', regle: 'RG-REC-156' })
  })

  it.each([['coord'], ['com']] as const)(
    'RG-REC-002 le profil %s ne met pas au rebut (403)',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
      const intrus = await autre(ctx, s.plateforme.id, [role])
      expect(
        (
          await post(ctx, `/api/affiches/${String(rv.afficheId)}/rebut`, intrus.headers, {
            quantite: 1,
            motif: 'AUTRE',
          })
        ).statusCode,
      ).toBe(403)
    },
  )

  it('RG-REC-002 le profil expe met au rebut', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const expe = await autre(ctx, s.plateforme.id, ['expe'])
    expect(
      (
        await post(ctx, `/api/affiches/${String(rv.afficheId)}/rebut`, expe.headers, {
          quantite: 1,
          motif: 'AUTRE',
        })
      ).statusCode,
    ).toBe(200)
  })

  it.each([['recep'], ['coord'], ['com']] as const)(
    'RG-REC-155 ajout / sortie manuels refusés à %s tant que Q-117 est ouverte (403)',
    async (role) => {
      const s = await site(ctx, [role])
      const a = await f.createAffiche(db, { plateformeId: s.plateforme.id })
      const r = await post(ctx, `/api/affiches/${String(a.id)}/mouvements-manuels`, s.headers, {
        sens: 'AJOUT',
        quantite: 1,
      })
      expect(r.statusCode).toBe(403)
    },
  )

  it('RG-REC-169 rebut sur une affiche fusionnée héritée : 409, aucun mouvement gardé', async () => {
    const s = await site(ctx)
    const fille = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    await f.createMouvement(db, {
      afficheId: fille.id,
      type: 'RECEPTION',
      quantite: 5,
      date: new Date(),
    })
    await f.createFusionAffiche(db, {
      afficheId: fille.id,
      afficheChapeauId: (await f.createAffiche(db, { plateformeId: s.plateforme.id })).id,
    })
    const r = await post(ctx, `/api/affiches/${String(fille.id)}/rebut`, s.headers, {
      quantite: 1,
      motif: 'AUTRE',
    })
    expect(r.statusCode).toBe(409)
    expect(
      await db.mouvement.count({ where: { afficheId: fille.id, type: 'MISE_AU_REBUT' } }),
    ).toBe(0)
  })
})

describe('REC-P10 Alertes', () => {
  it('RG-REC-182 visuel non reçu en S : critique ; reçu en partie : important ; S+1 : à surveiller', async () => {
    const s = await site(ctx)
    const suivante = semaineIsoDe(new Date(Date.now() + 7 * 86_400_000))
    const rien = await ligne(ctx, s.plateforme.id)
    const partiel = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    const s1 = await ligne(ctx, s.plateforme.id, {
      semAnnee: suivante.annee,
      semNum: suivante.semaine,
    })
    const { alertes } = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    )
    const g = (id: number) => alertes.find((a) => a.cle === `RG-REC-182:${String(id)}`)?.gravite
    expect(g(rien.id)).toBe('CRITIQUE')
    expect(g(partiel.ligne.id)).toBe('IMPORTANT')
    expect(g(s1.id)).toBe('A_SURVEILLER')
  })

  it('RG-REC-185 / RG-REC-186 réception inconnue à identifier (importante après le délai) ; signalée : dossier introuvable', async () => {
    const s = await site(ctx)
    const recente = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
    })
    const vieille = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
      dateArrivee: new Date(Date.now() - 30 * 3_600_000),
    })
    const signalee = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
      signaleLe: new Date(),
    })
    const { alertes } = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    )
    const par = (cle: string) => alertes.find((a) => a.cle === cle)
    expect(par(`RG-REC-185:${String(recente.id)}`)?.gravite).toBe('A_SURVEILLER')
    expect(par(`RG-REC-185:${String(vieille.id)}`)?.gravite).toBe('IMPORTANT')
    expect(par(`RG-REC-186:${String(signalee.id)}`)?.gravite).toBe('IMPORTANT')
    expect(par(`RG-REC-185:${String(signalee.id)}`)).toBeUndefined()
  })

  it('RG-REC-187 / RG-REC-188 feuille définitive à imprimer / à refaire', async () => {
    const s = await site(ctx)
    const temp = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      typeFeuille: 'TEMPORAIRE',
    })
    const refaire = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      typeFeuille: 'DEFINITIVE',
      feuilleARefaire: true,
    })
    const ok = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      typeFeuille: 'DEFINITIVE',
    })
    const cles = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    ).alertes.map((a) => a.cle)
    expect(cles).toContain(`RG-REC-187:${String(temp.id)}`)
    expect(cles).toContain(`RG-REC-188:${String(refaire.id)}`)
    expect(cles.filter((c) => c.endsWith(`:${String(ok.id)}`))).toEqual([])
  })

  it('RG-REC-189 palette à contrôler depuis plus du délai ; grave au double', async () => {
    const s = await site(ctx)
    const ok = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      aControlerDepuis: new Date(),
    })
    const retard = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      aControlerDepuis: new Date(Date.now() - 30 * 3_600_000),
    })
    const double = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      aControlerDepuis: new Date(Date.now() - 50 * 3_600_000),
    })
    const { alertes } = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    )
    const g = (id: number) => alertes.find((a) => a.cle === `RG-REC-189:${String(id)}`)?.gravite
    expect(g(ok.id)).toBeUndefined()
    expect(g(retard.id)).toBe('A_SURVEILLER')
    expect(g(double.id)).toBe('IMPORTANT')
  })

  it('RG-REC-183 / RG-REC-184 écart de réception (surplus) et réception sans IP', async () => {
    const s = await site(ctx)
    const surplus = await receptionValidee(ctx, s.headers, s.plateforme.id, 12)
    const sansIp = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      theme: null,
      themeCle: null,
    })
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: sansIp.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const cles = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    ).alertes.map((x) => x.cle)
    expect(cles).toContain(`RG-REC-183:${String(surplus.ligne.id)}`)
    expect(cles).toContain(`RG-REC-184:${String(sansIp.id)}`)
  })

  it('RG-REC-001 les alertes ne portent que sur le périmètre', async () => {
    const s = await site(ctx)
    await f.createReception(db, { statut: 'A_IDENTIFIER', estInconnue: true })
    const { alertes } = AlertesSchema.parse(
      (await get(ctx, '/api/alertes/reception', s.headers)).json(),
    )
    expect(alertes.every((a) => a.plateformeId === s.plateforme.id)).toBe(true)
  })

  it('RG-REC-002 le profil expe ne consulte pas les alertes (403)', async () => {
    const s = await site(ctx, ['expe'])
    expect((await get(ctx, '/api/alertes/reception', s.headers)).statusCode).toBe(403)
  })
})

describe('REC-P10 Paramètres et référentiels', () => {
  // RG-REC-009 : le PUT porte les valeurs lues (precedent), relues juste avant l'écriture.
  const put = async (headers: Record<string, string>, url: string, payload: object) => {
    const lu = await ctx.app.inject({ method: 'GET', url, headers })
    // Sans droit de lecture, le refus attendu est celui du PUT : le corps est renvoyé tel quel.
    const precedent: unknown = lu.statusCode === 200 ? lu.json() : payload
    return ctx.app.inject({ method: 'PUT', url, headers, payload: { ...payload, precedent } })
  }

  it('RG-REC-178 l’administrateur lit les paramètres (valeurs de référence)', async () => {
    const s = await site(ctx, ['admin'])
    const r = await get(ctx, `/api/parametres/reception?site=${String(s.plateforme.id)}`, s.headers)
    expect(r.statusCode).toBe(200)
    expect(ParametresReceptionSchema.parse(r.json())).toMatchObject({
      ecartReception: 10,
      delaiControle: 24,
      exemplairesFeuille: 2,
      alleeInconnues: 'X',
    })
  })

  it('RG-REC-178 / Q-105 l’allée tampon s’enregistre par site, journalisée', async () => {
    const s = await site(ctx, ['admin'])
    const actuels = ParametresReceptionSchema.parse(
      (
        await get(ctx, `/api/parametres/reception?site=${String(s.plateforme.id)}`, s.headers)
      ).json(),
    )
    const r = await put(s.headers, `/api/parametres/reception?site=${String(s.plateforme.id)}`, {
      ...actuels,
      alleeInconnues: 'z',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toBe(
      'Seuil enregistré (s’applique aux prochaines préparations).',
    )
    expect(
      (
        await db.parametre.findFirstOrThrow({
          where: { cle: 'reception.alleeInconnues', plateformeId: s.plateforme.id },
        })
      ).valeur,
    ).toBe('Z')
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'PARAMETRE',
          entiteId: `reception.alleeInconnues@${String(s.plateforme.id)}`,
        },
      }),
    ).toBe(1)
    // Le global n'a pas bougé.
    const autreSite = await site(ctx, ['admin'])
    expect(
      ParametresReceptionSchema.parse(
        (
          await get(
            ctx,
            `/api/parametres/reception?site=${String(autreSite.plateforme.id)}`,
            autreSite.headers,
          )
        ).json(),
      ).alleeInconnues,
    ).toBe('X')
  })

  it('RG-REC-009 un enregistrement fondé sur des valeurs périmées est refusé (409)', async () => {
    const s = await site(ctx, ['admin'])
    const url = `/api/parametres/reception?site=${String(s.plateforme.id)}`
    const lus = ParametresReceptionSchema.parse((await get(ctx, url, s.headers)).json())
    const premier = await ctx.app.inject({
      method: 'PUT',
      url,
      headers: s.headers,
      payload: { ...lus, alleeInconnues: 'Q', precedent: lus },
    })
    expect(premier.statusCode).toBe(200)
    const second = await ctx.app.inject({
      method: 'PUT',
      url,
      headers: s.headers,
      payload: { ...lus, alleeInconnues: 'R', precedent: lus },
    })
    expect(second.statusCode).toBe(409)
    expect(erreur(second).code).toBe('REC_CONFLIT_VERSION')
  })

  it.each([[0], [6]])('RG-REC-178 refuse %i exemplaire(s) (400)', async (n) => {
    const s = await site(ctx, ['admin'])
    const actuels = ParametresReceptionSchema.parse(
      (await get(ctx, '/api/parametres/reception', s.headers)).json(),
    )
    expect(
      (await put(s.headers, '/api/parametres/reception', { ...actuels, exemplairesFeuille: n }))
        .statusCode,
    ).toBe(400)
  })

  it.each([['coord'], ['recep']] as const)(
    'RG-REC-178 le profil %s ne paramètre pas (403)',
    async (role) => {
      const s = await site(ctx, [role])
      expect((await get(ctx, '/api/parametres/reception', s.headers)).statusCode).toBe(403)
    },
  )

  it('RG-REC-179 l’administrateur ajoute un imprimeur ; doublon refusé (409) ; désactivation versionnée', async () => {
    const s = await site(ctx, ['admin'])
    const libelle = `Imprimeur ${String(Date.now())}`
    const r = await post(ctx, '/api/referentiels/imprimeurs', s.headers, { libelle })
    expect(r.statusCode).toBe(201)
    const cree = ReferentielLigneSchema.parse(r.json())
    const doublon = await post(ctx, '/api/referentiels/imprimeurs', s.headers, {
      libelle: libelle.toUpperCase(),
    })
    expect(doublon.statusCode).toBe(409)
    const p = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/referentiels/imprimeurs/${String(cree.id)}`,
      headers: s.headers,
      payload: { actif: false, version: cree.version },
    })
    expect(p.statusCode).toBe(200)
    expect((await db.imprimeur.findUniqueOrThrow({ where: { id: cree.id } })).actif).toBe(false)
    const perime = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/referentiels/imprimeurs/${String(cree.id)}`,
      headers: s.headers,
      payload: { actif: true, version: cree.version },
    })
    expect(perime.statusCode).toBe(409)
  })

  it('RG-REC-179 l’administrateur ajoute un livreur', async () => {
    const s = await site(ctx, ['admin'])
    expect(
      (
        await post(ctx, '/api/referentiels/livreurs', s.headers, {
          libelle: `Livreur ${String(Date.now())}`,
        })
      ).statusCode,
    ).toBe(201)
  })

  it('RG-REC-179 / RG-REC-035 un imprimeur désactivé n’est plus accepté', async () => {
    const s = await site(ctx)
    const imp = await f.createImprimeur(db, { actif: false })
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    const r = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/affiches/${String(a.id)}`,
      headers: s.headers,
      payload: { version: a.version, imprimeurId: imp.id },
    })
    expect(r.statusCode).toBe(422)
  })

  it.each([['coord'], ['recep']] as const)(
    'RG-REC-179 le profil %s ne gère pas les référentiels (403)',
    async (role) => {
      const s = await site(ctx, [role])
      expect(
        (await post(ctx, '/api/referentiels/imprimeurs', s.headers, { libelle: 'X' })).statusCode,
      ).toBe(403)
    },
  )
})
