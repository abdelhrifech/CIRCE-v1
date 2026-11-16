// seed:ref — charge les données de référence issues des règles (Q-004, Q-319) dans la base de dev.
import { resolve } from 'node:path'
import { createDb } from '../src/core/db.ts'
import { seedRef } from '../src/reference/seed-ref.ts'

process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
const url = process.env['DATABASE_URL'] ?? ''
if (!url.startsWith('file:')) {
  console.error('DATABASE_URL absente ou invalide.')
  process.exit(1)
}

const db = createDb(url)
try {
  const result = await seedRef(db)
  console.log('seed:ref OK', result)
  console.log(
    'Non chargés (Q-319) : plateformes, ateliers, supports, surfaces, jours de départ, destinataires.',
  )
} finally {
  await db.$disconnect()
}
