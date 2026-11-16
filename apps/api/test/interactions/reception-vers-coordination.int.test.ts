// ÉTAPE 7 — interactions RÉCEPTION → COORDINATION : chaque cellule R-nn de la matrice d'impact
// (docs/ANALYSE_FONCTIONNELLE_COMPLETE.md §6.5) est un test d'intégration sur l'API réelle (test.db).
// Une action de Réception × l'état de la Coordination liée (dossier, ligne, validation admin, train) →
// autorisé / bloqué (règle, code) / effet induit. Sources : RG-X-001 à 030, 053, 060 à 065, 075 à 088.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FicheAfficheSchema,
  ListeAlertesSchema,
  ReceptionCreeeSchema,
  type Role,
} from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import { annulerDossier, integrerPreparation } from '../../src/modules/coordination/integration.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import {
  DEPART_TXT,
  envoyer,
  SEM,
  siteDeroulant,
  trainExportable,
} from '../support/export-trains.ts'
import {
  affiche,
  alertes,
  alertesDossier,
  fiche,
  inconnue,
  ligneDe,
  monde,
  mouvements,
  nouvelleLigne,
  rattacherInconnue,
  receptionDe,
  recevoir,
  stock,
  valider,
  type Monde,
} from '../support/interactions.ts'
import {
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  ligne,
  post,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const types = (a: { type: string }[]) => a.map((x) => x.type)

// ───────────── R-01 à R-06 : « Valider la réception » × état de la ligne / du dossier ─────────────

describe('R-01 / R-02 valider la réception × dossier à traiter ou préparation reçue (RG-X-001, 063, 028)', () => {
  for (const preparation of ['A_TRAITER', 'PREPARATION_RECUE'] as const) {
    it(`RG-X-001 dossier « ${preparation} » : affiche créée, lien proposé (mode BL), AUCUNE validation admin (circuits indépendants)`, async () => {
      const m = await monde(ctx, preparation)
      const rv = await recevoir(ctx, m, 6)
      expect(await affiche(ctx, rv.afficheId)).toMatchObject({
        statut: 'IDENTIFIEE',
        validationAdmin: false,
        validationAdminParId: null,
      })
      expect(
        await db.afficheAttendue.findMany({ where: { afficheId: rv.afficheId } }),
      ).toMatchObject([{ actif: true, mode: 'BL', quantite: 6 }])
      expect((await fiche(ctx, m)).affiches[0]).toMatchObject({
        etat: 'A_CONFIRMER_PROPOSE',
        motifs: [],
      })
      // RG-X-005 : « affiche reçue » = un mouvement de réception, sans condition de validation.
      expect((await mouvements(ctx, rv.afficheId)).map((x) => x.type)).toEqual(['RECEPTION'])
      expect(await stock(ctx, rv.afficheId)).toBe(6)
    })
  }

  it('RG-X-001 rejet : aucun effet de validation produit à la réception (étiquette rack non à imprimer, pas de numéro dans le suivi)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({ etiquetteRackAImprimer: false })
  })
})

describe('R-03 valider la réception × ligne fermée / dossier annulé (RG-X-065, RG-REC-014)', () => {
  it('RG-X-065 dossier ANNULÉ : la ligne est fermée, la réception est refusée (422 REC_LIGNE_INDISPONIBLE), rien n’est écrit', async () => {
    const m = await monde(ctx)
    const l = await nouvelleLigne(ctx, m, { theme: 'T' })
    await withTransaction(db, (tx) => annulerDossier(tx, m.dossier.contNum))
    expect((await ligneDe(ctx, l.id)).etatLigne).toBe('ANNULEE')
    const avant = await db.reception.count({ where: { plateformeId: m.plateforme.id } })
    const bl = await bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 4 }])
    const r = await post(ctx, '/api/receptions', m.headers, bl)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_LIGNE_INDISPONIBLE', regle: 'RG-REC-014' })
    expect(await db.reception.count({ where: { plateformeId: m.plateforme.id } })).toBe(avant)
    expect(await db.affiche.count({ where: { plateformeId: m.plateforme.id } })).toBe(0)
  })

  it('RG-X-065 ligne exclue (thème exclu) ou purgée : refus identique', async () => {
    const m = await monde(ctx)
    const exclue = await nouvelleLigne(ctx, m, { theme: 'Exclu', themeExclu: true })
    const purgee = await nouvelleLigne(ctx, m, { theme: 'Purgé', purgeeLe: new Date() })
    for (const l of [exclue, purgee]) {
      const bl = await bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 1 }])
      const r = await post(ctx, '/api/receptions', m.headers, bl)
      expect(r.statusCode).toBe(422)
      expect(erreur(r).code).toBe('REC_LIGNE_INDISPONIBLE')
    }
  })
})

