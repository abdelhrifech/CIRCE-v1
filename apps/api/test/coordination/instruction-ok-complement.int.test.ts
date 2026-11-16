// COO-P02 — tests COMPLÉMENTAIRES de l'Instruction OK (instruction-ok.int.test.ts n'est pas dupliqué).
// Source de l'attendu : docs/COORDINATION_REGLES_METIER.md §2 (bloc 1), §3.2.c, RG-COO-001, 042 à 060, 133, 204,
// RG-X-064, RG-X-078 ; décisions et hypothèses : Q-204 (TRANCHÉE, option b), Q-183, Q-205, Q-206, Q-209,
// Q-219, Q-224, Q-225, Q-257, Q-375.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FicheDossierSchema, ListeDossiersSchema, type Role } from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import {
  evaluerInstructionOkAuto,
  rouvrirInstructionOk,
} from '../../src/modules/coordination/instruction-ok.ts'
import {
  integrerInstruction,
  integrerPreparation,
  type InstructionBroadcast,
} from '../../src/modules/coordination/integration.ts'
import type {
  StatutDossier,
  StatutInstruction,
  StatutReception,
} from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get, idem, site } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>
type Dossier = Awaited<ReturnType<typeof f.createDossier>>

/** Site + atelier + utilisateur des rôles donnés sur ce site (tous ses ateliers). */
async function contexte(roles: Role[] = ['coord']) {
  const s = await site(ctx, roles)
  const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
  return { ...s, atelier }
}

interface OptionsInstruction {
  statut?: StatutInstruction
  preparation?: StatutDossier
  dossier?: Dossier
  /** Nombre de lignes de détail (exceptions, Q-183 (1)). */
  exceptions?: number
  /** Type de chaque face (`entretien` exclu de la quantité, Q-183 (1)). */
  faces?: readonly (string | null)[]
  /** Pourcentages des visuels (même support, même type de préparation : null). */
  pct?: readonly (number | null)[]
  visuels?: { supportId: number | null; typePreparationId: number | null; pourcentage: number }[]
  commentaire?: string | null
  position?: number
}

/** Instruction conforme par défaut à la règle de Nariman (2 exceptions, 2 faces, visuel à 100 %). */
async function instruction(atelierId: number | null, o: OptionsInstruction = {}) {
  const dossier =
    o.dossier ?? (await f.createDossier(db, { statut: o.preparation ?? 'PREPARATION_RECUE' }))
  const i = await f.createInstruction(db, {
    atelierId,
    statut: o.statut ?? 'EN_COURS',
    dossierId: dossier.id,
    contNum: dossier.contNum,
    contAnbas: 2026,
    contSembas: 46,
    commentaire: o.commentaire ?? null,
    entretien: 8,
    tipInsCode: o.position ?? 0,
  })
  for (let k = 0; k < (o.exceptions ?? 2); k++)
    await f.createInstructionDetail(db, { instructionCode: i.code, cadrIdent: k })
  for (const ftType of o.faces ?? ['contrat', 'contrat'])
    await f.createFaceTrain(db, { instructionCode: i.code, ftType, statut: 'EN_COURS' })
  for (const v of o.visuels ?? (o.pct ?? [100]).map((p) => ({ pourcentage: p })))
    await f.createInstructionVisuel(db, { instructionCode: i.code, ...v })
  return { dossier, i }
}

const lire = (code: string) => db.instruction.findUniqueOrThrow({ where: { code } })
const historiques = (entiteId: string | number) =>
  db.statutHistorique.findMany({ where: { entiteId: String(entiteId) }, orderBy: { id: 'asc' } })
const journaux = (entiteId: string | number) =>
  db.journalAudit.findMany({ where: { entiteId: String(entiteId) }, orderBy: { id: 'asc' } })
const lireLigne = (id: number) => db.receptionAttendue.findUniqueOrThrow({ where: { id } })
const historiquesLigne = (id: number) =>
  db.statutHistorique.findMany({
    where: { typeEntite: 'LIGNE_ATTENDUE', entiteId: String(id) },
  })

const iok = (
  h: Headers,
  instructions: { code: string; version: number }[],
  cle: Headers = idem(),
) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/coordination/instruction-ok',
    headers: { ...h, ...cle },
    payload: { instructions },
  })
const patch = (h: Headers, code: string, payload: object) =>
  ctx.app.inject({
    method: 'PATCH',
    url: `/api/coordination/instructions/${code}`,
    headers: h,
    payload,
  })
const versionBc = (h: Headers, dossierId: number, version: number, cle: Headers = idem()) =>
  ctx.app.inject({
    method: 'POST',
    url: `/api/coordination/dossiers/${String(dossierId)}/version-broadcast`,
    headers: { ...h, ...cle },
    payload: { version },
  })
const correction = (h: Headers, dossierId: number, note: string, cle: Headers = idem()) =>
  ctx.app.inject({
    method: 'POST',
    url: `/api/coordination/dossiers/${String(dossierId)}/corrections`,
    headers: { ...h, ...cle },
    payload: { note },
  })

/** Dossier « En cours » avec une ligne attendue en écart (qte_BC − qte_prépa) sur le site de `c`. */
async function dossierAvecEcart(c: Awaited<ReturnType<typeof contexte>>, qteBc = 10, qtePrepa = 8) {
  const { dossier, i } = await instruction(c.atelier.id)
  const ligne = await f.createReceptionAttendue(db, {
    plateformeId: c.plateforme.id,
    supportId: c.support.id,
    contNum: dossier.contNum,
    qteBc,
    qtePrepa,
    source: 'PREPA',
  })
  return { dossier, i, ligne }
}

const liste = async (h: Headers, query = '') =>
  ListeDossiersSchema.parse(
    (await get(ctx, `/api/coordination/dossiers?pageSize=100${query}`, h)).json(),
  )

