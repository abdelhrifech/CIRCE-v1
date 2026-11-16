// COO-P04 — validation admin : confirmation unitaire et annulation (RG-COO-008 / 014), traçabilité
// (RG-COO-015) et effets de la validation (RG-COO-021 à 026), changement de la ligne après la validation
// (RG-COO-030 à 032). Option A du 02/11 : rien n'est validé sans une personne (RG-COO-028) ; la prépa n'est
// pas une condition (RG-COO-064) ; aucune UM ne lit la validation (RG-COO-027) ; réception, contrôle et validation admin sont des circuits indépendants (RG-X-028).
import type { Db } from '../../core/db.ts'
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPlateforme, hasPermission } from '../../core/permissions/permissions.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { Prisma } from '../../generated/prisma/client.ts'
import { assertAfficheNonFusionnee } from '../reception/affiche.ts'
import { assertDroitCoordination, COO } from './permissions.ts'
import { etatValidationAffiche, messageConfirmation, normaliserTheme } from './validation-admin.ts'
import { donneesAnnulation, donneesValidation } from './validation-donnees.ts'

type Client = Db | Tx

// Données de validation / annulation : validation-donnees.ts (module sans dépendance, pas de cycle).
export { donneesAnnulation, donneesValidation } from './validation-donnees.ts'

/** Écriture d'une affiche sous verrou optimiste (codes de la Coordination). */
async function ecrireAffiche(
  tx: Tx,
  identity: Identity | null,
  a: { id: number; version: number },
  expectedVersion: number,
  data: Prisma.AfficheUpdateManyMutationInput,
) {
  await assertAfficheNonFusionnee(tx, a.id)
  return updateWithVersion({
    expectedVersion,
    update: (where) =>
      tx.affiche.updateMany({
        where: { id: a.id, ...where },
        data: { ...data, updatedById: identity?.userId ?? null, ...bumpVersion },
      }),
    ...COO.version,
  })
}

/** Journal du dossier (RG-COO-160 / RG-COO-020) pour chaque dossier auquel l'affiche est rattachée. */
export async function journalDossiers(
  tx: Tx,
  identity: Identity,
  afficheId: number,
  action: 'VALIDATION_ADMIN' | 'ANNULATION_VALIDATION_ADMIN',
  texte: string,
) {
  const liens = await tx.afficheAttendue.findMany({
    where: { afficheId, actif: true },
    select: { ligneAttendue: { select: { contNum: true } } },
  })
  for (const c of new Set(liens.map((l) => l.ligneAttendue.contNum))) {
    if (c === null) continue
    await ecrireJournal(tx, {
      typeEntite: 'DOSSIER',
      entiteId: c,
      action,
      parId: identity.userId,
      nouvelleValeur: texte,
    })
  }
}

