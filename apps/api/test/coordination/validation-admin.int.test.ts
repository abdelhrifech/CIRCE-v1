// COO-P03 — validation admin : proposition de rattachement à la réception, état calculé (proposé / doute /
// validée / réception inconnue), motifs, cas sûrs, pastille du dossier, « Valider la sélection » avec
// confirmation explicite des doutes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DoutesAConfirmerSchema,
  FicheAfficheSchema,
  FicheDossierSchema,
  ListeDossiersSchema,
  ValiderSelectionResultatSchema,
  type Role,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  bonDeLivraison,
  contexteReception,
  erreur,
  get,
  idem,
  ligne,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

/** Un site, un agent de réception et un coordinateur du site, un dossier (prépa à traiter par défaut). */
async function contexte(preparation: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE' = 'A_TRAITER') {
  const s = await site(ctx, ['recep'])
  const coord = await autre(ctx, s.plateforme.id, ['coord'])
  const dossier = await f.createDossier(db, { statut: preparation })
  return { ...s, coord, dossier }
}

type Ctx = Awaited<ReturnType<typeof contexte>>

/** Réception par le panier (mode BL) de `qte` affiches sur une ligne du dossier. */
function recevoir(c: Ctx, qte = 10, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
  return receptionValidee(ctx, c.headers, c.plateforme.id, qte, {
    contNum: c.dossier.contNum,
    supportId: c.support.id,
    ...data,
  })
}

const valider = (headers: Record<string, string>, payload: object) =>
  post(ctx, '/api/coordination/validation-admin', headers, payload)

async function liste(headers: Record<string, string>, query = '') {
  const r = await get(ctx, `/api/coordination/dossiers?pageSize=100${query}`, headers)
  expect(r.statusCode).toBe(200)
  return ListeDossiersSchema.parse(r.json())
}

async function dossierListe(c: Ctx, headers = c.coord.headers) {
  const l = await liste(headers, `&dossier=${String(c.dossier.contNum)}`)
  const d = l.items[0]
  if (!d) throw new Error('dossier absent de la liste')
  return d
}

async function fiche(c: Ctx, headers = c.coord.headers) {
  const r = await get(ctx, `/api/coordination/dossiers/${String(c.dossier.id)}`, headers)
  expect(r.statusCode).toBe(200)
  return FicheDossierSchema.parse(r.json())
}

const affiche = (id: number) => db.affiche.findUniqueOrThrow({ where: { id } })

