// REC-P09 — Stock d'une affiche : mise au rebut (RG-REC-156), ajout / sortie manuels (RG-REC-155).
import { ecrireAfficheVersionnee } from './affiche.ts'
import { BusinessError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import type { Tx } from '../../core/transaction.ts'
import { assertDroitReception, assertPerimetreReception } from './permissions.ts'
import { enregistrerMouvement, stockAffiche } from './stock.ts'

const LIBELLE_MOTIF = {
  AFFICHE_DECHIREE: 'Affiche déchirée',
  MAUVAIS_VISUEL: 'Mauvais visuel',
  ERREUR_QUANTITE: 'Erreur de quantité',
  AUTRE: 'Autre',
} as const

// RG-REC-156 / RG-REC-064 : « Mettre au rebut » = mouvement négatif (≥ 1) plafonné au disponible, motif.
// RG-REC-153 : le rebut est une sortie de stock.
export async function mettreAuRebut(
  tx: Tx,
  identity: Identity,
  afficheId: number,
  input: { quantite: number; motif: keyof typeof LIBELLE_MOTIF },
) {
  assertDroitReception(identity, 'stock.rebut')
  const a = await tx.affiche.findUnique({ where: { id: afficheId } })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, a.plateformeId)
  const disponible = await stockAffiche(tx, afficheId)
  if (input.quantite < 1 || input.quantite > disponible) {
    throw new BusinessError(
      `Le rebut (${String(input.quantite)}) doit être entre 1 et le disponible (${String(disponible)}).`,
      {
        code: 'REC_REBUT_SUPERIEUR_STOCK',
        regle: 'RG-REC-156',
      },
    )
  }
  const { stock } = await enregistrerMouvement(tx, identity, {
    permission: 'stock.rebut',
    afficheId,
    type: 'MISE_AU_REBUT',
    quantite: -input.quantite,
    motif: LIBELLE_MOTIF[input.motif],
  })
  return { afficheId, stock }
}

// RG-REC-155 : ajout / sortie manuels. Droit « ? » pour tous (Q-117) → refusé par le catalogue (403).
// HYPOTHÈSE Q-117 : quantité > 0 et sortie ≤ disponible.
export async function mouvementManuel(
  tx: Tx,
  identity: Identity,
  afficheId: number,
  input: { sens: 'AJOUT' | 'SORTIE'; quantite: number; motif: string },
) {
  assertDroitReception(identity, 'stock.mouvement_manuel')
  const a = await tx.affiche.findUnique({ where: { id: afficheId } })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, a.plateformeId)
  const disponible = await stockAffiche(tx, afficheId)
  if (input.quantite < 1 || (input.sens === 'SORTIE' && input.quantite > disponible)) {
    throw new BusinessError('Quantité invalide (> 0, et sortie ≤ disponible).', {
      code: 'REC_MOUVEMENT_QUANTITE',
      regle: 'RG-REC-155',
    })
  }
  const { stock } = await enregistrerMouvement(tx, identity, {
    permission: 'stock.mouvement_manuel',
    afficheId,
    type: input.sens === 'AJOUT' ? 'AJOUT_MANUEL' : 'SORTIE_MANUELLE',
    quantite: input.sens === 'AJOUT' ? input.quantite : -input.quantite,
    motif: input.motif || (input.sens === 'AJOUT' ? 'Ajout manuel' : 'Sortie'),
  })
  if (input.sens === 'SORTIE') {
    const apres = await tx.affiche.findUniqueOrThrow({ where: { id: afficheId } })
    await ecrireAfficheVersionnee(tx, identity, apres, undefined, {
      dateDerniereSortie: new Date(),
    })
  }
  return { afficheId, stock }
}
