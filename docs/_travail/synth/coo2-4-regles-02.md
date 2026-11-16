### RG-COO-220 — « Débloquer semaine » : trains « A imprimer » d'un atelier repassent à « Instruction ok »
- Origine : CONSERVÉE
- Énoncé : retour en arrière de masse sur une semaine / un atelier : les faces et les instructions au statut 5 repassent à 2. Refus : « Il n'y a pas de données à traiter ! » s'il n'y a ni train ni instruction ; « Toutes les données ne sont pas au statut 'A imprimer' ! » si une face n'est pas à 5.
- Déclencheur : bouton « Débloquer semaine » (Suivi par thème).
- Conditions : droit `train_debloquer_semaine` (legacy) ; `train_id` non nul ; instructions au statut 5 ; aucune face en production (RG-COO-223).
- Effet / message d'erreur : faces et instructions 5 → 2 ; `ft_user_maj`, `instr_user`, dates ; historique. Refus : 409 avec les messages ci-dessus.
- Sources : legacy `TrainSuiviThemeBll.cs:496-522`, `TrainSuiviThemeRepository.cs:257-323`, `TrainSuiviTheme/Index.cshtml:105-114` (ancien ID provisoire RG-COO-074) ; spec `specs-existant-process.md §C` (EX-EXI-030 : retour 5 → 2)
- Questions liées : Q-250
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-221 — Fractionner un train
- Origine : MODIFIÉE
- Énoncé : cible (maquette) : « Fractionner » lance le train sans ses visuels manquants. Exige que le train soit EN_ATTENTE et qu'au moins un visuel soit reçu ; le train passe à PRET, est marqué `fractionne`, les positions manquantes sont marquées fractionnées (produites à part), historique et journal écrits. Message : « Aucun train fractionnable (il faut au moins un visuel reçu). » ; en cas de succès : « n train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part. ». Legacy : le fractionnement (uniquement statut 5) incrémente le dernier chiffre (version) du `train_id` des faces sélectionnées (ressources / jours choisis) si le train contient plusieurs faces ; messages « Le statut du thème ne permet pas le fractionnement ! » et « Pas de données à traiter ! ». Usage métier : un thème en retard est retiré du train d'origine pour créer une ligne à part (livraisons tardives, Nîmes).
- Déclencheur : action « Fractionner » (Liste des trains ; Suivi par thème, droit `train_regrouper`).
- Conditions : maquette : EN_ATTENTE et ≥ 1 visuel reçu ; legacy : statut 5 ; train non en production (RG-COO-223).
- Effet / message d'erreur : voir Énoncé ; 409 si train non fractionnable. La sémantique legacy (version du `train_id`) et cible (position fractionnée + statut d'unité) est à unifier.
- Sources : legacy `TrainSuiviThemeBll.cs:214-262,531-665` (ancien ID provisoire RG-COO-075) ; spec `specs-existant-process.md §C` (EX-EXI-036, EX-EXI-078), `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503) ; écran `ECR-COO-05`
- Questions liées : Q-261
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-222 — Raccrocher un visuel à un ou plusieurs trains
- Origine : MODIFIÉE
- Énoncé : « Raccrocher un visuel » ajoute un visuel (thème) à un train non encore produit. Cible (maquette) : le visuel proposé est du même site, même semaine, même atelier, non exclu, non annulé ; limite de positions : « Train complet » ; en masse, la fonction écarte les trains en production, d'un autre atelier ou départ, complets, ou qui ont déjà le visuel, et annonce « n train(s) recevront ce visuel » ; le raccrochage ajoute une position et une ligne de préparation (`qte += nb`). Il n'y a pas de raccrochage automatique pour les trains restant à produire : l'atelier choisit fractionner ou raccrocher. Legacy : le raccrochage regroupe les versions supérieures d'un train sur la première version et ignore les trains dont une face n'est pas à 5. Cible : le raccrochage en masse ne doit pas dégrader avec un grand nombre de lignes (le legacy « bugge »).
- Déclencheur : action « Raccrocher un visuel » (unitaire ou en masse) ; événement RG-X-075.
- Conditions : train non EN_PROD (RG-COO-223) ; position disponible (RG-COO-209) ; droit `train_regrouper`.
- Effet / message d'erreur : position + ligne de préparation ajoutées ; couverture recalculée (RG-COO-208) ; 409 si train complet ou en production.
- Sources : legacy `TrainSuiviThemeBll.cs:214-262,531-665` (ancien ID provisoire RG-COO-075) ; spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503), `PARTIE 5` (EX-SCR-506), `specs-existant-process.md §C` (EX-EXI-036) ; écran `ECR-COO-05d`
- Questions liées : Q-253, Q-261
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-223 — Point de non-retour : un train EN_PROD ne se modifie, ne se supprime pas
- Origine : NOUVELLE
- Énoncé : `EN_PROD` (« En production », posé à l'impression de la bague ou à l'envoi du fichier à la machine) est un point de non-retour : toute modification du train (raccrochage, fractionnement, changement de positions, suppression) est refusée. Message : « Train déjà en production : impossible de le modifier (point de non-retour). ». Les unités déjà en production ne sont jamais retirées par « Rendre la main » (RG-COO-243). Toute modification Broadcast sur un train en production est seulement tracée et signalée (RG-X-077).
- Déclencheur : toute action de modification de train / d'unité.
- Conditions : statut d'unité ∈ {EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE}.
- Effet / message d'erreur : refus 409 avec le message ci-dessus.
- Sources : écran `ECR-COO-05`, `ECR-COO-05e`, `ECR-COO-09b`, `ECR-GEN-03` ; `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-509 : exception demandée pour fixe et colle)
- Questions liées : Q-268
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-224 — Créer un train de pré-test ou d'entretien
- Origine : NOUVELLE
- Énoncé : la Coordination peut créer un train de pré-test ou d'entretien (une campagne devient contrôlée et il faut ajouter de l'entretien). Champs : Atelier (déroulants du site), Départ (S ≥ semaine en production), Type (Pré-test / Entretien), Nombre de trains (1 à 9), Visuel (thèmes de l'atelier, S ≥ départ), Destinataire (du site). Refus : « Choisissez un visuel et un destinataire. ». Crée `TR-Pnnnn`, statut EN_ATTENTE, une position, afficheur = premier afficheur du destinataire.
- Déclencheur : « Train de pré-test… » (Liste des trains).
- Conditions : atelier déroulant du site ; l'Instruction OK verrouille positions et entretien (impact non traité par la spec).
- Effet / message d'erreur : train créé + historique ; message ci-dessus ; couverture recalculée.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-505 : « Aujourd'hui les pré-tests sont gérés hors process ») ; écran `ECR-COO-05c`
- Questions liées : Q-258
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-225 — Supprimer un train avec motif
- Origine : NOUVELLE
- Énoncé : suppression d'un train avec motif obligatoire choisi parmi : « Affichage qui ne se fait pas », « Ville de Paris : affiche à ne pas poser », « Pré-test annulé », « Autre ». Refus si le train est en production. Après suppression, la maquette recalcule la couverture des quantités.
- Déclencheur : « Supprimer… » (fiche train) puis « Supprimer le train ».
- Conditions : train non EN_PROD (RG-COO-223) ; motif renseigné.
- Effet / message d'erreur : train supprimé (annulé avec historique, pas de suppression physique) ; message « Train déjà en production… » sinon.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-505 : « Ville de Paris : affiches à ne pas mettre, parfois seule affiche du train ») ; écran `ECR-COO-05a`, `ECR-COO-05e`
- Questions liées : Q-259
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-226 — Duplication d'un train (administration)
- Origine : CONSERVÉE
- Énoncé : « Dupliquer train » copie les faces d'un train source N fois vers des trains cibles dont l'identifiant augmente de 190 à chaque exemplaire ; les copies sont créées au statut 5 (A imprimer). Le champ « Afficheur » du formulaire est stocké dans `pers_nom` (le paramètre s'appelle `@annonceur`). Le paramètre est journalisé dans `tt_log`. Aucune validation de saisie en legacy.
- Déclencheur : écran Administration › Dupliquer train.
- Conditions : droit `duplication_train` (non attribuable via l'écran legacy, RG-ADM-013) ; usage métier incertain (« trains de remplacement »).
- Effet / message d'erreur : insertion de N × (faces du train source) ; en cible validations de saisie (train source existant, N ≥ 1). Aucune spec de la cible ne mentionne la duplication.
- Sources : legacy `DuplicationTrainController.cs:22-34`, `DuplicationTrainBll.cs:12-17`, `p_u_duplication_train.sql:13-19,94,100-110` (ancien ID provisoire RG-COO-079) ; legacy-admin.md RG-ADM-013
- Questions liées : Q-260
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-227 — Sélection d'un nombre donné de trains (« les N premiers »)
- Origine : NOUVELLE
- Énoncé : un outil de la barre du tableau « Sélectionner les [N] premiers trains » (N saisi, défaut 60) coche les lignes jusqu'à N trains cumulés (somme des `nb`), sans couper une ligne ; si la ligne suivante dépasse N : message « n train(s) sélectionné(s), sur m ligne(s)… la ligne suivante en compte k et dépasserait N. ». Cas d'usage : filtrer les trains de 4 sur une destination et en prendre 60 (un opérateur).
- Déclencheur : action de l'outil de sélection (Liste des trains, Préparation).
- Conditions : l'ordre « premiers » = ordre d'affichage courant du tableau (HYPOTHÈSE, spec muette).
- Effet / message d'erreur : sélection modifiée ; aucun effet métier.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-510) ; écran `ECR-COO-05`, `ECR-COO-07`
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-228 — Filtres de la liste des trains : thèmes, nombre de visuels, 20 tiroirs, atelier
- Origine : NOUVELLE
- Énoncé : la liste des trains offre les filtres : N° de dossier, Départ (semaine), Atelier (déroulant), Machine, Statut (7 valeurs), + Destinataire, Annonceur, Thème (trains contenant l'un des thèmes sélectionnés, choix multiple), Afficheur, « Trains de » (1 à 4 visuels). Le filtre Thème permet de répartir un ou plusieurs thèmes par opérateur au roulage et de réduire les confusions. Le périmètre est limité aux ateliers de l'utilisateur ; sélection par défaut = semaine suivante.
- Déclencheur : affichage / filtrage.
- Conditions : périmètre d'ateliers de l'utilisateur (RG-COO-092 legacy, coo1).
- Effet / message d'erreur : lecture seule ; aucune erreur.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-509) ; écran `ECR-COO-05` ; legacy `TrainSuiviThemeBll.cs:31-98` (périmètre, ancien ID provisoire RG-COO-092)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-229 — Visibilité du n° de panneau Broadcast pour chefs d'équipe et coordinateurs
- Origine : NOUVELLE
- Énoncé : le n° de panneau Broadcast (6 chiffres, un par train identique) est affichable (colonne masquée par défaut) par les chefs d'équipe et les coordinateurs dans l'écran Préparation / Liste des trains, pour répondre aux questions en cas de non-conformité ; il n'est visible aujourd'hui que d'un seul utilisateur.
- Déclencheur : affichage de la colonne.
- Conditions : profil `cheq` ou `coord` (le rôle visé « Patrick » n'est pas défini : Q-286).
- Effet / message d'erreur : colonne visible ; sinon masquée côté serveur (champ non renvoyé) pour les autres profils.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-512) ; écran `ECR-COO-05`
- Questions liées : Q-286
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-230 — Suivi par thème (vue besoin) : calcul du besoin, du couvert et du pré-assemblage
- Origine : MODIFIÉE
- Énoncé : une ligne par thème présent dans les trains filtrés (si un filtre Thème est posé, seuls les thèmes choisis ; les indicateurs et le besoin ignorent le filtre Statut). Colonnes : Annonceur · thème, Dossier, Besoin (trains) = somme des `nb`, Entretien = `qteEnt − qte`, Reçu, Couvert = reçu ≥ attendu (Oui / Non), Emplacement (allée-rayon des affiches), Pré-assemblé (« Fait » / « — »). Ligne teintée si non couvert. Legacy : l'écran sert à cocher les affiches reçues, décocher celles à fractionner, supprimer les thèmes inutiles et uniformiser l'intitulé d'un annonceur ; en cible le reçu vient de la Réception (plus de saisie).
- Déclencheur : affichage de la vue besoin.
- Conditions : droit `train_suivi_theme` (legacy) → `cheq` / `coord`.
- Effet / message d'erreur : lecture seule + actions groupées (RG-COO-233).
- Sources : écran `ECR-COO-06` ; spec `specs-existant-process.md §C` (EX-EXI-034, EX-EXI-035), `specs-ateliers-besoins.md PARTIE 2` (EX-COO-509) ; legacy `TrainSuiviThemeBll.cs:31-98`
- Questions liées : Q-263, Q-280
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-231 — Exclusion automatique des thèmes « ne pas afficher » et « reste en place »
- Origine : NOUVELLE
- Énoncé : les thèmes « ne pas afficher » et « reste en place » sont exclus automatiquement de la préparation (fixe) et du suivi par thème (déroulant). Aujourd'hui l'exclusion est manuelle dans le suivi par thème (ex. « Paris Privatisé » : 2e thème non envoyé aux plateformes). Les thèmes exclus sortent automatiquement de la liste ; la liste des exclus est affichée en annotation ; au déroulant ils ne sont pas pris en compte dans le besoin (Traitement = tag « Ne pas afficher / Reste en place (Broadcast) »). Le reste en place est aussi retiré de la quantité de la ligne attendue « Broadcast » (RG-AT-03, coo1).
- Déclencheur : intégration de la préparation / affichage de la préparation.
- Conditions : indicateur `exclu` ou `EstResteEnPlace` fourni par Broadcast (source exacte non établie).
- Effet / message d'erreur : thèmes exclus des tableaux ; aucun refus.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-502, EX-COO-509) ; `specs-coordination.md §E` (EX-COO-034, EX-COO-046) ; `specs-existant-process.md §C` (EX-EXI-034) ; écran `ECR-COO-02`, `ECR-COO-09`
- Questions liées : Q-263
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-232 — Suivi par thème réservé aux dossiers avec commentaire de préparation (cible)
- Origine : NOUVELLE
- Énoncé : en cible, le suivi des thèmes n'est nécessaire que si le dossier a un commentaire de préparation ; l'Instruction OK automatique (règle de Nariman : pas de commentaire ET nombre d'exceptions = quantité) dispense de ce suivi. En maquette cependant la vue « Suivi par thème » liste tous les thèmes des trains.
- Déclencheur : affichage / traitement du suivi par thème.
- Conditions : à confirmer (EX-COO-509 contre maquette).
- Effet / message d'erreur : aucun effet tant que Q-263 n'est pas tranchée.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-509, EX-REC-524) ; écran `ECR-COO-06`
- Questions liées : Q-263
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-233 — Pré-assemblage : marquer / désassembler par thème
- Origine : MODIFIÉE
- Énoncé : « Marquer pré-assemblé » (primaire) et « Désassembler » fixent l'indicateur `pre_assemblage` des faces / thèmes sélectionnés ; journal « n visuel(s) pré-assemblé(s) ». L'indicateur est initialisé à vrai si un train du thème est déjà en production. Dans la vue Préparation, « Pré-assemblage » = « Fait » si tous les visuels non fractionnés du train sont pré-assemblés. Legacy : le bouton inverse l'indicateur face par face sans condition de statut.
- Déclencheur : actions groupées du Suivi par thème.
- Conditions : aucune condition de statut en legacy ; la cible peut refuser sur un thème non couvert (non spécifié).
- Effet / message d'erreur : indicateur mis à jour + historique.
- Sources : legacy `TrainSuiviThemeBll.cs:442-485` (ancien ID provisoire RG-COO-076) ; écran `ECR-COO-06`, `ECR-COO-07` ; spec `specs-existant-process.md §C` (EX-EXI-035, EX-EXI-037)
- Questions liées : Q-262
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-234 — Pré-assemblage 8 m² par client ou par destinataire
- Origine : NOUVELLE
- Énoncé : le pré-assemblage 8 m² peut se faire par client (en totalité, comme aujourd'hui) et par destinataire (idéalement avec filtre sur le n° de département) ; priorité au destinataire pour Nîmes, aux gros volumes pour Wissous.
- Déclencheur : action de pré-assemblage.
- Conditions : thèmes 8 m² (ateliers 7 et 8).
- Effet / message d'erreur : indicateur de pré-assemblage au niveau (thème × destinataire) ; modèle de données à définir.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-507) ; `specs-existant-process.md §C` (EX-EXI-037 : pré-assemblage par client en totalité, pas partiel)
- Questions liées : Q-262
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-235 — Préparation (vue prepa) : colonnes, teinte, filtre par statut A imprimer
- Origine : MODIFIÉE
- Énoncé : le tableau Préparation liste : Train, Destinataire, Statut, Positions, Nb trains, Pré-assemblage, Rouleur (nom ou « — »), Départ camion ; masquées : Afficheur, Atelier, Machine, Bague, Colis. Teinte : En attente → alerte forte ; Prêt sans rouleur → info. Legacy : filtre statut « A imprimer » par défaut, destinataire prioritaire, format 2 m² scro (vs Venusial), pré-assemblé = « Fait » ; encadré résultat (lignes / affiches / tiroirs) ; export Excel (suppression de colonnes B, D, E). Actions groupées : Choisir le rouleur, Générer les fichiers (module GEN), Imprimer les bagues. Vue ligne « annonceur 1 – thème 1 / annonceur 2 – thème 2 » demandée (EX-SCR-508).
- Déclencheur : affichage de la vue prepa.
- Conditions : droit `train_preparation` → `cheq` / `coord`.
- Effet / message d'erreur : lecture + actions groupées (RG-COO-236, RG-COO-299).
- Sources : écran `ECR-COO-07` ; legacy `TrainPreparationBll.cs:31-109` ; spec `specs-existant-process.md §C` (EX-EXI-035), `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-508)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-236 — Choisir le rouleur d'une ou plusieurs lignes de trains
- Origine : NOUVELLE
- Énoncé : l'action groupée « Choisir le rouleur… » ouvre la modale « Rouleur de n ligne(s) de trains » : liste des opérateurs du site (« Rouleur N1… » avec poste « Table k ») ; « Affecter » écrit le rouleur sur les lignes sélectionnées. Une ligne Prêt sans rouleur est signalée. Legacy : le rouleur est choisi au roulage (`MiseAJourAuRoulage`) et à l'impression de la bague.
- Déclencheur : « Choisir le rouleur… » / « Affecter ».
- Conditions : opérateurs du site de l'atelier ; trains non EN_PROD pour une réaffectation sans effet de bord (HYPOTHÈSE).
- Effet / message d'erreur : `rouleur_id` mis à jour + historique.
- Sources : écran `ECR-COO-07` ; legacy `TrainPreparationRepository.cs` (ancien ID provisoire RG-COO-077) ; spec `specs-existant-process.md §C` (EX-EXI-037 : choix du nom du rouleur)
- Questions liées : Q-276
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-237 — Suivi 8 m² (demies) : saisie en ligne et reste à faire
- Origine : NOUVELLE
- Énoncé : le tableau Suivi 8 m² (sans sélection) liste les thèmes 8 m² : Site (si Tous), Annonceur · thème, Besoin, Reçu, Demies haut (nombre ≥ 0, éditable en ligne), Demies bas (éditable), 8 m² finales (éditable), Reste à faire = besoin − finales. Teinte : reçu < besoin → alerte forte ; reste = 0 → OK. Chaque modification écrit au journal « 8 m² : <champ> = <valeur> ». Remplace un Excel hors Circé (PROC-06 ; EX-EXI-037 : création de demies haut / bas, production de l'affiche complète, anticipation possible avant composition des trains).
- Déclencheur : saisie dans une cellule éditable.
- Conditions : valeur entière ≥ 0 ; thèmes d'ateliers 8 m² (7 et 8) ; modification historisée par utilisateur et date. La colonne « Création demies haut / bas (Nîmes) » de la spec peut être propre à Nîmes (Q-264).
- Effet / message d'erreur : valeur enregistrée avec historique ; valeur négative ou non numérique : refus 400.
- Sources : écran `ECR-COO-08` ; spec `specs-ateliers-besoins.md PARTIE 6` (EX-PIL-502) ; `specs-existant-process.md §C` (EX-EXI-037)
- Questions liées : Q-264
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-238 — Entretien calculé à l'afficheur (fixe, pliage, bus, trains)
- Origine : MODIFIÉE
- Énoncé : l'entretien est calculé au grain « afficheur » : aucun entretien en dessous de 3 affiches (seuil paramétrable) ; sinon `ceil(quantité × % entretien / 100)` avec minimum 1 (arrondi « supérieur » paramétrable) ; le % par défaut est 8 et modifiable à la préparation (jusqu'à 30 % dans la fiche dossier ; le client, notamment les Villes, envoie ce qu'il veut) ; la quantité à produire = quantité + entretien (« Total »). Le % d'entretien saisi dans Broadcast est repris sans ressaisie. MODIFIÉE : legacy = quantité d'entretien fournie par Broadcast à l'intégration (fixe/pliage, `p_integ_preparation.sql:121,160`), entretien par thème ou par ville, faces d'entretien arrondies par `round` pour le déroulant (RG-COO-203).
- Déclencheur : intégration de la préparation, modification du % d'entretien, calcul des lignes de l'unitaire.
- Conditions : valeurs 3 / supérieur / afficheur = valeurs par défaut de la maquette (à valider) ; pour un dossier de train le % n'est modifiable que si l'Instruction OK est « En cours » (coo1).
- Effet / message d'erreur : colonnes Entretien et Total des lignes ; info-bulle montrant le % d'entretien, la valeur cible et la valeur « ville » de la méthode actuelle.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-501), `PARTIE 4` (EX-FIX-505, EX-FIX-508), `specs-existant-process.md §F` (EX-EXI-075) ; écran `ECR-COO-09`, `ECR-COO-02`, `ECR-ADM-05` ; legacy `p_integ_preparation.sql:121,160` (ancien ID provisoire RG-COO-044 pour les mises à jour de quantité)
- Questions liées : Q-256
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-239 — Modifier la quantité à produire par afficheur si l'entretien reçu est insuffisant
- Origine : NOUVELLE
- Énoncé : les ateliers du fixe et du pliage peuvent modifier la quantité à produire d'une ligne (par afficheur) lorsque la quantité d'entretien reçue est insuffisante, afin de connaître la marge (affiche déchirée, entretien non reçu) et de ne pas tout consommer pour les premiers afficheurs ; une colonne « entretien par afficheur » est affichée. Pour les CG, les quantités d'entretien reçues en plus peuvent être ajoutées (EX-FIX-506, module REC).
- Déclencheur : saisie dans la colonne quantité de l'unitaire.
- Conditions : ligne non en production ; règles de recalcul des autres quantités non précisées.
- Effet / message d'erreur : quantité mise à jour avec historique ; refus si valeur négative (400).
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-505, EX-FIX-508, EX-FIX-506) ; `specs-existant-process.md §F` (EX-EXI-075) ; écran `ECR-COO-09`
- Questions liées : Q-269
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