describe('RG-NEW-REC-004 validation depuis la liste des affiches', () => {
  it('RG-NEW-REC-004 ne valide que les affiches cochées, même dans un dossier commun', async () => {
    const c = await contexte()
    const a = await recevoir(c)
    const b = await recevoir(c)
    const r = await valider(c.coord.headers, { afficheIds: [a.afficheId] })
    expect(r.statusCode).toBe(200)
    expect((await affiche(a.afficheId)).validationAdmin).toBe(true)
    expect((await affiche(b.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-NEW-REC-004 refuse une affiche hors périmètre et un agent de réception', async () => {
    const c = await contexte()
    const a = await recevoir(c)
    expect((await valider(c.headers, { afficheIds: [a.afficheId] })).statusCode).toBe(403)
    const autreSite = await contexte()
    expect((await valider(autreSite.coord.headers, { afficheIds: [a.afficheId] })).statusCode).toBe(
      403,
    )
    expect((await affiche(a.afficheId)).validationAdmin).toBe(false)
  })
})

describe('RG-X-001 / RG-COO-002 / RG-COO-004 proposition de rattachement à la réception', () => {
  it('RG-X-001 valider la réception propose le rattachement (mode BL) sans poser la validation : « à confirmer : proposé »', async () => {
    const c = await contexte()
    const rv = await recevoir(c)
    const a = await affiche(rv.afficheId)
    expect(a).toMatchObject({ validationAdmin: false, validationAdminParId: null })
    const liens = await db.afficheAttendue.findMany({ where: { afficheId: a.id, actif: true } })
    expect(liens).toMatchObject([{ mode: 'BL', ligneAttendueId: rv.ligne.id, quantite: 10 }])
    const fi = await fiche(c)
    expect(fi.affiches).toMatchObject([
      { id: a.id, etat: 'A_CONFIRMER_PROPOSE', motifs: [], validePar: null },
    ])
    expect(fi.validationAdmin).toEqual({
      etat: 'A_CONFIRMER',
      aConfirmer: 1,
      doutes: 0,
      casSur: true,
    })
  })

  it('RG-COO-002 rejet : une réception validée par un coordinateur ne pose pas non plus la validation admin', async () => {
    const c = await contexte()
    const rv = await receptionValidee(ctx, c.coord.headers, c.plateforme.id, 4, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
    expect((await fiche(c)).affiches[0]?.etat).toBe('A_CONFIRMER_PROPOSE')
  })

  it('RG-COO-004 la proposition est recalculée quand la ligne change (IP saisies : le doute SANS_IP disparaît)', async () => {
    const c = await contexte()
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: null,
    })
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'Intitulé saisi',
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 3,
      mode: 'BL',
    })
    expect((await fiche(c)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['SANS_IP'],
    })
    await db.receptionAttendue.update({ where: { id: l.id }, data: { theme: 'Intitulé saisi' } })
    expect((await fiche(c)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_PROPOSE',
      motifs: [],
    })
  })

  it('RG-COO-004 rejet : une ligne attendue sans affiche reçue ne crée aucune proposition (« Pas encore reçue »)', async () => {
    const c = await contexte()
    await ligne(ctx, c.plateforme.id, { contNum: c.dossier.contNum, supportId: c.support.id })
    const fi = await fiche(c)
    expect(fi.affiches).toEqual([])
    expect(fi.lignes[0]?.affichesRecues).toBe(0)
    expect(fi.validationAdmin.etat).toBe('AUCUNE_AFFICHE_RECUE')
  })
})

