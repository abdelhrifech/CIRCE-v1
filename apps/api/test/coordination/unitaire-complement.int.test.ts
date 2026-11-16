// COO-P12 — tests d'INTÉGRATION COMPLÉMENTAIRES de l'écran « unitaire » (préparation 2 m² fixe, pliage, bus) :
// unitaire.int.test.ts n'est pas dupliqué. Aucun test unitaire : API réelle sur la base de test (test.db), données par
// les factories ; les données créées ici sont purgées dans l'afterAll.
//
// Source de l'attendu (les RÈGLES, pas le code) : docs/COORDINATION_REGLES_METIER.md RG-COO-124, 151, 167, 238 à 251,
// 290, 304 à 306, RG-X-081, RG-X-082 ; CLAUDE.md §6 (400 / 401 / 403 / 404 / 409 / 422, version, Idempotency-Key,
// transactions) ; hypothèses Q-196, Q-265 (option (c) : liberation-colisage.int.test.ts), Q-271, Q-279, Q-286, Q-375,
// Q-002, Q-287. Les écarts constatés sont marqués `it.fails` avec leur n° ANO (non reportés dans RAPPORT_TESTS.md).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  EncollerSchema,
  ResultatUnitaireSchema,
  SyntheseSchema,
  UnitaireSchema,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { StatutProduction } from '../../src/generated/prisma/client.ts'
import { realignerEntretien } from '../../src/modules/coordination/integration-flux.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get } from '../support/reception.ts'
import {
  avecEchec,
  envoyer,
  parametre,
  restaurerParametres,
  ROLES,
  ROLES_SANS_ADMIN,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx

type H = Record<string, string>
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const SEM = plus(semaineIsoDe(new Date()), 1)
const DEPART = formatSemaineIso(SEM)
const numero = () => 600_000 + Math.floor(Math.random() * 300_000)

// ───────────────────────── données isolées et purge ─────────────────────────

const PREFIXE = `CPL${String(Date.now())}`
const purge = { ateliers: [] as number[], plateformes: [] as number[], types: [] as number[] }

beforeAll(() => ctx.demarrer())
afterEach(restaurerParametres)
afterAll(async () => {
  // Purge (ordre des clés étrangères) : répartitions, UM, rendus, encollages, destinataires et types en masse.
  const essayer = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch {
      // purge au mieux : la base de test est de toute façon recréée à chaque exécution
    }
  }
  await essayer(() => db.repartition.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() =>
    db.uniteManutention.deleteMany({ where: { atelierId: { in: purge.ateliers } } }),
  )
  await essayer(() => db.renduMain.deleteMany({ where: { atelierId: { in: purge.ateliers } } }))
  await essayer(() =>
    db.encollageBus.deleteMany({ where: { plateformeId: { in: purge.plateformes } } }),
  )
  await essayer(() =>
    db.destinataire.deleteMany({ where: { nomOrigine: { startsWith: PREFIXE } } }),
  )
  await essayer(() => db.typePreparation.deleteMany({ where: { id: { in: purge.types } } }))
  await ctx.arreter()
})

/** Site de préparation : atelier FIXE (+ un second), trois types, deux destinataires, un utilisateur par rôle. */
async function siteFixe() {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
  const atelier2 = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
  const support = await f.createSupport(db, { nom: 'Format 2 m²' })
  const [typeFixe, typePliage, typeBus] = await Promise.all(
    ['2 m² fixe', 'Pliage', 'Bus'].map((libelle) =>
      db.typePreparation.create({ data: { libelle } }),
    ),
  )
  const dest = [
    await f.createDestinataire(db, { nom: `Dest A ${String(next())}` }),
    await f.createDestinataire(db, { nom: `Dest B ${String(next())}` }),
  ] as const
  const users = {} as Record<Role, { id: number; headers: H }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne) }
  }
  purge.ateliers.push(atelier.id, atelier2.id)
  purge.plateformes.push(plateforme.id)
  purge.types.push(typeFixe?.id ?? 0, typePliage?.id ?? 0, typeBus?.id ?? 0)
  return {
    plateforme,
    atelier,
    atelier2,
    support,
    typeFixe: typeFixe as { id: number },
    typePliage: typePliage as { id: number },
    typeBus: typeBus as { id: number },
    dest,
    users,
  }
}
type Site = Awaited<ReturnType<typeof siteFixe>>

async function typesParam(...sites: Site[]) {
  await parametre(ctx, 'unitaire.typesPliage', sites.map((x) => x.typePliage.id).join(';'))
  await parametre(ctx, 'unitaire.typesBus', sites.map((x) => x.typeBus.id).join(';'))
}

interface OptLigne {
  type?: 'typeFixe' | 'typePliage' | 'typeBus'
  contNum?: number
  theme?: string
  annonceur?: string
  qte?: number
  statut?: StatutProduction
  dest?: 0 | 1
  um?: { id: number } | null
  semaine?: { annee: number; semaine: number }
  repiquage?: string | null
  atelierId?: number
  extra?: Record<string, unknown>
}
async function ligne(s: Site, o: OptLigne = {}) {
  const sem = o.semaine ?? SEM
  return f.createRepartition(db, {
    atelierId: o.atelierId ?? s.atelier.id,
    typePreparationId: s[o.type ?? 'typeFixe'].id,
    supportId: s.support.id,
    destinataireId: s.dest[o.dest ?? 0].id,
    contNum: o.contNum ?? numero(),
    theme: o.theme ?? `Thème ${String(next())}`,
    annonceur: o.annonceur ?? 'ANNONCEUR',
    qte: o.qte ?? 10,
    statut: o.statut ?? 'A_TRAITER',
    semAnnee: sem.annee,
    semNum: sem.semaine,
    repiquage: o.repiquage ?? null,
    ...(o.um ? { uniteId: o.um.id } : {}),
    ...(o.extra ?? {}),
  })
}
/** UM « En cours » avec sa répartition « En cours » (ligne prête à retirer / préparer). */
async function ligneAvecUm(s: Site, o: OptLigne & { umStatut?: StatutProduction } = {}) {
  const um = await f.createUniteManutention(db, {
    atelierId: s.atelier.id,
    statut: o.umStatut ?? 'EN_COURS',
  })
  const r = await ligne(s, { statut: 'EN_COURS', ...o, um })
  return { um, r }
}
/** Ligne d'un dossier dont l'instruction porte le % d'entretien demandé (repris de Broadcast, RG-COO-238). */
async function ligneAvecPct(s: Site, qte: number, pct: number, o: OptLigne = {}) {
  const dossier = await f.createDossier(db, {})
  await f.createInstruction(db, {
    dossierId: dossier.id,
    contNum: dossier.contNum,
    atelierId: s.atelier.id,
    entretien: pct,
  })
  return ligne(s, { ...o, contNum: dossier.contNum, qte })
}

const q = (s: Site, qs = '', role: Role = 'coord') =>
  get(ctx, `/api/coordination/unitaire${qs}`, s.users[role].headers)
const lister = async (s: Site, qs = '', role: Role = 'coord') => {
  const r = await q(s, qs, role)
  expect(r.statusCode, r.body).toBe(200)
  return UnitaireSchema.parse(r.json())
}
const synthese = (s: Site, qs = '', role: Role = 'coord') =>
  get(ctx, `/api/coordination/unitaire/synthese${qs}`, s.users[role].headers)
const encoller = (s: Site, qs: string, role: Role = 'coord') =>
  get(ctx, `/api/coordination/unitaire/encoller${qs}`, s.users[role].headers)
const ref = (r: { id: number; version: number }) => ({ id: r.id, version: r.version })
const postH = (headers: H, chemin: string, payload: unknown, cle?: H) =>
  envoyer(ctx, `/api/coordination/unitaire/${chemin}`, headers, payload, cle)
const post = (s: Site, chemin: string, payload: unknown, role: Role = 'coord', cle?: H) =>
  postH(s.users[role].headers, chemin, payload, cle)
const repLue = (id: number) => db.repartition.findUniqueOrThrow({ where: { id } })
const umLue = (id: number) => db.uniteManutention.findUnique({ where: { id } })
const refActuelle = async (id: number) => ref(await repLue(id))
const cleIdem = (p: string) => ({
  'idempotency-key': `${p}-${String(next())}-${String(Date.now())}`,
})
const idsDe = (u: { lignes: { refs: { id: number }[] }[] }) =>
  u.lignes.flatMap((l) => l.refs.map((x) => x.id)).sort((a, b) => a - b)

// ───────────────────────── RG-COO-238 : entretien à l'afficheur (limites) ─────────────────────────

describe('RG-COO-238 entretien à l’afficheur : valeurs limites', () => {
  it('RG-COO-238 quantités 0, 1, 2 (sous le seuil de 3) : aucun entretien, total = quantité', async () => {
    const s = await siteFixe()
    for (const qte of [0, 1, 2]) await ligne(s, { qte, theme: `Seuil-${String(qte)}` })
    const { lignes } = await lister(s)
    for (const qte of [0, 1, 2]) {
      const l = lignes.find((x) => x.theme === `Seuil-${String(qte)}`)
      expect([l?.entretien, l?.total], `qte ${String(qte)}`).toEqual([0, qte])
    }
  })

  it('RG-COO-238 arrondi supérieur au % de l’instruction : 0 %, 7 %, 10 %, 15 %, 30 % et pourcentages hors cadre', async () => {
    const s = await siteFixe()
    // [quantité, %, entretien attendu] : ceil(q × % / 100) avec minimum 1 dès le seuil.
    const cas: [number, number, number][] = [
      [3, 30, 1], // ceil(0,9)
      [7, 30, 3], // ceil(2,1)
      [10, 30, 3], // 3,00 pile
      [10, 0, 1], // minimum 1 même à 0 %
      [29, 10, 3], // ceil(2,9)
      [30, 10, 3], // 3,00 pile
      [31, 10, 4], // ceil(3,1)
      [19, 15, 3], // ceil(2,85)
      [200, 15, 30], // 30,00 pile (flottant)
      [1000, 7, 70], // 70,00 pile
      [1001, 7, 71], // ceil(70,07)
      [10, 45, 5], // le client envoie ce qu'il veut (au-delà de 30 %)
    ]
    for (const [i, [qte, pct]] of cas.entries())
      await ligneAvecPct(s, qte, pct, { theme: `Pct-${String(i)}` })
    const { lignes } = await lister(s)
    for (const [i, [qte, pct, attendu]] of cas.entries()) {
      const l = lignes.find((x) => x.theme === `Pct-${String(i)}`)
      expect(l?.entretien, `${String(qte)} à ${String(pct)} %`).toBe(attendu)
      expect(l?.total).toBe(qte + attendu)
      expect(l?.pourcentageEntretien).toBe(pct)
    }
  })

  it('RG-COO-238 arrondi « proche » (paramètre) : 0,96 → 1, 1,6 → 2, 8,4 → 8 ; minimum 1 dès le seuil', async () => {
    const s = await siteFixe()
    await parametre(ctx, 'trains.entretienArrondi', 'PROCHE')
    const cas: [number, number, number][] = [
      [12, 8, 1], // 0,96
      [20, 8, 2], // 1,6
      [50, 8, 4], // 4,00
      [100, 8, 8], // 8,00
      [3, 8, 1], // 0,24 → 0 → minimum 1
      [2, 8, 0], // sous le seuil
    ]
    for (const [i, [qte, pct]] of cas.entries())
      await ligneAvecPct(s, qte, pct, { theme: `Pr-${String(i)}` })
    const { lignes } = await lister(s)
    for (const [i, [, , attendu]] of cas.entries())
      expect(lignes.find((x) => x.theme === `Pr-${String(i)}`)?.entretien).toBe(attendu)
  })

  it('RG-COO-238 le seuil est un paramètre : seuil 10 → 9 affiches sans entretien, 10 affiches avec', async () => {
    const s = await siteFixe()
    await parametre(ctx, 'trains.entretienSeuil', '10')
    await ligne(s, { qte: 9, theme: 'Neuf' })
    await ligne(s, { qte: 10, theme: 'Dix' })
    const { lignes } = await lister(s)
    expect(lignes.find((l) => l.theme === 'Neuf')?.entretien).toBe(0)
    expect(lignes.find((l) => l.theme === 'Dix')?.entretien).toBe(1)
  })

  it('RG-COO-238 l’instruction annulée n’impose pas son % : retour au défaut de 8 %', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, {})
    await f.createInstruction(db, {
      dossierId: dossier.id,
      contNum: dossier.contNum,
      atelierId: s.atelier.id,
      entretien: 25,
      statut: 'ANNULE',
    })
    await ligne(s, { contNum: dossier.contNum, qte: 100 })
    const [l] = (await lister(s, `?dossier=${String(dossier.contNum)}`)).lignes
    expect([l?.pourcentageEntretien, l?.entretien]).toEqual([8, 8])
  })

  it('RG-COO-238 le grain est l’afficheur : deux afficheurs à 2 affiches = 0 entretien chacun ; deux lignes d’un même afficheur sont additionnées', async () => {
    const s = await siteFixe()
    const contNum = numero()
    await ligne(s, { contNum, theme: 'Grain', qte: 2, dest: 0 })
    await ligne(s, { contNum, theme: 'Grain', qte: 2, dest: 1 })
    const separes = (await lister(s, `?dossier=${String(contNum)}`)).lignes
    expect(separes.map((l) => [l.qte, l.entretien])).toEqual([
      [2, 0],
      [2, 0],
    ])
    // Vrac + Roulée du même afficheur : une seule ligne de 4 (≥ seuil) → entretien 1.
    const fusion = numero()
    await ligne(s, { contNum: fusion, theme: 'Fusion', qte: 2, dest: 0 })
    await ligne(s, { contNum: fusion, theme: 'Fusion', qte: 2, dest: 0 })
    const [l] = (await lister(s, `?dossier=${String(fusion)}`)).lignes
    expect([l?.refs.length, l?.qte, l?.entretien, l?.total]).toEqual([2, 4, 1, 5])
  })

  it('RG-COO-238 l’entretien est calculé aussi pour le pliage et le bus (titre de la règle : fixe, pliage, bus)', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typePliage', qte: 50 })
    await ligne(s, { type: 'typeBus', qte: 50 })
    for (const type of ['pliage', 'bus']) {
      const [l] = (await lister(s, `?type=${type}`)).lignes
      expect([l?.type, l?.qte, l?.entretien, l?.total], type).toEqual([type, 50, 4, 54])
    }
  })

  it('RG-COO-238 / 239 la modification de la quantité recalcule l’entretien et le total affichés', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 100 })
    expect((await lister(s)).lignes[0]).toMatchObject({ qte: 100, entretien: 8, total: 108 })
    expect((await post(s, 'quantite', { ...ref(r), quantite: 20 })).statusCode).toBe(200)
    expect((await lister(s)).lignes[0]).toMatchObject({ qte: 20, entretien: 2, total: 22 })
    const r2 = await refActuelle(r.id)
    expect((await post(s, 'quantite', { ...r2, quantite: 0 })).statusCode).toBe(200)
    expect((await lister(s)).lignes[0]).toMatchObject({ qte: 0, entretien: 0, total: 0 })
  })
})

// ───────────────────────── RG-COO-239 : quantité à produire (limites) ─────────────────────────

