import { expect, it } from 'vitest'
import { regrouperTrainsProduits } from './analyse-production.ts'

it('EX-PIL-NEW-001 regroupe les trains sans mélanger centres, ateliers ou départs, sans inventer une machine', () => {
  const train = {
    id: 'T1',
    rouleur: 'Rouleur test',
    machine: null,
    atelier: 'Déroulant',
    site: 'Wissous',
    depart: '2026-W47',
    statut: 'PRODUIT',
  }
  const groupes = regrouperTrainsProduits([
    train,
    { ...train, id: 'T2', statut: 'COLISE' },
    { ...train, id: 'T3', site: 'Nîmes' },
    { ...train, id: 'T4', depart: '2026-W48' },
    { ...train, id: 'T5', atelier: 'Autre atelier' },
  ])
  expect(groupes).toHaveLength(4)
  expect(groupes[0]).toMatchObject({ trains: 2, lignes: 2, machine: null })
  expect(groupes.reduce((total, g) => total + g.trains, 0)).toBe(5)
  expect(regrouperTrainsProduits([])).toEqual([])
})
