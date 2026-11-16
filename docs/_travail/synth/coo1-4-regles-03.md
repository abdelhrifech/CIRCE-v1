### RG-COO-080 — Une seule ligne attendue active par clé (RG-AT-01)
- Origine : MODIFIÉE
- Énoncé : il existe au plus une ligne attendue ACTIVE par (plateforme × dossier × support × thème × bandeau × semaine ISO) ; la DA et l'atelier sont hors clé : leurs quantités s'additionnent sur la ligne. Index unique en base (avec un second index pour les lignes sans thème, avant IP). Toute insertion en conflit est une mise à jour (jamais un doublon). MODIFIÉE : legacy = aucune clé métier ni contrainte d'unicité ; `NOT EXISTS` sur des textes ; la quantité fait partie du regroupement (deux lignes de même clé et de quantités différentes ne s'additionnent pas) ; correctif « IT-62195 » : mise à jour des lignes Broadcast sans critère de thème (thème mélangé quand un dossier a deux thèmes) ; `MERGE` d'insertion qui ne matche jamais.
- Déclencheur : tout traitement qui crée ou met à jour une ligne attendue (RG-COO-082, 084, 086).
- Conditions : clé = identifiants (RG-COO-081) ; DA hors clé (version [RA] RG-AT-01, qui prévaut sur la clé de [PP] R1 incluant la DA : Q-207) ; `etat_ligne = ACTIVE`.
- Effet / message d'erreur : violation d'unicité = erreur technique jamais exposée (le service fusionne) ; test : deux lectures successives identiques ⇒ aucune ligne en plus, quantités inchangées ; deux DA du même dossier ⇒ une ligne, quantités additionnées.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:166-167,178-179,184-188,239-263,273-289` (ancien ID provisoire RG-COO-005, 006, 008) · spec [RA] §5 RG-AT-01 ; [DC] §12 ; [PP] §7 R1 (EX-COO-032) ; bdd.md §2.3, §7.5 ; EX-EXI-013, EX-EXI-014
- Questions liées : Q-207, Q-208, Q-226
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-081 — Rapprochement par identifiants, jamais par texte (RG-AT-02)
- Origine : MODIFIÉE
- Énoncé : la plateforme est rapprochée par `IdSiteCCF`, le support par `IdSurface` × `IdFormat`, le thème par `IdTheme` ; les textes (annonceur, thème, format) servent à l'affichage seulement. Sans n° de thème (Q-208) : le thème écrit est mis en forme (majuscules, espaces, accents normalisés) et une alerte est levée. MODIFIÉE : legacy = plateforme retrouvée par `LIKE` sur le nom du destinataire (erreur si plusieurs correspondances, `plt_id` nul si aucune ⇒ ligne recréée à chaque passage), `sup_id` = 0 si la correspondance surface × format manque (ligne écartée), thème et annonceur comparés en texte.
- Déclencheur : toute comparaison de lignes (alimentation, rattachement, arrivée de la prépa).
- Conditions : `IdSiteCCF` connu du référentiel plateformes ; `IdSurface`×`IdFormat` connu de `Transaco_Surface_Format`.
- Effet / message d'erreur : identifiant inconnu ⇒ la ligne n'est pas écartée silencieusement : alerte « donnée de référence manquante » (technique) et traitement poursuivi pour les autres lignes ; plusieurs plateformes pour un site ⇒ aucune sous-requête scalaire, jointure sur identifiant.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:134-136,187` ; `BLL/BatchAlimGetInstructionBc.cs:96-117` (ancien ID provisoire RG-COO-004) · spec [RA] §5 RG-AT-02 ; [DC] §12 (EX-COO-033) ; EX-EXI-013
- Questions liées : Q-208, Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-082 — Ligne « Broadcast » : créée ou mise à jour à chaque lecture (RG-AT-03)
- Origine : MODIFIÉE
- Énoncé : à chaque lecture de l'état des réservations (fenêtre de la semaine en cours à +8), tant que la prépa du dossier n'est pas envoyée, Circé crée ou met à jour la ligne attendue de source BC (`source = BC`, `qte_bc` = somme des lignes Broadcast de la clé hors « reste en place », `date_vue_bc` = date de lecture). Si la prépa est déjà envoyée (source PREPA), la lecture ne modifie pas `qte_prepa` (RG-COO-086).
- Déclencheur : traitement d'alimentation (RG-COO-103).
- Conditions : statut de préparation Broadcast ≠ « Envoyé » (ou nul) ; clé selon RG-COO-080 ; « reste en place » exclu de la somme (Q-209).
- Effet / message d'erreur : upsert ; la ligne n'est jamais supprimée (RG-COO-089). MODIFIÉE : legacy = `FromBroadcast = 1`, un seul champ de quantité, copie entière.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:126-130,157-188,194-235` (ancien ID provisoire RG-COO-003) · spec [RA] §5 RG-AT-03 (EX-COO-034) ; EX-EXI-013
- Questions liées : Q-209, Q-207
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-083 — Semaines ISO partout, fenêtre S à S+8 en dates
- Origine : MODIFIÉE
- Énoncé : toutes les semaines sont des semaines ISO 8601 (programme d'échange et traitements), la fenêtre d'alimentation S → S+8 est calculée en dates (lundi de la semaine courante + 8 semaines), sans cas particulier de fin d'année ni branche « fin d'année ». MODIFIÉE : legacy = `DATEPART(wk)` (semaines « américaines ») dans la procédure d'alimentation, culture de la machine côté C#, débordement de fin d'année qui donne une semaine de fin supérieure d'une unité au calcul arithmétique (ex. 50 + 8 ⇒ 7 au lieu de 6), branche de fin d'année invalide (colonne écrite deux fois) pouvant échouer dès mi-novembre.
- Déclencheur : toute lecture de fenêtre.
- Conditions : `weeks` = 8 (paramètre).
- Effet / message d'erreur : test : fenêtre du lundi 2026-12-14 = S51/2026 → S07/2027 ; semaine 53 ISO correctement gérée. L'action « vérifier la version en production avant mi-novembre » (EX-COO-042) est sur l'existant, hors lots.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:23-25,85-105,153-237` ; `SQL/Functions/Fn_GetPrepaAffiche.sql:42,277,315` ; `BLL/BatchAlimGetInstructionBc.cs:22-34,43-90` (ancien ID provisoire RG-COO-002, RG-INT-010) · spec [RA] §5 RG-AT-07 (EX-COO-038, EX-COO-042) ; EX-EXI-013
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-084 — Visuel provisoire avant les IP (RG-AT-04)
- Origine : NOUVELLE
- Énoncé : avant la saisie des IP, une seule ligne attendue au visuel « provisoire » est créée par (plateforme × dossier × support × semaine) ; le visuel provisoire est un visuel marqué `provisoire` (V2 `tr_visuel.provisoire`). Une réception sur cette ligne lève l'alerte « Réception sans IP » (RG-COO-071) et le motif de doute SANS_IP (RG-COO-006). L'agent saisit le thème (peut différer de celui des IP ; « le 1er qui a parlé » : intitulé de la première plateforme proposé à l'autre).
- Déclencheur : lecture de Broadcast sans thème pour la clé.
- Conditions : IP non saisies (thème nul dans Broadcast).
- Effet / message d'erreur : ligne `source = BC`, `IdTheme` nul, second index d'unicité (sans thème) ; legacy : la ligne sans thème est un thème « nul » qui s'écrase au retour (EX-EXI-014).
- Sources : spec [RA] §5 RG-AT-04, cas 1-3 ; [PP] §7 R3 (EX-COO-035) ; EX-EXI-014, EX-EXI-057 ; ateliers EX-REC-506 (A14 slide 24 #2) ; EX-THM-501
- Questions liées : Q-208
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-085 — Saisie des IP : fermeture du provisoire et déplacement de l'affiche rattachée
- Origine : NOUVELLE
- Énoncé : quand les IP sont saisies (lecture avec thèmes), la ligne provisoire est fermée (`etat_ligne = ANNULEE`, date de fermeture, jamais supprimée) et les lignes par thème sont créées. L'affiche rattachée à la ligne provisoire est déplacée seule vers la ligne du thème (lien retiré puis recréé avec qui/quand) s'il n'y a qu'un thème possible ou si le visuel du BL n'en désigne qu'un ; sinon la Coordination choisit (proposition `tf_edr_rapprochement`, motif THEME) ; aucun candidat : alerte. La purge des anciens thèmes des écrans de réceptions attendues s'applique aux lignes fermées.
- Déclencheur : lecture de Broadcast avec IP pour une clé ayant une ligne provisoire.
- Conditions : ligne provisoire active ; thèmes présents.
- Effet / message d'erreur : transaction unique fermeture + création + déplacement ; l'affiche déplacée repasse à confirmer si doute (RG-COO-006) ; historique des liens (RG-COO-088).
- Sources : spec [RA] §5 RG-AT-04, cas 1-3 ; [PP] §7 R3, R5 (EX-COO-035) ; ateliers EX-REC-504 (A14 slide 31 #5) ; EX-THM-504
- Questions liées : Q-208
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-086 — Arrivée de la prépa : la ligne bascule en source PREPA, les liens ne bougent pas (RG-AT-05)
- Origine : MODIFIÉE
- Énoncé : à l'arrivée de la prépa, la ligne de même clé passe en `source = PREPA` et `qte_prepa` est renseignée ; une alerte « écart DA / prépa » est levée si `qte_prepa ≠ qte_bc` ; une ligne n'est créée que si la clé n'existe pas ; les liens affiche ↔ ligne ne changent pas (R4). MODIFIÉE : legacy RG-COO-009 = la ligne `FromBroadcast = 1` repasse à NULL seulement si les textes (dossier, support, annonceur, année, semaine, thème) sont égaux ET que toutes les lignes du groupe sont « Broadcast » ; sinon une ligne de prépa est ajoutée à côté, sans affiche (source de doublons et d'orphelines) ; la quantité n'est pas recalculée à la bascule et l'écart n'est pas signalé.
- Déclencheur : intégration d'une prépa fixe/pliage (RG-COO-121) ou d'instructions/faces du déroulant (RG-COO-131).
- Conditions : ligne active de même clé ; pour le déroulant, moment de la bascule : Q-212.
- Effet / message d'erreur : `source: BC → PREPA`, `qte_prepa` ; alerte RG-COO-067 si écart ; test : une affiche rattachée reste rattachée après la bascule.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:291-354` (ancien ID provisoire RG-COO-009) · spec [RA] §5 RG-AT-05 ; [PP] §7 R4 (EX-COO-036) ; EX-EXI-019
- Questions liées : Q-212, Q-207
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-087 — Disparition ou annulation d'une ligne : ANNULEE, jamais supprimée (RG-AT-06)
- Origine : MODIFIÉE
- Énoncé : une ligne de source BC qui n'est plus vue par Broadcast passe `ANNULEE` après la lecture suivante (date de fermeture) ; elle n'est jamais supprimée (R2). Une alerte est levée à la Coordination si une affiche y est rattachée (RG-COO-032). Les lignes `ANNULEE` sont exclues du calcul des attendues et des quantités. MODIFIÉE : legacy = aucun statut d'annulation, aucune purge ni transition ; lignes de dossiers non relus jamais touchées.
- Déclencheur : lecture de Broadcast sans la ligne ; annulation de DA.
- Conditions : ligne `ACTIVE` non vue lors de la dernière lecture de la fenêtre ; la lecture suivante confirme (une absence unique ne ferme pas : délai d'une lecture).
- Effet / message d'erreur : `ACTIVE → ANNULEE` ; alerte si lien actif ; aucune alerte pour la purge automatique des attendues (EX-TRA-032).
- Sources : legacy `legacy-coordination.md §5.1` (« Annulée / supprimée : aucune transition ») · spec [RA] §5 RG-AT-06, cas 14 ; [PP] §6, §7 R2 (EX-COO-037) ; EX-TRA-032
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-088 — Lien affiche ↔ ligne : plusieurs-à-plusieurs avec quantité, retiré et recréé avec qui/quand (RG-AT-08)
- Origine : MODIFIÉE
- Énoncé : une affiche peut couvrir plusieurs lignes et une ligne peut être couverte par plusieurs affiches, avec une quantité par lien (`asso_affiche_visuel`) ; un lien retiré est conservé inactif avec qui/quand ; un lien est déplacé, jamais perdu, quand une ligne se ferme. La somme des quantités des liens actifs d'une affiche ne dépasse pas la quantité reçue (« La répartition (x) dépasse la quantité reçue (y). »). Rattachement manuel : seules les lignes non entièrement couvertes sont proposées. MODIFIÉE : legacy = une seule affiche par ligne (`affiche_livraison_Id`), sans quantité ; association aux seules lignes sans affiche (les autres sont ignorées sans message) ; dissociation sans contrôle de statut (même après validation) ; historique de dissociation écrit avec l'action d'association.
- Déclencheur : création de proposition, rattachement manuel, dissociation, fermeture de ligne.
- Conditions : somme des quantités ≤ quantité reçue ; ligne `ACTIVE` pour un nouveau lien.
- Effet / message d'erreur : 422 « La répartition (x) dépasse la quantité reçue (y). » ; 422 « Choisissez au moins un dossier et une quantité. » ; historique `AfficheAssocier` / `AfficheDissocier` distincts.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:533-555,577-586` ; `BLL/HistorisationBll.cs:68-76` ; `BLL/LivraisonAfficheService.cs:427-486` (ancien ID provisoire RG-COO-020, 022, 023 ; RG-REC-091, 092) · spec [RA] §4, §5 RG-AT-08 ; [PP] §7 ; [DC] §13 (EX-COO-039) ; EX-EXI-056 ; EX-REC-039
- Questions liées : Q-213, Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-089 — Une ligne attendue n'est jamais supprimée, elle est fermée avec une date (R2)
- Origine : NOUVELLE
- Énoncé : aucune opération (alimentation, purge fonctionnelle, correction) ne supprime physiquement une ligne attendue ayant (ou ayant eu) un lien ou une quantité ; la fermeture écrit `etat_ligne = ANNULEE` et une date de fermeture. (La purge automatique à 4 semaines hors « conservation à l'année » relève de la Réception : RG-REC.)
- Déclencheur : toute suppression demandée.
- Conditions : ligne avec historique.
- Effet / message d'erreur : 409 `{ regle: 'RG-COO-089' }` pour une suppression directe ; la fermeture est la seule voie.
- Sources : spec [PP] §7 R2 ; [RA] §5 (EX-COO-037) ; EX-TRA-032, EX-TRA-042
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-090 — Dédoublonnage initial des lignes attendues (reprise)
- Origine : NOUVELLE
- Énoncé : avant l'activation de l'index unique, les doublons existants sont traités : pour chaque clé en double, garder la ligne qui porte une affiche (ou, à défaut, la plus récente), reporter le rattachement des autres sur la ligne gardée, passer les autres en `ANNULEE`. Causes des doublons (à confirmer par les requêtes de la DSI) : correctif sans thème ; bascule ratée au texte ; découpage par champ invisible ; plateforme retrouvée par nom.
- Déclencheur : migration (étape 8/9, reprise de données).
- Conditions : clé selon RG-COO-080.
- Effet / message d'erreur : rapport de reprise (nombre de lignes fermées, liens reportés) ; aucune perte de lien.
- Sources : spec [RA] §2, §4 (EX-COO-041) ; legacy RG-COO-004, 005, 006, 008 (causes) ; bdd.md §10 (données legacy probablement incohérentes)
- Questions liées : Q-226, Q-213
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-091 — Copie de l'état des réservations Broadcast : image par dossier, lignes plus vues fermées
- Origine : MODIFIÉE
- Énoncé : un traitement lit l'état des réservations Broadcast (fenêtre RG-COO-083) et met à jour la copie `tf_prepa_Broadcast` : pour chaque dossier présent dans la lecture, la copie du dossier devient l'image de la lecture ; les lignes qui ne sont plus vues passent par la fermeture (RG-COO-087) au lieu d'être supprimées. Si la lecture est vide, rien n'est écrit. L'écriture est transactionnelle par dossier. `date_vue` est renseignée à chaque lecture. MODIFIÉE : legacy = suppression puis recréation de toutes les lignes de chaque dossier lu (ligne par ligne, sans transaction englobante : une panne laisse un dossier supprimé et partiellement recréé), dossiers non relus jamais purgés ; `sup_id` = 0 si pas de correspondance ; `repiquage` = `Bandeau` ; assistants « Nom Prénom » concaténés.
- Déclencheur : traitement d'alimentation (RG-COO-103).
- Conditions : lecture non vide ; transaction par dossier ; `IdThemeBandeau` copié (la variante Web API legacy ne le copiait pas).
- Effet / message d'erreur : erreur d'un dossier ⇒ rollback de ce dossier, journalisée, les autres dossiers poursuivent ; test : une panne simulée en milieu de dossier ne laisse aucune ligne partielle.
- Sources : legacy `BLL/BatchAlimGetInstructionBc.cs:47-65,92-129` ; `REP/LivraisonAfficheRepository.cs:328-361,364-369` (ancien ID provisoire RG-COO-001 ; RG-INT-011) · spec [RA] §4 ; [PP] §11 (EX-COO-043, EX-COO-046) ; EX-EXI-012
- Questions liées : Q-005, Q-211
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-092 — Colonnes de Broadcast conservées dans la copie
- Origine : MODIFIÉE
- Énoncé : la copie conserve `IdSiteCCF`, `IdSurface`, `IdFormat`, `IdPreparationChapeau`, `IdTypePreparation`, `EstResteEnPlace`, `date_vue` et, si Broadcast peut le fournir, `IdTheme` (demande formulée, Q-208) ; elles servent aux rapprochements par identifiant (RG-COO-081). Sont aujourd'hui perdus à la copie : site, surface, format (hors support), n° de prépa chapeau, reste en place, Print, campagne contrôlée, photo, description du thème (les trois derniers ne sont pas repris sans spec).
- Déclencheur : copie (RG-COO-091).
- Conditions : colonnes renvoyées par la procédure Broadcast `P_CirceEtatReservation_New`.
- Effet / message d'erreur : colonne attendue absente ⇒ erreur de lecture explicite journalisée (pas de valeur par défaut silencieuse).
- Sources : spec [RA] §4 ; bdd.md §7.5 (EX-COO-046) ; EX-EXI-012 ; legacy `BLL/BatchAlimGetInstructionBc.cs:96-117`
- Questions liées : Q-208
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-093 — Exclusions de l'alimentation : statut « Envoyé », plateformes Derichebourg, supports
- Origine : CONSERVÉE
- Énoncé : la source Broadcast n'alimente les attendues que si le statut de préparation Broadcast est différent de « Envoyé » (ou nul) et si le destinataire n'est ni « Plateforme Derichebourg Lyon » ni « Plateforme Derichebourg » (valeurs codées en dur dans le legacy ; paramétrables dans la cible, Q-227). Les lignes fixe/pliage et déroulant ne sont prises que si `rpc_statut ≠ 4`.
- Déclencheur : alimentation (RG-COO-082, 094).
- Conditions : voir énoncé.
- Effet / message d'erreur : lignes exclues non créées ; pas d'alerte.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:126-130,157-188` (ancien ID provisoire RG-COO-003) · spec [RA] §5 ; bdd.md §2.3
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-094 — Trois sources de lignes attendues : répartition fixe/pliage, faces du déroulant, copie Broadcast
- Origine : CONSERVÉE
- Énoncé : les lignes attendues proviennent de trois sources : (1) répartitions fixe/pliage (`tf_repart_calcul`, quantité = Σ `rpc_qte`), (2) faces du déroulant (`tf_face_train`, quantité = `count(ft_id)`, thème non nul), (3) la copie Broadcast (source BC, RG-COO-082). (1) et (2) sont les lignes « PREPA » (RG-COO-086). Conditions : `rpc_statut ≠ 4`, fenêtre S → S+8, départ futur.
- Déclencheur : alimentation.
- Conditions : (1)/(2) non annulées ; (2) thème non nul ⇒ la ligne PREPA du déroulant n'existe qu'une fois les faces thématisées (Q-212).
- Effet / message d'erreur : insertion dans la table de travail puis upsert (RG-COO-080) ; les lignes d'un statut 4 sont exclues.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:157-188,194-235` (ancien ID provisoire RG-COO-003) · spec [RA] §5 RG-AT-03/05 ; EX-EXI-013, EX-EXI-019
- Questions liées : Q-212
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-095 — Lignes « bandeau » dédiées (supports 100, 102, 105, 107)
- Origine : CONSERVÉE
- Énoncé : pour les supports 5, 26, 1026 (→ 100), 19 (→ 102), 27 (→ 105) et, côté trains, 29 (→ 107), des lignes attendues « bandeau » sont créées (quantité = Σ repiquage) ou mises à jour par (thème-repiquage, support, dossier, semaine, année, atelier) ; l'`ate_id` est celui du bandeau. Le bandeau fait partie de la clé (RG-COO-080).
- Déclencheur : alimentation.
- Conditions : `rpc_repiquage`/`repiquage` non nul ; `rpc_statut ≠ 4` ; fenêtre S → S+8.
- Effet / message d'erreur : upsert avec `ate_id` du bandeau ; correspondance supports → référentiel (Q-227).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:356-546` (ancien ID provisoire RG-COO-010) · spec [RA] §5 RG-AT-01 (bandeau dans la clé)
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-096 — Renseignement de la DA chapeau des lignes attendues
- Origine : CONSERVÉE
- Énoncé : une ligne nouvellement créée sans DA chapeau la reprend de la copie Broadcast par (dossier, semaine, année) ; la DA ne fait pas partie de la clé et plusieurs DA d'un même dossier s'additionnent (RG-COO-080). Le retour vers Broadcast envoie la ligne si `IdDAChapeau` est renseigné (RG-COO-134).
- Déclencheur : alimentation, après insertion.
- Conditions : `IdDAChapeau` nul.
- Effet / message d'erreur : mise à jour de `IdDAChapeau` ; legacy : une seule valeur pour tout le triplet quelle que soit la DA (cause d'imprécision : les DA sont conservées en liste dans la cible, Q-207).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:548-562` (ancien ID provisoire RG-COO-011) · spec [RA] §5 RG-AT-01
- Questions liées : Q-207
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-097 — Plus de drapeau « ARecevoir » à réarmer : le reçu est calculé
- Origine : MODIFIÉE
- Énoncé : le drapeau legacy `ARecevoir` (posé à la création de livraison ou au rattachement, réarmé par l'alimentation quand la prépa arrive sur une ligne déjà reçue, non remis à zéro à la dissociation) est remplacé par un statut calculé de la ligne : Attendue / Partielle / Complète / Surplus à partir des mouvements de réception des affiches rattachées (règle de la Réception, EX-REC-051). L'alimentation ne pose jamais « reçu » ; une ligne créée après réception est automatiquement « reçue » parce que ses liens existent. La liste des attendues d'une plateforme contient les lignes non reçues et les lignes partielles.
- Déclencheur : lecture de la ligne ; alimentation (aucun effet de bord).
- Conditions : reçu = Σ mouvements des affiches liées (stock = somme des mouvements).
- Effet / message d'erreur : test : après dissociation du dernier lien, la ligne redevient « Attendue » (le legacy la laissait « reçue »).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:139-149,267-271` ; `SQL/Functions/Fn_GetPrepaAffiche.sql:44-103,106-221,224-343` (ancien ID provisoire RG-COO-007, 013, 023) · spec [DC] §9 (« ce qui se calcule ne se coche jamais ») ; EX-REC-050, EX-REC-051, EX-REC-052 ; bdd.md §4.3
- Questions liées : Q-213
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-098 — Même thème sur plusieurs dossiers : une ligne par dossier
- Origine : NOUVELLE
- Énoncé : un même thème présent sur plusieurs dossiers donne une ligne attendue par dossier ; le surplus d'une affiche est proposé à l'autre dossier, la Coordination confirme ; le reçu est compté une seule fois (RG-X-060). Un visuel commun à 33 dossiers : l'affiche est rattachée à tous les dossiers par rattachements manuels (sans limite de nombre de dossiers) avec une quantité chacun.
- Déclencheur : réception d'une affiche dont le visuel est commun ; rattachement manuel.
- Conditions : même `IdTheme` ou visuel commun (motif MULTI).
- Effet / message d'erreur : proposition en doute (MULTI, RG-COO-006) ; confirmation explicite requise.
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-EXI-058 (3) ; EX-REC-048
- Questions liées : Q-208
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-099 — Affiches en plus pour un autre dossier : rattachement manuel du seul surplus
- Origine : NOUVELLE
- Énoncé : des affiches reçues en plus pour un autre dossier se rattachent à la main (historisé, même après la validation ou le début de production) ; seul le surplus est rattaché ; pour une autre plateforme : transfert puis réception. Effet du rattachement sur les validations existantes de l'affiche : voir RG-X-052 (HYPOTHÈSE Q-202 : les validations déjà faites ne sont pas retirées).
- Déclencheur : « + Rattacher à un autre dossier » (fiche affiche).
- Conditions : quantité rattachée ≤ surplus de l'affiche ; ligne cible active.
- Effet / message d'erreur : lien actif avec `mode = MAIN`, historique avec qui/quand ; 422 si le total dépasse la quantité reçue.
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-EXI-058
- Questions liées : Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-100 — Dossier sur deux plateformes : une ligne par plateforme
- Origine : NOUVELLE
- Énoncé : un dossier livré sur deux plateformes a une ligne attendue par plateforme ; les destinataires ne multiplient pas les lignes (le grain de la ligne est plateforme × support, pas destinataire). Dans la maquette, le dossier de la 2e plateforme porte un identifiant de suffixe distinct (`…-W`) avec le dossier mère en référence.
- Déclencheur : alimentation.
- Conditions : plateformes distinctes pour un même `cont_num`.
- Effet / message d'erreur : deux lignes actives pour des plateformes différentes autorisées par RG-COO-080 ; le reçu n'est pas réparti par destinataire (Q41 d'origine).
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; écran ECR-PIL-03 (données MOCK)
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-101 — Dossier multi-semaines : quantité comptée une fois
- Origine : NOUVELLE
- Énoncé : un dossier à deux semaines de départ n'a ses quantités comptées qu'une fois dans l'état des réservations ; le tag « multi-semaines » (fond jaune en Réception) signale le cas. Anomalie corrigée : « quantités doublées dans l'état des réservations lorsqu'il y a 2 semaines de départ » (ANO-02).
- Déclencheur : lecture de l'état des réservations ; totaux.
- Conditions : lien affiche ↔ plusieurs semaines (`tf_dossier_semaine_depart`).
- Effet / message d'erreur : test : dossier S43+S44 de quantité 100 ⇒ attendu total 100.
- Sources : ateliers EX-TRA-515 (S L31, ANO-02) ; maquette ECR-PIL-03 (données MOCK, « quantité d'un dossier sur 2 semaines comptée une fois ») ; bdd.md §2.4
- Questions liées : Q-207
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-102 — Atomicité et idempotence de l'alimentation
- Origine : MODIFIÉE
- Énoncé : l'alimentation d'un lot est transactionnelle (par dossier ou par flux) et idempotente : rejouer le même lot ne crée aucune ligne ni quantité supplémentaire (clé RG-COO-080, `Idempotency-Key` de lot pour les déclenchements manuels). Les erreurs sont testées après chaque bloc (et non une seule fois en fin de procédure). MODIFIÉE : legacy = transaction de la procédure dont l'erreur n'est testée qu'en fin (rollback seulement si la dernière instruction a échoué), sauvegarde ligne par ligne sans transaction englobante.
- Déclencheur : tout passage d'alimentation (RG-COO-103), déclenchement manuel.
- Conditions : un seul passage actif à la fois (verrou) ; `version` pour les mises à jour.
- Effet / message d'erreur : 409 si un passage est déjà en cours ; journalisation (RG-COO-116).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:151,566-588` ; `BLL/BatchAlimGetInstructionBc.cs` (ancien ID provisoire RG-COO-012 ; confiance INCERTAINE) · règle projet CLAUDE.md §6 (atomicité) ; spec [RA] §5
- Questions liées : Q-005, Q-211
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-103 — Planification de l'interrogation de Broadcast
- Origine : NOUVELLE
- Énoncé : Circé interroge Broadcast à intervalles réguliers (pas d'événement « DA activée » à écouter) : le traitement d'alimentation lit l'état des réservations et les flux de préparation à des horaires paramétrables, par défaut toutes les 2 heures de 8 h à 18 h (8 h, 10 h, 12 h, 14 h, 16 h, 18 h d'après l'équipe) ; une exécution manuelle est possible pour l'administrateur. La planification réelle du legacy est inconnue (aucun job versionné).
- Déclencheur : horloge de l'API (planificateur interne) ; action manuelle.
- Conditions : horaires paramétrables ; un seul passage à la fois (RG-COO-102).
- Effet / message d'erreur : journal du passage (début, fin, lignes lues/créées/fermées, échec) ; alerte technique si deux passages consécutifs échouent.
- Sources : spec [PP] §11 ; [DC] §12 ; EX-TRA-039 (EX-COO-043) ; EX-EXI-012 (« 2 màj/jour » atelier 14 vs toutes les 2 h) ; legacy RG-INT-013 (aucun appelant dans le dépôt)
- Questions liées : Q-005, Q-211
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-104 — Données reçues de Broadcast (cinq flux)
- Origine : MODIFIÉE
- Énoncé : Circé reçoit de Broadcast : (1) l'état des réservations (copie, S à S+8, par dossier × DA × destinataire × thème/bandeau × format × semaine, avant la prépa) ; (2) les réceptions attendues « Broadcast » calculées (RG-COO-082) ; (3) la prépa fixe/pliage (lundi ; un renvoi est rejeté tant que la précédente n'est pas débloquée, RG-COO-122) ; (4) les faces des trains (un renvoi remplace, sauf Instruction OK faite : RG-COO-129) ; (5) instructions/exceptions/commentaire (dossier « En cours »). Circé ne peut pas écrire dans Broadcast (hors accusé d'intégration et déblocage, RG-COO-125, 145).
- Déclencheur : passages d'alimentation.
- Conditions : voir flux.
- Effet / message d'erreur : voir règles liées ; lien retour « reçue et associée » (RG-COO-024).
- Sources : spec [PP] §11 ; [DC] §12 ; relevé §12 (EX-COO-043) ; EX-TRA-039 ; legacy RG-INT-006, 007
- Questions liées : Q-005, Q-211
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-105 — Ligne de production du suivi de prod : n'existe qu'avec la prépa (RG-SP-01)
- Origine : NOUVELLE
- Énoncé : une ligne de production n'existe qu'avec la prépa ; quand elle arrive, l'affiche déjà validée y apparaît avec son n° d'affiche ; la jointure se fait par n° de thème (identifiant, Q-208). Les attendues « Broadcast » n'apparaissent pas dans le suivi de production.
- Déclencheur : arrivée de la prépa ; lecture du suivi de production.
- Conditions : ligne `source = PREPA` ; affiche `VALIDEE`.
- Effet / message d'erreur : lecture ; ligne BC masquée (cohérent avec RG-COO-021).
- Sources : spec [RA] §5 RG-SP-01 (EX-COO-040) ; EX-EXI-060 ; legacy `SQL/p_s_adminSuiviRead.sql:64-67`
- Questions liées : Q-208, Q-212
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-106 — Suivi de production : affiches reçues, répartitions, faces, limité aux ateliers de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : le suivi de production présente les affiches reçues (rattachées à une ligne attendue de source PREPA, validées admin) puis les répartitions (`tf_repart_calcul` + UM), puis les faces de trains ; le statut d'une répartition est celui de l'UM si l'UM existe, sinon celui de `tf_repart_calcul` ; limité aux ateliers de l'utilisateur (RG-COO-167). Le détail des colonnes est du ressort du Pilotage (ECR-PIL-02).
- Déclencheur : lecture du suivi de production.
- Conditions : `validationAdmin = 1 AND source = PREPA` pour le n° d'affiche ; périmètre atelier.
- Effet / message d'erreur : lecture seule.
- Sources : legacy `SQL/p_s_adminSuiviRead.sql:64-67,72-115,117-136` ; `BLL/SuiviSuiviProductionBll.cs:112` (ancien ID provisoire RG-COO-030) · spec EX-EXI-060 ; [PP] §3
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-107 — État des réservations vivant : N° d'affiche ✓ / •, « Où en est-il » et grain
- Origine : MODIFIÉE
- Énoncé : l'état des réservations affiche tous les dossiers dont la DA est activée, de la semaine en cours aux suivantes, une ligne par dossier et thème ; colonne « N° d'affiche » (✓ validée, • proposé à confirmer) dès la réception ; « Où en est-il » (DA activée, IP saisies, prépa reçue, affiches attendues / reçues en partie, validation admin à confirmer, prêt/en production, produit, expédié, livré, annulé) ; « Afficher par » dossier, DA, thème, destinataire, afficheur, unité, colis, départ, format ; le reçu reste au visuel (pas par destinataire) ; un dossier compte à l'étape la moins avancée de ses lignes. MODIFIÉE : legacy = lecture de Broadcast en direct à chaque recherche avec seule colonne calculée par Circé « Aff. reçues ».
- Déclencheur : lecture de l'écran Pilotage › État des réservations.
- Conditions : périmètre RG-COO-108 ; détail d'écran : ECR-PIL-03 (autre module).
- Effet / message d'erreur : lecture seule.
- Sources : spec [README] §3 ; [DC] §15 (EX-COO-048) ; écran ECR-PIL-03 ; legacy `BLL/SuiviEtatReservationBll.cs:72-104,172-201` ; EX-EXI-010, EX-EXI-011
- Questions liées : Q-200, Q-231
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-108 — État des réservations : sites autorisés et plateformes gérées
- Origine : CONSERVÉE
- Énoncé : seules les lignes dont `IdSiteCCF` correspond à une plateforme gérée (Wissous, Nîmes, DBG, DBG Lyon ; sites 39, 40, 43, 44) rattachée aux ateliers de l'utilisateur sont affichées ; les lignes d'autres sites sont exclues. La liste des plateformes gérées est un référentiel (codée en dur dans le legacy).
- Déclencheur : lecture de l'état des réservations.
- Conditions : site autorisé = `id_site_ccf` des plateformes des ateliers de l'utilisateur ; choix du site dans le bandeau (EX-TRA-006).
- Effet / message d'erreur : filtrage ; ni exception ni alerte pour les lignes exclues.
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:72-104` ; `REP/SuiviEtatReservationRepository.cs:22-36` (ancien ID provisoire RG-COO-032) · spec EX-TRA-006 ; EX-EXI-003, EX-EXI-010
- Questions liées : Q-227
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-109 — Variante interactive : lecture Broadcast déclenchée depuis l'écran Réception (API PrepaAfficheBC)
- Origine : CONSERVÉE
- Énoncé : l'écran Réception propose de rafraîchir la copie Broadcast à la demande (appel de l'API `PrepaAfficheBC`) ; « à rafraîchir » si la dernière mise à jour a plus de 5 h ou est inconnue ; un code HTTP d'échec ne remonte aucune erreur (défaut : cible = message d'erreur explicite). Selon les docs de l'existant cette voie est du code mort (EX-EXI-012 : « L'ancienne voie Web API est du code mort ») ; applicabilité à trancher avant tout développement.
- Déclencheur : action utilisateur (Réception).
- Conditions : droit d'accès à l'écran Réception.
- Effet / message d'erreur : si conservée : exécution d'un passage d'alimentation limité aux dossiers de l'écran (RG-COO-091, 102) ; sinon non implémentée.
- Sources : legacy `BLL/LivraisonAfficheService.cs:864-926` ; `WEB/Web.config:52` (ancien ID provisoire RG-INT-012, RG-REC-081) · spec EX-EXI-012
- Questions liées : Q-228
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
