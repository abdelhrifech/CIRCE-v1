// COO-P03 — tests COMPLÉMENTAIRES de la validation admin (validation-admin.int.test.ts n'est pas dupliqué).
// Source de l'attendu : docs/COORDINATION_REGLES_METIER.md RG-COO-001 à 020, §3.1.a / §3.1.b, RG-X-053 ;
// docs/RECEPTION_REGLES_METIER.md RG-X-001 / RG-X-002 ; décisions : Q-184 (TRANCHÉE : panier = mode BL),
// Q-185 (hypothèses (1) à (6)), Q-203 (pas de plafond ; périmées / déjà validées ignorées ET listées).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DoutesAConfirmerSchema,
  FeuillesSchema,
  FicheAfficheSchema,
  FicheDossierSchema,
  ListeDossiersSchema,
  StockAfficheSchema,
  ValiderSelectionResultatSchema,
  type Role,
} from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import { integrerPreparation } from '../../src/modules/coordination/integration.ts'
import type { ModeRattachement, StatutDossier } from '../../src/generated/prisma/client.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
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

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>

/** Un site, un agent de réception et un coordinateur du site, un dossier. */
async function contexte(preparation: StatutDossier = 'A_TRAITER') {
  const s = await site(ctx, ['recep'])
  const coord = await autre(ctx, s.plateforme.id, ['coord'])
  const dossier = await f.createDossier(db, { statut: preparation })
  return { ...s, coord, dossier }
}
type Ctx = Awaited<ReturnType<typeof contexte>>

/** Réception par le panier (mode BL, Q-184) de `qte` affiches sur une nouvelle ligne du dossier. */
function recevoir(c: Ctx, qte = 2, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
  return receptionValidee(ctx, c.headers, c.plateforme.id, qte, {
    contNum: c.dossier.contNum,
    supportId: c.support.id,
    ...data,
  })
}

interface OptionsAffiche {
  /** Ligne existante à laquelle rattacher ; sinon une ligne est créée. */
  ligneId?: number
  contNum?: number
  plateformeId?: number
  supportLigne?: number
  supportAffiche?: number
  themeLigne?: string | null
  theme?: string | null
  /** N° de dossier lu (porté par l'affiche) ; par défaut celui de la ligne. */
  contNumAffiche?: number | null
  mode?: ModeRattachement
  annulee?: boolean
  quantite?: number
}

/** Affiche rattachée (lien actif) à une ligne du dossier, avec les paramètres des motifs. */
async function afficheLiee(c: Ctx, o: OptionsAffiche = {}) {
  const contNum = o.contNum ?? c.dossier.contNum
  const l =
    o.ligneId !== undefined
      ? await db.receptionAttendue.findUniqueOrThrow({ where: { id: o.ligneId } })
      : await ligne(ctx, o.plateformeId ?? c.plateforme.id, {
          contNum,
          supportId: o.supportLigne ?? c.support.id,
          theme: o.themeLigne === undefined ? 'Thème A' : o.themeLigne,
        })
  const a = await f.createAffiche(db, {
    plateformeId: c.plateforme.id,
    supportId: o.supportAffiche ?? l.supportId,
    contNum: o.contNumAffiche === undefined ? l.contNum : o.contNumAffiche,
    statut: 'IDENTIFIEE',
    theme: o.theme === undefined ? 'Thème A' : o.theme,
    validationAnnulee: o.annulee ?? false,
  })
  await f.createRattachement(db, {
    afficheId: a.id,
    ligneAttendueId: l.id,
    quantite: o.quantite ?? 2,
    mode: o.mode ?? 'BL',
  })
  return { a, l }
}

const valider = (headers: Headers, payload: object, cle: Headers = idem()) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/coordination/validation-admin',
    headers: { ...headers, ...cle },
    payload,
  })

const validerUnitaire = (headers: Headers, id: number, version: number, oui = true) =>
  post(ctx, `/api/affiches/${String(id)}/validation-admin`, headers, { version, valider: oui })

async function liste(headers: Headers, query = '') {
  const r = await get(ctx, `/api/coordination/dossiers?pageSize=100${query}`, headers)
  expect(r.statusCode).toBe(200)
  return ListeDossiersSchema.parse(r.json())
}

async function pastille(c: Ctx, contNum = c.dossier.contNum, headers = c.coord.headers) {
  const d = (await liste(headers, `&dossier=${String(contNum)}`)).items[0]
  if (!d) throw new Error('dossier absent de la liste')
  return d.validationAdmin
}

async function fiche(c: Ctx, dossierId = c.dossier.id, headers = c.coord.headers) {
  const r = await get(ctx, `/api/coordination/dossiers/${String(dossierId)}`, headers)
  expect(r.statusCode).toBe(200)
  return FicheDossierSchema.parse(r.json())
}

async function validationAffiche(id: number, headers: Headers) {
  const r = await get(ctx, `/api/affiches/${String(id)}`, headers)
  expect(r.statusCode).toBe(200)
  return FicheAfficheSchema.parse(r.json()).validation
}

const affiche = (id: number) => db.affiche.findUniqueOrThrow({ where: { id } })
const nbValidees = (ids: number[]) =>
  db.affiche.count({ where: { id: { in: ids }, validationAdmin: true } })
const journauxValidation = (afficheId: number) =>
  db.journalAudit.count({
    where: { typeEntite: 'AFFICHE', entiteId: String(afficheId), action: 'VALIDATION_ADMIN' },
  })
const trier = <T>(xs: T[]) => [...xs].sort()

