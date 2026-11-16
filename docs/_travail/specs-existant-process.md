# Specs de l'EXISTANT métier (Circé actuel) — préfixe EX-EXI

Périmètre lu intégralement : 6 fichiers HTML de `docs-sources/1. CIRCE ACTUEL/` (tous lisibles ; le fichier « Process de bout en bout… (diagrammes) » est composé de SVG, son texte a été extrait par balises, donc l'ordre spatial et les flèches des diagrammes sont reconstitués par déduction), plus les parties « process existant » des 3 extraits d'ateliers et l'image BL.png.

Documents :
| Doc | Date | Contenu |
|---|---|---|
| D1 `20261102 - Process et acteurs, fixe et déroulant.html` | 02/11 | acteurs, fixe/déroulant, statuts objet par objet, points à confirmer (11 sections) |
| D2 `20261029 - Pages de Circé par étape du process.html` | 29/10, MAJ 02/11 | phase 1 « avant l'affiche » : pages, tables, grains, ruptures de grain (8 sections) |
| D3 `20261102 - Process de bout en bout, pages et tables (diagrammes).html` | 02/11 | tableau pas à pas, lien affiche↔ligne attendue, branches fixe/déroulant, schéma des tables, cible option A |
| D4 `schema_dossier_affiche_statuts.html` | 15/10 (MAJ 02/11) | étapes 1 à 8 du dossier + A à C de l'affiche, statuts par objet |
| D5 `schema_fixe_scro_apres_prepa.html` | 15/10 (MAJ 02/11) | fixe vs scro après l'envoi de la prépa |
| D6 `schema_tags_par_etape.html` | 21/10 | tags (cible, en couleur) vs statuts d'aujourd'hui (pointillés), grains, sites/ateliers |

Convention de fiabilité reprise des docs : CONSTATÉ (lu dans le code, fichier:ligne), DÉDUIT, À CONFIRMER, RELEVÉ 26/10. Les EX ci-dessous décrivent l'existant ; les éléments « cible » sont signalés comme tels et ne sont pas validés sauf mention.

---

## A. Acteurs et espaces

### EX-EXI-001 — Trois espaces de travail
- Énoncé : le process actuel se déroule en trois espaces : Pré-Prod dans Broadcast (DA, IP, envoi de la prépa), Coordination dans Circé (Instruction OK, validation admin, export des trains), plateforme dans Circé (réception, ateliers). Circé fait seul la copie, l'intégration et l'Instruction OK simple.
- Type : fonctionnalité
- Source : D1 §1
- Ambiguïté : aucune

### EX-EXI-002 — Acteurs et ce qu'ils font
- Énoncé : Pré-Prod/Broadcast : saisit IP (visuels, thèmes, exceptions, commentaire) et envoie la prépa, ne suit pas l'aval ; qui active la DA = À CONFIRMER. Circé automatique : copie EDR, crée lignes attendues, intègre la prépa (fixe/pliage statut 0, faces et instructions du déroulant), passe l'instruction « En cours », Instruction OK automatique, fin de journée colis expédiés -> Terminé. Coordination : déroulant = Instruction OK à la main, Annulé, export des trains jeudi 14 h ; tous formats = validation admin ; fixe = Colisage (À CONFIRMER, le deck dit « Pré-Prod »). Réception : réception physique, saisie BL, création affiche et n°, orpheline, rangement, zone picking. Atelier : fixe = UM/multi-rouleuse/colis ; déroulant = préparation des trains (rouleur, pré-assemblage, bague), colis.
- Type : permission
- Source : D1 §2 ; D4 (« Qui » de chaque carte)
- Ambiguïté : qui active la DA ; qui fait le Colisage ; D4 dit « Pré-Prod (Nîmes, Coordination) ; référent·es à Wissous » pour validation admin, D1 dit « Coordination » (voir contradictions)

### EX-EXI-003 — Sites et ateliers
- Énoncé : Nîmes : 2 m² déroulant (Vendôme One, CCM V2), 4 m² déroulant, 8 m² déroulant, 2 m² fixe (multi-rouleuse). Wissous : 2 m² déroulant/MUI, 4 m², 8 m², 2 m² fixe, Colle/pliage (4, 8, 12 m² collés, sans machine). Nanterre = Bus, cible seulement. Le code ne connaît que trois types de production : 2M2FIXE, PLIAGE, DEROULANT (`Enums.cs:34-45`) ; pas de flux Broadcast pour le Bus. Le code contient un « Nîmes Pliage 12M2 » et des sites « DBG » absents des decks (À CONFIRMER).
- Type : règle
- Source : D6 « Les sites et leurs ateliers » ; D2 §3 (sites 39, 40, 43, 44)
- Ambiguïté : atelier « Nîmes Pliage 12M2 » et sites DBG à confirmer

### EX-EXI-004 — Matrice acteurs × étapes par site (atelier 14)
- Énoncé : étapes numérotées 1 à 13 (Génération DA, Création Réception, Saisir infos liées au n° d'affiche, Identification orphelines, Saisie des IP, Envoi Préparation, Lien/Raccrochage prépa, Instruction OK, Validation Admin, Liste des trains, Suivi Thèmes, Préparation Trains, Mail Pfe) réparties entre : Pré-Prod commun (Direct/Intermédié, Coordination), Équipe Nîmes (Agent Réception Nîmes, Arthur/Christine), Équipe Wissous (Agent Réception Wissous, Alain, Nelly pour le 8 m², Ville de Paris). Ville de Paris / 8 m² / 2 m² + 4 m² : répartition à Wissous selon le format.
- Type : permission
- Source : atelier_20261014 slide 7
- Ambiguïté : les puces (●) qui disent quel acteur fait quelle étape sont des éléments graphiques non extraits : la matrice est inexploitable. D4 note INC-23 : la validation admin du 8 m² scro à Wissous n'a plus d'acteur depuis cette matrice.

---

## B. Avant la prépa : DA, IP, copie, attendues (phase 1, D2)

### EX-EXI-010 — DA activée (étape 1)
- Énoncé : activer la DA fait apparaître une ligne dans Suivi > Etat des réservations (EDR) : centre, dossier, DA, annonceur, surface, format, quantité, semaine, année, assistants commercial/logistique, Print, campagne contrôlée, reste en place. L'écran lit Broadcast en direct à chaque recherche (`P_CirceEtatReservation_New`, base EXTPLAY) ; lignes filtrées par les ateliers de l'utilisateur (sites 39, 40, 43, 44). Circé n'a pas d'événement « DA activée ». Statut dossier chez Broadcast : « À traiter ».
- Type : traitement auto
- Source : D2 §3 ligne 1 ; D1 §6 ; D4 étape 2
- Ambiguïté : les DA annulées sont-elles renvoyées, avec quel statut ? (À CONFIRMER Broadcast). Fréquence de recalcul de l'EDR : « 2 màj/jour » (atelier 14) vs copie toutes les 2 h de 8 h à 18 h (indiqué le 21/10, D1) : voir contradictions.

### EX-EXI-011 — Grain de la ligne EDR
- Énoncé : DA chapeau × dossier de vente × site × destinataire effectif × surface × format × thème (vide avant IP, nullable) × bandeau × semaine, avec la quantité ; pas de n° de face ni d'unité. La colonne « Aff. reçues » est la seule calculée par Circé (croisement `tf_prepa_affiche` et affiches).
- Type : règle
- Source : D2 §2 point 1, §3 ligne 1 ; D1 §6
- Ambiguïté : grain exact DÉDUIT ; corps de la procédure absent du dépôt

### EX-EXI-012 — Copie de l'EDR dans Circé (1b)
- Énoncé : batch `BatchAlimPexCirceInsBC` lit l'EDR de la semaine courante à +8 (`weeks`=8), calcule `sup_id` par surface × format (`Transaco_Surface_Format`, 0 si aucune correspondance) et, pour chaque dossier présent dans le retour, efface puis recrée ses lignes `tf_prepa_Broadcast`. Un dossier plus renvoyé n'est pas touché. Perdus à la copie : site, surface, format (hors support), n° de prépa chapeau, reste en place, Print, campagne contrôlée, photo, description du thème. L'ancienne voie Web API est du code mort.
- Type : traitement auto
- Source : D2 §3 ligne 1b
- Ambiguïté : fréquence et ordre avec 1c hors dépôt (À CONFIRMER DSI) ; D1/D3 : toutes les 2 h de 8 h à 18 h (21/10), D3 liste 8 h, 10 h, 12 h, 14 h, 16 h, 18 h

### EX-EXI-013 — Fabrication des « réceptions attendues » avant la prépa (1c)
- Énoncé : procédure `p_Alimentation_tf_prepa_affiche` (job SQL présumé) lit `tf_prepa_Broadcast` (statut de prépa différent de « Envoyé »), semaine courante à +8 ; la plateforme est retrouvée par le nom du destinataire ; insère dans `tf_prepa_affiche` avec `FromBroadcast = 1` si aucune ligne n'existe pour dossier × support × semaine × plateforme. Clé : plateforme × support × dossier × annonceur × thème × bandeau × semaine × DA chapeau, la quantité faisant partie du regroupement (deux lignes de même clé et quantités différentes ne s'additionnent pas). Affichées dans Réception > Réception des affiches. Absentes de Suivi de production. Défauts relevés : support 0 -> ligne écartée ; plateforme introuvable -> ligne recréée à chaque passage ; deux plateformes -> sous-requête en échec ; branche fin d'année invalide (colonne `ate_id` écrite deux fois). Semaines à l'américaine (`DATEPART(wk)`) vs culture courante côté C#.
- Type : traitement auto
- Source : D2 §3 ligne 1c
- Ambiguïté : job, fréquence, version installée = À CONFIRMER DSI ; effets DÉDUITS

### EX-EXI-014 — IP saisies (étape 2) : pas de découpage par thème
- Énoncé : la saisie des IP se fait dans Broadcast (aucune page IP dans Circé). Le thème et la quantité changent dans le retour de l'EDR. Circé ne découpe pas la ligne attendue : le contrôle d'existence ignore le thème, le 2e thème n'est jamais créé ; la mise à jour écrase thème, annonceur et quantité (jointure sans thème) ; avec 2 thèmes, SQL Server en retient un au hasard ; la mise à jour peut changer le thème d'une ligne déjà rattachée à une affiche. Déroulant : le détail des IP (visuels, exceptions, commentaire) arrive avec les instructions.
- Type : règle
- Source : D2 §2 point 3, §3 ligne 2
- Ambiguïté : « au hasard » et « peut changer le thème d'une ligne rattachée » sont DÉDUITS

### EX-EXI-015 — Adresses des destinataires (3a)
- Énoncé : premier des trois flux de `BatchAlimPexCirce` : adresses des afficheurs depuis Broadcast puis `p_integ_destinataire` ; nécessaires pour retrouver le `dest_id` des lignes de prépa. Un destinataire = plateforme, site, société sous-traitante, afficheur ou dépôt (types 1 à 5). Page : Administration > Liste des adresses (DÉDUIT).
- Type : traitement auto
- Source : D2 §3 ligne 3a
- Ambiguïté : page lue non vérifiée

### EX-EXI-016 — Envoi de la prépa (étape 3 / 4 selon doc)
- Énoncé : bouton « Envoyer préparation » dans Broadcast. Effets : EDR « Statut préparation = Envoyé » + n° de prépa renseigné ; statut dossier chez Broadcast « À traiter » -> « En cours » ; le suivi de production commence ; l'envoi est la « porte d'entrée de la production » dans Circé (fixe et déroulant). Programme `BatchAlimPexCirce` : destinataires, préparation, faces et instructions ; Circé prévient ensuite Broadcast (`P_MajStatutGroupePreparation`) ; une prépa déjà intégrée est refusée tant qu'elle n'est pas débloquée.
- Type : transition
- Source : D1 §1, §6 ; D2 §3 ligne 3 ; D4 étape 4 ; D5 étape 2
- Ambiguïté : date limite (« le lundi » D1/D3 vs « au plus tard jeudi S-2 » D4/D5 vs deadline Pré-Prod « jeudi S-2 16 h » D6) ; le moment réel d'intégration est celui du passage suivant du programme, pas du clic (fréquence À CONFIRMER DSI)

### EX-EXI-017 — Intégration fixe et pliage
- Énoncé : `P_ExportPrepaCirce` (base INTERFACE) -> `trav_preparation` -> `p_integ_preparation` -> `tf_repart_calcul`. Une ligne = détail de prépa (destinataire × thème × surface × afficheur × semaine), quantité avec entretien ; une ligne de bandeau en plus pour le pliage. Chaque ligne naît au statut 0 « À traiter » dans l'atelier fixe de Wissous (1) ou Nîmes (4) ; pliage ateliers 2, 3, 9. Les types 17 à 21 (déroulant) sont exclus.
- Type : traitement auto
- Source : D2 §3 ligne 3 ; D3 §« Branche fixe »
- Ambiguïté : procédure de liste du pliage non relue (DÉDUIT)

### EX-EXI-018 — Intégration déroulant (faces, instructions)
- Énoncé : une ligne `tf_face_train` = une face ; en-tête `instruction_train` au grain dossier × semaine × atelier, créé au statut 0 « À traiter » quand les faces sont dans la table d'export de Broadcast, passé à 1 « En cours » à l'arrivée des instructions (le commentaire de prépa va dans `instr_CommentExtPlay`). L'atelier n'est posé que pour les surfaces 5 (2 m²) et 7 (8 m²) de Wissous et Nîmes ; ailleurs atelier 0. Les instructions déjà au statut 2, 4 ou 5 sont ignorées (renvois de Broadcast).
- Type : traitement auto
- Source : D2 §2 point 4, §3 ligne 3 ; D3 §« Branche déroulant »
- Ambiguïté : moment d'écriture des faces dans la table d'export (avant ou à la prépa) = À CONFIRMER Broadcast ; si avant, « À traiter » de l'instruction se voit ; sinon directement « En cours »

### EX-EXI-019 — Bascule de la ligne attendue (3b, « raccrochage » automatique)
- Énoncé : au passage de 1c qui suit la prépa, les lignes `FromBroadcast = 1` dont dossier, support, annonceur, semaine et thème écrit retrouvent une ligne de prépa (fixe : `tf_repart_calcul`) ou une face avec thème passent à `FromBroadcast = NULL` et gardent leur lien avec l'affiche ; sinon une ligne de prépa est ajoutée à côté, sans affiche (source de doublons et d'orphelines). Au fixe : détail -> attendue regroupée (le destinataire disparaît) ; au déroulant : faces comptées par thème (la face disparaît) ; la face n'a de thème qu'après l'Instruction OK donc l'attendue de prépa du déroulant n'existe qu'après l'Instruction OK. Quantité non recalculée à la bascule, écart non signalé.
- Type : traitement auto
- Source : D2 §3 ligne 3b, §4 ; D3 scénarios 1-3
- Ambiguïté : aucune sur le constat (CONSTATÉ) ; effets DÉDUITS

