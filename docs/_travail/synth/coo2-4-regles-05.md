### RG-COO-290 — Liste des UM 2 m² / pliage : périmètre, exclusions, adresse principale, affiche reçue indicative
- Origine : MODIFIÉE
- Énoncé : `p_s_listeUM_2m2` liste les UM hors statuts 3 et 4, pour les ateliers 1 et 4 uniquement (en dur ; variante pliage `p_s_listeUM_pliage`), dont l'utilisateur a le droit (`tr_utilisateur_data.loginWindows`), semaine / année facultatives, avec l'adresse principale du destinataire (jointure interne : une UM sans adresse principale disparaît de la liste) ; `SELECT DISTINCT`. Elle associe `affiche_id` et `validationAdmin` aux UM dont l'affiche livrée (même `cont_num`, plateforme, annonceur, support, thème, hors repiquage) est validée par l'admin pour la semaine / année passées ; l'information est affichée « oui / non » sans bloquer l'action. Aucun changement de statut ; colonne `UM_date_aff` ajoutée. MODIFIÉE : en cible la création d'UM, la libération et le passage « En cours → Préparé » ne dépendent d'aucune réception ni validation admin (EX-COO-001 ; RG-X-084) ; l'affiche est affichée avec ✓ (validée) ou • (proposée à confirmer) ; les ateliers ne sont plus codés en dur.
- Déclencheur : écran Préparation 2 m² fixe / pliage (liste des UM).
- Conditions : `tf_UM.rpc_statut NOT IN (3, 4)` ; `tf_UM.ate_id IN (1, 4)` en legacy ; périmètre d'ateliers de l'utilisateur.
- Effet / message d'erreur : lecture seule. L'en-tête legacy daté « 04-06-2026 » est probablement une erreur.
- Sources : legacy `p_s_listeUM_2m2.sql:36-62,113-142`, `p_s_listeUM_pliage.sql:43-50`, `PreparationController.cs:764-765` (ancien ID provisoire RG-RPR-024) ; spec `specs-coordination.md §A` (EX-COO-001, EX-COO-014) ; écran `ECR-COO-09`
- Questions liées : Q-273
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-291 — Dispatch du roulage : périmètre des trains et filtres
- Origine : MODIFIÉE
- Énoncé : l'écran Dispatch d'un atelier déroulant (un par site) liste les trains de l'atelier au statut PRET ou EN_PROD : Train, Destinataire, Départ, Positions, Trains, Faces, Statut, Rouleur. Filtres : N° de dossier, Départ, Statut (Prêt / En production), + Destinataire. Trois indicateurs : Trains à rouler, Faces, Non affectés. Messages : « Aucun atelier déroulant sur ce site. » ; tableau vide standard. Legacy : le dispatch se fait en dehors de Circé (transmission au dispatcheur de l'export Excel imprimé) avec un programme Python existant, à intégrer.
- Déclencheur : menu Déroulant › Dispatch.
- Conditions : profil `cheq` (rôle de l'écran) ; périmètre d'ateliers de l'utilisateur.
- Effet / message d'erreur : lecture + affectation (RG-COO-294).
- Sources : écran `ECR-COO-10` ; spec `specs-existant-process.md §C` (EX-EXI-035 : « transmettre au dispatcheur »)
- Questions liées : Q-276
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-292 — Dispatch : nombre de faces et charge par rouleur
- Origine : NOUVELLE
- Énoncé : faces d'un train = `nb × nombre de positions non fractionnées` ; charge d'un rouleur = nombre de trains et de faces affectés ; la carte « Charge par rouleur » affiche Rouleur, Poste, Trains, Faces, Charge (jauge) et les destinataires, avec le bouton « Liste de picking » (RG-COO-296). La moyenne de charge est celle des rouleurs du site.
- Déclencheur : affichage / affectation.
- Conditions : positions fractionnées exclues (RG-COO-209).
- Effet / message d'erreur : indicateurs recalculés à chaque affectation.
- Sources : écran `ECR-COO-10`
- Questions liées : Q-276
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-293 — Dispatch : « Proposer une répartition » (règle simulée en attente du moteur cible)
- Origine : NOUVELLE
- Énoncé : « Proposer une répartition » (bouton primaire) affecte les trains aux rouleurs : départ le plus proche d'abord, puis rouleur le moins chargé (en faces). Message : « Répartition proposée : n trains sur m rouleurs. ». L'algorithme est simulé en maquette ; le moteur cible est le programme Python existant « à transmettre » (callout « Moteur de répartition à brancher »).
- Déclencheur : clic sur « Proposer une répartition ».
- Conditions : trains PRET ou EN_PROD non affectés ; la règle simulée n'est qu'un comportement provisoire jusqu'à réception de l'algorithme (Q-276).
- Effet / message d'erreur : rouleurs affectés (RG-COO-294) ; aucun effet sur les trains EN_PROD déjà affectés (HYPOTHÈSE).
- Sources : écran `ECR-COO-10` (« Règle simulée »)
- Questions liées : Q-276
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-294 — Dispatch : affectation manuelle d'un rouleur et « Tout désaffecter »
- Origine : NOUVELLE
- Énoncé : le champ Rouleur de chaque ligne (liste « Non affecté » + opérateurs du site) enregistre l'affectation immédiatement et écrit au journal ; « Tout désaffecter » remet toutes les lignes à « Non affecté ». Teinte : non affecté < 36 h → critique ; non affecté → avertissement.
- Déclencheur : changement du select / « Tout désaffecter ».
- Conditions : opérateurs du site de l'atelier ; train non LIVRE.
- Effet / message d'erreur : `rouleur_id` mis à jour + historique.
- Sources : écran `ECR-COO-10`
- Questions liées : Q-276
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-295 — Dispatch : alertes de départ proche et de surcharge
- Origine : NOUVELLE
- Énoncé : callout « critique » si des trains non affectés partent dans moins de 36 h ; callout d'avertissement par rouleur dont la charge dépasse 115 % de la moyenne ; les seuils 36 h et +15 % sont codés en dur dans la maquette (paramètres à prévoir).
- Déclencheur : affichage / affectation.
- Conditions : seuils 36 h, 115 % (valeurs de la maquette, non spécifiées) ; l'alerte « Départ camion à risque » (unités en attente, moins de 72 h, critique < 36 h) du catalogue d'alertes est portée par coo1.
- Effet / message d'erreur : callouts.
- Sources : écran `ECR-COO-10`, `ECR-TRA-01` ; spec `specs-transverse.md §E` (EX-TRA-031 : « surcharge / départ proche (dispatch) »)
- Questions liées : Q-276
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-296 — Liste de picking d'un rouleur (« Liste des affaires à collecter »)
- Origine : MODIFIÉE
- Énoncé : pour un rouleur, la modale liste Emplacement, N° affiche, Annonceur, Thème, Quantité, triée par emplacement ; boutons Fermer / Imprimer. Legacy : édition de la liste de picking par semaine (`EditionPicking.rdlc`) et fiches d'activité de bacs ; l'automatisation de la sortie des feuilles d'activité de bacs et des feuilles de stock est demandée. Cible : PDF généré côté navigateur.
- Déclencheur : « Liste de picking » (carte Charge par rouleur).
- Conditions : emplacement saisi à la réception (RG-X-088).
- Effet / message d'erreur : aperçu puis impression ; lecture seule.
- Sources : écran `ECR-COO-10` ; legacy `Rapport.cs` (`EditionPicking`, `EditionFicheActivite`, ancien ID provisoire RG-ADM-060) ; spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-511)
- Questions liées : Q-287
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-297 — Rouleurs : référentiel d'opérateurs rattachés à un site et un poste
- Origine : MODIFIÉE
- Énoncé : les rouleurs sont des opérateurs (id, site, libellé « Rouleur N1 », poste « Table 1 ») gérés dans Administration › Référentiels, distincts des utilisateurs ; le legacy a une « Liste des rouleurs » (droit `referentiel`) et `rouleur_id` sur `tf_face_train`. Équipes et machines sont gérées par plateforme (RG-ADM-046).
- Déclencheur : alimentation des listes de choix de rouleur.
- Conditions : opérateurs du site ; désactivation plutôt que suppression d'un rouleur référencé (HYPOTHÈSE).
- Effet / message d'erreur : listes de choix ; refus de suppression si référencé (409).
- Sources : écran `ECR-ADM-07`, `ECR-COO-07` ; legacy-admin.md matrice droit × page (« Liste des rouleurs ») et RG-ADM-046
- Questions liées : Q-276
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-298 — Bagues et étiquettes : périmètre de la liste et filtre « À imprimer »
- Origine : NOUVELLE
- Énoncé : la liste des bagues contient les unités hors machine Vendôme et hors EN_ATTENTE : Unité, Atelier (+ site si Tous), Poste (machine ou « Sans machine »), Destinataire, Textes imprimés par position (annonceur · thème + tag « modifié »), Statut ; masquées : Type (Train / UM (rouleau) / Lot), Bague (« Imprimée (rouleur) », « réimprimée n fois »). Filtres : N° de dossier, Départ, Atelier, Poste, Bague (défaut « À imprimer » ; Imprimées ; Sans bague, déjà en production), + Destinataire. Les bagues Vendôme partent avec le fichier. Ligne en avertissement si textes modifiés.
- Déclencheur : menu Déroulant › Bagues ; boutons « Imprimer les bagues » de la Liste des trains / Préparation / unitaire.
- Conditions : profil `cheq`.
- Effet / message d'erreur : lecture + actions RG-COO-299 à 301.
- Sources : écran `ECR-COO-11`
- Questions liées : Q-277
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-299 — Impression des bagues : rouleur obligatoire, passage automatique à « En production »
- Origine : MODIFIÉE
- Énoncé : l'action « Imprimer n bague(s) » demande le Rouleur (liste des opérateurs du site), montre l'aperçu des 6 premières bagues et « Imprimer » pose la bague, affecte le rouleur et fait passer les unités PRET à EN_PROD (« Le statut passe automatiquement à « En production » à l'impression »). Refus : « Aucune unité « Prêt à produire » dans la sélection. ». Legacy : l'étiquette bague (`EtiquetteBagueNewCode128.rdlc` si code 128, sinon `EtiquetteBagueNew.rdlc`) est écrite en PDF temporaire, la mise « Au roulage » (10) fixe le rouleur (RG-COO-217). Les unités passées à EN_PROD le sont aussi à l'envoi du fichier à la machine (GEN-03).
- Déclencheur : « Imprimer les bagues (n) ».
- Conditions : au moins une unité PRET dans la sélection ; PDF généré côté navigateur ; agent d'impression local : Q-002.
- Effet / message d'erreur : unités `PRET → EN_PROD` ; bague posée ; historique ; 422 avec le message ci-dessus.
- Sources : écran `ECR-COO-11a` ; legacy `Rapport.cs:463-479,486-508` (ancien ID provisoire RG-ADM-060, RG-ADM-061) ; spec `specs-existant-process.md §C` (EX-EXI-035)
- Questions liées : Q-002, Q-277
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-300 — Textes imprimés sur la bague : modification et réimpression automatique
- Origine : NOUVELLE
- Énoncé : « Modifier » une bague ouvre « Textes imprimés sur la bague n » : par position (A, B…), champs Annonceur et Thème ; « Enregistrer et réimprimer » historise et réimprime ; vaut en fixe comme en déroulant ; pour le bus l'action de ligne s'appelle « Textes de bague ». L'unité porte le tag « bague modifiée ».
- Déclencheur : action de ligne « Modifier » / « Textes de bague ».
- Conditions : textes non vides (HYPOTHÈSE, même contrôle que RG-COO-244) ; réimpression soumise à RG-COO-301.
- Effet / message d'erreur : textes enregistrés, historique, compteur de réimpressions.
- Sources : écran `ECR-COO-11b`, `ECR-COO-09`
- Questions liées : Q-277
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-301 — Réimprimer une bague : motif obligatoire, même numéro, statut inchangé
- Origine : MODIFIÉE
- Énoncé : « Réimprimer la bague n » (depuis l'aperçu d'une bague imprimée ou la fiche train) demande un motif : « Colis perdu, refait », « Bague abîmée ou illisible » ou « Autre » ; la bague garde le même numéro et les mêmes textes, le statut est inchangé, le compteur `reimpressions` augmente (tag « Bague réimprimée n fois »). La cible restreint les droits de réimpression (revenir de « Terminé » à « Imprimer ») aux directeurs de plateforme et chefs d'équipe ; l'état actuel (« possible pour Patrick mais pas pour les ateliers ? ») est ambigu.
- Déclencheur : « Réimprimer la bague… ».
- Conditions : bague déjà imprimée ; profil `cheq` ou directeur de plateforme (rôle non défini : Q-286).
- Effet / message d'erreur : compteur incrémenté ; historique avec motif ; 403 si profil non autorisé.
- Sources : écran `ECR-COO-11c`, `ECR-COO-05a` ; spec `specs-ateliers-besoins.md PARTIE 10` (EX-ADM-503)
- Questions liées : Q-277, Q-286
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-302 — Contenu de l'étiquette bague
- Origine : MODIFIÉE
- Énoncé : l'aperçu d'une bague contient : code-barres, n° d'unité, « Nb aff : n » (= quantité + entretien pour une UM / un lot), destinataire en grand, afficheur · atelier, départ · boucle · rouleur, lignes « dossier · annonceur — lettre » et thème (étoile si modifié). Legacy : états `EtiquetteBagueNew*.rdlc` (code-barres 128 ou standard). Aucune quantité par bague en fixe / lot (Q-COO-25 de la maquette).
- Déclencheur : aperçu / impression.
- Conditions : mise en page des états RDLC non lue (contenu exact à confirmer).
- Effet / message d'erreur : aperçu ; aucun refus.
- Sources : écran `ECR-COO-11` (« Aperçu bague ») ; legacy `Rapport.cs:463-479` (ancien ID provisoire RG-ADM-060)
- Questions liées : Q-277
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-303 — Tableau de roulage alimenté par la bague
- Origine : NOUVELLE
- Énoncé : le « Tableau de Roulage » (saisie manuelle par jour et par opérateur du nombre de trains de 1, 2, 3 ou 4 pour ajuster les primes de production) doit être alimenté automatiquement par l'information de la bague. Le calcul des primes est hors périmètre. L'Excel « Fichier Vierge » (suivi par opérateur de ce qui a été fait dans la journée, passage d'information entre shifts ; inexistant à Nîmes) est à intégrer. Statut des lignes de synthèse : « A creuser » (contenu non fourni).
- Déclencheur : impression / affectation de bague.
- Conditions : périmètre non défini.
- Effet / message d'erreur : aucun tant que Q-278 n'est pas tranchée.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-501, EX-SCR-502, EX-SCR-515, EX-SCR-516)
- Questions liées : Q-278
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-304 — Bus : quantités à encoller (calcul Broadcast, ajustements global et par centre)
- Origine : NOUVELLE
- Énoncé : la modale « Quantités à encoller » (Bus) affiche par centre bus : Quantité commandée, « Calcul Broadcast (+8 % +20 %) » = commande × 1,08 + commande × 0,20 (arrondis), Ajustement centre (%) éditable, À encoller ; un champ Ajustement global (%) s'applique à tous les centres ; « Enregistrer et éditer les états de collage » écrit au journal. Le besoin est d'ajuster à la hausse ou à la baisse la quantité à encoller, globalement et par centre, selon le parc en exploitation (bus retirés, cadres non reposés) ; aujourd'hui Broadcast applique +8 % de production figé et +20 % d'entretien par défaut, sans que la plateforme ait la main.
- Déclencheur : « Quantités à encoller » (Bus).
- Conditions : les règles d'arrondi, de combinaison des ajustements global et par centre et le vocabulaire (+8 % production / +20 % entretien) ne sont pas spécifiés ; ajustements en pourcentage (valeurs minimales appliquées par `Math.max` dans la maquette).
- Effet / message d'erreur : quantités à encoller enregistrées avec historique.
- Sources : spec `specs-ateliers-besoins.md PARTIE 11` (EX-BUS-503) ; écran `ECR-COO-09e`
- Questions liées : Q-279
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-305 — Bus : préparation par centre (onglet Bus, lots `BU-nnnn`)
- Origine : NOUVELLE
- Énoncé : Nanterre est une plateforme de Circé (module Réception) ; un dossier Bus transmis par Broadcast arrive sans ressaisie (n° de dossier, client, format, semaine de pose, quantités par centre bus) ; les formats Bus sont intégrés au référentiel et traités dans un onglet Bus (À traiter / Préparation / Liste des colis) aux fonctionnalités identiques aux onglets 2 m² fixe et Pliage. L'écran « Préparation par centre » a le titre « Préparation par centre · Nanterre », une ligne par lot `BU-nnnn` (« Centre bus » à la place du destinataire), les remises directes au dépôt (« Remis au dépôt » à la place des expéditions). Les règles de délai et le workflow Dernière Minute (formulaire Process Métiers hors Circé) sont conservés tels quels. Le legacy a un menu Bus conditionné par le drapeau ConfigCat `busv3` et un mock (`PreparationBusMockRepository`), non analysés.
- Déclencheur : intégration d'un dossier Bus / ouverture de l'onglet Bus.
- Conditions : site Nanterre (Bus) = cible ; Bus > S43 non applicable dans la liste des instructions (maquette).
- Effet / message d'erreur : voir RG-COO-240 à 251 appliquées au type « Bus » ; flux d'alimentation du Bus : Q-279.
- Sources : spec `specs-ateliers-besoins.md PARTIE 11` (EX-BUS-502, EX-BUS-501, EX-BUS-504) ; écran `ECR-COO-09` ; legacy-admin.md RG-ADM-022 (drapeau `busv3`)
- Questions liées : Q-279
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-306 — Impressions du bloc : PDF généré côté navigateur
- Origine : MODIFIÉE
- Énoncé : fiche de synthèse, bagues, liste de picking, étiquettes de colis / UM, états de fin de journée sont générés côté navigateur (PDF) et non plus par rendu serveur RDLC ; aucune édition n'est enregistrée en base en legacy et aucun contrôle de droit n'existe sur les éditions (RG-ADM-060, RG-ADM-015). L'impression directe sur une imprimante Windows du serveur disparaît (agent local d'impression : Q-002). Les fichiers PDF temporaires legacy (jamais purgés) n'existent plus.
- Déclencheur : action Imprimer / Éditer.
- Conditions : la spec de la cible ne définit pas le format PDF (EX-TRA-026) : contrainte du projet.
- Effet / message d'erreur : PDF généré ; erreur d'impression visible (le legacy avale les exceptions).
- Sources : legacy `Rapport.cs:48-1025` (anciens ID provisoires RG-ADM-060, RG-ADM-061, RG-ADM-063) ; spec `specs-transverse.md §D` (EX-TRA-024, EX-TRA-025, EX-TRA-026) ; CLAUDE.md §3
- Questions liées : Q-002, Q-287
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-307 — Historisation de chaque changement de statut et action du bloc
- Origine : MODIFIÉE
- Énoncé : chaque changement de statut de face, de train, d'unité, d'UM, de colis et chaque action tracée du bloc (export des trains, annulation de thème, débloquer semaine, libération, rendre la main, fractionnement, raccrochage, création / suppression de train, impression et réimpression de bague, affectation de rouleur, saisie 8 m²) écrit un historique (qui, quand, ancienne et nouvelle valeur, motif) ; chaque génération de fichiers est un lot versionné (GEN). Legacy : `rpc_statut` est écrasé sans historique ; `histo_historique_entite` ne couvre que `ChangementStatutInstruction` (vers 2 ou 4 seulement), `ModificationInstructionPlus`, `ExporterTrains`, `DebloquerPreparation` ; les batchs d'intégration n'écrivent pas d'historique.
- Déclencheur : toute transition de statut / action listée.
- Conditions : transaction unique avec la modification (CLAUDE.md §6).
- Effet / message d'erreur : ligne d'historique ; échec d'écriture = annulation de l'opération.
- Sources : legacy `HistorisationBll.cs:16-127` (ancien ID provisoire RG-INT-046), bdd.md §5 ; spec `specs-transverse.md §G` (EX-TRA-034) ; écran `ECR-COO-05a` (frise « Modifications tracées »), `ECR-ADM-08` ; CLAUDE.md §6
- Questions liées : Q-250
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-308 — Actions de masse : verrou de version et idempotence
- Origine : NOUVELLE
- Énoncé : les actions de masse du bloc (export des trains, fractionner / raccrocher en masse, affecter un rouleur, imprimer des bagues, libérer, rendre la main, valider un comptage) s'exécutent dans une transaction ; chaque entité touchée porte un champ `version` (mise à jour conditionnelle, 409 si 0 ligne) ; les POST de création / transition portent l'en-tête `Idempotency-Key`. La maquette n'a aucune notion de version et laisse les actions de masse sans protection (Q-E de la maquette) ; deux utilisateurs peuvent agir simultanément sur la même sélection.
- Déclencheur : toute action groupée.
- Conditions : conventions du projet (CLAUDE.md §6).
- Effet / message d'erreur : 409 « conflit de version » ; rejouer la même clé d'idempotence renvoie le résultat initial.
- Sources : CLAUDE.md §6 ; `maquettes-reception-coordination.md §5` (Q-E)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
