import { describe, expect, it } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { ValidationError } from './errors.ts'
import { empreinteRequete, requireIdempotencyKey } from './idempotency.ts'

function requete(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest
}

describe('idempotence (RG-REC-008)', () => {
  it('RG-REC-008 exige l’en-tête Idempotency-Key (400)', () => {
    expect(() => requireIdempotencyKey(requete({}))).toThrow(ValidationError)
    expect(() => requireIdempotencyKey(requete({ 'idempotency-key': '  ' }))).toThrow(
      ValidationError,
    )
    expect(() => requireIdempotencyKey(requete({ 'idempotency-key': 'x'.repeat(201) }))).toThrow(
      ValidationError,
    )
  })

  it('RG-REC-008 lit une clé valide', () => {
    expect(requireIdempotencyKey(requete({ 'idempotency-key': ' abc ' }))).toBe('abc')
  })

  it('l’empreinte ne dépend pas de l’ordre des clés du corps', () => {
    expect(empreinteRequete('post', '/x', { a: 1, b: { c: 2, d: 3 } })).toBe(
      empreinteRequete('POST', '/x', { b: { d: 3, c: 2 }, a: 1 }),
    )
  })

  it('l’empreinte change avec le corps, la méthode ou le chemin', () => {
    const base = empreinteRequete('POST', '/x', { a: 1 })
    expect(empreinteRequete('POST', '/x', { a: 2 })).not.toBe(base)
    expect(empreinteRequete('PUT', '/x', { a: 1 })).not.toBe(base)
    expect(empreinteRequete('POST', '/y', { a: 1 })).not.toBe(base)
  })
})
