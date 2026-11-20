import type { z } from 'zod'
import type { RebutStockSchema, CiblesAffichesStockSchema } from '@circe/shared'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPermission, assertPlateforme } from '../../core/permissions/permissions.ts'
import { ConflictError, NotFoundError, ForbiddenError } from '../../core/errors.ts'
import { mettreAuRebut } from '../reception/stocks.ts'
import { modifierAffiche } from '../reception/affiches.ts'
async function verifier(
  tx: Tx,
  i: Identity,
  cibles: z.infer<typeof CiblesAffichesStockSchema>['affiches'],
) {
  const uniques = [...new Map(cibles.map((c) => [c.id, c])).values()]
  for (const c of uniques) {
    const a = await tx.affiche.findUnique({ where: { id: c.id } })
    if (!a) throw new NotFoundError('Affiche introuvable')
    assertPlateforme(i, a.plateformeId)
    if (i.siteId !== null && i.siteId !== a.plateformeId)
      throw new ForbiddenError('Affiche hors du site choisi.')
    if (a.version !== c.version)
      throw new ConflictError('Une affiche a changé : rechargez le stock.')
  }
  return uniques
}
// RG-STK-NEW-001 : lot atomique, mêmes services/permissions et mêmes rejets que les actions existantes.
export async function rebutStock(tx: Tx, i: Identity, input: z.infer<typeof RebutStockSchema>) {
  assertPermission(i, 'stock.rebut')
  const cibles = await verifier(tx, i, input.affiches)
  for (const c of cibles)
    await mettreAuRebut(tx, i, c.id, { quantite: input.quantite, motif: input.motif })
  return {
    message: `${cibles.length} affiche(s) mise(s) au rebut.`,
    quantite: cibles.length * input.quantite,
  }
}
export async function conserverStock(
  tx: Tx,
  i: Identity,
  input: z.infer<typeof CiblesAffichesStockSchema>,
) {
  assertPermission(i, 'affiche.modifier')
  assertPermission(i, 'affiche.conserver')
  const cibles = await verifier(tx, i, input.affiches)
  for (const c of cibles)
    await modifierAffiche(tx, i, c.id, { version: c.version, aConserver: true })
  return { message: `${cibles.length} affiche(s) à conserver.`, quantite: cibles.length }
}
