import { describe, it, expect } from 'vitest'
import { StockQuerySchema, FinCampagneQuerySchema, DeciderFinCampagneSchema } from './stocks.ts'
describe('EX-STK-NEW-001 paramètres des écrans Stocks', () => {
  it('accepte un dossier numérique produit par le routeur et les listes saisies', () => {
    expect(StockQuerySchema.parse({ dossier: 9500001 }).dossier).toBe('9500001')
    expect(FinCampagneQuerySchema.parse({ dossier: 9500001 }).dossier).toBe('9500001')
    expect(StockQuerySchema.parse({ dossier: '9500001,9500002' }).dossier).toBe('9500001,9500002')
  })
  it('RG-STK-NEW-002 valide une semaine ISO réelle pour la conservation', () => {
    const base = {
      plateformeId: 1,
      dossier: 1,
      version: 0,
      empreinte: 'empreinte',
      decision: 'CONSERVER',
      motif: 'Réaffichage',
    }
    expect(DeciderFinCampagneSchema.safeParse({ ...base, jusqua: '2026-W53' }).success).toBe(true)
    for (const jusqua of ['zzz', '2027-W53', '2026-W00', '2026-W54'])
      expect(DeciderFinCampagneSchema.safeParse({ ...base, jusqua }).success).toBe(false)
  })
})
