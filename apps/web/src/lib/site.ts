// ECR-NAV-01 / EX-TRA-006 : site choisi au bandeau 1, valable pour toute l'application. Mémorisé en sessionStorage
// (comme la maquette, `M.state.site`) et envoyé en en-tête `x-site-id` par le client API ; le serveur le revérifie
// dans le périmètre de l'utilisateur (RG-REC-001, RG-COO-167). null = « Tous les sites » (aucun en-tête).
const CLE = 'circe_site'
const abonnes = new Set<() => void>()

export function getSiteId(): number | null {
  try {
    const brut = sessionStorage.getItem(CLE)
    const valeur = brut === null ? NaN : Number(brut)
    return Number.isInteger(valeur) && valeur > 0 ? valeur : null
  } catch {
    return null
  }
}

export function setSiteId(id: number | null): void {
  try {
    if (id === null) sessionStorage.removeItem(CLE)
    else sessionStorage.setItem(CLE, String(id))
  } catch {
    // stockage indisponible (navigation privée) : le site reste « Tous les sites »
  }
  abonnes.forEach((notifier) => {
    notifier()
  })
}

export function abonnerSite(notifier: () => void): () => void {
  abonnes.add(notifier)
  return () => {
    abonnes.delete(notifier)
  }
}
