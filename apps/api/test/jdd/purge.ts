// Purge des données générées : toutes les lignes créées après un « repère » (max(rowid) de chaque table relevé avant la
// génération) sont supprimées. Les tests d'intégration et le CLI ne tournent jamais en parallèle sur test.db ; la
// génération n'écrit que de nouvelles lignes (les référentiels existants ne sont jamais modifiés par le JDD).
// Les FK sont en RESTRICT : la purge suspend les clés étrangères le temps de la suppression, puis vérifie
// `foreign_key_check` (aucune FK orpheline ne doit rester) et rétablit les clés.
import type { Db } from '../../src/core/db.ts'

export type Repere = Record<string, number>

const IGNOREES = new Set(['_prisma_migrations', 'sqlite_sequence'])

export async function tablesDe(db: Db): Promise<string[]> {
  const lignes = await db.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  return lignes.map((l) => l.name).filter((n) => !IGNOREES.has(n))
}

/** Repère de purge : plus grand rowid de chaque table au moment de l'appel. */
export async function relevoirRepere(db: Db): Promise<Repere> {
  const repere: Repere = {}
  for (const t of await tablesDe(db)) {
    const [r] = await db.$queryRawUnsafe<{ m: number | bigint | null }[]>(
      `SELECT MAX(rowid) AS m FROM "${t}"`,
    )
    repere[t] = Number(r?.m ?? 0)
  }
  return repere
}

/** Supprime tout ce qui a été créé depuis le repère ; renvoie le nombre de lignes supprimées par table. */
export async function purger(db: Db, repere: Repere): Promise<Record<string, number>> {
  const supprimees: Record<string, number> = {}
  await db.$queryRawUnsafe('PRAGMA foreign_keys = OFF')
  try {
    for (const [table, max] of Object.entries(repere)) {
      const n = await db.$executeRawUnsafe(`DELETE FROM "${table}" WHERE rowid > ${String(max)}`)
      if (n > 0) supprimees[table] = n
    }
    const orphelines = await db.$queryRawUnsafe<{ table: string }[]>('PRAGMA foreign_key_check')
    if (orphelines.length > 0) {
      const tables = [...new Set(orphelines.map((o) => o.table))].join(', ')
      throw new Error(
        `purge : des FK orphelines subsistent (${tables}) : des lignes antérieures au repère dépendent de lignes générées`,
      )
    }
  } finally {
    await db.$queryRawUnsafe('PRAGMA foreign_keys = ON')
  }
  return supprimees
}

/** Nombre de lignes créées depuis le repère, par table (volumétrie réelle d'une génération). */
export async function compterDepuis(db: Db, repere: Repere): Promise<Record<string, number>> {
  const r: Record<string, number> = {}
  for (const [table, max] of Object.entries(repere)) {
    const [l] = await db.$queryRawUnsafe<{ c: number | bigint }[]>(
      `SELECT COUNT(*) AS c FROM "${table}" WHERE rowid > ${String(max)}`,
    )
    const c = Number(l?.c ?? 0)
    if (c > 0) r[table] = c
  }
  return r
}
