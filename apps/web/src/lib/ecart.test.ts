import { describe, expect, it } from 'vitest'
import { ecartImportant } from './ecart.ts'

describe('RG-REC-058 écart de comptage', () => {
  it('RG-REC-058 au-delà du seuil (10 % de 20 = 2) : Important', () => {
    expect(ecartImportant(20, 17, 10)).toBe(true)
    expect(ecartImportant(20, 23, 10)).toBe(true)
  })

  it('RG-REC-058 au seuil ou en deçà : simple information (pas Important)', () => {
    expect(ecartImportant(20, 18, 10)).toBe(false)
    expect(ecartImportant(20, 20, 10)).toBe(false)
    expect(ecartImportant(0, 5, 10)).toBe(false)
  })
})
