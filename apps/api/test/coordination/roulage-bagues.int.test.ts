// COO-P11 — tests d'INTÉGRATION des bagues et étiquettes (RG-COO-298 à 303, ECR-COO-11).
// Source de l'attendu : docs/COORDINATION_REGLES_METIER.md ; hypothèses Q-195 (cette session), Q-002 / Q-287 (aperçu
// navigateur, aucune impression physique pilotée), Q-250 (l'unité de production du déroulant est le train), Q-277
// (réimpression : chef d'équipe seul), Q-278 (tableau de roulage hors périmètre), Q-286 (profils).
// RG-X : « Prêt à produire » dépend de la couverture des visuels par la Réception (RG-COO-208), relue dans la même
// transaction que l'impression : un visuel qui n'est plus reçu rend l'unité non imprimable (aucune écriture).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ApercusBaguesSchema,
  BaguesSchema,
  FicheTrainSchema,
  ImpressionBaguesSchema,
  ListeTrainsSchema,
  ResultatBagueSchema,
  type Bagues,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'
import {
  avecEchec,
  DEPART_TXT,
  envoyer,
  recu,
  restaurerParametres,
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

const numero = () => 850_000 + Math.floor(Math.random() * 100_000)

/** Train « Prêt » : faces « A imprimer », tous les visuels reçus (RG-COO-208). */
async function pret(s: SiteD, themes: string[], extra: Parameters<typeof trainExportable>[3] = {}) {
  const t = await trainExportable(ctx, s, themes, { statut: 'A_IMPRIMER', ...extra })
  for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
  return t
}
const rouleur = (s: SiteD, nom: string, atelierId = s.atelier.id) =>
  f.createRouleur(db, { atelierId, nom })
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })

const bagues = async (s: SiteD, qs = '', headers = s.users.cheq.headers): Promise<Bagues> => {
  const r = await get(ctx, `/api/coordination/bagues?atelier=${String(s.atelier.id)}${qs}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return BaguesSchema.parse(r.json())
}
const ligneDe = (b: Bagues, trainId: string) => b.lignes.find((l) => l.trainId === trainId)
const imprimer = async (
  s: SiteD,
  ids: string[],
  rouleurId: number,
  headers = s.users.cheq.headers,
  cle = idem(),
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
  const b = await db.bague.findUniqueOrThrow({ where: { trainId } })
  return b
}
const modifier = (
  s: SiteD,
  trainId: string,
  version: number,
  textes: unknown,
  headers = s.users.cheq.headers,
  cle = idem(),
) => envoyer(ctx, '/api/coordination/bagues/modifier', headers, { trainId, version, textes }, cle)
const reimprimer = (
  s: SiteD,
  trainId: string,
  version: number,
  motif: unknown,
  headers = s.users.cheq.headers,
  cle = idem(),
  precision?: string,
) =>
  envoyer(
    ctx,
    '/api/coordination/bagues/reimprimer',
    headers,
    { trainId, version, motif, ...(precision ? { precision } : {}) },
    cle,
  )

// ───────────────────────── RG-COO-298 liste des bagues ─────────────────────────

describe('RG-COO-298 bagues et étiquettes : périmètre de la liste et filtre « Bague »', () => {
  it('RG-COO-298 par défaut « À imprimer » : unités prêtes sans bague, textes par position, atelier, destinataire, poste « Sans machine » ; ni « En attente » ni déjà imprimées', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur L1')
    const prete = await pret(s, ['Rose', 'Gris'], { annonceur: 'ALPHA' })
    const imprimee = await pret(s, ['Bleu'])
    await imprime(s, imprimee.trainId, r1.id)
    const attente = await trainExportable(ctx, s, ['Vert'], { statut: 'A_IMPRIMER' })
    const b = await bagues(s)
    const l = ligneDe(b, prete.trainId)
    expect(l).toMatchObject({
      type: 'TRAIN',
      statut: 'PRET',
      poste: null,
      bague: null,
      imprimable: true,
      destinataire: s.destinataire.nom,
      atelier: { id: s.atelier.id, plateforme: s.plateforme.nom },
    })
    expect(l?.textes).toEqual([
      { lettre: 'A', annonceur: 'ALPHA', theme: 'Rose', modifie: false },
      { lettre: 'B', annonceur: 'ALPHA', theme: 'Gris', modifie: false },
    ])
    expect(ligneDe(b, imprimee.trainId)).toBeUndefined()
    expect(ligneDe(b, attente.trainId)).toBeUndefined()
    expect(b.ateliers.map((a) => a.id)).toContain(s.atelier.id)
  })

  it('RG-COO-298 un train « Prêt » dont les faces ne sont pas encore « A imprimer » (pas exporté) est listé mais non imprimable', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'INSTRUCTION_OK' })
    await recu(ctx, s, t.faces[0]?.contNum ?? 0, 'Rose', 1)
    const l = ligneDe(await bagues(s), t.trainId)
    expect(l).toMatchObject({ statut: 'PRET', imprimable: false })
  })

  it('RG-COO-298 filtre « Bague » : Imprimées (avec numéro, rouleur, auteur, compteur) ; Sans bague, déjà en production ; défaut À imprimer', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur F1')
    const prete = await pret(s, ['Rose'])
    const imprimee = await pret(s, ['Gris'])
    const prodSans = await trainExportable(ctx, s, ['Bleu'], {
      statut: 'AU_ROULAGE',
      extra: { rouleurId: r1.id },
    })
    const bg = await imprime(s, imprimee.trainId, r1.id)
    const a = await bagues(s, '&bague=A_IMPRIMER')
    expect(a.lignes.map((l) => l.trainId)).toContain(prete.trainId)
    expect(a.lignes.map((l) => l.trainId)).not.toContain(imprimee.trainId)
    const i = await bagues(s, '&bague=IMPRIMEES')
    expect(i.lignes.map((l) => l.trainId)).toEqual([imprimee.trainId])
    expect(ligneDe(i, imprimee.trainId)).toMatchObject({
      statut: 'EN_PROD',
      imprimable: false,
      bague: {
        numero: bg.id,
        rouleur: 'Rouleur F1',
        reimpressions: 0,
        modifiee: false,
        version: 1,
      },
    })
    const sans = await bagues(s, '&bague=SANS_BAGUE')
    expect(sans.lignes.map((l) => l.trainId)).toEqual([prodSans.trainId])
    expect(sans.lignes[0]?.imprimable).toBe(false)
  })

  it('RG-COO-298 filtres dossier, destinataire, atelier, départ (API) ; sans départ, seuls les trains partant depuis 14 jours (Q-195)', async () => {
    const s = await siteDeroulant(ctx)
    const c = numero()
    const a = await pret(s, ['Rose'], { extra: { contNum: c } })
    const d2 = await db.destinataire.create({ data: { nomOrigine: `Dest B ${String(numero())}` } })
    const b = await pret(s, ['Gris'], { extra: { destinataireId: d2.id } })
    const vieux = await pret(s, ['Bleu'], {
      semaine: { annee: 2020, semaine: 2 },
      extra: { dateDepart: new Date('2020-01-07T16:00:00Z') },
    })
    expect((await bagues(s, `&dossier=${String(c)}`)).lignes.map((l) => l.trainId)).toEqual([
      a.trainId,
    ])
    expect(
      (await bagues(s, `&destinataire=${encodeURIComponent(d2.nomOrigine)}`)).lignes.map(
        (l) => l.trainId,
      ),
    ).toEqual([b.trainId])
    const defaut = await bagues(s)
    expect(ligneDe(defaut, vieux.trainId)).toBeUndefined()
    expect(ligneDe(defaut, a.trainId)).toBeDefined()
    expect(ligneDe(await bagues(s, '&depart=2020-W02'), vieux.trainId)).toBeDefined()
    expect(ligneDe(await bagues(s, `&depart=${DEPART_TXT}`), vieux.trainId)).toBeUndefined()
    const ailleurs = await get(
      ctx,
      `/api/coordination/bagues?atelier=${String(s.atelier2.id)}`,
      s.users.cheq.headers,
    )
    expect(BaguesSchema.parse(ailleurs.json()).lignes).toEqual([])
  })

  it('RG-COO-298 rejet : filtre Bague inconnu 400, semaine ISO inexistante 400, dossier non numérique 400', async () => {
    const s = await siteDeroulant(ctx)
    for (const qs of ['bague=TOUTES', 'depart=2026-W54', 'dossier=abc', 'atelier=0'])
      expect(
        (await get(ctx, `/api/coordination/bagues?${qs}`, s.users.cheq.headers)).statusCode,
        qs,
      ).toBe(400)
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-298 permissions : lecture des bagues pour le rôle %s (chef d’équipe seul, Q-286)',
    async (role) => {
      const s = await siteDeroulant(ctx)
      const r = await get(ctx, '/api/coordination/bagues', s.users[role].headers)
      expect(r.statusCode, r.body).toBe(role === 'cheq' ? 200 : 403)
      if (role !== 'cheq')
        expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-298')
    },
  )

  it('RG-COO-167 périmètre : un autre site ne voit aucune bague ni aucune unité de ce site ; 401 sans identité', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const b = BaguesSchema.parse(
      (await get(ctx, '/api/coordination/bagues', autre.users.cheq.headers)).json(),
    )
    expect(ligneDe(b, t.trainId)).toBeUndefined()
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/bagues' })).statusCode,
    ).toBe(401)
  })
})

// ───────────────────────── RG-COO-302 contenu de l'étiquette (aperçu) ─────────────────────────

describe('RG-COO-302 contenu de l’étiquette bague (aperçu navigateur)', () => {
  const apercu = (s: SiteD, ids: string[], headers = s.users.cheq.headers) =>
    get(ctx, `/api/coordination/bagues/apercu?trains=${ids.join(',')}`, headers)

  it('RG-COO-302 aperçu avant impression : n° nul, code-barres provisoire, Nb aff, destinataire, afficheur · atelier, départ, lignes « dossier · annonceur — lettre » et thème ; positions fractionnées exclues', async () => {
    const s = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose', 'Gris', 'Bleu'], { annonceur: 'ALPHA' })
    await db.faceTrain.update({ where: { id: t.faces[2]?.id ?? 0 }, data: { fractionnee: true } })
    const r = await apercu(s, [t.trainId])
    expect(r.statusCode, r.body).toBe(200)
    const a = ApercusBaguesSchema.parse(r.json()).bagues[0]
    expect(a).toMatchObject({
      numero: null,
      codeBarre: `BG-${t.trainId}`,
      trainId: t.trainId,
      nbAff: 2,
      destinataire: s.destinataire.nom,
      afficheur: 'AFFICHEUR SUD',
      atelier: s.atelier.libelle,
      rouleur: null,
    })
    expect(a?.lignes).toEqual([
      {
        dossier: t.faces[0]?.contNum,
        annonceur: 'ALPHA',
        lettre: 'A',
        theme: 'Rose',
        modifie: false,
      },
      {
        dossier: t.faces[1]?.contNum,
        annonceur: 'ALPHA',
        lettre: 'B',
        theme: 'Gris',
        modifie: false,
      },
    ])
  })

  it('RG-COO-302 aperçu après impression : numéro de bague, code-barres du numéro, rouleur posé', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur Ap')
    const t = await pret(s, ['Rose'])
    const b = await imprime(s, t.trainId, r1.id)
    const a = ApercusBaguesSchema.parse((await apercu(s, [t.trainId])).json()).bagues[0]
    expect(a).toMatchObject({
      numero: b.id,
      codeBarre: `BG${String(b.id).padStart(8, '0')}`,
      rouleur: 'Rouleur Ap',
    })
  })

  it('RG-COO-302 rejets : train inconnu 404 ; liste vide ou de plus de 200 trains 400 ; autre site 403 ; permissions des 6 rôles ; 401', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    expect((await apercu(s, ['999999999999999999'])).statusCode).toBe(404)
    expect(
      (await get(ctx, '/api/coordination/bagues/apercu?trains=', s.users.cheq.headers)).statusCode,
    ).toBe(400)
    expect(
      (
        await apercu(
          s,
          Array.from({ length: 201 }, (_, i) => `T${String(i)}`),
        )
      ).statusCode,
    ).toBe(400)
    expect((await apercu(s, [t.trainId], autre.users.cheq.headers)).statusCode).toBe(403)
    for (const role of ROLES_SANS_ADMIN)
      expect((await apercu(s, [t.trainId], s.users[role].headers)).statusCode).toBe(
        role === 'cheq' ? 200 : 403,
      )
    expect(
      (
        await ctx.app.inject({
          method: 'GET',
          url: `/api/coordination/bagues/apercu?trains=${t.trainId}`,
        })
      ).statusCode,
    ).toBe(401)
  })
})

// ───────────────────────── RG-COO-299 impression, rouleur obligatoire, passage « En production » ─────────────────────────

describe('RG-COO-299 impression des bagues : rouleur obligatoire, bague posée, unités PRET → EN_PROD', () => {
  it('RG-COO-299 nominal : bague posée (numéro), rouleur affecté, faces « A imprimer » → « Au roulage » (historique de statut, point de non-retour), journal ; l’unité devient « En production »', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur N1')
    const a = await pret(s, ['Rose', 'Gris'])
    const b = await pret(s, ['Bleu'])
    const r = await imprimer(s, [a.trainId, b.trainId], r1.id)
    expect(r.statusCode, r.body).toBe(200)
    const res = ImpressionBaguesSchema.parse(r.json())
    expect(res).toMatchObject({ imprimees: 2, ignorees: [], simulee: true })
    expect(res.message).toBe(
      "2 bague(s) imprimée(s) (rouleur Rouleur N1). Le statut passe automatiquement à « En production » à l'impression.",
    )
    expect(res.bagues.map((x) => x.trainId).sort()).toEqual([a.trainId, b.trainId].sort())
    for (const face of [...a.faces, ...b.faces]) {
      const apres = await faceDe(face.id)
      expect(apres).toMatchObject({ statut: 'AU_ROULAGE', rouleurId: r1.id })
      expect(
        await db.statutHistorique.count({
          where: {
            typeEntite: 'FACE_TRAIN',
            entiteId: String(face.id),
            ancien: 'A_IMPRIMER',
            nouveau: 'AU_ROULAGE',
            regle: 'RG-COO-299',
            parId: s.users.cheq.id,
          },
        }),
      ).toBe(1)
    }
    const bague = await db.bague.findUniqueOrThrow({ where: { trainId: a.trainId } })
    expect(bague).toMatchObject({
      rouleurId: r1.id,
      atelierId: s.atelier.id,
      reimpressions: 0,
      modifiee: false,
      imprimeeParId: s.users.cheq.id,
      version: 1,
    })
    expect(JSON.parse(bague.textes)).toEqual([
      { lettre: 'A', annonceur: 'ANNONCEUR', theme: 'Rose', modifie: false },
      { lettre: 'B', annonceur: 'ANNONCEUR', theme: 'Gris', modifie: false },
    ])
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'TRAIN',
          entiteId: a.trainId,
          action: 'IMPRESSION_BAGUE',
          parId: s.users.cheq.id,
        },
      }),
    ).toBe(1)
    // L'unité est « En production » : plus imprimable, visible du dispatch avec son rouleur.
    const d = await get(
      ctx,
      `/api/coordination/dispatch?atelier=${String(s.atelier.id)}&statut=EN_PROD`,
      s.users.cheq.headers,
    )
    expect(JSON.stringify(d.json())).toContain(a.trainId)
  })

  it('RG-COO-299 la sélection mêle imprimables et non imprimables : seules les unités prêtes sont imprimées, les autres sont listées avec leur raison', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur M1')
    const bonne = await pret(s, ['Rose'])
    const deja = await pret(s, ['Gris'])
    await imprime(s, deja.trainId, r1.id)
    const attente = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER' })
    const nonExporte = await trainExportable(ctx, s, ['Vert'], { statut: 'INSTRUCTION_OK' })
    await recu(ctx, s, nonExporte.faces[0]?.contNum ?? 0, 'Vert', 1)
    const prod = await trainExportable(ctx, s, ['Noir'], {
      statut: 'AU_ROULAGE',
      extra: { rouleurId: r1.id },
    })
    const r = await imprimer(
      s,
      [bonne.trainId, deja.trainId, attente.trainId, nonExporte.trainId, prod.trainId],
      r1.id,
    )
    expect(r.statusCode, r.body).toBe(200)
    const res = ImpressionBaguesSchema.parse(r.json())
    expect(res.imprimees).toBe(1)
    const raisons = new Map(res.ignorees.map((x) => [x.trainId, x.raison]))
    expect(raisons.get(deja.trainId)).toMatch(/^déjà imprimée \(bague n° \d+\)$/)
    expect(raisons.get(attente.trainId)).toBe("visuels pas tous reçus (« En attente d'affiches »)")
    expect(raisons.get(nonExporte.trainId)).toBe(
      'pas encore exporté (faces « Instruction ok », RG-COO-218)',
    )
    expect(raisons.get(prod.trainId)).toBe('déjà en production')
    expect((await faceDe(attente.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(nonExporte.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect(
      await db.bague.count({
        where: { trainId: { in: [attente.trainId, nonExporte.trainId, prod.trainId] } },
      }),
    ).toBe(0)
  })

  it('RG-COO-299 refus « Aucune unité « Prêt à produire » dans la sélection. » (422 COO_AUCUNE_UNITE_PRETE) : aucune bague, aucune face modifiée', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur R1')
    const attente = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER' })
    const r = await imprimer(s, [attente.trainId], r1.id)
    expect(r.statusCode, r.body).toBe(422)
    expect(erreur(r)).toMatchObject({
      code: 'COO_AUCUNE_UNITE_PRETE',
      regle: 'RG-COO-299',
      message: 'Aucune unité « Prêt à produire » dans la sélection.',
    })
    expect(await db.bague.count({ where: { trainId: attente.trainId } })).toBe(0)
    expect((await faceDe(attente.faces[0]?.id ?? 0)).rouleurId).toBeNull()
  })

  it('RG-X / RG-COO-208 un visuel qui n’est plus reçu (lien retiré) rend l’unité non imprimable : 422, aucune bague, la réception n’est pas modifiée', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur X1')
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const liens = await db.afficheAttendue.count({
      where: { ligneAttendue: { contNum: t.faces[0]?.contNum ?? 0 } },
    })
    await db.afficheAttendue.updateMany({
      where: { ligneAttendue: { contNum: t.faces[0]?.contNum ?? 0 } },
      data: { actif: false },
    })
    const r = await envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, {
      trains,
      rouleurId: r1.id,
    })
    expect(r.statusCode, r.body).toBe(422)
    expect(erreur(r).code).toBe('COO_AUCUNE_UNITE_PRETE')
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(0)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect(
      await db.afficheAttendue.count({
        where: { ligneAttendue: { contNum: t.faces[0]?.contNum ?? 0 } },
      }),
    ).toBe(liens)
  })

  it('RG-COO-299 rouleur obligatoire (400 sans rouleur ou rouleur nul) ; rouleur inconnu ou désactivé 404 ; rouleur d’un autre atelier 422', async () => {
    const s = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const post = (corps: unknown) =>
      envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, corps)
    expect((await post({ trains })).statusCode).toBe(400)
    expect((await post({ trains, rouleurId: 0 })).statusCode).toBe(400)
    expect((await post({ trains, rouleurId: null })).statusCode).toBe(400)
    expect((await post({ trains: [], rouleurId: 1 })).statusCode).toBe(400)
    expect((await post({ trains, rouleurId: 99_999_999 })).statusCode).toBe(404)
    const inactif = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur Off',
      dateFin: new Date(Date.now() - 86_400_000),
    })
    expect((await post({ trains, rouleurId: inactif.id })).statusCode).toBe(404)
    const autreAtelier = await rouleur(s, 'Rouleur Aut', s.atelier2.id)
    const r = await post({ trains, rouleurId: autreAtelier.id })
    expect(r.statusCode, r.body).toBe(422)
    expect(erreur(r).code).toBe('COO_ROULEUR_AUTRE_ATELIER')
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(0)
  })

  it('RG-COO-299 / RG-COO-308 rejets : version de train périmée 409 ; train inconnu 404', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur V1')
    const t = await pret(s, ['Rose'])
    const perimee = await envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, {
      trains: [{ trainId: t.trainId, version: '9.9.9' }],
      rouleurId: r1.id,
    })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
    const inconnu = await envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, {
      trains: [{ trainId: '999999999999999999', version: '1.1.1' }],
      rouleurId: r1.id,
    })
    expect(inconnu.statusCode).toBe(404)
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(0)
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-299 permissions : imprimer pour le rôle %s (chef d’équipe seul, Q-286)',
    async (role) => {
      const s = await siteDeroulant(ctx)
      const r1 = await rouleur(s, 'Rouleur P1')
      const t = await pret(s, ['Rose'])
      const r = await imprimer(s, [t.trainId], r1.id, s.users[role].headers)
      expect(r.statusCode, r.body).toBe(role === 'cheq' ? 200 : 403)
      expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(role === 'cheq' ? 1 : 0)
    },
  )

  it('RG-COO-167 périmètre : le chef d’équipe d’un autre site ne peut pas imprimer les bagues de ce site (403) ; rien n’est écrit', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur PX')
    const t = await pret(s, ['Rose'])
    const r = await imprimer(s, [t.trainId], r1.id, autre.users.cheq.headers)
    expect(r.statusCode, r.body).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(0)
  })

  it('RG-COO-299 concurrence : deux impressions simultanées du même train : une seule bague (200 / 409 ou 422), faces passées une seule fois', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur C1')
    const t = await pret(s, ['Rose'])
    const corps = {
      trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
      rouleurId: r1.id,
    }
    const [a, b] = await Promise.all([
      envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, corps),
      envoyer(ctx, '/api/coordination/bagues/imprimer', s.users.cheq.headers, corps),
    ])
    expect([a.statusCode, b.statusCode].filter((c) => c === 200)).toHaveLength(1)
    expect([a.statusCode, b.statusCode].some((c) => c === 409 || c === 422)).toBe(true)
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
  })

  it('RG-COO-299 idempotence : même clé et même corps rejoués = même réponse, une seule bague ; même clé avec un autre corps : 409', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur I1')
    const r2 = await rouleur(s, 'Rouleur I2')
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const poster = (rouleurId: number, cle: Record<string, string>) =>
      envoyer(
        ctx,
        '/api/coordination/bagues/imprimer',
        s.users.cheq.headers,
        { trains, rouleurId },
        cle,
      )
    const cle = idem()
    const un = await poster(r1.id, cle)
    const deux = await poster(r1.id, cle)
    expect(un.statusCode, un.body).toBe(200)
    expect(deux.json()).toEqual(un.json())
    expect(await db.bague.count({ where: { trainId: t.trainId } })).toBe(1)
    const autre = await poster(r2.id, cle)
    expect(autre.statusCode).toBe(409)
    expect(erreur(autre).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(
      (
        await envoyer(
          ctx,
          '/api/coordination/bagues/imprimer',
          s.users.cheq.headers,
          { trains, rouleurId: r1.id },
          {},
        )
      ).statusCode,
    ).toBe(400)
  })

  it('RG-COO-299 atomicité : un échec de l’historique du 2e train annule tout (aucune bague, faces inchangées, clé non gardée)', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur AT-B')
    const a = await pret(s, ['Rose'])
    const b = await pret(s, ['Gris'])
    const ko = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${b.trainId}'`,
      () => imprimer(s, [a.trainId, b.trainId], r1.id),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.bague.count({ where: { trainId: { in: [a.trainId, b.trainId] } } })).toBe(0)
    for (const face of [...a.faces, ...b.faces])
      expect((await faceDe(face.id)).statut).toBe('A_IMPRIMER')
    expect((await imprimer(s, [a.trainId, b.trainId], r1.id)).statusCode).toBe(200)
  })

  it('RG-COO-217 / 223 après l’impression le train est au point de non-retour : « Au roulage » (export préparation) 409, réaffectation par la liste (P10) 409', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur NR')
    const r2 = await rouleur(s, 'Rouleur NR2')
    const t = await pret(s, ['Rose'])
    await imprime(s, t.trainId, r1.id)
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/au-roulage', s.users.cheq.headers, {
          trains: v,
          rouleurId: r1.id,
        })
      ).statusCode,
    ).toBe(409)
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/rouleur', s.users.cheq.headers, {
          trains: v,
          rouleurId: r2.id,
        })
      ).statusCode,
    ).toBe(409)
  })
})