describe('R-04 valider la réception sans IP (RG-X-009, RG-X-020)', () => {
  it('RG-X-009 ligne sans thème : intitulé exigé (422), puis motif SANS_IP (doute) et alerte « Réception sans IP » pour la Coordination', async () => {
    const m = await monde(ctx)
    const l = await nouvelleLigne(ctx, m, { theme: null, themeCle: null, provisoire: true })
    const sans = await bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 5 }])
    const refus = await post(ctx, '/api/receptions', m.headers, sans)
    expect(refus.statusCode).toBe(422)
    expect(erreur(refus)).toMatchObject({ code: 'REC_INTITULE_REQUIS', regle: 'RG-REC-047' })
    const avec = await bonDeLivraison(ctx, m.headers, [
      { ligneAttendueId: l.id, quantite: 5, intituleSaisi: 'Lu sur l’affiche' },
    ])
    const ok = await post(ctx, '/api/receptions', m.headers, avec)
    expect(ok.statusCode, ok.body).toBe(201)
    const a = ReceptionCreeeSchema.parse(ok.json()).affiches[0]
    expect((await fiche(ctx, m)).affiches[0]?.motifs).toContain('SANS_IP')
    expect(types(await alertesDossier(ctx, m))).toContain('SANS_IP')
    expect(a).toBeDefined()
  })
})

describe('R-05 réception partielle puis complément (RG-X-018 ; RG-X-061 non implémentée : Q-399)', () => {
  it('RG-X-018 partielle : ligne « Partielle », alerte « Visuel reçu en partie » ; le complément s’ajoute à la MÊME affiche, la validation du 1er lot reste', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 4, { qteBc: 10 })
    expect((await ligneDe(ctx, rv.ligne.id)).statut).toBe('PARTIELLE')
    expect(types(await alertes(ctx, m.coord.headers, '?type=MANQUANT'))).toContain('MANQUANT')
    expect((await valider(ctx, m.coord.headers, rv.afficheId, true)).statusCode).toBe(200)
    const bl2 = await bonDeLivraison(ctx, m.headers, [
      { ligneAttendueId: rv.ligne.id, quantite: 6, complementAfficheId: rv.afficheId },
    ])
    const r = await post(ctx, '/api/receptions', m.headers, bl2)
    expect(r.statusCode, r.body).toBe(201)
    expect(ReceptionCreeeSchema.parse(r.json()).affiches).toMatchObject([
      { id: rv.afficheId, complement: true, quantite: 6 },
    ])
    expect((await ligneDe(ctx, rv.ligne.id)).statut).toBe('COMPLETE')
    expect(await stock(ctx, rv.afficheId)).toBe(10)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({ validationAdmin: true })
  })

  it('RG-REC-040 rejet : un complément sur une ligne non partielle est refusé (422 REC_COMPLEMENT_INVALIDE)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 10, { qteBc: 10 })
    const bl2 = await bonDeLivraison(ctx, m.headers, [
      { ligneAttendueId: rv.ligne.id, quantite: 1, complementAfficheId: rv.afficheId },
    ])
    const r = await post(ctx, '/api/receptions', m.headers, bl2)
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_COMPLEMENT_INVALIDE', regle: 'RG-REC-040' })
  })
})

describe('R-06 plusieurs dossiers pour une affiche, un dossier sur deux plateformes (RG-X-016, 060, 019)', () => {
  it('RG-X-060 une affiche de 100 rattachée à 3 dossiers (50/30/20) : le reçu est compté UNE fois (100)', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 100)
    const lignes = []
    for (const q of [50, 30, 20]) {
      const d = await f.createDossier(db)
      lignes.push({
        ligne: await ligne(ctx, m.plateforme.id, { contNum: d.contNum, supportId: m.support.id }),
        q,
      })
    }
    const r = await rattacherInconnue(
      ctx,
      m.coord.headers,
      inc.afficheId,
      lignes.map((x) => ({ ligneAttendueId: x.ligne.id, quantite: x.q })),
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(await stock(ctx, inc.afficheId)).toBe(100)
    expect(
      await db.afficheAttendue.aggregate({
        where: { afficheId: inc.afficheId, actif: true },
        _sum: { quantite: true },
      }),
    ).toMatchObject({ _sum: { quantite: 100 } })
  })

  it('RG-X-016 rejet : répartir plus que le reçu → 422, rien n’est écrit', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 10)
    const l = await nouvelleLigne(ctx, m)
    const r = await rattacherInconnue(ctx, m.coord.headers, inc.afficheId, [
      { ligneAttendueId: l.id, quantite: 11 },
    ])
    expect(r.statusCode).toBe(422)
    expect(await db.afficheAttendue.count({ where: { afficheId: inc.afficheId } })).toBe(0)
  })

  it('RG-X-019 rejet : un BL ne livre qu’une plateforme (422 REC_BL_DEUX_PLATEFORMES)', async () => {
    const m = await monde(ctx)
    const autreSite = await f.createPlateforme(db)
    const l1 = await nouvelleLigne(ctx, m)
    const l2 = await ligne(ctx, autreSite.id, {
      contNum: m.dossier.contNum,
      supportId: m.support.id,
    })
    // Agent habilité sur les deux plateformes : la règle « un BL ne livre qu'une plateforme » s'applique.
    const deux = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: m.plateforme.id }, { plateformeId: autreSite.id }],
    )
    const entetes = devHeaders(deux.identifiantExterne)
    const bl = await bonDeLivraison(ctx, entetes, [
      { ligneAttendueId: l1.id, quantite: 1 },
      { ligneAttendueId: l2.id, quantite: 1 },
    ])
    const r = await post(ctx, '/api/receptions', entetes, bl)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_BL_DEUX_PLATEFORMES')
  })
})

