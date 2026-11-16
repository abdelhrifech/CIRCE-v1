// Étape 8 (D-01) — tests d'INTÉGRATION de la gestion des utilisateurs, rôles et périmètre (RG-ADM-010 à 017
// provisoires, Q-320, Q-003, Q-001 : aucun mot de passe). Droit `utilisateur.gerer` (administrateur seul, Q-406),
// effets immédiats sur l'identité (rôles et périmètre relus en base à chaque requête), auto-modification interdite
// (pas d'élévation de ses propres droits, dernier administrateur protégé), verrou de version, idempotence, journal,
// concurrence, atomicité. API réelle sur la base de test ; comptes créés purgés. Aucun test unitaire.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  MeResponseSchema,
  UtilisateurAdminSchema,
  UtilisateursAdminSchema,
  type Role,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, envoyer, ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

const PREFIXE = `admu${String(Date.now())}`
const ident = (s = '') => `${PREFIXE}.${String(next())}${s}`
const crees: string[] = []

beforeAll(() => ctx.demarrer())
afterAll(async () => {
  try {
    const ids = (
      await db.utilisateur.findMany({
        where: { identifiantExterne: { startsWith: PREFIXE } },
        select: { id: true },
      })
    ).map((u) => u.id)
    await db.utilisateurRole.deleteMany({ where: { utilisateurId: { in: ids } } })
    await db.utilisateurPerimetre.deleteMany({ where: { utilisateurId: { in: ids } } })
    await db.utilisateur.deleteMany({ where: { id: { in: ids } } })
  } catch {
    // purge au mieux
  }
  await ctx.arreter()
})

async function acteurs() {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id })
  const autrePlateforme = await f.createPlateforme(db)
  const users = {} as Record<Role, { id: number; identifiant: string; h: H }>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = { id: u.id, identifiant: u.identifiantExterne, h: devHeaders(u.identifiantExterne) }
  }
  return { plateforme, atelier, autrePlateforme, users }
}

const creer = (h: H, corps: unknown, cle: H = idem()) =>
  envoyer(ctx, '/api/admin/utilisateurs', h, corps, cle)
const modifier = (h: H, id: number, corps: unknown) =>
  ctx.app.inject({
    method: 'PATCH',
    url: `/api/admin/utilisateurs/${String(id)}`,
    headers: h,
    payload: corps as object,
  })
const lister = (h: H, qs = '') => get(ctx, `/api/admin/utilisateurs${qs}`, h)
const moi = async (h: H) => MeResponseSchema.parse((await get(ctx, '/api/me', h)).json())

async function creerOk(h: H, o: Record<string, unknown> = {}) {
  const identifiantExterne = ident()
  crees.push(identifiantExterne)
  const r = await creer(h, { identifiantExterne, roles: ['recep'], perimetre: [], ...o })
  expect(r.statusCode, r.body).toBe(200)
  return UtilisateurAdminSchema.parse(r.json())
}

