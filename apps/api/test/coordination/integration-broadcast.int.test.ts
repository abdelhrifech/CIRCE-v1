// COO-P06 — intégration Broadcast : passage (verrou, ordre fixe, journal de chargement, délai), flux état des
// réservations (copie + lignes attendues), destinataires, préparations fixe / pliage, trains, instructions,
// annulations, retour « reçue et associée », messages vers Broadcast, « Rafraîchir un dossier ».
// Source réelle Broadcast : Q-005 (BLOQUÉ) ; contrat d'entrée : HYPOTHÈSE Q-188 (1).
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
  type InstructionLue,
  type LigneEtatReservations,
  type LotIntegration,
  type SemaineIso,
} from '@circe/shared'
import type { Identity } from '../../src/core/identity.ts'
import type { BroadcastPort, MessageBroadcast } from '../../src/core/ports/broadcast.ts'
import {
  alertesIntegration,
  demarrerPlanificateur,
  lancerPassage,
  rafraichirDossier,
} from '../../src/modules/coordination/integration-broadcast.ts'
import { alertesAlimentation } from '../../src/modules/coordination/alimentation-lignes.ts'
import { codeInstruction } from '../../src/modules/coordination/integration-flux.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { contexteReception, erreur, get, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
// Un passage d'intégration lit tous les destinataires × ateliers et toutes les affiches de la base de test partagée
// (RG-COO-120, RG-COO-134) : sa durée croît avec les données des autres fichiers de tests (1 à 8 s en suite
// complète, 20 ms seul). Délai explicite pour ce fichier, plutôt que le délai par défaut de 5 s.
vi.setConfig({ testTimeout: 60_000 })
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const futur = (jours = 20) => new Date(Date.now() + jours * 86_400_000)

/** Adaptateur Broadcast en mémoire (tests) : lot à lire, messages envoyés, échecs programmés. */
class BroadcastMemoire implements BroadcastPort {
  readonly nom = 'memoire'
  readonly configure = true
  envoyes: MessageBroadcast[] = []
  echouer = false
  constructor(
    public lot: LotIntegration | (() => Promise<unknown>) = {
      idInterface: 1,
      lectureComplete: false,
      lueLe: new Date(),
    },
  ) {}
  lireLot(): Promise<LotIntegration> {
    return typeof this.lot === 'function'
      ? (this.lot() as Promise<LotIntegration>)
      : Promise.resolve(this.lot)
  }
  envoyer(m: MessageBroadcast): Promise<void> {
    if (this.echouer) return Promise.reject(new Error('Broadcast indisponible'))
    this.envoyes.push(m)
    return Promise.resolve()
  }
}

const passer = (lot: Partial<LotIntegration>, port = new BroadcastMemoire()) =>
  lancerPassage(
    { db, broadcast: port },
    {
      declencheur: 'LOT',
      identity: null,
      lot: { idInterface: 1, lectureComplete: false, lueLe: new Date(), ...lot },
    },
  )

// Paramètres globaux modifiés par un test, restaurés après (fichiers d'intégration exécutés en série).
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

/** Plateforme gérée par Broadcast (site CCF unique) avec support et correspondance surface × format. */
async function site() {
  const idSiteCcf = 20_000 + next()
  const plateforme = await f.createPlateforme(db, { idSiteCcf })
  const support = await f.createSupport(db)
  const idSurface = 600 + next()
  const idFormat = 1_000 + next()
  await db.correspondanceSupport.create({ data: { idSurface, idFormat, supportId: support.id } })
  return { plateforme, support, idSiteCcf, idSurface, idFormat, contNum: 800_000 + next() }
}
type Site = Awaited<ReturnType<typeof site>>

