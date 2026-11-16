import { defineConfig } from 'prisma/config'

// Le schéma est complété à l'étape 3 (modèle de données).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? 'file:./prisma/dev.db' },
})
