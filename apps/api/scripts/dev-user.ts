// Crée ou met à jour un utilisateur de DÉVELOPPEMENT (base de dev uniquement) pour le fournisseur
// d'identité de dev (Q-001). Usage : pnpm dev:user <identifiant> <role> [plateformeId...]
import { resolve } from 'node:path'
import { RoleSchema } from '@circe/shared'
import { createDb } from '../src/core/db.ts'

process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
if (process.env['NODE_ENV'] === 'production') {
  console.error('Refusé en production.')
  process.exit(1)
}
const [identifiant, roleArg, ...plateformes] = process.argv.slice(2)
const role = RoleSchema.safeParse(roleArg)
if (!identifiant || !role.success) {
  console.error(
    'Usage : pnpm dev:user <identifiant> <coord|cheq|recep|expe|admin|com> [plateformeId...]',
  )
  process.exit(1)
}

const db = createDb(process.env['DATABASE_URL'] ?? '')
try {
  const roleRow = await db.role.findUnique({ where: { code: role.data } })
  if (!roleRow) throw new Error('Rôle absent : lancez d’abord pnpm seed:ref')
  const user = await db.utilisateur.upsert({
    where: { identifiantExterne: identifiant },
    update: { actif: true },
    create: { identifiantExterne: identifiant, nom: `Dev ${identifiant}` },
  })
  await db.utilisateurRole.deleteMany({ where: { utilisateurId: user.id } })
  await db.utilisateurRole.create({ data: { utilisateurId: user.id, roleId: roleRow.id } })
  await db.utilisateurPerimetre.deleteMany({ where: { utilisateurId: user.id } })
  for (const plateformeId of plateformes.map(Number)) {
    await db.utilisateurPerimetre.create({ data: { utilisateurId: user.id, plateformeId } })
  }
  console.log(
    `Utilisateur de dev « ${identifiant} » : rôle ${role.data}, plateformes [${plateformes.join(', ')}]`,
  )
} finally {
  await db.$disconnect()
}
