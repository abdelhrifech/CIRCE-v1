// ÉTAPE 7 — interactions COORDINATION → RÉCEPTION : chaque cellule C-nn de la matrice d'impact
// (docs/ANALYSE_FONCTIONNELLE_COMPLETE.md §6.5). Action de la Coordination × état de la Réception (palette,
// affiche, stock) → autorisé / bloqué (règle, code) / effet induit. Un test de REJET couvre le cas où la
// réception n'est pas dans l'état requis. Sources : RG-X-022, 028, 050 à 059, 062 à 065, 081 à 084, 087.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ResultatFinDeJourneeSchema } from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import { estAssociee } from '../../src/modules/coordination/effets-validation.ts'
import { annulerDossier } from '../../src/modules/coordination/integration.ts'
import * as f from '../factories/index.ts'
import {
  affiche,
  alertes,
  colisExpedie,
  alertesDossier,
  fiche,
  inconnue,
  ligneDe,
  monde,
  mouvements,
  nouvelleLigne,
  receptionDe,
  recevoir,
  stock,
  valider,
  type Monde,
} from '../support/interactions.ts'
import { contexteReception, erreur, get, post, type Ctx } from '../support/reception.ts'

const ctx: Ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const types = (a: { type: string }[]) => a.map((x) => x.type)

/** Contrôle d'une palette par l'agent de réception (comptage = quantité du BL). */
async function controler(m: Monde, receptionId: number, qteComptee?: number) {
  const lec = (await get(ctx, `/api/receptions/${String(receptionId)}/controle`, m.headers)).json<{
    version: number
    lignes: { afficheId: number; quantiteBl: number }[]
  }>()
  const r = await post(ctx, `/api/receptions/${String(receptionId)}/controle`, m.headers, {
    version: lec.version,
    controleurId: m.user.id,
    lignes: lec.lignes.map((l) => ({
      afficheId: l.afficheId,
      qteComptee: qteComptee ?? l.quantiteBl,
      allee: 'a',
      rayon: '3',
    })),
  })
  expect(r.statusCode, r.body).toBe(200)
}

// ───────────── C-01 : valider / annuler la validation × état de la palette ─────────────

describe('C-01 annuler la validation admin × palette CONTRÔLÉE, stock posé (RG-X-050)', () => {
  it('RG-X-050 la validation redevient « à confirmer » (motif ANNULEE) ; AUCUN mouvement de stock, palette toujours CONTRÔLÉE, stock inchangé', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 7)
    await controler(m, rv.receptionId)
    expect((await valider(ctx, m.coord.headers, rv.afficheId, true)).statusCode).toBe(200)
    const avant = {
      mouvements: (await mouvements(ctx, rv.afficheId)).length,
      stock: await stock(ctx, rv.afficheId),
    }
    const r = await valider(ctx, m.coord.headers, rv.afficheId, false)
    expect(r.statusCode, r.body).toBe(200)
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('CONTROLEE')
    expect((await mouvements(ctx, rv.afficheId)).length).toBe(avant.mouvements)
    expect(await stock(ctx, rv.afficheId)).toBe(avant.stock)
    expect((await fiche(ctx, m)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['ANNULEE'],
    })
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      validationAdmin: false,
      validationAnnulee: true,
      // RG-COO-023 / Q-202 : aucun effet au décochage sur l'étiquette rack (déjà à imprimer, ou imprimée).
      etiquetteRackAImprimer: true,
    })
  })

  it('RG-X-050 rejet : annuler une validation jamais faite → 409 TRANSITION_INTERDITE, rien n’est écrit', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    const avant = await affiche(ctx, rv.afficheId)
    const r = await valider(ctx, m.coord.headers, rv.afficheId, false)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('TRANSITION_INTERDITE')
    expect((await affiche(ctx, rv.afficheId)).version).toBe(avant.version)
  })
})

