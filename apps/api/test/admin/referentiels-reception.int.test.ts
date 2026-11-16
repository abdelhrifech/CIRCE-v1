// Étape 8 (D-04) — tests d'INTÉGRATION des référentiels de réception (ECR-ADM-07, RG-REC-035 / 179, EX-REC-514) :
// imprimeurs et livreurs (GET / POST / PATCH /api/referentiels/:ref, administrateur seul, `referentiel.gerer`) et
// agents de réception = utilisateurs `recep` (GET /api/admin/referentiels/agents, lecture seule, Q-177 (1)).
// Les valeurs créées sont proposées (actives) ou non (désactivées) à la saisie d'une réception. Hypothèses : Q-407.
// API réelle sur la base de test ; libellés préfixés et purgés. Aucun test unitaire.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AgentsReceptionAdminSchema,
  ReferentielLigneSchema,
  ReferentielsReceptionSchema,
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
const PREFIXE = `RefAdm${String(Date.now())}`
const libelle = (s = '') => `${PREFIXE} ${String(next())}${s}`

beforeAll(() => ctx.demarrer())
afterAll(async () => {
  try {
    await db.imprimeur.deleteMany({ where: { libelle: { startsWith: PREFIXE } } })
    await db.livreur.deleteMany({ where: { libelle: { startsWith: PREFIXE } } })
  } catch {
    // purge au mieux
  }
  await ctx.arreter()
})

async function acteurs() {
  const plateforme = await f.createPlateforme(db)
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, users }
}

const ajouter = (ref: string, h: H, corps: unknown, cle: H = idem()) =>
  envoyer(ctx, `/api/referentiels/${ref}`, h, corps, cle)
const etat = (ref: string, h: H, id: number, corps: unknown) =>
  ctx.app.inject({
    method: 'PATCH',
    url: `/api/referentiels/${ref}/${String(id)}`,
    headers: h,
    payload: corps as object,
  })

