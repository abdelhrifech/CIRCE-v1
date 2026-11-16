// COO-P11 — tests d'INTÉGRATION du suivi 8 m² (RG-COO-237, ECR-COO-08), du pré-assemblage 8 m² (RG-COO-234) et du
// référentiel des rouleurs (RG-COO-297, ECR-ADM-07). Source de l'attendu : docs/COORDINATION_REGLES_METIER.md ;
// hypothèses Q-195 (cette session), Q-262 (pré-assemblage par thème), Q-264 (saisie libre ≥ 0), Q-286 (profils).
// RG-X : le besoin et le reçu du suivi 8 m² viennent de la Réception (couverture, RG-COO-208) ; aucune saisie du suivi
// ne modifie la réception (stock, liens, affiches).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ResultatSaisie8m2Schema,
  RouleurLigneSchema,
  RouleursReferentielSchema,
  RouleursSchema,
  Suivi8m2Schema,
} from '@circe/shared'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'
import {
  avecEchec,
  DEPART_TXT,
  envoyer,
  parametre,
  recu,
  restaurerParametres,
  ROLES,
  ROLES_SANS_ADMIN,
  siteDeroulant,
  trainExportable,
  versions,
  type SiteD,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
afterEach(restaurerParametres)

/** Site déroulant dont l'atelier est un atelier 8 m² (paramètre `suivi8m2.ateliers`, Q-319). */
const site8m2 = async () => {
  const s = await siteDeroulant(ctx)
  await parametre(ctx, 'suivi8m2.ateliers', String(s.atelier.id))
  return s
}
const numero = () => 810_000 + Math.floor(Math.random() * 100_000)

const suivi = async (s: SiteD, qs = '', headers = s.users.coord.headers) => {
  const r = await get(
    ctx,
    `/api/coordination/trains/suivi-8m2?depart=${DEPART_TXT}&atelier=${String(s.atelier.id)}${qs}`,
    headers,
  )
  expect(r.statusCode, r.body).toBe(200)
  return Suivi8m2Schema.parse(r.json())
}
const saisie = (
  s: SiteD,
  theme: string,
  contNum: number,
  champ: string,
  valeur: unknown,
  version: number,
  headers = s.users.cheq.headers,
  cle = idem(),
) =>
  envoyer(
    ctx,
    '/api/coordination/trains/suivi-8m2',
    headers,
    { atelierId: s.atelier.id, depart: DEPART_TXT, contNum, theme, champ, valeur, version },
    cle,
  )

describe('RG-COO-237 suivi 8 m² : thèmes des ateliers 8 m², besoin, reçu, reste à faire', () => {
  it('RG-COO-237 une ligne par thème 8 m² : site, annonceur · thème, besoin (trains), reçu (Réception), saisies à 0, reste = besoin − finales', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await recu(ctx, s, c, 'Rose', 1)
    const r = await suivi(s)
    expect(r.ateliers.map((a) => a.id)).toEqual([s.atelier.id])
    expect(r.lignes).toHaveLength(1)
    expect(r.lignes[0]).toMatchObject({
      atelierId: s.atelier.id,
      site: s.plateforme.nom,
      contNum: c,
      theme: 'Rose',
      besoin: 2,
      recu: 1,
      demiesHaut: 0,
      demiesBas: 0,
      finales: 0,
      resteAFaire: 2,
      version: 0,
    })
  })

  it('RG-COO-237 un atelier qui n’est pas au paramètre n’a aucun thème 8 m² (aucun identifiant legacy supposé, Q-319) ; sans paramètre, liste vide', async () => {
    const s = await siteDeroulant(ctx)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const vide = await suivi(s)
    expect(vide.lignes).toEqual([])
    expect(vide.ateliers).toEqual([])
    await parametre(ctx, 'suivi8m2.ateliers', String(s.atelier2.id))
    expect((await suivi(s, '')).lignes).toEqual([])
  })

  it('RG-COO-237 filtres dossier et annonceur côté API ; semaine par défaut = suivante', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      annonceur: 'ALPHA',
      extra: { contNum: c },
    })
    await trainExportable(ctx, s, ['Gris'], {
      statut: 'A_IMPRIMER',
      annonceur: 'BETA',
      extra: { contNum: c + 1 },
    })
    expect((await suivi(s)).lignes).toHaveLength(2)
    expect((await suivi(s, `&dossier=${String(c)}`)).lignes.map((l) => l.theme)).toEqual(['Rose'])
    expect((await suivi(s, '&annonceur=beta')).lignes.map((l) => l.theme)).toEqual(['Gris'])
    const defaut = Suivi8m2Schema.parse(
      (await get(ctx, '/api/coordination/trains/suivi-8m2', s.users.coord.headers)).json(),
    )
    expect(defaut.lignes.some((l) => l.contNum === c)).toBe(true)
  })

  it('RG-COO-237 un thème d’un autre site ou d’un autre atelier n’apparaît pas ; le suivi ne modifie jamais la réception (RG-X)', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    await parametre(ctx, 'suivi8m2.ateliers', `${String(s.atelier.id)};${String(autre.atelier.id)}`)
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, autre, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await recu(ctx, s, c, 'Rose', 2)
    const avant = await db.affiche.findMany({ where: { plateformeId: s.plateforme.id } })
    const liensAvant = await db.afficheAttendue.count()
    expect((await suivi(s)).lignes.map((l) => l.site)).toEqual([s.plateforme.nom])
    expect((await saisie(s, 'Rose', c, 'finales', 1, 0)).statusCode).toBe(200)
    expect(await db.affiche.findMany({ where: { plateformeId: s.plateforme.id } })).toEqual(avant)
    expect(await db.afficheAttendue.count()).toBe(liensAvant)
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-237 lecture du suivi 8 m² pour le rôle %s (coord et cheq seulement)',
    async (role) => {
      const s = await site8m2()
      const r = await get(
        ctx,
        `/api/coordination/trains/suivi-8m2?depart=${DEPART_TXT}`,
        s.users[role].headers,
      )
      const autorise = role === 'coord' || role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      if (!autorise) expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-237')
    },
  )

  it('RG-COO-237 401 sans identité ; 400 pour une semaine ISO inexistante', async () => {
    const s = await site8m2()
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/trains/suivi-8m2' }))
        .statusCode,
    ).toBe(401)
    expect(
      (await get(ctx, '/api/coordination/trains/suivi-8m2?depart=2026-W54', s.users.coord.headers))
        .statusCode,
    ).toBe(400)
  })
})

