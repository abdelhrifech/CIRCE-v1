// Étape 8 (Q-265, option (c) retenue par défaut : « Libérer » ne crée pas les UM, « Colisage » les crée) — tests
// d'INTÉGRATION : libération de la semaine (RG-COO-240), repères « à libérer » (RG-COO-241) et « arrivé après
// libération » (RG-COO-242, RG-X-076), construction et création des UM (RG-COO-260, 261, 262). API réelle sur la base
// de test, données isolées (site propre) et purgées. Hypothèses : Q-265, Q-404. Aucun test unitaire.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ListeAlertesSchema,
  ResultatLiberationSchema,
  ResultatUnitaireSchema,
  UnitaireSchema,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { StatutProduction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, envoyer, ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const SEM = plus(semaineIsoDe(new Date()), 2)
const DEPART = formatSemaineIso(SEM)
const numero = () => 700_000 + Math.floor(Math.random() * 200_000)
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

const purge = { ateliers: [] as number[], types: [] as number[] }
const PREFIXE = `LIB${String(Date.now())}`

beforeAll(() => ctx.demarrer())
afterAll(async () => {
  const essayer = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch {
      // purge au mieux
    }
  }
  await essayer(() => db.repartition.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() =>
    db.uniteManutention.deleteMany({ where: { atelierId: { in: purge.ateliers } } }),
  )
  await essayer(() =>
    db.liberationSemaine.deleteMany({ where: { atelierId: { in: purge.ateliers } } }),
  )
  await essayer(() =>
    db.destinataire.deleteMany({ where: { nomOrigine: { startsWith: PREFIXE } } }),
  )
  await essayer(() => db.typePreparation.deleteMany({ where: { id: { in: purge.types } } }))
  await ctx.arreter()
})

async function site(qteUm: number | null = null) {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
  const atelier2 = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
  const scroll = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const support = await f.createSupport(db, { nom: `Format ${PREFIXE}`, poids: 2, qteUm })
  const support2 = await f.createSupport(db, { nom: `Format2 ${PREFIXE}`, poids: 1, qteUm })
  const type = await db.typePreparation.create({ data: { libelle: `T ${PREFIXE}-${next()}` } })
  const dest = [
    await f.createDestinataire(db, { nomOrigine: `${PREFIXE}-A${String(next())}` }),
    await f.createDestinataire(db, { nomOrigine: `${PREFIXE}-B${String(next())}` }),
  ] as const
  const users = {} as Record<Role, { id: number; h: H }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, h: devHeaders(u.identifiantExterne) }
  }
  const ailleurs = await f.createUtilisateurAvecRoles(
    db,
    ['coord'],
    [{ plateformeId: (await f.createPlateforme(db)).id }],
  )
  purge.ateliers.push(atelier.id, atelier2.id, scroll.id)
  purge.types.push(type.id)
  return {
    plateforme,
    atelier,
    atelier2,
    scroll,
    support,
    support2,
    type,
    dest,
    users,
    ailleurs: devHeaders(ailleurs.identifiantExterne),
  }
}
type Site = Awaited<ReturnType<typeof site>>

interface Opt {
  contNum?: number
  theme?: string
  qte?: number
  statut?: StatutProduction
  dest?: 0 | 1
  atelierId?: number
  semaine?: SemaineIso
  repiquage?: string | null
  supportId?: number
  um?: { id: number }
  dateAffichage?: Date | null
}
const ligne = (s: Site, o: Opt = {}) =>
  f.createRepartition(db, {
    atelierId: o.atelierId ?? s.atelier.id,
    typePreparationId: s.type.id,
    supportId: o.supportId ?? s.support.id,
    destinataireId: s.dest[o.dest ?? 0].id,
    contNum: o.contNum ?? numero(),
    theme: o.theme ?? `Thème ${String(next())}`,
    annonceur: 'ANNONCEUR',
    qte: o.qte ?? 10,
    statut: o.statut ?? 'A_TRAITER',
    semAnnee: (o.semaine ?? SEM).annee,
    semNum: (o.semaine ?? SEM).semaine,
    repiquage: o.repiquage ?? null,
    dateAffichage: o.dateAffichage ?? null,
    ...(o.um ? { uniteId: o.um.id } : {}),
  })
const ref = (r: { id: number; version: number }) => ({ id: r.id, version: r.version })
const post = (s: Site, chemin: string, corps: unknown, role: Role = 'coord', cle: H = idem()) =>
  envoyer(ctx, `/api/coordination/unitaire/${chemin}`, s.users[role].h, corps, cle)
const liberer = (s: Site, role: Role = 'coord', o: { atelierId?: number; depart?: string } = {}) =>
  post(s, 'liberer', { atelierId: o.atelierId ?? s.atelier.id, depart: o.depart ?? DEPART }, role)
