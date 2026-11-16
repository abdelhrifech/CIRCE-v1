| Traitement | Déclencheur / fréquence | Effet | Règles | Source |
|---|---|---|---|---|
| Calcul des statuts de ligne attendue et du statut Contrôle | À chaque événement de réception, contrôle, rattachement, retrait | Recalcul Attendue / Partielle / Complète / Surplus ; Rien reçu / À contrôler / Contrôlée | RG-REC-017, 018, 019, 176 | EX-REC-050, 051 |
| Pose des tags d'affiche | À chaque événement | À contrôler, Réception inconnue, Complément, Feuille à refaire | RG-REC-127, 128, 129 | EX-REC-054 |
| Détection des palettes en retard | Périodique (fréquence non spécifiée, Q-157) | Indicateur, teinte, alerte grave au double du délai | RG-REC-055, 189 | EX-REC-019, 070 |
| Alertes de réception | À l'événement ou périodique | Visuel non reçu / partiel, écart > 10 %, sans IP, inconnue, introuvable, feuille définitive, feuilles à refaire, palette en retard | RG-REC-182 à 190 | EX-REC-063 à 071 |
| Résumé à 7 h | Quotidien 7 h (forme à définir, Q-131) | Résumé des visuels non reçus | RG-REC-182 | EX-REC-063 |
| Purge des réceptions attendues | Planifié (fréquence non spécifiée) | Purge > 4 semaines sauf conservation à l'année ; une ligne au journal ; sans alerte | RG-REC-180, 181 | EX-REC-075 |
| Recalcul des unités EN_ATTENTE ↔ PRET | À chaque événement de réception | Unités prêtes à produire | RG-X-003 | EX-REC-014 |
| Proposition de rattachement / validation admin | À « Valider la réception » | Proposé (cas sûr) ou doute | RG-X-001, 002 | EX-COO-004 |
| Impression de l'étiquette rack à la validation admin | Passage à « validée » | Impression plateforme | RG-REC-089 | legacy RG-REC-028 |
| Batch d'export des réceptions vers PEX/Broadcast | Planification inconnue | `CIRCE_PEX_RECEPTION`, `affiche.envoye`, SP INTERFACE | RG-REC-199, 200 ; RG-X-022 | legacy RG-REC-110 |
| Alimentation des lignes attendues | Planification inconnue (Q-005) | Propriété Coordination | RG-REC-202 | legacy RG-REC-082 |
| Mise à jour de `date_dernier_depart` | Rattachement / retrait | Date recalculée | RG-REC-143 | legacy RG-REC-032 |
| Historique et journal | Chaque action | Entrées auteur/date | RG-REC-004, 005, 006, 007 | EX-TRA-035 |