describe('C-02 valider × état de la palette (RG-X-028, RG-X-063, RG-COO-008)', () => {
  for (const [libelle, controlee] of [
    ['À CONTRÔLER (non contrôlée)', false],
    ['CONTRÔLÉE', true],
  ] as const) {
    it(`RG-X-028 palette ${libelle} : la validation admin est possible à tout moment (circuits indépendants), aucun changement de la palette`, async () => {
      const m = await monde(ctx)
      const rv = await recevoir(ctx, m, 4)
      if (controlee) await controler(m, rv.receptionId)
      const avant = (await receptionDe(ctx, rv.receptionId)).statut
      const r = await valider(ctx, m.coord.headers, rv.afficheId, true)
      expect(r.statusCode, r.body).toBe(200)
      expect((await receptionDe(ctx, rv.receptionId)).statut).toBe(avant)
      expect(await affiche(ctx, rv.afficheId)).toMatchObject({
        validationAdmin: true,
        etiquetteRackAImprimer: true,
      })
    })
  }

  it('RG-X-063 rejet : affiche d’une réception inconnue (palette À identifier) → 409 « à rattacher d’abord », aucune validation', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 5)
    const r = await valider(ctx, m.coord.headers, inc.afficheId, true)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).message).toContain('à rattacher d’abord')
    expect((await receptionDe(ctx, inc.receptionId)).statut).toBe('A_IDENTIFIER')
    expect((await affiche(ctx, inc.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-X-065 / Q-402 (HYPOTHÈSE PRISE, énoncé « validation sans objet » non tranché) dossier annulé : la validation reste possible (lien conservé, circuits indépendants RG-X-028) et ne produit aucun mouvement', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 4)
    await withTransaction(db, (tx) => annulerDossier(tx, m.dossier.contNum))
    const avant = (await mouvements(ctx, rv.afficheId)).length
    expect((await valider(ctx, m.coord.headers, rv.afficheId, true)).statusCode).toBe(200)
    expect((await mouvements(ctx, rv.afficheId)).length).toBe(avant)
  })
})

// ───────────── C-03 : thème de Broadcast repris × affiche validée et palette contrôlée ─────────────

describe('C-03 reprendre la version Broadcast (thème) × affiche validée, palette contrôlée (RG-X-057, RG-X-012)', () => {
  it('RG-X-057 validation à refaire (motif THEME), feuille à refaire, alerte « Feuille de stock à refaire » côté Réception ; stock et palette inchangés ; une transaction', async () => {
    const m = await monde(ctx, 'PREPARATION_RECUE')
    const rv = await recevoir(ctx, m, 6, { theme: 'Ancien thème' })
    await controler(m, rv.receptionId)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    // Broadcast a changé le thème de la ligne : la ligne porte le nouveau, l'affiche l'ancien (RG-COO-030).
    await db.receptionAttendue.update({
      where: { id: rv.ligne.id },
      data: { theme: 'Nouveau thème' },
    })
    await db.affiche.update({
      where: { id: rv.afficheId },
      data: { themeModifie: true, validationAdmin: false },
    })
    const l = await ligneDe(ctx, rv.ligne.id)
    const r = await post(
      ctx,
      `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`,
      m.coord.headers,
      { version: l.version },
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      theme: 'Nouveau thème',
      feuilleARefaire: true,
      validationAdmin: false,
    })
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('CONTROLEE')
    expect(await stock(ctx, rv.afficheId)).toBe(6)
    expect((await fiche(ctx, m)).affiches[0]?.etat).not.toBe('VALIDEE')
    expect(types(await alertesDossier(ctx, m))).toContain('THEME_MODIF')
  })

  it('RG-X-057 rejet : rien à reprendre (thème identique) → 409, aucune écriture sur l’affiche', async () => {
    const m = await monde(ctx, 'PREPARATION_RECUE')
    const rv = await recevoir(ctx, m, 2)
    const l = await ligneDe(ctx, rv.ligne.id)
    const avant = await affiche(ctx, rv.afficheId)
    const r = await post(
      ctx,
      `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`,
      m.coord.headers,
      { version: l.version },
    )
    expect(r.statusCode).toBe(409)
    expect((await affiche(ctx, rv.afficheId)).version).toBe(avant.version)
  })
})

// ───────────── C-04 : version Broadcast, dossier annulé ─────────────

