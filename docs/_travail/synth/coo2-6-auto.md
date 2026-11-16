Traitements automatiques du bloc 2. Les fréquences et plannings des batchs legacy sont INCONNUS (aucune planification dans le dépôt, legacy-integrations.md §6) ; elles ne sont donc pas des règles (Q-005).

| Traitement | Déclencheur / fréquence | Effet | Règles | Source |
|---|---|---|---|---|
| Calcul des trains (identifiant, version, position, thèmes, entretien, anti-doublons) | à la transition Instruction OK (automatique ou manuelle) | faces 0 / 1 / 3 → 2, faces d'entretien, annulation de faces en doublon | RG-COO-200 à 207 | `p_u_associe_train.sql` ; EX-COO-021 |
| Couverture des visuels et passage EN_ATTENTE ↔ PRET | à chaque réception, fractionnement, raccrochage, suppression de train, Instruction OK | statut d'unité recalculé, indicateurs A / B / C | RG-COO-208 ; RG-X-079, 080 | ECR-COO-05 ; EX-PIL-501 |
| Passage à « En production » | impression de bague / envoi du fichier à la machine | PRET → EN_PROD | RG-COO-223, 299 | ECR-COO-11a, ECR-GEN-03 |
| Alerte « Rajout après préparation » et mail de la liste de distribution | préparation reçue après libération / après préparation des trains | alerte importante + mail | RG-X-075, 076, 078 | EX-COO-503, EX-FIX-503 |
| Alerte « Dernière minute sur fichier envoyé » | modification Broadcast sur train EN_PROD | alerte critique + mail + trace sur le train | RG-X-077 | EX-COO-512 |
| Alerte de départ proche / surcharge (dispatch) | affichage / affectation | callouts 36 h, 115 % | RG-COO-295 | ECR-COO-10 |
| Alerte « Feuille de stock à refaire » | correction d'intitulé | tag sur les affiches + mail | RG-X-082 | ECR-COO-09c |
| Sorties de stock automatiques à l'expédition | fin de journée Geodis | mouvements négatifs « Expédition C-… » | RG-X-087 ; RG-COO-269 | ECR-EXP-02 ; EX-STK-001 |
| Fin de journée des colis (7 → 8) | batch quotidien (planification inconnue) / bouton | colis, UM, faces → 8 | RG-COO-269 | `p_batch_fin_journee_colis.sql` |
| Mail « colis expédié » | batch `BatchEnvoieMailColis` (planification inconnue) | mails managers / tiers + pièce jointe | RG-COO-271 | `BatchEnvoieMailColisBll.cs` |
| Intégration AMT des répartitions (doublons, transcodage, anomalies, purge) | flux SSIS `Flux_Repartition_Amt_Ptf` (phases 1 à 3, planification inconnue) | `tf_repart_calcul` | RG-COO-272 à 276 | `p_integ_ptf_reparts.sql`, `p_integ_ptf_purge.sql` (applicabilité : Q-274) |
| Reprise de l'afficheur par panneau (dernière minute) | intégration des faces de trains | afficheurs alignés par `RefPanel` | RG-COO-207 | `p_integ_train_affiches.sql:111-117` |
| Historisation des changements de statut | à chaque transition | ligne d'historique | RG-COO-307 | CLAUDE.md §6 |
| (Hors bloc, cité) Instruction OK automatique, alimentation des attendues, copie de l'état des réservations, alertes de préparation, déblocage de préparation | voir coo1 | — | `RG-COO-1xx` | coo1 |
