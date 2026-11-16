// COO-P11 — Dispatch du roulage (ECR-COO-10) : trains PRET / EN_PROD d'un atelier déroulant, charge par rouleur,
// « Proposer une répartition » (règle SIMULÉE en attente du moteur cible, Q-276), affectation manuelle,
// « Tout désaffecter », alertes de départ proche / surcharge, liste de picking (RG-COO-291 à 296).
// Source : docs/COORDINATION_REGLES_METIER.md RG-COO-291 à 296 ; maquette ECR-COO-10 ; hypothèses Q-195, Q-276, Q-286.
import {
  lireSemaineIso,
  type AffecterDispatch,
  type Dispatch,
  type DispatchQuery,
  type LigneDispatch,
  type Picking,
  type RepartitionDispatch,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { lireParametreNombre } from '../reception/parametres.ts'
import { rouleurValide } from './export-trains.ts'
import { assertDroitCoordination, assertPerimetreAtelier } from './permissions.ts'
import {
  ateliersDuPerimetre,
  chargerTrains,
  cleVisuel,
  construireTrains,
  contient,
  ecrireFace,
  facesDesTrains,
  verifierVersions,
  type AtelierPerimetre,
  type TrainCalcule,
} from './trains.ts'

type Client = Db | Tx
const STATUTS_DISPATCH = ['PRET', 'EN_PROD'] as const
const HEURE = 3_600_000

const dansDispatch = (t: TrainCalcule) => (STATUTS_DISPATCH as readonly string[]).includes(t.statut)
/** RG-COO-292 : faces d'un train = nb × positions non fractionnées (nb = 1 par train ; regroupé en ligne). */
const facesDe = (t: TrainCalcule) => t.positions.filter((p) => p.etat !== 'FRACTIONNE').length
const rouleurDe = (t: TrainCalcule): number | null => t.faces[0]?.rouleurId ?? null

/** Atelier déroulant du périmètre affiché (RG-COO-291 : un par site) ; 403 / 404 si choisi hors périmètre. */
async function choisirAtelier(
  db: Client,
  identity: Identity,
  demande: number | undefined,
): Promise<{ atelier: AtelierPerimetre | null; ateliers: AtelierPerimetre[] }> {
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.type === 'SCROLL')
  if (demande === undefined) return { atelier: ateliers[0] ?? null, ateliers }
  const trouve = ateliers.find((a) => a.id === demande)
  if (trouve) return { atelier: trouve, ateliers }
  const ailleurs = await db.atelier.findUnique({ where: { id: demande } })
  if (!ailleurs) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, ailleurs)
  throw new BusinessError("Cet atelier n'est pas un atelier déroulant.", {
    code: 'COO_ATELIER_NON_DEROULANT',
    regle: 'RG-COO-291',
  })
}

// RG-COO-294 / 297 : opérateurs du SITE de l'atelier (rouleurs rattachés à cet atelier) ; un rouleur sans atelier
// (reprise legacy) n'est pas proposé au dispatch (HYPOTHÈSE Q-195).
async function rouleursActifs(db: Client, atelierId: number, maintenant: Date) {
  return db.rouleur.findMany({
    where: {
      atelierId,
      AND: [{ OR: [{ dateFin: null }, { dateFin: { gt: maintenant } }] }],
    },
    orderBy: [{ nom: 'asc' }, { id: 'asc' }],
  })
}

async function trainsDeLAtelier(db: Client, atelier: AtelierPerimetre, depart?: string) {
  const faces = await facesDesTrains(db, [atelier], {
    ...(depart ? { semaine: lireSemaineIso(depart) } : {}),
  })
  return (await construireTrains(db, faces, [atelier])).filter(dansDispatch)
}

