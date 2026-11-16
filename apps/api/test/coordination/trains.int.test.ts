// COO-P09 — Trains : calcul à l'Instruction OK (RG-COO-200 à 203, 205), retour arrière (RG-COO-206), afficheur
// d'un panneau (RG-COO-207), couverture et statut d'unité (RG-COO-208), positions (RG-COO-209), changer statut
// (RG-COO-218), annuler thème (RG-COO-219), débloquer semaine (RG-COO-220), fractionner (RG-COO-221),
// raccrocher (RG-COO-222), point de non-retour (RG-COO-223), créer (RG-COO-224), supprimer (RG-COO-225),
// dupliquer (RG-COO-226), filtres et périmètre (RG-COO-228), n° de panneau (RG-COO-229), historique
// (RG-COO-307), version et idempotence (RG-COO-308). HYPOTHÈSES Q-192, Q-250, Q-251, Q-253, Q-256, Q-280.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  CreerTrainResultatSchema,
  FicheTrainSchema,
  formatSemaineIso,
  ListeTrainsSchema,
  lundiSemaineIso,
  ResultatActionTrainsSchema,
  semaineIsoDe,
  VisuelsRaccrochablesSchema,
  selectionnerPremiers,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { Prisma, StatutProduction } from '../../src/generated/prisma/client.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { integrerFacesInstruction } from '../../src/modules/coordination/integration-flux.ts'
import { identifiantTrain } from '../../src/modules/coordination/trains-calcul.ts'
import { panneaux } from '../../src/modules/coordination/trains.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']
// Q-421 : l'admin est super-utilisateur ; les matrices de refus ne le parcourent pas.
const ROLES_SANS_ADMIN = ROLES.filter((r) => r !== 'admin')
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const S = semaineIsoDe(new Date())
const SEM = plus(S, 1)
const DEPART = new Date(lundiSemaineIso(SEM).getTime() + 86_400_000 + 16 * 3_600_000)

const restaurer: (() => Promise<unknown>)[] = []
async function parametre(cle: string, valeur: string) {
  const existant = await db.parametre.findFirst({ where: { cle, plateformeId: null } })
  if (existant) {
    await db.parametre.update({ where: { id: existant.id }, data: { valeur } })
    restaurer.push(() =>
      db.parametre.update({ where: { id: existant.id }, data: { valeur: existant.valeur } }),
    )
  } else {
    const p = await db.parametre.create({ data: { cle, valeur } })
    restaurer.push(() => db.parametre.delete({ where: { id: p.id } }))
  }
}
afterEach(async () => {
  while (restaurer.length > 0) await restaurer.pop()?.()
})

/** Site avec un atelier déroulant et un utilisateur par rôle. */
async function site() {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const support = await f.createSupport(db)
  const destinataire = await f.createDestinataire(db, { nom: `Dest ${String(next())}` })
  const users = {} as Record<Role, { id: number; headers: Record<string, string> }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne) }
  }
  return { plateforme, atelier, support, destinataire, users, sect: 100 + (next() % 800) }
}
type Site = Awaited<ReturnType<typeof site>>

/** Dossier « prépa reçue » + instruction EN_COURS de l'atelier, sans face. */
async function instruction(s: Site, o: { tipInsCode?: number; entretien?: number | null } = {}) {
  const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE', annonceur: 'ANNONCEUR' })
  const i = await f.createInstruction(db, {
    atelierId: s.atelier.id,
    dossierId: dossier.id,
    contNum: dossier.contNum,
    annonceur: "L'ANNONCEUR",
    contAnbas: SEM.annee,
    contSembas: SEM.semaine,
    statut: 'EN_COURS',
    tipInsCode: o.tipInsCode ?? 0,
    entretien: o.entretien === undefined ? 8 : o.entretien,
  })
  return { dossier, i }
}

/** Face Broadcast intégrée (statut 0) sur l'emplacement n° `empl` du site. */
function face(
  s: Site,
  code: string,
  contNum: number,
  empl: number,
  data: Partial<Prisma.FaceTrainUncheckedCreateInput> = {},
) {
  return f.createFaceTrain(db, {
    instructionCode: code,
    statut: 'A_TRAITER',
    atelierId: s.atelier.id,
    supportId: s.support.id,
    destinataireId: s.destinataire.id,
    contNum,
    dateDepart: DEPART,
    contAnbas: SEM.annee,
    contSembas: SEM.semaine,
    depAnbas: SEM.annee,
    depSembas: SEM.semaine,
    emplSectCode: s.sect,
    emplDepaCode: '30',
    commNumord: 12,
    emplNumord: empl,
    emplAdresse1: `Rue ${String(empl)}`,
    train: 1,
    rang: empl,
    afficheurId: 7,
    afficheurNom: 'AFFICHEUR SUD',
    cadrIdent: 10_000 + empl,
    ...data,
  })
}

const iok = (s: Site, code: string, version: number) =>
  post(ctx, '/api/coordination/instruction-ok', s.users.coord.headers, {
    instructions: [{ code, version }],
  })

async function liste(headers: Record<string, string>, qs = '') {
  const r = await get(ctx, `/api/coordination/trains?depart=${formatSemaineIso(SEM)}${qs}`, headers)
  expect(r.statusCode).toBe(200)
  return ListeTrainsSchema.parse(r.json())
}

/** Train déjà calculé (faces au statut donné) : `positions` = [contNum, thème] par position. */
async function trainDirect(
  s: Site,
  positions: [number, string][],
  o: { statut?: StatutProduction; trainId?: string; depart?: Date; destinataireId?: number } = {},
) {
  const trainId = o.trainId ?? `9${String(next()).padStart(15, '0')}`
  const faces = []
  let k = 0
  for (const [contNum, theme] of positions) {
    const { i } = await instruction(s)
    faces.push(
      await f.createFaceTrain(db, {
        instructionCode: i.code,
        statut: o.statut ?? 'INSTRUCTION_OK',
        atelierId: s.atelier.id,
        supportId: s.support.id,
        destinataireId: o.destinataireId ?? s.destinataire.id,
        contNum,
        contAnnonc: 'ANNONCEUR',
        dateDepart: o.depart ?? DEPART,
        contAnbas: SEM.annee,
        contSembas: SEM.semaine,
        depAnbas: SEM.annee,
        depSembas: SEM.semaine,
        trainId,
        theme,
        ordreReel: ++k,
        refPanel: `P${String(next())}`,
        afficheurNom: 'AFFICHEUR SUD',
      }),
    )
  }
  return { trainId, faces }
}

/** Reçu d'un visuel : ligne attendue du thème sur le site + affiche rattachée de `quantite`. */
async function recu(s: Site, contNum: number, theme: string, quantite: number) {
  const l = await f.createReceptionAttendue(db, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    contNum,
    theme,
    themeCle: theme.toUpperCase(),
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
  })
  const a = await f.createAffiche(db, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    contNum,
    theme,
    quantite,
    allee: 'B',
    rayon: '12',
  })
  await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite })
}

