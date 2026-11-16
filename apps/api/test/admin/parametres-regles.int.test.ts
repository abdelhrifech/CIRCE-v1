// Étape 8 (D-06) — preuve que les règles qui dépendent d'un paramètre vide par défaut (Q-319) s'activent quand
// l'administrateur renseigne ce paramètre PAR L'API D'ADMINISTRATION (et non par une écriture directe en base) :
// RG-COO-237 (suivi 8 m² : ateliers 8 m²) et RG-COO-263 (+3 kg des ateliers 8 m² au colisage). Les règles elles-mêmes
// sont testées dans roulage-8m2-rouleurs.int.test.ts et colis.int.test.ts ; ici on prouve la chaîne
// « saisie du paramètre → comportement » avec des paramètres renseignés. Hypothèses : Q-195, Q-197 (10), Q-405.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ParametresAdminSchema,
  ResultatColisSchema,
  Suivi8m2Schema,
  type Role,
} from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import {
  DEPART_TXT,
  recu,
  ROLES,
  siteDeroulant,
  trainExportable,
} from '../support/export-trains.ts'
import { contexteReception, get, idem } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

const memoire = new Map<string, string | null>()
beforeAll(() => ctx.demarrer())
afterAll(async () => {
  for (const [cle, valeur] of memoire)
    if (valeur === null) await db.parametre.deleteMany({ where: { cle, plateformeId: null } })
    else await db.parametre.updateMany({ where: { cle, plateformeId: null }, data: { valeur } })
  await ctx.arreter()
})

async function parametrer(h: H, cle: string, valeur: string) {
  if (!memoire.has(cle))
    memoire.set(
      cle,
      (await db.parametre.findFirst({ where: { cle, plateformeId: null } }))?.valeur ?? null,
    )
  const lu = ParametresAdminSchema.parse((await get(ctx, '/api/admin/parametres', h)).json())
  const version = lu.parametres.find((p) => p.cle === cle)?.version ?? 0
  const r = await ctx.app.inject({
    method: 'PUT',
    url: `/api/admin/parametres/${cle}`,
    headers: h,
    payload: { valeur, version },
  })
  expect(r.statusCode, r.body).toBe(200)
}

describe('RG-COO-237 le suivi 8 m² s’active par la saisie du paramètre « ateliers 8 m² » (D-06)', () => {
  it('RG-COO-237 sans paramètre : aucun thème ; l’administrateur renseigne l’atelier : le thème apparaît ; il vide le paramètre : plus rien', async () => {
    const s = await siteDeroulant(ctx)
    const admin = s.users.admin.headers
    const contNum = 820_000 + Math.floor(Math.random() * 100_000)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum } })
    await recu(ctx, s, contNum, 'Rose', 1)
    const suivi = async () => {
      const r = await get(
        ctx,
        `/api/coordination/trains/suivi-8m2?depart=${DEPART_TXT}&atelier=${String(s.atelier.id)}`,
        s.users.coord.headers,
      )
      expect(r.statusCode, r.body).toBe(200)
      return Suivi8m2Schema.parse(r.json())
    }
    await parametrer(admin, 'suivi8m2.ateliers', '')
    expect((await suivi()).lignes).toEqual([])
    await parametrer(admin, 'suivi8m2.ateliers', String(s.atelier.id))
    const avec = await suivi()
    expect(avec.ateliers.map((a) => a.id)).toEqual([s.atelier.id])
    expect(avec.lignes).toHaveLength(1)
    expect(avec.lignes[0]).toMatchObject({
      contNum,
      theme: 'Rose',
      besoin: 1,
      recu: 1,
      resteAFaire: 1,
    })
    await parametrer(admin, 'suivi8m2.ateliers', '')
    expect((await suivi()).lignes).toEqual([])
  })
})

describe('RG-COO-263 la majoration de 3 kg s’active par la saisie du paramètre « ateliers majorés » (D-06)', () => {
  it('RG-COO-263 colis vide : minimum 1 kg ; l’administrateur renseigne l’atelier : un nouveau colis pèse 1 + 3 kg', async () => {
    const plateforme = await f.createPlateforme(db)
    const fixe = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'FIXE' })
    const dest = await f.createDestinataire(db)
    const users = {} as Record<Role, H>
    for (const r of ROLES) {
      const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
      users[r] = devHeaders(u.identifiantExterne)
    }
    const ouvrir = async () => {
      const r = await ctx.app.inject({
        method: 'POST',
        url: '/api/coordination/colis',
        headers: { ...users.expe, ...idem() },
        payload: { atelierId: fixe.id, destinataireId: dest.id },
      })
      expect(r.statusCode, r.body).toBe(200)
      return ResultatColisSchema.parse(r.json()).colis
    }
    await parametrer(users.admin, 'colis.ateliersMajoration', '')
    expect((await ouvrir())?.poids).toBe(1)
    await parametrer(users.admin, 'colis.ateliersMajoration', String(fixe.id))
    expect((await ouvrir())?.poids).toBe(4)
    await parametrer(users.admin, 'colis.ateliersMajoration', '')
    expect((await ouvrir())?.poids).toBe(1)
  })
})
