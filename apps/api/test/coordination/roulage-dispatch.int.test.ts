// COO-P11 — tests d'INTÉGRATION du dispatch du roulage (RG-COO-291 à 296, ECR-COO-10).
// Source de l'attendu : docs/COORDINATION_REGLES_METIER.md ; hypothèses Q-195 (cette session), Q-276 (algorithme de
// répartition simulé, seuils 36 h / 115 % paramétrables), Q-286 (profils : chef d'équipe seul), Q-251 (PRET).
// RG-X : « Prêt » dépend de la couverture des visuels par la Réception (RG-COO-208) : un visuel qui n'est plus reçu
// sort le train du dispatch et l'affectation est refusée (409), dans la même transaction.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DispatchSchema, PickingSchema, type Dispatch } from '@circe/shared'
import * as f from '../factories/index.ts'
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

const numero = () => 830_000 + Math.floor(Math.random() * 100_000)
const HEURE = 3_600_000

/** Train « Prêt » : faces « A imprimer », tous les visuels reçus (RG-COO-208). */
async function pret(s: SiteD, themes: string[], extra: Parameters<typeof trainExportable>[3] = {}) {
  const t = await trainExportable(ctx, s, themes, { statut: 'A_IMPRIMER', ...extra })
  for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
  return t
}
/** Train « En production » : faces « Au roulage » avec leur rouleur (RG-COO-217). */
const enProd = async (s: SiteD, themes: string[], rouleurId: number) =>
  trainExportable(ctx, s, themes, { statut: 'AU_ROULAGE', extra: { rouleurId } })
const rouleur = (s: SiteD, nom: string, atelierId = s.atelier.id) =>
  f.createRouleur(db, { atelierId, nom })
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })

const dispatch = async (s: SiteD, qs = '', headers = s.users.cheq.headers): Promise<Dispatch> => {
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
  headers = s.users.cheq.headers,
  cle = idem(),
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
  headers = s.users.cheq.headers,
  cle = idem(),
) =>
  envoyer(
    ctx,
    `/api/coordination/dispatch/${action}`,
    headers,
    { atelierId: s.atelier.id, trains: await versions(ctx, s.users.coord.headers, ids) },
    cle,
  )

// ───────────────────────── RG-COO-291 / 292 : périmètre, filtres, charge ─────────────────────────

