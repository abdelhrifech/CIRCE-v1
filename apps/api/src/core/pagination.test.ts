import { describe, expect, it } from 'vitest'
import { toPage, toPrismaOrderBy, toPrismaPage } from './pagination.ts'

describe('pagination standard', () => {
  it('calcule skip / take', () => {
    expect(toPrismaPage({ page: 1, pageSize: 25 })).toEqual({ skip: 0, take: 25 })
    expect(toPrismaPage({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 })
  })

  it('traduit le tri en orderBy Prisma', () => {
    expect(
      toPrismaOrderBy([
        { field: 'nom', direction: 'asc' },
        { field: 'createdAt', direction: 'desc' },
      ]),
    ).toEqual([{ nom: 'asc' }, { createdAt: 'desc' }])
  })

  it('construit la page de réponse', () => {
    expect(toPage(['a'], 11, { page: 2, pageSize: 10 })).toEqual({
      items: ['a'],
      total: 11,
      page: 2,
      pageSize: 10,
    })
  })
})
