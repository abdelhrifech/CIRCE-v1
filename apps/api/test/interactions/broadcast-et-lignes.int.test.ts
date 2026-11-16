// ÉTAPE 7 — interactions « lecture de Broadcast / vie des lignes / trains » × état de la Réception (cellules B-nn
// de la matrice d'impact). Une lecture de Broadcast (alimentation des lignes attendues, RG-COO-080 à 090) ou une
// action sur les trains agit sur des lignes qui portent déjà des affiches REÇUES : les liens, le stock, la
// validation et les palettes ne sont jamais perdus (RG-X-055, 056, 064, 065), les unités déjà en production sont
// figées (RG-X-077), le visuel arrivé après le fractionnement est produit à part (RG-X-086).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lundiSemaineIso, semaineIsoDe, type SemaineIso } from '@circe/shared'
import { withTransaction } from '../../src/core/transaction.ts'
import {
  alimenterDepuisBroadcast,
  type LigneLueBroadcast,
} from '../../src/modules/coordination/alimentation-lignes.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import {
  envoyer,
  SEM,
  siteDeroulant,
  trainExportable,
  versionTrain,
} from '../support/export-trains.ts'
import { affiche, alertes, ligneDe, stock, valider } from '../support/interactions.ts'
import { bonDeLivraison, contexteReception, get, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))

/** Plateforme gérée par Broadcast (site CCF), support avec correspondance surface × format, coord + recep. */
async function site() {
  const idSiteCcf = 20_000 + next()
  const plateforme = await f.createPlateforme(db, { idSiteCcf })
  const support = await f.createSupport(db)
  const idSurface = 600 + next()
  const idFormat = 1000 + next()
  await db.correspondanceSupport.create({ data: { idSurface, idFormat, supportId: support.id } })
  const coord = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: plateforme.id }])
  const recep = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: plateforme.id }])
  return {
    plateforme,
    support,
    idSiteCcf,
    idSurface,
    idFormat,
    contNum: 710_000 + next(),
    coord: devHeaders(coord.identifiantExterne),
    recep: devHeaders(recep.identifiantExterne),
    recepUser: recep,
  }
}
type Site = Awaited<ReturnType<typeof site>>

function lue(s: Site, p: Partial<LigneLueBroadcast> = {}): LigneLueBroadcast {
  return {
    idSiteCcf: s.idSiteCcf,
    destinataire: 'Wissous',
    contNum: s.contNum,
    annonceur: 'ANNONCEUR ETAPE7',
    idSurface: s.idSurface,
    idFormat: s.idFormat,
    idTheme: null,
    theme: 'Thème A',
    idThemeBandeau: null,
    idDaChapeau: null,
    semaine: plus(S, 1),
    quantite: 100,
    estResteEnPlace: false,
    statutPreparation: null,
    ...p,
  }
}
const lire = (lignes: LigneLueBroadcast[]) =>
  withTransaction(db, (tx) => alimenterDepuisBroadcast(tx, { lueLe: new Date(), lignes }))
const actives = async (contNum: number) =>
  (await db.receptionAttendue.findMany({ where: { contNum }, orderBy: { id: 'asc' } })).filter(
    (l) => l.etatLigne === 'ACTIVE',
  )

async function recevoirSur(s: Site, ligneAttendueId: number, quantite: number, intitule?: string) {
  const bl = await bonDeLivraison(ctx, s.recep, [
    { ligneAttendueId, quantite, ...(intitule ? { intituleSaisi: intitule } : {}) },
  ])
  const r = await post(ctx, '/api/receptions', s.recep, bl)
  expect(r.statusCode, r.body).toBe(201)
  const a = r.json<{ affiches: { id: number }[]; receptionId: number }>()
  const id = a.affiches[0]?.id
  if (id === undefined) throw new Error('aucune affiche')
  return { afficheId: id, receptionId: a.receptionId }
}

