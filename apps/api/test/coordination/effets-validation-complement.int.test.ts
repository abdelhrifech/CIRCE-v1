// COO-P04 — tests COMPLÉMENTAIRES des effets de la validation admin (effets-validation.int.test.ts n'est pas
// dupliqué). Source de l'attendu (les règles, pas le code) : docs/COORDINATION_REGLES_METIER.md RG-COO-008,
// 009, 014, 015, 017, 018, 021 à 032, 064, RG-X-050, 051, 052, 058, §2 (profils × actions) ;
// docs/RECEPTION_REGLES_METIER.md RG-X-014, RG-X-015 ; décisions : Q-186 (hypothèses (1) à (9)), Q-201
// (coord + admin valident, recep rattache sans valider, com lecture seule), Q-202 (effets de l'annulation).
// Les écarts constatés (ANO-029 à 032, docs/RAPPORT_TESTS.md) étaient marqués `it.fails` : corrigés dans le code.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AlertesSchema,
  EtiquettesRackSchema,
  FicheAfficheSchema,
  FicheDossierSchema,
  InconnueCreeeSchema,
  ValidationAfficheResultatSchema,
  type Role,
} from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import { annulerDossier } from '../../src/modules/coordination/integration.ts'
import { effetsLigneModifiee } from '../../src/modules/coordination/effets-validation.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import {
  autre,
  contexteReception,
  erreur,
  get,
  idem,
  ligne,
  photo,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>

async function contexte(preparation: 'A_TRAITER' | 'PREPARATION_RECUE' | 'ANNULE' = 'A_TRAITER') {
  const s = await site(ctx, ['recep'])
  const coord = await autre(ctx, s.plateforme.id, ['coord'])
  const dossier = await f.createDossier(db, { statut: preparation })
  return { ...s, coord, dossier }
}
type Ctx = Awaited<ReturnType<typeof contexte>>

function recevoir(c: Ctx, qte = 10, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
  return receptionValidee(ctx, c.headers, c.plateforme.id, qte, {
    contNum: c.dossier.contNum,
    supportId: c.support.id,
    ...data,
  })
}

const affiche = (id: number) => db.affiche.findUniqueOrThrow({ where: { id } })
const reception = (id: number) => db.reception.findUniqueOrThrow({ where: { id } })
const liensActifs = (afficheId: number) =>
  db.afficheAttendue.findMany({ where: { afficheId, actif: true }, orderBy: { id: 'asc' } })

const URL_COO = (id: number) => `/api/coordination/affiches/${String(id)}/validation-admin`
const URL_REC = (id: number) => `/api/affiches/${String(id)}/validation-admin`

/** POST de validation / annulation (Coordination par défaut), avec une clé d'idempotence donnée ou neuve. */
function envoyer(
  headers: Headers,
  id: number,
  version: number,
  valider: boolean,
  cle: Headers = idem(),
  url = URL_COO(id),
) {
  return ctx.app.inject({
    method: 'POST',
    url,
    headers: { ...headers, ...cle },
    payload: { version, valider },
  })
}

async function changer(headers: Headers, id: number, valider: boolean) {
  const r = await envoyer(headers, id, (await affiche(id)).version, valider)
  if (r.statusCode !== 200) throw new Error(`validation ${String(valider)} refusée : ${r.body}`)
  return r
}

async function fiche(c: Ctx, headers = c.coord.headers) {
  const r = await get(ctx, `/api/coordination/dossiers/${String(c.dossier.id)}`, headers)
  expect(r.statusCode).toBe(200)
  return FicheDossierSchema.parse(r.json())
}

async function ficheAffiche(id: number, headers: Headers) {
  const r = await get(ctx, `/api/affiches/${String(id)}`, headers)
  expect(r.statusCode).toBe(200)
  return FicheAfficheSchema.parse(r.json())
}

const journal = (afficheId: number) =>
  db.journalAudit.findMany({
    where: { typeEntite: 'AFFICHE', entiteId: String(afficheId) },
    orderBy: { id: 'asc' },
  })
const nbJournal = (afficheId: number, action: 'VALIDATION_ADMIN' | 'ANNULATION_VALIDATION_ADMIN') =>
  db.journalAudit.count({ where: { typeEntite: 'AFFICHE', entiteId: String(afficheId), action } })
const nbJournalDossier = (contNum: number, action: string) =>
  db.journalAudit.count({
    where: {
      typeEntite: 'DOSSIER',
      entiteId: String(contNum),
      action: action as 'VALIDATION_ADMIN',
    },
  })
const cleGardee = (userId: number, cle: Headers) =>
  db.cleIdempotence.count({ where: { utilisateurId: userId, cle: cle['idempotency-key'] } })
const trier = <T>(xs: T[]) => [...xs].sort()

