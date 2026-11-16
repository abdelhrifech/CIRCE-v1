// COO-P02 — Instruction OK (automatique dès la prépa — Q-204 option b —, manuelle), saisie de la Coordination,
// écart et version Broadcast, demande de correction, fiche dossier.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FicheDossierSchema, ListeDossiersSchema, type Role } from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import {
  integrerInstruction,
  integrerPreparation,
  type InstructionBroadcast,
} from '../../src/modules/coordination/integration.ts'
import type { StatutInstruction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import {
  contexteReception,
  erreur,
  get,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

async function contexte(roles: Role[] = ['coord']) {
  const s = await site(ctx, roles)
  const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
  return { ...s, atelier }
}

/** Instruction d'un dossier, avec n détails (exceptions) et n faces hors entretien, visuels à `pct` %. */
async function instruction(
  atelierId: number,
  o: {
    statut?: StatutInstruction
    preparation?: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE'
    exceptions?: number
    faces?: number
    pct?: readonly number[]
    commentaire?: string | null
  } = {},
) {
  const dossier = await f.createDossier(db, { statut: o.preparation ?? 'PREPARATION_RECUE' })
  const i = await f.createInstruction(db, {
    atelierId,
    statut: o.statut ?? 'EN_COURS',
    dossierId: dossier.id,
    contNum: dossier.contNum,
    contAnbas: 2026,
    contSembas: 45,
    commentaire: o.commentaire ?? null,
    entretien: 8,
    tipInsCode: 0,
  })
  for (let k = 0; k < (o.exceptions ?? 2); k++)
    await f.createInstructionDetail(db, { instructionCode: i.code, cadrIdent: k })
  for (let k = 0; k < (o.faces ?? 2); k++)
    await f.createFaceTrain(db, { instructionCode: i.code, ftType: 'contrat', statut: 'EN_COURS' })
  for (const p of o.pct ?? [100])
    await f.createInstructionVisuel(db, { instructionCode: i.code, pourcentage: p })
  return { dossier, i }
}

const iok = (headers: Record<string, string>, instructions: { code: string; version: number }[]) =>
  post(ctx, '/api/coordination/instruction-ok', headers, { instructions })
const patch = (headers: Record<string, string>, code: string, payload: object) =>
  ctx.app.inject({
    method: 'PATCH',
    url: `/api/coordination/instructions/${code}`,
    headers,
    payload,
  })

describe('RG-COO-044 / 043 / 052 / 051 Instruction OK après contrôle', () => {
  it('RG-COO-044 coord passe une instruction « En cours » en Instruction OK (MANUEL, nom, date), historique et journal', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { commentaire: 'Visuel B en tête de train' })
    const r = await iok(c.headers, [{ code: i.code, version: i.version }])
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toContain('1 instruction(s) en Instruction OK')
    const apres = await db.instruction.findUniqueOrThrow({ where: { code: i.code } })
    expect(apres).toMatchObject({
      statut: 'INSTRUCTION_OK',
      iokMode: 'MANUEL',
      iokParId: c.user.id,
    })
    expect(apres.iokLe).not.toBeNull()
    expect(
      await db.statutHistorique.findFirstOrThrow({ where: { entiteId: i.code } }),
    ).toMatchObject({
      ancien: 'EN_COURS',
      nouveau: 'INSTRUCTION_OK',
      parId: c.user.id,
      regle: 'RG-COO-044',
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: i.code, action: 'INSTRUCTION_OK', parId: c.user.id },
      }),
    ).toBe(1)
  })

  it.each([
    ['A_TRAITER'],
    ['INSTRUCTION_OK'],
    ['ANNULE'],
    ['PRET_A_PRODUIRE'],
    ['ERREUR'],
  ] as const)(
    'RG-COO-044 une instruction %s ne passe pas en Instruction OK (409)',
    async (statut) => {
      const c = await contexte()
      const { i } = await instruction(c.atelier.id, { statut })
      const r = await iok(c.headers, [{ code: i.code, version: i.version }])
      expect(r.statusCode).toBe(409)
      expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
        statut,
      )
    },
  )

  it('RG-COO-052 pas d’Instruction OK avant la prépa (422)', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { preparation: 'A_TRAITER' })
    const r = await iok(c.headers, [{ code: i.code, version: i.version }])
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_PREPA_NON_RECUE', regle: 'RG-COO-052' })
  })

  it('RG-COO-052 prépa reçue : l’Instruction OK est permise', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { preparation: 'PREPARATION_RECUE' })
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
  })

  it('RG-COO-043 répartition des thèmes différente de 100 % : 422 « La répartition des thèmes n’est pas à 100 % ! »', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { pct: [60, 30] })
    const r = await iok(c.headers, [{ code: i.code, version: i.version }])
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      message: 'La répartition des thèmes n’est pas à 100 % !',
      regle: 'RG-COO-043',
    })
  })

  it('RG-COO-043 répartition à 100 % sur plusieurs thèmes : Instruction OK permise', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { pct: [60, 40] })
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
  })

  it('RG-COO-051 action groupée : toutes les instructions cochées passent ensemble', async () => {
    const c = await contexte()
    const a2 = await f.createAtelier(db, { plateformeId: c.plateforme.id })
    const x = await instruction(c.atelier.id)
    const y = await instruction(a2.id)
    const r = await iok(c.headers, [
      { code: x.i.code, version: x.i.version },
      { code: y.i.code, version: y.i.version },
    ])
    expect(r.statusCode).toBe(200)
    expect(
      await db.instruction.count({
        where: { code: { in: [x.i.code, y.i.code] }, statut: 'INSTRUCTION_OK' },
      }),
    ).toBe(2)
  })

  it('RG-COO-051 action groupée tout ou rien : un refus annule toute la sélection', async () => {
    const c = await contexte()
    const x = await instruction(c.atelier.id)
    const y = await instruction(c.atelier.id, { pct: [50] })
    const r = await iok(c.headers, [
      { code: x.i.code, version: x.i.version },
      { code: y.i.code, version: y.i.version },
    ])
    expect(r.statusCode).toBe(422)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: x.i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it.each([['cheq'], ['recep'], ['expe'], ['com']] as const)(
    'RG-COO-044 le profil %s ne passe pas l’Instruction OK (403)',
    async (role) => {
      const c = await contexte([role])
      const { i } = await instruction(c.atelier.id)
      expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(403)
    },
  )

  it('RG-COO-044 le profil admin passe l’Instruction OK', async () => {
    const c = await contexte(['admin'])
    const { i } = await instruction(c.atelier.id)
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(200)
  })

  it('RG-COO-044 version périmée : 409, aucune écriture', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    expect((await iok(c.headers, [{ code: i.code, version: i.version + 3 }])).statusCode).toBe(409)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-167 Instruction OK sur une instruction hors périmètre : 403', async () => {
    const c = await contexte()
    const { i } = await instruction((await f.createAtelier(db)).id)
    expect((await iok(c.headers, [{ code: i.code, version: i.version }])).statusCode).toBe(403)
  })
})

