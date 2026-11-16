// COO-P10 — export des trains du jeudi (RG-COO-210 à 213), export préparation (RG-COO-215, 216), « Au roulage »
// et suppression d'un thème de l'export (RG-COO-217), rouleur (RG-COO-236). Le fichier est SIMULÉ (Q-193, D-15).
// Source : docs/COORDINATION_REGLES_METIER.md RG-COO-210 à 217, 236 ; legacy PreparationDeroulantsService.cs,
// TrainPreparationBll.cs ; hypothèses Q-193 (cette session), Q-251 à Q-254.
import {
  formatSemaineIso,
  lireSemaineIso,
  type AffecterRouleur,
  type AuRoulage,
  type ExportApercu,
  type ExporterTrains,
  type ExportPreparation,
  type ExportResultat,
  type SupprimerThemeExport,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { assertTransition } from '../../core/state-machine.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { FaceTrain } from '../../generated/prisma/client.ts'
import { lireParametreNombre, lireParametreTexte } from '../reception/parametres.ts'
import { contenuCsv, horodatage, type TrainExporte } from './export-csv.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import { TRANSITIONS_INSTRUCTION_EXPORT } from './statuts-trains.ts'
import {
  ateIdsDeFaces,
  ateliersDuPerimetre,
  chargerTrains,
  cleTheme,
  ecrireFace,
  enProduction,
  MESSAGE_NON_RETOUR,
  lotDansPerimetre,
  parPaquets,
  lotsVisibles,
  verifierVersions,
} from './trains.ts'

type Client = Db | Tx

/**
 * Audit COO-P10 B1 (Q-193 (1), D-15) : TOUT fichier produit ici est SIMULÉ : enregistré en base et téléchargeable,
 * jamais déposé ni transmis à Surf. Le nom du fichier porte ce marquage pour qu'il ne passe jamais pour un fichier
 * réel (une ligne « # SIMULATION » casserait le format CSV de la cible, contrairement au générateur Vendôme).
 */
export const SUFFIXE_FICHIER_SIMULE = '_SIMULE'
export const AVERTISSEMENT_FICHIER_SIMULE =
  'Fichier SIMULÉ : enregistré dans Circé et téléchargeable, non déposé ni transmis à Surf (D-15).'

export const STATUT_CODE: Record<string, number> = {
  INSTRUCTION_OK: 2,
  A_IMPRIMER: 5,
  EXPORT_PREPA: 9,
  AU_ROULAGE: 10,
}

// ───────────────────────────── Export des trains du jeudi ─────────────────────────────

/** Faces « Instruction ok » de la semaine de départ qui peuvent partir (RG-COO-210 / 211). */
async function facesExportables(db: Client, identity: Identity, depart: string) {
  const s = lireSemaineIso(depart)
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.type === 'SCROLL')
  const faces = (
    await parPaquets(
      ateliers.map((a) => a.id),
      (paquet) =>
        db.faceTrain.findMany({
          where: {
            atelierId: { in: paquet },
            depAnbas: s.annee,
            depSembas: s.semaine,
            trainId: { not: null },
            statut: 'INSTRUCTION_OK',
          },
        }),
    )
  ).sort(
    (a, b) =>
      (a.trainId ?? '').localeCompare(b.trainId ?? '') ||
      (a.ordreReel ?? 0) - (b.ordreReel ?? 0) ||
      a.id - b.id,
  )
  const instructions = await parPaquets(
    [...new Set(faces.map((f) => f.instructionCode))],
    (paquet) =>
      db.instruction.findMany({
        where: { code: { in: paquet } },
        include: {
          dossier: { select: { id: true, contNum: true, annonceur: true, statut: true } },
        },
      }),
  )
  // RG-COO-211 : Instruction OK AUTO ou MANUEL, dossier non annulé dont la préparation est reçue. L'export ne dépend
  // NI de la validation admin NI de la réception complète (RG-X-083).
  const partantes = new Map(
    instructions
      .filter(
        (i) =>
          i.statut === 'INSTRUCTION_OK' &&
          (i.iokMode === 'AUTO' || i.iokMode === 'MANUEL') &&
          i.dossier !== null &&
          i.dossier.statut === 'PREPARATION_RECUE',
      )
      .map((i) => [i.code, i]),
  )
  return {
    semaine: s,
    ateliers,
    faces: faces.filter((f) => partantes.has(f.instructionCode)),
    instructions: [...partantes.values()],
  }
}

