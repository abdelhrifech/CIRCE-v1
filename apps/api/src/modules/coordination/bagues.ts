// COO-P11 — Bagues et étiquettes (ECR-COO-11) : liste (RG-COO-298), impression avec rouleur obligatoire et passage de
// l'unité « Prêt » à « En production » (RG-COO-299), textes imprimés et réimpression automatique (RG-COO-300),
// réimpression avec motif (RG-COO-301), contenu de l'étiquette (RG-COO-302). L'unité de production du déroulant est
// le train (HYPOTHÈSE Q-250) ; les unités UM (rouleau) et lot relèvent de la création des UM (Q-265, OUVERTE). La
// bague est posée en base ; l'étiquette est un APERÇU navigateur (PDF généré côté navigateur, Q-002, Q-287) : aucune
// impression physique n'est pilotée. Hypothèses : Q-195, Q-250, Q-251, Q-277, Q-286.
import {
  lireSemaineIso,
  type ApercuBague,
  type BagueImprimee,
  type Bagues,
  type BaguesQuery,
  type ImprimerBagues,
  type ImpressionBagues,
  type LigneBague,
  type ModifierBague,
  type ReimprimerBague,
  type TexteBague,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { Bague } from '../../generated/prisma/client.ts'
import { rouleurValide } from './export-trains.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import {
  ateliersDuPerimetre,
  chargerTrains,
  construireTrains,
  contient,
  ecrireFace,
  facesDesTrains,
  verifierVersions,
  type TrainCalcule,
} from './trains.ts'

type Client = Db | Tx
const JOUR = 86_400_000

/** Texte de la bague d'une position : celui du visuel (face) tant qu'aucune modification n'a été saisie. */
const textesDuTrain = (t: TrainCalcule): TexteBague[] =>
  t.positions
    .filter((p) => p.etat !== 'FRACTIONNE')
    .map((p) => ({ lettre: p.lettre, annonceur: p.annonceur, theme: p.theme, modifie: false }))

const textesDeLaBague = (b: Bague): TexteBague[] => JSON.parse(b.textes) as TexteBague[]

/**
 * RG-COO-299 / Q-195 (1) : imprimable = unité « Prêt à produire » (statut PRET, A imprimer = Prêt à produire,
 * README §5) dont TOUTES les faces sont « A imprimer » (5) : le passage « Au roulage » (face 10) part de 5 (table de
 * transitions, RG-COO-218) ; un train pas encore exporté (faces « Instruction ok ») n'est pas imprimable.
 */
function raisonNonImprimable(t: TrainCalcule, bague: Bague | undefined): string | null {
  if (bague) return `déjà imprimée (bague n° ${String(bague.id)})`
  if (t.statut === 'EN_ATTENTE') return "visuels pas tous reçus (« En attente d'affiches »)"
  if (t.statut !== 'PRET') return 'déjà en production'
  if (t.faces.some((f) => f.statut !== 'A_IMPRIMER'))
    return 'pas encore exporté (faces « Instruction ok », RG-COO-218)'
  return null
}

const codeBarre = (b: Bague | undefined, trainId: string) =>
  b ? `BG${String(b.id).padStart(8, '0')}` : `BG-${trainId}`

async function rouleurDe(db: Client, id: number | null) {
  if (id === null) return null
  return (await db.rouleur.findUnique({ where: { id }, select: { nom: true } }))?.nom ?? null
}