// RG-COO-291 / 292 / 295 : lecture du dispatch d'un atelier déroulant.
export async function dispatchRoulage(
  db: Db,
  identity: Identity,
  q: DispatchQuery,
  maintenant = new Date(),
): Promise<Dispatch> {
  assertDroitCoordination(identity, 'dispatch.gerer', 'RG-COO-291')
  const { atelier, ateliers } = await choisirAtelier(db, identity, q.atelier)
  const ref = (a: AtelierPerimetre) => ({ id: a.id, libelle: a.libelle, plateforme: a.plateforme })
  const seuilDepartHeures = await lireParametreNombre(db, 'dispatch.seuilDepartHeures')
  const seuilSurchargePct = await lireParametreNombre(db, 'dispatch.seuilChargePct')
  if (!atelier)
    return {
      atelier: null,
      ateliers: [],
      lignes: [],
      indicateurs: { trainsARouler: 0, faces: 0, nonAffectes: 0 },
      charge: [],
      alertes: { departProche: 0, seuilDepartHeures, seuilSurchargePct, surcharges: [] },
      rouleurs: [],
      moteurSimule: true,
    }
  const tous = await trainsDeLAtelier(db, atelier, q.depart)
  const rouleurs = await rouleursActifs(db, atelier.id, maintenant)
  const nomRouleur = new Map(rouleurs.map((r) => [r.id, r]))
  // Rouleurs désactivés encore portés par des faces : leur nom reste affiché.
  const inconnus = [...new Set(tous.map(rouleurDe))].filter(
    (id): id is number => id !== null && !nomRouleur.has(id),
  )
  for (const r of await parPaquets(inconnus, (paquet) =>
    db.rouleur.findMany({ where: { id: { in: paquet } } }),
  ))
    nomRouleur.set(r.id, r)
  const refRouleur = (id: number | null) => {
    const r = id === null ? undefined : nomRouleur.get(id)
    return r ? { id: r.id, nom: r.nom, poste: r.poste } : null
  }

  // RG-COO-292 : charge par rouleur sur les trains de l'atelier (les filtres dossier / destinataire / statut ne
  // changent pas la charge : elle décrit l'atelier, HYPOTHÈSE Q-195).
  const charges = new Map<number, { trains: number; faces: number; destinataires: Set<string> }>()
  for (const t of tous) {
    const id = rouleurDe(t)
    if (id === null) continue
    const c = charges.get(id) ?? { trains: 0, faces: 0, destinataires: new Set<string>() }
    c.trains++
    c.faces += facesDe(t)
    if (t.destinataire) c.destinataires.add(t.destinataire)
    charges.set(id, c)
  }
  const idsCharge = new Set([...rouleurs.map((r) => r.id), ...charges.keys()])
  const total = [...charges.values()].reduce((s, c) => s + c.faces, 0)
  const moyenne = rouleurs.length > 0 ? total / rouleurs.length : 0
  const charge = [...idsCharge]
    .map((id) => {
      const r = nomRouleur.get(id)
      const c = charges.get(id)
      const pct = moyenne > 0 ? Math.round(((c?.faces ?? 0) / moyenne) * 100) : 0
      return {
        rouleurId: id,
        nom: r?.nom ?? `Rouleur ${String(id)}`,
        poste: r?.poste ?? null,
        trains: c?.trains ?? 0,
        faces: c?.faces ?? 0,
        chargePct: pct,
        destinataires: [...(c?.destinataires ?? [])].sort(),
        surcharge: pct > seuilSurchargePct,
      }
    })
    .sort((a, b) => a.nom.localeCompare(b.nom))

  // RG-COO-291 : filtres N° de dossier, Départ (déjà appliqué), Statut, Destinataire.
  const filtres = tous.filter(
    (t) =>
      (q.dossier === undefined || t.positions.some((p) => p.contNum === q.dossier)) &&
      (q.statut === undefined || t.statut === q.statut) &&
      contient(t.destinataire, q.destinataire),
  )
  const lignes = new Map<string, LigneDispatch>()
  for (const t of filtres.sort(
    (a, b) => a.depart.getTime() - b.depart.getTime() || a.trainId.localeCompare(b.trainId),
  )) {
    const k = JSON.stringify([
      t.destinataire,
      t.depart.toISOString(),
      t.statut,
      t.positions.map((p) => [p.contNum, p.theme, p.repiquage, p.etat]),
      rouleurDe(t),
    ])
    const existante = lignes.get(k)
    if (existante) {
      existante.trains.push({ trainId: t.trainId, version: t.version })
      existante.nb++
      existante.faces += facesDe(t)
      continue
    }
    const id = rouleurDe(t)
    lignes.set(k, {
      cle: t.trainId,
      trains: [{ trainId: t.trainId, version: t.version }],
      destinataire: t.destinataire,
      depart: t.depart.toISOString(),
      positions: t.positions.map((p) => ({
        lettre: p.lettre,
        annonceur: p.annonceur,
        theme: p.theme,
        etat: p.etat,
      })),
      nb: 1,
      faces: facesDe(t),
      statut: t.statut as 'PRET' | 'EN_PROD',
      rouleur: refRouleur(id),
      // RG-COO-294 : non affecté qui part dans moins de n heures (critique) ; un départ passé l'est a fortiori.
      urgent: id === null && t.depart.getTime() - maintenant.getTime() < seuilDepartHeures * HEURE,
    })
  }
  const liste = [...lignes.values()]
  return {
    atelier: ref(atelier),
    ateliers: ateliers.map(ref),
    lignes: liste,
    indicateurs: {
      trainsARouler: liste.reduce((s, l) => s + l.nb, 0),
      faces: liste.reduce((s, l) => s + l.faces, 0),
      nonAffectes: liste.filter((l) => l.rouleur === null).reduce((s, l) => s + l.nb, 0),
    },
    charge,
    alertes: {
      departProche: liste.filter((l) => l.urgent).reduce((s, l) => s + l.nb, 0),
      seuilDepartHeures,
      seuilSurchargePct,
      surcharges: charge
        .filter((c) => c.surcharge)
        .map((c) => ({ rouleur: c.nom, chargePct: c.chargePct })),
    },
    rouleurs: rouleurs.map((r) => ({ id: r.id, nom: r.nom, poste: r.poste })),
    moteurSimule: true,
  }
}