const lister = async (s: Site, qs = '') => {
  const r = await get(
    ctx,
    `/api/coordination/unitaire?atelier=${String(s.atelier.id)}${qs}`,
    s.users.coord.h,
  )
  expect(r.statusCode, r.body).toBe(200)
  return UnitaireSchema.parse(r.json())
}
const colisage = (s: Site, lignes: { id: number; version: number }[], role: Role = 'coord') =>
  post(s, 'colisage', { lignes: lignes.map(ref) }, role)
const repLue = (id: number) => db.repartition.findUniqueOrThrow({ where: { id } })
const unites = (s: Site) =>
  db.uniteManutention.findMany({ where: { atelierId: s.atelier.id }, orderBy: { id: 'asc' } })

// ───────────────────────── RG-COO-240 : libérer la semaine ─────────────────────────

describe('RG-COO-240 libérer la semaine (fixe, pliage, bus) : ne crée aucune UM', () => {
  it('RG-COO-240 la Coordination libère : libération écrite, historique des dossiers, journal, aucune UM, lignes inchangées', async () => {
    const s = await site()
    const a = await ligne(s)
    const b = await ligne(s)
    const hors = await ligne(s, { atelierId: s.atelier2.id })
    const r = await liberer(s)
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatLiberationSchema.parse(r.json())
    expect([res.atelierId, res.depart, res.dossiers]).toEqual([s.atelier.id, DEPART, 2])
    expect(res.message).toContain('libérée')
    const lib = await db.liberationSemaine.findMany({ where: { atelierId: s.atelier.id } })
    expect(lib).toHaveLength(1)
    expect([lib[0]?.semAnnee, lib[0]?.semNum, lib[0]?.parId]).toEqual([
      SEM.annee,
      SEM.semaine,
      s.users.coord.id,
    ])
    const dossiers = [a.contNum, b.contNum].map(String)
    const hist = await db.journalAudit.findMany({
      where: { typeEntite: 'DOSSIER', action: 'LIBERATION_SEMAINE', entiteId: { in: dossiers } },
    })
    expect(hist.map((h) => h.entiteId).sort()).toEqual([...dossiers].sort())
    expect(hist[0]?.nouvelleValeur).toContain("Libéré vers l'atelier")
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'LIBERATION_SEMAINE', entiteId: String(lib[0]?.id) },
      }),
    ).toBe(1)
    // Q-265 option (c) : la libération ne crée pas les UM et ne touche pas aux lignes (ni aux autres ateliers).
    expect(await unites(s)).toHaveLength(0)
    expect((await repLue(a.id)).statut).toBe('A_TRAITER')
    expect((await repLue(hors.id)).statut).toBe('A_TRAITER')
    expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier2.id } })).toBe(0)
  })

  it('RG-COO-240 / 241 / 242 l’écran lit l’état : date, auteur, lignes « à libérer » avant / après', async () => {
    const s = await site()
    await ligne(s)
    await ligne(s)
    const avant = (await lister(s)).liberation
    expect(avant.disponible).toBe(true)
    expect(avant.semaines).toEqual([
      expect.objectContaining({
        atelierId: s.atelier.id,
        depart: DEPART,
        libereeLe: null,
        libereePar: null,
        lignesALiberer: 2,
        dossiersApres: [],
      }),
    ])
    await liberer(s)
    const apres = (await lister(s)).liberation.semaines[0]
    expect(apres?.libereeLe).not.toBeNull()
    expect(apres?.libereePar).not.toBeNull()
    expect(apres?.lignesALiberer).toBe(0)
  })

  it('RG-COO-240 une seule libération par (atelier, semaine) : la seconde est refusée en 409 ; un autre atelier ou une autre semaine passent', async () => {
    const s = await site()
    expect((await liberer(s)).statusCode).toBe(200)
    const bis = await liberer(s)
    expect(bis.statusCode).toBe(409)
    expect([erreur(bis).code, erreur(bis).regle]).toEqual([
      'COO_SEMAINE_DEJA_LIBEREE',
      'RG-COO-240',
    ])
    expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier.id } })).toBe(1)
    expect((await liberer(s, 'coord', { atelierId: s.atelier2.id })).statusCode).toBe(200)
    expect((await liberer(s, 'coord', { depart: formatSemaineIso(plus(SEM, 1)) })).statusCode).toBe(
      200,
    )
  })

  it.each(ROLES.filter((r) => r !== 'coord' && r !== 'admin'))(
    'RG-COO-240 le rôle %s ne libère pas : 403, aucune libération ni historique',
    async (role) => {
      const s = await site()
      const a = await ligne(s)
      const r = await liberer(s, role)
      expect(r.statusCode, role).toBe(403)
      expect(erreur(r).code).toBe('PERMISSION')
      expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier.id } })).toBe(0)
      expect(
        await db.journalAudit.count({
          where: { action: 'LIBERATION_SEMAINE', entiteId: String(a.contNum) },
        }),
      ).toBe(0)
    },
  )

  it('RG-COO-240 entrées refusées : 401 sans identité, 400 corps invalide, 404 atelier inconnu, 422 atelier non fixe, 403 hors périmètre', async () => {
    const s = await site()
    const anonyme = await envoyer(
      ctx,
      '/api/coordination/unitaire/liberer',
      {},
      { atelierId: s.atelier.id, depart: DEPART },
    )
    expect(anonyme.statusCode).toBe(401)
    for (const corps of [
      { atelierId: s.atelier.id, depart: '2026-W60' },
      { atelierId: s.atelier.id, depart: 'S44' },
      { atelierId: 0, depart: DEPART },
      { depart: DEPART },
    ])
      expect((await post(s, 'liberer', corps)).statusCode, JSON.stringify(corps)).toBe(400)
    expect((await liberer(s, 'coord', { atelierId: 999_999_999 })).statusCode).toBe(404)
    const scroll = await liberer(s, 'coord', { atelierId: s.scroll.id })
    expect(scroll.statusCode).toBe(422)
    expect(erreur(scroll).code).toBe('COO_ATELIER_NON_FIXE')
    const hors = await envoyer(ctx, '/api/coordination/unitaire/liberer', s.ailleurs, {
      atelierId: s.atelier.id,
      depart: DEPART,
    })
    expect(hors.statusCode).toBe(403)
    expect(erreur(hors).code).toBe('COO_PERIMETRE_INTERDIT')
    expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier.id } })).toBe(0)
  })

  it('RG-COO-240 idempotence : la même clé rejoue la réponse sans seconde libération ; sans clé : 400', async () => {
    const s = await site()
    const cle = idem()
    const corps = { atelierId: s.atelier.id, depart: DEPART }
    const a = await post(s, 'liberer', corps, 'coord', cle)
    const b = await post(s, 'liberer', corps, 'coord', cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(b.json<{ libereeLe: string }>().libereeLe).toBe(
      a.json<{ libereeLe: string }>().libereeLe,
    )
    expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier.id } })).toBe(1)
    const sansCle = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/unitaire/liberer',
      headers: s.users.coord.h,
      payload: corps,
    })
    expect(sansCle.statusCode).toBe(400)
  })

  it('RG-COO-240 concurrence : deux libérations simultanées → un gagnant (200), l’autre 409, une seule libération', async () => {
    const s = await site()
    await ligne(s)
    const [a, b] = await Promise.all([liberer(s), liberer(s)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier.id } })).toBe(1)
  })

  it('RG-COO-240 atomicité : panne du journal → aucune libération écrite', async () => {
    const s = await site()
    await ligne(s)
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () => liberer(s))
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier.id } })).toBe(0)
    expect((await liberer(s)).statusCode).toBe(200)
  })

  it('RG-COO-240 la libération ne dépend pas de la validation admin : des affiches à confirmer n’empêchent rien et sont comptées', async () => {
    const s = await site()
    const l = await ligne(s, { theme: 'Thème à confirmer' })
    const reception = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      contNum: l.contNum,
      theme: 'Thème à confirmer',
    })
    const affiche = await f.createAffiche(db, { validationAdmin: false })
    await f.createRattachement(db, {
      afficheId: affiche.id,
      ligneAttendueId: reception.id,
      quantite: 5,
    })
    const r = ResultatLiberationSchema.parse((await liberer(s)).json())
    expect(r.dossiersAConfirmer).toBe(1)
    expect(r.message).toContain('à confirmer')
    await db.afficheAttendue.deleteMany({ where: { ligneAttendueId: reception.id } })
  })
})

