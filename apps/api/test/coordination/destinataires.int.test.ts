// Étape 8 (D-05) — tests d'INTÉGRATION du référentiel des destinataires (ECR-ADM-07 « Destinataires et afficheurs »,
// RG-COO-120 : clé d'intégration `nomOrigine`, dispatch O/N de RG-COO-260) : API réelle sur la base de test, données
// isolées par préfixe et purgées. Hypothèses : Q-403 (unicité du nom d'origine, désactivation sans suppression,
// administrateur seul, destinataires globaux sans site). Aucun test unitaire.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DestinataireLigneSchema, DestinatairesReferentielSchema, type Role } from '@circe/shared'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, envoyer, ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

const PREFIXE = `DST${String(Date.now())}`
const nom = (s = '') => `${PREFIXE}-${String(next())}${s}`

beforeAll(() => ctx.demarrer())
afterAll(async () => {
  try {
    const ids = (
      await db.destinataire.findMany({
        where: { nomOrigine: { startsWith: PREFIXE } },
        select: { id: true },
      })
    ).map((d) => d.id)
    await db.destinataireAdresse.deleteMany({ where: { destinataireId: { in: ids } } })
    await db.repartition.deleteMany({ where: { destinataireId: { in: ids } } })
    await db.destinataire.deleteMany({ where: { id: { in: ids } } })
  } catch {
    // purge au mieux
  }
  await ctx.arreter()
})

async function utilisateurs() {
  const plateforme = await f.createPlateforme(db)
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, users }
}

const creer = (h: H, corps: unknown, cle: H = idem()) =>
  envoyer(ctx, '/api/coordination/destinataires', h, corps, cle)
const modifier = (h: H, id: number, corps: unknown) =>
  ctx.app.inject({
    method: 'PATCH',
    url: `/api/coordination/destinataires/${String(id)}`,
    headers: h,
    payload: corps as object,
  })
const lister = (h: H, qs = '') => get(ctx, `/api/coordination/destinataires${qs}`, h)

