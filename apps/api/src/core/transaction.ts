import type { Db } from './db.ts'

/** Client utilisable dans une transaction interactive Prisma. */
export type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0]

/**
 * CLAUDE.md §6 : toute opération multi-écritures passe par une transaction. Si `fn` lève,
 * toutes les écritures sont annulées (rollback) et l'erreur est propagée telle quelle.
 */
export function withTransaction<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(fn)
}
