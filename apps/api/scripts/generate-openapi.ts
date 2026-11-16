import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/core/config.ts'
import { createDb } from '../src/core/db.ts'
import { adminOpenApi } from '../src/core/observability/admin.ts'

// Register routes without starting a listener, loading fixtures or connecting to the database.
const config = loadConfig({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'file:./prisma/test.db',
  DEV_IDENTITY_SECRET: 'contract-generation-not-a-real-secret',
})
const db = createDb(config.DATABASE_URL)
const app = buildApp({ config, db, closeDb: () => db.$disconnect() })
try {
  await app.ready()
  const directory = resolve(import.meta.dirname, '../../../docs/api')
  mkdirSync(directory, { recursive: true })
  for (const [name, document] of [
    ['circe-v1.openapi.json', app.swagger()],
    ['circe-admin.openapi.json', adminOpenApi],
  ] as const) {
    const path = resolve(directory, name)
    const contents = JSON.stringify(document, null, 2) + '\n'
    if (process.argv.includes('--check')) {
      if (readFileSync(path, 'utf8') !== contents)
        throw new Error(`OpenAPI contract is stale: ${name}. Run pnpm api:contract.`)
    } else writeFileSync(path, contents)
    console.log(`${process.argv.includes('--check') ? 'Checked' : 'Generated'} ${name}`)
  }
} finally {
  await app.close()
}