async function utilisateurs(db: Client, ids: number[]) {
  return new Map(
    (
      await parPaquets([...new Set(ids)], (paquet) =>
        db.utilisateur.findMany({
          where: { id: { in: paquet } },
          select: { id: true, nom: true, identifiantExterne: true },
        }),
      )
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
}

async function baguesDe(db: Client, trainIds: readonly string[]) {
  const res = new Map<string, Bague>()
  for (let i = 0; i < trainIds.length; i += 400)
    for (const b of await db.bague.findMany({
      where: { trainId: { in: trainIds.slice(i, i + 400) } },
    }))
      res.set(b.trainId, b)
  return res
}

// RG-COO-302 : contenu de l'étiquette. « Nb aff » d'un train = ses positions non fractionnées (une affiche par face ;
// quantité + entretien pour une UM / un lot, Q-COO-25) ; « boucle » n'est pas modélisée (Q-195).
function apercu(t: TrainCalcule, bague: Bague | undefined, rouleur: string | null): ApercuBague {
  const textes = bague ? textesDeLaBague(bague) : textesDuTrain(t)
  const positions = t.positions.filter((p) => p.etat !== 'FRACTIONNE')
  return {
    numero: bague?.id ?? null,
    codeBarre: codeBarre(bague, t.trainId),
    trainId: t.trainId,
    nbAff: positions.length,
    destinataire: t.destinataire,
    afficheur: t.afficheur,
    atelier: t.atelier?.libelle ?? null,
    depart: t.depart.toISOString(),
    rouleur,
    lignes: positions.map((p, i) => ({
      dossier: p.contNum,
      annonceur: textes[i]?.annonceur ?? p.annonceur,
      lettre: p.lettre,
      theme: textes[i]?.theme ?? p.theme,
      modifie: textes[i]?.modifie ?? false,
    })),
  }
}

const imprimee = (b: Bague, par: string | null, rouleur: string | null): BagueImprimee => ({
  numero: b.id,
  imprimeeLe: b.imprimeeLe.toISOString(),
  par,
  rouleur,
  reimpressions: b.reimpressions,
  modifiee: b.modifiee,
  version: b.version,
})

// RG-COO-298 : unités hors EN_ATTENTE (le poste « machine Vendôme » n'est pas repris, D-02) ; filtre « Bague » :
// « À imprimer » (défaut : prêtes sans bague), « Imprimées », « Sans bague, déjà en production ». Sans départ choisi,
// les trains partant depuis 14 jours (HYPOTHÈSE Q-195).
export async function listerBagues(
  db: Db,
  identity: Identity,
  q: BaguesQuery,
  maintenant = new Date(),
): Promise<Bagues> {
  assertDroitCoordination(identity, 'bague.imprimer', 'RG-COO-298')
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.type === 'SCROLL')
  const faces = await facesDesTrains(db, ateliers, {
    ...(q.atelier ? { atelierId: q.atelier } : {}),
    ...(q.depart
      ? { semaine: lireSemaineIso(q.depart) }
      : { departApres: new Date(maintenant.getTime() - 14 * JOUR) }),
  })
  const trains = (await construireTrains(db, faces, ateliers)).filter(
    (t) =>
      t.statut !== 'EN_ATTENTE' &&
      (q.dossier === undefined || t.positions.some((p) => p.contNum === q.dossier)) &&
      contient(t.destinataire, q.destinataire),
  )
  const bagues = await baguesDe(
    db,
    trains.map((t) => t.trainId),
  )
  const filtre = q.bague ?? 'A_IMPRIMER'
  const retenus = trains.filter((t) => {
    const b = bagues.get(t.trainId)
    if (filtre === 'IMPRIMEES') return b !== undefined
    if (filtre === 'SANS_BAGUE') return b === undefined && t.statut !== 'PRET'
    return b === undefined && t.statut === 'PRET'
  })
  const par = await utilisateurs(
    db,
    [...bagues.values()].map((b) => b.imprimeeParId),
  )
  const lignes: LigneBague[] = []
  for (const t of retenus.sort(
    (a, b) => a.depart.getTime() - b.depart.getTime() || a.trainId.localeCompare(b.trainId),
  )) {
    const b = bagues.get(t.trainId)
    lignes.push({
      trainId: t.trainId,
      version: t.version,
      type: 'TRAIN',
      atelier: t.atelier
        ? { id: t.atelier.id, libelle: t.atelier.libelle, plateforme: t.atelier.plateforme }
        : null,
      poste: null,
      destinataire: t.destinataire,
      afficheur: t.afficheur,
      depart: t.depart.toISOString(),
      textes: b ? textesDeLaBague(b) : textesDuTrain(t),
      statut: t.statut,
      bague: b
        ? imprimee(b, par.get(b.imprimeeParId) ?? null, await rouleurDe(db, b.rouleurId))
        : null,
      imprimable: raisonNonImprimable(t, b) === null,
    })
  }
  return {
    lignes,
    ateliers: ateliers.map((a) => ({ id: a.id, libelle: a.libelle, plateforme: a.plateforme })),
  }
}

// RG-COO-302 / ECR-COO-11a : aperçu des premières bagues (6 dans la modale) d'une sélection.
export async function apercuBagues(db: Db, identity: Identity, trainIds: string[]) {
  assertDroitCoordination(identity, 'bague.imprimer', 'RG-COO-302')
  const { trains } = await chargerTrains(db, identity, trainIds)
  const bagues = await baguesDe(db, trainIds)
  const res: ApercuBague[] = []
  for (const t of trains)
    res.push(
      apercu(
        t,
        bagues.get(t.trainId),
        await rouleurDe(db, bagues.get(t.trainId)?.rouleurId ?? t.faces[0]?.rouleurId ?? null),
      ),
    )
  return { bagues: res, total: res.length }
}

// RG-COO-299 : « Imprimer n bague(s) » : rouleur obligatoire (schéma : 400 sinon), bague posée, rouleur affecté, unités
// PRET → EN_PROD (faces « A imprimer » → « Au roulage », point de non-retour, RG-COO-217 / 223), historique. Tout dans
// UNE transaction, l'état « Prêt » (couverture des visuels par la Réception, RG-COO-208) étant relu dans la même
// transaction : un visuel non reçu entre-temps rend l'unité non imprimable. Les unités non imprimables sont listées ;
// aucune imprimable : 422 « Aucune unité « Prêt à produire » dans la sélection. ».
export async function imprimerBagues(
  tx: Tx,
  identity: Identity,
  input: ImprimerBagues,
  maintenant = new Date(),
): Promise<ImpressionBagues> {
  assertDroitCoordination(identity, 'bague.imprimer', 'RG-COO-299')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const rouleur = await rouleurValide(tx, input.rouleurId, [
    ...new Set(trains.flatMap((t) => t.faces.map((f) => f.atelierId ?? 0))),
  ])
  const existantes = await baguesDe(
    tx,
    trains.map((t) => t.trainId),
  )
  const ignorees: { trainId: string; raison: string }[] = []
  const aImprimer: TrainCalcule[] = []
  for (const t of trains) {
    const raison = raisonNonImprimable(t, existantes.get(t.trainId))
    if (raison === null) aImprimer.push(t)
    else ignorees.push({ trainId: t.trainId, raison })
  }
  if (aImprimer.length === 0)
    throw new BusinessError('Aucune unité « Prêt à produire » dans la sélection.', {
      code: 'COO_AUCUNE_UNITE_PRETE',
      regle: 'RG-COO-299',
      details: { ignorees },
    })
  const posees: ApercuBague[] = []
  for (const t of aImprimer) {
    const bague = await tx.bague.create({
      data: {
        trainId: t.trainId,
        atelierId: t.atelier?.id ?? null,
        rouleurId: rouleur.id,
        textes: JSON.stringify(textesDuTrain(t)),
        imprimeeLe: maintenant,
        imprimeeParId: identity.userId,
      },
    })
    for (const f of t.faces)
      await ecrireFace(
        tx,
        f,
        { rouleurId: rouleur.id },
        { vers: 'AU_ROULAGE', parId: identity.userId, regle: 'RG-COO-299' },
      )
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: t.trainId,
      action: 'IMPRESSION_BAGUE',
      parId: identity.userId,
      ancienneValeur: 'PRET',
      nouvelleValeur: `Bague n° ${String(bague.id)} imprimée (rouleur ${rouleur.nom}) : EN_PROD`,
      complement: 'RG-COO-299',
    })
    posees.push(apercu(t, bague, rouleur.nom))
  }
  return {
    message: `${String(aImprimer.length)} bague(s) imprimée(s) (rouleur ${rouleur.nom}). Le statut passe automatiquement à « En production » à l'impression.`,
    imprimees: aImprimer.length,
    ignorees,
    bagues: posees,
    simulee: true,
  }
}

