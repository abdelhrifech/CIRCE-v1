// COO-P06 — tests COMPLÉMENTAIRES de l'intégration Broadcast (integration-broadcast.int.test.ts n'est pas
// dupliqué). Source de l'attendu (les règles, pas le code) : docs/COORDINATION_REGLES_METIER.md RG-COO-080 à
// 083, 085, 087, 091 à 104, 115 à 134, §2 (profils × actions) ; hypothèses Q-188 (1) à (13), Q-187.
// Les règles de vie des lignes (RG-COO-080 à 100) sont testées ici via le PASSAGE d'intégration réel
// (route POST /api/coordination/integration/passages ou lancerPassage), jamais par appel direct.
// Données isolées : chaque test a ses plateformes / sites CCF / dossiers ; la passe RG-COO-087 touche toutes les
// lignes BC de la fenêtre, les assertions portent donc sur les données du test juste après ses passages.
// Les écarts constatés sont marqués `it.fails` avec leur n° ANO (non reportés dans RAPPORT_TESTS.md).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PassageIntegrationSchema,
  PassagesIntegrationSchema,
  RafraichirDossierResultatSchema,
  lundiSemaineIso,
  semaineIsoDe,
  type DestinataireBroadcast,
  type FaceBroadcast,
  type GroupePreparation,
  type LigneEtatReservations,
  type LotIntegration,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { BroadcastPort, MessageBroadcast } from '../../src/core/ports/broadcast.ts'
import { lancerPassage } from '../../src/modules/coordination/integration-broadcast.ts'
import { codeInstruction } from '../../src/modules/coordination/integration-flux.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { bonDeLivraison, contexteReception, erreur, get, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
// Un passage d'intégration lit tous les destinataires × ateliers et toutes les affiches de la base de test partagée
// (RG-COO-120, RG-COO-134) : sa durée croît avec les données des autres fichiers de tests (1 à 8 s en suite
// complète, 20 ms seul). Délai explicite pour ce fichier, plutôt que le délai par défaut de 5 s.
vi.setConfig({ testTimeout: 60_000 })
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>
const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const futur = (jours = 20) => new Date(Date.now() + jours * 86_400_000)

/** Adaptateur Broadcast en mémoire : lot à lire, messages envoyés, échec programmable. */
class BroadcastMemoire implements BroadcastPort {
  readonly nom = 'memoire'
  readonly configure = true
  envoyes: MessageBroadcast[] = []
  echouer = false
  constructor(
    public lot: LotIntegration = { idInterface: 1, lectureComplete: false, lueLe: new Date() },
  ) {}
  lireLot(): Promise<LotIntegration> {
    return Promise.resolve(this.lot)
  }
  envoyer(m: MessageBroadcast): Promise<void> {
    if (this.echouer) return Promise.reject(new Error('Broadcast indisponible'))
    this.envoyes.push(m)
    return Promise.resolve()
  }
}

/** Passage réel (orchestration complète : verrou, ordre, journal, flux, retour). */
const passer = (lot: Partial<LotIntegration>, port: BroadcastPort = new BroadcastMemoire()) =>
  lancerPassage(
    { db, broadcast: port },
    {
      declencheur: 'LOT',
      identity: null,
      lot: { idInterface: 1, lectureComplete: false, lueLe: new Date(), ...lot },
    },
  )

/** Passage par la route (Idempotency-Key de lot). */
const passerHttp = (headers: Headers, body: unknown, cle: Headers = idem()) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/coordination/integration/passages',
    headers: { ...headers, ...cle },
    payload: body as object,
  })

const restaurer: (() => Promise<unknown>)[] = []
async function parametre(cle: string, valeur: string) {
  const existant = await db.parametre.findFirst({ where: { cle, plateformeId: null } })
  if (existant) {
    await db.parametre.update({ where: { id: existant.id }, data: { valeur } })
    restaurer.push(() =>
      db.parametre.update({ where: { id: existant.id }, data: { valeur: existant.valeur } }),
    )
  } else {
    const p = await db.parametre.create({ data: { cle, valeur } })
    restaurer.push(() => db.parametre.delete({ where: { id: p.id } }))
  }
}
afterEach(async () => {
  while (restaurer.length > 0) await restaurer.pop()?.()
})

async function site() {
  const idSiteCcf = 30_000 + next()
  const plateforme = await f.createPlateforme(db, { idSiteCcf })
  const support = await f.createSupport(db)
  const idSurface = 700 + next()
  const idFormat = 1_100 + next()
  await db.correspondanceSupport.create({ data: { idSurface, idFormat, supportId: support.id } })
  const recep = await f.createUtilisateurAvecRoles(db, ['recep'], [{ plateformeId: plateforme.id }])
  return {
    plateforme,
    support,
    idSiteCcf,
    idSurface,
    idFormat,
    contNum: 900_000 + next(),
    recep: devHeaders(recep.identifiantExterne),
  }
}
type Site = Awaited<ReturnType<typeof site>>

function edr(s: Site, p: Partial<LigneEtatReservations> = {}): LigneEtatReservations {
  return {
    idSiteCcf: s.idSiteCcf,
    destinataire: 'Plateforme test',
    contNum: s.contNum,
    annonceur: 'ANNONCEUR C06',
    idSurface: s.idSurface,
    idFormat: s.idFormat,
    idPreparationChapeau: 77,
    idTypePreparation: 1,
    surface: '2m2',
    format: '120x176',
    idTheme: 5,
    theme: 'Thème A',
    idThemeBandeau: null,
    bandeau: null,
    idDaChapeau: 4242,
    semaine: plus(S, 1),
    quantite: 100,
    estResteEnPlace: false,
    statutPreparation: null,
    assistantCommercial: 'Dupont',
    assistantLogistique: 'Martin',
    ...p,
  }
}

function destinataire(p: Partial<DestinataireBroadcast> = {}): DestinataireBroadcast {
  return {
    type: 4,
    clePex: 950_000 + next(),
    nom: 'Afficheur Sud',
    adresse1: '1 rue B',
    adresse2: null,
    codePostal: '13001',
    localite: 'Marseille',
    lieuDit: null,
    pointRemise: null,
    mail: null,
    telephone: null,
    dateDebutPivot: new Date(Date.now() - 86_400_000),
    dateFinPivot: futur(),
    ...p,
  }
}

async function identiteDe(roles: Role[]) {
  const u = await f.createUtilisateurAvecRoles(db, roles, [])
  return { user: u, headers: devHeaders(u.identifiantExterne) }
}

