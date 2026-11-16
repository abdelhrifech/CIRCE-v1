// COO-P07 — gravités et échéances des alertes Pré-Prod (RG-COO-033, 066, 073, 076), fonctions pures.
import { describe, expect, it } from 'vitest'
import {
  formatEcheance,
  graviteDeadline,
  graviteValidation,
  lireFenetre,
} from './alertes-coordination.ts'
import { signature } from '../alertes/service.ts'

describe('RG-COO-033 gravité de la validation admin à confirmer', () => {
  const S = { annee: 2026, semaine: 43 }
  it('RG-COO-033 départ en S ou S+1 → Important', () => {
    expect(graviteValidation({ annee: 2026, semaine: 43 }, S, 1)).toBe('IMPORTANT')
    expect(graviteValidation({ annee: 2026, semaine: 44 }, S, 1)).toBe('IMPORTANT')
  })
  it('RG-COO-033 rejet : départ au-delà de S+1 (ou inconnu) → À surveiller', () => {
    expect(graviteValidation({ annee: 2026, semaine: 45 }, S, 1)).toBe('A_SURVEILLER')
    expect(graviteValidation(null, S, 1)).toBe('A_SURVEILLER')
  })
  it('RG-COO-033 passage d’année : S53 → S01 de l’année suivante est S+1', () => {
    expect(graviteValidation({ annee: 2027, semaine: 1 }, { annee: 2026, semaine: 53 }, 1)).toBe(
      'IMPORTANT',
    )
  })
})

describe('RG-COO-066 / 076 deadline Pré-Prod', () => {
  const dl = new Date('2026-10-15T16:00:00Z')
  it('RG-COO-066 deadline dépassée → Critique', () => {
    expect(graviteDeadline(dl, new Date('2026-10-15T16:00:01Z'))).toBe('CRITIQUE')
  })
  it('RG-COO-066 rejet : avant la deadline → À surveiller', () => {
    expect(graviteDeadline(dl, new Date('2026-10-15T16:00:00Z'))).toBe('A_SURVEILLER')
  })
  it('RG-COO-076 échéance affichée « jeu. 15/10 16h » (et minutes si besoin)', () => {
    expect(formatEcheance(dl)).toBe('jeu. 15/10 16h')
    expect(formatEcheance(new Date('2026-10-16T16:30:00Z'))).toBe('ven. 16/10 16h30')
  })
})

describe('RG-COO-073 fenêtre « Rajout après préparation »', () => {
  it('RG-COO-073 paramètre vide ou mal formé : valeur par défaut de la règle', () => {
    for (const v of ['', '|', 'n’importe quoi', '-2;9;00:00|0;5;23:59']) {
      const g = lireFenetre(v)({ annee: 2026, semaine: 44 })
      expect(g.fin.toISOString(), v).toBe('2026-10-30T23:59:00.000Z')
      if (v !== '-2;9;00:00|0;5;23:59')
        expect(g.debut.toISOString(), v).toBe('2026-10-16T00:00:00.000Z')
    }
    expect(
      lireFenetre('-2;9;00:00|0;5;23:59')({ annee: 2026, semaine: 44 }).debut.toISOString(),
    ).toBe('2026-10-16T00:00:00.000Z')
  })

  const f = lireFenetre('-2;5;00:00|0;5;23:59')({ annee: 2026, semaine: 44 })
  it('RG-COO-073 du vendredi S-2 0 h au vendredi S 23 h 59', () => {
    expect(f.debut.toISOString()).toBe('2026-10-16T00:00:00.000Z')
    expect(f.fin.toISOString()).toBe('2026-10-30T23:59:00.000Z')
  })
})

describe('Q-371 acquittement : signature', () => {
  it('une alerte aggravée ou dont le message change a une autre signature (rouverte)', () => {
    const a = { gravite: 'A_SURVEILLER' as const, message: 'm' }
    expect(signature(a)).not.toBe(signature({ ...a, gravite: 'IMPORTANT' }))
    expect(signature(a)).not.toBe(signature({ ...a, message: 'autre' }))
    expect(signature(a)).toBe(signature({ ...a }))
  })
})