describe('RG-COO-006 / RG-X-002 / RG-COO-003 motifs de doute posés par la réception', () => {
  it('RG-X-002 rejet : réception par le panier (BL, même format, un seul thème, IP saisies) → aucun motif', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 3)
    expect((await fiche(c)).affiches).toMatchObject([
      { id: rv.afficheId, etat: 'A_CONFIRMER_PROPOSE', motifs: [] },
    ])
  })

  it('RG-COO-002 une personne autorisée confirme : VALIDEE, par et le nominatifs (jamais « Circé »)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    expect((await valider(c.coord.headers, { dossierIds: [c.dossier.id] })).statusCode).toBe(200)
    const a = await affiche(rv.afficheId)
    expect(a.validationAdminParId).toBe(c.coord.user.id)
    expect(a.validationAdminLe).toBeInstanceOf(Date)
    const fa = (await fiche(c)).affiches[0]
    expect(fa?.etat).toBe('VALIDEE')
    expect(fa?.validePar).toBe(c.coord.user.nom ?? c.coord.user.identifiantExterne)
  })

  async function afficheLiee(
    c: Ctx,
    o: {
      mode?: 'BL' | 'VISUEL' | 'MAIN'
      supportAffiche?: number
      theme?: string | null
      themeLigne?: string | null
      annulee?: boolean
    } = {},
  ) {
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: o.themeLigne === undefined ? 'Thème A' : o.themeLigne,
    })
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: o.supportAffiche ?? c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: o.theme === undefined ? 'Thème A' : o.theme,
      validationAnnulee: o.annulee ?? false,
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 2,
      mode: o.mode ?? 'BL',
    })
    return { a, l }
  }

  it('RG-COO-003 / RG-X-002 rattachement à la main (MAIN) ou par le visuel (VISUEL) : motif BL', async () => {
    const c = await contexte()
    await afficheLiee(c, { mode: 'MAIN' })
    await afficheLiee(c, { mode: 'VISUEL' })
    const fi = await fiche(c)
    expect(fi.affiches.map((a) => [a.etat, a.motifs])).toEqual([
      ['A_CONFIRMER_DOUTE', ['BL']],
      ['A_CONFIRMER_DOUTE', ['BL']],
    ])
    expect(fi.validationAdmin).toMatchObject({ aConfirmer: 2, doutes: 2, casSur: false })
  })

  it('RG-X-002 format du BL ≠ format de la ligne : motif FORMAT', async () => {
    const c = await contexte()
    const autreSupport = await f.createSupport(db)
    await afficheLiee(c, { supportAffiche: autreSupport.id })
    expect((await fiche(c)).affiches[0]?.motifs).toEqual(['FORMAT'])
  })

  it('RG-X-002 plusieurs thèmes possibles dans ce format et thème différent : motif THEME', async () => {
    const c = await contexte()
    const { l } = await afficheLiee(c, { theme: 'Visuel B' })
    await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      semAnnee: l.semAnnee,
      semNum: l.semNum,
      theme: 'Visuel B',
    })
    expect((await fiche(c)).affiches[0]?.motifs).toEqual(['THEME'])
  })

  it('RG-X-002 même affiche pour plusieurs dossiers : motif MULTI (affichée dans chaque dossier)', async () => {
    const c = await contexte()
    const { a } = await afficheLiee(c)
    const d2 = await f.createDossier(db)
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: d2.contNum,
      supportId: c.support.id,
      theme: 'Thème A',
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l2.id,
      quantite: 1,
      mode: 'BL',
    })
    expect((await fiche(c)).affiches[0]?.motifs).toEqual(['MULTI'])
    const l = await liste(c.coord.headers, `&dossier=${String(d2.contNum)}`)
    expect(l.items[0]?.validationAdmin).toMatchObject({ etat: 'A_CONFIRMER', doutes: 1 })
  })

  it('RG-X-002 IP non saisies (ligne sans thème) : motif SANS_IP', async () => {
    const c = await contexte()
    await afficheLiee(c, { themeLigne: null, theme: 'Intitulé lu' })
    expect((await fiche(c)).affiches[0]?.motifs).toEqual(['SANS_IP'])
  })

  it('RG-COO-006 validation annulée : motif ANNULEE ; une nouvelle confirmation l’efface', async () => {
    const c = await contexte()
    const rv = await recevoir(c)
    const a = await affiche(rv.afficheId)
    const v = await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, c.coord.headers, {
      version: a.version,
      valider: true,
    })
    expect(v.statusCode).toBe(200)
    const apres = await affiche(a.id)
    const an = await post(ctx, `/api/affiches/${String(a.id)}/validation-admin`, c.coord.headers, {
      version: apres.version,
      valider: false,
    })
    expect(an.statusCode).toBe(200)
    expect((await affiche(a.id)).validationAnnulee).toBe(true)
    const fi = await fiche(c)
    expect(fi.affiches[0]).toMatchObject({ etat: 'A_CONFIRMER_DOUTE', motifs: ['ANNULEE'] })
    const cur = await affiche(a.id)
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: a.id, version: cur.version }],
    })
    expect(r.statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({ validationAdmin: true, validationAnnulee: false })
  })

  it('RG-COO-007 fiche affiche (ECR-REC-05) : même état et mêmes motifs que la Coordination', async () => {
    const c = await contexte()
    const { a } = await afficheLiee(c, { mode: 'MAIN' })
    const r = await get(ctx, `/api/affiches/${String(a.id)}`, c.headers)
    expect(r.statusCode).toBe(200)
    expect(FicheAfficheSchema.parse(r.json()).validation).toMatchObject({
      validee: false,
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['BL'],
    })
  })

  it('RG-COO-007 affiche orpheline : réception inconnue (aucun dossier)', async () => {
    const c = await contexte()
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'ORPHELINE',
    })
    const r = await get(ctx, `/api/affiches/${String(a.id)}`, c.headers)
    expect(FicheAfficheSchema.parse(r.json()).validation).toMatchObject({
      etat: 'RECEPTION_INCONNUE',
      motifs: [],
    })
  })
})