const lignesDe = (contNum: number) =>
  db.receptionAttendue.findMany({ where: { contNum }, orderBy: { id: 'asc' } })
const actives = async (contNum: number) =>
  (await lignesDe(contNum)).filter((l) => l.etatLigne === 'ACTIVE')

/** Réception (REC-P04) d'une affiche sur une ligne ; `intitule` pour une ligne sans IP. */
async function recevoir(s: Site, ligneAttendueId: number, quantite = 10, intitule?: string) {
  const bl = await bonDeLivraison(ctx, s.recep, [
    { ligneAttendueId, quantite, ...(intitule ? { intituleSaisi: intitule } : {}) },
  ])
  const r = await post(ctx, '/api/receptions', s.recep, bl)
  expect(r.statusCode, r.body).toBe(201)
  const id = r.json<{ affiches: { id: number }[] }>().affiches[0]?.id
  if (id === undefined) throw new Error('aucune affiche')
  return id
}

/** Libère tout verrou laissé par un test (sécurité : le fichier suivant ne doit pas hériter d'un verrou). */
const libererVerrous = () =>
  db.passageIntegration.updateMany({
    where: { verrou: 'ACTIF' },
    data: { verrou: null, statut: 'ECHEC', fin: new Date() },
  })

// ───────────────── RG-COO-102 verrou, idempotence de lot ─────────────────