let numDeclencheur = 0
/** Atomicité : déclencheur SQLite temporaire RAISE(ABORT) sur test.db, toujours supprimé (finally). */
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_iok_${String(++numDeclencheur)}_${String(f.next())}`
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

const broadcast = (d: Partial<InstructionBroadcast> = {}): InstructionBroadcast => ({
  code: `IOKC${String(f.next()).padStart(10, '0')}`,
  type: 'contrat',
  contNum: 700_000 + (f.next() % 100_000_000),
  semaine: { annee: 2026, semaine: 46 },
  atelierId: null,
  annonceur: 'BROADCAST',
  commentaire: null,
  sectCodeCentre: 1,
  talrTrait: '1',
  ...d,
})

/** Utilisateur limité à UN atelier d'un site. */
async function utilisateurAtelier(roles: Role[], plateformeId: number, atelierId: number) {
  const user = await f.createUtilisateurAvecRoles(db, roles, [{ plateformeId, atelierId }])
  return { user, headers: devHeaders(user.identifiantExterne) }
}

const REFUS = [
  ['cheq', 'RG-COO-165'],
  ['recep', 'RG-COO-165'],
  ['expe', 'RG-COO-165'],
  ['com', 'RG-COO-168'],
] as const

// ───────────────────────────── droits (§2 bloc 1) ─────────────────────────────

describe('RG-COO-165 / 166 / 168 matrice des droits COO-P02 : 6 profils sur chaque route d’écriture', () => {
  it.each(REFUS)(
    'RG-COO-044 Instruction OK : le profil %s est refusé (403 PERMISSION citant %s), rien n’est écrit ni réservé',
    async (role, regle) => {
      const c = await contexte([role])
      const { i } = await instruction(c.atelier.id)
      const r = await iok(c.headers, [{ code: i.code, version: i.version }])
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle })
      expect(await lire(i.code)).toMatchObject({
        statut: 'EN_COURS',
        version: i.version,
        iokMode: null,
        iokLe: null,
      })
      expect(await historiques(i.code)).toHaveLength(0)
      expect(await journaux(i.code)).toHaveLength(0)
      expect(await db.cleIdempotence.count({ where: { utilisateurId: c.user.id } })).toBe(0)
    },
  )

  it.each(REFUS)(
    'RG-COO-048 / 050 PATCH instruction : le profil %s est refusé (403 citant %s), entretien et position inchangés',
    async (role, regle) => {
      const c = await contexte([role])
      const { i } = await instruction(c.atelier.id)
      const r = await patch(c.headers, i.code, { version: i.version, entretien: 12, position: 1 })
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle })
      expect(await lire(i.code)).toMatchObject({ entretien: 8, tipInsCode: 0, version: i.version })
      expect(await journaux(i.code)).toHaveLength(0)
    },
  )

  it('RG-COO-048 / 050 PATCH instruction : le profil admin modifie entretien, position et annonceur (200)', async () => {
    const c = await contexte(['admin'])
    const { i } = await instruction(c.atelier.id)
    const r = await patch(c.headers, i.code, {
      version: i.version,
      entretien: 15,
      position: 2,
      annonceur: 'ADMIN',
    })
    expect(r.statusCode).toBe(200)
    expect(await lire(i.code)).toMatchObject({
      entretien: 15,
      tipInsCode: 2,
      annonceur: 'ADMIN',
      version: i.version + 1,
      updatedById: c.user.id,
    })
    expect(await journaux(i.code)).toHaveLength(3)
  })

  it.each(REFUS)(
    'RG-COO-056 Appliquer la version Broadcast : le profil %s est refusé (403 citant %s), quantités et version du dossier inchangées',
    async (role, regle) => {
      const c = await contexte([role])
      const x = await dossierAvecEcart(c)
      const r = await versionBc(c.headers, x.dossier.id, x.dossier.version)
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle })
      expect(await lireLigne(x.ligne.id)).toMatchObject({ qtePrepa: 8, version: x.ligne.version })
      expect((await db.dossier.findUniqueOrThrow({ where: { id: x.dossier.id } })).version).toBe(
        x.dossier.version,
      )
      expect(await journaux(x.dossier.contNum)).toHaveLength(0)
    },
  )

  it('RG-COO-056 Appliquer la version Broadcast : le profil admin est autorisé (200)', async () => {
    const c = await contexte(['admin'])
    const x = await dossierAvecEcart(c)
    const r = await versionBc(c.headers, x.dossier.id, x.dossier.version)
    expect(r.statusCode).toBe(200)
    expect((await lireLigne(x.ligne.id)).qtePrepa).toBe(10)
  })

  it.each(REFUS)(
    'RG-COO-057 Demander une correction : le profil %s est refusé (403 citant %s), aucune demande ni journal',
    async (role, regle) => {
      const c = await contexte([role])
      const { dossier } = await instruction(c.atelier.id)
      const r = await correction(c.headers, dossier.id, 'à corriger')
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle })
      expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(0)
      expect(await journaux(dossier.contNum)).toHaveLength(0)
    },
  )

  it('RG-COO-057 Demander une correction : le profil admin est autorisé (200), demande tracée à son nom', async () => {
    const c = await contexte(['admin'])
    const { dossier } = await instruction(c.atelier.id)
    expect((await correction(c.headers, dossier.id, 'note admin')).statusCode).toBe(200)
    expect(
      await db.demandeCorrection.findFirstOrThrow({ where: { dossierId: dossier.id } }),
    ).toMatchObject({ parId: c.user.id, note: 'note admin', statut: 'ENVOYEE' })
  })

  it.each([
    ['instruction-ok', 'POST'],
    ['PATCH instruction', 'PATCH'],
    ['version-broadcast', 'POST'],
    ['corrections', 'POST'],
  ] as const)('RG-COO-165 %s sans identité : 401, rien n’est écrit', async (route, method) => {
    const c = await contexte()
    const x = await dossierAvecEcart(c)
    const url =
      route === 'instruction-ok'
        ? '/api/coordination/instruction-ok'
        : route === 'PATCH instruction'
          ? `/api/coordination/instructions/${x.i.code}`
          : `/api/coordination/dossiers/${String(x.dossier.id)}/${route}`
    const payload =
      route === 'instruction-ok'
        ? { instructions: [{ code: x.i.code, version: x.i.version }] }
        : route === 'PATCH instruction'
          ? { version: x.i.version, entretien: 12 }
          : route === 'version-broadcast'
            ? { version: x.dossier.version }
            : { note: 'x' }
    const r = await ctx.app.inject({ method, url, headers: idem(), payload })
    expect(r.statusCode).toBe(401)
    expect(await lire(x.i.code)).toMatchObject({ statut: 'EN_COURS', version: x.i.version })
    expect((await lireLigne(x.ligne.id)).qtePrepa).toBe(8)
    expect(await db.demandeCorrection.count({ where: { dossierId: x.dossier.id } })).toBe(0)
  })

  it('RG-COO-165 cumul de rôles cheq + coord : l’Instruction OK est autorisée (droit du rôle coord)', async () => {
    const c = await contexte(['cheq', 'coord'])
    const { i } = await instruction(c.atelier.id)
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
  })
})

// ───────────────────────────── transitions et saisies interdites ─────────────────────────────

describe('RG-COO-040 / 047 / 048 / 050 / 054 / 062 transitions et saisies interdites (409)', () => {
  it.each([
    ['A_TRAITER', 'RG-COO-050'],
    ['ANNULE', 'RG-COO-050'],
    ['ERREUR', 'RG-COO-050'],
    ['PRET_A_PRODUIRE', 'RG-COO-047'],
  ] as const)(
    'RG-COO-050 position non modifiable sur une instruction %s (409 citant %s), rien n’est écrit',
    async (statut, regle) => {
      const c = await contexte()
      const { i } = await instruction(c.atelier.id, { statut })
      const r = await patch(c.headers, i.code, { version: i.version, position: 1 })
      expect(r.statusCode).toBe(409)
      expect(erreur(r).regle).toBe(regle)
      expect(await lire(i.code)).toMatchObject({ tipInsCode: 0, version: i.version })
      expect(await journaux(i.code)).toHaveLength(0)
    },
  )

  it.each([
    ['ANNULE', 'RG-COO-048'],
    ['ERREUR', 'RG-COO-048'],
    ['PRET_A_PRODUIRE', 'RG-COO-047'],
  ] as const)(
    'RG-COO-048 entretien non modifiable sur une instruction %s (409 citant %s)',
    async (statut, regle) => {
      const c = await contexte()
      const { i } = await instruction(c.atelier.id, { statut })
      const r = await patch(c.headers, i.code, { version: i.version, entretien: 15 })
      expect(r.statusCode).toBe(409)
      expect(erreur(r).regle).toBe(regle)
      expect((await lire(i.code)).entretien).toBe(8)
    },
  )

  it('RG-COO-047 annonceur figé sur une instruction PRET_A_PRODUIRE (409), faces inchangées', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { statut: 'PRET_A_PRODUIRE' })
    const faces = await db.faceTrain.findMany({ where: { instructionCode: i.code } })
    const r = await patch(c.headers, i.code, { version: i.version, annonceur: 'AUTRE' })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_INSTRUCTION_FIGEE', regle: 'RG-COO-047' })
    expect(await db.faceTrain.findMany({ where: { instructionCode: i.code } })).toEqual(faces)
  })

  it('RG-COO-047 un champ figé modifié avec le commentaire : 409, le commentaire n’est pas enregistré non plus', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { statut: 'INSTRUCTION_OK' })
    const r = await patch(c.headers, i.code, {
      version: i.version,
      commentaire: 'note',
      entretien: 12,
    })
    expect(r.statusCode).toBe(409)
    expect(await lire(i.code)).toMatchObject({ commentaire: null, entretien: 8 })
  })

  it('RG-COO-047 renvoyer la MÊME valeur d’un champ figé n’est pas une modification : 200 en Instruction OK', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { statut: 'INSTRUCTION_OK' })
    const r = await patch(c.headers, i.code, {
      version: i.version,
      entretien: 8,
      position: 0,
      commentaire: 'vu',
    })
    expect(r.statusCode).toBe(200)
    expect(await lire(i.code)).toMatchObject({ statut: 'INSTRUCTION_OK', commentaire: 'vu' })
  })

  async function reouvertureRefusee(statut: StatutInstruction) {
    const { i } = await instruction((await f.createAtelier(db)).id, { statut })
    await expect(
      withTransaction(db, (tx) => rouvrirInstructionOk(tx, i.code)),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'TRANSITION_INTERDITE', regle: 'RG-COO-054' })
    expect(await lire(i.code)).toMatchObject({ statut, version: i.version })
    expect(await historiques(i.code)).toHaveLength(0)
  }

  it.each([['EN_COURS'], ['ANNULE'], ['PRET_A_PRODUIRE']] as const)(
    'RG-COO-054 réouverture d’une instruction %s (pas INSTRUCTION_OK) : 409 TRANSITION_INTERDITE citant RG-COO-054, rien n’est écrit',
    (statut) => reouvertureRefusee(statut),
  )

  // Anomalie corrigée (ANO-022 / 023 / 024, test-engineer COO-P02).
  it.each([['A_TRAITER'], ['ERREUR']] as const)(
    'RG-COO-054 réouverture d’une instruction %s (pas INSTRUCTION_OK) : 409 TRANSITION_INTERDITE citant RG-COO-054, rien n’est écrit',
    (statut) => reouvertureRefusee(statut),
  )

  it('RG-COO-062 Instruction OK d’une instruction « En cours » d’un dossier annulé : 409 citant RG-COO-062', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { preparation: 'ANNULE' })
    const r = await iok(c.headers, [{ code: i.code, version: i.version }])
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-062')
    expect((await lire(i.code)).statut).toBe('EN_COURS')
  })

  it('RG-COO-062 Appliquer la version Broadcast sur un dossier annulé : 409 citant RG-COO-062, lignes inchangées', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id, { preparation: 'ANNULE' })
    const ligne = await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 8,
      source: 'PREPA',
    })
    const r = await versionBc(c.headers, dossier.id, dossier.version)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-062')
    expect((await lireLigne(ligne.id)).qtePrepa).toBe(8)
  })

  it('RG-COO-044 la même instruction deux fois dans la sélection : 409 (version), rien n’est écrit', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await iok(c.headers, [
      { code: i.code, version: i.version },
      { code: i.code, version: i.version },
    ])
    expect(r.statusCode).toBe(409)
    expect(await lire(i.code)).toMatchObject({ statut: 'EN_COURS', version: i.version })
    expect(await historiques(i.code)).toHaveLength(0)
  })

  it('RG-COO-044 une instruction inconnue dans la sélection : 404, l’autre instruction reste « En cours »', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await iok(c.headers, [
      { code: i.code, version: i.version },
      { code: 'INCONNUE00000001', version: 1 },
    ])
    expect(r.statusCode).toBe(404)
    expect((await lire(i.code)).statut).toBe('EN_COURS')
  })

  it('RG-COO-044 sélection vide : 400', async () => {
    const c = await contexte()
    expect((await iok(c.headers, [])).statusCode).toBe(400)
  })

  it.each([
    ['A_TRAITER', 'PREPARATION_RECUE'],
    ['INSTRUCTION_OK', 'PREPARATION_RECUE'],
    ['ANNULE', 'PREPARATION_RECUE'],
    ['PRET_A_PRODUIRE', 'PREPARATION_RECUE'],
    ['ERREUR', 'PREPARATION_RECUE'],
    ['EN_COURS', 'A_TRAITER'],
    ['EN_COURS', 'ANNULE'],
  ] as const)(
    'RG-COO-042 / 052 l’automatisme ne s’applique pas à une instruction %s (dossier %s) : rien n’est écrit',
    async (statut, preparation) => {
      const { i } = await instruction((await f.createAtelier(db)).id, { statut, preparation })
      expect(await withTransaction(db, (tx) => evaluerInstructionOkAuto(tx, i.code))).toBe(
        'NON_APPLICABLE',
      )
      expect(await lire(i.code)).toMatchObject({ statut, version: i.version })
      expect(await historiques(i.code)).toHaveLength(0)
    },
  )
})

// ───────────────────────────── version et idempotence ─────────────────────────────

describe('RG-COO-044 / 047 / 056 / 057 version et idempotence', () => {
  it('RG-COO-044 deux Instruction OK simultanées avec la même version : une réussit, l’autre 409, un seul historique', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const [a, b] = await Promise.all([
      iok(c.headers, [{ code: i.code, version: i.version }]),
      iok(c.headers, [{ code: i.code, version: i.version }]),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect((await lire(i.code)).version).toBe(i.version + 1)
    expect(await historiques(i.code)).toHaveLength(1)
  })

  it('RG-COO-044 rejeu de la même Idempotency-Key (même corps) : même réponse, marquée rejouée, une seule écriture', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const cle = idem()
    const a = await iok(c.headers, [{ code: i.code, version: i.version }], cle)
    // COO-P09 : l'Instruction OK écrit aussi le calcul des trains (CALCUL_TRAINS, RG-COO-200 à 205).
    const apresPremier = await journaux(i.code)
    const b = await iok(c.headers, [{ code: i.code, version: i.version }], cle)
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
    expect(b.json()).toEqual(a.json())
    expect(b.headers['idempotent-replayed']).toBe('true')
    expect(await historiques(i.code)).toHaveLength(1)
    expect(apresPremier.map((j) => j.action)).toEqual(['INSTRUCTION_OK', 'CALCUL_TRAINS'])
    expect(await journaux(i.code)).toEqual(apresPremier)
  })

  it('RG-COO-044 même Idempotency-Key avec un autre corps : 409 COO_IDEMPOTENCE_CONFLIT, la 2e instruction reste « En cours »', async () => {
    const c = await contexte()
    const x = await instruction(c.atelier.id)
    const y = await instruction(c.atelier.id)
    const cle = idem()
    expect((await iok(c.headers, [{ code: x.i.code, version: x.i.version }], cle)).statusCode).toBe(
      200,
    )
    const r = await iok(c.headers, [{ code: y.i.code, version: y.i.version }], cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect((await lire(y.i.code)).statut).toBe('EN_COURS')
  })

  it('RG-COO-044 Idempotency-Key absent : 400, rien n’est écrit', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await iok(c.headers, [{ code: i.code, version: i.version }], {})
    expect(r.statusCode).toBe(400)
    expect(erreur(r).code).toBe('IDEMPOTENCE_CLE_MANQUANTE')
    expect((await lire(i.code)).statut).toBe('EN_COURS')
  })

  it('RG-COO-043 / 044 un refus (422) ne réserve pas la clé : après correction, la même clé applique l’Instruction OK', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { pct: [90] })
    const cle = idem()
    expect((await iok(c.headers, [{ code: i.code, version: i.version }], cle)).statusCode).toBe(422)
    await db.instructionVisuel.updateMany({
      where: { instructionCode: i.code },
      data: { pourcentage: 100 },
    })
    const r = await iok(c.headers, [{ code: i.code, version: i.version }], cle)
    expect(r.statusCode).toBe(200)
    expect(r.headers['idempotent-replayed']).toBeUndefined()
    expect((await lire(i.code)).statut).toBe('INSTRUCTION_OK')
  })

  it('RG-COO-048 deux PATCH simultanés avec la même version : un réussit, l’autre 409 COO_CONFLIT_VERSION', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const [a, b] = await Promise.all([
      patch(c.headers, i.code, { version: i.version, entretien: 10 }),
      patch(c.headers, i.code, { version: i.version, entretien: 20 }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    const perdant = a.statusCode === 409 ? a : b
    expect(erreur(perdant).code).toBe('COO_CONFLIT_VERSION')
    expect((await lire(i.code)).version).toBe(i.version + 1)
    expect(await journaux(i.code)).toHaveLength(1)
  })

  it('RG-COO-048 PATCH avec une version périmée : 409, rien n’est écrit', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await patch(c.headers, i.code, { version: i.version - 1, entretien: 10 })
    expect(r.statusCode).toBe(409)
    expect(await lire(i.code)).toMatchObject({ entretien: 8, version: i.version })
  })

  it('RG-COO-056 deux « Appliquer la version Broadcast » simultanés : un réussit, l’autre 409, un seul journal', async () => {
    const c = await contexte()
    const x = await dossierAvecEcart(c)
    const [a, b] = await Promise.all([
      versionBc(c.headers, x.dossier.id, x.dossier.version),
      versionBc(c.headers, x.dossier.id, x.dossier.version),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(
      (await journaux(x.dossier.contNum)).filter(
        (j) => j.action === 'APPLICATION_VERSION_BROADCAST',
      ),
    ).toHaveLength(1)
  })

  it('RG-COO-056 rejeu de la même Idempotency-Key : réponse rejouée, une seule application', async () => {
    const c = await contexte()
    const x = await dossierAvecEcart(c)
    const cle = idem()
    const a = await versionBc(c.headers, x.dossier.id, x.dossier.version, cle)
    const b = await versionBc(c.headers, x.dossier.id, x.dossier.version, cle)
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
    expect(b.json()).toEqual(a.json())
    expect(b.headers['idempotent-replayed']).toBe('true')
    expect((await db.dossier.findUniqueOrThrow({ where: { id: x.dossier.id } })).version).toBe(
      x.dossier.version + 1,
    )
    expect(await journaux(x.dossier.contNum)).toHaveLength(1)
  })

  it('RG-COO-056 même Idempotency-Key avec une autre version : 409 COO_IDEMPOTENCE_CONFLIT', async () => {
    const c = await contexte()
    const x = await dossierAvecEcart(c)
    const cle = idem()
    expect((await versionBc(c.headers, x.dossier.id, x.dossier.version, cle)).statusCode).toBe(200)
    const r = await versionBc(c.headers, x.dossier.id, x.dossier.version + 1, cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
  })

  it('RG-COO-057 rejeu de la même Idempotency-Key : une seule demande enregistrée', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    const cle = idem()
    const a = await correction(c.headers, dossier.id, 'thème B', cle)
    const b = await correction(c.headers, dossier.id, 'thème B', cle)
    expect(b.json()).toEqual(a.json())
    expect(b.headers['idempotent-replayed']).toBe('true')
    expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(1)
  })

  it('RG-COO-057 même Idempotency-Key avec une autre note : 409, une seule demande', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    const cle = idem()
    expect((await correction(c.headers, dossier.id, 'première', cle)).statusCode).toBe(200)
    const r = await correction(c.headers, dossier.id, 'seconde', cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(1)
  })

  it('RG-COO-057 Idempotency-Key absent : 400, aucune demande', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    expect((await correction(c.headers, dossier.id, 'x', {})).statusCode).toBe(400)
    expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(0)
  })
})

// ───────────────────────────── atomicité ─────────────────────────────

describe('RG-COO-044 / 051 / 054 / 056 / 057 / 042 atomicité (échec simulé par déclencheur SQLite)', () => {
  it('RG-COO-051 échec au milieu de l’action groupée (2e instruction) : aucune instruction passée, aucun historique ni journal, clé rejouable', async () => {
    const c = await contexte()
    const x = await instruction(c.atelier.id)
    const y = await instruction(c.atelier.id)
    const z = await instruction(c.atelier.id)
    const sel = [x, y, z].map((v) => ({ code: v.i.code, version: v.i.version }))
    const cle = idem()
    const r = await avecEchec(
      `BEFORE UPDATE ON instruction_train WHEN OLD.instr_code = '${y.i.code}'`,
      () => iok(c.headers, sel, cle),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    for (const v of [x, y, z]) {
      expect(await lire(v.i.code)).toMatchObject({
        statut: 'EN_COURS',
        version: v.i.version,
        iokMode: null,
      })
      expect(await historiques(v.i.code)).toHaveLength(0)
      expect(await journaux(v.i.code)).toHaveLength(0)
    }
    const ok = await iok(c.headers, sel, cle)
    expect(ok.statusCode).toBe(200)
    expect(ok.headers['idempotent-replayed']).toBeUndefined()
  })

  it('RG-COO-044 échec de l’écriture de l’historique de la 2e instruction : la 1re reste « En cours »', async () => {
    const c = await contexte()
    const x = await instruction(c.atelier.id)
    const y = await instruction(c.atelier.id)
    const r = await avecEchec(
      `BEFORE INSERT ON statut_historique WHEN NEW.entite_id = '${y.i.code}'`,
      () =>
        iok(c.headers, [
          { code: x.i.code, version: x.i.version },
          { code: y.i.code, version: y.i.version },
        ]),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await lire(x.i.code)).statut).toBe('EN_COURS')
    expect(await historiques(x.i.code)).toHaveLength(0)
  })

  it.each([
    ['la 2e ligne attendue', 'tf_prepa_affiche'],
    ['l’historique de statut de la 1re ligne', 'statut_historique'],
    ['le journal du dossier', 'journal_audit'],
  ] as const)(
    'RG-COO-056 échec au milieu de « Appliquer la version Broadcast » (%s) : quantités, statuts, version du dossier et historiques inchangés',
    async (_cas, table) => {
      const c = await contexte()
      const { dossier } = await instruction(c.atelier.id)
      const l1 = await f.createReceptionAttendue(db, {
        plateformeId: c.plateforme.id,
        contNum: dossier.contNum,
        qteBc: 10,
        qtePrepa: 8,
        source: 'PREPA',
        statut: 'COMPLETE',
      })
      const l2 = await f.createReceptionAttendue(db, {
        plateformeId: c.plateforme.id,
        contNum: dossier.contNum,
        qteBc: 6,
        qtePrepa: 5,
        source: 'PREPA',
      })
      const a = await f.createAffiche(db, { plateformeId: c.plateforme.id })
      await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l1.id, quantite: 8 })
      const corps =
        table === 'tf_prepa_affiche'
          ? `BEFORE UPDATE ON tf_prepa_affiche WHEN OLD.id = ${String(l2.id)}`
          : table === 'statut_historique'
            ? `BEFORE INSERT ON statut_historique WHEN NEW.type_entite = 'LIGNE_ATTENDUE' AND NEW.entite_id = '${String(l1.id)}'`
            : `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(dossier.contNum)}'`
      const cle = idem()
      const r = await avecEchec(corps, () => versionBc(c.headers, dossier.id, dossier.version, cle))
      expect(r.statusCode).toBeGreaterThanOrEqual(500)
      expect(await lireLigne(l1.id)).toMatchObject({
        qtePrepa: 8,
        statut: 'COMPLETE',
        version: l1.version,
      })
      expect(await lireLigne(l2.id)).toMatchObject({ qtePrepa: 5, version: l2.version })
      expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).version).toBe(
        dossier.version,
      )
      expect(await historiquesLigne(l1.id)).toHaveLength(0)
      expect(await journaux(dossier.contNum)).toHaveLength(0)
      expect(await db.cleIdempotence.count({ where: { utilisateurId: c.user.id } })).toBe(0)
    },
  )

  it('RG-COO-047 échec de la répercussion de l’annonceur sur les faces : annonceur et version de l’instruction inchangés', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await avecEchec(
      `BEFORE UPDATE ON tf_face_train WHEN OLD.instr_code = '${i.code}'`,
      () => patch(c.headers, i.code, { version: i.version, annonceur: 'NOUVEAU' }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await lire(i.code)).toMatchObject({ annonceur: null, version: i.version })
    expect(await journaux(i.code)).toHaveLength(0)
  })

  it('RG-COO-057 échec du journal : aucune demande de correction enregistrée', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(dossier.contNum)}'`,
      () => correction(c.headers, dossier.id, 'x'),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(0)
  })

  it('RG-COO-042 échec du journal de l’Instruction OK automatique : la prépa n’est pas intégrée (dossier À traiter, instruction En cours)', async () => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      preparation: 'A_TRAITER',
    })
    await expect(
      avecEchec(
        `BEFORE INSERT ON journal_audit WHEN NEW.action = 'INSTRUCTION_OK_AUTOMATIQUE' AND NEW.entite_id = '${i.code}'`,
        () => withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum)),
      ),
    ).rejects.toThrow()
    expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).statut).toBe(
      'A_TRAITER',
    )
    expect(await lire(i.code)).toMatchObject({ statut: 'EN_COURS', iokMode: null })
    expect(await historiques(dossier.contNum)).toHaveLength(0)
  })

  it('RG-COO-054 échec de l’historique de la réouverture : Instruction OK, marque et calcul des trains conservés', async () => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      statut: 'INSTRUCTION_OK',
      commentaire: 'à contrôler',
    })
    await db.instruction.update({
      where: { code: i.code },
      data: { iokMode: 'MANUEL', iokLe: new Date() },
    })
    await f.createFaceTrain(db, {
      instructionCode: i.code,
      ftType: 'entretien',
      statut: 'INSTRUCTION_OK',
      theme: 'T',
    })
    const faces = await db.faceTrain.findMany({
      where: { instructionCode: i.code },
      orderBy: { id: 'asc' },
    })
    await expect(
      avecEchec(
        `BEFORE INSERT ON statut_historique WHEN NEW.entite_id = '${i.code}' AND NEW.regle = 'RG-COO-054'`,
        () => withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum)),
      ),
    ).rejects.toThrow()
    expect(await lire(i.code)).toMatchObject({ statut: 'INSTRUCTION_OK', iokMode: 'MANUEL' })
    expect(
      await db.faceTrain.findMany({ where: { instructionCode: i.code }, orderBy: { id: 'asc' } }),
    ).toEqual(faces)
  })
})

