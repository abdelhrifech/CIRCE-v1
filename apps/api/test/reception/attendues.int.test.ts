// REC-P02 — Réceptions attendues : GET /api/receptions-attendues, GET /api/reception/compteurs,
// recalcul du statut de ligne, purge (fonction ; planification bloquée par Q-005).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import {
  CompteursReceptionSchema,
  ErrorResponseSchema,
  ListeAttenduesResponseSchema,
  formatSemaineIso,
  semaineIsoDe,
  type Role,
} from '@circe/shared'
import { buildApp } from '../../src/app.ts'
import { loadConfig } from '../../src/core/config.ts'
import { createDb } from '../../src/core/db.ts'
import type { Identity } from '../../src/core/identity.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { purgerReceptionsAttendues } from '../../src/modules/reception/purge.ts'
import { rattacher, retirerRattachement } from '../../src/modules/reception/rattachement.ts'
import { enregistrerMouvement } from '../../src/modules/reception/stock.ts'
import { seedRef } from '../../src/reference/seed-ref.ts'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance
const courante = semaineIsoDe(new Date())
const decale = (n: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n * 7)
  return semaineIsoDe(d)
}

beforeAll(async () => {
  await seedRef(db)
  app = buildApp({ config, db, closeDb: () => db.$disconnect() })
  await app.ready()
})
afterAll(async () => {
  await app.close()
})

async function site(roles: Role[] = ['recep']) {
  const plateforme = await f.createPlateforme(db)
  const user = await f.createUtilisateurAvecRoles(db, roles, [{ plateformeId: plateforme.id }])
  const identity: Identity = {
    userId: user.id,
    identifiantExterne: user.identifiantExterne,
    nom: user.nom,
    roles,
    perimetre: {
      toutesPlateformes: roles.includes('admin'),
      plateformeIds: [plateforme.id],
      lignes: [{ plateformeId: plateforme.id, atelierId: null }],
    },
    siteId: null,
  }
  return { plateforme, user, identity, headers: devHeaders(user.identifiantExterne, plateforme.id) }
}

function ligne(plateformeId: number, data: Parameters<typeof f.createReceptionAttendue>[1] = {}) {
  return f.createReceptionAttendue(db, {
    plateformeId,
    semAnnee: courante.annee,
    semNum: courante.semaine,
    qteBc: 10,
    ...data,
  })
}

async function lister(headers: Record<string, string>, qs = '') {
  const r = await app.inject({ method: 'GET', url: `/api/receptions-attendues${qs}`, headers })
  return { r, body: r.statusCode === 200 ? ListeAttenduesResponseSchema.parse(r.json()) : null }
}

async function rattacherQte(
  identity: Identity,
  plateformeId: number,
  ligneId: number,
  quantite: number,
) {
  // Une affiche reçue vient d'une palette ; ici une palette encore dans le sas (À contrôler).
  const reception = await f.createReception(db, { plateformeId, statut: 'A_CONTROLER' })
  const affiche = await f.createAffiche(db, {
    plateformeId,
    quantite: 0,
    receptionId: reception.id,
  })
  await withTransaction(db, async (tx) => {
    await enregistrerMouvement(tx, identity, {
      permission: 'reception.valider',
      afficheId: affiche.id,
      type: 'RECEPTION',
      quantite,
    })
    await rattacher(tx, identity, {
      permission: 'reception.valider',
      afficheId: affiche.id,
      ligneAttendueId: ligneId,
      quantite,
      mode: 'BL',
    })
  })
  return affiche
}

