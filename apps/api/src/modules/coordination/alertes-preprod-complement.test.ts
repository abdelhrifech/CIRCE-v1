// COO-P07 — tests unitaires COMPLÉMENTAIRES (fonctions pures) : seuils et limites des alertes Pré-Prod
// (RG-COO-033 S / S+1, RG-COO-066 / 076 deadline jeudi S-2 16 h, RG-COO-073 fenêtre des rajouts) et règle de
// proximité des thèmes (RG-COO-069, seuil 0,85). Source : docs/COORDINATION_REGLES_METIER.md ; Q-190, Q-220.
import { describe, expect, it } from 'vitest'
import { graviteDeadline, graviteValidation, lireFenetre } from './alertes-coordination.ts'
import { lireDeadline } from './reservations.ts'
import { proches, ratio } from './themes.ts'

const S = { annee: 2026, semaine: 45 }

describe('RG-COO-066 / 076 deadline (complément)', () => {
  const deadline = lireDeadline('-2;4;16:00')

  it('RG-COO-066 deadline d’un départ en S47/2026 = jeudi 05/11/2026 16 h (jeudi S-2)', () => {
    expect(deadline({ annee: 2026, semaine: 47 }).toISOString()).toBe('2026-11-05T16:00:00.000Z')
  })

  it('RG-COO-076 passage d’année : départ S01/2027 ⇒ jeudi S-2 (S52/2026) = jeudi 24/12/2026 16 h', () => {
    expect(deadline({ annee: 2027, semaine: 1 }).toISOString()).toBe('2026-12-24T16:00:00.000Z')
  })

  it('RG-COO-066 limite : à la milliseconde de la deadline « À surveiller », une milliseconde après « Critique »', () => {
    const d = deadline({ annee: 2026, semaine: 47 })
    expect(graviteDeadline(d, d)).toBe('A_SURVEILLER')
    expect(graviteDeadline(d, new Date(d.getTime() + 1))).toBe('CRITIQUE')
  })
})

describe('RG-COO-033 seuil S / S+n (complément)', () => {
  it('RG-COO-033 paramètre 0 : seule la semaine en cours est « Important » ; départ passé aussi', () => {
    expect(graviteValidation(S, S, 0)).toBe('IMPORTANT')
    expect(graviteValidation({ annee: 2026, semaine: 44 }, S, 0)).toBe('IMPORTANT')
    expect(graviteValidation({ annee: 2026, semaine: 46 }, S, 0)).toBe('A_SURVEILLER')
  })

  it('RG-COO-033 paramètre 2 : S+2 « Important », S+3 « À surveiller »', () => {
    expect(graviteValidation({ annee: 2026, semaine: 47 }, S, 2)).toBe('IMPORTANT')
    expect(graviteValidation({ annee: 2026, semaine: 48 }, S, 2)).toBe('A_SURVEILLER')
  })
})

describe('RG-COO-073 fenêtre des rajouts (complément)', () => {
  it('RG-COO-073 bornes incluses : vendredi S-2 00:00 et vendredi S 23:59 (UTC) d’un départ en S47/2026', () => {
    const f = lireFenetre('-2;5;00:00|0;5;23:59')({ annee: 2026, semaine: 47 })
    expect(f.debut.toISOString()).toBe('2026-11-06T00:00:00.000Z')
    expect(f.fin.toISOString()).toBe('2026-11-20T23:59:00.000Z')
  })
})

describe('RG-COO-069 proximité des intitulés (complément)', () => {
  it('RG-COO-069 limite du seuil : 0,85 exactement ⇒ proches ; 0,84 ⇒ non', () => {
    expect(ratio('abcdefghijklmnopqrst', 'abcdefghijklmnopqxyz')).toBe(0.85)
    expect(proches('abcdefghijklmnopqrst', 'abcdefghijklmnopqxyz', 0.85)).toBe(true)
    expect(ratio('abcdefghijklmnopqrstuvwxy', 'abcdefghijklmnopqrstu1234')).toBe(0.84)
    expect(proches('abcdefghijklmnopqrstuvwxy', 'abcdefghijklmnopqrstu1234', 0.85)).toBe(false)
  })

  it('RG-COO-069 inclusion : mots entiers seulement, au moins 3 caractères', () => {
    expect(proches('Automne gourmand', 'automne gourmand 16 oct', 0.99)).toBe(true)
    expect(proches('promo', 'promotion hiver', 0.99)).toBe(false)
    expect(proches('ab', 'ab cd ef gh ij', 0.99)).toBe(false)
  })

  it('RG-COO-069 ponctuation et accents ignorés avant la comparaison', () => {
    expect(proches('Été — Soldes !', 'ete soldes', 0.99)).toBe(true)
  })
})