function edr(s: Site, p: Partial<LigneEtatReservations> = {}): LigneEtatReservations {
  return {
    idSiteCcf: s.idSiteCcf,
    destinataire: 'Plateforme test',
    contNum: s.contNum,
    annonceur: 'ANNONCEUR P06',
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

async function identiteDe(roles: Parameters<typeof f.createUtilisateurAvecRoles>[1]) {
  const u = await f.createUtilisateurAvecRoles(db, roles, [])
  return { user: u, headers: devHeaders(u.identifiantExterne) }
}

describe('RG-COO-102 / 103 / 115 / 116 — passage : droits, verrou, prérequis, journal', () => {
  it('RG-COO-103 passage manuel par l’administrateur ; sans source Broadcast (Q-005) : échec journalisé', async () => {
    const { headers } = await identiteDe(['admin'])
    const r = await post(ctx, '/api/coordination/integration/passages', headers, {})
    expect(r.statusCode, r.body).toBe(200)
    const p = PassageIntegrationSchema.parse(r.json())
    expect(p).toMatchObject({ declencheur: 'MANUEL', statut: 'ECHEC' })
    expect(p.message).toContain('Q-005')
    expect(p.flux).toHaveLength(0)
  })

  it('RG-COO-103 / RG-COO-165 refuse le passage manuel aux autres profils, Coordination comprise (403, Q-189) ; journal refusé hors coord / admin', async () => {
    for (const role of ['coord', 'cheq', 'recep', 'expe', 'com'] as const) {
      const { headers } = await identiteDe([role])
      const r = await post(ctx, '/api/coordination/integration/passages', headers, {})
      expect(r.statusCode, role).toBe(403)
      expect(erreur(r).code).toBe('PERMISSION')
      const g = await get(ctx, '/api/coordination/integration/passages', headers)
      expect(g.statusCode, role).toBe(role === 'coord' ? 200 : 403)
    }
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/integration/passages',
      payload: {},
    })
    expect(r.statusCode).toBe(401)
  })

  it('RG-COO-102 un seul passage à la fois : 409 si un passage est en cours ; verrou périmé libéré', async () => {
    const { headers } = await identiteDe(['admin'])
    const enCours = await db.passageIntegration.create({
      data: { declencheur: 'PLANIFIE', statut: 'EN_COURS', verrou: 'ACTIF' },
    })
    try {
      const r = await post(ctx, '/api/coordination/integration/passages', headers, {})
      expect(r.statusCode).toBe(409)
      expect(erreur(r)).toMatchObject({ code: 'COO_PASSAGE_EN_COURS', regle: 'RG-COO-102' })
      await expect(passer({})).rejects.toMatchObject({ httpStatus: 409 })
    } finally {
      await db.passageIntegration.update({
        where: { id: enCours.id },
        data: { verrou: null, statut: 'ECHEC', fin: new Date() },
      })
    }
    // Verrou laissé par un arrêt du serveur, au-delà de 6 × le délai : libéré, le passage tourne.
    const vieux = await db.passageIntegration.create({
      data: {
        declencheur: 'PLANIFIE',
        statut: 'EN_COURS',
        verrou: 'ACTIF',
        debut: new Date(Date.now() - 48 * 3600 * 1000),
      },
    })
    const p = await passer({})
    expect(p.statut).toBe('SUCCES')
    expect(
      await db.passageIntegration.findUniqueOrThrow({ where: { id: vieux.id } }),
    ).toMatchObject({ statut: 'ECHEC', verrou: null })
  })

  it('RG-COO-102 Idempotency-Key : la même clé rejoue le passage manuel sans en lancer un autre', async () => {
    const { headers } = await identiteDe(['admin'])
    const cle = idem()
    const avant = await db.passageIntegration.count()
    const r1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/integration/passages',
      headers: { ...headers, ...cle },
      payload: {},
    })
    const r2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/integration/passages',
      headers: { ...headers, ...cle },
      payload: {},
    })
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.headers['idempotent-replayed']).toBe('true')
    expect(r2.json<{ id: number }>().id).toBe(r1.json<{ id: number }>().id)
    expect(await db.passageIntegration.count()).toBe(avant + 1)
    const sansCle = await post(ctx, '/api/coordination/integration/passages', headers, {}, false)
    expect(sansCle.statusCode).toBe(400)
  })

  it('Q-188 (1) / RG-COO-103 aucun lot déposé par l’API : un corps avec `lot` est refusé (400), aucun passage', async () => {
    const { headers } = await identiteDe(['admin'])
    const avant = await db.passageIntegration.count()
    const r = await post(ctx, '/api/coordination/integration/passages', headers, {
      lot: { idInterface: 1, lectureComplete: true, lueLe: new Date().toISOString() },
    })
    expect(r.statusCode).toBe(400)
    expect(await db.passageIntegration.count()).toBe(avant)
  })

  it('RG-COO-115 sans interface de chargement : arrêt « IdInterface non récupéré ! » avant tout flux', async () => {
    const s = await site()
    const p = await lancerPassage(
      { db, broadcast: new BroadcastMemoire() },
      {
        declencheur: 'LOT',
        identity: null,
        lot: {
          idInterface: null,
          lectureComplete: false,
          lueLe: new Date(),
          etatReservations: [edr(s)],
        },
      },
    )
    expect(p).toMatchObject({ statut: 'ECHEC', message: 'IdInterface non récupéré !' })
    expect(p.flux).toHaveLength(0)
    expect(await db.receptionAttendue.count({ where: { contNum: s.contNum } })).toBe(0)
  })

  it('RG-COO-104 / RG-COO-115 / 116 cinq flux dans l’ordre fixe et journal de chargement (statut 0 = succès)', async () => {
    const p = await passer({
      instructions: [],
      trains: [],
      preparations: [],
      destinataires: [],
      etatReservations: [],
    })
    expect(p.statut).toBe('SUCCES')
    expect(p.flux.map((x) => x.flux)).toEqual([
      'ETAT_RESERVATIONS',
      'DESTINATAIRES',
      'PREPARATIONS',
      'TRAINS',
      'INSTRUCTIONS',
      'RETOUR_BROADCAST',
    ])
    expect(p.flux.every((x) => x.statut === 0 && x.fin !== null)).toBe(true)
  })

  it('RG-COO-116 / 103 un flux en échec (statut 2) arrête les suivants, les précédents restent ; deux échecs → alerte technique', async () => {
    const s = await site()
    await db.$executeRawUnsafe(
      `CREATE TRIGGER t_echec_dest BEFORE INSERT ON tr_destinataire BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`,
    )
    try {
      const lot = {
        etatReservations: [edr(s)],
        destinataires: [
          {
            type: 4,
            clePex: 900_000 + next(),
            nom: 'Afficheur X',
            adresse1: null,
            adresse2: null,
            codePostal: null,
            localite: null,
            lieuDit: null,
            pointRemise: null,
            mail: null,
            telephone: null,
            dateDebutPivot: new Date(Date.now() - 86_400_000),
            dateFinPivot: futur(),
          },
        ],
        preparations: [],
      }
      const p1 = await passer(lot)
      expect(p1.statut).toBe('ECHEC')
      expect(p1.message).toContain('DESTINATAIRES')
      expect(p1.flux.map((x) => [x.flux, x.statut])).toEqual([
        ['ETAT_RESERVATIONS', 0],
        ['DESTINATAIRES', 2],
      ])
      // Message nettoyé : la cause, sans l'appel Prisma ni le code source cités.
      expect(p1.flux[1]?.message).toBeTruthy()
      expect(p1.flux[1]?.message).not.toContain('Invalid `')
      // Le flux précédent reste validé (pas de transaction globale).
      expect(await db.receptionAttendue.count({ where: { contNum: s.contNum } })).toBe(1)
      const alertes1 = await alertesIntegration(db)
      expect(alertes1[0]).toMatchObject({ type: 'ECHEC' })
      expect(alertes1[0]?.message).toContain('DESTINATAIRES')
      const avant = alertes1.filter((a) => a.type === 'ECHECS_CONSECUTIFS').length
      const p2 = await passer(lot)
      expect(p2.statut).toBe('ECHEC')
      const consecutifs = (await alertesIntegration(db)).filter(
        (a) => a.type === 'ECHECS_CONSECUTIFS',
      )
      expect(consecutifs.length).toBe(avant + 1)
      expect(consecutifs[0]?.regle).toBe('RG-COO-103')
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER t_echec_dest')
    }
  })

  it('RG-COO-092 lecture chez Broadcast avec une colonne absente : refusée, erreur de lecture explicite (aucune valeur par défaut)', async () => {
    const invalide = new BroadcastMemoire(() =>
      Promise.resolve({
        idInterface: 1,
        lectureComplete: false,
        lueLe: new Date(),
        etatReservations: [{ contNum: 1 }],
      }),
    )
    const p = await lancerPassage(
      { db, broadcast: invalide },
      { declencheur: 'PLANIFIE', identity: null },
    )
    expect(p.statut).toBe('ECHEC')
    expect(p.message).toContain('Lecture Broadcast invalide')
  })

  it('RG-COO-117 lecture chez Broadcast au-delà du délai paramétré : échec explicite « délai dépassé »', async () => {
    await parametre('integration.timeoutSecondes', '1')
    const lent = new BroadcastMemoire(
      () =>
        new Promise((resoudre) => {
          setTimeout(() => {
            resoudre({ idInterface: 1 })
          }, 3_000)
        }),
    )
    const p2 = await lancerPassage(
      { db, broadcast: lent },
      { declencheur: 'PLANIFIE', identity: null },
    )
    expect(p2).toMatchObject({ statut: 'ECHEC', message: 'Délai de lecture Broadcast dépassé.' })
  }, 10_000)

  it('RG-COO-103 journal des passages et horaires ; le planificateur ne démarre pas sans source (Q-005)', async () => {
    const { headers } = await identiteDe(['coord'])
    const r = await get(ctx, '/api/coordination/integration/passages', headers)
    expect(r.statusCode).toBe(200)
    const j = PassagesIntegrationSchema.parse(r.json())
    expect(j.horaires).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'])
    expect(j.planificateurActif).toBe(false)
    expect(j.passages.length).toBeGreaterThan(0)
    const avant = await db.passageIntegration.count()
    const arreter = demarrerPlanificateur(
      {
        db,
        broadcast: {
          configure: false,
          nom: 'x',
          lireLot: () => Promise.reject(new Error('x')),
          envoyer: () => Promise.resolve(),
        },
      },
      () => undefined,
    )
    arreter()
    expect(await db.passageIntegration.count()).toBe(avant)
  })
})

