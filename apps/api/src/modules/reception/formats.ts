// RG-REC-043 — Famille de formats 2 m² (règle legacy conservée, HYPOTHÈSE Q-147).
// Sources : legacy BLL/LivraisonAfficheService.cs:458-476, BLL/ReceptionListeAfficheBll.cs:420-435.

const FAMILLE_2M2 = ['2m2', '2 m2', '2m2 scrolling', '2m2 venusial']
const SCROLLING_MUI_PARIS = 'scrolling mui paris'

function normaliser(nom: string): string {
  return nom.trim().toLowerCase().replace(/\s+/g, ' ')
}

// RG-REC-043 (1) : appartenance à la famille « 2m2 ».
export function estFamille2m2(nomSupport: string): boolean {
  return FAMILLE_2M2.includes(normaliser(nomSupport))
}

// RG-REC-043 (2) : supports proposés à la recherche de lignes à rattacher pour une affiche de support donné.
export function supportsDeRecherche<T extends { nom: string }>(
  supportAffiche: string,
  supports: readonly T[],
): T[] {
  if (!normaliser(supportAffiche).startsWith('2m2')) {
    return supports.filter((s) => normaliser(s.nom) === normaliser(supportAffiche))
  }
  return supports.filter(
    (s) => normaliser(s.nom).startsWith('2m2') || normaliser(s.nom) === SCROLLING_MUI_PARIS,
  )
}

// RG-REC-043 (3) : « 2m2 Scrolling » et « 2m2 Venusial » s'affichent « 2m2 ».
export function libelleSupport(nomSupport: string): string {
  const n = normaliser(nomSupport)
  return n === '2m2 scrolling' || n === '2m2 venusial' ? '2m2' : nomSupport
}
