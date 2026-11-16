// Étape 8 (D-06) — tests d'INTÉGRATION de la gestion des paramètres métier (ECR-ADM-05 « Règles métier », EX-TRA-041) :
// lecture, modification validée par format, verrou de version, journal / historique, droits, concurrence, atomicité.
// Référence de règle : RG-REC-178 (paramètres Réception), RG-REC-002 (droits), RG-REC-009 (version), RG-REC-008
// (idempotence). Hypothèses : Q-405 (bornes, formats, structures non modifiables). API réelle sur la base de test ;
// chaque paramètre modifié est restauré (afterAll). Aucun test unitaire.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  HistoriqueParametreSchema,
  ParametreAdminSchema,
  ParametresAdminSchema,
  PARAMETRES_ADMIN,
  type Role,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

const touches = new Map<string, { valeur: string; version: number } | null>()
async function memoriser(cle: string) {
  if (touches.has(cle)) return
  const l = await db.parametre.findFirst({ where: { cle, plateformeId: null } })
  touches.set(cle, l ? { valeur: l.valeur, version: l.version } : null)
}
beforeAll(() => ctx.demarrer())
afterAll(async () => {
  for (const [cle, avant] of touches) {
    if (avant)
      await db.parametre.updateMany({
        where: { cle, plateformeId: null },
        data: { valeur: avant.valeur, version: avant.version },
      })
    else await db.parametre.deleteMany({ where: { cle, plateformeId: null } })
  }
  await db.journalAudit.deleteMany({
    where: {
      typeEntite: 'PARAMETRE',
      entiteId: { in: [...touches.keys()] },
      parId: { in: acteurs },
    },
  })
  await ctx.arreter()
})
const acteurs: number[] = []

async function utilisateurs() {
  const plateforme = await f.createPlateforme(db)
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    acteurs.push(u.id)
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, users }
}

const lister = (h: H) => get(ctx, '/api/admin/parametres', h)
const lireParam = async (h: H, cle: string) => {
  const r = await lister(h)
  expect(r.statusCode, r.body).toBe(200)
  const p = ParametresAdminSchema.parse(r.json()).parametres.find((x) => x.cle === cle)
  if (!p) throw new Error(`paramètre ${cle} absent`)
  return p
}
const ecrire = (h: H, cle: string, valeur: string, version: number) =>
  ctx.app.inject({
    method: 'PUT',
    url: `/api/admin/parametres/${cle}`,
    headers: h,
    payload: { valeur, version },
  })
/** Écrit avec la version courante lue sur l'API. */
async function ecrireCourant(h: H, cle: string, valeur: string) {
  await memoriser(cle)
  const p = await lireParam(h, cle)
  return ecrire(h, cle, valeur, p.version)
}

