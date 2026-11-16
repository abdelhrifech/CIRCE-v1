// Étape 8 lot 5 (D-14, D-15) — tests d'INTÉGRATION : ECR-EXP-03 « Départs camions », colonnes « Clos le » / « Expédié le »
// et tri de ECR-EXP-02, « Générer un complément » et liste de picking d'un lot (ECR-GEN-03, RG-COO-074).
// Hypothèses : Q-411 (cette session), Q-403, Q-284, Q-194. API réelle sur la base de test ; aucun test unitaire.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  DepartsCamionsSchema,
  GenerationSchema,
  ListeColisSchema,
  PickingGenerationSchema,
  ResultatColisSchema,
  TrainsGenerationSchema,
  formatSemaineIso,
  semaineIsoDe,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { contexteReception, erreur, get } from '../support/reception.ts'
import {
  DEPART_TXT,
  SEM,
  envoyer,
  parametre,
  recu,
  restaurerParametres,
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

const DEPARTS = '/api/coordination/colis/departs'
const departs = async (s: SiteD, role: keyof SiteD['users'], qs = '') => {
  const r = await get(
    ctx,
    `${DEPARTS}?destinataire=${encodeURIComponent(nom(s))}${qs}`,
    s.users[role].headers,
  )
  return r
}
const nom = (s: SiteD) => s.destinataire.nom ?? ''
const lu = async (s: SiteD, qs = '') => {
  const r = await departs(s, 'expe', qs)
  expect(r.statusCode, r.body).toBe(200)
  return DepartsCamionsSchema.parse(r.json())
}

async function siteAvecFixe() {
  const s = await siteDeroulant(ctx)
  const fixe = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'FIXE' })
  return { ...s, fixe }
}
type SiteF = Awaited<ReturnType<typeof siteAvecFixe>>

const um = (
  s: SiteF,
  statut: 'EN_COURS' | 'PREPARE' | 'A_EXPEDIER' | 'TERMINE' | 'ANNULE',
  o = {},
) =>
  f.createUniteManutention(db, {
    atelierId: s.fixe.id,
    supportId: s.support.id,
    destinataireId: s.destinataire.id,
    qte: 10,
    statut,
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
    ...o,
  })

