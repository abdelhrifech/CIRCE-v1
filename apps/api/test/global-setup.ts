// Prépare une base de test NEUVE à chaque exécution : suppression de test.db puis migrations.
// Garde-fou CLAUDE.md §7.7 : refus si DATABASE_URL ne vise pas test.db.
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

export default function setup(): void {
  const root = resolve(import.meta.dirname, '../../..')
  process.loadEnvFile(resolve(root, '.env.test'))
  const url = process.env['DATABASE_URL'] ?? ''
  if (!url.startsWith('file:') || !url.endsWith('test.db')) {
    throw new Error(`Refus : DATABASE_URL (${url}) ne vise pas la base de test (test.db).`)
  }
  const apiDir = resolve(import.meta.dirname, '..')
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(resolve(apiDir, `prisma/test.db${suffix}`), { force: true })
  }
  const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    // The Rust engine uses its own log levels; keep its diagnostics independent of Pino's silent test mode.
    env: { ...process.env, RUST_LOG: 'info' },
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy a échoué :\n${result.stdout}\n${result.stderr}`)
  }
}
