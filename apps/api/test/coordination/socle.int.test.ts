// COO-P01 — socle Coordination : statuts d'instruction, transitions, effacement du calcul des trains,
// intégration Broadcast, dossier annulé (RG-X-065), droits et périmètre.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ListeDossiersSchema, ROLES, StatutInstructionChangeSchema, type Role } from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import {
  annulerDossier,
  creerChapeauATraiter,
  integrerInstruction,
  integrerPreparation,
  type InstructionBroadcast,
} from '../../src/modules/coordination/integration.ts'
import type { StatutInstruction } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import {
  contexteReception,
  erreur,
  get,
  idem,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

/** Site + atelier + utilisateur des rôles donnés sur ce site (tous ses ateliers). */
async function contexte(roles: Role[] = ['coord']) {
  const s = await site(ctx, roles)
  const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
  return { ...s, atelier }
}

async function instruction(
  atelierId: number,
  statut: StatutInstruction = 'EN_COURS',
  contNum?: number,
) {
  const dossier = await f.createDossier(db, contNum ? { contNum } : {})
  return f.createInstruction(db, {
    atelierId,
    statut,
    dossierId: dossier.id,
    contNum: dossier.contNum,
    contAnbas: 2026,
    contSembas: 44,
  })
}

const changer = (headers: Record<string, string>, code: string, body: object) =>
  post(ctx, `/api/coordination/instructions/${code}/statut`, headers, body)

describe('RG-COO-040 / 045 / 046 transitions demandées par la Coordination', () => {
  it.each([
    ['A_TRAITER', 'ANNULE'],
    ['EN_COURS', 'ANNULE'],
    ['INSTRUCTION_OK', 'ANNULE'],
    ['INSTRUCTION_OK', 'EN_COURS'],
    ['INSTRUCTION_OK', 'A_TRAITER'],
    ['ANNULE', 'A_TRAITER'],
  ] as const)(
    'RG-COO-040 / RG-COO-045 / RG-COO-061 / RG-COO-160 transition autorisée %s → %s : statut, version, historique et journal nominatifs',
    async (de, vers) => {
      const c = await contexte()
      const i = await instruction(c.atelier.id, de)
      const r = await changer(c.headers, i.code, { version: i.version, vers })
      expect(r.statusCode).toBe(200)
      expect(StatutInstructionChangeSchema.parse(r.json())).toMatchObject({
        statut: vers,
        version: i.version + 1,
      })
      expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
        statut: vers,
        updatedById: c.user.id,
      })
      // RG-COO-061 / RG-COO-160 : historique et journal nominatifs dans la même transaction.
      expect(
        await db.statutHistorique.findMany({
          where: { typeEntite: 'INSTRUCTION', entiteId: i.code },
        }),
      ).toMatchObject([{ ancien: de, nouveau: vers, parId: c.user.id }])
      expect(
        await db.journalAudit.count({
          where: { entiteId: i.code, action: 'CHANGEMENT_STATUT_INSTRUCTION', parId: c.user.id },
        }),
      ).toBe(1)
    },
  )

  it.each([
    ['EN_COURS', 'A_TRAITER', 'RG-COO-040'],
    ['A_TRAITER', 'EN_COURS', 'RG-COO-040'],
    ['PRET_A_PRODUIRE', 'ANNULE', 'RG-COO-045'],
    ['PRET_A_PRODUIRE', 'EN_COURS', 'RG-COO-046'],
    ['ERREUR', 'ANNULE', 'RG-COO-045'],
    ['ANNULE', 'EN_COURS', 'RG-COO-045'],
    ['ANNULE', 'ANNULE', 'RG-COO-045'],
  ] as const)(
    'RG-COO-040 transition interdite %s → %s : 409 citant %s, rien n’est écrit',
    async (de, vers, regle) => {
      const c = await contexte()
      const i = await instruction(c.atelier.id, de)
      const r = await changer(c.headers, i.code, { version: i.version, vers })
      expect(r.statusCode).toBe(409)
      expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle })
      expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(de)
      expect(await db.statutHistorique.count({ where: { entiteId: i.code } })).toBe(0)
    },
  )

  it('RG-COO-040 un statut posé par Circé seulement (INSTRUCTION_OK, PRET_A_PRODUIRE) ne peut pas être demandé (400)', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    expect(
      (await changer(c.headers, i.code, { version: i.version, vers: 'PRET_A_PRODUIRE' }))
        .statusCode,
    ).toBe(400)
  })

  it('RG-COO-040 instruction inconnue : 404', async () => {
    const c = await contexte()
    expect(
      (await changer(c.headers, 'INCONNUE-XYZ', { version: 1, vers: 'ANNULE' })).statusCode,
    ).toBe(404)
  })

  it('RG-COO-040 version périmée : 409, statut inchangé', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    const r = await changer(c.headers, i.code, { version: i.version + 5, vers: 'ANNULE' })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_CONFLIT_VERSION')
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-165 une double soumission (même Idempotency-Key) ne change le statut qu’une fois', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    const h = { ...c.headers, ...idem() }
    const body = { version: i.version, vers: 'ANNULE' }
    const a = await ctx.app.inject({
      method: 'POST',
      url: `/api/coordination/instructions/${i.code}/statut`,
      headers: h,
      payload: body,
    })
    const b = await ctx.app.inject({
      method: 'POST',
      url: `/api/coordination/instructions/${i.code}/statut`,
      headers: h,
      payload: body,
    })
    expect(b.json()).toEqual(a.json())
    expect(b.headers['idempotent-replayed']).toBe('true')
    expect(await db.statutHistorique.count({ where: { entiteId: i.code } })).toBe(1)
  })
})

