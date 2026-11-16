// REC-P07 — Réceptions inconnues (ECR-REC-08 création, ECR-REC-04 liste / identification / signalement).
import { declarerConstatReception } from '../nonconformite/service.ts'
import {
  formatSemaineIso,
  STATUTS_INCONNUE,
  type CreerInconnue,
  type StatutInconnue,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { hasPermission } from '../../core/permissions/permissions.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ecrireAfficheVersionnee } from './affiche.ts'
import { correspond, jetonsRecherche, plateformesVisibles } from './attendues.ts'
import { verifierPhotoJoignable } from './bon-livraison.ts'
import { attenduDe, resteDe } from './lignes.ts'
import { lireParametreNombre } from './parametres.ts'
import { assertDroitReception, assertPerimetreReception, REC } from './permissions.ts'
import { rattacher } from './rattachement.ts'
import { changerStatutReception } from './service.ts'
import { enregistrerMouvement, recuLigne, stockAffiche } from './stock.ts'
import { donneesValidation, journalDossiers } from '../coordination/effets-validation.ts'
import {
  messageUnitesPretes,
  statutsTrainsDesDossiers,
  unitesDevenuesPretes,
} from '../coordination/unites-pretes.ts'

/** RG-REC-144 / Q-120 : conservation par défaut (legacy : 20). */
const CONSERVATION_DEFAUT = 20

/** RG-REC-102 : filtre par défaut = tous les statuts sauf « Rattachée, feuille définitive ». */
export const FILTRE_INCONNUES_DEFAUT: StatutInconnue[] = STATUTS_INCONNUE.filter(
  (s) => s !== 'RATTACHEE_FEUILLE_DEFINITIVE',
)

// RG-REC-115 : orpheline = aucun rattachement actif (liensActifs = 0).
// §3.1 RECEPTION_INCONNUE.* : statut CALCULÉ (RG-REC-176) à partir de la réception et de l'affiche.
export function statutInconnueDe(x: {
  liensActifs: number
  signaleLe: Date | null
  statutReception: 'A_IDENTIFIER' | 'A_CONTROLER' | 'CONTROLEE'
  typeFeuille: 'TEMPORAIRE' | 'DEFINITIVE' | null
  feuilleARefaire: boolean
}): StatutInconnue {
  if (x.liensActifs === 0) return x.signaleLe ? 'INTROUVABLE' : 'A_IDENTIFIER'
  if (x.statutReception !== 'CONTROLEE') return 'RATTACHEE_A_CONTROLER'
  return x.typeFeuille === 'DEFINITIVE' && !x.feuilleARefaire
    ? 'RATTACHEE_FEUILLE_DEFINITIVE'
    : 'CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER'
}

// RG-REC-095 à RG-REC-099 : création d'une réception inconnue, atomique (RG-REC-117 : rien n'est écrit
// si un contrôle échoue). Contrôles dans l'ordre du formulaire : quantité → allée/rayon → photo du BL.
export async function creerReceptionInconnue(tx: Tx, identity: Identity, input: CreerInconnue) {
  assertDroitReception(identity, 'reception.inconnue.creer')
  assertPerimetreReception(identity, input.plateformeId)
  // RG-REC-096 : quantité comptée > 0.
  if (input.quantite <= 0) {
    throw new BusinessError('Indiquez la quantité comptée.', {
      code: 'REC_QTE_INCONNUE_OBLIGATOIRE',
      regle: 'RG-REC-096',
    })
  }
  // RG-REC-097 : allée tampon et rayon obligatoires (imprimés sur la feuille temporaire).
  if (input.allee === '' || input.rayon === '') {
    throw new BusinessError(
      'Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire.',
      { code: 'REC_ALLEE_RAYON_INCONNUE_OBLIGATOIRES', regle: 'RG-REC-097' },
    )
  }
  // RG-REC-098 : photo du BL dans tous les cas, sauf palette arrivée sans BL.
  if (!input.sansBl && input.photoBlId === null) {
    throw new BusinessError(
      'Photographiez le BL (ou indiquez que la palette est arrivée sans BL).',
      { code: 'REC_PHOTO_BL_MANQUANTE', regle: 'RG-REC-098' },
    )
  }
  if (!input.sansBl && input.photoBlId !== null) {
    await verifierPhotoJoignable(tx, identity, input.photoBlId)
  }
  if (input.photoAfficheId !== null) {
    if (input.photoAfficheId === input.photoBlId) {
      throw new ValidationError('La photo de l’affiche doit être distincte de celle du BL.', {
        code: 'REC_PHOTO_INVALIDE',
        regle: 'RG-REC-098',
      })
    }
    await verifierPhotoJoignable(tx, identity, input.photoAfficheId, 'de l’affiche')
  }
  const support = await tx.categorieSupport.findUnique({ where: { id: input.supportId } })
  if (!support) {
    throw new BusinessError('Format inconnu.', {
      code: 'REC_REFERENTIEL_INCONNU',
      regle: 'RG-REC-095',
    })
  }
  if (input.imprimeurId !== null) {
    const imp = await tx.imprimeur.findUnique({ where: { id: input.imprimeurId } })
    if (!imp?.actif) {
      throw new BusinessError('Imprimeur inconnu ou désactivé.', {
        code: 'REC_REFERENTIEL_INCONNU',
        regle: 'RG-REC-035',
      })
    }
  }

  const maintenant = new Date()
  const livraison = await tx.livraison.create({
    data: {
      dateLivraison: maintenant,
      // RG-REC-098 : n° de BL « — » pour une palette arrivée sans BL.
      reference: input.sansBl ? 'Sans BL' : input.numeroBl || null,
      imprimeurId: input.imprimeurId,
      createdById: identity.userId,
    },
  })
  // RG-REC-099 : réception À identifier, HORS du sas (RG-REC-071).
  const reception = await tx.reception.create({
    data: {
      plateformeId: input.plateformeId,
      livraisonId: livraison.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
      dateArrivee: maintenant,
      photoBlId: input.sansBl ? null : input.photoBlId,
      createdById: identity.userId,
    },
  })
  if (!input.sansBl && input.photoBlId !== null) {
    await tx.livraisonPhoto.create({
      data: { livraisonId: livraison.id, photoId: input.photoBlId, intitule: 'Photo du BL' },
    })
  }
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'RECEPTION',
    entiteId: reception.id,
    ancien: null,
    nouveau: 'A_IDENTIFIER',
    parId: identity.userId,
    regle: 'RG-REC-099',
  })
  const allee = input.allee.toUpperCase()
  // RG-REC-099 : affiche ORPHELINE, feuille TEMPORAIRE (tags Réception inconnue / À contrôler calculés).
  const affiche = await tx.affiche.create({
    data: {
      plateformeId: input.plateformeId,
      supportId: input.supportId,
      receptionId: reception.id,
      photoId: input.photoAfficheId,
      imprimeurId: input.imprimeurId,
      statut: 'ORPHELINE',
      dateEntree: maintenant,
      contAnnonc: input.annonceur || null,
      theme: input.theme || null,
      conservation: CONSERVATION_DEFAUT,
      quantite: 0,
      allee,
      rayon: input.rayon,
      typeFeuille: 'TEMPORAIRE',
      createdById: identity.userId,
    },
  })
  await tx.livraisonAffiche.create({
    data: { livraisonId: livraison.id, afficheId: affiche.id, numeroLivraison: 1 },
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'AFFICHE',
    entiteId: affiche.id,
    ancien: null,
    nouveau: 'ORPHELINE',
    parId: identity.userId,
    regle: 'RG-REC-099',
  })
  // RG-REC-099 : mouvement « Réception » de la quantité comptée.
  await enregistrerMouvement(tx, identity, {
    permission: 'reception.inconnue.creer',
    afficheId: affiche.id,
    type: 'RECEPTION',
    quantite: input.quantite,
    date: maintenant,
    receptionId: reception.id,
    livraisonId: livraison.id,
  })
  await ecrireJournal(tx, {
    typeEntite: 'RECEPTION',
    entiteId: reception.id,
    action: 'CREATION_RECEPTION_INCONNUE',
    parId: identity.userId,
    nouvelleValeur: `affiche ${String(affiche.id)} · ${String(input.quantite)} ex. · ${allee}-${input.rayon}`,
  })
  if (input.nonConformite)
    await declarerConstatReception(tx, identity, reception.id, [affiche.id], input.nonConformite)
  return {
    receptionId: reception.id,
    afficheId: affiche.id,
    message: `Réception inconnue R${String(reception.id)} : affiche ${String(affiche.id)} rangée en ${allee}-${input.rayon}. La Coordination est prévenue (Pilotage › Alertes).`,
  }
}

