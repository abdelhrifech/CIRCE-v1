// Utilitaire de diagnostic (hors test) : génère une seed, contrôle les invariants, affiche les violations, purge.
import { chargerEnvTest, genererJdd } from '../jdd/run.ts'
import { contexteReception } from '../support/reception.ts'
import { purger, relevoirRepere } from '../jdd/purge.ts'
import { controlerInvariants } from './invariants.ts'

chargerEnvTest()
const seed = Number(process.argv[2] ?? 11)
const volume = Number(process.argv[3] ?? 200)
const familles = process.argv[4]?.split(',').filter(Boolean)
const ctx = contexteReception()
await ctx.demarrer()
const repere = await relevoirRepere(ctx.db)
try {
  const rapport = await genererJdd(
    ctx,
    { seed, volume, ...(familles ? { scenarios: familles } : {}) },
    repere,
  )
  console.log(`${String(rapport.totalEnregistrements)} enregistrements`)
  for (const sc of rapport.scenarios)
    for (const v of sc.verifications.filter((x) => !x.ok))
      console.log(`KO [${sc.nom}] ${v.nom} : ${v.obtenu.slice(0, 300)}`)
  const r = await controlerInvariants(ctx.db, repere)
  console.log(`${String(r.verifies)} invariants, ${String(r.violations.length)} violation(s)`)
  for (const v of r.violations) console.log(JSON.stringify(v).slice(0, 1200))
} finally {
  await purger(ctx.db, repere)
  await ctx.arreter()
}