describe('RG-COO-042 Instruction OK automatique dès la prépa (Q-204 option b)', () => {
  async function aTraiter(o: Parameters<typeof instruction>[1] = {}) {
    const atelier = await f.createAtelier(db)
    return instruction(atelier.id, { ...o, preparation: 'A_TRAITER' })
  }

  it('RG-COO-042 à l’arrivée de la prépa, une instruction conforme passe Instruction OK automatique (« règle automatique »)', async () => {
    const { dossier, i } = await aTraiter()
    expect(await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))).toBe(
      'PREPARATION_RECUE',
    )
    const apres = await db.instruction.findUniqueOrThrow({ where: { code: i.code } })
    expect(apres).toMatchObject({ statut: 'INSTRUCTION_OK', iokMode: 'AUTO', iokParId: null })
    expect(
      await db.statutHistorique.findFirstOrThrow({ where: { entiteId: i.code } }),
    ).toMatchObject({
      parId: null,
      regle: 'RG-COO-042',
      motif: 'Instruction ok automatique (règle automatique)',
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: i.code, action: 'INSTRUCTION_OK_AUTOMATIQUE' },
      }),
    ).toBe(1)
  })

  it.each([
    ['un commentaire de prépa', { commentaire: 'Entretien de 15 % demandé' }],
    ['exceptions ≠ quantité', { exceptions: 3, faces: 2 }],
    ['une répartition à 90 %', { pct: [90] }],
  ] as const)('RG-COO-042 avec %s, l’instruction reste « En cours »', async (_cas, o) => {
    const { dossier, i } = await aTraiter(o)
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-042 / RG-COO-055 un écart Broadcast / Circé garde l’instruction « En cours » (motif écart)', async () => {
    const { dossier, i } = await aTraiter()
    // Q-183 (11) : ligne sur la plateforme de l'atelier de l'instruction.
    const atelier = await db.atelier.findUniqueOrThrow({ where: { id: i.atelierId ?? 0 } })
    await f.createReceptionAttendue(db, {
      plateformeId: atelier.plateformeId,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 8,
      source: 'PREPA',
    })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-042 / RG-COO-052 sans prépa reçue, l’intégration d’une instruction conforme ne passe pas Instruction OK', async () => {
    const dossier = await f.createDossier(db, { statut: 'A_TRAITER' })
    const d: InstructionBroadcast = {
      code: `AUTO${String(f.next()).padStart(8, '0')}`,
      type: 'contrat',
      contNum: dossier.contNum,
      semaine: { annee: 2026, semaine: 46 },
      atelierId: null,
      annonceur: null,
      commentaire: null,
      sectCodeCentre: 1,
      talrTrait: '1',
    }
    await withTransaction(db, (tx) => integrerInstruction(tx, d))
    expect((await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).statut).toBe(
      'EN_COURS',
    )
  })
})

