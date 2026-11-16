// ÉTAPE 7 — ROLLBACK des effets induits entre Réception et Coordination (cellules A-nn de la matrice d'impact) :
// un échec FORCÉ (déclencheur SQLite temporaire RAISE(ABORT), toujours supprimé) de l'effet induit dans la
// MÊME transaction → aucune écriture partielle (ni côté Réception, ni côté Coordination, ni historique, ni
// clé d'idempotence). Sources : CLAUDE.md §6 (atomicité), RG-X-001, 003, 012, 050, 051, 057, 058, 065, 087.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ResultatFinDeJourneeSchema } from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import { annulerDossier } from '../../src/modules/coordination/integration.ts'
import {
  affiche,
  avecEchec,
  colisExpedie,
  fiche,
  inconnue,
  ligneDe,
  monde,
  mouvements,
  nouvelleLigne,
  receptionDe,
  rattacherInconnue,
  recevoir,
  stock,
  valider,
} from '../support/interactions.ts'
import { bonDeLivraison, contexteReception, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const enPanne = <T>(corps: string, fn: () => Promise<T>) => avecEchec(ctx, corps, fn)

describe('A-01 / A-02 « Valider la réception » : l’effet induit échoue (RG-X-001, RG-X-003, RG-REC-046)', () => {
  it('A-01 échec à l’écriture du mouvement de réception : ni livraison, ni réception, ni affiche, ni lien ; la ligne attendue est inchangée ; la clé n’est pas gardée (rejouable)', async () => {
    const m = await monde(ctx)
    const l = await nouvelleLigne(ctx, m, { theme: 'Panne mouvement', qteBc: 10 })
    const bl = await bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 4242 }])
    const cle = idem()
    const envoi = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/receptions',
        headers: { ...m.headers, ...cle },
        payload: bl,
      })
    const r = await enPanne(
      "BEFORE INSERT ON mouvement WHEN NEW.type = 'RECEPTION' AND NEW.quantite = 4242",
      envoi,
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.reception.count({ where: { plateformeId: m.plateforme.id } })).toBe(0)
    expect(await db.livraison.count({ where: { reference: bl.numeroBl } })).toBe(0)
    expect(await db.affiche.count({ where: { plateformeId: m.plateforme.id } })).toBe(0)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l.id } })).toBe(0)
    expect(await ligneDe(ctx, l.id)).toMatchObject({ statut: 'ATTENDUE', version: l.version })
    // Même clé, même corps, sans panne : la réception aboutit (la clé n'a pas été consommée).
    const ok = await envoi()
    expect(ok.statusCode, ok.body).toBe(201)
    expect(await db.reception.count({ where: { plateformeId: m.plateforme.id } })).toBe(1)
  })

  it('A-02 échec au recalcul de la ligne attendue (dernière écriture) : tout est annulé, y compris le mouvement et le lien déjà écrits', async () => {
    const m = await monde(ctx)
    const l = await nouvelleLigne(ctx, m, { theme: 'Panne recalcul', qteBc: 10 })
    const bl = await bonDeLivraison(ctx, m.headers, [{ ligneAttendueId: l.id, quantite: 6 }])
    const r = await enPanne(`BEFORE UPDATE ON tf_prepa_affiche WHEN NEW.id = ${String(l.id)}`, () =>
      post(ctx, '/api/receptions', m.headers, bl),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.reception.count({ where: { plateformeId: m.plateforme.id } })).toBe(0)
    expect(await db.affiche.count({ where: { plateformeId: m.plateforme.id } })).toBe(0)
    expect(
      await db.mouvement.count({ where: { affiche: { plateformeId: m.plateforme.id } } }),
    ).toBe(0)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l.id } })).toBe(0)
  })
})

describe('A-03 contrôle de la palette : l’effet induit échoue (RG-X-017, RG-X-004)', () => {
  it('A-03 échec à l’écriture du mouvement d’écart : palette toujours À contrôler, stock, emplacement et ligne inchangés', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 10, { qteBc: 10 })
    const lec = (
      await ctx.app.inject({
        method: 'GET',
        url: `/api/receptions/${String(rv.receptionId)}/controle`,
        headers: m.headers,
      })
    ).json<{ version: number; lignes: { afficheId: number }[] }>()
    const avant = await affiche(ctx, rv.afficheId)
    const r = await enPanne("BEFORE INSERT ON mouvement WHEN NEW.type = 'ECART_CONTROLE'", () =>
      post(ctx, `/api/receptions/${String(rv.receptionId)}/controle`, m.headers, {
        version: lec.version,
        controleurId: m.user.id,
        lignes: lec.lignes.map((x) => ({
          afficheId: x.afficheId,
          qteComptee: 13,
          allee: 'z',
          rayon: '9',
        })),
      }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await receptionDe(ctx, rv.receptionId)).statut).toBe('A_CONTROLER')
    expect(await stock(ctx, rv.afficheId)).toBe(10)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      allee: avant.allee,
      rayon: avant.rayon,
      version: avant.version,
    })
    expect((await ligneDe(ctx, rv.ligne.id)).statut).not.toBe('SURPLUS')
  })
})

