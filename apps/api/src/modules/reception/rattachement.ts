// Lien affiche ↔ ligne attendue (Q-306 : plusieurs-à-plusieurs avec quantité, RG-REC-049, RG-COO-088).
// Fonctions appelées DANS la transaction d'un service public (REC-P04, P07, P08). Le droit est vérifié
// ICI (RG-REC-002) : le parcours appelant indique la permission qu'il exige.
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ecrireAfficheVersionnee } from './affiche.ts'
import { recalculerLigne } from './lignes.ts'
import type { PermissionCode } from '@circe/shared'
import { lundiSemaineIso } from '@circe/shared'
import { Prisma, type ModeRattachement } from '../../generated/prisma/client.ts'
import { affichesDeReception } from './controle.ts'
import { changerStatutReception } from './service.ts'
import { assertDroitReception, assertPerimetreReception, REC } from './permissions.ts'
import { TRANSITIONS_AFFICHE, TRANSITIONS_RATTACHEMENT } from './statuts.ts'
import { assertRepartitionPossible } from './stock.ts'

export interface RattacherInput {
  /** RG-REC-002 : droit exigé par le parcours appelant (réception, inconnues, fiche affiche). */
  permission: PermissionCode
  afficheId: number
  ligneAttendueId: number
  quantite: number
  mode: ModeRattachement
  /** RG-REC-009 : version de l'affiche vue par le client (sinon : version lue dans la transaction). */
  expectedAfficheVersion?: number
  /** RG-REC-129 : rattachement changé après identification → « Feuille à refaire » (le parcours décide). */
  feuilleARefaire?: boolean
}

// RG-REC-143 : date de dernier départ = vendredi de la semaine de départ la plus tardive des liens actifs
// (année comprise, corrige le legacy qui prenait semaine et année max séparément) ; null sans lien.
export async function dateDernierDepart(tx: Tx, afficheId: number): Promise<Date | null> {
  const liens = await tx.afficheAttendue.findMany({
    where: { afficheId, actif: true },
    select: { ligneAttendue: { select: { semAnnee: true, semNum: true } } },
  })
  if (liens.length === 0) return null
  const max = liens
    .map((l) => ({ annee: l.ligneAttendue.semAnnee, semaine: l.ligneAttendue.semNum }))
    .sort((a, b) => b.annee - a.annee || b.semaine - a.semaine)[0]
  if (!max) return null
  const lundi = lundiSemaineIso(max)
  return new Date(lundi.getTime() + 4 * 86_400_000)
}

/** RG de la transition de statut d'affiche (§3.2) : rattacher → IDENTIFIEE, dernier lien retiré → ORPHELINE. */
const REGLE_STATUT_AFFICHE = { IDENTIFIEE: 'RG-REC-109', ORPHELINE: 'RG-REC-114' } as const