describe('RG-COO-237 saisie en ligne des demies et des 8 m² finales', () => {
  it('RG-COO-237 nominal : première saisie (version 0) puis saisies suivantes sous verrou de version ; reste à faire recalculé ; journal « 8 m² : <champ> = <valeur> »', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    const un = await saisie(s, 'Rose', c, 'demiesHaut', 3, 0)
    expect(un.statusCode, un.body).toBe(200)
    const a = ResultatSaisie8m2Schema.parse(un.json())
    expect(a.message).toBe('8 m² : demies haut = 3')
    expect(a.ligne).toMatchObject({ demiesHaut: 3, finales: 0, resteAFaire: 3, version: 1 })
    const deux = await saisie(s, 'Rose', c, 'finales', 2, 1, s.users.coord.headers)
    expect(deux.statusCode, deux.body).toBe(200)
    expect(ResultatSaisie8m2Schema.parse(deux.json()).ligne).toMatchObject({
      demiesHaut: 3,
      finales: 2,
      resteAFaire: 1,
      version: 2,
    })
    const trois = await saisie(s, 'Rose', c, 'finales', 3, 2)
    expect(ResultatSaisie8m2Schema.parse(trois.json()).ligne.resteAFaire).toBe(0)
    expect((await suivi(s)).lignes[0]).toMatchObject({ demiesHaut: 3, finales: 3, version: 3 })
    const journal = await db.journalAudit.findMany({
      where: {
        typeEntite: 'SUIVI_8M2',
        action: 'SUIVI_8M2',
        entiteId: { contains: `|${String(c)}|` },
      },
      orderBy: { id: 'asc' },
    })
    expect(journal.map((j) => j.nouvelleValeur)).toEqual([
      '8 m² : demies haut = 3',
      '8 m² : 8 m² finales = 2',
      '8 m² : 8 m² finales = 3',
    ])
    expect(journal.every((j) => j.parId !== null)).toBe(true)
    expect(journal[1]?.parId).toBe(s.users.coord.id)
  })

  it('RG-COO-237 saisie libre ≥ 0 : 0 accepté, finales au-delà du besoin acceptées (Q-264 sans réponse) : le reste est alors négatif', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    expect((await saisie(s, 'Rose', c, 'demiesBas', 0, 0)).statusCode).toBe(200)
    const r = await saisie(s, 'Rose', c, 'finales', 5, 1)
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatSaisie8m2Schema.parse(r.json()).ligne.resteAFaire).toBe(-4)
  })

  it.each([
    ['négative', -1],
    ['non numérique', 'abc'],
    ['décimale', 1.5],
    ['absente', undefined],
    // Q-195 (10) : saisie libre, sans plafond fonctionnel ; seule la limite d'une colonne entière 32 bits rejette.
    ['au-delà d’un entier 32 bits', 2_147_483_648],
  ])('RG-COO-237 rejet : valeur %s : 400, rien d’enregistré', async (_nom, valeur) => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    const r = await saisie(s, 'Rose', c, 'finales', valeur, 0)
    expect(r.statusCode, r.body).toBe(400)
    expect(await db.suivi8m2.count({ where: { contNum: c } })).toBe(0)
  })

  it('RG-COO-237 rejet : champ inconnu 400 ; thème introuvable pour la semaine 404 ; atelier inconnu 404', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    expect((await saisie(s, 'Rose', c, 'bagues', 1, 0)).statusCode).toBe(400)
    expect((await saisie(s, 'Absent', c, 'finales', 1, 0)).statusCode).toBe(404)
    expect((await saisie(s, 'Rose', c + 99, 'finales', 1, 0)).statusCode).toBe(404)
    const inconnu = await envoyer(ctx, '/api/coordination/trains/suivi-8m2', s.users.cheq.headers, {
      atelierId: 99_999_999,
      depart: DEPART_TXT,
      contNum: c,
      theme: 'Rose',
      champ: 'finales',
      valeur: 1,
      version: 0,
    })
    expect(inconnu.statusCode).toBe(404)
  })

  it('RG-COO-237 rejet : un atelier qui n’est pas un atelier 8 m² : 422 COO_ATELIER_NON_8M2', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
      extra: { contNum: c },
    })
    const r = await envoyer(ctx, '/api/coordination/trains/suivi-8m2', s.users.cheq.headers, {
      atelierId: s.atelier2.id,
      depart: DEPART_TXT,
      contNum: c,
      theme: 'Rose',
      champ: 'finales',
      valeur: 1,
      version: 0,
    })
    expect(r.statusCode, r.body).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_ATELIER_NON_8M2', regle: 'RG-COO-237' })
  })

  it('RG-COO-237 / RG-COO-308 rejet : version périmée (409), première saisie avec une version non nulle (409) ; rien n’est écrit', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    const premiere = await saisie(s, 'Rose', c, 'finales', 1, 4)
    expect(premiere.statusCode).toBe(409)
    expect(erreur(premiere)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
    expect(await db.suivi8m2.count({ where: { contNum: c } })).toBe(0)
    expect((await saisie(s, 'Rose', c, 'finales', 1, 0)).statusCode).toBe(200)
    const perimee = await saisie(s, 'Rose', c, 'finales', 7, 0)
    expect(perimee.statusCode).toBe(409)
    expect((await db.suivi8m2.findFirstOrThrow({ where: { contNum: c } })).finales).toBe(1)
  })

  it('RG-COO-237 concurrence : deux saisies simultanées sur la même version : une seule passe (200 / 409)', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    expect((await saisie(s, 'Rose', c, 'demiesHaut', 1, 0)).statusCode).toBe(200)
    const [a, b] = await Promise.all([
      saisie(s, 'Rose', c, 'demiesHaut', 2, 1),
      saisie(s, 'Rose', c, 'demiesHaut', 3, 1),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect((await db.suivi8m2.findFirstOrThrow({ where: { contNum: c } })).version).toBe(2)
  })

  it('RG-COO-237 idempotence : même clé rejouée = même réponse, une seule écriture ; même clé avec un autre corps : 409', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    const cle = idem()
    const un = await saisie(s, 'Rose', c, 'finales', 2, 0, s.users.cheq.headers, cle)
    const deux = await saisie(s, 'Rose', c, 'finales', 2, 0, s.users.cheq.headers, cle)
    expect(un.statusCode).toBe(200)
    expect(deux.json()).toEqual(un.json())
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'SUIVI_8M2', entiteId: { contains: `|${String(c)}|` } },
      }),
    ).toBe(1)
    const autre = await saisie(s, 'Rose', c, 'finales', 9, 0, s.users.cheq.headers, cle)
    expect(autre.statusCode).toBe(409)
    expect(erreur(autre).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(
      (await envoyer(ctx, '/api/coordination/trains/suivi-8m2', s.users.cheq.headers, {}, {}))
        .statusCode,
    ).toBe(400)
  })

  it('RG-COO-237 atomicité : un échec de l’historique annule la saisie (aucune ligne créée) ; la clé n’est pas gardée', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'SUIVI_8M2'",
      () => saisie(s, 'Rose', c, 'finales', 2, 0),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.suivi8m2.count({ where: { contNum: c } })).toBe(0)
    expect((await saisie(s, 'Rose', c, 'finales', 2, 0)).statusCode).toBe(200)
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-237 permissions : saisie pour le rôle %s (coord et cheq seulement)',
    async (role) => {
      const s = await site8m2()
      const c = numero()
      await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
      const r = await saisie(s, 'Rose', c, 'finales', 1, 0, s.users[role].headers)
      const autorise = role === 'coord' || role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      if (!autorise) {
        expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-237')
        expect(await db.suivi8m2.count({ where: { contNum: c } })).toBe(0)
      }
    },
  )

  it('RG-COO-167 périmètre : le chef d’équipe d’un autre site ne peut pas saisir (403) ; rien n’est écrit', async () => {
    const s = await site8m2()
    const autre = await siteDeroulant(ctx)
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    const r = await saisie(s, 'Rose', c, 'finales', 1, 0, autre.users.cheq.headers)
    expect(r.statusCode, r.body).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
    expect(await db.suivi8m2.count({ where: { contNum: c } })).toBe(0)
    expect((await suivi(s, '', autre.users.cheq.headers)).lignes).toEqual([])
  })

  it('RG-COO-237 401 sans identité', async () => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/trains/suivi-8m2',
      headers: idem(),
      payload: {
        atelierId: 1,
        depart: DEPART_TXT,
        contNum: 1,
        theme: 'Rose',
        champ: 'finales',
        valeur: 1,
        version: 0,
      },
    })
    expect(r.statusCode).toBe(401)
  })
})