describe('ECR-EXP-03 Départs camions (D-14)', () => {
  it('RG-COO-265 nominal : une ligne par départ × destinataire, unités / colisées / en cours / en attente, avancement et indicateurs', async () => {
    const s = await siteAvecFixe()
    await um(s, 'EN_COURS')
    await um(s, 'TERMINE')
    await um(s, 'ANNULE')
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_EXPEDIER' })
    const enProd = await trainExportable(ctx, s, ['Gris'], { statut: 'AU_ROULAGE' })
    expect(enProd.trainId).toBeTruthy()
    await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER' })
    const d = await lu(s)
    expect(d.departs).toHaveLength(1)
    expect(d.departs[0]).toMatchObject({
      depart: DEPART_TXT,
      destinataire: { id: s.destinataire.id },
      unites: 5, // UM annulée exclue
      colisees: 2,
      enCours: 2,
      enAttente: 1,
      avancement: 40,
      gravite: 'ATTENTION',
    })
    expect(d.indicateurs).toEqual({ unites: 5, colisees: 2, enCours: 2, enAttente: 1 })
  })

  it('RG-COO-265 liseré : « Prêt » quand tout est colisé, « Critique » quand des unités attendent et que le départ est dans moins de 36 h', async () => {
    const pret = await siteAvecFixe()
    await um(pret, 'TERMINE')
    await trainExportable(ctx, pret, ['Rose'], { statut: 'A_EXPEDIER' })
    expect((await lu(pret)).departs[0]?.gravite).toBe('PRET')
    const proche = await siteAvecFixe()
    await trainExportable(ctx, proche, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { dateDepart: new Date(Date.now() + 3_600_000) },
    })
    const l = (await lu(proche)).departs[0]
    expect(l).toMatchObject({ enAttente: 1, gravite: 'CRITIQUE' })
    expect(l?.departLe).not.toBeNull()
  })

  it('ECR-EXP-03 les UM des types « Bus » (remise directe) sont exclues (paramètre unitaire.typesBus)', async () => {
    const s = await siteAvecFixe()
    const type = await f.createTypePreparation(db)
    await parametre(ctx, 'unitaire.typesBus', String(type.id))
    await um(s, 'EN_COURS', { typePreparationId: type.id })
    await um(s, 'EN_COURS')
    expect((await lu(s)).indicateurs.unites).toBe(1)
  })

  it('ECR-EXP-03 filtres : Départ (fenêtre par défaut de 14 jours écartée), destinataire, dossier, atelier', async () => {
    const s = await siteAvecFixe()
    const ancienne = semaineIsoDe(new Date(Date.now() - 42 * 86_400_000))
    await um(s, 'EN_COURS', { semAnnee: ancienne.annee, semNum: ancienne.semaine })
    const courante = await um(s, 'EN_COURS', { contNum: 7_100_001 })
    expect((await lu(s)).indicateurs.unites).toBe(1)
    const parDepart = await lu(s, `&depart=${formatSemaineIso(ancienne)}`)
    expect(parDepart.indicateurs.unites).toBe(1)
    expect(parDepart.depuis).toBeNull()
    expect((await lu(s)).depuis).not.toBeNull()
    expect((await lu(s, `&dossier=${String(courante.contNum)}`)).indicateurs.unites).toBe(1)
    expect((await lu(s, '&dossier=1')).departs).toEqual([])
    expect((await lu(s, `&atelier=${String(s.atelier.id)}`)).departs).toEqual([])
    const autre = await get(ctx, `${DEPARTS}?destinataire=zzz-inconnu`, s.users.expe.headers)
    expect(DepartsCamionsSchema.parse(autre.json()).departs).toEqual([])
  })

  it('RG-COO-167 périmètre : un utilisateur d’un autre site ne voit pas les départs', async () => {
    const s = await siteAvecFixe()
    await um(s, 'EN_COURS')
    const autre = await siteAvecFixe()
    const r = await get(
      ctx,
      `${DEPARTS}?destinataire=${encodeURIComponent(nom(s))}`,
      autre.users.expe.headers,
    )
    expect(DepartsCamionsSchema.parse(r.json()).departs).toEqual([])
  })

  it.each(['cheq', 'expe'] as const)('RG-COO-265 %s peut consulter les départs', async (role) => {
    const s = await siteAvecFixe()
    expect((await departs(s, role)).statusCode).toBe(200)
  })

  it.each(['coord', 'recep', 'com'] as const)(
    'RG-COO-165 %s n’a pas le droit « colis.gerer » : 403',
    async (role) => {
      const s = await siteAvecFixe()
      const r = await departs(s, role)
      expect(r.statusCode).toBe(403)
      expect(erreur(r).code).toBe('PERMISSION')
    },
  )

  it('RG-COO-165 sans identité : 401 ; départ invalide : 400', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: DEPARTS })).statusCode).toBe(401)
    const s = await siteAvecFixe()
    expect((await departs(s, 'expe', '&depart=abc')).statusCode).toBe(400)
  })
})

