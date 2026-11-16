import { describe, expect, it } from 'vitest'
import {
  decoderCle,
  encoderCle,
  groupeAutorise,
  libelleTypeSuivi,
  regleCorrespond,
  STATUTS_FACE_LIBRES,
  STATUTS_UM_BLOQUANTS,
  type RegleAtelier,
} from './deblocage.ts'

describe('COO-P08 clé d’un groupe de préparation', () => {
  it('RG-COO-145 clé UM et TRAIN : aller-retour sans perte (valeurs nulles comprises)', () => {
    const um = { type: 'UM', idGroupe: 12 } as const
    expect(encoderCle(um)).toBe('UM:12')
    expect(decoderCle(encoderCle(um))).toEqual(um)
    const train = {
      type: 'TRAIN',
      chapeau: 7,
      contNum: 3456,
      annee: 2027,
      semaine: 1,
      idSurface: null,
      idTypePreparation: 23,
      idSiteCcf: null,
    } as const
    expect(encoderCle(train)).toBe('TRAIN:7:3456:2027:1:-:23:-')
    expect(decoderCle(encoderCle(train))).toEqual(train)
  })

  it('RG-COO-145 rejet : clé mal formée → null', () => {
    for (const k of [
      '',
      'UM:1:2:3',
      'UM:a',
      'UM:1:2:3:4',
      'TRAIN:1:2:3:4:5:6',
      'X:1:2:3:4',
      'UM:1:2:3:4:5',
    ])
      expect(decoderCle(k), k).toBeNull()
  })
})

describe('RG-COO-141 règles d’inclusion / exclusion des ateliers', () => {
  const r = (p: Partial<RegleAtelier>): RegleAtelier => ({
    atelierId: 1,
    typePreparationId: null,
    surfaceId: null,
    exclusion: false,
    ...p,
  })
  it('RG-COO-141 une règle correspond si (type nul ou égal) ET (surface nulle ou égale)', () => {
    expect(regleCorrespond(r({}), 5, 9)).toBe(true)
    expect(regleCorrespond(r({ typePreparationId: 5 }), 5, 9)).toBe(true)
    expect(regleCorrespond(r({ typePreparationId: 5, surfaceId: 9 }), 5, 9)).toBe(true)
    expect(regleCorrespond(r({ typePreparationId: 6 }), 5, 9)).toBe(false)
    expect(regleCorrespond(r({ surfaceId: 8 }), 5, 9)).toBe(false)
  })

  it('RG-COO-141 visible si une inclusion et aucune exclusion pour un atelier du même site', () => {
    const ateliers = [{ id: 1, idSiteCcf: 39 }]
    const g = { idSiteCcf: 39, idTypePreparation: 5, idSurface: 9 }
    expect(groupeAutorise(ateliers, [r({})], g)).toBe(true)
    expect(groupeAutorise(ateliers, [r({}), r({ exclusion: true, surfaceId: 9 })], g)).toBe(false)
  })

  it('RG-COO-141 rejet : atelier sans règle, autre site, site inconnu → non visible', () => {
    const g = { idSiteCcf: 39, idTypePreparation: 5, idSurface: 9 }
    expect(groupeAutorise([{ id: 1, idSiteCcf: 39 }], [], g)).toBe(false)
    expect(groupeAutorise([{ id: 1, idSiteCcf: 40 }], [r({})], g)).toBe(false)
    expect(groupeAutorise([{ id: 1, idSiteCcf: null }], [r({})], g)).toBe(false)
    expect(groupeAutorise([{ id: 2, idSiteCcf: 39 }], [r({})], g)).toBe(false)
  })
})

describe('RG-COO-143 / 144 / 149 constantes et libellés', () => {
  it('RG-COO-143 / 277 statuts d’UM bloquants = statuts ≥ 6 ; RG-COO-144 faces libres = 0, 1, 4', () => {
    expect(STATUTS_UM_BLOQUANTS).toEqual([
      'PREPARE',
      'A_EXPEDIER',
      'TERMINE',
      'EXPORT_PREPA',
      'AU_ROULAGE',
    ])
    expect(STATUTS_UM_BLOQUANTS).not.toContain('A_IMPRIMER')
    expect(STATUTS_FACE_LIBRES).toEqual(['A_TRAITER', 'EN_COURS', 'ANNULE'])
  })

  it('RG-COO-149 « Tole traditionnelle » affiché « 4m² colle » ; les autres libellés inchangés', () => {
    expect(libelleTypeSuivi('Tole traditionnelle')).toBe('4m² colle')
    expect(libelleTypeSuivi(' TOLE TRADITIONNELLE ')).toBe('4m² colle')
    expect(libelleTypeSuivi('2 m² fixe')).toBe('2 m² fixe')
    expect(libelleTypeSuivi(null)).toBeNull()
  })
})