// ───────────────────────────── valeurs limites ─────────────────────────────

describe('RG-COO-043 / 048 / 050 / 042 / 055 valeurs limites', () => {
  it.each([[0], [30]])('RG-COO-048 entretien %i (borne) accepté « En cours »', async (v) => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    expect((await patch(c.headers, i.code, { version: i.version, entretien: v })).statusCode).toBe(
      200,
    )
    expect((await lire(i.code)).entretien).toBe(v)
  })

  it('RG-COO-048 entretien non entier (12,5) : refusé, valeur inchangée', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await patch(c.headers, i.code, { version: i.version, entretien: 12.5 })
    expect([400, 422]).toContain(r.statusCode)
    expect((await lire(i.code)).entretien).toBe(8)
  })

  it.each([
    [0, 2],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ])('RG-COO-050 position %i acceptée « En cours » (depuis %i), journalisée', async (v, depuis) => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { position: depuis })
    expect((await patch(c.headers, i.code, { version: i.version, position: v })).statusCode).toBe(
      200,
    )
    expect((await lire(i.code)).tipInsCode).toBe(v)
    expect(await journaux(i.code)).toMatchObject([
      { complement: 'position', ancienneValeur: String(depuis), nouvelleValeur: String(v) },
    ])
  })

  it('RG-COO-050 position -1 : 422 citant RG-COO-050', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await patch(c.headers, i.code, { version: i.version, position: -1 })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_POSITION_INCONNUE', regle: 'RG-COO-050' })
  })

  it.each([
    [[99.99], 422],
    [[100], 200],
    [[100.01], 422],
    [[33.33, 33.33, 33.34], 200],
    [[50, 49.99], 422],
    [[50, 50.01], 422],
  ] as const)('RG-COO-043 répartition %j : Instruction OK manuelle → %i', async (pct, attendu) => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { pct })
    const r = await iok(c.headers, [{ code: i.code, version: i.version }])
    expect(r.statusCode).toBe(attendu)
    if (attendu === 422) {
      expect(erreur(r)).toMatchObject({ code: 'COO_REPARTITION_INCOMPLETE', regle: 'RG-COO-043' })
      expect((await lire(i.code)).statut).toBe('EN_COURS')
    }
  })

  it('RG-COO-043 répartition par (support, type de préparation) : deux couples à 100 % → Instruction OK permise', async () => {
    const c = await contexte()
    const s2 = await f.createSupport(db)
    const tp = await f.createTypePreparation(db)
    const { i } = await instruction(c.atelier.id, {
      visuels: [
        { supportId: c.support.id, typePreparationId: tp.id, pourcentage: 60 },
        { supportId: c.support.id, typePreparationId: tp.id, pourcentage: 40 },
        { supportId: s2.id, typePreparationId: tp.id, pourcentage: 100 },
      ],
    })
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
  })

  it('RG-COO-043 un couple (support, type) à 100 % et l’autre à 99,99 % : 422', async () => {
    const c = await contexte()
    const s2 = await f.createSupport(db)
    const { i } = await instruction(c.atelier.id, {
      visuels: [
        { supportId: c.support.id, typePreparationId: null, pourcentage: 100 },
        { supportId: s2.id, typePreparationId: null, pourcentage: 99.99 },
      ],
    })
    const r = await iok(c.headers, [{ code: i.code, version: i.version }])
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-043')
  })

  it('RG-COO-043 même support, deux types de préparation à 50 % chacun : 422 (chaque couple doit faire 100 %)', async () => {
    const c = await contexte()
    const t1 = await f.createTypePreparation(db)
    const t2 = await f.createTypePreparation(db)
    const { i } = await instruction(c.atelier.id, {
      visuels: [
        { supportId: c.support.id, typePreparationId: t1.id, pourcentage: 50 },
        { supportId: c.support.id, typePreparationId: t2.id, pourcentage: 50 },
      ],
    })
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(422)
  })

  it('RG-COO-043 instruction sans visuel : répartition conforme (HYPOTHÈSE Q-183 (2)), Instruction OK permise', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { pct: [] })
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
  })

  it.each([
    ['100,01 %', { pct: [100.01] }, 'EN_COURS'],
    ['99,99 %', { pct: [99.99] }, 'EN_COURS'],
    ['exceptions = quantité + 1', { exceptions: 3, faces: ['contrat', 'contrat'] }, 'EN_COURS'],
    [
      'quantité = exceptions + 1',
      { exceptions: 2, faces: ['contrat', 'contrat', 'contrat'] },
      'EN_COURS',
    ],
    [
      'faces d’entretien hors quantité (2 = 2 + 1 entretien)',
      { exceptions: 2, faces: ['contrat', 'contrat', 'entretien'] },
      'INSTRUCTION_OK',
    ],
    [
      'face sans type comptée dans la quantité',
      { exceptions: 2, faces: ['contrat', null] },
      'INSTRUCTION_OK',
    ],
    ['0 exception = 0 face (HYPOTHÈSE Q-183 (1))', { exceptions: 0, faces: [] }, 'INSTRUCTION_OK'],
  ] as const)('RG-COO-042 à l’arrivée de la prépa, %s → %s', async (_cas, o, attendu) => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      ...o,
      preparation: 'A_TRAITER',
    })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await lire(i.code)).statut).toBe(attendu)
  })

  it.each([
    ['écart +1 (qte_BC 10, qte_prépa 9)', [[10, 9, 'ACTIVE', false]], 'EN_COURS'],
    ['écart −1 (qte_BC 10, qte_prépa 11)', [[10, 11, 'ACTIVE', false]], 'EN_COURS'],
    ['quantités égales', [[10, 10, 'ACTIVE', false]], 'INSTRUCTION_OK'],
    [
      'écart sur une ligne exclue « reste en place » (Q-209)',
      [[10, 0, 'ACTIVE', true]],
      'INSTRUCTION_OK',
    ],
    ['écart sur une ligne ANNULEE', [[10, 3, 'ANNULEE', false]], 'INSTRUCTION_OK'],
    ['aucune qte_prépa connue (écart null)', [[10, null, 'ACTIVE', false]], 'INSTRUCTION_OK'],
    [
      'écarts compensés au niveau du dossier (+2 −2, Q-183 (3))',
      [
        [10, 8, 'ACTIVE', false],
        [5, 7, 'ACTIVE', false],
      ],
      'INSTRUCTION_OK',
    ],
  ] as const)('RG-COO-055 / 042 %s → %s à l’arrivée de la prépa', async (_cas, lignes, attendu) => {
    // Q-183 (11) : l'écart d'une instruction se lit sur les lignes de la plateforme de son atelier.
    const atelier = await f.createAtelier(db)
    const { dossier, i } = await instruction(atelier.id, {
      preparation: 'A_TRAITER',
    })
    for (const [qteBc, qtePrepa, etatLigne, themeExclu] of lignes)
      await f.createReceptionAttendue(db, {
        plateformeId: atelier.plateformeId,
        contNum: dossier.contNum,
        qteBc,
        qtePrepa,
        etatLigne,
        themeExclu,
        source: 'PREPA',
      })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await lire(i.code)).statut).toBe(attendu)
  })

  it.each([
    [10, 9],
    [10, 11],
  ])(
    'RG-COO-056 écart limite (qte_BC %i, qte_prépa %i) : la version Broadcast est appliquée',
    async (qteBc, qtePrepa) => {
      const c = await contexte()
      const x = await dossierAvecEcart(c, qteBc, qtePrepa)
      const r = await versionBc(c.headers, x.dossier.id, x.dossier.version)
      expect(r.statusCode).toBe(200)
      expect((await lireLigne(x.ligne.id)).qtePrepa).toBe(qteBc)
    },
  )

  it('RG-COO-056 écart non calculable (aucune qte_prépa) : 409 COO_SANS_ECART, rien n’est écrit', async () => {
    const c = await contexte()
    const x = await dossierAvecEcart(c, 10, 8)
    await db.receptionAttendue.update({ where: { id: x.ligne.id }, data: { qtePrepa: null } })
    const r = await versionBc(c.headers, x.dossier.id, x.dossier.version)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_SANS_ECART', regle: 'RG-COO-056' })
  })

  it('RG-COO-055 l’écart du dossier est signé (−1 affiché) et ignore les lignes d’un autre dossier', async () => {
    const c = await contexte()
    const x = await dossierAvecEcart(c, 10, 11)
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: x.dossier.contNum + 100_000,
      qteBc: 50,
      qtePrepa: 1,
      source: 'PREPA',
    })
    const l = (await liste(c.headers, `&dossier=${String(x.dossier.contNum)}`)).items[0]
    expect(l?.ecart).toBe(-1)
    expect(l?.instructions[0]?.motifs).toContain('ECART')
  })
})