describe('EX-TRA-041 ECR-ADM-05 lire les paramètres', () => {
  it('EX-TRA-041 l’administrateur lit tous les paramètres du registre : valeur, valeur initiale, format, source, version', async () => {
    const { users } = await utilisateurs()
    const r = await lister(users.admin)
    expect(r.statusCode, r.body).toBe(200)
    const { parametres } = ParametresAdminSchema.parse(r.json())
    expect(parametres.map((p) => p.cle)).toEqual(PARAMETRES_ADMIN.map((d) => d.cle))
    const purge = parametres.find((p) => p.cle === 'reception.purgeAttendues')
    expect(purge).toMatchObject({
      groupe: 'Réception',
      valeurParDefaut: '4',
      modifiable: true,
      format: { type: 'entier', min: 1, max: 52 },
    })
    expect(purge?.source).toContain('RG-REC-178')
    // Aucun identifiant legacy supposé : les listes d'ateliers / types sont vides par défaut (Q-319).
    for (const cle of ['suivi8m2.ateliers', 'unitaire.typesPliage', 'colis.ateliersMajoration'])
      expect(parametres.find((p) => p.cle === cle)?.valeurParDefaut).toBe('')
  })

  it('EX-TRA-041 les valeurs structurées sont listées mais non modifiables (modifiable = false, raison fournie)', async () => {
    const { users } = await utilisateurs()
    const p = await lireParam(users.admin, 'integration.routagePliage')
    expect(p.modifiable).toBe(false)
    expect(p.format.type).toBe('structure')
    expect(p.format.raison).toBeTruthy()
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne lit pas les paramètres : 403',
    async (role) => {
      const { users } = await utilisateurs()
      const r = await lister(users[role])
      expect(r.statusCode).toBe(403)
      expect(erreur(r).regle).toBe('RG-REC-002')
    },
  )

  it('RG-REC-004 sans identité : 401', async () => {
    expect((await get(ctx, '/api/admin/parametres', {})).statusCode).toBe(401)
  })
})

describe('EX-TRA-041 modifier un paramètre : un cas nominal par format', () => {
  it('entier : purge des attendues 4 → 6, journalisée, nouvelle version', async () => {
    const { users } = await utilisateurs()
    const avant = await lireParam(users.admin, 'reception.purgeAttendues')
    const r = await ecrireCourant(users.admin, 'reception.purgeAttendues', ' 6 ')
    expect(r.statusCode, r.body).toBe(200)
    const p = ParametreAdminSchema.parse(r.json())
    expect(p.valeur).toBe('6')
    expect(p.version).toBe(avant.version + 1)
    expect((await lireParam(users.admin, 'reception.purgeAttendues')).valeur).toBe('6')
    const j = await db.journalAudit.findFirst({
      where: { typeEntite: 'PARAMETRE', entiteId: 'reception.purgeAttendues' },
      orderBy: { id: 'desc' },
    })
    expect([j?.action, j?.ancienneValeur, j?.nouvelleValeur]).toEqual([
      'MODIFICATION_PARAMETRE',
      avant.valeur,
      '6',
    ])
    expect(j?.parId).not.toBeNull()
  })

  it('décimal : seuil des thèmes proches 0.85 → 0.9', async () => {
    const { users } = await utilisateurs()
    const r = await ecrireCourant(users.admin, 'coordination.seuilThemesProches', '0.9')
    expect(r.statusCode, r.body).toBe(200)
    expect(ParametreAdminSchema.parse(r.json()).valeur).toBe('0.9')
  })

  it('énumération : arrondi d’entretien SUPERIEUR → PROCHE', async () => {
    const { users } = await utilisateurs()
    const r = await ecrireCourant(users.admin, 'trains.entretienArrondi', 'PROCHE')
    expect(r.statusCode, r.body).toBe(200)
    expect(ParametreAdminSchema.parse(r.json()).valeur).toBe('PROCHE')
  })

  it('liste d’ateliers : ateliers 8 m² = deux ateliers existants, normalisée sans espaces', async () => {
    const { users, plateforme } = await utilisateurs()
    const a1 = await f.createAtelier(db, { plateformeId: plateforme.id })
    const a2 = await f.createAtelier(db, { plateformeId: plateforme.id })
    const r = await ecrireCourant(
      users.admin,
      'suivi8m2.ateliers',
      ` ${String(a1.id)} ; ${String(a2.id)} `,
    )
    expect(r.statusCode, r.body).toBe(200)
    expect(ParametreAdminSchema.parse(r.json()).valeur).toBe(`${String(a1.id)};${String(a2.id)}`)
    const vide = await ecrireCourant(users.admin, 'suivi8m2.ateliers', '')
    expect(ParametreAdminSchema.parse(vide.json()).valeur).toBe('')
  })

  it('liste de types de préparation : types du pliage = un type existant', async () => {
    const { users } = await utilisateurs()
    const t = await f.createTypePreparation(db)
    const r = await ecrireCourant(users.admin, 'unitaire.typesPliage', String(t.id))
    expect(r.statusCode, r.body).toBe(200)
    expect(ParametreAdminSchema.parse(r.json()).valeur).toBe(String(t.id))
    await ecrireCourant(users.admin, 'unitaire.typesPliage', '')
  })
})

describe('EX-TRA-041 modifier un paramètre : rejets de validation (400, rien d’écrit)', () => {
  const cas: [string, string, string][] = [
    ['entier hors bornes (53 semaines)', 'reception.purgeAttendues', '53'],
    ['entier sous la borne (0)', 'reception.purgeAttendues', '0'],
    ['entier non numérique', 'reception.purgeAttendues', 'abc'],
    ['entier décimal', 'reception.purgeAttendues', '4.5'],
    ['exemplaires de feuille 6 (max 5, ECR-ADM-05)', 'reception.exemplairesFeuille', '6'],
    ['exemplaires de feuille 0 (min 1, ECR-ADM-05)', 'reception.exemplairesFeuille', '0'],
    ['décimal hors bornes (1.5)', 'coordination.seuilThemesProches', '1.5'],
    ['décimal à virgule', 'coordination.seuilThemesProches', '0,9'],
    ['énumération hors liste', 'trains.entretienArrondi', 'INFERIEUR'],
    ['liste d’ateliers non numérique', 'suivi8m2.ateliers', 'a;b'],
    ['liste d’ateliers avec identifiant nul', 'suivi8m2.ateliers', '0'],
    ['liste d’ateliers avec trou', 'suivi8m2.ateliers', '1;;2'],
    ['liste de types non numérique', 'unitaire.typesBus', 'x'],
  ]
  it.each(cas)('%s', async (_nom, cle, valeur) => {
    const { users } = await utilisateurs()
    await memoriser(cle)
    const avant = await lireParam(users.admin, cle)
    const r = await ecrire(users.admin, cle, valeur, avant.version)
    expect(r.statusCode, r.body).toBe(400)
    expect(erreur(r).code).toBe('ADM_PARAMETRE_INVALIDE')
    expect(await lireParam(users.admin, cle)).toEqual(avant)
  })

  it('liste d’ateliers : un atelier inconnu est refusé avec la liste des inconnus', async () => {
    const { users } = await utilisateurs()
    const r = await ecrireCourant(users.admin, 'suivi8m2.ateliers', '999999999')
    expect(r.statusCode).toBe(400)
    expect(erreur(r).code).toBe('ADM_PARAMETRE_INVALIDE')
    expect(erreur(r).message).toContain('999999999')
  })

  it('liste d’ateliers : un identifiant répété est refusé', async () => {
    const { users, plateforme } = await utilisateurs()
    const a = await f.createAtelier(db, { plateformeId: plateforme.id })
    const r = await ecrireCourant(
      users.admin,
      'colis.ateliersMajoration',
      `${String(a.id)};${String(a.id)}`,
    )
    expect(r.statusCode).toBe(400)
    expect(erreur(r).message).toContain('répété')
  })

  it('liste de types : un type de préparation inconnu est refusé', async () => {
    const { users } = await utilisateurs()
    const r = await ecrireCourant(users.admin, 'unitaire.typesBus', '999999999')
    expect(r.statusCode).toBe(400)
    expect(erreur(r).message).toContain('type de préparation inconnu')
  })

  it('le corps est validé : valeur absente ou version négative → 400', async () => {
    const { users } = await utilisateurs()
    const sans = await ctx.app.inject({
      method: 'PUT',
      url: '/api/admin/parametres/reception.purgeAttendues',
      headers: users.admin,
      payload: { version: 1 },
    })
    expect(sans.statusCode).toBe(400)
    const neg = await ecrire(users.admin, 'reception.purgeAttendues', '5', -1)
    expect(neg.statusCode).toBe(400)
  })
})

describe('EX-TRA-041 paramètre non modifiable ou inconnu', () => {
  it('une valeur structurée : 422 ADM_PARAMETRE_NON_MODIFIABLE', async () => {
    const { users } = await utilisateurs()
    const p = await lireParam(users.admin, 'integration.routagePliage')
    const r = await ecrire(users.admin, 'integration.routagePliage', '39:2', p.version)
    expect(r.statusCode).toBe(422)
    expect(erreur(r).code).toBe('ADM_PARAMETRE_NON_MODIFIABLE')
  })

  it('l’allée des inconnues (réglée par site dans la Réception, Q-105) n’est pas modifiable ici', async () => {
    const { users } = await utilisateurs()
    const p = await lireParam(users.admin, 'reception.alleeInconnues')
    const r = await ecrire(users.admin, 'reception.alleeInconnues', 'Y', p.version)
    expect(r.statusCode).toBe(422)
  })

  it('un paramètre hors registre : 404 ADM_PARAMETRE_INCONNU (écriture et historique)', async () => {
    const { users } = await utilisateurs()
    const r = await ecrire(users.admin, 'inconnu.parametre', '1', 0)
    expect(r.statusCode).toBe(404)
    expect(erreur(r).code).toBe('ADM_PARAMETRE_INCONNU')
    const h = await get(ctx, '/api/admin/parametres/inconnu.parametre/historique', users.admin)
    expect(h.statusCode).toBe(404)
  })
})

describe('RG-REC-009 verrou de version', () => {
  it('une version périmée : 409 ADM_CONFLIT_VERSION, rien d’écrit', async () => {
    const { users } = await utilisateurs()
    await memoriser('reception.delaiControle')
    const p0 = await lireParam(users.admin, 'reception.delaiControle')
    expect(
      (await ecrire(users.admin, 'reception.delaiControle', '30', p0.version)).statusCode,
    ).toBe(200)
    const perime = await ecrire(users.admin, 'reception.delaiControle', '36', p0.version)
    expect(perime.statusCode).toBe(409)
    expect(erreur(perime).code).toBe('ADM_CONFLIT_VERSION')
    expect((await lireParam(users.admin, 'reception.delaiControle')).valeur).toBe('30')
  })

  it('une valeur identique n’écrit rien : version inchangée, aucune entrée de journal', async () => {
    const { users } = await utilisateurs()
    await memoriser('reception.comptageMorceau')
    const p = await lireParam(users.admin, 'reception.comptageMorceau')
    const avant = await db.journalAudit.count({
      where: { typeEntite: 'PARAMETRE', entiteId: 'reception.comptageMorceau' },
    })
    const r = await ecrire(users.admin, 'reception.comptageMorceau', ` ${p.valeur} `, p.version)
    expect(r.statusCode, r.body).toBe(200)
    expect(ParametreAdminSchema.parse(r.json()).version).toBe(p.version)
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'PARAMETRE', entiteId: 'reception.comptageMorceau' },
      }),
    ).toBe(avant)
  })

  it('une valeur identique avec une version périmée reste un 409 (la lecture de l’écran est périmée)', async () => {
    const { users } = await utilisateurs()
    await memoriser('reception.exemplairesFeuille')
    const p = await lireParam(users.admin, 'reception.exemplairesFeuille')
    await ecrire(users.admin, 'reception.exemplairesFeuille', '3', p.version)
    const r = await ecrire(users.admin, 'reception.exemplairesFeuille', '3', p.version)
    expect(r.statusCode).toBe(409)
  })

  it('un paramètre jamais écrit (valeur du seed absente en base) : version 0 requise, ligne créée, journalisée', async () => {
    const { users } = await utilisateurs()
    const cle = 'alertes.joursEvenements'
    await memoriser(cle)
    await db.parametre.deleteMany({ where: { cle, plateformeId: null } })
    const p = await lireParam(users.admin, cle)
    expect(p.version).toBe(0)
    const faux = await ecrire(users.admin, cle, '9', 3)
    expect(faux.statusCode).toBe(409)
    const ok = await ecrire(users.admin, cle, '9', 0)
    expect(ok.statusCode, ok.body).toBe(200)
    const cree = ParametreAdminSchema.parse(ok.json())
    expect([cree.valeur, cree.version]).toEqual(['9', 1])
    expect(await db.parametre.count({ where: { cle, plateformeId: null } })).toBe(1)
    // Écrire la valeur initiale d'un paramètre jamais écrit ne crée rien.
    await db.parametre.deleteMany({ where: { cle, plateformeId: null } })
    const initiale = await ecrire(users.admin, cle, '7', 0)
    expect(initiale.statusCode).toBe(200)
    expect(await db.parametre.count({ where: { cle, plateformeId: null } })).toBe(0)
  })

  it('concurrence : deux écritures simultanées avec la même version : un seul gagnant (200), l’autre 409, une seule entrée de journal', async () => {
    const { users } = await utilisateurs()
    const cle = 'trains.tiroirsMax'
    await memoriser(cle)
    const p = await lireParam(users.admin, cle)
    const avant = await db.journalAudit.count({ where: { typeEntite: 'PARAMETRE', entiteId: cle } })
    const [a, b] = await Promise.all([
      ecrire(users.admin, cle, '21', p.version),
      ecrire(users.admin, cle, '22', p.version),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    const gagnante = a.statusCode === 200 ? '21' : '22'
    expect((await lireParam(users.admin, cle)).valeur).toBe(gagnante)
    expect(await db.journalAudit.count({ where: { typeEntite: 'PARAMETRE', entiteId: cle } })).toBe(
      avant + 1,
    )
  })
})

