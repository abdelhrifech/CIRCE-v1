import { describe, expect, it } from 'vitest'
import { selectionPlage } from './selection-glissee.ts'
describe('sélection par glissement', () => {
  it('restaure les lignes quittées au retour, sans perdre les coches antérieures', () => {
    expect(selectionPlage([1, 2, 3, 4, 5], [5], 2, 4, true)).toEqual([5, 2, 3, 4])
    expect(selectionPlage([1, 2, 3, 4, 5], [5], 2, 2, true)).toEqual([5, 2])
  })
  it('décoche dans les deux sens et conserve les lignes hors de la plage', () => {
    expect(selectionPlage([1, 2, 3, 4], [1, 2, 3, 4], 3, 1, false)).toEqual([4])
    expect(selectionPlage([1, 2, 3, 4], [1, 2, 3, 4], 3, 2, false)).toEqual([1, 4])
  })
})
