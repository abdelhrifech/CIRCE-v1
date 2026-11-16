// COO-P10 — Générateur de fichiers de production (ECR-GEN-01 choix des trains, GEN-03 bilan et envoi). Le format
// réel (Vendôme .ini, D-15) n'est pas repris : le fichier est SIMULÉ et marqué comme tel (HYPOTHÈSE Q-193). Règle
// sourcée : 20 tiroirs maximum, bloquant (ECR-GEN-01, RG-COO-216 étendue par Q-254).
import {
  formatSemaineIso,
  lireSemaineIso,
  semaineIsoDe,
  type ComplementGeneration,
  type EnvoyerGeneration,
  type Generation,
  type PickingGeneration,
  type PreparerGeneration,
  type TrainsGeneration,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { MachineSimulee, type MachinePort } from '../../core/ports/machine.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { lireParametreNombre } from '../reception/parametres.ts'
import { contenuCsv } from './export-csv.ts'
import { contexteCsv, STATUT_CODE, trainsExportes } from './export-trains.ts'
import { assertDroitCoordination, COO } from './permissions.ts'
import {
  ateIdsDeFaces,
  ateliersDuPerimetre,
  chargerTrains,
  cleTheme,
  cleVisuel,
  construireTrains,
  contient,
  facesDesTrains,
  lotDansPerimetre,
  lotsVisibles,
  verifierVersions,
  versionTrain,
  type AtelierPerimetre,
  type TrainCalcule,
} from './trains.ts'
import { affichesDesVisuels } from './roulage.ts'

/** Tiroirs d'un train : visuels distincts (dossier, thème, repiquage), positions fractionnées exclues. */
const visuelsDe = (t: TrainCalcule) =>
  t.faces
    .filter((f) => !f.fractionnee)
    .map((f) => `${String(f.contNum)}|${cleTheme(f.theme)}|${cleTheme(f.repiquage)}`)

// COO-P10 audit B4 (RG-COO-217, Q-194) : l'envoi à la machine ne modifie pas les faces, donc un train déjà envoyé reste
// PRET. Un train est « déjà envoyé » s'il figure, avec la MÊME version, dans un lot ENVOYE de la semaine : le renvoyer
// ferait produire deux fois les mêmes visuels. Un train dont la composition a changé depuis (version différente) est
// un autre fichier et peut repartir. « Générer un complément » (GEN-03) n'est pas repris : voir ECARTS.
async function trainsDejaEnvoyes(
  db: Pick<Tx, 'generationFichiers'>,
  semaine: { annee: number; semaine: number },
): Promise<Map<string, string>> {
  const lots = await db.generationFichiers.findMany({
    where: { depAnnee: semaine.annee, depSemaine: semaine.semaine, statut: 'ENVOYE' },
    select: { lot: true, trains: true, versionsTrains: true },
  })
  const envoyes = new Map<string, string>()
  for (const l of lots) {
    const versions = JSON.parse(l.versionsTrains) as Record<string, string>
    for (const id of JSON.parse(l.trains) as string[]) {
      if (versions[id] !== undefined) envoyes.set(`${id}|${versions[id]}`, l.lot)
    }
  }
  return envoyes
}

const dejaEnvoyeErreur = (trains: { trainId: string; lot: string }[]) =>
  new ConflictError(
    `Ces trains ont déjà été envoyés à la machine (${trains.map((t) => `${t.trainId} dans ${t.lot}`).join(', ')}) : un nouvel envoi les ferait produire deux fois.`,
    {
      code: 'COO_TRAIN_DEJA_ENVOYE',
      regle: 'RG-COO-217',
      details: { trains },
    },
  )

// ECR-GEN-03 « Modifiées depuis » (RG-COO-074) : trains d'un lot dont la composition courante (version = empreinte des
// faces) n'est plus celle du « Préparer » (modifiés, par Broadcast ou la Coordination, ou disparus). Lecture par paquets.
async function trainsModifiesDesLots(
  db: Pick<Db, 'faceTrain'>,
  ateliers: readonly AtelierPerimetre[],
  lots: readonly { id: number; trains: string; versionsTrains: string }[],
): Promise<Map<number, string[]>> {
  const ids = [...new Set(lots.flatMap((l) => JSON.parse(l.trains) as string[]))]
  const faces = await facesDesTrains(db as Db, ateliers, { trainIds: ids })
  const parTrain = new Map<string, typeof faces>()
  for (const f of faces)
    if (f.trainId !== null) parTrain.set(f.trainId, [...(parTrain.get(f.trainId) ?? []), f])
  const res = new Map<number, string[]>()
  for (const l of lots) {
    const versions = JSON.parse(l.versionsTrains) as Record<string, string>
    res.set(
      l.id,
      (JSON.parse(l.trains) as string[]).filter((id) => {
        const fs = parTrain.get(id)
        return fs === undefined || versionTrain(fs) !== versions[id]
      }),
    )
  }
  return res
}

// ECR-GEN-01 : trains proposés pour la semaine (PRET), en attente d'affiches (exclus) ou déjà envoyés (EN_PROD),
// avec le nombre de tiroirs de chacun et l'historique des générations de la semaine.
export async function trainsPourGeneration(
  db: Db,
  identity: Identity,
  q: {
    depart?: string | undefined
    atelier?: number | undefined
    recherche?: string | undefined
  },
  maintenant = new Date(),
): Promise<TrainsGeneration> {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-215')
  const semaine = q.depart
    ? lireSemaineIso(q.depart)
    : semaineIsoDe(new Date(maintenant.getTime() + 7 * 86_400_000))
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.type === 'SCROLL')
  const faces = await facesDesTrains(db, ateliers, {
    semaine,
    ...(q.atelier ? { atelierId: q.atelier } : {}),
  })
  // ECR-GEN-01 : recherche (train, destinataire, afficheur, annonceur, thème), côté API.
  const trains = (await construireTrains(db, faces, ateliers)).filter(
    (t) =>
      q.recherche === undefined ||
      contient(t.trainId, q.recherche) ||
      contient(t.destinataire, q.recherche) ||
      contient(t.afficheur, q.recherche) ||
      t.positions.some((p) => contient(p.annonceur, q.recherche) || contient(p.theme, q.recherche)),
  )
  const envoyes = await trainsDejaEnvoyes(db, semaine)
  const lignes = trains
    .sort((a, b) => a.depart.getTime() - b.depart.getTime() || a.trainId.localeCompare(b.trainId))
    .map((t) => ({
      trainId: t.trainId,
      version: t.version,
      destinataire: t.destinataire,
      positions: t.positions.map((p) => ({ lettre: p.lettre, etat: p.etat })),
      nb: 1,
      tiroirs: new Set(visuelsDe(t)).size,
      visuels: [...new Set(visuelsDe(t))],
      depart: t.depart.toISOString(),
      statut:
        t.statut === 'PRET' && !envoyes.has(`${t.trainId}|${t.version}`)
          ? ('PRET' as const)
          : t.statut === 'EN_ATTENTE'
            ? ('EN_ATTENTE' as const)
            : ('DEJA_ENVOYE' as const),
    }))
  // RG-COO-167 : seuls les lots dont tous les ateliers sont dans le périmètre sont listés (lecture par paquets, m6).
  const autorises = new Set((await ateliersDuPerimetre(db, identity)).map((a) => a.id))
  const lots = await lotsVisibles(
    (avantId, taille) =>
      db.generationFichiers.findMany({
        where: {
          depAnnee: semaine.annee,
          depSemaine: semaine.semaine,
          ...(avantId === null ? {} : { id: { lt: avantId } }),
        },
        orderBy: { id: 'desc' },
        take: taille,
      }),
    autorises,
    identity,
    50,
  )
  const par = new Map(
    (
      await db.utilisateur.findMany({
        where: { id: { in: [...new Set(lots.map((l) => l.parId))] } },
        select: { id: true, nom: true, identifiantExterne: true },
      })
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  const modifiees = await trainsModifiesDesLots(db, await ateliersDuPerimetre(db, identity), lots)
  const origines = [
    ...new Set(lots.map((l) => l.complementDeId).filter((x): x is number => x !== null)),
  ]
  const lotParNumero = new Map(
    (
      await db.generationFichiers.findMany({
        where: { id: { in: origines } },
        select: { id: true, lot: true },
      })
    ).map((l) => [l.id, l.lot]),
  )
  return {
    semaine,
    tiroirsMax: await lireParametreNombre(db, 'trains.tiroirsMax'),
    trains: lignes,
    indicateurs: {
      prets: lignes.filter((l) => l.statut === 'PRET').length,
      enAttente: lignes.filter((l) => l.statut === 'EN_ATTENTE').length,
      dejaEnvoyes: lignes.filter((l) => l.statut === 'DEJA_ENVOYE').length,
    },
    historique: lots.map((l) => ({
      fichiers: 1,
      modifiees: modifiees.get(l.id)?.length ?? 0,
      complementDe: l.complementDeId === null ? null : (lotParNumero.get(l.complementDeId) ?? null),
      id: l.id,
      lot: l.lot,
      depart: formatSemaineIso({ annee: l.depAnnee, semaine: l.depSemaine }),
      nomFichier: l.nomFichier,
      trains: l.nbTrains,
      tiroirs: l.nbTiroirs,
      statut: l.statut,
      version: l.version,
      machine: l.machineEnvoi,
      par: par.get(l.parId) ?? null,
      le: l.le.toISOString(),
    })),
  }
}

/** Création d'un lot « Préparé » (fichier simulé) : lot normal (RG-COO-307) ou complément d'un lot envoyé (RG-COO-074). */
async function ecrireLot(
  tx: Tx,
  identity: Identity,
  opt: {
    trains: TrainCalcule[]
    semaine: { annee: number; semaine: number }
    tiroirs: number
    complementDe: { id: number; lot: string } | null
    maintenant: Date
  },
): Promise<Generation> {
  const { trains, semaine, tiroirs, maintenant } = opt
  const faces = trains.flatMap((t) => t.faces)
  const ctx = await contexteCsv(tx, faces)
  const contratsMax = await lireParametreNombre(tx, 'trains.positionsMax')
  const exportes = trainsExportes(faces, ctx, (f) => STATUT_CODE[f.statut] ?? 2)
  const dernier = await tx.generationFichiers.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  })
  const numero = (dernier?.id ?? 0) + 1
  const lot = `G-${String(numero).padStart(4, '0')}`
  const nomFichier = `S${String(semaine.semaine).padStart(2, '0')}_VEN_${opt.complementDe ? 'C' : 'F'}${String(numero).padStart(2, '0')}`
  const contenu = `# SIMULATION — format Vendôme (.ini) non repris (D-15, Q-193)\r\n${contenuCsv(exportes, contratsMax)}`
  const cree = await tx.generationFichiers.create({
    data: {
      lot,
      atelierId: trains[0]?.atelier?.id ?? null,
      depAnnee: semaine.annee,
      depSemaine: semaine.semaine,
      trains: JSON.stringify(trains.map((t) => t.trainId)),
      nbTrains: trains.length,
      nbTiroirs: tiroirs,
      nomFichier,
      contenu,
      statut: 'PREPARE',
      complementDeId: opt.complementDe?.id ?? null,
      parId: identity.userId,
      le: maintenant,
      ateIds: ateIdsDeFaces(faces),
      // Audit B3 / RG-COO-308 : versions des trains au « Préparer », revérifiées à l'envoi.
      versionsTrains: JSON.stringify(Object.fromEntries(trains.map((t) => [t.trainId, t.version]))),
    },
  })
  await ecrireJournal(tx, {
    typeEntite: 'GENERATION_FICHIERS',
    entiteId: cree.id,
    action: 'GENERATION_FICHIERS',
    parId: identity.userId,
    nouvelleValeur: `${lot} : ${String(trains.length)} train(s), ${String(tiroirs)} tiroir(s) (fichier simulé).`,
    complement: opt.complementDe
      ? `RG-COO-074 : complément du lot ${opt.complementDe.lot}`
      : 'RG-COO-307',
  })
  return {
    id: cree.id,
    lot,
    nomFichier,
    contenu,
    trains: trains.length,
    tiroirs,
    statut: 'PREPARE',
    version: 1,
    machine: null,
    message: `${opt.complementDe ? 'Complément' : 'Fichier'} ${lot} préparé : ${String(trains.length)} train(s), ${String(tiroirs)} tiroir(s) (simulation).`,
  }
}