let numDeclencheur = 0
/** Atomicité : déclencheur SQLite temporaire RAISE(ABORT) posé sur test.db, toujours supprimé (finally). */
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_va_${String(++numDeclencheur)}_${String(f.next())}`
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

// ───────────────── RG-X-001 / RG-COO-002 / RG-COO-004 : proposition, jamais de validation automatique ─────────────────

describe('RG-X-001 / RG-COO-002 / RG-COO-004 proposition de rattachement (complément)', () => {
  it('RG-X-001 un panier de deux lignes du même dossier : deux propositions en mode BL, dossier cas sûr « À confirmer (2) »', async () => {
    const c = await contexte()
    const l1 = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'Thème A',
    })
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'Thème B',
      semNum: l1.semNum === 1 ? 2 : l1.semNum - 1,
    })
    const bl = await bonDeLivraison(ctx, c.headers, [
      { ligneAttendueId: l1.id, quantite: 3 },
      { ligneAttendueId: l2.id, quantite: 4 },
    ])
    const r = await post(ctx, '/api/receptions', c.headers, bl)
    expect(r.statusCode).toBe(201)
    const ids = r.json<{ affiches: { id: number }[] }>().affiches.map((a) => a.id)
    expect(ids).toHaveLength(2)
    const liens = await db.afficheAttendue.findMany({
      where: { afficheId: { in: ids }, actif: true },
    })
    expect(liens.map((x) => x.mode)).toEqual(['BL', 'BL'])
    expect(await nbValidees(ids)).toBe(0)
    expect(await pastille(c)).toEqual({
      etat: 'A_CONFIRMER',
      aConfirmer: 2,
      doutes: 0,
      casSur: true,
    })
  })

  it('RG-X-001 rejet : réception sur une ligne sans IP → « À confirmer : doute » (SANS_IP), jamais pré-cochée', async () => {
    const c = await contexte()
    const l = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: null,
    })
    const bl = await bonDeLivraison(ctx, c.headers, [
      { ligneAttendueId: l.id, quantite: 2, intituleSaisi: 'Intitulé lu' },
    ])
    expect((await post(ctx, '/api/receptions', c.headers, bl)).statusCode).toBe(201)
    const l2 = await liste(c.coord.headers, `&dossier=${String(c.dossier.contNum)}`)
    expect(l2.items[0]?.validationAdmin).toEqual({
      etat: 'A_CONFIRMER',
      aConfirmer: 1,
      doutes: 1,
      casSur: false,
    })
    expect(l2.casSurs).toBe(0)
    expect((await fiche(c)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['SANS_IP'],
    })
  })

  it('RG-COO-002 l’arrivée de la prépa (intégration Broadcast) ne pose pas la validation admin', async () => {
    const c = await contexte('A_TRAITER')
    const rv = await recevoir(c, 2)
    expect(await withTransaction(db, (tx) => integrerPreparation(tx, c.dossier.contNum))).not.toBe(
      'DOSSIER_INCONNU',
    )
    expect((await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })).statut).toBe(
      'PREPARATION_RECUE',
    )
    expect(await affiche(rv.afficheId)).toMatchObject({
      validationAdmin: false,
      validationAdminParId: null,
      validationAdminLe: null,
    })
    expect((await fiche(c)).affiches[0]?.etat).toBe('A_CONFIRMER_PROPOSE')
    expect(await journauxValidation(rv.afficheId)).toBe(0)
  })

  it('RG-COO-002 rejet : « Valider la sélection » sans utilisateur authentifié → 401, rien n’est validé', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const r = await valider({}, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(401)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  it('RG-COO-004 rejet : Circé ne rattache jamais en lecture : une affiche orpheline portant le n° du dossier n’est ni rattachée ni comptée', async () => {
    const c = await contexte()
    await ligne(ctx, c.plateforme.id, { contNum: c.dossier.contNum, supportId: c.support.id })
    const orpheline = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'ORPHELINE',
      theme: 'Thème A',
    })
    const fi = await fiche(c)
    await liste(c.coord.headers)
    expect(await validationAffiche(orpheline.id, c.headers)).toMatchObject({
      etat: 'RECEPTION_INCONNUE',
    })
    expect(await db.afficheAttendue.count({ where: { afficheId: orpheline.id } })).toBe(0)
    expect(fi.affiches).toEqual([])
    expect(fi.lignes[0]?.affichesRecues).toBe(0)
    expect(fi.validationAdmin.etat).toBe('AUCUNE_AFFICHE_RECUE')
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013' })
    expect((await affiche(orpheline.id)).validationAdmin).toBe(false)
  })

  it('RG-COO-004 rejet : un lien inactif (rattachement retiré) n’est pas une proposition : affiche non comptée', async () => {
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
    })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, actif: false })
    const fi = await fiche(c)
    expect(fi.affiches).toEqual([])
    expect(fi.lignes[0]?.affichesRecues).toBe(0)
    expect(fi.validationAdmin.etat).toBe('AUCUNE_AFFICHE_RECUE')
  })
})

// ───────────────── RG-COO-003 / 005 / 006 / RG-X-002 : motifs et cas sûr via l'API ─────────────────

describe('RG-COO-003 / RG-COO-005 / RG-COO-006 / RG-X-002 motifs et cas sûr (complément)', () => {
  it('RG-COO-003 rejet : n° lu sur le BL ≠ n° de la ligne (mode BL) → motif BL, pas de cas sûr', async () => {
    const c = await contexte()
    const { a } = await afficheLiee(c, { contNumAffiche: c.dossier.contNum + 7_000_000 })
    expect((await fiche(c)).affiches[0]).toMatchObject({
      id: a.id,
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['BL'],
    })
    expect((await pastille(c)).casSur).toBe(false)
  })

  it('RG-COO-005 cas sûr malgré deux thèmes dans le format : le thème de l’affiche désigne la ligne (accents, casse, espaces ignorés)', async () => {
    const c = await contexte()
    const { l } = await afficheLiee(c, { themeLigne: 'Thème Été', theme: '  THEME   été ' })
    await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      semAnnee: l.semAnnee,
      semNum: l.semNum,
      theme: 'Thème Hiver',
    })
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'A_CONFIRMER_PROPOSE', motifs: [] })
    expect(await pastille(c)).toMatchObject({ doutes: 0, casSur: true })
  })

  // ANO-028 (corrigée) : lien vers une ligne ANNULEE → doute LIGNE_FERMEE (RG-X-055, HYPOTHÈSE Q-185 (10)).
  it('RG-COO-005 (a) rejet : une affiche rattachée à une ligne attendue qui n’est plus ACTIVE n’est pas un cas sûr', async () => {
    const c = await contexte()
    const { a, l } = await afficheLiee(c)
    await db.receptionAttendue.update({ where: { id: l.id }, data: { etatLigne: 'ANNULEE' } })
    const fa = (await fiche(c)).affiches.find((x) => x.id === a.id)
    expect(fa?.etat).not.toBe('A_CONFIRMER_PROPOSE')
    expect(fa?.motifs).toContain('LIGNE_FERMEE')
    expect((await pastille(c)).casSur).toBe(false)
  })

  it('RG-COO-006 / RG-X-002 motifs cumulés via l’API : BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE ensemble (fiche dossier, fiche affiche, modale)', async () => {
    const c = await contexte()
    const autreSupport = await f.createSupport(db)
    // Ligne sans IP ; une seconde ligne du même dossier / format / semaine porte un autre thème.
    const { a, l } = await afficheLiee(c, {
      themeLigne: null,
      theme: 'Visuel lu',
      supportAffiche: autreSupport.id,
      mode: 'MAIN',
      annulee: true,
    })
    await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      semAnnee: l.semAnnee,
      semNum: l.semNum,
      theme: 'Autre thème',
    })
    const d2 = await f.createDossier(db)
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: d2.contNum,
      supportId: c.support.id,
      theme: 'Visuel lu',
    })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l2.id, quantite: 1 })
    const attendu = trier(['BL', 'FORMAT', 'THEME', 'MULTI', 'SANS_IP', 'ANNULEE'])
    const fa = (await fiche(c)).affiches[0]
    expect(fa?.etat).toBe('A_CONFIRMER_DOUTE')
    expect(trier(fa?.motifs ?? [])).toEqual(attendu)
    const v = await validationAffiche(a.id, c.headers)
    expect(v.etat).toBe('A_CONFIRMER_DOUTE')
    expect(trier(v.motifs)).toEqual(attendu)
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(422)
    const details = DoutesAConfirmerSchema.parse(erreur(r).details)
    expect(details.sansDoute).toBe(0)
    expect(details.doutes).toHaveLength(1)
    expect(trier(details.doutes[0]?.motifs ?? [])).toEqual(attendu)
  })

  it('RG-COO-006 THEME : les lignes ANNULEE ou exclues (themeExclu) ne comptent pas comme thèmes possibles', async () => {
    const c = await contexte()
    const { l } = await afficheLiee(c, { themeLigne: 'Thème A', theme: 'Thème A' })
    const { a: b } = await afficheLiee(c, { ligneId: l.id, theme: 'Visuel B' })
    for (const extra of [{ etatLigne: 'ANNULEE' as const }, { themeExclu: true }]) {
      await ligne(ctx, c.plateforme.id, {
        contNum: c.dossier.contNum,
        supportId: c.support.id,
        semAnnee: l.semAnnee,
        semNum: l.semNum,
        theme: 'Visuel B',
        ...extra,
      })
    }
    const fi = await fiche(c)
    expect(fi.affiches.find((x) => x.id === b.id)).toMatchObject({
      etat: 'A_CONFIRMER_PROPOSE',
      motifs: [],
    })
    expect(fi.validationAdmin).toMatchObject({ aConfirmer: 2, doutes: 0 })
  })

  it('RG-COO-006 THEME rejet : un autre thème dans une autre semaine, une autre plateforme ou un autre format ne crée pas de doute', async () => {
    const c = await contexte()
    const { l, a } = await afficheLiee(c, { themeLigne: 'Thème A', theme: 'Visuel B' })
    const ailleurs = await site(ctx, ['coord'])
    await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      semAnnee: l.semAnnee + 1,
      semNum: l.semNum,
      theme: 'Visuel B',
    })
    await ligne(ctx, ailleurs.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      semAnnee: l.semAnnee,
      semNum: l.semNum,
      theme: 'Visuel B',
    })
    await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: (await f.createSupport(db)).id,
      semAnnee: l.semAnnee,
      semNum: l.semNum,
      theme: 'Visuel B',
    })
    expect((await fiche(c)).affiches.find((x) => x.id === a.id)).toMatchObject({
      etat: 'A_CONFIRMER_PROPOSE',
      motifs: [],
    })
  })

  it('RG-X-002 / RG-COO-018 rattachement à la main par l’agent de réception : lien MAIN, doute BL (pas une validation)', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 4)
    const l2 = await ligne(ctx, c.plateforme.id, {
      contNum: c.dossier.contNum,
      supportId: c.support.id,
      theme: 'Thème A',
      semNum: rv.ligne.semNum === 1 ? 2 : rv.ligne.semNum - 1,
    })
    // Proposition partielle (3 sur 4 reçues) : il reste 1 affiche à répartir à la main.
    await db.afficheAttendue.updateMany({
      where: { afficheId: rv.afficheId },
      data: { quantite: 3 },
    })
    const a = await affiche(rv.afficheId)
    const r = await post(ctx, `/api/affiches/${String(a.id)}/rattachements`, c.headers, {
      version: a.version,
      ligneAttendueId: l2.id,
      quantite: 1,
    })
    expect(r.statusCode).toBe(200)
    const liens = await db.afficheAttendue.findMany({ where: { afficheId: a.id, actif: true } })
    expect(trier(liens.map((x) => x.mode))).toEqual(['BL', 'MAIN'])
    expect((await affiche(a.id)).validationAdmin).toBe(false)
    const v = await validationAffiche(a.id, c.headers)
    expect(v.etat).toBe('A_CONFIRMER_DOUTE')
    expect(v.motifs).toContain('BL')
  })
})

// ───────────────── RG-COO-007 : états et transitions ─────────────────

describe('RG-COO-007 états de validation : priorités et transitions (complément)', () => {
  it('RG-COO-007 VALIDEE prime sur les motifs : une affiche à doute confirmée n’affiche plus de motif', async () => {
    const c = await contexte()
    const { a } = await afficheLiee(c, { mode: 'VISUEL', themeLigne: null, theme: 'Lu' })
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: a.id, version: a.version }],
    })
    expect(r.statusCode).toBe(200)
    expect((await fiche(c)).affiches[0]).toMatchObject({ etat: 'VALIDEE', motifs: [] })
    expect(await validationAffiche(a.id, c.headers)).toMatchObject({
      validee: true,
      etat: 'VALIDEE',
      motifs: [],
    })
  })

  it('RG-COO-007 transition interdite : valider une affiche déjà validée → 409 ; annuler une affiche non validée → 409', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const nonValidee = await validerUnitaire(c.coord.headers, a.id, a.version, false)
    expect(nonValidee.statusCode).toBe(409)
    expect((await validerUnitaire(c.coord.headers, a.id, a.version)).statusCode).toBe(200)
    const v = await affiche(a.id)
    const deja = await validerUnitaire(c.coord.headers, a.id, v.version)
    expect(deja.statusCode).toBe(409)
    expect((await affiche(a.id)).version).toBe(v.version)
    expect(await journauxValidation(a.id)).toBe(1)
  })

  it('RG-COO-007 transition interdite : une réception inconnue (orpheline) ne se valide pas → 409', async () => {
    const c = await contexte()
    const a = await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      statut: 'ORPHELINE',
      contNum: null,
    })
    const r = await validerUnitaire(c.coord.headers, a.id, a.version)
    expect(r.statusCode).toBe(409)
    expect((await affiche(a.id)).validationAdmin).toBe(false)
  })

  it('RG-COO-007 concurrence : deux confirmations unitaires avec la même version → une 200, l’autre 409', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    const autreCoord = await autre(ctx, c.plateforme.id, ['coord'])
    const rs = await Promise.all([
      validerUnitaire(c.coord.headers, a.id, a.version),
      validerUnitaire(autreCoord.headers, a.id, a.version),
    ])
    expect(trier(rs.map((r) => r.statusCode))).toEqual([200, 409])
    expect((await affiche(a.id)).version).toBe(a.version + 1)
    expect(await journauxValidation(a.id)).toBe(1)
  })

  it('RG-COO-007 annulation avec une version périmée → 409, la validation reste en place', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const a = await affiche(rv.afficheId)
    expect((await validerUnitaire(c.coord.headers, a.id, a.version)).statusCode).toBe(200)
    const r = await validerUnitaire(c.coord.headers, a.id, a.version, false)
    expect(r.statusCode).toBe(409)
    expect(await affiche(a.id)).toMatchObject({ validationAdmin: true, validationAnnulee: false })
  })
})

// ───────────────── RG-COO-009 / RG-COO-167 : droits et périmètre ─────────────────

// Refus de la route unitaire (fiche affiche) : RG-COO-009 annonce { PERMISSION, RG-COO-009 } ; RG-REC-003
// (RECEPTION_REGLES_METIER.md, même action vue de la fiche affiche) annonce REC_VALIDATION_RESERVEE. Les deux
// sources divergent sur le code : les deux formes sont acceptées ici (divergence signalée, non tranchée).
const REFUS_UNITAIRE = [
  { code: 'PERMISSION', regle: 'RG-COO-009' },
  { code: 'REC_VALIDATION_RESERVEE', regle: 'RG-REC-003' },
]
const pick = (e: { code: string; regle?: string | undefined }) => ({ code: e.code, regle: e.regle })

describe('RG-COO-009 / RG-COO-167 droits et périmètre (complément)', () => {
  it.each<[Role, number]>([
    ['coord', 200],
    ['admin', 200],
    ['recep', 403],
    ['cheq', 403],
    ['expe', 403],
    ['com', 403],
  ])(
    'RG-COO-009 « Valider » unitaire (fiche affiche / fiche dossier) : rôle %s → %i',
    async (role, statut) => {
      const c = await contexte()
      const rv = await recevoir(c, 2)
      const u = await autre(ctx, c.plateforme.id, [role])
      const a = await affiche(rv.afficheId)
      const r = await validerUnitaire(u.headers, a.id, a.version)
      expect(r.statusCode).toBe(statut)
      if (statut === 403) {
        expect(REFUS_UNITAIRE).toContainEqual(pick(erreur(r)))
        expect((await affiche(a.id)).validationAdmin).toBe(false)
      } else expect((await affiche(a.id)).validationAdminParId).toBe(u.user.id)
    },
  )

  it.each<Role>(['recep', 'cheq', 'expe', 'com'])(
    'RG-COO-009 « Annuler la validation » : le rôle %s est refusé (403), la validation reste',
    async (role) => {
      const c = await contexte()
      const rv = await recevoir(c, 2)
      const a = await affiche(rv.afficheId)
      await validerUnitaire(c.coord.headers, a.id, a.version)
      const v = await affiche(a.id)
      const u = await autre(ctx, c.plateforme.id, [role])
      const r = await validerUnitaire(u.headers, a.id, v.version, false)
      expect(r.statusCode).toBe(403)
      expect(REFUS_UNITAIRE).toContainEqual(pick(erreur(r)))
      expect(await affiche(a.id)).toMatchObject({ validationAdmin: true, version: v.version })
    },
  )

  it('RG-COO-167 rejet : un lot mêlant un dossier du périmètre et un dossier hors périmètre → 403, rien n’est écrit', async () => {
    const c = await contexte()
    const ici = await recevoir(c, 2)
    const loin = await contexte()
    const labas = await recevoir(loin, 2)
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id, loin.dossier.id] })
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-167')
    expect(await nbValidees([ici.afficheId, labas.afficheId])).toBe(0)
  })

  it('RG-COO-167 utilisateur de deux sites : les affiches des deux sites sont comptées et confirmées ; un coordinateur d’un seul site ne confirme que les siennes', async () => {
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
    // Coordinateur du seul site 1 : ne voit et ne confirme que l'affiche de son site.
    expect(await pastille(c)).toMatchObject({ aConfirmer: 1 })
    expect(await pastille(c, c.dossier.contNum, h2)).toMatchObject({ aConfirmer: 2 })
    const r1 = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r1.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r1.json()).confirmees.map((x) => x.id)).toEqual([
      a1.afficheId,
    ])
    expect((await affiche(a2.afficheId)).validationAdmin).toBe(false)
    expect(await pastille(c, c.dossier.contNum, h2)).toMatchObject({
      etat: 'A_CONFIRMER',
      aConfirmer: 1,
    })
    const r2 = await valider(h2, { dossierIds: [c.dossier.id] })
    expect(r2.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r2.json()).confirmees.map((x) => x.id)).toEqual([
      a2.afficheId,
    ])
    expect(await pastille(c, c.dossier.contNum, h2)).toMatchObject({ etat: 'VALIDEE' })
  })

  it('RG-COO-167 / RG-COO-006 affiche MULTI liée à un dossier hors périmètre : MULTI affiché, listée seulement dans le dossier du périmètre', async () => {
    const c = await contexte()
    const loin = await contexte()
    const { a } = await afficheLiee(c)
    const lLoin = await ligne(ctx, loin.plateforme.id, {
      contNum: loin.dossier.contNum,
      supportId: c.support.id,
      theme: 'Thème A',
    })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: lLoin.id, quantite: 1 })
    const fi = await fiche(c)
    expect(fi.affiches).toMatchObject([{ id: a.id, etat: 'A_CONFIRMER_DOUTE', motifs: ['MULTI'] }])
    expect(
      (await liste(c.coord.headers, `&dossier=${String(loin.dossier.contNum)}`)).items,
    ).toEqual([])
    const refus = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(refus.statusCode).toBe(422)
    const details = DoutesAConfirmerSchema.parse(erreur(refus).details)
    expect(details.doutes.map((d) => [d.id, d.dossier])).toEqual([[a.id, c.dossier.contNum]])
    const ok = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: a.id, version: a.version }],
    })
    expect(ok.statusCode).toBe(200)
    expect((await affiche(a.id)).validationAdmin).toBe(true)
  })
})

// ───────────────── RG-COO-010 : « Valider la sélection » ─────────────────

describe('RG-COO-010 « Valider la sélection » : lot, atomicité, idempotence, concurrence (complément)', () => {
  it('RG-COO-010 plusieurs dossiers cochés : toutes leurs affiches à confirmer, un journal par dossier', async () => {
    const c = await contexte()
    const d2 = await f.createDossier(db)
    const a1 = await recevoir(c, 2)
    const a2 = await recevoir(c, 1)
    const a3 = await receptionValidee(ctx, c.headers, c.plateforme.id, 5, {
      contNum: d2.contNum,
      supportId: c.support.id,
    })
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id, d2.id] })
    expect(r.statusCode).toBe(200)
    const res = ValiderSelectionResultatSchema.parse(r.json())
    expect(trier(res.confirmees.map((x) => x.id))).toEqual(
      trier([a1.afficheId, a2.afficheId, a3.afficheId]),
    )
    expect(res.message).toContain('3 affiche(s) confirmée(s)')
    for (const contNum of [c.dossier.contNum, d2.contNum]) {
      expect(
        await db.journalAudit.count({
          where: { typeEntite: 'DOSSIER', entiteId: String(contNum), action: 'VALIDATION_ADMIN' },
        }),
      ).toBe(1)
    }
  })

  it('RG-COO-010 limite : un dossier coché deux fois → chaque affiche n’est confirmée qu’une fois', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id, c.dossier.id] })
    expect(r.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r.json()).confirmees).toHaveLength(1)
    expect(await journauxValidation(rv.afficheId)).toBe(1)
  })

  // ANO-026 (corrigée) : aucun plafond de taille de lot (RG-COO-010 / Q-203).
  it('RG-COO-010 limite (Q-203 : pas de plafond) : une sélection de 201 dossiers n’est pas refusée pour sa taille', async () => {
    const c = await contexte()
    await recevoir(c, 1)
    const ids = [c.dossier.id]
    for (let k = 0; k < 200; k++) {
      const d = await f.createDossier(db)
      await ligne(ctx, c.plateforme.id, { contNum: d.contNum, supportId: c.support.id })
      ids.push(d.id)
    }
    const r = await valider(c.coord.headers, { dossierIds: ids })
    expect(r.statusCode).toBe(200)
  })

  it('RG-COO-010 atomicité : échec à l’écriture du journal du dossier → aucune affiche validée, aucune clé gardée ; le rejeu de la clé réussit', async () => {
    const c = await contexte()
    const d2 = await f.createDossier(db)
    const a1 = await recevoir(c, 2)
    const a2 = await receptionValidee(ctx, c.headers, c.plateforme.id, 2, {
      contNum: d2.contNum,
      supportId: c.support.id,
    })
    const cle = idem()
    const payload = { dossierIds: [c.dossier.id, d2.id] }
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.type_entite = 'DOSSIER' AND NEW.entite_id = '${String(d2.contNum)}'`,
      () => valider(c.coord.headers, payload, cle),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await nbValidees([a1.afficheId, a2.afficheId])).toBe(0)
    expect(await journauxValidation(a1.afficheId)).toBe(0)
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'DOSSIER',
          entiteId: String(c.dossier.contNum),
          action: 'VALIDATION_ADMIN',
        },
      }),
    ).toBe(0)
    expect(
      await db.cleIdempotence.count({
        where: { utilisateurId: c.coord.user.id, cle: cle['idempotency-key'] },
      }),
    ).toBe(0)
    const rejeu = await valider(c.coord.headers, payload, cle)
    expect(rejeu.statusCode).toBe(200)
    expect(await nbValidees([a1.afficheId, a2.afficheId])).toBe(2)
  })

  it('RG-COO-010 atomicité : échec à la mise à jour de la 2e affiche → la 1re n’est pas validée non plus', async () => {
    const c = await contexte()
    const a1 = await recevoir(c, 2)
    const a2 = await recevoir(c, 3)
    const r = await avecEchec(
      `BEFORE UPDATE ON affiche WHEN NEW.affiche_id = ${String(a2.afficheId)} AND NEW.validation_admin = 1`,
      () => valider(c.coord.headers, { dossierIds: [c.dossier.id] }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await nbValidees([a1.afficheId, a2.afficheId])).toBe(0)
    expect(await journauxValidation(a1.afficheId)).toBe(0)
    const a = await affiche(a1.afficheId)
    expect(a).toMatchObject({ validationAdminParId: null, validationAdminLe: null })
  })

  it('RG-COO-010 Idempotency-Key rejouée avec un autre corps → 409, rien de plus n’est écrit', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const d2 = await f.createDossier(db)
    const autreAff = await receptionValidee(ctx, c.headers, c.plateforme.id, 2, {
      contNum: d2.contNum,
      supportId: c.support.id,
    })
    const cle = idem()
    expect((await valider(c.coord.headers, { dossierIds: [c.dossier.id] }, cle)).statusCode).toBe(
      200,
    )
    const r = await valider(c.coord.headers, { dossierIds: [d2.id] }, cle)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect((await affiche(autreAff.afficheId)).validationAdmin).toBe(false)
    expect(await journauxValidation(rv.afficheId)).toBe(1)
  })

  it('RG-COO-010 Idempotency-Key : une clé dont la requête a été refusée (422) n’est pas gardée, rejeu possible après correction', async () => {
    const c = await contexte()
    const { a } = await afficheLiee(c, { mode: 'MAIN' })
    const cle = idem()
    const refus = await valider(c.coord.headers, { dossierIds: [c.dossier.id] }, cle)
    expect(refus.statusCode).toBe(422)
    // Même clé, corps corrigé (confirmation explicite) : pas un conflit d'idempotence.
    const ok = await valider(
      c.coord.headers,
      {
        dossierIds: [c.dossier.id],
        confirmerDoutes: true,
        doutes: [{ id: a.id, version: a.version }],
      },
      cle,
    )
    expect(ok.statusCode).toBe(200)
    expect((await affiche(a.id)).validationAdmin).toBe(true)
  })

  it('RG-COO-010 concurrence : deux « Valider la sélection » simultanées sur le même dossier → une seule confirmation', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    const avant = await affiche(rv.afficheId)
    const autreCoord = await autre(ctx, c.plateforme.id, ['coord'])
    const rs = await Promise.all([
      valider(c.coord.headers, { dossierIds: [c.dossier.id] }),
      valider(autreCoord.headers, { dossierIds: [c.dossier.id] }),
    ])
    const statuts = trier(rs.map((r) => r.statusCode))
    expect(statuts[0]).toBe(200)
    expect([409, 422]).toContain(statuts[1])
    const a = await affiche(rv.afficheId)
    expect(a.validationAdmin).toBe(true)
    expect(a.version).toBe(avant.version + 1)
    expect(await journauxValidation(rv.afficheId)).toBe(1)
  })

  it('RG-COO-010 / RG-COO-012 une affiche sûre devenue doute entre l’affichage et l’envoi n’est pas confirmée sans confirmation explicite', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    expect((await pastille(c)).casSur).toBe(true)
    // La ligne perd ses IP (thème provisoire) : l'affiche devient « à doute » (SANS_IP).
    await db.receptionAttendue.update({ where: { id: rv.ligne.id }, data: { theme: null } })
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(422)
    expect(erreur(r).regle).toBe('RG-COO-012')
    // Q-185 (6) / audit M7 : rien d'écrit (doute non vu) → 422 RG-COO-013, l'ignorée est listée.
    const r2 = await valider(c.coord.headers, { dossierIds: [c.dossier.id], confirmerDoutes: true })
    expect(r2.statusCode).toBe(422)
    expect(erreur(r2)).toMatchObject({ code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013' })
    expect(erreur(r2).details).toEqual({
      ignorees: [{ id: rv.afficheId, raison: 'DOUTE_NON_VU' }],
    })
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(false)
  })

  // ANO-027 (corrigée) : un doute qui n'est plus à confirmer est ignoré ET listé (PLUS_A_CONFIRMER).
  it('RG-COO-010 (Q-203) un doute vu dans la modale mais validé entre-temps par un autre coordinateur est ignoré ET listé', async () => {
    const c = await contexte()
    const sure = await recevoir(c, 2)
    const { a: doute } = await afficheLiee(c, { mode: 'MAIN' })
    const autreCoord = await autre(ctx, c.plateforme.id, ['coord'])
    expect((await validerUnitaire(autreCoord.headers, doute.id, doute.version)).statusCode).toBe(
      200,
    )
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: doute.id, version: doute.version }],
    })
    expect(r.statusCode).toBe(200)
    const res = ValiderSelectionResultatSchema.parse(r.json())
    expect(res.confirmees.map((x) => x.id)).toEqual([sure.afficheId])
    expect(res.ignorees).toContainEqual({ id: doute.id, raison: 'PLUS_A_CONFIRMER' })
  })
})

