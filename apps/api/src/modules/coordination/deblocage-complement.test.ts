// COO-P08 — tests unitaires COMPLÉMENTAIRES (fonctions pures) : règles d'atelier (RG-COO-141), clé d'un groupe
// (RG-COO-145), statuts bloquants (RG-COO-143 / 144 / 277), libellé du suivi (RG-COO-149).
// Source : docs/COORDINATION_REGLES_METIER.md ; Q-191, Q-218.
import { describe, expect, it } from 'vitest'
import {
  STATUTS_FACE_LIBRES,
  STATUTS_UM_BLOQUANTS,
  decoderCle,
  encoderCle,
  groupeAutorise,
  libelleTypeSuivi,
  regleCorrespond,
} from './deblocage.ts'

describe('RG-COO-141 règles d’atelier (complément)', () => {
  const g = { idSiteCcf: 39, idTypePreparation: 23, idSurface: 5 }

  it('RG-COO-141 deux ateliers du même site : visible si l’UN d’eux autorise, même si l’autre exclut', () => {
    const ateliers = [
      { id: 1, idSiteCcf: 39 },
      { id: 2, idSiteCcf: 39 },
    ]
    const regles = [
      { atelierId: 1, typePreparationId: 23, surfaceId: null, exclusion: true },
      { atelierId: 1, typePreparationId: null, surfaceId: null, exclusion: false },
      { atelierId: 2, typePreparationId: 23, surfaceId: null, exclusion: false },
    ]
    expect(groupeAutorise(ateliers, regles, g)).toBe(true)
    expect(groupeAutorise([ateliers[0] ?? { id: 0, idSiteCcf: null }], regles, g)).toBe(false)
  })

  it('RG-COO-141 une règle sur type ET surface ne correspond que si les deux correspondent', () => {
    const r = { atelierId: 1, typePreparationId: 23, surfaceId: 5, exclusion: false }
    expect(regleCorrespond(r, 23, 5)).toBe(true)
    expect(regleCorrespond(r, 23, 6)).toBe(false)
    expect(regleCorrespond(r, 24, 5)).toBe(false)
    expect(regleCorrespond(r, null, 5)).toBe(false)
  })

  it('RG-COO-141 rejet : seulement des exclusions (aucune inclusion) ⇒ non visible', () => {
    expect(
      groupeAutorise(
        [{ id: 1, idSiteCcf: 39 }],
        [{ atelierId: 1, typePreparationId: 99, surfaceId: null, exclusion: true }],
        g,
      ),
    ).toBe(false)
  })
})

describe('RG-COO-143 / 144 / 145 / 149 limites (complément)', () => {
  it('RG-COO-143 / 277 limite 5 / 6 : « À imprimer » (5) non bloquant, « Préparé » (6) bloquant ; Annulé (4) jamais', () => {
    expect(STATUTS_UM_BLOQUANTS).not.toContain('A_IMPRIMER')
    expect(STATUTS_UM_BLOQUANTS).toContain('PREPARE')
    expect(STATUTS_UM_BLOQUANTS).not.toContain('ANNULE')
    expect(STATUTS_UM_BLOQUANTS).not.toContain('ERREUR')
  })

  it('RG-COO-144 face « Erreur » (3) et « Instruction OK » (2) bloquent (statut ≥ 2)', () => {
    expect(STATUTS_FACE_LIBRES).not.toContain('ERREUR')
    expect(STATUTS_FACE_LIBRES).not.toContain('INSTRUCTION_OK')
  })

  it('RG-COO-145 clé : identifiants à zéro et grands n° conservés ; segment vide ou négatif refusé', () => {
    // Audit COO-P08 B1 : la clé UM désigne le groupe Broadcast entier (`UM:<IdGroupePreparation>`).
    const c = { type: 'UM' as const, idGroupe: 0 }
    expect(decoderCle(encoderCle(c))).toEqual(c)
    expect(decoderCle(encoderCle({ type: 'UM', idGroupe: 99_999_999 }))).toEqual({
      type: 'UM',
      idGroupe: 99_999_999,
    })
    expect(decoderCle('UM:')).toBeNull()
    expect(decoderCle('UM:-1')).toBeNull()
    expect(decoderCle('TRAIN:1:2:2026:3:-:-')).toBeNull()
  })

  it('RG-COO-149 « Tole traditionnelle » reconnue sans tenir compte de la casse ni des espaces ; null conservé', () => {
    expect(libelleTypeSuivi('  TOLE Traditionnelle ')).toBe('4m² colle')
    expect(libelleTypeSuivi(null)).toBeNull()
    expect(libelleTypeSuivi('Tole traditionnelle 2')).toBe('Tole traditionnelle 2')
  })
})