// ───────────────────────── RG-COO-300 textes imprimés et réimpression automatique ─────────────────────────

describe('RG-COO-300 textes imprimés sur la bague : modification et réimpression automatique', () => {
  it('RG-COO-300 nominal : textes par position modifiés, tag « modifié », compteur +1, version +1, journal ; le statut de l’unité est inchangé ; la liste et l’aperçu portent le tag', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur T1')
    const t = await pret(s, ['Rose', 'Gris'], { annonceur: 'ALPHA' })
    const bg = await imprime(s, t.trainId, r1.id)
    const r = await modifier(s, t.trainId, bg.version, [
      { lettre: 'A', annonceur: 'ALPHA SA', theme: 'Rose' },
      { lettre: 'B', annonceur: 'ALPHA', theme: 'Gris' },
    ])
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatBagueSchema.parse(r.json())
    expect(res).toMatchObject({ reimpressions: 1, version: 2 })
    expect(res.message).toBe(`Textes de la bague n° ${String(bg.id)} enregistrés et réimprimés.`)
    expect(res.bague.lignes).toEqual([
      {
        dossier: t.faces[0]?.contNum,
        annonceur: 'ALPHA SA',
        lettre: 'A',
        theme: 'Rose',
        modifie: true,
      },
      {
        dossier: t.faces[1]?.contNum,
        annonceur: 'ALPHA',
        lettre: 'B',
        theme: 'Gris',
        modifie: false,
      },
    ])
    const apres = await db.bague.findUniqueOrThrow({ where: { id: bg.id } })
    expect(apres).toMatchObject({ modifiee: true, reimpressions: 1, version: 2 })
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('AU_ROULAGE')
    const j = await db.journalAudit.findFirstOrThrow({
      where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'MODIFICATION_BAGUE' },
    })
    expect(j).toMatchObject({ parId: s.users.cheq.id })
    expect(j.nouvelleValeur).toContain('ALPHA SA')
    const liste = await bagues(s, '&bague=IMPRIMEES')
    expect(ligneDe(liste, t.trainId)?.bague).toMatchObject({ modifiee: true, reimpressions: 1 })
    expect(ligneDe(liste, t.trainId)?.textes[0]).toMatchObject({
      annonceur: 'ALPHA SA',
      modifie: true,
    })
  })

  it('RG-COO-300 remettre le texte du visuel retire le tag « modifié » de la position (la bague reste réimprimée)', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur T2')
    const t = await pret(s, ['Rose'], { annonceur: 'ALPHA' })
    const bg = await imprime(s, t.trainId, r1.id)
    expect(
      (await modifier(s, t.trainId, 1, [{ lettre: 'A', annonceur: 'AUTRE', theme: 'Rose' }]))
        .statusCode,
    ).toBe(200)
    const r = await modifier(s, t.trainId, 2, [{ lettre: 'A', annonceur: 'ALPHA', theme: 'Rose' }])
    expect(r.statusCode, r.body).toBe(200)
    expect(await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).toMatchObject({
      modifiee: false,
      reimpressions: 2,
      version: 3,
    })
  })

  it('RG-COO-300 rejets : annonceur ou thème vide 422 « Le thème et l’annonceur ne peuvent pas être vides. » ; rien de changé 422 « Rien n’a changé. » ; positions incomplètes ou en trop 422', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur T3')
    const t = await pret(s, ['Rose', 'Gris'], { annonceur: 'ALPHA' })
    const bg = await imprime(s, t.trainId, r1.id)
    const vide = await modifier(s, t.trainId, bg.version, [
      { lettre: 'A', annonceur: '', theme: 'Rose' },
      { lettre: 'B', annonceur: 'ALPHA', theme: 'Gris' },
    ])
    expect(vide.statusCode, vide.body).toBe(422)
    expect(erreur(vide)).toMatchObject({
      code: 'COO_TEXTE_VIDE',
      regle: 'RG-COO-300',
      message: "Le thème et l'annonceur ne peuvent pas être vides.",
    })
    const rien = await modifier(s, t.trainId, bg.version, [
      { lettre: 'A', annonceur: 'ALPHA', theme: 'Rose' },
      { lettre: 'B', annonceur: 'ALPHA', theme: 'Gris' },
    ])
    expect(rien.statusCode, rien.body).toBe(422)
    expect(erreur(rien)).toMatchObject({ code: 'COO_RIEN_CHANGE', message: "Rien n'a changé." })
    const manque = await modifier(s, t.trainId, bg.version, [
      { lettre: 'A', annonceur: 'X', theme: 'Rose' },
    ])
    expect(manque.statusCode).toBe(422)
    expect(erreur(manque).code).toBe('COO_BAGUE_POSITIONS')
    const trop = await modifier(s, t.trainId, bg.version, [
      { lettre: 'A', annonceur: 'X', theme: 'Rose' },
      { lettre: 'B', annonceur: 'X', theme: 'Gris' },
      { lettre: 'C', annonceur: 'X', theme: 'Bleu' },
    ])
    expect(trop.statusCode).toBe(422)
    const doublon = await modifier(s, t.trainId, bg.version, [
      { lettre: 'A', annonceur: 'X', theme: 'Rose' },
      { lettre: 'A', annonceur: 'Y', theme: 'Rose' },
    ])
    expect(doublon.statusCode).toBe(422)
    expect(await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).toMatchObject({
      reimpressions: 0,
      version: 1,
    })
  })

  it('RG-COO-300 rejets : corps invalide 400 (liste vide, texte trop long) ; bague pas encore imprimée 409 ; version de bague périmée 409', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur T4')
    const t = await pret(s, ['Rose'])
    const sans = await modifier(s, t.trainId, 1, [{ lettre: 'A', annonceur: 'X', theme: 'Rose' }])
    expect(sans.statusCode, sans.body).toBe(409)
    expect(erreur(sans)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-301' })
    const bg = await imprime(s, t.trainId, r1.id)
    expect((await modifier(s, t.trainId, bg.version, [])).statusCode).toBe(400)
    expect(
      (
        await modifier(s, t.trainId, bg.version, [
          { lettre: 'A', annonceur: 'x'.repeat(101), theme: 'Rose' },
        ])
      ).statusCode,
    ).toBe(400)
    const perimee = await modifier(s, t.trainId, 7, [
      { lettre: 'A', annonceur: 'X', theme: 'Rose' },
    ])
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-300 permissions : modifier les textes pour le rôle %s (chef d’équipe seul)',
    async (role) => {
      const s = await siteDeroulant(ctx)
      const r1 = await rouleur(s, 'Rouleur TP')
      const t = await pret(s, ['Rose'])
      const bg = await imprime(s, t.trainId, r1.id)
      const r = await modifier(
        s,
        t.trainId,
        bg.version,
        [{ lettre: 'A', annonceur: 'NOUVEAU', theme: 'Rose' }],
        s.users[role].headers,
      )
      expect(r.statusCode, r.body).toBe(role === 'cheq' ? 200 : 403)
    },
  )

  it('RG-COO-167 / 308 périmètre (403), concurrence (200 / 409), idempotence et atomicité de la modification des textes', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur TC')
    const t = await pret(s, ['Rose'], { annonceur: 'ALPHA' })
    const bg = await imprime(s, t.trainId, r1.id)
    const texte = (annonceur: string) => [{ lettre: 'A', annonceur, theme: 'Rose' }]
    const hors = await modifier(s, t.trainId, bg.version, texte('X'), autre.users.cheq.headers)
    expect(hors.statusCode, hors.body).toBe(403)
    expect(erreur(hors).regle).toBe('RG-COO-167')
    // Atomicité : un échec du journal annule la modification.
    const ko = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.action = 'MODIFICATION_BAGUE'",
      () => modifier(s, t.trainId, bg.version, texte('ECHEC')),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).toMatchObject({
      reimpressions: 0,
      version: 1,
      modifiee: false,
    })
    // Concurrence : deux modifications sur la même version.
    const [x, y] = await Promise.all([
      modifier(s, t.trainId, 1, texte('UN')),
      modifier(s, t.trainId, 1, texte('DEUX')),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    // Idempotence : même clé et même corps = même réponse, un seul compteur.
    const cle = idem()
    const v = (await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).version
    const un = await modifier(s, t.trainId, v, texte('TROIS'), s.users.cheq.headers, cle)
    const deux = await modifier(s, t.trainId, v, texte('TROIS'), s.users.cheq.headers, cle)
    expect(un.statusCode, un.body).toBe(200)
    expect(deux.json()).toEqual(un.json())
    expect((await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).version).toBe(v + 1)
    expect(
      (await modifier(s, t.trainId, v + 1, texte('QUATRE'), s.users.cheq.headers, cle)).statusCode,
    ).toBe(409)
  })
})

