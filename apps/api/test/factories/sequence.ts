// Séquence des factories : aucune donnée personnelle réelle. Le point de départ est tiré au hasard
// par fichier de test pour éviter les collisions entre fichiers qui partagent la base de test
// (les JDD reproductibles à graine fixe sont l'objet de l'étape 9, skill circe-jdd).
import { randomInt } from 'node:crypto'

let counter = randomInt(1, 1_000_000) * 1000

export function next(): number {
  counter += 1
  return counter
}

/**
 * JDD reproductibles (étape 9) : fixe le compteur pour qu'une même seed produise les mêmes codes ; renvoie la valeur
 * précédente, à restituer (`fixerSequence(ancienne)`) en fin de génération pour ne pas gêner les autres tests.
 */
export function fixerSequence(valeur: number): number {
  const ancienne = counter
  counter = valeur
  return ancienne
}