// ───────────────── RG-COO-011 : cas sûrs ─────────────────

describe('RG-COO-011 cas sûrs et « Cocher les cas sûrs (n) » (complément)', () => {
  it('RG-COO-011 casSurs = nombre de dossiers cas sûrs sous le filtre courant', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    const d2 = await f.createDossier(db)
    await receptionValidee(ctx, c.headers, c.plateforme.id, 2, {
      contNum: d2.contNum,
      supportId: c.support.id,
    })
    const d3 = await f.createDossier(db)
    await afficheLiee(c, { contNum: d3.contNum, mode: 'MAIN' })
    const d4 = await f.createDossier(db)
    await receptionValidee(ctx, c.headers, c.plateforme.id, 2, {
      contNum: d4.contNum,
      supportId: c.support.id,
    })
    expect((await valider(c.coord.headers, { dossierIds: [d4.id] })).statusCode).toBe(200)
    const tout = await liste(c.coord.headers)
    expect(tout.items).toHaveLength(4)
    expect(tout.casSurs).toBe(2)
    const casSurs = tout.items.filter((d) => d.validationAdmin.casSur).map((d) => d.id)
    expect(trier(casSurs)).toEqual(trier([c.dossier.id, d2.id]))
    expect((await liste(c.coord.headers, '&va=VALIDEE')).casSurs).toBe(0)
    expect((await liste(c.coord.headers, `&dossier=${String(d2.contNum)}`)).casSurs).toBe(1)
  })

  it('RG-COO-011 rejet : prépa reçue avec une Instruction OK à faire (instruction en cours) → pas cas sûr', async () => {
    const c = await contexte('PREPARATION_RECUE')
    const atelier = await f.createAtelier(db, { plateformeId: c.plateforme.id })
    await f.createInstruction(db, {
      atelierId: atelier.id,
      dossierId: c.dossier.id,
      contNum: c.dossier.contNum,
      statut: 'EN_COURS',
    })
    await recevoir(c, 2)
    expect(await pastille(c)).toMatchObject({ etat: 'A_CONFIRMER', doutes: 0, casSur: false })
  })

  it('RG-COO-011 la prépa n’est pas une condition : dossier « À traiter » (instruction en attente) avec un cas sûr → pré-coché', async () => {
    const c = await contexte('A_TRAITER')
    const atelier = await f.createAtelier(db, { plateformeId: c.plateforme.id })
    await f.createInstruction(db, {
      atelierId: atelier.id,
      dossierId: c.dossier.id,
      contNum: c.dossier.contNum,
      statut: 'A_TRAITER',
    })
    await recevoir(c, 2)
    expect(await pastille(c)).toMatchObject({ etat: 'A_CONFIRMER', casSur: true })
  })

  it('RG-COO-011 rejet : un dossier annulé ou déjà validé n’est jamais cas sûr', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(await pastille(c)).toMatchObject({ etat: 'VALIDEE', casSur: false })
    const an = await contexte()
    await recevoir(an, 2)
    await db.dossier.update({ where: { id: an.dossier.id }, data: { statut: 'ANNULE' } })
    expect(await pastille(an)).toMatchObject({ etat: 'SANS_OBJET', casSur: false })
  })
})

