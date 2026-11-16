import { describe, expect, it } from 'vitest'
import type { Identity } from '../../core/identity.ts'
import {
  aTraiter,
  donneesAnnulation,
  donneesValidation,
  estAssociee,
  marqueEtatReservations,
  numeroVisibleSuiviProd,
} from './effets-validation.ts'
import { etatValidation, messageConfirmation, motifsDoute } from './validation-admin.ts'

const coord: Identity = {
  userId: 7,
  identifiantExterne: 'c',
  nom: 'Coord',
  roles: ['coord'],
  perimetre: { toutesPlateformes: true, plateformeIds: [], lignes: [] },
  siteId: null,
}
const le = new Date('2026-11-05T10:00:00Z')

describe('COO-P04 effets de la validation (fonctions pures)', () => {
  it('RG-COO-015 / RG-COO-023 validation : par / le nominatifs, étiquette rack au passage non validée → validée', () => {
    expect(
      donneesValidation(coord, { validationAdmin: false, etiquetteRackAImprimer: false }, le),
    ).toEqual({
      validationAdmin: true,
      validationAdminParId: 7,
      validationAdminLe: le,
      validationAnnulee: false,
      themeModifie: false,
      etiquetteRackAImprimer: true,
    })
  })

  it('RG-COO-023 rejet : une affiche déjà validée ne redemande pas d’étiquette', () => {
    expect(
      donneesValidation(coord, { validationAdmin: true, etiquetteRackAImprimer: false }, le)
        .etiquetteRackAImprimer,
    ).toBe(false)
  })

  it('RG-COO-014 / RG-COO-030 annulation : par / le effacés, motif ANNULEE ou THEME, étiquette inchangée', () => {
    expect(donneesAnnulation('ANNULEE')).toEqual({
      validationAdmin: false,
      validationAdminParId: null,
      validationAdminLe: null,
      validationAnnulee: true,
    })
    expect(donneesAnnulation('THEME')).toMatchObject({ themeModifie: true })
    expect(donneesAnnulation('THEME')).not.toHaveProperty('etiquetteRackAImprimer')
  })

  it('RG-COO-030 motif THEME tant que le thème modifié n’est pas reconfirmé ; rejet : sans drapeau, pas de motif', () => {
    const base = {
      statut: 'IDENTIFIEE' as const,
      supportId: 1,
      contNum: 5,
      theme: 'A',
      validee: false,
      annulee: false,
      liens: [
        {
          mode: 'BL' as const,
          ligne: { contNum: 5, supportId: 1, theme: 'B', active: true, themesPossibles: 1 },
        },
      ],
    }
    expect(motifsDoute({ ...base, themeModifie: true })).toEqual(['THEME'])
    expect(etatValidation({ ...base, themeModifie: true })).toBe('A_CONFIRMER_DOUTE')
    expect(motifsDoute(base)).toEqual([])
  })

  it('RG-COO-021 / 024 / 025 / 026 effets calculés', () => {
    expect(numeroVisibleSuiviProd({ validee: true, sources: ['PREPA'] })).toBe(true)
    expect(numeroVisibleSuiviProd({ validee: false, sources: ['PREPA'] })).toBe(false)
    expect(estAssociee({ liensActifs: 2, validee: true })).toBe(true)
    expect(estAssociee({ liensActifs: 2, validee: false })).toBe(false)
    expect(aTraiter({ rebus: false, fusionnee: false, validee: false, liensActifs: 1 })).toBe(true)
    expect(aTraiter({ rebus: false, fusionnee: true, validee: false, liensActifs: 1 })).toBe(false)
    expect(aTraiter({ rebus: false, fusionnee: false, validee: true, liensActifs: 1 })).toBe(false)
    expect(marqueEtatReservations(true)).toBe('✓')
    expect(marqueEtatReservations(false)).toBe('•')
  })

  it('RG-COO-010 message de confirmation (maquette)', () => {
    expect(messageConfirmation(2)).toBe(
      '2 affiche(s) confirmée(s) par la Coordination : n° d’affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé au prochain retour.',
    )
  })
})
