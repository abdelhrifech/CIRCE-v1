Les définitions des types d'alerte (gravité, destinataires, canal) et la machine d'états de l'Instruction OK et de la validation admin sont possédées par coo1 (`RG-COO-1xx`, `RG-X-050` à `RG-X-074`) ; les règles ci-dessous fixent les CONDITIONS de déclenchement côté trains / unités et les effets croisés avec la Réception.

### RG-X-075 — Visuel arrivé après la préparation des trains (déroulant)
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : lorsqu'une affiche est reçue (ou un thème nouveau apparaît) pour un dossier du déroulant dont la préparation est déjà reçue et dont les trains sont déjà calculés (Instruction OK) ou exportés, le thème est ajouté au dossier validé, le statut de préparation du dossier repasse à « Préparation reçue » (PREPA_RECUE), une alerte « Rajout après préparation » (gravité importante) est créée et un mail part à la liste de distribution « Rajouts après préparation » (chef d'atelier, admins de la plateforme, coordinateurs logistique, liste par plateforme). Il n'y a PAS de raccrochage automatique dans les trains restant à produire : l'atelier choisit « Fractionner » ou « Raccrocher » (RG-COO-221, RG-COO-222).
- Déclencheur : réception / rattachement d'une affiche dont le thème n'est couvert par aucune position de train du dossier ; nouvelle préparation Broadcast.
- Conditions : fenêtre de l'alerte : toute préparation envoyée à partir de la nuit du jeudi au vendredi S-2 jusqu'au vendredi de la semaine S (fenêtre contradictoire avec la deadline Pré-Prod du jeudi S-2 16 h : Q-266) ; sans le mail, la plateforme ne sait pas qu'elle a le go ; pas d'alerte pour une dernière minute avec fichier scro validé (RG-X-077).
- Effet / message d'erreur : alerte + mail (liste de distribution gérée dans Administration) ; trains non exportés : couverture recalculée (RG-COO-208) ; trains exportés : figés (RG-COO-223).
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503), `specs-transverse.md §E` (EX-TRA-031 : alerte « Visuel arrivé après la préparation des trains »), `specs-existant-process.md §F` (EX-EXI-078) ; maquette `maquettes-reception-coordination.md §1.4` (événement 2, RP34) ; écran `ECR-TRA-01`, `ECR-ADM-04`
- Questions liées : Q-266
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-076 — Dossier fixe / pliage / bus arrivé après la libération de la semaine
- Origine : NOUVELLE
- Modules : COO → REC (le déclencheur est l'arrivée de la préparation ; le destinataire est l'atelier / la Coordination)
- Atomicité : transaction unique oui
- Énoncé : si une préparation 2 m² fixe (ou pliage, bus) d'une semaine déjà libérée (RG-COO-240) est reçue après la date de libération, la création de la ligne déclenche : le repère « Arrivé après libération » (RG-COO-242), l'alerte `APRES_LIBERATION` (gravité importante), un mail aux chefs d'équipe du fixe de la plateforme et à la Coordination, et l'inscription du dossier à la liste des « dossiers arrivés après » du bandeau de libération. Cela couvre le besoin de Nîmes : alerte quand la date d'envoi d'un dossier fixe pour la semaine S est postérieure à la date du 1er colisage (libération) effectué pour la semaine S.
- Déclencheur : intégration de la préparation (alimentation, coo1) ou réception d'une affiche sur un dossier de semaine libérée.
- Conditions : libération existante pour (atelier, semaine) ; date de la préparation > date de libération ; la libération ne dépend pas de la validation admin (RG-X-084).
- Effet / message d'erreur : alerte `APRES_LIBERATION` + mail ; aucune modification des UM déjà créées.
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-503), `PARTIE 2` (EX-COO-503), `specs-existant-process.md §F` (EX-EXI-078) ; maquette `maquettes-reception-coordination.md §1.4` (événement 1) ; écran `ECR-COO-09`, `ECR-TRA-01`
- Questions liées : Q-265, Q-266
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-077 — Dernière minute sur un train déjà en production
- Origine : NOUVELLE
- Modules : COO → REC (bidirectionnel avec Broadcast ; la Réception est informée par l'alerte et la feuille de stock à refaire éventuelle)
- Atomicité : transaction unique oui
- Énoncé : lorsque Broadcast modifie une préparation / un thème d'un train dont l'unité est EN_PROD (fichier déjà généré ou bague imprimée), la modification n'est jamais appliquée au train (point de non-retour, RG-COO-223) : elle est tracée sur le train (« Modifications tracées »), une alerte `DM_FICHIER` (gravité critique) est créée et un mail part aux chefs d'équipe du déroulant ; l'unité est teintée en critique dans la liste des trains ; un « complément » (génération des seules unités modifiées) peut être demandé au générateur. Aujourd'hui une dernière minute avec fichier scro validé n'a pas d'alerte : un fichier à part est envoyé et ces affiches sortent systématiquement en fractionné.
- Déclencheur : intégration d'une modification Broadcast (nouvelle face, thème changé, quantité changée) sur un train EN_PROD.
- Conditions : train au statut EN_PROD ou au-delà ; la reprise de l'afficheur par panneau (RG-COO-207) est neutralisée sur ce train.
- Effet / message d'erreur : modification tracée + alerte critique + mail ; aucun statut modifié.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503, EX-COO-512), `specs-existant-process.md §F` (EX-EXI-078) ; maquette `maquettes-reception-coordination.md §1.4` (événement 3) ; écran `ECR-COO-05`, `ECR-GEN-03`, `ECR-TRA-01`
- Questions liées : Q-282
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-078 — Préparation renvoyée par Broadcast avant ou après l'export des trains
- Origine : MODIFIÉE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : (maquette) si la préparation est renvoyée par Broadcast et que les trains ne sont pas exportés, l'Instruction OK du dossier est refaite (marque Instruction OK supprimée, statut de préparation « Préparation reçue ») ; la validation admin ne bouge pas ; si les trains sont déjà exportés (« A imprimer »), ils restent figés et une alerte `APRES_LIBERATION` (gravité importante) part à la Coordination et aux chefs d'équipe. Legacy : les instructions et faces renvoyées après « Instruction ok » ou « A imprimer » sont ignorées sans alerte (RG-COO-047 et RG-COO-049 legacy, coo1) et une préparation renvoyée n'est intégrée que si la précédente a été annulée par déblocage.
- Déclencheur : intégration d'une préparation / de faces / d'instructions déjà connues.
- Conditions : le moment de l'Instruction OK automatique (jeudi 14 h par bouton, option (a) recommandée, ou dès l'arrivée de la prépa, option (b)) n'est pas tranché (EX-COO-022, Q60).
- Effet / message d'erreur : voir Énoncé.
- Sources : spec `specs-coordination.md §C` (EX-COO-022, EX-COO-044 jalon 5), `specs-existant-process.md §B` (EX-EXI-016, EX-EXI-018) ; maquette `maquettes-autres-modules.md §A` (règle `renvoiPrepa`) ; legacy `p_integ_instructions.sql:175-259`, `p_integ_train_affiches.sql:38-48` (RG-COO-047, RG-COO-049 legacy)
- Questions liées : Q-251, Q-266
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-079 — Disponibilité physique des affiches pour la préparation (reçu, contrôle, couverture)
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : le « reçu » d'un thème (somme des quantités des affiches rattachées, par thème, pas par destinataire) alimente la couverture des positions de trains, des UM et des lots (RG-COO-208) et les colonnes Reçu / Couvert / Emplacement du Suivi par thème (RG-COO-230) ; une réception qui complète un visuel manquant fait passer l'unité EN_ATTENTE → PRET sans autre action. La question de savoir si le reçu compte dès la réception (palette en sas « À contrôler ») ou seulement après le contrôle de la palette est ouverte. Les unités EN_PROD ne reviennent jamais en arrière si le reçu diminue (rebut, mise au rebut au stock).
- Déclencheur : réception / contrôle / rebut d'une affiche (REC), changement de rattachement.
- Conditions : reçu = Σ `alloc` des affiches rattachées au thème ; le surplus > 10 % est signalé ; l'entretien est compté dans l'attendu.
- Effet / message d'erreur : recalcul de la couverture (transaction commune avec l'écriture du reçu).
- Sources : maquette `maquettes-reception-coordination.md §1.4` (événement 5), `maquettes-autres-modules.md §0.1` (`C.recu`, `C.etatTheme`, unités EN_ATTENTE → PRET) ; spec `specs-ateliers-besoins.md PARTIE 6` (EX-PIL-501) ; écran `ECR-COO-05`, `ECR-COO-06`
- Questions liées : Q-280
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-080 — Le reçu se rattache au visuel, jamais au destinataire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique non
- Énoncé : l'affiche reçue est rattachée au thème (visuel) d'un dossier et non à un destinataire ; la couverture sert d'abord les unités dont le départ camion est le plus proche ; le total reçu d'un thème se compte une seule fois même si le thème sert plusieurs dossiers, plusieurs semaines ou plusieurs trains (reçu et reste comptés une fois par thème dans les pieds de totaux ; quantité d'un dossier sur deux semaines comptée une fois).
- Déclencheur : calcul de couverture / d'indicateurs.
- Conditions : règle de couverture « départ le plus proche servi d'abord » à confirmer (Q41 de la maquette).
- Effet / message d'erreur : indicateurs et statuts d'unité.
- Sources : maquette `maquettes-autres-modules.md ECR-PIL-03` (Q41, ANO-02), `ECR-PIL-04` ; spec `specs-existant-process.md §F` (EX-EXI-073), `specs-ateliers-besoins.md PARTIE 3` (EX-TRA-015 : quantités doublées sur 2 semaines de départ)
- Questions liées : Q-280
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-081 — « Rendre la main » : conséquences sur le dossier, les affiches reçues et la validation admin
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : « Rendre la main à la Pré-Prod » (RG-COO-243) repasse les dossiers à PREPA_RECUE et les unités non lancées à EN_ATTENTE ; les unités EN_PROD ne sont pas retirées. HYPOTHÈSE : les affiches reçues, leur rattachement et la validation admin ne sont pas modifiés par cette action (comme pour une préparation renvoyée, RG-X-078) ; la maquette n'indique rien d'autre (Q-COO-18).
- Déclencheur : « Rendre la main » (unitaire) / déblocage de préparation (coo1).
- Conditions : unités non EN_PROD.
- Effet / message d'erreur : statuts de dossier et d'unité ; les affiches restent rattachées.
- Sources : écran `ECR-COO-09b` ; spec `specs-existant-process.md §D` (EX-EXI-045), `specs-coordination.md §A` (EX-COO-001) ; maquette `maquettes-autres-modules.md §A`
- Questions liées : Q-267
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-082 — Correction d'intitulé par la plateforme : feuille de stock à refaire et alerte Broadcast ≠ Circé
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : « Corriger l'intitulé » (RG-COO-244) pose `corrPlateforme` sur le thème (ce qui n'alerte pas « Broadcast ≠ Circé »), pose « Feuille à refaire » sur les affiches du thème (alerte `THEME_MODIF`, gravité à surveiller, dans le catalogue d'alertes) et envoie un mail à « Pré-Prod <site> » si la case est cochée ; la portée sur les feuilles de stock et les fichiers déjà envoyés est à préciser. Dans le cas d'une réception sans IP, l'intitulé saisi par la plateforme est conservé comme thème provisoire.
- Déclencheur : validation de la modale « Corriger l'intitulé ».
- Conditions : thème et annonceur non vides.
- Effet / message d'erreur : tag « Feuille à refaire » sur les affiches ; mail éventuel.
- Sources : écran `ECR-COO-09c`, `ECR-TRA-01` (`THEME_MODIF`) ; spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-509), `PARTIE 1` (EX-REC-506) ; `maquettes-autres-modules.md §0.1`
- Questions liées : Q-268
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-083 — L'export des trains ne dépend ni de la validation admin ni de la réception complète
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique non
- Énoncé : l'export des trains du jeudi ne teste ni l'existence d'une validation admin, ni la complétude du reçu : seules comptent l'Instruction OK (automatique ou manuelle), l'absence d'annulation et la réception de la préparation (RG-COO-211). Les affiches arrivant après l'export sont proposées au rattachement puis confirmées par la Coordination, et les urgences du vendredi se traitent à la main ou par renvoi ; les chefs d'équipe peuvent démarrer avant le jeudi à leurs risques. Inversement, la validation admin n'attend pas l'Instruction OK (deux circuits indépendants).
- Déclencheur : export des trains ; réception d'affiche après export.
- Conditions : aucune condition sur `validationAdmin`.
- Effet / message d'erreur : aucun refus lié à la validation admin ou au reçu.
- Sources : spec `specs-coordination.md §A` (EX-COO-001), `§C` (EX-COO-024), `§D` (EX-COO-044 jalon 7) ; `specs-existant-process.md §E` (EX-EXI-054) ; écran `ECR-COO-05b`
- Questions liées : Q-251
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-084 — Création des UM, libération et préparation de l'unitaire indépendantes de la réception et de la validation admin
- Origine : CONSERVÉE
- Modules : COO → REC
- Atomicité : transaction unique non
- Énoncé : ni la création d'UM, ni la libération de la semaine, ni le passage « En cours → Préparé », ni l'arrivée de la ligne dans l'atelier ne sont conditionnés par la réception, le lien affiche ↔ ligne attendue ou la validation admin ; la liste des UM n'affiche que l'état de l'affiche reçue (oui / non, ✓ validée, • proposée) sans blocage. L'effet « UM du fixe et du pliage » de la validation admin est « non démontré » et a été corrigé le 02/11.
- Déclencheur : toute action de l'unitaire.
- Conditions : aucune.
- Effet / message d'erreur : aucune interaction bloquante ; la couverture (RG-X-079) pilote seulement EN_ATTENTE → PRET.
- Sources : legacy `p_s_listeUM_2m2.sql:36-62,113-142` (RG-RPR-024 : « la réception ne conditionne PAS la création d'UM ni le passage 1 → 6 ») ; spec `specs-coordination.md §B` (EX-COO-014), `§A` (EX-COO-001), `specs-existant-process.md §E` (EX-EXI-054)
- Questions liées : Q-265
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-085 — Affiche arrivée après l'export ou le début de production : rattachement manuel du seul surplus
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : une affiche arrivée après l'export des trains (jalon 7) est d'abord « proposée » au rattachement puis confirmée par la Coordination ; les affiches reçues en plus pour un autre dossier se rattachent manuellement, avec historique, même après la validation ou le début de production, mais seul le surplus peut être rattaché ; pour une autre plateforme : transfert puis réception. La production en cours n'est pas modifiée (RG-COO-223).
- Déclencheur : réception d'affiche / rattachement manuel après export.
- Conditions : voir Énoncé.
- Effet / message d'erreur : rattachement historisé ; couverture recalculée sur les unités non EN_PROD.
- Sources : spec `specs-coordination.md §D` (EX-COO-044 jalon 7), `§E` (EX-COO-045)
- Questions liées : Q-280
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-086 — Visuel arrivé après le fractionnement : production à part
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : un visuel fractionné (RG-COO-221) n'est plus attendu dans le train d'origine ; à son arrivée il alimente une ligne de production à part (« ligne à part » ; « les visuels manquants seront produits à part »), sans réintégrer le train fractionné (déjà PRET / EN_PROD) ; pour un train non encore produit, l'atelier peut aussi raccrocher le visuel (RG-COO-222). Cas Nîmes : livraisons tardives.
- Déclencheur : réception d'un visuel dont la position est fractionnée.
- Conditions : position marquée fractionnée.
- Effet / message d'erreur : unité créée ou couverte ; indicateurs mis à jour.
- Sources : écran `ECR-COO-05`, `ECR-COO-05d` ; spec `specs-existant-process.md §C` (EX-EXI-036)
- Questions liées : Q-261
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-087 — Sorties de stock déclenchées par l'expédition des unités
- Origine : MODIFIÉE
- Modules : COO → REC (stock par affiche, module STK)
- Atomicité : transaction unique oui
- Énoncé : cible : la quantité d'affiches est mise à jour à chaque événement : la réception est une entrée de stock ; la « fin de journée Geodis » (ou le scan Milk run à « Terminé ») est une sortie de stock des affiches préparées, avec mouvements négatifs « Expédition C-… » ; le rebut et la destruction sont aussi des sorties. Legacy : les sorties de stock sont générées par le scan des codes barre de fin de production (« douchage des étiquettes de prod »), mais pas à Nîmes (selon les ateliers) ; selon une autre source il n'y a aucune sortie automatique. La demande « scanner les codes barre et que Circé mette à jour les affiches produites et les stocks » contredit la cible (sortie à l'expédition).
- Déclencheur : « Fin de journée » (RG-COO-269) ; scan Milk run.
- Conditions : stock = somme des mouvements ; une seule sortie par unité expédiée.
- Effet / message d'erreur : mouvements de stock créés dans la même transaction que le passage à EXPEDIE.
- Sources : spec `specs-ateliers-besoins.md PARTIE 8` (EX-STK-001, EX-STK-005), `PARTIE 5` (EX-SCR-517), `specs-transverse.md §G` (EX-TRA-037), `specs-existant-process.md §F` (EX-EXI-076) ; écran `ECR-EXP-02`
- Questions liées : Q-281
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-088 — Emplacement des affiches (allée, rayon) saisi à la réception et utilisé par les trains et le picking
- Origine : CONSERVÉE
- Modules : REC → COO
- Atomicité : transaction unique non
- Énoncé : l'emplacement (allée-rayon) renseigné à la réception sur l'affiche est affiché dans la fiche train (colonne « Emplacement des affiches »), dans le Suivi par thème (colonne Emplacement) et dans la liste de picking par rouleur (triée par emplacement, RG-COO-296) ; il est aussi porté sur l'étiquette rack (`allee`, `rayon`) et sur la fiche de picking legacy. Les réceptions inconnues sont rangées dans l'allée tampon « X ».
- Déclencheur : affichage / impression.
- Conditions : emplacement renseigné (sinon colonne vide).
- Effet / message d'erreur : lecture seule.
- Sources : écran `ECR-COO-05a`, `ECR-COO-06`, `ECR-COO-10` ; legacy `Rapport.cs:961-1025` (RG-ADM-062) ; maquette `maquettes-reception-coordination.md §1.4` (événement 4)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)
