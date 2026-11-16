// Écriture d'une affiche sous verrou optimiste (RG-REC-009, CLAUDE.md §6). TOUTE écriture sur une affiche
// existante (statut, cache de quantité, rattachement) passe ici : `updateMany where version` + incrément.
// Sans version fournie par le client, on utilise celle lue dans la transaction : deux écritures
// concurrentes sur la même affiche ne peuvent pas toutes deux réussir (protège aussi RG-X-060).
import { ConflictError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { Prisma } from '../../generated/prisma/client.ts'
import { REC } from './permissions.ts'

// RG-REC-169 / Q-155 : une affiche CIBLE d'une fusion héritée est en lecture seule → 409.
export async function assertAfficheNonFusionnee(tx: Tx, afficheId: number): Promise<void> {
  const fusion = await tx.fusionAffiche.findFirst({
    where: { afficheId, NOT: { afficheChapeauId: afficheId } },
    select: { id: true },
  })
  if (fusion) {
    throw new ConflictError('Affiche fusionnée (héritée) : lecture seule.', {
      code: 'REC_AFFICHE_FUSIONNEE_LECTURE_SEULE',
      regle: 'RG-REC-169',
    })
  }
}

export async function ecrireAfficheVersionnee(
  tx: Tx,
  identity: Identity,
  affiche: { id: number; version: number },
  expectedVersion: number | undefined,
  data: Prisma.AfficheUpdateManyMutationInput = {},
): Promise<number> {
  await assertAfficheNonFusionnee(tx, affiche.id)
  return updateWithVersion({
    expectedVersion: expectedVersion ?? affiche.version,
    update: (where) =>
      tx.affiche.updateMany({
        where: { id: affiche.id, ...where },
        data: { ...data, updatedById: identity.userId, ...bumpVersion },
      }),
    ...REC.version,
  })
}
