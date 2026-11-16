import { describe, expect, it } from 'vitest'
import { checkHealth } from './service.ts'

describe('checkHealth', () => {
  it('renvoie ok quand la base répond', async () => {
    const health = await checkHealth({ $queryRaw: () => Promise.resolve([{ 1: 1 }]) })
    expect(health).toMatchObject({ status: 'ok', database: 'up' })
  })

  it('renvoie error quand la base est injoignable', async () => {
    const health = await checkHealth({ $queryRaw: () => Promise.reject(new Error('boom')) })
    expect(health).toMatchObject({ status: 'error', database: 'down' })
  })
})
