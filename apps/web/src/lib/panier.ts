import type { LigneAttendue } from '@circe/shared'
import { useEffect, useState } from 'react'

// REC-P03 — Panier « Lignes du BL » (RG-REC-021 à 023). État du navigateur : confort de saisie, jamais
// une donnée de référence (la vérification et la création sont faites par l'API).

export interface LignePanier {
  ligneAttendueId: number
  plateformeId: number
  site: string
  dossier: number | null
  annonceur: string | null
  theme: string | null
  reste: number
  attendu: number
  recu: number
  affiches: number[]
  /** RG-REC-023 : Qté du BL, ≥ 0, par défaut le reste attendu (ou l'attendu s'il n'y a plus de reste). */
  quantite: number
  /** RG-NEW-REC-002 : l'agent coche explicitement les lignes du BL. */
  cochee: boolean
  /** RG-REC-040 : « Complément de l'affiche n° » (affiche déjà reçue sur cette ligne). */
  complementAfficheId: number | null
  /** RG-REC-047 : « Intitulé saisi (sans IP) » quand la ligne n'a pas de thème. */
  intituleSaisi: string
}

export function depuisLigne(l: LigneAttendue): LignePanier {
  return {
    ligneAttendueId: l.id,
    plateformeId: l.site.id,
    site: l.site.nom,
    dossier: l.dossier,
    annonceur: l.annonceur,
    theme: l.theme,
    reste: l.reste,
    attendu: l.attendu,
    recu: l.recu,
    affiches: l.affiches,
    quantite: l.reste > 0 ? l.reste : l.attendu,
    cochee: false,
    complementAfficheId: null,
    intituleSaisi: '',
  }
}

/** RG-REC-021 : ajouter une ligne déjà au panier est refusé (« Ce visuel est déjà au panier. »). */
export function ajouter(panier: LignePanier[], lignes: LigneAttendue[]) {
  const deja = new Set(panier.map((p) => p.ligneAttendueId))
  const nouvelles = lignes.filter((l) => !deja.has(l.id)).map(depuisLigne)
  return {
    panier: [...panier, ...nouvelles],
    ajoutees: nouvelles.length,
    doublons: lignes.length - nouvelles.length,
  }
}

/** Messages de la maquette : « Ce visuel est déjà au panier. » / « n ligne(s) ajoutée(s) au panier. ». */
export function messageAjout(ajoutees: number): string {
  return ajoutees === 0
    ? 'Ce visuel est déjà au panier.'
    : `${String(ajoutees)} ligne(s) ajoutée(s) au panier.`
}

export function retirer(panier: LignePanier[], id: number) {
  return panier.filter((p) => p.ligneAttendueId !== id)
}

export function cocher(panier: LignePanier[], id: number, cochee: boolean) {
  return panier.map((p) => (p.ligneAttendueId === id ? { ...p, cochee } : p))
}

export function toutCocher(panier: LignePanier[], cochee: boolean) {
  return panier.map((p) => ({ ...p, cochee }))
}

/** RG-REC-023 : la saisie négative est ramenée à 0 côté écran ; le serveur refuse de toute façon (400). */
export function changerQuantite(panier: LignePanier[], id: number, quantite: number) {
  const q = Number.isFinite(quantite) ? Math.max(0, Math.trunc(quantite)) : 0
  return panier.map((p) => (p.ligneAttendueId === id ? { ...p, quantite: q } : p))
}

/** Modifie une ligne du panier (complément, intitulé saisi). */
export function modifier(panier: LignePanier[], id: number, patch: Partial<LignePanier>) {
  return panier.map((p) => (p.ligneAttendueId === id ? { ...p, ...patch } : p))
}

/** État de la case « tout » : cochée, décochée ou indéterminée. */
export function etatTout(panier: LignePanier[]): 'tout' | 'rien' | 'partiel' {
  const n = panier.filter((p) => p.cochee).length
  return n === 0 ? 'rien' : n === panier.length ? 'tout' : 'partiel'
}

/** RG-REC-022 : seules les lignes cochées entrent ; les autres restent au panier. */
export function retirerCochees(panier: LignePanier[]) {
  return panier.filter((p) => !p.cochee)
}

const CLE = 'circe.reception.panier'

function lire(): LignePanier[] {
  try {
    const brut = sessionStorage.getItem(CLE)
    const lignes = brut ? (JSON.parse(brut) as Partial<LignePanier>[]) : []
    // Paniers mémorisés avant REC-P04 : champs ajoutés à leur valeur par défaut.
    return lignes.map(
      (l) => ({ complementAfficheId: null, intituleSaisi: '', ...l }) as LignePanier,
    )
  } catch {
    return []
  }
}

/** Panier mémorisé dans l'onglet (sessionStorage) ; vide si le stockage est indisponible. */
export function usePanier() {
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [charge, setCharge] = useState(false)
  useEffect(() => {
    // Lecture après le montage (le rendu serveur n'a pas de sessionStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec un système externe (stockage du navigateur)
    setPanier(lire())
    setCharge(true)
  }, [])
  useEffect(() => {
    if (!charge) return
    try {
      sessionStorage.setItem(CLE, JSON.stringify(panier))
    } catch {
      // Stockage indisponible (navigation privée) : le panier reste en mémoire.
    }
  }, [panier, charge])
  return [panier, setPanier] as const
}