// RG-COO-211 : aperçu de la modale « Exporter les trains · départ Sxx ».
export async function apercuExport(
  db: Db,
  identity: Identity,
  depart: string,
): Promise<ExportApercu> {
  assertDroitCoordination(identity, 'train.exporter', 'RG-COO-212')
  const { semaine, ateliers, faces, instructions } = await facesExportables(db, identity, depart)
  const idsAteliers = ateliers.map((a) => a.id)
  const dejaExportes = [
    ...new Map(
      (
        await parPaquets(idsAteliers, (paquet) =>
          db.faceTrain.findMany({
            where: {
              atelierId: { in: paquet },
              depAnbas: semaine.annee,
              depSembas: semaine.semaine,
              trainId: { not: null },
              statut: { in: ['A_IMPRIMER', 'EXPORT_PREPA', 'AU_ROULAGE'] },
              instruction: { statut: 'PRET_A_PRODUIRE' },
            },
            select: { contNum: true },
            distinct: ['contNum'],
          }),
        )
      ).map((f) => [f.contNum, f]),
    ).values(),
  ]
  const enCours = [
    ...new Map(
      (
        await parPaquets(idsAteliers, (paquet) =>
          db.faceTrain.findMany({
            where: {
              atelierId: { in: paquet },
              depAnbas: semaine.annee,
              depSembas: semaine.semaine,
              statut: { in: ['A_TRAITER', 'EN_COURS', 'ERREUR'] },
            },
            select: { contNum: true, contAnnonc: true },
            distinct: ['contNum'],
          }),
        )
      ).map((f) => [f.contNum, f]),
    ).values(),
  ].sort((a, b) => (a.contNum ?? 0) - (b.contNum ?? 0))
  return {
    depart: formatSemaineIso(semaine),
    dossiersExportables: new Set(instructions.map((i) => i.dossier?.contNum)).size,
    dejaExportes: dejaExportes.length,
    dossiersEnCours: enCours
      .filter((f) => f.contNum !== null)
      .map((f) => ({ dossier: f.contNum ?? 0, annonceur: f.contAnnonc })),
    faces: faces.length,
    trains: new Set(faces.map((f) => f.trainId)).size,
  }
}

interface ContexteCsv {
  formats: Map<number, string>
  destinataires: Map<number, string>
  rouleurs: Map<number, string>
  ateliersExportPrepa: Set<number>
}

const LETTRES_POSITION = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export async function contexteCsv(db: Client, faces: readonly FaceTrain[]): Promise<ContexteCsv> {
  const supports = await parPaquets([...new Set(faces.map((f) => f.supportId ?? 0))], (paquet) =>
    db.categorieSupport.findMany({
      where: { id: { in: paquet } },
      select: { id: true, nom: true },
    }),
  )
  const dests = await parPaquets([...new Set(faces.map((f) => f.destinataireId ?? 0))], (paquet) =>
    db.destinataire.findMany({
      where: { id: { in: paquet } },
      select: { id: true, nom: true, nomOrigine: true },
    }),
  )
  const rouleurs = await parPaquets([...new Set(faces.map((f) => f.rouleurId ?? 0))], (paquet) =>
    db.rouleur.findMany({
      where: { id: { in: paquet } },
      select: { id: true, nom: true },
    }),
  )
  return {
    formats: new Map(supports.map((x) => [x.id, x.nom])),
    // Legacy `te.Section = DestNomOri` (PreparationDeroulantsService.cs:418) : nom d'origine du destinataire.
    destinataires: new Map(dests.map((d) => [d.id, d.nomOrigine])),
    rouleurs: new Map(rouleurs.map((r) => [r.id, r.nom])),
    ateliersExportPrepa: await ateliersExportPrepa(db),
  }
}

