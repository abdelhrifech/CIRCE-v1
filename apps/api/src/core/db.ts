import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client.ts'

export type Db = PrismaClient

/** Client Prisma sur SQLite (Q-343). `url` : `file:./prisma/dev.db`, relatif à apps/api. */
export function createDb(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
}