describe('RG-COO-102 verrou et idempotence du passage (complément)', () => {
  it('RG-COO-102 concurrence : deux passages lancés en même temps ⇒ un seul s’exécute, l’autre 409 COO_PASSAGE_EN_COURS', async () => {
    const s = await site()
    const lot = { etatReservations: [edr(s)] }
    const rs = await Promise.allSettled([passer(lot), passer(lot)])
    const ok = rs.filter((r) => r.status === 'fulfilled')
    const ko = rs.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(ko).toHaveLength(1)
    expect(ko[0]?.reason).toMatchObject({ httpStatus: 409, code: 'COO_PASSAGE_EN_COURS' })
    expect(await actives(s.contNum)).toHaveLength(1)
    expect(await db.passageIntegration.count({ where: { verrou: 'ACTIF' } })).toBe(0)
  })

  it('RG-COO-102 limite du verrou périmé (6 × délai, Q-188 (4)) : juste avant ⇒ 409 ; juste après ⇒ libéré', async () => {
    await parametre('integration.timeoutSecondes', '600')
    const debut = (minutes: number) => new Date(Date.now() - minutes * 60_000)
    const recent = await db.passageIntegration.create({
      data: { declencheur: 'PLANIFIE', statut: 'EN_COURS', verrou: 'ACTIF', debut: debut(59) },
    })
    try {
      await expect(passer({})).rejects.toMatchObject({ httpStatus: 409 })
      expect(
        await db.passageIntegration.findUniqueOrThrow({ where: { id: recent.id } }),
      ).toMatchObject({ verrou: 'ACTIF', statut: 'EN_COURS' })
      await db.passageIntegration.update({ where: { id: recent.id }, data: { debut: debut(61) } })
      const p = await passer({})
      expect(p.statut).toBe('SUCCES')
      expect(
        await db.passageIntegration.findUniqueOrThrow({ where: { id: recent.id } }),
      ).toMatchObject({
        verrou: null,
        statut: 'ECHEC',
        message: 'Passage interrompu (verrou périmé libéré).',
      })
    } finally {
      await libererVerrous()
    }
  })

  it('RG-COO-102 Idempotency-Key rejouée avec une autre requête ⇒ 409 COO_IDEMPOTENCE_CONFLIT, rien de plus', async () => {
    const { headers } = await identiteDe(['admin'])
    const cle = idem()
    const contNum = 930_000 + next()
    const envoi = (body: unknown) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/coordination/integration/rafraichir-dossier',
        headers: { ...headers, ...cle },
        payload: body as object,
      })
    expect((await envoi({ contNum })).statusCode).toBe(200)
    const r = await envoi({ contNum: contNum + 1 })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(
      await db.envoiBroadcast.count({
        where: { type: 'RAFRAICHIR_DOSSIER', cle: String(contNum + 1) },
      }),
    ).toBe(0)
  })

  it('RG-COO-102 une clé refusée (409, passage en cours) n’est pas gardée : rejouée après la fin du passage, elle lance le passage', async () => {
    const { user, headers } = await identiteDe(['admin'])
    const cle = idem()
    const enCours = await db.passageIntegration.create({
      data: { declencheur: 'PLANIFIE', statut: 'EN_COURS', verrou: 'ACTIF' },
    })
    try {
      expect((await passerHttp(headers, {}, cle)).statusCode).toBe(409)
      expect(
        await db.cleIdempotence.count({
          where: { utilisateurId: user.id, cle: cle['idempotency-key'] },
        }),
      ).toBe(0)
    } finally {
      await libererVerrous()
    }
    const r = await passerHttp(headers, {}, cle)
    expect(r.statusCode, r.body).toBe(200)
    // Passage lancé depuis la source : sans liaison Broadcast (Q-005), il échoue explicitement.
    expect(PassageIntegrationSchema.parse(r.json())).toMatchObject({
      declencheur: 'MANUEL',
      statut: 'ECHEC',
    })
    expect(enCours.id).toBeLessThan(r.json<{ id: number }>().id)
  })

  it('RG-COO-102 rejeu du MÊME lot (autre clé) : aucune ligne, quantité, répartition ni accusé de plus', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(atelier.id)}`)
    const idGroupe = 80_000 + next()
    const lot: Partial<LotIntegration> = {
      etatReservations: [edr(s, { semaine: plus(S, 1) })],
      preparations: [
        {
          idGroupe,
          idSiteCcf: s.idSiteCcf,
          statutBroadcast: 133,
          details: [
            {
              idPreparationDetail: 60_000 + next(),
              contNum: s.contNum,
              idTypePreparation: 1,
              supportId: s.support.id,
              destinataire: null,
              annonceur: 'ANNONCEUR C06',
              theme: 'Thème A',
              repiquage: null,
              repiquageId: null,
              quantite: 100,
              semaine: plus(S, 1),
              dateAffichage: null,
              numAfficheAmt: null,
              statutTravail: 0,
            },
          ],
        },
      ],
    }
    await passer(lot)
    const ligne1 = await actives(s.contNum)
    const p2 = await passer(lot)
    expect(p2.statut).toBe('SUCCES')
    const ligne2 = await actives(s.contNum)
    expect(ligne2.map((l) => [l.id, l.qteBc, l.qtePrepa])).toEqual(
      ligne1.map((l) => [l.id, l.qteBc, l.qtePrepa]),
    )
    expect(await db.repartition.count({ where: { idGroupePreparation: idGroupe } })).toBe(1)
    expect(
      await db.envoiBroadcast.count({ where: { type: 'ACCUSE_PREPA', cle: String(idGroupe) } }),
    ).toBe(1)
  })
})

// ───────────────── RG-COO-115 / 116 / 103 ordre, journal, alertes ─────────────────

describe('RG-COO-115 / RG-COO-116 / RG-COO-103 ordre, journal de chargement, alertes (complément)', () => {
  it('RG-COO-115 ordre fixe indépendant de l’ordre des clés du lot ; flux absents non journalisés, retour toujours en dernier', async () => {
    const p = await passer({ trains: [], destinataires: [] })
    expect(p.flux.map((x) => [x.flux, x.ordre])).toEqual([
      ['DESTINATAIRES', 2],
      ['TRAINS', 4],
      ['RETOUR_BROADCAST', 6],
    ])
    const seul = await passer({})
    expect(seul.flux.map((x) => x.flux)).toEqual(['RETOUR_BROADCAST'])
  })

  it('RG-COO-115 / 116 prérequis absent (IdInterface) via la source Broadcast : arrêt explicite, journalisé « Echec », aucun flux', async () => {
    const port = new BroadcastMemoire({
      idInterface: null,
      lectureComplete: false,
      lueLe: new Date(),
    })
    const p = await lancerPassage(
      { db, broadcast: port },
      { declencheur: 'PLANIFIE', identity: null },
    )
    expect(p).toMatchObject({ statut: 'ECHEC', message: 'IdInterface non récupéré !', flux: [] })
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: `passage:${String(p.id)}` },
    })
    expect(j).toMatchObject({ action: 'INTEGRATION_ECHEC', complement: 'RG-COO-116' })
    expect(await db.passageIntegration.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      verrou: null,
    })
  })

  it('RG-COO-116 journal par flux : début, fin, compteurs ; passage réussi journalisé avec son déclencheur', async () => {
    const s = await site()
    const p = await passer({
      etatReservations: [edr(s), edr(s, { theme: 'Thème B', idTheme: 6 })],
      destinataires: [destinataire(), destinataire({ dateFinPivot: new Date(Date.now() - 1000) })],
    })
    expect(p.statut).toBe('SUCCES')
    const [etat, dest] = p.flux
    expect(etat).toMatchObject({
      flux: 'ETAT_RESERVATIONS',
      statut: 0,
      lues: 2,
      creees: 2,
      erreurs: 0,
    })
    expect(dest).toMatchObject({
      flux: 'DESTINATAIRES',
      statut: 0,
      lues: 2,
      creees: 1,
      ignorees: 1,
    })
    for (const x of p.flux)
      expect(new Date(x.fin ?? 0).getTime()).toBeGreaterThanOrEqual(new Date(x.debut).getTime())
    expect(
      await db.journalAudit.findFirstOrThrow({ where: { entiteId: `passage:${String(p.id)}` } }),
    ).toMatchObject({ action: 'INTEGRATION_FLUX', nouvelleValeur: 'SUCCES', complement: 'LOT' })
  })

  it('RG-COO-116 / Q-188 (9) erreur d’UN groupe de préparation : groupe annulé seul, flux en succès avec erreurs, flux suivants exécutés', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(atelier.id)}`)
    const detail = (contNum: number, theme: string) => ({
      idPreparationDetail: 61_000 + next(),
      contNum,
      idTypePreparation: 1,
      supportId: s.support.id,
      destinataire: null,
      annonceur: 'A',
      theme,
      repiquage: null,
      repiquageId: null,
      quantite: 10,
      semaine: plus(S, 1),
      dateAffichage: null,
      numAfficheAmt: null,
      statutTravail: 0,
    })
    const bon = {
      idGroupe: 81_000 + next(),
      idSiteCcf: s.idSiteCcf,
      statutBroadcast: 133,
      details: [detail(s.contNum, 'OK')],
    }
    const mauvais = {
      idGroupe: 81_000 + next(),
      idSiteCcf: s.idSiteCcf,
      statutBroadcast: 133,
      details: [detail(s.contNum + 1, 'PANNE')],
    }
    const nom = `t_panne_grp_${String(next())}`
    await db.$executeRawUnsafe(
      `CREATE TRIGGER ${nom} BEFORE INSERT ON tf_repart_calcul WHEN NEW.rpc_theme = 'PANNE' BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`,
    )
    let p
    try {
      p = await passer({ preparations: [bon, mauvais], trains: [] })
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
    }
    expect(p.statut).toBe('SUCCES')
    expect(p.flux.find((x) => x.flux === 'PREPARATIONS')).toMatchObject({ statut: 0, erreurs: 1 })
    expect(p.flux.map((x) => x.flux)).toEqual(['PREPARATIONS', 'TRAINS', 'RETOUR_BROADCAST'])
    expect(await db.repartition.count({ where: { idGroupePreparation: bon.idGroupe } })).toBe(1)
    expect(await db.repartition.count({ where: { idGroupePreparation: mauvais.idGroupe } })).toBe(0)
    expect(await db.dossier.count({ where: { contNum: s.contNum + 1 } })).toBe(0)
    expect(
      await db.envoiBroadcast.count({
        where: { type: 'ACCUSE_PREPA', cle: String(mauvais.idGroupe) },
      }),
    ).toBe(0)
  })

  it('RG-COO-103 rejet : un échec précédé d’un succès ne lève pas l’alerte « deux échecs consécutifs »', async () => {
    await passer({})
    const port = new BroadcastMemoire({
      idInterface: null,
      lectureComplete: false,
      lueLe: new Date(),
    })
    const p = await lancerPassage(
      { db, broadcast: port },
      { declencheur: 'PLANIFIE', identity: null },
    )
    expect(p.statut).toBe('ECHEC')
    expect(
      await db.journalAudit.count({
        where: { action: 'ALERTE_INTEGRATION', entiteId: `passage:${String(p.id)}` },
      }),
    ).toBe(0)
    const p2 = await lancerPassage(
      { db, broadcast: port },
      { declencheur: 'PLANIFIE', identity: null },
    )
    expect(
      await db.journalAudit.count({
        where: { action: 'ALERTE_INTEGRATION', entiteId: `passage:${String(p2.id)}` },
      }),
    ).toBe(1)
    await passer({})
  })
})

// ───────────────── Permissions et entrées invalides ─────────────────