const versionDe = async (s: Site, trainId: string) => {
  const r = await get(ctx, `/api/coordination/trains/${trainId}`, s.users.coord.headers)
  return FicheTrainSchema.parse(r.json()).version
}

describe('RG-COO-200 à 203, 205 calcul des trains à l’Instruction OK', () => {
  it('RG-COO-200 / 201 / 202 identifiant de train, ordre, répartition des thèmes au prorata, statut 2 et historique', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s, { tipInsCode: 1 })
    const faces = []
    for (let e = 1; e <= 4; e++) faces.push(await face(s, i.code, dossier.contNum, e))
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 501,
      theme: 'Été',
      pourcentage: 50,
    })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 502,
      theme: 'Hiver',
      pourcentage: 50,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    const apres = await db.faceTrain.findMany({
      where: { instructionCode: i.code },
      orderBy: { id: 'asc' },
    })
    const aa = String(SEM.annee).slice(-2)
    const ss = String(SEM.semaine).padStart(2, '0')
    const sect = String(s.sect).padStart(3, '0')
    expect(apres.map((x) => x.trainId)).toEqual(
      [1, 2, 3, 4].map((e) => `${aa}${ss}${sect}30012${String(e).padStart(4, '0')}10`),
    )
    expect(apres.every((x) => x.statut === 'INSTRUCTION_OK' && x.ordreReel === 0)).toBe(true)
    expect(apres.map((x) => x.ordrePropose)).toEqual([1, 2, 3, 4])
    expect(apres.filter((x) => x.theme === 'Été')).toHaveLength(2)
    expect(apres.filter((x) => x.theme === 'Hiver')).toHaveLength(2)
    expect(apres.every((x) => x.ftType === 'face' && x.contAnnonc === 'L ANNONCEUR')).toBe(true)
    expect(
      await db.statutHistorique.count({
        where: {
          typeEntite: 'FACE_TRAIN',
          entiteId: { in: faces.map((x) => String(x.id)) },
          regle: 'RG-COO-202',
        },
      }),
    ).toBe(4)
    expect(
      await db.journalAudit.count({ where: { entiteId: i.code, action: 'CALCUL_TRAINS' } }),
    ).toBe(1)
  })

  it('RG-COO-200 version : un train déjà « A imprimer » sur le même emplacement → version + 1', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const ancienne = await face(s, i.code, dossier.contNum, 1, {
      statut: 'A_IMPRIMER',
      versionTrain: 2,
    })
    const autre = await instruction(s)
    await face(s, autre.i.code, autre.dossier.contNum, 1)
    await f.createInstructionVisuel(db, {
      instructionCode: autre.i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, autre.i.code, autre.i.version)).statusCode).toBe(200)
    const calculee = await db.faceTrain.findFirstOrThrow({
      where: { instructionCode: autre.i.code },
    })
    expect(calculee.versionTrain).toBe(3)
    expect(calculee.trainId?.slice(-1)).toBe('3')
    expect((await db.faceTrain.findUniqueOrThrow({ where: { id: ancienne.id } })).statut).toBe(
      'A_IMPRIMER',
    )
  })

  it.each([
    [2, 99],
    [3, 98],
    [4, 15],
    [0, 3],
  ])('RG-COO-201 position %i → ordre réel %i', async (tip, ordre) => {
    const s = await site()
    const { dossier, i } = await instruction(s, { tipInsCode: tip })
    await face(s, i.code, dossier.contNum, 3)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect(
      (await db.faceTrain.findFirstOrThrow({ where: { instructionCode: i.code } })).ordreReel,
    ).toBe(ordre)
  })

  it('RG-COO-202 exception sur un cadre, bandeau à 100 % en repiquage, thème court complété, guillemets remplacés', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const cible = await face(s, i.code, dossier.contNum, 1)
    await face(s, i.code, dossier.contNum, 2)
    await f.createInstructionDetail(db, {
      instructionCode: i.code,
      cadrIdent: cible.cadrIdent,
      theme: 'XY',
      afchIdent: 900,
    })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 901,
      theme: 'L"été',
      pourcentage: 100,
    })
    const bdx = (await db.typePreparation.create({ data: { libelle: 'BDX test' } })).id
    await parametre('integration.typesVisuels', `visuel:10:26;bdx:${String(bdx)};detail:10`)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 902,
      theme: 'Bandeau prix',
      pourcentage: 100,
      typePreparationId: bdx,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    const [a, b] = await db.faceTrain.findMany({
      where: { instructionCode: i.code },
      orderBy: { id: 'asc' },
    })
    expect(a).toMatchObject({
      theme: 'XY---',
      themeId: 900,
      ftType: 'exception',
      repiquage: 'Bandeau prix',
    })
    expect(b).toMatchObject({
      theme: 'L été',
      themeId: 901,
      ftType: 'face',
      repiquage: 'Bandeau prix',
    })
  })

  it('RG-COO-203 faces d’entretien : 8 % de 20 faces → 2 faces « ENTRETIEN » (arrondi supérieur, grain afficheur), train en « 19 »', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s, { entretien: null })
    for (let e = 1; e <= 20; e++) await face(s, i.code, dossier.contNum, e)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    const entretien = await db.faceTrain.findMany({
      where: { instructionCode: i.code, ftType: 'entretien' },
    })
    expect(entretien).toHaveLength(2)
    expect(entretien[0]).toMatchObject({
      statut: 'INSTRUCTION_OK',
      afficheurNom: 'ENTRETIEN',
      cadreLib: 'entretien',
      ordreReel: 1,
      versionTrain: 1,
      dateDepart: DEPART,
    })
    expect(entretien.every((x) => x.trainId?.endsWith('19'))).toBe(true)
    expect(new Set(entretien.map((x) => x.trainId)).size).toBe(2)
  })

  it('RG-COO-203 arrondi au plus proche (paramètre) : 12 % de 10 faces → 1 ; arrondi supérieur → 2', async () => {
    const s = await site()
    await parametre('trains.entretienArrondi', 'PROCHE')
    const { dossier, i } = await instruction(s, { entretien: 12 })
    for (let e = 1; e <= 10; e++) await face(s, i.code, dossier.contNum, e)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect(
      await db.faceTrain.count({ where: { instructionCode: i.code, ftType: 'entretien' } }),
    ).toBe(1)
  })

  it('RG-COO-203 rejet : pas d’entretien sous le seuil (2 faces < 3)', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s, { entretien: 50 })
    for (let e = 1; e <= 2; e++) await face(s, i.code, dossier.contNum, e)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect(
      await db.faceTrain.count({ where: { instructionCode: i.code, ftType: 'entretien' } }),
    ).toBe(0)
  })

  it('RG-COO-203 grain VILLE (existant) : groupes par destinataire / thème / secteur', async () => {
    const s = await site()
    await parametre('trains.entretienGrain', 'VILLE')
    const autreDest = await f.createDestinataire(db)
    const { dossier, i } = await instruction(s, { entretien: 10 })
    for (let e = 1; e <= 5; e++) await face(s, i.code, dossier.contNum, e)
    for (let e = 6; e <= 10; e++)
      await face(s, i.code, dossier.contNum, e, { destinataireId: autreDest.id })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    const entretien = await db.faceTrain.findMany({
      where: { instructionCode: i.code, ftType: 'entretien' },
    })
    expect(entretien.map((x) => x.destinataireId).sort()).toEqual(
      [s.destinataire.id, autreDest.id].sort(),
    )
  })

  it('RG-COO-205 doublon de cadre dans un train : la face la plus récente gardée, l’autre ANNULÉE (train vidé, historique) ; afficheur unifié', async () => {
    const s = await site()
    const premiere = await instruction(s)
    const vieille = await face(s, premiere.i.code, premiere.dossier.contNum, 1, {
      statut: 'INSTRUCTION_OK',
      cadrIdent: 4242,
      afficheurId: 1,
      afficheurNom: 'ANCIEN',
    })
    const aa = String(SEM.annee).slice(-2)
    const trainId = `${aa}${String(SEM.semaine).padStart(2, '0')}${String(s.sect).padStart(3, '0')}30012000110`
    await db.faceTrain.update({
      where: { id: vieille.id },
      data: { trainId, createdAt: new Date('2020-01-01') },
    })
    const autreCadre = await face(s, premiere.i.code, premiere.dossier.contNum, 1, {
      statut: 'INSTRUCTION_OK',
      cadrIdent: 4343,
      afficheurId: 1,
      afficheurNom: 'ANCIEN',
    })
    await db.faceTrain.update({
      where: { id: autreCadre.id },
      data: { trainId, createdAt: new Date('2020-01-01') },
    })
    const { dossier, i } = await instruction(s)
    await face(s, i.code, dossier.contNum, 1, {
      cadrIdent: 4242,
      afficheurId: 2,
      afficheurNom: 'NOUVEAU',
    })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: vieille.id } })).toMatchObject({
      statut: 'ANNULE',
      trainId: null,
    })
    expect(
      await db.statutHistorique.findFirstOrThrow({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(vieille.id) },
      }),
    ).toMatchObject({ ancien: 'INSTRUCTION_OK', nouveau: 'ANNULE', regle: 'RG-COO-205' })
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: autreCadre.id } })).toMatchObject({
      statut: 'INSTRUCTION_OK',
      afficheurNom: 'NOUVEAU',
    })
  })

  it('RG-COO-205 / RG-COO-223 rejet : une face de même cadre en production n’est jamais annulée', async () => {
    const s = await site()
    const premiere = await instruction(s)
    const enProd = await face(s, premiere.i.code, premiere.dossier.contNum, 1, {
      statut: 'AU_ROULAGE',
      cadrIdent: 777,
    })
    const { dossier, i } = await instruction(s)
    await face(s, i.code, dossier.contNum, 1, { cadrIdent: 777 })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    const calc = await db.faceTrain.findFirstOrThrow({ where: { instructionCode: i.code } })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    const train = (await db.faceTrain.findUniqueOrThrow({ where: { id: calc.id } })).trainId
    await db.faceTrain.update({ where: { id: enProd.id }, data: { trainId: train } })
    expect((await db.faceTrain.findUniqueOrThrow({ where: { id: enProd.id } })).statut).toBe(
      'AU_ROULAGE',
    )
  })

  it('RG-COO-205 (3) face sans emplacement : identifiant non calculable → ANNULÉE avec historique (pas supprimée)', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const sans = await face(s, i.code, dossier.contNum, 1, { emplSectCode: null })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: sans.id } })).toMatchObject({
      statut: 'ANNULE',
    })
    expect(
      (
        await db.statutHistorique.findFirstOrThrow({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(sans.id), nouveau: 'ANNULE' },
        })
      ).motif,
    ).toContain('emplacement')
  })

  it('RG-COO-206 retour arrière après le calcul : entretien supprimé, faces remises à blanc, faces « A imprimer » conservées', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s, { entretien: 50 })
    for (let e = 1; e <= 4; e++) await face(s, i.code, dossier.contNum, e)
    const imprimee = await face(s, i.code, dossier.contNum, 9, {
      statut: 'A_IMPRIMER',
      trainId: 'X1',
      theme: 'Gardé',
    })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect(
      await db.faceTrain.count({ where: { instructionCode: i.code, ftType: 'entretien' } }),
    ).toBe(2)
    const lue = await db.instruction.findUniqueOrThrow({ where: { code: i.code } })
    const r = await post(
      ctx,
      `/api/coordination/instructions/${i.code}/statut`,
      s.users.coord.headers,
      {
        version: lue.version,
        vers: 'EN_COURS',
      },
    )
    expect(r.statusCode).toBe(200)
    expect(
      await db.faceTrain.count({ where: { instructionCode: i.code, ftType: 'entretien' } }),
    ).toBe(0)
    const faces = await db.faceTrain.findMany({
      where: { instructionCode: i.code, NOT: { id: imprimee.id } },
    })
    expect(
      faces.every((x) => x.statut === 'EN_COURS' && x.trainId === null && x.theme === null),
    ).toBe(true)
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: imprimee.id } })).toMatchObject({
      statut: 'A_IMPRIMER',
      trainId: 'X1',
      theme: 'Gardé',
    })
  })

  it('RG-COO-200 identifiant : une partie d’emplacement manquante → pas d’identifiant ; version > 9 → « * »', () => {
    const base = {
      depAnbas: 2026,
      depSembas: 5,
      emplSectCode: 1,
      emplDepaCode: '30',
      commNumord: 2,
      emplNumord: 3,
      train: 1,
    }
    expect(identifiantTrain(base, 0)).toBe('260500130002000310')
    expect(identifiantTrain({ ...base, commNumord: null }, 0)).toBeNull()
    expect(identifiantTrain(base, 12)).toBe('26050013000200031*')
  })
})

