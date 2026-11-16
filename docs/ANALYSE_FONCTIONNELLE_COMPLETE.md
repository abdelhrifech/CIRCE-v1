# Analyse fonctionnelle complète

Produit à l'étape 1b. Sources : RECEPTION_REGLES_METIER.md, COORDINATION_REGLES_METIER.md, docs/_travail/synth/ (fragments tra-fonc-*), PLAN_IMPLEMENTATION.md (identifiants de parcours, index RG -> parcours §6). Profils provisoires (Q-003).

## 1. Acteurs et profils
Statut : profils PROVISOIRES (Q-003, CLAUDE.md §8). Les 6 rôles sont ceux de la maquette (`M.ROLES`, `core.js:187-194`, repris dans maquettes-reception-coordination.md §1.3). Le code historique n'a AUCUN rôle nommé exploité : le profil effectif d'un utilisateur = (a) ses droits `tr_utilisateur_menu` (27 valeurs connues de l'enum `CommunBll.Droits`) + (b) son périmètre `tr_utilisateur_data` (N triplets login / plateforme / atelier). `tr_utilisateur.prf_id` est inerte (RG-ADM-010 provisoire de legacy-admin.md ; seule une procédure morte `p_s_listeAtelier` commente 1 = atelier, 2 = plateforme, 3 = administrateur ; libellés `tr_profil` absents du dépôt, cf. Q-004). Aucun contrôle serveur dans l'existant (RG-ADM-015 provisoire) ; la cible exige un contrôle dans le service (CLAUDE.md §6, EX-TRA-002). Mécanisme d'authentification cible : Q-001 (non tranché ; l'existant = compte Windows/AD fourni par IIS, RG-ADM-001 provisoire).

### 1.1 Profils utilisateurs de Circé V2 (provisoires)

