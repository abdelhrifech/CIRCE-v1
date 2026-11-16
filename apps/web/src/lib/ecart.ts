/**
 * RG-REC-058 : écart de comptage « Important » quand |comptée − BL| dépasse le seuil `ecartReception`
 * (% de la quantité du BL) ; sinon simple information. Affichage seul : le contrôle n'est pas bloqué.
 */
export function ecartImportant(
  quantiteBl: number,
  comptee: number,
  seuilPourcent: number,
): boolean {
  return quantiteBl > 0 && Math.abs(comptee - quantiteBl) > (quantiteBl * seuilPourcent) / 100
}