// ───────────────────────────── périmètre ─────────────────────────────

describe('RG-COO-167 périmètre site / atelier / admin sur les actions COO-P02', () => {
  it('RG-COO-167 utilisateur limité à un atelier : Instruction OK permise sur son atelier, 403 sur l’autre atelier du même site', async () => {
    const plateforme = await f.createPlateforme(db)
    const a1 = await f.createAtelier(db, { plateformeId: plateforme.id })
    const a2 = await f.createAtelier(db, { plateformeId: plateforme.id })
    const u = await utilisateurAtelier(['coord'], plateforme.id, a1.id)
    const ok = await instruction(a1.id)
    const ko = await instruction(a2.id)
    expect((await iok(u.headers, [{ code: ok.i.code, version: ok.i.version }])).statusCode).toBe(
      200,
    )
    const r = await iok(u.headers, [{ code: ko.i.code, version: ko.i.version }])
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'COO_PERIMETRE_INTERDIT', regle: 'RG-COO-167' })
    expect((await lire(ko.i.code)).statut).toBe('EN_COURS')
  })

  it('RG-COO-167 / 051 action groupée avec une instruction hors périmètre : 403, aucune instruction passée (tout ou rien)', async () => {
    const c = await contexte()
    const dedans = await instruction(c.atelier.id)
    const dehors = await instruction((await f.createAtelier(db)).id)
    const r = await iok(c.headers, [
      { code: dedans.i.code, version: dedans.i.version },
      { code: dehors.i.code, version: dehors.i.version },
    ])
    expect(r.statusCode).toBe(403)
    expect((await lire(dedans.i.code)).statut).toBe('EN_COURS')
    expect(await historiques(dedans.i.code)).toHaveLength(0)
  })

  it('RG-COO-167 admin : Instruction OK sur un autre site et sur une instruction sans atelier', async () => {
    const c = await contexte(['admin'])
    const autre = await instruction((await f.createAtelier(db)).id)
    const sansAtelier = await instruction(null)
    const r = await iok(c.headers, [
      { code: autre.i.code, version: autre.i.version },
      { code: sansAtelier.i.code, version: sansAtelier.i.version },
    ])
    expect(r.statusCode).toBe(200)
  })

  it('RG-COO-167 coord : instruction sans atelier refusée (403, HYPOTHÈSE Q-182 (1))', async () => {
    const c = await contexte()
    const { i } = await instruction(null)
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(403)
  })

  it('RG-COO-167 PATCH sur l’atelier hors périmètre : 403, rien n’est écrit ; admin d’un autre site : 200', async () => {
    const plateforme = await f.createPlateforme(db)
    const a1 = await f.createAtelier(db, { plateformeId: plateforme.id })
    const a2 = await f.createAtelier(db, { plateformeId: plateforme.id })
    const u = await utilisateurAtelier(['coord'], plateforme.id, a1.id)
    const { i } = await instruction(a2.id)
    const r = await patch(u.headers, i.code, { version: i.version, entretien: 12 })
    expect(r.statusCode).toBe(403)
    expect(await lire(i.code)).toMatchObject({ entretien: 8, version: i.version })
    const admin = await contexte(['admin'])
    expect(
      (await patch(admin.headers, i.code, { version: i.version, entretien: 12 })).statusCode,
    ).toBe(200)
  })

  it('RG-COO-167 version Broadcast : dossier sans instruction mais avec une ligne sur le site → autorisé', async () => {
    const c = await contexte()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const ligne = await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 8,
      source: 'PREPA',
    })
    expect((await versionBc(c.headers, dossier.id, dossier.version)).statusCode).toBe(200)
    expect((await lireLigne(ligne.id)).qtePrepa).toBe(10)
  })

  it('RG-COO-167 version Broadcast : dossier uniquement sur un autre site → 403, rien n’est écrit ; admin → 200', async () => {
    const c = await contexte()
    const autre = await contexte()
    const x = await dossierAvecEcart(autre)
    const r = await versionBc(c.headers, x.dossier.id, x.dossier.version)
    expect(r.statusCode).toBe(403)
    expect((await lireLigne(x.ligne.id)).qtePrepa).toBe(8)
    const admin = await contexte(['admin'])
    expect((await versionBc(admin.headers, x.dossier.id, x.dossier.version)).statusCode).toBe(200)
  })

  // Anomalie corrigée (ANO-022 / 023 / 024, test-engineer COO-P02).
  it('RG-COO-167 / RG-COO-056 version Broadcast d’un dossier sur deux sites : la ligne du site hors périmètre n’est pas modifiée', async () => {
    const c = await contexte()
    const ailleurs = await f.createPlateforme(db)
    const x = await dossierAvecEcart(c)
    const hors = await f.createReceptionAttendue(db, {
      plateformeId: ailleurs.id,
      contNum: x.dossier.contNum,
      qteBc: 5,
      qtePrepa: 2,
      source: 'PREPA',
    })
    await versionBc(c.headers, x.dossier.id, x.dossier.version)
    expect(await lireLigne(hors.id)).toMatchObject({ qtePrepa: 2, version: hors.version })
  })

  it('RG-COO-167 demande de correction hors périmètre : 403, aucune demande ; admin : 200', async () => {
    const c = await contexte()
    const autre = await contexte()
    const { dossier } = await instruction(autre.atelier.id)
    expect((await correction(c.headers, dossier.id, 'x')).statusCode).toBe(403)
    expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(0)
    const admin = await contexte(['admin'])
    expect((await correction(admin.headers, dossier.id, 'x')).statusCode).toBe(200)
  })

  it('RG-COO-167 fiche dossier : les lignes d’un autre site sont masquées au coord, visibles à l’admin', async () => {
    const c = await contexte()
    const ailleurs = await f.createPlateforme(db)
    const x = await dossierAvecEcart(c)
    const hors = await f.createReceptionAttendue(db, {
      plateformeId: ailleurs.id,
      contNum: x.dossier.contNum,
      qteBc: 5,
      qtePrepa: 5,
    })
    const fiche = (h: Headers) =>
      get(ctx, `/api/coordination/dossiers/${String(x.dossier.id)}`, h).then((r) =>
        FicheDossierSchema.parse(r.json()),
      )
    expect((await fiche(c.headers)).lignes.map((l) => l.id)).toEqual([x.ligne.id])
    const admin = await contexte(['admin'])
    expect((await fiche(admin.headers)).lignes.map((l) => l.id).sort()).toEqual(
      [x.ligne.id, hors.id].sort(),
    )
  })
})