describe('RG-REC-014 lignes affichées', () => {
  it('RG-REC-014 une ligne par visuel du site, avec colonnes Reçu / attendu, Reste, Statut, Contrôle', async () => {
    const { plateforme, headers } = await site()
    const l = await ligne(plateforme.id, {
      contNum: 910037,
      idDaChapeau: 470053,
      annonceur: 'ACME',
      format: '2m2',
      qteBc: 7,
    })
    const { body } = await lister(headers)
    expect(body?.items).toEqual([
      expect.objectContaining({
        id: l.id,
        site: { id: plateforme.id, nom: plateforme.nom },
        dossier: 910037,
        da: 470053,
        depart: formatSemaineIso(courante),
        attendu: 7,
        recu: 0,
        reste: 7,
        statut: 'ATTENDUE',
        controle: 'RIEN_RECU',
        affiches: [],
        livraisonPrevue: null,
      }),
    ])
  })

  it('RG-REC-014 exclut les lignes annulées, purgées, à thème exclu, d’un dossier annulé ou d’un autre site', async () => {
    const { plateforme, headers } = await site()
    const garde = await ligne(plateforme.id)
    await ligne(plateforme.id, { etatLigne: 'ANNULEE' })
    await ligne(plateforme.id, { themeExclu: true })
    await ligne(plateforme.id, { purgeeLe: new Date() })
    const annule = await f.createDossier(db, { statut: 'ANNULE' })
    await ligne(plateforme.id, { contNum: annule.contNum })
    await ligne((await f.createPlateforme(db)).id)
    const { body } = await lister(headers, '?statut=tous')
    expect(body?.items.map((i) => i.id)).toEqual([garde.id])
  })

  it('RG-REC-014 site sans ligne : aucuneLigneSurLeSite = vrai (« Aucune réception attendue à proposer sur ce site. »)', async () => {
    const { headers } = await site()
    const { body } = await lister(headers)
    expect(body).toMatchObject({ items: [], total: 0, aucuneLigneSurLeSite: true })
  })

  it('RG-REC-001 sans site choisi : toutes les plateformes du périmètre, et seulement elles', async () => {
    const { plateforme, user } = await site()
    const l = await ligne(plateforme.id)
    await ligne((await f.createPlateforme(db)).id)
    const { body } = await lister(devHeaders(user.identifiantExterne))
    expect(body?.items.map((i) => i.id)).toEqual([l.id])
  })
})

describe('RG-REC-002 / RG-REC-001 accès', () => {
  it.each([
    ['coord', 200],
    ['cheq', 200],
    ['recep', 200],
    ['com', 200],
    ['expe', 403],
  ] as const)('RG-REC-002 consultation des attendues par %s → %i', async (role, attendu) => {
    const { headers } = await site([role])
    const { r } = await lister(headers)
    expect(r.statusCode).toBe(attendu)
    if (attendu === 403)
      expect(ErrorResponseSchema.parse(r.json())).toMatchObject({
        code: 'REC_ACCES_REFUSE',
        regle: 'RG-REC-002',
      })
  })

  it('RG-REC-004 sans identité → 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/receptions-attendues' })).statusCode).toBe(
      401,
    )
  })

  it('RG-REC-001 site hors périmètre → 403', async () => {
    const { user } = await site()
    const autre = await f.createPlateforme(db)
    const { r } = await lister(devHeaders(user.identifiantExterne, autre.id))
    expect(r.statusCode).toBe(403)
  })
})