describe('RG-COO-054 renvoi de prépa avant l’export : réouverture (Q-204 option b)', () => {
  async function iokAvecFaces() {
    const atelier = await f.createAtelier(db)
    const x = await instruction(atelier.id, {
      statut: 'INSTRUCTION_OK',
      commentaire: 'à contrôler',
    })
    await db.instruction.update({
      where: { code: x.i.code },
      data: { iokMode: 'MANUEL', iokLe: new Date() },
    })
    await f.createFaceTrain(db, {
      instructionCode: x.i.code,
      ftType: 'entretien',
      statut: 'INSTRUCTION_OK',
      theme: 'T',
    })
    return x
  }

  it('RG-COO-054 renvoi de prépa : INSTRUCTION_OK → EN_COURS, Instruction OK effacée, calcul des trains effacé, historique', async () => {
    const { dossier, i } = await iokAvecFaces()
    expect(await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))).toBe(
      'DEJA_RECUE',
    )
    expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
      statut: 'EN_COURS',
      iokMode: null,
      iokLe: null,
    })
    expect(
      await db.faceTrain.count({ where: { instructionCode: i.code, ftType: 'entretien' } }),
    ).toBe(0)
    expect(
      await db.statutHistorique.findFirstOrThrow({
        where: { entiteId: i.code, regle: 'RG-COO-054' },
      }),
    ).toMatchObject({ ancien: 'INSTRUCTION_OK', nouveau: 'EN_COURS', parId: null })
  })

  it('RG-COO-054 renvoi d’une instruction en Instruction OK : rouverte puis mise à jour', async () => {
    const { dossier, i } = await iokAvecFaces()
    const r = await withTransaction(db, (tx) =>
      integrerInstruction(tx, {
        code: i.code,
        type: 'contrat',
        contNum: dossier.contNum,
        semaine: { annee: 2026, semaine: 45 },
        atelierId: i.atelierId,
        annonceur: 'RENVOI',
        commentaire: 'corrigé',
        sectCodeCentre: 1,
        talrTrait: '1',
      }),
    )
    expect(r).toBe('ROUVERTE')
    expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
      statut: 'EN_COURS',
      annonceur: 'RENVOI',
    })
  })

  it('RG-COO-054 / RG-COO-053 après l’export (PRET_A_PRODUIRE), un renvoi ne rouvre rien', async () => {
    const atelier = await f.createAtelier(db)
    const { dossier, i } = await instruction(atelier.id, { statut: 'PRET_A_PRODUIRE' })
    await withTransaction(db, (tx) => integrerPreparation(tx, dossier.contNum))
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'PRET_A_PRODUIRE',
    )
  })

  it('RG-COO-054 / RG-COO-001 la réouverture ne touche pas la validation admin des affiches', async () => {
    const s = await site(ctx, ['coord'])
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    const contNum = rv.ligne.contNum ?? 0
    const dossier = await f.createDossier(db, { contNum, statut: 'PREPARATION_RECUE' })
    const i = await f.createInstruction(db, {
      statut: 'INSTRUCTION_OK',
      dossierId: dossier.id,
      contNum,
      commentaire: 'x',
    })
    await db.affiche.update({ where: { id: rv.afficheId }, data: { validationAdmin: true } })
    const avant = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    await withTransaction(db, (tx) => integrerPreparation(tx, contNum))
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
    expect(await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).toMatchObject({
      validationAdmin: true,
      version: avant.version,
    })
  })
})