describe('RG-COO-103 / 116 / 132 permissions et entrées invalides (complément)', () => {
  it.each<Role>(['coord', 'admin'])(
    'RG-COO-116 journal des chargements consultable par le rôle %s (droit alimentation.manuelle)',
    async (role) => {
      const { headers } = await identiteDe([role])
      const r = await get(ctx, '/api/coordination/integration/passages', headers)
      expect(r.statusCode).toBe(200)
      expect(PassagesIntegrationSchema.parse(r.json()).passages.length).toBeLessThanOrEqual(30)
    },
  )

  it('RG-COO-103 / 132 rejet : utilisateur sans rôle ⇒ 403 (passage, journal, rafraîchir) ; sans authentification ⇒ 401', async () => {
    const { headers } = await identiteDe([])
    expect((await passerHttp(headers, {})).statusCode).toBe(403)
    expect((await get(ctx, '/api/coordination/integration/passages', headers)).statusCode).toBe(403)
    expect(
      (await post(ctx, '/api/coordination/integration/rafraichir-dossier', headers, { contNum: 1 }))
        .statusCode,
    ).toBe(403)
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/integration/passages' }))
        .statusCode,
    ).toBe(401)
    expect(
      (
        await ctx.app.inject({
          method: 'POST',
          url: '/api/coordination/integration/rafraichir-dossier',
          headers: idem(),
          payload: { contNum: 1 },
        })
      ).statusCode,
    ).toBe(401)
  })

  it.each<[string, unknown]>([
    ['idInterface absent', { lot: { lueLe: new Date().toISOString() } }],
    ['lueLe invalide', { lot: { idInterface: 1, lectureComplete: false, lueLe: 'hier' } }],
    [
      'colonne absente (RG-COO-092)',
      {
        lot: {
          idInterface: 1,
          lectureComplete: false,
          lueLe: new Date().toISOString(),
          etatReservations: [{ contNum: 1 }],
        },
      },
    ],
    [
      'quantité non entière',
      {
        lot: {
          idInterface: 1,
          lectureComplete: false,
          lueLe: new Date().toISOString(),
          destinataires: [{ type: 'x' }],
        },
      },
    ],
  ])(
    'Q-188 (1) aucun lot déposé par l’API, même invalide (%s) ⇒ 400, aucun passage',
    async (_cas, body) => {
      const { headers } = await identiteDe(['admin'])
      const avant = await db.passageIntegration.count()
      const r = await passerHttp(headers, body)
      expect(r.statusCode).toBe(400)
      expect(await db.passageIntegration.count()).toBe(avant)
    },
  )

  it.each<[string, unknown]>([
    ['0', { contNum: 0 }],
    ['négatif', { contNum: -5 }],
    ['texte', { contNum: 'abc' }],
    ['décimal', { contNum: 1.5 }],
  ])('RG-COO-132 n° de dossier invalide (%s) ⇒ 400, rien mis en file', async (_cas, body) => {
    const { headers } = await identiteDe(['coord'])
    const avant = await db.envoiBroadcast.count({ where: { type: 'RAFRAICHIR_DOSSIER' } })
    const r = await post(ctx, '/api/coordination/integration/rafraichir-dossier', headers, body)
    expect(r.statusCode).toBe(400)
    expect(await db.envoiBroadcast.count({ where: { type: 'RAFRAICHIR_DOSSIER' } })).toBe(avant)
  })

  it('RG-COO-132 idempotence : même clé deux fois ⇒ une seule demande, même réponse ; rejouée au passage suivant quand la liaison répond', async () => {
    // Administrateur : dossier pas encore intégré (Q-188 (15)).
    const { headers } = await identiteDe(['admin'])
    const contNum = 920_000 + next()
    const cle = idem()
    const envoi = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/coordination/integration/rafraichir-dossier',
        headers: { ...headers, ...cle },
        payload: { contNum },
      })
    const r1 = await envoi()
    const r2 = await envoi()
    expect(r1.statusCode, r1.body).toBe(200)
    expect(RafraichirDossierResultatSchema.parse(r2.json())).toEqual(r1.json())
    const demandes = await db.envoiBroadcast.findMany({
      where: { type: 'RAFRAICHIR_DOSSIER', cle: String(contNum) },
    })
    expect(demandes).toHaveLength(1)
    expect(demandes[0]?.statut).toBe('A_ENVOYER')
    const port = new BroadcastMemoire()
    await passer({}, port)
    expect(port.envoyes).toContainEqual({
      type: 'RAFRAICHIR_DOSSIER',
      cle: String(contNum),
      donnees: { contNum },
    })
    expect(
      (await db.envoiBroadcast.findUniqueOrThrow({ where: { id: demandes[0]?.id ?? 0 } })).statut,
    ).toBe('ENVOYE')
  })
})

// ───────────────── RG-COO-080 à 100 via le passage réel ─────────────────

