### RG-COO-200 — Identifiant et version d'un train
- Origine : CONSERVÉE
- Énoncé : `train_id` = AA (2 derniers chiffres de l'année) + SS (semaine sur 2 chiffres) + secteur (3) + département (2) + commune (3) + n° d'emplacement (4) + n° de train (1) + version (1). La version vaut (max des versions des faces de statut 5 à 10 pour le même emplacement / train / semaine) + 1, sinon 0. Une instruction renvoyée après impression crée donc une nouvelle version du train.
- Déclencheur : passage d'une instruction à « Instruction ok » (transition possédée par coo1 ; effets de calcul décrits ici).
- Conditions : statuts pris en compte pour la recherche de version : 5, 6, 7, 8, 9, 10.
- Effet / message d'erreur : `train_id` et `version` posés sur les faces ; aucune erreur applicative (calcul).
- Sources : legacy `p_u_associe_train.sql:159-179,366-374` (ancien ID provisoire RG-COO-067, legacy-coordination.md) ; spec `specs-coordination.md §C` (EX-COO-021) ; écran `ECR-COO-05`
- Questions liées : Q-250
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-201 — Position dans le train (début, fin, fin-1, milieu)
- Origine : CONSERVÉE
- Énoncé : le code de position porté par l'instruction (`tip_ins_code`) fixe l'ordre des faces : 1 = début de train (ordre 0) ; 2 = fin de train (ordre 99) ; 3 = fin moins 1 (ordre 98) ; 4 = milieu (ordre 15) ; autre valeur = ordre égal au rang proposé. `ordre_propose` et `ordre_reel` sont alimentés à l'Instruction OK.
- Déclencheur : passage à « Instruction ok ».
- Conditions : le champ position est modifiable seulement tant que l'instruction n'est ni « Instruction ok » ni « A imprimer » (RG-COO-1xx, coo1).
- Effet / message d'erreur : faces passées au statut 2 avec leur ordre. En cible la position d'un visuel est « figée » après Instruction OK ; la règle de modification manuelle (début / fin de train) n'a pas d'écran d'édition dans la maquette (Q-COO-7 de la maquette).
- Sources : legacy `p_u_associe_train.sql:132-157`, `Enums.cs:274-286` (ancien ID provisoire RG-COO-065) ; spec `specs-coordination.md §C` (EX-COO-019, EX-COO-021, EX-COO-023) ; écran `ECR-COO-02`
- Questions liées : Q-261
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-202 — Répartition des thèmes sur les faces d'un train
- Origine : CONSERVÉE
- Énoncé : les exceptions (`instruction_detail`) affectent d'abord un thème / repiquage à une face précise (`ft_type = 'exception'`). Les faces restantes (`ft_type = 'face'`) reçoivent les thèmes d'`instruction_visuels` de type 10 au prorata des pourcentages (`nb_tot = int(pourcentage × nombre de faces)`), en parcourant les faces triées par secteur / département / commune / adresse. Les bandeaux à 100 % non traités en exception sont affectés à toutes les faces. Les thèmes de moins de 3 caractères sont complétés par `---` ; guillemets et apostrophes sont remplacés par des espaces.
- Déclencheur : passage à « Instruction ok » (manuel ou automatique).
- Conditions : `instruction_visuels.tpr_id = 10` ; la répartition doit totaliser 100 % pour chaque (dimension, type de préparation) sinon la sauvegarde est refusée par la règle de contrôle de l'instruction (coo1).
- Effet / message d'erreur : `theme`, `theme_id`, `repiquage`, `insv_id`, `ft_type` posés ; faces 0/1 → 2.
- Sources : legacy `p_u_associe_train.sql:81-111,181-345,347-363,377-394` (ancien ID provisoire RG-COO-066) ; spec `specs-existant-process.md §C` (EX-EXI-031) ; écran `ECR-COO-02`
- Questions liées : Q-257
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-203 — Faces d'entretien d'un train (pourcentage, afficheur « ENTRETIEN »)
- Origine : MODIFIÉE
- Énoncé : pour chaque (destinataire, thème, secteur, semaine, année, thème-repiquage, support, type), le nombre de faces d'entretien legacy = `round(nombre de faces × % d'entretien / 100)`, % par défaut 8 si nul, `nb > 0` ; faces créées avec `ft_type = 'entretien'`, statut 2, afficheur littéral « ENTRETIEN », identifiant de train finissant par 19, `ordre_propose = ordre_reel = 1`. Un bloc distinct traite la convention `VPS_75 101 0004` (Paris) ; aucune autre différence fonctionnelle n'a été trouvée entre les deux blocs. MODIFIÉE : la cible calcule l'entretien « à l'afficheur » (seuil, arrondi supérieur, voir RG-COO-238) ; le choix legacy (arrondi `round`, grain thème) ou cible (arrondi supérieur, grain afficheur) pour les faces d'entretien de train est à trancher.
- Déclencheur : passage à « Instruction ok ».
- Conditions : les faces d'entretien sont supprimées au retour de l'instruction à 0, 1, 4 ou 5 (RG-COO-206).
- Effet / message d'erreur : lignes `tf_face_train` d'entretien ; aucun message.
- Sources : legacy `p_u_associe_train.sql:401-439,578-583,555-699` (anciens ID provisoires RG-COO-068 et RG-RPR-027) ; spec `specs-existant-process.md §F` (EX-EXI-075), `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-508) ; écran `ECR-COO-02`, `ECR-ADM-05`
- Questions liées : Q-255, Q-256
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-204 — Campagne contrôlée : 15 % d'entretien et visuel en tête de train
- Origine : NOUVELLE
- Énoncé : pour une campagne contrôlée (CC), l'entretien est de 15 % et le visuel de la CC est placé en position 1 (début de train) automatiquement, sans intervention manuelle de la Coordination. Aujourd'hui la Coordination change cette position à la main.
- Déclencheur : Instruction OK automatique ou manuelle.
- Conditions : dossier marqué « campagne contrôlée » (repère « Contrôlée » ; ~12 % des trains dans les données MOCK).
- Effet / message d'erreur : % d'entretien 15 au lieu de 8 ; position 1 sur le visuel de la CC. La source de l'indicateur « contrôlée » n'est pas définie (Broadcast ou saisie).
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-508), `specs-existant-process.md §F` (EX-EXI-075) ; écran `ECR-COO-01` (données MOCK), `ECR-ADM-05` (« Campagne contrôlée (15 % et visuel en début de train) »)
- Questions liées : Q-257
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-205 — Garde-fous anti-doublons sur les faces et les afficheurs d'un train
- Origine : CONSERVÉE
- Énoncé : (1) si deux faces non entretien d'un même train partagent le même cadre (`cadr_ident`), la plus récente est conservée, les autres passent à 4 (Annulé) avec `train_id = NULL` ; (2) si un train a plusieurs afficheurs (`pers_ident`), tous prennent l'afficheur de la face la plus récente ; (3) les faces de statut 2 sans `train_id` après traitement sont supprimées.
- Déclencheur : fin du calcul des trains (Instruction OK).
- Conditions : `ft_type <> 'entretien'`.
- Effet / message d'erreur : annulation silencieuse de faces en legacy. En cible l'annulation d'une face doit écrire un historique (CLAUDE.md §6) et être visible au calcul.
- Sources : legacy `p_u_associe_train.sql:703-838` (ancien ID provisoire RG-COO-069)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-206 — Retour arrière de l'instruction : effacement du calcul des trains sauf « A imprimer »
- Origine : CONSERVÉE
- Énoncé : quand l'instruction repasse à 0, 1 ou 4 (ou 5 par la procédure), les faces d'entretien non au statut 5 sont supprimées et les faces non au statut 5 sont remises à blanc (thème, repiquage, train, version vidés, statut = code demandé). Les faces déjà « A imprimer » sont conservées. Pour le code 2, `p_u_associe_train` est rappelée. La transition d'instruction elle-même est possédée par coo1.
- Déclencheur : changement de statut d'instruction autorisé par la table de transitions (coo1).
- Conditions : instruction de statut initial ≠ 5 ; changement de statut effectif.
- Effet / message d'erreur : faces remises à blanc ; l'export des trains (RG-COO-210) ne reprendra que les faces recalculées au statut 2.
- Sources : legacy `p_u_statut_preparation.sql:24-64`, `TrainListeInstructionBll.cs:372-380,396-403` (ancien ID provisoire RG-COO-064) ; spec `specs-coordination.md §C` (EX-COO-020) ; `specs-existant-process.md §C` (EX-EXI-030)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-207 — Reprise de l'afficheur d'un panneau pour les faces « dernière minute »
- Origine : CONSERVÉE
- Énoncé : une nouvelle face prend l'afficheur, le nom et le destinataire des faces déjà présentes pour le même panneau (`RefPanel`) / semaine / année lorsque ces faces sont aux statuts 2, 5, 6, 7, 8, 9, 10. Après insertion, les faces 0/1 du même panneau reprennent l'afficheur des faces insérées ; pour les panneaux dont toutes les faces sont ≤ 4, la ressource est mise à jour (`ft_user_maj = 'UpdateRessource'`).
- Déclencheur : intégration des faces de trains (flux d'alimentation, coo1 ; règle d'aval portée ici).
- Conditions : `RefPanel` identique ; statuts cités.
- Effet / message d'erreur : cohérence de l'afficheur par panneau. Ne modifie pas un train en production (RG-COO-223).
- Sources : legacy `p_integ_train_affiches.sql:111-117,141-151,270-274,314-339` (ancien ID provisoire RG-COO-050)
- Questions liées : Q-282
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-208 — Couverture des visuels et passage automatique EN_ATTENTE → PRET d'une unité
- Origine : NOUVELLE
- Énoncé : une unité de production (train, UM, lot) est « En attente d'affiches » (EN_ATTENTE) tant que tous ses visuels (positions non fractionnées) ne sont pas couverts par le reçu ; elle passe automatiquement à « Prêt à produire » (PRET) quand tous les visuels sont couverts ou fractionnés. Couverture : chaque thème reçu alimente d'abord les unités dont le départ camion est le plus proche. Le reçu se compte au visuel (thème), pas par destinataire. La couverture est recalculée à chaque événement de réception, de fractionnement, de raccrochage, de suppression de train.
- Déclencheur : réception d'affiche (REC), fractionnement, raccrochage, suppression de train, passage à Instruction OK.
- Conditions : `EN_PROD` et au-delà ne repassent jamais en arrière (RG-COO-223).
- Effet / message d'erreur : statut d'unité mis à jour avec historique ; indicateurs du Suivi de prod (A, B, A−B, C).
- Sources : écran `ECR-COO-05` (« règle d'unité : EN_ATTENTE → PRET automatique ») ; spec `specs-ateliers-besoins.md PARTIE 6` (EX-PIL-501 : B = trains à 100 % de visuels reçus) ; `maquettes-autres-modules.md ECR-PIL-03` (Q41, couverture « départ le plus proche servi d'abord »)
- Questions liées : Q-251, Q-280
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-209 — Positions d'un train : fractionnée, couverte, limite par train
- Origine : NOUVELLE
- Énoncé : un train porte de 1 à N positions (A, B, C, D…). Une position est « fractionnée » quand son visuel est produit à part ; elle n'entre plus dans le besoin, ni dans les tiroirs, ni dans le nombre de faces du dispatch (faces = nombre de trains × positions non fractionnées). La limite N de positions par train est 4 (deck S7) ou 6 (code legacy, 6 contrats par `tf_train_export`) : valeur à trancher. Raccrocher un visuel à un train complet est refusé « Train complet ».
- Déclencheur : création / calcul d'un train, raccrochage, fractionnement.
- Conditions : N paramétrable (ECR-ADM-05).
- Effet / message d'erreur : refus « Train complet » au-delà de N.
- Sources : écran `ECR-COO-05`, `ECR-COO-05d`, `ECR-COO-10`, `ECR-ADM-05` ; legacy `TrainExportPrepaBll` (constante `NbMaxThemeParTrain = 6`, RG-COO-077) ; spec `specs-existant-process.md §C` (EX-EXI-033 : « jusqu'à 4 affiches » contre 6 thèmes)
- Questions liées : Q-253
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-210 — Export des trains : seules les faces « Instruction ok » partent et passent à « A imprimer / Prêt à produire »
- Origine : CONSERVÉE
- Énoncé : le bouton « Exporter les trains » ne retient que les faces au statut 2 (Instruction ok) et passe ces faces ainsi que les instructions exportées au statut 5 (A imprimer, libellé cible « Prêt à produire »). Les autres faces restent en attente. C'est le go des plateformes. Les faces proviennent de la grille filtrée.
- Déclencheur : action « Exporter les trains… » (Liste des trains).
- Conditions : face au statut 2 ; au moins un dossier exportable (RG-COO-211) ; périmètre d'ateliers de l'utilisateur.
- Effet / message d'erreur : faces 2 → 5, instruction 2 → 5, historique `ExporterTrains` (RG-COO-213) ; bouton Exporter désactivé si 0 dossier exportable.
- Sources : legacy `PreparationDeroulantsController.cs:71-134`, `PreparationDeroulantsService.cs:109-223`, `PreparationRepository.cs:1287-1440` (ancien ID provisoire RG-COO-070) ; spec `specs-coordination.md §C` (EX-COO-024), `specs-existant-process.md §C` (EX-EXI-033) ; écran `ECR-COO-05b`
- Questions liées : Q-251, Q-252
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-211 — Export des trains : dossiers exportables et décompte affiché
- Origine : NOUVELLE
- Énoncé : la modale « Exporter les trains · départ Sxx » annonce « n dossier(s) en Instruction OK : leurs faces passent « A imprimer », le go des plateformes » et « [n déjà exporté(s)] » ; un encadré d'avertissement liste les dossiers « En cours » qui ne partent pas. Le marquage `exporte` (date, utilisateur) n'est posé que sur les dossiers dont l'Instruction OK est AUTO ou MANUEL, non annulés, et dont la préparation est reçue. L'export ne dépend ni de la validation admin ni de la réception complète (RG-X-083).
- Déclencheur : ouverture de la modale puis clic sur « Exporter ».
- Conditions : départ (semaine) choisi ; n ≥ 1.
- Effet / message d'erreur : bouton désactivé si 0 dossier exportable ; journal de l'export.
- Sources : écran `ECR-COO-05b` ; spec `specs-coordination.md §A` (EX-COO-001), `§C` (EX-COO-024)
- Questions liées : Q-252
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-212 — Export des trains : jalon du jeudi 14 h, réservé à la Coordination
- Origine : NOUVELLE
- Énoncé : l'export est fait par la Coordination le jeudi à 14 h (jalon 6 du process) après vérification de la préparation des trains ; on commence par le MUI. Aucune restriction horaire ni de rôle n'est codée dans le legacy ni dans la maquette (info-bulle seulement). Urgences du vendredi : traitées à la main ou par renvoi (jalon 7).
- Déclencheur : action « Exporter les trains… ».
- Conditions : HYPOTHÈSE (Q-252) : pas de blocage serveur sur l'heure ; l'heure est un jalon de process matérialisé par l'alerte « Préparation non reçue » (deadline jeudi S-2 16 h, coo1) ; l'action est réservée aux profils `coord` (et `admin`) côté service.
- Effet / message d'erreur : si l'utilisateur n'est pas autorisé : 403 ; sinon export normal.
- Sources : legacy `PreparationDeroulantsController.cs:71-134` (aucun contrôle horaire, ancien ID provisoire RG-COO-070) ; spec `specs-coordination.md §C` (EX-COO-024), `§D` (EX-COO-044 jalons 6 et 7), `specs-existant-process.md §F` (EX-EXI-077) ; écran `ECR-COO-05b` (« Jeudi 14 h, par la Coordination »)
- Questions liées : Q-252, Q-286
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-213 — Export des trains : fichier, `tf_train_export`, simulation, historique, erreurs visibles
- Origine : MODIFIÉE
- Énoncé : l'export écrit `tf_train_export` (un enregistrement par train, 6 contrats au maximum) et génère le fichier CSV d'export (nom `ExportTrainsCIRCEversSurf<horodatage>`, répertoire configuré). La « Simulation export » génère le même fichier sans changer aucun statut. L'historique `ExporterTrains` est écrit. MODIFIÉE : en legacy, en cas d'exception le message est seulement tracé et l'`idExport` est tout de même retourné (l'erreur n'est pas visible) ; en cible, l'écriture des statuts, de `tf_train_export` et de l'historique se fait dans une transaction unique et une erreur d'export est remontée à l'utilisateur sans changement de statut.
- Déclencheur : « Exporter » / « Simulation export ».
- Conditions : au-delà de 6 contrats par train, le legacy trace « Train supérieur à 6 pour le TrainId » (module « CIRCE - Export Surf ») ; traitement du dépassement à décider (Q-253).
- Effet / message d'erreur : erreur applicative explicite (code 422/500 selon cause) ; aucun statut modifié en cas d'échec.
- Sources : legacy `PreparationRepository.cs:1218-1261,1251-1260`, `PreparationDeroulantsService.cs:513-580` (anciens ID provisoires RG-COO-070, RG-INT-045) ; CLAUDE.md §6 (atomicité) ; spec `specs-transverse.md §G` (EX-TRA-034)
- Questions liées : Q-253
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-214 — Export : ordonnancement « Paris » par alternance ville / commercial
- Origine : CONSERVÉE
- Énoncé : à l'export, les faces dont la convention de référence est incluse (paramétrage `ListeRefConventions`, structures, produits de `tr_parametre_alternance` actifs) et au statut 2 sont ordonnées par structure : liste « ville » (`IdTypeDossier == 3`) et liste « commercial » (≠ 3) du panneau de départ (le panneau le plus fourni si deux panneaux), alternées par pas de 10 en commençant par la plus longue liste (à égalité, commercial d'abord), le reliquat étant ajouté à la suite ; puis le second panneau. `ordre_reel` et `ordre_calcule` sont écrits, les faces passent à 5 et les instructions correspondantes à 5. Les autres trains sont exportés sans recalcul d'ordre.
- Déclencheur : « Exporter les trains… ».
- Conditions : `rpc_statut == 2` ; `IdProduit` renseigné pour le calcul ; paramètres `est_actif`.
- Effet / message d'erreur : faces 2 → 5. Anomalies du code legacy à ne pas reproduire sans décision : (a) le filtre produit est calculé mais jamais réaffecté ; (b) pour les exclusions, le code ajoute les non-exclus au lieu de filtrer ; (c) `ordre_reel` en `byte` : position = 10 × rang, débordement à partir de 26 faces par structure.
- Sources : legacy `PreparationDeroulantsService.cs:136-171,175-206,1068-1246`, `PreparationDeroulantsRepository.cs:1670-1695` (anciens ID provisoires RG-COO-071, RG-RPR-028)
- Questions liées : Q-255
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-215 — Export préparation (2 m² déroulants) : ateliers 5 et 6, statut 9 « Export prépa »
- Origine : CONSERVÉE
- Énoncé : « Export préparation » (et génération du fichier Caire) n'est autorisé que pour les ateliers 5 (Wissous 2 m²) et 6 (Nîmes 2 m²) : `ExportPrepaAutorise = (ate_id == 5 || 6)`. Les faces des trains choisis doivent être au statut 5 ou 9, sinon : « Les faces des trains ne sont pas dans le statut 'A imprimer' ! ». Les faces passent à 9 (Export prépa). Le fichier Caire ne retient que les faces des ateliers 5 et 6, avec 6 contrats par train.
- Déclencheur : « Export préparation » / « Exporter Caire » / « Générer fichier V2 ».
- Conditions : droit `train_preparation` (legacy) → profils `cheq`/`coord`.
- Effet / message d'erreur : faces 5 → 9 ; message ci-dessus si statut invalide.
- Sources : legacy `TrainPreparationBll.cs:22-23,90-99,257-291`, `TrainPreparationRepository.cs:253-269`, `TrainExportPrepaRepository.cs:43-67,124-151`, `PreparationDeroulantsService.cs:225-304` (anciens ID provisoires RG-COO-077, RG-COO-078) ; spec `specs-existant-process.md §C` (EX-EXI-035) ; écran `ECR-COO-07`
- Questions liées : Q-254
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-216 — Export préparation : plafond de 20 thèmes (couples thème / repiquage)
- Origine : MODIFIÉE
- Énoncé : le nombre de couples (thème, repiquage) distincts (faces déjà à 9 + nouvelles) ne doit pas dépasser 20 (`NbMaxThemeExportPrepa = 20` ; `QteMaxThemeMachineCaire = 20`). Message : « Le nombre de thèmes ajouté est supérieur à la capacité de la machine ! ». MODIFIÉE : en legacy le contrôle est fait après la mise à jour, l'exception est levée mais la mise à jour n'est pas annulée (ANO-13 : ne bloque rien) ; la cible bloque au-delà (README H6, EX-COO-024). L'extension à tous les exports (et non seulement Vendôme) est à confirmer.
- Déclencheur : « Export préparation » / « Exporter les trains… ».
- Conditions : ateliers 5 et 6 (RG-COO-215) ; la limite n'est pas bloquante pour la sélection (la sélection se fait avant), elle l'est pour l'enregistrement.
- Effet / message d'erreur : refus 422 sans aucune modification de statut (contrôle a priori, transaction) ; message ci-dessus.
- Sources : legacy `TrainPreparationBll.cs:22-23,257-291`, `p_u_exportTheme`, `p_s_face_train_export_caire` (anciens ID provisoires RG-COO-077, bdd.md §8) ; spec `specs-coordination.md §C` (EX-COO-024), `specs-existant-process.md §C` (EX-EXI-033, EX-EXI-035), `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-518 : limite saisie à la main) ; écran `ECR-GEN-01` (bloquant à 20 tiroirs, module GEN)
- Questions liées : Q-254
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-217 — « Au roulage » : affectation du rouleur, point de passage 9 → 10, suppression d'un thème
- Origine : CONSERVÉE
- Énoncé : après l'export préparation, la mise « Au roulage » (statut 10) affecte un rouleur aux faces de statut 9 de la semaine / atelier (`MiseAJourAuRoulage`). La suppression d'un thème de l'export (`MiseAJourAImprimer`) fait repasser ses faces de 9 à 5. En cible l'impression de la bague ou l'envoi du fichier à la machine fait passer l'unité de PRET à EN_PROD (RG-COO-299, point de non-retour).
- Déclencheur : « Au roulage » / suppression d'un thème / impression de bague.
- Conditions : faces au statut 9 ; rouleur obligatoire.
- Effet / message d'erreur : faces 9 → 10 ; 9 → 5 ; historique.
- Sources : legacy `TrainPreparationRepository.cs`, `TrainExportPrepaRepository.cs` (ancien ID provisoire RG-COO-077) ; écran `ECR-COO-07`, `ECR-COO-11a`, `ECR-GEN-03`
- Questions liées : Q-250
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-218 — « Changer statut » des faces : transitions autorisées contrôlées côté serveur
- Origine : MODIFIÉE
- Énoncé : « Liste des trains » : le dialogue ne propose que 2 → 5 et 5 → 10. « Trains › Préparation » (« Changer statut : A imprimer ») : les faces au statut 10, 5 ou 9 repassent à 5, sous la condition que toutes les faces de la sélection soient en 10, 5 ou 9 ; sinon « Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' ! ». MODIFIÉE : le legacy ne contrôle ces transitions que dans le front (le serveur applique le statut choisi à toutes les faces de la grille en session sans revérifier) ; la cible les contrôle dans le service avec table de transitions explicite (toute autre transition = 409).
- Déclencheur : « Changer statut ».
- Conditions : droit `train_changer_statut` (legacy) ; la ré-impression des bagues (retour de « Terminé » à « Imprimer ») est restreinte aux directeurs de plateforme et chefs d'équipe (EX-ADM-503).
- Effet / message d'erreur : faces mises à jour + historique ; 409 pour transition non listée.
- Sources : legacy `PreparationDeroulantsController.cs:1417-1431,1544-1556`, `TrainPreparationBll.cs:234-255`, `TrainPreparationRepository.cs:99-115` (ancien ID provisoire RG-COO-072) ; CLAUDE.md §6 ; spec `specs-ateliers-besoins.md PARTIE 10` (EX-ADM-503)
- Questions liées : Q-277, Q-286
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-219 — Annulation d'un thème de train : uniquement à « A imprimer »
- Origine : CONSERVÉE
- Énoncé : annuler un thème exige que le statut de la ligne et de toutes les faces du thème soit 5. Messages : « Le statut du thème ne permet pas l'annulation ! » ; « Toutes les faces du theme ne sont pas dans le statut 'A Imprimer' ». Les faces passent à 4 (Annulé), `train_id = NULL`, avec utilisateur et date.
- Déclencheur : « Annuler thème » (Suivi par thème).
- Conditions : `ligne.rpc_statut == 5` et toutes les faces = 5 ; droit `train_annuler_theme` (énuméré, usage dans les vues non retrouvé).
- Effet / message d'erreur : faces 5 → 4 ; messages ci-dessus (409).
- Sources : legacy `TrainSuiviThemeBll.cs:181-202`, `TrainSuiviThemeRepository.cs:97-114`, `TrainSuiviThemeController.cs:90-110` (ancien ID provisoire RG-COO-073)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