async function bagueDuTrain(tx: Tx, identity: Identity, trainId: string) {
  const bague = await tx.bague.findUnique({ where: { trainId } })
  if (!bague)
    throw new ConflictError("Cette unité n'a pas encore de bague imprimée.", {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-301',
    })
  const { trains } = await chargerTrains(tx, identity, [trainId])
  const train = trains[0]
  if (!train) throw new NotFoundError(`Train ${trainId} introuvable`)
  return { bague, train }
}

// RG-COO-300 : « Enregistrer et réimprimer » : textes par position (non vides : « Le thème et l'annonceur ne peuvent
// pas être vides. », rien de changé : « Rien n'a changé. », HYPOTHÈSE Q-195), tag « modifié » par texte différent
// du visuel, réimpression automatique (compteur +1), historique. Réservé aux bagues déjà imprimées (le texte d'une
// bague pas encore imprimée est celui du visuel) ; verrou de version de la bague (RG-COO-308).
export async function modifierTextesBague(
  tx: Tx,
  identity: Identity,
  input: ModifierBague,
): Promise<{ message: string; bague: ApercuBague; reimpressions: number; version: number }> {
  assertDroitCoordination(identity, 'bague.imprimer', 'RG-COO-300')
  const { bague, train } = await bagueDuTrain(tx, identity, input.trainId)
  assertPerimetreAtelier(identity, train.atelier)
  const visuel = textesDuTrain(train)
  const lettres = visuel.map((t) => t.lettre)
  const donnees = new Map(input.textes.map((t) => [t.lettre, t]))
  if (
    donnees.size !== input.textes.length ||
    lettres.some((l) => !donnees.has(l)) ||
    donnees.size !== lettres.length
  )
    throw new BusinessError('Les textes doivent couvrir exactement les positions de la bague.', {
      code: 'COO_BAGUE_POSITIONS',
      regle: 'RG-COO-300',
      details: { positions: lettres },
    })
  if (input.textes.some((t) => t.annonceur === '' || t.theme === ''))
    throw new BusinessError("Le thème et l'annonceur ne peuvent pas être vides.", {
      code: 'COO_TEXTE_VIDE',
      regle: 'RG-COO-300',
    })
  const actuels = textesDeLaBague(bague)
  const nouveaux: TexteBague[] = visuel.map((v) => {
    const t = donnees.get(v.lettre)
    const annonceur = t?.annonceur ?? v.annonceur
    const theme = t?.theme ?? v.theme
    return {
      lettre: v.lettre,
      annonceur,
      theme,
      modifie: annonceur !== v.annonceur || theme !== v.theme,
    }
  })
  if (
    actuels.length === nouveaux.length &&
    nouveaux.every((n, i) => n.annonceur === actuels[i]?.annonceur && n.theme === actuels[i].theme)
  )
    throw new BusinessError("Rien n'a changé.", { code: 'COO_RIEN_CHANGE', regle: 'RG-COO-300' })
  const version = await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.bague.updateMany({
        where: { id: bague.id, ...where },
        data: {
          textes: JSON.stringify(nouveaux),
          modifiee: nouveaux.some((n) => n.modifie),
          reimpressions: { increment: 1 },
          ...bumpVersion,
        },
      }),
    ...COO.version,
    regle: 'RG-COO-308',
  })
  await ecrireJournal(tx, {
    typeEntite: 'TRAIN',
    entiteId: train.trainId,
    action: 'MODIFICATION_BAGUE',
    parId: identity.userId,
    ancienneValeur: actuels
      .map((t) => `${t.lettre} ${t.annonceur ?? ''} · ${t.theme ?? ''}`)
      .join(' | '),
    nouvelleValeur: nouveaux
      .map((t) => `${t.lettre} ${t.annonceur ?? ''} · ${t.theme ?? ''}`)
      .join(' | '),
    complement: 'RG-COO-300',
  })
  const apres = await tx.bague.findUniqueOrThrow({ where: { id: bague.id } })
  return {
    message: `Textes de la bague n° ${String(bague.id)} enregistrés et réimprimés.`,
    bague: apercu(train, apres, await rouleurDe(tx, apres.rouleurId)),
    reimpressions: apres.reimpressions,
    version,
  }
}