describe('RG-COO-047 / 048 / 050 saisie de la Coordination', () => {
  it('RG-COO-047 instruction en Instruction OK : entretien, position, annonceur figés (409)', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { statut: 'INSTRUCTION_OK' })
    for (const champ of [{ entretien: 12 }, { position: 1 }, { annonceur: 'AUTRE' }]) {
      const r = await patch(c.headers, i.code, { version: i.version, ...champ })
      expect(r.statusCode).toBe(409)
      expect(erreur(r).regle).toBe('RG-COO-047')
    }
  })

  it('RG-COO-047 le commentaire reste modifiable après l’Instruction OK', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { statut: 'PRET_A_PRODUIRE' })
    expect(
      (await patch(c.headers, i.code, { version: i.version, commentaire: 'note' })).statusCode,
    ).toBe(200)
  })

  it('RG-COO-047 une modification d’annonceur « En cours » se répercute sur toutes les faces', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    expect(
      (await patch(c.headers, i.code, { version: i.version, annonceur: 'NOUVEL ANNONCEUR' }))
        .statusCode,
    ).toBe(200)
    expect(
      await db.faceTrain.count({
        where: { instructionCode: i.code, NOT: { contAnnonc: 'NOUVEL ANNONCEUR' } },
      }),
    ).toBe(0)
  })

  it('RG-COO-048 entretien « En cours » : 15 accepté, journalisé (ModificationInstructionPlus)', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    expect((await patch(c.headers, i.code, { version: i.version, entretien: 15 })).statusCode).toBe(
      200,
    )
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).entretien).toBe(15)
    expect(
      await db.journalAudit.findFirstOrThrow({
        where: { entiteId: i.code, action: 'MODIFICATION_INSTRUCTION_PLUS' },
      }),
    ).toMatchObject({
      ancienneValeur: '8',
      nouvelleValeur: '15',
      complement: 'entretien',
      parId: c.user.id,
    })
  })

  it.each([[31], [-1]])('RG-COO-048 entretien %i hors bornes (0-30) : 422', async (v) => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await patch(c.headers, i.code, { version: i.version, entretien: v })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-048')
  })

  it('RG-COO-048 / RG-COO-052 entretien non modifiable quand la prépa n’est pas reçue (409, Q-183 (18))', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { preparation: 'A_TRAITER' })
    const r = await patch(c.headers, i.code, { version: i.version, entretien: 10 })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-048')
    expect(
      (await patch(c.headers, i.code, { version: i.version, commentaire: 'libre' })).statusCode,
    ).toBe(200)
  })

  it('RG-COO-048 entretien non modifiable sur une instruction « À traiter » (409)', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id, { statut: 'A_TRAITER' })
    const r = await patch(c.headers, i.code, { version: i.version, entretien: 10 })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-048')
  })

  it('RG-COO-048 entretien repris de Broadcast à l’intégration (sans ressaisie) ; 8 % à défaut', async () => {
    const base = {
      type: 'contrat' as const,
      contNum: 990000 + (f.next() % 9999),
      semaine: { annee: 2026, semaine: 47 },
      atelierId: null,
      annonceur: null,
      commentaire: null,
      sectCodeCentre: 1,
      talrTrait: '1',
    }
    const a = { ...base, code: `ENTA${String(f.next()).padStart(8, '0')}`, entretien: 12 }
    const b = { ...base, code: `ENTB${String(f.next()).padStart(8, '0')}` }
    await withTransaction(db, (tx) => integrerInstruction(tx, a))
    await withTransaction(db, (tx) => integrerInstruction(tx, b))
    expect((await db.instruction.findUniqueOrThrow({ where: { code: a.code } })).entretien).toBe(12)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: b.code } })).entretien).toBe(8)
  })

  it('RG-COO-050 position 2 (fin de train) acceptée « En cours »', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    expect((await patch(c.headers, i.code, { version: i.version, position: 2 })).statusCode).toBe(
      200,
    )
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).tipInsCode).toBe(2)
  })

  it('RG-COO-050 position hors liste (5) : 422', async () => {
    const c = await contexte()
    const { i } = await instruction(c.atelier.id)
    const r = await patch(c.headers, i.code, { version: i.version, position: 5 })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-050')
  })

  it.each([['cheq'], ['com']] as const)(
    'RG-COO-048 le profil %s ne modifie pas l’entretien (403)',
    async (role) => {
      const c = await contexte([role])
      const { i } = await instruction(c.atelier.id)
      expect(
        (await patch(c.headers, i.code, { version: i.version, entretien: 10 })).statusCode,
      ).toBe(403)
    },
  )

  it('RG-COO-049 répartition reprise de Broadcast : pourcentage initial conservé (_ori)', async () => {
    const d: InstructionBroadcast = {
      code: `REP${String(f.next()).padStart(8, '0')}`,
      type: 'contrat',
      contNum: 980000 + (f.next() % 9999),
      semaine: { annee: 2026, semaine: 47 },
      atelierId: null,
      annonceur: null,
      commentaire: null,
      sectCodeCentre: 1,
      talrTrait: '1',
      visuels: [
        { afchIdent: 1, supportId: null, typePreparationId: null, theme: 'A', pourcentage: 70 },
        { afchIdent: 2, supportId: null, typePreparationId: null, theme: 'B', pourcentage: 30 },
      ],
    }
    await withTransaction(db, (tx) => integrerInstruction(tx, d))
    const v = await db.instructionVisuel.findMany({
      where: { instructionCode: d.code },
      orderBy: { afchIdent: 'asc' },
    })
    expect(v.map((x) => [Number(x.pourcentage), Number(x.pourcentageOri)])).toEqual([
      [70, 70],
      [30, 30],
    ])
  })

  it('RG-COO-049 un renvoi sans visuel ne crée aucune répartition', async () => {
    const d: InstructionBroadcast = {
      code: `REQ${String(f.next()).padStart(8, '0')}`,
      type: 'contrat',
      contNum: 980000 + (f.next() % 9999),
      semaine: { annee: 2026, semaine: 47 },
      atelierId: null,
      annonceur: null,
      commentaire: null,
      sectCodeCentre: 1,
      talrTrait: '1',
    }
    await withTransaction(db, (tx) => integrerInstruction(tx, d))
    expect(await db.instructionVisuel.count({ where: { instructionCode: d.code } })).toBe(0)
  })
})

