// Étape 9 — tests MASSIFS d'intégration : les générateurs de JDD (test/jdd/) produisent plusieurs milliers
// d'enregistrements par seed sur la base de TEST ; les tests PARCOURENT ensuite ces données et vérifient les invariants
// (test/massif/invariants.ts : intégrité, historique de statut, versions, quantités, cohérence Réception ↔ Coordination,
// UM / colis, clés métier). Aucun test unitaire. Réglages : JDD_SEEDS (défaut 101,202,303) et JDD_VOLUME (défaut 400).
// Chaque génération a son repère de purge : tout ce qui a été créé est supprimé en fin de test (isolation).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerRng } from '../jdd/prng.ts'
import { genererJdd, selectionner, type RapportJdd } from '../jdd/run.ts'
import { compterDepuis, purger, relevoirRepere, tablesDe, type Repere } from '../jdd/purge.ts'
import { contexteReception } from '../support/reception.ts'
import { controlerInvariants, INVARIANTS } from './invariants.ts'
import { SCENARIOS } from '../jdd/scenarios/index.ts'

const SEEDS = (process.env['JDD_SEEDS'] ?? '101,202,303').split(',').map(Number)
const VOLUME = Number(process.env['JDD_VOLUME'] ?? 400)
const ctx = contexteReception()
const { db } = ctx
const LONG = 600_000

beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const signature = async (repere: Repere) => {
  const comptes = await compterDepuis(db, repere)
  const lignes = await db.receptionAttendue.findMany({
    where: { id: { gt: repere['tf_prepa_affiche'] ?? 0 } },
    select: { theme: true, qteBc: true, statut: true, etatLigne: true, semNum: true },
    orderBy: { id: 'asc' },
  })
  const mouvements = await db.mouvement.findMany({
    where: { id: { gt: repere['mouvement'] ?? 0 } },
    select: { type: true, quantite: true },
    orderBy: { id: 'asc' },
  })
  return JSON.stringify({ comptes, lignes, mouvements })
}

describe('PRNG déterministe (famille de générateurs)', () => {
  it('JDD-001 une même seed produit la même suite, deux seeds produisent des suites différentes', () => {
    const a = creerRng(42)
    const b = creerRng(42)
    const c = creerRng(43)
    const sa = Array.from({ length: 50 }, () => a.entier(0, 1_000_000))
    expect(Array.from({ length: 50 }, () => b.entier(0, 1_000_000))).toEqual(sa)
    expect(Array.from({ length: 50 }, () => c.entier(0, 1_000_000))).not.toEqual(sa)
  })

  it('JDD-002 les douze familles de la skill circe-jdd (+ « aleatoire ») existent, chacune documentée (RG, état attendu)', () => {
    expect(SCENARIOS.map((s) => s.nom).sort()).toEqual(
      [
        'aleatoire',
        'concurrence',
        'doublons',
        'incomplet',
        'inter-modules',
        'invalides',
        'limites',
        'nominal',
        'profils',
        'rejets-reprises',
        'statuts',
        'transitions-interdites',
        'volumetrie',
      ].sort(),
    )
    for (const s of SCENARIOS) {
      expect(s.regles.length, s.nom).toBeGreaterThan(0)
      expect(s.attendu.length, s.nom).toBeGreaterThan(10)
    }
    expect(() => selectionner(['inconnue'])).toThrow(/famille inconnue/)
  })
})