describe('RG-REC-016 / RG-REC-015 filtres et valeurs par défaut', () => {
  it('RG-REC-016 statut par défaut Attendue + Partielle ; « tous » montre aussi Complète et Surplus', async () => {
    const { plateforme, headers } = await site()
    for (const statut of ['ATTENDUE', 'PARTIELLE', 'COMPLETE', 'SURPLUS'] as const)
      await ligne(plateforme.id, { statut })
    const parDefaut = await lister(headers)
    expect(parDefaut.body?.items.map((i) => i.statut).sort()).toEqual(['ATTENDUE', 'PARTIELLE'])
    expect(parDefaut.body?.filtres.statut).toEqual(['ATTENDUE', 'PARTIELLE'])
    const tous = await lister(headers, '?statut=tous')
    expect(tous.body?.total).toBe(4)
  })

  it('RG-REC-016 compteurs par valeur, calculés hors du filtre concerné', async () => {
    const { plateforme, headers } = await site()
    for (const statut of ['ATTENDUE', 'ATTENDUE', 'COMPLETE'] as const)
      await ligne(plateforme.id, { statut })
    const { body } = await lister(headers)
    expect(body?.compteurs.statut).toEqual([
      { valeur: 'ATTENDUE', nombre: 2 },
      { valeur: 'COMPLETE', nombre: 1 },
    ])
  })

  it('RG-REC-016 OU entre valeurs d’un filtre, ET entre filtres', async () => {
    const { plateforme, headers } = await site()
    const a = await ligne(plateforme.id, { format: '2m2', annonceur: 'A' })
    const b = await ligne(plateforme.id, { format: '8m2', annonceur: 'A' })
    await ligne(plateforme.id, { format: '8m2', annonceur: 'B' })
    const { body } = await lister(headers, '?format=2m2,8m2&annonceur=A')
    expect(body?.items.map((i) => i.id).sort((x, y) => x - y)).toEqual([a.id, b.id])
  })

  it('RG-REC-015 départ par défaut : semaine courante et suivantes (semaines ISO)', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { semAnnee: decale(-1).annee, semNum: decale(-1).semaine })
    const now = await ligne(plateforme.id)
    const next = await ligne(plateforme.id, {
      semAnnee: decale(1).annee,
      semNum: decale(1).semaine,
    })
    const { body } = await lister(headers)
    expect(body?.items.map((i) => i.id)).toEqual([now.id, next.id])
    expect(body?.filtres.depart).toEqual([formatSemaineIso(courante), formatSemaineIso(decale(1))])
  })

  it('RG-REC-015 une semaine passée choisie explicitement reste consultable', async () => {
    const { plateforme, headers } = await site()
    const avant = await ligne(plateforme.id, {
      semAnnee: decale(-1).annee,
      semNum: decale(-1).semaine,
    })
    const { body } = await lister(headers, `?depart=${formatSemaineIso(decale(-1))}`)
    expect(body?.items.map((i) => i.id)).toEqual([avant.id])
  })

  it('RG-REC-016 / RG-REC-012 depart=tous lève la restriction de semaine (semaines passées comprises)', async () => {
    const { plateforme, headers } = await site()
    const avant = await ligne(plateforme.id, {
      semAnnee: decale(-2).annee,
      semNum: decale(-2).semaine,
    })
    const now = await ligne(plateforme.id)
    const { body } = await lister(headers, '?depart=tous')
    expect(body?.items.map((i) => i.id)).toEqual([avant.id, now.id])
    expect(body?.filtres.depart).toEqual([])
    // RG-REC-015 : les OPTIONS du filtre restent ≥ semaine de production, même avec depart=tous.
    expect(body?.compteurs.depart.map((c) => c.valeur)).toEqual([formatSemaineIso(courante)])
  })

  it('RG-REC-012 « Masqués par Départ » : la ligne d’une semaine passée réapparaît avec depart=tous', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, {
      contNum: 654321,
      semAnnee: decale(-2).annee,
      semNum: decale(-2).semaine,
    })
    const masque = await lister(headers, '?q=654321')
    expect(masque.body?.recherche.masques).toEqual([{ valeur: '654321', filtres: ['Départ'] }])
    const affiche = await lister(headers, '?q=654321&depart=tous')
    expect(affiche.body?.items.map((i) => i.dossier)).toEqual([654321])
  })

  it('RG-REC-015 refuse une semaine mal formée (400)', async () => {
    const { headers } = await site()
    expect((await lister(headers, '?depart=S43')).r.statusCode).toBe(400)
    expect((await lister(headers, '?depart=2026-W54')).r.statusCode).toBe(400)
  })

  it('RG-REC-016 refuse un statut inconnu et un tri non autorisé (400)', async () => {
    const { headers } = await site()
    expect((await lister(headers, '?statut=PERDUE')).r.statusCode).toBe(400)
    expect((await lister(headers, '?sort=motDePasse')).r.statusCode).toBe(400)
  })

  it('trie et pagine', async () => {
    const { plateforme, headers } = await site()
    for (const contNum of [300003, 300001, 300002]) await ligne(plateforme.id, { contNum })
    const p1 = await lister(headers, '?sort=dossier&ordre=desc&pageSize=2')
    expect(p1.body?.items.map((i) => i.dossier)).toEqual([300003, 300002])
    expect(p1.body?.total).toBe(3)
    const p2 = await lister(headers, '?sort=dossier&ordre=desc&pageSize=2&page=2')
    expect(p2.body?.items.map((i) => i.dossier)).toEqual([300001])
  })
})

