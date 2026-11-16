// COO-P11 — tests d'INTÉGRATION COMPLÉMENTAIRES du roulage (suivi 8 m², dispatch, bagues, rouleurs) et de la fin de
// COO-P10 (B4 : train déjà envoyé à la machine). Source de l'attendu : docs/COORDINATION_REGLES_METIER.md
// (RG-COO-167, 209, 217, 234, 236, 237, 291 à 303, 308) et les décisions de docs/QUESTIONS_OUVERTES.md : Q-195 (14
// points), Q-194 (B4), Q-193, Q-276 (seuils 36 h / 115 %, règle de répartition SIMULÉE), Q-277 (réimpression : chef
// d'équipe seul), Q-278 (RG-COO-303 hors périmètre), Q-262 (pré-assemblage par thème), Q-002 (aperçu navigateur),
// Q-286 (profils : cellules « ? » = hypothèse du catalogue, chef d'équipe seul pour dispatch / bagues).
// Aucun test unitaire : API réelle sur la base de test (test.db), données par les factories.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ApercusBaguesSchema,
  BaguesSchema,
  DispatchSchema,
  FicheTrainSchema,
  GenerationSchema,
  ImpressionBaguesSchema,
  ListeTrainsSchema,
  PickingSchema,
  ResultatBagueSchema,
  RouleurLigneSchema,
  RouleursReferentielSchema,
  RouleursSchema,
  Suivi8m2Schema,
  TrainsGenerationSchema,
  type Bagues,
  type Dispatch,
  type Role,
} from '@circe/shared'
import {
  EtatLigne,
  ModeRattachement,
  SourceLigne,
  StatutAffiche,
  StatutLigneAttendue,
  type StatutProduction,
} from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'
import {
  avecEchec,
  DEPART,
  DEPART_TXT,
  envoyer,
  parametre,
  recu,
  restaurerParametres,
  ROLES,
  SEM,
  siteDeroulant,
  trainExportable,
  versions,
  type SiteD,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterEach(restaurerParametres)

// Hygiène de la base partagée : les données créées par ce fichier (plus de 1 000 dossiers distincts) sont purgées à
// la fin (sites créés par `siteD`), dans l'ordre des clés étrangères, pour ne pas alourdir les autres fichiers.
const sitesCrees: SiteD[] = []
const siteD = async () => {
  const s = await siteDeroulant(ctx)
  sitesCrees.push(s)
  return s
}
afterAll(async () => {
  for (let debut = 0; debut < sitesCrees.length; debut += 100) {
    const lot = sitesCrees.slice(debut, debut + 100)
    const ateliers = { in: lot.flatMap((s) => [s.atelier.id, s.atelier2.id]) }
    const plateformes = { in: lot.map((s) => s.plateforme.id) }
    await db.bague.deleteMany({ where: { atelierId: ateliers } })
    await db.afficheAttendue.deleteMany({ where: { ligneAttendue: { plateformeId: plateformes } } })
    await db.affiche.deleteMany({ where: { plateformeId: plateformes } })
    await db.receptionAttendue.deleteMany({ where: { plateformeId: plateformes } })
    await db.faceTrain.deleteMany({ where: { atelierId: ateliers } })
    await db.instruction.deleteMany({ where: { atelierId: ateliers } })
    await db.rouleur.deleteMany({ where: { atelierId: ateliers } })
  }
  await ctx.arreter()
}, 600_000)

type H = Record<string, string>
const HEURE = 3_600_000
const INCONNU = 999_999_999
const numero = () => 870_000 + Math.floor(Math.random() * 100_000)

// ───────────────────────── outils ─────────────────────────

/** Train « Prêt » : faces « A imprimer », tous les visuels reçus (RG-COO-208). */
async function pret(s: SiteD, themes: string[], extra: Parameters<typeof trainExportable>[3] = {}) {
  const t = await trainExportable(ctx, s, themes, { statut: 'A_IMPRIMER', ...extra })
  for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
  return t
}
/** Train « En production » : faces « Au roulage » avec leur rouleur (RG-COO-217). */
const enProd = (s: SiteD, themes: string[], rouleurId: number) =>
  trainExportable(ctx, s, themes, { statut: 'AU_ROULAGE', extra: { rouleurId } })
const rouleur = (s: SiteD, nom: string, atelierId = s.atelier.id) =>
  f.createRouleur(db, { atelierId, nom })
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })
/** Site dont l'atelier est un atelier 8 m² (paramètre `suivi8m2.ateliers`, Q-319). */
const site8m2 = async () => {
  const s = await siteD()
  await parametre(ctx, 'suivi8m2.ateliers', String(s.atelier.id))
  return s
}

const api = (
  methode: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  headers: H,
  payload?: unknown,
) =>
  ctx.app.inject({
    method: methode,
    url,
    headers: methode === 'POST' ? { ...headers, ...idem() } : headers,
    ...(payload === undefined ? {} : { payload: payload as object }),
  })

const dispatch = async (
  s: SiteD,
  qs = '',
  headers: H = s.users.cheq.headers,
): Promise<Dispatch> => {
  const r = await get(
    ctx,
    `/api/coordination/dispatch?atelier=${String(s.atelier.id)}${qs}`,
    headers,
  )
  expect(r.statusCode, r.body).toBe(200)
  return DispatchSchema.parse(r.json())
}
const ligneDe = (d: Dispatch, trainId: string) =>
  d.lignes.find((l) => l.trains.some((t) => t.trainId === trainId))
const affecter = async (
  s: SiteD,
  ids: string[],
  rouleurId: number | null,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) =>
  envoyer(
    ctx,
    '/api/coordination/dispatch/affecter',
    headers,
    { trains: await versions(ctx, s.users.coord.headers, ids), rouleurId },
    cle,
  )
const repartir = async (
  s: SiteD,
  action: 'proposer' | 'desaffecter',
  ids: string[],
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) =>
  envoyer(
    ctx,
    `/api/coordination/dispatch/${action}`,
    headers,
    { atelierId: s.atelier.id, trains: await versions(ctx, s.users.coord.headers, ids) },
    cle,
  )
