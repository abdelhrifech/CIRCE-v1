// Garde-fou CLAUDE.md §7.7 : les tests d'intégration ne tournent que sur la base de test.
import { resolve } from 'node:path'

process.loadEnvFile(resolve(import.meta.dirname, '../../../.env.test'))

const url = process.env['DATABASE_URL'] ?? ''
if (!url.startsWith('file:') || !url.endsWith('test.db')) {
  throw new Error(`Refus : DATABASE_URL (${url}) ne vise pas la base de test (test.db).`)
}
