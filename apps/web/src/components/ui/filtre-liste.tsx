import * as Popover from '@radix-ui/react-popover'

export interface OptionFiltre {
  valeur: string
  libelle: string
  nombre?: number
}

interface FiltreListeProps {
  libelle: string
  options: OptionFiltre[]
  selection: string[]
  onChange: (selection: string[]) => void
}

/** Filtre en liste à cocher (RG-REC-016) : aucune coche = tout ; compteurs par valeur. */
export function FiltreListe({ libelle, options, selection, onChange }: FiltreListeProps) {
  const resume = selection.length === 0 ? 'Tous' : `${selection.length}`
  function basculer(valeur: string) {
    onChange(
      selection.includes(valeur) ? selection.filter((v) => v !== valeur) : [...selection, valeur],
    )
  }
  return (
    <Popover.Root>
      <Popover.Trigger
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm hover:bg-slate-50"
        aria-label={`Filtre ${libelle}`}
      >
        {libelle} : <strong>{resume}</strong>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-72 min-w-48 overflow-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg"
        >
          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase text-slate-500">
              {libelle}
            </legend>
            {options.length === 0 && <p className="text-sm text-slate-500">Aucune valeur.</p>}
            {options.map((o) => (
              <label
                key={o.valeur}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selection.includes(o.valeur)}
                  onChange={() => {
                    basculer(o.valeur)
                  }}
                />
                <span className="flex-1">{o.libelle || '—'}</span>
                {o.nombre !== undefined && (
                  <span className="text-xs text-slate-500">{o.nombre}</span>
                )}
              </label>
            ))}
          </fieldset>
          {selection.length > 0 && (
            <button
              type="button"
              className="mt-2 text-xs underline"
              onClick={() => {
                onChange([])
              }}
            >
              Tout afficher
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
