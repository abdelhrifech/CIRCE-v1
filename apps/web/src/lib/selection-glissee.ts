import { useEffect, useRef, type MouseEvent } from 'react'

// EX-NEW-REC-002 : une plage réversible, calculée depuis la sélection avant le geste.
export function selectionPlage<T extends string | number>(
  ids: T[],
  initiale: T[],
  debut: T,
  fin: T,
  cocher: boolean,
) {
  const a = ids.indexOf(debut),
    b = ids.indexOf(fin)
  if (a < 0 || b < 0) return initiale
  const plage = ids.slice(Math.min(a, b), Math.max(a, b) + 1)
  return cocher
    ? [...new Set([...initiale, ...plage])]
    : initiale.filter((id) => !plage.includes(id))
}
export function useSelectionGlissee<T extends string | number>(
  ids: T[],
  selection: T[],
  changer: (ids: T[]) => void,
) {
  const geste = useRef<{
    debut: T
    initiale: T[]
    cocher: boolean
    glisse: boolean
  } | null>(null)
  const supprimerClic = useRef(false)
  useEffect(() => {
    const finir = () => {
      if (geste.current?.glisse) supprimerClic.current = true
      geste.current = null
    }
    window.addEventListener('mouseup', finir)
    window.addEventListener('blur', finir)
    return () => {
      window.removeEventListener('mouseup', finir)
      window.removeEventListener('blur', finir)
    }
  }, [])
  const ligne = (e: MouseEvent<HTMLTableElement>) => {
    const cible = e.target instanceof Element ? e.target : null
    const attribut = cible?.closest('tr[data-selection-id]')?.getAttribute('data-selection-id')
    const id = ids.find((id) => String(id) === attribut)
    return id !== undefined && ids.includes(id) ? { id, cible } : null
  }
  return {
    onMouseDown(e: MouseEvent<HTMLTableElement>) {
      supprimerClic.current = false
      if (e.button !== 0) return
      const l = ligne(e)
      if (
        !l ||
        l.cible?.closest(
          'button, a, select, textarea, input:not([type="checkbox"]), input:disabled',
        )
      )
        return
      geste.current = {
        debut: l.id,
        initiale: [...selection],
        cocher: !selection.includes(l.id),
        glisse: false,
      }
    },
    onMouseOver(e: MouseEvent<HTMLTableElement>) {
      const g = geste.current,
        l = ligne(e)
      if (!g || !l || (l.id === g.debut && !g.glisse)) return
      if (!(e.buttons & 1)) {
        geste.current = null
        return
      }
      g.glisse = true
      window.getSelection()?.removeAllRanges()
      changer(selectionPlage(ids, g.initiale, g.debut, l.id, g.cocher))
    },
    onClickCapture(e: MouseEvent<HTMLTableElement>) {
      if (supprimerClic.current || geste.current?.glisse) {
        supprimerClic.current = false
        geste.current = null
        e.preventDefault()
        e.stopPropagation()
      }
    },
  }
}