let numDeclencheur = 0
/** Atomicité : déclencheur SQLite temporaire RAISE(ABORT) posé sur test.db, toujours supprimé (finally). */
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_eff_${String(++numDeclencheur)}_${String(f.next())}`
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

/** Réception inconnue (ECR-REC-08) de `quantite` affiches sur le site du contexte. */
async function inconnue(c: Ctx, quantite = 12, theme = 'Description') {
  const r = await post(ctx, '/api/receptions-inconnues', c.headers, {
    plateformeId: c.plateforme.id,
    supportId: c.support.id,
    annonceur: 'Lu sur affiche',
    theme,
    imprimeurId: null,
    quantite,
    allee: 'x',
    rayon: '4',
    photoAfficheId: null,
    photoBlId: await photo(ctx, c.headers),
    sansBl: false,
    numeroBl: `BL-INC-${String(f.next())}`,
  })
  if (r.statusCode !== 201) throw new Error(r.body)
  return InconnueCreeeSchema.parse(r.json())
}

function rattacherInconnue(
  headers: Headers,
  afficheId: number,
  version: number,
  lignes: { ligneAttendueId: number; quantite: number }[],
  cle: Headers = idem(),
) {
  return ctx.app.inject({
    method: 'POST',
    url: `/api/affiches/${String(afficheId)}/rattacher-inconnue`,
    headers: { ...headers, ...cle },
    payload: { version, lignes },
  })
}

function rattacherSurplus(
  headers: Headers,
  afficheId: number,
  version: number,
  ligneAttendueId: number,
  quantite: number,
  cle: Headers = idem(),
) {
  return ctx.app.inject({
    method: 'POST',
    url: `/api/affiches/${String(afficheId)}/rattachements`,
    headers: { ...headers, ...cle },
    payload: { version, ligneAttendueId, quantite },
  })
}

/** Affiche reçue de 10 dont le lien d'origine est réduit à `garde` : libère un surplus de 10 - garde. */
async function avecSurplus(c: Ctx, garde = 6) {
  const rv = await recevoir(c, 10)
  await db.afficheAttendue.updateMany({
    where: { afficheId: rv.afficheId },
    data: { quantite: garde },
  })
  const l2 = await ligne(ctx, c.plateforme.id, {
    contNum: (await f.createDossier(db)).contNum,
    supportId: c.support.id,
    theme: 'Thème A',
  })
  return { rv, l2 }
}

const alertesReception = async (headers: Headers) =>
  AlertesSchema.parse((await get(ctx, '/api/alertes/reception', headers)).json()).alertes.map(
    (a) => a.cle,
  )

// ───────────────── RG-COO-008 « Valider » (unitaire, Coordination) ─────────────────

describe('RG-COO-008 confirmation unitaire (complément)', () => {
  it('RG-COO-008 une affiche « À confirmer : doute » (validation annulée) se reconfirme : VALIDEE, motif ANNULEE effacé, par / le du nouveau validant', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    await changer(c.coord.headers, rv.afficheId, false)
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'A_CONFIRMER_DOUTE' })
    const admin = await autre(ctx, c.plateforme.id, ['admin'])
    await changer(admin.headers, rv.afficheId, true)
    const a = await affiche(rv.afficheId)
    expect(a).toMatchObject({
      validationAdmin: true,
      validationAnnulee: false,
      validationAdminParId: admin.user.id,
    })
    expect(a.validationAdminLe).toBeInstanceOf(Date)
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'VALIDEE', motifs: [] })
  })

  it('RG-COO-008 affiche répartie sur deux dossiers (MULTI) : confirmée une fois, historique dans chacun des deux dossiers', async () => {
    const c = await contexte()
    const d2 = await f.createDossier(db)
    const { rv, l2 } = await avecSurplus(c, 6)
    await db.receptionAttendue.update({ where: { id: l2.id }, data: { contNum: d2.contNum } })
    const a = await affiche(rv.afficheId)
    expect((await rattacherSurplus(c.headers, a.id, a.version, l2.id, 4)).statusCode).toBe(200)
    await changer(c.coord.headers, a.id, true)
    expect(await nbJournal(a.id, 'VALIDATION_ADMIN')).toBe(1)
    expect(await nbJournalDossier(c.dossier.contNum, 'VALIDATION_ADMIN')).toBe(1)
    expect(await nbJournalDossier(d2.contNum, 'VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-COO-008 concurrence : deux « Valider » simultanés avec la même version → une 200, l’autre 409, une seule validation', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const autreCoord = await autre(ctx, c.plateforme.id, ['coord'])
    const rs = await Promise.all([
      envoyer(c.coord.headers, a.id, a.version, true),
      envoyer(autreCoord.headers, a.id, a.version, true),
    ])
    expect(trier(rs.map((r) => r.statusCode))).toEqual([200, 409])
    expect((await affiche(a.id)).version).toBe(a.version + 1)
    expect(await nbJournal(a.id, 'VALIDATION_ADMIN')).toBe(1)
    expect(await nbJournalDossier(c.dossier.contNum, 'VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-COO-008 Idempotency-Key rejouée avec un autre corps → 409 COO_IDEMPOTENCE_CONFLIT, rien de plus n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const cle = idem()
    expect((await envoyer(c.coord.headers, a.id, a.version, true, cle)).statusCode).toBe(200)
    const v = (await affiche(a.id)).version
    const r = await envoyer(c.coord.headers, a.id, v, false, cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(await affiche(a.id)).toMatchObject({ validationAdmin: true, version: v })
    expect(await nbJournal(a.id, 'ANNULATION_VALIDATION_ADMIN')).toBe(0)
  })

  it('RG-COO-008 Idempotency-Key : une clé dont la requête a été refusée (409 version) n’est pas gardée ; le rejeu corrigé réussit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const cle = idem()
    const refus = await envoyer(c.coord.headers, a.id, a.version - 1, true, cle)
    expect(refus.statusCode).toBe(409)
    expect(await cleGardee(c.coord.user.id, cle)).toBe(0)
    const ok = await envoyer(c.coord.headers, a.id, a.version, true, cle)
    expect(ok.statusCode).toBe(200)
    expect((await affiche(a.id)).validationAdmin).toBe(true)
  })

  it.each<[string, unknown]>([
    ['version absente', { valider: true }],
    ['valider absent', { version: 1 }],
    ['valider non booléen', { version: 1, valider: 'oui' }],
    ['version non entière', { version: 1.5, valider: true }],
  ])('RG-COO-008 entrée invalide (%s) → 400, rien n’est écrit', async (_cas, payload) => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const r = await post(ctx, URL_COO(rv.afficheId), c.coord.headers, payload)
    expect(r.statusCode).toBe(400)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-COO-008 atomicité : échec à l’écriture de l’historique du dossier → affiche non validée, aucun historique, clé non gardée', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const cle = idem()
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'DOSSIER' AND NEW.entite_id = '${String(c.dossier.contNum)}'`,
      () => envoyer(c.coord.headers, a.id, a.version, true, cle),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: false,
      validationAdminParId: null,
      validationAdminLe: null,
      etiquetteRackAImprimer: false,
      version: a.version,
    })
    expect(await nbJournal(a.id, 'VALIDATION_ADMIN')).toBe(0)
    expect(await cleGardee(c.coord.user.id, cle)).toBe(0)
  })
})

// ───────────────── RG-COO-009 qui peut valider / rattacher ─────────────────

