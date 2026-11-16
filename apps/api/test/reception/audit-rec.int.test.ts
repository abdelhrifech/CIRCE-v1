// Audit REC-P04 à REC-P10 : tests MANQUANTS écrits depuis docs/RECEPTION_REGLES_METIER.md et les
// hypothèses Q-177 / Q-178 de docs/QUESTIONS_OUVERTES.md (le code est ce qui est testé, pas l'attendu).
// Chaque règle a au moins un test nominal ET un test de rejet (ou de « non-effet » quand la règle décrit
// une absence). Règles volontairement NON couvertes ici (code en cours de modification) : RG-REC-040,
// 043, 053, 066, 087, 114, 136, 178, 185, 186.
// Un écart à la règle documentée est marqué `it.fails` + commentaire `// ANOMALIE: … (RG-xxx)`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AlertesSchema,
  CompteursReceptionSchema,
  ControleSchema,
  FeuillesSchema,
  FicheAfficheSchema,
  InconnueCreeeSchema,
  InconnuesSchema,
  IntituleSuggereSchema,
  ListeAffichesSchema,
  ListeAttenduesResponseSchema,
  ReceptionCreeeSchema,
  STATUTS_INCONNUE,
  SuggestionsIntitulesSchema,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
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
type H = Record<string, string>

// ── Outils ──

const fiche = async (id: number, headers: H) =>
  FicheAfficheSchema.parse((await get(ctx, `/api/affiches/${String(id)}`, headers)).json())

const liste = async (headers: H, query = '') =>
  ListeAffichesSchema.parse((await get(ctx, `/api/affiches${query}`, headers)).json())

const feuilles = async (ids: number[], headers: H) =>
  FeuillesSchema.parse((await get(ctx, `/api/feuilles?ids=${ids.join(',')}`, headers)).json())
    .feuilles

const patch = (id: number, headers: H, payload: object) =>
  ctx.app.inject({ method: 'PATCH', url: `/api/affiches/${String(id)}`, headers, payload })

const lireControle = async (receptionId: number, headers: H) =>
  ControleSchema.parse(
    (await get(ctx, `/api/receptions/${String(receptionId)}/controle`, headers)).json(),
  )

/** « Valider le contrôle » de toute la palette : quantité comptée = BL, rangée en B-7 (surchargeable). */
async function controler(
  receptionId: number,
  headers: H,
  controleurId: number,
  surcharge: Record<string, unknown> = {},
) {
  const c = await lireControle(receptionId, headers)
  return post(ctx, `/api/receptions/${String(receptionId)}/controle`, headers, {
    version: c.version,
    controleurId,
    lignes: c.lignes.map((l) => ({
      afficheId: l.afficheId,
      qteComptee: l.quantiteBl,
      allee: 'B',
      rayon: '7',
      ...surcharge,
    })),
  })
}

async function formulaireInconnue(s: Site, surcharge: Record<string, unknown> = {}) {
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
    numeroBl: `BL-INC-${String(Date.now())}`,
    ...surcharge,
  }
}

async function inconnue(s: Site, surcharge: Record<string, unknown> = {}) {
  const r = await post(
    ctx,
    '/api/receptions-inconnues',
    s.headers,
    await formulaireInconnue(s, surcharge),
  )
  if (r.statusCode !== 201) throw new Error(r.body)
  return InconnueCreeeSchema.parse(r.json())
}

async function rattacherInconnue(
  afficheId: number,
  headers: H,
  ligneAttendueId: number,
  qte: number,
) {
  const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  return post(ctx, `/api/affiches/${String(afficheId)}/rattacher-inconnue`, headers, {
    version: a.version,
    lignes: [{ ligneAttendueId, quantite: qte }],
  })
}

async function rattacherAutre(afficheId: number, headers: H, ligneAttendueId: number, qte: number) {
  const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  return post(ctx, `/api/affiches/${String(afficheId)}/rattachements`, headers, {
    version: a.version,
    ligneAttendueId,
    quantite: qte,
  })
}

async function signaler(afficheId: number, receptionId: number, headers: H) {
  const rec = await db.reception.findUniqueOrThrow({ where: { id: receptionId } })
  return post(ctx, `/api/affiches/${String(afficheId)}/signaler`, headers, {
    receptionVersion: rec.version,
  })
}

const imprimer = (afficheIds: number[], headers: H, contenu = 'FEUILLE', exemplaires = 1) =>
  post(ctx, '/api/impressions', headers, { afficheIds, contenu, exemplaires })

async function validationAdmin(afficheId: number, headers: H, valider = true) {
  const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  return post(ctx, `/api/affiches/${String(afficheId)}/validation-admin`, headers, {
    version: a.version,
    valider,
  })
}

const TOUS_STATUTS = STATUTS_INCONNUE.map((s) => `statut=${s}`).join('&')
const statutInconnue = async (headers: H, afficheId: number) =>
  InconnuesSchema.parse(
    (await get(ctx, `/api/receptions-inconnues?${TOUS_STATUTS}`, headers)).json(),
  ).items.find((i) => i.afficheId === afficheId)?.statut

const compteurs = async (headers: H) =>
  CompteursReceptionSchema.parse((await get(ctx, '/api/reception/compteurs', headers)).json())

const alertes = async (headers: H) =>
  AlertesSchema.parse((await get(ctx, '/api/alertes/reception', headers)).json()).alertes

const journal = (afficheId: number, action: string) =>
  db.journalAudit.findMany({
    where: { typeEntite: 'AFFICHE', entiteId: String(afficheId), action: action as never },
  })

/** Réception validée dont le lien unique est ramené à `lien` : `qte - lien` exemplaires restent à répartir. */
async function avecSurplus(s: Site, qte: number, lien: number, data = {}) {
  const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, qte, data)
  await db.afficheAttendue.updateMany({
    where: { afficheId: rv.afficheId },
    data: { quantite: lien },
  })
  return rv
}

/** Arbre des routes enregistrées (RG-REC-191 / 193 : fonctions absentes). */
const routes = () => ctx.app.printRoutes({ commonPrefix: false })

// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('RG-REC-073 corrections a posteriori : pas d’édition, des mouvements d’écart (Q-121)', () => {
  it('RG-REC-073 un comptage inférieur au BL est corrigé par un mouvement d’écart ; le mouvement de réception et le BL restent intacts', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 10)
    const recep = await db.mouvement.findFirstOrThrow({
      where: { afficheId: rv.afficheId, type: 'RECEPTION' },
    })
    const rec = await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })
    const livraison = await db.livraison.findUniqueOrThrow({ where: { id: rec.livraisonId ?? 0 } })
    expect(
      (await controler(rv.receptionId, s.headers, s.user.id, { qteComptee: 8 })).statusCode,
    ).toBe(200)
    const mvts = await db.mouvement.findMany({
      where: { afficheId: rv.afficheId },
      orderBy: { id: 'asc' },
    })
    expect(mvts).toHaveLength(2)
    expect(mvts[0]).toEqual(recep)
    expect(mvts[1]).toMatchObject({ type: 'ECART_CONTROLE', quantite: -2 })
    expect(await db.livraison.findUniqueOrThrow({ where: { id: livraison.id } })).toEqual(livraison)
    expect((await fiche(rv.afficheId, s.headers)).enStock).toBe(8)
  })

  it.each([['PATCH'], ['PUT']] as const)(
    'RG-REC-073 aucune édition de l’en-tête de réception : %s /api/receptions/:id n’existe pas (404), rien ne change',
    async (method) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
      const avant = await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })
      const r = await ctx.app.inject({
        method,
        url: `/api/receptions/${String(rv.receptionId)}`,
        headers: s.headers,
        payload: { numeroBl: 'AUTRE', nbColis: 9, lignes: [] },
      })
      expect(r.statusCode).toBe(404)
      expect(await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })).toEqual(avant)
    },
  )

  it('RG-REC-073 / RG-REC-074 une réception ne se supprime pas : 409 REC_SUPPRESSION_INTERDITE, elle reste', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    const r = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/receptions/${String(rv.receptionId)}`,
      headers: s.headers,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'REC_SUPPRESSION_INTERDITE', regle: 'RG-REC-074' })
    expect(await db.reception.count({ where: { id: rv.receptionId } })).toBe(1)
  })

  it.each([['PUT'], ['PATCH'], ['DELETE']] as const)(
    'RG-REC-073 / RG-REC-151 %s sur un mouvement de réception : 409 REC_MOUVEMENT_IMMUABLE, le mouvement est intact',
    async (method) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
      const m = await db.mouvement.findFirstOrThrow({ where: { afficheId: rv.afficheId } })
      const r = await ctx.app.inject({
        method,
        url: `/api/mouvements/${String(m.id)}`,
        headers: s.headers,
        ...(method === 'DELETE' ? {} : { payload: { quantite: 1 } }),
      })
      expect(r.statusCode).toBe(409)
      expect(erreur(r)).toMatchObject({ code: 'REC_MOUVEMENT_IMMUABLE', regle: 'RG-REC-151' })
      expect(await db.mouvement.findUniqueOrThrow({ where: { id: m.id } })).toEqual(m)
    },
  )
})

describe('RG-REC-076 / 077 / 078 feuilles de stock : GET /api/feuilles', () => {
  it.each([['coord'], ['cheq'], ['recep']] as const)(
    'RG-REC-076 le profil %s obtient une feuille par affiche demandée, dans l’ordre, avec le nombre d’exemplaires par défaut',
    async (role) => {
      const s = await site(ctx)
      const u = await autre(ctx, s.plateforme.id, [role])
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      const inc = await inconnue(s)
      const r = await get(
        ctx,
        `/api/feuilles?ids=${String(inc.afficheId)},${String(rv.afficheId)}`,
        u.headers,
      )
      expect(r.statusCode).toBe(200)
      const body = FeuillesSchema.parse(r.json())
      expect(body.feuilles.map((x) => x.afficheId)).toEqual([inc.afficheId, rv.afficheId])
      expect(body.exemplairesParDefaut).toBeGreaterThanOrEqual(1)
      expect(body.exemplairesParDefaut).toBeLessThanOrEqual(5)
    },
  )

  it('RG-REC-076 feuille d’une affiche inexistante : 404', async () => {
    const s = await site(ctx)
    expect((await get(ctx, '/api/feuilles?ids=999999999', s.headers)).statusCode).toBe(404)
  })

  it('RG-REC-076 liste d’identifiants mal formée : 400', async () => {
    const s = await site(ctx)
    expect((await get(ctx, '/api/feuilles?ids=12,abc', s.headers)).statusCode).toBe(400)
  })

  it.each([['expe']] as const)(
    'RG-REC-076 / RG-REC-002 le profil %s n’obtient pas de feuille de stock (403)',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      const u = await autre(ctx, s.plateforme.id, [role])
      const r = await get(ctx, `/api/feuilles?ids=${String(rv.afficheId)}`, u.headers)
      expect(r.statusCode).toBe(403)
    },
  )

  it('RG-REC-077 affiche avec dossier : mention DÉFINITIVE et dossier identifié', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const [fe] = await feuilles([rv.afficheId], s.headers)
    expect(fe).toMatchObject({ type: 'DEFINITIVE', dossiers: [rv.ligne.contNum] })
  })

  it('RG-REC-077 réception inconnue sans dossier : mention TEMPORAIRE (pas DÉFINITIVE), zone tampon, aucun dossier', async () => {
    const s = await site(ctx)
    const inc = await inconnue(s, { allee: 'x', rayon: '4' })
    const [fe] = await feuilles([inc.afficheId], s.headers)
    expect(fe).toMatchObject({ type: 'TEMPORAIRE', dossiers: [], adressage: 'X - 4' })
  })

  it('RG-REC-078 contenu : format, date, adressage, quantité, dossier, semaines, annonceur, thème, commentaire, à conserver, 1er départ, tableau (Départ « S43 /2026 », Qté prépa., DA)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 10, {
      supportId: s.support.id,
      semAnnee: 2026,
      semNum: 43,
      format: 'F 4x3',
      idDaChapeau: 4242,
      qteBc: 10,
    })
    expect((await controler(rv.receptionId, s.headers, s.user.id)).statusCode).toBe(200)
    const a0 = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    expect(
      (
        await patch(rv.afficheId, s.headers, {
          version: a0.version,
          commentaire: 'Note affiche',
          aConserver: true,
        })
      ).statusCode,
    ).toBe(200)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const [fe] = await feuilles([rv.afficheId], s.headers)
    expect(fe).toMatchObject({
      afficheId: rv.afficheId,
      format: s.support.nom,
      dateReception: a.dateEntree.toISOString(),
      adressage: 'B - 7',
      quantite: 10,
      dossiers: [rv.ligne.contNum],
      semaines: ['2026-W43'],
      premierDepart: '2026-W43',
      annonceur: 'ANNONCEUR',
      theme: 'Thème A',
      commentaire: 'Note affiche',
      aConserver: true,
      lignes: [
        {
          dossier: rv.ligne.contNum,
          theme: 'Thème A',
          annonceur: 'ANNONCEUR',
          format: 'F 4x3',
          depart: 'S43 /2026',
          qtePrepa: 10,
          da: 4242,
        },
      ],
    })
  })

  it('RG-REC-078 valeur limite : quantité théorique NULL imprimée 0 (jamais vide)', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, supportId: s.support.id })
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      qteBc: null,
      qtePrepa: null,
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const [fe] = await feuilles([a.id], s.headers)
    expect(fe?.lignes).toMatchObject([{ qtePrepa: 0 }])
  })

  it('RG-REC-078 un rattachement retiré n’apparaît pas dans le tableau de la feuille', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const retiree = await ligne(ctx, s.plateforme.id)
    await f.createRattachement(db, {
      afficheId: rv.afficheId,
      ligneAttendueId: retiree.id,
      quantite: 1,
      mode: 'MAIN',
      actif: false,
    })
    const [fe] = await feuilles([rv.afficheId], s.headers)
    expect(fe?.lignes.map((x) => x.dossier)).toEqual([rv.ligne.contNum])
    expect(fe?.dossiers).toEqual([rv.ligne.contNum])
  })

  it('RG-REC-078 commentaire = commentaire de l’affiche + deux espaces + commentaire de la réception', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    await db.affiche.update({
      where: { id: rv.afficheId },
      data: { commentaire: 'Note affiche' },
    })
    await db.reception.update({ where: { id: rv.receptionId }, data: { commentaire: 'Note BL' } })
    const [fe] = await feuilles([rv.afficheId], s.headers)
    expect(fe?.commentaire).toBe('Note affiche  Note BL')
  })
})

describe('RG-REC-095 formulaire de création d’une réception inconnue', () => {
  it('RG-REC-095 tous les champs du formulaire sont acceptés et portés par la réception, la livraison et l’affiche', async () => {
    const s = await site(ctx)
    const imp = await f.createImprimeur(db)
    const photoAffiche = await photo(ctx, s.headers)
    const c = await inconnue(s, {
      annonceur: 'Annonceur lu',
      theme: 'Thème lu',
      imprimeurId: imp.id,
      quantite: 7,
      allee: 'x',
      rayon: '3',
      photoAfficheId: photoAffiche,
      numeroBl: 'BL-095',
    })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    expect(a).toMatchObject({
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contAnnonc: 'Annonceur lu',
      theme: 'Thème lu',
      imprimeurId: imp.id,
      photoId: photoAffiche,
      allee: 'X',
      rayon: '3',
      statut: 'ORPHELINE',
    })
    const rec = await db.reception.findUniqueOrThrow({
      where: { id: c.receptionId },
      include: { livraison: true },
    })
    expect(rec).toMatchObject({ estInconnue: true, plateformeId: s.plateforme.id })
    expect(rec.livraison).toMatchObject({ reference: 'BL-095', imprimeurId: imp.id })
    expect(await db.mouvement.findMany({ where: { afficheId: a.id } })).toMatchObject([
      { type: 'RECEPTION', quantite: 7 },
    ])
  })

  it('RG-REC-095 un champ hors formulaire (statut, validation admin, dossier) est ignoré : l’affiche reste ORPHELINE, non validée, sans dossier', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { statut: 'IDENTIFIEE', validationAdmin: true, contNum: 123456 })
    expect(await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).toMatchObject({
      statut: 'ORPHELINE',
      validationAdmin: false,
      contNum: null,
    })
  })

  it('RG-REC-095 format inconnu : 422 REC_REFERENTIEL_INCONNU, rien n’est écrit', async () => {
    const s = await site(ctx)
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaireInconnue(s, { supportId: 999999999 }),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_REFERENTIEL_INCONNU', regle: 'RG-REC-095' })
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(await db.affiche.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })

  it('RG-REC-095 imprimeur désactivé : 422 REC_REFERENTIEL_INCONNU, rien n’est écrit', async () => {
    const s = await site(ctx)
    const imp = await f.createImprimeur(db, { actif: false })
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaireInconnue(s, { imprimeurId: imp.id }),
    )
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_REFERENTIEL_INCONNU')
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })

  // ANO-014 corrigée : l'erreur citait RG-REC-179 au lieu de RG-REC-035 (RG-REC-095 / RG-REC-035).
  it('RG-REC-095 imprimeur désactivé : la règle citée est RG-REC-035 (liste fermée des imprimeurs)', async () => {
    const s = await site(ctx)
    const imp = await f.createImprimeur(db, { actif: false })
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaireInconnue(s, { imprimeurId: imp.id }),
    )
    expect(erreur(r).regle).toBe('RG-REC-035')
  })

  it.each([
    ['annonceur de plus de 100 caractères', { annonceur: 'A'.repeat(101) }],
    ['quantité non entière', { quantite: 1.5 }],
    ['allée de plus de 10 caractères', { allee: 'X'.repeat(11) }],
  ] as const)('RG-REC-095 refuse %s (400), rien n’est écrit', async (_cas, surcharge) => {
    const s = await site(ctx)
    const r = await post(
      ctx,
      '/api/receptions-inconnues',
      s.headers,
      await formulaireInconnue(s, surcharge),
    )
    expect(r.statusCode).toBe(400)
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
  })
})

describe('RG-REC-115 affiche orpheline = aucun rattachement actif', () => {
  it('RG-REC-115 une affiche sans aucun lien actif est orpheline (statut, filtre « Orpheline », badge)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).statut).toBe(
      'ORPHELINE',
    )
    expect((await liste(s.headers, '?tag=ORPHELINE')).items.map((a) => a.id)).toEqual([c.afficheId])
    expect((await compteurs(s.headers)).affichesOrphelines).toBe(1)
  })

  it('RG-REC-115 un lien retiré ne compte pas, mais un lien actif restant suffit : l’affiche n’est pas orpheline', async () => {
    const s = await site(ctx)
    const rv = await avecSurplus(s, 10, 6)
    const l2 = await ligne(ctx, s.plateforme.id)
    expect((await rattacherAutre(rv.afficheId, s.headers, l2.id, 4)).statusCode).toBe(200)
    const premier = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, ligneAttendueId: rv.ligne.id },
    })
    const r = await post(ctx, `/api/rattachements/${String(premier.id)}/retrait`, s.headers, {
      lienVersion: premier.version,
    })
    expect(r.statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).statut).toBe(
      'IDENTIFIEE',
    )
    expect((await liste(s.headers, '?tag=ORPHELINE')).items).toEqual([])
    expect((await compteurs(s.headers)).affichesOrphelines).toBe(0)
  })
})

describe('RG-REC-119 statut calculé d’une réception inconnue (GET /api/receptions-inconnues)', () => {
  it('RG-REC-119 À identifier → Rattachée à contrôler → Contrôlée, feuille définitive à imprimer → Rattachée, feuille définitive', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 6 })
    expect(await statutInconnue(s.headers, c.afficheId)).toBe('A_IDENTIFIER')
    const l = await ligne(ctx, s.plateforme.id)
    expect((await rattacherInconnue(c.afficheId, s.headers, l.id, 6)).statusCode).toBe(200)
    expect(await statutInconnue(s.headers, c.afficheId)).toBe('RATTACHEE_A_CONTROLER')
    expect((await controler(c.receptionId, s.headers, s.user.id)).statusCode).toBe(200)
    expect(await statutInconnue(s.headers, c.afficheId)).toBe(
      'CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER',
    )
    expect((await imprimer([c.afficheId], s.headers)).statusCode).toBe(200)
    expect(await statutInconnue(s.headers, c.afficheId)).toBe('RATTACHEE_FEUILLE_DEFINITIVE')
  })

  it('RG-REC-119 À identifier → « Signaler » → Signalée (INTROUVABLE)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    expect((await signaler(c.afficheId, c.receptionId, s.headers)).statusCode).toBe(200)
    expect(await statutInconnue(s.headers, c.afficheId)).toBe('INTROUVABLE')
  })

  it('RG-REC-119 À identifier : « Valider et imprimer » (contrôle) n’est pas une action de l’état → 409 RG-REC-071', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    const r = await post(ctx, `/api/receptions/${String(c.receptionId)}/controle`, s.headers, {
      version: rec.version,
      controleurId: s.user.id,
      lignes: [{ afficheId: c.afficheId, qteComptee: 12, allee: 'B', rayon: '7' }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      code: 'REC_CONTROLE_INTERDIT_A_IDENTIFIER',
      regle: 'RG-REC-071',
    })
    expect(await statutInconnue(s.headers, c.afficheId)).toBe('A_IDENTIFIER')
  })

  it('RG-REC-119 Signalée : « Signaler » une seconde fois n’est pas proposé → 409 RG-REC-112', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    await signaler(c.afficheId, c.receptionId, s.headers)
    const r = await signaler(c.afficheId, c.receptionId, s.headers)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'REC_SIGNALEMENT_INTERDIT', regle: 'RG-REC-112' })
  })

  it('RG-REC-119 Contrôlée, feuille définitive à imprimer : « Rattacher » n’est pas proposé → 409 RG-REC-107', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 6 })
    const l = await ligne(ctx, s.plateforme.id)
    await rattacherInconnue(c.afficheId, s.headers, l.id, 3)
    await controler(c.receptionId, s.headers, s.user.id)
    const l2 = await ligne(ctx, s.plateforme.id)
    const r = await rattacherInconnue(c.afficheId, s.headers, l2.id, 1)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'REC_RATTACHER_NON_ORPHELINE', regle: 'RG-REC-107' })
    expect(await statutInconnue(s.headers, c.afficheId)).toBe(
      'CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER',
    )
  })

  it('RG-REC-119 Rattachée, feuille définitive : ni « Rattacher », ni « Signaler », ni nouveau contrôle (409)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 6 })
    const l = await ligne(ctx, s.plateforme.id)
    await rattacherInconnue(c.afficheId, s.headers, l.id, 6)
    await controler(c.receptionId, s.headers, s.user.id)
    await imprimer([c.afficheId], s.headers)
    expect(await statutInconnue(s.headers, c.afficheId)).toBe('RATTACHEE_FEUILLE_DEFINITIVE')
    const l2 = await ligne(ctx, s.plateforme.id)
    const r1 = await rattacherInconnue(c.afficheId, s.headers, l2.id, 1)
    expect(r1.statusCode).toBe(409)
    expect(erreur(r1).regle).toBe('RG-REC-107')
    const r2 = await signaler(c.afficheId, c.receptionId, s.headers)
    expect(r2.statusCode).toBe(409)
    expect(erreur(r2).regle).toBe('RG-REC-112')
    const rec = await db.reception.findUniqueOrThrow({ where: { id: c.receptionId } })
    const r3 = await post(ctx, `/api/receptions/${String(c.receptionId)}/controle`, s.headers, {
      version: rec.version,
      controleurId: s.user.id,
      lignes: [{ afficheId: c.afficheId, qteComptee: 6, allee: 'B', rayon: '7' }],
    })
    expect(r3.statusCode).toBe(409)
    expect(erreur(r3).regle).toBe('RG-REC-070')
  })
})

describe('RG-REC-138 rattachement manuel après validation admin', () => {
  async function valideeAvecSurplus() {
    const s = await site(ctx)
    const coord = await autre(ctx, s.plateforme.id, ['coord'])
    const rv = await avecSurplus(s, 10, 6)
    const v = await validationAdmin(rv.afficheId, coord.headers)
    if (v.statusCode !== 200) throw new Error(v.body)
    return { s, coord, rv }
  }

  it.each([['coord'], ['recep']] as const)(
    'RG-REC-138 le profil %s rattache le surplus à un autre dossier après la validation admin, avec historique',
    async (role) => {
      const { s, coord, rv } = await valideeAvecSurplus()
      const u = role === 'coord' ? coord : { user: s.user, headers: s.headers }
      const l2 = await ligne(ctx, s.plateforme.id)
      const r = await rattacherAutre(rv.afficheId, u.headers, l2.id, 4)
      expect(r.statusCode).toBe(200)
      expect(
        await db.afficheAttendue.count({
          where: { afficheId: rv.afficheId, ligneAttendueId: l2.id, actif: true },
        }),
      ).toBe(1)
      const assoc = await journal(rv.afficheId, 'AFFICHE_ASSOCIER')
      expect(
        assoc.some(
          (j) => j.parId === u.user.id && j.nouvelleValeur?.includes(`ligne ${String(l2.id)}`),
        ),
      ).toBe(true)
    },
  )

  it('RG-REC-138 seul le surplus se rattache : au-delà, 422 REC_REPARTITION_DEPASSE, aucun lien, validation conservée', async () => {
    const { s, coord, rv } = await valideeAvecSurplus()
    const l2 = await ligne(ctx, s.plateforme.id)
    const r = await rattacherAutre(rv.afficheId, coord.headers, l2.id, 5)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_REPARTITION_DEPASSE', regle: 'RG-X-060' })
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l2.id } })).toBe(0)
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).validationAdmin,
    ).toBe(true)
  })

  it('RG-REC-138 dossier d’une autre plateforme : pas de rattachement (transfert puis réception) → 422 RG-REC-024', async () => {
    const { s, rv } = await valideeAvecSurplus()
    const p2 = await f.createPlateforme(db)
    const coord2 = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s.plateforme.id }, { plateformeId: p2.id }],
    )
    const l2 = await ligne(ctx, p2.id)
    const r = await rattacherAutre(rv.afficheId, devHeaders(coord2.identifiantExterne), l2.id, 2)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      code: 'REC_RATTACHEMENT_AUTRE_PLATEFORME',
      regle: 'RG-REC-024',
    })
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l2.id } })).toBe(0)
  })
})

describe('RG-REC-143 date de dernier départ', () => {
  it('RG-REC-143 vendredi de la semaine la plus tardive, année comprise (2026-W52 + 2027-W01 → 8 janvier 2027), recalculé au retrait', async () => {
    const s = await site(ctx)
    const rv = await avecSurplus(s, 10, 6, { semAnnee: 2026, semNum: 52 })
    expect((await fiche(rv.afficheId, s.headers)).dateDernierDepart).toBe(
      '2026-12-25T00:00:00.000Z',
    )
    const l2 = await ligne(ctx, s.plateforme.id, { semAnnee: 2027, semNum: 1 })
    expect((await rattacherAutre(rv.afficheId, s.headers, l2.id, 4)).statusCode).toBe(200)
    // Legacy (max semaine et max année séparés) donnerait 2027-W52 : interdit.
    expect((await fiche(rv.afficheId, s.headers)).dateDernierDepart).toBe(
      '2027-01-08T00:00:00.000Z',
    )
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, ligneAttendueId: l2.id },
    })
    expect(
      (
        await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
          lienVersion: lien.version,
        })
      ).statusCode,
    ).toBe(200)
    expect((await fiche(rv.afficheId, s.headers)).dateDernierDepart).toBe(
      '2026-12-25T00:00:00.000Z',
    )
  })

  it('RG-REC-143 sans aucun lien (réception inconnue) : pas de date de dernier départ (null)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    expect((await fiche(c.afficheId, s.headers)).dateDernierDepart).toBeNull()
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).dateDernierDepart,
    ).toBeNull()
  })
})

describe('RG-REC-144 conservation : valeur par défaut', () => {
  it('RG-REC-144 conservation à 0 affichée 20, sans être persistée par la lecture', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, conservation: 0 })
    expect((await fiche(a.id, s.headers)).conservation).toBe(20)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).conservation).toBe(0)
  })

  it('RG-REC-144 une conservation renseignée (> 0) n’est pas remplacée par 20', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, conservation: 8 })
    expect((await fiche(a.id, s.headers)).conservation).toBe(8)
  })

  it.each([
    ['2026-05-25T00:00:00.000Z', false],
    ['2026-05-26T00:00:00.000Z', true],
  ] as const)(
    'RG-REC-144 valeur limite « dernier départ dépassé » (entrée + 7 × 20 j) : dernier départ %s → %s',
    async (date, depasse) => {
      const s = await site(ctx)
      const a = await f.createAffiche(db, {
        plateformeId: s.plateforme.id,
        conservation: 0,
        dateEntree: new Date('2026-01-05T00:00:00.000Z'),
        dateDernierDepart: new Date(date),
      })
      expect((await fiche(a.id, s.headers)).dernierDepartDepasse).toBe(depasse)
    },
  )
})

describe('RG-REC-175 validation admin sans condition de quantité', () => {
  it.each([['coord'], ['admin']] as const)(
    'RG-REC-175 le profil %s valide une affiche reçue en partie (reçu < attendu)',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
      expect(
        (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).statut,
      ).toBe('PARTIELLE')
      const u = await autre(ctx, s.plateforme.id, [role])
      const r = await validationAdmin(rv.afficheId, u.headers)
      expect(r.statusCode).toBe(200)
      expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
        validationAdmin: true,
        validationAdminParId: u.user.id,
      })
    },
  )

  it.each([['com'], ['expe'], ['recep'], ['cheq']] as const)(
    'RG-REC-175 sans le droit (profil %s) : 403 REC_VALIDATION_RESERVEE, rien n’est écrit',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
      const u = await autre(ctx, s.plateforme.id, [role])
      const r = await validationAdmin(rv.afficheId, u.headers)
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'REC_VALIDATION_RESERVEE', regle: 'RG-REC-003' })
      expect(
        (await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).validationAdmin,
      ).toBe(false)
      expect(await journal(rv.afficheId, 'VALIDATION_ADMIN')).toEqual([])
    },
  )
})

describe('RG-REC-191 mails à la réception supprimés', () => {
  it('RG-REC-191 aucune route d’envoi de mail ; valider une réception et créer une inconnue ne journalisent aucun mail', async () => {
    expect(routes()).not.toMatch(/mail/i)
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const c = await inconnue(s)
    const actions = (
      await db.journalAudit.findMany({
        where: {
          OR: [
            {
              typeEntite: 'RECEPTION',
              entiteId: { in: [String(rv.receptionId), String(c.receptionId)] },
            },
            {
              typeEntite: 'AFFICHE',
              entiteId: { in: [String(rv.afficheId), String(c.afficheId)] },
            },
          ],
        },
      })
    ).map((j) => j.action)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.filter((a) => /MAIL/i.test(a))).toEqual([])
  })

  it.each([
    ['/api/mails'],
    ['/api/mail'],
    ['/api/notifications/mail'],
    ['/api/receptions/1/mail'],
    ['/api/receptions-inconnues/mail'],
  ] as const)('RG-REC-191 POST %s : 404 (fonction absente)', async (url) => {
    const s = await site(ctx)
    const r = await post(ctx, url, s.headers, { a: 'commercial@exemple.fr' })
    expect(r.statusCode).toBe(404)
  })
})

describe('RG-REC-193 colonne « Ordre », étiquette de palette, douchette : refusés', () => {
  it('RG-REC-193 le panier n’a pas d’ordre : les lignes attendues n’exposent pas de colonne « ordre » et un « ordre » envoyé est sans effet', async () => {
    expect(routes()).not.toMatch(/etiquette-palette|douchette|\/ordre/i)
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const brut = (await get(ctx, '/api/receptions-attendues?statut=tous', s.headers)).json<{
      items: Record<string, unknown>[]
    }>()
    ListeAttenduesResponseSchema.parse(brut)
    // Lecture du JSON brut : le parse Zod retirerait une clé « ordre » inattendue.
    const item = brut.items.find((i) => i['id'] === l.id)
    expect(item).toBeDefined()
    expect(Object.keys(item ?? {})).not.toContain('ordre')
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 3 }])
    const r = await post(ctx, '/api/receptions', s.headers, {
      ...bl,
      lignes: bl.lignes.map((x) => ({ ...x, ordre: 2 })),
    })
    expect(r.statusCode).toBe(201)
    expect(ReceptionCreeeSchema.parse(r.json()).affiches).toHaveLength(1)
  })

  it('RG-REC-193 « étiquette de palette » n’est pas un contenu d’impression (400), rien n’est écrit', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const avant = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await imprimer([rv.afficheId], s.headers, 'ETIQUETTE_PALETTE')
    expect(r.statusCode).toBe(400)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toEqual(avant)
  })

  it.each([
    ['/api/receptions/1/etiquette-palette'],
    ['/api/etiquettes-palette'],
    ['/api/panier/ordre'],
    ['/api/douchette'],
  ] as const)('RG-REC-193 POST %s : 404 (fonction absente)', async (url) => {
    const s = await site(ctx)
    expect((await post(ctx, url, s.headers, {})).statusCode).toBe(404)
  })
})

// ── Règles qui n'avaient qu'un test nominal : ajout du rejet (et d'un nominal ciblé quand utile) ──

describe('RG-REC-044 « affiche reçue » = un mouvement de réception existe', () => {
  it('RG-REC-044 reçue dès l’arrivée, indépendamment de la validation admin (non validée)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      validationAdmin: false,
    })
    expect(
      await db.mouvement.count({
        where: { afficheId: rv.afficheId, type: 'RECEPTION', quantite: 3 },
      }),
    ).toBe(1)
  })

  it('RG-REC-044 une validation refusée (BL sans photo) ne crée ni affiche ni mouvement : la ligne reste non reçue', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 3 }])
    const r = await post(ctx, '/api/receptions', s.headers, { ...bl, photoBlId: null })
    expect(r.statusCode).toBe(422)
    expect(await db.affiche.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l.id } })).toBe(0)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'ATTENDUE',
    )
  })
})

describe('RG-REC-045 après validation : seules les lignes cochées partent', () => {
  it('RG-REC-045 la réception n’emporte que les lignes cochées : la ligne non cochée n’a ni affiche ni lien', async () => {
    const s = await site(ctx)
    const [l1, l2] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l1.id, quantite: 3 },
      { ligneAttendueId: l2.id, quantite: 4 },
    ])
    const r = await post(ctx, '/api/receptions', s.headers, {
      ...bl,
      lignes: bl.lignes.map((x) => (x.ligneAttendueId === l2.id ? { ...x, cochee: false } : x)),
    })
    expect(r.statusCode).toBe(201)
    expect(ReceptionCreeeSchema.parse(r.json()).affiches.map((a) => a.ligneAttendueId)).toEqual([
      l1.id,
    ])
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l2.id } })).toBe(0)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l2.id } })).statut).toBe(
      'ATTENDUE',
    )
  })

  it('RG-REC-045 la ligne non cochée reste disponible pour le BL suivant ; seule au panier, elle ne crée rien (422)', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id)
    const bl = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 3 }])
    const refus = await post(ctx, '/api/receptions', s.headers, {
      ...bl,
      lignes: bl.lignes.map((x) => ({ ...x, cochee: false })),
    })
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus)).toMatchObject({ code: 'REC_AUCUNE_LIGNE_COCHEE', regle: 'RG-REC-022' })
    expect(await db.reception.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    const suivant = await bonDeLivraison(ctx, s.headers, [{ ligneAttendueId: l.id, quantite: 3 }])
    expect((await post(ctx, '/api/receptions', s.headers, suivant)).statusCode).toBe(201)
  })
})

describe('RG-REC-048 intitulé de thème : « 1er qui a parlé »', () => {
  it('RG-REC-048 deux intitulés déjà saisis ailleurs : c’est le premier (plus ancien) qui est proposé', async () => {
    const s = await site(ctx)
    const [p2, p3] = await Promise.all([f.createPlateforme(db), f.createPlateforme(db)])
    const l = await ligne(ctx, s.plateforme.id, {
      theme: null,
      themeCle: null,
      contNum: 880000 + Math.floor(Math.random() * 9999),
    })
    const premier = await f.createAffiche(db, {
      plateformeId: p2.id,
      contNum: l.contNum,
      theme: 'Premier intitulé',
    })
    await f.createAffiche(db, { plateformeId: p3.id, contNum: l.contNum, theme: 'Second intitulé' })
    const r = await get(ctx, `/api/lignes-attendues/${String(l.id)}/intitule-suggere`, s.headers)
    expect(IntituleSuggereSchema.parse(r.json())).toEqual({
      intitule: 'Premier intitulé',
      site: p2.nom,
      afficheId: premier.id,
    })
  })

  it('RG-REC-048 IP saisies (thème connu) : rien à proposer', async () => {
    const s = await site(ctx)
    const p2 = await f.createPlateforme(db)
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: 881000 + Math.floor(Math.random() * 999),
    })
    await f.createAffiche(db, { plateformeId: p2.id, contNum: l.contNum, theme: 'Autre intitulé' })
    const r = await get(ctx, `/api/lignes-attendues/${String(l.id)}/intitule-suggere`, s.headers)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toBeNull()
  })

  it('RG-REC-048 un intitulé saisi sur la MÊME plateforme n’est pas proposé (seule l’autre plateforme a « parlé »)', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id, {
      theme: null,
      themeCle: null,
      contNum: 882000 + Math.floor(Math.random() * 999),
    })
    await f.createAffiche(db, { plateformeId: s.plateforme.id, contNum: l.contNum, theme: 'Ici' })
    const r = await get(ctx, `/api/lignes-attendues/${String(l.id)}/intitule-suggere`, s.headers)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toBeNull()
  })
})

describe('RG-REC-054 badge : palettes à contrôler', () => {
  it('RG-REC-054 le badge monte à la validation et au rattachement d’une inconnue, baisse au contrôle', async () => {
    const s = await site(ctx)
    expect((await compteurs(s.headers)).palettesAControler).toBe(0)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    expect((await compteurs(s.headers)).palettesAControler).toBe(1)
    const c = await inconnue(s, { quantite: 2 })
    const l = await ligne(ctx, s.plateforme.id)
    await rattacherInconnue(c.afficheId, s.headers, l.id, 2)
    expect((await compteurs(s.headers)).palettesAControler).toBe(2)
    expect((await controler(rv.receptionId, s.headers, s.user.id)).statusCode).toBe(200)
    expect((await compteurs(s.headers)).palettesAControler).toBe(1)
  })

  it('RG-REC-054 une réception inconnue À identifier n’est pas comptée', async () => {
    const s = await site(ctx)
    await inconnue(s)
    expect((await compteurs(s.headers)).palettesAControler).toBe(0)
  })

  it.each([['expe']] as const)(
    'RG-REC-054 le profil %s (sans accès au sas) n’a pas de badge (null)',
    async (role) => {
      const s = await site(ctx)
      await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      const u = await autre(ctx, s.plateforme.id, [role])
      expect((await compteurs(u.headers)).palettesAControler).toBeNull()
    },
  )
})

describe('RG-REC-062 zone tampon et sortie', () => {
  it('RG-REC-062 avant contrôle : zone tampon (allée / rayon vides) ; le contrôle range et historise « sortie de la zone tampon »', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      allee: null,
      rayon: null,
    })
    expect((await controler(rv.receptionId, s.headers, s.user.id)).statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      allee: 'B',
      rayon: '7',
    })
    expect(await journal(rv.afficheId, 'MODIFICATION_EMPLACEMENT')).toMatchObject([
      { ancienneValeur: '—-—', nouvelleValeur: 'B-7', complement: 'sortie de la zone tampon' },
    ])
  })

  it('RG-REC-062 un contrôle refusé (rayon manquant) laisse l’affiche en zone tampon, sans historique', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const r = await controler(rv.receptionId, s.headers, s.user.id, { rayon: '' })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_ALLEE_RAYON_OBLIGATOIRES', regle: 'RG-REC-061' })
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      allee: null,
      rayon: null,
    })
    expect(await journal(rv.afficheId, 'MODIFICATION_EMPLACEMENT')).toEqual([])
    expect((await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
  })

  // ANO-015 corrigée : le complément n'était posé que pour une allée vide, pas pour l'allée tampon X
  // (RG-REC-062).
  it('RG-REC-062 réception inconnue : « Rangée : X-4 → B-7 (sortie de la zone tampon) »', async () => {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 3, allee: 'x', rayon: '4' })
    const l = await ligne(ctx, s.plateforme.id)
    await rattacherInconnue(c.afficheId, s.headers, l.id, 3)
    expect((await controler(c.receptionId, s.headers, s.user.id)).statusCode).toBe(200)
    expect(await journal(c.afficheId, 'MODIFICATION_EMPLACEMENT')).toMatchObject([
      { ancienneValeur: 'X-4', nouvelleValeur: 'B-7', complement: 'sortie de la zone tampon' },
    ])
  })
})

describe('RG-REC-085 impression : type de feuille noté, tag levé', () => {
  it('RG-REC-085 feuille + étiquette rack sur une affiche sans dossier : 409, rien n’est noté (ni type, ni tag, ni journal)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const avant = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    const r = await imprimer([c.afficheId], s.headers, 'FEUILLE_ET_ETIQUETTE')
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      code: 'REC_FEUILLE_DEFINITIVE_IMPOSSIBLE',
      regle: 'RG-REC-084',
    })
    expect(await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).toEqual(avant)
    expect(await journal(c.afficheId, 'IMPRESSION_FEUILLE')).toEqual([])
  })

  it.each([[0], [6]] as const)(
    'RG-REC-085 / RG-REC-086 %s exemplaire(s) : 400 REC_EXEMPLAIRES, le tag « Feuille à refaire » reste posé',
    async (n) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      await db.affiche.update({ where: { id: rv.afficheId }, data: { feuilleARefaire: true } })
      const r = await imprimer([rv.afficheId], s.headers, 'FEUILLE', n)
      expect(r.statusCode).toBe(400)
      expect(erreur(r)).toMatchObject({ code: 'REC_EXEMPLAIRES', regle: 'RG-REC-086' })
      expect(
        (await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).feuilleARefaire,
      ).toBe(true)
    },
  )

  it.each([['com'], ['expe']] as const)(
    'RG-REC-085 / RG-REC-002 le profil %s n’imprime pas (403), le tag reste posé',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      await db.affiche.update({ where: { id: rv.afficheId }, data: { feuilleARefaire: true } })
      const u = await autre(ctx, s.plateforme.id, [role])
      expect((await imprimer([rv.afficheId], u.headers)).statusCode).toBe(403)
      expect(
        (await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).feuilleARefaire,
      ).toBe(true)
    },
  )
})

describe('RG-REC-100 suggestions d’intitulés de l’autre plateforme', () => {
  const url = (plateformeId: number, a: string) =>
    `/api/receptions-inconnues/suggestions?plateformeId=${String(plateformeId)}&annonceur=${encodeURIComponent(a)}`

  it('RG-REC-100 valeur limite : exactement 3 caractères déclenchent les suggestions', async () => {
    const s = await site(ctx)
    const p2 = await f.createPlateforme(db)
    const cle = `Z${Math.random().toString(36).slice(2, 4)}`
    const a = await f.createAffiche(db, {
      plateformeId: p2.id,
      contAnnonc: `${cle} Marque`,
      theme: 'Intitulé limite',
    })
    const r = SuggestionsIntitulesSchema.parse(
      (await get(ctx, url(s.plateforme.id, cle), s.headers)).json(),
    )
    expect(r.suggestions.map((x) => x.afficheId)).toContain(a.id)
  })

  it('RG-REC-100 les intitulés de SA plateforme et les affiches sans thème ne sont pas suggérés', async () => {
    const s = await site(ctx)
    const p2 = await f.createPlateforme(db)
    const marque = `Solo${String(Date.now())}`
    await f.createAffiche(db, { plateformeId: s.plateforme.id, contAnnonc: marque, theme: 'Ici' })
    await f.createAffiche(db, { plateformeId: p2.id, contAnnonc: marque, theme: null })
    const r = SuggestionsIntitulesSchema.parse(
      (await get(ctx, url(s.plateforme.id, marque), s.headers)).json(),
    )
    expect(r.suggestions).toEqual([])
  })

  it.each([['expe'], ['com']] as const)(
    'RG-REC-100 / RG-REC-002 le profil %s n’obtient pas de suggestions (403)',
    async (role) => {
      const s = await site(ctx)
      const u = await autre(ctx, s.plateforme.id, [role])
      expect((await get(ctx, url(s.plateforme.id, 'Marque'), u.headers)).statusCode).toBe(403)
    },
  )
})

describe('RG-REC-120 rattachement par la réception : reste à vérifier', () => {
  async function rattacheeParLaReception() {
    const s = await site(ctx)
    const c = await inconnue(s, { quantite: 4 })
    const l = await ligne(ctx, s.plateforme.id)
    const r = await rattacherInconnue(c.afficheId, s.headers, l.id, 4)
    expect(r.json()).toMatchObject({ validee: false })
    return { s, c }
  }

  it('RG-REC-120 rattachée par la réception : « à confirmer » journalisé, jusqu’à la confirmation par la Coordination', async () => {
    const { s, c } = await rattacheeParLaReception()
    // La règle impose l'état « à confirmer » (reste à vérifier), pas un libellé exact.
    const traces = await journal(c.afficheId, 'RATTACHEMENT_AFFICHE')
    expect(traces).toHaveLength(1)
    expect(traces[0]).toMatchObject({ parId: s.user.id })
    expect(traces[0]?.nouvelleValeur).toContain('à confirmer')
    expect(traces[0]?.nouvelleValeur).toContain('reste à vérifier')
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).validationAdmin,
    ).toBe(false)
    const coord = await autre(ctx, s.plateforme.id, ['coord'])
    expect((await validationAdmin(c.afficheId, coord.headers)).statusCode).toBe(200)
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).validationAdmin,
    ).toBe(true)
  })

  it('RG-REC-120 la réception ne confirme pas elle-même son rattachement (403 REC_VALIDATION_RESERVEE), il reste « à confirmer »', async () => {
    const { s, c } = await rattacheeParLaReception()
    const refus = await validationAdmin(c.afficheId, s.headers)
    expect(refus.statusCode).toBe(403)
    expect(erreur(refus)).toMatchObject({ code: 'REC_VALIDATION_RESERVEE', regle: 'RG-REC-003' })
    expect(
      (await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })).validationAdmin,
    ).toBe(false)
  })
})

describe('RG-REC-125 / 126 / 127 / 128 / 129 liste des affiches', () => {
  it('RG-REC-125 pas de doublon : 3 dossiers, réception + écart de contrôle + rebut → une seule ligne, y compris filtrée par dossier', async () => {
    const s = await site(ctx)
    const rv = await avecSurplus(s, 10, 4)
    const [l2, l3] = await Promise.all([ligne(ctx, s.plateforme.id), ligne(ctx, s.plateforme.id)])
    await rattacherAutre(rv.afficheId, s.headers, l2.id, 3)
    await rattacherAutre(rv.afficheId, s.headers, l3.id, 3)
    await controler(rv.receptionId, s.headers, s.user.id, { qteComptee: 9, rebut: 1 })
    const toutes = await liste(s.headers)
    expect(toutes.total).toBe(1)
    expect(toutes.items.map((a) => a.id)).toEqual([rv.afficheId])
    expect(toutes.items[0]?.dossiers).toHaveLength(3)
    const parDossier = await liste(s.headers, `?dossier=${String(l2.contNum)}`)
    expect(parDossier.items.map((a) => a.id)).toEqual([rv.afficheId])
  })

  it('RG-REC-126 « En stock » = Σ mouvements (pas la quantité saisie de l’affiche) ; sans rebut, badge à 0', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, quantite: 100 })
    await f.createMouvement(db, {
      afficheId: a.id,
      type: 'RECEPTION',
      quantite: 7,
      date: new Date(),
    })
    expect((await liste(s.headers)).items).toMatchObject([{ id: a.id, enStock: 7, rebut: 0 }])
  })

  it('RG-REC-127 un tag ne se coche pas : tags / statut / « feuille à refaire » envoyés à la fiche sont ignorés', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await patch(rv.afficheId, s.headers, {
      version: a.version,
      tags: ['COMPLEMENT', 'FEUILLE_A_REFAIRE'],
      feuilleARefaire: true,
      statut: 'ORPHELINE',
    })
    expect(r.statusCode).toBe(200)
    expect((await liste(s.headers)).items[0]?.tags).toEqual(['A_CONTROLER'])
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      feuilleARefaire: false,
      statut: 'IDENTIFIEE',
    })
  })

  it('RG-REC-127 le tag « À contrôler » tombe de lui-même une fois la palette contrôlée', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    expect((await liste(s.headers)).items[0]?.tags).toContain('A_CONTROLER')
    await controler(rv.receptionId, s.headers, s.user.id)
    expect((await liste(s.headers)).items[0]?.tags).not.toContain('A_CONTROLER')
  })

  it('RG-REC-128 valeur limite : une seule réception → pas de tag « Complément », absente du filtre', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    expect((await liste(s.headers)).items[0]?.tags).not.toContain('COMPLEMENT')
    expect((await liste(s.headers, '?tag=COMPLEMENT')).items.map((a) => a.id)).not.toContain(
      rv.afficheId,
    )
  })

  it('RG-REC-129 un rattachement retiré pose « Feuille à refaire » ; la réimpression le lève', async () => {
    const s = await site(ctx)
    const rv = await avecSurplus(s, 10, 6)
    const l2 = await ligne(ctx, s.plateforme.id)
    const lien = await f.createRattachement(db, {
      afficheId: rv.afficheId,
      ligneAttendueId: l2.id,
      quantite: 4,
      mode: 'MAIN',
    })
    expect(
      (
        await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
          lienVersion: lien.version,
        })
      ).statusCode,
    ).toBe(200)
    expect((await liste(s.headers)).items[0]?.tags).toContain('FEUILLE_A_REFAIRE')
    expect((await imprimer([rv.afficheId], s.headers)).statusCode).toBe(200)
    expect((await liste(s.headers)).items[0]?.tags).not.toContain('FEUILLE_A_REFAIRE')
  })

  it('RG-REC-129 sans dossier (orpheline, feuille temporaire) et après modification du thème saisi : pas de tag (Q-143)', async () => {
    const s = await site(ctx)
    const c = await inconnue(s)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: c.afficheId } })
    expect(
      (await patch(c.afficheId, s.headers, { version: a.version, theme: 'Corrigé' })).statusCode,
    ).toBe(200)
    expect((await liste(s.headers)).items.find((x) => x.id === c.afficheId)?.tags).not.toContain(
      'FEUILLE_A_REFAIRE',
    )
  })
})

describe('RG-REC-130 / 132 / 134 / 142 fiche de l’affiche', () => {
  it('RG-REC-130 fiche après contrôle : réception(s) liée(s) contrôlée(s), bloc validation, emplacement', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    await controler(rv.receptionId, s.headers, s.user.id)
    const fi = await fiche(rv.afficheId, s.headers)
    expect(fi.receptions).toMatchObject([{ id: rv.receptionId, statut: 'CONTROLEE' }])
    expect(fi).toMatchObject({
      allee: 'B',
      rayon: '7',
      validation: { validee: false, par: null, le: null, mode: 'BL' },
    })
  })

  it('RG-REC-130 identifiant de fiche invalide : 400', async () => {
    const s = await site(ctx)
    expect((await get(ctx, '/api/affiches/abc', s.headers)).statusCode).toBe(400)
  })

  it('RG-REC-132 mouvements triés date décroissante, quantité signée, motif et auteur ; ceux d’une autre affiche n’y sont pas', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 10)
    const autreAffiche = await receptionValidee(ctx, s.headers, s.plateforme.id, 5)
    await controler(rv.receptionId, s.headers, s.user.id, { qteComptee: 7 })
    const fi = await fiche(rv.afficheId, s.headers)
    expect(fi.mouvements).toMatchObject([
      { type: 'ECART_CONTROLE', quantite: -3, motif: 'Compté 7 pour 10 au BL', par: s.user.nom },
      { type: 'RECEPTION', quantite: 10, receptionId: rv.receptionId, par: s.user.nom },
    ])
    const ids = await db.mouvement.findMany({ where: { afficheId: autreAffiche.afficheId } })
    expect(fi.mouvements.map((m) => m.id)).not.toContain(ids[0]?.id)
  })

  it('RG-REC-134 préparations : tous les liens actifs (sans limite), jamais un lien retiré', async () => {
    const s = await site(ctx)
    const rv = await avecSurplus(s, 10, 4)
    const [l2, l3, l4] = await Promise.all([
      ligne(ctx, s.plateforme.id),
      ligne(ctx, s.plateforme.id),
      ligne(ctx, s.plateforme.id),
    ])
    await f.createRattachement(db, {
      afficheId: rv.afficheId,
      ligneAttendueId: l2.id,
      quantite: 3,
      mode: 'MAIN',
    })
    await f.createRattachement(db, {
      afficheId: rv.afficheId,
      ligneAttendueId: l3.id,
      quantite: 3,
      mode: 'MAIN',
    })
    await f.createRattachement(db, {
      afficheId: rv.afficheId,
      ligneAttendueId: l4.id,
      quantite: 1,
      mode: 'MAIN',
      actif: false,
    })
    const fi = await fiche(rv.afficheId, s.headers)
    expect(fi.preparations.map((p) => p.ligneAttendueId).sort()).toEqual(
      [rv.ligne.id, l2.id, l3.id].sort(),
    )
    expect(fi.preparations.map((p) => p.ligneAttendueId)).not.toContain(l4.id)
  })

  it('RG-REC-142 ouvrir la fiche d’une affiche orpheline non validée ne l’associe PAS aux prépas du même dossier (aucune écriture)', async () => {
    const s = await site(ctx)
    const contNum = 890000 + Math.floor(Math.random() * 9999)
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      statut: 'ORPHELINE',
      contNum,
      validationAdmin: false,
    })
    await ligne(ctx, s.plateforme.id, { contNum, supportId: s.support.id })
    await ligne(ctx, s.plateforme.id, { contNum, supportId: s.support.id })
    const journalAvant = await db.journalAudit.count({ where: { entiteId: String(a.id) } })
    await fiche(a.id, s.headers)
    await liste(s.headers, `?dossier=${String(contNum)}`)
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id } })).toBe(0)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toEqual(a)
    expect(await db.journalAudit.count({ where: { entiteId: String(a.id) } })).toBe(journalAvant)
  })
})

describe('RG-REC-150 purge de l’ancien thème après changement de thème', () => {
  it('RG-REC-150 l’ancienne ligne encore rattachée à une autre affiche reste ACTIVE (pas de purge)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const autreAffiche = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    await f.createRattachement(db, {
      afficheId: autreAffiche.id,
      ligneAttendueId: rv.ligne.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const nouvelle = await ligne(ctx, s.plateforme.id, {
      contNum: rv.ligne.contNum,
      theme: 'Thème B',
      themeCle: 'THEME B',
    })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: a.id, ligneAttendueId: rv.ligne.id, actif: true },
    })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, s.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: nouvelle.id,
    })
    expect(r.statusCode).toBe(200)
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).etatLigne,
    ).toBe('ACTIVE')
  })
})

describe('RG-REC-184 alerte « Réception sans instructions de pose »', () => {
  it('RG-REC-184 recevoir sur une ligne sans IP (intitulé saisi) lève l’alerte grave pour la Coordination', async () => {
    const s = await site(ctx)
    const l = await ligne(ctx, s.plateforme.id, { theme: null, themeCle: null })
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: l.id, quantite: 2, intituleSaisi: 'Lu sur l’affiche' },
    ])
    expect((await post(ctx, '/api/receptions', s.headers, bl)).statusCode).toBe(201)
    expect(
      (await alertes(s.headers)).find((x) => x.cle === `RG-REC-184:${String(l.id)}`),
    ).toMatchObject({
      regle: 'RG-REC-184',
      gravite: 'IMPORTANT',
      destinataires: ['Coordination'],
    })
  })

  it('RG-REC-184 pas d’alerte : ligne sans IP non reçue, ligne sans IP au lien retiré, ligne avec IP reçue', async () => {
    const s = await site(ctx)
    const nonRecue = await ligne(ctx, s.plateforme.id, { theme: null, themeCle: null })
    const lienRetire = await ligne(ctx, s.plateforme.id, { theme: null, themeCle: null })
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: lienRetire.id,
      quantite: 1,
      mode: 'MAIN',
      actif: false,
    })
    const avecIp = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const cles = (await alertes(s.headers)).map((x) => x.cle)
    expect(cles).not.toContain(`RG-REC-184:${String(nonRecue.id)}`)
    expect(cles).not.toContain(`RG-REC-184:${String(lienRetire.id)}`)
    expect(cles).not.toContain(`RG-REC-184:${String(avecIp.ligne.id)}`)
  })
})