### EX-EXI-020 — Déblocage / renvoi d'une prépa (3c)
- Énoncé : Administration > Déblocage préparations, Préparations débloquées, Rafraichir un dossier. Le déblocage agit côté Broadcast (`P_CirceDebloquerGroupePreparation`) et Circé (`p_u_statut_repart_deblocage`), grain = groupe de préparation. « Rafraichir un dossier » relance l'export faces/instructions du dossier côté Broadcast. Sans déblocage une prépa renvoyée est refusée.
- Type : fonctionnalité
- Source : D2 §3 ligne 3c ; D1 §9 ; D5 (« rendre la main »)
- Ambiguïté : rôle exact qui s'en sert (À CONFIRMER Coordination) ; corps de `p_u_statut_repart_deblocage` non lu

---

## C. Branche déroulant (scro)

### EX-EXI-030 — Statuts d'instruction et de préparation (énumération code)
- Énoncé : `Enums.cs:223-247` : 0 À traiter, 1 En cours, 2 Instruction ok, 3 Erreur, 4 Annulé, 5 A imprimer, 6 Préparé, 7 A expédier, 8 Terminé, 9 Export prepa, 10 Au roulage. Parcours du déroulant : instruction 0 -> 1 -> 2 -> 5 ; 4 Annulé à la main depuis 0, 1 ou 2, retour possible à 0 (« pas à produire », S48, S54), plus après l'export. Train/faces : 5 A imprimer -> 10 Au roulage -> 7 A expédier -> 8 Terminé. Retour 5 -> 2 possible (`TrainSuiviThemeBll.cs:489`, RELEVÉ 26/10) ; 2 -> 0 ou 1 efface le calcul des trains sauf faces au statut 5.
- Type : transition
- Source : D1 §7 ; D3 « STATUTS D'UNE INSTRUCTION… » ; D4 table statuts
- Ambiguïté : libellé du statut 5 : « A préparer » dans un commentaire SQL (`p_u_statut_preparation.sql:21`) vs « A imprimer » ailleurs ; statuts 3 Erreur et 9 Export prepa non décrits