// RG-REC-101 / RG-REC-102 / RG-REC-103 : tableau des réceptions inconnues du périmètre.
export async function listerInconnues(
  db: Db,
  identity: Identity,
  statuts: StatutInconnue[] | undefined,
  maintenant = new Date(),
) {
  assertDroitReception(identity, 'reception.inconnue.consulter')
  const plateformes = plateformesVisibles(identity)
  const filtre = statuts && statuts.length > 0 ? statuts : FILTRE_INCONNUES_DEFAUT
  const delai = await lireParametreNombre(db, 'reception.delaiControle')
  // RG-REC-101 / RG-REC-114 : affiches d'une réception inconnue, et toute affiche redevenue orpheline
  // (dernier dossier retiré) même issue d'une réception normale (HYPOTHÈSE Q-180).
  const affiches = await db.affiche.findMany({
    where: {
      ...(plateformes === 'toutes' ? {} : { plateformeId: { in: plateformes } }),
      receptionId: { not: null },
      OR: [{ statut: 'ORPHELINE' }, { reception: { estInconnue: true } }],
    },
    include: {
      support: { select: { nom: true } },
      imprimeur: { select: { libelle: true } },
      rattachements: {
        where: { actif: true },
        include: { ligneAttendue: { select: { contNum: true } } },
      },
      reception: { include: { plateforme: { select: { id: true, nom: true } } } },
    },
    orderBy: [{ dateEntree: 'desc' }, { id: 'desc' }],
  })
  const items = []
  for (const a of affiches) {
    const r = a.reception
    if (!r) continue
    {
      const statut = statutInconnueDe({
        liensActifs: a.rattachements.length,
        signaleLe: r.signaleLe,
        statutReception: r.statut,
        typeFeuille: a.typeFeuille,
        feuilleARefaire: a.feuilleARefaire,
      })
      if (!filtre.includes(statut)) continue
      // RG-REC-103 : « En attente depuis » = durée depuis la création, « — » une fois rattachée.
      const attente =
        a.rattachements.length === 0
          ? Math.floor((maintenant.getTime() - r.dateArrivee.getTime()) / 60_000)
          : null
      items.push({
        afficheId: a.id,
        version: a.version,
        receptionId: r.id,
        receptionVersion: r.version,
        annonceur: a.contAnnonc,
        description: a.theme,
        site: r.plateforme,
        quantite: await stockAffiche(db, a.id),
        recueLe: r.dateArrivee.toISOString(),
        enAttenteMinutes: attente,
        enRetard: attente !== null && attente > delai * 60,
        statut,
        signaleLe: r.signaleLe?.toISOString() ?? null,
        dossiers: [
          ...new Set(
            a.rattachements
              .map((l) => l.ligneAttendue.contNum)
              .filter((x): x is number => x !== null),
          ),
        ],
        emplacement: `${a.allee ?? '—'}-${a.rayon ?? '—'}`,
        format: a.support.nom,
        imprimeur: a.imprimeur?.libelle ?? null,
        feuille: a.typeFeuille,
        photoId: a.photoId,
      })
    }
  }
  return { items, filtreStatut: filtre }
}

