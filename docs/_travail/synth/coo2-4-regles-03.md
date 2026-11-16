### RG-COO-240 — Libération de la semaine (fixe, pliage, bus) : action sans confirmation, sans lien avec la validation admin
- Origine : MODIFIÉE
- Énoncé : « Libérer la Sxx » (bouton primaire quand la semaine n'est pas libérée) crée une libération (atelier, semaine de départ, date, utilisateur), écrit l'historique « Libéré vers l'atelier » des dossiers « Préparation reçue » (PREPA_RECUE) et le journal ; toast « S44 libérée vers l'atelier … Les préparations reçues ensuite déclencheront une alerte et un mail. [n dossier(s) ont encore des affiches à confirmer…] ». L'action est directe (pas de confirmation). La libération ne valide rien et ne dépend pas de la validation admin. Elle remplace le bouton « Colisage » de Circé legacy. MODIFIÉE : en legacy le bouton « Colisage » crée les UM (RG-COO-260) et fige la donnée (la Pré-Prod ne peut plus y toucher, la main est aux plateformes ; ce qui est colisé est identifiable par le statut « En cours ») ; la cible ne crée plus les UM à la libération (H2 de la maquette), mais l'atelier de Wissous a décidé de garder le bouton « Colisage » (EX-FIX-510) : contradiction à trancher.
- Déclencheur : clic sur « Libérer la Sxx » (Préparation 2 m² fixe / Pliage / Bus).
- Conditions : une seule libération par (atelier, semaine) (HYPOTHÈSE : une seconde libération est refusée 409) ; rôle `coord` (la maquette ne contrôle aucun rôle : « Qui fait la libération ? » question ouverte) ; annulation de libération non prévue.
- Effet / message d'erreur : bandeau « S43 libérée vers l'atelier le mar. 13/10 15h30 (<utilisateur>) — Toute préparation reçue après déclenche une alerte et un mail. » ; lignes de la semaine ne sont plus « à libérer » (RG-COO-241) ; toute préparation reçue ensuite : RG-X-076.
- Sources : écran `ECR-COO-09`, `ECR-COO-09a` ; spec `specs-coordination.md §C` (EX-COO-025), `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-510), `specs-existant-process.md §D` (EX-EXI-041, EX-EXI-043) ; legacy `PreparationService.cs:81-107` (ancien ID provisoire RG-RPR-011)
- Questions liées : Q-265
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-241 — Ligne fixe / pliage « à libérer » tant que la semaine n'est pas libérée
- Origine : MODIFIÉE
- Énoncé : une ligne de préparation 2 m² fixe ou pliage d'une semaine non encore libérée est « à libérer » (et non « A traiter ») ; elle l'est dès l'intégration de la préparation. Repère affiché dans l'unitaire : « à libérer (semaine pas encore libérée) ». Callout : « S44 pas encore libérée vers l'atelier — Ses lignes sont « à libérer »… ». Legacy : la ligne naît au statut 0 « A traiter » et arrive directement dans l'écran de l'atelier (ateliers 1 et 4, `rpc_statut = 0`), sans condition de validation admin, de réception ni de Colisage.
- Déclencheur : intégration de la préparation (statut initial) ; libération (RG-COO-240) pour la sortie de cet état.
- Conditions : ateliers fixe (1, 4) et pliage (2, 3, 9, 10) ; bus.
- Effet / message d'erreur : repère « à libérer » (filtre Repère) ; la maquette n'en fait pas un statut persistant : le repère est dérivé de l'absence de libération (HYPOTHÈSE, voir Q-250).
- Sources : écran `ECR-COO-09` ; spec `specs-coordination.md §C` (EX-COO-025), `specs-existant-process.md §D` (EX-EXI-040, EX-EXI-042, EX-EXI-071) ; legacy `p_s_listeprepa2m2.sql:71-74`, `p_integ_preparation.sql:100-147` (ancien ID provisoire RG-COO-041)
- Questions liées : Q-250, Q-265
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-242 — Repère « Arrivé après libération » : tag, callout, filtre
- Origine : NOUVELLE
- Énoncé : un dossier dont la préparation est reçue après la libération de sa semaine porte le repère « Arrivé après libération » (niveau Important) ; la ligne est teintée « serious » ; le bandeau de libération affiche un callout d'avertissement avec la liste des dossiers arrivés après et les boutons « Voir ces dossiers » (pose le filtre Repère = après libération) et « Voir le mail ». Un compteur de dossiers arrivés après libération s'affiche en badge du menu Préparation.
- Déclencheur : arrivée d'une préparation sur une semaine déjà libérée (RG-X-076).
- Conditions : libération existante pour (atelier, semaine) et date de réception de la préparation > date de libération.
- Effet / message d'erreur : repère posé ; alerte `APRES_LIBERATION` et mail (RG-X-076).
- Sources : écran `ECR-COO-09` ; spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503), `PARTIE 4` (EX-FIX-503) ; `maquettes-reception-coordination.md §1.4` (événement 1)
- Questions liées : Q-266
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-243 — Rendre la main à la Pré-Prod
- Origine : MODIFIÉE
- Énoncé : l'action groupée « Rendre la main à la Pré-Prod » demande un motif (texte, défaut « Changement de visuel demandé par le client ») et affiche « n unité(s) déjà en production — Elles ne seront pas retirées (point de non-retour) » ; « Rendre la main » repasse les dossiers à PREPA_RECUE, les unités non lancées à EN_ATTENTE avec repère « rendu » et enregistre le rendu. Legacy (fixe) : on peut changer les informations même après envoi de la préparation : Préparation 2 m² fixe, sélectionner semaine / dossier / atelier, « Retirer » + confirmer, puis Administration › Déblocage préparations, sélectionner dossier / semaine / plateforme et « rendre la main ». Déroulant : seulement si la production n'est pas lancée. MODIFIÉE : la maquette réunit les deux étapes en une action de l'écran unitaire ; l'effet sur la validation admin et les affiches reçues est une question ouverte (Q-COO-18 maquette).
- Déclencheur : « Rendre la main » (unitaire) ; le déblocage de préparation (coo1) reste l'action d'administration.
- Conditions : unités non EN_PROD (RG-COO-223) ; la préparation concernée doit pouvoir être renvoyée par Broadcast ensuite (la précédente doit être annulée, RG-COO-042 legacy, coo1).
- Effet / message d'erreur : dossiers → PREPA_RECUE, unités → EN_ATTENTE ; historique ; effet sur la validation admin : RG-X-081.
- Sources : écran `ECR-COO-09b` ; spec `specs-existant-process.md §D` (EX-EXI-045), `§B` (EX-EXI-020) ; legacy `AdminPreparationDeblocageBll.cs:252-333` (RG-COO-084 legacy, coo1)
- Questions liées : Q-267
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-244 — Corriger l'intitulé (annonceur imprimé, thème) par la plateforme
- Origine : NOUVELLE
- Énoncé : l'action de ligne « Corriger l'intitulé » (fixe, pliage) modifie l'annonceur imprimé et le thème d'une unité, appliqué à toutes les unités du thème. Champs non vides : « Le thème et l'annonceur ne peuvent pas être vides. » ; aucune modification : « Rien n'a changé. ». La case « Prévenir la Pré-Prod, pour aligner Broadcast si besoin » est cochée par défaut ; un callout avertit si la production est lancée. L'action pose `corrPlateforme` (n'alerte pas « Broadcast ≠ Circé »), pose « Feuille à refaire » sur les affiches concernées et, si la case est cochée, envoie un mail à « Pré-Prod <site> ». La cible demande que les plateformes puissent modifier thème et annonceur en dernier lieu même si la production est lancée (fixe et colle), avec droits limités.
- Déclencheur : action « Corriger l'intitulé » (fixe, pliage) ; « Textes de bague » pour le bus (RG-COO-300).
- Conditions : profils `cheq` / `coord` ; production lancée autorisée (exception à RG-COO-223 limitée à l'intitulé imprimé, HYPOTHÈSE à confirmer).
- Effet / message d'erreur : voir Énoncé ; effet côté Réception : RG-X-082.
- Sources : écran `ECR-COO-09c` ; spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-509), `specs-existant-process.md §F` (EX-EXI-079)
- Questions liées : Q-268
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-245 — Jours d'affichage dans la préparation
- Origine : NOUVELLE
- Énoncé : la préparation affiche les jours d'affichage (jour de départ) afin de prioriser selon les jours de départ ; la présentation (sans multiplier les lignes, par exemple plusieurs jours dans la même case) reste à trancher. La maquette fournit « Départ » (semaine, filtre) et « Départ camion » (date-heure, par destinataire × semaine).
- Déclencheur : affichage de l'unitaire.
- Conditions : source du jour de départ = destinataire × semaine (`jour`/`hh`/`mm` relatifs au lundi de S-1) ; non spécifié pour le fixe.
- Effet / message d'erreur : colonne ; aucun refus.
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-504) ; écran `ECR-COO-09`
- Questions liées : Q-270
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-246 — Fiche de synthèse de préparation (groupée par destinataire)
- Origine : MODIFIÉE
- Énoncé : la « Fiche de synthèse » liste, selon les filtres de l'écran, les lignes groupées par destinataire : Destinataire, Dossier, Annonceur, Thème, Repiquage, Format, Qté, Entretien, Total ; bouton « Imprimer la fiche ». Legacy : fiche de préparation (détail et synthèse) téléchargeable en Excel ; l'atelier la donne en V1 à l'atelier avant le Colisage (Jeudi S-2) ; état `PreparationSyntheseUm.rdlc` (en-tête expéditeur = plateforme). La génération est faite côté navigateur (CLAUDE.md §3).
- Déclencheur : « Fiche de synthèse » (icône imprimante).
- Conditions : filtres courants de l'unitaire.
- Effet / message d'erreur : aperçu puis impression ; en legacy l'échec de rendu est avalé (réponse vide) : en cible une erreur doit être affichée.
- Sources : écran `ECR-COO-09d` ; legacy `Rapport.cs:105-172` (état `PreparationSyntheseUm.rdlc`), `ReportController.cs:14-40,44` (anciens ID provisoires RG-ADM-060, RG-ADM-063) ; spec `specs-existant-process.md §D` (EX-EXI-043), `specs-transverse.md §D` (EX-TRA-025)
- Questions liées : Q-287
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-247 — Pliage : saisie du comptage et passage à PRODUIT
- Origine : NOUVELLE
- Énoncé : l'action groupée « Plié : saisir le comptage » (sur les unités PRET ou EN_PROD) demande « Affiches comptées » (défaut = attendu) ; « Valider le comptage » passe les unités à PRODUIT. Message : « Comptage conforme. » ou « Écart de comptage : n affiche(s). Alerte qualité créée. » (dans la maquette l'alerte n'est pas réellement créée).
- Déclencheur : « Plié : saisir le comptage » (Pliage).
- Conditions : unités de type lot de pliage (`PL-nnnn`) ; pliage sans machine (REU-07).
- Effet / message d'erreur : unités → PRODUIT ; alerte qualité en cas d'écart (comportement cible à confirmer).
- Sources : écran `ECR-COO-09` (« Comptage pliage ») ; spec `specs-existant-process.md §D` (EX-EXI-042 : « Pliage : même processus sans machine »)
- Questions liées : Q-250
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-248 — 2 m² fixe unique (suppression de la distinction Vrac / Roulée)
- Origine : MODIFIÉE
- Énoncé : les préparations « Vrac » et « Roulée » sont fusionnées en un seul type « 2 m² fixe » ; la distinction n'est plus nécessaire et génère des lignes en plus. Dans la maquette le type de préparation de l'unitaire est « 2 m² fixe », « Collé » ou « Bus ».
- Déclencheur : intégration de la préparation ; affichage de l'état des réservations / de l'atelier fixe.
- Conditions : toute ligne de préparation fixe (types de préparation hors déroulant 17 à 21 et hors pliage 23).
- Effet / message d'erreur : une ligne, pas deux, par (destinataire × afficheur × thème).
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-501) ; legacy `p_integ_preparation.sql:100-147,239-249` (ancien ID provisoire RG-COO-041)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-249 — « Retirer » une préparation : suppression des UM et retour des répartitions à « A traiter »
- Origine : CONSERVÉE
- Énoncé : « Retirer préparation » remet les `tf_repart_calcul` de l'UM à `rpc_statut = 0`, `UM_id = NULL`, puis supprime l'UM. Legacy : aucune vérification des colis (la suppression échoue par contrainte étrangère si l'UM est dans un colis) ; `rpc_user` n'est pas mis à jour (seule la date). Cible : refus explicite si l'UM est dans un colis ; utilisateur tracé.
- Déclencheur : action « Retirer » (Préparation 2 m² fixe / Pliage / Bus), droit `retirer`.
- Conditions : UM dans aucun colis non supprimé ; UM non expédiée.
- Effet / message d'erreur : répartitions `* → 0` ; UM supprimée ; refus 409 si l'UM est dans un colis (« L'UM est dans un colis » : libellé à définir).
- Sources : legacy `PreparationService.cs:275-288`, `PreparationRepository.cs:336-387`, `tf_UM_colis.sql:10` (ancien ID provisoire RG-RPR-013) ; spec `specs-existant-process.md §D` (EX-EXI-042 : retour à 0 si l'UM est supprimée, EX-EXI-045)
- Questions liées : Q-271
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-250 — « Préparer » : l'UM et ses répartitions passent à « Préparé »
- Origine : CONSERVÉE
- Énoncé : l'action « Préparer » (liste des UM) fixe le statut cible 6 (Préparé) et l'applique à l'UM et à ses `tf_repart_calcul` (date et utilisateur mis à jour). Cible : statut d'unité PRODUIT (mapping « Préparé (6) = Produit »). Aucun contrôle du statut d'origine dans le service legacy ; gardes éventuelles côté vue / JS non lues.
- Déclencheur : action « Préparer » (liste des UM).
- Conditions : HYPOTHÈSE (Q-271) : seules les UM au statut 1 (En cours) ou 6 peuvent être préparées ; les UM à 3, 4, 7, 8 sont refusées (409).
- Effet / message d'erreur : UM et répartitions `1 → 6` ; historique.
- Sources : legacy `PreparationService.cs:294-299`, `PreparationRepository.cs:435-470` (ancien ID provisoire RG-RPR-014) ; spec `specs-existant-process.md §D` (EX-EXI-042) ; maquette `maquettes-autres-modules.md §0.6 point 6`
- Questions liées : Q-250, Q-271
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-251 — Pas de déplacement (drag and drop) après l'envoi d'une préparation
- Origine : NOUVELLE
- Énoncé : le déplacement manuel (drag and drop) d'éléments n'est plus autorisé après l'envoi d'une préparation ; à vérifier s'il s'agit d'un process ou d'un blocage système (revoir le rétro-planning). L'objet du déplacement (positions de trains ? lignes ?) n'est pas précisé ; la position d'un visuel est déjà « figée » à l'Instruction OK (RG-COO-201).
- Déclencheur : tentative de réordonnancement après réception de la préparation.
- Conditions : HYPOTHÈSE (Q-261) : s'applique au réordonnancement des positions / ordre des faces d'un dossier dont la préparation est reçue.
- Effet / message d'erreur : refus 409 ; libellé à définir.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-511 : ligne isolée, statut « A revoir Bao »), `specs-coordination.md §C` (EX-COO-050 : Q46 sur l'ordre des trains)
- Questions liées : Q-261
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
