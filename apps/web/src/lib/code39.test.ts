import { describe, expect, it } from 'vitest'
import { barresCode39 } from './code39.ts'

describe('RG-REC-079 code-barres Code 39', () => {
  it('RG-REC-079 encode « A- » + 13 chiffres : 5 barres par caractère, encadré par « * »', () => {
    const { barres, longueur } = barresCode39('A-0000000000042')
    // 15 caractères + 2 délimiteurs = 17 caractères × 5 barres.
    expect(barres).toHaveLength(17 * 5)
    // 17 × (6 étroits + 3 larges × 3) + 16 espaces inter-caractères.
    expect(longueur).toBe(17 * 15 + 16)
  })

  it('RG-REC-079 refuse un caractère hors table', () => {
    expect(() => barresCode39('A-12$')).toThrow('Caractère non encodable')
  })
})