describe('RG-COO-091 / 092 / 093 — flux état des réservations', () => {
  it('RG-COO-091 / 092 copie du dossier = image de la lecture (colonnes conservées, date vue) et lignes attendues alimentées', async () => {
    const s = await site()
    await f.createPrepaBroadcast(db, { idDossierDeVenteChapeau: s.contNum, theme: 'Ancien' })
    const p = await passer({
      etatReservations: [
        edr(s),
        edr(s, { theme: 'Thème B', idTheme: 6, idThemeBandeau: 9, bandeau: 'Bd' }),
      ],
    })
    expect(p.statut).toBe('SUCCES')
    const copie = await db.prepaBroadcast.findMany({
      where: { idDossierDeVenteChapeau: s.contNum },
      orderBy: { id: 'asc' },
    })
    expect(copie.map((c) => c.theme)).toEqual(['Thème A', 'Thème B'])
    expect(copie[0]).toMatchObject({
      idSiteCcf: s.idSiteCcf,
      idSurface: s.idSurface,
      idFormat: s.idFormat,
      idPreparationChapeau: 77,
      idTypePreparation: 1,
      idTheme: 5,
      estResteEnPlace: false,
      supportId: s.support.id,
      assistantCommercial: 'Dupont',
    })
    expect(copie[1]?.idThemeBandeau).toBe(9)
    expect(copie.every((c) => c.dateVue !== null)).toBe(true)
    const lignes = await db.receptionAttendue.findMany({ where: { contNum: s.contNum } })
    expect(lignes).toHaveLength(2)
    expect(lignes.every((l) => l.source === 'BC' && l.idDaChapeau === 4242)).toBe(true)
    // RG-COO-063 / Q-188 (3) : le dossier est créé « À traiter ».
    expect(await db.dossier.findUnique({ where: { contNum: s.contNum } })).toMatchObject({
      statut: 'A_TRAITER',
      annonceur: 'ANNONCEUR P06',
    })
    expect(p.flux[0]).toMatchObject({ flux: 'ETAT_RESERVATIONS', lues: 2, creees: 2 })
  })

  it('RG-COO-091 rejeu de la même lecture : aucune ligne ni quantité en plus (RG-COO-102)', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s)] })
    await passer({ etatReservations: [edr(s)] })
    const lignes = await db.receptionAttendue.findMany({ where: { contNum: s.contNum } })
    expect(lignes).toHaveLength(1)
    expect(lignes[0]?.qteBc).toBe(100)
    expect(await db.prepaBroadcast.count({ where: { idDossierDeVenteChapeau: s.contNum } })).toBe(1)
  })

  it('RG-COO-091 panne en milieu de dossier : ce dossier est annulé sans ligne partielle, les autres poursuivent', async () => {
    const a = await site()
    const b = await site()
    await f.createPrepaBroadcast(db, { idDossierDeVenteChapeau: a.contNum, theme: 'Gardée' })
    await db.$executeRawUnsafe(
      `CREATE TRIGGER t_panne_copie BEFORE INSERT ON tf_prepa_Broadcast WHEN NEW.Theme = 'PANNE' BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`,
    )
    try {
      const p = await passer({
        etatReservations: [edr(a), edr(a, { theme: 'PANNE', idTheme: 99 }), edr(b)],
      })
      expect(p.statut).toBe('SUCCES')
      expect(p.flux[0]).toMatchObject({ erreurs: 1 })
      expect(p.flux[0]?.message).toContain('1 dossier(s) en erreur')
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER t_panne_copie')
    }
    // Dossier A : rien d'écrit (copie d'avant conservée, aucune ligne attendue, aucun dossier).
    const copieA = await db.prepaBroadcast.findMany({
      where: { idDossierDeVenteChapeau: a.contNum },
    })
    expect(copieA.map((c) => c.theme)).toEqual(['Gardée'])
    expect(await db.receptionAttendue.count({ where: { contNum: a.contNum } })).toBe(0)
    expect(await db.dossier.count({ where: { contNum: a.contNum } })).toBe(0)
    expect(await db.receptionAttendue.count({ where: { contNum: b.contNum } })).toBe(1)
  })

  it('RG-COO-091 / 087 dossier absent de la lecture : ligne BC marquée « plus vue », puis fermée (jamais supprimée)', async () => {
    const s = await site()
    const autre = await site()
    await passer({ etatReservations: [edr(s)] })
    await passer({ etatReservations: [edr(autre)], lectureComplete: true })
    let [l] = await db.receptionAttendue.findMany({ where: { contNum: s.contNum } })
    expect(l).toMatchObject({ etatLigne: 'ACTIVE' })
    expect(l?.nonVueLe).not.toBeNull()
    await passer({ etatReservations: [edr(autre)], lectureComplete: true })
    ;[l] = await db.receptionAttendue.findMany({ where: { contNum: s.contNum } })
    expect(l?.etatLigne).toBe('ANNULEE')
  })

  it('RG-COO-087 / 091 lot PARTIEL (lecture incomplète de la fenêtre) : aucune ligne d’un dossier absent marquée ni fermée', async () => {
    const s = await site()
    const autre = await site()
    await passer({ etatReservations: [edr(s)], lectureComplete: true })
    await passer({ etatReservations: [edr(autre)], lectureComplete: false })
    await passer({ etatReservations: [edr(autre)], lectureComplete: false })
    const [l] = await db.receptionAttendue.findMany({ where: { contNum: s.contNum } })
    expect(l).toMatchObject({ etatLigne: 'ACTIVE', nonVueLe: null })
  })

  it('RG-COO-091 lecture vide : rien n’est écrit (aucune ligne fermée)', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s)] })
    await passer({ etatReservations: [] })
    await passer({ etatReservations: [] })
    const [l] = await db.receptionAttendue.findMany({ where: { contNum: s.contNum } })
    expect(l).toMatchObject({ etatLigne: 'ACTIVE', nonVueLe: null })
  })

  it('RG-COO-093 prépa « Envoyé » ou destinataire exclu : ligne non créée, sans alerte', async () => {
    const s = await site()
    const p = await passer({
      etatReservations: [
        edr(s, { statutPreparation: 'Envoyé' }),
        edr(s, { theme: 'Thème Z', idTheme: 8, destinataire: 'Plateforme Derichebourg' }),
      ],
    })
    expect(p.flux[0]).toMatchObject({ lues: 2, creees: 0, ignorees: 2 })
    expect(await db.receptionAttendue.count({ where: { contNum: s.contNum } })).toBe(0)
  })
})

function destinataire(p: Partial<DestinataireBroadcast> = {}): DestinataireBroadcast {
  return {
    type: 4,
    clePex: 900_000 + next(),
    nom: 'Afficheur Nord',
    adresse1: '1 rue A',
    adresse2: null,
    codePostal: '75001',
    localite: 'Paris',
    lieuDit: 'Zone',
    pointRemise: 'Quai 2',
    mail: 'a@example.test',
    telephone: null,
    dateDebutPivot: new Date(Date.now() - 86_400_000),
    dateFinPivot: futur(),
    ...p,
  }
}