describe('RG-COO-009 droits (complément)', () => {
  it('RG-COO-009 rejet : utilisateur sans aucun rôle → 403 PERMISSION, ni validation ni annulation', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const sansRole = await autre(ctx, c.plateforme.id, [])
    const r = await envoyer(
      sansRole.headers,
      rv.afficheId,
      (await affiche(rv.afficheId)).version,
      true,
    )
    expect(r.statusCode).toBe(403)
    expect(erreur(r)).toMatchObject({ code: 'PERMISSION', regle: 'RG-COO-009' })
    await changer(c.coord.headers, rv.afficheId, true)
    const annul = await envoyer(
      sansRole.headers,
      rv.afficheId,
      (await affiche(rv.afficheId)).version,
      false,
    )
    expect(annul.statusCode).toBe(403)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-COO-009 rejet : sans utilisateur authentifié → 401, rien n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const r = await envoyer({}, rv.afficheId, (await affiche(rv.afficheId)).version, true)
    expect(r.statusCode).toBe(401)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  it.each<Role>(['expe', 'com'])(
    'RG-COO-009 / RG-X-051 « Rattacher » une réception inconnue : le rôle %s est refusé (403), rien n’est écrit',
    async (role) => {
      const c = await contexte()
      const inc = await inconnue(c)
      const l = await ligne(ctx, c.plateforme.id, {
        contNum: c.dossier.contNum,
        supportId: c.support.id,
      })
      const u = await autre(ctx, c.plateforme.id, [role])
      const a = await affiche(inc.afficheId)
      const r = await rattacherInconnue(u.headers, a.id, a.version, [
        { ligneAttendueId: l.id, quantite: 12 },
      ])
      expect(r.statusCode).toBe(403)
      expect(await affiche(a.id)).toMatchObject({ statut: 'ORPHELINE', validationAdmin: false })
      expect(await liensActifs(a.id)).toHaveLength(0)
    },
  )

  it.each<Role>(['expe', 'com'])(
    'RG-COO-009 / RG-X-052 « + Rattacher à un autre dossier » : le rôle %s est refusé (403), rien n’est écrit',
    async (role) => {
      const c = await contexte()
      const { rv, l2 } = await avecSurplus(c)
      const u = await autre(ctx, c.plateforme.id, [role])
      const a = await affiche(rv.afficheId)
      const r = await rattacherSurplus(u.headers, a.id, a.version, l2.id, 4)
      expect(r.statusCode).toBe(403)
      expect(await liensActifs(a.id)).toHaveLength(1)
    },
  )
})

// ───────────────── RG-COO-014 / RG-X-050 « Annuler la validation » ─────────────────

describe('RG-COO-014 / RG-X-050 annulation (complément)', () => {
  it('RG-COO-014 annulation par une autre personne que le validant : acceptée, historique au nom de celle qui annule', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const admin = await autre(ctx, c.plateforme.id, ['admin'])
    await changer(admin.headers, rv.afficheId, false)
    const derniere = (await journal(rv.afficheId)).at(-1)
    expect(derniere).toMatchObject({ action: 'ANNULATION_VALIDATION_ADMIN', parId: admin.user.id })
    expect(derniere?.nouvelleValeur).toBe(
      `validation annulée par ${admin.user.nom ?? admin.user.identifiantExterne}`,
    )
    expect(await nbJournalDossier(c.dossier.contNum, 'ANNULATION_VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-COO-014 sans condition de statut du dossier : dossier annulé après la validation → l’annulation reste possible', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    await withTransaction(db, (tx) => annulerDossier(tx, c.dossier.contNum))
    const r = await envoyer(
      c.coord.headers,
      rv.afficheId,
      (await affiche(rv.afficheId)).version,
      false,
    )
    expect(r.statusCode).toBe(200)
    expect(await affiche(rv.afficheId)).toMatchObject({
      validationAdmin: false,
      validationAnnulee: true,
    })
  })

  it('RG-COO-014 transition interdite : annuler une réception inconnue (orpheline, jamais validée) → 409', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const a = await affiche(inc.afficheId)
    const r = await envoyer(c.coord.headers, a.id, a.version, false)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-014')
    expect((await affiche(a.id)).version).toBe(a.version)
  })

  it('RG-COO-014 transition interdite : annuler deux fois (« À confirmer : doute » → annuler) → 409, rien n’est réécrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    await changer(c.coord.headers, rv.afficheId, false)
    const avant = await affiche(rv.afficheId)
    const r = await envoyer(c.coord.headers, avant.id, avant.version, false)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-014' })
    expect((await affiche(avant.id)).version).toBe(avant.version)
    expect(await nbJournal(avant.id, 'ANNULATION_VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-COO-014 concurrence : deux annulations simultanées avec la même version → une 200, l’autre 409, un seul historique', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const a = await affiche(rv.afficheId)
    const autreCoord = await autre(ctx, c.plateforme.id, ['coord'])
    const rs = await Promise.all([
      envoyer(c.coord.headers, a.id, a.version, false),
      envoyer(autreCoord.headers, a.id, a.version, false),
    ])
    expect(trier(rs.map((r) => r.statusCode))).toEqual([200, 409])
    expect((await affiche(a.id)).version).toBe(a.version + 1)
    expect(await nbJournal(a.id, 'ANNULATION_VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-COO-014 idempotence : même Idempotency-Key deux fois → une seule annulation, même réponse', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const a = await affiche(rv.afficheId)
    const cle = idem()
    const r1 = await envoyer(c.coord.headers, a.id, a.version, false, cle)
    const r2 = await envoyer(c.coord.headers, a.id, a.version, false, cle)
    expect(r1.statusCode).toBe(200)
    expect(r2.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(await nbJournal(a.id, 'ANNULATION_VALIDATION_ADMIN')).toBe(1)
    expect((await affiche(a.id)).version).toBe(a.version + 1)
  })

  it('RG-X-050 atomicité : échec à l’écriture de l’historique du dossier pendant l’annulation → la validation reste entière', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const avant = await affiche(rv.afficheId)
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'DOSSIER' AND NEW.entite_id = '${String(c.dossier.contNum)}' AND NEW.action = 'ANNULATION_VALIDATION_ADMIN'`,
      () => envoyer(c.coord.headers, avant.id, avant.version, false),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await affiche(avant.id)).toMatchObject({
      validationAdmin: true,
      validationAnnulee: false,
      validationAdminParId: avant.validationAdminParId,
      version: avant.version,
    })
    expect(await nbJournal(avant.id, 'ANNULATION_VALIDATION_ADMIN')).toBe(0)
  })

  it('RG-X-050 palette « Contrôlée », étiquette rack imprimée : l’annulation ne touche ni la palette, ni le stock, ni l’étiquette', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 5)
    await db.reception.update({ where: { id: rv.receptionId }, data: { statut: 'CONTROLEE' } })
    await changer(c.coord.headers, rv.afficheId, true)
    const imp = await post(ctx, '/api/impressions', c.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'ETIQUETTE_RACK',
      exemplaires: 1,
    })
    expect(imp.statusCode).toBe(200)
    const palette = await reception(rv.receptionId)
    const mvts = await db.mouvement.findMany({ where: { afficheId: rv.afficheId } })
    await changer(c.coord.headers, rv.afficheId, false)
    expect(await reception(rv.receptionId)).toMatchObject({
      statut: 'CONTROLEE',
      version: palette.version,
    })
    expect(await db.mouvement.findMany({ where: { afficheId: rv.afficheId } })).toEqual(mvts)
    expect((await affiche(rv.afficheId)).etiquetteRackAImprimer).toBe(false)
    expect((await journal(rv.afficheId)).map((j) => j.action)).toContain(
      'IMPRESSION_ETIQUETTE_RACK',
    )
  })

  it('RG-X-050 / RG-COO-018 annulation d’une affiche rattachée par la Coordination (mode MAIN) : doute avec les motifs BL et ANNULEE', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'Description',
    })
    const a = await affiche(inc.afficheId)
    expect(
      (
        await rattacherInconnue(c.coord.headers, a.id, a.version, [
          { ligneAttendueId: l.id, quantite: 12 },
        ])
      ).statusCode,
    ).toBe(200)
    await changer(c.coord.headers, a.id, false)
    const fa = (await fiche(c)).affiches[0]
    expect(fa?.etat).toBe('A_CONFIRMER_DOUTE')
    expect(fa?.motifs).toEqual(expect.arrayContaining(['BL', 'ANNULEE']))
  })
})

// ───────────────── RG-COO-015 traçabilité ─────────────────

describe('RG-COO-015 traçabilité nominative (complément)', () => {
  it('RG-COO-015 fiche dossier : « Validée par <nom> le <date> » après la confirmation ; effacés par l’annulation', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const avant = Date.now()
    await changer(c.coord.headers, rv.afficheId, true)
    const v = (await fiche(c)).affiches[0]
    expect(v?.validePar).toBe(c.coord.user.nom ?? c.coord.user.identifiantExterne)
    expect(v?.valideLe).not.toBeNull()
    expect(new Date(v?.valideLe ?? 0).getTime()).toBeGreaterThanOrEqual(avant - 1000)
    await changer(c.coord.headers, rv.afficheId, false)
    expect((await fiche(c)).affiches[0]).toMatchObject({ validePar: null, valideLe: null })
  })

  it('RG-COO-015 « Valider la sélection » par un administrateur : par = l’administrateur, historique nominatif', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const admin = await autre(ctx, c.plateforme.id, ['admin'])
    const r = await post(ctx, '/api/coordination/validation-admin', admin.headers, {
      dossierIds: [c.dossier.id],
    })
    expect(r.statusCode).toBe(200)
    const a = await affiche(rv.afficheId)
    expect(a.validationAdminParId).toBe(admin.user.id)
    expect(a.validationAdminLe).toBeInstanceOf(Date)
    expect((await journal(a.id)).at(-1)).toMatchObject({
      action: 'VALIDATION_ADMIN',
      parId: admin.user.id,
    })
  })

  it('RG-COO-015 / RG-COO-017 rattachement d’une inconnue par la Coordination : par / le posés, historique VALIDATION_ADMIN nominatif', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await affiche(inc.afficheId)
    await rattacherInconnue(c.coord.headers, a.id, a.version, [
      { ligneAttendueId: l.id, quantite: 5 },
    ])
    const apres = await affiche(a.id)
    expect(apres.validationAdminParId).toBe(c.coord.user.id)
    expect(apres.validationAdminLe).toBeInstanceOf(Date)
    const v = (await journal(a.id)).filter((j) => j.action === 'VALIDATION_ADMIN')
    expect(v).toHaveLength(1)
    expect(v[0]?.parId).toBe(c.coord.user.id)
  })
})

// ───────────────── RG-COO-017 / RG-COO-018 / RG-X-051 / RG-X-014 rattachements manuels ─────────────────

describe('RG-COO-017 / RG-COO-018 / RG-X-051 réception inconnue rattachée (complément)', () => {
  it('RG-COO-017 / RG-X-051 rattachée par un administrateur → VALIDEE (mode MAIN), étiquette rack, palette « À contrôler »', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const admin = await autre(ctx, c.plateforme.id, ['admin'])
    const a = await affiche(inc.afficheId)
    const r = await rattacherInconnue(admin.headers, a.id, a.version, [
      { ligneAttendueId: l.id, quantite: 12 },
    ])
    expect(r.statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({
      statut: 'IDENTIFIEE',
      validationAdmin: true,
      validationAdminParId: admin.user.id,
      etiquetteRackAImprimer: true,
    })
    expect(await liensActifs(a.id)).toMatchObject([{ mode: 'MAIN' }])
    expect((await reception(inc.receptionId)).statut).toBe('A_CONTROLER')
  })

  it('RG-X-051 réception « Introuvable » (signalée) rattachée par la Coordination : VALIDEE, palette « À contrôler », alerte « Dossier introuvable » levée', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const sig = await post(ctx, `/api/affiches/${String(inc.afficheId)}/signaler`, c.headers, {
      receptionVersion: (await reception(inc.receptionId)).version,
    })
    expect(sig.statusCode).toBe(200)
    expect(await alertesReception(c.coord.headers)).toContain(
      `RG-REC-186:${String(inc.receptionId)}`,
    )
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await affiche(inc.afficheId)
    const r = await rattacherInconnue(c.coord.headers, a.id, a.version, [
      { ligneAttendueId: l.id, quantite: 12 },
    ])
    expect(r.statusCode).toBe(200)
    expect((await affiche(a.id)).validationAdmin).toBe(true)
    expect((await reception(inc.receptionId)).statut).toBe('A_CONTROLER')
    expect(await alertesReception(c.coord.headers)).not.toContain(
      `RG-REC-186:${String(inc.receptionId)}`,
    )
  })

  it('RG-X-051 limite : Σ quantités = quantité reçue, répartie sur deux dossiers → accepté : deux liens MAIN, VALIDEE', async () => {
    const c = await contexte()
    const inc = await inconnue(c, 12)
    const d2 = await f.createDossier(db)
    const l1 = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const l2 = await ligne(ctx, c.plateforme.id, { contNum: d2.contNum, supportId: c.support.id })
    const a = await affiche(inc.afficheId)
    const r = await rattacherInconnue(c.coord.headers, a.id, a.version, [
      { ligneAttendueId: l1.id, quantite: 7 },
      { ligneAttendueId: l2.id, quantite: 5 },
    ])
    expect(r.statusCode).toBe(200)
    expect(await liensActifs(a.id)).toMatchObject([
      { quantite: 7, mode: 'MAIN' },
      { quantite: 5, mode: 'MAIN' },
    ])
    expect((await affiche(a.id)).validationAdmin).toBe(true)
    expect((await fiche(c)).affiches[0]?.etat).toBe('VALIDEE')
  })

  it.each<[string, { ligne: boolean; quantite: number }[]]>([
    ['aucun dossier', []],
    ['quantité 0', [{ ligne: true, quantite: 0 }]],
    ['quantité négative', [{ ligne: true, quantite: -1 }]],
  ])(
    'RG-X-051 rejet (%s) → 422 « Choisissez au moins un dossier et une quantité. », rien n’est écrit',
    async (_cas, saisie) => {
      const c = await contexte()
      const inc = await inconnue(c)
      const l = await ligne(ctx, c.plateforme.id, {
        contNum: c.dossier.contNum,
        supportId: c.support.id,
      })
      const a = await affiche(inc.afficheId)
      const r = await rattacherInconnue(
        c.coord.headers,
        a.id,
        a.version,
        saisie.map((s) => ({ ligneAttendueId: l.id, quantite: s.quantite })),
      )
      expect(r.statusCode).toBe(422)
      expect(erreur(r).message).toBe('Choisissez au moins un dossier et une quantité.')
      expect(await affiche(a.id)).toMatchObject({
        statut: 'ORPHELINE',
        validationAdmin: false,
        version: a.version,
      })
      expect((await reception(inc.receptionId)).statut).toBe('A_IDENTIFIER')
    },
  )

  it('RG-X-051 rejet : version de l’affiche périmée → 409, rien n’est écrit', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await affiche(inc.afficheId)
    const r = await rattacherInconnue(c.coord.headers, a.id, a.version - 1, [
      { ligneAttendueId: l.id, quantite: 12 },
    ])
    expect(r.statusCode).toBe(409)
    expect(await affiche(a.id)).toMatchObject({ statut: 'ORPHELINE', validationAdmin: false })
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id } })).toBe(0)
  })

  it('RG-X-051 libellé « le 1er qui a parlé » : IP non saisies (ligne sans thème) → libellé de l’affiche conservé, annonceur du dossier', async () => {
    const c = await contexte()
    const inc = await inconnue(c, 12, 'Libellé plateforme')
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: null,
      annonceur: 'ANNONCEUR DOSSIER',
    })
    const a = await affiche(inc.afficheId)
    await rattacherInconnue(c.coord.headers, a.id, a.version, [
      { ligneAttendueId: l.id, quantite: 12 },
    ])
    expect(await affiche(a.id)).toMatchObject({
      theme: 'Libellé plateforme',
      contAnnonc: 'ANNONCEUR DOSSIER',
    })
  })

  it('RG-X-051 idempotence : même Idempotency-Key deux fois → un seul jeu de liens, une seule validation', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await affiche(inc.afficheId)
    const cle = idem()
    const lignes = [{ ligneAttendueId: l.id, quantite: 12 }]
    const r1 = await rattacherInconnue(c.coord.headers, a.id, a.version, lignes, cle)
    const r2 = await rattacherInconnue(c.coord.headers, a.id, a.version, lignes, cle)
    expect(r1.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id } })).toBe(1)
    expect(await nbJournal(a.id, 'VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-X-051 concurrence : deux rattachements simultanés avec la même version → un 200, l’autre 409', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const autreCoord = await autre(ctx, c.plateforme.id, ['coord'])
    const a = await affiche(inc.afficheId)
    const lignes = [{ ligneAttendueId: l.id, quantite: 12 }]
    const rs = await Promise.all([
      rattacherInconnue(c.coord.headers, a.id, a.version, lignes),
      rattacherInconnue(autreCoord.headers, a.id, a.version, lignes),
    ])
    expect(trier(rs.map((r) => r.statusCode))).toEqual([200, 409])
    expect(await liensActifs(a.id)).toHaveLength(1)
    expect(await nbJournal(a.id, 'VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-X-051 atomicité : échec au passage de la palette « À contrôler » → ni lien, ni validation, ni étiquette ; affiche orpheline', async () => {
    const c = await contexte()
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await affiche(inc.afficheId)
    const r = await avecEchec(
      `BEFORE UPDATE ON reception WHEN NEW.id = ${String(inc.receptionId)} AND NEW.statut = 'A_CONTROLER'`,
      () =>
        rattacherInconnue(c.coord.headers, a.id, a.version, [
          { ligneAttendueId: l.id, quantite: 12 },
        ]),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await affiche(a.id)).toMatchObject({
      statut: 'ORPHELINE',
      validationAdmin: false,
      etiquetteRackAImprimer: false,
      version: a.version,
    })
    expect(await db.afficheAttendue.count({ where: { afficheId: a.id } })).toBe(0)
    expect(await nbJournal(a.id, 'VALIDATION_ADMIN')).toBe(0)
    expect((await reception(inc.receptionId)).statut).toBe('A_IDENTIFIER')
  })

  it('RG-COO-064 rattachement par la Coordination sur un dossier « À traiter » (prépa non reçue) : la validation est faite', async () => {
    const c = await contexte('A_TRAITER')
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a = await affiche(inc.afficheId)
    await rattacherInconnue(c.coord.headers, a.id, a.version, [
      { ligneAttendueId: l.id, quantite: 3 },
    ])
    expect((await affiche(a.id)).validationAdmin).toBe(true)
    expect((await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })).statut).toBe(
      'A_TRAITER',
    )
  })
})

describe('RG-X-014 / RG-COO-018 rattachement manuel depuis la fiche affiche (complément)', () => {
  async function deuxThemes(c: Ctx) {
    const rv = await recevoir(c, 4, { theme: 'Thème A' })
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'Thème B',
    })
    const lien = (await liensActifs(rv.afficheId))[0]
    if (!lien) throw new Error('lien absent')
    return { rv, l2, lien }
  }

  it('RG-X-014 « Changer de thème » par la Coordination vaut validation (par, étiquette rack)', async () => {
    const c = await contexte()
    const { rv, l2, lien } = await deuxThemes(c)
    const a = await affiche(rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, c.coord.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: l2.id,
    })
    expect(r.statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: true,
      validationAdminParId: c.coord.user.id,
      etiquetteRackAImprimer: true,
    })
    expect((await fiche(c)).affiches[0]?.etat).toBe('VALIDEE')
  })

  it('RG-X-014 rejet : « Changer de thème » par l’agent de réception sur une affiche validée → « À confirmer : doute » (motif BL)', async () => {
    const c = await contexte()
    const { rv, l2, lien } = await deuxThemes(c)
    await changer(c.coord.headers, rv.afficheId, true)
    const a = await affiche(rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, c.headers, {
      version: a.version,
      lienId: lien.id,
      nouvelleLigneId: l2.id,
    })
    expect(r.statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: false,
      validationAdminParId: null,
    })
    const fa = (await fiche(c)).affiches[0]
    expect(fa?.etat).toBe('A_CONFIRMER_DOUTE')
    expect(fa?.motifs).toContain('BL')
  })

  it('RG-COO-018 chaque lien porte un mode : BL (réception par le BL) puis MAIN (surplus à la main) ; MAIN ajoute le motif BL tant que non confirmée', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    await db.receptionAttendue.update({
      where: { id: l2.id },
      data: { contNum: c.dossier.contNum },
    })
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'A_CONFIRMER_PROPOSE' })
    const a = await affiche(rv.afficheId)
    expect((await rattacherSurplus(c.headers, a.id, a.version, l2.id, 4)).statusCode).toBe(200)
    expect((await liensActifs(a.id)).map((l) => l.mode)).toEqual(['BL', 'MAIN'])
    expect((await affiche(a.id)).modeRattachement).toBe('MAIN')
    const fa = (await fiche(c)).affiches[0]
    expect(fa?.etat).toBe('A_CONFIRMER_DOUTE')
    expect(fa?.motifs).toContain('BL')
    await changer(c.coord.headers, a.id, true)
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'VALIDEE', motifs: [] })
  })
})

// ───────────────── RG-COO-021 à 026 effets ─────────────────

describe('RG-COO-021 à 026 effets de la validation (complément)', () => {
  it('RG-COO-021 rejet : affiche validée sur une ligne Broadcast (BC) → n° masqué ; RG-COO-021 inconnue rattachée par la Coordination à une ligne PREPA → n° visible', async () => {
    const c = await contexte()
    const bc = await recevoir(c, 2, { source: 'BC' })
    await changer(c.coord.headers, bc.afficheId, true)
    expect((await fiche(c)).lignes.flatMap((l) => l.numerosSuiviProd)).toEqual([])
    const inc = await inconnue(c)
    const lp = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      source: 'PREPA',
      theme: 'Autre',
    })
    const a = await affiche(inc.afficheId)
    await rattacherInconnue(c.coord.headers, a.id, a.version, [
      { ligneAttendueId: lp.id, quantite: 12 },
    ])
    const lignes = (await fiche(c)).lignes
    expect(lignes.find((l) => l.id === lp.id)?.numerosSuiviProd).toEqual([a.id])
    expect(lignes.find((l) => l.id === bc.ligne.id)?.numerosSuiviProd).toEqual([])
  })

  it('RG-COO-022 picking : une inconnue rattachée par la Coordination figure à l’édition ; rattachée par l’agent de réception, non', async () => {
    const c = await contexte()
    const parCoord = await inconnue(c)
    const parRecep = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
    })
    const a1 = await affiche(parCoord.afficheId)
    const a2 = await affiche(parRecep.afficheId)
    await rattacherInconnue(c.coord.headers, a1.id, a1.version, [
      { ligneAttendueId: l.id, quantite: 2 },
    ])
    await rattacherInconnue(c.headers, a2.id, a2.version, [{ ligneAttendueId: l.id, quantite: 2 }])
    const du = new Date(Math.min(a1.dateEntree.getTime(), a2.dateEntree.getTime()))
    const au = new Date(Math.max(a1.dateEntree.getTime(), a2.dateEntree.getTime()))
    const r = await get(
      ctx,
      `/api/edition-picking?plateformeId=${String(c.plateforme.id)}&du=${du.toISOString().slice(0, 10)}&au=${au.toISOString().slice(0, 10)}`,
      c.headers,
    )
    const ids = r.json<{ lignes: { afficheId: number }[] }>().lignes.map((x) => x.afficheId)
    expect(ids).toContain(a1.id)
    expect(ids).not.toContain(a2.id)
  })

  it('RG-COO-023 limite : surplus rattaché par la Coordination à une affiche déjà validée dont l’étiquette est imprimée → aucune nouvelle étiquette', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    await changer(c.coord.headers, rv.afficheId, true)
    await post(ctx, '/api/impressions', c.headers, {
      afficheIds: [rv.afficheId],
      contenu: 'ETIQUETTE_RACK',
      exemplaires: 1,
    })
    expect((await affiche(rv.afficheId)).etiquetteRackAImprimer).toBe(false)
    const a = await affiche(rv.afficheId)
    expect((await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 4)).statusCode).toBe(
      200,
    )
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: true,
      etiquetteRackAImprimer: false,
    })
  })

  it('RG-COO-023 « Valider la sélection » : étiquettes groupées par plateforme (coordinateur de deux sites) ; un coordinateur d’un seul site ne voit que la sienne', async () => {
    const c = await contexte()
    const s2 = await site(ctx, ['recep'])
    const a1 = await recevoir(c, 2)
    const a2 = await receptionValidee(ctx, s2.headers, s2.plateforme.id, 3, {
      contNum: c.dossier.contNum,
      supportId: s2.support.id,
    })
    const deuxSites = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: c.plateforme.id }, { plateformeId: s2.plateforme.id }],
    )
    const h2 = devHeaders(deuxSites.identifiantExterne)
    const r = await post(ctx, '/api/coordination/validation-admin', h2, {
      dossierIds: [c.dossier.id],
    })
    expect(r.statusCode).toBe(200)
    const lire = async (h: Headers) =>
      EtiquettesRackSchema.parse((await get(ctx, '/api/coordination/etiquettes-rack', h)).json())
        .groupes
    expect(await lire(h2)).toEqual(
      [
        { plateformeId: c.plateforme.id, plateforme: c.plateforme.nom, afficheIds: [a1.afficheId] },
        {
          plateformeId: s2.plateforme.id,
          plateforme: s2.plateforme.nom,
          afficheIds: [a2.afficheId],
        },
      ].sort((x, y) => x.plateformeId - y.plateformeId),
    )
    expect(await lire(c.coord.headers)).toEqual([
      { plateformeId: c.plateforme.id, plateforme: c.plateforme.nom, afficheIds: [a1.afficheId] },
    ])
  })

  it('RG-COO-023 rejet : surplus rattaché par l’agent de réception → aucune étiquette rack demandée', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    const a = await affiche(rv.afficheId)
    expect((await rattacherSurplus(c.headers, a.id, a.version, l2.id, 4)).statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: false,
      etiquetteRackAImprimer: false,
    })
  })

  it('RG-COO-024 / RG-COO-025 retrait du dernier dossier d’une affiche validée : plus « reçue et associée », de nouveau « à traiter »', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    expect((await fiche(c)).affiches[0]?.estAssociee).toBe(true)
    expect((await ficheAffiche(rv.afficheId, c.headers)).aTraiter).toBe(false)
    const lien = (await liensActifs(rv.afficheId))[0]
    if (!lien) throw new Error('lien absent')
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
      lienVersion: lien.version,
    })
    expect(r.statusCode).toBe(200)
    expect((await fiche(c)).affiches).toEqual([])
    expect((await ficheAffiche(rv.afficheId, c.headers)).aTraiter).toBe(true)
  })

  it('RG-COO-026 affiche répartie sur deux lignes du dossier : « • » sur chacune, puis « ✓ » sur chacune après confirmation', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    await db.receptionAttendue.update({
      where: { id: l2.id },
      data: { contNum: c.dossier.contNum, theme: 'Thème B' },
    })
    const a = await affiche(rv.afficheId)
    await rattacherSurplus(c.headers, a.id, a.version, l2.id, 4)
    const marques = async () =>
      (await fiche(c)).lignes
        .filter((l) => l.id === rv.ligne.id || l.id === l2.id)
        .map((l) => l.affiches)
    expect(await marques()).toEqual([[{ id: a.id, marque: '•' }], [{ id: a.id, marque: '•' }]])
    await changer(c.coord.headers, a.id, true)
    expect(await marques()).toEqual([[{ id: a.id, marque: '✓' }], [{ id: a.id, marque: '✓' }]])
  })
})

// ───────────────── RG-COO-029 fusion ─────────────────

describe('RG-COO-029 fusion héritée (complément)', () => {
  it('RG-COO-029 une cible de fusion héritée et validée ne se décoche pas (409 RG-REC-169), sa validation est conservée', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const chapeau = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'IDENTIFIEE',
    })
    await f.createFusionAffiche(db, { afficheChapeauId: chapeau.id, afficheId: rv.afficheId })
    const a = await affiche(rv.afficheId)
    const r = await envoyer(c.coord.headers, a.id, a.version, false)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-169')
    expect(await affiche(a.id)).toMatchObject({ validationAdmin: true, version: a.version })
  })
})

// ───────────────── RG-COO-030 / 031 / 032 ligne modifiée ─────────────────

describe('RG-COO-030 / 031 / 032 ligne modifiée après la validation (complément)', () => {
  const modifier = (
    ligneId: number,
    avant: { theme: string | null; qte: number | null; etatLigne?: 'ACTIVE' | 'ANNULEE' },
    apres: { theme: string | null; qte: number | null; etatLigne?: 'ACTIVE' | 'ANNULEE' },
  ) =>
    withTransaction(db, (tx) =>
      effetsLigneModifiee(
        tx,
        { id: ligneId, theme: avant.theme, qte: avant.qte, etatLigne: avant.etatLigne ?? 'ACTIVE' },
        { theme: apres.theme, qte: apres.qte, etatLigne: apres.etatLigne ?? 'ACTIVE' },
      ),
    )

  it('RG-COO-030 rejet : affiche rattachée NON validée → thème changé sans effet (aucune alerte, aucun motif THEME persisté)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const avant = await affiche(rv.afficheId)
    const alertes = await modifier(
      rv.ligne.id,
      { theme: 'Thème A', qte: 10 },
      { theme: 'Nouveau', qte: 10 },
    )
    expect(alertes).toEqual([])
    expect(await affiche(rv.afficheId)).toMatchObject({
      themeModifie: false,
      validationAdmin: false,
      version: avant.version,
    })
  })

  it('RG-COO-030 IP saisies après la validation (ligne sans thème → thème) : validation à refaire (motif THEME), historique sans acteur personne', async () => {
    const c = await contexte()
    // Ligne sans thème (IP non saisies) : l'affiche y est rattachée et validée par la Coordination.
    const inc = await inconnue(c)
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: null,
    })
    const a = await affiche(inc.afficheId)
    await rattacherInconnue(c.coord.headers, a.id, a.version, [
      { ligneAttendueId: l.id, quantite: 2 },
    ])
    expect((await affiche(a.id)).validationAdmin).toBe(true)
    const rv = { afficheId: a.id }
    const alertes = await modifier(l.id, { theme: null, qte: 10 }, { theme: 'Thème IP', qte: 10 })
    expect(alertes).toEqual([
      { type: 'THEME_MODIFIE', afficheId: rv.afficheId, regle: 'RG-COO-030' },
    ])
    expect(await affiche(rv.afficheId)).toMatchObject({
      validationAdmin: false,
      validationAdminParId: null,
      validationAdminLe: null,
      themeModifie: true,
    })
    const dernier = (await journal(rv.afficheId)).at(-1)
    expect(dernier).toMatchObject({ action: 'ANNULATION_VALIDATION_ADMIN', parId: null })
  })

  it('RG-COO-030 / RG-COO-031 thème ET quantité changés : validation à refaire, une seule alerte THEME (pas d’écart de quantité)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const alertes = await modifier(
      rv.ligne.id,
      { theme: 'Thème A', qte: 10 },
      { theme: 'Autre', qte: 12 },
    )
    expect(alertes).toEqual([
      { type: 'THEME_MODIFIE', afficheId: rv.afficheId, regle: 'RG-COO-030' },
    ])
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-COO-030 deux affiches validées sur la ligne : chacune repasse « à confirmer », une alerte chacune', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const b = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'IDENTIFIEE',
      theme: 'Thème A',
      validationAdmin: true,
      validationAdminParId: c.coord.user.id,
      validationAdminLe: new Date(),
    })
    await f.createRattachement(db, { afficheId: b.id, ligneAttendueId: rv.ligne.id, quantite: 1 })
    await changer(c.coord.headers, rv.afficheId, true)
    const alertes = await modifier(
      rv.ligne.id,
      { theme: 'Thème A', qte: 10 },
      { theme: 'Nouveau', qte: 10 },
    )
    expect(trier(alertes.map((x) => x.afficheId))).toEqual(trier([rv.afficheId, b.id]))
    expect(alertes.every((x) => x.type === 'THEME_MODIFIE')).toBe(true)
    expect(
      await db.affiche.count({
        where: { id: { in: [rv.afficheId, b.id] }, validationAdmin: true },
      }),
    ).toBe(0)
  })

  it('RG-COO-031 rejet : quantité changée sur une ligne dont l’affiche n’est pas validée → aucune alerte', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    expect(
      await modifier(rv.ligne.id, { theme: 'Thème A', qte: 10 }, { theme: 'Thème A', qte: 15 }),
    ).toEqual([])
  })

  it('RG-COO-031 limite : ni thème ni quantité changés → aucune alerte, validation intacte', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const v = (await affiche(rv.afficheId)).version
    expect(
      await modifier(rv.ligne.id, { theme: 'Thème A', qte: 10 }, { theme: 'Thème A', qte: 10 }),
    ).toEqual([])
    expect(await affiche(rv.afficheId)).toMatchObject({ validationAdmin: true, version: v })
  })

  // ANO-029 : RG-COO-032 « Conditions : au moins un lien actif sur la ligne » (et non « lien actif validé »,
  // condition propre à RG-COO-031) ; l'énoncé : « une ligne attendue portant une affiche rattachée passe
  // ANNULEE → une alerte est levée ». effetsLigneModifiee ne considère que les affiches validées.
  it('RG-COO-032 ligne annulée portant une affiche rattachée NON validée → alerte « ligne annulée » à la Coordination (ANO-029)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const alertes = await modifier(
      rv.ligne.id,
      { theme: 'Thème A', qte: 10, etatLigne: 'ACTIVE' },
      { theme: 'Thème A', qte: 10, etatLigne: 'ANNULEE' },
    )
    expect(alertes).toEqual([
      { type: 'LIGNE_ANNULEE', afficheId: rv.afficheId, regle: 'RG-COO-032' },
    ])
  })

  it('RG-COO-032 la validation n’est pas retirée automatiquement par l’annulation de la ligne ; l’annulation manuelle reste possible ensuite', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    await withTransaction(db, (tx) => annulerDossier(tx, c.dossier.contNum))
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
    expect((await fiche(c)).aReRattacher.map((x) => x.afficheId)).toEqual([rv.afficheId])
    await changer(c.coord.headers, rv.afficheId, false)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
    expect(await liensActifs(rv.afficheId)).toHaveLength(1)
  })
})

// ───────────────── RG-X-052 surplus rattaché à un autre dossier ─────────────────

describe('RG-X-052 rattachement manuel du surplus (complément)', () => {
  it.each<[Role, boolean]>([
    ['coord', true],
    ['admin', true],
    ['recep', false],
  ])(
    'RG-X-052 surplus d’une affiche « à confirmer » rattaché par le rôle %s → vaut validation : %s ; historisé AFFICHE_ASSOCIER (qui)',
    async (role, valide) => {
      const c = await contexte()
      const { rv, l2 } = await avecSurplus(c)
      const u =
        role === 'recep'
          ? { headers: c.headers, user: c.user }
          : await autre(ctx, c.plateforme.id, [role])
      const a = await affiche(rv.afficheId)
      const r = await rattacherSurplus(u.headers, a.id, a.version, l2.id, 4)
      expect(r.statusCode).toBe(200)
      expect(await affiche(a.id)).toMatchObject({
        validationAdmin: valide,
        validationAdminParId: valide ? u.user.id : null,
        etiquetteRackAImprimer: valide,
        feuilleARefaire: true,
      })
      const associer = (await journal(a.id)).filter((j) => j.action === 'AFFICHE_ASSOCIER').at(-1)
      expect(associer?.parId).toBe(u.user.id)
      expect(associer?.le).toBeInstanceOf(Date)
    },
  )

  it('RG-X-052 (Q-186 (3)) surplus rattaché par l’agent de réception à une affiche validée → l’affiche repasse « à confirmer » (BL, MULTI), historisé', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    await changer(c.coord.headers, rv.afficheId, true)
    const a = await affiche(rv.afficheId)
    expect((await rattacherSurplus(c.headers, a.id, a.version, l2.id, 4)).statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({
      validationAdmin: false,
      validationAdminParId: null,
    })
    expect((await journal(a.id)).at(-1)).toMatchObject({
      action: 'ANNULATION_VALIDATION_ADMIN',
      parId: c.user.id,
    })
    const fa = (await fiche(c)).affiches[0]
    expect(fa?.etat).toBe('A_CONFIRMER_DOUTE')
    expect(fa?.motifs).toEqual(expect.arrayContaining(['BL', 'MULTI']))
  })

  it('RG-X-052 limite : Σ des liens = quantité reçue → accepté ; une unité de plus → 422, rien n’est écrit', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c, 6)
    await changer(c.coord.headers, rv.afficheId, true)
    const a = await affiche(rv.afficheId)
    const trop = await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 5)
    expect(trop.statusCode).toBe(422)
    expect(await liensActifs(a.id)).toHaveLength(1)
    expect((await affiche(a.id)).version).toBe(a.version)
    const juste = await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 4)
    expect(juste.statusCode).toBe(200)
    expect((await liensActifs(a.id)).reduce((s, l) => s + l.quantite, 0)).toBe(10)
  })

  it('RG-X-052 rejet : quantité 0 → 422, rien n’est écrit', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    const a = await affiche(rv.afficheId)
    const r = await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 0)
    expect(r.statusCode).toBe(422)
    expect(await liensActifs(a.id)).toHaveLength(1)
    expect((await affiche(a.id)).validationAdmin).toBe(false)
  })

  // ANO-030 : RG-X-052 « Conditions : … ; ligne cible ACTIVE ». rattacherAutreDossier → rattacher() ne
  // contrôle pas l'état de la ligne cible : le surplus est rattaché à une ligne ANNULEE (et vaut validation).
  it('RG-X-052 rejet : ligne cible annulée (non ACTIVE) → refus (409 / 422), aucun lien créé (ANO-030)', async () => {
    const c = await contexte()
    const { rv } = await avecSurplus(c)
    const fermee = await ligne(ctx, c.plateforme.id, {
      contNum: (await f.createDossier(db)).contNum,
      supportId: c.support.id,
      etatLigne: 'ANNULEE',
    })
    const a = await affiche(rv.afficheId)
    const r = await rattacherSurplus(c.coord.headers, a.id, a.version, fermee.id, 4)
    expect([409, 422]).toContain(r.statusCode)
    expect(await liensActifs(a.id)).toHaveLength(1)
    expect((await affiche(a.id)).validationAdmin).toBe(false)
  })

  // ANO-031 : RG-X-052 « Effet : 422 « La répartition (x) dépasse la quantité reçue (y). » » ; le message
  // renvoyé est « … dépasse la quantité reçue de l'affiche (y). » (stock.ts:assertRepartitionPossible).
  it('RG-X-052 message de refus : « La répartition (x) dépasse la quantité reçue (y). » (ANO-031)', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c, 6)
    const a = await affiche(rv.afficheId)
    const r = await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 5)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).message).toBe('La répartition (11) dépasse la quantité reçue (10).')
  })

  it('RG-X-052 concurrence : version de l’affiche périmée → 409, rien n’est écrit', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    const a = await affiche(rv.afficheId)
    const r = await rattacherSurplus(c.coord.headers, a.id, a.version - 1, l2.id, 4)
    expect(r.statusCode).toBe(409)
    expect(await liensActifs(a.id)).toHaveLength(1)
    expect((await affiche(a.id)).validationAdmin).toBe(false)
  })

  it('RG-X-052 idempotence : même Idempotency-Key deux fois → un seul lien créé', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    const a = await affiche(rv.afficheId)
    const cle = idem()
    const r1 = await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 2, cle)
    const r2 = await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 2, cle)
    expect(r1.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(await liensActifs(a.id)).toHaveLength(2)
  })
})

// ───────────────── RG-X-058 retrait du dernier dossier ─────────────────

describe('RG-X-058 retrait / dissociation du dernier dossier (complément)', () => {
  it('RG-X-058 limite : retrait d’un lien sur deux → l’affiche reste « Identifiée » et validée, palette inchangée', async () => {
    const c = await contexte()
    const { rv, l2 } = await avecSurplus(c)
    const a = await affiche(rv.afficheId)
    await rattacherSurplus(c.coord.headers, a.id, a.version, l2.id, 4)
    expect((await affiche(a.id)).validationAdmin).toBe(true)
    const palette = await reception(rv.receptionId)
    const lien = (await liensActifs(a.id))[1]
    if (!lien) throw new Error('lien absent')
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
      lienVersion: lien.version,
    })
    expect(r.statusCode).toBe(200)
    expect(await affiche(a.id)).toMatchObject({ statut: 'IDENTIFIEE', validationAdmin: true })
    expect((await reception(rv.receptionId)).statut).toBe(palette.statut)
    expect(await nbJournal(a.id, 'ANNULATION_VALIDATION_ADMIN')).toBe(0)
  })

  it('RG-X-058 l’alerte « Réception inconnue à identifier » est relevée après le retrait du dernier dossier', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const cle = `RG-REC-185:${String(rv.receptionId)}`
    expect(await alertesReception(c.coord.headers)).not.toContain(cle)
    const lien = (await liensActifs(rv.afficheId))[0]
    if (!lien) throw new Error('lien absent')
    await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
      lienVersion: lien.version,
    })
    expect(await alertesReception(c.coord.headers)).toContain(cle)
    expect((await fiche(c)).affiches).toEqual([])
  })

  it('RG-X-058 concurrence : version du lien périmée → 409, lien actif et validation conservés', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const lien = (await liensActifs(rv.afficheId))[0]
    if (!lien) throw new Error('lien absent')
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
      lienVersion: lien.version + 5,
    })
    expect(r.statusCode).toBe(409)
    expect(await liensActifs(rv.afficheId)).toHaveLength(1)
    expect(await affiche(rv.afficheId)).toMatchObject({
      statut: 'IDENTIFIEE',
      validationAdmin: true,
    })
  })

  it('RG-X-058 atomicité : échec au retour de la palette « À identifier » → lien actif, affiche identifiée et validée', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await changer(c.coord.headers, rv.afficheId, true)
    const avant = await affiche(rv.afficheId)
    const lien = (await liensActifs(rv.afficheId))[0]
    if (!lien) throw new Error('lien absent')
    const r = await avecEchec(
      `BEFORE UPDATE ON reception WHEN NEW.id = ${String(rv.receptionId)} AND NEW.statut = 'A_IDENTIFIER'`,
      () =>
        post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, c.coord.headers, {
          lienVersion: lien.version,
        }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await liensActifs(rv.afficheId)).toHaveLength(1)
    expect(await affiche(rv.afficheId)).toMatchObject({
      statut: 'IDENTIFIEE',
      validationAdmin: true,
      version: avant.version,
    })
    expect(await nbJournal(rv.afficheId, 'ANNULATION_VALIDATION_ADMIN')).toBe(0)
  })

  it.each<Role>(['expe', 'com'])(
    'RG-X-058 rejet : retrait par le rôle %s → 403, rien n’est écrit',
    async (role) => {
      const c = await contexte()
      const rv = await recevoir(c, 2)
      const lien = (await liensActifs(rv.afficheId))[0]
      if (!lien) throw new Error('lien absent')
      const u = await autre(ctx, c.plateforme.id, [role])
      const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, u.headers, {
        lienVersion: lien.version,
      })
      expect(r.statusCode).toBe(403)
      expect(await liensActifs(rv.afficheId)).toHaveLength(1)
    },
  )
})

// ───────────────── RG-X-015 fiche affiche ─────────────────

describe('RG-X-015 « Valider » / « Annuler la validation » depuis la fiche affiche (complément)', () => {
  it('RG-X-015 transitions interdites : valider une validée, annuler une non validée, valider une orpheline → 409', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const nonValidee = await envoyer(c.coord.headers, a.id, a.version, false, idem(), URL_REC(a.id))
    expect(nonValidee.statusCode).toBe(409)
    await envoyer(c.coord.headers, a.id, a.version, true, idem(), URL_REC(a.id))
    const b = await affiche(a.id)
    const dejaValidee = await envoyer(c.coord.headers, b.id, b.version, true, idem(), URL_REC(b.id))
    expect(dejaValidee.statusCode).toBe(409)
    const inc = await inconnue(c)
    const o = await affiche(inc.afficheId)
    const orpheline = await envoyer(c.coord.headers, o.id, o.version, true, idem(), URL_REC(o.id))
    expect(orpheline.statusCode).toBe(409)
    expect((await affiche(o.id)).validationAdmin).toBe(false)
  })

  it('RG-X-015 concurrence et idempotence : version périmée → 409 ; même clé rejouée → une seule validation', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const perimee = await envoyer(c.coord.headers, a.id, a.version - 1, true, idem(), URL_REC(a.id))
    expect(perimee.statusCode).toBe(409)
    expect((await affiche(a.id)).validationAdmin).toBe(false)
    const cle = idem()
    const r1 = await envoyer(c.coord.headers, a.id, a.version, true, cle, URL_REC(a.id))
    const r2 = await envoyer(c.coord.headers, a.id, a.version, true, cle, URL_REC(a.id))
    expect(r1.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(await nbJournal(a.id, 'VALIDATION_ADMIN')).toBe(1)
  })

  it('RG-X-015 mêmes effets que la Coordination (✓, n° au suivi, « associée », hors « à traiter ») puis inversés par l’annulation', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2, { source: 'PREPA' })
    const a = await affiche(rv.afficheId)
    const r = await envoyer(c.coord.headers, a.id, a.version, true, idem(), URL_REC(a.id))
    expect(r.statusCode).toBe(200)
    expect(ValidationAfficheResultatSchema.omit({ version: true }).parse(r.json()).message).toBe(
      '1 affiche(s) confirmée(s) par la Coordination : n° d’affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé au prochain retour.',
    )
    let fi = await fiche(c)
    expect(fi.lignes[0]).toMatchObject({
      affiches: [{ id: a.id, marque: '✓' }],
      numerosSuiviProd: [a.id],
    })
    expect(fi.affiches[0]?.estAssociee).toBe(true)
    expect((await ficheAffiche(a.id, c.headers)).aTraiter).toBe(false)
    const b = await affiche(a.id)
    await envoyer(c.coord.headers, b.id, b.version, false, idem(), URL_REC(b.id))
    fi = await fiche(c)
    expect(fi.lignes[0]).toMatchObject({
      affiches: [{ id: a.id, marque: '•' }],
      numerosSuiviProd: [],
    })
    expect(fi.affiches[0]?.estAssociee).toBe(false)
    expect((await ficheAffiche(a.id, c.headers)).aTraiter).toBe(true)
    expect(await affiche(a.id)).toMatchObject({
      validationAdminParId: null,
      validationAdminLe: null,
    })
  })

  // ANO-032 : RG-X-015 (« équivaut à la validation admin de RG-COO ») + RG-COO-020 (« l'historique du dossier
  // enregistre néanmoins la confirmation », RG-COO-160) : la confirmation depuis la fiche affiche
  // (affiches.ts:changerValidationAdmin) et le rattachement d'une inconnue par la Coordination
  // (inconnues.ts:rattacherInconnue) n'écrivent rien dans l'historique du dossier, contrairement à la
  // Coordination (effets-validation.ts:journalDossiers).
  it('RG-X-015 / RG-COO-020 la validation depuis la fiche affiche est enregistrée dans l’historique du dossier (ANO-032)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    await envoyer(c.coord.headers, a.id, a.version, true, idem(), URL_REC(a.id))
    expect(await nbJournalDossier(c.dossier.contNum, 'VALIDATION_ADMIN')).toBe(1)
  })
})