describe('RG-REC-012 / RG-REC-013 recherche', () => {
  it('RG-REC-012 n° de dossier, de DA ou annonceur ; plusieurs valeurs', async () => {
    const { plateforme, headers } = await site()
    const a = await ligne(plateforme.id, { contNum: 910037 })
    const b = await ligne(plateforme.id, { idDaChapeau: 470053 })
    const c = await ligne(plateforme.id, { annonceur: 'Société Générale' })
    await ligne(plateforme.id, { contNum: 999999, annonceur: 'Autre' })
    const { body } = await lister(headers, `?q=${encodeURIComponent('910037 470053, generale')}`)
    expect(body?.items.map((i) => i.id).sort((x, y) => x - y)).toEqual(
      [a.id, b.id, c.id].sort((x, y) => x - y),
    )
  })

  it('RG-REC-012 signale les valeurs absentes et celles masquées par un filtre', async () => {
    const { plateforme, headers } = await site()
    await ligne(plateforme.id, { contNum: 910037, statut: 'COMPLETE' })
    const { body } = await lister(headers, '?q=910037+123456')
    expect(body?.items).toEqual([])
    expect(body?.recherche.absents).toEqual(['123456'])
    expect(body?.recherche.masques).toEqual([{ valeur: '910037', filtres: ['Statut'] }])
  })

  it('RG-REC-013 filtre par n° de dossier : 6 chiffres (-W accepté)', async () => {
    const { plateforme, headers } = await site()
    const a = await ligne(plateforme.id, { contNum: 910037 })
    const { body } = await lister(headers, '?dossier=910037-W')
    expect(body?.items.map((i) => i.id)).toEqual([a.id])
  })

  it('RG-REC-013 n° de dossier mal formé : 400 REC_DOSSIER_FORMAT', async () => {
    const { headers } = await site()
    const { r } = await lister(headers, '?dossier=12345')
    expect(r.statusCode).toBe(400)
    expect(ErrorResponseSchema.parse(r.json())).toMatchObject({
      code: 'REC_DOSSIER_FORMAT',
      regle: 'RG-REC-013',
    })
  })
})

describe('RG-REC-017 / RG-REC-018 / RG-REC-019 reçu, statut, contrôle', () => {
  it('RG-REC-017 reçu = Σ liens actifs ; RG-REC-018 statut recalculé et historisé à chaque rattachement', async () => {
    const { plateforme, identity, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await rattacherQte(identity, plateforme.id, l.id, 4)
    let row = (await lister(headers, '?statut=tous')).body?.items[0]
    expect(row).toMatchObject({ recu: 4, reste: 6, statut: 'PARTIELLE', controle: 'A_CONTROLER' })
    await rattacherQte(identity, plateforme.id, l.id, 7)
    row = (await lister(headers, '?statut=tous')).body?.items[0]
    expect(row).toMatchObject({ recu: 11, reste: 0, statut: 'COMPLETE' })
    expect(row?.affiches).toHaveLength(2)
    const histo = await db.statutHistorique.findMany({
      where: { typeEntite: 'LIGNE_ATTENDUE', entiteId: String(l.id) },
      orderBy: { id: 'asc' },
    })
    expect(histo.map((h) => `${h.ancien ?? ''}→${h.nouveau}`)).toEqual([
      'ATTENDUE→PARTIELLE',
      'PARTIELLE→COMPLETE',
    ])
  })

  it('RG-REC-018 au-delà de l’écart → Surplus ; le retrait d’un lien fait redescendre le statut', async () => {
    const { plateforme, identity } = await site()
    const l = await ligne(plateforme.id, { qteBc: 10 })
    await rattacherQte(identity, plateforme.id, l.id, 8)
    const affiche = await rattacherQte(identity, plateforme.id, l.id, 4)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'SURPLUS',
    )
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: affiche.id, actif: true },
    })
    await withTransaction(db, (tx) =>
      retirerRattachement(tx, identity, {
        lienId: lien.id,
        expectedVersion: lien.version,
        permission: 'reception.valider',
      }),
    )
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'PARTIELLE',
    )
  })

  it('RG-REC-018 / Q-105 l’écart est un paramètre GLOBAL : une valeur propre à un site est ignorée', async () => {
    const { plateforme, identity } = await site()
    await f.createParametre(db, {
      cle: 'reception.ecartReception',
      plateformeId: plateforme.id,
      valeur: '20',
    })
    const l = await ligne(plateforme.id, { qteBc: 100 })
    await rattacherQte(identity, plateforme.id, l.id, 115)
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).statut).toBe(
      'SURPLUS',
    )
  })

  it('RG-REC-019 Contrôlée quand toutes les palettes des affiches rattachées sont contrôlées', async () => {
    const { plateforme, identity, headers } = await site()
    const l = await ligne(plateforme.id, { qteBc: 5 })
    const reception = await f.createReception(db, {
      plateformeId: plateforme.id,
      statut: 'CONTROLEE',
    })
    const affiche = await f.createAffiche(db, {
      plateformeId: plateforme.id,
      quantite: 0,
      receptionId: reception.id,
    })
    await withTransaction(db, async (tx) => {
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        type: 'RECEPTION',
        quantite: 5,
      })
      await rattacher(tx, identity, {
        permission: 'reception.valider',
        afficheId: affiche.id,
        ligneAttendueId: l.id,
        quantite: 5,
        mode: 'BL',
      })
    })
    const row = (await lister(headers, '?statut=tous')).body?.items[0]
    expect(row).toMatchObject({ controle: 'CONTROLEE', affiches: [affiche.id] })
    const filtre = await lister(headers, '?statut=tous&controle=RIEN_RECU')
    expect(filtre.body?.items).toEqual([])
  })
})