describe('D-05 RG-COO-120 créer un destinataire', () => {
  it('D-05 l’administrateur crée un destinataire (nom d’origine, libellé, dispatch O, adresse) : 200, journal', async () => {
    const { users } = await utilisateurs()
    const n = nom()
    const r = await creer(users.admin, {
      nomOrigine: n,
      nom: `${n} affichage`,
      dispatch: 'O',
      mail: 'a@exemple.fr',
      adresse: { adresse1: '1 rue A', codePostal: '75001', localite: 'Paris' },
    })
    expect(r.statusCode, r.body).toBe(200)
    const d = DestinataireLigneSchema.parse(r.json())
    expect([d.nomOrigine, d.nom, d.dispatch, d.actif, d.utilise]).toEqual([
      n,
      `${n} affichage`,
      'O',
      true,
      false,
    ])
    expect(d.adresse?.localite).toBe('Paris')
    const journal = await db.journalAudit.findMany({
      where: { typeEntite: 'REFERENTIEL', entiteId: `destinataire:${String(d.id)}` },
    })
    expect(journal.map((j) => j.action)).toEqual(['CREATION_DESTINATAIRE'])
  })

  it('D-05 sans libellé, le nom affiché est le nom d’origine', async () => {
    const { users } = await utilisateurs()
    const n = nom()
    const d = DestinataireLigneSchema.parse((await creer(users.admin, { nomOrigine: n })).json())
    expect(d.nom).toBe(n)
    expect(d.dispatch).toBeNull()
  })

  it('D-05 un nom d’origine déjà pris (casse ignorée) : 409 COO_DESTINATAIRE_EXISTE, rien d’écrit', async () => {
    const { users } = await utilisateurs()
    const n = nom()
    await creer(users.admin, { nomOrigine: n })
    const avant = await db.destinataire.count({ where: { nomOrigine: { startsWith: PREFIXE } } })
    const r = await creer(users.admin, { nomOrigine: n.toLowerCase() })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('COO_DESTINATAIRE_EXISTE')
    expect(erreur(r).regle).toBe('RG-COO-120')
    expect(await db.destinataire.count({ where: { nomOrigine: { startsWith: PREFIXE } } })).toBe(
      avant,
    )
  })

  it.each([
    ['nom d’origine vide', { nomOrigine: '   ' }],
    ['nom d’origine trop long (101)', { nomOrigine: 'x'.repeat(101) }],
    ['dispatch hors O / N', { nomOrigine: 'x', dispatch: 'Z' }],
    ['aucun corps utile', {}],
  ])('D-05 entrée invalide (%s) : 400', async (_, corps) => {
    const { users } = await utilisateurs()
    expect((await creer(users.admin, corps)).statusCode).toBe(400)
  })

  it('D-05 limites : nom d’origine de 100 caractères accepté', async () => {
    const { users } = await utilisateurs()
    const n = `${PREFIXE}-${'y'.repeat(100 - PREFIXE.length - 1)}`
    expect(n).toHaveLength(100)
    expect((await creer(users.admin, { nomOrigine: n })).statusCode).toBe(200)
  })

  it('D-05 idempotence : la même clé rejoue la réponse sans second destinataire', async () => {
    const { users } = await utilisateurs()
    const n = nom()
    const cle = idem()
    const a = await creer(users.admin, { nomOrigine: n }, cle)
    const b = await creer(users.admin, { nomOrigine: n }, cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(b.json<{ id: number }>().id).toBe(a.json<{ id: number }>().id)
    expect(await db.destinataire.count({ where: { nomOrigine: n } })).toBe(1)
  })

  it('D-05 sans Idempotency-Key : 400 ; sans identité : 401', async () => {
    const { users } = await utilisateurs()
    const sansCle = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/destinataires',
      headers: users.admin,
      payload: { nomOrigine: nom() },
    })
    expect(sansCle.statusCode).toBe(400)
    const anonyme = await ctx.app.inject({
      method: 'POST',
      url: '/api/coordination/destinataires',
      headers: idem(),
      payload: { nomOrigine: nom() },
    })
    expect(anonyme.statusCode).toBe(401)
  })

  it('D-05 atomicité : panne du journal → aucun destinataire ni adresse créé', async () => {
    const { users } = await utilisateurs()
    const n = nom()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      creer(users.admin, { nomOrigine: n, adresse: { localite: 'Lyon' } }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.destinataire.count({ where: { nomOrigine: n } })).toBe(0)
  })
})

describe('D-05 permissions : l’administrateur seul gère le référentiel (referentiel.gerer)', () => {
  it.each(ROLES.filter((r) => r !== 'admin'))(
    'D-05 le rôle %s ne crée, ne modifie ni ne liste : 403, rien d’écrit',
    async (role) => {
      const { users } = await utilisateurs()
      const cible = await f.createDestinataire(db, { nomOrigine: nom() })
      const n = nom()
      const c = await creer(users[role], { nomOrigine: n })
      expect(c.statusCode, role).toBe(403)
      expect(erreur(c).code).toBe('PERMISSION')
      const m = await modifier(users[role], cible.id, { version: 1, dispatch: 'O' })
      expect(m.statusCode, role).toBe(403)
      expect((await lister(users[role])).statusCode, role).toBe(403)
      expect(await db.destinataire.count({ where: { nomOrigine: n } })).toBe(0)
      expect((await db.destinataire.findUniqueOrThrow({ where: { id: cible.id } })).dispatch).toBe(
        null,
      )
    },
  )

  it('D-05 le commercial reçoit la règle RG-COO-168 (lecture seule)', async () => {
    const { users } = await utilisateurs()
    expect(erreur(await creer(users.com, { nomOrigine: nom() })).regle).toBe('RG-COO-168')
  })

  it('D-05 sans identité : GET et PATCH → 401', async () => {
    const d = await f.createDestinataire(db, { nomOrigine: nom() })
    expect((await get(ctx, '/api/coordination/destinataires', {})).statusCode).toBe(401)
    expect((await modifier({}, d.id, { version: 1 })).statusCode).toBe(401)
  })
})