const bagues = async (s: SiteD, qs = '', headers: H = s.users.cheq.headers): Promise<Bagues> => {
  const r = await get(ctx, `/api/coordination/bagues?atelier=${String(s.atelier.id)}${qs}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return BaguesSchema.parse(r.json())
}
const imprimer = async (
  s: SiteD,
  ids: string[],
  rouleurId: number,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) =>
  envoyer(
    ctx,
    '/api/coordination/bagues/imprimer',
    headers,
    { trains: await versions(ctx, s.users.coord.headers, ids), rouleurId },
    cle,
  )
/** Imprime et renvoie la bague (numéro, version) du train. */
async function imprime(s: SiteD, trainId: string, rouleurId: number) {
  const r = await imprimer(s, [trainId], rouleurId)
  expect(r.statusCode, r.body).toBe(200)
  return db.bague.findUniqueOrThrow({ where: { trainId } })
}
const modifier = (
  s: SiteD,
  trainId: string,
  version: number,
  textes: unknown,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) => envoyer(ctx, '/api/coordination/bagues/modifier', headers, { trainId, version, textes }, cle)
const reimprimer = (
  s: SiteD,
  trainId: string,
  version: number,
  motif: unknown,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
  precision?: string,
) =>
  envoyer(
    ctx,
    '/api/coordination/bagues/reimprimer',
    headers,
    { trainId, version, motif, ...(precision ? { precision } : {}) },
    cle,
  )
const apercu = (ids: string[], headers: H) =>
  get(ctx, `/api/coordination/bagues/apercu?trains=${ids.join(',')}`, headers)
const picking = (rouleurId: number, headers: H, qs = '') =>
  get(ctx, `/api/coordination/dispatch/picking?rouleur=${String(rouleurId)}${qs}`, headers)
const suivi = async (s: SiteD, qs = '', headers: H = s.users.coord.headers) => {
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
  version: unknown,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) =>
  envoyer(
    ctx,
    '/api/coordination/trains/suivi-8m2',
    headers,
    { atelierId: s.atelier.id, depart: DEPART_TXT, contNum, theme, champ, valeur, version },
    cle,
  )
const creerRouleur = (payload: unknown, headers: H, cle: H = idem()) =>
  envoyer(ctx, '/api/coordination/rouleurs', headers, payload, cle)
const preparer = async (
  s: SiteD,
  ids: string[],
  depart = DEPART_TXT,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) =>
  envoyer(
    ctx,
    '/api/coordination/generateur',
    headers,
    { depart, trains: await versions(ctx, s.users.coord.headers, ids) },
    cle,
  )
const envoi = (
  s: SiteD,
  id: number,
  version: number,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) => envoyer(ctx, '/api/coordination/generateur/envoyer', headers, { id, version }, cle)
const generateur = async (s: SiteD, headers: H = s.users.cheq.headers) =>
  TrainsGenerationSchema.parse(
    (await get(ctx, `/api/coordination/generateur?depart=${DEPART_TXT}`, headers)).json(),
  )

/** Version (verrou) du thème dans le suivi par thème, pour le pré-assemblage. */
async function versionTheme(s: SiteD, contNum: number, theme = 'Rose') {
  const r = await get(
    ctx,
    `/api/coordination/trains/besoin?depart=${DEPART_TXT}&atelier=${String(s.atelier.id)}`,
    s.users.cheq.headers,
  )
  expect(r.statusCode, r.body).toBe(200)
  const l = r
    .json<{ lignes: { contNum: number; theme: string; version: string }[] }>()
    .lignes.find((x) => x.contNum === contNum && x.theme === theme)
  if (!l) throw new Error(`thème du dossier ${String(contNum)} absent du suivi`)
  return l.version
}
const preAssembler = (
  s: SiteD,
  themes: { contNum: number; theme: string; version: string }[],
  valeur: boolean,
  headers: H = s.users.cheq.headers,
  cle: H = idem(),
) =>
  envoyer(
    ctx,
    '/api/coordination/trains/pre-assemblage',
    headers,
    {
      themes: themes.map((t) => ({ atelierId: s.atelier.id, depart: DEPART_TXT, ...t })),
      valeur,
    },
    cle,
  )

/** Instantané des écritures d'un ensemble de trains (faces, bagues, journal, historique de statut). */
async function etat(trainIds: string[]) {
  const faces = await db.faceTrain.findMany({
    where: { trainId: { in: trainIds } },
    orderBy: { id: 'asc' },
    select: { id: true, statut: true, rouleurId: true, version: true, preAssemblage: true },
  })
  return {
    faces,
    bagues: await db.bague.findMany({
      where: { trainId: { in: trainIds } },
      orderBy: { id: 'asc' },
    }),
    journal: await db.journalAudit.count({
      where: { typeEntite: 'TRAIN', entiteId: { in: trainIds } },
    }),
    historique: await db.statutHistorique.count({
      where: { typeEntite: 'FACE_TRAIN', entiteId: { in: faces.map((x) => String(x.id)) } },
    }),
  }
}

// ═════════════════════════ RG-COO-167 : périmètre par site ═════════════════════════

describe('RG-COO-167 périmètre par site : listes, fiches, aperçus d’étiquette, historiques et fichiers', () => {
  async function deuxSites() {
    const s = await site8m2()
    const r1 = await rouleur(s, 'Rouleur Pm1')
    const a = await pret(s, ['Rose'])
    const b = await pret(s, ['Gris'], { extra: { rouleurId: r1.id } })
    const c = await pret(s, ['Bleu'])
    const bag = await imprime(s, c.trainId, r1.id)
    const autre = await siteD()
    const r2 = await rouleur(autre, 'Rouleur Pm2')
    const propre = await pret(autre, ['Vert'])
    return { s, r1, a, b, c, bag, autre, r2, propre }
  }

  it('RG-COO-167 lectures : un chef d’équipe d’un autre site ne reçoit ni train, ni bague, ni ligne de dispatch, ni picking, ni aperçu, ni thème 8 m² du site', async () => {
    const { s, r1, a, b, c, autre, propre } = await deuxSites()
    const h = autre.users.cheq.headers
    const fuite = (corps: string) =>
      [
        a.trainId,
        b.trainId,
        c.trainId,
        s.destinataire.nom ?? 'destinataire-absent',
        'Rouleur Pm1',
      ].filter((x) => corps.includes(x))
    // Témoin : le site propriétaire voit ses données.
    expect((await bagues(s, '&bague=IMPRIMEES')).lignes.map((l) => l.trainId)).toContain(c.trainId)
    expect(ligneDe(await dispatch(s), a.trainId)).toBeDefined()
    // Bagues : trois filtres, avec ou sans l'atelier d'un autre site.
    for (const filtre of ['A_IMPRIMER', 'IMPRIMEES', 'SANS_BAGUE']) {
      const r = await get(ctx, `/api/coordination/bagues?bague=${filtre}`, h)
      expect(r.statusCode, filtre).toBe(200)
      expect(fuite(r.body), filtre).toEqual([])
      if (filtre === 'A_IMPRIMER') expect(r.body).toContain(propre.trainId)
      const cible = await get(
        ctx,
        `/api/coordination/bagues?bague=${filtre}&atelier=${String(s.atelier.id)}`,
        h,
      )
      expect([200, 403], filtre).toContain(cible.statusCode)
      expect(fuite(cible.body), filtre).toEqual([])
    }
    // Aperçus d'étiquette : refus de toute la demande dès qu'un train est hors périmètre.
    for (const ids of [[c.trainId], [propre.trainId, a.trainId], [a.trainId, propre.trainId]]) {
      const r = await apercu(ids, h)
      expect(r.statusCode, r.body).toBe(403)
      expect(erreur(r).code).toBe('COO_PERIMETRE_INTERDIT')
      expect(fuite(r.body)).toEqual([])
    }
    // Fiche et liste des trains.
    const fiche = await get(ctx, `/api/coordination/trains/${a.trainId}`, h)
    expect(fiche.statusCode).toBe(403)
    expect(erreur(fiche).code).toBe('COO_PERIMETRE_INTERDIT')
    const liste = await get(ctx, `/api/coordination/trains?depart=${DEPART_TXT}`, h)
    expect(liste.statusCode).toBe(200)
    ListeTrainsSchema.parse(liste.json())
    expect(fuite(liste.body)).toEqual([])
    // Dispatch : atelier d'un autre site = 403 ; sans atelier, uniquement le site de l'utilisateur.
    const ailleurs = await get(ctx, `/api/coordination/dispatch?atelier=${String(s.atelier.id)}`, h)
    expect(ailleurs.statusCode).toBe(403)
    expect(erreur(ailleurs).code).toBe('COO_PERIMETRE_INTERDIT')
    const propreD = await get(ctx, '/api/coordination/dispatch', h)
    expect(propreD.statusCode).toBe(200)
    expect(fuite(propreD.body)).toEqual([])
    expect(ligneDe(DispatchSchema.parse(propreD.json()), propre.trainId)).toBeDefined()
    // Picking d'un rouleur d'un autre site.
    const pk = await picking(r1.id, h)
    expect(pk.statusCode).toBe(403)
    expect(erreur(pk).code).toBe('COO_PERIMETRE_INTERDIT')
    // Suivi 8 m² : le thème du site n'est pas visible ; la saisie est refusée.
    const sv = await get(
      ctx,
      `/api/coordination/trains/suivi-8m2?depart=${DEPART_TXT}`,
      autre.users.coord.headers,
    )
    expect(sv.statusCode).toBe(200)
    expect(Suivi8m2Schema.parse(sv.json()).lignes).toEqual([])
    expect((await suivi(s)).lignes.length).toBeGreaterThanOrEqual(1)
  })

  it('RG-COO-167 écritures : un autre site ne peut ni affecter, ni répartir, ni imprimer, ni modifier, ni réimprimer, ni pré-assembler, ni saisir (403) ; aucune écriture', async () => {
    const { s, a, b, c, bag, autre, r2 } = await deuxSites()
    const ids = [a.trainId, b.trainId, c.trainId]
    const vs = await versions(ctx, s.users.coord.headers, ids)
    const avant = await etat(ids)
    const h = autre.users.cheq.headers
    const [va] = vs
    const tentatives: [string, string, unknown][] = [
      ['affecter', '/api/coordination/dispatch/affecter', { trains: [va], rouleurId: r2.id }],
      [
        'proposer',
        '/api/coordination/dispatch/proposer',
        { atelierId: s.atelier.id, trains: [va] },
      ],
      [
        'désaffecter',
        '/api/coordination/dispatch/desaffecter',
        { atelierId: s.atelier.id, trains: [va] },
      ],
      ['imprimer', '/api/coordination/bagues/imprimer', { trains: [va], rouleurId: r2.id }],
      [
        'modifier',
        '/api/coordination/bagues/modifier',
        {
          trainId: c.trainId,
          version: bag.version,
          textes: [{ lettre: 'A', annonceur: 'X', theme: 'Y' }],
        },
      ],
      [
        'réimprimer',
        '/api/coordination/bagues/reimprimer',
        { trainId: c.trainId, version: bag.version, motif: 'Autre' },
      ],
      [
        'pré-assembler',
        '/api/coordination/trains/pre-assemblage',
        {
          themes: [
            {
              atelierId: s.atelier.id,
              depart: DEPART_TXT,
              contNum: a.faces[0]?.contNum,
              theme: 'Rose',
              version: '1.1.1',
            },
          ],
          valeur: true,
        },
      ],
      [
        'saisir 8 m²',
        '/api/coordination/trains/suivi-8m2',
        {
          atelierId: s.atelier.id,
          depart: DEPART_TXT,
          contNum: a.faces[0]?.contNum,
          theme: 'Rose',
          champ: 'finales',
          valeur: 3,
          version: 0,
        },
      ],
      ['au roulage', '/api/coordination/trains/au-roulage', { trains: [va], rouleurId: r2.id }],
      ['générateur', '/api/coordination/generateur', { depart: DEPART_TXT, trains: [va] }],
    ]
    for (const [nom, url, payload] of tentatives) {
      const r = await envoyer(ctx, url, h, payload)
      expect(r.statusCode, `${nom} : ${r.body}`).toBe(403)
      expect(erreur(r).code, nom).toBe('COO_PERIMETRE_INTERDIT')
    }
    expect(await etat(ids)).toEqual(avant)
    expect(await db.suivi8m2.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(await db.generationFichiers.count({ where: { trains: { contains: a.trainId } } })).toBe(
      0,
    )
  })

  it('RG-COO-167 historiques et fichiers : le lot de génération d’un site n’est ni listé, ni téléchargeable, ni envoyable depuis un autre site ; le lot reste « Préparé »', async () => {
    const s = await siteD()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    const autre = await siteD()
    const h = autre.users.cheq.headers
    const hist = await generateur(autre, h)
    expect(hist.historique.map((l) => l.lot)).not.toContain(g.lot)
    expect(hist.trains.map((x) => x.trainId)).not.toContain(t.trainId)
    expect((await generateur(s)).historique.map((l) => l.lot)).toContain(g.lot)
    const fichier = await get(ctx, `/api/coordination/generateur/${String(g.id)}/fichier`, h)
    expect(fichier.statusCode).toBe(403)
    expect(erreur(fichier).code).toBe('COO_PERIMETRE_INTERDIT')
    expect(fichier.body).not.toContain(s.destinataire.nom)
    expect(
      (await get(ctx, `/api/coordination/generateur/${String(g.id)}/fichier`, s.users.cheq.headers))
        .statusCode,
    ).toBe(200)
    const e = await envoi(autre, g.id, g.version, h)
    expect(e.statusCode, e.body).toBe(403)
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).statut).toBe(
      'PREPARE',
    )
    // Historique des exports : aucun lot d'un autre site (périmètre des lots).
    const hx = await get(
      ctx,
      `/api/coordination/trains/export/historique?depart=${DEPART_TXT}`,
      autre.users.coord.headers,
    )
    expect(hx.statusCode).toBe(200)
    expect(hx.body).not.toContain(t.trainId)
  })
})

// ═════════════════════════ permissions des 6 rôles sur chaque route ═════════════════════════

const T0 = { trainId: '899999999999999', version: '1.1.1' }
interface RouteP {
  rg: string
  nom: string
  methode: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  url: string
  payload?: unknown
  autorises: Role[]
}
const ROUTES: RouteP[] = [
  {
    rg: 'RG-COO-237',
    nom: 'GET suivi 8 m²',
    methode: 'GET',
    url: `/api/coordination/trains/suivi-8m2?depart=${DEPART_TXT}`,
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-237',
    nom: 'POST saisie 8 m²',
    methode: 'POST',
    url: '/api/coordination/trains/suivi-8m2',
    payload: {
      atelierId: INCONNU,
      depart: DEPART_TXT,
      contNum: 1,
      theme: 'X',
      champ: 'finales',
      valeur: 1,
      version: 0,
    },
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-234',
    nom: 'POST pré-assemblage',
    methode: 'POST',
    url: '/api/coordination/trains/pre-assemblage',
    payload: {
      themes: [
        { atelierId: INCONNU, depart: DEPART_TXT, contNum: 1, theme: 'X', version: '1.1.1' },
      ],
      valeur: true,
    },
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-291',
    nom: 'GET dispatch',
    methode: 'GET',
    url: `/api/coordination/dispatch?atelier=${String(INCONNU)}`,
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-294',
    nom: 'POST affecter',
    methode: 'POST',
    url: '/api/coordination/dispatch/affecter',
    payload: { trains: [T0], rouleurId: 1 },
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-293',
    nom: 'POST proposer',
    methode: 'POST',
    url: '/api/coordination/dispatch/proposer',
    payload: { atelierId: INCONNU, trains: [T0] },
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-294',
    nom: 'POST désaffecter',
    methode: 'POST',
    url: '/api/coordination/dispatch/desaffecter',
    payload: { atelierId: INCONNU, trains: [T0] },
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-296',
    nom: 'GET picking',
    methode: 'GET',
    url: `/api/coordination/dispatch/picking?rouleur=${String(INCONNU)}`,
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-298',
    nom: 'GET bagues',
    methode: 'GET',
    url: '/api/coordination/bagues',
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-302',
    nom: 'GET aperçu',
    methode: 'GET',
    url: `/api/coordination/bagues/apercu?trains=${T0.trainId}`,
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-299',
    nom: 'POST imprimer',
    methode: 'POST',
    url: '/api/coordination/bagues/imprimer',
    payload: { trains: [T0], rouleurId: 1 },
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-300',
    nom: 'POST modifier',
    methode: 'POST',
    url: '/api/coordination/bagues/modifier',
    payload: {
      trainId: T0.trainId,
      version: 1,
      textes: [{ lettre: 'A', annonceur: 'X', theme: 'Y' }],
    },
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-301',
    nom: 'POST réimprimer',
    methode: 'POST',
    url: '/api/coordination/bagues/reimprimer',
    payload: { trainId: T0.trainId, version: 1, motif: 'Autre' },
    autorises: ['cheq'],
  },
  {
    rg: 'RG-COO-297',
    nom: 'GET rouleurs',
    methode: 'GET',
    url: '/api/coordination/rouleurs',
    autorises: ['admin'],
  },
  {
    rg: 'RG-COO-297',
    nom: 'POST rouleurs',
    methode: 'POST',
    url: '/api/coordination/rouleurs',
    payload: { nom: 'Rouleur X', atelierId: INCONNU },
    autorises: ['admin'],
  },
  {
    rg: 'RG-COO-297',
    nom: 'PATCH rouleurs',
    methode: 'PATCH',
    url: `/api/coordination/rouleurs/${String(INCONNU)}`,
    payload: { version: 1, nom: 'Y' },
    autorises: ['admin'],
  },
  {
    rg: 'RG-COO-297',
    nom: 'DELETE rouleurs',
    methode: 'DELETE',
    url: `/api/coordination/rouleurs/${String(INCONNU)}`,
    autorises: ['admin'],
  },
  {
    rg: 'RG-COO-217',
    nom: 'POST au roulage',
    methode: 'POST',
    url: '/api/coordination/trains/au-roulage',
    payload: { trains: [T0], rouleurId: 1 },
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-236',
    nom: 'POST choisir le rouleur',
    methode: 'POST',
    url: '/api/coordination/trains/rouleur',
    payload: { trains: [T0], rouleurId: 1 },
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-236',
    nom: 'GET rouleurs de l’atelier',
    methode: 'GET',
    url: `/api/coordination/trains/rouleurs?atelier=${String(INCONNU)}`,
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-217',
    nom: 'GET générateur',
    methode: 'GET',
    url: `/api/coordination/generateur?depart=${DEPART_TXT}`,
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-217',
    nom: 'POST préparer le fichier',
    methode: 'POST',
    url: '/api/coordination/generateur',
    payload: { depart: DEPART_TXT, trains: [T0] },
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-217',
    nom: 'POST envoyer à la machine',
    methode: 'POST',
    url: '/api/coordination/generateur/envoyer',
    payload: { id: INCONNU, version: 1 },
    autorises: ['coord', 'cheq'],
  },
  {
    rg: 'RG-COO-217',
    nom: 'GET fichier du lot',
    methode: 'GET',
    url: `/api/coordination/generateur/${String(INCONNU)}/fichier`,
    autorises: ['coord', 'cheq'],
  },
]

describe('RG-COO-165 / 168 permissions : chaque action de la matrice des profils, pour les 6 rôles (Q-286 : cellules « ? » = hypothèse du catalogue)', () => {
  it.each(ROUTES)('$rg permissions des 6 rôles : $nom', async (route) => {
    const s = await siteD()
    for (const role of ROLES) {
      const r = await api(route.methode, route.url, s.users[role].headers, route.payload)
      // Q-421 : l'admin (super-utilisateur) est autorisé partout ; le refus est vérifié pour les autres rôles.
      const autorise = role === 'admin' || route.autorises.includes(role)
      if (autorise) {
        expect([200, 204, 404, 409, 422], `${role} autorisé : ${r.body}`).toContain(r.statusCode)
      } else {
        expect(r.statusCode, `${role} refusé : ${r.body}`).toBe(403)
        const e = erreur(r)
        expect(e.code).toBe('PERMISSION')
        expect(e.regle, role).toBe(role === 'com' ? 'RG-COO-168' : e.regle)
        expect(e.regle).toMatch(/^RG-COO-/)
      }
    }
  })

  it.each(ROUTES)('$rg 401 sans identité : $nom', async (route) => {
    const r = await api(route.methode, route.url, {}, route.payload)
    expect(r.statusCode, r.body).toBe(401)
  })

  it('RG-COO-301 la réimpression d’une bague réelle : chef d’équipe seul (Q-277) ; recep, expe, com et coord refusés sans écriture (admin : super-utilisateur, Q-421)', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur Pr')
    const t = await pret(s, ['Rose'])
    const b = await imprime(s, t.trainId, r1.id)
    for (const role of ROLES.filter((x) => x !== 'cheq' && x !== 'admin')) {
      const r = await reimprimer(s, t.trainId, b.version, 'Autre', s.users[role].headers)
      expect(r.statusCode, role).toBe(403)
      expect(erreur(r).code).toBe('PERMISSION')
    }
    expect((await db.bague.findUniqueOrThrow({ where: { id: b.id } })).reimpressions).toBe(0)
    expect((await reimprimer(s, t.trainId, b.version, 'Autre')).statusCode).toBe(200)
  })
})

// ═════════════════════════ transitions de statut ═════════════════════════

describe('RG-COO-299 / 294 / 218 transitions de statut des trains : une ligne par statut de face (autorisé → 200, interdit → 409 / 422)', () => {
  const TABLE: {
    statut: StatutProduction
    unite: string
    dispatch: boolean
    imprimable: boolean
  }[] = [
    { statut: 'INSTRUCTION_OK', unite: 'PRET', dispatch: true, imprimable: false },
    { statut: 'A_IMPRIMER', unite: 'PRET', dispatch: true, imprimable: true },
    { statut: 'EXPORT_PREPA', unite: 'EN_PROD', dispatch: true, imprimable: false },
    { statut: 'AU_ROULAGE', unite: 'EN_PROD', dispatch: true, imprimable: false },
    { statut: 'PREPARE', unite: 'PRODUIT', dispatch: false, imprimable: false },
    { statut: 'A_EXPEDIER', unite: 'COLISE', dispatch: false, imprimable: false },
    { statut: 'TERMINE', unite: 'EXPEDIE', dispatch: false, imprimable: false },
  ]
  it.each(TABLE)(
    'RG-COO-299 faces « $statut » (unité $unite) : dispatch $dispatch, affectation, désaffectation, impression $imprimable',
    async ({ statut, unite, dispatch: dansDispatch, imprimable }) => {
      const s = await siteD()
      const r1 = await rouleur(s, 'Rouleur T1')
      const r2 = await rouleur(s, 'Rouleur T2')
      const t = await trainExportable(ctx, s, ['Rose'], {
        statut,
        extra: statut === 'AU_ROULAGE' ? { rouleurId: r1.id } : {},
      })
      for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
      const fiche = FicheTrainSchema.parse(
        (await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)).json(),
      )
      expect(fiche.statut).toBe(unite)
      expect(Boolean(ligneDe(await dispatch(s), t.trainId))).toBe(dansDispatch)
      const face = t.faces[0]?.id ?? 0
      const avant = (await faceDe(face)).rouleurId
      // Affectation (RG-COO-294 : seuls les trains PRET / EN_PROD).
      const a = await affecter(s, [t.trainId], r2.id)
      if (dansDispatch) {
        expect(a.statusCode, a.body).toBe(200)
        expect((await faceDe(face)).rouleurId).toBe(r2.id)
      } else {
        expect(a.statusCode, a.body).toBe(409)
        expect(erreur(a)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-294' })
        expect((await faceDe(face)).rouleurId).toBe(avant)
      }
      // Désaffectation : un train prêt oui, un train en production garde un rouleur (RG-COO-217), hors dispatch non.
      const n = await affecter(s, [t.trainId], null)
      if (!dansDispatch) {
        expect(n.statusCode).toBe(409)
        expect(erreur(n).code).toBe('TRANSITION_INTERDITE')
      } else if (unite === 'PRET') {
        expect(n.statusCode, n.body).toBe(200)
        expect((await faceDe(face)).rouleurId).toBeNull()
      } else {
        expect(n.statusCode, n.body).toBe(409)
        expect(erreur(n)).toMatchObject({ code: 'COO_ROULEUR_OBLIGATOIRE', regle: 'RG-COO-217' })
        expect((await faceDe(face)).rouleurId).toBe(r2.id)
      }
      // Impression de la bague : seule la face « A imprimer » d'une unité Prêt passe à « Au roulage ».
      const avantImpression = (await faceDe(face)).statut
      const i = await imprimer(s, [t.trainId], r1.id)
      if (imprimable) {
        expect(i.statusCode, i.body).toBe(200)
        expect((await faceDe(face)).statut).toBe('AU_ROULAGE')
        expect((await faceDe(face)).rouleurId).toBe(r1.id)
      } else {
        expect(i.statusCode, i.body).toBe(422)
        expect(erreur(i)).toMatchObject({ code: 'COO_AUCUNE_UNITE_PRETE', regle: 'RG-COO-299' })
        expect(erreur(i).message).toBe('Aucune unité « Prêt à produire » dans la sélection.')
        expect((await faceDe(face)).statut).toBe(avantImpression)
        expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(0)
      }
    },
  )

  it('RG-COO-299 / 300 / 301 transitions de la bague : imprimer une unité déjà imprimée 422 ; modifier / réimprimer avant impression 409 ; après impression, les deux sont autorisées', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur TB')
    const t = await pret(s, ['Rose'])
    const avantModif = await modifier(s, t.trainId, 1, [
      { lettre: 'A', annonceur: 'X', theme: 'Y' },
    ])
    expect(avantModif.statusCode, avantModif.body).toBe(409)
    expect(erreur(avantModif).code).toBe('TRANSITION_INTERDITE')
    const avantReimp = await reimprimer(s, t.trainId, 1, 'Autre')
    expect(avantReimp.statusCode).toBe(409)
    expect(erreur(avantReimp)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-301' })
    const b = await imprime(s, t.trainId, r1.id)
    const deux = await imprimer(s, [t.trainId], r1.id)
    expect(deux.statusCode, deux.body).toBe(422)
    expect(erreur(deux).code).toBe('COO_AUCUNE_UNITE_PRETE')
    expect(JSON.stringify(erreur(deux).details)).toContain('déjà imprimée')
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(1)
    const m = await modifier(s, t.trainId, b.version, [
      { lettre: 'A', annonceur: 'Autre annonceur', theme: 'Rose' },
    ])
    expect(m.statusCode, m.body).toBe(200)
    const r = await reimprimer(s, t.trainId, ResultatBagueSchema.parse(m.json()).version, 'Autre')
    expect(r.statusCode, r.body).toBe(200)
    // Le statut de l'unité est inchangé par la modification et la réimpression (RG-COO-301).
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('AU_ROULAGE')
  })

  it('RG-COO-217 transitions du lot de génération : « Préparé » → « Envoyé » autorisé ; « Envoyé » → envoyer de nouveau 409 sans second envoi ; train non prêt 409', async () => {
    const s = await siteD()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    expect(g.statut).toBe('PREPARE')
    const e1 = await envoi(s, g.id, g.version)
    expect(e1.statusCode, e1.body).toBe(200)
    const lot1 = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    expect(lot1.statut).toBe('ENVOYE')
    const e2 = await envoi(s, g.id, lot1.version)
    expect(e2.statusCode, e2.body).toBe(409)
    expect(erreur(e2)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-307' })
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version).toBe(
      lot1.version,
    )
    const attente = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const p = await preparer(s, [attente.trainId])
    expect(p.statusCode, p.body).toBe(409)
    expect(erreur(p)).toMatchObject({ code: 'COO_TRAIN_NON_PRET', regle: 'RG-COO-208' })
  })

  it('RG-COO-297 transitions du rouleur : actif → désactivé → réactivé autorisées ; suppression d’un rouleur référencé 409 même désactivé', async () => {
    const s = await siteD()
    const c = await creerRouleur(
      { nom: 'Rouleur Tr', atelierId: s.atelier.id },
      s.users.admin.headers,
    )
    const r = RouleurLigneSchema.parse(c.json())
    expect(r.actif).toBe(true)
    const patch = (version: number, actif: boolean) =>
      api('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, s.users.admin.headers, {
        version,
        actif,
      })
    const off = RouleurLigneSchema.parse((await patch(r.version, false)).json())
    expect(off).toMatchObject({ actif: false, version: r.version + 1 })
    const on = RouleurLigneSchema.parse((await patch(off.version, true)).json())
    expect(on).toMatchObject({ actif: true, version: off.version + 1 })
    await enProd(s, ['Rose'], r.id)
    await patch(on.version, false)
    const del = await api(
      'DELETE',
      `/api/coordination/rouleurs/${String(r.id)}`,
      s.users.admin.headers,
    )
    expect(del.statusCode).toBe(409)
    expect(erreur(del)).toMatchObject({ code: 'COO_ROULEUR_REFERENCE', regle: 'RG-COO-297' })
  })
})

// ═════════════════════════ rouleur obligatoire ═════════════════════════

describe('RG-COO-217 / 299 rouleur obligatoire à l’impression de la bague, au passage « En production » et à « Au roulage »', () => {
  it('RG-COO-299 nominal : après l’impression, TOUTES les faces du train (toutes positions) portent le rouleur et la bague le même ; aucune face « Au roulage » sans rouleur', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur O1')
    const t = await pret(s, ['Rose', 'Gris', 'Bleu', 'Vert'])
    expect((await imprimer(s, [t.trainId], r1.id)).statusCode).toBe(200)
    for (const face of t.faces)
      expect(await faceDe(face.id)).toMatchObject({ statut: 'AU_ROULAGE', rouleurId: r1.id })
    expect((await db.bague.findUniqueOrThrow({ where: { trainId: t.trainId } })).rouleurId).toBe(
      r1.id,
    )
    expect(
      await db.faceTrain.count({
        where: { trainId: t.trainId, statut: 'AU_ROULAGE', rouleurId: null },
      }),
    ).toBe(0)
  })

  it('RG-COO-299 rejet : sans rouleur (absent, null, 0, négatif, décimal, texte) 400 ; rouleur inconnu ou désactivé 404 ; train inchangé, aucune bague', async () => {
    const s = await siteD()
    const off = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur Off',
      dateFin: new Date(Date.now() - HEURE),
    })
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const avant = await etat([t.trainId])
    const corps: [string, unknown, number][] = [
      ['absent', { trains }, 400],
      ['null', { trains, rouleurId: null }, 400],
      ['zéro', { trains, rouleurId: 0 }, 400],
      ['négatif', { trains, rouleurId: -4 }, 400],
      ['décimal', { trains, rouleurId: 1.5 }, 400],
      ['texte', { trains, rouleurId: 'abc' }, 400],
      ['inconnu', { trains, rouleurId: INCONNU }, 404],
      ['désactivé', { trains, rouleurId: off.id }, 404],
    ]
    for (const [nom, payload, attendu] of corps) {
      const r = await envoyer(
        ctx,
        '/api/coordination/bagues/imprimer',
        s.users.cheq.headers,
        payload,
      )
      expect(r.statusCode, `${nom} : ${r.body}`).toBe(attendu)
    }
    expect(await etat([t.trainId])).toEqual(avant)
  })

  it('RG-COO-217 limite : un rouleur dont la date de fin est dans le futur reste valide (impression 200) ; une date de fin passée le rend invalide (404)', async () => {
    const s = await siteD()
    const futur = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur Futur',
      dateFin: new Date(Date.now() + HEURE),
    })
    const passe = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur Passé',
      dateFin: new Date(Date.now() - 60_000),
    })
    const t = await pret(s, ['Rose'])
    expect((await imprimer(s, [t.trainId], passe.id)).statusCode).toBe(404)
    expect((await imprimer(s, [t.trainId], futur.id)).statusCode).toBe(200)
    const d = await dispatch(s)
    expect(d.rouleurs.map((r) => r.id)).toContain(futur.id)
    expect(d.rouleurs.map((r) => r.id)).not.toContain(passe.id)
  })

  it('RG-COO-217 « Au roulage » (export préparation) : rouleur obligatoire (400 sans), faces « Export prépa » → « Au roulage » avec le rouleur ; autre statut 409 ; rouleur désactivé 404 ; tout ou rien', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur AR')
    const off = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur AR off',
      dateFin: new Date(Date.now() - HEURE),
    })
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'EXPORT_PREPA' })
    const autre = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER' })
    const url = '/api/coordination/trains/au-roulage'
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    expect((await envoyer(ctx, url, s.users.cheq.headers, { trains })).statusCode).toBe(400)
    expect(
      (await envoyer(ctx, url, s.users.cheq.headers, { trains, rouleurId: null })).statusCode,
    ).toBe(400)
    expect(
      (await envoyer(ctx, url, s.users.cheq.headers, { trains, rouleurId: off.id })).statusCode,
    ).toBe(404)
    const mixte = await versions(ctx, s.users.coord.headers, [t.trainId, autre.trainId])
    const ko = await envoyer(ctx, url, s.users.cheq.headers, { trains: mixte, rouleurId: r1.id })
    expect(ko.statusCode, ko.body).toBe(409)
    expect(erreur(ko)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-217' })
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('EXPORT_PREPA')
    const ok = await envoyer(ctx, url, s.users.cheq.headers, { trains, rouleurId: r1.id })
    expect(ok.statusCode, ok.body).toBe(200)
    for (const face of t.faces)
      expect(await faceDe(face.id)).toMatchObject({ statut: 'AU_ROULAGE', rouleurId: r1.id })
  })

  it('RG-COO-217 / 294 « Tout désaffecter » et « Proposer » ne laissent jamais un train « En production » sans rouleur ; la désaffectation mêlant prêt et en production est refusée en bloc (409, rien d’écrit)', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur TD1')
    const r2 = await rouleur(s, 'Rouleur TD2')
    const prete = await pret(s, ['Rose'], { extra: { rouleurId: r1.id } })
    const prod = await enProd(s, ['Gris'], r1.id)
    const avant = await etat([prete.trainId, prod.trainId])
    const ko = await affecter(s, [prete.trainId, prod.trainId], null)
    expect(ko.statusCode, ko.body).toBe(409)
    expect(erreur(ko).code).toBe('COO_ROULEUR_OBLIGATOIRE')
    expect(await etat([prete.trainId, prod.trainId])).toEqual(avant)
    const tout = await repartir(s, 'desaffecter', [prete.trainId, prod.trainId])
    expect(tout.statusCode, tout.body).toBe(200)
    expect(tout.json<{ message: string }>().message).toContain(
      '1 train(s) en production gardent leur rouleur',
    )
    expect((await faceDe(prod.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
    expect((await faceDe(prete.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    // Réaffectation d'un train en production : vers un rouleur valide uniquement, l'ancien est conservé sinon.
    const autreAtelier = await rouleur(s, 'Rouleur autre atelier', s.atelier2.id)
    const ko2 = await affecter(s, [prod.trainId], autreAtelier.id)
    expect(ko2.statusCode).toBe(422)
    expect(erreur(ko2).code).toBe('COO_ROULEUR_AUTRE_ATELIER')
    expect((await faceDe(prod.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
    expect((await affecter(s, [prod.trainId], r2.id)).statusCode).toBe(200)
    expect((await faceDe(prod.faces[0]?.id ?? 0)).rouleurId).toBe(r2.id)
  })
})

// ═════════════════════════ réimpression avec motif ═════════════════════════

describe('RG-COO-301 réimpression : motif obligatoire (400 sinon), même numéro, mêmes textes, statut inchangé, compteur +1, historique avec motif', () => {
  it('RG-COO-301 motif absent, vide, nul, hors liste ou de casse différente : 400 (aucune écriture) ; les trois motifs de la liste sont acceptés', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur M1')
    const t = await pret(s, ['Rose'])
    const b = await imprime(s, t.trainId, r1.id)
    const headers = s.users.cheq.headers
    const url = '/api/coordination/bagues/reimprimer'
    const mauvais: [string, unknown][] = [
      ['absent', { trainId: t.trainId, version: b.version }],
      ['vide', { trainId: t.trainId, version: b.version, motif: '' }],
      ['nul', { trainId: t.trainId, version: b.version, motif: null }],
      ['casse', { trainId: t.trainId, version: b.version, motif: 'autre' }],
      ['hors liste', { trainId: t.trainId, version: b.version, motif: 'Bague perdue' }],
      ['précision vide', { trainId: t.trainId, version: b.version, motif: 'Autre', precision: '' }],
      [
        'précision blanche',
        { trainId: t.trainId, version: b.version, motif: 'Autre', precision: '   ' },
      ],
      [
        'précision trop longue',
        { trainId: t.trainId, version: b.version, motif: 'Autre', precision: 'x'.repeat(201) },
      ],
    ]
    for (const [nom, payload] of mauvais) {
      const r = await envoyer(ctx, url, headers, payload)
      expect(r.statusCode, `${nom} : ${r.body}`).toBe(400)
    }
    expect((await db.bague.findUniqueOrThrow({ where: { id: b.id } })).reimpressions).toBe(0)
    expect(
      await db.journalAudit.count({ where: { entiteId: t.trainId, action: 'REIMPRESSION_BAGUE' } }),
    ).toBe(0)
    let version = b.version
    for (const motif of ['Colis perdu, refait', 'Bague abîmée ou illisible', 'Autre']) {
      const r = await reimprimer(s, t.trainId, version, motif)
      expect(r.statusCode, r.body).toBe(200)
      version = ResultatBagueSchema.parse(r.json()).version
    }
    const precision = 'x'.repeat(200)
    expect(
      (await reimprimer(s, t.trainId, version, 'Autre', s.users.cheq.headers, idem(), precision))
        .statusCode,
    ).toBe(200)
  })

  it('RG-COO-301 effets : même numéro (aucune nouvelle bague), mêmes textes (y compris modifiés), statut et rouleur des faces inchangés, compteur +1, version +1, journal avec motif et auteur', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur M2')
    const t = await pret(s, ['Rose', 'Gris'])
    const b = await imprime(s, t.trainId, r1.id)
    const m = ResultatBagueSchema.parse(
      (
        await modifier(s, t.trainId, b.version, [
          { lettre: 'A', annonceur: 'ANNONCEUR', theme: 'Rose' },
          { lettre: 'B', annonceur: 'ANNONCEUR', theme: 'Gris modifié' },
        ])
      ).json(),
    )
    const avantFaces = await etat([t.trainId])
    const r = await reimprimer(s, t.trainId, m.version, 'Colis perdu, refait')
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatBagueSchema.parse(r.json())
    expect(res).toMatchObject({ reimpressions: m.reimpressions + 1, version: m.version + 1 })
    expect(res.bague).toMatchObject({ numero: b.id, rouleur: 'Rouleur M2' })
    expect(res.bague.lignes.map((l) => [l.lettre, l.theme, l.modifie])).toEqual([
      ['A', 'Rose', false],
      ['B', 'Gris modifié', true],
    ])
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(1)
    const apres = await etat([t.trainId])
    expect(apres.faces).toEqual(avantFaces.faces)
    expect(apres.historique).toBe(avantFaces.historique)
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: t.trainId, action: 'REIMPRESSION_BAGUE' },
    })
    expect(j).toMatchObject({ parId: s.users.cheq.id, complement: 'RG-COO-301' })
    expect(j.nouvelleValeur).toContain(`Bague n° ${String(b.id)} réimprimée : Colis perdu, refait`)
    expect(res.message).toContain('Colis perdu, refait')
  })

  it('RG-COO-301 la précision du motif « Autre » est tracée ; une version de bague périmée 409 sans compteur incrémenté', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur M3')
    const t = await pret(s, ['Rose'])
    const b = await imprime(s, t.trainId, r1.id)
    const ok = await reimprimer(
      s,
      t.trainId,
      b.version,
      'Autre',
      s.users.cheq.headers,
      idem(),
      'Palette tombée',
    )
    expect(ok.statusCode, ok.body).toBe(200)
    expect(
      (
        await db.journalAudit.findFirstOrThrow({
          where: { entiteId: t.trainId, action: 'REIMPRESSION_BAGUE' },
        })
      ).nouvelleValeur,
    ).toContain('Autre (Palette tombée)')
    const perime = await reimprimer(s, t.trainId, b.version, 'Autre')
    expect(perime.statusCode).toBe(409)
    expect(erreur(perime).code).toBe('COO_CONFLIT_VERSION')
    expect((await db.bague.findUniqueOrThrow({ where: { id: b.id } })).reimpressions).toBe(1)
  })
})

// ═════════════════════════ contenu et textes des bagues ═════════════════════════

describe('RG-COO-302 / 300 contenu de l’étiquette et textes imprimés par position', () => {
  it('RG-COO-302 contenu : numéro, code-barres du numéro, Nb aff, destinataire, afficheur · atelier, départ, rouleur, lignes « dossier · annonceur — lettre » et thème ; une position fractionnée n’y figure pas', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur C1')
    const c1 = numero()
    const t = await pret(s, ['Rose', 'Gris', 'Bleu'], {
      annonceur: 'ALPHA',
      extra: { contNum: c1 },
    })
    await db.faceTrain.update({ where: { id: t.faces[1]?.id ?? 0 }, data: { fractionnee: true } })
    const avant = ApercusBaguesSchema.parse(
      (await apercu([t.trainId], s.users.cheq.headers)).json(),
    )
    expect(avant.total).toBe(1)
    expect(avant.bagues[0]).toMatchObject({
      numero: null,
      codeBarre: `BG-${t.trainId}`,
      trainId: t.trainId,
      nbAff: 2,
      destinataire: s.destinataire.nom,
      afficheur: 'AFFICHEUR SUD',
      atelier: s.atelier.libelle,
      depart: DEPART.toISOString(),
      rouleur: null,
    })
    expect(
      avant.bagues[0]?.lignes.map((l) => [l.dossier, l.annonceur, l.lettre, l.theme, l.modifie]),
    ).toEqual([
      [c1, 'ALPHA', 'A', 'Rose', false],
      [c1, 'ALPHA', 'C', 'Bleu', false],
    ])
    const b = await imprime(s, t.trainId, r1.id)
    const apres = ApercusBaguesSchema.parse(
      (await apercu([t.trainId], s.users.cheq.headers)).json(),
    ).bagues[0]
    expect(apres).toMatchObject({ numero: b.id, rouleur: 'Rouleur C1', nbAff: 2 })
    expect(apres?.codeBarre).toBe(`BG${String(b.id).padStart(8, '0')}`)
    expect(JSON.parse(b.textes)).toEqual([
      { lettre: 'A', annonceur: 'ALPHA', theme: 'Rose', modifie: false },
      { lettre: 'C', annonceur: 'ALPHA', theme: 'Bleu', modifie: false },
    ])
  })

  it('RG-COO-302 Nb aff = positions non fractionnées : 1 position, 6 positions (limite de RG-COO-209) ; l’ordre des aperçus suit la demande et le total compte tous les trains', async () => {
    const s = await siteD()
    const un = await pret(s, ['Rose'])
    const six = await pret(s, ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
    const r = ApercusBaguesSchema.parse(
      (await apercu([six.trainId, un.trainId], s.users.cheq.headers)).json(),
    )
    expect(new Map(r.bagues.map((b) => [b.trainId, b.nbAff]))).toEqual(
      new Map([
        [six.trainId, 6],
        [un.trainId, 1],
      ]),
    )
    expect(r.total).toBe(2)
    const sept = []
    for (let i = 0; i < 7; i++) sept.push((await pret(s, [`Vol${String(i)}`])).trainId)
    const grand = ApercusBaguesSchema.parse((await apercu(sept, s.users.cheq.headers)).json())
    expect(grand.total).toBe(7)
    expect(grand.bagues).toHaveLength(7)
  })

  it('RG-COO-300 textes : modification d’une seule position, tag « modifié » sur celle-ci seulement, réimpression automatique (compteur), texte rogné, aperçu et liste cohérents, faces inchangées', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur C2')
    const t = await pret(s, ['Rose', 'Gris'], { annonceur: 'ALPHA' })
    const b = await imprime(s, t.trainId, r1.id)
    const avant = await etat([t.trainId])
    const r = await modifier(s, t.trainId, b.version, [
      { lettre: 'A', annonceur: '  ALPHA  ', theme: 'Rose' },
      { lettre: 'B', annonceur: ' Nouvel annonceur ', theme: 'Gris' },
    ])
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatBagueSchema.parse(r.json())
    expect(res.reimpressions).toBe(1)
    expect(res.bague.lignes.map((l) => [l.lettre, l.annonceur, l.modifie])).toEqual([
      ['A', 'ALPHA', false],
      ['B', 'Nouvel annonceur', true],
    ])
    const ligne = (await bagues(s, '&bague=IMPRIMEES')).lignes.find((l) => l.trainId === t.trainId)
    expect(ligne?.bague).toMatchObject({ modifiee: true, reimpressions: 1, numero: b.id })
    expect(ligne?.textes.map((x) => x.modifie)).toEqual([false, true])
    const apres = await etat([t.trainId])
    expect(apres.faces).toEqual(avant.faces)
    expect((await faceDe(t.faces[1]?.id ?? 0)).theme).toBe('Gris')
    expect((await faceDe(t.faces[1]?.id ?? 0)).contAnnonc).toBe('ALPHA')
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: t.trainId, action: 'MODIFICATION_BAGUE' },
    })
    expect(j.ancienneValeur).toContain('B ALPHA · Gris')
    expect(j.nouvelleValeur).toContain('B Nouvel annonceur · Gris')
  })

  it('RG-COO-300 limites des textes : 100 caractères acceptés, 101 refusés (400) ; texte vide ou blanc 422 « Le thème et l’annonceur ne peuvent pas être vides. » ; aucune écriture', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur C3')
    const t = await pret(s, ['Rose'])
    const b = await imprime(s, t.trainId, r1.id)
    const avant = await etat([t.trainId])
    for (const [nom, annonceur, theme] of [
      ['annonceur vide', '', 'Rose'],
      ['annonceur blanc', '   ', 'Rose'],
      ['thème vide', 'X', ''],
      ['thème blanc', 'X', '\t '],
    ]) {
      const r = await modifier(s, t.trainId, b.version, [{ lettre: 'A', annonceur, theme }])
      expect(r.statusCode, `${nom} : ${r.body}`).toBe(422)
      expect(erreur(r)).toMatchObject({ code: 'COO_TEXTE_VIDE', regle: 'RG-COO-300' })
      expect(erreur(r).message).toBe("Le thème et l'annonceur ne peuvent pas être vides.")
    }
    const long = await modifier(s, t.trainId, b.version, [
      { lettre: 'A', annonceur: 'a'.repeat(101), theme: 'Rose' },
    ])
    expect(long.statusCode).toBe(400)
    expect(await etat([t.trainId])).toEqual(avant)
    const limite = await modifier(s, t.trainId, b.version, [
      { lettre: 'A', annonceur: 'a'.repeat(100), theme: 'b'.repeat(100) },
    ])
    expect(limite.statusCode, limite.body).toBe(200)
    const sans = await modifier(s, t.trainId, 2, [
      { lettre: 'A', annonceur: 'a'.repeat(100), theme: 'b'.repeat(100) },
    ])
    expect(sans.statusCode, sans.body).toBe(422)
    expect(erreur(sans).message).toBe("Rien n'a changé.")
  })

  it('RG-COO-300 positions : une lettre inconnue, en double ou manquante est refusée (422 COO_BAGUE_POSITIONS) ; la lettre d’une position fractionnée n’est pas modifiable', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur C4')
    const t = await pret(s, ['Rose', 'Gris', 'Bleu'])
    await db.faceTrain.update({ where: { id: t.faces[1]?.id ?? 0 }, data: { fractionnee: true } })
    const b = await imprime(s, t.trainId, r1.id)
    for (const [nom, textes] of [
      [
        'lettre fractionnée',
        [
          { lettre: 'A', annonceur: 'X', theme: 'Y' },
          { lettre: 'B', annonceur: 'X', theme: 'Y' },
          { lettre: 'C', annonceur: 'X', theme: 'Y' },
        ],
      ],
      ['manquante', [{ lettre: 'A', annonceur: 'X', theme: 'Y' }]],
      [
        'doublon',
        [
          { lettre: 'A', annonceur: 'X', theme: 'Y' },
          { lettre: 'A', annonceur: 'X', theme: 'Z' },
        ],
      ],
      [
        'inconnue',
        [
          { lettre: 'A', annonceur: 'X', theme: 'Y' },
          { lettre: 'Z', annonceur: 'X', theme: 'Y' },
        ],
      ],
    ] as const) {
      const r = await modifier(s, t.trainId, b.version, textes)
      expect(r.statusCode, `${nom} : ${r.body}`).toBe(422)
      expect(erreur(r).code).toBe('COO_BAGUE_POSITIONS')
    }
    const ok = await modifier(s, t.trainId, b.version, [
      { lettre: 'A', annonceur: 'X', theme: 'Y' },
      { lettre: 'C', annonceur: 'X', theme: 'Z' },
    ])
    expect(ok.statusCode, ok.body).toBe(200)
  })

  it('RG-COO-299 la sélection mêlant un train prêt et un train non prêt : aperçu des deux, impression du seul prêt, les raisons sont listées et le total d’aperçu n’est pas modifié', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur C5')
    const ok = await pret(s, ['Rose'])
    const attente = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const prod = await enProd(s, ['Bleu'], r1.id)
    const r = await imprimer(s, [ok.trainId, attente.trainId, prod.trainId], r1.id)
    expect(r.statusCode, r.body).toBe(200)
    const res = ImpressionBaguesSchema.parse(r.json())
    expect(res).toMatchObject({ imprimees: 1, simulee: true })
    expect(res.ignorees.map((x) => x.trainId).sort()).toEqual(
      [attente.trainId, prod.trainId].sort(),
    )
    expect(res.ignorees.find((x) => x.trainId === attente.trainId)?.raison).toContain('En attente')
    expect(res.ignorees.find((x) => x.trainId === prod.trainId)?.raison).toBe('déjà en production')
    expect(
      await db.bague.count({
        where: { trainId: { in: [ok.trainId, attente.trainId, prod.trainId] } },
      }),
    ).toBe(1)
  })
})

// ═════════════════════════ dispatch : charge, alertes ═════════════════════════

describe('RG-COO-292 / 295 charge par rouleur et alertes du dispatch (limites)', () => {
  it('RG-COO-292 les positions fractionnées sont exclues des faces et de la charge ; un train entièrement fractionné pèse 0 face ; les faces d’un train de 6 positions pèsent 6', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur K1')
    const six = await enProd(s, ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'], r1.id)
    const partiel = await enProd(s, ['Rose', 'Gris'], r1.id)
    await db.faceTrain.update({
      where: { id: partiel.faces[1]?.id ?? 0 },
      data: { fractionnee: true },
    })
    const tout = await enProd(s, ['Bleu'], r1.id)
    await db.faceTrain.update({
      where: { id: tout.faces[0]?.id ?? 0 },
      data: { fractionnee: true },
    })
    const d = await dispatch(s)
    expect(ligneDe(d, six.trainId)).toMatchObject({ faces: 6, nb: 1 })
    expect(ligneDe(d, partiel.trainId)?.faces).toBe(1)
    expect(ligneDe(d, tout.trainId)?.faces).toBe(0)
    expect(d.charge.find((c) => c.rouleurId === r1.id)).toMatchObject({
      trains: 3,
      faces: 7,
      chargePct: 100,
    })
    expect(d.indicateurs).toEqual({ trainsARouler: 3, faces: 7, nonAffectes: 0 })
  })

  it('RG-COO-292 la moyenne est celle des rouleurs de l’atelier (les rouleurs d’un autre atelier, même site, n’y comptent pas) ; sans rouleur : charge vide, aucune division par zéro', async () => {
    const s = await siteD()
    const vide = await dispatch(s)
    expect(vide.charge).toEqual([])
    expect(vide.alertes.surcharges).toEqual([])
    const a = await rouleur(s, 'Rouleur L1')
    const b = await rouleur(s, 'Rouleur L2')
    await rouleur(s, 'Rouleur d’un autre atelier', s.atelier2.id)
    await enProd(s, ['Rose', 'Gris', 'Bleu'], a.id)
    await enProd(s, ['Vert'], b.id)
    const d = await dispatch(s)
    expect(d.charge.map((c) => [c.nom, c.faces, c.chargePct]).sort()).toEqual([
      ['Rouleur L1', 3, 150],
      ['Rouleur L2', 1, 50],
    ])
    expect(d.charge).toHaveLength(2)
    expect(d.rouleurs.map((r) => r.nom).sort()).toEqual(['Rouleur L1', 'Rouleur L2'])
    const sans = await rouleur(s, 'Rouleur L3')
    expect(sans.id).toBeGreaterThan(0)
    expect((await dispatch(s)).charge.find((c) => c.nom === 'Rouleur L1')?.chargePct).toBe(225)
  })

  it('RG-COO-292 la charge décrit l’atelier : les filtres statut, dossier et destinataire ne la changent pas, mais restreignent les lignes et les indicateurs', async () => {
    const s = await siteD()
    const a = await rouleur(s, 'Rouleur F1')
    const prod = await enProd(s, ['Rose'], a.id)
    const prete = await pret(s, ['Gris'])
    const sans = await dispatch(s)
    const filtre = await dispatch(s, '&statut=PRET')
    expect(filtre.lignes.map((l) => l.cle)).toEqual([prete.trainId])
    expect(filtre.indicateurs).toEqual({ trainsARouler: 1, faces: 1, nonAffectes: 1 })
    expect(filtre.charge).toEqual(sans.charge)
    const dossier = await dispatch(s, `&dossier=${String(prod.faces[0]?.contNum)}`)
    expect(dossier.lignes).toHaveLength(1)
    expect(dossier.charge).toEqual(sans.charge)
  })

  it('RG-COO-295 surcharge : au seuil exact (charge = 100 % pour un seuil de 100) aucune alerte, sous le seuil (99) les deux rouleurs sont signalés ; stricte supériorité (Q-195 (6))', async () => {
    const s = await siteD()
    const a = await rouleur(s, 'Rouleur S1')
    const b = await rouleur(s, 'Rouleur S2')
    await enProd(s, ['Rose'], a.id)
    await enProd(s, ['Gris'], b.id)
    await parametre(ctx, 'dispatch.seuilChargePct', '100')
    const egal = await dispatch(s)
    expect(egal.charge.map((c) => c.chargePct)).toEqual([100, 100])
    expect(egal.alertes.surcharges).toEqual([])
    expect(egal.charge.every((c) => !c.surcharge)).toBe(true)
    await parametre(ctx, 'dispatch.seuilChargePct', '99')
    const sous = await dispatch(s)
    expect(sous.alertes.surcharges.map((x) => x.rouleur).sort()).toEqual([
      'Rouleur S1',
      'Rouleur S2',
    ])
    expect(sous.alertes.seuilSurchargePct).toBe(99)
  })

  it('RG-COO-295 départ proche : la limite des 36 h (à une minute près), un départ déjà passé, un train affecté, deux trains identiques comptés pour deux', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur U1')
    const base = Date.now() + 36 * HEURE
    const depart = (minutes: number) => ({ dateDepart: new Date(base + minutes * 60_000) })
    const juste = await pret(s, ['Rose'], { extra: depart(-1) })
    const apres = await pret(s, ['Gris'], { extra: depart(2) })
    const passe = await pret(s, ['Bleu'], {
      extra: { dateDepart: new Date(Date.now() - 5 * HEURE) },
    })
    const affecte = await pret(s, ['Vert'], { extra: { ...depart(-30), rouleurId: r1.id } })
    const c = numero()
    const x1 = await pret(s, ['Jaune'], { extra: { ...depart(-30), contNum: c } })
    const x2 = await pret(s, ['Jaune'], { extra: { ...depart(-30), contNum: c } })
    const d = await dispatch(s)
    expect(ligneDe(d, juste.trainId)?.urgent).toBe(true)
    expect(ligneDe(d, apres.trainId)?.urgent).toBe(false)
    expect(ligneDe(d, passe.trainId)?.urgent).toBe(true)
    expect(ligneDe(d, affecte.trainId)?.urgent).toBe(false)
    expect(ligneDe(d, x1.trainId)).toBe(ligneDe(d, x2.trainId))
    expect(ligneDe(d, x1.trainId)).toMatchObject({ nb: 2, urgent: true })
    // juste (1) + passé (1) + les deux trains identiques (2) = 4 trains non affectés sous le seuil.
    expect(d.alertes.departProche).toBe(4)
    await parametre(ctx, 'dispatch.seuilDepartHeures', '1')
    const serre = await dispatch(s)
    expect(serre.alertes).toMatchObject({ seuilDepartHeures: 1, departProche: 1 })
    expect(ligneDe(serre, passe.trainId)?.urgent).toBe(true)
  })
})

// ═════════════════════════ dispatch : affectation manuelle ═════════════════════════

describe('RG-COO-294 affectation manuelle d’un rouleur : lot, tout ou rien, absence de changement', () => {
  it('RG-COO-294 un lot de trains reçoit le même rouleur ; chaque train est journalisé ; réaffecter le même rouleur n’écrit aucune face', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur A1')
    const ts = [await pret(s, ['Rose']), await pret(s, ['Gris', 'Bleu']), await pret(s, ['Vert'])]
    const ids = ts.map((t) => t.trainId)
    const r = await affecter(s, ids, r1.id)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toEqual({ message: 'Rouleur Rouleur A1 affecté à 3 train(s).', nombre: 3 })
    for (const t of ts)
      for (const face of t.faces) expect((await faceDe(face.id)).rouleurId).toBe(r1.id)
    expect(
      await db.journalAudit.count({
        where: { entiteId: { in: ids }, action: 'AFFECTATION_DISPATCH' },
      }),
    ).toBe(3)
    const avant = await etat(ids)
    expect((await affecter(s, ids, r1.id)).statusCode).toBe(200)
    expect((await etat(ids)).faces).toEqual(avant.faces)
    expect((await dispatch(s)).indicateurs.nonAffectes).toBe(0)
  })

  it('RG-COO-294 tout ou rien : un train hors dispatch ou un rouleur d’un autre atelier dans le lot annule toute l’affectation (aucune face, aucun journal)', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur A2')
    const autre = await rouleur(s, 'Rouleur A2 autre', s.atelier2.id)
    const ok = await pret(s, ['Rose'])
    const attente = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const deuxiemeAtelier = await pret(s, ['Bleu'], { atelierId: s.atelier2.id })
    const ids = [ok.trainId, attente.trainId]
    const avant = await etat(ids)
    const ko = await affecter(s, ids, r1.id)
    expect(ko.statusCode).toBe(409)
    expect(erreur(ko).code).toBe('TRANSITION_INTERDITE')
    expect(await etat(ids)).toEqual(avant)
    const mixte = await affecter(s, [ok.trainId, deuxiemeAtelier.trainId], r1.id)
    expect(mixte.statusCode, mixte.body).toBe(422)
    expect(erreur(mixte).code).toBe('COO_ROULEUR_AUTRE_ATELIER')
    expect((await faceDe(ok.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect((await affecter(s, [deuxiemeAtelier.trainId], autre.id)).statusCode).toBe(200)
  })

  it('RG-COO-294 « Non affecté » d’un train déjà non affecté : sans effet sur les faces ; la liste vide et les listes de plus de 500 trains sont refusées (400)', async () => {
    const s = await siteD()
    const t = await pret(s, ['Rose'])
    const avant = await etat([t.trainId])
    const r = await affecter(s, [t.trainId], null)
    expect(r.statusCode, r.body).toBe(200)
    expect((await etat([t.trainId])).faces).toEqual(avant.faces)
    const vide = await envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
      trains: [],
      rouleurId: null,
    })
    expect(vide.statusCode).toBe(400)
    const trop = Array.from({ length: 501 }, (_, i) => ({
      trainId: `9${String(i)}`,
      version: '1.1.1',
    }))
    const t501 = await envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
      trains: trop,
      rouleurId: null,
    })
    expect(t501.statusCode).toBe(400)
  })

  it('RG-COO-294 un train cité deux fois dans la même demande ne casse rien (pas de 500) et laisse un état cohérent (un seul rouleur sur toutes les faces)', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur A4')
    const t = await pret(s, ['Rose', 'Gris'])
    const [v] = await versions(ctx, s.users.coord.headers, [t.trainId])
    const r = await envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
      trains: [v, v],
      rouleurId: r1.id,
    })
    expect(r.statusCode, r.body).toBeLessThan(500)
    const faces = await db.faceTrain.findMany({ where: { trainId: t.trainId } })
    expect(new Set(faces.map((x) => x.rouleurId)).size).toBe(1)
  })
})

// ═════════════════════════ dispatch : proposition simulée ═════════════════════════

describe('RG-COO-293 « Proposer une répartition » : règle SIMULÉE (Q-276), départ le plus proche d’abord puis rouleur le moins chargé', () => {
  it('RG-COO-293 la charge de départ compte les faces déjà affectées ; ex æquo : plus petit identifiant ; message exact ; chaque affectation est journalisée comme proposition (simulée)', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur P1')
    const r2 = await rouleur(s, 'Rouleur P2')
    await enProd(s, ['Rose', 'Gris'], r1.id)
    const dep = (h: number) => ({ dateDepart: new Date(Date.now() + h * HEURE) })
    const t3 = await pret(s, ['T3'], { extra: dep(90) })
    const t1 = await pret(s, ['T1'], { extra: dep(30) })
    const t2 = await pret(s, ['T2'], { extra: dep(60) })
    const r = await repartir(s, 'proposer', [t3.trainId, t1.trainId, t2.trainId])
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toEqual({
      message: 'Répartition proposée : 3 trains sur 2 rouleurs.',
      nombre: 3,
    })
    // R1 porte déjà 2 faces : T1 → R2 (0), T2 → R2 (1 < 2), T3 : égalité 2 / 2 → plus petit id = R1.
    expect((await faceDe(t1.faces[0]?.id ?? 0)).rouleurId).toBe(r2.id)
    expect((await faceDe(t2.faces[0]?.id ?? 0)).rouleurId).toBe(r2.id)
    expect((await faceDe(t3.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
    const j = await db.journalAudit.findMany({
      where: {
        entiteId: { in: [t1.trainId, t2.trainId, t3.trainId] },
        action: 'PROPOSITION_REPARTITION',
      },
    })
    expect(j).toHaveLength(3)
    expect(j.every((x) => x.complement === 'RG-COO-293' && x.parId === s.users.cheq.id)).toBe(true)
    // Le dispatch annonce un moteur simulé, avant comme après.
    expect((await dispatch(s)).moteurSimule).toBe(true)
  })

  it('RG-COO-293 un rouleur désactivé ou d’un autre atelier n’est jamais choisi, même moins chargé ; seuls les trains cités dans la demande sont répartis', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur P3')
    const off = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur P3 off',
      dateFin: new Date(Date.now() - HEURE),
    })
    const ailleurs = await rouleur(s, 'Rouleur P3 ailleurs', s.atelier2.id)
    await enProd(s, ['Rose', 'Gris', 'Bleu'], r1.id)
    const cites = [await pret(s, ['C1']), await pret(s, ['C2'])]
    const hors = await pret(s, ['H1'])
    const r = await repartir(
      s,
      'proposer',
      cites.map((t) => t.trainId),
    )
    expect(r.statusCode, r.body).toBe(200)
    for (const t of cites) expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
    expect((await faceDe(hors.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect(await db.faceTrain.count({ where: { rouleurId: { in: [off.id, ailleurs.id] } } })).toBe(
      0,
    )
  })

  it('RG-COO-293 rejouer la proposition quand tout est affecté : 422 COO_RIEN_A_REPARTIR, rien n’est écrit', async () => {
    const s = await siteD()
    await rouleur(s, 'Rouleur P4')
    const t = await pret(s, ['Rose'])
    expect((await repartir(s, 'proposer', [t.trainId])).statusCode).toBe(200)
    const avant = await etat([t.trainId])
    const deux = await repartir(s, 'proposer', [t.trainId])
    expect(deux.statusCode, deux.body).toBe(422)
    expect(erreur(deux)).toMatchObject({ code: 'COO_RIEN_A_REPARTIR', regle: 'RG-COO-293' })
    expect(await etat([t.trainId])).toEqual(avant)
  })
})

// ═════════════════════════ suivi 8 m² et pré-assemblage ═════════════════════════

describe('RG-COO-237 suivi 8 m² : saisie des demies et des finales, limites', () => {
  async function theme8m2() {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await recu(ctx, s, c, 'Rose', 1)
    return { s, c }
  }

  it('RG-COO-237 limites de la valeur : 0 et 1 000 000 acceptés ; −1, décimal, texte, nul, absent refusés (400) ; une saisie refusée n’écrit rien', async () => {
    const { s, c } = await theme8m2()
    const mauvaises: [string, unknown][] = [
      ['−1', -1],
      ['décimal', 1.5],
      ['texte', '5'],
      ['nul', null],
      ['booléen', true],
    ]
    for (const [nom, v] of mauvaises) {
      const r = await saisie(s, 'Rose', c, 'finales', v, 0)
      expect(r.statusCode, `${nom} : ${r.body}`).toBe(400)
    }
    const absent = await envoyer(ctx, '/api/coordination/trains/suivi-8m2', s.users.cheq.headers, {
      atelierId: s.atelier.id,
      depart: DEPART_TXT,
      contNum: c,
      theme: 'Rose',
      champ: 'finales',
      version: 0,
    })
    expect(absent.statusCode).toBe(400)
    expect(await db.suivi8m2.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    const zero = await saisie(s, 'Rose', c, 'demiesHaut', 0, 0)
    expect(zero.statusCode, zero.body).toBe(200)
    const grand = await saisie(s, 'Rose', c, 'demiesBas', 1_000_000, 1)
    expect(grand.statusCode, grand.body).toBe(200)
    const enorme = await saisie(s, 'Rose', c, 'demiesBas', 2 ** 31, 2)
    expect(enorme.statusCode).toBeLessThan(500)
  })

  it('RG-COO-237 chaque champ est indépendant ; reste à faire = besoin − finales (0 = soldé) ; la casse et les espaces du thème désignent le même thème ; le journal garde l’ancienne valeur', async () => {
    const { s, c } = await theme8m2()
    const un = await saisie(s, 'Rose', c, 'demiesHaut', 3, 0)
    expect(un.statusCode, un.body).toBe(200)
    const deux = await saisie(s, '  ROSE ', c, 'demiesBas', 4, 1)
    expect(deux.statusCode, deux.body).toBe(200)
    const trois = await saisie(s, 'rose', c, 'finales', 2, 2)
    expect(trois.statusCode, trois.body).toBe(200)
    const ligne = (await suivi(s)).lignes.find((l) => l.contNum === c)
    expect(ligne).toMatchObject({
      demiesHaut: 3,
      demiesBas: 4,
      finales: 2,
      besoin: 2,
      resteAFaire: 0,
      version: 3,
    })
    expect(await db.suivi8m2.count({ where: { plateformeId: s.plateforme.id, contNum: c } })).toBe(
      1,
    )
    const maj = await saisie(s, 'Rose', c, 'demiesHaut', 9, 3)
    expect(maj.statusCode).toBe(200)
    const j = await db.journalAudit.findMany({
      where: { typeEntite: 'SUIVI_8M2' },
      orderBy: { id: 'desc' },
      take: 1,
    })
    expect(j[0]).toMatchObject({ ancienneValeur: '3', nouvelleValeur: '8 m² : demies haut = 9' })
  })

  it('RG-COO-237 version : négative 400 ; première saisie avec une version non nulle 409 ; saisie suivante avec une version trop ancienne 409 ; aucune écriture', async () => {
    const { s, c } = await theme8m2()
    expect((await saisie(s, 'Rose', c, 'finales', 1, -1)).statusCode).toBe(400)
    expect((await saisie(s, 'Rose', c, 'finales', 1, 4)).statusCode).toBe(409)
    expect(await db.suivi8m2.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect((await saisie(s, 'Rose', c, 'finales', 1, 0)).statusCode).toBe(200)
    const vieux = await saisie(s, 'Rose', c, 'finales', 5, 0)
    expect(vieux.statusCode).toBe(409)
    expect(erreur(vieux).code).toBe('COO_CONFLIT_VERSION')
    expect(
      (await db.suivi8m2.findFirstOrThrow({ where: { plateformeId: s.plateforme.id } })).finales,
    ).toBe(1)
  })

  it('RG-COO-237 semaines ISO : la semaine 53 d’une année à 53 semaines (2026) est acceptée ; 2025-W53, W00, W54 refusées (400)', async () => {
    const s = await site8m2()
    const lire = (depart: string) =>
      get(
        ctx,
        `/api/coordination/trains/suivi-8m2?depart=${depart}&atelier=${String(s.atelier.id)}`,
        s.users.coord.headers,
      )
    const ok = await lire('2026-W53')
    expect(ok.statusCode, ok.body).toBe(200)
    expect(Suivi8m2Schema.parse(ok.json()).semaine).toEqual({ annee: 2026, semaine: 53 })
    for (const depart of ['2025-W53', '2026-W00', '2026-W54', '2026-53', 'S12']) {
      expect((await lire(depart)).statusCode, depart).toBe(400)
    }
  })

  it('RG-COO-237 le paramètre des ateliers 8 m² tolère espaces, doublons et valeurs invalides (ignorées) : seuls les identifiants valides désignent des ateliers 8 m²', async () => {
    const s = await siteD()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Gris'], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
      extra: { contNum: c + 1 },
    })
    await parametre(
      ctx,
      'suivi8m2.ateliers',
      ` abc ; -5 ; 0 ; 1.5 ;  ${String(s.atelier.id)} ;; ${String(s.atelier.id)} `,
    )
    const r = Suivi8m2Schema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/suivi-8m2?depart=${DEPART_TXT}`,
          s.users.coord.headers,
        )
      ).json(),
    )
    expect(r.ateliers.map((a) => a.id)).toEqual([s.atelier.id])
    expect(r.lignes.map((l) => l.theme)).toEqual(['Rose'])
  })
})