describe('RG-COO-080 à 100 lignes attendues alimentées par le passage réel (complément)', () => {
  it('RG-COO-080 deux DA du même dossier / thème / semaine ⇒ une ligne, quantités additionnées ; rejeu ⇒ inchangée', async () => {
    const s = await site()
    const lot = {
      etatReservations: [
        edr(s, { idDaChapeau: 1, quantite: 60 }),
        edr(s, { idDaChapeau: 2, quantite: 40 }),
      ],
    }
    await passer(lot)
    await passer(lot)
    const ls = await actives(s.contNum)
    expect(ls).toHaveLength(1)
    expect(ls[0]?.qteBc).toBe(100)
  })

  it('RG-COO-081 site inconnu ou surface × format sans support : ligne écartée (donnée de référence journalisée), les autres lignes du dossier traitées', async () => {
    const s = await site()
    const p = await passer({
      etatReservations: [
        edr(s, { theme: 'Bonne' }),
        edr(s, { theme: 'Site inconnu', idTheme: 51, idSiteCcf: 1 }),
        edr(s, { theme: 'Format inconnu', idTheme: 52, idFormat: 1 }),
      ],
    })
    expect(p.flux[0]).toMatchObject({ flux: 'ETAT_RESERVATIONS', lues: 3, creees: 1, ignorees: 2 })
    expect((await actives(s.contNum)).map((l) => l.theme)).toEqual(['Bonne'])
    const refs = await db.journalAudit.findMany({
      where: { action: 'DONNEE_REFERENCE_MANQUANTE', donnees: { contains: String(s.contNum) } },
    })
    expect(refs.length).toBeGreaterThanOrEqual(2)
  })

  it('RG-COO-082 « reste en place » retiré de la quantité ; RG-COO-093 / 087 : dossier passé « Envoyé » jamais fermé par les passages suivants', async () => {
    const s = await site()
    await passer({
      etatReservations: [edr(s, { quantite: 80 }), edr(s, { quantite: 20, estResteEnPlace: true })],
    })
    expect((await actives(s.contNum))[0]?.qteBc).toBe(80)
    const envoye = { etatReservations: [edr(s, { statutPreparation: 'Envoyé' })] }
    await passer(envoye)
    await passer(envoye)
    expect(await actives(s.contNum)).toHaveLength(1)
  })

  it('RG-COO-083 année à 53 semaines (lecture du lundi 2026-12-28) : S53/2026 et S08/2027 alimentées, S09/2027 et S52 ignorées', async () => {
    const s = await site()
    const sem = (annee: number, semaine: number, theme: string, idTheme: number) =>
      edr(s, { semaine: { annee, semaine }, theme, idTheme })
    const p = await passer({
      lueLe: new Date('2026-12-28T09:00:00Z'),
      etatReservations: [
        sem(2026, 52, 'S52', 1),
        sem(2026, 53, 'S53', 2),
        sem(2027, 8, 'S08', 3),
        sem(2027, 9, 'S09', 4),
      ],
    })
    expect(p.statut).toBe('SUCCES')
    expect((await actives(s.contNum)).map((l) => l.theme).sort()).toEqual(['S08', 'S53'])
  })

  it('RG-COO-085 IP saisies par un passage suivant : provisoire fermée, affiche reçue déplacée vers la ligne du thème', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s, { theme: null, idTheme: null, semaine: S })] })
    const [p] = await actives(s.contNum)
    if (!p) throw new Error('provisoire absente')
    expect(p.provisoire).toBe(true)
    const afficheId = await recevoir(s, p.id, 10, 'Lu sur l’affiche')
    await passer({ etatReservations: [edr(s, { theme: 'Thème des IP', idTheme: 77, semaine: S })] })
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: p.id } })).etatLigne).toBe(
      'ANNULEE',
    )
    const [cible] = await actives(s.contNum)
    const lien = await db.afficheAttendue.findFirstOrThrow({ where: { afficheId, actif: true } })
    expect(lien.ligneAttendueId).toBe(cible?.id)
    expect(cible?.theme).toBe('Thème des IP')
  })

  it('RG-COO-087 ligne vue puis absente du dossier relu : marquée au 1er passage, fermée au 2e, jamais supprimée', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s), edr(s, { theme: 'Disparu', idTheme: 61 })] })
    const disparu = (await actives(s.contNum)).find((l) => l.theme === 'Disparu')
    if (!disparu) throw new Error('ligne absente')
    await passer({ etatReservations: [edr(s)] })
    expect(
      await db.receptionAttendue.findUniqueOrThrow({ where: { id: disparu.id } }),
    ).toMatchObject({ etatLigne: 'ACTIVE' })
    await passer({ etatReservations: [edr(s)] })
    expect(
      await db.receptionAttendue.findUniqueOrThrow({ where: { id: disparu.id } }),
    ).toMatchObject({ etatLigne: 'ANNULEE' })
    expect(await lignesDe(s.contNum)).toHaveLength(2)
  })

  it('RG-COO-094 / 096 prépa intégrée dans le même passage : ligne PREPA (Σ des détails), DA chapeau reprise de la copie lue juste avant', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(atelier.id)}`)
    const detail = (quantite: number) => ({
      idPreparationDetail: 62_000 + next(),
      contNum: s.contNum,
      idTypePreparation: 1,
      supportId: s.support.id,
      destinataire: null,
      annonceur: 'A',
      theme: 'Thème prépa seule',
      repiquage: null,
      repiquageId: null,
      quantite,
      semaine: plus(S, 1),
      dateAffichage: null,
      numAfficheAmt: null,
      statutTravail: 0,
    })
    const p = await passer({
      etatReservations: [edr(s, { idDaChapeau: 5151 })],
      preparations: [
        {
          idGroupe: 82_000 + next(),
          idSiteCcf: s.idSiteCcf,
          statutBroadcast: 133,
          details: [detail(30), detail(25)],
        },
      ],
    })
    expect(p.statut).toBe('SUCCES')
    const prepa = (await actives(s.contNum)).find((l) => l.theme === 'Thème prépa seule')
    expect(prepa).toMatchObject({
      source: 'PREPA',
      qtePrepa: 55,
      idDaChapeau: 5151,
      atelierId: atelier.id,
    })
  })

  it('RG-COO-095 bandeau : détail avec repiquage sur un support bandeau ⇒ ligne bandeau dédiée (support et n° de bandeau)', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const bandeau = await f.createSupport(db)
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(atelier.id)}`)
    await parametre('coordination.supportsBandeau', `${String(s.support.id)}:${String(bandeau.id)}`)
    await passer({
      preparations: [
        {
          idGroupe: 83_000 + next(),
          idSiteCcf: s.idSiteCcf,
          statutBroadcast: 133,
          details: [
            {
              idPreparationDetail: 63_000 + next(),
              contNum: s.contNum,
              idTypePreparation: 1,
              supportId: s.support.id,
              destinataire: null,
              annonceur: 'A',
              theme: 'Thème A',
              repiquage: 'Bandeau Z',
              repiquageId: 88,
              quantite: 12,
              semaine: plus(S, 1),
              dateAffichage: null,
              numAfficheAmt: null,
              statutTravail: 0,
            },
          ],
        },
      ],
    })
    const ls = await actives(s.contNum)
    expect(ls.find((l) => l.idThemeBandeau === 88)).toMatchObject({
      supportId: bandeau.id,
      theme: 'Bandeau Z',
      qtePrepa: 12,
    })
    expect(ls.find((l) => l.idThemeBandeau === null)).toMatchObject({
      theme: 'Thème A',
      qtePrepa: 12,
    })
  })

  it('RG-COO-098 / 100 même thème sur deux dossiers ⇒ une ligne par dossier ; un dossier sur deux plateformes ⇒ une ligne par plateforme', async () => {
    const s = await site()
    const deux = await site()
    await passer({
      etatReservations: [
        edr(s, { quantite: 10 }),
        edr(s, { contNum: s.contNum + 1, quantite: 20 }),
        edr(deux, { contNum: s.contNum, quantite: 30 }),
      ],
    })
    expect((await actives(s.contNum)).map((l) => [l.plateformeId, l.qteBc]).sort()).toEqual(
      [
        [s.plateforme.id, 10],
        [deux.plateforme.id, 30],
      ].sort(),
    )
    expect((await actives(s.contNum + 1)).map((l) => l.qteBc)).toEqual([20])
  })
})

