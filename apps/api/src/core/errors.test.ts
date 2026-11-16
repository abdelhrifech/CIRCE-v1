import { describe, expect, it } from 'vitest'
import {
  BusinessError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors.ts'

describe('socle d’erreurs (CLAUDE.md §6)', () => {
  it.each([
    [new ValidationError('x'), 400],
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new ConflictError('x'), 409],
    [new BusinessError('x'), 422],
  ])('%o porte le bon statut HTTP', (error, status) => {
    expect(error.httpStatus).toBe(status)
  })

  it('sérialise { code, message, regle } et omet details absent', () => {
    const body = new BusinessError('BL absent', { regle: 'RG-REC-012' }).toResponse()
    expect(body).toEqual({ code: 'REGLE_METIER', message: 'BL absent', regle: 'RG-REC-012' })
  })

  it('permet de surcharger le code et d’ajouter des détails', () => {
    const body = new ConflictError('x', {
      code: 'VERSION_PERIMEE',
      details: { version: 3 },
    }).toResponse()
    expect(body.code).toBe('VERSION_PERIMEE')
    expect(body.details).toEqual({ version: 3 })
  })
})
