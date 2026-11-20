import type { z } from 'zod'
import type { AnalyseProductionSchema } from '@circe/shared'

type Train = z.infer<typeof AnalyseProductionSchema>['trains'][number]

// EX-PIL-NEW-001 — reprises.js : synthèse par rouleur, machine et départ.
// Q-250 : chaque train calculé représente une unité ; aucune quantité d'activité déduite.
export function regrouperTrainsProduits(trains: readonly Train[]) {
  const groupes = new Map<string, Train & { lignes: number; trains: number }>()
  for (const train of trains) {
    // Conserver le site et l'atelier dans la clé évite de mêler leurs totaux en vue globale.
    const id = JSON.stringify([
      train.site,
      train.atelier,
      train.rouleur,
      train.machine,
      train.depart,
    ])
    const groupe = groupes.get(id)
    if (groupe) {
      groupe.lignes += 1
      groupe.trains += 1
    } else groupes.set(id, { ...train, id, lignes: 1, trains: 1 })
  }
  return [...groupes.values()]
}