describe('RG-COO-055 / 056 écart et version Broadcast', () => {
  async function dossierAvecEcart(roles: Role[] = ['coord']) {
    const c = await contexte(roles)
    const { dossier, i } = await instruction(c.atelier.id)
    const ligne = await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 8,
      source: 'PREPA',
    })
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 5,
      qtePrepa: 0,
      source: 'PREPA',
      themeExclu: true,
    })
    return { c, dossier, i, ligne }
  }

  it('RG-COO-055 écart = Σ qte_BC − Σ qte_Circé (hors thèmes exclus), visible dans la liste et motif de l’instruction', async () => {
    const x = await dossierAvecEcart()
    const l = ListeDossiersSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/dossiers?dossier=${String(x.dossier.contNum)}`,
          x.c.headers,
        )
      ).json(),
    ).items[0]
    expect(l?.ecart).toBe(2)
    expect(l?.aFaire).toBe(true)
    expect(l?.instructions[0]?.motifs).toContain('ECART')
  })

  it('RG-COO-055 sans quantité de prépa connue, l’écart n’est pas calculé (null)', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: null,
    })
    const l = ListeDossiersSchema.parse(
      (
        await get(ctx, `/api/coordination/dossiers?dossier=${String(dossier.contNum)}`, c.headers)
      ).json(),
    ).items[0]
    expect(l?.ecart).toBeNull()
  })

  it('RG-COO-056 « Appliquer la version Broadcast » : qte_Circé := qte_BC, écart à 0, statut de la ligne attendue recalculé (même transaction)', async () => {
    const x = await dossierAvecEcart()
    // Côté Réception : 8 affiches reçues sur 8 attendues → Complète ; après alignement sur 10 → Partielle.
    const a = await f.createAffiche(db, { plateformeId: x.c.plateforme.id })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: x.ligne.id,
      quantite: 8,
      mode: 'MAIN',
    })
    await db.receptionAttendue.update({ where: { id: x.ligne.id }, data: { statut: 'COMPLETE' } })
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(x.dossier.id)}/version-broadcast`,
      x.c.headers,
      { version: x.dossier.version },
    )
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ ecart: 0 })
    expect(
      await db.receptionAttendue.findUniqueOrThrow({ where: { id: x.ligne.id } }),
    ).toMatchObject({ qtePrepa: 10, statut: 'PARTIELLE' })
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(x.dossier.contNum), action: 'APPLICATION_VERSION_BROADCAST' },
      }),
    ).toBe(1)
  })

  it('RG-COO-056 sans écart : 409, rien n’est écrit', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 10,
    })
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(dossier.id)}/version-broadcast`,
      c.headers,
      { version: dossier.version },
    )
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_SANS_ECART')
  })

  it('RG-COO-056 version périmée du dossier : 409, quantités inchangées', async () => {
    const x = await dossierAvecEcart()
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(x.dossier.id)}/version-broadcast`,
      x.c.headers,
      { version: x.dossier.version + 4 },
    )
    expect(r.statusCode).toBe(409)
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: x.ligne.id } })).qtePrepa,
    ).toBe(8)
  })

  it.each([['cheq'], ['recep'], ['com']] as const)(
    'RG-COO-056 le profil %s n’applique pas la version Broadcast (403)',
    async (role) => {
      const x = await dossierAvecEcart([role])
      expect(
        (
          await post(
            ctx,
            `/api/coordination/dossiers/${String(x.dossier.id)}/version-broadcast`,
            x.c.headers,
            { version: x.dossier.version },
          )
        ).statusCode,
      ).toBe(403)
    },
  )

  it('RG-COO-056 dossier hors périmètre : 403', async () => {
    const x = await dossierAvecEcart()
    const autre = await contexte()
    expect(
      (
        await post(
          ctx,
          `/api/coordination/dossiers/${String(x.dossier.id)}/version-broadcast`,
          autre.headers,
          { version: x.dossier.version },
        )
      ).statusCode,
    ).toBe(403)
  })
})