| Profil | Description | Modules accessibles |
|---|---|---|
| `coord` — Coordination | Équipe qui travaille dans Circé (identifie les réceptions inconnues, valide les affiches = validation admin, pose l'Instruction OK, exporte les trains le jeudi 14 h, libère la semaine fixe/pliage, demande des corrections à Broadcast). Remplace le rôle « Pré-Prod » dans Circé depuis le 27/10 (« Pré-Prod Nîmes » = déduit). Seul profil (avec `admin`, cf. Q-354) à voir le bouton « Valider ». Source : specs-coordination.md glossaire ; EX-TRA-003, EX-TRA-005 ; maquettes-autres-modules.md §0.6 point 1 | Réception (Réception des affiches, Liste des affiches, Réceptions inconnues : primaire pour `reception` et `identification`) ; Pré-production (Validation admin et Instruction OK, Vérification des thèmes) ; Déroulant (Liste des instructions, Liste des trains, Suivi par thème, Préparation, Suivi 8 m²) ; 2 m² fixe / Pliage / Bus › Préparation ; Pilotage (Suivi de prod, État des réservations, Alertes) ; Stocks › Fin de campagne (ECR-STK-03). Source : champ `roles` des écrans (ECR-REC-01..04, ECR-COO-01, 05, 09, ECR-THM, ECR-STK-03, ECR-PIL-01/03) |
| `cheq` — Chef d'équipe | Chef d'équipe d'atelier/plateforme (rôle par défaut de la maquette). Prépare les trains, les UM et les lots, génère les fichiers machine (Vendôme, multi-rouleuse), dispatche le roulage, imprime les bagues, contrôle les réceptions de son site. Destinataire de nombreuses alertes (rajout après préparation, DM, retard de contrôle). Source : maquettes-reception-coordination.md §1.3 ; ECR-TRA-01 | Réception (`reception`) ; Déroulant (Liste des trains, Préparation, Dispatch, Bagues, Fichiers Vendôme) ; 2 m² fixe / Pliage / Bus (Préparation, Fichiers multi-rouleuse) ; Pilotage (Suivi de prod, État des réservations) ; Stocks (Stock, Fin de campagne) ; Expédition (Scan et colisage, Colis, Départs camions) ; secondaire : le reste (grisé, non interdit dans la maquette) |
| `recep` — Agent de réception | Agent de réception physique (= « contrôleur » dans le dossier Réception ; « agent de contrôle » dans README §3, cf. Q-351). Saisit le BL, crée l'affiche et son n°, traite les orphelines, range (allée/rayon), imprime les feuilles de stock. Ne valide pas (la validation admin est réservée Coordination). Source : EX-TRA-003, EX-TRA-005 ; maquettes-reception-coordination.md §1.3 | Réception (Réception des affiches, Liste des affiches, Réceptions inconnues : primaire) ; Pilotage › État des réservations ; Stocks (Stock par affiche, Mouvements, Fin de campagne). Aucun écran Coordination en primaire |
| `expe` — Agent d'expédition | Agent d'expédition : scan des unités produites, colisage, clôture des colis, fin de journée Geodis. Aucun écran de Réception/Coordination en primaire. Source : maquettes-reception-coordination.md §1.3 ; maquettes-autres-modules.md §6 | Expédition (ECR-EXP-01..03) ; Stocks › Stock par affiche (ECR-STK-01) |
| `admin` — Administrateur | Administration du paramétrage (sites, ateliers, machines, statuts, alertes et mails, règles métier, transport, référentiels, journal) ; la maquette lui ouvre aussi Validation admin / Instruction OK et Vérification des thèmes (`roles` = coord + admin). Source : maquettes-autres-modules.md §8 ; maquettes-reception-coordination.md §1.3 | Administration › Paramétrage (ECR-ADM-01..08) ; Pré-production (instructions, thèmes) ; Pilotage (Suivi de prod, État des réservations) |
| `com` — Commerce (lecture) | Consulte le suivi et les affiches reçues, sans bouton d'action ; ne reçoit plus de mail à la réception d'un dossier. Périmètre exact « à valider avec Commerce » (H10 / AUT-05, pas de contrôle effectif dans le code de la maquette). Source : EX-TRA-004 ; README H10 ; DESIGN §8 | Lecture seule : Pilotage (Suivi de prod, État des réservations) ; Réception (`reception`, lecture) ; périmètre exact : Q-355 |

Règles d'accès réellement codées dans la maquette (seules restrictions) : validation admin d'une affiche (« Valider », « Annuler la validation », « Valider la sélection ») réservée à `coord` et `admin` ; rattachement manuel = validation admin si le rôle est `coord`, sinon l'affiche reste « à confirmer » (maquettes-reception-coordination.md §1.3). Tout le reste n'est que grisé (`dim`), jamais interdit : la matrice rôle × écran × action est à définir (Q-353).

### 1.2 Correspondance proposée droits legacy (27) -> rôles provisoires (HYPOTHÈSE sous Q-003 / Q-352)

Cette correspondance N'EST PAS dans les sources : c'est une proposition de travail déduite des effets constatés (legacy-admin.md « Profils réels », §2 et §4) et des écrans primaires de la maquette. À valider par l'équipe ; tout ✔ ci-dessous est un candidat. « ? » = rattachement non déductible (Q-352).

| Droit legacy (valeur en base) | Effet constaté (legacy-admin.md §2) | Rôle(s) candidat(s) | Source |
|---|---|---|---|
| `Super_admin` | sous-menu « Utilisateur Admin » (utilisateurs, périmètre, droits) | `admin` | `_MenuNew.cshtml:212-222` |
| `admin` | groupe Administration ; Informations configuration, Poste de travail, Plateforme (Mail), Liste des transporteurs | `admin` | `_MenuNew.cshtml:157,201-208` |
| `referentiel` | Liste des adresses, des rouleurs, Admin Equipe / Machine | `admin` | `_MenuNew.cshtml:158,187-197` |
| `debloque_repart` | Déblocage préparations | `coord` ; (`admin` ?) | `_MenuNew.cshtml:155,166-169` |
| `view_repart` | Préparations débloquées | `coord` | `_MenuNew.cshtml:156,171-174` |
| `train_rafraichir_contrat` | Rafraichir un dossier | `coord`, `admin` ? | `_MenuNew.cshtml:159,176-179` |
| `duplication_train` | Dupliquer train | `coord` ? | `_MenuNew.cshtml:180-183` |
| `reception_liste_affiche` | Réception des affiches, Liste des affiches | `recep`, `coord`, `cheq` ; `com` (lecture) | `_MenuNew.cshtml:122-128` |
| `Zone_Picking` | Zone picking, case zone picking du détail affiche | `recep` ? (Q-352 ; Zone picking hors périmètre P1) | `_MenuNew.cshtml:129-132` |
| `fusion_affiche` | Fusion des affiches | `recep` ? (Q-352) | `_MenuNew.cshtml:133-136` |
| `validation_admin` | cases Validation Admin / À conserver ; association/dissociation de prépa | `coord` (+ `admin`, Q-354) | `Partial_ModifierDetailsAffiche.cshtml:24` |
| `suivi_suivi_production` | Suivi de production, État des réservations, État de destruction | `coord`, `cheq`, `recep`, `admin` ; `com` (lecture) | `_MenuNew.cshtml:140-152` |
| `Activite_Production` | Analyse Production ; boutons Zone picking / Suivi | `cheq`, `admin` ? | `_MenuNew.cshtml:147-150` |
| `pliage_a_traiter` | Pliage › A traiter ; Trains › Liste des instructions | `coord`, `cheq` | `_MenuNew.cshtml:61-64,84-87` |
| `pliage` | Pliage › Préparation, Liste des colis ; Trains › Liste des trains, Position Train | `cheq`, `coord` | `_MenuNew.cshtml:66-70,89-93` |
| `train_suivi_theme` | Trains › Suivi par thème | `cheq`, `coord` | `_MenuNew.cshtml:95-99` |
| `train_preparation` | Trains › Préparation, Export préparation, Liste des colis | `cheq`, `coord` | `_MenuNew.cshtml:101-107` |
| `train_regrouper` | Raccrocher / fractionner | `cheq`, `coord` | `TrainSuiviTheme/Index.cshtml:91` |
| `train_debloquer_semaine` | Débloquer semaine (cible : « Rendre la main ») | `coord` | `TrainSuiviTheme/Index.cshtml:105,143` ; maquettes-autres-modules.md ECR-NAV-02 |
| `train_changer_statut` | Changer statut (A imprimer) | `coord` | `TrainPreparation/Index.cshtml:78` |
| `train_annuler_theme` | aucun usage retrouvé | ? (Q-352) | enum seulement |
| `_2m2_fixe` (stocké `2m2_fixe`) | 2 m² fixe › Préparation, Liste des colis | `cheq`, `coord` | `_MenuNew.cshtml:45-49` |
| `_2m2_fixe_a_traiter` (stocké `2m2_fixe_a_traiter`) | 2 m² fixe › A traiter | `cheq`, `coord` | `_MenuNew.cshtml:40-43` |
| `bus` / `bus_a_traiter` | Bus › Préparation / A traiter (si flag `busv3`) | `cheq`, `coord` | `_MenuNew.cshtml:11-28` |
| `expedition_ext` | Expedition ext › Liste des colis | `expe` | `_MenuNew.cshtml:111-119` |
| `retirer` | « Confirmer Retirer » en Préparation 2m² fixe / Pliage / Bus | `cheq` | `Preparation2m2Fixe.cshtml:139` |

Notes : (1) l'écran « Admin utilisateur menu » ne propose que 21 des 27 droits (RG-ADM-013 provisoire) ; 2 droits sont enregistrés avec une valeur erronée (RG-ADM-014). (2) Les droits ne sont que des tests d'affichage dans l'existant (RG-ADM-023). (3) Périmètre : `tr_utilisateur_data` filtre les listes de plateformes et d'ateliers par utilisateur (RG-ADM-016) ; cible : lien avec le sélecteur de site : EX-TRA-006, Q-357. (4) Écran de gestion des utilisateurs/droits : « phase 4 » (maquette ECR-ADM-07, ECR-NAV-02), donc dépendance étape 8 (voir tra-dependances.md).

### 1.3 Acteurs métier non utilisateurs de Circé V2 (ou rôles externes)

| Acteur | Rôle dans le process | Interaction avec Circé | Source |
|---|---|---|---|
| Pré-Prod / gestionnaires (pôles Direct / Intermédié) | Travaillent dans Broadcast (BC) uniquement : activent la DA, saisissent les IP (visuels, thèmes, exceptions, commentaire), envoient la prépa ; reçoivent par mail les demandes de correction de thème/annonceur. Ne sont PAS utilisateurs de Circé depuis le 27/10 | Circé lit Broadcast (copie EDR, préparations, trains, instructions) ; Circé n'écrit pas dans Broadcast (mail/alerte pour toute correction) ; « qui active la DA » = À CONFIRMER | EX-TRA-003, EX-TRA-039 ; EX-EXI-001, EX-EXI-002 ; ECR-THM-01 ; Q-351 |
| Circé (automatique) | Copie EDR, crée les lignes attendues, intègre la prépa, passe « En cours », Instruction OK automatique, fin de journée colis -> Terminé, calcule les alertes, propose les rattachements (option A du 02/11 : rien sans une personne) | Acteur système (auteur des mouvements automatiques `Circé (automatique)`) | EX-EXI-002 ; EX-TRA-003 ; ECR-STK-02 |
| Contrôleur | Agent de réception qui contrôle la palette (nom obligatoire, liste déroulante) | Utilisateur `recep` ; liste « Agents de réception / contrôleurs » en Paramétrage › Référentiels | EX-TRA-003 ; EX-REC-514 ; ECR-ADM-07 |
| Chefs d'atelier, admins plateforme, coordinateurs logistique, directeurs de plateforme | Destinataires des listes de distribution (« Rajouts après préparation » Nîmes / Wissous) ; « Directeurs de plateforme et chefs d'équipe » pour la ré-impression des bagues | Destinataires d'alertes/mails ; rôles « directeur de plateforme » absents des 6 rôles (Q-356) | EX-COO-503 ; EX-ADM-503 ; ECR-ADM-04 |
| Équipes de plateforme (Nîmes, Wissous, Nanterre Bus cible) ; agents de réception Nîmes / Wissous | Réception, ateliers, colisage ; Nîmes : adresses génériques partagées (Q-359) ; Wissous : comptes nominatifs ; Ville de Paris / 8 m² : référent·es à Wissous (INC-23 : plus d'acteur pour la validation admin du 8 m² scro) | Utilisateurs avec périmètre site/atelier | EX-TRA-007 ; EX-EXI-003, EX-EXI-004 |
| Rouleurs / opérateurs d'atelier, afficheurs | Rouleur : choisi à la préparation des trains (`Rouleur N1 · Nîmes · Table 1`) ; afficheurs : équipes de pose destinataires des trains/UM | Référentiels (Paramétrage › Référentiels), non utilisateurs | ECR-ADM-07 ; ECR-COO-07 |
| Transporteurs entrants (livreurs) et imprimeurs | Livrent les palettes ; imprimeurs (dont Print Cityz) ; renseignés à la réception | Référentiels (listes à la saisie d'une réception) ; Prismaflex = imprimeur du BL exemple | ECR-ADM-07 ; EX-ADM-501 ; EX-EXI-080 |
| Geodis (transporteur sortant, milk run / messagerie) | Prend en charge les colis, fin de journée, récépissé, preuve de livraison | Interface Geodis (API Zoom) ; hors périmètre P1 | EX-TRA-040 ; ECR-EXP-02 |
| Commerce / commercial et assistante du dossier | Reçoivent (cible refusée) un mail à la réception ; Commerce = lecture | Rôle `com` ; mail commercial : alerte `MAIL_COMMERCIAL` désactivée « refusée le 14/10 » | EX-REC-523 ; ECR-ADM-04 |
| Clients (annonceurs, agences, Villes dont Ville de Paris), Print Cityz | Envoient les affiches (Paris : MUI, conservation, renvoi) | Aucune (données de dossier) | EX-STK-503 ; ECR-STK-03 |
| Process Métier (application tierce) | Non-conformités : saisie via lien depuis Mouvements | Lien sortant (EX-QUA-501, Q-394) | EX-TRA-040 ; EX-QUA-501 |
| DSI | Plannings des traitements, accès base, secrets en clair (Q-010), export `tr_statut` (Q-004) | Support | EX-TRA-038 ; Q-004, Q-005, Q-010 |
| Personnes citées sans rôle défini | Rayane (développeur : moulinette fichiers de prod, alertes), Bao (revoit des lignes), Patrick (droits spéciaux : ré-impression des bagues, n° de panneau BC), Isa(belle) (coordination : purge/déblocage, mail de validation scro), Nariman (règle d'Instruction OK automatique), Fabrice, Géraldine, Alain, Nelly, Arthur/Christine, Stéphane, Gerald | Aucun rôle Circé déductible : Q-356 | specs-ateliers-besoins.md glossaire ; EX-SCR-512 ; EX-ADM-503 |

## 2. Glossaire métier
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

## 3. Cartographie fonctionnelle
Modules, rôle, priorité (P1 = Réception/Coordination, P2 = dépendances, P3 = hors périmètre).

Priorités : P1 = Réception / Coordination (périmètre de la mission) ; P2 = dépendance indispensable à P1 (justifiée par maquettes-autres-modules.md §0 « DÉPENDANCES », 0.1 à 0.6) ; P3 = hors périmètre (consommateur de P1 ou écran de maquette seulement). Les EX des ateliers sont cités avec +500 (Q-350). Rôles : champ `roles` de l'écran dans la maquette (voir 1.1).

### 3.1 Modules et entrées de menu (menu §1.2 de maquettes-reception-coordination.md + ECR-NAV-01)

| Onglet / module | Entrée de menu | Écran(s) | Rôle(s) primaire(s) | Priorité | Justification |
|---|---|---|---|---|---|
| Pilotage | Suivi de prod (dashboard) | ECR-PIL-01 | coord, cheq, admin, com | P3 | Consomme P1 (reçu, reste, état réception : §0.1) mais P1 n'en dépend pas ; écran d'ouverture de la maquette (Q-365) |
| Pilotage | Suivi de prod d'un atelier | ECR-PIL-02 | cheq, coord | P3 | Consommateur (§0.1, §0.3) ; colonnes Demies dépendent du Suivi 8 m² (ECR-COO-08) |
| Pilotage | État des réservations vivant | ECR-PIL-03 | coord, admin, recep, com, cheq | P2 | Cible des liens de P1 : alertes MANQUANT / DEPART_RISQUE (ECR-TRA-01), `?ou=` `?dossier=` `?par=` `?q=` utilisés depuis Alertes, Instructions, THM (§0.4) ; affiche colonnes Reçu, Validation admin, N° d'affiche, Où en est-il produites par REC/COO (§0.1, §0.3) |
| Pilotage | Fiche dossier (tiroir partagé) | ECR-PIL-04 | tous | P2 | Réutilisée par P1 : liens « Voir dans Instructions » et « Voir les affiches » (§0.5) ; équivalent de ECR-COO-02 |
| Pilotage | Alertes | ECR-TRA-01 | tous | P1 (transverse) | Écran listé dans l'analyse Réception/Coordination (maquettes-reception-coordination.md §0, Partie C) : agrège les alertes REC et COO (EX-TRA-027 à EX-TRA-032) |
| Réception | Réception des affiches (étape 1 arrivée, étape 2 contrôle / sas) | ECR-REC-01, ECR-REC-02 | recep, coord, cheq | P1 | Module prioritaire |
| Réception | Liste des affiches | ECR-REC-03 | recep, coord, cheq, com (lecture) | P1 | idem |
| Réception | Réceptions inconnues | ECR-REC-04 | coord, recep | P1 | idem |
| Réception | Modales : fiche affiche, fiche réception, photo, réception inconnue, aperçu feuilles, ranger, BL, visuel | ECR-REC-05 à ECR-REC-12 | recep, coord | P1 | idem |
| Pré-production | Validation admin et Instruction OK | ECR-COO-01 (+ COO-02 à COO-04) | coord, admin | P1 | Module prioritaire |
| Pré-production | Vérification des thèmes (Thèmes proches, Annonceurs proches, Thèmes modifiés dans Broadcast) | ECR-THM-01, ECR-THM-02, ECR-THM-03 | coord, admin | P2 | THM-03 « Reprendre la version BC » écrit vers Réception (tag « Feuille à refaire » de ECR-REC-03, alerte THEME_MODIF : §0.1) ; ECR-COO-02 renvoie vers `themes?dossier` ; alertes THEMES_PROCHES / ANNONCEURS_PROCHES / THEME_BC du catalogue (§0.3, §0.4) ; EX-REC-504, EX-THM-501 à EX-THM-504. Rattachement COO ou module à part : Q-366 |
| Déroulant | Suivi de prod | ECR-PIL-02 (`pour=deroulant`) | cheq | P3 | idem Pilotage |
| Déroulant | Liste des instructions | ECR-COO-01 (`pour=deroulant`) | coord | P1 | Même écran que Validation admin |
| Déroulant | Liste des trains, Suivi par thème, Préparation, Suivi 8 m² (demies) | ECR-COO-05, 06, 07, 08 | cheq, coord | P1 | Module prioritaire |
| Déroulant | Fichiers Vendôme | ECR-GEN-01, ECR-GEN-02, ECR-GEN-03 | cheq | P2 | Lien « Générer les fichiers » de ECR-COO-05/07/09 ; GEN-03 « Envoyer à la machine » fait passer les unités à EN_PROD (point de non-retour) et consomme les unités PRET produites par REC (réception) / COO (§0.1, §0.3, §0.4) ; limite 20 tiroirs |
| Déroulant | Bagues | ECR-COO-11 | cheq | P1 | Module prioritaire |
| Déroulant | Dispatch | ECR-COO-10 | cheq | P1 | Module prioritaire |
| 2 m² fixe | Suivi de prod | ECR-PIL-02 (`pour=fixe`) | cheq | P3 | Consommateur |
| 2 m² fixe | Préparation (par atelier ; badge « arrivés après libération ») | ECR-COO-09 (`type=fixe`) | cheq, coord | P1 | Module prioritaire |
| 2 m² fixe | Fichiers multi-rouleuse | ECR-GEN-02, ECR-GEN-03 | cheq | P2 | idem Vendôme |
| Pliage | Suivi de prod / Préparation | ECR-PIL-02 / ECR-COO-09 | cheq, coord | P3 / P1 | idem |
| Bus | Suivi de prod / Préparation par centre | ECR-PIL-02 / ECR-COO-09 | cheq, coord | P3 / P1 | idem ; flux Bus : Q-386 |
| Expédition | Scan et colisage | ECR-EXP-01 | expe, cheq | P2 | Consomme les unités « Produit » ; boucle Réception -> Stock -> Expédition (§0.2) : transitions finales COLISE / EXPEDIE |
| Expédition | Colis (dont « Fin de journée Geodis ») | ECR-EXP-02 | expe, cheq | P2 | Sorties de stock automatiques `Expédition C-…` qui diminuent le disponible des affiches reçues (§0.2) ; transition EXPEDIE / LIVRE |
| Expédition | Départs camions | ECR-EXP-03 | expe, cheq | P3 | Lecture seule |
| Stocks | Stock par affiche | ECR-STK-01 | recep, cheq, expe | P2 | Consomme affiche reçue / mouvement `Réception` ; rebut saisi aussi ici (§0.1) ; stock = somme des mouvements |
| Stocks | Mouvements | ECR-STK-02 | recep, cheq, expe | P2 | Journal des mouvements créés par la réception (§0.1) |
| Stocks | Fin de campagne | ECR-STK-03 | recep, cheq, coord | P2 (à confirmer) | Reprend l'« État de destruction » de l'existant, écran du périmètre legacy Réception (legacy-reception.md) ; rôle `coord` autorisé (§0.4) ; Q-385 |
| Administration | Sites, ateliers et gammes | ECR-ADM-01 | admin | P2 | Sites/ateliers = périmètre et filtres de tous les écrans P1 (EX-TRA-006) |
| Administration | Machines et fichiers | ECR-ADM-02 | admin | P2 | Critères d'ordonnancement et machines lus par GEN et COO (§0.4) |
| Administration | Statuts (catalogue et correspondance) | ECR-ADM-03 | admin | P2 (données) / P3 (écran) | Catalogue des statuts de la réception, statuts « N » à ajouter ; correspondance `tr_statut` -> cible (§0.2, §0.4 ; Q-004) |
| Administration | Alertes et mails | ECR-ADM-04 | admin | P2 | Règles d'alerte de la réception, listes de distribution (§0.2, §0.3) |
| Administration | Règles métier | ECR-ADM-05 | admin | P2 | Paramètres lus par REC (écart 10 %, purge 4 sem., délai de contrôle 24 h, comptage par morceau 30, exemplaires 2, allée inconnues X) et COO (entretien, positions, tiroirs, Instruction OK auto, CC 15 %, similarité 0,85) (§0.2, §0.4) |
| Administration | Transport | ECR-ADM-06 | admin | P2 (données) / P3 (écran) | Destinataires, boucles et horaires = grain des colis/départs (§0.4 ADM-01/02) |
| Administration | Référentiels | ECR-ADM-07 | admin | P2 | Imprimeurs, livreurs, contrôleurs proposés à la saisie d'une réception (§0.2) ; destinataires et afficheurs |
| Administration | Journal | ECR-ADM-08 | admin | P2 | Journalisation des actions (EX-TRA-034) ; journal « Purge automatique » (§0.1) |
| Administration (existant, sans écran cible) | Utilisateurs / périmètre / droits (« Utilisateur Admin ») | aucun ECR (« phase 4 ») | admin | P2 | Authentification et droits exigés par P1 (EX-TRA-001) ; socle étape 4, écran étape 8 |
| Administration (existant, sans écran cible) | Plateforme, Plateforme Mail, Poste de travail, Informations configuration, Liste des transporteurs / adresses / rouleurs, Admin Equipe, Admin Machine, Déblocage préparations, Préparations débloquées, Rafraichir un dossier, Dupliquer train | aucun ECR | admin, coord | P2 / P3 à arbitrer | Fonctions legacy à ne pas perdre (MISSION §12.6) ; correspondance cible non explicite (EX-TRA-012 ; Q-382) |
| Menu actuel sans écran cible | Zone picking, Fusion des affiches, Analyse Production, État de destruction, Expedition ext | aucun ECR (sauf destruction -> ECR-STK-03) | recep, cheq, expe | P3 à arbitrer | EX-TRA-012 ; Q-382 |
| Aide | Parcours guidés, Traçabilité des besoins | ECR-AID-01, ECR-AID-02 | tous | P3 | Propres à la maquette, hors cible ; AID-01 = scénarios de recette E2E (parcours 2, 3 Réception ; 4 Coordination ; 9 Expédition-Stock) |
| Coque | Bandeaux, onglets, site, rôle, cloche, mails | ECR-NAV-01 | tous | P1 (socle) | Cadre commun de tous les écrans P1 (EX-TRA-008 à EX-TRA-013) |
| Coque | Aperçu navigation V1.2 | ECR-NAV-02 | — | P3 | Obsolète ; utile seulement pour la correspondance menu actuel -> écran cible |

### 3.2 Liste complète des écrans ECR (56)

| ECR | Titre | Module | Priorité |
|---|---|---|---|
| ECR-REC-01 | Réception des affiches, étape 1 : arrivée de la palette | REC | P1 |
| ECR-REC-02 | Réception des affiches, étape 2 : contrôle des affiches (sas + contrôle de palette) | REC | P1 |
| ECR-REC-03 | Liste des affiches | REC | P1 |
| ECR-REC-04 | Réceptions inconnues | REC | P1 |
| ECR-REC-05 | Fiche affiche (modale, 4 onglets) | REC | P1 |
| ECR-REC-06 | Fiche réception (modale) | REC | P1 |
| ECR-REC-07 | Modale Photo du BL / Photo d'une affiche | REC | P1 |
| ECR-REC-08 | Modale Réception inconnue (création) | REC | P1 |
| ECR-REC-09 | Aperçu avant impression des feuilles de stock (modale) | REC | P1 |
| ECR-REC-10 | Modale Ranger avant d'imprimer | REC | P1 |
| ECR-REC-11 | Modale BL · réception (voir le BL) | REC | P1 |
| ECR-REC-12 | Modale Visuel (commune à tous les écrans) | REC | P1 |
| ECR-COO-01 | Validation admin et Instruction OK (aussi Liste des instructions du Déroulant) | COO | P1 |
| ECR-COO-02 | Fiche dossier (modale) | COO | P1 |
| ECR-COO-03 | Modale Confirmer aussi les affiches à doute ? | COO | P1 |
| ECR-COO-04 | Modale Demander une correction à Broadcast | COO | P1 |
| ECR-COO-05 | Liste des trains | COO | P1 |
| ECR-COO-06 | Suivi par thème (vue besoin) | COO | P1 |
| ECR-COO-07 | Préparation (vue prepa) | COO | P1 |
| ECR-COO-08 | Suivi 8 m² (demies) | COO | P1 |
| ECR-COO-09 | Préparation 2 m² fixe / Pliage / Bus (écran unitaire) | COO | P1 |
| ECR-COO-10 | Dispatch du roulage | COO | P1 |
| ECR-COO-11 | Bagues et étiquettes | COO | P1 |
| ECR-TRA-01 | Alertes | TRA | P1 (transverse) |
| ECR-NAV-01 | Coque : bandeaux, onglets, menus | NAV | P1 (socle) |
| ECR-NAV-02 | Aperçu navigation haut (V1.2, obsolète) | NAV | P3 |
| ECR-PIL-01 | Dashboard (Pilotage › Suivi de prod) | PIL | P3 |
| ECR-PIL-02 | Suivi de prod d'un atelier | PIL | P3 |
| ECR-PIL-03 | État des réservations vivant | PIL | P2 |
| ECR-PIL-04 | Fiche dossier (tiroir partagé) | PIL | P2 |
| ECR-THM-01 | Thèmes proches entre dossiers | THM | P2 |
| ECR-THM-02 | Annonceurs proches | THM | P2 |
| ECR-THM-03 | Thèmes modifiés dans Broadcast | THM | P2 |
| ECR-STK-01 | Stock par affiche | STK | P2 |
| ECR-STK-02 | Mouvements de stock | STK | P2 |
| ECR-STK-03 | Fin de campagne | STK | P2 (à confirmer) |
| ECR-EXP-01 | Scan et colisage | EXP | P2 |
| ECR-EXP-02 | Colis (dont Fin de journée Geodis) | EXP | P2 |
| ECR-EXP-03 | Départs camions | EXP | P3 |
| ECR-GEN-01 | Fichiers Vendôme : choix des trains | GEN | P2 |
| ECR-GEN-02 | Fichiers multi-rouleuse : source et règles | GEN | P2 |
| ECR-GEN-03 | Bilan de génération et envoi à la machine (+ historique) | GEN | P2 |
| ECR-ADM-01 | Sites, ateliers et gammes | ADM | P2 |
| ECR-ADM-02 | Machines et fichiers | ADM | P2 |
| ECR-ADM-03 | Statuts (catalogue et correspondance) | ADM | P2 / P3 |
| ECR-ADM-04 | Alertes et mails | ADM | P2 |
| ECR-ADM-05 | Règles métier | ADM | P2 |
| ECR-ADM-06 | Transport | ADM | P2 / P3 |
| ECR-ADM-07 | Référentiels | ADM | P2 |
| ECR-ADM-08 | Journal | ADM | P2 |
| ECR-AID-01 | Parcours guidés | AID | P3 |
| ECR-AID-02 | Traçabilité des besoins | AID | P3 |

Les ECR-COO-05 à ECR-COO-11 comportent des sous-écrans/modales (fiche train 05a, export 05b, pré-test 05c, raccrocher 05d, supprimer 05e, bagues 11a/11c) décrits par l'agent COO.

### 3.3 Liens de navigation entre P1 et les écrans P2 / P3 (maquettes-autres-modules.md §0.5 et §B)

| Source | Lien / action | Cible | Nature |
|---|---|---|---|
| Logo (toutes pages) | clic | ECR-PIL-01 | P1 -> P3 (écran d'ouverture) |
| ECR-NAV-01 (cloche) | clic | ECR-TRA-01 | P1 |
| ECR-PIL-01 | tuiles « Reste à recevoir » / « En attente » | ECR-PIL-03 (`?ou=AFFICHES,PARTIEL`) | P3 -> P2 |
| ECR-PIL-01/02/03 | clic ligne (si 1 dossier) | ECR-PIL-04 | P3/P2 -> P2 |
| ECR-PIL-04 | « Voir dans Instructions » | ECR-COO-01 (`?q=`) | P2 -> P1 |
| ECR-PIL-04 | « Voir les affiches » | ECR-REC-03 (`?tab=affiches&q=`) | P2 -> P1 |
| ECR-TRA-01 | Ouvrir | ECR-PIL-03, ECR-REC-03, ECR-REC-04, ECR-REC-02, ECR-COO-01, ECR-THM-0x, ECR-COO-05, ECR-COO-09 | P1 -> P1/P2 |
| ECR-TRA-01 | Règles et destinataires | ECR-ADM-04 | P1 -> P2 |
| ECR-COO-02 | Vérifier les thèmes | ECR-THM-01 (`?dossier`) | P1 -> P2 |
| ECR-THM-01 / 02 | Ouvrir le dossier | ECR-COO-01 (`?statut=TOUS&q=`) | P2 -> P1 |
| ECR-THM-03 | Voir le dossier | ECR-PIL-03 (`?dossier=`) | P2 -> P2 |
| ECR-THM-03 | Reprendre la version BC | tag « Feuille à refaire » de ECR-REC-03 | P2 -> P1 (écriture) |
| ECR-COO-05 / 07 / 09 | Fichiers Vendôme / Générer les fichiers | ECR-GEN-01 / ECR-GEN-02 (pré-sélection) | P1 -> P2 |
| ECR-GEN-03 | Envoyer à la machine | unités EN_PROD (lues par ECR-PIL, ECR-EXP) | P2 -> P1 (statut) |
| ECR-EXP-01 | Clore le colis | ECR-EXP-02 | P2 |
| ECR-EXP-02 | Fin de journée Geodis | mouvements de ECR-STK-02 ; unités EXPEDIE | P2 -> P1 (stock, statuts) |
| ECR-STK-01 | Mettre au rebut | mouvement visible dans ECR-STK-02 et ECR-REC-03 | P2 |
| ECR-ADM-0x | paramètres | lus par REC (ADM-05, 07, 04), COO (ADM-01, 02, 05), THM (seuil 0,85), STK-03 | P2 -> P1 |
| Toute page ouverte par un lien | Retour | pile « ← Retour : page » (20 entrées) | transverse (EX-TRA-013) |

Le graphe détaillé du périmètre Réception / Coordination est dans tra-fonc-5-navigation.md.

## 4. Parcours
Pour chaque parcours (REC-Pxx, COO-Pxx) : acteur, déclencheur, étapes, écrans (ECR), règles (RG), résultat, cas d'erreur. Les identifiants et le périmètre RG de chaque parcours sont ceux du PLAN_IMPLEMENTATION.md (§2 et §3) ; un parcours = une session d'implémentation. Les 6 profils sont provisoires (Q-003).

### 4.0 Vue d'ensemble des parcours
| Parcours | Titre | Module | Nb RG | Écrans | Dépend de | Démarrable ? |
|---|---|---|---|---|---|---|
| REC-P01 | Socle Réception : entités, droits, traçabilité, historique, concurrence | Réception | 16 | — | — (après étapes 2-4) | PARTIEL |
| REC-P02 | Réceptions attendues : recherche, filtres, reçu / attendu / reste, statut de ligne | Réception | 16 | ECR-REC-01 | REC-P01 ; D-10 (lignes attendues : JDD tant que l'alimentation COO-P05 n'est pas faite) | PARTIEL |
| REC-P03 | Panier et saisie du bon de livraison : photo, lecture du BL, contrôles de saisie | Réception | 17 | ECR-REC-01, ECR-REC-07, ECR-REC-11, ECR-REC-12 | REC-P02 | OUI |
| REC-P04 | Valider la réception : création de la réception « À contrôler », affiches, mouvements | Réception | 13 | ECR-REC-01, ECR-REC-02 | REC-P03 | OUI |
| REC-P05 | Sas et contrôle de la palette : comptage, écarts, rebut, emplacement, validation du contrôle | Réception | 24 | ECR-REC-02, ECR-REC-06 | REC-P04 | OUI |
| REC-P06 | Feuille de stock (étiquette rack) et impressions | Réception | 19 | ECR-REC-09, ECR-REC-10, ECR-REC-03 | REC-P05 | PARTIEL |
| REC-P07 | Réceptions inconnues : création, identification, rattachement, signalement | Réception | 30 | ECR-REC-08, ECR-REC-04 | REC-P05, REC-P06 (feuille temporaire) | OUI |
| REC-P08 | Liste des affiches et fiche de l'affiche : filtres, tags, rattachements, thème, conservation | Réception | 26 | ECR-REC-03, ECR-REC-05, ECR-REC-06 | REC-P05 | OUI |
| REC-P09 | Rebut, mouvements manuels de stock et fonctions legacy sans écran cible | Réception | 15 | ECR-STK-01, ECR-STK-03, ECR-REC-03 | REC-P08 ; D-13 (stock, étape 8) | OUI |
| REC-P10 | Alertes Réception, paramètres, référentiels, dashboard et interfaces de retour | Réception | 15 | ECR-TRA-01, ECR-ADM-04, ECR-ADM-05, ECR-ADM-07 | REC-P05, REC-P07 ; D-06, D-08 | PARTIEL |
| COO-P01 | Socle Coordination : droits, périmètre, statuts d'instruction, intégration, historique | Coordination | 14 | ECR-COO-01 | REC-P01 | PARTIEL |
| COO-P02 | Liste des instructions et Instruction OK (automatique, manuelle), écart Broadcast, correction | Coordination | 19 | ECR-COO-01, ECR-COO-02, ECR-COO-04 | COO-P01 | PARTIEL |
| COO-P03 | Validation admin : proposition de rattachement, cas sûrs, affiches à doute | Coordination | 12 | ECR-COO-01, ECR-COO-03 | COO-P01, REC-P04 | OUI |
| COO-P04 | Validation admin : confirmer, valider en lot, annuler, effets et traçabilité | Coordination | 18 | ECR-COO-01, ECR-COO-02, ECR-REC-04, ECR-REC-05 | COO-P03, REC-P07, REC-P08 | PARTIEL |
| COO-P05 | Lignes attendues : règles de vie, rapprochement, provisoire, annulation, sources | Coordination | 23 | ECR-PIL-03 | COO-P01, REC-P02 ; D-10 | PARTIEL |
| COO-P06 | Intégration Broadcast : copie de l'état des réservations et flux | Coordination | 25 | — | COO-P05, COO-P02 ; D-10, D-16 | PARTIEL |
| COO-P07 | Alertes Pré-Prod et vérification des thèmes | Coordination | 12 | ECR-TRA-01, ECR-COO-02 | COO-P06, COO-P04 ; D-08, D-12 | OUI |
| COO-P08 | Déblocage des préparations et « Rendre la main » | Coordination | 16 | ECR-COO-09 | COO-P06 | OUI |
| COO-P09 | Trains : identifiant, positions, faces, couverture, fractionnement, liste (ECR-COO-05) | Coordination | 24 | ECR-COO-05 | COO-P02 ; D-02, D-06 | OUI |
| COO-P10 | Export des trains et préparation du déroulant (suivi par thème, rouleur) | Coordination | 14 | ECR-COO-05, ECR-COO-06, ECR-COO-07, ECR-GEN-01 | COO-P09 ; D-15 | OUI |
| COO-P11 | Roulage : suivi 8 m², dispatch des rouleurs, bagues et étiquettes | Coordination | 15 | ECR-COO-08, ECR-COO-10, ECR-COO-11 | COO-P10 ; D-05, D-18 | PARTIEL |
| COO-P12 | Préparation 2 m² fixe, pliage et bus : libération, rendre la main, comptage, quantités à encoller | Coordination | 19 | ECR-COO-09 | COO-P06, COO-P09 | PARTIEL |
| COO-P13 | Unités de manutention, colis, expédition et intégration AMT | Coordination | 18 | ECR-EXP-01, ECR-EXP-02 | COO-P12 ; D-14 | PARTIEL |

Légende « Démarrable ? » : OUI = démarrable dès que les prérequis du plan (étapes 2 à 4 et dépendances) sont faits ; PARTIEL = démarre, mais certaines règles attendent une question BLOQUANTE ; « OUI après étape 3 » = exige que les questions de modélisation (Q-300, Q-306, Q-307) soient tranchées ou prises en HYPOTHÈSE validée avant la migration Prisma.

### 4.1 Parcours nominaux et alternatifs : où les trouver
| Scénario | Type | Parcours (fiche) | RG clés |
|---|---|---|---|
| Réception d'un BL connu : panier, validation, contrôle, feuille définitive | Nominal | REC-P02, REC-P03, REC-P04, REC-P05, REC-P06 | RG-REC-038, RG-REC-069, RG-REC-084 |
| Rejet à la validation de la réception (photo du BL absente, plateformes mélangées, n° de BL déjà utilisé) | Alternatif / rejet | REC-P03, REC-P04 | RG-REC-026, RG-REC-024, RG-REC-036, RG-REC-037 |
| Réception inconnue : création, feuille temporaire, identification, rattachement | Alternatif | REC-P07 puis REC-P05 | RG-REC-095, RG-REC-109, RG-REC-072 |
| Dossier introuvable : signalement, alerte à la Coordination | Alternatif | REC-P07, COO-P07 | RG-REC-112, RG-X-054, RG-COO-072 |
| Reprise d'une réception inconnue rattachée : contrôle puis feuille définitive | Reprise | REC-P07, REC-P05, REC-P06 | RG-REC-072, RG-REC-084 |
| Réception partielle puis complément | Alternatif | REC-P04, REC-P02 | RG-REC-040, RG-REC-050, RG-X-061 |
| Surplus > 10 % et surplus en entretien | Alternatif | REC-P04, REC-P05 | RG-REC-051, RG-REC-066 |
| Écart de comptage > 10 % au contrôle | Alternatif | REC-P05, REC-P10 | RG-REC-058, RG-REC-183, RG-X-017 |
| Échec d'impression, agent local indisponible | Exception | REC-P06 | RG-REC-092, Q-002 |
| Changement de thème après réception : feuille à refaire, validation à refaire | Alternatif | REC-P08, COO-P04 | RG-REC-135, RG-COO-030, RG-X-012, RG-X-057 |
| Retrait du dernier dossier d'une affiche : retour à réception inconnue | Alternatif | REC-P07, REC-P08, COO-P04 | RG-REC-114, RG-X-058 |
| Affiche à doute : confirmation explicite | Alternatif | COO-P03, COO-P04 | RG-COO-006, RG-COO-012, RG-X-053 |
| Validation admin en lot des cas sûrs | Nominal | COO-P03, COO-P04 | RG-COO-005, RG-COO-010, RG-COO-011 |
| Annulation de la validation admin | Annulation | COO-P04 | RG-COO-014, RG-X-050 |
| Instruction OK automatique ou manuelle | Nominal / alternatif | COO-P02 | RG-COO-042, RG-COO-044, Q-204 |
| Renvoi de prépa par Broadcast avant ou après l'export | Alternatif | COO-P02, COO-P06 | RG-COO-053, RG-COO-054, RG-COO-122, RG-X-078 |
| Écart Broadcast / Circé : appliquer la version Broadcast ou demander une correction | Alternatif | COO-P02, COO-P07 | RG-COO-055, RG-COO-056, RG-COO-057 |
| Annulation d'un dossier ou d'une instruction | Annulation | COO-P01 | RG-COO-045, RG-COO-062, RG-X-065 |
| Calcul et export des trains, pré-test, fractionnement, dernière minute | Nominal / alternatif | COO-P09, COO-P10 | RG-COO-210, RG-COO-221, RG-COO-223, RG-X-077 |
| Libération de la semaine fixe/pliage/bus, dossier arrivé après libération | Nominal / alternatif | COO-P12 | RG-COO-240, RG-COO-242, RG-X-076 |
| Déblocage d'une préparation / « Rendre la main » | Alternatif | COO-P08, COO-P12 | RG-COO-143, RG-COO-145, RG-COO-243 |
| Roulage : dispatch, bagues, réimpression | Nominal / alternatif | COO-P11 | RG-COO-294, RG-COO-299, RG-COO-301 |
| Colisage et expédition, fin de journée | Nominal | COO-P13 | RG-COO-265, RG-COO-269, RG-X-087 |

### REC-P01 — Socle Réception : entités, droits, traçabilité, historique, concurrence
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P01) ; dépend de : — (après étapes 2-4)
- Acteur(s) : Tous profils (coord, cheq, recep, expe, admin, com) ; traitement transverse sans écran dédié.
- Déclencheur : Toute action de lecture ou d'écriture du module Réception (aucun écran propre : ce parcours est le socle des suivants).
- Écrans : aucun écran propre (socle ou traitement système)
- Étapes :
  1. Résoudre l'utilisateur, son rôle et son périmètre plateforme/site (RG-REC-001, RG-REC-002).
  2. Contrôler l'autorisation de l'action dans le service, jamais seulement dans la route ni le front (RG-REC-002, RG-REC-003).
  3. Écrire chaque action avec auteur et date, dans une transaction unique avec l'historique d'affiche et le journal d'événements (RG-REC-004, RG-REC-005, RG-REC-006, RG-REC-007).
  4. Rejeter les doubles soumissions par `Idempotency-Key` et les conflits de version par verrou optimiste (RG-REC-008, RG-REC-009).
  5. Calculer le reçu comme somme des rattachements actifs et le stock comme somme des mouvements append-only (RG-REC-043, RG-REC-049, RG-REC-151, RG-REC-153, RG-REC-176).
- Règles (16 RG, + 2 RG-X) : RG-REC-001, RG-REC-002, RG-REC-003, RG-REC-004, RG-REC-005, RG-REC-006, RG-REC-007, RG-REC-008, RG-REC-009, RG-REC-043, RG-REC-049, RG-REC-074, RG-REC-151, RG-REC-153, RG-REC-154, RG-REC-176, RG-X-016, RG-X-060
- Résultat : Entités, statuts, machines d'états et règles transverses de la Réception disponibles et testées ; aucun écran.
- Cas d'erreur / exceptions / variantes :
  - Rôle non autorisé : 403 (RG-REC-002) ; hors périmètre site : 404/403 (RG-REC-001).
  - Double soumission : réponse rejouée sans seconde écriture (RG-REC-008). Version périmée : 409 (RG-REC-009).
  - Suppression ou annulation d'une réception : refusée, aucune route (RG-REC-074).
  - Alternatif : lecture par `com` (lecture seule, RG-COO-168 côté Coordination).
- Questions liées : **Q-001** (BLOQUANTE), Q-003, **Q-004** (BLOQUANTE), Q-103, Q-122, Q-123, Q-136, Q-137, Q-147, Q-208
- Questions BLOQUANTES et démarrage : Q-001, Q-004, Q-300, Q-306, Q-307, Q-319 — PARTIEL : démarrable une fois Q-300 (statut affiche persisté/calculé), Q-306 (lien n-n avec quantité) et Q-307 (entité Réception) tranchées ou prises en HYPOTHÈSE VALIDÉE avant l'étape 3 ; RG-REC-001 et RG-REC-004 (identité réelle de l'utilisateur) attendent Q-001 (étape 4) ; RG-REC-005/006 attendent le mapping Q-004 pour les codes d'action historisés.

### REC-P02 — Réceptions attendues : recherche, filtres, reçu / attendu / reste, statut de ligne
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P02) ; dépend de : REC-P01 ; D-10 (lignes attendues : JDD tant que l'alimentation COO-P05 n'est pas faite)
- Acteur(s) : recep (agent de réception), coord, cheq ; com en lecture.
- Déclencheur : Ouverture du menu Réception > Réception des affiches (vue attendues) ou arrivée d'un BL à rapprocher.
- Écrans : ECR-REC-01
- Étapes :
  1. Ouvrir la vue ; périmètre site de l'utilisateur ; période et Départ par défaut (RG-REC-015, RG-REC-016).
  2. Trouver les lignes du BL : par n° de BL, par visuel photographié ou à la main ; recherche à la frappe sur n° de dossier, DA, annonceur (RG-REC-011, RG-REC-012, RG-REC-013).
  3. Lire pour chaque ligne attendue : Reçu, Attendu, Reste, statut, Contrôle, Livraison prévue (RG-REC-014, RG-REC-017, RG-REC-018, RG-REC-019, RG-REC-020, RG-REC-197).
  4. Rattachement initial de l'affiche à la ligne choisie (RG-REC-042) ; affiche livrée après purge de sa ligne (RG-REC-052).
  5. Purge automatique des attendues à 4 semaines, sans alerte, une ligne au journal (RG-REC-180, RG-REC-181).
- Règles (16 RG) : RG-REC-010, RG-REC-011, RG-REC-012, RG-REC-013, RG-REC-014, RG-REC-015, RG-REC-016, RG-REC-017, RG-REC-018, RG-REC-019, RG-REC-020, RG-REC-042, RG-REC-052, RG-REC-180, RG-REC-181, RG-REC-197
- Résultat : Liste filtrée et triée des lignes attendues avec statuts calculés ; ligne sélectionnable vers le panier (REC-P03).
- Cas d'erreur / exceptions / variantes :
  - Aucune ligne pour le filtre : état vide avec message de la maquette.
  - Dossier introuvable ou BL sans correspondance : bascule vers la réception inconnue (REC-P07).
  - Ligne purgée mais affiche livrée : affiche acceptée, rattachement manuel possible (RG-REC-052).
  - Surplus au-delà de 10 % : statut Surplus (RG-REC-018), voir REC-P04.
- Questions liées : Q-100, Q-101, Q-103, Q-105, Q-112, Q-123, Q-130, Q-133, Q-134, Q-135, Q-138, Q-139, Q-147, Q-150, Q-165
- Questions BLOQUANTES et démarrage : Q-005, Q-300, Q-319 — PARTIEL : écran et calculs démarrables sur jeu de données ; Q-300 (statut de ligne calculé ou persisté) à trancher avant l'étape 3 ; Q-005 (qui alimente les attendues, à quelle fréquence) bloque l'alimentation réelle et la planification de la purge (RG-REC-180) ; Q-319 pour les sites/départs de référence.

### REC-P03 — Panier et saisie du bon de livraison : photo, lecture du BL, contrôles de saisie
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P03) ; dépend de : REC-P02
- Acteur(s) : recep, coord.
- Déclencheur : Un BL arrive : l'agent coche des lignes attendues ou photographie le BL / l'affiche.
- Écrans : ECR-REC-01, ECR-REC-07, ECR-REC-11, ECR-REC-12
- Étapes :
  1. Cocher des lignes ou photographier ; mettre au panier ; le panier ne contient que des lignes d'un seul BL et d'une seule plateforme (RG-REC-021, RG-REC-022, RG-REC-024, RG-REC-025).
  2. Joindre la photo du BL (obligatoire) et les pièces ; consulter le BL (RG-REC-026, RG-REC-027).
  3. Lecture du BL et pré-remplissage ; contrat illisible : candidats ; ligne cochée absente du BL (RG-REC-028, RG-REC-029, RG-REC-030) ; reconnaissance du visuel photographié (RG-REC-031).
  4. Mémoriser le mode de rattachement BL / visuel / à la main (RG-REC-032).
  5. Saisir le formulaire BL : champs obligatoires, date de livraison, listes fermées imprimeur/transporteur/agent, quantité du BL par ligne, unicité du n° de BL (RG-REC-023, RG-REC-033, RG-REC-034, RG-REC-035, RG-REC-036).
  6. Ouvrir la modale visuel depuis tout écran (RG-REC-203).
- Règles (17 RG) : RG-REC-021, RG-REC-022, RG-REC-023, RG-REC-024, RG-REC-025, RG-REC-026, RG-REC-027, RG-REC-028, RG-REC-029, RG-REC-030, RG-REC-031, RG-REC-032, RG-REC-033, RG-REC-034, RG-REC-035, RG-REC-036, RG-REC-203
- Résultat : Panier valide prêt à être validé (REC-P04) ; photo du BL stockée.
- Cas d'erreur / exceptions / variantes :
  - Photo du BL absente : refus (RG-REC-026). N° de BL déjà utilisé : refus (RG-REC-036).
  - Panier mêlant deux plateformes : refus (RG-REC-024) ; dossier livré sur deux plateformes : suffixe « -W » (RG-REC-025, RG-X-019).
  - Lecture du BL en échec : saisie manuelle (alternatif, RG-REC-028, RG-REC-029).
  - Liste fermée : valeur hors référentiel refusée (RG-REC-035, D-04).
- Questions liées : Q-102, Q-112, Q-113, Q-114, Q-115, Q-116, Q-121, Q-125, Q-139, Q-160, Q-163, Q-166, Q-167
- Questions BLOQUANTES et démarrage : Q-306, Q-307 — OUI après étape 3 (Q-306 et Q-307 doivent être tranchées pour modéliser le rattachement et la réception ; aucune autre BLOQUANTE). La lecture automatique du BL (RG-REC-028/029) est une option derrière l'interface LlmProvider, non bloquante.

### REC-P04 — Valider la réception : création de la réception « À contrôler », affiches, mouvements
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P04) ; dépend de : REC-P03
- Acteur(s) : recep ; coord (hypothèse Q-136).
- Déclencheur : Clic sur « Valider la réception » avec au moins une ligne cochée.
- Écrans : ECR-REC-01, ECR-REC-02
- Étapes :
  1. Contrôler dans l'ordre les refus (photo du BL, plateforme, quantité, champs, listes) (RG-REC-037).
  2. Créer en une transaction la réception A_CONTROLER, les affiches et les mouvements « Réception » (RG-REC-038, RG-REC-039, RG-REC-041, RG-REC-046).
  3. Rattacher les affiches aux lignes attendues avec leur quantité ; « Affiche reçue » = oui dès l'arrivée de la palette (RG-REC-044, RG-X-005).
  4. Compléter une affiche déjà reçue en partie (tag Complément), gérer réception partielle et surplus > 10 % (RG-REC-040, RG-REC-050, RG-REC-051).
  5. Réception sans IP : intitulé saisi ; règle du 1er qui a parlé pour l'intitulé de thème (RG-REC-047, RG-REC-048).
  6. Vider les champs de saisie, conserver ceux prévus ; la palette entre dans le sas (RG-REC-045) ; IP reçues après le 1er fichier de production (RG-REC-198).
