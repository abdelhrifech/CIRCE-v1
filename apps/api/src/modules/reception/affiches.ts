import { verifierPhotoJoignable } from './bon-livraison.ts'
// REC-P08 — Liste des affiches (ECR-REC-03) et fiche de l'affiche (ECR-REC-05).
import { formatSemaineIso, type FicheAffiche, type ListeAffichesQuery } from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { hasPermission } from '../../core/permissions/permissions.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { Prisma } from '../../generated/prisma/client.ts'
import { assertAfficheNonFusionnee, ecrireAfficheVersionnee } from './affiche.ts'
import { plateformesVisibles } from './attendues.ts'
import { recalculerLigne } from './lignes.ts'
import { assertDroitReception, assertPerimetreReception, REC } from './permissions.ts'
import { dateDernierDepart, rattacher, retirerRattachement } from './rattachement.ts'
import { changerStatutReception } from './service.ts'
import { TRANSITIONS_RATTACHEMENT } from './statuts.ts'
import { stockAffiche } from './stock.ts'
import { etatValidationAffiche, messageConfirmation } from '../coordination/validation-admin.ts'
import {
  aTraiter,
  donneesAnnulation,
  donneesValidation,
  journalDossiers,
} from '../coordination/effets-validation.ts'

type Client = Db | Tx
const asTx = (c: Client) => c as unknown as Tx

const INCLUDE_LISTE = {
  plateforme: { select: { id: true, nom: true } },
  support: { select: { nom: true } },
  imprimeur: { select: { libelle: true } },
  reception: { select: { id: true, statut: true, estInconnue: true, controleurNom: true } },
  livraisons: {
    select: {
      livraison: {
        select: { reception: { select: { id: true, statut: true, controleurNom: true } } },
      },
    },
  },
  rattachements: { where: { actif: true }, include: { ligneAttendue: true } },
} satisfies Prisma.AfficheInclude

type AfficheListee = Prisma.AfficheGetPayload<{ include: typeof INCLUDE_LISTE }>

/** Réceptions d'une affiche : celle d'origine et celles des compléments (RG-REC-040). */
function receptionsDe(a: AfficheListee) {
  const m = new Map<number, { id: number; statut: string; controleurNom: string | null }>()
  if (a.reception) m.set(a.reception.id, a.reception)
  for (const l of a.livraisons)
    if (l.livraison.reception) m.set(l.livraison.reception.id, l.livraison.reception)
  return [...m.values()]
}

// RG-REC-127 / RG-REC-176 : tags CALCULÉS, jamais cochés.
// RG-REC-128 : Complément = reçue en ≥ 2 réceptions ; RG-REC-129 : Feuille à refaire = tag posé, ou
// feuille temporaire sur une affiche rattachée (« Feuille définitive à imprimer »).
export function tagsDe(a: AfficheListee) {
  const receptions = receptionsDe(a)
  const tags: (
    'A_CONTROLER' | 'RECEPTION_INCONNUE' | 'COMPLEMENT' | 'FEUILLE_A_REFAIRE' | 'FEUILLE_A_IMPRIMER'
  )[] = []
  if (receptions.some((r) => r.statut !== 'CONTROLEE')) tags.push('A_CONTROLER')
  if (a.reception?.estInconnue) tags.push('RECEPTION_INCONNUE')
  if (Math.max(receptions.length, a.livraisons.length) >= 2) tags.push('COMPLEMENT')
  if (a.feuilleARefaire || (a.typeFeuille === 'TEMPORAIRE' && a.rattachements.length > 0))
    tags.push('FEUILLE_A_REFAIRE')
  // RG-NEW-REC-003 : contrôle enregistré sans impression.
  if (
    receptions.length > 0 &&
    receptions.every((r) => r.statut === 'CONTROLEE') &&
    a.typeFeuille === null
  )
    tags.push('FEUILLE_A_IMPRIMER')
  return tags
}