describe('RG-COO-118 / 119 / 120 — flux destinataires', () => {
  it('RG-COO-119 crée le destinataire (actif, dispatch O) et son adresse ; RG-COO-118 période échue ignorée', async () => {
    const d = destinataire()
    const echu = destinataire({ dateFinPivot: new Date(Date.now() - 3_600_000) })
    const p = await passer({ destinataires: [d, echu] })
    expect(p.flux[0]).toMatchObject({ flux: 'DESTINATAIRES', lues: 2, creees: 1, ignorees: 1 })
    const cree = await db.destinataire.findFirstOrThrow({
      where: { desType: 4, desId: BigInt(d.clePex) },
      include: { adresses: true },
    })
    expect(cree).toMatchObject({ actif: true, dispatch: 'O', nomOrigine: 'Afficheur Nord' })
    expect(cree.adresses).toHaveLength(1)
    expect(cree.adresses[0]).toMatchObject({ localite: 'Paris', lieuDit: 'Zone Quai 2' })
    expect(await db.destinataire.count({ where: { desId: BigInt(echu.clePex) } })).toBe(0)
  })

  it('RG-COO-119 adresse mise à jour seulement si le nom correspond ; clé (PEX, TYPE) ; jamais désactivé', async () => {
    const d = destinataire()
    await passer({ destinataires: [d] })
    await passer({ destinataires: [{ ...d, localite: 'Lyon' }] })
    let x = await db.destinataire.findFirstOrThrow({
      where: { desType: 4, desId: BigInt(d.clePex) },
      include: { adresses: true },
    })
    expect(x.adresses[0]?.localite).toBe('Lyon')
    await passer({ destinataires: [{ ...d, nom: 'Autre nom', localite: 'Nice' }] })
    x = await db.destinataire.findFirstOrThrow({
      where: { desType: 4, desId: BigInt(d.clePex) },
      include: { adresses: true },
    })
    expect(x.adresses).toHaveLength(1)
    expect(x.adresses[0]?.localite).toBe('Lyon')
    // Même clé PEX, autre type (site / plateforme partagent IdSiteCCF) : un AUTRE destinataire.
    await passer({ destinataires: [{ ...d, type: 2 }] })
    expect(await db.destinataire.count({ where: { desId: BigInt(d.clePex) } })).toBe(2)
    // Absent du flux suivant : ni désactivé ni supprimé.
    await passer({ destinataires: [] })
    expect(
      await db.destinataire.findFirstOrThrow({ where: { desType: 4, desId: BigInt(d.clePex) } }),
    ).toMatchObject({ actif: true })
  })

  it('RG-COO-120 transporteur et tarif par défaut pour chaque destinataire × atelier sans ligne', async () => {
    const a1 = await f.createAtelier(db)
    const a2 = await f.createAtelier(db)
    await parametre('integration.transportParAtelier', `${String(a1.id)}:2:X24;*:1:CCF`)
    const d = destinataire()
    await passer({ destinataires: [d] })
    const dest = await db.destinataire.findFirstOrThrow({
      where: { desType: 4, desId: BigInt(d.clePex) },
    })
    const t = await db.transportDestinataire.findMany({ where: { destinataireId: dest.id } })
    expect(t.find((x) => x.atelierId === a1.id)).toMatchObject({ transporteur: 2, tarif: 'X24' })
    expect(t.find((x) => x.atelierId === a2.id)).toMatchObject({ transporteur: 1, tarif: 'CCF' })
    // Ligne existante : jamais modifiée ni doublée.
    await db.transportDestinataire.updateMany({
      where: { destinataireId: dest.id, atelierId: a1.id },
      data: { tarif: 'MANUEL' },
    })
    await passer({ destinataires: [d] })
    const t2 = await db.transportDestinataire.findMany({
      where: { destinataireId: dest.id, atelierId: a1.id },
    })
    expect(t2).toHaveLength(1)
    expect(t2[0]?.tarif).toBe('MANUEL')
  })
})