// RG-REC-105 : recherche de dossiers candidats (n° de dossier, DA, annonceur, thème ; ≥ 2 caractères ;
// 8 résultats) sur le site de l'affiche, parmi les lignes actives non purgées.
export async function chercherCandidats(
  db: Db,
  identity: Identity,
  afficheId: number,
  q: string,
  options: { tri?: 'depart' | 'reste'; max?: number } = {},
) {
  assertDroitReception(identity, 'reception.inconnue.rattacher')
  const affiche = await db.affiche.findUnique({ where: { id: afficheId } })
  if (!affiche) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, affiche.plateformeId)
  if (q.trim().length < 2) {
    throw new ValidationError('Tapez un n° de dossier, de DA, un annonceur ou un thème.', {
      code: 'REC_RECHERCHE_TROP_COURTE',
      regle: 'RG-REC-105',
    })
  }
  // RG-REC-105 : 8 résultats au plus par défaut.
  const max = Math.min(Math.max(options.max ?? 8, 1), 20)
  const jetons = jetonsRecherche(q)
  const lignes = await db.receptionAttendue.findMany({
    where: { plateformeId: affiche.plateformeId, etatLigne: 'ACTIVE', purgeeLe: null },
    orderBy: [{ semAnnee: 'desc' }, { semNum: 'desc' }, { contNum: 'asc' }],
  })
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const candidats = []
  for (const l of lignes) {
    const ok = jetons.every(
      (j) =>
        correspond({ dossier: l.contNum, da: l.idDaChapeau, annonceur: l.annonceur }, j) ||
        (l.theme !== null && norm(l.theme).includes(norm(j))),
    )
    if (!ok) continue
    const attendu = attenduDe(l)
    const recu = await recuLigne(db, l.id)
    // RG-COO-088 : les PROPOSITIONS du rattachement manuel (tri par reste, RG-REC-136) ne contiennent que les
    // lignes non entièrement couvertes ; la recherche saisie (RG-REC-105) les montre toutes.
    if (options.tri === 'reste' && resteDe(attendu, recu) === 0) continue
    candidats.push({
      ligneAttendueId: l.id,
      dossier: l.contNum,
      da: l.idDaChapeau,
      annonceur: l.annonceur,
      theme: l.theme,
      format: l.format,
      depart: formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }),
      attendu,
      reste: resteDe(attendu, recu),
    })
    if (options.tri !== 'reste' && candidats.length === max) break
  }
  // RG-REC-136 : propositions du rattachement manuel triées par reste décroissant (6 au plus).
  if (options.tri === 'reste') candidats.sort((x, y) => y.reste - x.reste)
  return { candidats: candidats.slice(0, max) }
}