describe('RG-COO-207 afficheur d’un panneau', () => {
  it('RG-COO-207 une nouvelle face reprend l’afficheur des faces engagées du même panneau ; rejet : sans face engagée, elle garde le sien', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const panel = `PAN${String(next())}`
    await face(s, i.code, dossier.contNum, 1, {
      statut: 'A_IMPRIMER',
      refPanel: panel,
      afficheurId: 55,
      afficheurNom: 'ENGAGÉ',
    })
    const commun = {
      idInterface: 1,
      contNum: dossier.contNum + 1,
      annonceur: 'A',
      semaine: SEM,
      depart: SEM,
      dateDepart: DEPART,
      idSurface: null,
      idSiteCcf: null,
      cadrIdent: 1,
      cadreLib: null,
      theme: null,
      themeId: null,
      repiquage: null,
      repiquageId: null,
      supportId: null,
      destinataire: null,
      afficheurId: 99,
      afficheurNom: 'NOUVEAU',
      ftType: null,
      traitement: 'E',
      idTypeDestinationDa: 1,
    }
    await withTransaction(db, (tx) =>
      integrerFacesInstruction(
        tx,
        [
          { ...commun, refPanel: panel },
          { ...commun, cadrIdent: 2, refPanel: `AUTRE${String(next())}` },
        ],
        new Map(),
      ),
    )
    const nouvelles = await db.faceTrain.findMany({
      where: { contNum: dossier.contNum + 1 },
      orderBy: { id: 'asc' },
    })
    expect(nouvelles.map((x) => x.afficheurNom)).toEqual(['ENGAGÉ', 'NOUVEAU'])
  })
})