describe('RG-COO-046 retour arrière : effacement du calcul des trains', () => {
  async function avecFaces(statut: StatutInstruction) {
    const c = await contexte()
    const i = await instruction(c.atelier.id, statut)
    const visuel = await f.createInstructionVisuel(db, { instructionCode: i.code })
    const commun = {
      instructionCode: i.code,
      theme: 'Thème',
      themeId: 3,
      repiquage: 'R',
      repiquageId: 4,
      visuelId: visuel.id,
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
    const entretienImprime = await f.createFaceTrain(db, {
      ...commun,
      statut: 'A_IMPRIMER',
      ftType: 'entretien',
    })
    return { c, i, normale, entretien, imprimee, entretienImprime }
  }

  it.each([['EN_COURS'], ['A_TRAITER'], ['ANNULE']] as const)(
    'RG-COO-046 INSTRUCTION_OK → %s : entretiens non imprimés supprimés, faces non imprimées remises à blanc, faces « à imprimer » conservées',
    async (vers) => {
      const x = await avecFaces('INSTRUCTION_OK')
      const r = await changer(x.c.headers, x.i.code, { version: x.i.version, vers })
      expect(r.statusCode).toBe(200)
      expect(r.json()).toMatchObject({ facesSupprimees: 1, facesRemisesABlanc: 1 })
      expect(await db.faceTrain.findUnique({ where: { id: x.entretien.id } })).toBeNull()
      expect(await db.faceTrain.findUniqueOrThrow({ where: { id: x.normale.id } })).toMatchObject({
        statut: vers,
        theme: null,
        themeId: null,
        repiquage: null,
        repiquageId: null,
        visuelId: null,
        trainId: null,
        versionTrain: null,
      })
      for (const id of [x.imprimee.id, x.entretienImprime.id]) {
        expect(await db.faceTrain.findUniqueOrThrow({ where: { id } })).toMatchObject({
          statut: 'A_IMPRIMER',
          theme: 'Thème',
          trainId: 'T1',
        })
      }
    },
  )

  it('RG-COO-046 annuler une instruction EN_COURS n’efface aucune face (pas de calcul des trains à effacer)', async () => {
    const x = await avecFaces('EN_COURS')
    const r = await changer(x.c.headers, x.i.code, { version: x.i.version, vers: 'ANNULE' })
    expect(r.json()).toMatchObject({ facesSupprimees: 0, facesRemisesABlanc: 0 })
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: x.entretien.id } })).toMatchObject({
      theme: 'Thème',
    })
  })

  it('RG-COO-046 une instruction PRET_A_PRODUIRE n’est jamais soumise au retour arrière (409), faces intactes', async () => {
    const x = await avecFaces('PRET_A_PRODUIRE')
    expect(
      (await changer(x.c.headers, x.i.code, { version: x.i.version, vers: 'EN_COURS' })).statusCode,
    ).toBe(409)
    expect(await db.faceTrain.count({ where: { instructionCode: x.i.code } })).toBe(4)
  })
})