describe('RG-COO-239 quantité à produire : limites, états, versions', () => {
  it('RG-COO-239 corps invalide : identifiant ≤ 0, version négative, quantité absente : 400, rien n’est écrit', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 20 })
    for (const corps of [
      { id: 0, version: r.version, quantite: 5 },
      { id: -3, version: r.version, quantite: 5 },
      { id: r.id, version: -1, quantite: 5 },
      { id: r.id, version: r.version },
      { version: r.version, quantite: 5 },
      {},
    ])
      expect((await post(s, 'quantite', corps)).statusCode, JSON.stringify(corps)).toBe(400)
    expect((await repLue(r.id)).qte).toBe(20)
  })

  it('RG-COO-239 quantités extrêmes : entier 32 bits accepté, au-delà jamais d’erreur serveur (pas de 500)', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 20 })
    expect((await post(s, 'quantite', { ...ref(r), quantite: 2_147_483_647 })).statusCode).toBe(200)
    expect((await repLue(r.id)).qte).toBe(2_147_483_647)
    const apres = await refActuelle(r.id)
    const trop = await post(s, 'quantite', { ...apres, quantite: 2_147_483_648 })
    expect(trop.statusCode, trop.body).toBeLessThan(500)
    expect((await post(s, 'quantite', { ...apres, quantite: Number.NaN })).statusCode).toBe(400)
    expect(
      (await post(s, 'quantite', { ...apres, quantite: Number.POSITIVE_INFINITY })).statusCode,
    ).toBe(400)
  })

  it('RG-COO-239 unité en production (Préparé, À expédier, Terminé, Export, Au roulage) : 409 point de non-retour ; annulée ou en erreur : 409', async () => {
    const s = await siteFixe()
    for (const statut of [
      'PREPARE',
      'A_EXPEDIER',
      'TERMINE',
      'EXPORT_PREPA',
      'AU_ROULAGE',
    ] as const) {
      const r = await ligne(s, { statut, qte: 10 })
      const res = await post(s, 'quantite', { ...ref(r), quantite: 99 })
      expect(res.statusCode, statut).toBe(409)
      expect(erreur(res).regle).toBe('RG-COO-223')
      expect((await repLue(r.id)).qte).toBe(10)
    }
    for (const statut of ['ANNULE', 'ERREUR'] as const) {
      const r = await ligne(s, { statut })
      const res = await post(s, 'quantite', { ...ref(r), quantite: 99 })
      expect(res.statusCode, statut).toBe(409)
      expect(erreur(res).code).toBe('TRANSITION_INTERDITE')
    }
  })

  it('RG-COO-239 une ligne « En cours » dans une UM se modifie ; une ligne « A traiter » sans UM aussi', async () => {
    const s = await siteFixe()
    const { r: avecUm } = await ligneAvecUm(s)
    const sansUm = await ligne(s)
    for (const r of [avecUm, sansUm])
      expect((await post(s, 'quantite', { ...ref(r), quantite: 33 })).statusCode).toBe(200)
  })

  it('RG-COO-239 la version avance de 1 à chaque écriture ; l’ancienne version est refusée (409), la nouvelle acceptée', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 10 })
    expect((await post(s, 'quantite', { ...ref(r), quantite: 11 })).statusCode).toBe(200)
    const perimee = await post(s, 'quantite', { ...ref(r), quantite: 12 })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    expect((await repLue(r.id)).qte).toBe(11)
    const v2 = await refActuelle(r.id)
    expect(v2.version).toBe(r.version + 1)
    expect((await post(s, 'quantite', { ...v2, quantite: 12 })).statusCode).toBe(200)
    expect((await repLue(r.id)).version).toBe(r.version + 2)
  })
})

// ───────────────────────── RG-COO-244 / RG-X-082 : corriger l'intitulé (compléments) ─────────────────────────

describe('RG-COO-244 / RG-X-082 corriger l’intitulé : compléments', () => {
  async function jeu(s: Site, o: { mail?: string } = {}) {
    if (o.mail !== undefined)
      await db.plateforme.update({ where: { id: s.plateforme.id }, data: { mail: o.mail } })
    const contNum = numero()
    const a = await ligne(s, { contNum, theme: 'Thème X', annonceur: 'ANN', dest: 0 })
    const b = await ligne(s, { contNum, theme: 'Thème X', annonceur: 'ANN', dest: 1 })
    const autre = await ligne(s, { contNum, theme: 'Thème Y', annonceur: 'ANN' })
    const attendue = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème X',
    })
    const attendueY = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème Y',
    })
    const affiche = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème X',
    })
    const rattachement = await f.createRattachement(db, {
      afficheId: affiche.id,
      ligneAttendueId: attendue.id,
      quantite: 5,
    })
    const afficheY = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème Y',
    })
    await f.createRattachement(db, {
      afficheId: afficheY.id,
      ligneAttendueId: attendueY.id,
      quantite: 5,
    })
    return { contNum, a, b, autre, affiche, afficheY, rattachement }
  }
  const afficheLue = (id: number) => db.affiche.findUniqueOrThrow({ where: { id } })

  it('RG-COO-244 les espaces autour des valeurs sont ôtés ; changer la seule casse est une modification', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    const res = await post(s, 'corriger-intitule', {
      ...ref(j.a),
      annonceur: '  ANN  ',
      theme: '  THÈME X  ',
    })
    expect(res.statusCode, res.body).toBe(200)
    expect((await repLue(j.a.id)).theme).toBe('THÈME X')
    expect((await repLue(j.a.id)).annonceur).toBe('ANN')
  })

  it('RG-COO-244 seul l’annonceur change, ou seul le thème : appliqué à toutes les unités du thème', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    expect(
      (
        await post(s, 'corriger-intitule', {
          ...ref(j.a),
          annonceur: 'AUTRE ANN',
          theme: 'Thème X',
        })
      ).statusCode,
    ).toBe(200)
    for (const id of [j.a.id, j.b.id]) {
      expect((await repLue(id)).annonceur).toBe('AUTRE ANN')
      expect((await repLue(id)).theme).toBe('Thème X')
    }
    expect((await repLue(j.autre.id)).annonceur).toBe('ANN')
    const a2 = await refActuelle(j.a.id)
    expect(
      (await post(s, 'corriger-intitule', { ...a2, annonceur: 'AUTRE ANN', theme: 'Thème X2' }))
        .statusCode,
    ).toBe(200)
    for (const id of [j.a.id, j.b.id]) expect((await repLue(id)).theme).toBe('Thème X2')
  })

  it('RG-COO-244 la correction ne déborde pas sur un autre site (même dossier, même thème)', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const contNum = numero()
    const ici = await ligne(s, { contNum, theme: 'Commun' })
    const ailleurs = await ligne(autre, { contNum, theme: 'Commun' })
    expect(
      (await post(s, 'corriger-intitule', { ...ref(ici), annonceur: 'N', theme: 'Nouveau' }))
        .statusCode,
    ).toBe(200)
    expect((await repLue(ailleurs.id)).theme).toBe('Commun')
    expect((await repLue(ailleurs.id)).corrigeePlateforme).toBe(false)
  })

  it('RG-COO-244 la ligne corrigée porte le repère « corrigé par la plateforme » dans la liste et change de regroupement', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    await post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'ANN', theme: 'Thème Y' })
    const { lignes } = await lister(s, `?dossier=${String(j.contNum)}`)
    expect(lignes.every((l) => l.corrigeePlateforme || l.theme === 'Thème Y')).toBe(true)
    // Les unités corrigées (A, B) et la ligne Y existante partagent désormais le thème : une ligne par destinataire.
    expect(lignes.filter((l) => l.theme === 'Thème Y' && l.corrigeePlateforme).length).toBe(2)
    expect(lignes.some((l) => l.theme === 'Thème X')).toBe(false)
  })

  it('RG-X-082 « Feuille à refaire » uniquement sur les affiches rattachées du thème (pas l’autre thème, pas un rattachement inactif, pas un autre site)', async () => {
    const s = await siteFixe()
    const autreSite = await siteFixe()
    const j = await jeu(s)
    // Un rattachement inactif et une affiche du même dossier / thème sur un autre site ne sont pas touchés.
    const inactive = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: j.contNum,
      theme: 'Thème X',
    })
    const ligneX = await db.receptionAttendue.findFirstOrThrow({
      where: { plateformeId: s.plateforme.id, contNum: j.contNum, theme: 'Thème X' },
    })
    await f.createRattachement(db, {
      afficheId: inactive.id,
      ligneAttendueId: ligneX.id,
      quantite: 5,
      actif: false,
    })
    const ailleurs = await f.createAffiche(db, {
      plateformeId: autreSite.plateforme.id,
      supportId: autreSite.support.id,
      contNum: j.contNum,
      theme: 'Thème X',
    })
    const ligneAilleurs = await f.createReceptionAttendue(db, {
      plateformeId: autreSite.plateforme.id,
      supportId: autreSite.support.id,
      contNum: j.contNum,
      theme: 'Thème X',
    })
    await f.createRattachement(db, {
      afficheId: ailleurs.id,
      ligneAttendueId: ligneAilleurs.id,
      quantite: 5,
    })
    const res = await post(s, 'corriger-intitule', {
      ...ref(j.a),
      annonceur: 'ANN',
      theme: 'Thème X bis',
    })
    expect(res.statusCode, res.body).toBe(200)
    expect((await afficheLue(j.affiche.id)).feuilleARefaire).toBe(true)
    expect((await afficheLue(j.affiche.id)).version).toBe(j.affiche.version + 1)
    expect((await afficheLue(j.afficheY.id)).feuilleARefaire).toBe(false)
    expect((await afficheLue(inactive.id)).feuilleARefaire).toBe(false)
    expect((await afficheLue(ailleurs.id)).feuilleARefaire).toBe(false)
    const trace = await db.journalAudit.findFirst({
      where: {
        typeEntite: 'AFFICHE',
        entiteId: String(j.affiche.id),
        action: 'MODIFICATION_THEME',
      },
    })
    expect(trace?.nouvelleValeur).toBe('Thème X bis')
    expect(trace?.parId).toBe(s.users.coord.id)
  })

  it('RG-X-082 la correction ne modifie pas la validation admin ni le rattachement des affiches', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    await db.affiche.update({ where: { id: j.affiche.id }, data: { validationAdmin: true } })
    const avant = await db.afficheAttendue.findUniqueOrThrow({ where: { id: j.rattachement.id } })
    await post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'ANN', theme: 'Autre thème' })
    const apres = await afficheLue(j.affiche.id)
    expect([apres.validationAdmin, apres.statut]).toEqual([true, 'IDENTIFIEE'])
    const lien = await db.afficheAttendue.findUniqueOrThrow({ where: { id: j.rattachement.id } })
    expect([lien.actif, lien.quantite, lien.ligneAttendueId]).toEqual([
      avant.actif,
      avant.quantite,
      avant.ligneAttendueId,
    ])
  })

  it('RG-COO-244 la case « Prévenir la Pré-Prod » est cochée par défaut ; adresse blanche : « sans destinataire » ; aucun envoi réel (Q-375)', async () => {
    const s = await siteFixe()
    const j = await jeu(s, { mail: 'preprod@site.test' })
    const defaut = await post(s, 'corriger-intitule', {
      ...ref(j.a),
      annonceur: 'ANN',
      theme: 'Par défaut',
    })
    expect(ResultatUnitaireSchema.parse(defaut.json()).mailStatut).toBe('NON_ENVOYE')
    // D-19 : le mail « Pré-Prod » est mis en file (jamais envoyé dans la requête).
    expect(
      await db.mailFile.count({
        where: {
          type: 'CORRECTION_INTITULE',
          destinataires: 'preprod@site.test',
          statut: 'EN_ATTENTE',
        },
      }),
    ).toBeGreaterThanOrEqual(1)
    const s2 = await siteFixe()
    const j2 = await jeu(s2, { mail: '   ' })
    const blanc = await post(s2, 'corriger-intitule', {
      ...ref(j2.a),
      annonceur: 'ANN',
      theme: 'Adresse blanche',
    })
    expect(ResultatUnitaireSchema.parse(blanc.json()).mailStatut).toBe('SANS_DESTINATAIRE')
    expect(await db.mailFile.count({ where: { sujet: { contains: 'Adresse blanche' } } })).toBe(0)
  })

  it('RG-COO-244 longueur : 200 caractères acceptés, 201 refusés (400) ; type invalide : 400', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    const long = (n: number) => 'x'.repeat(n)
    expect(
      (await post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'A', theme: long(201) }))
        .statusCode,
    ).toBe(400)
    expect(
      (await post(s, 'corriger-intitule', { ...ref(j.a), annonceur: long(201), theme: 'T' }))
        .statusCode,
    ).toBe(400)
    expect(
      (await post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 5, theme: 'T' })).statusCode,
    ).toBe(400)
    expect(
      (await post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'A', theme: long(200) }))
        .statusCode,
    ).toBe(200)
  })

  it('RG-COO-244 deux corrections simultanées de la même version : une réussit, l’autre 409', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    const [x, y] = await Promise.all([
      post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'ANN', theme: 'Course 1' }),
      post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'ANN', theme: 'Course 2' }),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    expect(['Course 1', 'Course 2']).toContain((await repLue(j.b.id)).theme)
  })

  it('RG-COO-244 / RG-X-082 atomicité : une panne au journal d’une affiche annule les unités, les affiches et le journal du dossier', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(j.affiche.id)}' AND NEW.action = 'MODIFICATION_THEME'`,
      () => post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'Z', theme: 'Z' }),
    )
    expect(echec.statusCode).toBe(500)
    for (const id of [j.a.id, j.b.id]) {
      expect((await repLue(id)).theme).toBe('Thème X')
      expect((await repLue(id)).corrigeePlateforme).toBe(false)
      expect((await repLue(id)).version).toBe(j.a.version)
    }
    expect((await afficheLue(j.affiche.id)).feuilleARefaire).toBe(false)
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'REPARTITION',
          entiteId: String(j.a.id),
          action: 'CORRECTION_INTITULE',
        },
      }),
    ).toBe(0)
    // Après la panne, la même requête réussit (aucun état résiduel).
    expect(
      (await post(s, 'corriger-intitule', { ...ref(j.a), annonceur: 'Z', theme: 'Z' })).statusCode,
    ).toBe(200)
  })

  it('RG-COO-244 idempotence : même clé, une seule correction et un seul journal de dossier', async () => {
    const s = await siteFixe()
    const j = await jeu(s)
    const cle = cleIdem('ci')
    const corps = { ...ref(j.a), annonceur: 'ANN', theme: 'Une fois' }
    const a = await post(s, 'corriger-intitule', corps, 'coord', cle)
    const b = await post(s, 'corriger-intitule', corps, 'coord', cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(b.json()).toEqual(a.json())
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'DOSSIER',
          entiteId: String(j.contNum),
          action: 'CORRECTION_INTITULE',
        },
      }),
    ).toBe(1)
    expect((await afficheLue(j.affiche.id)).version).toBe(j.affiche.version + 1)
  })
})

// ───────────────────────── RG-COO-243 / 151 / RG-X-081 : rendre la main (compléments) ─────────────────────────