// RG-COO-008 : « Valider » une affiche (fiche dossier) ; RG-COO-014 : « Annuler la validation » ;
// RG-COO-009 : coord / admin, contrôlé ici (403 PERMISSION / RG-COO-009) ; RG-COO-167 : périmètre.
// RG-COO-064 / RG-COO-001 : aucune garde sur la prépa ni l'Instruction OK ; RG-COO-016 : aucune garde de
// quantité. RG-X-050 : l'annulation ne crée aucun mouvement et ne change pas le statut de la palette.
export async function changerValidationCoordination(
  tx: Tx,
  identity: Identity,
  afficheId: number,
  input: { version: number; valider: boolean },
) {
  assertDroitCoordination(identity, 'validation_admin.valider', 'RG-COO-009')
  const a = await tx.affiche.findUnique({ where: { id: afficheId } })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPlateforme(identity, a.plateformeId, COO.perimetre)
  const { etat, motifs } = await etatValidationAffiche(tx, afficheId)
  const maintenant = new Date()
  if (input.valider) {
    if (etat === 'RECEPTION_INCONNUE') {
      throw new ConflictError('Réception inconnue : à rattacher d’abord (Réceptions inconnues).', {
        code: 'TRANSITION_INTERDITE',
        regle: 'RG-COO-008',
      })
    }
    if (etat === 'VALIDEE') {
      throw new ConflictError('Affiche déjà validée.', {
        code: 'TRANSITION_INTERDITE',
        regle: 'RG-COO-008',
      })
    }
    const version = await ecrireAffiche(
      tx,
      identity,
      a,
      input.version,
      donneesValidation(identity, a, maintenant),
    )
    // RG-COO-015 : historique nominatif ; RG-COO-002 : le libellé dit ce qui a été vérifié (jamais « Circé »).
    const motifsVus = motifs.filter((m) => m !== 'ANNULEE')
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: afficheId,
      action: 'VALIDATION_ADMIN',
      parId: identity.userId,
      ancienneValeur: 'à confirmer',
      nouvelleValeur:
        'Validation admin confirmée' +
        (motifsVus.length
          ? ` après vérification (${motifsVus.join(', ')})`
          : ' : rattachement proposé par Circé, sans doute'),
      donnees: { motifs },
    })
    await journalDossiers(
      tx,
      identity,
      afficheId,
      'VALIDATION_ADMIN',
      `affiche ${String(afficheId)} confirmée`,
    )
    return { afficheId, version, message: messageConfirmation(1) }
  }
  // RG-COO-014 : seule une affiche VALIDEE se décoche (409 sinon), sans condition de dossier ni de prépa.
  if (!a.validationAdmin) {
    throw new ConflictError('Affiche non validée : rien à annuler.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-014',
    })
  }
  const version = await ecrireAffiche(tx, identity, a, input.version, donneesAnnulation('ANNULEE'))
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: afficheId,
    action: 'ANNULATION_VALIDATION_ADMIN',
    parId: identity.userId,
    ancienneValeur: 'validée',
    nouvelleValeur: `validation annulée par ${identity.nom ?? identity.identifiantExterne}`,
  })
  await journalDossiers(
    tx,
    identity,
    afficheId,
    'ANNULATION_VALIDATION_ADMIN',
    `affiche ${String(afficheId)} : validation annulée`,
  )
  return {
    afficheId,
    version,
    message:
      'Validation annulée : l’affiche repasse « À confirmer : doute » (validation à refaire).',
  }
}

// RG-COO-021 : le n° d'affiche n'apparaît au suivi de production que validée ET liée à une ligne de source
// PREPA (sinon masqué).
export function numeroVisibleSuiviProd(a: {
  validee: boolean
  sources: ('BC' | 'PREPA')[]
}): boolean {
  return a.validee && a.sources.includes('PREPA')
}

// RG-COO-024 (HYPOTHÈSE Q-231) : « reçue et associée » = au moins un lien actif ET validée admin. L'envoi
// relève du traitement de retour vers Broadcast (RG-COO-134, Q-005) : valeur calculée, jamais stockée.
export function estAssociee(a: { liensActifs: number; validee: boolean }): boolean {
  return a.liensActifs > 0 && a.validee
}

// RG-COO-025 : « à traiter » côté Réception = non rebutée, non fusionnée, ET (non validée OU sans ligne).
export function aTraiter(a: {
  rebus: boolean
  fusionnee: boolean
  validee: boolean
  liensActifs: number
}): boolean {
  return !a.rebus && !a.fusionnee && (!a.validee || a.liensActifs === 0)
}

// RG-COO-026 : état des réservations — « • » (proposée, à confirmer) dès la réception, « ✓ » une fois validée.
export function marqueEtatReservations(validee: boolean): '•' | '✓' {
  return validee ? '✓' : '•'
}