describe('B-01 IP saisies après réception : ligne provisoire → thème (RG-X-020, RG-X-056)', () => {
  it('RG-X-056 un seul thème possible : l’affiche reçue est déplacée SEULE vers le thème ; validation conservée ; stock, palette et mouvements inchangés ; déplacement historisé', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const [p] = await actives(s.contNum)
    if (!p) throw new Error('ligne provisoire')
    const rv = await recevoirSur(s, p.id, 10, 'Thème lu sur l’affiche')
    await valider(ctx, s.coord, rv.afficheId, true)
    const mouvementsAvant = await db.mouvement.count({ where: { afficheId: rv.afficheId } })
    const r = await lire([lue(s, { theme: 'Thème des IP', semaine: S })])
    expect(r).toMatchObject({ provisoiresFermees: 1, liensDeplaces: 1 })
    const liens = await db.afficheAttendue.findMany({
      where: { afficheId: rv.afficheId },
      orderBy: { id: 'asc' },
    })
    expect(liens.map((l) => [l.actif, l.quantite])).toEqual([
      [false, 10],
      [true, 10],
    ])
    expect(await stock(ctx, rv.afficheId)).toBe(10)
    expect(await db.mouvement.count({ where: { afficheId: rv.afficheId } })).toBe(mouvementsAvant)
    expect((await db.reception.findUniqueOrThrow({ where: { id: rv.receptionId } })).statut).toBe(
      'A_CONTROLER',
    )
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(rv.afficheId), action: 'DEPLACEMENT_RATTACHEMENT' },
      }),
    ).toBe(1)
    expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(true)
  })

  it('RG-X-056 rejet : plusieurs thèmes sans désignation → le lien RESTE sur la ligne fermée (jamais d’affiche orpheline), alerte pour la Coordination', async () => {
    const s = await site()
    await lire([lue(s, { theme: null, semaine: S })])
    const [p] = await actives(s.contNum)
    if (!p) throw new Error('ligne provisoire')
    const rv = await recevoirSur(s, p.id, 10, 'Autre chose')
    const r = await lire([
      lue(s, { theme: 'Thème A', semaine: S }),
      lue(s, { theme: 'Thème B', semaine: S }),
    ])
    expect(r.liensDeplaces).toBe(0)
    expect((await affiche(ctx, rv.afficheId)).statut).toBe('IDENTIFIEE')
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect(await stock(ctx, rv.afficheId)).toBe(10)
    expect(r.alertes.map((a) => a.type)).toContain('AUCUN_CANDIDAT_THEME')
  })
})

describe('B-02 ligne disparue de Broadcast après réception (RG-X-055, RG-X-065)', () => {
  it('RG-X-055 la ligne fermée garde le lien de l’affiche : affiche toujours « Identifiée », stock intact, aucun mouvement, validation conservée', async () => {
    const s = await site()
    const autre = lue(s, { contNum: s.contNum + 3 })
    await lire([lue(s), autre])
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    const rv = await recevoirSur(s, l.id, 10)
    await valider(ctx, s.coord, rv.afficheId, true)
    const mouvementsAvant = await db.mouvement.count({ where: { afficheId: rv.afficheId } })
    await lire([autre])
    await lire([autre])
    expect((await ligneDe(ctx, l.id)).etatLigne).toBe('ANNULEE')
    expect(await affiche(ctx, rv.afficheId)).toMatchObject({
      statut: 'IDENTIFIEE',
      validationAdmin: true,
    })
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect(await stock(ctx, rv.afficheId)).toBe(10)
    expect(await db.mouvement.count({ where: { afficheId: rv.afficheId } })).toBe(mouvementsAvant)
    const types = (await alertes(ctx, s.coord, `?dossier=${String(s.contNum)}`)).map((a) => a.type)
    expect(types).toContain('ECART_BC')
  })

  it('RG-X-065 rejet : une ligne vue de nouveau repart de zéro (aucune fermeture), l’affiche et son lien sont inchangés', async () => {
    const s = await site()
    const autre = lue(s, { contNum: s.contNum + 3 })
    await lire([lue(s), autre])
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    const rv = await recevoirSur(s, l.id, 5)
    await lire([autre])
    await lire([lue(s), autre])
    await lire([autre])
    expect((await ligneDe(ctx, l.id)).etatLigne).toBe('ACTIVE')
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
  })
})

