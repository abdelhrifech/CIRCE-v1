// Real instrumentation in a separate process: no global providers shared with integration tests.
import { telemetry } from '../../src/telemetry-bootstrap.ts'
const { buildApp } = await import('../../src/app.ts')
const { loadConfig } = await import('../../src/core/config.ts')
const { createDb } = await import('../../src/core/db.ts')
const config = loadConfig()
const db = createDb(config.DATABASE_URL)
const app = buildApp({
  config,
  db,
  telemetryPlugin: telemetry.fastify.plugin(),
  closeDb: () => db.$disconnect(),
  routes(api) {
    api.get('/telemetry-test', async () => {
      await db.$queryRaw`SELECT 1`
      const response = await fetch(process.env['TEST_UPSTREAM_URL'] ?? '')
      await response.text()
      return { ok: true }
    })
  },
})
process.on('SIGTERM', () => {
  void (async () => {
    await app.close()
    await telemetry.sdk.shutdown().catch(() => undefined)
    process.exit(0)
  })()
})
await app.listen({ host: '127.0.0.1', port: 0 })
const address = app.server.address()
if (address && typeof address !== 'string') console.log(`TEST_API_PORT=${address.port}`)
