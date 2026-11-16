// ÉTAPE 7 — cellules de la matrice d'impact NON réalisées ou BLOQUÉES : elles restent VISIBLES comme tests en
// attente (it.todo), jamais masquées (CLAUDE.md §7.6). Chacune renvoie à sa question et à ECARTS_EXISTANT_VS_CIBLE.md.
import { describe, it } from 'vitest'

describe('Cellules BLOQUÉES ou à arbitrer (étape 7)', () => {
  // RG-X-061 : la proposition « complément » n'est pas modélisée (la validation est portée par l'affiche, pas par
  // le lot reçu) : Q-399 (OUVERTE), ECART-010, ANO-058 (RAPPORT_TESTS).
  it.todo(
    'RG-X-061 un complément reçu sur une affiche déjà validée ouvre une NOUVELLE proposition « A_CONFIRMER_PROPOSE » (tag « Complément ») sans retirer la validation du 1er lot (Q-399)',
  )
  // RG-X-085 : la couverture recalculée « sur les unités non EN_PROD » et le rattachement du surplus sur un train déjà
  // EN_PROD ne sont pas démontrés (Q-280 : hypothèse non validée). R-14 / R-18 ne couvrent que la validation conservée,
  // l'alerte et les trains figés.
  it.todo(
    'RG-X-085 une affiche tardive confirmée recalcule la couverture sur les seules unités non EN_PROD ; le surplus ne se rattache pas à un train EN_PROD (Q-280)',
  )
  // RG-X-016 : « Surplus proposé à l'autre dossier, répartition à confirmer » (Q-419 ; la Q-123, quantité par défaut
  // à la reprise des rattachements, était hors sujet).
  it.todo(
    'RG-X-016 le surplus d’une affiche partagée est proposé à l’autre dossier, répartition à confirmer par la Coordination (Q-419)',
  )
  // RG-X-077 : traitement cible d'une DM (fichier à part, unité à part) : Q-282 OUVERTE ; trace + alerte seulement.
  it.todo(
    'RG-X-077 une dernière minute sur un train en production crée une production à part (Q-282 OUVERTE ; seule la trace et l’alerte critique sont réalisées)',
  )
  // RG-X-022 : la condition « associée = liée ET validée » est testée (C-07) ; ce qui manque est le batch PEX qui
  // ENVOIE le retour vers Broadcast (Q-151, Q-005).
  it.todo(
    'RG-X-022 le batch PEX envoie réellement le retour « reçue et associée » vers Broadcast (batch non reproduit : Q-151, Q-005)',
  )
})
