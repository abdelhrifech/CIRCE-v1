// Générateurs de JDD reproductibles (étape 9) : pnpm jdd --seed=<n> --volume=<n> [--scenarios=a,b] [--keep]
// Base de TEST uniquement (apps/api/prisma/test.db) : le script charge .env.test et refuse toute autre base.
import { chargerEnvTest, executerJdd } from '../test/jdd/run.ts'

function lireArgs(argv: string[]) {
  const o: Record<string, string> = {}
  for (const a of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a)
    if (m?.[1]) o[m[1]] = m[2] ?? 'true'
  }
  return o
}

const args = lireArgs(process.argv.slice(2))
chargerEnvTest()
const seed = Number(args['seed'] ?? 42)
const volume = Number(args['volume'] ?? 300)
const scenarios = args['scenarios']?.split(',').filter(Boolean)
const rapport = await executerJdd({
  seed,
  volume,
  ...(scenarios ? { scenarios } : {}),
  purge: args['keep'] !== 'true',
})
if (args['json'] === 'true') console.log(JSON.stringify(rapport, null, 2))
else {
  console.log(
    `seed=${String(seed)} volume=${String(volume)} : ${String(rapport.totalEnregistrements)} enregistrements en ${String(rapport.dureeMs)} ms`,
  )
  for (const s of rapport.scenarios) {
    const ko = s.verifications.filter((v) => !v.ok).length
    console.log(
      `  ${s.nom.padEnd(22)} ${String(s.dureeMs).padStart(7)} ms  vérifications ${String(s.verifications.length - ko)}/${String(s.verifications.length)} OK`,
    )
  }
  const tables = Object.entries(rapport.enregistrements)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
  console.log(`  principales tables : ${tables.map(([t, n]) => `${t}=${String(n)}`).join(', ')}`)
}
const echecs = rapport.scenarios.flatMap((s) => s.verifications.filter((v) => !v.ok))
for (const v of echecs)
  console.error(`  KO [${v.scenario}] ${v.nom} : attendu ${v.attendu}, obtenu ${v.obtenu}`)
if (echecs.length > 0) {
  console.error(`${String(echecs.length)} vérification(s) en échec`)
  process.exitCode = 1
}
