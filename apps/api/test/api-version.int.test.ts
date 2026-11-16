import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/core/config.ts'
import { seedRef } from '../src/reference/seed-ref.ts'
import SwaggerParser from '@apidevtools/swagger-parser'
import { contexteReception, site, PNG, idem } from './support/reception.ts'

const ctx = contexteReception()
const routes: { method: string; url: string }[] = []
beforeAll(async () => {
  await seedRef(ctx.db)
  ctx.app = buildApp({ config: loadConfig(), db: ctx.db, closeDb: () => ctx.db.$disconnect() })
  ctx.app.addHook('onRoute', (route) => {
    for (const method of Array.isArray(route.method) ? route.method : [route.method]) {
      if (method !== 'HEAD') routes.push({ method, url: route.url })
    }
  })
  await ctx.app.ready()
})
afterAll(() => ctx.arreter())

describe('PLT-050/051/052 API v1 without legacy behaviour changes', () => {
  it('preserves authentication, response bodies and binary downloads on both prefixes', async () => {
    const s = await site(ctx)
    for (const route of ['/me', '/me/sites', '/reception/referentiels']) {
      const old = await ctx.app.inject({ url: `/api${route}`, headers: s.headers })
      const versioned = await ctx.app.inject({ url: `/v1${route}`, headers: s.headers })
      expect(versioned.statusCode).toBe(old.statusCode)
      expect(versioned.json()).toEqual(old.json())
      const anonymous = await ctx.app.inject(`/v1${route}`)
      expect(anonymous.statusCode).toBe(401)
    }
    const headers = { ...s.headers, ...idem() }
    const payload = { intitule: 'binary.png', mimeType: 'image/png', contenuBase64: PNG }
    const created = await ctx.app.inject({ method: 'POST', url: '/v1/photos', headers, payload })
    expect(created.statusCode).toBe(201)
    const replay = await ctx.app.inject({ method: 'POST', url: '/v1/photos', headers, payload })
    expect(replay.statusCode).toBe(201)
    expect(replay.json()).toEqual(created.json())
    const photo = created.json<{ id: number }>()
    const old = await ctx.app.inject({ url: `/api/photos/${photo.id}`, headers: s.headers })
    const versioned = await ctx.app.inject({ url: `/v1/photos/${photo.id}`, headers: s.headers })
    expect(versioned.statusCode).toBe(200)
    expect(versioned.rawPayload).toEqual(old.rawPayload)
    expect(versioned.headers['content-type']).toBe(old.headers['content-type'])
    for (const prefix of ['/api', '/v1']) {
      const invalid = await ctx.app.inject({
        method: 'POST',
        url: `${prefix}/photos`,
        headers: { ...s.headers, ...idem() },
        payload: {},
      })
      expect(invalid.statusCode).toBe(400)
      expect(invalid.json<{ code: string }>().code).toBe('VALIDATION')
      expect((await ctx.app.inject(`${prefix}/healthz/live`)).statusCode).toBe(404)
    }
  })
  it('generates a valid, current OpenAPI contract covering versioned paths', async () => {
    const generated = ctx.app.swagger()
    const path = resolve(import.meta.dirname, '../../../docs/api/circe-v1.openapi.json')
    const stored: unknown = JSON.parse(readFileSync(path, 'utf8'))
    expect(generated).toEqual(stored)
    await expect(SwaggerParser.validate(path)).resolves.toBeDefined()
    await expect(
      SwaggerParser.validate(
        resolve(import.meta.dirname, '../../../docs/api/circe-admin.openapi.json'),
      ),
    ).resolves.toBeDefined()
    const schema = generated as { paths: Record<string, unknown> }
    expect(Object.keys(schema.paths).length).toBeGreaterThan(100)
    expect(Object.keys(schema.paths).every((p) => p.startsWith('/v1/'))).toBe(true)
    expect(schema.paths['/v1/non-conformites']).toBeDefined()
    expect(schema.paths['/v1/bus/receptions']).toBeDefined()
    expect(schema.paths['/v1/receptions']).toBeDefined()
    const legacy = routes.filter((r) => r.url.startsWith('/api/'))
    const versioned = routes.filter((r) => r.url.startsWith('/v1/'))
    expect(versioned.map((r) => `${r.method} ${r.url.slice(3)}`).sort()).toEqual(
      legacy.map((r) => `${r.method} ${r.url.slice(4)}`).sort(),
    )
    for (const route of versioned) {
      const path = route.url.replace(/:(\w+)/g, '{$1}')
      const operation = schema.paths[path] as Record<string, unknown>
      expect(operation[route.method.toLowerCase()], `${route.method} ${path}`).toBeDefined()
    }
  })
})
