// Exécuteur des générateurs de JDD (étape 9) : `executerJdd({ seed, volume, scenarios })`. Chaque famille de la skill
// circe-jdd est un module de `scenarios/`. Base de TEST uniquement (garde-fou) ; purge optionnelle en fin de passage.
import { resolve } from 'node:path'
import { fixerSequence } from '../factories/sequence.ts'
import { contexteReception, type Ctx } from '../support/reception.ts'
import { creerJdd, type VerificationJdd } from './contexte.ts'
import { compterDepuis, purger, relevoirRepere, type Repere } from './purge.ts'
import { SCENARIOS, type Scenario } from './scenarios/index.ts'

export interface OptionsJdd {
  seed: number
  volume: number
  /** Noms des familles (défaut : toutes, dans l'ordre de `SCENARIOS`). */
  scenarios?: readonly string[]
  /** Purger tout ce qui a été créé à la fin (défaut : oui). */
  purge?: boolean
}

export interface ResultatScenario {
  nom: string
  dureeMs: number
  compteurs: Record<string, number>
  verifications: VerificationJdd[]
}

export interface RapportJdd {
  seed: number
  volume: number
  scenarios: ResultatScenario[]
  /** Lignes réellement créées en base par table (avant purge). */
  enregistrements: Record<string, number>
  totalEnregistrements: number
  dureeMs: number
  purge: Record<string, number> | null
}

/** Garde-fou CLAUDE.md §7.7 : refus si DATABASE_URL ne vise pas test.db. */
export function verifierBaseDeTest(): void {
  const url = process.env['DATABASE_URL'] ?? ''
  if (!url.startsWith('file:') || !url.endsWith('test.db'))
    throw new Error(`Refus : DATABASE_URL (${url}) ne vise pas la base de test (test.db).`)
}

export function chargerEnvTest(): void {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../../.env.test'))
  verifierBaseDeTest()
}

export function selectionner(noms?: readonly string[]): Scenario[] {
  if (!noms || noms.length === 0) return [...SCENARIOS]
  return noms.map((n) => {
    const s = SCENARIOS.find((x) => x.nom === n)
    if (!s)
      throw new Error(
        `famille inconnue : ${n} (connues : ${SCENARIOS.map((x) => x.nom).join(', ')})`,
      )
    return s
  })
}

/** Génère les données d'une seed sur un contexte déjà démarré (`ctx.demarrer()`). Ne purge pas : voir `executerJdd`. */
export async function genererJdd(
  ctx: Ctx,
  o: OptionsJdd,
  repereDonne?: Repere,
): Promise<RapportJdd> {
  verifierBaseDeTest()
  const debut = Date.now()
  const repere = repereDonne ?? (await relevoirRepere(ctx.db))
  const ancienneSequence = fixerSequence(1_100_000_000 + o.seed * 1_000_000)
  const jdd = creerJdd(ctx, o.seed, o.volume)
  const resultats: ResultatScenario[] = []
  try {
    for (const s of selectionner(o.scenarios)) {
      jdd.scenario = s.nom
      jdd.reinitialiserCompteurs()
      const t0 = Date.now()
      const avant = jdd.verifications.length
      await s.generer(jdd)
      resultats.push({
        nom: s.nom,
        dureeMs: Date.now() - t0,
        compteurs: { ...jdd.compteurs },
        verifications: jdd.verifications.slice(avant),
      })
    }
  } finally {
    fixerSequence(ancienneSequence)
  }
  const enregistrements = await compterDepuis(ctx.db, repere)
  const total = Object.values(enregistrements).reduce((a, b) => a + b, 0)
  return {
    seed: o.seed,
    volume: o.volume,
    scenarios: resultats,
    enregistrements,
    totalEnregistrements: total,
    dureeMs: Date.now() - debut,
    purge: null,
  }
}

/** Démarre l'application sur la base de test, génère, purge (sauf `purge: false`), arrête. */
export async function executerJdd(o: OptionsJdd): Promise<RapportJdd> {
  verifierBaseDeTest()
  const ctx = contexteReception()
  await ctx.demarrer()
  const repere = await relevoirRepere(ctx.db)
  try {
    const rapport = await genererJdd(ctx, o)
    if (o.purge ?? true) rapport.purge = await purger(ctx.db, repere)
    return rapport
  } catch (e) {
    // Une génération interrompue ne laisse rien dans la base de test.
    if (o.purge ?? true) await purger(ctx.db, repere)
    throw e
  } finally {
    await ctx.arreter()
  }
}