describe('RG-COO-165 / 166 / 168 / 169 droits', () => {
  it.each([['coord'], ['admin']] as const)(
    'RG-COO-166 le profil %s annule une instruction',
    async (role) => {
      const c = await contexte([role])
      const i = await instruction(c.atelier.id, 'EN_COURS')
      expect(
        (await changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' })).statusCode,
      ).toBe(200)
    },
  )

  it.each([['cheq'], ['recep'], ['expe']] as const)(
    'RG-COO-165 le profil %s ne change pas un statut d’instruction (403 PERMISSION), rien n’est écrit',
    async (role) => {
      const c = await contexte([role])
      const i = await instruction(c.atelier.id, 'INSTRUCTION_OK')
      const r = await changer(c.headers, i.code, { version: i.version, vers: 'EN_COURS' })
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle: 'RG-COO-165' })
      expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
        'INSTRUCTION_OK',
      )
    },
  )

  it('RG-COO-168 le rôle Commerce consulte la liste mais n’agit pas (403 citant RG-COO-168)', async () => {
    const c = await contexte(['com'])
    const i = await instruction(c.atelier.id, 'EN_COURS')
    const liste = ListeDossiersSchema.parse(
      (await get(ctx, '/api/coordination/dossiers', c.headers)).json(),
    )
    expect(
      liste.items.flatMap((d) => d.instructions).find((x) => x.code === i.code)?.actions,
    ).toEqual([])
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' })
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-168')
  })

  it('RG-COO-165 sans identité : 401', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/api/coordination/dossiers' })
    expect(r.statusCode).toBe(401)
  })

  it('RG-COO-166 le profil expe ne consulte pas la liste (403)', async () => {
    const c = await contexte(['expe'])
    expect((await get(ctx, '/api/coordination/dossiers', c.headers)).statusCode).toBe(403)
  })

  it('RG-COO-169 aucun rôle Pré-Prod n’existe dans Circé', () => {
    expect(ROLES.some((r) => /pre.?prod/i.test(r))).toBe(false)
  })

  it('RG-COO-169 un compte portant un rôle « preprod » (inconnu) n’obtient aucun droit de coordination (403)', async () => {
    const plateforme = await f.createPlateforme(db)
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['preprod'],
      [{ plateformeId: plateforme.id }],
    )
    const r = await get(ctx, '/api/coordination/dossiers', devHeaders(user.identifiantExterne))
    expect(r.statusCode).toBe(403)
  })
})