// ECR-GEN-01 : « Préparer le fichier (n trains) » : trains PRET uniquement (les EN_ATTENTE sont exclus), 20 tiroirs
// au plus (bloquant, Q-254), lot versionné « G-nnnn » (RG-COO-307). Aucun statut de face modifié à cette étape.
export async function preparerGeneration(
  tx: Tx,
  identity: Identity,
  input: PreparerGeneration,
  maintenant = new Date(),
): Promise<Generation> {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-215')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const pasPrets = trains.filter((t) => t.statut !== 'PRET')
  if (pasPrets.length > 0)
    throw new ConflictError(
      `Seuls les trains prêts (tous leurs visuels reçus) peuvent être mis dans un fichier : ${pasPrets.map((t) => t.trainId).join(', ')}.`,
      {
        code: 'COO_TRAIN_NON_PRET',
        regle: 'RG-COO-208',
        details: { trains: pasPrets.map((t) => t.trainId) },
      },
    )
  const semaine = lireSemaineIso(input.depart)
  // B4 : un train déjà dans un lot ENVOYE (même version) ne peut pas être préparé de nouveau.
  const dejaPreparer = await trainsDejaEnvoyes(tx, semaine)
  const dejaEnvoyes = trains
    .filter((t) => dejaPreparer.has(`${t.trainId}|${t.version}`))
    .map((t) => ({ trainId: t.trainId, lot: dejaPreparer.get(`${t.trainId}|${t.version}`) ?? '' }))
  if (dejaEnvoyes.length > 0) throw dejaEnvoyeErreur(dejaEnvoyes)
  const horsSemaine = trains.filter(
    (t) => t.semaineDepart.annee !== semaine.annee || t.semaineDepart.semaine !== semaine.semaine,
  )
  if (horsSemaine.length > 0)
    throw new ConflictError('Ces trains ne partent pas la semaine choisie.', {
      code: 'COO_TRAIN_AUTRE_SEMAINE',
      regle: 'RG-COO-228',
      details: { trains: horsSemaine.map((t) => t.trainId) },
    })
  const max = await lireParametreNombre(tx, 'trains.tiroirsMax')
  const tiroirs = new Set(trains.flatMap(visuelsDe)).size
  if (tiroirs > max)
    throw new BusinessError(
      `${String(tiroirs)} tiroirs : la Vendôme en a ${String(max)}. Retirez des trains (bloquant).`,
      { code: 'COO_TIROIRS_DEPASSES', regle: 'RG-COO-216', details: { tiroirs, max } },
    )
  return ecrireLot(tx, identity, { trains, semaine, tiroirs, complementDe: null, maintenant })
}