describe('RG-COO-057 demande de correction à Broadcast', () => {
  it('RG-COO-057 la demande est tracée (date, auteur, note), le dossier ne change pas, le mail n’est pas envoyé (Q-375)', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(dossier.id)}/corrections`,
      c.headers,
      { note: 'Quantité du thème B à revoir' },
    )
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ dejaDemandeeLe: null, mailEnvoye: false })
    expect(
      await db.demandeCorrection.findFirstOrThrow({ where: { dossierId: dossier.id } }),
    ).toMatchObject({ note: 'Quantité du thème B à revoir', parId: c.user.id, statut: 'ENVOYEE' })
    expect(await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).toMatchObject({
      statut: dossier.statut,
      version: dossier.version,
    })
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(dossier.contNum), action: 'DEMANDE_CORRECTION_BROADCAST' },
      }),
    ).toBe(1)
  })

  it('RG-COO-057 une seconde demande indique la précédente (« Le mail sera renvoyé »)', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    await post(ctx, `/api/coordination/dossiers/${String(dossier.id)}/corrections`, c.headers, {
      note: '',
    })
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(dossier.id)}/corrections`,
      c.headers,
      { note: 'relance' },
    )
    expect(r.json<{ dejaDemandeeLe: string | null }>().dejaDemandeeLe).not.toBeNull()
  })

  it.each([['cheq'], ['com'], ['recep']] as const)(
    'RG-COO-057 le profil %s ne demande pas de correction (403)',
    async (role) => {
      const c = await contexte([role])
      const { dossier } = await instruction(c.atelier.id)
      expect(
        (
          await post(
            ctx,
            `/api/coordination/dossiers/${String(dossier.id)}/corrections`,
            c.headers,
            { note: '' },
          )
        ).statusCode,
      ).toBe(403)
      expect(await db.demandeCorrection.count({ where: { dossierId: dossier.id } })).toBe(0)
    },
  )
})

