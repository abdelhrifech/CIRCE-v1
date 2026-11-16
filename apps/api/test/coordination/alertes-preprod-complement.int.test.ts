// COO-P07 — tests COMPLÉMENTAIRES des alertes Pré-Prod et de la vérification des thèmes (alertes-preprod.int.test.ts
// n'est pas dupliqué). Source de l'attendu (les règles, pas le code) : docs/COORDINATION_REGLES_METIER.md
// RG-COO-030 à 033, 066 à 076, 084, 086, 116, 122, RG-X-050, RG-X-057, §2 ; hypothèses Q-190, Q-220.
// Les alertes « requalifiées » sont testées par leurs VRAIS déclencheurs (passage d'intégration, réception,
// validation, annulation) puis lues dans Pilotage › Alertes (GET /api/alertes).
// Les écarts constatés sont marqués `it.fails` avec leur n° ANO (non reportés dans RAPPORT_TESTS.md).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ListeAlertesQuerySchema,
  ListeAlertesSchema,
  lundiSemaineIso,
  semaineIsoDe,
  type AlertePilotage,
  type LigneEtatReservations,
  type LotIntegration,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import { dbIdentityLoader, type Identity } from '../../src/core/identity.ts'
import type { BroadcastPort } from '../../src/core/ports/broadcast.ts'
import { listerAlertesPilotage } from '../../src/modules/alertes/service.ts'
import { lancerPassage } from '../../src/modules/coordination/integration-broadcast.ts'
import { lireDeadline } from '../../src/modules/coordination/reservations.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { bonDeLivraison, contexteReception, erreur, get, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

// ───────────────────────────── outils ─────────────────────────────

type Headers = Record<string, string>
const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']

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

/** Plateforme gérée par Broadcast (site CCF, correspondance surface × format) et un utilisateur par rôle. */
async function site() {
  const idSiteCcf = 40_000 + next()
  const plateforme = await f.createPlateforme(db, { idSiteCcf })
  const support = await f.createSupport(db)
  const idSurface = 900 + next()
  const idFormat = 1_500 + next()
  await db.correspondanceSupport.create({ data: { idSurface, idFormat, supportId: support.id } })
  const users = {} as Record<Role, { id: number; headers: Headers; ext: string }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne), ext: u.identifiantExterne }
  }
  return { plateforme, support, users, idSiteCcf, idSurface, idFormat, contNum: 930_000 + next() }
}
type Site = Awaited<ReturnType<typeof site>>

async function identite(ext: string): Promise<Identity> {
  const i = await dbIdentityLoader(db)(ext)
  if (!i) throw new Error('identité')
  return { ...i, siteId: null }
}

