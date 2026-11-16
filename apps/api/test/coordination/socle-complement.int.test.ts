// COO-P01 — tests COMPLÉMENTAIRES du socle Coordination (socle.int.test.ts n'est pas dupliqué).
// Source de l'attendu : docs/COORDINATION_REGLES_METIER.md §2 (bloc 1), §3.2.b, §3.2.c, RG-COO-001, 040,
// 041, 045, 046, 053, 061, 062, 063, 087, 160, 165 à 169, RG-X-065 ; hypothèses Q-003, Q-182.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ListeDossiersSchema, StatutInstructionChangeSchema, type Role } from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import {
  annulerDossier,
  creerChapeauATraiter,
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
import { contexteReception, erreur, get, idem, post, site } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

/** Site + atelier + utilisateur des rôles donnés sur ce site (tous ses ateliers). */
async function contexte(roles: Role[] = ['coord']) {
  const s = await site(ctx, roles)
  const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
  return { ...s, atelier }
}

async function instruction(
  atelierId: number | null,
  statut: StatutInstruction = 'EN_COURS',
  dossierStatut: StatutDossier = 'PREPARATION_RECUE',
) {
  const dossier = await f.createDossier(db, { statut: dossierStatut })
  return f.createInstruction(db, {
    atelierId,
    statut,
    dossierId: dossier.id,
    contNum: dossier.contNum,
    contAnbas: 2026,
    contSembas: 44,
  })
}

/** Faces d'un calcul de trains : normale, entretien, et leurs équivalents « à imprimer ». */
async function faces(instructionCode: string) {
  const commun = {
    instructionCode,
    theme: 'Thème',
    themeId: 3,
    repiquage: 'R',
    repiquageId: 4,
    trainId: 'T1',
    versionTrain: 2,
  }
  const normale = await f.createFaceTrain(db, {
    ...commun,
    statut: 'INSTRUCTION_OK',
    ftType: 'contrat',
  })
  const entretien = await f.createFaceTrain(db, {
    ...commun,
    statut: 'INSTRUCTION_OK',
    ftType: 'entretien',
  })
  const imprimee = await f.createFaceTrain(db, {
    ...commun,
    statut: 'A_IMPRIMER',
    ftType: 'contrat',
  })
  return { normale, entretien, imprimee }
}

const facesDe = (instructionCode: string) =>
  db.faceTrain.findMany({ where: { instructionCode }, orderBy: { id: 'asc' } })

const changer = (
  headers: Record<string, string>,
  code: string,
  body: object,
  cle: Record<string, string> = idem(),
) =>
  ctx.app.inject({
    method: 'POST',
    url: `/api/coordination/instructions/${code}/statut`,
    headers: { ...headers, ...cle },
    payload: body,
  })

const liste = async (headers: Record<string, string>, query = '') =>
  ListeDossiersSchema.parse(
    (await get(ctx, `/api/coordination/dossiers?pageSize=100${query}`, headers)).json(),
  )

const codesVisibles = async (headers: Record<string, string>, query = '') =>
  (await liste(headers, query)).items.flatMap((d) => d.instructions.map((i) => i.code))

const historiques = (entiteId: string | number) =>
  db.statutHistorique.findMany({ where: { entiteId: String(entiteId) }, orderBy: { id: 'asc' } })

