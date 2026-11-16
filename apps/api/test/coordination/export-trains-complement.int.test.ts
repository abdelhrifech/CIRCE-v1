// COO-P10 — tests d'INTÉGRATION COMPLÉMENTAIRES (API sur la base de test uniquement ; aucun test unitaire) :
// export des trains du jeudi (RG-COO-210 à 213), ordonnancement Paris (RG-COO-214, Q-255 OUVERTE), export
// préparation (RG-COO-215, 216), « Au roulage » (RG-COO-217), suivi par thème (RG-COO-230 à 233), vue Préparation
// (RG-COO-235), choix du rouleur (RG-COO-236) et générateur de fichiers (ECR-GEN-01 / GEN-03).
// Source de l'attendu : docs/COORDINATION_REGLES_METIER.md (règles citées, tableau des entités, matrice des
// droits), hypothèses Q-193 (12 points), Q-255, Q-263, Q-175, CLAUDE.md §6 (400 / 401 / 403 / 409 / 422, atomicité,
// idempotence, concurrence). Le fichier est SIMULÉ (D-15). Les cas déjà couverts par export-trains.int.test.ts et
// suivi-generation.int.test.ts ne sont pas répétés : ces tests ajoutent les limites, les transitions interdites
// exhaustives, les périmètres et les invariants transverses.
// ANO-0xx : un test marqué `it.fails` révèle une anomalie du CODE (ne pas modifier le test pour le faire passer).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  BesoinThemeSchema,
  ExportApercuSchema,
  ExportResultatSchema,
  GenerationSchema,
  HistoriqueExportsSchema,
  TrainsGenerationSchema,
  type BesoinTheme,
  type Role,
} from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import {
  MachineNonConfiguree,
  MachineSimulee,
  type MachinePort,
} from '../../src/core/ports/machine.ts'
import type { StatutProduction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get, idem, post } from '../support/reception.ts'
import {
  avecEchec,
  DEPART,
  DEPART_TXT,
  envoyer,
  parametre,
  recu,
  restaurerParametres,
  ROLES,
  ROLES_SANS_ADMIN,
  SEM,
  siteDeroulant,
  trainExportable,
  versions,
  type SiteD,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
afterEach(async () => {
  vi.useRealTimers()
  await restaurerParametres()
})

const site = () => siteDeroulant(ctx)
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })
const instructionDe = (code: string) => db.instruction.findUniqueOrThrow({ where: { code } })
const autorise = (role: Role, ok: readonly Role[]) => ok.includes(role)

const exporter = (s: SiteD, simulation = false, headers = s.users.coord.headers) =>
  envoyer(ctx, '/api/coordination/trains/export', headers, { depart: DEPART_TXT, simulation })
const apercu = (s: SiteD, headers = s.users.coord.headers, depart = DEPART_TXT) =>
  get(ctx, `/api/coordination/trains/export/apercu?depart=${depart}`, headers)
const historique = (headers: Record<string, string>, depart = DEPART_TXT) =>
  get(ctx, `/api/coordination/trains/export/historique?depart=${depart}`, headers)
const lotsDe = (s: SiteD) =>
  db.exportTrains.findMany({
    where: { parId: { in: Object.values(s.users).map((u) => u.id) } },
    orderBy: { id: 'asc' },
  })
