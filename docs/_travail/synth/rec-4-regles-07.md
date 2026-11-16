### RG-REC-151 — Types de mouvement, append-only
- Origine : MODIFIÉE
- Énoncé : types (`tr_type_mouvement`) : réception, réception (complément), écart de contrôle, production, rebut, sortie et ajout manuels, expédition, fusion, renvoi, destruction ; un mouvement est créé, jamais modifié ni supprimé ; chaque mouvement porte référence, date, BL, équipe, machine, transporteur, imprimeur, quantité, auteur.
- Déclencheur : tout flux de quantité.
- Conditions : —
- Effet / message d'erreur : 409 sur modification/suppression.
- Sources : legacy « Mouvement — append-only » ; spec `[DC] §9, §13` (EX-REC-057 ; EX-TRA-037)
- Questions liées : Q-103
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-153 — Stock = somme des mouvements ; reçu = somme des rattachements
- Origine : MODIFIÉE
- Énoncé : stock disponible = Σ mouvements ; reçu d'un visuel = Σ quantités rattachées (RG-REC-017). Rebut, destruction, expédition, renvoi sont des mouvements négatifs.
- Déclencheur : lecture.
- Conditions : —
- Effet / message d'erreur : calculé.
- Sources : spec `[DC] §9` (EX-REC-057) ; ateliers EX-STK-501 ; `maquettes-autres-modules.md §0.6`
- Questions liées : Q-103
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-154 — Double source de quantité (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : `affiche.quantite` et `SUM(mouvement.quantite)` coexistent (listes et picking = somme ; destruction = `quantite` ; vidage du rebus : `quantite = 0` + mouvement −somme ; livraison : `quantite` écrasée). Cible : une seule vérité (mouvements).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : colonne dénormalisée éventuelle recalculée.
- Sources : legacy `SP/p_GetListeAffiche.sql:100-109`, `SP/p_s_destruction.sql:19`, `BLL/ReceptionListeAfficheBll.cs:311-321` (RG-REC-023)
- Questions liées : Q-103
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-155 — Ajout et sortie manuels de stock (legacy)
- Origine : CONSERVÉE
- Énoncé : « Ajouter » : `quantite += saisie` + mouvement positif (récépissé, expéditeur) ; « Sortir » : `quantite −= saisie`, `date_derniere_sortie = now`, mouvement négatif, récépissé « Sortie ». Legacy : aucun contrôle de quantité > 0 ni de stock suffisant (stock négatif possible), actions visibles même sur rebus. La Liste des affiches cible n'a pas d'action de création ; types « ajout/sortie manuels » prévus V2.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : HYPOTHÈSE Q-117 : quantité > 0 et sortie ≤ disponible.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:800-835`, `22` (RG-REC-021, 022) · spec EX-REC-057 ; Q-REC-12
- Questions liées : Q-117
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-156 — Mise au rebut depuis Stocks
- Origine : NOUVELLE
- Énoncé : « Mettre au rebut » (Stock par affiche) : quantité par affiche (min 1, défaut 1), motif (Affiche déchirée, Mauvais visuel, Erreur de quantité, Autre) ; mouvement « Mise au rebut » négatif plafonné au disponible ; rebut = sortie de stock.
- Déclencheur : action groupée.
- Conditions : quantité ≤ disponible.
- Effet / message d'erreur : voir RG-REC-064.
- Sources : spec `[DC] §5, §10` (EX-REC-024, 061) ; EX-STK-504 · écran ECR-STK-01
- Questions liées : Q-118
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-157 — Mise au rebus d'une affiche (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : l'affiche et celles dont elle est chapeau passent `rebus = true`, `date_rebus = now`, historique `AfficheMiseEnRebus` ; quantité inchangée ; sans confirmation serveur, sans test de statut ni de droit ; aucune sortie du rebus. Cible : rebut = mouvement négatif ; flag à migrer.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : HYPOTHÈSE Q-118.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:271-289`, `REPO/ReceptionListeAfficheRepository.cs:615-622` (RG-REC-040)
- Questions liées : Q-118, Q-155
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-158 — Vidage du rebus (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : pour la plateforme, affiches `rebus = true` à somme de mouvements > 0 : mouvement −somme (récépissé « Vidage du rebus »), `quantite = 0`, historique `ViderRebus` (écrit avant la maj, sans transaction) ; confirmation « Confirmez-vous le vidage du rebus ? ». « À rapprocher de la destruction » (cible).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir Q-118/Q-119.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:297-325`, `REPO/ReceptionListeAfficheRepository.cs:220-258` (RG-REC-041) · spec EX-REC-061
- Questions liées : Q-118, Q-119
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-159 — Tag « Au rebut » (proposé)
- Origine : NOUVELLE
- Énoncé : tag « Au rebut » PROPOSÉ (non décidé) pour afficher le rebut.
- Déclencheur : rebut > 0.
- Conditions : —
- Effet / message d'erreur : affichage seul tant que non décidé.
- Sources : spec `[DC] §9` (EX-REC-054)
- Questions liées : Q-118
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-160 — Etat de destruction (legacy) : déplacé dans Stocks › Fin de campagne
- Origine : MODIFIÉE
- Énoncé : legacy : `p_s_destruction` = (`date_dernier_depart < now − 4 sem` ET `a_conserver = 1` ET `date_entree < now − 365 j`) OU (… ET (`a_conserver` 0/NULL) ET `plt_id` ET `rebus != 0`) — précédence AND/OR : la 1re branche ignore plateforme et rebus ; quantité = `affiche.quantite` ; colonne « Statut » = « C » si à conserver et âge > 356 j (365 en SP : coquille probable) ; case « Rebus » pose `rebus`, `date_rebus` sans historique. Cible : écran Stocks › Fin de campagne (STK-03 ; délais 2 m² = 4 sem., 8 m² = 2 sem., à revoir CGV 2027 ; destruction = mouvement). Module STK.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : écart documenté, pas de reprise à l'identique.
- Sources : legacy `SP/p_s_destruction.sql:12-39`, `BLL/DestructionBll.cs:16-92`, `CTRL/DestructionController.cs:37-65` (RG-REC-050, 051, 052) · spec EX-STK-502, 504 ; EX-EXI-076 · écran ECR-STK-03
- Questions liées : Q-119
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-163 — Fusion manuelle d'affiches (legacy) — non reprise
- Origine : SUPPRIMÉE
- Énoncé : fusion depuis la liste (droit `fusion_affiche`, ≥ 2 affiches) : contrôles « les affiches n'ont pas le même thèmes / dossier / semaines » (b, c toujours vrais), chapeau = plus petit id ; fusion « non homogène » (choix thème/allée/rayon/repiquage). Retrait explicite : « « Zone picking » et « Fusion des affiches » du menu actuel ne sont pas repris dans la cible ; la fusion est inopérante (ANO-15). »
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucune fonction. Données héritées : RG-REC-169.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:424-452, 496-538` (RG-REC-060, 061, 014) · spec `[README] §3, §7` (EX-REC-079)
- Questions liées : Q-100
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-165 — Effets d'une fusion (legacy) — données héritées
- Origine : SUPPRIMÉE
- Énoncé : legacy : chapeau `est_fusionne`, validation OU, commentaires joints par « / », quantité = somme, conservation max ; cibles : mouvements dupliqués sur le chapeau, prépas/assos/activités réaffectées, `fusion_affiche(chapeau, cible)` ; quatre `SaveChanges`. Non reprise (voir RG-REC-163).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : migration : Q-155.
- Sources : legacy `BLL/FusionAfficheBll.cs:61-234` (RG-REC-062 ; RG-COO-031)
- Questions liées : Q-100, Q-155
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-166 — Risque legacy : chapeau inclus dans ses cibles
- Origine : SUPPRIMÉE
- Énoncé : `Fusionner` (liste) utilise `Skip(0)` : le chapeau est sa propre cible (quantité doublée, mouvements dupliqués, `fusion_affiche(chapeau, chapeau)`), alors que `FusionNonHomogene` utilise `Skip(1)`. Ne pas reproduire.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : sans objet.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:435-440, 521` (RG-REC-064)
- Questions liées : Q-100
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-167 — Écran Fusion : propositions automatiques (legacy)
- Origine : SUPPRIMÉE
- Énoncé : `p_s_affiche_a_fusionner` : groupes de ≥ 2 affiches de même thème/plateforme/support/dossier/semaine/année, semaine max de départ ∈ [semaine−5, semaine], chapeau = MIN(id) ; message « La fusion a été effectuée avec succes ! ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/FusionAfficheBll.cs:18-59`, `SP/p_s_affiche_a_fusionner.sql` (RG-REC-063) · spec EX-REC-079
- Questions liées : Q-100
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-168 — Zone picking (legacy)
- Origine : SUPPRIMÉE
- Énoncé : case « zone Picking » (droit `Zone_Picking`), statut d'affichage « Picking » / « Réceptionnée », exclusion de l'Édition picking. Écran « Zone picking » non repris dans la cible (EX-REC-079) ; la donnée `zone_Picking` reste héritée.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir Q-101.
- Sources : legacy `VIEW/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:256-265` (RG-REC-029, 009) · spec EX-REC-079
- Questions liées : Q-101
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-169 — Affiche héritée « fusionnée » : lecture seule
- Origine : MODIFIÉE
- Énoncé : une affiche cible d'une fusion héritée est en lecture seule (le legacy ne l'impose qu'à l'UI) ; toute écriture serveur → 409.
- Déclencheur : écriture sur affiche héritée fusionnée.
- Conditions : ligne dans `fusion_affiche.id_affiche`.
- Effet / message d'erreur : 409 `REC_AFFICHE_FUSIONNEE_LECTURE_SEULE`.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:223`, `_DetailAffiche.cshtml:270-276` (RG-REC-030)
- Questions liées : Q-155
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-170 — Drill-down depuis un dossier (legacy)
- Origine : CONSERVÉE
- Énoncé : liste restreinte à un dossier/semaine/site via lien (`ListeAffiches(dossier, …)`) ; en cible un lien pose des filtres appliqués une fois à l'arrivée, bouton « ← Retour ».
- Déclencheur : lien depuis EDR/fiche dossier/alertes.
- Conditions : —
- Effet / message d'erreur : liste filtrée (le cache `AffichesPreparation` legacy non repris).
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:47-111` (RG-REC-012) · spec EX-TRA-013
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-171 — Éléments de la liste legacy sans équivalent cible
- Origine : CONSERVÉE
- Énoncé : statistiques du cadre « Résultat » (nb lignes, nb d'affiches hors rebus, nb au rebus), colonne « Zone », actions par ligne sans masquage selon le statut. Non repris par les specs, non retirés.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : à confirmer.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:127-144, 954`, `Index.cshtml:152-169` (RG-REC-011, 009, 013)
- Questions liées : Q-100
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-175 — Alerte « Validation admin » : case sans contrôle serveur (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : alerte non bloquante « La quantité reçue ne correspondent pas à la quantité BC » à la coche si quantité CIRCE < quantité BC ; `validationAdmin`, `aConserver`, `zone_Picking` écrits sans contrôle serveur. Cible : la quantité n'est pas une condition de la validation (RG-REC-050) ; droit contrôlé (RG-REC-003).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : alerte non reprise.
- Sources : legacy `Partial_ModifierDetailsAffiche.cshtml:24-39, 302-324` (RG-REC-027) · spec EX-COO-011
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