// ───────────────────────── RG-COO-301 réimprimer une bague ─────────────────────────

describe('RG-COO-301 réimprimer une bague : motif obligatoire, même numéro, statut inchangé', () => {
  it.each(['Colis perdu, refait', 'Bague abîmée ou illisible', 'Autre'])(
    'RG-COO-301 nominal : motif « %s » : compteur +1, même numéro, mêmes textes, statut inchangé, journal avec le motif',
    async (motif) => {
      const s = await siteDeroulant(ctx)
      const r1 = await rouleur(s, 'Rouleur RR')
      const t = await pret(s, ['Rose'])
      const bg = await imprime(s, t.trainId, r1.id)
      const r = await reimprimer(s, t.trainId, bg.version, motif)
      expect(r.statusCode, r.body).toBe(200)
      const res = ResultatBagueSchema.parse(r.json())
      expect(res).toMatchObject({ reimpressions: 1, version: 2 })
      expect(res.message).toBe(
        `Bague n° ${String(bg.id)} réimprimée (motif : ${motif}) — 1 réimpression(s).`,
      )
      expect(res.bague.numero).toBe(bg.id)
      const apres = await db.bague.findUniqueOrThrow({ where: { id: bg.id } })
      expect(apres).toMatchObject({
        id: bg.id,
        reimpressions: 1,
        textes: bg.textes,
        modifiee: false,
        rouleurId: r1.id,
      })
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('AU_ROULAGE')
      const j = await db.journalAudit.findFirstOrThrow({
        where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'REIMPRESSION_BAGUE' },
      })
      expect(j).toMatchObject({ parId: s.users.cheq.id })
      expect(j.nouvelleValeur).toContain(motif)
    },
  )

  it('RG-COO-301 réimpressions successives : le compteur augmente (« réimprimée n fois ») ; la précision du motif est tracée', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur R2')
    const t = await pret(s, ['Rose'])
    const bg = await imprime(s, t.trainId, r1.id)
    expect((await reimprimer(s, t.trainId, 1, 'Colis perdu, refait')).statusCode).toBe(200)
    const r = await reimprimer(
      s,
      t.trainId,
      2,
      'Autre',
      s.users.cheq.headers,
      idem(),
      'Palette tombée',
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatBagueSchema.parse(r.json()).reimpressions).toBe(2)
    expect(await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).toMatchObject({
      reimpressions: 2,
      version: 3,
    })
    const j = await db.journalAudit.findMany({
      where: { entiteId: t.trainId, action: 'REIMPRESSION_BAGUE' },
      orderBy: { id: 'desc' },
    })
    expect(j[0]?.nouvelleValeur).toContain('Palette tombée')
    expect(ligneDe(await bagues(s, '&bague=IMPRIMEES'), t.trainId)?.bague?.reimpressions).toBe(2)
  })

  it('RG-COO-301 rejets : motif absent ou hors liste 400 ; précision trop longue 400 ; bague pas encore imprimée 409 ; version périmée 409 ; rien n’est écrit', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur R3')
    const t = await pret(s, ['Rose'])
    const sans = await reimprimer(s, t.trainId, 1, 'Colis perdu, refait')
    expect(sans.statusCode, sans.body).toBe(409)
    expect(erreur(sans)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-301' })
    const bg = await imprime(s, t.trainId, r1.id)
    expect((await reimprimer(s, t.trainId, bg.version, undefined)).statusCode).toBe(400)
    expect((await reimprimer(s, t.trainId, bg.version, 'Parce que')).statusCode).toBe(400)
    expect(
      (
        await reimprimer(
          s,
          t.trainId,
          bg.version,
          'Autre',
          s.users.cheq.headers,
          idem(),
          'x'.repeat(201),
        )
      ).statusCode,
    ).toBe(400)
    const perimee = await reimprimer(s, t.trainId, 9, 'Colis perdu, refait')
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    expect(await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).toMatchObject({
      reimpressions: 0,
      version: 1,
    })
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-301 permissions : réimprimer pour le rôle %s (chef d’équipe seul, Q-277 / Q-286)',
    async (role) => {
      const s = await siteDeroulant(ctx)
      const r1 = await rouleur(s, 'Rouleur RP')
      const t = await pret(s, ['Rose'])
      const bg = await imprime(s, t.trainId, r1.id)
      const r = await reimprimer(
        s,
        t.trainId,
        bg.version,
        'Colis perdu, refait',
        s.users[role].headers,
      )
      expect(r.statusCode, r.body).toBe(role === 'cheq' ? 200 : 403)
      if (role !== 'cheq') {
        expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-301')
        expect((await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).reimpressions).toBe(0)
      }
    },
  )

  it('RG-COO-167 / 308 périmètre (403), concurrence (200 / 409), idempotence et atomicité de la réimpression', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur RC')
    const t = await pret(s, ['Rose'])
    const bg = await imprime(s, t.trainId, r1.id)
    const hors = await reimprimer(s, t.trainId, 1, 'Colis perdu, refait', autre.users.cheq.headers)
    expect(hors.statusCode, hors.body).toBe(403)
    expect(erreur(hors).regle).toBe('RG-COO-167')
    const ko = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.action = 'REIMPRESSION_BAGUE'",
      () => reimprimer(s, t.trainId, 1, 'Colis perdu, refait'),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).toMatchObject({
      reimpressions: 0,
      version: 1,
    })
    const [x, y] = await Promise.all([
      reimprimer(s, t.trainId, 1, 'Colis perdu, refait'),
      reimprimer(s, t.trainId, 1, 'Bague abîmée ou illisible'),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    const cle = idem()
    const v = (await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).version
    const un = await reimprimer(s, t.trainId, v, 'Autre', s.users.cheq.headers, cle)
    const deux = await reimprimer(s, t.trainId, v, 'Autre', s.users.cheq.headers, cle)
    expect(un.statusCode, un.body).toBe(200)
    expect(deux.json()).toEqual(un.json())
    expect((await db.bague.findUniqueOrThrow({ where: { id: bg.id } })).reimpressions).toBe(2)
    expect(
      (await reimprimer(s, t.trainId, v + 1, 'Colis perdu, refait', s.users.cheq.headers, cle))
        .statusCode,
    ).toBe(409)
  })
})