// RG-COO-301 : « Réimprimer la bague n » : motif obligatoire (liste fermée : 400 sinon), même numéro, mêmes textes,
// statut inchangé, compteur +1, historique avec motif. Droit `bague.reimprimer` (chef d'équipe ; directeur de
// plateforme non défini : Q-277, Q-286). Réservé à une bague déjà imprimée (409 sinon).
export async function reimprimerBague(
  tx: Tx,
  identity: Identity,
  input: ReimprimerBague,
): Promise<{ message: string; bague: ApercuBague; reimpressions: number; version: number }> {
  assertDroitCoordination(identity, 'bague.reimprimer', 'RG-COO-301')
  const { bague, train } = await bagueDuTrain(tx, identity, input.trainId)
  assertPerimetreAtelier(identity, train.atelier)
  const version = await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.bague.updateMany({
        where: { id: bague.id, ...where },
        data: { reimpressions: { increment: 1 }, ...bumpVersion },
      }),
    ...COO.version,
    regle: 'RG-COO-308',
  })
  const motif = input.precision ? `${input.motif} (${input.precision})` : input.motif
  await ecrireJournal(tx, {
    typeEntite: 'TRAIN',
    entiteId: train.trainId,
    action: 'REIMPRESSION_BAGUE',
    parId: identity.userId,
    nouvelleValeur: `Bague n° ${String(bague.id)} réimprimée : ${motif}`,
    complement: 'RG-COO-301',
  })
  const apres = await tx.bague.findUniqueOrThrow({ where: { id: bague.id } })
  return {
    message: `Bague n° ${String(bague.id)} réimprimée (motif : ${motif}) — ${String(apres.reimpressions)} réimpression(s).`,
    bague: apercu(train, apres, await rouleurDe(tx, apres.rouleurId)),
    reimpressions: apres.reimpressions,
    version,
  }
}