describe('RG-COO-234 pré-assemblage 8 m² (par thème, Q-262 : granularité par destinataire non tranchée)', () => {
  it('RG-COO-234 le pré-assemblage d’un thème 8 m² se marque et se retire par thème (RG-COO-233) ; la réception n’est pas touchée', async () => {
    const s = await site8m2()
    const c = numero()
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    await recu(ctx, s, c, 'Rose', 1)
    const besoin = await get(
      ctx,
      `/api/coordination/trains/besoin?depart=${DEPART_TXT}&atelier=${String(s.atelier.id)}`,
      s.users.cheq.headers,
    )
    const ligne = besoin.json<{ lignes: { cle: string; version: string; contNum: number }[] }>()
      .lignes[0]
    expect(ligne).toBeDefined()
    const r = await envoyer(ctx, '/api/coordination/trains/pre-assemblage', s.users.cheq.headers, {
      themes: [
        {
          atelierId: s.atelier.id,
          depart: DEPART_TXT,
          contNum: c,
          theme: 'Rose',
          version: ligne?.version,
        },
      ],
      valeur: true,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(
      (await db.faceTrain.findUniqueOrThrow({ where: { id: t.faces[0]?.id ?? 0 } })).preAssemblage,
    ).toBe(true)
    expect(await db.affiche.count({ where: { contNum: c, plateformeId: s.plateforme.id } })).toBe(1)
  })
})

// ───────────────────────── RG-COO-297 référentiel des rouleurs ─────────────────────────

const creer = (s: SiteD, payload: unknown, headers = s.users.admin.headers) =>
  envoyer(ctx, '/api/coordination/rouleurs', headers, payload)
const modifier = (id: number, payload: unknown, headers: Record<string, string>) =>
  ctx.app.inject({
    method: 'PATCH',
    url: `/api/coordination/rouleurs/${String(id)}`,
    headers,
    payload: payload as object,
  })
const supprimer = (id: number, headers: Record<string, string>) =>
  ctx.app.inject({ method: 'DELETE', url: `/api/coordination/rouleurs/${String(id)}`, headers })

describe('RG-COO-297 référentiel des rouleurs : opérateurs d’un atelier, poste, désactivation', () => {
  it('RG-COO-297 nominal : création avec poste, visible du référentiel (admin) et des listes de choix de rouleur ; journal', async () => {
    const s = await siteDeroulant(ctx)
    const r = await creer(s, { nom: 'Rouleur N1', poste: 'Table 1', atelierId: s.atelier.id })
    expect(r.statusCode, r.body).toBe(200)
    const ligne = RouleurLigneSchema.parse(r.json())
    expect(ligne).toMatchObject({
      nom: 'Rouleur N1',
      poste: 'Table 1',
      actif: true,
      utilise: false,
      version: 1,
      atelier: { id: s.atelier.id, plateforme: s.plateforme.nom },
    })
    const liste = RouleursReferentielSchema.parse(
      (await get(ctx, '/api/coordination/rouleurs', s.users.admin.headers)).json(),
    )
    expect(liste.rouleurs.some((x) => x.id === ligne.id)).toBe(true)
    const choix = RouleursSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    expect(choix.rouleurs.find((x) => x.id === ligne.id)).toEqual({
      id: ligne.id,
      nom: 'Rouleur N1',
      poste: 'Table 1',
    })
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'REFERENTIEL',
          entiteId: `rouleur:${String(ligne.id)}`,
          action: 'CREATION_ROULEUR',
        },
      }),
    ).toBe(1)
  })

  it.each(ROLES)(
    'RG-COO-297 permissions : gérer le référentiel pour le rôle %s (administrateur seul)',
    async (role) => {
      const s = await siteDeroulant(ctx)
      const r = await creer(s, { nom: `R ${role}`, atelierId: s.atelier.id }, s.users[role].headers)
      expect(r.statusCode, r.body).toBe(role === 'admin' ? 200 : 403)
      const l = await get(ctx, '/api/coordination/rouleurs', s.users[role].headers)
      expect(l.statusCode).toBe(role === 'admin' ? 200 : 403)
      if (role !== 'admin') expect(await db.rouleur.count({ where: { nom: `R ${role}` } })).toBe(0)
    },
  )

  it('RG-COO-297 rejet : nom vide ou trop long (400), atelier inconnu (404), nom déjà pris dans l’atelier (409, casse ignorée) ; même nom accepté dans un autre atelier', async () => {
    const s = await siteDeroulant(ctx)
    expect((await creer(s, { nom: '  ', atelierId: s.atelier.id })).statusCode).toBe(400)
    expect((await creer(s, { nom: 'x'.repeat(101), atelierId: s.atelier.id })).statusCode).toBe(400)
    expect((await creer(s, { nom: 'A', atelierId: 0 })).statusCode).toBe(400)
    expect((await creer(s, { nom: 'A', atelierId: 99_999_999 })).statusCode).toBe(404)
    expect((await creer(s, { nom: 'Rouleur N2', atelierId: s.atelier.id })).statusCode).toBe(200)
    const doublon = await creer(s, { nom: 'rouleur n2', atelierId: s.atelier.id })
    expect(doublon.statusCode, doublon.body).toBe(409)
    expect(erreur(doublon)).toMatchObject({ code: 'COO_ROULEUR_EXISTE', regle: 'RG-COO-297' })
    expect((await creer(s, { nom: 'Rouleur N2', atelierId: s.atelier2.id })).statusCode).toBe(200)
  })

  it('RG-COO-167 périmètre : l’administrateur gère les rouleurs de tous les sites (périmètre étendu, Q-286) ; les listes de choix d’un chef d’équipe restent limitées à son atelier', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const existant = RouleurLigneSchema.parse(
      (
        await creer(s, { nom: 'Rouleur Q', atelierId: s.atelier.id }, autre.users.admin.headers)
      ).json(),
    )
    const liste = RouleursReferentielSchema.parse(
      (await get(ctx, '/api/coordination/rouleurs', autre.users.admin.headers)).json(),
    )
    expect(liste.rouleurs.some((x) => x.id === existant.id)).toBe(true)
    const choix = await get(
      ctx,
      `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
      autre.users.cheq.headers,
    )
    expect(choix.statusCode, choix.body).toBe(403)
    expect(erreur(choix).regle).toBe('RG-COO-167')
  })

  it('RG-COO-297 modification : nom, poste, désactivation puis réactivation sous verrou de version ; un rouleur désactivé n’est plus proposé ni affectable', async () => {
    const s = await siteDeroulant(ctx)
    const cree = RouleurLigneSchema.parse(
      (await creer(s, { nom: 'Rouleur M', poste: 'Table 2', atelierId: s.atelier.id })).json(),
    )
    const m = await modifier(
      cree.id,
      { version: 1, nom: 'Rouleur M2', poste: 'Table 3' },
      s.users.admin.headers,
    )
    expect(m.statusCode, m.body).toBe(200)
    expect(RouleurLigneSchema.parse(m.json())).toMatchObject({
      nom: 'Rouleur M2',
      poste: 'Table 3',
      version: 2,
    })
    const off = RouleurLigneSchema.parse(
      (await modifier(cree.id, { version: 2, actif: false }, s.users.admin.headers)).json(),
    )
    expect(off).toMatchObject({ actif: false, version: 3 })
    const choix = RouleursSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    expect(choix.rouleurs.some((x) => x.id === cree.id)).toBe(false)
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const affecter = await envoyer(ctx, '/api/coordination/trains/rouleur', s.users.cheq.headers, {
      trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
      rouleurId: cree.id,
    })
    expect(affecter.statusCode).toBe(404)
    const on = RouleurLigneSchema.parse(
      (
        await modifier(cree.id, { version: 3, actif: true, poste: null }, s.users.admin.headers)
      ).json(),
    )
    expect(on).toMatchObject({ actif: true, poste: null, version: 4 })
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'REFERENTIEL',
          entiteId: `rouleur:${String(cree.id)}`,
          action: 'MODIFICATION_ROULEUR',
        },
      }),
    ).toBe(3)
  })

  it('RG-COO-297 rejet : version périmée 409 ; rouleur inconnu 404 ; nom déjà pris 409 ; corps invalide 400 ; renommer sans changement de version : 409', async () => {
    const s = await siteDeroulant(ctx)
    const a = RouleurLigneSchema.parse(
      (await creer(s, { nom: 'Rouleur V1', atelierId: s.atelier.id })).json(),
    )
    await creer(s, { nom: 'Rouleur V2', atelierId: s.atelier.id })
    const perimee = await modifier(a.id, { version: 7, nom: 'Autre' }, s.users.admin.headers)
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-297' })
    expect(
      (await modifier(99_999_999, { version: 1, nom: 'X' }, s.users.admin.headers)).statusCode,
    ).toBe(404)
    expect(
      (await modifier(a.id, { version: 1, nom: 'rouleur v2' }, s.users.admin.headers)).statusCode,
    ).toBe(409)
    expect((await modifier(a.id, { version: 0 }, s.users.admin.headers)).statusCode).toBe(400)
    expect((await modifier(a.id, { version: 1, nom: '' }, s.users.admin.headers)).statusCode).toBe(
      400,
    )
    expect((await db.rouleur.findUniqueOrThrow({ where: { id: a.id } })).nom).toBe('Rouleur V1')
  })

  it('RG-COO-297 modification : rôle non administrateur 403 ; deux modifications simultanées sur la même version : 200 / 409', async () => {
    const s = await siteDeroulant(ctx)
    const a = RouleurLigneSchema.parse(
      (await creer(s, { nom: 'Rouleur C1', atelierId: s.atelier.id })).json(),
    )
    for (const role of ['coord', 'cheq', 'recep', 'expe', 'com'] as const)
      expect(
        (await modifier(a.id, { version: 1, nom: 'Z' }, s.users[role].headers)).statusCode,
      ).toBe(403)
    const [x, y] = await Promise.all([
      modifier(a.id, { version: 1, poste: 'Table 7' }, s.users.admin.headers),
      modifier(a.id, { version: 1, poste: 'Table 8' }, s.users.admin.headers),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-COO-297 suppression : un rouleur jamais utilisé se supprime (204, journal) ; rouleur inconnu 404', async () => {
    const s = await siteDeroulant(ctx)
    const a = RouleurLigneSchema.parse(
      (await creer(s, { nom: 'Rouleur S1', atelierId: s.atelier.id })).json(),
    )
    const r = await supprimer(a.id, s.users.admin.headers)
    expect(r.statusCode, r.body).toBe(204)
    expect(await db.rouleur.count({ where: { id: a.id } })).toBe(0)
    expect((await supprimer(a.id, s.users.admin.headers)).statusCode).toBe(404)
    for (const role of ['coord', 'cheq', 'recep', 'expe', 'com'] as const) {
      const b = RouleurLigneSchema.parse(
        (await creer(s, { nom: `S ${role}`, atelierId: s.atelier.id })).json(),
      )
      expect((await supprimer(b.id, s.users[role].headers)).statusCode).toBe(403)
      expect(await db.rouleur.count({ where: { id: b.id } })).toBe(1)
    }
  })

  it('RG-COO-297 suppression refusée (409 COO_ROULEUR_REFERENCE) pour un rouleur référencé par une face de train ou par une bague : désactivation seule', async () => {
    const s = await siteDeroulant(ctx)
    const a = RouleurLigneSchema.parse(
      (await creer(s, { nom: 'Rouleur R1', atelierId: s.atelier.id })).json(),
    )
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { rouleurId: a.id },
    })
    const r = await supprimer(a.id, s.users.admin.headers)
    expect(r.statusCode, r.body).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_ROULEUR_REFERENCE', regle: 'RG-COO-297' })
    expect(await db.rouleur.count({ where: { id: a.id } })).toBe(1)
    const liste = RouleursReferentielSchema.parse(
      (await get(ctx, '/api/coordination/rouleurs', s.users.admin.headers)).json(),
    )
    expect(liste.rouleurs.find((x) => x.id === a.id)?.utilise).toBe(true)
    // La face est libérée : la bague seule suffit encore à interdire la suppression.
    await db.faceTrain.updateMany({ where: { trainId: t.trainId }, data: { rouleurId: null } })
    await db.bague.create({
      data: {
        trainId: t.trainId,
        rouleurId: a.id,
        textes: '[]',
        imprimeeLe: new Date(),
        imprimeeParId: s.users.cheq.id,
      },
    })
    expect((await supprimer(a.id, s.users.admin.headers)).statusCode).toBe(409)
    expect(
      (await modifier(a.id, { version: 1, actif: false }, s.users.admin.headers)).statusCode,
    ).toBe(200)
  })

  it('RG-COO-297 401 sans identité sur les quatre routes', async () => {
    for (const [method, url, payload] of [
      ['GET', '/api/coordination/rouleurs', undefined],
      ['POST', '/api/coordination/rouleurs', { nom: 'A', atelierId: 1 }],
      ['PATCH', '/api/coordination/rouleurs/1', { version: 1, nom: 'A' }],
      ['DELETE', '/api/coordination/rouleurs/1', undefined],
    ] as const)
      expect(
        (
          await ctx.app.inject({
            method,
            url,
            headers: idem(),
            payload,
          })
        ).statusCode,
        `${method} ${url}`,
      ).toBe(401)
  })

  it('RG-COO-297 atomicité : un échec du journal annule la création du rouleur', async () => {
    const s = await siteDeroulant(ctx)
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.action = 'CREATION_ROULEUR'",
      () => creer(s, { nom: 'Rouleur AT-R', atelierId: s.atelier.id }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.rouleur.count({ where: { nom: 'Rouleur AT-R' } })).toBe(0)
  })

  it('RG-COO-297 les rouleurs sont distincts des utilisateurs : créer un rouleur n’ajoute aucun utilisateur ni rôle', async () => {
    const s = await siteDeroulant(ctx)
    const avant = await db.utilisateur.count()
    await creer(s, { nom: 'Rouleur U', atelierId: s.atelier.id })
    expect(await db.utilisateur.count()).toBe(avant)
  })
})