describe('RG-COO-010 / 012 / 013 « Valider la sélection »', () => {
  it('RG-COO-010 confirme en une transaction les cas sûrs des dossiers cochés (par, le, journal affiche et dossier)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 5)
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(200)
    const res = ValiderSelectionResultatSchema.parse(r.json())
    expect(res.confirmees.map((x) => x.id)).toEqual([rv.afficheId])
    expect(res.ignorees).toEqual([])
    expect(res.message).toContain('1 affiche(s) confirmée(s)')
    const a = await affiche(rv.afficheId)
    expect(a).toMatchObject({ validationAdmin: true, validationAdminParId: c.coord.user.id })
    expect(a.validationAdminLe).not.toBeNull()
    const journal = await db.journalAudit.findMany({
      where: { action: 'VALIDATION_ADMIN', parId: c.coord.user.id },
    })
    expect(journal.map((j) => j.typeEntite).sort()).toEqual(['AFFICHE', 'DOSSIER'])
    expect(journal.find((j) => j.typeEntite === 'AFFICHE')?.nouvelleValeur).toContain(
      'rattachement proposé par Circé, sans doute',
    )
    const fi = await fiche(c)
    expect(fi.affiches[0]?.etat).toBe('VALIDEE')
    expect(fi.affiches[0]?.validePar).toBeTruthy()
    expect(fi.validationAdmin.etat).toBe('VALIDEE')
    expect(fi.historique.some((h) => h.action === 'VALIDATION_ADMIN')).toBe(true)
  })

  it('RG-COO-012 rejet : doutes sans confirmation explicite → 422 avec la liste des doutes, rien n’est écrit', async () => {
    const c = await contexte()
    const sure = await recevoir(c, 2)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'Thème A',
    })
    const doute = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'Thème A',
    })
    await f.createRattachement(db, {
      afficheId: doute.id,
      ligneAttendueId: l.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(422)
    const e = erreur(r)
    expect(e).toMatchObject({ code: 'COO_DOUTES_A_CONFIRMER', regle: 'RG-COO-012' })
    expect(e.message).toContain('1 affiche(s) sans doute et 1 affiche(s) à doute')
    const details = DoutesAConfirmerSchema.parse(e.details)
    expect(details.sansDoute).toBe(1)
    expect(details.doutes).toMatchObject([
      { id: doute.id, motifs: ['BL'], dossier: c.dossier.contNum },
    ])
    expect((await affiche(sure.afficheId)).validationAdmin).toBe(false)
    expect((await affiche(doute.id)).validationAdmin).toBe(false)
  })

  it('RG-COO-012 « Confirmer tout » : doutes vus confirmés (journal « après vérification »)', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const doute = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'Thème A',
    })
    await f.createRattachement(db, {
      afficheId: doute.id,
      ligneAttendueId: l.id,
      quantite: 1,
      mode: 'VISUEL',
    })
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: doute.id, version: doute.version }],
    })
    expect(r.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r.json()).confirmees).toHaveLength(2)
    const j = await db.journalAudit.findFirstOrThrow({
      where: { typeEntite: 'AFFICHE', entiteId: String(doute.id), action: 'VALIDATION_ADMIN' },
    })
    expect(j.nouvelleValeur).toContain('après vérification : rattachée sans le n° du BL')
  })

  it('RG-COO-012 / RG-COO-010 un doute non vu ou de version changée est ignoré et listé, sans bloquer les autres', async () => {
    const c = await contexte()
    const sure = await recevoir(c, 2)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const mk = async () => {
      const a = await f.createAffiche(db, {
        plateformeId: c.plateforme.id,
        supportId: c.support.id,
        contNum: c.dossier.contNum,
        statut: 'IDENTIFIEE',
        theme: 'Thème A',
      })
      await f.createRattachement(db, {
        afficheId: a.id,
        ligneAttendueId: l.id,
        quantite: 1,
        mode: 'MAIN',
      })
      return a
    }
    const nonVu = await mk()
    const change = await mk()
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: change.id, version: change.version - 1 + 10 }],
    })
    expect(r.statusCode).toBe(200)
    const res = ValiderSelectionResultatSchema.parse(r.json())
    expect(res.confirmees.map((x) => x.id)).toEqual([sure.afficheId])
    expect(res.ignorees).toEqual(
      expect.arrayContaining([
        { id: nonVu.id, raison: 'DOUTE_NON_VU' },
        { id: change.id, raison: 'VERSION' },
      ]),
    )
    expect((await affiche(nonVu.id)).validationAdmin).toBe(false)
    expect((await affiche(change.id)).validationAdmin).toBe(false)
  })

  it('RG-COO-012 « Confirmer les n sans doute seulement » : les doutes restent à confirmer', async () => {
    const c = await contexte()
    const sure = await recevoir(c, 2)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const doute = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'Thème A',
    })
    await f.createRattachement(db, {
      afficheId: doute.id,
      ligneAttendueId: l.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      sansDouteSeulement: true,
    })
    expect(r.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r.json())).toMatchObject({
      confirmees: [{ id: sure.afficheId }],
      ignorees: [{ id: doute.id, raison: 'DOUTE_NON_CONFIRME' }],
    })
    expect((await fiche(c)).validationAdmin).toMatchObject({ etat: 'A_CONFIRMER', doutes: 1 })
  })

  it('RG-COO-013 rejet : aucune affiche à confirmer (aucune reçue, ou toutes déjà validées) → 422', async () => {
    const c = await contexte()
    await ligne(ctx, c.plateforme.id, { contNum: c.dossier.contNum, supportId: c.support.id })
    const vide = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(vide.statusCode).toBe(422)
    expect(erreur(vide)).toMatchObject({ code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013' })
    expect(erreur(vide).message).toContain('Rien à valider')
    await recevoir(c, 2)
    expect((await valider(c.coord.headers, { dossierIds: [c.dossier.id] })).statusCode).toBe(200)
    const deja = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(deja.statusCode).toBe(422)
    expect(erreur(deja).regle).toBe('RG-COO-013')
  })

  it('RG-COO-013 rejet : « sans doute seulement » alors qu’il n’y a que des doutes → 422', async () => {
    const c = await contexte()
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'Thème A',
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      sansDouteSeulement: true,
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013' })
    expect(erreur(r).message).toContain('Aucune affiche à confirmer dans la sélection')
  })

  it('RG-COO-019 rejet : un dossier annulé n’a rien à valider (« — »)', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    await db.dossier.update({ where: { id: c.dossier.id }, data: { statut: 'ANNULE' } })
    expect((await dossierListe(c)).validationAdmin).toEqual({
      etat: 'SANS_OBJET',
      aConfirmer: 0,
      doutes: 0,
      casSur: false,
    })
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-013')
  })

  it('RG-COO-010 Idempotency-Key : un rejeu renvoie la même réponse sans double écriture ; sans clé → 400', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    const cle = idem()
    const envoi = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/coordination/validation-admin',
        headers: { ...c.coord.headers, ...cle },
        payload: { dossierIds: [c.dossier.id] },
      })
    const r1 = await envoi()
    const r2 = await envoi()
    expect(r1.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'DOSSIER',
          entiteId: String(c.dossier.contNum),
          action: 'VALIDATION_ADMIN',
        },
      }),
    ).toBe(1)
    const sansCle = await post(
      ctx,
      '/api/coordination/validation-admin',
      c.coord.headers,
      { dossierIds: [c.dossier.id] },
      false,
    )
    expect(sansCle.statusCode).toBe(400)
  })

  it('RG-COO-010 entrée invalide (sélection vide) → 400', async () => {
    const c = await contexte()
    const r = await valider(c.coord.headers, { dossierIds: [] })
    expect(r.statusCode).toBe(400)
  })
})