describe('RG-COO-167 périmètre atelier / site', () => {
  it('RG-COO-167 la liste ne montre que les ateliers du périmètre', async () => {
    const c = await contexte()
    const dedans = await instruction(c.atelier.id)
    const dehors = await instruction((await f.createAtelier(db)).id)
    const codes = ListeDossiersSchema.parse(
      (await get(ctx, '/api/coordination/dossiers', c.headers)).json(),
    ).items.flatMap((d) => d.instructions.map((i) => i.code))
    expect(codes).toContain(dedans.code)
    expect(codes).not.toContain(dehors.code)
  })

  it('RG-COO-167 changer une instruction hors périmètre : 403 COO_PERIMETRE_INTERDIT', async () => {
    const c = await contexte()
    const dehors = await instruction((await f.createAtelier(db)).id)
    const r = await changer(c.headers, dehors.code, { version: dehors.version, vers: 'ANNULE' })
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'COO_PERIMETRE_INTERDIT', regle: 'RG-COO-167' })
  })

  it('RG-COO-167 un périmètre limité à un atelier exclut les autres ateliers du même site', async () => {
    const plateforme = await f.createPlateforme(db)
    const [a1, a2] = [
      await f.createAtelier(db, { plateformeId: plateforme.id }),
      await f.createAtelier(db, { plateformeId: plateforme.id }),
    ]
    const user = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: plateforme.id, atelierId: a1.id }],
    )
    const h = devHeaders(user.identifiantExterne)
    const i2 = await instruction(a2.id)
    expect((await changer(h, i2.code, { version: i2.version, vers: 'ANNULE' })).statusCode).toBe(
      403,
    )
    const i1 = await instruction(a1.id)
    expect((await changer(h, i1.code, { version: i1.version, vers: 'ANNULE' })).statusCode).toBe(
      200,
    )
  })

  it('RG-COO-167 une instruction sans atelier n’est visible ni modifiable hors « tous les sites » (HYPOTHÈSE Q-182)', async () => {
    const c = await contexte()
    const sansAtelier = await f.createInstruction(db, {
      statut: 'EN_COURS',
      dossierId: (await f.createDossier(db)).id,
    })
    expect(
      (await changer(c.headers, sansAtelier.code, { version: sansAtelier.version, vers: 'ANNULE' }))
        .statusCode,
    ).toBe(403)
  })

  it('RG-COO-167 la liste de choix des ateliers ne contient que ceux du périmètre', async () => {
    const c = await contexte()
    const autre = await f.createAtelier(db)
    const r = await get(ctx, '/api/coordination/ateliers', c.headers)
    expect(r.statusCode).toBe(200)
    const ids = r.json<{ ateliers: { id: number }[] }>().ateliers.map((a) => a.id)
    expect(ids).toContain(c.atelier.id)
    expect(ids).not.toContain(autre.id)
  })

  it('RG-COO-167 le profil expe ne lit pas la liste des ateliers (403)', async () => {
    const c = await contexte(['expe'])
    expect((await get(ctx, '/api/coordination/ateliers', c.headers)).statusCode).toBe(403)
  })

  it('RG-COO-167 un utilisateur sans périmètre voit une liste vide', async () => {
    const user = await f.createUtilisateurAvecRoles(db, ['coord'], [])
    const r = ListeDossiersSchema.parse(
      (await get(ctx, '/api/coordination/dossiers', devHeaders(user.identifiantExterne))).json(),
    )
    expect(r.total).toBe(0)
  })
})