describe('RG-COO-121 à 125 / 063 / 086 — flux préparation fixe / pliage', () => {
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
    idGroupe: 70_000 + next(),
    idSiteCcf: s.idSiteCcf,
    statutBroadcast: 133,
    details: details.map((d) => ({
      idPreparationDetail: 50_000 + next(),
      contNum: s.contNum,
      idTypePreparation: 1,
      supportId: s.support.id,
      destinataire: null,
      annonceur: 'ANNONCEUR P06',
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

  it('RG-COO-121 routage : type 23 → pliage, autres → 2 m² fixe, lignes « À traiter » ; déroulant et ligne annulée exclus', async () => {
    const s = await prepa()
    const g = groupe(s, [
      { idTypePreparation: 23 },
      { idTypePreparation: 1, theme: 'Thème B' },
      { idTypePreparation: 28 },
      { statutTravail: 4 },
    ])
    const p = await passer({ preparations: [g] })
    expect(p.flux.find((x) => x.flux === 'PREPARATIONS')).toMatchObject({
      lues: 4,
      creees: 2,
      ignorees: 2,
    })
    const reps = await db.repartition.findMany({
      where: { idGroupePreparation: g.idGroupe },
      orderBy: { id: 'asc' },
    })
    expect(reps.map((r) => [r.atelierId, r.statut])).toEqual([
      [s.pliage.id, 'A_TRAITER'],
      [s.fixe.id, 'A_TRAITER'],
    ])
  })

  it('RG-COO-121 groupe hors site géré ou non « envoyé » (≠ 133) : rien n’est intégré', async () => {
    const s = await prepa()
    const p = await passer({
      preparations: [groupe(s, [{}], { statutBroadcast: 100 }), groupe(s, [{}], { idSiteCcf: 1 })],
    })
    expect(p.flux.find((x) => x.flux === 'PREPARATIONS')).toMatchObject({ creees: 0, ignorees: 2 })
    expect(await db.repartition.count({ where: { contNum: s.contNum } })).toBe(0)
  })

  it('RG-COO-121 site sans atelier de routage : ligne créée à l’atelier 0, donnée de référence signalée', async () => {
    const s = await prepa()
    await parametre('integration.routageFixe', '')
    await passer({ preparations: [groupe(s, [{ idTypePreparation: 1 }])] })
    const [r] = await db.repartition.findMany({ where: { contNum: s.contNum } })
    expect(r?.atelierId).toBeNull()
    const alertes = await alertesAlimentation(db, null)
    expect(
      alertes.some((a) => a.type === 'DONNEE_REFERENCE_MANQUANTE' && a.contNum === s.contNum),
    ).toBe(true)
  })

  it('RG-COO-063 / 086 / 042 la prépa passe le dossier « Préparation reçue » et bascule la ligne attendue en PREPA', async () => {
    const s = await prepa()
    await passer({ etatReservations: [edr(s, { theme: 'Thème A', quantite: 50 })] })
    const g = groupe(s, [{ idTypePreparation: 1, theme: 'Thème A', quantite: 40 }])
    const p = await passer({ preparations: [g] })
    expect(p.statut).toBe('SUCCES')
    expect(await db.dossier.findUniqueOrThrow({ where: { contNum: s.contNum } })).toMatchObject({
      statut: 'PREPARATION_RECUE',
    })
    const [l] = await db.receptionAttendue.findMany({
      where: { contNum: s.contNum, etatLigne: 'ACTIVE' },
    })
    expect(l).toMatchObject({ source: 'PREPA', qtePrepa: 40, qteBc: 50 })
    // RG-COO-123 : suivi par groupe journalisé.
    const j = await db.journalAudit.findFirst({
      where: { action: 'INTEGRATION_GROUPE_PREPARATION', entiteId: `groupe:${String(g.idGroupe)}` },
    })
    expect(j?.nouvelleValeur).toBe('integration groupe de preparation')
  })

  it('RG-COO-122 prépa renvoyée alors que la précédente n’est pas annulée : non intégrée, tracée et signalée ; intégrée après annulation', async () => {
    const s = await prepa()
    const g = groupe(s, [{ idTypePreparation: 1 }])
    await passer({ preparations: [g] })
    const p2 = await passer({ preparations: [g] })
    const fl = p2.flux.find((x) => x.flux === 'PREPARATIONS')
    expect(fl).toMatchObject({ creees: 0 })
    expect(fl?.message).toContain('RG-COO-122')
    expect(await db.repartition.count({ where: { contNum: s.contNum } })).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { action: 'PREPA_RENVOYEE_NON_INTEGREE', entiteId: String(s.contNum) },
      }),
    ).toBe(1)
    // RG-COO-123 : groupe « partiel ».
    const j = await db.journalAudit.findFirst({
      where: { action: 'INTEGRATION_GROUPE_PREPARATION', entiteId: `groupe:${String(g.idGroupe)}` },
      orderBy: { id: 'desc' },
    })
    expect(j?.nouvelleValeur).toBe('integration groupe de preparation partiel')
    await db.repartition.updateMany({ where: { contNum: s.contNum }, data: { statut: 'ANNULE' } })
    await passer({ preparations: [g] })
    expect(await db.repartition.count({ where: { contNum: s.contNum, statut: 'A_TRAITER' } })).toBe(
      1,
    )
  })

  it('RG-COO-125 accusé « intégré » envoyé à Broadcast après l’intégration ; en échec, rejoué au passage suivant', async () => {
    const s = await prepa()
    const port = new BroadcastMemoire()
    port.echouer = true
    const g = groupe(s, [{}])
    const p = await passer({ preparations: [g] }, port)
    expect(p.statut).toBe('SUCCES')
    const e = await db.envoiBroadcast.findFirstOrThrow({
      where: { type: 'ACCUSE_PREPA', cle: String(g.idGroupe) },
    })
    expect(e).toMatchObject({ statut: 'A_ENVOYER', tentatives: 1 })
    expect(e.message).toContain('Broadcast indisponible')
    // Circé a intégré malgré l'échec de l'accusé (pas de transaction distribuée).
    expect(await db.repartition.count({ where: { idGroupePreparation: g.idGroupe } })).toBe(1)
    port.echouer = false
    await passer({}, port)
    expect(await db.envoiBroadcast.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({
      statut: 'ENVOYE',
    })
    expect(
      port.envoyes.some((m) => m.type === 'ACCUSE_PREPA' && m.cle === String(g.idGroupe)),
    ).toBe(true)
  })

  it('RG-COO-116 / 125 intégration d’un groupe en échec : rien n’est envoyé à Broadcast pour ce groupe (ni accusé)', async () => {
    const s = await prepa()
    const port = new BroadcastMemoire()
    const g = groupe(s, [{ theme: 'PANNE' }])
    await db.$executeRawUnsafe(
      `CREATE TRIGGER t_panne_repart BEFORE INSERT ON tf_repart_calcul WHEN NEW.rpc_theme = 'PANNE' BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`,
    )
    let p
    try {
      p = await passer({ preparations: [g] }, port)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER t_panne_repart')
    }
    expect(p.flux.find((x) => x.flux === 'PREPARATIONS')).toMatchObject({ erreurs: 1, creees: 0 })
    expect(await db.repartition.count({ where: { idGroupePreparation: g.idGroupe } })).toBe(0)
    expect(
      await db.envoiBroadcast.count({ where: { type: 'ACCUSE_PREPA', cle: String(g.idGroupe) } }),
    ).toBe(0)
    expect(
      port.envoyes.some((m) => m.type === 'ACCUSE_PREPA' && m.cle === String(g.idGroupe)),
    ).toBe(false)
  })

  it('RG-COO-125 aucun accusé pour un groupe dont rien n’a été intégré', async () => {
    const s = await prepa()
    const g = groupe(s, [{ statutTravail: 4 }])
    await passer({ preparations: [g] })
    expect(
      await db.envoiBroadcast.count({ where: { type: 'ACCUSE_PREPA', cle: String(g.idGroupe) } }),
    ).toBe(0)
  })
})

describe('RG-COO-126 / 127 / 129 / 130 / 131 — flux trains', () => {
  async function deroulant() {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id, type: 'SCROLL' })
    await parametre(
      'integration.atelierDeroulant',
      `${String(s.idSurface)}:${String(s.idSiteCcf)}:${String(atelier.id)}`,
    )
    return { ...s, atelier }
  }
  type Deroulant = Awaited<ReturnType<typeof deroulant>>
  const face = (s: Deroulant, p: Partial<FaceBroadcast> = {}): FaceBroadcast => ({
    idInterface: 60_000 + next(),
    contNum: s.contNum,
    annonceur: 'ANNONCEUR TRAINS',
    semaine: plus(S, 2),
    depart: plus(S, 2),
    dateDepart: futur(14),
    idSurface: s.idSurface,
    idSiteCcf: s.idSiteCcf,
    cadrIdent: 1_000 + next(),
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

  it('RG-COO-126 / 127 / 129 (5) atelier déduit, code d’instruction, chapeau « À traiter » créé, faces « À traiter »', async () => {
    const s = await deroulant()
    const p = await passer({ trains: [face(s), face(s), face(s, { traitement: '0' })] })
    const code = codeInstruction(plus(S, 2), s.atelier.id, s.contNum)
    expect(await db.instruction.findUniqueOrThrow({ where: { code } })).toMatchObject({
      statut: 'A_TRAITER',
      atelierId: s.atelier.id,
      typeInstruction: 'contrat',
    })
    const faces = await db.faceTrain.findMany({ where: { instructionCode: code } })
    expect(faces).toHaveLength(2)
    expect(faces.every((x) => x.statut === 'A_TRAITER' && x.atelierId === s.atelier.id)).toBe(true)
    expect(p.flux.find((x) => x.flux === 'TRAINS')).toMatchObject({
      lues: 3,
      creees: 2,
      ignorees: 1,
    })
  })

  it('RG-COO-126 surface / site sans atelier : code « C000 », donnée de référence signalée', async () => {
    const s = await deroulant()
    await passer({ trains: [face(s, { idSurface: 1 })] })
    const code = codeInstruction(plus(S, 2), null, s.contNum)
    expect(code).toContain('C000')
    expect(await db.instruction.findUnique({ where: { code } })).not.toBeNull()
  })

  it('RG-COO-129 un renvoi remplace les faces 0 / 1 / 3 / 4 au départ futur ; les faces engagées restent', async () => {
    const s = await deroulant()
    await passer({ trains: [face(s), face(s)] })
    const code = codeInstruction(plus(S, 2), s.atelier.id, s.contNum)
    const [engagee] = await db.faceTrain.findMany({ where: { instructionCode: code } })
    await db.faceTrain.update({ where: { id: engagee?.id }, data: { statut: 'A_IMPRIMER' } })
    await passer({ trains: [face(s, { theme: 'Nouveau' })] })
    const faces = await db.faceTrain.findMany({ where: { instructionCode: code } })
    expect(faces.map((x) => [x.statut, x.theme]).sort()).toEqual([
      ['A_IMPRIMER', 'Thème T'],
      ['A_TRAITER', 'Nouveau'],
    ])
  })

  it('RG-COO-129 (1) / 053 instruction au-delà de « En cours » : faces non réintégrées, renvoi tracé', async () => {
    const s = await deroulant()
    await passer({ trains: [face(s)] })
    const code = codeInstruction(plus(S, 2), s.atelier.id, s.contNum)
    await db.instruction.update({ where: { code }, data: { statut: 'INSTRUCTION_OK' } })
    const p = await passer({ trains: [face(s, { theme: 'Renvoi' })] })
    expect(p.flux.find((x) => x.flux === 'TRAINS')).toMatchObject({ creees: 0, ignorees: 1 })
    const faces = await db.faceTrain.findMany({ where: { instructionCode: code } })
    expect(faces.map((x) => x.theme)).toEqual(['Thème T'])
    expect(
      await db.journalAudit.count({ where: { action: 'RENVOI_BROADCAST_IGNORE', entiteId: code } }),
    ).toBe(1)
  })

  it('RG-COO-130 une nouvelle face reprend l’afficheur des faces engagées du même panel ; les faces 0 / 1 suivent', async () => {
    const s = await deroulant()
    const panel = `PANEL-${String(next())}`
    const instr = await f.createInstruction(db)
    await f.createFaceTrain(db, {
      instructionCode: instr.code,
      statut: 'A_IMPRIMER',
      refPanel: panel,
      contAnbas: plus(S, 2).annee,
      contSembas: plus(S, 2).semaine,
      afficheurId: 11,
      afficheurNom: 'Équipe Onze',
    })
    await passer({
      trains: [face(s, { refPanel: panel, afficheurId: 22, afficheurNom: 'Équipe 22' })],
    })
    const code = codeInstruction(plus(S, 2), s.atelier.id, s.contNum)
    const [nouvelle] = await db.faceTrain.findMany({ where: { instructionCode: code } })
    expect(nouvelle).toMatchObject({ afficheurId: 11, afficheurNom: 'Équipe Onze' })
    // Panel sans face engagée : les faces 0 / 1 du même panel reprennent l'afficheur inséré.
    const panel2 = `PANEL-${String(next())}`
    const attente = await f.createFaceTrain(db, {
      instructionCode: instr.code,
      statut: 'EN_COURS',
      refPanel: panel2,
      contAnbas: plus(S, 2).annee,
      contSembas: plus(S, 2).semaine,
      afficheurId: 1,
    })
    await passer({
      trains: [
        face(s, {
          refPanel: panel2,
          afficheurId: 33,
          afficheurNom: 'Équipe 33',
          contNum: s.contNum,
        }),
      ],
    })
    expect(await db.faceTrain.findUniqueOrThrow({ where: { id: attente.id } })).toMatchObject({
      afficheurId: 33,
      afficheurNom: 'Équipe 33',
    })
  })

  it('RG-COO-116 / 131 flux trains en échec : aucune purge côté INTERFACE, flux suivants non exécutés', async () => {
    const s = await deroulant()
    const port = new BroadcastMemoire()
    const f1 = face(s)
    const purgesAvant = await db.envoiBroadcast.count({ where: { type: 'PURGE_INTERFACE' } })
    await db.$executeRawUnsafe(
      `CREATE TRIGGER t_panne_purge BEFORE INSERT ON envoi_broadcast WHEN NEW.type = 'PURGE_INTERFACE' BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`,
    )
    let p
    try {
      p = await passer({ trains: [f1], instructions: [] }, port)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER t_panne_purge')
    }
    expect(p.statut).toBe('ECHEC')
    expect(p.flux.map((x) => [x.flux, x.statut])).toEqual([['TRAINS', 2]])
    expect(await db.envoiBroadcast.count({ where: { type: 'PURGE_INTERFACE' } })).toBe(purgesAvant)
    expect(port.envoyes).toEqual([])
    // Les faces intégrées restent ; le lot non purgé sera renvoyé et réintégré sans doublon (RG-COO-102).
    await passer({ trains: [f1] }, port)
    const code = codeInstruction(plus(S, 2), s.atelier.id, s.contNum)
    expect(await db.faceTrain.count({ where: { instructionCode: code } })).toBe(1)
  })

  /** Panel déjà présent pour le dossier (instruction distincte, faces non remplacées par un renvoi). */
  async function panelExistant(
    s: Deroulant,
    statuts: ('INSTRUCTION_OK' | 'A_IMPRIMER')[],
    depart: Date,
  ) {
    const panel = `PANEL-${String(next())}`
    const instr = await f.createInstruction(db)
    const faces = []
    for (const statut of statuts)
      faces.push(
        await f.createFaceTrain(db, {
          instructionCode: instr.code,
          statut,
          refPanel: panel,
          contNum: s.contNum,
          contAnbas: plus(S, 2).annee,
          contSembas: plus(S, 2).semaine,
          dateDepart: depart,
          afficheurId: 1,
          afficheurNom: 'Équipe Un',
        }),
      )
    return { panel, faces }
  }
  const updateRessource = (panel: string) =>
    db.journalAudit.count({
      where: {
        action: 'INTEGRATION_FACES',
        entiteId: `panel:${panel}`,
        nouvelleValeur: 'UpdateRessource',
      },
    })

  it('RG-COO-130 (UpdateRessource) panel dont toutes les faces sont aux statuts 0 à 4 : ressource reçue reportée sur tout le panel', async () => {
    const s = await deroulant()
    const depart = futur(14)
    const { panel, faces } = await panelExistant(s, ['INSTRUCTION_OK'], depart)
    await passer({
      trains: [
        face(s, {
          refPanel: panel,
          dateDepart: depart,
          afficheurId: 44,
          afficheurNom: 'Équipe 44',
        }),
      ],
    })
    const tout = await db.faceTrain.findMany({ where: { refPanel: panel } })
    expect(tout).toHaveLength(2)
    expect(tout.every((x) => x.afficheurId === 44 && x.afficheurNom === 'Équipe 44')).toBe(true)
    const existante = tout.find((x) => x.id === faces[0]?.id)
    expect(existante?.version).toBe((faces[0]?.version ?? 0) + 1)
    expect(await updateRessource(panel)).toBe(1)
  })

  it('RG-COO-130 (UpdateRessource) panel avec une face au-delà du statut 4 : aucune ressource modifiée par panel', async () => {
    const s = await deroulant()
    const depart = futur(14)
    const { panel, faces } = await panelExistant(s, ['INSTRUCTION_OK', 'A_IMPRIMER'], depart)
    await passer({
      trains: [
        face(s, {
          refPanel: panel,
          dateDepart: depart,
          afficheurId: 55,
          afficheurNom: 'Équipe 55',
        }),
      ],
    })
    for (const x of faces)
      expect(await db.faceTrain.findUniqueOrThrow({ where: { id: x.id } })).toMatchObject({
        afficheurId: 1,
        afficheurNom: 'Équipe Un',
      })
    expect(await updateRessource(panel)).toBe(0)
  })

  it('RG-COO-131 seuls les Id intégrés sont purgés côté INTERFACE ; un dossier en erreur reste pour le passage suivant', async () => {
    const s = await deroulant()
    const ok = face(s)
    const autre = await deroulant()
    const ko = face(autre, { cadreLib: 'PANNE' })
    await db.$executeRawUnsafe(
      `CREATE TRIGGER t_panne_face BEFORE INSERT ON tf_face_train WHEN NEW.cadre_lib = 'PANNE' BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`,
    )
    let p
    try {
      p = await passer({ trains: [ok, ko] })
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER t_panne_face')
    }
    expect(p.flux.find((x) => x.flux === 'TRAINS')).toMatchObject({ erreurs: 1, creees: 1 })
    const purge = await db.envoiBroadcast.findFirstOrThrow({
      where: { type: 'PURGE_INTERFACE' },
      orderBy: { id: 'desc' },
    })
    const ids = (JSON.parse(purge.donnees) as { ids: number[] }).ids
    expect(ids).toContain(ok.idInterface)
    expect(ids).not.toContain(ko.idInterface)
    // Le dossier en erreur n'a rien d'écrit (ni chapeau ni face).
    expect(await db.faceTrain.count({ where: { contNum: autre.contNum } })).toBe(0)
  })
})

describe('RG-COO-041 / 128 / 062 — flux instructions et annulations', () => {
  const instruction = (s: Site, p: Partial<InstructionLue> = {}): InstructionLue => ({
    idInterface: 40_000 + next(),
    type: 'contrat',
    contNum: s.contNum,
    semaine: plus(S, 2),
    idSurface: s.idSurface,
    idSiteCcf: s.idSiteCcf,
    annonceur: 'ANNONCEUR INSTR',
    commentaire: 'Début de train',
    sectCodeCentre: 1,
    talrTrait: '1',
    entretien: null,
    origine: null,
    details: [
      {
        cadrIdent: 1,
        cadreLib: 'C',
        supportId: null,
        idTypePreparation: 21,
        afchIdent: 1,
        theme: 'T',
        repiquageIdent: null,
        repiquage: null,
        type: null,
      },
    ],
    visuels: [{ afchIdent: 1, supportId: null, theme: 'T', pourcentage: 100 }],
    ...p,
  })

  it('RG-COO-041 / 128 instruction intégrée « En cours », types de visuels forcés (référentiel vérifié)', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const tprScro = await f.createTypePreparation(db)
    const tprVenusial = await f.createTypePreparation(db)
    const sup26 = await f.createSupport(db)
    const sup1026 = await f.createSupport(db)
    await parametre(
      'integration.atelierDeroulant',
      `${String(s.idSurface)}:${String(s.idSiteCcf)}:${String(atelier.id)}`,
    )
    await parametre(
      'integration.typesVisuels',
      `visuel:${String(tprScro.id)}:${String(sup26.id)};bdx:999999;detail21:${String(tprVenusial.id)}:${String(sup1026.id)};detail:${String(tprScro.id)}`,
    )
    const p = await passer({ instructions: [instruction(s)] })
    expect(p.flux.find((x) => x.flux === 'INSTRUCTIONS')).toMatchObject({ creees: 1 })
    const code = codeInstruction(plus(S, 2), atelier.id, s.contNum)
    const i = await db.instruction.findUniqueOrThrow({
      where: { code },
      include: { visuels: true, details: true },
    })
    expect(i).toMatchObject({ statut: 'EN_COURS', entretien: 8, atelierId: atelier.id })
    expect(i.visuels[0]).toMatchObject({ typePreparationId: tprScro.id, supportId: sup26.id })
    expect(i.details[0]).toMatchObject({ typePreparationId: tprVenusial.id, supportId: sup1026.id })
  })

  it('RG-COO-128 type forcé absent du référentiel (contrat « bdx ») : rien d’inventé, null et donnée de référence signalée', async () => {
    await parametre('integration.typesVisuels', 'visuel:999998:999997;bdx:999999;detail:999998')
    const s2 = await site()
    await passer({ instructions: [instruction(s2, { origine: 'bdx' })] })
    const i2 = await db.instruction.findFirstOrThrow({
      where: { contNum: s2.contNum },
      include: { visuels: true, details: true },
    })
    expect(i2.visuels[0]).toMatchObject({ typePreparationId: null, supportId: null })
    expect(i2.details[0]?.typePreparationId).toBeNull()
    expect(
      (await alertesAlimentation(db, null)).some(
        (a) => a.type === 'DONNEE_REFERENCE_MANQUANTE' && a.contNum === s2.contNum,
      ),
    ).toBe(true)
  })

  it('RG-COO-041 instruction non éligible (talr_trait ≠ 1) : ignorée', async () => {
    const s = await site()
    const p = await passer({ instructions: [instruction(s, { talrTrait: '0' })] })
    expect(p.flux.find((x) => x.flux === 'INSTRUCTIONS')).toMatchObject({ creees: 0, ignorees: 1 })
  })

  it('RG-COO-062 / 087 / RG-X-065 vente annulée : dossier « Annulé », lignes ANNULEE, affiches en stock ; rejeu sans effet', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s)] })
    const [l] = await db.receptionAttendue.findMany({ where: { contNum: s.contNum } })
    const affiche = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
    })
    await f.createRattachement(db, { afficheId: affiche.id, ligneAttendueId: l?.id ?? 0 })
    const p = await passer({ dossiersAnnules: [s.contNum] })
    expect(p.flux.find((x) => x.flux === 'INSTRUCTIONS')).toMatchObject({ misesAJour: 1 })
    expect(await db.dossier.findUniqueOrThrow({ where: { contNum: s.contNum } })).toMatchObject({
      statut: 'ANNULE',
    })
    expect(await db.receptionAttendue.findUniqueOrThrow({ where: { id: l?.id } })).toMatchObject({
      etatLigne: 'ANNULEE',
    })
    expect(await db.afficheAttendue.count({ where: { afficheId: affiche.id, actif: true } })).toBe(
      1,
    )
    const p2 = await passer({ dossiersAnnules: [s.contNum, 999_999_999] })
    expect(p2.statut).toBe('SUCCES')
    expect(p2.flux.find((x) => x.flux === 'INSTRUCTIONS')).toMatchObject({ ignorees: 2 })
  })
})

