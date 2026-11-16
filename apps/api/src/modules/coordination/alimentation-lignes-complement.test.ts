// COO-P05 — tests unitaires COMPLÉMENTAIRES (fonctions pures) des lignes attendues : limites des semaines ISO
// (RG-COO-083, année à 53 semaines), regroupement par clé (RG-COO-080 / 082), dédoublonnage (RG-COO-090),
// « Où en est-il » (RG-COO-107). Source : docs/COORDINATION_REGLES_METIER.md ; Q-187.
import { describe, expect, it } from 'vitest'
import { formatSemaineIso } from '@circe/shared'
import {
  dansFenetre,
  fenetreAlimentation,
  lireSupportsBandeau,
  planDedoublonnage,
  regrouper,
  type CleLigne,
} from './alimentation-lignes.ts'
import { etapeLigne, etapeMoinsAvancee } from './reservations.ts'

const fen = (iso: string, n = 8) => {
  const f = fenetreAlimentation(new Date(iso), n)
  return [formatSemaineIso(f.debut), formatSemaineIso(f.fin)]
}

describe('RG-COO-083 semaines ISO et fenêtre S → S+8 (complément)', () => {
  it('RG-COO-083 lundi 2026-12-28 (S53/2026) → S08/2027 ; dimanche 2027-01-03 encore en S53 → même fenêtre', () => {
    expect(fen('2026-12-28T00:00:00Z')).toEqual(['2026-W53', '2027-W08'])
    expect(fen('2027-01-03T23:00:00Z')).toEqual(['2026-W53', '2027-W08'])
  })

  it('RG-COO-083 lundi 2027-01-04 = S01/2027 → S09/2027 ; année à 52 semaines : 2027-12-27 (S52) → S08/2028', () => {
    expect(fen('2027-01-04T00:00:00Z')).toEqual(['2027-W01', '2027-W09'])
    expect(fen('2027-12-27T00:00:00Z')).toEqual(['2027-W52', '2028-W08'])
  })

  it('RG-COO-083 paramètre de fenêtre : 0 semaine → S seule ; bornes incluses, au-delà exclues', () => {
    expect(fen('2026-11-05T10:00:00Z', 0)).toEqual(['2026-W45', '2026-W45'])
    const f = fenetreAlimentation(new Date('2026-12-21T10:00:00Z'), 8)
    expect(dansFenetre({ annee: 2026, semaine: 52 }, f)).toBe(true)
    expect(dansFenetre({ annee: 2026, semaine: 53 }, f)).toBe(true)
    expect(dansFenetre({ annee: 2027, semaine: 7 }, f)).toBe(true)
    expect(dansFenetre({ annee: 2027, semaine: 8 }, f)).toBe(false)
    expect(dansFenetre({ annee: 2026, semaine: 51 }, f)).toBe(false)
  })
})

describe('RG-COO-080 / 082 regroupement par clé (complément)', () => {
  const cle: CleLigne = {
    plateformeId: 1,
    contNum: 2,
    supportId: 3,
    themeCle: 'A',
    idThemeBandeau: null,
    semaine: { annee: 2026, semaine: 46 },
  }

  it('RG-COO-082 limite : toutes les lignes « reste en place » ⇒ une clé de quantité 0 (la clé existe)', () => {
    const g = regrouper([
      { cle, quantite: 5, resteEnPlace: true },
      { cle, quantite: 7, resteEnPlace: true },
    ])
    expect(g).toHaveLength(1)
    expect(g[0]?.quantite).toBe(0)
  })

  it('RG-COO-080 / 084 thème nul (provisoire) et thème vide sont la même clé ; bandeau nul ≠ bandeau 0 non', () => {
    const g = regrouper([
      { cle: { ...cle, themeCle: null }, quantite: 1 },
      { cle: { ...cle, themeCle: null }, quantite: 2 },
      { cle, quantite: 4 },
    ])
    expect(g.map((x) => x.quantite).sort()).toEqual([3, 4])
  })
})

describe('RG-COO-090 plan de dédoublonnage (complément)', () => {
  const d = (id: number, cle: string, liensActifs: number, iso: string) => ({
    id,
    cle,
    liensActifs,
    createdAt: new Date(iso),
  })

  it('RG-COO-090 deux doublons avec affiche : la plus récente gardée ; même date : le plus grand id', () => {
    expect(planDedoublonnage([d(1, 'k', 2, '2026-01-01'), d(2, 'k', 1, '2026-02-01')])).toEqual([
      { garder: 2, fermer: [1] },
    ])
    expect(planDedoublonnage([d(5, 'k', 0, '2026-01-01'), d(9, 'k', 0, '2026-01-01')])).toEqual([
      { garder: 9, fermer: [5] },
    ])
  })

  it('RG-COO-090 porteuse d’affiche préférée même plus ancienne ; trois doublons → deux fermées ; clés uniques → rien', () => {
    expect(
      planDedoublonnage([
        d(1, 'k', 1, '2025-01-01'),
        d(2, 'k', 0, '2026-01-01'),
        d(3, 'k', 0, '2026-03-01'),
        d(4, 'z', 0, '2026-03-01'),
      ]),
    ).toEqual([{ garder: 1, fermer: [3, 2] }])
    expect(planDedoublonnage([d(1, 'a', 0, '2026-01-01'), d(2, 'b', 3, '2026-01-01')])).toEqual([])
  })
})

describe('RG-COO-095 / RG-COO-107 limites (complément)', () => {
  it('RG-COO-095 paramètre des supports bandeau vide ou mal formé ⇒ aucune correspondance', () => {
    expect(lireSupportsBandeau('').size).toBe(0)
    expect(lireSupportsBandeau('5;x:1').size).toBe(0)
    // Entrées mal formées ignorées (observation du test-engineer : « :3 » donnait 0 → 3).
    expect(lireSupportsBandeau(':3;5:;1:2:3;-1:4').size).toBe(0)
    expect([...lireSupportsBandeau(' 5 : 100 ; 19:102 ')]).toEqual([
      [5, 100],
      [19, 102],
    ])
  })

  it('RG-COO-107 limites : reçu = attendu non validé ⇒ à confirmer ; reçu > attendu validé sans production ⇒ en production ; aucune étape ⇒ Annulé', () => {
    const base = {
      annulee: false,
      provisoire: false,
      source: 'PREPA' as const,
      attendu: 10,
      production: [],
    }
    expect(etapeLigne({ ...base, recu: 10, toutesValidees: false })).toBe('VALIDATION_A_CONFIRMER')
    expect(etapeLigne({ ...base, recu: 12, toutesValidees: true })).toBe('EN_PRODUCTION')
    expect(etapeLigne({ ...base, recu: 9, toutesValidees: true })).toBe('RECUES_EN_PARTIE')
    expect(etapeLigne({ ...base, recu: 10, toutesValidees: true, production: ['ANNULE'] })).toBe(
      'EN_PRODUCTION',
    )
    expect(etapeMoinsAvancee([])).toBe('ANNULE')
  })
})