/** RG-COO-215 : ateliers autorisés à l'export préparation (paramètre ; legacy 5 et 6). */
export async function ateliersExportPrepa(db: Client): Promise<Set<number>> {
  return new Set(
    (await lireParametreTexte(db, 'trains.ateliersExportPrepa'))
      .split(';')
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x) && x > 0),
  )
}

/** Trains du fichier : une ligne par train, contrats dans l'ordre des faces (RG-COO-213). */
export function trainsExportes(
  faces: readonly FaceTrain[],
  ctx: ContexteCsv,
  statutFichier: (f: FaceTrain) => number,
): TrainExporte[] {
  const parTrain = new Map<string, FaceTrain[]>()
  for (const f of faces)
    parTrain.set(f.trainId ?? '', [...(parTrain.get(f.trainId ?? '') ?? []), f])
  return [...parTrain].map(([trainId, faces]) => {
    // RG-COO-213 : lettre de la position = rang de la face dans le train (ordre réel, comme RG-COO-228).
    const fs = [...faces].sort((a, b) => (a.ordreReel ?? 0) - (b.ordreReel ?? 0) || a.id - b.id)
    const premiere = fs[0] as FaceTrain
    return {
      trainId,
      statut: statutFichier(premiere),
      format: ctx.formats.get(premiere.supportId ?? 0) ?? null,
      origine:
        premiere.origineTrain ??
        (fs.every((f) => f.ftType === 'entretien') ? 'ENTRETIEN' : 'CALCULE'),
      afficheur: premiere.afficheurNom,
      destinataire: ctx.destinataires.get(premiere.destinataireId ?? 0) ?? null,
      adresse1: premiere.emplAdresse1,
      depart: fs.reduce((d, f) => (f.dateDepart < d ? f.dateDepart : d), premiere.dateDepart),
      deuxM2: ctx.ateliersExportPrepa.has(premiere.atelierId ?? 0),
      contrats: fs.map((f, i) => ({
        contrat: f.contNum,
        annonceur: f.contAnnonc,
        theme: f.theme,
        repiquage: f.repiquage,
        lettre: LETTRES_POSITION[i] ?? String(i + 1),
        rouleur: f.rouleurId === null ? null : (ctx.rouleurs.get(f.rouleurId) ?? null),
      })),
    }
  })
}

