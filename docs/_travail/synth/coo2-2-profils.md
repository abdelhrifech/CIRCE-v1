Rôles provisoires (Q-003) : les 6 rôles de la maquette (`M.ROLES`, `core.js:187-194`). La maquette ne restreint par rôle que la validation admin (coo1) ; tout le reste du bloc est « grisé » sans interdiction (info-bulles « Réservé à la Coordination »). Le legacy ne contrôle aucun droit côté serveur (RG-ADM-015) : seules des entrées de menu / boutons selon les 27 droits `tr_utilisateur_menu`. La matrice ci-dessous est donc une HYPOTHÈSE (Q-286) construite sur le champ `roles` des écrans de la maquette (ECR-COO-05 à 11 : `cheq` + `coord`, dispatch / bagues : `cheq`), les info-bulles et le mapping des droits legacy. Les contrôles sont à faire dans le service (CLAUDE.md §6). Les droits `debloque_repart`, `view_repart`, `validation_admin`, `train_rafraichir_contrat` sont traités par coo1.

| Action | coord | cheq | recep | expe | admin | com | Source |
|---|---|---|---|---|---|---|---|
| Consulter Liste des trains, Suivi par thème, Préparation, Suivi 8 m², unitaire (fixe / pliage / bus) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ? Q-286 | maquette `roles` ECR-COO-05 à 09 ; legacy `pliage`, `train_suivi_theme`, `train_preparation`, `_2m2_fixe`, `pliage`, `bus` |
| Exporter les trains (jeudi 14 h) et simulation | ✔ | ? Q-286 | ✘ | ✘ | ✔(cond.) pont `admin` = `coord` (Q-COO-6) | ✘ | ECR-COO-05b info-bulle « par la Coordination » ; legacy droit `pliage` ; RG-COO-212 |
| Créer / supprimer un train (pré-test, entretien) | ✔ | ? Q-286 | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-05c, 05e (Q-COO-14) ; EX-COO-505 ; RG-COO-224, 225 |
| Fractionner / Raccrocher un visuel | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | legacy `train_regrouper` ; RG-COO-221, 222 |
| Changer statut, Annuler un thème, Débloquer semaine (trains) | ✔ | ? Q-286 | ✘ | ✘ | ? Q-286 | ✘ | legacy `train_changer_statut`, `train_annuler_theme`, `train_debloquer_semaine` ; RG-COO-218 à 220 |
| Export préparation, Au roulage, Choisir le rouleur | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | legacy `train_preparation` ; ECR-COO-07 ; RG-COO-215, 217, 236 |
| Pré-assemblage (marquer / désassembler) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-06 ; RG-COO-233 |
| Saisie du Suivi 8 m² (demies haut / bas, finales) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-08 ; RG-COO-237 |
| Afficher le n° de panneau Broadcast | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | EX-SCR-512 ; RG-COO-229 |
| Libérer la semaine (fixe, pliage, bus) | ✔ | ? Q-265 | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09a (« Qui fait la libération ? » ouverte, Q-COO-17) ; RG-COO-240 |
| Rendre la main à la Pré-Prod | ✔ | ? Q-286 | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09b ; EX-EXI-045 ; RG-COO-243 |
| Corriger l'intitulé (annonceur imprimé, thème) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09c ; EX-FIX-509 (droits limités à préciser) ; RG-COO-244 |
| Créer UM, Retirer, Préparer (fixe / pliage / bus) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | legacy `_2m2_fixe*`, `pliage*`, `bus*`, `retirer` ; RG-COO-249, 250, 260 |
| Saisir le comptage du pliage | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09 (« Plié ») ; RG-COO-247 |
| Quantités à encoller (Bus) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09e ; RG-COO-304 |
| Dispatch : proposer / affecter / désaffecter un rouleur, liste de picking | ? Q-286 | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-10 (`roles: cheq`) ; RG-COO-291 à 296 |
| Imprimer / modifier les bagues | ? Q-286 | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-11 (`roles: cheq`) ; RG-COO-298 à 300 |
| Réimprimer une bague | ? Q-286 | ✔(cond.) directeur de plateforme / chef d'équipe | ✘ | ✘ | ? Q-286 | ✘ | EX-ADM-503 ; RG-COO-301 |
| Dupliquer un train | ? Q-260 | ? Q-260 | ✘ | ✘ | ✔(cond.) droit legacy `duplication_train` non attribuable par l'écran | ✘ | legacy `_MenuNew.cshtml:180-183` ; RG-COO-226 |
| Colis : rattacher UM / train, expédier, fin de journée | ✘ | ✔ | ✘ | ✔ | ? Q-286 | ✘ | maquette ECR-EXP-01 (`roles expe, cheq`) ; legacy `train_preparation`, `expedition_ext` ; RG-COO-265 à 269 |
| Déblocage de répartition (annulation répartitions / UM) | ✔(cond.) pont coo1 | ✘ | ✘ | ✘ | ✔(cond.) pont coo1 | ✘ | legacy `debloque_repart` ; RG-COO-277, 278 |
| Rouleurs (référentiel) | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ | legacy droit `referentiel` ; ECR-ADM-07 ; RG-COO-297 |
