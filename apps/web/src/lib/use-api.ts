import { useCallback, useEffect, useState } from 'react'

export type EtatRequete<T> =
  { kind: 'loading' } | { kind: 'error'; error: unknown } | { kind: 'ready'; data: T }

type Resultat<T> = { cle: string } & (
  { kind: 'error'; error: unknown } | { kind: 'ready'; data: T }
)

/**
 * Appel API côté navigateur avec états chargement / erreur / prêt (CLAUDE.md §6). Relancé quand `cle`
 * change ; `recharger` force un nouvel appel. Tant que la réponse de la clé courante n'est pas arrivée,
 * l'état est « chargement » (jamais l'ancien résultat présenté comme à jour).
 */
export function useApi<T>(cle: string, charger: (signal: AbortSignal) => Promise<T>) {
  const [resultat, setResultat] = useState<Resultat<T> | null>(null)
  const [essai, setEssai] = useState(0)
  const cleEssai = `${cle}#${String(essai)}`

  useEffect(() => {
    const controle = new AbortController()
    charger(controle.signal).then(
      (data) => {
        if (!controle.signal.aborted) setResultat({ cle: cleEssai, kind: 'ready', data })
      },
      (error: unknown) => {
        if (!controle.signal.aborted) setResultat({ cle: cleEssai, kind: 'error', error })
      },
    )
    return () => {
      controle.abort()
    }
    // `charger` est recréé à chaque rendu : la clé (et l'essai) décrivent la requête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleEssai])

  const recharger = useCallback(() => {
    setEssai((n) => n + 1)
  }, [])

  const etat: EtatRequete<T> =
    resultat === null || resultat.cle !== cleEssai
      ? { kind: 'loading' }
      : resultat.kind === 'ready'
        ? { kind: 'ready', data: resultat.data }
        : { kind: 'error', error: resultat.error }
  return { etat, recharger }
}
