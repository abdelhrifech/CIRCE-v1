import { chargerEnvTest, genererJdd } from '../jdd/run.ts'
import { contexteReception } from '../support/reception.ts'
import { purger, relevoirRepere } from '../jdd/purge.ts'
import { devHeaders } from '../support/identite.ts'

chargerEnvTest()
const ctx = contexteReception()
await ctx.demarrer()
const repere = await relevoirRepere(ctx.db)
try {
  await genererJdd(
    ctx,
    { seed: 404, volume: Number(process.argv[2] ?? 4000), scenarios: ['volumetrie'] },
    repere,
  )
  const s = await ctx.db.plateforme.findFirstOrThrow({
    where: { id: { gt: repere['tr_plateforme'] ?? 0 } },
    orderBy: { id: 'asc' },
  })
  const coord = await ctx.db.utilisateur.findFirstOrThrow({
    where: {
      perimetres: { some: { plateformeId: s.id } },
      roles: { some: { role: { code: 'coord' } } },
    },
  })
  const h = devHeaders(coord.identifiantExterne)
  for (const url of (process.argv[3] ?? '/api/coordination/dossiers').split(',')) {
    const t = performance.now()
    const r = await ctx.app.inject({ method: 'GET', url, headers: h })
    console.log(url, r.statusCode, Math.round(performance.now() - t), 'ms')
  }
} finally {
  await purger(ctx.db, repere)
  await ctx.arreter()
}
