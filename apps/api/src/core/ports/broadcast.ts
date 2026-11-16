// Port d'échange avec Broadcast (COO-P06). La source réelle (procédures INTERFACE / EXTPLAY, service
// webapicirce, droits d'appel) n'est pas dans le dépôt : Q-005 (BLOQUÉE). Aucun adaptateur réel n'existe ;
// l'adaptateur par défaut refuse explicitement (jamais de succès simulé en production). Les tests injectent
// un adaptateur en mémoire.
import type { LotIntegration } from '@circe/shared'

export interface MessageBroadcast {
  type:
    | 'ACCUSE_PREPA'
    | 'PURGE_INTERFACE'
    | 'RAFRAICHIR_DOSSIER'
    | 'RETOUR_RECEPTION'
    | 'DEBLOQUER_GROUPE'
  cle: string
  donnees: unknown
}

export interface BroadcastPort {
  readonly nom: string
  /** True si une source réelle est branchée (le planificateur ne démarre que dans ce cas, RG-COO-103). */
  readonly configure: boolean
  /** RG-COO-104 : lecture d'un lot (cinq flux). */
  lireLot(): Promise<LotIntegration>
  /** RG-COO-125 / 131 / 132 / 134 : écriture vers Broadcast ; lève en cas d'échec. */
  envoyer(message: MessageBroadcast): Promise<void>
}

export class BroadcastNonConfigure implements BroadcastPort {
  readonly nom = 'non-configure'
  readonly configure = false
  lireLot(): Promise<LotIntegration> {
    return Promise.reject(new Error('Source Broadcast non configurée (Q-005).'))
  }
  envoyer(): Promise<void> {
    return Promise.reject(new Error('Envoi vers Broadcast non configuré (Q-005).'))
  }
}