// ───────────────────────────── RG-X-064 : état de la Réception ─────────────────────────────

const CAS_RECEPTION = [
  ['rien reçu', 10, 8, 0, 'ATTENDUE', 'ATTENDUE'],
  ['partiel qui reste partiel', 10, 8, 5, 'PARTIELLE', 'PARTIELLE'],
  ['complet qui devient partiel', 10, 8, 8, 'COMPLETE', 'PARTIELLE'],
  ['surplus qui devient complet', 10, 8, 10, 'SURPLUS', 'COMPLETE'],
  ['surplus qui devient complet à la borne (+10 %)', 10, 8, 11, 'SURPLUS', 'COMPLETE'],
  ['surplus qui reste surplus', 10, 8, 12, 'SURPLUS', 'SURPLUS'],
  [
    'partiel qui devient surplus (exemple RG-X-064 : 100 → 80, reçu 90)',
    80,
    100,
    90,
    'PARTIELLE',
    'SURPLUS',
  ],
  ['partiel qui devient complet', 8, 10, 8, 'PARTIELLE', 'COMPLETE'],
] as const
const ETATS_RECEPTION: readonly StatutReception[] = ['A_IDENTIFIER', 'A_CONTROLER', 'CONTROLEE']
const MATRICE_RECEPTION = CAS_RECEPTION.flatMap((c) =>
  ETATS_RECEPTION.map((etat) => [...c, etat] as const),
)