// ───────────────────────── RG-COO-241 : « à libérer » ─────────────────────────

describe('RG-COO-241 ligne « à libérer » tant que la semaine n’est pas libérée (repère dérivé)', () => {
  it('RG-COO-241 une ligne A traiter d’une semaine non libérée est « à libérer » ; une ligne En cours ne l’est pas ; le filtre Repère la retrouve', async () => {
    const s = await site()
    const a = await ligne(s, { theme: 'A libérer' })
    const um = await f.createUniteManutention(db, { atelierId: s.atelier.id })
    await ligne(s, { theme: 'Déjà en UM', statut: 'EN_COURS', um })
    const u = await lister(s)
    expect(u.lignes.find((l) => l.theme === 'A libérer')?.aLiberer).toBe(true)
    expect(u.lignes.find((l) => l.theme === 'Déjà en UM')?.aLiberer).toBe(false)
    const filtre = await lister(s, '&repere=A_LIBERER')
    expect(filtre.lignes.map((l) => l.theme)).toEqual(['A libérer'])
    expect((await repLue(a.id)).statut).toBe('A_TRAITER') // le repère n'est pas un statut persistant
    await liberer(s)
    expect((await lister(s)).lignes.every((l) => !l.aLiberer)).toBe(true)
    expect((await lister(s, '&repere=A_LIBERER')).lignes).toHaveLength(0)
  })

  it('RG-COO-241 la libération d’une semaine ne libère pas les autres semaines ni les autres ateliers', async () => {
    const s = await site()
    await ligne(s, { theme: 'S+2' })
    await ligne(s, { theme: 'S+3', semaine: plus(SEM, 1) })
    await ligne(s, { theme: 'Autre atelier', atelierId: s.atelier2.id })
    await liberer(s)
    const u = await lister(s)
    expect(u.lignes.find((l) => l.theme === 'S+2')?.aLiberer).toBe(false)
    expect(u.lignes.find((l) => l.theme === 'S+3')?.aLiberer).toBe(true)
    const autre = await get(
      ctx,
      `/api/coordination/unitaire?atelier=${String(s.atelier2.id)}`,
      s.users.coord.h,
    )
    expect(
      UnitaireSchema.parse(autre.json()).lignes.find((l) => l.theme === 'Autre atelier')?.aLiberer,
    ).toBe(true)
  })

  it('RG-COO-241 repère invalide : 400', async () => {
    const s = await site()
    const r = await get(ctx, '/api/coordination/unitaire?repere=LIBERE', s.users.coord.h)
    expect(r.statusCode).toBe(400)
  })
})

