// RG-REC-079 : code-barres de la feuille de stock (« A- » + 13 chiffres) rendu en Code 39, sans
// dépendance (PDF / impression générés par le navigateur, CLAUDE.md §3).
// Chaque caractère = 9 éléments (5 barres, 4 espaces), dont 3 larges ; « n » étroit, « w » large.
const MOTIFS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  '-': 'nwnnnnwnw',
  '*': 'nwnnwnwnn',
}

export interface Barre {
  x: number
  largeur: number
}

/** Barres (positions en modules) d'un texte en Code 39, encadré par « * ». Caractères hors table refusés. */
export function barresCode39(texte: string, large = 3): { barres: Barre[]; longueur: number } {
  const barres: Barre[] = []
  let x = 0
  for (const c of `*${texte.toUpperCase()}*`) {
    const motif = MOTIFS[c]
    if (!motif) throw new Error(`Caractère non encodable en Code 39 : ${c}`)
    Array.from(motif).forEach((m, i) => {
      const l = m === 'w' ? large : 1
      if (i % 2 === 0) barres.push({ x, largeur: l })
      x += l
    })
    x += 1 // espace inter-caractères
  }
  return { barres, longueur: x - 1 }
}