describe('RG-COO-243 / 151 / RG-X-081 rendre la main : compléments', () => {
  it('RG-COO-243 une unité à Préparé, À expédier, Terminé, Export ou Au roulage n’est jamais rendue (point de non-retour) : 422, rien n’est écrit', async () => {
    const s = await siteFixe()
    for (const statut of [
      'PREPARE',
      'A_EXPEDIER',
      'TERMINE',
      'EXPORT_PREPA',
      'AU_ROULAGE',
    ] as const) {
      const sansUm = await ligne(s, { statut })
      const res = await post(s, 'rendre-la-main', { lignes: [ref(sansUm)] })
      expect(res.statusCode, statut).toBe(422)
      expect(erreur(res).code).toBe('COO_RIEN_A_RENDRE')
      expect(erreur(res).regle).toBe('RG-COO-243')
      expect((await repLue(sansUm.id)).rendueLe).toBeNull()
      expect((await repLue(sansUm.id)).statut).toBe(statut)
    }
    for (const umStatut of ['PREPARE', 'A_EXPEDIER', 'TERMINE'] as const) {
      const { um, r } = await ligneAvecUm(s, { umStatut, statut: 'EN_COURS' })
      const res = await post(s, 'rendre-la-main', { lignes: [ref(r)] })
      expect(res.statusCode, umStatut).toBe(422)
      expect(await umLue(um.id)).not.toBeNull()
      expect((await repLue(r.id)).uniteId).toBe(um.id)
    }
    expect(await db.renduMain.count({ where: { atelierId: s.atelier.id } })).toBe(0)
  })

  it('RG-COO-243 une sélection mixte (non lancée + lancée) rend les premières seulement et compte les secondes', async () => {
    const s = await siteFixe()
    const { um: umA, r: a } = await ligneAvecUm(s)
    const b = await ligne(s)
    const { um: umL, r: l1 } = await ligneAvecUm(s, { statut: 'PREPARE', umStatut: 'PREPARE' })
    const l2 = await ligne(s, { statut: 'A_EXPEDIER' })
    const res = await post(s, 'rendre-la-main', { lignes: [ref(a), ref(b), ref(l1), ref(l2)] })
    expect(res.statusCode, res.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json())).toMatchObject({ traitees: 2, enProduction: 2 })
    expect(await umLue(umA.id)).toBeNull()
    expect(await umLue(umL.id)).not.toBeNull()
    expect((await repLue(l1.id)).statut).toBe('PREPARE')
    expect((await repLue(l2.id)).statut).toBe('A_EXPEDIER')
    const rendu = await db.renduMain.findFirstOrThrow({ where: { atelierId: s.atelier.id } })
    expect(rendu.nbEnProduction).toBe(2)
    expect((JSON.parse(rendu.repartitions) as number[]).sort()).toEqual([a.id, b.id].sort())
  })

  it('RG-COO-243 toutes les répartitions d’une UM sont rendues avec elle, même celles hors sélection', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const sœur = await ligne(s, {
      statut: 'EN_COURS',
      um,
      contNum: r.contNum ?? undefined,
      theme: 'Sœur',
    })
    const res = await post(s, 'rendre-la-main', { lignes: [ref(r)] })
    expect(res.statusCode).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json()).traitees).toBe(2)
    for (const id of [r.id, sœur.id]) {
      const x = await repLue(id)
      expect([x.statut, x.uniteId]).toEqual(['A_TRAITER', null])
      expect(x.rendueLe).not.toBeNull()
    }
    expect(await umLue(um.id)).toBeNull()
  })

  it('RG-COO-243 deux dossiers : un historique et un journal par dossier ; le motif blanc retombe sur le motif par défaut ; 201 caractères : 400', async () => {
    const s = await siteFixe()
    const d1 = await f.createDossier(db, { statut: 'A_TRAITER' })
    const d2 = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const r1 = await ligne(s, { contNum: d1.contNum })
    const r2 = await ligne(s, { contNum: d2.contNum })
    const trop = await post(s, 'rendre-la-main', { lignes: [ref(r1)], motif: 'x'.repeat(201) })
    expect(trop.statusCode).toBe(400)
    const res = await post(s, 'rendre-la-main', { lignes: [ref(r1), ref(r2)], motif: '   ' })
    expect(res.statusCode, res.body).toBe(200)
    const rendu = await db.renduMain.findFirstOrThrow({ where: { atelierId: s.atelier.id } })
    expect(rendu.motif).toBe('Changement de visuel demandé par le client')
    expect((JSON.parse(rendu.dossiers) as number[]).sort()).toEqual([d1.contNum, d2.contNum].sort())
    for (const d of [d1, d2])
      expect(
        await db.journalAudit.count({
          where: { typeEntite: 'DOSSIER', entiteId: String(d.contNum), action: 'RENDU_MAIN_UNITE' },
        }),
      ).toBe(1)
  })

  it('RG-COO-151 / 243 le dossier « Préparation reçue » n’est pas réécrit ; une ligne dont le dossier n’existe pas en base ne bloque pas', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const r = await ligne(s, { contNum: dossier.contNum })
    const orphelin = await ligne(s, { contNum: 9_000_000 + next() })
    const res = await post(s, 'rendre-la-main', { lignes: [ref(r), ref(orphelin)] })
    expect(res.statusCode, res.body).toBe(200)
    const d = await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })
    expect([d.statut, d.version]).toEqual(['PREPARATION_RECUE', dossier.version])
  })

  it('RG-X-081 les affiches reçues, leur rattachement, la validation admin et la ligne attendue sont identiques avant et après (validée ET proposée)', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const cas = [
      { theme: 'Validée', valide: true },
      { theme: 'Proposée', valide: false },
    ]
    const lignesIds: number[] = []
    const affiches: number[] = []
    const liens: number[] = []
    const attendues: number[] = []
    for (const c of cas) {
      lignesIds.push((await ligne(s, { contNum: dossier.contNum, theme: c.theme })).id)
      const attendue = await f.createReceptionAttendue(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: dossier.contNum,
        theme: c.theme,
      })
      const a = await f.createAffiche(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: dossier.contNum,
        validationAdmin: c.valide,
      })
      liens.push(
        (
          await f.createRattachement(db, {
            afficheId: a.id,
            ligneAttendueId: attendue.id,
            quantite: 5,
          })
        ).id,
      )
      affiches.push(a.id)
      attendues.push(attendue.id)
    }
    const instantane = async () =>
      JSON.stringify({
        affiches: await db.affiche.findMany({
          where: { id: { in: affiches } },
          orderBy: { id: 'asc' },
        }),
        liens: await db.afficheAttendue.findMany({
          where: { id: { in: liens } },
          orderBy: { id: 'asc' },
        }),
        attendues: await db.receptionAttendue.findMany({
          where: { id: { in: attendues } },
          orderBy: { id: 'asc' },
        }),
      })
    const avant = await instantane()
    const lignes = await Promise.all(lignesIds.map(refActuelle))
    expect((await post(s, 'rendre-la-main', { lignes })).statusCode).toBe(200)
    expect(await instantane()).toBe(avant)
    // La liste affiche toujours l'indication (✓ / •) après le rendu.
    const parTheme = new Map((await lister(s)).lignes.map((l) => [l.theme, l.afficheRecue]))
    expect(parTheme.get('Validée')).toBe('VALIDEE')
    expect(parTheme.get('Proposée')).toBe('PROPOSEE')
  })

  it('RG-COO-243 rendre la main ne touche pas l’instruction du dossier', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const instruction = await f.createInstruction(db, {
      dossierId: dossier.id,
      contNum: dossier.contNum,
      atelierId: s.atelier.id,
      statut: 'INSTRUCTION_OK',
    })
    const r = await ligne(s, { contNum: dossier.contNum })
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] })).statusCode).toBe(200)
    const apres = await db.instruction.findUniqueOrThrow({ where: { code: instruction.code } })
    expect([apres.statut, apres.version]).toEqual(['INSTRUCTION_OK', instruction.version])
  })

  it('RG-COO-243 un rendu enregistre l’atelier, le motif et l’auteur ; il n’est pas rejouable sur une unité déjà rendue (version périmée : 409)', async () => {
    const s = await siteFixe()
    const { r } = await ligneAvecUm(s)
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] })).statusCode).toBe(200)
    const rendu = await db.renduMain.findFirstOrThrow({ where: { atelierId: s.atelier.id } })
    expect(rendu.parId).toBe(s.users.coord.id)
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] })).statusCode).toBe(409)
    expect(await db.renduMain.count({ where: { atelierId: s.atelier.id } })).toBe(1)
  })

  it('RG-COO-243 / 249 une UM qui contient une répartition déjà préparée n’est pas rendue ; une répartition annulée avec une UM « En cours » : jamais de suppression silencieuse', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    await ligne(s, { statut: 'PREPARE', um })
    const res = await post(s, 'rendre-la-main', { lignes: [ref(r)] })
    expect(res.statusCode).toBe(422)
    expect(await umLue(um.id)).not.toBeNull()
    expect((await repLue(r.id)).statut).toBe('EN_COURS')
  })

  it('RG-COO-243 / X-081 atomicité : une panne au journal du dossier (après l’enregistrement du rendu) annule tout', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, { statut: 'A_TRAITER' })
    const { um, r } = await ligneAvecUm(s, { contNum: dossier.contNum })
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(dossier.contNum)}' AND NEW.action = 'RENDU_MAIN_UNITE'`,
      () => post(s, 'rendre-la-main', { lignes: [ref(r)] }),
    )
    expect(echec.statusCode).toBe(500)
    expect(await db.renduMain.count({ where: { atelierId: s.atelier.id } })).toBe(0)
    expect(await umLue(um.id)).not.toBeNull()
    const apres = await repLue(r.id)
    expect([apres.statut, apres.uniteId, apres.rendueLe, apres.version]).toEqual([
      'EN_COURS',
      um.id,
      null,
      r.version,
    ])
    expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).statut).toBe(
      'A_TRAITER',
    )
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'REPARTITION', entiteId: String(r.id) },
      }),
    ).toBe(0)
  })

  it('RG-COO-243 une panne n’enregistre pas la clé d’idempotence : le rejeu avec la même clé réussit ensuite, une seule fois', async () => {
    const s = await siteFixe()
    const { r } = await ligneAvecUm(s)
    const cle = cleIdem('rm')
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON rendu_main WHEN NEW.dossiers LIKE '%${String(r.contNum)}%'`,
      () => post(s, 'rendre-la-main', { lignes: [ref(r)] }, 'coord', cle),
    )
    expect(echec.statusCode).toBe(500)
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] }, 'coord', cle)).statusCode).toBe(
      200,
    )
    expect((await post(s, 'rendre-la-main', { lignes: [ref(r)] }, 'coord', cle)).statusCode).toBe(
      200,
    )
    expect(await db.renduMain.count({ where: { atelierId: s.atelier.id } })).toBe(1)
  })

  it('RG-COO-243 une unité rendue réapparaît « A traiter » dans la liste, sans UM, avec le repère ; elle ne se prépare plus (aucune UM)', async () => {
    const s = await siteFixe()
    const { r } = await ligneAvecUm(s)
    await post(s, 'rendre-la-main', { lignes: [ref(r)] })
    const [l] = (await lister(s)).lignes
    expect([l?.statut, l?.unite, l?.rendue]).toEqual(['A_TRAITER', null, true])
    const apres = await refActuelle(r.id)
    const res = await post(s, 'preparer', { lignes: [apres] })
    expect(res.statusCode).toBe(409)
    expect(erreur(res).code).toBe('TRANSITION_INTERDITE')
  })
})

// ───────────────────────── RG-COO-249 / 250 / 247 : table de transitions ─────────────────────────

const TOUS_STATUTS: StatutProduction[] = [
  'A_TRAITER',
  'EN_COURS',
  'INSTRUCTION_OK',
  'ERREUR',
  'ANNULE',
  'A_IMPRIMER',
  'PREPARE',
  'A_EXPEDIER',
  'TERMINE',
  'EXPORT_PREPA',
  'AU_ROULAGE',
]

describe('RG-COO-249 / 250 transitions de la ligne de répartition et de l’UM (table explicite)', () => {
  it('RG-COO-249 transition autorisée : seul « En cours » (UM En cours) se retire (1 → 0) ; tous les autres statuts de ligne : 409, UM intacte', async () => {
    const s = await siteFixe()
    for (const statut of TOUS_STATUTS.filter((x) => x !== 'EN_COURS')) {
      const { um, r } = await ligneAvecUm(s, { statut })
      const res = await post(s, 'retirer', { lignes: [ref(r)] })
      expect(res.statusCode, `ligne ${statut}`).toBe(409)
      expect(erreur(res).code, `ligne ${statut}`).toBe('TRANSITION_INTERDITE')
      expect(erreur(res).regle).toBe('RG-COO-249')
      expect(await umLue(um.id), `ligne ${statut}`).not.toBeNull()
      const apres = await repLue(r.id)
      expect([apres.statut, apres.uniteId, apres.version]).toEqual([statut, um.id, r.version])
    }
    const { um, r } = await ligneAvecUm(s)
    expect((await post(s, 'retirer', { lignes: [ref(r)] })).statusCode).toBe(200)
    expect(await umLue(um.id)).toBeNull()
    expect((await repLue(r.id)).statut).toBe('A_TRAITER')
  })

  it('RG-COO-249 une UM Préparé (6), À expédier (7) ou Terminé (8) ne se retire plus : 409, rien n’est écrit', async () => {
    const s = await siteFixe()
    for (const umStatut of ['PREPARE', 'A_EXPEDIER', 'TERMINE'] as const) {
      const { um, r } = await ligneAvecUm(s, { umStatut })
      const res = await post(s, 'retirer', { lignes: [ref(r)] })
      expect(res.statusCode, `UM ${umStatut}`).toBe(409)
      expect(await umLue(um.id), `UM ${umStatut}`).not.toBeNull()
      expect((await repLue(r.id)).statut).toBe('EN_COURS')
    }
  })

  // ANO-052 (corrigée) : l'UM « Annulé » (4) n'a pas de transition « Retirer » (§3.2 : seule la ligne 1 se retire) ;
  // retirerUnite refuse toute UM qui n'est pas « En cours » (409).
  it('RG-COO-249 ANO-052 une UM « Annulé » (4) ne se retire pas : 409, UM et ligne intactes', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s, { umStatut: 'ANNULE' })
    const res = await post(s, 'retirer', { lignes: [ref(r)] })
    expect(res.statusCode).toBe(409)
    expect(await umLue(um.id)).not.toBeNull()
    expect((await repLue(r.id)).statut).toBe('EN_COURS')
  })

  it('RG-COO-250 transition autorisée : UM « En cours » → « Préparé » (1 → 6) ; une UM « Préparé » reste inchangée (idempotent)', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const res = await post(s, 'preparer', { lignes: [ref(r)] })
    expect(res.statusCode).toBe(200)
    expect((await umLue(um.id))?.statut).toBe('PREPARE')
    const apres = await refActuelle(r.id)
    const bis = await post(s, 'preparer', { lignes: [apres] })
    expect(bis.statusCode).toBe(200)
    expect(ResultatUnitaireSchema.parse(bis.json()).traitees).toBe(0)
    expect((await umLue(um.id))?.version).toBe(um.version + 1)
  })

  it('RG-COO-250 / Q-271 UM à Erreur, Annulé, À expédier, Terminé, Instruction OK, À imprimer, Export ou Au roulage : 409 (seul 1 → 6 est permis)', async () => {
    const s = await siteFixe()
    for (const umStatut of TOUS_STATUTS.filter((x) => x !== 'EN_COURS' && x !== 'PREPARE')) {
      const { um, r } = await ligneAvecUm(s, { umStatut })
      const res = await post(s, 'preparer', { lignes: [ref(r)] })
      expect(res.statusCode, `UM ${umStatut}`).toBe(409)
      expect(erreur(res).code).toBe('TRANSITION_INTERDITE')
      expect(erreur(res).regle).toBe('RG-COO-250')
      expect((await umLue(um.id))?.statut).toBe(umStatut)
      expect((await repLue(r.id)).statut).toBe('EN_COURS')
    }
  })

  it('RG-COO-250 la ligne rattachée à une UM « En cours » doit elle-même être « En cours » : « A traiter » ou « Erreur » : 409 (0 → 6, 3 → 6 interdites)', async () => {
    const s = await siteFixe()
    for (const statut of ['A_TRAITER', 'ERREUR', 'A_EXPEDIER', 'TERMINE'] as const) {
      const { um, r } = await ligneAvecUm(s, { statut })
      const res = await post(s, 'preparer', { lignes: [ref(r)] })
      expect(res.statusCode, statut).toBe(409)
      expect((await umLue(um.id))?.statut, statut).toBe('EN_COURS')
      expect((await repLue(r.id)).statut).toBe(statut)
    }
  })

  it('RG-COO-250 / 249 une répartition annulée rattachée à une UM « En cours » : refus 409, jamais de passage silencieux ni de 500', async () => {
    const s = await siteFixe()
    const a = await ligneAvecUm(s, { statut: 'ANNULE' })
    const preparer = await post(s, 'preparer', { lignes: [ref(a.r)] })
    expect(preparer.statusCode, preparer.body).toBe(409)
    expect((await umLue(a.um.id))?.statut).toBe('EN_COURS')
    const b = await ligneAvecUm(s, { statut: 'ANNULE' })
    const retirer = await post(s, 'retirer', { lignes: [ref(b.r)] })
    expect(retirer.statusCode, retirer.body).toBe(409)
    expect(await umLue(b.um.id)).not.toBeNull()
  })

  it('RG-COO-249 / 250 sélection de plusieurs UM dont une interdite : 409 pour toute la sélection, aucune UM modifiée', async () => {
    const s = await siteFixe()
    const ok = await ligneAvecUm(s)
    const ko = await ligneAvecUm(s, { umStatut: 'A_EXPEDIER' })
    for (const chemin of ['preparer', 'retirer']) {
      const res = await post(s, chemin, { lignes: [ref(ok.r), ref(ko.r)] })
      expect(res.statusCode, chemin).toBe(409)
      expect((await umLue(ok.um.id))?.statut).toBe('EN_COURS')
      expect((await repLue(ok.r.id)).statut).toBe('EN_COURS')
    }
  })

  it('RG-COO-249 / 250 chaque transition écrit son historique (ancien → nouveau, auteur, règle) pour la ligne et pour l’UM', async () => {
    const s = await siteFixe()
    const a = await ligneAvecUm(s)
    await post(s, 'preparer', { lignes: [ref(a.r)] }, 'cheq')
    const hRep = await db.statutHistorique.findFirstOrThrow({
      where: { typeEntite: 'REPARTITION', entiteId: String(a.r.id) },
    })
    expect([hRep.ancien, hRep.nouveau, hRep.regle, hRep.parId]).toEqual([
      'EN_COURS',
      'PREPARE',
      'RG-COO-250',
      s.users.cheq.id,
    ])
    const b = await ligneAvecUm(s)
    await post(s, 'retirer', { lignes: [ref(b.r)] }, 'coord')
    const hRet = await db.statutHistorique.findFirstOrThrow({
      where: { typeEntite: 'REPARTITION', entiteId: String(b.r.id) },
    })
    expect([hRet.ancien, hRet.nouveau, hRet.regle, hRet.parId]).toEqual([
      'EN_COURS',
      'A_TRAITER',
      'RG-COO-249',
      s.users.coord.id,
    ])
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'UNITE_MANUTENTION',
          entiteId: String(b.um.id),
          action: 'RETRAIT_UNITE',
        },
      }),
    ).toBe(1)
  })

  it('RG-COO-249 garde « UM dans un colis » (ligne réelle d’un colis) : refuse (409) le retrait ET le rendu de la main, sans écriture partielle', async () => {
    const s = await siteFixe()
    const ok = await ligneAvecUm(s)
    const colis = await ligneAvecUm(s)
    const c = await db.colis.create({
      data: {
        plateformeId: s.plateforme.id,
        atelierId: s.atelier.id,
        destinataireId: s.dest[0].id,
        statut: 'EN_COURS',
      },
    })
    await db.uniteColis.create({ data: { uniteId: colis.um.id, colisId: c.id, quantite: 1 } })
    for (const chemin of ['retirer', 'rendre-la-main']) {
      const res = await post(s, chemin, { lignes: [ref(ok.r), ref(colis.r)] })
      expect(res.statusCode, chemin).toBe(409)
      expect(erreur(res).code).toBe('COO_UM_DANS_COLIS')
      expect(await umLue(ok.um.id), chemin).not.toBeNull()
      expect((await repLue(ok.r.id)).statut).toBe('EN_COURS')
      expect(await umLue(colis.um.id)).not.toBeNull()
    }
    // La garde ne concerne que le retrait : la préparation d'une autre UM n'est pas gênée.
    expect((await post(s, 'preparer', { lignes: [ref(ok.r)] })).statusCode).toBe(200)
    // Une fois l'UM sortie du colis, le retrait passe.
    await db.uniteColis.deleteMany({ where: { colisId: c.id } })
    expect((await post(s, 'retirer', { lignes: [ref(colis.r)] })).statusCode).toBe(200)
    expect(await umLue(colis.um.id)).toBeNull()
    await db.colis.delete({ where: { id: c.id } })
  })

  it('RG-COO-249 une UM portée par deux lignes sélectionnées n’est retirée qu’une fois', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const sœur = await ligne(s, {
      statut: 'EN_COURS',
      um,
      contNum: r.contNum ?? undefined,
      theme: 'Sœur',
    })
    const res = await post(s, 'retirer', { lignes: [ref(r), ref(sœur)] })
    expect(res.statusCode, res.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json()).traitees).toBe(1)
    expect(await umLue(um.id)).toBeNull()
  })

  it('RG-COO-249 / 250 la sélection est validée avant toute écriture : inconnue (404), doublon (400), version périmée d’une seule ligne (409) : aucune ligne modifiée', async () => {
    const s = await siteFixe()
    const a = await ligneAvecUm(s)
    const b = await ligneAvecUm(s)
    for (const chemin of ['preparer', 'retirer']) {
      const perimee = await post(s, chemin, {
        lignes: [ref(a.r), { id: b.r.id, version: b.r.version + 1 }],
      })
      expect(perimee.statusCode, chemin).toBe(409)
      const inconnue = await post(s, chemin, {
        lignes: [ref(a.r), { id: 999_999_999, version: 1 }],
      })
      expect(inconnue.statusCode, chemin).toBe(404)
      expect((await umLue(a.um.id))?.statut).toBe('EN_COURS')
      expect((await repLue(a.r.id)).statut).toBe('EN_COURS')
    }
  })

  it('RG-COO-249 / 250 aucune validation admin ni affiche reçue n’est requise : lignes sans affiche, avec affiche seulement proposée, avec affiche validée', async () => {
    const s = await siteFixe()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    for (const mode of ['aucune', 'proposee', 'validee'] as const) {
      const a = await ligneAvecUm(s, { contNum: dossier.contNum, theme: `T-${mode}` })
      const b = await ligneAvecUm(s, { contNum: dossier.contNum, theme: `U-${mode}` })
      if (mode !== 'aucune') {
        for (const theme of [`T-${mode}`, `U-${mode}`]) {
          const attendue = await f.createReceptionAttendue(db, {
            plateformeId: s.plateforme.id,
            supportId: s.support.id,
            contNum: dossier.contNum,
            theme,
          })
          const aff = await f.createAffiche(db, {
            plateformeId: s.plateforme.id,
            supportId: s.support.id,
            contNum: dossier.contNum,
            validationAdmin: mode === 'validee',
          })
          await f.createRattachement(db, {
            afficheId: aff.id,
            ligneAttendueId: attendue.id,
            quantite: 5,
          })
        }
      }
      expect((await post(s, 'preparer', { lignes: [ref(a.r)] })).statusCode, mode).toBe(200)
      expect((await post(s, 'retirer', { lignes: [ref(b.r)] })).statusCode, mode).toBe(200)
      expect(
        (await post(s, 'quantite', { ...(await refActuelle(b.r.id)), quantite: 4 })).statusCode,
        mode,
      ).toBe(200)
    }
  })

  it('RG-COO-249 / 250 concurrence : « Préparer » et « Retirer » sur la même ligne et la même version : une réussit, l’autre 409, état cohérent', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const [x, y] = await Promise.all([
      post(s, 'preparer', { lignes: [ref(r)] }),
      post(s, 'retirer', { lignes: [ref(r)] }),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    const apres = await repLue(r.id)
    if (x.statusCode === 200)
      expect([apres.statut, (await umLue(um.id))?.statut]).toEqual(['PREPARE', 'PREPARE'])
    else expect([apres.statut, await umLue(um.id)]).toEqual(['A_TRAITER', null])
  })

  it('RG-COO-249 / 250 concurrence : deux « Préparer » (ou deux « Retirer ») simultanés de la même version : un seul passe', async () => {
    const s = await siteFixe()
    const a = await ligneAvecUm(s)
    const [p1, p2] = await Promise.all([
      post(s, 'preparer', { lignes: [ref(a.r)] }),
      post(s, 'preparer', { lignes: [ref(a.r)] }),
    ])
    expect([p1.statusCode, p2.statusCode].sort()).toEqual([200, 409])
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(a.um.id), nouveau: 'PREPARE' },
      }),
    ).toBe(1)
    const b = await ligneAvecUm(s)
    const [r1, r2] = await Promise.all([
      post(s, 'retirer', { lignes: [ref(b.r)] }),
      post(s, 'retirer', { lignes: [ref(b.r)] }),
    ])
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-COO-239 / 243 concurrence : « Rendre la main » et « Modifier la quantité » de la même version : une réussit, l’autre 409', async () => {
    const s = await siteFixe()
    const r = await ligne(s, { qte: 10 })
    const [x, y] = await Promise.all([
      post(s, 'rendre-la-main', { lignes: [ref(r)] }),
      post(s, 'quantite', { ...ref(r), quantite: 99 }),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-COO-250 atomicité : une panne sur la seconde UM annule aussi la première (préparation et retrait de plusieurs UM)', async () => {
    const s = await siteFixe()
    const a = await ligneAvecUm(s)
    const b = await ligneAvecUm(s)
    const prep = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(b.um.id)}' AND NEW.action = 'PREPARATION_UNITE'`,
      () => post(s, 'preparer', { lignes: [ref(a.r), ref(b.r)] }),
    )
    expect(prep.statusCode).toBe(500)
    for (const x of [a, b]) {
      expect((await umLue(x.um.id))?.statut).toBe('EN_COURS')
      expect((await repLue(x.r.id)).statut).toBe('EN_COURS')
    }
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(a.um.id) },
      }),
    ).toBe(0)
    const ret = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(b.um.id)}' AND NEW.action = 'RETRAIT_UNITE'`,
      () => post(s, 'retirer', { lignes: [ref(a.r), ref(b.r)] }),
    )
    expect(ret.statusCode).toBe(500)
    for (const x of [a, b]) {
      expect(await umLue(x.um.id)).not.toBeNull()
      expect((await repLue(x.r.id)).uniteId).toBe(x.um.id)
    }
  })

  it('RG-COO-250 idempotence : même clé, une seule préparation ; même clé avec un autre corps : 409 COO_IDEMPOTENCE_CONFLIT ; clé absente : 400', async () => {
    const s = await siteFixe()
    const a = await ligneAvecUm(s)
    const b = await ligneAvecUm(s)
    const cle = cleIdem('prep')
    const p1 = await post(s, 'preparer', { lignes: [ref(a.r)] }, 'coord', cle)
    const p2 = await post(s, 'preparer', { lignes: [ref(a.r)] }, 'coord', cle)
    expect([p1.statusCode, p2.statusCode]).toEqual([200, 200])
    expect(p2.json()).toEqual(p1.json())
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'UNITE_MANUTENTION',
          entiteId: String(a.um.id),
          action: 'PREPARATION_UNITE',
        },
      }),
    ).toBe(1)
    const autre = await post(s, 'preparer', { lignes: [ref(b.r)] }, 'coord', cle)
    expect(autre.statusCode).toBe(409)
    expect(erreur(autre).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect((await umLue(b.um.id))?.statut).toBe('EN_COURS')
    const sans = await post(s, 'preparer', { lignes: [ref(b.r)] }, 'coord', {})
    expect(sans.statusCode).toBe(400)
    expect(erreur(sans).code).toBe('IDEMPOTENCE_CLE_MANQUANTE')
  })

  it('RG-COO-250 deux requêtes simultanées avec la même clé : une seule écriture, jamais de 500', async () => {
    const s = await siteFixe()
    const a = await ligneAvecUm(s)
    const cle = cleIdem('simul')
    const [x, y] = await Promise.all([
      post(s, 'preparer', { lignes: [ref(a.r)] }, 'coord', cle),
      post(s, 'preparer', { lignes: [ref(a.r)] }, 'coord', cle),
    ])
    for (const res of [x, y]) expect([200, 409]).toContain(res.statusCode)
    expect(x.statusCode === 200 || y.statusCode === 200).toBe(true)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(a.um.id), nouveau: 'PREPARE' },
      }),
    ).toBe(1)
  })
})

