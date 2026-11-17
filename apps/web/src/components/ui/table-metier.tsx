import { useHauteurTableau } from '../../lib/hauteur-tableau.ts'
import { filtreTableau, OPERATEURS, type Operateur } from '../../lib/filtres-tableau.ts'
import { useMemo, useState, type HTMLAttributes, type ReactNode } from 'react'
import { exporterExcel, type CelluleExcel } from '../../lib/excel.ts'
export interface ColonneMetier<T> {
  id: string
  titre: string
  valeur: (r: T) => CelluleExcel
  rendu?: (r: T) => ReactNode
  cachee?: boolean
  somme?: boolean
  ajout?: boolean
}
export function TableMetier<T>({
  lignes,
  colonnes,
  cle,
  nom,
  onOuvrir,
  actions,
  vide = 'Aucune ligne avec ces filtres.',
  tableProps,
}: {
  lignes: T[]
  colonnes: ColonneMetier<T>[]
  cle: (r: T) => string | number
  nom: string
  onOuvrir?: (r: T) => void
  actions?: (r: T) => ReactNode
  tableProps?: HTMLAttributes<HTMLTableElement>
  vide?: string
}) {
  const [visibles, setVisibles] = useState(() =>
      colonnes.filter((c) => !c.cachee).map((c) => c.id),
    ),
    [recherche, setRecherche] = useState(''),
    [tri, setTri] = useState<{ id: string; asc: boolean } | null>(null),
    [filtres, setFiltres] = useState<Record<string, string>>({}),
    [operateurs, setOperateurs] = useState<Record<string, Operateur>>({})
  const [hauteur, setHauteur] = useHauteurTableau(nom)
  const cols = visibles.flatMap((id) => colonnes.filter((c) => c.id === id))
  function deplacer(id: string, sens: number) {
    setVisibles((anciens) => {
      const next = [...anciens],
        i = next.indexOf(id),
        j = i + sens
      if (i < 0 || j < 0 || j >= next.length) return anciens
      const gauche = next[i],
        droite = next[j]
      if (gauche === undefined || droite === undefined) return anciens
      next[i] = droite
      next[j] = gauche
      return next
    })
  }
  const rows = useMemo(() => {
    const lire = (r: T, id: string) => colonnes.find((c) => c.id === id)?.valeur(r)
    const rs = lignes.filter(
      (r) =>
        (!recherche || cols.some((c) => filtreTableau(c.valeur(r), recherche))) &&
        colonnes.every((c) =>
          filtreTableau(lire(r, c.id), filtres[c.id] ?? '', operateurs[c.id] ?? 'contient'),
        ),
    )
    if (tri)
      rs.sort((a, b) => {
        const x = lire(a, tri.id),
          y = lire(b, tri.id)
        return (
          (typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x ?? '').localeCompare(String(y ?? ''), 'fr', { numeric: true })) *
          (tri.asc ? 1 : -1)
        )
      })
    return rs
  }, [lignes, colonnes, cols, recherche, filtres, operateurs, tri])
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-4 border-b p-3 text-sm">
        <input
          type="search"
          aria-label={`Rechercher dans ${nom}`}
          placeholder="Rechercher…"
          className="rounded border px-3 py-2"
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value)
          }}
        />
        <details className="relative">
          <summary className="cursor-pointer">Colonnes</summary>
          <div className="absolute z-10 max-h-80 w-72 overflow-auto rounded border bg-white p-3 shadow">
            {colonnes.map((c) => (
              <label key={c.id} className="mb-2 block">
                <input
                  type="checkbox"
                  checked={visibles.includes(c.id)}
                  onChange={(e) => {
                    setVisibles((v) =>
                      e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id),
                    )
                  }}
                />{' '}
                {c.titre}
                {visibles.includes(c.id) && (
                  <span className="ml-2 inline-flex gap-2">
                    <button
                      type="button"
                      aria-label={`Déplacer ${c.titre} à gauche`}
                      disabled={visibles.indexOf(c.id) === 0}
                      onClick={() => {
                        deplacer(c.id, -1)
                      }}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label={`Déplacer ${c.titre} à droite`}
                      disabled={visibles.indexOf(c.id) === visibles.length - 1}
                      onClick={() => {
                        deplacer(c.id, 1)
                      }}
                    >
                      →
                    </button>
                  </span>
                )}
              </label>
            ))}
          </div>
        </details>
        <button
          type="button"
          className="underline"
          onClick={() => {
            exporterExcel(
              nom,
              cols.map((c) => c.titre),
              rows.map((r) => cols.map((c) => c.valeur(r))),
            )
          }}
        >
          Exporter
        </button>
        <span className="ml-auto text-xs text-slate-500">{rows.length} ligne(s)</span>
      </div>
      <div className="overflow-auto" style={{ maxHeight: hauteur }}>
        <table {...tableProps} aria-label={nom} className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {cols.map((c) => (
                <th key={c.id} className="min-w-28 p-3 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setTri((t) => ({ id: c.id, asc: t?.id === c.id ? !t.asc : true }))
                    }}
                  >
                    <span className={c.ajout ? 'font-bold text-red-700' : undefined}>
                      {c.titre}
                    </span>
                    {tri?.id === c.id ? (tri.asc ? ' ↑' : ' ↓') : ''}
                  </button>
                  <select
                    aria-label={`Opérateur ${c.titre}`}
                    className="mt-2 max-w-44 rounded border text-xs"
                    value={operateurs[c.id] ?? 'contient'}
                    onChange={(e) => {
                      setOperateurs((v) => ({ ...v, [c.id]: e.target.value as Operateur }))
                    }}
                  >
                    {Object.entries(OPERATEURS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input
                    disabled={['vide', 'nonvide'].includes(operateurs[c.id] ?? '')}
                    aria-label={`Filtrer ${c.titre}`}
                    className="mt-2 w-full min-w-20 rounded border bg-white px-2 py-1 font-normal"
                    value={filtres[c.id] ?? ''}
                    onChange={(e) => {
                      setFiltres((f) => ({ ...f, [c.id]: e.target.value }))
                    }}
                  />
                </th>
              ))}
              {actions && <th className="p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                data-selection-id={cle(r)}
                key={cle(r)}
                className={`border-t border-slate-100 ${onOuvrir ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={() => onOuvrir?.(r)}
              >
                {cols.map((c) => (
                  <td data-colonne={c.id} key={c.id} className="max-w-md whitespace-pre-wrap p-3">
                    {c.rendu ? c.rendu(r) : String(c.valeur(r) ?? '')}
                  </td>
                ))}
                {actions && (
                  <td
                    className="p-3"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    {actions(r)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {cols.some((c) => c.somme) && (
            <tfoot className="border-t bg-slate-50 font-semibold">
              <tr>
                {cols.map((c, i) => (
                  <td data-colonne={c.id} key={c.id} className="p-3">
                    {c.somme
                      ? rows.reduce((s, r) => s + Number(c.valeur(r) ?? 0), 0)
                      : i === 0
                        ? 'Total'
                        : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {!rows.length && <p className="p-6 text-slate-600">{vide}</p>}
      </div>
      <div
        role="separator"
        aria-label="Hauteur du tableau"
        aria-orientation="horizontal"
        aria-valuenow={hauteur}
        aria-valuemin={160}
        tabIndex={0}
        className="cursor-ns-resize bg-slate-100 p-1 text-center text-xs text-slate-600"
        style={{ touchAction: 'none' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            setHauteur((v) => Math.max(160, v + (e.key === 'ArrowDown' ? 60 : -60)))
          }
        }}
        onDoubleClick={() => {
          setHauteur(600)
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          e.currentTarget.dataset.y = String(e.clientY)
          e.currentTarget.dataset.h = String(hauteur)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            setHauteur(
              Math.max(
                160,
                Number(e.currentTarget.dataset.h) + e.clientY - Number(e.currentTarget.dataset.y),
              ),
            )
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        ⇕ Glisser pour agrandir ou réduire le tableau
      </div>
    </div>
  )
}