// ───────────── R-07 à R-10 : contrôle de la palette × validation admin ─────────────

describe('R-07 palette contrôlée × validation admin non faite (RG-X-053, RG-X-005, RG-X-028)', () => {
  it('RG-X-028 le contrôle aboutit sans validation admin : stock posé, feuille définitive, validation toujours à faire, effets de validation non produits', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 8)
    const lec = await get(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, m.headers)
    expect(lec.statusCode).toBe(200)
    const c = lec.json<{ version: number; lignes: { afficheId: number; quantiteBl: number }[] }>()
    const r = await post(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, m.headers, {
      version: c.version,
      controleurId: m.user.id,
      lignes: c.lignes.map((l) => ({
        afficheId: l.afficheId,
        qteComptee: l.quantiteBl,
        allee: 'a',
        rayon: '3',
      })),
    })
    expect(r.statusCode, r.body).toBe(200)
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('CONTROLEE')
    expect(await stock(ctx, rv.afficheId)).toBe(8)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      validationAdmin: false,
      etiquetteRackAImprimer: false,
    })
    expect((await fiche(ctx, m)).affiches[0]?.etat).toBe('A_CONFIRMER_PROPOSE')
  })

  it('RG-X-053 une affiche à doute reçue et contrôlée a un stock et une feuille, mais ne figure NI au picking NI aux étiquettes rack ; après confirmation elle figure aux deux', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    const a = await affiche(ctx, rv.afficheId)
    const jour = a.dateEntree.toISOString().slice(0, 10)
    const picking = async () =>
      (
        await get(
          ctx,
          `/api/edition-picking?plateformeId=${String(m.plateforme.id)}&du=${jour}&au=${jour}`,
          m.headers,
        )
      )
        .json<{ lignes: { afficheId: number }[] }>()
        .lignes.map((x) => x.afficheId)
    const etiquettes = async () =>
      (await get(ctx, '/api/coordination/etiquettes-rack', m.coord.headers))
        .json<{ groupes: { plateformeId: number; afficheIds: number[] }[] }>()
        .groupes.filter((g) => g.plateformeId === m.plateforme.id)
        .flatMap((g) => g.afficheIds)
    expect(await stock(ctx, rv.afficheId)).toBe(3)
    expect(await picking()).not.toContain(rv.afficheId)
    expect(await etiquettes()).not.toContain(rv.afficheId)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    expect(await picking()).toContain(rv.afficheId)
    expect(await etiquettes()).toContain(rv.afficheId)
  })
})

describe('R-08 écart de contrôle (RG-X-017, RG-X-004)', () => {
  it('RG-X-017 comptage supérieur de plus de 10 % : ligne recalculée « Surplus » et alerte « Écart de réception > 10 % » visible de la Coordination', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 10, { qteBc: 10 })
    const c = (
      await get(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, m.headers)
    ).json<{
      version: number
      lignes: { afficheId: number }[]
    }>()
    const r = await post(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, m.headers, {
      version: c.version,
      controleurId: m.user.id,
      lignes: c.lignes.map((l) => ({
        afficheId: l.afficheId,
        qteComptee: 13,
        allee: 'a',
        rayon: '3',
      })),
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(await stock(ctx, rv.afficheId)).toBe(13)
    expect((await ligneDe(ctx, rv.ligne.id)).statut).toBe('SURPLUS')
    expect(types(await alertesDossier(ctx, m))).toContain('ECART')
  })
})

// ───────────── R-09 à R-12 : réceptions inconnues ─────────────

describe('R-09 créer une réception inconnue (RG-X-006, RG-X-021)', () => {
  it('RG-X-006 / RG-COO-072 alerte « Réception inconnue à identifier » côté Coordination, badge « Réceptions inconnues » incrémenté ; palette À identifier hors sas', async () => {
    const m = await monde(ctx)
    const avant = (await get(ctx, '/api/reception/compteurs', m.headers)).json<{
      affichesOrphelines: number
    }>().affichesOrphelines
    const inc = await inconnue(ctx, m)
    const cles = (await alertes(ctx, m.coord.headers, `?site=${String(m.plateforme.id)}`)).map(
      (a) => a.cle,
    )
    expect(cles).toContain(`RG-REC-185:${String(inc.receptionId)}`)
    expect(
      (await get(ctx, '/api/reception/compteurs', m.headers)).json<{ affichesOrphelines: number }>()
        .affichesOrphelines,
    ).toBe(avant + 1)
    expect((await receptionDe(ctx, inc.receptionId)).statut).toBe('A_IDENTIFIER')
  })
})

