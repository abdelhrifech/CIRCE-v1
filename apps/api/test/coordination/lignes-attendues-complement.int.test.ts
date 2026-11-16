// COO-P05 — tests COMPLÉMENTAIRES des lignes attendues (lignes-attendues.int.test.ts n'est pas dupliqué).
// Source de l'attendu (les règles, pas le code) : docs/COORDINATION_REGLES_METIER.md RG-COO-026, 080 à 090,
// 094 à 101, 105 à 108, §2 (profils × actions) ; maquette ECR-PIL-03 ; hypothèses Q-187 (1) à (13).
// Les écarts constatés sont marqués `it.fails` avec leur n° ANO (non reportés dans RAPPORT_TESTS.md).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  InconnueCreeeSchema,
  ReservationsSchema,
  SuiviProductionSchema,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import {
  alimenterDepuisBroadcast,
  alimenterDepuisPreparation,
  dedoublonnerLignes,
  deplacerLien,
  fermerLigne,
  lignesPrepaDepuisProduction,
  type LigneLueBroadcast,
  type LignePrepa,
} from '../../src/modules/coordination/alimentation-lignes.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  idem,
  photo,
  post,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>
const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))

/** Plateforme gérée par Broadcast (site CCF), support avec correspondance surface × format. */
async function site() {
  const idSiteCcf = 20_000 + next()
  const plateforme = await f.createPlateforme(db, { idSiteCcf })
  const support = await f.createSupport(db)
  const idSurface = 600 + next()
  const idFormat = 950 + next()
  await db.correspondanceSupport.create({ data: { idSurface, idFormat, supportId: support.id } })
  const contNum = 800_000 + next()
  const coordU = await f.createUtilisateurAvecRoles(
    db,
    ['coord'],
    [{ plateformeId: plateforme.id }],
  )
  const recepU = await f.createUtilisateurAvecRoles(
    db,
    ['recep'],
    [{ plateformeId: plateforme.id }],
  )
  return {
    plateforme,
    support,
    idSiteCcf,
    idSurface,
    idFormat,
    contNum,
    coord: devHeaders(coordU.identifiantExterne),
    recep: devHeaders(recepU.identifiantExterne),
  }
}
type Site = Awaited<ReturnType<typeof site>>

function lue(s: Site, p: Partial<LigneLueBroadcast> = {}): LigneLueBroadcast {
  return {
    idSiteCcf: s.idSiteCcf,
    destinataire: 'Wissous',
    contNum: s.contNum,
    annonceur: 'ANNONCEUR C05',
    idSurface: s.idSurface,
    idFormat: s.idFormat,
    idTheme: null,
    theme: 'Thème A',
    idThemeBandeau: null,
    idDaChapeau: null,
    semaine: plus(S, 1),
    quantite: 100,
    estResteEnPlace: false,
    statutPreparation: null,
    ...p,
  }
}

function prepa(s: Site, p: Partial<LignePrepa> = {}): LignePrepa {
  return {
    plateformeId: s.plateforme.id,
    contNum: s.contNum,
    supportId: s.support.id,
    theme: 'Thème A',
    idThemeBandeau: null,
    atelierId: null,
    annonceur: 'ANNONCEUR C05',
    semaine: S,
    quantite: 90,
    ...p,
  }
}

const lire = (lignes: LigneLueBroadcast[], lueLe = new Date()) =>
  withTransaction(db, (tx) => alimenterDepuisBroadcast(tx, { lueLe, lignes }))
const integrer = (lignes: LignePrepa[]) =>
  withTransaction(db, (tx) => alimenterDepuisPreparation(tx, lignes))
const lignesDe = (contNum: number) =>
  db.receptionAttendue.findMany({ where: { contNum }, orderBy: { id: 'asc' } })
const actives = async (contNum: number) =>
  (await lignesDe(contNum)).filter((l) => l.etatLigne === 'ACTIVE')
const ligneParId = (id: number) => db.receptionAttendue.findUniqueOrThrow({ where: { id } })
async function seule(contNum: number) {
  const [l, ...reste] = await actives(contNum)
  if (!l || reste.length > 0) throw new Error('une seule ligne active attendue')
  return l
}

/** Réception (REC-P04) d'une affiche sur une ligne existante ; `intitule` pour une ligne sans IP. */
async function recevoir(s: Site, ligneAttendueId: number, quantite = 10, intitule?: string) {
  const bl = await bonDeLivraison(ctx, s.recep, [
    { ligneAttendueId, quantite, ...(intitule ? { intituleSaisi: intitule } : {}) },
  ])
  const r = await post(ctx, '/api/receptions', s.recep, bl)
  expect(r.statusCode, r.body).toBe(201)
  const id = r.json<{ affiches: { id: number }[] }>().affiches[0]?.id
  if (id === undefined) throw new Error('aucune affiche')
  return id
}

/** Réception inconnue (ECR-REC-08) de `quantite` affiches sur le site. */
async function inconnue(s: Site, quantite = 12) {
  const r = await post(ctx, '/api/receptions-inconnues', s.recep, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    annonceur: 'Lu sur affiche',
    theme: 'Description',
    imprimeurId: null,
    quantite,
    allee: 'x',
    rayon: '4',
    photoAfficheId: null,
    photoBlId: await photo(ctx, s.recep),
    sansBl: false,
    numeroBl: `BL-C05-${String(next())}`,
  })
  expect(r.statusCode, r.body).toBe(201)
  return InconnueCreeeSchema.parse(r.json())
}