describe('RG-COO-059 / 060 liste et fiche', () => {
  it('RG-COO-059 la liste propose la position d’après le commentaire, sans l’appliquer', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id, {
      commentaire: 'Visuel B en début de train',
    })
    const l = ListeDossiersSchema.parse(
      (
        await get(ctx, `/api/coordination/dossiers?dossier=${String(dossier.contNum)}`, c.headers)
      ).json(),
    ).items[0]
    expect(l?.instructions[0]).toMatchObject({
      positionProposee: 1,
      position: 0,
      motifs: ['COMMENTAIRE'],
    })
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).tipInsCode).toBe(0)
  })

  it('RG-COO-060 filtre « À faire » : instruction « En cours » incluse, Instruction OK sans écart exclue ; « Rien à faire » l’inverse', async () => {
    const c = await contexte()
    const enCours = await instruction(c.atelier.id)
    const fait = await instruction(c.atelier.id, { statut: 'INSTRUCTION_OK' })
    const ids = async (v: string) =>
      ListeDossiersSchema.parse(
        (await get(ctx, `/api/coordination/dossiers?aFaire=${v}`, c.headers)).json(),
      ).items.map((d) => d.id)
    expect(await ids('A_FAIRE')).toContain(enCours.dossier.id)
    expect(await ids('A_FAIRE')).not.toContain(fait.dossier.id)
    expect(await ids('RIEN')).toContain(fait.dossier.id)
    expect(await ids('RIEN')).not.toContain(enCours.dossier.id)
  })

  it('RG-COO-060 / RG-COO-052 prépa pas reçue : instruction « En cours » sans motifs, dossier pas « À faire » (ANO-025)', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id, {
      preparation: 'A_TRAITER',
      commentaire: 'commentaire',
    })
    const l = ListeDossiersSchema.parse(
      (
        await get(ctx, `/api/coordination/dossiers?dossier=${String(dossier.contNum)}`, c.headers)
      ).json(),
    ).items[0]
    expect(l).toMatchObject({ aFaire: false })
    expect(l?.instructions[0]?.motifs).toEqual([])
    const aFaire = ListeDossiersSchema.parse(
      (await get(ctx, '/api/coordination/dossiers?aFaire=A_FAIRE', c.headers)).json(),
    ).items.map((d) => d.id)
    expect(aFaire).not.toContain(dossier.id)
  })

  it('RG-COO-060 prépa reçue : la même instruction « En cours » rend le dossier « À faire », avec ses motifs', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id, {
      preparation: 'PREPARATION_RECUE',
      commentaire: 'commentaire',
    })
    const l = ListeDossiersSchema.parse(
      (
        await get(ctx, `/api/coordination/dossiers?dossier=${String(dossier.contNum)}`, c.headers)
      ).json(),
    ).items[0]
    expect(l).toMatchObject({ aFaire: true })
    expect(l?.instructions[0]?.motifs).toEqual(['COMMENTAIRE'])
  })

  it('RG-COO-160 la fiche dossier montre l’historique nominatif du dossier et de ses instructions', async () => {
    const c = await contexte()
    const { dossier, i } = await instruction(c.atelier.id)
    await iok(c.headers, [{ code: i.code, version: i.version }])
    await post(ctx, `/api/coordination/dossiers/${String(dossier.id)}/corrections`, c.headers, {
      note: 'n',
    })
    const fiche = FicheDossierSchema.parse(
      (await get(ctx, `/api/coordination/dossiers/${String(dossier.id)}`, c.headers)).json(),
    )
    // COO-P09 : le calcul des trains (RG-COO-200 à 205) est tracé avec l'Instruction OK, au nom de la personne.
    expect(fiche.historique.map((h) => h.action).sort()).toEqual([
      'CALCUL_TRAINS',
      'DEMANDE_CORRECTION_BROADCAST',
      'INSTRUCTION_OK',
    ])
    expect(fiche.historique.every((h) => h.par !== null)).toBe(true)
  })

  it('RG-COO-160 l’historique d’une instruction hors périmètre n’apparaît pas dans la fiche', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id)
    const ailleurs = await f.createInstruction(db, {
      atelierId: (await f.createAtelier(db)).id,
      statut: 'EN_COURS',
      dossierId: dossier.id,
      contNum: dossier.contNum,
    })
    await db.journalAudit.create({
      data: { typeEntite: 'INSTRUCTION', entiteId: ailleurs.code, action: 'INSTRUCTION_OK' },
    })
    const visible = await db.instruction.findFirstOrThrow({
      where: { dossierId: dossier.id, atelierId: c.atelier.id },
    })
    await db.journalAudit.create({
      data: { typeEntite: 'INSTRUCTION', entiteId: visible.code, action: 'INSTRUCTION_OK' },
    })
    const fiche = FicheDossierSchema.parse(
      (await get(ctx, `/api/coordination/dossiers/${String(dossier.id)}`, c.headers)).json(),
    )
    expect(fiche.historique.map((h) => h.objet)).not.toContain(`Instruction ${ailleurs.code}`)
    // Assertion positive : l'historique de l'instruction du périmètre est bien présent.
    expect(fiche.historique.length).toBeGreaterThan(0)
  })

  it('RG-COO-060 filtre « À faire » invalide : 400', async () => {
    const c = await contexte()
    expect(
      (await get(ctx, '/api/coordination/dossiers?aFaire=PEUT_ETRE', c.headers)).statusCode,
    ).toBe(400)
  })

  it('RG-COO-052 l’action Instruction OK n’est proposée qu’une fois la prépa reçue', async () => {
    const c = await contexte()
    const recue = await instruction(c.atelier.id)
    const attente = await instruction(c.atelier.id, { preparation: 'A_TRAITER' })
    const items = ListeDossiersSchema.parse(
      (await get(ctx, '/api/coordination/dossiers', c.headers)).json(),
    ).items
    expect(items.find((d) => d.id === recue.dossier.id)?.instructions[0]?.actions).toContain(
      'INSTRUCTION_OK',
    )
    expect(items.find((d) => d.id === attente.dossier.id)?.instructions[0]?.actions).not.toContain(
      'INSTRUCTION_OK',
    )
  })

  it('RG-COO-167 fiche dossier : instructions, visuels, lignes, corrections ; hors périmètre 403 ; inconnue 404', async () => {
    const c = await contexte()
    const { dossier } = await instruction(c.atelier.id, { pct: [70, 30] })
    await f.createReceptionAttendue(db, {
      plateformeId: c.plateforme.id,
      contNum: dossier.contNum,
      qteBc: 10,
      qtePrepa: 10,
    })
    const r = await get(ctx, `/api/coordination/dossiers/${String(dossier.id)}`, c.headers)
    expect(r.statusCode).toBe(200)
    const fiche = FicheDossierSchema.parse(r.json())
    expect(fiche.visuels.map((v) => v.pourcentage).sort()).toEqual([30, 70])
    expect(fiche.lignes).toHaveLength(1)
    expect(
      (
        await get(
          ctx,
          `/api/coordination/dossiers/${String(dossier.id)}`,
          (await contexte()).headers,
        )
      ).statusCode,
    ).toBe(403)
    expect((await get(ctx, '/api/coordination/dossiers/999999999', c.headers)).statusCode).toBe(404)
  })
})