// ───────────────────────── RG-COO-242 / RG-X-076 : arrivé après libération ─────────────────────────

describe('RG-COO-242 / RG-X-076 préparation reçue après la libération de la semaine', () => {
  it('RG-X-076 une ligne créée après la libération : repère, dossier listé, filtre, alerte APRES_LIBERATION ; UM existantes intactes', async () => {
    const s = await site()
    const avant = await ligne(s, { theme: 'Avant' })
    const um = await f.createUniteManutention(db, { atelierId: s.atelier.id })
    const enUm = await ligne(s, { theme: 'Déjà colisée', statut: 'EN_COURS', um })
    await liberer(s)
    await attendre(15)
    const tard = await ligne(s, { theme: 'Tardive', contNum: 888_001 })
    const u = await lister(s)
    expect(u.lignes.find((l) => l.theme === 'Tardive')?.apresLiberation).toBe(true)
    expect(u.lignes.find((l) => l.theme === 'Avant')?.apresLiberation).toBe(false)
    expect(u.liberation.semaines[0]?.dossiersApres).toEqual([888_001])
    expect((await lister(s, '&repere=APRES_LIBERATION')).lignes.map((l) => l.theme)).toEqual([
      'Tardive',
    ])
    const r = await get(ctx, '/api/alertes?type=APRES_LIBERATION', s.users.coord.h)
    expect(r.statusCode, r.body).toBe(200)
    const alerte = ListeAlertesSchema.parse(r.json()).alertes.find((a) => a.cle.endsWith('-888001'))
    expect(alerte?.regle).toBe('RG-X-076')
    expect(alerte?.gravite).toBe('IMPORTANT')
    expect(alerte?.dossiers).toEqual([888_001])
    expect(alerte?.depart).toBe(DEPART)
    expect(alerte?.message).toContain('Q-375')
    // Aucune modification des lignes ni des UM déjà créées (RG-X-076).
    expect((await repLue(avant.id)).version).toBe(avant.version)
    expect((await repLue(enUm.id)).version).toBe(enUm.version)
    expect((await repLue(tard.id)).statut).toBe('A_TRAITER')
    expect((await db.uniteManutention.findUniqueOrThrow({ where: { id: um.id } })).version).toBe(
      um.version,
    )
  })

  it('RG-X-076 sans libération, ou pour une autre semaine ou un autre atelier : aucun repère ni alerte', async () => {
    const s = await site()
    await ligne(s, { theme: 'Sans libération', contNum: 888_011 })
    await liberer(s, 'coord', { depart: formatSemaineIso(plus(SEM, 1)) })
    await attendre(15)
    await ligne(s, { theme: 'Autre atelier', atelierId: s.atelier2.id, contNum: 888_012 })
    await ligne(s, { theme: 'Autre semaine', semaine: plus(SEM, 3), contNum: 888_013 })
    const u = await lister(s)
    expect(u.lignes.every((l) => !l.apresLiberation)).toBe(true)
    const alertes = ListeAlertesSchema.parse(
      (await get(ctx, '/api/alertes?type=APRES_LIBERATION', s.users.coord.h)).json(),
    ).alertes
    expect(
      alertes.filter(
        (a) =>
          a.cle.startsWith('LIB-') &&
          [888_011, 888_012, 888_013].some((n) => a.dossiers.includes(n)),
      ),
    ).toEqual([])
  })

  it('RG-X-076 l’alerte est de gravité importante et lue par les chefs d’équipe et la Coordination (destinataires)', async () => {
    const s = await site()
    await ligne(s)
    await liberer(s)
    await attendre(15)
    await ligne(s, { contNum: 888_021 })
    const alertes = ListeAlertesSchema.parse(
      (await get(ctx, '/api/alertes?type=APRES_LIBERATION', s.users.cheq.h)).json(),
    ).alertes
    const a = alertes.find((x) => x.cle.endsWith('-888021'))
    expect(a?.destinataires).toEqual(['Chefs d’équipe', 'Coordination'])
  })
})

