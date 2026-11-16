// REC-P08 — liste et fiche des affiches (ECR-REC-03, ECR-REC-05) : RG-REC-121 à 150, RG-REC-169.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FicheAfficheSchema, ListeAffichesSchema } from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  ligne,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const fiche = async (id: number, headers: Record<string, string>) =>
  FicheAfficheSchema.parse((await get(ctx, `/api/affiches/${String(id)}`, headers)).json())
const patch = (id: number, headers: Record<string, string>, payload: object) =>
  ctx.app.inject({ method: 'PATCH', url: `/api/affiches/${String(id)}`, headers, payload })

describe('REC-P08 Liste des affiches', () => {
  it('RG-REC-121 / RG-REC-125 / RG-REC-126 une ligne par affiche, en stock = Σ mouvements, rebut mis en évidence', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 10)
    const l2 = await ligne(ctx, s.plateforme.id)
    await f.createRattachement(db, {
      afficheId: rv.afficheId,
      ligneAttendueId: l2.id,
      quantite: 0,
      mode: 'MAIN',
    })
    await f.createMouvement(db, {
      afficheId: rv.afficheId,
      type: 'MISE_AU_REBUT',
      quantite: -3,
      date: new Date(),
    })
    const r = await get(ctx, '/api/affiches', s.headers)
    expect(r.statusCode).toBe(200)
    const liste = ListeAffichesSchema.parse(r.json())
    expect(liste.items).toHaveLength(1)
    expect(liste.items[0]).toMatchObject({
      id: rv.afficheId,
      enStock: 7,
      rebut: 3,
      statut: 'IDENTIFIEE',
    })
    expect(liste.items[0]?.dossiers).toHaveLength(2)
  })

  it('RG-REC-121 tri initial date d’entrée décroissante', async () => {
    const s = await site(ctx)
    const vieille = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      dateEntree: new Date('2026-01-01'),
    })
    const recente = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      dateEntree: new Date('2026-06-01'),
    })
    const liste = ListeAffichesSchema.parse((await get(ctx, '/api/affiches', s.headers)).json())
    expect(liste.items.map((a) => a.id)).toEqual([recente.id, vieille.id])
  })

  it('RG-REC-127 / RG-REC-128 / RG-REC-129 tags calculés : À contrôler, Complément, Feuille à refaire, Réception inconnue', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const bl = await bonDeLivraison(ctx, s.headers, [
      { ligneAttendueId: rv.ligne.id, quantite: 2, complementAfficheId: rv.afficheId },
    ])
    expect((await post(ctx, '/api/receptions', s.headers, bl)).statusCode).toBe(201)
    await db.affiche.update({ where: { id: rv.afficheId }, data: { feuilleARefaire: true } })
    const inc = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
    })
    const orph = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      statut: 'ORPHELINE',
      receptionId: inc.id,
    })
    const liste = ListeAffichesSchema.parse((await get(ctx, '/api/affiches', s.headers)).json())
    const tags = (id: number) => liste.items.find((a) => a.id === id)?.tags
    expect(tags(rv.afficheId)).toEqual(['A_CONTROLER', 'COMPLEMENT', 'FEUILLE_A_REFAIRE'])
    expect(tags(orph.id)).toEqual(['A_CONTROLER', 'RECEPTION_INCONNUE'])
    const parTag = ListeAffichesSchema.parse(
      (await get(ctx, '/api/affiches?tag=COMPLEMENT', s.headers)).json(),
    )
    expect(parTag.items.map((a) => a.id)).toEqual([rv.afficheId])
    const orphelines = ListeAffichesSchema.parse(
      (await get(ctx, '/api/affiches?tag=ORPHELINE', s.headers)).json(),
    )
    expect(orphelines.items.map((a) => a.id)).toEqual([orph.id])
  })

  it('RG-REC-122 filtres dossier, départ (sans semaine reste visible), format, imprimeur', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const sansSemaine = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      statut: 'ORPHELINE',
    })
    const parDossier = ListeAffichesSchema.parse(
      (await get(ctx, `/api/affiches?dossier=${String(rv.ligne.contNum)}`, s.headers)).json(),
    )
    expect(parDossier.items.map((a) => a.id)).toEqual([rv.afficheId])
    const ailleurs = ListeAffichesSchema.parse(
      (await get(ctx, '/api/affiches?depart=2099-W01', s.headers)).json(),
    )
    expect(ailleurs.items.map((a) => a.id)).toEqual([sansSemaine.id])
    const parImprimeur = ListeAffichesSchema.parse(
      (await get(ctx, `/api/affiches?imprimeurId=${String(rv.bl.imprimeurId)}`, s.headers)).json(),
    )
    expect(parImprimeur.items.map((a) => a.id)).toEqual([rv.afficheId])
    const parFormat = ListeAffichesSchema.parse(
      (await get(ctx, `/api/affiches?supportId=${String(rv.ligne.supportId)}`, s.headers)).json(),
    )
    expect(parFormat.items.map((a) => a.id)).toEqual([rv.afficheId])
  })

  it('RG-REC-001 la liste ne montre que le périmètre', async () => {
    const s = await site(ctx)
    await f.createAffiche(db)
    expect(
      ListeAffichesSchema.parse((await get(ctx, '/api/affiches', s.headers)).json()).total,
    ).toBe(0)
  })

  it('RG-REC-002 le profil expe ne consulte pas la liste (403)', async () => {
    const s = await site(ctx)
    const intrus = await autre(ctx, s.plateforme.id, ['expe'])
    expect((await get(ctx, '/api/affiches', intrus.headers)).statusCode).toBe(403)
  })
})