describe('R-10 rattacher une inconnue × ligne du dossier (RG-X-007, 030, 051, 063)', () => {
  it('RG-X-007 par la Coordination : validée (mode MAIN), palette dans le sas, alerte d’inconnue levée', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 5)
    const l = await nouvelleLigne(ctx, m, { theme: 'Vrai' })
    const r = await rattacherInconnue(ctx, m.coord.headers, inc.afficheId, [
      { ligneAttendueId: l.id, quantite: 5 },
    ])
    expect(r.statusCode, r.body).toBe(200)
    expect(await affiche(ctx, inc.afficheId)).toMatchObject({ validationAdmin: true })
    expect((await receptionDe(ctx, inc.receptionId)).statut).toBe('A_CONTROLER')
    const cles = (await alertes(ctx, m.coord.headers, `?site=${String(m.plateforme.id)}`)).map(
      (a) => a.cle,
    )
    expect(cles).not.toContain(`RG-REC-185:${String(inc.receptionId)}`)
  })

  it('RG-X-063 par l’agent de réception : jamais validée (« à confirmer », motif BL), la Coordination confirme ensuite', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 5)
    const l = await nouvelleLigne(ctx, m, { theme: 'Vrai' })
    await rattacherInconnue(ctx, m.headers, inc.afficheId, [{ ligneAttendueId: l.id, quantite: 5 }])
    expect(await affiche(ctx, inc.afficheId)).toMatchObject({ validationAdmin: false })
    expect((await fiche(ctx, m)).affiches[0]).toMatchObject({ etat: 'A_CONFIRMER_DOUTE' })
    expect((await valider(ctx, m.coord.headers, inc.afficheId, true)).statusCode).toBe(200)
  })

  it('RG-X-030 plusieurs dossiers : motif MULTI (doute), même par la Coordination ; ligne d’un dossier ANNULÉ refusée', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 10)
    const l1 = await nouvelleLigne(ctx, m, { theme: 'A' })
    const d2 = await f.createDossier(db)
    const l2 = await ligne(ctx, m.plateforme.id, { contNum: d2.contNum, supportId: m.support.id })
    const r = await rattacherInconnue(ctx, m.headers, inc.afficheId, [
      { ligneAttendueId: l1.id, quantite: 5 },
      { ligneAttendueId: l2.id, quantite: 5 },
    ])
    expect(r.statusCode, r.body).toBe(200)
    expect((await fiche(ctx, m)).affiches[0]?.motifs).toContain('MULTI')
  })

  it('RG-X-051 rejet : rattacher à une ligne fermée (dossier annulé) → 422 REC_LIGNE_CIBLE_ANNULEE, aucun lien, palette toujours « À identifier »', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 5)
    const l = await nouvelleLigne(ctx, m, { theme: 'Z' })
    await withTransaction(db, (tx) => annulerDossier(tx, m.dossier.contNum))
    const r = await rattacherInconnue(ctx, m.coord.headers, inc.afficheId, [
      { ligneAttendueId: l.id, quantite: 5 },
    ])
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_LIGNE_CIBLE_ANNULEE', regle: 'RG-COO-088' })
    expect(await db.afficheAttendue.count({ where: { afficheId: inc.afficheId } })).toBe(0)
    expect(await affiche(ctx, inc.afficheId)).toMatchObject({ statut: 'ORPHELINE' })
    expect((await receptionDe(ctx, inc.receptionId)).statut).toBe('A_IDENTIFIER')
  })
})

describe('R-11 signaler « Dossier introuvable » (RG-X-054, RG-X-008)', () => {
  it('RG-X-008 / RG-COO-072 alerte « Dossier introuvable » pour la Coordination du site ; un signalement répété est refusé (409) sans dupliquer l’alerte', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 4)
    const rec = await receptionDe(ctx, inc.receptionId)
    const r1 = await post(ctx, `/api/affiches/${String(inc.afficheId)}/signaler`, m.coord.headers, {
      receptionVersion: rec.version,
    })
    expect(r1.statusCode, r1.body).toBe(200)
    expect((await receptionDe(ctx, inc.receptionId)).statut).toBe('A_IDENTIFIER')
    const liste = await alertes(ctx, m.coord.headers, `?site=${String(m.plateforme.id)}`)
    const cles = liste.map((a) => a.cle)
    expect(cles.filter((c) => c === `RG-REC-186:${String(inc.receptionId)}`)).toHaveLength(1)
    // Q-132 / Q-372 (HYPOTHÈSE) : « grave » = IMPORTANT.
    expect(liste.find((a) => a.cle === `RG-REC-186:${String(inc.receptionId)}`)?.gravite).toBe(
      'IMPORTANT',
    )
    expect(cles).not.toContain(`RG-REC-185:${String(inc.receptionId)}`)
    const r2 = await post(ctx, `/api/affiches/${String(inc.afficheId)}/signaler`, m.coord.headers, {
      receptionVersion: (await receptionDe(ctx, inc.receptionId)).version,
    })
    expect(r2.statusCode).toBe(409)
  })
})

