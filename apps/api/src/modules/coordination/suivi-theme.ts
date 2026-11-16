// COO-P10 — Suivi par thème (ECR-COO-06) : besoin, couvert, pré-assemblage (RG-COO-230 à 233).
// Source : docs/COORDINATION_REGLES_METIER.md RG-COO-230 à 233 ; legacy TrainSuiviThemeBll.cs:31-98, 442-485 ;
// hypothèses Q-262 (granularité du pré-assemblage), Q-263 (exclusions, périmètre), Q-193 (cette session).
import {
  lireSemaineIso,
  semaineIsoDe,
  type BesoinTheme,
  type BesoinThemeQuery,
  type LigneBesoin,
  type PreAssemblage,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { FaceTrain } from '../../generated/prisma/client.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import {
  ateliersDuPerimetre,
  cleTheme,
  cleVisuel,
  contient,
  couverture,
  facesDesTrains,
  construireTrains,
  versionTrain,
} from './trains.ts'

const STATUTS_PRODUCTION = ['EXPORT_PREPA', 'AU_ROULAGE', 'PREPARE', 'A_EXPEDIER', 'TERMINE']

/** Faces d'un thème (atelier, dossier, thème normalisé) pour une semaine de départ. */
async function facesDuTheme(
  db: Db | Tx,
  atelierId: number,
  depart: string,
  contNum: number,
  theme: string,
) {
  const s = lireSemaineIso(depart)
  return (
    await db.faceTrain.findMany({
      where: {
        atelierId,
        depAnbas: s.annee,
        depSembas: s.semaine,
        contNum,
        trainId: { not: null },
        NOT: { statut: 'ANNULE' },
      },
    })
  ).filter((f) => cleTheme(f.theme) === cleTheme(theme))
}

// RG-COO-230 : une ligne par thème présent dans les trains filtrés (le filtre Statut n'existe pas ici : le besoin
// l'ignore). Besoin = nombre de trains qui portent le thème (somme des « Nb trains »), Entretien = faces
// d'entretien du thème, Reçu / Couvert / Emplacement depuis la Réception (couverture), Pré-assemblé (RG-COO-233).
// RG-COO-231 : thèmes exclus (« ne pas afficher » / « reste en place ») hors besoin, listés en annotation.
// RG-COO-232 : le suivi n'est PAS réduit aux dossiers avec commentaire de prépa (Q-263 non tranchée : tous les
// thèmes des trains, comme la maquette).
export async function besoinParTheme(
  db: Db | Tx,
  identity: Identity,
  q: BesoinThemeQuery,
  maintenant = new Date(),
): Promise<BesoinTheme> {
  assertDroitCoordination(identity, 'train.consulter')
  const semaine = q.depart
    ? lireSemaineIso(q.depart)
    : semaineIsoDe(new Date(maintenant.getTime() + 7 * 86_400_000))
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => a.type === 'SCROLL')
  const faces = await facesDesTrains(db, ateliers, {
    semaine,
    ...(q.atelier ? { atelierId: q.atelier } : {}),
  })
  const themes = (q.theme ?? []).map(cleTheme)
  const trains = (await construireTrains(db, faces, ateliers)).filter(
    (t) =>
      (q.dossier === undefined || t.positions.some((p) => p.contNum === q.dossier)) &&
      contient(t.destinataire, q.destinataire) &&
      contient(t.afficheur, q.afficheur) &&
      (q.annonceur === undefined || t.positions.some((p) => contient(p.annonceur, q.annonceur))) &&
      (q.trainsDe === undefined || t.positions.length === q.trainsDe),
  )
  const plateformeDe = new Map(ateliers.map((a) => [a.id, a.plateformeId]))
  const toutesFaces = trains.flatMap((t) => t.faces)
  const cov = await couverture(db, toutesFaces, plateformeDe)
  // Thèmes exclus par Broadcast (RG-COO-014 / 231) : ligne attendue `themeExclu` du même dossier et du même site.
  const exclusLignes = await parPaquets(
    [...new Set(toutesFaces.map((f) => f.contNum ?? 0))],
    (paquet) =>
      db.receptionAttendue.findMany({
        where: { themeExclu: true, contNum: { in: paquet } },
        select: { plateformeId: true, contNum: true, theme: true },
      }),
  )
  const exclusCles = new Set(exclusLignes.map((l) => cleVisuel(l.plateformeId, l.contNum, l.theme)))
  const groupes = new Map<
    string,
    { faces: FaceTrain[]; trains: Set<string>; train: (typeof trains)[number] }
  >()
  for (const t of trains)
    for (const f of t.faces) {
      if (f.ftType === 'entretien' && f.theme === null) continue
      if (themes.length > 0 && !themes.includes(cleTheme(f.theme))) continue
      const k = `${String(f.atelierId)}|${String(f.contNum)}|${cleTheme(f.theme)}`
      const g = groupes.get(k) ?? { faces: [], trains: new Set<string>(), train: t }
      g.faces.push(f)
      g.trains.add(t.trainId)
      groupes.set(k, g)
    }
  const lignes: LigneBesoin[] = []
  const exclus: string[] = []
  for (const [cle, g] of groupes) {
    const f0 = g.faces[0] as FaceTrain
    const cv = cleVisuel(plateformeDe.get(f0.atelierId ?? 0) ?? 0, f0.contNum, f0.theme)
    const exclu = exclusCles.has(cv)
    const libelle = `${f0.contAnnonc ?? '—'} · ${f0.theme ?? '—'}`
    if (exclu) {
      exclus.push(libelle)
      continue
    }
    const recu = cov.recu.get(cv) ?? 0
    const attendu = cov.attendu.get(cv) ?? 0
    // Pré-assemblé : toutes les faces non fractionnées du thème le sont ; initialisé à vrai si un train du thème est
    // déjà en production (RG-COO-233, HYPOTHÈSE Q-193 (5)).
    const utiles = g.faces.filter((f) => !f.fractionnee)
    lignes.push({
      cle,
      atelierId: f0.atelierId ?? 0,
      contNum: f0.contNum,
      annonceur: f0.contAnnonc,
      theme: f0.theme,
      repiquage: f0.repiquage,
      besoin: g.trains.size,
      entretien: g.faces.filter((f) => f.ftType === 'entretien').length,
      recu,
      attendu,
      couvert: recu >= attendu,
      emplacement: (cov.emplacements.get(cv) ?? []).join(', ') || null,
      preAssemble:
        utiles.length > 0 &&
        (utiles.every((f) => f.preAssemblage) ||
          g.faces.some((f) => STATUTS_PRODUCTION.includes(f.statut))),
      version: versionTrain(g.faces),
      exclu: false,
    })
  }
  lignes.sort(
    (a, b) => (a.contNum ?? 0) - (b.contNum ?? 0) || (a.theme ?? '').localeCompare(b.theme ?? ''),
  )
  return { semaine, lignes, exclus }
}

