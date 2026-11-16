### 3.1 Statuts du bloc 2 (trains, préparation, répartition, UM, colis)

Périmètre : coo2 est propriétaire des statuts de face de train / train, d'unité de production, de ligne de répartition, d'UM et (interface) de colis ; coo1 est propriétaire des statuts de dossier, de validation admin et d'instruction (mêmes codes `tr_statut` 0 à 5 côté instruction). Les codes sont ceux de l'énumération C# (`Enums.cs:52-77`, `CommunBll.cs:46-59`, 0 à 10) ; le contenu de `tr_statut` n'est pas dans le dépôt (Q-004). La cible (maquette, ECR-ADM-03 et `M.STATUTS`) définit un statut d'unité à 7 valeurs ; leur articulation avec les codes legacy est l'objet de Q-250 (HYPOTHÈSE PRISE : voir cette question).

| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| Face de train 0 | A traiter | face intégrée de Broadcast, instruction pas encore passée | legacy RG-COO-049 ; EX-EXI-030 |
| Face de train 1 | En cours | face remise à blanc / instruction en cours (retour de l'Instruction OK) | legacy RG-COO-064 |
| Face de train 2 | Instruction ok | thème posé, train, position, entretien calculés ; seule valeur exportable | RG-COO-200 à 203, 210 |
| Face de train 3 | Erreur | face en erreur, repassée à 1 / supprimée puis recréée à l'intégration | legacy RG-COO-049 ; bdd.md §4.1 |
| Face de train 4 | Annulé | face annulée (anti-doublon, annulation de thème) | RG-COO-205, 219 |
| Face de train 5 | A imprimer (cible : Prêt à produire) | faces exportées le jeudi : go des plateformes | RG-COO-210 ; EX-COO-024 ; maquettes-autres-modules.md §0.6 point 6 |
| Face de train 6 | Préparé (cible : Produit) | posé côté production ; non analysé pour les faces | EX-EXI-030 ; Q-250 |
| Face de train 7 | A expédier (cible : Colisé · à expédier) | face dans un colis | RG-COO-270 |
| Face de train 8 | Terminé (cible : Expédié puis Livré) | fin de journée | RG-COO-269 |
| Face de train 9 | Export prépa (cible : En production) | face exportée pour la préparation 2 m² (ateliers 5 et 6) | RG-COO-215 |
| Face de train 10 | Au roulage (cible : En production) | rouleur affecté, train en roulage | RG-COO-217 |
| Unité EN_ATTENTE | En attente d'affiches | au moins un visuel non couvert ni fractionné (calcul de couverture) | RG-COO-208 ; ECR-COO-05 |
| Unité PRET | Prêt à produire | tous les visuels couverts ou fractionnés (maquette) ; = statut A imprimer après export (spec) | RG-COO-208, 210 ; Q-250, Q-251 |
| Unité EN_PROD | En production | bague imprimée ou fichier envoyé : POINT DE NON-RETOUR | RG-COO-223, 299 |
| Unité PRODUIT | Produit | production terminée (« Préparé » legacy) ; comptage pliage conforme | RG-COO-247, 250 |
| Unité COLISE | Colisé · à expédier | unité scannée dans un colis ouvert | RG-COO-265 ; ECR-EXP-01 |
| Unité EXPEDIE | Expédié | fin de journée Geodis | RG-COO-269 |
| Unité LIVRE | Livré | preuve de livraison reçue | ECR-EXP-02 (module EXP) |
| Repère « à libérer » | à libérer | ligne fixe / pliage / bus d'une semaine non libérée | RG-COO-241 |
| Repère « arrivé après libération » | Arrivé après libération (Important) | préparation reçue après la libération | RG-COO-242 |
| Repère « rendu » / « main rendue » | Main rendue à la Pré-Prod | unité non lancée rendue | RG-COO-243 |
| Ligne de répartition 0 | A traiter | répartition intégrée sans UM | legacy RG-RPR-002 ; EX-EXI-040, 042 |
| Ligne de répartition 1 | En cours | ligne rattachée à une UM (colisée) | RG-COO-261 |
| Ligne de répartition 3 | Erreur | anomalie 905 / 906 / 907 à l'intégration AMT | RG-COO-274 |
| Ligne de répartition 4 | Annulé | déblocage ; libère le `rpfo_ident` | RG-COO-272, 278 |
| Ligne de répartition 6 | Préparé | UM préparée (le statut ne suit pas les 7 / 8 de l'UM) | RG-COO-250, 280 |
| UM 1 | En cours | UM créée / réouverte | RG-COO-261 |
| UM 6 | Préparé | UM préparée ou placée dans un colis | RG-COO-250, 265 |
| UM 7 | A expédier | colis expédié | RG-COO-268 |
| UM 8 | Terminé | fin de journée | RG-COO-269 |
| UM 4 | Annulé | déblocage de répartition | RG-COO-278 |
| Colis 1 | En cours (cible : Colis ouvert) | colis créé | RG-COO-266 |
| Colis 7 | A expédier (cible : Clos · à expédier) | colis expédié (legacy) | RG-COO-268 |
| Colis 8 | Terminé (cible : Expédié, Livré) | fin de journée | RG-COO-269 |

### 3.2 Transitions (toute transition absente est INTERDITE : 409)

Face de train (`tf_face_train.rpc_statut`)

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (nouvelle) | Intégration Broadcast (coo1) | 0 | batch | pas de réintégration au-delà de l'Instruction OK (RG-COO-049 legacy, coo1) | RG-COO-207 | legacy `p_integ_train_affiches.sql` |
| 0, 1, 3 | Instruction OK (transition coo1) | 2 | `coord` (auto : règle de Nariman) | thèmes à 100 % (coo1) | RG-COO-200 à 205 | `p_u_associe_train.sql` |
| 2 | Retour de l'instruction à 0 / 1 / 4 | remis à blanc (0 / 1 / 4) | `coord` | face non à 5 | RG-COO-206 | `p_u_statut_preparation.sql:24-64` |
| 2 | Exporter les trains | 5 | `coord` | RG-COO-210, 211, 216 | RG-COO-213, 214, RG-X-083 | `PreparationDeroulantsService.cs:109-223` |
| 2 | Changer statut | 5 | `train_changer_statut` | RG-COO-218 | historique | `PreparationDeroulantsController.cs:1417-1431` |
| 5 | Changer statut | 10 | `train_changer_statut` | RG-COO-218 | rouleur : RG-COO-217 | idem |
| 5 | Export préparation (ateliers 5 et 6) | 9 | `cheq`, `coord` | RG-COO-215, 216 | — | `TrainPreparationBll.cs:257-291` |
| 9 | Au roulage | 10 | `cheq`, `coord` | rouleur obligatoire (RG-COO-217) | EN_PROD (RG-COO-299) | `TrainExportPrepaRepository.cs` |
| 9 | Suppression d'un thème de l'export | 5 | `cheq`, `coord` | RG-COO-217 | — | `TrainPreparationRepository.cs` |
| 10, 5, 9 | Changer statut « A imprimer » | 5 | `train_changer_statut` | toutes les faces en 10, 5 ou 9 (RG-COO-218) | restreint aux directeurs de plateforme / chefs d'équipe (EX-ADM-503) | `TrainPreparationBll.cs:234-255` |
| 5 | Annuler thème | 4 | `train_annuler_theme` | thème et faces à 5 (RG-COO-219) | `train_id = NULL` | `TrainSuiviThemeBll.cs:181-202` |
| 5 | Débloquer semaine | 2 | `train_debloquer_semaine` | toutes les faces à 5, aucune EN_PROD (RG-COO-220) | instructions 5 → 2 | `TrainSuiviThemeBll.cs:496-522` |
| 5, 9, 10 | Ajout du train à un colis | 7 | `expe`, `cheq` | RG-COO-270 | — | `PreparationColisageService.cs:154-209` |
| 7 | Fin de journée | 8 | batch / `expe` | RG-COO-269 | RG-X-087 | `p_batch_fin_journee_colis.sql` |
| 5 | Dupliquer train (copies) | 5 (nouvelles faces) | `duplication_train` | RG-COO-226 | — | `p_u_duplication_train.sql` |

Unité de production cible (train, UM, lot) — statut persisté ou dérivé selon Q-250

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| EN_ATTENTE | Couverture complète (automatique) | PRET | système | tous les visuels couverts ou fractionnés (RG-COO-208) | RG-X-079 | ECR-COO-05 |
| EN_ATTENTE | Fractionner | PRET | `coord`, `cheq` | ≥ 1 visuel reçu (RG-COO-221) | position fractionnée, RG-X-086 | ECR-COO-05 |
| PRET | Réception retirée / raccrochage d'un visuel manquant | EN_ATTENTE | système | unité non EN_PROD (RG-COO-208, 222) | — | ECR-COO-05d |
| PRET | Imprimer les bagues / envoyer le fichier à la machine | EN_PROD | `cheq` | au moins une unité PRET (RG-COO-299) | point de non-retour (RG-COO-223) | ECR-COO-11a, ECR-GEN-03 |
| EN_ATTENTE, PRET | Rendre la main à la Pré-Prod | EN_ATTENTE (repère rendu) | `coord` | unités non EN_PROD (RG-COO-243) | RG-X-081 | ECR-COO-09b |
| PRET, EN_PROD | Valider le comptage (pliage) | PRODUIT | `cheq` | RG-COO-247 | alerte qualité si écart | ECR-COO-09 |
| EN_PROD | Préparé / produit (fixe : « Préparer ») | PRODUIT | `cheq` | RG-COO-250 | — | EX-EXI-042 |
| PRODUIT | Scan dans un colis | COLISE | `expe`, `cheq` | RG-COO-265 | — | ECR-EXP-01 |
| COLISE | Fin de journée Geodis | EXPEDIE | `expe` | RG-COO-269 | RG-X-087 | ECR-EXP-02 |
| EXPEDIE | Preuve de livraison reçue | LIVRE | système | module EXP | — | ECR-EXP-02 |
| (train) EN_ATTENTE | Suppression de train | supprimé | `coord` | non EN_PROD, motif (RG-COO-225) | couverture recalculée | ECR-COO-05e |

Ligne de répartition (`tf_repart_calcul.rpc_statut`)

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (nouvelle) | Intégration batch (coo1 ou AMT) | 0 | batch | pas de doublon actif (RG-COO-272) | — | `p_integ_preparation.sql`, `p_integ_ptf_reparts.sql` |
| (nouvelle) | Intégration AMT, anomalie 905 / 906 / 907 | 3 | batch | RG-COO-274 | anomalies | `p_integ_ptf_reparts.sql` |
| 0 | Créer UM (colisage) | 1 | `cheq`, `coord` | seul le statut 0 est admis (RG-COO-262) | UM_id posé | `PreparationRepository.cs:190-303` |
| 1 | Retirer | 0 | `cheq` (droit `retirer`) | UM dans aucun colis (RG-COO-249) | UM supprimée | `PreparationService.cs:275-288` |
| 1 | Préparer | 6 | `cheq`, `coord` | RG-COO-250 | — | `PreparationRepository.cs:435-470` |
| 0, 1, 6 | Déblocage | 4 | `coord`, `admin` (pont coo1) | aucune UM ≥ 6 (RG-COO-277) | UM → 4 (RG-COO-278) | `p_u_statut_repart_deblocage.sql` |
| 4 | Réintégration d'une nouvelle ligne | (nouvelle ligne à 0) | batch | RG-COO-272 | — | `p_integ_ptf_reparts.sql:72-90` |

UM (`tf_UM.rpc_statut`) et colis (`tf_colis.rpc_statut`) — interface

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (nouvelle) | Création d'UM | UM 1 | `cheq`, `coord` | RG-COO-260, 261 | répartitions 0 → 1 | `PreparationRepository.cs:190-303` |
| UM 1, 6 | Ajout au colis | UM 6 | `expe`, `cheq` | même destinataire (RG-COO-265) | poids du colis (RG-COO-263) | `PreparationColisageService.cs:76-148` |
| UM 6 | Retrait du dernier colis | UM 1 | `expe`, `cheq` | RG-COO-267 | — | `PreparationColisageService.cs:240-322` |
| UM 1, 6 | Préparer | UM 6 | `cheq` | RG-COO-250 | — | `PreparationService.cs:294-299` |
| UM 1, 6 | Expédier le colis | UM 7 | `expe` | RG-COO-268 | — | `PreparationColisBll.cs:497-560` |
| UM 7 (colis 7) | Fin de journée | UM 8 | batch / `expe` | RG-COO-269 | RG-X-087 | `p_batch_fin_journee_colis.sql` |
| UM 7, 8 | Ouvrir le colis | UM 1 ou 6 | `expe` | deux comportements legacy (RG-COO-266) | — | `PreparationColisageService.cs:329-345` |
| UM (tout statut) | Déblocage de répartition | UM 4 | `coord` (pont coo1) | RG-COO-277 | colis inchangés (RG-COO-278) | `p_u_statut_repart_deblocage.sql` |
| (nouveau) | Création de colis | colis 1 | `expe`, `cheq` | RG-COO-266 | — | `PreparationColisRepository.cs:203-225` |
| colis 1 | Expédier | colis 7 | `expe` | RG-COO-268 | UM / faces → 7 | `p_u_expedie_Colis.sql` |
| colis 7 | Fin de journée | colis 8 | batch / `expe` | RG-COO-269 | — | `p_batch_fin_journee_colis.sql` |
| colis 7, 8 | Ouvrir | colis 1 | `expe` | cible : colis clos ne se rouvre pas (RG-COO-266, Q-272) | — | `PreparationColisBll.cs:139-158` |

Transitions interdites notables (409)

| De | Action | Pourquoi | Règle |
|---|---|---|---|
| Face 2 | Annuler thème / Débloquer semaine | seules les faces à 5 | RG-COO-219, 220 |
| Face 0, 1, 3, 4 | Exporter les trains | seules les faces à 2 partent | RG-COO-210 |
| Face ≠ 5 ou 9 | Export préparation | message « Les faces des trains ne sont pas dans le statut 'A imprimer' ! » | RG-COO-215 |
| Face (ateliers ≠ 5, 6) | Export préparation / Caire | ateliers 5 et 6 seulement | RG-COO-215 |
| Unité EN_PROD et au-delà | Modifier, fractionner, raccrocher, supprimer, débloquer semaine, rendre la main (retrait) | point de non-retour : « Train déjà en production : impossible de le modifier (point de non-retour). » | RG-COO-223 |
| Unité autre que EN_ATTENTE | Fractionner | « Aucun train fractionnable (il faut au moins un visuel reçu). » | RG-COO-221 |
| Train complet | Raccrocher un visuel | « Train complet » | RG-COO-209, 222 |
| Unité PRET absente | Imprimer les bagues | « Aucune unité « Prêt à produire » dans la sélection. » | RG-COO-299 |
| Répartition 3, 4, 6, 7, 8 | Créer UM | seule la répartition à 0 entre dans une UM (HYPOTHÈSE) | RG-COO-262 |
| UM dans un colis | Retirer | refus explicite (le legacy échoue par contrainte étrangère) | RG-COO-249 |
| UM 3, 4, 7, 8 | Ajout au colis / Préparer | seules les UM 1 ou 6 | RG-COO-265, 250 |
| Répartition avec UM ≥ 6 | Déblocage | « Le groupe de preparation n'est pas déblocable ! » | RG-COO-277 |
| Libération déjà posée pour (atelier, semaine) | Libérer | HYPOTHÈSE : une seule libération | RG-COO-240 |
| Toute transition non listée ci-dessus | tout | table de transitions explicite (CLAUDE.md §6) | RG-COO-307 |
