// Quantités du module Réception : une seule vérité, les mouvements (RG-REC-153, RG-REC-154).
// Fonctions appelées DANS la transaction d'un service public ; les écritures vérifient le droit ici.
import type { PermissionCode } from '@circe/shared'
import { BusinessError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import type { TypeMouvement } from '../../generated/prisma/client.ts'
import { ecrireAfficheVersionnee } from './affiche.ts'
import { assertDroitReception, assertPerimetreReception } from './permissions.ts'
import * as repo from './repository.ts'

// RG-REC-153 : stock disponible = Σ mouvements de l'affiche.
export function stockAffiche(tx: Tx, afficheId: number): Promise<number> {
  return repo.sommeMouvements(tx, afficheId)
}

// RG-REC-153 / RG-REC-017 : reçu d'une ligne attendue = Σ quantités des rattachements ACTIFS.
export function recuLigne(tx: Tx, ligneAttendueId: number): Promise<number> {
  return repo.sommeRattachementsLigne(tx, ligneAttendueId)
}

// RG-X-060 : quantité de l'affiche déjà répartie entre ses dossiers (liens actifs, comptée une fois).
export function quantiteRepartie(tx: Tx, afficheId: number): Promise<number> {
  return repo.sommeRattachementsAffiche(tx, afficheId)
}

// RG-X-060 : la somme des quantités des liens ne dépasse jamais la quantité reçue de l'affiche.
export async function assertRepartitionPossible(
  tx: Tx,
  afficheId: number,
  quantiteAjoutee: number,
): Promise<void> {
  const [stock, repartie] = await Promise.all([
    stockAffiche(tx, afficheId),
    quantiteRepartie(tx, afficheId),
  ])
  if (repartie + quantiteAjoutee > stock) {
    throw new BusinessError(
      `La répartition (${repartie + quantiteAjoutee}) dépasse la quantité reçue (${stock}).`,
      {
        code: 'REC_REPARTITION_DEPASSE',
        regle: 'RG-X-060',
        details: { stock, repartie, quantiteAjoutee },
      },
    )
  }
}

/** Sens obligatoire de la quantité par type (RG-REC-153 : rebut, destruction, expédition, renvoi < 0). */
const SENS: Record<TypeMouvement, 'positif' | 'negatif' | 'libre'> = {
  RECEPTION: 'positif',
  COMPLEMENT: 'positif',
  AJOUT_MANUEL: 'positif',
  ECART_CONTROLE: 'libre',
  FUSION: 'libre',
  MISE_AU_REBUT: 'negatif',
  SORTIE_MANUELLE: 'negatif',
  EXPEDITION: 'negatif',
  RENVOI: 'negatif',
  DESTRUCTION: 'negatif',
}

export interface MouvementInput {
  /** RG-REC-002 : droit exigé par le parcours appelant (ex. reception.valider, stock.rebut). */
  permission: PermissionCode
  afficheId: number
  type: TypeMouvement
  quantite: number
  date?: Date
  receptionId?: number
  livraisonId?: number
  motif?: string
  auto?: boolean
  comptee?: boolean
  /** RG-REC-009 : version de l'affiche vue par le client (sinon : version lue dans la transaction). */
  expectedAfficheVersion?: number
}

// RG-REC-151 : un mouvement est CRÉÉ, jamais modifié ni supprimé ; auteur tracé (RG-REC-004).
// RG-REC-154 : la colonne affiche.quantite n'est qu'un cache, recalculé dans la même transaction.
// RG-REC-001 : affiche existante (404) et dans le périmètre ; RG-REC-009 : écriture versionnée.
export async function enregistrerMouvement(tx: Tx, identity: Identity, input: MouvementInput) {
  assertDroitReception(identity, input.permission)
  return ecrireMouvement(tx, identity, input)
}

// RG-X-087 : sortie de stock AUTOMATIQUE déclenchée par un parcours d'une autre fonction (fin de journée des colis,
// RG-COO-269) : le droit est celui du parcours appelant (contrôlé par son service), pas un droit de la Réception.
// Même écriture, même sens obligatoire, même cache et même journal que `enregistrerMouvement`.
export function enregistrerMouvementAutomatique(
  tx: Tx,
  identity: Identity,
  input: Omit<MouvementInput, 'permission'>,
) {
  return ecrireMouvement(tx, identity, { ...input, auto: true })
}

async function ecrireMouvement(
  tx: Tx,
  identity: Identity,
  input: Omit<MouvementInput, 'permission'>,
) {
  const sens = SENS[input.type]
  if (!Number.isInteger(input.quantite) || input.quantite === 0) {
    throw new BusinessError('La quantité d’un mouvement doit être un entier non nul.', {
      code: 'REC_MOUVEMENT_QUANTITE',
      regle: 'RG-REC-151',
    })
  }
  if ((sens === 'positif' && input.quantite < 0) || (sens === 'negatif' && input.quantite > 0)) {
    throw new BusinessError(`Un mouvement « ${input.type} » doit être ${sens}.`, {
      code: 'REC_MOUVEMENT_SENS',
      regle: 'RG-REC-153',
    })
  }
  // RG-REC-001 : l'affiche doit exister (404) et être dans le périmètre.
  const affiche = await tx.affiche.findUnique({ where: { id: input.afficheId } })
  if (!affiche) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, affiche.plateformeId)
  // RG-REC-064 / RG-REC-151 (ANO-061, Q-417 HYPOTHÈSE PRISE) : une sortie ne rend jamais le stock négatif (le rebut est
  // plafonné au disponible, l'expédition aussi) ; l'écart de contrôle négatif suit la même règle : 422, rien n'est écrit.
  if (input.quantite < 0) {
    const disponible = await stockAffiche(tx, input.afficheId)
    if (disponible + input.quantite < 0) {
      throw new BusinessError(
        `Ce mouvement (${String(input.quantite)}) rendrait le stock négatif (disponible : ${String(disponible)}).`,
        {
          code: 'REC_STOCK_NEGATIF',
          regle: 'RG-REC-064',
          details: { afficheId: input.afficheId, disponible, quantite: input.quantite },
        },
      )
    }
  }
  const mouvement = await tx.mouvement.create({
    data: {
      afficheId: input.afficheId,
      type: input.type,
      quantite: input.quantite,
      date: input.date ?? new Date(),
      receptionId: input.receptionId ?? null,
      livraisonId: input.livraisonId ?? null,
      motif: input.motif ?? null,
      auto: input.auto ?? false,
      comptee: input.comptee ?? false,
      createdById: identity.userId,
    },
  })
  const stock = await stockAffiche(tx, input.afficheId)
  // RG-REC-154 : cache recalculé ; RG-REC-009 : écriture versionnée de l'affiche.
  await ecrireAfficheVersionnee(tx, identity, affiche, input.expectedAfficheVersion, {
    quantite: stock,
  })
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: input.afficheId,
    action: 'MOUVEMENT_STOCK',
    parId: identity.userId,
    nouvelleValeur: `${input.type} ${input.quantite > 0 ? '+' : ''}${input.quantite}`,
    donnees: { mouvementId: mouvement.id, stock },
  })
  return { mouvement, stock }
}