async function ecrireAffectation(
  tx: Tx,
  identity: Identity,
  t: TrainCalcule,
  rouleur: { id: number; nom: string } | null,
  action: 'AFFECTATION_DISPATCH' | 'PROPOSITION_REPARTITION' | 'DESAFFECTATION_DISPATCH',
  regle: string,
  anciens: ReadonlyMap<number, string>,
) {
  for (const f of t.faces)
    if ((f.rouleurId ?? null) !== (rouleur?.id ?? null))
      await ecrireFace(tx, f, { rouleurId: rouleur?.id ?? null }, { parId: identity.userId, regle })
  await ecrireJournal(tx, {
    typeEntite: 'TRAIN',
    entiteId: t.trainId,
    action,
    parId: identity.userId,
    ancienneValeur: anciens.get(rouleurDe(t) ?? 0) ?? null,
    nouvelleValeur: rouleur?.nom ?? 'Non affecté',
    complement: regle,
  })
}

async function nomsRouleurs(tx: Tx, trains: readonly TrainCalcule[]) {
  return new Map(
    (
      await parPaquets([...new Set(trains.map((t) => rouleurDe(t) ?? 0))], (paquet) =>
        tx.rouleur.findMany({
          where: { id: { in: paquet } },
          select: { id: true, nom: true },
        }),
      )
    ).map((r) => [r.id, r.nom]),
  )
}

const MESSAGE_HORS_DISPATCH =
  "Ce train n'est plus au roulage (seuls les trains « Prêt » ou « En production » se répartissent)."

// RG-COO-294 : affectation manuelle (immédiate, journalisée) ; « Non affecté » = rouleurId null. Un train déjà
// « En production » garde un rouleur (RG-COO-217 : rouleur obligatoire à « Au roulage ») : réaffectation possible,
// désaffectation refusée (HYPOTHÈSE Q-195, qui précise RG-COO-294 « train non LIVRE »).
export async function affecterDispatch(tx: Tx, identity: Identity, input: AffecterDispatch) {
  assertDroitCoordination(identity, 'dispatch.gerer', 'RG-COO-294')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const hors = trains.find((t) => !dansDispatch(t))
  if (hors)
    throw new ConflictError(MESSAGE_HORS_DISPATCH, {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-294',
      details: { trainId: hors.trainId, statut: hors.statut },
    })
  const rouleur =
    input.rouleurId === null
      ? null
      : await rouleurValide(tx, input.rouleurId, [
          ...new Set(trains.flatMap((t) => t.faces.map((f) => f.atelierId ?? 0))),
        ])
  if (rouleur === null) {
    const enProd = trains.find((t) => t.statut === 'EN_PROD')
    if (enProd)
      throw new ConflictError(
        `Le train ${enProd.trainId} est en production : un rouleur reste obligatoire (RG-COO-217).`,
        {
          code: 'COO_ROULEUR_OBLIGATOIRE',
          regle: 'RG-COO-217',
          details: { trainId: enProd.trainId },
        },
      )
  }
  const anciens = await nomsRouleurs(tx, trains)
  for (const t of trains)
    await ecrireAffectation(
      tx,
      identity,
      t,
      rouleur,
      rouleur ? 'AFFECTATION_DISPATCH' : 'DESAFFECTATION_DISPATCH',
      'RG-COO-294',
      anciens,
    )
  return {
    message: rouleur
      ? `Rouleur ${rouleur.nom} affecté à ${String(trains.length)} train(s).`
      : `${String(trains.length)} train(s) désaffecté(s).`,
    nombre: trains.length,
  }
}