// ECR-GEN-03 / RG-COO-217 : « Envoyer à la machine » : le lot passe « Envoyé à la machine » (version +1) et le fichier
// est remis au port. AUDIT COO-P10 B2 : l'envoi NE MODIFIE PAS les faces. Selon RG-COO-217 et la maquette GEN-03, c'est
// l'UNITÉ qui passe « En production » à l'envoi (RG-COO-299, COO-P11 ; création des unités : Q-265 ouverte) ; les
// faces ne passent « Au roulage » (10) que par l'action explicite « Au roulage », rouleur obligatoire (RG-COO-217).
// Les actions de production ne sont pas bloquées par l'export (Q-251) : l'envoi exige seulement des trains PRET dont
// la composition est celle du « Préparer » (B3, RG-COO-308). Question Q-194 ouverte (écart signalé par l'audit).
// Envoi par le port en DERNIER : un échec annule tout (transaction).
export async function envoyerGeneration(
  tx: Tx,
  identity: Identity,
  input: EnvoyerGeneration,
  machine: MachinePort,
  maintenant = new Date(),
): Promise<Generation> {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-215')
  const lot = await tx.generationFichiers.findUnique({ where: { id: input.id } })
  if (!lot) throw new NotFoundError(`Génération ${String(input.id)} introuvable`)
  if (lot.version !== input.version)
    throw new ConflictError(
      'Cette génération a été modifiée par un autre utilisateur : rechargez la page.',
      {
        ...COO.version,
        regle: 'RG-COO-308',
      },
    )
  if (lot.statut !== 'PREPARE')
    throw new ConflictError('Ce lot a déjà été envoyé à la machine.', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-307',
    })
  const ids = JSON.parse(lot.trains) as string[]
  const versionsPreparees = JSON.parse(lot.versionsTrains) as Record<string, string>
  // B3 : un train disparu (raccrochage / fractionnement qui change sa composition) ou dont la version a changé depuis
  // le « Préparer » rend le fichier périmé : 409, rien n'est écrit, rien n'est envoyé.
  const trainModifie = (trainId: string) =>
    new ConflictError(
      `Le train ${trainId} a été modifié depuis la préparation du fichier : préparez-le de nouveau.`,
      { code: 'COO_TRAIN_MODIFIE', regle: 'RG-COO-308', details: { trainId } },
    )
  let trains: TrainCalcule[]
  try {
    trains = (await chargerTrains(tx, identity, ids)).trains
  } catch (e) {
    if (e instanceof NotFoundError) throw trainModifie(e.message)
    throw e
  }
  for (const t of trains) {
    if (versionsPreparees[t.trainId] !== t.version) throw trainModifie(t.trainId)
    // RG-COO-074 : un complément corrige un train déjà « En production » (dernière minute) : EN_PROD est accepté.
    const statutsEnvoyables = lot.complementDeId === null ? ['PRET'] : ['PRET', 'EN_PROD']
    if (!statutsEnvoyables.includes(t.statut))
      throw new ConflictError(
        `Seuls les trains prêts (tous leurs visuels reçus) peuvent être envoyés à la machine : ${t.trainId}.`,
        {
          code: 'COO_TRAIN_NON_PRET',
          regle: 'RG-COO-208',
          details: { trains: [t.trainId] },
        },
      )
  }
  // B4 : revérifié à l'envoi (deux lots « Préparé » peuvent contenir le même train ; le 2e envoi est refusé).
  const dejaEnvoyer = await trainsDejaEnvoyes(tx, { annee: lot.depAnnee, semaine: lot.depSemaine })
  const dejaEnvoyes = trains
    .filter((t) => dejaEnvoyer.has(`${t.trainId}|${t.version}`))
    .map((t) => ({ trainId: t.trainId, lot: dejaEnvoyer.get(`${t.trainId}|${t.version}`) ?? '' }))
  if (dejaEnvoyes.length > 0) throw dejaEnvoyeErreur(dejaEnvoyes)
  const simule = machine instanceof MachineSimulee
  await updateWithVersion({
    expectedVersion: lot.version,
    update: (where) =>
      tx.generationFichiers.updateMany({
        where: { id: lot.id, ...where },
        data: {
          statut: 'ENVOYE',
          envoyeLe: maintenant,
          envoyeParId: identity.userId,
          machineEnvoi: machine.nom,
          ...bumpVersion,
        },
      }),
    ...COO.version,
    regle: 'RG-COO-308',
  })
  await ecrireJournal(tx, {
    typeEntite: 'GENERATION_FICHIERS',
    entiteId: lot.id,
    action: 'ENVOI_MACHINE',
    parId: identity.userId,
    ancienneValeur: 'PREPARE',
    nouvelleValeur: `ENVOYE (machine « ${machine.nom} »${simule ? ', envoi simulé, D-15' : ''})`,
    complement: 'RG-COO-217',
  })
  // HYPOTHÈSE Q-193 (14) : le dépôt à la machine est la DERNIÈRE opération de la transaction, après toutes les
  // écritures : si une écriture échoue, rien n'est envoyé ; si le dépôt échoue, tout est annulé. Reste le risque
  // résiduel d'un échec de validation de la transaction après un dépôt réussi : le lot (`lot.lot`) identifie le
  // fichier pour que la machine écarte un doublon ; une vraie reprise (boîte d'envoi) relève de D-15.
  try {
    await machine.envoyer({ lot: lot.lot, nomFichier: lot.nomFichier, contenu: lot.contenu })
  } catch (e) {
    throw new BusinessError(
      `Envoi à la machine impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
      { code: 'COO_ENVOI_MACHINE_ECHEC', regle: 'RG-COO-217' },
    )
  }
  return {
    id: lot.id,
    lot: lot.lot,
    nomFichier: lot.nomFichier,
    contenu: lot.contenu,
    trains: lot.nbTrains,
    tiroirs: lot.nbTiroirs,
    statut: 'ENVOYE',
    version: lot.version + 1,
    machine: machine.nom,
    message: `${lot.lot} envoyé à la machine « ${machine.nom} »${simule ? ' (envoi simulé, D-15 : aucun fichier n’a quitté Circé)' : ''} : ${String(trains.length)} train(s). Les faces gardent leur statut (« Au roulage » exige un rouleur, RG-COO-217).`,
  }
}

/** Contenu d'un lot de génération (téléchargement, GEN-03). */
export async function fichierGeneration(db: Db, identity: Identity, id: number) {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-215')
  const lot = await db.generationFichiers.findUnique({ where: { id } })
  if (!lot) throw new NotFoundError(`Génération ${String(id)} introuvable`)
  // RG-COO-167 : 403 si le lot sort du périmètre.
  const autorises = new Set((await ateliersDuPerimetre(db, identity)).map((a) => a.id))
  if (!lotDansPerimetre(lot.ateIds, autorises, identity))
    throw new ForbiddenError("Cette génération n'est pas dans votre périmètre.", COO.perimetre)
  return { nomFichier: lot.nomFichier, contenu: lot.contenu }
}

// ECR-GEN-03 « Générer un complément » (alerte DM_FICHIER, RG-COO-074) : nouveau lot « Préparé » qui ne contient QUE les
// trains d'un lot déjà envoyé modifiés depuis (D-15, HYPOTHÈSES Q-411). Le lot d'origine est verrouillé (version +1) :
// deux compléments simultanés du même état sont refusés (409). Le complément s'envoie comme un lot normal.
export async function genererComplement(
  tx: Tx,
  identity: Identity,
  input: ComplementGeneration,
  maintenant = new Date(),
): Promise<Generation> {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-074')
  const origine = await tx.generationFichiers.findUnique({ where: { id: input.id } })
  if (!origine) throw new NotFoundError(`Génération ${String(input.id)} introuvable`)
  // RG-COO-167 : 403 si le lot sort du périmètre.
  const ateliers = await ateliersDuPerimetre(tx, identity)
  const autorises = new Set(ateliers.map((a) => a.id))
  if (!lotDansPerimetre(origine.ateIds, autorises, identity))
    throw new ForbiddenError("Cette génération n'est pas dans votre périmètre.", COO.perimetre)
  if (origine.version !== input.version)
    throw new ConflictError(
      'Cette génération a été modifiée par un autre utilisateur : rechargez la page.',
      { ...COO.version, regle: 'RG-COO-308' },
    )
  // RG-COO-074 : seul un fichier déjà envoyé à la machine peut recevoir un complément.
  if (origine.statut !== 'ENVOYE')
    throw new ConflictError('Seul un lot déjà envoyé à la machine peut recevoir un complément.', {
      code: 'COO_COMPLEMENT_LOT_NON_ENVOYE',
      regle: 'RG-COO-074',
    })
  const modifies = (await trainsModifiesDesLots(tx, ateliers, [origine])).get(origine.id) ?? []
  // Un train disparu (plus aucune face) ne peut pas être produit : il est ignoré.
  const trains = await construireTrains(
    tx,
    await facesDesTrains(tx, ateliers, { trainIds: modifies }),
    ateliers,
  )
  if (trains.length === 0)
    throw new BusinessError('Aucune unité modifiée depuis cette génération : rien à compléter.', {
      code: 'COO_COMPLEMENT_VIDE',
      regle: 'RG-COO-074',
    })
  const nonProductibles = trains.filter((t) => t.statut === 'EN_ATTENTE')
  if (nonProductibles.length > 0)
    throw new ConflictError(
      `Ces trains attendent encore des affiches : ${nonProductibles.map((t) => t.trainId).join(', ')}.`,
      {
        code: 'COO_TRAIN_NON_PRET',
        regle: 'RG-COO-208',
        details: { trains: nonProductibles.map((t) => t.trainId) },
      },
    )
  const max = await lireParametreNombre(tx, 'trains.tiroirsMax')
  const tiroirs = new Set(trains.flatMap(visuelsDe)).size
  if (tiroirs > max)
    throw new BusinessError(
      `${String(tiroirs)} tiroirs : la Vendôme en a ${String(max)}. Retirez des trains (bloquant).`,
      { code: 'COO_TIROIRS_DEPASSES', regle: 'RG-COO-216', details: { tiroirs, max } },
    )
  await updateWithVersion({
    expectedVersion: origine.version,
    update: (where) =>
      tx.generationFichiers.updateMany({
        where: { id: origine.id, ...where },
        data: { ...bumpVersion },
      }),
    ...COO.version,
    regle: 'RG-COO-308',
  })
  const semaine = { annee: origine.depAnnee, semaine: origine.depSemaine }
  return ecrireLot(tx, identity, {
    trains,
    semaine,
    tiroirs,
    complementDe: { id: origine.id, lot: origine.lot },
    maintenant,
  })
}

// ECR-GEN-03 « Liste de picking » d'un lot (Tiroir, Annonceur, Thème, Quantité, Emplacement) : un tiroir par visuel
// distinct du lot (positions fractionnées exclues, ordre d'apparition dans les trains), une ligne par affiche rattachée
// (quantité et emplacement), triées par tiroir. Lecture seule, HYPOTHÈSE Q-195 (quantité rattachée) et Q-411.
export async function pickingGeneration(
  db: Db,
  identity: Identity,
  id: number,
): Promise<PickingGeneration> {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-215')
  const lot = await db.generationFichiers.findUnique({ where: { id } })
  if (!lot) throw new NotFoundError(`Génération ${String(id)} introuvable`)
  const ateliers = await ateliersDuPerimetre(db, identity)
  if (!lotDansPerimetre(lot.ateIds, new Set(ateliers.map((a) => a.id)), identity))
    throw new ForbiddenError("Cette génération n'est pas dans votre périmètre.", COO.perimetre)
  const faces = await facesDesTrains(db, ateliers, { trainIds: JSON.parse(lot.trains) as string[] })
  const trains = await construireTrains(db, faces, ateliers)
  const visuels = new Map<
    string,
    { contNum: number; annonceur: string | null; theme: string | null }
  >()
  const tiroirDe = new Map<string, number>()
  for (const t of trains) {
    const plateformeId = t.atelier?.plateformeId ?? 0
    for (const p of t.positions) {
      if (p.etat === 'FRACTIONNE' || p.contNum === null) continue
      const cle = cleVisuel(plateformeId, p.contNum, p.theme)
      if (!visuels.has(cle)) {
        visuels.set(cle, { contNum: p.contNum, annonceur: p.annonceur, theme: p.theme })
        tiroirDe.set(cle, tiroirDe.size + 1)
      }
    }
  }
  const lignes: PickingGeneration['lignes'] = []
  const avecAffiche = new Set<string>()
  for (const l of await affichesDesVisuels(db, visuels)) {
    avecAffiche.add(l.cle)
    lignes.push({
      tiroir: tiroirDe.get(l.cle) ?? 0,
      annonceur: l.visuel.annonceur,
      theme: l.visuel.theme,
      quantite: l.quantite,
      emplacement: l.emplacement,
    })
  }
  for (const [cle, v] of visuels)
    if (!avecAffiche.has(cle))
      lignes.push({
        tiroir: tiroirDe.get(cle) ?? 0,
        annonceur: v.annonceur,
        theme: v.theme,
        quantite: null,
        emplacement: null,
      })
  lignes.sort(
    (a, b) => a.tiroir - b.tiroir || (a.emplacement ?? '￿').localeCompare(b.emplacement ?? '￿'),
  )
  return { lot: lot.lot, lignes }
}
