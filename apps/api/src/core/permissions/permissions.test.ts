import { describe, expect, it } from 'vitest'
import { PERMISSION_CODES, type Role } from '@circe/shared'
import { ForbiddenError } from '../errors.ts'
import type { Identity } from '../identity.ts'
import { CATALOGUE_PERMISSIONS } from './catalogue.ts'
import {
  assertAtelier,
  assertPermission,
  assertPlateforme,
  hasPermission,
  permissionsOf,
} from './permissions.ts'

function identite(
  roles: Role[],
  lignes: { plateformeId: number; atelierId: number | null }[] = [],
): Identity {
  return {
    userId: 1,
    identifiantExterne: 'u',
    nom: null,
    roles,
    perimetre: {
      toutesPlateformes: roles.includes('admin'),
      plateformeIds: [...new Set(lignes.map((l) => l.plateformeId))],
      lignes,
    },
    siteId: null,
  }
}

const LECTURES = new Set([
  'bus.consulter',
  'reception.attendues.consulter',
  'reception.sas.consulter',
  'affiche.consulter',
  'stock.consulter',
  'alerte.consulter',
  'historique.consulter',
  'export.tableau',
  'instruction.consulter',
  'reservations.consulter',
  'suivi_production.consulter',
])

describe('catalogue des permissions (RG-REC-002, RG-COO-165)', () => {
  it('chaque permission a un libellé et une source', () => {
    for (const code of PERMISSION_CODES) {
      expect(CATALOGUE_PERMISSIONS[code].libelle, code).not.toBe('')
      expect(CATALOGUE_PERMISSIONS[code].source, code).not.toBe('')
    }
  })

  it('RG-COO-168 le rôle Commerce n’a que des permissions de lecture', () => {
    const ecritures = permissionsOf(['com']).filter((code) => !LECTURES.has(code))
    expect(ecritures).toEqual([])
  })

  it('RG-STK-NEW-001 Expédition peut consulter Stocks sans les droits de consultation Réception', () => {
    const droits = permissionsOf(['expe'])
    expect(droits).toContain('stock.consulter')
    expect(droits).toContain('stock.rebut')
    expect(droits).not.toContain('affiche.consulter')
    expect(droits).not.toContain('stock.fin_campagne.agir')
  })

  it('RG-COO-169 aucune permission n’est donnée hors des 6 rôles provisoires (Q-003)', () => {
    const roles = new Set(PERMISSION_CODES.flatMap((c) => CATALOGUE_PERMISSIONS[c].roles))
    expect(
      [...roles].every((r) => ['coord', 'cheq', 'recep', 'expe', 'admin', 'com'].includes(r)),
    ).toBe(true)
  })

  it('les cases non tranchées « ? » sont refusées (Q-117, Q-220)', () => {
    for (const role of ['coord', 'cheq', 'recep', 'expe', 'com'] as const) {
      expect(hasPermission({ roles: [role] }, 'stock.mouvement_manuel')).toBe(false)
      expect(hasPermission({ roles: [role] }, 'alerte.acquitter')).toBe(false)
    }
  })

  it('Q-421 l’administrateur a tous les droits (super-utilisateur)', () => {
    for (const code of PERMISSION_CODES)
      expect(hasPermission({ roles: ['admin'] }, code)).toBe(true)
    expect(permissionsOf(['admin'])).toEqual([...PERMISSION_CODES])
  })
})

describe('assertPermission', () => {
  it('RG-REC-003 autorise la validation admin pour coord et admin', () => {
    expect(() => {
      assertPermission(identite(['coord']), 'validation_admin.valider')
    }).not.toThrow()
    expect(() => {
      assertPermission(identite(['admin']), 'validation_admin.valider')
    }).not.toThrow()
  })

  it('RG-REC-003 refuse la validation admin à l’agent de réception (403, regle et code du module)', () => {
    const run = () => {
      assertPermission(identite(['recep']), 'validation_admin.valider', {
        code: 'REC_VALIDATION_RESERVEE',
        regle: 'RG-REC-003',
      })
    }
    expect(run).toThrow(ForbiddenError)
    try {
      run()
    } catch (error) {
      expect((error as ForbiddenError).toResponse()).toMatchObject({
        code: 'REC_VALIDATION_RESERVEE',
        regle: 'RG-REC-003',
      })
    }
  })

  it('RG-REC-002 utilise le code PERMISSION et la règle RG-REC-002 par défaut', () => {
    try {
      assertPermission(identite(['com']), 'reception.valider')
      expect.unreachable()
    } catch (error) {
      expect((error as ForbiddenError).httpStatus).toBe(403)
      expect((error as ForbiddenError).toResponse()).toMatchObject({
        code: 'PERMISSION',
        regle: 'RG-REC-002',
      })
    }
  })

  it('un utilisateur sans rôle n’a aucune permission', () => {
    expect(permissionsOf([])).toEqual([])
  })

  it('cumule les permissions de plusieurs rôles', () => {
    const union = permissionsOf(['recep', 'expe'])
    expect(union).toContain('reception.controler')
    expect(union).toContain('colis.gerer')
  })
})

describe('périmètre (RG-REC-001, RG-COO-167)', () => {
  it('RG-REC-001 accepte une plateforme du périmètre et refuse les autres (403 REC_PERIMETRE_INTERDIT)', () => {
    const id = identite(['recep'], [{ plateformeId: 1, atelierId: null }])
    expect(() => {
      assertPlateforme(id, 1)
    }).not.toThrow()
    expect(() => {
      assertPlateforme(id, 2)
    }).toThrow(ForbiddenError)
  })

  it('RG-COO-167 l’administrateur voit tous les sites', () => {
    expect(() => {
      assertPlateforme(identite(['admin']), 99)
    }).not.toThrow()
  })

  it('RG-REC-001 un utilisateur sans périmètre n’accède à aucune plateforme', () => {
    expect(() => {
      assertPlateforme(identite(['coord']), 1)
    }).toThrow(ForbiddenError)
  })

  it('RG-COO-167 une ligne sans atelier couvre tous les ateliers ; une ligne avec atelier le restreint', () => {
    const large = identite(['coord'], [{ plateformeId: 1, atelierId: null }])
    expect(() => {
      assertAtelier(large, 1, 5)
    }).not.toThrow()
    const strict = identite(['coord'], [{ plateformeId: 1, atelierId: 3 }])
    expect(() => {
      assertAtelier(strict, 1, 3)
    }).not.toThrow()
    expect(() => {
      assertAtelier(strict, 1, 5)
    }).toThrow(ForbiddenError)
  })
})
