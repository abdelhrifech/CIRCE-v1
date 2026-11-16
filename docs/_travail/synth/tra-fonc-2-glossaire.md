Glossaire consolidé (fusion des glossaires de specs-reception, specs-coordination, specs-transverse, specs-existant-process, specs-ateliers-besoins et des notes legacy). Une ligne par terme. Colonne « Sens multiples » : OUI = le terme est employé avec des sens différents selon les sources (détail dans la section 2.2). Les EX des ateliers sont cités avec +500 (Q-350).

### 2.1 Termes

| Terme | Définition (métier) | Sens multiples | Source |
|---|---|---|---|
| Affiche | Unité de stock reçue : créée à la réception avec un n° (6 chiffres en maquette, `712xxx`) ; legacy : table `affiche` = « ligne de stock » (quantité = somme des mouvements). Peut servir plusieurs dossiers / thèmes / semaines (N à N) | OUI (affiche reçue / affiche d'un train, 2.2) | legacy-reception.md §entité `affiche` ; EX-EXI-073 ; maquettes-reception-coordination.md §4 |
| Affiche reçue (EDR) | Colonne de l'état des réservations : non -> oui. Existant : posée par la validation admin (calcul Circé, ANO-05). Cible 02/11 : posée par la réception (EX-REC-503) ; Oui / Oui surplus / Partielle / Non / Sans attendu | OUI | EX-EXI-055, EX-EXI-070 ; EX-REC-503 ; ECR-PIL-03 |
| Afficheur | Équipe de pose destinataire d'un train/UM/ligne de préparation (grain : thème × destinataire × afficheur) ; afficheur fictif « ENTRETIEN » dans les faces d'entretien du déroulant | non | EX-EXI-075 ; ECR-ADM-07 ; RG-COO-068 provisoire |
| Agent de réception | Utilisateur `recep` ; = contrôleur (DC §2) | OUI (agent de contrôle, 2.2) | EX-TRA-003 |
| Alerte | Exception calculée ou événement daté, avec gravité (Critique / Important / À surveiller / OK / Info), acquittable, qui ouvre l'écran où agir ; remplace mails et pointages Excel | OUI (« grave » du dossier réception, 2.2) | EX-TRA-027, EX-TRA-028, EX-TRA-030 ; ECR-TRA-01 |
| Allée | Emplacement de rangement de l'affiche (avec rayon) ; allée tampon `X` (ou `Z`) pour les réceptions inconnues / palettes non contrôlées ; obligatoire au contrôle | OUI (X vs Z, 2.2) | ECR-REC-02 ; ECR-ADM-05 `alleeInconnues` ; legacy-reception.md RG-REC-061 provisoire |
| Annonceur | Client annonceur du dossier ; filtres « smart » annonceur -> thèmes ; regroupements d'enseignes (`*MISTRAL*` -> `MISTRAL`) | non | ECR-ADM-05 ; EX-TRA-503 |
| Annule et remplace | Gestion d'une donnée de l'interface BC/Circé qui en remplace une autre (ex. adresses de livraison) ; remplace l'entrée « Écarts » du menu actuel | non | EX-TRA-514 ; ECR-NAV-02 |
| BC / Broadcast / Booking Center | Outil commercial amont des gestionnaires Pré-Prod (DA, IP, prépa) ; Circé le lit, ne peut pas y écrire | OUI (BC = Broadcast ou Booking Center) | EX-TRA-039 ; legacy-reception.md dépendances |
| Bague | Étiquette / code barre d'un train (1 prépa par personne par thème ; 10 affiches par rouleau cible multi-rouleuse) ; son impression fait passer le train à « En production » (maquette) ; ré-impression = retour de « Terminé » à « A imprimer » (restreinte, EX-ADM-503) | non | EX-EXI glossaire ; EX-ADM-503 ; maquettes-reception-coordination.md Q-D |
| BL | Bon de livraison / bon de collecte (« BL » + 7 chiffres en maquette) ; photo obligatoire à la réception ; une réception = un BL ; l'exemple (Prismaflex) ne définit aucune règle | non | specs-reception glossaire ; EX-EXI-080 |
| Bloc Paris | Dans `p_u_associe_train`, bloc SQL copie conforme traitant uniquement la convention `VPS_75 101 0004` (Ville de Paris) pour les faces d'entretien ; effet métier spécifique INCERTAIN (seul le filtre convention diffère) | non | legacy-repartition-production.md RG-RPR-027 provisoire ; legacy-coordination.md RG-COO-068 provisoire |
| Boucle | Tournée de départ camion d'un destinataire (jour + heure, canal MILK / MESSAGERIE / DIRECT) ; Paramétrage › Transport | non | ECR-ADM-06 ; ECR-EXP-03 |
| Bus | Affiches de bus (Nanterre), cible seulement ; le code ne connaît que 2M2FIXE, PLIAGE, DEROULANT ; centres bus ; +20 % d'entretien / +8 % production figés par Broadcast | OUI (flux existant ou non, 2.2) | EX-EXI-003 ; EX-BUS-502, EX-BUS-503 |
| Campagne contrôlée (CC) | Dossier à entretien 15 % et visuel en tête de train ; repère « Contrôlée 15 % » | non | EX-EXI-075 ; ECR-ADM-05 |
| CG, CP | Types de dossiers non définis dans les docs (CG : surplus d'entretien reçu ; CP : à creuser, annuler systématiquement ?) | non défini | specs-existant-process.md glossaire ; EX-FIX-506 ; Q-393 |
| Colis | Regroupement d'unités produites pour un destinataire : Ouvert -> Clos · à expédier -> Expédié -> Livré ; un colis clos ne se rouvre pas (décision 16/10) | non | ECR-EXP-01, ECR-EXP-02 |
| Colisage (bouton fixe) | Bouton du 2 m² fixe : fige les lignes et crée les UM ; la Pré-Prod ne peut plus y toucher ; nommé « Libération de la semaine » dans la maquette | OUI (colisage d'expédition, 2.2) | EX-EXI-041 ; EX-FIX-510 |
| Colisage (expédition) | Scan des unités produites en colis | OUI | specs-existant-process.md glossaire |
| Colisé | Statut d'unité/colis après scan (Colisé · à expédier) ; « C » du suivi de prod = colisé + expédié | non | EX-TRA-018 ; ECR-PIL-01 |
| Complément | Seconde livraison d'un visuel déjà reçu en partie | non | specs-reception glossaire |
| Conservation (flag) / à conserver | Indicateur de mise en conservation (visuel conservé à l'année) ; défaut existant 20 / 365 jours ; « conservation à l'année » non défini | OUI (conservation 20/365 existant vs délais 4/2 semaines cible) | EX-TRA-042 ; EX-STK-503, EX-STK-504 |
| Contrôle (de palette) | Étape 2 de la réception : contrôle d'une palette du sas, allée/rayon, contrôleur, création des mouvements, feuilles définitives | non | ECR-REC-02 |
| Convention | Référence contractuelle (`RefConvention`) ; `VPS_75 101 0004` = Ville de Paris | non | RG-RPR-027 provisoire |
| Coordination | Équipe qui travaille dans Circé (identifie, valide, exporte) ET module de la cible ET rôle `coord` ; Nîmes : « Pré-Prod Nîmes » (déduit) | OUI (rôle / module / équipe, 2.2) | specs-coordination glossaire ; Q-A de maquettes-reception-coordination.md §5 |
| Dashboard de réception | Écran attendu / reçu / reste à recevoir par semaine, annonceur, thème, plateforme, format, avec alertes d'écart (+/- 10 %) et réceptions sans IP | non | EX-REC-516 à EX-REC-520 |
| DA | Demande d'affichage : n° chapeau Broadcast (le dossier reçoit son n° quand la DA est « générée/activée ») ; grain « DA » = dossier × type de réalisation × plateforme (maquette) | OUI (clé de la ligne attendue, 2.2) | specs-existant-process.md glossaire ; EX-EXI-010 ; ECR-PIL-03 |
| Déblocage / Rendre la main | Déblocage de préparation (legacy : Déblocage préparations, Préparations débloquées) ; cible : « Rendre la main » aux plateformes | OUI (fixe vs déroulant, 2.2) | legacy-admin.md RG-ADM-022 provisoire ; ECR-NAV-02 ; EX-EXI-045 |
| Déroulant (scro) | Affiches roulées en trains (2, 4, 8 m², MUI, Venusial) ; type de production `DEROULANT` ; « scro » = déroulant | non | specs-existant-process.md glossaire |
| Départ / départ camion | Filtre « Départ » de page = semaine(s) de départ ; départ camion = destinataire × semaine (jour/heure depuis le lundi de S-1) ; grain de la fin de chaîne | OUI (filtre vs grain, 2.2) | EX-TRA-014 ; EX-EXI-073 ; ECR-EXP-03 |
| Destinataire | Point de livraison (site, boucle, canal, afficheurs) ; grain de la ligne de préparation | non | ECR-ADM-07 |
| Destruction / état de destruction | Existant : Suivi › État de destruction (affiches entrées depuis plus d'un an). Cible : Stocks › Fin de campagne, délais 4 sem. (2 m²) / 2 sem. (8 m²), coche de confirmation | OUI (destruction vs rebut, délai, 2.2) | EX-EXI-076 ; EX-STK-504 ; ECR-STK-03 |
| DM (dernière minute) | Modification/rajout tardif ; alerte `DM_FICHIER` si fichier scro déjà validé ; workflow via Process Métiers (hors Circé) | non | EX-EXI-078 ; EX-BUS-502 |
| Dossier | N° de contrat / dossier de vente (DV), grain racine (dossier -> thème -> ligne de préparation -> unité -> colis -> départ) ; 2e plateforme = suffixe `-W` en maquette | non | EX-EXI-073 ; ECR-PIL-03 |
| Dynamisation | Cas de dossiers non tranché (Q21 des sources) | non défini | EX-COO-508 |
| EDR / État des réservations | Table Broadcast copiée dans Circé (semaines S à S+8) ; écran « État des réservations vivant » (une base, plusieurs grains) | OUI (fréquence de copie, 2.2) | EX-TRA-039 ; ECR-PIL-03 ; Q-379 |
| Écart BC/Circé | Quantité Broadcast différente de celle de Circé (repère, alerte `ECART_BC`) | non | ECR-TRA-01 ; EX-EXI-074 |
| Emplacement | Allée-rayon d'une affiche (Stock par affiche) | non | ECR-STK-01 |
| Entretien | Affiches en surplus : 8 % par défaut, 15 % campagne contrôlée, modifiable à la préparation (grain afficheur, seuil 3, arrondi supérieur en paramétrage) ; Bus : +20 % par défaut | OUI (8 / 15 / 20 %, visibilité, 2.2) | EX-EXI-075 ; EX-REC-518 ; EX-BUS-503 ; ECR-ADM-05 |
| Étiquette rack | A4 `EtiquetteRackAffiche.rdlc`, code-barres « A- » + id d'affiche complété à 13 caractères (legacy) ; = « feuille de stock » avec mention définitive/temporaire | OUI (rack = feuille de stock, 2.2) | EX-TRA-024 ; legacy-admin.md RG-ADM-062 provisoire |
| Exceptions | Données d'IP (avec commentaire) qui conditionnent l'Instruction OK automatique (règle de Nariman : commentaire vide ET exceptions = quantité) | non | EX-COO-508 ; ECR-ADM-05 |
| Face | Ligne d'un train (une affiche), statuts 2 / 5 / 10 / 7 / 8 ; faces d'entretien | OUI (face/position/tiroir, 2.2) | EX-EXI glossaire ; RG-COO-068 provisoire |
| Feuille de stock | Étiquette rack imprimée au contrôle (définitive) ou à la création d'une réception inconnue (temporaire), 2 exemplaires par défaut (1 à 5) ; « Feuille à refaire » si thème modifié | OUI (rack, 2.2) | EX-TRA-024 ; ECR-REC-09 ; ECR-ADM-05 |
| Fixe (2 m² fixe) | 2 m² fixe sur multi-rouleuse (UM, rouleaux, colis) ; type `2M2FIXE` ; la distinction Vrac / Roulée est supprimée (EX-FIX-501) | non | EX-EXI-003, EX-EXI-041 ; EX-FIX-501 |
| Fractionner | Sortir un thème en retard d'un train (train fractionné `fr`) | non | EX-EXI glossaire |
| Fin de campagne | Écran Stocks : décisions par dossier (À décider, À conserver, À renvoyer, À détruire, Renvoyé, Détruit) | non | ECR-STK-03 |
| Fin de journée (Geodis) | Traitement : colis clos -> Expédié, unités -> Expédié, sorties de stock auto, récépissé ; existant : -> « Terminé » | OUI (Terminé vs Expédié/Livré, 2.2) | EX-EXI-072 ; ECR-EXP-02 |
| Libération de la semaine (alerte) | Alerte `APRES_LIBERATION` (« Rajout après préparation ») pour les dossiers fixe/pliage ou visuels arrivés après la libération / l'export | OUI | EX-FIX-510 ; maquettes-autres-modules.md §0.3 |
| Format | Format/surface d'affiche (2 m², 4 m², 8 m², collé 4/8/12 m², Bus) ; table `Transaco_Surface_Format` | non | ECR-ADM-01 ; legacy-reception.md |
| Geodis | Transporteur unique sortant (milk run et messagerie), API Zoom, fichier TXT, preuve de livraison | non | EX-TRA-040 ; ECR-ADM-06 |
| Grain | Niveau de détail d'une ligne : dossier -> thème -> ligne de préparation -> unité -> colis -> départ ; côté réception : BL -> réception -> affiche ; ruptures de grain avant la production ; « Afficher par » (9 grains) dans l'EDR | OUI (grains différents selon docs, 2.2) | EX-EXI-073 ; ECR-PIL-03 |
| Gravité | Critique (rouge) / Important (orange) / À surveiller (jaune) / OK (vert) / Info (azure) ; codes maquette critical / serious / warning / good / info | OUI | EX-TRA-028 ; Q-372 |
| Instruction | Objet du déroulant (Liste des instructions) : 0 À traiter -> 1 En cours -> 2 Instruction OK -> 5 A imprimer ; 4 Annulé | OUI (À traiter / En cours, 2.2) | EX-EXI-070 |
| Instruction OK | Verrou/feu vert de composition des trains (scro) ; Circé fait l'Instruction OK simple ; auto si commentaire de prépa vide ET exceptions = quantité (règle de Nariman) ; existant : à la main par Coordination | OUI (règle de déclenchement, 2.2) | EX-EXI-031, EX-EXI-032 ; EX-COO-508 |
| IP | Instructions de pose saisies en Pré-Prod dans Broadcast (visuels, thèmes, exceptions, commentaire) ; « IP saisies » = thèmes saisis | non | specs-reception glossaire ; EX-EXI-014 |
| Lot | Unité de production du pliage (`PL-`) et du bus (`BU-`) | non | EX-EXI-073 ; ECR-PIL-01 |
| Libération de la semaine | Voir Fixe / Libération de la semaine (ex Colisage) | OUI | specs-coordination glossaire |
| Milk / Milk run | Collecte régulière (tournée) par Geodis vs messagerie ; « Milk » dans les ateliers ; canal MILK | non | specs-existant-process.md glossaire ; EX-EXP-502 |
| MUI | Mobilier urbain d'information (supposé, non défini) ; format « Scrolling MUI » ; réunion du lundi (reporting MUI) | OUI (format / réunion) | specs-existant-process.md glossaire ; EX-SCR-515 |
| Multi-rouleuse | Machine du 2 m² fixe ; fichier de prod CSV (cp1252, sans en-tête, un fichier par annonceur et thème) | non | ECR-ADM-02 ; EX-FIX-502 |
| Orpheline / Réception inconnue | Affiche sans dossier / palette dont aucun dossier ne correspond ; « Réception inconnue » = nouveau libellé cible de « orpheline » | OUI (statut affiche / tag / statut de validation, 2.2) | specs-reception glossaire ; specs-reception contradiction 7 |
| Pliage / Colle | 4, 8, 12 m² collés sans machine (Wissous) ; type `PLIAGE` | non | EX-EXI-003 |
| Pôle | Direct / Intermédié : pôle de gestionnaires Broadcast destinataires des demandes de correction | non | ECR-THM-01 |
| Prépa / préparation | Envoi par la Pré-Prod de la répartition par thème/destinataire (`tf_prepa_affiche`, `tf_prepa_Broadcast`) ; option A : le raccrochage ne l'attend plus | OUI (date d'envoi, 2.2) | EX-EXI-016 ; EX-EXI-077 |
| Plateforme / site | Site de production (Nîmes, Wissous, Nanterre Bus cible ; DBG et DBG Lyon dans le code) ; plateforme = site | OUI (DBG, Pliage 12M2, 2.2) | EX-TRA-006 ; EX-EXI-003 ; Q-358 |
| Position (train) | Emplacement A-D d'une affiche dans un train ; max 4 (deck) vs 6 thèmes (code) | OUI | EX-EXI contradiction 7 ; ECR-ADM-05 |
| Print Cityz / Print CM | Affiche imprimée par Cityz (date de livraison prévue « à demander ») | non | specs-ateliers-besoins.md glossaire ; ECR-PIL-01 |
| Pré-Prod | Gestionnaires dans Broadcast (hors Circé) ; Pré-Prod Nîmes = Coordination (déduit) | OUI | EX-TRA-003 ; Q-351 |
| Raccrochage | Lier une affiche reçue à un dossier/thème (rattachement) ; option A du 02/11 : Circé propose dès la réception, une personne valide | OUI (conditions de déclenchement, 2.2) | EX-EXI-052 ; EX-COO-506 |
| Rack | Rangement (allée/rayon) ; « étiquette rack » = feuille de stock | OUI | EX-TRA-024 |
| Rayon | Subdivision d'une allée (1-9 pour les réceptions inconnues en maquette) | non | ECR-REC-02 |
| Rebut / Rebus | Affiches mises au rebut (colonne « Rebus », mouvement négatif plafonné au disponible, motif) ; même case `rebus` que la destruction dans l'existant | OUI (rebut vs destruction) | EX-REC-513 ; ECR-STK-01 |
| Réception | Livraison physique d'une palette (R + 6 chiffres) : BL, transporteur, imprimeur, 1 à 6 colis, jusqu'à 4 affiches ; statuts A_IDENTIFIER / A_CONTROLER / CONTROLEE | OUI (réception / réception attendue, 2.2) | ECR-REC-01 ; maquettes-reception-coordination.md §4 |
| Réception attendue | Ligne issue de Broadcast (grain thème × support ; statuts Terminé / Partiel, Attendue / Partielle / Complète / Surplus) ; purge à 4 semaines hors conservation | OUI (clé avec/sans DA, 2.2) | EX-EXI-013 ; EX-REC-512 |
| Réception inconnue | Voir Orpheline ; alerte destinée Coordination (DC) ou Pré-Prod (PR) | OUI | specs-reception contradiction 1 |
| Repère | Marque calculée sur une ligne (Contrôlée 15 %, Print Cityz, Reste en place, Ne pas afficher, Multi-semaines, Thème proche, Modifié dans BC, Écart BC/Circé…) | non | EX-EXI-074 |
| Repiquage | Variante de visuel d'un thème (extrait du thème `repiquage#thème`) ; clé de grain | non | legacy-reception.md ; EX-EXI-073 |
| Reste en place / Ne pas afficher | Thèmes exclus de la préparation des fixes/suivi des thèmes (exclusion automatique cible) | non | EX-COO-502, EX-COO-509 |
| Rouleur | Opérateur choisi à la préparation du train (rouleau) ; référentiel | non | ECR-COO-07 ; ECR-ADM-07 |
| Sas | Liste des palettes à contrôler (zone tampon) ; badge « n palettes à contrôler » | non | specs-reception glossaire ; ECR-REC-02 |
| Scro | Synonyme de déroulant (2 m² et 8 m²) ; « 2 m² scro », « 8 m² scro » | non | specs-ateliers-besoins.md modules |
| Statut / tag / repère | Statut d'avancement (pastille + libellé) ; tag cible posé par Circé à chaque événement (cible NON validée, EX-EXI-074) ; catalogue de 109 entrées en Paramétrage | OUI (3 sens de « À traiter » / « En cours », 2.2) | EX-TRA-018 ; EX-EXI-071, EX-EXI-074 ; ECR-ADM-03 |
| Suivi par thème | Vue « besoin » de la Liste des trains ; suivi des thèmes uniquement si commentaire de prépa (cible) | non | EX-COO-509 ; ECR-COO-06 |
| Surplus | Réception > +10 % de l'attendu (état de thème SURPLUS), « surplus compté en entretien » | non | ECR-ADM-05 ; ECR-ADM-03 |
| Thème | Visuel (+ repiquage) d'un dossier, « intitulé du thème » ; issu des IP ; règle du « 1er qui a parlé » à la réception sans IP | OUI (visuel / intitulé / thème BC, 2.2) | EX-THM-501 ; EX-EXI-079 |
| Tiroir | Case de la Vendôme (20 max par export/fichier) ; = visuels distincts, positions fractionnées exclues | non | ECR-GEN-01 ; EX-EXI glossaire |
| Train | Unité de production du déroulant : afficheur × destinataire × semaine, N-à-N avec les dossiers (jusqu'à 4 affiches, 6 thèmes en code) | OUI (4 vs 6, trains de 1 à 4) | EX-EXI-073 ; EX-EXI contradiction 7 |
| UM | Unité de manutention du fixe (destinataire × contrat × format × type × thème × repiquage) ; non définie dans specs-coordination | OUI (UM fixe/pliage corrigé le 02/11) | EX-EXI-073 ; specs-coordination contradiction 9 |
| Validation admin | Existant : case sur l'affiche confirmant le lien affiche-dossier ; cible (option A du 02/11) : Circé PROPOSE le rattachement, une personne VALIDE (statuts À confirmer / Validée / Aucune affiche reçue) ; dossier « Validation admin faite » vs « Validée » | OUI (case vs statut ; qui valide, 2.2) | EX-EXI-053 ; specs-coordination glossaire ; ECR-COO-01 |
| Vendôme / CCM V2 / Venusial / Caire | Machines de roulage ; Caire/GenfichierProd = outil de conversion `.ini` ; Venusial = type 2 m² | non | EX-EXI glossaire ; ECR-ADM-02 |
| VdP | Ville de Paris (conservation, MUI, renvoi, bloc Paris) | non | specs-existant-process.md glossaire |
| Visuel | Image d'un thème (bouton « voir le visuel ») ; « visuel provisoire » avant IP | OUI (visuel / thème) | ECR-REC-12 ; specs-coordination glossaire |
| Zone picking | Droit `Zone_Picking` et écran legacy (affiche en zone de picking) ; correspondance cible inexistante | non | legacy-admin.md ; EX-TRA-012 ; Q-382 |
| Zone tampon | Allée X des réceptions inconnues / palettes non contrôlées | non | specs-reception glossaire |
| Zippage, demies haut/bas | Moitiés d'affiche 8 m² (quart d'affiche) ; Suivi 8 m² (demies) | non | specs-ateliers-besoins.md glossaire ; ECR-COO-08 |

### 2.2 Termes employés avec des sens différents selon les sources

| Terme | Sens A | Sens B (et suivants) | Questions / traitement |
|---|---|---|---|
| À traiter | Dossier chez Broadcast, prépa non envoyée | Instruction du déroulant (même sens, ou faces seules arrivées) ; ligne du fixe : prépa reçue, pas encore colisée (décalé d'un cran) | EX-EXI-071 ; vocabulaire cible « un mot, un sens » (EX-TRA-018) ; Q-381 |
| En cours | Prépa arrivée (Broadcast, déroulant) | Colisé au fixe de Circé (INC-01) ; atelier 13 : « En cours = pas encore fait » vs D1/D4 « En cours = colisé » | EX-EXI-071 ; Q-381 |
| Terminé | Existant : posé par la fin de journée Geodis (code 8) | Cible : Expédié (fin de journée) puis Livré (preuve de livraison reçue) ; atelier : « Terminé » = scan Milkrun | EX-EXI-072 ; EX-STK-501 ; Q-383, Q-390 |
| Pré-Prod | Gestionnaires dans Broadcast (hors Circé) | Rôle de travail dans Circé supprimé le 27/10 (= Coordination) ; « Pré-Prod Nîmes » ; destinataire d'alerte | Q-351 |
| Validation admin | Case sur l'affiche (existant) | Statut calculé/proposé à 4 états (cible) ; « Circé fait la validation quand il n'y a pas de doute » (barré) ; fusion avec la validation du raccrochage (EX-COO-507) ; « obligatoire » (ateliers) vs « ne conditionne rien » (code) | Q-354 ; questions COO |
| Orpheline | Statut de l'affiche (DC) | Tag (PR) ; statut de validation (DC encadré) ; « Réception inconnue » (libellé cible) | specs-reception contradiction 7 |
| Contrôleur / agent de contrôle / agent de réception | Contrôleur = un agent de réception (DC §2) | « Agent de contrôle » (README §3) | Q-351 |
| Colisage | Bouton du fixe qui fige et crée les UM (rôle : Coordination à confirmer, deck : Pré-Prod) | Scan en colis à l'expédition ; maquette : « Libération de la semaine » | EX-FIX-510 ; Q-387 |
| Rendre la main | Fixe : possible de changer les infos même prépa envoyée (A13 slide 14) | Fixe : on ne peut plus changer l'intitulé (A14 slide 30 #4, S L12) ; déroulant : on peut | Q-387 |
| Rack / étiquette rack / feuille de stock | Étiquette rack = feuille de stock (même modèle, mention définitive/temporaire) | Étiquette rack imprimée d'office à la validation admin (existant) vs feuilles imprimées au contrôle (cible) | EX-TRA-024, EX-TRA-025 ; questions REC |
| Allée tampon | `X` (ECR-ADM-05, réceptions inconnues) | `Z` ou `X` (ECR-REC-02) | questions REC |
| Réception attendue (clé) | Clé de ligne incluant la DA (PP R1) ; grain D2 : thème × support (+ plateforme, annonceur, DA, quantité) | Clé sans DA (RA RG-AT-01, DC) ; D6 : dossier × semaine × thème × repiquage × format | EX-EXI contradiction 9 ; questions REC |
| DA (grain) | N° chapeau Broadcast | Grain « DA » = dossier × type de réalisation × plateforme (EDR vivant) | ECR-PIL-03 |
| Entretien | 8 % par défaut ; 15 % campagne contrôlée | +20 % par défaut et +8 % de production (Bus) ; « pas de visibilité de l'entretien » (A14) vs entretien fourni par Broadcast (D6) ; grain afficheur / annonceur-thème-ville | EX-EXI-075 ; EX-BUS-503 ; questions COO |
| Conservation | Existant : 20 (défaut) / 365 jours pour « affiche à conserver » | Cible : « conservation à l'année » (purge 4 sem. exceptée) ; délais destruction 4 / 2 semaines | EX-TRA-042 ; EX-STK-504 ; Q-384 |
| Destruction / rebut | Destruction : case unique `rebus` dans l'existant (même case que le rebut) | Cible : rebut (mouvement, motif) distinct de destruction (fin de campagne) | ECR-STK-01 ; Q-384 |
| Statuts / « 5 » | `5 A imprimer` (enum) | `A préparer` (commentaire SQL) ; cible « Prêt à produire » | EX-EXI contradiction 8 ; Q-004 |
| Train (taille) | Jusqu'à 4 affiches (deck) | Jusqu'à 6 thèmes (code) ; trains de 1, 2, 3 ou 4 (atelier 15) | EX-EXI contradiction 7 ; ECR-ADM-05 |
| Gravité « grave » | Niveau du dossier Réception | Critique / Important de la charte (correspondance non définie) | EX-TRA-028 ; Q-372 |
| Bus / flux Bus | « Flux existant » et workflow DM (S L34) | Aucun flux Broadcast pour le Bus (D6) ; code : 3 types seulement | Q-386 |
| Coordination | Rôle `coord` | Module (domaine) ; équipe ; « Coordination » vs « Pré-Prod » | Q-351, Q-366 |
| THM (thèmes) | Module à part dans la maquette (ECR-THM) | « Fonctionnellement Coordination » (maquette §4) | Q-366 |
| EDR (fréquence de copie) | 2 mises à jour par jour (atelier 14) | Toutes les 2 h de 8 h à 18 h (HTML 02/11) | Q-379 |
| Date d'envoi de la prépa | « Le lundi » (D1, D3) | « Au plus tard jeudi S-2 » (D4, D5) ; deadline Pré-Prod jeudi S-2 16 h ; rajouts alertés « nuit du jeudi au vendredi S-2 jusqu'au vendredi S » | EX-EXI-077 ; Q-380 |
| Statut dossier validé | « Validation admin faite » (DESIGN, DC) | « Validée » (PC, README) ; statut interne `VALIDE` jamais affiché | specs-coordination contradiction 4 |
| UM | Unité de manutention du fixe | « UM du fixe et du pliage » (corrigé le 02/11, encore présent barré) | specs-coordination contradiction 9 |
| Refusé | Catégorie de la synthèse L93 (ré-ouverture de colis, EX-EXP-506) | « Besoin Refusé » (A14) : mail au commercial (EX-REC-523) | Q-388 |
