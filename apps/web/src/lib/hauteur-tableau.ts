import { useSyncExternalStore } from 'react'
const hauteurs = new Map<string, number>()
const auditeurs = new Set<() => void>()
const abonnement = (callback: () => void) => {
  auditeurs.add(callback)
  return () => {
    auditeurs.delete(callback)
  }
}
function lire(nom: string) {
  if (typeof window !== 'undefined')
    try {
      const n = Number(window.sessionStorage.getItem(`circe-table-hauteur:${nom}`))
      if (Number.isFinite(n) && n >= 160) return n
    } catch {
      /* Le tableau reste utilisable si le stockage est désactivé. */
    }
  return hauteurs.get(nom) ?? 600
}
// EX-NEW16-TRA-001 : hauteur par tableau, conservée pendant la session ; SSR stable.
export function useHauteurTableau(
  nom: string,
): [number, (v: number | ((ancien: number) => number)) => void] {
  const hauteur = useSyncExternalStore(
    abonnement,
    () => lire(nom),
    () => 600,
  )
  return [
    hauteur,
    (v) => {
      const n = Math.max(160, Math.round(typeof v === 'function' ? v(lire(nom)) : v))
      hauteurs.set(nom, n)
      try {
        window.sessionStorage.setItem(`circe-table-hauteur:${nom}`, String(n))
      } catch {
        /* Stockage facultatif. */
      }
      for (const notifier of auditeurs) notifier()
    },
  ]
}