describe('RG-COO-291 dispatch : trains PRET / EN_PROD de l’atelier déroulant, filtres, indicateurs', () => {
  it('RG-COO-291 liste les trains PRET et EN_PROD (rouleur, positions, faces, départ) ; ni les trains en attente d’affiches ni ceux déjà produits', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur N1')
    const prete = await pret(s, ['Rose', 'Gris'])
    const prod = await enProd(s, ['Bleu'], r1.id)
    const attente = await trainExportable(ctx, s, ['Vert'], { statut: 'A_IMPRIMER' })
    const produit = await trainExportable(ctx, s, ['Noir'], { statut: 'PREPARE' })
    const d = await dispatch(s)
    expect(d.atelier).toMatchObject({ id: s.atelier.id, plateforme: s.plateforme.nom })
    expect(d.moteurSimule).toBe(true)
    const lp = ligneDe(d, prete.trainId)
    expect(lp).toMatchObject({
      statut: 'PRET',
      nb: 1,
      faces: 2,
      rouleur: null,
      destinataire: s.destinataire.nom,
    })
    expect(lp?.positions.map((p) => p.lettre)).toEqual(['A', 'B'])
    expect(ligneDe(d, prod.trainId)).toMatchObject({
      statut: 'EN_PROD',
      faces: 1,
      rouleur: { id: r1.id, nom: 'Rouleur N1' },
    })
    expect(ligneDe(d, attente.trainId)).toBeUndefined()
    expect(ligneDe(d, produit.trainId)).toBeUndefined()
    expect(d.indicateurs).toEqual({ trainsARouler: 2, faces: 3, nonAffectes: 1 })
  })

  it('RG-COO-292 faces = nb × positions non fractionnées ; les trains identiques sont regroupés en une ligne', async () => {
    const s = await siteDeroulant(ctx)
    const c = numero()
    const a = await pret(s, ['Rose'], { extra: { contNum: c } })
    const b = await pret(s, ['Rose'], { extra: { contNum: c } })
    const frac = await pret(s, ['Gris', 'Bleu'])
    await db.faceTrain.update({
      where: { id: frac.faces[1]?.id ?? 0 },
      data: { fractionnee: true },
    })
    const d = await dispatch(s)
    const ligne = ligneDe(d, a.trainId)
    expect(ligne?.trains.map((t) => t.trainId).sort()).toEqual([a.trainId, b.trainId].sort())
    expect(ligne).toMatchObject({ nb: 2, faces: 2 })
    expect(ligneDe(d, frac.trainId)).toMatchObject({ nb: 1, faces: 1 })
    expect(d.indicateurs).toMatchObject({ trainsARouler: 3, faces: 3 })
  })

  it('RG-COO-291 filtres : n° de dossier, départ, statut, destinataire (API) ; indicateurs recalculés sur les lignes filtrées', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur F1')
    const c = numero()
    const a = await pret(s, ['Rose'], { extra: { contNum: c } })
    const prod = await enProd(s, ['Gris'], r1.id)
    const autreSemaine = await pret(s, ['Bleu'], {
      semaine: { annee: 2031, semaine: 9 },
      extra: { dateDepart: new Date('2031-03-04T16:00:00Z') },
    })
    const d2 = await db.destinataire.create({ data: { nomOrigine: `Dest F ${String(numero())}` } })
    const autreDest = await pret(s, ['Vert'], { extra: { destinataireId: d2.id } })
    expect(
      (await dispatch(s, `&dossier=${String(c)}`)).lignes.map((l) => l.trains[0]?.trainId),
    ).toEqual([a.trainId])
    expect((await dispatch(s, '&statut=EN_PROD')).lignes.map((l) => l.trains[0]?.trainId)).toEqual([
      prod.trainId,
    ])
    const pretsSeuls = await dispatch(s, '&statut=PRET')
    expect(pretsSeuls.lignes.every((l) => l.statut === 'PRET')).toBe(true)
    expect(ligneDe(pretsSeuls, autreSemaine.trainId)).toBeDefined()
    const semaine = await dispatch(s, `&depart=${DEPART_TXT}`)
    expect(ligneDe(semaine, autreSemaine.trainId)).toBeUndefined()
    expect(ligneDe(semaine, a.trainId)).toBeDefined()
    const dest = await dispatch(s, `&destinataire=${encodeURIComponent(d2.nomOrigine)}`)
    expect(dest.lignes.map((l) => l.trains[0]?.trainId)).toEqual([autreDest.trainId])
    expect(dest.indicateurs.trainsARouler).toBe(1)
  })

  it('RG-COO-291 « Aucun atelier déroulant sur ce site. » : un site sans atelier déroulant renvoie un atelier nul et aucune ligne', async () => {
    const plateforme = await f.createPlateforme(db)
    await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
    const u = await f.createUtilisateurAvecRoles(db, ['cheq'], [{ plateformeId: plateforme.id }])
    const { devHeaders } = await import('../support/identite.ts')
    const r = await get(ctx, '/api/coordination/dispatch', devHeaders(u.identifiantExterne))
    expect(r.statusCode, r.body).toBe(200)
    const d = DispatchSchema.parse(r.json())
    expect(d).toMatchObject({ atelier: null, ateliers: [], lignes: [], rouleurs: [], charge: [] })
    expect(d.indicateurs).toEqual({ trainsARouler: 0, faces: 0, nonAffectes: 0 })
  })

  it('RG-COO-291 rejet : un atelier non déroulant 422 COO_ATELIER_NON_DEROULANT ; un atelier inconnu 404 ; filtre invalide 400', async () => {
    const s = await siteDeroulant(ctx)
    const fixe = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'FIXE' })
    const r = await get(
      ctx,
      `/api/coordination/dispatch?atelier=${String(fixe.id)}`,
      s.users.cheq.headers,
    )
    expect(r.statusCode, r.body).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_ATELIER_NON_DEROULANT', regle: 'RG-COO-291' })
    expect(
      (await get(ctx, '/api/coordination/dispatch?atelier=99999999', s.users.cheq.headers))
        .statusCode,
    ).toBe(404)
    expect(
      (await get(ctx, '/api/coordination/dispatch?statut=LIVRE', s.users.cheq.headers)).statusCode,
    ).toBe(400)
    expect(
      (await get(ctx, '/api/coordination/dispatch?depart=2026-W54', s.users.cheq.headers))
        .statusCode,
    ).toBe(400)
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-291 permissions : lecture du dispatch pour le rôle %s (chef d’équipe seul, Q-286)',
    async (role) => {
      const s = await siteDeroulant(ctx)
      const r = await get(
        ctx,
        `/api/coordination/dispatch?atelier=${String(s.atelier.id)}`,
        s.users[role].headers,
      )
      const autorise = role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      if (!autorise) expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-291')
    },
  )

  it('RG-COO-167 périmètre : le chef d’équipe d’un autre site ne voit pas l’atelier (403) et ne voit aucun train de ce site', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const r = await get(
      ctx,
      `/api/coordination/dispatch?atelier=${String(s.atelier.id)}`,
      autre.users.cheq.headers,
    )
    expect(r.statusCode, r.body).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
    const propre = DispatchSchema.parse(
      (await get(ctx, '/api/coordination/dispatch', autre.users.cheq.headers)).json(),
    )
    expect(propre.atelier?.id).toBe(autre.atelier.id)
    expect(ligneDe(propre, t.trainId)).toBeUndefined()
  })

  it('RG-COO-291 401 sans identité', async () => {
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/dispatch' })).statusCode,
    ).toBe(401)
  })
})

