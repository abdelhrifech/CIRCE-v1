import { describe, expect, it } from 'vitest'
import { canTransition } from '../../core/state-machine.ts'
import { TRANSITIONS_AFFICHE, TRANSITIONS_RATTACHEMENT, TRANSITIONS_RECEPTION } from './statuts.ts'

describe('machine d’états RECEPTION (RECEPTION_REGLES_METIER.md §3.2)', () => {
  it('RG-REC-107 A_IDENTIFIER → A_CONTROLER (rattacher) est autorisée', () => {
    expect(canTransition(TRANSITIONS_RECEPTION, 'A_IDENTIFIER', 'A_CONTROLER')).toBe(true)
  })
  it('RG-REC-069 A_CONTROLER → CONTROLEE (valider le contrôle) est autorisée', () => {
    expect(canTransition(TRANSITIONS_RECEPTION, 'A_CONTROLER', 'CONTROLEE')).toBe(true)
  })
  it('RG-REC-114 retrait du dernier dossier : A_CONTROLER et CONTROLEE → A_IDENTIFIER (Q-108)', () => {
    expect(canTransition(TRANSITIONS_RECEPTION, 'A_CONTROLER', 'A_IDENTIFIER')).toBe(true)
    expect(canTransition(TRANSITIONS_RECEPTION, 'CONTROLEE', 'A_IDENTIFIER')).toBe(true)
  })
  it('RG-REC-070 CONTROLEE → A_CONTROLER est interdite (aucun retour arrière)', () => {
    expect(canTransition(TRANSITIONS_RECEPTION, 'CONTROLEE', 'A_CONTROLER')).toBe(false)
  })
  it('RG-REC-071 A_IDENTIFIER → CONTROLEE est interdite (rattacher d’abord)', () => {
    expect(canTransition(TRANSITIONS_RECEPTION, 'A_IDENTIFIER', 'CONTROLEE')).toBe(false)
  })
  it('RG-REC-070 CONTROLEE → CONTROLEE est interdite (déjà contrôlée)', () => {
    expect(canTransition(TRANSITIONS_RECEPTION, 'CONTROLEE', 'CONTROLEE')).toBe(false)
  })
})

describe('machine d’états AFFICHE et RATTACHEMENT', () => {
  it('RG-REC-109 ORPHELINE ↔ IDENTIFIEE seulement', () => {
    expect(canTransition(TRANSITIONS_AFFICHE, 'ORPHELINE', 'IDENTIFIEE')).toBe(true)
    expect(canTransition(TRANSITIONS_AFFICHE, 'IDENTIFIEE', 'ORPHELINE')).toBe(true)
    expect(canTransition(TRANSITIONS_AFFICHE, 'IDENTIFIEE', 'IDENTIFIEE')).toBe(false)
  })
  it('RG-REC-137 un rattachement retiré n’est jamais réactivé', () => {
    expect(canTransition(TRANSITIONS_RATTACHEMENT, 'ACTIF', 'RETIRE')).toBe(true)
    expect(canTransition(TRANSITIONS_RATTACHEMENT, 'RETIRE', 'ACTIF')).toBe(false)
    expect(canTransition(TRANSITIONS_RATTACHEMENT, 'RETIRE', 'RETIRE')).toBe(false)
  })
})

describe('regleTransitionInterditeReception', async () => {
  const { regleTransitionInterditeReception } = await import('./statuts.ts')
  it('RG-REC-071 / RG-REC-070 associe chaque transition interdite notable à sa règle', () => {
    expect(regleTransitionInterditeReception('A_IDENTIFIER', 'CONTROLEE')).toBe('RG-REC-071')
    expect(regleTransitionInterditeReception('CONTROLEE', 'A_CONTROLER')).toBe('RG-REC-070')
    expect(regleTransitionInterditeReception('CONTROLEE', 'CONTROLEE')).toBe('RG-REC-070')
    expect(regleTransitionInterditeReception('A_CONTROLER', 'CONTROLEE')).toBeNull()
  })
})