// RG-COO-210 à 213 : export des trains (réel) ou simulation (aucun statut modifié). Une seule transaction :
// faces 2 → 5, instructions 2 → 5, lot d'export, lignes tf_train_export, historique `ExporterTrains` ; une erreur
// d'export est remontée (422) sans aucun changement de statut.
export async function exporterTrains(
  tx: Tx,
  identity: Identity,
  input: ExporterTrains,
  maintenant = new Date(),
): Promise<ExportResultat> {
  // RG-COO-212 : réservé à la Coordination (HYPOTHÈSE Q-252 : aucun blocage horaire côté serveur).
  assertDroitCoordination(identity, 'train.exporter', 'RG-COO-212')
  const { semaine, faces, instructions } = await facesExportables(tx, identity, input.depart)
  const dossiers = new Set(instructions.map((i) => i.dossier?.contNum))
  // RG-COO-210 / 211 : au moins un dossier exportable.
  if (faces.length === 0 || dossiers.size === 0)
    throw new BusinessError(
      'Aucun dossier à exporter : rien n’est en Instruction OK pour ce départ.',
      {
        code: 'COO_RIEN_A_EXPORTER',
        regle: 'RG-COO-211',
      },
    )
  const contratsMax = await lireParametreNombre(tx, 'trains.positionsMax')
  const ctx = await contexteCsv(tx, faces)
  const trains = trainsExportes(faces, ctx, () => STATUT_CODE.INSTRUCTION_OK ?? 2)
  // RG-COO-213 / Q-253 : au-delà de 6 contrats par train, erreur d'export explicite (legacy : « Train supérieur à 6
  // pour le TrainId » seulement tracé) ; aucun statut modifié.
  const trop = trains.filter((t) => t.contrats.length > contratsMax).map((t) => t.trainId)
  if (trop.length > 0)
    throw new BusinessError(
      `Export impossible : train supérieur à ${String(contratsMax)} contrats (${trop.join(', ')}).`,
      { code: 'COO_TRAIN_SUPERIEUR_A_6', regle: 'RG-COO-213', details: { trains: trop } },
    )
  const prefixe = input.simulation
    ? 'SimulationExportTrainsCIRCEversSurf'
    : 'ExportTrainsCIRCEversSurf'
  const nomFichier = `${prefixe}${horodatage(maintenant)}${SUFFIXE_FICHIER_SIMULE}.csv`
  const contenu = contenuCsv(trains, contratsMax)
  const lot = await tx.exportTrains.create({
    data: {
      fichierSimule: true,
      depAnnee: semaine.annee,
      depSemaine: semaine.semaine,
      nature: 'EXPORT_TRAINS',
      simulation: input.simulation,
      nomFichier,
      contenu,
      nbDossiers: dossiers.size,
      nbTrains: trains.length,
      nbFaces: faces.length,
      parId: identity.userId,
      le: maintenant,
      ateIds: ateIdsDeFaces(faces),
    },
  })
  const departTexte = formatSemaineIso(semaine)
  if (input.simulation) {
    // « Simulation export » : même fichier, aucun statut, aucune ligne tf_train_export.
    await ecrireJournal(tx, {
      typeEntite: 'EXPORT_TRAINS',
      entiteId: lot.id,
      action: 'SIMULATION_EXPORT_TRAINS',
      parId: identity.userId,
      nouvelleValeur: `Simulation d'export, départ ${departTexte} : ${String(dossiers.size)} dossier(s), ${String(trains.length)} train(s) (fichier simulé, non déposé, D-15).`,
      complement: 'RG-COO-213',
    })
  } else {
    for (const t of trains)
      await tx.exportTrainLigne.create({
        data: {
          exportId: lot.id,
          trainId: t.trainId,
          atelierId: faces.find((f) => f.trainId === t.trainId)?.atelierId ?? null,
          afficheur: t.afficheur,
          destinataire: t.destinataire,
          nbContrats: t.contrats.length,
          contrats: JSON.stringify(t.contrats),
        },
      })
    for (const f of faces)
      await ecrireFace(
        tx,
        f,
        {},
        { vers: 'A_IMPRIMER', parId: identity.userId, regle: 'RG-COO-210' },
      )
    for (const i of instructions) {
      assertTransition(TRANSITIONS_INSTRUCTION_EXPORT, i.statut, 'PRET_A_PRODUIRE', {
        regle: 'RG-COO-210',
      })
      await updateWithVersion({
        expectedVersion: i.version,
        update: (where) =>
          tx.instruction.updateMany({
            where: { code: i.code, ...where },
            data: {
              statut: 'PRET_A_PRODUIRE',
              exporteLe: maintenant,
              exporteParId: identity.userId,
              updatedById: identity.userId,
              ...bumpVersion,
            },
          }),
        ...COO.version,
      })
      await ecrireHistoriqueStatut(tx, {
        typeEntite: 'INSTRUCTION',
        entiteId: i.code,
        ancien: i.statut,
        nouveau: 'PRET_A_PRODUIRE',
        parId: identity.userId,
        regle: 'RG-COO-210',
      })
    }
    await ecrireJournal(tx, {
      typeEntite: 'EXPORT_TRAINS',
      entiteId: lot.id,
      action: 'EXPORTER_TRAINS',
      parId: identity.userId,
      nouvelleValeur: `Export des trains, départ ${departTexte} : ${String(dossiers.size)} dossier(s), ${String(trains.length)} train(s), ${String(faces.length)} face(s) (fichier simulé, non déposé, D-15).`,
      complement: 'RG-COO-213',
    })
    // RG-COO-211 : marquage « exporté » (date, utilisateur) sur chaque dossier exporté.
    for (const i of instructions)
      await ecrireJournal(tx, {
        typeEntite: 'DOSSIER',
        entiteId: i.dossier?.id ?? 0,
        action: 'EXPORTER_TRAINS',
        parId: identity.userId,
        nouvelleValeur: `Dossier exporté (départ ${departTexte}, instruction ${i.code}).`,
        complement: 'RG-COO-211',
      })
  }
  return {
    lot: lot.id,
    simulation: input.simulation,
    nomFichier,
    contenu,
    dossiers: dossiers.size,
    trains: trains.length,
    faces: faces.length,
    fichierSimule: true,
    message: input.simulation
      ? `Simulation d'export : ${String(dossiers.size)} dossier(s), ${String(trains.length)} train(s), aucun statut modifié. ${AVERTISSEMENT_FICHIER_SIMULE}`
      : `${String(dossiers.size)} dossier(s) exporté(s) : leurs ${String(faces.length)} face(s) passent « A imprimer », le go des plateformes. ${AVERTISSEMENT_FICHIER_SIMULE}`,
  }
}

