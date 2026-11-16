import { describe, expect, it, vi } from 'vitest'
import { buildAdminServer } from './admin.ts'

describe('EXP-020/021 isolated administration probes', () => {
  it('liveness never calls the database, even when it is unavailable', async () => {
    const query = vi.fn().mockRejectedValue(new Error('unavailable'))
    const { app } = buildAdminServer({ $queryRaw: query })
    try {
      const r = await app.inject('/healthz/live')
      expect(r.statusCode).toBe(200)
      expect(r.json()).toEqual({ status: 'alive' })
      expect(query).not.toHaveBeenCalled()
      expect((await app.inject('/healthz/ready')).statusCode).toBe(503)
      expect((await app.inject('/healthz/live')).statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })
  it('readiness checks the dependency and becomes unavailable during drain', async () => {
    const query = vi.fn().mockResolvedValue([{ one: 1 }])
    const { app, setDraining } = buildAdminServer({ $queryRaw: query })
    try {
      expect((await app.inject('/healthz/ready')).json()).toEqual({ status: 'ready' })
      expect(query).toHaveBeenCalledOnce()
      setDraining()
      expect((await app.inject('/healthz/ready')).statusCode).toBe(503)
      expect(query).toHaveBeenCalledOnce()
      expect((await app.inject('/healthz/live')).statusCode).toBe(200)
      expect((await app.inject('/v1/me')).statusCode).toBe(404)
      expect((await app.inject('/api/me')).statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })
  it('readiness has a bounded wait for an unresponsive dependency', async () => {
    const { app } = buildAdminServer({ $queryRaw: () => new Promise(() => undefined) }, 10)
    try {
      expect((await app.inject('/healthz/ready')).statusCode).toBe(503)
    } finally {
      await app.close()
    }
  })
})
