import { describe, it, expect } from 'vitest'
import { filtreTableau } from './filtres-tableau.ts'
describe('EX-NEW16-TRA-001 opérateurs de filtre', () => {
  it('normalise accents et conserve les comparaisons numériques existantes', () => {
    expect(filtreTableau('NÎMES', 'nimes')).toBe(true)
    expect(filtreTableau(12, '>=10')).toBe(true)
    expect(filtreTableau(2, '>=10')).toBe(false)
  })
  it('distingue égalité, préfixe et exclusion', () => {
    expect(filtreTableau('Alpha Beta', 'alpha', 'egal')).toBe(false)
    expect(filtreTableau('Alpha Beta', 'alpha', 'commence')).toBe(true)
    expect(filtreTableau('Alpha Beta', 'alpha', 'necontient')).toBe(false)
  })
  it('traite le vide indépendamment de la saisie et refuse les nombres invalides', () => {
    expect(filtreTableau(null, '', 'vide')).toBe(true)
    expect(filtreTableau('—', '', 'nonvide')).toBe(false)
    expect(filtreTableau(0, '', 'nonvide')).toBe(true)
    expect(filtreTableau(null, '-1', 'sup')).toBe(false)
    expect(filtreTableau(8, 'invalide', 'sup')).toBe(false)
  })
})