const edr = async (headers: Headers, q = '') => {
  const r = await get(ctx, `/api/coordination/reservations${q ? `?${q}` : ''}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return ReservationsSchema.parse(r.json())
}
const suivi = async (headers: Headers, q = '') => {
  const r = await get(ctx, `/api/coordination/suivi-production${q ? `?${q}` : ''}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return SuiviProductionSchema.parse(r.json())
}
const supprimer = (id: number, headers: Headers) =>
  ctx.app.inject({
    method: 'DELETE',
    url: `/api/coordination/lignes-attendues/${String(id)}`,
    headers,
  })

let numDeclencheur = 0
/** Atomicité : déclencheur SQLite temporaire RAISE(ABORT) posé sur test.db, toujours supprimé (finally). */
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_lig_${String(++numDeclencheur)}_${String(next())}`
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

/** Paramètre `coordination.supportsBandeau` remplacé le temps d'un test, puis restauré. */
async function avecBandeau<T>(valeur: string, fn: () => Promise<T>): Promise<T> {
  const param = await db.parametre.findFirstOrThrow({
    where: { cle: 'coordination.supportsBandeau', plateformeId: null },
  })
  await db.parametre.update({ where: { id: param.id }, data: { valeur } })
  try {
    return await fn()
  } finally {
    await db.parametre.update({ where: { id: param.id }, data: { valeur: param.valeur } })
  }
}

// ───────────────── RG-COO-080 une seule ligne active par clé ─────────────────

describe('RG-COO-080 unicité de la ligne active par clé (complément)', () => {
  const cle = (s: Site, themeCle: string | null) => ({
    plateformeId: s.plateforme.id,
    contNum: s.contNum,
    supportId: s.support.id,
    theme: themeCle,
    themeCle,
    semAnnee: S.annee,
    semNum: S.semaine,
  })

  it('RG-COO-080 index unique en base : une 2e ligne ACTIVE de même clé est refusée par la base', async () => {
    const s = await site()
    await f.createReceptionAttendue(db, cle(s, 'THEME A'))
    await expect(f.createReceptionAttendue(db, cle(s, 'THEME A'))).rejects.toThrow()
    expect(await actives(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-080 second index (lignes sans thème, avant IP) : deux lignes provisoires ACTIVE de même clé refusées', async () => {
    const s = await site()
    await f.createReceptionAttendue(db, cle(s, null))
    await expect(f.createReceptionAttendue(db, cle(s, null))).rejects.toThrow()
  })

  it('RG-COO-080 limite : la clé n’est unique que pour les lignes ACTIVE (plusieurs ANNULEE + une ACTIVE autorisées)', async () => {
    const s = await site()
    await f.createReceptionAttendue(db, { ...cle(s, 'THEME A'), etatLigne: 'ANNULEE' })
    await f.createReceptionAttendue(db, { ...cle(s, 'THEME A'), etatLigne: 'ANNULEE' })
    await f.createReceptionAttendue(db, cle(s, 'THEME A'))
    expect(await lignesDe(s.contNum)).toHaveLength(3)
    expect(await actives(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-080 / RG-COO-081 thème écrit différemment (accents, casse, espaces) ⇒ même clé : une ligne, quantités additionnées', async () => {
    const s = await site()
    await lire([
      lue(s, { theme: 'Thème  a', quantite: 30 }),
      lue(s, { theme: 'THEME A', quantite: 20 }),
    ])
    expect((await seule(s.contNum)).qteBc).toBe(50)
    await lire([lue(s, { theme: 'thème a ', quantite: 70 })])
    expect(await actives(s.contNum)).toHaveLength(1)
    expect((await seule(s.contNum)).qteBc).toBe(70)
  })

  it('RG-COO-080 atelier hors clé : prépa de deux ateliers du même thème ⇒ une ligne, quantités additionnées', async () => {
    const s = await site()
    const a1 = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const a2 = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const r = await integrer([
      prepa(s, { atelierId: a1.id, quantite: 40 }),
      prepa(s, { atelierId: a2.id, quantite: 25 }),
    ])
    expect(r.creees).toBe(1)
    expect(await seule(s.contNum)).toMatchObject({ qtePrepa: 65, source: 'PREPA' })
  })

  it('RG-COO-080 bandeau dans la clé : même thème, bandeau différent ⇒ deux lignes', async () => {
    const s = await site()
    await lire([
      lue(s, { idThemeBandeau: null }),
      lue(s, { idThemeBandeau: 41 }),
      lue(s, { idThemeBandeau: 42 }),
    ])
    expect((await actives(s.contNum)).map((l) => l.idThemeBandeau).sort()).toEqual([41, 42, null])
  })

  it('RG-COO-080 / RG-COO-089 une clé fermée relue plus tard ⇒ nouvelle ligne ACTIVE ; la fermée reste ANNULEE', async () => {
    const s = await site()
    const autreDossier = lue(s, { contNum: s.contNum + 1 })
    await lire([lue(s), autreDossier])
    const premiere = await seule(s.contNum)
    await lire([autreDossier])
    await lire([autreDossier])
    expect((await ligneParId(premiere.id)).etatLigne).toBe('ANNULEE')
    const r = await lire([lue(s), autreDossier])
    expect(r.creees).toBe(1)
    const ls = await lignesDe(s.contNum)
    expect(ls.map((l) => l.etatLigne)).toEqual(['ANNULEE', 'ACTIVE'])
  })
})

// ───────────────── RG-COO-082 / RG-COO-083 lecture Broadcast, semaines ISO ─────────────────

describe('RG-COO-082 / RG-COO-083 lecture de l’état des réservations (complément)', () => {
  it('RG-COO-082 limite : toutes les lignes de la clé « reste en place » ⇒ ligne créée avec qte_bc 0', async () => {
    const s = await site()
    await lire([
      lue(s, { estResteEnPlace: true, quantite: 30 }),
      lue(s, { estResteEnPlace: true, quantite: 20 }),
    ])
    expect((await seule(s.contNum)).qteBc).toBe(0)
  })

  it('RG-COO-082 rejet : prépa « Envoyé » ⇒ la ligne existante n’est ni mise à jour ni marquée vue', async () => {
    const s = await site()
    const lu1 = new Date(Date.now() - 3_600_000)
    await lire([lue(s, { quantite: 100 })], lu1)
    const avant = await seule(s.contNum)
    const r = await lire([lue(s, { quantite: 999, statutPreparation: 'Envoyé' })])
    expect(r.exclues).toBe(1)
    expect(await ligneParId(avant.id)).toMatchObject({
      qteBc: 100,
      version: avant.version,
      etatLigne: 'ACTIVE',
      nonVueLe: null,
    })
  })

  it('RG-COO-083 année à 53 semaines : lecture du lundi 2026-12-28 (S53) ⇒ S53/2026 et S08/2027 alimentées, S09/2027 hors fenêtre', async () => {
    const s = await site()
    const lueLe = new Date('2026-12-28T09:00:00Z')
    const r = await lire(
      [
        lue(s, { semaine: { annee: 2026, semaine: 53 }, theme: 'S53' }),
        lue(s, { semaine: { annee: 2027, semaine: 1 }, theme: 'S01' }),
        lue(s, { semaine: { annee: 2027, semaine: 8 }, theme: 'S08' }),
        lue(s, { semaine: { annee: 2027, semaine: 9 }, theme: 'S09' }),
        lue(s, { semaine: { annee: 2026, semaine: 52 }, theme: 'S52' }),
      ],
      lueLe,
    )
    expect(r.creees).toBe(3)
    expect(r.exclues).toBe(2)
    expect(
      (await actives(s.contNum))
        .map((l) => formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }))
        .sort(),
    ).toEqual(['2026-W53', '2027-W01', '2027-W08'])
  })

  it('RG-COO-083 fin d’année sans cas particulier : lecture du dimanche 2027-01-03 (encore S53/2026) ⇒ même fenêtre que le lundi', async () => {
    const s = await site()
    const r = await lire(
      [
        lue(s, { semaine: { annee: 2026, semaine: 53 }, theme: 'S53' }),
        lue(s, { semaine: { annee: 2027, semaine: 8 }, theme: 'S08' }),
        lue(s, { semaine: { annee: 2027, semaine: 9 }, theme: 'S09' }),
      ],
      new Date('2027-01-03T20:00:00Z'),
    )
    expect(r.creees).toBe(2)
    expect(r.exclues).toBe(1)
  })

  it('RG-COO-083 limite : la semaine en cours (S) est alimentée, la semaine précédente (S-1) ne l’est pas', async () => {
    const s = await site()
    const r = await lire([
      lue(s, { semaine: S, theme: 'courante' }),
      lue(s, { semaine: plus(S, -1), theme: 'passee' }),
    ])
    expect(r.creees).toBe(1)
    expect((await seule(s.contNum)).theme).toBe('courante')
  })

  it('RG-COO-082 atomicité : échec à la création de la 2e ligne d’une lecture ⇒ aucune ligne de la lecture n’est écrite', async () => {
    const s = await site()
    const second = s.contNum + 1
    await expect(
      avecEchec(`BEFORE INSERT ON tf_prepa_affiche WHEN NEW.cont_num = ${String(second)}`, () =>
        lire([lue(s), lue(s, { contNum: second })]),
      ),
    ).rejects.toThrow()
    expect(await lignesDe(s.contNum)).toHaveLength(0)
    expect(await lignesDe(second)).toHaveLength(0)
  })
})

// ───────────────── RG-COO-084 / RG-COO-085 provisoire et IP ─────────────────

describe('RG-COO-084 / RG-COO-085 visuel provisoire (complément)', () => {
  it('RG-COO-084 une lecture suivante toujours sans thème met à jour la même ligne provisoire (pas de doublon)', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, quantite: 30 })])
    const p = await seule(s.contNum)
    await lire([lue(s, { theme: null, quantite: 45 })])
    expect(await seule(s.contNum)).toMatchObject({ id: p.id, provisoire: true, qteBc: 45 })
  })

  it('RG-COO-084 la clé provisoire est par support et par semaine : deux supports ou deux semaines ⇒ deux provisoires', async () => {
    const s = await site()
    const sup2 = await f.createSupport(db)
    const idSurface = 600 + next()
    const idFormat = 950 + next()
    await db.correspondanceSupport.create({ data: { idSurface, idFormat, supportId: sup2.id } })
    await lire([
      lue(s, { theme: null }),
      lue(s, { theme: null, idSurface, idFormat }),
      lue(s, { theme: null, semaine: plus(S, 2) }),
    ])
    const ls = await actives(s.contNum)
    expect(ls).toHaveLength(3)
    expect(ls.every((l) => l.provisoire && l.theme === null)).toBe(true)
  })

  it('RG-COO-085 provisoire sans affiche : fermée (ANNULEE + date), aucune alerte, la ligne du thème est créée', async () => {
    const s = await site()
    await lire([lue(s, { theme: null })])
    const p = await seule(s.contNum)
    // N° de thème fourni : pas d'alerte THEME_SANS_NUMERO (RG-COO-081), seule la fermeture est observée.
    const r = await lire([lue(s, { theme: 'Thème IP', idTheme: 5000 + next() })])
    expect(r.provisoiresFermees).toBe(1)
    expect(r.alertes).toEqual([])
    expect(await ligneParId(p.id)).toMatchObject({ etatLigne: 'ANNULEE' })
    expect((await ligneParId(p.id)).fermeeLe).not.toBeNull()
    expect((await seule(s.contNum)).theme).toBe('Thème IP')
  })

  it('RG-COO-085 idempotence : la même lecture avec IP rejouée ⇒ rien de plus (aucune fermeture, aucun déplacement)', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const p = await seule(s.contNum)
    const afficheId = await recevoir(s, p.id, 10, 'Lu')
    await lire([lue(s, { theme: 'Thème IP', semaine: S })])
    const r = await lire([lue(s, { theme: 'Thème IP', semaine: S })])
    expect(r).toMatchObject({ creees: 0, provisoiresFermees: 0, liensDeplaces: 0 })
    expect(await db.afficheAttendue.count({ where: { afficheId } })).toBe(2)
    expect(await db.afficheAttendue.count({ where: { afficheId, actif: true } })).toBe(1)
  })

  it('RG-COO-085 une prépa thématisée (IP) ferme aussi la provisoire et y déplace l’affiche rattachée', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const p = await seule(s.contNum)
    const afficheId = await recevoir(s, p.id, 10, 'Lu')
    const r = await integrer([prepa(s, { theme: 'Thème prépa', semaine: S })])
    expect(r.provisoiresFermees).toBe(1)
    expect(r.liensDeplaces).toBe(1)
    const cible = await seule(s.contNum)
    expect(cible).toMatchObject({ theme: 'Thème prépa', source: 'PREPA' })
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    expect(lien.ligneAttendueId).toBe(cible.id)
  })

  it('RG-COO-085 atomicité : échec pendant le déplacement du lien ⇒ provisoire active, lien inchangé, aucune ligne de thème', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const p = await seule(s.contNum)
    const afficheId = await recevoir(s, p.id, 10, 'Lu')
    const avant = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    await expect(
      avecEchec(
        `BEFORE UPDATE ON asso_affiche_visuel WHEN OLD.affiche_id = ${String(afficheId)} AND NEW.actif = 0`,
        () => lire([lue(s, { theme: 'Thème IP', semaine: S })]),
      ),
    ).rejects.toThrow()
    expect(await ligneParId(p.id)).toMatchObject({ etatLigne: 'ACTIVE', provisoire: true })
    expect(await actives(s.contNum)).toHaveLength(1)
    expect(await db.afficheAttendue.findMany({ where: { afficheId } })).toMatchObject([
      { id: avant.id, actif: true, ligneAttendueId: p.id },
    ])
  })
})

// ───────────────── RG-COO-086 arrivée de la prépa ─────────────────

describe('RG-COO-086 arrivée de la prépa (complément)', () => {
  it('RG-COO-086 idempotence : la même prépa rejouée ⇒ aucune ligne en plus, qte_prepa inchangée', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, quantite: 90 })])
    await integrer([prepa(s)])
    const apres1 = await seule(s.contNum)
    const r = await integrer([prepa(s)])
    expect(r.creees).toBe(0)
    expect(await seule(s.contNum)).toMatchObject({
      id: apres1.id,
      source: 'PREPA',
      qtePrepa: 90,
    })
  })

  it('RG-COO-086 clé dont la seule ligne est fermée ⇒ une nouvelle ligne PREPA est créée ; la fermée garde ses liens', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, quantite: 10 })])
    const l = await seule(s.contNum)
    const afficheId = await recevoir(s, l.id, 4)
    await withTransaction(db, async (tx) =>
      fermerLigne(
        tx,
        await tx.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } }),
        new Date(),
        'test',
        'RG-COO-087',
      ),
    )
    const r = await integrer([prepa(s, { quantite: 10 })])
    expect(r.creees).toBe(1)
    const nouvelle = await seule(s.contNum)
    expect(nouvelle.id).not.toBe(l.id)
    expect(nouvelle).toMatchObject({ source: 'PREPA', qtePrepa: 10 })
    expect(await ligneParId(l.id)).toMatchObject({ etatLigne: 'ANNULEE', source: 'BC' })
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    expect(lien.ligneAttendueId).toBe(l.id)
  })

  it('RG-COO-086 limite : qte_prepa = qte_bc ⇒ aucune alerte d’écart ; qte_prepa = qte_bc + 1 ⇒ alerte', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, quantite: 90 })])
    expect((await integrer([prepa(s, { quantite: 90 })])).alertes).toEqual([])
    const r = await integrer([prepa(s, { quantite: 91 })])
    expect(r.alertes.map((a) => a.type)).toEqual(['ECART_DA_PREPA'])
  })
})

// ───────────────── RG-COO-087 disparition ─────────────────

describe('RG-COO-087 disparition, fermeture (complément)', () => {
  it('RG-COO-087 rejet : une ligne de source PREPA absente de deux lectures n’est jamais fermée', async () => {
    const s = await site()
    const autreDossier = lue(s, { contNum: s.contNum + 1 })
    await lire([lue(s, { semaine: S }), autreDossier])
    await integrer([prepa(s)])
    await lire([autreDossier])
    await lire([autreDossier])
    expect(await seule(s.contNum)).toMatchObject({ etatLigne: 'ACTIVE', source: 'PREPA' })
  })

  it('RG-COO-087 rejet : une ligne BC hors de la fenêtre (S+9) absente de deux lectures n’est ni marquée ni fermée', async () => {
    const s = await site()
    const loin = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: plus(S, 9).annee,
      semNum: plus(S, 9).semaine,
      source: 'BC',
    })
    const autreDossier = lue(s, { contNum: s.contNum + 1 })
    await lire([autreDossier])
    await lire([autreDossier])
    expect(await ligneParId(loin.id)).toMatchObject({ etatLigne: 'ACTIVE', nonVueLe: null })
  })

  it('RG-COO-087 concurrence : fermeture avec une version périmée ⇒ 409 COO_CONFLIT_VERSION, la ligne reste ACTIVE', async () => {
    const s = await site()
    await lire([lue(s)])
    const perimee = await seule(s.contNum)
    await lire([lue(s, { quantite: 120 })])
    await expect(
      withTransaction(db, (tx) => fermerLigne(tx, perimee, new Date(), 'test', 'RG-COO-087')),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'COO_CONFLIT_VERSION' })
    expect((await ligneParId(perimee.id)).etatLigne).toBe('ACTIVE')
  })

  it('RG-COO-087 les lignes ANNULEE sont exclues des attendues : état des réservations et totaux sans la ligne fermée', async () => {
    const s = await site()
    await lire([
      lue(s, { theme: 'Gardée', quantite: 10 }),
      lue(s, { theme: 'Fermée', quantite: 30 }),
    ])
    await lire([lue(s, { theme: 'Gardée', quantite: 10 })])
    await lire([lue(s, { theme: 'Gardée', quantite: 10 })])
    expect((await lignesDe(s.contNum)).map((l) => l.etatLigne).sort()).toEqual([
      'ACTIVE',
      'ANNULEE',
    ])
    const r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items.map((x) => x.visuel)).toEqual(['Gardée'])
    expect(r.totaux.attendu).toBe(10)
  })
})

// ───────────────── RG-COO-088 lien affiche ↔ ligne ─────────────────

describe('RG-COO-088 lien affiche ↔ ligne (complément)', () => {
  // ANO-033 : RG-COO-088 « Conditions : … ligne ACTIVE pour un nouveau lien ». Le rattachement d'une réception
  // inconnue (inconnues.ts:rattacherInconnue → rattachement.ts:rattacher) ne contrôle pas l'état de la ligne :
  // une ligne fermée (ANNULEE), absente des candidats, était acceptée si son id était envoyé (corrigé).
  it('RG-COO-088 rejet : rattacher une réception inconnue à une ligne fermée (ANNULEE) ⇒ refus, rien n’est écrit (ANO-033)', async () => {
    const s = await site()
    const inc = await inconnue(s)
    const fermee = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
      etatLigne: 'ANNULEE',
    })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: inc.afficheId } })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, s.coord, {
      version: a.version,
      lignes: [{ ligneAttendueId: fermee.id, quantite: 12 }],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_LIGNE_CIBLE_ANNULEE', regle: 'RG-COO-088' })
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id } })).toBe(0)
  })

  it('RG-COO-088 plusieurs-à-plusieurs : deux affiches sur une ligne, une affiche sur deux lignes ; reçu = Σ des liens, compté une fois', async () => {
    const s = await site()
    const d2 = s.contNum + 1
    await lire([
      lue(s, { semaine: S, quantite: 10 }),
      lue(s, { contNum: d2, semaine: S, quantite: 10 }),
    ])
    const l1 = await seule(s.contNum)
    const l2 = await seule(d2)
    await recevoir(s, l1.id, 6)
    const b = await recevoir(s, l1.id, 10)
    await db.afficheAttendue.updateMany({
      where: { afficheId: b, actif: true },
      data: { quantite: 4 },
    })
    const vb = await db.affiche.findUniqueOrThrow({ where: { id: b } })
    const r = await post(ctx, `/api/affiches/${String(b)}/rattachements`, s.coord, {
      version: vb.version,
      ligneAttendueId: l2.id,
      quantite: 6,
    })
    expect(r.statusCode, r.body).toBe(200)
    // Reçu de chaque ligne = Σ des liens actifs (lecture vivante ; le lien de B a été réduit en base).
    const recuDe = async (contNum: number) =>
      (await edr(s.coord, `dossier=${String(contNum)}`)).items[0]?.recu
    expect(await recuDe(s.contNum)).toBe(10)
    expect(await recuDe(d2)).toBe(6)
    const parFormat = await edr(s.coord, `grain=FORMAT&plateformeId=${String(s.plateforme.id)}`)
    expect(parFormat.totaux).toMatchObject({ attendu: 20, recu: 16, resteARecevoir: 4 })
  })

  it('RG-COO-088 déplacement vers une ligne où l’affiche est déjà liée ⇒ un seul lien actif, quantités additionnées, historique', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, theme: 'De' }), lue(s, { semaine: S, theme: 'Vers' })])
    const de = (await actives(s.contNum)).find((l) => l.theme === 'De')
    const vers = (await actives(s.contNum)).find((l) => l.theme === 'Vers')
    if (!de || !vers) throw new Error('lignes')
    const afficheId = await recevoir(s, de.id, 10)
    await db.afficheAttendue.updateMany({ where: { afficheId }, data: { quantite: 7 } })
    await f.createRattachement(db, {
      afficheId,
      ligneAttendueId: vers.id,
      quantite: 3,
      mode: 'MAIN',
    })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId, ligneAttendueId: de.id, actif: true },
    })
    await withTransaction(db, (tx) => deplacerLien(tx, lien.id, vers.id, new Date(), 'test'))
    const liens = await db.afficheAttendue.findMany({ where: { afficheId, actif: true } })
    expect(liens).toMatchObject([{ ligneAttendueId: vers.id, quantite: 10 }])
    expect((await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })).actif).toBe(
      false,
    )
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(afficheId), action: 'DEPLACEMENT_RATTACHEMENT' },
      }),
    ).toBe(1)
  })

  it('RG-COO-088 concurrence : déplacer un lien déjà retiré ⇒ 409, aucun lien recréé', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, theme: 'De' }), lue(s, { semaine: S, theme: 'Vers' })])
    const de = (await actives(s.contNum)).find((l) => l.theme === 'De')
    const vers = (await actives(s.contNum)).find((l) => l.theme === 'Vers')
    if (!de || !vers) throw new Error('lignes')
    const afficheId = await recevoir(s, de.id, 10)
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    await db.afficheAttendue.update({ where: { id: lien.id }, data: { actif: false } })
    await expect(
      withTransaction(db, (tx) => deplacerLien(tx, lien.id, vers.id, new Date())),
    ).rejects.toMatchObject({ httpStatus: 409, regle: 'RG-COO-088' })
    expect(await db.afficheAttendue.count({ where: { afficheId, ligneAttendueId: vers.id } })).toBe(
      0,
    )
  })
})

// ───────────────── RG-COO-089 jamais de suppression ─────────────────

describe('RG-COO-089 suppression interdite (complément)', () => {
  // Audit COO-P05 : droit vérifié dans le service (`alimentation.manuelle`, Q-187 (9)) : les autres rôles → 403.
  it.each<Role>(['cheq', 'recep', 'expe', 'com'])(
    'RG-COO-089 suppression par le rôle %s (sans droit de gestion des lignes) ⇒ 403, la ligne reste (Q-187 (9))',
    async (role) => {
      const s = await site()
      await lire([lue(s)])
      const l = await seule(s.contNum)
      const u = await autre(ctx, s.plateforme.id, [role])
      const r = await supprimer(l.id, u.headers)
      expect(r.statusCode).toBe(403)
      expect(await ligneParId(l.id)).toMatchObject({ etatLigne: 'ACTIVE', version: l.version })
    },
  )

  it.each<Role>(['coord', 'admin'])(
    'RG-COO-089 suppression directe par le rôle %s (périmètre) ⇒ 409 RG-COO-089, la ligne reste (Q-187 (9))',
    async (role) => {
      const s = await site()
      await lire([lue(s)])
      const l = await seule(s.contNum)
      const u = await autre(ctx, s.plateforme.id, [role])
      const r = await supprimer(l.id, u.headers)
      expect(r.statusCode).toBe(409)
      expect(erreur(r).regle).toBe('RG-COO-089')
      expect(await ligneParId(l.id)).toMatchObject({ etatLigne: 'ACTIVE', version: l.version })
    },
  )

  it('RG-COO-089 rejet : sans utilisateur authentifié ⇒ 401 ; id non numérique ⇒ 400', async () => {
    const s = await site()
    await lire([lue(s)])
    const l = await seule(s.contNum)
    expect((await supprimer(l.id, {})).statusCode).toBe(401)
    expect((await supprimer(Number.NaN, s.coord)).statusCode).toBe(400)
    expect(await lignesDe(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-089 une ligne déjà fermée portant un lien : suppression 409, ligne et lien conservés', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S })])
    const l = await seule(s.contNum)
    const afficheId = await recevoir(s, l.id, 3)
    await withTransaction(db, async (tx) =>
      fermerLigne(
        tx,
        await tx.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } }),
        new Date(),
        'test',
        'RG-COO-087',
      ),
    )
    expect((await supprimer(l.id, s.coord)).statusCode).toBe(409)
    expect(await ligneParId(l.id)).toMatchObject({ etatLigne: 'ANNULEE' })
    expect(await db.afficheAttendue.count({ where: { afficheId, actif: true } })).toBe(1)
  })

  it('RG-COO-089 fermeture : ANNULEE + date + historique de statut et journal (seule voie)', async () => {
    const s = await site()
    await lire([lue(s)])
    const l = await seule(s.contNum)
    const le = new Date('2026-11-05T10:00:00Z')
    await withTransaction(db, (tx) => fermerLigne(tx, l, le, 'motif test', 'RG-COO-089'))
    expect(await ligneParId(l.id)).toMatchObject({ etatLigne: 'ANNULEE', fermeeLe: le })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'LIGNE_ATTENDUE', entiteId: String(l.id), nouveau: 'ANNULEE' },
      }),
    ).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'LIGNE_ATTENDUE', entiteId: String(l.id), action: 'FERMETURE_LIGNE' },
      }),
    ).toBe(1)
  })
})

// ───────────────── RG-COO-090 dédoublonnage (reprise) ─────────────────

describe('RG-COO-090 dédoublonnage initial (complément)', () => {
  const base = (s: Site) => ({
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    contNum: s.contNum,
    semAnnee: S.annee,
    semNum: S.semaine,
  })

  it('RG-COO-090 deux doublons portant chacun une affiche : la plus récente gardée, l’affiche de l’autre reportée (aucune perte de lien)', async () => {
    const s = await site()
    const ancienne = await f.createReceptionAttendue(db, {
      ...base(s),
      theme: 'Thème A',
      themeCle: 'legacy-1',
      createdAt: new Date('2026-01-01'),
    })
    const recente = await f.createReceptionAttendue(db, {
      ...base(s),
      theme: 'THEME A',
      themeCle: 'legacy-2',
      createdAt: new Date('2026-06-01'),
    })
    const a1 = await recevoir(s, ancienne.id, 3)
    const a2 = await recevoir(s, recente.id, 5)
    const r = await withTransaction(db, (tx) => dedoublonnerLignes(tx))
    expect(r.liensReportes).toBeGreaterThanOrEqual(1)
    expect(await ligneParId(recente.id)).toMatchObject({ etatLigne: 'ACTIVE' })
    expect(await ligneParId(ancienne.id)).toMatchObject({ etatLigne: 'ANNULEE' })
    for (const [a, q] of [
      [a1, 3],
      [a2, 5],
    ] as const)
      expect(
        await db.afficheAttendue.findMany({ where: { afficheId: a, actif: true } }),
      ).toMatchObject([{ ligneAttendueId: recente.id, quantite: q }])
  })

  it('RG-COO-090 même affiche liée aux deux doublons ⇒ un seul lien actif sur la gardée, quantités additionnées', async () => {
    const s = await site()
    const l1 = await f.createReceptionAttendue(db, {
      ...base(s),
      theme: 'Thème B',
      themeCle: 'b-1',
    })
    const l2 = await f.createReceptionAttendue(db, {
      ...base(s),
      theme: 'theme b',
      themeCle: 'b-2',
    })
    const a = await recevoir(s, l1.id, 10)
    await db.afficheAttendue.updateMany({ where: { afficheId: a }, data: { quantite: 6 } })
    await f.createRattachement(db, {
      afficheId: a,
      ligneAttendueId: l2.id,
      quantite: 4,
      mode: 'MAIN',
    })
    await withTransaction(db, (tx) => dedoublonnerLignes(tx))
    const liens = await db.afficheAttendue.findMany({ where: { afficheId: a, actif: true } })
    expect(liens).toHaveLength(1)
    expect(liens[0]?.quantite).toBe(10)
    expect(await actives(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-090 rejet : lignes de semaines différentes, ou déjà ANNULEE, ne sont pas des doublons ; un 2e passage ne ferme rien de plus', async () => {
    const s = await site()
    await f.createReceptionAttendue(db, { ...base(s), theme: 'Thème C', themeCle: 'THEME C' })
    await f.createReceptionAttendue(db, {
      ...base(s),
      semNum: plus(S, 1).semaine,
      semAnnee: plus(S, 1).annee,
      theme: 'Thème C',
      themeCle: 'c-legacy',
    })
    await f.createReceptionAttendue(db, {
      ...base(s),
      theme: 'thème c',
      themeCle: 'c-ferme',
      etatLigne: 'ANNULEE',
    })
    await withTransaction(db, (tx) => dedoublonnerLignes(tx))
    expect((await lignesDe(s.contNum)).map((l) => l.etatLigne)).toEqual([
      'ACTIVE',
      'ACTIVE',
      'ANNULEE',
    ])
    const r2 = await withTransaction(db, (tx) => dedoublonnerLignes(tx))
    expect(r2.fermees).toBe(0)
  })
})

// ───────────────── RG-COO-094 / 095 / 096 sources, bandeau, DA ─────────────────

describe('RG-COO-094 / 095 / 096 sources de lignes, bandeau, DA chapeau (complément)', () => {
  it('RG-COO-094 limites : répartition S+8 incluse, S+9 exclue ; face au départ passé ou ANNULE exclue', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const rep = (sem: SemaineIso, theme: string) =>
      f.createRepartition(db, {
        contNum: s.contNum,
        supportId: s.support.id,
        atelierId: atelier.id,
        semAnnee: sem.annee,
        semNum: sem.semaine,
        theme,
        qte: 5,
      })
    await rep(plus(S, 8), 'S+8')
    await rep(plus(S, 9), 'S+9')
    const instr = await f.createInstruction(db, { contNum: s.contNum })
    const face = (theme: string, dateDepart: Date, statut?: 'ANNULE') => {
      const sd = semaineIsoDe(dateDepart)
      return f.createFaceTrain(db, {
        instructionCode: instr.code,
        contNum: s.contNum,
        supportId: s.support.id,
        atelierId: atelier.id,
        theme,
        depAnbas: sd.annee,
        depSembas: sd.semaine,
        dateDepart,
        ...(statut ? { statut } : {}),
      })
    }
    // Départ passé mais semaine courante : exclu par « départ futur ».
    await face('passee', new Date(Date.now() - 60_000))
    await face('annulee', new Date(Date.now() + 2 * 86_400_000), 'ANNULE')
    await face('future', new Date(Date.now() + 2 * 86_400_000))
    const lignes = await withTransaction(db, (tx) =>
      lignesPrepaDepuisProduction(tx, new Date(), [s.contNum]),
    )
    expect(lignes.map((l) => l.theme).sort()).toEqual(['S+8', 'future'])
  })

  it('RG-COO-095 bandeau : deux répartitions du même repiquage ⇒ une ligne bandeau (Σ) ; repiquage sur un support non bandeau ⇒ aucune ligne bandeau', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const bandeau = await f.createSupport(db)
    const autreSupport = await f.createSupport(db)
    await avecBandeau(`${String(s.support.id)}:${String(bandeau.id)}`, async () => {
      const base = {
        contNum: s.contNum,
        atelierId: atelier.id,
        semAnnee: S.annee,
        semNum: S.semaine,
        theme: 'Thème A',
        repiquage: 'Bandeau R',
        repiquageId: 77,
      }
      await f.createRepartition(db, { ...base, supportId: s.support.id, qte: 12 })
      await f.createRepartition(db, { ...base, supportId: s.support.id, qte: 8 })
      await f.createRepartition(db, { ...base, supportId: autreSupport.id, qte: 50 })
      await withTransaction(db, async (tx) =>
        alimenterDepuisPreparation(
          tx,
          await lignesPrepaDepuisProduction(tx, new Date(), [s.contNum]),
        ),
      )
    })
    const bandeaux = (await actives(s.contNum)).filter((l) => l.idThemeBandeau !== null)
    expect(bandeaux).toHaveLength(1)
    expect(bandeaux[0]).toMatchObject({
      supportId: bandeau.id,
      theme: 'Bandeau R',
      qtePrepa: 20,
      idThemeBandeau: 77,
    })
  })

  it('RG-COO-096 ligne créée par la prépa : DA chapeau reprise de la copie (dossier, semaine, année) ; rejet : copie d’une autre semaine ignorée', async () => {
    const s = await site()
    await f.createPrepaBroadcast(db, {
      idDossierDeVenteChapeau: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
      idDaChapeau: 4242,
    })
    await f.createPrepaBroadcast(db, {
      idDossierDeVenteChapeau: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      idDaChapeau: 9999,
    })
    await integrer([prepa(s, { semaine: S, theme: 'Cette semaine' })])
    await integrer([prepa(s, { semaine: plus(S, 2), theme: 'Sans copie' })])
    const ls = await actives(s.contNum)
    expect(ls.find((l) => l.theme === 'Cette semaine')?.idDaChapeau).toBe(4242)
    expect(ls.find((l) => l.theme === 'Sans copie')?.idDaChapeau).toBeNull()
  })
})

// ───────────────── RG-COO-098 / 100 / 101 cas multi ─────────────────

describe('RG-COO-098 / 100 / 101 cas multi (complément)', () => {
  it('RG-COO-098 / RG-X-060 affiche répartie sur deux dossiers : le reçu est compté une fois au total (grain Format)', async () => {
    const s = await site()
    const d2 = s.contNum + 1
    await lire([
      lue(s, { semaine: S, quantite: 6 }),
      lue(s, { contNum: d2, semaine: S, quantite: 4 }),
    ])
    const l1 = await seule(s.contNum)
    const l2 = await seule(d2)
    const a = await recevoir(s, l1.id, 10)
    await db.afficheAttendue.updateMany({ where: { afficheId: a }, data: { quantite: 6 } })
    const v = await db.affiche.findUniqueOrThrow({ where: { id: a } })
    await post(ctx, `/api/affiches/${String(a)}/rattachements`, s.coord, {
      version: v.version,
      ligneAttendueId: l2.id,
      quantite: 4,
    })
    const r = await edr(s.coord, `grain=FORMAT&plateformeId=${String(s.plateforme.id)}`)
    expect(r.totaux).toMatchObject({ attendu: 10, recu: 10 })
  })

  it('RG-COO-100 dossier sur deux plateformes : au grain DA, une ligne par plateforme pour un utilisateur des deux sites', async () => {
    const s = await site()
    const deux = await site()
    await lire([lue(s, { quantite: 40 }), lue(deux, { contNum: s.contNum, quantite: 60 })])
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s.plateforme.id }, { plateformeId: deux.plateforme.id }],
    )
    const r = await edr(devHeaders(u.identifiantExterne), `dossier=${String(s.contNum)}&grain=DA`)
    expect(r.items.map((x) => [x.plateforme, x.attendu]).sort()).toEqual(
      [
        [s.plateforme.nom, 40],
        [deux.plateforme.nom, 60],
      ].sort(),
    )
    const dossier = await edr(
      devHeaders(u.identifiantExterne),
      `dossier=${String(s.contNum)}&grain=DOSSIER`,
    )
    expect(dossier.items[0]?.attendu).toBe(100)
  })

  it('RG-COO-101 quantités différentes selon la semaine (100 en S+1, 80 en S+2) ⇒ attendu compté une fois (max, Q-187 (3)) à tous les grains', async () => {
    const s = await site()
    await lire([
      lue(s, { semaine: plus(S, 1), quantite: 100 }),
      lue(s, { semaine: plus(S, 2), quantite: 80 }),
    ])
    for (const grain of ['THEME', 'DOSSIER', 'DA', 'FORMAT']) {
      const r = await edr(s.coord, `dossier=${String(s.contNum)}&grain=${grain}`)
      expect(r.items, grain).toHaveLength(1)
      expect(r.items[0]?.attendu, grain).toBe(100)
      expect(r.totaux.attendu, grain).toBe(100)
    }
  })

  it('RG-COO-101 reçu sur les deux semaines : somme des liens, reste = attendu − reçu', async () => {
    const s = await site()
    await lire([
      lue(s, { semaine: S, quantite: 100 }),
      lue(s, { semaine: plus(S, 1), quantite: 100 }),
    ])
    const [l1, l2] = await actives(s.contNum)
    if (!l1 || !l2) throw new Error('lignes')
    await recevoir(s, l1.id, 30)
    await recevoir(s, l2.id, 20)
    const r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items[0]).toMatchObject({
      attendu: 100,
      recu: 50,
      resteARecevoir: 50,
      reperes: ['MULTI_SEMAINES'],
    })
  })
})

// ───────────────── RG-COO-105 suivi de production ─────────────────

describe('RG-COO-105 suivi de production (complément)', () => {
  it('RG-COO-105 rejet : ligne BC portant une affiche validée absente ; ligne PREPA fermée absente', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S, theme: 'BC seul' })])
    const bc = await seule(s.contNum)
    await db.receptionAttendue.update({ where: { id: bc.id }, data: { atelierId: atelier.id } })
    const a = await recevoir(s, bc.id, 5)
    await db.affiche.update({ where: { id: a }, data: { validationAdmin: true } })
    await integrer([prepa(s, { theme: 'Prépa fermée', atelierId: atelier.id })])
    const pf = (await actives(s.contNum)).find((l) => l.theme === 'Prépa fermée')
    if (!pf) throw new Error('ligne')
    await withTransaction(db, (tx) => fermerLigne(tx, pf, new Date(), 'test', 'RG-COO-087'))
    const r = await suivi(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items).toEqual([])
  })

  it('RG-COO-105 l’affiche validée avant la prépa apparaît avec son n° quand la prépa arrive', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await lire([lue(s, { semaine: S })])
    const l = await seule(s.contNum)
    const a = await recevoir(s, l.id, 5)
    await db.affiche.update({ where: { id: a }, data: { validationAdmin: true } })
    expect((await suivi(s.coord, `dossier=${String(s.contNum)}`)).items).toEqual([])
    await integrer([prepa(s, { atelierId: atelier.id })])
    const r = await suivi(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items.map((x) => x.numerosAffiche)).toEqual([[a]])
  })
})

// ───────────────── RG-COO-107 / 108 / 026 état des réservations ─────────────────

describe('RG-COO-107 / RG-COO-108 / RG-COO-026 état des réservations (complément)', () => {
  it('RG-COO-107 limite : une ligne de la semaine passée (S-1) n’est pas affichée ; celle de la semaine en cours l’est', async () => {
    const s = await site()
    await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: plus(S, -1).annee,
      semNum: plus(S, -1).semaine,
      theme: 'Passée',
      themeCle: 'PASSEE',
    })
    await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
      theme: 'Courante',
      themeCle: 'COURANTE',
    })
    const r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items.map((x) => x.visuel)).toEqual(['Courante'])
  })

  it('RG-COO-107 / Q-187 (8) après les IP, la ligne provisoire fermée n’apparaît plus (ni repère PROVISOIRE)', async () => {
    const s = await site()
    await lire([lue(s, { theme: null })])
    await lire([lue(s, { theme: 'Thème IP' })])
    const r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({ visuel: 'Thème IP', reperes: [], ou: 'IP_SAISIES' })
  })

  // Audit COO-P05 (maquette `PHASES`, Q-187 (6) corrigée) : « validation admin à confirmer » compte en pré-production.
  it('RG-COO-107 indicateurs : « Affiches attendues » = prépa reçue et reçues en partie ; validation à confirmer en pré-production (Q-187 (6))', async () => {
    const s = await site()
    const d = [s.contNum, s.contNum + 1, s.contNum + 2]
    await lire(d.map((contNum) => lue(s, { contNum, semaine: S, quantite: 10 })))
    await integrer(d.map((contNum) => prepa(s, { contNum, quantite: 10 })))
    const l2 = await seule(d[1] ?? 0)
    const l3 = await seule(d[2] ?? 0)
    await recevoir(s, l2.id, 4)
    await recevoir(s, l3.id, 10)
    const ous = []
    for (const contNum of d)
      ous.push((await edr(s.coord, `dossier=${String(contNum)}`)).items[0]?.ou)
    expect(ous).toEqual(['PREPA_RECUE', 'RECUES_EN_PARTIE', 'VALIDATION_A_CONFIRMER'])
    const tous = await edr(s.coord, `plateformeId=${String(s.plateforme.id)}`)
    expect(tous.indicateurs).toMatchObject({
      dossiers: 3,
      affichesAttendues: 2,
      enPreProduction: 1,
    })
  })

  it('RG-COO-026 rejet (ANO-05 legacy) : une affiche reçue NON validée n’affiche pas « Non » : « Oui » et N° « • »', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, quantite: 10 })])
    const l = await seule(s.contNum)
    const a = await recevoir(s, l.id, 10)
    const r = await edr(s.coord, `dossier=${String(s.contNum)}`)
    expect(r.items[0]).toMatchObject({
      afficheRecue: 'OUI',
      numerosAffiche: [{ id: a, marque: '•' }],
    })
  })

  it('RG-COO-026 / RG-COO-107 « Affiche reçue » : Partielle, puis « Oui, surplus » au-delà de l’attendu', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, quantite: 10 })])
    const l = await seule(s.contNum)
    await recevoir(s, l.id, 4)
    expect((await edr(s.coord, `dossier=${String(s.contNum)}`)).items[0]?.afficheRecue).toBe(
      'PARTIELLE',
    )
    await recevoir(s, l.id, 8)
    expect((await edr(s.coord, `dossier=${String(s.contNum)}`)).items[0]).toMatchObject({
      afficheRecue: 'OUI_SURPLUS',
      resteARecevoir: 0,
    })
  })

  it('RG-COO-108 utilisateur de deux sites : voit les deux ; le site choisi (plateformeId de son périmètre) restreint à celui-ci', async () => {
    const s = await site()
    const deux = await site()
    await lire([lue(s), lue(deux)])
    const u = await f.createUtilisateurAvecRoles(
      db,
      ['cheq'],
      [{ plateformeId: s.plateforme.id }, { plateformeId: deux.plateforme.id }],
    )
    const h = devHeaders(u.identifiantExterne)
    const tous = await edr(h)
    const dossiers = tous.items.map((x) => x.dossier)
    expect(dossiers).toEqual(expect.arrayContaining([s.contNum, deux.contNum]))
    const un = await edr(h, `plateformeId=${String(deux.plateforme.id)}`)
    expect(un.items.map((x) => x.dossier)).toEqual([deux.contNum])
  })

  it('RG-COO-108 rejet : plateforme du périmètre non gérée par Broadcast (sans site CCF) choisie ⇒ 200, aucune ligne, sans alerte', async () => {
    const s = await site()
    const nonGeree = await f.createPlateforme(db)
    await f.createReceptionAttendue(db, {
      plateformeId: nonGeree.id,
      contNum: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
    })
    const u = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: nonGeree.id }])
    const r = await edr(devHeaders(u.identifiantExterne), `plateformeId=${String(nonGeree.id)}`)
    expect(r.items).toEqual([])
    expect(r.total).toBe(0)
  })

  it('RG-COO-107 entrée invalide : grain inconnu, départ mal formé, pageSize > 100 ⇒ 400', async () => {
    const s = await site()
    for (const q of ['grain=CAMION', 'depart=2026-43', 'pageSize=101', 'ou=INCONNU'])
      expect((await get(ctx, `/api/coordination/reservations?${q}`, s.coord)).statusCode, q).toBe(
        400,
      )
  })

  it('RG-COO-107 lecture seule : la consultation n’écrit rien (aucune ligne ni version modifiée)', async () => {
    const s = await site()
    await lire([lue(s)])
    const avant = await seule(s.contNum)
    await edr(s.coord, `dossier=${String(s.contNum)}`)
    await suivi(s.coord, `dossier=${String(s.contNum)}`)
    expect(await ligneParId(avant.id)).toMatchObject({ version: avant.version })
    expect(await lignesDe(s.contNum)).toHaveLength(1)
  })
})

// Idempotency-Key : les traitements d'alimentation n'ont pas de POST (contrat interne, Q-187 (1)) ; l'idempotence
// est celle du rejeu (RG-COO-080 / 085 / 086 ci-dessus). Le seul POST du parcours touchant les lignes est le
// rattachement manuel (RG-COO-099) : rejeu avec la même clé ⇒ un seul lien.
describe('RG-COO-099 idempotence du rattachement manuel du surplus (complément)', () => {
  it('RG-COO-099 même Idempotency-Key deux fois ⇒ un seul lien créé, même réponse', async () => {
    const s = await site()
    const d2 = s.contNum + 1
    await lire([
      lue(s, { semaine: S, quantite: 6 }),
      lue(s, { contNum: d2, semaine: S, quantite: 4 }),
    ])
    const l1 = await seule(s.contNum)
    const l2 = await seule(d2)
    const a = await recevoir(s, l1.id, 10)
    await db.afficheAttendue.updateMany({ where: { afficheId: a }, data: { quantite: 6 } })
    const v = await db.affiche.findUniqueOrThrow({ where: { id: a } })
    const cle = idem()
    const envoi = () =>
      ctx.app.inject({
        method: 'POST',
        url: `/api/affiches/${String(a)}/rattachements`,
        headers: { ...s.coord, ...cle },
        payload: { version: v.version, ligneAttendueId: l2.id, quantite: 4 },
      })
    const r1 = await envoi()
    const r2 = await envoi()
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(
      await db.afficheAttendue.count({ where: { afficheId: a, ligneAttendueId: l2.id } }),
    ).toBe(1)
  })

  it('RG-COO-099 rejet : ligne cible fermée (ANNULEE) ⇒ refus, aucun lien', async () => {
    const s = await site()
    await lire([lue(s, { semaine: S, quantite: 6 })])
    const l1 = await seule(s.contNum)
    const fermee = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum + 1,
      semAnnee: S.annee,
      semNum: S.semaine,
      etatLigne: 'ANNULEE',
    })
    const a = await recevoir(s, l1.id, 10)
    await db.afficheAttendue.updateMany({ where: { afficheId: a }, data: { quantite: 6 } })
    const v = await db.affiche.findUniqueOrThrow({ where: { id: a } })
    const r = await post(ctx, `/api/affiches/${String(a)}/rattachements`, s.coord, {
      version: v.version,
      ligneAttendueId: fermee.id,
      quantite: 4,
    })
    expect([409, 422]).toContain(r.statusCode)
    expect(
      await db.afficheAttendue.count({ where: { afficheId: a, ligneAttendueId: fermee.id } }),
    ).toBe(0)
  })
})