describe('RG-COO-009 / RG-COO-167 qui peut valider', () => {
  it.each<[Role, number, string | undefined]>([
    ['coord', 200, undefined],
    ['admin', 200, undefined],
    ['recep', 403, 'RG-COO-009'],
    ['cheq', 403, 'RG-COO-009'],
    ['expe', 403, 'RG-COO-009'],
    ['com', 403, 'RG-COO-168'],
  ])('RG-COO-009 rôle %s → %i', async (role, statut, regle) => {
    const c = await contexte()
    await recevoir(c, 2)
    const u = await autre(ctx, c.plateforme.id, [role])
    const r = await valider(u.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(statut)
    if (regle) {
      expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle })
      expect(
        await db.affiche.count({ where: { contNum: c.dossier.contNum, validationAdmin: true } }),
      ).toBe(0)
    }
  })

  it('RG-COO-167 rejet : dossier hors du périmètre du coordinateur → 403, rien n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const ailleurs = await site(ctx, ['coord'])
    const r = await valider(ailleurs.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-COO-167 dossier inconnu → 404', async () => {
    const c = await contexte()
    const r = await valider(c.coord.headers, { dossierIds: [999_999_999] })
    expect(r.statusCode).toBe(404)
  })
})

describe('RG-COO-001 / RG-COO-016 / RG-COO-020 indépendance, quantité, statut du dossier', () => {
  it('RG-COO-001 la validation n’attend ni la prépa ni l’Instruction OK (dossier « À traiter »)', async () => {
    const c = await contexte('A_TRAITER')
    await recevoir(c, 2)
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(200)
  })

  it('RG-COO-016 une réception partielle (3 reçues sur 10 attendues) est proposée et validée pour ce qu’elle contient', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 3, { qteBc: 10 })
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: rv.ligne.id } })).statut,
    ).toBe('PARTIELLE')
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'A_CONFIRMER_PROPOSE', quantite: 3 })
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(200)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-COO-020 « Validation admin faite » est calculée : le statut de préparation du dossier ne change pas', async () => {
    const c = await contexte('PREPARATION_RECUE')
    await recevoir(c, 2)
    const avant = await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })
    await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    const apres = await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })
    expect(apres.statut).toBe('PREPARATION_RECUE')
    expect(apres.version).toBe(avant.version)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'DOSSIER', entiteId: String(c.dossier.contNum) },
      }),
    ).toBe(0)
    expect((await dossierListe(c)).validationAdmin.etat).toBe('VALIDEE')
  })

  it('RG-COO-020 rejet : une nouvelle affiche à confirmer fait repasser la pastille à « À confirmer »', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    await recevoir(c, 1)
    expect((await dossierListe(c)).validationAdmin).toMatchObject({
      etat: 'A_CONFIRMER',
      aConfirmer: 1,
    })
  })
})