let numDeclencheur = 0
/**
 * Atomicité : déclencheur SQLite temporaire RAISE(ABORT) posé sur test.db, toujours supprimé (finally).
 * `corps` = « BEFORE INSERT ON table WHEN … ».
 */
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_test_${String(++numDeclencheur)}_${String(f.next())}`
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
  code: `CPL${String(f.next()).padStart(12, '0')}`,
  type: 'contrat',
  contNum: 800_000 + (f.next() % 100_000_000),
  semaine: { annee: 2026, semaine: 45 },
  atelierId: null,
  annonceur: 'BROADCAST',
  commentaire: null,
  sectCodeCentre: 1,
  talrTrait: '1',
  ...d,
})

// ───────────────────────────── RG-COO-040 table §3.2.c ─────────────────────────────

describe('RG-COO-040 table de transitions §3.2.c (compléments)', () => {
  it.each([
    ['A_TRAITER', 'A_TRAITER', ['RG-COO-040']],
    ['EN_COURS', 'EN_COURS', ['RG-COO-040']],
    ['ERREUR', 'A_TRAITER', ['RG-COO-040']],
    ['ERREUR', 'EN_COURS', ['RG-COO-040', 'RG-COO-041']],
    ['PRET_A_PRODUIRE', 'A_TRAITER', ['RG-COO-040', 'RG-COO-045', 'RG-COO-046']],
  ] as const)(
    'RG-COO-040 transition interdite %s → %s : 409 TRANSITION_INTERDITE, statut, version et historique inchangés',
    async (de, vers, regles) => {
      const c = await contexte()
      const i = await instruction(c.atelier.id, de)
      const r = await changer(c.headers, i.code, { version: i.version, vers })
      expect(r.statusCode).toBe(409)
      const e = erreur(r)
      expect(e.code).toBe('TRANSITION_INTERDITE')
      expect(regles).toContain(e.regle)
      expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
        statut: de,
        version: i.version,
      })
      expect(await historiques(i.code)).toHaveLength(0)
      expect(await db.journalAudit.count({ where: { entiteId: i.code } })).toBe(0)
    },
  )

  it('RG-COO-040 « Erreur » n’est jamais un statut demandable par un utilisateur (400)', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'ERREUR' })
    expect(r.statusCode).toBe(400)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-040 enchaînement A_TRAITER → ANNULE → A_TRAITER → ANNULE : une ligne d’historique par transition', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'A_TRAITER')
    let version = i.version
    for (const vers of ['ANNULE', 'A_TRAITER', 'ANNULE'] as const) {
      const r = await changer(c.headers, i.code, { version, vers })
      expect(r.statusCode).toBe(200)
      version = StatutInstructionChangeSchema.parse(r.json()).version
    }
    expect(version).toBe(i.version + 3)
    expect((await historiques(i.code)).map((h) => `${h.ancien ?? ''}>${h.nouveau}`)).toEqual([
      'A_TRAITER>ANNULE',
      'ANNULE>A_TRAITER',
      'A_TRAITER>ANNULE',
    ])
  })

  it.each([
    ['A_TRAITER', ['ANNULE']],
    // Q-204 (b) : Instruction OK après contrôle proposée sur une instruction En cours (prépa reçue).
    ['EN_COURS', ['ANNULE', 'INSTRUCTION_OK']],
    ['INSTRUCTION_OK', ['EN_COURS', 'A_TRAITER', 'ANNULE']],
    ['ERREUR', []],
    ['ANNULE', ['A_TRAITER']],
    ['PRET_A_PRODUIRE', []],
  ] as const)(
    'RG-COO-040 la liste propose à la Coordination exactement les transitions de la table depuis %s',
    async (statut, attendues) => {
      const c = await contexte()
      const i = await instruction(c.atelier.id, statut)
      const vue = (await liste(c.headers, `&dossier=${String(i.contNum)}`)).items[0]
      const actions = vue?.instructions.find((x) => x.code === i.code)?.actions ?? null
      expect(actions === null ? null : [...actions].sort()).toEqual([...attendues].sort())
    },
  )

  it('RG-COO-040 code d’instruction : 18 caractères (format AAAA SS C0 atelier dossier) accepté, 19 refusé (400)', async () => {
    const c = await contexte()
    // AAAA (2026) + SS (44) + C0 + atelier (01) + dossier (8 chiffres).
    const code18 = `202644C001${String(f.next() % 100_000_000).padStart(8, '0')}`
    expect(code18).toHaveLength(18)
    const dossier = await f.createDossier(db)
    await f.createInstruction(db, {
      code: code18,
      atelierId: c.atelier.id,
      statut: 'EN_COURS',
      dossierId: dossier.id,
      contNum: dossier.contNum,
    })
    expect((await changer(c.headers, code18, { version: 1, vers: 'ANNULE' })).statusCode).toBe(200)
    expect(
      (await changer(c.headers, `${code18}9`, { version: 1, vers: 'ANNULE' })).statusCode,
    ).toBe(400)
  })

  it.each([
    [{ version: 1.5, vers: 'ANNULE' }],
    [{ version: '1', vers: 'ANNULE' }],
    [{ vers: 'ANNULE' }],
    [{ version: 1 }],
    [{ version: 1, vers: 'annule' }],
  ])('RG-COO-040 corps invalide %o : 400, rien n’est écrit', async (body) => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    expect((await changer(c.headers, i.code, body)).statusCode).toBe(400)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
    expect(await historiques(i.code)).toHaveLength(0)
  })
})

// ───────────────────────────── transitions posées par le système ─────────────────────────────

describe('RG-COO-041 / RG-COO-053 / RG-COO-063 transitions posées par Circé (compléments)', () => {
  it('RG-COO-041 arrivée des instructions A_TRAITER → EN_COURS : historique et journal attribués à « Circé (automatique) »', async () => {
    const d = broadcast()
    await creerChapeauAvecCode(d.code, d.contNum)
    expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('MISE_A_JOUR')
    const h = await historiques(d.code)
    expect(h.at(-1)).toMatchObject({
      ancien: 'A_TRAITER',
      nouveau: 'EN_COURS',
      parId: null,
      motif: 'Circé (automatique)',
      regle: 'RG-COO-041',
    })
    expect(
      // Le chapeau a sa propre ligne (acteur « BC ») : on lit celle de l'arrivée des instructions.
      await db.journalAudit.findFirstOrThrow({
        where: { entiteId: d.code, action: 'INTEGRATION_INSTRUCTION', nouvelleValeur: 'EN_COURS' },
      }),
    ).toMatchObject({ parId: null, complement: 'Circé (automatique)', nouvelleValeur: 'EN_COURS' })
  })

  async function creerChapeauAvecCode(
    code: string,
    contNum: number,
    atelierId: number | null = null,
  ) {
    return withTransaction(db, (tx) =>
      creerChapeauATraiter(tx, {
        code,
        contNum,
        semaine: { annee: 2026, semaine: 45 },
        atelierId,
      }),
    )
  }

  it('RG-COO-041 (absente) → A_TRAITER : le chapeau écrit un historique sans acteur nominatif', async () => {
    const code = `CHP${String(f.next()).padStart(12, '0')}`
    expect(await creerChapeauAvecCode(code, 900_001)).toBe('CREEE')
    const h = await historiques(code)
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({
      typeEntite: 'INSTRUCTION',
      ancien: null,
      nouveau: 'A_TRAITER',
      parId: null,
      regle: 'RG-COO-041',
    })
    // RG-COO-041 : utilisateur « BC » ; RG-COO-061 : « Circé (automatique) » pour les traitements.
    expect(['BC', 'Circé (automatique)']).toContain(h[0]?.motif)
  })

  it('RG-COO-041 un chapeau sur une instruction existante (EN_COURS) ne la modifie pas et n’écrit rien', async () => {
    const existante = await f.createInstruction(db, { statut: 'EN_COURS', annonceur: 'X' })
    expect(await creerChapeauAvecCode(existante.code, 900_002)).toBe('EXISTANTE')
    expect(
      await db.instruction.findUniqueOrThrow({ where: { code: existante.code } }),
    ).toMatchObject({
      statut: 'EN_COURS',
      version: existante.version,
      typeInstruction: existante.typeInstruction,
    })
    expect(await historiques(existante.code)).toHaveLength(0)
  })

  it('RG-COO-041 une instruction « reseau » nouvelle est créée EN_COURS, rattachée au dossier existant (Q-182 (6))', async () => {
    const dossier = await f.createDossier(db)
    const d = broadcast({ type: 'reseau', contNum: dossier.contNum })
    expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('CREEE')
    expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
      statut: 'EN_COURS',
      typeInstruction: 'reseau',
      dossierId: dossier.id,
      entretien: 8,
      tipInsCode: 0,
    })
  })

  it.each([[{ sectCodeCentre: null }], [{ talrTrait: 'B' }]])(
    'RG-COO-041 un renvoi non éligible (%o) ne touche pas l’instruction existante',
    async (surcharge) => {
      const d = broadcast({ ...surcharge, annonceur: 'NOUVEAU' })
      const existante = await f.createInstruction(db, {
        code: d.code,
        statut: 'A_TRAITER',
        annonceur: 'ANCIEN',
      })
      expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('NON_ELIGIBLE')
      expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
        statut: 'A_TRAITER',
        annonceur: 'ANCIEN',
        version: existante.version,
      })
      expect(await historiques(d.code)).toHaveLength(0)
    },
  )

  // Q-204 TRANCHÉE (option b) : un renvoi sur INSTRUCTION_OK rouvre l'instruction (RG-COO-054, testé dans
  // instruction-ok.int.test.ts) ; restent ignorés les renvois sur PRET_A_PRODUIRE et ANNULE.
  it.each([['PRET_A_PRODUIRE'], ['ANNULE']] as const)(
    'RG-COO-053 renvoi Broadcast sur %s : commentaire et version figés, aucun historique de statut',
    async (statut) => {
      const d = broadcast({ commentaire: 'NOUVEAU COMMENTAIRE' })
      const existante = await f.createInstruction(db, {
        code: d.code,
        statut,
        commentaire: 'FIGÉ',
      })
      await withTransaction(db, (tx) => integrerInstruction(tx, d))
      expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
        statut,
        commentaire: 'FIGÉ',
        version: existante.version,
      })
      expect(await historiques(d.code)).toHaveLength(0)
    },
  )

  it('RG-COO-053 renvoi Broadcast après l’export (PRET_A_PRODUIRE) : les trains exportés (faces) ne changent pas', async () => {
    const d = broadcast()
    await f.createInstruction(db, { code: d.code, statut: 'PRET_A_PRODUIRE' })
    await faces(d.code)
    const avant = await facesDe(d.code)
    expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('IGNOREE')
    expect(await facesDe(d.code)).toEqual(avant)
  })

  // Q-204 (b) : la prépa reçue, l'instruction conforme à la règle de Nariman (sans commentaire, exceptions =
  // quantité) passe aussitôt Instruction OK automatique (RG-COO-042).
  it('RG-COO-063 / RG-COO-041 / RG-COO-042 flux de prépa : dossier → PREPARATION_RECUE, chapeau → EN_COURS puis Instruction OK automatique', async () => {
    const dossier = await f.createDossier(db)
    const d = broadcast({ contNum: dossier.contNum })
    await creerChapeauAvecCode(d.code, dossier.contNum)
    await withTransaction(db, async (tx) => {
      await integrerPreparation(tx, dossier.contNum)
      await integrerInstruction(tx, d)
    })
    expect(await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).toMatchObject({
      statut: 'PREPARATION_RECUE',
      version: dossier.version + 1,
    })
    expect((await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).statut).toBe(
      'INSTRUCTION_OK',
    )
    expect((await historiques(dossier.contNum)).map((h) => h.nouveau)).toEqual([
      'PREPARATION_RECUE',
    ])
    expect((await historiques(d.code)).map((h) => h.nouveau)).toEqual([
      'A_TRAITER',
      'EN_COURS',
      'INSTRUCTION_OK',
    ])
  })

  it('RG-COO-063 intégration de la prépa d’un dossier inconnu : rien n’est créé ni écrit', async () => {
    const contNum = 950_000 + (f.next() % 1_000_000)
    expect(await withTransaction(db, (tx) => integrerPreparation(tx, contNum))).toBe(
      'DOSSIER_INCONNU',
    )
    expect(await db.dossier.findUnique({ where: { contNum } })).toBeNull()
    expect(await historiques(contNum)).toHaveLength(0)
  })

  it.each([['A_TRAITER'], ['PREPARATION_RECUE']] as const)(
    'RG-COO-062 vente annulée %s → ANNULE : version +1, historique « Circé (automatique) » citant RG-COO-062, journal',
    async (statut) => {
      const dossier = await f.createDossier(db, { statut })
      const r = await withTransaction(db, (tx) => annulerDossier(tx, dossier.contNum))
      expect(r.resultat).toBe('ANNULE')
      expect(await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).toMatchObject({
        statut: 'ANNULE',
        version: dossier.version + 1,
      })
      expect(await historiques(dossier.contNum)).toMatchObject([
        {
          typeEntite: 'DOSSIER',
          ancien: statut,
          nouveau: 'ANNULE',
          parId: null,
          motif: 'Circé (automatique)',
          regle: 'RG-COO-062',
        },
      ])
      expect(
        await db.journalAudit.count({
          where: { entiteId: String(dossier.contNum), action: 'ANNULATION_DOSSIER', parId: null },
        }),
      ).toBe(1)
    },
  )

  it('RG-COO-062 dossier déjà annulé : 409 TRANSITION_INTERDITE citant RG-COO-062, version inchangée', async () => {
    const dossier = await f.createDossier(db, { statut: 'ANNULE' })
    await expect(
      withTransaction(db, (tx) => annulerDossier(tx, dossier.contNum)),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'TRANSITION_INTERDITE', regle: 'RG-COO-062' })
    expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).version).toBe(
      dossier.version,
    )
  })

  it('RG-COO-062 annulation d’un dossier inconnu : DOSSIER_INCONNU, rien n’est écrit', async () => {
    const contNum = 970_000 + (f.next() % 1_000_000)
    expect(await withTransaction(db, (tx) => annulerDossier(tx, contNum))).toMatchObject({
      resultat: 'DOSSIER_INCONNU',
      lignesAnnulees: 0,
      affichesConservees: 0,
    })
    expect(await db.journalAudit.count({ where: { entiteId: String(contNum) } })).toBe(0)
  })

  it('RG-COO-062 l’annulation du dossier ne change pas le statut de ses instructions ni leurs trains (Q-182 (4))', async () => {
    const c = await contexte()
    const ok = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    const dossier = await db.dossier.findUniqueOrThrow({ where: { contNum: ok.contNum ?? 0 } })
    const enCours = await f.createInstruction(db, {
      atelierId: c.atelier.id,
      statut: 'EN_COURS',
      dossierId: dossier.id,
      contNum: dossier.contNum,
    })
    await faces(ok.code)
    const facesAvant = await facesDe(ok.code)
    await withTransaction(db, (tx) => annulerDossier(tx, dossier.contNum))
    expect(await db.instruction.findUniqueOrThrow({ where: { code: ok.code } })).toMatchObject({
      statut: 'INSTRUCTION_OK',
      version: ok.version,
    })
    expect(await db.instruction.findUniqueOrThrow({ where: { code: enCours.code } })).toMatchObject(
      { statut: 'EN_COURS', version: enCours.version },
    )
    expect(await facesDe(ok.code)).toEqual(facesAvant)
  })
})

// ───────────────────────────── RG-COO-046 ─────────────────────────────

describe('RG-COO-046 effacement du calcul des trains (compléments)', () => {
  it('RG-COO-046 l’effacement ne touche que les faces de l’instruction concernée', async () => {
    const c = await contexte()
    const cible = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    const voisine = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    await faces(cible.code)
    await faces(voisine.code)
    const voisinesAvant = await facesDe(voisine.code)
    const r = await changer(c.headers, cible.code, { version: cible.version, vers: 'EN_COURS' })
    expect(r.statusCode).toBe(200)
    expect(await facesDe(voisine.code)).toEqual(voisinesAvant)
  })

  it('RG-COO-046 retour arrière sans calcul de trains : 200, aucune face effacée', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'A_TRAITER' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ facesSupprimees: 0, facesRemisesABlanc: 0 })
  })

  it('RG-COO-046 ANNULE → A_TRAITER n’efface rien (effacement en sortie d’INSTRUCTION_OK seulement, Q-182 (3))', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'ANNULE')
    await faces(i.code)
    const avant = await facesDe(i.code)
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'A_TRAITER' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ facesSupprimees: 0, facesRemisesABlanc: 0 })
    expect(await facesDe(i.code)).toEqual(avant)
  })

  it('RG-COO-046 retour arrière refusé pour version périmée : 409, calcul des trains intact', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    await faces(i.code)
    const avant = await facesDe(i.code)
    await db.instruction.update({ where: { code: i.code }, data: { version: { increment: 1 } } })
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'EN_COURS' })
    expect(r.statusCode).toBe(409)
    expect(await facesDe(i.code)).toEqual(avant)
    expect(await historiques(i.code)).toHaveLength(0)
  })

  it.each([['cheq'], ['com']] as const)(
    'RG-COO-046 retour arrière refusé au profil %s (403) : calcul des trains intact',
    async (role) => {
      const c = await contexte([role])
      const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
      await faces(i.code)
      const avant = await facesDe(i.code)
      expect(
        (await changer(c.headers, i.code, { version: i.version, vers: 'A_TRAITER' })).statusCode,
      ).toBe(403)
      expect(await facesDe(i.code)).toEqual(avant)
    },
  )
})

// ───────────────────────────── droits §2 ─────────────────────────────

describe('RG-COO-165 / 166 / 168 / 169 matrice des droits (compléments)', () => {
  it.each([['coord'], ['cheq'], ['recep'], ['admin'], ['com']] as const)(
    'RG-COO-166 le profil %s consulte la liste et y voit l’instruction de son périmètre',
    async (role) => {
      const c = await contexte([role])
      const i = await instruction(c.atelier.id, 'EN_COURS')
      const r = await get(ctx, `/api/coordination/dossiers?dossier=${String(i.contNum)}`, c.headers)
      expect(r.statusCode).toBe(200)
      expect(
        ListeDossiersSchema.parse(r.json()).items.flatMap((d) => d.instructions.map((x) => x.code)),
      ).toContain(i.code)
    },
  )

  it('RG-COO-166 le profil expe : 403 PERMISSION citant RG-COO-165', async () => {
    const c = await contexte(['expe'])
    const r = await get(ctx, '/api/coordination/dossiers', c.headers)
    expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle: 'RG-COO-165' })
  })

  it.each([['cheq'], ['recep']] as const)(
    'RG-COO-166 le profil %s (lecture) ne se voit proposer aucune action',
    async (role) => {
      const c = await contexte([role])
      const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
      const vue = (await liste(c.headers, `&dossier=${String(i.contNum)}`)).items[0]
      expect(vue?.instructions[0]?.actions).toEqual([])
    },
  )

  // Actions de §2 bloc 1 : « Annuler une instruction », « Remettre à traiter » (RG-COO-045), retour
  // arrière de l'Instruction OK (RG-COO-046) : coord, admin ✔ ; cheq, recep, expe, com ✘.
  const actions = {
    annuler: { de: 'A_TRAITER', vers: 'ANNULE' },
    remettre: { de: 'ANNULE', vers: 'A_TRAITER' },
    retour: { de: 'INSTRUCTION_OK', vers: 'EN_COURS' },
  } as const

  it.each([
    ['coord', 'remettre'],
    ['coord', 'retour'],
    ['admin', 'remettre'],
    ['admin', 'retour'],
    ['admin', 'annuler'],
  ] as const)('RG-COO-166 le profil %s est autorisé à « %s »', async (role, action) => {
    const { de, vers } = actions[action]
    const c = await contexte([role])
    const i = await instruction(c.atelier.id, de)
    const r = await changer(c.headers, i.code, { version: i.version, vers })
    expect(r.statusCode).toBe(200)
    expect(await historiques(i.code)).toMatchObject([
      { ancien: de, nouveau: vers, parId: c.user.id },
    ])
  })

  it.each([
    ['cheq', 'annuler', 'RG-COO-165'],
    ['cheq', 'remettre', 'RG-COO-165'],
    ['recep', 'annuler', 'RG-COO-165'],
    ['recep', 'remettre', 'RG-COO-165'],
    ['expe', 'annuler', 'RG-COO-165'],
    ['expe', 'remettre', 'RG-COO-165'],
    ['com', 'remettre', 'RG-COO-168'],
    ['com', 'retour', 'RG-COO-168'],
  ] as const)(
    'RG-COO-165 le profil %s n’est pas autorisé à « %s » : 403 PERMISSION citant %s, rien n’est écrit',
    async (role, action, regle) => {
      const { de, vers } = actions[action]
      const c = await contexte([role])
      const i = await instruction(c.atelier.id, de)
      const r = await changer(c.headers, i.code, { version: i.version, vers })
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle })
      expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
        statut: de,
        version: i.version,
      })
      expect(await historiques(i.code)).toHaveLength(0)
      expect(await db.journalAudit.count({ where: { entiteId: i.code } })).toBe(0)
    },
  )

  it('RG-COO-165 changement de statut sans identité : 401, rien n’est écrit', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    const r = await ctx.app.inject({
      method: 'POST',
      url: `/api/coordination/instructions/${i.code}/statut`,
      headers: idem(),
      payload: { version: i.version, vers: 'ANNULE' },
    })
    expect(r.statusCode).toBe(401)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-169 un compte « preprod » ne change aucun statut d’instruction (403)', async () => {
    const plateforme = await f.createPlateforme(db)
    const atelier = await f.createAtelier(db, { plateformeId: plateforme.id })
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['preprod'],
      [{ plateformeId: plateforme.id }],
    )
    const i = await instruction(atelier.id, 'EN_COURS')
    const r = await changer(devHeaders(user.identifiantExterne), i.code, {
      version: i.version,
      vers: 'ANNULE',
    })
    expect(r.statusCode).toBe(403)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })
})

// ───────────────────────────── périmètre RG-COO-167 ─────────────────────────────

describe('RG-COO-167 périmètre (compléments)', () => {
  it('RG-COO-167 l’admin voit tous les sites, y compris une instruction sans atelier, et peut la changer', async () => {
    const admin = await f.createUtilisateurAvecRoles(db, ['admin'], [])
    const h = devHeaders(admin.identifiantExterne)
    const ailleurs = await instruction((await f.createAtelier(db)).id, 'EN_COURS')
    const sansAtelier = await instruction(null, 'EN_COURS')
    expect(await codesVisibles(h, `&dossier=${String(ailleurs.contNum)}`)).toContain(ailleurs.code)
    expect(await codesVisibles(h, `&dossier=${String(sansAtelier.contNum)}`)).toContain(
      sansAtelier.code,
    )
    for (const i of [ailleurs, sansAtelier]) {
      expect((await changer(h, i.code, { version: i.version, vers: 'ANNULE' })).statusCode).toBe(
        200,
      )
    }
  })

  it('RG-COO-167 une instruction sans atelier n’apparaît pas dans la liste d’un coord limité à un site (Q-182 (1))', async () => {
    const c = await contexte()
    const sansAtelier = await instruction(null, 'EN_COURS')
    expect(await codesVisibles(c.headers, `&dossier=${String(sansAtelier.contNum)}`)).not.toContain(
      sansAtelier.code,
    )
  })

  it('RG-COO-167 utilisateur sans périmètre : changement de statut refusé (403 COO_PERIMETRE_INTERDIT)', async () => {
    const user = await f.createUtilisateurAvecRoles(db, ['coord'], [])
    const i = await instruction((await f.createAtelier(db)).id, 'EN_COURS')
    const r = await changer(devHeaders(user.identifiantExterne), i.code, {
      version: i.version,
      vers: 'ANNULE',
    })
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'COO_PERIMETRE_INTERDIT', regle: 'RG-COO-167' })
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-167 plusieurs ateliers : l’utilisateur voit et modifie ses deux ateliers, pas le troisième', async () => {
    const plateforme = await f.createPlateforme(db)
    const [a1, a2, a3] = [
      await f.createAtelier(db, { plateformeId: plateforme.id }),
      await f.createAtelier(db, { plateformeId: plateforme.id }),
      await f.createAtelier(db, { plateformeId: plateforme.id }),
    ]
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [
        { plateformeId: plateforme.id, atelierId: a1.id },
        { plateformeId: plateforme.id, atelierId: a2.id },
      ],
    )
    const h = devHeaders(user.identifiantExterne)
    const [i1, i2, i3] = [
      await instruction(a1.id),
      await instruction(a2.id),
      await instruction(a3.id),
    ]
    const codes = await codesVisibles(h)
    expect(codes).toEqual(expect.arrayContaining([i1.code, i2.code]))
    expect(codes).not.toContain(i3.code)
    expect((await changer(h, i1.code, { version: i1.version, vers: 'ANNULE' })).statusCode).toBe(
      200,
    )
    expect((await changer(h, i2.code, { version: i2.version, vers: 'ANNULE' })).statusCode).toBe(
      200,
    )
    expect((await changer(h, i3.code, { version: i3.version, vers: 'ANNULE' })).statusCode).toBe(
      403,
    )
  })

  it('RG-COO-167 plusieurs sites : site entier sur l’un, un seul atelier sur l’autre', async () => {
    const [p1, p2] = [await f.createPlateforme(db), await f.createPlateforme(db)]
    const a1 = await f.createAtelier(db, { plateformeId: p1.id })
    const [a2ok, a2ko] = [
      await f.createAtelier(db, { plateformeId: p2.id }),
      await f.createAtelier(db, { plateformeId: p2.id }),
    ]
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: p1.id }, { plateformeId: p2.id, atelierId: a2ok.id }],
    )
    const h = devHeaders(user.identifiantExterne)
    const [i1, i2ok, i2ko] = [
      await instruction(a1.id),
      await instruction(a2ok.id),
      await instruction(a2ko.id),
    ]
    const codes = await codesVisibles(h)
    expect(codes).toEqual(expect.arrayContaining([i1.code, i2ok.code]))
    expect(codes).not.toContain(i2ko.code)
  })

  it('RG-COO-167 un dossier sur deux ateliers : seule l’instruction de l’atelier du périmètre est listée', async () => {
    const c = await contexte()
    const dossier = await f.createDossier(db)
    const commun = { dossierId: dossier.id, contNum: dossier.contNum, statut: 'EN_COURS' as const }
    const dedans = await f.createInstruction(db, { ...commun, atelierId: c.atelier.id })
    const dehors = await f.createInstruction(db, {
      ...commun,
      atelierId: (await f.createAtelier(db)).id,
    })
    const codes = await codesVisibles(c.headers, `&dossier=${String(dossier.contNum)}`)
    expect(codes).toContain(dedans.code)
    expect(codes).not.toContain(dehors.code)
  })

  it('RG-COO-167 un dossier sans instruction n’apparaît que si une ligne attendue est sur un site du périmètre', async () => {
    const c = await contexte()
    const [visible, invisible] = [await f.createDossier(db), await f.createDossier(db)]
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: visible.contNum,
    })
    await f.createReceptionAttendue(db, { contNum: invisible.contNum })
    expect((await liste(c.headers, `&dossier=${String(visible.contNum)}`)).total).toBe(1)
    expect((await liste(c.headers, `&dossier=${String(invisible.contNum)}`)).total).toBe(0)
  })

  // ANO-020 corrigée : le filtre atelierId hors périmètre renvoyait 200 (liste vide) au lieu de 403.
  it('RG-COO-167 filtre sur un atelier hors périmètre : 403 COO_PERIMETRE_INTERDIT', async () => {
    const c = await contexte()
    const dehors = await f.createAtelier(db)
    const r = await get(ctx, `/api/coordination/dossiers?atelierId=${String(dehors.id)}`, c.headers)
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
  })
})

// ───────────────────────────── version et idempotence ─────────────────────────────

describe('RG-COO-040 / RG-COO-165 version et idempotence (compléments)', () => {
  it('RG-COO-040 deux changements simultanés avec la même version : un seul réussit, l’autre 409', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    const [a, b] = await Promise.all([
      changer(c.headers, i.code, { version: i.version, vers: 'EN_COURS' }),
      changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).version).toBe(
      i.version + 1,
    )
    expect(await historiques(i.code)).toHaveLength(1)
  })

  it('RG-COO-040 version périmée sur une transition permise : 409 COO_CONFLIT_VERSION, rien n’est écrit', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    expect(
      (await changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' })).statusCode,
    ).toBe(200)
    // ANNULE → A_TRAITER est permise, mais la version envoyée est l'ancienne.
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'A_TRAITER' })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_CONFLIT_VERSION')
    expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
      statut: 'ANNULE',
      version: i.version + 1,
    })
    expect(await historiques(i.code)).toHaveLength(1)
  })

  it.each([[0], [-1]])('RG-COO-040 version %i (limite) : 409, statut inchangé', async (version) => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    expect([400, 409]).toContain(
      (await changer(c.headers, i.code, { version, vers: 'ANNULE' })).statusCode,
    )
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-165 / RG-REC-008 même Idempotency-Key avec un autre corps : 409 COO_IDEMPOTENCE_CONFLIT, un seul changement', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    const cle = idem()
    expect(
      (await changer(c.headers, i.code, { version: i.version, vers: 'EN_COURS' }, cle)).statusCode,
    ).toBe(200)
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'A_TRAITER' }, cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_IDEMPOTENCE_CONFLIT', regle: 'RG-REC-008' })
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
    expect(await historiques(i.code)).toHaveLength(1)
  })

  it('RG-COO-165 Idempotency-Key absent : 400, rien n’est écrit', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    const r = await post(
      ctx,
      `/api/coordination/instructions/${i.code}/statut`,
      c.headers,
      { version: i.version, vers: 'ANNULE' },
      false,
    )
    expect(r.statusCode).toBe(400)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-165 rejeu d’une double soumission avec retour arrière : faces effacées une seule fois, un seul historique', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    await faces(i.code)
    const cle = idem()
    const body = { version: i.version, vers: 'EN_COURS' }
    const a = await changer(c.headers, i.code, body, cle)
    const b = await changer(c.headers, i.code, body, cle)
    expect(b.json()).toEqual(a.json())
    expect(await historiques(i.code)).toHaveLength(1)
    expect(await db.journalAudit.count({ where: { entiteId: i.code } })).toBe(1)
  })
})

// ───────────────────────────── atomicité ─────────────────────────────

describe('RG-COO-061 / RG-COO-160 / RG-COO-046 atomicité (échec simulé par déclencheur SQLite)', () => {
  it('RG-COO-061 échec d’écriture de l’historique : statut, version et calcul des trains inchangés ; la clé reste rejouable', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    await faces(i.code)
    const avant = await facesDe(i.code)
    const cle = idem()
    const body = { version: i.version, vers: 'EN_COURS' }
    const r = await avecEchec(
      `BEFORE INSERT ON statut_historique WHEN NEW.entite_id = '${i.code}'`,
      () => changer(c.headers, i.code, body, cle),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
      statut: 'INSTRUCTION_OK',
      version: i.version,
    })
    expect(await facesDe(i.code)).toEqual(avant)
    expect(await db.journalAudit.count({ where: { entiteId: i.code } })).toBe(0)
    // Rien n'a été gardé : la même clé, rejouée après correction, applique le changement une fois.
    const ok = await changer(c.headers, i.code, body, cle)
    expect(ok.statusCode).toBe(200)
    expect(ok.headers['idempotent-replayed']).toBeUndefined()
    expect(await historiques(i.code)).toHaveLength(1)
  })

  it('RG-COO-160 échec d’écriture du journal : aucun historique, statut et faces inchangés', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
    await faces(i.code)
    const avant = await facesDe(i.code)
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${i.code}'`,
      () => changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'INSTRUCTION_OK',
    )
    expect(await historiques(i.code)).toHaveLength(0)
    expect(await facesDe(i.code)).toEqual(avant)
  })

  it.each([
    ['suppression des entretiens', 'BEFORE DELETE ON tf_face_train WHEN OLD.instr_code'],
    ['remise à blanc des faces', 'BEFORE UPDATE ON tf_face_train WHEN OLD.instr_code'],
  ])(
    'RG-COO-046 échec de l’effacement (%s) : le statut n’est pas changé, aucune face modifiée, aucun historique',
    async (_cas, debut) => {
      const c = await contexte()
      const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
      await faces(i.code)
      const avant = await facesDe(i.code)
      const r = await avecEchec(`${debut} = '${i.code}'`, () =>
        changer(c.headers, i.code, { version: i.version, vers: 'A_TRAITER' }),
      )
      expect(r.statusCode).toBeGreaterThanOrEqual(500)
      expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
        statut: 'INSTRUCTION_OK',
        version: i.version,
      })
      expect(await facesDe(i.code)).toEqual(avant)
      expect(await historiques(i.code)).toHaveLength(0)
    },
  )

  it('RG-X-065 échec au milieu de l’annulation d’un dossier (2e ligne) : dossier, lignes et historique inchangés', async () => {
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const l1 = await f.createReceptionAttendue(db, { contNum: dossier.contNum })
    const l2 = await f.createReceptionAttendue(db, { contNum: dossier.contNum })
    await expect(
      avecEchec(`BEFORE UPDATE ON tf_prepa_affiche WHEN OLD.id = ${String(l2.id)}`, () =>
        withTransaction(db, (tx) => annulerDossier(tx, dossier.contNum)),
      ),
    ).rejects.toThrow()
    expect(await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).toMatchObject({
      statut: 'PREPARATION_RECUE',
      version: dossier.version,
    })
    for (const l of [l1, l2]) {
      expect(await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({
        etatLigne: 'ACTIVE',
        version: l.version,
      })
    }
    expect(await historiques(dossier.contNum)).toHaveLength(0)
    expect(await db.journalAudit.count({ where: { entiteId: String(dossier.contNum) } })).toBe(0)
  })

  it('RG-COO-061 échec de l’historique à l’annulation d’un dossier : rien n’est annulé', async () => {
    const dossier = await f.createDossier(db)
    const l = await f.createReceptionAttendue(db, { contNum: dossier.contNum })
    await expect(
      avecEchec(
        `BEFORE INSERT ON statut_historique WHEN NEW.entite_id = '${String(dossier.contNum)}'`,
        () => withTransaction(db, (tx) => annulerDossier(tx, dossier.contNum)),
      ),
    ).rejects.toThrow()
    expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).statut).toBe(
      'A_TRAITER',
    )
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).etatLigne).toBe(
      'ACTIVE',
    )
  })

  it('RG-COO-061 échec de l’historique à l’intégration d’une instruction : l’instruction n’est pas créée', async () => {
    const d = broadcast()
    await expect(
      avecEchec(`BEFORE INSERT ON statut_historique WHEN NEW.entite_id = '${d.code}'`, () =>
        withTransaction(db, (tx) => integrerInstruction(tx, d)),
      ),
    ).rejects.toThrow()
    expect(await db.instruction.findUnique({ where: { code: d.code } })).toBeNull()
    expect(await db.journalAudit.count({ where: { entiteId: d.code } })).toBe(0)
  })

  it('RG-COO-061 échec de l’historique au passage ERREUR → EN_COURS : l’instruction reste ERREUR', async () => {
    const d = broadcast({ annonceur: 'NOUVEAU' })
    const existante = await f.createInstruction(db, {
      code: d.code,
      statut: 'ERREUR',
      annonceur: 'ANCIEN',
    })
    await expect(
      avecEchec(`BEFORE INSERT ON statut_historique WHEN NEW.entite_id = '${d.code}'`, () =>
        withTransaction(db, (tx) => integrerInstruction(tx, d)),
      ),
    ).rejects.toThrow()
    expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
      statut: 'ERREUR',
      annonceur: 'ANCIEN',
      version: existante.version,
    })
  })

  it('RG-COO-063 échec du journal à l’intégration de la prépa : le dossier reste A_TRAITER, sans historique', async () => {
    const dossier = await f.createDossier(db)
    await expect(
      avecEchec(
        `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${String(dossier.contNum)}'`,
        () => withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum)),
      ),
    ).rejects.toThrow()
    expect(await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).toMatchObject({
      statut: 'A_TRAITER',
      version: dossier.version,
    })
    expect(await historiques(dossier.contNum)).toHaveLength(0)
  })
})

