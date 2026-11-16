// db:up / db:test:up : prépare le fichier SQLite et applique les migrations (aucun serveur, Q-343).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const target = process.argv[2]
if (target !== 'dev' && target !== 'test') {
  console.error('Usage : tsx scripts/db.ts <dev|test>')
  process.exit(1)
}

const root = resolve(import.meta.dirname, '../../..')
process.loadEnvFile(resolve(root, target === 'test' ? '.env.test' : '.env'))

const url = process.env['DATABASE_URL'] ?? ''
const expected = target === 'test' ? 'test.db' : 'dev.db'
if (!url.startsWith('file:') || !url.endsWith(expected)) {
  console.error(`DATABASE_URL (${url}) doit viser ${expected} pour la cible « ${target} ».`)
  process.exit(1)
}

mkdirSync(resolve(import.meta.dirname, '../prisma'), { recursive: true })
const hasMigrations = existsSync(resolve(import.meta.dirname, '../prisma/migrations'))
if (!hasMigrations) {
  console.log(
    'Aucune migration (étape 3 non faite) : le fichier sera créé à la première connexion.',
  )
  process.exit(0)
}
const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  cwd: resolve(import.meta.dirname, '..'),
  env: process.env,
})
process.exit(result.status ?? 1)
