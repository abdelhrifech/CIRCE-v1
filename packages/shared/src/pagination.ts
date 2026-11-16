import { z } from 'zod'

// Pagination / tri / filtre standards des listes (CLAUDE.md §6).
// Requête : ?page=1&pageSize=25&sort=-createdAt,nom&q=texte&<filtres propres à la liste>
export const PAGE_SIZE_DEFAULT = 25
export const PAGE_SIZE_MAX = 100

export interface SortItem<F extends string> {
  field: F
  direction: 'asc' | 'desc'
}

/** Construit le schéma de requête d'une liste : champs triables explicites + filtres propres. */
export function makeListQuerySchema<F extends string, S extends z.ZodRawShape>(options: {
  sortable: readonly [F, ...F[]]
  defaultSort?: string
  filters?: S
}) {
  const sortable: readonly string[] = options.sortable
  return z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
      sort: z
        .string()
        .default(options.defaultSort ?? options.sortable[0])
        .transform((value, ctx) => {
          const items: SortItem<F>[] = []
          for (const raw of value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)) {
            const direction = raw.startsWith('-') ? 'desc' : 'asc'
            const field = raw.replace(/^[-+]/, '')
            if (!sortable.includes(field)) {
              ctx.addIssue({ code: 'custom', message: `Tri non autorisé : ${field}` })
              return z.NEVER
            }
            items.push({ field: field as F, direction })
          }
          return items
        }),
      q: z.string().trim().min(1).optional(),
    })
    .extend((options.filters ?? {}) as S)
}

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  })
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