async function ligneListe(client: Client, a: AfficheListee) {
  const semaines = [
    ...new Set(
      a.rattachements.map((r) =>
        formatSemaineIso({ annee: r.ligneAttendue.semAnnee, semaine: r.ligneAttendue.semNum }),
      ),
    ),
  ].sort()
  const rebut = await client.mouvement.aggregate({
    where: { afficheId: a.id, type: 'MISE_AU_REBUT' },
    _sum: { quantite: true },
  })
  const receptions = receptionsDe(a)
  return {
    id: a.id,
    version: a.version,
    zonePicking: a.zonePicking,
    fusionneeHeritee: a.estFusionne,
    validation: (await etatValidationAffiche(client, a.id)).etat,
    recueLe: a.dateEntree.toISOString(),
    annonceur: a.contAnnonc,
    theme: a.theme,
    dossiers: [
      ...new Set(
        a.rattachements.map((r) => r.ligneAttendue.contNum).filter((x): x is number => x !== null),
      ),
    ],
    departs: semaines,
    multiSemaines: semaines.length >= 2,
    // RG-REC-126 / RG-REC-153 : en stock = Σ mouvements ; rebut mis en évidence.
    enStock: await stockAffiche(asTx(client), a.id),
    rebut: -(rebut._sum.quantite ?? 0),
    emplacement: `${a.allee ?? '—'}-${a.rayon ?? '—'}`,
    statut: a.statut,
    tags: tagsDe(a),
    receptionId: a.receptionId,
    site: a.plateforme,
    format: a.support.nom,
    imprimeur: a.imprimeur?.libelle ?? null,
    recu: a.rattachements.reduce((s, r) => s + r.quantite, 0),
    controleur: receptions.find((r) => r.controleurNom)?.controleurNom ?? null,
    feuille: a.typeFeuille,
    // RG-COO-025 : sort de la liste « à traiter » une fois validée (et rattachée) ; y revient à l'annulation.
    aTraiter: aTraiter({
      rebus: a.rebus,
      fusionnee: a.estFusionne,
      validee: a.validationAdmin,
      liensActifs: a.rattachements.length,
    }),
  }
}

// RG-REC-121 / RG-REC-122 / RG-REC-125 : une ligne par affiche, filtres, tri date décroissante.
export async function listerAffiches(db: Db, identity: Identity, q: ListeAffichesQuery) {
  assertDroitReception(identity, 'affiche.consulter')
  const plateformes = plateformesVisibles(identity)
  const where: Prisma.AfficheWhereInput = {
    ...(plateformes === 'toutes' ? {} : { plateformeId: { in: plateformes } }),
    ...(q.picking ? { zonePicking: q.picking === 'oui' } : {}),
    ...(q.supportId ? { supportId: q.supportId } : {}),
    ...(q.imprimeurId ? { imprimeurId: q.imprimeurId } : {}),
    ...(q.dossier
      ? { rattachements: { some: { actif: true, ligneAttendue: { contNum: q.dossier } } } }
      : {}),
    ...(q.tag === 'ORPHELINE' ? { statut: 'ORPHELINE' } : {}),
  }
  const toutes = await db.affiche.findMany({
    where,
    include: INCLUDE_LISTE,
    orderBy: [{ dateEntree: 'desc' }, { id: 'desc' }],
  })
  // Le filtre utilise le même calcul que la confirmation, jamais une copie simplifiée.
  const validations = new Map<number, string>()
  if (q.validation)
    for (const a of toutes) validations.set(a.id, (await etatValidationAffiche(db, a.id)).etat)
  const filtrees = toutes.filter((a) => {
    if (q.validation && validations.get(a.id) !== q.validation) return false
    if (q.depart) {
      const semaines = a.rattachements.map((r) =>
        formatSemaineIso({ annee: r.ligneAttendue.semAnnee, semaine: r.ligneAttendue.semNum }),
      )
      // RG-REC-122 : une affiche sans semaine reste visible.
      if (semaines.length > 0 && !semaines.includes(q.depart)) return false
    }
    if (q.tag && q.tag !== 'ORPHELINE' && !tagsDe(a).includes(q.tag)) return false
    // RG-COO-025 : filtre « à traiter ».
    if (
      q.aTraiter === 'oui' &&
      !aTraiter({
        rebus: a.rebus,
        fusionnee: a.estFusionne,
        validee: a.validationAdmin,
        liensActifs: a.rattachements.length,
      })
    )
      return false
    return true
  })
  const page = filtrees.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
  const items = []
  for (const a of page) items.push(await ligneListe(db, a))
  return { items, total: filtrees.length, page: q.page, pageSize: q.pageSize }
}

async function nomsUtilisateurs(db: Client, ids: (number | null)[]) {
  const uniques = [...new Set(ids.filter((x): x is number => x !== null))]
  const users = await parPaquets(uniques, (paquet) =>
    db.utilisateur.findMany({
      where: { id: { in: paquet } },
      select: { id: true, nom: true, identifiantExterne: true },
    }),
  )
  return new Map(users.map((u) => [u.id, u.nom ?? u.identifiantExterne]))
}