describe('RG-COO-134 / 024 — retour « reçue et associée » vers Broadcast', () => {
  async function afficheLiee(validee: boolean, avecSite = true) {
    const s = await site()
    if (!avecSite)
      await db.plateforme.update({ where: { id: s.plateforme.id }, data: { idSiteCcf: null } })
    const support = await f.createSupport(db, { nom: '2m2 Scrolling' })
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: support.id,
      contNum: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      idDaChapeau: 31,
      // RG-COO-134 (a) : ligne non issue de Broadcast (prépa).
      source: 'PREPA',
    })
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: support.id,
      validationAdmin: validee,
    })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite: 12 })
    await f.createMouvement(db, { afficheId: a.id, quantite: 12 })
    return { s, a }
  }
  const messages = (afficheId: number) =>
    db.envoiBroadcast.findMany({
      where: { type: 'RETOUR_RECEPTION', cle: { startsWith: `${String(afficheId)}|` } },
      orderBy: { id: 'asc' },
    })

  it('RG-COO-134 / 024 EstAssociee = lien ET validée ; format ramené ; site CCF de la plateforme ; destinataire CIRCE', async () => {
    const { s, a } = await afficheLiee(true)
    const nonValidee = await afficheLiee(false)
    await passer({})
    const [m] = await messages(a.id)
    expect(JSON.parse(m?.donnees ?? '{}')).toMatchObject({
      afficheId: a.id,
      contNum: s.contNum,
      idDaChapeau: 31,
      format: '2m2',
      quantite: 12,
      estAssociee: true,
      idSiteCcf: s.idSiteCcf,
      destinataire: 'CIRCE',
    })
    const [m2] = await messages(nonValidee.a.id)
    expect(JSON.parse(m2?.donnees ?? '{}')).toMatchObject({ estAssociee: false })
  })

  it('RG-COO-134 seuls les changements sont envoyés ; drapeau « envoyé » posé après un envoi réussi', async () => {
    const { a } = await afficheLiee(true)
    const port = new BroadcastMemoire()
    port.echouer = true
    await passer({}, port)
    await passer({}, port)
    expect(await messages(a.id)).toHaveLength(1)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).envoye).toBe(false)
    port.echouer = false
    await passer({}, port)
    expect((await messages(a.id))[0]?.statut).toBe('ENVOYE')
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).envoye).toBe(true)
    await f.createMouvement(db, { afficheId: a.id, quantite: 3 })
    await passer({}, port)
    const tous = await messages(a.id)
    expect(tous).toHaveLength(2)
    expect(JSON.parse(tous[1]?.donnees ?? '{}')).toMatchObject({ quantite: 15 })
  })

  it('RG-COO-134 (a) affiche liée seulement à une ligne issue de Broadcast (source BC) : pas exportée comme associée', async () => {
    const s = await site()
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      source: 'BC',
    })
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      validationAdmin: true,
    })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id })
    await passer({})
    expect(await messages(a.id)).toHaveLength(0)
    // (b) : présente dans les semaines de départ du dossier → exportée, non associée.
    await f.createAfficheSemaineDepart(db, {
      afficheId: a.id,
      dossier: s.contNum,
      annee: plus(S, 1).annee,
      semaine: plus(S, 1).semaine,
    })
    await passer({})
    const [m] = await messages(a.id)
    expect(JSON.parse(m?.donnees ?? '{}')).toMatchObject({ estAssociee: false, contNum: s.contNum })
  })

  it('RG-COO-134 plateforme sans site CCF : ligne écartée et journalisée (pas en silence)', async () => {
    const { a } = await afficheLiee(true, false)
    await passer({})
    expect(await messages(a.id)).toHaveLength(0)
    const j = await db.journalAudit.findFirstOrThrow({
      where: { action: 'RETOUR_BROADCAST' },
      orderBy: { id: 'desc' },
    })
    expect(j.donnees).toContain(`"afficheId":${String(a.id)}`)
  })
})

