import { describe, expect, it } from 'vitest'
import { ConflictError, NotFoundError } from './errors.ts'
import { updateWithVersion } from './versioning.ts'

describe('updateWithVersion (RG-REC-009, CLAUDE.md §6)', () => {
  it('RG-REC-009 renvoie la nouvelle version quand la ligne est mise à jour', async () => {
    const version = await updateWithVersion({
      expectedVersion: 3,
      update: () => Promise.resolve({ count: 1 }),
    })
    expect(version).toBe(4)
  })

  it('transmet la version attendue au where de la mise à jour', async () => {
    let recu: unknown
    await updateWithVersion({
      expectedVersion: 7,
      update: (where) => {
        recu = where
        return Promise.resolve({ count: 1 })
      },
    })
    expect(recu).toEqual({ version: 7 })
  })

  it('RG-REC-009 lève 409 CONFLIT_VERSION quand aucune ligne n’est touchée', async () => {
    const run = updateWithVersion({
      expectedVersion: 1,
      update: () => Promise.resolve({ count: 0 }),
      exists: () => Promise.resolve(true),
    })
    await expect(run).rejects.toBeInstanceOf(ConflictError)
    await expect(run).rejects.toMatchObject({
      httpStatus: 409,
      code: 'CONFLIT_VERSION',
      regle: 'RG-REC-009',
    })
  })

  it('accepte le code et la règle du module', async () => {
    const run = updateWithVersion({
      expectedVersion: 1,
      update: () => Promise.resolve({ count: 0 }),
      code: 'REC_CONFLIT_VERSION',
    })
    await expect(run).rejects.toMatchObject({ code: 'REC_CONFLIT_VERSION' })
  })

  it('lève 404 quand l’élément n’existe pas', async () => {
    const run = updateWithVersion({
      expectedVersion: 1,
      update: () => Promise.resolve({ count: 0 }),
      exists: () => Promise.resolve(false),
    })
    await expect(run).rejects.toBeInstanceOf(NotFoundError)
  })
})