- Règles (13 RG, + 1 RG-X) : RG-REC-037, RG-REC-038, RG-REC-039, RG-REC-040, RG-REC-041, RG-REC-044, RG-REC-045, RG-REC-046, RG-REC-047, RG-REC-048, RG-REC-050, RG-REC-051, RG-REC-198, RG-X-005
- Résultat : Réception A_CONTROLER visible dans le sas (REC-P05), stock par affiche = mouvements de réception, proposition de validation admin créée côté Coordination (RG-X-001, étape 7).
- Cas d'erreur / exceptions / variantes :
  - Un refus de la liste (RG-REC-037) : aucune écriture, message de la règle.
  - Échec en cours d'écriture : rollback complet (RG-REC-046). Double clic : idempotence (RG-REC-008).
  - Réception partielle : ligne Partielle, complément ultérieur (RG-REC-050, RG-REC-040).
  - Surplus > 10 % : ligne Surplus, entretien en surplus géré au contrôle (RG-REC-051, RG-REC-066).
- Questions liées : Q-102, Q-103, Q-104, Q-105, Q-111, Q-131, Q-141, Q-143, Q-168
- Questions BLOQUANTES et démarrage : Q-300, Q-306, Q-307 — OUI après étape 3 : transitions ∅ -> RECEPTION.A_CONTROLER et création d'affiche exigent l'entité Réception (Q-307), le statut d'affiche (Q-300) et le lien affiche-ligne avec quantité (Q-306).

### REC-P05 — Sas et contrôle de la palette : comptage, écarts, rebut, emplacement, validation du contrôle
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P05) ; dépend de : REC-P04
- Acteur(s) : recep (contrôleur : agent de réception du référentiel) ; coord en lecture ; cheq.
- Déclencheur : Clic sur une palette du sas (ou « Contrôler la palette » depuis la fiche affiche).
- Écrans : ECR-REC-02, ECR-REC-06
- Étapes :
  1. Lister les palettes A_CONTROLER, badge du menu, repérer les palettes en retard (RG-REC-053, RG-REC-054, RG-REC-055, RG-REC-189).
  2. Ouvrir le contrôle : une ligne par affiche ; saisir la quantité comptée (par morceau si besoin) (RG-REC-056, RG-REC-057, RG-REC-060).
  3. Calculer l'écart au BL (seuil 10 %), créer le mouvement « Contrôle (écart au BL) » (RG-REC-058, RG-REC-059, RG-REC-183).
  4. Saisir allée et rayon obligatoires, zone tampon et sortie, contrôleur obligatoire (RG-REC-061, RG-REC-062, RG-REC-063, RG-REC-067).
  5. Traiter rebut, non-conformité, surplus en entretien (RG-REC-064, RG-REC-065, RG-REC-066) ; corriger l'imprimeur d'une inconnue (RG-REC-068).
  6. Valider le contrôle : CONTROLEE, effets, lecture seule ensuite (RG-REC-069, RG-REC-070) ; corriger a posteriori les quantités du BL depuis la fiche réception (RG-REC-073).
- Règles (24 RG) : RG-REC-053, RG-REC-054, RG-REC-055, RG-REC-056, RG-REC-057, RG-REC-058, RG-REC-059, RG-REC-060, RG-REC-061, RG-REC-062, RG-REC-063, RG-REC-064, RG-REC-065, RG-REC-066, RG-REC-067, RG-REC-068, RG-REC-069, RG-REC-070, RG-REC-071, RG-REC-072, RG-REC-183, RG-REC-189, RG-REC-193, RG-REC-073
- Résultat : Réception CONTROLEE, stock réel posé, emplacement renseigné, feuille définitive à imprimer (REC-P06) ; écart > 10 % tracé et alerte (RG-X-017, étape 7).
- Cas d'erreur / exceptions / variantes :
  - Contrôleur ou allée/rayon manquants : refus (RG-REC-061, RG-REC-067).
  - Réception À identifier : non contrôlable, 409 (RG-REC-071) ; après rattachement : contrôle possible (RG-REC-072).
  - Écart > 10 % : alerte et justification (RG-REC-058) ; contrôle terminé : toute modification refusée (RG-REC-070).
  - Rebut au contrôle : mouvement de rebut, ECR-STK-01 en dépendance D-13 (RG-REC-064).
- Questions liées : Q-102, Q-105, Q-106, Q-118, Q-121, Q-133, Q-140, Q-141, Q-142, Q-145, Q-154, Q-157
- Questions BLOQUANTES et démarrage : Q-307 — OUI après étape 3 (Q-307 : statuts de la réception A_CONTROLER/CONTROLEE). Les impressions de feuilles définitives (RG-REC-084) sont traitées dans REC-P06.

### REC-P06 — Feuille de stock (étiquette rack) et impressions
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P06) ; dépend de : REC-P05
- Acteur(s) : recep, coord ; expe pour le picking.
- Déclencheur : Fin du contrôle (feuille définitive), création d'une réception inconnue (feuille temporaire) ou action « Imprimer / Réimprimer ».
- Écrans : ECR-REC-09, ECR-REC-10, ECR-REC-03
- Étapes :
  1. Construire la feuille : mention FEUILLE DE STOCK DÉFINITIVE / TEMPORAIRE, contenu, code-barres, quantité = somme des mouvements (RG-REC-076, RG-REC-077, RG-REC-078, RG-REC-079, RG-REC-080, RG-REC-081, RG-REC-082).
  2. Feuille temporaire à la création d'une inconnue, définitive au contrôle ou après rattachement (RG-REC-083, RG-REC-084).
  3. Noter le type de feuille imprimée, lever le tag « Feuille à refaire » (RG-REC-085, RG-REC-129).
  4. Imprimer en lot avec exemplaires, réimprimer, impressions multiples en un clic (RG-REC-086, RG-REC-087, RG-REC-090).
  5. « Ranger avant d'imprimer » si des affiches sont en zone tampon (RG-REC-088) ; étiquette rack à la validation admin (RG-REC-089).
  6. Choisir l'imprimante de plateforme ou la sortie PDF ; édition picking (RG-REC-091, RG-REC-093).
- Règles (19 RG) : RG-REC-076, RG-REC-077, RG-REC-078, RG-REC-079, RG-REC-080, RG-REC-081, RG-REC-082, RG-REC-083, RG-REC-084, RG-REC-085, RG-REC-086, RG-REC-087, RG-REC-088, RG-REC-089, RG-REC-090, RG-REC-091, RG-REC-092, RG-REC-093, RG-REC-129
- Résultat : Feuilles imprimées ou PDF produits, type de feuille historisé, tag levé.
- Cas d'erreur / exceptions / variantes :
  - Échec d'impression : non bloquant, message et possibilité de réimprimer (RG-REC-092).
  - Affiches encore en zone tampon : modale de rangement avant impression (RG-REC-088).
  - Agent local indisponible : repli sur PDF navigateur (Q-002).
  - Feuille à refaire après changement de thème ou de rattachement (RG-X-012, RG-REC-129).
- Questions liées : **Q-002** (BLOQUANTE), Q-101, Q-103, Q-126, Q-127, Q-128, Q-129, Q-143, Q-162, Q-168
- Questions BLOQUANTES et démarrage : Q-002 — PARTIEL : aperçu et PDF générés côté navigateur démarrables immédiatement (RG-REC-077, 078, 079, 080, 081, 082, 083, 084, 085, 086, 087, 088, 090, 093, 129) ; l'envoi vers l'imprimante de plateforme via l'agent local attend Q-002 (RG-REC-076, RG-REC-089, RG-REC-091, RG-REC-092) ; ECR-REC-09 en dépendance D-18.

### REC-P07 — Réceptions inconnues : création, identification, rattachement, signalement
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P07) ; dépend de : REC-P05, REC-P06 (feuille temporaire)
- Acteur(s) : recep (création, signalement) ; coord (rattachement qui vaut validation, RG-COO-017) ; admin.
- Déclencheur : Une palette est livrée sans BL exploitable ou sur un dossier inconnu (« Réception inconnue… ») ; la Coordination traite le tableau ECR-REC-04.
- Écrans : ECR-REC-08, ECR-REC-04
- Étapes :
  1. Créer la réception inconnue : quantité > 0, allée tampon et rayon, photos, suggestions d'intitulés de l'autre plateforme (RG-REC-095, RG-REC-096, RG-REC-097, RG-REC-098, RG-REC-100).
  2. Effets : affiche ORPHELINE, feuille TEMPORAIRE, alerte Coordination (RG-REC-099, RG-REC-083, RG-REC-185, RG-X-006).
  3. Lister dans ECR-REC-04 : statuts, filtre par défaut, « en attente depuis » (RG-REC-101, RG-REC-102, RG-REC-103, RG-REC-119).
  4. Identifier par le visuel ou par n° de dossier ; pré-cocher le dossier reconnu à coup sûr (RG-REC-104, RG-REC-105, RG-REC-106).
  5. Rattacher : refus, répartition <= quantité reçue, plusieurs dossiers, qui peut rattacher (RG-REC-107, RG-REC-108, RG-REC-118, RG-REC-120, RG-X-030).
  6. Effets du rattachement : palette dans le sas, annonceur et libellé, validation admin selon le rôle (RG-REC-109, RG-REC-110, RG-REC-111, RG-COO-017, RG-COO-018).
  7. Signaler « Dossier introuvable » (RG-REC-112, RG-REC-186) ; retirer le dernier dossier d'une affiche (RG-REC-114) ; distinguer inconnue et orpheline (RG-REC-113, RG-REC-115) ; legacy (RG-REC-116, RG-REC-117).
- Règles (30 RG, + 4 RG-X) : RG-REC-095, RG-REC-096, RG-REC-097, RG-REC-098, RG-REC-099, RG-REC-100, RG-REC-101, RG-REC-102, RG-REC-103, RG-REC-104, RG-REC-105, RG-REC-106, RG-REC-107, RG-REC-108, RG-REC-109, RG-REC-110, RG-REC-111, RG-REC-112, RG-REC-113, RG-REC-114, RG-REC-115, RG-REC-116, RG-REC-117, RG-REC-118, RG-REC-119, RG-REC-120, RG-REC-185, RG-REC-186, RG-COO-017, RG-COO-018, RG-X-007, RG-X-030, RG-X-051, RG-X-054
- Résultat : Réception A_CONTROLER rattachée à >= 1 dossier (reprise par REC-P05) ou INTROUVABLE avec alerte à la Coordination.
- Cas d'erreur / exceptions / variantes :
  - Aucun dossier ou quantité nulle : 422 « Choisissez au moins un dossier et une quantité. » ; répartition > quantité : 422 (RG-REC-107, RG-REC-108).
  - Rattachement par recep : validation admin non posée, A_CONFIRMER_DOUTE (RG-REC-111, RG-X-063).
  - Dossier introuvable : statut INTROUVABLE, un signalement répété met à jour la date (RG-REC-112, RG-X-054).
  - Retrait du dernier dossier : retour à À identifier (RG-REC-114, RG-X-058) ; transition interdite : 409.
- Questions liées : Q-105, Q-106, Q-107, Q-108, Q-109, Q-110, Q-112, Q-113, Q-124, Q-125, Q-163, Q-201, Q-221, Q-234
- Questions BLOQUANTES et démarrage : Q-300, Q-306, Q-307 — OUI après étape 3 : états RECEPTION.A_IDENTIFIER / INTROUVABLE / RATTACHEE (Q-307), affiche ORPHELINE (Q-300), répartition sur plusieurs dossiers (Q-306).

### REC-P08 — Liste des affiches et fiche de l'affiche : filtres, tags, rattachements, thème, conservation
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P08) ; dépend de : REC-P05
- Acteur(s) : coord, recep, cheq, admin ; com en lecture.
- Déclencheur : Ouverture du menu Liste des affiches ou clic sur un n° d'affiche (depuis ECR-REC-01, 03 ou une alerte).
- Écrans : ECR-REC-03, ECR-REC-05, ECR-REC-06
- Étapes :
  1. Lister avec colonnes et filtres, période par défaut, tags calculés jamais cochés, En stock et rebut en évidence (RG-REC-121, RG-REC-122, RG-REC-123, RG-REC-125, RG-REC-126, RG-REC-127, RG-REC-128, RG-REC-159).
  2. Ouvrir la fiche : champs modifiables, onglets Mouvements et Préparations, lien vers la réception (RG-REC-130, RG-REC-131, RG-REC-132, RG-REC-134).
  3. Changer de thème (purge des anciens thèmes, feuille à refaire) (RG-REC-135, RG-REC-150, RG-X-012).
  4. Rattacher à un autre dossier, retirer un rattachement, rattachement manuel après validation ou début de production (RG-REC-136, RG-REC-137, RG-REC-138, RG-X-013, RG-X-014, RG-X-052).
  5. Gérer la conservation (valeur par défaut, affiche à conserver) et la date de dernier départ (RG-REC-143, RG-REC-144, RG-REC-145).
  6. Règles legacy de rattachement et formats de saisie reprises ou remplacées (RG-REC-139, RG-REC-140, RG-REC-141, RG-REC-142, RG-REC-147, RG-REC-148, RG-X-062).
- Règles (26 RG, + 7 RG-X) : RG-REC-121, RG-REC-122, RG-REC-123, RG-REC-125, RG-REC-126, RG-REC-127, RG-REC-128, RG-REC-130, RG-REC-131, RG-REC-132, RG-REC-134, RG-REC-135, RG-REC-136, RG-REC-137, RG-REC-138, RG-REC-139, RG-REC-140, RG-REC-141, RG-REC-142, RG-REC-143, RG-REC-144, RG-REC-145, RG-REC-147, RG-REC-148, RG-REC-150, RG-REC-159, RG-X-013, RG-X-062, RG-X-063, RG-X-014, RG-X-015, RG-X-058, RG-X-052
- Résultat : Affiche consultée/corrigée, historique complet, stock et rattachements cohérents (reçu compté une fois, RG-X-016).
- Cas d'erreur / exceptions / variantes :
  - Fiche ouverte deux fois : aucune écriture (RG-X-062, suppression de l'auto-association legacy RG-REC-142).
  - Répartition > quantité reçue : 422 (RG-X-052) ; version périmée : 409 (RG-REC-009).
  - Affiche héritée « fusionnée » : lecture seule (RG-REC-169, REC-P09).
  - Alternatif : valider ou annuler la validation admin depuis la fiche (RG-X-015, COO-P04).
- Questions liées : Q-103, Q-107, Q-108, Q-118, Q-120, Q-124, Q-136, Q-143, Q-147, Q-148, Q-150, Q-162, Q-201, Q-202, Q-213, Q-214
- Questions BLOQUANTES et démarrage : Q-300, Q-306 — OUI après étape 3 (tags calculés selon Q-300, rattachements n-n selon Q-306). Aucune autre BLOQUANTE.

### REC-P09 — Rebut, mouvements manuels de stock et fonctions legacy sans écran cible
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P09) ; dépend de : REC-P08 ; D-13 (stock, étape 8)
- Acteur(s) : recep, cheq, coord ; admin.
- Déclencheur : Mise au rebut d'une affiche, sortie manuelle de stock, ou migration d'affiches héritées (flags legacy).
- Écrans : ECR-STK-01, ECR-STK-03, ECR-REC-03
- Étapes :
  1. Mettre au rebut depuis Stocks avec mouvement de rebut (RG-REC-156, RG-REC-157) ; vider le rebus legacy (RG-REC-158) ; tag « Au rebut » proposé (RG-REC-159 voir REC-P08).
  2. Ajouts et sorties manuels de stock legacy (RG-REC-155) ; état de destruction vers Stocks > Fin de campagne (RG-REC-160).
  3. Reprise des affiches héritées : fusionnées en lecture seule, fusion non reprise, zone picking (RG-REC-163, RG-REC-165, RG-REC-166, RG-REC-167, RG-REC-168, RG-REC-169).
  4. Listes legacy Tous / À traiter / Rebus / Fusionnées sans équivalent cible ; drill-down legacy ; éléments sans équivalent (RG-REC-124, RG-REC-170, RG-REC-171).
  5. Alerte « Validation admin » sans contrôle serveur : supprimée au profit du contrôle service (RG-REC-175).