function edr(s: Site, p: Partial<LigneEtatReservations> = {}): LigneEtatReservations {
  return {
    idSiteCcf: s.idSiteCcf,
    destinataire: 'Plateforme test',
    contNum: s.contNum,
    annonceur: `ANNONCEUR C07 ${String(s.contNum)}`,
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

const port = (lot: Partial<LotIntegration>): BroadcastPort => ({
  nom: 'memoire',
  configure: true,
  lireLot: () =>
    Promise.resolve({ idInterface: 1, lectureComplete: false, lueLe: new Date(), ...lot }),
  envoyer: () => Promise.resolve(),
})
/** Vrai déclencheur : passage d'intégration (lot partiel : ne ferme rien hors de ses dossiers). */
async function passer(lot: Partial<LotIntegration>) {
  const p = await lancerPassage(
    { db, broadcast: port(lot) },
    { declencheur: 'PLANIFIE', identity: null },
  )
  expect(p.statut, p.message ?? '').toBe('SUCCES')
  return p
}

async function alertes(headers: Headers, qs = '') {
  const r = await get(ctx, `/api/alertes${qs ? `?${qs}` : ''}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return ListeAlertesSchema.parse(r.json())
}
const parCle = (l: { alertes: AlertePilotage[] }, debut: string) =>
  l.alertes.filter((a) => a.cle.startsWith(debut))
const duDossier = async (s: Site, contNum = s.contNum, role: Role = 'coord') =>
  (await alertes(s.users[role].headers, `dossier=${String(contNum)}`)).alertes

/** Réception (REC-P04) d'une affiche sur une ligne ; `intitule` pour une ligne sans IP. */
async function recevoir(s: Site, ligneAttendueId: number, quantite = 10, intitule?: string) {
  const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
    { ligneAttendueId, quantite, ...(intitule ? { intituleSaisi: intitule } : {}) },
  ])
  const r = await post(ctx, '/api/receptions', s.users.recep.headers, bl)
  expect(r.statusCode, r.body).toBe(201)
  return r.json<{ affiches: { id: number }[] }>().affiches[0]?.id ?? 0
}
const ligneActive = (contNum: number) =>
  db.receptionAttendue.findFirstOrThrow({ where: { contNum, etatLigne: 'ACTIVE' } })

async function valider(s: Site, afficheId: number) {
  const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
  const r = await post(
    ctx,
    `/api/coordination/affiches/${String(afficheId)}/validation-admin`,
    s.users.coord.headers,
    { version: a.version, valider: true },
  )
  expect(r.statusCode, r.body).toBe(200)
}

let numDeclencheur = 0
async function avecEchec<T>(corps: string, fn: () => Promise<T>): Promise<T> {
  const nom = `t_echec_alr_${String(++numDeclencheur)}_${String(next())}`
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nom} ${corps} BEGIN SELECT RAISE(ABORT, 'echec simule'); END`,
  )
  try {
    return await fn()
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${nom}`)
  }
}

// ───────────────── RG-COO-066 / 076 deadline jeudi S-2 16 h ─────────────────

describe('RG-COO-066 / RG-COO-076 préparation non reçue : deadline et fenêtre (complément)', () => {
  const ligneDossier = (s: Site, sem: SemaineIso, contNum = s.contNum) =>
    f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      semAnnee: sem.annee,
      semNum: sem.semaine,
    })
  const lire = async (s: Site, maintenant: Date, contNum = s.contNum) =>
    (
      await listerAlertesPilotage(
        db,
        await identite(s.users.coord.ext),
        ListeAlertesQuerySchema.parse({ dossier: String(contNum) }),
        maintenant,
      )
    ).alertes.filter((a) => a.cle === `PP-${String(contNum)}`)

  it('RG-COO-066 limite : à la deadline exacte (jeudi S-2 16 h) « À surveiller » ; une minute après « Critique »', async () => {
    const s = await site()
    await ligneDossier(s, plus(S, 2))
    const deadline = lireDeadline('-2;4;16:00')(plus(S, 2))
    expect(deadline.getUTCDay()).toBe(4)
    expect(deadline.getUTCHours()).toBe(16)
    expect((await lire(s, deadline))[0]?.gravite).toBe('A_SURVEILLER')
    expect((await lire(s, new Date(deadline.getTime() + 60_000)))[0]).toMatchObject({
      gravite: 'CRITIQUE',
      titre: 'Préparation non reçue après la deadline',
    })
  })

  it('RG-COO-076 deadline paramétrée (vendredi S-2 10 h) : la gravité suit le paramètre, jamais une constante', async () => {
    const s = await site()
    await ligneDossier(s, plus(S, 2))
    await parametre('coordination.deadlinePrepa', '-2;5;10:00')
    const ancienne = lireDeadline('-2;4;16:00')(plus(S, 2))
    const nouvelle = lireDeadline('-2;5;10:00')(plus(S, 2))
    const entre = new Date(ancienne.getTime() + 60_000)
    expect(entre < nouvelle).toBe(true)
    expect((await lire(s, entre))[0]?.gravite).toBe('A_SURVEILLER')
    expect((await lire(s, new Date(nouvelle.getTime() + 60_000)))[0]?.gravite).toBe('CRITIQUE')
  })

  it('RG-COO-066 limites de départ (Q-190 (4)) : S incluse, S+3 et S-1 exclues (premier départ du dossier)', async () => {
    const s = await site()
    const maintenant = new Date()
    const dS = s.contNum
    const dS3 = s.contNum + 1
    const dPasse = s.contNum + 2
    await ligneDossier(s, S, dS)
    await ligneDossier(s, plus(S, 3), dS3)
    await ligneDossier(s, plus(S, -1), dPasse)
    expect(await lire(s, maintenant, dS)).toHaveLength(1)
    expect(await lire(s, maintenant, dS3)).toHaveLength(0)
    expect(await lire(s, maintenant, dPasse)).toHaveLength(0)
  })

  it('RG-COO-066 vrai déclencheur : l’alerte se lève à l’arrivée de la prépa (passage d’intégration)', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(atelier.id)}`)
    await passer({ etatReservations: [edr(s, { quantite: 40 })] })
    expect(parCle({ alertes: await duDossier(s) }, 'PP-')).toHaveLength(1)
    await passer({
      preparations: [
        {
          idGroupe: 90_000 + next(),
          idSiteCcf: s.idSiteCcf,
          statutBroadcast: 133,
          details: [
            {
              idPreparationDetail: 91_000 + next(),
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
            },
          ],
        },
      ],
    })
    expect(parCle({ alertes: await duDossier(s) }, 'PP-')).toHaveLength(0)
  })
})

