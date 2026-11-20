import { beforeAll, afterAll, it, expect } from 'vitest'
import {
  ConfigurationFinCampagneSchema,
  MachineConfigurationSchema,
  BoucleTransportSchema,
  JournalAdminSchema,
  DistributionSchema,
} from '@circe/shared'
import { contexteReception, site, autre, get, post } from '../support/reception.ts'
import * as f from '../factories/index.ts'
const ctx = contexteReception()
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
it('EX-ADM-NEW-001 journal, statuts et transport sont réservés à admin, filtres partiels du journal sans erreur', async () => {
  const s = await site(ctx),
    admin = await autre(ctx, s.plateforme.id, ['admin'])
  for (const url of [
    '/api/admin/journal',
    '/api/admin/statuts',
    '/api/admin/machines',
    '/api/admin/transport',
    '/api/admin/transport/boucles',
  ]) {
    expect((await get(ctx, url, s.headers)).statusCode).toBe(403)
    expect((await get(ctx, url, admin.headers)).statusCode).toBe(200)
  }
  const r = await get(ctx, '/api/admin/journal?action=destr&objet=fin', admin.headers)
  expect(r.statusCode).toBe(200)
  expect(JournalAdminSchema.safeParse(r.json()).success).toBe(true)
})
it('EX-ADM-NEW-001 machine réelle enregistrée, doublon et version périmée refusés, sans créer une machine simulée', async () => {
  const s = await site(ctx),
    admin = await autre(ctx, s.plateforme.id, ['admin']),
    body = {
      version: 0,
      nom: `Machine de test ${s.plateforme.id}`,
      type: 'Roulage',
      fichier: true,
      tiroirsMax: 20,
      sortie: 'CSV',
      repertoire: null,
      bagues: null,
    }
  expect((await post(ctx, '/api/admin/machines', s.headers, body)).statusCode).toBe(403)
  const r = await post(ctx, '/api/admin/machines', admin.headers, body)
  expect(r.statusCode).toBe(200)
  const m = MachineConfigurationSchema.parse(r.json())
  expect(
    (
      await post(ctx, '/api/admin/machines', admin.headers, {
        ...body,
        nom: body.nom.toUpperCase(),
      })
    ).statusCode,
  ).toBe(409)
  const edit = { ...body, version: m.version, tiroirsMax: 12 }
  expect((await post(ctx, `/api/admin/machines/${m.id}`, admin.headers, edit)).statusCode).toBe(200)
  expect((await post(ctx, `/api/admin/machines/${m.id}`, admin.headers, edit)).statusCode).toBe(409)
})
it('EX-ADM-NEW-001 boucle transport persistée avec heure valide et destinations réelles', async () => {
  const s = await site(ctx),
    admin = await autre(ctx, s.plateforme.id, ['admin']),
    dest = await f.createDestinataire(ctx.db)
  const body = {
    version: 0,
    plateformeId: s.plateforme.id,
    nom: 'Boucle test',
    canal: 'MILK_RUN',
    jour: 3,
    heure: '09:30',
    destinataires: [dest.id],
  }
  expect(
    (await post(ctx, '/api/admin/transport/boucles', admin.headers, { ...body, heure: '25:61' }))
      .statusCode,
  ).toBe(400)
  expect(
    (
      await post(ctx, '/api/admin/transport/boucles', admin.headers, {
        ...body,
        destinataires: [99999999],
      })
    ).statusCode,
  ).toBe(422)
  const r = await post(ctx, '/api/admin/transport/boucles', admin.headers, body)
  expect(r.statusCode).toBe(200)
  expect(BoucleTransportSchema.parse(r.json()).destinations).toContain(dest.nomOrigine)
})
it('RG-STK-NEW-002 paramètres de fin de campagne versionnés et bornés, réservés à admin', async () => {
  const s = await site(ctx),
    admin = await autre(ctx, s.plateforme.id, ['admin'])
  const config = ConfigurationFinCampagneSchema.parse(
    (await get(ctx, '/api/admin/fin-campagne', admin.headers)).json(),
  )
  expect((await post(ctx, '/api/admin/fin-campagne', s.headers, config)).statusCode).toBe(403)
  expect(
    (
      await post(ctx, '/api/admin/fin-campagne', admin.headers, {
        ...config,
        delais: { ...config.delais, '8m2': 0 },
      })
    ).statusCode,
  ).toBe(400)
  expect((await post(ctx, '/api/admin/fin-campagne', admin.headers, config)).statusCode).toBe(200)
  expect((await post(ctx, '/api/admin/fin-campagne', admin.headers, config)).statusCode).toBe(409)
})

it('EX-ADM-NEW-001 listes de distribution persistées, contrôlées et versionnées sans modifier les permissions des utilisateurs', async () => {
  const s = await site(ctx),
    admin = await autre(ctx, s.plateforme.id, ['admin']),
    body = {
      version: 0,
      nom: `Liste ${s.plateforme.id}`,
      plateformeId: s.plateforme.id,
      roles: ['recep', 'cheq'],
      usage: 'Notifications de test',
    }
  expect((await get(ctx, '/api/admin/distributions', s.headers)).statusCode).toBe(403)
  expect((await post(ctx, '/api/admin/distributions', s.headers, body)).statusCode).toBe(403)
  expect(
    (
      await post(ctx, '/api/admin/distributions', admin.headers, {
        ...body,
        plateformeId: 99999999,
      })
    ).statusCode,
  ).toBe(422)
  const creation = await post(ctx, '/api/admin/distributions', admin.headers, body)
  expect(creation.statusCode).toBe(200)
  const liste = DistributionSchema.parse(creation.json())
  expect(liste.roles).toEqual(['recep', 'cheq'])
  expect((await post(ctx, '/api/admin/distributions', admin.headers, body)).statusCode).toBe(409)
  const modification = { ...body, version: liste.version, usage: 'Usage mis à jour' }
  expect(
    (await post(ctx, `/api/admin/distributions/${liste.id}`, admin.headers, modification))
      .statusCode,
  ).toBe(200)
  expect(
    (await post(ctx, `/api/admin/distributions/${liste.id}`, admin.headers, modification))
      .statusCode,
  ).toBe(409)
  expect((await get(ctx, '/api/admin/machines', s.headers)).statusCode).toBe(403)
})