describe('RG-COO-041 intégration des instructions (Circé)', () => {
  const broadcast = (d: Partial<InstructionBroadcast> = {}): InstructionBroadcast => ({
    code: `INT${String(Date.now()).slice(-8)}${String(Math.floor(Math.random() * 1000))}`,
    type: 'contrat',
    contNum: 600000 + Math.floor(Math.random() * 99999),
    semaine: { annee: 2026, semaine: 45 },
    atelierId: null,
    annonceur: 'BROADCAST',
    commentaire: null,
    sectCodeCentre: 1,
    talrTrait: '1',
    ...d,
  })

  it('RG-COO-041 / RG-COO-061 une instruction nouvelle est créée EN_COURS (entretien 8 %, position standard), historique « Circé (automatique) »', async () => {
    const d = broadcast()
    expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('CREEE')
    expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
      statut: 'EN_COURS',
      entretien: 8,
      tipInsCode: 0,
      typeInstruction: 'contrat',
    })
    expect(
      await db.statutHistorique.findFirstOrThrow({ where: { entiteId: d.code } }),
    ).toMatchObject({
      ancien: null,
      nouveau: 'EN_COURS',
      parId: null,
      motif: 'Circé (automatique)',
    })
  })

  it.each([[{ sectCodeCentre: null }], [{ talrTrait: '0' }]])(
    'RG-COO-041 une instruction non éligible (%o) n’est pas intégrée',
    async (surcharge) => {
      const d = broadcast(surcharge)
      expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('NON_ELIGIBLE')
      expect(await db.instruction.findUnique({ where: { code: d.code } })).toBeNull()
    },
  )

  it.each([['A_TRAITER'], ['ERREUR']] as const)(
    'RG-COO-041 renvoi sur une instruction %s : EN_COURS, annonceur mis à jour, historique',
    async (statut) => {
      const d = broadcast({ annonceur: 'NOUVEL ANNONCEUR' })
      await f.createInstruction(db, { code: d.code, statut, annonceur: 'ANCIEN' })
      expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('MISE_A_JOUR')
      expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
        statut: 'EN_COURS',
        annonceur: 'NOUVEL ANNONCEUR',
      })
      expect(
        await db.statutHistorique.findFirstOrThrow({ where: { entiteId: d.code } }),
      ).toMatchObject({ ancien: statut, nouveau: 'EN_COURS' })
    },
  )

  it('RG-COO-041 renvoi sur une instruction EN_COURS : mise à jour sans historique de statut', async () => {
    const d = broadcast({ commentaire: 'commentaire Broadcast' })
    await f.createInstruction(db, { code: d.code, statut: 'EN_COURS' })
    expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe('MISE_A_JOUR')
    expect((await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).commentaire).toBe(
      'commentaire Broadcast',
    )
    expect(await db.statutHistorique.count({ where: { entiteId: d.code } })).toBe(0)
  })

  it.each([
    ['PRET_A_PRODUIRE', 'IGNOREE'],
    ['ANNULE', 'NON_MISE_A_JOUR'],
  ] as const)(
    'RG-COO-041 / RG-COO-053 renvoi sur une instruction %s : inchangée, renvoi tracé (pas d’oubli silencieux)',
    async (statut, attendu) => {
      const d = broadcast({ annonceur: 'NE DOIT PAS ÉCRASER' })
      await f.createInstruction(db, { code: d.code, statut, annonceur: 'FIGÉ' })
      expect(await withTransaction(db, (tx) => integrerInstruction(tx, d))).toBe(attendu)
      expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
        statut,
        annonceur: 'FIGÉ',
      })
      expect(
        await db.journalAudit.count({
          where: { entiteId: d.code, action: 'RENVOI_BROADCAST_IGNORE' },
        }),
      ).toBe(1)
    },
  )

  it('RG-COO-041 détails en annule-et-remplace et visuels mis à jour (thème, pourcentage), valeurs d’origine gardées', async () => {
    const d = broadcast({
      details: [
        {
          cadrIdent: 1,
          cadreLib: 'A',
          supportId: null,
          typePreparationId: null,
          afchIdent: 11,
          theme: 'V1',
          repiquageIdent: null,
          repiquage: null,
          type: 'contrat',
        },
      ],
      visuels: [
        {
          afchIdent: 11,
          supportId: null,
          typePreparationId: null,
          theme: 'Thème 1',
          pourcentage: 60,
        },
      ],
    })
    await withTransaction(db, (tx) => integrerInstruction(tx, d))
    const d2 = {
      ...d,
      details: [
        {
          cadrIdent: 2,
          cadreLib: 'B',
          supportId: null,
          typePreparationId: null,
          afchIdent: 11,
          theme: 'V1',
          repiquageIdent: null,
          repiquage: null,
          type: 'contrat',
        },
        {
          cadrIdent: 3,
          cadreLib: 'C',
          supportId: null,
          typePreparationId: null,
          afchIdent: 12,
          theme: 'V2',
          repiquageIdent: null,
          repiquage: null,
          type: 'contrat',
        },
      ],
      visuels: [
        {
          afchIdent: 11,
          supportId: null,
          typePreparationId: null,
          theme: 'Thème 1 bis',
          pourcentage: 40,
        },
      ],
    }
    expect(await withTransaction(db, (tx) => integrerInstruction(tx, d2))).toBe('MISE_A_JOUR')
    expect(
      (await db.instructionDetail.findMany({ where: { instructionCode: d.code } }))
        .map((x) => x.cadrIdent)
        .sort(),
    ).toEqual([2, 3])
    const v = await db.instructionVisuel.findFirstOrThrow({
      where: { instructionCode: d.code, afchIdent: 11 },
    })
    expect(v).toMatchObject({ theme: 'Thème 1 bis', themeOri: 'Thème 1' })
    expect(Number(v.pourcentage)).toBe(40)
    expect(Number(v.pourcentageOri)).toBe(60)
  })

  it('RG-COO-041 renvoi ignoré (PRET_A_PRODUIRE) : détails et visuels figés', async () => {
    const d = broadcast()
    await f.createInstruction(db, { code: d.code, statut: 'PRET_A_PRODUIRE' })
    await f.createInstructionDetail(db, { instructionCode: d.code, cadrIdent: 99 })
    await withTransaction(db, (tx) =>
      integrerInstruction(tx, {
        ...d,
        details: [],
        visuels: [
          { afchIdent: 5, supportId: null, typePreparationId: null, theme: 'X', pourcentage: 1 },
        ],
      }),
    )
    expect(
      (await db.instructionDetail.findMany({ where: { instructionCode: d.code } })).map(
        (x) => x.cadrIdent,
      ),
    ).toEqual([99])
    expect(await db.instructionVisuel.count({ where: { instructionCode: d.code } })).toBe(0)
  })

  it('RG-COO-041 chapeau manquant créé À traiter (type contrat, « BC ») ; pas de doublon', async () => {
    const d = {
      code: `CHAP${String(Date.now()).slice(-9)}`,
      contNum: 700001,
      semaine: { annee: 2026, semaine: 46 },
      atelierId: null,
    }
    expect(await withTransaction(db, (tx) => creerChapeauATraiter(tx, d))).toBe('CREEE')
    expect(await db.instruction.findUniqueOrThrow({ where: { code: d.code } })).toMatchObject({
      statut: 'A_TRAITER',
      typeInstruction: 'contrat',
    })
    expect(await withTransaction(db, (tx) => creerChapeauATraiter(tx, d))).toBe('EXISTANTE')
  })
})

