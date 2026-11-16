// COO-P09 — tests COMPLÉMENTAIRES des trains (trains.int.test.ts n'est pas dupliqué), uniquement d'intégration.
// Source de l'attendu (les règles, pas le code) : docs/COORDINATION_REGLES_METIER.md RG-COO-200 à 209, 218 à 229,
// 307, 308, §2 (profils × actions), §3.2 (machine d'états de la face de train) ; hypothèses Q-192, Q-250, Q-256,
// Q-280, Q-286 ; CLAUDE.md §6 (400 validation, 403 permission, 409 transition / version, atomicité, idempotence).
// RG-COO-204 (campagne contrôlée) est BLOQUÉE (Q-257) : aucun test. RG-COO-210 à 217 relèvent de COO-P10.
// Les écarts constatés (ANO-040 à 042) ont été corrigés dans le code ; ils sont reportés dans RAPPORT_TESTS.md.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  CreerTrainResultatSchema,
  FicheTrainSchema,
  ListeTrainsSchema,
  OptionsCreationTrainSchema,
  ResultatActionTrainsSchema,
  VisuelsRaccrochablesSchema,
  formatSemaineIso,
  lundiSemaineIso,
  selectionnerPremiers,
  semaineIsoDe,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { Prisma, StatutProduction } from '../../src/generated/prisma/client.ts'
import { integrerFacesInstruction } from '../../src/modules/coordination/integration-flux.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import {
  contexteReception,
  erreur,
  get,
  idem,
  post,
  receptionValidee,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>
const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']
// Q-421 : l'admin est super-utilisateur ; les matrices de refus ne le parcourent pas.
const ROLES_SANS_ADMIN = ROLES.filter((r) => r !== 'admin')
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const S = semaineIsoDe(new Date())
const SEM = plus(S, 1)
const JOUR = 86_400_000
const DEPART = new Date(lundiSemaineIso(SEM).getTime() + JOUR + 16 * 3_600_000)
const MOIS_SEM = formatSemaineIso(SEM)

const URL_FRAC = '/api/coordination/trains/fractionner'
const URL_RACC = '/api/coordination/trains/raccrocher'
const URL_CREER = '/api/coordination/trains'
const URL_STATUT = '/api/coordination/trains/statut'
const URL_ANNULER = '/api/coordination/trains/annuler-theme'
const URL_DEBLOQUER = '/api/coordination/trains/debloquer-semaine'
const URL_DUPLIQUER = '/api/coordination/trains/dupliquer'
const urlSuppr = (id: string) => `/api/coordination/trains/${id}/suppression`

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

let numDeclencheur = 0
/** Atomicité : déclencheur SQLite temporaire RAISE(ABORT) posé sur test.db, toujours supprimé (finally). */
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_trn_${String(++numDeclencheur)}_${String(next())}`
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

/** Site avec deux ateliers déroulants, un utilisateur par rôle. */
async function site() {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const atelier2 = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const support = await f.createSupport(db)
  const destinataire = await f.createDestinataire(db, { nom: `Dest ${String(next())}` })
  const users = {} as Record<Role, { id: number; headers: Headers; ext: string }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne), ext: u.identifiantExterne }
  }
  return { plateforme, atelier, atelier2, support, destinataire, users, sect: 100 + (next() % 800) }
}
type Site = Awaited<ReturnType<typeof site>>

interface OptionsInstruction {
  tipInsCode?: number
  entretien?: number | null
  atelierId?: number
  semaine?: SemaineIso
  statut?: 'EN_COURS' | 'INSTRUCTION_OK' | 'PRET_A_PRODUIRE' | 'ANNULE'
  dossierStatut?: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE'
}

/** Dossier + instruction d'un atelier (EN_COURS par défaut), sans face. */
async function instruction(s: Site, o: OptionsInstruction = {}) {
  const dossier = await f.createDossier(db, {
    statut: o.dossierStatut ?? 'PREPARATION_RECUE',
    annonceur: 'ANNONCEUR',
  })
  const sem = o.semaine ?? SEM
  const i = await f.createInstruction(db, {
    atelierId: o.atelierId ?? s.atelier.id,
    dossierId: dossier.id,
    contNum: dossier.contNum,
    annonceur: "L'ANNONCEUR",
    contAnbas: sem.annee,
    contSembas: sem.semaine,
    statut: o.statut ?? 'EN_COURS',
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

interface OptionsCalcul extends OptionsInstruction {
  nbFaces?: number
  empl0?: number
  visuels?: { afchIdent: number; theme: string; pourcentage: number }[]
  donneesFace?: (rang: number) => Partial<Prisma.FaceTrainUncheckedCreateInput>
}

/** Instruction + faces Broadcast + visuels, puis Instruction OK manuelle (calcul des trains). */
async function calculer(s: Site, o: OptionsCalcul = {}) {
  const { dossier, i } = await instruction(s, o)
  const faces = []
  for (let k = 1; k <= (o.nbFaces ?? 1); k++)
    faces.push(await face(s, i.code, dossier.contNum, (o.empl0 ?? 0) + k, o.donneesFace?.(k)))
  for (const v of o.visuels ?? [{ afchIdent: 7, theme: 'Thème', pourcentage: 100 }])
    await f.createInstructionVisuel(db, { instructionCode: i.code, ...v })
  const r = await iok(s, i.code, i.version)
  return { dossier, i, faces, r }
}
const facesDe = (code: string) =>
  db.faceTrain.findMany({ where: { instructionCode: code }, orderBy: { id: 'asc' } })

async function liste(headers: Headers, qs = '', semaine = MOIS_SEM) {
  const r = await get(ctx, `/api/coordination/trains?depart=${semaine}${qs}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return ListeTrainsSchema.parse(r.json())
}