- Règles (15 RG) : RG-REC-124, RG-REC-155, RG-REC-156, RG-REC-157, RG-REC-158, RG-REC-160, RG-REC-163, RG-REC-165, RG-REC-166, RG-REC-167, RG-REC-168, RG-REC-169, RG-REC-170, RG-REC-171, RG-REC-175
- Résultat : Stock correct (somme des mouvements) après rebut/sortie ; données héritées lisibles ; fonctions non reprises documentées.
- Cas d'erreur / exceptions / variantes :
  - Sortie supérieure au stock disponible : refus (RG-REC-155).
  - Modification d'une affiche fusionnée héritée : refus (RG-REC-169).
  - Fonction legacy sans écran cible : écart consigné, pas de code (MISSION §12.6, Q-382).
- Questions liées : Q-100, Q-101, Q-117, Q-118, Q-119, Q-155
- Questions BLOQUANTES et démarrage : aucune BLOQUANTE (Q-382 arbitrage des fonctions legacy ; Q-385 état de destruction) — OUI pour la partie rebut/mouvements côté Réception ; les écrans ECR-STK-* relèvent de la dépendance D-13 (étape 8). Les règles legacy non reprises (fusion RG-REC-163/165/166/167, zone picking RG-REC-168) ne produisent aucun code tant que Q-382 n'est pas tranchée : un test de non-régression d'absence suffit.

### REC-P10 — Alertes Réception, paramètres, référentiels, dashboard et interfaces de retour
- Module / étape : Réception, étape 5 (/etape-05-reception REC-P10) ; dépend de : REC-P05, REC-P07 ; D-06, D-08
- Acteur(s) : coord, admin ; recep (lecture des alertes de réception) ; com en lecture.
- Déclencheur : Événement de réception déclenchant une alerte, ou ouverture du bandeau d'alertes (ECR-TRA-01), des paramètres ou du dashboard.
- Écrans : ECR-TRA-01, ECR-ADM-04, ECR-ADM-05, ECR-ADM-07
- Étapes :
  1. Poser les alertes du catalogue Réception sur événement (RG-REC-182, RG-REC-184, RG-REC-187, RG-REC-188) ; canal, gravité et destinataires paramétrables (RG-REC-190).
  2. Lire et paramétrer : seuils Règles métier > Réception et référentiels imprimeurs, livreurs, agents (RG-REC-178, RG-REC-179).
  3. Dashboard de réception, taux d'entretien et alertes du dashboard (RG-REC-194, RG-REC-195, RG-REC-196).
  4. Mails de réception : supprimés (RG-REC-191).
  5. Interfaces legacy : export vers PEX/Broadcast, EstAssociee, synchronisation, alimentation de tf_prepa_affiche (RG-REC-199, RG-REC-200, RG-REC-201, RG-REC-202).
- Règles (15 RG) : RG-REC-178, RG-REC-179, RG-REC-182, RG-REC-184, RG-REC-187, RG-REC-188, RG-REC-190, RG-REC-191, RG-REC-194, RG-REC-195, RG-REC-196, RG-REC-199, RG-REC-200, RG-REC-201, RG-REC-202
- Résultat : Alertes visibles dans ECR-TRA-01 avec lien vers l'écran concerné ; paramètres lus par les règles ; interfaces documentées pour l'étape 8.
- Cas d'erreur / exceptions / variantes :
  - Alerte dont la condition disparaît : levée automatiquement (RG-REC-190).
  - Paramètre absent : valeur par défaut de la maquette, à confirmer (Q-373, D-06).
  - Export Broadcast en échec : traité à l'étape 8 (D-16, Q-005).
- Questions liées : **Q-005** (BLOQUANTE), Q-105, Q-111, Q-115, Q-131, Q-132, Q-133, Q-151
- Questions BLOQUANTES et démarrage : Q-005 — PARTIEL : alertes, paramètres, référentiels et dashboard démarrables ; le batch d'export vers PEX/Broadcast et la synchronisation (RG-REC-199, RG-REC-201, RG-REC-202) attendent Q-005 (planification inconnue) et relèvent de l'étape 8 (D-16).

### COO-P01 — Socle Coordination : droits, périmètre, statuts d'instruction, intégration, historique
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P01) ; dépend de : REC-P01
- Acteur(s) : coord, admin ; cheq, expe, recep selon périmètre ; com en lecture.
- Déclencheur : Toute action du module Coordination, ou intégration d'une instruction / préparation par le système.
- Écrans : ECR-COO-01
- Étapes :
  1. Contrôler le droit dans le service, correspondance 27 droits legacy / 6 rôles, périmètre atelier/site, Commerce en lecture (RG-COO-165, RG-COO-166, RG-COO-167, RG-COO-168, RG-COO-169).
  2. Poser la machine d'états de l'instruction et sa table de transitions ; toute transition non listée : 409 (RG-COO-040).
  3. Créer ou mettre à jour l'instruction à l'intégration, ignorer les renvois ; poser le statut de préparation du dossier (RG-COO-041, RG-COO-063).
  4. Annuler un dossier/instruction ; retour arrière avec effacement du calcul des trains ; dossier annulé sans objet (RG-COO-045, RG-COO-046, RG-COO-062).
  5. Historiser chaque changement de statut et action de coordination (RG-COO-061, RG-COO-160) ; garder les circuits indépendants (RG-COO-001).
- Règles (14 RG) : RG-COO-001, RG-COO-040, RG-COO-041, RG-COO-045, RG-COO-046, RG-COO-061, RG-COO-062, RG-COO-063, RG-COO-160, RG-COO-165, RG-COO-166, RG-COO-167, RG-COO-168, RG-COO-169
- Résultat : Modèle, droits et statuts Coordination testés ; aucun effet métier de validation.
- Cas d'erreur / exceptions / variantes :
  - Droit absent : 403. Transition non listée : 409 (RG-COO-040).
  - Dossier annulé : validation et Instruction OK sans objet (RG-COO-062).
  - Renvoi de Broadcast ignoré après Instruction OK ou export : signalé (RG-COO-053 voir COO-P02).
- Questions liées : **Q-001** (BLOQUANTE), Q-003, **Q-004** (BLOQUANTE), Q-200, Q-201, Q-206, Q-215, Q-216, Q-221
- Questions BLOQUANTES et démarrage : Q-001, Q-004, Q-319 — PARTIEL : machines d'états instruction/dossier démarrables sur le catalogue de la maquette (EN_COURS, INSTRUCTION_OK, ANNULE…) ; Q-004 (export de tr_statut) conditionne le mapping des codes 0 à 10 et la reprise (RG-COO-040, 045, 061, 160) ; Q-001 conditionne l'authentification réelle (RG-COO-165) ; Q-319 pour atelier/site de référence.

### COO-P02 — Liste des instructions et Instruction OK (automatique, manuelle), écart Broadcast, correction
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P02) ; dépend de : COO-P01
- Acteur(s) : coord, admin ; com en lecture.
- Déclencheur : La préparation d'un dossier est reçue de Broadcast (EN_COURS) ; ou la Coordination ouvre « Validation admin et Instruction OK ».
- Écrans : ECR-COO-01, ECR-COO-02, ECR-COO-04
- Étapes :
  1. Lister les instructions et filtrer « À faire (Coordination) » (RG-COO-060, RG-COO-051).
  2. Ouvrir la fiche : entretien (8 % par défaut, 15 % campagne contrôlée), répartition par thème, position, commentaire de prépa (RG-COO-048, RG-COO-049, RG-COO-050, RG-COO-059, RG-COO-204).
  3. Calculer l'écart Broadcast / Circé ; appliquer la version Broadcast ou demander une correction ; constat « reste en place » (RG-COO-055, RG-COO-056, RG-COO-057, RG-COO-058).
  4. Poser l'Instruction OK : automatique (règle de Nariman) ou manuelle après contrôle, répartition à 100 % exigée, pas avant la prépa (RG-COO-042, RG-COO-043, RG-COO-044, RG-COO-052, RG-COO-133).
  5. L'instruction OK fige annonceur, entretien, position (RG-COO-047) ; renvoi de prépa : réouverture ou ignoré signalé (RG-COO-053, RG-COO-054).
- Règles (19 RG) : RG-COO-042, RG-COO-043, RG-COO-044, RG-COO-047, RG-COO-048, RG-COO-049, RG-COO-050, RG-COO-051, RG-COO-052, RG-COO-053, RG-COO-054, RG-COO-055, RG-COO-056, RG-COO-057, RG-COO-058, RG-COO-059, RG-COO-060, RG-COO-133, RG-COO-204
- Résultat : Instruction INSTRUCTION_OK (mode AUTO ou MANUEL) prête au calcul des trains (COO-P09), historisée.
- Cas d'erreur / exceptions / variantes :
  - Répartition < 100 % : refus (RG-COO-043). Instruction OK avant la prépa : refus (RG-COO-052).
  - Renvoi de prépa après Instruction OK ou export : ignoré mais signalé (RG-COO-053).
  - Écart Broadcast/Circé : alerte et choix appliquer/corriger (RG-COO-055, RG-COO-067).
  - Annulation d'une instruction : voir COO-P01 (RG-COO-045).
- Questions liées : Q-006, Q-200, **Q-204** (BLOQUANTE), Q-205, Q-206, Q-209, Q-210, Q-216, Q-219, Q-220, Q-224, Q-225, Q-257
- Questions BLOQUANTES et démarrage : Q-204 — PARTIEL : Instruction OK manuelle, saisie, écart, correction et version Broadcast démarrables (RG-COO-043, 044, 047 à 052, 055 à 060, 133 à confirmer) ; l'Instruction OK automatique et la réouverture sur renvoi de prépa (RG-COO-042, RG-COO-053, RG-COO-054) attendent Q-204 (option a jeudi 14 h par bouton, ou b dès l'arrivée de la prépa).

### COO-P03 — Validation admin : proposition de rattachement, cas sûrs, affiches à doute
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P03) ; dépend de : COO-P01, REC-P04
- Acteur(s) : coord, admin (validation) ; recep (rattachement seul, non validant).
- Déclencheur : Création d'une affiche par la Réception (REC-P04) ou rattachement d'une inconnue (REC-P07) : Circé propose, une personne confirme (option A du 02/11).
- Écrans : ECR-COO-01, ECR-COO-03
- Étapes :
  1. Origine du n° de dossier et proposition de rattachement à la réception (RG-COO-003, RG-COO-004).
  2. Cas sûr (ligne active, n° lu = n° de la ligne, un seul thème) : état A_CONFIRMER_PROPOSE (RG-COO-005, RG-COO-007).
  3. Motifs de doute (BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE) : A_CONFIRMER_DOUTE, jamais pré-coché (RG-COO-006, RG-COO-007, RG-COO-011, RG-COO-012).
  4. Calcul de la pastille du dossier et du statut « Validation admin faite » (RG-COO-019, RG-COO-020) ; rien à valider : refus (RG-COO-013).
  5. La quantité n'est pas une condition (réception partielle) (RG-COO-016) ; confirmation explicite via la modale ECR-COO-03 (RG-COO-012).
- Règles (12 RG, + 3 RG-X) : RG-COO-002, RG-COO-003, RG-COO-004, RG-COO-005, RG-COO-006, RG-COO-007, RG-COO-011, RG-COO-012, RG-COO-013, RG-COO-016, RG-COO-019, RG-COO-020, RG-X-001, RG-X-002, RG-X-053
- Résultat : Liste ECR-COO-01 avec états de validation calculés, cas sûrs pré-cochés, affiches à doute isolées.
- Cas d'erreur / exceptions / variantes :
  - Aucune affiche reçue : « Rien à valider » (RG-COO-013).
  - Affiche à doute : jamais confirmée en lot sans modale (RG-COO-012, RG-X-053).
  - Dossier annulé : sans objet (RG-COO-062).
- Questions liées : Q-125, Q-136, Q-200, Q-203, Q-207, Q-215, Q-228, Q-231, Q-234
- Questions BLOQUANTES et démarrage : Q-300, Q-306 — OUI après étape 3 : l'état de validation est calculé à partir du statut d'affiche (Q-300) et du lien affiche-ligne avec quantité (Q-306). Aucune autre BLOQUANTE ; RG-X-001, RG-X-002 et RG-X-053 sont indispensables et rattachées à ce parcours et à l'étape 7.

### COO-P04 — Validation admin : confirmer, valider en lot, annuler, effets et traçabilité
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P04) ; dépend de : COO-P03, REC-P07, REC-P08
- Acteur(s) : coord, admin (valider, annuler) ; recep et cheq en lecture ; com en lecture.
- Déclencheur : Clic sur « Valider » (fiche dossier ou affiche), « Valider la sélection » ou « Annuler la validation » ; rattachement d'une inconnue par la Coordination.
- Écrans : ECR-COO-01, ECR-COO-02, ECR-REC-04, ECR-REC-05
- Étapes :
  1. Contrôler qui peut valider, annuler la validation, passer l'Instruction OK (RG-COO-009).
  2. Confirmer une affiche ou la sélection en lot ; tracer nom et date (RG-COO-008, RG-COO-010, RG-COO-015).
  3. Produire les effets : n° d'affiche visible, picking débloqué, étiquette rack, « reçue et associée », sortie de la liste à traiter (RG-COO-021, RG-COO-022, RG-COO-023, RG-COO-024, RG-COO-025, RG-COO-026).
  4. Annuler la validation (retour A_CONFIRMER_DOUTE, motif ANNULEE) sans toucher stock ni palette (RG-COO-014, RG-X-050).
  5. Rattachement manuel par la Coordination vaut validation ; mode BL/VISUEL/MAIN enregistré (RG-COO-017, RG-COO-018, RG-X-051, RG-X-014, RG-X-015, RG-X-052, RG-X-058).
  6. Après validation : thème changé = validation à refaire, quantité changée = alerte seule, ligne annulée = alerte, fusion conserve la validation ; abandons (RG-COO-027, RG-COO-028, RG-COO-029, RG-COO-030, RG-COO-031, RG-COO-032, RG-COO-064).
- Règles (18 RG, + 6 RG-X) : RG-COO-008, RG-COO-009, RG-COO-010, RG-COO-014, RG-COO-015, RG-COO-021, RG-COO-022, RG-COO-023, RG-COO-024, RG-COO-025, RG-COO-026, RG-COO-027, RG-COO-028, RG-COO-029, RG-COO-030, RG-COO-031, RG-COO-032, RG-COO-064, RG-X-051, RG-X-014, RG-X-015, RG-X-050, RG-X-058, RG-X-052
- Résultat : Affiches VALIDEE (par, le), effets produits, historique ; ou validation annulée avec états Réception inchangés.
- Cas d'erreur / exceptions / variantes :
  - Rôle non coord/admin : 403 (RG-COO-009). Annuler une affiche non validée : 409 (RG-X-050).
  - Affiche à doute incluse en lot : modale ECR-COO-03 obligatoire (RG-COO-012).
  - Échec de l'impression de l'étiquette rack : non bloquant (Q-002, RG-REC-092).
  - Thème changé après validation : validation à refaire (RG-COO-030, RG-X-057).
- Questions liées : **Q-002** (BLOQUANTE), Q-003, Q-107, Q-162, Q-200, Q-201, Q-202, Q-203, Q-210, Q-213, Q-231
- Questions BLOQUANTES et démarrage : Q-002 — PARTIEL : confirmation, annulation, traçabilité et effets démarrables ; l'impression de l'étiquette rack à la plateforme (RG-COO-023) attend Q-002 (agent local) ; le retour Broadcast (RG-COO-024) relève de l'étape 8 (D-16, Q-005).

### COO-P05 — Lignes attendues : règles de vie, rapprochement, provisoire, annulation, sources
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P05) ; dépend de : COO-P01, REC-P02 ; D-10
- Acteur(s) : Système (alimentation) ; coord et cheq en lecture.
- Déclencheur : Lecture de Broadcast, arrivée de la prépa, saisie des IP, disparition ou annulation d'une ligne.
- Écrans : ECR-PIL-03
- Étapes :
  1. Garantir une ligne active par clé et le rapprochement par identifiants (RG-COO-080, RG-COO-081, RG-COO-089).
  2. Créer/mettre à jour les lignes Broadcast, semaines ISO et fenêtre S à S+8 (RG-COO-082, RG-COO-083).
  3. Gérer le visuel provisoire, la saisie des IP et la bascule en PREPA (RG-COO-084, RG-COO-085, RG-COO-086).
  4. Fermer sans supprimer : ANNULEE, déplacement du lien (RG-COO-087, RG-COO-088, RG-COO-090).
  5. Trois sources, lignes bandeau, DA chapeau, reçu calculé (RG-COO-094, RG-COO-095, RG-COO-096, RG-COO-097).
  6. Cas particuliers : thème partagé, surplus autre dossier, deux plateformes, multi-semaines (RG-COO-098, RG-COO-099, RG-COO-100, RG-COO-101).
  7. Suivi de prod et état des réservations vivant (RG-COO-105, RG-COO-106, RG-COO-107, RG-COO-108).
- Règles (23 RG) : RG-COO-080, RG-COO-081, RG-COO-082, RG-COO-083, RG-COO-084, RG-COO-085, RG-COO-086, RG-COO-087, RG-COO-088, RG-COO-089, RG-COO-090, RG-COO-094, RG-COO-095, RG-COO-096, RG-COO-097, RG-COO-098, RG-COO-099, RG-COO-100, RG-COO-101, RG-COO-105, RG-COO-106, RG-COO-107, RG-COO-108
- Résultat : Lignes attendues cohérentes consommées par REC-P02 ; liens des affiches jamais perdus.
- Cas d'erreur / exceptions / variantes :
  - Disparition d'une ligne : ANNULEE, jamais supprimée (RG-COO-087, RG-COO-089).
  - Doublon de clé : refus (RG-COO-080).
  - Reprise des données : dédoublonnage (RG-COO-090, D-23).
- Questions liées : Q-200, Q-202, Q-207, Q-208, Q-209, Q-210, Q-212, Q-213, Q-226, Q-227, Q-231
- Questions BLOQUANTES et démarrage : Q-005, Q-300, Q-306 — PARTIEL : règles de vie des lignes démarrables (Q-300 et Q-306 à trancher avant l'étape 3) ; l'alimentation réelle depuis Broadcast attend Q-005 ; ECR-PIL-03 en dépendance D-10 (étape 8).

### COO-P06 — Intégration Broadcast : copie de l'état des réservations et flux
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P06) ; dépend de : COO-P05, COO-P02 ; D-10, D-16
- Acteur(s) : Système ; coord (rafraîchir un dossier) ; admin.
- Déclencheur : Planificateur d'intégration (fréquence inconnue) ou action « Rafraîchir un dossier ».
- Écrans : aucun écran propre (socle ou traitement système)
- Étapes :
  1. Interroger Broadcast, copier l'EDR par dossier, fermer les lignes plus vues, exclusions (RG-COO-091, RG-COO-092, RG-COO-093, RG-COO-103, RG-COO-109).
  2. Charger les cinq flux dans l'ordre fixe, journaliser, état partiel rejouable (RG-COO-104, RG-COO-115, RG-COO-116, RG-COO-117).
  3. Intégrer destinataires et transporteurs/tarifs par défaut (RG-COO-118, RG-COO-119, RG-COO-120).
  4. Router une prépa fixe/pliage, renvoi, suivi d'intégration par groupe, accusé vers Broadcast (RG-COO-121, RG-COO-122, RG-COO-123, RG-COO-125).
  5. Atelier déroulant, code d'instruction, type de préparation, faces de trains, reprise afficheur, verrou de lot (RG-COO-126, RG-COO-127, RG-COO-128, RG-COO-129, RG-COO-130, RG-COO-131).
  6. Rafraîchir un dossier ; retour vers Broadcast ; atomicité et idempotence (RG-COO-102, RG-COO-132, RG-COO-134).
- Règles (25 RG) : RG-COO-091, RG-COO-092, RG-COO-093, RG-COO-102, RG-COO-103, RG-COO-104, RG-COO-109, RG-COO-115, RG-COO-116, RG-COO-117, RG-COO-118, RG-COO-119, RG-COO-120, RG-COO-121, RG-COO-122, RG-COO-123, RG-COO-125, RG-COO-126, RG-COO-127, RG-COO-128, RG-COO-129, RG-COO-130, RG-COO-131, RG-COO-132, RG-COO-134
- Résultat : Données Broadcast intégrées sans doublon, rejouables ; états de dossier et d'instruction à jour.
- Cas d'erreur / exceptions / variantes :
  - Flux en échec : état partiel assumé, journal, rejouable (RG-COO-116).
  - Délai d'attente dépassé : journalisation, pas de blocage (RG-COO-117).
  - Prépa renvoyée sans annulation de la précédente : refus d'intégration (RG-COO-122).
- Questions liées : **Q-005** (BLOQUANTE), Q-010, Q-201, Q-206, Q-208, Q-211, Q-216, Q-227, Q-228, Q-231
- Questions BLOQUANTES et démarrage : Q-005 — PARTIEL : les règles de traitement (idempotence, atomicité, statuts de chargement, routage) démarrent sur un contrat d'interface en HYPOTHÈSE ; planification, jobs et procédures hors dépôt (RG-COO-091, 102, 103, 104, 115, 116, 125, 131, 134) attendent Q-005. Étape 8 : D-16, D-20.

