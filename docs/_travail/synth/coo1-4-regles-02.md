### RG-COO-040 — Statuts de l'instruction (déroulant) et table de transitions
- Origine : MODIFIÉE
- Énoncé : l'instruction (grain dossier × semaine × atelier) a les statuts : `A_TRAITER` (0, faces reçues mais pas encore les instructions), `EN_COURS` (1, prépa reçue, posé par Circé), `INSTRUCTION_OK` (2, posé par la règle de Nariman sinon par la Coordination), `PRET_A_PRODUIRE` (5, ex « A imprimer », posé par l'export du jeudi 14 h : action de coo2), `ANNULE` (4, avant l'export), `ERREUR` (3, hérité : repassé à 1 à l'intégration suivante). Table de transitions explicite en section 3.2 ; toute transition non listée = 409. Chaque transition écrit un historique (RG-COO-061).
- Déclencheur : intégration d'instruction (batch), Instruction OK automatique (RG-COO-042), action de la Coordination (RG-COO-044/045/046), export des trains (coo2).
- Conditions : voir section 3.2 ; les valeurs 6 à 10 (Préparé, A expédier, Terminé, Export prépa, Au roulage) appartiennent aux faces/UM (coo2) et ne sont pas des statuts d'instruction.
- Effet / message d'erreur : 409 `{ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-040' }`. MODIFIÉE : legacy = le back applique le statut posté sans contrôle de transition ; la liste des statuts proposés n'est qu'un filtre du front.
- Sources : legacy `WEB/Controllers/Preparation/PreparationController.cs:1267-1302` ; `REP/PreparationRepository.cs:1020-1111` ; `legacy-coordination.md §5.3` (ancien ID provisoire RG-COO-060) · spec [PC] p.1 ; [PP] §3, §12 (EX-COO-020) ; EX-EXI-030, EX-EXI-070
- Questions liées : Q-004, Q-200, Q-206
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-041 — Création et mise à jour de l'instruction à l'intégration (statut initial, renvois ignorés)
- Origine : CONSERVÉE
- Énoncé : une instruction nouvelle (type `contrat` ou `reseau`) est créée au statut `EN_COURS` (1) avec entretien par défaut 8 %, position standard (0) et `tsr_repart_code = 0` ; les chapeaux d'instruction manquants (faces reçues sans instructions) sont créés au statut `A_TRAITER` (0), type `contrat`, utilisateur « BC ». Si l'instruction existe : statut 2 (Instruction ok) ou 5 (A imprimer) → ignorée ; statut 4 (Annulé) → non mise à jour ; statut 3 (Erreur) → repasse à 1 ; autres → annonceur et commentaire Broadcast mis à jour et statut remis à 1. Les ignorés ne sont plus silencieux dans la cible (RG-COO-053).
- Déclencheur : traitement d'intégration des trains/instructions (RG-COO-131).
- Conditions : `sect_code_centre` non nul ; `talr_trait = '1'`.
- Effet / message d'erreur : insert/update de l'instruction ; annule-et-remplace des détails ; mise à jour des visuels (thème, pourcentage) ; transitions 3 → 1, 0/1 → 1 ; 2/4/5 → inchangé.
- Sources : legacy `SQL/p_integ_instructions.sql:175-259,274-284,578-590` ; `SQL/p_integ_train_affiches.sql:155-221` (ancien ID provisoire RG-COO-047, RG-COO-049) · spec [PC] p.1 ; [PP] §3 ; EX-EXI-018 (EX-COO-020)
- Questions liées : Q-216
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-042 — Instruction OK automatique (règle de Nariman)
- Origine : MODIFIÉE
- Énoncé : pour chaque ligne atelier × plateforme du déroulant à l'état `EN_COURS`, si (1) il n'y a pas de commentaire de prépa ET (2) le nombre d'exceptions est égal à la quantité (hors entretien), l'instruction passe automatiquement à `INSTRUCTION_OK` (mode AUTO, `iok_par` = « règle automatique », pas un nom de personne) ; Circé répartit les thèmes sur les trains et crée l'entretien (calcul : coo2). Sinon elle reste « En cours » (RG-COO-044). Marquage : « Instruction ok · automatique ».
- Déclencheur : MOMENT NON TRANCHÉ (Q-204) : option (a) bouton « Instruction OK des dossiers conformes » le jeudi 14 h puis export ; option (b) dès l'arrivée de la prépa avec réouverture avant l'export.
- Conditions : prépa reçue (RG-COO-052) ; commentaire vide ; exceptions = quantité hors entretien ; répartition à 100 % (RG-COO-043) ; trains non exportés ; version à jour.
- Effet / message d'erreur : transition `EN_COURS → INSTRUCTION_OK`, historique « Instruction ok automatique » ; si le moment n'est pas tranché, la règle est implémentée comme fonction pure testable, branchée sur le déclencheur retenu (Q-204). MODIFIÉE : legacy = batch `p_batch_auto_instruction_ok` (condition : commentaire vide ET quantité attendue = quantité réceptionnée), non déployé d'après le `.sqlproj` (Q-006) ; ateliers (EX-COO-508) : « commentaire vide » seul.
- Sources : legacy `SQL/p_batch_auto_instruction_ok.sql:19-37,156-166,193-249,300-307` ; `BLL/TrainListeInstructionBll.cs:333-340` (ancien ID provisoire RG-INT-042 c) · spec [PC] p.1 ; [PP] §1, §4 ; [RA] RG-IOK-01, RG-IOK-02 (EX-COO-018, EX-COO-022) ; ateliers EX-COO-508 ; EX-EXI-032 ; écran ECR-COO-01
- Questions liées : Q-204, Q-205, Q-006
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-043 — Répartition des thèmes à 100 % exigée pour l'Instruction OK
- Origine : CONSERVÉE
- Énoncé : l'Instruction OK (automatique ou manuelle) est refusée si, pour au moins un couple (dimension, type de préparation), la somme des pourcentages de thèmes est différente de 100. L'automatisme fait ce contrôle lui-même. (Le legacy ne l'applique que dans l'écran Train ; l'écran Préparation a un contrôle factice qui renvoie toujours vrai : défaut à ne pas reproduire.)
- Déclencheur : enregistrement d'une instruction avec statut cible `INSTRUCTION_OK` ; règle automatique.
- Conditions : Σ pourcentages = 100 par (dimension, type de préparation).
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-043' }` « La répartition des thèmes n'est pas à 100 % ! » ; en automatique : l'instruction reste « En cours ».
- Sources : legacy `BLL/TrainListeInstructionBll.cs:333-341,472-480` ; `WEB/Controllers/Preparation/PreparationController.cs:1262-1265,1361-1365` (ancien ID provisoire RG-COO-063) · spec [PP] §4, §10 (EX-COO-023) ; EX-EXI-031, EX-EXI-032
- Questions liées : Q-205
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-044 — Instruction OK manuelle (après contrôle) par la Coordination
- Origine : MODIFIÉE
- Énoncé : un dossier `EN_COURS` (commentaire de prépa non vide ou écart de quantité) est traité par la Coordination : lecture du commentaire, contrôle des quantités, des exceptions, de l'entretien et des positions (souvent « début » ou « fin » de train), puis action « Instruction OK (après contrôle) » (individuelle ou groupée) qui pose `INSTRUCTION_OK` mode MANUEL avec `iok_par` (nom) et `iok_le`. Le motif « En cours » (commentaire, écart) est affiché. L'action déclenche le calcul des trains (coo2) puis les fige.
- Déclencheur : action « Instruction OK (après contrôle) » ; `Idempotency-Key` + `version`.
- Conditions : rôle `coord`/`admin` (RG-COO-009) ; statut `EN_COURS` ; prépa reçue ; répartition à 100 % (RG-COO-043) ; trains non exportés.
- Effet / message d'erreur : 409 si statut ≠ `EN_COURS` ou si `ANNULE`/`PRET_A_PRODUIRE` ; 422 si 100 % non respecté ; toast « n dossier(s) en Instruction OK : Circé répartit les visuels sur les trains et crée l'entretien. Les trains partent à l'export du jeudi 14 h (Liste des trains). ». MODIFIÉE : legacy = statut appliqué sans contrôle de transition ; seul le changement vers 2 ou 4 est historisé.
- Sources : legacy `BLL/TrainListeInstructionBll.cs:199-263,321-383,392-437` ; `REP/PreparationRepository.cs:1020-1111` (ancien ID provisoire RG-COO-060, 061, 064) · spec [PC] p.1-2 ; [PP] §4 (EX-COO-019) ; EX-EXI-031, EX-EXI-032 ; écran ECR-COO-01, ECR-COO-02
- Questions liées : Q-206
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-045 — Annulation d'un dossier / d'une instruction (« Annulé »)
- Origine : CONSERVÉE
- Énoncé : la Coordination peut passer une instruction à `ANNULE` (« pas à produire », ex. dossiers S48, S54) depuis `A_TRAITER`, `EN_COURS` ou `INSTRUCTION_OK`, tant que les trains ne sont pas exportés ; après l'export (`PRET_A_PRODUIRE`) l'annulation n'est plus possible depuis cet écran (annulation de thème : coo2). Retour possible `ANNULE → A_TRAITER` (legacy). Un dossier annulé : pastille de préparation « Annulé », validation admin « — » (sans objet), aucune ligne attendue active.
- Déclencheur : action « Annulé » ; DA annulée côté Broadcast (RG-COO-087).
- Conditions : rôle autorisé ; statut source ∈ {0, 1, 2} ; trains non exportés.
- Effet / message d'erreur : 409 depuis `PRET_A_PRODUIRE` ; historique ; pour `INSTRUCTION_OK → ANNULE` : calcul des trains effacé (RG-COO-046).
- Sources : legacy `WEB/Controllers/PreparationDeroulants/PreparationDeroulantsController.cs:1507-1542` ; `legacy-coordination.md §5.3` (ancien ID provisoire RG-COO-060) · spec [PC] p.1-2 ; [PP] §4 (EX-COO-019, EX-COO-020) ; EX-EXI-030
- Questions liées : Q-004
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-046 — Retour arrière d'une instruction : effacement du calcul des trains
- Origine : CONSERVÉE
- Énoncé : repasser une instruction de `INSTRUCTION_OK` à `EN_COURS` (1), `A_TRAITER` (0) ou `ANNULE` (4) supprime les faces d'entretien non « à imprimer » et remet à blanc (thème, repiquage, train, version vidés ; statut = code demandé) les faces non au statut `PRET_A_PRODUIRE` ; les faces déjà « A imprimer » sont conservées. Une instruction au statut 5 n'est jamais soumise à ce retour.
- Déclencheur : changement de statut de l'instruction (hors 5).
- Conditions : instruction initiale ≠ 5 ; changement effectif de statut.
- Effet / message d'erreur : transaction unique statut + effacement ; effets sur faces : coo2 (RG-COO-2xx, pont) ; 409 si statut initial = 5.
- Sources : legacy `SQL/p_u_statut_preparation.sql:24-64` ; `BLL/TrainListeInstructionBll.cs:372-380,396-403` (ancien ID provisoire RG-COO-064) · spec [PP] §3, §12 ; EX-EXI-030 (EX-COO-020, EX-COO-021)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-047 — Instruction OK fige la saisie : annonceur, entretien, position
- Origine : CONSERVÉE
- Énoncé : tant que le statut est `INSTRUCTION_OK` ou `PRET_A_PRODUIRE`, les champs annonceur, entretien (%) et position ne sont plus modifiables ; seuls le commentaire et le statut le restent. Le contrôle est fait côté serveur (le legacy se fie à une valeur postée par le front). Hors blocage, une modification d'annonceur se répercute sur toutes les faces de l'instruction.
- Déclencheur : enregistrement d'une instruction.
- Conditions : statut ∈ {2, 5}.
- Effet / message d'erreur : 409 `{ regle: 'RG-COO-047' }` si champ gelé modifié ; message maquette : « Entretien repris de Broadcast : modifiable seulement quand l'Instruction OK se fait après contrôle (dossier « En cours »). »
- Sources : legacy `WEB/Controllers/PreparationDeroulants/PreparationDeroulantsController.cs:1096` ; `REP/PreparationRepository.cs:1046-1055,1084-1103` ; `BLL/TrainListeInstructionBll.cs:405-428` (ancien ID provisoire RG-COO-062) · spec [PP] §3 ; EX-EXI-031 (EX-COO-021) ; écran ECR-COO-02 (champ Entretien)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-048 — Entretien : repris de Broadcast, 8 % par défaut, campagne contrôlée 15 %
- Origine : MODIFIÉE
- Énoncé : le % d'entretien saisi dans Broadcast est repris à l'intégration sans ressaisie (cible) ; à défaut (prépa pas encore envoyée) 8 % ; campagne contrôlée : 15 % et visuel en tête de train. Le champ « Entretien (%) » (0 à 30) n'est modifiable par la Coordination que si l'Instruction OK se fait après contrôle (dossier `EN_COURS`). Le calcul d'entretien par afficheur (rien sous 3 affiches, sinon % arrondi au supérieur) est de la compétence de coo2.
- Déclencheur : intégration de l'instruction ; saisie dans la fiche dossier.
- Conditions : valeur numérique 0 à 30 ; statut `EN_COURS` pour modification.
- Effet / message d'erreur : `instr_entretien` ; 422 hors bornes. MODIFIÉE : legacy = 8 % par défaut, ressaisi à la main par la Pré-Prod ; fixe/pliage : quantité d'entretien fournie par Broadcast.
- Sources : legacy `SQL/p_integ_instructions.sql:175-259` (entretien 8 par défaut) ; `SQL/p_integ_preparation.sql:121,160` · spec ateliers EX-COO-501, EX-COO-508 (A14 slide 32 #3) ; [PP] §4, §10 (EX-COO-023) ; EX-EXI-075 ; écran ECR-COO-02
- Questions liées : Q-224
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-049 — Répartition par thème reprise de Broadcast et position 1 d'une campagne contrôlée
- Origine : NOUVELLE
- Énoncé : à l'intégration d'une instruction, la répartition par thème (pourcentages) de Broadcast est reprise sans ressaisie ; une campagne contrôlée place son thème en position 1 (début de train). Ceci évite la ressaisie de la répartition et le changement manuel de position.
- Déclencheur : intégration de l'instruction.
- Conditions : `campagne_controlee = vrai` pour la position 1.
- Effet / message d'erreur : `instruction_visuels.insv_pourcentage` initialisé avec Broadcast (`_ori` conservé) ; position A (début) pour la campagne contrôlée.
- Sources : spec ateliers EX-COO-508, EX-COO-501 (A14 slide 32 #3, S L77) ; [DC] ; contradiction ateliers 6 (re-saisie « bloquante mais non nécessaire »)
- Questions liées : Q-205
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-050 — Valeurs de position d'une instruction
- Origine : CONSERVÉE
- Énoncé : la position d'une instruction (`tip_ins_code`) prend les valeurs : 0 standard (rang proposé), 1 début de train (ordre 0), 2 fin de train (ordre 99), 3 fin-1 (ordre 98), 4 milieu (ordre 15). La Coordination peut la changer tant que l'instruction est `EN_COURS`. Le calcul de l'ordre dans les trains est de la compétence de coo2.
- Déclencheur : saisie de la position ; Instruction OK.
- Conditions : valeur ∈ {0, 1, 2, 3, 4} ; statut `EN_COURS` pour la modification (RG-COO-047).
- Effet / message d'erreur : 422 si valeur hors liste ; historique « ModificationInstructionPlus ».
- Sources : legacy `SQL/p_u_associe_train.sql:132-157` ; `Enums.cs:274-286` (ancien ID provisoire RG-COO-065) · spec [PC] p.1-2 (« positions souvent début ou fin de train ») (EX-COO-019) ; écran ECR-COO-02 (Position A-D) ; bdd.md §6
- Questions liées : Q-224
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-051 — Grain de l'Instruction OK : atelier × plateforme
- Origine : CONSERVÉE
- Énoncé : l'Instruction OK se fait par ligne atelier × plateforme (ex. 2 m² Wissous, 2 m² Nîmes) : clé d'instruction dossier × semaine × atelier ; l'autre plateforme d'un même format se retrouve par substitution d'atelier (5↔6, 7↔8). L'écran ECR-COO-01 affiche une ligne par dossier en agrégeant les instructions de ses ateliers (HYPOTHÈSE Q-206) ; l'action groupée s'applique à toutes les instructions `EN_COURS` du dossier. Changement de statut appliqué ensemble à plusieurs ateliers cochés (5, 6, 7, 8, 11, 12).
- Déclencheur : lecture/enregistrement des instructions.
- Conditions : ateliers rattachés à l'utilisateur (RG-COO-167).
- Effet / message d'erreur : agrégation du statut du dossier : `EN_COURS` s'il reste une instruction `EN_COURS`.
- Sources : legacy `SQL/p_integ_instructions.sql:155-158,559-562` ; `BLL/TrainListeInstructionBll.cs:526-562,266-275` (ancien ID provisoire RG-COO-046, 061 ; note `Substring(8,1)` à corriger pour les ateliers 11/12) · spec [PP] §10 (EX-COO-049) ; écran ECR-COO-01
- Questions liées : Q-206
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-052 — Pas d'Instruction OK avant la prépa
- Origine : NOUVELLE
- Énoncé : une instruction ne peut pas passer `INSTRUCTION_OK` tant que la prépa du dossier n'est pas reçue (état « ATTENTE » : « À traiter · prépa pas reçue »). L'idée d'une Instruction OK avant la prépa est abandonnée.
- Déclencheur : toute tentative de passage à `INSTRUCTION_OK`.
- Conditions : `statut_preparation = PREPARATION_RECUE`.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-052' }` ; l'instruction affichée « À traiter · prépa pas reçue » (Info).
- Sources : spec [PC] p.1 ; [PP] §2 (« Pas d'Instruction OK avant la prépa (abandonné ») (EX-COO-026) ; écran ECR-COO-01 (colonne Instruction OK)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-053 — Renvoi de Broadcast après l'Instruction OK ou l'export : ignoré mais signalé
- Origine : MODIFIÉE
- Énoncé : les instructions et faces renvoyées par Broadcast alors que l'instruction est à un statut ≥ 2 sont ignorées (aucune mise à jour des trains figés) ; la cible ajoute une alerte à la Coordination (et aux chefs d'équipe après l'export), au lieu de l'oubli silencieux du legacy. Après l'export du jeudi 14 h, les trains exportés ne changent pas.
- Déclencheur : intégration d'une instruction/face dont l'instruction est à 2, 4 ou 5.
- Conditions : statut ∈ {2, 4, 5} (4 : ignoré sans alerte).
- Effet / message d'erreur : alerte « Rajout après préparation » / `APRES_LIBERATION` (serious) si export fait ; écart visible dans ECR-COO-01 (RG-COO-067). MODIFIÉE : legacy RG-COO-047/049 = ignoré silencieusement.
- Sources : legacy `SQL/p_integ_instructions.sql:578-590` ; `SQL/p_integ_train_affiches.sql:38-48,119-138` (ancien ID provisoire RG-COO-047, 049) · spec [PP] §4, §9, §10 (EX-COO-022) ; EX-EXI-033 ; maquette `app.js` `renvoiPrepa`
- Questions liées : Q-204, Q-216
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-054 — Renvoi de prépa avant l'export : réouverture de l'Instruction OK
- Origine : NOUVELLE
- Énoncé : si Broadcast renvoie la prépa d'un dossier alors que les trains ne sont pas exportés, l'Instruction OK du dossier est rouverte (statut `EN_COURS`, calcul des trains recalculé) tandis que la validation admin ne bouge pas. Règle de la maquette ; option (b) de Q-204.
- Déclencheur : arrivée d'un renvoi de prépa (jalon 5 : « renvoi de Broadcast avant jeudi 14 h »).
- Conditions : instruction à `INSTRUCTION_OK` ; trains non exportés ; Q-204 tranchée en faveur de (b).
- Effet / message d'erreur : `INSTRUCTION_OK → EN_COURS` ; `iok` supprimé ; historique ; non implémentée tant que Q-204 est ouverte (par défaut RG-COO-053).
- Sources : spec [PP] §2 jalon 5, §10 (EX-COO-044, EX-COO-022) ; maquette `app.js` `renvoiPrepa` (§1.4 point 9) ; `maquettes-autres-modules.md §A`
- Questions liées : Q-204
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-055 — Écart Broadcast / Circé : calcul
- Origine : NOUVELLE
- Énoncé : l'écart d'un dossier est `qte_BC − qte_Circé` (signé) ; il est non nul lorsque la quantité ou le thème sont modifiés dans Broadcast après l'envoi, ou que la prépa diffère de ce qui est reçu. À l'arrivée de la prépa, la ligne bascule en gardant son lien ; seul un écart de thème ou de quantité lève l'alerte (RG-COO-086). Un écart non nul rend l'instruction « En cours » (motif « écart ») et affiche une pastille Critique.
- Déclencheur : lecture de Broadcast ; arrivée de la prépa.
- Conditions : `qte_bc` et `qte_circe` comparables au grain de la ligne (Q-206, Q-209).
- Effet / message d'erreur : colonne « Écart BC / Circé » ; filtre « Écart Broadcast / Circé » ; alerte RG-COO-067.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 ; [RA] RG-AT-05 (EX-COO-028) ; écran ECR-COO-01 (`qteBCInfo{bc,circe,date}`) ; EX-EXI-019 (quantité non recalculée à la bascule, écart non signalé : défaut legacy corrigé)
- Questions liées : Q-209, Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-056 — « Appliquer la version Broadcast » (annule et remplace)
- Origine : NOUVELLE
- Énoncé : pour un écart dû à une erreur, l'action « Appliquer la version Broadcast » aligne Circé sur Broadcast : `qte_BC` remplace la quantité Circé (annule et remplace), recalcul des trains non produits, trains déjà en production signalés à l'atelier. Réservée à `coord`/`admin`. L'action lève l'alerte « Écart Broadcast / Circé ».
- Déclencheur : bouton dans la fiche dossier (écart critique).
- Conditions : instruction non exportée pour le recalcul ; pour un train en production : signalement sans modification (point de non-retour).
- Effet / message d'erreur : transaction unique ; historique ; 403 hors rôle ; 409 si version périmée.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 (EX-COO-019, EX-COO-028) ; écran ECR-COO-02 (« Appliquer la version Broadcast ») ; ateliers EX-TRA-514 (« annule et remplace »)
- Questions liées : Q-225
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-057 — « Demander une correction à Broadcast » (mail à la Pré-Prod)
- Origine : NOUVELLE
- Énoncé : l'action ouvre une modale avec un champ « Qu'y a-t-il à corriger ? » (texte libre, facultatif) et envoie un mail « [Circé] Correction à faire dans Broadcast : dossier n (annonceur) » aux gestionnaires du pôle du dossier (Pré-Prod · gestionnaires <pôle>, liste de distribution, Q-220) ; l'état du dossier ne change pas ; la demande est tracée (date, utilisateur, note) ; si une demande existe déjà, la modale indique « Une demande est déjà partie le … Le mail sera renvoyé. » ; si la production est lancée : « Production lancée — Prévenez aussi l'atelier ». Circé ne peut pas écrire dans Broadcast : le mail est le seul canal.
- Déclencheur : bouton « Demander une correction à Broadcast » ; `Idempotency-Key`.
- Conditions : rôle autorisé ; dossier existant.
- Effet / message d'erreur : mail envoyé après commit (échec d'envoi tracé, n'annule pas la demande, Q-219) ; historique.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 ; EX-TRA-030, EX-TRA-039 (EX-COO-019, EX-COO-028) ; écran ECR-COO-04
- Questions liées : Q-219, Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-058 — Écart dû à « reste en place » : constat puis Instruction OK
- Origine : NOUVELLE
- Énoncé : si l'écart provient d'un thème « reste en place » (non livré), la Coordination constate l'écart puis passe l'Instruction OK ; proposition à valider (Q63) : si écart = quantité « reste en place » (même dossier, plateforme, semaine), l'Instruction OK devient automatique. Les thèmes « ne pas afficher » / « reste en place » sont exclus automatiquement de la préparation (tag, aucune production).
- Déclencheur : calcul de l'écart (RG-COO-055).
- Conditions : `EstResteEnPlace` conservé de Broadcast (RG-COO-092).
- Effet / message d'erreur : si la proposition est retenue : `EN_COURS → INSTRUCTION_OK` automatique ; sinon action manuelle (RG-COO-044). Non implémenté par défaut (Q-224).
- Sources : spec [PP] §4, §10 ; ateliers EX-COO-502, EX-COO-509 (A14 slide 32 #4) (EX-COO-019, EX-COO-023)
- Questions liées : Q-224, Q-209
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-059 — Commentaire de prépa libre : affichage et proposition de position
- Origine : NOUVELLE
- Énoncé : le commentaire de prépa est affiché dans la liste « En cours » (colonne masquée disponible) ; si le commentaire demande « début » ou « fin » de train, Circé propose la position correspondante, la Coordination confirme (jamais appliquée seule). Le commentaire rend l'instruction non automatique (RG-COO-042).
- Déclencheur : intégration de l'instruction ; lecture de la fiche dossier.
- Conditions : commentaire non vide.
- Effet / message d'erreur : proposition = information, aucune écriture sans action de la Coordination.
- Sources : spec [PP] §4, §10 ; EX-EXI-031 (EX-COO-023) ; écran ECR-COO-01 (commentaires de prépa MOCK, `Visuel B en tête de train…`)
- Questions liées : Q-224
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-060 — Un seul écran de liste d'instructions, filtre « À faire (Coordination) »
- Origine : MODIFIÉE
- Énoncé : un seul écran couvre « Validation admin et Instruction OK » (Pré-production, tous ateliers) et « Liste des instructions » (Déroulant, `?pour=deroulant`), une ligne par dossier. Filtre « À faire (Coordination) » (défaut : Validation admin à confirmer + Instruction OK en cours + Écart Broadcast / Circé ; autre valeur « Rien à faire »). Libellés « un mot, un sens » : « À traiter » désigne la préparation du dossier ; l'instruction non encore traitée s'affiche « À traiter · prépa pas reçue ». MODIFIÉE : le legacy a deux écrans de liste d'instructions avec des listes de statuts différentes (`TrainListeInstruction` : 1, 2, 4 ; `PreparationDeroulants` : table 0→{0,1,4}, 1→{1,2,4}, 2→{2,1,4}, 4→{4,0}).
- Déclencheur : ouverture de l'écran.
- Conditions : périmètre RG-COO-167 ; défaut semaine suivante dans le legacy, filtre « Départ » dans la cible.
- Effet / message d'erreur : liste unique ; actions groupées selon RG-COO-010, 044.
- Sources : legacy `BLL/TrainListeInstructionBll.cs:199-275` ; `WEB/Views/Shared/_MenuNew.cshtml:84-87` (ancien ID provisoire RG-COO-061) · spec [README] §3, [DESIGN] §11 (EX-COO-050, EX-COO-020) ; ateliers EX-COO-504 (APPFR-1143) ; écran ECR-COO-01
- Questions liées : Q-206, Q-200
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-061 — Historique de tout changement de statut d'instruction / de dossier
- Origine : MODIFIÉE
- Énoncé : tout changement de statut d'une instruction (y compris par un traitement automatique) et tout changement de statut de préparation d'un dossier écrit une ligne d'historique (ancien → nouveau, acteur nominatif ou « Circé (automatique) » pour les traitements, date). MODIFIÉE : legacy = historisation seulement vers 2 ou 4 (`ChangementStatutInstruction`) et aucun historique pour les batchs (`tt_log` / `FluxChargement` seulement).
- Déclencheur : toute transition de la section 3.2.
- Conditions : écriture dans la même transaction que le changement.
- Effet / message d'erreur : l'échec d'écriture de l'historique annule le changement.
- Sources : legacy `BLL/HistorisationBll.cs:16-127` (ancien ID provisoire RG-INT-046) · spec [README] §2.6 ; EX-TRA-034 ; règle projet CLAUDE.md §6 ; bdd.md §5 (absence d'historique de statut pour la coordination)
- Questions liées : Q-004
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-062 — Dossier annulé : sans objet pour la validation admin et l'Instruction OK
- Origine : NOUVELLE
- Énoncé : un dossier annulé (vente annulée) affiche « Annulé » en préparation, « — » en validation admin et « — » en Instruction OK ; aucune alerte de coordination (validation à confirmer, préparation non reçue, écart) n'est levée pour lui ; les affiches déjà reçues restent en stock (RG-X-065).
- Déclencheur : annulation de la DA/vente par Broadcast.
- Conditions : `statut_preparation = ANNULE`.
- Effet / message d'erreur : alertes existantes du dossier levées ; filtre « À faire » l'exclut.
- Sources : maquette ECR-COO-01 (statuts affichés, dossier annulé WIS) ; [PC] p.1 (Annulé) (EX-COO-013)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-063 — Envoi de la prépa : statut de préparation du dossier
- Origine : MODIFIÉE
- Énoncé : le gestionnaire envoie la prépa depuis Broadcast (le lundi : thèmes, exceptions, commentaire) ; à son intégration, le dossier passe `A_TRAITER → PREPARATION_RECUE` (posé par Circé, jamais par un utilisateur de Circé) et l'instruction passe `EN_COURS` (RG-COO-041). Dossier annulé : `ANNULE`. Un dossier ne revient pas à `A_TRAITER` ; un renvoi laisse `PREPARATION_RECUE` (RG-COO-054). La Pré-Prod ne suit plus l'aval.
- Déclencheur : intégration d'une prépa Broadcast (RG-COO-121, 131).
- Conditions : groupe de préparation Broadcast au statut « envoyé » (133) ; dossier non annulé.
- Effet / message d'erreur : historique (RG-COO-061) ; la pastille de validation admin ne change pas. MODIFIÉE : legacy = statut Broadcast « Envoyé » seulement, aucun statut de dossier côté Circé (le statut s'arrête à « Instruction OK », EX-EXI-072).
- Sources : legacy `SQL/p_integ_preparation.sql:100-147` ; `BLL/BatchAlimBll.cs:91-124` · spec [PC] p.1 ; [PP] §1, §2 (EX-COO-026) ; EX-EXI-016, EX-EXI-070, EX-EXI-072
- Questions liées : Q-200, Q-215
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-064 — La prépa n'est plus le feu vert de la validation admin
- Origine : MODIFIÉE
- Énoncé : l'arrivée de la prépa reste le feu vert de Broadcast (début du suivi de production) mais ne bloque plus le contrôle des affiches ni la validation admin (RG-COO-001). Aucune garde de validation ne lit `statut_preparation`.
- Déclencheur : validation d'une affiche (garde négative).
- Conditions : aucune.
- Effet / message d'erreur : test de rejet : validation acceptée avec dossier `A_TRAITER`.
- Sources : spec [PC] p.1 ; [PP] §1, §2 (EX-COO-026) ; EX-EXI-053
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-066 — Alerte « Préparation non reçue » (deadline jeudi S-2 16 h)
- Origine : NOUVELLE
- Énoncé : pour un dossier dont la prépa n'est pas reçue, une alerte à la Coordination (qui relance la Pré-Prod) est levée : gravité « À surveiller » (warning) avant la deadline, « Critique » (critical) si la deadline Pré-Prod est dépassée (« préparation absente après la deadline »). Deadline = jeudi S-2 à 16 h (S-2 par rapport à la semaine de départ ; maquette : « jeudi S-2 16h »). Se lève à l'arrivée de la prépa ou à l'annulation du dossier.
- Déclencheur : calcul planifié (au moins horaire) ; arrivée de la prépa.
- Conditions : dossier non annulé, `statut_preparation = A_TRAITER`, DA activée.
- Effet / message d'erreur : alerte clé `PP-<dossier>` ; teinte critique de la ligne (ECR-COO-01) ; destinataires `coord`.
- Sources : spec [PC] p.2 ; [DESIGN] §2.2 (EX-COO-027, EX-COO-047) ; EX-EXI-077 ; écran ECR-TRA-01 (`IP_MANQUANTES`), ECR-COO-01 (Deadline)
- Questions liées : Q-220, Q-222
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-067 — Alerte « Écart Broadcast / Circé »
- Origine : NOUVELLE
- Énoncé : quantité ou thème modifiés dans Broadcast après l'envoi, ou prépa différente de ce qui est reçu, lèvent une alerte « Écart Broadcast / Circé » (gravité Important/serious) à la Coordination ; lien vers ECR-COO-01 filtré ; traitement par RG-COO-056 ou RG-COO-057 ; levée quand l'écart devient nul.
- Déclencheur : lecture de Broadcast ; arrivée de la prépa ; recalcul.
- Conditions : écart non nul (RG-COO-055) ; la correction d'intitulé faite par la plateforme (`corrPlateforme`, coo2) n'alerte pas.
- Effet / message d'erreur : alerte clé `BC-<dossier>`.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 ; [RA] RG-AT-05 (EX-COO-028, EX-COO-047) ; écran ECR-TRA-01 (`ECART_BC` → serious)
- Questions liées : Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-068 — Alerte « Thème modifié dans Broadcast » et « Reprendre la version Broadcast »
- Origine : NOUVELLE
- Énoncé : un thème modifié dans Broadcast après la validation/l'Instruction OK lève une alerte : « Critique » si la production est lancée (l'atelier est prévenu par mail aux chefs d'équipe), « Important » avant la production. L'action « Reprendre la version Broadcast » remplace le thème de Circé par celui de Broadcast, historise, pose « Feuille à refaire » côté Réception (RG-X-057) et, si production lancée, envoie le mail à l'atelier. Reprise automatique ou après clic : à décider (Q-210).
- Déclencheur : comparaison à chaque mise à jour de la copie Broadcast ; clic « Reprendre la version Broadcast ».
- Conditions : thème Broadcast ≠ thème Circé (comparaison par identifiant, RG-COO-081).
- Effet / message d'erreur : alerte `TBC-…` ; toast « Thème « … » repris de Broadcast pour le dossier … Production lancée : l'atelier est prévenu. ».
- Sources : spec [PC] p.2 ; [README] §2.1, §3 (EX-COO-029, EX-COO-047, EX-COO-030) ; écran ECR-THM-03, ECR-COO-02 ; EX-THM-503 (ateliers)
- Questions liées : Q-210, Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-069 — Vérification des thèmes proches entre dossiers
- Origine : NOUVELLE
- Énoncé : dès la saisie des IP, Circé compare les intitulés de thèmes d'un même annonceur de référence (ou groupe d'annonceurs proches non « différents ») : deux intitulés sont proches si, simplifiés (minuscules, sans accents ni ponctuation), identiques, ou l'un contenu dans l'autre (≥ 3 caractères, mots entiers), ou de similarité ≥ seuil 0,85 (paramétrable). Pour un groupe « À vérifier », deux réponses : « Demander la correction dans Broadcast » (mail au gestionnaire du pôle, un mail par pôle, l'état du dossier ne change pas) ou « Visuels différents » (lève l'alerte, rouvrable). Refus si la production est lancée sur tous les dossiers du groupe. Les thèmes sont comparés tant que non tranché.
- Déclencheur : lecture de Broadcast avec nouveaux thèmes ; actions utilisateur ; écran « Vérification des thèmes ».
- Conditions : thèmes de dossiers avec DA activée, départ ≥ semaine en cours ; rôle `coord`/`admin`.
- Effet / message d'erreur : statuts À vérifier / Demande envoyée / Corrigé par Broadcast / Visuels différents / Même intitulé ; messages « Demande envoyée pour n dossier(s) : mail au gestionnaire… », « Noté : ce sont des visuels différents. L'alerte est levée. », « Rien à demander… Voir avec l'atelier » ; le groupe disparaît quand Broadcast renvoie la prépa corrigée.
- Sources : spec [README] §2.1, §3 (PP-08, PP-09) (EX-COO-030) ; ateliers EX-COO-513, EX-THM-502 (A14 slide 30 #2) ; écran ECR-THM-01 ; `maquettes-autres-modules.md §4` ; EX-EXI-079
- Questions liées : Q-220, Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-070 — Vérification des annonceurs proches
- Origine : NOUVELLE
- Énoncé : dès la DA activée, Circé repère les annonceurs proches (même règle de proximité, regroupements d'enseignes `*MISTRAL*` → `MISTRAL` en paramètre) ; deux réponses : « Demander la correction » (source Broadcast : demande + mail au gestionnaire du pôle ; source plateforme fixe/colle : alignement du nom imprimé dans Circé) ou « Annonceurs différents » (les thèmes ne sont plus comparés entre eux, rouvrable). Aucun regroupement ajouté par Circé.
- Déclencheur : lecture de Broadcast ; actions utilisateur.
- Conditions : DA activée même sans réception.
- Effet / message d'erreur : statuts À vérifier / Demande envoyée / Corrigé / Annonceurs différents ; messages « Demande envoyée pour n dossier(s) ; n nom(s) imprimé(s) aligné(s)… » ; « Noté : ce sont des annonceurs différents… ».
- Sources : spec [README] §2.1, §3 (EX-COO-030) ; écran ECR-THM-02 ; ECR-ADM-05 (seuil, regroupements)
- Questions liées : Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-071 — Alerte « Réception sur un dossier sans IP »
- Origine : NOUVELLE
- Énoncé : une réception sur un dossier dont les IP ne sont pas saisies (réception sur annonceur sans thème ; ligne attendue au visuel provisoire) lève une alerte à la Coordination (gravité grave = Important/serious), qui prévient la Pré-Prod ; elle se lève à la saisie des IP. Ce n'est pas une réception inconnue (le dossier existe dans Broadcast). La Pré-Prod garde autant que possible l'intitulé saisi par la plateforme qui a réceptionné en premier.
- Déclencheur : création d'une affiche rattachée à une ligne provisoire (RG-COO-084) ; recalcul.
- Conditions : au moins une affiche rattachée à une ligne `visuel provisoire`.
- Effet / message d'erreur : alerte clé `IP-<affiche>` ; destinataires `coord` ; lien vers ECR-COO-01 (colonne IP « Non saisies »).
- Sources : spec [PC] p.2 ; [DC] §7, §11 (EX-COO-031, EX-COO-047) ; EX-REC-042, EX-REC-065 ; ateliers EX-COO-512, EX-REC-516/519/520 (A14 slide 26, 34) ; écran ECR-TRA-01 (`SANS_IP`)
- Questions liées : Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-072 — Alertes « Réception inconnue à identifier » et « Dossier introuvable » (côté Coordination)
- Origine : NOUVELLE
- Énoncé : (1) la création d'une réception inconnue lève dès la création l'alerte « Réception inconnue à identifier » (Coordination et Réception ; Important après 24 h, À surveiller avant) ; (2) le bouton « Signaler à la Coordination (alerte) » lève l'alerte « Dossier introuvable » (grave dès le signalement, destinataire Coordination du site, sans mail) et pose le statut « Introuvable : alerte à la Coordination ». Rattachée par la Coordination, l'affiche est validée (RG-COO-017) et les alertes se lèvent.
- Déclencheur : création d'une réception inconnue (REC) ; action « Signaler ».
- Conditions : affiche sans dossier rattaché ; délai 24 h paramétrable.
- Effet / message d'erreur : alertes `OR-…`, `DI-…` ; destinataire Nîmes : Coordination du site ou « Pré-Prod Nîmes » (Q-221). Définitions de création : RG-REC (EX-REC-035 à 041, 066, 067).
- Sources : spec [PP] §6 ; [PC] p.2 (EX-COO-017, EX-COO-047) ; EX-REC-036, EX-REC-041, EX-REC-066, EX-REC-067 ; écran ECR-REC-04, ECR-TRA-01
- Questions liées : Q-221, Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-073 — Alerte « Rajout après préparation » (mail à la liste de distribution)
- Origine : NOUVELLE
- Énoncé : toute préparation (fixe et scro) envoyée dans Circé à partir de la nuit du jeudi au vendredi S-2 jusqu'au vendredi de la semaine S déclenche une alerte et un mail au chef d'atelier, aux admins de la plateforme et aux coordinateurs (liste de distribution « Rajouts après préparation – <site> » à établir dans Administration) ; aucun raccrochage automatique dans le train pour les trains restant à produire (l'atelier choisit fractionner ou raccrocher) ; mail conservé (H3).
- Déclencheur : intégration d'une prépa/instruction dans la fenêtre.
- Conditions : date d'intégration dans [jeudi→vendredi S-2 nuit ; vendredi S] (fenêtre à confirmer, Q-222) ; fixe : date d'envoi > date du 1er colisage (EX-FIX-503 : coo2).
- Effet / message d'erreur : alerte `APRES_LIBERATION` (serious) ; mail via liste de distribution ; échec d'envoi tracé.
- Sources : spec ateliers EX-COO-503, EX-ADM-504, EX-FIX-503 (A14 slide 33 #1, S L71) ; [DC] §11 (H3) ; EX-TRA-030 ; écran ECR-ADM-04, ECR-TRA-01 ; EX-EXI-078
- Questions liées : Q-222, Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-074 — Alerte « Dernière minute sur fichier envoyé » (DM)
- Origine : NOUVELLE
- Énoncé : une dernière minute (DM) sur un train déjà en production (fichier scro validé) lève l'alerte `DM_FICHIER` (Critique) et un mail aux chefs d'équipe du déroulant ; la modification est tracée sur le train ; un fichier complémentaire est généré à part (sortie systématique en fractionné : coo2). Aujourd'hui aucune alerte n'existe pour une DM avec fichier scro validé.
- Déclencheur : intégration d'une instruction/face après le lancement de la production du train.
- Conditions : train `EN_PRODUCTION` (point de non-retour, coo2).
- Effet / message d'erreur : alerte critique ; traçabilité ; « Générer un complément » (générateur, autre agent).
- Sources : spec ateliers EX-COO-503, EX-COO-512 (A14 slide 33, 34) ; EX-EXI-078 ; écran ECR-TRA-01 (`DM_FICHIER`, critical), `maquettes-autres-modules.md §A` point 3
- Questions liées : Q-222
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-075 — Menu « Alertes Pré-Prod »
- Origine : NOUVELLE
- Énoncé : un espace « Alertes Pré-Prod » regroupe les alertes de pré-production : intitulés de thèmes proches (RG-COO-069), annonceurs proches (RG-COO-070), thèmes modifiés dans Broadcast (RG-COO-068), réceptions sans IP (RG-COO-071), DM et mises à jour post-envoi (RG-COO-073, 074), avec rappel aux gestionnaires et alerte au développeur référent. Il est servi par Pilotage › Alertes (RG X / ECR-TRA-01) et Pré-production › Vérification des thèmes ; où se situe l'écran (Broadcast ou Circé) reste ouvert (Q19 d'origine, décision provisoire : dans Circé).
- Déclencheur : ouverture du menu.
- Conditions : rôle `coord`/`admin`.
- Effet / message d'erreur : lecture ; chaque entrée ouvre l'écran où agir.
- Sources : spec ateliers EX-COO-513, EX-THM-502, EX-COO-512 (A14 slides 30, 34 ; S L66) ; [README] §2.1 (EX-COO-030) ; écran ECR-TRA-01
- Questions liées : Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-076 — Calendrier du process : deadlines
- Origine : NOUVELLE
- Énoncé : le calendrier de référence est : envoi de la prépa le lundi (jalon 4) ; deadline Pré-Prod (envoi de la prépa) le jeudi S-2 à 16 h ; deadline réception le vendredi S-2 à 16 h 30 (maquette) ; export des trains le jeudi à 14 h (coo2) ; point de non-retour au Go aux plateformes (jeudi S-2). Ces valeurs sont des paramètres (heure, jour), pas des constantes du code. Aucune restriction horaire n'est codée dans le legacy (« le jeudi 14 h n'apparaît pas dans le code »).
- Déclencheur : calcul des alertes de retard (RG-COO-066) ; affichage des deadlines.
- Conditions : semaine de départ ISO.
- Effet / message d'erreur : paramètres Administration › Règles métier (Q-220).
- Sources : spec [PP] §2 ; [PC] p.2 ; EX-EXI-077 ; maquette `M.deadlinePP` (EX-COO-044) ; legacy `legacy-coordination.md` RG-COO-070 (aucune restriction horaire)
- Questions liées : Q-222, Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