describe('D-01 créer un utilisateur', () => {
  it('D-01 l’administrateur crée un compte (rôles, périmètre site + atelier) : 200, journal, le compte s’authentifie', async () => {
    const { users, plateforme, atelier } = await acteurs()
    const u = await creerOk(users.admin.h, {
      nom: 'Utilisateur Créé',
      roles: ['recep', 'cheq'],
      perimetre: [{ plateformeId: plateforme.id, atelierId: atelier.id }],
    })
    expect([u.nom, u.actif, u.roles, u.toutesPlateformes, u.version]).toEqual([
      'Utilisateur Créé',
      true,
      ['cheq', 'recep'],
      false,
      1,
    ])
    expect(u.perimetre).toEqual([
      {
        plateformeId: plateforme.id,
        plateforme: plateforme.nom,
        atelierId: atelier.id,
        atelier: atelier.libelle,
      },
    ])
    const j = await db.journalAudit.findMany({
      where: { typeEntite: 'UTILISATEUR', entiteId: String(u.id) },
    })
    expect(j.map((x) => [x.action, x.parId, x.nouvelleValeur])).toEqual([
      ['CREATION_UTILISATEUR', users.admin.id, u.identifiantExterne],
    ])
    const me = await moi(devHeaders(u.identifiantExterne))
    expect(me.roles.sort()).toEqual(['cheq', 'recep'])
    expect(me.perimetre.plateformeIds).toEqual([plateforme.id])
  })

  it('D-01 l’administrateur est « tous sites » (RG-COO-167) : son périmètre n’est pas une liste', async () => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h, { roles: ['admin'] })
    expect(u.toutesPlateformes).toBe(true)
  })

  it('D-01 un compte sans périmètre est créé (accès nul tant qu’il n’est pas affecté, Q-406) ; les doublons de périmètre sont écartés', async () => {
    const { users, plateforme } = await acteurs()
    const sans = await creerOk(users.admin.h, { perimetre: [] })
    expect(sans.perimetre).toEqual([])
    const dbl = await creerOk(users.admin.h, {
      perimetre: [
        { plateformeId: plateforme.id },
        { plateformeId: plateforme.id, atelierId: null },
      ],
    })
    expect(dbl.perimetre).toHaveLength(1)
  })

  it('D-01 aucun mot de passe n’existe (Q-001) : le corps accepte seulement identifiant, nom, rôles, périmètre', async () => {
    const { users } = await acteurs()
    const r = await creer(users.admin.h, {
      identifiantExterne: ident(),
      roles: ['recep'],
      motDePasse: 'x',
    })
    // Les champs inconnus sont ignorés par le schéma : rien n'est stocké.
    expect(r.statusCode).toBe(200)
    crees.push(UtilisateurAdminSchema.parse(r.json()).identifiantExterne)
    expect(Object.keys(UtilisateurAdminSchema.parse(r.json()))).not.toContain('motDePasse')
  })

  it('D-01 un identifiant déjà pris (casse ignorée) : 409 ADM_UTILISATEUR_EXISTE, rien d’écrit', async () => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h)
    const avant = await db.utilisateur.count({
      where: { identifiantExterne: { startsWith: PREFIXE } },
    })
    for (const identifiantExterne of [u.identifiantExterne, u.identifiantExterne.toUpperCase()]) {
      const r = await creer(users.admin.h, { identifiantExterne, roles: ['recep'] })
      expect(r.statusCode).toBe(409)
      expect(erreur(r).code).toBe('ADM_UTILISATEUR_EXISTE')
    }
    expect(
      await db.utilisateur.count({ where: { identifiantExterne: { startsWith: PREFIXE } } }),
    ).toBe(avant)
  })

  const rejets: [
    string,
    () => Record<string, unknown> | Promise<Record<string, unknown>>,
    number,
    string,
  ][] = [
    ['identifiant vide', () => ({ identifiantExterne: '  ' }), 400, 'VALIDATION'],
    ['identifiant avec espace', () => ({ identifiantExterne: 'a b' }), 400, 'VALIDATION'],
    [
      'identifiant trop long (101)',
      () => ({ identifiantExterne: 'x'.repeat(101) }),
      400,
      'VALIDATION',
    ],
    ['aucun rôle', () => ({ roles: [] }), 400, 'VALIDATION'],
    ['rôle inconnu', () => ({ roles: ['chef'] }), 400, 'VALIDATION'],
    ['nom trop long (101)', () => ({ nom: 'x'.repeat(101) }), 400, 'VALIDATION'],
    [
      'site inconnu',
      () => ({ perimetre: [{ plateformeId: 999_999_999 }] }),
      400,
      'ADM_SITE_INCONNU',
    ],
    [
      'atelier inconnu',
      async () => ({
        perimetre: [{ plateformeId: (await f.createPlateforme(db)).id, atelierId: 999_999_999 }],
      }),
      400,
      'ADM_ATELIER_INCONNU',
    ],
    [
      'atelier d’un autre site',
      async () => {
        const a = await f.createAtelier(db)
        const p = await f.createPlateforme(db)
        return { perimetre: [{ plateformeId: p.id, atelierId: a.id }] }
      },
      400,
      'ADM_ATELIER_HORS_SITE',
    ],
  ]
  it.each(rejets)('rejet : %s', async (_nom, corps, statut, code) => {
    const { users } = await acteurs()
    const avant = await db.utilisateur.count()
    const r = await creer(users.admin.h, {
      identifiantExterne: ident(),
      roles: ['recep'],
      ...(await corps()),
    })
    expect(r.statusCode, r.body).toBe(statut)
    expect(erreur(r).code).toBe(code)
    expect(await db.utilisateur.count()).toBe(avant)
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne crée pas de compte : 403, rien d’écrit',
    async (role) => {
      const { users } = await acteurs()
      const avant = await db.utilisateur.count()
      const r = await creer(users[role].h, { identifiantExterne: ident(), roles: ['admin'] })
      expect(r.statusCode).toBe(403)
      expect(erreur(r).regle).toBe('RG-REC-002')
      expect(await db.utilisateur.count()).toBe(avant)
    },
  )

  it('RG-REC-004 sans identité : 401 (création et liste)', async () => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/utilisateurs',
      headers: idem(),
      payload: { identifiantExterne: ident(), roles: ['recep'] },
    })
    expect(r.statusCode).toBe(401)
    expect((await get(ctx, '/api/admin/utilisateurs', {})).statusCode).toBe(401)
  })

  it('RG-REC-008 idempotence : la même clé rejoue la réponse sans second compte ; même clé avec un autre corps : 409', async () => {
    const { users } = await acteurs()
    const identifiantExterne = ident()
    crees.push(identifiantExterne)
    const cle = idem()
    const corps = { identifiantExterne, roles: ['recep'] }
    const a = await creer(users.admin.h, corps, cle)
    const b = await creer(users.admin.h, corps, cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(UtilisateurAdminSchema.parse(b.json()).id).toBe(
      UtilisateurAdminSchema.parse(a.json()).id,
    )
    expect(await db.utilisateur.count({ where: { identifiantExterne } })).toBe(1)
    const autre = await creer(users.admin.h, { ...corps, roles: ['cheq'] }, cle)
    expect(autre.statusCode).toBe(409)
    expect(erreur(autre).code).toBe('ADM_IDEMPOTENCE_CONFLIT')
  })

  it('RG-REC-008 sans Idempotency-Key : 400', async () => {
    const { users } = await acteurs()
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/utilisateurs',
      headers: users.admin.h,
      payload: { identifiantExterne: ident(), roles: ['recep'] },
    })
    expect(r.statusCode).toBe(400)
  })

  it('concurrence : deux créations simultanées du même identifiant : un seul compte (200 + 409)', async () => {
    const { users } = await acteurs()
    const identifiantExterne = ident()
    crees.push(identifiantExterne)
    const [a, b] = await Promise.all([
      creer(users.admin.h, { identifiantExterne, roles: ['recep'] }),
      creer(users.admin.h, { identifiantExterne, roles: ['cheq'] }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await db.utilisateur.count({ where: { identifiantExterne } })).toBe(1)
  })

  it('atomicité : une panne du journal annule la création (ni compte, ni rôle, ni périmètre)', async () => {
    const { users, plateforme } = await acteurs()
    const identifiantExterne = ident()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      creer(users.admin.h, {
        identifiantExterne,
        roles: ['recep'],
        perimetre: [{ plateformeId: plateforme.id }],
      }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.utilisateur.count({ where: { identifiantExterne } })).toBe(0)
  })
})