### EX-EXI-031 — Instruction OK : rôle
- Énoncé : contrôle du dossier (scro seulement) : quantité Broadcast = champ « nb d'exceptions » de Circé ; re-saisie du % de répartition par thème ; mise à jour de l'entretien ; vérification de la position de l'affiche dans le train. Passer à 2 lance `p_u_associe_train` : calcule les trains, pose le thème sur les faces, crée n° de train, position, entretien (8 % par défaut), bandeaux, puis gèle positions et entretien ; les renvois de Broadcast sont ensuite ignorés. Ce n'est pas une validation du contenu de Broadcast (Broadcast n'envoie ni position ni taux d'entretien).
- Type : règle
- Source : D4 étape 5 ; D5 étape 4 ; D3 §« Branche déroulant » ; atelier_20261015 slide 3
- Ambiguïté : atelier 15 dit que la re-saisie du % est « bloquante mais non nécessaire » ; D3 dit que Circé refuse si la répartition n'est pas à 100 %

### EX-EXI-032 — Instruction OK : à la main vs automatique
- Énoncé : écran Trains > Liste des instructions, filtre « En cours » : 5 actions (exceptions = Σ quantités des lignes de format hors entretien ; répartition à 100 % sinon refus ; statut Instruction ok ; Enregistrer ; quantité avec entretien). Automatique (règle de Nariman, « en cours de mise en place ») si PAS de commentaire de prépa ET exceptions = quantité ; sinon Coordination (`TrainListeInstructionBll.cs:333-340`). Le « nb d'exceptions » peut différer de BC (prépa partielle, blocages/déblocages) : Circé garde la mémoire de l'info reçue à l'instant T (ex. 40 faces bloquées vs 20 chez BC). En cas d'écart la Coordination purge et rend la main à la Pré-Prod (Admin > Déblocage préparation), uniquement si la prod n'est pas lancée.
- Type : règle
- Source : D1 §3, §9 ; D3 §« Branche déroulant » ; atelier_20261015 slide 3
- Ambiguïté : état de mise en production du code de Nariman inconnu ; sens du losange du schéma de départ (D3 §« schéma de départ »)

### EX-EXI-033 — Export des trains (jeudi 14 h)
- Énoncé : Trains > Liste des trains, bouton « Exporter les trains » : vérifier que tous les dossiers sont en Instruction OK ; l'export ne prend QUE les faces au statut 2 et les passe à 5 « A imprimer » ; les autres restent en attente ; on commence par le MUI (jeudi après-midi). Table `tf_train_export`. Prépa renvoyée après l'export : alerte, rien ne change dans les trains exportés. Un train porte jusqu'à 6 thèmes (code) ; 20 tiroirs par export (`TrainPreparationBll.cs:22-23`).
- Type : transition
- Source : D1 §5 ; D3 ; D6 grains
- Ambiguïté : « jusqu'à 4 affiches » (deck) vs 6 thèmes (code)

### EX-EXI-034 — Suivi par thème, Préparation des trains, Go aux plateformes
- Énoncé : après composition des trains : Suivi par thème (même intitulé par thème pour un annonceur, supprimer les thèmes inutiles, ex. « ne pas afficher » ; « Paris Privatisé » : 2e thème non envoyé aux plateformes) ; Préparation (positions, campagnes contrôlées Renault/Peugeot, affiches à intercaler, séparations entre annonceurs, plan de roulement MUI et 8 m²). Mail de confirmation aux plateformes (jeudi S-2, « point de non-retour ») car elles n'ont pas d'autre moyen de savoir que le check est terminé.
- Type : fonctionnalité
- Source : atelier_20261015 slide 4 ; D5 étapes 7-8
- Ambiguïté : « prévoir coche validé Pré-Prod dans la cible » (cible non confirmée)

### EX-EXI-035 — Production 2 m² scro : ordonnancement et lancement
- Énoncé : mail Pré-Prod reçu -> imprimer le besoin en affiches par thème, pointer reçu/pas reçu ; Trains > Suivi par thème (choisir atelier, cocher les affiches reçues, décocher celles à fractionner) ; Trains > Préparation puis Export préparation : filtre statut « A imprimer » (défaut), destinataire prioritaire (ex. Bordeaux), format 2 m² scro (vs Venusial), « pré-assemblé = Fait » ; bouton Export Préparation (alerte si > 20 tiroirs) ; encadré Résultat (lignes / affiches / tiroirs) ; supprimer des lignes pour arriver à 20 ; Export Excel ; supprimer colonnes B, D, E ; renommer semaine + n° de fichier de prod ; imprimer et noter le total d'affiches ; transmettre au dispatcheur. Vendôme : Générer fichier V2, renommer, copier dans Vendôme/CSV, outil GenfichierProd (Caire) -> .ini, dans Vendôme/INI, copier dans Vendome One/Référence (cairenimes), « Roulage » + ressource. Autres machines : imprimer les bagues. Scan codes barre, pré-assemblage (= affiches reçues).
- Type : fonctionnalité
- Source : atelier_20261015 slide 5 ; D5 étape 8
- Ambiguïté : étapes numérotées 1 à 10 du diagramme non extraites (images)

### EX-EXI-036 — Spécificités Nîmes 2 m² scro et livraisons tardives
- Énoncé : Nîmes : mardi, partir de l'EDR pour sortir palettes/affiches pour le zippage du mardi au jeudi après-midi ; vendredi, besoin en affiches distinguant scro et Venusial, pointer ce qui est zippé/roulé, voir le RAF. Livraisons tardives : bouton « raccrochage » = ajouter un thème à un train non encore produit ; bouton « fractionner » = retirer le thème en retard du train d'origine et créer une ligne à part. Zippage + pastille, sortir fiche d'activité.
- Type : fonctionnalité
- Source : atelier_20261015 slide 5
- Ambiguïté : aucune

