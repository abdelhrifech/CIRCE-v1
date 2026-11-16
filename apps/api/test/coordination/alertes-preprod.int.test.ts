// COO-P07 — Alertes Pré-Prod et vérification des thèmes : Pilotage › Alertes (ECR-TRA-01, RG-COO-075),
// RG-COO-030 à 033, 053, 066 à 074, 076, 086, 103, 116, 122, RG-X-050 ; vérification des thèmes (ECR-THM-01 à
// 03, RG-COO-068 à 070, RG-X-057) ; deadline de la liste des dossiers (ECR-COO-01, RG-COO-066).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ListeAlertesSchema,
  ListeAnnonceursProchesSchema,
  FicheDossierSchema,
  ListeDossiersSchema,
  ListeThemesModifiesSchema,
  ListeThemesProchesSchema,
  formatSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type AlertePilotage,
  type Role,
  type SemaineIso,
} from '@circe/shared'
import type { LigneEtatReservations, LotIntegration } from '@circe/shared'
import type { Identity } from '../../src/core/identity.ts'
import type { BroadcastPort } from '../../src/core/ports/broadcast.ts'
import { lancerPassage } from '../../src/modules/coordination/integration-broadcast.ts'
import { dbIdentityLoader } from '../../src/core/identity.ts'
import { listerAlertesPilotage, signature } from '../../src/modules/alertes/service.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { bonDeLivraison, contexteReception, erreur, get, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const S = semaineIsoDe(new Date())
const plus = (s: SemaineIso, n: number) =>
  semaineIsoDe(new Date(lundiSemaineIso(s).getTime() + n * 7 * 86_400_000))
/** Jeton aléatoire long : deux annonceurs de tests différents ne sont jamais « proches ». */
const jeton = () =>
  Array.from({ length: 14 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join('')

const ROLES: Role[] = ['coord', 'cheq', 'recep', 'expe', 'admin', 'com']

async function site() {
  const plateforme = await f.createPlateforme(db)
  const support = await f.createSupport(db)
  const users = {} as Record<Role, { id: number; headers: Record<string, string>; ext: string }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, headers: devHeaders(u.identifiantExterne), ext: u.identifiantExterne }
  }
  return { plateforme, support, users }
}
type Site = Awaited<ReturnType<typeof site>>

async function identite(ext: string): Promise<Identity> {
  const i = await dbIdentityLoader(db)(ext)
  if (!i) throw new Error('identité')
  return { ...i, siteId: null }
}

const ligne = (
  s: Site,
  sem: SemaineIso,
  data: Parameters<typeof f.createReceptionAttendue>[1] = {},
) =>
  f.createReceptionAttendue(db, {
    plateformeId: s.plateforme.id,
    supportId: s.support.id,
    semAnnee: sem.annee,
    semNum: sem.semaine,
    ...data,
  })

const affiche = (s: Site, data: Parameters<typeof f.createAffiche>[1] = {}) =>
  f.createAffiche(db, { plateformeId: s.plateforme.id, supportId: s.support.id, ...data })

async function alertes(headers: Record<string, string>, qs = '') {
  const r = await get(ctx, `/api/alertes${qs ? `?${qs}` : ''}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return ListeAlertesSchema.parse(r.json())
}
const parCle = (l: { alertes: AlertePilotage[] }, debut: string) =>
  l.alertes.filter((a) => a.cle.startsWith(debut))

describe('ECR-TRA-01 / RG-COO-075 Pilotage › Alertes : droits', () => {
  it('RG-COO-075 coord, cheq, recep, admin et com consultent les alertes', async () => {
    const s = await site()
    for (const r of ['coord', 'cheq', 'recep', 'admin', 'com'] as const)
      expect((await get(ctx, '/api/alertes', s.users[r].headers)).statusCode).toBe(200)
  })

  it('RG-COO-075 rejet : expe (403) et sans identité (401)', async () => {
    const s = await site()
    const r = await get(ctx, '/api/alertes', s.users.expe.headers)
    expect(r.statusCode).toBe(403)
    expect(erreur(r).regle).toBe('RG-COO-075')
    expect((await get(ctx, '/api/alertes', {})).statusCode).toBe(401)
  })

  it('RG-COO-075 rejet : filtre invalide (400)', async () => {
    const s = await site()
    expect((await get(ctx, '/api/alertes?gravite=GRAVE', s.users.coord.headers)).statusCode).toBe(
      400,
    )
    expect((await get(ctx, '/api/alertes?depart=S43', s.users.coord.headers)).statusCode).toBe(400)
  })

  it('Q-220 / Q-371 acquitter : refusé à tous les rôles sauf admin (Q-421) tant que « qui acquitte » n’est pas tranché', async () => {
    const s = await site()
    for (const r of ROLES.filter((x) => x !== 'admin')) {
      const res = await post(ctx, '/api/alertes/acquittements', s.users[r].headers, { cles: ['X'] })
      expect(res.statusCode, r).toBe(403)
      expect(erreur(res).regle).toBe('RG-COO-075')
    }
    expect(
      (await post(ctx, '/api/alertes/acquittements', s.users.coord.headers, { cles: [] }))
        .statusCode,
    ).toBe(400)
    expect((await alertes(s.users.coord.headers)).peutAcquitter).toBe(false)
  })
})

describe('ECR-TRA-01 agrégation, filtres et acquittement (lecture)', () => {
  it('RG-REC-182 les alertes Réception sont reprises avec leur type, leur départ et leur dossier', async () => {
    const s = await site()
    const l = await ligne(s, S, { theme: `Th ${jeton()}` })
    const liste = await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`)
    const a = liste.alertes.find((x) => x.cle === `RG-REC-182:${String(l.id)}`)
    expect(a).toMatchObject({
      type: 'MANQUANT',
      gravite: 'CRITIQUE',
      depart: formatSemaineIso(S),
      dossiers: [l.contNum],
      site: s.plateforme.nom,
    })
  })

  it('RG-COO-075 filtres gravité, type, départ (les alertes sans semaine restent), site ; compteurs sans leur filtre', async () => {
    const s = await site()
    const l1 = await ligne(s, S, { theme: `Th ${jeton()}` })
    const l2 = await ligne(s, plus(S, 1), { theme: `Th ${jeton()}`, contNum: l1.contNum })
    const tous = await alertes(s.users.coord.headers, `dossier=${String(l1.contNum)}`)
    expect(parCle(tous, 'RG-REC-182')).toHaveLength(2)
    const crit = await alertes(
      s.users.coord.headers,
      `dossier=${String(l1.contNum)}&gravite=CRITIQUE&type=MANQUANT`,
    )
    expect(crit.alertes.map((a) => a.cle)).toEqual([`RG-REC-182:${String(l1.id)}`])
    // Compteur par gravité : tous les filtres sauf la gravité.
    expect(crit.parGravite.CRITIQUE).toBe(1)
    expect(crit.parGravite.A_SURVEILLER).toBe(1)
    const s1 = await alertes(
      s.users.coord.headers,
      `dossier=${String(l1.contNum)}&type=MANQUANT&depart=${formatSemaineIso(plus(S, 1))}`,
    )
    expect(s1.alertes.map((a) => a.cle)).toEqual([`RG-REC-182:${String(l2.id)}`])
    const parType = await alertes(s.users.coord.headers, `dossier=${String(l1.contNum)}&type=ECART`)
    expect(parType.alertes).toHaveLength(0)
    expect(parType.parType.MANQUANT).toBe(2)
    const autreSite = await f.createPlateforme(db)
    expect(
      (
        await alertes(
          s.users.admin.headers,
          `dossier=${String(l1.contNum)}&site=${String(autreSite.id)}`,
        )
      ).alertes,
    ).toHaveLength(0)
    // Une alerte sans semaine (palette à contrôler) reste sous un filtre de départ.
    const r = await f.createReception(db, {
      plateformeId: s.plateforme.id,
      aControlerDepuis: new Date(Date.now() - 100 * 3_600_000),
    })
    const filtre = await alertes(
      s.users.coord.headers,
      `depart=${formatSemaineIso(plus(S, 5))}&type=CONTROLE_RETARD`,
    )
    expect(filtre.alertes.some((a) => a.cle === `RG-REC-189:${String(r.id)}`)).toBe(true)
  })

  it('Q-371 une alerte acquittée sort des « Ouvertes » ; aggravée (autre signature), elle redevient ouverte', async () => {
    const s = await site()
    const l = await ligne(s, plus(S, 1), { theme: `Th ${jeton()}` })
    const cle = `RG-REC-182:${String(l.id)}`
    const avant = (await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`)).alertes
    const a = avant.find((x) => x.cle === cle)
    if (!a) throw new Error('alerte')
    await db.alerteAcquittement.create({
      data: { cle, signature: signature(a), parId: s.users.coord.id },
    })
    expect(
      (await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`)).alertes.map(
        (x) => x.cle,
      ),
    ).not.toContain(cle)
    const acq = await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}&etat=ACQUITTEES`)
    expect(acq.alertes.find((x) => x.cle === cle)?.acquittee?.le).toBeTruthy()
    await db.alerteAcquittement.update({ where: { cle }, data: { signature: 'IMPORTANT|autre' } })
    expect(
      (await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`)).alertes.map(
        (x) => x.cle,
      ),
    ).toContain(cle)
  })

  it('RG-COO-167 périmètre : les alertes d’un autre site ne sont pas visibles', async () => {
    const s = await site()
    const t = await site()
    const l = await ligne(t, S, { theme: `Th ${jeton()}` })
    expect(
      (await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`)).alertes,
    ).toHaveLength(0)
  })
})

describe('RG-COO-033 / RG-X-050 validation admin à confirmer', () => {
  it('RG-COO-033 une affiche à doute (motif BL) alerte la Coordination : Important si départ ≤ S+1', async () => {
    const s = await site()
    const l = await ligne(s, plus(S, 1), { theme: 'Visuel A' })
    const a = await affiche(s, { contNum: l.contNum, theme: 'Visuel A' })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      mode: 'MAIN',
      quantite: 5,
    })
    const va = parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'VA-')
    expect(va).toEqual([
      expect.objectContaining({
        cle: `VA-${String(a.id)}`,
        type: 'VALIDATION_ADMIN',
        regle: 'RG-COO-033',
        gravite: 'IMPORTANT',
        destinataires: ['Coordination'],
        depart: formatSemaineIso(plus(S, 1)),
      }),
    ])
    expect(va[0]?.message).toContain('rattachée sans le n° du BL')
  })

  it('RG-COO-033 au-delà de S+1 : À surveiller', async () => {
    const s = await site()
    const l = await ligne(s, plus(S, 3), { theme: 'Visuel A' })
    const a = await affiche(s, { contNum: l.contNum, theme: 'Visuel A' })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      mode: 'MAIN',
      quantite: 5,
    })
    const va = parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'VA-')
    expect(va[0]?.gravite).toBe('A_SURVEILLER')
  })

  it('RG-COO-033 rejet : cas sûr (sans doute), affiche validée, doute SANS_IP seul → pas d’alerte de validation', async () => {
    const s = await site()
    const l = await ligne(s, S, { theme: 'Visuel A' })
    const sur = await affiche(s, { contNum: l.contNum, theme: 'Visuel A' })
    await f.createRattachement(db, { afficheId: sur.id, ligneAttendueId: l.id, mode: 'BL' })
    const validee = await affiche(s, {
      contNum: l.contNum,
      theme: 'Visuel A',
      validationAdmin: true,
    })
    await f.createRattachement(db, { afficheId: validee.id, ligneAttendueId: l.id, mode: 'MAIN' })
    const sansIp = await ligne(s, S, { theme: null, provisoire: true })
    const a3 = await affiche(s, { contNum: sansIp.contNum, theme: 'lu' })
    await f.createRattachement(db, { afficheId: a3.id, ligneAttendueId: sansIp.id, mode: 'BL' })
    const l1 = await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`)
    expect(parCle(l1, 'VA-')).toEqual([])
    const l2 = await alertes(s.users.coord.headers, `dossier=${String(sansIp.contNum)}`)
    expect(parCle(l2, 'VA-')).toEqual([])
    expect(parCle(l2, 'IP-').map((x) => x.cle)).toEqual([`IP-${String(a3.id)}`])
  })

  it('RG-X-050 annuler la validation lève l’alerte « Validation admin à confirmer » ; la reconfirmer la retire', async () => {
    const s = await site()
    const l = await ligne(s, S, { theme: 'Visuel A' })
    const a = await affiche(s, {
      contNum: l.contNum,
      theme: 'Visuel A',
      validationAdmin: true,
      validationAdminParId: s.users.coord.id,
      validationAdminLe: new Date(),
    })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, mode: 'BL' })
    const q = `dossier=${String(l.contNum)}`
    expect(parCle(await alertes(s.users.coord.headers, q), 'VA-')).toEqual([])
    const annul = await post(
      ctx,
      `/api/coordination/affiches/${String(a.id)}/validation-admin`,
      s.users.coord.headers,
      {
        version: a.version,
        valider: false,
      },
    )
    expect(annul.statusCode, annul.body).toBe(200)
    const va = parCle(await alertes(s.users.coord.headers, q), 'VA-')
    expect(va).toHaveLength(1)
    expect(va[0]?.message).toContain('validation annulée')
    const v = (await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).version
    const revalid = await post(
      ctx,
      `/api/coordination/affiches/${String(a.id)}/validation-admin`,
      s.users.coord.headers,
      {
        version: v,
        valider: true,
      },
    )
    expect(revalid.statusCode, revalid.body).toBe(200)
    expect(parCle(await alertes(s.users.coord.headers, q), 'VA-')).toEqual([])
  })
})