// RG-COO-213 : historique des exports (ExporterTrains), du plus récent au plus ancien. RG-COO-167 : seuls les lots
// dont tous les ateliers sont dans le périmètre de l'utilisateur sont listés (lecture par paquets, audit m6).
export async function historiqueExports(db: Db, identity: Identity, depart?: string) {
  assertDroitCoordination(identity, 'train.exporter', 'RG-COO-212')
  const s = depart ? lireSemaineIso(depart) : null
  const autorises = new Set((await ateliersDuPerimetre(db, identity)).map((a) => a.id))
  const lots = await lotsVisibles(
    (avantId, taille) =>
      db.exportTrains.findMany({
        where: {
          ...(s ? { depAnnee: s.annee, depSemaine: s.semaine } : {}),
          ...(avantId === null ? {} : { id: { lt: avantId } }),
        },
        orderBy: { id: 'desc' },
        take: taille,
      }),
    autorises,
    identity,
    100,
  )
  const par = new Map(
    (
      await db.utilisateur.findMany({
        where: { id: { in: [...new Set(lots.map((l) => l.parId))] } },
        select: { id: true, nom: true, identifiantExterne: true },
      })
    ).map((u) => [u.id, u.nom ?? u.identifiantExterne]),
  )
  return {
    exports: lots.map((l) => ({
      id: l.id,
      nature: l.nature,
      simulation: l.simulation,
      fichierSimule: l.fichierSimule,
      depart: formatSemaineIso({ annee: l.depAnnee, semaine: l.depSemaine }),
      nomFichier: l.nomFichier,
      dossiers: l.nbDossiers,
      trains: l.nbTrains,
      faces: l.nbFaces,
      par: par.get(l.parId) ?? null,
      le: l.le.toISOString(),
    })),
  }
}

/** Fichier d'un lot d'export (téléchargement) : RG-COO-167, 403 si le lot sort du périmètre. */
export async function fichierExport(db: Db, identity: Identity, id: number) {
  assertDroitCoordination(identity, 'train.exporter', 'RG-COO-212')
  const lot = await db.exportTrains.findUnique({ where: { id } })
  if (!lot) throw new NotFoundError(`Export ${String(id)} introuvable`)
  const autorises = new Set((await ateliersDuPerimetre(db, identity)).map((a) => a.id))
  if (!lotDansPerimetre(lot.ateIds, autorises, identity))
    throw new ForbiddenError("Cet export n'est pas dans votre périmètre.", COO.perimetre)
  return { nomFichier: lot.nomFichier, contenu: lot.contenu }
}

// ───────────────────────────── Export préparation, Au roulage ─────────────────────────────

const MESSAGE_PAS_A_IMPRIMER = "Les faces des trains ne sont pas dans le statut 'A imprimer' !"