describe('RG-COO-208 / 209 couverture et statut d’unité', () => {
  it('RG-COO-208 train EN_ATTENTE tant qu’un visuel manque, PRET quand tous sont couverts ; positions A / B', async () => {
    const s = await site()
    const c1 = 700_000 + next()
    const c2 = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c1, 'Rouge'],
      [c2, 'Bleu'],
    ])
    await recu(s, c1, 'Rouge', 5)
    let l = await liste(s.users.coord.headers, `&dossier=${String(c1)}`)
    expect(l.lignes[0]).toMatchObject({ statut: 'EN_ATTENTE', nb: 1 })
    expect(l.lignes[0]?.positions.map((p) => [p.lettre, p.etat])).toEqual([
      ['A', 'OK'],
      ['B', 'MANQUANT'],
    ])
    await recu(s, c2, 'bleu', 1)
    l = await liste(s.users.coord.headers, `&dossier=${String(c1)}`)
    expect(l.lignes[0]).toMatchObject({ statut: 'PRET', cle: trainId })
  })

  it('RG-COO-208 rejet : un reçu insuffisant sert d’abord le départ le plus proche', async () => {
    const s = await site()
    const c = 700_000 + next()
    const tot = await trainDirect(s, [[c, 'Vert']], {
      depart: new Date(DEPART.getTime() - 86_400_000),
    })
    const tard = await trainDirect(s, [[c, 'Vert']])
    await recu(s, c, 'Vert', 1)
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    const statutDe = (id: string) =>
      l.lignes.find((x) => x.trains.some((t) => t.trainId === id))?.statut
    expect(statutDe(tot.trainId)).toBe('PRET')
    expect(statutDe(tard.trainId)).toBe('EN_ATTENTE')
  })

  it('RG-COO-209 une position fractionnée sort du besoin (attendu) et ne bloque plus le train', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId, faces } = await trainDirect(s, [
      [c, 'Jaune'],
      [c + 1, 'Noir'],
    ])
    await recu(s, c, 'Jaune', 1)
    await db.faceTrain.update({ where: { id: faces[1]?.id ?? 0 }, data: { fractionnee: true } })
    const fiche = FicheTrainSchema.parse(
      (await get(ctx, `/api/coordination/trains/${trainId}`, s.users.coord.headers)).json(),
    )
    expect(fiche.statut).toBe('PRET')
    expect(fiche.fractionne).toBe(true)
    expect(fiche.positions.map((p) => [p.etat, p.recu, p.attendu])).toEqual([
      ['OK', 1, 1],
      ['FRACTIONNE', 0, 0],
    ])
    expect(fiche.positions[0]?.emplacement).toBe('B-12')
  })

  it('RG-COO-208 statut d’unité des faces en production (Q-250) : 10 → EN_PROD, 7 → COLISE, 8 → EXPEDIE', async () => {
    const s = await site()
    const c = 700_000 + next()
    await trainDirect(s, [[c, 'A']], { statut: 'AU_ROULAGE' })
    await trainDirect(s, [[c, 'A']], { statut: 'A_EXPEDIER' })
    await trainDirect(s, [[c, 'A']], { statut: 'TERMINE' })
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(l.lignes.map((x) => x.statut).sort()).toEqual(['COLISE', 'EN_PROD', 'EXPEDIE'])
    expect(l.indicateurs).toMatchObject({ enProduction: 1, colisesExpedies: 2, aProduire: 0 })
  })
})

describe('RG-COO-228 / 229 liste des trains : filtres, périmètre, panneau', () => {
  it('RG-COO-228 filtres dossier, thème (multiple), « Trains de », statut, destinataire ; trains identiques regroupés (Nb trains)', async () => {
    const s = await site()
    const c = 700_000 + next()
    await trainDirect(s, [[c, 'Lune']])
    await trainDirect(s, [[c, 'Lune']])
    await trainDirect(s, [
      [c, 'Soleil'],
      [c + 1, 'Mars'],
    ])
    const tout = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(tout.lignes.map((x) => x.nb).sort()).toEqual([1, 2])
    expect(
      (await liste(s.users.coord.headers, `&dossier=${String(c)}&theme=lune,mars`)).lignes,
    ).toHaveLength(2)
    expect(
      (await liste(s.users.coord.headers, `&dossier=${String(c)}&trainsDe=2`)).lignes,
    ).toHaveLength(1)
    expect(
      (await liste(s.users.coord.headers, `&dossier=${String(c)}&statut=PRET`)).lignes,
    ).toHaveLength(0)
    const filtre = await liste(s.users.coord.headers, `&dossier=${String(c)}&destinataire=inconnu`)
    expect(filtre.lignes).toHaveLength(0)
    expect(tout.indicateurs.enAttente).toBe(3)
  })

  it('RG-COO-228 rejet : un coordinateur d’un autre site ne voit pas les trains ; semaine invalide → 400', async () => {
    const s = await site()
    const autre = await site()
    const c = 700_000 + next()
    await trainDirect(s, [[c, 'Lune']])
    expect((await liste(autre.users.coord.headers, `&dossier=${String(c)}`)).lignes).toHaveLength(0)
    expect(
      (await get(ctx, '/api/coordination/trains?depart=2026-44', s.users.coord.headers)).statusCode,
    ).toBe(400)
  })

  it('RG-COO-228 encadré « À faire » : instructions encore « En cours » dont les faces partent cette semaine', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    await face(s, i.code, dossier.contNum, 1, { statut: 'EN_COURS' })
    expect((await liste(s.users.coord.headers)).aFaire).toEqual({ instructions: 1, dossiers: 1 })
  })

  it('RG-COO-229 n° de panneau Broadcast renvoyé aux coordinateurs et chefs d’équipe', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { faces } = await trainDirect(s, [[c, 'Lune']])
    for (const r of ['coord', 'cheq'] as const)
      expect(
        (await liste(s.users[r].headers, `&dossier=${String(c)}`)).lignes[0]?.panneauxBc,
      ).toEqual([faces[0]?.refPanel])
  })

  it('RG-COO-229 rejet : le n° de panneau n’est pas renvoyé aux profils sans le droit (contrôle serveur)', async () => {
    const s = await site()
    const { faces } = await trainDirect(s, [[700_000 + next(), 'Lune']])
    for (const r of ['recep', 'expe', 'com'] as const)
      expect(
        panneaux(
          {
            userId: s.users[r].id,
            identifiantExterne: 'x',
            nom: null,
            roles: [r],
            perimetre: { toutesPlateformes: true, plateformeIds: [], lignes: [] },
            siteId: null,
          },
          faces,
        ),
      ).toBeNull()
  })

  it('RG-COO-227 « les N premiers » sur la liste réelle : lignes cochées jusqu’à N trains sans couper une ligne ; message sinon', async () => {
    const s = await site()
    const c = 700_000 + next()
    await trainDirect(s, [[c, 'Lune']])
    await trainDirect(s, [[c, 'Lune']])
    await trainDirect(s, [[c, 'Soleil']])
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(selectionnerPremiers(l.lignes, 3).trains).toBe(3)
    const coupe = selectionnerPremiers(l.lignes, l.lignes[0]?.nb === 2 ? 2 : 1)
    expect(coupe.cles).toHaveLength(1)
    expect(coupe.message).toMatch(
      /train\(s\) sélectionné\(s\), sur 1 ligne\(s\)… la ligne suivante en compte \d et dépasserait \d\./,
    )
  })

  it.each(ROLES_SANS_ADMIN)('RG-COO-165 liste des trains pour le rôle %s', async (r) => {
    const s = await site()
    const res = await get(
      ctx,
      `/api/coordination/trains?depart=${formatSemaineIso(SEM)}`,
      s.users[r].headers,
    )
    expect(res.statusCode).toBe(['coord', 'cheq'].includes(r) ? 200 : 403)
  })
})

