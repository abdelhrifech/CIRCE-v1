import type { Page, SortItem } from '@circe/shared'

/** Traduit page / pageSize en skip / take Prisma. */
export function toPrismaPage(query: { page: number; pageSize: number }): {
  skip: number
  take: number
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize }
}

/** Traduit le tri validé (champs autorisés par le schéma de liste) en orderBy Prisma. */
export function toPrismaOrderBy<F extends string>(
  sort: readonly SortItem<F>[],
): Record<F, 'asc' | 'desc'>[] {
  return sort.map((s) => ({ [s.field]: s.direction }) as Record<F, 'asc' | 'desc'>)
}

export function toPage<T>(
  items: T[],
  total: number,
  query: { page: number; pageSize: number },
): Page<T> {
  return { items, total, page: query.page, pageSize: query.pageSize }
}