// ───────────────── RG-COO-012 / RG-COO-013 ─────────────────

describe('RG-COO-012 / RG-COO-013 confirmation explicite et refus (complément)', () => {
  it('RG-COO-012 rejet : confirmerDoutes absent même si les doutes sont listés → 422, rien n’est écrit', async () => {
    const c = await contexte()
    const sure = await recevoir(c, 2)
    const { a } = await afficheLiee(c, { mode: 'VISUEL' })
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      doutes: [{ id: a.id, version: a.version }],
    })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_DOUTES_A_CONFIRMER', regle: 'RG-COO-012' })
    expect(await nbValidees([sure.afficheId, a.id])).toBe(0)
  })

  it('RG-COO-012 « Confirmer tout » avec seulement des doutes, tous vus → confirmés (nominal sans cas sûr)', async () => {
    const c = await contexte()
    const { a } = await afficheLiee(c, { mode: 'MAIN' })
    const { a: b } = await afficheLiee(c, { themeLigne: null, theme: 'Lu' })
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [
        { id: a.id, version: a.version },
        { id: b.id, version: b.version },
      ],
    })
    expect(r.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r.json()).ignorees).toEqual([])
    expect(await nbValidees([a.id, b.id])).toBe(2)
    expect((await fiche(c)).validationAdmin.etat).toBe('VALIDEE')
  })

  it('RG-COO-012 rejet : un doute d’un dossier non coché, glissé dans `doutes`, n’est pas confirmé', async () => {
    const c = await contexte()
    const sure = await recevoir(c, 2)
    const d2 = await f.createDossier(db)
    const { a: horsSelection } = await afficheLiee(c, { contNum: d2.contNum, mode: 'MAIN' })
    const r = await valider(c.coord.headers, {
      dossierIds: [c.dossier.id],
      confirmerDoutes: true,
      doutes: [{ id: horsSelection.id, version: horsSelection.version }],
    })
    expect(r.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r.json()).confirmees.map((x) => x.id)).toEqual([
      sure.afficheId,
    ])
    expect((await affiche(horsSelection.id)).validationAdmin).toBe(false)
  })

  it('RG-COO-013 nominal : un dossier sans affiche et un dossier avec une affiche à confirmer → accepté', async () => {
    const c = await contexte()
    const vide = await f.createDossier(db)
    await ligne(ctx, c.plateforme.id, { contNum: vide.contNum, supportId: c.support.id })
    const rv = await recevoir(c, 2)
    const r = await valider(c.coord.headers, { dossierIds: [vide.id, c.dossier.id] })
    expect(r.statusCode).toBe(200)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-COO-013 rejet : plusieurs dossiers sans aucune affiche à confirmer (un validé, un sans affiche, un annulé) → 422', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    const vide = await f.createDossier(db)
    await ligne(ctx, c.plateforme.id, { contNum: vide.contNum, supportId: c.support.id })
    const annule = await f.createDossier(db, { statut: 'ANNULE' })
    const ra = await receptionValidee(ctx, c.headers, c.plateforme.id, 2, {
      contNum: annule.contNum,
      supportId: c.support.id,
    })
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id, vide.id, annule.id] })
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({ code: 'COO_RIEN_A_VALIDER', regle: 'RG-COO-013' })
    expect((await affiche(ra.afficheId)).validationAdmin).toBe(false)
  })
})