// RG-REC-130 / RG-REC-132 / RG-REC-134 : fiche (détail, mouvements, préparations, historique).
// RG-REC-142 : une lecture n'écrit JAMAIS.
export async function lireFicheAffiche(
  db: Db,
  identity: Identity,
  id: number,
): Promise<FicheAffiche> {
  assertDroitReception(identity, 'affiche.consulter')
  const a = await db.affiche.findUnique({ where: { id }, include: INCLUDE_LISTE })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, a.plateformeId)
  const base = await ligneListe(db, a)
  const mouvements = await db.mouvement.findMany({
    where: { afficheId: id },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  })
  const journal = await db.journalAudit.findMany({
    where: { typeEntite: 'AFFICHE', entiteId: String(id) },
    orderBy: [{ le: 'desc' }, { id: 'desc' }],
  })
  const liens = await db.afficheAttendue.findMany({
    where: { afficheId: id, actif: true },
    include: { ligneAttendue: true },
    orderBy: { id: 'asc' },
  })
  const fusion = await db.fusionAffiche.findFirst({
    where: { afficheId: id, NOT: { afficheChapeauId: id } },
  })
  const noms = await nomsUtilisateurs(db, [
    ...mouvements.map((m) => m.createdById),
    ...journal.map((j) => j.parId),
    a.validationAdminParId,
  ])
  const receptions = receptionsDe(a)
  const recues = await db.reception.findMany({
    where: { id: { in: receptions.map((r) => r.id) } },
    orderBy: { dateArrivee: 'asc' },
  })
  return {
    ...base,
    version: a.version,
    supportId: a.supportId,
    photoId: a.photoId,
    repiquage: a.repiquage,
    zonePicking: a.zonePicking,
    dossierSaisi: a.contNum,
    commentaire: a.commentaire,
    allee: a.allee,
    rayon: a.rayon,
    aConserver: a.aConserver,
    conservation: a.conservation > 0 ? a.conservation : 20,
    dateDernierDepart: a.dateDernierDepart?.toISOString() ?? null,
    // RG-REC-144 : alerte « dernier départ dépassé » si date_dernier_depart > date_entree + 7 × conservation.
    dernierDepartDepasse:
      a.dateDernierDepart !== null &&
      a.dateDernierDepart.getTime() >
        a.dateEntree.getTime() + 7 * (a.conservation > 0 ? a.conservation : 20) * 86_400_000,
    surplusEntretien: a.surplusEntretien,
    imprimeurId: a.imprimeurId,
    validation: {
      validee: a.validationAdmin,
      par: a.validationAdminParId !== null ? (noms.get(a.validationAdminParId) ?? null) : null,
      le: a.validationAdminLe?.toISOString() ?? null,
      mode: a.modeRattachement,
      // RG-COO-007 / RG-COO-006 : état calculé et motifs (même calcul que la Coordination).
      ...(await etatValidationAffiche(db, id)),
    },
    fusionneeHeritee: fusion !== null,
    receptions: recues.map((r) => ({
      id: r.id,
      statut: r.statut,
      arrivee: r.dateArrivee.toISOString(),
    })),
    mouvements: mouvements.map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      type: m.type,
      motif: m.motif,
      quantite: m.quantite,
      par: m.createdById !== null ? (noms.get(m.createdById) ?? null) : null,
      auto: m.auto,
      receptionId: m.receptionId,
    })),
    preparations: liens.map((l) => ({
      lienId: l.id,
      lienVersion: l.version,
      ligneAttendueId: l.ligneAttendueId,
      dossier: l.ligneAttendue.contNum,
      annonceur: l.ligneAttendue.annonceur,
      theme: l.ligneAttendue.theme,
      depart: formatSemaineIso({
        annee: l.ligneAttendue.semAnnee,
        semaine: l.ligneAttendue.semNum,
      }),
      quantite: l.quantite,
      mode: l.mode,
    })),
    historique: journal.map((j) => ({
      le: j.le.toISOString(),
      action: j.action,
      ancien: j.ancienneValeur,
      // RG-X-001 : « Rattachement proposé par Circé (automatique)… » porté en complément du journal.
      nouveau: j.complement ? `${j.nouvelleValeur ?? '—'} — ${j.complement}` : j.nouvelleValeur,
      par: j.parId !== null ? (noms.get(j.parId) ?? null) : j.complement ? 'Circé' : null,
    })),
  }
}