describe('RG-COO-071 / RG-COO-084 réception sans IP', () => {
  it('RG-COO-071 une affiche sur une ligne provisoire alerte (Important) ; une seule alerte (pas de doublon RG-REC-184)', async () => {
    const s = await site()
    const l = await ligne(s, S, { theme: null, provisoire: true })
    const a = await affiche(s, { contNum: l.contNum, theme: 'Intitulé lu' })
    await f.createRattachement(db, {
      afficheId: a.id,
      ligneAttendueId: l.id,
      mode: 'BL',
      quantite: 7,
    })
    const liste = await alertes(s.users.recep.headers, `dossier=${String(l.contNum)}`)
    expect(parCle(liste, 'IP-')).toEqual([
      expect.objectContaining({ type: 'SANS_IP', regle: 'RG-COO-071', gravite: 'IMPORTANT' }),
    ])
    expect(parCle(liste, 'IP-')[0]?.message).toContain('« Intitulé lu »')
    expect(parCle(liste, 'RG-REC-184')).toEqual([])
  })

  it('RG-COO-071 rejet : IP saisies (ligne avec thème) ou lien retiré → pas d’alerte', async () => {
    const s = await site()
    const l = await ligne(s, S, { theme: 'Thème saisi' })
    const a = await affiche(s, { contNum: l.contNum, theme: 'Thème saisi' })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, mode: 'BL' })
    const p = await ligne(s, S, { theme: null, provisoire: true })
    const b = await affiche(s, { contNum: p.contNum })
    await f.createRattachement(db, {
      afficheId: b.id,
      ligneAttendueId: p.id,
      mode: 'BL',
      actif: false,
    })
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'IP-'),
    ).toEqual([])
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(p.contNum)}`), 'IP-'),
    ).toEqual([])
  })
})

describe('RG-COO-066 / 076 préparation non reçue (deadline jeudi S-2 16 h)', () => {
  /** Lundi de la semaine S à 8 h : la deadline de S+2 (jeudi S 16 h) n'est pas passée, celle de S+1 l'est. */
  const lundi = new Date(lundiSemaineIso(S).getTime() + 8 * 3_600_000)

  it('RG-COO-066 départ S+1 (deadline dépassée) : Critique ; départ S+2 : À surveiller', async () => {
    const s = await site()
    const d1 = await f.createDossier(db, { annonceur: 'P1' })
    await ligne(s, plus(S, 1), { contNum: d1.contNum, theme: 'T' })
    const d2 = await f.createDossier(db, { annonceur: 'P2' })
    await ligne(s, plus(S, 2), { contNum: d2.contNum, theme: null })
    const id = await identite(s.users.coord.ext)
    const l1 = await listerAlertesPilotage(db, id, { etat: 'OUVERTES', dossier: d1.contNum }, lundi)
    expect(parCle(l1, 'PP-')).toEqual([
      expect.objectContaining({
        type: 'IP_MANQUANTES',
        gravite: 'CRITIQUE',
        titre: 'Préparation non reçue après la deadline',
      }),
    ])
    expect(parCle(l1, 'PP-')[0]?.message).toContain('IP saisies, préparation non envoyée')
    expect(parCle(l1, 'PP-')[0]?.message).toContain('Deadline Pré-Prod : jeu.')
    const l2 = await listerAlertesPilotage(db, id, { etat: 'OUVERTES', dossier: d2.contNum }, lundi)
    expect(parCle(l2, 'PP-')[0]).toMatchObject({
      gravite: 'A_SURVEILLER',
      titre: 'Préparation attendue avant la deadline',
    })
    expect(parCle(l2, 'PP-')[0]?.message).toContain('IP non saisies')
  })

  it('RG-COO-066 rejet : prépa reçue, dossier annulé, départ au-delà de S+2 → pas d’alerte', async () => {
    const s = await site()
    const id = await identite(s.users.coord.ext)
    for (const [statut, n] of [
      ['PREPARATION_RECUE', 1],
      ['ANNULE', 1],
      ['A_TRAITER', 3],
    ] as const) {
      const d = await f.createDossier(db, { statut })
      await ligne(s, plus(S, n), { contNum: d.contNum })
      const l = await listerAlertesPilotage(db, id, { etat: 'OUVERTES', dossier: d.contNum }, lundi)
      expect(parCle(l, 'PP-'), statut).toEqual([])
    }
  })

  it('RG-COO-066 ECR-COO-01 : la ligne du dossier porte la deadline Pré-Prod tant que la prépa n’est pas reçue', async () => {
    const s = await site()
    const d = await f.createDossier(db)
    await ligne(s, plus(S, 1), { contNum: d.contNum })
    const recu = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    await ligne(s, plus(S, 1), { contNum: recu.contNum })
    const lire = async (n: number) =>
      ListeDossiersSchema.parse(
        (
          await get(ctx, `/api/coordination/dossiers?dossier=${String(n)}`, s.users.coord.headers)
        ).json(),
      ).items[0]
    const ligneD = await lire(d.contNum)
    const lundiS1 = lundiSemaineIso(plus(S, 1))
    expect(ligneD?.deadlinePrepa).toBe(
      new Date(lundiS1.getTime() - 14 * 86_400_000 + 3 * 86_400_000 + 16 * 3_600_000).toISOString(),
    )
    expect(ligneD?.deadlineDepassee).toBe(Date.now() > Date.parse(ligneD?.deadlinePrepa ?? ''))
    expect((await lire(recu.contNum))?.deadlinePrepa).toBeNull()
  })
})

describe('RG-COO-067 / 031 / 086 écart Broadcast / Circé', () => {
  it('RG-COO-067 écart non nul : alerte Important « Écart Broadcast / Circé »', async () => {
    const s = await site()
    const l = await ligne(s, S, { qteBc: 100, qtePrepa: 90, source: 'PREPA' })
    const bc = parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'BC-')
    expect(bc).toEqual([
      expect.objectContaining({ type: 'ECART_BC', regle: 'RG-COO-067', gravite: 'IMPORTANT' }),
    ])
    expect(bc[0]?.message).toContain('+10')
  })

  it('RG-COO-086 / 031 écart compensé sur le dossier, mais une ligne diffère : alerte quand même', async () => {
    const s = await site()
    const a = await ligne(s, S, { qteBc: 100, qtePrepa: 90 })
    await ligne(s, S, { contNum: a.contNum, qteBc: 50, qtePrepa: 60 })
    const bc = parCle(await alertes(s.users.coord.headers, `dossier=${String(a.contNum)}`), 'BC-')
    expect(bc).toEqual([expect.objectContaining({ regle: 'RG-COO-086' })])
  })

  it('RG-COO-067 rejet : quantités égales, prépa inconnue, dossier annulé → pas d’alerte', async () => {
    const s = await site()
    const egal = await ligne(s, S, { qteBc: 100, qtePrepa: 100 })
    const inconnue = await ligne(s, S, { qteBc: 100, qtePrepa: null })
    const d = await f.createDossier(db, { statut: 'ANNULE' })
    await ligne(s, S, { contNum: d.contNum, qteBc: 100, qtePrepa: 50 })
    for (const n of [egal.contNum, inconnue.contNum, d.contNum])
      expect(parCle(await alertes(s.users.coord.headers, `dossier=${String(n)}`), 'BC-')).toEqual(
        [],
      )
  })
})

describe('RG-COO-032 ligne annulée portant une affiche', () => {
  it('RG-COO-032 lien actif vers une ligne annulée : alerte « à re-rattacher » (type écart / dossier annulé)', async () => {
    const s = await site()
    const l = await ligne(s, S, { etatLigne: 'ANNULEE', theme: 'Ancien' })
    const a = await affiche(s, { contNum: l.contNum })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id })
    const la = parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'LA-')
    expect(la).toEqual([
      expect.objectContaining({
        cle: `LA-${String(a.id)}-${String(l.id)}`,
        type: 'ECART_BC',
        regle: 'RG-COO-032',
        titre: 'Ligne annulée : affiche à re-rattacher',
      }),
    ])
  })

  it('RG-COO-032 rejet : lien retiré (déplacé) → plus d’alerte', async () => {
    const s = await site()
    const l = await ligne(s, S, { etatLigne: 'ANNULEE' })
    const a = await affiche(s, { contNum: l.contNum })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id, actif: false })
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'LA-'),
    ).toEqual([])
  })
})

describe('RG-COO-068 / 030 / RG-X-057 thème modifié dans Broadcast', () => {
  async function themeModifie(s: Site, enProduction = false) {
    const l = await ligne(s, plus(S, 1), { theme: 'Nouveau thème', annonceur: 'Annonceur TBC' })
    const a = await affiche(s, { contNum: l.contNum, theme: 'Ancien thème', themeModifie: true })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id })
    if (enProduction) {
      const i = await f.createInstruction(db, { contNum: l.contNum })
      await f.createFaceTrain(db, {
        instructionCode: i.code,
        contNum: l.contNum,
        statut: 'EXPORT_PREPA',
      })
    }
    return { l, a }
  }

  it('RG-COO-068 alerte « Thème modifié dans Broadcast » : Important avant la production', async () => {
    const s = await site()
    const { l } = await themeModifie(s)
    const tbc = parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'TBC-')
    expect(tbc).toEqual([
      expect.objectContaining({
        type: 'THEME_BC',
        gravite: 'IMPORTANT',
        titre: 'Thème modifié dans Broadcast après la validation',
        destinataires: ['Coordination'],
      }),
    ])
    expect(tbc[0]?.message).toContain(
      'Broadcast indique « Nouveau thème », Circé a « Ancien thème »',
    )
    const ecran = ListeThemesModifiesSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/themes/broadcast?dossier=${String(l.contNum)}`,
          s.users.coord.headers,
        )
      ).json(),
    )
    expect(ecran.lignes).toEqual([
      expect.objectContaining({
        ligneAttendueId: l.id,
        themeCirce: 'Ancien thème',
        themeBroadcast: 'Nouveau thème',
        productionLancee: false,
      }),
    ])
    expect(ecran.indicateurs).toEqual({ total: 1, productionLancee: 0, avantProduction: 1 })
  })

  it('RG-COO-068 production lancée : Critique, chefs d’équipe destinataires ; filtre Production', async () => {
    const s = await site()
    const { l } = await themeModifie(s, true)
    const tbc = parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'TBC-')
    expect(tbc[0]).toMatchObject({
      gravite: 'CRITIQUE',
      titre: 'Thème modifié dans Broadcast, production lancée',
      destinataires: ['Coordination', 'Chefs d’équipe'],
    })
    const avant = ListeThemesModifiesSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/themes/broadcast?dossier=${String(l.contNum)}&production=AVANT`,
          s.users.coord.headers,
        )
      ).json(),
    )
    expect(avant.lignes).toEqual([])
    expect(avant.indicateurs.productionLancee).toBe(1)
  })

  it('RG-COO-068 (ANO-036) affiche non validée : alerte seulement après l’Instruction OK du dossier', async () => {
    const s = await site()
    const l = await ligne(s, plus(S, 1), { theme: 'Thème Broadcast' })
    const a = await affiche(s, { contNum: l.contNum, theme: 'Thème reçu' })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id })
    const q = `dossier=${String(l.contNum)}`
    expect(parCle(await alertes(s.users.coord.headers, q), 'TBC-')).toEqual([])
    await f.createInstruction(db, { contNum: l.contNum, statut: 'INSTRUCTION_OK' })
    expect(parCle(await alertes(s.users.coord.headers, q), 'TBC-')).toHaveLength(1)
    // La validation n'est pas en jeu (RG-COO-030) : l'affiche n'est pas marquée « thème modifié ».
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).themeModifie).toBe(false)
  })

  it('RG-COO-068 rejet : thèmes égaux (casse, accents) → ni alerte ni ligne', async () => {
    const s = await site()
    const l = await ligne(s, S, { theme: 'Été gourmand' })
    const a = await affiche(s, { contNum: l.contNum, theme: 'ETE GOURMAND', themeModifie: true })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l.id })
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`), 'TBC-'),
    ).toEqual([])
  })

  it('RG-COO-068 / RG-X-057 « Reprendre la version BC » : thème de Circé aligné, feuille à refaire, historique, alerte levée', async () => {
    const s = await site()
    const { l, a } = await themeModifie(s)
    const r = await post(
      ctx,
      `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`,
      s.users.coord.headers,
      {
        version: l.version,
      },
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({
      affiches: 1,
      productionLancee: false,
      mailEnvoye: false,
      message: `Thème « Nouveau thème » repris de Broadcast pour le dossier ${String(l.contNum)}.`,
    })
    const apres = await db.affiche.findUniqueOrThrow({ where: { id: a.id } })
    expect(apres).toMatchObject({
      theme: 'Nouveau thème',
      feuilleARefaire: true,
      themeModifie: true,
    })
    expect(apres.version).toBe(a.version + 1)
    const journal = await db.journalAudit.findMany({
      where: {
        OR: [
          { typeEntite: 'AFFICHE', entiteId: String(a.id), action: 'MODIFICATION_THEME' },
          { typeEntite: 'DOSSIER', entiteId: String(l.contNum), action: 'REPRISE_THEME_BROADCAST' },
        ],
      },
    })
    expect(journal).toHaveLength(2)
    expect(journal.every((j) => j.parId === s.users.coord.id)).toBe(true)
    const liste = await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}`)
    expect(parCle(liste, 'TBC-')).toEqual([])
    // RG-X-057 : feuille de stock à refaire côté Réception ; RG-COO-030 : validation à refaire (doute THÈME).
    expect(parCle(liste, 'RG-REC-188').map((x) => x.type)).toEqual(['THEME_MODIF'])
    expect(parCle(liste, 'VA-')).toHaveLength(1)
  })

  it('RG-COO-068 production lancée : message « l’atelier est à prévenir », mail non envoyé (Q-375)', async () => {
    const s = await site()
    const { l } = await themeModifie(s, true)
    const r = await post(
      ctx,
      `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`,
      s.users.admin.headers,
      {
        version: l.version,
      },
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ productionLancee: true, mailEnvoye: false })
    expect(r.json<{ message: string }>().message).toContain('l’atelier est à prévenir')
  })

  it('RG-COO-068 rejets : rien à reprendre (409), version périmée (409), ligne inconnue (404)', async () => {
    const s = await site()
    const { l } = await themeModifie(s)
    const url = `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`
    const v = await post(ctx, url, s.users.coord.headers, { version: l.version + 7 })
    expect(v.statusCode).toBe(409)
    expect(erreur(v).code).toBe('COO_CONFLIT_VERSION')
    expect((await post(ctx, url, s.users.coord.headers, { version: l.version })).statusCode).toBe(
      200,
    )
    const deux = await post(ctx, url, s.users.coord.headers, { version: l.version })
    expect(deux.statusCode).toBe(409)
    expect(erreur(deux)).toMatchObject({ code: 'COO_RIEN_A_REPRENDRE', regle: 'RG-COO-068' })
    expect(
      (
        await post(
          ctx,
          '/api/coordination/themes/broadcast/999999999/reprendre',
          s.users.coord.headers,
          { version: 1 },
        )
      ).statusCode,
    ).toBe(404)
  })

  it('RG-X-057 rejet : l’affiche n’est plus rattachée à la ligne (lien retiré) → 409, rien n’est écrit', async () => {
    const s = await site()
    const { l, a } = await themeModifie(s)
    await db.afficheAttendue.updateMany({ where: { afficheId: a.id }, data: { actif: false } })
    const r = await post(
      ctx,
      `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`,
      s.users.coord.headers,
      {
        version: l.version,
      },
    )
    expect(r.statusCode).toBe(409)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).theme).toBe('Ancien thème')
  })

  it('RG-COO-009 / 167 droits : cheq, recep, expe (403), com (403 RG-COO-168), hors périmètre (403) ; idempotence', async () => {
    const s = await site()
    const { l } = await themeModifie(s)
    const url = `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`
    for (const r of ['cheq', 'recep', 'expe'] as const)
      expect((await post(ctx, url, s.users[r].headers, { version: l.version })).statusCode, r).toBe(
        403,
      )
    const com = await post(ctx, url, s.users.com.headers, { version: l.version })
    expect(erreur(com).regle).toBe('RG-COO-168')
    const t = await site()
    const hors = await post(ctx, url, t.users.coord.headers, { version: l.version })
    expect(hors.statusCode).toBe(403)
    expect(erreur(hors).code).toBe('COO_PERIMETRE_INTERDIT')
    const cle = { 'idempotency-key': `rep-${jeton()}` }
    const h = { ...s.users.coord.headers, ...cle }
    const r1 = await ctx.app.inject({
      method: 'POST',
      url,
      headers: h,
      payload: { version: l.version },
    })
    const r2 = await ctx.app.inject({
      method: 'POST',
      url,
      headers: h,
      payload: { version: l.version },
    })
    expect(r1.statusCode).toBe(200)
    expect(r2.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
  })
})

describe('RG-COO-068 / RG-X-057 ECR-COO-02 « Reprendre la version Broadcast » groupée par dossier', () => {
  const URL = '/api/coordination/themes/broadcast/reprendre-dossier'
  async function deuxLignes(s: Site) {
    const l1 = await ligne(s, plus(S, 1), { theme: 'Nouveau A', annonceur: 'Annonceur Groupé' })
    const l2 = await ligne(s, plus(S, 1), {
      contNum: l1.contNum,
      theme: 'Nouveau B',
      annonceur: 'Annonceur Groupé',
    })
    const a1 = await affiche(s, { contNum: l1.contNum, theme: 'Ancien A', themeModifie: true })
    const a2 = await affiche(s, { contNum: l1.contNum, theme: 'Ancien B', themeModifie: true })
    await f.createRattachement(db, { afficheId: a1.id, ligneAttendueId: l1.id })
    await f.createRattachement(db, { afficheId: a2.id, ligneAttendueId: l2.id })
    return { l1, l2, a1, a2, contNum: l1.contNum ?? 0 }
  }

  it('RG-COO-068 toutes les lignes modifiées du dossier sont reprises en une requête', async () => {
    const s = await site()
    const { l1, l2, a1, a2, contNum } = await deuxLignes(s)
    const r = await post(ctx, URL, s.users.coord.headers, {
      contNum,
      lignes: [
        { ligneAttendueId: l1.id, version: l1.version },
        { ligneAttendueId: l2.id, version: l2.version },
      ],
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ affiches: 2, productionLancee: false, mailEnvoye: false })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a1.id } })).theme).toBe('Nouveau A')
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a2.id } })).theme).toBe('Nouveau B')
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(contNum)}`), 'TBC-'),
    ).toEqual([])
  })

  it('RG-COO-068 atomicité : une ligne en échec (version périmée) → aucune ligne reprise, rien n’est écrit', async () => {
    const s = await site()
    const { l1, l2, a1, a2, contNum } = await deuxLignes(s)
    const avant = await db.journalAudit.count({
      where: { typeEntite: 'DOSSIER', entiteId: String(contNum) },
    })
    const r = await post(ctx, URL, s.users.coord.headers, {
      contNum,
      lignes: [
        { ligneAttendueId: l1.id, version: l1.version },
        { ligneAttendueId: l2.id, version: l2.version + 3 },
      ],
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_CONFLIT_VERSION')
    expect(await db.affiche.findUniqueOrThrow({ where: { id: a1.id } })).toMatchObject({
      theme: 'Ancien A',
      feuilleARefaire: false,
      version: a1.version,
    })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a2.id } })).theme).toBe('Ancien B')
    expect(
      await db.journalAudit.count({ where: { typeEntite: 'DOSSIER', entiteId: String(contNum) } }),
    ).toBe(avant)
  })

  it('RG-COO-068 rejets : ligne d’un autre dossier (400), ligne citée deux fois (400), liste vide (400), droits (403)', async () => {
    const s = await site()
    const { l1, contNum } = await deuxLignes(s)
    const autre = await ligne(s, plus(S, 1), { theme: 'X' })
    const h = s.users.coord.headers
    const v = { ligneAttendueId: l1.id, version: l1.version }
    const etranger = await post(ctx, URL, h, {
      contNum,
      lignes: [v, { ligneAttendueId: autre.id, version: autre.version }],
    })
    expect(etranger.statusCode).toBe(400)
    expect(erreur(etranger).regle).toBe('RG-COO-068')
    expect((await post(ctx, URL, h, { contNum, lignes: [v, v] })).statusCode).toBe(400)
    expect((await post(ctx, URL, h, { contNum, lignes: [] })).statusCode).toBe(400)
    for (const r of ['cheq', 'recep', 'expe', 'com'] as const)
      expect(
        (await post(ctx, URL, s.users[r].headers, { contNum, lignes: [v] })).statusCode,
        r,
      ).toBe(403)
    expect(
      (await db.affiche.findMany({ where: { contNum } })).every((a) =>
        a.theme?.startsWith('Ancien'),
      ),
    ).toBe(true)
  })

  it('RG-COO-068 idempotence : même clé rejouée → même réponse, une seule reprise', async () => {
    const s = await site()
    const { l1, contNum } = await deuxLignes(s)
    const headers = { ...s.users.coord.headers, 'idempotency-key': `grp-${jeton()}` }
    const body = { contNum, lignes: [{ ligneAttendueId: l1.id, version: l1.version }] }
    const r1 = await ctx.app.inject({ method: 'POST', url: URL, headers, payload: body })
    const r2 = await ctx.app.inject({ method: 'POST', url: URL, headers, payload: body })
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r2.statusCode).toBe(200)
    expect(r2.json()).toEqual(r1.json())
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'DOSSIER',
          entiteId: String(contNum),
          action: 'REPRISE_THEME_BROADCAST',
        },
      }),
    ).toBe(1)
  })
})