describe('REC-P08 Fiche de l’affiche', () => {
  it('RG-REC-130 / RG-REC-132 / RG-REC-134 fiche : détail, mouvements, préparations, historique ; RG-REC-142 sans écriture', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 6)
    const avant = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const fi = await fiche(rv.afficheId, s.headers)
    expect(fi).toMatchObject({
      id: rv.afficheId,
      version: avant.version,
      enStock: 6,
      conservation: 20,
      fusionneeHeritee: false,
    })
    expect(fi.mouvements).toMatchObject([
      { type: 'RECEPTION', quantite: 6, receptionId: rv.receptionId },
    ])
    expect(fi.preparations).toMatchObject([
      { ligneAttendueId: rv.ligne.id, quantite: 6, mode: 'BL' },
    ])
    expect(fi.historique.map((h) => h.action)).toContain('CREATION_AFFICHE')
    expect(fi.receptions.map((r) => r.id)).toEqual([rv.receptionId])
    expect((await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })).version).toBe(
      avant.version,
    )
  })

  it('RG-REC-001 fiche hors périmètre : 403 ; inexistante : 404', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db)
    expect((await get(ctx, `/api/affiches/${String(a.id)}`, s.headers)).statusCode).toBe(403)
    expect((await get(ctx, '/api/affiches/999999999', s.headers)).statusCode).toBe(404)
  })

  it('RG-REC-131 modifie annonceur, thème, imprimeur, emplacement, commentaire avec historique par champ', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 6)
    const imp = await f.createImprimeur(db)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await patch(a.id, s.headers, {
      version: a.version,
      annonceur: 'Nouvel annonceur',
      theme: 'Nouveau',
      imprimeurId: imp.id,
      allee: 'd',
      rayon: '9',
      commentaire: 'note',
    })
    expect(r.statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
      contAnnonc: 'Nouvel annonceur',
      theme: 'Nouveau',
      imprimeurId: imp.id,
      allee: 'D',
      rayon: '9',
      commentaire: 'note',
      feuilleARefaire: false,
    })
    const actions = (
      await db.journalAudit.findMany({ where: { entiteId: String(a.id), typeEntite: 'AFFICHE' } })
    ).map((j) => j.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'MODIFICATION_ANNONCEUR',
        'MODIFICATION_THEME',
        'MODIFICATION_IMPRIMEUR',
        'MODIFICATION_EMPLACEMENT',
        'MODIFICATION_COMMENTAIRE',
      ]),
    )
  })

  it('RG-REC-131 la quantité ne se modifie pas par la fiche (champ ignoré)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 6)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    await patch(a.id, s.headers, { version: a.version, quantite: 999 })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).quantite).toBe(6)
  })

  it('RG-REC-145 « Affiche à conserver » historisé', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 6)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    expect(
      (await patch(a.id, s.headers, { version: a.version, aConserver: true })).statusCode,
    ).toBe(200)
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(a.id), action: 'MODIFICATION_A_CONSERVER' },
      }),
    ).toBe(1)
  })

  it('RG-REC-009 modification sur une version périmée : 409', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 6)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await patch(a.id, s.headers, { version: a.version - 1, commentaire: 'x' })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('REC_CONFLIT_VERSION')
  })

  it('RG-REC-002 le profil com ne modifie pas la fiche (403)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 6)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const intrus = await autre(ctx, s.plateforme.id, ['com'])
    expect(
      (await patch(a.id, intrus.headers, { version: a.version, commentaire: 'x' })).statusCode,
    ).toBe(403)
  })

  it('RG-REC-169 une affiche cible d’une fusion héritée est en lecture seule (409)', async () => {
    const s = await site(ctx)
    const chapeau = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    const fille = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    await f.createFusionAffiche(db, { afficheChapeauId: chapeau.id, afficheId: fille.id })
    const r = await patch(fille.id, s.headers, { version: fille.version, commentaire: 'x' })
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({
      code: 'REC_AFFICHE_FUSIONNEE_LECTURE_SEULE',
      regle: 'RG-REC-169',
    })
    expect((await fiche(fille.id, s.headers)).fusionneeHeritee).toBe(true)
    // Le chapeau reste modifiable.
    expect(
      (await patch(chapeau.id, s.headers, { version: chapeau.version, commentaire: 'x' }))
        .statusCode,
    ).toBe(200)
  })
})

