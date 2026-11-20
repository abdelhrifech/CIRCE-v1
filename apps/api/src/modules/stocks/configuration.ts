import { ConfigurationFinCampagneSchema } from '@circe/shared'
import type { z } from 'zod'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPermission } from '../../core/permissions/permissions.ts'
import { ConflictError } from '../../core/errors.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
const cle = 'finCampagne.configuration'
// Paramètres issus de maquette-new/data.js:148, propres au module Stocks.
export async function lireConfigurationFinCampagne(db: Db | Tx) {
  const r = await db.parametre.findFirst({ where: { cle, plateformeId: null } })
  return ConfigurationFinCampagneSchema.parse(
    r
      ? { ...(JSON.parse(r.valeur) as object), version: r.version }
      : { version: 0, delais: { '2m2': 4, '8m2': 2, autres: 4 }, attention: ['BDX', 'MUI'] },
  )
}
export async function configurationAdmin(db: Db | Tx, i: Identity) {
  assertPermission(i, 'parametrage.gerer')
  return lireConfigurationFinCampagne(db)
}
export async function sauverConfigurationFinCampagne(
  tx: Tx,
  i: Identity,
  input: z.infer<typeof ConfigurationFinCampagneSchema>,
) {
  assertPermission(i, 'parametrage.gerer')
  const actuel = await lireConfigurationFinCampagne(tx)
  if (actuel.version !== input.version)
    throw new ConflictError('Configuration modifiée entre-temps : rechargez.')
  const valeur = JSON.stringify({ delais: input.delais, attention: [...new Set(input.attention)] })
  if (input.version === 0) await tx.parametre.create({ data: { cle, plateformeId: null, valeur } })
  else {
    const r = await tx.parametre.updateMany({
      where: { cle, plateformeId: null, version: input.version },
      data: { valeur, version: { increment: 1 } },
    })
    if (!r.count) throw new ConflictError('Configuration modifiée entre-temps : rechargez.')
  }
  await ecrireJournal(tx, {
    typeEntite: 'PARAMETRE',
    entiteId: cle,
    action: 'MODIFICATION_PARAMETRE',
    parId: i.userId,
    ancienneValeur: JSON.stringify(actuel),
    nouvelleValeur: valeur,
  })
  return lireConfigurationFinCampagne(tx)
}