describe('RG-COO-234 pré-assemblage 8 m² (par thème, Q-262)', () => {
  async function theme() {
    const s = await site8m2()
    const c = numero()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    await recu(ctx, s, c, 'Rose', 1)
    return { s, c, t }
  }

  it('RG-COO-234 marquer puis désassembler (cycle complet), journal à chaque fois ; thème inconnu 404 ; version périmée 409 ; rien d’écrit en cas de refus', async () => {
    const { s, c, t } = await theme()
    const v1 = await versionTheme(s, c)
    const ok = await preAssembler(s, [{ contNum: c, theme: 'Rose', version: v1 }], true)
    expect(ok.statusCode, ok.body).toBe(200)
    expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(true)
    const perime = await preAssembler(s, [{ contNum: c, theme: 'Rose', version: v1 }], false)
    expect(perime.statusCode, perime.body).toBe(409)
    expect(erreur(perime).code).toBe('COO_CONFLIT_VERSION')
    expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(true)
    const inconnu = await preAssembler(s, [{ contNum: c, theme: 'Inexistant', version: v1 }], true)
    expect(inconnu.statusCode).toBe(404)
    const off = await preAssembler(
      s,
      [{ contNum: c, theme: 'Rose', version: await versionTheme(s, c) }],
      false,
    )
    expect(off.statusCode, off.body).toBe(200)
    expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(false)
    expect(
      await db.journalAudit.count({ where: { entiteId: t.trainId, action: 'PRE_ASSEMBLAGE' } }),
    ).toBe(2)
  })

  it('RG-COO-234 un thème ne marque que ses propres faces (l’autre thème du même train reste non pré-assemblé) ; deux demandes simultanées sur la même version : une seule passe', async () => {
    const { s, c, t } = await theme()
    const v = await versionTheme(s, c)
    const demande = () => preAssembler(s, [{ contNum: c, theme: 'Rose', version: v }], true)
    const [x, y] = await Promise.all([demande(), demande()])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(true)
    expect((await faceDe(t.faces[1]?.id ?? 0)).preAssemblage).toBe(false)
  })

  it('RG-COO-234 rejets de forme : liste vide, valeur absente ou texte (400) ; atomicité : un échec du journal du 2e thème annule le marquage du 1er', async () => {
    const { s, c, t } = await theme()
    const url = '/api/coordination/trains/pre-assemblage'
    const v = await versionTheme(s, c)
    const theme1 = {
      atelierId: s.atelier.id,
      depart: DEPART_TXT,
      contNum: c,
      theme: 'Rose',
      version: v,
    }
    expect(
      (await envoyer(ctx, url, s.users.cheq.headers, { themes: [], valeur: true })).statusCode,
    ).toBe(400)
    expect((await envoyer(ctx, url, s.users.cheq.headers, { themes: [theme1] })).statusCode).toBe(
      400,
    )
    expect(
      (await envoyer(ctx, url, s.users.cheq.headers, { themes: [theme1], valeur: 'oui' }))
        .statusCode,
    ).toBe(400)
    const c2 = numero()
    const t2 = await trainExportable(ctx, s, ['Bleu'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c2 },
    })
    await recu(ctx, s, c2, 'Bleu', 1)
    const v2 = await versionTheme(s, c2, 'Bleu')
    const ko = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${t2.trainId}'`,
      () =>
        preAssembler(
          s,
          [
            { contNum: c, theme: 'Rose', version: v },
            { contNum: c2, theme: 'Bleu', version: v2 },
          ],
          true,
        ),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(false)
    expect((await faceDe(t2.faces[0]?.id ?? 0)).preAssemblage).toBe(false)
  })
})