// RG-REC-107 à RG-REC-111, RG-REC-118, RG-REC-120 : « Rattacher » une réception inconnue.
// RG-X-030 : plusieurs dossiers pour une inconnue → motif MULTI (doute), même par la Coordination.
export async function rattacherInconnue(
  tx: Tx,
  identity: Identity,
  afficheId: number,
  input: { version: number; lignes: { ligneAttendueId: number; quantite: number }[] },
) {
  // RG-REC-118 : coord, admin, recep (catalogue) — 403 sinon.
  assertDroitReception(identity, 'reception.inconnue.rattacher')
  const affiche = await tx.affiche.findUnique({
    where: { id: afficheId },
    include: { reception: true },
  })
  if (!affiche) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, affiche.plateformeId)
  // RG-REC-107 : seulement une affiche ORPHELINE (réception à identifier, introuvable, ou affiche
  // redevenue orpheline d'une palette dont d'autres affiches restent rattachées, Q-180) → 409 sinon.
  if (affiche.statut !== 'ORPHELINE' || affiche.reception === null) {
    throw new ConflictError('Cette affiche n’est pas une réception inconnue à identifier.', {
      code: 'REC_RATTACHER_NON_ORPHELINE',
      regle: 'RG-REC-107',
    })
  }
  if (affiche.version !== input.version) {
    throw new ConflictError('Cette affiche a été modifiée entre-temps : rechargez.', REC.version)
  }
  // RG-REC-107 : au moins un dossier ET des quantités > 0.
  const ids = input.lignes.map((l) => l.ligneAttendueId)
  if (
    input.lignes.length === 0 ||
    input.lignes.some((l) => l.quantite <= 0) ||
    new Set(ids).size !== ids.length
  ) {
    throw new BusinessError('Choisissez au moins un dossier et une quantité.', {
      code: 'REC_RATTACHER_SANS_DOSSIER',
      regle: 'RG-REC-107',
    })
  }
  // RG-REC-108 : somme répartie ≤ quantité reçue (une répartition inférieure est permise, Q-124).
  const recue = await stockAffiche(tx, afficheId)
  const total = input.lignes.reduce((s, l) => s + l.quantite, 0)
  if (total > recue) {
    throw new BusinessError(
      `La répartition (${String(total)}) dépasse la quantité reçue (${String(recue)}).`,
      {
        code: 'REC_REPARTITION_DEPASSE',
        regle: 'RG-REC-108',
      },
    )
  }
  // RG-X-003 : état des unités (trains) des dossiers visés AVANT le rattachement.
  const dossiersCibles = (
    await tx.receptionAttendue.findMany({ where: { id: { in: ids } }, select: { contNum: true } })
  ).map((l) => l.contNum)
  const unitesAvant = await statutsTrainsDesDossiers(tx, dossiersCibles)
  // RG-REC-109 : rattachement(s) mode MAIN, affiche IDENTIFIEE, tag « Feuille à refaire ».
  let premiere: { annonceur: string | null; theme: string | null } | null = null
  for (const l of input.lignes) {
    await rattacher(tx, identity, {
      permission: 'reception.inconnue.rattacher',
      afficheId,
      ligneAttendueId: l.ligneAttendueId,
      quantite: l.quantite,
      mode: 'MAIN',
      feuilleARefaire: true,
    })
    if (!premiere) {
      const ligne = await tx.receptionAttendue.findUniqueOrThrow({
        where: { id: l.ligneAttendueId },
      })
      premiere = { annonceur: ligne.annonceur, theme: ligne.theme }
    }
  }
  const apres = await tx.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  // RG-REC-110 : annonceur du dossier ; libellé remplacé seulement si les IP sont saisies (thème connu).
  // RG-REC-111 / RG-REC-120 : par coord/admin → validation admin faite ; sinon « à confirmer ».
  const valide = hasPermission(identity, 'validation_admin.valider')
  const maintenant = new Date()
  await ecrireAfficheVersionnee(tx, identity, apres, undefined, {
    ...(premiere?.annonceur ? { contAnnonc: premiere.annonceur } : {}),
    ...(premiere?.theme ? { theme: premiere.theme } : {}),
    // RG-COO-017 / RG-X-051 : par coord / admin, le rattachement vaut validation (mode MAIN, RG-COO-018) dans
    // la même transaction ; étiquette rack à imprimer (RG-COO-023). Autre rôle : reste à confirmer (motif BL).
    ...(valide ? donneesValidation(identity, apres, maintenant) : {}),
  })
  if (premiere?.annonceur && premiere.annonceur !== affiche.contAnnonc) {
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: afficheId,
      action: 'MODIFICATION_ANNONCEUR',
      parId: identity.userId,
      ancienneValeur: affiche.contAnnonc,
      nouvelleValeur: premiere.annonceur,
    })
  }
  if (premiere?.theme && premiere.theme !== affiche.theme) {
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: afficheId,
      action: 'MODIFICATION_THEME',
      parId: identity.userId,
      ancienneValeur: affiche.theme,
      nouvelleValeur: premiere.theme,
    })
  }
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: afficheId,
    action: valide ? 'VALIDATION_ADMIN' : 'RATTACHEMENT_AFFICHE',
    parId: identity.userId,
    nouvelleValeur: valide
      ? 'validée au rattachement (Coordination)'
      : 'à confirmer — motif : rattachée sans le n° du BL (rattachée par la réception : reste à vérifier)',
  })
  // RG-X-051 / RG-COO-020 (ANO-032) : une validation au rattachement est aussi tracée au dossier.
  if (valide)
    await journalDossiers(
      tx,
      identity,
      afficheId,
      'VALIDATION_ADMIN',
      `affiche ${String(afficheId)} confirmée au rattachement (réception inconnue)`,
    )
  // RG-REC-109 : la réception passe À contrôler et entre dans le sas.
  const reception = affiche.reception
  if (reception.statut === 'A_IDENTIFIER') {
    await changerStatutReception(tx, identity, {
      id: reception.id,
      vers: 'A_CONTROLER',
      expectedVersion: reception.version,
      regle: 'RG-REC-109',
      permission: 'reception.inconnue.rattacher',
      data: { aControlerDepuis: maintenant },
    })
  }
  // RG-X-003 : « n unité(s) prête(s) à produire » (EN_ATTENTE → PRET), recalcul dans la même transaction.
  const unitesPretes = unitesDevenuesPretes(
    unitesAvant,
    await statutsTrainsDesDossiers(tx, dossiersCibles),
  )
  return {
    afficheId,
    receptionId: reception.id,
    validee: valide,
    unitesPretes,
    // ECR-REC-04 (maquette) + RG-X-003.
    message: `Affiche ${String(afficheId)} rattachée.${reception.statut === 'A_IDENTIFIER' ? ` La palette R${String(reception.id)} passe dans le sas de Réception des affiches : la réception valide le contrôle et imprime la feuille définitive.` : ''}${valide ? '' : ' Rattachée par la réception : la Coordination confirmera la validation admin.'}${messageUnitesPretes(unitesPretes)}`,
  }
}

