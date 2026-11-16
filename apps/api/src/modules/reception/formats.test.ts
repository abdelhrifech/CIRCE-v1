import { describe, expect, it } from 'vitest'
import { estFamille2m2, libelleSupport, supportsDeRecherche } from './formats.ts'

const supports = [
  { nom: '2m2' },
  { nom: '2 m2' },
  { nom: '2m2 Scrolling' },
  { nom: '2m2 Venusial' },
  { nom: 'Scrolling MUI Paris' },
  { nom: '8m2' },
  { nom: '12m2' },
]

describe('RG-REC-043 famille de formats 2 m²', () => {
  it('RG-REC-043 reconnaît les quatre formats de la famille, sans tenir compte de la casse', () => {
    for (const nom of ['2m2', '2 m2', '2M2 Scrolling', '2m2  venusial'])
      expect(estFamille2m2(nom), nom).toBe(true)
  })

  it('RG-REC-043 exclut les autres formats', () => {
    expect(estFamille2m2('8m2')).toBe(false)
    expect(estFamille2m2('Scrolling MUI Paris')).toBe(false)
  })

  it('RG-REC-043 recherche : support « 2m2* » → tous les 2m2* + Scrolling MUI Paris', () => {
    expect(supportsDeRecherche('2m2 Scrolling', supports).map((s) => s.nom)).toEqual([
      '2m2',
      '2m2 Scrolling',
      '2m2 Venusial',
      'Scrolling MUI Paris',
    ])
  })

  it('RG-REC-043 recherche : autre support → ce support seulement', () => {
    expect(supportsDeRecherche('8m2', supports).map((s) => s.nom)).toEqual(['8m2'])
  })

  it('RG-REC-043 affichage : « 2m2 Scrolling » et « 2m2 Venusial » deviennent « 2m2 »', () => {
    expect(libelleSupport('2m2 Scrolling')).toBe('2m2')
    expect(libelleSupport('2m2 Venusial')).toBe('2m2')
    expect(libelleSupport('8m2')).toBe('8m2')
  })
})
