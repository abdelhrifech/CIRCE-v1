// Lecture par paquets d'une clause `IN` : SQLite / Prisma limitent le nombre de paramètres d'une requête (ANO-035,
// ANO-050, ANO-051). Toute clause `IN` dont la liste dépend des données (dossiers, ateliers, faces, trains, affiches…)
// doit passer par cet utilitaire ; seules les listes bornées par construction (statuts, plateformes d'un utilisateur)
// peuvent s'en passer.
export const TAILLE_PAQUET = 400

export async function parPaquets<T, R>(
  valeurs: readonly T[],
  lire: (paquet: T[]) => Promise<R[]>,
  taille = TAILLE_PAQUET,
): Promise<R[]> {
  const res: R[] = []
  for (let i = 0; i < valeurs.length; i += taille)
    res.push(...(await lire(valeurs.slice(i, i + taille))))
  return res
}