describe('RG-COO-292 / 295 charge par rouleur, départ proche et surcharge', () => {
  it('RG-COO-292 charge : trains, faces, destinataires et charge en % de la moyenne des rouleurs de l’atelier ; les rouleurs sans train sont listés à 0', async () => {
    const s = await siteDeroulant(ctx)
    const a = await rouleur(s, 'Rouleur A')
    const b = await rouleur(s, 'Rouleur B')
    const c = await rouleur(s, 'Rouleur C')
    await enProd(s, ['Rose', 'Gris'], a.id)
    await enProd(s, ['Bleu'], a.id)
    await enProd(s, ['Vert'], b.id)
    const d = await dispatch(s)
    const charge = new Map(d.charge.map((x) => [x.rouleurId, x]))
    // 4 faces au total / 3 rouleurs = 1,33 face de moyenne.
    expect(charge.get(a.id)).toMatchObject({ trains: 2, faces: 3, chargePct: 225, surcharge: true })
    expect(charge.get(b.id)).toMatchObject({ trains: 1, faces: 1, chargePct: 75, surcharge: false })
    expect(charge.get(c.id)).toMatchObject({ trains: 0, faces: 0, chargePct: 0, destinataires: [] })
    expect(charge.get(a.id)?.destinataires).toEqual([s.destinataire.nom])
    expect(d.rouleurs.map((x) => x.id).sort()).toEqual([a.id, b.id, c.id].sort())
  })

  it('RG-COO-295 surcharge : au-delà du seuil (115 % par défaut, paramétrable) le rouleur est signalé ; en deçà, aucune alerte', async () => {
    const s = await siteDeroulant(ctx)
    const a = await rouleur(s, 'Rouleur S1')
    const b = await rouleur(s, 'Rouleur S2')
    await enProd(s, ['Rose'], a.id)
    await enProd(s, ['Gris'], a.id)
    await enProd(s, ['Bleu'], a.id)
    await enProd(s, ['Vert'], b.id)
    const d = await dispatch(s)
    expect(d.alertes).toMatchObject({
      seuilSurchargePct: 115,
      surcharges: [{ rouleur: 'Rouleur S1', chargePct: 150 }],
    })
    await parametre(ctx, 'dispatch.seuilChargePct', '150')
    const limite = await dispatch(s)
    expect(limite.alertes.seuilSurchargePct).toBe(150)
    expect(limite.alertes.surcharges).toEqual([])
    expect(limite.charge.find((x) => x.rouleurId === a.id)?.surcharge).toBe(false)
  })

  it('RG-COO-295 départ proche : un train non affecté qui part dans moins du seuil (36 h par défaut, paramétrable) est « urgent » et compté ; affecté, il ne l’est plus', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur U1')
    const proche = await pret(s, ['Rose'], {
      extra: { dateDepart: new Date(Date.now() + 10 * HEURE) },
    })
    const loin = await pret(s, ['Gris'], {
      extra: { dateDepart: new Date(Date.now() + 100 * HEURE) },
    })
    const d = await dispatch(s)
    expect(ligneDe(d, proche.trainId)?.urgent).toBe(true)
    expect(ligneDe(d, loin.trainId)?.urgent).toBe(false)
    expect(d.alertes).toMatchObject({ departProche: 1, seuilDepartHeures: 36 })
    await parametre(ctx, 'dispatch.seuilDepartHeures', '200')
    expect((await dispatch(s)).alertes).toMatchObject({ departProche: 2, seuilDepartHeures: 200 })
    expect((await affecter(s, [proche.trainId], r1.id)).statusCode).toBe(200)
    const apres = await dispatch(s)
    expect(ligneDe(apres, proche.trainId)?.urgent).toBe(false)
    expect(apres.alertes.departProche).toBe(1)
  })
})

// ───────────────────────── RG-COO-294 affectation manuelle, désaffectation ─────────────────────────