// ───────────────── RG-COO-118 / 119 / 120 destinataires ─────────────────

describe('RG-COO-118 / 119 / 120 destinataires (complément)', () => {
  it('RG-COO-118 limites : début futur gardé ; fin = maintenant gardée ; sans fin et début passé ignoré ; annule et remplace (début le plus récent)', async () => {
    const maintenant = new Date()
    const ancien = destinataire({
      dateDebutPivot: new Date(Date.now() - 10 * 86_400_000),
      localite: 'Ancienne',
    })
    const recent = {
      ...ancien,
      dateDebutPivot: new Date(Date.now() - 86_400_000),
      localite: 'Récente',
    }
    const futurD = destinataire({ dateDebutPivot: futur(5), dateFinPivot: null })
    const sansFin = destinataire({ dateFinPivot: null })
    const p = await lancerPassage(
      { db, broadcast: new BroadcastMemoire() },
      {
        declencheur: 'LOT',
        identity: null,
        lot: {
          idInterface: 1,
          lectureComplete: false,
          lueLe: maintenant,
          destinataires: [ancien, recent, futurD, sansFin],
        },
      },
    )
    expect(p.flux[0]).toMatchObject({ flux: 'DESTINATAIRES', lues: 4, creees: 2, ignorees: 2 })
    const d = await db.destinataire.findFirstOrThrow({
      where: { desType: 4, desId: BigInt(ancien.clePex) },
      include: { adresses: true },
    })
    expect(d.adresses.map((a) => a.localite)).toEqual(['Récente'])
    expect(await db.destinataire.count({ where: { desId: BigInt(futurD.clePex) } })).toBe(1)
    expect(await db.destinataire.count({ where: { desId: BigInt(sansFin.clePex) } })).toBe(0)
  })

  it('RG-COO-119 les cinq types de destination sont des clés distinctes ; lieu-dit + point de remise tronqué à 50', async () => {
    const cle = 960_000 + next()
    const long = 'x'.repeat(60)
    await passer({
      destinataires: [1, 2, 3, 4, 5].map((type) =>
        destinataire({ type, clePex: cle, lieuDit: 'Lieu', pointRemise: long }),
      ),
    })
    const ds = await db.destinataire.findMany({
      where: { desId: BigInt(cle) },
      include: { adresses: true },
      orderBy: { desType: 'asc' },
    })
    expect(ds.map((d) => d.desType)).toEqual([1, 2, 3, 4, 5])
    expect(ds.every((d) => d.adresses[0]?.lieuDit?.length === 50)).toBe(true)
  })

  it('RG-COO-119 / Q-414 le mail et le téléphone édités à la main (D-05) ne sont pas écrasés par le flux ; un contact jamais édité est mis à jour', async () => {
    const admin = await identiteDe(['admin'])
    const edite = destinataire({ mail: 'flux@exemple.fr', telephone: '0100000000' })
    const intact = destinataire({ mail: 'flux2@exemple.fr', telephone: '0200000000' })
    await passer({ destinataires: [edite, intact] })
    const avant = await db.destinataire.findFirstOrThrow({
      where: { desId: BigInt(edite.clePex), desType: edite.type },
    })
    const r = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/coordination/destinataires/${String(avant.id)}`,
      headers: admin.headers,
      payload: { version: avant.version, mail: 'manuel@exemple.fr' },
    })
    expect(r.statusCode, r.body).toBe(200)
    await passer({
      destinataires: [
        { ...edite, mail: 'autre@exemple.fr', telephone: '0300000000' },
        { ...intact, mail: 'autre2@exemple.fr', telephone: '0400000000' },
      ],
    })
    const lire = (d: DestinataireBroadcast) =>
      db.destinataire.findFirstOrThrow({ where: { desId: BigInt(d.clePex), desType: d.type } })
    const e = await lire(edite)
    expect([e.mail, e.telephone, e.contactModifie]).toEqual([
      'manuel@exemple.fr',
      '0100000000',
      true,
    ])
    const i = await lire(intact)
    expect([i.mail, i.telephone, i.contactModifie]).toEqual([
      'autre2@exemple.fr',
      '0400000000',
      false,
    ])
  })

  it('RG-COO-120 atelier 0 jamais doté d’un transport ; un nouvel atelier reçoit sa ligne au passage suivant ; existante jamais modifiée', async () => {
    await parametre('integration.transportParAtelier', '*:1:CCF')
    const d = destinataire()
    await passer({ destinataires: [d] })
    const dest = await db.destinataire.findFirstOrThrow({
      where: { desType: 4, desId: BigInt(d.clePex) },
    })
    expect(
      await db.transportDestinataire.count({ where: { destinataireId: dest.id, atelierId: 0 } }),
    ).toBe(0)
    const nouvel = await f.createAtelier(db)
    expect(
      await db.transportDestinataire.count({
        where: { destinataireId: dest.id, atelierId: nouvel.id },
      }),
    ).toBe(0)
    await passer({ destinataires: [] })
    expect(
      await db.transportDestinataire.findMany({
        where: { destinataireId: dest.id, atelierId: nouvel.id },
      }),
    ).toMatchObject([{ transporteur: 1, tarif: 'CCF' }])
  })
})

// ───────────────── RG-COO-121 / 122 / 123 / 125 préparations ─────────────────

describe('RG-COO-121 / 122 / 123 / 125 préparations (complément)', () => {
  async function prepa() {
    const s = await site()
    const pliage = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const fixe = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routagePliage', `${String(s.idSiteCcf)}:${String(pliage.id)}`)
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(fixe.id)}`)
    return { ...s, pliage, fixe }
  }
  type Prepa = Awaited<ReturnType<typeof prepa>>
  const groupe = (
    s: Prepa,
    details: Partial<GroupePreparation['details'][number]>[],
    p: Partial<GroupePreparation> = {},
  ): GroupePreparation => ({
    idGroupe: 84_000 + next(),
    idSiteCcf: s.idSiteCcf,
    statutBroadcast: 133,
    details: details.map((d) => ({
      idPreparationDetail: 64_000 + next(),
      contNum: s.contNum,
      idTypePreparation: 1,
      supportId: s.support.id,
      destinataire: null,
      annonceur: 'A',
      theme: 'Thème A',
      repiquage: null,
      repiquageId: null,
      quantite: 40,
      semaine: plus(S, 1),
      dateAffichage: null,
      numAfficheAmt: null,
      statutTravail: 0,
      ...d,
    })),
    ...p,
  })

  it.each([17, 18, 19, 20, 21, 28])(
    'RG-COO-121 type de préparation déroulant %i exclu du flux fixe / pliage',
    async (type) => {
      const s = await prepa()
      const g = groupe(s, [{ idTypePreparation: type }])
      await passer({ preparations: [g] })
      expect(await db.repartition.count({ where: { idGroupePreparation: g.idGroupe } })).toBe(0)
    },
  )

  it('RG-COO-122 renvoi refusé ⇒ aucun accusé de plus ; RG-COO-123 groupe journalisé « partiel » (sans blocage)', async () => {
    const s = await prepa()
    const g = groupe(s, [{}])
    await passer({ preparations: [g] })
    const renvoi = { ...g, idGroupe: 84_000 + next() }
    const p = await passer({ preparations: [renvoi] })
    expect(p.statut).toBe('SUCCES')
    expect(p.flux[0]?.message).toContain('RG-COO-122')
    expect(
      await db.envoiBroadcast.count({
        where: { type: 'ACCUSE_PREPA', cle: String(renvoi.idGroupe) },
      }),
    ).toBe(0)
    expect(
      await db.journalAudit.findFirstOrThrow({
        where: {
          action: 'INTEGRATION_GROUPE_PREPARATION',
          entiteId: `groupe:${String(renvoi.idGroupe)}`,
        },
      }),
    ).toMatchObject({ nouvelleValeur: 'integration groupe de preparation partiel' })
    expect(
      await db.journalAudit.findFirstOrThrow({
        where: {
          action: 'INTEGRATION_GROUPE_PREPARATION',
          entiteId: `groupe:${String(g.idGroupe)}`,
        },
      }),
    ).toMatchObject({ nouvelleValeur: 'integration groupe de preparation' })
  })

  it('RG-COO-125 accusé en file puis envoyé dans le même passage quand Broadcast répond ; échec ⇒ rejoué au passage suivant, une seule fois envoyé', async () => {
    const s = await prepa()
    const g = groupe(s, [{}])
    const port = new BroadcastMemoire()
    port.echouer = true
    await passer({ preparations: [g] }, port)
    const accuse = await db.envoiBroadcast.findFirstOrThrow({
      where: { type: 'ACCUSE_PREPA', cle: String(g.idGroupe) },
    })
    expect(accuse).toMatchObject({ statut: 'A_ENVOYER', tentatives: 1 })
    expect(accuse.message).toBe('Broadcast indisponible')
    port.echouer = false
    await passer({}, port)
    await passer({}, port)
    expect(
      port.envoyes.filter((m) => m.type === 'ACCUSE_PREPA' && m.cle === String(g.idGroupe)),
    ).toHaveLength(1)
    expect(await db.envoiBroadcast.findUniqueOrThrow({ where: { id: accuse.id } })).toMatchObject({
      statut: 'ENVOYE',
      tentatives: 2,
    })
  })
})

