import type { ApiError } from './api-client.ts'

/** Titre et conseil affichés pour chaque famille d'erreur ; le message du serveur est toujours montré. */
export function describeError(error: ApiError): { titre: string; conseil: string | null } {
  switch (error.kind) {
    case 'non_authentifie':
      return {
        titre: 'Connexion requise',
        conseil: 'Votre session n’est pas reconnue. Reconnectez-vous.',
      }
    case 'interdit':
      return { titre: 'Action non autorisée', conseil: null }
    case 'conflit':
      return {
        titre: 'Conflit',
        conseil: 'Les données ont changé entre-temps : rechargez la page avant de recommencer.',
      }
    case 'regle_metier':
      return { titre: 'Règle métier non respectée', conseil: null }
    case 'validation':
      return { titre: 'Saisie invalide', conseil: 'Corrigez les champs signalés.' }
    case 'introuvable':
      return { titre: 'Élément introuvable', conseil: 'Il a peut-être été supprimé ou déplacé.' }
    case 'serveur':
      return { titre: 'Erreur du serveur', conseil: 'Réessayez dans un instant.' }
    case 'reseau':
      return { titre: 'Serveur injoignable', conseil: 'Vérifiez la connexion puis réessayez.' }
  }
}