describe('RG-COO-063 statut de préparation du dossier (Circé)', () => {
  it('RG-COO-063 intégration de la prépa : A_TRAITER → PREPARATION_RECUE, historique automatique', async () => {
    const d = await f.createDossier(db)
    expect(await withTransaction(db, (tx) => integrerPreparation(tx, d.contNum))).toBe(
      'PREPARATION_RECUE',
    )
    expect((await db.dossier.findUniqueOrThrow({ where: { id: d.id } })).statut).toBe(
      'PREPARATION_RECUE',
    )
    expect(
      await db.statutHistorique.findFirstOrThrow({
        where: { typeEntite: 'DOSSIER', entiteId: String(d.contNum) },
      }),
    ).toMatchObject({
      ancien: 'A_TRAITER',
      nouveau: 'PREPARATION_RECUE',
      parId: null,
      motif: 'Circé (automatique)',
      regle: 'RG-COO-063',
    })
  })

  it('RG-COO-063 un renvoi laisse PREPARATION_RECUE (jamais de retour à A_TRAITER), sans historique', async () => {
    const d = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    expect(await withTransaction(db, (tx) => integrerPreparation(tx, d.contNum))).toBe('DEJA_RECUE')
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'DOSSIER', entiteId: String(d.contNum) },
      }),
    ).toBe(0)
  })

  it('RG-COO-063 un dossier annulé n’est pas rouvert par l’intégration de la prépa', async () => {
    const d = await f.createDossier(db, { statut: 'ANNULE' })
    expect(await withTransaction(db, (tx) => integrerPreparation(tx, d.contNum))).toBe(
      'DOSSIER_ANNULE',
    )
    expect((await db.dossier.findUniqueOrThrow({ where: { id: d.id } })).statut).toBe('ANNULE')
  })

  it('RG-COO-063 aucune route ne permet à un utilisateur de poser le statut de préparation', () => {
    for (const method of ['POST', 'PUT', 'PATCH'] as const) {
      expect(ctx.app.hasRoute({ method, url: '/api/coordination/dossiers/:id/statut' })).toBe(false)
      expect(ctx.app.hasRoute({ method, url: '/api/coordination/dossiers/:id' })).toBe(false)
    }
  })
})