const prepa = (
  s: SiteD,
  trains: { trainId: string; version: string }[],
  headers = s.users.cheq.headers,
  cle = idem(),
) => envoyer(ctx, '/api/coordination/trains/export-preparation', headers, { trains }, cle)
const roulage = (
  s: SiteD,
  trains: { trainId: string; version: string }[],
  rouleurId: number,
  headers = s.users.cheq.headers,
  cle = idem(),
) => envoyer(ctx, '/api/coordination/trains/au-roulage', headers, { trains, rouleurId }, cle)
const affecter = (
  s: SiteD,
  trains: { trainId: string; version: string }[],
  rouleurId: number,
  headers = s.users.cheq.headers,
) => envoyer(ctx, '/api/coordination/trains/rouleur', headers, { trains, rouleurId })
const versionsDe = (s: SiteD, ids: string[]) => versions(ctx, s.users.coord.headers, ids)
const besoin = async (s: SiteD, qs = '', headers = s.users.coord.headers) => {
  const r = await get(ctx, `/api/coordination/trains/besoin?depart=${DEPART_TXT}${qs}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return BesoinThemeSchema.parse(r.json())
}
const themeDe = (b: BesoinTheme, t: string) => b.lignes.find((l) => l.theme === t)
const contNumAleatoire = (base: number) => base + Math.floor(Math.random() * 90_000)

/** Instantané des faces (statut, version, rouleur, pré-assemblage) pour prouver l'absence d'écriture. */
async function instantane(ids: number[]) {
  const faces = await db.faceTrain.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })
  return faces.map((x) => [x.id, x.statut, x.version, x.rouleurId, x.preAssemblage])
}
/** Traces d'un utilisateur (historiques de statut, journal hors action donnée). */
async function traces(userId: number) {
  return [
    await db.statutHistorique.count({ where: { parId: userId } }),
    await db.journalAudit.count({ where: { parId: userId } }),
  ]
}
/** Face supplémentaire sur l'instruction d'un train déjà créé (un dossier présent dans deux trains). */
const faceSupplementaire = (
  s: SiteD,
  t: Awaited<ReturnType<typeof trainExportable>>,
  trainId: string,
  theme: string,
) =>
  f.createFaceTrain(db, {
    instructionCode: t.instructions[0]?.code ?? '',
    statut: 'INSTRUCTION_OK',
    atelierId: s.atelier.id,
    supportId: s.support.id,
    destinataireId: s.destinataire.id,
    contNum: t.dossiers[0]?.contNum ?? null,
    contAnnonc: 'ANNONCEUR',
    dateDepart: DEPART,
    contAnbas: SEM.annee,
    contSembas: SEM.semaine,
    depAnbas: SEM.annee,
    depSembas: SEM.semaine,
    trainId,
    theme,
    ordreReel: 1,
    refPanel: `PX${trainId}`,
    afficheurNom: 'AFFICHEUR SUD',
  })

// ═════════════════════════ RG-COO-212 réservé à la Coordination, jeudi 14 h ═════════════════════════

describe('RG-COO-212 export réservé à la Coordination : 6 profils, toutes les routes de l’export', () => {
  it.each(ROLES)(
    'RG-COO-212 simulation, historique et téléchargement du fichier pour le rôle %s',
    async (role) => {
      const s = await site()
      await trainExportable(ctx, s, ['Rose'])
      const ok = autorise(role, ['coord', 'admin'])
      const h = s.users[role].headers
      const simu = await exporter(s, true, h)
      expect(simu.statusCode, simu.body).toBe(ok ? 200 : 403)
      if (!ok)
        expect(erreur(simu)).toMatchObject({
          code: 'PERMISSION',
          regle: role === 'com' ? 'RG-COO-168' : 'RG-COO-212',
        })
      const reel = ExportResultatSchema.parse((await exporter(s)).json())
      expect((await historique(h)).statusCode).toBe(ok ? 200 : 403)
      expect(
        (await get(ctx, `/api/coordination/trains/export/${String(reel.lot)}/fichier`, h))
          .statusCode,
      ).toBe(ok ? 200 : 403)
      // Un refus n'écrit rien : seul le lot réel de la Coordination existe (+ la simulation si autorisée).
      expect(await lotsDe(s)).toHaveLength(ok ? 2 : 1)
    },
  )

  // Jalon « jeudi 14 h » : aucune restriction horaire côté serveur (HYPOTHÈSE Q-252) ; limites autour de 14 h.
  it.each([
    ['jeudi 13:59:59.999', '2026-11-05T13:59:59.999Z', '20261105135959999'],
    ['jeudi 14:00:00.000', '2026-11-05T14:00:00.000Z', '20261105140000000'],
    ['jeudi 14:00:00.001', '2026-11-05T14:00:00.001Z', '20261105140000001'],
    ['vendredi 09:00 (urgences, jalon 7)', '2026-11-06T09:00:00.000Z', '20261106090000000'],
    ['dimanche 23:59:59', '2026-11-08T23:59:59.000Z', '20261108235959000'],
  ])(
    'RG-COO-212 %s : l’export n’est pas bloqué par l’heure ; le nom du fichier porte l’horodatage',
    async (_libelle, instant, attendu) => {
      const s = await site()
      const t = await trainExportable(ctx, s, ['Rose'])
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(instant))
      const r = await exporter(s)
      vi.useRealTimers()
      expect(r.statusCode, r.body).toBe(200)
      expect(ExportResultatSchema.parse(r.json()).nomFichier).toBe(
        `ExportTrainsCIRCEversSurf${attendu}_SIMULE.csv`,
      )
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    },
  )
})

// ═════════════════════════ RG-COO-210 / 211 faces et dossiers exportables ═════════════════════════

describe('RG-COO-210 / 211 faces, dossiers exportables et décompte', () => {
  it('RG-COO-210 seules les faces « Instruction ok » partent : tout autre statut reste intact (statut, version, historique, instruction)', async () => {
    const s = await site()
    const bon = await trainExportable(ctx, s, ['Rose'])
    const statuts: StatutProduction[] = [
      'A_TRAITER',
      'EN_COURS',
      'ERREUR',
      'A_IMPRIMER',
      'EXPORT_PREPA',
      'AU_ROULAGE',
      'A_EXPEDIER',
      'TERMINE',
      'PREPARE',
      'ANNULE',
    ]
    const autres = []
    for (const statut of statuts)
      autres.push({ statut, t: await trainExportable(ctx, s, ['X'], { statut }) })
    const avant = await instantane(autres.map((a) => a.t.faces[0]?.id ?? 0))
    const r = await exporter(s)
    expect(r.statusCode, r.body).toBe(200)
    expect(ExportResultatSchema.parse(r.json())).toMatchObject({ dossiers: 1, trains: 1, faces: 1 })
    expect((await faceDe(bon.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect(await instantane(autres.map((a) => a.t.faces[0]?.id ?? 0))).toEqual(avant)
    for (const a of autres) {
      expect(await instructionDe(a.t.instructions[0]?.code ?? ''), a.statut).toMatchObject({
        statut: 'INSTRUCTION_OK',
        exporteLe: null,
        exporteParId: null,
      })
      expect(
        await db.statutHistorique.count({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(a.t.faces[0]?.id) },
        }),
        a.statut,
      ).toBe(0)
    }
  })

  it('RG-COO-210 / 211 le départ choisi borne l’export : une face d’une autre semaine n’est ni comptée ni exportée', async () => {
    const s = await site()
    const ici = await trainExportable(ctx, s, ['Rose'])
    const suivante = {
      annee: SEM.annee + (SEM.semaine >= 52 ? 1 : 0),
      semaine: SEM.semaine >= 52 ? 1 : SEM.semaine + 1,
    }
    const ailleurs = await trainExportable(ctx, s, ['Gris'], {
      extra: { depAnbas: suivante.annee, depSembas: suivante.semaine },
    })
    expect(ExportApercuSchema.parse((await apercu(s)).json())).toMatchObject({
      dossiersExportables: 1,
      faces: 1,
      trains: 1,
    })
    expect((await exporter(s)).statusCode).toBe(200)
    expect((await faceDe(ici.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(ailleurs.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
  })

  it('RG-COO-211 décompte : un dossier présent dans deux trains compte pour un dossier (2 faces) ; l’aperçu et l’export donnent les mêmes nombres', async () => {
    const s = await site()
    const a = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const b = await trainExportable(ctx, s, ['Bleu'])
    await faceSupplementaire(s, a, b.trainId, 'Rose bis')
    const ap = ExportApercuSchema.parse((await apercu(s)).json())
    expect(ap).toMatchObject({ dossiersExportables: 3, dejaExportes: 0, faces: 4, trains: 2 })
    const r = ExportResultatSchema.parse((await exporter(s)).json())
    expect(r).toMatchObject({ dossiers: 3, trains: 2, faces: 4 })
    expect(r.message).toBe(
      '3 dossier(s) exporté(s) : leurs 4 face(s) passent « A imprimer », le go des plateformes. Fichier SIMULÉ : enregistré dans Circé et téléchargeable, non déposé ni transmis à Surf (D-15).',
    )
    const apres = ExportApercuSchema.parse((await apercu(s)).json())
    expect(apres).toMatchObject({ dossiersExportables: 0, dejaExportes: 3, faces: 0, trains: 0 })
  })

  it('RG-COO-211 « En cours » : les dossiers aux statuts 0 / 1 / 3 sont listés (dossier croissant) et ne partent pas ; Instruction OK, annulé et A imprimer ne le sont pas', async () => {
    const s = await site()
    const bon = await trainExportable(ctx, s, ['Rose'])
    const enCours: Awaited<ReturnType<typeof trainExportable>>[] = []
    for (const statut of ['A_TRAITER', 'EN_COURS', 'ERREUR'] as const)
      enCours.push(await trainExportable(ctx, s, ['X'], { statut, instructionStatut: 'EN_COURS' }))
    await trainExportable(ctx, s, ['Annule'], { statut: 'ANNULE' })
    await trainExportable(ctx, s, ['Fait'], {
      statut: 'A_IMPRIMER',
      instructionStatut: 'PRET_A_PRODUIRE',
    })
    const ap = ExportApercuSchema.parse((await apercu(s)).json())
    const attendus = enCours.map((t) => t.dossiers[0]?.contNum ?? 0).sort((x, y) => x - y)
    expect(ap.dossiersEnCours.map((d) => d.dossier)).toEqual(attendus)
    expect(ap).toMatchObject({ dossiersExportables: 1, dejaExportes: 1, faces: 1 })
    expect((await exporter(s)).statusCode).toBe(200)
    for (const t of enCours)
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).not.toBe('A_IMPRIMER')
    expect((await faceDe(bon.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it('RG-COO-211 rejet : instruction annulée, dossier annulé ou préparation non reçue → rien à exporter (422, bouton désactivé : 0 dossier), aucun lot', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['A'], { instructionStatut: 'ANNULE' })
    await trainExportable(ctx, s, ['B'], { dossierStatut: 'ANNULE' })
    await trainExportable(ctx, s, ['C'], { dossierStatut: 'A_TRAITER' })
    const ap = ExportApercuSchema.parse((await apercu(s)).json())
    expect(ap).toMatchObject({ dossiersExportables: 0, faces: 0, trains: 0 })
    for (const simulation of [false, true]) {
      const r = await exporter(s, simulation)
      expect(r.statusCode).toBe(422)
      expect(erreur(r)).toMatchObject({ code: 'COO_RIEN_A_EXPORTER', regle: 'RG-COO-211' })
    }
    expect(await lotsDe(s)).toHaveLength(0)
  })

  it('RG-COO-211 un train partiellement exportable : seule la face du dossier exportable part et figure au fichier ; l’autre reste « Instruction ok »', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'])
    const n = await trainExportable(ctx, s, ['Gris'], {
      dossierStatut: 'A_TRAITER',
      trainId: t.trainId,
    })
    const r = ExportResultatSchema.parse((await exporter(s)).json())
    expect(r).toMatchObject({ dossiers: 1, trains: 1, faces: 1 })
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(n.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect(r.contenu).toContain(String(t.dossiers[0]?.contNum))
    expect(r.contenu).not.toContain(String(n.dossiers[0]?.contNum))
  })

  it('RG-COO-210 / 211 périmètre d’ateliers : les faces d’un atelier d’un autre site ne sont ni comptées ni exportées par le coordinateur', async () => {
    const s = await site()
    const autre = await site()
    const chez = await trainExportable(ctx, s, ['Rose'])
    const ailleurs = await trainExportable(ctx, autre, ['Gris'])
    expect(ExportApercuSchema.parse((await apercu(s)).json())).toMatchObject({
      faces: 1,
      trains: 1,
    })
    expect((await exporter(s)).statusCode).toBe(200)
    expect((await faceDe(chez.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(ailleurs.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
  })
})

// ═════════════════════════ RG-COO-213 plafond de 6 contrats, tf_train_export, fichier ═════════════════════════

describe('RG-COO-213 plafond de 6 contrats, tf_train_export, fichier, simulation, historique, erreurs', () => {
  it('RG-COO-213 limite : 6 contrats acceptés (une ligne tf_train_export de 6 contrats dans l’ordre des faces), 7 refusés (422)', async () => {
    const s = await site()
    const six = await trainExportable(ctx, s, ['A', 'B', 'C', 'D', 'E', 'F'], { repiquage: 'Rep' })
    const r = await exporter(s)
    expect(r.statusCode, r.body).toBe(200)
    const res = ExportResultatSchema.parse(r.json())
    const ligne = await db.exportTrainLigne.findFirstOrThrow({ where: { exportId: res.lot } })
    expect(ligne).toMatchObject({ trainId: six.trainId, nbContrats: 6 })
    const contrats = JSON.parse(ligne.contrats) as {
      contrat: number
      annonceur: string
      theme: string
      repiquage: string
    }[]
    expect(contrats.map((c) => c.theme)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(contrats.map((c) => c.contrat)).toEqual(six.dossiers.map((d) => d.contNum))
    expect(contrats.every((c) => c.annonceur === 'ANNONCEUR' && c.repiquage === 'Rep')).toBe(true)
    // 11 champs d'en-tête + 6 contrats × 5 champs.
    expect(res.contenu.split('\r\n')[0]?.split(';')).toHaveLength(11 + 6 * 5)

    const s2 = await site()
    const sept = await trainExportable(ctx, s2, ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    const bon = await trainExportable(ctx, s2, ['Z'])
    for (const simulation of [false, true]) {
      const refus = await exporter(s2, simulation)
      expect(refus.statusCode).toBe(422)
      expect(erreur(refus)).toMatchObject({ code: 'COO_TRAIN_SUPERIEUR_A_6', regle: 'RG-COO-213' })
    }
    // Aucun changement, y compris pour le bon train de la même demande.
    for (const face of [...sept.faces, ...bon.faces])
      expect(await faceDe(face.id)).toMatchObject({ statut: 'INSTRUCTION_OK', version: 1 })
    expect(await lotsDe(s2)).toHaveLength(0)
    expect(await traces(s2.users.coord.id)).toEqual([0, 0])
    // Nettoyage : un train de 7 contrats « Instruction ok » bloquerait l'export global du profil admin (autres fichiers).
    await db.faceTrain.updateMany({ where: { trainId: sept.trainId }, data: { statut: 'ANNULE' } })
  })

  // Tableau des entités (docs/COORDINATION_REGLES_METIER.md, « Export de train (tf_train_export) ») : chaque contrat
  // porte contrat, réseau, annonceur, thème, repiquage, rouleur, lettre.
  // ANO-044 (corrigée) : la ligne tf_train_export stocke la lettre de la position (A à F) et le rouleur. Ancien suspect : apps/api/src/modules/coordination/export-trains.ts:270
  // (`contrats: JSON.stringify(t.contrats)`), apps/api/src/modules/coordination/export-csv.ts:10-15 (ContratExport).
  it('RG-COO-213 ANO-044 tf_train_export porte la lettre de chaque contrat (A à F)', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['A', 'B', 'C'])
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const ligne = await db.exportTrainLigne.findFirstOrThrow({ where: { exportId: res.lot } })
    const contrats = JSON.parse(ligne.contrats) as { lettre?: string }[]
    expect(contrats.map((c) => c.lettre)).toEqual(['A', 'B', 'C'])
  })

  it('RG-COO-213 fichier : un champ de plus de 30 caractères est coupé à 30 ; une ligne par train, séparées par CRLF ; contrats dans l’ordre des faces', async () => {
    const s = await site()
    const a = await trainExportable(ctx, s, ['Rose', 'Gris'], {
      extra: { afficheurNom: 'AFFICHEUR AVEC UN NOM BEAUCOUP TROP LONG POUR LE FICHIER' },
    })
    const b = await trainExportable(ctx, s, ['Bleu'])
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const lignes = res.contenu.split('\r\n').filter(Boolean)
    expect(res.contenu.endsWith('\r\n')).toBe(true)
    expect(lignes).toHaveLength(2)
    const ligneA = lignes.find((l) => l.startsWith(a.trainId))?.split(';') ?? []
    expect(ligneA[4]).toHaveLength(30)
    expect(ligneA[4]).toBe('AFFICHEUR AVEC UN NOM BEAUCOUP')
    expect(ligneA[11]).toBe(String(a.dossiers[0]?.contNum))
    expect(ligneA[16]).toBe(String(a.dossiers[1]?.contNum))
    expect(lignes.some((l) => l.startsWith(b.trainId))).toBe(true)
  })

  it('RG-COO-213 / Q-193 (1) fichier : en atelier 2 m² (paramètre) thème et repiquage sont fusionnés « repiquage - thème » ; sinon deux champs', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier2.id))
    const hors = await trainExportable(ctx, s, ['Bleu'], { repiquage: 'Rep' })
    const deuxM2 = await trainExportable(ctx, s, ['Vert'], {
      repiquage: 'Rep',
      atelierId: s.atelier2.id,
    })
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const ligne = (id: string) => res.contenu.split('\r\n').find((l) => l.startsWith(id)) ?? ''
    expect(ligne(hors.trainId)).toContain(';Bleu;Rep')
    expect(ligne(deuxM2.trainId)).toContain(';Rep - Vert')
    expect(ligne(deuxM2.trainId)).not.toContain(';Vert;')
  })

  it('RG-COO-213 simulation sans effet : aucun statut, version, historique, journal de dossier, instruction ni tf_train_export ; le lot et son journal « simulation » existent ; plusieurs simulations possibles', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const ids = t.faces.map((x) => x.id)
    const avant = await instantane(ids)
    const instrAvant = await Promise.all(t.instructions.map((i) => instructionDe(i.code)))
    const tracesAvant = await traces(s.users.coord.id)
    const lignesAvant = await db.exportTrainLigne.count()
    const un = ExportResultatSchema.parse((await exporter(s, true)).json())
    const deux = ExportResultatSchema.parse((await exporter(s, true)).json())
    expect(un.lot).not.toBe(deux.lot)
    expect(un.contenu).toBe(deux.contenu)
    expect(await instantane(ids)).toEqual(avant)
    expect(await Promise.all(t.instructions.map((i) => instructionDe(i.code)))).toEqual(instrAvant)
    expect(await db.exportTrainLigne.count()).toBe(lignesAvant)
    const [histo, journal] = await traces(s.users.coord.id)
    expect(histo).toBe(tracesAvant[0])
    // Seul le journal « simulation » de chaque lot est écrit (aucun journal de dossier).
    expect((journal ?? 0) - (tracesAvant[1] ?? 0)).toBe(2)
    expect(
      await db.journalAudit.count({
        where: { parId: s.users.coord.id, typeEntite: 'DOSSIER' },
      }),
    ).toBe(0)
    const h = HistoriqueExportsSchema.parse((await historique(s.users.coord.headers)).json())
    expect(
      h.exports.filter((e) => [un.lot, deux.lot].includes(e.id)).every((e) => e.simulation),
    ).toBe(true)
    // Le réel exporte ensuite le même contenu (hors nom de fichier).
    expect(ExportResultatSchema.parse((await exporter(s)).json()).contenu).toBe(un.contenu)
  })

  it('RG-COO-213 historique ExporterTrains : faces (2 → 5) et instructions tracées par l’auteur, lot daté, historique filtré par départ, exports de préparation distingués', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const t = await trainExportable(ctx, s, ['Rose'])
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    expect(
      await db.statutHistorique.findFirst({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(t.faces[0]?.id) },
      }),
    ).toMatchObject({ ancien: 'INSTRUCTION_OK', nouveau: 'A_IMPRIMER', parId: s.users.coord.id })
    expect(
      await db.statutHistorique.findFirst({
        where: { typeEntite: 'INSTRUCTION', entiteId: t.instructions[0]?.code ?? '' },
      }),
    ).toMatchObject({
      ancien: 'INSTRUCTION_OK',
      nouveau: 'PRET_A_PRODUIRE',
      parId: s.users.coord.id,
    })
    const p = ExportResultatSchema.parse(
      (await prepa(s, await versionsDe(s, [t.trainId]), s.users.coord.headers)).json(),
    )
    const h = HistoriqueExportsSchema.parse((await historique(s.users.coord.headers)).json())
    const miens = h.exports.filter((e) => [res.lot, p.lot].includes(e.id))
    expect(miens.map((e) => [e.id, e.nature])).toEqual([
      [p.lot, 'EXPORT_PREPARATION'],
      [res.lot, 'EXPORT_TRAINS'],
    ])
    expect(Math.abs(Date.now() - new Date(miens[1]?.le ?? 0).getTime())).toBeLessThan(120_000)
    const autreSemaine =
      SEM.semaine >= 52
        ? `${String(SEM.annee + 1)}-W01`
        : `${String(SEM.annee)}-W${String(SEM.semaine + 1).padStart(2, '0')}`
    const vide = HistoriqueExportsSchema.parse(
      (await historique(s.users.coord.headers, autreSemaine)).json(),
    )
    expect(vide.exports.some((e) => [res.lot, p.lot].includes(e.id))).toBe(false)
  })

  it('RG-COO-213 erreurs visibles : une panne d’écriture renvoie une erreur applicative (code, message), jamais un lot / idExport ; rien n’est modifié ; la même clé rejouée ensuite réussit', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const cle = idem()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON tf_train_export', () =>
      envoyer(
        ctx,
        '/api/coordination/trains/export',
        s.users.coord.headers,
        { depart: DEPART_TXT },
        cle,
      ),
    )
    expect([422, 500]).toContain(r.statusCode)
    const e = erreur(r)
    expect(e.code).toBeTruthy()
    expect(e.message).toBeTruthy()
    expect(r.json()).not.toHaveProperty('lot')
    expect(r.json()).not.toHaveProperty('idExport')
    for (const face of t.faces)
      expect(await faceDe(face.id)).toMatchObject({ statut: 'INSTRUCTION_OK', version: 1 })
    expect(await lotsDe(s)).toHaveLength(0)
    expect(await traces(s.users.coord.id)).toEqual([0, 0])
    const retry = await envoyer(
      ctx,
      '/api/coordination/trains/export',
      s.users.coord.headers,
      { depart: DEPART_TXT },
      cle,
    )
    expect(retry.statusCode, retry.body).toBe(200)
    expect(await lotsDe(s)).toHaveLength(1)
  })

  it('RG-COO-213 atomicité : un échec sur le journal du 2e dossier (dernière écriture) annule les faces, instructions, lot, lignes et historiques déjà écrits', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'DOSSIER' AND NEW.entite_id = '${String(t.dossiers[1]?.id)}'`,
      () => exporter(s),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    for (const face of t.faces)
      expect(await faceDe(face.id)).toMatchObject({ statut: 'INSTRUCTION_OK', version: 1 })
    for (const i of t.instructions)
      expect(await instructionDe(i.code)).toMatchObject({
        statut: 'INSTRUCTION_OK',
        exporteLe: null,
      })
    expect(await lotsDe(s)).toHaveLength(0)
    expect(await db.exportTrainLigne.count({ where: { trainId: t.trainId } })).toBe(0)
    expect(await traces(s.users.coord.id)).toEqual([0, 0])
  })

  it('RG-COO-213 atomicité : un échec de la mise à jour de la 2e face (verrou) annule la 1re face passée « A imprimer »', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'])
    const r = await avecEchec(
      ctx,
      `BEFORE UPDATE ON tf_face_train WHEN NEW.ft_id = ${String(t.faces[1]?.id)}`,
      () => exporter(s),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('INSTRUCTION_OK')
    expect(await lotsDe(s)).toHaveLength(0)
  })

  it('RG-COO-213 idempotence : même clé deux fois = un seul lot, un seul historique de face, un seul journal par dossier', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'])
    const cle = idem()
    const corps = { depart: DEPART_TXT, simulation: false }
    const a = await envoyer(
      ctx,
      '/api/coordination/trains/export',
      s.users.coord.headers,
      corps,
      cle,
    )
    const b = await envoyer(
      ctx,
      '/api/coordination/trains/export',
      s.users.coord.headers,
      corps,
      cle,
    )
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(b.json()).toEqual(a.json())
    expect(await lotsDe(s)).toHaveLength(1)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(t.faces[0]?.id) },
      }),
    ).toBe(1)
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'DOSSIER',
          entiteId: String(t.dossiers[0]?.id),
          action: 'EXPORTER_TRAINS',
        },
      }),
    ).toBe(1)
    expect((await faceDe(t.faces[0]?.id ?? 0)).version).toBe(2)
  })

  // RG-COO-167 : le périmètre (site, atelier) s'applique à toutes les lignes et est revérifié côté serveur.
  // ANO-045 : l'historique des exports (GET /coordination/trains/export/historique) liste les lots de TOUS les sites
  // (aucun filtre de périmètre) : un coordinateur d'un autre site voit dossiers / trains / faces / auteur / nom de fichier.
  // Suspect : apps/api/src/modules/coordination/export-trains.ts:343-373 (historiqueExports : `where` limité au départ).
  it('RG-COO-167 ANO-045 l’historique des exports ne montre pas les lots d’un autre site', async () => {
    const s = await site()
    const autre = await site()
    await trainExportable(ctx, s, ['Rose'])
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const h = HistoriqueExportsSchema.parse((await historique(autre.users.coord.headers)).json())
    expect(h.exports.some((e) => e.id === res.lot)).toBe(false)
  })

  // ANO-046 : le téléchargement du fichier d'export par identifiant ne vérifie pas le périmètre : le CSV (destinataire,
  // adresse, annonceur, thèmes) d'un autre site est lisible. Suspect : export-trains.ts:376-381 (fichierExport).
  it('RG-COO-167 ANO-046 le fichier d’un export d’un autre site n’est pas téléchargeable', async () => {
    const s = await site()
    const autre = await site()
    await trainExportable(ctx, s, ['Rose'])
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const fichier = await get(
      ctx,
      `/api/coordination/trains/export/${String(res.lot)}/fichier`,
      autre.users.coord.headers,
    )
    expect([403, 404]).toContain(fichier.statusCode)
  })
})

