import { describe, expect, it } from 'vitest'
import { can } from './session.ts'

describe('can (confort d’affichage, le serveur reste juge)', () => {
  it('vrai si la permission est dans la liste renvoyée par /api/me', () => {
    expect(can({ permissions: ['reception.valider'] }, 'reception.valider')).toBe(true)
  })

  it('faux si la permission manque ou si l’utilisateur est inconnu', () => {
    expect(can({ permissions: ['affiche.consulter'] }, 'reception.valider')).toBe(false)
    expect(can(null, 'reception.valider')).toBe(false)
    expect(can(undefined, 'reception.valider')).toBe(false)
  })
})

describe('verifierPermission (garde de route)', async () => {
  const { verifierPermission } = await import('./session.ts')
  const { ApiError } = await import('./api-client.ts')
  const me = (permissions: string[]) => () =>
    Promise.resolve({
      userId: 1,
      identifiantExterne: 'u',
      nom: null,
      roles: ['recep' as const],
      permissions: permissions as never[],
      perimetre: { toutesPlateformes: false, plateformeIds: [] },
      siteId: null,
    })

  it('autorise quand la permission est présente', async () => {
    await expect(
      verifierPermission('reception.valider', me(['reception.valider'])),
    ).resolves.toBeNull()
  })

  it('refuse avec le motif « interdit » quand elle manque', async () => {
    await expect(
      verifierPermission('validation_admin.valider', me(['reception.valider'])),
    ).resolves.toBe('interdit')
  })

  it('refuse avec « non_authentifie » sur un 401 et « erreur » sinon', async () => {
    const e401 = () => Promise.reject(new ApiError(401, { code: 'NON_AUTHENTIFIE', message: 'x' }))
    const e500 = () => Promise.reject(new ApiError(500, { code: 'ERREUR_INTERNE', message: 'x' }))
    await expect(verifierPermission('reception.valider', e401)).resolves.toBe('non_authentifie')
    await expect(verifierPermission('reception.valider', e500)).resolves.toBe('erreur')
  })
})