### EX-EXI-037 — Production 8 m² scro
- Énoncé : même enchaînement Trains > Suivi par thème / Préparation / Export préparation avec choix du nom du rouleur + impression bague, copie de l'export dans l'Excel, pré-assemblage (par client en totalité, pas partiel), mise au roulage, contrôle affiche par personne, copie de l'EDR dans Excel (check reçu/pas reçu), avance sur gros volumes Wissous / volumes Nîmes en anticipant les 8 % même non validés, création de demies haut / demies bas, production de l'affiche complète, refresh du vendredi matin (suite envoi de la veille), contrôle quantités et priorisation par destinataire, assemblage et expédition des trains, fin de journée Geodis = Terminé. Spécificité : on peut anticiper l'assemblage des quarts d'affiche et affiches complètes avant de connaître la composition des trains.
- Type : fonctionnalité
- Source : atelier_20261015 slide 7
- Ambiguïté : le doc mentionne « Pré-Prod : » en bas de slide sans contenu extrait

---

## D. Branche fixe et pliage

### EX-EXI-040 — « 2m² fixe > A traiter » : arrivée de la ligne
- Énoncé : la ligne fixe naît à l'intégration de la prépa au statut 0 « À traiter » et arrive directement dans l'écran (`rpc_statut = 0`, ateliers 1 et 4, semaine choisie, `p_s_listeprepa2m2.sql:71-74`), sans condition de validation admin, de réception ni de Colisage. Boutons : Fiche Préparation Synthèse, Colisage. Le Colisage la fait sortir de l'écran.
- Type : transition
- Source : D2 ligne 3 ; D3 §« Branche fixe » ; D1 §4
- Ambiguïté : les decks (atelier 14, D4 étape 8, INC-05) donnent d'autres déclencheurs d'arrivée dans l'atelier : raccrochage (S24), validation admin (S28), bouton Colisage (S37)

### EX-EXI-041 — Bouton « Colisage » (fixe) : crée les UM
- Énoncé : crée les UM (`BuildUm` : tri par destinataire, dossier, format, type de prépa, thème, repiquage, afficheur ; UM découpée selon une quantité maximale par support, un seul thème par UM), pose `UM_id`, passe la ligne à 1 « En cours ». Il agit sur les lignes filtrées de la grille, pas sur une semaine. Données figées : la Pré-Prod ne peut plus y toucher, la main est aux plateformes ; ce qui est colisé est identifiable par le statut « En cours ». Ne pas confondre avec le colisage d'expédition (scan des rouleaux/trains dans un colis, tous formats).
- Type : transition
- Source : D1 §4 ; D3 ; D5 étape 6, 9 ; atelier_20261013 slides 6, 18 ; D6 (« Contrôle de la préparation »)
- Ambiguïté : qui clique (Pré-Prod/Coordination ?) et si un dossier sans validation admin peut être colisé (le code ne bloque pas) = À CONFIRMER

### EX-EXI-042 — Statuts de la ligne de prépa du fixe
- Énoncé : 0 À traiter (prépa intégrée) -> 1 En cours (Colisage) -> 6 Préparé -> 7 A expédier (scan final après scan destinataire + rouleaux) -> 8 Terminé (saisie de fin de journée chez Geodis) ; retour à 0 si l'UM est supprimée. Pliage : même processus (REU-07) sans machine.
- Type : transition
- Source : D1 §7 ; D4 ; atelier_20261013 slide 10
- Ambiguïté : atelier 13 slide 10 écrit « En cours = Pas encore fait » alors que D1 définit En cours = colisé ; « Préparé = en cours de préparation »

### EX-EXI-043 — Production 2 m² fixe (processus atelier 13)
- Énoncé : Jeudi S-2 : menu 2m² Fixe, filtre « A traiter » + semaine S, bouton Fiche Préparation Synthèse, télécharger l'Excel et l'imprimer, donner la V1 à l'atelier, clic Colisage (redescente des dossiers dans l'écran atelier) ; avec EDR « coloré » (Nîmes) trier vrac vs scro ; avec suivi de prod (Wissous) trier vrac vs scro par thème. Préparation 2m² Fixe : filtrer semaine/annonceur/dossier/thème, Export Préparation, télécharger l'Excel, renommer semaine/client/thème.csv, coller dans le répertoire connecté à la machine ; recommencer par thème. Version simplifiée en un clic : exporter tous les dossiers sans filtre, Lancer, sélectionner le fichier : tous les fichiers par annonceur + un bilan des fichiers fusionnables (annonceurs multi-dossiers/mono-thème), l'atelier confirme. Volumes : 220 à 350 thèmes/semaine à Nîmes, 150 à Wissous. Multi-rouleuse -> rouleaux ; ordonnancement (priorisation par destination).
- Type : fonctionnalité
- Source : atelier_20261013 slide 6
- Ambiguïté : la « version simplifiée un clic » est présentée dans l'existant alors que le besoin synthèse C7 la demande dans Circé (dev de Rayane hors Circé ?) ; numérotation 1-8 des étapes non extraite

### EX-EXI-044 — Expédition 2 m² fixe
- Énoncé : scanner destinataire puis chaque rouleau (contrôle du nb d'affiches par carton), les mettre dans le carton (messagerie) ou le rack du milk ; compléter les champs ; finir en scannant le code barre Etiquettes pour le milk, sinon lancer l'édition d'étiquette du carton ; scan final = statut « A expédier ». Stockage par destinataire, milk vs messagerie.
- Type : fonctionnalité
- Source : atelier_20261013 slides 6, 13
- Ambiguïté : aucune

### EX-EXI-045 — « Rendre la main » : fixe vs déroulant
- Énoncé : fixe : on peut changer les informations même après envoi de la prépa : Préparation 2m² Fixe, sélectionner semaine, dossier, atelier, « Retirer » + confirmer ; puis Administration > Déblocage préparations ; sélectionner dossier, semaine, plateforme et « rendre la main ». Déroulant : seulement si la production n'est pas lancée.
- Type : règle
- Source : atelier_20261013 slide 14 ; D5 §« corriger après envoi » ; atelier_20261015 slide 3
- Ambiguïté : voir contradiction avec atelier_20261014 slide 30 #4

---

## E. Réception, affiches, validation admin

### EX-EXI-050 — Réception physique (agent de réception)
- Énoncé : réception des colis/palettes sur la zone tampon, contrôle du nb de colis/palettes, signature du bon de transport. Menu Réception des affiches : si le BL porte un n° de contrat ou DA -> recherche, sélection dans le panier (multi-visuels, multi-contrats), « ouvrir réception », saisie des quantités du BL, n° BL, transporteur, imprimeur, nb de colis -> génération d'un n° de réception avec n° d'affiches ; recopie du n° d'affiche Circé sur le BL ; scan du BL joint à la réception ; documents dans une pochette sur la palette. Sinon (pas de n°) : « réception orpheline » (annonceur, format, thème si connu, quantité). Deux filtres : « réceptions attendues » (infos de Broadcast : n° contrat, semaine, DA, annonceur, thème) et « réception » (ce que l'opérateur a saisi dans le formulaire « Ouvrir réception »). Les tables : `livraison`, `asso_livraison_affiche`, `affiche`, `mouvement`.
- Type : fonctionnalité
- Source : atelier_20261014 slide 8 ; D4 étape A ; D3 §réception
- Ambiguïté : copies d'écran (slides 10-11) non extraites ; BL saisi à la main, pas de scan automatique

### EX-EXI-051 — Contrôle des affiches
- Énoncé : agent de contrôle : palette amenée en zone contrôle ; bouton « Modifier une affiche » ; Liste des Affiches ; recherche du n° d'affiche sur le BL ; comptage manuel par morceau si qté < xx ; saisie de la quantité reçue ou de la variation ; onglet Détail : emplacement (allée/rayon) + Enregistrer ; onglet Mouvements : non-conformité (lien vers appli process métier) ; imprimer la feuille de stock en 2 exemplaires (palette + Pré-Prod) ; protéger/cercler les visuels, scotcher la feuille ; stocker. Une palette peut avoir plusieurs visuels et plusieurs morceaux d'un 8 m².
- Type : fonctionnalité
- Source : atelier_20261014 slide 9 ; D4 étape B
- Ambiguïté : seuil « xx » du comptage manuel non renseigné

