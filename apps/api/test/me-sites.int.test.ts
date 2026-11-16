// ECR-NAV-01 / EX-TRA-006 : GET /api/me/sites alimente le sélecteur de site du bandeau (sites du périmètre).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { MesSitesSchema } from '@circe/shared'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/core/config.ts'
import { createDb } from '../src/core/db.ts'
import { seedRef } from '../src/reference/seed-ref.ts'
import * as f from './factories/index.ts'
import { devHeaders } from './support/identite.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance

beforeAll(async () => {
  await seedRef(db)
  app = buildApp({ config, db, closeDb: () => db.$disconnect() })
  await app.ready()
})
afterAll(async () => {
  await app.close()
})

describe('GET /api/me/sites (EX-TRA-006, RG-COO-167)', () => {
  it('EX-TRA-006 ne renvoie que les sites du périmètre de l’utilisateur', async () => {
    const dans = await f.createPlateforme(db)
    const hors = await f.createPlateforme(db)
    const user = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: dans.id }])
    const r = await app.inject({
      method: 'GET',
      url: '/api/me/sites',
      headers: devHeaders(user.identifiantExterne),
    })
    expect(r.statusCode).toBe(200)
    const ids = MesSitesSchema.parse(r.json()).sites.map((s) => s.id)
    expect(ids).toEqual([dans.id])
    expect(ids).not.toContain(hors.id)
  })

  it('RG-COO-167 renvoie tous les sites à l’administrateur', async () => {
    const a = await f.createPlateforme(db)
    const b = await f.createPlateforme(db)
    const admin = await f.createUtilisateurAvecRoles(db, ['admin'], [])
    const r = await app.inject({
      method: 'GET',
      url: '/api/me/sites',
      headers: devHeaders(admin.identifiantExterne),
    })
    const ids = MesSitesSchema.parse(r.json()).sites.map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]))
  })

  it('RG-REC-004 refuse une requête sans identité (401)', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/me/sites' })
    expect(r.statusCode).toBe(401)
  })
})