// ═════════════════════════ RG-COO-214 ordonnancement Paris (Q-255 OUVERTE) ═════════════════════════

describe('RG-COO-214 ordonnancement Paris : non repris (Q-255 OUVERTE)', () => {
  it('RG-COO-214 plus de 25 faces d’une même structure : aucun ordre calculé, aucun débordement ; seuls les statuts changent', async () => {
    const s = await site()
    await parametre(ctx, 'trains.positionsMax', '40')
    const themes = Array.from({ length: 30 }, (_, k) => `T${String(k)}`)
    const t = await trainExportable(ctx, s, themes)
    const r = await exporter(s)
    expect(r.statusCode, r.body).toBe(200)
    for (const [k, face] of t.faces.entries()) {
      const apres = await faceDe(face.id)
      expect(apres.statut).toBe('A_IMPRIMER')
      expect(apres.ordreReel).toBe(k + 1)
      expect(apres.ordreCalcule).toBeNull()
    }
  })
})

// ═════════════════════════ RG-COO-215 / 216 export préparation ═════════════════════════

describe('RG-COO-215 export préparation : ateliers paramétrés, statuts', () => {
  it('RG-COO-215 ateliers autorisés = paramètre (liste séparée par « ; », espaces tolérés) : les deux ateliers autorisés passent ; un seul autorisé → l’autre est refusé (422)', async () => {
    const s = await site()
    await parametre(
      ctx,
      'trains.ateliersExportPrepa',
      ` ${String(s.atelier.id)} ; ${String(s.atelier2.id)} `,
    )
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris'], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
    })
    const ok = await prepa(s, await versionsDe(s, [a.trainId, b.trainId]))
    expect(ok.statusCode, ok.body).toBe(200)
    expect((await faceDe(a.faces[0]?.id ?? 0)).statut).toBe('EXPORT_PREPA')
    expect((await faceDe(b.faces[0]?.id ?? 0)).statut).toBe('EXPORT_PREPA')

    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const c = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER' })
    const d = await trainExportable(ctx, s, ['Vert'], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
    })
    const refus = await prepa(s, await versionsDe(s, [c.trainId, d.trainId]))
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus)).toMatchObject({ code: 'COO_EXPORT_PREPA_INTERDIT', regle: 'RG-COO-215' })
    // Rien n'est modifié, y compris pour le train de l'atelier autorisé de la même sélection.
    expect(await instantane([c.faces[0]?.id ?? 0, d.faces[0]?.id ?? 0])).toEqual([
      [c.faces[0]?.id, 'A_IMPRIMER', 1, null, false],
      [d.faces[0]?.id, 'A_IMPRIMER', 1, null, false],
    ])
  })

  it.each([
    ['INSTRUCTION_OK', 409],
    ['AU_ROULAGE', 409],
    ['A_EXPEDIER', 409],
    ['TERMINE', 409],
    ['PREPARE', 409],
  ] as const)(
    'RG-COO-215 transition interdite : un train dont les faces sont « %s » ne passe pas à « Export prépa » (409, message legacy)',
    async (statut, http) => {
      const s = await site()
      await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
      const t = await trainExportable(ctx, s, ['Rose'], { statut })
      const r = await prepa(s, await versionsDe(s, [t.trainId]))
      expect(r.statusCode, r.body).toBe(http)
      expect(erreur(r)).toMatchObject({
        regle: 'RG-COO-215',
        message: "Les faces des trains ne sont pas dans le statut 'A imprimer' !",
      })
      expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe(statut)
    },
  )

  it('RG-COO-215 une sélection mêlant un train « A imprimer » et un train « Au roulage » est refusée en bloc (409) : aucune face ne change, aucun lot', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris'], { statut: 'AU_ROULAGE' })
    const r = await prepa(s, await versionsDe(s, [a.trainId, b.trainId]))
    expect(r.statusCode).toBe(409)
    expect((await faceDe(a.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect(await db.exportTrains.count({ where: { parId: s.users.cheq.id } })).toBe(0)
  })

  it('RG-COO-215 transition 5 → 9 : historique FACE_TRAIN par face (auteur, règle), version +1, rouleur inchangé, aucun statut d’instruction touché', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], {
      statut: 'A_IMPRIMER',
      instructionStatut: 'PRET_A_PRODUIRE',
    })
    const r = await prepa(s, await versionsDe(s, [t.trainId]))
    expect(r.statusCode, r.body).toBe(200)
    for (const face of t.faces) {
      expect(await faceDe(face.id)).toMatchObject({
        statut: 'EXPORT_PREPA',
        version: 2,
        rouleurId: null,
      })
      expect(
        await db.statutHistorique.findFirst({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(face.id) },
        }),
      ).toMatchObject({
        ancien: 'A_IMPRIMER',
        nouveau: 'EXPORT_PREPA',
        parId: s.users.cheq.id,
        regle: 'RG-COO-215',
      })
    }
    for (const i of t.instructions)
      expect((await instructionDe(i.code)).statut).toBe('PRET_A_PRODUIRE')
  })

  it('RG-COO-215 / RG-COO-213 un train de plus de 6 contrats est refusé à l’export préparation (422) sans aucune modification', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const t = await trainExportable(ctx, s, ['A', 'B', 'C', 'D', 'E', 'F', 'G'], {
      statut: 'A_IMPRIMER',
    })
    const r = await prepa(s, await versionsDe(s, [t.trainId]))
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_TRAIN_SUPERIEUR_A_6', regle: 'RG-COO-213' })
    for (const face of t.faces)
      expect(await faceDe(face.id)).toMatchObject({ statut: 'A_IMPRIMER', version: 1 })
  })

  it('RG-COO-215 / RG-COO-308 concurrence : une version périmée (le train a été modifié depuis la lecture) → 409, rien n’est écrit ; deux exports simultanés : un seul passe', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const lue = await versionsDe(s, [t.trainId])
    expect((await affecter(s, lue, rouleur.id)).statusCode).toBe(200)
    const perimee = await prepa(s, lue)
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    const fraiche = await versionsDe(s, [t.trainId])
    const [x, y] = await Promise.all([prepa(s, fraiche), prepa(s, fraiche)])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    expect(await db.exportTrains.count({ where: { parId: s.users.cheq.id } })).toBe(1)
  })

  it('RG-COO-215 atomicité : un échec du journal du 2e train annule le passage du 1er à « Export prépa » et le lot ; la même clé réussit ensuite (idempotence)', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const v = await versionsDe(s, [a.trainId, b.trainId])
    const cle = idem()
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${b.trainId}' AND NEW.action = 'EXPORT_PREPARATION'`,
      () => prepa(s, v, s.users.cheq.headers, cle),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    for (const t of [a, b])
      expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({ statut: 'A_IMPRIMER', version: 1 })
    expect(await db.exportTrains.count({ where: { parId: s.users.cheq.id } })).toBe(0)
    expect((await prepa(s, v, s.users.cheq.headers, cle)).statusCode).toBe(200)
    expect(await db.exportTrains.count({ where: { parId: s.users.cheq.id } })).toBe(1)
  })
})