### EX-EXI-052 — Identification d'une orpheline et raccrochage
- Énoncé : extraire l'EDR (n° semaine, nb de semaines, n° dossier) ; Liste des Affiches ; identifier la ligne avec le thème ; « Action » : association n° DV - thème - n° affiche. Si DA/DV absente du BL : rechercher l'annonceur dans Broadcast. Raccrochage : fiche de l'affiche > onglet Préparations > bouton « + » > choisir dossiers/thèmes (une affiche peut servir plusieurs dossiers, ex. 33). Contrôle qtés reçue vs attendue ; si très supérieure, campagne multi-semaines ? -> feuille de stock ré-imprimée sur feuille jaune (S41/S42/S43) mise sur la palette par les chefs d'équipe. Si scro : Instruction OK. Prépa validée dans BC ? -> validation admin ; fiche mise dans le dossier de la semaine de départ pour ne pas l'oublier. « Scro / fixe / les 2 ? » : menus Fixe et Pliage mis à jour du dossier pour Scro / Scro+Fixe ; fixe : pas de mise à jour à ce stade.
- Type : fonctionnalité
- Source : atelier_20261014 slides 13-18 ; D4 étape C et 6
- Ambiguïté : « on peut faire le raccrochage avant Instruction OK (à confirmer Fabrice) » ; ordre raccrochage / Instruction OK / validation admin variable selon les slides (INC-04)

### EX-EXI-053 — Validation admin : définition, conditions, effets
- Énoncé : case à cocher dans la fiche de l'affiche (`affiche.validationAdmin`, historique `histo_historique_entite`) confirmant « cette affiche reçue est bien celle de ces dossiers / lignes ». Pas de test sur l'Instruction OK dans le code, mais elle passe par la liaison des lignes de prépa du dossier (`ReceptionListeAfficheController.cs:218-254`) : au fixe possible dès que la prépa est envoyée ; au scro seulement après l'Instruction OK (la ligne de prépa à lier naît à ce moment) (retour terrain du 02/11). Possible à n'importe quel statut de la ligne et ne le change pas. Effets : n° d'affiche dans Suivi de production (si validée ET ligne non « Broadcast »), édition du picking, case « zone picking », sortie de la liste des affiches « à traiter », étiquette rack imprimée à la validation (RELEVÉ 26/10), « Affiche reçue = Oui » dans l'EDR, envoi « EstAssociee » (rattachée ET validée) à Broadcast (`BatchAlimReceptionBll.cs:89`), alimentation de Trains > Préparation (déroulant). « 1 prépa = nb d'affiches par personne par thème = 1 bague » (atelier).
- Type : règle
- Source : D1 §3, §6 ; D3 §6 ; D4 étape 7 ; D5 ; atelier_20261014 slides 13, 17
- Ambiguïté : qui valide (Coordination vs Pré-Prod Nîmes + référents Wissous) ; effets sur picking, étiquette rack, EDR, EstAssociee = RELEVÉ 26/10 non relus ; le fait qu'elle soit « obligatoire » (atelier 14 slide 32) n'est pas démontré par le code

### EX-EXI-054 — Ce que la validation admin ne conditionne pas (code lu)
- Énoncé : création des UM fixe/pliage (la liste des UM n'est pas filtrée, elle affiche seulement n° d'affiche et oui/non) ; export des trains ; arrivée de la ligne dans « 2m² fixe > À traiter » ; Instruction OK (indirectement seulement au scro). L'absence de lien et de validation admin « ne semble pas bloquer » la création des affiches mais fausse le suivi (ANO-14).
- Type : règle
- Source : D3 §6 ; D2 §6 ; atelier_20261014 slide 18
- Ambiguïté : l'écran réel peut avoir un comportement que le code ne montre pas

### EX-EXI-055 — « Affiche reçue » de l'EDR (ANO-05)
- Énoncé : la colonne « Aff. reçues » de Suivi > Etat des réservations n'affiche « oui » qu'après la validation admin (reçue ET validée), dès qu'UNE affiche validée correspond au dossier, à la semaine, à l'année et au thème exact de la ligne, sans test de plateforme ni de face (`SuiviEtatReservationBll.cs:183-187`). La réception physique seule laisse « non ».
- Type : règle
- Source : D1 §6 ; D2 §3 ligne 1 ; D4 « Points de vigilance »
- Ambiguïté : aucune

### EX-EXI-056 — Lien affiche ↔ ligne attendue (modèle de données)
- Énoncé : `tf_prepa_affiche` (ligne attendue : `FromBroadcast`, `ARecevoir`, `affiche_livraison_Id`, `Qte_Theorique`) est reliée à l'affiche (`affiche.affiche_id`) par `affiche_livraison_Id` : UNE seule affiche par ligne. Le lien se pose (1) à la réception : l'agent coche la ligne, Circé crée l'affiche et la lie à la ligne et à ses jumelles (même dossier, format, annonceur, thème écrit, plateforme, semaine) (`LivraisonAfficheService.cs:455-476`) ; (2) à la main : fiche > Préparations > « + » (seules les lignes issues de la prépa, avec un thème, pas déjà liées ; dissocier possible). Le lien n'est jamais posé sur `tf_prepa_Broadcast`. Dossier et thème de l'affiche sont des copies saisies à la réception ; rien ne compare ensuite à Broadcast (`LivraisonAfficheService.cs:451`, PP-09/ANO-07). Trois scénarios : affiche avant la prépa, prépa déjà arrivée, texte qui ne correspond plus (ligne ajoutée à côté, travail manuel de la Coordination).
- Type : règle
- Source : D3 §4-5 ; D6 grains ; D5 « pourquoi on s'y perd »
- Ambiguïté : aucune sur le constat

### EX-EXI-057 — Ce que la réception peut cocher selon le moment
- Énoncé : il suffit que la DA soit activée et copiée (fenêtre semaine courante à +8) ; avant IP : ligne sans thème, l'agent saisit le thème (peut différer de celui des IP) ; après IP : même ligne avec le thème, une seule ligne même avec plusieurs thèmes (risque de mauvais thème) ; prépa fixe : lignes de prépa dès le passage suivant des traitements ; prépa scro sans Instruction OK : seulement la ligne Broadcast ; aucune ligne (DA non activée/copiée, support ou plateforme non reconnus) : l'agent ajoute le dossier à la main (grille « Affiche Broadcast ») -> orpheline.
- Type : règle
- Source : D3 §5
- Ambiguïté : liste des attendues affichée par l'écran = DÉDUIT

### EX-EXI-058 — Cas de réception particuliers (Nîmes)
- Énoncé : (1) rattachement au mauvais thème : dossier 502605 à deux thèmes (Rêver, Savourer) ; première réception du visuel Rêver faite sur Savourer ; au traitement de Savourer le dossier n'est plus disponible en recherche -> orpheline pour créer le n° d'affiche, puis la Pré-Prod doit corriger les 2 thèmes (sinon risque de préparer le mauvais visuel). (2) Cuisinella : repointer chaque quantité par ville dans Broadcast à partir du BL et refaire une synthèse sur la fiche de stock (affiches multi-semaines). (3) 33 dossiers pour un même visuel : la réception ne crée la réception que sur un seul dossier ; la Pré-Prod dispatche dans l'onglet Préparation (« + », recherche par thème) les 32 autres ; impossible depuis l'onglet Détail (nb de dossiers limité dans le champ).
- Type : règle
- Source : atelier_20261014 slides 12, 19, 20
- Ambiguïté : aucune

