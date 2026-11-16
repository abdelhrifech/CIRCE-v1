import { describe, expect, it } from 'vitest'
import { ErrorResponseSchema, HealthResponseSchema, ROLES, RoleSchema } from './index.ts'

describe('schémas partagés', () => {
  it('accepte une erreur au format { code, message, regle }', () => {
    const parsed = ErrorResponseSchema.parse({ code: 'CONFLIT', message: 'x', regle: 'RG-REC-012' })
    expect(parsed.regle).toBe('RG-REC-012')
  })

  it('refuse une erreur sans message', () => {
    expect(ErrorResponseSchema.safeParse({ code: 'X' }).success).toBe(false)
  })

  it('refuse un rôle inconnu et accepte les 6 rôles provisoires (Q-003)', () => {
    expect(RoleSchema.safeParse('inconnu').success).toBe(false)
    expect(ROLES).toHaveLength(6)
  })

  it('valide la réponse /health', () => {
    const r = HealthResponseSchema.safeParse({ status: 'ok', database: 'up', time: 'now' })
    expect(r.success).toBe(true)
  })
})

describe('makeListQuerySchema (pagination, tri, filtres)', async () => {
  const { z } = await import('zod')
  const { makeListQuerySchema, PAGE_SIZE_DEFAULT } = await import('./pagination.ts')
  const schema = makeListQuerySchema({
    sortable: ['createdAt', 'nom'] as const,
    defaultSort: '-createdAt',
    filters: { statut: z.enum(['A', 'B']).optional() },
  })

  it('applique les valeurs par défaut', () => {
    const q = schema.parse({})
    expect(q).toMatchObject({ page: 1, pageSize: PAGE_SIZE_DEFAULT })
    expect(q.sort).toEqual([{ field: 'createdAt', direction: 'desc' }])
  })

  it('lit un tri multiple et un filtre', () => {
    const q = schema.parse({ page: '2', pageSize: '10', sort: 'nom,-createdAt', statut: 'B' })
    expect(q.sort).toEqual([
      { field: 'nom', direction: 'asc' },
      { field: 'createdAt', direction: 'desc' },
    ])
    expect(q.statut).toBe('B')
  })

  it('refuse un tri sur un champ non autorisé, une page < 1 et une taille > 100', () => {
    expect(schema.safeParse({ sort: 'motDePasse' }).success).toBe(false)
    expect(schema.safeParse({ page: 0 }).success).toBe(false)
    expect(schema.safeParse({ pageSize: 101 }).success).toBe(false)
  })

  it('refuse un filtre hors liste', () => {
    expect(schema.safeParse({ statut: 'Z' }).success).toBe(false)
  })
})

describe('identité de dev signée (Q-001)', async () => {
  const { readDevIdentity, signDevIdentity } = await import('./dev-identity.ts')
  const secret = 'secret-de-test-assez-long'

  it('relit un en-tête signé', () => {
    expect(readDevIdentity(signDevIdentity({ sub: 'u1' }, secret), secret)).toEqual({ sub: 'u1' })
  })

  it('refuse une signature falsifiée, un autre secret ou un en-tête mal formé', () => {
    const header = signDevIdentity({ sub: 'u1' }, secret)
    const forged = `${Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url')}.${header.split('.')[1] ?? ''}`
    expect(readDevIdentity(forged, secret)).toBeNull()
    expect(readDevIdentity(header, 'un-autre-secret-xxxxxxxx')).toBeNull()
    expect(readDevIdentity('nimportequoi', secret)).toBeNull()
  })
})

describe('semaines ISO (RG-COO-083, RG-REC-015)', async () => {
  const { semaineIsoDe, lundiSemaineIso, formatSemaineIso } = await import('./semaines.ts')
  it('calcule la semaine ISO, y compris à cheval sur deux années', () => {
    expect(semaineIsoDe(new Date('2026-11-04T10:00:00Z'))).toEqual({ annee: 2026, semaine: 45 })
    expect(semaineIsoDe(new Date('2027-01-01T00:00:00Z'))).toEqual({ annee: 2026, semaine: 53 })
    expect(semaineIsoDe(new Date('2024-12-30T00:00:00Z'))).toEqual({ annee: 2025, semaine: 1 })
  })
  it('donne le lundi d’une semaine ISO et son libellé', () => {
    expect(lundiSemaineIso({ annee: 2026, semaine: 45 }).toISOString().slice(0, 10)).toBe(
      '2026-11-02',
    )
    expect(formatSemaineIso({ annee: 2026, semaine: 5 })).toBe('2026-W05')
  })
})

describe('RG-REC-013 format du n° de dossier', async () => {
  const { NUMERO_DOSSIER } = await import('./reception/attendues.ts')
  it('RG-REC-013 accepte 6 chiffres, avec ou sans suffixe -W', () => {
    expect(NUMERO_DOSSIER.test('100000')).toBe(true)
    expect(NUMERO_DOSSIER.test('100000-W')).toBe(true)
  })
  it('RG-REC-013 refuse 5 ou 7 chiffres, des lettres, un autre suffixe', () => {
    for (const v of ['10000', '1000000', 'A00000', '100000-X', '100000+120000'])
      expect(NUMERO_DOSSIER.test(v), v).toBe(false)
  })
})

describe('ANO-039 dates calendaires réelles (RG-COO-149, RG-REC-178 édition picking)', async () => {
  const { DateJourSchema, estDateJour, SuiviDeblocageQuerySchema, EditionPickingQuerySchema } =
    await import('./index.ts')
  it('RG-COO-149 accepte une date réelle, y compris le 29 février d’une année bissextile', () => {
    for (const v of ['2026-03-31', '2028-02-29', '2026-12-31']) expect(estDateJour(v), v).toBe(true)
    expect(DateJourSchema.safeParse('2026-02-28').success).toBe(true)
  })
  it('RG-COO-149 rejet : date impossible ou mal formée (période des déblocages, édition picking)', () => {
    for (const v of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2026-5-1',
    ])
      expect(estDateJour(v), v).toBe(false)
    expect(SuiviDeblocageQuerySchema.safeParse({ du: '2026-02-30' }).success).toBe(false)
    expect(
      EditionPickingQuerySchema.safeParse({ plateformeId: 1, du: '2026-02-30', au: '2026-03-01' })
        .success,
    ).toBe(false)
  })
})