// ───────────────────────────── RG-X-065 / RG-COO-087 ─────────────────────────────

describe('RG-X-065 / RG-COO-087 annulation d’un dossier après réception (compléments)', () => {
  const sommeStock = async (afficheId: number) =>
    (await db.mouvement.aggregate({ where: { afficheId }, _sum: { quantite: true } }))._sum
      .quantite ?? 0

  /** Dossier + ligne attendue + palette (réception) au statut voulu + affiche en stock rattachée. */
  async function dossierRecu(
    statutReception: StatutReception,
    affiche: Parameters<typeof f.createAffiche>[1] = {},
  ) {
    const plateforme = await f.createPlateforme(db)
    const support = await f.createSupport(db)
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    const ligne = await f.createReceptionAttendue(db, {
      plateformeId: plateforme.id,
      supportId: support.id,
      contNum: dossier.contNum,
    })
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: statutReception,
    })
    const a = await f.createAffiche(db, {
      plateformeId: plateforme.id,
      supportId: support.id,
      receptionId: reception.id,
      contNum: dossier.contNum,
      quantite: 12,
      ...affiche,
    })
    await f.createMouvement(db, {
      afficheId: a.id,
      type: 'RECEPTION',
      quantite: 12,
      receptionId: reception.id,
    })
    const lien = await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: ligne.id,
      quantite: 12,
    })
    return { plateforme, support, dossier, ligne, reception, affiche: a, lien }
  }

  it.each([['A_IDENTIFIER'], ['A_CONTROLER'], ['CONTROLEE']] as const)(
    'RG-X-065 palette %s : réception inchangée, aucun mouvement, stock et affiche inchangés, lien conservé actif',
    async (statutReception) => {
      const x = await dossierRecu(statutReception)
      const mouvementsAvant = await db.mouvement.count()
      const r = await withTransaction(db, (tx) => annulerDossier(tx, x.dossier.contNum))
      expect(r).toMatchObject({ resultat: 'ANNULE', lignesAnnulees: 1, affichesConservees: 1 })
      expect(await db.reception.findUniqueOrThrow({ where: { id: x.reception.id } })).toMatchObject(
        {
          statut: statutReception,
          version: x.reception.version,
        },
      )
      expect(await db.mouvement.count()).toBe(mouvementsAvant)
      expect(await sommeStock(x.affiche.id)).toBe(12)
      expect(await db.affiche.findUniqueOrThrow({ where: { id: x.affiche.id } })).toMatchObject({
        statut: x.affiche.statut,
        quantite: 12,
        version: x.affiche.version,
        validationAdmin: x.affiche.validationAdmin,
      })
      expect(
        await db.afficheAttendue.findUniqueOrThrow({ where: { id: x.lien.id } }),
      ).toMatchObject({ actif: true, quantite: 12, retireLe: null, version: x.lien.version })
      expect(
        await db.receptionAttendue.findUniqueOrThrow({ where: { id: x.ligne.id } }),
      ).toMatchObject({ etatLigne: 'ANNULEE' })
    },
  )

  it('RG-X-065 une affiche déjà validée (admin) reste en stock, sa validation persistée n’est pas touchée', async () => {
    const valideur = await f.createUtilisateur(db)
    const le = new Date('2026-10-01T10:00:00Z')
    const x = await dossierRecu('CONTROLEE', {
      validationAdmin: true,
      validationAdminParId: valideur.id,
      validationAdminLe: le,
    })
    await withTransaction(db, (tx) => annulerDossier(tx, x.dossier.contNum))
    expect(await db.affiche.findUniqueOrThrow({ where: { id: x.affiche.id } })).toMatchObject({
      validationAdmin: true,
      validationAdminParId: valideur.id,
      validationAdminLe: le,
      version: x.affiche.version,
    })
    expect(await sommeStock(x.affiche.id)).toBe(12)
  })

  it('RG-COO-087 une ligne déjà ANNULEE n’est pas retouchée (version, date de modification), même avec un lien actif', async () => {
    const x = await dossierRecu('CONTROLEE')
    const dejaAnnulee = await f.createReceptionAttendue(db, {
      plateformeId: x.plateforme.id,
      supportId: x.support.id,
      contNum: x.dossier.contNum,
      etatLigne: 'ANNULEE',
    })
    const autreAffiche = await f.createAffiche(db, {
      plateformeId: x.plateforme.id,
      supportId: x.support.id,
      contNum: x.dossier.contNum,
    })
    const lienSurAnnulee = await f.createRattachement(db, {
      afficheId: autreAffiche.id,
      ligneAttendueId: dejaAnnulee.id,
    })
    const r = await withTransaction(db, (tx) => annulerDossier(tx, x.dossier.contNum))
    expect(r).toMatchObject({ lignesAnnulees: 1, affichesConservees: 1 })
    expect(
      await db.receptionAttendue.findUniqueOrThrow({ where: { id: dejaAnnulee.id } }),
    ).toMatchObject({
      etatLigne: 'ANNULEE',
      version: dejaAnnulee.version,
      updatedAt: dejaAnnulee.updatedAt,
    })
    expect(
      await db.afficheAttendue.findUniqueOrThrow({ where: { id: lienSurAnnulee.id } }),
    ).toMatchObject({ actif: true, version: lienSurAnnulee.version })
  })

  it('RG-COO-087 dossier sans aucune affiche reçue : lignes ANNULEE (jamais supprimées), aucune affiche ni mouvement', async () => {
    const dossier = await f.createDossier(db)
    const lignes = [
      await f.createReceptionAttendue(db, { contNum: dossier.contNum }),
      await f.createReceptionAttendue(db, { contNum: dossier.contNum, source: 'PREPA' }),
    ]
    const [mouvements, affiches, nbLignes] = [
      await db.mouvement.count(),
      await db.affiche.count(),
      await db.receptionAttendue.count(),
    ]
    const r = await withTransaction(db, (tx) => annulerDossier(tx, dossier.contNum))
    expect(r).toMatchObject({ resultat: 'ANNULE', lignesAnnulees: 2, affichesConservees: 0 })
    for (const l of lignes) {
      expect(await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({
        etatLigne: 'ANNULEE',
        version: l.version + 1,
      })
    }
    expect(await db.receptionAttendue.count()).toBe(nbLignes)
    expect(await db.mouvement.count()).toBe(mouvements)
    expect(await db.affiche.count()).toBe(affiches)
  })

  it('RG-COO-087 dossier sans ligne attendue : ANNULE, zéro ligne annulée', async () => {
    const dossier = await f.createDossier(db)
    expect(await withTransaction(db, (tx) => annulerDossier(tx, dossier.contNum))).toMatchObject({
      resultat: 'ANNULE',
      lignesAnnulees: 0,
      affichesConservees: 0,
    })
  })

  it('RG-X-065 les lignes et liens d’un AUTRE dossier ne sont pas touchés (affiche partagée entre deux dossiers)', async () => {
    const x = await dossierRecu('CONTROLEE')
    const autreDossier = await f.createDossier(db)
    const autreLigne = await f.createReceptionAttendue(db, {
      plateformeId: x.plateforme.id,
      supportId: x.support.id,
      contNum: autreDossier.contNum,
    })
    const autreLien = await f.createRattachement(db, {
      afficheId: x.affiche.id,
      ligneAttendueId: autreLigne.id,
      quantite: 0,
    })
    await withTransaction(db, (tx) => annulerDossier(tx, x.dossier.contNum))
    expect(
      await db.receptionAttendue.findUniqueOrThrow({ where: { id: autreLigne.id } }),
    ).toMatchObject({ etatLigne: 'ACTIVE', version: autreLigne.version })
    expect(
      await db.afficheAttendue.findUniqueOrThrow({ where: { id: autreLien.id } }),
    ).toMatchObject({ actif: true, version: autreLien.version })
    expect(await db.dossier.findUniqueOrThrow({ where: { id: autreDossier.id } })).toMatchObject({
      statut: autreDossier.statut,
    })
    expect(await sommeStock(x.affiche.id)).toBe(12)
  })

  it('RG-X-065 test de rejet : un second appel d’annulation (409) ne crée aucun mouvement et ne change pas le stock', async () => {
    const x = await dossierRecu('A_CONTROLER')
    await withTransaction(db, (tx) => annulerDossier(tx, x.dossier.contNum))
    const mouvements = await db.mouvement.count()
    await expect(
      withTransaction(db, (tx) => annulerDossier(tx, x.dossier.contNum)),
    ).rejects.toMatchObject({ httpStatus: 409 })
    expect(await db.mouvement.count()).toBe(mouvements)
    expect(await sommeStock(x.affiche.id)).toBe(12)
  })
})