describe('RG-X-064 / RG-COO-056 « Appliquer la version Broadcast » et état de la Réception', () => {
  it.each(MATRICE_RECEPTION)(
    'RG-X-064 %s (qte_BC %i, qte_prépa %i, reçu %i) : %s → %s, réception %s ; stock, liens et validation inchangés',
    async (_cas, qteBc, qtePrepa, recu, avant, apres, etat) => {
      const c = await contexte()
      const { dossier } = await instruction(c.atelier.id)
      const ligne = await f.createReceptionAttendue(db, {
        plateformeId: c.plateforme.id,
        supportId: c.support.id,
        contNum: dossier.contNum,
        source: 'PREPA',
        qteBc,
        qtePrepa,
        statut: avant,
      })
      const reception = await f.createReception(db, { plateformeId: c.plateforme.id, statut: etat })
      const affiche = await f.createAffiche(db, {
        plateformeId: c.plateforme.id,
        supportId: c.support.id,
        receptionId: reception.id,
        contNum: dossier.contNum,
        quantite: Math.max(recu, 1),
      })
      await f.createMouvement(db, { afficheId: affiche.id, quantite: Math.max(recu, 1) })
      if (recu > 0)
        await f.createRattachement(db, {
          afficheId: affiche.id,
          ligneAttendueId: ligne.id,
          quantite: recu,
          mode: 'BL',
        })
      const instantane = async () => ({
        affiche: await db.affiche.findUniqueOrThrow({ where: { id: affiche.id } }),
        reception: await db.reception.findUniqueOrThrow({ where: { id: reception.id } }),
        mouvements: await db.mouvement.findMany({ where: { afficheId: affiche.id } }),
        liens: await db.afficheAttendue.findMany({ where: { afficheId: affiche.id } }),
      })
      const avantAction = await instantane()

      const r = await versionBc(c.headers, dossier.id, dossier.version)
      expect(r.statusCode).toBe(200)
      expect(await lireLigne(ligne.id)).toMatchObject({ qtePrepa: qteBc, statut: apres })
      const h = await historiquesLigne(ligne.id)
      if (apres === avant) expect(h).toHaveLength(0)
      else
        expect(h).toMatchObject([
          { ancien: avant, nouveau: apres, regle: 'RG-REC-018', parId: c.user.id },
        ])
      expect(await instantane()).toEqual(avantAction)
    },
  )
})