describe('D-05 lister et rechercher', () => {
  it('D-05 la liste porte l’adresse principale, le nombre de transports par défaut et l’indicateur « utilisé »', async () => {
    const { users, plateforme } = await utilisateurs()
    const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
    const n = nom()
    const d = await f.createDestinataire(db, { nomOrigine: n, nom: `${n} Affichage` })
    await db.destinataireAdresse.create({
      data: { destinataireId: d.id, adresse1: '5 rue B', localite: 'Nîmes' },
    })
    await db.transportDestinataire.create({
      data: { destinataireId: d.id, atelierId: atelier.id, transporteur: 1, tarif: 'T1' },
    })
    await f.createRepartition(db, { atelierId: atelier.id, destinataireId: d.id })
    const r = await lister(users.admin, `?q=${encodeURIComponent(n)}`)
    expect(r.statusCode, r.body).toBe(200)
    const { destinataires } = DestinatairesReferentielSchema.parse(r.json())
    expect(destinataires).toHaveLength(1)
    const l = destinataires[0]
    expect(l?.adresse?.localite).toBe('Nîmes')
    expect(l?.nbTransports).toBe(1)
    expect(l?.utilise).toBe(true)
    await db.repartition.deleteMany({ where: { atelierId: atelier.id } })
  })

  it('D-05 la recherche ignore la casse et porte sur le nom d’origine ou le libellé ; le filtre actif sépare', async () => {
    const { users } = await utilisateurs()
    const cle = `Zq${String(next())}x`
    const a = await f.createDestinataire(db, { nomOrigine: `${PREFIXE}-${cle}-A` })
    const b = await f.createDestinataire(db, {
      nomOrigine: `${PREFIXE}-B${String(next())}`,
      nom: `Lib ${cle.toUpperCase()}`,
      actif: false,
    })
    const tous = DestinatairesReferentielSchema.parse(
      (await lister(users.admin, `?q=${cle}`)).json(),
    ).destinataires.map((d) => d.id)
    expect(tous.sort()).toEqual([a.id, b.id].sort())
    const actifs = DestinatairesReferentielSchema.parse(
      (await lister(users.admin, `?q=${cle}&actif=true`)).json(),
    ).destinataires.map((d) => d.id)
    expect(actifs).toEqual([a.id])
    const inactifs = DestinatairesReferentielSchema.parse(
      (await lister(users.admin, `?q=${cle}&actif=false`)).json(),
    ).destinataires.map((d) => d.id)
    expect(inactifs).toEqual([b.id])
    expect((await lister(users.admin, '?actif=peut-etre')).statusCode).toBe(400)
  })
})