describe('RG-COO-132 — « Rafraîchir un dossier »', () => {
  /** Dossier connu de Circé, avec une ligne attendue sur une plateforme ; coordinateur de cette plateforme. */
  async function dossierDuSite() {
    const plateforme = await f.createPlateforme(db)
    const contNum = 810_000 + next()
    await f.createDossier(db, { contNum })
    await f.createReceptionAttendue(db, { plateformeId: plateforme.id, contNum })
    const u = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: plateforme.id }])
    return { contNum, headers: devHeaders(u.identifiantExterne) }
  }

  it('RG-COO-132 / 167 dossier hors périmètre ou inconnu de Circé : 403 pour un coordinateur d’un site, rien en file', async () => {
    const { contNum } = await dossierDuSite()
    const ailleurs = await f.createPlateforme(db)
    const autre = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: ailleurs.id }])
    const h = devHeaders(autre.identifiantExterne)
    const r = await post(ctx, '/api/coordination/integration/rafraichir-dossier', h, { contNum })
    expect(r.statusCode).toBe(403)
    expect(erreur(r).code).toBe('COO_PERIMETRE_INTERDIT')
    const inconnu = 990_000_000 + next()
    const r2 = await post(ctx, '/api/coordination/integration/rafraichir-dossier', h, {
      contNum: inconnu,
    })
    expect(r2.statusCode).toBe(403)
    expect(
      await db.envoiBroadcast.count({
        where: { type: 'RAFRAICHIR_DOSSIER', cle: { in: [String(contNum), String(inconnu)] } },
      }),
    ).toBe(0)
    // L'administrateur (tous les sites) peut faire rafraîchir un dossier pas encore intégré.
    const { headers: admin } = await identiteDe(['admin'])
    const r3 = await post(ctx, '/api/coordination/integration/rafraichir-dossier', admin, {
      contNum: inconnu,
    })
    expect(r3.statusCode, r3.body).toBe(200)
  })

  it('RG-COO-132 coord / admin : demande tracée ; sans liaison Broadcast (Q-005) elle reste en attente', async () => {
    const { contNum, headers } = await dossierDuSite()
    const r = await post(ctx, '/api/coordination/integration/rafraichir-dossier', headers, {
      contNum,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(RafraichirDossierResultatSchema.parse(r.json())).toMatchObject({
      contNum,
      envoye: false,
    })
    expect(
      await db.envoiBroadcast.findFirstOrThrow({
        where: { type: 'RAFRAICHIR_DOSSIER', cle: String(contNum) },
      }),
    ).toMatchObject({ statut: 'A_ENVOYER' })
    expect(
      await db.journalAudit.count({
        where: { action: 'RAFRAICHIR_DOSSIER', entiteId: String(contNum) },
      }),
    ).toBe(1)
  })

  it('RG-COO-132 envoyé quand la liaison répond', async () => {
    const u = await f.createUtilisateurAvecRoles(db, ['admin'], [])
    const identity: Identity = {
      userId: u.id,
      identifiantExterne: u.identifiantExterne,
      nom: null,
      roles: ['admin'],
      perimetre: { toutesPlateformes: true, plateformeIds: [], lignes: [] },
      siteId: null,
    }
    const port = new BroadcastMemoire()
    const r = await rafraichirDossier({ db, broadcast: port }, identity, 4242)
    expect(r.envoye).toBe(true)
    expect(port.envoyes).toEqual([
      { type: 'RAFRAICHIR_DOSSIER', cle: '4242', donnees: { contNum: 4242 } },
    ])
  })

  it('RG-COO-132 refusé aux autres profils (403) ; n° de dossier obligatoire (400)', async () => {
    for (const role of ['cheq', 'recep', 'expe', 'com'] as const) {
      const { headers } = await identiteDe([role])
      const r = await post(ctx, '/api/coordination/integration/rafraichir-dossier', headers, {
        contNum: 1,
      })
      expect(r.statusCode, role).toBe(403)
    }
    const { headers } = await identiteDe(['coord'])
    const r = await post(ctx, '/api/coordination/integration/rafraichir-dossier', headers, {})
    expect(r.statusCode).toBe(400)
  })
})
