import Fastify, { type FastifyInstance, type FastifyPluginCallback } from 'fastify'
import { registerOpenApi } from './core/openapi.ts'
import { logContext, severity } from './core/observability/telemetry.ts'
import { registerHttpMetrics } from './core/observability/http-metrics.ts'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import type { Config } from './core/config.ts'
import type { Db } from './core/db.ts'
import { registerErrorHandler } from './core/error-handler.ts'
import { dbIdentityLoader, resolveIdentity, type IdentityLoader } from './core/identity.ts'
import { healthRoutes } from './modules/health/routes.ts'
import type { HealthDb } from './modules/health/service.ts'
import { meRoutes } from './modules/me/routes.ts'
import { receptionRoutes } from './modules/reception/routes.ts'
import { receptionSuiteRoutes } from './modules/reception/routes-suite.ts'
import { coordinationRoutes } from './modules/coordination/routes.ts'
import { integrationRoutes } from './modules/coordination/routes-integration.ts'
import { themesRoutes } from './modules/coordination/routes-themes.ts'
import { deblocageRoutes } from './modules/coordination/routes-deblocage.ts'
import { trainsRoutes } from './modules/coordination/routes-trains.ts'
import { exportTrainsRoutes } from './modules/coordination/routes-export-trains.ts'
import { roulageRoutes } from './modules/coordination/routes-roulage.ts'
import { destinatairesRoutes } from './modules/coordination/routes-destinataires.ts'
import { adminRoutes } from './modules/admin/routes.ts'
import { colisRoutes } from './modules/coordination/routes-colis.ts'
import { unitaireRoutes } from './modules/coordination/routes-unitaire.ts'
import { alertesRoutes } from './modules/alertes/routes.ts'
import { BroadcastNonConfigure, type BroadcastPort } from './core/ports/broadcast.ts'
import { creerMailPort, type MailPort } from './core/ports/mail.ts'
import { adminLot4Routes } from './modules/admin/routes-lot4.ts'
import { MachineNonConfiguree, MachineSimulee, type MachinePort } from './core/ports/machine.ts'

import { nonConformiteRoutes } from './modules/nonconformite/routes.ts'

import { nouveauPilotageRoutes } from './modules/pilotage/routes.ts'

import { busRoutes } from './modules/bus/routes.ts'

export interface AppDeps {
  config: Config
  db: Db
  /** Fermeture de la ressource base (ex. `db.$disconnect`). */
  closeDb?: () => Promise<void>
  /** Remplace la base du contrôle de santé (tests). */
  healthDb?: HealthDb
  /** Remplace le chargement de l'identité (tests). */
  identityLoader?: IdentityLoader
  /** Routes supplémentaires sous /api (modules métier, ou endpoints factices des tests). */
  routes?: (api: FastifyInstance) => void
  /** Technical instrumentation only; business services remain unchanged. */
  telemetryPlugin?: FastifyPluginCallback
  /** Échanges avec Broadcast (COO-P06) ; aucun adaptateur réel (Q-005) : non configuré par défaut. */
  broadcast?: BroadcastPort
  /** Envoi des fichiers de production à la machine (COO-P10) : simulé hors production (D-15, Q-193). */
  machine?: MachinePort
  /** Envoi des mails (D-19) : boîte d'envoi simulée par défaut ; SMTP seulement s'il est configuré (Q-409). */
  mail?: MailPort
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const { config, db } = deps
  // Both URL prefixes share the same adapters as well as the same business services.
  const broadcast = deps.broadcast ?? new BroadcastNonConfigure()
  const machine =
    deps.machine ??
    (config.NODE_ENV === 'production' ? new MachineNonConfiguree() : new MachineSimulee())
  const mail = deps.mail ?? creerMailPort(config)
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      messageKey: 'body',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: { level: severity },
      mixin: logContext,
      serializers: {
        req: (request: { method?: string; url?: string; hostname?: string; ip?: string }) => ({
          method: request.method,
          url: request.url?.split('?')[0],
          hostname: request.hostname,
          remoteAddress: request.ip,
        }),
      },
      redact: [
        'req.headers.authorization',
        'req.headers["x-dev-identity"]',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
    },
  })

  registerHttpMetrics(app)
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  registerErrorHandler(app)
  resolveIdentity(app, config, deps.identityLoader ?? dbIdentityLoader(db))

  registerOpenApi(app)
  const routes: FastifyPluginCallback = (api, _options, done) => {
    healthRoutes(api, deps.healthDb ?? db)
    meRoutes(api, db)
    receptionRoutes(api, db)
    receptionSuiteRoutes(api, db)
    coordinationRoutes(api, db)
    integrationRoutes(api, db, broadcast)
    themesRoutes(api, db)
    deblocageRoutes(api, db)
    trainsRoutes(api, db)
    exportTrainsRoutes(api, db, machine)
    roulageRoutes(api, db)
    unitaireRoutes(api, db)
    colisRoutes(api, db)
    destinatairesRoutes(api, db)
    adminRoutes(api, db)
    adminLot4Routes(api, db, mail, config.ORDONNANCEUR_ACTIF === 'true')
    busRoutes(api, db)
    nouveauPilotageRoutes(api, db)
    nonConformiteRoutes(api, db)
    alertesRoutes(api, db)
    deps.routes?.(api)
    done()
  }
  app.register(async (scope) => {
    if (deps.telemetryPlugin) await scope.register(deps.telemetryPlugin)
    scope.register(routes, { prefix: '/api' })
    scope.register(routes, { prefix: '/v1' })
  })

  if (deps.closeDb) app.addHook('onClose', deps.closeDb)
  return app
}
