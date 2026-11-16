import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

const base = { DATABASE_URL: 'file:./prisma/test.db', DEV_IDENTITY_SECRET: 'a'.repeat(20) }

describe('loadConfig', () => {
  it('applique les valeurs par défaut', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'test' })
    expect(config.API_PORT).toBe(3001)
    expect(config.LOG_LEVEL).toBe('info')
  })

  it('refuse une DATABASE_URL qui n’est pas un fichier SQLite', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'postgresql://x' })).toThrow(
      /Configuration invalide/,
    )
  })

  it('refuse le fournisseur d’identité de dev en production (Q-001)', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/interdit en production/)
  })

  it('exige un secret pour le fournisseur de dev', () => {
    expect(() => loadConfig({ DATABASE_URL: base.DATABASE_URL, NODE_ENV: 'test' })).toThrow(
      /DEV_IDENTITY_SECRET/,
    )
  })
})
