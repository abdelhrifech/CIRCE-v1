import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ErrorResponseSchema, HealthResponseSchema } from '@circe/shared'
import { DEV_IDENTITY_HEADER } from '@circe/shared/dev-identity'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/core/config.ts'
import { createDb } from '../src/core/db.ts'
import { createUtilisateur } from './factories/index.ts'
import { devHeaders } from './support/identite.ts'

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
let app: FastifyInstance

beforeAll(async () => {
  app = buildApp({ config, db, closeDb: () => db.$disconnect() })
  await app.ready()
})
afterAll(async () => {
  await app.close()
})

describe('GET /api/health (base de test SQLite)', () => {
  it('répond 200 avec la base joignable', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(200)
    expect(HealthResponseSchema.parse(response.json())).toMatchObject({
      status: 'ok',
      database: 'up',
    })
  })

  it('accepte une identité de dev signée d’un utilisateur connu', async () => {
    const user = await createUtilisateur(db)
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: devHeaders(user.identifiantExterne),
    })
    expect(response.statusCode).toBe(200)
  })

  it('rejette une identité falsifiée en 401 au format d’erreur normalisé', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { [DEV_IDENTITY_HEADER]: 'abc.def' },
    })
    expect(response.statusCode).toBe(401)
    expect(ErrorResponseSchema.parse(response.json()).code).toBe('NON_AUTHENTIFIE')
  })

  it('répond 404 normalisé sur une route inconnue', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/inconnue' })
    expect(response.statusCode).toBe(404)
    expect(ErrorResponseSchema.parse(response.json()).code).toBe('INTROUVABLE')
  })

  it('répond 503 quand la base est injoignable', async () => {
    const down = buildApp({
      config,
      db,
      healthDb: { $queryRaw: () => Promise.reject(new Error('base coupée')) },
    })
    const response = await down.inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(503)
    expect(response.json<{ database: string }>().database).toBe('down')
    await down.close()
  })
})