describe('RG-COO-294 affectation manuelle d’un rouleur et « Tout désaffecter »', () => {
  it('RG-COO-294 nominal : affecter écrit le rouleur sur toutes les faces du train (version +1), journal « qui / ancien / nouveau » ; le dispatch le montre', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur N1')
    const t = await pret(s, ['Rose', 'Gris'])
    const avant = await faceDe(t.faces[0]?.id ?? 0)
    const r = await affecter(s, [t.trainId], r1.id)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toEqual({ message: 'Rouleur Rouleur N1 affecté à 1 train(s).', nombre: 1 })
    for (const face of t.faces) {
      const apres = await faceDe(face.id)
      expect(apres.rouleurId).toBe(r1.id)
      expect(apres.statut).toBe('A_IMPRIMER')
      expect(apres.version).toBe(avant.version + 1)
    }
    const j = await db.journalAudit.findFirstOrThrow({
      where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'AFFECTATION_DISPATCH' },
    })
    expect(j).toMatchObject({
      parId: s.users.cheq.id,
      nouvelleValeur: 'Rouleur N1',
      ancienneValeur: null,
    })
    expect(ligneDe(await dispatch(s), t.trainId)?.rouleur).toMatchObject({ id: r1.id })
  })

  it('RG-COO-294 réaffectation : un train « En production » change de rouleur (RG-COO-294 : train non livré) ; l’ancien rouleur est tracé', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur R1')
    const r2 = await rouleur(s, 'Rouleur R2')
    const t = await enProd(s, ['Rose'], r1.id)
    const r = await affecter(s, [t.trainId], r2.id)
    expect(r.statusCode, r.body).toBe(200)
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBe(r2.id)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('AU_ROULAGE')
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: t.trainId, action: 'AFFECTATION_DISPATCH' },
    })
    expect(j).toMatchObject({ ancienneValeur: 'Rouleur R1', nouvelleValeur: 'Rouleur R2' })
  })

  it('RG-COO-294 « Non affecté » : un train prêt est désaffecté (journal) ; un train en production garde un rouleur obligatoire (409 COO_ROULEUR_OBLIGATOIRE, RG-COO-217), rien n’est écrit', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur D1')
    const prete = await pret(s, ['Rose'], { extra: { rouleurId: r1.id } })
    const prod = await enProd(s, ['Gris'], r1.id)
    const ok = await affecter(s, [prete.trainId], null)
    expect(ok.statusCode, ok.body).toBe(200)
    expect((await faceDe(prete.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect(
      await db.journalAudit.count({
        where: { entiteId: prete.trainId, action: 'DESAFFECTATION_DISPATCH' },
      }),
    ).toBe(1)
    const ko = await affecter(s, [prod.trainId], null)
    expect(ko.statusCode, ko.body).toBe(409)
    expect(erreur(ko)).toMatchObject({ code: 'COO_ROULEUR_OBLIGATOIRE', regle: 'RG-COO-217' })
    expect((await faceDe(prod.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
  })

  it('RG-X / RG-COO-208 rejet : un train dont un visuel n’est plus reçu n’est plus « Prêt » : sorti du dispatch, affectation refusée (409 TRANSITION_INTERDITE), rien d’écrit', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur X1')
    const t = await pret(s, ['Rose'])
    const versionsAvant = await versions(ctx, s.users.coord.headers, [t.trainId])
    await db.afficheAttendue.updateMany({
      where: { ligneAttendue: { contNum: t.faces[0]?.contNum ?? 0 } },
      data: { actif: false },
    })
    expect(ligneDe(await dispatch(s), t.trainId)).toBeUndefined()
    const r = await envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
      trains: versionsAvant,
      rouleurId: r1.id,
    })
    expect(r.statusCode, r.body).toBe(409)
    expect(erreur(r).code).toBe('TRANSITION_INTERDITE')
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBeNull()
  })

  it('RG-COO-294 / RG-COO-308 rejet : version de train périmée 409 ; train inconnu 404 ; rouleur d’un autre atelier 422 ; rouleur désactivé 404 ; corps invalide 400', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur V1')
    const autreAtelier = await rouleur(s, 'Rouleur V2', s.atelier2.id)
    const inactif = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Rouleur V3',
      dateFin: new Date(Date.now() - 86_400_000),
    })
    const t = await pret(s, ['Rose'])
    const perimee = await envoyer(
      ctx,
      '/api/coordination/dispatch/affecter',
      s.users.cheq.headers,
      {
        trains: [{ trainId: t.trainId, version: '9.9.9' }],
        rouleurId: r1.id,
      },
    )
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
    expect(
      (
        await envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
          trains: [{ trainId: '999999999999999999', version: '1.1.1' }],
          rouleurId: r1.id,
        })
      ).statusCode,
    ).toBe(404)
    const autre = await affecter(s, [t.trainId], autreAtelier.id)
    expect(autre.statusCode, autre.body).toBe(422)
    expect(erreur(autre).code).toBe('COO_ROULEUR_AUTRE_ATELIER')
    expect((await affecter(s, [t.trainId], inactif.id)).statusCode).toBe(404)
    expect((await affecter(s, [t.trainId], 99_999_999)).statusCode).toBe(404)
    for (const corps of [
      {},
      { trains: [], rouleurId: r1.id },
      { trains: [{ trainId: t.trainId }], rouleurId: 0 },
    ])
      expect(
        (await envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, corps))
          .statusCode,
      ).toBe(400)
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBeNull()
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-294 permissions : affecter pour le rôle %s (chef d’équipe seul)',
    async (role) => {
      const s = await siteDeroulant(ctx)
      const r1 = await rouleur(s, 'Rouleur P1')
      const t = await pret(s, ['Rose'])
      const r = await affecter(s, [t.trainId], r1.id, s.users[role].headers)
      const autorise = role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBe(autorise ? r1.id : null)
    },
  )

  it('RG-COO-167 périmètre : le chef d’équipe d’un autre site ne peut pas affecter un train de ce site (403) ; rien n’est écrit', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur PX')
    const t = await pret(s, ['Rose'])
    const r = await envoyer(ctx, '/api/coordination/dispatch/affecter', autre.users.cheq.headers, {
      trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
      rouleurId: r1.id,
    })
    expect(r.statusCode, r.body).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBeNull()
  })

  it('RG-COO-294 concurrence : deux affectations simultanées sur la même version : une seule passe (200 / 409)', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur C1')
    const r2 = await rouleur(s, 'Rouleur C2')
    const t = await pret(s, ['Rose'])
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    const [a, b] = await Promise.all([
      envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
        trains: v,
        rouleurId: r1.id,
      }),
      envoyer(ctx, '/api/coordination/dispatch/affecter', s.users.cheq.headers, {
        trains: v,
        rouleurId: r2.id,
      }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-COO-294 idempotence : même clé et même corps rejoués = même réponse, une seule écriture ; autre corps avec la même clé : 409', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur I1')
    const r2 = await rouleur(s, 'Rouleur I2')
    const t = await pret(s, ['Rose'])
    const trains = await versions(ctx, s.users.coord.headers, [t.trainId])
    const poster = (rouleurId: number, cle: Record<string, string>) =>
      envoyer(
        ctx,
        '/api/coordination/dispatch/affecter',
        s.users.cheq.headers,
        { trains, rouleurId },
        cle,
      )
    const cle = idem()
    const un = await poster(r1.id, cle)
    const deux = await poster(r1.id, cle)
    expect(un.statusCode).toBe(200)
    expect(deux.json()).toEqual(un.json())
    expect(
      await db.journalAudit.count({
        where: { entiteId: t.trainId, action: 'AFFECTATION_DISPATCH' },
      }),
    ).toBe(1)
    const autre = await poster(r2.id, cle)
    expect(autre.statusCode).toBe(409)
    expect(erreur(autre).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(
      (
        await envoyer(
          ctx,
          '/api/coordination/dispatch/affecter',
          s.users.cheq.headers,
          { trains: [], rouleurId: null },
          {},
        )
      ).statusCode,
    ).toBe(400)
  })

  it('RG-COO-294 atomicité : un échec du journal sur le 2e train annule l’affectation du 1er (faces inchangées) ; la clé n’est pas gardée', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur AT-D')
    const a = await pret(s, ['Rose'])
    const b = await pret(s, ['Gris'])
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${b.trainId}'`,
      () => affecter(s, [a.trainId, b.trainId], r1.id),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect((await faceDe(a.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect((await faceDe(b.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect((await affecter(s, [a.trainId, b.trainId], r1.id)).statusCode).toBe(200)
  })

  it('RG-COO-294 « Tout désaffecter » : les trains prêts repassent « Non affecté » ; les trains en production gardent leur rouleur (RG-COO-217), signalés dans le message', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur T1')
    const a = await pret(s, ['Rose'], { extra: { rouleurId: r1.id } })
    const b = await pret(s, ['Gris'], { extra: { rouleurId: r1.id } })
    const c = await pret(s, ['Bleu'])
    const prod = await enProd(s, ['Vert'], r1.id)
    const r = await repartir(s, 'desaffecter', [a.trainId, b.trainId, c.trainId, prod.trainId])
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toEqual({
      message: '2 train(s) désaffecté(s) ; 1 train(s) en production gardent leur rouleur.',
      nombre: 2,
    })
    expect((await faceDe(a.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect((await faceDe(b.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect((await faceDe(prod.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
    expect(
      await db.journalAudit.count({
        where: {
          action: 'DESAFFECTATION_DISPATCH',
          entiteId: { in: [a.trainId, b.trainId, c.trainId] },
        },
      }),
    ).toBe(2)
  })

  it('RG-COO-294 « Tout désaffecter » rejets : train hors dispatch 409 ; train d’un autre atelier 422 ; atelier inconnu 404 ; chef d’équipe d’un autre site 403 ; permissions des 6 rôles', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const attente = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const ailleurs = await pret(s, ['Bleu'], { atelierId: s.atelier2.id })
    expect((await repartir(s, 'desaffecter', [t.trainId, attente.trainId])).statusCode).toBe(409)
    const a2 = await repartir(s, 'desaffecter', [t.trainId, ailleurs.trainId])
    expect(a2.statusCode, a2.body).toBe(422)
    expect(erreur(a2).code).toBe('COO_TRAIN_AUTRE_ATELIER')
    expect(
      (
        await envoyer(ctx, '/api/coordination/dispatch/desaffecter', s.users.cheq.headers, {
          atelierId: 99_999_999,
          trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (await repartir(s, 'desaffecter', [t.trainId], autre.users.cheq.headers)).statusCode,
    ).toBe(403)
    for (const role of ROLES.filter((x) => x !== 'cheq' && x !== 'admin'))
      expect(
        (await repartir(s, 'desaffecter', [t.trainId], s.users[role].headers)).statusCode,
      ).toBe(403)
  })
})

// ───────────────────────── RG-COO-293 proposer une répartition (règle simulée) ─────────────────────────

describe('RG-COO-293 « Proposer une répartition » : départ le plus proche d’abord, puis rouleur le moins chargé (règle SIMULÉE, Q-276)', () => {
  it('RG-COO-293 nominal : trains non affectés répartis par départ croissant sur le rouleur le moins chargé (faces) ; message « Répartition proposée : n trains sur m rouleurs. » ; journal par train', async () => {
    const s = await siteDeroulant(ctx)
    const a = await rouleur(s, 'Rouleur A')
    const b = await rouleur(s, 'Rouleur B')
    // A porte déjà 2 faces (train en production) : B est le moins chargé au départ.
    await enProd(s, ['Rose', 'Gris'], a.id)
    const t1 = await pret(s, ['Bleu'], {
      extra: { dateDepart: new Date(DEPART.getTime() + 1 * HEURE) },
    })
    const t2 = await pret(s, ['Vert'], {
      extra: { dateDepart: new Date(DEPART.getTime() + 2 * HEURE) },
    })
    const t3 = await pret(s, ['Noir'], {
      extra: { dateDepart: new Date(DEPART.getTime() + 3 * HEURE) },
    })
    const r = await repartir(s, 'proposer', [t3.trainId, t1.trainId, t2.trainId])
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toEqual({
      message: 'Répartition proposée : 3 trains sur 2 rouleurs.',
      nombre: 3,
    })
    // t1 (départ le plus proche) → B (0 face < 2) ; t2 → B (1 face < 2) ; t3 → égalité 2 / 2 → plus petit id : A.
    expect((await faceDe(t1.faces[0]?.id ?? 0)).rouleurId).toBe(b.id)
    expect((await faceDe(t2.faces[0]?.id ?? 0)).rouleurId).toBe(b.id)
    expect((await faceDe(t3.faces[0]?.id ?? 0)).rouleurId).toBe(a.id)
    expect(
      await db.journalAudit.count({
        where: {
          action: 'PROPOSITION_REPARTITION',
          entiteId: { in: [t1.trainId, t2.trainId, t3.trainId] },
          parId: s.users.cheq.id,
        },
      }),
    ).toBe(3)
  })

  it('RG-COO-293 les trains déjà affectés (prêts ou en production) ne sont pas touchés ; seuls les trains non affectés sont répartis', async () => {
    const s = await siteDeroulant(ctx)
    const a = await rouleur(s, 'Rouleur K1')
    await rouleur(s, 'Rouleur K2')
    const deja = await pret(s, ['Rose'], { extra: { rouleurId: a.id } })
    const prod = await enProd(s, ['Gris'], a.id)
    const libre = await pret(s, ['Bleu'])
    const avant = await faceDe(deja.faces[0]?.id ?? 0)
    const r = await repartir(s, 'proposer', [deja.trainId, prod.trainId, libre.trainId])
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ nombre: 1 })
    expect(await faceDe(deja.faces[0]?.id ?? 0)).toMatchObject({
      rouleurId: a.id,
      version: avant.version,
    })
    expect((await faceDe(prod.faces[0]?.id ?? 0)).rouleurId).toBe(a.id)
    expect((await faceDe(libre.faces[0]?.id ?? 0)).rouleurId).not.toBeNull()
  })

  it('RG-COO-293 rejet : rien à répartir 422 COO_RIEN_A_REPARTIR ; aucun rouleur actif 422 COO_AUCUN_ROULEUR ; train hors dispatch sans effet sur les autres (ignoré) ; aucune écriture', async () => {
    const s = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const aucun = await repartir(s, 'proposer', [t.trainId])
    expect(aucun.statusCode, aucun.body).toBe(422)
    expect(erreur(aucun)).toMatchObject({ code: 'COO_AUCUN_ROULEUR', regle: 'RG-COO-293' })
    const r1 = await rouleur(s, 'Rouleur Z1')
    const affecte = await pret(s, ['Gris'], { extra: { rouleurId: r1.id } })
    const rien = await repartir(s, 'proposer', [affecte.trainId])
    expect(rien.statusCode, rien.body).toBe(422)
    expect(erreur(rien)).toMatchObject({ code: 'COO_RIEN_A_REPARTIR', regle: 'RG-COO-293' })
    const attente = await trainExportable(ctx, s, ['Vert'], { statut: 'A_IMPRIMER' })
    const mixte = await repartir(s, 'proposer', [attente.trainId, t.trainId])
    expect(mixte.statusCode, mixte.body).toBe(200)
    expect((await faceDe(attente.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
  })

  it('RG-COO-293 rejets : version périmée 409 ; train d’un autre atelier 422 ; corps invalide 400 ; chef d’équipe d’un autre site 403 ; permissions des 6 rôles', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    await rouleur(s, 'Rouleur Y1')
    const t = await pret(s, ['Rose'])
    const ailleurs = await pret(s, ['Bleu'], { atelierId: s.atelier2.id })
    const perimee = await envoyer(
      ctx,
      '/api/coordination/dispatch/proposer',
      s.users.cheq.headers,
      {
        atelierId: s.atelier.id,
        trains: [{ trainId: t.trainId, version: '1.1.1' }],
      },
    )
    expect(perimee.statusCode).toBe(409)
    expect((await repartir(s, 'proposer', [t.trainId, ailleurs.trainId])).statusCode).toBe(422)
    expect(
      (
        await envoyer(ctx, '/api/coordination/dispatch/proposer', s.users.cheq.headers, {
          atelierId: s.atelier.id,
          trains: [],
        })
      ).statusCode,
    ).toBe(400)
    expect((await repartir(s, 'proposer', [t.trainId], autre.users.cheq.headers)).statusCode).toBe(
      403,
    )
    for (const role of ROLES.filter((x) => x !== 'cheq' && x !== 'admin'))
      expect((await repartir(s, 'proposer', [t.trainId], s.users[role].headers)).statusCode).toBe(
        403,
      )
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBeNull()
  })

  it('RG-COO-293 idempotence (même clé = une seule répartition) et atomicité (un échec du journal annule toutes les affectations)', async () => {
    const s = await siteDeroulant(ctx)
    await rouleur(s, 'Rouleur H1')
    const a = await pret(s, ['Rose'])
    const b = await pret(s, ['Gris'], { extra: { dateDepart: new Date(DEPART.getTime() + HEURE) } })
    const ko = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${b.trainId}'`,
      () => repartir(s, 'proposer', [a.trainId, b.trainId]),
    )
    expect(ko.statusCode).toBeGreaterThanOrEqual(400)
    expect((await faceDe(a.faces[0]?.id ?? 0)).rouleurId).toBeNull()
    const cle = idem()
    const corps = {
      atelierId: s.atelier.id,
      trains: await versions(ctx, s.users.coord.headers, [a.trainId, b.trainId]),
    }
    const poster = () =>
      envoyer(ctx, '/api/coordination/dispatch/proposer', s.users.cheq.headers, corps, cle)
    const un = await poster()
    const deux = await poster()
    expect(un.statusCode, un.body).toBe(200)
    expect(deux.json()).toEqual(un.json())
    expect(
      await db.journalAudit.count({
        where: { action: 'PROPOSITION_REPARTITION', entiteId: a.trainId },
      }),
    ).toBe(1)
  })
})

// ───────────────────────── RG-COO-296 liste de picking ─────────────────────────

describe('RG-COO-296 liste de picking d’un rouleur (« Liste des affaires à collecter »)', () => {
  it('RG-COO-296 nominal : une ligne par affiche rattachée aux visuels de ses trains (emplacement, n° affiche, annonceur, thème, quantité), triée par emplacement', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur Pk')
    const c1 = numero()
    const c2 = numero()
    await pret(s, ['Rose'], { annonceur: 'ALPHA', extra: { contNum: c1, rouleurId: r1.id } })
    await pret(s, ['Gris'], { annonceur: 'BETA', extra: { contNum: c2, rouleurId: r1.id } })
    await pret(s, ['Bleu'], { extra: { contNum: numero() } })
    await db.affiche.updateMany({
      where: { contNum: c1, plateformeId: s.plateforme.id },
      data: { allee: 'C', rayon: '03' },
    })
    await db.affiche.updateMany({
      where: { contNum: c2, plateformeId: s.plateforme.id },
      data: { allee: 'A', rayon: '07' },
    })
    const r = await get(
      ctx,
      `/api/coordination/dispatch/picking?rouleur=${String(r1.id)}`,
      s.users.cheq.headers,
    )
    expect(r.statusCode, r.body).toBe(200)
    const p = PickingSchema.parse(r.json())
    expect(p.rouleur).toMatchObject({ id: r1.id, nom: 'Rouleur Pk' })
    expect(p.lignes.map((l) => [l.emplacement, l.annonceur, l.theme, l.quantite])).toEqual([
      ['A-07', 'BETA', 'Gris', 1],
      ['C-03', 'ALPHA', 'Rose', 1],
    ])
    expect(p.lignes.every((l) => l.numAffiche !== null)).toBe(true)
  })

  it('RG-COO-296 un rouleur sans train donne une liste vide ; les trains fractionnés, annulés ou déjà produits n’y figurent pas ; filtre départ', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur Pv')
    const vide = PickingSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/dispatch/picking?rouleur=${String(r1.id)}`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    expect(vide.lignes).toEqual([])
    const t = await pret(s, ['Rose', 'Gris'], { extra: { rouleurId: r1.id } })
    await db.faceTrain.update({ where: { id: t.faces[1]?.id ?? 0 }, data: { fractionnee: true } })
    await trainExportable(ctx, s, ['Noir'], { statut: 'PREPARE', extra: { rouleurId: r1.id } })
    const p = PickingSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/dispatch/picking?rouleur=${String(r1.id)}&depart=${DEPART_TXT}`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    expect(p.lignes.map((l) => l.theme)).toEqual(['Rose'])
    const autreSemaine = PickingSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/dispatch/picking?rouleur=${String(r1.id)}&depart=2031-W09`,
          s.users.cheq.headers,
        )
      ).json(),
    )
    expect(autreSemaine.lignes).toEqual([])
  })

  it('RG-COO-296 rejets : rouleur inconnu 404 ; paramètre invalide 400 ; rouleur d’un autre site 403 ; permissions des 6 rôles ; 401', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur Pq')
    const url = `/api/coordination/dispatch/picking?rouleur=${String(r1.id)}`
    expect(
      (await get(ctx, '/api/coordination/dispatch/picking?rouleur=99999999', s.users.cheq.headers))
        .statusCode,
    ).toBe(404)
    expect(
      (await get(ctx, '/api/coordination/dispatch/picking?rouleur=abc', s.users.cheq.headers))
        .statusCode,
    ).toBe(400)
    const hors = await get(ctx, url, autre.users.cheq.headers)
    expect(hors.statusCode, hors.body).toBe(403)
    expect(erreur(hors).regle).toBe('RG-COO-167')
    for (const role of ROLES_SANS_ADMIN)
      expect((await get(ctx, url, s.users[role].headers)).statusCode).toBe(
        role === 'cheq' ? 200 : 403,
      )
    expect((await ctx.app.inject({ method: 'GET', url })).statusCode).toBe(401)
  })

  it('RG-COO-296 lecture seule : la liste de picking n’écrit rien (faces, affiches, journal)', async () => {
    const s = await siteDeroulant(ctx)
    const r1 = await rouleur(s, 'Rouleur Pr')
    const t = await pret(s, ['Rose'], { extra: { rouleurId: r1.id } })
    const avant = await faceDe(t.faces[0]?.id ?? 0)
    const journal = await db.journalAudit.count()
    expect(
      (
        await get(
          ctx,
          `/api/coordination/dispatch/picking?rouleur=${String(r1.id)}`,
          s.users.cheq.headers,
        )
      ).statusCode,
    ).toBe(200)
    expect(await faceDe(t.faces[0]?.id ?? 0)).toEqual(avant)
    expect(await db.journalAudit.count()).toBe(journal)
  })
})