// RG-REC-131 : champs modifiables (annonceur, thème saisis, imprimeur, allée, rayon, à conserver,
// commentaire) ; chaque changement historisé (RG-REC-006). Q-143 : ne pose pas « Feuille à refaire ».
export async function modifierAffiche(
  tx: Tx,
  identity: Identity,
  id: number,
  input: {
    version: number
    photoId?: number | null
    repiquage?: string
    conservation?: number
    zonePicking?: boolean
    annonceur?: string
    theme?: string
    imprimeurId?: number | null
    allee?: string
    rayon?: string
    aConserver?: boolean
    commentaire?: string
  },
) {
  assertDroitReception(identity, 'affiche.modifier')
  const a = await tx.affiche.findUnique({ where: { id } })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, a.plateformeId)
  // RG-REC-145 : « Affiche à conserver » a son propre droit.
  if (input.aConserver !== undefined && input.aConserver !== a.aConserver) {
    assertDroitReception(identity, 'affiche.conserver')
  }
  if (input.imprimeurId != null && input.imprimeurId !== a.imprimeurId) {
    const imp = await tx.imprimeur.findUnique({ where: { id: input.imprimeurId } })
    if (!imp?.actif) {
      throw new BusinessError('Imprimeur inconnu ou désactivé.', {
        code: 'REC_REFERENTIEL_INCONNU',
        regle: 'RG-REC-179',
      })
    }
  }
  if (input.photoId != null && input.photoId !== a.photoId)
    await verifierPhotoJoignable(tx, identity, input.photoId, 'de l’affiche')
  const vide = (s: string | undefined, actuel: string | null) =>
    s === undefined ? actuel : s === '' ? null : s
  const allee =
    input.allee === undefined ? a.allee : input.allee === '' ? null : input.allee.toUpperCase()
  const rayon = vide(input.rayon, a.rayon)
  const data = {
    photoId: input.photoId === undefined ? a.photoId : input.photoId,
    repiquage: vide(input.repiquage, a.repiquage),
    conservation: input.conservation ?? a.conservation,
    zonePicking: input.zonePicking ?? a.zonePicking,
    contAnnonc: vide(input.annonceur, a.contAnnonc),
    theme: vide(input.theme, a.theme),
    imprimeurId: input.imprimeurId === undefined ? a.imprimeurId : input.imprimeurId,
    allee,
    rayon,
    aConserver: input.aConserver ?? a.aConserver,
    commentaire: vide(input.commentaire, a.commentaire),
  }
  await ecrireAfficheVersionnee(tx, identity, a, input.version, data)
  const changements: {
    action: Prisma.JournalAuditCreateInput['action']
    ancien: string | null
    nouveau: string | null
  }[] = []
  if (data.contAnnonc !== a.contAnnonc)
    changements.push({
      action: 'MODIFICATION_ANNONCEUR',
      ancien: a.contAnnonc,
      nouveau: data.contAnnonc,
    })
  if (data.theme !== a.theme)
    changements.push({ action: 'MODIFICATION_THEME', ancien: a.theme, nouveau: data.theme })
  if (data.imprimeurId !== a.imprimeurId)
    changements.push({
      action: 'MODIFICATION_IMPRIMEUR',
      ancien: a.imprimeurId === null ? null : String(a.imprimeurId),
      nouveau: data.imprimeurId === null ? null : String(data.imprimeurId),
    })
  if (allee !== a.allee || rayon !== a.rayon)
    changements.push({
      action: 'MODIFICATION_EMPLACEMENT',
      ancien: `${a.allee ?? '—'}-${a.rayon ?? '—'}`,
      nouveau: `${allee ?? '—'}-${rayon ?? '—'}`,
    })
  if (data.aConserver !== a.aConserver)
    changements.push({
      action: 'MODIFICATION_A_CONSERVER',
      ancien: String(a.aConserver),
      nouveau: String(data.aConserver),
    })
  if (data.commentaire !== a.commentaire)
    changements.push({
      action: 'MODIFICATION_COMMENTAIRE',
      ancien: a.commentaire,
      nouveau: data.commentaire,
    })
  for (const cle of ['photoId', 'repiquage', 'conservation', 'zonePicking'] as const) {
    if (data[cle] !== a[cle])
      changements.push({
        action: 'MODIFICATION_PARAMETRE',
        ancien: JSON.stringify({ [cle]: a[cle] }),
        nouveau: JSON.stringify({ [cle]: data[cle] }),
      })
  }
  for (const c of changements) {
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: id,
      action: c.action,
      parId: identity.userId,
      ancienneValeur: c.ancien,
      nouvelleValeur: c.nouveau,
    })
  }
  return { afficheId: id, message: 'Fiche affiche modifiée.' }
}