// ───────────────── RG-COO-033 / RG-X-050 seuils S / S+1 ─────────────────

describe('RG-COO-033 validation admin à confirmer : seuils (complément)', () => {
  async function doute(s: Site, sem: SemaineIso, contNum = s.contNum) {
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      semAnnee: sem.annee,
      semNum: sem.semaine,
      theme: 'Thème D',
    })
    const a = await f.createAffiche(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum,
      theme: 'Thème D',
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 2,
      mode: 'MAIN',
    })
    return a
  }

  it('RG-COO-033 départ déjà passé (S-1) : « Important » (≤ S+1)', async () => {
    const s = await site()
    const a = await doute(s, plus(S, -1))
    expect(parCle({ alertes: await duDossier(s) }, `VA-${String(a.id)}`)[0]?.gravite).toBe(
      'IMPORTANT',
    )
  })

  it('RG-COO-033 / Q-220 seuil paramétré : alertes.departGraveSemaines = 0 ⇒ S « Important », S+1 « À surveiller »', async () => {
    const s = await site()
    await parametre('alertes.departGraveSemaines', '0')
    const aS = await doute(s, S, s.contNum)
    const aS1 = await doute(s, plus(S, 1), s.contNum + 1)
    expect(parCle({ alertes: await duDossier(s) }, `VA-${String(aS.id)}`)[0]?.gravite).toBe(
      'IMPORTANT',
    )
    expect(
      parCle({ alertes: await duDossier(s, s.contNum + 1) }, `VA-${String(aS1.id)}`)[0]?.gravite,
    ).toBe('A_SURVEILLER')
  })

  it('RG-COO-033 affiche sur deux semaines : la gravité suit le départ le plus proche', async () => {
    const s = await site()
    const a = await doute(s, plus(S, 4))
    const l2 = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      theme: 'Thème D',
    })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l2.id,
      quantite: 1,
      mode: 'MAIN',
    })
    const va = parCle({ alertes: await duDossier(s) }, `VA-${String(a.id)}`)
    expect(va).toHaveLength(1)
    expect(va[0]?.gravite).toBe('IMPORTANT')
  })

  it('RG-COO-033 / 071 doute SANS_IP combiné à un autre motif (BL) : alerte de validation ET alerte sans IP', async () => {
    const s = await site()
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      theme: null,
      themeCle: null,
      provisoire: true,
    })
    const a = await f.createAffiche(db, { plateformeId: s.plateforme.id, supportId: s.support.id })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      quantite: 2,
      mode: 'MAIN',
    })
    const liste = { alertes: await duDossier(s) }
    expect(parCle(liste, `VA-${String(a.id)}`)).toHaveLength(1)
    expect(parCle(liste, `IP-${String(a.id)}`)).toHaveLength(1)
  })
})

// ───────────────── Vrais déclencheurs → Pilotage › Alertes ─────────────────