// ═════════════════════════ liste de picking ═════════════════════════

describe('RG-COO-296 liste de picking : emplacement, quantité rattachée, tri', () => {
  it('RG-COO-296 une ligne par affiche rattachée (deux affiches pour un visuel = deux lignes), quantité = quantité rattachée, tri par emplacement ; un lien retiré n’y figure plus ; un visuel partagé par deux trains n’y est qu’une fois', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur K')
    const c = numero()
    await pret(s, ['Rose'], { annonceur: 'ALPHA', extra: { contNum: c, rouleurId: r1.id } })
    await pret(s, ['Rose'], { annonceur: 'ALPHA', extra: { contNum: c, rouleurId: r1.id } })
    const ligne = await db.receptionAttendue.findFirstOrThrow({
      where: { plateformeId: s.plateforme.id, contNum: c, theme: 'Rose' },
    })
    const premiere = await db.afficheAttendue.findFirstOrThrow({
      where: { ligneAttendueId: ligne.id },
    })
    await db.affiche.update({
      where: { id: premiere.afficheId },
      data: { allee: 'C', rayon: '10', quantite: 99 },
    })
    await db.afficheAttendue.update({ where: { id: premiere.id }, data: { quantite: 7 } })
    const a2 = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: c,
      theme: 'Rose',
      quantite: 5,
      allee: 'A',
      rayon: '02',
    })
    await f.createRattachement(db, { afficheId: a2.id, ligneAttendueId: ligne.id, quantite: 3 })
    const a3 = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: c,
      theme: 'Rose',
      quantite: 4,
      allee: 'B',
      rayon: '01',
    })
    const retire = await f.createRattachement(db, {
      afficheId: a3.id,
      ligneAttendueId: ligne.id,
      quantite: 4,
      actif: false,
    })
    expect(retire.actif).toBe(false)
    const r = await picking(r1.id, s.users.cheq.headers)
    expect(r.statusCode, r.body).toBe(200)
    const p = PickingSchema.parse(r.json())
    // Le 2e train a reçu sa propre affiche (B-12, quantité 1) : le visuel partagé par deux trains n'est listé qu'une fois par lien.
    expect(p.lignes.map((l) => [l.emplacement, l.quantite])).toEqual([
      ['A-02', 3],
      ['B-12', 1],
      ['C-10', 7],
    ])
    expect(p.lignes[0]?.numAffiche).toBe(a2.id)
    expect(p.lignes[2]?.numAffiche).toBe(premiere.afficheId)
    expect(p.lignes.map((l) => l.numAffiche)).not.toContain(a3.id)
    expect(p.lignes.every((l) => l.annonceur === 'ALPHA' && l.theme === 'Rose')).toBe(true)
  })

  it('RG-COO-296 les trains désaffectés ou d’un autre rouleur n’y figurent pas ; un train imprimé (En production) y reste ; lecture seule', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur K2')
    const r2 = await rouleur(s, 'Rouleur K3')
    const a = await pret(s, ['Rose'], { extra: { rouleurId: r1.id } })
    await pret(s, ['Gris'], { extra: { rouleurId: r2.id } })
    await pret(s, ['Bleu'])
    expect(
      PickingSchema.parse((await picking(r1.id, s.users.cheq.headers)).json()).lignes.map(
        (l) => l.theme,
      ),
    ).toEqual(['Rose'])
    await imprime(s, a.trainId, r1.id)
    expect(
      PickingSchema.parse((await picking(r1.id, s.users.cheq.headers)).json()).lignes.map(
        (l) => l.theme,
      ),
    ).toEqual(['Rose'])
    expect(
      PickingSchema.parse((await picking(r2.id, s.users.cheq.headers)).json()).lignes.map(
        (l) => l.theme,
      ),
    ).toEqual(['Gris'])
  })
})