// ───────────────────────── RG-COO-247 : comptage du pliage ─────────────────────────

describe('RG-COO-247 pliage : comptage (compléments)', () => {
  it('RG-COO-247 comptées au-dessus de l’attendu : écart signé négatif, message avec la valeur absolue, alerte au journal', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const { um, r } = await ligneAvecUm(s, { type: 'typePliage', qte: 50 }) // attendu 54
    const res = await post(s, 'comptage', { lignes: [ref(r)], comptees: 60 })
    expect(res.statusCode, res.body).toBe(200)
    const body = ResultatUnitaireSchema.parse(res.json())
    expect(body.message).toBe('Écart de comptage : 6 affiche(s). Alerte qualité créée.')
    expect(body.ecart).toBe(-6)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(um.id), action: 'COMPTAGE_PLIAGE' },
      }),
    ).toBe(1)
    expect((await umLue(um.id))?.statut).toBe('PREPARE')
  })

  it('RG-COO-247 comptées = 0 pour un attendu positif : écart égal à l’attendu ; comptées = 0 pour un attendu nul : conforme', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const a = await ligneAvecUm(s, { type: 'typePliage', qte: 10 }) // attendu 11
    const ra = await post(s, 'comptage', { lignes: [ref(a.r)], comptees: 0 })
    expect(ResultatUnitaireSchema.parse(ra.json()).ecart).toBe(11)
    const b = await ligneAvecUm(s, { type: 'typePliage', qte: 0 }) // attendu 0
    const rb = await post(s, 'comptage', { lignes: [ref(b.r)], comptees: 0 })
    expect(ResultatUnitaireSchema.parse(rb.json())).toMatchObject({
      ecart: 0,
      message: 'Comptage conforme.',
    })
  })

  it('RG-COO-247 l’attendu inclut l’entretien (RG-COO-238) : 2 affiches sans entretien (sous le seuil), 3 affiches +1', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const petit = await ligneAvecUm(s, { type: 'typePliage', qte: 2 })
    const seuil = await ligneAvecUm(s, { type: 'typePliage', qte: 3 })
    expect(
      ResultatUnitaireSchema.parse(
        (await post(s, 'comptage', { lignes: [ref(petit.r)], comptees: 2 })).json(),
      ).ecart,
    ).toBe(0)
    expect(
      ResultatUnitaireSchema.parse(
        (await post(s, 'comptage', { lignes: [ref(seuil.r)], comptees: 4 })).json(),
      ).ecart,
    ).toBe(0)
  })

  it('RG-COO-247 plusieurs lots : l’attendu est la somme des totaux ; tous les lots passent « Préparé » ; une alerte par UM en cas d’écart', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const a = await ligneAvecUm(s, { type: 'typePliage', qte: 50 }) // 54
    const b = await ligneAvecUm(s, { type: 'typePliage', qte: 100 }) // 108
    const res = await post(s, 'comptage', { lignes: [ref(a.r), ref(b.r)], comptees: 150 })
    expect(res.statusCode, res.body).toBe(200)
    const body = ResultatUnitaireSchema.parse(res.json())
    expect([body.traitees, body.ecart]).toEqual([2, 12])
    for (const x of [a, b]) {
      expect((await umLue(x.um.id))?.statut).toBe('PREPARE')
      expect((await repLue(x.r.id)).statut).toBe('PREPARE')
      expect(
        await db.journalAudit.count({
          where: { entiteId: String(x.um.id), action: 'COMPTAGE_PLIAGE' },
        }),
      ).toBe(1)
    }
  })

  it('RG-COO-247 une sélection mêlant pliage et fixe : 409 COO_PAS_PLIAGE, le lot de pliage n’est pas passé « Préparé »', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const p = await ligneAvecUm(s, { type: 'typePliage' })
    const fixe = await ligneAvecUm(s, { type: 'typeFixe' })
    const res = await post(s, 'comptage', { lignes: [ref(p.r), ref(fixe.r)], comptees: 10 })
    expect(res.statusCode).toBe(409)
    expect(erreur(res).code).toBe('COO_PAS_PLIAGE')
    expect((await umLue(p.um.id))?.statut).toBe('EN_COURS')
  })

  it('RG-COO-247 / Q-319 sans paramètre de types, aucune ligne n’est du pliage : le comptage est refusé (409) et la liste « pliage » est vide', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s, { type: 'typePliage' })
    expect((await lister(s, '?type=pliage')).lignes).toHaveLength(0)
    const res = await post(s, 'comptage', { lignes: [ref(r)], comptees: 11 })
    expect(res.statusCode).toBe(409)
    expect((await umLue(um.id))?.statut).toBe('EN_COURS')
  })

  it('RG-COO-247 unité déjà préparée : le comptage est accepté sans réécriture ; unité à un statut interdit (À expédier…) : 409', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const deja = await ligneAvecUm(s, {
      type: 'typePliage',
      umStatut: 'PREPARE',
      statut: 'PREPARE',
    })
    const res = await post(s, 'comptage', { lignes: [ref(deja.r)], comptees: 11 })
    expect(res.statusCode, res.body).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json()).traitees).toBe(0)
    expect((await repLue(deja.r.id)).version).toBe(deja.r.version)
    for (const umStatut of ['A_EXPEDIER', 'TERMINE', 'ANNULE'] as const) {
      const x = await ligneAvecUm(s, { type: 'typePliage', umStatut })
      expect(
        (await post(s, 'comptage', { lignes: [ref(x.r)], comptees: 1 })).statusCode,
        umStatut,
      ).toBe(409)
    }
  })

  it('RG-COO-247 / 305 le lot de pliage s’affiche « PL-nnnn », le bus « BU-nnnn », le fixe « UM-nnnn » (numéro sur 4 chiffres au moins)', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligneAvecUm(s, { type: 'typeFixe' })
    await ligneAvecUm(s, { type: 'typePliage' })
    await ligneAvecUm(s, { type: 'typeBus' })
    for (const [type, prefixe] of [
      ['fixe', 'UM'],
      ['pliage', 'PL'],
      ['bus', 'BU'],
    ] as const) {
      const [l] = (await lister(s, `?type=${type}`)).lignes
      expect(l?.unite?.code, type).toMatch(new RegExp(`^${prefixe}-\\d{4,}$`))
    }
  })

  it('RG-COO-247 entrées invalides : comptées absentes, sélection vide, plus de 2000 lignes : 400', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const { r } = await ligneAvecUm(s, { type: 'typePliage' })
    expect((await post(s, 'comptage', { lignes: [ref(r)] })).statusCode).toBe(400)
    expect((await post(s, 'comptage', { lignes: [], comptees: 1 })).statusCode).toBe(400)
    const trop = Array.from({ length: 2001 }, (_, i) => ({ id: i + 1, version: 1 }))
    expect((await post(s, 'comptage', { lignes: trop, comptees: 1 })).statusCode).toBe(400)
  })

  it('RG-COO-247 comptées extrêmes : jamais de 500 ; atomicité : une panne au journal d’alerte annule la préparation du lot', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const a = await ligneAvecUm(s, { type: 'typePliage', qte: 10 })
    const grand = await post(s, 'comptage', { lignes: [ref(a.r)], comptees: 2_147_483_647 })
    expect(grand.statusCode, grand.body).toBeLessThan(500)
    const b = await ligneAvecUm(s, { type: 'typePliage', qte: 10 })
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(b.um.id)}' AND NEW.action = 'COMPTAGE_PLIAGE'`,
      () => post(s, 'comptage', { lignes: [ref(b.r)], comptees: 5 }),
    )
    expect(echec.statusCode).toBe(500)
    expect((await umLue(b.um.id))?.statut).toBe('EN_COURS')
    expect((await repLue(b.r.id)).statut).toBe('EN_COURS')
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'UNITE_MANUTENTION', entiteId: String(b.um.id) },
      }),
    ).toBe(0)
  })

  it('RG-COO-247 idempotence : même clé, un seul comptage et une seule alerte ; concurrence : deux comptages de la même version, un seul passe', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const a = await ligneAvecUm(s, { type: 'typePliage', qte: 20 })
    const cle = cleIdem('cpt')
    const c1 = await post(s, 'comptage', { lignes: [ref(a.r)], comptees: 10 }, 'coord', cle)
    const c2 = await post(s, 'comptage', { lignes: [ref(a.r)], comptees: 10 }, 'coord', cle)
    expect([c1.statusCode, c2.statusCode]).toEqual([200, 200])
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(a.um.id), action: 'COMPTAGE_PLIAGE' },
      }),
    ).toBe(1)
    const b = await ligneAvecUm(s, { type: 'typePliage', qte: 20 })
    const [x, y] = await Promise.all([
      post(s, 'comptage', { lignes: [ref(b.r)], comptees: 22 }),
      post(s, 'comptage', { lignes: [ref(b.r)], comptees: 21 }),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
  })
})