// RG-REC-042 : le lien est CRÉÉ avec sa quantité ; il n'efface jamais un lien existant (doublon actif → 409).
// RG-REC-049 : une affiche peut servir plusieurs dossiers, avec une quantité par dossier (≥ 1).
// RG-REC-001 : l'affiche ET la ligne attendue doivent être dans le périmètre de l'utilisateur.
// RG-X-060 / RG-X-016 : la somme des liens ne dépasse pas la quantité reçue (reçu compté une fois) ;
// l'écriture versionnée de l'affiche empêche deux rattachements concurrents de dépasser ensemble.
// RG-REC-176 : le statut IDENTIFIEE est posé par Circé (jamais coché à la main).
// RG-REC-007 : historisé avec l'action AFFICHE_ASSOCIER, entité = l'affiche.
// RG-X-085 : rattachement manuel du surplus à un autre dossier (PARTIEL : Q-280).
export async function rattacher(tx: Tx, identity: Identity, input: RattacherInput) {
  assertDroitReception(identity, input.permission)
  if (!Number.isInteger(input.quantite) || input.quantite < 1) {
    throw new BusinessError('La quantité rattachée à un dossier doit être au moins 1.', {
      code: 'REC_RATTACHEMENT_QUANTITE',
      regle: 'RG-REC-049',
    })
  }
  const affiche = await tx.affiche.findUnique({ where: { id: input.afficheId } })
  if (!affiche) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, affiche.plateformeId)
  const ligne = await tx.receptionAttendue.findUnique({ where: { id: input.ligneAttendueId } })
  if (!ligne) throw new NotFoundError('Ligne attendue introuvable')
  assertPerimetreReception(identity, ligne.plateformeId)
  // RG-COO-088 (ANO-033) : un NOUVEAU lien exige une ligne ACTIVE, quel que soit le chemin (réception,
  // inconnue, fiche affiche) ; une ligne fermée ne reçoit plus de rattachement.
  if (ligne.etatLigne !== 'ACTIVE') {
    throw new BusinessError('Cette ligne attendue est annulée : choisissez une ligne active.', {
      code: 'REC_LIGNE_CIBLE_ANNULEE',
      regle: 'RG-COO-088',
    })
  }
  // RG-REC-024 : une affiche et sa ligne attendue sont toujours sur la même plateforme
  // (une affiche destinée à l'autre plateforme se transfère puis se réceptionne, EX-COO-045).
  if (affiche.plateformeId !== ligne.plateformeId) {
    throw new BusinessError(
      'Cette affiche et cette ligne attendue ne sont pas sur la même plateforme.',
      {
        code: 'REC_RATTACHEMENT_AUTRE_PLATEFORME',
        regle: 'RG-REC-024',
      },
    )
  }
  await assertRepartitionPossible(tx, affiche.id, input.quantite)

  let lien
  try {
    lien = await tx.afficheAttendue.create({
      data: {
        afficheId: affiche.id,
        ligneAttendueId: ligne.id,
        quantite: input.quantite,
        mode: input.mode,
        creePar: identity.userId,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Cette affiche est déjà rattachée à cette ligne.', {
        code: 'REC_RATTACHEMENT_EXISTANT',
        regle: 'RG-COO-088',
      })
    }
    throw error
  }

  const devientIdentifiee = affiche.statut === 'ORPHELINE'
  if (devientIdentifiee) {
    assertTransition(TRANSITIONS_AFFICHE, affiche.statut, 'IDENTIFIEE', {
      regle: REGLE_STATUT_AFFICHE.IDENTIFIEE,
    })
  }
  // RG-COO-018 : mode du rattachement porté par l'affiche ; RG-REC-143 : dernier départ recalculé.
  await ecrireAfficheVersionnee(tx, identity, affiche, input.expectedAfficheVersion, {
    ...(devientIdentifiee ? { statut: 'IDENTIFIEE' } : {}),
    modeRattachement: input.mode,
    dateDernierDepart: await dateDernierDepart(tx, affiche.id),
    ...(input.feuilleARefaire ? { feuilleARefaire: true } : {}),
  })
  if (devientIdentifiee) {
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'AFFICHE',
      entiteId: affiche.id,
      ancien: affiche.statut,
      nouveau: 'IDENTIFIEE',
      parId: identity.userId,
      regle: REGLE_STATUT_AFFICHE.IDENTIFIEE,
    })
  }
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: affiche.id,
    action: 'AFFICHE_ASSOCIER',
    parId: identity.userId,
    nouvelleValeur: `ligne ${ligne.id} (dossier ${ligne.contNum ?? '—'}) : ${input.quantite}`,
    // RG-X-001 / RG-COO-004 : un lien posé à la réception par le n° du BL est une PROPOSITION de Circé.
    ...(input.mode === 'BL'
      ? {
          complement:
            'Rattachement proposé par Circé (automatique), à confirmer par la Coordination',
        }
      : {}),
    donnees: { lienId: lien.id, mode: input.mode },
  })
  // RG-REC-017 / RG-REC-018 : reçu et statut de la ligne recalculés dans la même transaction.
  await recalculerLigne(tx, identity, ligne.id)
  return lien
}