// ═════════════════════════ référentiel des rouleurs ═════════════════════════

describe('RG-COO-297 référentiel des rouleurs : fin de validité, atelier, limites', () => {
  it('RG-COO-297 fin de validité : passée = désactivé (non proposé au dispatch ni à « Choisir le rouleur », non affectable) ; future = actif ; la réactivation efface la date de fin', async () => {
    const s = await siteD()
    const passe = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur V1',
      dateFin: new Date(Date.now() - 60_000),
    })
    const futur = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur V2',
      dateFin: new Date(Date.now() + 2 * HEURE),
    })
    const t = await pret(s, ['Rose'])
    const ref = RouleursReferentielSchema.parse(
      (await get(ctx, '/api/coordination/rouleurs', s.users.admin.headers)).json(),
    )
    expect(ref.rouleurs.find((r) => r.id === passe.id)?.actif).toBe(false)
    expect(ref.rouleurs.find((r) => r.id === futur.id)?.actif).toBe(true)
    const d = await dispatch(s)
    expect(d.rouleurs.map((r) => r.nom)).toEqual(['Rouleur V2'])
    const liste = RouleursSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    const libres = await db.rouleur.findMany({
      where: { atelierId: null, OR: [{ dateFin: null }, { dateFin: { gt: new Date() } }] },
      select: { nom: true },
    })
    expect(liste.rouleurs.map((r) => r.nom).sort()).toEqual(
      ['Rouleur V2', ...libres.map((r) => r.nom)].sort(),
    )
    expect((await affecter(s, [t.trainId], passe.id)).statusCode).toBe(404)
    expect((await affecter(s, [t.trainId], futur.id)).statusCode).toBe(200)
    const react = await api(
      'PATCH',
      `/api/coordination/rouleurs/${String(passe.id)}`,
      s.users.admin.headers,
      { version: passe.version, actif: true },
    )
    expect(react.statusCode, react.body).toBe(200)
    expect((await db.rouleur.findUniqueOrThrow({ where: { id: passe.id } })).dateFin).toBeNull()
    expect((await affecter(s, [t.trainId], passe.id)).statusCode).toBe(200)
  })

  it('RG-COO-297 un rouleur désactivé encore porté par un train reste affiché (nom) sur la ligne et dans la charge, sans être proposé', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur V3')
    const t = await enProd(s, ['Rose'], r1.id)
    await db.rouleur.update({
      where: { id: r1.id },
      data: { dateFin: new Date(Date.now() - 60_000) },
    })
    const d = await dispatch(s)
    expect(ligneDe(d, t.trainId)?.rouleur).toMatchObject({ id: r1.id, nom: 'Rouleur V3' })
    expect(d.charge.find((c) => c.rouleurId === r1.id)).toMatchObject({
      nom: 'Rouleur V3',
      faces: 1,
    })
    expect(d.rouleurs).toEqual([])
  })

  it('RG-COO-297 limites : nom de 100 caractères accepté, 101 refusé ; poste de 50 accepté, 51 refusé ; nom ou poste blanc refusé ; poste effaçable (null) ; nom rogné', async () => {
    const s = await siteD()
    const admin = s.users.admin.headers
    const ok = await creerRouleur(
      { nom: `  ${'n'.repeat(100)}  `, poste: 'p'.repeat(50), atelierId: s.atelier.id },
      admin,
    )
    expect(ok.statusCode, ok.body).toBe(200)
    const r = RouleurLigneSchema.parse(ok.json())
    expect(r.nom).toBe('n'.repeat(100))
    for (const [nom, payload] of [
      ['nom 101', { nom: 'n'.repeat(101), atelierId: s.atelier.id }],
      ['poste 51', { nom: 'Z', poste: 'p'.repeat(51), atelierId: s.atelier.id }],
      ['nom blanc', { nom: '   ', atelierId: s.atelier.id }],
      ['poste blanc', { nom: 'Z', poste: '  ', atelierId: s.atelier.id }],
      ['atelier absent', { nom: 'Z' }],
      ['atelier zéro', { nom: 'Z', atelierId: 0 }],
    ] as const) {
      expect((await creerRouleur(payload, admin)).statusCode, nom).toBe(400)
    }
    const efface = await api('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, admin, {
      version: r.version,
      poste: null,
    })
    expect(efface.statusCode, efface.body).toBe(200)
    expect(RouleurLigneSchema.parse(efface.json()).poste).toBeNull()
  })

  it('RG-COO-297 unicité du nom par atelier : un rouleur peut changer la casse de son propre nom ; un nom désactivé reste réservé ; le même nom est libre dans l’autre atelier du site', async () => {
    const s = await siteD()
    const admin = s.users.admin.headers
    const r = RouleurLigneSchema.parse(
      (await creerRouleur({ nom: 'Rouleur N1', atelierId: s.atelier.id }, admin)).json(),
    )
    const casse = await api('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, admin, {
      version: r.version,
      nom: 'ROULEUR N1',
    })
    expect(casse.statusCode, casse.body).toBe(200)
    const off = await api('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, admin, {
      version: r.version + 1,
      actif: false,
    })
    expect(off.statusCode).toBe(200)
    const doublon = await creerRouleur({ nom: 'rouleur n1', atelierId: s.atelier.id }, admin)
    expect(doublon.statusCode).toBe(409)
    expect(erreur(doublon)).toMatchObject({ code: 'COO_ROULEUR_EXISTE', regle: 'RG-COO-297' })
    expect(
      (await creerRouleur({ nom: 'Rouleur N1', atelierId: s.atelier2.id }, admin)).statusCode,
    ).toBe(200)
  })

  it('RG-COO-297 les rouleurs d’un atelier ne sont proposés que pour cet atelier (dispatch et « Choisir le rouleur ») ; le référentiel est trié par atelier puis par nom et porte l’indicateur « utilisé »', async () => {
    const s = await siteD()
    await rouleur(s, 'Zoé')
    const b = await rouleur(s, 'Alice')
    await rouleur(s, 'Autre atelier', s.atelier2.id)
    await enProd(s, ['Rose'], b.id)
    expect((await dispatch(s)).rouleurs.map((r) => r.nom)).toEqual(['Alice', 'Zoé'])
    const liste = RouleursSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/rouleurs?atelier=${String(s.atelier2.id)}`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    const libres = await db.rouleur.findMany({
      where: { atelierId: null, OR: [{ dateFin: null }, { dateFin: { gt: new Date() } }] },
      select: { nom: true },
    })
    expect(liste.rouleurs.map((r) => r.nom).sort()).toEqual(
      ['Autre atelier', ...libres.map((r) => r.nom)].sort(),
    )
    const ref = RouleursReferentielSchema.parse(
      (await get(ctx, '/api/coordination/rouleurs', s.users.admin.headers)).json(),
    )
    const miens = ref.rouleurs.filter((r) => r.atelier?.id === s.atelier.id)
    expect(miens.map((r) => r.nom)).toEqual(['Alice', 'Zoé'])
    expect(miens.map((r) => r.utilise)).toEqual([true, false])
    expect(miens[0]?.atelier?.plateforme).toBe(s.plateforme.nom)
  })
})

// ═════════════════════════ B4 : train déjà envoyé à la machine ═════════════════════════

describe('RG-COO-217 / Q-194 B4 : un train déjà envoyé à la machine ne repart pas, un train modifié depuis peut repartir', () => {
  it('RG-COO-217 préparer une sélection qui mêle un train déjà envoyé et un train neuf : 409 COO_TRAIN_DEJA_ENVOYE (seul le train envoyé est cité), aucun lot créé, le train neuf reste « Prêt »', async () => {
    const s = await siteD()
    const envoye = await pret(s, ['Rose'])
    const neuf = await pret(s, ['Gris'])
    const g = GenerationSchema.parse((await preparer(s, [envoye.trainId])).json())
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
    const avant = await db.generationFichiers.count()
    const r = await preparer(s, [envoye.trainId, neuf.trainId])
    expect(r.statusCode, r.body).toBe(409)
    const e = erreur(r)
    expect(e).toMatchObject({ code: 'COO_TRAIN_DEJA_ENVOYE', regle: 'RG-COO-217' })
    expect(JSON.stringify(e.details)).toContain(envoye.trainId)
    expect(JSON.stringify(e.details)).toContain(g.lot)
    expect(JSON.stringify(e.details)).not.toContain(neuf.trainId)
    expect(await db.generationFichiers.count()).toBe(avant)
    const gen = await generateur(s)
    expect(gen.trains.find((x) => x.trainId === neuf.trainId)?.statut).toBe('PRET')
    expect(gen.trains.find((x) => x.trainId === envoye.trainId)?.statut).toBe('DEJA_ENVOYE')
    expect((await preparer(s, [neuf.trainId])).statusCode).toBe(200)
  })

  it('RG-COO-217 envoyer un lot « Préparé » dont un train a été envoyé par un autre lot : 409 ; un lot déjà envoyé ne se renvoie pas (409 TRANSITION_INTERDITE) ; deux envois simultanés : un seul passe', async () => {
    const s = await siteD()
    const t = await pret(s, ['Rose'])
    const g1 = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    const g2 = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    const [x, y] = await Promise.all([envoi(s, g1.id, g1.version), envoi(s, g2.id, g2.version)])
    const codes = [x.statusCode, y.statusCode].sort()
    expect(codes[0]).toBe(200)
    expect(codes[1]).toBeGreaterThanOrEqual(409)
    expect(
      await db.generationFichiers.count({
        where: { trains: { contains: t.trainId }, statut: 'ENVOYE' },
      }),
    ).toBe(1)
    const gagnant = x.statusCode === 200 ? g1 : g2
    const perdant = x.statusCode === 200 ? g2 : g1
    const relance = await envoi(s, gagnant.id, gagnant.version + 1)
    expect(relance.statusCode).toBe(409)
    expect(erreur(relance).code).toBe('TRANSITION_INTERDITE')
    const dernier = await envoi(s, perdant.id, perdant.version)
    expect(dernier.statusCode, dernier.body).toBeGreaterThanOrEqual(409)
  })

  it('RG-COO-217 un train dont la bague est imprimée (En production) n’est plus préparable : 409 COO_TRAIN_NON_PRET ; il est présenté « Déjà envoyé » (hors Prêt) par le générateur', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur G1')
    const t = await pret(s, ['Rose'])
    await imprime(s, t.trainId, r1.id)
    const p = await preparer(s, [t.trainId])
    expect(p.statusCode, p.body).toBe(409)
    expect(erreur(p).code).toBe('COO_TRAIN_NON_PRET')
    expect((await generateur(s)).trains.find((x) => x.trainId === t.trainId)?.statut).toBe(
      'DEJA_ENVOYE',
    )
  })

  it('RG-COO-217 train modifié depuis l’envoi (autre version) : redevient « Prêt » et peut repartir dans un nouveau lot ; l’ancien lot reste « Envoyé »', async () => {
    const s = await site8m2()
    const c = numero()
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    await recu(ctx, s, c, 'Rose', 1)
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
    expect((await generateur(s)).trains.find((x) => x.trainId === t.trainId)?.statut).toBe(
      'DEJA_ENVOYE',
    )
    const pa = await preAssembler(
      s,
      [{ contNum: c, theme: 'Rose', version: await versionTheme(s, c) }],
      true,
    )
    expect(pa.statusCode, pa.body).toBe(200)
    expect((await generateur(s)).trains.find((x) => x.trainId === t.trainId)?.statut).toBe('PRET')
    const g2 = await preparer(s, [t.trainId])
    expect(g2.statusCode, g2.body).toBe(200)
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).statut).toBe(
      'ENVOYE',
    )
  })

  it('RG-COO-217 limite des tiroirs (Q-254) : exactement le maximum accepté, un de plus refusé (422 COO_TIROIRS_DEPASSES) sans lot ; train d’une autre semaine refusé (409)', async () => {
    const s = await siteD()
    await parametre(ctx, 'trains.tiroirsMax', '2')
    const deux = await pret(s, ['Rose', 'Gris'])
    const trois = await pret(s, ['A', 'B', 'C'])
    const avant = await db.generationFichiers.count()
    const ko = await preparer(s, [trois.trainId])
    expect(ko.statusCode, ko.body).toBe(422)
    expect(erreur(ko)).toMatchObject({ code: 'COO_TIROIRS_DEPASSES', regle: 'RG-COO-216' })
    expect(await db.generationFichiers.count()).toBe(avant)
    expect((await preparer(s, [deux.trainId])).statusCode).toBe(200)
    const ailleurs = await pret(s, ['Autre'])
    const semaineSuivante = '2099-W10'
    const hs = await preparer(s, [ailleurs.trainId], semaineSuivante)
    expect(hs.statusCode, hs.body).toBe(409)
    expect(erreur(hs).code).toBe('COO_TRAIN_AUTRE_SEMAINE')
  })

  it('RG-COO-217 idempotence et atomicité : même clé rejouée = un seul lot / un seul envoi ; un échec de l’écriture du lot à l’envoi laisse le lot « Préparé » et le train « Prêt » ; un échec du journal à la préparation ne crée aucun lot', async () => {
    const s = await siteD()
    const t = await pret(s, ['Rose'])
    const cle = idem()
    const a = await preparer(s, [t.trainId], DEPART_TXT, s.users.cheq.headers, cle)
    const b = await preparer(s, [t.trainId], DEPART_TXT, s.users.cheq.headers, cle)
    expect(b.json()).toEqual(a.json())
    expect(await db.generationFichiers.count({ where: { trains: { contains: t.trainId } } })).toBe(
      1,
    )
    const g = GenerationSchema.parse(a.json())
    const ko = await avecEchec(
      ctx,
      `BEFORE UPDATE ON generation_fichiers WHEN NEW.id = ${String(g.id)}`,
      () => envoi(s, g.id, g.version),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).toMatchObject({
      statut: 'PREPARE',
      version: g.version,
      machineEnvoi: null,
    })
    expect((await generateur(s)).trains.find((x) => x.trainId === t.trainId)?.statut).toBe('PRET')
    const cle2 = idem()
    const e1 = await envoi(s, g.id, g.version, s.users.cheq.headers, cle2)
    expect(e1.statusCode, e1.body).toBe(200)
    for (let i = 0; i < 6; i++)
      expect((await envoi(s, g.id, g.version, s.users.cheq.headers, cle2)).json()).toEqual(
        e1.json(),
      )
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version).toBe(
      g.version + 1,
    )
    const u = await pret(s, ['Gris'])
    const avant = await db.generationFichiers.count()
    const ko2 = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'GENERATION_FICHIERS'",
      () => preparer(s, [u.trainId]),
    )
    expect(ko2.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.generationFichiers.count()).toBe(avant)
  })
})

// ═════════════════════════ RG-COO-303 ═════════════════════════

describe('RG-COO-303 tableau de roulage alimenté par la bague : aucune route tant que Q-278 n’est pas tranchée', () => {
  it('RG-COO-303 aucune route de tableau de roulage, de fichier vierge ni de primes (404, toutes méthodes) ; la bague porte l’atelier, le rouleur, la date et l’auteur qui l’alimenteraient', async () => {
    const s = await siteD()
    for (const chemin of [
      'tableau-roulage',
      'roulage',
      'roulage/tableau',
      'fichier-vierge',
      'primes',
      'bagues/tableau',
      'bagues/roulage',
    ]) {
      for (const methode of ['GET', 'POST'] as const) {
        const r = await api(
          methode,
          `/api/coordination/${chemin}`,
          s.users.admin.headers,
          methode === 'POST' ? {} : undefined,
        )
        expect(r.statusCode, `${methode} ${chemin}`).toBe(404)
      }
    }
    const r1 = await rouleur(s, 'Rouleur 303')
    const t = await pret(s, ['Rose'])
    const avant = new Date()
    const b = await imprime(s, t.trainId, r1.id)
    expect(b).toMatchObject({
      atelierId: s.atelier.id,
      rouleurId: r1.id,
      imprimeeParId: s.users.cheq.id,
    })
    expect(Math.abs(b.imprimeeLe.getTime() - avant.getTime())).toBeLessThan(60_000)
  })
})

// ═════════════════════════ concurrence ═════════════════════════

describe('RG-COO-308 concurrence : deux écritures sur la même version, une réussit, l’autre 409', () => {
  it('RG-COO-308 deux affectations simultanées de rouleurs différents : une seule passe (200 / 409), le rouleur final est celui du gagnant', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur X1')
    const r2 = await rouleur(s, 'Rouleur X2')
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const poste = (rouleurId: number) =>
      envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
        trains,
        rouleurId,
      })
    const [a, b] = await Promise.all([poste(r1.id), poste(r2.id)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBe(a.statusCode === 200 ? r1.id : r2.id)
  })

  it('RG-COO-308 impression et affectation simultanées sur la même version du train : une seule passe ; l’état final est cohérent (jamais « Au roulage » sans rouleur)', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur X3')
    const r2 = await rouleur(s, 'Rouleur X4')
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const [a, b] = await Promise.all([
      envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, {
        trains,
        rouleurId: r1.id,
      }),
      envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
        trains,
        rouleurId: r2.id,
      }),
    ])
    expect([a.statusCode, b.statusCode].filter((c) => c === 200)).toHaveLength(1)
    const face = await faceDe(t.faces[0]?.id ?? 0)
    if (face.statut === 'AU_ROULAGE') expect(face.rouleurId).toBe(r1.id)
    else expect(face.rouleurId).toBe(r2.id)
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(
      a.statusCode === 200 ? 1 : 0,
    )
  })

  it('RG-COO-308 proposition et désaffectation simultanées sur la même version : une seule passe', async () => {
    const s = await siteD()
    await rouleur(s, 'Rouleur X5')
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const corps = { atelierId: s.atelier.id, trains }
    const [a, b] = await Promise.all([
      envoyer(ctx, '/api/coordination/dispatch/proposer', s.users.cheq.headers, corps),
      envoyer(ctx, '/api/coordination/dispatch/proposer', s.users.cheq.headers, corps),
    ])
    expect([a.statusCode, b.statusCode].filter((c) => c === 200)).toHaveLength(1)
    expect([a.statusCode, b.statusCode].some((c) => c === 409 || c === 422)).toBe(true)
    expect(
      await db.journalAudit.count({
        where: { entiteId: t.trainId, action: 'PROPOSITION_REPARTITION' },
      }),
    ).toBe(1)
  })

  it('RG-COO-308 un lot avec un seul train périmé (autre utilisateur passé avant) est refusé en bloc (409) pour l’impression, la proposition et la désaffectation ; aucune écriture', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur X6')
    const a = await pret(s, ['Rose'])
    const b = await pret(s, ['Gris'])
    const vieux = await versions(ctx, s.users.coord.headers, [a.trainId, b.trainId])
    expect((await affecter(s, [b.trainId], r1.id)).statusCode).toBe(200)
    const avant = await etat([a.trainId, b.trainId])
    for (const [url, extra] of [
      ['/api/coordination/bagues/imprimer', { rouleurId: r1.id }],
      ['/api/coordination/dispatch/affecter', { rouleurId: r1.id }],
      ['/api/coordination/dispatch/proposer', { atelierId: s.atelier.id }],
      ['/api/coordination/dispatch/desaffecter', { atelierId: s.atelier.id }],
    ] as const) {
      const r = await envoyer(ctx, url, s.users.cheq.headers, { trains: vieux, ...extra })
      expect(r.statusCode, `${url} : ${r.body}`).toBe(409)
      expect(erreur(r).code).toBe('COO_CONFLIT_VERSION')
    }
    expect(await etat([a.trainId, b.trainId])).toEqual(avant)
  })

  it('RG-COO-297 deux créations simultanées du même nom de rouleur dans un atelier : une seule passe (200 / 409), un seul rouleur en base', async () => {
    const s = await siteD()
    const nom = `Rouleur Course ${String(next())}`
    const poste = () => creerRouleur({ nom, atelierId: s.atelier.id }, s.users.admin.headers)
    const [a, b] = await Promise.all([poste(), poste()])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await db.rouleur.count({ where: { atelierId: s.atelier.id, nom } })).toBe(1)
  })

  it('RG-COO-297 modification et suppression simultanées d’un rouleur : jamais de 500 ; le rouleur est soit supprimé, soit modifié', async () => {
    const s = await siteD()
    const r = await rouleur(s, 'Rouleur Course 2')
    const [m, d] = await Promise.all([
      api('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, s.users.admin.headers, {
        version: r.version,
        nom: 'Renommé',
      }),
      api('DELETE', `/api/coordination/rouleurs/${String(r.id)}`, s.users.admin.headers),
    ])
    expect(m.statusCode).toBeLessThan(500)
    expect(d.statusCode).toBeLessThan(500)
    const apres = await db.rouleur.findUnique({ where: { id: r.id } })
    if (d.statusCode === 204) expect(apres).toBeNull()
    else expect(apres).not.toBeNull()
  })
})

// ═════════════════════════ idempotence (7 rejeux) ═════════════════════════

describe('RG-REC-008 / CLAUDE.md §6 idempotence : la même Idempotency-Key rejouée 7 fois ne crée qu’un seul effet', () => {
  /** Envoie 7 fois la même requête avec la même clé ; toutes les réponses doivent être identiques. */
  async function sept(url: string, headers: H, payload: unknown) {
    const cle = idem()
    const reponses = []
    for (let i = 0; i < 7; i++) reponses.push(await envoyer(ctx, url, headers, payload, cle))
    const premiere = reponses[0]
    expect(premiere?.statusCode, premiere?.body).toBe(200)
    for (const r of reponses) {
      expect(r.statusCode).toBe(200)
      expect(r.json()).toEqual(premiere?.json())
    }
    return premiere
  }

  it('RG-COO-299 imprimer : 7 rejeux = une bague, un passage « Au roulage », un historique, un journal', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur Id1')
    const t = await pret(s, ['Rose'])
    await sept('/api/coordination/bagues/imprimer', s.users.cheq.headers, {
      trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
      rouleurId: r1.id,
    })
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(1)
    expect(
      await db.statutHistorique.count({
        where: {
          typeEntite: 'FACE_TRAIN',
          entiteId: String(t.faces[0]?.id),
          nouveau: 'AU_ROULAGE',
        },
      }),
    ).toBe(1)
    expect(
      await db.journalAudit.count({ where: { entiteId: t.trainId, action: 'IMPRESSION_BAGUE' } }),
    ).toBe(1)
  })

  it('RG-COO-294 / 293 affecter, proposer et désaffecter : 7 rejeux = une seule écriture de chacun', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur Id2')
    const a = await pret(s, ['Rose'])
    const b = await pret(s, ['Gris'])
    const c = await pret(s, ['Bleu'], { extra: { rouleurId: r1.id } })
    const ver = (ids: string[]) => versions(ctx, s.users.coord.headers, ids)
    await sept('/api/coordination/dispatch/affecter', s.users.cheq.headers, {
      trains: await ver([a.trainId]),
      rouleurId: r1.id,
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: a.trainId, action: 'AFFECTATION_DISPATCH' },
      }),
    ).toBe(1)
    await sept('/api/coordination/dispatch/proposer', s.users.cheq.headers, {
      atelierId: s.atelier.id,
      trains: await ver([b.trainId]),
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: b.trainId, action: 'PROPOSITION_REPARTITION' },
      }),
    ).toBe(1)
    await sept('/api/coordination/dispatch/desaffecter', s.users.cheq.headers, {
      atelierId: s.atelier.id,
      trains: await ver([c.trainId]),
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: c.trainId, action: 'DESAFFECTATION_DISPATCH' },
      }),
    ).toBe(1)
    expect((await faceDe(c.faces[0]?.id ?? 0)).version).toBe(2)
  })

  it('RG-COO-300 / 301 modifier les textes et réimprimer : 7 rejeux = un seul incrément du compteur de réimpressions', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur Id3')
    const t = await pret(s, ['Rose'])
    const b = await imprime(s, t.trainId, r1.id)
    await sept('/api/coordination/bagues/modifier', s.users.cheq.headers, {
      trainId: t.trainId,
      version: b.version,
      textes: [{ lettre: 'A', annonceur: 'Autre', theme: 'Rose' }],
    })
    expect((await db.bague.findUniqueOrThrow({ where: { id: b.id } })).reimpressions).toBe(1)
    await sept('/api/coordination/bagues/reimprimer', s.users.cheq.headers, {
      trainId: t.trainId,
      version: b.version + 1,
      motif: 'Autre',
    })
    expect((await db.bague.findUniqueOrThrow({ where: { id: b.id } })).reimpressions).toBe(2)
    expect(
      await db.journalAudit.count({ where: { entiteId: t.trainId, action: 'REIMPRESSION_BAGUE' } }),
    ).toBe(1)
  })

  it('RG-COO-237 / 234 saisie 8 m² et pré-assemblage : 7 rejeux = une seule saisie (version 1), un seul marquage', async () => {
    const s = await site8m2()
    const c = numero()
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    await recu(ctx, s, c, 'Rose', 1)
    await sept('/api/coordination/trains/suivi-8m2', s.users.cheq.headers, {
      atelierId: s.atelier.id,
      depart: DEPART_TXT,
      contNum: c,
      theme: 'Rose',
      champ: 'finales',
      valeur: 1,
      version: 0,
    })
    expect(
      await db.suivi8m2.findFirstOrThrow({ where: { plateformeId: s.plateforme.id, contNum: c } }),
    ).toMatchObject({ finales: 1, version: 1 })
    const version = await versionTheme(s, c)
    await sept('/api/coordination/trains/pre-assemblage', s.users.cheq.headers, {
      themes: [{ atelierId: s.atelier.id, depart: DEPART_TXT, contNum: c, theme: 'Rose', version }],
      valeur: true,
    })
    expect(
      await db.journalAudit.count({ where: { entiteId: t.trainId, action: 'PRE_ASSEMBLAGE' } }),
    ).toBe(1)
  })

  it('RG-COO-297 création de rouleur : 7 rejeux = un seul rouleur ; 7 requêtes simultanées de même clé = un seul rouleur et jamais de 500', async () => {
    const s = await siteD()
    await sept('/api/coordination/rouleurs', s.users.admin.headers, {
      nom: 'Rouleur Id4',
      atelierId: s.atelier.id,
    })
    expect(await db.rouleur.count({ where: { atelierId: s.atelier.id, nom: 'Rouleur Id4' } })).toBe(
      1,
    )
    const cle = idem()
    const rs = await Promise.all(
      Array.from({ length: 7 }, () =>
        creerRouleur({ nom: 'Rouleur Id5', atelierId: s.atelier.id }, s.users.admin.headers, cle),
      ),
    )
    for (const r of rs) expect(r.statusCode, r.body).toBeLessThan(500)
    expect(rs.filter((r) => r.statusCode === 200).length).toBeGreaterThanOrEqual(1)
    expect(await db.rouleur.count({ where: { atelierId: s.atelier.id, nom: 'Rouleur Id5' } })).toBe(
      1,
    )
  })

  it('RG-COO-299 7 impressions simultanées de même clé : une seule bague, jamais de 500', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur Id6')
    const t = await pret(s, ['Rose'])
    const corps = {
      trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
      rouleurId: r1.id,
    }
    const cle = idem()
    const rs = await Promise.all(
      Array.from({ length: 7 }, () =>
        envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, corps, cle),
      ),
    )
    for (const r of rs) expect([200, 409], r.body).toContain(r.statusCode)
    expect(rs.some((r) => r.statusCode === 200)).toBe(true)
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(1)
  })
})

// ═════════════════════════ atomicité ═════════════════════════

describe('RG-COO-308 transactions : une panne au milieu ne laisse aucune écriture partielle (déclencheur SQLite temporaire)', () => {
  it('RG-COO-299 impression : un échec de l’insertion de la bague du 2e train annule la bague du 1er, ses faces, son historique et son journal ; la clé est rejouable ensuite', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur At1')
    const a = await pret(s, ['Rose'])
    const b = await pret(s, ['Gris'])
    const avant = await etat([a.trainId, b.trainId])
    const cle = idem()
    const ko = await avecEchec(
      ctx,
      `BEFORE INSERT ON bague WHEN NEW.train_id = '${b.trainId}'`,
      () => imprimer(s, [a.trainId, b.trainId], r1.id, s.users.cheq.headers, cle),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(await etat([a.trainId, b.trainId])).toEqual(avant)
    const ok = await imprimer(s, [a.trainId, b.trainId], r1.id, s.users.cheq.headers, cle)
    expect(ok.statusCode, ok.body).toBe(200)
  })

  it('RG-COO-299 impression : un échec de la mise à jour d’une face (après la pose de la bague) annule la bague', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur At2')
    const t = await pret(s, ['Rose', 'Gris'])
    const avant = await etat([t.trainId])
    const ko = await avecEchec(
      ctx,
      `BEFORE UPDATE ON tf_face_train WHEN NEW.ft_id = ${String(t.faces[1]?.id)}`,
      () => imprimer(s, [t.trainId], r1.id),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(await etat([t.trainId])).toEqual(avant)
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(0)
  })

  it('RG-COO-294 affectation : un échec de la 2e face annule l’affectation de la 1re (même train) ; proposition : un échec du journal du dernier train annule toutes les affectations', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur At3')
    const t = await pret(s, ['Rose', 'Gris'])
    const avant = await etat([t.trainId])
    const ko = await avecEchec(
      ctx,
      `BEFORE UPDATE ON tf_face_train WHEN NEW.ft_id = ${String(t.faces[1]?.id)}`,
      () => affecter(s, [t.trainId], r1.id),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(await etat([t.trainId])).toEqual(avant)
    const x = await pret(s, ['Bleu'])
    const y = await pret(s, ['Vert'])
    const ko2 = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${y.trainId}'`,
      () => repartir(s, 'proposer', [x.trainId, y.trainId]),
    )
    expect(ko2.statusCode).toBeGreaterThanOrEqual(400)
    expect(
      await db.faceTrain.count({
        where: { trainId: { in: [x.trainId, y.trainId] }, rouleurId: { not: null } },
      }),
    ).toBe(0)
  })

  it('RG-COO-294 « Tout désaffecter » : un échec du journal du 2e train annule la désaffectation du 1er', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur At4')
    const a = await pret(s, ['Rose'], { extra: { rouleurId: r1.id } })
    const b = await pret(s, ['Gris'], { extra: { rouleurId: r1.id } })
    const ko = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${b.trainId}'`,
      () => repartir(s, 'desaffecter', [a.trainId, b.trainId]),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(
      await db.faceTrain.count({
        where: { trainId: { in: [a.trainId, b.trainId] }, rouleurId: r1.id },
      }),
    ).toBe(2)
  })

  it('RG-COO-300 / 301 modification des textes et réimpression : un échec du journal ou de la mise à jour de la bague laisse textes, compteur et version inchangés', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur At5')
    const t = await pret(s, ['Rose'])
    const b = await imprime(s, t.trainId, r1.id)
    const ko = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${t.trainId}' AND NEW.action = 'MODIFICATION_BAGUE'`,
      () => modifier(s, t.trainId, b.version, [{ lettre: 'A', annonceur: 'Autre', theme: 'Rose' }]),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    const ko2 = await avecEchec(ctx, `BEFORE UPDATE ON bague WHEN NEW.id = ${String(b.id)}`, () =>
      reimprimer(s, t.trainId, b.version, 'Autre'),
    )
    expect(ko2.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.bague.findUniqueOrThrow({ where: { id: b.id } })).toEqual(b)
    expect(
      await db.journalAudit.count({
        where: {
          entiteId: t.trainId,
          action: { in: ['MODIFICATION_BAGUE', 'REIMPRESSION_BAGUE'] },
        },
      }),
    ).toBe(0)
  })

  it('RG-COO-237 saisie 8 m² : un échec du journal à la 2e saisie laisse la valeur et la version de la 1re ; RG-COO-297 modification / suppression d’un rouleur : un échec du journal annule l’écriture', async () => {
    const s = await site8m2()
    const c = numero()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await recu(ctx, s, c, 'Rose', 1)
    expect((await saisie(s, 'Rose', c, 'finales', 1, 0)).statusCode).toBe(200)
    const ko = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'SUIVI_8M2'",
      () => saisie(s, 'Rose', c, 'finales', 5, 1),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(
      await db.suivi8m2.findFirstOrThrow({ where: { plateformeId: s.plateforme.id, contNum: c } }),
    ).toMatchObject({ finales: 1, version: 1 })
    const r = await rouleur(s, 'Rouleur At6')
    const cible = `rouleur:${String(r.id)}`
    const ko2 = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${cible}'`,
      () =>
        api('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, s.users.admin.headers, {
          version: r.version,
          nom: 'Renommé',
        }),
    )
    expect(ko2.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.rouleur.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      nom: 'Rouleur At6',
      version: r.version,
    })
    const ko3 = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${cible}'`,
      () => api('DELETE', `/api/coordination/rouleurs/${String(r.id)}`, s.users.admin.headers),
    )
    expect(ko3.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.rouleur.count({ where: { id: r.id } })).toBe(1)
  })
})

