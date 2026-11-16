import { describe, expect, it } from 'vitest'
import { assertTransition } from '../../core/state-machine.ts'
import {
  regleTransitionInstruction,
  TRANSITIONS_DOSSIER,
  TRANSITIONS_INSTRUCTION_SYSTEME,
  TRANSITIONS_INSTRUCTION_UTILISATEUR,
} from './statuts.ts'

describe('RG-COO-040 table de transitions de l’instruction', () => {
  it('RG-COO-040 transitions utilisateur autorisées (§3.2.c)', () => {
    expect(() => {
      assertTransition(TRANSITIONS_INSTRUCTION_UTILISATEUR, 'INSTRUCTION_OK', 'EN_COURS', {
        regle: 'RG-COO-046',
      })
    }).not.toThrow()
    expect(() => {
      assertTransition(TRANSITIONS_INSTRUCTION_UTILISATEUR, 'ANNULE', 'A_TRAITER', {
        regle: 'RG-COO-045',
      })
    }).not.toThrow()
  })

  it('RG-COO-040 aucune transition utilisateur depuis PRET_A_PRODUIRE ni ERREUR', () => {
    expect(TRANSITIONS_INSTRUCTION_UTILISATEUR.PRET_A_PRODUIRE).toEqual([])
    expect(TRANSITIONS_INSTRUCTION_UTILISATEUR.ERREUR).toEqual([])
    expect(() => {
      assertTransition(TRANSITIONS_INSTRUCTION_UTILISATEUR, 'PRET_A_PRODUIRE', 'ANNULE', {
        regle: 'RG-COO-045',
      })
    }).toThrow()
  })

  it('RG-COO-041 transitions système : A_TRAITER et ERREUR → EN_COURS', () => {
    expect(TRANSITIONS_INSTRUCTION_SYSTEME.A_TRAITER).toEqual(['EN_COURS'])
    expect(TRANSITIONS_INSTRUCTION_SYSTEME.ERREUR).toEqual(['EN_COURS'])
  })

  it('RG-COO-042 / RG-COO-054 (Q-204 option b) : EN_COURS → INSTRUCTION_OK automatique, INSTRUCTION_OK → EN_COURS (réouverture) ; rien depuis PRET_A_PRODUIRE ni ANNULE', () => {
    expect(TRANSITIONS_INSTRUCTION_SYSTEME.EN_COURS).toEqual(['INSTRUCTION_OK'])
    expect(TRANSITIONS_INSTRUCTION_SYSTEME.INSTRUCTION_OK).toEqual(['EN_COURS'])
    expect(TRANSITIONS_INSTRUCTION_SYSTEME.PRET_A_PRODUIRE).toEqual([])
    expect(TRANSITIONS_INSTRUCTION_SYSTEME.ANNULE).toEqual([])
  })

  it('RG-COO-063 un dossier ne revient jamais à A_TRAITER ; ANNULE est terminal', () => {
    expect(Object.values(TRANSITIONS_DOSSIER).flat()).not.toContain('A_TRAITER')
    expect(TRANSITIONS_DOSSIER.ANNULE).toEqual([])
  })

  it('RG-COO-045 / 046 règle citée selon la transition', () => {
    expect(regleTransitionInstruction('EN_COURS', 'ANNULE')).toBe('RG-COO-045')
    expect(regleTransitionInstruction('INSTRUCTION_OK', 'EN_COURS')).toBe('RG-COO-046')
    expect(regleTransitionInstruction('EN_COURS', 'A_TRAITER')).toBe('RG-COO-040')
  })
})