// RG-REC-137 / RG-COO-088 : retirer = ACTIF → RETIRE (par, le) ; un lien retiré n'est jamais réactivé.
// RG-REC-114 : retrait du dernier lien actif → l'affiche redevient ORPHELINE.
// RG-REC-007 : action AFFICHE_DISSOCIER propre, entité = l'affiche (anomalie legacy non reprise).
export async function retirerRattachement(
  tx: Tx,
  identity: Identity,
  input: { lienId: number; expectedVersion: number; permission: PermissionCode },
) {
  assertDroitReception(identity, input.permission)
  const { lienId, expectedVersion } = input
  const lien = await tx.afficheAttendue.findUnique({
    where: { id: lienId },
    include: { affiche: true },
  })
  if (!lien) throw new NotFoundError('Rattachement introuvable')
  assertPerimetreReception(identity, lien.affiche.plateformeId)
  assertTransition(TRANSITIONS_RATTACHEMENT, lien.actif ? 'ACTIF' : 'RETIRE', 'RETIRE', {
    regle: 'RG-REC-137',
  })
  await updateWithVersion({
    expectedVersion,
    update: (where) =>
      tx.afficheAttendue.updateMany({
        where: { id: lienId, actif: true, ...where },
        data: { actif: false, retirePar: identity.userId, retireLe: new Date(), ...bumpVersion },
      }),
    ...REC.version,
  })
  const restants = await tx.afficheAttendue.count({
    where: { afficheId: lien.afficheId, actif: true },
  })
  const devientOrpheline = restants === 0 && lien.affiche.statut === 'IDENTIFIEE'
  if (devientOrpheline) {
    assertTransition(TRANSITIONS_AFFICHE, lien.affiche.statut, 'ORPHELINE', {
      regle: REGLE_STATUT_AFFICHE.ORPHELINE,
    })
  }
  // RG-REC-009 : la répartition de l'affiche change → écriture versionnée de l'affiche.
  // RG-REC-129 : rattachement changé → « Feuille à refaire » ; RG-REC-143 : dernier départ recalculé.
  // RG-X-058 : dernier lien retiré → la validation admin est caduque (effacée, historisée).
  const validationCaduque = devientOrpheline && lien.affiche.validationAdmin
  await ecrireAfficheVersionnee(tx, identity, lien.affiche, undefined, {
    ...(devientOrpheline ? { statut: 'ORPHELINE' } : {}),
    ...(validationCaduque
      ? {
          validationAdmin: false,
          validationAdminParId: null,
          validationAdminLe: null,
          validationAnnulee: false,
        }
      : {}),
    feuilleARefaire: true,
    dateDernierDepart: await dateDernierDepart(tx, lien.afficheId),
  })
  if (validationCaduque) {
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: lien.afficheId,
      action: 'ANNULATION_VALIDATION_ADMIN',
      parId: identity.userId,
      ancienneValeur: 'validée',
      nouvelleValeur: 'caduque (dernier dossier retiré)',
    })
  }
  // RG-REC-114 / RG-X-013 (HYPOTHÈSE Q-108) : la réception d'origine redevient À identifier quand plus
  // aucune de ses affiches n'a de dossier. HYPOTHÈSE Q-180 : si d'autres affiches de la palette restent
  // rattachées, la réception garde son statut (elles restent contrôlables) ; l'affiche orpheline
  // apparaît dans les réceptions inconnues (RG-REC-101).
  if (devientOrpheline && lien.affiche.receptionId !== null) {
    const reception = await tx.reception.findUnique({ where: { id: lien.affiche.receptionId } })
    const autres = (await affichesDeReception(tx, lien.affiche.receptionId)).filter(
      (id) => id !== lien.afficheId,
    )
    const autresRattachees = await tx.afficheAttendue.count({
      where: { afficheId: { in: autres }, actif: true },
    })
    if (reception && reception.statut !== 'A_IDENTIFIER' && autresRattachees === 0) {
      await changerStatutReception(tx, identity, {
        id: reception.id,
        vers: 'A_IDENTIFIER',
        expectedVersion: reception.version,
        regle: 'RG-REC-114',
        permission: input.permission,
      })
    }
  }
  if (devientOrpheline) {
    await ecrireHistoriqueStatut(tx, {
      typeEntite: 'AFFICHE',
      entiteId: lien.afficheId,
      ancien: 'IDENTIFIEE',
      nouveau: 'ORPHELINE',
      parId: identity.userId,
      regle: REGLE_STATUT_AFFICHE.ORPHELINE,
    })
  }
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: lien.afficheId,
    action: 'AFFICHE_DISSOCIER',
    parId: identity.userId,
    ancienneValeur: `ligne ${lien.ligneAttendueId} : ${lien.quantite}`,
    donnees: { lienId },
  })
  // RG-REC-017 / RG-REC-018 : le reçu de la ligne baisse ; statut recalculé dans la même transaction.
  await recalculerLigne(tx, identity, lien.ligneAttendueId)
}
