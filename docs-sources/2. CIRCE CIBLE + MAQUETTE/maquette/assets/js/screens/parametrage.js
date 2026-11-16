/* Paramétrage : ateliers et gammes, machines et règles de fichiers, statuts, alertes, règles métier, transport, référentiels, journal */
(function () {
  'use strict';
  const M = window.M, h = M.h, ui = M.ui, C = M.calc;
  const GAMMES = [
    // Process par jalons (27/10) : au déroulant, Instruction OK et validation admin, indépendantes ; au fixe, la validation seule ; la validation admin est proposée à la réception et confirmée par la Coordination, sans attendre la préparation (option A, 02/11)
    { mode: '2 m² déroulant sur Vendôme (Nîmes, Wissous MUI)', etapes: ['Réception', 'Validation admin (proposée à la réception, confirmée par la Coordination)', 'Instruction OK (automatique sans commentaire et si exceptions = quantité, sinon Coordination)', 'Export des trains, jeudi 14 h (Coordination, « A imprimer »)', 'Pré-assemblage', 'Fichier Vendôme (trains choisis, bagues incluses)', 'Roulage', 'Colisage', 'Expédition Geodis'] },
    { mode: 'Déroulant hors Vendôme (CCM V2, 4 m², 8 m², tables de roulage)', etapes: ['Réception', 'Validation admin (proposée à la réception, confirmée par la Coordination)', 'Instruction OK (automatique sans commentaire et si exceptions = quantité, sinon Coordination)', 'Export des trains, jeudi 14 h (Coordination, « A imprimer »)', 'Assemblage (demies 8 m²)', 'Bagues', 'Roulage', 'Colisage', 'Expédition Geodis'] },
    { mode: '2 m² fixe', etapes: ['Réception', 'Validation admin (proposée à la réception, confirmée par la Coordination)', 'Libération de la semaine (ex « Colisage »)', 'Fichier multi-rouleuse', 'Production des rouleaux (UM)', 'Colisage', 'Expédition Geodis'] },
    { mode: 'Colle / pliage (Wissous)', etapes: ['Réception', 'Validation admin (proposée à la réception, confirmée par la Coordination)', 'Libération de la semaine (ex « Colisage »)', 'Pliage', 'Comptage', 'Colisage', 'Expédition Geodis'] },
    { mode: 'Bus Nanterre (cible)', etapes: ['Réception', 'Préparation par centre bus', 'Ajustement de la quantité à encoller', 'Encollage', 'Remise au dépôt'] },
  ];
  const MAPPING = [
    ['0', 'A traiter', 'Instructions (faces reçues, instructions pas encore) ; lignes 2 m² fixe et pliage (préparation reçue, pas encore colisée)', 'À traiter (dossier dont la préparation n’est pas reçue) · À libérer (ligne fixe ou pliage d’une semaine pas encore libérée)', 'Un même mot pour deux moments opposés : avant la préparation au déroulant, après au fixe (02/11)'],
    ['1', 'En cours', 'Instruction reçue de BC ; en 2 m² fixe : UM créée au « Colisage »', 'Préparation reçue (dossier) · En attente / Prêt (unité)', 'Un seul libellé avait deux sens (INC-01)'],
    ['2', 'Instruction Ok', 'Instructions trains', 'Instruction ok (déroulant)', 'Règle de Nariman (26/10) : automatique si le commentaire de prépa est vide et que le nombre d’exceptions est égal à la quantité ; sinon « En cours », à la main par la Coordination. Indépendante de la validation admin (qui reste une case par affiche, proposée à la réception et confirmée par la Coordination)'],
    ['3', 'Erreur', 'Statut technique', '— (remplacé par une alerte)', ''],
    ['4', 'Annulé', 'Dossiers, thèmes', 'Annulé', ''],
    ['5', 'A imprimer', 'Faces de train (Go plateforme)', 'Prêt à produire', ''],
    ['9', 'Export prepa', 'Faces exportées vers la Vendôme', 'En production', 'Point de non-retour'],
    ['10', 'Au roulage', 'Faces au roulage', 'En production', 'Plus de clic à oublier (PROC-08)'],
    ['6', 'Préparé', 'UM et trains ajoutés à un colis', 'Produit', 'Libellé trompeur (« en cours de préparation », INC-02)'],
    ['7', 'A expédier', 'Colis, UM, trains', 'Colisé · à expédier', ''],
    ['8', 'Terminé', 'Fin de journée Geodis', 'Expédié', 'Plus « Terminé » : la livraison n’est pas encore prouvée'],
    ['—', '—', '—', 'Livré', 'Nouveau : preuve de livraison Geodis reçue'],
  ];
  const REGLES = [
    { type: 'MANQUANT', declencheur: 'Reçu < attendu (entretien compris) pour un départ S ou S+1', seuil: 'S : critique si rien reçu ; S+1 : à surveiller', dest: "Chefs d'équipe, Coordination, réception", canal: 'Bandeau + digest 7h' },
    { type: 'ECART', declencheur: 'Reçu > attendu', seuil: '+' + Math.round(M.PARAMS.ecartReception * 100) + ' %', dest: 'Réception, Coordination', canal: 'Bandeau' },
    { type: 'SANS_IP', declencheur: 'Réception sur un dossier sans IP', seuil: '—', dest: 'Coordination, qui prévient la Pré-Prod (IP à saisir dans Broadcast)', canal: 'Bandeau + mail' },
    { type: 'ORPHELINE', declencheur: 'Réception inconnue créée (affiche rangée en zone tampon, feuille de stock temporaire), dès sa création', seuil: 'Important après 24 h', dest: 'Coordination, réception', canal: 'Bandeau' },
    { type: 'DOSSIER_INTROUVABLE', declencheur: 'Bouton « Personne ne retrouve le dossier ? » dans Réceptions inconnues : ni le visuel ni le n° de dossier n’ont suffi (remplace l’alerte précédente ; plus de mail, 21/10)', seuil: 'Important dès le signalement', dest: 'Coordination du site : Nîmes (« Pré-Prod Nîmes » dans S17, à confirmer, Q61), équipe Coord. Réception de Boulogne (Wissous)', canal: 'Bandeau' },
    { type: 'VALIDATION_ADMIN', declencheur: 'Affiche reçue dont le rattachement proposé par Circé a un doute : rattachée sans le n° de dossier du BL, format différent, plusieurs thèmes possibles, ou visuel de plusieurs dossiers (02/11, sans attendre la préparation). Les rattachements sans doute n’ont pas d’alerte : la Coordination les confirme en lot dans Validation admin et Instruction OK', seuil: 'Important pour un départ S ou S+1', dest: 'Coordination', canal: 'Bandeau' },
    { type: 'FEUILLE_DEFINITIVE', declencheur: 'Réception inconnue rattachée par la Coordination : la palette passe dans le sas de Réception des affiches, contrôle à valider (informations corrigées, emplacement définitif), puis feuille définitive à la place de la temporaire ; tant que la définitive n’est pas imprimée', seuil: '—', dest: 'Réception de la plateforme', canal: 'Bandeau' },
    { type: 'CONTROLE_RETARD', declencheur: 'Palette du sas de contrôle (zone tampon) pas encore contrôlée', seuil: 'Délai de contrôle (24 h, paramétrable) ; important au double', dest: 'Réception, chefs d’équipe', canal: 'Bandeau' },
    { type: 'IP_MANQUANTES', declencheur: 'Préparation non reçue avant la deadline (jeudi S-2 16h)', seuil: 'J-2 puis critique', dest: 'Coordination, qui relance la Pré-Prod', canal: 'Bandeau + digest 7h' },
    { type: 'ECART_BC', declencheur: 'Quantité Broadcast modifiée après l’envoi de la préparation', seuil: '—', dest: 'Coordination', canal: 'Bandeau' },
    { type: 'THEME_BC', declencheur: 'Thème d’un dossier différent entre Broadcast et Circé après l’envoi de la préparation, même après Instruction OK et validation admin (contrôle à chaque mise à jour de la copie Broadcast)', seuil: 'Critique si la production est lancée', dest: 'Coordination ; chefs d’équipe de l’atelier si la production est lancée', canal: 'Bandeau + mail immédiat' },
    { type: 'THEMES_PROCHES', declencheur: 'Dès la saisie des IP (thèmes de l’état des réservations) : thème proche de celui d’un autre dossier du même annonceur, ou d’un annonceur au nom proche, sous un intitulé différent', seuil: 'Similarité ≥ ' + String(M.PARAMS.seuilThemesProches).replace('.', ','), dest: 'Pré-Prod', canal: 'Bandeau' },
    { type: 'ANNONCEURS_PROCHES', declencheur: 'Dès la DA activée : nom d’annonceur proche de celui d’un autre dossier (« Brasserie du Port » et « BRASSERIE PORT »), même règle que les thèmes ; deux noms déjà réunis par un regroupement ne sont pas signalés', seuil: 'Similarité ≥ ' + String(M.PARAMS.seuilThemesProches).replace('.', ','), dest: 'Pré-Prod', canal: 'Bandeau' },
    { type: 'DM_FICHIER', declencheur: 'Modification Broadcast sur une unité « En production »', seuil: '—', dest: "Chefs d'équipe du site", canal: 'Bandeau + mail immédiat' },
    { type: 'APRES_LIBERATION', declencheur: 'Préparation envoyée entre le jeudi soir de S-2 et le vendredi de S, au fixe comme au déroulant (RP34) ; au fixe et au pliage, après la libération de la semaine', seuil: 'Pas de raccrochage automatique : l’atelier raccroche ou produit à part', dest: "Chef d'atelier, admins de la plateforme, coordinateurs (liste « Rajouts après préparation »)", canal: 'Bandeau + mail immédiat' },
    { type: 'DEPART_RISQUE', declencheur: 'Unités en attente d’affiches avant un départ camion', seuil: '72 h ; critique sous 36 h', dest: "Chefs d'équipe", canal: 'Bandeau' },
    { type: 'THEME_MODIF', declencheur: 'Thème d’une affiche modifié après l’identification (repris de Broadcast, corrigé par la Coordination ou par la plateforme)', seuil: '—', dest: 'Réception de la plateforme', canal: 'Bandeau' },
    { type: 'MAIL_COMMERCIAL', label: 'Mail au commercial (réception)', declencheur: 'Affiches reçues et identifiées sur un dossier', seuil: '—', dest: 'Commercial et assistante du dossier (issus de Broadcast)', canal: 'Désactivée' },
  ];
  /** Listes de distribution (RP34 : « écran de gestion des listes de distribution » dans Administration). Des rôles, pas de noms. */
  const LISTES = [
    { liste: 'Rajouts après préparation – Nîmes', dest: "Chef d'atelier, admins de la plateforme de Nîmes, coordinateurs logistique", usage: 'Rajout après préparation (RP34, REU-04)' },
    { liste: 'Rajouts après préparation – Wissous', dest: "Chef d'atelier, admins de la plateforme de Wissous, coordinateurs logistique", usage: 'Rajout après préparation (RP34, REU-04)' },
    { liste: 'Thème modifié, production lancée', dest: "Chefs d'équipe de l'atelier concerné", usage: 'Thème modifié dans Broadcast après la validation (PP-09)' },
    { liste: 'Corrections de thème à Broadcast', dest: 'Gestionnaires du pôle (Direct, Intermédié)', usage: 'Vérification des thèmes proches (PP-08)' },
    { liste: 'Intitulés corrigés par la plateforme', dest: 'Pré-Prod du site', usage: 'Correction d’intitulé au fixe et à la colle (FIX-15)' },
  ];
  const EXISTANTS = [
    ['« Réception affiche »', 'À chaque réception, aux adresses de la plateforme (ToolBll.cs:383-447)', 'Remplacé par le dashboard ; digest optionnel'],
    ['« Déblocages »', 'Au déblocage d’une préparation (AdminPreparationDeblocageBll.cs:221-267)', 'Remplacé par le mail « Demander une correction à Broadcast » aux gestionnaires du pôle (Circé ne modifie pas Broadcast)'],
    ['« Un colis d’affiches vient de vous être expédié »', 'Batch vers les afficheurs ou leurs managers (BatchEnvoieMailColisBll.cs)', 'Conservé (absent des decks, à confirmer)'],
  ];

  /* ---------- Tous les statuts et tags de la maquette (22/10) : calculés ou enregistrés ----------
     Repris du document statuts_et_tags_calcul_ou_base.html (21/10), mis à jour avec la réception (sas, réception inconnue,
     feuille temporaire ou définitive, signalement à la Coordination, colonne Contrôle des réceptions attendues) et les types
     d'alerte. Origine : C calculé (rien à enregistrer), E existe dans Circé, B vient de Broadcast, N à ajouter dans la base (V2).
     f : 'verif' à vérifier, 'sens' sens à revoir. Les `…` sont des tables ou colonnes de Circé (constatées). */
  const ORIGINES = {
    C: { label: 'Calculé', aide: 'Se déduit des données à chaque calcul : rien à enregistrer, personne ne le coche' },
    E: { label: 'Existe dans Circé', aide: 'Une table et une colonne de la base actuelle portent déjà l’information' },
    B: { label: 'Vient de Broadcast', aide: 'Dans Broadcast, mais n’arrive pas (ou mal) dans Circé : un flux à demander' },
    N: { label: 'À ajouter (V2)', aide: 'Une décision ou une action humaine à garder : il lui faut une place nouvelle' },
  };
  const CATALOGUE = [
    { g: 'Dossier · statut de pré-production', ou: 'Pré-production › Validation admin et Instruction OK', items: [
      ['À traiter', 'C', 'Aucune préparation reçue de Broadcast pour ce dossier.', 'Aujourd’hui statut 0 (`rpc_statut`) ; en cible, absence de lignes de préparation'],
      ['Préparation reçue', 'C', 'La préparation est arrivée de Broadcast. La validation admin est à part : elle part de la réception, sans attendre la préparation (02/11).', 'Lignes dans `tf_repart_calcul` ou `tf_face_train` ; aujourd’hui statut 1 « En cours »'],
      ['Instruction OK', 'E', 'Déroulant seulement. Automatique quand le commentaire de prépa est vide et que le nombre d’exceptions est égal à la quantité ; sinon, à la main par la Coordination (règle du 26/10).', 'Statut 2 (`instruction_train.rpc_statut`) ; la règle lit `instr_commentaire` et compare le nombre d’exceptions à la quantité des lignes de format, hors entretien'],
      ['Validation admin du dossier : Aucune affiche reçue, À confirmer, Validée', 'E', 'Résumé de la validation admin des affiches reçues du dossier, à côté de son statut de préparation : Circé propose le rattachement à la réception, la Coordination confirme en lot ou un par un (option A). Elle ne passe plus par l’attente de la préparation : un dossier peut être « Validée » avant que la prépa soit envoyée (02/11). Jamais « Validée » sans affiche reçue. Indépendante de l’Instruction OK.', 'La case `affiche.validationAdmin`, par affiche, gardée ; le dossier en est le résumé. Qui et quand : historique existant (`HistorisationBll.cs:29-32`)'],
      ['Validation admin d’une affiche à confirmer', 'C', 'Rattachement proposé par Circé à la réception, à confirmer par la Coordination : en lot si aucun doute (cas sûr, pré-coché), un par un sinon (rattachée sans le n° de dossier du BL, format différent, plusieurs thèmes possibles, visuel de plusieurs dossiers, IP pas saisies). La quantité n’est pas une condition.', 'Se déduit du rattachement, du format et des thèmes ; le mode de rattachement (BL, visuel, à la main) est à garder (V2)', 'verif'],
      ['Annulé', 'E', 'Pas à produire.', 'Statut 4, exclu par les procédures (`p_Alimentation_tf_prepa_affiche.sql:132`)'],
      ['Arrivé après libération', 'C', 'La préparation est arrivée après la création des unités de la semaine.', 'Date d’arrivée comparée à `tf_UM.UM_dat_cre`'],
    ] },
    { g: 'État des réservations vivant · « Où en est-il »', ou: 'Pilotage › État des réservations vivant', items: [
      ['DA activée, IP à saisir', 'C', 'Le dossier est dans la copie de l’état des réservations, sans thème.', '`tf_prepa_Broadcast`'],
      ['IP saisies, prépa attendue', 'C', 'Le thème est connu, la préparation n’est pas arrivée.', '`tf_prepa_Broadcast`, sans ligne de préparation'],
      ['Affiches attendues', 'C', 'Rien de reçu pour ce visuel.', 'Reçu = 0 (RG-002 : quantités rattachées, `asso_affiche_visuel` en V2)'],
      ['Reçues en partie', 'C', 'Reçu inférieur à l’attendu.', 'Attendu − reçu, une fois par visuel (RG-003)'],
      ['Affiches reçues, validation admin à confirmer', 'C', 'Tout est reçu pour ce visuel, au moins une affiche reste à confirmer par la Coordination. Après la réception, plus après la préparation (option A, 02/11).', 'Validation admin des affiches du visuel (`affiche.validationAdmin`)'],
      ['Prêt, en production', 'C', 'Tout est reçu ; l’unité est prête ou lancée.', 'Statut de l’unité'],
      ['Produit', 'C', 'Sorti de machine, pas encore colisé.', 'Statut de l’unité'],
      ['Expédié', 'C', 'Pris en charge par Geodis.', 'Colis expédié'],
      ['Livré', 'C', 'Preuve de livraison reçue.', '`tf_colis.date_livraison`, avec le correctif Geodis (DEM-007)'],
      ['Reste à recevoir, reste à faire, départ menacé', 'C', 'Les compteurs et repères qui accompagnent l’étape.', 'Règles RG-003, RG-007, RG-017 du dictionnaire'],
    ] },
    { g: 'Unité de production · train, UM, lot', ou: 'Déroulant, 2 m² fixe, Pliage, Bus', items: [
      ['À libérer', 'C', '2 m² fixe, pliage, bus : la préparation est reçue, la semaine n’est pas encore libérée vers l’atelier (pas de Go). Remplace le statut 0 « A traiter » de Circé pour ces lignes, qu’on confondait avec le dossier « À traiter » (02/11).', 'Aujourd’hui `tf_repart_calcul.rpc_statut = 0` (page « 2m² fixe › A traiter ») ; en cible, pas de libération enregistrée pour l’atelier et la semaine'],
      ['En attente d’affiches', 'C', 'Au moins un visuel de l’unité manque.', 'Reçu comparé au besoin de ses thèmes'],
      ['Prêt à produire', 'C', 'Tous les visuels sont reçus, ou fractionnés.', 'Même calcul'],
      ['En production', 'E', 'Fichier envoyé à la machine ou bagues imprimées : point de non-retour.', 'Export dans `tf_train_export`, statuts 9 et 10 ; impression des bagues : à vérifier', 'verif'],
      ['Produit', 'E', 'Sorti de machine. Les machines ne renvoient rien : quelqu’un le pose.', 'Statut 6 « Préparé » avec son vrai sens, ou une valeur nouvelle de `tr_statut`', 'sens'],
      ['Colisé · à expédier', 'E', 'Scanné dans un colis clos.', '`tf_UM_colis`, `tf_face_train.colis_id` ; statut 7'],
      ['Expédié, livré', 'E', 'Voir l’expédition.', '`tf_colis`'],
      ['Train de pré-test, d’entretien', 'E', 'Train créé par la Coordination.', 'Peut-être `instruction_train.tip_ins_code` ou `tf_face_train.ft_type`', 'verif'],
      ['Bague ou intitulé corrigé', 'C', 'Le texte imprimé diffère de celui de Broadcast (correction de la plateforme).', '`tf_UM.UM_theme`, `tf_face_train.theme` comparés à Broadcast'],
      ['Bague réimprimée N fois', 'N', 'Combien de fois une bague a été réimprimée (colis perdu).', 'Rien ne le garde : un événement au journal'],
      ['Main rendue', 'N', 'Le dossier a été rendu à Broadcast (par mail).', 'Le mail part, mais rien ne garde qu’il est parti'],
    ] },
    { g: 'Réception · ligne attendue', ou: 'Réception › Réception des affiches, étape 1 (Réceptions attendues)', items: [
      ['Attendue', 'C', 'Rien de reçu pour ce visuel.', 'Reçu = 0 ; Circé affiche aujourd’hui « Partiel » (`DefaultLivraisonModel.cs:37`)'],
      ['Partielle', 'C', 'Reçu inférieur à l’attendu.', 'Aujourd’hui « Partiel » ; Circé compare l’attendu à la somme des mouvements, c’est-à-dire au stock (`Fn_GetPrepaAffiche.sql:217-218`)'],
      ['Complète', 'C', 'Tout est reçu.', 'Aujourd’hui « Terminé » (reçu ≥ théorique)'],
      ['Surplus', 'C', 'Plus de 10 % au-delà de l’attendu (seuil paramétrable).', 'Reçu comparé à `Qte_Theorique` et au seuil d’écart'],
      ['Contrôle : à contrôler, contrôlée', 'C', 'Où en sont les affiches déjà reçues de la ligne ; contrôlée, la feuille de stock se réimprime depuis la ligne.', 'Se déduit du contrôle de la palette (ligne « À contrôler » plus bas)'],
    ] },
    { g: 'Réception · palette (un BL = une réception)', ou: 'Réception › Réception des affiches, étapes 1 et 2', items: [
      ['À identifier (réception inconnue)', 'N', 'Réception inconnue rangée en zone tampon, pas encore rattachée : elle n’entre pas dans le sas.', 'Pas de statut sur `livraison` : à ajouter, avec le contrôle'],
      ['À contrôler (dans le sas)', 'N', 'La palette est arrivée, pas encore contrôlée.', 'Pas de statut sur `livraison` ; `mouvement.comptee` existe, sans usage connu : à vérifier', 'verif'],
      ['Contrôlée, et par qui', 'N', 'Comptée, rangée, contrôleur nommé.', 'Même manque ; le nom du contrôleur n’a pas de colonne (`livraison.controle_statut`, `controle_par`, `controle_le` en V2)'],
      ['Contrôle en retard', 'C', 'Plus de 24 h dans le sas (paramétrable), important au double.', '`livraison.DateLivraison` + le statut ci-dessus'],
      ['Réception inconnue', 'C', 'Aucun dossier trouvé pour ce BL.', 'Affiches non rattachées à une réception attendue'],
      ['Écart de comptage', 'C', 'Compté différent du BL de plus de 10 %.', 'Quantités de la réception'],
      ['Complément', 'C', 'Livraison en deux fois : même n° d’affiche, une livraison de plus.', '`asso_livraison_affiche.NumeroLivraison` (`LivraisonAfficheService.cs:481-490`)'],
      ['Photo du BL jointe', 'E', 'Photo obligatoire, elle pré-remplit le bon de livraison.', '`asso_livraison_photo`, `photo`'],
      ['Déchargée par', 'E', 'Qui a déchargé le camion.', '`livraison.Decharge_par` (aussi : expéditeur, imprimeur, colis, réf. DA)'],
      ['Non-conformité', 'N', 'Visuel non conforme, quantité, affiche abîmée, bandeau manquant…, notée au contrôle.', 'Pas de colonne ; à ouvrir dans l’appli Process Métier (lien à cadrer)'],
      ['Surplus compté en entretien', 'N', 'Affiches en plus de l’attendu, gardées pour l’entretien.', 'Pas de colonne'],
    ] },
    { g: 'Affiche · statut et tags', ou: 'Réception › Liste des affiches', items: [
      ['Affiche reçue', 'C', 'Une réception existe pour ce visuel.', 'Aujourd’hui posée par `validationAdmin` (ANO-05) ; en cible, un mouvement de réception'],
      ['Identifiée, orpheline', 'C', 'Rattachée à un dossier, ou pas.', '`tf_prepa_affiche.affiche_livraison_Id` ; en V2, une ligne active de `asso_affiche_visuel`'],
      ['À contrôler', 'N', 'Sa palette n’est pas contrôlée.', 'Même information que la palette'],
      ['Complément', 'C', 'Plusieurs livraisons sur le même n° d’affiche.', '`asso_livraison_affiche`'],
      ['Feuille à refaire', 'C', 'Le thème a changé après l’identification ; le tag tombe à la réimpression.', '`affiche.theme` comparé au thème de la préparation'],
      ['Feuille définitive à imprimer', 'C', 'Réception inconnue rattachée : la feuille temporaire est encore posée.', 'Type de feuille posée (ligne suivante) + rattachement'],
      ['Feuille de stock temporaire, définitive', 'N', 'Le type de la dernière feuille imprimée : temporaire (réception inconnue) ou définitive (dossier connu).', 'Pas de colonne : à ajouter, avec la date d’impression'],
      ['Zone tampon', 'C', 'Rangée dans l’allée des réceptions inconnues (X par défaut, paramétrable).', '`affiche.allee` comparée au paramètre'],
      ['N dossiers, multi-semaines', 'C', 'L’affiche sert plusieurs dossiers ou semaines.', 'Rattachements de l’affiche ; aujourd’hui `affiche.cont_num` « 123+456 »'],
      ['Emplacement', 'E', 'Allée et rayon.', '`affiche.allee`, `rayon`'],
      ['Rebut', 'E', 'Affiches abîmées retirées.', '`affiche.rebus`, `date_rebus`, et un mouvement'],
      ['Zone picking', 'E', 'Affiche en zone de picking.', '`affiche.zone_Picking`'],
      ['À conserver', 'E', 'Gardée après la campagne.', '`affiche.a_conserver`, `conservation`'],
    ] },
    { g: 'Réception inconnue', ou: 'Réception › Réceptions inconnues', items: [
      ['À identifier', 'C', 'Pas encore rattachée à un dossier ; feuille temporaire, zone tampon.', 'Aucun rattachement'],
      ['Introuvable : alerte à la Coordination', 'N', 'Personne ne retrouve le dossier : « Signaler à la Coordination » met une alerte (pas de mail) ; quand, par qui.', 'Rien ne garde le signalement : un événement au journal (`th_edr_evenement`)'],
      ['Rattachée, à contrôler', 'C', 'Le dossier est trouvé ; la palette passe dans le sas de Réception des affiches.', 'Rattachement + statut de la palette'],
      ['Contrôlée, feuille définitive à imprimer', 'C', 'Contrôle validé, la feuille définitive n’est pas encore imprimée.', 'Statut de la palette + type de feuille posée'],
      ['Rattachée, feuille définitive', 'C', 'Terminé.', 'Même calcul'],
      ['Candidats notés', 'C', 'Les dossiers proposés, par le visuel ou par n° de dossier, avec leur note.', 'Calculés à l’affichage, pas gardés'],
    ] },
    { g: 'Repères de Broadcast · dossier et face', ou: 'Dossiers, État des réservations vivant, unités', items: [
      ['Campagne contrôlée', 'B', '15 % d’entretien et visuel en tête de train.', 'Lue dans la procédure de l’état des réservations, pas gardée (DEM-001)'],
      ['Print Cityz', 'B', 'Affiches imprimées par Print Cityz.', 'Même cas (DEM-001)'],
      ['Reste en place', 'B', 'Face déjà en place, à ne pas reproduire.', 'Lu à la ligne de l’état des réservations, pas à la face (DEM-004)'],
      ['Ne pas afficher', 'B', 'Face à ne pas poser.', 'N’arrive pas dans Circé (DEM-004)'],
      ['OT fictif, type d’OT', 'B', 'Face provisoire, avant les vrais OT.', 'N’arrive pas dans Circé (DEM-009)'],
      ['Groupe', 'B', 'Lot de saisie des IP : deux saisies font deux groupes.', 'N’arrive pas dans Circé (DEM-010)'],
      ['Date d’affichage', 'B', 'Jour de pose de la face.', 'Seule la date du premier départ existe (DEM-004)'],
      ['Multi-semaines', 'C', 'Le dossier part sur plusieurs semaines.', 'Semaines de départ du dossier'],
    ] },
    { g: 'Vérification des thèmes et des annonceurs', ou: 'Pré-production › Vérification des thèmes', items: [
      ['Thème proche', 'C', 'Visuels identiques ou proches sur plusieurs dossiers d’un annonceur.', 'Règle de l’outil multi-rouleuse (RG-012)'],
      ['Annonceurs proches', 'C', '« Brasserie du Port » et « BRASSERIE PORT ».', 'Même règle, sur les noms d’annonceurs'],
      ['Modifié dans Broadcast', 'C', 'Thème changé après la validation.', 'Comparaison du texte, en attendant le n° de thème (RG-013)'],
      ['Écart BC / Circé', 'C', 'Quantité de Broadcast différente de celle de Circé.', 'RG-014'],
      ['Correction demandée', 'N', 'Le mail au gestionnaire est parti : quand, par qui.', 'Rien ne le garde'],
      ['Visuels différents, annonceurs différents', 'N', 'La Coordination a tranché : ce n’est pas une erreur.', 'Sans place, le cas réapparaît au calcul suivant'],
      ['Corrigé par Broadcast', 'C', 'La préparation renvoyée lève la demande.', 'Nouvelle préparation reçue'],
    ] },
    { g: 'Colis et départ', ou: 'Expédition', items: [
      ['Colis ouvert, clos', 'E', 'Le colis se remplit, puis il est fermé.', '`tf_colis.rpc_statut`'],
      ['Expédié', 'E', 'Pris en charge par Geodis (fin de journée).', '`tf_colis.colis_dat_expe`, `date_depart` ; aujourd’hui statut 8 « Terminé »'],
      ['Livré', 'E', 'Preuve de livraison reçue.', '`tf_colis.date_livraison`, `url_preuve_livraison` : vides aujourd’hui (`BacthCallZoomBll.cs:61`, DEM-007)'],
      ['Départ menacé', 'C', 'Le départ approche et l’unité n’est pas prête.', 'RG-017'],
      ['Sortie de stock à l’expédition', 'E', 'Les affiches expédiées sortent du stock d’elles-mêmes.', 'Un mouvement, dans `mouvement` ; aujourd’hui aucune sortie automatique'],
    ] },
    { g: 'Fin de campagne', ou: 'Stocks › Fin de campagne', items: [
      ['À décider', 'C', 'Du stock reste après le dernier départ.', '`affiche.date_dernier_depart` et le stock'],
      ['Garde-fou « campagne prévue »', 'C', 'Pas de destruction proposée si le visuel repart.', 'Lignes de préparation à venir'],
      ['À conserver jusqu’à S…', 'E', 'Décision de garder.', '`affiche.a_conserver`, `conservation` : sens exact à vérifier', 'verif'],
      ['À renvoyer, à détruire', 'N', 'La décision par dossier, avec qui et quand.', 'Pas de place aujourd’hui'],
      ['Renvoi fait', 'N', 'Les affiches sont reparties chez le client ou l’agence.', 'Pas de place aujourd’hui'],
      ['Destruction faite', 'E', 'Stock mis à zéro, mouvement tracé.', 'Un mouvement dans `mouvement`'],
      ['Sorti du stock', 'C', 'Plus rien en stock.', 'Stock = 0'],
    ] },
    { g: 'Alertes et paramétrage', ou: 'Pilotage › Alertes · Administration › Paramétrage', items: [
      ['Prise en compte', 'N', 'Quelqu’un a vu l’alerte et s’en occupe.', 'Sans place, l’alerte revient à chaque calcul'],
      ['Règles des alertes', 'N', 'Seuil, gravité, destinataires, canal.', 'Pas de table de paramètres'],
      ['Seuils métier', 'N', 'Entretien, comptage par morceau, purge, délai du sas, allée des réceptions inconnues…', 'Pas de table de paramètres'],
      ['Mails par plateforme', 'E', 'Les adresses qui reçoivent les mails.', '`tr_adresseMail_plateforme` (par plateforme, pas par rôle)'],
      ['Libellés des statuts', 'E', 'Les statuts cibles et leur correspondance.', '`tr_statut` : des valeurs ajoutées, pas de colonne'],
    ] },
  ];
  /** Lignes du catalogue, plus une ligne par type d'alerte (calculé ; déclencheur et destinataires de la règle). */
  function lignesCatalogue() {
    const rows = [];
    CATALOGUE.forEach(gr => gr.items.forEach(([n, t, d, s, f], i) => rows.push({ k: gr.g + '|' + i, g: gr.g, ou: gr.ou, n, t, d, s, f })));
    REGLES.filter(r => r.canal !== 'Désactivée').forEach(r => rows.push({ k: 'AL|' + r.type, g: 'Alertes · une par type', ou: 'Pilotage › Alertes', n: M.ALERT_TYPES[r.type] || r.label, t: 'C', d: r.declencheur, s: 'Pour : ' + r.dest + ' · ' + r.canal }));
    return rows;
  }
  /** Texte avec des `noms de table` en police à chasse fixe. */
  const avecCode = s => h('span', null, String(s || '').split('`').map((p, i) => (i % 2 ? h('code', null, p) : p)));
  const origine = t => h('span', { class: 'cz-orig o-' + t, title: ORIGINES[t].aide }, ORIGINES[t].label);

  M.screen({
    id: 'parametrage', title: 'Paramétrage', icon: '⚑', nav: 'Paramétrage', roles: ['admin'],
    // REC-15 et AUT-01 (mail au commercial) : refusés le 14/10, la règle reste visible et désactivée
    needs: ['REC-14', 'REC-12', 'REC-21', 'CIB-03', 'FP-01', 'FP-02', 'PP-04', 'PP-05', 'REC-05', 'BUS-01', 'CIB-15'],
    asis: ['Règles codées en dur : 20 tiroirs (TrainPreparationBll.cs:22), 6 thèmes par train (:23), entretien 8 % par défaut (p_integ_instructions.sql)', 'Statuts partagés dans une seule table, codes 0 à 10 (Enums.cs:50-75)', 'Droits qui masquent seulement les menus, sans contrôle côté serveur'],
    render(root, params) {
      // Rubrique choisie dans le menu du haut (Administration › Paramétrage) : pas d'onglets dans la page
      const VUES = { ateliers: 'Sites, ateliers et gammes', machines: 'Machines et fichiers', statuts: 'Statuts', alertes: 'Alertes et mails', regles: 'Règles métier', transport: 'Transport', referentiels: 'Référentiels', journal: 'Journal' };
      const tab = VUES[params.tab] ? params.tab : 'ateliers';
      root.append(
        ui.pageHead({ crumb: 'Administration · Paramétrage', title: VUES[tab], sub: 'Ajouter un format, un site ou une machine par paramétrage, sans développement.', screen: 'parametrage' }));
      const sec = (title, body, sub) => ui.card({ title, sub, body, style: { marginBottom: '16px' } });

      if (tab === 'ateliers') {
        root.append(
          sec('Ateliers par site', ui.table({ id: 'p-ateliers', rows: M.ref.ateliers, search: false, columns: [{ key: 'site', label: 'Site', value: a => C.site(a.site).label }, { key: 'label', label: 'Atelier' }, { key: 'mode', label: 'Mode', value: a => a.mode === 'train' ? 'Trains (déroulant)' : 'Unitaire' }, { key: 'formats', label: 'Formats', value: a => a.formats.join(', ') }, { key: 'machines', label: 'Machines', value: a => a.machines.map(id => C.machine(id).label).join(', ') || 'Aucune' }, { key: 'cible', label: '', render: a => a.cible ? ui.tag('cible', 'cible') : '' }] }), 'un atelier = un site, un mode, des formats, des machines'),
          sec('Gammes de fabrication par mode', h('div', { class: 'stack', style: { gap: '10px' } }, GAMMES.map(g => h('div', null, h('b', null, g.mode), h('div', { class: 'pp-flow', style: { marginTop: '4px' } }, g.etapes.map((e, i) => [i ? h('span', { class: 'arr' }, '→') : null, ui.tag(e)]))))), 'les étapes et leurs statuts se paramètrent par mode'),
          ui.callout('warning', 'À confirmer', ' Le code existant contient un atelier « Nîmes Pliage 12M2 » (Enums.cs:249-269) et des sites « DBG » et « DBG Lyon », absents des decks. La maquette suit la réponse du 13/10 : colle à Wissous seulement.'));
      } else if (tab === 'machines') {
        root.append(
          ui.annot('Les règles de chaque machine sont des paramètres, sur le principe de regles.toml de l’outil Projet 1 : ajouter une machine revient à remplir une ligne.', ['FP-01', 'FP-02', 'CIB-10']),
          sec('Machines', ui.table({ id: 'p-machines', rows: M.ref.machines, search: false, columns: [{ key: 'label', label: 'Machine' }, { key: 'type', label: 'Type' }, { key: 'fichier', label: 'Fichier', value: m => m.fichier ? 'Oui' : 'Non' }, { key: 'tiroirs', label: 'Tiroirs max', align: 'num', value: m => m.tiroirs || '' }, { key: 'sortie', label: 'Format de sortie' }, { key: 'repertoire', label: 'Dépôt', value: m => m.repertoire || '—' }, { key: 'bagues', label: 'Bagues' }] })),
          sec('Critères d’ordonnancement par atelier', h('div', { class: 'grid cols-3' }, Object.entries(M.PARAMS.criteres).map(([k, list]) => h('div', null, h('b', null, k === 'train' ? 'Trains (2 et 8 m²)' : k === 'fixe' ? '2 m² fixe' : 'Pliage'), h('ol', { style: { margin: '6px 0 0 18px', padding: 0 } }, list.map(c => h('li', null, c)))))), 'repris de la slide 73 ; réordonnables dans le générateur'));
      } else if (tab === 'statuts') {
        // Tous les statuts et tags (22/10) : d'abord le catalogue complet, puis la correspondance avec les codes de tr_statut
        const rows = lignesCatalogue(), nb = t => rows.filter(r => r.t === t).length;
        const F = ui.filters({ id: 'p-catalogue', rows, defs: [
          { key: 'g', label: 'Domaine', options: M.uniq(rows.map(r => r.g)).map(v => ({ value: v, label: v })), get: r => r.g },
          { key: 't', label: 'Origine', options: Object.entries(ORIGINES).map(([v, o]) => ({ value: v, label: o.label })), get: r => r.t },
          { key: 'ou', label: 'Écran', more: true, options: M.uniq(rows.map(r => r.ou)).map(v => ({ value: v, label: v })), get: r => r.ou },
        ] });
        root.append(
          ui.annot('Tous les statuts et tags de la maquette, avec leur origine : calculé (rien à enregistrer), existe déjà dans Circé, vient de Broadcast, ou à ajouter dans la base (V2). Repris du document « Statuts et tags : calculés ou enregistrés » du 21/10, mis à jour avec la réception (sas, réception inconnue, feuille temporaire ou définitive, signalement à la Coordination, colonne Contrôle) et les types d’alerte. Libellés à valider en atelier.', ['CIB-03']),
          h('div', { class: 'grid cols-4', style: { marginBottom: '14px' } }, Object.entries(ORIGINES).map(([t, o]) => ui.card({ body: h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } }, origine(t), h('b', { style: { fontSize: '22px' } }, nb(t))), h('div', { class: 'small muted' }, o.aide)) }))),
          F.bar,
          sec('Statuts et tags · ' + rows.length + ' au total', ui.table({ id: 'p-catalogue', rows: F.apply(rows), rowKey: r => r.k, exportName: 'statuts-et-tags', maxHeight: '560px', empty: 'Aucun statut ni tag avec ces filtres.', columns: [
            { key: 'g', label: 'Domaine', wrap: true, maxWidth: 210 },
            { key: 'n', label: 'Statut ou tag', wrap: true, maxWidth: 230, render: r => h('span', null, h('b', null, r.n), r.f === 'verif' ? [' ', ui.tag('à vérifier', 'hyp')] : r.f === 'sens' ? [' ', ui.tag('sens à revoir', 'hyp')] : null), value: r => r.n + (r.f === 'verif' ? ' (à vérifier)' : r.f === 'sens' ? ' (sens à revoir)' : '') },
            { key: 't', label: 'Origine', render: r => origine(r.t), value: r => ORIGINES[r.t].label },
            { key: 'd', label: 'Ce que ça veut dire', wrap: true, maxWidth: 340 },
            { key: 's', label: 'Où c’est dans Circé, ou ce qu’il manque', wrap: true, maxWidth: 380, render: r => avecCode(r.s), value: r => String(r.s || '').replace(/`/g, '') },
            { key: 'ou', label: 'Écran', hidden: true },
          ] }), 'un clic sur « Exporter » donne la liste en Excel'),
          sec('Codes de tr_statut : correspondance existant → cible', h('div', { class: 'table-wrap tall' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Code', 'Statut existant', 'Utilisé pour', 'Statut cible', 'Commentaire'].map(x => h('th', null, x)))), h('tbody', null, MAPPING.map(r => h('tr', null, h('td', null, r[0]), h('td', null, r[1]), h('td', { class: 'small' }, r[2]), h('td', null, h('b', null, r[3])), h('td', { class: 'small muted' }, r[4]))))))),
          sec('Statuts cibles des dossiers, unités et colis (libellés paramétrables)', h('div', { class: 'row', style: { gap: '8px' } }, Object.keys(M.STATUTS).map(k => ui.pill(k)))));
      } else if (tab === 'alertes') {
        root.append(
          ui.annot('Chaque alerte : un déclencheur, un seuil, une gravité, des destinataires par rôle et un canal (bandeau, mail immédiat, digest du matin). Les destinataires des rajouts après préparation sont fixés par RP34 (Q10 réglée) et gérés par liste de distribution.', ['PP-03', 'REU-04', 'SCR-08', 'REC-16']),
          sec('Règles d’alerte', ui.table({ id: 'p-alertes', rows: REGLES, rowKey: r => r.type, search: false, columns: [{ key: 'type', label: 'Alerte', value: r => M.ALERT_TYPES[r.type] || r.label, render: r => h('span', null, M.ALERT_TYPES[r.type] || r.label, r.type === 'MAIL_COMMERCIAL' ? [' ', ui.tag('refusé le 14/10', 'hyp')] : null) }, { key: 'declencheur', label: 'Déclencheur', wrap: true, maxWidth: 300 }, { key: 'seuil', label: 'Seuil', wrap: true, maxWidth: 220 }, { key: 'dest', label: 'Destinataires', wrap: true, maxWidth: 260 }, { key: 'canal', label: 'Canal', render: r => ui.select({ value: r.canal, options: ['Bandeau', 'Bandeau + mail', 'Bandeau + mail immédiat', 'Bandeau + digest 7h', 'Désactivée'].concat([r.canal]).filter((v, i, a) => a.indexOf(v) === i), onChange: v => { r.canal = v; M.journal(r.type, 'Canal d’alerte : ' + v); } }) }] })),
          sec('Listes de distribution', ui.table({ id: 'p-listes', rows: LISTES, rowKey: r => r.liste, search: false, columnsMenu: false, columns: [{ key: 'liste', label: 'Liste' }, { key: 'dest', label: 'Destinataires (rôles)', wrap: true, maxWidth: 340 }, { key: 'usage', label: 'Utilisée par', wrap: true, maxWidth: 300 }] }), 'RP34 : gérées dans Administration ; des rôles, pas de noms'),
          sec('Mails existants dans le code', h('div', { class: 'table-wrap' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Mail', 'Aujourd’hui', 'Cible'].map(x => h('th', null, x)))), h('tbody', null, EXISTANTS.map(r => h('tr', null, r.map(x => h('td', null, x)))))))));
      } else if (tab === 'regles') {
        const P = M.PARAMS;
        root.append(
          sec('Entretien', h('div', { class: 'grid cols-3' },
            ui.field('Grain de calcul', ui.select({ value: P.entretien.grain, options: [{ value: 'afficheur', label: 'Afficheur (cible, REU-06)' }, { value: 'ville', label: 'Annonceur / thème / ville (existant)' }], onChange: v => { P.entretien.grain = v; } })),
            ui.field('Pas d’entretien en dessous de (affiches)', ui.input({ type: 'number', value: P.entretien.seuil, onChange: v => { P.entretien.seuil = Number(v); ui.toast('Seuil enregistré (s’applique aux prochaines préparations).'); } })),
            ui.field('Arrondi', ui.select({ value: P.entretien.arrondi, options: ['supérieur', 'au plus proche'], onChange: v => { P.entretien.arrondi = v; } }))), 'PP-04, PP-05 (quid des quantités < 10 ?)'),
          sec('Réception', h('div', { class: 'grid cols-3' },
            ui.field('Écart signalé au-delà de (%)', ui.input({ type: 'number', value: Math.round(P.ecartReception * 100), onChange: v => { P.ecartReception = Number(v) / 100; M.refresh(); } })),
            ui.field('Purge automatique des réceptions attendues après (semaines ; sauf conservation à l’année)', ui.input({ type: 'number', value: P.purgeAttendues, min: 1, onChange: v => { P.purgeAttendues = Math.max(1, Number(v) || 4); const n = M.calc.purgerAttendues(); if (n) ui.toast(n + ' réception(s) attendue(s) purgée(s).', 'good'); M.refresh(); } })),
            ui.field('Délai de contrôle des palettes du sas (heures ; alerte au-delà, à fixer)', ui.input({ type: 'number', value: P.delaiControle, min: 1, onChange: v => { P.delaiControle = Math.max(1, Number(v) || 24); M.refresh(); } })),
            ui.field('Comptage manuel par morceau si quantité < (seuil « xx » de S20, à fixer)', ui.input({ type: 'number', value: P.comptageMorceau, min: 1, onChange: v => { P.comptageMorceau = Math.max(1, Number(v) || 30); M.refresh(); } })),
            ui.field('Feuilles de stock : exemplaires imprimés au contrôle (2 en S20 : palette et Coordination)', ui.input({ type: 'number', value: P.exemplairesFeuille, min: 1, max: 5, onChange: v => { P.exemplairesFeuille = Math.min(5, Math.max(1, Number(v) || 2)); M.refresh(); } })),
            ui.field('Allée des réceptions inconnues (zone tampon, en attente d’identification ; proposée à la saisie)', ui.input({ value: P.alleeInconnues, onChange: v => { P.alleeInconnues = String(v || '').trim().toUpperCase() || 'X'; M.refresh(); } })))),
          sec('Fichiers multi-rouleuse (règles de l’outil Projet 1)', h('div', { class: 'grid cols-2' },
            h('div', null, h('b', null, 'Regroupements d’enseignes'), h('ul', null, P.regroupements.map(r => h('li', { class: 'mono' }, '"' + r.motif + '" = "' + r.valeur + '"'))), ui.btn('+ Ajouter un regroupement', () => { P.regroupements.push({ motif: '*NOUVELLE ENSEIGNE*', valeur: 'NOUVELLE ENSEIGNE' }); M.refresh(); }, { small: true })),
            ui.field('Seuil de similarité des thèmes proches (fichiers et vérification des thèmes)', ui.input({ type: 'number', value: P.seuilThemesProches, onChange: v => { P.seuilThemesProches = Number(v); } })))),
          sec('Fin de campagne (stock)', h('div', { class: 'grid cols-3' },
            // Délai avant destruction par format (RP32 #4) : 4 semaines au 2 m², 2 au 8 m² faute de place ; « revoir CGV 2027 ? »
            ui.field('Destruction proposée au 2 m², MUI compris (semaines après le dernier départ)', ui.input({ type: 'number', value: P.finCampagne.delai['2 m²'], min: 1, onChange: v => { P.finCampagne.delai['2 m²'] = Math.max(1, Number(v) || 4); M.refresh(); } })),
            ui.field('Destruction proposée au 8 m², faute de place (semaines)', ui.input({ type: 'number', value: P.finCampagne.delai['8 m²'], min: 1, onChange: v => { P.finCampagne.delai['8 m²'] = Math.max(1, Number(v) || 2); M.refresh(); } })),
            ui.field('Destruction proposée pour les autres formats (semaines)', ui.input({ type: 'number', value: P.finCampagne.delai.autres, min: 1, onChange: v => { P.finCampagne.delai.autres = Math.max(1, Number(v) || 4); M.refresh(); } })),
            ui.field('Points d’attention (décision un par un)', ui.input({ value: P.finCampagne.attention.join(', '), onChange: v => { P.finCampagne.attention = v.split(',').map(s => s.trim().toUpperCase()).filter(Boolean); M.refresh(); } })),
            ui.field('Conservation proposée', h('div', { class: 'small' }, 'MUI : « flag conservation » pour la Ville de Paris (R28 #9, RP32 #3)')),
            ui.field('Garde-fou', h('div', { class: 'small' }, 'Pas de destruction proposée tant que le visuel a une campagne prévue (RP32 #4) ; la destruction faite se confirme par une coche'))), 'REC-21, REC-24 ; délais à revoir avec les CGV 2027 ; règles BDX et MUI à confirmer'),
          sec('Trains', h('div', { class: 'grid cols-2' },
            ui.field('Positions maximum par train', ui.select({ value: '4', options: [{ value: '4', label: '4 (deck, S7)' }, { value: '6', label: '6 (code existant, TrainPreparationBll.cs:23)' }] })),
            ui.field('Tiroirs Vendôme (bloquant)', ui.input({ type: 'number', value: 20 })),
            ui.field('Instruction OK automatique', h('div', { class: 'small' }, 'Quand le commentaire de préparation est vide et que le nombre d’exceptions est égal à la quantité : répartition et entretien repris de Broadcast. Sinon, à la main par la Coordination (RP31, SCR-11, règle du 26/10)')),
            ui.field('Campagne contrôlée', h('div', { class: 'small' }, '15 % d’entretien et visuel en début de train (R25, RP31)'))), 'règles à trancher en atelier'));
      } else if (tab === 'transport') {
        const boucles = M.groupBy(M.ref.destinataires.filter(d => d.site !== 'NAN'), d => d.site + '|' + d.boucle);
        root.append(
          ui.annot('Un seul transporteur : Geodis, pour le milk run comme pour la messagerie (réponse du 13/10). Le code colis Circé sert de référence d’envoi ; suivi et preuve de livraison reviennent sur le colis.', ['CIB-15']),
          sec('Boucles et horaires de départ', h('div', { class: 'table-wrap' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Plateforme', 'Boucle', 'Canal', 'Départ', 'Destinations'].map(x => h('th', null, x)))),
            h('tbody', null, Object.entries(boucles).map(([k, ds]) => { const [site, b] = k.split('|'); const d = ds[0]; const jours = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.', 'lun. S']; return h('tr', null, h('td', null, C.site(site).label), h('td', null, b), h('td', null, M.ref.canaux[d.canal]), h('td', null, jours[d.jour] + (d.jour < 7 ? ' S-1 ' : ' ') + String(d.hh).padStart(2, '0') + 'h' + String(d.mm).padStart(2, '0')), h('td', null, ds.map(x => x.label).join(', '))); }))))));
      } else if (tab === 'referentiels') {
        root.append(
          // Où paramétrer un imprimeur, un livreur, un agent de réception (REC-14) : les listes proposées à la saisie d'une réception
          h('div', { class: 'grid cols-3' },
            sec('Imprimeurs', h('div', null, h('ul', null, M.ref.imprimeurs.map(i => h('li', null, i))), ui.btn('+ Ajouter un imprimeur', () => { const n = 'Nouvel imprimeur ' + (M.ref.imprimeurs.length + 1); M.ref.imprimeurs.push(n); M.journal('imprimeurs', 'Ajout : ' + n); M.refresh(); }, { small: true }), ' ', ui.chips(['REC-14']))),
            sec('Livreurs (transporteurs à la réception)', h('div', null, h('ul', null, M.ref.transporteursEntrants.map(i => h('li', null, i))), ui.btn('+ Ajouter un livreur', () => { const n = 'Nouveau livreur ' + (M.ref.transporteursEntrants.length + 1); M.ref.transporteursEntrants.push(n); M.journal('livreurs', 'Ajout : ' + n); M.refresh(); }, { small: true }), ' ', ui.chips(['REC-14']))),
            sec('Agents de réception (contrôleurs)', h('div', null, h('ul', null, M.ref.controleurs.map(i => h('li', null, i))), ui.btn('+ Ajouter un agent', () => { const n = 'Nouvel agent ' + (M.ref.controleurs.length + 1); M.ref.controleurs.push(n); M.journal('agents de réception', 'Ajout : ' + n); M.refresh(); }, { small: true }), ' ', ui.chips(['REC-14', 'REC-12'])), 'proposés dans la liste « Contrôleur » de la réception')),
          sec('Destinataires et afficheurs', ui.table({ id: 'p-dest', rows: M.ref.destinataires, search: true, columns: [{ key: 'site', label: 'Site', value: d => C.site(d.site).label }, { key: 'label', label: 'Destinataire' }, { key: 'boucle', label: 'Boucle' }, { key: 'aff', label: 'Afficheurs', value: d => M.data.afficheurs.filter(a => a.dest === d.id).map(a => a.label).join(', ') }] })),
          sec('Rouleurs', h('div', null, M.data.operateurs.map(o => ui.tag(o.label + ' · ' + C.site(o.site).label + ' · ' + o.poste)))));
      } else {
        root.append(
          ui.annot('Tout ce qui a été lancé, modifié ou ajouté, par qui et quand : générations de fichiers, libérations, rendus de main, réceptions, alertes acquittées.', ['CIB-03', 'REC-06']),
          ui.card({ flush: true, body: ui.table({ id: 'p-journal', rows: M.data.journal.slice().sort((a, b) => b.date - a.date), rowKey: j => j.date.getTime() + j.objet + j.action, exportName: 'journal.csv', columns: [{ key: 'date', label: 'Date', render: j => M.fmt.dt(j.date), value: j => j.date.getTime() }, { key: 'user', label: 'Par' }, { key: 'objet', label: 'Objet' }, { key: 'action', label: 'Action', wrap: true }] }) }));
      }
    },
  });
})();