describe('RG-REC-010 badges du menu Réception', () => {
  it('RG-REC-010 palettes à contrôler et affiches orphelines du site choisi', async () => {
    const { plateforme, headers } = await site(['recep'])
    await f.createReception(db, { plateformeId: plateforme.id, statut: 'A_CONTROLER' })
    await f.createReception(db, { plateformeId: plateforme.id, statut: 'CONTROLEE' })
    await f.createReception(db, { statut: 'A_CONTROLER' })
    await f.createAffiche(db, { plateformeId: plateforme.id, statut: 'ORPHELINE' })
    const r = await app.inject({ method: 'GET', url: '/api/reception/compteurs', headers })
    expect(CompteursReceptionSchema.parse(r.json())).toEqual({
      palettesAControler: 1,
      affichesOrphelines: 1,
    })
  })

  it('RG-REC-010 un compteur sans droit de consultation vaut null (com : pas de réceptions inconnues)', async () => {
    const { headers } = await site(['com'])
    const r = await app.inject({ method: 'GET', url: '/api/reception/compteurs', headers })
    expect(CompteursReceptionSchema.parse(r.json())).toEqual({
      palettesAControler: 0,
      affichesOrphelines: null,
    })
  })
})

describe('RG-REC-180 / RG-REC-181 purge des réceptions attendues (fonction ; planification : Q-005)', () => {
  it('RG-REC-180 ferme les lignes Attendue / Partielle de plus de 4 semaines, sans les supprimer', async () => {
    const { plateforme } = await site()
    const vieille = decale(-6)
    const a = await ligne(plateforme.id, {
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
      statut: 'ATTENDUE',
    })
    const p = await ligne(plateforme.id, {
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
      statut: 'PARTIELLE',
    })
    const n = await purgerReceptionsAttendues(db)
    expect(n).toBeGreaterThanOrEqual(2)
    for (const id of [a.id, p.id]) {
      const apres = await db.receptionAttendue.findUniqueOrThrow({ where: { id } })
      expect(apres.etatLigne).toBe('ANNULEE')
      expect(apres.purgeeLe).toBeInstanceOf(Date)
    }
  })

  it('RG-REC-180 garde les lignes récentes, complètes, en surplus ou conservées à l’année', async () => {
    const { plateforme } = await site()
    const vieille = decale(-6)
    const recente = await ligne(plateforme.id, {
      semAnnee: decale(-3).annee,
      semNum: decale(-3).semaine,
    })
    const complete = await ligne(plateforme.id, {
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
      statut: 'COMPLETE',
    })
    const conservee = await ligne(plateforme.id, {
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
      conserverAnnee: true,
    })
    await purgerReceptionsAttendues(db)
    for (const id of [recente.id, complete.id, conservee.id]) {
      expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id } })).etatLigne).toBe(
        'ACTIVE',
      )
    }
  })

  it('RG-REC-181 une ligne au journal « n réception(s) attendue(s) purgée(s). », sans auteur ni alerte', async () => {
    const avant = await db.journalAudit.count({ where: { action: 'PURGE_ATTENDUES' } })
    const n = await purgerReceptionsAttendues(db)
    const lignes = await db.journalAudit.findMany({
      where: { action: 'PURGE_ATTENDUES' },
      orderBy: { id: 'desc' },
      take: 1,
    })
    expect(await db.journalAudit.count({ where: { action: 'PURGE_ATTENDUES' } })).toBe(avant + 1)
    expect(lignes[0]).toMatchObject({
      parId: null,
      nouvelleValeur: `${n} réception(s) attendue(s) purgée(s).`,
    })
  })

  it('RG-REC-014 / RG-REC-052 une ligne purgée n’apparaît plus dans les attendues (l’affiche passera par « Réception inconnue… »)', async () => {
    const { plateforme, headers } = await site()
    const vieille = decale(-6)
    await ligne(plateforme.id, { semAnnee: vieille.annee, semNum: vieille.semaine })
    await purgerReceptionsAttendues(db)
    expect(
      (await lister(headers, `?statut=tous&depart=${formatSemaineIso(vieille)}`)).body?.total,
    ).toBe(0)
  })
})
