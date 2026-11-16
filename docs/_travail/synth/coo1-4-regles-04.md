### RG-COO-115 — Prérequis des flux Broadcast → Circé et ordre fixe
- Origine : CONSERVÉE
- Énoncé : le traitement d'intégration vérifie l'existence de l'interface de chargement du premier flux avant tout flux (sinon arrêt avec l'erreur explicite « IdInterface non récupéré ! ») puis enchaîne dans l'ordre fixe : destinataires → préparations fixe/pliage → trains d'affiches/instructions (déroulants). Après la préparation, Broadcast est notifié (RG-COO-125) ; après les trains, les données intégrées sont supprimées côté PEX (RG-COO-131).
- Déclencheur : passage du traitement d'intégration (RG-COO-103).
- Conditions : flux déclaré dans `FluxChargement` (`Flux_Destinataire`).
- Effet / message d'erreur : interface absente ⇒ arrêt explicite (le legacy lève une NullReferenceException sans message si la ligne n'existe pas : défaut corrigé).
- Sources : legacy `BLL/BatchAlimBll.cs:34-50,91-124,129-163` ; `REP/BatchAlimRepository.cs:46-57` (ancien ID provisoire RG-COO-040 ; RG-INT-001, RG-INT-002) · spec EX-TRA-039
- Questions liées : Q-005
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-116 — Journal de chargement par flux et échec : état partiel assumé et rejouable
- Origine : MODIFIÉE
- Énoncé : chaque flux écrit un journal de chargement (début : statut 1 ; fin : 0 succès, 2 échec ; le statut 6 « warning » du legacy n'est jamais utilisé). En cas d'exception : journal « Echec » (message nettoyé), les flux suivants ne sont pas exécutés ; les flux déjà terminés restent validés (pas de transaction globale) ; le passage est rejouable car l'intégration est idempotente (RG-COO-102). MODIFIÉE : cible = erreur d'un flux visible dans l'écran de suivi des chargements et alertée (non seulement dans `tt_log`), message d'erreur sans concaténation SQL.
- Déclencheur : exception dans un flux.
- Conditions : exception applicative ou SQL.
- Effet / message d'erreur : journal `FluxChargement` 2 + alerte technique ; rien n'est supprimé côté Broadcast si l'intégration a échoué.
- Sources : legacy `BLL/BatchAlimBll.cs:47-49,55-86` ; `REP/BatchAlimRepository.cs:29-30,63-70,89-97` (ancien ID provisoire RG-INT-002) · règle projet CLAUDE.md §6
- Questions liées : Q-005
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-117 — Délai d'attente, journalisation et secrets des traitements d'échange
- Origine : MODIFIÉE
- Énoncé : les traitements d'échange (lecture/écriture de grosses volumétries) n'ont pas de délai de commande infini : timeout paramétré, journal écrit à chaque fin de flux (pas de journal non vidé en cas de plantage) ; aucun identifiant ni mot de passe en clair dans la configuration (secrets externalisés, ISO 27001).
- Déclencheur : exécution des traitements.
- Conditions : configuration par environnement.
- Effet / message d'erreur : échec explicite après timeout ; mots de passe absents du dépôt.
- Sources : legacy `REP/BatchAlimRepository.cs:38` (`Int32.MaxValue`) ; `ToolBll.cs:57-87` (ancien ID provisoire RG-INT-008) · spec EX-TRA-038 ; Q-010
- Questions liées : Q-010
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-118 — Flux destinataires : seules les adresses de livraison actuelles ou futures
- Origine : CONSERVÉE
- Énoncé : les adresses lues dans Broadcast sont filtrées : conservées si `DateDebutPivot > maintenant` OU (`DateDebutPivot ≤ maintenant` ET `maintenant ≤ DateFinPivot`) ; les périodes échues sont ignorées. La cible permet de gérer des « annule et remplace » (dates de validité : ne garder que la dernière donnée valide, EX-TRA-512/514).
- Déclencheur : flux destinataires.
- Conditions : filtre sur l'ensemble de `P_GetAdresseLivraisonAfficheur`.
- Effet / message d'erreur : les lignes retenues alimentent la table de travail puis l'intégration ; test : adresse échue ignorée.
- Sources : legacy `REP/BatchAlimRepository.cs:102-110,116-156` ; `BLL/BatchAlimBll.cs:60-74` (ancien ID provisoire RG-INT-003) · spec ateliers EX-TRA-512, EX-TRA-514 (A15 slide 15 #2, S L59, L69) ; EX-EXI-015
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-119 — Intégration des destinataires par type de destination : création et mise à jour, jamais de suppression
- Origine : CONSERVÉE
- Énoncé : l'intégration crée ou met à jour le destinataire et son adresse principale selon le type de destination Broadcast, avec une clé PEX par type : 1 Plateforme (`IdSiteCCF`), 2 Site (`IdSiteCCF`), 3 Société sous-traitante (`IdTiers`), 4 Afficheur (`IdRessource`), 5 Dépôt (`IdDepot`). Création : actif = 1, dispatch = 'O' ; l'adresse n'est insérée que si le destinataire n'en a aucune ; mise à jour de l'adresse seulement si le nom correspond ; `lieu_dit` = lieu-dit + point de remise tronqué à 50 caractères ; un destinataire absent du flux n'est ni désactivé ni supprimé. Défaut à corriger : l'adresse est jointe sur la clé PEX sans le type (site et plateforme partagent `IdSiteCCF`) ⇒ adresse possiblement affectée au mauvais destinataire.
- Déclencheur : flux destinataires.
- Conditions : existence testée sur (clé PEX, type).
- Effet / message d'erreur : upsert ; la jointure d'adresse inclut le type (correction).
- Sources : legacy `SQL/p_integ_destinataire.sql:31-86,152-206,273-327,394-448,514-568` ; `circe-develop/docs/REVIEW_Database_proc.md:161-163` (ancien ID provisoire RG-INT-004) · spec EX-EXI-015
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-120 — Transporteur et tarif par défaut pour chaque couple destinataire × atelier
- Origine : CONSERVÉE
- Énoncé : en fin d'intégration des destinataires, pour chaque destinataire et chaque atelier (≠ 0) sans ligne de transport, une ligne est créée : ateliers 1, 2, 5, 7 → transporteur 2, tarif `X24` ; ateliers 3, 4, 6, 8 → transporteur 2, tarif `CX` ; autres ateliers → transporteur 1, tarif `CCF`. Valeurs en dur dans le legacy, à porter en paramètre (consommé par Expédition/Production, hors périmètre).
- Déclencheur : flux destinataires.
- Conditions : `NOT EXISTS (dest_id, ate_id)` ; `ate_id ≠ 0`.
- Effet / message d'erreur : alimentation de `tr_ate_dest_trans` ; signification métier des tarifs incertaine (INCERTAINE dans l'analyse).
- Sources : legacy `SQL/p_integ_destinataire.sql:644-700` (ancien ID provisoire RG-INT-005) · bdd.md §6
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-121 — Routage d'une prépa fixe/pliage vers un atelier et création des lignes à traiter
- Origine : CONSERVÉE
- Énoncé : une prépa Broadcast est routée : type de préparation 23 → atelier pliage (Wissous 2, Nîmes 3, DBG 9, DBG Lyon 10) ; autres types → 2 m² fixe (Wissous 1, Nîmes 4) ; site inconnu → atelier 0 ; les déroulants (types 17 à 21, 28) sont exclus. Une ligne de répartition est insérée au statut 0 (« À traiter ») pour chaque détail de prépa. Condition : `IdSiteCCF ∈ {39, 40, 43, 44}`, statut Broadcast 133 (envoyée), `rpc_statut ≠ 4`. Le type 28 est absent de la liste d'exclusion du second `update` de statut (17-21 seulement) : à clarifier. Le statut des lignes de répartition/UM après création appartient à coo2.
- Déclencheur : flux préparation (RG-COO-115).
- Conditions : voir énoncé ; correspondances en paramètre (référentiel, Q-227).
- Effet / message d'erreur : insertion `tf_repart_calcul` à 0 ; atelier 0 ⇒ ligne créée mais signalée (donnée de référence manquante) ; bascule des lignes attendues : RG-COO-086.
- Sources : legacy `SQL/p_integ_preparation.sql:100-147,239-249,260-264` (ancien ID provisoire RG-COO-041) · spec EX-EXI-017 (EX-COO-046)
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-122 — Une prépa fixe/pliage renvoyée n'est intégrée que si la précédente est annulée
- Origine : CONSERVÉE
- Énoncé : si une ligne (`IdPreparationDetail` + dossier) existe déjà avec `rpc_statut ≠ 4`, la tentative est journalisée et la ligne de travail passe à 4 (annulée) ; l'intégration n'a lieu que si `IdPreparationDetail` n'existe pas encore. Une prépa renvoyée n'est donc intégrée qu'après annulation de la précédente (déblocage, RG-COO-145). Cible : le renvoi refusé est signalé (alerte « prépa renvoyée non intégrée » à la Coordination, Q-216), non plus journalisé seulement.
- Déclencheur : flux préparation.
- Conditions : ligne existante non annulée.
- Effet / message d'erreur : ligne de travail annulée, tentative journalisée ; pas d'erreur remontée (le `@result = 1` est commenté dans le legacy).
- Sources : legacy `SQL/p_integ_preparation.sql:31-54,236-247` (ancien ID provisoire RG-COO-042) · spec EX-EXI-016, EX-EXI-020 ; [PP] §11 (EX-COO-043)
- Questions liées : Q-216
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-123 — Suivi d'intégration par groupe de préparation
- Origine : CONSERVÉE
- Énoncé : après intégration, les lignes de travail correspondantes passent à `rpc_statut = 8` et sont archivées dans `histo_preparation` ; un groupe dont le nombre de statuts distincts est différent de 8 est journalisé « integration groupe de preparation partiel ». Intention non établie (condition `<> 8` quasi toujours vraie, INCERTAINE) : reproduire à l'identique la journalisation, sans blocage, jusqu'à clarification.
- Déclencheur : flux préparation.
- Conditions : `count(distinct rpc_statut) <> 8`.
- Effet / message d'erreur : `tt_log` ; aucun blocage.
- Sources : legacy `SQL/p_integ_preparation.sql:251-291` (ancien ID provisoire RG-COO-043) · bdd.md §5
- Questions liées : Q-228
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-124 — Quantités d'entretien des lignes fixe/pliage réalignées selon le jour de la semaine
- Origine : CONSERVÉE
- Énoncé : du lundi au jeudi, `rpc_qte` des lignes de statut 0/1 dont la date du premier départ est ≥ début de semaine + 14 jours est réalignée sur `QuantiteEntretien` de Broadcast ; vendredi à dimanche : seulement pour les départs ≥ + 21 jours ET sans UM. Dépend du paramètre régional `datefirst` (à remplacer par un calcul explicite ISO).
- Déclencheur : flux préparation.
- Conditions : jour de la semaine ∈ {lun…jeu} ; statut ∈ {0, 1} ; (ven…dim : `UM_id` nul).
- Effet / message d'erreur : `rpc_qte`, `rpc_dat_maj` mis à jour ; l'entretien de Broadcast est repris sans ressaisie (EX-COO-501).
- Sources : legacy `SQL/p_integ_preparation.sql:15-24,296-331` (ancien ID provisoire RG-COO-044) · spec ateliers EX-COO-501 ; EX-EXI-075
- Questions liées : Q-224
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-125 — Accusé d'intégration vers Broadcast après la prépa
- Origine : CONSERVÉE
- Énoncé : après l'intégration d'une prépa (le paramètre de sortie ≠ 0 provoque l'erreur « Erreur dans la procédure : p_integ_preparation ! »), Circé informe Broadcast du statut « intégré » du groupe de préparation (`MajStatutGroupePrepa`). Si l'accusé échoue après l'intégration, Broadcast n'est pas informé mais Circé a intégré (pas de transaction distribuée) : l'accusé est rejoué au passage suivant. La valeur du statut Broadcast « intégré » n'est pas visible dans le dépôt.
- Déclencheur : fin de l'intégration d'une prépa.
- Conditions : groupe de préparation Broadcast au statut 133.
- Effet / message d'erreur : appel EXTPLAY ; en cas d'échec : tentative rejouée, journalisée.
- Sources : legacy `BLL/BatchAlimBll.cs:91-124` ; `REP/BatchAlimRepository.cs:162-266` (ancien ID provisoire RG-COO-040 ; RG-INT-006) · spec EX-EXI-016
- Questions liées : Q-005
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-126 — Atelier déroulant déduit de la surface et du site, sinon 0
- Origine : CONSERVÉE
- Énoncé : l'atelier d'une instruction/face de déroulant est déduit de (surface, site) : (5, 39) → 5 ; (5, 40) → 6 ; (7, 39) → 7 ; (7, 40) → 8 ; (6, 39) → 11 ; (6, 40) → 12 ; tout autre cas → atelier 0. Valeurs en dur dans le legacy : à porter en référentiel (`tr_atelier`).
- Déclencheur : intégration des instructions et des faces.
- Conditions : `IdSurface` et `IdSiteCCF`.
- Effet / message d'erreur : atelier 0 ⇒ instruction à code `…C000…` signalée (donnée de référence manquante) ; EX-EXI-018 : atelier posé seulement pour les surfaces 5 et 7 de Wissous et Nîmes.
- Sources : legacy `SQL/p_integ_instructions.sql:122-131,506-515` ; `SQL/p_integ_train_affiches.sql:68-76` (ancien ID provisoire RG-COO-045) · spec EX-EXI-018
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-127 — Code d'instruction : année + semaine + « C0 » + atelier + dossier
- Origine : CONSERVÉE
- Énoncé : `instr_code` = AAAA + SS (2 chiffres) + `C0` + atelier (2 chiffres) + dossier (8 chiffres) ; il identifie une instruction par (dossier, semaine, atelier). L'autre plateforme du même format se retrouve par substitution de l'atelier (5↔6, 7↔8, 11↔12) ; le legacy lit l'atelier avec `Substring(8,1)` (1 caractère) et ne marche pas pour 11/12 : à corriger (2 caractères).
- Déclencheur : intégration trains/instructions.
- Conditions : `ate_id` correct (atelier 0 produit « C000 »).
- Effet / message d'erreur : clé de l'instruction (RG-COO-051).
- Sources : legacy `SQL/p_integ_instructions.sql:155-158,559-562` ; `SQL/p_integ_train_affiches.sql:104-109` ; `BLL/TrainListeInstructionBll.cs:526-562` (ancien ID provisoire RG-COO-046) · bdd.md §3
- Questions liées : Q-206
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-128 — Type de préparation des visuels d'instruction forcé
- Origine : CONSERVÉE
- Énoncé : tous les visuels d'instruction reçus sont mis à `tpr_id = 10` (scro) et `sup_id = 26` (la clause `where` du legacy est commentée) ; les contrats « bdx » passent à `tpr_id = 2` (bandeau) ; pour les détails : type 21 → venusial (`tpr_id` 11, support 1026), le reste → 10, origine « bdx » → 2. Sens (« venusial ⇒ tout sur du scro ») ambigu : reprise à l'identique tant que non clarifié.
- Déclencheur : intégration des instructions.
- Conditions : lignes 142-153 et 543-554 de la procédure.
- Effet / message d'erreur : types de visuels homogénéisés ; support 26 systématique pour les visuels d'en-tête.
- Sources : legacy `SQL/p_integ_instructions.sql:142-153,543-554` (ancien ID provisoire RG-COO-048 ; confiance INCERTAINE)
- Questions liées : Q-228
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-129 — Intégration des faces de trains : ne touche pas aux faces/instructions déjà préparées
- Origine : MODIFIÉE
- Énoncé : (1) les faces dont l'instruction est à un statut autre que 0/1 ne sont pas réintégrées ; (2) les anciennes faces (départ futur) du même dossier/semaine aux statuts 0, 1, 3, 4 sont supprimées puis recréées ; (3) la mise à jour des faces existantes ne vaut que si `rpc_statut ∈ {0, 1}` ; (4) les nouvelles faces sont créées à `rpc_statut = 0` ; (5) les chapeaux d'instruction manquants sont créés (statut 0, type `contrat`, utilisateur « BC »). MODIFIÉE : au-delà de l'Instruction OK les renvois sont ignorés mais signalés (RG-COO-053) ; la suppression/recréation des faces est transactionnelle par dossier.
- Déclencheur : flux trains (`Traitement = 'E'` et `IdTypeDestinationDA` non nul ; `rdep_datdep > maintenant` pour la suppression).
- Conditions : statuts cités ; atomicité par dossier.
- Effet / message d'erreur : `tf_face_train` reflète Broadcast pour tout ce qui n'a pas dépassé l'Instruction OK ; faces 2/5-10 inchangées.
- Sources : legacy `SQL/p_integ_train_affiches.sql:38-48,119-138,155-221,225-267,278-289` (ancien ID provisoire RG-COO-049) · spec [PP] §3 (EX-COO-021) ; EX-EXI-018
- Questions liées : Q-216
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-130 — Reprise de l'afficheur des faces « dernière minute » pour un même panel
- Origine : CONSERVÉE
- Énoncé : une nouvelle face prend l'afficheur, le nom et le destinataire des faces déjà présentes pour le même panel/semaine/année quand elles sont aux statuts 2, 5, 6, 7, 8, 9, 10 ; après insertion, les faces 0/1 du même panel/semaine reprennent l'afficheur des faces insérées ; pour les panels dont toutes les faces sont ≤ 4, la ressource est mise à jour (`ft_user_maj = 'UpdateRessource'`).
- Déclencheur : flux trains.
- Conditions : `RefPanel` identique ; statuts cités.
- Effet / message d'erreur : cohérence de l'afficheur par panel ; en lien avec RG-COO-074 (DM).
- Sources : legacy `SQL/p_integ_train_affiches.sql:111-117,141-151,270-274,314-339` (ancien ID provisoire RG-COO-050)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-131 — Flux trains/instructions : verrou de lot, copie, intégration, purge côté PEX
- Origine : CONSERVÉE
- Énoncé : (1) marquage du lot à traiter côté INTERFACE (`Traitement = 'E'` pour les trains ; `talr_trait = '0'` pour instructions/détails) ; (2) purge des tables de travail Circé ; (3) copie en masse du lot marqué en mémorisant les `Id` copiés ; (4) intégration (trains puis instructions ; erreur « Erreur dans la procédure : p_integ_deroulants ! » si résultat ≠ 0) ; (5) suppression côté INTERFACE des seuls `Id` copiés. Si l'intégration échoue rien n'est supprimé (rejouable) ; les lignes arrivées après la capture restent pour le passage suivant ; si la suppression échoue les mêmes données sont renvoyées (intégration idempotente, RG-COO-102). Valeurs de drapeaux non homogènes (« E » vs « 0 ») : INCERTAIN.
- Déclencheur : flux trains.
- Conditions : ordre purge → copie → intégration → suppression.
- Effet / message d'erreur : voir RG-COO-041, 126, 127, 129.
- Sources : legacy `BLL/BatchAlimBll.cs:129-163` ; `REP/BatchAlimRepository.cs:271-333,432-448,600-672,698-714` ; `SQL/p_integ_deroulants.sql:21-30` (ancien ID provisoire RG-INT-007)
- Questions liées : Q-005
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-132 — « Rafraîchir un dossier » : relance manuelle de l'export Broadcast des instructions
- Origine : CONSERVÉE
- Énoncé : l'écran (menu Administration) appelle la procédure Broadcast `ope.P_ExportTrainAfficheTravailCirce` pour un n° de dossier : la zone de travail est ré-alimentée et Circé intègre au prochain passage (RG-COO-131). Réservé au droit legacy `train_rafraichir_contrat` (mappé coord/admin) ; contrôle côté service.
- Déclencheur : action « Rafraîchir un dossier ».
- Conditions : n° de dossier renseigné ; rôle autorisé.
- Effet / message d'erreur : 403 hors rôle ; effet dépendant d'une procédure Broadcast non versionnée (PROBABLE).
- Sources : legacy `REP/AdminContratRepository.cs:21-37` ; `WEB/Views/Shared/_MenuNew.cshtml:176-179` (ancien ID provisoire RG-COO-051 ; RG-ADM-051) · spec EX-EXI-020
- Questions liées : Q-228, Q-201
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-133 — Instruction OK automatique du legacy : détail des règles du batch (RG1 à RG6)
- Origine : MODIFIÉE
- Énoncé : le batch legacy passe les instructions `EN_COURS` (1) de dossiers futurs à `INSTRUCTION_OK` (2) lorsque : commentaire d'instruction vide ET quantité attendue (Σ `instruction_detail`) = quantité réceptionnée (`tf_face_train`), après normalisation automatique des pourcentages de visuels (1 visuel → 100 % ; plusieurs visuels → une ligne « Sans affiche » à 100 %, les autres à 0 %) ; trace dans `tt_log` avec l'utilisateur `BATCH_AUTO_INSTR_OK` ; transaction. La cible reprend la répartition de Broadcast (RG-COO-049) et la règle de Nariman (RG-COO-042) : la normalisation « Sans affiche » n'est PAS reprise sans décision (Q-205). Non déployée d'après le `.sqlproj` (Q-006).
- Déclencheur : INCONNU (aucun appelant dans le dépôt).
- Conditions : dossiers futurs ; statut 1.
- Effet / message d'erreur : documentaire (référence pour les tests de non-régression de RG-COO-042).
- Sources : legacy `SQL/p_batch_auto_instruction_ok.sql:19-37,156-166,193-249,300-307` (ancien ID provisoire RG-INT-042 c) ; bdd.md §8 (RG1–RG6)
- Questions liées : Q-205, Q-006
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-134 — Retour vers Broadcast : population exportée, filtre et séquence (« reçue et associée »)
- Origine : MODIFIÉE
- Énoncé : le traitement de retour exporte, pour la semaine courante et les suivantes (semaines ISO, RG-COO-083), (a) les affiches associées à une ligne non Broadcast et (b) les affiches non associées présentes dans `tf_dossier_semaine_depart` sans ligne attendue ; quantité = somme des mouvements (0 si aucun) ; le format « 2m2 Scrolling » est ramené à « 2m2 » ; une ligne n'est envoyée que si `IdDAChapeau` est renseigné OU (`cont_num ≠ "0"` ET semaine/année renseignées) ; `EstAssociee` = lien ET validée (RG-COO-024) ; site CCF déduit de la plateforme par référentiel (le legacy fait 39 si plateforme 1, sinon 40, ce qui envoie DBG avec 40) ; destinataire fixe « CIRCE ». MODIFIÉE : rejeu de toute la population à chaque passage sans filtre `envoye` (legacy) ⇒ cible : n'envoyer que les changements (clé + quantité + `EstAssociee`) ; séquence : insertion interface → pose du drapeau d'envoi par affiche → appel de la procédure de transfert ; en cas d'erreur d'un `AfficheId` inconnu rien n'est marqué à moitié ; lignes écartées journalisées (pas silencieusement).
- Déclencheur : traitement de retour planifié (RG-COO-103).
- Conditions : voir énoncé ; mapping site par référentiel (Q-227).
- Effet / message d'erreur : `CIRCE_PEX_RECEPTION` ; drapeau `envoye` jamais remis à faux ; erreur journalisée `tt_log`. Chevauche RG-REC-110/111 (provisoires legacy-reception) portées par le module Réception.
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:30-57,59-103` ; `REP/BatchAlimReceptionRepository.cs:27-135` ; `SQL/p_batch_alimentation_circe_pex_reception.sql:33-178` (ancien ID provisoire RG-INT-020, 021, 022 ; RG-REC-110, 111) · spec EX-TRA-039 ; EX-EXI-053
- Questions liées : Q-231, Q-227, Q-005
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-140 — Déblocage : la recherche exige un n° de préparation ou un n° de dossier
- Origine : CONSERVÉE
- Énoncé : l'écran de déblocage des préparations ne charge rien sans `IdPreparationChapeau` ni `IdDossierDeVenteChapeau` : la grille est vide (aucun chargement massif).
- Déclencheur : recherche sur l'écran Déblocage préparations (Administration).
- Conditions : les deux critères nuls ⇒ liste vide.
- Effet / message d'erreur : lecture seule ; message de grille vide « Saisissez un n° de préparation ou de dossier » (libellé à définir).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:86-89` ; `WEB/Views/Shared/_MenuNew.cshtml:166-169` (ancien ID provisoire RG-COO-080)
- Questions liées : Q-217
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-141 — Préparations débloquables filtrées par les règles d'inclusion/exclusion de l'atelier de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : une préparation Broadcast est affichée si, pour au moins un atelier de l'utilisateur dont le site CCF est celui de la préparation, au moins une règle d'inclusion (`tr_atelier_droit_prepa`) correspond ET aucune règle d'exclusion ne correspond ; une règle correspond si (`tpr_id` nul ou égal à la famille du type de préparation) ET (`IdSurface` nul ou égal). Un atelier sans règle ne débloque rien (message tracé), de même un atelier sans site CCF résolu. Données de référence (seed APPFR-3878) : ateliers 1/4 tout sauf pliage/scrolling/venusial ; 2/3/9/10 pliage ; 5/6 scrolling + venusial 2 m² ; 7/8 8 m² ; 11/12 4 m². Chaque groupe porte `InstructionType` UM si une ligne de répartition correspond, sinon TRAIN.
- Déclencheur : recherche de déblocage.
- Conditions : périmètre atelier de l'utilisateur (RG-COO-167).
- Effet / message d'erreur : liste des groupes débloquables ; valeurs du seed non revérifiées (reprises du document du dépôt).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:91-149,338-351` ; `REP/AdminPreparationDeblocageRepository.cs:115-126` ; `circe-develop/docs/regles-inclusion-exclusion-deblocage.md:53-85` (ancien ID provisoire RG-COO-081) · bdd.md §6
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-142 — Statut d'avancement de la préparation (`StatutPrepa`) : UM ou TRAIN
- Origine : CONSERVÉE
- Énoncé : pour une préparation de type UM : « En cours » si une UM existe pour (dossier, semaine, année, groupe), sinon « None » (débloquable). Pour TRAIN : faces rapprochées par (dossier, semaine, supports résolus famille × surface, atelier de type scroll du site) ; « None » si toutes les faces sont à 0, 1 ou 4 ET qu'au moins une face de la semaine d'un atelier scroll existe, ou s'il n'y a aucune face ; sinon « En cours ». Le site 39 → plateforme 1, tout autre site → plateforme 2. Si la table de correspondance support est incomplète : aucune face rapprochée (contrôle impossible) et trace « Deblocage : transcoCategSupport absente… » (fail-open : à remplacer par un refus explicite, RG-COO-144).
- Déclencheur : lecture de la grille de déblocage.
- Conditions : voir énoncé.
- Effet / message d'erreur : colonne `StatutPrepa` ; masquage du bouton « Débloquer » : règle non vérifiable (JS introuvable).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:154-250` ; `REP/AdminPreparationDeblocageRepository.cs:148-184` ; `WEB/Views/AdminPreparationDeblocage/Index.cshtml:35,37` (ancien ID provisoire RG-COO-082) · spec EX-EXI-032
- Questions liées : Q-218
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-143 — Blocage du déblocage côté serveur : une UM au statut ≥ 6 (Préparé) bloque
- Origine : CONSERVÉE
- Énoncé : l'action « Débloquer » est refusée avec « Le groupe de preparation n'est pas déblocable ! » si au moins une UM du groupe est à un statut ≥ 6 (Préparé, A expédier, Terminé, Au roulage…). Contrôle exécuté par `p_s_controle_rendumain(IdGroupePreparation)` (non vide ⇒ refus).
- Déclencheur : action « Débloquer ».
- Conditions : UM au statut ≥ 6 dans le groupe.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-143' }` « Le groupe de preparation n'est pas déblocable ! ».
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:263-267` ; `SQL/p_s_controle_rendumain.sql:9-21` ; `WEB/Controllers/AdminPreparationDeblocageController.cs:75-96` (ancien ID provisoire RG-COO-083)
- Questions liées : Q-217
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-144 — Blocage du déblocage côté serveur pour un groupe TRAIN (contrôle des faces)
- Origine : MODIFIÉE
- Énoncé : pour un groupe de type TRAIN, le service refuse le déblocage si au moins une face du groupe est à un statut ≥ 2 (Instruction OK ou au-delà : trains calculés, exportés, en production) ; le déblocage « uniquement si la prod n'est pas lancée ». MODIFIÉE : legacy = aucun contrôle serveur sur les faces (le contrôle n'existe que dans l'affichage `StatutPrepa`) ; proposition (HYPOTHÈSE Q-218) : appliquer côté serveur la règle d'affichage (faces à 0, 1 ou 4 ⇒ débloquable).
- Déclencheur : action « Débloquer » sur un groupe TRAIN.
- Conditions : faces rapprochées comme en RG-COO-142 ; correspondance support absente ⇒ refus explicite (et non fail-open).
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-144' }`.
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:263-267` (aucun contrôle) · spec EX-EXI-032 (« uniquement si la prod n'est pas lancée »), EX-EXI-045
- Questions liées : Q-218, Q-217
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-145 — Effet du déblocage : annulation côté Broadcast et Circé, atomicité côté Circé
- Origine : MODIFIÉE
- Énoncé : « Débloquer » (1) demande à Broadcast `P_CirceDebloquerGroupePreparation` (avec le feature flag « PastillePrepaBus ») ; (2) passe à 4 (annulé) les lignes `tf_repart_calcul` du couple (préparation chapeau, groupe) non déjà annulées ET les UM associées (colis non touchés : code commenté) ; (3) archive (`p_i_th_repart_annule`) ; (4) écrit l'historique `DebloquerPreparation` ; (5) envoie le mail (RG-COO-147). Les écritures Circé (2 à 4) forment une transaction unique ; l'appel Broadcast est ordonné de façon à ne pas laisser Circé annulé si Broadcast refuse. MODIFIÉE : legacy = appels successifs sans transaction commune (Broadcast, Circé, archivage, historique, mail).
- Déclencheur : action « Débloquer » ; rôle autorisé (RG-COO-152).
- Conditions : groupe débloquable (RG-COO-143, 144).
- Effet / message d'erreur : `rpc_statut` ≠ 4 → 4 ; la prépa annulée peut être renvoyée par Broadcast et intégrée (RG-COO-122) ; échec de l'appel Broadcast ⇒ 502 sans écriture Circé.
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:252-333` ; `REP/AdminPreparationDeblocageRepository.cs:63-107` ; `SQL/p_u_statut_repart_deblocage.sql:30-87` ; `BLL/HistorisationBll.cs:118-127` (ancien ID provisoire RG-COO-084 ; RG-INT-044) · spec EX-EXI-020
- Questions liées : Q-217, Q-218
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-146 — Trace du déblocage : qui, quand, quoi
- Origine : CONSERVÉE
- Énoncé : tout déblocage écrit une trace (`th_repart_annule` : répartitions annulées ; historique `DebloquerPreparation` avec nom de l'utilisateur et date) consultable par « Préparations débloquées » (RG-COO-149).
- Déclencheur : déblocage réussi.
- Conditions : même transaction que RG-COO-145.
- Effet / message d'erreur : échec d'écriture ⇒ déblocage annulé.
- Sources : legacy `SQL/p_i_th_repart_annule` ; `BLL/HistorisationBll.cs:118-127` (ancien ID provisoire RG-COO-084) · bdd.md §5
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-147 — Mail de déblocage : destinataires de la plateforme, envoi non bloquant
- Origine : MODIFIÉE
- Énoncé : après le déblocage, un mail « Déblocages - groupe préparation… » est envoyé aux adresses de la plateforme du site (`tr_plateforme.plt_mail`, liste séparée par virgules), préfixé par l'environnement hors production. L'échec d'envoi (SMTP) est journalisé et n'annule ni ne fait échouer le déblocage déjà committé. MODIFIÉE : legacy = envoi sans `try/catch` (une panne SMTP fait échouer l'action après l'annulation) ; liste tronquée dans l'ancien écran ; encodage windows-1250.
- Déclencheur : fin de RG-COO-145.
- Conditions : au moins une adresse ; sinon avertissement tracé.
- Effet / message d'erreur : mail envoyé après commit ; destinataires paramétrables par liste de distribution (Q-219).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:252-333` (ancien ID provisoire RG-COO-084 ; RG-ADM-042) · spec EX-TRA-030 (« Déblocages » mail existant)
- Questions liées : Q-219
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-148 — Prépa renvoyée après déblocage : intégrée normalement
- Origine : CONSERVÉE
- Énoncé : après un déblocage réussi, Broadcast peut renvoyer la préparation ; elle est intégrée (RG-COO-122) et remet le dossier à `PREPARATION_RECUE` ; les anciennes lignes annulées restent historisées. Sans déblocage, une prépa renvoyée est refusée.
- Déclencheur : flux préparation après déblocage.
- Conditions : lignes précédentes à 4.
- Effet / message d'erreur : voir RG-COO-122, 063.
- Sources : legacy `SQL/p_integ_preparation.sql:31-54,236-247` ; spec EX-EXI-016, EX-EXI-020 ; EX-EXI-045
- Questions liées : Q-216
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-149 — Suivi des déblocages : période et libellés
- Origine : CONSERVÉE
- Énoncé : l'écran « Préparations débloquées » exige une date de fin ≥ date de début (« La date de fin doit être supérieur à la date de début ! ») ; la période par défaut est le dernier mois ; le type « Tole traditionnelle » est affiché « 4m² colle » ; le site est traduit par `TranscoderLibelleSiteCCF`. Droit legacy `view_repart`.
- Déclencheur : recherche sur l'écran.
- Conditions : fin ≥ début.
- Effet / message d'erreur : 422 « La date de fin doit être supérieur à la date de début ! » ; lecture (`p_s_th_repart_annule`).
- Sources : legacy `BLL/AdminSuiviDeblocageBll.cs:25-65,76-100` ; `WEB/Views/Shared/_MenuNew.cshtml:171-174` (ancien ID provisoire RG-COO-086)
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-150 — Ancien écran « Répartitions déblocables » (Sybase AMT) : ne pas reproduire le déblocage des lignes non cochées
- Origine : CONSERVÉE
- Énoncé : l'ancien écran envoyait à `DebloquerRepartitions` toutes les lignes reçues moins celles jugées non déblocables parmi les cochées : les lignes non cochées étaient donc débloquées (défaut) ; appel de la procédure Sybase `p_urpfo01` puis des procédures Circé ; mail aux logisticiens. Le menu actif ne pointe plus vers cet écran (probablement mort) : applicabilité à confirmer (Q-228) ; si conservé, seules les lignes cochées sont débloquées.
- Déclencheur : écran Répartitions déblocables (droits `debloque_repart` / `view_repart`).
- Conditions : lignes cochées uniquement (cible).
- Effet / message d'erreur : annulation de répartitions côté Circé (4) ; non implémenté tant que Q-228 est ouverte.
- Sources : legacy `WEB/Controllers/Repartition/RepartitionController.cs:218-242,253-326,328-351` ; `BLL/RepartitionService.cs:35-53` ; `REP/RepartitionRepository.cs:87-136` (ancien ID provisoire RG-COO-085 ; confiance PROBABLE)
- Questions liées : Q-228
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-151 — « Rendre la main à la Pré-Prod » (fixe) et déblocage : consignes de cohérence
- Origine : NOUVELLE
- Énoncé : « Rendre la main à la Pré-Prod » (écran 2 m² fixe/pliage/bus, motif obligatoire à défaut « Changement de visuel demandé par le client ») équivaut côté Coordination au déblocage du groupe de préparation (RG-COO-145) : le dossier reste `PREPARATION_RECUE`, la validation admin et les affiches reçues ne sont pas modifiées (HYPOTHÈSE Q-217), les unités déjà en production ne sont pas retirées (point de non-retour, coo2). Déroulant : seulement si la production n'est pas lancée (RG-COO-144) ; fixe : possible même après l'envoi de la prépa (retirer, puis débloquer, puis le gestionnaire renvoie la prépa).
- Déclencheur : action « Rendre la main ».
- Conditions : rôle autorisé ; groupe débloquable.
- Effet / message d'erreur : voir RG-COO-145 ; les unités non lancées passent « En attente » (coo2) ; contradiction ateliers (13 vs 14 slide 30 #4) non tranchée.
- Sources : maquette ECR-COO-09b ; spec EX-EXI-045 ; ateliers contradiction 1 ; `maquettes-reception-coordination.md` (Q-COO-18)
- Questions liées : Q-217
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-152 — Droits du déblocage et de son suivi
- Origine : MODIFIÉE
- Énoncé : le déblocage (legacy `debloque_repart`) et « Rafraîchir un dossier » (`train_rafraichir_contrat`) sont réservés aux rôles `coord` et `admin` (provisoire) ; « Préparations débloquées » (`view_repart`) est en lecture pour `coord` et `admin` ; contrôle côté service (le legacy masque seulement l'entrée de menu).
- Déclencheur : toute action de déblocage / suivi.
- Conditions : rôle ∈ {coord, admin}.
- Effet / message d'erreur : 403 `{ regle: 'RG-COO-152' }`.
- Sources : legacy `WEB/Views/Shared/_MenuNew.cshtml:155-179` ; `BLL/CommunBll.cs:31-40` ; `legacy-admin.md §B` (ancien ID provisoire RG-COO-091, 090)
- Questions liées : Q-201, Q-217, Q-003
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-160 — Historique des actions de coordination
- Origine : MODIFIÉE
- Énoncé : les actions suivantes écrivent une ligne d'historique nominative (acteur, date, ancienne/nouvelle valeur) : validation et annulation de validation (ModificationValidationAdmin), rattachement et retrait (AfficheAssocier / AfficheDissocier distincts), changement de statut d'instruction (tous statuts, ChangementStatutInstruction), modification entretien/position (ModificationInstructionPlus), export des trains (ExporterTrains, coo2), déblocage (DebloquerPreparation), demande de correction à Broadcast, application de la version Broadcast. Les traitements automatiques écrivent aussi (acteur « Circé (automatique) »). Les entités historisées : Affiche, Instruction, Trains, Dossier.
- Déclencheur : chacune des actions listées.
- Conditions : même transaction que l'action.
- Effet / message d'erreur : refus de l'action si l'écriture échoue.
- Sources : legacy `BLL/HistorisationBll.cs:16-127` (ancien ID provisoire RG-INT-046) ; bdd.md §5 · spec EX-TRA-034, EX-TRA-036
- Questions liées : Q-004
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-165 — Droits contrôlés côté service (plus seulement masqués)
- Origine : MODIFIÉE
- Énoncé : chaque endpoint de coordination vérifie le rôle de l'utilisateur dans le service ; masquer un bouton ne suffit pas. Un appel direct sans droit est refusé 403. Legacy : `EstAutorise(droit, user)` (entrée `tr_utilisateur_menu` en cache de session) pour le menu et les boutons seulement ; aucun `[Authorize]` ; droits chargés une fois par session ; aucun jeton anti-CSRF.
- Déclencheur : tout appel d'API de coordination.
- Conditions : rôle ∈ matrice section 2 ; session à jour (droits relus à chaque requête ou à durée courte).
- Effet / message d'erreur : 401 sans authentification, 403 sans droit `{ code: 'PERMISSION', regle: 'RG-COO-165' }`.
- Sources : legacy `BLL/CommunBll.cs:276-303` ; recherche `[Authorize]`/`EstAutorise(` dans `WEB/Controllers` : 0 occurrence (ancien ID provisoire RG-COO-090 ; RG-ADM-015) · spec EX-TRA-002 ; EX-TRA-001
- Questions liées : Q-001, Q-003
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-166 — Correspondance droits legacy ↔ rôles de la cible pour les écrans de coordination
- Origine : MODIFIÉE
- Énoncé : « Liste des instructions » (`pliage_a_traiter`), « Etat des réservations » et « Suivi de production » (`suivi_suivi_production`), case validation admin (`validation_admin`), déblocage (`debloque_repart`), suivi des déblocages (`view_repart`), « Rafraîchir un dossier » (`train_rafraichir_contrat`) sont mappés sur les rôles provisoires de la maquette : `coord` et `admin` pour les actions d'écriture, lecture pour `cheq` et `com` sur les écrans de suivi, `recep` en lecture sur la fiche affiche (motif de doute et état de validation). Les actions de trains (`pliage`, `train_*`) relèvent de coo2. Mapping à refaire si l'équipe choisit d'autres profils (Q-003).
- Déclencheur : contrôle d'accès.
- Conditions : voir section 2.
- Effet / message d'erreur : voir RG-COO-165.
- Sources : legacy `WEB/Views/Shared/_MenuNew.cshtml:84-107,140-152,166-183` ; `BLL/CommunBll.cs:31-40` (ancien ID provisoire RG-COO-091) ; `legacy-admin.md §2, §4` · maquette ECR-COO-01 (`roles` : coord, admin)
- Questions liées : Q-003, Q-201
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-167 — Périmètre par atelier / site de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : les listes d'instructions, l'état des réservations, le suivi de production, le déblocage et les alertes de coordination ne montrent que les ateliers/sites rattachés à l'utilisateur ; la liste de choix d'atelier ajoute « Tous » si plusieurs ateliers ; un utilisateur sans périmètre voit une liste vide ; le site choisi dans le bandeau vaut pour toute l'application (filtre « Départ » dans la page, plus de semaine globale). Les critères de filtre sont mémorisés par utilisateur (préférence d'interface, non métier).
- Déclencheur : lecture des écrans.
- Conditions : périmètre = (plateforme, atelier) de l'utilisateur (`tr_utilisateur_data`, V2 : périmètre site/atelier) ; l'`admin` voit tous les sites.
- Effet / message d'erreur : filtrage côté API (pas seulement front) ; 403 sur un identifiant hors périmètre.
- Sources : legacy `BLL/TrainListeInstructionBll.cs:31-108,117-168` ; `BLL/TrainSuiviThemeBll.cs:31-98` ; `SQL/p_s_adminSuiviRead.sql:91-94,111-113` ; `BLL/SuiviEtatReservationBll.cs:75-98` (ancien ID provisoire RG-COO-092 ; RG-ADM-016) · spec EX-TRA-006 (EX-TRA-003)
- Questions liées : Q-003
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-168 — Rôle Commerce : lecture seule
- Origine : NOUVELLE
- Énoncé : le rôle `com` consulte le suivi, l'état des réservations et les affiches reçues sans aucun bouton d'action de coordination (ni validation, ni Instruction OK, ni demande de correction, ni déblocage). Plus de mail de réception au commercial (besoin refusé le 14/10).
- Déclencheur : toute action d'écriture par `com`.
- Conditions : rôle `com`.
- Effet / message d'erreur : 403 `{ regle: 'RG-COO-168' }`.
- Sources : spec [README] H10 ; [DESIGN] §8 ; [DC] §2 (EX-TRA-004) ; EX-REC-072 ; ateliers EX-REC-523 (« Besoin Refusé »)
- Questions liées : Q-003
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-169 — La Pré-Prod n'est pas utilisatrice de Circé
- Origine : NOUVELLE
- Énoncé : la Pré-Prod (gestionnaires) travaille dans Broadcast seulement (saisie des IP, envoi de la prépa) ; elle n'a aucun compte ni rôle dans Circé ; ses interactions avec Circé passent par les mails de demande de correction (RG-COO-057, 069) et par les flux de Broadcast. Les actions « Pré-Prod » du legacy (retirer, rendre la main, valider) sont portées par la Coordination. À Nîmes la Coordination se nomme « Pré-Prod Nîmes » (déduit, Q-221).
- Déclencheur : création de compte / attribution de rôle.
- Conditions : rôle `pre-prod` inexistant.
- Effet / message d'erreur : aucun rôle Pré-Prod n'est attribuable.
- Sources : spec [PP] §1, §2 (EX-COO-003) ; maquettes-autres-modules.md §0.6 point 1 (rôle Pré-Prod supprimé le 27/10)
- Questions liées : Q-221
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