describe.each(SEEDS)('seed %i : génération massive puis invariants', (seed) => {
  let rapport: RapportJdd
  let repere: Repere

  beforeAll(async () => {
    repere = await relevoirRepere(db)
    rapport = await genererJdd(ctx, { seed, volume: VOLUME }, repere)
  }, LONG)

  afterAll(async () => {
    await purger(db, repere)
  }, LONG)

  it(`JDD-010 toutes les familles ont tourné et créé des données (volume ${String(VOLUME)})`, () => {
    expect(rapport.scenarios.map((s) => s.nom)).toEqual(SCENARIOS.map((s) => s.nom))
    // « Plusieurs milliers d'enregistrements » par seed.
    expect(rapport.totalEnregistrements).toBeGreaterThan(Math.min(5000, VOLUME * 10))
    console.log(
      `MASSIF seed=${String(seed)} volume=${String(VOLUME)} enregistrements=${String(rapport.totalEnregistrements)} duree_ms=${String(rapport.dureeMs)} ` +
        rapport.scenarios.map((s) => `${s.nom}=${String(s.dureeMs)}ms`).join(' '),
    )
  })

  it('JDD-011 toutes les vérifications faites PENDANT la génération sont satisfaites (rejets 400/404/409/422 avec code et règle, doublons, profils, transitions, concurrence, cellules inter-modules)', () => {
    const echecs = rapport.scenarios.flatMap((s) => s.verifications.filter((v) => !v.ok))
    expect(echecs).toEqual([])
    const total = rapport.scenarios.reduce((n, s) => n + s.verifications.length, 0)
    expect(total).toBeGreaterThan(100)
    for (const nom of [
      'invalides',
      'transitions-interdites',
      'doublons',
      'profils',
      'statuts',
      'concurrence',
      'inter-modules',
      'rejets-reprises',
    ])
      expect(
        rapport.scenarios.find((s) => s.nom === nom)?.verifications.length,
        nom,
      ).toBeGreaterThan(0)
  })

  it(
    'JDD-012 aucun invariant violé : intégrité, historique de statut, versions, quantités, cohérence Réception ↔ Coordination, UM / colis, clés métier',
    async () => {
      const r = await controlerInvariants(db, repere)
      expect(r.verifies).toBe(INVARIANTS.length)
      expect(r.violations).toEqual([])
    },
    LONG,
  )

  it('JDD-013 isolation : les données du JDD ne touchent que leurs propres sites (aucune ligne du JDD sur un site hors JDD)', async () => {
    const hors = await db.receptionAttendue.count({
      where: {
        id: { gt: repere['tf_prepa_affiche'] ?? 0 },
        plateforme: { id: { lte: repere['tr_plateforme'] ?? 0 } },
      },
    })
    expect(hors).toBe(0)
  })
})