// RG-REC-112 : « Signaler à la Coordination » — seulement à l'état À identifier (§3.2), une fois.
// RG-X-008 : « Dossier introuvable » → alerte Coordination du site (RG-COO-072) ; un signalement répété est refusé (409).
export async function signalerIntrouvable(
  tx: Tx,
  identity: Identity,
  afficheId: number,
  receptionVersion: number,
) {
  assertDroitReception(identity, 'reception.inconnue.signaler')
  const affiche = await tx.affiche.findUnique({
    where: { id: afficheId },
    include: { reception: true, rattachements: { where: { actif: true }, select: { id: true } } },
  })
  if (!affiche) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, affiche.plateformeId)
  const r = affiche.reception
  if (
    !r ||
    r.statut !== 'A_IDENTIFIER' ||
    r.signaleLe !== null ||
    affiche.rattachements.length > 0
  ) {
    throw new ConflictError('Seule une réception inconnue « À identifier » peut être signalée.', {
      code: 'REC_SIGNALEMENT_INTERDIT',
      regle: 'RG-REC-112',
    })
  }
  const maintenant = new Date()
  await updateWithVersion({
    expectedVersion: receptionVersion,
    update: (where) =>
      tx.reception.updateMany({
        where: { id: r.id, ...where },
        data: { signaleLe: maintenant, updatedById: identity.userId, ...bumpVersion },
      }),
    ...REC.version,
  })
  await ecrireJournal(tx, {
    typeEntite: 'RECEPTION',
    entiteId: r.id,
    action: 'SIGNALEMENT_INTROUVABLE',
    parId: identity.userId,
    nouvelleValeur: `affiche ${String(afficheId)}`,
  })
  return {
    afficheId,
    receptionId: r.id,
    message:
      'Alerte « Dossier introuvable » mise pour la Coordination du site. Une fois l’affiche rattachée, la palette passe à l’étape 2 (contrôle).',
  }
}

// RG-REC-100 : dès 3 caractères d'annonceur, intitulés déjà saisis par l'AUTRE plateforme (lib, site, n°).
export async function suggestionsIntitules(
  db: Db,
  identity: Identity,
  plateformeId: number,
  annonceur: string,
) {
  assertDroitReception(identity, 'reception.inconnue.creer')
  assertPerimetreReception(identity, plateformeId)
  if (annonceur.trim().length < 3) return { suggestions: [] }
  const affiches = await db.affiche.findMany({
    where: {
      plateformeId: { not: plateformeId },
      theme: { not: null },
      contAnnonc: { contains: annonceur.trim() },
    },
    include: { plateforme: { select: { nom: true } } },
    orderBy: { id: 'desc' },
    take: 50,
  })
  const vus = new Set<string>()
  const suggestions = []
  for (const a of affiches) {
    if (!a.theme || vus.has(a.theme)) continue
    vus.add(a.theme)
    suggestions.push({ intitule: a.theme, site: a.plateforme.nom, afficheId: a.id })
    if (suggestions.length === 5) break
  }
  return { suggestions }
}
