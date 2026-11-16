// integration:lot <fichier.json> — passage d'intégration Broadcast sur un lot déposé (contrat d'entrée
// Q-188 (1)) : point d'entrée d'un ordonnanceur externe tant que la source réelle n'est pas connue (Q-005).
// RG-COO-102 (verrou, un seul passage), RG-COO-115 / 116 (ordre fixe, journal de chargement).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LotIntegrationSchema } from '@circe/shared'
import { createDb } from '../src/core/db.ts'
import { BroadcastNonConfigure } from '../src/core/ports/broadcast.ts'
import { lancerPassage } from '../src/modules/coordination/integration-broadcast.ts'

process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
const url = process.env['DATABASE_URL'] ?? ''
const fichier = process.argv[2]
if (!url.startsWith('file:') || !fichier) {
  console.error(
    'Usage : pnpm --filter @circe/api integration:lot <fichier.json> (DATABASE_URL requis)',
  )
  process.exit(1)
}
const lot = LotIntegrationSchema.parse(JSON.parse(readFileSync(resolve(fichier), 'utf8')))
const db = createDb(url)
try {
  const passage = await lancerPassage(
    { db, broadcast: new BroadcastNonConfigure() },
    { declencheur: 'LOT', identity: null, lot },
  )
  console.log(JSON.stringify(passage, null, 2))
  process.exitCode = passage.statut === 'SUCCES' ? 0 : 2
} finally {
  await db.$disconnect()
}