// ═════════════════════════ entrées invalides (400) ═════════════════════════

describe('RG-COO-308 / schémas : entrées invalides refusées (400, format d’erreur unique) sur chaque route', () => {
  it('RG-COO-291 / 296 / 298 / 302 requêtes GET invalides : 400 avec { code, message }', async () => {
    const s = await siteD()
    const h = s.users.cheq.headers
    const mauvaises = [
      '/api/coordination/dispatch?atelier=abc',
      '/api/coordination/dispatch?atelier=0',
      '/api/coordination/dispatch?atelier=-1',
      '/api/coordination/dispatch?atelier=1.5',
      '/api/coordination/dispatch?dossier=abc',
      '/api/coordination/dispatch?depart=2026-W54',
      '/api/coordination/dispatch?depart=2026-13',
      '/api/coordination/dispatch?statut=PRODUIT',
      '/api/coordination/dispatch?destinataire=',
      `/api/coordination/dispatch?destinataire=${'x'.repeat(101)}`,
      '/api/coordination/dispatch/picking',
      '/api/coordination/dispatch/picking?rouleur=0',
      '/api/coordination/dispatch/picking?rouleur=abc',
      '/api/coordination/dispatch/picking?rouleur=1&depart=2026-W00',
      '/api/coordination/bagues?bague=TOUS',
      '/api/coordination/bagues?dossier=0',
      '/api/coordination/bagues?atelier=x',
      '/api/coordination/bagues?depart=bad',
      '/api/coordination/bagues/apercu',
      '/api/coordination/bagues/apercu?trains=',
      `/api/coordination/bagues/apercu?trains=${'9'.repeat(31)}`,
      `/api/coordination/bagues/apercu?trains=${Array.from({ length: 201 }, (_, i) => `9${String(i)}`).join(',')}`,
    ]
    for (const url of mauvaises) {
      const r = await get(ctx, url, h)
      expect(r.statusCode, url).toBe(400)
      expect(erreur(r).code, url).toBeTruthy()
    }
    const limite = await get(
      ctx,
      `/api/coordination/bagues/apercu?trains=${Array.from({ length: 200 }, (_, i) => `9${String(i)}`).join(',')}`,
      h,
    )
    expect(limite.statusCode, 'limite 200 : validation passée, trains inconnus').toBe(404)
  })

  it('RG-COO-293 / 294 / 299 / 300 / 301 corps POST invalides : 400 ; rien n’est écrit', async () => {
    const s = await siteD()
    const h = s.users.cheq.headers
    const v = { trainId: T0.trainId, version: T0.version }
    const cas: [string, unknown][] = [
      ['/api/coordination/dispatch/affecter', {}],
      ['/api/coordination/dispatch/affecter', { trains: [v] }],
      ['/api/coordination/dispatch/affecter', { trains: [v], rouleurId: 0 }],
      ['/api/coordination/dispatch/affecter', { trains: [v], rouleurId: -3 }],
      ['/api/coordination/dispatch/affecter', { trains: [v], rouleurId: 1.5 }],
      ['/api/coordination/dispatch/affecter', { trains: [v], rouleurId: '3' }],
      ['/api/coordination/dispatch/affecter', { trains: [{ trainId: T0.trainId }], rouleurId: 1 }],
      [
        '/api/coordination/dispatch/affecter',
        { trains: [{ trainId: T0.trainId, version: 1 }], rouleurId: 1 },
      ],
      ['/api/coordination/dispatch/proposer', { trains: [v] }],
      ['/api/coordination/dispatch/proposer', { atelierId: 0, trains: [v] }],
      ['/api/coordination/dispatch/proposer', { atelierId: 1, trains: [] }],
      ['/api/coordination/dispatch/desaffecter', { atelierId: 'a', trains: [v] }],
      ['/api/coordination/bagues/imprimer', { trains: [], rouleurId: 1 }],
      ['/api/coordination/bagues/imprimer', { trains: [v] }],
      [
        '/api/coordination/bagues/modifier',
        { trainId: T0.trainId, version: 0, textes: [{ lettre: 'A', annonceur: 'X', theme: 'Y' }] },
      ],
      ['/api/coordination/bagues/modifier', { trainId: T0.trainId, version: 1, textes: [] }],
      [
        '/api/coordination/bagues/modifier',
        {
          trainId: T0.trainId,
          version: 1,
          textes: Array.from({ length: 21 }, (_, i) => ({
            lettre: `L${String(i)}`,
            annonceur: 'X',
            theme: 'Y',
          })),
        },
      ],
      [
        '/api/coordination/bagues/modifier',
        { trainId: T0.trainId, version: 1, textes: [{ lettre: '', annonceur: 'X', theme: 'Y' }] },
      ],
      [
        '/api/coordination/bagues/modifier',
        {
          trainId: T0.trainId,
          version: 1,
          textes: [{ lettre: 'ABCDEF', annonceur: 'X', theme: 'Y' }],
        },
      ],
      [
        '/api/coordination/bagues/modifier',
        { trainId: T0.trainId, version: 1, textes: [{ lettre: 'A', annonceur: 'X' }] },
      ],
      [
        '/api/coordination/bagues/modifier',
        { trainId: '', version: 1, textes: [{ lettre: 'A', annonceur: 'X', theme: 'Y' }] },
      ],
      ['/api/coordination/bagues/reimprimer', { trainId: T0.trainId, version: 0, motif: 'Autre' }],
      [
        '/api/coordination/bagues/reimprimer',
        { trainId: 'x'.repeat(31), version: 1, motif: 'Autre' },
      ],
    ]
    const journal = await db.journalAudit.count()
    for (const [url, payload] of cas) {
      const r = await envoyer(ctx, url, h, payload)
      expect(r.statusCode, `${url} ${JSON.stringify(payload)} : ${r.body}`).toBe(400)
      expect(erreur(r).code).toBeTruthy()
    }
    expect(await db.journalAudit.count()).toBe(journal)
  })

  it('RG-COO-237 / 297 corps invalides du suivi 8 m² et des rouleurs : 400', async () => {
    const s = await siteD()
    const base = {
      atelierId: s.atelier.id,
      depart: DEPART_TXT,
      contNum: 1,
      theme: 'X',
      champ: 'finales',
      valeur: 1,
      version: 0,
    }
    const cas: [string, string, H, unknown][] = [
      [
        'POST',
        '/api/coordination/trains/suivi-8m2',
        s.users.cheq.headers,
        { ...base, champ: 'demies' },
      ],
      ['POST', '/api/coordination/trains/suivi-8m2', s.users.cheq.headers, { ...base, theme: '' }],
      [
        'POST',
        '/api/coordination/trains/suivi-8m2',
        s.users.cheq.headers,
        { ...base, theme: 'x'.repeat(101) },
      ],
      ['POST', '/api/coordination/trains/suivi-8m2', s.users.cheq.headers, { ...base, contNum: 0 }],
      [
        'POST',
        '/api/coordination/trains/suivi-8m2',
        s.users.cheq.headers,
        { ...base, atelierId: 0 },
      ],
      [
        'POST',
        '/api/coordination/trains/suivi-8m2',
        s.users.cheq.headers,
        { ...base, depart: 'bad' },
      ],
      [
        'POST',
        '/api/coordination/trains/suivi-8m2',
        s.users.cheq.headers,
        { ...base, valeur: 2_147_483_648 },
      ],
      ['PATCH', `/api/coordination/rouleurs/1`, s.users.admin.headers, {}],
      ['PATCH', `/api/coordination/rouleurs/1`, s.users.admin.headers, { version: 0, nom: 'X' }],
      ['PATCH', `/api/coordination/rouleurs/1`, s.users.admin.headers, { version: 1, nom: '' }],
      [
        'PATCH',
        `/api/coordination/rouleurs/1`,
        s.users.admin.headers,
        { version: 1, actif: 'oui' },
      ],
      ['PATCH', `/api/coordination/rouleurs/1`, s.users.admin.headers, { version: 1, poste: '' }],
      ['PATCH', '/api/coordination/rouleurs/abc', s.users.admin.headers, { version: 1 }],
      ['PATCH', '/api/coordination/rouleurs/0', s.users.admin.headers, { version: 1 }],
      ['DELETE', '/api/coordination/rouleurs/abc', s.users.admin.headers, undefined],
      ['DELETE', '/api/coordination/rouleurs/-2', s.users.admin.headers, undefined],
    ]
    for (const [methode, url, headers, payload] of cas) {
      const r = await api(methode as 'POST' | 'PATCH' | 'DELETE', url, headers, payload)
      expect(r.statusCode, `${methode} ${url} ${JSON.stringify(payload)} : ${r.body}`).toBe(400)
    }
    for (const qs of ['depart=2026-W00', 'atelier=a', 'annonceur=', 'dossier=-2']) {
      expect(
        (await get(ctx, `/api/coordination/trains/suivi-8m2?${qs}`, s.users.coord.headers))
          .statusCode,
        qs,
      ).toBe(400)
    }
  })

  it('RG-COO-001 une requête POST sans Idempotency-Key est refusée (400) pour chaque création / transition de la session, sans écriture', async () => {
    const s = await siteD()
    const r1 = await rouleur(s, 'Rouleur Ik')
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const avant = await etat([t.trainId])
    for (const [url, headers, payload] of [
      ['/api/coordination/bagues/imprimer', s.users.cheq.headers, { trains, rouleurId: r1.id }],
      ['/api/coordination/dispatch/affecter', s.users.cheq.headers, { trains, rouleurId: r1.id }],
      [
        '/api/coordination/dispatch/proposer',
        s.users.cheq.headers,
        { atelierId: s.atelier.id, trains },
      ],
      [
        '/api/coordination/dispatch/desaffecter',
        s.users.cheq.headers,
        { atelierId: s.atelier.id, trains },
      ],
      [
        '/api/coordination/rouleurs',
        s.users.admin.headers,
        { nom: 'Sans clé', atelierId: s.atelier.id },
      ],
    ] as [string, H, unknown][]) {
      const r = await ctx.app.inject({ method: 'POST', url, headers, payload: payload as object })
      expect(r.statusCode, `${url} : ${r.body}`).toBe(400)
    }
    expect(await etat([t.trainId])).toEqual(avant)
    expect(await db.rouleur.count({ where: { nom: 'Sans clé' } })).toBe(0)
  })
})