describe('RG-COO-069 / 070 vérification des thèmes et des annonceurs proches', () => {
  async function deuxDossiers(s: Site, t1: string, t2: string) {
    const annonceur = `Annonceur ${jeton()}`
    const d1 = await f.createDossier(db, { annonceur })
    const d2 = await f.createDossier(db, { annonceur })
    const l1 = await ligne(s, plus(S, 1), { contNum: d1.contNum, theme: t1, annonceur })
    const l2 = await ligne(s, plus(S, 2), { contNum: d2.contNum, theme: t2, annonceur })
    return { annonceur, d1, d2, l1, l2 }
  }
  const proches = async (s: Site, qs: string) => {
    const r = await get(ctx, `/api/coordination/themes/proches?${qs}`, s.users.coord.headers)
    expect(r.statusCode, r.body).toBe(200)
    return ListeThemesProchesSchema.parse(r.json())
  }

  it('RG-COO-069 deux intitulés proches d’un même annonceur forment un groupe « À vérifier » et une alerte', async () => {
    const s = await site()
    const { d1, d2 } = await deuxDossiers(s, 'Menu burger', 'MENU BURGERS')
    const l = await proches(s, `dossier=${String(d1.contNum)}`)
    expect(l.groupes).toHaveLength(1)
    expect(l.groupes[0]).toMatchObject({
      statut: 'A_VERIFIER',
      depart: formatSemaineIso(plus(S, 1)),
    })
    expect(l.groupes[0]?.dossiers.map((d) => d.contNum)).toEqual([d1.contNum, d2.contNum])
    expect(l.seuil).toBe(0.85)
    const th = parCle(await alertes(s.users.coord.headers, `dossier=${String(d2.contNum)}`), 'TH-')
    expect(th).toEqual([
      expect.objectContaining({
        type: 'THEMES_PROCHES',
        regle: 'RG-COO-069',
        gravite: 'A_SURVEILLER',
      }),
    ])
  })

  it('RG-COO-069 même intitulé sur deux dossiers : « Même intitulé », pas d’alerte', async () => {
    const s = await site()
    const { d1 } = await deuxDossiers(s, 'Rentrée', 'Rentrée')
    const l = await proches(s, `dossier=${String(d1.contNum)}&etat=TOUS`)
    expect(l.groupes.map((g) => g.statut)).toEqual(['MEME_INTITULE'])
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(d1.contNum)}`), 'TH-'),
    ).toEqual([])
  })

  it('RG-COO-069 rejet : intitulés éloignés, ou annonceurs différents → pas de groupe', async () => {
    const s = await site()
    const { d1 } = await deuxDossiers(s, 'Printemps', 'Rentrée scolaire')
    expect((await proches(s, `dossier=${String(d1.contNum)}&etat=TOUS`)).groupes).toEqual([])
    const a = await f.createDossier(db, { annonceur: `X ${jeton()}` })
    const b = await f.createDossier(db, { annonceur: `Y ${jeton()}` })
    await ligne(s, plus(S, 1), { contNum: a.contNum, theme: 'Menu burger' })
    await ligne(s, plus(S, 1), { contNum: b.contNum, theme: 'Menu burgers' })
    expect((await proches(s, `dossier=${String(a.contNum)}&etat=TOUS`)).groupes).toEqual([])
  })

  it('RG-COO-069 « Demander la correction » : une demande par dossier à corriger, état du dossier inchangé, alerte levée', async () => {
    const s = await site()
    const { d1, d2 } = await deuxDossiers(s, 'Menu burger', 'MENU BURGERS')
    const g = (await proches(s, `dossier=${String(d1.contNum)}`)).groupes[0]
    if (!g) throw new Error('groupe')
    const r = await post(ctx, '/api/coordination/themes/demandes', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      correct: 'Menu burger',
      note: 'à harmoniser',
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ dossiers: 1 })
    expect(r.json<{ message: string }>().message).toContain('Q-375')
    const demandes = await db.demandeTheme.findMany({ where: { cle: g.cle } })
    expect(demandes).toEqual([
      expect.objectContaining({
        contNum: d2.contNum,
        ancien: 'MENU BURGERS',
        nouveau: 'Menu burger',
        mailEnvoye: false,
      }),
    ])
    expect((await db.dossier.findUniqueOrThrow({ where: { id: d2.id } })).statut).toBe(d2.statut)
    const apres = await proches(s, `dossier=${String(d1.contNum)}`)
    expect(apres.groupes[0]?.statut).toBe('DEMANDE_ENVOYEE')
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(d1.contNum)}`), 'TH-'),
    ).toEqual([])
    expect(
      await db.journalAudit.count({
        where: { action: 'DEMANDE_CORRECTION_THEME', entiteId: String(d2.contNum) },
      }),
    ).toBe(1)
    // Broadcast renvoie la prépa corrigée : le groupe devient « Même intitulé » et la demande « Corrigé ».
    await db.receptionAttendue.updateMany({
      where: { contNum: d2.contNum },
      data: { theme: 'Menu burger' },
    })
    const traites = await proches(s, `dossier=${String(d2.contNum)}&etat=TRAITES`)
    expect(traites.groupes.map((x) => x.statut)).toEqual(['CORRIGE'])
  })

  it('RG-COO-069 rejets : déjà demandée (409), intitulé hors groupe (422), groupe changé (409), production lancée partout (422)', async () => {
    const s = await site()
    const { d1, d2 } = await deuxDossiers(s, 'Menu burger', 'MENU BURGERS')
    const g = (await proches(s, `dossier=${String(d1.contNum)}`)).groupes[0]
    if (!g) throw new Error('groupe')
    const inconnu = await post(ctx, '/api/coordination/themes/demandes', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      correct: 'Autre',
    })
    expect(inconnu.statusCode).toBe(422)
    expect(erreur(inconnu)).toMatchObject({ code: 'COO_INTITULE_INCONNU', regle: 'RG-COO-069' })
    const change = await post(ctx, '/api/coordination/themes/demandes', s.users.coord.headers, {
      type: 'THEMES',
      cle: `${g.cle}|zz`,
      correct: 'Menu burger',
    })
    expect(change.statusCode).toBe(409)
    expect(erreur(change).code).toBe('COO_GROUPE_CHANGE')
    // Production lancée sur le seul dossier à corriger : rien à demander.
    const i = await f.createInstruction(db, { contNum: d2.contNum, statut: 'PRET_A_PRODUIRE' })
    const prod = await post(ctx, '/api/coordination/themes/demandes', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      correct: 'Menu burger',
    })
    expect(prod.statusCode).toBe(422)
    expect(erreur(prod)).toMatchObject({
      code: 'COO_PRODUCTION_LANCEE',
      message: 'Rien à demander : la production est lancée sur ces dossiers. Voir avec l’atelier.',
    })
    await db.instruction.update({ where: { code: i.code }, data: { statut: 'ANNULE' } })
    expect(
      (
        await post(ctx, '/api/coordination/themes/demandes', s.users.coord.headers, {
          type: 'THEMES',
          cle: g.cle,
          correct: 'Menu burger',
        })
      ).statusCode,
    ).toBe(200)
    const deja = await post(ctx, '/api/coordination/themes/demandes', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      correct: 'Menu burger',
    })
    expect(deja.statusCode).toBe(409)
    expect(erreur(deja).code).toBe('COO_VERIFICATION_DEJA_TRAITEE')
  })

  it('RG-COO-069 « Visuels différents » lève l’alerte ; « Rouvrir » la rétablit ; rouvrir sans décision : 409', async () => {
    const s = await site()
    const { d1 } = await deuxDossiers(s, 'Menu burger', 'MENU BURGERS')
    const g = (await proches(s, `dossier=${String(d1.contNum)}`)).groupes[0]
    if (!g) throw new Error('groupe')
    const v = await post(ctx, '/api/coordination/themes/verdicts', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      verdict: 'DIFFERENTS',
    })
    expect(v.statusCode, v.body).toBe(200)
    expect(v.json<{ message: string }>().message).toBe(
      'Noté : ce sont des visuels différents. L’alerte est levée.',
    )
    expect((await proches(s, `dossier=${String(d1.contNum)}`)).groupes[0]?.statut).toBe(
      'DIFFERENTS',
    )
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(d1.contNum)}`), 'TH-'),
    ).toEqual([])
    const encore = await post(ctx, '/api/coordination/themes/verdicts', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      verdict: 'DIFFERENTS',
    })
    expect(encore.statusCode).toBe(409)
    const r = await post(ctx, '/api/coordination/themes/verdicts', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      verdict: 'ROUVRIR',
    })
    expect(r.statusCode).toBe(200)
    expect((await proches(s, `dossier=${String(d1.contNum)}`)).groupes[0]?.statut).toBe(
      'A_VERIFIER',
    )
    const r2 = await post(ctx, '/api/coordination/themes/verdicts', s.users.coord.headers, {
      type: 'THEMES',
      cle: g.cle,
      verdict: 'ROUVRIR',
    })
    expect(r2.statusCode).toBe(409)
    expect(erreur(r2).code).toBe('COO_VERIFICATION_SANS_DECISION')
  })

  it('RG-COO-070 noms d’annonceurs proches : groupe et alerte ; un regroupement (« *MISTRAL* ») ne signale pas', async () => {
    const s = await site()
    const tok = jeton()
    const a = await f.createDossier(db, { annonceur: `Brasserie du Port ${tok}` })
    const b = await f.createDossier(db, { annonceur: `BRASSERIE PORT ${tok}` })
    await ligne(s, plus(S, 1), { contNum: a.contNum, theme: null })
    await ligne(s, plus(S, 1), { contNum: b.contNum, theme: null })
    const r = await get(
      ctx,
      `/api/coordination/themes/annonceurs?dossier=${String(a.contNum)}`,
      s.users.coord.headers,
    )
    const l = ListeAnnonceursProchesSchema.parse(r.json())
    expect(l.groupes).toHaveLength(1)
    expect(l.groupes[0]?.noms.map((x) => x.nom).sort()).toEqual(
      [`BRASSERIE PORT ${tok}`, `Brasserie du Port ${tok}`].sort(),
    )
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(b.contNum)}`), 'AN-')[0],
    ).toMatchObject({ type: 'ANNONCEURS_PROCHES', regle: 'RG-COO-070' })
    const m1 = await f.createDossier(db, { annonceur: `MISTRAL Nîmes ${tok}` })
    const m2 = await f.createDossier(db, { annonceur: `Mistral Vence ${tok}` })
    await ligne(s, plus(S, 1), { contNum: m1.contNum })
    await ligne(s, plus(S, 1), { contNum: m2.contNum })
    const m = ListeAnnonceursProchesSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/themes/annonceurs?dossier=${String(m1.contNum)}&etat=TOUS`,
          s.users.coord.headers,
        )
      ).json(),
    )
    expect(m.groupes).toEqual([])
  })

  it('RG-COO-070 annonceurs proches : leurs thèmes sont comparés entre eux ; « Annonceurs différents » arrête la comparaison', async () => {
    const s = await site()
    const tok = jeton()
    const a = await f.createDossier(db, { annonceur: `Brasserie du Port ${tok}` })
    const b = await f.createDossier(db, { annonceur: `BRASSERIE PORT ${tok}` })
    await ligne(s, plus(S, 1), { contNum: a.contNum, theme: 'Menu burger' })
    await ligne(s, plus(S, 1), { contNum: b.contNum, theme: 'MENU BURGERS' })
    expect((await proches(s, `dossier=${String(a.contNum)}`)).groupes).toHaveLength(1)
    const g = ListeAnnonceursProchesSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/themes/annonceurs?dossier=${String(a.contNum)}`,
          s.users.coord.headers,
        )
      ).json(),
    ).groupes[0]
    if (!g) throw new Error('groupe')
    const v = await post(ctx, '/api/coordination/themes/verdicts', s.users.coord.headers, {
      type: 'ANNONCEURS',
      cle: g.cle,
      verdict: 'DIFFERENTS',
    })
    expect(v.json<{ message: string }>().message).toBe(
      'Noté : ce sont des annonceurs différents. Leurs thèmes ne sont plus comparés entre eux.',
    )
    expect((await proches(s, `dossier=${String(a.contNum)}&etat=TOUS`)).groupes).toEqual([])
  })

  it('RG-COO-075 / RG-COO-009 droits : consultation coord / admin seulement ; actions refusées à cheq et com', async () => {
    const s = await site()
    for (const r of ['coord', 'admin'] as const)
      expect(
        (await get(ctx, '/api/coordination/themes/proches', s.users[r].headers)).statusCode,
      ).toBe(200)
    for (const r of ['cheq', 'recep', 'expe', 'com'] as const)
      for (const vue of ['proches', 'annonceurs', 'broadcast'])
        expect(
          (await get(ctx, `/api/coordination/themes/${vue}`, s.users[r].headers)).statusCode,
          `${r} ${vue}`,
        ).toBe(403)
    const { d1 } = await deuxDossiers(s, 'Menu burger', 'MENU BURGERS')
    const g = (await proches(s, `dossier=${String(d1.contNum)}`)).groupes[0]
    if (!g) throw new Error('groupe')
    for (const r of ['cheq', 'com'] as const) {
      const res = await post(ctx, '/api/coordination/themes/verdicts', s.users[r].headers, {
        type: 'THEMES',
        cle: g.cle,
        verdict: 'DIFFERENTS',
      })
      expect(res.statusCode, r).toBe(403)
    }
  })

  it('RG-COO-167 périmètre : les thèmes d’un autre site ne sont pas comparés pour un coordinateur de site', async () => {
    const s = await site()
    const t = await site()
    const annonceur = `Annonceur ${jeton()}`
    const a = await f.createDossier(db, { annonceur })
    const b = await f.createDossier(db, { annonceur })
    await ligne(s, plus(S, 1), { contNum: a.contNum, theme: 'Menu burger' })
    await ligne(t, plus(S, 1), { contNum: b.contNum, theme: 'MENU BURGERS' })
    expect((await proches(s, `dossier=${String(a.contNum)}`)).groupes).toEqual([])
    const admin = ListeThemesProchesSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/themes/proches?dossier=${String(a.contNum)}`,
          s.users.admin.headers,
        )
      ).json(),
    )
    expect(admin.groupes).toHaveLength(1)
  })
})

describe('RG-COO-053 / 073 / 074 rajout après préparation et dernière minute', () => {
  async function renvoi(s: Site, statut: string, le = new Date()) {
    const atelier = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const d = await f.createDossier(db, { annonceur: 'Renvoi' })
    const i = await f.createInstruction(db, {
      contNum: d.contNum,
      atelierId: atelier.id,
      statut: 'INSTRUCTION_OK',
      contAnbas: plus(S, 1).annee,
      contSembas: plus(S, 1).semaine,
    })
    await f.createJournalAudit(db, {
      typeEntite: 'INSTRUCTION',
      entiteId: i.code,
      action: 'RENVOI_BROADCAST_IGNORE',
      ancienneValeur: statut,
      le,
    })
    return { d, i }
  }

  it('RG-COO-053 renvoi ignoré après l’Instruction OK : alerte « Rajout après préparation » (Important)', async () => {
    const s = await site()
    const { d } = await renvoi(s, 'INSTRUCTION_OK')
    const a = parCle(await alertes(s.users.coord.headers, `dossier=${String(d.contNum)}`), 'RB-')
    expect(a).toEqual([
      expect.objectContaining({
        type: 'APRES_LIBERATION',
        regle: 'RG-COO-053',
        gravite: 'IMPORTANT',
      }),
    ])
  })

  it('RG-COO-074 production lancée : « Dernière minute sur fichier envoyé » (Critique), chefs d’équipe prévenus', async () => {
    const s = await site()
    const { d, i } = await renvoi(s, 'PRET_A_PRODUIRE')
    await f.createFaceTrain(db, {
      instructionCode: i.code,
      contNum: d.contNum,
      statut: 'AU_ROULAGE',
    })
    const a = parCle(await alertes(s.users.coord.headers, `dossier=${String(d.contNum)}`), 'RB-')
    expect(a[0]).toMatchObject({
      type: 'DM_FICHIER',
      regle: 'RG-COO-074',
      gravite: 'CRITIQUE',
      destinataires: ['Coordination', 'Chefs d’équipe'],
    })
  })

  it('RG-COO-053 rejet : renvoi d’une instruction annulée (ignoré sans alerte) ou trop ancien', async () => {
    const s = await site()
    const { d } = await renvoi(s, 'ANNULE')
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(d.contNum)}`), 'RB-'),
    ).toEqual([])
    const vieux = await renvoi(s, 'INSTRUCTION_OK', new Date(Date.now() - 30 * 86_400_000))
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(vieux.d.contNum)}`), 'RB-'),
    ).toEqual([])
  })

  it('RG-COO-073 prépa intégrée dans la fenêtre (vendredi S-2 → vendredi S) : alerte ; hors fenêtre : rien', async () => {
    const s = await site()
    const dans = await f.createDossier(db)
    await ligne(s, plus(S, 1), { contNum: dans.contNum })
    const hors = await f.createDossier(db)
    await ligne(s, plus(S, 4), { contNum: hors.contNum })
    // Mercredi de la semaine S à midi : dans la fenêtre de S+1 (vendredi S-1 → vendredi S+1), pas de S+4.
    const le = new Date(lundiSemaineIso(S).getTime() + 2 * 86_400_000 + 12 * 3_600_000)
    for (const d of [dans, hors])
      await f.createJournalAudit(db, {
        typeEntite: 'DOSSIER',
        entiteId: String(d.contNum),
        action: 'INTEGRATION_PREPARATION',
        le,
      })
    const id = await identite(s.users.coord.ext)
    const apres = new Date(le.getTime() + 3_600_000)
    const a = await listerAlertesPilotage(
      db,
      id,
      { etat: 'OUVERTES', dossier: dans.contNum },
      apres,
    )
    expect(parCle(a, 'RP-')).toEqual([
      expect.objectContaining({
        type: 'APRES_LIBERATION',
        regle: 'RG-COO-073',
        destinataires: ['Chefs d’équipe', 'Administrateur', 'Coordination'],
      }),
    ])
    expect(parCle(a, 'RP-')[0]?.message).toContain('non envoyé par Circé (Q-375)')
    const b = await listerAlertesPilotage(
      db,
      id,
      { etat: 'OUVERTES', dossier: hors.contNum },
      apres,
    )
    expect(parCle(b, 'RP-')).toEqual([])
  })
})

describe('RG-COO-103 / 116 / 122 / 081 alertes techniques de l’intégration', () => {
  it('RG-COO-116 / 103 dernier passage en échec, puis deux de suite : alertes ; un succès les lève', async () => {
    const s = await site()
    const p1 = await db.passageIntegration.create({
      data: {
        declencheur: 'MANUEL',
        statut: 'ECHEC',
        fin: new Date(),
        message: 'Source injoignable',
      },
    })
    let l = await alertes(s.users.admin.headers, 'type=INTEGRATION')
    expect(parCle(l, `INT-ECHEC-${String(p1.id)}`)).toHaveLength(1)
    expect(parCle(l, 'INT-ECHECS-')).toEqual([])
    const p2 = await db.passageIntegration.create({
      data: {
        declencheur: 'PLANIFIE',
        statut: 'ECHEC',
        fin: new Date(),
        message: 'Source injoignable',
      },
    })
    await db.fluxChargement.create({
      data: { passageId: p2.id, flux: 'TRAINS', ordre: 4, statut: 2, message: 'Délai dépassé' },
    })
    l = await alertes(s.users.coord.headers, 'type=INTEGRATION')
    expect(parCle(l, `INT-ECHEC-${String(p2.id)}`)[0]?.message).toContain('flux TRAINS')
    expect(parCle(l, `INT-ECHECS-${String(p2.id)}`)[0]).toMatchObject({ regle: 'RG-COO-103' })
    // Technique : invisible sans le droit des chargements (cheq).
    expect(parCle(await alertes(s.users.cheq.headers, 'type=INTEGRATION'), 'INT-')).toEqual([])
    await db.passageIntegration.create({
      data: { declencheur: 'MANUEL', statut: 'SUCCES', fin: new Date() },
    })
    expect(parCle(await alertes(s.users.admin.headers, 'type=INTEGRATION'), 'INT-')).toEqual([])
  })

  it('RG-COO-122 prépa renvoyée non intégrée et RG-COO-081 thème sans n° : alertes de la Coordination', async () => {
    const s = await site()
    const contNum = 900_000 + next()
    await ligne(s, plus(S, 1), { contNum })
    await f.createJournalAudit(db, {
      typeEntite: 'DOSSIER',
      entiteId: String(contNum),
      action: 'PREPA_RENVOYEE_NON_INTEGREE',
      nouvelleValeur: 'Prépa renvoyée non intégrée : détail 12 déjà intégré (à débloquer d’abord).',
    })
    await f.createJournalAudit(db, {
      typeEntite: 'LIGNE_ATTENDUE',
      entiteId: '0',
      action: 'ALERTE_ALIMENTATION',
      donnees: JSON.stringify({
        type: 'THEME_SANS_NUMERO',
        regle: 'RG-COO-081',
        message: 'Thème « X » lu sans n° de thème',
        contNum,
        plateformeId: s.plateforme.id,
      }),
    })
    const l = await alertes(s.users.coord.headers, `dossier=${String(contNum)}`)
    expect(parCle(l, 'PRNI-')[0]).toMatchObject({ type: 'INTEGRATION', regle: 'RG-COO-122' })
    expect(parCle(l, 'ALIM-')[0]).toMatchObject({
      type: 'INTEGRATION',
      regle: 'RG-COO-081',
      titre: 'Thème lu sans n° de thème',
    })
    // Un autre site ne voit pas l'alerte d'alimentation de ce site.
    const t = await site()
    expect(
      parCle(await alertes(t.users.coord.headers, `dossier=${String(contNum)}`), 'ALIM-'),
    ).toEqual([])
  })
})

describe('RG-COO-030 / 068 / RG-X-057 chaîne réelle : passage d’intégration → alerte → reprise', () => {
  /** Port Broadcast en mémoire (lot lu par le passage d'intégration réel, comme le connecteur). */
  const port = (lot: Partial<LotIntegration>): BroadcastPort => ({
    nom: 'memoire',
    configure: true,
    lireLot: () =>
      Promise.resolve({ idInterface: 1, lectureComplete: false, lueLe: new Date(), ...lot }),
    envoyer: () => Promise.resolve(),
  })
  const passer = (lot: Partial<LotIntegration>) =>
    lancerPassage({ db, broadcast: port(lot) }, { declencheur: 'PLANIFIE', identity: null })

  it('RG-COO-030 thème changé dans Broadcast sur une affiche validée : alertes « Thème modifié » et « Validation à confirmer », puis reprise', async () => {
    const s = await site()
    const idSiteCcf = 60_000 + next()
    await db.plateforme.update({ where: { id: s.plateforme.id }, data: { idSiteCcf } })
    const idSurface = 800 + next()
    const idFormat = 1_300 + next()
    await db.correspondanceSupport.create({
      data: { idSurface, idFormat, supportId: s.support.id },
    })
    const contNum = 910_000 + next()
    const edr = (theme: string): LigneEtatReservations => ({
      idSiteCcf,
      destinataire: 'Plateforme test',
      contNum,
      annonceur: 'ANNONCEUR P07',
      idSurface,
      idFormat,
      idPreparationChapeau: 77,
      idTypePreparation: 1,
      surface: '2m2',
      format: '120x176',
      idTheme: 5,
      theme,
      idThemeBandeau: null,
      bandeau: null,
      idDaChapeau: 4242,
      semaine: plus(S, 1),
      quantite: 100,
      estResteEnPlace: false,
      statutPreparation: null,
      assistantCommercial: 'Dupont',
      assistantLogistique: 'Martin',
    })
    expect((await passer({ etatReservations: [edr('Thème A')] })).statut).toBe('SUCCES')
    const l = await db.receptionAttendue.findFirstOrThrow({
      where: { contNum, etatLigne: 'ACTIVE' },
    })
    const bl = await bonDeLivraison(ctx, s.users.recep.headers, [
      { ligneAttendueId: l.id, quantite: 10 },
    ])
    const rec = await post(ctx, '/api/receptions', s.users.recep.headers, bl)
    expect(rec.statusCode, rec.body).toBe(201)
    const afficheId = rec.json<{ affiches: { id: number }[] }>().affiches[0]?.id ?? 0
    const a = await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })
    const v = await post(
      ctx,
      `/api/coordination/affiches/${String(afficheId)}/validation-admin`,
      s.users.coord.headers,
      {
        version: a.version,
        valider: true,
      },
    )
    expect(v.statusCode, v.body).toBe(200)
    expect((await passer({ etatReservations: [edr('Thème B')] })).statut).toBe('SUCCES')
    const liste = await alertes(s.users.coord.headers, `dossier=${String(contNum)}`)
    expect(parCle(liste, 'TBC-')[0]?.message).toContain(
      'Broadcast indique « Thème B », Circé a « Thème A »',
    )
    expect(parCle(liste, `VA-${String(afficheId)}`)).toHaveLength(1)
    const ligneMaj = await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })
    const r = await post(
      ctx,
      `/api/coordination/themes/broadcast/${String(l.id)}/reprendre`,
      s.users.coord.headers,
      {
        version: ligneMaj.version,
      },
    )
    expect(r.statusCode, r.body).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: afficheId } })).theme).toBe('Thème B')
    expect(
      parCle(await alertes(s.users.coord.headers, `dossier=${String(contNum)}`), 'TBC-'),
    ).toEqual([])
  })
})

describe('ANO-035 volume : liste des dossiers et alertes au-delà de la limite de paramètres de SQLite', () => {
  it('RG-COO-167 / RG-COO-066 plus de 1 500 dossiers : la liste (ECR-COO-01) et les alertes répondent', async () => {
    const s = await site()
    const base = 3_000_000 + next() * 2_000
    await db.dossier.createMany({
      data: Array.from({ length: 1_600 }, (_, i) => ({
        contNum: base + i,
        statut: 'A_TRAITER' as const,
      })),
    })
    const d = await f.createDossier(db)
    await ligne(s, plus(S, 1), { contNum: d.contNum })
    const r = await get(ctx, '/api/coordination/dossiers?pageSize=100', s.users.coord.headers)
    expect(r.statusCode, r.body).toBe(200)
    expect(ListeDossiersSchema.parse(r.json()).total).toBeGreaterThan(0)
    expect((await get(ctx, '/api/alertes', s.users.admin.headers)).statusCode).toBe(200)
  })
})

describe('ECR-COO-02 / ECR-COO-01 fiche et liste des dossiers : thème modifié dans Broadcast, thème proche', () => {
  it('RG-COO-068 / 069 la fiche expose les deux encadrés ; la liste, les pastilles « Visuels »', async () => {
    const s = await site()
    const annonceur = `Annonceur ${jeton()}`
    const d1 = await f.createDossier(db, { annonceur })
    const d2 = await f.createDossier(db, { annonceur })
    const l1 = await ligne(s, plus(S, 1), { contNum: d1.contNum, theme: 'Menu burger', annonceur })
    await ligne(s, plus(S, 1), { contNum: d2.contNum, theme: 'MENU BURGERS', annonceur })
    const a = await affiche(s, { contNum: d1.contNum, theme: 'Ancien', themeModifie: true })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l1.id })
    const r = await get(ctx, `/api/coordination/dossiers/${String(d1.id)}`, s.users.coord.headers)
    expect(r.statusCode, r.body).toBe(200)
    const fiche = FicheDossierSchema.parse(r.json())
    expect(fiche.themesModifies).toEqual([
      {
        ligneAttendueId: l1.id,
        version: l1.version,
        themeCirce: 'Ancien',
        themeBroadcast: 'Menu burger',
        productionLancee: false,
      },
    ])
    expect(fiche.themesProches).toEqual([expect.objectContaining({ autresDossiers: [d2.contNum] })])
    expect(fiche.pastillesVisuels).toEqual({ nb: 1, procheAVerifier: true, modifieBroadcast: true })
    const liste = ListeDossiersSchema.parse(
      (
        await get(
          ctx,
          `/api/coordination/dossiers?dossier=${String(d2.contNum)}`,
          s.users.coord.headers,
        )
      ).json(),
    )
    expect(liste.items[0]?.pastillesVisuels).toEqual({
      nb: 1,
      procheAVerifier: true,
      modifieBroadcast: false,
    })
  })

  it('RG-COO-068 / 069 rejet : dossier sans écart de thème ni thème proche → ni encadré ni pastille', async () => {
    const s = await site()
    const d = await f.createDossier(db, { annonceur: `Annonceur ${jeton()}` })
    await ligne(s, plus(S, 1), { contNum: d.contNum, theme: 'Seul' })
    const fiche = FicheDossierSchema.parse(
      (await get(ctx, `/api/coordination/dossiers/${String(d.id)}`, s.users.coord.headers)).json(),
    )
    expect(fiche.themesModifies).toEqual([])
    expect(fiche.themesProches).toEqual([])
    expect(fiche.pastillesVisuels).toEqual({
      nb: 1,
      procheAVerifier: false,
      modifieBroadcast: false,
    })
  })
})

describe('ECR-THM-01 / 03 « + Filtre » Atelier et colonne « Statut pré-production »', () => {
  it('RG-COO-069 / 068 le filtre Atelier ne garde que les groupes et lignes de cet atelier', async () => {
    const s = await site()
    const at1 = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const at2 = await f.createAtelier(db, { plateformeId: s.plateforme.id })
    const annonceur = `Annonceur ${jeton()}`
    const d1 = await f.createDossier(db, { annonceur, statut: 'PREPARATION_RECUE' })
    const d2 = await f.createDossier(db, { annonceur })
    const l1 = await ligne(s, plus(S, 1), {
      contNum: d1.contNum,
      theme: 'Menu burger',
      atelierId: at1.id,
    })
    await ligne(s, plus(S, 1), { contNum: d2.contNum, theme: 'MENU BURGERS', atelierId: at1.id })
    const a = await affiche(s, { contNum: d1.contNum, theme: 'Ancien', themeModifie: true })
    await f.createRattachement(db, { afficheId: a.id, ligneAttendueId: l1.id })
    const lire = async (vue: string, at: number) =>
      (
        await get(
          ctx,
          `/api/coordination/themes/${vue}?dossier=${String(d1.contNum)}&atelierId=${String(at)}`,
          s.users.coord.headers,
        )
      ).json<{
        groupes?: unknown[]
        lignes?: { preparation: string }[]
      }>()
    expect((await lire('proches', at1.id)).groupes).toHaveLength(1)
    expect((await lire('proches', at2.id)).groupes).toHaveLength(0)
    const bc = await lire('broadcast', at1.id)
    expect(bc.lignes?.map((x) => x.preparation)).toEqual(['Préparation reçue'])
    expect((await lire('broadcast', at2.id)).lignes).toHaveLength(0)
  })
})

describe('RG-COO-031 / 067 une seule alerte « Écart Broadcast / Circé » par dossier', () => {
  it('RG-COO-031 écart calculé et quantité modifiée après validation sur le même dossier : une seule alerte (BC-)', async () => {
    const s = await site()
    const l = await ligne(s, S, { qteBc: 120, qtePrepa: 100 })
    await f.createJournalAudit(db, {
      typeEntite: 'LIGNE_ATTENDUE',
      entiteId: String(l.id),
      action: 'ALERTE_ALIMENTATION',
      donnees: JSON.stringify({
        type: 'ECART_QUANTITE',
        regle: 'RG-COO-031',
        message: 'Quantité modifiée',
        contNum: l.contNum,
        plateformeId: s.plateforme.id,
      }),
    })
    const liste = await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}&type=ECART_BC`)
    expect(liste.alertes.map((a) => a.cle)).toEqual([`BC-${String(l.contNum)}`])
  })

  it('RG-COO-031 sans écart calculé : l’alerte de quantité modifiée (QTE-) est affichée une fois', async () => {
    const s = await site()
    const l = await ligne(s, S, { qteBc: 120 })
    for (let i = 0; i < 2; i++)
      await f.createJournalAudit(db, {
        typeEntite: 'LIGNE_ATTENDUE',
        entiteId: String(l.id),
        action: 'ALERTE_ALIMENTATION',
        donnees: JSON.stringify({
          type: 'ECART_QUANTITE',
          regle: 'RG-COO-031',
          message: `Quantité modifiée ${String(i)}`,
          contNum: l.contNum,
          plateformeId: s.plateforme.id,
        }),
      })
    const liste = await alertes(s.users.coord.headers, `dossier=${String(l.contNum)}&type=ECART_BC`)
    expect(liste.alertes).toHaveLength(1)
    expect(liste.alertes[0]).toMatchObject({ regle: 'RG-COO-031', message: 'Quantité modifiée 1' })
  })
})
