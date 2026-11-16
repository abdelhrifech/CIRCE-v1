// REC-P02 — compléments unitaires écrits à partir des règles (RECEPTION_REGLES_METIER.md §4).
import { describe, expect, it } from 'vitest'
import { lundiSemaineIso, semaineIsoDe } from '@circe/shared'
import { correspond, jetonsRecherche } from './attendues.ts'
import { statutLigneDe } from './lignes.ts'

describe('RG-REC-018 statut : bornes et paramètre', () => {
  it('RG-REC-018 attendu 0 et rien reçu → Attendue', () => {
    expect(statutLigneDe(0, 0, 10)).toBe('ATTENDUE')
  })
  it('RG-REC-018 petits attendus : 1/1 Complète, 2/1 Surplus ; 10/11 Complète, 10/12 Surplus', () => {
    expect(statutLigneDe(1, 1, 10)).toBe('COMPLETE')
    expect(statutLigneDe(1, 2, 10)).toBe('SURPLUS')
    expect(statutLigneDe(10, 11, 10)).toBe('COMPLETE')
    expect(statutLigneDe(10, 12, 10)).toBe('SURPLUS')
  })
  it('RG-REC-018 écart 0 % : reçu = attendu Complète, +1 Surplus', () => {
    expect(statutLigneDe(10, 10, 0)).toBe('COMPLETE')
    expect(statutLigneDe(10, 11, 0)).toBe('SURPLUS')
  })
  it('RG-REC-018 seuil non entier sans erreur d’arrondi (3 attendus, 10 % → 3,3)', () => {
    expect(statutLigneDe(3, 3, 10)).toBe('COMPLETE')
    expect(statutLigneDe(3, 4, 10)).toBe('SURPLUS')
  })
  it('RG-REC-018 grandes quantités : 1000/1100 Complète, 1000/1101 Surplus', () => {
    expect(statutLigneDe(1000, 1100, 10)).toBe('COMPLETE')
    expect(statutLigneDe(1000, 1101, 10)).toBe('SURPLUS')
  })
})

describe('RG-REC-012 recherche : jetons et correspondance', () => {
  it('RG-REC-012 doublons supprimés, ordre de saisie conservé', () => {
    expect(jetonsRecherche('B A B a')).toEqual(['B', 'A', 'a'])
  })
  it('RG-REC-012 liste collée (CRLF, tabulations)', () => {
    expect(jetonsRecherche('910037\r\n910074\t910111')).toEqual(['910037', '910074', '910111'])
  })
  it('RG-REC-012 -W en minuscules accepté dans la recherche', () => {
    expect(correspond({ dossier: 910037, da: null, annonceur: null }, '910037-w')).toBe(true)
  })
  it('RG-REC-012 ligne sans annonceur : un texte ne correspond jamais', () => {
    expect(correspond({ dossier: 910037, da: null, annonceur: null }, 'acme')).toBe(false)
  })
  it('RG-REC-012 un n° ne cherche pas dans l’annonceur', () => {
    expect(correspond({ dossier: 1, da: 2, annonceur: 'Agence 910037' }, '910037')).toBe(false)
  })
})

describe('RG-REC-015 semaines ISO (changement d’année)', () => {
  it('RG-REC-015 2027-01-01 → 2026-W53 ; 2025-12-29 → 2026-W01 ; 2027-01-04 → 2027-W01', () => {
    expect(semaineIsoDe(new Date('2027-01-01T12:00:00Z'))).toEqual({ annee: 2026, semaine: 53 })
    expect(semaineIsoDe(new Date('2025-12-29T12:00:00Z'))).toEqual({ annee: 2026, semaine: 1 })
    expect(semaineIsoDe(new Date('2027-01-04T00:00:00Z'))).toEqual({ annee: 2027, semaine: 1 })
  })
  it('RG-REC-180 lundi de 2026-W53 = 2026-12-28 (base de l’ancienneté, Q-130)', () => {
    expect(lundiSemaineIso({ annee: 2026, semaine: 53 }).toISOString()).toBe(
      '2026-12-28T00:00:00.000Z',
    )
  })
})