### EX-EXI-059 — Gestion des affiches manquantes (existant)
- Énoncé : Nîmes : mardi et vendredi S-2, édition de l'EDR puis pointage/annotations par dossier (jaune = reçu ; rose = Print CM + recherche dans le portail print de la date de réception prévisionnelle ; rouge barré = REP ou annulé ; bandeaux reçus O/N ; commentaires ; intégration manuelle des DM) ; sert aux chefs d'équipe pour arbitrer fractionnement O/N ; fichier des manquants au vendredi S-2, mises à jour/alertes manquants lundi S-1, J-3 (jeudi S-1) et lundi S. Wissous : fait par l'équipe d'Isa qui relance les gestionnaires. Constat : la vision Circé des manquants est erronée (ex. reçu 34 vs attendu 56 alors que la DA BC est 34) parce que Circé génère trop d'affiches en attente en splittant par type de préparation.
- Type : règle
- Source : atelier_20261014 slides 21-22
- Ambiguïté : le split par type de préparation vs D2 (attendue regroupée par thème/support) : cause exacte non démontrée par les docs

### EX-EXI-060 — Suivi de production (page)
- Énoncé : Suivi > Suivi de production lit `tf_repart_calcul`, `tf_UM` (statut dès que l'UM existe), `tf_face_train` (faces de la semaine à TOUS les statuts, thème seulement après Instruction OK), `affiche` et `tf_prepa_affiche`. Grain : atelier × dossier × annonceur × statut × support × thème × bandeau. Le n° d'affiche n'y figure que si l'affiche est validée ET liée à une ligne issue de la prépa. Les attendues « Broadcast » n'y figurent pas.
- Type : affichage
- Source : D2 ligne 1c, §4 ; D3 ; `p_s_adminSuiviRead.sql`
- Ambiguïté : aucune

---

## F. Statuts, tags, grains (synthèse)

### EX-EXI-070 — Statuts objet par objet (existant)
- Énoncé : Dossier chez Broadcast : À traiter -> En cours (prépa envoyée), changé par la Pré-Prod. Statut Préparation de l'EDR : vide -> Envoyé (n° de prépa renseigné), par Broadcast. Instruction (déroulant) : 0 À traiter -> 1 En cours -> 2 Instruction ok -> 5 A imprimer ; 4 Annulé ; n'existe pas au fixe. Ligne fixe : 0 -> 1 -> 6 -> 7 -> 8 (retour 0). Train : 5 -> 10 Au roulage -> 7 A expédier -> 8 Terminé (atelier, fin de journée). Affiche : réceptionnée ou orpheline ; validation admin = case, pas statut. « Aff. reçues » : non -> oui à la validation admin (calcul Circé).
- Type : transition
- Source : D1 §7 ; D4 ; D5
- Ambiguïté : aucune (voir EX-EXI-071)

### EX-EXI-071 — Trois sens de « À traiter » (et de « En cours »)
- Énoncé : « À traiter » = (a) dossier chez Broadcast, prépa non envoyée ; (b) instruction du déroulant (même sens, ou faces seules arrivées) ; (c) ligne du fixe : prépa reçue, pas encore colisée (décalé d'un cran). « En cours » = prépa arrivée (Broadcast, déroulant) mais = colisée au fixe de Circé (INC-01).
- Type : règle
- Source : D1 §1, §7 ; D2 ligne 3
- Ambiguïté : aucune (source de confusion identifiée par les docs)

### EX-EXI-072 — Statut du dossier limité
- Énoncé : le statut de l'instruction/dossier s'arrête à « Instruction OK » (`Enums.cs:50-75`) et ne bouge plus avec la réception, la production ni l'expédition. « Terminé » est posé par la fin de journée Geodis (`ListeColisBll.cs:199-223`), pas par la preuve de livraison ; le batch Geodis n'écrit pas son résultat (`BacthCallZoomBll.cs:61`).
- Type : règle
- Source : D6 §« Circé ne calcule pas l'état »
- Ambiguïté : aucune

### EX-EXI-073 — Grains (dossier -> thème -> ligne de préparation -> unité -> colis -> départ)
- Énoncé : dossier (n° contrat, DA chapeau) -> thème (visuel × repiquage, arrive avec les IP) -> ligne de préparation (thème × destinataire × afficheur, `tf_repart_calcul`) -> unité de production (train = afficheur × destinataire × semaine, N-à-N avec les dossiers ; UM = destinataire × contrat × format × type × thème × repiquage ; lot pour pliage/bus) -> colis (destinataire × affiche (emplacement) × semaine, « validé 21/10 ») -> départ (destinataire, boucle, jour, heure). Côté réception : BL = une réception -> n° d'affiche (stock = somme des mouvements) <-> lien affiche↔thème N-à-N. Ruptures de grain avant la production : la DA se regroupe en plateforme, l'IP ne découpe pas (devrait), la prépa découpe, retour regroupé vers l'attendue.
- Type : règle
- Source : D6 ; D2 §4
- Ambiguïté : la maquette regroupe encore les colis par destinataire × semaine (à aligner) ; Bus : grain à voir

### EX-EXI-074 — Tags d'aujourd'hui vs tags cibles (non validés)
- Énoncé : aujourd'hui seuls existent les statuts ci-dessus ; manquent : affiches reçues en partie, palette à contrôler, thème modifié dans BC (rien ne compare), correction demandée à Broadcast, preuve de livraison. Cible (maquette, NON validée) : tags par étape posés par Circé à chaque événement (ex. DA activée IP à saisir -> IP saisies prépa attendue -> Prépa reçue validation admin à faire -> Validation admin faite ; train/UM : En attente d'affiches -> Prêt à produire -> En production -> Produit ; colis : Colisé -> Expédié -> Livré ; fin de campagne : À décider -> À conserver / À renvoyer / À détruire -> Renvoyé / Détruit) et repères (Contrôlée 15 %, Print Cityz, Reste en place / Ne pas afficher, Multi-semaines, Thème proche, Modifié dans BC, Écart BC/Circé, Correction demandée à Broadcast, Deadline Pré-Prod dépassée = jeudi S-2 16 h, Départ menacé, Contrôle en retard = palette > 24 h paramétrable ; tags affiche : À contrôler, Réception inconnue + Mail envoyé Pré-Prod, Complément, Feuille à refaire). Couleurs : attente gris, info bleu, à faire orange, à traiter vite rouge-orange, bloquant rouge, fait vert, repère violet.
- Type : affichage
- Source : D6 (tables « Le tag de chaque étape », « Les repères », « Les tags de l'affiche »)
- Ambiguïté : document daté 21/10, cible « pas encore validée » ; libellés à valider en atelier ; Q21 (CP/dynamisations), Q39 (vérification des thèmes) ouvertes ; la validation admin cible décrite (« faite par Circé au dernier des deux jalons ») est remplacée par l'option A du 02/11

### EX-EXI-075 — Entretien et campagnes contrôlées (existant)
- Énoncé : entretien par défaut 8 % ; à la préparation la valeur peut changer ; le client (notamment les Villes) envoie ce qu'il veut. Campagne contrôlée : 15 % d'entretien et visuel en tête de train. Fixe/pliage : quantité d'entretien fournie par Broadcast (`p_integ_preparation.sql:121,160`), grain ligne destinataire × afficheur. Déroulant : faces d'entretien ajoutées avec un afficheur fictif « ENTRETIEN » (`p_u_associe_train.sql:462-500`). Circé n'a pas de visibilité de l'entretien pour le fixe et le scro.
- Type : règle
- Source : atelier_20261014 slide 24 ; D6
- Ambiguïté : « pas de visibilité » (atelier) vs entretien porté dans les données d'intégration (D6) : contradiction partielle

### EX-EXI-076 — Stock et sorties de stock (existant)
- Énoncé : stock = somme des mouvements (`mouvement`) ; Circé calcule déjà le stock et la quantité reçue d'une réception attendue (« Terminé »/« Partiel », `Partial_GridAfficheList.cshtml:8-20`). Selon atelier 14, les sorties de stock sont générées aujourd'hui par le scan des codes barre de fin de production, mais à Nîmes les stocks ne sont pas mis à jour par ce scan. Selon D6, « aucune sortie de stock automatique aujourd'hui (REU-08) ». Fin de campagne : Suivi > Etat de destruction : affiches entrées depuis plus d'un an, case « à conserver » par affiche, pas de décision par dossier ni « à renvoyer » (`p_s_destruction.sql:27-32`).
- Type : règle
- Source : atelier_20261014 slide 31 ; D6 grains, « Circé calcule déjà » ; atelier_20261013 #13 (« au douchage des étiquettes de prod »)
- Ambiguïté : contradiction entre sources (voir fichier de contradictions)

### EX-EXI-077 — Deadlines et calendrier du process
- Énoncé : deadline Pré-Prod jeudi S-2 (atelier 14, plusieurs étapes) ; export des trains jeudi 14 h ; tag cible « Deadline Pré-Prod dépassée » = jeudi S-2 16 h ; envoi de la prépa « le lundi » (D1/D3) ou « au plus tard jeudi S-2 » (D4/D5) ; blocage adresses + lettrage (batch auto S-3) ; Go aux plateformes jeudi S-2 ; mardi/vendredi S-2 pointage manquants (Nîmes) ; réunion du lundi (MUI) et du jeudi (prod semaine suivante).
- Type : règle
- Source : D1, D4, D5, D6, atelier_20261014 slide 6, atelier_20261015 slide 10
- Ambiguïté : « le lundi » de quelle semaine ? incohérence interne entre docs

### EX-EXI-078 — DM (dernière minute) et rajouts post-préparation (existant)
- Énoncé : pas d'alerte si DM avec fichier scro validé : un fichier à part est envoyé et ces affiches sortent systématiquement en fractionné. Sur le fixe, une fois la prépa envoyée et la prod commencée, sans mail de la PP indiquant que les IP en attente ont été renseignées, la plateforme ne sait pas qu'elle a le Go pour préparer le fichier multi-rouleuse. Dossier arrivé après la préparation : aucun signal (S15), il faut rafraîchir l'écran.
- Type : règle
- Source : atelier_20261014 slide 33 ; atelier_20261013 slide 16 ; D5 étape 7
- Ambiguïté : aucune

### EX-EXI-079 — Gestion des thèmes (existant)
- Énoncé : les thèmes sont issus des IP saisies par la Pré-Prod ; pas de règle de nommage ; plusieurs intitulés possibles pour un même thème Broadcast (lignes en trop) ; si réception avant IP chaque plateforme saisit un intitulé (ex. Wissous « n° 1234 – BURGER », Nîmes « n° 4321 – Burger », Pré-Prod ensuite « Burgers »). Sur modification d'IP après 1er envoi, le nouveau thème n'écrase pas l'ancien (doublons de visuels, empêche de raccrocher). Vérification des thèmes faite à l'œil à la préparation des trains (S49) ; Pré-Prod ne sait pas ce qui a été réceptionné.
- Type : règle
- Source : atelier_20261014 slides 24, 30, 31
- Ambiguïté : aucune

### EX-EXI-080 — BL.png : bon de livraison (image)
- Énoncé : photo d'une feuille A4 posée à plat, légèrement de biais. En-tête : logo « PRISMAFLEX INTERNATIONAL » ; titre « BON DE COLLECTE » ; « BL2698169 » ; « Date BL : 02/10/2026 ». Bloc « Adresse de livraison : PLATEFORME CITYZ MEDIA NIMES, 131 RUE ANDRE LE NOTRE, 30941 NIMES, Tel 0000000000 ». Un rectangle rouge plein en haut à droite (masque/caviardage probable) et une annotation manuscrite en haut à droite lisible « A-2 » ou « A-L » (incertain). Tableau à 7 colonnes : Contrat, Article, Format, Annonceur, Thème, Qut (quantité), Visuel. Une seule ligne : Contrat « 502600 VV » (lecture incertaine, possiblement 502605 VV qui est le dossier à thèmes Rêver/Savourer de l'atelier 14 slide 12) ; n° de ligne 1 ; Article « BPBW31180175B00UN_CCW » ; Format « BPBW3118017500 » (les deux codes articles sont difficiles à lire, la résolution est faible) ; Annonceur « 542 BALEXTER » (Balexert) ; Thème : chaîne illisible (de type « …Balexert Clear Channel 1185x1750 sav », donc format 1185×1750 mm, soit un 2 m² clear channel) ; Quantité « 7 » entourée à la main au stylo ; Visuel : vignette couleur d'une affiche représentant une femme et un homme souriants à une table, avec le mot « Savourer » et le logo « baléxert ». La partie basse de la feuille est vide (colonnes non remplies). Aucun n° d'affiche Circé, aucune mention de DA, aucun nom de transporteur ni de nombre de colis n'est lisible ; le n° de contrat est porté par le BL (cas « N° de contrat ou DA renseigné sur le BL ? » = oui).
- Type : affichage
- Source : docs-sources/Doc_Pilotage_Bao/BL.png
- Ambiguïté : image basse résolution : n° de contrat, codes article, thème et initiale manuscrite non fiables ; l'illustration d'un « bon de collecte » (Prismaflex = imprimeur) sert d'exemple de BL mais aucun doc ne le commente ; ne pas en déduire de règle

---

## G. Existant de l'atelier 8 m² / expédition cités dans les ateliers

### EX-EXI-085 — Écrans Expédition existants
- Énoncé : « Préparer colis pour les trains » (Préparation de train / Préparer) et « Liste des colis » (avec bouton « envoi manuel » ; code transporteur Geodis auparavant souligné en bleu donnant accès à l'étiquette signée, lien perdu depuis la bascule vers le nouveau logiciel Geodis). Aujourd'hui on copie le n° de colis dans Liste des colis puis on le colle dans Préparation de train/Préparer ; Circé impose de créer un nouveau colis plutôt que de ré-ouvrir.
- Type : fonctionnalité
- Source : atelier_20261015 slide 15 ; atelier_20261013 slides 16-17
- Ambiguïté : slides illustrées (images) non extraites ; besoins Expédition #4 et #5 vides dans l'extrait

---

# Statuts et transitions décrits par les specs (récapitulatif)

| Objet | Transitions | Qui / quoi |
|---|---|---|
| Dossier (Broadcast) | À traiter -> En cours | envoi de la prépa (Pré-Prod) |
| EDR « Statut Préparation » | vide -> Envoyé | Broadcast |
| EDR « Aff. reçues » | non -> oui | validation admin (calcul Circé) |
| Instruction (déroulant) | 0 À traiter -> 1 En cours -> 2 Instruction ok -> 5 A imprimer ; 4 Annulé depuis 0/1/2 (retour 0 possible, plus après l'export) ; 5 -> 2 possible ; 2 -> 0/1 efface les trains sauf faces à 5 | Circé auto / Nariman / Coordination ; export jeudi 14 h |
| Train (faces) | 5 A imprimer -> 10 Au roulage -> 7 A expédier -> 8 Terminé | atelier ; fin de journée Geodis |
| Ligne fixe (`tf_repart_calcul.rpc_statut`) | 0 À traiter -> 1 En cours (Colisage) -> 6 Préparé -> 7 A expédier -> 8 Terminé ; retour 0 si UM supprimée | intégration, Colisage, atelier, fin de journée |
| Affiche | créée à la réception ; orpheline tant que sans dossier ; case validation admin ; « associée » = lien + validation admin | agent réception, contrôle, Pré-Prod/Coordination |
| Énumération code | 0 À traiter, 1 En cours, 2 Instruction ok, 3 Erreur, 4 Annulé, 5 A imprimer, 6 Préparé, 7 A expédier, 8 Terminé, 9 Export prepa, 10 Au roulage | `Enums.cs:223-247` |
| Réception attendue | « Terminé » ou « Partiel » (quantité reçue vs théorique) | calcul Circé |
| Statut préparation fixe (atelier 13 slide 10) | En cours (pas encore fait) -> Préparé -> A expédier (scan) -> Terminé (saisie fin de journée Geodis) | atelier |

# Glossaire métier
- DA : demande d'affichage (n° chapeau Broadcast) ; DV : dossier de vente ; contrat/dossier : n° de contrat ; « Générer/activer la DA » = le dossier reçoit son n°.
- BC / Broadcast : outil commercial amont ; EDR / Etat des réservations : liste des réservations lue dans Broadcast.
- IP : instructions de pose (visuels, thèmes, exceptions, commentaire) saisies en Pré-Prod dans Broadcast.
- Prépa / préparation : envoi par la Pré-Prod de la répartition par thème/destinataire (bague = 1 prépa par personne par thème).
- Thème : visuel (+ repiquage) d'un dossier ; « intitulé » du thème.
- Scro (déroulant) : affiches roulées en trains (2, 4, 8 m², MUI, Venusial) ; Fixe : 2 m² fixe sur multi-rouleuse ; Pliage/Colle : 4, 8, 12 m² collés sans machine ; CG/CC/CP : types de dossiers (CC campagne contrôlée ; CG et CP non définis dans les docs).
- Train : unité de production du déroulant (afficheur × destinataire × semaine, jusqu'à 4 affiches/6 thèmes) ; face : une affiche d'un train ; tiroir : 20 max par export ; bague : étiquette/code barre d'un train (10 affiches par rouleau cible multi-rouleuse).
- UM : unité de manutention du fixe ; rouleau ; colis ; milk run (collecte régulière, « Milk » dans les ateliers) vs messagerie ; Geodis : transporteur.
- Instruction OK : verrou du dossier (scro). Validation admin : confirmation du lien affiche↔dossier. Colisage (bouton) : fige les lignes fixe et crée les UM ; colisage d'expédition : scan en colis.
- Raccrochage : lier une affiche reçue à un dossier/thème ; bascule : passage de la ligne attendue Broadcast à ligne de prépa ; orpheline : affiche sans dossier ; fractionner : sortir un thème en retard d'un train.
- Entretien : affiches en surplus (8 % défaut, 15 % campagne contrôlée) ; DM : dernière minute ; MUI : mobilier urbain d'information (non défini, supposé) ; VdP : Ville de Paris ; Print CM/Cityz : impression par Cityz Media ; REP : (non défini, « rouge barré = REP ou annulé »).
- Vendôme (Vendôme One, CCM V2) : machines de roulage ; Caire/GenfichierProd : outil de conversion .ini ; multi-rouleuse : machine fixe.
- Sites : Nîmes, Wissous, Nanterre (Bus, cible), Boulogne (équipe Coordination).

# Contradictions INTERNES (entre documents de l'existant)
1. Date d'envoi de la prépa : « le lundi » (D1, D3) vs « au plus tard le jeudi de S-2 » (D4, D5, atelier 14) vs deadline Pré-Prod « jeudi S-2 16 h » (D6) vs rajouts alertés « à partir de la nuit du jeudi au vendredi S-2 » (atelier 14).
2. Qui fait la validation admin : « Coordination » (D1, D3) vs « Pré-Prod (Nîmes, Coordination) ; référent·e Ville de Paris à Wissous » (D4) ; INC-23 : plus d'acteur au 8 m² scro Wissous.
3. Moment d'arrivée d'un dossier fixe dans l'atelier : à l'intégration de la prépa (D1, D2, D3, constat code 02/11) vs raccrochage (S24) / validation admin (S28) / Colisage (S37) selon D4/D5 (INC-05) ; D5 note elle-même la mise à jour du 02/11.
4. Validation admin « condition » : D4 « après le raccrochage, quand la préparation est envoyée » ; D1 « à n'importe quel statut de la ligne » ; D3 « pas de test dans le code, scro dépend en pratique de l'Instruction OK ».
5. Fréquence de l'EDR/copie : « 2 màj/jour » (atelier 14, deck S32) vs toutes les 2 h de 8 h à 18 h (D1/D3, indiqué le 21/10) ; D1 liste cette incohérence en point à confirmer.
6. Validation admin cible : D6 (21/10) et schémas D4/D5 barrés ( « faite par Circé quand tout concorde sinon Coordination » ) remplacés par l'option A du 02/11 ; D6 n'est pas mis à jour sur ce point.
7. Train : « jusqu'à 4 affiches » (deck) vs « jusqu'à 6 thèmes » (code) ; trains de 1, 2, 3 ou 4 (atelier 15).
8. Statut 5 : « A imprimer » vs « A préparer » (commentaire SQL).
9. Grain « attendue » : D2 attendue regroupée thème × support ; D6 « même grain pour tous les ateliers : dossier × semaine × thème × repiquage × format » : grains différents selon docs (D2 ajoute plateforme, annonceur, DA, quantité dans la clé).
10. Maquette d'avant IP : une ligne de DA (Pilotage) vs un thème provisoire par thème futur (Réception) (D2).
11. Instruction OK : D4/D5 « Qui : Pré-Prod Coordination » vs D1 « automatique sauf commentaire ou exceptions ≠ quantité » ; atelier 14 propose auto si commentaire vide seulement (voir fichier ateliers).

# Contradictions avec les ateliers (existant vs ateliers)
Détaillées dans `specs-ateliers-besoins.md` (section Contradictions) : rendre la main fixe/déroulant (atelier 13 vs atelier 14 slide 30 #4), « À traiter/En cours » du fixe (atelier 13 slide 10), sorties de stock par scan, validation admin « obligatoire », re-saisie % « non nécessaire », entretien « pas de visibilité », ordre raccrochage/Instruction OK.

# Sections non comprises ou incomplètes
- Diagrammes SVG de D1, D3 (flèches, ordre spatial) : reconstitués par texte uniquement.
- Atelier 14 slides 6 et 34 (diagrammes process macro/cible), slide 7 (matrice acteurs ●) et slide 21 (couleurs de pointage) : contenu graphique perdu, sans quoi l'affectation étape -> acteur -> site n'est pas exploitable.
- Atelier 13 slide 6 (étapes 1-8 numérotées), slides 7-9 et 11-12 (fiche de synthèse : captures), atelier 14 slides 10-11, 14-18 (copies d'écran Réception, Raccrochage, Validation admin) : images non extraites.
- Atelier 15 slides 12-14, 16-17 : illustrations (8 m² demandes 2, 3, 4 ; bouton envoi manuel) non extraites ; besoins Expédition #4 et #5 vides.
- Procédures non relues par les auteurs des HTML : corps de `P_CirceEtatReservation_New`, `P_ExportPrepaCirce`, pages « Préparation » fixe/pliage, « A traiter » du pliage, écriture de `tf_colis`, `p_u_statut_repart_deblocage`.
- Questions d'origine encore ouvertes (D1 §10, D3 §12, D2 §6) : qui active la DA ; Broadcast : faces avant la prépa ? thème visible avant l'envoi ? bandeau rempli à quelle étape ? ; DSI : plannings des 3 traitements ; Coordination : qui colise, déblocage ; Nariman : Instruction OK auto déjà en prod ? ; « vision au train » ; « zone picking » ; Q21 (CP/dynamisations) ; Q39 (vérification des thèmes).
- Références (S.., R.., A.., RP.., INC-.., ANO-.., PP-.., REU-.., FIX-.., SCR-.., BC-..) renvoient à `00_synthese_powerpoint.md` et decks du kick-off (12/10), absents du périmètre lu : non vérifiables ici.