async function trainsAffiches(tx: Tx, identity: Identity, input: RepartitionDispatch) {
  const atelier = await tx.atelier.findUnique({ where: { id: input.atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const autre = trains.find((t) => t.atelier?.id !== atelier.id)
  if (autre)
    throw new BusinessError("Ce train n'appartient pas à l'atelier affiché.", {
      code: 'COO_TRAIN_AUTRE_ATELIER',
      regle: 'RG-COO-291',
      details: { trainId: autre.trainId },
    })
  return { atelier, trains }
}

// RG-COO-293 : « Proposer une répartition » : règle SIMULÉE (moteur cible non fourni, Q-276) : départ le plus proche
// d'abord, puis rouleur le moins chargé (en faces). Ne touche ni les trains déjà affectés ni les trains hors
// dispatch. Refus 422 s'il n'y a rien à répartir ou aucun rouleur (HYPOTHÈSE Q-195).
export async function proposerRepartition(
  tx: Tx,
  identity: Identity,
  input: RepartitionDispatch,
  maintenant = new Date(),
) {
  assertDroitCoordination(identity, 'dispatch.gerer', 'RG-COO-293')
  const { atelier, trains } = await trainsAffiches(tx, identity, input)
  const aRepartir = trains
    .filter((t) => dansDispatch(t) && rouleurDe(t) === null)
    .sort((a, b) => a.depart.getTime() - b.depart.getTime() || a.trainId.localeCompare(b.trainId))
  if (aRepartir.length === 0)
    throw new BusinessError('Aucun train non affecté à répartir.', {
      code: 'COO_RIEN_A_REPARTIR',
      regle: 'RG-COO-293',
    })
  const rouleurs = await rouleursActifs(tx, atelier.id, maintenant)
  if (rouleurs.length === 0)
    throw new BusinessError('Aucun rouleur actif sur cet atelier.', {
      code: 'COO_AUCUN_ROULEUR',
      regle: 'RG-COO-293',
    })
  // Charge de départ : faces déjà affectées sur l'atelier (tous les trains PRET / EN_PROD).
  const tousAtelier = await trainsDeLAtelier(
    tx,
    {
      id: atelier.id,
      libelle: atelier.libelle,
      plateformeId: atelier.plateformeId,
      plateforme: '',
      type: atelier.type,
    },
    undefined,
  )
  const charge = new Map(rouleurs.map((r) => [r.id, 0]))
  for (const t of tousAtelier) {
    const id = rouleurDe(t)
    if (id !== null && charge.has(id)) charge.set(id, (charge.get(id) ?? 0) + facesDe(t))
  }
  const anciens = new Map<number, string>()
  const utilises = new Set<number>()
  for (const t of aRepartir) {
    const choisi = [...rouleurs].sort(
      (a, b) => (charge.get(a.id) ?? 0) - (charge.get(b.id) ?? 0) || a.id - b.id,
    )[0]
    if (!choisi) continue
    charge.set(choisi.id, (charge.get(choisi.id) ?? 0) + facesDe(t))
    utilises.add(choisi.id)
    await ecrireAffectation(
      tx,
      identity,
      t,
      { id: choisi.id, nom: choisi.nom },
      'PROPOSITION_REPARTITION',
      'RG-COO-293',
      anciens,
    )
  }
  return {
    message: `Répartition proposée : ${String(aRepartir.length)} trains sur ${String(utilises.size)} rouleurs.`,
    nombre: aRepartir.length,
  }
}

// RG-COO-294 : « Tout désaffecter » remet les trains affichés à « Non affecté » ; les trains « En production »
// gardent leur rouleur (RG-COO-217) et sont comptés à part (HYPOTHÈSE Q-195).
export async function toutDesaffecter(tx: Tx, identity: Identity, input: RepartitionDispatch) {
  assertDroitCoordination(identity, 'dispatch.gerer', 'RG-COO-294')
  const { trains } = await trainsAffiches(tx, identity, input)
  const hors = trains.find((t) => !dansDispatch(t))
  if (hors)
    throw new ConflictError(MESSAGE_HORS_DISPATCH, {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-294',
      details: { trainId: hors.trainId, statut: hors.statut },
    })
  const aDesaffecter = trains.filter((t) => t.statut === 'PRET' && rouleurDe(t) !== null)
  const gardes = trains.filter((t) => t.statut === 'EN_PROD' && rouleurDe(t) !== null).length
  const anciens = await nomsRouleurs(tx, aDesaffecter)
  for (const t of aDesaffecter)
    await ecrireAffectation(tx, identity, t, null, 'DESAFFECTATION_DISPATCH', 'RG-COO-294', anciens)
  return {
    message: `${String(aDesaffecter.length)} train(s) désaffecté(s)${gardes > 0 ? ` ; ${String(gardes)} train(s) en production gardent leur rouleur` : ''}.`,
    nombre: aDesaffecter.length,
  }
}

/**
 * Affiches rattachées (actives) aux visuels donnés (clé = `cleVisuel`) : emplacement « allée-rayon », n° d'affiche et
 * quantité rattachée (RG-COO-296, HYPOTHÈSE Q-195). Partagé par la liste de picking du rouleur et celle d'une génération
 * de fichiers (ECR-GEN-03, D-15).
 */
export async function affichesDesVisuels(
  db: Db,
  visuels: ReadonlyMap<string, { contNum: number; annonceur: string | null; theme: string | null }>,
): Promise<
  {
    cle: string
    visuel: { contNum: number; annonceur: string | null; theme: string | null }
    emplacement: string | null
    numAffiche: number
    quantite: number
  }[]
> {
  const liens = await parPaquets(
    [...new Set([...visuels.values()].map((v) => v.contNum))],
    (paquet) =>
      db.afficheAttendue.findMany({
        where: { actif: true, ligneAttendue: { contNum: { in: paquet } } },
        select: {
          quantite: true,
          ligneAttendue: { select: { plateformeId: true, contNum: true, theme: true } },
          affiche: { select: { id: true, allee: true, rayon: true } },
        },
      }),
  )
  const res = []
  for (const l of liens) {
    const cle = cleVisuel(
      l.ligneAttendue.plateformeId,
      l.ligneAttendue.contNum,
      l.ligneAttendue.theme,
    )
    const visuel = visuels.get(cle)
    if (!visuel) continue
    res.push({
      cle,
      visuel,
      emplacement: [l.affiche.allee, l.affiche.rayon].filter(Boolean).join('-') || null,
      numAffiche: l.affiche.id,
      quantite: l.quantite,
    })
  }
  return res
}

// RG-COO-296 : « Liste des affaires à collecter » d'un rouleur : une ligne par affiche rattachée aux visuels de ses
// trains (Emplacement, N° affiche, Annonceur, Thème, Quantité = quantité rattachée), triée par emplacement.
// HYPOTHÈSE Q-195 : la quantité est celle rattachée au visuel ; lecture seule, aperçu puis PDF navigateur (Q-287).
export async function listePicking(
  db: Db,
  identity: Identity,
  q: { rouleur: number; depart?: string | undefined },
): Promise<Picking> {
  assertDroitCoordination(identity, 'dispatch.gerer', 'RG-COO-296')
  const r = await db.rouleur.findUnique({
    where: { id: q.rouleur },
    include: { atelier: { select: { id: true, plateformeId: true } } },
  })
  if (!r) throw new NotFoundError('Rouleur introuvable')
  assertPerimetreAtelier(identity, r.atelier)
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.id === r.atelierId)
  const faces = (
    await facesDesTrains(db, ateliers, {
      ...(q.depart ? { semaine: lireSemaineIso(q.depart) } : {}),
    })
  ).filter((f) => f.rouleurId === r.id && !f.fractionnee)
  const trains = (await construireTrains(db, faces, ateliers)).filter(dansDispatch)
  const visuels = new Map<
    string,
    { contNum: number; annonceur: string | null; theme: string | null }
  >()
  const plateformeId = r.atelier?.plateformeId ?? 0
  for (const t of trains)
    for (const p of t.positions)
      if (p.etat !== 'FRACTIONNE' && p.contNum !== null)
        visuels.set(cleVisuel(plateformeId, p.contNum, p.theme), {
          contNum: p.contNum,
          annonceur: p.annonceur,
          theme: p.theme,
        })
  const lignes: Picking['lignes'] = []
  for (const l of await affichesDesVisuels(db, visuels)) {
    lignes.push({
      emplacement: l.emplacement,
      numAffiche: l.numAffiche,
      annonceur: l.visuel.annonceur,
      theme: l.visuel.theme,
      quantite: l.quantite,
    })
  }
  lignes.sort(
    (a, b) =>
      (a.emplacement === null ? 1 : 0) - (b.emplacement === null ? 1 : 0) ||
      (a.emplacement ?? '').localeCompare(b.emplacement ?? '') ||
      (a.numAffiche ?? 0) - (b.numAffiche ?? 0),
  )
  return { rouleur: { id: r.id, nom: r.nom, poste: r.poste }, lignes }
}