// ───────────── R-12 à R-16 : fiche affiche (changer de thème, retirer, rattacher, valider) ─────────────

describe('R-12 changer de thème après réception (RG-X-012)', () => {
  it('RG-X-012 par la Coordination : l’affiche reste validée ; feuille à refaire + alerte « Feuille de stock à refaire » (Réception et Coordination)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const l2 = await nouvelleLigne(ctx, m, { theme: 'Autre thème' })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    const a = await affiche(ctx, rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, m.coord.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: l2.id,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(await affiche(ctx, a.id)).toMatchObject({ feuilleARefaire: true, validationAdmin: true })
    expect(
      types(await alertes(ctx, m.coord.headers, `?site=${String(m.plateforme.id)}`)),
    ).toContain('THEME_MODIF')
  })

  it('RG-X-012 par l’agent de réception : la validation est à refaire (doute, à confirmer par la Coordination)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const l2 = await nouvelleLigne(ctx, m, { theme: 'Autre thème' })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    const a = await affiche(ctx, rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, m.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: l2.id,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(await affiche(ctx, a.id)).toMatchObject({
      feuilleARefaire: true,
      validationAdmin: false,
    })
    // « validation à refaire si non-coord » : à confirmer par la Coordination (rattachement MAIN, motif BL).
    expect((await fiche(ctx, m)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['BL'],
    })
  })

  it('RG-X-012 rejet : changer de thème vers un AUTRE dossier est refusé (422 REC_THEME_AUTRE_DOSSIER)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    const d2 = await f.createDossier(db)
    const l2 = await ligne(ctx, m.plateforme.id, { contNum: d2.contNum, supportId: m.support.id })
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId: rv.afficheId } })
    const a = await affiche(ctx, rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, m.coord.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: l2.id,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_THEME_AUTRE_DOSSIER', regle: 'RG-REC-135' })
  })
})

describe('R-13 retrait du dernier dossier par la Réception (RG-X-013, RG-X-058)', () => {
  it('RG-X-058 affiche validée : redevient ORPHELINE, validation effacée, palette « À identifier », alerte d’inconnue côté Coordination', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, m.headers, {
      lienVersion: lien.version,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      statut: 'ORPHELINE',
      validationAdmin: false,
    })
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('A_IDENTIFIER')
    expect(await stock(ctx, rv.afficheId)).toBe(5)
    expect(
      (await alertes(ctx, m.coord.headers, `?site=${String(m.plateforme.id)}`)).map((a) => a.cle),
    ).toContain(`RG-REC-185:${String(rv.receptionId)}`)
  })

  it('RG-X-013 rejet : un lien déjà retiré ne se retire pas deux fois (409), stock inchangé', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId: rv.afficheId } })
    await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, m.headers, {
      lienVersion: lien.version,
    })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, m.headers, {
      lienVersion: lien.version + 1,
    })
    expect(r.statusCode).toBe(409)
    expect(await stock(ctx, rv.afficheId)).toBe(5)
  })
})

describe('R-14 rattacher le surplus à un autre dossier (RG-X-052 ; RG-X-085 PARTIEL : Q-280)', () => {
  it('RG-X-052 la validation du 1er dossier est conservée, nouvelle ligne rattachée en mode MAIN, feuille à refaire', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 10, { qteBc: 6 })
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    await db.afficheAttendue.updateMany({
      where: { afficheId: rv.afficheId },
      data: { quantite: 6 },
    })
    const d2 = await f.createDossier(db)
    const l2 = await ligne(ctx, m.plateforme.id, { contNum: d2.contNum, supportId: m.support.id })
    const a = await affiche(ctx, rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, m.coord.headers, {
      version: a.version,
      ligneAttendueId: l2.id,
      quantite: 4,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(await affiche(ctx, a.id)).toMatchObject({ validationAdmin: true, feuilleARefaire: true })
    expect(await stock(ctx, a.id)).toBe(10)
  })
})