describe('RG-COO-216 export préparation : plafond de 20 thèmes (couples thème / repiquage)', () => {
  /** n trains d'un contrat chacun : n couples (thème, repiquage) distincts. */
  async function trainsDeThemes(
    s: SiteD,
    themes: string[],
    o: { repiquage?: string; atelierId?: number } = {},
  ) {
    const ids: string[] = []
    for (const theme of themes) {
      const t = await trainExportable(ctx, s, [theme], {
        statut: 'A_IMPRIMER',
        ...(o.repiquage ? { repiquage: o.repiquage } : {}),
        ...(o.atelierId ? { atelierId: o.atelierId } : {}),
      })
      ids.push(t.trainId)
    }
    return ids
  }
  const noms = (n: number, prefixe = 'T') =>
    Array.from({ length: n }, (_, k) => `${prefixe}${String(k)}`)

  it('RG-COO-216 limite : 20 couples acceptés (répartis sur plusieurs trains), 21 refusés (422) ; le message est celui de la règle', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const vingt = await trainsDeThemes(s, noms(20))
    expect((await prepa(s, await versionsDe(s, vingt))).statusCode).toBe(200)
    const s2 = await site()
    await parametre(
      ctx,
      'trains.ateliersExportPrepa',
      `${String(s.atelier.id)};${String(s2.atelier.id)}`,
    )
    const vingtEtUn = await trainsDeThemes(s2, noms(21))
    const r = await prepa(s2, await versionsDe(s2, vingtEtUn))
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      code: 'COO_THEMES_SUPERIEUR_CAPACITE',
      regle: 'RG-COO-216',
      message: 'Le nombre de thèmes ajouté est supérieur à la capacité de la machine !',
    })
    const faces = await db.faceTrain.findMany({ where: { trainId: { in: vingtEtUn } } })
    expect(faces.every((x) => x.statut === 'A_IMPRIMER' && x.version === 1)).toBe(true)
  })

  it('RG-COO-216 le couple est (thème, repiquage) : un même thème avec deux repiquages compte pour 2 ; un même couple dans deux trains, casse et accents ignorés, compte pour 1', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    await parametre(ctx, 'trains.themesMaxExportPrepa', '2')
    const a = await trainExportable(ctx, s, ['Été'], { statut: 'A_IMPRIMER', repiquage: 'R1' })
    const b = await trainExportable(ctx, s, ['ETE'], { statut: 'A_IMPRIMER', repiquage: 'r1' })
    expect((await prepa(s, await versionsDe(s, [a.trainId, b.trainId]))).statusCode).toBe(200)
    const s2 = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s2.atelier.id))
    const c = await trainExportable(ctx, s2, ['Été'], { statut: 'A_IMPRIMER', repiquage: 'R1' })
    const d = await trainExportable(ctx, s2, ['Été'], { statut: 'A_IMPRIMER', repiquage: 'R2' })
    const e = await trainExportable(ctx, s2, ['Été'], { statut: 'A_IMPRIMER' })
    const refus = await prepa(s2, await versionsDe(s2, [c.trainId, d.trainId, e.trainId]))
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus).details).toMatchObject({ themes: 3, max: 2 })
  })

  it('RG-COO-216 le plafond est compté par atelier et par semaine : 20 + 20 sur deux ateliers passent ; les faces « Export prépa » d’une autre semaine ne comptent pas', async () => {
    const s = await site()
    await parametre(
      ctx,
      'trains.ateliersExportPrepa',
      `${String(s.atelier.id)};${String(s.atelier2.id)}`,
    )
    const un = await trainsDeThemes(s, noms(20, 'A'))
    const deux = await trainsDeThemes(s, noms(20, 'B'), { atelierId: s.atelier2.id })
    expect((await prepa(s, await versionsDe(s, [...un, ...deux]))).statusCode).toBe(200)

    const autreSemaine = {
      annee: SEM.annee + (SEM.semaine >= 52 ? 1 : 0),
      semaine: SEM.semaine >= 52 ? 1 : SEM.semaine + 1,
    }
    const s2 = await site()
    await parametre(
      ctx,
      'trains.ateliersExportPrepa',
      `${String(s.atelier.id)};${String(s2.atelier.id)}`,
    )
    for (const theme of noms(20, 'Z'))
      await trainExportable(ctx, s2, [theme], {
        statut: 'EXPORT_PREPA',
        extra: { depAnbas: autreSemaine.annee, depSembas: autreSemaine.semaine },
      })
    const t = await trainExportable(ctx, s2, ['Nouveau'], { statut: 'A_IMPRIMER' })
    expect((await prepa(s2, await versionsDe(s2, [t.trainId]))).statusCode).toBe(200)
  })

  it('RG-COO-216 / RG-COO-217 retirer un thème de l’export libère de la capacité : à 2 thèmes max, A et B à « Export prépa » ; B retiré (9 → 5) ; C passe', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    await parametre(ctx, 'trains.themesMaxExportPrepa', '2')
    const [ia, ib, ic] = await trainsDeThemes(s, ['A', 'B', 'C'])
    expect((await prepa(s, await versionsDe(s, [ia ?? '', ib ?? '']))).statusCode).toBe(200)
    expect((await prepa(s, await versionsDe(s, [ic ?? '']))).statusCode).toBe(422)
    const faceB = await db.faceTrain.findFirstOrThrow({ where: { trainId: ib ?? '' } })
    const retrait = await envoyer(
      ctx,
      '/api/coordination/trains/supprimer-theme-export',
      s.users.cheq.headers,
      {
        atelierId: s.atelier.id,
        depart: DEPART_TXT,
        contNum: faceB.contNum,
        theme: 'B',
      },
    )
    expect(retrait.statusCode, retrait.body).toBe(200)
    expect((await prepa(s, await versionsDe(s, [ic ?? '']))).statusCode).toBe(200)
  })
})

// ═════════════════════════ RG-COO-217 Au roulage, thème retiré de l'export ═════════════════════════

describe('RG-COO-217 « Au roulage » : une seule transition autorisée (9 → 10), rouleur obligatoire', () => {
  it.each([
    'INSTRUCTION_OK',
    'A_IMPRIMER',
    'AU_ROULAGE',
    'A_EXPEDIER',
    'TERMINE',
    'PREPARE',
  ] as const)(
    'RG-COO-217 transition interdite : des faces « %s » ne passent pas « Au roulage » (409), rien n’est écrit',
    async (statut) => {
      const s = await site()
      const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
      const t = await trainExportable(ctx, s, ['Rose'], { statut })
      const r = await roulage(s, await versionsDe(s, [t.trainId]), rouleur.id)
      expect(r.statusCode, r.body).toBe(409)
      expect(erreur(r)).toMatchObject({
        regle: 'RG-COO-217',
        message: "Les faces des trains ne sont pas dans le statut 'Export prépa' !",
      })
      expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
        statut,
        rouleurId: null,
        version: 1,
      })
      expect(
        await db.statutHistorique.count({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(t.faces[0]?.id) },
        }),
      ).toBe(0)
    },
  )

  it('RG-COO-217 un train dont une seule face n’est pas « Export prépa » est refusé en entier : l’autre face reste à 9, sans rouleur', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'EXPORT_PREPA' })
    await db.faceTrain.update({
      where: { id: t.faces[1]?.id ?? 0 },
      data: { statut: 'A_IMPRIMER' },
    })
    const r = await roulage(s, await versionsDe(s, [t.trainId]), rouleur.id)
    expect(r.statusCode).toBe(409)
    expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
      statut: 'EXPORT_PREPA',
      rouleurId: null,
    })
  })

  it('RG-COO-217 rouleur : sans atelier, valide pour tout atelier ; fin de validité demain valide, hier refusée ; ex. un seul rouleur pour deux trains de deux ateliers', async () => {
    const s = await site()
    const libre = await f.createRouleur(db, { atelierId: null, nom: 'Rouleur libre' })
    const demain = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      dateFin: new Date(Date.now() + 86_400_000),
    })
    const hier = await f.createRouleur(db, {
      atelierId: s.atelier.id,
      dateFin: new Date(Date.now() - 86_400_000),
    })
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'EXPORT_PREPA' })
    const b = await trainExportable(ctx, s, ['Gris'], {
      statut: 'EXPORT_PREPA',
      atelierId: s.atelier2.id,
    })
    const v = await versionsDe(s, [a.trainId, b.trainId])
    expect((await roulage(s, v, hier.id)).statusCode).toBe(404)
    expect((await roulage(s, v, demain.id)).statusCode).toBe(422)
    const ok = await roulage(s, v, libre.id)
    expect(ok.statusCode, ok.body).toBe(200)
    for (const t of [a, b])
      expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
        statut: 'AU_ROULAGE',
        rouleurId: libre.id,
      })
    const c = await trainExportable(ctx, s, ['Bleu'], { statut: 'EXPORT_PREPA' })
    expect((await roulage(s, await versionsDe(s, [c.trainId]), demain.id)).statusCode).toBe(200)
  })

  it('RG-COO-217 / RG-COO-308 version périmée : la version lue avant l’export préparation est périmée (409), rien n’est écrit', async () => {
    const s = await site()
    await parametre(ctx, 'trains.ateliersExportPrepa', String(s.atelier.id))
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const lue = await versionsDe(s, [t.trainId])
    expect((await prepa(s, lue)).statusCode).toBe(200)
    const r = await roulage(s, lue, rouleur.id)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
    expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
      statut: 'EXPORT_PREPA',
      rouleurId: null,
    })
    expect((await roulage(s, await versionsDe(s, [t.trainId]), rouleur.id)).statusCode).toBe(200)
  })

  it('RG-COO-217 idempotence : même clé deux fois = un seul passage (un historique par face, un journal) ; une autre clé sur les mêmes faces → 409', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'EXPORT_PREPA' })
    const v = await versionsDe(s, [t.trainId])
    const cle = idem()
    const a = await roulage(s, v, rouleur.id, s.users.cheq.headers, cle)
    const b = await roulage(s, v, rouleur.id, s.users.cheq.headers, cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(b.json()).toEqual(a.json())
    for (const face of t.faces)
      expect(
        await db.statutHistorique.count({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(face.id), nouveau: 'AU_ROULAGE' },
        }),
      ).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'AU_ROULAGE' },
      }),
    ).toBe(1)
    expect((await roulage(s, v, rouleur.id)).statusCode).toBe(409)
  })

  it('RG-COO-217 supprimer un thème de l’export : transitions interdites (faces « A imprimer », « Au roulage ») → 409 ; autorisée 9 → 5 avec historique par face et rouleur / autres thèmes intacts ; les faces de tous les trains du thème repassent', async () => {
    const s = await site()
    const c = contNumAleatoire(850_000)
    const t1 = await trainExportable(ctx, s, ['Rose', 'Gris'], {
      statut: 'EXPORT_PREPA',
      extra: { contNum: c },
    })
    const t2 = await trainExportable(ctx, s, ['Rose'], {
      statut: 'EXPORT_PREPA',
      extra: { contNum: c },
    })
    const url = '/api/coordination/trains/supprimer-theme-export'
    const corps = (theme: string) => ({
      atelierId: s.atelier.id,
      depart: DEPART_TXT,
      contNum: c,
      theme,
    })
    // « Gris » du même dossier dont une face est déjà au roulage : refus, rien ne change.
    await db.faceTrain.update({
      where: { id: t1.faces[1]?.id ?? 0 },
      data: { statut: 'AU_ROULAGE' },
    })
    const refus = await envoyer(ctx, url, s.users.cheq.headers, corps('Gris'))
    expect(refus.statusCode).toBe(409)
    expect((await faceDe(t1.faces[1]?.id ?? 0)).statut).toBe('AU_ROULAGE')
    const ok = await envoyer(ctx, url, s.users.cheq.headers, corps('Rose'))
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ok.json<{ nombre: number }>().nombre).toBe(2)
    for (const face of [t1.faces[0], t2.faces[0]]) {
      expect((await faceDe(face?.id ?? 0)).statut).toBe('A_IMPRIMER')
      expect(
        await db.statutHistorique.findFirst({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(face?.id), nouveau: 'A_IMPRIMER' },
        }),
      ).toMatchObject({ ancien: 'EXPORT_PREPA', parId: s.users.cheq.id, regle: 'RG-COO-217' })
    }
    // Un thème maintenant « A imprimer » ne peut plus être retiré (9 → 5 uniquement).
    expect((await envoyer(ctx, url, s.users.cheq.headers, corps('Rose'))).statusCode).toBe(409)
  })

  it('RG-COO-217 atomicité du retrait d’un thème : un échec sur la 2e face annule le retour de la 1re à « A imprimer » ; idempotence : même clé, un seul retrait', async () => {
    const s = await site()
    const c = contNumAleatoire(860_000)
    const t1 = await trainExportable(ctx, s, ['Rose'], {
      statut: 'EXPORT_PREPA',
      extra: { contNum: c },
    })
    const t2 = await trainExportable(ctx, s, ['Rose'], {
      statut: 'EXPORT_PREPA',
      extra: { contNum: c },
    })
    const url = '/api/coordination/trains/supprimer-theme-export'
    const corps = { atelierId: s.atelier.id, depart: DEPART_TXT, contNum: c, theme: 'Rose' }
    const r = await avecEchec(
      ctx,
      `BEFORE UPDATE ON tf_face_train WHEN NEW.ft_id = ${String(t2.faces[0]?.id)}`,
      () => envoyer(ctx, url, s.users.cheq.headers, corps),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    for (const t of [t1, t2])
      expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
        statut: 'EXPORT_PREPA',
        version: 1,
      })
    const cle = idem()
    const a = await envoyer(ctx, url, s.users.cheq.headers, corps, cle)
    const b = await envoyer(ctx, url, s.users.cheq.headers, corps, cle)
    expect(b.json()).toEqual(a.json())
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: t1.trainId, action: 'SUPPRESSION_THEME_EXPORT' },
      }),
    ).toBe(1)
  })
})

