import { ConflictError } from './errors.ts'

/** Table de transitions explicite : pour chaque statut, les statuts atteignables (CLAUDE.md §6). */
export type Transitions<S extends string> = Readonly<Record<S, readonly S[]>>

export function canTransition<S extends string>(table: Transitions<S>, from: S, to: S): boolean {
  return table[from].includes(to)
}

/** Toute transition non listée = 409 TRANSITION_INTERDITE (avec la RG de la machine d'états). */
export function assertTransition<S extends string>(
  table: Transitions<S>,
  from: S,
  to: S,
  options: { regle: string; code?: string },
): void {
  if (canTransition(table, from, to)) return
  throw new ConflictError(`Transition interdite : ${from} → ${to}`, {
    code: options.code ?? 'TRANSITION_INTERDITE',
    regle: options.regle,
    details: { de: from, vers: to },
  })
}
