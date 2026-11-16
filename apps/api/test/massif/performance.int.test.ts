// Étape 9 — MESURE des temps des principales listes et filtres sous volumétrie, par l'API réelle (inject) sur la base de
// test : famille « volumetrie » des générateurs (JDD_PERF_VOLUME dossiers, défaut 2000 ≈ 25 000 enregistrements), trois
// sites, puis chaque lecture est mesurée 3 fois (min / médiane / max, en ms). Un temps médian > JDD_SEUIL_MS (défaut
// 3000 ms) est un défaut à corriger dans le CODE (ANO-035 / 050 / 051 / 055 : lectures par paquets, core/paquets.ts).
// Les chiffres sont écrits dans la sortie (« MESURE ... ») et consignés dans docs/RAPPORT_TESTS.md. Données purgées.
import { writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatSemaineIso, semaineIsoDe } from '@circe/shared'
import { genererJdd } from '../jdd/run.ts'
import { purger, relevoirRepere, type Repere } from '../jdd/purge.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception } from '../support/reception.ts'
import * as f from '../factories/index.ts'
import { controlerInvariants } from './invariants.ts'

const VOLUME = Number(process.env['JDD_PERF_VOLUME'] ?? 2000)
const SEUIL_MS = Number(process.env['JDD_SEUIL_MS'] ?? 3000)
const LONG = 900_000
const ctx = contexteReception()
const { db } = ctx
let repere: Repere
let total = 0
let headers: Record<string, string> = {}
let admin: Record<string, string> = {}
let multi: Record<string, string> = {}
let expe: Record<string, string> = {}
let cheq: Record<string, string> = {}
let atelierFixe = 0
let atelierScroll = 0
let depart = ''
let sample = { dossier: 0, trainId: '', theme: '' }
const mesures: {
  nom: string
  url: string
  min: number
  med: number
  max: number
  octets: number
}[] = []

beforeAll(async () => {
  await ctx.demarrer()
  repere = await relevoirRepere(db)
  const rapport = await genererJdd(
    ctx,
    { seed: 404, volume: VOLUME, scenarios: ['volumetrie'] },
    repere,
  )
  total = rapport.totalEnregistrements
  const s = await db.plateforme.findFirstOrThrow({
    where: { id: { gt: repere['tr_plateforme'] ?? 0 } },
    orderBy: { id: 'asc' },
  })
  atelierFixe = (await db.atelier.findFirstOrThrow({ where: { plateformeId: s.id, type: 'FIXE' } }))
    .id
  atelierScroll = (
    await db.atelier.findFirstOrThrow({ where: { plateformeId: s.id, type: 'SCROLL' } })
  ).id
  const coord = await db.utilisateur.findFirstOrThrow({
    where: {
      perimetres: { some: { plateformeId: s.id } },
      roles: { some: { role: { code: 'coord' } } },
    },
  })
  headers = devHeaders(coord.identifiantExterne)
  const a = await f.createUtilisateurAvecRoles(db, ['admin'], [])
  admin = devHeaders(a.identifiantExterne)
  // Coordinatrice / agent de réception des TROIS sites du JDD : les listes agrègent alors tout le volume.
  const sites = await db.plateforme.findMany({
    where: { id: { gt: repere['tr_plateforme'] ?? 0 } },
  })
  const m = await f.createUtilisateurAvecRoles(
    db,
    ['coord', 'recep'],
    sites.map((x) => ({ plateformeId: x.id })),
  )
  multi = devHeaders(m.identifiantExterne)
  const e = await db.utilisateur.findFirstOrThrow({
    where: {
      perimetres: { some: { plateformeId: s.id } },
      roles: { some: { role: { code: 'expe' } } },
    },
  })
  expe = devHeaders(e.identifiantExterne)
  const c = await db.utilisateur.findFirstOrThrow({
    where: {
      perimetres: { some: { plateformeId: s.id } },
      roles: { some: { role: { code: 'cheq' } } },
    },
  })
  cheq = devHeaders(c.identifiantExterne)
  const face = await db.faceTrain.findFirstOrThrow({ where: { atelierId: atelierScroll } })
  depart = formatSemaineIso({
    annee: face.depAnbas ?? semaineIsoDe(new Date()).annee,
    semaine: face.depSembas ?? 1,
  })
  sample = { dossier: face.contNum ?? 0, trainId: face.trainId ?? '', theme: face.theme ?? '' }
}, LONG)

afterAll(async () => {
  const r = await controlerInvariants(db, repere)
  const rest = r.violations
  await purger(db, repere)
  await ctx.arreter()
  const sortie = process.env['JDD_MESURES']
  if (sortie)
    writeFileSync(
      sortie,
      JSON.stringify(
        {
          volume: VOLUME,
          enregistrements: total,
          seuilMs: SEUIL_MS,
          invariantsViolees: rest.length,
          mesures,
        },
        null,
        2,
      ),
    )
  console.log(
    `MESURE-RESUME volume=${String(VOLUME)} enregistrements=${String(total)} seuil_ms=${String(SEUIL_MS)} invariants_violes=${String(rest.length)}`,
  )
  for (const m of mesures)
    console.log(
      `MESURE ${m.nom} | ${m.url} | min=${String(m.min)} med=${String(m.med)} max=${String(m.max)} ms | ${String(m.octets)} o`,
    )
}, LONG)