describe('RG-COO-030 / 031 / 032 / 067 / 068 / 071 / 084 / 086 vrais déclencheurs (complément)', () => {
  it('RG-COO-084 / 071 passage sans IP puis réception : alerte « sans IP » ; IP saisies au passage suivant : alerte levée', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s, { theme: null, idTheme: null, semaine: S })] })
    const p = await ligneActive(s.contNum)
    const afficheId = await recevoir(s, p.id, 10, 'Lu sur l’affiche')
    const avant = parCle({ alertes: await duDossier(s) }, `IP-${String(afficheId)}`)
    expect(avant).toHaveLength(1)
    expect(avant[0]).toMatchObject({ type: 'SANS_IP', gravite: 'IMPORTANT', regle: 'RG-COO-071' })
    await passer({ etatReservations: [edr(s, { theme: 'Thème IP', idTheme: 66, semaine: S })] })
    expect(parCle({ alertes: await duDossier(s) }, `IP-${String(afficheId)}`)).toHaveLength(0)
  })

  it('RG-COO-086 / 067 prépa intégrée différente de Broadcast : « Écart Broadcast / Circé » ; Broadcast aligné : levée', async () => {
    const s = await site()
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    await parametre('integration.sitesPreparation', String(s.idSiteCcf))
    await parametre('integration.routageFixe', `${String(s.idSiteCcf)}:${String(atelier.id)}`)
    await passer({
      etatReservations: [edr(s, { quantite: 100 })],
      preparations: [
        {
          idGroupe: 92_000 + next(),
          idSiteCcf: s.idSiteCcf,
          statutBroadcast: 133,
          details: [
            {
              idPreparationDetail: 93_000 + next(),
              contNum: s.contNum,
              idTypePreparation: 1,
              supportId: s.support.id,
              destinataire: null,
              annonceur: 'A',
              theme: 'Thème A',
              repiquage: null,
              repiquageId: null,
              quantite: 90,
              semaine: plus(S, 1),
              dateAffichage: null,
              numAfficheAmt: null,
              statutTravail: 0,
            },
          ],
        },
      ],
    })
    const bc = parCle({ alertes: await duDossier(s) }, 'BC-')
    expect(bc).toHaveLength(1)
    expect(bc[0]).toMatchObject({ type: 'ECART_BC', gravite: 'IMPORTANT' })
    await passer({ etatReservations: [edr(s, { quantite: 90 })] })
    expect(parCle({ alertes: await duDossier(s) }, 'BC-')).toHaveLength(0)
  })

  // ANO-037 : RG-COO-031 « si la quantité d'une ligne change après la validation d'une affiche rattachée, une
  // alerte « Écart Broadcast / Circé » est levée » (déclencheur : lecture de Broadcast). Sur une ligne encore
  // Broadcast (sans prépa), effetsLigneModifiee renvoie ECART_QUANTITE au rapport d'alimentation mais rien
  // n'est journalisé (alimentation-lignes.ts:alertesEffets) ni calculé (alertes-coordination.ts : BC- exige
  // qte_prepa ; effets-validation.ts:alertesValidation n'expose ECART_QUANTITE que si qte_prepa est renseignée).
  it('RG-COO-031 quantité changée par Broadcast après la validation (ligne sans prépa) : alerte « Écart Broadcast / Circé » visible (ANO-037 corrigée)', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s, { quantite: 100 })] })
    const l = await ligneActive(s.contNum)
    const afficheId = await recevoir(s, l.id, 10)
    await valider(s, afficheId)
    await passer({ etatReservations: [edr(s, { quantite: 120 })] })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })).validationAdmin).toBe(
      true,
    )
    const liste = await duDossier(s)
    expect(liste.some((a) => a.type === 'ECART_BC' || a.regle === 'RG-COO-031')).toBe(true)
  })

  // ANO-036 : RG-COO-068 « un thème modifié dans Broadcast après la validation/l'Instruction OK lève une
  // alerte ». Après l'Instruction OK, une affiche reçue mais non encore validée n'est pas marquée (seules les
  // affiches VALIDÉES le sont : effets-validation.ts:effetsLigneModifiee) et lignesThemeModifie
  // (themes.ts:735-744) ne lit que ce drapeau : aucune alerte ni ligne en ECR-THM-03.
  it('RG-COO-068 thème modifié dans Broadcast après l’Instruction OK (affiche reçue non validée) : alerte « Thème modifié dans Broadcast » (ANO-036 corrigée)', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s, { theme: 'Thème A' })] })
    const l = await ligneActive(s.contNum)
    await recevoir(s, l.id, 10)
    await f.createInstruction(db, { contNum: s.contNum, statut: 'INSTRUCTION_OK' })
    await passer({ etatReservations: [edr(s, { theme: 'Thème B' })] })
    expect((await ligneActive(s.contNum)).theme).toBe('Thème B')
    expect(parCle({ alertes: await duDossier(s) }, 'TBC-')).toHaveLength(1)
  })

  it('RG-COO-032 vrai déclencheur : vente annulée dans Broadcast (passage) ⇒ alerte « Ligne annulée : affiche à re-rattacher »', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s)] })
    const l = await ligneActive(s.contNum)
    const afficheId = await recevoir(s, l.id, 5)
    await passer({ dossiersAnnules: [s.contNum] })
    const la = parCle({ alertes: await duDossier(s) }, `LA-${String(afficheId)}-`)
    expect(la).toHaveLength(1)
    expect(la[0]).toMatchObject({ type: 'ECART_BC', regle: 'RG-COO-032', gravite: 'IMPORTANT' })
  })

  it('RG-COO-030 / RG-X-050 après « Reprendre la version BC », la validation reste à refaire : l’alerte « Validation admin à confirmer » demeure jusqu’à la reconfirmation', async () => {
    const s = await site()
    await passer({ etatReservations: [edr(s, { theme: 'Thème A' })] })
    const l = await ligneActive(s.contNum)
    const afficheId = await recevoir(s, l.id, 10)
    await valider(s, afficheId)
    await passer({ etatReservations: [edr(s, { theme: 'Thème B' })] })
    const lm = await ligneActive(s.contNum)
    const r = await post(
      ctx,
      `/api/coordination/themes/broadcast/${String(lm.id)}/reprendre`,
      s.users.coord.headers,
      { version: lm.version },
    )
    expect(r.statusCode, r.body).toBe(200)
    let liste = { alertes: await duDossier(s) }
    expect(parCle(liste, 'TBC-')).toHaveLength(0)
    expect(parCle(liste, `VA-${String(afficheId)}`)).toHaveLength(1)
    await valider(s, afficheId)
    liste = { alertes: await duDossier(s) }
    expect(parCle(liste, `VA-${String(afficheId)}`)).toHaveLength(0)
  })
})