describe('A-04 annulation du dossier : l’effet induit échoue (RG-X-065, RG-COO-032)', () => {
  it('A-04 échec au passage du dossier à « Annulé » : les lignes restent ACTIVES, aucune alerte « ligne annulée », l’affiche reçue est intacte', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    await expect(
      enPanne(
        `BEFORE UPDATE ON dossier WHEN NEW.id = ${String(m.dossier.id)} AND NEW.statut = 'ANNULE'`,
        () => withTransaction(db, (tx) => annulerDossier(tx, m.dossier.contNum)),
      ),
    ).rejects.toThrow()
    expect((await ligneDe(ctx, rv.ligne.id)).etatLigne).toBe('ACTIVE')
    expect((await db.dossier.findUniqueOrThrow({ where: { id: m.dossier.id } })).statut).toBe(
      'A_TRAITER',
    )
    expect((await fiche(ctx, m)).aReRattacher).toEqual([])
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({ validationAdmin: true })
    expect(await stock(ctx, rv.afficheId)).toBe(5)
  })
})

describe('A-05 annulation de la validation : l’effet induit échoue (RG-X-050)', () => {
  it('A-05 échec à la trace au dossier : la validation reste entière (par, le, étiquette), aucun mouvement', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const avant = await affiche(ctx, rv.afficheId)
    const nb = (await mouvements(ctx, rv.afficheId)).length
    const r = await enPanne(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'DOSSIER' AND NEW.entite_id = '${String(m.dossier.contNum)}' AND NEW.action = 'ANNULATION_VALIDATION_ADMIN'`,
      () => valider(ctx, m.coord.headers, rv.afficheId, false, avant.version),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      validationAdmin: true,
      validationAdminParId: avant.validationAdminParId,
      version: avant.version,
    })
    expect((await mouvements(ctx, rv.afficheId)).length).toBe(nb)
  })
})

describe('A-06 thème de Broadcast repris : l’effet induit échoue (RG-X-057)', () => {
  it('A-06 échec à la trace au dossier : le thème de l’affiche, la feuille à refaire et la validation sont inchangés', async () => {
    const m = await monde(ctx, 'PREPARATION_RECUE')
    const rv = await recevoir(ctx, m, 5, { theme: 'Ancien' })
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    await db.receptionAttendue.update({ where: { id: rv.ligne.id }, data: { theme: 'Nouveau' } })
    await db.affiche.update({ where: { id: rv.afficheId }, data: { themeModifie: true } })
    const l = await ligneDe(ctx, rv.ligne.id)
    const avant = await affiche(ctx, rv.afficheId)
    const r = await enPanne(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'DOSSIER' AND NEW.entite_id = '${String(m.dossier.contNum)}' AND NEW.action = 'REPRISE_THEME_BROADCAST'`,
      () =>
        post(ctx, `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`, m.coord.headers, {
          version: l.version,
        }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      theme: 'Ancien',
      feuilleARefaire: avant.feuilleARefaire,
      validationAdmin: true,
      version: avant.version,
    })
    expect(await stock(ctx, rv.afficheId)).toBe(5)
  })
})