// RG-COO-215 / 216 : export préparation (2 m² : ateliers autorisés par paramètre, legacy 5 et 6). Faces « A imprimer »
// ou « Export prépa » → « Export prépa » ; plafond de couples (thème, repiquage) contrôlé A PRIORI (Q-254) : refus
// sans aucune modification. Fichier Caire (simulé) enregistré.
export async function exportPreparation(
  tx: Tx,
  identity: Identity,
  input: ExportPreparation,
  maintenant = new Date(),
): Promise<ExportResultat> {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-215')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const autorises = await ateliersExportPrepa(tx)
  const faces = trains.flatMap((t) => t.faces)
  const interdit = faces.find((f) => !autorises.has(f.atelierId ?? 0))
  if (interdit)
    throw new BusinessError(
      'L’export préparation n’est autorisé que pour les ateliers de 2 m² (Wissous et Nîmes).',
      {
        code: 'COO_EXPORT_PREPA_INTERDIT',
        regle: 'RG-COO-215',
        details: { trainId: interdit.trainId },
      },
    )
  if (faces.some((f) => f.statut !== 'A_IMPRIMER' && f.statut !== 'EXPORT_PREPA'))
    throw new ConflictError(MESSAGE_PAS_A_IMPRIMER, {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-215',
    })
  // Audit COO-P10 m9 (HYPOTHÈSE Q-193 (16)) : un lot d'export préparation ne porte qu'UNE semaine de départ (le lot
  // n'enregistre qu'une semaine) ; une sélection à cheval sur plusieurs semaines est refusée sans aucun changement.
  const semainesFaces = new Set(faces.map((f) => `${String(f.depAnbas)}-${String(f.depSembas)}`))
  if (semainesFaces.size > 1)
    throw new BusinessError(
      'L’export préparation ne porte que sur une semaine de départ : choisissez les trains d’une seule semaine.',
      {
        code: 'COO_EXPORT_PREPA_MULTI_SEMAINES',
        regle: 'RG-COO-215',
        details: { semaines: [...semainesFaces] },
      },
    )
  // RG-COO-216 : couples (thème, repiquage) distincts des faces déjà à 9 + les nouvelles, par atelier et semaine.
  const max = await lireParametreNombre(tx, 'trains.themesMaxExportPrepa')
  const atelierIds = [...new Set(faces.map((f) => f.atelierId ?? 0))]
  for (const atelierId of atelierIds) {
    const choisies = faces.filter((f) => f.atelierId === atelierId)
    const semaines = [
      ...new Set(choisies.map((f) => `${String(f.depAnbas)}-${String(f.depSembas)}`)),
    ]
    for (const sem of semaines) {
      const [an, sm] = sem.split('-').map(Number)
      const dejaA9 = await tx.faceTrain.findMany({
        where: { atelierId, depAnbas: an ?? 0, depSembas: sm ?? 0, statut: 'EXPORT_PREPA' },
      })
      const couples = new Set(
        [
          ...dejaA9,
          ...choisies.filter((f) => `${String(f.depAnbas)}-${String(f.depSembas)}` === sem),
        ].map((f) => `${cleTheme(f.theme)}|${cleTheme(f.repiquage)}`),
      )
      if (couples.size > max)
        throw new BusinessError(
          'Le nombre de thèmes ajouté est supérieur à la capacité de la machine !',
          {
            code: 'COO_THEMES_SUPERIEUR_CAPACITE',
            regle: 'RG-COO-216',
            details: { themes: couples.size, max },
          },
        )
    }
  }
  const contratsMax = await lireParametreNombre(tx, 'trains.positionsMax')
  const ctx = await contexteCsv(tx, faces)
  const exportes = trainsExportes(faces, ctx, () => STATUT_CODE.EXPORT_PREPA ?? 9)
  const trop = exportes.filter((t) => t.contrats.length > contratsMax).map((t) => t.trainId)
  if (trop.length > 0)
    throw new BusinessError(
      `Export impossible : train supérieur à ${String(contratsMax)} contrats (${trop.join(', ')}).`,
      { code: 'COO_TRAIN_SUPERIEUR_A_6', regle: 'RG-COO-213', details: { trains: trop } },
    )
  let n = 0
  for (const f of faces) {
    if (f.statut === 'EXPORT_PREPA') continue
    await ecrireFace(
      tx,
      f,
      {},
      { vers: 'EXPORT_PREPA', parId: identity.userId, regle: 'RG-COO-215' },
    )
    n++
  }
  const nomFichier = `ExportPrepaTrainsCIRCE${horodatage(maintenant)}${SUFFIXE_FICHIER_SIMULE}.csv`
  const contenu = contenuCsv(exportes, contratsMax)
  const premiere = faces[0] as FaceTrain
  const lot = await tx.exportTrains.create({
    data: {
      depAnnee: premiere.depAnbas ?? 0,
      depSemaine: premiere.depSembas ?? 0,
      nature: 'EXPORT_PREPARATION',
      simulation: false,
      fichierSimule: true,
      nomFichier,
      contenu,
      nbDossiers: new Set(faces.map((f) => f.contNum)).size,
      nbTrains: trains.length,
      nbFaces: faces.length,
      parId: identity.userId,
      le: maintenant,
      ateIds: ateIdsDeFaces(faces),
    },
  })
  await ecrireJournal(tx, {
    typeEntite: 'EXPORT_TRAINS',
    entiteId: lot.id,
    action: 'EXPORT_PREPARATION',
    parId: identity.userId,
    nouvelleValeur: `Export préparation : ${String(trains.length)} train(s), ${String(faces.length)} face(s) (fichier simulé, non déposé, D-15).`,
    complement: 'RG-COO-215',
  })
  for (const t of trains)
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: t.trainId,
      action: 'EXPORT_PREPARATION',
      parId: identity.userId,
      ancienneValeur: t.statut,
      nouvelleValeur: 'EXPORT_PREPA',
      complement: 'RG-COO-215',
    })
  return {
    lot: lot.id,
    simulation: false,
    nomFichier,
    contenu,
    dossiers: new Set(faces.map((f) => f.contNum)).size,
    trains: trains.length,
    faces: faces.length,
    fichierSimule: true,
    message: `${String(n)} face(s) passée(s) « Export prépa » (${String(trains.length)} train(s)). ${AVERTISSEMENT_FICHIER_SIMULE}`,
  }
}