describe('RG-COO-062 / RG-X-065 dossier annulé (vente annulée)', () => {
  it('RG-X-065 annulation après réception : dossier ANNULE, lignes ANNULEE, affiches gardées en stock (aucun mouvement)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 6)
    const contNum = rv.ligne.contNum ?? 0
    const dossier = await f.createDossier(db, { contNum, statut: 'PREPARATION_RECUE' })
    const mouvementsAvant = await db.mouvement.count({ where: { afficheId: rv.afficheId } })
    const r = await withTransaction(db, (tx) => annulerDossier(tx, contNum))
    expect(r).toMatchObject({ resultat: 'ANNULE', lignesAnnulees: 1, affichesConservees: 1 })
    expect((await db.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).statut).toBe(
      'ANNULE',
    )
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).etatLigne,
    ).toBe('ANNULEE')
    // RG-X-065 test de rejet : le stock de l'affiche est inchangé, aucune mise au rebut.
    expect(await db.mouvement.count({ where: { afficheId: rv.afficheId } })).toBe(mouvementsAvant)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).quantite).toBe(6)
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(contNum), action: 'ANNULATION_DOSSIER' },
      }),
    ).toBe(1)
  })

  it('RG-COO-062 un dossier déjà annulé ne l’est pas deux fois (409), rien n’est écrit', async () => {
    const d = await f.createDossier(db, { statut: 'ANNULE' })
    await expect(withTransaction(db, (tx) => annulerDossier(tx, d.contNum))).rejects.toMatchObject({
      httpStatus: 409,
    })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'DOSSIER', entiteId: String(d.contNum) },
      }),
    ).toBe(0)
  })

  it('RG-COO-062 un dossier annulé n’a plus aucune action d’Instruction OK dans la liste (« — »)', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    await withTransaction(db, (tx) => annulerDossier(tx, i.contNum ?? 0))
    const d = ListeDossiersSchema.parse(
      (await get(ctx, `/api/coordination/dossiers?dossier=${String(i.contNum)}`, c.headers)).json(),
    ).items[0]
    expect(d).toMatchObject({ preparation: 'ANNULE' })
    expect(d?.instructions[0]?.actions).toEqual([])
  })
})

describe('RG-COO-062 / RG-COO-041 compléments (Q-182 (9), ANO-021)', () => {
  it('RG-COO-062 une instruction d’un dossier annulé ne change plus de statut (409), rien n’est écrit', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    await withTransaction(db, (tx) => annulerDossier(tx, i.contNum ?? 0))
    const r = await changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-062' })
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'EN_COURS',
    )
  })

  it('RG-COO-062 une instruction d’un dossier non annulé change de statut normalement', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    expect(
      (await changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' })).statusCode,
    ).toBe(200)
  })

  it('RG-COO-041 la création d’un chapeau est journalisée (acteur « BC »)', async () => {
    const d = {
      code: `CHJ${String(Date.now()).slice(-9)}`,
      contNum: 700002,
      semaine: { annee: 2026, semaine: 46 },
      atelierId: null,
    }
    await withTransaction(db, (tx) => creerChapeauATraiter(tx, d))
    expect(
      await db.journalAudit.findFirstOrThrow({
        where: { entiteId: d.code, action: 'INTEGRATION_INSTRUCTION' },
      }),
    ).toMatchObject({ complement: 'BC', parId: null })
  })
})

describe('RG-COO-001 deux circuits indépendants', () => {
  it('RG-COO-001 la validation admin d’une affiche n’attend ni la prépa ni l’Instruction OK', async () => {
    const s = await site(ctx, ['coord'])
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 3)
    await f.createDossier(db, { contNum: rv.ligne.contNum ?? 0, statut: 'A_TRAITER' })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, s.headers, {
      version: a.version,
      valider: true,
    })
    expect(r.statusCode).toBe(200)
  })

  it('RG-COO-001 annuler / remettre une instruction ne dépend d’aucune validation admin (aucune affiche validée)', async () => {
    const c = await contexte()
    const i = await instruction(c.atelier.id, 'EN_COURS')
    expect(await db.affiche.count({ where: { contNum: i.contNum, validationAdmin: true } })).toBe(0)
    const r1 = await changer(c.headers, i.code, { version: i.version, vers: 'ANNULE' })
    expect(r1.statusCode).toBe(200)
    expect(
      (await changer(c.headers, i.code, { version: i.version + 1, vers: 'A_TRAITER' })).statusCode,
    ).toBe(200)
  })
})

describe('RG-COO-169 / socle : aucun rôle hors catalogue', () => {
  it('RG-COO-166 les 6 rôles provisoires seulement (Q-003)', () => {
    expect([...ROLES].sort()).toEqual(['admin', 'cheq', 'com', 'coord', 'expe', 'recep'])
  })
})