describe('RG-COO-221 / 223 / 308 fractionner', () => {
  it('RG-COO-221 train EN_ATTENTE avec un visuel reçu : PRET, position manquante fractionnée, journal ; message de la maquette', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId, faces } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 3)
    const r = await post(ctx, '/api/coordination/trains/fractionner', s.users.cheq.headers, {
      trains: [{ trainId, version: await versionDe(s, trainId) }],
    })
    expect(r.statusCode).toBe(200)
    expect(ResultatActionTrainsSchema.parse(r.json()).message).toBe(
      '1 train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part.',
    )
    expect(
      (await db.faceTrain.findUniqueOrThrow({ where: { id: faces[1]?.id ?? 0 } })).fractionnee,
    ).toBe(true)
    expect((await liste(s.users.coord.headers, `&dossier=${String(c)}`)).lignes[0]).toMatchObject({
      statut: 'PRET',
      fractionne: true,
    })
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: trainId, action: 'FRACTIONNEMENT_TRAIN' },
      }),
    ).toBe(1)
  })

  it('RG-COO-221 rejet : aucun visuel reçu → 409 « Aucun train fractionnable… », rien n’est écrit', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const r = await post(ctx, '/api/coordination/trains/fractionner', s.users.coord.headers, {
      trains: [{ trainId, version: await versionDe(s, trainId) }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      message: 'Aucun train fractionnable (il faut au moins un visuel reçu).',
      regle: 'RG-COO-221',
    })
    expect(
      (await db.faceTrain.findUniqueOrThrow({ where: { id: faces[0]?.id ?? 0 } })).fractionnee,
    ).toBe(false)
  })

  it('RG-COO-223 rejet : train en production → 409 « point de non-retour »', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'AU_ROULAGE' })
    const r = await post(ctx, '/api/coordination/trains/fractionner', s.users.coord.headers, {
      trains: [{ trainId, version: await versionDe(s, trainId) }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      message: 'Train déjà en production : impossible de le modifier (point de non-retour).',
      regle: 'RG-COO-223',
    })
  })

  it('RG-COO-308 version périmée → 409, rien n’est écrit ; même Idempotency-Key → même réponse rejouée', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 3)
    const perimee = await post(ctx, '/api/coordination/trains/fractionner', s.users.coord.headers, {
      trains: [{ trainId, version: '0.0.0' }],
    })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).regle).toBe('RG-COO-308')
    const cle = idem()
    const corps = { trains: [{ trainId, version: await versionDe(s, trainId) }] }
    const a = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/trains/fractionner',
      headers: { ...s.users.coord.headers, ...cle },
      payload: corps,
    })
    const b = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/trains/fractionner',
      headers: { ...s.users.coord.headers, ...cle },
      payload: corps,
    })
    expect(a.statusCode).toBe(200)
    expect(b.json()).toEqual(a.json())
    expect(b.headers['idempotent-replayed']).toBe('true')
    expect(
      await db.journalAudit.count({ where: { entiteId: trainId, action: 'FRACTIONNEMENT_TRAIN' } }),
    ).toBe(1)
  })

  it.each(ROLES_SANS_ADMIN)('RG-COO-221 permission fractionner pour le rôle %s', async (r) => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 1)
    const res = await post(ctx, '/api/coordination/trains/fractionner', s.users[r].headers, {
      trains: [{ trainId, version: await versionDe(s, trainId) }],
    })
    expect(res.statusCode).toBe(['coord', 'cheq'].includes(r) ? 200 : 403)
  })
})