// ───────────────────────── RG-COO-290 / 245 / 248 : liste (compléments) ─────────────────────────

describe('RG-COO-290 / 245 / 248 liste : compléments', () => {
  it('RG-COO-290 / ISO 53 : la semaine 2026-W53 existe (filtre accepté, lignes listées), 2027-W53 et 2025-W53 sont refusées (400)', async () => {
    const s = await siteFixe()
    const w53 = await ligne(s, { semaine: { annee: 2026, semaine: 53 } })
    await ligne(s, { semaine: { annee: 2026, semaine: 52 } })
    const l = await lister(s, '?depart=2026-W53')
    expect(idsDe(l)).toEqual([w53.id])
    expect(l.lignes[0]?.depart).toBe('2026-W53')
    for (const depart of ['2027-W53', '2025-W53', '2026-W54', '2026-W00', '2026-53', 'S53'])
      expect((await q(s, `?depart=${depart}`)).statusCode, depart).toBe(400)
  })

  it('RG-COO-290 filtres invalides : dossier 0 ou négatif, atelier 0, annonceur de 101 caractères, type vide : 400', async () => {
    const s = await siteFixe()
    for (const qs of [
      '?dossier=0',
      '?dossier=-5',
      '?atelier=0',
      `?annonceur=${'a'.repeat(101)}`,
      '?type=',
      '?statut=',
    ])
      expect((await q(s, qs)).statusCode, qs).toBe(400)
  })

  it('RG-COO-290 le filtre « statut » porte sur le statut de la ligne fusionnée (le plus bas : A traiter avant En cours)', async () => {
    const s = await siteFixe()
    const contNum = numero()
    await ligne(s, { contNum, theme: 'Mixte', statut: 'EN_COURS' })
    await ligne(s, { contNum, theme: 'Mixte', statut: 'A_TRAITER' })
    const [l] = (await lister(s, `?dossier=${String(contNum)}`)).lignes
    expect(l?.statut).toBe('A_TRAITER')
    expect((await lister(s, `?dossier=${String(contNum)}&statut=EN_COURS`)).lignes).toHaveLength(0)
    expect((await lister(s, `?dossier=${String(contNum)}&statut=A_TRAITER`)).lignes).toHaveLength(1)
    for (const statut of ['PREPARE', 'A_EXPEDIER', 'TERMINE'] as const) {
      const r = await ligne(s, { statut, theme: `S-${statut}` })
      expect(idsDe(await lister(s, `?statut=${statut}`))).toEqual([r.id])
    }
  })

  it('RG-COO-290 les filtres se cumulent (ET) et ignorent la casse pour l’annonceur et le destinataire ; la ligne sans destinataire reste listée', async () => {
    const s = await siteFixe()
    const contNum = numero()
    const a = await ligne(s, { contNum, annonceur: 'Renault Sport', dest: 0 })
    await ligne(s, { contNum, annonceur: 'Renault Sport', dest: 1, theme: 'Autre' })
    const sans = await ligne(s, { annonceur: 'Zéro', extra: { destinataireId: null } })
    const nomA = s.dest[0].nom ?? s.dest[0].nomOrigine
    expect(
      idsDe(
        await lister(
          s,
          `?annonceur=RENAULT&destinataire=${encodeURIComponent(nomA.toLowerCase())}`,
        ),
      ),
    ).toEqual([a.id])
    const [orpheline] = (await lister(s, '?annonceur=zéro')).lignes
    expect(orpheline?.refs[0]?.id).toBe(sans.id)
    expect([orpheline?.destinataire, orpheline?.afficheur]).toEqual([null, null])
  })

  it('RG-COO-290 une UM sans adresse principale pour le destinataire reste listée (l’adresse n’est plus une condition)', async () => {
    const s = await siteFixe()
    const { um, r } = await ligneAvecUm(s)
    const [l] = (await lister(s)).lignes
    expect(l?.refs[0]?.id).toBe(r.id)
    expect(l?.unite?.id).toBe(um.id)
  })

  it('RG-COO-290 l’affiche validée sur un autre site n’est pas affichée ici ; les actions ne dépendent d’aucune affiche', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const contNum = numero()
    await ligne(s, { contNum, theme: 'Commun' })
    const attendue = await f.createReceptionAttendue(db, {
      plateformeId: autre.plateforme.id,
      supportId: autre.support.id,
      contNum,
      theme: 'Commun',
    })
    const a = await f.createAffiche(db, {
      plateformeId: autre.plateforme.id,
      supportId: autre.support.id,
      contNum,
      validationAdmin: true,
    })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: attendue.id, quantite: 5 })
    expect((await lister(s)).lignes[0]?.afficheRecue).toBe('AUCUNE')
  })

  it('RG-COO-290 / 245 le jour d’affichage est nul sans date ; le tri est par départ puis dossier', async () => {
    const s = await siteFixe()
    const apres = await ligne(s, { contNum: 700_050, semaine: plus(SEM, 1) })
    const avantGrand = await ligne(s, { contNum: 700_020 })
    const avantPetit = await ligne(s, { contNum: 700_010 })
    const { lignes } = await lister(s)
    expect(lignes.map((l) => l.refs[0]?.id)).toEqual([avantPetit.id, avantGrand.id, apres.id])
    expect(lignes.every((l) => l.jourAffichage === null)).toBe(true)
  })

  it('RG-COO-248 la clé de fusion ignore la casse et les espaces du thème, mais sépare repiquage, semaine et destinataire', async () => {
    const s = await siteFixe()
    const contNum = numero()
    await ligne(s, { contNum, theme: 'Thème Fusion', repiquage: 'R1' })
    await ligne(s, { contNum, theme: 'THÈME FUSION', repiquage: 'r1' })
    await ligne(s, { contNum, theme: 'Thème Fusion', repiquage: 'R2' })
    await ligne(s, { contNum, theme: 'Thème Fusion', repiquage: 'R1', semaine: plus(SEM, 1) })
    const { lignes } = await lister(s, `?dossier=${String(contNum)}`)
    expect(lignes).toHaveLength(3)
    expect(lignes.find((l) => l.refs.length === 2)?.qte).toBe(20)
  })

  it('RG-COO-240 / 241 / 242 / 260 (Q-265 option (c)) : routes inexistantes absentes (404) et repères valides pour les six profils', async () => {
    const s = await siteFixe()
    const r = await ligne(s)
    for (const role of ROLES) {
      for (const chemin of ['liberation', 'creer-um', 'liberer-semaine']) {
        expect((await post(s, chemin, {}, role)).statusCode, `${role} POST ${chemin}`).toBe(404)
        const lecture = await get(
          ctx,
          `/api/coordination/unitaire/${chemin}`,
          s.users[role].headers,
        )
        expect(lecture.statusCode, `${role} GET ${chemin}`).toBe(404)
      }
    }
    const brut = await q(s)
    const corps = brut.json<{
      liberation: { disponible: boolean }
      lignes: Record<string, unknown>[]
    }>()
    expect(corps.liberation.disponible).toBe(true)
    expect(Object.keys(corps.lignes[0] ?? {})).toEqual(
      expect.arrayContaining(['aLiberer', 'apresLiberation']),
    )
    expect((await lister(s)).lignes[0]?.statut).toBe('A_TRAITER')
    for (const repere of ['A_LIBERER', 'APRES_LIBERATION'])
      expect((await q(s, `?repere=${repere}`)).statusCode, repere).toBe(200)
    expect((await q(s, '?repere=LIBERE')).statusCode).toBe(400)
    // Aucune libération n'a été écrite par les actions de l'écran.
    expect((await repLue(r.id)).statut).toBe('A_TRAITER')
  })

  it('RG-COO-251 aucun réordonnancement (Q-261) : routes absentes pour tous les verbes et tous les profils', async () => {
    const s = await siteFixe()
    for (const chemin of ['reordonner', 'deplacer', 'ordre', 'position']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        const res = await ctx.app.inject({
          method,
          url: `/api/coordination/unitaire/${chemin}`,
          headers: { ...s.users.coord.headers, ...cleIdem('x') },
          payload: {},
        })
        expect(res.statusCode, `${method} ${chemin}`).toBe(404)
      }
    }
  })
})

// ───────────────────────── RG-COO-246 : fiche de synthèse (compléments) ─────────────────────────

describe('RG-COO-246 / 306 fiche de synthèse : compléments', () => {
  it('RG-COO-246 les groupes sont triés par destinataire ; le format vient de la ligne ; l’entretien est calculé ligne par ligne puis additionné', async () => {
    const s = await siteFixe()
    const contNum = numero()
    await ligne(s, { contNum, theme: 'T1', qte: 2, dest: 1 }) // entretien 0
    await ligne(s, { contNum, theme: 'T2', qte: 2, dest: 1 }) // entretien 0 (somme 4 ≥ 3 : mais lignes distinctes)
    await ligne(s, { contNum, theme: 'T3', qte: 13, dest: 0 }) // 2
    const syn = SyntheseSchema.parse((await synthese(s, `?dossier=${String(contNum)}`)).json())
    expect(syn.groupes.map((g) => g.destinataire)).toEqual(
      [s.dest[0].nom ?? s.dest[0].nomOrigine, s.dest[1].nom ?? s.dest[1].nomOrigine].sort(),
    )
    const b = syn.groupes.find((g) => g.destinataire === (s.dest[1].nom ?? s.dest[1].nomOrigine))
    expect([b?.qte, b?.entretien, b?.total]).toEqual([4, 0, 4])
    expect(b?.lignes.every((l) => l.format === 'Format 2 m²')).toBe(true)
    expect([syn.qte, syn.entretien, syn.total]).toEqual([17, 2, 19])
  })

  it('RG-COO-246 les totaux généraux sont la somme des groupes ; les lignes annulées ou en erreur n’y figurent pas', async () => {
    const s = await siteFixe()
    await ligne(s, { qte: 10, statut: 'ANNULE' })
    await ligne(s, { qte: 10, statut: 'ERREUR' })
    await ligne(s, { qte: 50, dest: 0 })
    await ligne(s, { qte: 50, dest: 1 })
    const syn = SyntheseSchema.parse((await synthese(s)).json())
    expect(syn.groupes.reduce((x, g) => x + g.total, 0)).toBe(syn.total)
    expect([syn.qte, syn.entretien, syn.total]).toEqual([100, 8, 108])
  })

  it('RG-COO-246 la fiche suit les filtres type, départ, destinataire, statut et repère « main rendue »', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typePliage', qte: 50 })
    await ligne(s, { qte: 20, semaine: plus(SEM, 1), dest: 1 })
    const rendue = await ligne(s, { qte: 30 })
    await post(s, 'rendre-la-main', { lignes: [ref(rendue)] })
    const total = async (qs: string) => SyntheseSchema.parse((await synthese(s, qs)).json()).qte
    expect(await total('?type=pliage')).toBe(50)
    expect(await total(`?depart=${formatSemaineIso(plus(SEM, 1))}`)).toBe(20)
    expect(await total(`?destinataire=${encodeURIComponent(s.dest[1].nom ?? '')}`)).toBe(20)
    expect(await total('?repere=RENDU')).toBe(30)
    expect(await total('?statut=EN_COURS')).toBe(0)
  })

  it('RG-COO-246 la fiche ne change aucune donnée (lecture seule, impression par le navigateur, RG-COO-306)', async () => {
    const s = await siteFixe()
    const r = await ligne(s)
    const avant = JSON.stringify(await repLue(r.id))
    expect((await synthese(s)).statusCode).toBe(200)
    expect(JSON.stringify(await repLue(r.id))).toBe(avant)
    // Aucune route d'édition serveur : l'impression et le PDF sont côté navigateur (RG-COO-306).
    for (const chemin of ['synthese/pdf', 'synthese/imprimer', 'imprimer'])
      expect(
        (await get(ctx, `/api/coordination/unitaire/${chemin}`, s.users.coord.headers)).statusCode,
        chemin,
      ).toBe(404)
  })

  it('RG-COO-246 / 167 la fiche d’un utilisateur restreint à un atelier exclut les lignes de l’autre atelier du site', async () => {
    const s = await siteFixe()
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['cheq'],
      [{ plateformeId: s.plateforme.id, atelierId: s.atelier.id }],
    )
    await ligne(s, { qte: 40 })
    await ligne(s, { qte: 60, atelierId: s.atelier2.id })
    const res = await get(
      ctx,
      '/api/coordination/unitaire/synthese',
      devHeaders(u.identifiantExterne),
    )
    expect(SyntheseSchema.parse(res.json()).qte).toBe(40)
  })

  it('RG-COO-246 un destinataire absent est regroupé sous « — »', async () => {
    const s = await siteFixe()
    await ligne(s, { qte: 5, extra: { destinataireId: null } })
    const syn = SyntheseSchema.parse((await synthese(s)).json())
    expect(syn.groupes.map((g) => g.destinataire)).toEqual(['—'])
  })
})