// ───────────────────────── RG-COO-260 / 261 : Colisage = création des UM ─────────────────────────

describe('RG-COO-260 / 261 « Colisage » construit puis crée les UM', () => {
  it('RG-COO-260 / 261 trois lignes d’un même groupe → une UM : quantité, poids, statut 1, code barre, code synthèse, date minimale, historique, journal', async () => {
    const s = await site(100)
    const contNum = numero()
    const d1 = new Date('2027-03-10T00:00:00.000Z')
    const d2 = new Date('2027-03-08T00:00:00.000Z')
    const a = await ligne(s, { contNum, theme: 'Groupe', qte: 4, dateAffichage: d1 })
    const b = await ligne(s, { contNum, theme: 'groupe ', qte: 3, dateAffichage: d2 })
    const c = await ligne(s, { contNum, theme: 'Groupe', qte: 3 })
    const r = await colisage(s, [a, b, c])
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(r.json()).traitees).toBe(1)
    const [um] = await unites(s)
    expect(await unites(s)).toHaveLength(1)
    expect([um?.statut, um?.qte, Number(um?.poids), um?.contNum]).toEqual([
      'EN_COURS',
      10,
      20,
      contNum,
    ])
    expect(um?.dateAffichage?.toISOString()).toBe(d2.toISOString())
    expect(um?.codeBarre).toMatch(/^\d{4}-\d{13}$/)
    expect(um?.codeBarre?.endsWith(String(um.id).padStart(13, '0'))).toBe(true)
    // AASSMMJJ (8) + atelier sur 2 chiffres au moins (les identifiants d'atelier dépassent 99 en base de test, Q-404 (6))
    // + destinataire (8).
    expect(um?.codeSynthese).toMatch(/^\d{8}\d{2,}\d{8}$/)
    expect(um?.codeSynthese?.endsWith(String(s.dest[0].id).padStart(8, '0'))).toBe(true)
    expect(um?.codeSynthese?.slice(8, -8)).toBe(String(s.atelier.id).padStart(2, '0'))
    for (const x of [a, b, c]) {
      const l = await repLue(x.id)
      expect([l.uniteId, l.statut]).toEqual([um?.id, 'EN_COURS'])
    }
    const hist = await db.statutHistorique.findMany({
      where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(um?.id) },
    })
    expect(hist.map((h) => [h.ancien, h.nouveau, h.regle])).toEqual([
      [null, 'EN_COURS', 'RG-COO-261'],
    ])
    expect(
      await db.journalAudit.count({
        where: { action: 'CREATION_UNITE', entiteId: String(um?.id) },
      }),
    ).toBe(1)
    const histLigne = await db.statutHistorique.findMany({
      where: { typeEntite: 'REPARTITION', entiteId: String(a.id) },
    })
    expect(histLigne.map((h) => [h.ancien, h.nouveau])).toEqual([['A_TRAITER', 'EN_COURS']])
    // L'écran affiche le code et le statut de l'UM.
    const u = await lister(s)
    expect(u.lignes.find((l) => l.dossier === contNum)?.unite?.statut).toBe('EN_COURS')
  })

  it('RG-COO-260 un changement de destinataire, de dossier, de support, de thème ou de repiquage clôt l’UM : une UM par groupe', async () => {
    const s = await site(100)
    const c = numero()
    const base = { contNum: c, theme: 'T', qte: 5 }
    const lignes = [
      await ligne(s, { ...base }),
      await ligne(s, { ...base, dest: 1 }),
      await ligne(s, { ...base, contNum: c + 1 }),
      await ligne(s, { ...base, supportId: s.support2.id }),
      await ligne(s, { ...base, theme: 'Autre thème' }),
      await ligne(s, { ...base, repiquage: 'R2' }),
    ]
    const r = await colisage(s, lignes)
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(r.json()).traitees).toBe(6)
    const ums = await unites(s)
    expect(ums).toHaveLength(6)
    expect(new Set(ums.map((u) => u.codeBarre)).size).toBe(6)
    expect(ums.every((u) => u.qte === 5)).toBe(true)
  })

  it('RG-COO-260 une quantité supérieure à celle d’un support est scindée : 25 avec 10 par UM → 10, 10, 5 ; la quantité totale est conservée', async () => {
    const s = await site(10)
    const a = await ligne(s, { qte: 25, theme: 'Scindée' })
    const r = await colisage(s, [a])
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(r.json()).traitees).toBe(3)
    expect((await unites(s)).map((u) => u.qte)).toEqual([10, 10, 5])
    const reps = await db.repartition.findMany({
      where: { atelierId: s.atelier.id, theme: 'Scindée' },
      orderBy: { id: 'asc' },
    })
    expect(reps.map((x) => x.qte)).toEqual([10, 10, 5])
    expect(reps.every((x) => x.statut === 'EN_COURS' && x.uniteId !== null)).toBe(true)
    expect(reps[0]?.id).toBe(a.id) // la ligne d'origine est conservée (réduite)
    expect(new Set(reps.map((x) => x.uniteId)).size).toBe(3)
    // Les reliquats naissent « A traiter » avec leur historique.
    const hist = await db.statutHistorique.findMany({
      where: { typeEntite: 'REPARTITION', entiteId: String(reps[2]?.id) },
      orderBy: { id: 'asc' },
    })
    expect(hist.map((h) => [h.ancien, h.nouveau])).toEqual([
      [null, 'A_TRAITER'],
      ['A_TRAITER', 'EN_COURS'],
    ])
    // Poids de chaque UM = poids du support × quantité de l'UM.
    expect((await unites(s)).map((u) => Number(u.poids))).toEqual([20, 20, 10])
  })

  it('RG-COO-260 le découpage se poursuit d’une ligne à l’autre : 6 + 6 avec 10 par UM → 10 et 2', async () => {
    const s = await site(10)
    const c = numero()
    const a = await ligne(s, { contNum: c, theme: 'Suite', qte: 6 })
    const b = await ligne(s, { contNum: c, theme: 'Suite', qte: 6 })
    expect((await colisage(s, [a, b])).statusCode).toBe(200)
    expect((await unites(s)).map((u) => u.qte)).toEqual([10, 2])
    const reps = await db.repartition.findMany({ where: { atelierId: s.atelier.id } })
    expect(reps.reduce((x, y) => x + (y.qte ?? 0), 0)).toBe(12)
  })

  it('RG-COO-260 limites : quantité égale à celle de l’UM → une seule UM ; support sans quantité d’UM → pas de découpage', async () => {
    const s = await site(10)
    const a = await ligne(s, { qte: 10 })
    expect((await colisage(s, [a])).statusCode).toBe(200)
    expect((await unites(s)).map((u) => u.qte)).toEqual([10])
    const libre = await site(null)
    const b = await ligne(libre, { qte: 5000 })
    expect((await colisage(libre, [b])).statusCode).toBe(200)
    expect((await unites(libre)).map((u) => u.qte)).toEqual([5000])
  })

  it('RG-COO-261 un même code barre n’existe jamais deux fois sur plusieurs colisages', async () => {
    const s = await site(100)
    const a = await ligne(s)
    const b = await ligne(s)
    await colisage(s, [a])
    await colisage(s, [b])
    const ums = await unites(s)
    expect(new Set(ums.map((u) => u.codeBarre)).size).toBe(2)
  })

  it('RG-COO-260 une ligne « à libérer » (semaine non libérée) peut être colisée : le Colisage ne dépend pas de la libération (HYPOTHÈSE Q-404)', async () => {
    const s = await site(100)
    const a = await ligne(s)
    expect((await lister(s)).lignes[0]?.aLiberer).toBe(true)
    expect((await colisage(s, [a])).statusCode).toBe(200)
    expect(await db.liberationSemaine.count({ where: { atelierId: s.atelier.id } })).toBe(0)
  })
})