/** RG-COO-217 : rouleur valide pour l'atelier (actif ; rattaché à l'atelier ou sans atelier). */
export async function rouleurValide(db: Client, rouleurId: number, atelierIds: readonly number[]) {
  const r = await db.rouleur.findUnique({ where: { id: rouleurId } })
  if (!r || (r.dateFin !== null && r.dateFin < new Date()))
    throw new NotFoundError('Rouleur introuvable ou inactif')
  if (r.atelierId !== null && atelierIds.some((a) => a !== r.atelierId))
    throw new BusinessError('Ce rouleur n’appartient pas à l’atelier de ces trains.', {
      code: 'COO_ROULEUR_AUTRE_ATELIER',
      regle: 'RG-COO-236',
    })
  return r
}

// RG-COO-217 : « Au roulage » : faces « Export prépa » (9) → « Au roulage » (10), rouleur obligatoire.
export async function auRoulage(tx: Tx, identity: Identity, input: AuRoulage) {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-217')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const faces = trains.flatMap((t) => t.faces)
  if (faces.some((f) => f.statut !== 'EXPORT_PREPA'))
    throw new ConflictError("Les faces des trains ne sont pas dans le statut 'Export prépa' !", {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-217',
    })
  const rouleur = await rouleurValide(tx, input.rouleurId, [
    ...new Set(faces.map((f) => f.atelierId ?? 0)),
  ])
  for (const f of faces)
    await ecrireFace(
      tx,
      f,
      { rouleurId: rouleur.id },
      { vers: 'AU_ROULAGE', parId: identity.userId, regle: 'RG-COO-217' },
    )
  for (const t of trains)
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: t.trainId,
      action: 'AU_ROULAGE',
      parId: identity.userId,
      ancienneValeur: 'EXPORT_PREPA',
      nouvelleValeur: `AU_ROULAGE (rouleur ${rouleur.nom})`,
      complement: 'RG-COO-217',
    })
  return {
    message: `${String(faces.length)} face(s) passée(s) « Au roulage » (rouleur ${rouleur.nom}).`,
    nombre: faces.length,
  }
}