describe('C-04 appliquer la version Broadcast × dossier / réception (RG-X-064, RG-X-065)', () => {
  it('RG-X-064 quantité de la prépa changée : l’attendu est recalculé, aucun lien retiré, stock et validation inchangés', async () => {
    const m = await monde(ctx, 'PREPARATION_RECUE')
    const rv = await recevoir(ctx, m, 8, { qteBc: 10, qtePrepa: 8 })
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const d = await db.dossier.findUniqueOrThrow({ where: { id: m.dossier.id } })
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(d.id)}/version-broadcast`,
      m.coord.headers,
      { version: d.version },
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(await stock(ctx, rv.afficheId)).toBe(8)
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect((await ligneDe(ctx, rv.ligne.id)).qtePrepa).toBe(10)
    expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-X-065 rejet : dossier annulé → 409 RG-COO-062 « rien à aligner », affiches et stock intacts', async () => {
    const m = await monde(ctx, 'PREPARATION_RECUE')
    const rv = await recevoir(ctx, m, 5)
    await withTransaction(db, (tx) => annulerDossier(tx, m.dossier.contNum))
    const d = await db.dossier.findUniqueOrThrow({ where: { id: m.dossier.id } })
    const r = await post(
      ctx,
      `/api/coordination/dossiers/${String(d.id)}/version-broadcast`,
      m.coord.headers,
      { version: d.version },
    )
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-062' })
    expect(await stock(ctx, rv.afficheId)).toBe(5)
  })
})

// ───────────── C-05 : Instruction OK × validation admin / réception ─────────────

describe('C-05 Instruction OK × validation admin non faite, réception incomplète (RG-X-028)', () => {
  it('RG-X-028 l’Instruction OK n’exige ni validation admin ni palette contrôlée : le circuit de préparation est indépendant', async () => {
    const m = await monde(ctx, 'PREPARATION_RECUE')
    const rv = await recevoir(ctx, m, 2, { qteBc: 10 })
    const atelier = await f.createAtelier(db, { plateformeId: m.plateforme.id })
    const i = await f.createInstruction(db, {
      atelierId: atelier.id,
      statut: 'EN_COURS',
      dossierId: m.dossier.id,
      contNum: m.dossier.contNum,
      contAnbas: 2026,
      contSembas: 45,
      entretien: 8,
      tipInsCode: 0,
    })
    await f.createInstructionDetail(db, { instructionCode: i.code, cadrIdent: 1 })
    await f.createFaceTrain(db, { instructionCode: i.code, ftType: 'contrat', statut: 'EN_COURS' })
    await f.createInstructionVisuel(db, { instructionCode: i.code, pourcentage: 100 })
    const r = await post(ctx, '/api/coordination/instruction-ok', m.coord.headers, {
      instructions: [{ code: i.code, version: i.version }],
    })
    expect(r.statusCode, r.body).toBe(200)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
      'INSTRUCTION_OK',
    )
    // Rien ne change côté Réception : validation toujours à faire, palette toujours À contrôler.
    expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(false)
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('A_CONTROLER')
  })
})

// ───────────── C-06 : signaler / rattacher × palette pas dans l'état requis ─────────────

describe('C-06 actions sur une réception inconnue × palette pas « À identifier » (RG-X-054, RG-X-051)', () => {
  it('RG-X-054 rejet : signaler « Dossier introuvable » sur une palette déjà identifiée (À contrôler) → 409, aucune alerte créée', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    const rec = await receptionDe(ctx, rv.receptionId)
    const r = await post(ctx, `/api/affiches/${String(rv.afficheId)}/signaler`, m.coord.headers, {
      receptionVersion: rec.version,
    })
    expect(r.statusCode).toBe(409)
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('A_CONTROLER')
    expect(
      (await alertes(ctx, m.coord.headers, `?site=${String(m.plateforme.id)}`)).map((a) => a.cle),
    ).not.toContain(`RG-REC-186:${String(rv.receptionId)}`)
  })

  it('RG-X-051 rejet : rattacher une affiche déjà identifiée (réception pas « À identifier ») → 409 REC_RATTACHER_NON_ORPHELINE, rien n’est écrit', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    const l2 = await nouvelleLigne(ctx, m, { theme: 'Autre' })
    const a = await affiche(ctx, rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattacher-inconnue`, m.coord.headers, {
      version: a.version,
      lignes: [{ ligneAttendueId: l2.id, quantite: 1 }],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('REC_RATTACHER_NON_ORPHELINE')
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l2.id } })).toBe(0)
  })

  it('RG-X-054 un signalement par la Coordination rend l’affiche « Introuvable » sans changer la palette ni le stock', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 4)
    const rec = await receptionDe(ctx, inc.receptionId)
    const r = await post(ctx, `/api/affiches/${String(inc.afficheId)}/signaler`, m.coord.headers, {
      receptionVersion: rec.version,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect((await receptionDe(ctx, inc.receptionId)).statut).toBe('A_IDENTIFIER')
    expect(await stock(ctx, inc.afficheId)).toBe(4)
  })
})

// ───────────── C-07 : retour vers Broadcast ─────────────

describe('C-07 retour vers Broadcast : affiche « associée » (RG-X-022, RG-X-053)', () => {
  it('RG-X-022 « associée » seulement si liée ET validée par la Coordination ; annulation de la validation → plus associée', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    const associee = async () => (await fiche(ctx, m)).affiches[0]?.estAssociee
    expect(await associee()).toBe(false)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    expect(await associee()).toBe(true)
    await valider(ctx, m.coord.headers, rv.afficheId, false)
    expect(await associee()).toBe(false)
  })

  it('RG-X-053 une affiche à doute reçue et contrôlée a un stock et une feuille, mais aucun « associée »', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    await controler(m, rv.receptionId)
    expect(await stock(ctx, rv.afficheId)).toBe(3)
    expect((await fiche(ctx, m)).affiches[0]?.estAssociee).toBe(false)
    expect(estAssociee({ liensActifs: 1, validee: false })).toBe(false)
  })
})

// ───────────── C-08 : compteurs des menus ─────────────

