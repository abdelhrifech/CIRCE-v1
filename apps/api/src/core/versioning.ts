import { ConflictError, NotFoundError } from './errors.ts'

/** À fusionner dans `data` de l'updateMany : incrémente la version (verrou optimiste). */
export const bumpVersion = { version: { increment: 1 } } as const

interface UpdateWithVersionOptions {
  expectedVersion: number
  /** Doit faire un `updateMany({ where: { id, ...where }, data: { ...data, ...bumpVersion } })`. */
  update: (where: { version: number }) => Promise<{ count: number }>
  /** Permet de distinguer « introuvable » (404) de « version périmée » (409). */
  exists?: () => Promise<boolean>
  /** Code et RG du module (ex. REC_CONFLIT_VERSION, RG-REC-009). */
  code?: string
  regle?: string
}

/**
 * CLAUDE.md §6 / RG-REC-009 : mise à jour sous verrou optimiste. 0 ligne touchée → 409
 * (ou 404 si l'élément n'existe pas). Renvoie la nouvelle version.
 */
export async function updateWithVersion(options: UpdateWithVersionOptions): Promise<number> {
  const { count } = await options.update({ version: options.expectedVersion })
  if (count > 0) return options.expectedVersion + 1
  if (options.exists && !(await options.exists())) throw new NotFoundError()
  throw new ConflictError(
    'Cet élément a été modifié par un autre utilisateur : rechargez la page.',
    {
      code: options.code ?? 'CONFLIT_VERSION',
      regle: options.regle ?? 'RG-REC-009',
      details: { versionAttendue: options.expectedVersion },
    },
  )
}
