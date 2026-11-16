import { describe, expect, it } from 'vitest'
import {
  etatValidation,
  motifsDoute,
  normaliserTheme,
  resumeValidation,
  type DonneesValidation,
} from './validation-admin.ts'

const ligne = (o: Partial<DonneesValidation['liens'][number]['ligne']> = {}) => ({
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

describe('RG-COO-005 / 006 / 007 état de validation d’une affiche (calcul)', () => {
  it('RG-COO-005 cas sûr : rattachée en BL, n° lu = dossier, même format, un thème, un dossier → proposé', () => {
    expect(motifsDoute(affiche())).toEqual([])
    expect(etatValidation(affiche())).toBe('A_CONFIRMER_PROPOSE')
  })

  it('RG-COO-005 rejet : un seul motif suffit à refuser le cas sûr (doute)', () => {
    expect(etatValidation(affiche({ liens: [{ mode: 'VISUEL', ligne: ligne() }] }))).toBe(
      'A_CONFIRMER_DOUTE',
    )
  })

  it('RG-COO-007 sans dossier rattaché (orpheline ou sans lien) : réception inconnue, jamais validée', () => {
    expect(etatValidation(affiche({ statut: 'ORPHELINE', liens: [], validee: true }))).toBe(
      'RECEPTION_INCONNUE',
    )
    expect(etatValidation(affiche({ liens: [] }))).toBe('RECEPTION_INCONNUE')
  })

  it('RG-COO-007 validée par une personne : VALIDEE prime sur les motifs', () => {
    expect(
      etatValidation(affiche({ validee: true, liens: [{ mode: 'MAIN', ligne: ligne() }] })),
    ).toBe('VALIDEE')
  })

  it('RG-COO-006 / RG-COO-018 motif BL : mode VISUEL ou MAIN ; n° lu absent des lignes', () => {
    expect(motifsDoute(affiche({ liens: [{ mode: 'MAIN', ligne: ligne() }] }))).toEqual(['BL'])
    expect(motifsDoute(affiche({ liens: [{ mode: 'VISUEL', ligne: ligne() }] }))).toEqual(['BL'])
    expect(motifsDoute(affiche({ contNum: 999 }))).toEqual(['BL'])
  })

  it('RG-COO-006 motif FORMAT : support de l’affiche ≠ support de la ligne', () => {
    expect(motifsDoute(affiche({ supportId: 2 }))).toEqual(['FORMAT'])
  })

  it('RG-COO-006 motif THEME : plusieurs thèmes dans ce format et thème différent (accents / casse ignorés)', () => {
    const l = ligne({ themesPossibles: 2 })
    expect(motifsDoute(affiche({ theme: 'Autre', liens: [{ mode: 'BL', ligne: l }] }))).toEqual([
      'THEME',
    ])
    expect(
      motifsDoute(affiche({ theme: '  THÈME  a ', liens: [{ mode: 'BL', ligne: l }] })),
    ).toEqual([])
  })

  it('RG-COO-006 rejet THEME : un seul thème possible → pas de doute même si le libellé diffère', () => {
    expect(motifsDoute(affiche({ theme: 'Autre' }))).toEqual([])
  })

  it('RG-COO-006 motif MULTI : liens vers deux dossiers', () => {
    expect(
      motifsDoute(
        affiche({
          liens: [
            { mode: 'BL', ligne: ligne() },
            { mode: 'BL', ligne: ligne({ contNum: 200 }) },
          ],
        }),
      ),
    ).toEqual(['MULTI'])
  })

  it('RG-COO-006 motif SANS_IP : ligne sans thème (IP non saisies)', () => {
    expect(
      motifsDoute(affiche({ liens: [{ mode: 'BL', ligne: ligne({ theme: null }) }] })),
    ).toEqual(['SANS_IP'])
  })

  it('RG-COO-006 motif ANNULEE et cumul des motifs', () => {
    expect(
      motifsDoute(
        affiche({
          annulee: true,
          supportId: 3,
          liens: [{ mode: 'MAIN', ligne: ligne({ theme: null }) }],
        }),
      ),
    ).toEqual(['BL', 'FORMAT', 'SANS_IP', 'ANNULEE'])
  })

  it('normaliserTheme ignore accents, casse et espaces', () => {
    expect(normaliserTheme(' Été   noël ')).toBe('ETE NOEL')
    expect(normaliserTheme(null)).toBe('')
  })
})

describe('RG-COO-019 / RG-COO-020 pastille de validation du dossier', () => {
  it('RG-COO-019 à confirmer (n, dont k doutes)', () => {
    expect(
      resumeValidation(['A_CONFIRMER_PROPOSE', 'A_CONFIRMER_DOUTE', 'VALIDEE'], false),
    ).toEqual({ etat: 'A_CONFIRMER', aConfirmer: 2, doutes: 1 })
  })

  it('RG-COO-020 validation admin faite : au moins une affiche reçue, toutes confirmées', () => {
    expect(resumeValidation(['VALIDEE', 'VALIDEE'], false).etat).toBe('VALIDEE')
  })

  it('RG-COO-020 rejet : sans affiche reçue, jamais « Validée »', () => {
    expect(resumeValidation([], false)).toEqual({
      etat: 'AUCUNE_AFFICHE_RECUE',
      aConfirmer: 0,
      doutes: 0,
    })
  })

  it('RG-COO-019 dossier annulé : sans objet (« — »), rien à confirmer', () => {
    expect(resumeValidation(['A_CONFIRMER_DOUTE'], true)).toEqual({
      etat: 'SANS_OBJET',
      aConfirmer: 0,
      doutes: 0,
    })
  })
})