// ═════════════════════════ RG-COO-236 choisir le rouleur ═════════════════════════

describe('RG-COO-236 choisir le rouleur : périmètre, statuts, versions', () => {
  it('RG-COO-236 l’affectation écrit seulement le rouleur : aucun changement de statut ni historique de statut ; rouleur sans atelier accepté sur deux ateliers', async () => {
    const s = await site()
    const libre = await f.createRouleur(db, { atelierId: null })
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris'], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
    })
    const r = await affecter(s, await versionsDe(s, [a.trainId, b.trainId]), libre.id)
    expect(r.statusCode, r.body).toBe(200)
    for (const t of [a, b]) {
      expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
        statut: 'A_IMPRIMER',
        rouleurId: libre.id,
      })
      expect(
        await db.statutHistorique.count({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(t.faces[0]?.id) },
        }),
      ).toBe(0)
    }
  })

  it('RG-COO-236 un rouleur d’un atelier ne peut pas être affecté à une sélection qui couvre aussi un autre atelier (422), rien n’est écrit', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const a = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const b = await trainExportable(ctx, s, ['Gris'], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
    })
    const r = await affecter(s, await versionsDe(s, [a.trainId, b.trainId]), rouleur.id)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_ROULEUR_AUTRE_ATELIER', regle: 'RG-COO-236' })
    expect(await instantane([a.faces[0]?.id ?? 0, b.faces[0]?.id ?? 0])).toEqual([
      [a.faces[0]?.id, 'A_IMPRIMER', 1, null, false],
      [b.faces[0]?.id, 'A_IMPRIMER', 1, null, false],
    ])
  })

  it('RG-COO-236 / Q-250 un train « Export prépa » (9 → En production) ne peut plus changer de rouleur (409, RG-COO-223) ; le rouleur se pose à « Au roulage »', async () => {
    const s = await site()
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'EXPORT_PREPA' })
    const r = await affecter(s, await versionsDe(s, [t.trainId]), rouleur.id)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-223')
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBeNull()
  })

  it('RG-COO-236 / RG-COO-308 version périmée entre deux affectations (409) ; la version relue passe ; journal ancien → nouveau', async () => {
    const s = await site()
    const r1 = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur N1' })
    const r2 = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur N2' })
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const lue = await versionsDe(s, [t.trainId])
    expect((await affecter(s, lue, r1.id)).statusCode).toBe(200)
    const perimee = await affecter(s, lue, r2.id)
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
    expect((await faceDe(t.faces[0]?.id ?? 0)).rouleurId).toBe(r1.id)
    expect((await affecter(s, await versionsDe(s, [t.trainId]), r2.id)).statusCode).toBe(200)
    const dernier = await db.journalAudit.findFirstOrThrow({
      where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'AFFECTATION_ROULEUR' },
      orderBy: { id: 'desc' },
    })
    expect([dernier.ancienneValeur, dernier.nouvelleValeur, dernier.parId]).toEqual([
      'Rouleur N1',
      'Rouleur N2',
      s.users.cheq.id,
    ])
  })

  it('RG-COO-236 liste des rouleurs : un rouleur dont la fin de validité est demain est proposé, hier non ; les profils hors admin (coord, cheq autorisés)', async () => {
    const s = await site()
    await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Demain',
      dateFin: new Date(Date.now() + 86_400_000),
    })
    await f.createRouleur(db, {
      atelierId: s.atelier.id,
      nom: 'Hier',
      dateFin: new Date(Date.now() - 86_400_000),
    })
    for (const role of ROLES_SANS_ADMIN) {
      const r = await get(
        ctx,
        `/api/coordination/trains/rouleurs?atelier=${String(s.atelier.id)}`,
        s.users[role].headers,
      )
      expect(r.statusCode, role).toBe(autorise(role, ['coord', 'cheq']) ? 200 : 403)
      if (r.statusCode === 200) {
        const noms = r.json<{ rouleurs: { nom: string }[] }>().rouleurs.map((x) => x.nom)
        expect(noms).toContain('Demain')
        expect(noms).not.toContain('Hier')
      }
    }
  })
})

// ═════════════════════════ RG-COO-230 à 233 suivi par thème ═════════════════════════

describe('RG-COO-230 suivi par thème : besoin, couvert (limites), filtres', () => {
  it('RG-COO-230 couvert = reçu ≥ attendu : reçu 0 et attendu 1 → Non ; reçu = attendu → Oui ; reçu > attendu → Oui ; reçu attendu − 1 → Non', async () => {
    const s = await site()
    const c = contNumAleatoire(870_000)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    expect(themeDe(await besoin(s), 'Rose')).toMatchObject({
      besoin: 2,
      attendu: 2,
      recu: 0,
      couvert: false,
    })
    await recu(ctx, s, c, 'Rose', 1)
    expect(themeDe(await besoin(s), 'Rose')).toMatchObject({ recu: 1, couvert: false })
    await recu(ctx, s, c, 'Rose', 1)
    expect(themeDe(await besoin(s), 'Rose')).toMatchObject({ recu: 2, couvert: true })
    await recu(ctx, s, c, 'Rose', 3)
    expect(themeDe(await besoin(s), 'Rose')).toMatchObject({ recu: 5, attendu: 2, couvert: true })
  })

  it('RG-COO-230 le reçu d’un autre site ne couvre pas le thème ; l’emplacement n’est renseigné que pour un thème reçu', async () => {
    const s = await site()
    const autre = await site()
    const c = contNumAleatoire(880_000)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await recu(ctx, autre, c, 'Rose', 5)
    expect(themeDe(await besoin(s), 'Rose')).toMatchObject({
      recu: 0,
      couvert: false,
      emplacement: null,
    })
    await recu(ctx, s, c, 'Rose', 1)
    expect(themeDe(await besoin(s), 'Rose')).toMatchObject({
      recu: 1,
      couvert: true,
      emplacement: 'B-12',
    })
  })

  it('RG-COO-230 filtres (atelier, destinataire, afficheur, « trains de n ») appliqués côté API', async () => {
    const s = await site()
    const autreDest = await f.createDestinataire(db, { nom: 'ZZ Destinataire Unique' })
    const c = contNumAleatoire(890_000)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Gris', 'Bleu'], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
      extra: { contNum: c + 1, destinataireId: autreDest.id, afficheurNom: 'ZZ AFFICHEUR UNIQUE' },
    })
    const themes = async (qs: string) => (await besoin(s, qs)).lignes.map((l) => l.theme).sort()
    expect(await themes('')).toEqual(['Bleu', 'Gris', 'Rose'])
    expect(await themes(`&atelier=${String(s.atelier2.id)}`)).toEqual(['Bleu', 'Gris'])
    expect(await themes('&destinataire=zz destinataire')).toEqual(['Bleu', 'Gris'])
    expect(await themes('&afficheur=zz affich')).toEqual(['Bleu', 'Gris'])
    expect(await themes('&trainsDe=2')).toEqual(['Bleu', 'Gris'])
    expect(await themes('&trainsDe=1')).toEqual(['Rose'])
    expect(await themes('&afficheur=inexistant')).toEqual([])
  })

  it('RG-COO-231 exclusion : seul le thème signalé du dossier et du site est exclu ; les autres thèmes, un même nom de thème d’un autre dossier et l’annotation (une fois par thème) sont corrects', async () => {
    const s = await site()
    const c = contNumAleatoire(900_000)
    await trainExportable(ctx, s, ['Paris'], {
      statut: 'A_IMPRIMER',
      annonceur: 'VILLE',
      extra: { contNum: c },
    })
    await trainExportable(ctx, s, ['Paris'], {
      statut: 'A_IMPRIMER',
      annonceur: 'VILLE',
      extra: { contNum: c },
    })
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Paris'], {
      statut: 'A_IMPRIMER',
      annonceur: 'AUTRE',
      extra: { contNum: c + 1 },
    })
    await recu(ctx, s, c, 'Paris', 0, { exclu: true })
    const b = await besoin(s)
    expect(b.lignes.map((l) => `${String(l.contNum)}|${l.theme}`).sort()).toEqual(
      [`${String(c)}|Rose`, `${String(c + 1)}|Paris`].sort(),
    )
    expect(b.exclus).toEqual(['VILLE · Paris'])
    expect(b.lignes.every((l) => !l.exclu)).toBe(true)
  })

  it('RG-COO-232 / Q-263 aucun filtre sur le commentaire de préparation : un dossier avec Instruction OK automatique et un dossier avec commentaire sont tous deux listés', async () => {
    const s = await site()
    const a = await trainExportable(ctx, s, ['Auto'], { statut: 'A_IMPRIMER', iokMode: 'AUTO' })
    const b = await trainExportable(ctx, s, ['Commentaire'], {
      statut: 'A_IMPRIMER',
      iokMode: 'MANUEL',
    })
    await db.instruction.update({
      where: { code: b.instructions[0]?.code ?? '' },
      data: { commentaire: 'à surveiller' },
    })
    expect(a.faces).toHaveLength(1)
    expect((await besoin(s)).lignes.map((l) => l.theme).sort()).toEqual(['Auto', 'Commentaire'])
  })

  it('RG-COO-230 / RG-COO-167 un autre site ne voit aucun thème ; les profils hors admin ; 401 sans identité ; périodes invalides → 400', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    for (const role of ROLES_SANS_ADMIN) {
      const r = await get(
        ctx,
        `/api/coordination/trains/besoin?depart=${DEPART_TXT}`,
        s.users[role].headers,
      )
      expect(r.statusCode, role).toBe(autorise(role, ['coord', 'cheq']) ? 200 : 403)
      if (!autorise(role, ['coord', 'cheq']))
        expect(erreur(r).regle).toBe(role === 'com' ? 'RG-COO-168' : 'RG-COO-165')
    }
    for (const qs of [
      'depart=2026-W54',
      'depart=abc',
      `depart=${DEPART_TXT}&dossier=abc`,
      `depart=${DEPART_TXT}&dossier=0`,
      `depart=${DEPART_TXT}&trainsDe=0`,
      `depart=${DEPART_TXT}&trainsDe=10`,
      `depart=${DEPART_TXT}&atelier=x`,
    ])
      expect(
        (await get(ctx, `/api/coordination/trains/besoin?${qs}`, s.users.coord.headers)).statusCode,
        qs,
      ).toBe(400)
  })
})