// ───────────────────────────── RG-COO-001 ─────────────────────────────

describe('RG-COO-001 deux circuits indépendants (compléments)', () => {
  /** Coordination d'un site, dossier au statut de préparation voulu, instruction et affiche du dossier. */
  async function dossierEtAffiche(
    statutInstruction: StatutInstruction,
    statutDossier: StatutDossier,
    validee = false,
  ) {
    const c = await contexte(['coord'])
    const i = await instruction(c.atelier.id, statutInstruction, statutDossier)
    const affiche = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: i.contNum,
      statut: 'IDENTIFIEE',
      ...(validee
        ? { validationAdmin: true, validationAdminParId: c.user.id, validationAdminLe: new Date() }
        : {}),
    })
    // RG-COO-007 : une affiche sans lien est une « réception inconnue » (non validable) : lien vers une ligne du
    // dossier (données alignées sur l'état calculé, audit COO-P04).
    const l = await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: i.contNum,
    })
    await f.createRattachement(db, { afficheId: affiche.id, ligneAttendueId: l.id, quantite: 1 })
    return { c, i, affiche }
  }

  const validation = (h: Record<string, string>, id: number, version: number, valider: boolean) =>
    post(ctx, `/api/affiches/${String(id)}/validation-admin`, h, { version, valider })

  it.each([
    ['A_TRAITER', 'A_TRAITER'],
    ['EN_COURS', 'PREPARATION_RECUE'],
    ['INSTRUCTION_OK', 'PREPARATION_RECUE'],
    ['ANNULE', 'PREPARATION_RECUE'],
    ['PRET_A_PRODUIRE', 'PREPARATION_RECUE'],
    ['ERREUR', 'A_TRAITER'],
  ] as const)(
    'RG-COO-001 la validation admin n’est pas bloquée par une instruction %s (dossier %s) et ne la modifie pas',
    async (statutInstruction, statutDossier) => {
      const x = await dossierEtAffiche(statutInstruction, statutDossier)
      const r = await validation(x.c.headers, x.affiche.id, x.affiche.version, true)
      expect(r.statusCode).toBe(200)
      expect(
        (await db.affiche.findUniqueOrThrow({ where: { id: x.affiche.id } })).validationAdmin,
      ).toBe(true)
      expect(await db.instruction.findUniqueOrThrow({ where: { code: x.i.code } })).toMatchObject({
        statut: statutInstruction,
        version: x.i.version,
      })
    },
  )

  it.each([['A_TRAITER'], ['INSTRUCTION_OK']] as const)(
    'RG-COO-001 l’annulation de la validation n’est pas bloquée par une instruction %s',
    async (statutInstruction) => {
      const x = await dossierEtAffiche(statutInstruction, 'PREPARATION_RECUE', true)
      const r = await validation(x.c.headers, x.affiche.id, x.affiche.version, false)
      expect(r.statusCode).toBe(200)
      expect((await db.instruction.findUniqueOrThrow({ where: { code: x.i.code } })).statut).toBe(
        statutInstruction,
      )
    },
  )

  it.each([
    [false, 'EN_COURS'],
    [true, 'EN_COURS'],
    [false, 'ANNULE'],
    [true, 'A_TRAITER'],
  ] as const)(
    'RG-COO-001 (inverse) affiche validée=%s : le retour arrière INSTRUCTION_OK → %s n’est pas bloqué et ne touche pas la validation',
    async (validee, vers) => {
      const x = await dossierEtAffiche('INSTRUCTION_OK', 'PREPARATION_RECUE', validee)
      const r = await changer(x.c.headers, x.i.code, { version: x.i.version, vers })
      expect(r.statusCode).toBe(200)
      expect(await db.affiche.findUniqueOrThrow({ where: { id: x.affiche.id } })).toMatchObject({
        validationAdmin: validee,
        version: x.affiche.version,
      })
    },
  )

  it('RG-COO-001 (inverse) une affiche orpheline (réception inconnue) du dossier ne bloque pas l’annulation de l’instruction', async () => {
    const x = await dossierEtAffiche('EN_COURS', 'A_TRAITER')
    await db.affiche.update({ where: { id: x.affiche.id }, data: { statut: 'ORPHELINE' } })
    expect(
      (await changer(x.c.headers, x.i.code, { version: x.i.version, vers: 'ANNULE' })).statusCode,
    ).toBe(200)
  })

  it('RG-COO-001 l’intégration de la prépa et des instructions ne modifie pas la validation admin des affiches', async () => {
    const x = await dossierEtAffiche('A_TRAITER', 'A_TRAITER', true)
    await withTransaction(db, async (tx) => {
      await integrerPreparation(tx, x.i.contNum ?? 0)
      await integrerInstruction(tx, broadcast({ code: x.i.code, contNum: x.i.contNum ?? 0 }))
    })
    // Q-204 (b) : Instruction OK automatique (instruction conforme) — sans lire ni toucher la validation admin.
    expect((await db.instruction.findUniqueOrThrow({ where: { code: x.i.code } })).statut).toBe(
      'INSTRUCTION_OK',
    )
    expect(await db.affiche.findUniqueOrThrow({ where: { id: x.affiche.id } })).toMatchObject({
      validationAdmin: true,
      version: x.affiche.version,
    })
  })
})
