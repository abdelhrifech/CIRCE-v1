// Étape 8 (D-08) — tests d'INTÉGRATION de la configuration des règles d'alerte (ECR-ADM-04, RG-REC-190, EX-TRA-029) :
// canal et destinataires par type (déclencheur et seuil en lecture seule), droit `parametrage.gerer`, verrou de
// version (0 = jamais configurée), journal, et EFFETS dans Pilotage › Alertes (type « Désactivée » masqué,
// destinataires configurés substitués). Aucun mail n'est envoyé (Q-375). Hypothèses : Q-408. La table `regle_alerte`
// est globale : vidée avant et après chaque test (fichiers d'intégration exécutés en série). Aucun test unitaire.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  CATALOGUE_ALERTES,
  ListeAlertesSchema,
  RegleAlerteAdminSchema,
  ReglesAlerteAdminSchema,
  TYPES_ALERTE,
  type Role,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

beforeAll(() => ctx.demarrer())
const vider = () => db.regleAlerte.deleteMany({})
beforeEach(vider)
afterEach(vider)
afterAll(() => ctx.arreter())

async function acteurs() {
  const plateforme = await f.createPlateforme(db)
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, users }
}

const regles = async (h: H) =>
  ReglesAlerteAdminSchema.parse((await get(ctx, '/api/admin/alertes/regles', h)).json()).regles
const modifier = (h: H, type: string, corps: unknown) =>
  ctx.app.inject({
    method: 'PUT',
    url: `/api/admin/alertes/regles/${type}`,
    headers: h,
    payload: corps as object,
  })
/** Une réception inconnue à identifier produit une alerte ORPHELINE (RG-REC-185) sur sa plateforme. */
async function alerteOrpheline(plateformeId: number, h: H) {
  const r = await f.createReception(db, { plateformeId, statut: 'A_IDENTIFIER' })
  const liste = ListeAlertesSchema.parse(
    (await get(ctx, `/api/alertes?type=ORPHELINE&site=${String(plateformeId)}`, h)).json(),
  )
  return { reception: r, alertes: liste.alertes }
}

