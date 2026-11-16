// Couverture FONCTIONNELLE des routes par les générateurs de JDD (pas une couverture de code : aucun outil installé,
// CLAUDE.md §3) : liste les routes de l'API et celles réellement appelées pendant une génération complète.
// Usage : pnpm --filter @circe/api exec tsx test/massif/couverture-routes.ts [seed] [volume]
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb } from '../../src/core/db.ts'
import { seedRef } from '../../src/reference/seed-ref.ts'
import { chargerEnvTest, genererJdd } from '../jdd/run.ts'
import { purger, relevoirRepere } from '../jdd/purge.ts'
import { contexteReception } from '../support/reception.ts'

chargerEnvTest()
const config = loadConfig()
const db = createDb(config.DATABASE_URL)
await seedRef(db)
const app = buildApp({ config, db, closeDb: () => db.$disconnect() })
const toutes = new Set<string>()
const appelees = new Set<string>()
app.addHook('onRoute', (r) => {
  for (const m of Array.isArray(r.method) ? r.method : [r.method])
    if (m !== 'HEAD' && m !== 'OPTIONS') toutes.add(`${m} ${r.url}`)
})
app.addHook('onResponse', (req, rep) => {
  if (rep.statusCode !== 404) appelees.add(`${req.method} ${req.routeOptions.url ?? ''}`)
})
await app.ready()
const ctx = contexteReception()
ctx.app = app
Object.assign(ctx, { db })
const repere = await relevoirRepere(db)
try {
  await genererJdd(
    ctx,
    { seed: Number(process.argv[2] ?? 71), volume: Number(process.argv[3] ?? 300) },
    repere,
  )
} finally {
  await purger(db, repere)
  await app.close()
}
const api = [...toutes].filter((r) => r.includes('/api/')).sort()
const couvertes = api.filter((r) => appelees.has(r))
const manquantes = api.filter((r) => !appelees.has(r))
console.log(
  `routes API : ${String(api.length)} ; appelées par le JDD : ${String(couvertes.length)} (${String(Math.round((100 * couvertes.length) / api.length))} %)`,
)
const parModule = new Map<string, [number, number]>()
for (const r of api) {
  const m = /\/api\/(admin|coordination|alertes|me|health)?/.exec(r)?.[1] ?? 'reception'
  const [n, c] = parModule.get(m) ?? [0, 0]
  parModule.set(m, [n + 1, c + (appelees.has(r) ? 1 : 0)])
}
for (const [m, [n, c]] of parModule) console.log(`  ${m.padEnd(14)} ${String(c)}/${String(n)}`)
if (process.argv[4] === 'liste') for (const r of manquantes) console.log(`  non appelée : ${r}`)