describe('C-08 compteurs des menus (RG-X-021)', () => {
  it('RG-X-021 réception → badge « Réception des affiches » +1 ; contrôle → −1 ; inconnue → badge « Réceptions inconnues » +1 ; dossier « Validation admin à confirmer » visible puis retiré après validation', async () => {
    const m = await monde(ctx)
    const compteurs = async () =>
      (await get(ctx, '/api/reception/compteurs', m.headers)).json<{
        palettesAControler: number
        affichesOrphelines: number
      }>()
    const c0 = await compteurs()
    const rv = await recevoir(ctx, m, 3)
    expect((await compteurs()).palettesAControler).toBe(c0.palettesAControler + 1)
    const aConfirmer = async () =>
      (
        await get(
          ctx,
          `/api/coordination/dossiers?dossier=${String(m.dossier.contNum)}&va=A_CONFIRMER`,
          m.coord.headers,
        )
      ).json<{ total: number }>().total
    expect(await aConfirmer()).toBe(1)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    expect(await aConfirmer()).toBe(0)
    await controler(m, rv.receptionId)
    expect((await compteurs()).palettesAControler).toBe(c0.palettesAControler)
    await inconnue(ctx, m, 2)
    expect((await compteurs()).affichesOrphelines).toBe(c0.affichesOrphelines + 1)
  })
})

// ───────────── C-09 : fin de journée × stock réel ─────────────

describe('C-09 fin de journée (expédition) × stock des affiches reçues (RG-X-087)', () => {
  it('RG-X-087 la sortie de stock « Expédition » est prélevée sur l’affiche REÇUE par le BL (même dossier, même thème), dans la transaction de fin de journée', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 10, { theme: 'Thème expédié' })
    expect(await stock(ctx, rv.afficheId)).toBe(10)
    const { post2 } = await colisExpedie(ctx, m, {
      contNum: m.dossier.contNum,
      theme: 'Thème expédié',
      qte: 4,
    })
    const r = await post2('/fin-de-journee', {})
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatFinDeJourneeSchema.parse(r.json())).toMatchObject({
      sortiesStock: 1,
      manquants: [],
    })
    expect(await stock(ctx, rv.afficheId)).toBe(6)
    const sortie = (await mouvements(ctx, rv.afficheId)).find((x) => x.type === 'EXPEDITION')
    expect(sortie).toMatchObject({ quantite: -4, auto: true })
  })

  it('RG-X-087 réception pas dans l’état requis : aucune affiche reçue pour ce dossier → aucune sortie, manquant tracé, le colis passe tout de même « Terminé »', async () => {
    const m = await monde(ctx)
    const { post2 } = await colisExpedie(ctx, m, {
      contNum: m.dossier.contNum,
      theme: 'Jamais reçu',
      qte: 3,
    })
    const r = await post2('/fin-de-journee', {})
    expect(r.statusCode, r.body).toBe(200)
    const res = ResultatFinDeJourneeSchema.parse(r.json())
    expect(res.sortiesStock).toBe(0)
    expect(res.manquants).toHaveLength(1)
    expect(res.colis).toHaveLength(1)
  })

  it('RG-X-087 stock insuffisant : la sortie est plafonnée au stock (jamais négatif), le manquant est tracé', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 2, { theme: 'Peu de stock' })
    const { post2 } = await colisExpedie(ctx, m, {
      contNum: m.dossier.contNum,
      theme: 'Peu de stock',
      qte: 5,
    })
    const res = ResultatFinDeJourneeSchema.parse((await post2('/fin-de-journee', {})).json())
    expect(await stock(ctx, rv.afficheId)).toBe(0)
    expect(res.manquants).toHaveLength(1)
  })
})

// ───────────── C-10 : indépendance de la préparation unitaire (RG-X-084) ─────────────
// Démontrée sur des UM réellement créées (Q-265, option (c)) : coordination/liberation-colisage.int.test.ts,
// « RG-X-084 Colisage et Préparer donnent le même résultat avant et après la validation admin ».

// ───────────── C-11 : lecture de la fiche / listes sans écriture, droits ─────────────

describe('C-11 droits des actions de Coordination sur les affiches (RG-X-015, RG-X-050)', () => {
  it('RG-X-050 l’agent de réception, le chef d’équipe et le commercial ne peuvent pas annuler une validation (403), rien n’est écrit', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 2)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const avant = await affiche(ctx, rv.afficheId)
    for (const h of [m.headers, m.cheq.headers, m.com.headers]) {
      const r = await valider(ctx, h, rv.afficheId, false)
      expect(r.statusCode).toBe(403)
    }
    expect((await affiche(ctx, rv.afficheId)).version).toBe(avant.version)
    expect((await valider(ctx, m.admin.headers, rv.afficheId, false)).statusCode).toBe(200)
  })
})