// RG-REC-111 / RG-REC-135 / RG-X-007 : un rattachement manuel vaut validation par coord/admin ; par un
// autre rôle, la validation repasse « à confirmer ».
// RG-X-063 : rattachement par l'agent de réception = jamais validé (« à confirmer », motif BL) ; par la Coordination = validé.
async function appliquerValidationSelonRole(tx: Tx, identity: Identity, afficheId: number) {
  const a = await tx.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  const valide = hasPermission(identity, 'validation_admin.valider')
  // Déjà dans l'état voulu : par / le d'origine conservés (RG-COO-015).
  if (valide === a.validationAdmin) return
  await ecrireAfficheVersionnee(
    tx,
    identity,
    a,
    undefined,
    // RG-X-014 / RG-X-052 / RG-COO-017 : coord / admin → validation (étiquette rack, RG-COO-023) ; autre rôle →
    // « à confirmer » (motif BL par le mode MAIN, RG-COO-018).
    valide
      ? donneesValidation(identity, a, new Date())
      : { validationAdmin: false, validationAdminParId: null, validationAdminLe: null },
  )
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: afficheId,
    action: valide ? 'VALIDATION_ADMIN' : 'ANNULATION_VALIDATION_ADMIN',
    parId: identity.userId,
    nouvelleValeur: valide
      ? 'validée (rattachement par la Coordination)'
      : 'à confirmer (rattachement par la réception)',
  })
}

// RG-REC-136 / RG-REC-138 : « + Rattacher à un autre dossier » (quantité ≥ 1, pose « Feuille à refaire »).
// Une affiche orpheline devient IDENTIFIEE et sa palette À contrôler (RG-REC-136).
export async function rattacherAutreDossier(
  tx: Tx,
  identity: Identity,
  id: number,
  input: { version: number; ligneAttendueId: number; quantite: number },
) {
  assertDroitReception(identity, 'affiche.rattachement.modifier')
  if (input.quantite < 1) {
    throw new BusinessError('Indiquez la quantité pour ce dossier.', {
      code: 'REC_QTE_DOSSIER_OBLIGATOIRE',
      regle: 'RG-REC-136',
    })
  }
  const a = await tx.affiche.findUnique({ where: { id }, include: { reception: true } })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, a.plateformeId)
  // RG-X-052 (ANO-030) : la ligne cible doit être ACTIVE (une ligne annulée ne reçoit plus de rattachement).
  const cible = await tx.receptionAttendue.findUnique({ where: { id: input.ligneAttendueId } })
  if (cible && cible.etatLigne !== 'ACTIVE') {
    throw new BusinessError('Cette ligne attendue est annulée : choisissez une ligne active.', {
      code: 'REC_LIGNE_CIBLE_ANNULEE',
      regle: 'RG-X-052',
    })
  }
  await rattacher(tx, identity, {
    permission: 'affiche.rattachement.modifier',
    afficheId: id,
    ligneAttendueId: input.ligneAttendueId,
    quantite: input.quantite,
    mode: 'MAIN',
    expectedAfficheVersion: input.version,
    feuilleARefaire: true,
  })
  await appliquerValidationSelonRole(tx, identity, id)
  if (a.reception?.statut === 'A_IDENTIFIER') {
    await changerStatutReception(tx, identity, {
      id: a.reception.id,
      vers: 'A_CONTROLER',
      expectedVersion: a.reception.version,
      regle: 'RG-REC-136',
      permission: 'affiche.rattachement.modifier',
      data: { aControlerDepuis: new Date() },
    })
  }
  const ligne = await tx.receptionAttendue.findUniqueOrThrow({
    where: { id: input.ligneAttendueId },
  })
  return {
    afficheId: id,
    // ECR-REC-05 (maquette) : suffixe selon le rôle (RG-X-014 / RG-COO-017).
    message: `Affiche ${String(id)} rattachée au dossier ${String(ligne.contNum ?? '—')} : feuille de stock à refaire (tag « Feuille à refaire ») ; ${hasPermission(identity, 'validation_admin.valider') ? 'validation admin faite.' : 'la Coordination confirmera la validation admin.'}`,
  }
}