describe('RG-COO-019 / RG-COO-011 / RG-COO-060 liste : pastille, filtre, cas sûrs, « à faire »', () => {
  it('RG-COO-019 pastilles et filtre « Validation admin »', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    const valide = await contexte()
    // Même coordinateur pour lire les deux dossiers : périmètres distincts, on lit chacun avec le sien.
    await recevoir(valide, 2)
    await valider(valide.coord.headers, { dossierIds: [valide.dossier.id] })
    const aucune = await contexte()
    await ligne(ctx, aucune.plateforme.id, {
      contNum: aucune.dossier.contNum,
      supportId: aucune.support.id,
    })
    expect((await dossierListe(c)).validationAdmin.etat).toBe('A_CONFIRMER')
    expect((await dossierListe(valide)).validationAdmin.etat).toBe('VALIDEE')
    expect((await dossierListe(aucune)).validationAdmin.etat).toBe('AUCUNE_AFFICHE_RECUE')
    const filtre = await liste(c.coord.headers, `&dossier=${String(c.dossier.contNum)}&va=VALIDEE`)
    expect(filtre.items).toEqual([])
    const ok = await liste(c.coord.headers, `&dossier=${String(c.dossier.contNum)}&va=A_CONFIRMER`)
    expect(ok.items.map((d) => d.id)).toEqual([c.dossier.id])
  })

  it('RG-COO-060 une validation à confirmer met le dossier dans « À faire » ; validée → « Rien à faire »', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    expect((await dossierListe(c)).aFaire).toBe(true)
    await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect((await dossierListe(c)).aFaire).toBe(false)
    const rien = await liste(c.coord.headers, `&dossier=${String(c.dossier.contNum)}&aFaire=RIEN`)
    expect(rien.items.map((d) => d.id)).toEqual([c.dossier.id])
  })

  it('RG-COO-011 cas sûr : compté dans casSurs ; un doute ou un écart à traiter l’exclut', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    const l1 = await liste(c.coord.headers, `&dossier=${String(c.dossier.contNum)}`)
    expect(l1.items[0]?.validationAdmin.casSur).toBe(true)
    expect(l1.casSurs).toBe(1)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'Thème A',
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const l2 = await liste(c.coord.headers, `&dossier=${String(c.dossier.contNum)}`)
    expect(l2.items[0]?.validationAdmin).toMatchObject({ casSur: false, doutes: 1 })
    expect(l2.casSurs).toBe(0)
  })

  it('RG-COO-011 rejet : un cas sûr dont le dossier a aussi un écart Broadcast / Circé n’est pas pré-coché', async () => {
    const c = await contexte('PREPARATION_RECUE')
    await recevoir(c, 2, { qteBc: 10, qtePrepa: 8 })
    const d = await dossierListe(c)
    expect(d.ecart).not.toBe(0)
    expect(d.validationAdmin).toMatchObject({ etat: 'A_CONFIRMER', doutes: 0, casSur: false })
  })
})