describe('RG-COO-233 pré-assemblage : lot de thèmes, version, aucune condition de statut', () => {
  const marquer = (
    s: SiteD,
    themes: unknown[],
    valeur: boolean,
    headers = s.users.cheq.headers,
    cle = idem(),
  ) => envoyer(ctx, '/api/coordination/trains/pre-assemblage', headers, { themes, valeur }, cle)
  const cible = async (s: SiteD, contNum: number, theme: string) => {
    const l = themeDe(await besoin(s, `&dossier=${String(contNum)}`), theme)
    if (!l) throw new Error('thème absent du besoin')
    return { atelierId: l.atelierId, depart: DEPART_TXT, contNum, theme, version: l.version }
  }

  it('RG-COO-233 plusieurs thèmes en une action : tous marqués ; si le 2e est périmé (409), le 1er n’est pas marqué (atomicité)', async () => {
    const s = await site()
    const c = contNumAleatoire(910_000)
    const a = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const b = await trainExportable(ctx, s, ['Gris'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const rose = await cible(s, c, 'Rose')
    const gris = await cible(s, c, 'Gris')
    const perime = await marquer(s, [rose, { ...gris, version: '9.9.9' }], true)
    expect(perime.statusCode).toBe(409)
    expect(erreur(perime)).toMatchObject({ code: 'COO_CONFLIT_VERSION', regle: 'RG-COO-308' })
    expect((await faceDe(a.faces[0]?.id ?? 0)).preAssemblage).toBe(false)
    const ok = await marquer(s, [rose, gris], true)
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ok.json<{ message: string; nombre: number }>()).toMatchObject({
      message: '2 visuel(s) pré-assemblé(s).',
      nombre: 2,
    })
    for (const t of [a, b]) expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(true)
  })

  it('RG-COO-233 / RG-COO-308 version périmée entre deux actions sur le même thème (409) ; le pré-assemblage ne modifie aucun statut de face', async () => {
    const s = await site()
    const c = contNumAleatoire(920_000)
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const lue = await cible(s, c, 'Rose')
    expect((await marquer(s, [lue], true)).statusCode).toBe(200)
    const perime = await marquer(s, [lue], false)
    expect(perime.statusCode).toBe(409)
    expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(true)
    expect((await marquer(s, [await cible(s, c, 'Rose')], false)).statusCode).toBe(200)
    expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
      statut: 'A_IMPRIMER',
      preAssemblage: false,
    })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(t.faces[0]?.id) },
      }),
    ).toBe(0)
  })

  it('RG-COO-233 aucune condition de statut (legacy) : un thème non couvert, en production ou « A imprimer » se marque sans refus', async () => {
    const s = await site()
    const c = contNumAleatoire(930_000)
    for (const [theme, statut] of [
      ['Rose', 'A_IMPRIMER'],
      ['Gris', 'AU_ROULAGE'],
      ['Bleu', 'EXPORT_PREPA'],
    ] as const) {
      const t = await trainExportable(ctx, s, [theme], { statut, extra: { contNum: c } })
      const r = await marquer(s, [await cible(s, c, theme)], true)
      expect(r.statusCode, `${theme} ${statut}`).toBe(200)
      expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(true)
    }
  })

  it('RG-COO-233 « Fait » : les visuels fractionnés ne comptent pas ; le thème est « Fait » quand tous les non fractionnés sont pré-assemblés', async () => {
    const s = await site()
    const c = contNumAleatoire(940_000)
    const a = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const b = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    expect(themeDe(await besoin(s), 'Rose')?.preAssemble).toBe(false)
    await db.faceTrain.update({ where: { id: a.faces[0]?.id ?? 0 }, data: { preAssemblage: true } })
    expect(themeDe(await besoin(s), 'Rose')?.preAssemble).toBe(false)
    await db.faceTrain.update({ where: { id: b.faces[0]?.id ?? 0 }, data: { fractionnee: true } })
    expect(themeDe(await besoin(s), 'Rose')?.preAssemble).toBe(true)
  })

  it('RG-COO-233 idempotence : même clé deux fois = un seul marquage, un seul journal, version +1 ; entrées invalides (valeur, thème vide, version vide) → 400', async () => {
    const s = await site()
    const c = contNumAleatoire(950_000)
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const cb = await cible(s, c, 'Rose')
    const cle = idem()
    const a = await marquer(s, [cb], true, s.users.cheq.headers, cle)
    const b = await marquer(s, [cb], true, s.users.cheq.headers, cle)
    expect(b.json()).toEqual(a.json())
    expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({ preAssemblage: true, version: 2 })
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: t.trainId, action: 'PRE_ASSEMBLAGE' },
      }),
    ).toBe(1)
    for (const corps of [
      { themes: [cb], valeur: 'oui' },
      { themes: [{ ...cb, theme: '' }], valeur: true },
      { themes: [{ ...cb, version: '' }], valeur: true },
      { themes: [{ ...cb, contNum: 0 }], valeur: true },
      { themes: [{ ...cb, atelierId: -1 }], valeur: true },
      { themes: [{ ...cb, depart: '2026-W54' }], valeur: true },
    ])
      expect(
        (await envoyer(ctx, '/api/coordination/trains/pre-assemblage', s.users.cheq.headers, corps))
          .statusCode,
      ).toBe(400)
  })
})

// ═════════════════════════ RG-COO-235 vue Préparation (Q-175 Excel non tranché) ═════════════════════════

describe('RG-COO-235 / Q-175 vue Préparation : pas d’export Excel tant que Q-175 est ouverte', () => {
  it('Q-175 aucune route d’export Excel / xlsx de la liste ou de la préparation n’est exposée (404)', async () => {
    const s = await site()
    for (const url of [
      '/api/coordination/trains/export.xlsx',
      '/api/coordination/trains/excel',
      '/api/coordination/trains/preparation/export',
      '/api/coordination/trains/xlsx',
    ])
      expect((await get(ctx, url, s.users.coord.headers)).statusCode, url).toBe(404)
  })
})

// ═════════════════════════ ECR-GEN-01 / GEN-03 générateur de fichiers ═════════════════════════

describe('ECR-GEN-01 choix des trains, tiroirs (limite 20), périmètre', () => {
  const generation = async (s: SiteD, qs = '', headers = s.users.cheq.headers) => {
    const r = await get(ctx, `/api/coordination/generateur?depart=${DEPART_TXT}${qs}`, headers)
    expect(r.statusCode, r.body).toBe(200)
    return TrainsGenerationSchema.parse(r.json())
  }
  const preparer = (
    s: SiteD,
    trains: { trainId: string; version: string }[],
    headers = s.users.cheq.headers,
    cle = idem(),
  ) => envoyer(ctx, '/api/coordination/generateur', headers, { depart: DEPART_TXT, trains }, cle)
  const pret = async (
    s: SiteD,
    themes: string[],
    o: { repiquage?: string; extra?: Record<string, unknown> } = {},
  ) => {
    const t = await trainExportable(ctx, s, themes, {
      statut: 'A_IMPRIMER',
      ...(o.repiquage ? { repiquage: o.repiquage } : {}),
    })
    for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
    return t
  }

  it('ECR-GEN-01 limite : 20 tiroirs acceptés, 21 refusés (422, message du plafond par défaut) ; le plafond affiché est 20', async () => {
    const s = await site()
    await parametre(ctx, 'trains.positionsMax', '25')
    const vingt = await pret(
      s,
      Array.from({ length: 20 }, (_, k) => `V${String(k)}`),
    )
    expect((await generation(s)).tiroirsMax).toBe(20)
    const ok = await preparer(s, await versionsDe(s, [vingt.trainId]))
    expect(ok.statusCode, ok.body).toBe(200)
    expect(GenerationSchema.parse(ok.json()).tiroirs).toBe(20)
    const s2 = await site()
    const vingtEtUn = await pret(
      s2,
      Array.from({ length: 21 }, (_, k) => `W${String(k)}`),
    )
    const refus = await preparer(s2, await versionsDe(s2, [vingtEtUn.trainId]))
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus)).toMatchObject({
      code: 'COO_TIROIRS_DEPASSES',
      regle: 'RG-COO-216',
      message: '21 tiroirs : la Vendôme en a 20. Retirez des trains (bloquant).',
    })
    expect(await db.generationFichiers.count({ where: { parId: s2.users.cheq.id } })).toBe(0)
  })

  it('ECR-GEN-01 tiroirs = visuels distincts (dossier, thème, repiquage) : même thème avec deux repiquages = 2 tiroirs ; un thème fractionné ne compte pas', async () => {
    const s = await site()
    const c = contNumAleatoire(960_000)
    const a = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      repiquage: 'R1',
      extra: { contNum: c },
    })
    const b = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      repiquage: 'R2',
      extra: { contNum: c },
    })
    const fr = await trainExportable(ctx, s, ['Gris', 'Bleu'], { statut: 'A_IMPRIMER' })
    await db.faceTrain.update({ where: { id: fr.faces[1]?.id ?? 0 }, data: { fractionnee: true } })
    const g = await generation(s)
    expect(g.trains.find((t) => t.trainId === a.trainId)?.tiroirs).toBe(1)
    expect(g.trains.find((t) => t.trainId === fr.trainId)?.tiroirs).toBe(1)
    await recu(ctx, s, c, 'Rose', 2)
    await recu(ctx, s, fr.faces[0]?.contNum ?? 0, 'Gris', 1)
    const r = await preparer(s, await versionsDe(s, [a.trainId, b.trainId, fr.trainId]))
    expect(r.statusCode, r.body).toBe(200)
    expect(GenerationSchema.parse(r.json()).tiroirs).toBe(3)
  })

  it('ECR-GEN-01 seuls les trains prêts se préparent : une sélection mêlant un train prêt et un train en attente est refusée en bloc (409), aucun lot ; les trains EXPORT_PREPA sont « déjà envoyés »', async () => {
    const s = await site()
    const pretT = await pret(s, ['Rose'])
    const attente = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    const prod = await trainExportable(ctx, s, ['Bleu'], { statut: 'EXPORT_PREPA' })
    const r = await preparer(s, await versionsDe(s, [pretT.trainId, attente.trainId]))
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_TRAIN_NON_PRET')
    expect(erreur(r).details).toMatchObject({ trains: [attente.trainId] })
    expect(await db.generationFichiers.count({ where: { parId: s.users.cheq.id } })).toBe(0)
    const g = await generation(s)
    expect(g.trains.find((t) => t.trainId === prod.trainId)?.statut).toBe('DEJA_ENVOYE')
    const enProd = await preparer(s, await versionsDe(s, [prod.trainId]))
    expect(enProd.statusCode).toBe(409)
  })

  // ANO-047 : l'historique des générations (GET /coordination/generateur → `historique`) liste les lots de tous les
  // sites pour la semaine (filtre sur le seul départ). Suspect : generation-fichiers.ts:76-80 (findMany sans périmètre).
  it('ECR-GEN-01 / RG-COO-167 ANO-047 l’historique des générations ne montre pas les lots d’un autre site', async () => {
    const s = await site()
    const autre = await site()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, await versionsDe(s, [t.trainId]))).json())
    expect(
      (await generation(autre, '', autre.users.cheq.headers)).historique.some((h) => h.id === g.id),
    ).toBe(false)
  })

  // ANO-048 : le fichier d'un lot de génération se télécharge par id sans contrôle de périmètre.
  // Suspect : generation-fichiers.ts:287-292 (fichierGeneration).
  it('ECR-GEN-01 / RG-COO-167 ANO-048 le fichier d’un lot d’un autre site n’est pas téléchargeable', async () => {
    const s = await site()
    const autre = await site()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, await versionsDe(s, [t.trainId]))).json())
    const fichier = await get(
      ctx,
      `/api/coordination/generateur/${String(g.id)}/fichier`,
      autre.users.cheq.headers,
    )
    expect([403, 404]).toContain(fichier.statusCode)
  })

  it('ECR-GEN-01 / RG-COO-167 un autre site ne peut ni envoyer à la machine ni modifier le lot d’un site tiers (403 / 404) : le lot reste « Préparé »', async () => {
    const s = await site()
    const autre = await site()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse((await preparer(s, await versionsDe(s, [t.trainId]))).json())
    const envoi = await envoyer(
      ctx,
      '/api/coordination/generateur/envoyer',
      autre.users.cheq.headers,
      { id: g.id, version: g.version },
    )
    expect([403, 404]).toContain(envoi.statusCode)
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).statut).toBe(
      'PREPARE',
    )
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })
})