async function ficheDe(s: Site, trainId: string, headers: Headers = s.users.coord.headers) {
  const r = await get(ctx, `/api/coordination/trains/${trainId}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return FicheTrainSchema.parse(r.json())
}
const versionDe = async (s: Site, trainId: string) => (await ficheDe(s, trainId)).version

interface OptionsTrain {
  statut?: StatutProduction
  trainId?: string
  depart?: Date
  atelierId?: number
  destinataireId?: number
  afficheurNom?: string
  annonceur?: string
  semaine?: SemaineIso
  extra?: Partial<Prisma.FaceTrainUncheckedCreateInput>
}

/** Train déjà calculé (faces au statut donné) : `positions` = [contNum, thème] par position. */
async function trainDirect(s: Site, positions: [number, string][], o: OptionsTrain = {}) {
  const trainId = o.trainId ?? `9${String(next()).padStart(15, '0')}`
  const faces = []
  let k = 0
  for (const [contNum, theme] of positions) {
    const { i } = await instruction(s)
    faces.push(
      await f.createFaceTrain(db, {
        instructionCode: i.code,
        statut: o.statut ?? 'INSTRUCTION_OK',
        atelierId: o.atelierId ?? s.atelier.id,
        supportId: s.support.id,
        destinataireId: o.destinataireId ?? s.destinataire.id,
        contNum,
        contAnnonc: o.annonceur ?? 'ANNONCEUR',
        dateDepart: o.depart ?? DEPART,
        contAnbas: (o.semaine ?? SEM).annee,
        contSembas: (o.semaine ?? SEM).semaine,
        depAnbas: (o.semaine ?? SEM).annee,
        depSembas: (o.semaine ?? SEM).semaine,
        trainId,
        theme,
        ordreReel: ++k,
        refPanel: `P${String(next())}`,
        afficheurNom: o.afficheurNom ?? 'AFFICHEUR SUD',
        ...o.extra,
      }),
    )
  }
  return { trainId, faces }
}

/** Reçu d'un visuel : ligne attendue du thème sur le site + affiche rattachée de `quantite`. */
async function recu(
  s: Site,
  contNum: number,
  theme: string,
  quantite: number,
  plateformeId?: number,
) {
  const l = await f.createReceptionAttendue(db, {
    plateformeId: plateformeId ?? s.plateforme.id,
    supportId: s.support.id,
    contNum,
    theme,
    themeCle: theme.toUpperCase(),
    semAnnee: SEM.annee,
    semNum: SEM.semaine,
  })
  const a = await f.createAffiche(db, {
    plateformeId: plateformeId ?? s.plateforme.id,
    supportId: s.support.id,
    contNum,
    theme,
    quantite,
    allee: 'B',
    rayon: '12',
  })
  await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite })
}

const envoyer = (url: string, headers: Headers, payload: unknown, cle: Headers = idem()) =>
  ctx.app.inject({
    method: 'POST',
    url,
    headers: { ...headers, ...cle },
    payload: payload as object,
  })

const versions = async (s: Site, ids: string[]) => {
  const r = []
  for (const trainId of ids) r.push({ trainId, version: await versionDe(s, trainId) })
  return r
}
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })
const historiques = (faceId: number) =>
  db.statutHistorique.findMany({
    where: { typeEntite: 'FACE_TRAIN', entiteId: String(faceId) },
    orderBy: { id: 'asc' },
  })
const aaSs = `${String(SEM.annee).slice(-2)}${String(SEM.semaine).padStart(2, '0')}`

/** Emplacement unique (secteur, commune, n°) : aucune collision d'identifiant de train entre tests. */
const empUnique = () => ({
  emplSectCode: 100 + (next() % 800),
  commNumord: 100 + (next() % 800),
})
const emplUnique = () => 1000 + (next() % 9000)

// ───────────────── RG-COO-200 identifiant et version d'un train ─────────────────

describe('RG-COO-200 identifiant et version d’un train (complément)', () => {
  it('RG-COO-200 identifiant complet : AA + SS (semaine de DÉPART) + secteur (3) + département (2) + commune (3) + emplacement (4) + train (1) + version (1)', async () => {
    const s = await site()
    const { i, faces } = await calculer(s, {
      donneesFace: () => ({
        depAnbas: 2027,
        depSembas: 1,
        emplSectCode: 5,
        emplDepaCode: '07',
        commNumord: 7,
        emplNumord: 12,
        train: 3,
        cadrIdent: 50_001,
      }),
    })
    const calc = await faceDe(faces[0]?.id ?? 0)
    expect(calc.instructionCode).toBe(i.code)
    expect(calc.trainId).toBe('270100507007001230')
    expect(calc.versionTrain).toBe(0)
  })

  it('RG-COO-200 version = max des versions des faces de statut 5 à 10 du même emplacement / train / semaine + 1 (les statuts 2 et 4, une autre semaine ou un autre train sont ignorés)', async () => {
    const s = await site()
    const emp = empUnique()
    const empl = emplUnique()
    const prior = await instruction(s)
    const ancienne = (statut: StatutProduction, versionTrain: number, extra = {}) =>
      face(s, prior.i.code, prior.dossier.contNum, empl, {
        ...emp,
        statut,
        versionTrain,
        cadrIdent: 30_000 + next(),
        ...extra,
      })
    await ancienne('A_IMPRIMER', 1)
    await ancienne('TERMINE', 3)
    await ancienne('AU_ROULAGE', 2)
    await ancienne('ANNULE', 8)
    await ancienne('INSTRUCTION_OK', 9)
    await ancienne('A_IMPRIMER', 7, { depSembas: (SEM.semaine % 50) + 1 })
    await ancienne('A_IMPRIMER', 6, { train: 2 })
    const { faces } = await calculer(s, {
      donneesFace: () => ({ ...emp, emplNumord: empl, cadrIdent: 30_000 + next() }),
    })
    const calc = await faceDe(faces[0]?.id ?? 0)
    expect(calc.versionTrain).toBe(4)
    expect(calc.trainId?.endsWith('4')).toBe(true)
  })

  it('RG-COO-200 rejet : sans face « A imprimer » à « Au roulage » sur l’emplacement (seulement 2 et 4 de version élevée) ⇒ version 0', async () => {
    const s = await site()
    const emp = empUnique()
    const empl = emplUnique()
    const prior = await instruction(s)
    for (const statut of ['INSTRUCTION_OK', 'ANNULE'] as const)
      await face(s, prior.i.code, prior.dossier.contNum, empl, {
        ...emp,
        statut,
        versionTrain: 9,
        cadrIdent: 31_000 + next(),
      })
    const { faces } = await calculer(s, {
      donneesFace: () => ({ ...emp, emplNumord: empl, cadrIdent: 31_000 + next() }),
    })
    const calc = await faceDe(faces[0]?.id ?? 0)
    expect(calc.versionTrain).toBe(0)
    expect(calc.trainId?.endsWith('0')).toBe(true)
  })

  it('RG-COO-200 chaque face de l’instruction porte son identifiant (un train par emplacement) et reçoit la même version sur un même emplacement', async () => {
    const s = await site()
    const emp = empUnique()
    const { faces } = await calculer(s, {
      nbFaces: 3,
      empl0: emplUnique(),
      donneesFace: () => ({ ...emp }),
    })
    const calc = await db.faceTrain.findMany({
      where: { id: { in: faces.map((x) => x.id) } },
      orderBy: { id: 'asc' },
    })
    expect(new Set(calc.map((x) => x.trainId)).size).toBe(3)
    expect(calc.every((x) => x.trainId?.length === 18 && x.versionTrain === 0)).toBe(true)
  })
})

// ───────────────── RG-COO-201 position dans le train ─────────────────

describe('RG-COO-201 position dans le train (complément)', () => {
  it('RG-COO-201 code 1 « début de train » ⇒ ordre réel 0 ; ordre proposé = rang', async () => {
    const s = await site()
    const { faces } = await calculer(s, { tipInsCode: 1, empl0: 4 })
    const calc = await faceDe(faces[0]?.id ?? 0)
    expect(calc).toMatchObject({ ordreReel: 0, ordrePropose: 5 })
  })

  it('RG-COO-201 quatre instructions sur le MÊME train (même emplacement) : ordre début (1) < milieu (4) < fin − 1 (3) < fin (2) dans la liste des trains', async () => {
    const s = await site()
    const emp = empUnique()
    const empl = emplUnique()
    const parCode = new Map<number, number>()
    for (const tip of [2, 3, 1, 4]) {
      const { dossier } = await calculer(s, {
        tipInsCode: tip,
        donneesFace: () => ({ ...emp, emplNumord: empl, cadrIdent: 40_000 + next() }),
        visuels: [{ afchIdent: 40 + tip, theme: `Thème ${String(tip)}`, pourcentage: 100 }],
      })
      parCode.set(tip, dossier.contNum)
    }
    const l = await liste(s.users.coord.headers, `&dossier=${String(parCode.get(1))}`)
    expect(l.lignes).toHaveLength(1)
    expect(l.lignes[0]?.positions.map((p) => p.contNum)).toEqual([
      parCode.get(1),
      parCode.get(4),
      parCode.get(3),
      parCode.get(2),
    ])
  })
})

// ───────────────── RG-COO-202 répartition des thèmes ─────────────────

describe('RG-COO-202 répartition des thèmes sur les faces (complément)', () => {
  const comptes = async (code: string) => {
    const m = new Map<string | null, number>()
    for (const x of await facesDe(code))
      if (x.ftType !== 'entretien') m.set(x.theme, (m.get(x.theme) ?? 0) + 1)
    return m
  }

  it('RG-COO-202 prorata exact : 10 faces à 70 % / 30 % ⇒ 7 et 3 ; 20 faces à 25 / 25 / 50 % ⇒ 5, 5, 10', async () => {
    const s = await site()
    const a = await calculer(s, {
      nbFaces: 10,
      visuels: [
        { afchIdent: 1, theme: 'Sept', pourcentage: 70 },
        { afchIdent: 2, theme: 'Trois', pourcentage: 30 },
      ],
    })
    expect(Object.fromEntries(await comptes(a.i.code))).toEqual({ Sept: 7, Trois: 3 })
    const b = await calculer(s, {
      nbFaces: 20,
      visuels: [
        { afchIdent: 1, theme: 'Un quart', pourcentage: 25 },
        { afchIdent: 2, theme: 'Autre quart', pourcentage: 25 },
        { afchIdent: 3, theme: 'Moitié', pourcentage: 50 },
      ],
    })
    expect(Object.fromEntries(await comptes(b.i.code))).toEqual({
      'Un quart': 5,
      'Autre quart': 5,
      Moitié: 10,
    })
  })

  // ANO-040 (corrigée) : RG-COO-202 « nb_tot = int(pourcentage × nombre de faces) ». Le calcul flottant
  // trunc(0,58 × 50) vaut 28 (28,999999999999996) au lieu de 29 : le visuel à 58 % reçoit 28 faces et celui
  // à 42 % en reçoit 22 au lieu de 21 quand le visuel à 58 % a l'identifiant le plus grand
  // (trains-calcul.ts:repartirThemes, `Math.trunc(frequence * nbTotalFaces)`).
  it('RG-COO-202 prorata : 50 faces à 42 % / 58 % ⇒ 21 et 29 faces (58 % × 50 = 29 exactement) (ANO-040)', async () => {
    const s = await site()
    const { i } = await calculer(s, {
      nbFaces: 50,
      visuels: [
        { afchIdent: 1, theme: 'Quarante-deux', pourcentage: 42 },
        { afchIdent: 2, theme: 'Cinquante-huit', pourcentage: 58 },
      ],
    })
    expect(Object.fromEntries(await comptes(i.code))).toEqual({
      'Quarante-deux': 21,
      'Cinquante-huit': 29,
    })
  })

  it('RG-COO-202 limite : 3 faces à 50 / 50 % ⇒ toutes les faces ont un thème, chaque visuel en reçoit au moins int(0,5 × 3) = 1', async () => {
    const s = await site()
    const { i } = await calculer(s, {
      nbFaces: 3,
      visuels: [
        { afchIdent: 1, theme: 'Premier', pourcentage: 50 },
        { afchIdent: 2, theme: 'Second', pourcentage: 50 },
      ],
    })
    const c = await comptes(i.code)
    expect(c.get(null)).toBeUndefined()
    expect((c.get('Premier') ?? 0) + (c.get('Second') ?? 0)).toBe(3)
    expect(c.get('Premier') ?? 0).toBeGreaterThanOrEqual(1)
    expect(c.get('Second') ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('RG-COO-202 une exception décompte le quota du visuel : 10 faces à 50 / 50 % dont 1 exception « Alpha » ⇒ 5 faces Alpha (exception comprise) et 5 Beta', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const cible = await face(s, i.code, dossier.contNum, 1)
    for (let k = 2; k <= 10; k++) await face(s, i.code, dossier.contNum, k)
    await f.createInstructionDetail(db, {
      instructionCode: i.code,
      cadrIdent: cible.cadrIdent,
      theme: 'Alpha',
      afchIdent: 1,
    })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Alpha',
      pourcentage: 50,
    })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 2,
      theme: 'Beta',
      pourcentage: 50,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect(Object.fromEntries(await comptes(i.code))).toEqual({ Alpha: 5, Beta: 5 })
    expect(await faceDe(cible.id)).toMatchObject({ ftType: 'exception', theme: 'Alpha' })
    expect(await db.faceTrain.count({ where: { instructionCode: i.code, ftType: 'face' } })).toBe(9)
  })

  it.each([
    ['ab', 'ab---'],
    ['A', 'A---'],
    ['abc', 'abc'],
    ["d'a", 'd a'],
    ['a"b', 'a b'],
    ["a'", 'a ---'],
  ])(
    'RG-COO-202 thème « %s » ⇒ « %s » (< 3 caractères complété par ---, apostrophes et guillemets en espaces)',
    async (saisi, attendu) => {
      const s = await site()
      const { faces } = await calculer(s, {
        visuels: [{ afchIdent: 9, theme: saisi, pourcentage: 100 }],
      })
      expect((await faceDe(faces[0]?.id ?? 0)).theme).toBe(attendu)
    },
  )

  it('RG-COO-202 un bandeau à 100 % n’écrase pas le repiquage d’une exception : la face exception garde le sien, les autres prennent le bandeau', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const cible = await face(s, i.code, dossier.contNum, 1)
    const autre = await face(s, i.code, dossier.contNum, 2)
    await f.createInstructionDetail(db, {
      instructionCode: i.code,
      cadrIdent: cible.cadrIdent,
      theme: 'Exception',
      afchIdent: 900,
      repiquage: 'RepiquageX',
      repiquageIdent: 5,
    })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 901,
      theme: 'Thème',
      pourcentage: 100,
    })
    const bdx = (await db.typePreparation.create({ data: { libelle: `BDX ${String(next())}` } })).id
    await parametre('integration.typesVisuels', `visuel:10:26;bdx:${String(bdx)};detail:10`)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 902,
      theme: 'Bandeau prix',
      pourcentage: 100,
      typePreparationId: bdx,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect((await faceDe(cible.id)).repiquage).toBe('RepiquageX')
    expect((await faceDe(autre.id)).repiquage).toBe('Bandeau prix')
  })

  it('RG-COO-202 les faces passent de 0 / 1 / 3 à « Instruction ok » (2), historique par face avec l’ancien statut', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const a = await face(s, i.code, dossier.contNum, 1, { statut: 'A_TRAITER' })
    const b = await face(s, i.code, dossier.contNum, 2, { statut: 'EN_COURS' })
    const c = await face(s, i.code, dossier.contNum, 3, { statut: 'ERREUR' })
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    for (const [x, ancien] of [
      [a, 'A_TRAITER'],
      [b, 'EN_COURS'],
      [c, 'ERREUR'],
    ] as const) {
      expect((await faceDe(x.id)).statut).toBe('INSTRUCTION_OK')
      expect((await historiques(x.id)).map((h) => `${h.ancien ?? ''}>${h.nouveau}`)).toEqual([
        `${ancien}>INSTRUCTION_OK`,
      ])
    }
  })
})

// ───────────────── RG-COO-203 faces d'entretien ─────────────────

describe('RG-COO-203 faces d’entretien d’un train (complément)', () => {
  const entretien = (code: string) =>
    db.faceTrain.findMany({ where: { instructionCode: code, ftType: 'entretien' } })

  it('RG-COO-203 limite entière : 25 faces à 8 % ⇒ exactement 2 faces d’entretien (25 × 8 / 100 = 2, pas d’arrondi parasite)', async () => {
    const s = await site()
    const { i } = await calculer(s, { nbFaces: 25, entretien: null })
    expect(await entretien(i.code)).toHaveLength(2)
  })

  it('RG-COO-203 pourcentage par défaut paramétré (Q-256) : 50 faces, instruction sans % ⇒ 10 % ⇒ 5 faces d’entretien', async () => {
    const s = await site()
    await parametre('coordination.entretienDefaut', '10')
    const { i } = await calculer(s, { nbFaces: 50, entretien: null })
    expect(await entretien(i.code)).toHaveLength(5)
  })

  it('RG-COO-203 le % saisi sur l’instruction l’emporte sur le défaut ; 0 % ⇒ aucune face d’entretien', async () => {
    const s = await site()
    const { i } = await calculer(s, { nbFaces: 20, entretien: 0 })
    expect(await entretien(i.code)).toHaveLength(0)
  })

  it('RG-COO-203 limite du seuil (3) : exactement 3 faces à 50 % ⇒ 2 faces d’entretien (arrondi supérieur de 1,5)', async () => {
    const s = await site()
    const { i } = await calculer(s, { nbFaces: 3, entretien: 50 })
    expect(await entretien(i.code)).toHaveLength(2)
  })

  it('RG-COO-203 seuil paramétré à 5 : 4 faces ⇒ aucune ; 5 faces ⇒ une', async () => {
    const s = await site()
    await parametre('trains.entretienSeuil', '5')
    const a = await calculer(s, { nbFaces: 4, entretien: 10 })
    expect(await entretien(a.i.code)).toHaveLength(0)
    const b = await calculer(s, { nbFaces: 5, entretien: 10 })
    expect(await entretien(b.i.code)).toHaveLength(1)
  })

  it('RG-COO-203 grain AFFICHEUR (défaut) : 3 faces de chacun de 2 afficheurs ⇒ 1 face d’entretien par afficheur ; grain VILLE : un seul groupe de 6 ⇒ 1', async () => {
    const s = await site()
    const afficheurs = (k: number) => ({
      afficheurId: k <= 3 ? 11 : 12,
      afficheurNom: `AFF ${String(k <= 3 ? 11 : 12)}`,
    })
    const a = await calculer(s, { nbFaces: 6, entretien: 8, donneesFace: afficheurs })
    expect((await entretien(a.i.code)).length).toBe(2)
    await parametre('trains.entretienGrain', 'VILLE')
    const b = await calculer(s, { nbFaces: 6, entretien: 8, donneesFace: afficheurs })
    expect((await entretien(b.i.code)).length).toBe(1)
  })

  it('RG-COO-203 face d’entretien : afficheur « ENTRETIEN », statut 2, ordre propose = réel = 1, départ du groupe, identifiant AA SS secteur atelier dossier compteur « 19 »', async () => {
    const s = await site()
    const { dossier, i } = await calculer(s, { nbFaces: 10, entretien: 20 })
    const e = await entretien(i.code)
    expect(e).toHaveLength(2)
    const sect = String(s.sect).padStart(3, '0')
    const motif = new RegExp(
      `^${aaSs}${sect}${String(s.atelier.id).slice(-1)}${String(dossier.contNum).slice(-2)}\\d{6}19$`,
    )
    for (const x of e) {
      expect(x.trainId ?? '').toMatch(motif)
      expect(x).toMatchObject({
        statut: 'INSTRUCTION_OK',
        afficheurNom: 'ENTRETIEN',
        ordrePropose: 1,
        ordreReel: 1,
        dateDepart: DEPART,
      })
      expect((await historiques(x.id)).map((h) => h.nouveau)).toEqual(['INSTRUCTION_OK'])
    }
    expect(new Set(e.map((x) => x.trainId)).size).toBe(2)
  })

  it('RG-COO-203 les trains d’entretien sont listés comme tels (origine ENTRETIEN) et comptent dans le train du thème', async () => {
    const s = await site()
    const { dossier } = await calculer(s, { nbFaces: 10, entretien: 20 })
    const l = await liste(s.users.coord.headers, `&dossier=${String(dossier.contNum)}`)
    expect(l.lignes.filter((x) => x.origine === 'ENTRETIEN').reduce((n, x) => n + x.nb, 0)).toBe(2)
    expect(l.lignes.filter((x) => x.origine === 'CALCULE').reduce((n, x) => n + x.nb, 0)).toBe(10)
  })
})

// ───────────────── RG-COO-205 garde-fous anti-doublons ─────────────────

describe('RG-COO-205 garde-fous anti-doublons (complément)', () => {
  const chaine = async (afficheurs: [number, string][] = [[7, 'AFFICHEUR SUD']]) => {
    const s = await site()
    const emp = empUnique()
    const empl = emplUnique()
    const resultats = []
    for (const [k, [afficheurId, afficheurNom]] of afficheurs.entries()) {
      const r = await calculer(s, {
        donneesFace: () => ({
          ...emp,
          emplNumord: empl,
          cadrIdent: 4242,
          afficheurId,
          afficheurNom,
        }),
        visuels: [{ afchIdent: 60 + k, theme: `Thème ${String(k)}`, pourcentage: 100 }],
      })
      resultats.push({ ...r, face: r.faces[0] })
    }
    return { s, resultats }
  }

  it('RG-COO-205 (1) trois Instruction OK successives sur le même cadre d’un même train : seule la plus récente reste ; les deux précédentes ANNULÉES, train vidé, historique et journal', async () => {
    const { resultats } = await chaine([
      [7, 'AFFICHEUR SUD'],
      [7, 'AFFICHEUR SUD'],
      [7, 'AFFICHEUR SUD'],
    ])
    const [un, deux, trois] = resultats
    for (const ancienne of [un, deux]) {
      const x = await faceDe(ancienne?.face?.id ?? 0)
      expect(x).toMatchObject({ statut: 'ANNULE', trainId: null })
      const h = (await historiques(x.id)).at(-1)
      expect(h).toMatchObject({ ancien: 'INSTRUCTION_OK', nouveau: 'ANNULE', regle: 'RG-COO-205' })
      expect(h?.motif).toContain('Doublon')
      expect(
        await db.journalAudit.count({
          where: {
            typeEntite: 'FACE_TRAIN',
            entiteId: String(x.id),
            action: 'ANNULATION_FACE_DOUBLON',
          },
        }),
      ).toBe(1)
    }
    expect(await faceDe(trois?.face?.id ?? 0)).toMatchObject({ statut: 'INSTRUCTION_OK' })
    expect((await faceDe(trois?.face?.id ?? 0)).trainId).not.toBeNull()
  })

  it('RG-COO-205 (2) trois afficheurs sur un même train (cadres différents) : tous prennent l’afficheur de la face la plus récente', async () => {
    const s = await site()
    const emp = empUnique()
    const empl = emplUnique()
    const faces = []
    for (const [k, nom] of ['AFF 1', 'AFF 2', 'AFF 3'].entries()) {
      const { faces: fs } = await calculer(s, {
        donneesFace: () => ({
          ...emp,
          emplNumord: empl,
          cadrIdent: 7_000 + k,
          afficheurId: 21 + k,
          afficheurNom: nom,
        }),
        visuels: [{ afchIdent: 70 + k, theme: `Thème ${String(k)}`, pourcentage: 100 }],
      })
      faces.push(fs[0])
    }
    for (const x of faces) {
      const c = await faceDe(x?.id ?? 0)
      expect(c).toMatchObject({ afficheurId: 23, afficheurNom: 'AFF 3', statut: 'INSTRUCTION_OK' })
    }
  })

  it('RG-COO-205 rejet : deux faces de cadres différents sur le même train ne sont pas des doublons (aucune annulation)', async () => {
    const s = await site()
    const emp = empUnique()
    const empl = emplUnique()
    const a = await calculer(s, {
      donneesFace: () => ({ ...emp, emplNumord: empl, cadrIdent: 8_001 }),
      visuels: [{ afchIdent: 81, theme: 'Un', pourcentage: 100 }],
    })
    const b = await calculer(s, {
      donneesFace: () => ({ ...emp, emplNumord: empl, cadrIdent: 8_002 }),
      visuels: [{ afchIdent: 82, theme: 'Deux', pourcentage: 100 }],
    })
    expect((await faceDe(a.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect((await faceDe(b.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect((await faceDe(a.faces[0]?.id ?? 0)).trainId).toBe(
      (await faceDe(b.faces[0]?.id ?? 0)).trainId,
    )
  })

  it('RG-COO-205 (3) / RG-COO-307 face sans emplacement : ANNULÉE avec historique nominatif (jamais supprimée), instruction tout de même calculée', async () => {
    const s = await site()
    const { faces } = await calculer(s, {
      nbFaces: 2,
      donneesFace: (k) => (k === 1 ? { emplSectCode: null } : {}),
    })
    const [sans, avec] = faces
    expect(await faceDe(sans?.id ?? 0)).toMatchObject({ statut: 'ANNULE' })
    expect((await faceDe(avec?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    const h = (await historiques(sans?.id ?? 0)).at(-1)
    expect(h).toMatchObject({ nouveau: 'ANNULE', regle: 'RG-COO-205', parId: s.users.coord.id })
  })
})

// ───────────────── RG-COO-206 retour arrière ─────────────────

describe('RG-COO-206 retour arrière de l’instruction (complément)', () => {
  async function retour(s: Site, code: string, vers: string) {
    const lue = await db.instruction.findUniqueOrThrow({ where: { code } })
    return post(ctx, `/api/coordination/instructions/${code}/statut`, s.users.coord.headers, {
      version: lue.version,
      vers,
    })
  }

  it.each(['A_TRAITER', 'EN_COURS'] as const)(
    'RG-COO-206 retour à %s : faces à blanc (thème, train, version, position fractionnée), entretien supprimé ; un nouveau calcul recrée le tout sans doublon',
    async (vers) => {
      const s = await site()
      const { i, faces } = await calculer(s, { nbFaces: 10, entretien: 20 })
      const fractionnee = faces[0]?.id ?? 0
      await db.faceTrain.update({ where: { id: fractionnee }, data: { fractionnee: true } })
      expect(
        await db.faceTrain.count({ where: { instructionCode: i.code, ftType: 'entretien' } }),
      ).toBe(2)
      const r = await retour(s, i.code, vers)
      expect(r.statusCode, r.body).toBe(200)
      const apres = await facesDe(i.code)
      expect(apres).toHaveLength(10)
      expect(
        apres.every(
          (x) =>
            x.statut === vers &&
            x.trainId === null &&
            x.theme === null &&
            x.versionTrain === null &&
            !x.fractionnee,
        ),
      ).toBe(true)
      if (vers === 'EN_COURS') {
        const lue = await db.instruction.findUniqueOrThrow({ where: { code: i.code } })
        expect((await iok(s, i.code, lue.version)).statusCode).toBe(200)
        const refaits = await facesDe(i.code)
        expect(refaits.filter((x) => x.ftType === 'entretien')).toHaveLength(2)
        expect(refaits.filter((x) => x.ftType === 'face')).toHaveLength(10)
      }
    },
  )

  it('RG-COO-206 les faces « A imprimer » de l’instruction sont conservées avec leur thème, leur train et leur position fractionnée', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s, { entretien: 0 })
    const imprimee = await face(s, i.code, dossier.contNum, 9, {
      statut: 'A_IMPRIMER',
      trainId: 'IMPRIMEE1',
      theme: 'Gardé',
      fractionnee: true,
    })
    const encours = await face(s, i.code, dossier.contNum, 1)
    await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 1,
      theme: 'Thème',
      pourcentage: 100,
    })
    expect((await iok(s, i.code, i.version)).statusCode).toBe(200)
    expect((await retour(s, i.code, 'EN_COURS')).statusCode).toBe(200)
    expect(await faceDe(imprimee.id)).toMatchObject({
      statut: 'A_IMPRIMER',
      trainId: 'IMPRIMEE1',
      theme: 'Gardé',
      fractionnee: true,
    })
    expect(await faceDe(encours.id)).toMatchObject({ statut: 'EN_COURS', trainId: null })
  })

  it('RG-COO-206 rejet : instruction « Prêt à produire » (5) ⇒ retour refusé (409), faces et trains intacts', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s, { statut: 'PRET_A_PRODUIRE' })
    const x = await face(s, i.code, dossier.contNum, 1, {
      statut: 'A_IMPRIMER',
      trainId: 'PRET1',
      theme: 'T',
    })
    const r = await retour(s, i.code, 'EN_COURS')
    expect(r.statusCode).toBe(409)
    expect(await faceDe(x.id)).toMatchObject({
      statut: 'A_IMPRIMER',
      trainId: 'PRET1',
      version: x.version,
    })
  })
})

// ───────────────── RG-COO-207 afficheur d'un panneau ─────────────────

describe('RG-COO-207 reprise de l’afficheur d’un panneau (complément)', () => {
  const commun = (contNum: number, panel: string, nom: string, id: number) => ({
    idInterface: 1,
    contNum,
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
    afficheurId: id,
    afficheurNom: nom,
    ftType: null,
    traitement: 'E',
    idTypeDestinationDa: 1,
    refPanel: panel,
  })
  const integrer = (faces: ReturnType<typeof commun>[]) =>
    withTransaction(db, (tx) => integrerFacesInstruction(tx, faces, new Map()))

  it.each<StatutProduction>([
    'INSTRUCTION_OK',
    'A_IMPRIMER',
    'PREPARE',
    'A_EXPEDIER',
    'TERMINE',
    'EXPORT_PREPA',
    'AU_ROULAGE',
  ])(
    'RG-COO-207 face engagée au statut %s sur le panneau : la nouvelle face reprend son afficheur, la face engagée n’est pas modifiée',
    async (statut) => {
      const s = await site()
      const { dossier, i } = await instruction(s)
      const panel = `PAN${String(next())}`
      const engagee = await face(s, i.code, dossier.contNum, 1, {
        statut,
        refPanel: panel,
        afficheurId: 55,
        afficheurNom: 'ENGAGÉ',
      })
      const contNum = dossier.contNum + 1
      await integrer([commun(contNum, panel, 'NOUVEAU', 99)])
      const nouvelle = await db.faceTrain.findFirstOrThrow({ where: { contNum } })
      expect(nouvelle.afficheurNom).toBe('ENGAGÉ')
      expect(await faceDe(engagee.id)).toMatchObject({
        afficheurNom: 'ENGAGÉ',
        afficheurId: 55,
        version: engagee.version,
        statut,
      })
    },
  )

  it.each<StatutProduction>(['A_TRAITER', 'EN_COURS', 'ERREUR', 'ANNULE'])(
    'RG-COO-207 rejet : une face au statut %s n’est pas une référence d’afficheur : la nouvelle face garde le sien',
    async (statut) => {
      const s = await site()
      const { dossier, i } = await instruction(s)
      const panel = `PAN${String(next())}`
      await face(s, i.code, dossier.contNum, 1, {
        statut,
        refPanel: panel,
        afficheurId: 55,
        afficheurNom: 'ANCIEN',
      })
      const contNum = dossier.contNum + 1
      await integrer([commun(contNum, panel, 'NOUVEAU', 99)])
      expect((await db.faceTrain.findFirstOrThrow({ where: { contNum } })).afficheurNom).toBe(
        'NOUVEAU',
      )
    },
  )

  it('RG-COO-207 après l’insertion, les faces 0 / 1 du même panneau reprennent l’afficheur inséré ; un autre panneau n’est pas touché', async () => {
    const s = await site()
    const { dossier, i } = await instruction(s)
    const panel = `PAN${String(next())}`
    const a = await face(s, i.code, dossier.contNum, 1, {
      statut: 'A_TRAITER',
      refPanel: panel,
      afficheurId: 1,
      afficheurNom: 'ANCIEN A',
    })
    const b = await face(s, i.code, dossier.contNum, 2, {
      statut: 'EN_COURS',
      refPanel: panel,
      afficheurId: 2,
      afficheurNom: 'ANCIEN B',
    })
    const autre = await face(s, i.code, dossier.contNum, 3, {
      statut: 'A_TRAITER',
      refPanel: `AUTRE${String(next())}`,
      afficheurId: 3,
      afficheurNom: 'AUTRE PANNEAU',
    })
    await integrer([commun(dossier.contNum + 1, panel, 'NOUVEAU', 99)])
    expect((await faceDe(a.id)).afficheurNom).toBe('NOUVEAU')
    expect((await faceDe(b.id)).afficheurNom).toBe('NOUVEAU')
    expect((await faceDe(autre.id)).afficheurNom).toBe('AUTRE PANNEAU')
  })
})

// ───────────────── RG-COO-208 / 209 couverture, positions ─────────────────

describe('RG-COO-208 couverture et passage EN_ATTENTE → PRET (complément)', () => {
  const statutDe = (l: Awaited<ReturnType<typeof liste>>, id: string) =>
    l.lignes.find((x) => x.trains.some((t) => t.trainId === id))?.statut

  it('RG-COO-208 trois trains du même thème créés dans le désordre, reçu 2 : les deux départs les plus proches sont couverts (PRET), le plus lointain reste EN_ATTENTE', async () => {
    const s = await site()
    const c = 700_000 + next()
    const d3 = await trainDirect(s, [[c, 'Vert']], {
      depart: new Date(DEPART.getTime() + 2 * JOUR),
    })
    const d1 = await trainDirect(s, [[c, 'Vert']], { depart: DEPART })
    const d2 = await trainDirect(s, [[c, 'Vert']], { depart: new Date(DEPART.getTime() + JOUR) })
    await recu(s, c, 'Vert', 2)
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(statutDe(l, d1.trainId)).toBe('PRET')
    expect(statutDe(l, d2.trainId)).toBe('PRET')
    expect(statutDe(l, d3.trainId)).toBe('EN_ATTENTE')
    expect(l.indicateurs).toMatchObject({ aProduire: 3, prets: 2, enAttente: 1 })
  })

  it('RG-COO-208 le reçu se compte au visuel (pas par destinataire) : deux trains de destinataires différents partagent le même reçu', async () => {
    const s = await site()
    const autreDest = await f.createDestinataire(db, { nom: `Autre ${String(next())}` })
    const c = 700_000 + next()
    const a = await trainDirect(s, [[c, 'Bleu']])
    const b = await trainDirect(s, [[c, 'Bleu']], {
      destinataireId: autreDest.id,
      depart: new Date(DEPART.getTime() + JOUR),
    })
    await recu(s, c, 'Bleu', 1)
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(statutDe(l, a.trainId)).toBe('PRET')
    expect(statutDe(l, b.trainId)).toBe('EN_ATTENTE')
  })

  it('RG-COO-208 rejet : le reçu d’un autre site, d’un autre dossier ou d’un autre thème ne couvre pas le train ; casse et accents ignorés', async () => {
    const s = await site()
    const ailleurs = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [[c, 'Été vert']])
    await recu(ailleurs, c, 'Été vert', 5)
    await recu(s, c + 1, 'Été vert', 5)
    await recu(s, c, 'Autre thème', 5)
    expect(statutDe(await liste(s.users.coord.headers, `&dossier=${String(c)}`), trainId)).toBe(
      'EN_ATTENTE',
    )
    await recu(s, c, 'ETE VERT', 1)
    expect(statutDe(await liste(s.users.coord.headers, `&dossier=${String(c)}`), trainId)).toBe(
      'PRET',
    )
  })

  it('RG-COO-208 un thème de moins de 3 caractères (complété « --- » sur la face) est couvert par le reçu du thème saisi', async () => {
    const s = await site()
    const { faces } = await calculer(s, {
      visuels: [{ afchIdent: 5, theme: 'ab', pourcentage: 100 }],
    })
    const calc = await faceDe(faces[0]?.id ?? 0)
    expect(calc.theme).toBe('ab---')
    await recu(s, calc.contNum ?? 0, 'ab', 1)
    const l = await liste(s.users.coord.headers, `&dossier=${String(calc.contNum)}`)
    expect(statutDe(l, calc.trainId ?? '')).toBe('PRET')
  })

  it('RG-COO-208 / Q-192 (7) les faces déjà en production consomment aussi le reçu : un train « Au roulage » antérieur laisse le train suivant en attente', async () => {
    const s = await site()
    const c = 700_000 + next()
    const prod = await trainDirect(s, [[c, 'Rose']], { statut: 'AU_ROULAGE', depart: DEPART })
    const suite = await trainDirect(s, [[c, 'Rose']], { depart: new Date(DEPART.getTime() + JOUR) })
    await recu(s, c, 'Rose', 1)
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(statutDe(l, prod.trainId)).toBe('EN_PROD')
    expect(statutDe(l, suite.trainId)).toBe('EN_ATTENTE')
  })

  it('RG-COO-208 / RG-COO-223 « En production » ne repasse jamais en arrière : sans aucun reçu, un train « Au roulage » reste EN_PROD', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [[c, 'Rose']], { statut: 'AU_ROULAGE' })
    expect(statutDe(await liste(s.users.coord.headers, `&dossier=${String(c)}`), trainId)).toBe(
      'EN_PROD',
    )
  })

  it('RG-COO-208 la suppression d’un train recalcule la couverture : le reçu libéré couvre le train suivant', async () => {
    const s = await site()
    const c = 700_000 + next()
    const premier = await trainDirect(s, [[c, 'Jaune']], { depart: DEPART })
    const second = await trainDirect(s, [[c, 'Jaune']], {
      depart: new Date(DEPART.getTime() + JOUR),
    })
    await recu(s, c, 'Jaune', 1)
    expect(
      statutDe(await liste(s.users.coord.headers, `&dossier=${String(c)}`), second.trainId),
    ).toBe('EN_ATTENTE')
    const r = await envoyer(urlSuppr(premier.trainId), s.users.coord.headers, {
      version: await versionDe(s, premier.trainId),
      motif: 'Autre',
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(
      statutDe(await liste(s.users.coord.headers, `&dossier=${String(c)}`), second.trainId),
    ).toBe('PRET')
  })

  it('RG-COO-208 vrai déclencheur : une réception enregistrée (REC-P04) fait passer le train de EN_ATTENTE à PRET', async () => {
    const s = await site()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const { trainId } = await trainDirect(s, [[dossier.contNum, 'Thème réel']])
    expect(
      statutDe(await liste(s.users.coord.headers, `&dossier=${String(dossier.contNum)}`), trainId),
    ).toBe('EN_ATTENTE')
    await receptionValidee(ctx, s.users.recep.headers, s.plateforme.id, 3, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Thème réel',
    })
    const l = await liste(s.users.coord.headers, `&dossier=${String(dossier.contNum)}`)
    expect(statutDe(l, trainId)).toBe('PRET')
    expect((await ficheDe(s, trainId)).positions[0]).toMatchObject({
      etat: 'OK',
      recu: 3,
      attendu: 1,
    })
  })

  it('RG-COO-208 un reçu insuffisant sur deux positions : la position servie est celle du train au départ le plus proche, l’autre reste « MANQUANT » dans la fiche', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Un'],
      [c, 'Deux'],
    ])
    await recu(s, c, 'Deux', 1)
    const fiche = await ficheDe(s, trainId)
    expect(fiche.positions.map((p) => [p.theme, p.etat, p.recu])).toEqual([
      ['Un', 'MANQUANT', 0],
      ['Deux', 'OK', 1],
    ])
    expect(fiche.statut).toBe('EN_ATTENTE')
  })
})

describe('RG-COO-209 positions d’un train (complément)', () => {
  async function visuel(s: Site, theme: string) {
    const { i } = await instruction(s)
    return f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 400 + (next() % 500),
      theme,
      pourcentage: 100,
    })
  }

  it('RG-COO-209 limite N : avec 3 positions maximum, un train de 2 positions reçoit un 3e visuel (200) puis refuse le 4e (409 « Train complet »)', async () => {
    const s = await site()
    await parametre('trains.positionsMax', '3')
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Un'],
      [c + 1, 'Deux'],
    ])
    const v1 = await visuel(s, 'Trois')
    const v2 = await visuel(s, 'Quatre')
    const ok = await envoyer(URL_RACC, s.users.coord.headers, {
      visuelId: v1.id,
      trains: await versions(s, [trainId]),
    })
    expect(ok.statusCode, ok.body).toBe(200)
    const complet = await envoyer(URL_RACC, s.users.coord.headers, {
      visuelId: v2.id,
      trains: await versions(s, [trainId]),
    })
    expect(complet.statusCode).toBe(409)
    expect(erreur(complet)).toMatchObject({ message: 'Train complet', regle: 'RG-COO-209' })
    expect((await ficheDe(s, trainId)).positions).toHaveLength(3)
  })

  it('RG-COO-209 les positions sont lettrées A, B, C… dans l’ordre du train', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Un'],
      [c + 1, 'Deux'],
      [c + 2, 'Trois'],
    ])
    expect((await ficheDe(s, trainId)).positions.map((p) => [p.lettre, p.theme])).toEqual([
      ['A', 'Un'],
      ['B', 'Deux'],
      ['C', 'Trois'],
    ])
  })
})

// ───────────────── RG-COO-218 changer statut : table de transitions ─────────────────

describe('RG-COO-218 « Changer statut » : table de transitions côté serveur (complément)', () => {
  const rouleurDe = (s: Site) => f.createRouleur(db, { atelierId: s.atelier.id })

  it.each<[StatutProduction, 'A_IMPRIMER' | 'AU_ROULAGE', number]>([
    ['INSTRUCTION_OK', 'A_IMPRIMER', 200],
    ['A_IMPRIMER', 'AU_ROULAGE', 200],
    ['INSTRUCTION_OK', 'AU_ROULAGE', 409],
    ['A_IMPRIMER', 'A_IMPRIMER', 409],
    ['AU_ROULAGE', 'A_IMPRIMER', 409],
    ['AU_ROULAGE', 'AU_ROULAGE', 409],
    ['EXPORT_PREPA', 'A_IMPRIMER', 409],
    ['EXPORT_PREPA', 'AU_ROULAGE', 409],
    ['PREPARE', 'A_IMPRIMER', 409],
    ['PREPARE', 'AU_ROULAGE', 409],
    ['A_EXPEDIER', 'A_IMPRIMER', 409],
    ['A_EXPEDIER', 'AU_ROULAGE', 409],
    ['TERMINE', 'A_IMPRIMER', 409],
    ['TERMINE', 'AU_ROULAGE', 409],
  ])(
    'RG-COO-218 écran Liste : faces %s → %s ⇒ %i (toute transition absente = 409, rien n’est écrit)',
    async (depuis, vers, attendu) => {
      const s = await site()
      const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']], {
        statut: depuis,
      })
      const rouleur = await rouleurDe(s)
      const r = await envoyer(URL_STATUT, s.users.coord.headers, {
        trains: await versions(s, [trainId]),
        vers,
        ecran: 'LISTE',
        ...(vers === 'AU_ROULAGE' ? { rouleurId: rouleur.id } : {}),
      })
      expect(r.statusCode, r.body).toBe(attendu)
      const x = await faceDe(faces[0]?.id ?? 0)
      if (attendu === 200) {
        expect(x.statut).toBe(vers)
        expect(await historiques(x.id)).toMatchObject([
          { ancien: depuis, nouveau: vers, regle: 'RG-COO-218', parId: s.users.coord.id },
        ])
      } else {
        expect(erreur(r).code).toBe('TRANSITION_INTERDITE')
        expect(x).toMatchObject({ statut: depuis, version: faces[0]?.version })
        expect(await historiques(x.id)).toHaveLength(0)
      }
    },
  )

  it.each<[StatutProduction, number]>([
    ['A_IMPRIMER', 200],
    ['EXPORT_PREPA', 200],
    ['AU_ROULAGE', 200],
    ['INSTRUCTION_OK', 409],
    ['PREPARE', 409],
    ['A_EXPEDIER', 409],
    ['TERMINE', 409],
  ])('RG-COO-218 écran Préparation : faces %s → « A imprimer » ⇒ %i', async (depuis, attendu) => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']], {
      statut: depuis,
    })
    const r = await envoyer(URL_STATUT, s.users.coord.headers, {
      trains: await versions(s, [trainId]),
      vers: 'A_IMPRIMER',
      ecran: 'PREPARATION',
    })
    expect(r.statusCode, r.body).toBe(attendu)
    const x = await faceDe(faces[0]?.id ?? 0)
    expect(x.statut).toBe(attendu === 200 ? 'A_IMPRIMER' : depuis)
    if (attendu === 409)
      expect(erreur(r).message).toBe(
        "Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' !",
      )
  })

  it('RG-COO-218 écran Préparation : « Au roulage » n’est pas une cible autorisée (409, rien n’est écrit)', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']], {
      statut: 'A_IMPRIMER',
    })
    const rouleur = await rouleurDe(s)
    const r = await envoyer(URL_STATUT, s.users.coord.headers, {
      trains: await versions(s, [trainId]),
      vers: 'AU_ROULAGE',
      ecran: 'PREPARATION',
      rouleurId: rouleur.id,
    })
    expect(r.statusCode).toBe(409)
    expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it('RG-COO-218 / RG-COO-308 une sélection mêlant un train autorisé et un train interdit : 409 pour toute la sélection, aucune face du train autorisé n’est modifiée', async () => {
    const s = await site()
    const bon = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'AU_ROULAGE' })
    const mauvais = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'PREPARE' })
    const r = await envoyer(URL_STATUT, s.users.coord.headers, {
      trains: await versions(s, [bon.trainId, mauvais.trainId]),
      vers: 'A_IMPRIMER',
      ecran: 'PREPARATION',
    })
    expect(r.statusCode).toBe(409)
    expect((await faceDe(bon.faces[0]?.id ?? 0)).statut).toBe('AU_ROULAGE')
  })

  it('RG-COO-218 / RG-COO-307 plusieurs trains de la sélection : une trace (journal) par train et un historique par face, au nom de l’acteur', async () => {
    const s = await site()
    const a = await trainDirect(s, [
      [700_000 + next(), 'Rose'],
      [700_000 + next(), 'Gris'],
    ])
    const b = await trainDirect(s, [[700_000 + next(), 'Noir']])
    const r = await envoyer(URL_STATUT, s.users.coord.headers, {
      trains: await versions(s, [a.trainId, b.trainId]),
      vers: 'A_IMPRIMER',
      ecran: 'LISTE',
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ nombre: number }>().nombre).toBe(3)
    for (const id of [a.trainId, b.trainId])
      expect(
        await db.journalAudit.count({
          where: { typeEntite: 'TRAIN', entiteId: id, action: 'CHANGEMENT_STATUT_FACE' },
        }),
      ).toBe(1)
    for (const x of [...a.faces, ...b.faces]) {
      const h = await historiques(x.id)
      expect(h).toHaveLength(1)
      expect(h[0]?.parId).toBe(s.users.coord.id)
      expect(h[0]?.le).toBeInstanceOf(Date)
    }
  })

  it('RG-COO-218 train inconnu dans la sélection ⇒ 404, aucune face modifiée', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const r = await envoyer(URL_STATUT, s.users.coord.headers, {
      trains: [...(await versions(s, [trainId])), { trainId: 'INCONNU', version: '1.1.1' }],
      vers: 'A_IMPRIMER',
      ecran: 'LISTE',
    })
    expect(r.statusCode).toBe(404)
    expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
  })
})

// ───────────────── RG-COO-219 annuler un thème ─────────────────

describe('RG-COO-219 annulation d’un thème de train (complément)', () => {
  const corps = (s: Site, contNum: number, theme: string, depart = MOIS_SEM) => ({
    atelierId: s.atelier.id,
    depart,
    contNum,
    theme,
  })

  it('RG-COO-219 un thème réparti sur deux trains « A imprimer » : toutes ses faces ANNULÉES (train vidé), une trace par train, les autres thèmes, dossiers et semaines intacts', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(
      s,
      [
        [c, 'Rose'],
        [c, 'Gris'],
      ],
      { statut: 'A_IMPRIMER' },
    )
    const b = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    const autreDossier = await trainDirect(s, [[c + 1, 'Rose']], { statut: 'A_IMPRIMER' })
    const autreSemaine = await trainDirect(s, [[c, 'Rose']], {
      statut: 'A_IMPRIMER',
      semaine: plus(SEM, 1),
    })
    const r = await envoyer(URL_ANNULER, s.users.coord.headers, corps(s, c, 'ROSE'))
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ nombre: number }>().nombre).toBe(2)
    for (const id of [a.faces[0]?.id ?? 0, b.faces[0]?.id ?? 0]) {
      expect(await faceDe(id)).toMatchObject({ statut: 'ANNULE', trainId: null })
      expect((await historiques(id)).at(-1)).toMatchObject({
        ancien: 'A_IMPRIMER',
        nouveau: 'ANNULE',
        regle: 'RG-COO-219',
        parId: s.users.coord.id,
      })
    }
    expect((await faceDe(a.faces[1]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(autreDossier.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(autreSemaine.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    for (const id of [a.trainId, b.trainId])
      expect(
        await db.journalAudit.count({
          where: { typeEntite: 'TRAIN', entiteId: id, action: 'ANNULATION_THEME_TRAIN' },
        }),
      ).toBe(1)
  })

  it('RG-COO-219 rejet : une face du thème « Au roulage » ⇒ 409 pour tout le thème, aucune face annulée', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    await trainDirect(s, [[c, 'Rose']], { statut: 'AU_ROULAGE' })
    const r = await envoyer(URL_ANNULER, s.users.coord.headers, corps(s, c, 'Rose'))
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      message: "Toutes les faces du theme ne sont pas dans le statut 'A Imprimer'",
      regle: 'RG-COO-219',
    })
    expect((await faceDe(a.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it.each<StatutProduction>(['INSTRUCTION_OK', 'EXPORT_PREPA', 'PREPARE', 'A_EXPEDIER', 'TERMINE'])(
    'RG-COO-219 rejet : thème dont les faces sont au statut %s (≠ 5) ⇒ 409',
    async (statut) => {
      const s = await site()
      const c = 700_000 + next()
      const { faces } = await trainDirect(s, [[c, 'Rose']], { statut })
      const r = await envoyer(URL_ANNULER, s.users.coord.headers, corps(s, c, 'Rose'))
      expect(r.statusCode).toBe(409)
      expect(erreur(r).regle).toBe('RG-COO-219')
      expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe(statut)
    },
  )

  it('RG-COO-219 rejet : aucun thème correspondant ⇒ 409 ; atelier inconnu ⇒ 404 ; atelier d’un autre site ⇒ 403', async () => {
    const s = await site()
    const autre = await site()
    const c = 700_000 + next()
    await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    expect(
      (await envoyer(URL_ANNULER, s.users.coord.headers, corps(s, c, 'Inexistant'))).statusCode,
    ).toBe(409)
    expect(
      (
        await envoyer(URL_ANNULER, s.users.coord.headers, {
          ...corps(s, c, 'Rose'),
          atelierId: 999_999_999,
        })
      ).statusCode,
    ).toBe(404)
    const hors = await envoyer(URL_ANNULER, autre.users.coord.headers, corps(s, c, 'Rose'))
    expect(hors.statusCode).toBe(403)
    expect(erreur(hors).regle).toBe('RG-COO-167')
  })

  it('RG-COO-219 / RG-COO-307 atomicité : échec de la trace ⇒ aucune face annulée, aucun historique', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    const b = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'ANNULATION_THEME_TRAIN'`,
      () => envoyer(URL_ANNULER, s.users.coord.headers, corps(s, c, 'Rose')),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    for (const x of [...a.faces, ...b.faces]) {
      expect((await faceDe(x.id)).statut).toBe('A_IMPRIMER')
      expect(await historiques(x.id)).toHaveLength(0)
    }
  })
})