// RG-REC-135 / RG-X-012 : « Changer de thème… » vers un autre thème du MÊME dossier ; « Feuille à refaire » ;
// validation selon le rôle (RG-REC-111). RG-REC-150 (HYPOTHÈSE Q-178) : l'ancienne ligne, si plus
// aucune affiche ne lui est rattachée, est retirée des réceptions attendues (ANNULEE), sans alerte.
export async function changerTheme(
  tx: Tx,
  identity: Identity,
  id: number,
  input: { version: number; lienId: number; nouvelleLigneId: number },
) {
  assertDroitReception(identity, 'affiche.rattachement.modifier')
  const a = await tx.affiche.findUnique({ where: { id } })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, a.plateformeId)
  if (a.version !== input.version)
    throw new ConflictError('Cette affiche a été modifiée entre-temps : rechargez.', REC.version)
  const lien = await tx.afficheAttendue.findUnique({
    where: { id: input.lienId },
    include: { ligneAttendue: true },
  })
  if (lien?.afficheId !== id) throw new NotFoundError('Rattachement introuvable')
  assertTransition(TRANSITIONS_RATTACHEMENT, lien.actif ? 'ACTIF' : 'RETIRE', 'RETIRE', {
    regle: 'RG-REC-137',
  })
  const ancienne = lien.ligneAttendue
  const nouvelle = await tx.receptionAttendue.findUnique({ where: { id: input.nouvelleLigneId } })
  if (!nouvelle) throw new NotFoundError('Ligne attendue introuvable')
  if (
    nouvelle.id === ancienne.id ||
    nouvelle.contNum === null ||
    nouvelle.contNum !== ancienne.contNum ||
    nouvelle.plateformeId !== ancienne.plateformeId ||
    nouvelle.etatLigne !== 'ACTIVE'
  ) {
    throw new BusinessError('Choisissez un autre thème du même dossier.', {
      code: 'REC_THEME_AUTRE_DOSSIER',
      regle: 'RG-REC-135',
    })
  }
  // Ancien lien retiré (jamais supprimé, RG-REC-137) SANS repasser l'affiche orpheline : le nouveau
  // lien est créé dans la même transaction.
  await updateWithVersion({
    expectedVersion: lien.version,
    update: (where) =>
      tx.afficheAttendue.updateMany({
        where: { id: lien.id, actif: true, ...where },
        data: { actif: false, retirePar: identity.userId, retireLe: new Date(), ...bumpVersion },
      }),
    ...REC.version,
  })
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: id,
    action: 'AFFICHE_DISSOCIER',
    parId: identity.userId,
    ancienneValeur: `ligne ${String(ancienne.id)} : ${String(lien.quantite)}`,
    donnees: { lienId: lien.id, motif: 'changement de thème' },
  })
  await rattacher(tx, identity, {
    permission: 'affiche.rattachement.modifier',
    afficheId: id,
    ligneAttendueId: nouvelle.id,
    quantite: lien.quantite,
    mode: 'MAIN',
    feuilleARefaire: true,
  })
  await recalculerLigne(tx, identity, ancienne.id)
  const courante = await tx.affiche.findUniqueOrThrow({ where: { id } })
  await ecrireAfficheVersionnee(tx, identity, courante, undefined, {
    theme: nouvelle.theme,
    dateDernierDepart: await dateDernierDepart(tx, id),
  })
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: id,
    action: 'MODIFICATION_THEME',
    parId: identity.userId,
    ancienneValeur: ancienne.theme,
    nouvelleValeur: nouvelle.theme,
  })
  const restants = await tx.afficheAttendue.count({
    where: { ligneAttendueId: ancienne.id, actif: true },
  })
  if (restants === 0 && ancienne.etatLigne === 'ACTIVE') {
    // Version relue : le recalcul de la ligne (RG-REC-018) vient de l'incrémenter.
    const courante = await tx.receptionAttendue.findUniqueOrThrow({ where: { id: ancienne.id } })
    await updateWithVersion({
      expectedVersion: courante.version,
      update: (where) =>
        tx.receptionAttendue.updateMany({
          where: { id: ancienne.id, ...where },
          data: { etatLigne: 'ANNULEE', updatedById: identity.userId, ...bumpVersion },
        }),
      ...REC.version,
    })
  }
  await appliquerValidationSelonRole(tx, identity, id)
  return { afficheId: id, message: 'Thème corrigé : feuille de stock à refaire.' }
}