describe('D-08 RG-REC-190 lecture des règles', () => {
  it('RG-REC-190 les 18 types dans l’ordre du catalogue, avec déclencheur, seuil, règles, canal Bandeau et version 0 par défaut', async () => {
    const { users } = await acteurs()
    const lues = await regles(users.admin)
    expect(lues.map((r) => r.type)).toEqual([...TYPES_ALERTE])
    for (const r of lues) {
      expect(r).toMatchObject({
        canal: 'BANDEAU',
        destinataires: [],
        version: 0,
        declencheur: CATALOGUE_ALERTES[r.type].declencheur,
        calculee: CATALOGUE_ALERTES[r.type].calculee,
      })
    }
    expect(lues.find((r) => r.type === 'DEPART_RISQUE')?.calculee).toBe(false)
  })

  it('RG-REC-190 le seuil porte la valeur courante du paramètre métier (D-06)', async () => {
    const { users } = await acteurs()
    const ecart = await db.parametre.findFirst({
      where: { cle: 'reception.ecartReception', plateformeId: null },
    })
    const lues = await regles(users.admin)
    expect(lues.find((r) => r.type === 'ECART')?.valeurSeuil).toBe(ecart?.valeur ?? null)
    expect(lues.find((r) => r.type === 'SANS_IP')?.valeurSeuil).toBeNull()
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne configure pas les alertes : 403 en lecture et en modification',
    async (role) => {
      const { users } = await acteurs()
      const l = await get(ctx, '/api/admin/alertes/regles', users[role])
      expect(l.statusCode).toBe(403)
      expect(erreur(l).regle).toBe('RG-REC-002')
      const m = await modifier(users[role], 'ECART', { version: 0, canal: 'DESACTIVEE' })
      expect(m.statusCode).toBe(403)
      expect(await db.regleAlerte.count()).toBe(0)
    },
  )

  it('RG-REC-004 sans identité : 401', async () => {
    expect((await get(ctx, '/api/admin/alertes/regles', {})).statusCode).toBe(401)
    expect((await modifier({}, 'ECART', { version: 0, canal: 'BANDEAU' })).statusCode).toBe(401)
  })
})

describe('D-08 RG-REC-190 modification', () => {
  it('RG-REC-190 première configuration (version 0) puis modification : canal et destinataires (ordre des rôles, doublons écartés), version incrémentée, journal', async () => {
    const { users } = await acteurs()
    const a = await modifier(users.admin, 'ECART', {
      version: 0,
      canal: 'BANDEAU_MAIL',
      destinataires: ['recep', 'coord', 'recep'],
    })
    expect(a.statusCode, a.body).toBe(200)
    expect(RegleAlerteAdminSchema.parse(a.json())).toMatchObject({
      type: 'ECART',
      canal: 'BANDEAU_MAIL',
      destinataires: ['coord', 'recep'],
      version: 1,
    })
    const b = await modifier(users.admin, 'ECART', {
      version: 1,
      canal: 'BANDEAU_DIGEST_7H',
      destinataires: [],
    })
    expect(RegleAlerteAdminSchema.parse(b.json())).toMatchObject({
      canal: 'BANDEAU_DIGEST_7H',
      destinataires: [],
      version: 2,
    })
    expect((await regles(users.admin)).find((r) => r.type === 'ECART')?.version).toBe(2)
    const journal = await db.journalAudit.findMany({
      where: { typeEntite: 'REGLE_ALERTE', entiteId: 'ECART', action: 'MODIFICATION_REGLE_ALERTE' },
      orderBy: { id: 'asc' },
    })
    expect(journal.map((j) => [j.ancienneValeur, j.nouvelleValeur, j.parId])).toEqual([
      ['BANDEAU', 'BANDEAU_MAIL', expect.any(Number)],
      ['BANDEAU_MAIL', 'BANDEAU_DIGEST_7H', expect.any(Number)],
    ])
  })

  it.each([
    ['canal inconnu', { version: 0, canal: 'SMS' }],
    ['canal absent', { version: 0 }],
    ['rôle inconnu', { version: 0, canal: 'BANDEAU', destinataires: ['pdg'] }],
    ['version négative', { version: -1, canal: 'BANDEAU' }],
    ['version absente', { canal: 'BANDEAU' }],
  ])('RG-REC-190 corps invalide (%s) : 400, rien n’est écrit', async (_, corps) => {
    const { users } = await acteurs()
    expect((await modifier(users.admin, 'ECART', corps)).statusCode).toBe(400)
    expect(await db.regleAlerte.count()).toBe(0)
  })

  it('RG-REC-190 type d’alerte inconnu : 400', async () => {
    const { users } = await acteurs()
    expect(
      (await modifier(users.admin, 'INCONNU', { version: 0, canal: 'BANDEAU' })).statusCode,
    ).toBe(400)
  })

  it('RG-REC-009 version périmée : 409 ; seconde « première configuration » d’un type déjà configuré : 409', async () => {
    const { users } = await acteurs()
    await modifier(users.admin, 'ORPHELINE', { version: 0, canal: 'BANDEAU_MAIL' })
    const dejaCree = await modifier(users.admin, 'ORPHELINE', { version: 0, canal: 'DESACTIVEE' })
    expect(dejaCree.statusCode).toBe(409)
    expect(erreur(dejaCree).code).toBe('ADM_CONFLIT_VERSION')
    await modifier(users.admin, 'ORPHELINE', { version: 1, canal: 'BANDEAU' })
    const perime = await modifier(users.admin, 'ORPHELINE', { version: 1, canal: 'DESACTIVEE' })
    expect(perime.statusCode).toBe(409)
    expect((await db.regleAlerte.findUniqueOrThrow({ where: { type: 'ORPHELINE' } })).canal).toBe(
      'BANDEAU',
    )
  })

  it('concurrence : deux premières configurations simultanées : une seule appliquée (200 + 409)', async () => {
    const { users } = await acteurs()
    const [a, b] = await Promise.all([
      modifier(users.admin, 'SANS_IP', { version: 0, canal: 'BANDEAU_MAIL' }),
      modifier(users.admin, 'SANS_IP', { version: 0, canal: 'DESACTIVEE' }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await db.regleAlerte.count({ where: { type: 'SANS_IP' } })).toBe(1)
  })

  it('concurrence : deux modifications avec la même version : 200 + 409', async () => {
    const { users } = await acteurs()
    await modifier(users.admin, 'MANQUANT', { version: 0, canal: 'BANDEAU' })
    const [a, b] = await Promise.all([
      modifier(users.admin, 'MANQUANT', { version: 1, canal: 'BANDEAU_MAIL' }),
      modifier(users.admin, 'MANQUANT', { version: 1, canal: 'BANDEAU_DIGEST_7H' }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it('atomicité : une panne du journal annule la première configuration comme la modification', async () => {
    const { users } = await acteurs()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      modifier(users.admin, 'ECART', { version: 0, canal: 'DESACTIVEE' }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.regleAlerte.count()).toBe(0)
    await modifier(users.admin, 'ECART', { version: 0, canal: 'BANDEAU_MAIL' })
    const r2 = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      modifier(users.admin, 'ECART', { version: 1, canal: 'DESACTIVEE' }),
    )
    expect(r2.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.regleAlerte.findUniqueOrThrow({ where: { type: 'ECART' } })).toMatchObject({
      canal: 'BANDEAU_MAIL',
      version: 1,
    })
  })
})

describe('D-08 RG-REC-190 effets dans Pilotage › Alertes (ECR-TRA-01)', () => {
  it('RG-REC-190 sans configuration : l’alerte calculée est affichée avec ses destinataires par défaut', async () => {
    const { users, plateforme } = await acteurs()
    const { reception, alertes } = await alerteOrpheline(plateforme.id, users.admin)
    const a = alertes.find((x) => x.cle === `RG-REC-185:${String(reception.id)}`)
    expect(a?.destinataires).toEqual(['Coordination', 'Réception'])
  })

  it('RG-REC-190 canal « Désactivée » : le type n’apparaît plus ; un autre canal (mail, digest) le laisse affiché (aucun mail, Q-375) ; la réactivation le rétablit', async () => {
    const { users, plateforme } = await acteurs()
    const { reception } = await alerteOrpheline(plateforme.id, users.admin)
    const cle = `RG-REC-185:${String(reception.id)}`
    const voir = async () =>
      ListeAlertesSchema.parse(
        (
          await get(ctx, `/api/alertes?type=ORPHELINE&site=${String(plateforme.id)}`, users.coord)
        ).json(),
      ).alertes.some((x) => x.cle === cle)
    expect(await voir()).toBe(true)
    await modifier(users.admin, 'ORPHELINE', { version: 0, canal: 'BANDEAU_MAIL_IMMEDIAT' })
    expect(await voir()).toBe(true)
    await modifier(users.admin, 'ORPHELINE', { version: 1, canal: 'DESACTIVEE' })
    expect(await voir()).toBe(false)
    await modifier(users.admin, 'ORPHELINE', { version: 2, canal: 'BANDEAU' })
    expect(await voir()).toBe(true)
  })

  it('RG-REC-190 la désactivation d’un type n’écarte pas les autres types d’alerte', async () => {
    const { users, plateforme } = await acteurs()
    const { reception } = await alerteOrpheline(plateforme.id, users.admin)
    await modifier(users.admin, 'ECART', { version: 0, canal: 'DESACTIVEE' })
    const liste = ListeAlertesSchema.parse(
      (await get(ctx, `/api/alertes?site=${String(plateforme.id)}`, users.admin)).json(),
    )
    expect(liste.alertes.some((x) => x.cle === `RG-REC-185:${String(reception.id)}`)).toBe(true)
  })

  it('RG-REC-190 destinataires configurés : ils remplacent ceux calculés ; vides : retour aux destinataires par défaut', async () => {
    const { users, plateforme } = await acteurs()
    const { reception } = await alerteOrpheline(plateforme.id, users.admin)
    const cle = `RG-REC-185:${String(reception.id)}`
    const dest = async () =>
      ListeAlertesSchema.parse(
        (
          await get(ctx, `/api/alertes?type=ORPHELINE&site=${String(plateforme.id)}`, users.admin)
        ).json(),
      ).alertes.find((x) => x.cle === cle)?.destinataires
    await modifier(users.admin, 'ORPHELINE', {
      version: 0,
      canal: 'BANDEAU',
      destinataires: ['admin', 'cheq'],
    })
    expect(await dest()).toEqual(['Chefs d’équipe', 'Administrateur'])
    await modifier(users.admin, 'ORPHELINE', { version: 1, canal: 'BANDEAU', destinataires: [] })
    expect(await dest()).toEqual(['Coordination', 'Réception'])
  })
})
