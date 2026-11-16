// Générateur pseudo-aléatoire déterministe (mulberry32) : même seed = même suite. Le skill circe-jdd prévoit
// @faker-js/faker, qui n'est pas installé et ne peut pas être ajouté sans question validée (CLAUDE.md §3) : voir Q-415.
// Aucune donnée réelle : toutes les valeurs sont tirées de listes fictives ci-dessous.

export interface Rng {
  /** Réel dans [0, 1). */
  suivant(): number
  /** Entier dans [min, max] (bornes incluses). */
  entier(min: number, max: number): number
  booleen(probabiliteVrai?: number): boolean
  choisir<T>(liste: readonly T[]): T
  /** Choix pondéré : `poids[i]` est le poids de `liste[i]`. */
  choisirPondere<T>(liste: readonly T[], poids: readonly number[]): T
  melanger<T>(liste: readonly T[]): T[]
  echantillon<T>(liste: readonly T[], n: number): T[]
}

export function creerRng(seed: number): Rng {
  let etat = seed >>> 0 || 1
  const suivant = () => {
    etat = (etat + 0x6d2b79f5) >>> 0
    let t = etat
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const entier = (min: number, max: number) => min + Math.floor(suivant() * (max - min + 1))
  const choisir = <T>(liste: readonly T[]): T => {
    const v = liste[entier(0, liste.length - 1)]
    if (v === undefined) throw new Error('liste vide')
    return v
  }
  const melanger = <T>(liste: readonly T[]): T[] => {
    const r = [...liste]
    for (let i = r.length - 1; i > 0; i--) {
      const j = entier(0, i)
      const a = r[i] as T
      r[i] = r[j] as T
      r[j] = a
    }
    return r
  }
  return {
    suivant,
    entier,
    booleen: (p = 0.5) => suivant() < p,
    choisir,
    choisirPondere: <T>(liste: readonly T[], poids: readonly number[]): T => {
      const total = poids.reduce((a, b) => a + b, 0)
      let x = suivant() * total
      for (let i = 0; i < liste.length; i++) {
        x -= poids[i] ?? 0
        if (x < 0) return liste[i] as T
      }
      return liste[liste.length - 1] as T
    },
    melanger,
    echantillon: (liste, n) => melanger(liste).slice(0, n),
  }
}

const ANNONCEURS = [
  'AQUALIA',
  'BOREAL MOTORS',
  'CIRRUS TELECOM',
  'DELTA FOODS',
  'ECLAT COSMETIQUES',
  'FJORD ENERGIE',
  'GALAXIA JEUX',
  'HELIOS BANQUE',
  'IRIS OPTIQUE',
  'JADE VOYAGES',
  'KAIROS ASSURANCES',
  'LUMEN CINEMAS',
] as const
const MOTS_THEME = [
  'Printemps',
  'Soldes',
  'Rentrée',
  'Lancement',
  'Promo',
  'Collection',
  'Nouveauté',
  'Festival',
  'Opération',
  'Saison',
  'Offre',
  'Édition',
] as const
const QUALIFS = [
  'Rouge',
  'Bleu',
  'Vert',
  'Or',
  'Argent',
  'Corail',
  'Menthe',
  'Ardoise',
  'Safran',
] as const
const NOMS = [
  'Durand',
  'Martin',
  'Lefèvre',
  'Moreau',
  'Garnier',
  'Roussel',
  'Faure',
  'Blanc',
  'Chevalier',
  'Perrin',
] as const
const PRENOMS = [
  'Alix',
  'Camille',
  'Dominique',
  'Eden',
  'Florian',
  'Gaëlle',
  'Hugo',
  'Inès',
  'Jules',
  'Lou',
] as const

export const annonceur = (rng: Rng) => rng.choisir(ANNONCEURS)
/** Intitulé de thème fictif ; `n` garantit l'unicité dans un dossier. */
export const theme = (rng: Rng, n: number) =>
  `${rng.choisir(MOTS_THEME)} ${rng.choisir(QUALIFS)} ${String(n)}`
export const nomPersonne = (rng: Rng) => `${rng.choisir(PRENOMS)} ${rng.choisir(NOMS)}`
