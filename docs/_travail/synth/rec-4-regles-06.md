### RG-REC-126 — Colonne « En stock » et rebut mis en évidence
- Origine : MODIFIÉE
- Énoncé : « En stock » = somme des mouvements ; un badge Important « n rebut » met le rebut en évidence (REC-08) ; ligne teintée en important si rebut ; orpheline en avertissement.
- Déclencheur : affichage.
- Conditions : —
- Effet / message d'erreur : visuel.
- Sources : spec `[DC] §8` ; ateliers EX-REC-513 · écran ECR-REC-03
- Questions liées : Q-103
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-127 — Tags calculés, jamais cochés
- Origine : NOUVELLE
- Énoncé : tags À contrôler (palette pas contrôlée), Réception inconnue, Complément (≥ 2 réceptions), Feuille à refaire (thème modifié après identification et feuille non réimprimée, ou feuille temporaire sur affiche rattachée) sont posés par Circé.
- Déclencheur : événements.
- Conditions : —
- Effet / message d'erreur : voir §3.
- Sources : spec `[DC] §9` (EX-REC-050, 054) · écran ECR-REC-03 (définitions)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-128 — Tag « Complément »
- Origine : NOUVELLE
- Énoncé : posé dès que l'affiche est reçue en au moins deux réceptions (nombre de réceptions, pas de statut explicite).
- Déclencheur : 2e réception.
- Conditions : ≥ 2 réceptions.
- Effet / message d'erreur : tag jaune.
- Sources : spec `[DC] §4, §9` (EX-REC-016) ; Q-REC-14
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-129 — Tag « Feuille à refaire » / « Feuille définitive à imprimer »
- Origine : NOUVELLE
- Énoncé : posé quand le thème ou un rattachement change après identification ; levé par la réimpression ; affiché « Feuille définitive à imprimer » tant qu'une temporaire est posée. Modifier annonceur/thème saisis ne le pose pas dans la maquette (Q-143).
- Déclencheur : changement de thème / rattachement.
- Conditions : feuille déjà imprimée.
- Effet / message d'erreur : alerte RG-REC-188.
- Sources : spec `[DC] §9, §10` (EX-REC-054, 062) ; ateliers EX-THM-503 · écran ECR-REC-05
- Questions liées : Q-143
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-130 — Fiche de l'affiche
- Origine : MODIFIÉE
- Énoncé : panneau avec onglets Détail, Mouvements, Préparations (compteur), Historique ; Détail : réception(s) (lien), annonceur/thème saisis, imprimeur, allée, rayon, quantité reçue, stock disponible, feuille de stock, entretien reçu en plus, « Affiche à conserver (reliquat d'entretien) », encadré « Palette à contrôler » + « Contrôler la palette », bloc Validation admin. Boutons : Fermer, Imprimer la feuille de stock, Enregistrer (note « Fiche affiche modifiée »). Legacy : popup détail/modification avec dossier, semaines, nb semaines, thème, repiquage, conservation, date dernier départ.
- Déclencheur : clic ligne / n° d'affiche.
- Conditions : —
- Effet / message d'erreur : pas de modales imbriquées.
- Sources : spec `[DC] §8` (EX-REC-047) · écran ECR-REC-05
- Questions liées : Q-120
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-131 — Champs modifiables de la fiche
- Origine : MODIFIÉE
- Énoncé : modifiables : annonceur saisi, thème saisi, imprimeur, allée, rayon, « à conserver », commentaire ; NON modifiables : date d'entrée, quantité (par mouvements), rebus, date de dernière sortie. Legacy : également format, dossier, semaines, repiquage, conservation, date dernier départ, validationAdmin, zone_Picking, photo ; modifiable même rebutée ou fusionnée côté serveur.
- Déclencheur : « Enregistrer ».
- Conditions : droits RG-REC-002.
- Effet / message d'erreur : historique RG-REC-006 ; dossiers/semaines via rattachements.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` (RG-REC-024) · spec EX-REC-047 · écran ECR-REC-05
- Questions liées : Q-143, Q-150
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-132 — Onglet Mouvements
- Origine : NOUVELLE
- Énoncé : tableau Date, Mouvement (type + motif), Quantité (signée), Par, Auto ; n° de réception cliquable → fiche réception ; machine/équipe via `IdActivite` (legacy).
- Déclencheur : onglet.
- Conditions : —
- Effet / message d'erreur : tri date décroissante.
- Sources : spec `[DC] §8` ; ateliers EX-REC-509 · écran ECR-REC-05
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-134 — Onglet Préparations
- Origine : MODIFIÉE
- Énoncé : tableau Dossier, Annonceur, Thème, Départ, Quantité ; actions « Changer de thème… », « Retirer », « + Rattacher à un autre dossier » sans limite (ANO-12) ; chaque changement pose « Feuille à refaire ». Legacy : « Préparations », ajout par recherche, dissociation.
- Déclencheur : onglet.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-135 à 137.
- Sources : spec `[DC] §8, §10` (EX-REC-048) · écran ECR-REC-05
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-135 — Changer de thème
- Origine : NOUVELLE
- Énoncé : « Changer de thème… » propose les autres thèmes du MÊME dossier ; pose « Feuille à refaire » et alerte ; vaut validation seulement si `coord`, sinon repasse « à confirmer ». Purge des anciens thèmes des réceptions attendues après changement (RG-REC-150).
- Déclencheur : action.
- Conditions : thème ∈ thèmes du dossier.
- Effet / message d'erreur : « Thème corrigé : feuille de stock à refaire. » ; RG-X-012.
- Sources : spec `[DC] §8, §10` (EX-REC-048, 062) · écran ECR-REC-05
- Questions liées : Q-143
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-136 — « + Rattacher à un autre dossier »
- Origine : NOUVELLE
- Énoncé : panneau de recherche (n° dossier, DA, annonceur, thème ; propositions par défaut : même annonceur, 6 max, triées par reste décroissant) ; par ligne Qté ≥ 1 et « Rattacher » ; l'affiche orpheline devient IDENTIFIEE et la palette A_CONTROLER.
- Déclencheur : bouton.
- Conditions : quantité ≥ 1.
- Effet / message d'erreur : 422 `REC_QTE_DOSSIER_OBLIGATOIRE` « Indiquez la quantité pour ce dossier. » ; « Affiche n° rattachée au dossier n : feuille de stock à refaire… ».
- Sources : spec `[DC] §8, §10` (EX-REC-048) ; legacy `BLL/ReceptionListeAfficheBll.cs:533-555` (RG-REC-091) · écran ECR-REC-05
- Questions liées : Q-124
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-137 — Retirer un rattachement
- Origine : MODIFIÉE
- Énoncé : « Retirer » passe le rattachement à RETIRE (qui/quand), historisé comme dissociation (RG-REC-007) ; jamais supprimé ; si plus aucun lien actif → RG-REC-114. Legacy : `affiche_livraison_Id = NULL`, `ARecevoir` non remis à faux, `date_dernier_depart` recalculé, sans contrôle de statut.
- Déclencheur : « Retirer ».
- Conditions : lien ACTIF.
- Effet / message d'erreur : recalcul RG-REC-017 ; RG-X-013.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:577-586` (RG-REC-092 ; RG-COO-023) · spec EX-REC-048
- Questions liées : Q-136
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-138 — Rattachement manuel après validation ou début de production
- Origine : NOUVELLE
- Énoncé : affiches en plus pour un autre dossier : rattachement manuel possible même après validation ou début de production, avec historique ; seul le surplus ; autre plateforme : transfert puis réception.
- Déclencheur : « + Rattacher ».
- Conditions : —
- Effet / message d'erreur : historique.
- Sources : spec EX-COO-045
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-139 — Recherche de lignes à rattacher (legacy)
- Origine : CONSERVÉE
- Énoncé : critères dossier (liste « + »), annonceur, thème, format, départ « S<n>/<année> » ; filtres communs : non `FromBroadcast`, `rpc_theme` non nul, non déjà associée, même plateforme, support autorisé ; combos alimentés par `tf_prepa_affiche`.
- Déclencheur : onglet Préparations.
- Conditions : —
- Effet / message d'erreur : candidates.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:420-435, 484-531`, `REPO/ReceptionListeAfficheRepository.cs:287-442` (RG-REC-090) · Q-147
- Questions liées : Q-147
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-140 — Association de lignes (legacy) : lignes sans affiche seulement
- Origine : MODIFIÉE
- Énoncé : legacy : seules les prépas non encore associées sont liées (`ARecevoir = true`, `affiche.date_maj`, historique `AfficheAssocier`) ; liste vide → NullReference ; aucun contrôle de cohérence plateforme/format/thème/quantité ; bouton réservé à `validation_admin`. Cible : N-N avec quantité, contrôles RG-REC-024.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : remplacée par RG-REC-136.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:533-555`, `CTRL/ReceptionListeAfficheController.cs:378-388` (RG-REC-091 ; RG-COO-022)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-141 — Dissociation (legacy)
- Origine : MODIFIÉE
- Énoncé : voir RG-REC-137 ; legacy : la ligne reste « reçue » mais n'est plus proposée (ARecevoir non remis) : en cible le statut est recalculé.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir RG-REC-137.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:577-586` (RG-REC-092)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-142 — Auto-association à l'ouverture de la fiche (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : ouverture depuis une liste filtrée, affiche sans prépa et non validée → association automatique de toutes les prépas du même dossier/plateforme/support (écriture lors d'une consultation). Cible : une lecture n'écrit JAMAIS ; la proposition de rattachement se fait à la réception (RG-X-001).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : supprimé.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:218-257` (RG-REC-093 ; RG-COO-024) · spec EX-COO-004
- Questions liées : Q-148
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-143 — Date de dernier départ
- Origine : CONSERVÉE
- Énoncé : `date_dernier_depart` = vendredi de la semaine max (de l'année max) des lignes associées hors `FromBroadcast` ; NULL s'il n'y en a plus ; recalcul à chaque association/dissociation. Legacy : max de semaine et d'année indépendants (faux sur deux années) ; valeur stockée écrase le calcul à l'ouverture.
- Déclencheur : rattachement/retrait.
- Conditions : —
- Effet / message d'erreur : mise à jour.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:557-575, 594-609, 211, 221`, `REPO/ReceptionListeAfficheRepository.cs:596-605` (RG-REC-032)
- Questions liées : Q-120
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-144 — Conservation : valeur par défaut
- Origine : CONSERVÉE
- Énoncé : conservation = `affiche.conservation` si > 0, sinon 20 ; vider le champ remet 0 ; non persisté sauf enregistrement. Unité (jours/semaines) non établie ; alerte legacy « dernier départ dépassé » (date_dernier_depart > date_entree + 7 × conservation) en rouge.
- Déclencheur : ouverture fiche.
- Conditions : —
- Effet / message d'erreur : affichage.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:213, 942, 984`, `SP/p_s_affiche_a_fusionner.sql:42` (RG-REC-031, 010)
- Questions liées : Q-120
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-145 — « Affiche à conserver »
- Origine : CONSERVÉE
- Énoncé : case (reliquat d'entretien) historisée ; les affiches « à conserver » n'apparaissent pas automatiquement dans la destruction ; « Marquer à conserver » aussi dans Stocks. Droit legacy `validation_admin`.
- Déclencheur : case.
- Conditions : —
- Effet / message d'erreur : historique `ModificationAfficherAConserver`.
- Sources : legacy `HistorisationBll.cs:29-32` · spec EX-STK-504 · écran ECR-REC-05, ECR-STK-01
- Questions liées : Q-136
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-147 — Formats de saisie dossier/semaines (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : dossiers = 6 chiffres séparés par « + » ; semaines `S`/`s`+2 chiffres séparées par « + » ou « / » ; nb de blocs semaines = nb de dossiers ; `nombre_semaine` = nb d'éléments de `semaines` ; l'un sans l'autre refusé. Messages : « Attention, votre format semaine est inccorect. Exemple format attendue "S41/S42+S41/S42" », « Attention, le nombre de dossier ne correspond pas aux semaines », « Attention, le nombre de semaine ne correspond pas aux semaines ». Réponse HTTP 200 texte. Cible : remplacée par rattachements N-N ; semaines ISO.
- Déclencheur : « Enregistrer » legacy.
- Conditions : —
- Effet / message d'erreur : conservé si le champ texte subsiste (Q-150).
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:136-173` (RG-REC-026 ; RG-COO-025)
- Questions liées : Q-150
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-148 — Régénération de `tf_dossier_semaine_depart` (legacy)
- Origine : MODIFIÉE
- Énoncé : après modification d'une affiche orpheline, les lignes sont supprimées/recréées depuis `cont_num` + `semaines` ; année = courante, +1 si n° < semaine courante. Cible : remplacée par rattachements.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/LivraisonAfficheService.cs:1049-1081` (RG-REC-025)
- Questions liées : Q-150
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-150 — Purge des anciens thèmes après changement de thème
- Origine : NOUVELLE
- Énoncé : après modification des IP / changement de thème, les anciens thèmes disparaissent des réceptions attendues et de la recherche de rattachement (le nouveau thème n'« écrase » pas l'ancien aujourd'hui) ; sans alerte.
- Déclencheur : changement de thème.
- Conditions : —
- Effet / message d'erreur : ligne annulée.
- Sources : ateliers EX-REC-504, EX-THM-504 ; spec EX-REC-062 (couvert en partie)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