describe('REC-P08 Rattachements depuis la fiche', () => {
  it('RG-REC-136 « + Rattacher à un autre dossier » : lien créé, « Feuille à refaire »', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    await db.afficheAttendue.updateMany({
      where: { afficheId: rv.afficheId },
      data: { quantite: 2 },
    })
    const l2 = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, s.headers, {
      version: a.version,
      ligneAttendueId: l2.id,
      quantite: 2,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toContain('feuille de stock à refaire')
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id, actif: true } })).toBe(2)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).feuilleARefaire).toBe(true)
  })

  it('RG-REC-136 refuse une quantité < 1 (422)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const l2 = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, s.headers, {
      version: a.version,
      ligneAttendueId: l2.id,
      quantite: 0,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_QTE_DOSSIER_OBLIGATOIRE', regle: 'RG-REC-136' })
  })

  it('RG-X-060 refuse un rattachement qui dépasse le reçu (422)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const l2 = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, s.headers, {
      version: a.version,
      ligneAttendueId: l2.id,
      quantite: 1,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('REC_REPARTITION_DEPASSE')
  })

  it('RG-REC-136 une affiche orpheline rattachée devient IDENTIFIEE et sa palette passe À contrôler', async () => {
    const s = await site(ctx)
    const rec = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      statut: 'A_IDENTIFIER',
      estInconnue: true,
    })
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      statut: 'ORPHELINE',
      receptionId: rec.id,
    })
    await f.createMouvement(db, {
      afficheId: a.id,
      type: 'RECEPTION',
      quantite: 5,
      date: new Date(),
    })
    const l = await ligne(ctx, s.plateforme.id)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, s.headers, {
      version: a.version,
      ligneAttendueId: l.id,
      quantite: 5,
    })
    expect(r.statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).statut).toBe('IDENTIFIEE')
    expect((await db.reception.findUniqueOrThrow({ where: { id: rec.id } })).statut).toBe(
      'A_CONTROLER',
    )
  })

  it('RG-REC-135 / RG-REC-150 changer de thème (même dossier) : nouveau lien, thème, « Feuille à refaire », ancienne ligne retirée des attendues', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const nouvelle = await ligne(ctx, s.plateforme.id, {
      contNum: rv.ligne.contNum,
      theme: 'Thème B',
      themeCle: 'THEME B',
    })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: a.id, actif: true },
    })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, s.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: nouvelle.id,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json<{ message: string }>().message).toBe(
      'Thème corrigé : feuille de stock à refaire.',
    )
    expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
      theme: 'Thème B',
      feuilleARefaire: true,
      statut: 'IDENTIFIEE',
    })
    expect(
      await db.afficheAttendue.findMany({ where: { afficheId: a.id, actif: true } }),
    ).toMatchObject([{ ligneAttendueId: nouvelle.id, quantite: 4 }])
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).etatLigne,
    ).toBe('ANNULEE')
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: nouvelle.id } })).statut,
    ).not.toBe('ATTENDUE')
  })

  it('RG-REC-135 refuse un thème d’un autre dossier (422)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const autreDossier = await ligne(ctx, s.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: a.id, actif: true },
    })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, s.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: autreDossier.id,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'REC_THEME_AUTRE_DOSSIER', regle: 'RG-REC-135' })
  })

  it('RG-REC-135 / RG-REC-111 changer de thème par la réception annule une validation admin (à confirmer)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    await db.affiche.update({ where: { id: rv.afficheId }, data: { validationAdmin: true } })
    const nouvelle = await ligne(ctx, s.plateforme.id, { contNum: rv.ligne.contNum })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: a.id, actif: true },
    })
    await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, s.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: nouvelle.id,
    })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).validationAdmin).toBe(
      false,
    )
  })

  it('RG-REC-137 retirer un lien : RETIRE (par, le), jamais supprimé ; un lien retiré ne se retire pas deux fois (409)', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: rv.afficheId, actif: true },
    })
    expect(
      (
        await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
          lienVersion: lien.version,
        })
      ).statusCode,
    ).toBe(200)
    const apres = await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })
    expect(apres).toMatchObject({ actif: false, retirePar: s.user.id })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, s.headers, {
      lienVersion: apres.version,
    })
    expect(r.statusCode).toBe(409)
  })

  it.each([['cheq'], ['com']] as const)(
    'RG-REC-002 le profil %s ne modifie pas les rattachements (403)',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      const lien = await db.afficheAttendue.findFirstOrThrow({
        where: { afficheId: rv.afficheId, actif: true },
      })
      const intrus = await autre(ctx, s.plateforme.id, [role])
      expect(
        (
          await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, intrus.headers, {
            lienVersion: lien.version,
          })
        ).statusCode,
      ).toBe(403)
    },
  )
})