// ───────────────────────── RG-COO-303 tableau de roulage (hors périmètre, Q-278) ─────────────────────────

describe('RG-COO-303 tableau de roulage alimenté par la bague : aucun effet tant que Q-278 n’est pas tranchée', () => {
  it('RG-COO-303 aucune route de tableau de roulage ni de fichier vierge n’est exposée (404) ; l’impression d’une bague ne crée aucune ligne de suivi des primes', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur TR')
    for (const url of [
      '/api/coordination/tableau-roulage',
      '/api/coordination/roulage/tableau',
      '/api/coordination/fichier-vierge',
    ])
      expect((await get(ctx, url, s.users.cheq.headers)).statusCode, url).toBe(404)
    const t = await pret(s, ['Rose'])
    const journal = await db.journalAudit.count({ where: { entiteId: t.trainId } })
    await imprime(s, t.trainId, r1.id)
    // Seules les traces de la bague elle-même (journal du train) sont écrites : aucune table de roulage.
    expect(await db.journalAudit.count({ where: { entiteId: t.trainId } })).toBe(journal + 1)
  })
})

// ───────────────────────── RG-COO-235 colonne « Bague » et fiche du train ─────────────────────────

describe('RG-COO-235 / 301 colonne masquée « Bague » de la liste des trains et fiche du train', () => {
  it('RG-COO-235 la liste des trains porte les numéros de bague et le nombre de réimpressions de chaque ligne ; une unité sans bague a une liste vide', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur Li')
    const sans = await pret(s, ['Rose'])
    const avec = await pret(s, ['Gris'])
    const bg = await imprime(s, avec.trainId, r1.id)
    expect((await reimprimer(s, avec.trainId, bg.version, 'Colis perdu, refait')).statusCode).toBe(
      200,
    )
    const r = await get(
      ctx,
      `/api/coordination/trains?depart=${DEPART_TXT}&atelier=${String(s.atelier.id)}`,
      s.users.coord.headers,
    )
    expect(r.statusCode, r.body).toBe(200)
    const lignes = ListeTrainsSchema.parse(r.json()).lignes
    expect(lignes.find((l) => l.trains.some((t) => t.trainId === avec.trainId))).toMatchObject({
      bagues: [bg.id],
      reimpressions: 1,
    })
    expect(lignes.find((l) => l.trains.some((t) => t.trainId === sans.trainId))).toMatchObject({
      bagues: [],
      reimpressions: 0,
    })
  })

  it('RG-COO-301 la fiche du train porte la bague (numéro, version, rouleur, compteur) pour « Réimprimer la bague… » ; null sans bague', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur Fi')
    const t = await pret(s, ['Rose'])
    const avant = FicheTrainSchema.parse(
      (await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)).json(),
    )
    expect(avant.bague).toBeNull()
    const bg = await imprime(s, t.trainId, r1.id)
    const apres = FicheTrainSchema.parse(
      (await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)).json(),
    )
    expect(apres.bague).toMatchObject({
      numero: bg.id,
      version: 1,
      rouleur: 'Rouleur Fi',
      reimpressions: 0,
      modifiee: false,
    })
    expect(apres.statut).toBe('EN_PROD')
    expect(apres.modifications.some((m) => m.action === 'IMPRESSION_BAGUE')).toBe(true)
  })
})