// ───────────────── RG-COO-220 débloquer semaine ─────────────────

describe('RG-COO-220 « Débloquer semaine » (complément)', () => {
  const corps = (s: Site, atelierId = s.atelier.id, depart = MOIS_SEM) => ({ atelierId, depart })

  it('RG-COO-220 portée atelier × semaine : seules les faces « A imprimer » de l’atelier et de la semaine repassent à 2 ; autre atelier ou autre semaine intacts', async () => {
    const s = await site()
    const c = 700_000 + next()
    const cible = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    const autreAtelier = await trainDirect(s, [[c, 'Rose']], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
    })
    const autreSemaine = await trainDirect(s, [[c, 'Rose']], {
      statut: 'A_IMPRIMER',
      semaine: plus(SEM, 1),
    })
    const r = await envoyer(URL_DEBLOQUER, s.users.coord.headers, corps(s))
    expect(r.statusCode, r.body).toBe(200)
    expect((await faceDe(cible.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect((await faceDe(autreAtelier.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await faceDe(autreSemaine.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect(await historiques(cible.faces[0]?.id ?? 0)).toMatchObject([
      {
        ancien: 'A_IMPRIMER',
        nouveau: 'INSTRUCTION_OK',
        regle: 'RG-COO-220',
        parId: s.users.coord.id,
      },
    ])
  })

  it('RG-COO-220 les instructions « Prêt à produire » des faces repassent « Instruction ok » ; une instruction « En cours » n’est pas touchée', async () => {
    const s = await site()
    const c = 700_000 + next()
    const t = await trainDirect(
      s,
      [
        [c, 'Rose'],
        [c + 1, 'Gris'],
      ],
      { statut: 'A_IMPRIMER' },
    )
    const [f1, f2] = t.faces
    await db.instruction.update({
      where: { code: f1?.instructionCode ?? '' },
      data: { statut: 'PRET_A_PRODUIRE' },
    })
    const r = await envoyer(URL_DEBLOQUER, s.users.coord.headers, corps(s))
    expect(r.statusCode, r.body).toBe(200)
    expect(
      (await db.instruction.findUniqueOrThrow({ where: { code: f1?.instructionCode ?? '' } }))
        .statut,
    ).toBe('INSTRUCTION_OK')
    expect(
      (await db.instruction.findUniqueOrThrow({ where: { code: f2?.instructionCode ?? '' } }))
        .statut,
    ).toBe('EN_COURS')
  })

  it('RG-COO-220 rejet : une face « A imprimer » et une face « Instruction ok » dans la semaine ⇒ 409 « pas toutes à A imprimer », aucune face modifiée', async () => {
    const s = await site()
    const a = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'A_IMPRIMER' })
    await trainDirect(s, [[700_000 + next(), 'Gris']], { statut: 'INSTRUCTION_OK' })
    const r = await envoyer(URL_DEBLOQUER, s.users.coord.headers, corps(s))
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      message: "Toutes les données ne sont pas au statut 'A imprimer' !",
      regle: 'RG-COO-220',
    })
    expect((await faceDe(a.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it('RG-COO-220 rejet : atelier d’un autre site ⇒ 403 ; atelier inconnu ⇒ 404', async () => {
    const s = await site()
    const autre = await site()
    await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'A_IMPRIMER' })
    expect((await envoyer(URL_DEBLOQUER, autre.users.coord.headers, corps(s))).statusCode).toBe(403)
    expect(
      (await envoyer(URL_DEBLOQUER, s.users.coord.headers, corps(s, 999_999_999))).statusCode,
    ).toBe(404)
  })

  it('RG-COO-220 / RG-COO-307 atomicité : échec de la trace ⇒ faces et instruction inchangées', async () => {
    const s = await site()
    const t = await trainDirect(s, [[700_000 + next(), 'Rose']], { statut: 'A_IMPRIMER' })
    const code = t.faces[0]?.instructionCode ?? ''
    await db.instruction.update({ where: { code }, data: { statut: 'PRET_A_PRODUIRE' } })
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'DEBLOCAGE_SEMAINE_TRAINS'`,
      () => envoyer(URL_DEBLOQUER, s.users.coord.headers, corps(s)),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await db.instruction.findUniqueOrThrow({ where: { code } })).statut).toBe(
      'PRET_A_PRODUIRE',
    )
    expect(
      await db.statutHistorique.count({ where: { typeEntite: 'INSTRUCTION', entiteId: code } }),
    ).toBe(0)
  })
})

// ───────────────── RG-COO-221 / 222 / 223 fractionner, raccrocher, point de non-retour ─────────────────

describe('RG-COO-221 fractionner (complément)', () => {
  it('RG-COO-221 en masse : un train fractionnable, un train déjà PRET et un train sans reçu ⇒ 1 traité, 2 écartés avec leur raison ; seules les positions manquantes sont fractionnées', async () => {
    const s = await site()
    const c = 700_000 + next()
    const fractionnable = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    const pret = await trainDirect(s, [[c + 2, 'Noir']])
    const sansRecu = await trainDirect(s, [[c + 3, 'Blanc']])
    await recu(s, c, 'Rose', 1)
    await recu(s, c + 2, 'Noir', 1)
    const r = await envoyer(URL_FRAC, s.users.coord.headers, {
      trains: await versions(s, [fractionnable.trainId, pret.trainId, sansRecu.trainId]),
    })
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatActionTrainsSchema.parse(r.json())
    expect(res.traites).toEqual([fractionnable.trainId])
    expect(res.ecartes.map((e) => e.trainId).sort()).toEqual(
      [pret.trainId, sansRecu.trainId].sort(),
    )
    expect((await faceDe(fractionnable.faces[0]?.id ?? 0)).fractionnee).toBe(false)
    expect((await faceDe(fractionnable.faces[1]?.id ?? 0)).fractionnee).toBe(true)
    expect((await faceDe(pret.faces[0]?.id ?? 0)).fractionnee).toBe(false)
    expect(res.message).toContain('1 train(s) fractionné(s)')
  })

  it('RG-COO-221 le train fractionné passe PRET et est marqué « fractionné » dans la liste ; sa position manquante apparaît « FRACTIONNE »', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 1)
    expect(
      (await envoyer(URL_FRAC, s.users.cheq.headers, { trains: await versions(s, [trainId]) }))
        .statusCode,
    ).toBe(200)
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(l.lignes[0]).toMatchObject({ statut: 'PRET', fractionne: true })
    expect(l.lignes[0]?.positions.map((p) => p.etat)).toEqual(['OK', 'FRACTIONNE'])
  })

  it('RG-COO-221 rejet : un train déjà fractionné (donc PRET) ne se fractionne pas une seconde fois (409), un seul journal', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 1)
    expect(
      (await envoyer(URL_FRAC, s.users.coord.headers, { trains: await versions(s, [trainId]) }))
        .statusCode,
    ).toBe(200)
    const r = await envoyer(URL_FRAC, s.users.coord.headers, {
      trains: await versions(s, [trainId]),
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-221')
    expect(
      await db.journalAudit.count({ where: { entiteId: trainId, action: 'FRACTIONNEMENT_TRAIN' } }),
    ).toBe(1)
  })

  it('RG-COO-221 / RG-COO-308 la version du train change après le fractionnement (l’ancienne version est refusée)', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 1)
    const avant = await versionDe(s, trainId)
    expect(
      (await envoyer(URL_FRAC, s.users.coord.headers, { trains: [{ trainId, version: avant }] }))
        .statusCode,
    ).toBe(200)
    const apres = await versionDe(s, trainId)
    expect(apres).not.toBe(avant)
    expect(apres).toMatch(/^\d+\.\d+\.\d+$/)
    const r = await envoyer(URL_FRAC, s.users.coord.headers, {
      trains: [{ trainId, version: avant }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-308')
  })
})

describe('RG-COO-222 raccrocher un visuel (complément)', () => {
  async function visuelDe(
    s: Site,
    theme: string | null,
    o: OptionsInstruction = {},
    afchIdent = 500 + (next() % 400),
  ) {
    const { dossier, i } = await instruction(s, o)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent,
      theme,
      pourcentage: 100,
    })
    return { dossier, i, v }
  }

  it('RG-COO-222 en masse : écarte « Autre atelier », « Autre semaine », « Train complet » et le train qui a déjà le visuel ; raccroche le train libre', async () => {
    const s = await site()
    await parametre('trains.positionsMax', '2')
    const { dossier, v } = await visuelDe(s, 'Nouveau')
    const libre = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const autreAtelier = await trainDirect(s, [[700_000 + next(), 'Rose']], {
      atelierId: s.atelier2.id,
    })
    const autreSemaine = await trainDirect(s, [[700_000 + next(), 'Rose']], {
      extra: { contSembas: (SEM.semaine % 50) + 1 },
    })
    const complet = await trainDirect(s, [
      [700_000 + next(), 'Un'],
      [700_000 + next(), 'Deux'],
    ])
    const deja = await trainDirect(s, [[dossier.contNum, 'Nouveau']])
    const ids = [libre, autreAtelier, autreSemaine, complet, deja].map((t) => t.trainId)
    const r = await envoyer(URL_RACC, s.users.coord.headers, {
      visuelId: v.id,
      trains: await versions(s, ids),
    })
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatActionTrainsSchema.parse(r.json())
    expect(res.traites).toEqual([libre.trainId])
    expect(res.ecartes.map((e) => e.raison).sort()).toEqual([
      'Autre atelier.',
      'Autre semaine.',
      'Le train a déjà ce visuel.',
      'Train complet',
    ])
  })

  it('RG-COO-222 / RG-COO-208 couverture recalculée : un train PRET qui reçoit un visuel sans reçu repasse EN_ATTENTE (nouvelle position MANQUANT), puis PRET quand le reçu arrive', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [[c, 'Rose']])
    await recu(s, c, 'Rose', 1)
    expect((await ficheDe(s, trainId)).statut).toBe('PRET')
    const { dossier, v } = await visuelDe(s, 'Tardif')
    expect(
      (
        await envoyer(URL_RACC, s.users.coord.headers, {
          visuelId: v.id,
          trains: await versions(s, [trainId]),
        })
      ).statusCode,
    ).toBe(200)
    let fiche = await ficheDe(s, trainId)
    expect(fiche.statut).toBe('EN_ATTENTE')
    expect(fiche.positions.map((p) => p.etat)).toEqual(['OK', 'MANQUANT'])
    await recu(s, dossier.contNum, 'Tardif', 1)
    fiche = await ficheDe(s, trainId)
    expect(fiche.statut).toBe('PRET')
  })

  it('RG-COO-222 la position ajoutée est historisée (face) et journalisée (train), au nom de l’acteur ; version du train changée', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const { dossier, v } = await visuelDe(s, 'Nouveau')
    const avant = await versionDe(s, trainId)
    expect(
      (
        await envoyer(URL_RACC, s.users.cheq.headers, {
          visuelId: v.id,
          trains: [{ trainId, version: avant }],
        })
      ).statusCode,
    ).toBe(200)
    const ajoutee = await db.faceTrain.findFirstOrThrow({
      where: { trainId, contNum: dossier.contNum },
    })
    expect(ajoutee).toMatchObject({
      ftType: 'raccroche',
      theme: 'Nouveau',
      createdById: s.users.cheq.id,
    })
    expect(await historiques(ajoutee.id)).toMatchObject([
      { ancien: null, regle: 'RG-COO-222', parId: s.users.cheq.id },
    ])
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: trainId, action: 'RACCROCHAGE_VISUEL' },
    })
    expect(j.parId).toBe(s.users.cheq.id)
    expect(await versionDe(s, trainId)).not.toBe(avant)
  })

  it('RG-COO-222 rejets : visuel d’une instruction annulée ou d’un dossier annulé ⇒ 422 ; visuel inconnu ⇒ 404 ; train inconnu ⇒ 404', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const annulee = await visuelDe(s, 'Annulée', { statut: 'ANNULE' })
    const dossierAnnule = await visuelDe(s, 'Dossier annulé', { dossierStatut: 'ANNULE' })
    const trains = await versions(s, [trainId])
    for (const v of [annulee.v, dossierAnnule.v]) {
      const r = await envoyer(URL_RACC, s.users.coord.headers, { visuelId: v.id, trains })
      expect(r.statusCode).toBe(422)
      expect(erreur(r).regle).toBe('RG-COO-222')
    }
    expect(
      (await envoyer(URL_RACC, s.users.coord.headers, { visuelId: 999_999_999, trains }))
        .statusCode,
    ).toBe(404)
    const ok = await visuelDe(s, 'Ok')
    expect(
      (
        await envoyer(URL_RACC, s.users.coord.headers, {
          visuelId: ok.v.id,
          trains: [{ trainId: 'INCONNU', version: '1.1.1' }],
        })
      ).statusCode,
    ).toBe(404)
    expect(await db.faceTrain.count({ where: { trainId } })).toBe(1)
  })

  it('RG-COO-222 visuels proposés : même atelier, même semaine, instruction et dossier non annulés, thème renseigné, pas déjà dans le train', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [[c, 'Déjà là']])
    const propose = await visuelDe(s, 'Proposé')
    const autreAtelier = await visuelDe(s, 'Autre atelier', { atelierId: s.atelier2.id })
    const autreSemaine = await visuelDe(s, 'Autre semaine', { semaine: plus(SEM, 2) })
    const annulee = await visuelDe(s, 'Instruction annulée', { statut: 'ANNULE' })
    const dossierAnnule = await visuelDe(s, 'Dossier annulé', { dossierStatut: 'ANNULE' })
    const sansTheme = await visuelDe(s, null)
    const { i } = await instruction(s)
    await db.instruction.update({ where: { code: i.code }, data: { contNum: c } })
    const dejaDansTrain = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 123,
      theme: 'DÉJÀ LÀ',
      pourcentage: 100,
    })
    const r = await get(
      ctx,
      `/api/coordination/trains/visuels-raccrochables?train=${trainId}`,
      s.users.coord.headers,
    )
    expect(r.statusCode, r.body).toBe(200)
    const ids = VisuelsRaccrochablesSchema.parse(r.json()).visuels.map((x) => x.visuelId)
    expect(ids).toContain(propose.v.id)
    for (const exclu of [autreAtelier, autreSemaine, annulee, dossierAnnule, sansTheme])
      expect(ids).not.toContain(exclu.v.id)
    expect(ids).not.toContain(dejaDansTrain.id)
  })

  it('RG-COO-222 / RG-COO-308 atomicité en masse : échec de la trace du 2e train ⇒ aucune position ajoutée au 1er non plus', async () => {
    const s = await site()
    const { v } = await visuelDe(s, 'Nouveau')
    const a = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const b = await trainDirect(s, [[700_000 + next(), 'Gris']])
    const trains = await versions(s, [a.trainId, b.trainId])
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'RACCROCHAGE_VISUEL' AND NEW.entite_id = '${b.trainId}'`,
      () => envoyer(URL_RACC, s.users.coord.headers, { visuelId: v.id, trains }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.faceTrain.count({ where: { trainId: { in: [a.trainId, b.trainId] } } })).toBe(2)
  })

  it('RG-COO-222 / RG-COO-307 atomicité : échec de l’historique de la nouvelle face ⇒ la face n’est pas créée', async () => {
    const s = await site()
    const { v } = await visuelDe(s, 'Nouveau')
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const r = await avecEchec(
      `BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'FACE_TRAIN' AND NEW.regle = 'RG-COO-222'`,
      async () =>
        envoyer(URL_RACC, s.users.coord.headers, {
          visuelId: v.id,
          trains: await versions(s, [trainId]),
        }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.faceTrain.count({ where: { trainId } })).toBe(1)
  })
})

describe('RG-COO-223 point de non-retour (complément)', () => {
  const EN_PRODUCTION: StatutProduction[] = [
    'EXPORT_PREPA',
    'AU_ROULAGE',
    'PREPARE',
    'A_EXPEDIER',
    'TERMINE',
  ]
  const MESSAGE = 'Train déjà en production : impossible de le modifier (point de non-retour).'

  it.each(EN_PRODUCTION)(
    'RG-COO-223 train dont une face est au statut %s : suppression, fractionnement et raccrochage refusés (409, même message), rien n’est écrit',
    async (statut) => {
      const s = await site()
      const c = 700_000 + next()
      const { trainId, faces } = await trainDirect(s, [[c, 'Rose']], { statut })
      const { i } = await instruction(s)
      const v = await f.createInstructionVisuel(db, {
        instructionCode: i.code,
        afchIdent: 321,
        theme: 'Nouveau',
        pourcentage: 100,
      })
      const trains = await versions(s, [trainId])
      const suppr = await envoyer(urlSuppr(trainId), s.users.coord.headers, {
        version: trains[0]?.version ?? '',
        motif: 'Autre',
      })
      const frac = await envoyer(URL_FRAC, s.users.coord.headers, { trains })
      const racc = await envoyer(URL_RACC, s.users.coord.headers, { visuelId: v.id, trains })
      for (const r of [suppr, frac, racc]) {
        expect(r.statusCode, r.body).toBe(409)
        expect(erreur(r)).toMatchObject({ regle: 'RG-COO-223', message: MESSAGE })
      }
      expect(await faceDe(faces[0]?.id ?? 0)).toMatchObject({ statut, version: faces[0]?.version })
      expect(await db.faceTrain.count({ where: { trainId } })).toBe(1)
    },
  )

  it('RG-COO-223 un train dont une seule face est en production (les autres « Instruction ok ») est un point de non-retour pour tout le train', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [
      [700_000 + next(), 'Rose'],
      [700_000 + next(), 'Gris'],
    ])
    await db.faceTrain.update({ where: { id: faces[1]?.id ?? 0 }, data: { statut: 'AU_ROULAGE' } })
    const r = await envoyer(urlSuppr(trainId), s.users.coord.headers, {
      version: await versionDe(s, trainId),
      motif: 'Pré-test annulé',
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-223')
    expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
  })
})

// ───────────────── RG-COO-224 / 225 / 226 créer, supprimer, dupliquer ─────────────────

describe('RG-COO-224 créer un train de pré-test ou d’entretien (complément)', () => {
  async function pret(
    s: Site,
    o: { semaine?: SemaineIso; theme?: string | null; atelierId?: number } = {},
  ) {
    const { i } = await instruction(s, { semaine: o.semaine ?? SEM, atelierId: o.atelierId })
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 600 + (next() % 300),
      theme: o.theme === undefined ? 'Pré-test' : o.theme,
      pourcentage: 100,
    })
    return { i, v }
  }
  /** Le destinataire du site : il a déjà une face dans un atelier du site (liste de la modale). */
  const destinataireDuSite = async (
    s: Site,
    extra: Partial<Prisma.FaceTrainUncheckedCreateInput> = {},
  ) => {
    await trainDirect(s, [[700_000 + next(), 'Existant']], { extra })
  }
  const creer = (
    s: Site,
    v: { id: number },
    extra: Record<string, unknown> = {},
    h = s.users.coord.headers,
  ) =>
    envoyer(URL_CREER, h, {
      atelierId: s.atelier.id,
      depart: MOIS_SEM,
      type: 'PRE_TEST',
      nombre: 1,
      visuelId: v.id,
      destinataireId: s.destinataire.id,
      ...extra,
    })

  it.each([
    [0, 400],
    [1, 200],
    [9, 200],
    [10, 400],
  ])('RG-COO-224 nombre de trains %i ⇒ %i (1 à 9)', async (nombre, attendu) => {
    const s = await site()
    await destinataireDuSite(s)
    const { v } = await pret(s)
    const r = await creer(s, v, { nombre })
    expect(r.statusCode, r.body).toBe(attendu)
    if (attendu === 200) {
      const { trains } = CreerTrainResultatSchema.parse(r.json())
      expect(trains).toHaveLength(nombre)
      expect(new Set(trains).size).toBe(nombre)
      expect(trains.every((t) => /^TR-P\d{4}$/.test(t))).toBe(true)
    }
  })

  it('RG-COO-224 limite du départ : la semaine en cours (S) est acceptée, la semaine précédente refusée (422) ; un visuel antérieur au départ est refusé (422)', async () => {
    const s = await site()
    await destinataireDuSite(s)
    const { v } = await pret(s)
    const ok = await creer(s, v, { depart: formatSemaineIso(S) })
    expect(ok.statusCode, ok.body).toBe(200)
    const trop = await creer(s, v, { depart: formatSemaineIso(plus(S, -1)) })
    expect(trop.statusCode).toBe(422)
    expect(erreur(trop).regle).toBe('RG-COO-224')
    const apres = await creer(s, v, { depart: formatSemaineIso(plus(SEM, 1)) })
    expect(apres.statusCode).toBe(422)
    expect(erreur(apres).code).toBe('COO_VISUEL_INVALIDE')
  })

  it('RG-COO-224 le visuel doit être de l’atelier, non annulé, avec un thème : visuel d’un autre atelier, d’une instruction annulée, d’un dossier annulé ou sans thème ⇒ 422', async () => {
    const s = await site()
    await destinataireDuSite(s)
    const { i: autreAtelier } = await instruction(s, { atelierId: s.atelier2.id })
    const vAutre = await f.createInstructionVisuel(db, {
      instructionCode: autreAtelier.code,
      theme: 'X',
      pourcentage: 100,
    })
    const { i: annulee } = await instruction(s, { statut: 'ANNULE' })
    const vAnnulee = await f.createInstructionVisuel(db, {
      instructionCode: annulee.code,
      theme: 'X',
      pourcentage: 100,
    })
    const { i: dossierAnnule } = await instruction(s, { dossierStatut: 'ANNULE' })
    const vDossier = await f.createInstructionVisuel(db, {
      instructionCode: dossierAnnule.code,
      theme: 'X',
      pourcentage: 100,
    })
    const { v: vSansTheme } = await pret(s, { theme: null })
    for (const v of [vAutre, vAnnulee, vDossier, vSansTheme]) {
      const r = await creer(s, v)
      expect(r.statusCode).toBe(422)
      expect(erreur(r).regle).toBe('RG-COO-224')
    }
    expect(
      await db.faceTrain.count({
        where: { trainId: { startsWith: 'TR-P' }, atelierId: s.atelier.id },
      }),
    ).toBe(0)
  })

  it('RG-COO-224 afficheur = premier afficheur connu du destinataire (hors « ENTRETIEN ») ; départ = départ connu du destinataire cette semaine, sinon le lundi', async () => {
    const s = await site()
    const dest = await f.createDestinataire(db, { nom: `Dest ${String(next())}` })
    const depart2 = new Date(DEPART.getTime() + JOUR)
    await trainDirect(s, [[700_000 + next(), 'A']], {
      destinataireId: dest.id,
      afficheurNom: 'ENTRETIEN',
      depart: depart2,
    })
    await trainDirect(s, [[700_000 + next(), 'B']], {
      destinataireId: dest.id,
      afficheurNom: 'PREMIER',
      depart: DEPART,
    })
    await trainDirect(s, [[700_000 + next(), 'C']], {
      destinataireId: dest.id,
      afficheurNom: 'SECOND',
      depart: depart2,
    })
    const { v } = await pret(s)
    const r = await creer(s, v, { destinataireId: dest.id })
    expect(r.statusCode, r.body).toBe(200)
    const [trainId] = CreerTrainResultatSchema.parse(r.json()).trains
    const cree = await db.faceTrain.findFirstOrThrow({ where: { trainId } })
    expect(cree).toMatchObject({ afficheurNom: 'PREMIER', dateDepart: DEPART })
    // Semaine sans départ connu pour ce destinataire : le lundi de la semaine.
    const { v: v2 } = await pret(s, { semaine: plus(SEM, 2) })
    const r2 = await creer(s, v2, {
      destinataireId: dest.id,
      depart: formatSemaineIso(plus(SEM, 2)),
    })
    expect(r2.statusCode, r2.body).toBe(200)
    const [t2] = CreerTrainResultatSchema.parse(r2.json()).trains
    expect((await db.faceTrain.findFirstOrThrow({ where: { trainId: t2 } })).dateDepart).toEqual(
      lundiSemaineIso(plus(SEM, 2)),
    )
  })

  it('RG-COO-224 le type est conservé (origine PRE_TEST / ENTRETIEN_AJOUTE) ; le train créé est EN_ATTENTE sans reçu, PRET avec reçu ; historique et journal nominatifs', async () => {
    const s = await site()
    await destinataireDuSite(s)
    const { i, v } = await pret(s)
    const pre = await creer(s, v, { type: 'PRE_TEST' })
    const ent = await creer(s, v, { type: 'ENTRETIEN_AJOUTE' })
    const [t1] = CreerTrainResultatSchema.parse(pre.json()).trains
    const [t2] = CreerTrainResultatSchema.parse(ent.json()).trains
    const l = await liste(s.users.coord.headers, `&dossier=${String(i.contNum)}`)
    const par = (id: string | undefined) =>
      l.lignes.find((x) => x.trains.some((t) => t.trainId === id))
    expect(par(t1)).toMatchObject({ origine: 'PRE_TEST', statut: 'EN_ATTENTE' })
    expect(par(t2)).toMatchObject({ origine: 'ENTRETIEN_AJOUTE', statut: 'EN_ATTENTE' })
    await recu(s, i.contNum ?? 0, 'Pré-test', 2)
    const l2 = await liste(s.users.coord.headers, `&dossier=${String(i.contNum)}`)
    expect(l2.lignes.every((x) => x.statut === 'PRET')).toBe(true)
    const cree = await db.faceTrain.findFirstOrThrow({ where: { trainId: t1 } })
    expect(await historiques(cree.id)).toMatchObject([
      { ancien: null, nouveau: 'A_IMPRIMER', regle: 'RG-COO-224', parId: s.users.coord.id },
    ])
    expect(
      (
        await db.journalAudit.findFirstOrThrow({
          where: { entiteId: t1, action: 'CREATION_TRAIN' },
        })
      ).parId,
    ).toBe(s.users.coord.id)
  })

  // ANO-041 (corrigée) : RG-COO-224 « Destinataire (du site) ». La modale ne propose que les destinataires actifs du site
  // (optionsCreationTrain), mais le service creerTrain accepte n'importe quel destinataire existant : un train est
  // créé pour un destinataire sans aucune activité sur le site (trains.ts:931 `findUnique` sans contrôle du site).
  it('RG-COO-224 un destinataire qui n’est pas du site (aucune face ni répartition sur la plateforme) est refusé par le service (ANO-041)', async () => {
    const s = await site()
    await destinataireDuSite(s)
    const etranger = await f.createDestinataire(db, { nom: `Étranger ${String(next())}` })
    const { v } = await pret(s)
    const r = await creer(s, v, { destinataireId: etranger.id })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-224')
    expect(erreur(r).code).toBe('COO_DESTINATAIRE_HORS_SITE')
  })

  it('RG-COO-224 options de la modale : visuels de l’atelier à partir de la semaine en production, hors annulés ; destinataires actifs du site seulement', async () => {
    const s = await site()
    await destinataireDuSite(s)
    const inactif = await f.createDestinataire(db, {
      nom: `Inactif ${String(next())}`,
      actif: false,
    })
    await trainDirect(s, [[700_000 + next(), 'Inactif']], { destinataireId: inactif.id })
    const { v: futur } = await pret(s, { theme: 'Futur' })
    const { v: passe } = await pret(s, { semaine: plus(S, -2), theme: 'Passé' })
    const { i: annulee } = await instruction(s, { statut: 'ANNULE' })
    const vAnnulee = await f.createInstructionVisuel(db, {
      instructionCode: annulee.code,
      theme: 'Annulée',
      pourcentage: 100,
    })
    const r = await get(
      ctx,
      `/api/coordination/trains/options-creation?atelier=${String(s.atelier.id)}`,
      s.users.coord.headers,
    )
    expect(r.statusCode, r.body).toBe(200)
    const o = OptionsCreationTrainSchema.parse(r.json())
    expect(o.visuels.map((x) => x.visuelId)).toContain(futur.id)
    expect(o.visuels.map((x) => x.visuelId)).not.toContain(passe.id)
    expect(o.visuels.map((x) => x.visuelId)).not.toContain(vAnnulee.id)
    expect(o.destinataires.map((x) => x.id)).toContain(s.destinataire.id)
    expect(o.destinataires.map((x) => x.id)).not.toContain(inactif.id)
    expect(o.ateliers.map((a) => a.id).sort()).toEqual([s.atelier.id, s.atelier2.id].sort())
  })

  it('RG-COO-224 / RG-COO-307 atomicité : échec de la trace du 2e train ⇒ aucun train créé (ni face, ni historique)', async () => {
    const s = await site()
    await destinataireDuSite(s)
    const { i, v } = await pret(s)
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'CREATION_TRAIN' AND (SELECT COUNT(*) FROM tf_face_train WHERE instr_code = '${i.code}' AND train_id LIKE 'TR-P%') >= 2`,
      () => creer(s, v, { nombre: 3 }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(
      await db.faceTrain.count({
        where: { instructionCode: i.code, trainId: { startsWith: 'TR-P' } },
      }),
    ).toBe(0)
  })

  it('RG-COO-224 numérotation : deux créations simultanées ⇒ aucun numéro TR-P en double (4 trains distincts)', async () => {
    const s = await site()
    await destinataireDuSite(s)
    const { i, v } = await pret(s)
    const rs = await Promise.all([creer(s, v, { nombre: 2 }), creer(s, v, { nombre: 2 })])
    expect(rs.map((r) => r.statusCode)).toEqual([200, 200])
    const ids = rs.flatMap((r) => CreerTrainResultatSchema.parse(r.json()).trains)
    expect(new Set(ids).size).toBe(4)
    expect(
      await db.faceTrain.count({ where: { instructionCode: i.code, trainId: { in: ids } } }),
    ).toBe(4)
  })
})

describe('RG-COO-225 supprimer un train (complément)', () => {
  it.each([
    'Affichage qui ne se fait pas',
    'Ville de Paris : affiche à ne pas poser',
    'Pré-test annulé',
    'Autre',
  ])(
    'RG-COO-225 motif « %s » : toutes les faces ANNULÉES, motif et précision dans l’historique et le journal, train retiré de la liste',
    async (motif) => {
      const s = await site()
      const c = 700_000 + next()
      const { trainId, faces } = await trainDirect(s, [
        [c, 'Rose'],
        [c + 1, 'Gris'],
      ])
      const r = await envoyer(urlSuppr(trainId), s.users.coord.headers, {
        version: await versionDe(s, trainId),
        motif,
        precision: 'précision de test',
      })
      expect(r.statusCode, r.body).toBe(200)
      expect(r.json<{ nombre: number }>().nombre).toBe(2)
      const attendu = `${motif} : précision de test`
      for (const x of faces) {
        expect(await faceDe(x.id)).toMatchObject({ statut: 'ANNULE', motifSuppression: attendu })
        expect(await historiques(x.id)).toMatchObject([
          {
            ancien: 'INSTRUCTION_OK',
            nouveau: 'ANNULE',
            motif: attendu,
            regle: 'RG-COO-225',
            parId: s.users.coord.id,
          },
        ])
      }
      expect(
        (
          await db.journalAudit.findFirstOrThrow({
            where: { entiteId: trainId, action: 'SUPPRESSION_TRAIN' },
          })
        ).nouvelleValeur,
      ).toBe(attendu)
      expect((await liste(s.users.coord.headers, `&dossier=${String(c)}`)).lignes).toHaveLength(0)
    },
  )

  it('RG-COO-225 rejets : motif hors liste ⇒ 400 ; précision de plus de 200 caractères ⇒ 400 ; identifiant de plus de 30 caractères ⇒ 400 ; train inconnu ⇒ 404 ; déjà supprimé ⇒ refus', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const version = await versionDe(s, trainId)
    const h = s.users.coord.headers
    expect((await envoyer(urlSuppr(trainId), h, { version, motif: 'Parce que' })).statusCode).toBe(
      400,
    )
    expect(
      (await envoyer(urlSuppr(trainId), h, { version, motif: 'Autre', precision: 'x'.repeat(201) }))
        .statusCode,
    ).toBe(400)
    expect(
      (await envoyer(urlSuppr('x'.repeat(31)), h, { version, motif: 'Autre' })).statusCode,
    ).toBe(400)
    expect(
      (await envoyer(urlSuppr('INCONNU'), h, { version: '1.1.1', motif: 'Autre' })).statusCode,
    ).toBe(404)
    expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    expect((await envoyer(urlSuppr(trainId), h, { version, motif: 'Autre' })).statusCode).toBe(200)
    const encore = await envoyer(urlSuppr(trainId), h, { version, motif: 'Autre' }, idem())
    expect([404, 409]).toContain(encore.statusCode)
  })

  it('RG-COO-225 / RG-COO-308 version périmée ⇒ 409 (rien n’est supprimé) ; deux suppressions simultanées de la même version ⇒ une seule réussit', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const perimee = await envoyer(urlSuppr(trainId), s.users.coord.headers, {
      version: '0.0.0',
      motif: 'Autre',
    })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).regle).toBe('RG-COO-308')
    expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
    const version = await versionDe(s, trainId)
    const rs = await Promise.all([
      envoyer(urlSuppr(trainId), s.users.coord.headers, { version, motif: 'Autre' }),
      envoyer(urlSuppr(trainId), s.users.coord.headers, { version, motif: 'Autre' }),
    ])
    expect(rs.map((r) => r.statusCode).sort()[0]).toBe(200)
    expect([404, 409]).toContain(rs.map((r) => r.statusCode).sort()[1])
    expect(await historiques(faces[0]?.id ?? 0)).toHaveLength(1)
  })
})

describe('RG-COO-226 dupliquer un train (complément)', () => {
  const source = () => `8${String(next()).padStart(10, '0')}`
  const cible = () => String(5_000_000_000 + next() * 1000)

  it('RG-COO-226 les copies reprennent thème, cadre, ordre et destinataire du train source ; la source est inchangée ; une trace par copie', async () => {
    const s = await site()
    const src = source()
    const t = await trainDirect(
      s,
      [
        [700_000 + next(), 'Rose'],
        [700_000 + next(), 'Gris'],
      ],
      { trainId: src, statut: 'AU_ROULAGE' },
    )
    const c = cible()
    const r = await envoyer(URL_DUPLIQUER, s.users.admin.headers, {
      trainSource: src,
      trainCible: c,
      afficheur: 'REMPL',
      nombre: 3,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ nombre: number }>().nombre).toBe(3)
    const ids = [1n, 2n, 3n].map((k) => String(BigInt(c) + 190n * k))
    const copies = await db.faceTrain.findMany({
      where: { trainId: { in: ids } },
      orderBy: { id: 'asc' },
    })
    expect(copies).toHaveLength(6)
    for (const id of ids) {
      const cp = copies.filter((x) => x.trainId === id)
      expect(cp.map((x) => x.theme)).toEqual(['Rose', 'Gris'])
      expect(cp.map((x) => x.ordreReel)).toEqual([1, 2])
      expect(
        cp.every((x) => x.statut === 'A_IMPRIMER' && x.destinataireId === s.destinataire.id),
      ).toBe(true)
      expect(
        await db.journalAudit.count({ where: { entiteId: id, action: 'DUPLICATION_TRAIN' } }),
      ).toBe(1)
    }
    for (const x of t.faces)
      expect(await faceDe(x.id)).toMatchObject({ statut: 'AU_ROULAGE', version: x.version })
    for (const x of copies)
      expect((await historiques(x.id)).map((h) => h.nouveau)).toEqual(['A_IMPRIMER'])
  })

  it('RG-COO-226 les faces annulées du train source ne sont pas copiées', async () => {
    const s = await site()
    const src = source()
    const t = await trainDirect(
      s,
      [
        [700_000 + next(), 'Rose'],
        [700_000 + next(), 'Gris'],
      ],
      { trainId: src },
    )
    await db.faceTrain.update({ where: { id: t.faces[1]?.id ?? 0 }, data: { statut: 'ANNULE' } })
    const c = cible()
    expect(
      (
        await envoyer(URL_DUPLIQUER, s.users.admin.headers, {
          trainSource: src,
          trainCible: c,
          afficheur: 'X',
          nombre: 1,
        })
      ).statusCode,
    ).toBe(200)
    expect(await db.faceTrain.count({ where: { trainId: String(BigInt(c) + 190n) } })).toBe(1)
  })

  it.each([
    ['nombre 0', { nombre: 0 }],
    ['nombre 51', { nombre: 51 }],
    ['source non numérique', { trainSource: 'ABC' }],
    ['cible de 19 chiffres', { trainCible: '1'.repeat(19) }],
    ['afficheur vide', { afficheur: '   ' }],
    ['afficheur de plus de 50 caractères', { afficheur: 'x'.repeat(51) }],
  ])('RG-COO-226 entrée invalide (%s) ⇒ 400, rien n’est copié', async (_cas, extra) => {
    const s = await site()
    const src = source()
    await trainDirect(s, [[700_000 + next(), 'Rose']], { trainId: src })
    const avant = await db.faceTrain.count()
    const r = await envoyer(URL_DUPLIQUER, s.users.admin.headers, {
      trainSource: src,
      trainCible: cible(),
      afficheur: 'X',
      nombre: 1,
      ...extra,
    })
    expect(r.statusCode).toBe(400)
    expect(await db.faceTrain.count()).toBe(avant)
  })

  it('RG-COO-226 rejet : une cible qui retombe sur la source (source = cible + 190) ⇒ 409', async () => {
    const s = await site()
    const c = cible()
    const src = String(BigInt(c) + 190n)
    await trainDirect(s, [[700_000 + next(), 'Rose']], { trainId: src })
    const r = await envoyer(URL_DUPLIQUER, s.users.admin.headers, {
      trainSource: src,
      trainCible: c,
      afficheur: 'X',
      nombre: 1,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-226')
  })

  it('RG-COO-226 / RG-COO-307 atomicité : échec de la trace de la 2e copie ⇒ aucune copie (la 1re non plus)', async () => {
    const s = await site()
    const src = source()
    await trainDirect(s, [[700_000 + next(), 'Rose']], { trainId: src })
    const c = cible()
    const deuxieme = String(BigInt(c) + 380n)
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'DUPLICATION_TRAIN' AND NEW.entite_id = '${deuxieme}'`,
      () =>
        envoyer(URL_DUPLIQUER, s.users.admin.headers, {
          trainSource: src,
          trainCible: c,
          afficheur: 'X',
          nombre: 2,
        }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(
      await db.faceTrain.count({
        where: { trainId: { in: [String(BigInt(c) + 190n), deuxieme] } },
      }),
    ).toBe(0)
  })

  it.each(ROLES)(
    'RG-COO-226 permission dupliquer pour le rôle %s (administrateur seulement)',
    async (role) => {
      const s = await site()
      const src = source()
      await trainDirect(s, [[700_000 + next(), 'Rose']], { trainId: src })
      const c = cible()
      const r = await envoyer(URL_DUPLIQUER, s.users[role].headers, {
        trainSource: src,
        trainCible: c,
        afficheur: 'X',
        nombre: 1,
      })
      expect(r.statusCode).toBe(role === 'admin' ? 200 : 403)
      expect(await db.faceTrain.count({ where: { trainId: String(BigInt(c) + 190n) } })).toBe(
        role === 'admin' ? 1 : 0,
      )
    },
  )
})

// ───────────────── RG-COO-228 / 229 liste et filtres ─────────────────

describe('RG-COO-228 / 229 liste des trains (complément)', () => {
  it('RG-COO-228 sans filtre de départ : la semaine SUIVANTE par défaut (les trains de la semaine en cours n’apparaissent pas)', async () => {
    const s = await site()
    const c = 700_000 + next()
    const suivante = await trainDirect(s, [[c, 'Suivante']])
    const courante = await trainDirect(s, [[c, 'Courante']], { semaine: S })
    const r = await get(ctx, `/api/coordination/trains?dossier=${String(c)}`, s.users.coord.headers)
    expect(r.statusCode, r.body).toBe(200)
    const l = ListeTrainsSchema.parse(r.json())
    expect(l.semaine).toEqual(SEM)
    const ids = l.lignes.flatMap((x) => x.trains.map((t) => t.trainId))
    expect(ids).toContain(suivante.trainId)
    expect(ids).not.toContain(courante.trainId)
  })

  it('RG-COO-228 filtres Atelier, Annonceur, Afficheur et Statut multiple ; chaque filtre isole les trains concernés', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(s, [[c, 'Rose']], {
      annonceur: 'ANNONCEUR ALPHA',
      afficheurNom: 'AFF NORD',
    })
    const b = await trainDirect(s, [[c + 1, 'Gris']], {
      annonceur: 'ANNONCEUR BETA',
      afficheurNom: 'AFF SUD',
      atelierId: s.atelier2.id,
      statut: 'A_IMPRIMER',
    })
    const ids = (l: Awaited<ReturnType<typeof liste>>) =>
      l.lignes.flatMap((x) => x.trains.map((t) => t.trainId)).sort()
    const h = s.users.coord.headers
    expect(
      ids(await liste(h, `&atelier=${String(s.atelier2.id)}`)).filter((x) => x === b.trainId),
    ).toEqual([b.trainId])
    expect(ids(await liste(h, `&atelier=${String(s.atelier2.id)}`))).not.toContain(a.trainId)
    expect(ids(await liste(h, '&annonceur=alpha'))).toContain(a.trainId)
    expect(ids(await liste(h, '&annonceur=alpha'))).not.toContain(b.trainId)
    expect(ids(await liste(h, '&afficheur=sud'))).toContain(b.trainId)
    expect(ids(await liste(h, '&afficheur=sud'))).not.toContain(a.trainId)
    const deux = ids(await liste(h, '&statut=EN_ATTENTE,PRET'))
    expect(deux).toContain(a.trainId)
    expect(deux).toContain(b.trainId)
    expect(ids(await liste(h, `&dossier=${String(c + 1)}&statut=PRET`))).toEqual([])
  })

  it('RG-COO-228 les indicateurs ignorent le filtre Statut ; « Trains de n visuels » : 1 à 4', async () => {
    const s = await site()
    const c = 700_000 + next()
    await trainDirect(s, [[c, 'Un']])
    await trainDirect(s, [
      [c, 'Un'],
      [c + 1, 'Deux'],
    ])
    await trainDirect(s, [
      [c, 'Un'],
      [c + 1, 'Deux'],
      [c + 2, 'Trois'],
    ])
    const h = s.users.coord.headers
    const tous = await liste(h, `&dossier=${String(c)}`)
    const filtre = await liste(h, `&dossier=${String(c)}&statut=PRET`)
    expect(filtre.lignes).toHaveLength(0)
    expect(filtre.indicateurs).toEqual(tous.indicateurs)
    expect(tous.indicateurs.enAttente).toBe(3)
    for (const n of [1, 2, 3])
      expect((await liste(h, `&dossier=${String(c)}&trainsDe=${String(n)}`)).lignes).toHaveLength(1)
    expect((await liste(h, `&dossier=${String(c)}&trainsDe=4`)).lignes).toHaveLength(0)
  })

  it('RG-COO-228 indicateurs : EN_PROD et PRODUIT en « En production », COLISE / EXPEDIE en « Colisés / expédiés », EN_ATTENTE + PRET en « À produire »', async () => {
    const s = await site()
    const c = 700_000 + next()
    for (const statut of [
      'INSTRUCTION_OK',
      'AU_ROULAGE',
      'EXPORT_PREPA',
      'PREPARE',
      'A_EXPEDIER',
      'TERMINE',
    ] as const)
      await trainDirect(s, [[c, 'A']], { statut })
    await recu(s, c, 'A', 1)
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(l.indicateurs).toMatchObject({ aProduire: 1, enProduction: 3, colisesExpedies: 2 })
    expect(l.lignes.flatMap((x) => Array<string>(x.nb).fill(x.statut)).sort()).toEqual(
      ['COLISE', 'EN_PROD', 'EN_PROD', 'EXPEDIE', 'PRET', 'PRODUIT'].sort(),
    )
  })

  it('RG-COO-228 tri par départ croissant ; deux trains de même composition mais d’afficheurs différents ne sont pas regroupés', async () => {
    const s = await site()
    const c = 700_000 + next()
    await trainDirect(s, [[c, 'Rose']], { depart: new Date(DEPART.getTime() + 2 * JOUR) })
    await trainDirect(s, [[c, 'Rose']], { depart: DEPART })
    await trainDirect(s, [[c, 'Rose']], { depart: DEPART, afficheurNom: 'AUTRE AFFICHEUR' })
    const l = await liste(s.users.coord.headers, `&dossier=${String(c)}`)
    expect(l.lignes).toHaveLength(3)
    const dates = l.lignes.map((x) => x.depart)
    expect([...dates].sort()).toEqual(dates)
    expect(l.lignes.map((x) => x.nb)).toEqual([1, 1, 1])
  })

  it('RG-COO-228 filtres invalides : trainsDe hors 1 à 9 ⇒ 400 ; statut inconnu ⇒ 400 ; atelier non numérique ⇒ 400', async () => {
    const s = await site()
    for (const qs of ['trainsDe=0', 'trainsDe=10', 'statut=EN_VOL', 'atelier=abc'])
      expect(
        (await get(ctx, `/api/coordination/trains?depart=${MOIS_SEM}&${qs}`, s.users.coord.headers))
          .statusCode,
        qs,
      ).toBe(400)
  })

  // ANO-042 (corrigée) : CLAUDE.md §6 (400 = validation) : une semaine ISO inexistante (W00, W54, W99) respecte le format
  // AAAA-Wss et passe la validation du filtre « Départ » (packages/shared coordination-trains.ts SemaineQuery,
  // regex seule) : la liste répond 200 sur une semaine qui n'existe pas au lieu de 400.
  it('RG-COO-228 filtre Départ : une semaine ISO inexistante (2026-W54, 2026-W00) ⇒ 400 (ANO-042)', async () => {
    const s = await site()
    for (const semaine of ['2026-W54', '2026-W00'])
      expect(
        (await get(ctx, `/api/coordination/trains?depart=${semaine}`, s.users.coord.headers))
          .statusCode,
        semaine,
      ).toBe(400)
  })

  it('RG-COO-229 trains identiques regroupés : le n° de panneau est listé pour chacun des trains de la ligne (un par train), sans doublon', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(s, [[c, 'Lune']], { extra: { refPanel: 'PANNEAU-1' } })
    const b = await trainDirect(s, [[c, 'Lune']], { extra: { refPanel: 'PANNEAU-2' } })
    for (const role of ['coord', 'cheq'] as const) {
      const l = await liste(s.users[role].headers, `&dossier=${String(c)}`)
      expect(l.lignes).toHaveLength(1)
      expect(l.lignes[0]?.nb).toBe(2)
      expect((l.lignes[0]?.panneauxBc ?? []).sort()).toEqual(['PANNEAU-1', 'PANNEAU-2'])
      expect((await ficheDe(s, a.trainId, s.users[role].headers)).panneauxBc).toEqual(['PANNEAU-1'])
      expect((await ficheDe(s, b.trainId, s.users[role].headers)).panneauxBc).toEqual(['PANNEAU-2'])
    }
  })

  it('RG-COO-228 fiche : positions avec reçu, attendu (nombre de faces du visuel) et emplacement (allée-rayon) du reçu', async () => {
    const s = await site()
    const c = 700_000 + next()
    const a = await trainDirect(s, [[c, 'Lune']])
    await trainDirect(s, [[c, 'Lune']], { depart: new Date(DEPART.getTime() + JOUR) })
    await recu(s, c, 'Lune', 3)
    const fiche = await ficheDe(s, a.trainId)
    expect(fiche.positions[0]).toMatchObject({
      theme: 'Lune',
      recu: 3,
      attendu: 2,
      emplacement: 'B-12',
      etat: 'OK',
    })
  })
})

// ───────────────── RG-COO-167 périmètre ─────────────────

describe('RG-COO-167 périmètre par site et par atelier (complément)', () => {
  it('RG-COO-167 un coordinateur d’un autre site : liste vide, fiche 403, et chaque action (fractionner, raccrocher, supprimer, changer statut) ⇒ 403 sans écriture', async () => {
    const s = await site()
    const autre = await site()
    const c = 700_000 + next()
    const { trainId, faces } = await trainDirect(s, [[c, 'Rose']])
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'N',
      pourcentage: 100,
    })
    const trains = await versions(s, [trainId])
    const h = autre.users.coord.headers
    expect((await liste(h, `&dossier=${String(c)}`)).lignes).toHaveLength(0)
    expect((await get(ctx, `/api/coordination/trains/${trainId}`, h)).statusCode).toBe(403)
    expect(
      (await get(ctx, `/api/coordination/trains/visuels-raccrochables?train=${trainId}`, h))
        .statusCode,
    ).toBe(403)
    for (const r of [
      await envoyer(URL_FRAC, h, { trains }),
      await envoyer(URL_RACC, h, { visuelId: v.id, trains }),
      await envoyer(urlSuppr(trainId), h, { version: trains[0]?.version ?? '', motif: 'Autre' }),
      await envoyer(URL_STATUT, h, { trains, vers: 'A_IMPRIMER', ecran: 'LISTE' }),
    ]) {
      expect(r.statusCode, r.body).toBe(403)
      expect(erreur(r).regle).toBe('RG-COO-167')
    }
    expect(await faceDe(faces[0]?.id ?? 0)).toMatchObject({
      statut: 'INSTRUCTION_OK',
      version: faces[0]?.version,
    })
    expect(await db.faceTrain.count({ where: { trainId } })).toBe(1)
  })

  it('RG-COO-167 une action de masse mêlant un train du périmètre et un train d’un autre site ⇒ 403, le train du périmètre n’est pas modifié', async () => {
    const s = await site()
    const autre = await site()
    const mien = await trainDirect(autre, [[700_000 + next(), 'Rose']])
    const etranger = await trainDirect(s, [[700_000 + next(), 'Gris']])
    const trains = [
      ...(await versions(autre, [mien.trainId])),
      ...(await versions(s, [etranger.trainId])),
    ]
    const r = await envoyer(URL_STATUT, autre.users.coord.headers, {
      trains,
      vers: 'A_IMPRIMER',
      ecran: 'LISTE',
    })
    expect(r.statusCode).toBe(403)
    expect((await faceDe(mien.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
  })

  it('RG-COO-167 créer un train sur un atelier d’un autre site ⇒ 403 ; options de création : uniquement les ateliers du périmètre', async () => {
    const s = await site()
    const autre = await site()
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'N',
      pourcentage: 100,
    })
    const r = await envoyer(URL_CREER, autre.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: MOIS_SEM,
      type: 'PRE_TEST',
      nombre: 1,
      visuelId: v.id,
      destinataireId: s.destinataire.id,
    })
    expect(r.statusCode).toBe(403)
    const o = await get(ctx, '/api/coordination/trains/options-creation', autre.users.coord.headers)
    expect(
      OptionsCreationTrainSchema.parse(o.json())
        .ateliers.map((a) => a.id)
        .sort(),
    ).toEqual([autre.atelier.id, autre.atelier2.id].sort())
  })

  it('RG-COO-167 utilisateur limité à un atelier du site : ne voit que les trains de cet atelier ; l’autre atelier du même site ⇒ 403 (fiche, annuler thème, débloquer semaine)', async () => {
    const s = await site()
    const c = 700_000 + next()
    const dansAtelier = await trainDirect(s, [[c, 'Rose']], { atelierId: s.atelier.id })
    const hors = await trainDirect(s, [[c, 'Gris']], {
      atelierId: s.atelier2.id,
      statut: 'A_IMPRIMER',
    })
    const limite = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: s.plateforme.id, atelierId: s.atelier.id }],
    )
    const h = devHeaders(limite.identifiantExterne)
    const l = await liste(h, `&dossier=${String(c)}`)
    expect(l.lignes.flatMap((x) => x.trains.map((t) => t.trainId))).toEqual([dansAtelier.trainId])
    expect((await get(ctx, `/api/coordination/trains/${hors.trainId}`, h)).statusCode).toBe(403)
    expect(
      (
        await envoyer(URL_ANNULER, h, {
          atelierId: s.atelier2.id,
          depart: MOIS_SEM,
          contNum: c,
          theme: 'Gris',
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (await envoyer(URL_DEBLOQUER, h, { atelierId: s.atelier2.id, depart: MOIS_SEM })).statusCode,
    ).toBe(403)
    expect((await faceDe(hors.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it('RG-COO-167 un chef d’équipe d’un autre site ne peut ni voir ni fractionner les trains du site', async () => {
    const s = await site()
    const autre = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 1)
    const r = await envoyer(URL_FRAC, autre.users.cheq.headers, {
      trains: await versions(s, [trainId]),
    })
    expect(r.statusCode).toBe(403)
    expect((await liste(autre.users.cheq.headers, `&dossier=${String(c)}`)).lignes).toHaveLength(0)
  })
})

// ───────────────── Permissions des 6 profils, entrées invalides, authentification ─────────────────

describe('RG-COO-165 / 218 / 225 permissions, authentification et entrées invalides (complément)', () => {
  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-218 changer statut pour le rôle %s (Coordination seulement)',
    async (role) => {
      const s = await site()
      const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
      const r = await envoyer(URL_STATUT, s.users[role].headers, {
        trains: await versions(s, [trainId]),
        vers: 'A_IMPRIMER',
        ecran: 'LISTE',
      })
      expect(r.statusCode).toBe(role === 'coord' ? 200 : 403)
      expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe(
        role === 'coord' ? 'A_IMPRIMER' : 'INSTRUCTION_OK',
      )
    },
  )

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-225 supprimer un train pour le rôle %s (Coordination seulement)',
    async (role) => {
      const s = await site()
      const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
      const r = await envoyer(urlSuppr(trainId), s.users[role].headers, {
        version: await versionDe(s, trainId),
        motif: 'Autre',
      })
      expect(r.statusCode).toBe(role === 'coord' ? 200 : 403)
      expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe(
        role === 'coord' ? 'ANNULE' : 'INSTRUCTION_OK',
      )
    },
  )

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-228 fiche d’un train et visuels raccrochables pour le rôle %s (Coordination et chefs d’équipe)',
    async (role) => {
      const s = await site()
      const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
      const attendu = ['coord', 'cheq'].includes(role) ? 200 : 403
      expect(
        (await get(ctx, `/api/coordination/trains/${trainId}`, s.users[role].headers)).statusCode,
      ).toBe(attendu)
      expect(
        (
          await get(
            ctx,
            `/api/coordination/trains/visuels-raccrochables?train=${trainId}`,
            s.users[role].headers,
          )
        ).statusCode,
      ).toBe(attendu)
    },
  )

  it.each([
    ['GET', '/api/coordination/trains', undefined],
    ['GET', '/api/coordination/trains/UN-TRAIN', undefined],
    ['GET', '/api/coordination/trains/options-creation', undefined],
    ['GET', '/api/coordination/trains/visuels-raccrochables?train=UN-TRAIN', undefined],
    ['POST', URL_FRAC, { trains: [{ trainId: 'X', version: '1.1.1' }] }],
    ['POST', URL_RACC, { visuelId: 1, trains: [{ trainId: 'X', version: '1.1.1' }] }],
    [
      'POST',
      URL_STATUT,
      { trains: [{ trainId: 'X', version: '1.1.1' }], vers: 'A_IMPRIMER', ecran: 'LISTE' },
    ],
    ['POST', urlSuppr('X'), { version: '1.1.1', motif: 'Autre' }],
    ['POST', URL_ANNULER, { atelierId: 1, depart: MOIS_SEM, contNum: 1, theme: 'T' }],
    ['POST', URL_DEBLOQUER, { atelierId: 1, depart: MOIS_SEM }],
    ['POST', URL_DUPLIQUER, { trainSource: '1', trainCible: '2', afficheur: 'X', nombre: 1 }],
  ])('RG-COO-165 sans identité : %s %s ⇒ 401', async (method, url, payload) => {
    const r = await ctx.app.inject({
      method: method as 'GET' | 'POST',
      url,
      ...(payload ? { headers: idem(), payload } : {}),
    })
    expect(r.statusCode).toBe(401)
  })

  it.each([
    ['fractionner : liste vide', URL_FRAC, { trains: [] }],
    ['fractionner : version absente', URL_FRAC, { trains: [{ trainId: 'X' }] }],
    [
      'fractionner : plus de 500 trains',
      URL_FRAC,
      {
        trains: Array.from({ length: 501 }, (_, k) => ({
          trainId: `T${String(k)}`,
          version: '1.1.1',
        })),
      },
    ],
    [
      'raccrocher : visuel 0',
      URL_RACC,
      { visuelId: 0, trains: [{ trainId: 'X', version: '1.1.1' }] },
    ],
    [
      'créer : type inconnu',
      URL_CREER,
      { atelierId: 1, depart: MOIS_SEM, type: 'AUTRE', nombre: 1, visuelId: 1, destinataireId: 1 },
    ],
    [
      'créer : départ mal formé',
      URL_CREER,
      { atelierId: 1, depart: 'S45', type: 'PRE_TEST', nombre: 1, visuelId: 1, destinataireId: 1 },
    ],
    [
      'créer : atelier négatif',
      URL_CREER,
      {
        atelierId: -1,
        depart: MOIS_SEM,
        type: 'PRE_TEST',
        nombre: 1,
        visuelId: 1,
        destinataireId: 1,
      },
    ],
    [
      'statut : cible hors liste',
      URL_STATUT,
      { trains: [{ trainId: 'X', version: '1.1.1' }], vers: 'ANNULE', ecran: 'LISTE' },
    ],
    [
      'statut : écran inconnu',
      URL_STATUT,
      { trains: [{ trainId: 'X', version: '1.1.1' }], vers: 'A_IMPRIMER', ecran: 'AUTRE' },
    ],
    [
      'statut : rouleur 0',
      URL_STATUT,
      {
        trains: [{ trainId: 'X', version: '1.1.1' }],
        vers: 'AU_ROULAGE',
        ecran: 'LISTE',
        rouleurId: 0,
      },
    ],
    [
      'annuler thème : thème vide',
      URL_ANNULER,
      { atelierId: 1, depart: MOIS_SEM, contNum: 1, theme: '' },
    ],
    [
      'annuler thème : dossier 0',
      URL_ANNULER,
      { atelierId: 1, depart: MOIS_SEM, contNum: 0, theme: 'T' },
    ],
    [
      'annuler thème : départ mal formé',
      URL_ANNULER,
      { atelierId: 1, depart: '2026', contNum: 1, theme: 'T' },
    ],
    ['débloquer : départ mal formé', URL_DEBLOQUER, { atelierId: 1, depart: 'demain' }],
    ['débloquer : atelier absent', URL_DEBLOQUER, { depart: MOIS_SEM }],
  ])('RG-COO-308 entrée invalide (%s) ⇒ 400, aucune écriture', async (_cas, url, payload) => {
    const s = await site()
    const avant = await db.faceTrain.count()
    const r = await envoyer(url, s.users.coord.headers, payload)
    expect(r.statusCode).toBe(400)
    expect(await db.faceTrain.count()).toBe(avant)
  })

  it.each([
    ['fractionner', URL_FRAC],
    ['raccrocher', URL_RACC],
    ['créer', URL_CREER],
    ['changer statut', URL_STATUT],
    ['annuler thème', URL_ANNULER],
    ['débloquer semaine', URL_DEBLOQUER],
    ['supprimer', urlSuppr('X')],
  ])('RG-COO-308 %s sans Idempotency-Key ⇒ 400', async (_cas, url) => {
    const s = await site()
    const r = await post(ctx, url, s.users.coord.headers, {}, false)
    expect(r.statusCode).toBe(400)
  })
})

// ───────────────── RG-COO-308 concurrence et idempotence ─────────────────

describe('RG-COO-308 concurrence, idempotence (complément)', () => {
  it('RG-COO-308 deux « Changer statut » simultanés avec la même version ⇒ un 200 et un 409 ; une seule transition historisée par face', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const trains = await versions(s, [trainId])
    const corps = { trains, vers: 'A_IMPRIMER', ecran: 'LISTE' }
    const rs = await Promise.all([
      envoyer(URL_STATUT, s.users.coord.headers, corps),
      envoyer(URL_STATUT, s.users.coord.headers, corps),
    ])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(await historiques(faces[0]?.id ?? 0)).toHaveLength(1)
  })

  it('RG-COO-308 deux fractionnements simultanés de la même version ⇒ un 200 et un 409', async () => {
    const s = await site()
    const c = 700_000 + next()
    const { trainId } = await trainDirect(s, [
      [c, 'Rose'],
      [c + 1, 'Gris'],
    ])
    await recu(s, c, 'Rose', 1)
    const corps = { trains: await versions(s, [trainId]) }
    const rs = await Promise.all([
      envoyer(URL_FRAC, s.users.coord.headers, corps),
      envoyer(URL_FRAC, s.users.cheq.headers, corps),
    ])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(
      await db.journalAudit.count({ where: { entiteId: trainId, action: 'FRACTIONNEMENT_TRAIN' } }),
    ).toBe(1)
  })

  it('RG-COO-308 deux raccrochages simultanés du même visuel à la même version ⇒ un 200 et un 409, une seule position ajoutée', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Nouveau',
      pourcentage: 100,
    })
    const corps = { visuelId: v.id, trains: await versions(s, [trainId]) }
    const rs = await Promise.all([
      envoyer(URL_RACC, s.users.coord.headers, corps),
      envoyer(URL_RACC, s.users.cheq.headers, corps),
    ])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(await db.faceTrain.count({ where: { trainId } })).toBe(2)
  })

  it('RG-COO-308 la version d’un train est une empreinte « nb faces . somme des versions . id max » qui change à chaque écriture (statut, raccrochage)', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [
      [700_000 + next(), 'Rose'],
      [700_000 + next(), 'Gris'],
    ])
    const v0 = await versionDe(s, trainId)
    const somme = faces.reduce((n, x) => n + x.version, 0)
    expect(v0).toBe(`2.${String(somme)}.${String(Math.max(...faces.map((x) => x.id)))}`)
    expect(
      (
        await envoyer(URL_STATUT, s.users.coord.headers, {
          trains: [{ trainId, version: v0 }],
          vers: 'A_IMPRIMER',
          ecran: 'LISTE',
        })
      ).statusCode,
    ).toBe(200)
    const v1 = await versionDe(s, trainId)
    expect(v1).not.toBe(v0)
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Nouveau',
      pourcentage: 100,
    })
    expect(
      (
        await envoyer(URL_RACC, s.users.coord.headers, {
          visuelId: v.id,
          trains: [{ trainId, version: v1 }],
        })
      ).statusCode,
    ).toBe(200)
    const v2 = await versionDe(s, trainId)
    expect(new Set([v0, v1, v2]).size).toBe(3)
  })

  it('RG-COO-308 raccrocher : version périmée ⇒ 409 (rien n’est ajouté)', async () => {
    const s = await site()
    const { trainId } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Nouveau',
      pourcentage: 100,
    })
    const r = await envoyer(URL_RACC, s.users.coord.headers, {
      visuelId: v.id,
      trains: [{ trainId, version: '0.0.0' }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-308')
    expect(await db.faceTrain.count({ where: { trainId } })).toBe(1)
  })

  it('RG-COO-308 idempotence : même Idempotency-Key ⇒ même réponse rejouée, une seule écriture (annuler thème, débloquer semaine, changer statut, supprimer, raccrocher, créer, dupliquer)', async () => {
    const s = await site()
    const cle = () => idem()
    const rejeu = async (url: string, h: Headers, corps: unknown) => {
      const k = cle()
      const a = await envoyer(url, h, corps, k)
      const b = await envoyer(url, h, corps, k)
      expect(a.statusCode, `${url} : ${a.body}`).toBe(200)
      expect(b.json()).toEqual(a.json())
      expect(b.headers['idempotent-replayed']).toBe('true')
      return a
    }
    const c = 700_000 + next()
    // Annuler thème : le 2e appel « normal » serait un 409 (plus de données) ; le rejeu rend le 200 initial.
    const aImprimer = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    await rejeu(URL_ANNULER, s.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: MOIS_SEM,
      contNum: c,
      theme: 'Rose',
    })
    expect(await historiques(aImprimer.faces[0]?.id ?? 0)).toHaveLength(1)
    // Débloquer semaine.
    const t2 = await trainDirect(s, [[c + 1, 'Gris']], {
      statut: 'A_IMPRIMER',
      atelierId: s.atelier2.id,
    })
    await rejeu(URL_DEBLOQUER, s.users.coord.headers, {
      atelierId: s.atelier2.id,
      depart: MOIS_SEM,
    })
    expect(await historiques(t2.faces[0]?.id ?? 0)).toHaveLength(1)
    // Changer statut.
    const t3 = await trainDirect(s, [[c + 2, 'Noir']])
    await rejeu(URL_STATUT, s.users.coord.headers, {
      trains: await versions(s, [t3.trainId]),
      vers: 'A_IMPRIMER',
      ecran: 'LISTE',
    })
    expect(await historiques(t3.faces[0]?.id ?? 0)).toHaveLength(1)
    // Supprimer.
    const t4 = await trainDirect(s, [[c + 3, 'Blanc']])
    await rejeu(urlSuppr(t4.trainId), s.users.coord.headers, {
      version: await versionDe(s, t4.trainId),
      motif: 'Autre',
    })
    expect(await historiques(t4.faces[0]?.id ?? 0)).toHaveLength(1)
    // Raccrocher.
    const t5 = await trainDirect(s, [[c + 4, 'Bleu']])
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Rac',
      pourcentage: 100,
    })
    await rejeu(URL_RACC, s.users.coord.headers, {
      visuelId: v.id,
      trains: await versions(s, [t5.trainId]),
    })
    expect(await db.faceTrain.count({ where: { trainId: t5.trainId } })).toBe(2)
    // Créer.
    await trainDirect(s, [[c + 5, 'Existant']])
    const vc = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 8,
      theme: 'Cré',
      pourcentage: 100,
    })
    const cree = await rejeu(URL_CREER, s.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: MOIS_SEM,
      type: 'PRE_TEST',
      nombre: 2,
      visuelId: vc.id,
      destinataireId: s.destinataire.id,
    })
    expect(
      await db.faceTrain.count({
        where: { trainId: { in: CreerTrainResultatSchema.parse(cree.json()).trains } },
      }),
    ).toBe(2)
    // Dupliquer.
    const src = `8${String(next()).padStart(10, '0')}`
    await trainDirect(s, [[c + 6, 'Src']], { trainId: src })
    const cible = String(5_000_000_000 + next() * 1000)
    await rejeu(URL_DUPLIQUER, s.users.admin.headers, {
      trainSource: src,
      trainCible: cible,
      afficheur: 'X',
      nombre: 2,
    })
    expect(
      await db.faceTrain.count({
        where: { trainId: { in: [String(BigInt(cible) + 190n), String(BigInt(cible) + 380n)] } },
      }),
    ).toBe(2)
  })

  it('RG-COO-308 même Idempotency-Key avec un autre corps ⇒ 409 COO_IDEMPOTENCE_CONFLIT, rien de plus n’est écrit', async () => {
    const s = await site()
    const a = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const b = await trainDirect(s, [[700_000 + next(), 'Gris']])
    const cle = idem()
    expect(
      (
        await envoyer(
          URL_STATUT,
          s.users.coord.headers,
          { trains: await versions(s, [a.trainId]), vers: 'A_IMPRIMER', ecran: 'LISTE' },
          cle,
        )
      ).statusCode,
    ).toBe(200)
    const r = await envoyer(
      URL_STATUT,
      s.users.coord.headers,
      { trains: await versions(s, [b.trainId]), vers: 'A_IMPRIMER', ecran: 'LISTE' },
      cle,
    )
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect((await faceDe(b.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
  })

  it('RG-COO-308 une requête refusée (409) ne garde pas sa clé : rejouée après correction, elle réussit', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const cle = idem()
    const refus = await envoyer(
      URL_STATUT,
      s.users.coord.headers,
      { trains: [{ trainId, version: '0.0.0' }], vers: 'A_IMPRIMER', ecran: 'LISTE' },
      cle,
    )
    expect(refus.statusCode).toBe(409)
    expect(
      await db.cleIdempotence.count({
        where: { utilisateurId: s.users.coord.id, cle: cle['idempotency-key'] },
      }),
    ).toBe(0)
    const ok = await envoyer(
      URL_STATUT,
      s.users.coord.headers,
      { trains: await versions(s, [trainId]), vers: 'A_IMPRIMER', ecran: 'LISTE' },
      cle,
    )
    expect(ok.statusCode, ok.body).toBe(200)
    expect((await faceDe(faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
  })

  it('RG-COO-308 / RG-COO-307 atomicité : échec de la trace du 2e train d’un changement de statut en masse ⇒ aucune face du 1er train non plus', async () => {
    const s = await site()
    const a = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const b = await trainDirect(s, [[700_000 + next(), 'Gris']])
    const trains = await versions(s, [a.trainId, b.trainId])
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'CHANGEMENT_STATUT_FACE' AND NEW.entite_id = '${b.trainId}'`,
      () =>
        envoyer(URL_STATUT, s.users.coord.headers, { trains, vers: 'A_IMPRIMER', ecran: 'LISTE' }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    for (const x of [...a.faces, ...b.faces]) {
      expect((await faceDe(x.id)).statut).toBe('INSTRUCTION_OK')
      expect(await historiques(x.id)).toHaveLength(0)
    }
  })

  it('RG-COO-307 atomicité : échec de l’historique d’une face lors d’un changement de statut ⇒ la face n’est pas modifiée', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    const trains = await versions(s, [trainId])
    const r = await avecEchec(
      `BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'FACE_TRAIN' AND NEW.regle = 'RG-COO-218'`,
      () =>
        envoyer(URL_STATUT, s.users.coord.headers, { trains, vers: 'A_IMPRIMER', ecran: 'LISTE' }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await faceDe(faces[0]?.id ?? 0)).toMatchObject({
      statut: 'INSTRUCTION_OK',
      version: faces[0]?.version,
    })
  })
})

// ───────────────── RG-COO-307 historique visible ─────────────────

describe('RG-COO-307 historique de chaque action du bloc (complément)', () => {
  it('RG-COO-307 la fiche d’un train montre, dans l’ordre chronologique, chaque action (création, raccrochage, changement de statut) avec son auteur', async () => {
    const s = await site()
    await trainDirect(s, [[700_000 + next(), 'Existant']])
    const { i } = await instruction(s)
    const v = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 7,
      theme: 'Rac',
      pourcentage: 100,
    })
    const cree = await envoyer(URL_CREER, s.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: MOIS_SEM,
      type: 'PRE_TEST',
      nombre: 1,
      visuelId: v.id,
      destinataireId: s.destinataire.id,
    })
    const [trainId] = CreerTrainResultatSchema.parse(cree.json()).trains
    const vv = await f.createInstructionVisuel(db, {
      instructionCode: i.code,
      afchIdent: 9,
      theme: 'Autre',
      pourcentage: 100,
    })
    expect(
      (
        await envoyer(URL_RACC, s.users.cheq.headers, {
          visuelId: vv.id,
          trains: await versions(s, [trainId ?? '']),
        })
      ).statusCode,
    ).toBe(200)
    await db.faceTrain.updateMany({ where: { trainId }, data: { statut: 'INSTRUCTION_OK' } })
    expect(
      (
        await envoyer(URL_STATUT, s.users.coord.headers, {
          trains: await versions(s, [trainId ?? '']),
          vers: 'A_IMPRIMER',
          ecran: 'LISTE',
        })
      ).statusCode,
    ).toBe(200)
    const fiche = await ficheDe(s, trainId ?? '')
    const actions = fiche.modifications.map((m) => m.action)
    expect(actions).toEqual(
      expect.arrayContaining(['CREATION_TRAIN', 'RACCROCHAGE_VISUEL', 'CHANGEMENT_STATUT_FACE']),
    )
    expect(actions.some((a) => a.includes('INSTRUCTION_OK → A_IMPRIMER'))).toBe(true)
    const dates = fiche.modifications.map((m) => m.le)
    expect([...dates].sort()).toEqual(dates)
    expect(fiche.modifications.every((m) => m.par !== null)).toBe(true)
  })

  it('RG-COO-307 le journal d’un train supprimé garde le motif ; les faces supprimées portent leur historique (qui, quand, ancienne et nouvelle valeur, motif)', async () => {
    const s = await site()
    const { trainId, faces } = await trainDirect(s, [[700_000 + next(), 'Rose']])
    expect(
      (
        await envoyer(urlSuppr(trainId), s.users.coord.headers, {
          version: await versionDe(s, trainId),
          motif: 'Pré-test annulé',
        })
      ).statusCode,
    ).toBe(200)
    const h = (await historiques(faces[0]?.id ?? 0))[0]
    expect(h).toMatchObject({
      ancien: 'INSTRUCTION_OK',
      nouveau: 'ANNULE',
      motif: 'Pré-test annulé',
      parId: s.users.coord.id,
    })
    expect(h?.le).toBeInstanceOf(Date)
  })
})

// ───────────────── Réserves de l'audit COO-P09 : RG-COO-219 (ligne), RG-COO-227 et RG-COO-201 (rejets) ─────────────────

describe('RG-COO-219 statut de la ligne de répartition (réserve M1)', () => {
  it('RG-COO-219 rejet : la ligne (répartition) du thème n’est pas « A imprimer » : message « Le statut du thème ne permet pas l’annulation ! », rien d’écrit', async () => {
    const s = await site()
    const c = 700_000 + next()
    const t = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    await f.createRepartition(db, {
      atelierId: s.atelier.id,
      contNum: c,
      theme: 'Rose',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      statut: 'EN_COURS',
    })
    const r = await envoyer(URL_ANNULER, s.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: MOIS_SEM,
      contNum: c,
      theme: 'Rose',
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      message: "Le statut du thème ne permet pas l'annulation !",
      regle: 'RG-COO-219',
    })
    expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({
      statut: 'A_IMPRIMER',
      trainId: t.trainId,
    })
  })

  it('RG-COO-219 nominal : ligne et faces « A imprimer » : annulation acceptée', async () => {
    const s = await site()
    const c = 700_000 + next()
    const t = await trainDirect(s, [[c, 'Rose']], { statut: 'A_IMPRIMER' })
    await f.createRepartition(db, {
      atelierId: s.atelier.id,
      contNum: c,
      theme: 'Rose',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      statut: 'A_IMPRIMER',
    })
    const r = await envoyer(URL_ANNULER, s.users.coord.headers, {
      atelierId: s.atelier.id,
      depart: MOIS_SEM,
      contNum: c,
      theme: 'Rose',
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(await faceDe(t.faces[0]?.id ?? 0)).toMatchObject({ statut: 'ANNULE', trainId: null })
  })
})

describe('RG-COO-227 « les N premiers » : rejets (réserve M7)', () => {
  const lignes = [
    { cle: 'a', nb: 2 },
    { cle: 'b', nb: 3 },
  ]
  it('RG-COO-227 rejet : la première ligne dépasse N : aucune ligne cochée et message « la ligne suivante en compte k et dépasserait N »', () => {
    expect(selectionnerPremiers(lignes, 1)).toEqual({
      cles: [],
      trains: 0,
      message:
        '0 train(s) sélectionné(s), sur 0 ligne(s)… la ligne suivante en compte 2 et dépasserait 1.',
    })
  })
  it('RG-COO-227 rejet : N = 0 ne sélectionne rien ; nominal : N exact coche toutes les lignes, sans message', () => {
    expect(selectionnerPremiers(lignes, 0).cles).toEqual([])
    expect(selectionnerPremiers(lignes, 5)).toEqual({ cles: ['a', 'b'], trains: 5, message: null })
    expect(selectionnerPremiers(lignes, 4).message).toMatch(/dépasserait 4\./)
  })
})

describe('RG-COO-201 position hors des codes connus (réserve M7)', () => {
  it('RG-COO-201 rejet : un code de position inconnu (hors référentiel instruction_plus) est refusé à l’écriture, aucune instruction créée', async () => {
    const s = await site()
    const dossier = await f.createDossier(db, { contNum: 700_000 + next() })
    const avant = await db.instruction.count({ where: { dossierId: dossier.id } })
    await expect(
      db.instruction.create({
        data: {
          code: `T${String(next()).padStart(17, '0')}`,
          dossierId: dossier.id,
          atelierId: s.atelier.id,
          statut: 'EN_COURS',
          tipInsCode: 77,
        },
      }),
    ).rejects.toThrow()
    expect(await db.instruction.count({ where: { dossierId: dossier.id } })).toBe(avant)
  })
})

describe('ECR-COO-05 « Voir les dossiers » : filtre pour=DEROULANT (réserve M2)', () => {
  it('RG-COO-060 / ECR-COO-05 pour=DEROULANT ne garde que les dossiers ayant une instruction d’un atelier déroulant ; sans le filtre, les deux sont listés', async () => {
    const s = await site()
    const fixe = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'FIXE' })
    const deroulant = await instruction(s)
    const dossierFixe = await instruction(s, { atelierId: fixe.id })
    const url = (qs: string) => `/api/coordination/dossiers?aFaire=A_FAIRE${qs}&pageSize=100`
    const contNums = async (qs: string) =>
      (await get(ctx, url(qs), s.users.coord.headers))
        .json<{ items: { dossier: number }[] }>()
        .items.map((d) => d.dossier)
    const tous = await contNums('')
    expect(tous).toEqual(
      expect.arrayContaining([deroulant.dossier.contNum, dossierFixe.dossier.contNum]),
    )
    const seulementDeroulant = await contNums('&pour=DEROULANT')
    expect(seulementDeroulant).toContain(deroulant.dossier.contNum)
    expect(seulementDeroulant).not.toContain(dossierFixe.dossier.contNum)
    expect(await contNums('&pour=FIXE')).toContain(dossierFixe.dossier.contNum)
    expect(await contNums('&pour=FIXE')).not.toContain(deroulant.dossier.contNum)
  })
})