describe.each(['imprimeurs', 'livreurs'] as const)('D-04 référentiel %s', (ref) => {
  it(`RG-REC-179 l’administrateur ajoute une valeur, la liste l’affiche (actifs et inactifs) et le journal la trace (${ref})`, async () => {
    const { users } = await acteurs()
    const l = libelle()
    const r = await ajouter(ref, users.admin, { libelle: `  ${l}  ` })
    expect(r.statusCode, r.body).toBe(201)
    const cree = ReferentielLigneSchema.parse(r.json())
    expect(cree).toMatchObject({ libelle: l, actif: true, version: 1 })
    const liste = z_liste(await get(ctx, `/api/referentiels/${ref}`, users.admin))
    expect(liste.find((x) => x.id === cree.id)).toBeDefined()
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'REFERENTIEL',
          action: 'MODIFICATION_REFERENTIEL',
          entiteId: `${ref}:${String(cree.id)}`,
          nouvelleValeur: l,
        },
      }),
    ).toBe(1)
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    `RG-REC-179 le rôle %s ne gère pas ${ref} : 403 sur la liste, l’ajout et la modification`,
    async (role) => {
      const { users } = await acteurs()
      expect((await get(ctx, `/api/referentiels/${ref}`, users[role])).statusCode).toBe(403)
      expect((await ajouter(ref, users[role], { libelle: libelle() })).statusCode).toBe(403)
      expect((await etat(ref, users[role], 1, { actif: false, version: 1 })).statusCode).toBe(403)
    },
  )

  it(`RG-REC-004 sans identité : 401 (${ref})`, async () => {
    expect((await get(ctx, `/api/referentiels/${ref}`, {})).statusCode).toBe(401)
    expect((await ajouter(ref, {}, { libelle: libelle() })).statusCode).toBe(401)
  })

  it(`RG-REC-179 libellé vide, trop long ou absent : 400 (${ref})`, async () => {
    const { users } = await acteurs()
    for (const corps of [{ libelle: '   ' }, { libelle: 'x'.repeat(151) }, {}])
      expect((await ajouter(ref, users.admin, corps)).statusCode).toBe(400)
  })

  it(`RG-REC-179 doublon (casse et espaces ignorés) : 409 REC_REFERENTIEL_DOUBLON (${ref}) [Q-178]`, async () => {
    const { users } = await acteurs()
    const l = libelle()
    expect((await ajouter(ref, users.admin, { libelle: l })).statusCode).toBe(201)
    const d = await ajouter(ref, users.admin, { libelle: ` ${l.toUpperCase()} ` })
    expect(d.statusCode).toBe(409)
    expect(erreur(d)).toMatchObject({ code: 'REC_REFERENTIEL_DOUBLON', regle: 'RG-REC-179' })
  })

  it(`RG-REC-008 idempotence : même clé, même corps rejoue sans doublon ; sans clé : 400 (${ref})`, async () => {
    const { users } = await acteurs()
    const l = libelle()
    const cle = idem()
    const a = await ajouter(ref, users.admin, { libelle: l }, cle)
    const b = await ajouter(ref, users.admin, { libelle: l }, cle)
    expect([a.statusCode, b.statusCode]).toEqual([201, 201])
    expect(ReferentielLigneSchema.parse(b.json()).id).toBe(
      ReferentielLigneSchema.parse(a.json()).id,
    )
    const sansCle = await ctx.app.inject({
      method: 'POST',
      url: `/api/referentiels/${ref}`,
      headers: users.admin,
      payload: { libelle: libelle() },
    })
    expect(sansCle.statusCode).toBe(400)
  })

  it(`concurrence : deux ajouts simultanés du même libellé : une seule valeur (201 + 409) (${ref})`, async () => {
    const { users } = await acteurs()
    const l = libelle()
    const [a, b] = await Promise.all([
      ajouter(ref, users.admin, { libelle: l }),
      ajouter(ref, users.admin, { libelle: l }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409])
    const n =
      ref === 'imprimeurs'
        ? await db.imprimeur.count({ where: { libelle: l } })
        : await db.livreur.count({ where: { libelle: l } })
    expect(n).toBe(1)
  })

  it(`RG-REC-009 désactivation puis réactivation sous verrou de version ; version périmée : 409 ; inconnu : 404 (${ref})`, async () => {
    const { users } = await acteurs()
    const cree = ReferentielLigneSchema.parse(
      (await ajouter(ref, users.admin, { libelle: libelle() })).json(),
    )
    const off = await etat(ref, users.admin, cree.id, { actif: false, version: cree.version })
    expect(off.statusCode).toBe(200)
    expect(ReferentielLigneSchema.parse(off.json())).toMatchObject({ actif: false, version: 2 })
    const perime = await etat(ref, users.admin, cree.id, { actif: true, version: cree.version })
    expect(perime.statusCode).toBe(409)
    expect(erreur(perime).code).toBe('REC_CONFLIT_VERSION')
    const on = await etat(ref, users.admin, cree.id, { actif: true, version: 2 })
    expect(ReferentielLigneSchema.parse(on.json())).toMatchObject({ actif: true, version: 3 })
    expect(
      (await etat(ref, users.admin, 999_999_999, { actif: true, version: 1 })).statusCode,
    ).toBe(404)
  })

  it(`RG-REC-009 concurrence : deux changements d’état avec la même version : 200 + 409 (${ref})`, async () => {
    const { users } = await acteurs()
    const cree = ReferentielLigneSchema.parse(
      (await ajouter(ref, users.admin, { libelle: libelle() })).json(),
    )
    const [a, b] = await Promise.all([
      etat(ref, users.admin, cree.id, { actif: false, version: cree.version }),
      etat(ref, users.admin, cree.id, { actif: false, version: cree.version }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it(`atomicité : une panne du journal annule l’ajout (aucune valeur créée) (${ref})`, async () => {
    const { users } = await acteurs()
    const l = libelle()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      ajouter(ref, users.admin, { libelle: l }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    const n =
      ref === 'imprimeurs'
        ? await db.imprimeur.count({ where: { libelle: l } })
        : await db.livreur.count({ where: { libelle: l } })
    expect(n).toBe(0)
  })
})

describe('D-04 effet sur la saisie d’une réception (ECR-REC-01, RG-REC-035)', () => {
  it('RG-REC-035 une valeur active est proposée à la saisie, une valeur désactivée ne l’est plus (imprimeur et livreur)', async () => {
    const { users } = await acteurs()
    const imp = ReferentielLigneSchema.parse(
      (await ajouter('imprimeurs', users.admin, { libelle: libelle() })).json(),
    )
    const liv = ReferentielLigneSchema.parse(
      (await ajouter('livreurs', users.admin, { libelle: libelle() })).json(),
    )
    const lire = async () =>
      ReferentielsReceptionSchema.parse(
        (await get(ctx, '/api/reception/referentiels', users.recep)).json(),
      )
    let ref = await lire()
    expect(ref.imprimeurs.some((x) => x.id === imp.id)).toBe(true)
    expect(ref.livreurs.some((x) => x.id === liv.id)).toBe(true)
    await etat('imprimeurs', users.admin, imp.id, { actif: false, version: imp.version })
    await etat('livreurs', users.admin, liv.id, { actif: false, version: liv.version })
    ref = await lire()
    expect(ref.imprimeurs.some((x) => x.id === imp.id)).toBe(false)
    expect(ref.livreurs.some((x) => x.id === liv.id)).toBe(false)
  })
})

describe('D-04 agents de réception (contrôleurs, EX-REC-514)', () => {
  it('RG-REC-179 l’administrateur lit les agents : utilisateurs recep (actifs et désactivés) avec leur plateforme ; les autres rôles sont exclus', async () => {
    const { users, plateforme } = await acteurs()
    const agent = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: plateforme.id }],
    )
    const inactif = await f.createUtilisateurAvecRoles(
      db,
      ['recep'],
      [{ plateformeId: plateforme.id }],
    )
    await db.utilisateur.update({ where: { id: inactif.id }, data: { actif: false } })
    const coord = await f.createUtilisateurAvecRoles(
      db,
      ['coord'],
      [{ plateformeId: plateforme.id }],
    )
    const r = await get(
      ctx,
      `/api/admin/referentiels/agents?q=${encodeURIComponent(agent.identifiantExterne.slice(0, 20))}`,
      users.admin,
    )
    expect(r.statusCode, r.body).toBe(200)
    const { agents } = AgentsReceptionAdminSchema.parse(r.json())
    const a = agents.find((x) => x.id === agent.id)
    expect(a).toMatchObject({ actif: true, plateformes: [plateforme.nom] })
    const tous = AgentsReceptionAdminSchema.parse(
      (await get(ctx, '/api/admin/referentiels/agents', users.admin)).json(),
    )
    expect(tous.total).toBeGreaterThan(0)
    expect(tous.agents.every((x) => x.id !== coord.id)).toBe(true)
    const filtre = AgentsReceptionAdminSchema.parse(
      (
        await get(
          ctx,
          `/api/admin/referentiels/agents?q=${encodeURIComponent(inactif.identifiantExterne)}`,
          users.admin,
        )
      ).json(),
    )
    expect(filtre.agents.map((x) => [x.id, x.actif])).toEqual([[inactif.id, false]])
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne lit pas les agents (administration) : 403',
    async (role) => {
      const { users } = await acteurs()
      const r = await get(ctx, '/api/admin/referentiels/agents', users[role])
      expect(r.statusCode).toBe(403)
      expect(erreur(r).regle).toBe('RG-REC-002')
    },
  )

  it('RG-REC-004 sans identité : 401', async () => {
    expect((await get(ctx, '/api/admin/referentiels/agents', {})).statusCode).toBe(401)
  })
})

function z_liste(r: { json: () => unknown }) {
  return ReferentielLigneSchema.array().parse(r.json())
}