describe('A-08 rattachement d’une inconnue : l’effet induit échoue (RG-X-051, RG-X-003)', () => {
  it('A-08 échec à la dernière écriture (trace de validation) : aucun lien, affiche ORPHELINE, palette « À identifier », ligne attendue inchangée ; le rattachement suivant aboutit', async () => {
    const m = await monde(ctx)
    const inc = await inconnue(ctx, m, 5)
    const l = await nouvelleLigne(ctx, m, { theme: 'Panne rattachement' })
    const avantAffiche = await affiche(ctx, inc.afficheId)
    const avantReception = await receptionDe(ctx, inc.receptionId)
    const r = await enPanne(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'AFFICHE' AND NEW.entite_id = '${String(inc.afficheId)}' AND NEW.action = 'VALIDATION_ADMIN'`,
      () =>
        rattacherInconnue(ctx, m.coord.headers, inc.afficheId, [
          { ligneAttendueId: l.id, quantite: 5 },
        ]),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.afficheAttendue.count({ where: { afficheId: inc.afficheId } })).toBe(0)
    expect(await affiche(ctx, inc.afficheId)).toMatchObject({
      statut: 'ORPHELINE',
      validationAdmin: false,
      version: avantAffiche.version,
    })
    expect(await receptionDe(ctx, inc.receptionId)).toMatchObject({
      statut: 'A_IDENTIFIER',
      version: avantReception.version,
    })
    expect(await ligneDe(ctx, l.id)).toMatchObject({ statut: 'ATTENDUE', version: l.version })
    const ok = await rattacherInconnue(ctx, m.coord.headers, inc.afficheId, [
      { ligneAttendueId: l.id, quantite: 5 },
    ])
    expect(ok.statusCode, ok.body).toBe(200)
    expect((await receptionDe(ctx, inc.receptionId)).statut).toBe('A_CONTROLER')
  })
})

describe('A-09 retrait du dernier dossier : l’effet induit échoue (RG-X-058, RG-X-013)', () => {
  it('A-09 échec à la trace d’annulation de la validation : le lien reste actif, l’affiche reste validée, la palette n’est pas repassée « À identifier »', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    const avantAffiche = await affiche(ctx, rv.afficheId)
    const avantReception = await receptionDe(ctx, rv.receptionId)
    const r = await enPanne(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'AFFICHE' AND NEW.entite_id = '${String(rv.afficheId)}' AND NEW.action = 'ANNULATION_VALIDATION_ADMIN'`,
      () =>
        post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, m.headers, {
          lienVersion: lien.version,
        }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      validationAdmin: true,
      version: avantAffiche.version,
    })
    expect(await receptionDe(ctx, rv.receptionId)).toMatchObject({
      statut: avantReception.statut,
      version: avantReception.version,
    })
    expect(await stock(ctx, rv.afficheId)).toBe(5)
  })
})

describe('A-10 changement de thème après réception : l’effet induit échoue (RG-X-012)', () => {
  it('A-10 échec à la trace du changement de thème : lien d’origine actif, thème, validation et feuille inchangés, aucune nouvelle ligne rattachée', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 5)
    await valider(ctx, m.coord.headers, rv.afficheId, true)
    const l2 = await nouvelleLigne(ctx, m, { theme: 'Autre thème' })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    const avant = await affiche(ctx, rv.afficheId)
    const r = await enPanne(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'AFFICHE' AND NEW.entite_id = '${String(rv.afficheId)}' AND NEW.action = 'MODIFICATION_THEME'`,
      () =>
        post(ctx, `/api/affiches/${String(avant.id)}/changer-theme`, m.coord.headers, {
          version: avant.version,
          lienId: lien.id,
          nouvelleLigneId: l2.id,
        }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.afficheAttendue.count({ where: { afficheId: avant.id, actif: true } })).toBe(1)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: l2.id } })).toBe(0)
    expect(await affiche(ctx, avant.id)).toMatchObject({
      theme: avant.theme,
      validationAdmin: true,
      feuilleARefaire: avant.feuilleARefaire,
      version: avant.version,
    })
  })
})

describe('A-07 fin de journée : l’effet induit (sortie de stock) échoue (RG-X-087)', () => {
  it('A-07 échec à la sortie de stock : le colis reste « A expédier », l’UM aussi, le stock de la réception est intact ; le passage suivant aboutit', async () => {
    const m = await monde(ctx)
    const rv = await recevoir(ctx, m, 10, { theme: 'Thème panne' })
    const { post2, colisId, um } = await colisExpedie(ctx, m, {
      contNum: m.dossier.contNum,
      theme: 'Thème panne',
      qte: 4,
    })
    const r = await enPanne("BEFORE INSERT ON mouvement WHEN NEW.type = 'EXPEDITION'", () =>
      post2('/fin-de-journee', {}),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await db.colis.findUniqueOrThrow({ where: { id: colisId } })).statut).toBe('A_EXPEDIER')
    expect((await db.uniteManutention.findUniqueOrThrow({ where: { id: um.id } })).statut).toBe(
      'A_EXPEDIER',
    )
    expect(await stock(ctx, rv.afficheId)).toBe(10)
    const ok = await post2('/fin-de-journee', {})
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ResultatFinDeJourneeSchema.parse(ok.json()).sortiesStock).toBe(1)
    expect(await stock(ctx, rv.afficheId)).toBe(6)
  })
})