// ───────────────── RG-COO-126 / 129 / 131 trains ─────────────────

describe('RG-COO-126 / 129 / 131 flux trains (complément)', () => {
  const face = (s: Site, contNum: number, p: Partial<FaceBroadcast> = {}): FaceBroadcast => ({
    idInterface: 70_000 + next(),
    contNum,
    annonceur: 'ANNONCEUR TRAINS',
    semaine: plus(S, 2),
    depart: plus(S, 2),
    dateDepart: futur(14),
    idSurface: s.idSurface,
    idSiteCcf: s.idSiteCcf,
    cadrIdent: 2_000 + next(),
    cadreLib: 'Cadre',
    theme: 'Thème T',
    themeId: 1,
    repiquage: null,
    repiquageId: null,
    supportId: s.support.id,
    destinataire: null,
    refPanel: null,
    afficheurId: null,
    afficheurNom: null,
    ftType: null,
    traitement: 'E',
    idTypeDestinationDa: 1,
    ...p,
  })

  // ANO-034 : RG-COO-129 (2) supprime les ANCIENNES faces (départ futur) du dossier / semaine avant de recréer
  // celles du lot ; RG-COO-129 « tf_face_train reflète Broadcast » et RG-COO-100 (dossier sur deux
  // plateformes). Corrigée : la suppression est faite une fois par dossier / semaine, avant l'insertion de
  // tous ses groupes (integration-flux.ts:supprimerFacesRemplacables).
  it('RG-COO-129 / 100 dossier déroulant sur deux ateliers (deux sites) dans le même lot : les faces des DEUX instructions sont intégrées (ANO-034)', async () => {
    const s1 = await site()
    const s2 = await site()
    const a1 = await f.createAtelier(db, { plateformeId: s1.plateforme.id, type: 'SCROLL' })
    const a2 = await f.createAtelier(db, { plateformeId: s2.plateforme.id, type: 'SCROLL' })
    await parametre(
      'integration.atelierDeroulant',
      `${String(s1.idSurface)}:${String(s1.idSiteCcf)}:${String(a1.id)};${String(s2.idSurface)}:${String(s2.idSiteCcf)}:${String(a2.id)}`,
    )
    const contNum = s1.contNum
    const p = await passer({
      trains: [
        face(s1, contNum),
        face(s1, contNum),
        face(s2, contNum),
        face(s2, contNum),
        face(s2, contNum),
      ],
    })
    expect(p.statut).toBe('SUCCES')
    const c1 = codeInstruction(plus(S, 2), a1.id, contNum)
    const c2 = codeInstruction(plus(S, 2), a2.id, contNum)
    expect(await db.faceTrain.count({ where: { instructionCode: c2 } })).toBe(3)
    expect(await db.faceTrain.count({ where: { instructionCode: c1 } })).toBe(2)
  })

  it('RG-COO-129 rejeu du même lot de faces : nombre de faces inchangé (remplacées, pas doublées)', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'SCROLL' })
    await parametre(
      'integration.atelierDeroulant',
      `${String(s.idSurface)}:${String(s.idSiteCcf)}:${String(atelier.id)}`,
    )
    const lot = { trains: [face(s, s.contNum), face(s, s.contNum)] }
    await passer(lot)
    await passer(lot)
    const code = codeInstruction(plus(S, 2), atelier.id, s.contNum)
    expect(await db.faceTrain.count({ where: { instructionCode: code } })).toBe(2)
    expect(await db.instruction.count({ where: { code } })).toBe(1)
  })

  it('RG-COO-129 (2) une face au départ PASSÉ (statut 0) n’est pas supprimée par le renvoi', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'SCROLL' })
    await parametre(
      'integration.atelierDeroulant',
      `${String(s.idSurface)}:${String(s.idSiteCcf)}:${String(atelier.id)}`,
    )
    const code = codeInstruction(plus(S, 2), atelier.id, s.contNum)
    await passer({ trains: [face(s, s.contNum)] })
    const passee = await f.createFaceTrain(db, {
      instructionCode: code,
      contNum: s.contNum,
      contAnbas: plus(S, 2).annee,
      contSembas: plus(S, 2).semaine,
      dateDepart: new Date(Date.now() - 86_400_000),
      statut: 'A_TRAITER',
    })
    await passer({ trains: [face(s, s.contNum)] })
    expect(await db.faceTrain.count({ where: { id: passee.id } })).toBe(1)
  })

  it('RG-COO-131 purge INTERFACE : seuls les Id du lot marqué (Traitement E, type de destination DA) sont demandés', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'SCROLL' })
    await parametre(
      'integration.atelierDeroulant',
      `${String(s.idSurface)}:${String(s.idSiteCcf)}:${String(atelier.id)}`,
    )
    const marquee = face(s, s.contNum)
    const nonMarquee = face(s, s.contNum, { traitement: '0' })
    const sansDa = face(s, s.contNum, { idTypeDestinationDa: null })
    const lueLe = new Date()
    const p = await passer({ lueLe, trains: [marquee, nonMarquee, sansDa] })
    expect(p.flux[0]).toMatchObject({ flux: 'TRAINS', lues: 3, creees: 1, ignorees: 2 })
    const purge = await db.envoiBroadcast.findFirstOrThrow({
      where: { type: 'PURGE_INTERFACE', cle: `trains:${lueLe.toISOString()}` },
    })
    expect(JSON.parse(purge.donnees)).toEqual({ flux: 'TRAINS', ids: [marquee.idInterface] })
  })
})