// RG-COO-030 / 031 / 032 (HYPOTHÈSE Q-210) : effets d'une ligne attendue modifiée (Broadcast ou IP) sur les
// affiches rattachées et VALIDÉES. Thème changé → validation à refaire (motif THEME, historique, feuille de
// stock à refaire, RG-X-057) ; quantité changée → alerte seule (RG-COO-031, la validation reste) ; ligne
// annulée → alerte, lien et validation conservés (RG-COO-032, RG-COO-088). À appeler dans la transaction qui
// modifie la ligne. Renvoie les alertes levées (calculées).
export async function effetsLigneModifiee(
  tx: Tx,
  avant: { id: number; theme: string | null; qte: number | null; etatLigne: 'ACTIVE' | 'ANNULEE' },
  apres: { theme: string | null; qte: number | null; etatLigne: 'ACTIVE' | 'ANNULEE' },
) {
  const liens = await tx.afficheAttendue.findMany({
    where: { ligneAttendueId: avant.id, actif: true },
    include: { affiche: true },
  })
  const validees = liens.map((l) => l.affiche).filter((a) => a.validationAdmin)
  const alertes: {
    type: 'THEME_MODIFIE' | 'ECART_QUANTITE' | 'LIGNE_ANNULEE'
    afficheId: number
    regle: string
  }[] = []
  // RG-COO-030 : comparaison sans casse, accents ni espaces multiples (normaliserTheme, comme le motif THEME).
  const themeChange = normaliserTheme(avant.theme) !== normaliserTheme(apres.theme)
  // RG-COO-032 (ANO-029) : la ligne annulée alerte pour TOUTE affiche ayant un lien actif (validée ou non).
  if (avant.etatLigne === 'ACTIVE' && apres.etatLigne === 'ANNULEE')
    for (const l of liens)
      alertes.push({ type: 'LIGNE_ANNULEE', afficheId: l.afficheId, regle: 'RG-COO-032' })
  for (const a of validees) {
    if (themeChange) {
      await ecrireAffiche(tx, null, a, a.version, {
        ...donneesAnnulation('THEME'),
        feuilleARefaire: true,
      })
      await ecrireJournal(tx, {
        typeEntite: 'AFFICHE',
        entiteId: a.id,
        action: 'ANNULATION_VALIDATION_ADMIN',
        parId: null,
        ancienneValeur: 'validée',
        nouvelleValeur: `validation à refaire (thème modifié : ${avant.theme ?? '—'} → ${apres.theme ?? '—'})`,
        complement: 'Circé (automatique)',
      })
      alertes.push({ type: 'THEME_MODIFIE', afficheId: a.id, regle: 'RG-COO-030' })
      continue
    }
    if ((avant.qte ?? null) !== (apres.qte ?? null))
      alertes.push({ type: 'ECART_QUANTITE', afficheId: a.id, regle: 'RG-COO-031' })
  }
  // RG-COO-031 (ANO-037) : l'écart de quantité après la validation est JOURNALISÉ (même interface que les
  // alertes de l'alimentation) pour être affiché dans Pilotage › Alertes, y compris sur une ligne sans prépa.
  const ecarts = alertes.filter((x) => x.type === 'ECART_QUANTITE')
  if (ecarts.length > 0) {
    const ligne = await tx.receptionAttendue.findUniqueOrThrow({
      where: { id: avant.id },
      select: { contNum: true, plateformeId: true, theme: true },
    })
    for (const x of ecarts)
      await ecrireJournal(tx, {
        typeEntite: 'LIGNE_ATTENDUE',
        entiteId: avant.id,
        action: 'ALERTE_ALIMENTATION',
        parId: null,
        nouvelleValeur: 'Quantité modifiée après la validation.',
        complement: 'ECART_QUANTITE (RG-COO-031)',
        donnees: {
          type: 'ECART_QUANTITE',
          regle: 'RG-COO-031',
          message: `Dossier ${String(ligne.contNum ?? '—')} (« ${ligne.theme ?? '—'} ») : quantité Broadcast modifiée après la validation de l’affiche ${String(x.afficheId)} (${String(avant.qte ?? 0)} → ${String(apres.qte ?? 0)}). La validation reste.`,
          contNum: ligne.contNum,
          plateformeId: ligne.plateformeId,
          ligneAttendueId: avant.id,
          afficheId: x.afficheId,
        },
      })
  }
  return alertes
}

// RG-COO-032 : affiches rattachées à une ligne ANNULEE d'un dossier (à re-rattacher), lues par la fiche.
export async function affichesSurLignesAnnulees(
  client: Client,
  contNum: number,
  plateformes: number[] | null,
) {
  const liens = await client.afficheAttendue.findMany({
    where: {
      actif: true,
      ligneAttendue: {
        contNum,
        etatLigne: 'ANNULEE',
        ...(plateformes ? { plateformeId: { in: plateformes } } : {}),
      },
    },
    select: { afficheId: true, ligneAttendue: { select: { theme: true } } },
    orderBy: { id: 'asc' },
  })
  return liens.map((l) => ({ afficheId: l.afficheId, theme: l.ligneAttendue.theme }))
}