describe('D-05 modifier et désactiver (version, journal)', () => {
  it('D-05 modification du libellé, du dispatch, du mail et de l’adresse : version +1, journal avant / après', async () => {
    const { users } = await utilisateurs()
    const d = await f.createDestinataire(db, { nomOrigine: nom() })
    const r = await modifier(users.admin, d.id, {
      version: d.version,
      nom: 'Nouveau libellé',
      dispatch: 'O',
      mail: 'x@exemple.fr',
      telephone: '0102030405',
      adresse: { adresse1: '9 rue C', localite: 'Lille' },
    })
    expect(r.statusCode, r.body).toBe(200)
    const l = DestinataireLigneSchema.parse(r.json())
    expect([l.nom, l.dispatch, l.mail, l.telephone, l.version]).toEqual([
      'Nouveau libellé',
      'O',
      'x@exemple.fr',
      '0102030405',
      d.version + 1,
    ])
    expect(l.adresse?.localite).toBe('Lille')
    // 2e modification de l'adresse : la même ligne est mise à jour (adresse principale unique).
    await modifier(users.admin, d.id, { version: l.version, adresse: { localite: 'Tours' } })
    expect(await db.destinataireAdresse.count({ where: { destinataireId: d.id } })).toBe(1)
    const journal = await db.journalAudit.findMany({
      where: { entiteId: `destinataire:${String(d.id)}`, action: 'MODIFICATION_DESTINATAIRE' },
    })
    expect(journal).toHaveLength(2)
    expect(journal[0]?.ancienneValeur).toContain(d.nomOrigine)
    expect(journal[0]?.nouvelleValeur).toContain('Nouveau libellé')
  })

  it('D-05 le nom d’origine (clé d’intégration Broadcast) n’est pas modifiable : champ ignoré, 200 sans effet', async () => {
    const { users } = await utilisateurs()
    const d = await f.createDestinataire(db, { nomOrigine: nom() })
    const r = await modifier(users.admin, d.id, {
      version: d.version,
      nomOrigine: 'autre',
      dispatch: 'N',
    })
    expect(r.statusCode).toBe(200)
    expect((await db.destinataire.findUniqueOrThrow({ where: { id: d.id } })).nomOrigine).toBe(
      d.nomOrigine,
    )
  })

  it('D-05 désactiver puis réactiver : jamais supprimé, même référencé ; filtre « actif » cohérent', async () => {
    const { users, plateforme } = await utilisateurs()
    const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
    const d = await f.createDestinataire(db, { nomOrigine: nom() })
    await f.createRepartition(db, { atelierId: atelier.id, destinataireId: d.id })
    const off = DestinataireLigneSchema.parse(
      (await modifier(users.admin, d.id, { version: d.version, actif: false })).json(),
    )
    expect([off.actif, off.utilise]).toEqual([false, true])
    const on = DestinataireLigneSchema.parse(
      (await modifier(users.admin, d.id, { version: off.version, actif: true })).json(),
    )
    expect(on.actif).toBe(true)
    // Aucune route de suppression : DELETE → 404.
    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/coordination/destinataires/${String(d.id)}`,
      headers: users.admin,
    })
    expect(del.statusCode).toBe(404)
    await db.repartition.deleteMany({ where: { atelierId: atelier.id } })
  })

  it('D-05 version périmée : 409 COO_CONFLIT_VERSION, rien d’écrit ; destinataire inconnu : 404 ; version absente : 400', async () => {
    const { users } = await utilisateurs()
    const d = await f.createDestinataire(db, { nomOrigine: nom() })
    const perimee = await modifier(users.admin, d.id, { version: d.version + 5, dispatch: 'O' })
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).code).toBe('COO_CONFLIT_VERSION')
    expect((await db.destinataire.findUniqueOrThrow({ where: { id: d.id } })).dispatch).toBeNull()
    expect((await modifier(users.admin, 999_999_999, { version: 1 })).statusCode).toBe(404)
    expect((await modifier(users.admin, d.id, { dispatch: 'O' })).statusCode).toBe(400)
    expect((await modifier(users.admin, d.id, { version: 1, dispatch: 'Z' })).statusCode).toBe(400)
  })

  it('D-05 concurrence : deux modifications simultanées de la même version → un gagnant (200) et un 409', async () => {
    const { users } = await utilisateurs()
    const d = await f.createDestinataire(db, { nomOrigine: nom() })
    const [a, b] = await Promise.all([
      modifier(users.admin, d.id, { version: d.version, dispatch: 'O' }),
      modifier(users.admin, d.id, { version: d.version, dispatch: 'N' }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect((await db.destinataire.findUniqueOrThrow({ where: { id: d.id } })).version).toBe(
      d.version + 1,
    )
    expect(
      await db.journalAudit.count({
        where: { entiteId: `destinataire:${String(d.id)}`, action: 'MODIFICATION_DESTINATAIRE' },
      }),
    ).toBe(1)
  })

  it('D-05 atomicité : panne du journal → ni le libellé ni l’adresse ne changent', async () => {
    const { users } = await utilisateurs()
    const d = await f.createDestinataire(db, { nomOrigine: nom() })
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      modifier(users.admin, d.id, {
        version: d.version,
        nom: 'Ne doit pas rester',
        adresse: { localite: 'Rouen' },
      }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    const apres = await db.destinataire.findUniqueOrThrow({ where: { id: d.id } })
    expect([apres.nom, apres.version]).toEqual([null, d.version])
    expect(await db.destinataireAdresse.count({ where: { destinataireId: d.id } })).toBe(0)
  })
})
