// COO-P07 — règle de proximité des thèmes et annonceurs (RG-COO-069 / 070), fonctions pures.
import { describe, expect, it } from 'vitest'
import { lireRegroupements, proches, ratio, regrouper, simplifier } from './themes.ts'

describe('RG-COO-069 règle de proximité', () => {
  it('RG-COO-069 simplifie : minuscules, sans accents ni ponctuation', () => {
    expect(simplifier('  Été — Gourmand !! ')).toBe('ete gourmand')
    expect(simplifier('MENU-BURGERS')).toBe('menu burgers')
  })

  it('RG-COO-069 ratio = équivalent de difflib.SequenceMatcher.ratio', () => {
    expect(ratio('abcd', 'bcde')).toBe(0.75)
    expect(ratio('', '')).toBe(1)
    expect(ratio('abc', '')).toBe(0)
    expect(ratio('menu burger', 'menu burgers')).toBeCloseTo(22 / 23, 5)
  })

  it('RG-COO-069 proches : identiques une fois simplifiés', () => {
    expect(proches('Automne gourmand', 'AUTOMNE GOURMAND', 0.85)).toBe(true)
  })

  it('RG-COO-069 proches : l’un contenu dans l’autre (mots entiers, ≥ 3 caractères)', () => {
    expect(proches('automne gourmand', 'automne gourmand 16 oct', 0.85)).toBe(true)
    // « ab » : moins de 3 caractères → pas d'inclusion ; ratio faible.
    expect(proches('ab', 'ab cd ef gh ij', 0.85)).toBe(false)
    // Inclusion hors mot entier : « burger » dans « hamburgerie » ne compte pas.
    expect(proches('burger', 'hamburgerie du port', 0.85)).toBe(false)
  })

  it('RG-COO-069 proches : similarité au seuil (paramètre)', () => {
    expect(proches('Menu burger', 'MENU BURGERS', 0.85)).toBe(true)
    expect(proches('Menu burger', 'MENU BURGERS', 0.99)).toBe(false)
  })

  it('RG-COO-069 rejet : intitulés différents', () => {
    expect(proches('Printemps', 'Rentrée scolaire', 0.85)).toBe(false)
  })
})

describe('RG-COO-070 regroupements d’enseignes', () => {
  const r = lireRegroupements('*MISTRAL*:MISTRAL; mal formé ;  :X ; BRICO*:BRICO')

  it('RG-COO-070 « *MISTRAL* » réunit les noms qui contiennent MISTRAL (sans casse)', () => {
    expect(regrouper('Mistral Nîmes', r)).toBe('MISTRAL')
    expect(regrouper('LE MISTRAL VENCE', r)).toBe('MISTRAL')
    expect(regrouper('Bricolage du Sud', r)).toBe('BRICO')
  })

  it('RG-COO-070 rejet : un nom hors regroupement reste lui-même ; entrées mal formées ignorées', () => {
    expect(regrouper('Brasserie du Port', r)).toBe('Brasserie du Port')
    expect(r).toHaveLength(2)
  })
})