// ═════════════════════════ limites de paramètres SQLite (> 1 000 lignes) ═════════════════════════

// Classe de défaut déjà vue (ANO-035, ANO-049) : une clause `IN (...)` de plus de ~1 000 valeurs fait échouer Prisma
// ("The query parameter limit supported by your database is exceeded") et la route répond 500. Chaque test ci-dessous
// isole une des listes : ateliers, rouleurs, trains (dossiers distincts).
describe('RG-COO-291 / 296 / 297 / 298 / 237 limites de paramètres de SQLite : plus de 1 000 ateliers, rouleurs ou trains', () => {
  const TAILLE = 1100

  /** Crée n trains d'une seule face (train propre, thème propre) en lots, directement par createMany. */
  async function trainsEnMasse(
    s: SiteD,
    n: number,
    o: {
      statut: StatutProduction
      rouleurDe?: (i: number) => number | null
      contBase: number
      /** true : un seul dossier pour tous les trains (isole la limite des rouleurs de celle des dossiers). */
      memeDossier?: boolean
    },
  ) {
    const tag = String(next())
    const trainIds: string[] = []
    const lot = 25
    for (let debut = 0; debut < n; debut += lot) {
      const idx = Array.from({ length: Math.min(lot, n - debut) }, (_, k) => debut + k)
      const code = (i: number) => `VOL${tag}X${String(i).padStart(5, '0')}`
      const dossier = (i: number) => o.contBase + (o.memeDossier ? 0 : i)
      await db.instruction.createMany({
        data: idx.map((i) => ({
          code: code(i),
          statut: 'INSTRUCTION_OK' as const,
          atelierId: s.atelier.id,
          contNum: dossier(i),
          annonceur: 'VOLUME',
          contAnbas: SEM.annee,
          contSembas: SEM.semaine,
        })),
      })
      await db.faceTrain.createMany({
        data: idx.map((i) => {
          const trainId = `7${tag}${String(i).padStart(6, '0')}`
          trainIds.push(trainId)
          return {
            instructionCode: code(i),
            statut: o.statut,
            atelierId: s.atelier.id,
            supportId: s.support.id,
            destinataireId: s.destinataire.id,
            rouleurId: o.rouleurDe?.(i) ?? null,
            cadrIdent: next(),
            dateDepart: DEPART,
            contNum: dossier(i),
            contAnnonc: 'VOLUME',
            contAnbas: SEM.annee,
            contSembas: SEM.semaine,
            depAnbas: SEM.annee,
            depSembas: SEM.semaine,
            trainId,
            theme: `Thème ${String(i)}`,
            ordreReel: 1,
          }
        }),
      })
    }
    return trainIds
  }
  const rouleursEnMasse = async (s: SiteD, n: number, o: { desactives?: boolean } = {}) => {
    const tag = String(next())
    for (let debut = 0; debut < n; debut += 100) {
      await db.rouleur.createMany({
        data: Array.from({ length: Math.min(100, n - debut) }, (_, k) => ({
          atelierId: s.atelier.id,
          nom: `Rouleur volume ${tag}-${String(debut + k)}`,
          ...(o.desactives ? { dateFin: new Date(Date.now() - HEURE) } : {}),
        })),
      })
    }
    return (
      await db.rouleur.findMany({
        where: { atelierId: s.atelier.id, nom: { startsWith: `Rouleur volume ${tag}-` } },
        orderBy: { id: 'asc' },
      })
    ).map((r) => r.id)
  }

  it('RG-COO-297 plus de 1 000 ateliers : l’administrateur liste, crée, modifie et supprime des rouleurs ; un paramètre des ateliers 8 m² de plus de 1 000 identifiants reste lu', async () => {
    const existants = await db.atelier.count({ where: { type: 'SCROLL' } })
    if (existants < 1300) {
      const plateforme = await f.createPlateforme(db)
      await db.atelier.createMany({
        data: Array.from({ length: 1300 - existants }, (_, i) => ({
          plateformeId: plateforme.id,
          libelle: `Atelier volume ${String(i)}`,
          type: 'SCROLL' as const,
        })),
      })
    }
    const s = await siteD()
    const ids = (await db.atelier.findMany({ select: { id: true }, take: 1200 })).map((a) => a.id)
    await parametre(ctx, 'suivi8m2.ateliers', [...ids, s.atelier.id].join(';'))
    const admin = s.users.admin.headers
    const liste = await get(ctx, '/api/coordination/rouleurs', admin)
    expect(liste.statusCode, liste.body).toBe(200)
    RouleursReferentielSchema.parse(liste.json())
    const c = await creerRouleur({ nom: 'Rouleur >1000 ateliers', atelierId: s.atelier.id }, admin)
    expect(c.statusCode, c.body).toBe(200)
    const r = RouleurLigneSchema.parse(c.json())
    const maj = await api('PATCH', `/api/coordination/rouleurs/${String(r.id)}`, admin, {
      version: r.version,
      poste: 'Table 9',
    })
    expect(maj.statusCode, maj.body).toBe(200)
    expect(
      (await api('DELETE', `/api/coordination/rouleurs/${String(r.id)}`, admin)).statusCode,
    ).toBe(204)
    const sv = await get(
      ctx,
      `/api/coordination/trains/suivi-8m2?depart=${DEPART_TXT}`,
      s.users.coord.headers,
    )
    expect(sv.statusCode, sv.body).toBe(200)
    expect(Suivi8m2Schema.parse(sv.json()).ateliers.map((a) => a.id)).toContain(s.atelier.id)
  }, 300_000)

  it('RG-COO-292 / 293 plus de 1 000 rouleurs actifs : dispatch (rouleurs, charge), « Choisir le rouleur », proposition sur 500 trains et référentiel répondent sans erreur serveur', async () => {
    const s = await siteD()
    const ids = await rouleursEnMasse(s, TAILLE)
    expect(ids.length).toBe(TAILLE)
    const trains = await trainsEnMasse(s, 500, {
      statut: 'EXPORT_PREPA',
      contBase: 3_000_000 + numero() * 10,
      memeDossier: true,
    })
    const d = await dispatch(s)
    expect(d.rouleurs).toHaveLength(TAILLE)
    expect(d.charge).toHaveLength(TAILLE)
    expect(d.lignes).toHaveLength(500)
    const choix = RouleursSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    const libres = await db.rouleur.count({
      where: { atelierId: null, OR: [{ dateFin: null }, { dateFin: { gt: new Date() } }] },
    })
    expect(choix.rouleurs).toHaveLength(TAILLE + libres)
    const r = await envoyer(ctx, '/api/coordination/dispatch/proposer', s.users.cheq.headers, {
      atelierId: s.atelier.id,
      trains: await versions(ctx, s.users.coord.headers, trains),
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ nombre: number }>().nombre).toBe(500)
    const ref = await get(ctx, '/api/coordination/rouleurs', s.users.admin.headers)
    expect(ref.statusCode, ref.body).toBe(200)
    expect(RouleursReferentielSchema.parse(ref.json()).rouleurs.length).toBeGreaterThanOrEqual(
      TAILLE,
    )
  }, 600_000)

  it('RG-COO-297 plus de 1 000 rouleurs désactivés portant chacun un train : le dispatch répond 200 et nomme chaque rouleur dans la charge et sur sa ligne', async () => {
    const s = await siteD()
    const ids = await rouleursEnMasse(s, TAILLE, { desactives: true })
    await trainsEnMasse(s, TAILLE, {
      statut: 'AU_ROULAGE',
      rouleurDe: (i) => ids[i] ?? null,
      contBase: 4_000_000 + numero() * 10,
      memeDossier: true,
    })
    const d = await dispatch(s)
    expect(d.rouleurs).toEqual([])
    expect(d.charge).toHaveLength(TAILLE)
    expect(d.lignes).toHaveLength(TAILLE)
    expect(d.lignes.every((l) => l.rouleur !== null)).toBe(true)
  }, 600_000)

  // ANO-051 (corrigée) : `departsDesDossiers` (production.ts), `lignesThemeModifie` (themes.ts) et les lectures par
  // dossier des alertes passent par `parPaquets` : plus de 1 000 dossiers distincts ne font plus répondre 500.
  it('RG-COO-166 ANO-051 la liste des dossiers répond 200 quand plus de 1 000 dossiers distincts ont des lignes attendues', async () => {
    const s = await siteD()
    const base = 7_000_000 + numero() * 10
    for (let d = 0; d < TAILLE; d += 100)
      await db.receptionAttendue.createMany({
        data: Array.from({ length: Math.min(100, TAILLE - d) }, (_, k) => ({
          contNum: base + d + k,
          theme: `T${String(d + k)}`,
          themeCle: `T${String(d + k)}`,
          semNum: SEM.semaine,
          semAnnee: SEM.annee,
          source: SourceLigne.BC,
          etatLigne: EtatLigne.ACTIVE,
          statut: StatutLigneAttendue.ATTENDUE,
          qteBc: 10,
          plateformeId: s.plateforme.id,
          supportId: s.support.id,
        })),
      })
    const r = await get(ctx, '/api/coordination/dossiers?pageSize=100', s.users.coord.headers)
    expect(r.statusCode, r.body).toBe(200)
  }, 300_000)

  describe('plus de 1 000 dossiers distincts dans un atelier (couverture des visuels, trains.ts)', () => {
    let jeu: Promise<{ s: SiteD; r1: { id: number }; trains: string[] }> | undefined
    const dataset = () =>
      (jeu ??= (async () => {
        const s = await site8m2()
        const r1 = await rouleur(s, 'Rouleur Volume')
        const contBase = 5_000_000 + numero() * 10
        const trains = await trainsEnMasse(s, TAILLE, {
          statut: 'AU_ROULAGE',
          rouleurDe: () => r1.id,
          contBase,
        })
        // Réception : un visuel reçu (ligne attendue, affiche, lien) par train, pour le picking et le « reçu » du suivi.
        for (let d = 0; d < TAILLE; d += 100) {
          const part = Array.from({ length: Math.min(100, TAILLE - d) }, (_, k) => d + k)
          await db.receptionAttendue.createMany({
            data: part.map((i) => ({
              contNum: contBase + i,
              theme: `Thème ${String(i)}`,
              themeCle: `THÈME ${String(i)}`,
              semNum: SEM.semaine,
              semAnnee: SEM.annee,
              source: SourceLigne.BC,
              etatLigne: EtatLigne.ACTIVE,
              statut: StatutLigneAttendue.ATTENDUE,
              qteBc: 10,
              plateformeId: s.plateforme.id,
              supportId: s.support.id,
            })),
          })
          await db.affiche.createMany({
            data: part.map((i) => ({
              plateformeId: s.plateforme.id,
              supportId: s.support.id,
              statut: StatutAffiche.IDENTIFIEE,
              dateEntree: new Date('2026-01-05'),
              conservation: 20,
              quantite: 10,
              contNum: contBase + i,
              theme: `Thème ${String(i)}`,
              allee: 'V',
              rayon: String(i % 100),
            })),
          })
        }
        const att = await db.receptionAttendue.findMany({
          where: {
            plateformeId: s.plateforme.id,
            contNum: { gte: contBase, lt: contBase + TAILLE },
          },
          select: { id: true, contNum: true },
        })
        const aff = await db.affiche.findMany({
          where: {
            plateformeId: s.plateforme.id,
            contNum: { gte: contBase, lt: contBase + TAILLE },
          },
          select: { id: true, contNum: true },
        })
        const afficheDe = new Map(aff.map((a) => [a.contNum, a.id]))
        for (let d = 0; d < att.length; d += 100) {
          await db.afficheAttendue.createMany({
            data: att.slice(d, d + 100).map((l) => ({
              afficheId: afficheDe.get(l.contNum) ?? 0,
              ligneAttendueId: l.id,
              quantite: 2,
              mode: ModeRattachement.BL,
            })),
          })
        }
        return { s, r1, trains }
      })())

    // ANO-050 (corrigée) : `couverture` (trains.ts) et les lectures de picking / suivi 8 m² passent par `parPaquets` :
    // dispatch, bagues, picking et suivi 8 m² d'un atelier de plus de 1 000 dossiers distincts répondent 200.
    it('RG-COO-291 ANO-050 le dispatch d’un atelier de plus de 1 000 dossiers distincts répond 200 avec toutes les lignes', async () => {
      const { s } = await dataset()
      const dsp = await dispatch(s)
      expect(dsp.lignes).toHaveLength(TAILLE)
      expect(dsp.indicateurs).toEqual({ trainsARouler: TAILLE, faces: TAILLE, nonAffectes: 0 })
    }, 900_000)

    it('RG-COO-298 ANO-050 la liste des bagues « Sans bague » d’un atelier de plus de 1 000 dossiers distincts répond 200 avec toutes les lignes', async () => {
      const { s } = await dataset()
      expect((await bagues(s, '&bague=SANS_BAGUE')).lignes).toHaveLength(TAILLE)
    }, 900_000)

    it('RG-COO-298 ANO-050 la liste des bagues « Imprimées » (1 100 bagues) répond 200 avec toutes les lignes', async () => {
      const { s, r1, trains } = await dataset()
      for (let d = 0; d < trains.length; d += 100) {
        await db.bague.createMany({
          data: trains.slice(d, d + 100).map((trainId) => ({
            trainId,
            atelierId: s.atelier.id,
            rouleurId: r1.id,
            textes: '[]',
            imprimeeLe: new Date(),
            imprimeeParId: s.users.cheq.id,
          })),
        })
      }
      expect((await bagues(s, '&bague=IMPRIMEES')).lignes).toHaveLength(TAILLE)
    }, 900_000)

    it('RG-COO-302 l’aperçu de 200 trains (maximum de la route) d’un atelier de plus de 1 000 dossiers répond 200', async () => {
      const { s, trains } = await dataset()
      const ap = await apercu(trains.slice(0, 200), s.users.cheq.headers)
      expect(ap.statusCode, ap.body).toBe(200)
      expect(ApercusBaguesSchema.parse(ap.json()).total).toBe(200)
    }, 900_000)

    it('RG-COO-296 ANO-050 la liste de picking d’un rouleur de plus de 1 000 visuels répond 200 avec une ligne par affiche rattachée', async () => {
      const { s, r1 } = await dataset()
      const pk = await picking(r1.id, s.users.cheq.headers)
      expect(pk.statusCode, pk.body).toBe(200)
      expect(PickingSchema.parse(pk.json()).lignes).toHaveLength(TAILLE)
    }, 900_000)

    it('RG-COO-237 ANO-050 le suivi 8 m² de plus de 1 000 thèmes répond 200 avec un thème par train', async () => {
      const { s } = await dataset()
      // Le paramètre est restauré après chaque test (afterEach) : il est reposé pour ce test.
      await parametre(ctx, 'suivi8m2.ateliers', String(s.atelier.id))
      const sv = await suivi(s)
      expect(sv.lignes).toHaveLength(TAILLE)
      expect(sv.lignes.every((l) => l.besoin === 1 && l.recu >= 1)).toBe(true)
    }, 900_000)
  })
})
