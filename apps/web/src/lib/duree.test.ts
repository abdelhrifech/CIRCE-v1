import { describe, expect, it } from 'vitest'
import { duree } from './duree.ts'

describe('ECR-REC-02 durée « En attente depuis »', () => {
  it('RG-REC-055 formate minutes, heures et jours comme la maquette', () => {
    expect(duree(35)).toBe('35 min')
    expect(duree(7 * 60 + 10)).toBe('7 h')
    expect(duree(51 * 60)).toBe('2 j 3 h')
    expect(duree(48 * 60)).toBe('2 j')
  })
})