describe('REC-P08 Validation admin', () => {
  it('RG-REC-003 / RG-X-007 coord valide puis annule la validation (historisée)', async () => {
    const s = await site(ctx, ['coord'])
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
    expect(
      (
        await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, s.headers, {
          version: a.version,
          valider: true,
        })
      ).statusCode,
    ).toBe(200)
    const b = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
    expect(b).toMatchObject({ validationAdmin: true, validationAdminParId: s.user.id })
    // Déjà validée → 409.
    expect(
      (
        await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, s.headers, {
          version: b.version,
          valider: true,
        })
      ).statusCode,
    ).toBe(409)
    expect(
      (
        await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, s.headers, {
          version: b.version,
          valider: false,
        })
      ).statusCode,
    ).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).validationAdmin).toBe(
      false,
    )
    expect(
      await db.journalAudit.count({
        where: {
          entiteId: String(a.id),
          action: { in: ['VALIDATION_ADMIN', 'ANNULATION_VALIDATION_ADMIN'] },
        },
      }),
    ).toBe(2)
  })

  it.each([['recep'], ['cheq']] as const)(
    'RG-REC-003 le profil %s ne valide pas (403 REC_VALIDATION_RESERVEE)',
    async (role) => {
      const s = await site(ctx)
      const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 4)
      const intrus = await autre(ctx, s.plateforme.id, [role])
      const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
      const r = await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, intrus.headers, {
        version: a.version,
        valider: true,
      })
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'REC_VALIDATION_RESERVEE', regle: 'RG-REC-003' })
    },
  )

  it('RG-REC-111 une affiche orpheline ne se valide pas : « à rattacher d’abord » (409)', async () => {
    const s = await site(ctx, ['coord'])
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, statut: 'ORPHELINE' })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, s.headers, {
      version: a.version,
      valider: true,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-111')
  })
})

describe('EX-NEW-REC-005 fiche étendue', () => {
  it('enregistre repiquage, conservation, picking et photo avec version et audit ; refuse une photo hors périmètre', async () => {
    const s = await site(ctx)
    const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, 10)
    const avant = await fiche(rv.afficheId, s.headers)
    const rec = await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })
    const image = await f.createPhoto(db, { createdById: rec.createdById })
    const r = await patch(rv.afficheId, s.headers, {
      version: avant.version,
      repiquage: 'Centre fictif',
      conservation: 12,
      zonePicking: true,
      photoId: image.id,
    })
    expect(r.statusCode, r.body).toBe(200)
    const apres = await fiche(rv.afficheId, s.headers)
    expect(apres).toMatchObject({
      repiquage: 'Centre fictif',
      conservation: 12,
      zonePicking: true,
      photoId: image.id,
      version: avant.version + 1,
    })
    expect(apres.historique.some((h) => h.nouveau?.includes('Centre fictif'))).toBe(true)
    expect(
      (await patch(rv.afficheId, s.headers, { version: avant.version, repiquage: 'Obsolète' }))
        .statusCode,
    ).toBe(409)
    const autreSite = await site(ctx)
    const autreReception = await receptionValidee(
      ctx,
      autreSite.headers,
      autreSite.plateforme.id,
      10,
    )
    const autreRec = await db.reception.findUniqueOrThrow({
      where: { id: autreReception.receptionId },
    })
    const privee = await f.createPhoto(db, { createdById: autreRec.createdById })
    expect(
      (await patch(rv.afficheId, s.headers, { version: apres.version, photoId: privee.id }))
        .statusCode,
    ).toBe(403)
  })
})
