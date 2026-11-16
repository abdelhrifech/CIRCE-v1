// Étape 8 (D-02) — tests d'INTÉGRATION de la lecture des sites et ateliers (ECR-ADM-01 « Sites, ateliers et gammes »,
// lecture seule dans la maquette : pas de CRUD ; site ≡ plateforme, Q-335). Droit `parametrage.gerer` (administrateur
// seul, Q-406). Les formats, machines et gammes ne sont pas modélisés (ECARTS). Aucun test unitaire.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SitesAdminSchema, type Role } from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

async function acteurs() {
  const plateforme = await f.createPlateforme(db, {
    localite: 'Nîmes',
    mail: 'site@test.fr',
    idSiteCcf: 39,
  })
  const scroll = await f.createAtelier(db, {
    plateformeId: plateforme.id,
    type: 'SCROLL',
    libelle: 'AA Déroulant',
  })
  const fixe = await f.createAtelier(db, {
    plateformeId: plateforme.id,
    type: 'FIXE',
    libelle: 'BB Fixe',
    codeAmt: 12,
  })
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, scroll, fixe, users }
}

describe('D-02 ECR-ADM-01 sites et ateliers (lecture)', () => {
  it('D-02 l’administrateur lit les sites avec leurs ateliers (mode, code AMT), triés par nom puis libellé', async () => {
    const { users, plateforme, scroll, fixe } = await acteurs()
    // Filtré par nom : la liste complète est bornée à 200 sites (la base de test en contient bien plus).
    const r = await get(
      ctx,
      `/api/admin/sites?q=${encodeURIComponent(plateforme.nom)}`,
      users.admin,
    )
    expect(r.statusCode, r.body).toBe(200)
    const site = SitesAdminSchema.parse(r.json()).sites.find((s) => s.id === plateforme.id)
    expect(site).toMatchObject({
      nom: plateforme.nom,
      localite: 'Nîmes',
      mail: 'site@test.fr',
      idSiteCcf: 39,
    })
    expect(site?.ateliers).toEqual([
      { id: scroll.id, libelle: 'AA Déroulant', type: 'SCROLL', codeAmt: null },
      { id: fixe.id, libelle: 'BB Fixe', type: 'FIXE', codeAmt: 12 },
    ])
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s ne lit pas les sites : 403',
    async (role) => {
      const { users } = await acteurs()
      const r = await get(ctx, '/api/admin/sites', users[role])
      expect(r.statusCode).toBe(403)
      expect(erreur(r).regle).toBe('RG-REC-002')
    },
  )

  it('RG-REC-004 sans identité : 401', async () => {
    expect((await get(ctx, '/api/admin/sites', {})).statusCode).toBe(401)
  })

  it('D-02 le filtre texte porte sur le nom du site ou le libellé d’un atelier ; total du filtre, 200 sites au plus', async () => {
    const { users, plateforme, scroll } = await acteurs()
    const parSite = SitesAdminSchema.parse(
      (
        await get(ctx, `/api/admin/sites?q=${encodeURIComponent(plateforme.nom)}`, users.admin)
      ).json(),
    )
    expect(parSite.sites.map((s) => s.id)).toEqual([plateforme.id])
    expect(parSite.total).toBe(1)
    const parAtelier = SitesAdminSchema.parse(
      (
        await get(ctx, `/api/admin/sites?q=${encodeURIComponent(scroll.libelle)}`, users.admin)
      ).json(),
    )
    expect(parAtelier.sites.map((s) => s.id)).toContain(plateforme.id)
    const tous = SitesAdminSchema.parse((await get(ctx, '/api/admin/sites', users.admin)).json())
    expect(tous.sites.length).toBeLessThanOrEqual(200)
    expect(tous.total).toBeGreaterThanOrEqual(tous.sites.length)
  })

  it('D-02 aucune route d’écriture : la maquette n’a pas de CRUD (405/404)', async () => {
    const { users } = await acteurs()
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/sites',
      headers: users.admin,
      payload: {},
    })
    expect([404, 405]).toContain(r.statusCode)
  })
})