// ───────────────── RG-COO-134 retour vers Broadcast ─────────────────

describe('RG-COO-134 retour « reçue et associée » (complément)', () => {
  async function afficheSur(
    semaine: SemaineIso,
    o: { contNum?: number | null; idDaChapeau?: number | null; mouvement?: number } = {},
  ) {
    const s = await site()
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: o.contNum === undefined ? s.contNum : o.contNum,
      semAnnee: semaine.annee,
      semNum: semaine.semaine,
      idDaChapeau: o.idDaChapeau ?? null,
      // RG-COO-134 (a) : ligne non issue de Broadcast (prépa).
      source: 'PREPA',
    })
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, supportId: s.support.id })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite: 5 })
    if (o.mouvement !== undefined)
      await f.createMouvement(db, { afficheId: a.id, quantite: o.mouvement })
    return { s, a }
  }
  const messages = (afficheId: number) =>
    db.envoiBroadcast.findMany({
      where: { type: 'RETOUR_RECEPTION', cle: { startsWith: `${String(afficheId)}|` } },
      orderBy: { id: 'asc' },
    })

  it('RG-COO-134 limites de semaine : S-1 non exportée ; S exportée ; quantité 0 sans mouvement', async () => {
    const passee = await afficheSur(plus(S, -1), { idDaChapeau: 1 })
    const courante = await afficheSur(S, { idDaChapeau: 1 })
    await passer({})
    expect(await messages(passee.a.id)).toHaveLength(0)
    const [m] = await messages(courante.a.id)
    expect(JSON.parse(m?.donnees ?? '{}')).toMatchObject({ quantite: 0, estAssociee: false })
  })

  it('RG-COO-134 condition d’envoi : DA chapeau seule suffit ; dossier sans DA suffit ; ni l’un ni l’autre ⇒ écartée et journalisée', async () => {
    const daSeule = await afficheSur(plus(S, 1), { contNum: null, idDaChapeau: 9 })
    const dossierSeul = await afficheSur(plus(S, 1), { idDaChapeau: null })
    const aucun = await afficheSur(plus(S, 1), { contNum: null, idDaChapeau: null })
    await passer({})
    expect(await messages(daSeule.a.id)).toHaveLength(1)
    expect(await messages(dossierSeul.a.id)).toHaveLength(1)
    expect(await messages(aucun.a.id)).toHaveLength(0)
    const j = await db.journalAudit.findFirstOrThrow({
      where: { action: 'RETOUR_BROADCAST' },
      orderBy: { id: 'desc' },
    })
    expect(j.donnees).toContain(`"afficheId":${String(aucun.a.id)}`)
  })

  it('RG-COO-134 (b) affiche non liée présente dans les semaines de départ du dossier : exportée, EstAssociee faux', async () => {
    const s = await site()
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      validationAdmin: true,
    })
    await f.createAfficheSemaineDepart(db, {
      afficheId: a.id,
      annee: plus(S, 1).annee,
      semaine: plus(S, 1).semaine,
      dossier: s.contNum,
    })
    await passer({})
    const [m] = await messages(a.id)
    expect(JSON.parse(m?.donnees ?? '{}')).toMatchObject({
      contNum: s.contNum,
      estAssociee: false,
      idSiteCcf: s.idSiteCcf,
    })
  })

  it('RG-COO-134 / 024 changement non encore envoyé remplacé : seule la dernière valeur part ; « envoyé » jamais remis à faux', async () => {
    const { a } = await afficheSur(plus(S, 1), { idDaChapeau: 3, mouvement: 5 })
    const port = new BroadcastMemoire()
    port.echouer = true
    await passer({}, port)
    await db.affiche.update({ where: { id: a.id }, data: { validationAdmin: true } })
    await passer({}, port)
    const ms = await messages(a.id)
    expect(ms.map((m) => m.statut)).toEqual(['REMPLACE', 'A_ENVOYER'])
    port.echouer = false
    await passer({}, port)
    const envoyes = port.envoyes.filter(
      (m) => m.type === 'RETOUR_RECEPTION' && m.cle.startsWith(`${String(a.id)}|`),
    )
    expect(envoyes).toHaveLength(1)
    expect(envoyes[0]?.donnees).toMatchObject({ estAssociee: true })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).envoye).toBe(true)
    // Annulation de la validation : nouveau message (EstAssociee faux) ; le drapeau « envoyé » reste vrai.
    await db.affiche.update({ where: { id: a.id }, data: { validationAdmin: false } })
    port.echouer = true
    await passer({}, port)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).envoye).toBe(true)
    expect((await messages(a.id)).at(-1)).toMatchObject({ statut: 'A_ENVOYER' })
  })
})