// ───────────────────────────── RG-COO-001 : indépendance de la validation admin ─────────────────────────────

describe('RG-COO-001 / RG-X-078 l’Instruction OK ne lit ni ne modifie la validation admin', () => {
  /** Dossier avec trois affiches : validée, à confirmer, orpheline. */
  async function affichesDuDossier(c: Awaited<ReturnType<typeof contexte>>, contNum: number) {
    const base = { plateformeId: c.plateforme.id, supportId: c.support.id, contNum }
    const validee = await f.createAffiche(db, {
      ...base,
      validationAdmin: true,
      validationAdminParId: c.user.id,
      validationAdminLe: new Date('2026-11-01'),
    })
    const aConfirmer = await f.createAffiche(db, { ...base, validationAdmin: false })
    const orpheline = await f.createAffiche(db, { ...base, statut: 'ORPHELINE' })
    const ids = [validee.id, aConfirmer.id, orpheline.id]
    const instantane = () =>
      db.affiche.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })
    return { instantane, avant: await instantane() }
  }

  it.each([[true], [false]])(
    'RG-COO-001 Instruction OK manuelle : même résultat que l’affiche soit validée ou non (%s) ; affiches intactes',
    async (validee) => {
      const c = await contexte()
      const { dossier, i } = await instruction(c.atelier.id, { commentaire: 'à contrôler' })
      const a = await f.createAffiche(db, {
        plateformeId: c.plateforme.id,
        supportId: c.support.id,
        contNum: dossier.contNum,
        validationAdmin: validee,
      })
      const avant = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
      expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
      expect((await lire(i.code)).statut).toBe('INSTRUCTION_OK')
      expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toEqual(avant)
    },
  )

  it('RG-COO-001 Instruction OK manuelle d’un dossier avec affiches validée / à confirmer / orpheline : affiches intactes', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id)
    const a = await affichesDuDossier(c, dossier.contNum)
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
    expect(await a.instantane()).toEqual(a.avant)
  })

  it('RG-COO-001 Instruction OK automatique à l’arrivée de la prépa avec des affiches non validées : passe quand même, affiches intactes', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id, { preparation: 'A_TRAITER' })
    const a = await affichesDuDossier(c, dossier.contNum)
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect(await lire(i.code)).toMatchObject({ statut: 'INSTRUCTION_OK', iokMode: 'AUTO' })
    expect(await a.instantane()).toEqual(a.avant)
  })

  it('RG-COO-001 / RG-X-078 réouverture sur renvoi de prépa avec des affiches non validées : rouverte, affiches intactes', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id, {
      statut: 'INSTRUCTION_OK',
      commentaire: 'à contrôler',
    })
    const a = await affichesDuDossier(c, dossier.contNum)
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await lire(i.code)).statut).toBe('EN_COURS')
    expect(await a.instantane()).toEqual(a.avant)
  })
})

// ───────────────────────────── RG-COO-042 / 051 / 133 automatisme ─────────────────────────────

describe('RG-COO-042 / 051 / 133 Instruction OK automatique (compléments)', () => {
  it('RG-COO-051 grain atelier × plateforme : seule l’instruction conforme du dossier passe automatiquement', async () => {
    const dossier = await f.createDossier(db, { statut: 'A_TRAITER' })
    const conforme = await instruction((await f.createAtelier(db)).id, { dossier })
    const commentee = await instruction((await f.createAtelier(db)).id, {
      dossier,
      commentaire: 'Visuel B en tête de train',
    })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect(await lire(conforme.i.code)).toMatchObject({ statut: 'INSTRUCTION_OK', iokMode: 'AUTO' })
    expect(await lire(commentee.i.code)).toMatchObject({ statut: 'EN_COURS', iokMode: null })
  })

  it('RG-COO-042 l’automatisme ne touche pas les instructions À traiter, Annulé, Prêt à produire du dossier', async () => {
    const dossier = await f.createDossier(db, { statut: 'A_TRAITER' })
    const atelier = await f.createAtelier(db)
    const statuts = ['A_TRAITER', 'ANNULE', 'PRET_A_PRODUIRE'] as const
    const autres = []
    for (const statut of statuts) autres.push(await instruction(atelier.id, { dossier, statut }))
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    for (const [k, x] of autres.entries())
      expect(await lire(x.i.code)).toMatchObject({ statut: statuts[k], version: x.i.version })
  })

  it('RG-COO-042 nouvelle instruction intégrée alors que la prépa est déjà reçue : Instruction OK automatique (Q-183 (8))', async () => {
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const d = broadcast({ contNum: dossier.contNum })
    expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('CREEE')
    expect(await lire(d.code)).toMatchObject({
      statut: 'INSTRUCTION_OK',
      iokMode: 'AUTO',
      iokParId: null,
    })
  })

  it('RG-COO-042 l’Instruction OK automatique incrémente la version et date l’Instruction OK (iok_le)', async () => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      preparation: 'A_TRAITER',
    })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    const apres = await lire(i.code)
    expect(apres.version).toBe(i.version + 1)
    expect(apres.iokLe).not.toBeNull()
  })

  it('RG-COO-133 pas de normalisation « Sans affiche » du legacy : 60 % + 30 % reste « En cours », pourcentages et nombre de visuels inchangés', async () => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      preparation: 'A_TRAITER',
      pct: [60, 30],
    })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await lire(i.code)).statut).toBe('EN_COURS')
    const v = await db.instructionVisuel.findMany({
      where: { instructionCode: i.code },
      orderBy: { id: 'asc' },
    })
    expect(v.map((x) => Number(x.pourcentage))).toEqual([60, 30])
  })

  it('RG-COO-133 pas de normalisation d’un visuel unique : 90 % reste 90 %, instruction « En cours »', async () => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      preparation: 'A_TRAITER',
      pct: [90],
    })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await lire(i.code)).statut).toBe('EN_COURS')
    expect(
      Number(
        (await db.instructionVisuel.findFirstOrThrow({ where: { instructionCode: i.code } }))
          .pourcentage,
      ),
    ).toBe(90)
  })

  it('RG-COO-044 l’Instruction OK manuelle ne demande ni commentaire vide, ni exceptions = quantité, ni écart nul', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id, {
      commentaire: 'fin de train',
      exceptions: 5,
      faces: ['contrat'],
    })
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 3,
      source: 'PREPA',
    })
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
    expect(await lire(i.code)).toMatchObject({ statut: 'INSTRUCTION_OK', iokMode: 'MANUEL' })
  })

  it('RG-COO-059 l’Instruction OK manuelle n’applique pas la position proposée par le commentaire (« fin de train » → 2 proposé)', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id, {
      commentaire: 'Visuel C en fin de train',
    })
    const l = (await liste(c.headers, `&dossier=${String(dossier.contNum)}`)).items[0]
    expect(l?.instructions[0]).toMatchObject({ positionProposee: 2, position: 0 })
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
    expect((await lire(i.code)).tipInsCode).toBe(0)
  })
})

// ───────────────────────────── RG-COO-054 réouverture ─────────────────────────────