// ───────────────── RG-COO-016 : la quantité n'est pas une condition ─────────────────

describe('RG-COO-016 la quantité n’est pas une condition (complément)', () => {
  it('RG-COO-016 exemple 3/3/3 (A reçue 3, B 2, C 0) : A et B validées, rien pour C ; le complément de B est proposé puis confirmé', async () => {
    const c = await contexte()
    const base = { contNum: c.dossier.contNum, supportId: c.support.id, qteBc: 3 }
    const semaine = (await ligne(ctx, c.plateforme.id, { ...base, theme: 'C' })).semNum
    const lA = await ligne(ctx, c.plateforme.id, { ...base, theme: 'A', semNum: semaine })
    const lB = await ligne(ctx, c.plateforme.id, { ...base, theme: 'B', semNum: semaine })
    const bl = await bonDeLivraison(ctx, c.headers, [
      { ligneAttendueId: lA.id, quantite: 3 },
      { ligneAttendueId: lB.id, quantite: 2 },
    ])
    const rec = await post(ctx, '/api/receptions', c.headers, bl)
    expect(rec.statusCode).toBe(201)
    // Thèmes A, B, C dans le même format : chaque affiche porte le thème de sa ligne → pas de doute THEME.
    const fi = await fiche(c)
    expect(fi.validationAdmin).toMatchObject({ aConfirmer: 2, doutes: 0 })
    expect(fi.lignes.find((l) => l.theme === 'C')?.affichesRecues).toBe(0)
    const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect(r.statusCode).toBe(200)
    expect(ValiderSelectionResultatSchema.parse(r.json()).confirmees).toHaveLength(2)
    expect((await fiche(c)).validationAdmin.etat).toBe('VALIDEE')
    const comp = await bonDeLivraison(ctx, c.headers, [{ ligneAttendueId: lB.id, quantite: 1 }])
    expect((await post(ctx, '/api/receptions', c.headers, comp)).statusCode).toBe(201)
    expect(await pastille(c)).toMatchObject({ etat: 'A_CONFIRMER', aConfirmer: 1, doutes: 0 })
    expect((await valider(c.coord.headers, { dossierIds: [c.dossier.id] })).statusCode).toBe(200)
    expect((await pastille(c)).etat).toBe('VALIDEE')
  })

  it('RG-COO-016 limite : reçu supérieur à l’attendu (surplus) → validation acceptée sans condition de quantité', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 30, { qteBc: 10 })
    expect((await fiche(c)).affiches[0]).toMatchObject({
      etat: 'A_CONFIRMER_PROPOSE',
      quantite: 30,
    })
    expect((await valider(c.coord.headers, { dossierIds: [c.dossier.id] })).statusCode).toBe(200)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-COO-016 limite : une seule affiche reçue sur une ligne de 100 → validée', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 1, { qteBc: 100 })
    expect((await valider(c.coord.headers, { dossierIds: [c.dossier.id] })).statusCode).toBe(200)
    expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
  })
})

