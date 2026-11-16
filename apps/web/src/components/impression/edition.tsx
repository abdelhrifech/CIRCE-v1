import type { ReactNode } from 'react'

// D-18 — modèles d'éditions imprimées côté NAVIGATEUR (jamais de PDF serveur, CLAUDE.md §3, Q-002, Q-367). Une
// édition est la zone `.zone-impression` : à l'impression, seule cette zone est visible (voir styles.css). Les
// libellés et colonnes viennent de la maquette de chaque écran ; la mise en page RDLC d'origine n'est pas lue
// (Q-277, Q-287). Sans cette zone, `window.print()` imprimerait une page blanche.

const dateEdition = (d: Date) =>
  d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** Une édition A4 : titre, contexte (filtres, périmètre), date d'édition, contenu. `maintenant` : tests. */
export function Edition({
  titre,
  contexte,
  children,
  maintenant,
}: {
  titre: string
  /** Libellés « filtre : valeur » imprimés sous le titre. */
  contexte?: readonly string[]
  children: ReactNode
  maintenant?: Date
}) {
  return (
    <div className="zone-impression edition" data-testid="edition">
      <header className="mb-2 border-b border-slate-400 pb-1">
        <h2 className="text-lg font-bold">{titre}</h2>
        {contexte && contexte.length > 0 && (
          <p className="text-xs text-slate-700">{contexte.join(' · ')}</p>
        )}
        <p className="text-xs text-slate-500">Édité le {dateEdition(maintenant ?? new Date())}</p>
      </header>
      {children}
    </div>
  )
}

/** Libellés lisibles des filtres de l'URL pour l'en-tête d'une édition (valeurs vides ignorées). */
export function contexteDesFiltres(
  params: URLSearchParams,
  libelles: Readonly<Record<string, string>>,
): string[] {
  const res: string[] = []
  for (const [cle, valeur] of params)
    if (valeur !== '' && libelles[cle] !== undefined) res.push(`${libelles[cle]} : ${valeur}`)
  return res
}