describe('EX-TRA-041 historique des modifications', () => {
  it('l’historique liste les modifications, la plus récente d’abord, avec l’auteur', async () => {
    const { users } = await utilisateurs()
    const cle = 'trains.positionsMax'
    await memoriser(cle)
    expect((await ecrireCourant(users.admin, cle, '5')).statusCode).toBe(200)
    expect((await ecrireCourant(users.admin, cle, '4')).statusCode).toBe(200)
    const r = await get(ctx, `/api/admin/parametres/${cle}/historique`, users.admin)
    expect(r.statusCode, r.body).toBe(200)
    const h = HistoriqueParametreSchema.parse(r.json()).historique
    expect(h.length).toBeGreaterThanOrEqual(2)
    expect([h[0]?.ancienneValeur, h[0]?.nouvelleValeur]).toEqual(['5', '4'])
    expect(h[1]?.nouvelleValeur).toBe('5')
    expect(h[0]?.par).toBeTruthy()
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne lit ni n’écrit : 403 et rien d’écrit',
    async (role) => {
      const { users } = await utilisateurs()
      const cle = 'dispatch.seuilChargePct'
      await memoriser(cle)
      const avant = await lireParam(users.admin, cle)
      const w = await ecrire(users[role], cle, '120', avant.version)
      expect(w.statusCode).toBe(403)
      expect(
        (await get(ctx, `/api/admin/parametres/${cle}/historique`, users[role])).statusCode,
      ).toBe(403)
      expect(await lireParam(users.admin, cle)).toEqual(avant)
    },
  )
})

describe('Atomicité', () => {
  it('une panne du journal annule la modification : la valeur est inchangée', async () => {
    const { users } = await utilisateurs()
    const cle = 'integration.timeoutSecondes'
    await memoriser(cle)
    const avant = await lireParam(users.admin, cle)
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      ecrire(users.admin, cle, '601', avant.version),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await lireParam(users.admin, cle)).toEqual(avant)
  })
})