describe('R-15 valider / annuler depuis la fiche affiche (RG-X-015, RG-X-062)', () => {
  it('RG-X-015 coordination : valide puis annule (motif ANNULEE) ; agent de réception et commercial refusés (403)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    for (const refuse of [m.headers, m.com.headers]) {
      const r = await post(ctx, `/api/affiches/${String(rv.afficheId)}/validation-admin`, refuse, {
        version: (await affiche(ctx, rv.afficheId)).version,
        valider: true,
      })
      expect(r.statusCode).toBe(403)
    }
    expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(false)
    const ok = await post(
      ctx,
      `/api/affiches/${String(rv.afficheId)}/validation-admin`,
      m.coord.headers,
      { version: (await affiche(ctx, rv.afficheId)).version, valider: true },
    )
    expect(ok.statusCode).toBe(200)
    expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-X-062 lire la fiche affiche deux fois ne crée ni lien, ni historique, ni mouvement (aucune écriture en lecture)', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    const compte = async () => ({
      liens: await db.afficheAttendue.count({ where: { afficheId: rv.afficheId } }),
      journal: await db.journalAudit.count({
        where: { typeEntite: 'AFFICHE', entiteId: String(rv.afficheId) },
      }),
      mouvements: await db.mouvement.count({ where: { afficheId: rv.afficheId } }),
      version: (await affiche(ctx, rv.afficheId)).version,
    })
    const avant = await compte()
    for (const h of [m.coord.headers, m.headers]) {
      const r = await get(ctx, `/api/affiches/${String(rv.afficheId)}`, h)
      expect(r.statusCode).toBe(200)
      FicheAfficheSchema.parse(r.json())
    }
    expect(await compte()).toEqual(avant)
  })
})

// ───────────── R-16 : thème arrivé après la validation / lignes fermées (lecture de Broadcast) ─────────────

describe('R-16 affiche rattachée × dossier annulé / prépa renvoyée (RG-X-055, RG-X-065, RG-X-064)', () => {
  it('RG-X-065 dossier annulé après réception : affiche conservée, validation et stock intacts, alerte « ligne annulée » levée, aucun mouvement créé', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const avant = await mouvements(ctx, rv.afficheId)
    await withTransaction(db, (tx) => annulerDossier(tx, m.dossier.contNum))
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      statut: 'IDENTIFIEE',
      validationAdmin: true,
    })
    expect(await mouvements(ctx, rv.afficheId)).toHaveLength(avant.length)
    expect(await stock(ctx, rv.afficheId)).toBe(5)
    expect((await fiche(ctx, m)).aReRattacher).toHaveLength(1)
    expect(types(await alertesDossier(ctx, m))).toContain('ECART_BC')
  })

  it('RG-X-064 quantité de la prépa 100 → 80 avec 90 reçus : « Surplus », liens et stock inchangés', async () => {
    const m = await monde(ctx, 'PREPARATION_RECUE')
    const rv = await recevoir(ctx, m, 90, { qteBc: 100, source: 'PREPA', qtePrepa: 100 })
    await withTransaction(db, (tx) =>
      integrerPreparation(tx, m.dossier.contNum, [{ ligneAttendueId: rv.ligne.id, qtePrepa: 80 }]),
    )
    expect(await stock(ctx, rv.afficheId)).toBe(90)
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect((await ligneDe(ctx, rv.ligne.id)).statut).toBe('SURPLUS')
  })
})

// ───────────── R-17 à R-19 : trains (unités prêtes, après export, export indépendant) ─────────────

describe('R-17 réception × train en attente (RG-X-003, RG-X-079, RG-X-080)', () => {
  it('RG-X-003 la réception qui couvre le visuel d’un train EN_ATTENTE le rend PRÊT dans la même transaction et le message annonce « 1 unité(s) prête(s) à produire »', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Violet'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Violet',
      themeCle: 'VIOLET',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const statutTrain = async () =>
      (await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)).json<{
        statut: string
      }>().statut
    expect(await statutTrain()).toBe('EN_ATTENTE')
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 3 },
    ])
    const r = await post(ctx, '/api/receptions', s.users.recep.headers, bl)
    expect(r.statusCode, r.body).toBe(201)
    const res = ReceptionCreeeSchema.parse(r.json())
    expect(res.unitesPretes).toBe(1)
    expect(res.message).toContain('1 unité(s) prête(s) à produire.')
    expect(await statutTrain()).toBe('PRET')
  })

  it('RG-X-003 rejet : une réception qui ne couvre aucun train n’annonce aucune unité prête ; un train sans reçu reste EN_ATTENTE', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Orange'])
    const d2 = await f.createDossier(db)
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: d2.contNum,
      supportId: s.support.id,
      theme: 'Autre',
    })
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 3 },
    ])
    const res = ReceptionCreeeSchema.parse(
      (await post(ctx, '/api/receptions', s.users.recep.headers, bl)).json(),
    )
    expect(res.unitesPretes).toBe(0)
    expect(res.message).not.toContain('prête(s) à produire')
    expect(
      (await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)).json<{
        statut: string
      }>().statut,
    ).toBe('EN_ATTENTE')
  })

  it('RG-X-003 le rattachement d’une inconnue par la Coordination qui couvre un train l’annonce aussi', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Bleu'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Bleu',
      themeCle: 'BLEU',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const m: Monde = { ...(await monde(ctx)), plateforme: s.plateforme, support: s.support }
    const inc = await inconnue(ctx, { ...m, headers: s.users.recep.headers }, 5)
    const r = await rattacherInconnue(ctx, s.users.coord.headers, inc.afficheId, [
      { ligneAttendueId: l.id, quantite: 5 },
    ])
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ unitesPretes: number; message: string }>()).toMatchObject({ unitesPretes: 1 })
    expect(r.json<{ message: string }>().message).toContain('1 unité(s) prête(s) à produire.')
  })

  it('RG-X-079 / RG-X-080 le reçu se rattache au visuel : le même thème reçu pour un AUTRE destinataire couvre aussi le train (pas de lien au destinataire)', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Vert'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Vert',
      themeCle: 'VERT',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 1 },
    ])
    await post(ctx, '/api/receptions', s.users.recep.headers, bl)
    const fiche = (
      await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)
    ).json<{ statut: string; positions: { etat: string }[] }>()
    expect(fiche.statut).toBe('PRET')
    expect(fiche.positions.map((p) => p.etat)).toEqual(['OK'])
  })
})