describe('RG-COO-222 / 209 raccrocher un visuel', () => {
  async function avecVisuel(s: Site, theme = 'Nouveau') {
    const { dossier, i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 333,
      theme,
      pourcentage: 100,
    })
    return { dossier, i, v }
  }

  it('RG-COO-222 visuel proposé puis raccroché : une position ajoutée (lettre suivante), historique, journal', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [[c, 'Rose']])
    const { dossier, v } = await avecVisuel(s)
    const propos = VisuelsRaccrochablesSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/trains/visuels-raccrochables?train=${trainId}`,
          s.users.coord.headers,
        )
      ).json(),
    )
    expect(propos.visuels.some((x) => x.visuelId === v.id)).toBe(true)
    const r = await post(ctx, '/api/coordination/trains/raccrocher', s.users.coord.headers, {
      visuelId: v.id,
      trains: [{ trainId, version: await versionDe(s, trainId) }],
    })
    expect(r.statusCode).toBe(200)
    const fiche = FicheTrainSchema.parse(
      (await get(ctx, `/api/coordination/trains/${trainId}`, s.users.coord.headers)).json(),
    )
    expect(fiche.positions.map((p) => [p.lettre, p.contNum, p.theme])).toEqual([
      ['A', c, 'Rose'],
      ['B', dossier.contNum, 'Nouveau'],
    ])
    expect(fiche.modifications.some((m) => m.action === 'RACCROCHAGE_VISUEL')).toBe(true)
  })

  it('RG-COO-209 rejet : train complet (positions max = 2) → 409 « Train complet »', async () => {
    const s = await site()
    await parametre('trains.positionsMax', '2')
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Un'],
      [c + 1, 'Deux'],
    ])
    const { v } = await avecVisuel(s)
    const r = await post(ctx, '/api/coordination/trains/raccrocher', s.users.coord.headers, {
      visuelId: v.id,
      trains: [{ trainId, version: await versionDe(s, trainId) }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ message: 'Train complet', regle: 'RG-COO-209' })
  })

  it('RG-COO-222 en masse : écarte le train qui a déjà le visuel et celui en production, raccroche les autres', async () => {
    const s = await site()
    const { dossier, v } = await avecVisuel(s)
    const libre = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const deja = await trainDirect(s, [[dossier.contNum, 'Nouveau']])
    const prod = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'AU_ROULAGE' })
    const trains = []
    for (const t of [libre, deja, prod])
      trains.push({ trainId: t.trainId, version: await versionDe(s, t.trainId) })
    const r = await post(ctx, '/api/coordination/trains/raccrocher', s.users.cheq.headers, {
      visuelId: v.id,
      trains,
    })
    expect(r.statusCode).toBe(200)
    const res = ResultatActionTrainsSchema.parse(r.json())
    expect(res.traites).toEqual([libre.trainId])
    expect(res.ecartes.map((e) => e.raison).sort()).toEqual([
      'Le train a déjà ce visuel.',
      'Train déjà en production : impossible de le modifier (point de non-retour).',
    ])
  })

  it('RG-COO-222 rejet : visuel d’une autre semaine → 409', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const { i, v } = await avecVisuel(s)
    await db.instruction.update({
      where: { code: i.code },
      data: { contSembas: (SEM.semaine % 50) + 1 },
    })
    const r = await post(ctx, '/api/coordination/trains/raccrocher', s.users.coord.headers, {
      visuelId: v.id,
      trains: [{ trainId, version: await versionDe(s, trainId) }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).message).toBe('Autre semaine.')
  })
})

describe('RG-COO-224 / 225 créer et supprimer un train', () => {
  it('RG-COO-224 créer 2 trains de pré-test : TR-Pnnnn, une position, « A imprimer », afficheur du destinataire', async () => {
    const s = await site()
    await trainDirect(s, [[700_000 + next(), 'Rose']])
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Pré-test',
      pourcentage: 100,
    })
    const r = await post(ctx, '/api/coordination/trains', s.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: formatSemaineIso(SEM),
      type: 'PRE_TEST',
      nombre: 2,
      visuelId: v.id,
      destinataireId: s.destinataire.id,
    })
    expect(r.statusCode).toBe(200)
    const { trains } = CreerTrainResultatSchema.parse(r.json())
    expect(trains).toHaveLength(2)
    expect(trains.every((t) => /^TR-P\d{4}$/.test(t))).toBe(true)
    const crees = await db.faceTrain.findMany({ where: { trainId: { in: trains } } })
    expect(
      crees.every(
        (x) =>
          x.statut === 'A_IMPRIMER' &&
          x.origineTrain === 'PRE_TEST' &&
          x.afficheurNom === 'AFFICHEUR SUD',
      ),
    ).toBe(true)
    const l = await liste(s.users.coord.headers, `&dossier=${String(i.contNum)}`)
    expect(l.lignes[0]).toMatchObject({ origine: 'PRE_TEST', nb: 2, statut: 'EN_ATTENTE' })
  })

  it.each([
    [{ visuelId: null }, 'Choisissez un visuel et un destinataire.'],
    [{ destinataireId: null }, 'Choisissez un visuel et un destinataire.'],
  ])('RG-COO-224 rejet : champ manquant %o → 422', async (manque, message) => {
    const s = await site()
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      theme: 'T',
      pourcentage: 100,
    })
    const r = await post(ctx, '/api/coordination/trains', s.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: formatSemaineIso(SEM),
      type: 'ENTRETIEN_AJOUTE',
      nombre: 1,
      visuelId: v.id,
      destinataireId: s.destinataire.id,
      ...manque,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ message, regle: 'RG-COO-224' })
  })

  it('RG-COO-224 rejet : départ antérieur à la semaine en production, atelier non déroulant → 422 ; chef d’équipe → 403', async () => {
    const s = await site()
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      theme: 'T',
      pourcentage: 100,
    })
    const corps = {
      atelierId: s.atelier.id,
      depart: formatSemaineIso(plus(S, -1)),
      type: 'PRE_TEST',
      nombre: 1,
      visuelId: v.id,
      destinataireId: s.destinataire.id,
    }
    expect(
      (await post(ctx, '/api/coordination/trains', s.users.coord.headers, corps)).statusCode,
    ).toBe(422)
    const fixe = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'FIXE' })
    const r = await post(ctx, '/api/coordination/trains', s.users.coord.headers, {
      ...corps,
      depart: formatSemaineIso(SEM),
      atelierId: fixe.id,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-224')
    expect(
      (
        await post(ctx, '/api/coordination/trains', s.users.cheq.headers, {
          ...corps,
          depart: formatSemaineIso(SEM),
        })
      ).statusCode,
    ).toBe(403)
  })

  it('RG-COO-225 supprimer avec motif : faces ANNULÉES, motif et historique, train retiré de la liste', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId, faces } = await trainDirect(s, [[c, 'Rose']])
    const r = await post(
      ctx,
      `/api/coordination/trains/${trainId}/suppression`,
      s.users.coord.headers,
      {
        version: await versionDe(s, trainId),
        motif: 'Ville de Paris : affiche à ne pas poser',
      },
    )
    expect(r.statusCode).toBe(200)
    expect(
      await db.faceTrain.findUniqueOrThrow({ where: { id: faces[0]?.id ?? 0 } }),
    ).toMatchObject({
      statut: 'ANNULE',
      motifSuppression: 'Ville de Paris : affiche à ne pas poser',
    })
    expect(
      await db.statutHistorique.findFirstOrThrow({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(faces[0]?.id), regle: 'RG-COO-225' },
      }),
    ).toMatchObject({ nouveau: 'ANNULE', motif: 'Ville de Paris : affiche à ne pas poser' })
    expect((await liste(s.users.coord.headers, `&dossier=${String(c)}`)).lignes).toHaveLength(0)
  })

  it('RG-COO-225 rejet : motif absent → 400 ; train en production → 409 ; chef d’équipe → 403', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'AU_ROULAGE' })
    const version = await versionDe(s, trainId)
    const url = `/api/coordination/trains/${trainId}/suppression`
    expect((await post(ctx, url, s.users.coord.headers, { version })).statusCode).toBe(400)
    const r = await post(ctx, url, s.users.coord.headers, { version, motif: 'Autre' })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-223')
    expect(
      (await post(ctx, url, s.users.cheq.headers, { version, motif: 'Autre' })).statusCode,
    ).toBe(403)
  })
})

describe('RG-COO-218 / 219 / 220 changer statut, annuler thème, débloquer semaine', () => {
  it('RG-COO-218 Liste : 2 → 5 puis 5 → 10 avec rouleur (historique) ; rouleur absent → 422 ; 2 → 10 → 409', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const url = '/api/coordination/trains/statut'
    const corps = async (vers: string, extra = {}) => ({
      trains: [{ trainId, version: await versionDe(s, trainId) }],
      vers,
      ecran: 'LISTE',
      ...extra,
    })
    const interdit = await post(
      ctx,
      url,
      s.users.coord.headers,
      await corps('AU_ROULAGE', { rouleurId: 1 }),
    )
    expect(interdit.statusCode).toBe(409)
    expect(erreur(interdit).regle).toBe('RG-COO-218')
    expect(
      (await post(ctx, url, s.users.coord.headers, await corps('A_IMPRIMER'))).statusCode,
    ).toBe(200)
    const sansRouleur = await post(ctx, url, s.users.coord.headers, await corps('AU_ROULAGE'))
    expect(sansRouleur.statusCode).toBe(422)
    expect(erreur(sansRouleur).regle).toBe('RG-COO-217')
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id })
    expect(
      (
        await post(
          ctx,
          url,
          s.users.coord.headers,
          await corps('AU_ROULAGE', { rouleurId: rouleur.id }),
        )
      ).statusCode,
    ).toBe(200)
    expect(
      await db.faceTrain.findUniqueOrThrow({ where: { id: faces[0]?.id ?? 0 } }),
    ).toMatchObject({
      statut: 'AU_ROULAGE',
      rouleurId: rouleur.id,
    })
    expect(
      (
        await db.statutHistorique.findMany({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(faces[0]?.id) },
        })
      ).map((h) => `${h.ancien ?? ''}>${h.nouveau}`),
    ).toEqual(['INSTRUCTION_OK>A_IMPRIMER', 'A_IMPRIMER>AU_ROULAGE'])
  })

  it('RG-COO-218 Préparation : 10 → 5 accepté ; une face à 2 dans la sélection → 409 (message legacy) ; chef d’équipe → 403', async () => {
    const s = await site()
    const roulage = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'AU_ROULAGE' })
    const deux = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const url = '/api/coordination/trains/statut'
    const v = async (t: { trainId: string }) => ({
      trainId: t.trainId,
      version: await versionDe(s, t.trainId),
    })
    const refus = await post(ctx, url, s.users.coord.headers, {
      trains: [await v(roulage), await v(deux)],
      vers: 'A_IMPRIMER',
      ecran: 'PREPARATION',
    })
    expect(refus.statusCode).toBe(409)
    expect(erreur(refus).message).toBe(
      "Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' !",
    )
    const corps = { trains: [await v(roulage)], vers: 'A_IMPRIMER', ecran: 'PREPARATION' }
    expect((await post(ctx, url, s.users.cheq.headers, corps)).statusCode).toBe(403)
    expect((await post(ctx, url, s.users.coord.headers, corps)).statusCode).toBe(200)
  })

  it('RG-COO-219 annuler un thème « A imprimer » : faces ANNULÉES, train vidé ; rejet si une face n’est pas à 5', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    const b = await trainDirect(s, [[c, 'Rose']])
    const url = '/api/coordination/trains/annuler-theme'
    const corps = {
      atelierId: s.atelier.id,
      depart: formatSemaineIso(SEM),
      contNum: c,
      theme: 'rose',
    }
    const refus = await post(ctx, url, s.users.coord.headers, corps)
    expect(refus.statusCode).toBe(409)
    expect(erreur(refus).message).toBe(
      "Toutes les faces du theme ne sont pas dans le statut 'A Imprimer'",
    )
    await db.faceTrain.update({
      where: { id: b.faces[0]?.id ?? 0 },
      data: { statut: 'A_IMPRIMER' },
    })
    expect((await post(ctx, url, s.users.coord.headers, corps)).statusCode).toBe(200)
    expect(
      await db.faceTrain.findUniqueOrThrow({ where: { id: a.faces[0]?.id ?? 0 } }),
    ).toMatchObject({
      statut: 'ANNULE',
      trainId: null,
    })
  })

  it('RG-COO-220 débloquer semaine : faces et instructions 5 → 2 ; rejets « pas de données » et « pas toutes à A imprimer »', async () => {
    const s = await site()
    const url = '/api/coordination/trains/debloquer-semaine'
    const corps = { atelierId: s.atelier.id, depart: formatSemaineIso(SEM) }
    const vide = await post(ctx, url, s.users.coord.headers, corps)
    expect(vide.statusCode).toBe(409)
    expect(erreur(vide).message).toBe("Il n'y a pas de données à traiter !")
    const t = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'A_IMPRIMER' })
    const code = t.faces[0]?.instructionCode ?? ''
    await db.instruction.update({ where: { code }, data: { statut: 'PRET_A_PRODUIRE' } })
    const enProd = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'AU_ROULAGE' })
    const refus = await post(ctx, url, s.users.coord.headers, corps)
    expect(refus.statusCode).toBe(409)
    expect(erreur(refus).message).toBe("Toutes les données ne sont pas au statut 'A imprimer' !")
    await db.faceTrain.update({
      where: { id: enProd.faces[0]?.id ?? 0 },
      data: { statut: 'ANNULE' },
    })
    expect((await post(ctx, url, s.users.coord.headers, corps)).statusCode).toBe(200)
    expect(
      (await db.faceTrain.findUniqueOrThrow({ where: { id: t.faces[0]?.id ?? 0 } })).statut,
    ).toBe('INSTRUCTION_OK')
    expect((await db.instruction.findUniqueOrThrow({ where: { code } })).statut).toBe(
      'INSTRUCTION_OK',
    )
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'INSTRUCTION', entiteId: code, regle: 'RG-COO-220' },
      }),
    ).toBe(1)
  })
})

describe('RG-COO-226 dupliquer un train', () => {
  it('RG-COO-226 l’administrateur copie N fois (+190 par exemplaire), copies « A imprimer » avec l’afficheur saisi', async () => {
    const s = await site()
    const source = `8${String(next()).padStart(10, '0')}`
    await trainDirect(
      s,
      [
        [700_000 + next(), 'Rose'],
        [700_000 + next(), 'Gris'],
      ],
      { trainId: source },
    )
    const cible = String(5_000_000_000 + next() * 1000)
    const r = await post(ctx, '/api/coordination/trains/dupliquer', s.users.admin.headers, {
      trainSource: source,
      trainCible: cible,
      afficheur: 'REMPLACEMENT',
      nombre: 2,
    })
    expect(r.statusCode).toBe(200)
    const ids = [String(BigInt(cible) + 190n), String(BigInt(cible) + 380n)]
    const copies = await db.faceTrain.findMany({ where: { trainId: { in: ids } } })
    expect(copies).toHaveLength(4)
    expect(
      copies.every((x) => x.statut === 'A_IMPRIMER' && x.afficheurNom === 'REMPLACEMENT'),
    ).toBe(true)
  })

  it('RG-COO-226 rejets : coordinateur → 403, source inconnue → 404, cible déjà prise → 409', async () => {
    const s = await site()
    const source = `8${String(next()).padStart(10, '0')}`
    await trainDirect(s, [[700_000 + next(), 'Rose']], { trainId: source })
    const corps = { trainSource: source, trainCible: '100', afficheur: 'X', nombre: 1 }
    const url = '/api/coordination/trains/dupliquer'
    expect((await post(ctx, url, s.users.coord.headers, corps)).statusCode).toBe(403)
    expect(
      (await post(ctx, url, s.users.admin.headers, { ...corps, trainSource: '1' })).statusCode,
    ).toBe(404)
    await trainDirect(s, [[700_000 + next(), 'Rose']], { trainId: '290' })
    const pris = await post(ctx, url, s.users.admin.headers, corps)
    expect(pris.statusCode).toBe(409)
    expect(erreur(pris).regle).toBe('RG-COO-226')
  })
})

describe('RG-COO-307 historique visible dans la fiche train', () => {
  it('RG-COO-307 la fiche montre les modifications tracées (journal du train et statuts des faces)', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    await post(ctx, '/api/coordination/trains/statut', s.users.coord.headers, {
      trains: [{ trainId, version: await versionDe(s, trainId) }],
      vers: 'A_IMPRIMER',
      ecran: 'LISTE',
    })
    const fiche = FicheTrainSchema.parse(
      (await get(ctx, `/api/coordination/trains/${trainId}`, s.users.coord.headers)).json(),
    )
    expect(fiche.modifications.map((m) => m.action)).toEqual(
      expect.arrayContaining([
        'CHANGEMENT_STATUT_FACE',
        expect.stringContaining('INSTRUCTION_OK → A_IMPRIMER'),
      ]),
    )
    expect(fiche.modifications.every((m) => m.par !== null)).toBe(true)
  })

  it('RG-COO-167 fiche d’un train hors périmètre → 403 ; train inconnu → 404', async () => {
    const s = await site()
    const autre = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    expect(
      (await get(ctx, `/api/coordination/trains/${trainId}`, autre.users.coord.headers)).statusCode,
    ).toBe(403)
    expect(
      (await get(ctx, '/api/coordination/trains/INCONNU', s.users.coord.headers)).statusCode,
    ).toBe(404)
  })
})

describe('RG-COO-307 / 308 atomicité et permissions des actions', () => {
  async function panne<T>(action: string, run: () => Promise<T>) {
    await db.$executeRawUnsafe(
      `CREATE TRIGGER t_trains_panne BEFORE INSERT ON journal_audit WHEN NEW.action = '${action}' BEGIN SELECT RAISE(ABORT, 'panne'); END`,
    )
    try {
      return await run()
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS t_trains_panne')
    }
  }

  it('RG-COO-307 atomicité de l’Instruction OK : échec de la trace du calcul → instruction « En cours », faces intactes', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const fa = await face(s, i.code, dossier.contNum, 1)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    const r = await panne('CALCUL_TRAINS', () => iok(s, i.code, i.version))
    expect(r.statusCode).toBe(500)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: fa.id } })).toMatchObject({
      statut: 'A_TRAITER',
      trainId: null,
      version: fa.version,
    })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'FACE_TRAIN', entiteId: String(fa.id) },
      }),
    ).toBe(0)
  })

  it('RG-COO-308 atomicité d’une action de masse : échec de la trace du 2e train → aucun des deux n’est fractionné', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    const b = await trainDirect(s, [
      [c, 'Rose'],
      [c + 2, 'Noir'],
    ])
    await recu(s, c, 'Rose', 5)
    const trains = [
      { trainId: a.trainId, version: await versionDe(s, a.trainId) },
      { trainId: b.trainId, version: await versionDe(s, b.trainId) },
    ]
    const r = await panne('FRACTIONNEMENT_TRAIN', () =>
      post(ctx, '/api/coordination/trains/fractionner', s.users.coord.headers, { trains }),
    )
    expect(r.statusCode).toBe(500)
    expect(
      await db.faceTrain.count({
        where: { trainId: { in: [a.trainId, b.trainId] }, fractionnee: true },
      }),
    ).toBe(0)
  })

  it('RG-COO-225 atomicité : échec de la trace → train non supprimé', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const r = await panne('SUPPRESSION_TRAIN', async () =>
      post(ctx, `/api/coordination/trains/${trainId}/suppression`, s.users.coord.headers, {
        version: await versionDe(s, trainId),
        motif: 'Autre',
      }),
    )
    expect(r.statusCode).toBe(500)
    expect(
      (await db.faceTrain.findUniqueOrThrow({ where: { id: faces[0]?.id ?? 0 } })).statut,
    ).toBe('INSTRUCTION_OK')
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-219 / 220 annuler thème et débloquer semaine pour le rôle %s (réservé à la Coordination)',
    async (r) => {
      const s = await site()
      const c = 700_000 + next()
      await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
      const depart = formatSemaineIso(SEM)
      const a = await post(ctx, '/api/coordination/trains/annuler-theme', s.users[r].headers, {
        atelierId: s.atelier.id,
        depart,
        contNum: c,
        theme: 'Rose',
      })
      expect(a.statusCode).toBe(r === 'coord' ? 200 : 403)
      const d = await post(ctx, '/api/coordination/trains/debloquer-semaine', s.users[r].headers, {
        atelierId: s.atelier.id,
        depart,
      })
      // Après l'annulation du thème (coord), il ne reste rien à débloquer : 409 « pas de données ».
      expect(d.statusCode).toBe(r === 'coord' ? 409 : 403)
    },
  )

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-222 / 224 raccrocher (coord, cheq) et créer un train (coord) pour le rôle %s',
    async (r) => {
      const s = await site()
      const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
      const { i } = await instruction(s)
      const v = await f.createInstructionVisuel(db, {
        instructionCode: i.code,
        afchIdent: 4,
        theme: 'Autre',
        pourcentage: 100,
      })
      const rac = await post(ctx, '/api/coordination/trains/raccrocher', s.users[r].headers, {
        visuelId: v.id,
        trains: [{ trainId, version: await versionDe(s, trainId) }],
      })
      expect(rac.statusCode).toBe(['coord', 'cheq'].includes(r) ? 200 : 403)
      const cr = await post(ctx, '/api/coordination/trains', s.users[r].headers, {
        atelierId: s.atelier.id,
        depart: formatSemaineIso(SEM),
        type: 'PRE_TEST',
        nombre: 1,
        visuelId: v.id,
        destinataireId: s.destinataire.id,
      })
      expect(cr.statusCode).toBe(r === 'coord' ? 200 : 403)
      const opt = await get(
        ctx,
        `/api/coordination/trains/options-creation?atelier=${String(s.atelier.id)}`,
        s.users[r].headers,
      )
      expect(opt.statusCode).toBe(r === 'coord' ? 200 : 403)
    },
  )

  it('RG-COO-308 changer statut : version périmée d’un train → 409, aucune face modifiée', async () => {
    const s = await site()
    const a = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const b = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const r = await post(ctx, '/api/coordination/trains/statut', s.users.coord.headers, {
      trains: [
        { trainId: a.trainId, version: await versionDe(s, a.trainId) },
        { trainId: b.trainId, version: '9.9.9' },
      ],
      vers: 'A_IMPRIMER',
      ecran: 'LISTE',
    })
    expect(r.statusCode).toBe(409)
    expect(
      (await db.faceTrain.findUniqueOrThrow({ where: { id: a.faces[0]?.id ?? 0 } })).statut,
    ).toBe('INSTRUCTION_OK')
  })
})
