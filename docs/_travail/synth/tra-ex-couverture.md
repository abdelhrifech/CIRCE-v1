Couverture des EX hors périmètre direct de REC/COO. Destinataires : « étape 4 (socle) » ; « étape 8 : <dépendance D-xx de tra-dependances.md> » ; « → rec » / « → coo » (repris par les agents RG) ; « UX P1 » (cadre commun d'écrans, étapes 5-6) ; « hors périmètre P1 » ; « existant : sert de référence ». Les EX issus de specs-ateliers-besoins.md sont cités avec +500 (Q-350). Ensembles : EX-TRA-001 à 042 (42) ; EX-EXI §A, §F, §G (16) ; EX-TRA/FIX/SCR/PIL/EXP/STK/THM/ADM/BUS/QUA 501+ (70). Total 128.

| EX | Module / étape destinataire | Détail |
|---|---|---|
| EX-TRA-001 | étape 4 (socle) | Authentification et droits par rôle : socle backend ; mécanisme non spécifié (Q-001) |
| EX-TRA-002 | étape 4 (socle) | Permissions vérifiées côté serveur dans le service, exigence implicite née du constat de l'existant |
| EX-TRA-003 | étape 4 (socle) ; → rec / → coo | Six rôles provisoires (Q-003) ; matrices de permissions écrites par les agents REC/COO |
| EX-TRA-004 | → rec | Rôle Commerce en lecture seule : permission sur les écrans de Réception (Q-355) |
| EX-TRA-005 | → coo ; étape 8 : D-01 | Droit Valider réservé Coordination (COO) ; devenir de `Zone_Picking` et `fusion_affiche` en D-01/D-21 (Q-352, Q-354) |
| EX-TRA-006 | étape 4 (socle) ; UX P1 | Site global et périmètre utilisateur : filtre de tous les écrans (Q-357, Q-358) ; référentiel en D-02 |
| EX-TRA-007 | étape 8 : D-01 | Comptes nominatifs vs génériques de Nîmes : gestion des utilisateurs (Q-359) |
| EX-TRA-008 | UX P1 | Deux bandeaux, pas de menu latéral : coque ECR-NAV-01 |
| EX-TRA-009 | UX P1 | Dix onglets, compteurs, pages secondaires grisées selon le rôle |
| EX-TRA-010 | UX P1 | Pas d'onglets dans les pages (règle de conception) |
| EX-TRA-011 | UX P1 | Plan du site cible : sert à la cartographie (tra-fonc-3-carto.md) |
| EX-TRA-012 | existant : sert de référence | Menu actuel : correspondance cible non explicite pour plusieurs entrées (Q-382) |
| EX-TRA-013 | UX P1 | Bouton Retour et filtres posés par lien (pile de 20) |
| EX-TRA-014 | UX P1 | Barre de filtres commune (ET/OU, compteurs, smart, N° de dossier, Départ, filtres d'en-tête : Q-364) |
| EX-TRA-015 | UX P1 | Tableaux : 8 colonnes, vues, sélection, densité, état vide (Q-361) |
| EX-TRA-016 | UX P1 | Export .xlsx (Q-360) |
| EX-TRA-017 | UX P1 | En-tête de page, boutons, indicateurs, panneau latéral / modale |
| EX-TRA-018 | UX P1 ; étape 4 (socle) | Vocabulaire et 12 statuts uniques ; statuts portés par les machines d'états (Q-381) |
| EX-TRA-019 | UX P1 | Pastille + libellé + gravité, jamais la couleur seule |
| EX-TRA-020 | UX P1 | États vide / chargement / erreur (chargement/erreur non spécifiés : Q-362) |
| EX-TRA-021 | UX P1 | Postes et responsive ; douchette contradictoire (Q-363) |
| EX-TRA-022 | UX P1 | Accessibilité (contraste, focus, cibles) |
| EX-TRA-023 | UX P1 | Charte visuelle proposée comme point de départ (non imposée ; Q-361) |
| EX-TRA-024 | → rec ; étape 8 : D-18 | Feuille de stock / étiquette rack et impression en lot : REC ; composant d'impression en D-18 (Q-002, Q-367) |
| EX-TRA-025 | → coo ; étape 8 : D-18 | Autres éditions : bagues et fiche de synthèse (COO) ; colis, picking, préparation en D-18 |
| EX-TRA-026 | étape 4 (socle) | PDF côté navigateur : composant commun (Q-368) |
| EX-TRA-027 | → rec ; → coo ; étape 8 : D-08 | Écran Alertes ECR-TRA-01 (P1 transverse) ; acquittement (Q-371) |
| EX-TRA-028 | UX P1 | Gravités et correspondance « grave » (Q-372) |
| EX-TRA-029 | étape 8 : D-08 | Alertes configurables (seuil, gravité, destinataires, canal) : écran ECR-ADM-04 ; Q-373, Q-375 |
| EX-TRA-030 | → rec ; → coo ; étape 8 : D-19 | Les alertes remplacent mails et pointages ; mails conservés (COO) ; SMTP en D-19 (Q-375) |
| EX-TRA-031 | → rec ; → coo | Catalogue d'alertes REC/COO repris par les règles ; catalogue exhaustif non fourni (Q-374) |
| EX-TRA-032 | → rec | La purge des attendues ne lève pas d'alerte |
| EX-TRA-033 | UX P1 | Toast 5 secondes, erreur près du champ |
| EX-TRA-034 | étape 4 (socle) ; étape 8 : D-09 | Journal et lots versionnés : socle ; écran ECR-ADM-08 en D-09 (Q-376) |
| EX-TRA-035 | → rec | Journal d'événements de réception, historique de l'affiche |
| EX-TRA-036 | → coo | Historique de la validation admin (`validationAdmin_par`, `_le`) |
| EX-TRA-037 | → rec ; étape 8 : D-13 | Stock = somme des mouvements : REC crée les mouvements ; écrans STK en D-13 |
| EX-TRA-038 | étape 4 (socle) | Pas d'identifiants en clair (Q-010) |
| EX-TRA-039 | étape 8 : D-10, D-16 | Intégration Broadcast : lecture EDR/préparations et retour (Q-005, Q-377, Q-379) |
| EX-TRA-040 | étape 8 : D-16, D-17, D-22 ; hors périmètre P1 | Interfaces tierces : Geodis, Vendôme, SMTP, AD hors P1 ; Broadcast et Process Métier traités en D-16 / D-22 |
| EX-TRA-041 | étape 8 : D-06, D-02, D-05 | Paramétrage et référentiels, règles en configuration |
| EX-TRA-042 | → rec ; étape 8 : D-20 | Purge à 4 semaines, conservation (REC) ; job planifié en D-20 (Q-384, Q-376) |
| EX-EXI-001 | existant : sert de référence | Trois espaces de travail (Pré-Prod / Broadcast, Coordination, plateforme) ; fonde la section 1 |
| EX-EXI-002 | existant : sert de référence | Acteurs et actions ; ambiguïtés (qui active la DA, qui colise) : Q-351 |
| EX-EXI-003 | existant : sert de référence ; étape 8 : D-02 | Sites et ateliers existants ; DBG et Nîmes Pliage 12M2 à confirmer (Q-358) |
| EX-EXI-004 | hors périmètre P1 | Matrice acteurs × étapes par site : puces graphiques non extraites, inexploitable (Q-008) |
| EX-EXI-070 | existant : sert de référence ; étape 4 (socle) | Statuts objet par objet : base des machines d'états et de D-07 (Q-004) |
| EX-EXI-071 | existant : sert de référence | Trois sens de « À traiter » / « En cours » : à lever dans le vocabulaire cible (Q-381) |
| EX-EXI-072 | existant : sert de référence ; étape 8 : D-14 | Statut limité à Instruction OK ; « Terminé » posé par la fin de journée Geodis (Q-390) |
| EX-EXI-073 | existant : sert de référence ; étape 8 : D-10 | Grains et ruptures de grain : modèle de données et EDR (9 grains « Afficher par ») |
| EX-EXI-074 | hors périmètre P1 | Tags cibles NON validés (21/10, validation admin remplacée par l'option A) : repères utilisés comme source d'alertes seulement (Q-381) |
| EX-EXI-075 | existant : sert de référence | Entretien 8 % / 15 % : règle portée par → coo (contradictions : Q-373 pour les valeurs) |
| EX-EXI-076 | existant : sert de référence ; étape 8 : D-13 | Stock, sorties de stock, état de destruction : contradictions de sources (Q-383, Q-384) |
| EX-EXI-077 | existant : sert de référence | Deadlines et calendrier : incohérences internes (Q-380) |
| EX-EXI-078 | existant : sert de référence ; → coo | DM et rajouts post-préparation : alertes COO |
| EX-EXI-079 | existant : sert de référence ; → rec | Gestion des thèmes existante (« 1er qui a parlé » en cible : EX-THM-501) |
| EX-EXI-080 | existant : sert de référence | BL.png : image basse résolution, aucune règle à en déduire |
| EX-EXI-085 | existant : sert de référence ; étape 8 : D-14 | Écrans Expédition existants (Préparer colis, Liste des colis, envoi manuel) |
| EX-TRA-501 | UX P1 | Changer l'ordre des colonnes (Préparation fixe / trains) : vues personnalisables communes |
| EX-TRA-502 | UX P1 | Sélections multiples d'annonceurs et de lignes |
| EX-TRA-503 | UX P1 | Filtres intelligents annonceur -> thèmes (« smart » de la barre de filtres) |
| EX-TRA-504 | UX P1 | Pas de rafraîchissement manuel à chaque changement de filtre |
| EX-TRA-505 | UX P1 | Garder l'extraction Excel (voir EX-TRA-016 ; Q-360) |
| EX-TRA-506 | UX P1 | Supprimer les « caches » de valeur de filtre ; la mémorisation des filtres au retour est voulue par EX-TRA-013 (point à trancher en UX) |
| EX-TRA-507 | UX P1 | Réduire le nombre de clics (non mesurable ; impressions, Réception) |
| EX-TRA-508 | UX P1 | Vues personnalisables (colonnes), stockage par utilisateur non précisé |
| EX-TRA-509 | UX P1 | Distinguer chaque ligne par une couleur (critère non précisé : liseré par gravité de la maquette) |
| EX-TRA-510 | hors périmètre P1 | Sauvegarde des données de la veille (« base REF ») : exploitation, non définie (Q-396) |
| EX-TRA-511 | étape 8 : D-05, D-23 | Purge de la liste des destinations et reprise de données (Q-395) |
| EX-TRA-512 | étape 8 : D-16 | Dates de validité des données de l'interface BC / Circé (Q-378) |
| EX-TRA-513 | étape 8 : D-15 | Extraction sur période longue (aujourd'hui mois par mois) |
| EX-TRA-514 | étape 8 : D-16 | « Annule et remplace » de l'interface BC (adresses) (Q-378) |
| EX-TRA-515 | → coo ; étape 8 : D-10 | Quantités doublées dans l'EDR pour 2 semaines de départ (anomalie ANO-02 ; quantité comptée une fois) |
| EX-FIX-501 | → coo | Supprimer la distinction Vrac / Roulée : une seule préparation « 2 m² fixe » (ECR-COO-09) |
| EX-FIX-502 | étape 8 : D-15 | Création automatique du fichier de prod multi-rouleuse (ECR-GEN-02) |
| EX-FIX-503 | → coo | Alerte mail si dossier fixe envoyé après le 1er colisage (recoupe EX-COO-503 ; « A revoir Bao », Q-391) |
| EX-FIX-504 | → coo | Jours d'affichage dans la préparation (« A revoir Bao », présentation non tranchée : Q-391) |
| EX-FIX-505 | → coo | Colonne entretien par afficheur et quantité à produire modifiable (ECR-COO-09) |
| EX-FIX-506 | → rec | CG : ajouter des quantités d'entretien reçues (menu « Réception ? » ; CG non défini : Q-393) |
| EX-FIX-507 | hors périmètre P1 | Taille de rouleau max de la multi-rouleuse (« A creuser Rayane ») ; paramétrage en D-06 / D-15 (Q-391) |
| EX-FIX-508 | → coo ; hors périmètre P1 | Vision de l'entretien (dashboard) et fichier de prod : « A revoir Bao » (Q-391) |
| EX-FIX-509 | → coo | Modifier thème et annonceur après lancement de prod (droits limités) : contradiction A13/A14 (Q-387) |
| EX-FIX-510 | → coo | Conserver le bouton Colisage / « Libération de la semaine » (décision d'atelier ; nom à aligner) |
| EX-FIX-511 | hors périmètre P1 | Suivi de prod enrichi (colonnes Qté attendue / reçue / reste) : rapproché de ECR-PIL-02 (P3) |
| EX-SCR-501 | hors périmètre P1 | Intégrer l'Excel « Fichier Vierge » (« A creuser Rayane » ; contenu non fourni : Q-392) |
| EX-SCR-502 | hors périmètre P1 | Intégrer l'Excel « Tableau de Roulage » (alimenté par la bague ; Q-392) |
| EX-SCR-503 | étape 8 : D-15 | Simplifier la préparation des fichiers Vendôme (besoin non défini, « A creuser Rayane ») |
| EX-SCR-504 | hors périmètre P1 | Revoir les tableaux de suivi de prod (consolidation) : voir ECR-PIL-01/02 (P3) |
| EX-SCR-505 | hors périmètre P1 | N° de contrat saisis dans les thèmes (« En attente input Patrick », sans exemple) |
| EX-SCR-506 | → coo | Raccrochages en masse dans le train (volumétrie cible non précisée) |
| EX-SCR-507 | → coo | Pré-assemblage 8 m² par client ou par destinataire (ECR-COO-07/08) |
| EX-SCR-508 | → coo | Page Préparation : colonnes annonceur 1 – thème 1 / annonceur 2 – thème 2 (ECR-COO-07) |
| EX-SCR-509 | → coo | Lister tous les trains contenant 1 à n thèmes (ECR-COO-05/07) |
| EX-SCR-510 | → coo | Sélectionner un nombre donné de lignes (ex. 60 trains de 4) |
| EX-SCR-511 | → coo ; étape 8 : D-18 | Sortir automatiquement feuilles d'activité de bacs et feuilles de stock (impression) |
| EX-SCR-512 | → coo | N° de panneau BC pour chefs d'équipe et coordinateurs (« Patrick seulement » : Q-356) |
| EX-SCR-513 | → coo | Vignette de lien vers le visuel dans Suivi par thème (doublon de EX-REC-510) |
| EX-SCR-514 | étape 8 : D-15 | Anomalie : saturation à la génération des fichiers (seuil non défini) |
| EX-SCR-515 | hors périmètre P1 | Reporting MUI (réunion du lundi) : Excel non fourni (Q-392) |
| EX-SCR-516 | hors périmètre P1 | Réunion du jeudi : synthèse + commentaires (nouvel écran, Q-392) |
| EX-SCR-517 | étape 8 : D-14, D-13 | Scan des codes barre met à jour affiches produites et stocks : contredit EX-STK-501/505 (Q-383) |
| EX-SCR-518 | hors périmètre P1 | Fichiers « optimisés » : besoin abandonné (décision d'atelier) |
| EX-PIL-501 | hors périmètre P1 | Synthèse de suivi de prod A / B / C / % d'avancement (ECR-PIL-01/02, P3 ; « pour discussion ») |
| EX-PIL-502 | hors périmètre P1 | Détail des dossiers par semaine ; « Preuve de livraison » sans source (Q-390) |
| EX-EXP-501 | étape 8 : D-14 | Bouton « envoi manuel » dans « Préparer colis pour les trains » (ECR-EXP-01) |
| EX-EXP-502 | étape 8 : D-14 | Milk : comptage des bagues par scan ; « 10 » règle ou exemple ? |
| EX-EXP-503 | étape 8 : D-14 | Sélection multiple pour supprimer un train d'un colis |
| EX-EXP-504 | étape 8 : D-14 | Consulter le contenu d'un colis depuis Préparation |
| EX-EXP-505 | étape 8 : D-17 | Afficher le BL transporteur Geodis dans Liste des colis (API Geodis) |
| EX-EXP-506 | hors périmètre P1 | Ré-ouverture de colis : catégorie « Refusé » ; maquette : un colis clos ne se rouvre pas (Q-388) |
| EX-STK-501 | étape 8 : D-13, D-14 | Règles de calcul des stocks par événement (réception, Terminé, rebut, destruction) ; contradictions (Q-383) |
| EX-STK-502 | étape 8 : D-13 | Menu « Suivi des stocks » (À conserver, À détruire, À renvoyer, Sorti du stock) : ECR-STK-03 |
| EX-STK-503 | étape 8 : D-13 | État des mises en conservation (flag conservation, Ville de Paris) |
| EX-STK-504 | étape 8 : D-13 | État de destruction : délais 4 / 2 semaines, « A revoir Bao – impact CGV 2027 » (Q-384, Q-391) |
| EX-STK-505 | étape 8 : D-13, D-14 | Sorties de stock déclenchées par les expéditions (doublon de EX-STK-501) |
| EX-THM-501 | → rec ; étape 8 : D-12 | Règle du « 1er qui a parlé » pour les intitulés de thèmes (REC réception sans IP) ; alertes en D-12 |
| EX-THM-502 | étape 8 : D-12 | Écran d'alerte sur intitulés proches (ECR-THM-01 ; « dans Broadcast » vs Circé : Q-366) |
| EX-THM-503 | étape 8 : D-12 | Page des modifications de thème après identification (ECR-THM-03 + alerte) |
| EX-THM-504 | → rec | Purge des anciens thèmes après modification (rappel de EX-REC-504) |
| EX-ADM-501 | étape 8 : D-04 | Où paramétrer un imprimeur, un livreur, un agent de réception (ECR-ADM-07) |
| EX-ADM-502 | étape 8 : D-01 ; étape 4 (socle) | Authentification par adresse mail Cityz, plus de mail générique (Q-001, Q-359) |
| EX-ADM-503 | → coo ; étape 8 : D-01 | Restreindre la ré-impression des bagues (rôles « Directeur de plateforme », « Patrick » : Q-356) |
| EX-ADM-504 | étape 8 : D-08 | Listes de distribution des alertes (ECR-ADM-04, écran de gestion non maquetté) |
| EX-BUS-501 | hors périmètre P1 | Bus hors Nanterre : réceptions attendues et saisie des quantités (« A revoir Bao ») |
| EX-BUS-502 | hors périmètre P1 | Menu Bus pour Nanterre (flux « existant » ? : Q-386) ; ECR-COO-09 couvre la préparation Bus |
| EX-BUS-503 | → coo | Ajuster manuellement la quantité à encoller (Bus), entretien +20 % / +8 % de production (Q-386) |
| EX-BUS-504 | hors périmètre P1 | Visibilité des anomalies de réception Bus (délai non fourni) |
| EX-QUA-501 | étape 8 : D-22 | Intégrer le tableau de suivi des non-conformités (« A revoir Bao ») ; Q-394 |