// RG-COO-233 : « Marquer pré-assemblé » / « Désassembler » (booléen par thème, Q-262). Verrou de version par
// thème (empreinte de ses faces, RG-COO-308) ; journal « n visuel(s) pré-assemblé(s) ». Aucune condition de statut
// (legacy), la cible pouvant refuser un thème non couvert n'est pas spécifiée.
export async function marquerPreAssemblage(tx: Tx, identity: Identity, input: PreAssemblage) {
  assertDroitCoordination(identity, 'preassemblage.gerer', 'RG-COO-233')
  let n = 0
  for (const t of input.themes) {
    const atelier = await tx.atelier.findUnique({ where: { id: t.atelierId } })
    if (!atelier) throw new NotFoundError('Atelier introuvable')
    assertPerimetreAtelier(identity, atelier)
    const faces = await facesDuTheme(tx, t.atelierId, t.depart, t.contNum, t.theme)
    if (faces.length === 0) throw new NotFoundError(`Thème « ${t.theme} » introuvable`)
    if (versionTrain(faces) !== t.version)
      throw new ConflictError(
        `Le thème « ${t.theme} » a été modifié par un autre utilisateur : rechargez la page.`,
        { ...COO.version, regle: 'RG-COO-308' },
      )
    for (const f of faces) {
      await updateWithVersion({
        expectedVersion: f.version,
        update: (where) =>
          tx.faceTrain.updateMany({
            where: { id: f.id, ...where },
            data: { preAssemblage: input.valeur, updatedById: identity.userId, ...bumpVersion },
          }),
        ...COO.version,
        regle: 'RG-COO-308',
      })
      n++
    }
    for (const trainId of new Set(faces.map((f) => f.trainId ?? '')))
      await ecrireJournal(tx, {
        typeEntite: 'TRAIN',
        entiteId: trainId,
        action: 'PRE_ASSEMBLAGE',
        parId: identity.userId,
        ancienneValeur: String(!input.valeur),
        nouvelleValeur: String(input.valeur),
        complement: 'RG-COO-233',
      })
  }
  return {
    message: `${String(n)} visuel(s) ${input.valeur ? 'pré-assemblé(s)' : 'désassemblé(s)'}.`,
    nombre: n,
  }
}
