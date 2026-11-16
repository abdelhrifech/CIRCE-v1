import { telemetry } from './telemetry-bootstrap.ts'
import { buildAdminServer } from './core/observability/admin.ts'
import { buildApp } from './app.ts'
import { loadConfig } from './core/config.ts'
import { createDb } from './core/db.ts'
import { creerMailPort } from './core/ports/mail.ts'
import { demarrerOrdonnanceur } from './modules/taches/service.ts'
import { BroadcastNonConfigure } from './core/ports/broadcast.ts'
import { demarrerPlanificateur } from './modules/coordination/integration-broadcast.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
// Q-005 : aucune source Broadcast réelle ; le planificateur (RG-COO-103) ne démarre que si elle est configurée.
const broadcast = new BroadcastNonConfigure()
const mail = creerMailPort(config)
const admin = buildAdminServer(db, config.ADMIN_READY_TIMEOUT_MS)
const app = buildApp({
  config,
  db,
  broadcast,
  mail,
  closeDb: () => db.$disconnect(),
  telemetryPlugin: telemetry.fastify.plugin(),
})
// D-20 (Q-410) : ordonnanceur interne, désactivable (ORDONNANCEUR_ACTIF=false) ; sans horaire configuré il n'exécute rien.
const arreterOrdonnanceur =
  config.ORDONNANCEUR_ACTIF === 'true'
    ? demarrerOrdonnanceur({ db, mail }, (message, erreur) => {
        app.log.error({ err: erreur }, message)
      })
    : () => undefined
const arreterPlanificateur = demarrerPlanificateur({ db, broadcast }, (message, erreur) => {
  app.log.error({ err: erreur }, message)
})
app.addHook('onClose', () => {
  arreterPlanificateur()
  arreterOrdonnanceur()
  return Promise.resolve()
})

let stopping = false
async function stop(signal: string): Promise<void> {
  if (stopping) return
  stopping = true
  admin.setDraining()
  app.log.info({ signal }, 'Arrêt demandé')
  await app.close()
  await admin.app.close()
  try {
    await telemetry.sdk.shutdown()
  } catch {
    app.log.warn('Telemetry shutdown did not complete')
  }
  process.exit(0)
}
process.on('SIGINT', () => void stop('SIGINT'))
process.on('SIGTERM', () => void stop('SIGTERM'))

try {
  await admin.app.listen({ host: config.ADMIN_HOST, port: config.ADMIN_PORT })
  await app.listen({ host: config.API_HOST, port: config.API_PORT })
} catch (error) {
  await app.close()
  await admin.app.close()
  await telemetry.sdk.shutdown()
  throw error
}