describe('RG-COO-262 seules les répartitions « A traiter » entrent dans une UM (409 sinon)', () => {
  it.each(['EN_COURS', 'PREPARE', 'ANNULE', 'ERREUR', 'A_EXPEDIER', 'TERMINE'] as const)(
    'RG-COO-262 une ligne au statut %s est refusée : 409, rien n’est créé',
    async (statut) => {
      const s = await site(100)
      const l = await ligne(s, { statut })
      const r = await colisage(s, [l])
      expect(r.statusCode, statut).toBe(409)
      expect(erreur(r).regle).toBe('RG-COO-262')
      expect(await unites(s)).toHaveLength(0)
      expect((await repLue(l.id)).statut).toBe(statut)
    },
  )

  it('RG-COO-262 une ligne déjà rattachée à une UM est refusée (409) : « Retirer » d’abord', async () => {
    const s = await site(100)
    const a = await ligne(s)
    await colisage(s, [a])
    const dedans = await repLue(a.id)
    const r = await colisage(s, [dedans])
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-262')
    expect(await unites(s)).toHaveLength(1)
  })

  it('RG-COO-262 sélection mixte : une seule ligne invalide annule TOUT (aucune UM, la bonne ligne reste A traiter)', async () => {
    const s = await site(100)
    const bonne = await ligne(s)
    const annulee = await ligne(s, { statut: 'ANNULE' })
    const r = await colisage(s, [bonne, annulee])
    expect(r.statusCode).toBe(409)
    expect(await unites(s)).toHaveLength(0)
    const apres = await repLue(bonne.id)
    expect([apres.statut, apres.uniteId, apres.version]).toEqual(['A_TRAITER', null, bonne.version])
  })

  it('RG-COO-275 une quantité nulle ne produit pas d’UM : 422 COO_QUANTITE_NULLE, rien n’est créé', async () => {
    const s = await site(100)
    const zero = await ligne(s, { qte: 0 })
    const r = await colisage(s, [zero])
    expect(r.statusCode).toBe(422)
    expect([erreur(r).code, erreur(r).regle]).toEqual(['COO_QUANTITE_NULLE', 'RG-COO-275'])
    expect(await unites(s)).toHaveLength(0)
  })

  it('RG-COO-260 version périmée : 409 COO_CONFLIT_VERSION ; ligne inconnue : 404 ; doublon dans la sélection ou sélection vide : 400', async () => {
    const s = await site(100)
    const l = await ligne(s)
    const perimee = await colisage(s, [{ id: l.id, version: l.version + 3 }])
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    expect((await colisage(s, [{ id: 999_999_999, version: 1 }])).statusCode).toBe(404)
    expect((await colisage(s, [l, l])).statusCode).toBe(400)
    expect((await post(s, 'colisage', { lignes: [] })).statusCode).toBe(400)
    expect(await unites(s)).toHaveLength(0)
  })
})