### COO-P07 — Alertes Pré-Prod et vérification des thèmes
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P07) ; dépend de : COO-P06, COO-P04 ; D-08, D-12
- Acteur(s) : coord, admin ; cheq en lecture.
- Déclencheur : Événement du process (arrivée de prépa, écart, réception inconnue, deadline) ou ouverture de la cloche d'alertes.
- Écrans : ECR-TRA-01, ECR-COO-02
- Étapes :
  1. Poser les alertes sur événement avec gravité (RG-COO-033, RG-COO-066, RG-COO-067, RG-COO-071, RG-COO-072).
  2. Thème modifié dans Broadcast : alerte et « Reprendre la version Broadcast » (RG-COO-068).
  3. Vérification des thèmes et annonceurs proches (RG-COO-069, RG-COO-070).
  4. Rajout après préparation et dernière minute sur fichier envoyé (RG-COO-073, RG-COO-074).
  5. Menu Alertes Pré-Prod et calendrier des deadlines (RG-COO-075, RG-COO-076).
- Règles (12 RG) : RG-COO-033, RG-COO-066, RG-COO-067, RG-COO-068, RG-COO-069, RG-COO-070, RG-COO-071, RG-COO-072, RG-COO-073, RG-COO-074, RG-COO-075, RG-COO-076
- Résultat : Alertes OUVERTES puis ACQUITTÉES ou levées, avec lien vers l'écran concerné.
- Cas d'erreur / exceptions / variantes :
  - Condition disparue : levée automatique (RG-COO-066).
  - Alerte répétée : date mise à jour, pas de doublon (RG-X-054).
  - Mail en échec : non bloquant (D-19, Q-375).
- Questions liées : Q-200, Q-210, Q-220, Q-221, Q-222
- Questions BLOQUANTES et démarrage : aucune BLOQUANTE (Q-220 acquittement ; Q-366 vérification des thèmes) — OUI : séance courte (12 RG) ; ECR-THM-01/02/03 sont en dépendance D-12 (étape 8), la règle de proximité 0,85 relève de la vérification des thèmes.

### COO-P08 — Déblocage des préparations et « Rendre la main »
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P08) ; dépend de : COO-P06
- Acteur(s) : coord, admin.
- Déclencheur : Une préparation doit être reprise par la Pré-Prod (recherche par n° de préparation ou de dossier).
- Écrans : ECR-COO-09
- Étapes :
  1. Rechercher (n° de préparation ou de dossier exigé) ; filtrer par règles d'inclusion/exclusion de l'atelier (RG-COO-140, RG-COO-141).
  2. Afficher le statut d'avancement ; refuser si une UM >= 6 ou si les faces d'un train sont contrôlées (RG-COO-142, RG-COO-143, RG-COO-144).
  3. Débloquer : annulation côté Broadcast et Circé en une transaction ; tracer qui, quand, quoi (RG-COO-145, RG-COO-146).
  4. Mail de déblocage non bloquant ; prépa renvoyée intégrée normalement (RG-COO-147, RG-COO-148).
  5. Suivi des déblocages ; droits ; consignes « Rendre la main » ; répartitions AMT (RG-COO-149, RG-COO-150, RG-COO-151, RG-COO-152, RG-COO-277, RG-COO-278, RG-COO-279).
- Règles (16 RG) : RG-COO-140, RG-COO-141, RG-COO-142, RG-COO-143, RG-COO-144, RG-COO-145, RG-COO-146, RG-COO-147, RG-COO-148, RG-COO-149, RG-COO-150, RG-COO-151, RG-COO-152, RG-COO-277, RG-COO-278, RG-COO-279
- Résultat : Préparation débloquée, validation admin et affiches reçues inchangées (RG-X-059).
- Cas d'erreur / exceptions / variantes :
  - UM au statut >= 6 : blocage 422 (RG-COO-143).
  - Recherche sans n° : refus (RG-COO-140).
  - Échec Broadcast : aucun changement côté Circé, retour explicite (RG-COO-145, RG-COO-279 : non atomique à ne pas reproduire).
- Questions liées : Q-003, Q-201, Q-216, Q-217, Q-218, Q-219, Q-227, Q-228, Q-274, Q-275
- Questions BLOQUANTES et démarrage : aucune BLOQUANTE (Q-382 arbitrage de l'écran legacy) — OUI : démarrable ; l'écran legacy « Préparations débloquées » est à arbitrer en « Rendre la main » (D-21, Q-382) ; Q-265 concerne la libération, pas ce parcours.

### COO-P09 — Trains : identifiant, positions, faces, couverture, fractionnement, liste (ECR-COO-05)
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P09) ; dépend de : COO-P02 ; D-02, D-06
- Acteur(s) : coord, admin, cheq (lecture n° de panneau).
- Déclencheur : Instruction OK posée (COO-P02) : calcul des trains de l'atelier déroulant ; ou action manuelle sur la liste des trains.
- Écrans : ECR-COO-05
- Étapes :
  1. Calculer les trains : identifiant/version, position, répartition sur faces, entretien, campagne contrôlée (RG-COO-200, RG-COO-201, RG-COO-202, RG-COO-203, RG-COO-204).
  2. Garde-fous anti-doublons, reprise d'afficheur, retour arrière de l'instruction (RG-COO-205, RG-COO-206, RG-COO-207).
  3. Couverture des visuels : EN_ATTENTE à PRET, positions fractionnée/couverte, limite par train (RG-COO-208, RG-COO-209).
  4. Changer statut des faces, annuler un thème, débloquer la semaine (RG-COO-218, RG-COO-219, RG-COO-220).
  5. Fractionner, raccrocher un visuel, point de non-retour EN_PROD, pré-test, supprimer avec motif, dupliquer (RG-COO-221, RG-COO-222, RG-COO-223, RG-COO-224, RG-COO-225, RG-COO-226).
  6. Sélection, filtres, n° de panneau (RG-COO-227, RG-COO-228, RG-COO-229) ; historisation et actions de masse avec verrou de version et idempotence (RG-COO-307, RG-COO-308).
- Règles (24 RG) : RG-COO-200, RG-COO-201, RG-COO-202, RG-COO-203, RG-COO-204, RG-COO-205, RG-COO-206, RG-COO-207, RG-COO-208, RG-COO-209, RG-COO-218, RG-COO-219, RG-COO-220, RG-COO-221, RG-COO-222, RG-COO-223, RG-COO-224, RG-COO-225, RG-COO-226, RG-COO-227, RG-COO-228, RG-COO-229, RG-COO-307, RG-COO-308
- Résultat : Liste de trains cohérente avec faces et statuts ; train EN_PROD immuable.
- Cas d'erreur / exceptions / variantes :
  - Train EN_PROD : modification ou suppression refusée, 409 (RG-COO-223).
  - Annulation d'un thème hors statut « A imprimer » : refus (RG-COO-219).
  - Suppression sans motif : refus (RG-COO-225). Verrou de version périmé : 409 (RG-COO-308).
  - Alternatif : dernière minute sur train en production (RG-X-077, étape 7).
- Questions liées : Q-250, Q-251, Q-253, Q-255, Q-256, Q-257, Q-258, Q-259, Q-260, Q-261, Q-268, Q-277, Q-280, Q-282, Q-286
- Questions BLOQUANTES et démarrage : Q-319 — OUI : démarrable ; Q-319 (référentiels atelier, support, jours de départ) à fournir pour le seed. Q-204 conditionne seulement le moment de l'Instruction OK (COO-P02).

### COO-P10 — Export des trains et préparation du déroulant (suivi par thème, rouleur)
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P10) ; dépend de : COO-P09 ; D-15
- Acteur(s) : coord (export) ; cheq ; admin.
- Déclencheur : Jalon du jeudi 14 h : « Exporter les trains » ; puis traitement de la préparation du déroulant.
- Écrans : ECR-COO-05, ECR-COO-06, ECR-COO-07, ECR-GEN-01
- Étapes :
  1. Lister les dossiers exportables et le décompte (RG-COO-211, RG-COO-212).
  2. Exporter : seules les faces « Instruction ok » partent et passent à « Prêt à produire » ; fichier, simulation, historique, erreurs (RG-COO-210, RG-COO-213, RG-COO-214).
  3. Export préparation 2 m² déroulants, plafond 20 thèmes, « Au roulage » (RG-COO-215, RG-COO-216, RG-COO-217).
  4. Suivi par thème : exclusions, périmètre, pré-assemblage (RG-COO-230, RG-COO-231, RG-COO-232, RG-COO-233).
  5. Vue préparation et choix du rouleur (RG-COO-235, RG-COO-236).
- Règles (14 RG) : RG-COO-210, RG-COO-211, RG-COO-212, RG-COO-213, RG-COO-214, RG-COO-215, RG-COO-216, RG-COO-217, RG-COO-230, RG-COO-231, RG-COO-232, RG-COO-233, RG-COO-235, RG-COO-236
- Résultat : Trains exportés (PRET), fichier produit ou simulé, historique d'export ; l'export ne dépend ni de la validation admin ni de la réception complète (RG-X-083).
- Cas d'erreur / exceptions / variantes :
  - Export par un profil non Coordination : 403 (RG-COO-212).
  - Plus de 20 thèmes : refus (RG-COO-216). Erreur d'export : visible, rien de passé à PRET (RG-COO-213).
  - Affiche reçue après l'export : alerte, rattachement du seul surplus (RG-X-011, RG-X-085).
- Questions liées : Q-250, Q-251, Q-252, Q-253, Q-254, Q-255, Q-262, Q-263, Q-276, Q-280, Q-286
- Questions BLOQUANTES et démarrage : Q-319 — OUI : démarrable ; la génération des fichiers de production (ECR-GEN-01, format .ini) est la dépendance D-15 (étape 8) : l'export est simulé jusque-là.

### COO-P11 — Roulage : suivi 8 m², dispatch des rouleurs, bagues et étiquettes
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P11) ; dépend de : COO-P10 ; D-05, D-18
- Acteur(s) : coord, cheq (rouleur, bagues), admin.
- Déclencheur : Unités PRET à produire : affectation d'un rouleur et impression des bagues ; ouverture du dispatch.
- Écrans : ECR-COO-08, ECR-COO-10, ECR-COO-11
- Étapes :
  1. Pré-assemblage 8 m² et suivi : saisie en ligne et reste à faire (RG-COO-234, RG-COO-237).
  2. Dispatch : périmètre, charge, proposer/affecter/tout désaffecter, alertes de départ proche et de surcharge (RG-COO-291, RG-COO-292, RG-COO-293, RG-COO-294, RG-COO-295).
  3. Liste de picking d'un rouleur ; référentiel des rouleurs (RG-COO-296, RG-COO-297).
  4. Bagues : périmètre, filtre À imprimer, rouleur obligatoire, passage automatique à En production (RG-COO-298, RG-COO-299).
  5. Textes de la bague, réimpression avec motif, contenu, tableau de roulage (RG-COO-300, RG-COO-301, RG-COO-302, RG-COO-303).
- Règles (15 RG) : RG-COO-234, RG-COO-237, RG-COO-291, RG-COO-292, RG-COO-293, RG-COO-294, RG-COO-295, RG-COO-296, RG-COO-297, RG-COO-298, RG-COO-299, RG-COO-300, RG-COO-301, RG-COO-302, RG-COO-303
- Résultat : Rouleurs affectés, bagues imprimées, unités EN_PROD, tableau de roulage alimenté.
- Cas d'erreur / exceptions / variantes :
  - Impression sans rouleur : refus (RG-COO-299). Aucune unité PRET : « Aucune unité « Prêt à produire » dans la sélection. ».
  - Réimpression sans motif : refus (RG-COO-301).
  - Proposition de répartition : règle simulée en attente du moteur cible (RG-COO-293).
- Questions liées : **Q-002** (BLOQUANTE), Q-262, Q-264, Q-276, Q-277, Q-278, Q-286, Q-287
- Questions BLOQUANTES et démarrage : Q-002 — PARTIEL : suivi 8 m² et dispatch démarrables ; l'impression des bagues (RG-COO-299) attend Q-002 pour l'imprimante locale (aperçu PDF navigateur possible) ; ECR-COO-11 en dépendance D-18.

### COO-P12 — Préparation 2 m² fixe, pliage et bus : libération, rendre la main, comptage, quantités à encoller
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P12) ; dépend de : COO-P06, COO-P09
- Acteur(s) : coord, cheq, admin ; expe en lecture.
- Déclencheur : Préparation fixe/pliage/bus reçue ; la Coordination libère la semaine, rend la main ou saisit le comptage.
- Écrans : ECR-COO-09
- Étapes :
  1. Entretien calculé et quantité à produire par afficheur (RG-COO-124, RG-COO-238, RG-COO-239).
  2. Libérer la semaine, état « à libérer », repère « Arrivé après libération » (RG-COO-240, RG-COO-241, RG-COO-242).
  3. Rendre la main à la Pré-Prod ; corriger l'intitulé ; jours d'affichage ; fiche de synthèse (RG-COO-243, RG-COO-244, RG-COO-245, RG-COO-246, RG-COO-151).
  4. Pliage : comptage et PRODUIT ; fixe unique ; retirer, préparer, pas de déplacement après envoi (RG-COO-247, RG-COO-248, RG-COO-249, RG-COO-250, RG-COO-251).
  5. Liste des UM ; bus : quantités à encoller et préparation par centre ; PDF navigateur (RG-COO-290, RG-COO-304, RG-COO-305, RG-COO-306).
- Règles (19 RG) : RG-COO-124, RG-COO-238, RG-COO-239, RG-COO-240, RG-COO-241, RG-COO-242, RG-COO-243, RG-COO-244, RG-COO-245, RG-COO-246, RG-COO-247, RG-COO-248, RG-COO-249, RG-COO-250, RG-COO-251, RG-COO-290, RG-COO-304, RG-COO-305, RG-COO-306
- Résultat : Semaine libérée ou main rendue ; UM préparées ; validation admin inchangée (RG-X-059, RG-X-081).
- Cas d'erreur / exceptions / variantes :
  - Libération sans confirmation, sans lien avec la validation admin (RG-COO-240).
  - Retirer une préparation : UM supprimées, répartitions à « A traiter » (RG-COO-249).
  - Dossier arrivé après la libération : alerte (RG-X-076, étape 7).
