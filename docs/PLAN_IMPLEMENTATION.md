# Plan d'implémentation

## 1. Étapes
| # | Étape | Statut | Tag git |
|---|---|---|---|
| 1 | Audit | LIVRABLES PRODUITS — validation équipe requise (10 questions BLOQUANTES ouvertes) | |
| 2 | Architecture | TERMINÉE (2026-11-04) avec écarts : SQLite sans Docker (Q-343), choix Q-344 | |
| 3 | Modèle de données | TERMINÉE (2026-11-04) avec écarts : périmètre limité, voir ECARTS | |
| 4 | Socle backend | TERMINÉE (2026-11-04) avec écarts : auth de dev (Q-001), permissions « ? » refusées (Q-349) | |
| 5 | Réception | EXÉCUTÉE, PARTIELLE (2026-11-04 à 2026-11-06) : 10 sous-parcours REC-P01 à P10 tous PARTIEL ; RG-REC (189) : 119 FAIT, 34 PARTIEL, 19 BLOQUÉ, 17 NON REPRIS (décision à valider) ; reconnaissance du visuel hors V1 (Q-112), imprimantes (Q-002), horaires (Q-005) | |
| 6 | Coordination | EXÉCUTÉE, PARTIELLE (2026-11-04 à 2026-11-06) : 13 sous-parcours COO-P01 à P13 tous PARTIEL ; RG-COO (230) : 128 FAIT, 92 PARTIEL, 4 BLOQUÉ, 6 NON REPRIS ; contrat Broadcast simulé (Q-005), hypothèse Q-265 / Q-404 à valider | |
| 7 | Interactions | TERMINÉE AVEC ÉCARTS (2026-11-05) : 93 tests (R / C / B / K / A) ; RG-X (54) : 33 FAIT, 20 PARTIEL, 1 À FAIRE (RG-X-061, Q-399) ; 5 `it.todo` | |
| 8 | Dépendances | EXÉCUTÉE PARTIELLEMENT (2026-11-05 à 2026-11-06, lots 1 à 5) : voir §4, colonne Avancement ; aucune dépendance n'est validée par l'équipe ; D-07, D-11, D-17, D-22, D-23 non faites | |
| 9 | Tests massifs | TERMINÉE (2026-11-06), audit à passer : 13 familles de générateurs, 3 seeds jusqu'à 300 000 enregistrements, 29 invariants, mesures de temps, ANO-061 / 062 corrigées, ANO-063 / 064 ouvertes | |
| 10 | Audit final | RÉDIGÉ (2026-11-06) : `docs/AUDIT_FINAL_CIRCE.md` ; verdict : NON CONFORME pour la mise en production, voir le document ; 4 audits indépendants NON CONFORMES (traçabilité) corrigés, script de contrôle `docs/_travail/controle-tracabilite.mjs` | |

## 2. Sous-parcours Réception (rempli à l'étape 1b)
Chaque ligne = une session /etape-05-reception <ID>. Ordre = ordre de dépendance. Avant toute session : lire les questions BLOQUANTES citées (CLAUDE.md §9.2). Prérequis communs : étapes 2 à 4 terminées.