describe('RG-COO-260 droits, périmètre, idempotence, concurrence, atomicité', () => {
  it.each(['coord', 'cheq'] as const)(
    'RG-COO-260 le rôle %s crée les UM (unite.gerer) : 200',
    async (role) => {
      const s = await site(100)
      const l = await ligne(s)
      expect((await colisage(s, [l], role)).statusCode).toBe(200)
      expect(await unites(s)).toHaveLength(1)
    },
  )

  it.each(['recep', 'expe', 'com'] as const)(
    'RG-COO-260 le rôle %s ne crée pas d’UM : 403, rien d’écrit',
    async (role) => {
      const s = await site(100)
      const l = await ligne(s)
      const r = await colisage(s, [l], role)
      expect(r.statusCode, role).toBe(403)
      expect(await unites(s)).toHaveLength(0)
      expect((await repLue(l.id)).statut).toBe('A_TRAITER')
    },
  )

  it('RG-COO-260 hors périmètre : 403 COO_PERIMETRE_INTERDIT ; sans identité : 401', async () => {
    const s = await site(100)
    const l = await ligne(s)
    const hors = await envoyer(ctx, '/api/coordination/unitaire/colisage', s.ailleurs, {
      lignes: [ref(l)],
    })
    expect(hors.statusCode).toBe(403)
    expect(erreur(hors).code).toBe('COO_PERIMETRE_INTERDIT')
    const anonyme = await envoyer(
      ctx,
      '/api/coordination/unitaire/colisage',
      {},
      {
        lignes: [ref(l)],
      },
    )
    expect(anonyme.statusCode).toBe(401)
    expect(await unites(s)).toHaveLength(0)
  })

  it('RG-COO-260 idempotence : la même clé rejoue la réponse sans seconde UM ; sans clé : 400', async () => {
    const s = await site(100)
    const l = await ligne(s)
    const cle = idem()
    const corps = { lignes: [ref(l)] }
    const a = await post(s, 'colisage', corps, 'coord', cle)
    const b = await post(s, 'colisage', corps, 'coord', cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(await unites(s)).toHaveLength(1)
    const sansCle = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/unitaire/colisage',
      headers: s.users.coord.h,
      payload: corps,
    })
    expect(sansCle.statusCode).toBe(400)
  })

  it('RG-COO-260 concurrence : deux colisages simultanés des mêmes lignes → un gagnant (200), l’autre 409, une seule UM', async () => {
    const s = await site(100)
    const l = await ligne(s)
    const [a, b] = await Promise.all([colisage(s, [l]), colisage(s, [l], 'cheq')])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await unites(s)).toHaveLength(1)
  })

  it('RG-COO-261 atomicité : panne du journal en cours de création → aucune UM, aucun reliquat, lignes inchangées', async () => {
    const s = await site(10)
    const a = await ligne(s, { qte: 25 })
    const b = await ligne(s, { theme: 'Autre', qte: 4 })
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () => colisage(s, [a, b]))
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await unites(s)).toHaveLength(0)
    expect(await db.repartition.count({ where: { atelierId: s.atelier.id } })).toBe(2)
    const apres = await repLue(a.id)
    expect([apres.qte, apres.statut, apres.version]).toEqual([25, 'A_TRAITER', a.version])
    expect((await colisage(s, [a, b])).statusCode).toBe(200)
  })

  it('RG-COO-261 atomicité : panne de l’historique de statut d’une ligne → rien n’est conservé', async () => {
    const s = await site(100)
    const l = await ligne(s)
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON statut_historique WHEN NEW.typeEntite = 'REPARTITION'",
      () => colisage(s, [l]),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await unites(s)).toHaveLength(0)
    expect((await repLue(l.id)).statut).toBe('A_TRAITER')
  })
})

