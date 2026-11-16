// COO-P03 — tests unitaires COMPLÉMENTAIRES des calculs purs de la validation admin
// (validation-admin.test.ts n'est pas dupliqué). Attendu : COORDINATION_REGLES_METIER.md RG-COO-005, 006, 007,
// 016, 019, 020 ; hypothèses Q-185 (2) et (3).
import { describe, expect, it } from 'vitest'
import {
  etatValidation,
  motifsDoute,
  normaliserTheme,
  resumeValidation,
  type DonneesValidation,
  type LigneValidation,
} from './validation-admin.ts'

const ligne = (o: Partial<LigneValidation> = {}): LigneValidation => ({
  contNum: 100,
  supportId: 1,
  theme: 'Thème A',
  themesPossibles: 1,
  active: true,
  ...o,
})
const affiche = (o: Partial<DonneesValidation> = {}): DonneesValidation => ({
  statut: 'IDENTIFIEE',
  supportId: 1,
  contNum: 100,
  theme: 'Thème A',
  validee: false,
  annulee: false,
  liens: [{ mode: 'BL', ligne: ligne() }],
  ...o,
})

describe('RG-COO-006 motifs de doute (complément)', () => {
  it('RG-COO-006 les six motifs se cumulent et sont tous rendus (BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE)', () => {
    const motifs = motifsDoute(
      affiche({
        supportId: 9,
        theme: 'Visuel lu',
        annulee: true,
        liens: [
          { mode: 'VISUEL', ligne: ligne({ theme: null, themesPossibles: 2 }) },
          { mode: 'BL', ligne: ligne({ contNum: 200 }) },
        ],
      }),
    )
    expect([...motifs].sort()).toEqual(['ANNULEE', 'BL', 'FORMAT', 'MULTI', 'SANS_IP', 'THEME'])
    expect(new Set(motifs).size).toBe(motifs.length)
  })

  it('RG-COO-006 THEME : affiche sans thème lu alors que le format en a plusieurs → doute THEME', () => {
    expect(
      motifsDoute(
        affiche({ theme: null, liens: [{ mode: 'BL', ligne: ligne({ themesPossibles: 3 }) }] }),
      ),
    ).toEqual(['THEME'])
  })

  it('RG-COO-006 MULTI rejet : deux lignes du MÊME dossier (deux semaines) → pas de motif MULTI', () => {
    expect(
      motifsDoute(
        affiche({
          liens: [
            { mode: 'BL', ligne: ligne() },
            { mode: 'BL', ligne: ligne() },
          ],
        }),
      ),
    ).toEqual([])
  })

  it('RG-COO-006 un seul lien hors format ou en mode MAIN parmi plusieurs suffit (FORMAT, BL)', () => {
    expect(
      motifsDoute(
        affiche({
          liens: [
            { mode: 'BL', ligne: ligne() },
            { mode: 'BL', ligne: ligne({ supportId: 2 }) },
          ],
        }),
      ),
    ).toEqual(['FORMAT'])
    expect(
      motifsDoute(
        affiche({
          liens: [
            { mode: 'BL', ligne: ligne() },
            { mode: 'MAIN', ligne: ligne() },
          ],
        }),
      ),
    ).toEqual(['BL'])
  })

  it('RG-COO-006 sans lien : aucun motif (réception inconnue, pas un doute)', () => {
    expect(motifsDoute(affiche({ liens: [], annulee: true }))).toEqual([])
  })

  it('RG-COO-006 THEME : tabulations et retours à la ligne ignorés dans la comparaison', () => {
    expect(normaliserTheme('Thème\tA\n')).toBe(normaliserTheme('theme a'))
    expect(
      motifsDoute(
        affiche({
          theme: 'THEME\tA',
          liens: [{ mode: 'BL', ligne: ligne({ themesPossibles: 2 }) }],
        }),
      ),
    ).toEqual([])
  })
})

describe('RG-COO-005 / RG-COO-007 état d’une affiche (complément)', () => {
  it('RG-COO-007 validation annulée seule : « À confirmer : doute » avec le seul motif ANNULEE', () => {
    const a = affiche({ annulee: true })
    expect(etatValidation(a)).toBe('A_CONFIRMER_DOUTE')
    expect(motifsDoute(a)).toEqual(['ANNULEE'])
  })

  it('RG-COO-007 rejet : une affiche ORPHELINE n’est jamais VALIDEE, même avec la case validée et un lien', () => {
    expect(etatValidation(affiche({ statut: 'ORPHELINE', validee: true }))).toBe(
      'RECEPTION_INCONNUE',
    )
  })

  it('RG-COO-005 la quantité n’entre pas dans le calcul : cas sûr quel que soit le reçu (RG-COO-016)', () => {
    // DonneesValidation ne porte aucune quantité : l'état ne peut pas en dépendre.
    expect(etatValidation(affiche())).toBe('A_CONFIRMER_PROPOSE')
    expect(Object.keys(affiche())).not.toContain('quantite')
  })
})

describe('RG-COO-019 / RG-COO-020 pastille du dossier (complément)', () => {
  it('RG-COO-019 rejet : seulement des réceptions inconnues → « Aucune affiche reçue », jamais « Validée »', () => {
    expect(resumeValidation(['RECEPTION_INCONNUE'], false)).toEqual({
      etat: 'AUCUNE_AFFICHE_RECUE',
      aConfirmer: 0,
      doutes: 0,
    })
  })

  it('RG-COO-020 « Validée » : une affiche validée suffit, une réception inconnue n’empêche pas', () => {
    expect(resumeValidation(['VALIDEE', 'RECEPTION_INCONNUE'], false).etat).toBe('VALIDEE')
  })

  it('RG-COO-019 limite : une seule affiche à confirmer parmi des validées → « À confirmer (1) »', () => {
    expect(resumeValidation(['VALIDEE', 'VALIDEE', 'A_CONFIRMER_PROPOSE'], false)).toEqual({
      etat: 'A_CONFIRMER',
      aConfirmer: 1,
      doutes: 0,
    })
  })

  it('RG-COO-019 dossier annulé avec des affiches validées → « — » (sans objet)', () => {
    expect(resumeValidation(['VALIDEE'], true).etat).toBe('SANS_OBJET')
  })
})