// ───────────────── RG-X-057 reprise version BC : atomicité, 409, idempotence, alertes ─────────────────

describe('RG-X-057 / RG-COO-068 « Reprendre la version Broadcast » (complément)', () => {
  async function themeModifie(s: Site, nbAffiches = 1) {
    const l = await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: plus(S, 1).annee,
      semNum: plus(S, 1).semaine,
      theme: 'Nouveau thème',
    })
    const affiches = []
    for (let k = 0; k < nbAffiches; k++) {
      const a = await f.createAffiche(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: s.contNum,
        theme: 'Ancien thème',
        themeModifie: true,
      })
      await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, quantite: 2 })
      affiches.push(a)
    }
    return { l, affiches }
  }
  const reprendre = (
    s: Site,
    ligneId: number,
    version: number,
    h: Headers = s.users.coord.headers,
    cle = idem(),
  ) =>
    ctx.app.inject({
      method: 'POST',
      url: `/api/coordination/themes/broadcast/${String(ligneId)}/reprendre`,
      headers: { ...h, ...cle },
      payload: { version },
    })

  it('RG-X-057 deux affiches sur la ligne : toutes reprises dans la même opération ; alerte « Feuille à refaire » visible de la Réception ET de la Coordination', async () => {
    const s = await site()
    const { l, affiches } = await themeModifie(s, 2)
    const r = await reprendre(s, l.id, l.version)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ affiches: number }>().affiches).toBe(2)
    for (const a of affiches)
      expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
        theme: 'Nouveau thème',
        feuilleARefaire: true,
      })
    for (const role of ['coord', 'recep'] as const) {
      const liste = await alertes(s.users[role].headers)
      for (const a of affiches)
        expect(
          liste.alertes.some((x) => x.cle === `RG-REC-188:${String(a.id)}`),
          role,
        ).toBe(true)
    }
  })

  it('RG-X-057 atomicité : échec à l’historique du dossier ⇒ aucune affiche modifiée, aucune feuille à refaire', async () => {
    const s = await site()
    const { l, affiches } = await themeModifie(s, 2)
    const r = await avecEchec(
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'REPRISE_THEME_BROADCAST' AND NEW.entite_id = '${String(s.contNum)}'`,
      () => reprendre(s, l.id, l.version),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    for (const a of affiches)
      expect(await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
        theme: 'Ancien thème',
        feuilleARefaire: a.feuilleARefaire,
        version: a.version,
      })
    expect(parCle({ alertes: await duDossier(s) }, 'TBC-')).toHaveLength(1)
  })

  it('RG-X-057 concurrence : deux reprises simultanées de la même version ⇒ une 200, l’autre 409, un seul historique', async () => {
    const s = await site()
    const { l } = await themeModifie(s)
    const admin = s.users.admin.headers
    const rs = await Promise.all([
      reprendre(s, l.id, l.version),
      reprendre(s, l.id, l.version, admin),
    ])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(
      await db.journalAudit.count({
        where: { action: 'REPRISE_THEME_BROADCAST', entiteId: String(s.contNum) },
      }),
    ).toBe(1)
  })

  it('RG-X-057 idempotence : même Idempotency-Key ⇒ même réponse, une seule reprise ; autre corps ⇒ 409', async () => {
    const s = await site()
    const { l } = await themeModifie(s)
    const cle = idem()
    const r1 = await reprendre(s, l.id, l.version, s.users.coord.headers, cle)
    const r2 = await reprendre(s, l.id, l.version, s.users.coord.headers, cle)
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    const r3 = await reprendre(s, l.id, l.version + 1, s.users.coord.headers, cle)
    expect(r3.statusCode).toBe(409)
    expect(erreur(r3).code).toBe('COO_IDEMPOTENCE_CONFLIT')
    expect(
      await db.journalAudit.count({
        where: { action: 'REPRISE_THEME_BROADCAST', entiteId: String(s.contNum) },
      }),
    ).toBe(1)
  })

  it.each<Role>(['coord', 'admin'])(
    'RG-COO-068 / 009 reprise autorisée au rôle %s',
    async (role) => {
      const s = await site()
      const { l } = await themeModifie(s)
      expect((await reprendre(s, l.id, l.version, s.users[role].headers)).statusCode).toBe(200)
    },
  )
})

// ───────────────── Permissions, périmètre, filtres ─────────────────

describe('RG-COO-075 / RG-COO-069 permissions, périmètre et filtres (complément)', () => {
  it.each<Role>(['cheq', 'recep', 'expe', 'com'])(
    'RG-COO-075 vérification des thèmes (proches, annonceurs, Broadcast) refusée au rôle %s (403)',
    async (role) => {
      const s = await site()
      for (const vue of ['proches', 'annonceurs', 'broadcast'])
        expect(
          (await get(ctx, `/api/coordination/themes/${vue}`, s.users[role].headers)).statusCode,
          vue,
        ).toBe(403)
    },
  )

  it.each<Role>(['coord', 'admin'])(
    'RG-COO-075 vérification des thèmes consultable par le rôle %s',
    async (role) => {
      const s = await site()
      for (const vue of ['proches', 'annonceurs', 'broadcast'])
        expect(
          (await get(ctx, `/api/coordination/themes/${vue}`, s.users[role].headers)).statusCode,
          vue,
        ).toBe(200)
    },
  )

  it('Q-190 (14) alertes techniques de l’intégration : visibles de coord / admin seulement (pas cheq, recep, com)', async () => {
    const s = await site()
    const p = await lancerPassage(
      {
        db,
        broadcast: {
          nom: 'x',
          configure: true,
          lireLot: () =>
            Promise.resolve({ idInterface: null, lectureComplete: false, lueLe: new Date() }),
          envoyer: () => Promise.resolve(),
        },
      },
      { declencheur: 'PLANIFIE', identity: null },
    )
    expect(p.statut).toBe('ECHEC')
    try {
      for (const role of ['coord', 'admin'] as const)
        expect(
          parCle(await alertes(s.users[role].headers), `INT-ECHEC-${String(p.id)}`),
          role,
        ).toHaveLength(1)
      for (const role of ['cheq', 'recep', 'com'] as const)
        expect(parCle(await alertes(s.users[role].headers), 'INT-'), role).toHaveLength(0)
    } finally {
      await passer({})
    }
  })

  it('RG-COO-167 périmètre : filtrer sur le site d’un autre périmètre ne montre aucune alerte de ce site', async () => {
    const s = await site()
    const autre = await site()
    const l = await f.createReceptionAttendue(db, {
      plateformeId: autre.plateforme.id,
      supportId: autre.support.id,
      contNum: autre.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
    })
    expect(
      (await alertes(autre.users.coord.headers, `dossier=${String(l.contNum)}`)).alertes.length,
    ).toBeGreaterThan(0)
    const vu = await alertes(s.users.coord.headers, `site=${String(autre.plateforme.id)}`)
    expect(vu.alertes.filter((a) => a.plateformeId === autre.plateforme.id)).toEqual([])
    expect(vu.alertes.every((a) => a.plateformeId === null)).toBe(true)
  })

  it('RG-COO-075 filtre état « Acquittées » : aucune tant que personne ne peut acquitter (Q-220)', async () => {
    const s = await site()
    await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
    })
    const liste = await alertes(
      s.users.coord.headers,
      `etat=ACQUITTEES&dossier=${String(s.contNum)}`,
    )
    expect(liste.alertes).toEqual([])
    expect(liste.peutAcquitter).toBe(false)
  })

  it.each<Role>(['com', 'cheq'])(
    'Q-220 acquittement : clé d’une alerte réellement ouverte, par le rôle %s ⇒ 403, rien n’est persisté',
    async (role) => {
      const s = await site()
      await f.createReceptionAttendue(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: s.contNum,
        semAnnee: S.annee,
        semNum: S.semaine,
      })
      const cle = (await duDossier(s))[0]?.cle ?? ''
      expect(cle).not.toBe('')
      const r = await post(ctx, '/api/alertes/acquittements', s.users[role].headers, {
        cles: [cle],
      })
      expect(r.statusCode).toBe(403)
      expect(await db.alerteAcquittement.count({ where: { cle } })).toBe(0)
    },
  )

  it('Q-421 acquittement : l’administrateur (super-utilisateur) acquitte une alerte réellement ouverte', async () => {
    const s = await site()
    await f.createReceptionAttendue(db, {
      plateformeId: s.plateforme.id,
      supportId: s.support.id,
      contNum: s.contNum,
      semAnnee: S.annee,
      semNum: S.semaine,
    })
    const cle = (await duDossier(s))[0]?.cle ?? ''
    expect(cle).not.toBe('')
    const r = await post(ctx, '/api/alertes/acquittements', s.users.admin.headers, { cles: [cle] })
    expect(r.statusCode).toBe(200)
    expect(await db.alerteAcquittement.count({ where: { cle } })).toBe(1)
  })
})

// ───────────────── RG-COO-069 seuil 0,85 en intégration ─────────────────

describe('RG-COO-069 seuil de similarité paramétrable (complément)', () => {
  const jeton = () =>
    Array.from({ length: 14 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join(
      '',
    )

  async function deuxIntitules(s: Site, a: string, b: string) {
    const annonceur = `Annonceur ${jeton()}`
    for (const [k, theme] of [a, b].entries())
      await f.createReceptionAttendue(db, {
        plateformeId: s.plateforme.id,
        supportId: s.support.id,
        contNum: s.contNum + k,
        semAnnee: plus(S, 1).annee,
        semNum: plus(S, 1).semaine,
        theme,
        themeCle: theme.toUpperCase(),
        annonceur,
      })
    await f.createDossier(db, { contNum: s.contNum, annonceur })
    await f.createDossier(db, { contNum: s.contNum + 1, annonceur })
  }
  const groupes = async (s: Site) =>
    parCle(await alertes(s.users.coord.headers, `dossier=${String(s.contNum)}`), 'TH-')

  it('RG-COO-069 limite : similarité exactement 0,85 ⇒ « À vérifier » ; 0,84 ⇒ pas de groupe', async () => {
    const s1 = await site()
    // 17 caractères communs sur 2 × 20 : 34 / 40 = 0,85.
    await deuxIntitules(s1, 'abcdefghijklmnopqrst', 'abcdefghijklmnopqxyz')
    expect(await groupes(s1)).toHaveLength(1)
    const s2 = await site()
    // 21 caractères communs sur 2 × 25 : 42 / 50 = 0,84.
    await deuxIntitules(s2, 'abcdefghijklmnopqrstuvwxy', 'abcdefghijklmnopqrstu1234')
    expect(await groupes(s2)).toHaveLength(0)
  })

  it('RG-COO-069 seuil paramétré à 0,9 : une paire à 0,85 n’est plus « proche »', async () => {
    await parametre('coordination.seuilThemesProches', '0.9')
    const s = await site()
    await deuxIntitules(s, 'abcdefghijklmnopqrst', 'abcdefghijklmnopqxyz')
    expect(await groupes(s)).toHaveLength(0)
  })
})
