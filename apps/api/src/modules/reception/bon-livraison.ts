// REC-P03 — Vérification du panier et du bon de livraison, SANS écriture. REC-P04 (« Valider la réception »)
// appelle la même fonction dans sa transaction avant de créer la réception (une seule source des contrôles).
// Ordre des refus = ordre de la maquette (reception.js:503-509).
import type { BonLivraison, VerificationBl } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.ts'
import { canAccessPlateforme } from '../../core/permissions/permissions.ts'
import type { Identity } from '../../core/identity.ts'
import type { Tx } from '../../core/transaction.ts'
import { assertDroitReception, assertPerimetreReception } from './permissions.ts'
import { agentsDeReception } from './referentiels.ts'

export async function verifierBonDeLivraison(
  client: Db | Tx,
  identity: Identity,
  bl: BonLivraison,
  maintenant: Date = new Date(),
): Promise<VerificationBl> {
  // RG-REC-002 : seuls les profils qui valident une réception (coord, recep).
  assertDroitReception(identity, 'reception.valider')

  // RG-REC-021 : panier vide.
  if (bl.lignes.length === 0) {
    throw new BusinessError('Le panier est vide.', { code: 'REC_PANIER_VIDE', regle: 'RG-REC-021' })
  }
  // RG-REC-022 : seules les lignes cochées entrent dans la réception.
  const cochees = bl.lignes.filter((l) => l.cochee)
  if (cochees.length === 0) {
    throw new BusinessError('Cochez dans le panier les lignes de ce BL.', {
      code: 'REC_AUCUNE_LIGNE_COCHEE',
      regle: 'RG-REC-022',
    })
  }
  // RG-REC-021 : une ligne n'est qu'une fois dans le PANIER (cochée ou non).
  const tousIds = bl.lignes.map((l) => l.ligneAttendueId)
  if (new Set(tousIds).size !== tousIds.length) {
    throw new BusinessError('Ce visuel est déjà au panier.', {
      code: 'REC_PANIER_DOUBLON',
      regle: 'RG-REC-021',
    })
  }
  const ids = cochees.map((l) => l.ligneAttendueId)
  // RG-REC-023 : la Qté du BL saisie est ≥ 0 sur toute ligne du panier.
  const negatives = bl.lignes.filter((l) => l.quantite < 0).map((l) => l.ligneAttendueId)
  if (negatives.length > 0) {
    throw new ValidationError('La quantité doit être supérieure ou égale à 0.', {
      code: 'REC_QTE_NEGATIVE',
      regle: 'RG-REC-023',
      details: { lignes: negatives },
    })
  }

  const lignes = await client.receptionAttendue.findMany({ where: { id: { in: ids } } })
  const absentes = ids.filter((id) => !lignes.some((l) => l.id === id))
  if (absentes.length > 0)
    throw new NotFoundError('Ligne attendue introuvable', { details: { lignes: absentes } })
  // RG-REC-014 (HYPOTHÈSE Q-177) : seule une ligne encore proposée (ACTIVE, non purgée, non exclue) se réceptionne.
  const indisponibles = lignes.filter(
    (l) => l.etatLigne !== 'ACTIVE' || l.purgeeLe !== null || l.themeExclu,
  )
  if (indisponibles.length > 0) {
    throw new BusinessError("Une ligne cochée n'est plus attendue : rechargez la page.", {
      code: 'REC_LIGNE_INDISPONIBLE',
      regle: 'RG-REC-014',
      details: { lignes: indisponibles.map((l) => l.id) },
    })
  }
  // RG-REC-001 : chaque ligne doit être dans le périmètre.
  for (const l of lignes) assertPerimetreReception(identity, l.plateformeId)

  // RG-X-019 : un BL ne livre qu'une plateforme (un dossier peut être sur deux plateformes, un BL non).
  // RG-REC-024 : un BL ne livre qu'une plateforme.
  const plateformes = [...new Set(lignes.map((l) => l.plateformeId))]
  const [plateformeId] = plateformes
  if (plateformes.length > 1 || plateformeId === undefined) {
    throw new BusinessError(
      "Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme.",
      {
        code: 'REC_BL_DEUX_PLATEFORMES',
        regle: 'RG-REC-024',
      },
    )
  }

  // RG-NEW-REC-001 : avec une photo, le circuit BL reste obligatoire.
  const sansBl = bl.sansBl === true && bl.photoBlId === null
  // RG-REC-026 : photo obligatoire sauf déclaration explicite Sans BL.
  if (bl.photoBlId === null && !sansBl) {
    throw new BusinessError(
      'Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche.',
      { code: 'REC_PHOTO_BL_MANQUANTE', regle: 'RG-REC-026' },
    )
  }
  if (bl.photoBlId !== null) await verifierPhotoJoignable(client, identity, bl.photoBlId)

  // RG-REC-033 : n° de BL, transporteur et imprimeur obligatoires.
  if (
    (!sansBl && (bl.numeroBl.trim() === '' || bl.imprimeurId === null)) ||
    bl.livreurId === null
  ) {
    throw new BusinessError(
      sansBl
        ? 'Le transporteur est obligatoire, même sans BL.'
        : 'N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé.',
      {
        code: 'REC_BL_CHAMPS_OBLIGATOIRES',
        regle: 'RG-REC-033',
        details: {
          numeroBl: bl.numeroBl.trim() === '',
          transporteur: bl.livreurId === null,
          imprimeur: bl.imprimeurId === null,
        },
      },
    )
  }

  // RG-REC-035 : listes fermées ; jamais de création à la volée (Q-115).
  const [livreur, imprimeur] = await Promise.all([
    client.livreur.findFirst({ where: { id: bl.livreurId, actif: true } }),
    bl.imprimeurId === null
      ? null
      : client.imprimeur.findFirst({ where: { id: bl.imprimeurId, actif: true } }),
  ])
  const agentInconnu =
    bl.dechargeParId !== null &&
    !(await agentsDeReception(client, [plateformeId])).some((a) => a.id === bl.dechargeParId)
  if (!livreur || (!imprimeur && (!sansBl || bl.imprimeurId !== null)) || agentInconnu) {
    throw new BusinessError(
      "Valeur absente du référentiel : l'administrateur l'ajoute dans Administration.",
      {
        code: 'REC_REFERENTIEL_INCONNU',
        regle: 'RG-REC-035',
        details: { transporteur: !livreur, imprimeur: !imprimeur, dechargePar: agentInconnu },
      },
    )
  }

  // RG-REC-023 / Q-166 : une ligne cochée à quantité 0 est ignorée (avec mention).
  const retenues = cochees.filter((l) => l.quantite > 0)
  const ignorees = cochees.filter((l) => l.quantite === 0).map((l) => l.ligneAttendueId)
  if (retenues.length === 0) {
    throw new BusinessError(
      'Toutes les lignes cochées ont une quantité nulle : indiquez la quantité du BL.',
      {
        code: 'REC_AUCUNE_QUANTITE',
        regle: 'RG-REC-023',
      },
    )
  }

  // RG-REC-036 / Q-114 : n° de BL déjà réceptionné sur la plateforme → avertissement à confirmer.
  const deja = sansBl
    ? []
    : await client.reception.findMany({
        where: { plateformeId, livraison: { reference: bl.numeroBl.trim() } },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
  const avertissements: VerificationBl['avertissements'] =
    deja.length > 0
      ? [
          {
            code: 'REC_BL_DOUBLON',
            message: `Ce n° de BL a déjà été réceptionné (réception ${deja.map((r) => r.id).join(', ')}). Continuer ?`,
            receptions: deja.map((r) => r.id),
          },
        ]
      : []

  return {
    plateformeId,
    // RG-REC-034 : date de livraison en lecture = date et heure de la validation.
    dateLivraison: maintenant.toISOString(),
    // RG-REC-032 / Q-184 (TRANCHÉE) : une réception par le panier (photo du BL obligatoire, n° de dossier
    // lu sur le BL par l'agent) est en mode BL ; MAIN reste réservé aux rattachements à la main
    // (réceptions inconnues, fiche affiche). Le mode envoyé par le client est ignoré.
    lignes: retenues.map((l) => ({
      ligneAttendueId: l.ligneAttendueId,
      quantite: l.quantite,
      mode: sansBl ? ('MAIN' as const) : ('BL' as const),
    })),
    lignesIgnorees: ignorees,
    nombreLignes: retenues.length,
    nombreAffiches: retenues.reduce((s, l) => s + l.quantite, 0),
    avertissements,
  }
}

// RG-REC-027 / RG-REC-001 : la photo doit exister, appartenir à l'utilisateur ou à son périmètre
// (même règle que la consultation), et ne pas être déjà jointe à une autre réception (HYPOTHÈSE Q-177).
// Réutilisé par la réception inconnue (RG-REC-098).
export async function verifierPhotoJoignable(
  client: Db | Tx,
  identity: Identity,
  photoId: number,
  quoi = 'du BL',
): Promise<void> {
  const photo = await client.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      createdById: true,
      receptions: { select: { plateformeId: true } },
      affiches: { select: { plateformeId: true } },
    },
  })
  if (!photo) {
    throw new ValidationError(`La photo ${quoi} est introuvable : reprenez la photo.`, {
      code: 'REC_PHOTO_INVALIDE',
      regle: 'RG-REC-027',
    })
  }
  const plateformesPhoto = [...photo.receptions, ...photo.affiches].map((x) => x.plateformeId)
  if (
    photo.createdById !== identity.userId &&
    !plateformesPhoto.some((p) => canAccessPlateforme(identity, p))
  ) {
    throw new ForbiddenError("Cette photo n'est pas dans votre périmètre.", {
      code: 'REC_PERIMETRE_INTERDIT',
      regle: 'RG-REC-001',
    })
  }
  if (photo.receptions.length > 0 || photo.affiches.length > 0) {
    throw new BusinessError(
      `Cette photo est déjà jointe à une autre réception : photographiez ${quoi === 'du BL' ? 'ce BL' : 'à nouveau'}.`,
      {
        code: 'REC_PHOTO_DEJA_JOINTE',
        regle: 'RG-REC-026',
      },
    )
  }
}
