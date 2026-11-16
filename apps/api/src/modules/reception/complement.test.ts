// REC-P01 — compléments unitaires écrits à partir des règles (RECEPTION_REGLES_METIER.md §2, §3.2,
// RG-REC-002, 003, 043 ; QUESTIONS_OUVERTES.md Q-003, Q-136, Q-147, Q-349).
import { describe, expect, it } from 'vitest'
import { ROLES, type Role } from '@circe/shared'
import { ForbiddenError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { hasPermission } from '../../core/permissions/permissions.ts'
import { canTransition } from '../../core/state-machine.ts'
import { estFamille2m2, libelleSupport, supportsDeRecherche } from './formats.ts'
import { assertDroitReception, assertPerimetreReception } from './permissions.ts'
import { TRANSITIONS_AFFICHE, TRANSITIONS_RATTACHEMENT, TRANSITIONS_RECEPTION } from './statuts.ts'

function identite(roles: Role[], plateformeIds: number[] = [1]): Identity {
  return {
    userId: 1,
    identifiantExterne: 'u',
    nom: null,
    roles,
    perimetre: {
      toutesPlateformes: roles.includes('admin'),
      plateformeIds,
      lignes: plateformeIds.map((plateformeId) => ({ plateformeId, atelierId: null })),
    },
    siteId: null,
  }
}

function refus(fn: () => void): ForbiddenError {
  try {
    fn()
  } catch (e) {
    if (e instanceof ForbiddenError) return e
    throw e
  }
  throw new Error('aucun refus')
}

// §2 « Consulter la Liste des affiches, la fiche affiche et la fiche réception ».
const CONSULTER: Record<Role, boolean> = {
  coord: true,
  cheq: true,
  recep: true,
  expe: false,
  admin: true,
  com: true,
}
// §2 « Valider / Annuler la validation » (RG-REC-003).
const VALIDER: Record<Role, boolean> = {
  coord: true,
  cheq: false,
  recep: false,
  expe: false,
  admin: true,
  com: false,
}

describe('RG-REC-002 assertDroitReception — consultation, chaque profil', () => {
  it.each(ROLES)('RG-REC-002 consulter la fiche réception / affiche, profil %s', (role) => {
    const appel = () => {
      assertDroitReception(identite([role]), 'affiche.consulter')
    }
    if (CONSULTER[role]) {
      expect(appel).not.toThrow()
    } else {
      expect(refus(appel)).toMatchObject({
        httpStatus: 403,
        code: 'REC_ACCES_REFUSE',
        regle: 'RG-REC-002',
      })
    }
  })

  it('RG-REC-002 utilisateur sans rôle : refusé', () => {
    expect(
      refus(() => {
        assertDroitReception(identite([]), 'affiche.consulter')
      }),
    ).toMatchObject({ code: 'REC_ACCES_REFUSE' })
  })

  it('RG-REC-002 cumul de rôles : expe + com consulte (union des droits)', () => {
    expect(() => {
      assertDroitReception(identite(['expe', 'com']), 'affiche.consulter')
    }).not.toThrow()
  })
})

describe('RG-REC-003 validation admin réservée à coord et admin, chaque profil', () => {
  it.each(ROLES)('RG-REC-003 valider / annuler la validation, profil %s', (role) => {
    const appel = () => {
      assertDroitReception(identite([role]), 'validation_admin.valider')
    }
    if (VALIDER[role]) {
      expect(appel).not.toThrow()
    } else {
      expect(refus(appel)).toMatchObject({
        httpStatus: 403,
        code: 'REC_VALIDATION_RESERVEE',
        regle: 'RG-REC-003',
      })
    }
  })
})

describe('RG-REC-002 catalogue : lignes de la matrice §2 utilisées par le socle REC-P01', () => {
  it('RG-REC-002 « Changer de thème, retirer un rattachement » : cheq « ? » refusé (Q-349), expe et com refusés, coord et recep autorisés', () => {
    expect(hasPermission({ roles: ['coord'] }, 'affiche.rattachement.modifier')).toBe(true)
    expect(hasPermission({ roles: ['recep'] }, 'affiche.rattachement.modifier')).toBe(true)
    expect(hasPermission({ roles: ['cheq'] }, 'affiche.rattachement.modifier')).toBe(false)
    expect(hasPermission({ roles: ['expe'] }, 'affiche.rattachement.modifier')).toBe(false)
    expect(hasPermission({ roles: ['com'] }, 'affiche.rattachement.modifier')).toBe(false)
  })

  it('RG-REC-002 « Consulter l’historique et le journal » : tous sauf expe', () => {
    for (const role of ROLES) {
      expect(hasPermission({ roles: [role] }, 'historique.consulter'), role).toBe(role !== 'expe')
    }
  })

  it('RG-REC-002 « Mettre au rebut » : cheq, recep, expe et administrateur', () => {
    for (const role of ROLES) {
      expect(hasPermission({ roles: [role] }, 'stock.rebut'), role).toBe(
        ['cheq', 'recep', 'expe', 'admin'].includes(role),
      )
    }
  })
})

describe('RG-REC-001 assertPerimetreReception', () => {
  it('RG-REC-001 plateforme du périmètre acceptée, autre refusée (403 REC_PERIMETRE_INTERDIT)', () => {
    const id = identite(['recep'], [3, 4])
    expect(() => {
      assertPerimetreReception(id, 4)
    }).not.toThrow()
    expect(
      refus(() => {
        assertPerimetreReception(id, 5)
      }),
    ).toMatchObject({ httpStatus: 403, code: 'REC_PERIMETRE_INTERDIT', regle: 'RG-REC-001' })
  })
})

describe('§3.2 transitions interdites complémentaires', () => {
  it('RG-REC-071 A_IDENTIFIER → A_IDENTIFIER et A_CONTROLER → A_CONTROLER sont interdites', () => {
    expect(canTransition(TRANSITIONS_RECEPTION, 'A_IDENTIFIER', 'A_IDENTIFIER')).toBe(false)
    expect(canTransition(TRANSITIONS_RECEPTION, 'A_CONTROLER', 'A_CONTROLER')).toBe(false)
  })
  it('RG-REC-114 ORPHELINE → ORPHELINE est interdite', () => {
    expect(canTransition(TRANSITIONS_AFFICHE, 'ORPHELINE', 'ORPHELINE')).toBe(false)
  })
  it('RG-REC-137 ACTIF → ACTIF est interdite', () => {
    expect(canTransition(TRANSITIONS_RATTACHEMENT, 'ACTIF', 'ACTIF')).toBe(false)
  })
})

describe('RG-REC-043 famille 2 m² — valeurs limites', () => {
  it('RG-REC-043 un format commençant par « 2m2 » hors des quatre noms n’est pas de la famille', () => {
    expect(estFamille2m2('2m2 Autre')).toBe(false)
    expect(estFamille2m2('12m2')).toBe(false)
    expect(estFamille2m2('')).toBe(false)
  })

  it('RG-REC-043 recherche depuis « 2m2 » ou « 2m2 Venusial » : même liste (famille + Scrolling MUI Paris)', () => {
    const supports = [
      { nom: '2m2' },
      { nom: '2m2 Scrolling' },
      { nom: '2m2 Venusial' },
      { nom: 'Scrolling MUI Paris' },
      { nom: '8m2' },
    ]
    const attendu = ['2m2', '2m2 Scrolling', '2m2 Venusial', 'Scrolling MUI Paris']
    expect(supportsDeRecherche('2m2', supports).map((s) => s.nom)).toEqual(attendu)
    expect(supportsDeRecherche('2m2 Venusial', supports).map((s) => s.nom)).toEqual(attendu)
  })

  it('RG-REC-043 recherche depuis « Scrolling MUI Paris » : ce support seulement (la règle part du support 2m2*)', () => {
    const supports = [{ nom: '2m2' }, { nom: 'Scrolling MUI Paris' }]
    expect(supportsDeRecherche('Scrolling MUI Paris', supports).map((s) => s.nom)).toEqual([
      'Scrolling MUI Paris',
    ])
  })

  it('RG-REC-043 affichage : « 2m2 » et « 2 m2 » inchangés', () => {
    expect(libelleSupport('2m2')).toBe('2m2')
    expect(libelleSupport('2 m2')).toBe('2 m2')
  })
})
