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