- Questions liées : **Q-002** (BLOQUANTE), Q-224, Q-250, Q-256, Q-261, **Q-265** (BLOQUANTE), Q-266, Q-267, Q-268, Q-269, Q-270, Q-271, Q-273, Q-279, Q-287 [Note audit final 2026-11-06 : Q-265 n'est plus BLOQUANTE : HYPOTHÈSE PRISE option (c) depuis l'étape 8, à valider par l'utilisateur.]
- Questions BLOQUANTES et démarrage : Q-265, Q-002 — PARTIEL : entretien, rendre la main, pliage, bus et fiches démarrables ; la libération de la semaine, le statut initial « à libérer » et qui crée les UM (RG-COO-240, RG-COO-241) attendent Q-265 ; l'impression de la fiche de synthèse (RG-COO-306) conditionnée par Q-002. RG-X-076 attend Q-265 (étape 7).

### COO-P13 — Unités de manutention, colis, expédition et intégration AMT
- Module / étape : Coordination, étape 6 (/etape-06-coordination COO-P13) ; dépend de : COO-P12 ; D-14
- Acteur(s) : expe, cheq, coord ; admin.
- Déclencheur : Unités PRET préparées : constitution des colis et expédition ; fin de journée (batch ou unitaire).
- Écrans : ECR-EXP-01, ECR-EXP-02
- Étapes :
  1. Construire les UM : agrégation, découpage, création, statuts d'origine, poids (RG-COO-260, RG-COO-261, RG-COO-262, RG-COO-263, RG-COO-264).
  2. Rattacher une UM à un colis (statuts 1 ou 6, même destinataire), créer/ouvrir/supprimer un colis (RG-COO-265, RG-COO-266, RG-COO-267).
  3. Expédier : colis/UM/trains passent « A expédier » ; fin de journée vers « Terminé » (RG-COO-268, RG-COO-269, RG-COO-270).
  4. Mail colis ; intégration AMT : réintégration, transcodage, contrôles d'anomalie, purge, statuts désactivés (RG-COO-271, RG-COO-272, RG-COO-273, RG-COO-274, RG-COO-275, RG-COO-276).
  5. Le statut de l'UM prime sur celui de la répartition (RG-COO-280).
- Règles (18 RG) : RG-COO-260, RG-COO-261, RG-COO-262, RG-COO-263, RG-COO-264, RG-COO-265, RG-COO-266, RG-COO-267, RG-COO-268, RG-COO-269, RG-COO-270, RG-COO-271, RG-COO-272, RG-COO-273, RG-COO-274, RG-COO-275, RG-COO-276, RG-COO-280
- Résultat : Colis expédiés, UM et répartitions à jour, sorties de stock déclenchées (RG-X-087, étape 7).
- Cas d'erreur / exceptions / variantes :
  - UM d'un autre destinataire ou statut non admis : refus (RG-COO-265).
  - Anomalie AMT 903/905/906/907 : ligne en erreur E (RG-COO-274).
  - Retrait de la dernière UM d'un colis : retour de l'UM à « En cours » (RG-COO-267).
- Questions liées : **Q-265** (BLOQUANTE), Q-271, Q-272, Q-273, Q-274, Q-281, Q-284, Q-285 [Note audit final 2026-11-06 : Q-265 n'est plus BLOQUANTE : HYPOTHÈSE PRISE option (c) depuis l'étape 8, à valider par l'utilisateur.]
- Questions BLOQUANTES et démarrage : Q-265 — PARTIEL : colisage, expédition et statuts d'UM démarrables ; la construction/création des UM (RG-COO-260) attend Q-265 (qui crée les UM en cible). ECR-EXP-01/02 en dépendance D-14 (étape 8).

## 5. Navigation et écrans
Graphe de navigation, liste des ECR.

Graphe de navigation du périmètre Réception / Coordination, repris de maquettes-reception-coordination.md §3 et maquettes-autres-modules.md §B. Format : source -> cible. Les paramètres d'URL (`?tab=`, `?q=`, `?id=`, `?pour=`, `?type=`, `?atelier=`, `?statut=`, `?ou=`) sont des filtres posés une fois à l'arrivée ; toute page ouverte par un lien affiche « ← Retour : <page quittée> » (pile de 20, vidée par le menu ; EX-TRA-013).

### 5.1 Entrées de menu -> écrans

| Source | Cible | Remarque |
|---|---|---|
| Menu Pilotage › Alertes ; cloche du bandeau 1 | ECR-TRA-01 | cloche : toutes pages |
| Menu Réception › Réception des affiches | ECR-REC-01 puis ECR-REC-02 (même page, `?tab=attendues`, vues attendues / saisie / contrôle) | badge = palettes à contrôler |
| Menu Réception › Liste des affiches | ECR-REC-03 (`?tab=affiches`) | |
| Menu Réception › Réceptions inconnues | ECR-REC-04 | badge rouge = affiches orphelines |
| Menu Pré-production › Validation admin et Instruction OK | ECR-COO-01 | badge = dossiers à traiter, rouge si écart BC |
| Menu Déroulant › Liste des instructions | ECR-COO-01 (`?pour=deroulant`) | |
| Menu Déroulant › Liste des trains | ECR-COO-05 (`tab=trains`) | |
| Menu Déroulant › Suivi par thème | ECR-COO-06 (`tab=besoin`) | |
| Menu Déroulant › Préparation | ECR-COO-07 (`tab=prepa`) | |
| Menu Déroulant › Suivi 8 m² (demies) | ECR-COO-08 (`tab=d8`) | |
| Menu Déroulant › Bagues | ECR-COO-11 | |
| Menu Déroulant › Dispatch | ECR-COO-10 (sous-entrées `?atelier=`) | |
| Menu 2 m² fixe / Pliage / Bus › Préparation | ECR-COO-09 (`?type=`, `?atelier=`) | badge « arrivés après libération » |

### 5.2 Liens internes Réception

| Source | Action | Cible |
|---|---|---|
| ECR-REC-01 | Photographier BL / affiche | ECR-REC-07 |
| ECR-REC-07 | Mettre au panier / Joindre | ECR-REC-01 |
| ECR-REC-01 | Réception inconnue… | ECR-REC-08 puis ECR-REC-09 (feuille temporaire) ; crée une ligne dans ECR-REC-04 et une alerte |
| ECR-REC-01 | Valider la réception | sas de ECR-REC-02 |
| ECR-REC-02 | Contrôler -> Valider | ECR-REC-09 (feuilles définitives) |
| ECR-REC-01 / ECR-REC-03 | clic n° d'affiche | ECR-REC-05 |
| ECR-REC-05 | Réception | ECR-REC-06 |
| ECR-REC-06 | Contrôler la palette | ECR-REC-02 |
| ECR-REC-05 | Imprimer la feuille | ECR-REC-09 |
| ECR-REC-03 | clic ligne | ECR-REC-05 |
| ECR-REC-03 | action groupée (imprimer) | ECR-REC-10 puis ECR-REC-09 |
| ECR-REC-04 | Fiche | ECR-REC-05 |
| ECR-REC-04 | Rattacher | palette dans le sas de ECR-REC-02 |
| ECR-REC-04 | Valider et imprimer | ECR-REC-02 |
| Tout écran | Voir le visuel | ECR-REC-12 |
| ECR-REC-01 / ECR-REC-06 | voir le BL | ECR-REC-11 |

### 5.3 Liens internes Coordination

| Source | Action | Cible |
|---|---|---|
| ECR-COO-01 | clic ligne | ECR-COO-02 |
| ECR-COO-02 | Demander une correction | ECR-COO-04 |
| ECR-COO-02 | Valider (si doutes) | ECR-COO-03 |
| ECR-COO-02 | Vérifier les thèmes | ECR-THM-01 (`?dossier`) [P2] |
| ECR-COO-05 | clic ligne | fiche train (05a) |
| fiche train (05a) | Réimprimer bague | ECR-COO-11 (11c) |
| fiche train (05a) | Raccrocher / Supprimer | 05d / 05e |
| ECR-COO-05 | Exporter les trains | 05b |
| ECR-COO-05 | Train de pré-test | 05c |
| ECR-COO-05 | Fichiers Vendôme / Générer les fichiers | ECR-GEN-01 (`?machine=`, trains pré-cochés) [P2] |
| ECR-COO-05 | Bagues | ECR-COO-11 |
| ECR-COO-05 (callout) | Voir les dossiers | ECR-COO-01 (`?pour=deroulant`) |
| ECR-COO-07 | Choisir le rouleur | modale rouleur |
| ECR-COO-07 | Imprimer les bagues | ECR-COO-11 |
| ECR-COO-09 | Libérer, Rendre la main, Corriger l'intitulé, Fiche de synthèse, Quantités à encoller, Comptage | modales |
| ECR-COO-09 | Générer les fichiers multi-rouleuse | ECR-GEN-02 [P2] |
| ECR-COO-09 | Imprimer les bagues | ECR-COO-11 (11a) |

### 5.4 Alertes (ECR-TRA-01) et liens entrants

| Source | Action | Cible |
|---|---|---|
| ECR-TRA-01 | Ouvrir (alertes MANQUANT, DEPART_RISQUE) | ECR-PIL-03 (`?q=`) [P2] |
| ECR-TRA-01 | Ouvrir (ECART, SANS_IP, THEME_MODIF `tag=refaire`) | ECR-REC-03 (`?q=`, `?tag=`) |
| ECR-TRA-01 | Ouvrir (ORPHELINE, DOSSIER_INTROUVABLE) | ECR-REC-04 (`?id=`) |
| ECR-TRA-01 | Ouvrir (CONTROLE_RETARD, FEUILLE_DEFINITIVE) | ECR-REC-02 (`tab=controle&id=`) |
| ECR-TRA-01 | Ouvrir (IP_MANQUANTES, ECART_BC, VALIDATION_ADMIN, APRES_LIBERATION) | ECR-COO-01 (`?q=`, `?statut=TOUS&q=`) |
| ECR-TRA-01 | Ouvrir (DM_FICHIER, APRES_LIBERATION) | ECR-COO-05 (`?q=`) |
| ECR-TRA-01 | Ouvrir (APRES_LIBERATION) | ECR-COO-09 (`?atelier=&q=`, `?flag=apres`) |
| ECR-TRA-01 | Ouvrir (THEMES_PROCHES, ANNONCEURS_PROCHES, THEME_BC) | ECR-THM-01/02/03 [P2] |
| ECR-TRA-01 | Règles et destinataires | ECR-ADM-04 (`?tab=alertes`) [P2] |
| ECR-GEN-03 | Générer un complément | lié à l'alerte DM_FICHIER [P2] |

### 5.5 Liens entrants depuis les autres modules vers P1

| Source | Action | Cible |
|---|---|---|
| ECR-PIL-04 | Voir dans Instructions | ECR-COO-01 (`?q=`) |
| ECR-PIL-04 | Voir les affiches | ECR-REC-03 (`?tab=affiches&q=`) |
| ECR-THM-01 / 02 | Ouvrir le dossier | ECR-COO-01 (`?statut=TOUS&q=`) |
| ECR-THM-03 | Reprendre la version BC | tag « Feuille à refaire » (ECR-REC-03) |
| ECR-GEN-01 / 02 | pré-sélection `G.preselect` | trains cochés dans ECR-COO-05 / 07 |
| ECR-EXP-02 | Fin de journée Geodis | statuts unités, mouvements de stock (lus par ECR-REC-03 / ECR-REC-05) |
| Écrans stock / suivi | `ui.afficheModal` | ECR-REC-05 |

Remarques : (1) la navigation de référence est `M.NAV` de `core.js` (10 onglets) ; l'aperçu V1.2 (ECR-NAV-02) est obsolète. (2) Le rôle ne fait que griser les pages secondaires, rien n'est interdit (Q-353). (3) Pas de page d'accueil : ouverture sur ECR-PIL-01 (P3), Q-365. (4) Aucune navigation n'est décrite pour les entrées du menu actuel sans écran cible (Q-382).

## 6. Matrice d'impact Réception ↔ Coordination
**Validée à l'étape 7** (/etape-07-interactions, 2026-11-05) : cette matrice est établie à partir des règles RG-X-001 à RG-X-088 (54 règles) ; chaque cellule est confirmée par un test d'intégration croisé (§6.6) et l'inventaire du code est en §6.5 (la matrice §6.1 à §6.4 reste le texte des règles ; §6.5 et §6.6 font foi pour l'état réel). Colonnes : transition déclenchante (module et action) × état de l'autre module (conditions) → résultat attendu. Les cellules sont des extraits ; l'énoncé complet fait foi dans la règle citée (RECEPTION_REGLES_METIER.md §5 pour RG-X-001 à 030, COORDINATION_REGLES_METIER.md §5 pour RG-X-050 à 088).

### 6.1 Actions de la Réception, conséquences pour la Coordination (RG-X-001 à 030)
Action Réception (valider la réception, rattacher, contrôler, changer de thème…) → effet côté Coordination (proposition de validation, alertes, couverture des unités).

| RG-X | Règle | Sens | Transition déclenchante | État de l'autre module / conditions | Résultat attendu | Atomicité |
|---|---|---|---|---|---|---|
| RG-X-001 | Valider la réception : proposition de rattachement / validation admin | REC → COO | validation d'une réception (voie dossier connu). | cas sûr = rattachée à une ligne active, n° lu = celui de la ligne, même format, un seul thème possible (ou visuel du BL), un seul dossier ; sinon doute. | ligne dans « Validation admin et Instruction OK » ; alerte « Validation admin à confirmer » pour un doute (grave départ S/S+1) ; historique « Rattachement proposé… à confirmer par la Coordination ». | transaction unique oui (dans RG-REC-046) |
| RG-X-002 | Motifs de doute posés par la Réception | REC → COO | rattachement. | au moins un motif. | statut VALIDATION_ADMIN.A_FAIRE_DOUTE avec motifs. | transaction unique oui |
| RG-X-003 | Réception : unités en attente → prêtes à produire | REC → COO | réception, rattachement, retrait. | toutes les affiches d'une unité reçues. | « n unité(s) prête(s) à produire ». | transaction unique oui |
| RG-X-004 | Statut de la ligne attendue et n° d'affiche lus par la Coordination | REC → COO | réception, contrôle, rattachement. | — | colonnes Reçu / Reste / N° d'affiche mises à jour. | transaction unique oui |
| RG-X-005 | « Affiche reçue » indépendant de la validation admin | REC → COO | validation de réception. | — | indicateur lu par EDR/suivi. | transaction unique oui |
| RG-X-006 | Réception inconnue créée → alerte Coordination | REC → COO | RG-REC-099. | — | alerte ; compteur. | transaction unique oui |
| RG-X-007 | Rattachement d'une inconnue : validation selon le rôle | REC → COO | « Rattacher ». | rôle. | voir RG-REC-111. | transaction unique oui |
| RG-X-008 | « Dossier introuvable » → alerte Coordination du site | REC → COO | RG-REC-112. | — | alerte ; statut introuvable. | transaction unique oui |
| RG-X-009 | Réception sur un dossier sans IP → alerte Coordination | REC → COO | validation de réception sans IP. | IP non saisies. | alerte. | transaction unique oui |
| RG-X-010 | Affiche ou visuel arrivé après la préparation ou la libération | REC → COO | événement de réception/arrivée. | préparation/libération déjà faite. | alerte `APRES_LIBERATION`. | transaction unique oui |
| RG-X-011 | Affiche reçue après l'export des trains | REC → COO | réception après export. | trains exportés. | alerte. | transaction unique oui |
| RG-X-012 | Thème changé après réception → validation à refaire, feuille à refaire | REC → COO | « Changer de thème… ». | — | alerte. | transaction unique oui |
| RG-X-013 | Retrait d'un rattachement : recalculs | REC → COO | RG-REC-137. | — | historique. | transaction unique oui |
| RG-X-014 | Rattachement manuel vaut validation si Coordination | REC → COO | RG-REC-135, 136. | rôle. | voir RG-REC-111. | transaction unique oui |
| RG-X-015 | Valider / Annuler la validation depuis la fiche affiche | REC → COO | boutons. | rôle coord/admin (RG-REC-003). | historique par/le. | transaction unique oui |
| RG-X-016 | Rattachement plusieurs-à-plusieurs : reçu compté une fois | REC → COO | rattachement. | — | « répartition à confirmer ». | transaction unique oui |
| RG-X-017 | Écart de contrôle → recalcul et alerte | REC → COO | RG-REC-059/069. | — | alerte. | transaction unique oui |
| RG-X-018 | Réception partielle : reste et alerte | REC → COO | réception partielle. | — | alerte. | transaction unique oui |
| RG-X-019 | Dossier livré sur deux plateformes | REC → COO | rattachement. | — | voir RG-REC-024. | transaction unique oui |
| RG-X-020 | Réception avant IP : ligne provisoire | REC → COO | arrivée des IP. | — | alerte. | transaction unique oui |
| RG-X-021 | Compteurs des menus Coordination | REC → COO | événement. | — | compteur. | transaction unique non (calcul de (…) |
| RG-X-022 | Retour vers Broadcast : affiche reçue et associée | REC → COO | batch (RG-REC-199). | — | `EstAssociee`. | transaction unique non (batch) |
| RG-X-028 | Circuits indépendants : réception et prépa | REC → COO | — | — | aucune dépendance bloquante. | transaction unique non |
| RG-X-030 | Rattachement d'une inconnue à plusieurs dossiers | REC → COO | « Rattacher » multi-dossiers. | > 1 dossier. | doute. | transaction unique oui |

### 6.2 Actions de la Coordination, conséquences pour la Réception (RG-X-050 à 065)
Action Coordination (annuler la validation, rattacher, lire Broadcast, débloquer…) → effet côté Réception (états des palettes, du stock, des affiches).

| RG-X | Règle | Sens | Transition déclenchante | État de l'autre module / conditions | Résultat attendu | Atomicité |
|---|---|---|---|---|---|---|
| RG-X-050 | Annulation d'une validation admin : conséquences côté Réception | COO → REC | action « Annuler la validation » (Coordination). | affiche `VALIDEE` ; rôle `coord`/`admin`. | 409 si l'affiche n'est pas validée ; test de rejet : après annulation, aucun mouvement de stock créé et statut de palette inchangé. | transaction unique oui |
| RG-X-051 | Rattachement d'une réception inconnue par la Coordination : validation et entrée de la (…) | COO → REC | action « Rattacher » (ECR-REC-04). | au moins un dossier et une quantité > 0 ; Σ quantités ≤ quantité reçue ; affiche « Orpheline » ou « Introuvable » ; `Idempotency-Key`. | 422 « Choisissez au moins un dossier et une quantité. » ; 422 « La répartition (n) dépasse la quantité reçue (m). » ; 409 si l'affiche est déjà rattachée. | transaction unique oui |
| RG-X-052 | Rattachement manuel du surplus à un autre dossier (même après validation ou début de (…) | COO → REC | action « + Rattacher à un autre dossier » / « Changer de thème… » (fiche affiche). | Σ quantités des liens actifs ≤ quantité reçue ; ligne cible `ACTIVE`. | 422 « La répartition (x) dépasse la quantité reçue (y). » ; historique `AfficheAssocier` ; alerte « Feuilles de stock à refaire » (Réception et Coordination). | transaction unique oui |
| RG-X-053 | Affiche à doute : tant que non confirmée, ses effets de validation ne sont pas produits | bidirectionnel | toute lecture ou action sur une affiche non validée. | état ≠ `VALIDEE`. | 422 sur les actions réservées (picking : RG-COO-022) ; test : une affiche à doute reçue et contrôlée a un stock et une feuille, mais aucun `EstAssociee`. | transaction unique non (invariant de (…) |
| RG-X-054 | Réception inconnue traitée par la Coordination : « Signaler » et dossier introuvable | bidirectionnel (action de la (…) | bouton « Signaler à la Coordination (alerte) ». | affiche « À identifier » ; un signalement répété met à jour la date, ne duplique pas l'alerte. | transition `A_IDENTIFIER → INTROUVABLE` ; toast « Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… » ; destinataire Nîmes : Q-221 ; qui rattache après la correction (…) | transaction unique oui |
| RG-X-055 | Ligne fermée ou annulée : le lien de l'affiche est déplacé, jamais perdu | COO → REC | fermeture d'une ligne attendue. | au moins un lien actif. | test de rejet : après fermeture de la ligne, l'affiche reste « Identifiée » et le stock est intact. | transaction unique oui |
| RG-X-056 | Saisie des IP : déplacement automatique des affiches du provisoire vers le thème | COO → REC | lecture de Broadcast avec IP. | affiche rattachée à une ligne provisoire. | tag « Feuille à refaire » si l'intitulé change ; tout déplacement est historisé. | transaction unique oui |
| RG-X-057 | Thème modifié dans Broadcast après la validation : validation à refaire et feuille de (…) | COO → REC | action « Reprendre la version Broadcast » ; lecture de Broadcast modifiant le thème. | thème de Broadcast ≠ thème de Circé ; au moins une affiche rattachée. | si production lancée : mail aux chefs d'équipe (RG-COO-068) ; tags et alertes levés à la réimpression de la feuille. | transaction unique oui |
| RG-X-058 | Retrait ou dissociation du dernier dossier par la Coordination : l'affiche redevient (…) | COO → REC | action « Retirer » (fiche affiche, onglet Préparations). | un seul lien actif restant. | transition `IDENTIFIEE → ORPHELINE` ; 409 si aucun lien actif. | transaction unique oui |
| RG-X-059 | Déblocage / « Rendre la main » : validation admin et affiches reçues inchangées | COO → REC | déblocage ; renvoi de prépa. | toute validation existante. | test de rejet : un déblocage laisse `VALIDEE` et le stock inchangés. | transaction unique oui |
| RG-X-060 | Thème partagé par plusieurs dossiers : le reçu est compté une seule fois | bidirectionnel | calcul d'attendu/reçu/reste. | lien plusieurs-à-plusieurs. | test : une affiche de 100 sur 3 dossiers (50/30/20) ⇒ reçu total 100. | transaction unique non (invariant de (…) |
| RG-X-061 | Réception partielle : validation de ce qui est reçu, complément proposé puis confirmé | bidirectionnel | réception d'un complément (action Réception). | ligne avec liens actifs et reste à recevoir > 0. | nouvelle proposition `A_CONFIRMER_PROPOSE` pour le complément (tag « Complément » de l'affiche) ; exemple 3/3/3 : A et B validées, rien pour C, complément de B proposé. | transaction unique oui |
| RG-X-062 | Aucune écriture en lecture : supprimer l'auto-rattachement à l'ouverture d'une fiche | COO → REC | lecture de la fiche affiche. | `GET` idempotent sans effet de bord. | test : deux ouvertures successives de la fiche ne créent aucun lien ni historique. | transaction unique non (invariant) |
| RG-X-063 | Rattachement par la Réception ne vaut pas validation ; validation possible à tout moment (…) | bidirectionnel | rattachement par `recep` ; validation tardive. | aucune condition de statut du dossier/de l'instruction (RG-COO-001). | test de rejet : rattachement par `recep` ⇒ état `A_CONFIRMER_DOUTE`, jamais `VALIDEE`. | transaction unique oui |
| RG-X-064 | Quantité Broadcast modifiée après réception : l'attendu se recalcule, les liens et le (…) | COO → REC | lecture de Broadcast ; arrivée de la prépa. | ligne avec liens actifs. | test : `qte` Broadcast de 100 → 80 avec reçu 90 ⇒ statut « Surplus » (+12,5 %), alerte levée, aucun lien retiré. | transaction unique oui |
| RG-X-065 | Dossier ou DA annulé après réception : affiches conservées en stock, alerte à la (…) | COO → REC | passage du dossier à `ANNULE` / ligne `ANNULEE`. | affiches rattachées. | aucun mouvement de stock créé ; test de rejet : le stock de l'affiche est inchangé. | transaction unique oui |

### 6.3 Production (déroulant, fixe/pliage/bus, UM, expédition) et réception (RG-X-075 à 088)
Interactions entre la préparation/production et la disponibilité physique ou le stock des affiches.

| RG-X | Règle | Sens | Transition déclenchante | État de l'autre module / conditions | Résultat attendu | Atomicité |
|---|---|---|---|---|---|---|
| RG-X-075 | Visuel arrivé après la préparation des trains (déroulant) | REC → COO | réception / rattachement d'une affiche dont le thème n'est couvert par aucune position de train du dossier ; nouvelle préparation Broadcast. | fenêtre de l'alerte : toute préparation envoyée à partir de la nuit du jeudi au vendredi S-2 jusqu'au vendredi de la semaine S (fenêtre contradictoire avec la deadline Pré-Prod du jeudi S-2 16 h : Q-266) ; sans le mail, la plateforme ne (…) | alerte + mail (liste de distribution gérée dans Administration) ; trains non exportés : couverture recalculée (RG-COO-208) ; trains exportés : figés (RG-COO-223). | transaction unique oui |
| RG-X-076 | Dossier fixe / pliage / bus arrivé après la libération de la semaine | COO → REC (le déclencheur est l'arrivée (…) | intégration de la préparation (alimentation, coo1) ou réception d'une affiche sur un dossier de semaine libérée. | libération existante pour (atelier, semaine) ; date de la préparation > date de libération ; la libération ne dépend pas de la validation admin (RG-X-084). | alerte `APRES_LIBERATION` + mail ; aucune modification des UM déjà créées. | transaction unique oui |
| RG-X-077 | Dernière minute sur un train déjà en production | COO → REC (bidirectionnel avec (…) | intégration d'une modification Broadcast (nouvelle face, thème changé, quantité changée) sur un train EN_PROD. | train au statut EN_PROD ou au-delà ; la reprise de l'afficheur par panneau (RG-COO-207) est neutralisée sur ce train. | modification tracée + alerte critique + mail ; aucun statut modifié. | transaction unique oui |
| RG-X-078 | Préparation renvoyée par Broadcast avant ou après l'export des trains | COO → REC | intégration d'une préparation / de faces / d'instructions déjà connues. | le moment de l'Instruction OK automatique (jeudi 14 h par bouton, option (a) recommandée, ou dès l'arrivée de la prépa, option (b)) n'est pas tranché (EX-COO-022, Q60). | voir Énoncé. | transaction unique oui |
| RG-X-079 | Disponibilité physique des affiches pour la préparation (reçu, contrôle, couverture) | REC → COO | réception / contrôle / rebut d'une affiche (REC), changement de rattachement. | reçu = Σ `alloc` des affiches rattachées au thème ; le surplus > 10 % est signalé ; l'entretien est compté dans l'attendu. | recalcul de la couverture (transaction commune avec l'écriture du reçu). | transaction unique oui |
| RG-X-080 | Le reçu se rattache au visuel, jamais au destinataire | REC → COO | calcul de couverture / d'indicateurs. | règle de couverture « départ le plus proche servi d'abord » à confirmer (Q41 de la maquette). | indicateurs et statuts d'unité. | transaction unique non |
| RG-X-081 | « Rendre la main » : conséquences sur le dossier, les affiches reçues et la validation (…) | COO → REC | « Rendre la main » (unitaire) / déblocage de préparation (coo1). | unités non EN_PROD. | statuts de dossier et d'unité ; les affiches restent rattachées. | transaction unique oui |
| RG-X-082 | Correction d'intitulé par la plateforme : feuille de stock à refaire et alerte Broadcast (…) | COO → REC | validation de la modale « Corriger l'intitulé ». | thème et annonceur non vides. | tag « Feuille à refaire » sur les affiches ; mail éventuel. | transaction unique oui |
| RG-X-083 | L'export des trains ne dépend ni de la validation admin ni de la réception complète | COO → REC | export des trains ; réception d'affiche après export. | aucune condition sur `validationAdmin`. | aucun refus lié à la validation admin ou au reçu. | transaction unique non |
| RG-X-084 | Création des UM, libération et préparation de l'unitaire indépendantes de la réception et (…) | COO → REC | toute action de l'unitaire. | aucune. | aucune interaction bloquante ; la couverture (RG-X-079) pilote seulement EN_ATTENTE → PRET. | transaction unique non |
| RG-X-085 | Affiche arrivée après l'export ou le début de production : rattachement manuel du seul (…) | REC → COO | réception d'affiche / rattachement manuel après export. | voir Énoncé. | rattachement historisé ; couverture recalculée sur les unités non EN_PROD. | transaction unique oui |
| RG-X-086 | Visuel arrivé après le fractionnement : production à part | REC → COO | réception d'un visuel dont la position est fractionnée. | position marquée fractionnée. | unité créée ou couverte ; indicateurs mis à jour. | transaction unique oui |
| RG-X-087 | Sorties de stock déclenchées par l'expédition des unités | COO → REC (stock par affiche, module (…) | « Fin de journée » (RG-COO-269) ; scan Milk run. | stock = somme des mouvements ; une seule sortie par unité expédiée. | mouvements de stock créés dans la même transaction que le passage à EXPEDIE. | transaction unique oui |
| RG-X-088 | Emplacement des affiches (allée, rayon) saisi à la réception et utilisé par les trains et (…) | REC → COO | affichage / impression. | emplacement renseigné (sinon colonne vide). | lecture seule. | transaction unique non |

### 6.4 Scénarios types : transition × état de l'autre module
Synthèse des cas croisés à tester à l'étape 7 (à valider).

| Transition déclenchante | État de l'autre module | Résultat attendu | RG-X |
|---|---|---|---|
| Réception : valider la réception (dossier connu, cas sûr) | Coordination : ligne attendue active, dossier PREPARATION_RECUE ou A_TRAITER | Affiche créée, validation admin proposée (A_CONFIRMER_PROPOSE), aucune validation tant qu'une personne n'a pas confirmé | RG-X-001, RG-X-063, RG-X-028 |
| Réception : valider la réception avec motif de doute (format, thème multiple, sans IP) | Coordination : instruction à n'importe quel statut | Validation admin A_CONFIRMER_DOUTE, alerte « Validation admin à confirmer », alerte « sans IP » si besoin | RG-X-002, RG-X-009 |
| Réception : palette contrôlée | Coordination : validation admin non faite | Stock réel posé et feuille définitive imprimable ; la validation admin reste à faire (circuits indépendants) ; effets de validation (picking, rack) non produits | RG-X-053, RG-X-005, RG-X-028 |
| Coordination : annuler la validation admin | Réception : palette CONTROLEE, stock posé | Validation redevient à confirmer (motif ANNULEE) ; aucun mouvement de stock créé, statut de la palette inchangé ; 409 si l'affiche n'était pas validée | RG-X-050 |
| Réception : créer une réception inconnue | Coordination : aucun dossier rattaché | Alerte « Réception inconnue à identifier » à la Coordination du site ; compteur du menu mis à jour | RG-X-006, RG-X-021 |
| Coordination (coord/admin) : rattacher une réception inconnue | Réception : RECEPTION.A_IDENTIFIER | Palette A_CONTROLER dans le sas ; validation posée si coord/admin, A_CONFIRMER_DOUTE si recep | RG-X-051, RG-X-007, RG-X-030 |
| Coordination : signaler « Dossier introuvable » | Réception : RECEPTION.A_IDENTIFIER | INTROUVABLE (date) ; un signalement répété met à jour la date sans dupliquer l'alerte | RG-X-054, RG-X-008 |
| Réception : retrait du dernier dossier d'une affiche | Coordination : affiche VALIDEE ou à confirmer | Affiche redevient ORPHELINE / réception inconnue ; validation effacée ; recalculs | RG-X-013, RG-X-058 |
| Coordination : thème modifié dans Broadcast après validation | Réception : affiche rattachée, palette contrôlée | Validation à refaire (motif THEME), tag « Feuille à refaire », alerte ; mail aux chefs d'équipe si production lancée | RG-X-057, RG-X-012 |
| Coordination : ligne attendue fermée ou annulée | Réception : affiche avec lien actif | Lien déplacé, jamais perdu ; affiche reste Identifiée, stock intact | RG-X-055, RG-X-065 |
| Coordination : quantité Broadcast modifiée (100 -> 80) | Réception : reçu 90 | Attendu recalculé, statut Surplus (+12,5 %), liens et stock inchangés | RG-X-064 |
| Coordination : déblocage ou « Rendre la main » | Réception : affiches validées et reçues | Validation admin et affiches reçues inchangées ; statuts de dossier et d'unité recalculés | RG-X-059, RG-X-081 |
| Réception : affiche reçue après l'export des trains ou la libération | Coordination : trains exportés / semaine libérée | Alerte (APRES_LIBERATION / après export), rattachement manuel du seul surplus ; unités déjà créées non modifiées | RG-X-010, RG-X-011, RG-X-076, RG-X-085 |
| Coordination : export des trains | Réception : validation admin non faite ou réception incomplète | Export autorisé, aucun refus lié à la validation admin ou au reçu | RG-X-083 |
| Réception : réception, contrôle, rebut d'une affiche | Coordination : unité du train EN_ATTENTE | Couverture recalculée dans la même transaction ; passage EN_ATTENTE -> PRET si toutes les affiches reçues | RG-X-003, RG-X-079, RG-X-080 |
| Coordination : fin de journée (unités expédiées) | Réception : stock par affiche | Une sortie de stock par unité expédiée, dans la même transaction que le passage à EXPEDIE | RG-X-087 |
| Coordination : lecture de la fiche affiche | Réception : n'importe quel état | Aucune écriture en lecture (suppression de l'auto-rattachement) | RG-X-062 |

### 6.5 Inventaire des RG-X : où chaque règle est implémentée (étape 7, 2026-11-05)
[Audit final 2026-11-06 : recompté par `docs/_travail/controle-tracabilite.mjs` : RG-X = 33 FAIT, 20 PARTIEL, 1 À FAIRE (RG-X-061), 0 BLOQUÉE ; RG-X-084 et RG-X-076 PARTIEL (hypothèse Q-265 (c) à valider), RG-X-088 PARTIEL (preuve faible).] Vérifié dans le code (pas seulement dans la matrice) : 35 règles FAIT, 19 PARTIEL, 0 BLOQUÉE (RG-X-084 FAIT et RG-X-076 PARTIEL depuis l'étape 8 lot 1, Q-265 option (c) HYPOTHÈSE PRISE). Une règle n'est FAIT que si elle est implémentée ET testée par une cellule de §6.6 (ou par les tests de son parcours) ; l'audit (spec-auditor) reste à passer. Les statuts PARTIEL disent ce qui manque (question ou écart).

| RG-X | Règle | Statut | Implémentation (fichier:fonction) | Tests |
|---|---|---|---|---|
| RG-X-001 | Valider la réception : proposition de rattachement / validation admin | FAIT | …/coordination/validation-admin.ts:affichesDesDossiers ; …/reception/bon-livraison.ts (mode BL, Q-184) ; validation.ts:validerReception (aucune validation posée) | coordination/validation-admin.int.test.ts ; coordination/validation-admin-complement.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-01, R-02) ; interactions/atomicite.int.test.ts (A-01, A-02) ; e2e/interactions.spec.ts |
| RG-X-002 | Motifs de doute posés par la Réception | FAIT | …/coordination/validation-admin.ts:motifsDoute | coordination/validation-admin.int.test.ts ; coordination/validation-admin-complement.int.test.ts |
| RG-X-003 | Réception : unités en attente → prêtes à produire | FAIT | …/coordination/unites-pretes.ts:statutsTrainsDesDossiers, unitesDevenuesPretes ; …/reception/validation.ts:validerReception ; …/reception/inconnues.ts:rattacherInconnue ; …/coordination/trains.ts:couverture, statutUnite | interactions/reception-vers-coordination.int.test.ts (R-17) |
| RG-X-004 | Statut de la ligne attendue et n° d'affiche lus par la Coordination | FAIT | …/reception/lignes.ts:recalculerLigne ; …/coordination/effets-validation.ts:marqueEtatReservations, numeroVisibleSuiviProd | interactions/reception-vers-coordination.int.test.ts (R-05, R-08) ; interactions/broadcast-et-lignes.int.test.ts (B-03) |
| RG-X-005 | « Affiche reçue » indépendant de la validation admin | FAIT | …/reception/validation.ts (mouvement de réception à l’arrivée, sans condition de validation) | reception/audit-rec.int.test.ts (RG-REC-044) ; interactions/reception-vers-coordination.int.test.ts (R-01, R-02) ; interactions/coordination-vers-reception.int.test.ts (C-07) ; e2e/interactions.spec.ts |
| RG-X-006 | Réception inconnue créée → alerte Coordination | FAIT | …/reception/alertes.ts (RG-REC-185) ; …/alertes/service.ts | interactions/reception-vers-coordination.int.test.ts (R-09, R-13) |
| RG-X-007 | Rattachement d'une inconnue : validation selon le rôle | FAIT | …/reception/inconnues.ts:rattacherInconnue | reception/inconnues.int.test.ts (RG-REC-111) ; interactions/reception-vers-coordination.int.test.ts (R-10) |
| RG-X-008 | « Dossier introuvable » → alerte Coordination du site | PARTIEL | …/reception/inconnues.ts:signalerIntrouvable ; …/reception/alertes.ts (RG-REC-186) | interactions/reception-vers-coordination.int.test.ts (R-11) ; interactions/coordination-vers-reception.int.test.ts (C-06) ; interactions/concurrence.int.test.ts (K-07) |
| RG-X-009 | Réception sur un dossier sans IP → alerte Coordination | FAIT | …/coordination/alertes-coordination.ts (SANS_IP, RG-COO-071) ; …/reception/alertes.ts (RG-REC-184) | interactions/reception-vers-coordination.int.test.ts (R-04) |
| RG-X-010 | Affiche ou visuel arrivé après la préparation ou la libération | PARTIEL | …/coordination/alertes-coordination.ts (RG-COO-053 / 073 côté préparation ; bloc RG-X-011 côté réception) | interactions/reception-vers-coordination.int.test.ts (R-18) ; interactions/ecarts-connus.int.test.ts (it.todo) |
| RG-X-011 | Affiche reçue après l'export des trains | FAIT | …/coordination/alertes-coordination.ts (bloc « RX- », RG-X-011) | interactions/reception-vers-coordination.int.test.ts (R-18) |
| RG-X-012 | Thème changé après réception → validation à refaire, feuille à refaire | FAIT | …/reception/affiches.ts:changerTheme | interactions/reception-vers-coordination.int.test.ts (R-12) ; interactions/coordination-vers-reception.int.test.ts (C-03) ; interactions/atomicite.int.test.ts (A-10 : rollback) |
| RG-X-013 | Retrait d'un rattachement : recalculs | FAIT | …/reception/rattachement.ts:retirerRattachement | reception/affiches.int.test.ts (RG-REC-137) ; interactions/reception-vers-coordination.int.test.ts (R-13) ; e2e/interactions.spec.ts |
| RG-X-014 | Rattachement manuel vaut validation si Coordination | FAIT | …/reception/affiches.ts:appliquerValidationSelonRole ; inconnues.ts:rattacherInconnue | coordination/effets-validation.int.test.ts ; reception/affiches.int.test.ts |
| RG-X-015 | Valider / Annuler la validation depuis la fiche affiche | FAIT | …/reception/affiches.ts:changerValidationAdmin (donneesValidation / donneesAnnulation) | coordination/effets-validation.int.test.ts ; reception/affiches.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-15, R-20) ; interactions/coordination-vers-reception.int.test.ts (C-11) |
| RG-X-016 | Rattachement plusieurs-à-plusieurs : reçu compté une fois | PARTIEL | …/reception/stock.ts:assertRepartitionPossible (reçu compté une fois) | reception/socle-complement.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-06) ; interactions/ecarts-connus.int.test.ts (it.todo) |
| RG-X-017 | Écart de contrôle → recalcul et alerte | FAIT | …/reception/controle.ts:validerControle ; …/reception/alertes.ts (RG-REC-183) | interactions/reception-vers-coordination.int.test.ts (R-08) ; interactions/atomicite.int.test.ts (A-03) |
| RG-X-018 | Réception partielle : reste et alerte | PARTIEL | …/reception/alertes.ts (RG-REC-182) ; …/reception/validation.ts (complément) | interactions/reception-vers-coordination.int.test.ts (R-05) |
| RG-X-019 | Dossier livré sur deux plateformes | PARTIEL | …/reception/bon-livraison.ts (RG-REC-024) | interactions/reception-vers-coordination.int.test.ts (R-06) |
| RG-X-020 | Réception avant IP : ligne provisoire | FAIT | …/coordination/alimentation-lignes.ts:fermerProvisoires | interactions/broadcast-et-lignes.int.test.ts (B-01) ; coordination/lignes-attendues.int.test.ts |
| RG-X-021 | Compteurs des menus Coordination | PARTIEL | …/reception/compteurs.ts ; …/coordination/dossiers.ts (filtre va=A_CONFIRMER) | interactions/coordination-vers-reception.int.test.ts (C-08) |
| RG-X-022 | Retour vers Broadcast : affiche reçue et associée | PARTIEL | …/coordination/retour-broadcast.ts:populationRetour | interactions/coordination-vers-reception.int.test.ts (C-07) ; interactions/ecarts-connus.int.test.ts (it.todo) |
| RG-X-028 | Circuits indépendants : réception et prépa | FAIT | …/coordination/effets-validation.ts (en-tête : circuits indépendants) | interactions/coordination-vers-reception.int.test.ts (C-05) ; interactions/concurrence.int.test.ts (K-08) ; coordination/effets-validation.int.test.ts (RG-COO-027) |
| RG-X-030 | Rattachement d'une inconnue à plusieurs dossiers | FAIT | …/reception/inconnues.ts:rattacherInconnue (plusieurs lignes) | reception/inconnues.int.test.ts (RG-REC-108) ; interactions/reception-vers-coordination.int.test.ts (R-10) |
| RG-X-050 | Annulation d'une validation admin : conséquences côté Réception | FAIT | …/coordination/effets-validation.ts:changerValidationCoordination, donneesAnnulation ; reception/affiches.ts:changerValidationAdmin | coordination/effets-validation.int.test.ts ; coordination/effets-validation-complement.int.test.ts ; coordination/alertes-preprod.int.test.ts ; interactions/coordination-vers-reception.int.test.ts (C-01) ; interactions/concurrence.int.test.ts (K-02) ; interactions/atomicite.int.test.ts (A-05) ; e2e/interactions.spec.ts |
| RG-X-051 | Rattachement d'une réception inconnue par la Coordination : validation et entrée de la palette dans le sas | FAIT | …/reception/inconnues.ts:rattacherInconnue | coordination/effets-validation.int.test.ts ; reception/inconnues.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-10) ; interactions/coordination-vers-reception.int.test.ts (C-06) ; interactions/concurrence.int.test.ts (K-07) |
| RG-X-052 | Rattachement manuel du surplus à un autre dossier (même après validation ou début de production) | FAIT | …/reception/affiches.ts:rattacherAutreDossier | coordination/effets-validation.int.test.ts ; reception/audit-rec.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-14) |
| RG-X-053 | Affiche à doute : tant que non confirmée, ses effets de validation ne sont pas produits | FAIT | …/coordination/validation-admin.ts:etatValidation ; …/reception/impressions.ts:editionPicking (validées seulement) | coordination/validation-admin.int.test.ts ; coordination/validation-admin-complement.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-07) ; interactions/coordination-vers-reception.int.test.ts (C-07) |
| RG-X-054 | Réception inconnue traitée par la Coordination : « Signaler » et dossier introuvable | PARTIEL | …/reception/inconnues.ts:signalerIntrouvable | reception/inconnues.int.test.ts (RG-REC-112) ; interactions/reception-vers-coordination.int.test.ts (R-11) ; interactions/coordination-vers-reception.int.test.ts (C-06) |
| RG-X-055 | Ligne fermée ou annulée : le lien de l'affiche est déplacé, jamais perdu | FAIT | …/coordination/validation-admin.ts (LIGNE_FERMEE) ; …/coordination/alimentation-lignes.ts (RG-COO-087) | interactions/broadcast-et-lignes.int.test.ts (B-02) |
| RG-X-056 | Saisie des IP : déplacement automatique des affiches du provisoire vers le thème | FAIT | …/coordination/alimentation-lignes.ts:fermerProvisoires | interactions/broadcast-et-lignes.int.test.ts (B-01) |
| RG-X-057 | Thème modifié dans Broadcast après la validation : validation à refaire et feuille de stock à refaire | PARTIEL | …/coordination/themes.ts:reprendreThemeBroadcast | coordination/alertes-preprod.int.test.ts ; e2e/coordination-alertes.spec.ts ; interactions/coordination-vers-reception.int.test.ts (C-03) ; interactions/atomicite.int.test.ts (A-06) |
| RG-X-058 | Retrait ou dissociation du dernier dossier par la Coordination : l'affiche redevient réception inconnue | FAIT | …/reception/rattachement.ts:retirerRattachement | coordination/effets-validation.int.test.ts ; reception/inconnues.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-13) ; interactions/concurrence.int.test.ts (K-03) ; e2e/interactions.spec.ts |
| RG-X-059 | Déblocage / « Rendre la main » : validation admin et affiches reçues inchangées | FAIT | …/coordination/deblocage.ts:debloquerGroupe | coordination/deblocage.int.test.ts |
| RG-X-060 | Thème partagé par plusieurs dossiers : le reçu est compté une seule fois | PARTIEL | …/reception/stock.ts:assertRepartitionPossible + affiche.ts (écriture versionnée contre la concurrence) ; service.ts:lireStockAffiche | reception/socle.int.test.ts ; socle-complement.int.test.ts ; socle-audit.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-06) |
| RG-X-061 | Réception partielle : validation de ce qui est reçu, complément proposé puis confirmé | PARTIEL | — | interactions/ecarts-connus.int.test.ts (it.todo ; R-05 couvre RG-X-018) |
| RG-X-062 | Aucune écriture en lecture : supprimer l'auto-rattachement à l'ouverture d'une fiche | FAIT | …/reception/affiches.ts:lireFicheAffiche (aucune écriture) | reception/audit-rec.int.test.ts (RG-REC-142) ; interactions/reception-vers-coordination.int.test.ts (R-15) |
| RG-X-063 | Rattachement par la Réception ne vaut pas validation ; validation possible à tout moment du process | FAIT | …/reception/affiches.ts:appliquerValidationSelonRole | reception/audit-rec.int.test.ts (RG-REC-120) ; interactions/reception-vers-coordination.int.test.ts (R-10, R-12) ; e2e/interactions.spec.ts |
| RG-X-064 | Quantité Broadcast modifiée après réception : l'attendu se recalcule, les liens et le stock restent | FAIT | …/coordination/edition.ts:appliquerVersionBroadcast (recalculerLigne dans la transaction) | coordination/instruction-ok-complement.int.test.ts ; interactions/broadcast-et-lignes.int.test.ts (B-03) ; interactions/coordination-vers-reception.int.test.ts (C-04) |
| RG-X-065 | Dossier ou DA annulé après réception : affiches conservées en stock, alerte à la Coordination | FAIT | …/coordination/integration.ts:annulerDossier | coordination/socle.int.test.ts ; coordination/socle-complement.int.test.ts ; interactions/reception-vers-coordination.int.test.ts (R-03, R-16) ; interactions/broadcast-et-lignes.int.test.ts (B-02) ; interactions/concurrence.int.test.ts (K-04) ; interactions/atomicite.int.test.ts (A-04) |
| RG-X-075 | Visuel arrivé après la préparation des trains (déroulant) | PARTIEL | …/coordination/alertes-coordination.ts (bloc « RX- ») | interactions/reception-vers-coordination.int.test.ts (R-18) |
| RG-X-076 | Dossier fixe / pliage / bus arrivé après la libération de la semaine | PARTIEL (étape 8) | …/coordination/alertes-coordination.ts (alerte LIB-), unitaire.ts (repère) ; mail non envoyé Q-375, fenêtre Q-266 | coordination/liberation-colisage.int.test.ts |
| RG-X-077 | Dernière minute sur un train déjà en production | PARTIEL | …/coordination/alertes-coordination.ts (DM_FICHIER, RG-COO-074) | interactions/broadcast-et-lignes.int.test.ts (B-04) ; interactions/ecarts-connus.int.test.ts (it.todo) |
| RG-X-078 | Préparation renvoyée par Broadcast avant ou après l'export des trains | PARTIEL | …/coordination/integration.ts ; …/coordination/alertes-coordination.ts (RG-COO-053) | coordination/instruction-ok-complement.int.test.ts |
| RG-X-079 | Disponibilité physique des affiches pour la préparation (reçu, contrôle, couverture) | FAIT | …/coordination/trains.ts:couverture | interactions/reception-vers-coordination.int.test.ts (R-17, R-21) |
| RG-X-080 | Le reçu se rattache au visuel, jamais au destinataire | FAIT | …/coordination/trains.ts:couverture | interactions/reception-vers-coordination.int.test.ts (R-17) |
| RG-X-081 | « Rendre la main » : conséquences sur le dossier, les affiches reçues et la validation admin | PARTIEL | …/coordination/unitaire.ts ; …/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:rendreLaMain | coordination/unitaire.int.test.ts |
| RG-X-082 | Correction d'intitulé par la plateforme : feuille de stock à refaire et alerte Broadcast ≠ Circé | PARTIEL | …/coordination/unitaire.ts ; …/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:corrigerIntitule | coordination/unitaire.int.test.ts ; e2e/coordination-unitaire.spec.ts |
| RG-X-083 | L'export des trains ne dépend ni de la validation admin ni de la réception complète | FAIT | …/coordination/export-trains.ts (aucune condition sur la validation admin ni le reçu) | interactions/reception-vers-coordination.int.test.ts (R-19) |
| RG-X-084 | Création des UM, libération et préparation de l'unitaire indépendantes de la réception et de la validation admin | FAIT (étape 8) | …/coordination/unitaire.ts ; unitaire-creation.ts ; unitaire-affiches.ts ; garde statique RG-COO-027 | coordination/liberation-colisage.int.test.ts (RG-X-084) |
| RG-X-085 | Affiche arrivée après l'export ou le début de production : rattachement manuel du seul surplus | PARTIEL | …/reception/rattachement.ts:rattacher ; …/coordination/alertes-coordination.ts | interactions/reception-vers-coordination.int.test.ts (R-14, R-18 : validation conservée, alerte, trains figés) ; ecarts-connus.int.test.ts (it.todo : couverture hors EN_PROD) |
| RG-X-086 | Visuel arrivé après le fractionnement : production à part | FAIT | …/coordination/trains.ts:fractionnerTrains | interactions/broadcast-et-lignes.int.test.ts (B-05) ; coordination/trains.int.test.ts |
| RG-X-087 | Sorties de stock déclenchées par l'expédition des unités | PARTIEL | …/coordination/colis.ts:sortiesStock ; …/reception/stock.ts:enregistrerMouvementAutomatique | coordination/colis.int.test.ts ; interactions/coordination-vers-reception.int.test.ts (C-09) ; interactions/atomicite.int.test.ts (A-07) |
| RG-X-088 | Emplacement des affiches (allée, rayon) saisi à la réception et utilisé par les trains et le picking | FAIT | …/coordination/trains.ts:ficheTrain (emplacement) | interactions/reception-vers-coordination.int.test.ts (R-22) |

