// Outils communs aux tests d'intégration COO-P10 (export des trains, préparation, rouleur, suivi par thème,
// générateur de fichiers) : sites déroulants, trains exportables, reçu des visuels, paramètres temporaires.
import {
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { Prisma, StatutProduction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from './identite.ts'
import { idem, type Ctx } from './reception.ts'

export type Headers = Record<string, string>
export const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']
/** Q-421 : l'admin est super-utilisateur (toutes les permissions) ; les matrices de REFUS ne le parcourent pas. */
export const ROLES_SANS_ADMIN: Role[] = ROLES.filter((r) => r !== 'admin')

const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
export const SEM = plus(semaineIsoDe(new Date()), 1)
export const DEPART_TXT = formatSemaineIso(SEM)
const JOUR = 86_400_000
export const DEPART = new Date(lundiSemaineIso(SEM).getTime() + JOUR + 16 * 3_600_000)

/** Site avec deux ateliers déroulants, un destinataire, un utilisateur par rôle. */
export async function siteDeroulant(ctx: Ctx) {
  const db = ctx.db
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
  return { plateforme, atelier, atelier2, support, destinataire, users }
}
export type SiteD = Awaited<ReturnType<typeof siteDeroulant>>

export interface OptionsTrainExp {
  statut?: StatutProduction
  /** Instruction : INSTRUCTION_OK + iokMode MANUEL + dossier PREPARATION_RECUE par défaut (exportable). */
  instructionStatut?: 'EN_COURS' | 'INSTRUCTION_OK' | 'PRET_A_PRODUIRE' | 'ANNULE'
  iokMode?: string | null
  dossierStatut?: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE'
  atelierId?: number
  trainId?: string
  repiquage?: string
  annonceur?: string
  extra?: Partial<Prisma.FaceTrainUncheckedCreateInput>
  semaine?: SemaineIso
}

/** Train dont chaque position est une face d'un dossier / d'une instruction propre (exportable par défaut). */
export async function trainExportable(
  ctx: Ctx,
  s: SiteD,
  themes: string[],
  o: OptionsTrainExp = {},
) {
  const db = ctx.db
  const trainId = o.trainId ?? `8${String(next()).padStart(15, '0')}`
  const sem = o.semaine ?? SEM
  const faces = []
  const instructions = []
  const dossiers = []
  let k = 0
  for (const theme of themes) {
    const dossier = await f.createDossier(db, {
      statut: o.dossierStatut ?? 'PREPARATION_RECUE',
      annonceur: 'ANNONCEUR',
    })
    const i = await f.createInstruction(db, {
      atelierId: o.atelierId ?? s.atelier.id,
      dossierId: dossier.id,
      contNum: dossier.contNum,
      annonceur: 'ANNONCEUR',
      contAnbas: sem.annee,
      contSembas: sem.semaine,
      statut: o.instructionStatut ?? 'INSTRUCTION_OK',
      iokMode: o.iokMode === undefined ? 'MANUEL' : o.iokMode,
    })
    faces.push(
      await f.createFaceTrain(db, {
        instructionCode: i.code,
        statut: o.statut ?? 'INSTRUCTION_OK',
        atelierId: o.atelierId ?? s.atelier.id,
        supportId: s.support.id,
        destinataireId: s.destinataire.id,
        contNum: dossier.contNum,
        contAnnonc: o.annonceur ?? 'ANNONCEUR',
        dateDepart: DEPART,
        contAnbas: sem.annee,
        contSembas: sem.semaine,
        depAnbas: sem.annee,
        depSembas: sem.semaine,
        trainId,
        theme,
        repiquage: o.repiquage ?? null,
        ordreReel: ++k,
        refPanel: `P${String(next())}`,
        afficheurNom: 'AFFICHEUR SUD',
        emplAdresse1: 'Rue des Tests',
        ...o.extra,
      }),
    )
    instructions.push(i)
    dossiers.push(dossier)
  }
  return { trainId, faces, instructions, dossiers }
}

/** Reçu d'un visuel : ligne attendue du thème + affiche rattachée de `quantite` (couverture, RG-COO-208). */
export async function recu(
  ctx: Ctx,
  s: SiteD,
  contNum: number,
  theme: string,
  quantite: number,
  o: { exclu?: boolean } = {},
) {
  // Une seule ligne active par clé (RG-COO-080) : la ligne du thème est réutilisée si elle existe déjà.
  const existante = await ctx.db.receptionAttendue.findFirst({
    where: { plateformeId: s.plateforme.id, contNum, theme, etatLigne: 'ACTIVE' },
  })
  const l =
    existante ??
    (await f.createReceptionAttendue(ctx.db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme,
      themeCle: theme.toUpperCase(),
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      themeExclu: o.exclu ?? false,
    }))
  if (quantite > 0) {
    const a = await f.createAffiche(ctx.db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme,
      quantite,
      allee: 'B',
      rayon: '12',
    })
    await f.createRattachement(ctx.db, { afficheId: a.id, ligneAttendueId: l.id, quantite })
  }
}

export const envoyer = (
  ctx: Ctx,
  url: string,
  headers: Headers,
  payload: unknown,
  cle: Headers = idem(),
) =>
  ctx.app.inject({
    method: 'POST',
    url,
    headers: { ...headers, ...cle },
    payload: payload as object,
  })

/** Version (empreinte) d'un train, lue par la fiche. */
export async function versionTrain(ctx: Ctx, headers: Headers, trainId: string) {
  const r = await ctx.app.inject({
    method: 'GET',
    url: `/api/coordination/trains/${trainId}`,
    headers,
  })
  if (r.statusCode !== 200) throw new Error(`fiche ${trainId} : ${r.body}`)
  return r.json<{ version: string }>().version
}
export async function versions(ctx: Ctx, headers: Headers, ids: string[]) {
  const r = []
  for (const trainId of ids) r.push({ trainId, version: await versionTrain(ctx, headers, trainId) })
  return r
}

const restaurer: (() => Promise<unknown>)[] = []
/** Paramètre global temporaire (restauré par `restaurerParametres`). */
export async function parametre(ctx: Ctx, cle: string, valeur: string) {
  const existant = await ctx.db.parametre.findFirst({ where: { cle, plateformeId: null } })
  if (existant) {
    await ctx.db.parametre.update({ where: { id: existant.id }, data: { valeur } })
    restaurer.push(() =>
      ctx.db.parametre.update({ where: { id: existant.id }, data: { valeur: existant.valeur } }),
    )
  } else {
    const p = await ctx.db.parametre.create({ data: { cle, valeur } })
    restaurer.push(() => ctx.db.parametre.delete({ where: { id: p.id } }))
  }
}
export async function restaurerParametres() {
  while (restaurer.length > 0) await restaurer.pop()?.()
}

let numDeclencheur = 0
/** Atomicité : déclencheur SQLite temporaire RAISE(ABORT) posé sur test.db, toujours supprimé (finally). */
export async function avecEchec<T>(ctx: Ctx, corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_p10_${String(++numDeclencheur)}_${String(next())}`
  await ctx.db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await ctx.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}