// RG-COO-217 : suppression d'un thème de l'export préparation (`MiseAJourAImprimer`) : faces 9 → 5.
export async function supprimerThemeExport(
  tx: Tx,
  identity: Identity,
  input: SupprimerThemeExport,
) {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-217')
  const atelier = await tx.atelier.findUnique({ where: { id: input.atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  const s = lireSemaineIso(input.depart)
  const faces = (
    await tx.faceTrain.findMany({
      where: {
        atelierId: input.atelierId,
        depAnbas: s.annee,
        depSembas: s.semaine,
        contNum: input.contNum,
        trainId: { not: null },
        NOT: { statut: 'ANNULE' },
      },
    })
  ).filter((f) => cleTheme(f.theme) === cleTheme(input.theme))
  if (faces.length === 0)
    throw new ConflictError('Pas de données à traiter !', {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-217',
    })
  if (faces.some((f) => f.statut !== 'EXPORT_PREPA'))
    throw new ConflictError("Toutes les faces du theme ne sont pas dans le statut 'Export prépa'", {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-217',
    })
  for (const f of faces)
    await ecrireFace(tx, f, {}, { vers: 'A_IMPRIMER', parId: identity.userId, regle: 'RG-COO-217' })
  for (const trainId of new Set(faces.map((f) => f.trainId ?? '')))
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: trainId,
      action: 'SUPPRESSION_THEME_EXPORT',
      parId: identity.userId,
      nouvelleValeur: `Thème retiré de l'export préparation : ${String(input.contNum)} « ${input.theme} ».`,
      complement: 'RG-COO-217',
    })
  return {
    message: `Thème « ${input.theme} » retiré de l'export (${String(faces.length)} face(s) repassent « A imprimer »).`,
    nombre: faces.length,
  }
}

// ───────────────────────────── Rouleur ─────────────────────────────

// RG-COO-236 : opérateurs de l'atelier (modale « Rouleur de n ligne(s) de trains »).
export async function listerRouleurs(db: Db, identity: Identity, atelierId: number) {
  assertDroitCoordination(identity, 'train.consulter')
  const atelier = await db.atelier.findUnique({ where: { id: atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  const rouleurs = await db.rouleur.findMany({
    where: {
      OR: [{ atelierId }, { atelierId: null }],
      AND: [{ OR: [{ dateFin: null }, { dateFin: { gt: new Date() } }] }],
    },
    orderBy: { nom: 'asc' },
  })
  return { rouleurs: rouleurs.map((r) => ({ id: r.id, nom: r.nom, poste: r.poste })) }
}

// RG-COO-236 : « Affecter » écrit le rouleur sur les trains sélectionnés ; HYPOTHÈSE (Q-193) : pas de
// réaffectation d'un train déjà en production (point de non-retour, RG-COO-223) ; journal (qui, quand, ancien, nouveau).
export async function affecterRouleur(tx: Tx, identity: Identity, input: AffecterRouleur) {
  assertDroitCoordination(identity, 'roulage.preparer', 'RG-COO-236')
  const { trains } = await chargerTrains(
    tx,
    identity,
    input.trains.map((t) => t.trainId),
  )
  verifierVersions(trains, input.trains)
  const enProd = trains.find(enProduction)
  if (enProd)
    throw new ConflictError(MESSAGE_NON_RETOUR, {
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-COO-223',
      details: { trainId: enProd.trainId },
    })
  const rouleur = await rouleurValide(tx, input.rouleurId, [
    ...new Set(trains.flatMap((t) => t.faces.map((f) => f.atelierId ?? 0))),
  ])
  const anciens = new Map(
    (
      await parPaquets(
        [...new Set(trains.flatMap((t) => t.faces.map((f) => f.rouleurId ?? 0)))],
        (paquet) =>
          tx.rouleur.findMany({
            where: { id: { in: paquet } },
            select: { id: true, nom: true },
          }),
      )
    ).map((r) => [r.id, r.nom]),
  )
  for (const t of trains) {
    for (const f of t.faces)
      await updateWithVersion({
        expectedVersion: f.version,
        update: (where) =>
          tx.faceTrain.updateMany({
            where: { id: f.id, ...where },
            data: { rouleurId: rouleur.id, updatedById: identity.userId, ...bumpVersion },
          }),
        ...COO.version,
        regle: 'RG-COO-308',
      })
    await ecrireJournal(tx, {
      typeEntite: 'TRAIN',
      entiteId: t.trainId,
      action: 'AFFECTATION_ROULEUR',
      parId: identity.userId,
      ancienneValeur: anciens.get(t.faces[0]?.rouleurId ?? 0) ?? null,
      nouvelleValeur: rouleur.nom,
      complement: 'RG-COO-236',
    })
  }
  return {
    message: `Rouleur ${rouleur.nom} affecté à ${String(trains.length)} train(s).`,
    nombre: trains.length,
  }
}