### 6.6 Matrice d'impact VÉRIFIÉE : une cellule = un test d'intégration (étape 7, 2026-11-05)
Colonnes : cellule · action déclenchante × état de l'autre module → résultat attendu (autorisé / bloqué avec règle et code / effet induit) · règle ou question · test. Tous les tests sont dans `apps/api/test/interactions/` (API réelle, base de test) ; **RC** = `reception-vers-coordination`, **CR** = `coordination-vers-reception`, **BL** = `broadcast-et-lignes`, **K** = `concurrence`, **A** = `atomicite`. Les cellules « non spécifiée » renvoient à une question et ne sont pas inventées.

#### 6.6.1 Réception → Coordination (RC)
| Cellule | Action de Réception × état de la Coordination | Résultat attendu | Règle / Q |
|---|---|---|---|
| R-01 | Valider la réception × dossier « À traiter » | affiche créée, lien BL proposé, AUCUNE validation admin, mouvement de réception, stock posé | RG-X-001, 005, 063 |
| R-02 | Valider la réception × dossier « Préparation reçue » | idem (la prépa n'est pas une condition) | RG-X-001, 028 |
| R-03 | Valider la réception × ligne fermée (dossier annulé), exclue ou purgée | 422 `REC_LIGNE_INDISPONIBLE` (RG-REC-014), rien n'est écrit | RG-X-065 |
| R-04 | Valider la réception × ligne sans IP | 422 `REC_INTITULE_REQUIS` sans intitulé ; avec intitulé : motif SANS_IP (doute) + alerte « Réception sans IP » | RG-X-009, 020 |
| R-05 | Réception partielle puis complément × affiche validée | ligne « Partielle » + alerte « Visuel reçu en partie » ; le complément s'ajoute à la MÊME affiche, validation du 1er lot conservée ; complément sur ligne non partielle : 422 `REC_COMPLEMENT_INVALIDE` ; **nouvelle proposition du complément : NON IMPLÉMENTÉE** | RG-X-018, 061 ; Q-399 |
| R-06 | Rattacher à plusieurs dossiers / deux plateformes | reçu compté UNE fois (100 = 50+30+20) ; répartition > reçu : 422 ; BL sur deux plateformes : 422 `REC_BL_DEUX_PLATEFORMES` | RG-X-060, 016, 019 |
| R-07 | Contrôle de la palette × validation admin non faite | contrôle autorisé (200) ; stock, feuille ; validation toujours à faire ; ni picking ni étiquette rack avant validation, les deux après | RG-X-028, 053, 005 |
| R-08 | Contrôle avec écart > 10 % | ligne « Surplus », alerte « Écart de réception » visible de la Coordination | RG-X-017 ; Q-133 |
| R-09 | Créer une réception inconnue | alerte « Réception inconnue à identifier », badge +1, palette hors sas | RG-X-006, 021 ; Q-110 |
| R-10 | Rattacher une inconnue × ligne du dossier (coord / recep / plusieurs dossiers / ligne fermée) | coord : validée + palette dans le sas ; recep : « à confirmer » motif BL ; plusieurs dossiers : motif MULTI ; ligne fermée : 422 `REC_LIGNE_CIBLE_ANNULEE` | RG-X-007, 030, 051, 063 |
| R-11 | Signaler « Dossier introuvable » | alerte « Dossier introuvable » (une seule), 2e signalement 409 | RG-X-008, 054 ; Q-110, Q-221 |
| R-12 | Changer de thème × affiche validée | coord : reste validée ; recep : validation à refaire (« à confirmer », motif BL) ; feuille à refaire + alerte ; autre dossier : 422 `REC_THEME_AUTRE_DOSSIER` | RG-X-012 ; Q-143 |
| R-13 | Retirer le dernier dossier × affiche validée | orpheline, validation effacée, palette « À identifier », alerte d'inconnue ; 2e retrait : 409 | RG-X-013, 058 |
| R-14 | Rattacher le surplus à un autre dossier × affiche validée | validation conservée, lien MAIN, feuille à refaire, stock inchangé | RG-X-052, 085 |
| R-15 | Valider / annuler depuis la fiche affiche (6 profils) ; lire la fiche | coord / admin : 200 ; autres : 403 ; la lecture n'écrit rien | RG-X-015, 062 |
| R-16 | Dossier annulé / prépa renvoyée × affiche reçue | affiche, validation, stock intacts, aucun mouvement, alerte « ligne annulée » ; 100 → 80 avec 90 reçus : Surplus | RG-X-065, 064 |
| R-17 | Réception × train en attente | train PRET, « n unité(s) prête(s) à produire » (réception et rattachement d'inconnue) ; aucune unité si aucun visuel couvert ; le reçu se rattache au visuel | RG-X-003, 079, 080 ; Q-102, Q-280 |
| R-18 | Affiche reçue après l'export des trains | alerte « Rajout après préparation » (Important, Coordination + chefs d'équipe), trains figés ; réception AVANT l'export : aucune alerte ; visuel absent des trains : message dédié | RG-X-011, 010, 075 ; Q-398, Q-266, Q-375 |
| R-19 | Exporter les trains × validation non faite / aucun reçu | export autorisé | RG-X-083 |
| R-20 | Droits | 6 profils sur la validation ; alertes lisibles | RG-X-015, 007 |
| R-21 | Rebut × couverture | le rebut réduit le STOCK, pas le REÇU : ligne « Complète », train PRÊT (rebut > stock refusé) | RG-REC-017, RG-X-079 ; Q-280 |
| R-22 | Allée / rayon saisis au contrôle | lus par la position du train (lecture seule) | RG-X-088 |

#### 6.6.2 Coordination → Réception (CR)
| Cellule | Action de Coordination × état de la Réception | Résultat attendu | Règle / Q |
|---|---|---|---|
| C-01 | Annuler la validation × palette CONTRÔLÉE, stock posé | « à confirmer » motif ANNULEE, AUCUN mouvement, palette inchangée, étiquette rack inchangée (RG-COO-023) ; jamais validée : 409 | RG-X-050 ; Q-202 |
| C-02 | Valider × palette À contrôler / contrôlée / réception inconnue / dossier annulé | autorisé à tout moment sauf réception inconnue (409 « à rattacher d'abord ») ; palette inchangée ; dossier annulé : validation toujours possible (HYPOTHÈSE PRISE Q-402, l'énoncé de RG-X-065 dit « sans objet ») | RG-X-028, 063, 065 ; Q-402 |
| C-03 | Reprendre le thème de Broadcast × affiche validée, palette contrôlée | validation à refaire, feuille à refaire, alerte ; stock et palette inchangés ; rien à reprendre : 409 | RG-X-057, 012 ; Q-210 |
| C-04 | Appliquer la version Broadcast × réception / dossier annulé | attendu recalculé, liens, stock, validation inchangés ; dossier annulé : 409 `TRANSITION_INTERDITE` (RG-COO-062) | RG-X-064, 065 |
| C-05 | Instruction OK × validation non faite, palette à contrôler | autorisée ; rien ne change côté Réception | RG-X-028 |
| C-06 | Signaler / rattacher × palette pas « À identifier » | 409, aucune alerte, aucun lien ; signalement : palette et stock inchangés | RG-X-054, 051 |
| C-07 | Retour Broadcast « associée » | liée ET validée seulement ; annulation → plus associée ; doute reçu et contrôlé : jamais associée | RG-X-022, 053 ; Q-151 |
| C-08 | Compteurs des menus | badges Réception et nombre de dossiers « à confirmer » suivent réception, contrôle, validation, inconnue | RG-X-021 |
| C-09 | Fin de journée × stock des affiches reçues | sortie prélevée sur l'affiche REÇUE par le BL ; réception absente : aucune sortie, manquant tracé, colis « Terminé » ; stock insuffisant : plafonné | RG-X-087 ; Q-281, Q-197 |
| C-10 | Unitaire × validation / réception | Couverte depuis l'étape 8 (Q-265 option (c)) : Colisage et « Préparer » donnent le même résultat avant et après la validation admin d'une affiche (`liberation-colisage.int.test.ts`, RG-X-084) | RG-X-084 ; Q-265 |
| C-11 | Annuler une validation (6 profils) | coord / admin : 200 ; réception, chef d'équipe, commercial : 403 | RG-X-050, 015 |

#### 6.6.3 Lecture de Broadcast, trains, lignes (BL)
| Cellule | Action × état de la Réception | Résultat attendu | Règle / Q |
|---|---|---|---|
| B-01 | IP saisies après réception (provisoire → thème) | affiche déplacée seule si un thème ; sinon lien conservé sur la ligne fermée + alerte ; validation, stock, palette, mouvements inchangés | RG-X-020, 056 ; Q-208 |
| B-02 | Ligne disparue de Broadcast après réception | ligne fermée, lien conservé, affiche « Identifiée », stock intact, alerte ; ligne revue : pas de fermeture | RG-X-055, 065 |
| B-03 | Quantité Broadcast 100 → 80, 90 reçus | « Surplus », liens et stock inchangés | RG-X-064 |
| B-04 | Dernière minute × train en production | alerte critique, AUCUN statut de train modifié ; traitement cible : Q-282 OUVERTE | RG-X-077 |
| B-05 | Visuel arrivé après le fractionnement | position fractionnée hors couverture, train PRÊT | RG-X-086 |

#### 6.6.4 Concurrence (K) : Promise.all de requêtes réelles
| Cellule | Actions simultanées | Résultat attendu |
|---|---|---|
| K-01 | deux validations (même version) | 200 + 409, une trace |
| K-02 | deux annulations ; valider ∥ annuler | 200 + 409, une trace ; état jamais mixte |
| K-03 | valider ∥ retirer le dernier dossier | jamais d'affiche orpheline validée ; palette cohérente ; stock intact |
| K-04 | réception ∥ annulation du dossier | réception réussie puis signalée, ou refusée SANS rien écrire |
| K-05 | « Valider la sélection » en double | chaque affiche confirmée une fois |
| K-06 | même Idempotency-Key en parallèle (validation, réception) | un seul effet |
| K-07 | rattacher ∥ signaler ; deux rattachements | un gagnant, état cohérent ; Σ liens = quantité reçue |
| K-08 | contrôle ∥ validation admin | 200 + 200 (circuits indépendants) |
| K-09 | deux réceptions sur la même ligne | Σ stock = Σ liens = quantités acceptées, ligne recalculée |

#### 6.6.5 Rollback (A) : échec forcé de l'effet induit, aucune écriture partielle
| Cellule | Échec forcé | Résultat attendu |
|---|---|---|
| A-01 | mouvement de réception | ni livraison, ni réception, ni affiche, ni lien ; ligne inchangée ; clé rejouable |
| A-02 | recalcul de la ligne (dernière écriture) | tout est annulé |
| A-03 | mouvement d'écart de contrôle | palette « À contrôler », stock, emplacement, ligne inchangés |
| A-04 | passage du dossier à « Annulé » | lignes ACTIVES, aucune alerte, affiche intacte |
| A-05 | trace de l'annulation de validation | validation entière, aucun mouvement |
| A-06 | trace de la reprise du thème Broadcast (RG-X-057) | thème, feuille, validation inchangés |
| A-08 | trace de validation au rattachement d'une inconnue (RG-X-051, RG-X-003) | aucun lien, affiche ORPHELINE, palette « À identifier », ligne inchangée ; rattachement suivant OK |
| A-09 | trace d'annulation de validation au retrait du dernier dossier (RG-X-058) | lien actif, affiche validée, palette inchangée |
| A-10 | trace du changement de thème côté Réception (RG-X-012) | lien d'origine actif, thème, validation, feuille inchangés |
| A-07 | sortie de stock de la fin de journée | colis et UM « A expédier », stock intact ; passage suivant OK |

#### 6.6.6 Cellules non réalisées ou bloquées (visibles en `it.todo`, `ecarts-connus.int.test.ts`)
Recomptage au 2026-11-06 (audit final) : 5 `it.todo` dans `ecarts-connus.int.test.ts` : RG-X-061 (nouvelle proposition du complément, Q-399), RG-X-085 (couverture hors EN_PROD, train EN_PROD, Q-280), RG-X-016 (surplus proposé à l'autre dossier, Q-419 ; la Q-123 citée auparavant était hors sujet), RG-X-077 (traitement d'une dernière minute, Q-282), RG-X-022 (batch PEX, Q-151 / Q-005) ; s'y ajoutent 1 `it.todo` RG-COO-204 (Q-257) et 2 `it.todo` NR-063 / NR-064 (Q-418, Q-416) : 8 `it.todo` au total dans la suite d'intégration. Les cellules RG-X-084 (C-10) et RG-X-076, citées avant l'étape 8, ont été réalisées sous HYPOTHÈSE Q-265 option (c) (à valider) : leur `it.todo` a été retiré, les deux règles sont PARTIEL. E2E de bout en bout : `e2e/interactions.spec.ts` (Réception reçoit → Coordination voit « à confirmer » → valide → la Réception le voit → annule → retrait du dernier dossier → réception inconnue).


## 7. Exigences transverses
Impressions/PDF, agent local, APIM, LLM, performances, audit.

Exigences transverses consolidées. Colonne « Portée » : P1 = exigence à satisfaire dans les écrans/parcours Réception et Coordination (étapes 5-6) ; Socle = étape 4 (socle backend commun) ; E8 = étape 8 (dépendance) ; Hors = hors périmètre de la mission. Les EX des ateliers sont cités avec +500 (Q-350). Les contraintes d'ingénierie (CLAUDE.md, MISSION §2) sont signalées « projet » quand les specs ne les écrivent pas.

### 7.1 Authentification, habilitations, périmètre

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Connexion et droits par rôle fournis par le lot 0 (socle). Mécanisme de la cible non spécifié (existant : compte Windows/AD, aucun écran de login) | EX-TRA-001 | Socle | Q-001 (APIM / Entra ID ?) |
| Permissions vérifiées côté serveur, dans le service (l'existant n'a aucun `[Authorize]`, les droits ne masquent que des menus) | EX-TRA-002 ; projet (CLAUDE.md §6) | Socle puis P1 (chaque endpoint) | — |
| Six rôles provisoires ; le sélecteur de rôle de la maquette est un outil de démonstration (en production le rôle vient de l'authentification) | EX-TRA-003 | Socle | Q-003, Q-352, Q-353 |
| Rôle Commerce en lecture seule (pas de boutons d'action) | EX-TRA-004 | P1 (REC lecture) | Q-355 |
| Droits spécifiques : « Valider » réservé Coordination ; droits `validation_admin`, `Zone_Picking`, `fusion_affiche` à reporter | EX-TRA-005 | P1 (validation admin) ; E8 (Zone picking, fusion) | Q-354, Q-352 |
| Site choisi au bandeau 1, valable pour toute l'application ; périmètre utilisateur (`tr_utilisateur_data`) | EX-TRA-006 | Socle + P1 (filtre de tous les écrans) | Q-357, Q-358 |
| Comptes nominatifs : validation et contrôle exigent le nom d'une personne ; adresse mail Cityz, plus d'adresse générique | EX-TRA-007 ; EX-ADM-502 | Socle (identité) ; E8 (gestion des utilisateurs) | Q-001, Q-359 |
| Ré-impression des bagues restreinte (directeurs de plateforme, chefs d'équipe) | EX-ADM-503 | P1 (ECR-COO-11) | Q-356 |
| Sécurité : pas d'identifiants en clair (ISO 27001) ; secrets hors dépôt | EX-TRA-038 | Socle | Q-010 |

### 7.2 Impressions, PDF, agent local d'impression

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Feuille de stock = étiquette rack A4, mention « définitive » ou « temporaire », impression en lot (1 à 5 exemplaires), avec/sans étiquettes rack ; aperçu avant impression | EX-TRA-024 ; ECR-REC-09, ECR-REC-10 | P1 (REC) | Q-002, Q-367 |
| Simplifier l'impression de l'étiquette rack (au moins une étape en moins) et permettre l'impression multiple depuis la liste (3 clics par dossier aujourd'hui) | EX-REC-515, EX-REC-502, EX-TRA-507 | P1 (REC) | — |
| Autres éditions existantes : fiche de préparation (détail/synthèse, Excel), bagues, étiquettes de colis et de rack, picking par semaine, fiche de synthèse, quantités à encoller (bus) | EX-TRA-025 | P1 (bagues, fiche de synthèse : ECR-COO-11, ECR-COO-09) ; E8 (étiquettes colis, picking) | Q-367 |
| Génération PDF : aucune spec de la cible ; contrainte projet « PDF générés côté navigateur uniquement » ; existant RDLC (ReportViewer) PDF/Excel serveur | EX-TRA-026 ; projet (MISSION §2) | Socle (composant d'impression) | Q-368 |
| Agent local d'impression : mode d'appel (navigateur ou API) non tranché ; existant : envoi direct aux imprimantes de la plateforme (étiquette rack à la validation admin) | EX-TRA-024, EX-TRA-025 ; projet | P1 pour les impressions (REC-P01) | Q-002 (bloquante pour les impressions) |
| Code-barres d'étiquette rack : format legacy « A- » + id d'affiche complété à 13 caractères | legacy-admin.md RG-ADM-062 provisoire | P1 (REC) | Q-368 |
| Export « Exporter » en .xlsx (ordre de l'écran, en-tête gras figé, filtre auto, nombres et dates typés) ; seuls les fichiers machine restent CSV ; garder l'extraction Excel sur longue période | EX-TRA-016 ; EX-TRA-505, EX-TRA-513 | P1 (tous les tableaux) | Q-360 |

### 7.3 Authentification externe et intégrations (APIM, Broadcast, Geodis, mail)

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| APIM / Entra ID : accès aux API d'entreprise non décrit par les specs (mention CLAUDE.md §8) | projet | Socle | Q-001 |
| Broadcast : Circé interroge Broadcast à intervalles réguliers (flux destinataires, préparations, trains, instructions, EDR S à S+8) ; ne peut pas écrire dans Broadcast (mail/alerte pour toute correction) ; retour : affiche « associée » seulement si liée et validation admin = 1 (ANO-05) | EX-TRA-039 | P1 (lecture des attendues/préparations) ; E8 (alimentation, retour) | Q-005, Q-377, Q-378, Q-379 |
| Dates de validité et « annule et remplace » des données de l'interface BC | EX-TRA-512, EX-TRA-514 | E8 | Q-378 |
| Interfaces tierces : Geodis (API Zoom, fichier TXT, preuve de livraison), Process Métier (non-conformités), Vendôme/Caire (.ini), SMTP, AD | EX-TRA-040 | Hors P1 sauf Broadcast et Process Métier ; E8 pour Geodis | Q-390, Q-394 |
| Mails conservés : demande de correction à la Pré-Prod (Broadcast), mail « rajout après préparation » à la liste de distribution ; les autres mails sont remplacés par des alertes | EX-TRA-030 | P1 (COO) ; E8 (SMTP) | Q-375 |

### 7.4 LLM

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Fournisseur LLM éventuel via API compatible chat/completions, derrière l'interface `LlmProvider` ; usage fonctionnel possible : reconnaissance visuelle des affiches orphelines (REC-17 hors périmètre avant le 31/12) | projet (CLAUDE.md §3) ; EX-REC-507 | Socle (interface seule) ; usage Hors P1 | Q-369 |

### 7.5 Performances, volumétrie, disponibilité

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Raccrochages en masse sans blocage (Circé « bugge » quand il y a trop de lignes) ; saturation à la génération des fichiers | EX-SCR-506, EX-SCR-514 | P1 (COO) / E8 (GEN) | — |
| Pas de rafraîchissement manuel à chaque changement de filtre ; suppression des « caches » de valeur de filtre ; volumétrie réelle EDR S à S+8 | EX-TRA-504, EX-TRA-506 ; ECR-PIL-03 | P1 (tous les écrans) | — |
| Sauvegarde des données de la veille (« base REF ») ; extraction sur période longue (aujourd'hui mois par mois) | EX-TRA-510, EX-TRA-513 | Hors P1 / E8 | Q-396 |
| Actions de masse sans version : concurrence, double soumission, atomicité (non traités par les specs) | projet (CLAUDE.md §6) | Socle | — |
| Aucun seuil de performance chiffré dans les sources | — | — | Q-373 (seuils) |

### 7.6 Audit, historisation, traçabilité

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Journal des actions lancées, modifiées, ajoutées ; chaque génération de fichiers = lot versionné ; durée de conservation et consultation non précisées | EX-TRA-034 ; ECR-ADM-08 | Socle (journal) ; E8 (écran) | Q-376 |
| Journal d'événements de réception (réception, contrôle, rattachement, changement de thème, retrait, modification, impression et réimpression de feuille, étiquette rack) ; historique de l'affiche (qui, quand) ; dissociation à historiser comme une association | EX-TRA-035 | P1 (REC) | — |
| Historique de la validation admin : nom et date (`validationAdmin_par`, `validationAdmin_le`) ; rattachements par qui et quand, actif/retiré | EX-TRA-036 | P1 (COO) | — |
| Stock = somme des mouvements, chaque mouvement tracé (référence, date, BL, équipe, machine, transporteur, imprimeur, quantité) | EX-TRA-037 | P1 (REC) | — |
| Chaque changement de statut écrit un historique (une machine d'états par entité) | projet (CLAUDE.md §6) ; Q-D de maquettes-reception-coordination.md | Socle + P1 | Q-381 |
| Pas de trace des changements de droits/référentiels dans l'existant ; ajout en cible | legacy-admin.md RG-ADM-030 à 036 provisoires | E8 | — |
| Purge / rétention : réceptions attendues à 4 semaines (sauf conservation) ; conservation d'affiches (20 / 365 existant) ; vidage du rebut ; la purge ne lève pas d'alerte | EX-TRA-042 ; EX-TRA-032 ; EX-REC-512 | P1 (REC) | Q-384 |
| Rétention du journal et des photos de BL non définie | EX-TRA-042 | — | Q-370, Q-376 |

### 7.7 Notifications et mails

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Confirmation d'action en bas à droite pendant 5 secondes ; erreur bloquante près du champ ; pas d'action sans retour visible | EX-TRA-033 | P1 (UX) | — |
| Mails sortants : canaux (bandeau, bandeau + mail, mail immédiat, digest 7 h, désactivée) ; aucun mail ne part dans la maquette ; « les alertes remplacent les mails » vs mails conservés | EX-TRA-029, EX-TRA-030 | E8 (SMTP) ; P1 pour le bandeau | Q-375 |
| Listes de distribution gérées en Administration (chef d'atelier, admins plateforme, coordinateurs) | EX-ADM-504 ; EX-COO-503 | E8 | — |
| Plus de mail à la réception d'un dossier pour le Commerce ; mail automatique au commercial refusé | EX-TRA-004 ; EX-REC-523 | P1 (non-implémentation) | Q-388 |

### 7.8 Alertes

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Écran Pilotage › Alertes : gravité (4 indicateurs), type (filtres avec compteur), acquittement, lien vers l'écran concerné ; icône avec compteur au bandeau 1 | EX-TRA-027 ; ECR-TRA-01 | P1 | Q-371 |
| Gravités : Critique (bloque un départ/une deadline), Important (dans la journée), À surveiller, OK, Info ; toujours icône + libellé | EX-TRA-028, EX-TRA-019 | P1 | Q-372 |
| Règles d'alerte en configuration (seuil, gravité, destinataires, canal) | EX-TRA-029 ; EX-TRA-041 ; ECR-ADM-04 | E8 (écran) ; P1 (valeurs lues) | Q-373 |
| Catalogue d'alertes (17 types de la maquette ; réception EX-REC-063 à 072, coordination EX-COO-015, 027-029, 031, 047) | EX-TRA-031 | P1 | Q-374 |
| Dashboard de réception : alertes d'écart +/- 10 %, réception sans IP | EX-REC-516 à EX-REC-521 | P1 (REC) | — |
| Menu Alertes Pré-Prod : intitulés de thèmes proches ; page des modifications de thème après identification | EX-COO-513, EX-THM-502, EX-THM-503 | E8 (THM) | Q-366 |
| Alerte rajouts post préparation / fixe après le 1er colisage | EX-COO-503, EX-FIX-503 | P1 (COO) | Q-380, Q-391 |

### 7.9 Accessibilité, UX transverse, états, responsive

| Exigence consolidée | EX source | Portée | Questions |
|---|---|---|---|
| Deux bandeaux, pas de menu latéral ; 10 onglets ; une seule liste ouverte à la fois ; pas d'onglets dans les pages ; bouton « ← Retour » | EX-TRA-008, EX-TRA-009, EX-TRA-010, EX-TRA-013 | P1 (coque) | Q-365 |
| Barre de filtres unique (ET entre filtres, OU entre valeurs, compteurs, filtres « smart », N° de dossier avec collage de liste, 4 filtres visibles, « Départ ») ; filtres d'en-tête par colonne ; filtres intelligents annonceur -> thèmes | EX-TRA-014 ; EX-TRA-503 | P1 | Q-364 |
| Tableaux : 8 colonnes visibles, colonnes déplaçables/redimensionnables, vues personnalisables gardées sur le poste, sélection et actions groupées, 2 actions par ligne, densité 40/32 px, état vide explicatif, ordre des colonnes, sélections multiples | EX-TRA-015 ; EX-TRA-501, EX-TRA-502, EX-TRA-508 | P1 | Q-361 |
| En-tête de page, boutons (un principal), indicateurs cliquables, panneau latéral (consulter) / modale (saisir), jamais deux fenêtres empilées | EX-TRA-017 | P1 | — |
| Vocabulaire : 12 statuts uniques, « un mot, un sens », pas d'abréviation sans infobulle, dates « jeu. 15/10 16h30 », nombres « 1 284 » | EX-TRA-018 | P1 | Q-381 |
| Statut = pastille + libellé + gravité, jamais la couleur seule ; « Annulé » gris barré | EX-TRA-019 | P1 | — |
| États vide / chargement / erreur : seul le vide est décrit ; chargement et erreur = exigence projet | EX-TRA-020 ; projet (CLAUDE.md §6) | P1 | Q-362 |
| Postes : PC 1920x1080 (Coordination / chef d'équipe) ; réception/expédition : tablette ou PC d'atelier, cibles >= 40 px ; douchette contradictoire | EX-TRA-021 | P1 | Q-363 |
| Accessibilité : contraste >= 4,5:1, focus clavier visible, pas d'information par la couleur seule, cibles >= 32 px, tableaux et graphiques lisibles au clavier, vue tableau de chaque graphique | EX-TRA-022 | P1 | — |
| Charte visuelle : police système 14 px, grille 4 px, navy `#1b2a44`, accent `#0a6f93` ; graphiques : barres horizontales, pas de camembert comparatif | EX-TRA-023 | P1 (point de départ proposé, non imposé) | Q-361 |
| Réduire le nombre de clics ; distinguer chaque ligne par une couleur (critère non précisé) | EX-TRA-507, EX-TRA-509 | P1 (UX) | — |
| Plan du site et menu actuel (référence) | EX-TRA-011, EX-TRA-012 | P1 (plan) ; Hors (menu actuel) | Q-382 |
| Paramétrage : règles en configuration et non dans le code (machines, alertes, entretien : grain, seuil, arrondi) ; purge de la liste des destinations | EX-TRA-041 ; EX-TRA-511 | E8 | Q-373 |