describe('RG-COO-054 / RG-X-078 renvoi de prépa avant l’export (compléments)', () => {
  it('RG-COO-054 renvoi sur un dossier mixte : seule l’instruction INSTRUCTION_OK est rouverte ; Prêt à produire et Annulé intacts, faces exportées intactes', async () => {
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const atelier = await f.createAtelier(db)
    const ouverte = await instruction(atelier.id, {
      dossier,
      statut: 'INSTRUCTION_OK',
      commentaire: 'à contrôler',
    })
    const exportee = await instruction(atelier.id, { dossier, statut: 'PRET_A_PRODUIRE' })
    await f.createFaceTrain(db, {
      instructionCode: exportee.i.code,
      ftType: 'entretien',
      statut: 'A_IMPRIMER',
      theme: 'T',
    })
    const facesExportees = await db.faceTrain.findMany({
      where: { instructionCode: exportee.i.code },
      orderBy: { id: 'asc' },
    })
    const annulee = await instruction(atelier.id, { dossier, statut: 'ANNULE' })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await lire(ouverte.i.code)).statut).toBe('EN_COURS')
    expect(await lire(exportee.i.code)).toMatchObject({
      statut: 'PRET_A_PRODUIRE',
      version: exportee.i.version,
    })
    expect(await lire(annulee.i.code)).toMatchObject({
      statut: 'ANNULE',
      version: annulee.i.version,
    })
    expect(
      await db.faceTrain.findMany({
        where: { instructionCode: exportee.i.code },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(facesExportees)
  })

  it('RG-COO-054 / RG-COO-046 la réouverture garde les faces « à imprimer », remet à blanc les autres, efface la marque et journalise « Circé (automatique) »', async () => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      statut: 'INSTRUCTION_OK',
      commentaire: 'à contrôler',
    })
    const c = await contexte()
    await db.instruction.update({
      where: { code: i.code },
      data: { iokMode: 'MANUEL', iokParId: c.user.id, iokLe: new Date() },
    })
    const imprimee = await f.createFaceTrain(db, {
      instructionCode: i.code,
      ftType: 'contrat',
      statut: 'A_IMPRIMER',
      theme: 'IMPRIME',
    })
    await db.faceTrain.updateMany({
      where: { instructionCode: i.code, NOT: { id: imprimee.id } },
      data: { theme: 'CALCULE', trainId: 'T1' },
    })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect(await lire(i.code)).toMatchObject({
      statut: 'EN_COURS',
      iokMode: null,
      iokParId: null,
      iokLe: null,
    })
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: imprimee.id } })).toMatchObject({
      statut: 'A_IMPRIMER',
      theme: 'IMPRIME',
    })
    expect(
      await db.faceTrain.count({
        where: { instructionCode: i.code, NOT: { id: imprimee.id }, theme: { not: null } },
      }),
    ).toBe(0)
    expect(
      await db.journalAudit.findFirstOrThrow({
        where: { entiteId: i.code, action: 'REOUVERTURE_INSTRUCTION_OK' },
      }),
    ).toMatchObject({ parId: null, complement: 'Circé (automatique)' })
  })

  it('RG-COO-054 / RG-COO-042 renvoi d’une prépa conforme : rouverte (historique RG-COO-054) puis réévaluée automatiquement (Q-183 (8))', async () => {
    const { dossier, i } = await instruction((await f.createAtelier(db)).id, {
      statut: 'INSTRUCTION_OK',
    })
    await db.instruction.update({ where: { code: i.code }, data: { iokMode: 'MANUEL' } })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect(await historiques(i.code)).toMatchObject([
      { ancien: 'INSTRUCTION_OK', nouveau: 'EN_COURS', regle: 'RG-COO-054' },
      { ancien: 'EN_COURS', nouveau: 'INSTRUCTION_OK', regle: 'RG-COO-042' },
    ])
    expect((await lire(i.code)).iokMode).toBe('AUTO')
  })
})

// ───────────────────────────── RG-COO-057 / 060 / fiche ─────────────────────────────

describe('RG-COO-057 / 060 demande de correction, filtre « À faire », fiche dossier (compléments)', () => {
  it('RG-COO-057 note vide ou blanche : demande tracée sans note (null)', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    expect((await correction(c.headers, dossier.id, '   ')).statusCode).toBe(200)
    expect(
      (await db.demandeCorrection.findFirstOrThrow({ where: { dossierId: dossier.id } })).note,
    ).toBeNull()
  })

  it('RG-COO-057 note de plus de 2000 caractères : 400, aucune demande', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    expect((await correction(c.headers, dossier.id, 'x'.repeat(2001))).statusCode).toBe(400)
    expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(0)
  })

  it('RG-COO-057 dossier inexistant : 404', async () => {
    const c = await contexte()
    expect((await correction(c.headers, 999_999_999, 'x')).statusCode).toBe(404)
  })

  it('RG-COO-057 le renvoi est journalisé comme tel (« renvoi ») et l’état des instructions ne change pas', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id)
    await correction(c.headers, dossier.id, 'première')
    await correction(c.headers, dossier.id, 'relance')
    expect((await journaux(dossier.contNum)).map((j) => [j.action, j.complement ?? null])).toEqual([
      ['DEMANDE_CORRECTION_BROADCAST', null],
      ['DEMANDE_CORRECTION_BROADCAST', 'renvoi'],
    ])
    expect(await lire(i.code)).toMatchObject({ statut: 'EN_COURS', version: i.version })
  })

  // Anomalie corrigée (ANO-022 / 023 / 024, test-engineer COO-P02).
  it('RG-COO-057 le renvoi de la prépa par Broadcast passe la demande ENVOYEE → FAITE (« Corrigé par Broadcast »)', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id, { commentaire: 'à contrôler' })
    expect((await correction(c.headers, dossier.id, 'thème B')).statusCode).toBe(200)
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    const d = await db.demandeCorrection.findFirstOrThrow({ where: { dossierId: dossier.id } })
    expect(d.statut).toBe('FAITE')
    expect(d.faiteLe).not.toBeNull()
  })

  it('RG-COO-060 / 055 Instruction OK avec écart Broadcast / Circé : le dossier reste « À faire »', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id, { statut: 'INSTRUCTION_OK' })
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 9,
      source: 'PREPA',
    })
    const q = `&dossier=${String(dossier.contNum)}`
    expect((await liste(c.headers, `${q}&aFaire=A_FAIRE`)).items.map((d) => d.id)).toEqual([
      dossier.id,
    ])
    expect((await liste(c.headers, `${q}&aFaire=RIEN`)).items).toHaveLength(0)
  })

  it('RG-COO-060 / 051 un dossier reste « À faire » tant qu’une de ses instructions est « En cours »', async () => {
    const c = await contexte()
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    await instruction(c.atelier.id, { dossier, statut: 'INSTRUCTION_OK' })
    const enCours = await instruction(c.atelier.id, { dossier })
    const q = `&dossier=${String(dossier.contNum)}`
    expect((await liste(c.headers, `${q}&aFaire=A_FAIRE`)).items).toHaveLength(1)
    expect(
      (await iok(c.headers, [{ code: enCours.i.code, version: enCours.i.version }])).statusCode,
    ).toBe(200)
    expect((await liste(c.headers, `${q}&aFaire=A_FAIRE`)).items).toHaveLength(0)
    expect((await liste(c.headers, `${q}&aFaire=RIEN`)).items).toHaveLength(1)
  })

  it('RG-COO-060 / 062 un dossier annulé n’est jamais « À faire », même avec une instruction « En cours » et un écart', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id, { preparation: 'ANNULE' })
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 2,
      source: 'PREPA',
    })
    const q = `&dossier=${String(dossier.contNum)}`
    expect((await liste(c.headers, `${q}&aFaire=A_FAIRE`)).items).toHaveLength(0)
    const l = (await liste(c.headers, q)).items[0]
    expect(l?.instructions[0]?.actions).toEqual([])
  })

  it('RG-COO-057 / ECR-COO-02 fiche dossier : demandes de correction les plus récentes d’abord, auteur, mail non envoyé (Q-375)', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    await correction(c.headers, dossier.id, 'première')
    await correction(c.headers, dossier.id, 'seconde')
    const r = await get(ctx, `/api/coordination/dossiers/${String(dossier.id)}`, c.headers)
    const fiche = FicheDossierSchema.parse(r.json())
    expect(fiche.corrections.map((x) => x.note)).toEqual(['seconde', 'première'])
    expect(fiche.corrections.every((x) => x.par !== null && !x.mailEnvoye)).toBe(true)
    expect(fiche.correctionDemandeeLe).not.toBeNull()
  })

  it.each([
    ['com', 200],
    ['cheq', 200],
    ['recep', 200],
    ['expe', 403],
  ] as const)('RG-COO-166 fiche dossier : le profil %s → %i', async (role, attendu) => {
    const c = await contexte([role])
    const { dossier } = await instruction(c.atelier.id)
    expect(
      (await get(ctx, `/api/coordination/dossiers/${String(dossier.id)}`, c.headers)).statusCode,
    ).toBe(attendu)
  })
})

// ───────────────────────────── RG-COO-204 ─────────────────────────────

describe('RG-COO-204 campagne contrôlée', () => {
  // Q-257 OUVERTE : source de l'indicateur « campagne contrôlée » inconnue ; règle non implémentable.
  it.todo('RG-COO-204 campagne contrôlée : entretien 15 % et visuel de la CC en position 1 (Q-257)')
})