describe('déterminisme, purge et détection des corruptions', () => {
  it(
    'JDD-020 même seed = mêmes données (comptes par table, lignes, mouvements) ; seed différente = données différentes',
    async () => {
      const run = async (seed: number) => {
        const repere = await relevoirRepere(db)
        await genererJdd(
          ctx,
          { seed, volume: 60, scenarios: ['nominal', 'incomplet', 'limites', 'inter-modules'] },
          repere,
        )
        const s = await signature(repere)
        await purger(db, repere)
        return s
      }
      const a = await run(7)
      const b = await run(7)
      const c = await run(8)
      expect(b).toBe(a)
      expect(c).not.toBe(a)
    },
    LONG,
  )

  it(
    'JDD-021 la purge ne laisse rien : mêmes comptes de lignes avant et après, aucune FK orpheline',
    async () => {
      const avant = await Promise.all(
        (await tablesDe(db)).map(
          async (t) =>
            [
              t,
              (await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*) AS c FROM "${t}"`))[0]
                ?.c ?? 0n,
            ] as const,
        ),
      )
      const repere = await relevoirRepere(db)
      await genererJdd(ctx, { seed: 9, volume: 40 }, repere)
      const supprimees = await purger(db, repere)
      expect(Object.values(supprimees).reduce((a, b) => a + b, 0)).toBeGreaterThan(500)
      const apres = await Promise.all(
        (await tablesDe(db)).map(
          async (t) =>
            [
              t,
              (await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*) AS c FROM "${t}"`))[0]
                ?.c ?? 0n,
            ] as const,
        ),
      )
      expect(apres).toEqual(avant)
      expect(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([])
    },
    LONG,
  )

  it(
    'JDD-022 les invariants DÉTECTENT les corruptions (témoins négatifs) : stock négatif, validation sans lien, ligne au mauvais statut, dossier annulé à ligne active, colis clos sans date',
    async () => {
      const repere = await relevoirRepere(db)
      await genererJdd(ctx, { seed: 10, volume: 60, scenarios: ['nominal', 'statuts'] }, repere)
      try {
        expect((await controlerInvariants(db, repere)).violations).toEqual([])
        const ids = async (sql: string) =>
          (await db.$queryRawUnsafe<{ id: number | bigint }[]>(sql)).map((r) => Number(r.id))
        const apresRepere = (t: string) => `rowid > ${String(repere[t] ?? 0)}`
        const [orph] = await ids(
          `SELECT affiche_id AS id FROM affiche WHERE ${apresRepere('affiche')} AND statut = 'ORPHELINE' LIMIT 1`,
        )
        const [ident] = await ids(
          `SELECT affiche_id AS id FROM affiche WHERE ${apresRepere('affiche')} AND statut = 'IDENTIFIEE' LIMIT 1`,
        )
        const [attendue] = await ids(
          `SELECT id FROM tf_prepa_affiche WHERE ${apresRepere('tf_prepa_affiche')} AND statut = 'ATTENDUE' AND etat_ligne = 'ACTIVE' LIMIT 1`,
        )
        const [colis] = await ids(
          `SELECT colis_id AS id FROM tf_colis WHERE ${apresRepere('tf_colis')} AND statut = 'TERMINE' LIMIT 1`,
        )
        const [actif] = await ids(
          `SELECT d.id FROM dossier d JOIN tf_prepa_affiche l ON l.cont_num = d.cont_num WHERE d.${apresRepere('dossier')} AND l.etat_ligne = 'ACTIVE' AND d.statut <> 'ANNULE' LIMIT 1`,
        )
        const mauvais = [
          {
            sql: `UPDATE affiche SET validation_admin = 1 WHERE affiche_id = ${String(orph)}`,
            annule: `UPDATE affiche SET validation_admin = 0 WHERE affiche_id = ${String(orph)}`,
            attendu: 'INV-040',
          },
          {
            sql: `INSERT INTO mouvement (affiche_id, type, date, quantite, comptee, auto) VALUES (${String(ident)}, 'SORTIE_MANUELLE', 0, -999999, 0, 0)`,
            annule: `DELETE FROM mouvement WHERE affiche_id = ${String(ident)} AND quantite = -999999`,
            attendu: 'INV-031',
          },
          {
            sql: `UPDATE tf_prepa_affiche SET statut = 'COMPLETE' WHERE id = ${String(attendue)}`,
            annule: `UPDATE tf_prepa_affiche SET statut = 'ATTENDUE' WHERE id = ${String(attendue)}`,
            attendu: 'INV-030',
          },
          {
            sql: `UPDATE tf_colis SET colis_dat_expe = NULL WHERE colis_id = ${String(colis)}`,
            annule: `UPDATE tf_colis SET colis_dat_expe = 0 WHERE colis_id = ${String(colis)}`,
            attendu: 'INV-052',
          },
          {
            sql: `UPDATE dossier SET statut = 'ANNULE' WHERE id = ${String(actif)}`,
            annule: `UPDATE dossier SET statut = 'A_TRAITER' WHERE id = ${String(actif)}`,
            attendu: 'INV-043',
          },
        ]
        for (const m of mauvais) {
          await db.$executeRawUnsafe(m.sql)
          const r = await controlerInvariants(db, repere)
          await db.$executeRawUnsafe(m.annule)
          expect(
            r.violations.map((v) => v.id),
            m.sql,
          ).toContain(m.attendu)
        }
      } finally {
        await purger(db, repere)
      }
    },
    LONG,
  )
})