// RG-COO-023 : étiquettes rack à imprimer, groupées par plateforme (pas d'impression en rafale, Q-162) ;
// levées par l'impression de l'étiquette (RG-REC-085, `enregistrerImpression`).
// Lecture : la Coordination (qui valide) et l'agent de la plateforme qui imprime (reception.imprimer), dans
// leur périmètre ; seule la plateforme imprime (bouton « Imprimer » réservé à reception.imprimer).
export async function listerEtiquettesRack(db: Db, identity: Identity) {
  if (
    !hasPermission(identity, 'reception.imprimer') &&
    !hasPermission(identity, 'validation_admin.valider')
  ) {
    throw new ForbiddenError("Vous n'avez pas le droit d'effectuer cette action.", {
      code: 'PERMISSION',
      regle: 'RG-COO-023',
    })
  }
  const affiches = await db.affiche.findMany({
    where: {
      etiquetteRackAImprimer: true,
      ...(identity.perimetre.toutesPlateformes
        ? {}
        : { plateformeId: { in: identity.perimetre.plateformeIds } }),
    },
    include: { plateforme: { select: { id: true, nom: true } } },
    orderBy: [{ plateformeId: 'asc' }, { id: 'asc' }],
  })
  const groupes = new Map<
    number,
    { plateformeId: number; plateforme: string; afficheIds: number[] }
  >()
  for (const a of affiches) {
    const g = groupes.get(a.plateformeId) ?? {
      plateformeId: a.plateformeId,
      plateforme: a.plateforme.nom,
      afficheIds: [],
    }
    g.afficheIds.push(a.id)
    groupes.set(a.plateformeId, g)
  }
  return { groupes: [...groupes.values()] }
}

export interface AlerteValidation {
  type: 'THEME_MODIFIE' | 'ECART_QUANTITE' | 'LIGNE_ANNULEE'
  regle: 'RG-COO-030' | 'RG-COO-031' | 'RG-COO-032'
  afficheId: number
  ligneAttendueId: number
  dossier: number | null
  plateformeId: number
}

/**
 * Interface lue par les Alertes Pré-Prod (COO-P07) : alertes des RG-COO-030 à 032, CALCULÉES à la lecture à
 * partir de l'état persisté (pas de table d'alertes, comme les alertes Réception, Q-220) :
 * - THEME_MODIFIE (RG-COO-030) : affiche au drapeau `theme_modifie` (posé par effetsLigneModifiee), jusqu'à
 *   la reconfirmation ;
 * - ECART_QUANTITE (RG-COO-031) : affiche validée rattachée à une ligne ACTIVE dont la quantité prépa
 *   diffère de la quantité Broadcast (écart Broadcast / Circé, RG-COO-055) ;
 * - LIGNE_ANNULEE (RG-COO-032) : lien actif vers une ligne ANNULEE (affiche à re-rattacher), validée ou non.
 * `plateformes` = périmètre (null = tous les sites).
 */
export async function alertesValidation(
  client: Client,
  plateformes: number[] | null,
): Promise<AlerteValidation[]> {
  const liens = await client.afficheAttendue.findMany({
    where: {
      actif: true,
      ...(plateformes ? { ligneAttendue: { plateformeId: { in: plateformes } } } : {}),
      OR: [
        { affiche: { themeModifie: true } },
        { ligneAttendue: { etatLigne: 'ANNULEE' } },
        { affiche: { validationAdmin: true }, ligneAttendue: { qtePrepa: { not: null } } },
      ],
    },
    include: {
      affiche: { select: { themeModifie: true, validationAdmin: true } },
      ligneAttendue: true,
    },
    orderBy: { id: 'asc' },
  })
  const alertes: AlerteValidation[] = []
  for (const l of liens) {
    const base = {
      afficheId: l.afficheId,
      ligneAttendueId: l.ligneAttendueId,
      dossier: l.ligneAttendue.contNum,
      plateformeId: l.ligneAttendue.plateformeId,
    }
    if (l.ligneAttendue.etatLigne === 'ANNULEE')
      alertes.push({ type: 'LIGNE_ANNULEE', regle: 'RG-COO-032', ...base })
    else if (l.affiche.themeModifie)
      alertes.push({ type: 'THEME_MODIFIE', regle: 'RG-COO-030', ...base })
    else if (
      l.affiche.validationAdmin &&
      l.ligneAttendue.qtePrepa !== null &&
      l.ligneAttendue.qtePrepa !== l.ligneAttendue.qteBc
    )
      alertes.push({ type: 'ECART_QUANTITE', regle: 'RG-COO-031', ...base })
  }
  return alertes
}