describe('B-03 quantité de Broadcast modifiée après réception (RG-X-064)', () => {
  it('RG-X-064 100 → 80 avec 90 reçus : l’attendu est recalculé, « Surplus » (+12,5 %), liens et stock inchangés, alerte « Écart Broadcast / Circé »', async () => {
    const s = await site()
    await lire([lue(s, { quantite: 100 })])
    const [l] = await actives(s.contNum)
    if (!l) throw new Error('ligne')
    const rv = await recevoirSur(s, l.id, 90)
    await valider(ctx, s.coord, rv.afficheId, true)
    await lire([lue(s, { quantite: 80 })])
    const apres = await ligneDe(ctx, l.id)
    expect(apres).toMatchObject({ qteBc: 80, statut: 'SURPLUS' })
    expect(await stock(ctx, rv.afficheId)).toBe(90)
    expect(
      await db.afficheAttendue.count({ where: { afficheId: rv.afficheId, actif: true } }),
    ).toBe(1)
    expect((await affiche(ctx, rv.afficheId)).validationAdmin).toBe(true)
  })
})

describe('B-04 / B-05 trains : dernière minute et fractionnement (RG-X-077, RG-X-086)', () => {
  it('RG-X-077 une instruction renvoyée alors que la production est lancée : alerte critique « Dernière minute », AUCUN statut de train modifié, affiches reçues inchangées', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Dernière minute'], { statut: 'AU_ROULAGE' })
    const i = t.instructions[0]
    const d = t.dossiers[0]
    if (!i || !d) throw new Error('instruction')
    await db.instruction.update({ where: { code: i.code }, data: { statut: 'PRET_A_PRODUIRE' } })
    await f.createJournalAudit(db, {
      typeEntite: 'INSTRUCTION',
      entiteId: i.code,
      action: 'RENVOI_BROADCAST_IGNORE',
      ancienneValeur: 'PRET_A_PRODUIRE',
      le: new Date(),
    })
    const a = (await alertes(ctx, s.users.coord.headers, `?dossier=${String(d.contNum)}`)).find(
      (x) => x.regle === 'RG-COO-074',
    )
    expect(a).toMatchObject({ type: 'DM_FICHIER', gravite: 'CRITIQUE' })
    const apres = await db.faceTrain.findMany({ where: { trainId: t.trainId } })
    expect(apres.map((x) => x.statut)).toEqual(['AU_ROULAGE'])
  })

  it('RG-X-086 visuel arrivé APRÈS le fractionnement : la position fractionnée n’entre plus dans la couverture (produite à part), le train reste PRÊT', async () => {
    const s = await siteDeroulant(ctx)
    const t = await trainExportable(ctx, s, ['Reçu', 'Tardif'])
    const [d1, d2] = t.dossiers
    if (!d1 || !d2) throw new Error('dossiers')
    const l1 = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: d1.contNum,
      theme: 'Reçu',
      themeCle: 'REÇU',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const l2 = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: d2.contNum,
      theme: 'Tardif',
      themeCle: 'TARDIF',
      semAnnee: SEM.annee,
      semNum: SEM.semaine,
    })
    const bl1 = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l1.id, quantite: 2 },
    ])
    expect((await post(ctx, '/api/receptions', s.users.recep.headers, bl1)).statusCode).toBe(201)
    const fr = await envoyer(ctx, '/api/coordination/trains/fractionner', s.users.cheq.headers, {
      trains: [
        { trainId: t.trainId, version: await versionTrain(ctx, s.users.coord.headers, t.trainId) },
      ],
    })
    expect(fr.statusCode, fr.body).toBe(200)
    const bl2 = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l2.id, quantite: 2 },
    ])
    expect((await post(ctx, '/api/receptions', s.users.recep.headers, bl2)).statusCode).toBe(201)
    const fiche = (
      await get(ctx, `/api/coordination/trains/${t.trainId}`, s.users.coord.headers)
    ).json<{ statut: string; fractionne: boolean; positions: { etat: string }[] }>()
    expect(fiche).toMatchObject({ statut: 'PRET', fractionne: true })
    expect(fiche.positions.map((p) => p.etat)).toEqual(['OK', 'FRACTIONNE'])
  })
})