| ID | Description | RG | ECR | Dépend de | Statut |
|---|---|---|---|---|---|
| REC-P01 | **Socle Réception : entités, droits, traçabilité, historique, concurrence.** Pose des entités et statuts de base de la Réception (Réception, Affiche, Rattachement affiche-ligne, Mouvement, Historique), permissions dans le service, périmètre site, traçabilité auteur/date, journal d'événements, idempotence, verrou optimiste, règle « reçu = somme des rattachements, stock = somme des mouvements », absence de suppression de réception. Q BLOQUANTES liées : Q-001, Q-004, Q-300, Q-306, Q-307, Q-319. Démarrable ? PARTIEL : démarrable une fois Q-300 (statut affiche persisté/calculé), Q-306 (lien n-n avec quantité) et Q-307 (entité Réception) tranchées ou prises en HYPOTHÈSE VALIDÉE avant l'étape 3 ; RG-REC-001 et RG-REC-004 (identité réelle de l'utilisateur) attendent Q-001 (étape 4) ; RG-REC-005/006 attendent le mapping Q-004 pour les codes d'action historisés. RG-X rattachées (aussi étape 7) : RG-X-016, RG-X-060. | RG-REC-001, RG-REC-002, RG-REC-003, RG-REC-004, RG-REC-005, RG-REC-006, RG-REC-007, RG-REC-008, RG-REC-009, RG-REC-043, RG-REC-049, RG-REC-074, RG-REC-151, RG-REC-153, RG-REC-154, RG-REC-176, RG-X-016, RG-X-060 | — | — (après étapes 2-4) | PARTIEL (2026-11-04) : socle livré, 4 RG FAIT, 14 PARTIEL complétées par P02-P08 / COO-P04 |
| REC-P02 | **Réceptions attendues : recherche, filtres, reçu / attendu / reste, statut de ligne.** Vue « Réceptions attendues » de ECR-REC-01 : les trois façons de trouver les dossiers du BL, recherche à la frappe, filtres Départ/période, colonnes Reçu/Attendu/Reste, statut Attendue/Partielle/Complète/Surplus, colonne Contrôle, livraison prévue, purge à 4 semaines, rattachement initial. Q BLOQUANTES liées : Q-005, Q-300, Q-319. Démarrable ? PARTIEL : écran et calculs démarrables sur jeu de données ; Q-300 (statut de ligne calculé ou persisté) à trancher avant l'étape 3 ; Q-005 (qui alimente les attendues, à quelle fréquence) bloque l'alimentation réelle et la planification de la purge (RG-REC-180) ; Q-319 pour les sites/départs de référence. | RG-REC-010, RG-REC-011, RG-REC-012, RG-REC-013, RG-REC-014, RG-REC-015, RG-REC-016, RG-REC-017, RG-REC-018, RG-REC-019, RG-REC-020, RG-REC-042, RG-REC-052, RG-REC-180, RG-REC-181, RG-REC-197 | ECR-REC-01 | REC-P01 ; D-10 (lignes attendues : JDD tant que l'alimentation COO-P05 n'est pas faite) | PARTIEL (2026-11-04) : liste, recherche, filtres, statut de ligne, badges, purge (fonction) ; 3 FAIT, 10 PARTIEL, 3 BLOQUÉ (Q-005, Q-134) |
| REC-P03 | **Panier et saisie du bon de livraison : photo, lecture du BL, contrôles de saisie.** Constitution du panier (un BL = une réception), formulaire BL (champs, date, imprimeur, transporteur, agent, unicité du n° de BL), photo du BL obligatoire, lecture et pré-remplissage du BL, contrat illisible, reconnaissance du visuel, mode de rattachement mémorisé, modale visuel. Q BLOQUANTES liées : Q-306, Q-307. Démarrable ? OUI après étape 3 (Q-306 et Q-307 doivent être tranchées pour modéliser le rattachement et la réception ; aucune autre BLOQUANTE). La lecture automatique du BL (RG-REC-028/029) est une option derrière l'interface LlmProvider, non bloquante. | RG-REC-021, RG-REC-022, RG-REC-023, RG-REC-024, RG-REC-025, RG-REC-026, RG-REC-027, RG-REC-028, RG-REC-029, RG-REC-030, RG-REC-031, RG-REC-032, RG-REC-033, RG-REC-034, RG-REC-035, RG-REC-036, RG-REC-203 | ECR-REC-01, ECR-REC-07, ECR-REC-11, ECR-REC-12 | REC-P02 | PARTIEL (2026-11-04) : panier, photo du BL, bon de livraison vérifié, modale Visuel ; 2 FAIT, 11 PARTIEL, 4 BLOQUÉ (Q-112) |
| REC-P04 | **Valider la réception : création de la réception « À contrôler », affiches, mouvements.** Action « Valider la réception » : ordre des refus, création atomique de la réception (A_CONTROLER), des affiches et des mouvements de réception, complément d'une affiche déjà reçue en partie, réception partielle, surplus, réception sans IP, champs vidés/conservés, intitulé de thème. Q BLOQUANTES liées : Q-300, Q-306, Q-307. Démarrable ? OUI après étape 3 : transitions ∅ -> RECEPTION.A_CONTROLER et création d'affiche exigent l'entité Réception (Q-307), le statut d'affiche (Q-300) et le lien affiche-ligne avec quantité (Q-306). RG-X rattachées (aussi étape 7) : RG-X-005. | RG-REC-037, RG-REC-038, RG-REC-039, RG-REC-040, RG-REC-041, RG-REC-044, RG-REC-045, RG-REC-046, RG-REC-047, RG-REC-048, RG-REC-050, RG-REC-051, RG-REC-198, RG-X-005 | ECR-REC-01, ECR-REC-02 | REC-P03 | PARTIEL (2026-11-04 : implémenté, testé, audité ; RG BLOQUÉES / PARTIEL listées dans la matrice et ECARTS) |
| REC-P05 | **Sas et contrôle de la palette : comptage, écarts, rebut, emplacement, validation du contrôle.** Liste des palettes à contrôler (badge, retard 24 h), écran de contrôle une ligne par affiche, quantité comptée, écart de 10 %, comptage par morceau, allée/rayon, zone tampon, contrôleur obligatoire, rebut, non-conformité, surplus en entretien, valider le contrôle, lecture seule ensuite, fiche réception et correction a posteriori du BL. Q BLOQUANTES liées : Q-307. Démarrable ? OUI après étape 3 (Q-307 : statuts de la réception A_CONTROLER/CONTROLEE). Les impressions de feuilles définitives (RG-REC-084) sont traitées dans REC-P06. | RG-REC-053, RG-REC-054, RG-REC-055, RG-REC-056, RG-REC-057, RG-REC-058, RG-REC-059, RG-REC-060, RG-REC-061, RG-REC-062, RG-REC-063, RG-REC-064, RG-REC-065, RG-REC-066, RG-REC-067, RG-REC-068, RG-REC-069, RG-REC-070, RG-REC-071, RG-REC-072, RG-REC-183, RG-REC-189, RG-REC-193, RG-REC-073 | ECR-REC-02, ECR-REC-06 | REC-P04 | PARTIEL (2026-11-04 : implémenté, testé, audité ; RG BLOQUÉES / PARTIEL listées dans la matrice et ECARTS) |
| REC-P06 | **Feuille de stock (étiquette rack) et impressions.** Contenu de la feuille de stock, mention définitive/temporaire, code-barres « A- » + id, quantité imprimée, impression en lot, réimpressions, « Ranger avant d'imprimer », étiquette rack, imprimantes de plateforme et sortie PDF navigateur, échec non bloquant, édition picking, tag « Feuille à refaire ». Q BLOQUANTES liées : Q-002. Démarrable ? PARTIEL : aperçu et PDF générés côté navigateur démarrables immédiatement (RG-REC-077, 078, 079, 080, 081, 082, 083, 084, 085, 086, 087, 088, 090, 093, 129) ; l'envoi vers l'imprimante de plateforme via l'agent local attend Q-002 (RG-REC-076, RG-REC-089, RG-REC-091, RG-REC-092) ; ECR-REC-09 en dépendance D-18. | RG-REC-076, RG-REC-077, RG-REC-078, RG-REC-079, RG-REC-080, RG-REC-081, RG-REC-082, RG-REC-083, RG-REC-084, RG-REC-085, RG-REC-086, RG-REC-087, RG-REC-088, RG-REC-089, RG-REC-090, RG-REC-091, RG-REC-092, RG-REC-093, RG-REC-129 | ECR-REC-09, ECR-REC-10, ECR-REC-03 | REC-P05 | PARTIEL (2026-11-04 : implémenté, testé, audité ; RG BLOQUÉES / PARTIEL listées dans la matrice et ECARTS) |
| REC-P07 | **Réceptions inconnues : création, identification, rattachement, signalement.** Création d'une réception inconnue (ECR-REC-08 : quantité, allée tampon, rayon, photos, suggestions d'intitulés), tableau des réceptions inconnues (ECR-REC-04), identification par visuel ou n° de dossier, pré-coche du cas sûr, rattachement (refus, répartition <= quantité, plusieurs dossiers), validation admin selon le rôle, « Dossier introuvable », retrait du dernier dossier. Q BLOQUANTES liées : Q-300, Q-306, Q-307. Démarrable ? OUI après étape 3 : états RECEPTION.A_IDENTIFIER / INTROUVABLE / RATTACHEE (Q-307), affiche ORPHELINE (Q-300), répartition sur plusieurs dossiers (Q-306). RG-X rattachées (aussi étape 7) : RG-X-007, RG-X-030, RG-X-051, RG-X-054. | RG-REC-095, RG-REC-096, RG-REC-097, RG-REC-098, RG-REC-099, RG-REC-100, RG-REC-101, RG-REC-102, RG-REC-103, RG-REC-104, RG-REC-105, RG-REC-106, RG-REC-107, RG-REC-108, RG-REC-109, RG-REC-110, RG-REC-111, RG-REC-112, RG-REC-113, RG-REC-114, RG-REC-115, RG-REC-116, RG-REC-117, RG-REC-118, RG-REC-119, RG-REC-120, RG-REC-185, RG-REC-186, RG-COO-017, RG-COO-018, RG-X-007, RG-X-030, RG-X-051, RG-X-054 | ECR-REC-08, ECR-REC-04 | REC-P05, REC-P06 (feuille temporaire) | PARTIEL (2026-11-04 : implémenté, testé, audité ; RG BLOQUÉES / PARTIEL listées dans la matrice et ECARTS) |
| REC-P08 | **Liste des affiches et fiche de l'affiche : filtres, tags, rattachements, thème, conservation.** Liste des affiches (ECR-REC-03 : colonnes, filtres, En stock, rebut, tags calculés) et fiche affiche (ECR-REC-05 : champs modifiables, onglets Mouvements/Préparations, changer de thème, rattacher à un autre dossier, retirer un rattachement, rattachement manuel après validation, date de dernier départ, conservation, purge des anciens thèmes). Q BLOQUANTES liées : Q-300, Q-306. Démarrable ? OUI après étape 3 (tags calculés selon Q-300, rattachements n-n selon Q-306). Aucune autre BLOQUANTE. RG-X rattachées (aussi étape 7) : RG-X-013, RG-X-062, RG-X-063, RG-X-014, RG-X-015, RG-X-058, RG-X-052. | RG-REC-121, RG-REC-122, RG-REC-123, RG-REC-125, RG-REC-126, RG-REC-127, RG-REC-128, RG-REC-130, RG-REC-131, RG-REC-132, RG-REC-134, RG-REC-135, RG-REC-136, RG-REC-137, RG-REC-138, RG-REC-139, RG-REC-140, RG-REC-141, RG-REC-142, RG-REC-143, RG-REC-144, RG-REC-145, RG-REC-147, RG-REC-148, RG-REC-150, RG-REC-159, RG-X-013, RG-X-062, RG-X-063, RG-X-014, RG-X-015, RG-X-058, RG-X-052 | ECR-REC-03, ECR-REC-05, ECR-REC-06 | REC-P05 | PARTIEL (2026-11-04 : implémenté, testé, audité ; RG BLOQUÉES / PARTIEL listées dans la matrice et ECARTS) |
| REC-P09 | **Rebut, mouvements manuels de stock et fonctions legacy sans écran cible.** Mise au rebut depuis Stocks, ajout et sortie manuels de stock, vidage du rebus, état de destruction déplacé vers Stocks, et fonctions legacy à arbitrer ou non reprises (fusion d'affiches, zone picking, drill-down, listes legacy, alerte validation admin sans contrôle serveur). Q BLOQUANTES liées : aucune BLOQUANTE (Q-382 arbitrage des fonctions legacy ; Q-385 état de destruction). Démarrable ? OUI pour la partie rebut/mouvements côté Réception ; les écrans ECR-STK-* relèvent de la dépendance D-13 (étape 8). Les règles legacy non reprises (fusion RG-REC-163/165/166/167, zone picking RG-REC-168) ne produisent aucun code tant que Q-382 n'est pas tranchée : un test de non-régression d'absence suffit. | RG-REC-124, RG-REC-155, RG-REC-156, RG-REC-157, RG-REC-158, RG-REC-160, RG-REC-163, RG-REC-165, RG-REC-166, RG-REC-167, RG-REC-168, RG-REC-169, RG-REC-170, RG-REC-171, RG-REC-175 | ECR-STK-01, ECR-STK-03, ECR-REC-03 | REC-P08 ; D-13 (stock, étape 8) | PARTIEL (2026-11-04 : implémenté, testé, audité ; RG BLOQUÉES / PARTIEL listées dans la matrice et ECARTS) |
| REC-P10 | **Alertes Réception, paramètres, référentiels, dashboard et interfaces de retour.** Alertes de réception (visuel non reçu, écart > 10 %, sans instructions de pose, inconnue, introuvable, feuilles, palette > 24 h) et leur paramétrage, paramètres Règles métier > Réception, référentiels imprimeurs/livreurs/agents, mails supprimés, dashboard et taux d'entretien, batch d'export vers PEX/Broadcast legacy. Q BLOQUANTES liées : Q-005. Démarrable ? PARTIEL : alertes, paramètres, référentiels et dashboard démarrables ; le batch d'export vers PEX/Broadcast et la synchronisation (RG-REC-199, RG-REC-201, RG-REC-202) attendent Q-005 (planification inconnue) et relèvent de l'étape 8 (D-16). | RG-REC-178, RG-REC-179, RG-REC-182, RG-REC-184, RG-REC-187, RG-REC-188, RG-REC-190, RG-REC-191, RG-REC-194, RG-REC-195, RG-REC-196, RG-REC-199, RG-REC-200, RG-REC-201, RG-REC-202 | ECR-TRA-01, ECR-ADM-04, ECR-ADM-05, ECR-ADM-07 | REC-P05, REC-P07 ; D-06, D-08 | PARTIEL (2026-11-04 : implémenté, testé, audité ; RG BLOQUÉES / PARTIEL listées dans la matrice et ECARTS) |

## 3. Sous-parcours Coordination
Chaque ligne = une session /etape-06-coordination <ID> (après les parcours Réception dont elle dépend).

| ID | Description | RG | ECR | Dépend de | Statut |
|---|---|---|---|---|---|
| COO-P01 | **Socle Coordination : droits, périmètre, statuts d'instruction, intégration, historique.** Deux circuits indépendants (validation admin / Instruction OK), droits contrôlés dans le service, correspondance droits legacy / 6 rôles, périmètre atelier/site, Commerce en lecture seule, statuts de l'instruction et table de transitions, création/mise à jour à l'intégration, annulation, retour arrière, statut de préparation du dossier, historique, la Pré-Prod n'est pas utilisatrice. Q BLOQUANTES liées : Q-001, Q-004, Q-319. Démarrable ? PARTIEL : machines d'états instruction/dossier démarrables sur le catalogue de la maquette (EN_COURS, INSTRUCTION_OK, ANNULE…) ; Q-004 (export de tr_statut) conditionne le mapping des codes 0 à 10 et la reprise (RG-COO-040, 045, 061, 160) ; Q-001 conditionne l'authentification réelle (RG-COO-165) ; Q-319 pour atelier/site de référence. | RG-COO-001, RG-COO-040, RG-COO-041, RG-COO-045, RG-COO-046, RG-COO-061, RG-COO-062, RG-COO-063, RG-COO-160, RG-COO-165, RG-COO-166, RG-COO-167, RG-COO-168, RG-COO-169 | ECR-COO-01 | REC-P01 | PARTIEL (2026-11-04 : socle implémenté, testé ; Instruction OK COO-P02, validation admin COO-P03, alertes COO-P05) |
| COO-P02 | **Liste des instructions et Instruction OK (automatique, manuelle), écart Broadcast, correction.** Écran ECR-COO-01 filtre « À faire (Coordination) » et fiche dossier ECR-COO-02 : Instruction OK automatique et manuelle, répartition 100 %, instruction fige la saisie, entretien 8 %/15 %, position, grain atelier x plateforme, pas d'Instruction OK avant la prépa, renvoi de prépa, écart Broadcast/Circé, appliquer la version Broadcast, demander une correction à Broadcast (ECR-COO-04). Q BLOQUANTES liées : Q-204 (TRANCHÉE le 2026-11-04 : option b). Démarrable ? PARTIEL : Instruction OK manuelle, saisie, écart, correction et version Broadcast démarrables (RG-COO-043, 044, 047 à 052, 055 à 060, 133 à confirmer) ; l'Instruction OK automatique et la réouverture sur renvoi de prépa (RG-COO-042, RG-COO-053, RG-COO-054) : Q-204 TRANCHÉE le 2026-11-04 (option b, dès l'arrivée de la prépa), implémentées. | RG-COO-042, RG-COO-043, RG-COO-044, RG-COO-047, RG-COO-048, RG-COO-049, RG-COO-050, RG-COO-051, RG-COO-052, RG-COO-053, RG-COO-054, RG-COO-055, RG-COO-056, RG-COO-057, RG-COO-058, RG-COO-059, RG-COO-060, RG-COO-133, RG-COO-204 | ECR-COO-01, ECR-COO-02, ECR-COO-04 | COO-P01 | PARTIEL (2026-11-04 : Instruction OK auto / manuelle, saisie, écart, version Broadcast, correction ; reste Q-257, Q-375, alertes COO-P05, trains coo2) |
| COO-P03 | **Validation admin : proposition de rattachement, cas sûrs, affiches à doute.** Calcul de l'état de validation d'une affiche (réception inconnue, à confirmer proposé, à confirmer doute, validée), proposition de rattachement à la réception, cas sûr pré-coché, motifs de doute, pastille du dossier, statut de dossier « Validation admin faite » calculé, quantité non conditionnante, confirmation explicite des doutes (ECR-COO-03). Q BLOQUANTES liées : Q-300, Q-306. Démarrable ? OUI après étape 3 : l'état de validation est calculé à partir du statut d'affiche (Q-300) et du lien affiche-ligne avec quantité (Q-306). Aucune autre BLOQUANTE ; RG-X-001, RG-X-002 et RG-X-053 sont indispensables et rattachées à ce parcours et à l'étape 7. RG-X rattachées (aussi étape 7) : RG-X-001, RG-X-002, RG-X-053. | RG-COO-002, RG-COO-003, RG-COO-004, RG-COO-005, RG-COO-006, RG-COO-007, RG-COO-011, RG-COO-012, RG-COO-013, RG-COO-016, RG-COO-019, RG-COO-020, RG-X-001, RG-X-002, RG-X-053 | ECR-COO-01, ECR-COO-03 | COO-P01, REC-P04 | PARTIEL (2026-11-05 : état de validation calculé, motifs, cas sûrs, pastille, « Valider la sélection » + ECR-COO-03 ; Q-184 TRANCHÉE (panier = BL) ; restes : alertes COO-P05, effets COO-P04, lecture du BL Q-112) |
| COO-P04 | **Validation admin : confirmer, valider en lot, annuler, effets et traçabilité.** Confirmation unitaire (fiche dossier) et en lot (« Valider la sélection »), qui peut valider, annulation de la validation, traçabilité nom et date, effets (n° d'affiche au suivi de prod, picking verrou, étiquette rack, retour « reçue et associée » vers Broadcast, sortie de la liste), thème/quantité/ligne changés après validation, rattachement manuel d'une inconnue qui vaut validation. Q BLOQUANTES liées : Q-002. Démarrable ? PARTIEL : confirmation, annulation, traçabilité et effets démarrables ; l'impression de l'étiquette rack à la plateforme (RG-COO-023) attend Q-002 (agent local) ; le retour Broadcast (RG-COO-024) relève de l'étape 8 (D-16, Q-005). RG-X rattachées (aussi étape 7) : RG-X-051, RG-X-014, RG-X-015, RG-X-050, RG-X-058, RG-X-052. | RG-COO-008, RG-COO-009, RG-COO-010, RG-COO-014, RG-COO-015, RG-COO-021, RG-COO-022, RG-COO-023, RG-COO-024, RG-COO-025, RG-COO-026, RG-COO-027, RG-COO-028, RG-COO-029, RG-COO-030, RG-COO-031, RG-COO-032, RG-COO-064, RG-X-051, RG-X-014, RG-X-015, RG-X-050, RG-X-058, RG-X-052 | ECR-COO-01, ECR-COO-02, ECR-REC-04, ECR-REC-05 | COO-P03, REC-P07, REC-P08 | PARTIEL (2026-11-05 : confirmation unitaire et annulation, effets (étiquette rack, picking, à traiter, • / ✓, n° au suivi), rattachements manuels, ligne modifiée ; restes : envoi du retour Broadcast Q-005, écrans suivi de prod / état des réservations D-10, comptes génériques Q-003, fusion Q-100, alertes affichées COO-P07 (RG-COO-030 à 032, RG-X-050) ; test-engineer fait, audit 1re passe NON CONFORME corrigée, 2e passe à faire) |
| COO-P05 | **Lignes attendues : règles de vie, rapprochement, provisoire, annulation, sources.** Modèle de la ligne attendue : une seule ligne active par clé, rapprochement par identifiants, ligne Broadcast créée/mise à jour, semaines ISO, visuel provisoire avant IP et déplacement à la saisie des IP, bascule en source PREPA, ANNULEE jamais supprimée, lien affiche-ligne n-n avec quantité, trois sources, lignes bandeau, DA chapeau, thème partagé, dossier sur deux plateformes ou multi-semaines, ligne de suivi de production et état des réservations. Q BLOQUANTES liées : Q-005, Q-300, Q-306. Démarrable ? PARTIEL : règles de vie des lignes démarrables (Q-300 et Q-306 à trancher avant l'étape 3) ; l'alimentation réelle depuis Broadcast attend Q-005 ; ECR-PIL-03 en dépendance D-10 (étape 8). | RG-COO-080, RG-COO-081, RG-COO-082, RG-COO-083, RG-COO-084, RG-COO-085, RG-COO-086, RG-COO-087, RG-COO-088, RG-COO-089, RG-COO-090, RG-COO-094, RG-COO-095, RG-COO-096, RG-COO-097, RG-COO-098, RG-COO-099, RG-COO-100, RG-COO-101, RG-COO-105, RG-COO-106, RG-COO-107, RG-COO-108 | ECR-PIL-03 | COO-P01, REC-P02 ; D-10 | PARTIEL (2026-11-05 : règles de vie des lignes attendues (alimentation Broadcast et prépa sur contrat interne Q-187), provisoire / IP, disparition, suppression interdite, dédoublonnage, état des réservations ECR-PIL-03, suivi de production (API) ; restes : branchement des flux COO-P06, alertes COO-P07, écran ECR-PIL-02 D-10, grains EDR COO-P12 / P13, Q-005) |
| COO-P06 | **Intégration Broadcast : copie de l'état des réservations et flux.** Copie de l'EDR Broadcast, exclusions, cinq flux, prérequis et ordre fixe, journal de chargement, destinataires, transporteur par défaut, routage fixe/pliage, atelier déroulant, code d'instruction, trains/instructions, accusé vers Broadcast, rafraîchir un dossier, retour vers Broadcast, atomicité et idempotence. Q BLOQUANTES liées : Q-005. Démarrable ? PARTIEL : les règles de traitement (idempotence, atomicité, statuts de chargement, routage) démarrent sur un contrat d'interface en HYPOTHÈSE ; planification, jobs et procédures hors dépôt (RG-COO-091, 102, 103, 104, 115, 116, 125, 131, 134) attendent Q-005. Étape 8 : D-16, D-20. | RG-COO-091, RG-COO-092, RG-COO-093, RG-COO-102, RG-COO-103, RG-COO-104, RG-COO-109, RG-COO-115, RG-COO-116, RG-COO-117, RG-COO-118, RG-COO-119, RG-COO-120, RG-COO-121, RG-COO-122, RG-COO-123, RG-COO-125, RG-COO-126, RG-COO-127, RG-COO-128, RG-COO-129, RG-COO-130, RG-COO-131, RG-COO-132, RG-COO-134 | — | COO-P05, COO-P02 ; D-10, D-16 | PARTIEL (2026-11-05 : passage d'intégration (verrou, ordre fixe, journal de chargement, délai), cinq flux sur contrat d'entrée Q-188, retour « reçue et associée », messages vers Broadcast en file, « Rafraîchir un dossier », écran « Chargements Broadcast » ; restes : source et envoi réels Q-005, RG-COO-109 BLOQUÉE Q-228, alertes affichées COO-P07) |
| COO-P07 | **Alertes Pré-Prod et vérification des thèmes.** Menu Alertes Pré-Prod : validation admin à confirmer, préparation non reçue (deadline jeudi S-2 16 h), écart Broadcast/Circé, thème modifié dans Broadcast, thèmes et annonceurs proches, réception sur dossier sans IP, inconnue/introuvable côté Coordination, rajout après préparation, dernière minute ; calendrier du process. Q BLOQUANTES liées : aucune BLOQUANTE (Q-220 acquittement ; Q-366 vérification des thèmes). Démarrable ? OUI : séance courte (12 RG) ; ECR-THM-01/02/03 sont en dépendance D-12 (étape 8), la règle de proximité 0,85 relève de la vérification des thèmes. | RG-COO-033, RG-COO-066, RG-COO-067, RG-COO-068, RG-COO-069, RG-COO-070, RG-COO-071, RG-COO-072, RG-COO-073, RG-COO-074, RG-COO-075, RG-COO-076 | ECR-TRA-01, ECR-COO-02 | COO-P06, COO-P04 ; D-08, D-12 | PARTIEL (2026-11-05 : Pilotage › Alertes (REC + COO, calculées), Vérification des thèmes (proches, annonceurs, thèmes modifiés dans Broadcast + reprise), deadline ECR-COO-01 ; restes : mails Q-375, acquittement Q-220, D-08, D-15 ; spec-auditor à passer) |
| COO-P08 | **Déblocage des préparations et « Rendre la main ».** Recherche exigeant un n° de préparation ou de dossier, filtre par règles d'atelier, statut d'avancement UM ou TRAIN, blocage côté serveur (UM >= 6 ou faces de train), effet atomique, trace, mail non bloquant, prépa renvoyée intégrée normalement, suivi, droits. Q BLOQUANTES liées : aucune BLOQUANTE (Q-382 arbitrage de l'écran legacy). Démarrable ? OUI : démarrable ; l'écran legacy « Préparations débloquées » est à arbitrer en « Rendre la main » (D-21, Q-382) ; Q-265 concerne la libération, pas ce parcours. | RG-COO-140, RG-COO-141, RG-COO-142, RG-COO-143, RG-COO-144, RG-COO-145, RG-COO-146, RG-COO-147, RG-COO-148, RG-COO-149, RG-COO-150, RG-COO-151, RG-COO-152, RG-COO-277, RG-COO-278, RG-COO-279 | ECR-COO-09 | COO-P06 | À FAIRE | PARTIEL (2026-11-05 : recherche, règles d’atelier, statut d’avancement UM / TRAIN, gardes serveur UM ≥ 6 et faces, « Rendre la main » atomique (répartitions et UM annulées, trace, historique, demande Broadcast en file), suivi « Préparations débloquées », droits ; restes : appel réel Broadcast Q-005, mail Q-375, RG-COO-150 BLOQUÉ Q-228, unités « En attente » RG-COO-243 en COO-P12 ; test-engineer et spec-auditor à passer) 
| COO-P09 | **Trains : identifiant, positions, faces, couverture, fractionnement, liste (ECR-COO-05).** Identifiant et version d'un train, position (début, fin, milieu), répartition des thèmes sur les faces, faces d'entretien, campagne contrôlée, garde-fous anti-doublons, couverture des visuels et passage EN_ATTENTE à PRET, positions fractionnées/couvertes, changer statut des faces, annulation, débloquer semaine, fractionner, raccrocher, point de non-retour, pré-test, suppression, duplication, filtres, historique. Q BLOQUANTES liées : Q-319. Démarrable ? OUI : démarrable ; Q-319 (référentiels atelier, support, jours de départ) à fournir pour le seed. Q-204 conditionne seulement le moment de l'Instruction OK (COO-P02). | RG-COO-200, RG-COO-201, RG-COO-202, RG-COO-203, RG-COO-204, RG-COO-205, RG-COO-206, RG-COO-207, RG-COO-208, RG-COO-209, RG-COO-218, RG-COO-219, RG-COO-220, RG-COO-221, RG-COO-222, RG-COO-223, RG-COO-224, RG-COO-225, RG-COO-226, RG-COO-227, RG-COO-228, RG-COO-229, RG-COO-307, RG-COO-308 | ECR-COO-05 | COO-P02 ; D-02, D-06 | PARTIEL (2026-11-05 : calcul des trains à l'Instruction OK, liste ECR-COO-05, couverture, fractionner, raccrocher, créer, supprimer, changer statut, annuler thème, débloquer semaine, dupliquer ; restes : boutons des écrans COO-P10, Paris Q-255, RG-COO-204 Q-257) |
| COO-P10 | **Export des trains et préparation du déroulant (suivi par thème, rouleur).** Export du jeudi 14 h réservé à la Coordination, dossiers exportables et décompte, fichier tf_train_export, simulation, historique, erreurs visibles, ordonnancement Paris, export préparation (ateliers 5 et 6, plafond 20 thèmes), « Au roulage », suivi par thème (besoin, couvert, pré-assemblage), préparation du déroulant, choix du rouleur. Q BLOQUANTES liées : Q-319. Démarrable ? OUI : démarrable ; la génération des fichiers de production (ECR-GEN-01, format .ini) est la dépendance D-15 (étape 8) : l'export est simulé jusque-là. | RG-COO-210, RG-COO-211, RG-COO-212, RG-COO-213, RG-COO-214, RG-COO-215, RG-COO-216, RG-COO-217, RG-COO-230, RG-COO-231, RG-COO-232, RG-COO-233, RG-COO-235, RG-COO-236 | ECR-COO-05, ECR-COO-06, ECR-COO-07, ECR-GEN-01 | COO-P09 ; D-15 | PARTIEL (2026-11-05 : export des trains, export préparation, Au roulage, rouleur, suivi par thème, préparation, générateur de fichiers SIMULÉ ; restes : Bagues COO-P11, fichiers réels D-15, Paris Q-255, atelier 5 et 6 du référentiel) |
| COO-P11 | **Roulage : suivi 8 m², dispatch des rouleurs, bagues et étiquettes.** Pré-assemblage 8 m² et suivi des demies (ECR-COO-08), dispatch du roulage (périmètre, charge par rouleur, proposition simulée, affectation manuelle, alertes, liste de picking), référentiel des rouleurs, bagues (périmètre, impression avec rouleur obligatoire et passage à En production, textes, réimpression avec motif, contenu), tableau de roulage. Q BLOQUANTES liées : Q-002. Démarrable ? PARTIEL : suivi 8 m² et dispatch démarrables ; l'impression des bagues (RG-COO-299) attend Q-002 pour l'imprimante locale (aperçu PDF navigateur possible) ; ECR-COO-11 en dépendance D-18. | RG-COO-234, RG-COO-237, RG-COO-291, RG-COO-292, RG-COO-293, RG-COO-294, RG-COO-295, RG-COO-296, RG-COO-297, RG-COO-298, RG-COO-299, RG-COO-300, RG-COO-301, RG-COO-302, RG-COO-303 | ECR-COO-08, ECR-COO-10, ECR-COO-11 | COO-P10 ; D-05, D-18 | PARTIEL (2026-11-05 : dispatch du roulage, rouleurs, bagues, suivi 8 m² ; restes : moteur de répartition cible Q-276, impression physique Q-002 / Q-287, unités UM et lot Q-265, poste / machine D-02, tableau de roulage Q-278) |
| COO-P12 | **Préparation 2 m² fixe, pliage et bus : libération, rendre la main, comptage, quantités à encoller.** Entretien à l'afficheur, modification de quantité à produire, libération de la semaine, ligne « à libérer », repère « Arrivé après libération », rendre la main, corriger l'intitulé, jours d'affichage, fiche de synthèse, pliage (comptage, PRODUIT), fixe unique, retirer/préparer/pas de drag and drop, liste des UM, bus (quantités à encoller, lots BU-nnnn), PDF navigateur. Q BLOQUANTES liées : Q-265, Q-002. Démarrable ? PARTIEL : entretien, rendre la main, pliage, bus et fiches démarrables ; la libération de la semaine, le statut initial « à libérer » et qui crée les UM (RG-COO-240, RG-COO-241) attendaient Q-265 (depuis l'étape 8 : hypothèse (c) à valider) ; l'impression de la fiche de synthèse (RG-COO-306) conditionnée par Q-002. RG-X-076 attendait Q-265 (étape 7 ; hypothèse (c) depuis l'étape 8, à valider). | RG-COO-124, RG-COO-238, RG-COO-239, RG-COO-240, RG-COO-241, RG-COO-242, RG-COO-243, RG-COO-244, RG-COO-245, RG-COO-246, RG-COO-247, RG-COO-248, RG-COO-249, RG-COO-250, RG-COO-251, RG-COO-290, RG-COO-304, RG-COO-305, RG-COO-306 | ECR-COO-09 | COO-P06, COO-P09 | PARTIEL (2026-11-05 : liste des unités, entretien à l'afficheur, quantité, corriger l'intitulé, rendre la main, retirer / préparer, comptage du pliage, fiche de synthèse, quantités à encoller du bus, réalignement de l'entretien ; [périmé : levé à l'étape 8, 2026-11-05] libération de la semaine, statut « à libérer », repère « Arrivé après libération » et création des UM implémentés sous HYPOTHÈSE Q-265 option (c) / Q-404, PARTIEL, à valider par l'utilisateur ; restes : mail Pré-Prod Q-375, états de collage, flux Bus Q-279, colis COO-P13) |
| COO-P13 | **Unités de manutention, colis, expédition et intégration AMT.** Construction des UM, création (statut 1, code barre, poids), statuts d'origine, poids minimum, fractionnement sur colis, rattachement d'une UM à un colis, création/ouverture/suppression de colis, retrait d'une UM, expédition, fin de journée, train ajouté à un colis, mail colis, intégration AMT, priorité du statut de l'UM. Q BLOQUANTES liées : Q-265. Démarrable ? PARTIEL : colisage, expédition et statuts d'UM démarrables ; la construction/création des UM (RG-COO-260) attendait Q-265 (qui crée les UM en cible ; hypothèse (c) depuis l'étape 8, à valider). ECR-EXP-01/02 en dépendance D-14 (étape 8). | RG-COO-260, RG-COO-261, RG-COO-262, RG-COO-263, RG-COO-264, RG-COO-265, RG-COO-266, RG-COO-267, RG-COO-268, RG-COO-269, RG-COO-270, RG-COO-271, RG-COO-272, RG-COO-273, RG-COO-274, RG-COO-275, RG-COO-276, RG-COO-280 | ECR-EXP-01, ECR-EXP-02 | COO-P12 ; D-14 | PARTIEL (2026-11-05 : colisage, expédition, fin de journée, sorties de stock, garde RG-COO-249, site choisi ; [périmé : levé à l'étape 8, 2026-11-05] création des UM par « Colisage » sous HYPOTHÈSE Q-265 (c) / Q-404, RG-COO-260 à 262 PARTIEL, à valider ; restes : mail Q-375, Geodis / Livré / étiquette / boucle Q-284, ECR-EXP-03 ; audit final P11-P13 passé le 2026-11-05 : P12 et P13 NON CONFORMES uniquement à cause de Q-265 ; depuis l'étape 8 Q-265 est une HYPOTHÈSE PRISE (option (c)) à valider, statuts du groupe PARTIEL) |

Règles inter-modules (RG-X) : celles dont le comportement est indispensable à un parcours sont rattachées à ce parcours ET à l'étape 7 (colonne RG ci-dessus, étape « 5 + 7 » ou « 6 + 7 » dans l'index §6). Les autres sont portées uniquement par l'étape 7 (/etape-07-interactions) : RG-X-003, RG-X-004, RG-X-006, RG-X-008, RG-X-009, RG-X-010, RG-X-011, RG-X-012, RG-X-017, RG-X-018, RG-X-019, RG-X-020, RG-X-021, RG-X-022, RG-X-028, RG-X-055, RG-X-056, RG-X-057, RG-X-059, RG-X-061, RG-X-064, RG-X-065, RG-X-075, RG-X-076, RG-X-077, RG-X-078, RG-X-079, RG-X-080, RG-X-081, RG-X-082, RG-X-083, RG-X-084, RG-X-085, RG-X-086, RG-X-087, RG-X-088.

## 4. Dépendances indispensables (étape 8) — à valider par l'équipe
Priorité : A = nécessaire pour qu'un parcours P1 fonctionne ; B = nécessaire à l'intégration/E2E étape 7 ; C = différable. Chaque ligne est à valider par l'équipe : la colonne « Validée ? » ne porte QUE la validation (NON tant qu'aucune décision de l'équipe n'est consignée) ; l'avancement est dans la colonne « Avancement » (FAIT / PARTIEL / NON FAIT, audit final du 2026-11-06). Les EX des ateliers sont cités avec +500 (Q-350).