// RG-REC-137 : « Retirer » un rattachement (RG-REC-114 si c'était le dernier).
export async function retirerLien(tx: Tx, identity: Identity, lienId: number, lienVersion: number) {
  await retirerRattachement(tx, identity, {
    lienId,
    expectedVersion: lienVersion,
    permission: 'affiche.rattachement.modifier',
  })
  const lien = await tx.afficheAttendue.findUniqueOrThrow({ where: { id: lienId } })
  return { afficheId: lien.afficheId, message: 'Rattachement retiré : feuille de stock à refaire.' }
}

// RG-REC-175 : la quantité reçue n'est pas une condition de la validation (pas d'alerte legacy).
// RG-REC-003 / RG-X-007 / RG-X-015 : valider / annuler la validation admin (coord, admin) depuis la fiche
// affiche ; une réception inconnue ne se valide pas (« Réception inconnue : à rattacher d'abord », RG-REC-111).
export async function changerValidationAdmin(
  tx: Tx,
  identity: Identity,
  id: number,
  input: { version: number; valider: boolean },
) {
  assertDroitReception(identity, 'validation_admin.valider')
  const a = await tx.affiche.findUnique({ where: { id } })
  if (!a) throw new NotFoundError('Affiche introuvable')
  assertPerimetreReception(identity, a.plateformeId)
  // RG-REC-169 : une cible de fusion héritée est en lecture seule (contrôlé d'abord).
  await assertAfficheNonFusionnee(tx, id)
  // RG-COO-007 / RG-REC-111 : une réception inconnue (état CALCULÉ, orpheline ou sans lien) ne se valide pas.
  if (input.valider && (await etatValidationAffiche(tx, id)).etat === 'RECEPTION_INCONNUE') {
    throw new ConflictError('Réception inconnue : à rattacher d’abord (Réceptions inconnues).', {
      code: 'REC_VALIDATION_A_RATTACHER',
      regle: 'RG-REC-111',
    })
  }
  // RG-COO-008 / RG-COO-014 (RG-X-015) : déjà validée → 409 ; annuler une affiche non validée → 409.
  if (input.valider === a.validationAdmin) {
    throw new ConflictError(
      input.valider ? 'Affiche déjà validée.' : 'Affiche non validée : rien à annuler.',
      { code: 'TRANSITION_INTERDITE', regle: input.valider ? 'RG-COO-008' : 'RG-COO-014' },
    )
  }
  await ecrireAfficheVersionnee(
    tx,
    identity,
    a,
    input.version,
    // RG-X-015 : mêmes écritures que la Coordination (RG-COO-008 / 014) : par / le (RG-COO-015), étiquette rack
    // à imprimer (RG-COO-023) ; une annulation pose le motif ANNULEE (RG-COO-006 / 014, RG-X-050).
    input.valider ? donneesValidation(identity, a, new Date()) : donneesAnnulation('ANNULEE'),
  )
  await ecrireJournal(tx, {
    typeEntite: 'AFFICHE',
    entiteId: id,
    action: input.valider ? 'VALIDATION_ADMIN' : 'ANNULATION_VALIDATION_ADMIN',
    parId: identity.userId,
    ancienneValeur: a.validationAdmin ? 'validée' : 'à confirmer',
    // RG-COO-014 / RG-COO-015 : « validation annulée par <nom> ».
    nouvelleValeur: input.valider
      ? 'validée'
      : `validation annulée par ${identity.nom ?? identity.identifiantExterne}`,
  })
  // RG-X-015 / RG-COO-020 (ANO-032) : l'historique du dossier enregistre aussi la confirmation / l'annulation.
  await journalDossiers(
    tx,
    identity,
    id,
    input.valider ? 'VALIDATION_ADMIN' : 'ANNULATION_VALIDATION_ADMIN',
    `affiche ${String(id)} ${input.valider ? 'confirmée' : ': validation annulée'} (fiche affiche)`,
  )
  return {
    afficheId: id,
    // RG-X-015 : même message que la Coordination (maquette).
    message: input.valider
      ? messageConfirmation(1)
      : 'Validation annulée : l’affiche repasse « À confirmer : doute » (validation à refaire).',
  }
}
