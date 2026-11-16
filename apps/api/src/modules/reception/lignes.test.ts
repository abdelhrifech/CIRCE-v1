import { describe, expect, it } from 'vitest'
import { correspond, jetonsRecherche } from './attendues.ts'
import { attenduDe, controleDe, resteDe, statutLigneDe } from './lignes.ts'

describe('RG-REC-018 statut de la ligne attendue (écart = paramètre, 10 % par défaut)', () => {
  it('RG-REC-018 reçu = 0 → Attendue', () => {
    expect(statutLigneDe(100, 0, 10)).toBe('ATTENDUE')
  })
  it('RG-REC-018 0 < reçu < attendu → Partielle', () => {
    expect(statutLigneDe(100, 1, 10)).toBe('PARTIELLE')
    expect(statutLigneDe(100, 99, 10)).toBe('PARTIELLE')
  })
  it('RG-REC-018 attendu ≤ reçu ≤ attendu × 1,10 → Complète (bornes incluses)', () => {
    expect(statutLigneDe(100, 100, 10)).toBe('COMPLETE')
    expect(statutLigneDe(100, 110, 10)).toBe('COMPLETE')
  })
  it('RG-REC-018 reçu > attendu × 1,10 (strictement) → Surplus', () => {
    expect(statutLigneDe(100, 111, 10)).toBe('SURPLUS')
  })
  it('RG-REC-018 le seuil suit le paramètre (pas de 1,10 en dur)', () => {
    expect(statutLigneDe(100, 115, 20)).toBe('COMPLETE')
    expect(statutLigneDe(100, 115, 10)).toBe('SURPLUS')
  })
  it('RG-REC-018 seuil non entier : 7 attendus, 8 reçus avec 10 % → Surplus (8 > 7,7)', () => {
    expect(statutLigneDe(7, 8, 10)).toBe('SURPLUS')
  })
})

describe('RG-REC-017 attendu, reste', () => {
  it('RG-REC-017 ligne BC → quantité Broadcast ; ligne PREPA → quantité de la prépa', () => {
    expect(attenduDe({ source: 'BC', qteBc: 7, qtePrepa: 9 })).toBe(7)
    expect(attenduDe({ source: 'PREPA', qteBc: 7, qtePrepa: 9 })).toBe(9)
    expect(attenduDe({ source: 'PREPA', qteBc: 7, qtePrepa: null })).toBe(7)
    expect(attenduDe({ source: 'BC', qteBc: null, qtePrepa: null })).toBe(0)
  })
  it('RG-REC-017 reste = max(0, attendu − reçu)', () => {
    expect(resteDe(7, 4)).toBe(3)
    expect(resteDe(7, 9)).toBe(0)
  })
})

describe('RG-REC-019 colonne Contrôle', () => {
  it('RG-REC-019 aucune affiche rattachée → Rien reçu', () => {
    expect(controleDe([])).toBe('RIEN_RECU')
  })
  it('RG-REC-019 une affiche sur une palette non contrôlée → À contrôler', () => {
    expect(controleDe(['CONTROLEE', 'A_CONTROLER'])).toBe('A_CONTROLER')
    expect(controleDe(['A_IDENTIFIER'])).toBe('A_CONTROLER')
  })
  it('RG-REC-019 toutes les palettes contrôlées → Contrôlée', () => {
    expect(controleDe(['CONTROLEE', 'CONTROLEE'])).toBe('CONTROLEE')
    expect(controleDe([null])).toBe('CONTROLEE')
  })
})

describe('RG-REC-012 recherche à la frappe', () => {
  it('RG-REC-012 accepte plusieurs valeurs (espaces, virgules, « + » hérité, liste collée)', () => {
    expect(jetonsRecherche('910037+910074, ACME\n470053')).toEqual([
      '910037',
      '910074',
      'ACME',
      '470053',
    ])
    expect(jetonsRecherche('  ')).toEqual([])
  })
  const ligne = { dossier: 910037, da: 470053, annonceur: 'Société Générale' }
  it('RG-REC-012 n° de dossier (suffixe -W accepté) ou de DA', () => {
    expect(correspond(ligne, '910037')).toBe(true)
    expect(correspond(ligne, '910037-W')).toBe(true)
    expect(correspond(ligne, '470053')).toBe(true)
    expect(correspond(ligne, '910038')).toBe(false)
  })
  it('RG-REC-012 annonceur : partie du nom, sans accents ni casse', () => {
    expect(correspond(ligne, 'generale')).toBe(true)
    expect(correspond(ligne, 'SOCIÉTÉ')).toBe(true)
    expect(correspond(ligne, 'acme')).toBe(false)
  })
})