// ───────────────── RG-COO-019 / RG-COO-020 : pastille du dossier ─────────────────

describe('RG-COO-019 / RG-COO-020 pastille du dossier (complément)', () => {
  it('RG-COO-019 « À confirmer (n, dont k doutes) » : comptes exacts (proposées, doutes, validées)', async () => {
    const c = await contexte()
    await recevoir(c, 2)
    await recevoir(c, 1)
    await afficheLiee(c, { mode: 'MAIN' })
    const { a: v } = await afficheLiee(c, { mode: 'VISUEL' })
    expect((await validerUnitaire(c.coord.headers, v.id, v.version)).statusCode).toBe(200)
    expect(await pastille(c)).toEqual({
      etat: 'A_CONFIRMER',
      aConfirmer: 3,
      doutes: 1,
      casSur: false,
    })
    expect(trier((await fiche(c)).affiches.map((x) => x.etat))).toEqual(
      trier(['A_CONFIRMER_PROPOSE', 'A_CONFIRMER_PROPOSE', 'A_CONFIRMER_DOUTE', 'VALIDEE']),
    )
  })

  it('RG-COO-019 filtre « Aucune affiche reçue » ; un dossier annulé (« — ») n’est ni à confirmer ni validé', async () => {
    const c = await contexte()
    await ligne(ctx, c.plateforme.id, { contNum: c.dossier.contNum, supportId: c.support.id })
    const annule = await f.createDossier(db, { statut: 'ANNULE' })
    await receptionValidee(ctx, c.headers, c.plateforme.id, 2, {
      contNum: annule.contNum,
      supportId: c.support.id,
    })
    const aucune = await liste(c.coord.headers, '&va=AUCUNE_AFFICHE_RECUE')
    expect(aucune.items.map((d) => d.id)).toEqual([c.dossier.id])
    // Maquette ECR-COO-01 : le filtre n'offre que À confirmer / Validée / Aucune affiche reçue ;
    // le dossier annulé (pastille « — ») n'entre dans aucune de ces valeurs.
    for (const va of ['A_CONFIRMER', 'VALIDEE']) {
      const l = await liste(c.coord.headers, `&va=${va}`)
      expect(l.items.map((d) => d.id)).not.toContain(annule.id)
    }
    expect(await pastille(c, annule.contNum)).toMatchObject({ etat: 'SANS_OBJET' })
    expect(
      (await liste(c.coord.headers, `&dossier=${String(annule.contNum)}`)).items[0]?.aFaire,
    ).toBe(false)
  })

  it('RG-COO-019 rejet : un dossier dont toutes les affiches sont des réceptions inconnues n’est jamais « Validée »', async () => {
    const c = await contexte()
    await ligne(ctx, c.plateforme.id, { contNum: c.dossier.contNum, supportId: c.support.id })
    await f.createAffiche(db, {
      plateformeId: c.plateforme.id,
      supportId: c.support.id,
      contNum: c.dossier.contNum,
      statut: 'ORPHELINE',
      validationAdmin: true,
    })
    expect(await pastille(c)).toMatchObject({ etat: 'AUCUNE_AFFICHE_RECUE', aConfirmer: 0 })
  })

  it('RG-COO-019 / RG-COO-020 pastille indépendante de la prépa : prépa reçue sans affiche → « Aucune affiche reçue »', async () => {
    const c = await contexte('PREPARATION_RECUE')
    await ligne(ctx, c.plateforme.id, { contNum: c.dossier.contNum, supportId: c.support.id })
    expect((await pastille(c)).etat).toBe('AUCUNE_AFFICHE_RECUE')
  })

  it('RG-COO-020 rejet : l’annulation d’une validation fait repasser le dossier à « À confirmer (1, dont 1 doute) »', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 2)
    await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
    expect((await pastille(c)).etat).toBe('VALIDEE')
    const a = await affiche(rv.afficheId)
    expect((await validerUnitaire(c.coord.headers, a.id, a.version, false)).statusCode).toBe(200)
    expect(await pastille(c)).toEqual({
      etat: 'A_CONFIRMER',
      aConfirmer: 1,
      doutes: 1,
      casSur: false,
    })
  })

  it('RG-COO-020 dossier « À traiter » : la validation n’écrit aucun statut ni historique de statut du dossier', async () => {
    const c = await contexte('A_TRAITER')
    await recevoir(c, 2)
    const avant = await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })
    expect((await valider(c.coord.headers, { dossierIds: [c.dossier.id] })).statusCode).toBe(200)
    const apres = await db.dossier.findUniqueOrThrow({ where: { id: c.dossier.id } })
    expect(apres).toMatchObject({ statut: 'A_TRAITER', version: avant.version })
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'DOSSIER', entiteId: String(c.dossier.contNum) },
      }),
    ).toBe(0)
    expect((await pastille(c)).etat).toBe('VALIDEE')
  })
})