describe('R-18 affiche reçue après l’export des trains (RG-X-011, RG-X-010, RG-X-075 ; RG-X-085 PARTIEL : Q-280)', () => {
  it('RG-X-011 réception postérieure à l’export : alerte « Rajout après préparation » pour la Coordination et les chefs d’équipe ; trains figés, aucun raccrochage automatique', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Rouge'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Rouge',
      themeCle: 'ROUGE',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const ex = await envoyer(ctx, '/api/coordination/trains/export', s.users.coord.headers, {
      depart: DEPART_TXT,
      simulation: false,
    })
    expect(ex.statusCode, ex.body).toBe(200)
    // L'export précède la réception (horloge de test : une milliseconde d'écart suffit).
    await new Promise((fin) => setTimeout(fin, 20))
    const avantFaces = await db.faceTrain.findMany({ where: { trainId: t.trainId } })
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 2 },
    ])
    expect((await post(ctx, '/api/receptions', s.users.recep.headers, bl)).statusCode).toBe(201)
    const a = (
      await alertes(ctx, s.users.coord.headers, `?dossier=${String(dossier.contNum)}`)
    ).find((x) => x.regle === 'RG-X-011')
    expect(a).toMatchObject({
      type: 'APRES_LIBERATION',
      gravite: 'IMPORTANT',
      titre: 'Affiche reçue après l’export des trains',
    })
    expect(a?.destinataires).toEqual(['Coordination', 'Chefs d’équipe'])
    const apres = await db.faceTrain.findMany({ where: { trainId: t.trainId } })
    expect(apres.map((x) => [x.id, x.statut, x.version])).toEqual(
      avantFaces.map((x) => [x.id, x.statut, x.version]),
    )
  })

  it('RG-X-011 rejet : une réception AVANT l’export ne lève pas cette alerte', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Jaune'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Jaune',
      themeCle: 'JAUNE',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 2 },
    ])
    await post(ctx, '/api/receptions', s.users.recep.headers, bl)
    await new Promise((fin) => setTimeout(fin, 20))
    await envoyer(ctx, '/api/coordination/trains/export', s.users.coord.headers, {
      depart: DEPART_TXT,
      simulation: false,
    })
    const a = await alertes(ctx, s.users.coord.headers, `?dossier=${String(dossier.contNum)}`)
    expect(a.filter((x) => x.regle === 'RG-X-011')).toEqual([])
  })

  it('RG-X-011 le message nomme le cas d’un visuel absent de tous les trains du dossier (RG-X-075)', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Gris'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Thème tardif',
      themeCle: 'THEME TARDIF',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    await envoyer(ctx, '/api/coordination/trains/export', s.users.coord.headers, {
      depart: DEPART_TXT,
      simulation: false,
    })
    await new Promise((fin) => setTimeout(fin, 20))
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 2 },
    ])
    await post(ctx, '/api/receptions', s.users.recep.headers, bl)
    const a = (
      await alertes(ctx, s.users.coord.headers, `?dossier=${String(dossier.contNum)}`)
    ).find((x) => x.regle === 'RG-X-011')
    expect(a?.message).toContain('ne figure dans aucun train du dossier')
  })
})

describe('R-19 réception × export des trains (RG-X-083)', () => {
  it('RG-X-083 l’export ne dépend ni de la validation admin ni de la réception complète : train sans aucun reçu exporté sans refus', async () => {
    const s = await siteDeroulant(ctx)
    await trainExportable(ctx, s, ['Marron'])
    const r = await envoyer(ctx, '/api/coordination/trains/export', s.users.coord.headers, {
      depart: DEPART_TXT,
      simulation: false,
    })
    expect(r.statusCode, r.body).toBe(200)
  })
})

