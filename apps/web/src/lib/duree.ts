/** Durée lisible de la maquette : « 35 min », « 7 h », « 2 j 3 h » (ECR-REC-02, ECR-REC-04). */
export function duree(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`
  const h = Math.floor(minutes / 60)
  if (h < 24) return `${String(h)} h`
  const j = Math.floor(h / 24)
  const reste = h % 24
  return reste > 0 ? `${String(j)} j ${String(reste)} h` : `${String(j)} j`
}

export const dateCourte = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