// ───────────────────────── La suite du parcours démontrée sur des UM réellement créées ─────────────────────────

describe('RG-COO-248 / 249 / 250 le parcours complet fonctionne sur des UM créées par le Colisage', () => {
  it('RG-COO-250 Colisage → Préparer : l’UM et ses lignes passent à Préparé ; plus de retrait ensuite (409)', async () => {
    const s = await site(100)
    const l = await ligne(s)
    await colisage(s, [l])
    const dedans = await repLue(l.id)
    const prep = await post(s, 'preparer', { lignes: [ref(dedans)] })
    expect(prep.statusCode, prep.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(prep.json()).traitees).toBe(1)
    expect((await unites(s))[0]?.statut).toBe('PREPARE')
    expect((await repLue(l.id)).statut).toBe('PREPARE')
    const retrait = await post(s, 'retirer', { lignes: [ref(await repLue(l.id))] })
    expect(retrait.statusCode).toBe(409)
  })

  it('RG-COO-249 Colisage → Retirer : l’UM est supprimée, les lignes repassent A traiter et peuvent être recolisées', async () => {
    const s = await site(100)
    const l = await ligne(s)
    await colisage(s, [l])
    const retrait = await post(s, 'retirer', { lignes: [ref(await repLue(l.id))] })
    expect(retrait.statusCode, retrait.body).toBe(200)
    expect(await unites(s)).toHaveLength(0)
    const apres = await repLue(l.id)
    expect([apres.statut, apres.uniteId]).toEqual(['A_TRAITER', null])
    expect((await colisage(s, [apres])).statusCode).toBe(200)
  })

  it('RG-X-084 « Colisage » et « Préparer » donnent le même résultat avant et après la validation admin d’une affiche du dossier', async () => {
    const s = await site(100)
    const [a, b] = [
      await ligne(s, { theme: 'Avant val.' }),
      await ligne(s, { theme: 'Après val.' }),
    ]
    const attendue = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      contNum: b.contNum,
      theme: 'Après val.',
    })
    const affiche = await f.createAffiche(db, { validationAdmin: false })
    await f.createRattachement(db, {
      afficheId: affiche.id,
      ligneAttendueId: attendue.id,
      quantite: 5,
    })
    const issues: string[] = []
    // Ligne a : aucune affiche ; ligne b : affiche reçue mais non validée, puis validée.
    for (const l of [a, b]) {
      await colisage(s, [l])
      const prep = await post(s, 'preparer', { lignes: [ref(await repLue(l.id))] })
      issues.push(`${String(prep.statusCode)}:${(await repLue(l.id)).statut}`)
    }
    await db.affiche.update({ where: { id: affiche.id }, data: { validationAdmin: true } })
    const c = await ligne(s, { theme: 'Après val.', contNum: b.contNum ?? undefined })
    await colisage(s, [c])
    const prep = await post(s, 'preparer', { lignes: [ref(await repLue(c.id))] })
    issues.push(`${String(prep.statusCode)}:${(await repLue(c.id)).statut}`)
    expect(issues).toEqual(['200:PREPARE', '200:PREPARE', '200:PREPARE'])
    await db.afficheAttendue.deleteMany({ where: { ligneAttendueId: attendue.id } })
  })
})