// ───────────────────────── RG-COO-304 / 305 : quantités à encoller (compléments) ─────────────────────────

describe('RG-COO-304 / 305 quantités à encoller : limites et arrondis', () => {
  const base = (s: Site, o: Record<string, unknown> = {}) => ({
    plateformeId: s.plateforme.id,
    depart: DEPART,
    ajustementGlobal: 0,
    centres: [] as { destinataireId: number; ajustement: number }[],
    version: 0,
    ...o,
  })
  const lire = async (s: Site, depart = DEPART) =>
    EncollerSchema.parse(
      (await encoller(s, `?plateforme=${String(s.plateforme.id)}&depart=${depart}`)).json(),
    )

  it('RG-COO-304 calcul Broadcast (commande × 1,28 arrondi) pour 0, 1, 2, 3, 5, 25, 100, 1000 (HYPOTHÈSE Q-196 (5))', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const cas: [number, number][] = [
      [0, 0],
      [1, 1], // 1,28
      [2, 3], // 2,56
      [3, 4], // 3,84
      [5, 6], // 6,40
      [25, 32], // 32,00
      [100, 128],
      [1000, 1280],
    ]
    const ids: number[] = []
    for (const [commande] of cas) {
      const d = await f.createDestinataire(db, {
        nom: `${PREFIXE}-C${String(commande)}-${String(next())}`,
      })
      ids.push(d.id)
      await f.createRepartition(db, {
        atelierId: s.atelier.id,
        typePreparationId: s.typeBus.id,
        destinataireId: d.id,
        contNum: numero(),
        qte: commande,
        statut: 'A_TRAITER',
        semAnnee: SEM.annee,
        semNum: SEM.semaine,
      })
    }
    const e = await lire(s)
    for (const [i, [commande, attendu]] of cas.entries()) {
      const c = e.centres.find((x) => x.destinataireId === ids[i])
      expect(
        [c?.commande, c?.calculBroadcast, c?.aEncoller],
        `commande ${String(commande)}`,
      ).toEqual([commande, attendu, attendu])
    }
    expect(e.total).toBe(cas.reduce((x, [, a]) => x + a, 0))
  })

  it('RG-COO-304 ajustements additifs global + centre ; plancher −100 % (jamais de quantité négative) ; +1000 % admis', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typeBus', qte: 100, dest: 0 }) // calcul 128
    const dest0 = s.dest[0].id
    const cas: [number, number, number][] = [
      // [global, centre, à encoller]
      [0, 0, 128],
      [10, -5, 134], // +5 %
      [-100, 0, 0],
      [-60, -60, 0], // −120 % ramené à −100 %
      [-50, 0, 64],
      [0, -100, 0],
      [1000, 1000, 2688], // +2000 % : 128 × 21
      [0.5, 0, 129], // 128,64
      [0, -0.5, 127], // 127,36
    ]
    let version = 0
    for (const [global, centre, attendu] of cas) {
      const res = await post(
        s,
        'encoller',
        base(s, {
          ajustementGlobal: global,
          centres: [{ destinataireId: dest0, ajustement: centre }],
          version,
        }),
      )
      expect(res.statusCode, `${String(global)} / ${String(centre)} : ${res.body}`).toBe(200)
      const e = EncollerSchema.parse(res.json())
      expect(e.centres[0]?.aEncoller, `${String(global)} / ${String(centre)}`).toBe(attendu)
      expect(e.centres[0]?.aEncoller).toBeGreaterThanOrEqual(0)
      version = e.version
    }
    expect(version).toBe(cas.length)
  })

  it('RG-COO-304 bornes de saisie : −100 et 1000 acceptés (global et centre) ; −100,01 et 1000,01 : 400 ; texte : 400 ; 501 centres : 400', async () => {
    const s = await siteFixe()
    const centre = (ajustement: unknown) => [{ destinataireId: s.dest[0].id, ajustement }]
    for (const [i, corps] of [
      base(s, { ajustementGlobal: -100.01 }),
      base(s, { ajustementGlobal: 1000.01 }),
      base(s, { ajustementGlobal: '5' }),
      base(s, { ajustementGlobal: null }),
      base(s, { centres: centre(-100.01) }),
      base(s, { centres: centre(1000.01) }),
      base(s, { centres: centre('x') }),
      base(s, {
        centres: Array.from({ length: 501 }, (_, k) => ({ destinataireId: k + 1, ajustement: 0 })),
      }),
      base(s, { plateformeId: 0 }),
      base(s, { version: -1 }),
    ].entries())
      expect((await post(s, 'encoller', corps)).statusCode, `cas ${String(i)}`).toBe(400)
    expect(await db.encollageBus.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(
      (await post(s, 'encoller', base(s, { ajustementGlobal: -100, centres: centre(1000) })))
        .statusCode,
    ).toBe(200)
    expect(
      (
        await post(
          s,
          'encoller',
          base(s, { ajustementGlobal: 1000, centres: centre(-100), version: 1 }),
        )
      ).statusCode,
    ).toBe(200)
  })

  it('RG-COO-305 seuls les centres des lignes bus des ateliers fixes du site comptent : second atelier fixe additionné, atelier déroulant et autre site exclus, statuts masqués exclus', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    await typesParam(s, autre)
    const scroll = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'SCROLL' })
    purge.ateliers.push(scroll.id)
    await ligne(s, { type: 'typeBus', qte: 10, dest: 0 })
    await ligne(s, { type: 'typeBus', qte: 15, dest: 0, atelierId: s.atelier2.id })
    await ligne(s, { type: 'typeBus', qte: 99, dest: 0, atelierId: scroll.id })
    await ligne(autre, { type: 'typeBus', qte: 99, dest: 0 })
    await ligne(s, { type: 'typeBus', qte: 99, dest: 0, statut: 'ERREUR' })
    await ligne(s, { type: 'typeBus', qte: 7, dest: 1, statut: 'PREPARE' })
    await ligne(s, { type: 'typeBus', qte: 7, extra: { destinataireId: null } })
    const e = await lire(s)
    expect(e.centres.map((c) => c.commande).sort((a, b) => a - b)).toEqual([7, 25])
  })

  it('RG-COO-305 les lignes de la semaine ISO 53 (2026-W53) sont comptées ; 2027-W53 est refusée (400) à la lecture comme à l’enregistrement', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typeBus', qte: 50, dest: 0, semaine: { annee: 2026, semaine: 53 } })
    const e = await lire(s, '2026-W53')
    expect([e.depart, e.centres[0]?.commande, e.centres[0]?.calculBroadcast]).toEqual([
      '2026-W53',
      50,
      64,
    ])
    expect((await post(s, 'encoller', base(s, { depart: '2026-W53' }))).statusCode).toBe(200)
    expect(
      await db.journalAudit.count({
        where: { action: 'QUANTITES_ENCOLLER', entiteId: `${String(s.plateforme.id)}:2026-W53` },
      }),
    ).toBe(1)
    expect(
      (await encoller(s, `?plateforme=${String(s.plateforme.id)}&depart=2027-W53`)).statusCode,
    ).toBe(400)
    expect((await post(s, 'encoller', base(s, { depart: '2027-W53' }))).statusCode).toBe(400)
  })

  it('RG-COO-304 un enregistrement par plateforme et semaine : une autre semaine repart de la version 0 ; l’historique garde une entrée par enregistrement', async () => {
    const s = await siteFixe()
    const autreSemaine = formatSemaineIso(plus(SEM, 1))
    expect((await post(s, 'encoller', base(s))).statusCode).toBe(200)
    expect(
      (await post(s, 'encoller', base(s, { ajustementGlobal: 5, version: 1 }))).statusCode,
    ).toBe(200)
    expect((await post(s, 'encoller', base(s, { depart: autreSemaine }))).statusCode).toBe(200)
    expect((await lire(s)).version).toBe(2)
    expect((await lire(s, autreSemaine)).version).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { action: 'QUANTITES_ENCOLLER', entiteId: `${String(s.plateforme.id)}:${DEPART}` },
      }),
    ).toBe(2)
  })

  it('RG-COO-304 sans plateforme ni semaine : le premier site de l’utilisateur et la semaine suivante ; semaine sans ligne : aucun centre, total 0', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typeBus', qte: 100 })
    const defaut = EncollerSchema.parse((await encoller(s, '')).json())
    expect([defaut.plateformeId, defaut.depart, defaut.total]).toEqual([
      s.plateforme.id,
      DEPART,
      128,
    ])
    const vide = await lire(s, formatSemaineIso(plus(SEM, 5)))
    expect([vide.centres.length, vide.total, vide.version, vide.ajustementGlobal]).toEqual([
      0, 0, 0, 0,
    ])
  })

  it('RG-COO-304 un utilisateur sans aucun site : 422 à la lecture sans plateforme, 403 sur une plateforme donnée, 403 à l’enregistrement', async () => {
    const s = await siteFixe()
    const u = await f.createUtilisateurAvecRoles(db, ['coord'], [])
    const h = devHeaders(u.identifiantExterne)
    const sans = await get(ctx, '/api/coordination/unitaire/encoller', h)
    expect(sans.statusCode).toBe(422)
    expect(erreur(sans).regle).toBe('RG-COO-304')
    expect(
      (
        await get(
          ctx,
          `/api/coordination/unitaire/encoller?plateforme=${String(s.plateforme.id)}`,
          h,
        )
      ).statusCode,
    ).toBe(403)
    expect((await postH(h, 'encoller', base(s))).statusCode).toBe(403)
  })

  it('RG-COO-304 concurrence : deux premiers enregistrements simultanés (version 0) : un seul passe, l’autre 409 (jamais de 500)', async () => {
    const s = await siteFixe()
    const [x, y] = await Promise.all([
      post(s, 'encoller', base(s, { ajustementGlobal: 1 })),
      post(s, 'encoller', base(s, { ajustementGlobal: 2 })),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    expect(await db.encollageBus.count({ where: { plateformeId: s.plateforme.id } })).toBe(1)
  })

  it('RG-COO-304 concurrence : deux mises à jour de la même version (1) : une réussit, l’autre 409', async () => {
    const s = await siteFixe()
    expect((await post(s, 'encoller', base(s))).statusCode).toBe(200)
    const [x, y] = await Promise.all([
      post(s, 'encoller', base(s, { ajustementGlobal: 1, version: 1 })),
      post(s, 'encoller', base(s, { ajustementGlobal: 2, version: 1 })),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    expect((await lire(s)).version).toBe(2)
  })

  it('RG-COO-304 idempotence : même clé, un seul enregistrement et une seule entrée d’historique ; atomicité : une panne à la mise à jour laisse la version et l’ajustement inchangés', async () => {
    const s = await siteFixe()
    const cle = cleIdem('enc')
    const a = await post(s, 'encoller', base(s, { ajustementGlobal: 3 }), 'coord', cle)
    const b = await post(s, 'encoller', base(s, { ajustementGlobal: 3 }), 'coord', cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(
      await db.journalAudit.count({
        where: { action: 'QUANTITES_ENCOLLER', entiteId: `${String(s.plateforme.id)}:${DEPART}` },
      }),
    ).toBe(1)
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'QUANTITES_ENCOLLER' AND NEW.entite_id = '${String(s.plateforme.id)}:${DEPART}'`,
      () => post(s, 'encoller', base(s, { ajustementGlobal: 50, version: 1 })),
    )
    expect(echec.statusCode).toBe(500)
    const e = await lire(s)
    expect([e.version, e.ajustementGlobal]).toEqual([1, 3])
  })

  it('RG-COO-304 la lecture n’écrit rien (ni version, ni journal)', async () => {
    const s = await siteFixe()
    await typesParam(s)
    await ligne(s, { type: 'typeBus', qte: 20 })
    await lire(s)
    expect(await db.encollageBus.count({ where: { plateformeId: s.plateforme.id } })).toBe(0)
    expect(
      await db.journalAudit.count({ where: { entiteId: `${String(s.plateforme.id)}:${DEPART}` } }),
    ).toBe(0)
  })
})

// ───────────────────────── RG-COO-124 : entretien réalignée selon le jour (compléments) ─────────────────────────

describe('RG-COO-124 réalignement de l’entretien : jours limites et semaine ISO 53', () => {
  function groupe(
    contNum: number,
    quantiteEntretien: number | null,
    depart: string | null,
    nb = 1,
  ) {
    return {
      idGroupe: next(),
      idSiteCcf: 1,
      statutBroadcast: 133,
      details: Array.from({ length: nb }, () => ({
        idPreparationDetail: next() * 10,
        contNum,
        idTypePreparation: 1,
        supportId: null,
        destinataire: null,
        annonceur: 'A',
        theme: 'T',
        repiquage: null,
        repiquageId: null,
        quantite: 5,
        semaine: SEM,
        dateAffichage: null,
        numAfficheAmt: null,
        statutTravail: 0,
        quantiteEntretien,
        datePremierDepart: depart === null ? null : new Date(depart),
      })),
    }
  }
  type G = ReturnType<typeof groupe>
  const realigner = (g: G, le: string) =>
    db.$transaction((tx) => realignerEntretien(tx, g, new Date(le)))
  async function repDe(s: Site, g: G, i = 0, o: OptLigne = {}) {
    const d = g.details[i]
    return ligne(s, {
      ...o,
      contNum: d?.contNum ?? 0,
      extra: { idPreparationDetail: d?.idPreparationDetail, ...(o.extra ?? {}) },
    })
  }
  /** Ligne d'un groupe dont le départ est donné ; renvoie si la quantité a été réalignée (100 → 7). */
  async function realigne(s: Site, depart: string, le: string, o: OptLigne = {}) {
    const g = groupe(numero(), 7, depart)
    const r = await repDe(s, g, 0, { qte: 100, ...o })
    await realigner(g, le)
    return (await repLue(r.id)).qte === 7
  }

  it('RG-COO-124 jeudi 23:59:59 : régime lundi-jeudi (+14 j) ; vendredi 00:00:00 : régime vendredi-dimanche (+21 j)', async () => {
    const s = await siteFixe()
    // Lundi de la semaine = 2026-11-09 : seuils 2026-11-23 (+14) et 2026-11-30 (+21).
    expect(await realigne(s, '2026-11-23T00:00:00.000Z', '2026-11-12T23:59:59.999Z')).toBe(true)
    expect(await realigne(s, '2026-11-23T00:00:00.000Z', '2026-11-13T00:00:00.000Z')).toBe(false)
    expect(await realigne(s, '2026-11-30T00:00:00.000Z', '2026-11-13T00:00:00.000Z')).toBe(true)
  })

  it('RG-COO-124 lundi 00:00:00 : le lundi appartient à la semaine qui commence (seuil +14 j) ; dimanche 23:59:59 : toujours la semaine qui finit (+21 j)', async () => {
    const s = await siteFixe()
    expect(await realigne(s, '2026-11-23T00:00:00.000Z', '2026-11-09T00:00:00.000Z')).toBe(true)
    expect(await realigne(s, '2026-11-22T23:59:59.999Z', '2026-11-09T00:00:00.000Z')).toBe(false)
    expect(await realigne(s, '2026-11-23T00:00:00.000Z', '2026-11-15T23:59:59.999Z')).toBe(false)
    expect(await realigne(s, '2026-11-30T00:00:00.000Z', '2026-11-15T23:59:59.999Z')).toBe(true)
  })

  it('RG-COO-124 semaine ISO 53 de 2026 (28/12 → 03/01) : le calcul part du lundi 28/12 pour jeudi 31/12, vendredi 01/01 et dimanche 03/01', async () => {
    const s = await siteFixe()
    // Jeudi 31/12/2026 : lundi 28/12, seuil +14 = 11/01/2027.
    expect(await realigne(s, '2027-01-11T00:00:00.000Z', '2026-12-31T10:00:00.000Z')).toBe(true)
    expect(await realigne(s, '2027-01-10T23:59:59.000Z', '2026-12-31T10:00:00.000Z')).toBe(false)
    // Vendredi 01/01/2027 et dimanche 03/01/2027 : toujours la semaine 53 de 2026, seuil +21 = 18/01/2027.
    for (const le of ['2027-01-01T10:00:00.000Z', '2027-01-03T10:00:00.000Z']) {
      expect(await realigne(s, '2027-01-18T00:00:00.000Z', le), le).toBe(true)
      expect(await realigne(s, '2027-01-17T23:59:59.000Z', le), le).toBe(false)
    }
  })

  it('RG-COO-124 lundi 04/01/2027 (semaine 1 de 2027) : seuil +14 = 18/01/2027 ; jeudi 01/01/2026 (semaine 1 de 2026, lundi 29/12/2025) : seuil 12/01/2026', async () => {
    const s = await siteFixe()
    expect(await realigne(s, '2027-01-18T00:00:00.000Z', '2027-01-04T08:00:00.000Z')).toBe(true)
    expect(await realigne(s, '2027-01-17T00:00:00.000Z', '2027-01-04T08:00:00.000Z')).toBe(false)
    expect(await realigne(s, '2026-01-12T00:00:00.000Z', '2026-01-01T12:00:00.000Z')).toBe(true)
    expect(await realigne(s, '2026-01-11T23:59:59.000Z', '2026-01-01T12:00:00.000Z')).toBe(false)
  })

  it('RG-COO-124 un groupe à plusieurs détails : seuls les détails éligibles sont réalignés ; le compte et la trace le reflètent', async () => {
    const s = await siteFixe()
    const g = groupe(numero(), 7, '2026-12-30T00:00:00.000Z', 2)
    const d0 = g.details[0]
    const d1 = g.details[1]
    if (d0 && d1) {
      d1.datePremierDepart = new Date('2026-11-01T00:00:00.000Z') // trop proche
      d1.contNum = d0.contNum
    }
    const r0 = await repDe(s, g, 0, { qte: 100 })
    const r1 = await repDe(s, g, 1, { qte: 100 })
    const n = await realigner(g, '2026-11-09T10:00:00.000Z')
    expect(n).toBe(1)
    expect([(await repLue(r0.id)).qte, (await repLue(r1.id)).qte]).toEqual([7, 100])
  })

  it('RG-COO-124 une quantité d’entretien de Broadcast à 0 est reprise (0 est une valeur) ; chaque passage réaligne de nouveau (7 puis 9)', async () => {
    const s = await siteFixe()
    const g = groupe(numero(), 0, '2026-12-30T00:00:00.000Z')
    const r = await repDe(s, g, 0, { qte: 100 })
    expect(await realigner(g, '2026-11-09T10:00:00.000Z')).toBe(1)
    expect((await repLue(r.id)).qte).toBe(0)
    const d = g.details[0]
    if (d) d.quantiteEntretien = 9
    expect(await realigner(g, '2026-11-10T10:00:00.000Z')).toBe(1)
    const apres = await repLue(r.id)
    expect([apres.qte, apres.version]).toEqual([9, r.version + 2])
  })

  it('RG-COO-124 une ligne « Erreur », « Annulé » ou « Préparé » n’est jamais réalignée, même sans UM', async () => {
    const s = await siteFixe()
    const g = groupe(numero(), 7, '2026-12-30T00:00:00.000Z')
    const ids: number[] = []
    for (const statut of ['ERREUR', 'ANNULE', 'PREPARE', 'A_EXPEDIER'] as const)
      ids.push((await repDe(s, g, 0, { qte: 100, statut })).id)
    expect(await realigner(g, '2026-11-13T10:00:00.000Z')).toBe(0)
    for (const id of ids) expect((await repLue(id)).qte).toBe(100)
  })

  it('RG-COO-124 atomicité : une panne à la trace du journal annule les quantités déjà réalignées de la transaction', async () => {
    const s = await siteFixe()
    const g = groupe(numero(), 7, '2026-12-30T00:00:00.000Z')
    const r = await repDe(s, g, 0, { qte: 100 })
    const echec = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = 'groupe:${String(g.idGroupe)}'`,
      () =>
        realigner(g, '2026-11-09T10:00:00.000Z').then(
          () => 'ok',
          () => 'echec',
        ),
    )
    expect(echec).toBe('echec')
    const apres = await repLue(r.id)
    expect([apres.qte, apres.version]).toEqual([100, r.version])
  })
})

// ───────────────────────── Permissions : six profils × chaque route ─────────────────────────

describe('RG-COO-165 / 168 permissions : six profils sur chacune des dix routes', () => {
  /** [libellé, règle citée au refus, profils autorisés, appel]. Les écritures préparent leurs propres données. */
  type Appel = (
    s: Site,
    role: Role,
    i: number,
  ) => Promise<{ statusCode: number; json: () => unknown }>
  const MATRICE: [string, string, Role[], Appel][] = [
    ['GET unitaire', 'RG-COO-290', ['coord', 'cheq'], (s, r) => q(s, '', r)],
    ['GET synthese', 'RG-COO-246', ['coord', 'cheq'], (s, r) => synthese(s, '', r)],
    ['GET encoller', 'RG-COO-304', ['coord', 'cheq'], (s, r) => encoller(s, '', r)],
    [
      'POST quantite',
      'RG-COO-239',
      ['coord', 'cheq'],
      async (s, r) => post(s, 'quantite', { ...ref(await ligne(s)), quantite: 12 }, r),
    ],
    [
      'POST corriger-intitule',
      'RG-COO-244',
      ['coord', 'cheq'],
      async (s, r) =>
        post(s, 'corriger-intitule', { ...ref(await ligne(s)), annonceur: 'A', theme: `T${r}` }, r),
    ],
    [
      'POST rendre-la-main',
      'RG-COO-243',
      ['coord'],
      async (s, r) => post(s, 'rendre-la-main', { lignes: [ref(await ligne(s))] }, r),
    ],
    [
      'POST retirer',
      'RG-COO-249',
      ['coord', 'cheq'],
      async (s, r) => post(s, 'retirer', { lignes: [ref((await ligneAvecUm(s)).r)] }, r),
    ],
    [
      'POST preparer',
      'RG-COO-250',
      ['coord', 'cheq'],
      async (s, r) => post(s, 'preparer', { lignes: [ref((await ligneAvecUm(s)).r)] }, r),
    ],
    [
      'POST comptage',
      'RG-COO-247',
      ['coord', 'cheq'],
      async (s, r) =>
        post(
          s,
          'comptage',
          { lignes: [ref((await ligneAvecUm(s, { type: 'typePliage', qte: 1 })).r)], comptees: 1 },
          r,
        ),
    ],
    [
      'POST encoller',
      'RG-COO-304',
      ['coord', 'cheq'],
      (s, r, i) =>
        post(
          s,
          'encoller',
          {
            plateformeId: s.plateforme.id,
            depart: formatSemaineIso(plus(SEM, 10 + i)),
            ajustementGlobal: 0,
            centres: [],
            version: 0,
          },
          r,
        ),
    ],
  ]

  for (const [nom, regle, autorises, appel] of MATRICE)
    it(`RG-COO-165 ${nom} : ${autorises.join(' et ')} autorisés (200), les autres profils 403 PERMISSION citant ${regle} (RG-COO-168 pour le commerce)`, async () => {
      const s = await siteFixe()
      await typesParam(s)
      for (const [i, role] of ROLES_SANS_ADMIN.entries()) {
        const res = await appel(s, role, i)
        if (autorises.includes(role)) {
          expect(res.statusCode, `${nom} ${role}`).toBe(200)
        } else {
          expect(res.statusCode, `${nom} ${role}`).toBe(403)
          const e = erreur(res as Parameters<typeof erreur>[0])
          expect(e.code).toBe('PERMISSION')
          expect(e.regle, `${nom} ${role}`).toBe(role === 'com' ? 'RG-COO-168' : regle)
        }
      }
    })

  it('RG-COO-165 le refus de permission prime sur le 404 et le 400 métier : identifiants inconnus, profil refusé → 403, aucune écriture', async () => {
    const s = await siteFixe()
    const inconnue = { id: 999_999_999, version: 1 }
    const appels: [string, unknown][] = [
      ['quantite', { ...inconnue, quantite: 1 }],
      ['corriger-intitule', { ...inconnue, annonceur: 'A', theme: 'B' }],
      ['rendre-la-main', { lignes: [inconnue] }],
      ['retirer', { lignes: [inconnue] }],
      ['preparer', { lignes: [inconnue] }],
      ['comptage', { lignes: [inconnue], comptees: 1 }],
    ]
    for (const role of ['recep', 'expe', 'com'] as const)
      for (const [chemin, corps] of appels)
        expect((await post(s, chemin, corps, role)).statusCode, `${role} ${chemin}`).toBe(403)
    // « Rendre la main » est réservé à la Coordination : le chef d'équipe est refusé (HYPOTHÈSE Q-286).
    expect((await post(s, 'rendre-la-main', { lignes: [inconnue] }, 'cheq')).statusCode).toBe(403)
    expect((await post(s, 'rendre-la-main', { lignes: [inconnue] }, 'coord')).statusCode).toBe(404)
  })

  it('RG-COO-165 un utilisateur multi-profils (réception + chef d’équipe) cumule les droits ; un utilisateur désactivé : 401', async () => {
    const s = await siteFixe()
    const cumul = await f.createUtilisateurAvecRoles(
      db,
      ['recep', 'cheq'],
      [{ plateformeId: s.plateforme.id }],
    )
    const r = await ligne(s)
    expect(
      (await postH(devHeaders(cumul.identifiantExterne), 'quantite', { ...ref(r), quantite: 5 }))
        .statusCode,
    ).toBe(200)
    const inactif = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s.plateforme.id }],
    )
    await db.utilisateur.update({ where: { id: inactif.id }, data: { actif: false } })
    expect(
      (await get(ctx, '/api/coordination/unitaire', devHeaders(inactif.identifiantExterne)))
        .statusCode,
    ).toBe(401)
  })

  it('RG-COO-165 sans identité : 401 sur les trois lectures et les sept écritures ; signature falsifiée : 401', async () => {
    const lectures = ['', '/synthese', '/encoller']
    for (const chemin of lectures)
      expect(
        (await ctx.app.inject({ method: 'GET', url: `/api/coordination/unitaire${chemin}` }))
          .statusCode,
        chemin,
      ).toBe(401)
    const un = [{ id: 1, version: 1 }]
    for (const [chemin, corps] of [
      ['quantite', { id: 1, version: 1, quantite: 1 }],
      ['corriger-intitule', { id: 1, version: 1, annonceur: 'A', theme: 'B' }],
      ['rendre-la-main', { lignes: un }],
      ['retirer', { lignes: un }],
      ['preparer', { lignes: un }],
      ['comptage', { lignes: un, comptees: 1 }],
      [
        'encoller',
        { plateformeId: 1, depart: DEPART, ajustementGlobal: 0, centres: [], version: 0 },
      ],
    ] as const) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/coordination/unitaire/${chemin}`,
        headers: cleIdem('anon'),
        payload: corps,
      })
      expect(res.statusCode, chemin).toBe(401)
    }
    const falsifie = await ctx.app.inject({
      method: 'GET',
      url: '/api/coordination/unitaire',
      headers: { 'x-dev-identity': 'forge.signature' },
    })
    expect(falsifie.statusCode).toBe(401)
  })

  it('RG-COO-165 la clé d’idempotence est exigée sur chacune des sept écritures (400 IDEMPOTENCE_CLE_MANQUANTE) avant toute écriture', async () => {
    const s = await siteFixe()
    const { r } = await ligneAvecUm(s)
    for (const [chemin, corps] of [
      ['quantite', { ...ref(r), quantite: 3 }],
      ['corriger-intitule', { ...ref(r), annonceur: 'A', theme: 'B' }],
      ['rendre-la-main', { lignes: [ref(r)] }],
      ['retirer', { lignes: [ref(r)] }],
      ['preparer', { lignes: [ref(r)] }],
      ['comptage', { lignes: [ref(r)], comptees: 1 }],
      [
        'encoller',
        {
          plateformeId: s.plateforme.id,
          depart: DEPART,
          ajustementGlobal: 0,
          centres: [],
          version: 0,
        },
      ],
    ] as const) {
      const res = await post(s, chemin, corps, 'coord', {})
      expect(res.statusCode, chemin).toBe(400)
      expect(erreur(res).code, chemin).toBe('IDEMPOTENCE_CLE_MANQUANTE')
    }
    expect((await repLue(r.id)).version).toBe(r.version)
  })
})

// ───────────────────────── RG-COO-167 : périmètre site / atelier ─────────────────────────

describe('RG-COO-167 périmètre : listes, fiches, synthèse, écritures', () => {
  it('RG-COO-167 un utilisateur sans périmètre voit des listes vides (200) et ne peut agir sur aucune ligne (403)', async () => {
    const s = await siteFixe()
    const r = await ligne(s)
    const u = await f.createUtilisateurAvecRoles(db, ['coord'], [])
    const h = devHeaders(u.identifiantExterne)
    const liste = UnitaireSchema.parse((await get(ctx, '/api/coordination/unitaire', h)).json())
    expect([liste.lignes.length, liste.ateliers.length]).toEqual([0, 0])
    expect(
      SyntheseSchema.parse((await get(ctx, '/api/coordination/unitaire/synthese', h)).json())
        .groupes,
    ).toEqual([])
    for (const [chemin, corps] of [
      ['quantite', { ...ref(r), quantite: 1 }],
      ['corriger-intitule', { ...ref(r), annonceur: 'A', theme: 'B' }],
      ['rendre-la-main', { lignes: [ref(r)] }],
      ['retirer', { lignes: [ref(r)] }],
      ['preparer', { lignes: [ref(r)] }],
      ['comptage', { lignes: [ref(r)], comptees: 1 }],
    ] as const) {
      const res = await postH(h, chemin, corps)
      expect(res.statusCode, chemin).toBe(403)
      expect(erreur(res).regle).toBe('RG-COO-167')
    }
    expect((await repLue(r.id)).version).toBe(r.version)
  })

  it('RG-COO-167 un utilisateur restreint à un atelier : liste, synthèse et filtre atelier excluent l’autre atelier du même site ; l’écriture sur l’autre atelier : 403', async () => {
    const s = await siteFixe()
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['cheq', 'coord'],
      [{ plateformeId: s.plateforme.id, atelierId: s.atelier.id }],
    )
    const h = devHeaders(u.identifiantExterne)
    const mien = await ligne(s)
    const autre = await ligne(s, { atelierId: s.atelier2.id })
    const liste = UnitaireSchema.parse((await get(ctx, '/api/coordination/unitaire', h)).json())
    expect(idsDe(liste)).toEqual([mien.id])
    expect(liste.ateliers.map((a) => a.id)).toEqual([s.atelier.id])
    const demande = await get(ctx, `/api/coordination/unitaire?atelier=${String(s.atelier2.id)}`, h)
    expect(demande.statusCode).toBe(403)
    expect(erreur(demande).regle).toBe('RG-COO-167')
    const res = await postH(h, 'quantite', { ...ref(autre), quantite: 3 })
    expect(res.statusCode).toBe(403)
    expect((await repLue(autre.id)).qte).toBe(10)
    expect((await postH(h, 'quantite', { ...ref(mien), quantite: 3 })).statusCode).toBe(200)
  })

  it('RG-COO-167 un utilisateur de deux sites voit les deux ; le filtre atelier restreint à un site ; un troisième site : 403', async () => {
    const s1 = await siteFixe()
    const s2 = await siteFixe()
    const s3 = await siteFixe()
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s1.plateforme.id }, { plateformeId: s2.plateforme.id }],
    )
    const h = devHeaders(u.identifiantExterne)
    const a = await ligne(s1)
    const b = await ligne(s2)
    const c = await ligne(s3)
    const liste = UnitaireSchema.parse((await get(ctx, '/api/coordination/unitaire', h)).json())
    expect(idsDe(liste)).toEqual([a.id, b.id].sort((x, y) => x - y))
    const seul = UnitaireSchema.parse(
      (await get(ctx, `/api/coordination/unitaire?atelier=${String(s2.atelier.id)}`, h)).json(),
    )
    expect(idsDe(seul)).toEqual([b.id])
    const syn = SyntheseSchema.parse(
      (await get(ctx, '/api/coordination/unitaire/synthese', h)).json(),
    )
    expect(syn.qte).toBe(20)
    expect((await postH(h, 'quantite', { ...ref(c), quantite: 1 })).statusCode).toBe(403)
    expect((await postH(h, 'rendre-la-main', { lignes: [ref(a), ref(c)] })).statusCode).toBe(403)
    expect((await repLue(a.id)).rendueLe).toBeNull()
    expect(
      (
        await get(
          ctx,
          `/api/coordination/unitaire/encoller?plateforme=${String(s3.plateforme.id)}`,
          h,
        )
      ).statusCode,
    ).toBe(403)
  })

  // ANO-053 (corrigée) : RG-COO-167 « le site choisi dans le bandeau vaut pour toute l'application » ; HYPOTHÈSE Q-173 : le site
  // choisi (en-tête x-site-id) filtre les LISTES (comme pour les réceptions attendues, RG-REC-001). L'écran unitaire
  // (liste, synthèse, site par défaut des quantités à encoller) ignore l'en-tête : il renvoie tout le périmètre.
  // Suspect : apps/api/src/modules/coordination/unitaire.ts:260-272 (ateliersUnitaire) et :996-1006 (plateformeEncoller)
  // n'utilisent jamais identity.siteId. Reproduction : utilisateur coord de deux sites, GET /api/coordination/unitaire
  // avec x-site-id = second site.
  it('RG-COO-167 ANO-053 le site choisi (x-site-id) filtre la liste, la synthèse et le site par défaut des quantités à encoller', async () => {
    const s1 = await siteFixe()
    const s2 = await siteFixe()
    await typesParam(s1, s2)
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s1.plateforme.id }, { plateformeId: s2.plateforme.id }],
    )
    const h = devHeaders(u.identifiantExterne, s2.plateforme.id)
    await ligne(s1, { qte: 10 })
    const b = await ligne(s2, { qte: 20 })
    const liste = UnitaireSchema.parse((await get(ctx, '/api/coordination/unitaire', h)).json())
    expect(idsDe(liste)).toEqual([b.id])
    const syn = SyntheseSchema.parse(
      (await get(ctx, '/api/coordination/unitaire/synthese', h)).json(),
    )
    expect(syn.qte).toBe(20)
    const enc = EncollerSchema.parse(
      (await get(ctx, '/api/coordination/unitaire/encoller', h)).json(),
    )
    expect(enc.plateformeId).toBe(s2.plateforme.id)
  })

  it('RG-COO-167 une sélection qui mêle une ligne du site et une ligne d’un autre site : 403 pour toute la sélection, rien n’est écrit', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const ici = await ligneAvecUm(s)
    const ailleurs = await ligneAvecUm(autre)
    for (const chemin of ['retirer', 'preparer', 'rendre-la-main']) {
      const res = await post(s, chemin, { lignes: [ref(ici.r), ref(ailleurs.r)] })
      expect(res.statusCode, chemin).toBe(403)
      expect(await umLue(ici.um.id), chemin).not.toBeNull()
      expect((await repLue(ici.r.id)).statut).toBe('EN_COURS')
    }
  })

  it('RG-COO-167 la liste ne montre jamais les lignes d’un autre site ni leurs thèmes exclus ou leurs affiches', async () => {
    const s = await siteFixe()
    const autre = await siteFixe()
    const contNum = numero()
    await ligne(autre, { contNum })
    await f.createReceptionAttendue(db, {
      plateformeId: autre.plateforme.id,
      supportId: autre.support.id,
      contNum,
      theme: 'Exclu ailleurs',
      themeExclu: true,
    })
    const l = await lister(s, `?dossier=${String(contNum)}`)
    expect(l.lignes).toHaveLength(0)
    expect(l.themesExclus).toEqual([])
  })

  it('RG-COO-167 un atelier inconnu : 404 ; le commerce est refusé sur l’écran (droit de consultation absent, Q-286)', async () => {
    const s = await siteFixe()
    expect((await q(s, '?atelier=999999999')).statusCode).toBe(404)
    expect((await q(s, '', 'com')).statusCode).toBe(403)
  })
})

// ───────────────────────── Grandes volumétries (> 1 000 unités / dossiers) ─────────────────────────

describe('Grandes volumétries : plus de 1 000 unités et dossiers, jamais de 500', () => {
  const GRAND = 1100
  let compteurDossier = 20_000_000

  /** Insère `n` lignes (un dossier par ligne) par paquets ; renvoie leurs références triées par identifiant. */
  async function enMasse(
    s: Site,
    n: number,
    o: {
      statut?: StatutProduction
      type?: 'typeFixe' | 'typePliage' | 'typeBus'
      uniteIds?: number[]
      qte?: number
      sem?: { annee: number; semaine: number }
      destinataires?: number[]
    } = {},
  ) {
    const debut = compteurDossier
    compteurDossier += n + 5
    const sem = o.sem ?? SEM
    for (let i = 0; i < n; i += 50) {
      const data = []
      for (let k = i; k < Math.min(n, i + 50); k++)
        data.push({
          atelierId: s.atelier.id,
          typePreparationId: s[o.type ?? 'typeFixe'].id,
          supportId: s.support.id,
          destinataireId: o.destinataires
            ? o.destinataires[k % o.destinataires.length]
            : s.dest[k % 2]?.id,
          contNum: debut + k,
          theme: `Vol ${String(k)}`,
          annonceur: 'VOLUME',
          qte: o.qte ?? 5,
          statut: o.statut ?? 'A_TRAITER',
          semAnnee: sem.annee,
          semNum: sem.semaine,
          ...(o.uniteIds ? { uniteId: o.uniteIds[k] ?? null } : {}),
        })
      await db.repartition.createMany({ data })
    }
    return db.repartition.findMany({
      where: { atelierId: s.atelier.id, contNum: { gte: debut, lt: debut + n } },
      orderBy: { id: 'asc' },
      select: { id: true, version: true, uniteId: true },
    })
  }
  async function unitesEnMasse(s: Site, n: number) {
    const marque = `${PREFIXE}-UM${String(next())}`
    for (let i = 0; i < n; i += 100)
      await db.uniteManutention.createMany({
        data: Array.from({ length: Math.min(100, n - i) }, (_, k) => ({
          atelierId: s.atelier.id,
          statut: 'EN_COURS',
          codeBarre: `${marque}-${String(i + k).padStart(5, '0')}`,
        })),
      })
    const ums = await db.uniteManutention.findMany({
      where: { codeBarre: { startsWith: marque } },
      orderBy: { codeBarre: 'asc' },
      select: { id: true },
    })
    return ums.map((u) => u.id)
  }

  it('RG-COO-290 / 246 / 238 plus de 1 000 lignes et autant de dossiers : liste, filtres et fiche de synthèse répondent 200 avec toutes les lignes', async () => {
    const s = await siteFixe()
    const lignes = await enMasse(s, GRAND, { qte: 50 })
    const liste = await lister(s)
    expect(liste.lignes).toHaveLength(GRAND)
    expect(idsDe(liste)).toEqual(lignes.map((l) => l.id))
    expect(liste.lignes.every((l) => l.entretien === 4 && l.total === 54)).toBe(true)
    expect((await lister(s, `?depart=${DEPART}&statut=A_TRAITER`)).lignes).toHaveLength(GRAND)
    expect((await lister(s, '?statut=EN_COURS')).lignes).toHaveLength(0)
    const syn = SyntheseSchema.parse((await synthese(s)).json())
    expect([syn.qte, syn.entretien, syn.total]).toEqual([GRAND * 50, GRAND * 4, GRAND * 54])
    expect(syn.groupes.reduce((x, g) => x + g.lignes.length, 0)).toBe(GRAND)
  }, 120_000)

  it('RG-COO-290 plus de 1 000 dossiers avec affiches reçues : l’indication ✓ reste correcte sur la première et la dernière ligne', async () => {
    const s = await siteFixe()
    const lignes = await enMasse(s, GRAND)
    const premiere = await repLue(lignes[0]?.id ?? 0)
    const derniere = await repLue(lignes[GRAND - 1]?.id ?? 0)
    for (const r of [premiere, derniere]) {
      const attendue = await f.createReceptionAttendue(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: r.contNum ?? 0,
        theme: r.theme ?? '',
      })
      const a = await f.createAffiche(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: r.contNum ?? 0,
        validationAdmin: true,
      })
      await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: attendue.id, quantite: 5 })
    }
    const { lignes: lues } = await lister(s)
    expect(lues).toHaveLength(GRAND)
    expect(lues.filter((l) => l.afficheRecue === 'VALIDEE')).toHaveLength(2)
  }, 120_000)

  it('RG-COO-243 « Rendre la main » sur plus de 1 000 lignes (maximum 2 000 par requête) : 200 ou refus explicite, jamais de 500 ; en cas de succès tout est rendu', async () => {
    const s = await siteFixe()
    const lignes = await enMasse(s, GRAND)
    const res = await post(s, 'rendre-la-main', { lignes: lignes.map((l) => ref(l)) })
    expect(res.statusCode, res.body.slice(0, 300)).toBeLessThan(500)
    expect(res.statusCode).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json()).traitees).toBe(GRAND)
    expect(
      await db.repartition.count({ where: { atelierId: s.atelier.id, rendueLe: { not: null } } }),
    ).toBe(GRAND)
    expect(await db.renduMain.count({ where: { atelierId: s.atelier.id } })).toBe(1)
  }, 180_000)

  it('RG-COO-250 / 249 « Préparer » puis « Retirer » sur plus de 1 000 UM (une ligne par UM) : jamais de 500 ; en cas de succès, tout est traité', async () => {
    const s = await siteFixe()
    const ums = await unitesEnMasse(s, GRAND)
    const lignes = await enMasse(s, GRAND, { statut: 'EN_COURS', uniteIds: ums })
    const prep = await post(s, 'preparer', { lignes: lignes.map((l) => ref(l)) })
    expect(prep.statusCode, prep.body.slice(0, 300)).toBeLessThan(500)
    expect(prep.statusCode).toBe(200)
    expect(ResultatUnitaireSchema.parse(prep.json()).traitees).toBe(GRAND)
    expect(
      await db.uniteManutention.count({
        where: { id: { in: ums.slice(0, 300) }, statut: 'PREPARE' },
      }),
    ).toBe(300)
    // Retrait d'un second lot de 1 100 UM.
    const ums2 = await unitesEnMasse(s, GRAND)
    const lignes2 = await enMasse(s, GRAND, { statut: 'EN_COURS', uniteIds: ums2 })
    const ret = await post(s, 'retirer', { lignes: lignes2.map((l) => ref(l)) })
    expect(ret.statusCode, ret.body.slice(0, 300)).toBeLessThan(500)
    expect(ret.statusCode).toBe(200)
    expect(await db.uniteManutention.count({ where: { id: { in: ums2.slice(0, 300) } } })).toBe(0)
  }, 300_000)

  it('RG-COO-247 comptage de pliage sur plus de 1 000 lots : jamais de 500 ; l’attendu est la somme des totaux', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const ums = await unitesEnMasse(s, GRAND)
    const lignes = await enMasse(s, GRAND, {
      statut: 'EN_COURS',
      uniteIds: ums,
      type: 'typePliage',
      qte: 50,
    })
    const attendu = GRAND * 54
    const res = await post(s, 'comptage', { lignes: lignes.map((l) => ref(l)), comptees: attendu })
    expect(res.statusCode, res.body.slice(0, 300)).toBeLessThan(500)
    expect(res.statusCode).toBe(200)
    expect(ResultatUnitaireSchema.parse(res.json())).toMatchObject({ ecart: 0, traitees: GRAND })
  }, 300_000)

  it('RG-COO-304 / 305 plus de 1 000 centres bus : lecture 200 avec tous les centres ; enregistrement de 500 ajustements (maximum) accepté', async () => {
    const s = await siteFixe()
    await typesParam(s)
    const dest: number[] = []
    for (let i = 0; i < GRAND; i += 100)
      await db.destinataire.createMany({
        data: Array.from({ length: Math.min(100, GRAND - i) }, (_, k) => ({
          nomOrigine: `${PREFIXE}-B${String(next())}-${String(i + k)}`,
        })),
      })
    dest.push(
      ...(
        await db.destinataire.findMany({
          where: { nomOrigine: { startsWith: PREFIXE } },
          select: { id: true },
          orderBy: { id: 'desc' },
          take: GRAND,
        })
      ).map((d) => d.id),
    )
    await enMasse(s, GRAND, { type: 'typeBus', qte: 10, destinataires: dest })
    const e = EncollerSchema.parse(
      (await encoller(s, `?plateforme=${String(s.plateforme.id)}&depart=${DEPART}`)).json(),
    )
    expect(e.centres).toHaveLength(GRAND)
    expect(e.total).toBe(GRAND * 13)
    const res = await post(s, 'encoller', {
      plateformeId: s.plateforme.id,
      depart: DEPART,
      ajustementGlobal: 0,
      centres: dest.slice(0, 500).map((destinataireId) => ({ destinataireId, ajustement: 10 })),
      version: 0,
    })
    expect(res.statusCode, res.body.slice(0, 300)).toBe(200)
    expect(EncollerSchema.parse(res.json()).centres).toHaveLength(GRAND)
  }, 180_000)

  it('RG-COO-243 / 249 / 250 une sélection de 2 001 lignes est refusée (400) sans rien écrire ; 2 000 est la limite acceptée par le schéma', async () => {
    const s = await siteFixe()
    const trop = Array.from({ length: 2001 }, (_, i) => ({ id: i + 1, version: 1 }))
    for (const chemin of ['rendre-la-main', 'retirer', 'preparer'])
      expect((await post(s, chemin, { lignes: trop })).statusCode, chemin).toBe(400)
    const limite = Array.from({ length: 2000 }, (_, i) => ({ id: 900_000_000 + i, version: 1 }))
    // 2 000 références inconnues : le schéma passe, la ligne inconnue donne 404 (jamais 400 ni 500).
    expect((await post(s, 'retirer', { lignes: limite })).statusCode).toBe(404)
  })
})
