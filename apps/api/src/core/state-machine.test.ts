import { describe, expect, it } from 'vitest'
import { ConflictError } from './errors.ts'
import { assertTransition, canTransition, type Transitions } from './state-machine.ts'

type S = 'A' | 'B' | 'C'
const table: Transitions<S> = { A: ['B'], B: ['C'], C: [] }

describe('machine d’états (CLAUDE.md §6)', () => {
  it('autorise une transition listée', () => {
    expect(canTransition(table, 'A', 'B')).toBe(true)
    expect(() => {
      assertTransition(table, 'A', 'B', { regle: 'RG-TEST' })
    }).not.toThrow()
  })

  it('refuse toute transition non listée en 409 TRANSITION_INTERDITE avec la règle', () => {
    expect(canTransition(table, 'A', 'C')).toBe(false)
    try {
      assertTransition(table, 'C', 'A', { regle: 'RG-REC-070' })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError)
      expect((error as ConflictError).toResponse()).toMatchObject({
        code: 'TRANSITION_INTERDITE',
        regle: 'RG-REC-070',
        details: { de: 'C', vers: 'A' },
      })
    }
  })
})