async function mesurer(
  nom: string,
  url: string,
  h = headers,
  methode: 'GET' | 'POST' = 'GET',
  payload?: object,
) {
  const t: number[] = []
  let octets = 0
  for (let i = 0; i < 3; i++) {
    const d = performance.now()
    const r = await ctx.app.inject({
      method: methode,
      url,
      headers:
        methode === 'POST'
          ? { ...h, 'idempotency-key': `perf-${nom}-${String(Date.now())}-${String(i)}` }
          : h,
      ...(payload ? { payload } : {}),
    })
    t.push(Math.round(performance.now() - d))
    expect(r.statusCode, `${nom} : ${r.body.slice(0, 300)}`).toBe(200)
    octets = r.body.length
  }
  t.sort((a, b) => a - b)
  const m = { nom, url, min: t[0] ?? 0, med: t[1] ?? 0, max: t[2] ?? 0, octets }
  mesures.push(m)
  expect(m.med, `${nom} : médiane ${String(m.med)} ms > seuil ${String(SEUIL_MS)} ms`).toBeLessThan(
    SEUIL_MS,
  )
}

describe('PERF listes et filtres sous volumétrie (API réelle, base de test)', () => {
  it('PERF-001 le JDD de volumétrie est en place (plusieurs milliers d’enregistrements)', () => {
    expect(total).toBeGreaterThan(Math.min(5000, VOLUME * 8))
  })

  it(
    'PERF-010 Réception : réceptions attendues (défaut, tous départs, recherche, filtre dossier, statuts, tri, page 2)',
    async () => {
      await mesurer('attendues-defaut', '/api/receptions-attendues')
      await mesurer(
        'attendues-tous',
        '/api/receptions-attendues?depart=tous&statut=tous&pageSize=200',
      )
      await mesurer(
        'attendues-page2',
        '/api/receptions-attendues?depart=tous&statut=tous&page=2&pageSize=100&sort=depart&ordre=desc',
      )
      await mesurer(
        'attendues-recherche',
        '/api/receptions-attendues?depart=tous&statut=tous&q=AQUALIA',
      )
      await mesurer(
        'attendues-dossier',
        `/api/receptions-attendues?depart=tous&statut=tous&dossier=${String(sample.dossier)}`,
      )
      await mesurer(
        'attendues-3-sites',
        '/api/receptions-attendues?depart=tous&statut=tous&pageSize=200',
        multi,
      )
      await mesurer('compteurs', '/api/reception/compteurs')
    },
    LONG,
  )

  it(
    'PERF-011 Réception : sas, affiches (liste, filtres, à traiter), inconnues, stock, alertes',
    async () => {
      await mesurer('sas', '/api/receptions/sas')
      await mesurer('affiches', '/api/affiches')
      await mesurer('affiches-a-traiter', '/api/affiches?aTraiter=oui')
      await mesurer('affiches-tag-a-controler', '/api/affiches?tag=A_CONTROLER')
      await mesurer('affiches-orphelines', '/api/affiches?tag=ORPHELINE')
      await mesurer('affiches-depart', `/api/affiches?depart=${depart}`)
      await mesurer('affiches-3-sites', '/api/affiches', multi)
      await mesurer('inconnues', '/api/receptions-inconnues')
      await mesurer('alertes-reception', '/api/alertes/reception')
    },
    LONG,
  )

  it(
    'PERF-020 Coordination : dossiers (défaut, filtres préparation / validation / à faire / page 2), alertes, validation admin',
    async () => {
      await mesurer('dossiers', '/api/coordination/dossiers')
      await mesurer('dossiers-prepa', '/api/coordination/dossiers?preparation=PREPARATION_RECUE')
      await mesurer('dossiers-va-a-confirmer', '/api/coordination/dossiers?va=A_CONFIRMER')
      await mesurer('dossiers-va-validee', '/api/coordination/dossiers?va=VALIDEE')
      await mesurer('dossiers-a-faire', '/api/coordination/dossiers?aFaire=A_FAIRE')
      await mesurer(
        'dossiers-dossier',
        `/api/coordination/dossiers?dossier=${String(sample.dossier)}`,
      )
      await mesurer(
        'dossiers-atelier',
        `/api/coordination/dossiers?atelierId=${String(atelierScroll)}`,
      )
      await mesurer('dossiers-3-sites', '/api/coordination/dossiers', multi)
      await mesurer('dossiers-admin-tous-sites', '/api/coordination/dossiers', admin)
      await mesurer('alertes', '/api/alertes')
      await mesurer('alertes-admin', '/api/alertes', admin)
      await mesurer('suivi-production', '/api/coordination/suivi-production')
      await mesurer('reservations', '/api/coordination/reservations')
    },
    LONG,
  )

  it(
    'PERF-021 Coordination : trains (liste, filtres), export (aperçu et simulation), suivi 8 m², dispatch, bagues',
    async () => {
      await mesurer('trains', `/api/coordination/trains?depart=${depart}`)
      await mesurer(
        'trains-atelier',
        `/api/coordination/trains?depart=${depart}&atelier=${String(atelierScroll)}`,
      )
      await mesurer(
        'trains-dossier',
        `/api/coordination/trains?depart=${depart}&dossier=${String(sample.dossier)}`,
      )
      await mesurer('train-fiche', `/api/coordination/trains/${sample.trainId}`)
      await mesurer('export-apercu', `/api/coordination/trains/export/apercu?depart=${depart}`)
      await mesurer('export-simulation', '/api/coordination/trains/export', headers, 'POST', {
        depart,
        simulation: true,
      })
      await mesurer('export-historique', '/api/coordination/trains/export/historique')
      await mesurer('suivi-8m2', `/api/coordination/trains/suivi-8m2?depart=${depart}`)
      await mesurer(
        'dispatch',
        `/api/coordination/dispatch?atelier=${String(atelierScroll)}&depart=${depart}`,
        cheq,
      )
      await mesurer(
        'bagues',
        `/api/coordination/bagues?atelier=${String(atelierScroll)}&depart=${depart}`,
        cheq,
      )
    },
    LONG,
  )

  it(
    'PERF-022 Coordination : unitaire (fixe), UM à coliser, colis, départs camions, fin de journée',
    async () => {
      await mesurer('unitaire', `/api/coordination/unitaire?atelier=${String(atelierFixe)}`)
      await mesurer(
        'unitaire-depart',
        `/api/coordination/unitaire?atelier=${String(atelierFixe)}&depart=${depart}`,
      )
      await mesurer(
        'unitaire-synthese',
        `/api/coordination/unitaire/synthese?atelier=${String(atelierFixe)}&depart=${depart}`,
      )
      await mesurer('colis', '/api/coordination/colis', expe)
      await mesurer('colis-a-coliser', '/api/coordination/colis/a-coliser', expe)
      await mesurer('colis-departs', '/api/coordination/colis/departs', expe)
      await mesurer('colis-expedies', '/api/coordination/colis?statut=A_EXPEDIER', expe)
    },
    LONG,
  )

  it(
    'PERF-023 Pilotage : alertes Pré-Prod, vérification des thèmes, déblocage',
    async () => {
      await mesurer('themes-proches', '/api/coordination/themes/proches')
      await mesurer('themes-annonceurs', '/api/coordination/themes/annonceurs')
      await mesurer('themes-broadcast', '/api/coordination/themes/broadcast')
      await mesurer('deblocage-suivi', '/api/coordination/deblocage/suivi')
    },
    LONG,
  )

  it(
    'PERF-024 écritures en masse (une mesure chacune) : validation admin en lot, export réel des trains, fin de journée',
    async () => {
      const dossiers = await db.dossier.findMany({
        where: { id: { gt: repere['dossier'] ?? 0 }, statut: 'PREPARATION_RECUE' },
        select: { id: true },
        take: 300,
      })
      const chrono = async (
        nom: string,
        url: string,
        h: Record<string, string>,
        payload: object,
      ) => {
        const d = performance.now()
        const r = await ctx.app.inject({
          method: 'POST',
          url,
          headers: { ...h, 'idempotency-key': `perf-ecr-${nom}` },
          payload,
        })
        const ms = Math.round(performance.now() - d)
        mesures.push({ nom, url, min: ms, med: ms, max: ms, octets: r.body.length })
        expect(ms, `${nom} : ${String(ms)} ms`).toBeLessThan(SEUIL_MS * 4)
        return r
      }
      const lot = await chrono(
        'validation-admin-lot-300-dossiers',
        '/api/coordination/validation-admin',
        headers,
        { dossierIds: dossiers.map((x) => x.id), sansDouteSeulement: true },
      )
      expect(lot.statusCode, lot.body.slice(0, 300)).toBe(200)
      const ex = await chrono('export-trains-reel', '/api/coordination/trains/export', headers, {
        depart,
        simulation: false,
      })
      expect(ex.statusCode, ex.body.slice(0, 300)).toBe(200)
      const fin = await chrono('fin-de-journee', '/api/coordination/colis/fin-de-journee', expe, {})
      expect(fin.statusCode, fin.body.slice(0, 300)).toBe(200)
    },
    LONG,
  )

  it(
    'PERF-030 après toutes ces lectures et écritures en masse, les invariants tiennent encore',
    async () => {
      const r = await controlerInvariants(db, repere)
      expect(r.violations).toEqual([])
    },
    LONG,
  )
})