describe('D-01 lister les utilisateurs', () => {
  it('D-01 filtre par texte, rôle et état ; total du filtre', async () => {
    const { users } = await acteurs()
    const a = await creerOk(users.admin.h, { nom: 'Zoé Filtre', roles: ['expe'] })
    const b = await creerOk(users.admin.h, { nom: 'Yann Filtre', roles: ['com'] })
    await modifier(users.admin.h, b.id, { version: b.version, actif: false })
    const parTexte = UtilisateursAdminSchema.parse(
      (await lister(users.admin.h, `?q=${encodeURIComponent(a.identifiantExterne)}`)).json(),
    )
    expect(parTexte.utilisateurs.map((u) => u.id)).toEqual([a.id])
    expect(parTexte.total).toBe(1)
    const parNom = UtilisateursAdminSchema.parse(
      (await lister(users.admin.h, `?q=Filtre&actif=false`)).json(),
    )
    expect(parNom.utilisateurs.map((u) => u.id)).toContain(b.id)
    expect(parNom.utilisateurs.map((u) => u.id)).not.toContain(a.id)
    const parRole = UtilisateursAdminSchema.parse(
      (await lister(users.admin.h, `?q=${PREFIXE}&role=expe`)).json(),
    )
    expect(parRole.utilisateurs.every((u) => u.roles.includes('expe'))).toBe(true)
    expect(parRole.utilisateurs.map((u) => u.id)).toContain(a.id)
  })

  it('D-01 la liste est bornée à 200 lignes, total complet', async () => {
    const { users } = await acteurs()
    const r = UtilisateursAdminSchema.parse((await lister(users.admin.h)).json())
    expect(r.utilisateurs.length).toBeLessThanOrEqual(200)
    expect(r.total).toBeGreaterThanOrEqual(r.utilisateurs.length)
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne liste pas les utilisateurs : 403',
    async (role) => {
      const { users } = await acteurs()
      expect((await lister(users[role].h)).statusCode).toBe(403)
    },
  )
})

describe('D-01 modifier un utilisateur', () => {
  it('D-01 modifier le nom : version + 1, journal avant / après', async () => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h, { nom: 'Avant' })
    const r = await modifier(users.admin.h, u.id, { version: u.version, nom: 'Après' })
    expect(r.statusCode, r.body).toBe(200)
    const m = UtilisateurAdminSchema.parse(r.json())
    expect([m.nom, m.version]).toEqual(['Après', u.version + 1])
    const j = await db.journalAudit.findMany({
      where: {
        typeEntite: 'UTILISATEUR',
        entiteId: String(u.id),
        action: 'MODIFICATION_UTILISATEUR',
      },
    })
    expect(j).toHaveLength(1)
    expect(JSON.parse(j[0]?.donnees ?? '{}')).toMatchObject({
      avant: { nom: 'Avant' },
      apres: { nom: 'Après' },
    })
    const effacer = await modifier(users.admin.h, u.id, { version: m.version, nom: null })
    expect(UtilisateurAdminSchema.parse(effacer.json()).nom).toBeNull()
  })

  it('D-01 les rôles sont REMPLACÉS et l’effet est immédiat : accès aux paramètres refusé, accordé, puis retiré', async () => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h, { roles: ['recep'] })
    const h = devHeaders(u.identifiantExterne)
    expect((await get(ctx, '/api/admin/parametres', h)).statusCode).toBe(403)
    const r1 = await modifier(users.admin.h, u.id, { version: u.version, roles: ['admin'] })
    expect(r1.statusCode, r1.body).toBe(200)
    expect((await get(ctx, '/api/admin/parametres', h)).statusCode).toBe(200)
    const v1 = UtilisateurAdminSchema.parse(r1.json())
    expect(v1.roles).toEqual(['admin'])
    const r2 = await modifier(users.admin.h, u.id, { version: v1.version, roles: ['cheq', 'com'] })
    expect(UtilisateurAdminSchema.parse(r2.json()).roles).toEqual(['cheq', 'com'])
    expect((await get(ctx, '/api/admin/parametres', h)).statusCode).toBe(403)
  })

  it('D-01 le périmètre est REMPLACÉ et l’effet est immédiat : un site hors périmètre est refusé (403) puis accepté', async () => {
    const { users, plateforme, autrePlateforme } = await acteurs()
    const u = await creerOk(users.admin.h, { perimetre: [{ plateformeId: plateforme.id }] })
    const surAutre = devHeaders(u.identifiantExterne, autrePlateforme.id)
    expect((await get(ctx, '/api/me', surAutre)).statusCode).toBe(403)
    const r = await modifier(users.admin.h, u.id, {
      version: u.version,
      perimetre: [{ plateformeId: autrePlateforme.id }],
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(UtilisateurAdminSchema.parse(r.json()).perimetre.map((p) => p.plateformeId)).toEqual([
      autrePlateforme.id,
    ])
    expect((await get(ctx, '/api/me', surAutre)).statusCode).toBe(200)
    expect(
      (await get(ctx, '/api/me', devHeaders(u.identifiantExterne, plateforme.id))).statusCode,
    ).toBe(403)
  })

  it('D-01 désactiver : le compte n’est plus authentifié (401), réactiver le rétablit ; jamais de suppression', async () => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h)
    const h = devHeaders(u.identifiantExterne)
    expect((await get(ctx, '/api/me', h)).statusCode).toBe(200)
    const off = UtilisateurAdminSchema.parse(
      (await modifier(users.admin.h, u.id, { version: u.version, actif: false })).json(),
    )
    expect(off.actif).toBe(false)
    expect((await get(ctx, '/api/me', h)).statusCode).toBe(401)
    const on = await modifier(users.admin.h, u.id, { version: off.version, actif: true })
    expect(UtilisateurAdminSchema.parse(on.json()).actif).toBe(true)
    expect((await get(ctx, '/api/me', h)).statusCode).toBe(200)
  })

  it('RG-REC-009 une version périmée : 409 ADM_CONFLIT_VERSION, rien d’écrit', async () => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h, { roles: ['recep'] })
    await modifier(users.admin.h, u.id, { version: u.version, nom: 'Premier' })
    const r = await modifier(users.admin.h, u.id, { version: u.version, roles: ['admin'] })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).code).toBe('ADM_CONFLIT_VERSION')
    const apres = UtilisateursAdminSchema.parse(
      (await lister(users.admin.h, `?q=${encodeURIComponent(u.identifiantExterne)}`)).json(),
    ).utilisateurs[0]
    expect(apres?.roles).toEqual(['recep'])
    expect(apres?.nom).toBe('Premier')
  })

  it('concurrence : deux modifications simultanées avec la même version : un seul gagnant (200 + 409), état cohérent', async () => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h, { roles: ['recep'] })
    const [a, b] = await Promise.all([
      modifier(users.admin.h, u.id, { version: u.version, roles: ['cheq'] }),
      modifier(users.admin.h, u.id, { version: u.version, roles: ['expe'] }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    const gagnants = a.statusCode === 200 ? ['cheq'] : ['expe']
    const apres = UtilisateursAdminSchema.parse(
      (await lister(users.admin.h, `?q=${encodeURIComponent(u.identifiantExterne)}`)).json(),
    ).utilisateurs[0]
    expect(apres?.roles).toEqual(gagnants)
    expect(apres?.version).toBe(u.version + 1)
  })

  const rejets: [string, Record<string, unknown>, number, string][] = [
    ['corps vide (rien à modifier)', {}, 400, 'VALIDATION'],
    ['aucun rôle', { roles: [] }, 400, 'VALIDATION'],
    ['rôle inconnu', { roles: ['chef'] }, 400, 'VALIDATION'],
    ['site inconnu', { perimetre: [{ plateformeId: 999_999_999 }] }, 400, 'ADM_SITE_INCONNU'],
  ]
  it.each(rejets)('rejet : %s', async (_nom, corps, statut, code) => {
    const { users } = await acteurs()
    const u = await creerOk(users.admin.h)
    const r = await modifier(users.admin.h, u.id, { version: u.version, ...corps })
    expect(r.statusCode, r.body).toBe(statut)
    expect(erreur(r).code).toBe(code)
  })

  it('D-01 un utilisateur inconnu : 404', async () => {
    const { users } = await acteurs()
    const r = await modifier(users.admin.h, 999_999_999, { version: 1, nom: 'x' })
    expect(r.statusCode).toBe(404)
    expect(erreur(r).code).toBe('ADM_UTILISATEUR_INTROUVABLE')
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne modifie aucun compte : 403, rien d’écrit',
    async (role) => {
      const { users } = await acteurs()
      const u = await creerOk(users.admin.h, { roles: ['recep'] })
      const r = await modifier(users[role].h, u.id, { version: u.version, roles: ['admin'] })
      expect(r.statusCode).toBe(403)
      expect(
        UtilisateursAdminSchema.parse(
          (await lister(users.admin.h, `?q=${encodeURIComponent(u.identifiantExterne)}`)).json(),
        ).utilisateurs[0]?.roles,
      ).toEqual(['recep'])
    },
  )

  it('atomicité : une panne du journal annule la modification (rôles, périmètre, nom, version inchangés)', async () => {
    const { users, plateforme } = await acteurs()
    const u = await creerOk(users.admin.h, { roles: ['recep'], nom: 'Stable' })
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      modifier(users.admin.h, u.id, {
        version: u.version,
        nom: 'Ne reste pas',
        roles: ['admin'],
        perimetre: [{ plateformeId: plateforme.id }],
      }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    const apres = UtilisateursAdminSchema.parse(
      (await lister(users.admin.h, `?q=${encodeURIComponent(u.identifiantExterne)}`)).json(),
    ).utilisateurs[0]
    expect([apres?.nom, apres?.roles, apres?.perimetre, apres?.version]).toEqual([
      'Stable',
      ['recep'],
      [],
      u.version,
    ])
  })
})

describe('D-01 pas d’élévation de ses propres droits, dernier administrateur protégé (Q-406)', () => {
  it('un administrateur ne modifie ni ses rôles, ni son périmètre, ni son état : 409 ADM_AUTO_MODIFICATION', async () => {
    const { users, plateforme } = await acteurs()
    const moi = users.admin
    const lu = UtilisateursAdminSchema.parse(
      (await lister(moi.h, `?q=${encodeURIComponent(moi.identifiant)}`)).json(),
    ).utilisateurs[0]
    expect(lu).toBeDefined()
    const version = lu?.version ?? 1
    for (const corps of [
      { roles: ['recep'] },
      { roles: ['admin', 'coord'] },
      { perimetre: [{ plateformeId: plateforme.id }] },
      { actif: false },
    ]) {
      const r = await modifier(moi.h, moi.id, { version, ...corps })
      expect(r.statusCode, JSON.stringify(corps)).toBe(409)
      expect(erreur(r).code).toBe('ADM_AUTO_MODIFICATION')
    }
    const apres = UtilisateursAdminSchema.parse(
      (await lister(moi.h, `?q=${encodeURIComponent(moi.identifiant)}`)).json(),
    ).utilisateurs[0]
    expect([apres?.roles, apres?.actif, apres?.version]).toEqual([['admin'], true, version])
    // L'administrateur reste administrateur actif : le système n'est jamais privé de son dernier administrateur.
    expect((await get(ctx, '/api/admin/parametres', moi.h)).statusCode).toBe(200)
  })

  it('un administrateur peut corriger son propre nom (aucun droit touché)', async () => {
    const { users } = await acteurs()
    const lu = UtilisateursAdminSchema.parse(
      (await lister(users.admin.h, `?q=${encodeURIComponent(users.admin.identifiant)}`)).json(),
    ).utilisateurs[0]
    const r = await modifier(users.admin.h, users.admin.id, {
      version: lu?.version ?? 1,
      nom: 'Mon nom',
    })
    expect(r.statusCode, r.body).toBe(200)
  })

  it('un autre administrateur peut retirer le rôle d’un administrateur (il en reste un actif : l’acteur)', async () => {
    const { users } = await acteurs()
    const cible = await creerOk(users.admin.h, { roles: ['admin'] })
    const r = await modifier(users.admin.h, cible.id, { version: cible.version, roles: ['com'] })
    expect(r.statusCode, r.body).toBe(200)
    expect(UtilisateurAdminSchema.parse(r.json()).roles).toEqual(['com'])
  })
})

describe('D-01 compte technique « circe-automatique » (Q-412) et dernier administrateur (m1)', () => {
  const SYS = 'circe-automatique'
  const nettoyerSysteme = async () => {
    const u = await db.utilisateur.findUnique({ where: { identifiantExterne: SYS } })
    if (!u) return
    await db.utilisateurRole.deleteMany({ where: { utilisateurId: u.id } })
    await db.utilisateurPerimetre.deleteMany({ where: { utilisateurId: u.id } })
    await db.utilisateur.update({ where: { id: u.id }, data: { actif: false } })
  }

  it('Q-412 nominal : le compte technique est masqué de la liste ; les tâches l’utilisent tant qu’il est inactif et sans rôle', async () => {
    const { users } = await acteurs()
    const { identiteSysteme } = await import('../../src/modules/taches/service.ts')
    await nettoyerSysteme()
    await identiteSysteme(db)
    const l = UtilisateursAdminSchema.parse((await lister(users.admin.h, `?q=${SYS}`)).json())
    expect(l.utilisateurs.map((u) => u.identifiantExterne)).not.toContain(SYS)
  })

  it('Q-412 rejet : création (casse ignorée) et modification du compte technique ⇒ 409 ADM_COMPTE_TECHNIQUE', async () => {
    const { users } = await acteurs()
    const { identiteSysteme } = await import('../../src/modules/taches/service.ts')
    await nettoyerSysteme()
    const sys = await identiteSysteme(db)
    for (const identifiantExterne of [SYS, 'Circe-Automatique']) {
      const r = await creer(users.admin.h, { identifiantExterne, roles: ['admin'], perimetre: [] })
      expect(r.statusCode, r.body).toBe(409)
      expect(erreur(r).code).toBe('ADM_COMPTE_TECHNIQUE')
    }
    const m = await modifier(users.admin.h, sys.userId, {
      version: 1,
      actif: true,
      roles: ['admin'],
    })
    expect(m.statusCode, m.body).toBe(409)
    expect(erreur(m).code).toBe('ADM_COMPTE_TECHNIQUE')
    const apres = await db.utilisateur.findUniqueOrThrow({ where: { id: sys.userId } })
    expect(apres.actif).toBe(false)
    expect(await db.utilisateurRole.count({ where: { utilisateurId: sys.userId } })).toBe(0)
  })

  it('Q-412 rejet : compte technique actif ou doté d’un rôle en base ⇒ identiteSysteme échoue (409 TACHE_COMPTE_TECHNIQUE_INVALIDE)', async () => {
    const { identiteSysteme } = await import('../../src/modules/taches/service.ts')
    await nettoyerSysteme()
    const sys = await identiteSysteme(db)
    try {
      await db.utilisateur.update({ where: { id: sys.userId }, data: { actif: true } })
      await expect(identiteSysteme(db)).rejects.toMatchObject({
        code: 'TACHE_COMPTE_TECHNIQUE_INVALIDE',
      })
      await db.utilisateur.update({ where: { id: sys.userId }, data: { actif: false } })
      const role = await db.role.findFirstOrThrow({ where: { code: 'admin' } })
      await db.utilisateurRole.create({ data: { utilisateurId: sys.userId, roleId: role.id } })
      await expect(identiteSysteme(db)).rejects.toMatchObject({
        code: 'TACHE_COMPTE_TECHNIQUE_INVALIDE',
      })
    } finally {
      await nettoyerSysteme()
    }
    await expect(identiteSysteme(db)).resolves.toMatchObject({ userId: sys.userId })
  })

  it('m1 concurrence : deux administrateurs (les seuls actifs) qui se désactivent mutuellement ⇒ un seul passe, il reste un administrateur actif', async () => {
    const { users } = await acteurs()
    const a = users.admin
    const b = await creerOk(a.h, { roles: ['admin'] })
    const hb = devHeaders(b.identifiantExterne)
    const autres = await db.utilisateur.findMany({
      where: {
        actif: true,
        id: { notIn: [a.id, b.id] },
        roles: { some: { role: { code: 'admin' } } },
      },
      select: { id: true },
    })
    const ids = autres.map((u) => u.id)
    await db.utilisateur.updateMany({ where: { id: { in: ids } }, data: { actif: false } })
    try {
      const va = (await db.utilisateur.findUniqueOrThrow({ where: { id: a.id } })).version
      const [r1, r2] = await Promise.all([
        modifier(a.h, b.id, { version: b.version, actif: false }),
        modifier(hb, a.id, { version: va, actif: false }),
      ])
      const codes = [r1.statusCode, r2.statusCode]
      expect(codes.filter((c) => c === 200)).toHaveLength(1)
      expect(codes.filter((c) => c !== 200).every((c) => [401, 403, 409].includes(c))).toBe(true)
      const actifs = await db.utilisateur.count({
        where: { actif: true, roles: { some: { role: { code: 'admin' } } } },
      })
      expect(actifs).toBeGreaterThanOrEqual(1)
    } finally {
      await db.utilisateur.updateMany({ where: { id: { in: ids } }, data: { actif: true } })
      await db.utilisateur.updateMany({
        where: { id: { in: [a.id, b.id] } },
        data: { actif: true },
      })
    }
  })
})
