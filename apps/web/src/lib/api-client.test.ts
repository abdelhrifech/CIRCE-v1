import { afterEach, describe, expect, it, vi } from 'vitest'
import { HealthResponseSchema, MeResponseSchema } from '@circe/shared'
import { z } from 'zod'
import {
  ApiError,
  apiGet,
  apiPost,
  apiRequest,
  kindOf,
  setUnauthorizedHandler,
} from './api-client.ts'
import { describeError } from './error-text.ts'

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve(Response.json(body, { status }))
  })
  return calls
}
afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(null)
})

const Echo = z.object({ ok: z.boolean() })

describe('apiRequest : erreurs normalisées (CLAUDE.md §6)', () => {
  it.each([
    [400, 'validation'],
    [401, 'non_authentifie'],
    [403, 'interdit'],
    [404, 'introuvable'],
    [409, 'conflit'],
    [422, 'regle_metier'],
    [500, 'serveur'],
  ] as const)('statut %i → %s', (status, kind) => {
    expect(kindOf(status)).toBe(kind)
  })

  it('422 : expose la règle violée', async () => {
    stubFetch(422, { code: 'REGLE_METIER', message: 'BL absent', regle: 'RG-REC-012' })
    const error = await apiRequest('POST', '/api/x', { schema: Echo }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).kind).toBe('regle_metier')
    expect((error as ApiError).body.regle).toBe('RG-REC-012')
  })

  it('409 : conflit de version avec conseil de rechargement', async () => {
    stubFetch(409, { code: 'REC_CONFLIT_VERSION', message: 'modifié', regle: 'RG-REC-009' })
    const error = (await apiRequest('PATCH', '/api/x', { schema: Echo }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.kind).toBe('conflit')
    expect(describeError(error).conseil).toMatch(/rechargez/)
  })

  it('403 : interdit', async () => {
    stubFetch(403, { code: 'PERMISSION', message: 'non', regle: 'RG-REC-002' })
    const error = (await apiRequest('POST', '/api/x', { schema: Echo }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.kind).toBe('interdit')
  })

  it('401 : appelle le gestionnaire global', async () => {
    stubFetch(401, { code: 'NON_AUTHENTIFIE', message: 'Authentification requise' })
    const seen: ApiError[] = []
    setUnauthorizedHandler((e) => seen.push(e))
    await apiRequest('GET', '/api/me', { schema: MeResponseSchema }).catch(() => undefined)
    expect(seen).toHaveLength(1)
  })

  it('réseau coupé : ApiError de type reseau', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('fetch failed')))
    const error = (await apiRequest('GET', '/api/x', { schema: Echo }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.kind).toBe('reseau')
  })

  it('réponse hors contrat : REPONSE_INVALIDE', async () => {
    stubFetch(200, { autre: 1 })
    const error = (await apiRequest('GET', '/api/x', { schema: Echo }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.body.code).toBe('REPONSE_INVALIDE')
  })
})

describe('apiPost : idempotence (RG-REC-008) et site (RG-REC-001)', () => {
  it('RG-REC-008 génère un Idempotency-Key par défaut', async () => {
    const calls = stubFetch(201, { ok: true })
    await apiPost('/api/x', { schema: Echo, body: { a: 1 } })
    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(headers['content-type']).toBe('application/json')
  })

  it('RG-REC-008 réutilise la clé fournie pour un nouvel essai', async () => {
    const calls = stubFetch(201, { ok: true })
    await apiPost('/api/x', { schema: Echo, idempotencyKey: 'cle-fixe' })
    expect((calls[0]?.init?.headers as Record<string, string>)['idempotency-key']).toBe('cle-fixe')
  })

  it('RG-REC-001 transmet le site choisi', async () => {
    const calls = stubFetch(200, { ok: true })
    await apiRequest('GET', '/api/x', { schema: Echo, siteId: 3 })
    expect((calls[0]?.init?.headers as Record<string, string>)['x-site-id']).toBe('3')
  })
})

describe('apiGet', () => {
  it('renvoie la réponse validée, même en 503 si elle respecte le contrat', async () => {
    stubFetch(503, { status: 'error', database: 'down', time: 't' })
    await expect(apiGet('/api/health', HealthResponseSchema)).resolves.toMatchObject({
      database: 'down',
    })
  })

  it('produit une ApiError quand le corps n’est pas du JSON', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('oops', { status: 502 })))
    const error = (await apiGet('/api/x', HealthResponseSchema).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.body.code).toBe('ERREUR_RESEAU')
  })
})