describe('ECR-EXP-02 « Expédié le », « Clos le » et tri par statut (D-14)', () => {
  async function colisClos(s: SiteF) {
    const u = await um(s, 'EN_COURS')
    const c = await envoyer(ctx, '/api/coordination/colis', s.users.expe.headers, {
      atelierId: s.fixe.id,
      destinataireId: s.destinataire.id,
    })
    const colis = ResultatColisSchema.parse(c.json()).colis
    if (!colis) throw new Error('colis')
    const a = await envoyer(
      ctx,
      `/api/coordination/colis/${String(colis.id)}/unites`,
      s.users.expe.headers,
      {
        version: colis.version,
        code: u.codeBarre ?? '',
      },
    )
    const ajoute = ResultatColisSchema.parse(a.json()).colis
    if (!ajoute) throw new Error('colis')
    return ajoute
  }
  const liste = async (s: SiteF) =>
    ListeColisSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/colis?destinataire=${encodeURIComponent(nom(s))}`,
          s.users.expe.headers,
        )
      ).json(),
    ).colis

  it('RG-COO-269 « Clos le » posé à l’expédition du colis, « Expédié le » seulement à la fin de journée ; tri ouvert, clos, expédié', async () => {
    const s = await siteAvecFixe()
    const aExpedier = await colisClos(s)
    const ouvert = await colisClos(s)
    const termine = await colisClos(s)
    for (const c of [aExpedier, termine])
      expect(
        (
          await envoyer(
            ctx,
            `/api/coordination/colis/${String(c.id)}/expedier`,
            s.users.expe.headers,
            {
              version: c.version,
            },
          )
        ).statusCode,
      ).toBe(200)
    // Le colis « termine » est expédié seul : on passe d'abord les autres colis clos (aucun) puis fin de journée globale.
    const avant = await liste(s)
    expect(avant.find((c) => c.id === aExpedier.id)).toMatchObject({
      statut: 'A_EXPEDIER',
      expedieLe: null,
    })
    expect(avant.find((c) => c.id === aExpedier.id)?.dateExpedition).not.toBeNull()
    expect(avant.find((c) => c.id === ouvert.id)).toMatchObject({
      statut: 'EN_COURS',
      dateExpedition: null,
    })
    expect(avant.map((c) => c.statut)).toEqual(['EN_COURS', 'A_EXPEDIER', 'A_EXPEDIER'])
    const fin = await envoyer(
      ctx,
      '/api/coordination/colis/fin-de-journee',
      s.users.expe.headers,
      {},
    )
    expect(fin.statusCode, fin.body).toBe(200)
    const apres = await liste(s)
    for (const c of apres.filter((x) => x.statut === 'TERMINE')) {
      expect(c.expedieLe).not.toBeNull()
      expect(Date.parse(c.expedieLe ?? '')).toBeGreaterThanOrEqual(
        Date.parse(c.dateExpedition ?? ''),
      )
    }
    expect(apres.map((c) => c.statut)).toEqual(['EN_COURS', 'TERMINE', 'TERMINE'])
  })
})

// ───────────────────────── D-15 : complément et liste de picking ─────────────────────────

const preparer = async (s: SiteD, trainIds: string[]) =>
  envoyer(ctx, '/api/coordination/generateur', s.users.cheq.headers, {
    depart: DEPART_TXT,
    trains: await versions(ctx, s.users.coord.headers, trainIds),
  })
const envoi = (s: SiteD, id: number, version: number) =>
  envoyer(ctx, '/api/coordination/generateur/envoyer', s.users.cheq.headers, { id, version })
const complement = (s: SiteD, id: number, version: number, role: keyof SiteD['users'] = 'cheq') =>
  envoyer(ctx, '/api/coordination/generateur/complement', s.users[role].headers, { id, version })
const pret = async (s: SiteD, themes: string[]) => {
  const t = await trainExportable(ctx, s, themes, { statut: 'A_IMPRIMER' })
  for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 3)
  return t
}
/** Le train change de version (une face écrite : dernière minute, RG-COO-074). */
const modifier = (t: { faces: { id: number }[] }) =>
  db.faceTrain.update({
    where: { id: t.faces[0]?.id ?? 0 },
    data: { afficheurNom: 'AFFICHEUR MODIFIE', version: { increment: 1 } },
  })
const generateur = async (s: SiteD) =>
  TrainsGenerationSchema.parse(
    (
      await get(ctx, `/api/coordination/generateur?depart=${DEPART_TXT}`, s.users.cheq.headers)
    ).json(),
  )
async function lotEnvoye(s: SiteD, themes: string[]) {
  const t = await pret(s, themes)
  const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
  const e = await envoi(s, g.id, g.version)
  expect(e.statusCode, e.body).toBe(200)
  return { t, g: GenerationSchema.parse(e.json()) }
}

describe('RG-COO-074 / ECR-GEN-03 « Générer un complément » (D-15)', () => {
  it('RG-COO-074 nominal : l’historique compte les trains « Modifiées depuis » ; le complément ne contient que les trains modifiés, lié au lot d’origine, version du lot d’origine +1, journalisé', async () => {
    const s = await siteDeroulant(ctx)
    const { t, g } = await lotEnvoye(s, ['Rose'])
    const h0 = (await generateur(s)).historique.find((h) => h.id === g.id)
    expect(h0).toMatchObject({ fichiers: 1, modifiees: 0, complementDe: null })
    await modifier(t)
    const h1 = (await generateur(s)).historique.find((h) => h.id === g.id)
    expect(h1?.modifiees).toBe(1)
    const origine = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    const r = await complement(s, g.id, origine.version)
    expect(r.statusCode, r.body).toBe(200)
    const c = GenerationSchema.parse(r.json())
    expect(c).toMatchObject({ statut: 'PREPARE', trains: 1, version: 1 })
    expect(c.nomFichier).toContain('_C')
    expect(c.message).toContain('Complément')
    const lot = await db.generationFichiers.findUniqueOrThrow({ where: { id: c.id } })
    expect(lot.complementDeId).toBe(g.id)
    expect(JSON.parse(lot.trains)).toEqual([t.trainId])
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version).toBe(
      origine.version + 1,
    )
    const h2 = (await generateur(s)).historique.find((h) => h.id === c.id)
    expect(h2?.complementDe).toBe(g.lot)
    const journal = await db.journalAudit.findFirst({
      where: { typeEntite: 'GENERATION_FICHIERS', entiteId: String(c.id) },
    })
    expect(journal?.complement).toContain(g.lot)
  })

  it('RG-COO-074 le complément s’envoie à la machine (train modifié, version différente) et reste envoyable si le train est « En production »', async () => {
    const s = await siteDeroulant(ctx)
    const { t, g } = await lotEnvoye(s, ['Rose'])
    await modifier(t)
    // Le train est passé « Au roulage » entre-temps (dernière minute sur un train en production).
    await db.faceTrain.updateMany({
      where: { trainId: t.trainId },
      data: { statut: 'AU_ROULAGE', version: { increment: 1 } },
    })
    const c = GenerationSchema.parse(
      (
        await complement(
          s,
          g.id,
          (await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version,
        )
      ).json(),
    )
    const e = await envoi(s, c.id, c.version)
    expect(e.statusCode, e.body).toBe(200)
    expect(GenerationSchema.parse(e.json()).statut).toBe('ENVOYE')
  })

  it('RG-COO-217 un lot normal (non complément) refuse toujours un train « En production » : 409 COO_TRAIN_NON_PRET', async () => {
    const s = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    // Statut seul (version inchangée) : le train est bien « En production » mais n'a pas été modifié.
    await db.faceTrain.updateMany({ where: { trainId: t.trainId }, data: { statut: 'AU_ROULAGE' } })
    const r = await envoi(s, g.id, g.version)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_TRAIN_NON_PRET')
  })

  it('RG-COO-074 rejets : lot non envoyé 409, aucun train modifié 422, version périmée 409, lot inconnu 404 ; aucun lot créé', async () => {
    const s = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const prepare = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    const avant = await db.generationFichiers.count()
    const nonEnvoye = await complement(s, prepare.id, prepare.version)
    expect(nonEnvoye.statusCode).toBe(409)
    expect(erreur(nonEnvoye)).toMatchObject({
      code: 'COO_COMPLEMENT_LOT_NON_ENVOYE',
      regle: 'RG-COO-074',
    })
    const { t: t2, g } = await lotEnvoye(s, ['Gris'])
    const origine = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    const vide = await complement(s, g.id, origine.version)
    expect(vide.statusCode).toBe(422)
    expect(erreur(vide)).toMatchObject({ code: 'COO_COMPLEMENT_VIDE', regle: 'RG-COO-074' })
    await modifier(t2)
    const perimee = await complement(s, g.id, origine.version + 5)
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    expect((await complement(s, 999_999_999, 1)).statusCode).toBe(404)
    expect(await db.generationFichiers.count()).toBe(avant + 1) // seul le lot « lotEnvoye » ci-dessus
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version).toBe(
      origine.version,
    )
  })

  it('RG-COO-216 atomicité : un complément qui dépasse les tiroirs est refusé (422) sans lot créé ni version du lot d’origine modifiée', async () => {
    const s = await siteDeroulant(ctx)
    const { t, g } = await lotEnvoye(s, ['Rose'])
    await modifier(t)
    await parametre(ctx, 'trains.tiroirsMax', '0')
    const origine = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    const avant = await db.generationFichiers.count()
    const r = await complement(s, g.id, origine.version)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_TIROIRS_DEPASSES', regle: 'RG-COO-216' })
    expect(await db.generationFichiers.count()).toBe(avant)
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version).toBe(
      origine.version,
    )
  })

  it('RG-COO-074 train modifié qui attend de nouveau des affiches : 409 COO_TRAIN_NON_PRET', async () => {
    const s = await siteDeroulant(ctx)
    const { t, g } = await lotEnvoye(s, ['Rose'])
    await modifier(t)
    // Le rattachement disparaît : le visuel n'est plus couvert.
    await db.afficheAttendue.updateMany({
      data: { actif: false },
      where: { ligneAttendue: { plateformeId: s.plateforme.id } },
    })
    const origine = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    const r = await complement(s, g.id, origine.version)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_TRAIN_NON_PRET', regle: 'RG-COO-208' })
  })

  it('RG-COO-074 idempotence : la même clé rejouée ne crée qu’un complément ; concurrence : deux compléments du même état, un seul réussit', async () => {
    const s = await siteDeroulant(ctx)
    const { t, g } = await lotEnvoye(s, ['Rose'])
    await modifier(t)
    const origine = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    const cle = { 'idempotency-key': `compl-${String(Date.now())}` }
    const url = '/api/coordination/generateur/complement'
    const [a, b] = [
      await envoyer(ctx, url, s.users.cheq.headers, { id: g.id, version: origine.version }, cle),
      await envoyer(ctx, url, s.users.cheq.headers, { id: g.id, version: origine.version }, cle),
    ]
    expect(a.statusCode, a.body).toBe(200)
    expect(b.statusCode).toBe(200)
    expect(GenerationSchema.parse(b.json()).id).toBe(GenerationSchema.parse(a.json()).id)
    expect(await db.generationFichiers.count({ where: { complementDeId: g.id } })).toBe(1)
    // Concurrence : même version périmée, clés différentes.
    const apres = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    const [c, d] = await Promise.all([
      complement(s, g.id, apres.version),
      complement(s, g.id, apres.version),
    ])
    expect([c.statusCode, d.statusCode].sort()).toEqual([200, 409])
    expect(await db.generationFichiers.count({ where: { complementDeId: g.id } })).toBe(2)
  })

  it('RG-COO-215 permissions : coord et cheq peuvent ; expe, recep, com refusés (403) ; sans identité 401 ; sans Idempotency-Key 400', async () => {
    const s = await siteDeroulant(ctx)
    const { t, g } = await lotEnvoye(s, ['Rose'])
    await modifier(t)
    const version = (await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version
    for (const role of ['expe', 'recep', 'com'] as const) {
      const r = await complement(s, g.id, version, role)
      expect(r.statusCode, role).toBe(403)
    }
    const sansCle = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/generateur/complement',
      headers: s.users.cheq.headers,
      payload: { id: g.id, version },
    })
    expect(sansCle.statusCode).toBe(400)
    expect(
      (
        await ctx.app.inject({
          method: 'POST',
          url: '/api/coordination/generateur/complement',
          payload: { id: g.id, version },
        })
      ).statusCode,
    ).toBe(401)
    expect((await complement(s, g.id, version, 'coord')).statusCode).toBe(200)
  })

  it('RG-COO-167 périmètre : un utilisateur d’un autre site ne peut pas compléter un lot qui n’est pas le sien (403)', async () => {
    const s = await siteDeroulant(ctx)
    const autre = await siteDeroulant(ctx)
    const { t, g } = await lotEnvoye(s, ['Rose'])
    await modifier(t)
    const version = (await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).version
    const r = await envoyer(
      ctx,
      '/api/coordination/generateur/complement',
      autre.users.cheq.headers,
      { id: g.id, version },
    )
    expect(r.statusCode).toBe(403)
  })
})

describe('ECR-GEN-03 liste de picking d’un lot (D-15)', () => {
  const picking = (s: SiteD, id: number, role: keyof SiteD['users'] = 'cheq') =>
    get(ctx, `/api/coordination/generateur/${String(id)}/picking`, s.users[role].headers)

  it('RG-COO-296 une ligne par tiroir (visuel distinct) : annonceur, thème, quantité rattachée, emplacement « allée-rayon » ; un visuel sans affiche rattachée reste listé', async () => {
    const s = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose', 'Gris'])
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    const r = await picking(s, g.id)
    expect(r.statusCode, r.body).toBe(200)
    const p = PickingGenerationSchema.parse(r.json())
    expect(p.lot).toBe(g.lot)
    expect(p.lignes.map((l) => l.tiroir)).toEqual([1, 2])
    expect(p.lignes[0]).toMatchObject({ quantite: 3, emplacement: 'B-12', annonceur: 'ANNONCEUR' })
    // Visuel sans affiche rattachée : ligne conservée, quantité inconnue.
    await db.afficheAttendue.updateMany({
      data: { actif: false },
      where: { ligneAttendue: { plateformeId: s.plateforme.id, theme: t.faces[1]?.theme ?? '' } },
    })
    const sans = PickingGenerationSchema.parse((await picking(s, g.id)).json())
    expect(sans.lignes.find((l) => l.tiroir === 2)).toMatchObject({
      quantite: null,
      emplacement: null,
    })
  })

  it('RG-COO-215 permissions : coord et cheq ; expe refusé 403 ; lot inconnu 404 ; autre site 403 ; sans identité 401', async () => {
    const s = await siteDeroulant(ctx)
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, [t.trainId])).json())
    expect((await picking(s, g.id, 'coord')).statusCode).toBe(200)
    expect((await picking(s, g.id, 'expe')).statusCode).toBe(403)
    expect((await picking(s, 999_999_999)).statusCode).toBe(404)
    const autre = await siteDeroulant(ctx)
    expect((await picking(autre, g.id)).statusCode).toBe(403)
    expect(
      (
        await ctx.app.inject({
          method: 'GET',
          url: `/api/coordination/generateur/${String(g.id)}/picking`,
        })
      ).statusCode,
    ).toBe(401)
  })
})