describe('RG-X-053 une affiche à doute ne produit aucun effet de validation', () => {
  it('RG-X-053 affiche à doute reçue : stock compté, mais absente de l’édition picking ; présente après confirmation', async () => {
    const c = await contexte()
    // IP non saisies : la réception exige l'intitulé lu (RG-REC-047) ; l'affiche est à doute (SANS_IP).
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: null,
    })
    const bl = await bonDeLivraison(ctx, c.headers, [
      { ligneAttendueId: l.id, quantite: 4, intituleSaisi: 'Intitulé lu' },
    ])
    const rec = await post(ctx, '/api/receptions', c.headers, bl)
    expect(rec.statusCode).toBe(201)
    const afficheId = rec.json<{ affiches: { id: number }[] }>().affiches[0]?.id ?? 0
    const a = await affiche(afficheId)
    expect((await fiche(c)).affiches.find((x) => x.id === a.id)).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['SANS_IP'],
    })
    const mvts = await db.mouvement.aggregate({
      where: { afficheId: a.id },
      _sum: { quantite: true },
    })
    expect(mvts._sum.quantite).toBe(4)
    const jour = a.dateEntree.toISOString().slice(0, 10)
    const picking = async () =>
      (
        await get(
          ctx,
          `/api/edition-picking?plateformeId=${String(c.plateforme.id)}&du=${jour}&au=${jour}`,
          c.headers,
        )
      ).json<{ lignes: { afficheId: number }[] }>()
    expect((await picking()).lignes.map((x) => x.afficheId)).not.toContain(a.id)
    await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: a.id, version: a.version }],
    })
    expect((await picking()).lignes.map((x) => x.afficheId)).toContain(a.id)
  })
})
