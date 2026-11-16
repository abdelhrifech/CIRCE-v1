# Legacy — Module RÉCEPTION (analyse de l'existant)

Périmètre : écrans « Réception des affiches » (LivraisonAffiche), « Liste des affiches » (ReceptionListeAffiche), « Fusion des affiches » (FusionAffiche), « Etat de destruction » (Destruction), association prépa↔affiche, batch PEX réception, SP associées.
Méthode : lecture seule de `circe-develop/`. Aucune règle déduite des specs/cible. Tout ce qui est dit « absence de contrôle » signifie : non trouvé dans le code lu.

## Légende des chemins (préfixes)
- `CTRL/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/Controllers/`
- `BLL/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.BLL/`
- `REPO/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.Repositories/`
- `VIEW/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/Views/`
- `MODEL/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.Model/`
- `TOOLS/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.Tools/`
- `SP/` = `circe-develop/BDD/DATABASE/DATABASE/dbo/Stored Procedures/`
- `FN/` = `circe-develop/BDD/DATABASE/DATABASE/dbo/Functions/`
- `JS/` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/JS/`

## Cartographie rapide
| Couche | Éléments |
|---|---|
| Écrans | `LivraisonAffiche/Index` (réception des affiches, popup `CreationLivraisonView`, `ModifierLivraisonView`), `ReceptionListeAffiche/Index` (liste + popup `_DetailAffiche`), `FusionAffiche/Index`, `Destruction/Index`, `Shared/DetailAffiche/*` |
| Contrôleurs | `LivraisonAfficheController`, `ReceptionListeAfficheController`, `FusionAfficheController`, `DestructionController`, `AssociationPrepaAfficheController` (délègue à `ZonePickingBLL`, Zone picking hors périmètre) |
| Services / BLL | `LivraisonAfficheService`, `ReceptionListeAfficheBll`, `FusionAfficheBll`, `DestructionBll`, `HistorisationBll`, `BatchAlimReceptionBll` |
| Repos (EF6 + appels SP) | `LivraisonAfficheRepository`, `ReceptionListeAfficheRepository`, `FusionAfficheRepository`, `DestructionRepository`, `BatchAlimReceptionRepository` |
| SP / fonctions | `p_GetListeAffiche`, `p_GetListeAfficheATraiter`, `p_GetListeAfficheRebus`, `p_GetListeAfficheFusionnees`, `p_GetListeReceptionAffiche` (ancienne, plus appelée par la BLL actuelle), `p_GetListeAfficheParDossierReservation` (non lue), `p_GetPrepareListAffiches`, `p_GetPrepareListLivraison`, `Fn_GetPrepaAffiche`, `p_GetDataReceptionOrpheline`, `p_s_destruction`, `p_s_affiche_a_fusionner`, `p_EditionPicking`, `p_batch_alimentation_circe_pex_reception`, `p_Alimentation_tf_prepa_affiche`, `p_u_numeroReception` (met à jour `tf_repart_calcul.numeroReception`, aucun appelant trouvé dans le périmètre) |
| Batch | `ClearChannel.CIRCE.BatchAlimPexCirceReception` (Program.cs) → `BatchAlimReceptionBll.Run()` |
| Triggers SQL | Aucun dossier `Triggers` dans `BDD/` (non trouvé) |
| Jobs planifiés | Aucun planificateur trouvé dans le dépôt (cron/Task Scheduler/SQL Agent externes). Voir zones non analysées. |
| Tables principales | `affiche`, `mouvement`, `livraison`, `asso_livraison_affiche`, `asso_livraison_photo`, `photo`, `tf_prepa_affiche`, `tf_prepa_Broadcast`, `tf_dossier_semaine_depart`, `fusion_affiche`, `histo_historique_entite`, `tr_categorie_support`, `tr_plateforme`, `tr_utilisateur_data`, `tr_utilisateur_menu`, `tr_transposteur_reception`, `tr_imprimeur` |

Entité centrale : `affiche` = « ligne de stock » (BDD/DATABASE/DATABASE/dbo/Tables/affiche.sql:1-30). Champs de statut implicites : `rebus` (bit null), `date_rebus`, `validationAdmin` (bit null), `a_conserver`, `zone_Picking`, `est_fusionne`, `envoye`. Il n'existe PAS de colonne « statut » : le statut est dérivé de combinaisons de flags (voir machine d'états).

---

# A. RÈGLES — LISTE DES AFFICHES (écran ReceptionListeAffiche)

### RG-REC-001 (provisoire) — Plateformes accessibles = celles de l'utilisateur
- Description : la combo « Site » ne propose que les plateformes rattachées au login Windows dans `tr_utilisateur_data`. La première est présélectionnée. Le `plt_id` posté par le client n'est jamais revérifié côté serveur.
- Déclencheur : ouverture de l'écran liste / réception / fusion / destruction.
- Conditions : `tr_utilisateur_data.loginWindows == user`.
- Effet : liste de plateformes ; `FirstOrDefault().Value` plante (NullReference) si l'utilisateur n'a aucune plateforme.
- Statuts concernés : n/a
- Profils : tous les utilisateurs authentifiés.
- Source : REPO/ReceptionListeAfficheRepository.cs:29-43 ; BLL/ReceptionListeAfficheBll.cs:41-43 ; REPO/LivraisonAfficheRepository.cs:220-235 ; CTRL/ReceptionListeAfficheController.cs:66-100 (plt_id reçu du client).
- Confiance : CERTAINE

### RG-REC-002 (provisoire) — Période par défaut et option « Historique »
- Description : période par défaut = 1 mois glissant (fin = aujourd'hui, début = fin − 1 mois). Si « Historique » est décoché, les dates sont réinitialisées. MAIS les 4 procédures de liste n'utilisent pas `@historique` : elles filtrent toujours sur `date_entree BETWEEN @debut AND @fin`.
- Déclencheur : Index / Rechercher / Read.
- Conditions : `historique == false` ⇒ `RecupDate`.
- Effet : filtre sur date d'entrée ; la case Historique n'a pour seul effet visible que d'afficher la colonne « Dernière sortie » et de conserver les dates saisies.
- Statuts concernés : n/a
- Profils : tous.
- Source : BLL/ReceptionListeAfficheBll.cs:73-76, 104-109 ; SP/p_GetListeAffiche.sql:112-122 ; SP/p_GetListeAfficheATraiter.sql:105-115 ; SP/p_GetListeAfficheRebus.sql:105-116 ; VIEW/ReceptionListeAffiche/Index.cshtml:144-151.
- Confiance : CERTAINE (SP lues) ; l'intention métier initiale (p_GetListeReceptionAffiche ancienne : sans historique = quantités > 0 / rebus null) est INCERTAINE et n'est plus appelée (SP/p_GetListeReceptionAffiche.sql:39-172).

### RG-REC-003 (provisoire) — Quatre listes : Tous / À traiter / Rebus / Fusionnées
- Description : le sélecteur « Résultat » propose Tous(0), À traiter(1, valeur par défaut), Rebus(2), Fusionnées(3).
- Déclencheur : recherche / lecture de la grille.
- Conditions : `resultatSelected` ∈ {0,1,2,3}.
- Effet : appelle respectivement `p_GetListeAffiche`, `p_GetListeAfficheATraiter`, `p_GetListeAfficheRebus`, `p_GetListeAfficheFusionnees`. Tri final `affiche_id` décroissant.
- Statuts concernés : n/a
- Profils : tous.
- Source : BLL/ReceptionListeAfficheBll.cs:53-54, 116-121, 738-754, 896-915 ; MODEL/ReceptionListeAfficheModel.cs:52-57.
- Confiance : CERTAINE

### RG-REC-004 (provisoire) — Liste « Tous » : exclut les affiches fusionnées (cibles)
- Description : toutes les affiches de la plateforme dans la période, sauf celles présentes comme cible dans `fusion_affiche`.
- Déclencheur : liste « Tous ».
- Conditions : `aff.plt_id = @plt_id AND fusion.id_affiche IS NULL AND date_entree BETWEEN`.
- Effet : lignes affichées ; quantité = SUM(mouvement.quantite) (et non `affiche.quantite`).
- Statuts concernés : n/a
- Profils : tous.
- Source : SP/p_GetListeAffiche.sql:81-122.
- Confiance : CERTAINE

### RG-REC-005 (provisoire) — Liste « À traiter »
- Description : affiches non rebutées, non fusionnées, et (non validées par l'admin OU sans prépa associée).
- Déclencheur : liste « À traiter » (défaut).
- Conditions : `((validationAdmin is null or =0) OR prep.affiche_livraison_Id is null) AND (rebus=0 or null) AND fusion.id_affiche is null`. Le `OR` fait qu'une affiche validée mais orpheline reste « à traiter ».
- Effet : lignes affichées.
- Statuts concernés : « à traiter » = (non validée) ∪ (orpheline), hors rebus, hors fusionnée.
- Profils : tous (colonne/bouton Fusion réservé, voir RG-REC-014).
- Source : SP/p_GetListeAfficheATraiter.sql:84-89.
- Confiance : CERTAINE

### RG-REC-006 (provisoire) — Liste « Rebus »
- Description : affiches avec `rebus = 1`, non fusionnées (cibles exclues).
- Déclencheur : liste « Rebus ».
- Conditions : `rebus = 1 AND fusion.id_affiche IS NULL`, date_entree dans la période ; hors zone picking.
- Effet : lignes affichées avec `date_rebus` exposée comme « date de destruction ».
- Statuts concernés : état « Au rebus ».
- Profils : tous.
- Source : SP/p_GetListeAfficheRebus.sql:83-86, 105-116 ; BLL/ReceptionListeAfficheBll.cs:1049-1077.
- Confiance : CERTAINE

### RG-REC-007 (provisoire) — Liste « Fusionnées »
- Description : affiches qui sont cibles d'une fusion (INNER JOIN `fusion_affiche.id_affiche`). Jointures sur `tf_prepa_affiche.affiche_livraison_initial_Id` et `mouvement.id_affiche_initial`. En liste Fusionnées, seule l'action « Modifier » (consultation) est proposée.
- Déclencheur : liste « Fusionnées ».
- Conditions : `fs.id_affiche = aff.affiche_id AND plt_id`.
- Effet : lignes affichées ; cohérent avec RG-REC-004/005/006 (cibles masquées ailleurs).
- Statuts concernés : état « Fusionnée (cible) ».
- Profils : tous.
- Source : SP/p_GetListeAfficheFusionnees.sql:73-87 ; VIEW/ReceptionListeAffiche/Index.cshtml:152-169.
- Confiance : CERTAINE

### RG-REC-008 (provisoire) — Définition de « orpheline »
- Description : affiche orpheline = aucune ligne `tf_prepa_affiche.affiche_livraison_Id = affiche_id`. Affichée « oui/non ». Deux définitions coexistent : SP (jointure prépa) et `GetListAfficheOrpheline` (affiche dont `date_creation` ∈ période ET aucune prépa) utilisée pour la zone picking.
- Déclencheur : toutes listes.
- Conditions : voir ci-dessus. `isOrpheline` des prépas FromBroadcast : les prépas FromBroadcast comptent comme association (la jointure SP ne filtre pas FromBroadcast), alors que `GetPrepaAfficheByAfficheId` les exclut.
- Effet : colonne « Orpheline » ; `isOrpheline` (EF) → recalcul des dossiers/semaines à la modification (RG-REC-025).
- Statuts concernés : orpheline ↔ associée.
- Profils : tous.
- Source : SP/p_GetListeAffiche.sql:62-65 ; REPO/ReceptionListeAfficheRepository.cs:456-469, 283 ; REPO/LivraisonAfficheRepository.cs:597-601.
- Confiance : PROBABLE (incohérence entre définitions)

### RG-REC-009 (provisoire) — Colonne « Zone » (statut d'affichage)
- Description : `statut` = « Picking » si `zone_Picking = true`, sinon « Réceptionnée ». La valeur d'enum `ReceptionAttendu` n'est jamais produite dans ce périmètre.
- Déclencheur : toutes listes.
- Conditions : `zone_Picking == true`.
- Effet : libellé via `StatutAffiche.GetDbCode()`.
- Statuts concernés : Réceptionnée ↔ Picking.
- Profils : tous.
- Source : BLL/ReceptionListeAfficheBll.cs:954, 996, 1034, 1073 ; circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.Entities/Enums.cs:185-193.
- Confiance : CERTAINE

### RG-REC-010 (provisoire) — Alerte « dernier départ dépassé » (rouge)
- Description : la date de dernier départ s'affiche en rouge si `date_dernier_depart > date_entree + 7 × conservation` (conservation exprimée en semaines dans ce calcul ; elle est en jours dans p_s_affiche_a_fusionner → incohérence d'unité).
- Déclencheur : rendu grille.
- Conditions : date_dernier_depart non nulle ; `conservation` NOT NULL.
- Effet : classe CSS « rouge ».
- Statuts concernés : n/a
- Profils : tous.
- Source : BLL/ReceptionListeAfficheBll.cs:942, 984, 1022, 1061 ; SP/p_s_affiche_a_fusionner.sql:42 (`DATEADD(DAY, conservation, date_entree)`).
- Confiance : PROBABLE (unité de `conservation` : semaines vs jours — à trancher)

### RG-REC-011 (provisoire) — Statistiques du cadre « Résultat »
- Description : nb lignes, nb d'affiches (somme des quantités des lignes non rebus), nb d'affiches au rebus (somme des quantités des lignes rebus), calculés sur les données filtrées de la grille.
- Déclencheur : Read de la grille.
- Conditions : `data.Count > 0`.
- Effet : objet `Stat` porté par la première ligne.
- Statuts concernés : n/a
- Profils : tous.
- Source : BLL/ReceptionListeAfficheBll.cs:127-144 ; CTRL/ReceptionListeAfficheController.cs:101-104.
- Confiance : CERTAINE

### RG-REC-012 (provisoire) — Accès « drill-down » depuis un dossier (cache AffichesPreparation)
- Description : si `cont_num > 0`, la grille ignore les filtres Kendo et lit le cache applicatif `AffichesPreparation` (liste pré-chargée par un autre écran), filtre sur dossier + sup_id + nom de plateforme normalisé (contient dans un sens ou l'autre). Une action `ListeAffiches(dossier, semaine, site, surface, sup_id, annee)` ouvre la liste dans ce mode. Si le cache est absent, `temp` reste null → `ToDataSourceResult` plante.
- Déclencheur : navigation depuis un autre écran (probablement Suivi / Etat des réservations).
- Conditions : `cont_num > 0`, cache existant.
- Effet : liste restreinte au dossier.
- Statuts concernés : n/a
- Profils : tous.
- Source : CTRL/ReceptionListeAfficheController.cs:47-63, 66-111 ; BLL/ReceptionListeAfficheBll.cs:924-928 ; TOOLS/Constant/Constants.cs:21.
- Confiance : INCERTAINE (qui alimente le cache `AffichesPreparation` ? non localisé ; `p_GetListeAfficheParDossierReservation` non lue)

### RG-REC-013 (provisoire) — Action par ligne de la liste
- Description : boutons Modifier / Ajouter / Sortir / Mettre au rebus / Imprimer sur chaque ligne (hors liste Fusionnées → Modifier seulement). Aucun masquage selon le statut (une affiche déjà au rebus conserve les boutons Ajouter/Sortir).
- Déclencheur : rendu grille.
- Conditions : `resultatSelected != 3`.
- Effet : ouvre popup (mode Modification/Ajout/Sortie) ou lance action.
- Statuts concernés : tous.
- Profils : tous (aucun contrôle de droit).
- Source : VIEW/ReceptionListeAffiche/Index.cshtml:152-169.
- Confiance : CERTAINE

### RG-REC-014 (provisoire) — Fusion depuis la liste : visible seulement avec le droit `fusion_affiche` en liste « À traiter »
- Description : colonne case à cocher « Fusion » et bouton « Fusionner » affichés si droit `fusion_affiche` ET `resultatSelected == 1`. Case affichée seulement si `theme != null`.
- Déclencheur : rendu écran.
- Conditions : droit + liste À traiter.
- Effet : sélection multiple pour fusion (RG-REC-060).
- Statuts concernés : n/a
- Profils : droit `fusion_affiche`.
- Source : VIEW/ReceptionListeAffiche/Index.cshtml:99-104, 117-123.
- Confiance : CERTAINE (UI uniquement ; voir RG-REC-121 pour l'absence de contrôle serveur)

---

# B. RÈGLES — DÉTAIL / MOUVEMENTS D'UNE AFFICHE

### RG-REC-020 (provisoire) — Création manuelle d'une réception (mode Création)
- Description : crée une `affiche` (rebus=false, date_derniere_sortie=null, quantité = quantiteSaisie) puis un `mouvement` initial (récépissé, expéditeur) et éventuellement une `photo`. Deux `SaveChanges` successifs sans transaction.
- Déclencheur : POST `AfficheCreerAjouterMajSortie` avec `mode=Creation`.
- Conditions : aucune contrainte métier (pas de champ obligatoire).
- Effet : insertions `affiche`, `mouvement`. Le mouvement initial prend `model.quantite`, propriété calculée en lecture seule (somme de `mouvements`, null → 0) : donc **quantité du mouvement = 0** alors que `affiche.quantite = quantiteSaisie`. Aucun historique `CreationAffiche` écrit dans cette voie.
- Statuts concernés : ∅ → « Réceptionnée ».
- Profils : aucun contrôle.
- Source : BLL/ReceptionListeAfficheBll.cs:756-798 ; REPO/ReceptionListeAfficheRepository.cs:86-114 ; MODEL/ReceptionListeAfficheModel.cs:211-215 ; CTRL/ReceptionListeAfficheController.cs:119-128.
- Confiance : INCERTAINE — la voie est probablement morte : (1) aucun bouton « Créer » dans `Index.cshtml` ; (2) le contrôleur lit `bll.GetAfficheById(model.affiche_id).validationAdmin` (affiche_id=0 ⇒ NullReference) avant d'appeler la BLL (CTRL:177).

### RG-REC-021 (provisoire) — Ajout de quantité (mode Ajout)
- Description : `affiche.quantite += quantiteSaisie` et création d'un `mouvement` (+quantité, récépissé, expéditeur).
- Déclencheur : bouton « Ajouter » (+), POST mode Ajout.
- Conditions : aucune validation (quantité 0 ou négative acceptée ; pas de test > 0).
- Effet : mouvement positif ; `user_maj`, `date_maj` mis à jour.
- Statuts concernés : inchangés (une affiche rebutée peut recevoir un ajout).
- Profils : aucun contrôle.
- Source : BLL/ReceptionListeAfficheBll.cs:800-835 (812-818) ; REPO/ReceptionListeAfficheRepository.cs:147-165.
- Confiance : CERTAINE (comportement) ; l'absence de contrôle > 0 peut être compensée par le JS non fourni (INCERTAINE).

### RG-REC-022 (provisoire) — Sortie de stock (mode Sortie)
- Description : `affiche.quantite -= quantiteSaisie`, `date_derniere_sortie = now`, mouvement négatif (−quantité), récépissé = « Sortie », expéditeur null.
- Déclencheur : bouton « Sortir » (−).
- Conditions : aucun contrôle de stock suffisant ⇒ quantité négative possible.
- Effet : mouvement négatif.
- Statuts concernés : inchangés.
- Profils : aucun contrôle.
- Source : BLL/ReceptionListeAfficheBll.cs:819-827 ; const `LibelleRecepisseSortie` : BLL/ReceptionListeAfficheBll.cs:22.
- Confiance : CERTAINE

### RG-REC-023 (provisoire) — Double source de quantité (dénormalisation)
- Description : `affiche.quantite` (champ) et `SUM(mouvement.quantite)` coexistent. Les listes et l'édition picking utilisent la somme des mouvements ; la destruction (`p_s_destruction`) utilise `affiche.quantite` ; le vidage du rebus met `affiche.quantite = 0` mais crée un mouvement de −SUM(mouvements). Création/modification de livraison écrasent `affiche.quantite` (non cumulée) tandis que le mouvement s'ajoute (voir RG-REC-074/078).
- Déclencheur : tous les flux de quantité.
- Conditions : n/a
- Effet : divergences possibles entre les deux sources.
- Statuts concernés : n/a
- Profils : n/a
- Source : SP/p_GetListeAffiche.sql:100-109 ; SP/p_s_destruction.sql:19 ; BLL/ReceptionListeAfficheBll.cs:311-321 ; BLL/LivraisonAfficheService.cs:484-485, 787.
- Confiance : CERTAINE (faits) / à trancher sur la source de vérité.

### RG-REC-024 (provisoire) — Modification d'une affiche : champs éditables et historisation
- Description : modifiables : format (sup_id), commentaire, dossier (cont_num), annonceur, semaines, nombre_semaine, thème, repiquage, conservation, date_dernier_depart, allée, rayon, validationAdmin, zone_Picking, a_conserver, photo. Non modifiables : date d'entrée, quantité, rebus, date de dernière sortie (commentaire de code). Historique `histo_historique_entite` écrit pour : dossier, semaines, annonceur, thème, format, validationAdmin, a_conserver. Pas d'historique pour conservation/allée/rayon/zone_Picking/date_dernier_depart/commentaire. Anomalie : le changement de `semaines` est historisé avec l'action `ModificationDossierAffiche` (et non `ModificationSemaineAffiche`).
- Déclencheur : POST `AfficheCreerAjouterMajSortie` mode Modification.
- Conditions : aucune contrainte de statut (une affiche rebutée ou fusionnée est modifiable côté serveur).
- Effet : `MajAffiche` + historiques ; photo créée/remplacée.
- Statuts concernés : inchangés.
- Profils : le serveur n'impose aucun droit (voir RG-REC-027/029).
- Source : BLL/ReceptionListeAfficheBll.cs:837-889 (852-869) ; BLL/HistorisationBll.cs:16-38 (ligne 22 = anomalie) ; REPO/ReceptionListeAfficheRepository.cs:172-213.
- Confiance : CERTAINE

### RG-REC-025 (provisoire) — Modification d'une affiche orpheline : régénération de tf_dossier_semaine_depart
- Description : après modification, si l'affiche est orpheline, ses lignes `tf_dossier_semaine_depart` sont supprimées puis recréées à partir de `cont_num` + `semaines`. L'année de chaque semaine = année courante, ou +1 si n° de semaine < semaine courante.
- Déclencheur : modification (RG-REC-024).
- Conditions : aucune prépa avec `affiche_livraison_Id = affiche_id`.
- Effet : delete + insert `tf_dossier_semaine_depart`. `cont_num` doit être découpé sur '+', `semaines` sur '+' puis '/' pour chaque dossier ; lève si cont_num null avec semaines non null (StringWithoutSpace(null)). Variante ancienne `ConvertInfoDossierADossierSemaineDepart` (format « dossier S41 ») : présente, non utilisée ici.
- Statuts concernés : n/a
- Profils : n/a
- Source : BLL/ReceptionListeAfficheBll.cs:881-887 ; BLL/LivraisonAfficheService.cs:1049-1081 (année: 1071), 1084-1123 (ancienne version, `<=`) ; REPO/LivraisonAfficheRepository.cs:577-588, 597-601.
- Confiance : CERTAINE

### RG-REC-026 (provisoire) — Validations de saisie dossier / semaines (back, modes Modification/Ajout/Sortie)
- Description :
  1. chaque dossier (séparés par '+') = exactement 6 chiffres (`^[0-9]{6,6}$`) ;
  2. chaque semaine (séparées par '+' ou '/') = `S` ou `s` + 2 chiffres ;
  3. si dossier ET semaines : nombre de blocs semaines (split '+') = nombre de dossiers (split '+') ;
  4. si `nombre_semaine` renseigné et semaines renseignées : `nombre_semaine` = nombre d'éléments de `semaines` (split '+' ou '/') ;
  5. `nombre_semaine` sans semaines → erreur ; semaines sans `nombre_semaine` → erreur.
  Retour : message texte via `Json(...)` (HTTP 200) — le front doit distinguer message vs succès (le succès renvoie `null`).
- Déclencheur : « Enregistrer » dans la popup détail.
- Conditions : voir ci-dessus.
- Effet : refus d'enregistrement avec les messages :
  - « Attention, votre format de saise de dossier est inccorect. Exemple format attendue "100000+120000" »
  - « Attention, votre format semaine est inccorect. Exemple format attendue "S41/S42+S41/S42" »
  - « Attention, le nombre de dossier ne correspond pas aux semaines »
  - « Attention, le nombre de semaine ne correspond pas aux semaines »
- Statuts concernés : n/a
- Profils : n/a
- Source : CTRL/ReceptionListeAfficheController.cs:136-173 ; TOOLS/Helper/ReggexMatchForRule.cs:12-13, 36-47 ; TOOLS/Constant/Constants.cs:31-35 ; front (`ValidateDetailAffiche`, `Scripts/site/*.js`) : non fourni dans le dépôt.
- Confiance : CERTAINE côté back ; front INCONNU (fichiers JS `Scripts/site/` absents).

### RG-REC-027 (provisoire) — « Validation Admin » : droit côté UI uniquement, alerte non bloquante
- Description : la case « Validation Admin » (et « Affiche à conserver ») n'est affichée qu'avec le droit `validation_admin`, désactivée si l'affiche est fusionnée. À la coche, une alerte (non bloquante) « La quantité reçue ne correspondent pas à la quantité BC » s'affiche si quantité CIRCE < quantité BC. Côté serveur : `validationAdmin`, `aConserver`, `zone_Picking` du formulaire sont écrits sans vérifier le droit (champ caché `validationAdmin` posté).
- Déclencheur : détail affiche, mode Modification.
- Conditions : droit `validation_admin` (UI) ; qté CIRCE < qté BC (alerte).
- Effet : `affiche.validationAdmin` ; historique `ModificationValidationAdmin` ; conditionne impression étiquette (RG-REC-028), l'état « à traiter » (RG-REC-005), l'édition picking (RG-REC-101) et l'export PEX (RG-REC-111).
- Statuts concernés : « non validée » → « validée » (et inverse possible : décocher autorisé).
- Profils : `validation_admin`.
- Source : VIEW/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:24-39, 302-324 ; BLL/ReceptionListeAfficheBll.cs:867-869 ; BLL/HistorisationBll.cs:29-32.
- Confiance : CERTAINE (UI) / CERTAINE (absence de contrôle serveur)

### RG-REC-028 (provisoire) — Impression automatique d'étiquette rack à la validation
- Description : quand `validationAdmin` passe de non-coché (ou null) à coché, envoi d'une étiquette rack sur les imprimantes de la plateforme (si au moins une imprimante renseignée).
- Déclencheur : POST détail avec validationAdmin=true et ancienne valeur ≠ true.
- Conditions : `model.validationAdmin && ancien != model.validationAdmin` ; imprimantes `AdminPlateformeBll.GetListImprimantesParPlatforme(plt_id)` non vides.
- Effet : `Rapport.EditionEnvoyeEtiquetteRackAffiche` (échec non géré : exception après sauvegarde déjà faite).
- Statuts concernés : validation (voir RG-REC-027).
- Profils : n/a
- Source : CTRL/ReceptionListeAfficheController.cs:177, 189-192, 454-465.
- Confiance : CERTAINE

### RG-REC-029 (provisoire) — Zone picking (case) : droit côté UI uniquement
- Description : la case « zone Picking » n'est visible qu'avec le droit `Zone_Picking` (ou si fusionnée, désactivée). Écrite sans contrôle côté serveur. Les listes séparent zone picking / non picking (RG-REC-009).
- Déclencheur : détail affiche.
- Conditions : droit `Zone_Picking`.
- Effet : `affiche.zone_Picking`.
- Statuts concernés : Réceptionnée ↔ Picking.
- Profils : `Zone_Picking`.
- Source : VIEW/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:256-265 ; BLL/ReceptionListeAfficheBll.cs:868.
- Confiance : CERTAINE

### RG-REC-030 (provisoire) — Affiche fusionnée en lecture seule (UI uniquement)
- Description : pour une affiche fusionnée, tous les champs sont en affichage seul et le bouton « Enregistrer » est masqué. Aucun contrôle équivalent côté serveur.
- Déclencheur : ouverture détail d'une affiche présente comme cible dans `fusion_affiche` (`estAfficheFusionnee`).
- Conditions : `fusion_affiche.id_affiche == affiche_id` (la cible, pas le chapeau).
- Effet : lecture seule.
- Statuts concernés : Fusionnée (cible).
- Profils : n/a
- Source : BLL/ReceptionListeAfficheBll.cs:223 ; VIEW/Shared/DetailAffiche/_DetailAffiche.cshtml:270-276 ; Partial_ModifierDetailsAffiche.cshtml (multiples `estAfficheFusionnee`).
- Confiance : CERTAINE

### RG-REC-031 (provisoire) — Conservation : valeur par défaut
- Description : à l'ouverture, `conservation = affiche.conservation` si > 0, sinon 20. Côté JS, vider le champ le remet à 0. La colonne `affiche.conservation` est NOT NULL sans défaut ; les affiches créées par livraison ne renseignent pas `conservation` (donc 0).
- Déclencheur : ouverture détail ; saisie.
- Conditions : `conservation > 0`.
- Effet : valeur affichée 20 par défaut (non persistée sauf si on enregistre).
- Statuts concernés : n/a
- Profils : n/a
- Source : BLL/ReceptionListeAfficheBll.cs:213 ; Partial_ModifierDetailsAffiche.cshtml:326-338 ; BDD/DATABASE/DATABASE/dbo/Tables/affiche.sql:12 ; BLL/LivraisonAfficheService.cs:436-455 (pas de conservation).
- Confiance : PROBABLE (unité jours/semaines non établie, cf. RG-REC-010)

### RG-REC-032 (provisoire) — Date de dernier départ calculée sur les prépas associées
- Description : après association/dissociation de prépas, `affiche.date_dernier_depart` = vendredi de la (semaine max de l'année max) des prépas associées (hors FromBroadcast) ; null s'il n'y a plus de prépa. Dans l'écran détail, la date affichée est ensuite écrasée par la valeur stockée (`res.date_dernier_depart = aff.date_dernier_depart`), rendant le calcul `GetDateDernierDepart` sans effet. `GetDateDernierDepart` prend le max de la semaine et le max de l'année indépendamment (incohérent si prépas sur deux années).
- Déclencheur : association / dissociation (RG-REC-091/092) ; ouverture du détail.
- Conditions : prépas `affiche_livraison_Id = affiche_id` et `FromBroadcast` null/false.
- Effet : `UPDATE affiche.date_dernier_depart`.
- Statuts concernés : n/a
- Profils : n/a
- Source : BLL/ReceptionListeAfficheBll.cs:557-575, 594-609, 211, 221 ; REPO/ReceptionListeAfficheRepository.cs:596-605.
- Confiance : CERTAINE

---

# C. RÈGLES — REBUS ET DESTRUCTION

### RG-REC-040 (provisoire) — Mise au rebus d'une affiche
- Description : l'affiche et toutes les affiches dont elle est chapeau de fusion sont marquées `rebus = true`, `date_rebus = now` ; un historique `AfficheMiseEnRebus` est écrit par affiche. La quantité n'est pas modifiée. Aucune confirmation côté serveur, aucune vérification de statut (une affiche déjà rebutée est re-datée) ni de droit.
- Déclencheur : bouton « Mettre au rebus » de la ligne (paramètre `est_fusionneHtml` transmis au JS, logique front inconnue).
- Conditions : aucune.
- Effet : `UPDATE affiche SET rebus=1, date_rebus=now` (boucle, un SaveChanges par affiche via `MajAffiche`) ; historique.
- Statuts concernés : « Réceptionnée/Picking » → « Au rebus » (rebus=true).
- Profils : aucun contrôle.
- Source : BLL/ReceptionListeAfficheBll.cs:271-289 ; REPO/ReceptionListeAfficheRepository.cs:615-622 ; VIEW/ReceptionListeAffiche/Index.cshtml:159 ; CTRL/ReceptionListeAfficheController.cs:259-270.
- Confiance : CERTAINE (back) ; confirmation front INCONNUE.

### RG-REC-041 (provisoire) — Vidage du rebus d'une plateforme
- Description : pour la plateforme sélectionnée, toutes les affiches `rebus = true` dont la somme des mouvements > 0 : `affiche.quantite = 0`, création d'un mouvement négatif (−SUM(mouvements)) avec récépissé « Vidage du rebus », historique `ViderRebus`. Le flag `rebus` reste vrai (l'affiche reste dans la liste Rebus avec quantité 0). L'historique est ajouté en base AVANT la mise à jour des quantités (pas de transaction).
- Déclencheur : bouton « Vider le rebus » + confirmation JS « Confirmez-vous le vidage du rebus ? ».
- Conditions : `plt_id` ; `rebus == true` ; `SUM(mouvement.quantite) > 0`.
- Effet : mouvements négatifs ; `user_maj/date_maj`.
- Statuts concernés : « Au rebus (stock>0) » → « Au rebus (stock=0) ».
- Profils : aucun contrôle.
- Source : BLL/ReceptionListeAfficheBll.cs:297-325 (322-324 : ordre historique/maj) ; REPO/ReceptionListeAfficheRepository.cs:220-258 ; VIEW/ReceptionListeAffiche/Index.cshtml:86-94.
- Confiance : CERTAINE

### RG-REC-050 (provisoire) — Écran « Etat de destruction » : sélection des affiches
- Description : `p_s_destruction` retourne les affiches telles que :
  `(date_dernier_depart < now − 4 semaines AND a_conserver = 1 AND date_entree < now − 365 jours) OR (date_dernier_depart < now − 4 semaines AND (a_conserver = 0 OR null) AND plt_id = @plt_id AND rebus != 0)`.
  À cause de la précédence AND/OR, la 1re branche ignore le filtre plateforme et le filtre rebus ; la 2e exige `rebus != 0` (donc rebus = 1 uniquement, NULL exclu). Si `@historique = 1`, filtre supplémentaire `date_entree BETWEEN début et fin`. Quantité = `affiche.quantite` (pas la somme des mouvements). Date de destruction = `date_rebus`.
- Déclencheur : écran Destruction (POST Read).
- Conditions : voir ci-dessus. Période par défaut : fin = maintenant, début = −1 mois −1 jour.
- Effet : liste + total d'affiches (somme des quantités) sur la première ligne ; export Excel côté client.
- Statuts concernés : « Au rebus » + « à conserver » périmées.
- Profils : accès via menu « Suivi » (droit `suivi_suivi_production`) — voir RG-REC-120.
- Source : SP/p_s_destruction.sql:12-39 ; BLL/DestructionBll.cs:16-26, 38-65 ; CTRL/DestructionController.cs:37-57 ; VIEW/Destruction/Index.cshtml:37-44.
- Confiance : CERTAINE (SP) ; bug de précédence : PROBABLE (intention : 3 conditions communes AND).

### RG-REC-051 (provisoire) — Colonne « Statut » = « C » (à conserver > 1 an)
- Description : `Statut = "C"` si `a_conserver = true` et âge depuis `date_entree` > 356 jours (valeur 356, vs 365 dans la SP) ; sinon vide.
- Déclencheur : lecture écran Destruction.
- Conditions : a_conserver, `(now − date_entree).TotalDays > 356`.
- Effet : marqueur « C ».
- Statuts concernés : n/a
- Profils : n/a
- Source : BLL/DestructionBll.cs:58 ; SP/p_s_destruction.sql:29.
- Confiance : CERTAINE (356 vs 365 : probable coquille)

### RG-REC-052 (provisoire) — Marquage « détruit » depuis l'écran Destruction
- Description : `UpdateStatutRebus(idAffiche)` fixe `rebus = true`, `date_rebus = now` pour l'affiche cochée, sans historique, sans traiter les affiches fusionnées liées, sans test d'existence (NullReference interceptée → `Success=false`), retourne la date du jour. Case « Rebus » (checkbox `MajSelection`) côté grille ; logique JS inconnue.
- Déclencheur : case « Rebus » de la grille Destruction.
- Conditions : aucune.
- Effet : `affiche.rebus=1`, `date_rebus=now`.
- Statuts concernés : « Réceptionnée/Picking » → « Au rebus ».
- Profils : aucun contrôle.
- Source : CTRL/DestructionController.cs:59-65 ; BLL/DestructionBll.cs:81-92 ; REPO/DestructionRepository.cs:29-36 ; VIEW/Destruction/Index.cshtml:37.
- Confiance : PROBABLE (liaison JS non vue)

---

# D. RÈGLES — FUSION

### RG-REC-060 (provisoire) — Fusion manuelle depuis la liste : contrôle préalable
- Description : sélection de ≥ 2 affiches (liste « À traiter »). `CheckFusionAffiche` : (a) thèmes tous identiques sinon « les affiches n'ont pas le même thèmes » ; (b) chaque affiche doit avoir au moins un dossier de l'union (toujours vrai sauf affiche sans `tf_dossier_semaine_depart`) sinon « les affiches n'ont pas le même dossier » ; (c) idem semaines/année sinon « les affiches n'ont pas les mêmes semaines ». Les contrôles (b)/(c) ne vérifient donc pas l'égalité réelle. Aucun contrôle de plateforme, de format (`sup_id`), de rebus, de déjà-fusionnée, ni de nombre minimum d'ids.
- Déclencheur : bouton « Fusionner » (POST `ReceptionListeAffiche/Fusionner`).
- Conditions : voir ci-dessus.
- Effet : si message vide → fusion (RG-REC-062) avec chapeau = plus petit `affiche_id` ; sinon renvoie le message (HTTP 200). Toute exception renvoie `ex.Message`.
- Statuts concernés : « à traiter » → « Fusionnée ».
- Profils : droit `fusion_affiche` (UI seule).
- Source : CTRL/ReceptionListeAfficheController.cs:424-452 ; BLL/ReceptionListeAfficheBll.cs:1111-1134.
- Confiance : CERTAINE

### RG-REC-061 (provisoire) — Fusion « non homogène » (choix thème/allée/rayon/repiquage)
- Description : popup proposant les listes distinctes de thèmes, allées, rayons et repiquages des affiches sélectionnées ; `EstDoitSelectionnerRepiquage` vrai si > 1 repiquage non vide distinct. Au POST, le thème choisi est appliqué à TOUTES les affiches mises à jour (chapeau + cibles) — y compris null si non fourni — ; allée/rayon/repiquage ne sont écrasés que si fournis.
- Déclencheur : action `_FusionNonHomogene` puis `FusionNonHomogene`.
- Conditions : chapeau = min(ids), cibles = les autres (`Skip(1)`).
- Effet : fusion avec `ParamFusionNonHomogene`. Erreur `DbEntityValidationException` → « Une erreur est survenue, merci de contacter le support » ; autres exceptions non interceptées.
- Statuts concernés : « à traiter » → « Fusionnée ».
- Profils : droit `fusion_affiche` (UI seule).
- Source : CTRL/ReceptionListeAfficheController.cs:496-538 ; BLL/FusionAfficheBll.cs:236-245 ; VIEW/ReceptionListeAffiche/_FusionNonHomogene.cshtml.
- Confiance : CERTAINE (back) ; l'enchaînement front (quand la popup est proposée) INCERTAIN (JS absent).

### RG-REC-062 (provisoire) — Effets d'une fusion (chapeau / cibles)
- Description :
  - Chapeau : `est_fusionne = true` ; `validationAdmin` = OU logique ; `commentaire` = commentaire chapeau + commentaires cibles joints par « / » (sans séparateur entre le premier et la jointure) ; `quantite` = chapeau + Σ cibles ; `conservation` = max ; `a_conserver` = OU ; `cont_num` et `semaines` recalculés à partir de `tf_dossier_semaine_depart` (dossiers joints par « / », semaines jointes par « + » puis « / ») si des dossier/semaines manquants sont ajoutés.
  - Cibles : tous leurs `mouvement` sont dupliqués sur le chapeau (`id_affiche_initial` = cible) ; leurs `tf_prepa_affiche.affiche_livraison_Id` → chapeau (+ `affiche_livraison_initial_Id`) ; `asso_livraison_affiche.Id_affiche_livraison` → chapeau (+ `id_affiche_initial_livraison`) ; `Activite.IdAffiche` → chapeau (+ `id_affiche_initial`) ; lignes `tf_dossier_semaine_depart` manquantes copiées vers le chapeau. Les cibles gardent leur quantité, leurs mouvements d'origine et ne sont pas rebutées.
  - Ligne `fusion_affiche(id_affiche_chapeau, id_affiche, qui_creation, date_creation)` par cible.
  - Quatre `SaveChanges` indépendants (mise à jour affiches/prépas/asso/activités ; dssd ; mouvements ; fusion_affiche) sans transaction. Pas d'historique `histo_historique_entite`.
- Déclencheur : RG-REC-060, 061, 063.
- Conditions : au moins une cible trouvée.
- Effet : voir ci-dessus.
- Statuts concernés : cibles : « Réceptionnée » → « Fusionnée (cible) » ; chapeau : « Réceptionnée » → « Chapeau (est_fusionne) ».
- Profils : n/a
- Source : BLL/FusionAfficheBll.cs:61-123, 125-234 ; REPO/FusionAfficheRepository.cs:26-47.
- Confiance : CERTAINE

### RG-REC-064 (provisoire) — RISQUE : le chapeau est inclus dans ses propres cibles (fusion manuelle depuis la liste)
- Description : `ReceptionListeAfficheController.Fusionner` construit `IdAfficheCible = ids.OrderBy(x=>x).Skip(0)` (donc inclut le chapeau), alors que `FusionNonHomogene` (`Skip(1)`) et l'écran Fusion (cibles seules) excluent le chapeau. Dans ce cas `FusionAffiche` traite le chapeau comme sa propre cible : quantité doublée, mouvements du chapeau dupliqués, `fusion_affiche(chapeau, chapeau)` créé, donc le chapeau est masqué des listes Tous/À traiter/Rebus (join `fusion.id_affiche is null`) et apparaît en « Fusionnées ».
- Déclencheur : « Fusionner » (homogène) depuis la liste.
- Conditions : toujours sur ce chemin.
- Effet : voir description (à valider par test).
- Statuts concernés : n/a
- Profils : droit `fusion_affiche`.
- Source : CTRL/ReceptionListeAfficheController.cs:435-440 (`Skip(0)`) vs :521 (`Skip(1)`) ; BLL/FusionAfficheBll.cs:85-103 ; SP/p_GetListeAffiche.sql:90, 95.
- Confiance : INCERTAINE (lecture de code ; comportement réel en prod à vérifier — à ne pas reproduire sans décision)

### RG-REC-063 (provisoire) — Écran « Fusion des affiches » : propositions automatiques
- Description : l'utilisateur choisit site, année, semaine début/fin (défaut : semaine suivante, début = fin − 5). La grille n'utilise que `SemaineFin` + `Annee` (début ignoré, recalculé en SP à fin−5). `p_s_affiche_a_fusionner` propose les groupes : affiches de la plateforme, non déjà fusionnées, non « à conserver » (effet des jointures), avec au moins une ligne `tf_dossier_semaine_depart` dont (thème, plateforme, sup_id, dossier, semaine, année) est commune à ≥ 2 affiches ; dont la semaine max de départ ∈ [semaine−5, semaine] (gestion année précédente approximative `52 − (5 − semaine)` ; test `< 0` au lieu de `<= 0`) ; fin de conservation (`date_entree + conservation` jours) à partir de l'année N−2. Chapeau = MIN(affiche_id) du groupe. La grille affiche les cibles regroupées sous « Affiche Chapeau numéro X - thème Y ».
- Déclencheur : écran FusionAffiche / bouton Fusionner.
- Conditions : thème non nul ; semaine de départ non nulle.
- Effet : à la validation, `Fusionner(ids "cible chapeau")` → `FusionAffiche` (RG-REC-062) ; message « La fusion a été effectuée avec succes ! » ; seules les `ApplicationException` sont interceptées. Un chapeau avec plusieurs cibles est regroupé par `IdAffiche`.
- Statuts concernés : « à traiter/Réceptionnée » → « Fusionnée ».
- Profils : droit `fusion_affiche` (menu).
- Source : BLL/FusionAfficheBll.cs:18-59 ; CTRL/FusionAfficheController.cs:21-86 (Read :50 n'utilise pas SemaineDebut) ; SP/p_s_affiche_a_fusionner.sql:19-37, 40-77, 111-127, 160-179 ; VIEW/Shared/_MenuNew.cshtml:133-136.
- Confiance : CERTAINE (code) ; sémantique des « 5 semaines » PROBABLE.

---

# E. RÈGLES — RÉCEPTION DES AFFICHES (livraisons)

### RG-REC-070 (provisoire) — Deux listes : « À réceptionner » et « Livraisons », période en semaines
- Description : l'écran propose deux vues (`ListToDisplayId`) : 0 = prépas à réceptionner (`p_GetPrepareListAffiches`), 1 = livraisons déjà saisies (`p_GetPrepareListLivraison`). Période par défaut : semaine courante → +8 semaines (rollover d'année géré avec 52/53 semaines). Validation de recherche : si semaine fin ≥ semaine début, ou année fin > année début → OK ; sinon erreurs « La date de début doit être renseigné » / « La date de fin doit être renseigné » / « La date de fin doit être postérieur à la date de début » (le test accepte l'égalité alors que le message dit « postérieur »).
- Déclencheur : écran « Réception des affiches ».
- Conditions : voir ci-dessus.
- Effet : lignes ; la liste 0 exclut les prépas déjà dans le « panier » (session).
- Statuts concernés : prépa « à réceptionner » ↔ « reçue ».
- Profils : droit `reception_liste_affiche` (menu).
- Source : BLL/LivraisonAfficheService.cs:52-83, 216-227, 247-272 ; CTRL/LivraisonAfficheController.cs:52-83, 97-128 ; VIEW/Shared/_MenuNew.cshtml:122-128.
- Confiance : CERTAINE

### RG-REC-071 (provisoire) — Définition des prépas « à réceptionner » (Fn_GetPrepaAffiche)
- Description : (1) prépas de la plateforme et de la plage de semaines avec `ARecevoir = 0/null` ET non associées à une affiche ; (2) prépas déjà associées à une affiche avec des mouvements, `ARecevoir = 0/null`, dont `Qte_Theorique > SUM(mouvement.quantite)` (réception partielle). Mode livraison (`@isLivraison=1`) : prépas `ARecevoir=1` rattachées à une livraison dont la date ∈ période. Les formats « 2m2 Scrolling »/« 2m2 Venusial » sont renommés « 2m2 » ; regroupement par (n° livraison, dossier, format, thème, annonceur, semaine, année) avec `SUM(distinct Qte_Theorique)` et `Count(NULLIF(FromBroadcast,0))`. La liste « Livraisons » ajoute les affiches « orphelines » (`p_GetDataReceptionOrpheline`, créées dans la période, sans prépa, avec livraison + mouvement).
- Déclencheur : lecture des deux grilles.
- Conditions : voir ci-dessus.
- Effet : lignes proposées à la réception.
- Statuts concernés : prépa : à recevoir → reçue (`ARecevoir=1`).
- Profils : n/a
- Source : FN/Fn_GetPrepaAffiche.sql:44-103, 106-221, 224-343 ; SP/p_GetPrepareListAffiches.sql:104-161 ; SP/p_GetPrepareListLivraison.sql:112-130, 181-330 ; SP/p_GetDataReceptionOrpheline.sql:23-52.
- Confiance : CERTAINE

### RG-REC-072 (provisoire) — « Panier » de lignes sélectionnées (session)
- Description : `AjouterPanier` empile les lignes sélectionnées en session ; `Read` retire de la liste les `tf_prepa_affiche_Id` déjà au panier ; `DeletePanier` vide ; vidé après validation d'une livraison. Pas de dédoublonnage à l'ajout.
- Déclencheur : boutons d'ajout au panier / annulation.
- Conditions : session.
- Effet : `ManageObjectInSessionHelper.SetAfficheSelectedSession`.
- Statuts concernés : n/a
- Profils : n/a
- Source : CTRL/LivraisonAfficheController.cs:107-111, 251, 294, 459-479.
- Confiance : CERTAINE

### RG-REC-073 (provisoire) — Trois modes de création de livraison
- Description : popup de création déterminée par le panier : (a) panier vide → livraison « orpheline » (saisie libre des lignes, bouton `ValiderLivraisonOrpheline`) ; (b) lignes avec `affiche_id ≠ 0` (affiche existante, « édition ») et/ou `affiche_id = 0` (« création » d'affiche) → livraison à partir de prépas ; (c) au moins une ligne `FromBroadcast` → grille BC saisie manuellement (`listAssoc_livraison_AfficheModel`).
- Déclencheur : bouton « Créer une livraison » (`/LivraisonAffiche/Creation`).
- Conditions : contenu du panier.
- Effet : `PrepareAffichesEditions` / `PrepareAffichesCreations` / grille ; pour `PrepareAffichesEditions`, `cont_num` est remplacé par le dossier de la ligne si absent ou composé (contient « + » ou « / »).
- Statuts concernés : n/a
- Profils : n/a
- Source : CTRL/LivraisonAfficheController.cs:130-206 ; BLL/LivraisonAfficheService.cs:287-340.
- Confiance : CERTAINE

### RG-REC-074 (provisoire) — Validation de l'en-tête de livraison
- Description : date de livraison valide (> MinValue) sinon « La date de livraison n'est pas valide » ; référence (BL) obligatoire « Il faut renseigner la réference » ; expéditeur obligatoire « Il faut vérifier l'expéditeur » ; imprimeur obligatoire « Il faut vérifier l'imprimeur ». Pas de contrôle d'unicité de la référence. La création automatique d'un expéditeur/imprimeur inconnu est inopérante : la condition `Expediteurs == null && !(…).Any(…)` ne peut jamais être vraie sans exception (liste rechargée si cache vide) ; `CreateNewExpediteur/Imprimeur` n'est appelée nulle part ailleurs. Résultat : la saisie libre n'enrichit pas `tr_transposteur_reception` / `tr_imprimeur`.
- Déclencheur : `ValiderLivraison`, `ValiderLivraisonOrpheline`.
- Conditions : voir ci-dessus. Erreurs renvoyées en `ModelStateDictionary` (clés `DateLivraison`, `Reference`, `Expediteur`, `Imprimeur`).
- Effet : refus (le JS affiche le message en tooltip sur `#spn<clé>`).
- Statuts concernés : n/a
- Profils : n/a
- Source : CTRL/LivraisonAfficheController.cs:396-447 (430, 440) ; JS/LivraisonListeAffiche.js:160-168, 211-217 ; BLL/LivraisonAfficheService.cs:852-862.
- Confiance : CERTAINE

### RG-REC-075 (provisoire) — Création d'une livraison depuis prépas / BC
- Description : en tête : validation dossier/semaines uniquement si au moins une ligne renseigne `semaines` ou `nombre_semaine` (mêmes règles que RG-REC-026, dossier = `patternDossier` 6 chiffres). Puis pour chaque ligne :
  - **Prépa trouvée, `affiche_id ≤ 0`** : création d'une affiche (plt/sup issus de la prépa, `date_entree = date de livraison`, annonceur, dossier, thème = saisi sinon thème prépa, repiquage « » par défaut, `quantite = SaisieQte_Rec = quantité saisie`, `Description`, GUID) ; `tf_prepa_affiche.affiche`/`ARecevoir=true` ; propagation de l'affiche et `ARecevoir=true` + `dateModified` à TOUTES les prépas de même (dossier, format, annonceur, thème, plateforme, semaine, année) — sans filtre sur une association préexistante (peut ré-associer des prépas déjà liées à une autre affiche) — et, si format ∈ {2m2, 2 m2, 2m2 Scrolling, 2m2 Venusial}, à toutes les prépas 2m2 du même dossier/annonceur/thème/plateforme/semaine ;
  - **Prépa trouvée, `affiche_id > 0`** : affiche existante : `quantite` et `SaisieQte_Rec` REMPLACÉS par la quantité saisie (non cumulés) ;
  - **Prépa non trouvée (BC manuel)** : création d'affiche à partir de la ligne (sup_id par nom de format ; `GetFormatId` renvoie 0 si inconnu ⇒ violation FK probable) ; mêmes dates.
  Chaque ligne crée `asso_livraison_affiche` avec `NumeroLivraison = nb d'associations de l'affiche + 1`. Historique `CreationAffiche` pour chaque affiche (y compris affiches existantes ré-associées).
- Déclencheur : « Valider » dans la popup de livraison (`ValiderLivraison`).
- Conditions : voir ci-dessus.
- Effet : insert `livraison`, `affiche`, `asso_livraison_affiche`, update `tf_prepa_affiche`, `histo_historique_entite`. Si erreur de validation : retourne une livraison vide et `messageErreur` ; le contrôleur poursuit tout de même (création de mouvements sur livraison vide, envoi du mail) — voir RG-REC-077.
- Statuts concernés : prépa : à recevoir → reçue ; affiche : ∅ → « Réceptionnée » ; orpheline → associée.
- Profils : n/a
- Source : BLL/LivraisonAfficheService.cs:399-530 (422-426, 436-478, 458-476, 490, 496-518, 522-527) ; REPO/LivraisonAfficheRepository.cs:263-270, 392-413.
- Confiance : CERTAINE

### RG-REC-076 (provisoire) — Création des mouvements de réception
- Description : après création/mise à jour de livraison, pour chaque ligne dont `SaisieQte_Rec > 0` : création d'un `mouvement` (quantité = SaisieQte_Rec, récépissé = imprimeur de la livraison, expéditeur = expéditeur, `comptee`, `livraison_id`), un `SaveChanges` par ligne. Les lignes ≤ 0 ne génèrent aucun mouvement.
- Déclencheur : `ValiderLivraison` / `ValiderLivraisonOrpheline` (création et modification).
- Conditions : `SaisieQte_Rec > 0`.
- Effet : insert `mouvement`.
- Statuts concernés : n/a
- Profils : n/a
- Source : CTRL/LivraisonAfficheController.cs:226-232, 257-263, 301-310 ; BLL/LivraisonAfficheService.cs:827-844 ; REPO/LivraisonAfficheRepository.cs:243-261.
- Confiance : CERTAINE

### RG-REC-077 (provisoire) — Effets de bord : e-mail de réception et erreur non bloquante
- Description : à la création d'une livraison (depuis prépas), un thread d'arrière-plan envoie un mail (liste d'adresses de la plateforme via `AdminPlateformeMailBll`, prépas associées, nom de plateforme) — uniquement si aucun thread d'envoi précédent n'est vivant (sinon aucun mail, silencieusement). Pour la livraison orpheline l'envoi est synchrone. Le mail est envoyé même si `messageErreur` est non vide pour la voie non orpheline ; le panier est vidé dans tous les cas pour une création. L'ID retourné est 0 pour une modification de livraison.
- Déclencheur : validation de livraison (création).
- Conditions : `livraison.Id ≤ 0`.
- Effet : `ToolBll.SendMail(...)`.
- Statuts concernés : n/a
- Profils : n/a
- Source : CTRL/LivraisonAfficheController.cs:221-250, 285-295 ; BLL/LivraisonAfficheService.cs:930-942.
- Confiance : CERTAINE (concurrence de threads : le test `ThreadCache == null || !IsAlive` peut perdre des mails)

### RG-REC-078 (provisoire) — Création d'une livraison « orpheline » (sans prépa)
- Description : mêmes validations d'en-tête et de semaines ; pour chaque ligne : création d'une affiche (allée, rayon, annonceur, dossier, format → sup_id par nom, plateforme, `quantite = SaisieQte_Rec`, repiquage « » par défaut, thème, nombre_semaine, semaines, `Comptee`) — **persistée immédiatement** (`Save()` dans `CreateAfficheOrpheline`) avant les contrôles de format dossier/semaines ; seule la livraison n'est pas enregistrée si erreur (commentaire « CLARK : Correction »). Contrôles : dossier = 6 chiffres (liste « + »), semaines = `S\d{2}` ; construction de `tf_dossier_semaine_depart` (année courante ou +1 si semaine < semaine courante) ; si aucun dossier/semaine exploitable → message dossier incorrect. Historique `CreationAffiche` pour chaque affiche, même en cas d'erreur.
- Déclencheur : `ValiderLivraisonOrpheline`.
- Conditions : voir ci-dessus.
- Effet : affiches orphelines éventuellement créées sans livraison en cas d'erreur (données résiduelles) ; mail ; panier vidé.
- Statuts concernés : ∅ → « Réceptionnée, orpheline ».
- Profils : n/a
- Source : BLL/LivraisonAfficheService.cs:532-624, 705-737, 1049-1081 ; CTRL/LivraisonAfficheController.cs:274-321.
- Confiance : CERTAINE

### RG-REC-079 (provisoire) — Modification d'une livraison existante
- Description : met à jour l'en-tête (référence, date, expéditeur, imprimeur, commentaire, nbre colis, ref dossier, ref DA, déchargé par) ; pour chaque affiche de la grille : `date_entree = date de livraison`, `quantite` REMPLACÉE par la quantité saisie, commentaire = `Description`, allée, rayon, repiquage ; les affiches retirées de la grille voient leur `asso_livraison_affiche` supprimée (l'affiche et ses mouvements restent). Puis le contrôleur crée un NOUVEAU mouvement pour chaque ligne `SaisieQte_Rec > 0` (risque de doublon de quantité à chaque modification). Aucune validation de dossier/semaines à la modification.
- Déclencheur : `ModifierLivraison` + `ValiderLivraison` (Id > 0).
- Conditions : `livraison.Id > 0`.
- Effet : voir ci-dessus.
- Statuts concernés : n/a
- Profils : n/a
- Source : BLL/LivraisonAfficheService.cs:763-803 ; CTRL/LivraisonAfficheController.cs:253-264, 323-372 ; REPO/LivraisonAfficheRepository.cs:152-166, 189-192, 207-214.
- Confiance : CERTAINE

### RG-REC-080 (provisoire) — Pièces jointes de livraison
- Description : upload d'un ou plusieurs fichiers → `photo` (intitulé, taille, extension) + fichier disque sous le dossier `DirectoryFilePieceJointeReception` nommé `<FileLivraisonPieceJointe>_<Ticks><ext>` + `asso_livraison_photo`. Téléchargement renvoyé en `application/pdf` quel que soit le type. Suppression : efface fichier + lignes `photo`/`asso_livraison_photo` seulement si le fichier existe sur disque. Aucune validation de type/taille/droits côté serveur.
- Déclencheur : popup de livraison (`CreatePieceJointe`, `Download`, `DeleteFileUploaded`).
- Conditions : `IdLivraisonPhoto` non null (sinon exception).
- Effet : fichiers + tables.
- Statuts concernés : n/a
- Profils : aucun contrôle.
- Source : CTRL/LivraisonAfficheController.cs:482-542 ; BLL/LivraisonAfficheService.cs:959-1026 ; REPO/LivraisonAfficheRepository.cs:470-551.
- Confiance : CERTAINE

### RG-REC-081 (provisoire) — Synchronisation des préparations Broadcast (BC) via Web API
- Description : appel HTTP GET `<WebApiUrl>/PrepaAfficheBC` (`Web.config` : `http://webapicirce/api/PrepaAfficheBC`) ; les données remplacent `tf_prepa_Broadcast` par `IdDossierDeVenteChapeau` (suppression puis insertion). `sup_id` via `Transaco_Surface_Format(IdSurface, IdFormat)`. `repiquage` = `Bandeau`. `GetPrepaBCStatut()` (rafraîchissement > 5 h) est calculé à l'ouverture de l'écran mais son résultat n'est pas utilisé.
- Déclencheur : action `GetPreparationBC` (appel JS, non vu) ; `BatchAlimGetInstructionBc` (autre batch).
- Conditions : `IsSuccessStatusCode`.
- Effet : `tf_prepa_Broadcast`.
- Statuts concernés : n/a
- Profils : n/a
- Source : BLL/LivraisonAfficheService.cs:867-926 ; REPO/LivraisonAfficheRepository.cs:304-361 ; CTRL/LivraisonAfficheController.cs:47, 449-457 ; circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/Web.config:52.
- Confiance : PROBABLE (déclencheur JS non vu)

### RG-REC-082 (provisoire) — Alimentation de `tf_prepa_affiche` (SP, planification non trouvée)
- Description : `p_Alimentation_tf_prepa_affiche` alimente les prépas à réceptionner sur la fenêtre [semaine courante ; +8 semaines] (gestion de fin d'année) à partir de `tf_repart_calcul` (statut `rpc_statut <> 4`, = Annulé), `tf_face_train` (idem, thème non nul) et `tf_prepa_Broadcast` (`StatutPreparation <> 'Envoyé'` ou null, hors destinataires « Plateforme Derichebourg Lyon » / « Plateforme Derichebourg ») ; ne recrée pas une prépa déjà présente ; positionne `ARecevoir = 1` sur les nouvelles prépas dont (dossier, support, semaine, plateforme, thème) ont déjà été reçues ; repasse `FromBroadcast = NULL` quand toutes les prépas d'une clé sont BC et qu'un équivalent existe en répartition/train (raccrochage IT-62066) ; met à jour thème/annonceur/quantité des prépas BC (IT-62195) ; gère les « bandeaux » (supports 5, 26, 1026 → 100 ; 19 → 102 ; 27 → 105 ; 29 → 107 pour trains) avec `Qte_Theorique` ; renseigne `IdDAChapeau` depuis `tf_prepa_Broadcast`. Anomalie : le `MERGE` compare `C.cont_num = S.sup_id` (jamais vrai) → insertion systématique des lignes de `#travail`, la déduplication ne repose que sur les `NOT EXISTS`.
- Déclencheur : inconnu (aucun appelant dans le code ; job SQL probable).
- Conditions : voir ci-dessus.
- Effet : insert/update `tf_prepa_affiche`.
- Statuts concernés : prépa : créée → à recevoir.
- Profils : n/a
- Source : SP/p_Alimentation_tf_prepa_affiche.sql:85-105, 153-237, 239-263, 268-271, 274-287, 292-354, 357-546, 548-562 (MERGE : 241-257).
- Confiance : PROBABLE (rôle) / INCERTAINE (planification)

---

# F. RÈGLES — ASSOCIATION PRÉPA ↔ AFFICHE

### RG-REC-090 (provisoire) — Recherche de prépas à associer
- Description : critères de recherche : dossier (liste « + »), annonceur, thème, format, départ (« S<n>/<année> »). Filtre commun : non FromBroadcast, `rpc_theme` non nul, non déjà associée (`affiche_livraison_Id` null), même plateforme, support dans la liste autorisée. Si le support de l'affiche commence par « 2m2 », la liste de supports = tous les supports « 2m2* » + « Scrolling MUI Paris ». Combos d'annonceurs/départs/dossiers/formats/thèmes alimentés par `tf_prepa_affiche` (même filtres de plateforme/support ; si `plt_id ≤ 0` sans filtre plateforme).
- Déclencheur : onglet « Préparations » du détail → recherche.
- Conditions : voir ci-dessus.
- Effet : liste de prépas candidates.
- Statuts concernés : prépa non associée.
- Profils : n/a
- Source : BLL/ReceptionListeAfficheBll.cs:420-435, 484-531 ; REPO/ReceptionListeAfficheRepository.cs:287-442.
- Confiance : CERTAINE

### RG-REC-091 (provisoire) — Association de prépas à une affiche
- Description : les prépas sélectionnées non encore associées reçoivent `affiche_livraison_Id = affiche` et `ARecevoir = true` ; `affiche.date_maj = now` ; historique `AfficheAssocier` (dossier-thème et ids) ; puis recalcul de `date_dernier_depart` (RG-REC-032). Aucun contrôle côté serveur de cohérence (plateforme, format, thème, quantité). Liste vide → NullReference (FirstOrDefault().affiche_Id). Bouton visible seulement avec droit `validation_admin` et affiche non fusionnée.
- Déclencheur : POST `ValiderAssocPrepaAffiche`.
- Conditions : `prepa.affiche_livraison_Id == null`.
- Effet : update `tf_prepa_affiche`, `affiche`, historique.
- Statuts concernés : orpheline → associée ; prépa : à recevoir → reçue.
- Profils : `validation_admin` (UI).
- Source : BLL/ReceptionListeAfficheBll.cs:533-555 ; CTRL/ReceptionListeAfficheController.cs:378-388 ; VIEW/Shared/DetailAffiche/Partial/Partial_GridAssoc_prepa_affiche.cshtml:42.
- Confiance : CERTAINE

### RG-REC-092 (provisoire) — Dissociation
- Description : `affiche_livraison_Id = NULL` sur la prépa ; `ARecevoir` n'est PAS remis à false (la prépa reste « reçue » et n'est pas re-proposée en réception) ; historique écrit avec l'action `AfficheAssocier` (et non `AfficheDissocier`) et reçoit l'id de la PRÉPA comme id d'entité ; recalcul de `date_dernier_depart` (null s'il ne reste aucune prépa).
- Déclencheur : POST `DeleteAssocPrepaAffiche`.
- Conditions : aucune ; si la prépa n'était pas associée, `afficheid = 0`.
- Effet : voir description.
- Statuts concernés : associée → orpheline ; prépa : ARecevoir inchangé.
- Profils : `validation_admin` (UI).
- Source : BLL/ReceptionListeAfficheBll.cs:577-586 ; BLL/HistorisationBll.cs:68-76 (ligne 70) ; CTRL/ReceptionListeAfficheController.cs:390-401.
- Confiance : CERTAINE

### RG-REC-093 (provisoire) — Auto-association à l'ouverture du détail (effet de bord en lecture)
- Description : à l'ouverture du détail depuis la liste filtrée (`isFiltredList`), si l'affiche n'a aucune prépa, n'est pas validée admin : recherche des prépas par dossier (plateforme + support) et association automatique de toutes les prépas trouvées (appel direct à `ValiderAssocPrepaAffiche`). `quantitePrepa` = somme des quantités associées.
- Déclencheur : `_Modifier(affiche_id, isFiltredList=true)` (GET).
- Conditions : `!preparations.Any() && !validationAdmin && isFiltredList`.
- Effet : écritures en base lors d'une consultation.
- Statuts concernés : orpheline → associée.
- Profils : n/a
- Source : CTRL/ReceptionListeAfficheController.cs:218-257.
- Confiance : CERTAINE

---

# G. IMPRESSIONS

### RG-REC-100 (provisoire) — Étiquette rack
- Description : l'étiquette reprend l'affiche, le libellé du support, les préparations liées, le commentaire de la livraison et la `Ref_DA` de la livraison associée (première association).
- Déclencheur : bouton « Imprimer » ; impression auto à la validation (RG-REC-028).
- Conditions : n/a
- Effet : PDF/état `Rapport.EtiquetteRackAffiche`.
- Statuts concernés : n/a
- Profils : aucun contrôle.
- Source : BLL/ReceptionListeAfficheBll.cs:332-352 ; REPO/ReceptionListeAfficheRepository.cs:482-501 ; CTRL/ReceptionListeAfficheController.cs:285-303.
- Confiance : CERTAINE

### RG-REC-101 (provisoire) — Édition picking
- Description : état imprimé des affiches validées admin, hors zone picking, par plateforme et période de `date_entree`, quantité = somme des mouvements, regroupées par format, triées par annonceur (annonceurs commençant par une lettre d'abord, puis tri alphabétique insensible à la casse), `rows = 1` pour la première ligne de chaque groupe format (sinon 0) ; code-barres « A- » + id complété à 13 caractères ; semaine/année issues de `date_entree`. Le paramètre `historique` du contrôleur est ignoré. La SP déclare un 4e paramètre `@affiches` (table) non passé par le repository (incohérence à vérifier).
- Déclencheur : bouton « Edition picking ».
- Conditions : `validationAdmin = 1`, `zone_Picking` null/0, `plt_id`, période.
- Effet : rapport.
- Statuts concernés : validée, non picking.
- Profils : aucun contrôle.
- Source : BLL/ReceptionListeAfficheBll.cs:678-736 ; SP/p_EditionPicking.sql:22-80 ; REPO/ReceptionListeAfficheRepository.cs:542-551 ; CTRL/ReceptionListeAfficheController.cs:403-422.
- Confiance : CERTAINE (SP) / INCERTAINE (signature EF vs SP)

---

# H. BATCH / TRAITEMENTS AUTOMATIQUES

### RG-REC-110 (provisoire) — Batch BatchAlimPexCirceReception : export des réceptions vers INTERFACE puis EXTPLAY
- Description : (1) `p_batch_alimentation_circe_pex_reception` calcule les lignes : prépas non BC des semaines ≥ semaine courante (année courante) ou années suivantes ; (a) affiches associées à ces prépas, (b) affiches non associées via `tf_dossier_semaine_depart` (même fenêtre de semaines) ; `Format « 2m2 Scrolling »` ramené à « 2m2 » ; surface/bandeau via `transcoCategSupport` ; quantité = somme des mouvements (0 sinon) ; site CCF via `tr_plateforme.id_site_ccf`. (2) Mapping : retient une ligne si `IdDAChapeau != null` OU (`cont_num != "0"` ET semaine/année non nulles) ; `IdSiteCCF = 39` si plt_id = 1 sinon 40 (en dur) ; `IdDossierDeVenteChapeau` = dossier numérique ou null ; `EstAssociee` = prépa liée ET `validationAdmin = true` ; `EstImportePEX = false` ; `Destinataire = "CIRCE"` ; `QuiCreation = "Batch_Alim_Pex_Circe_Reception"`. (3) Insertion dans `INTERFACE.CIRCE_PEX_RECEPTION`. (4) Si insertion OK → `affiche.envoye = true` pour chaque affiche. (5) Appel `INTERFACE.P_CIRCE_Alim_PEX_ReceptionAffiche('PexCirceReception')` (transfert vers EXTPLAY, non analysé). Pas de filtre sur `envoye` : toutes les affiches éligibles sont renvoyées à chaque exécution. En cas d'exception : message (apostrophes retirées) logué dans `tt_log` (module « CIRCE - BatchAlimPexCirceReception », acteur `admin_circe`) puis relance de l'exception. Timeout de commande SQL = Int32.MaxValue.
- Déclencheur : exécutable batch (`Program.cs`), planification externe non trouvée.
- Conditions : voir ci-dessus.
- Effet : écritures INTERFACE, flag `affiche.envoye`.
- Statuts concernés : `envoye` null → true (jamais remis à false).
- Profils : compte technique.
- Source : BLL/BatchAlimReceptionBll.cs:30-57, 59-103 (67-68, 79, 89) ; REPO/BatchAlimReceptionRepository.cs:27-135 ; SP/p_batch_alimentation_circe_pex_reception.sql:33-178.
- Confiance : CERTAINE (code) ; déduplication côté INTERFACE/EXTPLAY INCERTAINE.

### RG-REC-111 (provisoire) — Condition « EstAssociee » = prépa associée ET validée par l'admin
- Description : l'indicateur envoyé à PEX n'est vrai que si l'affiche est liée à une prépa et validée (`validationAdmin = true`). Les affiches non associées (orphelines) sont envoyées via leurs lignes `tf_dossier_semaine_depart`, avec `EstAssociee = false`.
- Déclencheur : batch (RG-REC-110).
- Conditions : `affiche_livraison_Id ≠ 0 AND validationAdmin`.
- Effet : champ `EstAssociee`.
- Statuts concernés : validée/associée.
- Profils : n/a
- Source : BLL/BatchAlimReceptionBll.cs:89 ; SP/p_batch_alimentation_circe_pex_reception.sql:72-153.
- Confiance : CERTAINE

---

# I. PROFILS, DROITS, SÉCURITÉ

### RG-REC-120 (provisoire) — Droits d'accès : tr_utilisateur_menu (menu), plateformes : tr_utilisateur_data
- Description : un « droit » est une chaîne `menu` dans `tr_utilisateur_menu` (par `loginWindows`, mis en cache session). Menu « Réception » visible avec `reception_liste_affiche` ; sous-menus : « Réception des affiches » et « Liste des affiches » (même droit), « Zone picking » (`Zone_Picking`), « Fusion des affiches » (`fusion_affiche`). « Etat de destruction » est dans le menu « Suivi » (droit `suivi_suivi_production`). Droits UI complémentaires : `validation_admin` (case validation admin / à conserver ; boutons association/dissociation), `Zone_Picking` (case zone picking), `fusion_affiche` (colonne/bouton fusion).
- Déclencheur : rendu menu / vues.
- Conditions : `droits.Any(x => x.menu == droitStr)`.
- Effet : affichage/masquage.
- Statuts concernés : n/a
- Profils : voir tableau « Profils ».
- Source : BLL/CommunBll.cs:31-40, 276-303 ; circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/Helpers/UserHelperNew.cs:70-80 ; SP/p_s_listemenu.sql:26-28 ; VIEW/Shared/_MenuNew.cshtml:122-138, 140-151.
- Confiance : CERTAINE

### RG-REC-121 (provisoire) — Aucun contrôle de droit côté serveur sur les actions Réception
- Description : aucune action des contrôleurs Réception/Livraison/Fusion/Destruction ne vérifie un droit ni l'appartenance de la plateforme (`plt_id` fourni par le client) ; pas d'attribut `[Authorize]` trouvé. Toutes les restrictions sont dans les vues. Identité = login Windows (AD) ; en compilation DEBUG le login est figé à `CCI\PBOSS760`.
- Déclencheur : toute requête HTTP.
- Conditions : n/a
- Effet : un utilisateur connaissant les URL peut exécuter toute action (fusion, validation admin, rebus, vidage du rebus, destruction).
- Statuts concernés : tous.
- Profils : n/a
- Source : CTRL/ReceptionListeAfficheController.cs:20-540 (aucune vérification) ; CTRL/LivraisonAfficheController.cs:24-544 ; CTRL/DestructionController.cs:15-67 ; CTRL/FusionAfficheController.cs:15-88 ; circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/Helpers/UserHelperNew.cs:15-40.
- Confiance : CERTAINE (absence dans le code lu ; un filtre global dans Global.asax/FilterConfig n'a pas été vérifié → PROBABLE)

---

# Machines d'états

Il n'existe pas de champ « statut » unique ; états dérivés de flags. Notation de l'état d'une **affiche** (`affiche`) :
- R = Réceptionnée (rebus null/false, non fusionnée) ; P = Picking (`zone_Picking=1`) ; V = validée admin (`validationAdmin=1`) ; O = orpheline (aucune prépa liée) ; Rb = Au rebus (`rebus=1`) ; Fc = Fusionnée cible (ligne dans `fusion_affiche.id_affiche`) ; Fh = Chapeau (`est_fusionne=1`).

### Affiche (`affiche`)
| État de départ | Action | État cible | Règle |
|---|---|---|---|
| ∅ | Création de livraison (prépa / BC / orpheline) | R (O si orpheline, associée sinon) | RG-REC-075, 078 |
| ∅ | Création manuelle (mode Création) | R | RG-REC-020 (voie probablement morte) |
| R / P / Rb | Ajouter (+qté) | inchangé (qté+) | RG-REC-021 |
| R / P / Rb | Sortir (−qté) | inchangé (qté−, `date_derniere_sortie`) | RG-REC-022 |
| R / P | Modifier (flags) | R ↔ P (zone_Picking) ; non-V ↔ V (validationAdmin) | RG-REC-024/027/029 |
| R / P | Associer prépa | O → associée | RG-REC-091 |
| associée | Dissocier prépa | associée → O (ARecevoir prépa inchangé) | RG-REC-092 |
| R / P | Mettre au rebus | Rb (+ cibles du chapeau) | RG-REC-040 |
| R / P | Destruction (case écran Destruction) | Rb | RG-REC-052 |
| Rb (stock > 0) | Vider le rebus | Rb (stock = 0, flag conservé) | RG-REC-041 |
| R / P (non fusionnée) | Fusion (rôle cible) | Fc | RG-REC-062 |
| R / P (non fusionnée) | Fusion (rôle chapeau) | Fh (R) | RG-REC-062 |
| Rb | (aucune action de sortie du rebus) | — | aucune transition « dé-rebuter » trouvée |
| Fc | toute action serveur | non bloqué côté serveur (UI en lecture seule) | RG-REC-030 |
| tout | Batch PEX | `envoye` null → true | RG-REC-110 |

Transitions non protégées côté serveur : aucune garde sur l'état courant (rebus rebutable plusieurs fois, ajout/sortie sur rebus/fusionnée, fusion d'une affiche déjà fusionnée ou rebutée).

### Prépa (`tf_prepa_affiche`)
| État de départ | Action | État cible | Règle |
|---|---|---|---|
| ∅ | `p_Alimentation_tf_prepa_affiche` | À recevoir (`ARecevoir` 0/null, non associée) | RG-REC-082 |
| À recevoir | Création de livraison | Reçue (`ARecevoir=1`, associée à l'affiche) | RG-REC-075 |
| À recevoir / Reçue partielle | Association manuelle | Associée (`ARecevoir=1`) | RG-REC-091 |
| Associée | Dissociation | non associée, `ARecevoir` inchangé (1) | RG-REC-092 |
| Associée (cible de fusion) | Fusion | `affiche_livraison_Id` → chapeau, `initial_Id` = cible | RG-REC-062 |
| Reçue partielle (assoc., Σmvt < Qte_Théo) | affichage dans liste 0 si `ARecevoir` 0/null | — | RG-REC-071 |
| FromBroadcast=1 | Raccrochage `p_Alimentation` | `FromBroadcast = NULL` | RG-REC-082 |

### Livraison (`livraison`)
| État | Action | Cible | Règle |
|---|---|---|---|
| ∅ | Valider (création) | Créée | RG-REC-075/078 |
| Créée | Modifier (entête, lignes, PJ) | Créée | RG-REC-079, 080 |
Pas de statut ni de suppression/annulation de livraison trouvés.

### Mouvement (`mouvement`) — append-only
Créé par : livraison (+qté), Ajout (+), Sortie (−), Vidage du rebus (−total), Fusion (copie vers chapeau). Jamais modifié ni supprimé dans le périmètre.

---

# Profils (droits) et capacités (dans le code lu)

Les « profils » sont des droits atomiques (`tr_utilisateur_menu.menu`) ; aucun rôle nommé (administrateur, magasinier…) n'a été trouvé dans le périmètre. Valeurs du enum `CommunBll.Droits` pertinentes : `reception_liste_affiche`, `Zone_Picking`, `fusion_affiche`, `validation_admin`, `suivi_suivi_production`, `Activite_Production` (plus `admin`, `Super_admin`, `referentiel`… hors périmètre).

| Droit | Effet (UI) | Contrôle serveur |
|---|---|---|
| `reception_liste_affiche` | Menu Réception : « Réception des affiches » + « Liste des affiches » | Non |
| `Zone_Picking` | Sous-menu « Zone picking » ; case « zone Picking » dans le détail | Non |
| `fusion_affiche` | Sous-menu « Fusion des affiches » ; colonne et bouton Fusionner en liste À traiter | Non |
| `validation_admin` | Cases « Validation Admin » et « Affiche à conserver » ; boutons associer/dissocier une prépa | Non |
| `suivi_suivi_production` | Menu Suivi dont « Etat de destruction » | Non |
| (tout utilisateur d'une plateforme dans `tr_utilisateur_data`) | Accès aux données de cette plateforme | Non (le `plt_id` posté n'est pas revérifié) |
| Aucun droit | Ajouter, Sortir, Mettre au rebus, Vider le rebus, Imprimer, Edition picking, Modifier : visibles pour tous ceux qui ouvrent la liste | Non |

---

# Dépendances vers d'autres modules (explicites)

| Module / domaine | Éléments consommés ou produits | Nature |
|---|---|---|
| Coordination / Répartition / Préparation (trains, déroulants) | tables `tf_repart_calcul` (rpc_statut <> 4, rpc_repiquage, numeroReception), `tf_face_train`, `tr_atelier`, `tr_statut` ; SP `p_Alimentation_tf_prepa_affiche` (source des prépas), `p_u_numeroReception` (écrit `tf_repart_calcul.numeroReception`) | Lecture/alimentation de `tf_prepa_affiche` ; écriture éventuelle du n° de réception |
| Broadcast / Booking Center (BC) | Web API `PrepaAfficheBC`, tables `tf_prepa_Broadcast`, `Transaco_Surface_Format`, `transcoCategSupport`, colonnes `IdDAChapeau`, `IdDossierDeVenteChapeau`, `FromBroadcast` ; `BatchAlimGetInstructionBc` / `PrepaAfficheBCRepository` / `P_CirceEtatReservation_New` | Lecture + remplacement de `tf_prepa_Broadcast` |
| INTERFACE / EXTPLAY / PEX | base `INTERFACE` : table `CIRCE_PEX_RECEPTION`, SP `P_CIRCE_Alim_PEX_ReceptionAffiche` ; flag `affiche.envoye` | Écriture (batch) |
| Zone picking / Activité de production | `ZonePickingBLL`, `ZonePickingRepository`, `ZonePickingController`, `Activite` / `Machine` / `Equipe` (onglet Mouvements : machine/équipe via `mouvement.IdActivite`), `affiche.zone_Picking`, `Activite.IdAffiche` (réaffecté à la fusion) | Lecture/écriture croisée |
| Suivi de production / Etat des réservations | cache `AffichesPreparation`, `p_GetListeAfficheParDossierReservation`, lien `ListeAffiches(dossier, semaine, site, surface, sup_id, annee)`, `VIEW/SuiviSuiviProduction/Partial/Partial_DetailsLivraison.cshtml` | Navigation / lecture |
| Administration (plateformes, mails, imprimantes) | `AdminPlateformeBll.GetListImprimantesParPlatforme` (imprimantes), `AdminPlateformeMailBll.ListAdresseMailByPltId` (adresses mail), `tr_plateforme` (`id_site_ccf`), `tr_utilisateur_data`, `tr_utilisateur_menu` | Lecture |
| Référentiels | `tr_categorie_support` (`reception`, `sup_nom`), `tr_transposteur_reception`, `tr_imprimeur` | Lecture (création inopérante, RG-REC-074) |
| Historique / Traçabilité | `histo_historique_entite` via `HistoriqueEntityBuilder` / `HistorisationBll` (actions Création, Modification, Rebus, Associer, ViderRebus…) | Écriture |
| Transverse | `tt_log` (journal d'erreur batch), `ToolBll.SendMail`, `Rapport` (étiquette rack, édition picking), session ASP.NET, `MemoryCache` (Expéditeurs, Imprimeurs, AllDossiers) | Technique |
| Fichiers | partage disque `DirectoryFilePieceJointeReception` (AppSettings) | Stockage PJ |

---

# Zones NON analysées (et pourquoi)

1. JavaScript `Scripts/site/*.js` (ReceptionListeAffiche.js, ZonePicking.js, Commum.js, SuiviSuiviProduction.js, Activite.js…) : absents du dépôt fourni. Seul `JS/LivraisonListeAffiche.js` a été lu partiellement (lignes 90-260). Conséquence : validations front du détail affiche (`ValidateDetailAffiche`), confirmation de mise au rebus (usage du paramètre `est_fusionneHtml`), enchaînement de la fusion non homogène, appel de `GetPreparationBC` et logique de la case « Rebus » de l'écran Destruction : INCONNUS. Les comparaisons front/back de la méthode ne sont donc que partielles.
2. Planification des traitements (Task Scheduler / SQL Agent / cron) : aucun fichier de planification trouvé ; fréquence du batch `BatchAlimPexCirceReception`, appel de `p_Alimentation_tf_prepa_affiche` et `GetPreparationBC` inconnus. `BatchAlimGetInstructionBc` (autre batch) non lu.
3. Base INTERFACE / EXTPLAY (`P_CIRCE_Alim_PEX_ReceptionAffiche`, `CIRCE_PEX_RECEPTION`) : SP hors dépôt `BDD/DATABASE` lu ; gestion des doublons à chaque run non vérifiée.
4. `p_GetListeAfficheParDossierReservation`, `p_s_rechercheRepartRecepAff`, `P_CirceEtatReservation_New`, `Fn_*` autres : non lues (limite de lecture ; la première alimente le mode `annee` de la liste).
5. `ZonePickingBLL` / `ZonePickingController` / vue ZonePicking : hors périmètre direct (seules les parties communes citées).
6. Vues `LivraisonAffiche/CreationLivraisonView.cshtml`, `ModifierLivraisonView.cshtml`, `Partial_Grid*`, `SuiviSuiviProduction/Partial_DetailsLivraison.cshtml` : seule la logique JS/contrôleur associée a été lue ; règles d'affichage/saisie propres aux vues (champs obligatoires, masques) non extraites.
7. `ToolBll.SendMail`, `Rapport.EtiquetteRackAffiche`, `Rapport.EditionPicking`, `HistoriqueEntityBuilder` : contenus des documents et formats d'historique non lus.
8. Filtres globaux ASP.NET (Global.asax, FilterConfig, Web.config `authorization`) non vérifiés : la conclusion RG-REC-121 reste PROBABLE.
9. Tables sans trigger : aucun dossier `Triggers` dans `BDD/` ; si des triggers existent en base réelle ils ne sont pas visibles ici.
10. Docs de contexte (`circe-develop/docs/*.md`, `docs/_travail/inventaire.md`, `docs-sources/1. CIRCE ACTUEL/`) : non utilisés pour déduire des règles (consigne) ; non lus pour confrontation dans cette passe.

---

# Synthèse chiffrée
- 60 règles provisoires : RG-REC-001 à 014 (14), 020 à 032 (13), 040-041 (2), 050-052 (3), 060-064 (5), 070-082 (13), 090-093 (4), 100-101 (2), 110-111 (2), 120-121 (2).
- Zones à risque (bugs/ambiguïtés prioritaires à arbitrer) : RG-REC-064 (chapeau inclus dans les cibles), RG-REC-050 (précédence SQL destruction), RG-REC-075/079 (écrasement vs cumul de `affiche.quantite` + mouvements dupliqués à la modification), RG-REC-092 (ARecevoir non remis, historique mal typé), RG-REC-093 (écriture en GET), RG-REC-121 (aucun contrôle serveur), RG-REC-020 (voie de création manuelle morte/cassée), RG-REC-110 (pas de filtre `envoye`), RG-REC-082 (MERGE inopérant, planification inconnue), RG-REC-010/031 (unité de `conservation`).