describe('GEN-03 envoi à la machine : port refusé en production, un seul envoi, aucun envoi si refus', () => {
  const machine = new MachineSimulee()
  const machineProd: MachinePort = new MachineNonConfiguree()
  const appSimulee = buildApp({ config: loadConfig(), db, machine })
  const appProd = buildApp({ config: loadConfig(), db, machine: machineProd })
  beforeAll(async () => {
    await appSimulee.ready()
    await appProd.ready()
  })
  afterAll(async () => {
    await appSimulee.close()
    await appProd.close()
  })

  const sur = (
    app: typeof appSimulee,
    url: string,
    headers: Record<string, string>,
    payload: unknown,
    cle = idem(),
  ) =>
    app.inject({ method: 'POST', url, headers: { ...headers, ...cle }, payload: payload as object })
  async function lotPret(s: SiteD, app: typeof appSimulee) {
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
    const r = await sur(app, '/api/coordination/generateur', s.users.cheq.headers, {
      depart: DEPART_TXT,
      trains: await versionsDe(s, [t.trainId]),
    })
    expect(r.statusCode, r.body).toBe(200)
    return { t, g: GenerationSchema.parse(r.json()) }
  }

  it('GEN-03 envoi refusé en production (port non configuré) : 422 COO_ENVOI_MACHINE_ECHEC, jamais de succès simulé ; le lot reste « Préparé », les faces et le journal sont inchangés', async () => {
    const s = await site()
    const { t, g } = await lotPret(s, appProd)
    const avant = await instantane(t.faces.map((x) => x.id))
    const r = await sur(appProd, '/api/coordination/generateur/envoyer', s.users.cheq.headers, {
      id: g.id,
      version: g.version,
    })
    expect(r.statusCode, r.body).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_ENVOI_MACHINE_ECHEC', regle: 'RG-COO-217' })
    expect(erreur(r).message).toContain('non configuré')
    expect(await instantane(t.faces.map((x) => x.id))).toEqual(avant)
    expect(await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).toMatchObject({
      statut: 'PREPARE',
      version: 1,
      envoyeLe: null,
    })
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'GENERATION_FICHIERS',
          entiteId: String(g.id),
          action: 'ENVOI_MACHINE',
        },
      }),
    ).toBe(0)
    // La préparation du fichier (simulé, marqué) reste possible en production.
    expect(g.contenu.startsWith('# SIMULATION')).toBe(true)
  })

  it('GEN-03 envoi simulé : le fichier du lot (nom, contenu) est remis une seule fois à la machine ; le rejeu avec la même clé n’envoie pas une seconde fois', async () => {
    const s = await site()
    const { t, g } = await lotPret(s, appSimulee)
    const avant = machine.envoyes.length
    const cle = idem()
    const a = await sur(
      appSimulee,
      '/api/coordination/generateur/envoyer',
      s.users.cheq.headers,
      { id: g.id, version: g.version },
      cle,
    )
    const b = await sur(
      appSimulee,
      '/api/coordination/generateur/envoyer',
      s.users.cheq.headers,
      { id: g.id, version: g.version },
      cle,
    )
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(b.json()).toEqual(a.json())
    expect(machine.envoyes).toHaveLength(avant + 1)
    expect(machine.envoyes.at(-1)).toEqual({
      lot: g.lot,
      nomFichier: g.nomFichier,
      contenu: g.contenu,
    })
    // Audit B2 : l'envoi ne passe PAS les faces « Au roulage » (pas de rouleur, RG-COO-217).
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it('GEN-03 aucun fichier n’est remis à la machine quand une règle refuse l’envoi (version périmée, train plus prêt, train modifié depuis le « Préparer », deuxième envoi)', async () => {
    const s = await site()
    const { g } = await lotPret(s, appSimulee)
    const avant = machine.envoyes.length
    expect(
      (
        await sur(appSimulee, '/api/coordination/generateur/envoyer', s.users.cheq.headers, {
          id: g.id,
          version: 9,
        })
      ).statusCode,
    ).toBe(409)
    // B3 : un train dont les visuels ne sont plus tous reçus n'est plus PRET : 409, rien n'est remis.
    const t2 = await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER' })
    await recu(ctx, s, t2.faces[0]?.contNum ?? 0, 'Gris', 1)
    const g2 = GenerationSchema.parse(
      (
        await sur(appSimulee, '/api/coordination/generateur', s.users.cheq.headers, {
          depart: DEPART_TXT,
          trains: await versionsDe(s, [t2.trainId]),
        })
      ).json(),
    )
    await db.afficheAttendue.updateMany({
      where: { ligneAttendue: { contNum: t2.faces[0]?.contNum ?? 0, theme: 'Gris' } },
      data: { actif: false },
    })
    const refus2 = await sur(
      appSimulee,
      '/api/coordination/generateur/envoyer',
      s.users.cheq.headers,
      {
        id: g2.id,
        version: g2.version,
      },
    )
    expect(refus2.statusCode).toBe(409)
    expect(erreur(refus2)).toMatchObject({ code: 'COO_TRAIN_NON_PRET', regle: 'RG-COO-208' })
    // B3 : un train modifié depuis le « Préparer » (face réécrite : sa version change) : 409 COO_TRAIN_MODIFIE.
    const t3 = await trainExportable(ctx, s, ['Vert'], { statut: 'A_IMPRIMER' })
    await recu(ctx, s, t3.faces[0]?.contNum ?? 0, 'Vert', 1)
    const g3 = GenerationSchema.parse(
      (
        await sur(appSimulee, '/api/coordination/generateur', s.users.cheq.headers, {
          depart: DEPART_TXT,
          trains: await versionsDe(s, [t3.trainId]),
        })
      ).json(),
    )
    await db.faceTrain.update({
      where: { id: t3.faces[0]?.id ?? 0 },
      data: { version: { increment: 1 } },
    })
    const refus3 = await sur(
      appSimulee,
      '/api/coordination/generateur/envoyer',
      s.users.cheq.headers,
      {
        id: g3.id,
        version: g3.version,
      },
    )
    expect(refus3.statusCode).toBe(409)
    expect(erreur(refus3)).toMatchObject({ code: 'COO_TRAIN_MODIFIE', regle: 'RG-COO-308' })
    expect(
      (await db.generationFichiers.findMany({ where: { id: { in: [g2.id, g3.id] } } })).map(
        (l) => l.statut,
      ),
    ).toEqual(['PREPARE', 'PREPARE'])
    expect(machine.envoyes).toHaveLength(avant)
    expect(
      (
        await sur(appSimulee, '/api/coordination/generateur/envoyer', s.users.cheq.headers, {
          id: g.id,
          version: g.version,
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await sur(appSimulee, '/api/coordination/generateur/envoyer', s.users.cheq.headers, {
          id: g.id,
          version: 2,
        })
      ).statusCode,
    ).toBe(409)
    expect(machine.envoyes).toHaveLength(avant + 1)
  })

  it('GEN-03 / RG-COO-308 concurrence : deux envois simultanés du même lot (même version) → un 200 et un 409, et le fichier n’est remis qu’UNE fois à la machine', async () => {
    const s = await site()
    const { g } = await lotPret(s, appSimulee)
    const avant = machine.envoyes.length
    const corps = { id: g.id, version: g.version }
    const [x, y] = await Promise.all([
      sur(appSimulee, '/api/coordination/generateur/envoyer', s.users.cheq.headers, corps),
      sur(appSimulee, '/api/coordination/generateur/envoyer', s.users.cheq.headers, corps),
    ])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    expect(machine.envoyes.length - avant).toBe(1)
  })

  it.each([
    ['la mise à jour du lot', "BEFORE UPDATE ON generation_fichiers WHEN NEW.statut = 'ENVOYE'"],
    ['le journal de l’envoi', "BEFORE INSERT ON journal_audit WHEN NEW.complement = 'RG-COO-217'"],
  ])(
    'GEN-03 / RG-COO-217 Q-193 (14) une écriture en échec (%s) : le fichier n’est PAS remis à la machine (le dépôt est la dernière opération), le lot reste « Préparé », les faces sont inchangées ; la même clé rejouée ensuite réussit',
    async (_nom, declencheur) => {
      const s = await site()
      const { t, g } = await lotPret(s, appSimulee)
      const avant = machine.envoyes.length
      const faces = await instantane(t.faces.map((x) => x.id))
      const cle = idem()
      const r = await avecEchec(ctx, declencheur, () =>
        sur(
          appSimulee,
          '/api/coordination/generateur/envoyer',
          s.users.cheq.headers,
          { id: g.id, version: g.version },
          cle,
        ),
      )
      expect(r.statusCode).toBeGreaterThanOrEqual(400)
      expect(machine.envoyes).toHaveLength(avant)
      expect(await instantane(t.faces.map((x) => x.id))).toEqual(faces)
      expect(await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).toMatchObject({
        statut: 'PREPARE',
        version: 1,
        envoyeLe: null,
      })
      const retry = await sur(
        appSimulee,
        '/api/coordination/generateur/envoyer',
        s.users.cheq.headers,
        { id: g.id, version: g.version },
        cle,
      )
      expect(retry.statusCode, retry.body).toBe(200)
      expect(machine.envoyes).toHaveLength(avant + 1)
    },
  )

  it('GEN-03 / RG-COO-217 audit B2 : l’envoi n’écrit AUCUNE face (un déclencheur qui interdirait toute mise à jour de face ne l’empêche pas) et le lot porte la machine', async () => {
    const s = await site()
    const { t, g } = await lotPret(s, appSimulee)
    const faces = await instantane(t.faces.map((x) => x.id))
    const r = await avecEchec(ctx, 'BEFORE UPDATE ON tf_face_train', () =>
      sur(appSimulee, '/api/coordination/generateur/envoyer', s.users.cheq.headers, {
        id: g.id,
        version: g.version,
      }),
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(GenerationSchema.parse(r.json()).machine).toBe('simulee')
    expect(await instantane(t.faces.map((x) => x.id))).toEqual(faces)
  })
})

// ═════════════════════════ Entrées invalides (400), authentification (401) ═════════════════════════

describe('COO-P10 entrées invalides (400) et authentification (401) sur toutes les routes', () => {
  const T = [{ trainId: '8000000000000001', version: '1.1.1' }]
  const ROUTES_POST: [string, unknown][] = [
    ['/api/coordination/trains/export', { depart: DEPART_TXT }],
    ['/api/coordination/trains/export-preparation', { trains: T }],
    ['/api/coordination/trains/au-roulage', { trains: T, rouleurId: 1 }],
    [
      '/api/coordination/trains/supprimer-theme-export',
      { atelierId: 1, depart: DEPART_TXT, contNum: 1, theme: 'A' },
    ],
    ['/api/coordination/trains/rouleur', { trains: T, rouleurId: 1 }],
    [
      '/api/coordination/trains/pre-assemblage',
      {
        themes: [{ atelierId: 1, depart: DEPART_TXT, contNum: 1, theme: 'A', version: '1.1.1' }],
        valeur: true,
      },
    ],
    ['/api/coordination/generateur', { depart: DEPART_TXT, trains: T }],
    ['/api/coordination/generateur/envoyer', { id: 1, version: 1 }],
  ]
  const ROUTES_GET = [
    `/api/coordination/trains/export/apercu?depart=${DEPART_TXT}`,
    '/api/coordination/trains/export/historique',
    '/api/coordination/trains/export/1/fichier',
    '/api/coordination/trains/rouleurs?atelier=1',
    '/api/coordination/trains/besoin',
    '/api/coordination/generateur',
    '/api/coordination/generateur/1/fichier',
  ]

  it.each(ROUTES_POST)(
    '401 POST %s sans identité (corps valide, clé présente)',
    async (url, corps) => {
      const r = await ctx.app.inject({
        method: 'POST',
        url,
        headers: idem(),
        payload: corps as object,
      })
      expect(r.statusCode).toBe(401)
    },
  )
  it.each(ROUTES_GET)('401 GET %s sans identité', async (url) => {
    expect((await ctx.app.inject({ method: 'GET', url })).statusCode).toBe(401)
  })
  it('401 une identité inconnue ou une signature falsifiée est refusée (aucun accès par défaut)', async () => {
    const s = await site()
    expect(
      (await get(ctx, '/api/coordination/trains/besoin', devHeaders('utilisateur-inconnu-p10')))
        .statusCode,
    ).toBe(401)
    const [nom, valeur] = Object.entries(s.users.coord.headers)[0] ?? ['', '']
    const falsifie = { [nom]: `${valeur.slice(0, -2)}xx` }
    expect((await get(ctx, '/api/coordination/trains/besoin', falsifie)).statusCode).toBe(401)
  })

  it.each(ROUTES_POST)(
    '400 POST %s sans en-tête Idempotency-Key : refus, aucune écriture',
    async (url, corps) => {
      const s = await site()
      const avant = await db.cleIdempotence.count()
      const r = await post(ctx, url, s.users.coord.headers, corps, false)
      expect(r.statusCode, r.body).toBe(400)
      expect(await db.cleIdempotence.count()).toBe(avant)
    },
  )

  it.each([
    ['export : départ absent', '/api/coordination/trains/export', {}],
    [
      'export : simulation non booléenne',
      '/api/coordination/trains/export',
      { depart: DEPART_TXT, simulation: 'oui' },
    ],
    [
      'export : semaine 53 d’une année de 52',
      '/api/coordination/trains/export',
      { depart: '2027-W53' },
    ],
    ['export prépa : trains absents', '/api/coordination/trains/export-preparation', {}],
    [
      'export prépa : trainId numérique',
      '/api/coordination/trains/export-preparation',
      { trains: [{ trainId: 1, version: '1.1.1' }] },
    ],
    [
      'export prépa : version absente',
      '/api/coordination/trains/export-preparation',
      { trains: [{ trainId: 'x' }] },
    ],
    [
      'export prépa : plus de 500 trains',
      '/api/coordination/trains/export-preparation',
      {
        trains: Array.from({ length: 501 }, (_, k) => ({ trainId: `t${String(k)}`, version: '1' })),
      },
    ],
    ['au roulage : rouleur 0', '/api/coordination/trains/au-roulage', { trains: T, rouleurId: 0 }],
    [
      'au roulage : rouleur négatif',
      '/api/coordination/trains/au-roulage',
      { trains: T, rouleurId: -3 },
    ],
    [
      'au roulage : rouleur décimal',
      '/api/coordination/trains/au-roulage',
      { trains: T, rouleurId: 1.5 },
    ],
    [
      'au roulage : rouleur texte',
      '/api/coordination/trains/au-roulage',
      { trains: T, rouleurId: 'x' },
    ],
    ['au roulage : rouleur absent', '/api/coordination/trains/au-roulage', { trains: T }],
    ['rouleur : liste vide', '/api/coordination/trains/rouleur', { trains: [], rouleurId: 1 }],
    ['rouleur : rouleur nul', '/api/coordination/trains/rouleur', { trains: T, rouleurId: null }],
    [
      'retrait de thème : thème vide',
      '/api/coordination/trains/supprimer-theme-export',
      { atelierId: 1, depart: DEPART_TXT, contNum: 1, theme: '' },
    ],
    [
      'retrait de thème : thème > 100 caractères',
      '/api/coordination/trains/supprimer-theme-export',
      { atelierId: 1, depart: DEPART_TXT, contNum: 1, theme: 'x'.repeat(101) },
    ],
    [
      'retrait de thème : dossier texte',
      '/api/coordination/trains/supprimer-theme-export',
      { atelierId: 1, depart: DEPART_TXT, contNum: 'a', theme: 'A' },
    ],
    [
      'retrait de thème : atelier absent',
      '/api/coordination/trains/supprimer-theme-export',
      { depart: DEPART_TXT, contNum: 1, theme: 'A' },
    ],
    ['générateur : départ absent', '/api/coordination/generateur', { trains: T }],
    [
      'générateur : trains vides',
      '/api/coordination/generateur',
      { depart: DEPART_TXT, trains: [] },
    ],
    ['envoi : id 0', '/api/coordination/generateur/envoyer', { id: 0, version: 1 }],
    ['envoi : version 0', '/api/coordination/generateur/envoyer', { id: 1, version: 0 }],
    ['envoi : version texte', '/api/coordination/generateur/envoyer', { id: 1, version: 'x' }],
    ['envoi : corps vide', '/api/coordination/generateur/envoyer', {}],
  ])('400 %s', async (_libelle, url, corps) => {
    const s = await site()
    const r = await envoyer(ctx, url, s.users.coord.headers, corps)
    expect(r.statusCode, r.body).toBe(400)
    expect(erreur(r).code).toBeTruthy()
  })

  it.each([
    '/api/coordination/trains/export/apercu',
    '/api/coordination/trains/export/apercu?depart=2026-W00',
    '/api/coordination/trains/export/historique?depart=nimporte',
    '/api/coordination/trains/export/0/fichier',
    '/api/coordination/trains/export/-1/fichier',
    '/api/coordination/trains/rouleurs?atelier=0',
    '/api/coordination/trains/rouleurs?atelier=abc',
    '/api/coordination/generateur?atelier=abc',
    '/api/coordination/generateur?depart=2026-W54',
    '/api/coordination/generateur/abc/fichier',
  ])('400 GET %s', async (url) => {
    const s = await site()
    expect((await get(ctx, url, s.users.coord.headers)).statusCode, url).toBe(400)
  })
})

// ═════════════════════════ ANO-044 à 048 : rouleur, périmètre des lots, ordre des écritures ═════════════════════════

describe('RG-COO-213 tf_train_export : rouleur et lettre de chaque contrat', () => {
  it('RG-COO-213 ANO-044 le rouleur de la face est conservé avec le contrat ; sans rouleur, la valeur est nulle', async () => {
    const s = await site()
    const rouleur = await db.rouleur.create({
      data: { nom: `Rouleur ${String(Date.now())}`, atelierId: s.atelier.id },
    })
    await trainExportable(ctx, s, ['Rose', 'Gris'], { extra: { rouleurId: rouleur.id } })
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const ligne = await db.exportTrainLigne.findFirstOrThrow({ where: { exportId: res.lot } })
    const contrats = JSON.parse(ligne.contrats) as { lettre: string; rouleur: string | null }[]
    expect(contrats.map((c) => c.lettre)).toEqual(['A', 'B'])
    expect(contrats.map((c) => c.rouleur)).toEqual([rouleur.nom, rouleur.nom])
    const s2 = await site()
    await trainExportable(ctx, s2, ['Bleu'])
    const res2 = ExportResultatSchema.parse((await exporter(s2)).json())
    const ligne2 = await db.exportTrainLigne.findFirstOrThrow({ where: { exportId: res2.lot } })
    expect((JSON.parse(ligne2.contrats) as { rouleur: string | null }[])[0]?.rouleur).toBeNull()
  })
})

describe('RG-COO-167 périmètre des lots d’export : tous les ateliers du lot doivent être visibles', () => {
  it('RG-COO-167 ANO-045 / 046 le lot d’un site est visible (historique, fichier) du coordinateur de ce site et de l’administrateur ; il porte ses ateliers', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    const lot = await db.exportTrains.findUniqueOrThrow({ where: { id: res.lot } })
    expect(JSON.parse(lot.ateIds)).toEqual([s.atelier.id])
    for (const headers of [s.users.coord.headers, s.users.admin.headers]) {
      const h = HistoriqueExportsSchema.parse((await historique(headers)).json())
      expect(h.exports.some((e) => e.id === res.lot)).toBe(true)
      const f = await get(
        ctx,
        `/api/coordination/trains/export/${String(res.lot)}/fichier`,
        headers,
      )
      expect(f.statusCode, f.body).toBe(200)
    }
  })

  it('RG-COO-167 un lot sans atelier connu (antérieur à la colonne) n’est visible que de qui voit toutes les plateformes : 403 pour un coordinateur', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'])
    const res = ExportResultatSchema.parse((await exporter(s)).json())
    await db.exportTrains.update({ where: { id: res.lot }, data: { ateIds: '[]' } })
    const h = HistoriqueExportsSchema.parse((await historique(s.users.coord.headers)).json())
    expect(h.exports.some((e) => e.id === res.lot)).toBe(false)
    const f = await get(
      ctx,
      `/api/coordination/trains/export/${String(res.lot)}/fichier`,
      s.users.coord.headers,
    )
    expect(f.statusCode).toBe(403)
    expect(erreur(f)).toMatchObject({ code: 'COO_PERIMETRE_INTERDIT', regle: 'RG-COO-167' })
    const admin = await get(
      ctx,
      `/api/coordination/trains/export/${String(res.lot)}/fichier`,
      s.users.admin.headers,
    )
    expect(admin.statusCode).toBe(200)
  })

  it('RG-COO-167 un lot qui couvre deux sites (export de l’administrateur) n’est visible d’aucun coordinateur d’un seul site : 403 sur le fichier, absent de l’historique', async () => {
    const s = await site()
    const autre = await site()
    await trainExportable(ctx, s, ['Rose'])
    await trainExportable(ctx, autre, ['Gris'])
    const res = ExportResultatSchema.parse((await exporter(s, false, s.users.admin.headers)).json())
    const lot = await db.exportTrains.findUniqueOrThrow({ where: { id: res.lot } })
    expect((JSON.parse(lot.ateIds) as number[]).sort()).toEqual(
      expect.arrayContaining([s.atelier.id, autre.atelier.id]),
    )
    for (const c of [s, autre]) {
      const h = HistoriqueExportsSchema.parse((await historique(c.users.coord.headers)).json())
      expect(h.exports.some((e) => e.id === res.lot)).toBe(false)
      const f = await get(
        ctx,
        `/api/coordination/trains/export/${String(res.lot)}/fichier`,
        c.users.coord.headers,
      )
      expect(f.statusCode).toBe(403)
    }
    // Nettoyage : ces trains « A imprimer » ne gênent pas les autres fichiers (exports par site).
  })

  it('ECR-GEN-01 / RG-COO-167 un lot de génération sans atelier connu n’est visible ni dans l’historique ni en fichier d’un chef d’équipe : 403 (le droit de préparer n’est pas celui de l’administrateur)', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
    const r = await envoyer(
      ctx,
      '/api/coordination/generateur',
      s.users.cheq.headers,
      { depart: DEPART_TXT, trains: await versionsDe(s, [t.trainId]) },
      idem(),
    )
    expect(r.statusCode, r.body).toBe(200)
    const g = GenerationSchema.parse(r.json())
    expect(
      JSON.parse((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).ateIds),
    ).toEqual([s.atelier.id])
    await db.generationFichiers.update({ where: { id: g.id }, data: { ateIds: '[]' } })
    const f = await get(
      ctx,
      `/api/coordination/generateur/${String(g.id)}/fichier`,
      s.users.cheq.headers,
    )
    expect(f.statusCode).toBe(403)
    expect(erreur(f)).toMatchObject({ code: 'COO_PERIMETRE_INTERDIT', regle: 'RG-COO-167' })
    const liste = await get(
      ctx,
      `/api/coordination/generateur?depart=${DEPART_TXT}`,
      s.users.cheq.headers,
    )
    expect(liste.statusCode, liste.body).toBe(200)
    const { historique } = liste.json<{ historique: { id: number }[] }>()
    expect(historique.some((h) => h.id === g.id)).toBe(false)
  })
})
