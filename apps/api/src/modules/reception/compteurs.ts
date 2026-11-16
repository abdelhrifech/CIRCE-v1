// RG-REC-010 / RG-REC-054 : badges du menu Réception (palettes À contrôler recalculées à chaque lecture), calculés sur le site choisi (ou le périmètre).
import type { CompteursReception } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import { hasPermission } from '../../core/permissions/permissions.ts'
import { plateformesVisibles } from './attendues.ts'

// RG-X-021 : compteurs des menus (badge « Réceptions inconnues » = affiches orphelines, côté Réception).
export async function compteursReception(db: Db, identity: Identity): Promise<CompteursReception> {
  const plateformes = plateformesVisibles(identity)
  const where = plateformes === 'toutes' ? {} : { plateformeId: { in: plateformes } }
  const [palettes, orphelines] = await Promise.all([
    // Badge « Réception des affiches » = palettes à contrôler (sas).
    hasPermission(identity, 'reception.sas.consulter')
      ? db.reception.count({ where: { ...where, statut: 'A_CONTROLER' } })
      : null,
    // Badge rouge « Réceptions inconnues » = affiches orphelines du périmètre.
    hasPermission(identity, 'reception.inconnue.consulter')
      ? db.affiche.count({ where: { ...where, statut: 'ORPHELINE' } })
      : null,
  ])
  return { palettesAControler: palettes, affichesOrphelines: orphelines }
}
