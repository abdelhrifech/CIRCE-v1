import type { Db } from '../../src/core/db.ts'
import type { Prisma } from '../../src/generated/prisma/client.ts'
import { next } from './sequence.ts'
import { createPlateforme } from './reference.ts'

export function createUtilisateur(
  db: Db,
  data: Partial<Prisma.UtilisateurUncheckedCreateInput> = {},
) {
  const n = next()
  return db.utilisateur.create({
    data: { identifiantExterne: `utilisateur.test.${n}`, nom: `Utilisateur Test ${n}`, ...data },
  })
}

export function createRole(db: Db, data: Partial<Prisma.RoleUncheckedCreateInput> = {}) {
  const n = next()
  return db.role.create({ data: { code: `role_test_${n}`, libelle: `Rôle test ${n}`, ...data } })
}

export function createPermission(
  db: Db,
  data: Partial<Prisma.PermissionUncheckedCreateInput> = {},
) {
  const n = next()
  return db.permission.create({
    data: { code: `test.permission.${n}`, libelle: `Permission test ${n}`, ...data },
  })
}

export async function createPerimetre(
  db: Db,
  data: Partial<Prisma.UtilisateurPerimetreUncheckedCreateInput> = {},
) {
  const utilisateurId = data.utilisateurId ?? (await createUtilisateur(db)).id
  const plateformeId = data.plateformeId ?? (await createPlateforme(db)).id
  return db.utilisateurPerimetre.create({ data: { ...data, utilisateurId, plateformeId } })
}

export async function createCleIdempotence(
  db: Db,
  data: Partial<Prisma.CleIdempotenceUncheckedCreateInput> = {},
) {
  const utilisateurId = data.utilisateurId ?? (await createUtilisateur(db)).id
  const n = next()
  return db.cleIdempotence.create({
    data: {
      cle: `cle-test-${n}`,
      methode: 'POST',
      chemin: '/api/test',
      empreinte: `empreinte-${n}`,
      expireLe: new Date(Date.now() + 24 * 3600 * 1000),
      ...data,
      utilisateurId,
    },
  })
}

export function createJournalAudit(db: Db, data: Prisma.JournalAuditUncheckedCreateInput) {
  return db.journalAudit.create({ data })
}

export function createStatutHistorique(db: Db, data: Prisma.StatutHistoriqueUncheckedCreateInput) {
  return db.statutHistorique.create({ data })
}

/** Utilisateur avec rôles (codes du seed) et périmètre ; les rôles absents sont créés. */
export async function createUtilisateurAvecRoles(
  db: Db,
  roles: readonly string[],
  perimetres: { plateformeId: number; atelierId?: number | null }[] = [],
) {
  const user = await createUtilisateur(db)
  for (const code of roles) {
    const role =
      (await db.role.findUnique({ where: { code } })) ??
      (await db.role.create({ data: { code, libelle: code } }))
    await db.utilisateurRole.create({ data: { utilisateurId: user.id, roleId: role.id } })
  }
  for (const p of perimetres) {
    await db.utilisateurPerimetre.create({
      data: {
        utilisateurId: user.id,
        plateformeId: p.plateformeId,
        atelierId: p.atelierId ?? null,
      },
    })
  }
  return user
}