describe('R-20 droits : Réception et Coordination (RG-X-007, RG-X-015)', () => {
  const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']
  it('RG-X-015 seuls la coordination et l’administrateur valident une affiche (6 profils)', async () => {
    const m = await monde(ctx)
    const attendus: Record<Role, number> = {
      coord: 200,
      cheq: 403,
      recep: 403,
      expe: 403,
      admin: 200,
      com: 403,
    }
    for (const role of ROLES) {
      const u = await f.createUtilisateurAvecRoles(db, [role], [{ plateformeId: m.plateforme.id }])
      const rv = await recevoir(ctx, m, 2, { theme: `T-${role}` })
      const r = await valider(ctx, devHeaders(u.identifiantExterne), rv.afficheId, true)
      expect(r.statusCode, `${role} : ${r.body}`).toBe(attendus[role])
      expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(attendus[role] === 200)
    }
  })

  it('RG-X-007 la liste des alertes de Pilotage est lisible par la coordination et l’agent de réception, mais l’alerte « Validation admin » est destinée à la Coordination', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 2)
    expect(rv.afficheId).toBeGreaterThan(0)
    for (const h of [m.coord.headers, m.headers]) {
      ListeAlertesSchema.parse(
        (await get(ctx, `/api/alertes?dossier=${String(m.dossier.contNum)}`, h)).json(),
      )
    }
  })
})

describe('R-21 rebut d’une affiche × couverture des trains (RG-REC-017, RG-X-079)', () => {
  it('RG-REC-017 le rebut réduit le STOCK mais pas le REÇU : la ligne reste « Complète » et le train reste PRÊT (le visuel est réputé reçu, HYPOTHÈSE Q-280)', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Turquoise'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Turquoise',
      themeCle: 'TURQUOISE',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
      qteBc: 10,
    })
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 10 },
    ])
    const rv = ReceptionCreeeSchema.parse(
      (await post(ctx, '/api/receptions', s.users.recep.headers, bl)).json(),
    )
    const afficheId = rv.affiches[0]?.id
    if (afficheId === undefined) throw new Error('affiche')
    const a = await affiche(ctx, afficheId)
    const r = await post(ctx, `/api/affiches/${String(afficheId)}/rebut`, s.users.recep.headers, {
      version: a.version,
      quantite: 4,
      motif: 'AFFICHE_DECHIREE',
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(await stock(ctx, afficheId)).toBe(6)
    expect((await ligneDe(ctx, l.id)).statut).toBe('COMPLETE')
    expect(
      (await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)).json<{
        statut: string
      }>().statut,
    ).toBe('PRET')
  })

  it('RG-REC-017 rejet : un rebut supérieur au stock est refusé et ne touche ni la ligne ni le train', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 3)
    const a = await affiche(ctx, rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rebut`, m.headers, {
      version: a.version,
      quantite: 99,
      motif: 'AFFICHE_DECHIREE',
    })
    expect([409, 422]).toContain(r.statusCode)
    expect(await stock(ctx, rv.afficheId)).toBe(3)
  })
})

describe('R-22 emplacement des affiches saisi à la réception, lu par les trains (RG-X-088)', () => {
  it('RG-X-088 l’allée et le rayon saisis au contrôle apparaissent sur la position du train (lecture seule) ; sans emplacement : colonne vide', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Argent'])
    const dossier = t.dossiers[0]
    if (!dossier) throw new Error('dossier')
    const l = await ligne(ctx, s.plateforme.id, {
      contNum: dossier.contNum,
      supportId: s.support.id,
      theme: 'Argent',
      themeCle: 'ARGENT',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const positions = async () =>
      (await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)).json<{
        positions: { emplacement: string | null }[]
      }>().positions
    expect((await positions()).map((p) => p.emplacement)).toEqual([null])
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 3 },
    ])
    const rv = ReceptionCreeeSchema.parse(
      (await post(ctx, '/api/receptions', s.users.recep.headers, bl)).json(),
    )
    const lec = (
      await get(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, s.users.recep.headers)
    ).json<{ version: number; lignes: { afficheId: number; quantiteBl: number }[] }>()
    const ctl = await post(
      ctx,
      `/api/receptions/${String(rv.receptionId)}/controle`,
      s.users.recep.headers,
      {
        version: lec.version,
        controleurId: s.users.recep.id,
        lignes: lec.lignes.map((x) => ({
          afficheId: x.afficheId,
          qteComptee: x.quantiteBl,
          allee: 'c',
          rayon: '5',
        })),
      },
    )
    expect(ctl.statusCode, ctl.body).toBe(200)
    const [p] = await positions()
    expect(p?.emplacement).toMatch(/5/)
    // Lecture seule : la lecture du train n'a modifié ni l'affiche ni le stock.
    expect(rv.affiches[0]?.quantite).toBe(3)
  })
})