| Dépendance | Pourquoi indispensable | Périmètre minimal | Validée ? | Avancement |
|---|---|---|---|---|
| D-01 Utilisateurs, droits, périmètre (gestion) [A] | Permissions vérifiées dans le service pour chaque action P1 (validation admin réservée Coordination, ECR-COO-01, ECR-REC-05) ; périmètre site/atelier filtre toutes les listes ; nom du contrôleur et du valideur tracé (EX-TRA-007, EX-TRA-036). Le socle étape 4 fournit l'authentification ; ici l'administration des comptes Sources : EX-TRA-001 à 007 ; legacy-admin.md RG-ADM-010 à 017, 030 à 037 provisoires ; ECR-ADM-07 ; Q-001, Q-003, Q-352 | Tables utilisateur, droit (27 -> permissions), périmètre plateforme/atelier ; attribution via API ; écran minimal (« phase 4 » en maquette) ; reprise de la correspondance 6 rôles / 27 droits | NON | PARTIEL : lot 2 (étape 8, 2026-11-06) : liste, création, modification (rôles, périmètre), désactivation, droit `utilisateur.gerer`, écran `/admin/utilisateurs` (Q-406) ; authentification, annuaire et droits individuels non repris (ECARTS) |
| D-02 Sites, ateliers, gammes [A] | Sélecteur de site et périmètre de tous les écrans P1 (EX-TRA-006) ; ECR-COO-09/10 par atelier ; types de production 2M2FIXE / PLIAGE / DEROULANT ; gammes d'étapes Sources : maquettes-autres-modules.md §0.4 (ADM-01/02), ECR-ADM-01 ; EX-EXI-003 ; Q-358 | Référentiel Site (NIM, WIS, NAN cible), Atelier (mode train / unitaire, type, formats, machines) ; lecture seule suffit (la maquette n'a pas de CRUD) | NON | PARTIEL : lot 2 (étape 8, 2026-11-06) : lecture seule des sites et ateliers, écran `/admin/sites` (Q-406) ; formats, machines, gammes non repris (ECARTS) |
| D-03 Plateformes : coordonnées, mails, imprimantes [B] | Mail de réception par plateforme (legacy), imprimantes cibles de l'étiquette rack (RG-ADM-041 provisoire) ; `id_site_ccf` pour le mail de déblocage Sources : legacy-admin.md RG-ADM-040 à 044 provisoires ; legacy-reception.md dépendances ; legacy-coordination.md §8 | Plateforme (libellé, ville, `id_site_ccf`), adresses mail de notification, imprimantes ; dépend de Q-002 (agent local) | NON | PARTIEL (rétrogradé à l'audit final : coordonnées, mails et imprimantes saisis mais non consommés en production) — PARTIEL : lot 3 (étape 8, 2026-11-06) : écran `/admin/plateformes`, API `GET /api/admin/plateformes`, `PATCH …/:id`, mails de réception (POST / DELETE), imprimantes (POST / PATCH actif) ; migration CREATE `20261106100000_ajoute_plateformes_alertes` (Q-407) ; aucun mail ni impression déclenchés (Q-375, Q-002), `id_site_ccf` saisi mais non lu par un mail de déblocage (ECARTS) |
| D-04 Référentiels de réception : imprimeurs, livreurs, contrôleurs [A] | Listes proposées à la saisie d'une réception (ECR-REC-01, ECR-REC-08) ; nom du contrôleur obligatoire en liste déroulante (EX-REC-514) ; legacy : création inopérante (RG-REC-074 provisoire) Sources : maquettes-autres-modules.md §0.2 ; ECR-ADM-07 ; EX-ADM-501 ; legacy-reception.md dépendances | Trois listes avec ajout/désactivation ; valeurs initiales issues de l'existant (`tr_imprimeur`, `tr_transposteur_reception`) | NON | FAIT lot 3 SOUS RÉSERVE DE D-23 (valeurs initiales de l'existant à la reprise) (étape 8, 2026-11-06) : écran `/admin/referentiels` (imprimeurs et livreurs : ajout, désactivation ; agents = utilisateurs `recep` en lecture seule), API `GET /api/admin/referentiels/agents` + API REC-P10 réutilisée (Q-407) ; valeurs initiales de l'existant (`tr_imprimeur`, `tr_transposteur_reception`) à la reprise (D-23) |
| D-05 Destinataires, afficheurs, boucles, rouleurs, équipes, machines [B] | Grain de la ligne de préparation (destinataire × afficheur), ECR-COO-07 (rouleur), ECR-COO-10 (dispatch), départs camion ; `tr_destinataire`, `tr_dest_adresse`, `tr_ate_dest_trans` Sources : ECR-ADM-06, ECR-ADM-07 ; legacy-integrations.md §9 ; legacy-admin.md RG-ADM-046, 047 provisoires | Destinataire (site, boucle, canal, jour/heure), afficheur, rouleur, équipe, machine ; purge de la liste des destinations (EX-TRA-511) | NON | PARTIEL — lot 1 FAIT (étape 8, 2026-11-05) : référentiel des destinataires minimal (Q-403) ; équipes, machines, postes, boucles / canal et purge des destinations non repris (ECARTS) |
| D-06 Paramètres métier (règles) [A] | Valeurs lues par REC : écart 10 %, purge 4 semaines, délai de contrôle 24 h, comptage par morceau 30, exemplaires de feuilles 2, allée des inconnues X ; par COO : entretien (grain, seuil 3, arrondi), positions max, tiroirs 20, Instruction OK automatique, CC 15 %, similarité 0,85 Sources : maquettes-autres-modules.md §0.2, §0.4 ; ECR-ADM-05 ; EX-TRA-041 | Table de paramètres versionnée + API de lecture ; valeurs par défaut = maquette (à confirmer, Q-373) ; écran d'édition différable | NON | PARTIEL : lot 2 (étape 8, 2026-11-06) : écran `/admin/parametres`, API de lecture / modification / historique avec validation par format (Q-405) ; valeurs structurées en lecture seule (ECARTS) |
| D-07 Catalogue des statuts et correspondance `tr_statut` [A] | Machines d'états des entités P1 ; codes existants 0 à 10 -> statuts cibles (migration, historique) ; statuts « N » à créer Sources : ECR-ADM-03 ; EX-EXI-070 ; EX-TRA-018 ; Q-004, Q-381 | Table de statuts/transitions par entité ; export `tr_statut` à obtenir (Q-004) | NON | NON FAIT |
| D-08 Alertes : règles, destinataires, listes de distribution [B] | ECR-TRA-01 lit les types ; ECR-ADM-04 configure déclencheur, seuil, destinataires, canal ; mails du process (rajout après préparation, correction Broadcast) Sources : maquettes-autres-modules.md §0.2 (ADM-04) ; ECR-ADM-04 ; EX-TRA-029, EX-TRA-031 ; EX-ADM-504 | Table de règles (17 types), listes de distribution ; au minimum canal bandeau ; SMTP différé (Q-375) | NON | PARTIEL : lot 3 partiel (étape 8, 2026-11-06) : écran `/admin/alertes`, API `GET /api/admin/alertes/regles`, `PUT …/:type` (canal et destinataires, déclencheur et seuil en lecture), effets dans Pilotage › Alertes ; aucun mail (Q-375) ; listes de distribution, gravité configurable, écran Alertes de la Réception non repris (Q-408, ECARTS) |
| D-09 Journal d'audit et historique [A] | Traçabilité exigée par REC/COO (EX-TRA-034 à 037) ; journal « Purge automatique » ; `histo_historique_entite` du legacy Sources : ECR-ADM-08 ; legacy-reception.md dépendances (historique) ; Q-376 | Table de journal (date, auteur, objet, action) alimentée par le socle ; écran de lecture (ECR-ADM-08) | NON | PARTIEL : journal d'audit alimenté par le socle (apps/api/src/core/tracabilite.ts:ecrireJournal, table journal_audit) et historique de statut (statut_historique) ; écran Journal (ECR-ADM-08) NON FAIT |
| D-10 État des réservations vivant (copie Broadcast) et alimentation des réceptions attendues [A] | Source des « réceptions attendues » (ECR-REC-01 vue attendues), des quantités attendues, du statut de préparation (`statutPP`, IP saisies) ; cible des liens d'alertes et de la fiche dossier (ECR-PIL-03) Sources : maquettes-autres-modules.md §0.3, §0.4, ECR-PIL-03 ; EX-TRA-039 ; legacy-integrations.md §9 ; Q-005, Q-379 | Copie/lecture de l'EDR S à S+8 + intégration des préparations ; écran ECR-PIL-03 au grain thème | NON | PARTIEL : copie de l'état des réservations (apps/api/src/modules/coordination/integration-broadcast.ts, integration-flux.ts, alimentation-lignes.ts) et écran ECR-PIL-03 (apps/web/src/routes/pilotage/reservations.tsx), sur CONTRAT D'ENTRÉE SIMULÉ (Q-005 OUVERTE) |
| D-11 Fiche dossier partagée [B] | Navigation P1 <-> P2 (« Voir dans Instructions », « Voir les affiches ») Sources : ECR-PIL-04 ; §0.5 | Tiroir en lecture : visuels, préparation, unités, affiches reçues, historique | NON | NON FAIT |
| D-12 Vérification des thèmes [B] | Écriture vers Réception (tag « Feuille à refaire », alerte THEME_MODIF) ; alertes THEMES_PROCHES / ANNONCEURS_PROCHES / THEME_BC ; demandes de correction à Broadcast (mail par pôle) ; règle de proximité 0,85 Sources : maquettes-autres-modules.md §0.1, §0.3, §0.4 ; EX-REC-504 ; EX-THM-501 à EX-THM-504 ; Q-366 | ECR-THM-01/02/03 ; au minimum THM-03 | NON | PARTIEL : vérification des thèmes (apps/api/src/modules/coordination/themes.ts, routes-themes.ts ; apps/web/src/routes/coordination/themes.tsx ; ECR-THM-01 / 02 / 03 PARTIEL) ; demandes de correction à Broadcast mises en file (mail simulé) ; reste : boutons visuel, export xlsx, origine Plateforme |
| D-13 Stock : mouvements, rebut, fin de campagne [A pour mouvements, B pour écrans] | Création d'un mouvement `Réception` par affiche (ECR-REC-02) ; disponible = somme des mouvements ; rebut saisi aussi en ECR-STK-01 ; reste à recevoir et « couvert par le stock » Sources : maquettes-autres-modules.md §0.1, §0.2, ECR-STK-01..03 ; EX-TRA-037 ; EX-STK-501 à EX-STK-505 ; Q-383, Q-384 | Entité Mouvement + calcul du disponible ; ECR-STK-01/02 ; ECR-STK-03 reprend l'« État de destruction » (Q-385) | NON | PARTIEL : mouvements de stock, disponible = Σ mouvements, rebut, mouvements manuels (apps/api/src/modules/reception/stock.ts, stocks.ts), sorties d'expédition (colis.ts:sortiesStock) ; écrans ECR-STK-01 / 02 / 03 NON FAITS |
| D-14 Expédition : scan/colisage, colis, fin de journée Geodis [B] | Transitions finales des unités (Produit -> Colisé -> Expédié -> Livré) et sorties de stock automatiques qui diminuent le disponible des affiches reçues ; « Terminé » de l'existant (fin de journée colis) Sources : maquettes-autres-modules.md §0.2, ECR-EXP-01..02 ; EX-EXI-072 ; EX-EXP-501 à EX-EXP-506 ; Q-390 | ECR-EXP-01/02 ; fin de journée manuelle ; preuve de livraison simulée en attendant Geodis | NON | PARTIEL (2026-11-06, lot 5 : ECR-EXP-03 « Départs camions » (lecture, semaine × destinataire), colonnes Clos le / Expédié le / Récépissé et tri par statut d'ECR-EXP-02 ; restes : boucle, canal, jour et heure de départ (Q-403), étiquette Geodis, statut « Livré » et preuve de livraison (Q-284, Q-390, D-17), export xlsx (Q-175) ; Q-411) |
| D-15 Générateur de fichiers de production [B] | ECR-COO-05/07/09 « Générer les fichiers » ; passage PRET -> EN_PROD (point de non-retour, bagues) ; limite 20 tiroirs ; alerte DM_FICHIER / « Générer un complément » Sources : maquettes-autres-modules.md §0.3, §0.4, ECR-GEN-01..03 ; EX-FIX-502 ; EX-SCR-503 | ECR-GEN-01/03 (Vendôme) puis GEN-02 (multi-rouleuse) ; format `.ini` à définir ; historique des lots versionnés | NON | PARTIEL (2026-11-06, lot 5 : « Générer un complément » (RG-COO-074), historique « Fichiers » / « Modifiées depuis », liste de picking d'un lot ; restes : format .ini réel et dépôt réseau derrière `MachinePort` (Q-193, Q-194 OUVERTE : option (a) conservée), multi-rouleuse GEN-02, « Tout télécharger », unités EN_PROD à l'envoi (Q-265) ; Q-411) |
| D-16 Interface Broadcast / ExtPlay / INTERFACE (retour des réceptions) [B] | Retour vers Broadcast : affiche « associée » si liée et validation admin = 1 ; flux destinataires, trains, instructions ; déblocage `P_CirceDebloquerGroupePreparation` ; `P_ExportTrainAfficheTravailCirce` (rafraîchir un dossier) Sources : legacy-integrations.md §9 ; legacy-coordination.md §8 ; EX-TRA-039 ; Q-005, Q-377 | Contrats d'interface lus/écrits ; planification (inconnue, Q-005) | NON | PARTIEL : retour « reçue et associée » et flux d'entrée (apps/api/src/modules/coordination/retour-broadcast.ts, integration-broadcast.ts, core/ports/broadcast.ts) sur contrat simulé ; batch PEX réel et procédures INTERFACE / EXTPLAY NON FAITS (Q-005, Q-151, Q-377) |
| D-17 Interface Geodis (Zoom) [C] | Preuve de livraison, étiquette signée, fin de journée ; le batch actuel n'enregistre jamais son résultat Sources : legacy-integrations.md §10 ; EX-EXP-505 ; Q-390 | Hors P1 ; statut « Livré » alimenté plus tard | NON | NON FAIT |
| D-18 Modèles d'éditions et impression [A pour REC-P01] | Feuille de stock/étiquette rack (ECR-REC-09), bagues (ECR-COO-11), fiche de synthèse (ECR-COO-09) Sources : EX-TRA-024 à 026 ; legacy-admin.md RG-ADM-060 à 063 provisoires ; Q-002, Q-367 | Composants d'impression navigateur ; agent local selon Q-002 ; autres éditions (colis, picking, préparation) différables | NON | PARTIEL (2026-11-06, lot 5 : feuille de stock / étiquette rack (ECR-REC-09) et bagues existaient ; fiche de synthèse (ECR-COO-09d), liste de picking (rouleur et lot) et bagues imprimaient une page blanche : zone d'impression et modèle `Edition` ajoutés, modale non rognée ; restes : mise en page RDLC (Q-277, Q-287), numérotation de pages, envoi à l'imprimante de plateforme (Q-002), autres éditions (colis, préparation) ; Q-411) |
| D-19 Mails / SMTP [C] | Mails conservés du process (correction Broadcast, rajout après préparation) ; mail de déblocage ; mails colis (batch) Sources : EX-TRA-030 ; legacy-admin.md RG-ADM-043 à 045 provisoires | Service d'envoi derrière une interface ; hors stack actuelle : à valider (Q-375) | NON | PARTIEL : lot 4 partiel (étape 8, 2026-11-06) : port `MailPort` (boîte d'envoi simulée par défaut, SMTP minimal non activé), table `mail_file`, mails « colis expédié », déblocage, correction Broadcast et correction d'intitulé en file dans la transaction du fait, envoi hors transaction (tâche `ENVOI_MAILS`, `POST /api/admin/file-envoi/traiter`), 10 tentatives, relance, `mailEnvoye` / `mailStatut` mis à jour à l'envoi réel, API de consultation (pas d'écran : aucune maquette) ; mail « Rajout après préparation », canaux mail / digest D-08, fournisseur SMTP réel, STARTTLS, pièce jointe colis NON repris (Q-409, ECARTS) |
| D-20 Purge et traitements planifiés [B] | Purge des attendues à 4 semaines (REC), fin de journée colis, Instruction OK automatique (`p_batch_auto_instruction_ok`, Q-006), jobs d'alimentation Sources : EX-REC-512 ; legacy-integrations.md §10 ; Q-005, Q-006 | Planificateur de jobs côté API ; liste des jobs et fréquences à fournir (Q-005) | NON | PARTIEL : lot 4 partiel (étape 8, 2026-11-06) : ordonnanceur léger (pulsation 30 s désactivable, commande `taches:executer`, API `/api/admin/taches`), 4 tâches idempotentes (fin de journée colis, purge des attendues, Instruction OK automatique en rattrapage, envoi des mails), horaires = paramètres D-06 vides par défaut (désactivé), journal d'exécution, verrou UNIQUE anti double exécution, acteur technique ; horaires et jobs réels, batch Broadcast réel (simulé), purge de l'historique non repris (Q-005, Q-006, Q-410, ECARTS) |
| D-21 Fonctions legacy sans écran cible [C, arbitrage] | Déblocage préparations / Préparations débloquées (-> « Rendre la main »), Rafraîchir un dossier, Dupliquer train, Zone picking, Fusion des affiches, Analyse Production : droits et règles présents dans les notes legacy Sources : EX-TRA-012 ; ECR-NAV-02 ; legacy-admin.md §4 ; Q-382 | À arbitrer écran par écran (ne rien perdre, MISSION §12.6) | NON | PARTIEL : « Rendre la main » / déblocage (apps/api/src/modules/coordination/deblocage.ts, apps/web/src/routes/coordination/deblocage.tsx), « Rafraîchir un dossier » (integration-broadcast.ts:rafraichirDossier), dupliquer un train (trains.ts:dupliquerTrain) ; fusion des affiches et zone picking NON REPRIS (Q-100, Q-101 : décision à valider) |
| D-22 Process Métier (non-conformités) [C] | Lien depuis l'onglet Mouvements de la fiche affiche (ECR-REC-05) ; QUA-03 non couvert par la maquette Sources : EX-QUA-501 ; EX-TRA-040 ; Q-394 | Lien sortant seulement | NON | NON FAIT |
| D-23 Reprise de données (migration SQL Server -> PostgreSQL) [B] | Reprise des rattachements existants (sans quantité), des réceptions attendues (dédoublonnage), des référentiels Sources : specs-coordination.md « Sections non comprises » ; EX-TRA-511 ; Q-395 | Stratégie à définir ; données de référence au `seed:ref` | NON | NON FAIT |

## 5. Journal des sessions
| Date | Commande | Fait | Reste | Prochaine commande |
|---|---|---|---|---|
| 2026-11-04 | /etape-01-audit | Étape 1a terminée : inventaire, extraits UTF-8 (SQL, pptx, xlsx), 14 rapports dans docs/_travail/ (legacy REC/COO/ADM/RPR/INT, specs REC/COO/TRA/existant/ateliers, maquettes ×2, bdd). | Zones non analysées listées dans le bilan de l'audit (70 images d'ateliers, code hors dépôt INTERFACE/EXTPLAY/Broadcast, tables de référence tr_profil/tr_statut, SSIS, .mpd). | /etape-01-synthese |
| 2026-11-04 | /etape-01-synthese | Interrompue avant tout livrable : docs/ contient toujours les modèles vides. Seule la lecture des modèles et des profils de la maquette (ECR §1.3) a eu lieu. Plan de découpage envisagé (non appliqué) : RG-REC et RG-COO en parallèle avec plages d'IDs Q-/RG-X réservées, puis fonctionnelle/écarts/questions, puis plan, puis matrice générée par script. | Les 8 livrables de l'étape 1b, le contrôle EX/ECR de la matrice, la liste des questions BLOQUANTES. Étape 1 non terminée : ne pas passer à l'étape 2. | /etape-01-synthese (relancer) |
| 2026-11-04 | /etape-01-synthese | Étape 1b produite par synthèse parallèle : RECEPTION_REGLES_METIER.md et COORDINATION_REGLES_METIER.md (473 RG : 189 RG-REC, 230 RG-COO, 54 RG-X), fragments de synthèse dans docs/_travail/synth/, ANALYSE_FONCTIONNELLE_COMPLETE.md (7 sections : 1, 2, 3, 5, 7 reprises des fragments tra-fonc-*, section 4 = 23 fiches de parcours REC-P01..P10 et COO-P01..P13, section 6 = matrice d'impact RG-X, à valider à l'étape 7) et ce plan (10 parcours Réception, 13 parcours Coordination, 23 dépendances étape 8 non validées, index RG -> parcours §6 généré par script ; contrôle : 0 RG orpheline, tous les ECR-REC-01..12 et ECR-COO-01..11 rattachés). Remplace logiquement la ligne « Interrompue » ci-dessus. | Validation par l'équipe des questions BLOQUANTES (Q-001, Q-002, Q-004, Q-005, Q-204, Q-265, Q-300, Q-306, Q-307, Q-319), des dépendances §4, des profils (Q-003) ; contrôle EX/ECR de la matrice de traçabilité ; ECARTS_EXISTANT_VS_CIBLE.md et matrice si non encore générés. | Revue humaine puis /etape-02-architecture (une fois Q-300, Q-306, Q-307, Q-004, Q-319 tranchées ou en HYPOTHÈSE validée avant l'étape 3) |
| 2026-11-04 | /etape-02-architecture | Point 1 seulement (aucun code, aucun fichier projet créé) : lecture de MISSION, QUESTIONS, PLAN ; vérification qu'aucune question BLOQUANTE ne porte sur l'architecture (Q-001/002 = stubs, Q-300/306/307 = étape 3) ; proposition des choix non imposés (Fastify 5, pino, dotenv, structure de dossiers, versions pinnées ≤ 21/10/2026) ; questions Q-338 à Q-340 ajoutées. | Accord de l'équipe sur Q-338 ; installation de pnpm et Docker (Q-339) ; puis création du monorepo (point 2), vérification (point 3), mise à jour de CLAUDE.md §4 (point 4). Étape 2 : À FAIRE (non commencée côté code). | /etape-02-architecture (relancer après accord sur Q-338 et Q-339) |
| 2026-11-04 | Décisions équipe (hors commande) | Tranchées par l'utilisateur : Q-338 (stack proposée acceptée), Q-300 (a statut enum persisté), Q-306 (a lien n–n avec quantité), Q-307 (b entité Reception), Q-004 / Q-319 (seed minimal sans export DSI, écart tracé). | Q-339 (installer pnpm et Docker, version de Node) ; Q-001 et Q-003 toujours ouvertes (auth de dev + 6 rôles provisoires en attendant) ; tableau de l'étape 3 validé sur ces points, nommage (français + @@map ou anglais) à confirmer. | /etape-02-architecture puis /etape-03-modele-donnees puis /etape-04-socle-backend
| 2026-11-04 | Décisions déléguées (hors commande) | L'utilisateur m'a délégué les choix restants : Q-001, Q-002, Q-003 en HYPOTHÈSE PRISE (auth de dev, SiteAgentPort + mock, 6 rôles provisoires) ; Q-341 (noms français + @@map) et Q-342 (Node 24 LTS) créées en HYPOTHÈSE PRISE ; pnpm 12.14.0 installé. Écarts tracés. | Docker Desktop à installer par l'utilisateur ; restent ouvertes et bloquantes pour plus tard : Q-005, Q-204, Q-265 (étapes 5-6). | /etape-02-architecture
| 2026-11-04 | /etape-02-architecture | Monorepo pnpm créé : `apps/api` (Fastify 5, pino, Prisma 7 + SQLite, Zod), `apps/web` (TanStack Start + Router, Nitro node-server, Tailwind 4, Radix), `packages/shared` (Zod). Socle : erreurs (AppError, BusinessError, ConflictError…), `resolveIdentity` (fournisseur de dev HMAC, refusé en production), `SiteAgentPort` + `MockSiteAgent`, `LlmProvider`, config validée par Zod, relais `/api`. Page d'accueil + `GET /api/health` de bout en bout. ESLint strict + Prettier, Vitest, Playwright. Vérifié : `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `test` (shared 4, api 19, web 3), `test:int` (5), `test:e2e` (2), `db:up`, `db:test:up`, `seed:ref`, `jdd` au vert. Versions pinnées publiées avant le 21/10/2026. | Écarts dans ECARTS (§5) : pas de Docker/PostgreSQL, TS 6.0.3, Nitro bêta, API via tsx, seed/jdd squelettes. Q-338 à Q-344. Prettier a reformaté par erreur des fichiers Markdown de `.claude/` et `CLAUDE.md` (blancs seulement) ; ils sont maintenant exclus de Prettier. | /etape-03-modele-donnees (attendre l'accord sur le tableau déjà présenté ; nommage Q-341) |
| 2026-11-04 | /cloture-session (étape 2) | Clôture : `pnpm typecheck`, `lint`, `test` (shared 4, api 19, web 3) et `test:int` (5) au vert. Matrice : aucune RG/ECR implémentée à l'étape 2 ; EX-TRA-038 passée PARTIEL (configuration par variables d'environnement). Q-333 passée en HYPOTHÈSE PRISE. | Rien de nouveau hors écarts déjà listés (Docker/PostgreSQL absents, TS 6.0.3, Nitro bêta, API via tsx, squelettes seed/jdd). | /etape-03-modele-donnees |
| 2026-11-04 | /etape-03-modele-donnees | `schema.prisma` (42 modèles) : utilisateurs/rôles/permissions/périmètre, référentiels, journal d'audit, historique de statut, clé d'idempotence, Réception (`Reception` distincte), affiche, mouvement, ligne attendue + lien n–n avec quantité (`AfficheAttendue`), copie Broadcast, dossier, instruction, face, répartition, UM. Migration `20261104160802_cree_modele_initial` relue (0 DROP, 67 FK RESTRICT) + 4 index uniques partiels en SQL brut. `seed:ref` réel (6 rôles, 5 instruction plus, 5 types de préparation, 9 paramètres issus des RG, idempotent). Factories `apps/api/test/factories` (une par entité). Test d'intégration des contraintes (FK P2003, unicité P2002, NOT NULL, index partiels, seed) sur `test.db` neuve à chaque run. Vérifié : typecheck, lint, test (19), test:int (39), test:e2e (2). 10 RG passées PARTIEL dans la matrice (modèle seul). | Écarts (ECARTS §5) : colonnes de face/répartition non reprises, tables colis/export non reprises, Dossier minimal, permissions vides (étape 4), pas de TransitionStatut (Q-347), auteurs sans FK (Q-345), enums sans CHECK (Q-346). Aucun référentiel de production (Q-319). Pas de reprise des données. | /etape-04-socle-backend |
| 2026-11-04 | /cloture-session (étape 3) | Clôture : `pnpm typecheck`, `lint`, `test` (shared 4, api 19, web 3), `test:int` (39) et `test:e2e` (2) au vert. Matrice : 10 RG en PARTIEL (modèle seul, fichier et test renseignés), aucune passée FAIT. Q-345 à Q-347 ajoutées, Q-336 mise à jour. | Services, permissions, helpers (transaction, version, idempotence, historique, audit) : étape 4. Alimentation de `Permission` : étape 4. Colonnes de face/répartition, tables colis/export : parcours COO / étape 8. Référentiels de production : en attente d'un export DSI (Q-319). | /etape-04-socle-backend |
| 2026-11-04 | /etape-04-socle-backend | `apps/api/src/core` : identité (fournisseur de dev HMAC → utilisateur, rôles et périmètre relus en base ; site x-site-id vérifié), catalogue des permissions (53 codes, source par ligne, matrices REC §2 et COO §2) + `assertPermission` / `assertPlateforme` / `assertAtelier`, erreurs normalisées (403 `PERMISSION`), `withTransaction`, `updateWithVersion`, `withIdempotency` (rejeu, 409, 400, transaction unique), `assertTransition`, `ecrireHistoriqueStatut`, `ecrireJournal`, pagination/tri/filtre (`makeListQuerySchema` partagé). `GET /api/me`. `seed:ref` recopie le catalogue en base ; `pnpm dev:user`. Web : client typé (401/403/409/422, Idempotency-Key, x-site-id), `ErrorMessage`, garde `requirePermission` + page /acces-refuse, page /moi ; relais injectant l'identité de dev hors production. Tests : unit shared 10, api 41, web 23 ; intégration 60 (endpoint factice : 401, 403, 409 version/transition/idempotence, rejeu, rollback, pagination, périmètre) ; E2E 6. 17 RG passées PARTIEL. | Aucun endpoint métier n'utilise encore le socle (étapes 5/6). Q-348, Q-349 ajoutées. Auth réelle : Q-001. Ports 3000/3001 parfois occupés sur le poste (autre application) : voir clôture. | /etape-05-reception REC-P01 |
| 2026-11-04 | /cloture-session (étape 4) | Clôture : `pnpm typecheck`, `lint`, `test` (shared 10, api 41, web 23), `test:int` (60), `test:e2e` (6) au vert. Matrice : 17 RG du socle en PARTIEL avec fichiers et tests existants vérifiés ; aucune RG passée FAIT (pas d'endpoint métier). Q-348, Q-349 et la ligne d'écarts de l'étape 4 ajoutées pendant la session. | Brancher le socle dans les services Réception (REC-P01) ; auth réelle (Q-001) ; arbitrage des cases « ? » (Q-349), notamment acquittement des alertes (Q-220) et mouvements manuels (Q-117). | /etape-05-reception REC-P01 |
| 2026-11-04 | /etape-05-reception REC-P01 | Socle Réception : `apps/api/src/modules/reception/{statuts,permissions,formats,affiche,repository,stock,rattachement,service,routes}.ts` ; machines d'états RECEPTION / AFFICHE / RATTACHEMENT ; stock = Σ mouvements, reçu = Σ liens actifs, répartition ≤ reçu ; mouvements append-only ; écritures d'affiche versionnées ; permission obligatoire dans chaque écriture ; endpoints GET /api/receptions/:id, DELETE (409 RG-REC-074), GET /api/affiches/:id/stock, PUT/PATCH/DELETE /api/mouvements/:id (409 RG-REC-151). test-engineer : +134 tests. spec-auditor : NON CONFORME (2 bloquants, 5 majeurs) → corrections (ANO-001 à 006) + 23 tests. Tests : unit 80 (api) + 10 + 23, intégration 227, E2E 6. Pas d'écran (REC-P01 sans ECR). | 14 RG PARTIEL (voir ECARTS) ; Q-169 à Q-173 ajoutées. 2e passe spec-auditor : CONFORME (0 bloquant, majeurs restants tous rattachés à P02-P08, COO-P04 ou à une question). | /etape-05-reception REC-P02 |
| 2026-11-04 | /cloture-session (REC-P01) | Clôture : `pnpm typecheck`, `lint`, `test` (shared 10, api 80, web 23) au vert ; `test:int` 227 et E2E 6 au vert en fin de parcours. Matrice : 18 lignes REC-P01 vérifiées (4 FAIT, 14 PARTIEL, fichiers et tests existants). Questions Q-169 à Q-173 et ligne d'écarts REC-P01 ajoutées pendant la session. | Décisions avant REC-P02 : Q-171 (admin), Q-172 (rebut sur affiche répartie), Q-173 (portée du site). PARTIEL de REC-P01 à compléter par P02-P08 / COO-P04. | /etape-05-reception REC-P02 |
| 2026-11-04 | /etape-05-reception REC-P02 | API : GET /api/receptions-attendues (lignes du site ou du périmètre, recherche multi-valeurs avec absents / masqués, filtres Statut / Départ / Format / Contrôle / Annonceur avec compteurs, défauts RG-REC-015/016, depart=tous, tri, pagination, 400 REC_DOSSIER_FORMAT), GET /api/reception/compteurs (badges), statut de ligne persisté recalculé et historisé à chaque rattachement / retrait (écart = paramètre global), colonne Contrôle, purge (fonction, hypothèses Q-130). Migration `ajoute_exclusion_purge_attendues` (réécrite en ALTER TABLE). Web : page /reception (étape 1, tableau Réceptions attendues, filtres en listes à cocher, puces de recherche, sélecteur Colonnes, états chargement / vide / erreur, menu Réception avec badges). test-engineer : +87 tests (3 anomalies corrigées dans le code). spec-auditor : NON CONFORME (1 bloquant, 7 majeurs) → corrections. Tests : unit api 106, shared 14, web 23 ; intégration 338 ; E2E 16. | 10 PARTIEL, 3 BLOQUÉ (voir ECARTS) ; Q-174 à Q-176 ajoutées, Q-130 / Q-138 / Q-173 en HYPOTHÈSE PRISE. 2e passe spec-auditor : CONFORME (0 bloquant ; seul majeur restant : export Excel, Q-175). | /etape-05-reception REC-P03 |
| 2026-11-04 | /cloture-session (REC-P02) | Clôture : `pnpm typecheck`, `lint`, `test` (shared 14, api 106, web 23) au vert ; intégration 338 et E2E 16 au vert en fin de parcours. Matrice : 16 lignes REC-P02 vérifiées (3 FAIT, 10 PARTIEL, 3 BLOQUÉ ; fichiers et tests existants). Q-174 à Q-176 ajoutées, Q-130 / Q-138 / Q-173 passées en HYPOTHÈSE PRISE ; ligne d'écarts REC-P02 complétée. | Décision attendue : Q-175 (export Excel). PARTIEL à compléter par REC-P03, P04, P06, P07, P08, COO-P05 ; BLOQUÉ : Q-005, Q-134. | /etape-05-reception REC-P03 |
| 2026-11-04 | /etape-05-reception REC-P03 | API : POST /api/photos (base64, type et taille contrôlés, idempotent), GET /api/photos/:id (type MIME exact, périmètre), GET /api/reception/referentiels (listes fermées), POST /api/receptions/verification (contrôles du panier et du BL dans l'ordre de la maquette, sans écriture, réutilisé par REC-P04), GET /api/lignes-attendues/:id/visuel ; rattacher refuse deux plateformes. Web : actions « Au panier », « Ajouter au panier (n) », carte « Lignes du BL (panier) », carte « Bon de livraison » (photo du BL, champs, vérification, avertissement de doublon), modales Photo du BL / Voir le BL / Visuel. test-engineer : +75 tests (1 anomalie corrigée). Tests : unit api 106, shared 14, web 29 ; intégration 458 ; E2E 22. spec-auditor : NON CONFORME (0 bloquant, 3 majeurs : photo hors périmètre acceptée, 2 RG déclarées FAIT à tort, hypothèse non tracée) → corrigés. | 11 PARTIEL, 4 BLOQUÉ (Q-112) ; Q-177 ajoutée. 2e passe spec-auditor : CONFORME (0 bloquant, 0 majeur ; mineurs restants rattachés à Q-112, Q-139, Q-160, D-10, étape 10). | /etape-05-reception REC-P04 |
| 2026-11-04 | /cloture-session (REC-P03) | Clôture : `pnpm typecheck`, `lint`, `test` (shared 14, api 106, web 29) au vert ; intégration 458 et E2E 22 au vert en fin de parcours. Matrice : 17 lignes REC-P03 vérifiées (2 FAIT, 11 PARTIEL, 4 BLOQUÉ ; fichiers et tests existants). Q-177 ajoutée (11 points d'hypothèse) ; ligne d'écarts REC-P03 complétée (dont constat transverse sur les lignes EX). | REC-P04 : création de la réception (réutilise verifierBonDeLivraison), confirmation du doublon de BL, lignes cochées retirées du panier, date d'entrée des affiches. BLOQUÉ : Q-112. | /etape-05-reception REC-P04 |
| 2026-11-04 | /etape-05-reception REC-P04 → REC-P10 (Réception complète en une session) | API (routes-suite.ts) : POST /api/receptions (validation atomique, complément si Partielle, intitulé saisi, doublon de BL à confirmer, 500 REC_ERREUR_INTERNE) ; sas et contrôle (GET/POST /api/receptions/:id/controle : écarts, rebut, emplacement, non-conformité, surplus en entretien conditionnel, contrôleur) ; feuilles de stock (GET /api/feuilles, POST /api/impressions, rangement, édition picking) ; réceptions inconnues (création, liste à statut calculé, recherche triée, rattachement selon le rôle, signalement, orphelines d'une palette normale Q-180) ; affiches (liste à tags calculés, fiche 4 onglets, modification historisée, rattacher / changer de thème / retirer, validation admin, lecture seule des fusionnées RG-REC-169) ; rebut ; alertes calculées RG-REC-182 à 189 ; paramètres (jeton de concurrence) et référentiels imprimeurs / livreurs. Web : « Valider la réception », sas + contrôle (?palette=), aperçu A4 avec code-barres Code 39 et n exemplaires, étiquettes rack, modale réception inconnue, pages Liste des affiches (+ Ranger avant d'imprimer), Réceptions inconnues, Alertes, fiches affiche et réception. test-engineer : 2 passes (+216, +105 tests ; anomalies ANO-013 à 015 corrigées, ANO-019 → Q-179). spec-auditor : 1re passe NON CONFORME (2 bloquants, 6 majeurs) → corrigés ; 2e passe NON CONFORME (8 RG sans paire de tests, exemplaires non rendus, étiquettes rack, EX non reportées) → corrigés ; 3e passe lancée en fin de session : verdict non reçu à la clôture (à relire en ouverture de la prochaine session). Tests : unit 152 ; intégration 944 (1 échec attendu témoin de Q-179) ; E2E 26. | RG BLOQUÉES / PARTIEL : ECARTS « REC-P04 à REC-P10 » ; Q-178 (24 points), Q-179, Q-180, Q-181 ajoutées ; ECART-103. | /cloture-session puis étape 6 (Coordination, COO-P01) ou arbitrage Q-179 / Q-180 / Q-181 |
| 2026-11-04 | /cloture-session (REC-P04 → REC-P10) | Clôture : `pnpm typecheck` OK, `pnpm lint` OK (ESLint + Prettier), `pnpm test` OK (shared 14, api 106, web 32). En fin de parcours : intégration 944 (943 OK + 1 échec attendu, témoin de Q-179), E2E 26/26. Matrice vérifiée par script sur les 166 lignes RG / ECR des parcours P04 à P10 (114 FAIT, 36 PARTIEL, 6 → 16 BLOQUÉ après reclassement de RG-REC-159, 160, 194 à 196, 198 à 202 ; RG-X / RG-COO de la partie Réception passées PARTIEL ; fichiers d'implémentation et de tests existants, chaque test cité porte l'ID). Questions : Q-178 (24 points), Q-179, Q-180, Q-181. Écarts : ECART-103, ligne « REC-P04 à REC-P10 : ce qui reste ». Réception : tous les sous-parcours REC-P01 à P10 traités ; aucun n'est FAIT au sens strict (RG BLOQUÉES / PARTIEL dépendant de questions ouvertes). | Verdict de la 3e passe spec-auditor à relire (corriger s'il reste un écart non tracé) ; arbitrages Q-179 (périmètre admin), Q-180 (orpheline d'une palette normale), Q-181 (propagation 2 m²), Q-175 (export), Q-112 (lecture BL / visuel), Q-002 (impression) ; lignes EX restées À FAIRE (sans RG implémentée). | /etape-06-coordination COO-P01 (après lecture du verdict d'audit) |
| 2026-11-04 | Suite d'audit REC-P04 → REC-P10 | 3e passe spec-auditor : NON CONFORME (6 RG sans paire de tests : 038, 041, 058, 061, 065, 103 ; 9 EX FAIT à tort car leurs RG-COO / RG-X de couverture ne sont pas faites) → tests ajoutés (audit-rec-2.int.test.ts, apps/web/src/lib/ecart.test.ts, E2E « Étiquettes rack ») ; statut des EX recalculé sur toutes leurs RG ; champs Tests des fiches alignés sur la matrice. 4e passe : CONFORME (4 mineurs de documentation corrigés). Tests : unit 154, intégration 952 (1 échec attendu, Q-179), E2E 27. | Réception REC-P04 à P10 : audit CONFORME ; RG BLOQUÉES / PARTIEL tracées (ECARTS). | /etape-06-coordination COO-P01 |
| 2026-11-04 | /etape-06-coordination COO-P01 + /cloture-session | API (modules/coordination) : table de transitions d'instruction (utilisateur / système) et de préparation du dossier ; POST /api/coordination/instructions/:code/statut (annuler, remettre à traiter, retour arrière avec effacement du calcul des trains d'après p_u_statut_preparation.sql ; version + Idempotency-Key ; historique et journal nominatifs) ; GET /api/coordination/dossiers (périmètre site / atelier, filtres) ; intégrations Broadcast en fonctions de service (instructions RG-COO-041 avec renvois ignorés tracés, chapeaux, préparation du dossier RG-COO-063, annulation du dossier RG-COO-062 + RG-X-065 en une transaction : lignes ANNULEE, affiches gardées en stock) ; Commerce en lecture seule (403 RG-COO-168), aucun rôle Pré-Prod. Web : /coordination (ECR-COO-01 socle) avec confirmation d'effacement. E2E : projet Playwright « coordination » (2e serveur web, utilisateur e2e.coord). test-engineer : +112 tests (ANO-020 corrigée ; ANO-021 → Q-182 (9)). Tests : unit 159 ; intégration Coordination 172 ; E2E 31. Clôture : typecheck, lint, test au vert ; matrice COO-P01 vérifiée par script (12 FAIT, 18 PARTIEL, fichiers et ID présents). spec-auditor COO-P01 lancé : verdict NON REÇU à la clôture. | COO-P01 PARTIEL : Instruction OK (COO-P02), pastille de validation (COO-P03), alertes (COO-P05), traitements planifiés (étape 8) ; Q-182 (12 points). | Lire le verdict spec-auditor COO-P01 et corriger s'il reste un écart non tracé, puis /etape-06-coordination COO-P02 |
| 2026-11-04 | COO-P01 suite d'audit + /etape-06-coordination COO-P02 | COO-P01 : 1re passe NON CONFORME (RG-COO-041 détails / visuels non faits, RG-COO-061 sans nominal) → détails en annule-et-remplace et visuels mis à jour, tests renommés, GET /api/coordination/ateliers ; 2e passe CONFORME (mineurs corrigés : Q-204 alignée dans les docs, Q-182 (13-16)). COO-P02 : Q-204 posée à l'utilisateur (bloquante) → TRANCHÉE option (b). Instruction OK automatique dès la prépa (règle de Nariman, fonction pure) et réouverture sur renvoi avant l'export ; Instruction OK manuelle groupée (tout ou rien, 422 répartition ≠ 100 % / prépa non reçue) ; saisie entretien / position / annonceur / commentaire (figée en Instruction OK, « En cours » + prépa reçue) ; écart Broadcast / Circé (grain plateforme / périmètre) ; « Appliquer la version Broadcast » (+ RG-X-064 côté Réception dans la transaction) ; demande de correction tracée (FAITE au renvoi ; mail : Q-375) ; filtre « À faire » ; fiche dossier ECR-COO-02 (historique) et modale ECR-COO-04. Migration ALTER / CREATE (iok_mode / par / le ; demande_correction). test-engineer : +174 tests (ANO-022 à 024 corrigées). spec-auditor COO-P02 : 1re passe NON CONFORME (lint, ANO-025 prépa non reçue, historique) → corrigés ; 2e passe CONFORME (7 mineurs corrigés ou tracés). Tests : unit 165 ; intégration Coordination 415 (1 todo RG-COO-204) ; E2E 35. | COO-P02 PARTIEL : Q-257 (campagne contrôlée), Q-375 (mail), alertes COO-P05, trains coo2, validation admin COO-P03 ; Q-183 (18 points) à faire valider (notamment (11) grain de l'écart, (12) compensation, (13) automatique après renvoi). | /etape-06-coordination COO-P03 |
| 2026-11-05 | /cloture-session (COO-P02) | Clôture : `pnpm typecheck`, `pnpm lint`, `pnpm test` au vert (shared 14, api 117, web 34) ; en fin de parcours : intégration Coordination 415 (1 todo RG-COO-204), E2E 35. Matrice vérifiée par script sur les 67 lignes RG / ECR / EX de COO-P01 et COO-P02 (24 FAIT, 42 PARTIEL, 1 BLOQUÉ ; fichiers présents, chaque test cité porte l'ID). Questions : Q-183 (18 points), Q-204 TRANCHÉE (b). Écarts : lignes COO-P01 et COO-P02 de ECARTS à jour. COO-P01 et COO-P02 : audit CONFORME. | À faire valider : Q-183 (11) grain de l'écart, (12) compensation, (13) Instruction OK redevenant automatique après renvoi ; Q-179, Q-180, Q-181 (Réception). Bloqués : Q-257, Q-375. | /etape-06-coordination COO-P03 |
| 2026-11-05 | /etape-06-coordination COO-P03 | Q-184 posée à l'utilisateur (mode de rattachement du panier) → TRANCHÉE : mode BL (REC-P03 modifié, 6 tests alignés). API : validation-admin.ts (fonctions pures état / motifs BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE, LIGNE_FERMEE / pastille ; affichesDesDossiers ; POST /api/coordination/validation-admin : lot atomique, 422 RG-COO-012 avec la liste des doutes, 422 RG-COO-013, ignorées listées, idempotence) ; liste ECR-COO-01 (pastille, filtre ?va=, casSur / casSurs, « À faire » inclut la validation) ; fiche ECR-COO-02 (affiches reçues, motifs, « Pas encore reçue ») ; fiche affiche ECR-REC-05 (état et motifs). Migration ALTER affiche.validation_annulee. Web : colonne et filtre « Validation admin », « Valider la sélection », pré-cochage et « Cocher les cas sûrs (n) », modale ECR-COO-03, « Valider (n affiches) ». E2E : 4 tests (2e site de e2e.coord). test-engineer : +78 tests (ANO-026 à 028 corrigées). spec-auditor COO-P03 : 1re passe NON CONFORME (commentaires d'ID, paires nominal / rejet RG-X-002 / RG-COO-002, colonne « Reçue », mineurs M1 à M11) → corrigés ; 2e passe CONFORME (mineurs m2 à m5 corrigés, m1 libellé d'historique de la proposition tracé dans ECARTS). Tests : unit 194 ; intégration 1471 (1 échec attendu Q-179, 1 todo RG-COO-204) ; E2E 39. | COO-P03 PARTIEL : alertes « Validation admin à confirmer » (COO-P05), effets de la validation et actions par affiche (COO-P04), proposition calculée par Circé (Q-112), suivi de prod / état des réservations ; Q-185 (13 points) à valider. | /etape-06-coordination COO-P04 |
| 2026-11-05 | /cloture-session (COO-P03) | Clôture : `pnpm typecheck`, `pnpm lint`, `pnpm test` au vert (shared 14, api 146, web 34) ; en fin de parcours : intégration 1471 (1469 verts, 1 échec attendu Q-179, 1 todo RG-COO-204), E2E 39. Matrice, QUESTIONS (Q-184 TRANCHÉE, Q-185 HYPOTHÈSE PRISE), ECARTS (ligne COO-P03) et RAPPORT_TESTS (ANO-026 à 028) déjà à jour en fin de parcours. COO-P03 : audit CONFORME, statut PARTIEL. | À faire valider : Q-185 (4) pré-cochage seulement sans autre travail, (10) motif LIGNE_FERMEE, (11) règle citée par la validation unitaire, (13) ; Q-183 ; Q-179, Q-180, Q-181. Bloqués : Q-257, Q-375. | /etape-06-coordination COO-P04 |
| 2026-11-05 | /etape-06-coordination COO-P04 (implémentation) | Migration ALTER `affiche.theme_modifie`, `affiche.etiquette_rack_a_imprimer`. API : effets-validation.ts (POST /api/coordination/affiches/:id/validation-admin « Valider » / « Annuler la validation », RG-COO-009 dans le service, 409 RG-COO-008 / 014, idempotence ; données de validation communes à la Coordination, à la fiche affiche (RG-X-015), aux rattachements (RG-X-014 / 051) ; GET /api/coordination/etiquettes-rack ; effetsLigneModifiee RG-COO-030 à 032 ; estAssociee, aTraiter (liste des affiches ?aTraiter=oui), marques • / ✓ et n° au suivi de prod dans la fiche dossier, affiches à re-rattacher) ; toast complet de la maquette ; libellé d'historique « Rattachement proposé par Circé (automatique)… » (RG-X-001). Web : boutons par affiche dans la fiche dossier, colonne N° d'affiche des lignes, encadré « ligne annulée », encadré « Étiquettes rack à imprimer » + « Imprimer » (aperçu PDF existant). Tests : unit +6, intégration +50, E2E +1. Q-186 (9 hypothèses). | Restes COO-P04 : voir ECARTS « COO-P04 » ; test-engineer et spec-auditor à lancer sur COO-P04. | test-engineer + spec-auditor COO-P04 |
| 2026-11-05 | COO-P04 test-engineer + audit | test-engineer : +79 tests (`effets-validation-complement.int.test.ts`), ANO-029 à 032 corrigées dans le code. spec-auditor : NON CONFORME (B1/B2 effets de ligne non branchés, B3 RG-X-050 PARTIEL, 9 mineurs) → corrigé : `lignes-maj.ts:mettreAJourLigneAttendue` branché sur `integrerPreparation` (lignes de la prépa), `appliquerVersionBroadcast` ; `annulerDossier` appelle `effetsLigneModifiee` ; alertes calculables `alertesValidation` (interface pour COO-P07) ; RG-COO-030 / 031 / 032 et RG-X-050 PARTIEL (alerte affichée : COO-P07) ; mineurs 1 à 9 (par / le conservés, garde de fusion dans le lot, fiche affiche RG-COO-008 / 014 et état calculé, étiquettes rack pour la Réception, textes ECR-REC-04 / 05, boutons désactivés ECR-COO-02, admin consulte ECR-REC-04 Q-186 (11), 1 E2E). Tests : unit 200 ; intégration 1611 (1609 OK + 1 échec attendu + 1 todo) ; E2E 41. | Relancer spec-auditor sur COO-P04 ; alertes affichées : COO-P07. | spec-auditor COO-P04 (2e passe) |
| 2026-11-05 | COO-P04 audit 2e passe | 1 bloquant + mineurs corrigés : ligne fermée ignorée et tracée sans faire échouer la prépa (Q-186 (13)) ; cible de fusion héritée ignorée et listée FUSIONNEE dans le lot (Q-186 (14)) ; thèmes comparés par normaliserTheme (Q-186 (15)) ; imports circulaires supprimés (validation-donnees.ts, dossierDuPerimetre dans permissions.ts ; aucun cycle d'import dans src/modules). Tests : unit 200 ; intégration 1614 (1612 OK + 1 échec attendu + 1 todo) ; E2E 41. | Relancer spec-auditor (3e passe) si nécessaire. | spec-auditor COO-P04 |
| 2026-11-05 | COO-P04 audit 3e passe | spec-auditor : CONFORME (B1 ligne fermée ignorée Q-186 (13), m1 FUSIONNEE, m2 normaliserTheme, m4 cycles supprimés vérifiés). COO-P04 reste PARTIEL (RG PARTIEL rattachées à Q-003, Q-005, Q-100, Q-210, D-10, COO-P07). | Mineur restant : alertes RG-COO-030 à 032 calculées (`alertesValidation`) mais lues par aucun écran → COO-P07. | /etape-06-coordination COO-P05 |
| 2026-11-05 | /etape-06-coordination COO-P05 (implémentation) | Migration ALTER `tf_prepa_affiche` (IdTheme, provisoire, fermee_le, non_vue_le) + table `transaco_surface_format` (CorrespondanceSupport) ; 3 paramètres (fenêtre, destinataires exclus, supports bandeau). API : alimentation-lignes.ts (lecture Broadcast : clé, identifiants, fenêtre ISO, exclusions, provisoire, saisie des IP avec déplacement des affiches, disparition en deux lectures ; arrivée de la prépa : bascule PREPA, sources répartitions / faces / bandeau ; dédoublonnage de reprise), lignes-maj.ts (source, champs d'alimentation), reservations.ts (GET /api/coordination/reservations, GET /api/coordination/suivi-production, DELETE /api/coordination/lignes-attendues/:id → 409 RG-COO-089), inconnues.ts (propositions limitées aux lignes non couvertes, RG-COO-088). Web : /pilotage/reservations (ECR-PIL-03). Tests : unit 210 ; intégration 1665 (1663 OK + 1 échec attendu + 1 todo) ; E2E 43. Q-187 (13 hypothèses). | test-engineer et spec-auditor COO-P05 à lancer. Restes : voir ECARTS « COO-P05 ». | test-engineer COO-P05 |
| 2026-11-05 | COO-P05 test-engineer + audit | test-engineer : +71 tests (`lignes-attendues-complement.int.test.ts`, `alimentation-lignes-complement.test.ts`), ANO-033 corrigée (ligne ACTIVE exigée dans `rattacher`, tous chemins) ; paramètres bandeau mal formés ignorés. spec-auditor : NON CONFORME → B1 RG-COO-080 à 083, 085, 087, 096, 098, 100 passées PARTIEL (calcul fait, branchement COO-P06, source Q-005) ; B2 indicateurs ECR-PIL-03 selon la maquette `PHASES` (validation à confirmer en pré-production), tuile = filtre multi-étapes (`ou` multi-valeurs) ; mineurs : fusion d'un thème renommé sur une clé occupée (Q-187 (14)), `lignes-vie.ts` (fermeture, déplacement de lien sous verrou de version), alertes de l'alimentation journalisées + `alertesAlimentation` (interface COO-P07), droit vérifié dans le service du DELETE (Q-187 (9)), rejets RG-COO-098 / 100, libellés « Afficher par » et liseré (paramètre `coordination.deadlinePrepa`, Q-187 (15)), formulation RAPPORT_TESTS ; mineur 4 (unifier les deux chemins prépa) : reste COO-P06. Tests : unit 221 ; intégration 1734 (1732 OK + 1 échec attendu + 1 todo) ; E2E 44. | Relancer spec-auditor (2e passe). | spec-auditor COO-P05 |
| 2026-11-05 | COO-P05 audit 2e passe + /etape-06-coordination COO-P06 (implémentation) | COO-P05 : spec-auditor 2e passe CONFORME (B1 neuf RG en PARTIEL faute de branchement, B2 indicateurs ECR-PIL-03, mineurs 1 à 8) ; phrase fausse d'ECARTS (RG-COO-087 « fermeture d'un dossier annulé branchée ») corrigée. COO-P06 : migration ALTER `20261105160000_ajoute_integration_broadcast` (passage_integration avec verrou unique, flux_chargement, tr_destinataire_adresse, tr_ate_dest_trans, envoi_broadcast ; tf_face_train ref_panel / pers_ident / pers_nom ; tf_repart_calcul IdGroupePreparation) ; port `BroadcastPort` (aucun adaptateur réel, Q-005) ; `integration-flux.ts` (état des réservations par dossier avec copie, destinataires + transport par défaut, prépa fixe / pliage routée + renvoi refusé + suivi par groupe, faces par dossier × semaine + afficheur par panel, instructions + types forcés, annulations), `integration-broadcast.ts` (passage, verrou 409, ordre fixe, journal, délai, alertes techniques, envoi en file rejoué, planificateur, rafraîchir), `retour-broadcast.ts` (RG-COO-134) ; routes `GET/POST /api/coordination/integration/passages`, `POST …/rafraichir-dossier` (Idempotency-Key de lot : `withIdempotencyEtapes`) ; commande `integration:lot` ; 12 paramètres (Q-227) ; écran `/coordination/integration`. Branchements : alimenterDepuisBroadcast (flux état des réservations, dossiers absents), alimenterDepuisPreparation + integrerPreparation (flux prépa, chemin unifié : bascule PREPA), annulerDossier (dossiers annulés) → RG-COO-080, 081, 082, 083, 085, 087, 094, 095, 096, 098, 100 FAIT. Tests : unit +15, intégration +40, E2E +3 ; seed E2E par le passage. typecheck, lint, test (236), test:int (1772 + 1 échec attendu Q-179 + 1 todo), test:e2e (47) au vert. | COO-P06 PARTIEL : FAIT 091, 092, 093, 102, 115, 117 à 121, 126 à 130 ; PARTIEL 103, 104, 116, 122, 123, 125, 131, 132, 134 ; BLOQUÉ 109 (Q-228) ; hypothèses Q-188 (13 points). test-engineer et spec-auditor à lancer sur COO-P06. | test-engineer + spec-auditor COO-P06, puis /etape-06-coordination COO-P07 |
| 2026-11-05 | COO-P06 test-engineer + audit (1re passe) | test-engineer : +59 tests (`integration-broadcast-complement*`), ANO-034 corrigée (faces supprimées une fois par dossier × semaine) ; preuve RG-COO-116 (échec : ni accusé ni purge). spec-auditor 1re passe NON CONFORME → corrigé : B1 dépôt de lot retiré de la route (connecteur / `integration:lot` seulement), indicateur `lectureComplete` (fermeture des dossiers absents), périmètre de « Rafraîchir un dossier » ; B2 RG-COO-130 « UpdateRessource » (panels entièrement 0 à 4) ; mineurs : restes « branchement » nettoyés, RG-COO-134 selon le legacy (lignes non issues de Broadcast), passage manuel administrateur (droit `integration.passage_manuel`, Q-189 OUVERTE), verrous de version (destinataires, dossier, faces), rejets nommés 092 / 117 / 128. typecheck, lint, test (245), test:int (1832 + 1 échec attendu Q-179 + 1 todo), test:e2e (47) au vert. | Q-188 (16 points), Q-189 OUVERTE (non bloquante). | spec-auditor COO-P06 2e passe, puis /etape-06-coordination COO-P07 |
| 2026-11-05 | COO-P06 audit 2e passe | spec-auditor 2e passe CONFORME : B1 (route sans lot, `lectureComplete`, périmètre de « Rafraîchir »), B2 (RG-COO-130 UpdateRessource) et mineurs 1 à 6 vérifiés ; commentaire périmé de `integration-broadcast.ts` supprimé. Restes : alertes sans lecteur → COO-P07. | Q-005 (BLOQUÉE), Q-189 (OUVERTE), Q-188. | /etape-06-coordination COO-P07 |
| 2026-11-05 | /etape-06-coordination COO-P07 (implémentation) | API : `coordination/alertes-coordination.ts` (RG-COO-033, 053, 066, 067 / 031 / 086, 032, 068, 069, 070, 071, 073, 074, 103 / 116 / 122 / 081, calculées à la lecture), `coordination/themes.ts` (règle de proximité 0,85 paramétrable, groupes thèmes / annonceurs, demande de correction, Visuels / Annonceurs différents, Rouvrir, thèmes modifiés dans Broadcast, « Reprendre la version BC » RG-X-057), `coordination/production.ts`, module transverse `alertes/` (GET /api/alertes, POST /api/alertes/acquittements : droit refusé à tous, Q-220), routes `routes-themes.ts` ; ECR-COO-01 : deadline Pré-Prod de la préparation (teinte critique). Migration `20261105180000_ajoute_alertes_verification_themes` (3 tables, CREATE seulement) ; 6 paramètres ; droit `verification_themes.consulter`. Web : `/pilotage/alertes` (ECR-TRA-01), `/coordination/themes` (ECR-THM-01 à 03). ANO-035 corrigée (liste des dossiers par paquets, limite de paramètres SQLite). Requalifiées FAIT : RG-COO-030, 031, 032, 084, 086, 116, 122, RG-X-050. Tests : unit 261 ; intégration 1882 (1 échec attendu Q-179, 1 todo) ; E2E 50. | Q-190 (15 points) à valider ; mails Q-375 ; acquittement Q-220 ; test-engineer et spec-auditor COO-P07 à lancer. | test-engineer + spec-auditor COO-P07, puis /etape-06-coordination COO-P08 |
| 2026-11-05 | COO-P07 test-engineer + audit (1re passe) | test-engineer : +42 tests, ANO-036 (thème modifié après l'Instruction OK sur affiche non validée) et ANO-037 (quantité modifiée après validation sans prépa) corrigées ; fenêtre des rajouts mal saisie → valeur par défaut. spec-auditor 1re passe NON CONFORME → corrigé : B1 encadrés de la fiche dossier (ECR-COO-02 : thème modifié dans Broadcast + Reprendre, thème proche + Vérifier les thèmes) ; mineurs : alerte d'écart unique par dossier (Q-190 (19)), colonne masquée « Visuels » d'ECR-COO-01, filtre Atelier / modale de détail / colonne « Statut pré-production » d'ECR-THM, ECARTS. Tests : unit 271 ; intégration 1920 (1 échec attendu, 1 todo) ; E2E 51. | Export (Q-175), boutons visuel, « Modifié le » : ECARTS. | spec-auditor COO-P07 2e passe |
| 2026-11-05 | COO-P07 audit 2e passe | spec-auditor 2e passe CONFORME (B1 encadrés ECR-COO-02, mineurs 1, 2, 4, 5 vérifiés). Mineurs restants corrigés au début de COO-P08 : m1 « Reprendre la version Broadcast » de la fiche dossier en UNE transaction (POST /api/coordination/themes/broadcast/reprendre-dossier, `themes.ts:reprendreThemesDossier`, idempotence, test d'atomicité) ; m2 « Vérifier les thèmes » en `Link` du routeur, désactivé sans `verification_themes.consulter`. Reste : durée des alertes événementielles (Q-190 (3), Q-220). | — | /etape-06-coordination COO-P08 |
| 2026-11-05 | /etape-06-coordination COO-P08 (implémentation) | API : `coordination/deblocage.ts` (RG-COO-140 à 149, 151, 152, 277 à 279, RG-X-059 : recherche des groupes UM / TRAIN, règles d'inclusion / exclusion des ateliers, statut d'avancement, gardes UM ≥ 6 et faces ≠ 0/1/4, correspondance absente = refus explicite, « Rendre la main » dans une transaction : répartitions puis UM → Annulé, historiques de statut, trace `deblocage_preparation`, historique du dossier, demande `DEBLOQUER_GROUPE` mise en file pour Broadcast, mail tracé non envoyé ; transition INTEGRE → DEBLOQUE, 409 sinon ; suivi « Préparations débloquées ») ; `routes-deblocage.ts` (GET/POST /api/coordination/deblocage/groupes, GET …/suivi). Migration `20261105200000_ajoute_deblocage_preparation` (CREATE). Shared : `coordination-deblocage.ts`. Web : `/coordination/deblocage` (recherche, grille legacy, modale « Rendre la main à la Pré-Prod » reprise d'ECR-COO-09b, suivi) + lien d'accueil. E2E : seed site « DEB » (dossiers 2190001 / 2190002) + `e2e/coordination-deblocage.spec.ts` (3). Tests : unit +7 (deblocage.test.ts), intégration +31 (deblocage.int.test.ts) +4 (reprise groupée, alertes-preprod), E2E +3. Q-191 (10 points) en HYPOTHÈSE PRISE. Statuts : FAIT 140, 141, 142, 143, 144, 146, 148, 149, 152, 277, 278, 279, RG-X-059 ; PARTIEL 145 (Q-005), 147 (Q-375), 151 (unités « En attente » : RG-COO-243, COO-P12) ; BLOQUÉ 150 (Q-228). Commandes : typecheck 0, lint 0, test 278 (shared 14, web 34, api 230), test:int 1955 (1953 verts, 1 échec attendu Q-179, 1 todo RG-COO-204), E2E 54. | test-engineer et spec-auditor COO-P08 ; Q-191 à valider | /etape-06-coordination COO-P09 |
| 2026-11-05 | COO-P08 test-engineer + audit (1re passe) | test-engineer : +61 tests (`deblocage-complement*`), ANO-038 (période par défaut un 31) et ANO-039 (date impossible acceptée, même défaut sur l'édition picking) corrigées (`DateJourSchema` partagé). spec-auditor 1re passe NON CONFORME : B1 contrôle et annulation par tranche dossier × semaine au lieu du groupe Broadcast entier → corrigé (clé `UM:<IdGroupePreparation>`, groupe entier sur une ligne avec ses tranches, historique de chaque dossier, tests deux semaines / deux dossiers) ; mineurs : plateforme du site déduite du référentiel tracée (Q-191 (11)), alerte « Déblocage non transmis à Broadcast » (Q-191 (12), test), risque de réintégration partielle explicité (Q-191 (5)). Commandes : typecheck 0, lint 0, test 287, test:int 2013 (2011 verts, 1 échec attendu Q-179, 1 todo), E2E 54. | 2e passe spec-auditor | /etape-06-coordination COO-P09 |
| 2026-11-05 | COO-P08 audit 2e passe | spec-auditor 2e passe CONFORME : B1 (groupe entier `UM:<IdGroupePreparation>`, contrôle RG-COO-143 / 277 et annulation RG-COO-278 sur toutes les tranches, une ligne avec `tranches`), m1 Q-191 (11), m2 alerte « Déblocage non transmis à Broadcast » Q-191 (12), m3 Q-191 (5). Aucun mineur nouveau. | COO-P08 PARTIEL (RG-COO-145 Q-005, 147 Q-375, 151 → COO-P12, 150 BLOQUÉ Q-228). | /etape-06-coordination COO-P09 |
| 2026-11-05 | /etape-06-coordination COO-P09 (implémentation) | Migration ALTER `tf_face_train` (emplacement legacy, `fractionnee`, `origine_train`, `motif_suppression`). API : `trains-calcul.ts` (RG-COO-200 à 203, 205 : train_id et version, ordre, répartition des thèmes au prorata, exceptions, bandeaux, entretien en paramètres, anti-doublons) appelé dans la transaction de l'Instruction OK ; `statuts-trains.ts` (table de transitions des faces, changer statut, statut d'unité calculé) ; `trains.ts` + `routes-trains.ts` (liste ECR-COO-05 avec couverture « départ le plus proche d'abord », fiche, fractionner, raccrocher, créer un pré-test, supprimer, changer statut, annuler thème, débloquer semaine, dupliquer ; version de train + idempotence). Contrat des faces Broadcast : emplacement optionnel. Web : `/coordination/trains` (filtres, indicateurs, encadré « À faire », positions A / B / C, sélection des N premiers, modales 05a / 05c / 05d / 05e). Consigne utilisateur reçue en cours : plus de nouveaux tests unitaires (le fichier unitaire ajouté a été retiré, ses cas non couverts par l'API reportés en intégration). Tests : intégration +77 (`trains.int.test.ts`), 3 tests existants alignés (trace CALCUL_TRAINS, 35 paramètres) ; E2E +4. Q-192 (15 points). | COO-P09 PARTIEL : boutons Changer statut / Annuler thème / Débloquer semaine / Exporter / Bagues (COO-P10 / P11), Paris (Q-255), écran de duplication (Q-260), RG-COO-204 (Q-257). test-engineer et spec-auditor à lancer. | test-engineer + spec-auditor COO-P09 |
| 2026-11-05 | COO-P09 audit CONFORME avec réserves + /etape-06-coordination COO-P10 | Réserves P09 corrigées : tests 115 / 116 stabilisés (cause réelle : flux Destinataires et retour Broadcast en O(base) : createMany par paquets, requêtes groupées, validation des envois par paquets ; délai explicite 60 s ; 3 exécutions complètes vertes), RG-COO-219 (message « Le statut du thème ne permet pas l'annulation ! », Q-192 (19)), « Voir les dossiers » (filtre pour=DEROULANT), clic de position, panneau BC masqué sans droit, tags « n train(s) identique(s) » et machine, filtre Statut multi-valeurs, rejets nommés RG-COO-227 / 201, docs. COO-P10 : migration ALTER/CREATE `export_trains`, `tf_train_export`, `generation_fichiers`, `instruction_train.exporte_*` ; API export-trains.ts (aperçu, export, simulation, historique, export préparation, Au roulage, thème retiré de l'export, rouleurs), suivi-theme.ts (besoin, pré-assemblage), generation-fichiers.ts (ECR-GEN-01 / 03, port MachinePort simulé), export-csv.ts (mise en forme du legacy, simulée) ; web : modale d'export, vues Suivi par thème et Préparation, rouleur, /coordination/generateur. Tests d'intégration : +94 (export-trains 60, suivi-generation 34) +6 (réserves P09) ; E2E +4 ; aucun nouveau test unitaire (consigne). Hypothèses Q-193. | Reste COO-P10 : Bagues (COO-P11), format .ini et dépôt (D-15), Paris (Q-255), atelier 5 / 6 au référentiel (Q-319). Audit spec-auditor : à lancer. | spec-auditor COO-P10 puis /etape-06-coordination COO-P11 |
| 2026-11-05 | COO-P10 audit NON CONFORME → corrections | Audit COO-P10 : B1 le fichier d'export est marqué SIMULÉ partout (nom `_SIMULE`, `fichierSimule` du résultat, de l'historique et du lot, avertissement dans la modale et le message, journal du lot ; « simulation d'export » fonctionnelle distincte du « fichier simulé » D-15) ; B2 « Envoyer à la machine » ne modifie plus aucune face (le rouleur est obligatoire à « Au roulage », RG-COO-217 ; l'effet d'unité « En production » relève de RG-COO-299 / COO-P11 et de Q-265) : question Q-194 OUVERTE, hypothèse Q-193 (11) remplacée ; B3 versions des trains stockées au « Préparer » et revérifiées à l'envoi (409 COO_TRAIN_MODIFIE / COO_TRAIN_NON_PRET). Mineurs : m1 écart « Entretien » documenté, m2 générateur (compteur n / 20, pastille, bouton désactivé, « Cochez les trains… », Nb trains, recherche côté API), m3 confirmations avant « Annuler thème » et « Débloquer semaine », m4 « visuel » = face (documenté), m5 machine tracée (adaptateur simulé), m6 historiques lus par paquets, m7 « Section » = DestNomOri (CentreCommercial et Statut documentés), m8 règles citées sur les 403, m9 export préparation sur une semaine. Migration ALTER `20261105280000_ajoute_marquage_simule_versions_lot`. Tests : intégration 2586 (2584 OK, 1 échec attendu Q-179, 1 todo RG-COO-204), unitaires 287 inchangés, E2E 62. | COO-P10 PARTIEL (2e audit à faire) : fichiers réels D-15, Bagues et unités COO-P11, Paris Q-255, effet de l'envoi Q-194 | 2e passe du spec-auditor sur COO-P10 |
| 2026-11-05 | COO-P10 audit 2e passe CONFORME avec réserve B4 + corrections | Réserve B4 : depuis que l'envoi à la machine ne modifie plus les faces (Q-194), un train envoyé restait « Prêt » et pouvait être renvoyé : `DEJA_ENVOYE` est calculé aussi à partir des lots ENVOYE (même version de train) ; préparer et envoyer un train déjà envoyé : 409 `COO_TRAIN_DEJA_ENVOYE` ; un train modifié depuis peut repartir ; commentaire de `generateur.tsx` renvoyé à Q-194. Tests d'intégration : `generation-deja-envoye.int.test.ts` (5). | « Générer un complément » (ECR-GEN-03) non repris | /etape-06-coordination COO-P11 |
| 2026-11-05 | /etape-06-coordination COO-P11 | Suivi 8 m² (RG-COO-237 : saisie en ligne des demies et des 8 m² finales, reste à faire, journal), dispatch du roulage (RG-COO-291 à 296 : trains PRET / EN_PROD, charge par rouleur, affectation immédiate, « Proposer une répartition » SIMULÉE, « Tout désaffecter », alertes 36 h / 115 % paramétrées, liste de picking), référentiel des rouleurs avec poste (RG-COO-297), bagues (RG-COO-298 à 302 : liste, aperçu, impression avec rouleur obligatoire et passage des faces « Au roulage », textes modifiés, réimpression avec motif ; colonne Bague et fiche du train). Migration ALTER / CREATE `20261105300000_ajoute_roulage_bagues_suivi8m2` (poste du rouleur, tables `bague` et `suivi_8m2`). Écrans `/coordination/dispatch`, `/coordination/bagues`, `/coordination/rouleurs`, vue « Suivi 8 m² » de la liste des trains. Troisième serveur web E2E (e2e.chef, rôle cheq). Q-195 (14 points) en HYPOTHÈSE PRISE ; ANO-049 (limite de paramètres de SQLite pour un administrateur) corrigée par la lecture par paquets. Tests (consigne « intégration seulement ») : intégration 2743 (2741 OK, 1 échec attendu Q-179, 1 todo RG-COO-204), unitaires 287 inchangés, E2E 66. | COO-P11 PARTIEL : test-engineer et spec-auditor à lancer ; moteur de répartition cible Q-276, impression physique Q-002 / Q-287, unités UM et lot Q-265, poste / machine D-02, tableau de roulage Q-278 | test-engineer puis spec-auditor sur COO-P11 |
| 2026-11-05 | COO-P11 : anomalies du test-engineer + /etape-06-coordination COO-P12 | COO-P11 : ANO-050 / 051 (500 « query parameter limit » au-delà de 1 000 dossiers distincts) corrigées par la lecture par paquets de tous les `IN` non bornés (`core/paquets.ts`) ; saisie du suivi 8 m² sans plafond fonctionnel (Q-195 (10)) ; B4 : la garde « déjà envoyé » repose sur la version du train (risque tracé Q-196 (12), Q-194). COO-P12 : écran unitaire `/coordination/unitaire` (fixe, pliage, bus) : liste des unités avec entretien à l'afficheur (RG-COO-238, 245, 248, 290), quantité (RG-COO-239), corriger l'intitulé (RG-COO-244, RG-X-082), rendre la main (RG-COO-243, RG-X-081), retirer / préparer (RG-COO-249, 250), comptage du pliage (RG-COO-247), fiche de synthèse (RG-COO-246), quantités à encoller (RG-COO-304, 305) ; réalignement de l'entretien de Broadcast dans le flux préparation (RG-COO-124) ; libération de la semaine, statut « à libérer », repère « Arrivé après libération » (RG-COO-240 à 242) BLOQUÉS (Q-265 OUVERTE, aucune route). Migration `20261105320000_ajoute_unitaire` (ALTER / CREATE). Tests : unitaires 287 inchangés ; intégration 2955 (2953 OK + 1 échec attendu Q-179 + 1 todo RG-COO-204) ; E2E 73. | COO-P12 PARTIEL : Q-196 (13 points) à valider ; Q-265 BLOQUANTE OUVERTE ; Q-375, Q-279, Q-287 | audit final P11 à P13 (un seul, décision de l'utilisateur) |
| 2026-11-05 | COO-P12 : anomalies du test-engineer + /etape-06-coordination COO-P13 | COO-P12 : ANO-052 (une UM « Annulé » ne se retire plus : 409) et ANO-053 (le site choisi x-site-id restreint désormais TOUTES les routes de Coordination : `identiteDuSite`, `site-bandeau.int.test.ts`) corrigées ; arrondi du bus : lecture alternative notée en Q-196 (14). COO-P13 : migration `ajoute_colis` (`tf_colis`, `tf_UM_colis`), module colis (création, suppression, réouverture refusée, ajout d'une UM par code barre avec fractionnement et poids, ajout d'un train, retrait, expédition, fin de journée manuelle avec sorties de stock RG-X-087 dans la même transaction, mail tracé non envoyé), garde RG-COO-249 branchée (409 réel), statut effectif de l'UM (RG-COO-280), AMT non repris (RG-COO-272 à 276), écrans ECR-EXP-01 / 02 (`/expedition`, `/expedition/colis`). Tests : intégration 3172 (3170 OK + 1 échec attendu Q-179 + 1 todo) dont 86 nouveaux ; E2E 76 ; unitaires inchangés. Hypothèses : Q-197 (13 points). | PARTIEL : création des UM (RG-COO-260 à 262, Q-265 BLOQUANTE), mail colis (Q-375, Q-285), Geodis / Livré / étiquette / boucle / canal (Q-284), sorties de stock des ateliers déroulants, ECR-EXP-03, fin de journée planifiée (Q-005) ; audit final de COO-P11, COO-P12 et COO-P13 à lancer (décision utilisateur : un seul audit à la fin) | spec-auditor sur COO-P11 à COO-P13, puis /etape-07-interactions |
| 2026-11-05 | COO-P13 : test-engineer, ANO-054 / 055 et audit final COO-P11 / P12 / P13 | Test-engineer COO-P13 : 74 tests d'intégration (`colis-complement.int.test.ts`). ANO-054 corrigée (UM « Annulé » sans sortie de stock) ; ANO-055 corrigée (flux Destinataires : INSERT … SELECT). Audit final unique : COO-P11 CONFORME avec réserves ; COO-P12 et COO-P13 NON CONFORMES uniquement à cause de Q-265 (création des UM, BLOQUANTE, OUVERTE). Corrections : statuts requalifiés (RG-COO-237, 247, 248, 250, 251, 263, 305 PARTIEL ; RG-COO-272 à 276 NON REPRIS, hypothèse Q-274), texte de RG-COO-243, 4 tests d'absence nommés (272, 273, 274, 276), confirmation avant « Fin de journée » (écran Colis), garde RG-COO-249 appelée directement (plus d'effet de bord à l'import), Q-197 (18) (19). Reste : Q-265, Q-005, Q-281, Q-319, Q-375. Prochaine commande : trancher Q-265, puis /etape-07-interactions. |
| 2026-11-05 | /etape-07-interactions (étape 7) | Inventaire des 54 RG-X (fichier:fonction, `ANALYSE_FONCTIONNELLE_COMPLETE.md` §6.5) et matrice d'impact vérifiée (§6.6 : 22 cellules Réception → Coordination, 11 Coordination → Réception, 5 lecture de Broadcast / trains, 9 de concurrence, 7 de rollback). Matrice de traçabilité corrigée : 35 RG-X FAIT, 18 PARTIEL, 1 BLOQUÉE (RG-X-076, Q-265). IMPLÉMENTÉ : RG-X-003 (message « n unité(s) prête(s) à produire », `unites-pretes.ts`, champ `unitesPretes`, Q-400) et RG-X-011 / 010 / 075 (alerte « affiche reçue après l'export des trains », Q-398). Tests : 91 d'intégration (`apps/api/test/interactions/`, Promise.all de vraies requêtes, déclencheurs SQLite de panne) + 5 `it.todo` des cellules non réalisées + 4 E2E (`e2e/interactions.spec.ts`) ; intégration 3339 OK + 1 échec attendu (Q-179) + 6 en attente, E2E 80, unitaires 287 inchangés. Aucun conflit bloquant entre les deux modules (contrôle ∥ validation admin : 200 + 200) ; ANO-056 / 057 corrigées, ANO-058 ouverte. Questions : Q-398 à Q-401. | PARTIEL : RG-X-061 (nouvelle proposition du complément, Q-399), RG-X-076 et 084 (Q-265), RG-X-016 (Q-123), RG-X-022 (Q-151, Q-005), RG-X-077 (Q-282), RG-X-010 / 075 (fenêtre Q-266, mail Q-375) ; audit spec-auditor des RG-X passé : NON CONFORME sans bloquant ; 5 majeurs corrigés (RG-X-085 PARTIEL, C-10 en it.todo, Q-402 pour RG-X-065, étiquettes de tests, commentaires d'ID), rollback A-08 à A-10 ; décompte final 34 FAIT / 19 PARTIEL / 1 BLOQUÉ ; tests : intégration 3341 OK, E2E 80 | /etape-08-dependances (Q-265 d'abord) |
| 2026-11-05 | /etape-08-dependances : D-05 et Q-265 (lot 1) | Sur autorisation de l'utilisateur (« D-05 et tout le reste ; si tu ne trouves pas d'infos, fais le plus recommandé »). D-05 : référentiel des destinataires (liste, recherche, création, édition, désactivation, journal, `referentiel.gerer`), écran `/coordination/destinataires`, 4e serveur web de test e2e.admin. Q-265 (HYPOTHÈSE PRISE, option (c)) : « Libérer la Sxx » (migration `ajoute_liberation_semaine`, table `tf_liberation_semaine`) ne crée aucune UM ; « Colisage » crée les UM (RG-COO-260 à 262 : regroupement, découpage par quantité d'UM du support avec reliquat, code barre, code synthèse, poids, date minimale) ; repères « à libérer » (RG-COO-241) et « arrivé après libération » (RG-COO-242, alerte RG-X-076) dérivés à la lecture ; boutons et bandeau dans l'unitaire. Tests : intégration `liberation-colisage.int.test.ts` (50) et `destinataires.int.test.ts` (26), les tests d'absence et it.todo liés à Q-265 (RG-X-076, RG-X-084 C-10) transformés en vrais tests ; E2E +4 (84). Hypothèses : Q-265 (statut HYPOTHÈSE PRISE), Q-403, Q-404. | RG-COO-240 / 242 / 260 / 261 / RG-X-076 PARTIEL (hypothèse non validée, mails Q-375), équipes / machines / postes / boucles non repris (Q-403), autres dépendances (D-01, D-02, D-03, D-04, D-06 à D-23) : voir le plan des lots suivants | Valider Q-265 / Q-404 / Q-403 ; puis `/etape-08-dependances` lot 2 (voir rapport) |
| 2026-11-06 | /etape-08-dependances : D-06, D-02, D-01 (lot 2) | Même autorisation que le lot 1 (option recommandée si source manquante). D-06 : écran `/admin/parametres` (ECR-ADM-05), API `GET /api/admin/parametres`, `PUT /api/admin/parametres/:cle`, `GET …/historique`, registre de 44 paramètres (`packages/shared/src/admin.ts`, tous ceux du seed) dont 26 modifiables validés par format, 18 structurés en lecture seule, verrou de version, journal, historique. D-02 : écran `/admin/sites` en lecture seule (ECR-ADM-01). D-01 : écran `/admin/utilisateurs`, API `GET/POST/PATCH /api/admin/utilisateurs`, nouveau droit `utilisateur.gerer` (administrateur), rôles et périmètre remplacés avec effet immédiat, désactivation, auto-modification interdite (409), idempotence, journal ; nouvelles valeurs d'énumération (aucune migration SQL). Preuve des règles à paramètre vide par défaut : RG-COO-237 (suivi 8 m²) et RG-COO-263 (+3 kg) s'activent par la saisie du paramètre via l'API d'administration. Tests : intégration `apps/api/test/admin/` (106 : parametres 45, utilisateurs 51, sites 8, règles à paramètres 2) ; E2E +5 (`admin-parametres.spec.ts`) ; `modele-donnees.int.test.ts` aligné (56 permissions) et rouleur sans atelier purgé (fuite latente révélée par l'ordre des fichiers). Hypothèses : Q-405, Q-406. | RG-COO-237 → FAIT (sous hypothèses Q-195 / Q-264, configuration saisie par l'administrateur) ; RG-COO-247, 248, 263, 305 restent PARTIEL (autres motifs : Q-196, Q-271, Q-279) ; valeurs structurées, droits individuels, annuaire, formats / machines non repris (ECARTS) ; autres dépendances (D-03, D-04, D-07 à D-23) : lots suivants | Valider Q-405 / Q-406 ; puis `/etape-08-dependances` lot 3 (voir rapport) |
| 2026-11-06 | /etape-08-dependances : D-04, D-03, D-08 (lot 3) | Même autorisation que les lots précédents (option recommandée si source manquante). D-04 : écran `/admin/referentiels` (ECR-ADM-07 : imprimeurs, livreurs, agents de réception), réutilise l'API REC-P10 `/api/referentiels/:ref` et ajoute `GET /api/admin/referentiels/agents`. D-03 : écran `/admin/plateformes` (coordonnées, mail de déblocage, id site CCF, mails de réception, imprimantes cibles), API `/api/admin/plateformes…`, migration CREATE `20261106100000_ajoute_plateformes_alertes` (tables `tr_adresseMail_plateforme`, `tr_atelier_imprimante`, `regle_alerte`), nouvelles valeurs d'énumération du journal. D-08 : écran `/admin/alertes` (ECR-ADM-04), API `GET /api/admin/alertes/regles` et `PUT /api/admin/alertes/regles/:type` (18 types, canal et destinataires), appliquée dans Pilotage › Alertes (RG-REC-190). ErrorMessage affiche désormais les messages de champs d'un 400. Tests : intégration `apps/api/test/admin/` (referentiels-reception, plateformes, regles-alerte) ; E2E `admin-lot3.spec.ts` (3). Hypothèses : Q-407, Q-408. | RG-REC-179 / EX-ADM-501 → FAIT ; RG-REC-190 BLOQUÉ → PARTIEL ; EX-ADM-504 reste PARTIEL ; listes de distribution, gravité configurable, mails (Q-375), envoi / impression (Q-002), lecture de `id_site_ccf` par le mail de déblocage, reprise des valeurs existantes (D-23) non repris (ECARTS) | Valider Q-407 / Q-408 ; lots suivants (D-07, D-09 à D-23) |
| 2026-11-06 | /etape-08-dependances : D-19, D-20 (lot 4) | Même autorisation (option recommandée si source manquante). D-19 : `core/ports/mail.ts` (`MailPort`, boîte d'envoi simulée, SMTP minimal non activé, « non configuré » en production), `modules/mails/{file,admin}.ts`, table `mail_file`, 4 mails mis en file dans la transaction du fait (colis expédié RG-COO-271, déblocage RG-COO-147, correction Broadcast RG-COO-057, correction d'intitulé RG-COO-244), API `GET /api/admin/file-envoi`, `POST …/traiter`, `POST …/:id/relancer`. D-20 : `modules/taches/service.ts`, table `tache_execution` (verrou UNIQUE, journal), 4 tâches, ordonnanceur, commande `taches:executer`, API `GET /api/admin/taches`, `…/executions`, `POST …/:tache/executer`, 4 paramètres d'horaires (format `horaires`, groupe « Planification », vides = désactivé) dans D-06. Migration CREATE `20261106110000_ajoute_mails_taches`. Tests : `apps/api/test/admin/mails.int.test.ts` (27), `taches.int.test.ts` (19), compléments dans deblocage / colis / unitaire-complement ; aucun test unitaire, aucun écran (pas d'E2E). Hypothèses : Q-409, Q-410. | EX-TRA-030 PARTIEL (mails branchés, envoi réel non activé) ; RG-REC-180 BLOQUÉ → PARTIEL (planifiable) ; RG-COO-269 / 271 / 147 / 057 PARTIEL maintenus ; RG-COO-042 FAIT | Valider Q-409 / Q-410 ; horaires et fournisseur SMTP (Q-005, Q-375) ; lots suivants (D-07, D-09 à D-18, D-21 à D-23) |
| 2026-11-06 | /etape-08-dependances : D-14, D-15, D-18 (lot 5) | Même autorisation (option recommandée si source manquante, Q-411). D-14 : API `GET /api/coordination/colis/departs` (`departs-camions.ts`) et écran `/expedition/departs` (ECR-EXP-03), colonnes Clos le / Expédié le / Récépissé, tri par statut (ECR-EXP-02) ; D-15 : migration ALTER `20261106120000_ajoute_complement_generation` (`generation_fichiers.complement_de_id`), `POST /api/coordination/generateur/complement`, `GET /api/coordination/generateur/:id/picking`, historique enrichi, envoi d'un complément accepte les trains en production ; D-18 : zone d'impression et modèle `Edition` (correction de la page blanche). Tests : intégration +24 (`expedition-departs-complement.int.test.ts`), E2E +1 (Départs camions) et assertions d'impression ajoutées à la fiche de synthèse ; aucun nouveau test unitaire. | Q-194 OUVERTE (effet de l'envoi), Q-284 / D-17 (Geodis, Livré), Q-403 (boucles, horaires de départ) | spec-auditor sur le lot 5 puis /cloture-session |
| 2026-11-06 | Corrections de l'audit de l'étape 8 (lots D-01 à D-20) | Même autorisation (option recommandée). M1 compte technique `circe-automatique` verrouillé (Q-412) ; M2 SMTP : pas d'identifiants en clair (Q-413) ; M3 contact destinataire édité non écrasé par le flux Broadcast (Q-414, migration ALTER `20261106130000_ajoute_contact_modifie`) ; M4 Q-265 / Q-404 complétées (contradiction ECR-COO-09a, points à valider) ; m1 dernier administrateur recompté en transaction ; m3 / m4 / m7 / m8 consignés dans ECARTS ; m9 statuts de matrice corrigés ; m5 / m6 mentions « non consommé en production ». Tests : intégration 3 701 OK, 1 échec attendu (Q-179), 6 todo ; unitaires 287 ; E2E 93. | Restes : STARTTLS (Q-413), réalignement Broadcast (Q-414), validations utilisateur de Q-265 / Q-404 / Q-411 | Étape 9 |
| 2026-11-06 | /etape-09-tests-massifs | Générateurs déterministes (`apps/api/test/jdd/`, PRNG maison Q-415, 12 familles de la skill + `aleatoire`), CLI `pnpm jdd --seed --volume`, base de test seule, repère et purge ; 29 invariants (`test/massif/invariants.ts`) ; tests `test/massif/{jdd-massif,performance,non-regression}.int.test.ts` ; exécutions seeds 11 / 222 / 333 (106 635 / 203 795 / 300 301 enregistrements, 0 échec). Anomalies : ANO-061 stock négatif par écart de contrôle (Q-417, 422 `REC_STOCK_NEGATIF`), ANO-062 lenteur de `/coordination/dossiers` et `/themes/proches` à 6 000 dossiers (4,4 s et 4,0 s, puis 0,5 s et 0,3 s) ; ouvertes : ANO-063 (Q-418), ANO-064 (Q-416). Questions Q-415 à Q-418. Couverture de code non mesurable. Voir `RAPPORT_TESTS.md` §3 à §7. |
| 2026-11-06 | Coque ECR-NAV-01 / EX-TRA-008 (retour utilisateur : « maquette non respectée », Administration refusée) | Coque dans `apps/web/src/components/shell/` : bandeau 1 (logo, site, profil de DEV, cloche + badge, état de l'API), bandeau 2 (9 onglets déroulants Radix Popover, entrées limitées aux écrans existants, grisées sans droit), `/` redirigé vers la première page accessible (Q-365). Site mémorisé en sessionStorage et envoyé en `x-site-id` par tout le client API ; `GET /api/me/sites` ajouté ; relais web : cookie `circe_dev_user` (dev.<rôle> valide, hors production). Q-420 (HYPOTHÈSE PRISE), ECART-116 à 119, matrice ECR-NAV-01 PARTIEL. Tests : `e2e/navigation.spec.ts` (9) + `apps/api/test/me-sites.int.test.ts` (3), aucun test unitaire. |

## 6. Index RG → parcours
Généré par script depuis les sections 2 et 3 : parcours principal en premier, autres parcours séparés par « , ». Étape : 5 = Réception, 6 = Coordination, 7 = interactions ; « 5 + 7 » / « 6 + 7 » = RG-X rattachée à un parcours et à l'étape 7 ; « — » en parcours = portée uniquement par l'étape 7.

| ID RG | Parcours | Étape |
|---|---|---|
| RG-COO-001 | COO-P01 | 6 |
| RG-COO-002 | COO-P03 | 6 |
| RG-COO-003 | COO-P03 | 6 |
| RG-COO-004 | COO-P03 | 6 |
| RG-COO-005 | COO-P03 | 6 |
| RG-COO-006 | COO-P03 | 6 |
| RG-COO-007 | COO-P03 | 6 |
| RG-COO-008 | COO-P04 | 6 |
| RG-COO-009 | COO-P04 | 6 |
| RG-COO-010 | COO-P04 | 6 |
| RG-COO-011 | COO-P03 | 6 |
| RG-COO-012 | COO-P03 | 6 |
| RG-COO-013 | COO-P03 | 6 |
| RG-COO-014 | COO-P04 | 6 |
| RG-COO-015 | COO-P04 | 6 |
| RG-COO-016 | COO-P03 | 6 |
| RG-COO-017 | REC-P07, COO-P03, COO-P04 | 5 |
| RG-COO-018 | REC-P07, COO-P03, COO-P04 | 5 |
| RG-COO-019 | COO-P03 | 6 |
| RG-COO-020 | COO-P03 | 6 |
| RG-COO-021 | COO-P04 | 6 |
| RG-COO-022 | COO-P04 | 6 |
| RG-COO-023 | COO-P04 | 6 |
| RG-COO-024 | COO-P04 | 6 |
| RG-COO-025 | COO-P04 | 6 |
| RG-COO-026 | COO-P04 | 6 |
| RG-COO-027 | COO-P04 | 6 |
| RG-COO-028 | COO-P04 | 6 |
| RG-COO-029 | COO-P04 | 6 |
| RG-COO-030 | COO-P04 | 6 |
| RG-COO-031 | COO-P04 | 6 |
| RG-COO-032 | COO-P04 | 6 |
| RG-COO-033 | COO-P07 | 6 |
| RG-COO-040 | COO-P01 | 6 |
| RG-COO-041 | COO-P01 | 6 |
| RG-COO-042 | COO-P02 | 6 |
| RG-COO-043 | COO-P02 | 6 |
| RG-COO-044 | COO-P02 | 6 |
| RG-COO-045 | COO-P01 | 6 |
| RG-COO-046 | COO-P01 | 6 |
| RG-COO-047 | COO-P02 | 6 |
| RG-COO-048 | COO-P02 | 6 |
| RG-COO-049 | COO-P02 | 6 |
| RG-COO-050 | COO-P02 | 6 |
| RG-COO-051 | COO-P02 | 6 |
| RG-COO-052 | COO-P02 | 6 |
| RG-COO-053 | COO-P02 | 6 |
| RG-COO-054 | COO-P02 | 6 |
| RG-COO-055 | COO-P02 | 6 |
| RG-COO-056 | COO-P02 | 6 |
| RG-COO-057 | COO-P02 | 6 |
| RG-COO-058 | COO-P02 | 6 |
| RG-COO-059 | COO-P02 | 6 |
| RG-COO-060 | COO-P02 | 6 |
| RG-COO-061 | COO-P01 | 6 |
| RG-COO-062 | COO-P01 | 6 |
| RG-COO-063 | COO-P01 | 6 |
| RG-COO-064 | COO-P04 | 6 |
| RG-COO-066 | COO-P07 | 6 |
| RG-COO-067 | COO-P07 | 6 |
| RG-COO-068 | COO-P07 | 6 |
| RG-COO-069 | COO-P07 | 6 |
| RG-COO-070 | COO-P07 | 6 |
| RG-COO-071 | COO-P07 | 6 |
| RG-COO-072 | COO-P07 | 6 |
| RG-COO-073 | COO-P07 | 6 |
| RG-COO-074 | COO-P07 | 6 |
| RG-COO-075 | COO-P07 | 6 |
| RG-COO-076 | COO-P07 | 6 |
| RG-COO-080 | COO-P05 | 6 |
| RG-COO-081 | COO-P05 | 6 |
| RG-COO-082 | COO-P05 | 6 |
| RG-COO-083 | COO-P05 | 6 |
| RG-COO-084 | COO-P05 | 6 |
| RG-COO-085 | COO-P05 | 6 |
| RG-COO-086 | COO-P05 | 6 |
| RG-COO-087 | COO-P05 | 6 |
| RG-COO-088 | COO-P05 | 6 |
| RG-COO-089 | COO-P05 | 6 |
| RG-COO-090 | COO-P05 | 6 |
| RG-COO-091 | COO-P06 | 6 |
| RG-COO-092 | COO-P06 | 6 |
| RG-COO-093 | COO-P06 | 6 |
| RG-COO-094 | COO-P05 | 6 |
| RG-COO-095 | COO-P05 | 6 |
| RG-COO-096 | COO-P05 | 6 |
| RG-COO-097 | COO-P05 | 6 |
| RG-COO-098 | COO-P05 | 6 |
| RG-COO-099 | COO-P05 | 6 |
| RG-COO-100 | COO-P05 | 6 |
| RG-COO-101 | COO-P05 | 6 |
| RG-COO-102 | COO-P06 | 6 |
| RG-COO-103 | COO-P06 | 6 |
| RG-COO-104 | COO-P06 | 6 |
| RG-COO-105 | COO-P05 | 6 |
| RG-COO-106 | COO-P05 | 6 |
| RG-COO-107 | COO-P05 | 6 |
| RG-COO-108 | COO-P05 | 6 |
| RG-COO-109 | COO-P06 | 6 |
| RG-COO-115 | COO-P06 | 6 |
| RG-COO-116 | COO-P06 | 6 |
| RG-COO-117 | COO-P06 | 6 |
| RG-COO-118 | COO-P06 | 6 |
| RG-COO-119 | COO-P06 | 6 |
| RG-COO-120 | COO-P06 | 6 |
| RG-COO-121 | COO-P06 | 6 |
| RG-COO-122 | COO-P06 | 6 |
| RG-COO-123 | COO-P06 | 6 |
| RG-COO-124 | COO-P12 | 6 |
| RG-COO-125 | COO-P06 | 6 |
| RG-COO-126 | COO-P06 | 6 |
| RG-COO-127 | COO-P06 | 6 |
| RG-COO-128 | COO-P06 | 6 |
| RG-COO-129 | COO-P06 | 6 |
| RG-COO-130 | COO-P06 | 6 |
| RG-COO-131 | COO-P06 | 6 |
| RG-COO-132 | COO-P06 | 6 |
| RG-COO-133 | COO-P02 | 6 |
| RG-COO-134 | COO-P06 | 6 |
| RG-COO-140 | COO-P08 | 6 |
| RG-COO-141 | COO-P08 | 6 |
| RG-COO-142 | COO-P08 | 6 |
| RG-COO-143 | COO-P08 | 6 |
| RG-COO-144 | COO-P08 | 6 |
| RG-COO-145 | COO-P08 | 6 |
| RG-COO-146 | COO-P08 | 6 |
| RG-COO-147 | COO-P08 | 6 |
| RG-COO-148 | COO-P08 | 6 |
| RG-COO-149 | COO-P08 | 6 |
| RG-COO-150 | COO-P08 | 6 |
| RG-COO-151 | COO-P08 | 6 |
| RG-COO-152 | COO-P08 | 6 |
| RG-COO-160 | COO-P01 | 6 |
| RG-COO-165 | COO-P01 | 6 |
| RG-COO-166 | COO-P01 | 6 |
| RG-COO-167 | COO-P01 | 6 |
| RG-COO-168 | COO-P01 | 6 |
| RG-COO-169 | COO-P01 | 6 |
| RG-COO-200 | COO-P09 | 6 |
| RG-COO-201 | COO-P09 | 6 |
| RG-COO-202 | COO-P09 | 6 |
| RG-COO-203 | COO-P09 | 6 |
| RG-COO-204 | COO-P02, COO-P09 | 6 |
| RG-COO-205 | COO-P09 | 6 |
| RG-COO-206 | COO-P09 | 6 |
| RG-COO-207 | COO-P09 | 6 |
| RG-COO-208 | COO-P09 | 6 |
| RG-COO-209 | COO-P09 | 6 |
| RG-COO-210 | COO-P10 | 6 |
| RG-COO-211 | COO-P10 | 6 |
| RG-COO-212 | COO-P10 | 6 |
| RG-COO-213 | COO-P10 | 6 |
| RG-COO-214 | COO-P10 | 6 |
| RG-COO-215 | COO-P10 | 6 |
| RG-COO-216 | COO-P10 | 6 |
| RG-COO-217 | COO-P10 | 6 |
| RG-COO-218 | COO-P09 | 6 |
| RG-COO-219 | COO-P09 | 6 |
| RG-COO-220 | COO-P09 | 6 |
| RG-COO-221 | COO-P09 | 6 |
| RG-COO-222 | COO-P09 | 6 |
| RG-COO-223 | COO-P09 | 6 |
| RG-COO-224 | COO-P09 | 6 |
| RG-COO-225 | COO-P09 | 6 |
| RG-COO-226 | COO-P09 | 6 |
| RG-COO-227 | COO-P09 | 6 |
| RG-COO-228 | COO-P09 | 6 |
| RG-COO-229 | COO-P09 | 6 |
| RG-COO-230 | COO-P10 | 6 |
| RG-COO-231 | COO-P10 | 6 |
| RG-COO-232 | COO-P10 | 6 |
| RG-COO-233 | COO-P10 | 6 |
| RG-COO-234 | COO-P11 | 6 |
| RG-COO-235 | COO-P10 | 6 |
| RG-COO-236 | COO-P10 | 6 |
| RG-COO-237 | COO-P11 | 6 |
| RG-COO-238 | COO-P12 | 6 |
| RG-COO-239 | COO-P12 | 6 |
| RG-COO-240 | COO-P12 | 6 |
| RG-COO-241 | COO-P12 | 6 |
| RG-COO-242 | COO-P12 | 6 |
| RG-COO-243 | COO-P12 | 6 |
| RG-COO-244 | COO-P12 | 6 |
| RG-COO-245 | COO-P12 | 6 |
| RG-COO-246 | COO-P12 | 6 |
| RG-COO-247 | COO-P12 | 6 |
| RG-COO-248 | COO-P12 | 6 |
| RG-COO-249 | COO-P12 | 6 |
| RG-COO-250 | COO-P12 | 6 |
| RG-COO-251 | COO-P12 | 6 |
| RG-COO-260 | COO-P13 | 6 |
| RG-COO-261 | COO-P13 | 6 |
| RG-COO-262 | COO-P13 | 6 |
| RG-COO-263 | COO-P13 | 6 |
| RG-COO-264 | COO-P13 | 6 |
| RG-COO-265 | COO-P13 | 6 |
| RG-COO-266 | COO-P13 | 6 |
| RG-COO-267 | COO-P13 | 6 |
| RG-COO-268 | COO-P13 | 6 |
| RG-COO-269 | COO-P13 | 6 |
| RG-COO-270 | COO-P13 | 6 |
| RG-COO-271 | COO-P13 | 6 |
| RG-COO-272 | COO-P13 | 6 |
| RG-COO-273 | COO-P13 | 6 |
| RG-COO-274 | COO-P13 | 6 |
| RG-COO-275 | COO-P13 | 6 |
| RG-COO-276 | COO-P13 | 6 |
| RG-COO-277 | COO-P08 | 6 |
| RG-COO-278 | COO-P08 | 6 |
| RG-COO-279 | COO-P08 | 6 |
| RG-COO-280 | COO-P13 | 6 |
| RG-COO-290 | COO-P12 | 6 |
| RG-COO-291 | COO-P11 | 6 |
| RG-COO-292 | COO-P11 | 6 |
| RG-COO-293 | COO-P11 | 6 |
| RG-COO-294 | COO-P11 | 6 |
| RG-COO-295 | COO-P11 | 6 |
| RG-COO-296 | COO-P11 | 6 |
| RG-COO-297 | COO-P11 | 6 |
| RG-COO-298 | COO-P11 | 6 |
| RG-COO-299 | COO-P11 | 6 |
| RG-COO-300 | COO-P11 | 6 |
| RG-COO-301 | COO-P11 | 6 |
| RG-COO-302 | COO-P11 | 6 |
| RG-COO-303 | COO-P11 | 6 |
| RG-COO-304 | COO-P12 | 6 |
| RG-COO-305 | COO-P12 | 6 |
| RG-COO-306 | COO-P12 | 6 |
| RG-COO-307 | COO-P09 | 6 |
| RG-COO-308 | COO-P09 | 6 |
| RG-REC-001 | REC-P01 | 5 |
| RG-REC-002 | REC-P01 | 5 |
| RG-REC-003 | REC-P01 | 5 |
| RG-REC-004 | REC-P01 | 5 |
| RG-REC-005 | REC-P01 | 5 |
| RG-REC-006 | REC-P01 | 5 |
| RG-REC-007 | REC-P01 | 5 |
| RG-REC-008 | REC-P01 | 5 |
| RG-REC-009 | REC-P01 | 5 |
| RG-REC-010 | REC-P02 | 5 |
| RG-REC-011 | REC-P02 | 5 |
| RG-REC-012 | REC-P02 | 5 |
| RG-REC-013 | REC-P02 | 5 |
| RG-REC-014 | REC-P02 | 5 |
| RG-REC-015 | REC-P02 | 5 |
| RG-REC-016 | REC-P02 | 5 |
| RG-REC-017 | REC-P02 | 5 |
| RG-REC-018 | REC-P02 | 5 |
| RG-REC-019 | REC-P02 | 5 |
| RG-REC-020 | REC-P02 | 5 |
| RG-REC-021 | REC-P03 | 5 |
| RG-REC-022 | REC-P03 | 5 |
| RG-REC-023 | REC-P03 | 5 |
| RG-REC-024 | REC-P03 | 5 |
| RG-REC-025 | REC-P03 | 5 |
| RG-REC-026 | REC-P03 | 5 |
| RG-REC-027 | REC-P03 | 5 |
| RG-REC-028 | REC-P03 | 5 |
| RG-REC-029 | REC-P03 | 5 |
| RG-REC-030 | REC-P03 | 5 |
| RG-REC-031 | REC-P03 | 5 |
| RG-REC-032 | REC-P03 | 5 |
| RG-REC-033 | REC-P03 | 5 |
| RG-REC-034 | REC-P03 | 5 |
| RG-REC-035 | REC-P03 | 5 |
| RG-REC-036 | REC-P03 | 5 |
| RG-REC-037 | REC-P04 | 5 |
| RG-REC-038 | REC-P04 | 5 |
| RG-REC-039 | REC-P04 | 5 |
| RG-REC-040 | REC-P04 | 5 |
| RG-REC-041 | REC-P04 | 5 |
| RG-REC-042 | REC-P02 | 5 |
| RG-REC-043 | REC-P01 | 5 |
| RG-REC-044 | REC-P04 | 5 |
| RG-REC-045 | REC-P04 | 5 |
| RG-REC-046 | REC-P04 | 5 |
| RG-REC-047 | REC-P04 | 5 |
| RG-REC-048 | REC-P04 | 5 |
| RG-REC-049 | REC-P01 | 5 |
| RG-REC-050 | REC-P04 | 5 |
| RG-REC-051 | REC-P04 | 5 |
| RG-REC-052 | REC-P02 | 5 |
| RG-REC-053 | REC-P05 | 5 |
| RG-REC-054 | REC-P05 | 5 |
| RG-REC-055 | REC-P05 | 5 |
| RG-REC-056 | REC-P05 | 5 |
| RG-REC-057 | REC-P05 | 5 |
| RG-REC-058 | REC-P05 | 5 |
| RG-REC-059 | REC-P05 | 5 |
| RG-REC-060 | REC-P05 | 5 |
| RG-REC-061 | REC-P05 | 5 |
| RG-REC-062 | REC-P05 | 5 |
| RG-REC-063 | REC-P05 | 5 |
| RG-REC-064 | REC-P05 | 5 |
| RG-REC-065 | REC-P05 | 5 |
| RG-REC-066 | REC-P05 | 5 |
| RG-REC-067 | REC-P05 | 5 |
| RG-REC-068 | REC-P05 | 5 |
| RG-REC-069 | REC-P05 | 5 |
| RG-REC-070 | REC-P05 | 5 |
| RG-REC-071 | REC-P05 | 5 |
| RG-REC-072 | REC-P05 | 5 |
| RG-REC-073 | REC-P05 | 5 |
| RG-REC-074 | REC-P01 | 5 |
| RG-REC-076 | REC-P06 | 5 |
| RG-REC-077 | REC-P06 | 5 |
| RG-REC-078 | REC-P06 | 5 |
| RG-REC-079 | REC-P06 | 5 |
| RG-REC-080 | REC-P06 | 5 |
| RG-REC-081 | REC-P06 | 5 |
| RG-REC-082 | REC-P06 | 5 |
| RG-REC-083 | REC-P06 | 5 |
| RG-REC-084 | REC-P06 | 5 |
| RG-REC-085 | REC-P06 | 5 |
| RG-REC-086 | REC-P06 | 5 |
| RG-REC-087 | REC-P06 | 5 |
| RG-REC-088 | REC-P06 | 5 |
| RG-REC-089 | REC-P06 | 5 |
| RG-REC-090 | REC-P06 | 5 |
| RG-REC-091 | REC-P06 | 5 |
| RG-REC-092 | REC-P06 | 5 |
| RG-REC-093 | REC-P06 | 5 |
| RG-REC-095 | REC-P07 | 5 |
| RG-REC-096 | REC-P07 | 5 |
| RG-REC-097 | REC-P07 | 5 |
| RG-REC-098 | REC-P07 | 5 |
| RG-REC-099 | REC-P07 | 5 |
| RG-REC-100 | REC-P07 | 5 |
| RG-REC-101 | REC-P07 | 5 |
| RG-REC-102 | REC-P07 | 5 |
| RG-REC-103 | REC-P07 | 5 |
| RG-REC-104 | REC-P07 | 5 |
| RG-REC-105 | REC-P07 | 5 |
| RG-REC-106 | REC-P07 | 5 |
| RG-REC-107 | REC-P07 | 5 |
| RG-REC-108 | REC-P07 | 5 |
| RG-REC-109 | REC-P07 | 5 |
| RG-REC-110 | REC-P07 | 5 |
| RG-REC-111 | REC-P07 | 5 |
| RG-REC-112 | REC-P07 | 5 |
| RG-REC-113 | REC-P07 | 5 |
| RG-REC-114 | REC-P07 | 5 |
| RG-REC-115 | REC-P07 | 5 |
| RG-REC-116 | REC-P07 | 5 |
| RG-REC-117 | REC-P07 | 5 |
| RG-REC-118 | REC-P07 | 5 |
| RG-REC-119 | REC-P07 | 5 |
| RG-REC-120 | REC-P07 | 5 |
| RG-REC-121 | REC-P08 | 5 |
| RG-REC-122 | REC-P08 | 5 |
| RG-REC-123 | REC-P08 | 5 |
| RG-REC-124 | REC-P09 | 5 |
| RG-REC-125 | REC-P08 | 5 |
| RG-REC-126 | REC-P08 | 5 |
| RG-REC-127 | REC-P08 | 5 |
| RG-REC-128 | REC-P08 | 5 |
| RG-REC-129 | REC-P06 | 5 |
| RG-REC-130 | REC-P08 | 5 |
| RG-REC-131 | REC-P08 | 5 |
| RG-REC-132 | REC-P08 | 5 |
| RG-REC-134 | REC-P08 | 5 |
| RG-REC-135 | REC-P08 | 5 |
| RG-REC-136 | REC-P08 | 5 |
| RG-REC-137 | REC-P08 | 5 |
| RG-REC-138 | REC-P08 | 5 |
| RG-REC-139 | REC-P08 | 5 |
| RG-REC-140 | REC-P08 | 5 |
| RG-REC-141 | REC-P08 | 5 |
| RG-REC-142 | REC-P08 | 5 |
| RG-REC-143 | REC-P08 | 5 |
| RG-REC-144 | REC-P08 | 5 |
| RG-REC-145 | REC-P08 | 5 |
| RG-REC-147 | REC-P08 | 5 |
| RG-REC-148 | REC-P08 | 5 |
| RG-REC-150 | REC-P08 | 5 |
| RG-REC-151 | REC-P01 | 5 |
| RG-REC-153 | REC-P01 | 5 |
| RG-REC-154 | REC-P01 | 5 |
| RG-REC-155 | REC-P09 | 5 |
| RG-REC-156 | REC-P09 | 5 |
| RG-REC-157 | REC-P09 | 5 |
| RG-REC-158 | REC-P09 | 5 |
| RG-REC-159 | REC-P08 | 5 |
| RG-REC-160 | REC-P09 | 5 |
| RG-REC-163 | REC-P09 | 5 |
| RG-REC-165 | REC-P09 | 5 |
| RG-REC-166 | REC-P09 | 5 |
| RG-REC-167 | REC-P09 | 5 |
| RG-REC-168 | REC-P09 | 5 |
| RG-REC-169 | REC-P09 | 5 |
| RG-REC-170 | REC-P09 | 5 |
| RG-REC-171 | REC-P09 | 5 |
| RG-REC-175 | REC-P09 | 5 |
| RG-REC-176 | REC-P01 | 5 |
| RG-REC-178 | REC-P10 | 5 |
| RG-REC-179 | REC-P10 | 5 |
| RG-REC-180 | REC-P02 | 5 |
| RG-REC-181 | REC-P02 | 5 |
| RG-REC-182 | REC-P10 | 5 |
| RG-REC-183 | REC-P05 | 5 |
| RG-REC-184 | REC-P10 | 5 |
| RG-REC-185 | REC-P07 | 5 |
| RG-REC-186 | REC-P07 | 5 |
| RG-REC-187 | REC-P10 | 5 |
| RG-REC-188 | REC-P10 | 5 |
| RG-REC-189 | REC-P05 | 5 |
| RG-REC-190 | REC-P10 | 5 |
| RG-REC-191 | REC-P10 | 5 |
| RG-REC-193 | REC-P05 | 5 |
| RG-REC-194 | REC-P10 | 5 |
| RG-REC-195 | REC-P10 | 5 |
| RG-REC-196 | REC-P10 | 5 |
| RG-REC-197 | REC-P02 | 5 |
| RG-REC-198 | REC-P04 | 5 |
| RG-REC-199 | REC-P10 | 5 |
| RG-REC-200 | REC-P10 | 5 |
| RG-REC-201 | REC-P10 | 5 |
| RG-REC-202 | REC-P10 | 5 |
| RG-REC-203 | REC-P03 | 5 |
| RG-X-001 | COO-P03 | 6 + 7 |
| RG-X-002 | COO-P03 | 6 + 7 |
| RG-X-003 | — | 7 |
| RG-X-004 | — | 7 |
| RG-X-005 | REC-P04 | 5 + 7 |
| RG-X-006 | — | 7 |
| RG-X-007 | REC-P07 | 5 + 7 |
| RG-X-008 | — | 7 |
| RG-X-009 | — | 7 |
| RG-X-010 | — | 7 |
| RG-X-011 | — | 7 |
| RG-X-012 | — | 7 |
| RG-X-013 | REC-P08 | 5 + 7 |
| RG-X-014 | REC-P08, COO-P04 | 5 + 7 |
| RG-X-015 | COO-P04, REC-P08 | 6 + 7 |
| RG-X-016 | REC-P01 | 5 + 7 |
| RG-X-017 | — | 7 |
| RG-X-018 | — | 7 |
| RG-X-019 | — | 7 |
| RG-X-020 | — | 7 |
| RG-X-021 | — | 7 |
| RG-X-022 | — | 7 |
| RG-X-028 | — | 7 |
| RG-X-030 | REC-P07 | 5 + 7 |
| RG-X-050 | COO-P04 | 6 + 7 |
| RG-X-051 | REC-P07, COO-P04 | 5 + 7 |
| RG-X-052 | COO-P04, REC-P08 | 6 + 7 |
| RG-X-053 | COO-P03 | 6 + 7 |
| RG-X-054 | REC-P07 | 5 + 7 |
| RG-X-055 | — | 7 |
| RG-X-056 | — | 7 |
| RG-X-057 | — | 7 |
| RG-X-058 | COO-P04, REC-P08 | 6 + 7 |
| RG-X-059 | — | 7 |
| RG-X-060 | REC-P01 | 5 + 7 |
| RG-X-061 | — | 7 |
| RG-X-062 | REC-P08 | 5 + 7 |
| RG-X-063 | REC-P08 | 5 + 7 |
| RG-X-064 | — | 7 |
| RG-X-065 | — | 7 |
| RG-X-075 | — | 7 |
| RG-X-076 | — | 7 |
| RG-X-077 | — | 7 |
| RG-X-078 | — | 7 |
| RG-X-079 | — | 7 |
| RG-X-080 | — | 7 |
| RG-X-081 | — | 7 |
| RG-X-082 | — | 7 |
| RG-X-083 | — | 7 |
| RG-X-084 | — | 7 |
| RG-X-085 | — | 7 |
| RG-X-086 | — | 7 |
| RG-X-087 | — | 7 |
| RG-X-088 | — | 7 |
| 2026-11-04 | /cloture-session (étape 1b) | Matrice régénérée par script (858 lignes : 333 EX, 473 RG, 52 ECR ; tous À FAIRE ; parcours renseignés depuis §6). Q-100/Q-382 : contradiction signalée ; Q-138 (orpheline) ajoutée ; Q-397 ajoutée (EX-EXI). ECARTS §5 mis à jour. Pas de projet technique : typecheck/lint/test non lancés. Dossier non versionné (pas de dépôt git) : pas de commit. | Validation équipe des 10 BLOQUANTES (Q-001, 002, 004, 005, 204, 265, 300, 306, 307, 319), de Q-003 (profils) et des dépendances §4 ; dédoublonnage des questions ; relecture humaine des règles. | Revue humaine, puis /etape-02-architecture (Q-300/306/307/004/319 à trancher avant /etape-03-modele-donnees) |

### Journal — 17 novembre 2026 : point de sauvegarde maquette du 16/11

Adaptation en cours : réponses NC historisées, préremplissage et impression NC, archives d’alertes sécurisées, vues par face/répartition, colonnes UM, suivis et navigation. Règles ambiguës conservées conformément à la réponse explicite de l’utilisateur. Détail des réalisations, limites et tests : `EVOLUTIONS_MAQUETTE_2026_11_16.md`. Ce point ne clôt pas la conformité complète à la nouvelle maquette. Commit et push demandés par l’utilisateur ; poursuivre ensuite les lignes partielles de la matrice et la recette visuelle. Prochain contrôle : `pnpm typecheck && pnpm lint && pnpm test`, puis les parcours E2E concernés.

Contrôles finaux du point de sauvegarde : TypeScript, lint, tests unitaires et build réussis ; 14 tests API ciblés et 108 E2E réussis. Passage complet d’intégration précédent : 3 732 réussis, 1 échec attendu et 8 à faire.