// ───────────────── RG-COO-001 : deux circuits indépendants ─────────────────

describe('RG-COO-001 validation admin indépendante de l’Instruction OK (complément)', () => {
  it.each(['EN_COURS', 'INSTRUCTION_OK'] as const)(
    'RG-COO-001 instruction %s : la validation en lot est acceptée et l’instruction ne bouge pas',
    async (statut) => {
      const c = await contexte('PREPARATION_RECUE')
      const atelier = await f.createAtelier(db, { plateformeId: c.plateforme.id })
      const i = await f.createInstruction(db, {
        atelierId: atelier.id,
        dossierId: c.dossier.id,
        contNum: c.dossier.contNum,
        statut,
      })
      const rv = await recevoir(c, 2)
      const r = await valider(c.coord.headers, { dossierIds: [c.dossier.id] })
      expect(r.statusCode).toBe(200)
      expect((await affiche(rv.afficheId)).validationAdmin).toBe(true)
      const apres = await db.instruction.findUniqueOrThrow({ where: { code: i.code } })
      expect(apres).toMatchObject({ statut, version: i.version })
    },
  )
})

// ───────────────── RG-X-053 : pas d'effet de validation tant que non confirmée ─────────────────

describe('RG-X-053 invariants d’une affiche non confirmée (complément)', () => {
  it('RG-X-053 affiche à doute : stock et feuille de stock permis, impression feuille + étiquette rack permise, sans effet de validation', async () => {
    const c = await contexte()
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
    const id = rec.json<{ affiches: { id: number }[] }>().affiches[0]?.id ?? 0
    const stock = await get(ctx, `/api/affiches/${String(id)}/stock`, c.headers)
    expect(stock.statusCode).toBe(200)
    expect(StockAfficheSchema.parse(stock.json()).stock).toBe(4)
    const fe = await get(ctx, `/api/feuilles?ids=${String(id)}`, c.headers)
    expect(fe.statusCode).toBe(200)
    expect(FeuillesSchema.parse(fe.json()).feuilles[0]).toMatchObject({
      type: 'DEFINITIVE',
      quantite: 4,
    })
    const imp = await post(ctx, '/api/impressions', c.headers, {
      afficheIds: [id],
      contenu: 'FEUILLE_ET_ETIQUETTE',
      exemplaires: 1,
    })
    expect(imp.statusCode).toBe(200)
    expect(await affiche(id)).toMatchObject({ validationAdmin: false, validationAdminParId: null })
    expect(await validationAffiche(id, c.headers)).toMatchObject({
      etat: 'A_CONFIRMER_DOUTE',
      motifs: ['SANS_IP'],
    })
    expect(await journauxValidation(id)).toBe(0)
  })

  it('RG-X-053 « à confirmer : proposé » (cas sûr non confirmé) absent du picking ; une validation annulée l’en retire', async () => {
    const c = await contexte()
    const rv = await recevoir(c, 3)
    const a = await affiche(rv.afficheId)
    const jour = a.dateEntree.toISOString().slice(0, 10)
    const picking = async () =>
      (
        await get(
          ctx,
          `/api/edition-picking?plateformeId=${String(c.plateforme.id)}&du=${jour}&au=${jour}`,
          c.headers,
        )
      )
        .json<{ lignes: { afficheId: number }[] }>()
        .lignes.map((x) => x.afficheId)
    expect(await picking()).not.toContain(a.id)
    expect((await validerUnitaire(c.coord.headers, a.id, a.version)).statusCode).toBe(200)
    expect(await picking()).toContain(a.id)
    const v = await affiche(a.id)
    expect((await validerUnitaire(c.coord.headers, a.id, v.version, false)).statusCode).toBe(200)
    expect(await picking()).not.toContain(a.id)
  })
})
