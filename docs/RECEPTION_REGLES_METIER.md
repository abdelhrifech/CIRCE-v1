# Règles métier — RECEPTION

Légende origine : CONSERVÉE (legacy = cible) · MODIFIÉE (spec change le legacy) · NOUVELLE (spec seule) · SUPPRIMÉE (spec la retire explicitement)

Conventions : IDs définitifs RG-REC-001…299 (numérotation avec trous : règles fusionnées). Les « anciens IDs provisoires » cités en sources sont ceux de `docs/_travail/legacy-*.md` (ils peuvent coïncider numériquement avec un ID définitif tout en désignant une autre règle). EX issus des ateliers : ID des notes **+500** (cf. Q-350). Chemins legacy abrégés : CTRL/, BLL/, REPO/, VIEW/, SP/, FN/, TOOLS/ = préfixes définis dans `docs/_travail/legacy-reception.md` (« Légende des chemins »). Rôles provisoires : Q-003.

## 1. Entités et données
Légende : (L) = colonne/table du schéma réel actuel (`bdd.md` §2) · (V2) = champ prévu par la cible (`[DC] §13`, EX-REC-080) · (maquette) = champ déduit des MOCK (à confirmer, jamais source de valeur définitive). « Obl. » = obligatoire ; « Cond. » = conditionnel. Les noms de colonnes de la V2 sont des PROPOSITIONS (la modélisation Prisma relève de l'étape 3).

| Entité | Champs clés | Obligatoire / conditionnel | Source |
|---|---|---|---|
| Réception (palette = BL) — table `livraison` (L) étendue | `id` ; n° de réception « R… » (maquette) ; `Reference` (n° de BL imprimeur = BL transporteur) ; `DateLivraison` ; `Imprimeur` ; `Expediteur` (= transporteur) ; `Nbre_colis` ; `Decharge_par` ; `Commentaire` ; `Ref_dossier` ; `Ref_DA` ; (V2) `controle_statut` (A_IDENTIFIER / A_CONTROLER / CONTROLEE) ; (V2) `controle_par` ; (V2) `controle_le` ; plateforme (absente du schéma réel : à ajouter, un BL = une plateforme) ; `a_controler_depuis` (horodatage d'entrée dans le sas, maquette) ; photo du BL (lien `asso_livraison_photo`) ; indicateur « réception inconnue » | Obl. à la validation : n° de BL, transporteur, imprimeur, photo du BL (sauf réception inconnue sans BL), date de livraison, nb colis ≥ 1 (maquette). Cond. : `controle_par` obligatoire à la validation du contrôle ; « Déchargé par » facultatif (maquette, Q-116) | legacy `bdd.md §2.2` ; `legacy-reception.md` RG-REC-074/079 ; `[DC] §4, §5, §13` (EX-REC-012, 026, 080) ; ECR-REC-01/02/06 |
| Ligne de réception (affiche reçue sur un BL) — `asso_livraison_affiche` (L) étendue | `Id_livraison` ; `Id_affiche_livraison` ; `id_affiche_initial_livraison` (fusion, legacy) ; `NumeroLivraison` (n° d'ordre de la livraison de l'affiche = nb d'associations + 1, legacy) ; (V2) quantité du BL ; indicateur « complément » ; mode de rattachement (BL / VISUEL / MAIN) | Obl. : réception, affiche, quantité du BL ≥ 0 (une ligne à 0 est ignorée, maquette). Cond. : complément = affiche déjà reçue en partie | legacy RG-REC-075 ; `[DC] §4, §10` (EX-REC-011, 016) ; ECR-REC-01 |
| Affiche (lot reçu d'un visuel pour une plateforme) — `affiche` (L) étendue | `affiche_id` (n° d'affiche, ex. 6 chiffres en maquette) ; `plt_id` ; `sup_id` (format) ; `date_entree` (= date de livraison) ; `cont_num` (n° de dossier, varchar(50), legacy) ; `cont_annonc` ; `theme` ; `repiquage` ; `semaines` (texte) ; `nombre_semaine` ; `quantite` (dénormalisée, legacy) ; `conservation` (int NOT NULL) ; `a_conserver` ; `allee` ; `rayon` ; `date_dernier_depart` ; `date_derniere_sortie` ; `commentaire` ; `validationAdmin` ; (V2) `validationAdmin_par`, `validationAdmin_le` ; (V2) `mode_rattachement` ; flags legacy `rebus`, `date_rebus`, `zone_Picking`, `est_fusionne`, `envoye` ; (V2) statut IDENTIFIEE / ORPHELINE ; (V2) type de feuille posée (TEMPORAIRE / DEFINITIVE, « sans place aujourd'hui ») ; (V2) `surplus_entretien` ; (V2) signalement « introuvable » (date, destinataire, auteur) ; (V2) thème modifié (ancien, nouveau, date, par, origine, réimprimé) ; `photo_id` | Obl. (L, NOT NULL) : `plt_id`, `sup_id`, `quantite`, `conservation`, `date_entree`. Cond. : `allee`/`rayon` vides tant que l'affiche est en zone tampon ; `validationAdmin_par/_le` si validée ; pas de colonne statut dans le schéma réel (état dérivé de flags) | `bdd.md §2.1, §4.2, §4.3` ; legacy RG-REC-024/029/040 ; `[DC] §9, §13` (EX-REC-054, 080) ; ECR-REC-03/05 ; `maquettes-autres-modules.md §C` |
| Mouvement de stock — `mouvement` (L) + `tr_type_mouvement` (V2) | `affiche_id` ; `quantite` signée ; type (Réception, Réception (complément), Contrôle (écart au BL), Mise au rebut, production, sortie et ajout manuels, expédition, fusion, renvoi, destruction) ; `recepisse` ; `expediteur` ; `comptee` (usage « à vérifier ») ; `livraison_id` ; `IdActivite` (machine/équipe) ; `id_affiche_initial` (fusion) ; auteur ; date ; motif ; indicateur automatique | Obl. : affiche, quantité signée, type, auteur, date. Append-only (jamais modifié ni supprimé) | `bdd.md §2.2` ; legacy « Mouvement — append-only » ; `[DC] §9, §13` (EX-REC-057) ; ECR-STK-02 |
| Rattachement affiche ↔ visuel/dossier (V2) — `asso_affiche_visuel` | affiche ; ligne attendue (dossier × thème) ; quantité ; origine (auto / manuel) ; actif / retiré ; créé par/le ; retiré par/le | Obl. : affiche, ligne attendue, quantité ≥ 1. Remplace le lien 1–1 `tf_prepa_affiche.affiche_livraison_Id` (L) ; reprise des rattachements existants (sans quantité) : question DATA | `[DC] §13` ; `specs-coordination.md` EX-COO-039 ; `bdd.md §7.5` |
| Ligne attendue (« réception attendue ») — `tf_prepa_affiche` (L) étendue | `plt_id` ; `sup_id` ; `cont_num` ; `Format` ; `rpc_annonceur` ; `rpc_theme` ; `repiquage` ; `Qte_Theorique` ; `sem_num` ; `sem_annee` ; `FromBroadcast` ; `ARecevoir` ; `Statut` ; `IdDAChapeau` ; `affiche_livraison_Id` ; (V2) source BC/PREPA ; (V2) état ACTIVE/ANNULEE ; (V2) `qte_bc`, `qte_prepa`, `date_vue_bc` ; statut calculé Attendue / Partielle / Complète / Surplus | Table alimentée par la Coordination (RG-COO alimentation). La Réception la LIT et pose le rattachement. Aucune clé métier unique dans le schéma réel (index unique cible RG-AT-01) | `bdd.md §2.3` ; `[RA]` (EX-COO-032 à 039) ; legacy RG-REC-071 |
| Réception inconnue (affiche orpheline + palette « A_IDENTIFIER ») | Réception A_IDENTIFIER ; affiche ORPHELINE ; annonceur lu sur l'affiche ; thème ou description ; format ; imprimeur ; quantité comptée ; allée (zone tampon, défaut X) ; rayon ; photo de l'affiche ; photo du BL (si BL) ; feuille TEMPORAIRE ; signalement introuvable ; `rattacheeLe` | Obl. : site, quantité comptée > 0, allée, rayon. Cond. : photo du BL sauf palette arrivée sans BL | `[DC] §7` (EX-REC-035) ; ECR-REC-04/08 |
| Photo (BL, affiche) — `photo` + `asso_livraison_photo` (L) | `intitule` ; taille ; extension ; contenu (varbinary(max) en L : stockage cible à décider, Q-113) ; type (BL / affiche / pièce jointe) | Obl. : photo du BL pour toute réception sauf inconnue sans BL | legacy RG-REC-080 ; `bdd.md §2.2, §10` ; `[DC] §4` |
| Fusion d'affiches — `fusion_affiche` (L) | `id_affiche_chapeau` ; `id_affiche` (cible) ; `qui_creation` ; `date_creation` ; `est_fusionne` (chapeau) | Donnée HÉRITÉE (fonction non reprise dans la cible, Q-100) | legacy RG-REC-062 ; `bdd.md §2.4` ; `[README] §3, §7` (EX-REC-079) |
| Semaines de départ d'une affiche — `tf_dossier_semaine_depart` (L) | `IdAffiche` ; `Dossier` ; `Semaine` ; `Annee` | Donnée héritée (doublonne `affiche.semaines`) ; remplacée par le rattachement N-N (Q-150) | legacy RG-REC-025 ; `bdd.md §2.4` |
| Activité de production — `Activite` / `Equipe` / `Machine` (L) | `IdAffiche` ; `id_affiche_initial` ; `IdEquipe` ; `IdMachine` ; `Quantite` ; `Rebus` ; `DateProduction` | Hors Réception (Zone picking / production) ; citée car réaffectée à la fusion | `bdd.md §2.4` ; legacy RG-REC-062 |
| Journal d'événements de réception (V2) — `th_edr_evenement` | type d'événement (réception, contrôle, rattachement, changement de thème, retrait, modification, impression/réimpression de feuille, étiquette rack, purge automatique) ; objet ; auteur ; date ; ancienne/nouvelle valeur | Obl. : auteur et date pour toute action | `[DC] §13` ; EX-TRA-035 |
| Historique d'entité — `histo_historique_entite` (L) + `histo_action_applicative` + `tr_type_entite` | `IdActionApplicative` ; `IdTypeEntite` ; `IdEntite` ; `AncienneValeur` ; `NouvelleValeur` ; `Complement` ; `JsonData` ; `QuiAction` ; `DateAction` | Tables de référence sans données dans le dépôt (Q-004) | `bdd.md §5` ; legacy RG-REC-024 |
| Rapprochement proposé (V2) — `tf_edr_rapprochement` | déplacements d'affiches proposés entre lignes | Propriété Coordination (RG-COO) ; consommée par la Réception | `[RA] §4` ; `bdd.md §7.5` |
| Alerte de réception (V2, calculée ou événement daté) | clé ; type ; gravité ; site ; semaine ; date ; titre ; message ; lien (écran, paramètres) ; destinataires (rôles) ; acquittée | Modèle d'alerte (calculée vs événement) : Q-TRA-1 de la maquette, hors REC | ECR-TRA-01 ; EX-TRA-027 à 031 |
| Paramètres « Règles métier › Réception » (V2) | `ecartReception` (10 %) ; `purgeAttendues` (4 semaines) ; `delaiControle` (24 h) ; `comptageMorceau` (30) ; `exemplairesFeuille` (2, bornes 1 à 5) ; `alleeInconnues` (X) | Aucune table de paramètres aujourd'hui (à créer) ; portée par site : Q-105 | `[DC] §11` (EX-REC-073) ; ECR-ADM-05 |
| Référentiels de réception (Administration) | Imprimeurs ; Livreurs = transporteurs entrants ; Agents de réception = contrôleurs (« Déchargé par », « Contrôleur ») | Listes fermées ; création à la volée refusée (Q-115) | `[DC] §11, §15` (EX-REC-074) ; ECR-ADM-07 ; legacy `tr_transposteur_reception`, `tr_imprimeur` |
| Plateforme / site — `tr_plateforme` + `tr_atelier_imprimante` + `tr_adresseMail_plateforme` (L) | `plt_id` ; `plt_nom` ; `id_site_ccf` (lien Broadcast, 39/40/43/44) ; imprimantes (noms) ; adresses mail de réception | Périmètre utilisateur par `tr_utilisateur_data` (L) ; sites Wissous, Nîmes (+ DBG, DBG Lyon dans le code : à trancher, EX-TRA-006) | `bdd.md §6` ; legacy-admin RG-ADM-040/041/042 |
| Utilisateur / périmètre / droits — `tr_utilisateur` + `tr_utilisateur_data` + `tr_utilisateur_menu` (L) | `loginWindows` ; `plt_id`, `ate_id` (périmètre) ; `menu` (droit) ; `prf_id` (inerte) | Authentification cible non spécifiée (Q-001) ; profils provisoires = 6 rôles de la maquette (Q-003) | `legacy-admin.md` RG-ADM-010 à 016 ; `maquettes-reception-coordination.md §1.3` |
| Panier de lignes du BL (état d'écran) | lignes (ligne attendue, qté du BL, case cochée, complément, intitulé saisi sans IP) | Non persisté dans la maquette (état d'écran) ; legacy : session ASP.NET (RG-REC-072) | ECR-REC-01 ; legacy RG-REC-072 |
| Données de l'interface réception → Broadcast — `INTERFACE.CIRCE_PEX_RECEPTION` (L) | `IdDAChapeau` ; `IdDossierDeVenteChapeau` ; `IdSiteCCF` ; surface/bandeau ; quantité ; `EstAssociee` ; `EstImportePEX` ; `Destinataire` (« CIRCE ») ; `QuiCreation` | Écrite par le batch ; consommateur EXTPLAY hors dépôt (Q-005, Q-151) | legacy RG-REC-110/111 ; `legacy-integrations.md` RG-INT-020 à 022 |

## 2. Profils × actions
Rôles PROVISOIRES (Q-003, CLAUDE.md §8) = les 6 rôles de la maquette, colonnes dans cet ordre : `coord` Coordination · `cheq` Chef d'équipe · `recep` Agent de réception (= contrôleur, EX-REC-076) · `expe` Agent d'expédition · `admin` Administrateur · `com` Commerce (lecture).

Légende : ✔ autorisé (source explicite) · ✘ refusé (source explicite) · ✔* / ✘* = déduit de l'HYPOTHÈSE Q-136 · ✔(cond.) = autorisé sous condition · ? = non tranché (question citée).
HYPOTHÈSE Q-136 (statut HYPOTHÈSE PRISE) : la maquette ne grise que les écrans « secondaires » du rôle (`s.roles`, aucun refus codé, `maquettes-reception-coordination.md §1.3`) ; en cible les permissions sont vérifiées dans le service (CLAUDE.md §6, EX-TRA-002). On retient : écran « primaire » du rôle (champ `roles` de l'écran de la maquette) = lecture et écriture autorisées ; écran « secondaire » = lecture seule ; `com` = lecture seule partout. Écrans primaires : `reception` (étapes 1 et 2, Liste des affiches) = coord, cheq, recep, com (lecture) ; `identification` (Réceptions inconnues) = coord, recep ; Stock par affiche (mise au rebut) = recep, cheq, expe ; Validation admin = coord et admin (restriction codée) ; Paramétrage = admin. Les cellules marquées « ? Q-136 » sont contredites par une autre source (chef d'équipe : « alertes, consultation » EX-REC-076 vs écran primaire de la maquette).

| Action | coord | cheq | recep | expe | admin | com | Source |
|---|---|---|---|---|---|---|---|
| Consulter les Réceptions attendues et le panier | ✔* | ✔* | ✔ | ✘* | ✘* | ✔ (lecture) | ECR-REC-01 `roles` ; `[README]` H10 (EX-TRA-004) ; legacy droit `reception_liste_affiche` (menu) |
| Photographier le BL / une affiche, mettre au panier | ✔* | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-076 (agent de réception : quai, étape 1) ; ECR-REC-01/07 |
| Valider la réception (créer la réception, les affiches et les mouvements) | ✔* | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-076 ; ECR-REC-01 |
| Créer une réception inconnue | ✔* | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-076 (« crée les inconnues ») ; ECR-REC-08 |
| Consulter le sas (palettes à contrôler) et son badge | ✔* | ✔ | ✔ | ✘* | ✘* | ✔ (lecture) | EX-REC-070 (alerte palette en retard : Réception et chefs d'équipe) ; ECR-REC-02 |
| Contrôler la palette et « Valider le contrôle et imprimer » (contrôleur) | ? Q-136 | ? Q-136 | ✔ | ✘* | ✘* | ✘ | EX-REC-026, 076 (contrôleur = un agent de réception) ; ECR-REC-02 |
| Imprimer / réimprimer feuilles de stock et étiquettes rack (liste, fiche, ligne attendue contrôlée) | ✔* | ✔* | ✔ | ✘* | ✘* | ✘ | EX-REC-034, 076 (« réimprime les feuilles ») ; ECR-REC-03/09/10 |
| Consulter la Liste des affiches, la fiche affiche et la fiche réception | ✔* | ✔* | ✔ | ✘* | ✘* | ✔ (lecture) | ECR-REC-03/05/06 ; `[README]` H10 |
| Modifier la fiche affiche (annonceur/thème saisis, imprimeur, allée, rayon, « à conserver ») | ✔* | ✔* | ✔ | ✘* | ✘* | ✘ | ECR-REC-05 ; legacy RG-REC-024 (aucun contrôle serveur) |
| Consulter les Réceptions inconnues (badge rouge) | ✔ | ✘* | ✔ | ✘* | ✘* | ✘ | ECR-REC-04 `roles` ; EX-REC-037 |
| Identifier et « Rattacher » une réception inconnue | ✔ (vaut validation admin) | ✘* | ✔(cond. : reste « à confirmer », pas de validation) ? Q-107 | ✘* | ✘* | ✘ | EX-REC-040 ; ECR-REC-04 (`rattache='MAIN'`) |
| « Signaler à la Coordination » (Dossier introuvable) | ✔* | ✘* | ✔ | ✘* | ✘* | ✘ | EX-REC-041 ; ECR-REC-04 |
| Valider / « Annuler la validation » (validation admin d'une affiche) | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | `[README]` H1 ; maquette `role === 'coord' || 'admin'` (instructions.js:16-18, reception.js:85-88) ; EX-COO-010, EX-TRA-005 ; mapping legacy droit `validation_admin` |
| Changer de thème, retirer un rattachement, « + Rattacher à un autre dossier » (fiche affiche) | ✔ (vaut validation) | ? Q-136 | ✔(cond. : reste « à confirmer ») ? Q-136 | ✘* | ✘* | ✘ | EX-REC-048 ; ECR-REC-05 ; Q-REC-22 de la maquette (droits sur « Retirer » non définis) |
| Cocher « Affiche à conserver » | ✔* | ✔* | ✔ | ✘* | ✘* | ✘ | ECR-REC-05 ; legacy droit `validation_admin` (case « à conserver » réservée à ce droit) : écart, Q-136 |
| Mettre au rebut (depuis Stocks ou fiche) | ✘* | ✔ | ✔ | ✔ | ✘* | ✘ | ECR-STK-01 `roles` recep, cheq, expe ; EX-REC-024 |
| Ajout / sortie manuels de stock | ? Q-117 | ? Q-117 | ? Q-117 | ? Q-117 | ? Q-117 | ✘ | legacy RG-REC-021/022 (aucun contrôle) ; Q-117 |
| Consulter Stocks › Fin de campagne (destruction) | ✔ | ✔ | ✔ | ✘* | ✘* | ✘* | ECR-STK-03 `roles` recep, cheq, coord (module STK, hors REC) |
| Consulter Pilotage › Alertes et acquitter | ✔ | ✔ | ✔ | ✘* | ✔* | ✔ (lecture) | ECR-TRA-01 ; EX-TRA-027 (règles d'acquittement : Q-TRA-2 maquette) |
| Paramétrer Règles métier › Réception (seuils, purge, délai, exemplaires, allée) | ✘* | ✘* | ✘* | ✘* | ✔ | ✘ | ECR-ADM-05 ; `[README]` §3 (Administration › Paramétrage) |
| Gérer les référentiels Imprimeurs / Livreurs / Agents de réception | ✘* | ✘* | ✘* | ✘* | ✔ | ✘ | ECR-ADM-07 ; EX-REC-074, EX-ADM-501 ; legacy droit `referentiel`/`admin` |
| Gérer plateformes, imprimantes, mails de réception | ✘* | ✘* | ✘* | ✘* | ✔ | ✘ | legacy-admin RG-ADM-040/042 (droit `admin`) ; EX-TRA-041 |
| Consulter l'historique d'une affiche et le journal | ✔* | ✔* | ✔ | ✘* | ✔ | ✔ (lecture) | ECR-REC-05 (onglet Historique) ; ECR-ADM-08 |
| Exporter un tableau (xlsx) | ✔* | ✔* | ✔* | ✘* | ✔* | ✔ (lecture) | EX-TRA-016 ; maquette §2.1 (« Exporter » visible pour tous) |

Mapping des droits legacy (27, `CommunBll.Droits`, `legacy-admin.md §2`) touchant la Réception, vers les rôles provisoires :

| Droit legacy (`tr_utilisateur_menu.menu`) | Effet legacy (UI uniquement, jamais contrôlé côté serveur : RG-ADM-015) | Rôle(s) cible provisoire(s) | Source |
|---|---|---|---|
| `reception_liste_affiche` | Menu Réception : Réception des affiches + Liste des affiches | coord, cheq, recep (+ com en lecture) | legacy-admin §2 ; RG-REC-120 |
| `validation_admin` | Cases « Validation Admin » et « Affiche à conserver » ; boutons associer/dissocier une prépa | coord, admin (validation) ; case « à conserver » : voir Q-136 | legacy RG-REC-027/091/092 ; EX-TRA-005 |
| `Zone_Picking` | Sous-menu Zone picking ; case « zone Picking » du détail | non repris (EX-REC-079, Q-101) | legacy RG-REC-029 ; `[README]` §3, §7 |
| `fusion_affiche` | Sous-menu Fusion des affiches ; colonne/bouton Fusionner | non repris (EX-REC-079, Q-100) | legacy RG-REC-014 |
| `suivi_suivi_production` | Menu Suivi dont Etat de destruction | coord, cheq, recep (Pilotage, Stocks › Fin de campagne) | legacy RG-REC-050, 120 |
| `admin`, `referentiel`, `Super_admin` | Administration : plateformes, mails, imprimantes, référentiels, utilisateurs | admin | legacy-admin §2 |
| Périmètre `tr_utilisateur_data` (plateforme, atelier) | Listes de plateformes filtrées | tous rôles : périmètre par site conservé (RG-REC-001) | legacy RG-REC-001 ; EX-TRA-006 |

Constat legacy conservé pour mémoire : aucun contrôle serveur n'existe dans l'existant (RG-REC-121 provisoire) ; la cible l'impose (RG-REC-002).

## 3. Machine d'états
### 3.1 Statuts

Principe (RG-REC-176, EX-REC-050) : Circé pose chaque statut et chaque tag lui-même à chaque événement ; aucun tag n'est coché à la main. Le schéma réel n'a aucune colonne statut pour l'affiche ni pour la ligne attendue (état dérivé de drapeaux, `bdd.md §4.2-4.3`) : « persisté ou calculé » = Q-f de `bdd.md` (cible : une machine d'états par entité dans le service, historique à chaque changement, CLAUDE.md §6). Les codes ci-dessous sont des PROPOSITIONS de codes techniques ; les libellés sont ceux des sources.

| Statut (objet.code) | Libellé affiché | Signification | Source |
|---|---|---|---|
| RECEPTION.A_IDENTIFIER | « À identifier par la Coordination (zone tampon) » | Réception inconnue créée, aucun dossier rattaché ; HORS du sas de contrôle | EX-REC-053 ; ECR-REC-06 |
| RECEPTION.A_CONTROLER | « Palette à contrôler » | Palette dans le sas, posé à « Valider la réception » ou au rattachement d'une inconnue | EX-REC-053 ; ECR-REC-02 |
| RECEPTION.CONTROLEE | « Contrôlée » (avec date et contrôleur) | « Valider le contrôle » fait ; champs en lecture seule | EX-REC-027, 053 ; ECR-REC-02 |
| LIGNE_ATTENDUE.ATTENDUE | « Attendue » | Reçu = 0 | EX-REC-051 ; ECR-REC-01 |
| LIGNE_ATTENDUE.PARTIELLE | « Partielle » | 0 < reçu < attendu | EX-REC-051 |
| LIGNE_ATTENDUE.COMPLETE | « Complète » | reçu ≥ attendu et reçu ≤ attendu × 1,10 (maquette : seuil codé en dur `reception.js:39`, paramètre `ecartReception` à utiliser) | EX-REC-051 ; ECR-REC-01 « Seuils » |
| LIGNE_ATTENDUE.SURPLUS | « Surplus » | reçu strictement supérieur à attendu × 1,10 | EX-REC-051, 060 |
| LIGNE_ATTENDUE.CONTROLE_RIEN_RECU | « Rien reçu » (colonne Contrôle) | Aucune affiche rattachée | EX-REC-051 ; ECR-REC-01 |
| LIGNE_ATTENDUE.CONTROLE_A_CONTROLER | « À contrôler » (colonne Contrôle) | Au moins une affiche rattachée dont la palette n'est pas contrôlée | EX-REC-051 |
| LIGNE_ATTENDUE.CONTROLE_CONTROLEE | « Contrôlée » (colonne Contrôle) | Affiches contrôlées ; feuille de stock réimprimable | EX-REC-051 ; ECR-REC-01 |
| AFFICHE.IDENTIFIEE | « Identifiée » | Au moins un rattachement actif à un dossier/ligne attendue | EX-REC-054 ; ECR-REC-03 |
| AFFICHE.ORPHELINE | « Orpheline » (statut dans [DC], tag dans [PR] : voir Contradictions) | Aucun lien actif ; = réception inconnue non rattachée | EX-REC-043, 054 |
| AFFICHE.TAG_A_CONTROLER | « À contrôler » | De la réception jusqu'au contrôle | EX-REC-054 |
| AFFICHE.TAG_RECEPTION_INCONNUE | « Réception inconnue » | Affiche issue d'une réception inconnue | EX-REC-054 |
| AFFICHE.TAG_COMPLEMENT | « Complément » | Affiche reçue en au moins deux réceptions | EX-REC-016, 054 |
| AFFICHE.TAG_FEUILLE_A_REFAIRE | « Feuille à refaire » (affiché « Feuille définitive à imprimer » tant qu'une temporaire est posée) | Thème ou rattachement changé après identification ; levé par la réimpression | EX-REC-033, 054 |
| AFFICHE.TAG_AU_REBUT | « Au rebut » | PROPOSÉ (non décidé) | EX-REC-054 ; Q-118 |
| FEUILLE.TEMPORAIRE | « Temporaire » | Posée à la création d'une réception inconnue ; porte allée et rayon de la zone tampon | EX-REC-029, 056 |
| FEUILLE.DEFINITIVE | « Définitive » | Posée au contrôle (dossier connu) ou à l'impression après rattachement ; remplace la temporaire | EX-REC-029, 056 |
| AFFICHE_RECUE.NON / .OUI | « Affiche reçue » = non / oui (EDR) | OUI dès l'arrivée de la palette (sur la quantité du BL) ; V2 : « un mouvement de réception existe » | EX-REC-052, EX-REC-503 ; Q-104 |
| RECEPTION_INCONNUE.A_IDENTIFIER | « À identifier » | Feuille temporaire, zone tampon | EX-REC-055 ; ECR-REC-04 |
| RECEPTION_INCONNUE.INTROUVABLE | « Introuvable : alerte à la Coordination » (+ date) | Après « Signaler à la Coordination » | EX-REC-041, 055 ; ECR-REC-04 |
| RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | « Rattachée, à contrôler » | Rattachée à ≥ 1 dossier ; palette dans le sas | EX-REC-040, 055 |
| RECEPTION_INCONNUE.CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER | « Contrôlée, feuille définitive à imprimer » | Contrôle validé, feuille définitive non encore imprimée | EX-REC-055, 068 |
| RECEPTION_INCONNUE.RATTACHEE_FEUILLE_DEFINITIVE | « Rattachée, feuille définitive » | Terminé (masqué par défaut dans le filtre) | EX-REC-055 ; ECR-REC-04 |
| VALIDATION_ADMIN.RECEPTION_INCONNUE | « Réception inconnue : à rattacher d'abord » | Pas de validation possible tant que non rattachée | ECR-REC-05 (`C.vaEtat`) ; EX-COO-012 |
| VALIDATION_ADMIN.PROPOSEE | « À confirmer : proposé » (cas sûr, pré-coché) | Rattachement proposé par Circé à la réception | EX-COO-004, 006, 012 |
| VALIDATION_ADMIN.A_FAIRE_DOUTE | « À confirmer : doute » | Motif de doute, jamais pré-coché | EX-COO-007, 012 |
| VALIDATION_ADMIN.VALIDEE | « Validée par <user>, le <date> » | Confirmée par une personne ; décochable | EX-COO-009, 012 ; EX-TRA-036 |
| VALIDATION_ADMIN.ANNULEE | « Validation annulée » | « Annuler la validation » ; redevient à confirmer (motif doute) | EX-COO-007, 009 |
| RATTACHEMENT.ACTIF / .RETIRE | actif / retiré (par, le) | Lien affiche ↔ ligne attendue avec quantité ; jamais perdu : retiré et recréé | EX-COO-039 ; EX-REC-080 |
| RATTACHEMENT.MODE_BL / _VISUEL / _MAIN | « n° du BL » / « visuel » / « à la main » | Comment le dossier a été trouvé | EX-REC-004, 080 ; ECR-REC-01 |
| INDICATEUR.CONTROLE_EN_RETARD | « Contrôle en retard » | Palette dans le sas depuis plus de `delaiControle` (24 h) ; grave au double | EX-REC-019, 053 |
| INDICATEUR.ECART_DE_COMPTAGE | « Écart de comptage » | |comptée − BL| > 10 % de la quantité du BL | EX-REC-021, 053 |
| INDICATEUR.PHOTO_BL_JOINTE | « Photo du BL jointe » | Photo du BL attachée à la réception | EX-REC-003 |
| ALERTE.OUVERTE / .ACQUITTEE | ouverte / acquittée | Règles d'acquittement non précisées (Q-TRA-2 maquette) | ECR-TRA-01 |
| LEGACY.AFFICHE (flags) | R Réceptionnée · P Picking · V validée admin · O orpheline · Rb Au rebus · Fc Fusionnée (cible) · Fh Chapeau | États HÉRITÉS (migration) : `rebus`, `zone_Picking`, `validationAdmin`, `est_fusionne`, `fusion_affiche` ; pas de colonne statut | legacy `legacy-reception.md` « Machines d'états » ; `bdd.md §2.1` |
| LEGACY.PREPA | à recevoir · reçue · reçue partielle · FromBroadcast | `ARecevoir`, `affiche_livraison_Id`, `FromBroadcast` (héritage ; remplacé par statuts de ligne attendue) | legacy RG-REC-071/082/091/092 |
| LEGACY.LIVRAISON | Créée (aucun statut, aucune suppression) | Remplacé par RECEPTION.* | legacy « Livraison » |
| LEGACY.ENVOYE | `affiche.envoye` null → true | Drapeau d'envoi PEX, jamais remis à false | legacy RG-REC-110 |

### 3.2 Transitions (toute transition absente est INTERDITE : 409)

Permissions abrégées : coord, cheq, recep, expe, admin, com (voir matrice §2). « * » = hypothèse Q-136. Les transitions de la validation admin sont DÉFINIES par le module Coordination (RG-COO validation admin, EX-COO-004 à 016) ; elles sont reprises ici car déclenchées depuis les écrans Réception.

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| ∅ | Valider la réception (≥ 1 ligne cochée) | RECEPTION.A_CONTROLER | recep ; coord* | RG-REC-026, 037, 024, 023, 033, 035 | RG-REC-038, 039, 040, 041, 042, 044, 045, 046 ; RG-X-001, 003, 004, 005, 028 | EX-REC-013, 014 |
| ∅ | Créer une réception inconnue | RECEPTION.A_IDENTIFIER (affiche ORPHELINE, feuille TEMPORAIRE) | recep ; coord* | RG-REC-095, 096, 097, 098 | RG-REC-099, 083 ; RG-X-006 | EX-REC-035, 036 |
| RECEPTION.A_IDENTIFIER | Rattacher (≥ 1 dossier, répartition ≤ quantité) | RECEPTION.A_CONTROLER | coord ; recep (reste à confirmer, Q-107) | RG-REC-107, 108, 118 | RG-REC-109, 110, 111 ; RG-X-007, 030 | EX-REC-039, 040 |
| RECEPTION.A_CONTROLER | Valider le contrôle (contrôleur, allée, rayon) | RECEPTION.CONTROLEE | recep | RG-REC-061, 067, 057, 064 | RG-REC-069, 059, 084 ; RG-X-017 | EX-REC-023, 026, 027 |
| RECEPTION.A_CONTROLER | Retirer le dernier dossier d'une affiche de la palette | RECEPTION.A_IDENTIFIER | coord ; recep* | RG-REC-114, 137 | RG-REC-114 ; RG-X-013 | EX-REC-043, 053 ; ECR-REC-05 ; Q-108 |
| RECEPTION.CONTROLEE | Retirer le dernier dossier | RECEPTION.A_IDENTIFIER | coord ; recep* | RG-REC-114 ; HYPOTHÈSE Q-108 (maquette : toute réception sans dossier redevient à identifier) | RG-X-013 | EX-REC-043 (ambigu §9/§10) ; Q-108 |
| RECEPTION.A_CONTROLER | « Valider la réception » d'un complément sur la même palette | (inchangé) | — | — | RG-REC-040 | EX-REC-016 |
| LIGNE_ATTENDUE.ATTENDUE | Réception d'une quantité < attendu | LIGNE_ATTENDUE.PARTIELLE | calculé | RG-REC-018 | RG-X-004 | EX-REC-051 |
| LIGNE_ATTENDUE.ATTENDUE / PARTIELLE | Réception portant le reçu à attendu .. attendu × 1,10 | LIGNE_ATTENDUE.COMPLETE | calculé | RG-REC-018 | RG-X-004 | EX-REC-051 |
| LIGNE_ATTENDUE.ATTENDUE / PARTIELLE / COMPLETE | Réception portant le reçu > attendu × 1,10 | LIGNE_ATTENDUE.SURPLUS | calculé | RG-REC-018, 051 | RG-REC-183 ; RG-X-004, 017 | EX-REC-051, 060 |
| LIGNE_ATTENDUE.PARTIELLE / COMPLETE / SURPLUS | Retrait d'un rattachement, écart de contrôle, rebut qui change le reçu | recalcul (tout statut de la famille) | calculé | RG-REC-017, 018 | RG-X-004, 013 | EX-REC-057 |
| AFFICHE.(∅) | Valider la réception (voie dossier connu) | AFFICHE.IDENTIFIEE (+ TAG_A_CONTROLER) | recep ; coord* | RG-REC-039 | RG-REC-044 | EX-REC-014, 054 |
| AFFICHE.(∅) | Créer une réception inconnue | AFFICHE.ORPHELINE (+ TAG_RECEPTION_INCONNUE, TAG_A_CONTROLER) | recep ; coord* | RG-REC-095 | RG-REC-099 | EX-REC-036 |
| AFFICHE.ORPHELINE | Rattacher | AFFICHE.IDENTIFIEE | coord ; recep (Q-107) | RG-REC-107, 108 | RG-REC-109 | EX-REC-040 |
| AFFICHE.IDENTIFIEE | Retirer le dernier rattachement actif | AFFICHE.ORPHELINE | coord ; recep* | RG-REC-137 | RG-REC-114 | EX-REC-043 |
| AFFICHE.IDENTIFIEE | Changer de thème / ajouter ou retirer un rattachement | AFFICHE.IDENTIFIEE (+ TAG_FEUILLE_A_REFAIRE) | coord ; recep (reste à confirmer) | RG-REC-135, 136 | RG-REC-129 ; RG-X-012, 014 | EX-REC-048, 062 |
| AFFICHE (tag À contrôler) | Valider le contrôle | tag À contrôler levé | recep | RG-REC-069 | — | EX-REC-054 |
| AFFICHE (tag Complément) | 2e réception de l'affiche | TAG_COMPLEMENT posé | calculé | RG-REC-128 | — | EX-REC-016, 054 |
| FEUILLE.(∅) | Créer une réception inconnue (impression temporaire) | FEUILLE.TEMPORAIRE | recep | RG-REC-083 | — | EX-REC-029, 056 |
| FEUILLE.(∅) ou TEMPORAIRE | Valider le contrôle et imprimer (dossier connu, ou inconnue rattachée) | FEUILLE.DEFINITIVE | recep | RG-REC-084, 069 | RG-REC-085 | EX-REC-027, 056 |
| FEUILLE.DEFINITIVE | Réimprimer | FEUILLE.DEFINITIVE (tag Feuille à refaire levé) | recep ; coord* ; cheq* | RG-REC-087 | RG-REC-085 | EX-REC-033, 034 |
| FEUILLE.TEMPORAIRE | « Imprimer dans Réception des affiches » (inconnue contrôlée) | FEUILLE.DEFINITIVE | recep | RG-REC-084 | RG-REC-085, 187 | EX-REC-040 ; ECR-REC-04 |
| RECEPTION_INCONNUE.A_IDENTIFIER | Signaler à la Coordination | RECEPTION_INCONNUE.INTROUVABLE | recep ; coord* | RG-REC-112 | RG-REC-186 ; RG-X-008 | EX-REC-041, 055 |
| RECEPTION_INCONNUE.A_IDENTIFIER | Rattacher | RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | coord ; recep | RG-REC-107, 108 | RG-REC-109 | EX-REC-040, 055 |
| RECEPTION_INCONNUE.INTROUVABLE | Rattacher (après correction Broadcast) | RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | coord ; recep | RG-REC-107, 108 | RG-REC-109 ; Q-109 | EX-REC-055 (« à confirmer ») ; Q-109 |
| RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | Valider le contrôle sans imprimer | RECEPTION_INCONNUE.CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER | recep | RG-REC-072, 069 | RG-REC-187 | EX-REC-055, 068 |
| RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | Valider le contrôle et imprimer la feuille définitive | RECEPTION_INCONNUE.RATTACHEE_FEUILLE_DEFINITIVE | recep | RG-REC-072, 069, 084 | RG-REC-085 | EX-REC-027, 055 |
| RECEPTION_INCONNUE.CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER | Imprimer la feuille définitive | RECEPTION_INCONNUE.RATTACHEE_FEUILLE_DEFINITIVE | recep | RG-REC-084 | RG-REC-085 | EX-REC-055 |
| RECEPTION_INCONNUE.(RATTACHEE_* ou CONTROLEE_*) | Retirer le dernier dossier | RECEPTION_INCONNUE.A_IDENTIFIER | coord ; recep* | RG-REC-114 ; Q-108 | RG-X-013 | EX-REC-043 |
| AFFICHE_RECUE.NON | Valider la réception | AFFICHE_RECUE.OUI | recep ; coord* | RG-REC-044 | RG-X-005 | EX-REC-052 |
| VALIDATION_ADMIN.(∅) | Valider la réception, cas sûr | VALIDATION_ADMIN.PROPOSEE | système | RG-X-001 | RG-X-001 | EX-COO-004, 006 |
| VALIDATION_ADMIN.(∅) | Valider la réception, cas de doute | VALIDATION_ADMIN.A_FAIRE_DOUTE | système | RG-X-001, 002 | RG-X-001 | EX-COO-007 |
| VALIDATION_ADMIN.RECEPTION_INCONNUE | Rattacher par coord | VALIDATION_ADMIN.VALIDEE | coord | RG-REC-111 | RG-X-007 | EX-COO-010, 017 |
| VALIDATION_ADMIN.RECEPTION_INCONNUE | Rattacher par recep | VALIDATION_ADMIN.A_FAIRE_DOUTE (rattachement MAIN) | recep | RG-REC-111 | RG-X-007 | ECR-REC-04 ; Q-REC-18 maquette |
| VALIDATION_ADMIN.PROPOSEE / A_FAIRE_DOUTE | Valider | VALIDATION_ADMIN.VALIDEE | coord ; admin | RG-REC-003 | RG-X-001, 015 ; RG-COO | EX-COO-008, 010 |
| VALIDATION_ADMIN.VALIDEE | Annuler la validation | VALIDATION_ADMIN.ANNULEE | coord ; admin | RG-REC-003 | RG-X-015 | EX-COO-009 |
| VALIDATION_ADMIN.ANNULEE | Valider | VALIDATION_ADMIN.VALIDEE | coord ; admin | RG-REC-003 | RG-X-015 | EX-COO-009 |
| VALIDATION_ADMIN.VALIDEE | Changer de thème (par non-coord) / thème changé | VALIDATION_ADMIN.A_FAIRE_DOUTE | recep ; coord (si coord : reste validée) | RG-REC-135 | RG-X-012 ; Q-55 source | EX-COO-016 ; ECR-REC-05 |
| RATTACHEMENT.(∅) | Rattacher (auto à la réception, ou manuel) | RATTACHEMENT.ACTIF | recep ; coord | RG-REC-042, 049, 136 | RG-X-016 | EX-COO-039 |
| RATTACHEMENT.ACTIF | Retirer | RATTACHEMENT.RETIRE | coord ; recep* | RG-REC-137 | RG-X-013 | EX-REC-048 |
| MOUVEMENT.(∅) | Réception, complément, écart de contrôle, rebut, ajout/sortie manuel, expédition, fusion, renvoi, destruction | MOUVEMENT créé (append-only) | selon type | RG-REC-151 | — | EX-REC-057 |
| LEGACY.AFFICHE R/P | Mettre au rebus (legacy) | Rb (héritage) | — | RG-REC-157 | MODIFIÉE : remplacée par mouvement Mise au rebut (Q-118) | legacy RG-REC-040 |
| LEGACY.AFFICHE Rb (stock > 0) | Vider le rebus (legacy) | Rb (stock = 0) | — | RG-REC-158 | Q-118 | legacy RG-REC-041 |
| LEGACY.AFFICHE R/P | Fusion (rôle cible / chapeau) | Fc / Fh | — | RG-REC-163 | SUPPRIMÉE (écran) : Q-100 | legacy RG-REC-060/062 |

Transitions interdites notables (HTTP 409, `regle` = ID entre parenthèses) :

| Transition tentée | Pourquoi interdite | Règle |
|---|---|---|
| Contrôler / valider le contrôle d'une réception RECEPTION.A_IDENTIFIER | Elle n'entre pas dans le sas (rattacher d'abord) | RG-REC-071 |
| Valider le contrôle d'une réception déjà RECEPTION.CONTROLEE | Champs en lecture seule après contrôle | RG-REC-070 |
| RECEPTION.CONTROLEE → RECEPTION.A_CONTROLER | Aucun retour arrière décrit | RG-REC-070 |
| Rattacher (écran Réceptions inconnues) une affiche déjà AFFICHE.IDENTIFIEE | « Rattacher » ne s'applique qu'à une affiche orpheline ; ajouter un dossier passe par la fiche (+ Rattacher) | RG-REC-107 |
| Signaler « Dossier introuvable » sur une affiche non RECEPTION_INCONNUE.A_IDENTIFIER | Seul l'état « À identifier » propose le signalement | RG-REC-112 |
| RECEPTION_INCONNUE.INTROUVABLE → RECEPTION_INCONNUE.A_IDENTIFIER | Aucun retour décrit (le signalement ne se retire pas) | RG-REC-112 ; Q-109 |
| Valider (validation admin) une affiche VALIDATION_ADMIN.RECEPTION_INCONNUE | « À rattacher d'abord » | RG-REC-111 |
| Annuler la validation d'une affiche non VALIDEE | Rien à annuler | RG-REC-003 |
| Retirer un rattachement déjà RETIRE | Lien déjà retiré (un rattachement retiré n'est jamais réactivé : un nouveau lien est créé) | RG-REC-137 |
| Imprimer une feuille DEFINITIVE pour une affiche sans aucun dossier (ORPHELINE) | « Temporaire → Définitive dès qu'il y a un dossier » | RG-REC-084 |
| Modifier / ajouter / sortir une affiche héritée « fusionnée » (cible de fusion) | Lecture seule (héritage de l'UI legacy, désormais imposée au serveur) | RG-REC-169 |
| Dé-rebuter / sortir du rebus une affiche héritée | Aucune transition de sortie du rebus n'existe dans l'existant | RG-REC-157 ; Q-118 |
| Toute transition non listée en 3.2 | Table de transitions explicite (CLAUDE.md §6) | — |

## 4. Règles
### RG-REC-001 — Périmètre plateforme / site de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : un utilisateur ne voit et n'agit que sur les plateformes (sites) de son périmètre (`tr_utilisateur_data`, N triplets login/plateforme/atelier). Le site choisi dans le bandeau 1 vaut pour toute l'application. L'identifiant de plateforme transmis par le client est REVÉRIFIÉ côté serveur (le legacy ne le revérifie jamais).
- Déclencheur : ouverture de tout écran Réception ; toute requête portant un `plt_id`.
- Conditions : `plt_id` ∈ périmètre de l'utilisateur. Utilisateur sans aucune plateforme : liste vide + message explicite (le legacy lève une NullReference sur `FirstOrDefault().Value`).
- Effet / message d'erreur : hors périmètre : 403 `REC_PERIMETRE_INTERDIT`, message (libellé proposé) « Cette plateforme n'est pas dans votre périmètre. ». Première plateforme présélectionnée.
- Sources : legacy `REPO/ReceptionListeAfficheRepository.cs:29-43`, `BLL/ReceptionListeAfficheBll.cs:41-43`, `REPO/LivraisonAfficheRepository.cs:220-235`, `CTRL/ReceptionListeAfficheController.cs:66-100` (ancien ID provisoire RG-REC-001, legacy-reception.md ; voir aussi RG-ADM-016 de legacy-admin.md) · spec `[README] §2.3, §7` (EX-TRA-006)
- Questions liées : Q-001, Q-137
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — apps/api/src/modules/reception/permissions.ts:assertPerimetreReception (lecture, rattacher : affiche ET ligne, retirer, mouvement, transition) ; core/identity.ts (x-site-id). Reste : Listes filtrées par périmètre / site du bandeau : parcours à listes (REC-P02+). Identité réelle : Q-001.
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts ; socle-audit.int.test.ts

### RG-REC-002 — Autorisation par rôle vérifiée dans le service
- Origine : MODIFIÉE
- Énoncé : toute action d'écriture du module Réception est autorisée ou refusée dans le SERVICE selon la matrice profils × actions (section 2), jamais seulement dans la route ni dans le front. Le legacy ne contrôle rien côté serveur (droits = masquage de menus et de boutons).
- Déclencheur : tout appel d'écriture (valider la réception, créer une réception inconnue, rattacher, contrôler, imprimer, rebut, modifier la fiche, paramétrer).
- Conditions : rôle de l'utilisateur non autorisé pour l'action (matrice §2). Lecture seule pour `com` sur tous les écrans.
- Effet / message d'erreur : 403 `REC_ACCES_REFUSE`, message (proposé) « Vous n'avez pas le droit d'effectuer cette action. ».
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:20-540`, `CTRL/LivraisonAfficheController.cs:24-544`, `CTRL/DestructionController.cs:15-67` (RG-REC-121 provisoire) ; legacy-admin.md RG-ADM-015 · spec EX-TRA-002 ; CLAUDE.md §6
- Questions liées : Q-003, Q-136
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — apps/api/src/modules/reception/permissions.ts:assertDroitReception ; permission OBLIGATOIRE dans rattacher, retirerRattachement, enregistrerMouvement, changerStatutReception. Reste : Endpoints d’écriture des parcours REC-P02+ à tester par profil ; cases « ? » refusées (Q-349).
- Tests : apps/api/src/modules/reception/complement.test.ts ; apps/api/test/reception/socle-audit.int.test.ts (6 profils en écriture) ; socle-complement.int.test.ts (6 profils en lecture)

### RG-REC-003 — Validation admin et annulation réservées à la Coordination et à l'Administrateur
- Origine : MODIFIÉE
- Énoncé : « Valider » et « Annuler la validation » d'une affiche (fiche affiche, Réceptions inconnues, Validation admin et Instruction OK) ne sont autorisés que pour `coord` et `admin`. L'agent de réception ne valide pas. Legacy : case « Validation Admin » affichée seulement avec le droit `validation_admin`, mais `validationAdmin` écrit sans contrôle serveur.
- Déclencheur : clic « Valider » / « Annuler la validation » ; enregistrement de la fiche affiche.
- Conditions : rôle ∈ {coord, admin}.
- Effet / message d'erreur : autres rôles : 403 `REC_VALIDATION_RESERVEE`, message (maquette, texte d'aide) « Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation admin et Instruction OK, sans attendre la préparation. ». Les effets de la validation relèvent de RG-COO (validation admin) et de RG-X-015.
- Sources : legacy `VIEW/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:24-39`, `BLL/ReceptionListeAfficheBll.cs:867-869` (RG-REC-027 provisoire ; RG-COO-026 provisoire de legacy-coordination.md) · spec `[README] §3, H1` ; EX-COO-010 ; EX-TRA-005 · écran ECR-REC-05 (bloc Validation admin), maquette `instructions.js:16-18`, `reception.js:85-88`
- Questions liées : Q-136
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — apps/api/src/modules/reception/permissions.ts (REC_VALIDATION_RESERVEE) ; core/permissions/catalogue.ts. Reste : Pas encore de service de validation admin (COO-P04).
- Tests : apps/api/src/modules/reception/complement.test.ts (6 profils)

### RG-REC-004 — Auteur et date tracés sur chaque action de réception
- Origine : NOUVELLE
- Énoncé : chaque action de réception (réception, contrôle, rattachement, retrait, changement de thème, validation, annulation de validation, réimpression, rebut, signalement) enregistre l'utilisateur authentifié (nom de la personne) et la date. La validation admin garde `validationAdmin_par` et `validationAdmin_le` ; chaque rattachement garde créé par/le et retiré par/le. Les comptes génériques partagés de Nîmes sont incompatibles avec cette traçabilité (comptes nominatifs requis).
- Déclencheur : toute écriture du module.
- Conditions : utilisateur authentifié identifiable.
- Effet / message d'erreur : refus 401 si non authentifié ; l'historique ne dit jamais « validée par Circé » (02/11).
- Sources : spec `[PP] §5`, `[RA] §4` (EX-TRA-036) ; `[DC] §2` (EX-TRA-007, EX-ADM-502) ; EX-COO-009 · écran ECR-REC-05 (Historique)
- Questions liées : Q-001, Q-003
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — core/identity.ts:requireIdentity ; auteurs posés par stock.ts, rattachement.ts, service.ts:changerStatutReception. Reste : Fournisseur de dev seulement (Q-001) ; actions des parcours suivants.
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts

### RG-REC-005 — Journal d'événements de réception
- Origine : NOUVELLE
- Énoncé : un journal (`th_edr_evenement`) enregistre pour chaque événement : réception, contrôle, rattachement, changement de thème, retrait, modification, impression et réimpression de feuille, étiquette rack, purge automatique (une ligne). Il alimente l'onglet Historique de l'affiche et Administration › Journal.
- Déclencheur : chaque événement listé.
- Conditions : —
- Effet / message d'erreur : une ligne (type, objet, auteur, date, ancienne/nouvelle valeur) ; écriture dans la MÊME transaction que l'événement.
- Sources : spec `[DC] §8, §11, §13` (EX-REC-080, EX-TRA-035) · écran ECR-REC-05, ECR-ADM-08
- Questions liées : Q-004
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — core/tracabilite.ts:ecrireJournal dans la transaction (rattacher, retirer, mouvement). Reste : Événements réception, contrôle, impression, purge : parcours suivants.
- Tests : apps/api/test/reception/socle-complement.int.test.ts (rollback)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — ré-audité : les événements sont journalisés dans la même transaction (actions CREATION_RECEPTION, CONTROLE_RECEPTION, AFFICHE_ASSOCIER / DISSOCIER, MODIFICATION_THEME, IMPRESSION_FEUILLE, IMPRESSION_ETIQUETTE_RACK, PURGE_ATTENDUES…) ; reste : Administration › Journal (ECR-ADM-08) non implémenté, aucun test n'asserte l'action CONTROLE_RECEPTION

### RG-REC-006 — Historique d'une affiche : champs et actions historisés
- Origine : MODIFIÉE
- Énoncé : l'historique de l'affiche garde ce qui s'est passé, avec qui et quand. Le legacy historise : dossier, semaines, annonceur, thème, format, validation admin, « à conserver » (`ModificationValidationAdmin` : coché / décoché ; `ModificationAfficherAConserver`), mise en rebus, vidage du rebus, association, création d'affiche. Il N'historise PAS : conservation, allée, rayon, zone picking, date de dernier départ, commentaire. La cible historise aussi les mouvements d'emplacement (allée/rayon) et la non-conformité saisie au contrôle (« Rangée : X-3 → B-7 (sortie de la zone tampon) »).
- Déclencheur : enregistrement de la fiche affiche ; rangement ; contrôle.
- Conditions : valeur modifiée (ancienne ≠ nouvelle).
- Effet / message d'erreur : une entrée `histo_historique_entite` (action, type d'entité 1 = Affiche, id entité, ancienne/nouvelle valeur, auteur, date) par champ modifié.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889 (852-869)`, `BLL/HistorisationBll.cs:16-38`, `legacy-integrations.md RG-INT-046` (RG-REC-024 provisoire) · spec `[DC] §8` (EX-REC-047), `[DC] §5, §10` (EX-REC-024) · écran ECR-REC-05 (onglet Historique), ECR-REC-10
- Questions liées : Q-004
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — historique de statut de l’affiche (rattacher, retirer). Reste : Historique par champ modifié : REC-P08 (fiche affiche).
- Tests : apps/api/test/reception/socle-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — ré-audité : historisés par champ modifié (une entrée par champ, ancienne / nouvelle valeur, auteur) : thème, annonceur, emplacement, commentaire, « à conserver », association / dissociation, création d'affiche, annulation de validation (tests affiches*.int.test.ts) ; non historisés : dossier, semaines, format, mise en rebus (aucun test) ; Administration › Journal (ECR-ADM-08) non implémenté

### RG-REC-007 — Changement de semaines et dissociation historisés avec la bonne action
- Origine : MODIFIÉE
- Énoncé : le retrait d'un rattachement (dissociation) est historisé avec une action de dissociation propre, portant l'identifiant de l'AFFICHE ; un changement de semaines est historisé avec une action « semaines » propre. Le legacy écrit la dissociation avec l'action `AfficheAssocier` (valeurs inversées) et l'id de la PRÉPA comme id d'entité, et historise un changement de `semaines` avec `ModificationDossierAffiche`.
- Déclencheur : retrait d'un rattachement ; modification des semaines.
- Conditions : —
- Effet / message d'erreur : entrées d'historique distinguables ; anomalie legacy non reprise.
- Sources : legacy `BLL/HistorisationBll.cs:16-38 (ligne 22), 68-76 (ligne 70)`, `BLL/ReceptionListeAfficheBll.cs:577-586` (RG-REC-024, RG-REC-092 provisoires) · spec EX-TRA-035 (« dissociation non historisée comme une association (anomalie existante) »)
- Questions liées : —
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — apps/api/src/modules/reception/rattachement.ts:retirerRattachement (AFFICHE_DISSOCIER, entité = affiche). Reste : Action « semaines » : REC-P08.
- Tests : apps/api/test/reception/socle-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — ré-audité : la dissociation est historisée avec l'action AFFICHE_DISSOCIER et l'identifiant de l'AFFICHE (rattachement.ts:retirerRattachement, testé) ; l'action « semaines » propre n'est pas implémentée (aucune écriture de semaines côté Réception : la règle reste à trancher avec RG-REC-006)

### RG-REC-008 — Doubles soumissions : clé d'idempotence
- Origine : NOUVELLE
- Énoncé : les POST de création et de transition du module (Valider la réception, Créer une réception inconnue, Rattacher, Valider le contrôle, Signaler, Imprimer) portent un en-tête `Idempotency-Key`. Un rejeu avec la même clé renvoie le résultat initial sans recréer de réception, d'affiche, de mouvement ni d'alerte. Règle d'ingénierie, non métier ; elle répond à l'anomalie de doublons de la Liste des affiches.
- Déclencheur : double clic, rejeu réseau.
- Conditions : même `Idempotency-Key` + même corps.
- Effet / message d'erreur : même réponse ; même clé avec un corps différent : 409 `REC_IDEMPOTENCE_CONFLIT`.
- Sources : CLAUDE.md §6 · spec EX-REC-081 (ANO-01 doublons), EX-REC-501 (doublement d'affiches)
- Questions liées : —
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — core/idempotency.ts:withIdempotency (code et règle du module OBLIGATOIRES) ; permissions.ts:REC.idempotence. Reste : Aucun POST REC-P01 : en-tête HTTP testé sur endpoint factice (étape 4) ; POST métier en REC-P03+.
- Tests : apps/api/test/reception/socle-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT (avant : PARTIEL) — FAIT : `Idempotency-Key` exigée sur tous les POST de création / transition Réception (routes-suite.ts : `idem`), nominal (rejeu de la réponse) et rejets (400 sans clé, 409 clé réutilisée avec un autre corps) testés ; seul `POST /api/receptions/verification` (vérification sans écriture) n'exige pas de clé

### RG-REC-009 — Verrouillage optimiste des réceptions et des affiches
- Origine : NOUVELLE
- Énoncé : réception et affiche portent un champ `version` ; toute modification (`updateMany where version`) qui ne touche aucune ligne est refusée. Deux utilisateurs qui rattachent, valident ou contrôlent la même palette/affiche en même temps ne s'écrasent pas. Règle d'ingénierie, non métier.
- Déclencheur : toute écriture sur réception ou affiche existante.
- Conditions : `version` envoyée ≠ `version` en base.
- Effet / message d'erreur : 409 `REC_CONFLIT_VERSION`, message « Cet élément a été modifié par un autre utilisateur : rechargez la page. » (libellé proposé).
- Sources : CLAUDE.md §6 · maquette Q-E (« actions de masse sans notion de version »)
- Questions liées : —
- Implémentation : FAIT (REC-P01, 2026-11-04) — apps/api/src/modules/reception/affiche.ts:ecrireAfficheVersionnee (toute écriture d’affiche) ; service.ts:changerStatutReception ; rattachement.ts (lien). Reste : Toutes les écritures existantes sont versionnées (réception, affiche, lien) ; les écritures des parcours suivants devront passer par ces fonctions.
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts ; socle-audit.int.test.ts

### RG-REC-010 — Menu Réception cible et badges
- Origine : MODIFIÉE
- Énoncé : l'onglet Réception propose trois entrées : « Réception des affiches » (étapes 1 et 2 sur une seule page ; badge = nombre de palettes à contrôler), « Liste des affiches », « Réceptions inconnues » (badge rouge = nombre d'affiches orphelines du périmètre). Legacy : menu à quatre entrées (Réception des affiches, Liste des affiches, Zone picking, Fusion des affiches) sous le droit `reception_liste_affiche`. « Zone picking » et « Fusion des affiches » ne sont pas repris. Les pages secondaires du rôle sont grisées (info-bulle « Écran secondaire pour le rôle sélectionné »).
- Déclencheur : rendu du menu.
- Conditions : rôle ; périmètre.
- Effet / message d'erreur : compteurs calculés sur le site choisi ; le compteur de l'onglet = celui de sa première page « chaude ».
- Sources : legacy `VIEW/Shared/_MenuNew.cshtml:122-138`, `BLL/CommunBll.cs:276-303` (RG-REC-120 provisoire) · spec `[README] §3, §7` (EX-REC-079) · écran ECR-REC-01 à 04 ; `maquettes-reception-coordination.md §1.2`
- Questions liées : Q-100, Q-101
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — apps/api/src/modules/reception/compteurs.ts:compteursReception ; apps/web/src/components/reception/menu-reception.tsx. Reste : Pages secondaires du rôle non grisées (info-bulle « Écran secondaire »), pas de barre de menus principale ni de sélecteur de site (Q-173) ; entrées Liste des affiches / Réceptions inconnues : P07, P08.
- Tests : apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts ; e2e/reception-attendues.spec.ts

### RG-REC-011 — Trois façons de trouver les dossiers du BL
- Origine : NOUVELLE
- Énoncé : le bandeau « Trouver les dossiers du BL » offre trois voies côte à côte : « Photographier le BL », « Photographier une affiche » (Circé reconnaît le visuel et propose les dossiers les plus proches) et le champ « N° de dossier, de DA, annonceur… » qui filtre les réceptions attendues. Recours : « Rien ne correspond ? » + bouton « Réception inconnue… ». Circé retient comment le dossier a été trouvé (RG-REC-032).
- Déclencheur : arrivée sur l'étape 1.
- Conditions : —
- Effet / message d'erreur : les lignes trouvées arrivent au panier cochées pour ce BL ; message vide du panier (maquette) « Aucune ligne. Trouvez les dossiers du BL en haut (photo du BL, photo d'une affiche, ou n° de dossier puis « Au panier ») : chaque ligne arrive avec sa case, cochée pour ce BL ; décochez celles d'un autre BL. Rien ne correspond : « Réception inconnue ». ».
- Sources : spec `[DC] §4` (EX-REC-002) ; `[PR] p.1` · écran ECR-REC-01
- Questions liées : Q-112
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — apps/web/src/routes/reception/index.tsx:BandeauRecherche. Reste : Photos du BL / d’une affiche : REC-P03 ; « Réception inconnue… » : REC-P07 ; seule la voie « n° de dossier » est active.
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — tests : renommage du test E2E « RG-REC-011 / RG-REC-012 recherche à la frappe » (identifiant ajouté)

### RG-REC-012 — Recherche à la frappe sur n° de dossier, DA, annonceur
- Origine : NOUVELLE
- Énoncé : la recherche se lance à la frappe (pas à la touche Entrée). Elle accepte n° de dossier, n° de DA, annonceur ; plusieurs valeurs (puces) ; liste collée ; les n° inconnus sont signalés (« Absents de cette page ») et les dossiers masqués par un filtre sont signalés avec le filtre en cause (« Masqués par <filtre> — Afficher »). Legacy : critères dossier (liste séparée par « + »), annonceur, thème, format, départ « S<n>/<année> » ; la touche Entrée ne lance pas la recherche dans « Ajouter préparation ».
- Déclencheur : saisie dans le champ.
- Conditions : —
- Effet / message d'erreur : filtre immédiat du tableau des Réceptions attendues. Contradiction de sources (README/DESIGN « saisie puis Entrée » vs REC-10) : REC-10 (frappe) retenu.
- Sources : spec `[DC] §7, §14, §16` (EX-REC-007) ; `[DESIGN] §4.3` ; legacy `BLL/ReceptionListeAfficheBll.cs:420-435, 484-531` (RG-REC-090 provisoire) ; EX-COO-506 (Entrée ne lance pas la recherche) · écran ECR-REC-01, maquette §2.2
- Questions liées : Q-165
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — apps/api/src/modules/reception/attendues.ts:jetonsRecherche, correspond, listerReceptionsAttendues (absents, masqués) ; apps/web/src/routes/reception/index.tsx (puces, frappe). Reste : Pas de suggestions (combobox) : Q-176 ; égalité stricte des n° (Q-176).
- Tests : apps/api/src/modules/reception/lignes.test.ts ; attendues-complement.test.ts ; apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts ; e2e/reception-attendues.spec.ts

### RG-REC-013 — Format du n° de dossier
- Origine : CONSERVÉE
- Énoncé : un n° de dossier saisi ou rattaché comporte exactement 6 chiffres (`^[0-9]{6,6}$` ; avec plusieurs dossiers, séparés par « + » dans la saisie héritée). Le suffixe « -W » de la 2e plateforme est accepté (RG-REC-025).
- Déclencheur : saisie ou rattachement d'un n° de dossier.
- Conditions : valeur non conforme au motif.
- Effet / message d'erreur : refus 400 `REC_DOSSIER_FORMAT`. Message legacy : « Attention, votre format de saise de dossier est inccorect. Exemple format attendue "100000+120000" » (fautes d'orthographe d'origine ; libellé corrigé à valider).
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:136-173`, `TOOLS/Helper/ReggexMatchForRule.cs:12-13, 36-47`, `TOOLS/Constant/Constants.cs:31-35` (RG-REC-026 point 1) · spec `[DC] §2, §10` (EX-REC-015 pour « -W »)
- Questions liées : Q-139, Q-150
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — packages/shared/src/reception/attendues.ts:NUMERO_DOSSIER ; apps/api/src/modules/reception/attendues.ts (400 REC_DOSSIER_FORMAT). Reste : Contrôle à la saisie / au rattachement d’un dossier : REC-P07/P08 ; libellé corrigé à valider (Q-176).
- Tests : packages/shared/src/shared.test.ts ; apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts

### RG-REC-014 — Réceptions attendues : lignes affichées
- Origine : MODIFIÉE
- Énoncé : le tableau « Réceptions attendues » (« Ce qu'on attend, issu de Broadcast dès la DA activée ») montre UNE ligne par thème (visuel) de dossier, du site choisi, hors dossiers annulés et hors thèmes exclus (« ne pas afficher », « reste en place » repris de Broadcast). Legacy : lignes `tf_prepa_affiche` (a) non reçues (`ARecevoir` 0/NULL) et sans affiche, (b) avec affiche mais `Qte_Theorique` > somme des mouvements ; formats « 2m2 Scrolling »/« 2m2 Venusial » renommés « 2m2 » ; regroupement par (livraison, dossier, format, thème, annonceur, semaine, année) avec `SUM(distinct Qte_Theorique)`.
- Déclencheur : ouverture de l'étape 1 ; modification d'un filtre.
- Conditions : ligne ACTIVE (non annulée), thème non exclu, plateforme = site.
- Effet / message d'erreur : colonnes visibles : Site, Dossier, Visuel, Départ, Reçu / attendu (n° d'affiche cliquable), Reste, Statut, Contrôle, Livraison prévue ; masquées : DA, Annonceur, Thème, Format, Attendu, Reçu, N° d'affiche. Vide : « Aucune ligne pour ces filtres. ». Message de site : « Aucune réception attendue à proposer sur ce site. ».
- Sources : legacy `FN/Fn_GetPrepaAffiche.sql:44-103, 106-221, 224-343`, `SP/p_GetPrepareListAffiches.sql:104-161` (RG-REC-071 provisoire ; RG-COO-013 de legacy-coordination.md) · spec `[DC] §4` (EX-REC-008, 009) ; EX-COO-032, 034 · écran ECR-REC-01 (tableau)
- Questions liées : Q-135, Q-138
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — apps/api/src/modules/reception/attendues.ts:chargerLignes ; apps/web/src/routes/reception/index.tsx (colonnes visibles et masquées, messages vides). Reste : Ligne « S43+S44 » d’un dossier multi-semaines : Q-138 / COO-P05.
- Tests : apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts ; e2e/reception-attendues.spec.ts

### RG-REC-015 — Filtre Départ et période par défaut
- Origine : MODIFIÉE
- Énoncé : la période est un filtre « Départ » en semaines de départ (options ≥ semaine de production ; défaut : semaine en production et suivantes pour la Réception) ; semaines ISO. Legacy : période par défaut « semaine courante → +8 semaines » avec gestion du changement d'année (52/53 semaines) et validation de la recherche : erreurs « La date de début doit être renseigné », « La date de fin doit être renseigné », « La date de fin doit être postérieur à la date de début » (le test accepte pourtant l'égalité).
- Déclencheur : ouverture de l'étape 1 ; changement du filtre.
- Conditions : au moins une semaine retenue pour afficher des lignes.
- Effet / message d'erreur : la validation à dates début/fin du legacy disparaît avec la liste à cocher (anomalie « postérieur » non reprise). Les semaines sont ISO (le legacy mélange `DATEPART(wk)` et ISO).
- Sources : legacy `BLL/LivraisonAfficheService.cs:52-83, 216-227, 247-272`, `CTRL/LivraisonAfficheController.cs:52-83, 97-128` (RG-REC-070 provisoire) · spec `[DESIGN] §4.3`, `[README] §2.3` ; EX-COO-038 (semaines ISO) · écran ECR-REC-01 (filtre Départ)
- Questions liées : —
- Implémentation : FAIT (REC-P02, 2026-11-04) — apps/api/src/modules/reception/attendues.ts (défaut ≥ semaine courante, options ≥ semaine de production, depart=tous) ; packages/shared/src/semaines.ts. Reste : Libellés « en préparation / à venir » : Q-176.
- Tests : packages/shared/src/shared.test.ts ; apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts ; e2e/reception-attendues.spec.ts

### RG-REC-016 — Filtres du tableau des Réceptions attendues et valeurs par défaut
- Origine : NOUVELLE
- Énoncé : filtres en listes à cocher : Statut (par défaut « Attendue » + « Partielle »), Départ, Format ; Contrôle et Annonceur par « + Filtre ». Aucune coche = tout ; OU entre valeurs d'un filtre, ET entre filtres ; compteurs par valeur. Actions par ligne : « Au panier », « Feuille de stock » (réimpression d'une affiche déjà contrôlée) ; en masse : « Ajouter au panier (n) » ; export Excel.
- Déclencheur : arrivée sur l'étape 1.
- Conditions : « Feuille de stock » visible si au moins une affiche contrôlée.
- Effet / message d'erreur : teinte de ligne : Surplus → avertissement, Partielle → important.
- Sources : spec `[DC] §4` (EX-REC-008) ; `[DESIGN] §4.3` · écran ECR-REC-01 (filtres), maquette §2.2
- Questions liées : —
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — PARTIEL : REC-P02/P03/P06 (2026-11-04) : reste l’export Excel (Q-175) ; « Au panier » et « Feuille de stock » faits
- Tests : apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts ; e2e/reception-attendues.spec.ts ; e2e/reception-panier.spec.ts

### RG-REC-017 — Reçu, attendu et reste à recevoir
- Origine : NOUVELLE
- Énoncé : le « reçu » d'un visuel (ligne attendue) = somme des quantités rattachées ACTIVES des affiches (et non somme des mouvements, décision du 21/10) ; un reçu multi-semaines est compté une fois. Reste = max(0, attendu − reçu). L'attendu vient de Broadcast (ligne `BC`) ou de la prépa (ligne `PREPA`). Réception et écart de contrôle comptent dans le reçu ; le rebut ne le réduit pas (il réduit le stock).
- Déclencheur : tout événement qui change un rattachement ou une quantité.
- Conditions : rattachements actifs seulement.
- Effet / message d'erreur : colonne « Reçu / attendu » (« 4 / 7 ») avec n° d'affiche(s) cliquables → fiche affiche. La vision « manquant » est calculée sur UNE ligne par clé (pas de split par type de préparation, anomalie EX-REC-522).
- Sources : spec `[DC] §9, §13` (EX-REC-057, EX-REC-522, EX-EXI-059) ; EX-COO-039 · écran ECR-REC-01 (Reçu / attendu, Reste)
- Questions liées : Q-103, Q-123
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — apps/api/src/modules/reception/lignes.ts:attenduDe, resteDe ; apps/api/src/modules/reception/attendues.ts (reçu = Σ liens actifs). Reste : N° d’affiche cliquables vers la fiche affiche : REC-P08.
- Tests : apps/api/src/modules/reception/lignes.test.ts ; apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts ; e2e/reception-attendues.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — ré-audité : les n° d'affiche de la liste ne sont PAS cliquables vers la fiche affiche (REC-P08 jamais câblé), la colonne « Besoins couverts » et le mode « Compact » de ECR-REC-01 ne sont pas faits : consignés en écart (ECARTS) ; statut PARTIEL conservé

### RG-REC-018 — Statut de la ligne attendue : Attendue, Partielle, Complète, Surplus
- Origine : MODIFIÉE
- Énoncé : statut calculé une fois à chaque événement et lu par tous les écrans : « Attendue » (reçu = 0) ; « Partielle » (0 < reçu < attendu) ; « Complète » (reçu ≥ attendu ET reçu ≤ attendu × (1 + `ecartReception`)) ; « Surplus » (reçu > attendu × (1 + `ecartReception`), strictement). `ecartReception` = paramètre (10 %) : la maquette code 1,10 en dur, à ne pas reprendre. Legacy : seulement « Terminé » / « Partiel » (Σ mouvements ≥ / < `Qte_Théorique`).
- Déclencheur : valider la réception, rattacher/retirer, contrôle avec écart.
- Conditions : attendu > 0.
- Effet / message d'erreur : pastille : Attendue (bleu clair), Partielle (Important), Complète (OK), Surplus (À surveiller). Une ligne Partielle reste proposée à la réception (le thème ne disparaît pas à la 2e livraison, EX-REC-511).
- Sources : legacy `FN/Fn_GetPrepaAffiche.sql:106-221` ; `Partial_GridAfficheList.cshtml:8-20` (EX-EXI-076) · spec `[DC] §9` (EX-REC-051, EX-REC-511) · écran ECR-REC-01 (« Seuils »)
- Questions liées : Q-105, Q-133
- Implémentation : FAIT (REC-P02, 2026-11-04) — apps/api/src/modules/reception/lignes.ts:statutLigneDe, recalculerLigne (versionné, historisé) ; apps/api/src/modules/reception/statuts.ts:TRANSITIONS_LIGNE ; apps/api/src/modules/reception/parametres.ts (écart global, Q-105). Reste : Attendu 0 et reçu > 0 → Surplus : Q-176.
- Tests : apps/api/src/modules/reception/lignes.test.ts ; attendues-complement.test.ts ; apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts

### RG-REC-019 — Colonne Contrôle de la ligne attendue
- Origine : NOUVELLE
- Énoncé : colonne « Contrôle » : « Rien reçu » (aucune affiche rattachée), « À contrôler » (au moins une affiche rattachée dont la palette est à contrôler), « Contrôlée » (affiches contrôlées ; feuille de stock réimprimable). Calculée avec le statut de la ligne.
- Déclencheur : événement de réception ou de contrôle.
- Conditions : —
- Effet / message d'erreur : pastille « À contrôler » en À surveiller, « Contrôlée » en OK ; filtre « Contrôle » dans « + Filtre ».
- Sources : spec `[DC] §9` (EX-REC-051) ; `[PR] p.1` · écran ECR-REC-01
- Questions liées : —
- Implémentation : FAIT (REC-P02, 2026-11-04) — apps/api/src/modules/reception/lignes.ts:controleDe ; apps/api/src/modules/reception/attendues.ts. Reste : Affiche sans réception = contrôlée : HYPOTHÈSE Q-174.
- Tests : apps/api/src/modules/reception/lignes.test.ts ; apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts ; e2e/reception-attendues.spec.ts

### RG-REC-020 — Colonne « Livraison prévue »
- Origine : NOUVELLE
- Énoncé : la colonne « Livraison prévue » affiche une date (« jeu. 15/10 »), « Print Cityz » (imprimeur interne) ou « — ». Une date prévisionnelle de livraison saisie manuellement avec commentaire est demandée par les ateliers pour remplacer les échanges mail sur les manquants jusqu'à J-3. Source et auteur de la date non tranchés.
- Déclencheur : affichage ; saisie éventuelle.
- Conditions : —
- Effet / message d'erreur : affichage seul tant que Q-134 n'est pas tranchée.
- Sources : spec `[DC] §4` (EX-REC-008, ambiguïté) ; ateliers (EX-REC-520, EX-REC-516) · écran ECR-REC-01 (colonne Livraison prévue)
- Questions liées : Q-134
- Implémentation : BLOQUÉ (REC-P02, 2026-11-04) — apps/api/src/modules/reception/attendues.ts (livraisonPrevue = null, affiché « — »). Reste : Source et saisie de la date : Q-134.
- Tests : apps/api/test/reception/attendues-complement.int.test.ts

### RG-REC-021 — Panier : composition et actions
- Origine : MODIFIÉE
- Énoncé : le panier (« Lignes du BL ») a une case par ligne, cochée d'office, une case « tout » (état indéterminé) ; colonnes Dossier, « Annonceur · thème » (+ champ « Intitulé saisi (sans IP) » si IP non saisies), Reste attendu, Qté du BL (modifiable), Livraison en deux fois ; actions « Retirer », « Vider le panier ». Il n'y a plus de colonne « Ordre » (RG-REC-193). Ajouter une ligne déjà au panier est refusé. Legacy : empilement en session sans dédoublonnage, vidé après validation d'une livraison ; la liste « à réceptionner » masque les prépas déjà au panier.
- Déclencheur : « Au panier », « Ajouter au panier (n) », « Mettre au panier » (modales photo), « Retirer », « Vider le panier ».
- Conditions : ligne non déjà au panier.
- Effet / message d'erreur : doublon : « Ce visuel est déjà au panier. » ; ajout : « n ligne(s) ajoutée(s) au panier. » ; sous-titre « n cochée(s) sur m pour ce BL… ».
- Sources : legacy `CTRL/LivraisonAfficheController.cs:107-111, 251, 294, 459-479` (RG-REC-072 provisoire) · spec `[DC] §4` (EX-REC-010) · écran ECR-REC-01 (carte Lignes du BL)
- Questions liées : —
- Implémentation : PARTIEL (REC-P03, 2026-11-04) — FAIT : REC-P03/P04 (2026-11-04) : intitulé saisi et case « Complément » faits (REC-P04)
- Tests : apps/web/src/lib/panier.test.ts ; apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts ; e2e/reception-panier.spec.ts

### RG-REC-022 — Un BL = une réception ; seules les lignes cochées entrent
- Origine : NOUVELLE
- Énoncé : seules les lignes cochées entrent dans la réception ; les autres restent au panier pour le BL suivant. Une palette avec deux BL donne deux réceptions. Le panier peut réunir plusieurs BL. Le formulaire dit « Pour les n ligne(s) cochée(s) » et le bouton « Valider la réception (n lignes) ».
- Déclencheur : « Valider la réception ».
- Conditions : ≥ 1 ligne cochée (RG-REC-037).
- Effet / message d'erreur : les lignes cochées quittent le panier ; le reste demeure.
- Sources : spec `[DC] §1, §4, §10` (EX-REC-011) · écran ECR-REC-01
- Questions liées : Q-102
- Implémentation : PARTIEL (REC-P03, 2026-11-04) — FAIT : REC-P03/P04 (2026-11-04) : les lignes validées quittent le panier, les autres restent (RG-REC-045)
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts ; apps/web/src/lib/panier.test.ts ; e2e/reception-panier.spec.ts ; e2e/reception-panier.spec.ts ; apps/api/test/reception/validation.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — `retirerCochees` (lib/panier.ts) est une fonction orpheline (appelée seulement par panier.test.ts) : retirée de l'implémentation citée

### RG-REC-023 — Quantité du BL d'une ligne
- Origine : NOUVELLE
- Énoncé : « Qté du BL » est un nombre ≥ 0, modifiable, par défaut = reste attendu (ou attendu avec entretien si pas de reste). Une ligne à quantité 0 est ignorée à la validation. Le legacy n'impose aucune validation sur la quantité (Ajout : 0 ou négatif accepté).
- Déclencheur : saisie ; validation de la réception.
- Conditions : valeur < 0 refusée.
- Effet / message d'erreur : refus 400 `REC_QTE_NEGATIVE` (« La quantité doit être supérieure ou égale à 0. », libellé proposé) ; quantité 0 : ligne ignorée (la maquette n'affiche aucun message : Q-166).
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:800-835 (812-818)` (RG-REC-021 provisoire) ; `BLL/LivraisonAfficheService.cs:827-844` (RG-REC-076) · spec EX-REC-010 · écran ECR-REC-01 (carte Lignes du BL) ; Q-REC-5 de la maquette
- Questions liées : Q-166
- Implémentation : PARTIEL (REC-P03, 2026-11-04) — apps/api/src/modules/reception/bon-livraison.ts (400 REC_QTE_NEGATIVE, ligne à 0 ignorée, REC_AUCUNE_QUANTITE) ; apps/web/src/lib/panier.ts (défaut = reste). Reste : Défaut « attendu avec entretien » : l’entretien n’est pas connu côté Réception, défaut = attendu (Q-177 (9)) ; « ignorée à la validation » : effective à la création (REC-P04).
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts ; apps/web/src/lib/panier.test.ts ; e2e/reception-panier.spec.ts

### RG-REC-024 — Un BL ne livre qu'une plateforme
- Origine : NOUVELLE
- Énoncé : toutes les lignes cochées d'un BL appartiennent à la même plateforme ; une affiche et sa ligne attendue sont toujours sur la même plateforme. Un dossier livré sur les deux plateformes compte deux lignes (une par plateforme).
- Déclencheur : « Valider la réception » ; rattachement d'une affiche à une ligne.
- Conditions : lignes cochées sur deux plateformes ; rattachement inter-plateformes.
- Effet / message d'erreur : 422 `REC_BL_DEUX_PLATEFORMES`, message « Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. ». Une affiche destinée à l'autre plateforme se transfère puis se réceptionne (EX-COO-045).
- Sources : spec `[DC] §2, §10` (EX-REC-015) ; EX-COO-045 · écran ECR-REC-01 (règle 3)
- Questions liées : Q-139
- Implémentation : FAIT (REC-P03, 2026-11-04) — apps/api/src/modules/reception/bon-livraison.ts (REC_BL_DEUX_PLATEFORMES) ; apps/api/src/modules/reception/rattachement.ts (REC_RATTACHEMENT_AUTRE_PLATEFORME). Reste : Transfert d’une affiche vers l’autre plateforme : EX-COO-045 (Coordination).
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts

### RG-REC-025 — Suffixe « -W » du dossier de la 2e plateforme
- Origine : NOUVELLE
- Énoncé : un dossier livré sur les deux plateformes : la part de la 2e plateforme garde le n° de dossier et la DA avec le suffixe « -W » (maquette : deux dossiers `id` et `id-W`, même n° Broadcast, même DA). La Réception affiche et recherche ce suffixe ; qui le pose, sur quel champ et pour quelle plateforme n'est pas précisé.
- Déclencheur : alimentation des lignes attendues (module Coordination) ; recherche à la réception.
- Conditions : dossier présent sur deux plateformes.
- Effet / message d'erreur : la recherche par n° de dossier retrouve les deux variantes ; « Dossier » affiché avec suffixe.
- Sources : spec `[DC] §2, §10` (EX-REC-015, ambiguïté) · écran ECR-REC-01 (colonne Dossier : « suffixe `-W` pour 2e plateforme ») ; `maquettes-autres-modules.md §C`
- Questions liées : Q-139
- Implémentation : PARTIEL (REC-P03, 2026-11-04) — apps/api/src/modules/reception/attendues.ts (recherche avec -W). Reste : Pose du suffixe par l’alimentation (Coordination, Q-139).
- Tests : apps/api/test/reception/attendues*.int.test.ts

### RG-REC-026 — Photo du BL obligatoire
- Origine : NOUVELLE
- Énoncé : la photo du BL est obligatoire dans TOUS les cas, même si les lignes sont trouvées par la recherche (« Joindre le BL »). Seule exception : palette arrivée sans BL (réception inconnue). Tant que la photo manque, un encadré « BL à photographier » porte le bouton « Photographier le BL » et la validation est refusée. La photo se revoit au contrôle (« Voir le BL ») ; la fiche de réception porte « Photo du BL jointe ».
- Déclencheur : « Valider la réception ».
- Conditions : pas de photo du BL et la réception n'est pas une réception inconnue sans BL.
- Effet / message d'erreur : 422 `REC_PHOTO_BL_MANQUANTE`, message « Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche. ».
- Sources : spec `[DC] §1, §4, §10` (EX-REC-003) ; `[DESIGN] §4.8` · écran ECR-REC-01 (règle 4), ECR-REC-07, ECR-REC-11
- Questions liées : Q-112, Q-113
- Implémentation : PARTIEL (REC-P03, 2026-11-04) — FAIT : REC-P03/P05/P07 (2026-11-04) : exception « palette sans BL » (RG-REC-098) et « Voir le BL » au contrôle faits
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts ; e2e/reception-panier.spec.ts ; apps/api/test/reception/inconnues.int.test.ts

### RG-REC-027 — Photo du BL et pièces jointes : stockage, consultation, contrôles
- Origine : MODIFIÉE
- Énoncé : la photo du BL (et la photo d'une affiche) est stockée, reliée à la réception, et consultable au contrôle (« Voir le BL ») et depuis la fiche de réception. Legacy : upload d'un ou plusieurs fichiers → `photo` (intitulé, taille, extension) + fichier disque `<FileLivraisonPieceJointe>_<Ticks><ext>` + `asso_livraison_photo` ; téléchargement renvoyé en `application/pdf` quel que soit le type ; suppression seulement si le fichier existe sur disque ; AUCUNE validation de type, de taille ni de droit. Cible : type et taille validés, type MIME de téléchargement exact, suppression cohérente base/stockage, droits contrôlés (RG-REC-002).
- Déclencheur : « Photographier le BL », « Reprendre la photo », « Prendre une photo » (réception inconnue), téléchargement, suppression.
- Conditions : fichier d'un type et d'une taille acceptés (valeurs à fixer : Q-113) ; identifiant de réception non nul (le legacy lève une exception si `IdLivraisonPhoto` est nul).
- Effet / message d'erreur : photo rattachée à la réception ; refus 400 `REC_PHOTO_INVALIDE` (type/taille). Les autres pièces jointes de l'écran de livraison actuel ne sont pas confirmées dans la cible (Q-160).
- Sources : legacy `CTRL/LivraisonAfficheController.cs:482-542`, `BLL/LivraisonAfficheService.cs:959-1026`, `REPO/LivraisonAfficheRepository.cs:470-551` (RG-REC-080 provisoire) · spec `[DC] §4, §8` (EX-REC-003, EX-REC-012) ; `bdd.md §10` · écran ECR-REC-07, ECR-REC-11, ECR-REC-06
- Questions liées : Q-113, Q-160
- Implémentation : PARTIEL (REC-P03, 2026-11-04) — apps/api/src/modules/reception/photos.ts:enregistrerPhoto, lirePhoto (type MIME exact, 400 REC_PHOTO_INVALIDE) ; routes POST/GET /api/photos. Reste : Lien photo ↔ réception à la création (REC-P04) ; suppression ; autres pièces jointes : Q-160.
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours)

### RG-REC-028 — Lecture du BL et pré-remplissage
- Origine : NOUVELLE
- Énoncé : Circé lit sur la photo du BL : n° de contrat, annonceur, semaine, format, quantité, vignette du visuel ; il propose les réceptions attendues et pré-remplit le bon de livraison (n° de BL, imprimeur, transporteur, colis). Les lignes lues sont cochées au panier, les autres lignes du panier sont décochées ; l'agent vérifie. Circé retient comment le dossier a été trouvé (RG-REC-032). La technologie de lecture (OCR/vision) n'est pas spécifiée et est SIMULÉE dans la maquette ; le seuil de « lecture sûre » n'est pas défini.
- Déclencheur : « Mettre au panier » dans la modale Photo du BL.
- Conditions : photo fournie.
- Effet / message d'erreur : message « n ligne(s) du BL au panier, cochées pour ce BL… ; bon de livraison pré-rempli : vérifiez, puis validez la réception. » (+ « Une ligne sans dossier : réception inconnue. »). HYPOTHÈSE retenue (Q-112) : en V1 la photo est jointe et la recherche reste manuelle ; la lecture automatique est prévue derrière une interface `LlmProvider` sans implémentation de reconnaissance tant que Q-112 n'est pas tranchée.
- Sources : spec `[DC] §4` (EX-REC-004) ; `[DESIGN] §4.8` ; ateliers EX-REC-507 · écran ECR-REC-07 (mode BL)
- Questions liées : Q-112, Q-125
- Implémentation : BLOQUÉ (REC-P03, 2026-11-04) — —. Reste : Q-112 : pas de lecture automatique du BL en V1 (interface LlmProvider seulement).
- Tests : —

### RG-REC-029 — Contrat illisible : candidats
- Origine : NOUVELLE
- Énoncé : si le n° de contrat d'une ligne du BL est illisible (pastille « Contrat illisible »), Circé propose des candidats classés : même annonceur, même semaine, même format, vignette ressemblante ; « Aucun : réception inconnue » ouvre le formulaire de réception inconnue pré-rempli. Algorithme de classement, nombre maximum de candidats et seuil non spécifiés (la maquette utilise un score fictif 0,5/0,2/0,1/0,15, un seuil 0,3 et 3 candidats : valeurs fabriquées, non reprises).
- Déclencheur : lecture du BL avec ligne au contrat illisible.
- Conditions : au moins un candidat au-dessus du seuil (valeur à fixer).
- Effet / message d'erreur : sans candidat : « Aucune réception attendue à proposer sur ce site. ».
- Sources : spec `[DC] §4` (EX-REC-005) · écran ECR-REC-07 (mode BL)
- Questions liées : Q-125
- Implémentation : BLOQUÉ (REC-P03, 2026-11-04) — —. Reste : Q-112 / Q-125 : dépend de la lecture du BL.
- Tests : —

### RG-REC-030 — Ligne cochée absente du BL photographié
- Origine : NOUVELLE
- Énoncé : pour des lignes trouvées par la recherche (et non par la photo), une ligne cochée qui est absente du BL photographié est signalée par un encadré d'avertissement « n ligne(s) cochée(s) absente(s) du BL photographié ». Le signalement est-il bloquant : non précisé.
- Déclencheur : photo du BL jointe alors que des lignes cochées viennent de la recherche.
- Conditions : ligne cochée non lue sur la photo.
- Effet / message d'erreur : HYPOTHÈSE (Q-167) : signalement NON bloquant, la validation reste possible.
- Sources : spec `[DC] §4, §17 (scénario 3)` (EX-REC-006) · écran ECR-REC-01 (carte Bon de livraison)
- Questions liées : Q-167
- Implémentation : BLOQUÉ (REC-P03, 2026-11-04) — —. Reste : Q-112 : sans lecture du BL, une « ligne absente du BL photographié » ne peut pas être détectée.
- Tests : —

### RG-REC-031 — Photographier une affiche : reconnaissance du visuel
- Origine : NOUVELLE
- Énoncé : « Photographier une affiche » : Circé reconnaît le visuel et propose les dossiers les plus proches (jusqu'à 3 dans la maquette, avec score) ; la photo de l'affiche est jointe à la réception ; la quantité sur la palette est saisie (nombre ≥ 0, défaut = reste du dossier reconnu) ; « Aucun : réception inconnue ». La reconnaissance visuelle (REC-17) est hors périmètre avant le 31/12 et simulée dans la maquette.
- Déclencheur : « Photographier une affiche ».
- Conditions : visuel reconnu ou choisi.
- Effet / message d'erreur : « Visuel reconnu : 1 ligne au panier ; la photo de l'affiche est jointe à la réception. » ; mode de rattachement VISUEL (RG-REC-032).
- Sources : spec `[DC] §4` (EX-REC-002, 507) ; ateliers · écran ECR-REC-07 (mode affiche)
- Questions liées : Q-112, Q-125
- Implémentation : BLOQUÉ (REC-P03, 2026-11-04) — —. Reste : Q-112 / Q-125 : reconnaissance du visuel hors V1.
- Tests : —

### RG-REC-032 — Mode de rattachement mémorisé (BL, visuel, à la main)
- Origine : NOUVELLE
- Énoncé : chaque rattachement garde `mode_rattachement` : « BL » (contrat lu sur la photo du BL et choisi), « VISUEL » (reconnaissance d'une photo d'affiche), « MAIN » (n° de dossier tapé ou rattachement manuel depuis la fiche ou Réceptions inconnues). Cette valeur alimente la proposition de validation admin (motif de doute « Rattachée sans le n° du BL » pour VISUEL et MAIN, RG-X-002).
- Déclencheur : création d'un rattachement.
- Conditions : —
- Effet / message d'erreur : valeur écrite avec le rattachement (colonne `affiche.mode_rattachement` / `asso_affiche_visuel`).
- Sources : spec `[DC] §13` (EX-REC-080, EX-REC-004) ; EX-COO-005, 007 · écran ECR-REC-01/07, ECR-REC-04
- Questions liées : Q-125
- Implémentation : apps/api/src/modules/reception/bon-livraison.ts (mode BL imposé par le serveur pour le panier, Q-184) ; inconnues.ts / affiches.ts (MAIN) — PARTIEL : Q-184 TRANCHÉE (2026-11-05) : panier = BL, MAIN = rattachement à la main
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; apps/api/test/reception/bon-livraison-complement.int.test.ts

### RG-REC-033 — Formulaire « Bon de livraison » : champs et obligations
- Origine : MODIFIÉE
- Énoncé : champs : Lignes de ce BL (lecture : nb de lignes et d'affiches) ; Date de livraison (lecture = maintenant) ; N° de BL (texte, OBLIGATOIRE ; BL imprimeur = BL transporteur) ; Transporteur (liste des livreurs, OBLIGATOIRE) ; Imprimeur (liste, OBLIGATOIRE) ; Nombre de colis / palettes (nombre ≥ 1, défaut 1) ; « Déchargé par » (liste des agents de réception, plus de champ libre ; facultatif dans la maquette). Legacy : Référence (BL), Expéditeur (= transporteur), Imprimeur obligatoires + date, nbre de colis, ref dossier, ref DA, commentaire, déchargé par (texte libre).
- Déclencheur : « Valider la réception ».
- Conditions : N° de BL, transporteur ou imprimeur vide.
- Effet / message d'erreur : 422 `REC_BL_CHAMPS_OBLIGATOIRES`, message « N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. ». Messages legacy par champ (clés `Reference`, `Expediteur`, `Imprimeur`) : « Il faut renseigner la réference », « Il faut vérifier l'expéditeur », « Il faut vérifier l'imprimeur ».
- Sources : legacy `CTRL/LivraisonAfficheController.cs:396-447 (430, 440)`, `BLL/LivraisonAfficheService.cs:852-862`, `JS/LivraisonListeAffiche.js:160-168, 211-217` (RG-REC-074 provisoire) · spec `[DC] §4, §14` (EX-REC-012, 013) · écran ECR-REC-01 (carte Bon de livraison)
- Questions liées : Q-116, Q-121, Q-163
- Implémentation : FAIT (REC-P03, 2026-11-04) — apps/api/src/modules/reception/bon-livraison.ts (REC_BL_CHAMPS_OBLIGATOIRES, colis ≥ 1) ; apps/web/src/components/reception/bon-livraison.tsx. Reste : —
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts ; e2e/reception-panier.spec.ts

### RG-REC-034 — Date de livraison
- Origine : MODIFIÉE
- Énoncé : la date de livraison est obligatoire et valide ; en cible elle est en LECTURE = date et heure de la validation (la modification de la date de livraison de la fenêtre actuelle n'est pas confirmée dans la cible). La date de livraison devient la `date_entree` des affiches créées.
- Déclencheur : « Valider la réception ».
- Conditions : date ≤ valeur minimale (`DateTime.MinValue`) refusée dans le legacy.
- Effet / message d'erreur : legacy : « La date de livraison n'est pas valide » (clé `DateLivraison`).
- Sources : legacy `CTRL/LivraisonAfficheController.cs:396-447`, `BLL/LivraisonAfficheService.cs:852-862` (RG-REC-074 provisoire) · spec `[DC] §4` (EX-REC-012, ambiguïté) · écran ECR-REC-01 (Date de livraison : lecture = maintenant)
- Questions liées : Q-121
- Implémentation : apps/api/src/modules/reception/validation.ts (date de livraison = date d’entrée des affiches = maintenant) — FAIT : REC-P04 (2026-11-04) : date non modifiable (Q-121)
- Tests : apps/api/test/reception/bon-livraison.int.test.ts

### RG-REC-035 — Imprimeurs, transporteurs et agents : listes fermées des référentiels
- Origine : MODIFIÉE
- Énoncé : Imprimeur, Transporteur (livreur) et « Déchargé par » / Contrôleur sont choisis dans les référentiels Imprimeurs, Livreurs, Agents de réception (Administration, lot 0). Un transporteur ou imprimeur inconnu n'est JAMAIS créé : la création automatique du legacy est inopérante (condition `Expediteurs == null && !(…).Any(…)` jamais vraie, `CreateNewExpediteur/Imprimeur` jamais appelées) et la saisie libre n'enrichit pas `tr_transposteur_reception` / `tr_imprimeur`.
- Déclencheur : validation d'une réception ; création d'une réception inconnue ; contrôle.
- Conditions : valeur absente du référentiel.
- Effet / message d'erreur : 422 `REC_REFERENTIEL_INCONNU` (HYPOTHÈSE Q-115 : pas de création à la volée ; l'administrateur ajoute la valeur dans Administration).
- Sources : legacy `BLL/LivraisonAfficheService.cs:852-862` (RG-REC-074 provisoire) · spec `[DC] §11, §15` (EX-REC-074, EX-ADM-501) · écran ECR-ADM-07
- Questions liées : Q-115
- Implémentation : apps/api/src/modules/reception/referentiels.ts ; bon-livraison.ts ; controle.ts (contrôleur = agent du site) — FAIT : REC-P05 (2026-11-04) : agents = utilisateurs recep du site (HYPOTHÈSE Q-177 (1))
- Tests : apps/api/test/reception/bon-livraison.int.test.ts

### RG-REC-036 — Unicité du n° de BL
- Origine : NOUVELLE
- Énoncé : le n° de BL est contrôlé contre les réceptions existantes. Le legacy n'a aucun contrôle d'unicité de `Reference` et le schéma n'a aucune contrainte (`bdd.md §10` propose d'ajouter l'unicité de `livraison.Reference`). Périmètre d'unicité (BL seul, BL + imprimeur, BL + plateforme) non tranché.
- Déclencheur : « Valider la réception ».
- Conditions : même n° de BL déjà utilisé sur ce périmètre.
- Effet / message d'erreur : HYPOTHÈSE (Q-114) : avertissement avec confirmation explicite (code `REC_BL_DOUBLON`, message « Ce n° de BL a déjà été réceptionné (réception R…). Continuer ? »), non bloquant (un complément arrive sous un autre BL).
- Sources : legacy `BLL/LivraisonAfficheService.cs:852-862` · `bdd.md §10` (contraintes absentes à ajouter)
- Questions liées : Q-114
- Implémentation : apps/api/src/modules/reception/validation.ts (409 REC_BL_DOUBLON sans confirmerDoublon) ; bon-livraison.ts — FAIT : REC-P04 (2026-11-04) : confirmation explicite ; périmètre d’unicité HYPOTHÈSE Q-114 / Q-177 (5)
- Tests : apps/api/test/reception/validation.int.test.ts ; apps/api/test/reception/bon-livraison.int.test.ts

### RG-REC-037 — Ordre des refus à « Valider la réception »
- Origine : MODIFIÉE
- Énoncé : « Valider la réception » refuse, dans cet ordre et au premier échec : (1) panier vide ; (2) aucune ligne cochée ; (3) lignes cochées sur deux plateformes ; (4) BL non photographié ; (5) n° de BL, transporteur ou imprimeur vide. Aucune écriture n'est faite en cas de refus (le legacy poursuit : après une erreur de validation il crée quand même des mouvements sur une livraison vide et envoie le mail).
- Déclencheur : clic « Valider la réception ».
- Conditions : voir ordre.
- Effet / message d'erreur : (1) 422 `REC_PANIER_VIDE` « Le panier est vide. » ; (2) 422 `REC_AUCUNE_LIGNE_COCHEE` « Cochez dans le panier les lignes de ce BL. » ; (3) 422 `REC_BL_DEUX_PLATEFORMES` « Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. » ; (4) 422 `REC_PHOTO_BL_MANQUANTE` « Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche. » ; (5) 422 `REC_BL_CHAMPS_OBLIGATOIRES` « N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. ».
- Sources : legacy `CTRL/LivraisonAfficheController.cs:221-250, 285-295` (RG-REC-077 provisoire : erreur non bloquante) · spec `[DC] §4` (EX-REC-013) · écran ECR-REC-01 (règles visibles au clic, `reception.js:503-509`)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04)
- Tests : apps/api/test/reception/validation-complement.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-038 — Valider la réception : création de la réception « À contrôler »
- Origine : MODIFIÉE
- Énoncé : « Valider la réception » crée UNE réception (palette = un BL) au statut RECEPTION.A_CONTROLER, avec photo du BL, en-tête (RG-REC-033), date de livraison, `a_controler_depuis` = maintenant ; la palette passe à l'étape 2 sans étiquette de palette. Legacy : création d'une `livraison` sans statut ni plateforme.
- Déclencheur : « Valider la réception » après contrôles (RG-REC-037).
- Conditions : toutes les gardes de RG-REC-037 passées.
- Effet / message d'erreur : confirmation (maquette) « Réception R… : n ligne(s), « affiche reçue » = oui dès l'arrivée ; n unité(s) prête(s) à produire. La palette passe à l'étape 2 (contrôle). Validation admin : n rattachement(s) proposé(s) à confirmer, n avec un doute… (Coordination). [Il reste n ligne(s) au panier…] ».
- Sources : legacy `BLL/LivraisonAfficheService.cs:399-530` (RG-REC-075 provisoire) · spec `[DC] §4, §15` (EX-REC-014, 001) · écran ECR-REC-01 (effets), ECR-REC-02
- Questions liées : Q-102, Q-168
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04)
- Tests : apps/api/test/reception/validation.int.test.ts ; apps/api/test/reception/validation-complement.int.test.ts ; e2e/reception-panier.spec.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-039 — Création des affiches à la réception
- Origine : MODIFIÉE
- Énoncé : pour chaque ligne cochée à quantité > 0, une affiche est créée (n° d'affiche généré), statut IDENTIFIEE, tag « À contrôler », en zone tampon (allée/rayon vides), avec : plateforme et support (format) issus de la ligne attendue, `date_entree` = date de livraison, annonceur, dossier, thème (saisi sinon thème de la ligne), repiquage vide par défaut, quantité = quantité du BL, description. Legacy : affiche créée avec `quantite = SaisieQte_Rec`, GUID ; pour un BC saisi à la main (prépa non trouvée) `sup_id` par nom de format (`GetFormatId` renvoie 0 si inconnu → violation de FK probable) : en cible le format est obligatoire et connu.
- Déclencheur : « Valider la réception ».
- Conditions : ligne cochée, quantité > 0, `affiche_id` ≤ 0 (pas de complément, RG-REC-040).
- Effet / message d'erreur : insert `affiche` ; historique `CreationAffiche` pour chaque affiche créée (pas pour une affiche existante ré-associée).
- Sources : legacy `BLL/LivraisonAfficheService.cs:436-478, 490, 496-518` (RG-REC-075 provisoire) · spec `[DC] §4` (EX-REC-014) · écran ECR-REC-01
- Questions liées : Q-168
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04)
- Tests : apps/api/test/reception/validation.int.test.ts ; apps/api/test/reception/validation-complement.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-040 — Complément d'une affiche déjà reçue en partie
- Origine : MODIFIÉE
- Énoncé : si le visuel est déjà reçu en partie, la ligne propose la case « Complément de l'affiche N » : la nouvelle quantité s'ajoute à la MÊME affiche (même n° d'affiche), avec un mouvement « Réception (complément) » ; les deux réceptions sont gardées pour la traçabilité ; le tag « Complément » apparaît dès deux réceptions. Le thème ne disparaît pas à la 2e livraison. Legacy : sur une affiche existante, `quantite` et `SaisieQte_Rec` sont REMPLACÉES (non cumulées) et un nouveau mouvement s'ajoute.
- Déclencheur : « Valider la réception » avec case « Complément » cochée.
- Conditions : visuel déjà reçu en partie (statut ligne Partielle).
- Effet / message d'erreur : quantité reçue cumulée par mouvements ; `NumeroLivraison` = nb d'associations + 1 (legacy conservé).
- Sources : legacy `BLL/LivraisonAfficheService.cs:484-485, 787` (RG-REC-075, 023 provisoires) · spec `[DC] §4, §10, §16` (EX-REC-016, REC-22) ; ateliers EX-REC-511 · écran ECR-REC-01 (colonne Livraison en deux fois)
- Questions liées : Q-103
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04) : case « Complément » seulement si la ligne est Partielle (HYPOTHÈSE Q-178 (20))
- Tests : apps/api/test/reception/validation.int.test.ts ; apps/api/test/reception/validation-complement.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-041 — Mouvements de réception
- Origine : CONSERVÉE
- Énoncé : pour chaque ligne dont la quantité > 0, un mouvement est créé : quantité = quantité du BL, type « Réception » (ou « Réception (complément) »), récépissé = imprimeur de la réception, expéditeur = transporteur, `comptee`, `livraison_id`, auteur = utilisateur. Les lignes à quantité ≤ 0 ne génèrent aucun mouvement. Un mouvement par affiche créée.
- Déclencheur : « Valider la réception ».
- Conditions : quantité > 0.
- Effet / message d'erreur : insert `mouvement` (append-only). Le legacy fait un `SaveChanges` par ligne ; en cible dans la transaction de RG-REC-046.
- Sources : legacy `CTRL/LivraisonAfficheController.cs:226-232, 257-263, 301-310`, `BLL/LivraisonAfficheService.cs:827-844`, `REPO/LivraisonAfficheRepository.cs:243-261` (RG-REC-076 provisoire) · spec `[DC] §9, §13` (EX-REC-057) ; ateliers EX-STK-501 (réception = entrée de stock des quantités saisies)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04)
- Tests : apps/api/test/reception/validation.int.test.ts ; apps/api/test/reception/validation-complement.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-042 — Rattachement initial à la ligne attendue choisie
- Origine : MODIFIÉE
- Énoncé : à la réception, l'affiche créée est rattachée (lien affiche ↔ ligne attendue AVEC quantité = quantité du BL) à la ligne choisie ; le rattachement n'efface jamais un lien existant. Legacy : l'affiche est liée à la ligne choisie ET à toutes les lignes `tf_prepa_affiche` de mêmes (dossier, format texte, annonceur, thème, plateforme, semaine, année), `ARecevoir = true`, `dateModified` mis à jour, SANS filtre sur une association préexistante (peut ré-associer des prépas déjà liées à une autre affiche). En cible il n'y a qu'une ligne active par clé (RG-AT-01 de la Coordination) : plus de lignes jumelles à rattacher.
- Déclencheur : « Valider la réception ».
- Conditions : ligne attendue trouvée ; sinon réception inconnue (RG-REC-095) ou ligne provisoire sans IP (RG-X-020).
- Effet / message d'erreur : lien créé avec `mode_rattachement` (RG-REC-032) ; recalcul du reçu (RG-REC-017) ; proposition de validation admin (RG-X-001).
- Sources : legacy `BLL/LivraisonAfficheService.cs:455-476, 522-527`, `REPO/LivraisonAfficheRepository.cs:392-413` (RG-REC-075 provisoire ; RG-COO-020 provisoire de legacy-coordination.md) · spec `[RA] §5` (EX-COO-039, EX-COO-032) ; EX-EXI-056
- Questions liées : Q-123, Q-147
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — FAIT : REC-P04 (2026-11-04) : déclencheur « Valider la réception » fait
- Tests : apps/api/test/reception/validation.int.test.ts

### RG-REC-043 — Famille de formats 2 m² (propagation et recherche)
- Origine : CONSERVÉE
- Énoncé : les formats « 2m2 », « 2 m2 », « 2m2 Scrolling », « 2m2 Venusial » forment une famille : (1) à la réception, le rattachement s'étend à toutes les lignes 2 m² du même dossier/annonceur/thème/plateforme/semaine ; (2) dans la recherche de lignes à rattacher, si le support de l'affiche commence par « 2m2 », la liste de supports = tous les supports « 2m2* » + « Scrolling MUI Paris » ; (3) l'affichage renomme « 2m2 Scrolling » et « 2m2 Venusial » en « 2m2 ». Règle legacy non reprise ni retirée par les specs.
- Déclencheur : validation d'une réception ; recherche d'une ligne à rattacher.
- Conditions : format ∈ famille.
- Effet / message d'erreur : voir énoncé. Applicabilité en cible (une ligne par clé, support par `IdSurface × IdFormat`) à confirmer.
- Sources : legacy `BLL/LivraisonAfficheService.cs:458-476`, `BLL/ReceptionListeAfficheBll.cs:420-435`, `FN/Fn_GetPrepaAffiche.sql` (RG-REC-075, 071, 090 provisoires) · spec `[RA] §5` (EX-COO-033)
- Questions liées : Q-147
- Implémentation : apps/api/src/modules/reception/formats.ts:estFamille2m2, supportsDeRecherche, libelleSupport — PARTIEL : REC-P04 (2026-11-04) : (1) propagation à la réception NON FAITE : liens à quantité, répartition non décrite (Q-181, ECART-103) ; (2), (3) faits
- Tests : apps/api/src/modules/reception/formats.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — (1) propagation à la réception NON FAITE (liens à quantité, répartition non décrite : Q-181, ECART-103) ; (2) recherche et (3) libellé : `supportsDeRecherche` et `libelleSupport` (formats.ts) NE SONT APPELÉES QUE PAR DES TESTS, aucune route ni écran ne les utilise : non branchées (écart consigné, câblage non fait). Statut PARTIEL : aucun test d'intégration

### RG-REC-044 — « Affiche reçue » = oui dès l'arrivée de la palette
- Origine : MODIFIÉE
- Énoncé : « Affiche reçue » passe à « oui » dès « Valider la réception », sur la quantité du BL, posé par la réception indépendamment de la validation admin ; le contrôle corrige ensuite la quantité. En V2 : « affiche reçue » = « un mouvement de réception existe ». Legacy (ANO-05) : « Aff. reçues » de l'état des réservations n'affiche « oui » qu'après la validation admin (reçue ET validée), dès qu'UNE affiche validée correspond au dossier, à la semaine, à l'année et au thème exact (sans test de plateforme ni de face).
- Déclencheur : « Valider la réception ».
- Conditions : au moins un mouvement de réception pour l'affiche.
- Effet / message d'erreur : indicateur lu par l'état des réservations et le suivi (RG-X-005). La question source Q31 (« à l'arrivée ou après le contrôle ? ») reste ouverte ; la maquette pose à l'arrivée.
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:172-201` (RG-COO-028 provisoire ; RG-RPR-026) · spec `[DC] §9, §17` (EX-REC-052) ; ateliers EX-REC-503 ; `[README] §6 H14` ; EX-EXI-055
- Questions liées : Q-104
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04)
- Tests : apps/api/test/reception/validation-complement.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-045 — Après validation : champs vidés et champs conservés
- Origine : NOUVELLE
- Énoncé : après « Valider la réception », N° de BL, imprimeur et nombre de colis se vident ; transporteur et « Déchargé par » restent ; la photo du BL mémorisée est remise à zéro ; les lignes cochées quittent le panier, les autres restent.
- Déclencheur : succès de la validation.
- Conditions : —
- Effet / message d'erreur : formulaire prêt pour le BL suivant.
- Sources : spec `[DC] §4, §15` (EX-REC-014) · écran ECR-REC-01 (règles visibles : `bl`, `imprimeur`, `nbColis` remis à zéro)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions ; apps/web/src/components/reception/bon-livraison.tsx — FAIT : REC-P04 (2026-11-04) : écran (BL, imprimeur, colis, photo remis à zéro ; transporteur, déchargé par conservés)
- Tests : e2e/reception-panier.spec.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-046 — Atomicité de « Valider la réception »
- Origine : MODIFIÉE
- Énoncé : toute la validation (réception, affiches, rattachements, mouvements, historique/journal, recalcul des lignes attendues et des unités, alertes) s'exécute dans UNE transaction ; en cas d'échec rien n'est enregistré. Legacy : plusieurs `SaveChanges` successifs sans transaction (livraison, affiches, mouvements ; pour la livraison « orpheline » les affiches sont persistées AVANT les contrôles de format, d'où des affiches orphelines sans livraison en cas d'erreur).
- Déclencheur : « Valider la réception » ; « Créer, ranger et imprimer la feuille temporaire ».
- Conditions : —
- Effet / message d'erreur : erreur technique : 500 `REC_ERREUR_INTERNE` sans donnée résiduelle.
- Sources : legacy `BLL/LivraisonAfficheService.cs:399-530, 532-624 (« CLARK : Correction »)`, `CTRL/LivraisonAfficheController.cs:221-321` (RG-REC-075, 078 provisoires) · CLAUDE.md §6
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04)
- Tests : apps/api/test/reception/validation.int.test.ts ; apps/api/test/reception/validation-complement.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-047 — Réception sans IP : intitulé saisi
- Origine : MODIFIÉE
- Énoncé : si les IP (instructions de pose = thèmes saisis dans Broadcast) ne sont pas saisies, la ligne affiche le thème « (IP non saisies) » et le panier propose un champ « Intitulé saisi (sans IP) » pré-rempli avec l'intitulé de l'autre plateforme (« déjà saisi par <site> (affiche n°), le 1er qui a parlé ») ; l'agent le valide ou le corrige. Ce n'est PAS une réception inconnue : on reçoit sur le dossier. Une alerte « Réception sans instructions de pose » part à la Coordination (RG-REC-184). Legacy : l'agent saisit manuellement le thème (deux intitulés possibles selon la plateforme, puis un 3e à la saisie des IP).
- Déclencheur : mise au panier d'une ligne dont `ipSaisies = non`.
- Conditions : IP non saisies.
- Effet / message d'erreur : l'intitulé saisi devient le thème de l'affiche (annonceur du dossier conservé).
- Sources : spec `[DC] §4, §7, §10, §11` (EX-REC-017) ; ateliers EX-REC-506, EX-THM-501 ; EX-EXI-079 · écran ECR-REC-01 (carte Lignes du BL)
- Questions liées : Q-111
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04) : HYPOTHÈSE Q-178 (1)
- Tests : apps/api/test/reception/validation.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-048 — Intitulé de thème : règle du « 1er qui a parlé »
- Origine : NOUVELLE
- Énoncé : si les IP ne sont pas connues à la réception, la 1re plateforme qui reçoit donne un intitulé, proposé à l'autre plateforme si elle attend aussi un visuel pour le dossier (éviter deux thèmes pour le même visuel). Si les thèmes existent déjà (IP saisies) : rien à faire. Réception partielle : retrouver le thème utilisé la 1re fois. À la saisie des IP la Pré-Prod garde « autant que possible » le nom saisi en premier ; si elle corrige l'intitulé, les plateformes sont informées par alerte (RG-REC-188) pour réimprimer les feuilles de stock. Il n'existe pas de règle de nommage.
- Déclencheur : réception d'un dossier commun à deux plateformes sans IP ; saisie des IP.
- Conditions : dossier présent sur deux plateformes sans IP.
- Effet / message d'erreur : suggestion proposée dès 3 caractères d'annonceur dans le formulaire de réception inconnue (maquette).
- Sources : spec `[DC] §4, §7` ; ateliers EX-THM-501, EX-REC-506, EX-REC-520
- Questions liées : Q-143
- Implémentation : apps/api/src/modules/reception/validation.ts:validerReception ; routes-suite.ts POST /api/receptions — FAIT : REC-P04 (2026-11-04) : HYPOTHÈSE Q-178 (1)
- Tests : apps/api/test/reception/validation.int.test.ts ; e2e/reception-panier.spec.ts (E2E du parcours) ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-049 — Une affiche pour plusieurs dossiers (plusieurs-à-plusieurs, sans limite)
- Origine : MODIFIÉE
- Énoncé : un même visuel peut servir plusieurs dossiers (33 cité) et plusieurs semaines ; le lien affiche ↔ ligne attendue est plusieurs-à-plusieurs avec une QUANTITÉ par dossier, sans limite de nombre (ANO-12). Legacy : une seule affiche par ligne attendue (`affiche_livraison_Id`) ; la réception ne crée la réception que sur un seul dossier ; les autres (32) sont rattachés par la Pré-Prod dans l'onglet Préparation ; le champ « dossiers » de l'onglet Détail est limité en taille.
- Déclencheur : rattachement (réception, Réceptions inconnues, fiche affiche).
- Conditions : quantité par dossier ≥ 1.
- Effet / message d'erreur : voir RG-REC-108, 136.
- Sources : legacy `bdd.md §2.1` (« une affiche au plus par ligne ») ; EX-EXI-056, 058 · spec `[DC] §10, §13` (EX-REC-058, 048) · écran ECR-REC-05 (annotation ANO-12)
- Questions liées : Q-123
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — PARTIEL : REC-P04/P07/P08 (2026-11-04) : endpoints faits ; reste la reprise des liens sans quantité (Q-123)
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts

### RG-REC-050 — Réception partielle
- Origine : NOUVELLE
- Énoncé : on valide ce qui est reçu ; la ligne attendue passe « Partielle » et le reste à recevoir garde son alerte (« Visuel reçu en partie ») ; la quantité n'est pas une condition de la validation admin (le partiel est validé pour ce qu'il contient, exemple 3/3/3 : A 3, B 2, C 0 → A et B validées, rien à valider pour C ; le complément de B est proposé puis confirmé à sa réception).
- Déclencheur : réception d'une quantité inférieure à l'attendu.
- Conditions : reçu < attendu.
- Effet / message d'erreur : voir RG-REC-018, 182, RG-X-018.
- Sources : spec `[DC] §10` (EX-REC-059) ; EX-COO-011 · écran ECR-REC-01
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/lignes.ts:statutLigneDe / recalculerLigne — FAIT : REC-P04 (2026-11-04) : statut recalculé à chaque réception / contrôle
- Tests : apps/api/test/reception/validation-complement.int.test.ts

### RG-REC-051 — Trop reçu : Surplus au-delà de 10 %
- Origine : NOUVELLE
- Énoncé : le reçu est « Surplus » au-delà de attendu × (1 + `ecartReception`) ; une alerte « Écart de réception supérieur à 10 % » est levée (RG-REC-183) ; au contrôle, le surplus des « CG » se compte en entretien (RG-REC-066).
- Déclencheur : réception ou contrôle portant le reçu au-delà du seuil.
- Conditions : reçu > attendu × 1,10 (paramètre).
- Effet / message d'erreur : pastille Surplus (À surveiller), ligne teintée en avertissement.
- Sources : spec `[DC] §10, §11` (EX-REC-060) · écran ECR-REC-01 (statut Surplus)
- Questions liées : Q-105, Q-141
- Implémentation : apps/api/src/modules/reception/lignes.ts:statutLigneDe / recalculerLigne — FAIT : REC-P04 (2026-11-04) : statut recalculé à chaque réception / contrôle
- Tests : apps/api/test/reception/validation-complement.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts

### RG-REC-052 — Affiche livrée après purge de sa ligne attendue
- Origine : NOUVELLE
- Énoncé : une affiche livrée alors que sa ligne attendue a été purgée (RG-REC-180) passe par « Réception inconnue… » (puis rattachement).
- Déclencheur : arrivée d'une palette sans ligne attendue correspondante.
- Conditions : aucune ligne attendue active ne correspond.
- Effet / message d'erreur : voir RG-REC-095.
- Sources : spec `[DC] §10` (EX-REC-044)
- Questions liées : —
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — FAIT : REC-P07 (2026-11-04) : passage par « Réception inconnue… » fait
- Tests : apps/api/test/reception/attendues.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-053 — Sas : liste des palettes à contrôler
- Origine : NOUVELLE
- Énoncé : « Palettes à contrôler (sas) » liste les réceptions RECEPTION.A_CONTROLER, la plus ancienne en tête avec son temps d'attente. Colonnes : En attente depuis (« 35 min », « 7 h », « 2 j 3 h »), Réception (tag « réception inconnue »), Arrivée, Site, BL, Imprimeur, Affiches (nb de lignes), Qté du BL, Déchargé par ; bouton « Contrôler ». Recherche par n° de BL ou imprimeur. Une réception RECEPTION.A_IDENTIFIER n'y figure pas.
- Déclencheur : ouverture de l'étape 2.
- Conditions : réception du site choisi, statut A_CONTROLER.
- Effet / message d'erreur : liste vide : « Aucune palette à contrôler : le sas est vide. ». Clic de ligne = ouvre le contrôle.
- Sources : spec `[DC] §5` (EX-REC-018) · écran ECR-REC-02 (tableau du sas)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04) : recherche par BL / imprimeur à l’écran et dans l’API
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-054 — Badge du menu : nombre de palettes à contrôler
- Origine : NOUVELLE
- Énoncé : le badge de « Réception des affiches » = nombre de réceptions A_CONTROLER du périmètre ; il baisse à chaque contrôle validé et monte à chaque validation de réception ou rattachement d'une inconnue.
- Déclencheur : tout changement de statut de réception.
- Conditions : —
- Effet / message d'erreur : compteur recalculé (pas de comptage en dur).
- Sources : spec `[DC] §5` (EX-REC-018) · écran ECR-REC-01/02, `maquettes-autres-modules.md §0.1`
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/compteurs.ts ; apps/web/src/components/reception/menu-reception.tsx — FAIT : REC-P05 (2026-11-04) : compteur recalculé
- Tests : e2e/reception-attendues.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-055 — Palette en retard dans le sas
- Origine : NOUVELLE
- Énoncé : au-delà de `delaiControle` (24 h par défaut, paramétrable) depuis `a_controler_depuis` : la palette est « en retard » (indicateur « Contrôle en retard ») ; encadré « n palette(s) dans le sas depuis plus de 24 h — À contrôler en premier : elles sont en tête de liste. » ; ligne teintée en avertissement au-delà du délai, en « important » au-delà du double ; alerte RG-REC-189.
- Déclencheur : calcul à l'affichage et par traitement périodique.
- Conditions : durée > délai ; comptage en heures calendaires ou ouvrées non précisé.
- Effet / message d'erreur : HYPOTHÈSE Q-157 : heures calendaires.
- Sources : spec `[DC] §5, §11` (EX-REC-019) ; `[PR] p.1` · écran ECR-REC-02 (teintes)
- Questions liées : Q-105, Q-157
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-056 — Contrôle de la palette : un écran, une ligne par affiche
- Origine : NOUVELLE
- Énoncé : le contrôle montre toute la palette (une réception) en un seul écran, une ligne par affiche : N° affiche (tag « complément »), Visuel (annonceur, thème, dossier, format ; ou « annonceur · libellé saisi » + tag « orpheline »), Qté du BL (« Qté saisie » pour une réception inconnue), Qté comptée, Allée, Rayon, Rebut, Non-conformité, Surplus. Hors tableau : Imprimeur (réception inconnue), Contrôleur, « Voir le BL », « Fermer le contrôle ». Le grain du contrôle est la réception (un BL) : HYPOTHÈSE Q-102.
- Déclencheur : « Contrôler » ou clic de ligne du sas.
- Conditions : réception A_CONTROLER.
- Effet / message d'erreur : si déjà contrôlée : champs en lecture seule (RG-REC-070).
- Sources : spec `[DC] §5, §16` (EX-REC-020) ; EX-REC-027 · écran ECR-REC-02 (formulaire)
- Questions liées : Q-102
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-057 — Quantité comptée : défaut et validité
- Origine : NOUVELLE
- Énoncé : « Qté comptée » = quantité du BL par défaut (ou quantité saisie pour une inconnue) ; nombre ≥ 0 ; l'écart s'affiche « ±N par rapport au BL ».
- Déclencheur : saisie au contrôle.
- Conditions : valeur < 0 refusée.
- Effet / message d'erreur : 400 `REC_QTE_NEGATIVE`.
- Sources : spec `[DC] §5` (EX-REC-021) · écran ECR-REC-02
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-058 — Écart de comptage : seuil de 10 %
- Origine : NOUVELLE
- Énoncé : si |comptée − BL| > `ecartReception` × quantité du BL (10 % par défaut), la ligne est teintée et le badge est « Important » (sinon « Info ») ; indicateur « Écart de comptage ». Base de calcul = quantité du BL ; le signalement n'est pas bloquant.
- Déclencheur : saisie de la quantité comptée.
- Conditions : écart relatif > seuil.
- Effet / message d'erreur : validation non bloquée ; alerte RG-REC-183.
- Sources : spec `[DC] §5, §10` (EX-REC-021) · écran ECR-REC-02
- Questions liées : Q-105, Q-133
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/web/src/lib/ecart.test.ts

### RG-REC-059 — Mouvement « Contrôle (écart au BL) »
- Origine : NOUVELLE
- Énoncé : s'il y a écart (comptée ≠ BL), « Valider le contrôle » ajuste la quantité reçue et crée un mouvement « Contrôle (écart au BL) » de quantité = comptée − BL (signée). Réception et écart de contrôle comptent dans le reçu.
- Déclencheur : « Valider le contrôle et imprimer ».
- Conditions : comptée ≠ BL.
- Effet / message d'erreur : insert `mouvement` ; recalcul RG-REC-017/018 ; RG-X-017.
- Sources : spec `[DC] §5, §9` (EX-REC-021, 057) · écran ECR-REC-02
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04) : HYPOTHÈSE Q-178 (3)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-060 — Comptage par morceau
- Origine : NOUVELLE
- Énoncé : sous `comptageMorceau` (30 par défaut, paramétrable) l'écran indique « Comptage par morceau » ; au 8 m², « 4 morceaux par affiche ». Mécanique de saisie non décrite : libellé sans calcul dans la maquette. Même seuil pour tous les formats : non tranché.
- Déclencheur : quantité comptée < seuil.
- Conditions : comptée < 30.
- Effet / message d'erreur : texte « Comptage par morceau (4 morceaux par affiche) ».
- Sources : spec `[DC] §5, §11, §17` (EX-REC-022) ; EX-EXI-051 · écran ECR-REC-02
- Questions liées : Q-105, Q-140
- Implémentation : apps/web/src/components/reception/sas-controle.tsx (libellé sous le seuil comptageMorceau) — PARTIEL : REC-P05 (2026-11-04) : libellé seul ; mécanique de saisie par morceau et seuil par format non décrits (Q-140)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-061 — Allée et rayon obligatoires au contrôle
- Origine : NOUVELLE
- Énoncé : allée ET rayon sont obligatoires pour chaque affiche contrôlée ; les affiches quittent la zone tampon pour leur emplacement définitif. Allée en majuscules (placeholder « A-F »), rayon placeholder « 1-12 » : valeurs d'exemple, pas de contrôle de domaine (Q-154).
- Déclencheur : « Valider le contrôle et imprimer ».
- Conditions : allée ou rayon vide pour au moins une affiche.
- Effet / message d'erreur : 422 `REC_ALLEE_RAYON_OBLIGATOIRES` « Allée et rayon sont obligatoires pour chaque affiche. ».
- Sources : spec `[DC] §5` (EX-REC-023) ; legacy `affiche.allee`, `affiche.rayon` (RG-REC-024) · écran ECR-REC-02
- Questions liées : Q-106, Q-154
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-062 — Zone tampon et sortie
- Origine : NOUVELLE
- Énoncé : tant qu'une affiche n'est pas contrôlée elle est en zone tampon (allée/rayon définitifs vides ; réception inconnue : allée X). Le contrôle (ou « Ranger avant d'imprimer », RG-REC-088) donne l'emplacement définitif ; l'historique garde « Rangée : X-3 → B-7 (sortie de la zone tampon) ».
- Déclencheur : contrôle ; rangement.
- Conditions : —
- Effet / message d'erreur : mise à jour allée/rayon + historique (RG-REC-006).
- Sources : spec `[DC] §9` (EX-REC-056) · écran ECR-REC-02, ECR-REC-10
- Questions liées : Q-106
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-063 — Contrôleur : agent de réception, du référentiel
- Origine : NOUVELLE
- Énoncé : le contrôleur est un agent de réception choisi dans la liste des agents (REC-12). Un contrôleur lié à l'utilisateur connecté n'est pas spécifié.
- Déclencheur : choix du contrôleur.
- Conditions : valeur ∈ référentiel Agents de réception.
- Effet / message d'erreur : voir RG-REC-067.
- Sources : spec `[DC] §2, §5, §16` (EX-REC-026, 076) ; ateliers EX-REC-514 · écran ECR-REC-02
- Questions liées : Q-145
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-064 — Rebut au contrôle
- Origine : NOUVELLE
- Énoncé : « Rebut » = quantité ≥ 0 avec motif ; crée un mouvement « Mise au rebut » de quantité négative (plafonnée au disponible) ; le motif est la non-conformité choisie. Le rebut est une sortie de stock, ne réduit pas le reçu. Rebut possible plus tard dans Stocks (RG-REC-156).
- Déclencheur : « Valider le contrôle ».
- Conditions : rebut > 0.
- Effet / message d'erreur : insert `mouvement` ; stock = Σ mouvements ; refus si rebut > disponible : 422 `REC_REBUT_SUPERIEUR_STOCK`.
- Sources : spec `[DC] §5, §10` (EX-REC-024, 061) ; EX-STK-501, 504 · écran ECR-REC-02, ECR-STK-01
- Questions liées : Q-118, Q-142
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-065 — Non-conformité
- Origine : NOUVELLE
- Énoncé : non-conformité parmi : Conforme, Visuel non conforme, Quantité, Affiche abîmée, Bandeau manquant, Autre ; elle va dans l'historique (pas de mouvement). Lien vers l'application Process Métier à cadrer ; suivi des non-conformités dans Circé non fait.
- Déclencheur : choix au contrôle.
- Conditions : valeur ∈ liste.
- Effet / message d'erreur : entrée d'historique.
- Sources : spec `[DC] §5, §16` (EX-REC-028, 024) ; EX-QUA-501 · écran ECR-REC-02
- Questions liées : Q-142
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-066 — Surplus en entretien (« CG »)
- Origine : NOUVELLE
- Énoncé : case « +N en entretien » : apparaît seulement si compter ces quantités dépasserait l'attendu entretien compris ; le surplus est noté en entretien (`surplus_entretien`) et affiché « Entretien reçu en plus » dans la fiche. « CG » non défini.
- Déclencheur : saisie de la case au contrôle.
- Conditions : comptée > attendu avec entretien.
- Effet / message d'erreur : champ `surplus_entretien` renseigné.
- Sources : spec `[DC] §5, §10, §13` (EX-REC-025, 060) ; ateliers EX-FIX-506 · écran ECR-REC-02, ECR-REC-05
- Questions liées : Q-141
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — PARTIEL : REC-P05 (2026-11-04) : case « +N en entretien » si comptée > attendu ; l’attendu « entretien compris » n’est pas connu côté Réception (HYPOTHÈSE Q-178 (19), Q-141)
- Tests : apps/api/test/reception/controle.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-067 — Contrôleur obligatoire
- Origine : NOUVELLE
- Énoncé : « Valider le contrôle » exige un contrôleur.
- Déclencheur : « Valider le contrôle et imprimer ».
- Conditions : contrôleur vide.
- Effet / message d'erreur : 422 `REC_CONTROLEUR_OBLIGATOIRE` « Le nom du contrôleur est obligatoire (REC-12). ».
- Sources : spec `[DC] §2, §5, §16` (EX-REC-026) ; ateliers EX-REC-514 · écran ECR-REC-02
- Questions liées : Q-145
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; e2e/reception-parcours.spec.ts ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-068 — Imprimeur corrigé pour une réception inconnue
- Origine : NOUVELLE
- Énoncé : au contrôle d'une réception inconnue rattachée, la quantité et l'imprimeur sont corrigeables (champ Imprimeur affiché seulement pour elle).
- Déclencheur : contrôle d'une inconnue rattachée.
- Conditions : réception inconnue.
- Effet / message d'erreur : imprimeur ∈ référentiel (RG-REC-035).
- Sources : spec `[DC] §5, §6` (EX-REC-027) · écran ECR-REC-02
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-069 — Valider le contrôle : effets
- Origine : NOUVELLE
- Énoncé : « Valider le contrôle et imprimer » dans une transaction : crée les mouvements (écart, rebut) ; enregistre contrôleur et date ; réception → CONTROLEE ; les affiches sortent du sas (tag « À contrôler » levé) ; surplus entretien noté ; non-conformité historisée ; recalcul des lignes et unités (RG-X-017) ; ouverture de l'aperçu d'impression des feuilles définitives avec étiquettes rack (RG-REC-084).
- Déclencheur : clic.
- Conditions : RG-REC-061, 067 ; réception A_CONTROLER.
- Effet / message d'erreur : après : « Imprimer la feuille définitive » ou « Réimprimer les feuilles de stock ».
- Sources : spec `[DC] §5, §6` (EX-REC-027) ; `[PR] p.2 (13-15)` · écran ECR-REC-02
- Questions liées : Q-102
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-070 — Contrôle terminé : lecture seule
- Origine : NOUVELLE
- Énoncé : une réception CONTROLEE est en lecture seule ; re-valider le contrôle ou revenir à A_CONTROLER est interdit (409).
- Déclencheur : tentative de modification.
- Conditions : statut CONTROLEE.
- Effet / message d'erreur : 409 `REC_CONTROLE_DEJA_FAIT`. Corrections ultérieures par mouvements (Q-121).
- Sources : écran ECR-REC-02 (« contrôle déjà fait = champs en lecture seule ») ; table des transitions §3.2
- Questions liées : Q-121
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-071 — Une réception « À identifier » n'est pas contrôlable
- Origine : NOUVELLE
- Énoncé : une réception A_IDENTIFIER n'entre pas dans le sas ; elle doit d'abord être rattachée.
- Déclencheur : tentative de contrôle.
- Conditions : statut A_IDENTIFIER.
- Effet / message d'erreur : 409 `REC_CONTROLE_INTERDIT_A_IDENTIFIER`.
- Sources : spec `[DC] §9` (EX-REC-053) · écran ECR-REC-02 (« A_IDENTIFIER n'entre pas dans le sas »)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-072 — Contrôle d'une réception inconnue rattachée
- Origine : NOUVELLE
- Énoncé : pour une réception inconnue rattachée : corriger quantité et imprimeur, ranger hors zone tampon, puis « Valider le contrôle et imprimer la feuille définitive » ; la feuille définitive remplace la temporaire.
- Déclencheur : contrôle d'une inconnue en A_CONTROLER.
- Conditions : rattachée à ≥ 1 dossier.
- Effet / message d'erreur : voir RG-REC-084.
- Sources : spec `[DC] §5, §6, §7` (EX-REC-027, 040) · écran ECR-REC-02
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle ; apps/web/src/components/reception/sas-controle.tsx — FAIT : REC-P05 (2026-11-04)
- Tests : apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-073 — Correction a posteriori des quantités du BL
- Origine : MODIFIÉE
- Énoncé : le legacy permet de modifier une livraison (en-tête, quantités REMPLACÉES, affiches retirées de la grille dissociées, nouveau mouvement créé pour chaque ligne > 0 : risque de doublon de quantité, aucune validation de dossier/semaines). La cible n'a aucune action d'édition de l'en-tête de réception ; qui peut corriger les quantités a posteriori n'est pas défini.
- Déclencheur : modification d'une réception validée.
- Conditions : —
- Effet / message d'erreur : HYPOTHÈSE Q-121 : pas de modification de l'en-tête ; corrections par mouvements d'écart.
- Sources : legacy `BLL/LivraisonAfficheService.cs:763-803`, `CTRL/LivraisonAfficheController.cs:253-264, 323-372` (RG-REC-079 provisoire) · spec `[DC] §4` (EX-REC-012) ; Q-REC-11, Q-REC-23 maquette · écran ECR-REC-06
- Questions liées : Q-121
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle / listerSas / lireControle — FAIT : REC-P05 (2026-11-04) : HYPOTHÈSE Q-121 : aucune édition de l’en-tête ; corrections par mouvements d’écart au contrôle
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-074 — Pas de suppression ni d'annulation de réception
- Origine : CONSERVÉE
- Énoncé : l'existant n'a ni statut, ni suppression, ni annulation de livraison ; la « corbeille inopérante » est une anomalie à ne pas reprendre. En cible aucune suppression de réception n'est prévue.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucune route de suppression ; 409 sinon.
- Sources : legacy « Livraison — pas de statut ni de suppression » ; spec EX-REC-081 · Q-122
- Questions liées : Q-122
- Implémentation : FAIT (REC-P01, 2026-11-04) — apps/api/src/modules/reception/service.ts:supprimerReception ; routes.ts DELETE /api/receptions/:id. Reste : —
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts

### RG-REC-076 — Feuille de stock = étiquette rack
- Origine : MODIFIÉE
- Énoncé : la feuille de stock est l'étiquette rack de Circé (`Reports/EtiquetteRackAffiche.rdlc`, A4), même modèle, avec la mention « définitive » ou « temporaire » dans le bandeau du haut. Le legacy produit l'étiquette en PDF ou impression directe (RDLC/ReportViewer, côté serveur).
- Déclencheur : toute impression de feuille de stock.
- Conditions : affiche existante.
- Effet / message d'erreur : voir RG-REC-077 à 094. Rendu PDF côté navigateur (CLAUDE.md §3).
- Sources : legacy `W/Reports/Rapport.cs:961-1025` (RG-REC-100 provisoire ; RG-ADM-060) · spec `[DC] §6` (EX-REC-029) ; EX-TRA-024
- Questions liées : Q-002, Q-129
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-077 — Mention « FEUILLE DE STOCK DÉFINITIVE / TEMPORAIRE »
- Origine : NOUVELLE
- Énoncé : bandeau « FEUILLE DE STOCK DÉFINITIVE » (+ « Dossier identifié : n ») ou « TEMPORAIRE » (+ « Réception inconnue · rangée en zone tampon · à remplacer par la feuille définitive… »). Place exacte à valider.
- Déclencheur : impression.
- Conditions : type de feuille de l'affiche.
- Effet / message d'erreur : mention imprimée.
- Sources : spec `[DC] §6` (EX-REC-029) · écran ECR-REC-09
- Questions liées : Q-126
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-078 — Contenu de la feuille
- Origine : CONSERVÉE
- Énoncé : n° d'affiche en très gros (72 pt), format (36 pt), date de réception, adressage (allée - rayon), quantité, code-barres, dossier, semaines, annonceur, thème, repiquage, commentaire, « Affiche à conserver : Oui/Non », 1er départ en gros ; tableau Dossier, Thème, Annonceur, Format, Départ (« S43 /2026 »), Qté prépa., numéro de demande (DA) ; pied « Page 1/1 ». Commentaire = commentaire de l'affiche + deux espaces + commentaire de la réception ; Ref DA = première association ; `Qte_Theorique` NULL forcé à 0.
- Déclencheur : impression.
- Conditions : —
- Effet / message d'erreur : feuille A4.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:332-352`, `REPO/ReceptionListeAfficheRepository.cs:482-501`, `W/Reports/Rapport.cs:961-1025` (RG-REC-100 ; RG-ADM-062) · spec `[DC] §6` (EX-REC-031) · écran ECR-REC-09
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : commentaire = affiche + deux espaces + réception
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-079 — Code-barres « A- » + id sur 13 caractères
- Origine : CONSERVÉE
- Énoncé : `code_barres` = « A- » suivi de `affiche_id` complété par des zéros à gauche pour atteindre 13 chiffres (id 123 → `A-0000000000123`).
- Déclencheur : impression.
- Conditions : `affiche_id` ≤ 13 chiffres.
- Effet / message d'erreur : code imprimé.
- Sources : legacy `W/Reports/Rapport.cs:961-1025` (RG-ADM-062) ; `SP/p_EditionPicking.sql:22-80` · spec `[DC] §6` (EX-REC-031)
- Questions liées : Q-168
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-080 — Quantité imprimée = somme des mouvements
- Origine : CONSERVÉE
- Énoncé : la quantité de la feuille est la somme des mouvements de l'affiche (pas `affiche.quantite`).
- Déclencheur : impression.
- Conditions : —
- Effet / message d'erreur : 0 si aucun mouvement.
- Sources : legacy `W/Reports/Rapport.cs:961-1025` ; `SP/p_EditionPicking.sql` (RG-REC-023, 101) · spec `[DC] §9` (EX-REC-057)
- Questions liées : Q-103
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-081 — Premier départ en gros
- Origine : CONSERVÉE
- Énoncé : « 1er départ » = minimum des semaines de départ des lignes rattachées.
- Déclencheur : impression.
- Conditions : au moins un rattachement.
- Effet / message d'erreur : semaine en 48 pt.
- Sources : legacy `W/Reports/Rapport.cs:961-1025` (RG-ADM-062) · spec EX-REC-031
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-082 — Fond jaune des dossiers multi-semaines
- Origine : NOUVELLE
- Énoncé : la feuille DÉFINITIVE est imprimée sur fond jaune si le dossier est multi-semaines (REC-13). Legacy : feuille jaune (S41/S42/S43) réimprimée à la main et posée par les chefs d'équipe. Définition de « multi-semaines » et sort de REC-13 face au scan de BL multiples : Q18 source.
- Déclencheur : impression définitive.
- Conditions : ≥ 2 semaines de départ distinctes (HYPOTHÈSE Q-127).
- Effet / message d'erreur : fond jaune.
- Sources : spec `[DC] §6, §10` (EX-REC-030) ; EX-EXI-052
- Questions liées : Q-127
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-083 — Feuille temporaire
- Origine : NOUVELLE
- Énoncé : une feuille TEMPORAIRE est imprimée à la création d'une réception inconnue ; elle porte allée et rayon de la zone tampon.
- Déclencheur : création d'une réception inconnue.
- Conditions : —
- Effet / message d'erreur : affiche FEUILLE.TEMPORAIRE.
- Sources : spec `[DC] §6, §7` (EX-REC-029) · écran ECR-REC-08/09
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-084 — Feuille définitive
- Origine : NOUVELLE
- Énoncé : la feuille DÉFINITIVE est imprimée au contrôle d'une palette de dossier connu ou d'une inconnue rattachée, en lot, avec étiquettes rack ; elle remplace la temporaire. Impossible sans dossier (« Temporaire → Définitive dès qu'il y a un dossier »).
- Déclencheur : « Valider le contrôle et imprimer » ; « Imprimer dans Réception des affiches ».
- Conditions : ≥ 1 rattachement actif.
- Effet / message d'erreur : sans dossier : 409 `REC_FEUILLE_DEFINITIVE_IMPOSSIBLE`.
- Sources : spec `[DC] §5, §6, §9` (EX-REC-027, 056) · écran ECR-REC-02/09
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-085 — Type de feuille noté, tag « Feuille à refaire » levé
- Origine : NOUVELLE
- Énoncé : l'impression note le type de feuille posée (`feuilleImprimee`), écrit l'historique, lève le tag « Feuille à refaire », applique le nouvel intitulé si changement de thème. Stockage du type : « sans place dans la base » (à créer).
- Déclencheur : impression.
- Conditions : —
- Effet / message d'erreur : « n feuille(s) (… ) [et n étiquette(s) rack] envoyées à l'imprimante. ».
- Sources : spec `[DC] §6, §9` (EX-REC-033) · écran ECR-REC-09
- Questions liées : Q-126
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-086 — Impression en lot : exemplaires
- Origine : NOUVELLE
- Énoncé : impression en lot, `exemplairesFeuille` exemplaires par défaut 2 (palette et Coordination), paramétrable de 1 à 5 ; avec ou sans étiquettes rack. Boutons « Imprimer (2 exemplaires) » / « … et les étiquettes rack ».
- Déclencheur : aperçu d'impression.
- Conditions : valeur ∈ [1 ; 5].
- Effet / message d'erreur : hors bornes : 400.
- Sources : spec `[DC] §6, §11, §17` (EX-REC-032) ; `[PR] p.1` · écran ECR-REC-09
- Questions liées : Q-128
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-087 — Réimpressions
- Origine : NOUVELLE
- Énoncé : réimpression possible depuis : Liste des affiches (« Réimprimer les feuilles à refaire (n) », « Imprimer les feuilles de stock », « Étiquettes rack »), ligne attendue « Contrôlée » (« Feuille de stock »), fiche de l'affiche.
- Déclencheur : actions citées.
- Conditions : action « à refaire » seulement si une sélectionnée porte le tag.
- Effet / message d'erreur : RG-REC-085.
- Sources : spec `[DC] §6, §8` (EX-REC-034) · écran ECR-REC-03/05
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx ; apps/web/src/routes/reception/index.tsx (action « Feuille de stock ») — FAIT : REC-P06 (2026-11-04) : réimpression depuis la ligne attendue Contrôlée (ECR-REC-01), le contrôle, la liste et la fiche
- Tests : apps/api/test/reception/impressions.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-088 — « Ranger avant d'imprimer »
- Origine : NOUVELLE
- Énoncé : si des affiches à réimprimer sont encore en allée X, la modale propose allée/rayon (facultatifs : vide = reste en zone tampon) ; « Ranger et voir les feuilles » met à jour l'emplacement (historique) puis ouvre l'aperçu.
- Déclencheur : « Réimprimer les feuilles à refaire ».
- Conditions : affiches en zone tampon.
- Effet / message d'erreur : historique « Rangée : X-3 → B-7 ».
- Sources : spec `[DC] §8` (EX-REC-045) · écran ECR-REC-10
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx ; apps/web/src/routes/reception/affiches.tsx:RangerAvantImprimer — FAIT : REC-P06 (2026-11-04) : ECR-REC-10
- Tests : apps/api/test/reception/impressions.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-089 — Étiquette rack imprimée à la validation admin
- Origine : MODIFIÉE
- Énoncé : quand la validation admin passe de non validée à validée, l'étiquette rack est envoyée aux imprimantes de la plateforme ; aucun effet au décochage. Legacy : impression sans gestion d'échec (exception après sauvegarde). En cible l'échec n'annule pas la validation (RG-REC-092). Étiquettes en rafale lors d'une confirmation en lot : Q62 source.
- Déclencheur : passage à « validée ».
- Conditions : ancienne valeur ≠ vrai ; imprimante renseignée.
- Effet / message d'erreur : impression ; journal.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:177, 189-192, 454-465` (RG-REC-028 ; RG-COO-027) · spec EX-COO-014
- Questions liées : Q-002, Q-162
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — BLOQUÉ : BLOQUÉ Q-002 / Q-162 (impression automatique aux imprimantes de plateforme, déclenchée par la validation admin COO-P04)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : BLOQUÉ) — PARTIEL (plus BLOQUÉ) : l'étiquette rack se calcule, s'imprime à la demande (aperçu PDF navigateur, impression en lot) et à la validation admin (effets-validation.ts) ; seul l'envoi automatique à l'imprimante de plateforme est bloqué par Q-002 (agent d'impression local) / Q-162

### RG-REC-090 — Impressions multiples en un clic
- Origine : NOUVELLE
- Énoncé : cocher plusieurs lignes de la Liste des affiches et imprimer feuilles/étiquettes rack en un clic (toast « n étiquette(s) rack imprimée(s) en un clic. ») ; fin des 3 clics par dossier et de la 2e icône.
- Déclencheur : actions groupées.
- Conditions : sélection ≥ 1.
- Effet / message d'erreur : journal.
- Sources : ateliers EX-REC-502, EX-REC-515, EX-TRA-507 · écran ECR-REC-03
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — FAIT : REC-P06 (2026-11-04) : PDF rendu par le navigateur (Q-002, Q-368)
- Tests : apps/api/test/reception/impressions.int.test.ts ; apps/api/test/reception/controle-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-091 — Imprimantes de plateforme et sortie PDF
- Origine : MODIFIÉE
- Énoncé : legacy : l'étiquette est imprimée sur CHAQUE imprimante de la plateforme (`tr_atelier_imprimante`) s'il y en a au moins une non vide ; aucune imprimante → aucune impression ni alerte. Cible : PDF généré côté navigateur ; appel d'un agent local d'impression : Q-002.
- Déclencheur : impression.
- Conditions : imprimante renseignée.
- Effet / message d'erreur : voir Q-002, Q-129.
- Sources : legacy `BLL/AdminPlateformeBll.cs:65-69`, `W/Reports/Rapport.cs:1021-1024` (RG-ADM-041) · CLAUDE.md §3
- Questions liées : Q-002, Q-129
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — BLOQUÉ : BLOQUÉ Q-002 / Q-162 (impression automatique aux imprimantes de plateforme, déclenchée par la validation admin COO-P04)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : BLOQUÉ) — PARTIEL (plus BLOQUÉ) : sortie PDF par le navigateur faite ; seul l'adressage de l'imprimante de la plateforme dépend de Q-002 (agent local, hypothèse prise) / Q-129 ; les imprimantes saisies en D-03 ne sont pas consommées

### RG-REC-092 — Échec d'impression non bloquant
- Origine : MODIFIÉE
- Énoncé : un échec d'impression est signalé mais ne défait ni la validation ni le contrôle déjà enregistrés ; la réimpression reste possible.
- Déclencheur : erreur d'impression.
- Conditions : —
- Effet / message d'erreur : message d'erreur d'impression ; état conservé.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:454-465` (RG-REC-028)
- Questions liées : Q-002
- Implémentation : apps/api/src/modules/reception/impressions.ts ; apps/web/src/components/reception/apercu-feuilles.tsx — PARTIEL : REC-P06 (2026-11-04) : l’échec d’enregistrement de l’impression est affiché sans défaire validation ni contrôle ; l’échec de l’imprimante n’est pas détectable sans agent d’impression (Q-002)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours)
- Statut matrice (audit final, étape 10, 2026-11-06) : BLOQUÉ (avant : PARTIEL) — BLOQUÉ Q-002 : l'échec de l'imprimante n'est pas détectable sans agent d'impression local ; l'enregistrement non bloquant de l'impression n'a aucun test portant l'identifiant RG-REC-092 (ancien statut PARTIEL sans preuve)

### RG-REC-093 — Édition picking
- Origine : CONSERVÉE
- Énoncé : état imprimé des affiches validées admin (`validationAdmin = 1`), hors zone picking, par plateforme et période de `date_entree` ; quantité = somme des mouvements, groupées par format, triées par annonceur (lettres avant autres, insensible à la casse), `rows = 1` pour la 1re ligne de chaque format, code-barres « A- » + id 13 caractères ; paramètre `historique` ignoré ; la SP déclare un 4e paramètre `@affiches` non passé.
- Déclencheur : « Edition picking ».
- Conditions : voir énoncé.
- Effet / message d'erreur : rapport. Non repris ni retiré par les specs (EX-TRA-025) ; Zone picking non repris.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:678-736`, `SP/p_EditionPicking.sql:22-80` (RG-REC-101) · spec EX-TRA-025
- Questions liées : Q-101
- Implémentation : apps/api/src/modules/reception/impressions.ts:editionPicking ; GET /api/edition-picking — PARTIEL : REC-P06 (2026-11-04) : données seules (HYPOTHÈSE Q-101, Q-178 (12)) ; pas d’écran ni de PDF d’édition picking
- Tests : apps/api/test/reception/impressions.int.test.ts

### RG-REC-095 — Création d'une réception inconnue : formulaire
- Origine : MODIFIÉE
- Énoncé : « Réception inconnue… » (ex « orpheline ») : Site, Format, Annonceur lu sur l'affiche, Thème ou description (propositions de l'autre plateforme), Imprimeur, Quantité comptée, Allée (zone tampon, X par défaut), Rayon, Photo de l'affiche, Photo du BL. Bouton « Créer, ranger et imprimer la feuille temporaire ». Legacy : livraison « orpheline » à panier vide, saisie libre de lignes ; affiche persistée avant les contrôles.
- Déclencheur : bouton ou « Aucun : réception inconnue ».
- Conditions : voir RG-REC-096 à 098.
- Effet / message d'erreur : voir RG-REC-099.
- Sources : legacy `BLL/LivraisonAfficheService.cs:532-624`, `CTRL/LivraisonAfficheController.cs:274-321` (RG-REC-073, 078) · spec `[DC] §7` (EX-REC-035) · écran ECR-REC-08
- Questions liées : Q-163
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-096 — Quantité comptée obligatoire (> 0)
- Origine : NOUVELLE
- Énoncé : la quantité comptée d'une réception inconnue est > 0.
- Déclencheur : création.
- Conditions : quantité ≤ 0.
- Effet / message d'erreur : 422 `REC_QTE_INCONNUE_OBLIGATOIRE` « Indiquez la quantité comptée. ».
- Sources : spec `[DC] §7` (EX-REC-035) · écran ECR-REC-08
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-097 — Allée tampon et rayon obligatoires (réception inconnue)
- Origine : NOUVELLE
- Énoncé : allée (défaut `alleeInconnues` = X, à fixer par site) et rayon obligatoires : ils sont imprimés sur la feuille temporaire.
- Déclencheur : création.
- Conditions : allée ou rayon vide.
- Effet / message d'erreur : 422 `REC_ALLEE_RAYON_INCONNUE_OBLIGATOIRES` « Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire. ».
- Sources : spec `[DC] §7, §11` (EX-REC-035, 073) · écran ECR-REC-08
- Questions liées : Q-105, Q-106
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts

### RG-REC-098 — Photos de la réception inconnue
- Origine : NOUVELLE
- Énoncé : photo de l'affiche (jointe) ; photo du BL jointe dans tous les cas, sauf palette arrivée sans BL (n° de BL « — »).
- Déclencheur : création.
- Conditions : BL présent sans photo → refus RG-REC-026.
- Effet / message d'erreur : voir RG-REC-027.
- Sources : spec `[DC] §7` (EX-REC-003, 035) · écran ECR-REC-08
- Questions liées : Q-113
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04) : HYPOTHÈSE Q-178 (5)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-099 — Effets de la création d'une réception inconnue
- Origine : MODIFIÉE
- Énoncé : réception A_IDENTIFIER hors du sas ; affiche ORPHELINE (tags Réception inconnue, À contrôler), mouvement « Réception », feuille TEMPORAIRE, alerte immédiate à la Coordination (RG-REC-185, RG-X-006) ; pas de mail. Legacy : mail et affiches résiduelles.
- Déclencheur : création.
- Conditions : RG-REC-096/097.
- Effet / message d'erreur : « Réception inconnue R… : affiche n rangée en X-n. La Coordination est prévenue (Pilotage › Alertes). ».
- Sources : spec `[DC] §7, §11` (EX-REC-036) · écran ECR-REC-08
- Questions liées : Q-110
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-100 — Suggestions d'intitulés de l'autre plateforme
- Origine : NOUVELLE
- Énoncé : l'annonceur saisi (dès 3 caractères) déclenche des suggestions d'intitulés déjà saisis par l'autre plateforme (« lib » (site, n° affiche)).
- Déclencheur : saisie annonceur.
- Conditions : ≥ 3 caractères.
- Effet / message d'erreur : boutons de suggestion.
- Sources : spec `[DC] §7` ; ateliers EX-REC-506 · écran ECR-REC-08
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04) : 5 suggestions au plus
- Tests : apps/api/test/reception/inconnues.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-101 — Tableau « Réceptions inconnues »
- Origine : NOUVELLE
- Énoncé : un seul tableau (un statut par ligne) : N° affiche, Lu sur l'affiche (annonceur · description), Site, Qté, Reçue le, En attente depuis, Statut, Dossier(s), Emplacement ; masquées : Format, Imprimeur, Feuille de stock ; action « Fiche ». Sous le tableau : photo, annonceur lu, description, quantité, format, imprimeur, emplacement. Badge rouge du menu = nb d'affiches orphelines.
- Déclencheur : ouverture de l'écran.
- Conditions : périmètre du site.
- Effet / message d'erreur : vide : « Aucune réception inconnue avec ce statut. ».
- Sources : spec `[DC] §7, §17` (EX-REC-037) · écran ECR-REC-04
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-102 — Statuts et filtre par défaut des réceptions inconnues
- Origine : NOUVELLE
- Énoncé : cinq statuts (RECEPTION_INCONNUE.*, section 3) ; filtre Statut par défaut : À identifier + Introuvable + Rattachée à contrôler + Contrôlée feuille définitive à imprimer ; « Rattachée, feuille définitive » masqué par défaut.
- Déclencheur : ouverture.
- Conditions : —
- Effet / message d'erreur : voir §3.
- Sources : spec `[DC] §9` (EX-REC-055) · écran ECR-REC-04
- Questions liées : Q-109
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-103 — « En attente depuis » d'une réception inconnue
- Origine : NOUVELLE
- Énoncé : durée depuis la création ; rouge/Important au-delà de 24 h (`delaiControle`) ; « — » si rattachée ; ligne « À identifier » > 24 h teintée en important ; alerte importante après 24 h (RG-REC-185).
- Déclencheur : affichage.
- Conditions : durée > 24 h.
- Effet / message d'erreur : teinte.
- Sources : spec `[DC] §7, §11` ; Q-REC-17 maquette · écran ECR-REC-04
- Questions liées : Q-105
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-104 — Identifier par le visuel
- Origine : NOUVELLE
- Énoncé : « Voir les visuels proposés (n) » : candidats (4 max dans la maquette) avec score ; dossier pré-coché si reconnu à coup sûr ; plusieurs dossiers cochables. Reconnaissance simulée ; critère « à coup sûr » non défini.
- Déclencheur : voie « Par le visuel ».
- Conditions : candidat(s) disponible(s).
- Effet / message d'erreur : sinon « Aucun visuel proche : cherchez par n° de dossier. ».
- Sources : spec `[DC] §7` (EX-REC-038) ; ateliers EX-REC-507 · écran ECR-REC-04
- Questions liées : Q-112, Q-125
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — BLOQUÉ : BLOQUÉ Q-112 / Q-125 : reconnaissance du visuel non disponible ; seule la voie « par n° de dossier » est à l’écran
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-105 — Identifier par n° de dossier
- Origine : NOUVELLE
- Énoncé : recherche à la frappe par n° de dossier, DA, annonceur, thème (min. 2 caractères, 8 résultats max dans la maquette) ; voie proposée d'office si pas de visuel (photo absente, IP non saisies, aucun visuel proche).
- Déclencheur : saisie.
- Conditions : ≥ 2 caractères.
- Effet / message d'erreur : « Tapez un n° de dossier, de DA, un annonceur ou un thème. » / « Aucun dossier pour « q » sur ce site. ».
- Sources : spec `[DC] §7` (EX-REC-038) · écran ECR-REC-04
- Questions liées : Q-125
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-106 — Pré-coche du dossier reconnu à coup sûr
- Origine : NOUVELLE
- Énoncé : le dossier est pré-coché seulement si le visuel est reconnu à coup sûr ; sinon l'utilisateur coche. Qté par candidat : nombre ≥ 1, défaut min(quantité reçue, attendu). Seuils (0,9/0,6) fictifs.
- Déclencheur : affichage des candidats.
- Conditions : score ≥ seuil (à fixer).
- Effet / message d'erreur : « Visuel reconnu (xx %) — Rattachement proposé directement : il reste à confirmer. ».
- Sources : spec `[DC] §7` · écran ECR-REC-04
- Questions liées : Q-125
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — BLOQUÉ : BLOQUÉ Q-112 / Q-125 : reconnaissance du visuel non disponible ; seule la voie « par n° de dossier » est à l’écran
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-107 — « Rattacher » : refus
- Origine : NOUVELLE
- Énoncé : « Rattacher » ne s'applique qu'à une affiche ORPHELINE (réception A_IDENTIFIER ou introuvable) ; il exige ≥ 1 dossier ET une quantité > 0.
- Déclencheur : clic « Rattacher ».
- Conditions : aucun dossier ou quantité 0 ; affiche non orpheline → 409.
- Effet / message d'erreur : 422 `REC_RATTACHER_SANS_DOSSIER` « Choisissez au moins un dossier et une quantité. ».
- Sources : spec `[DC] §7` (EX-REC-039) · écran ECR-REC-04
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-108 — Répartition ≤ quantité reçue
- Origine : NOUVELLE
- Énoncé : la somme des quantités réparties ne dépasse pas la quantité reçue ; une répartition inférieure est permise (le surplus reste en stock, doc coordination).
- Déclencheur : « Rattacher ».
- Conditions : total > quantité reçue.
- Effet / message d'erreur : 422 `REC_REPARTITION_DEPASSE` « La répartition (x) dépasse la quantité reçue (y). ». Répartition < reçue : HYPOTHÈSE Q-124 autorisée.
- Sources : spec `[DC] §7` (EX-REC-039) ; `[PP] §6`
- Questions liées : Q-124
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-109 — Effets de « Rattacher »
- Origine : NOUVELLE
- Énoncé : l'affiche passe IDENTIFIEE ; la réception passe A_CONTROLER (`a_controler_depuis` = maintenant) et entre dans le sas ; rattachement avec `mode_rattachement` MAIN ; tag « Feuille à refaire » (feuille définitive à imprimer) ; alerte « Feuille de stock définitive à imprimer » à la réception de la plateforme (RG-REC-187) ; recalcul des unités (RG-X-003). Boutons selon l'état : RG-REC-119.
- Déclencheur : « Rattacher ».
- Conditions : RG-REC-107/108.
- Effet / message d'erreur : « Affiche n° rattachée. n unité(s) passent « Prêt ». La palette R… passe dans le sas… ».
- Sources : spec `[DC] §7` (EX-REC-040) · écran ECR-REC-04
- Questions liées : Q-107
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-110 — Annonceur et libellé après rattachement
- Origine : NOUVELLE
- Énoncé : l'annonceur saisi est remplacé par celui du dossier ; le libellé saisi n'est remplacé que si les IP sont saisies (sinon règle du 1er qui a parlé, RG-REC-048). Répartition possible sur 1..n thèmes (plusieurs semaines).
- Déclencheur : « Rattacher ».
- Conditions : —
- Effet / message d'erreur : champs mis à jour + historique.
- Sources : spec `[DC] §7` · écran ECR-REC-04 (règles de Rattacher)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-111 — Validation admin au rattachement selon le rôle
- Origine : NOUVELLE
- Énoncé : rattachement par `coord` = validation admin faite ; par un autre rôle : reste « à confirmer » (`rattache = MAIN`, motif « rattachée sans le n° du BL »). Tant que non rattachée : « Réception inconnue : à rattacher d'abord ».
- Déclencheur : « Rattacher », changement de thème, rattachement manuel.
- Conditions : rôle.
- Effet / message d'erreur : RG-X-007.
- Sources : spec `[DC] §7` ; EX-COO-010, 017 · écran ECR-REC-04/05
- Questions liées : Q-107
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04) : HYPOTHÈSE Q-178 (6)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-112 — Signaler « Dossier introuvable »
- Origine : NOUVELLE
- Énoncé : « Personne ne retrouve le dossier ? » → « Signaler à la Coordination (alerte) », sans mail ; statut RECEPTION_INCONNUE.INTROUVABLE (date) ; alerte « Dossier introuvable » (RG-REC-186). Destinataire : Coordination du site (Wissous : équipe Coord. Réception de Boulogne). Périmètre de « introuvable » : Q36 source.
- Déclencheur : clic.
- Conditions : statut À identifier.
- Effet / message d'erreur : « Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… ».
- Sources : spec `[DC] §3, §7, §11` (EX-REC-041) · écran ECR-REC-04
- Questions liées : Q-109, Q-110
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-113 — Deux cas à ne pas confondre
- Origine : NOUVELLE
- Énoncé : (a) DA activée, IP non saisies : PAS une réception inconnue (alerte « sans IP » à la Coordination) ; (b) affiche introuvable alors que le dossier est dans Broadcast : réception inconnue, reconnue par la photo.
- Déclencheur : création.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-047, 095.
- Sources : spec `[DC] §7, §10` (EX-REC-042)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/validation.ts (sans IP : intitulé saisi, pas de réception inconnue) ; inconnues.ts — PARTIEL : REC-P07 (2026-11-04) : cas (a) couvert (RG-REC-047) ; cas (b) suppose la reconnaissance par la photo (Q-112)
- Tests : (aucun test ne porte l’ID : cas (a) couvert par les tests RG-REC-047 de validation.int.test.ts ; cas (b) BLOQUÉ Q-112)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — tests : identifiant ajouté au test RG-REC-047 (cas (a)) de validation.int.test.ts

### RG-REC-114 — Retrait du dernier dossier
- Origine : NOUVELLE
- Énoncé : retirer le dernier dossier renvoie l'affiche dans les réceptions inconnues (ORPHELINE) ; la réception redevient A_IDENTIFIER. Affiche sans lien actif = orpheline. État si déjà contrôlée : contradiction [DC] §9/§10.
- Déclencheur : « Retirer ».
- Conditions : plus aucun rattachement actif.
- Effet / message d'erreur : HYPOTHÈSE Q-108 : A_IDENTIFIER (réception inconnue ou palette d'une seule affiche) ; HYPOTHÈSE Q-180 : pour une palette dont d'autres affiches restent rattachées, la réception garde son statut et l'affiche orpheline apparaît dans les réceptions inconnues.
- Sources : spec `[DC] §8, §9, §10` (EX-REC-043) · écran ECR-REC-05
- Questions liées : Q-108
- Implémentation : apps/api/src/modules/reception/rattachement.ts:retirerRattachement ; inconnues.ts:listerInconnues / rattacherInconnue — FAIT : REC-P07/P08 (2026-11-04) : HYPOTHÈSE Q-108 et Q-180 (palette à plusieurs affiches)
- Tests : apps/api/test/reception/inconnues.int.test.ts

### RG-REC-115 — Définition d'une affiche orpheline
- Origine : MODIFIÉE
- Énoncé : affiche orpheline = aucun rattachement actif. Legacy : deux définitions contradictoires (aucune `tf_prepa_affiche` liée ; ou `date_creation` ∈ période ET aucune prépa) et prépas `FromBroadcast` comptées comme association dans la SP mais exclues dans `GetPrepaAfficheByAfficheId`.
- Déclencheur : tout calcul.
- Conditions : —
- Effet / message d'erreur : une définition unique.
- Sources : legacy `SP/p_GetListeAffiche.sql:62-65`, `REPO/ReceptionListeAfficheRepository.cs:456-469, 283` (RG-REC-008)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-116 — Création manuelle d'une affiche (mode Création) legacy
- Origine : MODIFIÉE
- Énoncé : voie probablement morte (aucun bouton Créer ; contrôleur lit `GetAfficheById(0)`) : affiche + mouvement initial de quantité 0 alors que `affiche.quantite = quantiteSaisie`. Remplacée par « Réception inconnue ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:756-798`, `CTRL/ReceptionListeAfficheController.cs:119-128, 177` (RG-REC-020) · spec EX-REC-079
- Questions liées : —
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101 / Q-155

### RG-REC-117 — Livraison « orpheline » legacy : affiches persistées avant contrôle
- Origine : MODIFIÉE
- Énoncé : le legacy persiste les affiches (`CreateAfficheOrpheline`) avant les contrôles dossier/semaines et écrit un historique même en cas d'erreur. Corrigé par RG-REC-046.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : rien de résiduel.
- Sources : legacy `BLL/LivraisonAfficheService.cs:532-624` (RG-REC-078)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04) : création atomique (test « rien n’est écrit si un contrôle échoue »)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-118 — Qui peut rattacher une réception inconnue
- Origine : NOUVELLE
- Énoncé : `coord` rattache (vaut validation) ; l'agent de réception peut rattacher (« rattachée par la réception : reste à vérifier ») ; ambiguïté README « Coordination, réception ».
- Déclencheur : « Rattacher ».
- Conditions : rôle ∈ {coord, recep}.
- Effet / message d'erreur : autres : 403.
- Sources : spec `[DC] §7` (EX-REC-040) ; `[README] §3`
- Questions liées : Q-107
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/reception/inconnues-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-119 — Boutons selon l'état de la réception inconnue
- Origine : NOUVELLE
- Énoncé : À identifier/Signalée : Rattacher, Fiche, Signaler ; Rattachée à contrôler : « Modifier le rattachement ou le thème », « Valider et imprimer dans Réception des affiches » ; Contrôlée feuille définitive à imprimer : « Imprimer dans Réception des affiches » ; Rattachée feuille définitive : « Ouvrir la fiche », « Réimprimer la feuille définitive ».
- Déclencheur : affichage.
- Conditions : statut.
- Effet / message d'erreur : action non listée absente.
- Sources : spec `[DC] §7` ; `[PR]` · écran ECR-REC-04
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-120 — Rattachement par la réception : reste à vérifier
- Origine : NOUVELLE
- Énoncé : un rattachement posé par la réception (non coord) garde la validation admin « à confirmer » (motif doute) jusqu'à confirmation par la Coordination.
- Déclencheur : rattachement par recep.
- Conditions : rôle ≠ coord/admin.
- Effet / message d'erreur : RG-X-007.
- Sources : spec `[DC] §7` · maquette `rattache = MAIN`
- Questions liées : Q-107
- Implémentation : apps/api/src/modules/reception/inconnues.ts ; apps/web/src/routes/reception/inconnues.tsx ; components/reception/modale-reception-inconnue.tsx — FAIT : REC-P07 (2026-11-04)
- Tests : apps/api/test/reception/inconnues.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-121 — Liste des affiches : colonnes
- Origine : MODIFIÉE
- Énoncé : colonnes : N° affiche, Reçue le, Visuel, Dossier(s) (tag « N dossiers »), Départ (tag « multi-semaines »), En stock, Emplacement, Statut et tags ; masquées : Réception (cliquable), Site, Annonceur, Thème, Format, Imprimeur (REC-07), Reçu, Rebut, Contrôleur, Feuille de stock. Tri initial date décroissante. Lecture + impression (pas de création). Imprimeur visible ; n° de réception cliquable (onglet Mouvements). Legacy : colonnes dont « Orpheline » oui/non, « Zone » (Picking/Réceptionnée), dernière sortie.
- Déclencheur : ouverture.
- Conditions : —
- Effet / message d'erreur : vide « Aucune ligne pour ces filtres. ».
- Sources : spec `[DC] §8` (EX-REC-045) ; ateliers EX-REC-509 · écran ECR-REC-03
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; apps/api/test/reception/affiches-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-122 — Liste des affiches : filtres
- Origine : MODIFIÉE
- Énoncé : N° de dossier ; Départ (une affiche sans semaine reste visible) ; Tag (À contrôler, Orpheline, Complément, Feuille à refaire) ; Format ; Imprimeur (+ Filtre). Actions groupées : « Réimprimer les feuilles à refaire (n) », « Imprimer les feuilles de stock », « Étiquettes rack », « Ranger avant d'imprimer ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir RG-REC-087, 090.
- Sources : spec `[DC] §8` (EX-REC-045) · écran ECR-REC-03
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-123 — Période par défaut et « Historique » (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : période 1 mois glissant ; « Historique » décoché réinitialise les dates mais les SP filtrent toujours `date_entree BETWEEN` et n'utilisent pas `@historique`. Remplacé par le filtre Départ.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:73-76, 104-109`, `SP/p_GetListeAffiche.sql:112-122` (RG-REC-002)
- Questions liées : —
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-124 — Listes legacy Tous / À traiter / Rebus / Fusionnées
- Origine : MODIFIÉE
- Énoncé : legacy : 4 listes (« Tous » hors fusionnées ; « À traiter » = (non validée OU orpheline) hors rebus et fusionnées ; « Rebus » ; « Fusionnées » avec seule action Modifier) tri `affiche_id` décroissant, quantité = Σ mouvements. Cible : une liste filtrée par tags/statuts ; stat. et colonne Zone non reprises.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : remplacement par RG-REC-121/122.
- Sources : legacy `SP/p_GetListeAffiche*.sql`, `BLL/ReceptionListeAfficheBll.cs:53-54, 116-121` (RG-REC-003 à 009, 011, 013) · Q-100
- Questions liées : Q-100, Q-118
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-125 — Plus de doublons dans la Liste des affiches
- Origine : NOUVELLE
- Énoncé : une affiche = une seule ligne dans la Liste des affiches quel que soit le nombre de dossiers/rattachements/réceptions (ANO-01).
- Déclencheur : lecture.
- Conditions : —
- Effet / message d'erreur : agrégation (dossiers en tag).
- Sources : ateliers EX-REC-501 ; spec EX-REC-081
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-126 — Colonne « En stock » et rebut mis en évidence
- Origine : MODIFIÉE
- Énoncé : « En stock » = somme des mouvements ; un badge Important « n rebut » met le rebut en évidence (REC-08) ; ligne teintée en important si rebut ; orpheline en avertissement.
- Déclencheur : affichage.
- Conditions : —
- Effet / message d'erreur : visuel.
- Sources : spec `[DC] §8` ; ateliers EX-REC-513 · écran ECR-REC-03
- Questions liées : Q-103
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-127 — Tags calculés, jamais cochés
- Origine : NOUVELLE
- Énoncé : tags À contrôler (palette pas contrôlée), Réception inconnue, Complément (≥ 2 réceptions), Feuille à refaire (thème modifié après identification et feuille non réimprimée, ou feuille temporaire sur affiche rattachée) sont posés par Circé.
- Déclencheur : événements.
- Conditions : —
- Effet / message d'erreur : voir §3.
- Sources : spec `[DC] §9` (EX-REC-050, 054) · écran ECR-REC-03 (définitions)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-128 — Tag « Complément »
- Origine : NOUVELLE
- Énoncé : posé dès que l'affiche est reçue en au moins deux réceptions (nombre de réceptions, pas de statut explicite).
- Déclencheur : 2e réception.
- Conditions : ≥ 2 réceptions.
- Effet / message d'erreur : tag jaune.
- Sources : spec `[DC] §4, §9` (EX-REC-016) ; Q-REC-14
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-129 — Tag « Feuille à refaire » / « Feuille définitive à imprimer »
- Origine : NOUVELLE
- Énoncé : posé quand le thème ou un rattachement change après identification ; levé par la réimpression ; affiché « Feuille définitive à imprimer » tant qu'une temporaire est posée. Modifier annonceur/thème saisis ne le pose pas dans la maquette (Q-143).
- Déclencheur : changement de thème / rattachement.
- Conditions : feuille déjà imprimée.
- Effet / message d'erreur : alerte RG-REC-188.
- Sources : spec `[DC] §9, §10` (EX-REC-054, 062) ; ateliers EX-THM-503 · écran ECR-REC-05
- Questions liées : Q-143
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04) : levé par l’impression (RG-REC-085) ; Q-143 : la modification de la fiche ne le pose pas
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-130 — Fiche de l'affiche
- Origine : MODIFIÉE
- Énoncé : panneau avec onglets Détail, Mouvements, Préparations (compteur), Historique ; Détail : réception(s) (lien), annonceur/thème saisis, imprimeur, allée, rayon, quantité reçue, stock disponible, feuille de stock, entretien reçu en plus, « Affiche à conserver (reliquat d'entretien) », encadré « Palette à contrôler » + « Contrôler la palette », bloc Validation admin. Boutons : Fermer, Imprimer la feuille de stock, Enregistrer (note « Fiche affiche modifiée »). Legacy : popup détail/modification avec dossier, semaines, nb semaines, thème, repiquage, conservation, date dernier départ.
- Déclencheur : clic ligne / n° d'affiche.
- Conditions : —
- Effet / message d'erreur : pas de modales imbriquées.
- Sources : spec `[DC] §8` (EX-REC-047) · écran ECR-REC-05
- Questions liées : Q-120
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-131 — Champs modifiables de la fiche
- Origine : MODIFIÉE
- Énoncé : modifiables : annonceur saisi, thème saisi, imprimeur, allée, rayon, « à conserver », commentaire ; NON modifiables : date d'entrée, quantité (par mouvements), rebus, date de dernière sortie. Legacy : également format, dossier, semaines, repiquage, conservation, date dernier départ, validationAdmin, zone_Picking, photo ; modifiable même rebutée ou fusionnée côté serveur.
- Déclencheur : « Enregistrer ».
- Conditions : droits RG-REC-002.
- Effet / message d'erreur : historique RG-REC-006 ; dossiers/semaines via rattachements.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` (RG-REC-024) · spec EX-REC-047 · écran ECR-REC-05
- Questions liées : Q-143, Q-150
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; apps/api/test/reception/affiches-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-132 — Onglet Mouvements
- Origine : NOUVELLE
- Énoncé : tableau Date, Mouvement (type + motif), Quantité (signée), Par, Auto ; n° de réception cliquable → fiche réception ; machine/équipe via `IdActivite` (legacy).
- Déclencheur : onglet.
- Conditions : —
- Effet / message d'erreur : tri date décroissante.
- Sources : spec `[DC] §8` ; ateliers EX-REC-509 · écran ECR-REC-05
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-134 — Onglet Préparations
- Origine : MODIFIÉE
- Énoncé : tableau Dossier, Annonceur, Thème, Départ, Quantité ; actions « Changer de thème… », « Retirer », « + Rattacher à un autre dossier » sans limite (ANO-12) ; chaque changement pose « Feuille à refaire ». Legacy : « Préparations », ajout par recherche, dissociation.
- Déclencheur : onglet.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-135 à 137.
- Sources : spec `[DC] §8, §10` (EX-REC-048) · écran ECR-REC-05
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-135 — Changer de thème
- Origine : NOUVELLE
- Énoncé : « Changer de thème… » propose les autres thèmes du MÊME dossier ; pose « Feuille à refaire » et alerte ; vaut validation seulement si `coord`, sinon repasse « à confirmer ». Purge des anciens thèmes des réceptions attendues après changement (RG-REC-150).
- Déclencheur : action.
- Conditions : thème ∈ thèmes du dossier.
- Effet / message d'erreur : « Thème corrigé : feuille de stock à refaire. » ; RG-X-012.
- Sources : spec `[DC] §8, §10` (EX-REC-048, 062) · écran ECR-REC-05
- Questions liées : Q-143
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; apps/api/test/reception/affiches-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-136 — « + Rattacher à un autre dossier »
- Origine : NOUVELLE
- Énoncé : panneau de recherche (n° dossier, DA, annonceur, thème ; propositions par défaut : même annonceur, 6 max, triées par reste décroissant) ; par ligne Qté ≥ 1 et « Rattacher » ; l'affiche orpheline devient IDENTIFIEE et la palette A_CONTROLER.
- Déclencheur : bouton.
- Conditions : quantité ≥ 1.
- Effet / message d'erreur : 422 `REC_QTE_DOSSIER_OBLIGATOIRE` « Indiquez la quantité pour ce dossier. » ; « Affiche n° rattachée au dossier n : feuille de stock à refaire… ».
- Sources : spec `[DC] §8, §10` (EX-REC-048) ; legacy `BLL/ReceptionListeAfficheBll.cs:533-555` (RG-REC-091) · écran ECR-REC-05
- Questions liées : Q-124
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04) : tri par reste décroissant (6 au plus) fait par l’API (HYPOTHÈSE Q-178 (21))
- Tests : apps/api/test/reception/affiches.int.test.ts ; apps/api/test/reception/affiches-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/inconnues.int.test.ts

### RG-REC-137 — Retirer un rattachement
- Origine : MODIFIÉE
- Énoncé : « Retirer » passe le rattachement à RETIRE (qui/quand), historisé comme dissociation (RG-REC-007) ; jamais supprimé ; si plus aucun lien actif → RG-REC-114. Legacy : `affiche_livraison_Id = NULL`, `ARecevoir` non remis à faux, `date_dernier_depart` recalculé, sans contrôle de statut.
- Déclencheur : « Retirer ».
- Conditions : lien ACTIF.
- Effet / message d'erreur : recalcul RG-REC-017 ; RG-X-013.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:577-586` (RG-REC-092 ; RG-COO-023) · spec EX-REC-048
- Questions liées : Q-136
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx ; rattachement.ts:retirerRattachement — FAIT : REC-P08 (2026-11-04) : action « Retirer » de l’onglet Préparations
- Tests : apps/api/test/reception/affiches.int.test.ts ; apps/api/test/reception/affiches-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-138 — Rattachement manuel après validation ou début de production
- Origine : NOUVELLE
- Énoncé : affiches en plus pour un autre dossier : rattachement manuel possible même après validation ou début de production, avec historique ; seul le surplus ; autre plateforme : transfert puis réception.
- Déclencheur : « + Rattacher ».
- Conditions : —
- Effet / message d'erreur : historique.
- Sources : spec EX-COO-045
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-139 — Recherche de lignes à rattacher (legacy)
- Origine : CONSERVÉE
- Énoncé : critères dossier (liste « + »), annonceur, thème, format, départ « S<n>/<année> » ; filtres communs : non `FromBroadcast`, `rpc_theme` non nul, non déjà associée, même plateforme, support autorisé ; combos alimentés par `tf_prepa_affiche`.
- Déclencheur : onglet Préparations.
- Conditions : —
- Effet / message d'erreur : candidates.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:420-435, 484-531`, `REPO/ReceptionListeAfficheRepository.cs:287-442` (RG-REC-090) · Q-147
- Questions liées : Q-147
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-140 — Association de lignes (legacy) : lignes sans affiche seulement
- Origine : MODIFIÉE
- Énoncé : legacy : seules les prépas non encore associées sont liées (`ARecevoir = true`, `affiche.date_maj`, historique `AfficheAssocier`) ; liste vide → NullReference ; aucun contrôle de cohérence plateforme/format/thème/quantité ; bouton réservé à `validation_admin`. Cible : N-N avec quantité, contrôles RG-REC-024.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : remplacée par RG-REC-136.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:533-555`, `CTRL/ReceptionListeAfficheController.cs:378-388` (RG-REC-091 ; RG-COO-022)
- Questions liées : —
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-141 — Dissociation (legacy)
- Origine : MODIFIÉE
- Énoncé : voir RG-REC-137 ; legacy : la ligne reste « reçue » mais n'est plus proposée (ARecevoir non remis) : en cible le statut est recalculé.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir RG-REC-137.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:577-586` (RG-REC-092)
- Questions liées : —
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-142 — Auto-association à l'ouverture de la fiche (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : ouverture depuis une liste filtrée, affiche sans prépa et non validée → association automatique de toutes les prépas du même dossier/plateforme/support (écriture lors d'une consultation). Cible : une lecture n'écrit JAMAIS ; la proposition de rattachement se fait à la réception (RG-X-001).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : supprimé.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:218-257` (RG-REC-093 ; RG-COO-024) · spec EX-COO-004
- Questions liées : Q-148
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04) : une lecture de la fiche n’écrit jamais (test de version inchangée)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-143 — Date de dernier départ
- Origine : CONSERVÉE
- Énoncé : `date_dernier_depart` = vendredi de la semaine max (de l'année max) des lignes associées hors `FromBroadcast` ; NULL s'il n'y en a plus ; recalcul à chaque association/dissociation. Legacy : max de semaine et d'année indépendants (faux sur deux années) ; valeur stockée écrase le calcul à l'ouverture.
- Déclencheur : rattachement/retrait.
- Conditions : —
- Effet / message d'erreur : mise à jour.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:557-575, 594-609, 211, 221`, `REPO/ReceptionListeAfficheRepository.cs:596-605` (RG-REC-032)
- Questions liées : Q-120
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-144 — Conservation : valeur par défaut
- Origine : CONSERVÉE
- Énoncé : conservation = `affiche.conservation` si > 0, sinon 20 ; vider le champ remet 0 ; non persisté sauf enregistrement. Unité (jours/semaines) non établie ; alerte legacy « dernier départ dépassé » (date_dernier_depart > date_entree + 7 × conservation) en rouge.
- Déclencheur : ouverture fiche.
- Conditions : —
- Effet / message d'erreur : affichage.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:213, 942, 984`, `SP/p_s_affiche_a_fusionner.sql:42` (RG-REC-031, 010)
- Questions liées : Q-120
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-145 — « Affiche à conserver »
- Origine : CONSERVÉE
- Énoncé : case (reliquat d'entretien) historisée ; les affiches « à conserver » n'apparaissent pas automatiquement dans la destruction ; « Marquer à conserver » aussi dans Stocks. Droit legacy `validation_admin`.
- Déclencheur : case.
- Conditions : —
- Effet / message d'erreur : historique `ModificationAfficherAConserver`.
- Sources : legacy `HistorisationBll.cs:29-32` · spec EX-STK-504 · écran ECR-REC-05, ECR-STK-01
- Questions liées : Q-136
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04)
- Tests : apps/api/test/reception/affiches.int.test.ts ; apps/api/test/reception/affiches-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-147 — Formats de saisie dossier/semaines (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : dossiers = 6 chiffres séparés par « + » ; semaines `S`/`s`+2 chiffres séparées par « + » ou « / » ; nb de blocs semaines = nb de dossiers ; `nombre_semaine` = nb d'éléments de `semaines` ; l'un sans l'autre refusé. Messages : « Attention, votre format semaine est inccorect. Exemple format attendue "S41/S42+S41/S42" », « Attention, le nombre de dossier ne correspond pas aux semaines », « Attention, le nombre de semaine ne correspond pas aux semaines ». Réponse HTTP 200 texte. Cible : remplacée par rattachements N-N ; semaines ISO.
- Déclencheur : « Enregistrer » legacy.
- Conditions : —
- Effet / message d'erreur : conservé si le champ texte subsiste (Q-150).
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:136-173` (RG-REC-026 ; RG-COO-025)
- Questions liées : Q-150
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101 / Q-155

### RG-REC-148 — Régénération de `tf_dossier_semaine_depart` (legacy)
- Origine : MODIFIÉE
- Énoncé : après modification d'une affiche orpheline, les lignes sont supprimées/recréées depuis `cont_num` + `semaines` ; année = courante, +1 si n° < semaine courante. Cible : remplacée par rattachements.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/LivraisonAfficheService.cs:1049-1081` (RG-REC-025)
- Questions liées : Q-150
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-155

### RG-REC-150 — Purge des anciens thèmes après changement de thème
- Origine : NOUVELLE
- Énoncé : après modification des IP / changement de thème, les anciens thèmes disparaissent des réceptions attendues et de la recherche de rattachement (le nouveau thème n'« écrase » pas l'ancien aujourd'hui) ; sans alerte.
- Déclencheur : changement de thème.
- Conditions : —
- Effet / message d'erreur : ligne annulée.
- Sources : ateliers EX-REC-504, EX-THM-504 ; spec EX-REC-062 (couvert en partie)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts ; apps/web/src/routes/reception/affiches.tsx ; components/reception/fiche-affiche.tsx — FAIT : REC-P08 (2026-11-04) : HYPOTHÈSE Q-178 (4)
- Tests : apps/api/test/reception/affiches.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-151 — Types de mouvement, append-only
- Origine : MODIFIÉE
- Énoncé : types (`tr_type_mouvement`) : réception, réception (complément), écart de contrôle, production, rebut, sortie et ajout manuels, expédition, fusion, renvoi, destruction ; un mouvement est créé, jamais modifié ni supprimé ; chaque mouvement porte référence, date, BL, équipe, machine, transporteur, imprimeur, quantité, auteur.
- Déclencheur : tout flux de quantité.
- Conditions : —
- Effet / message d'erreur : 409 sur modification/suppression.
- Sources : legacy « Mouvement — append-only » ; spec `[DC] §9, §13` (EX-REC-057 ; EX-TRA-037)
- Questions liées : Q-103
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — apps/api/src/modules/reception/stock.ts:enregistrerMouvement ; service.ts:modifierMouvement ; routes.ts PUT|PATCH|DELETE /api/mouvements/:id. Reste : Type « production » et champs équipe/machine/transporteur/imprimeur absents du modèle : Q-169.
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts ; socle-audit.int.test.ts

### RG-REC-153 — Stock = somme des mouvements ; reçu = somme des rattachements
- Origine : MODIFIÉE
- Énoncé : stock disponible = Σ mouvements ; reçu d'un visuel = Σ quantités rattachées (RG-REC-017). Rebut, destruction, expédition, renvoi sont des mouvements négatifs.
- Déclencheur : lecture.
- Conditions : —
- Effet / message d'erreur : calculé.
- Sources : spec `[DC] §9` (EX-REC-057) ; ateliers EX-STK-501 ; `maquettes-autres-modules.md §0.6`
- Questions liées : Q-103
- Implémentation : FAIT (REC-P01, 2026-11-04) — apps/api/src/modules/reception/stock.ts:stockAffiche, recuLigne, SENS ; service.ts:lireStockAffiche. Reste : —
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts

### RG-REC-154 — Double source de quantité (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : `affiche.quantite` et `SUM(mouvement.quantite)` coexistent (listes et picking = somme ; destruction = `quantite` ; vidage du rebus : `quantite = 0` + mouvement −somme ; livraison : `quantite` écrasée). Cible : une seule vérité (mouvements).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : colonne dénormalisée éventuelle recalculée.
- Sources : legacy `SP/p_GetListeAffiche.sql:100-109`, `SP/p_s_destruction.sql:19`, `BLL/ReceptionListeAfficheBll.cs:311-321` (RG-REC-023)
- Questions liées : Q-103
- Implémentation : FAIT (REC-P01, 2026-11-04) — apps/api/src/modules/reception/stock.ts:enregistrerMouvement (cache recalculé, écriture versionnée). Reste : —
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts ; socle-audit.int.test.ts

### RG-REC-155 — Ajout et sortie manuels de stock (legacy)
- Origine : CONSERVÉE
- Énoncé : « Ajouter » : `quantite += saisie` + mouvement positif (récépissé, expéditeur) ; « Sortir » : `quantite −= saisie`, `date_derniere_sortie = now`, mouvement négatif, récépissé « Sortie ». Legacy : aucun contrôle de quantité > 0 ni de stock suffisant (stock négatif possible), actions visibles même sur rebus. La Liste des affiches cible n'a pas d'action de création ; types « ajout/sortie manuels » prévus V2.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : HYPOTHÈSE Q-117 : quantité > 0 et sortie ≤ disponible.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:800-835`, `22` (RG-REC-021, 022) · spec EX-REC-057 ; Q-REC-12
- Questions liées : Q-117
- Implémentation : apps/api/src/modules/reception/stocks.ts — BLOQUÉ : BLOQUÉ Q-117 : droit « ? » pour tous → refusé par le catalogue (403) ; logique codée sous HYPOTHÈSE Q-178 (13)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : BLOQUÉ) — PARTIEL (plus BLOQUÉ) : ajout / sortie manuels codés et testés (stocks.ts) mais le droit n'est attribué à AUCUN profil (« ? », Q-117) : la fonction est refusée à tous (403) tant que Q-117 n'est pas tranchée

### RG-REC-156 — Mise au rebut depuis Stocks
- Origine : NOUVELLE
- Énoncé : « Mettre au rebut » (Stock par affiche) : quantité par affiche (min 1, défaut 1), motif (Affiche déchirée, Mauvais visuel, Erreur de quantité, Autre) ; mouvement « Mise au rebut » négatif plafonné au disponible ; rebut = sortie de stock.
- Déclencheur : action groupée.
- Conditions : quantité ≤ disponible.
- Effet / message d'erreur : voir RG-REC-064.
- Sources : spec `[DC] §5, §10` (EX-REC-024, 061) ; EX-STK-504 · écran ECR-STK-01
- Questions liées : Q-118
- Implémentation : apps/api/src/modules/reception/stocks.ts — FAIT : REC-P09 (2026-11-04) : route POST /api/affiches/:id/rebut ; écran Stocks (ECR-STK-01) hors module Réception
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts

### RG-REC-157 — Mise au rebus d'une affiche (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : l'affiche et celles dont elle est chapeau passent `rebus = true`, `date_rebus = now`, historique `AfficheMiseEnRebus` ; quantité inchangée ; sans confirmation serveur, sans test de statut ni de droit ; aucune sortie du rebus. Cible : rebut = mouvement négatif ; flag à migrer.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : HYPOTHÈSE Q-118.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:271-289`, `REPO/ReceptionListeAfficheRepository.cs:615-622` (RG-REC-040)
- Questions liées : Q-118, Q-155
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-118 / Q-155

### RG-REC-158 — Vidage du rebus (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : pour la plateforme, affiches `rebus = true` à somme de mouvements > 0 : mouvement −somme (récépissé « Vidage du rebus »), `quantite = 0`, historique `ViderRebus` (écrit avant la maj, sans transaction) ; confirmation « Confirmez-vous le vidage du rebus ? ». « À rapprocher de la destruction » (cible).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir Q-118/Q-119.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:297-325`, `REPO/ReceptionListeAfficheRepository.cs:220-258` (RG-REC-041) · spec EX-REC-061
- Questions liées : Q-118, Q-119
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-118 / Q-155

### RG-REC-159 — Tag « Au rebut » (proposé)
- Origine : NOUVELLE
- Énoncé : tag « Au rebut » PROPOSÉ (non décidé) pour afficher le rebut.
- Déclencheur : rebut > 0.
- Conditions : —
- Effet / message d'erreur : affichage seul tant que non décidé.
- Sources : spec `[DC] §9` (EX-REC-054)
- Questions liées : Q-118
- Implémentation : — — BLOQUÉ Q-118 : tag « Au rebut » proposé, non décidé (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-160 — Etat de destruction (legacy) : déplacé dans Stocks › Fin de campagne
- Origine : MODIFIÉE
- Énoncé : legacy : `p_s_destruction` = (`date_dernier_depart < now − 4 sem` ET `a_conserver = 1` ET `date_entree < now − 365 j`) OU (… ET (`a_conserver` 0/NULL) ET `plt_id` ET `rebus != 0`) — précédence AND/OR : la 1re branche ignore plateforme et rebus ; quantité = `affiche.quantite` ; colonne « Statut » = « C » si à conserver et âge > 356 j (365 en SP : coquille probable) ; case « Rebus » pose `rebus`, `date_rebus` sans historique. Cible : écran Stocks › Fin de campagne (STK-03 ; délais 2 m² = 4 sem., 8 m² = 2 sem., à revoir CGV 2027 ; destruction = mouvement). Module STK.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : écart documenté, pas de reprise à l'identique.
- Sources : legacy `SP/p_s_destruction.sql:12-39`, `BLL/DestructionBll.cs:16-92`, `CTRL/DestructionController.cs:37-65` (RG-REC-050, 051, 052) · spec EX-STK-502, 504 ; EX-EXI-076 · écran ECR-STK-03
- Questions liées : Q-119
- Implémentation : — — BLOQUÉ Q-119 / Q-385 : état de destruction déplacé dans Stocks › Fin de campagne (ECR-STK-03, D-13) (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-163 — Fusion manuelle d'affiches (legacy) — non reprise
- Origine : SUPPRIMÉE
- Énoncé : fusion depuis la liste (droit `fusion_affiche`, ≥ 2 affiches) : contrôles « les affiches n'ont pas le même thèmes / dossier / semaines » (b, c toujours vrais), chapeau = plus petit id ; fusion « non homogène » (choix thème/allée/rayon/repiquage). Retrait explicite : « « Zone picking » et « Fusion des affiches » du menu actuel ne sont pas repris dans la cible ; la fusion est inopérante (ANO-15). »
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucune fonction. Données héritées : RG-REC-169.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:424-452, 496-538` (RG-REC-060, 061, 014) · spec `[README] §3, §7` (EX-REC-079)
- Questions liées : Q-100
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-100 / Q-155

### RG-REC-165 — Effets d'une fusion (legacy) — données héritées
- Origine : SUPPRIMÉE
- Énoncé : legacy : chapeau `est_fusionne`, validation OU, commentaires joints par « / », quantité = somme, conservation max ; cibles : mouvements dupliqués sur le chapeau, prépas/assos/activités réaffectées, `fusion_affiche(chapeau, cible)` ; quatre `SaveChanges`. Non reprise (voir RG-REC-163).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : migration : Q-155.
- Sources : legacy `BLL/FusionAfficheBll.cs:61-234` (RG-REC-062 ; RG-COO-031)
- Questions liées : Q-100, Q-155
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-100 / Q-155

### RG-REC-166 — Risque legacy : chapeau inclus dans ses cibles
- Origine : SUPPRIMÉE
- Énoncé : `Fusionner` (liste) utilise `Skip(0)` : le chapeau est sa propre cible (quantité doublée, mouvements dupliqués, `fusion_affiche(chapeau, chapeau)`), alors que `FusionNonHomogene` utilise `Skip(1)`. Ne pas reproduire.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : sans objet.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:435-440, 521` (RG-REC-064)
- Questions liées : Q-100
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-100

### RG-REC-167 — Écran Fusion : propositions automatiques (legacy)
- Origine : SUPPRIMÉE
- Énoncé : `p_s_affiche_a_fusionner` : groupes de ≥ 2 affiches de même thème/plateforme/support/dossier/semaine/année, semaine max de départ ∈ [semaine−5, semaine], chapeau = MIN(id) ; message « La fusion a été effectuée avec succes ! ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise.
- Sources : legacy `BLL/FusionAfficheBll.cs:18-59`, `SP/p_s_affiche_a_fusionner.sql` (RG-REC-063) · spec EX-REC-079
- Questions liées : Q-100
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-100

### RG-REC-168 — Zone picking (legacy)
- Origine : SUPPRIMÉE
- Énoncé : case « zone Picking » (droit `Zone_Picking`), statut d'affichage « Picking » / « Réceptionnée », exclusion de l'Édition picking. Écran « Zone picking » non repris dans la cible (EX-REC-079) ; la donnée `zone_Picking` reste héritée.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir Q-101.
- Sources : legacy `VIEW/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:256-265` (RG-REC-029, 009) · spec EX-REC-079
- Questions liées : Q-101
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-169 — Affiche héritée « fusionnée » : lecture seule
- Origine : MODIFIÉE
- Énoncé : une affiche cible d'une fusion héritée est en lecture seule (le legacy ne l'impose qu'à l'UI) ; toute écriture serveur → 409.
- Déclencheur : écriture sur affiche héritée fusionnée.
- Conditions : ligne dans `fusion_affiche.id_affiche`.
- Effet / message d'erreur : 409 `REC_AFFICHE_FUSIONNEE_LECTURE_SEULE`.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:223`, `_DetailAffiche.cshtml:270-276` (RG-REC-030)
- Questions liées : Q-155
- Implémentation : apps/api/src/modules/reception/affiche.ts:assertAfficheNonFusionnee (toute écriture versionnée) — FAIT : REC-P09 (2026-11-04) : HYPOTHÈSE Q-178 (14)
- Tests : apps/api/test/reception/affiches.int.test.ts ; apps/api/test/reception/stock-alertes-admin.int.test.ts

### RG-REC-170 — Drill-down depuis un dossier (legacy)
- Origine : CONSERVÉE
- Énoncé : liste restreinte à un dossier/semaine/site via lien (`ListeAffiches(dossier, …)`) ; en cible un lien pose des filtres appliqués une fois à l'arrivée, bouton « ← Retour ».
- Déclencheur : lien depuis EDR/fiche dossier/alertes.
- Conditions : —
- Effet / message d'erreur : liste filtrée (le cache `AffichesPreparation` legacy non repris).
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:47-111` (RG-REC-012) · spec EX-TRA-013
- Questions liées : —
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-171 — Éléments de la liste legacy sans équivalent cible
- Origine : CONSERVÉE
- Énoncé : statistiques du cadre « Résultat » (nb lignes, nb d'affiches hors rebus, nb au rebus), colonne « Zone », actions par ligne sans masquage selon le statut. Non repris par les specs, non retirés.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : à confirmer.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:127-144, 954`, `Index.cshtml:152-169` (RG-REC-011, 009, 013)
- Questions liées : Q-100
- Implémentation : — (règle legacy non reprise par la cible) — PARTIEL : REC-P08/P09 (2026-11-04) : comportement legacy non repris (remplacé par la cible) ; à passer HORS PÉRIMÈTRE après validation de l’équipe (Q-100, Q-101, Q-118, Q-155)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-100/101/118/155) (avant : PARTIEL) — statut explicite : règle legacy NON REPRISE par la cible (aucune implémentation, aucun test) ; décision de l'utilisateur attendue (HORS PÉRIMÈTRE ou reprise), questions Q-101

### RG-REC-175 — Alerte « Validation admin » : case sans contrôle serveur (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : alerte non bloquante « La quantité reçue ne correspondent pas à la quantité BC » à la coche si quantité CIRCE < quantité BC ; `validationAdmin`, `aConserver`, `zone_Picking` écrits sans contrôle serveur. Cible : la quantité n'est pas une condition de la validation (RG-REC-050) ; droit contrôlé (RG-REC-003).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : alerte non reprise.
- Sources : legacy `Partial_ModifierDetailsAffiche.cshtml:24-39, 302-324` (RG-REC-027) · spec EX-COO-011
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/affiches.ts:changerValidationAdmin (droit validation_admin.valider, sans condition de quantité) — FAIT : REC-P08 (2026-11-04) : alerte legacy non reprise ; droit contrôlé (RG-REC-003)
- Tests : apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-176 — Ce qui se calcule ne se coche jamais
- Origine : NOUVELLE
- Énoncé : Circé pose chaque statut et chaque tag lui-même à chaque événement ; aucun tag n'est coché à la main ; les statuts sont calculés une fois et lus par tous les écrans.
- Déclencheur : tout événement.
- Conditions : —
- Effet / message d'erreur : aucune route d'écriture d'un tag.
- Sources : spec `[DC] §9` (EX-REC-050, 051)
- Questions liées : —
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — FAIT : REC-P05/P06/P08 (2026-11-04) : tags calculés (tagsDe), aucune route n’écrit un statut ou un tag ; la modification de la fiche les ignore
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts ; affiches-complement.int.test.ts

### RG-REC-178 — Paramètres « Règles métier › Réception »
- Origine : NOUVELLE
- Énoncé : paramètres : écart signalé 10 % ; purge des attendues 4 semaines (sauf conservation à l'année) ; délai de contrôle du sas 24 h ; comptage par morceau < 30 ; exemplaires de feuille 2 (1 à 5) ; allée des réceptions inconnues X. Valeurs minimales appliquées ; changement s'applique aux prochains traitements.
- Déclencheur : écran Administration.
- Conditions : rôle admin.
- Effet / message d'erreur : « Seuil enregistré (s'applique aux prochaines préparations). ».
- Sources : spec `[DC] §11` (EX-REC-073) · écran ECR-ADM-05
- Questions liées : Q-105
- Implémentation : apps/api/src/modules/reception/administration.ts — PARTIEL : REC-P10 (2026-11-04) : API seule (GET / PUT /api/parametres/reception) ; écran Administration (ECR-ADM-05) hors périmètre de la session
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT (avant : PARTIEL) — FAIT : paramètres Réception lisibles et modifiables par l'écran « Règles métier » (ECR-ADM-05), bornes et refus testés en intégration (parametres-regles.int.test.ts) et E2E (admin-parametres.spec.ts), sous hypothèses Q-405 à valider

### RG-REC-179 — Référentiels Imprimeurs, Livreurs, Agents de réception
- Origine : NOUVELLE
- Énoncé : trois référentiels dans Administration (lot 0), utilisés par « Contrôleur » et « Déchargé par » ; ajout par l'administrateur.
- Déclencheur : écran Administration.
- Conditions : rôle admin.
- Effet / message d'erreur : voir RG-REC-035.
- Sources : spec `[DC] §11, §15` (EX-REC-074 ; EX-ADM-501) · écran ECR-ADM-07
- Questions liées : Q-115
- Implémentation : apps/api/src/modules/reception/administration.ts — PARTIEL : REC-P10 (2026-11-04) : imprimeurs et livreurs (API) ; agents = utilisateurs recep (Q-177 (1), D-04) ; écran ECR-ADM-07 hors périmètre de la session
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL : écran ECR-ADM-07 (imprimeurs, livreurs ; agents = utilisateurs `recep` en lecture seule) fait sous hypothèses Q-407 À VALIDER ; ni renommage ni suppression ; lire la liste des agents exige `referentiel.gerer` (écart consigné)

### RG-REC-180 — Purge automatique des réceptions attendues
- Origine : NOUVELLE
- Énoncé : les lignes attendues Attendue/Partielle de plus de 4 semaines sont purgées automatiquement, sauf « conservation à l'année ». Legacy : les lignes « venues de Broadcast » ne sont jamais purgées.
- Déclencheur : traitement planifié.
- Conditions : ancienneté > `purgeAttendues` ; non conservée.
- Effet / message d'erreur : voir RG-REC-181.
- Sources : spec `[DC] §11, §12` (EX-REC-075) ; ateliers EX-REC-512
- Questions liées : Q-130
- Implémentation : PARTIEL (REC-P02, 2026-11-04 ; étape 8 lot 4, 2026-11-06) — apps/api/src/modules/reception/purge.ts:purgerReceptionsAttendues (hypothèses Q-130) ; apps/api/src/modules/taches/service.ts:executerTache (PURGE_ATTENDUES). Reste : horaire planifié VIDE par défaut = désactivée (Q-005, Q-410), aucun horaire sourcé.
- Tests : apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — PARTIEL conservé : purge planifiable (D-20), horaire VIDE par défaut = désactivée (Q-005, Q-410)

### RG-REC-181 — Purge sans alerte, une ligne au journal
- Origine : NOUVELLE
- Énoncé : la purge ne lève aucune alerte, n'exige aucune validation, écrit une ligne au journal.
- Déclencheur : purge.
- Conditions : —
- Effet / message d'erreur : « n réception(s) attendue(s) purgée(s). ».
- Sources : spec `[DC] §11, §12` (EX-TRA-032)
- Questions liées : Q-130
- Implémentation : PARTIEL (REC-P02, 2026-11-04) — apps/api/src/modules/reception/purge.ts (une ligne au journal, sans auteur ni alerte). Reste : S’exécutera quand RG-REC-180 sera planifiée (Q-005).
- Tests : apps/api/test/reception/attendues.int.test.ts ; attendues-complement.int.test.ts

### RG-REC-182 — Alerte « Visuel non reçu / reçu en partie »
- Origine : NOUVELLE
- Énoncé : départ en S : critique si rien reçu, grave si partiel ; S+1 : à surveiller ; destinataires chefs d'équipe, Coordination, Réception ; bandeau et résumé à 7 h.
- Déclencheur : traitement périodique.
- Conditions : ligne Attendue/Partielle selon la semaine de départ.
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-063) · écran ECR-TRA-01
- Questions liées : Q-131, Q-132
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL : seul le bandeau d'alerte « Visuel non reçu / reçu en partie » existe ; le résumé de 7 h et le mail ne sont pas envoyés (Q-375) ; les départs antérieurs à la semaine S ne sont pas remontés (hypothèse Q-178 (9))

### RG-REC-183 — Alerte « Écart de réception supérieur à 10 % »
- Origine : NOUVELLE
- Énoncé : « à surveiller » ; Réception et Coordination ; levée quand l'écart dépasse le seuil à la réception ou au contrôle.
- Déclencheur : validation de réception ; contrôle.
- Conditions : écart > 10 %.
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-064) ; ateliers EX-REC-519
- Questions liées : Q-133
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-184 — Alerte « Réception sans instructions de pose »
- Origine : NOUVELLE
- Énoncé : grave ; Coordination (qui prévient la Pré-Prod) ; bandeau (et mail selon canal).
- Déclencheur : réception sur dossier sans IP.
- Conditions : IP non saisies.
- Effet / message d'erreur : alerte ; libellé varie selon sources.
- Sources : spec `[DC] §11` (EX-REC-065) ; EX-COO-031
- Questions liées : Q-111
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec.int.test.ts

### RG-REC-185 — Alerte « Réception inconnue à identifier »
- Origine : NOUVELLE
- Énoncé : dès la création ; importante après 24 h ; Coordination et Réception ; pas de mail.
- Déclencheur : création d'une réception inconnue.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §7, §11` (EX-REC-066)
- Questions liées : Q-110
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-186 — Alerte « Dossier introuvable »
- Origine : NOUVELLE
- Énoncé : grave dès le signalement ; Coordination du site ; sans mail.
- Déclencheur : « Signaler ».
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-067)
- Questions liées : Q-110
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours) ; apps/api/test/reception/audit-rec-2.int.test.ts

### RG-REC-187 — Alerte « Feuille de stock définitive à imprimer »
- Origine : NOUVELLE
- Énoncé : après rattachement d'une réception inconnue, tant que la feuille n'est pas imprimée ; destinataire : Réception de la plateforme.
- Déclencheur : rattachement.
- Conditions : feuille temporaire posée.
- Effet / message d'erreur : alerte levée à l'impression.
- Sources : spec `[DC] §11` (EX-REC-068)
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-188 — Alerte « Feuilles de stock à refaire »
- Origine : NOUVELLE
- Énoncé : thème ou rattachement changé ; à surveiller ; Réception et Coordination.
- Déclencheur : changement de thème.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-069) ; ateliers EX-REC-520
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-189 — Alerte « Palette à contrôler depuis plus de 24 h »
- Origine : NOUVELLE
- Énoncé : grave au double du délai ; Réception et chefs d'équipe.
- Déclencheur : traitement.
- Conditions : durée > délai.
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-070)
- Questions liées : Q-157
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — FAIT : REC-P10 (2026-11-04) : alertes calculées, HYPOTHÈSE Q-178 (9)
- Tests : apps/api/test/reception/stock-alertes-admin.int.test.ts ; apps/api/test/reception/stock-alertes-complement.int.test.ts ; e2e/reception-parcours.spec.ts (E2E du parcours)

### RG-REC-190 — Alertes : canal, gravité, destinataires paramétrables
- Origine : NOUVELLE
- Énoncé : canal et gravité se règlent dans Administration › Paramétrage › Alertes et mails ; chaque alerte ouvre l'écran où agir ; gravités Critique, Important, À surveiller.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir EX-TRA-027 à 031.
- Sources : spec `[DC] §11` ; EX-TRA-028, 029
- Questions liées : Q-132
- Implémentation : apps/api/src/modules/reception/alertes.ts:listerAlertes ; apps/web/src/routes/reception/alertes.tsx — PARTIEL : D-08 partiel (étape 8 lot 3) : canal et destinataires paramétrables (apps/api/src/modules/admin/alertes-regles.ts, écran /admin/alertes) ; gravité non configurable, canaux mail / digest sans effet (Q-375, Q-408)
- Tests : e2e/reception-parcours.spec.ts (E2E du parcours)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — D-08 PARTIEL : canal et destinataires configurables ; gravité non configurable, canaux mail / digest sans effet (Q-375, Q-408)

### RG-REC-191 — Mails à la réception : supprimés
- Origine : SUPPRIMÉE
- Énoncé : « le mail au commercial à la réception est désactivé (refusé le 14/10). Le mail « Réception affiche » aux chefs d'équipe est remplacé par le dashboard ; un résumé reste possible. » ; mail Pré-Prod pour inconnue remplacé par alerte. Legacy : mail HTML aux adresses de la plateforme de la 1re affiche (thread, mails perdus si envoi concurrent, erreurs avalées).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucun mail.
- Sources : legacy `CTRL/LivraisonAfficheController.cs:221-250`, `BLL/ToolBll.cs:391-456` (RG-REC-077 ; RG-ADM-043) · spec `[DC] §1, §11` (EX-REC-072, 078)
- Questions liées : Q-131
- Implémentation : — (fonctions refusées, volontairement absentes : aucune colonne Ordre, aucune étiquette de palette, aucune douchette, aucun mail à la réception ; les mails Coordination D-19 sont distincts) — FAIT : REC-P10 (2026-11-04) : fonctions refusées, absentes
- Tests : apps/api/test/reception/audit-rec.int.test.ts (routes absentes : 404)

### RG-REC-193 — Colonne « Ordre », étiquette de palette, douchette : refusés
- Origine : SUPPRIMÉE
- Énoncé : refusés : colonne « Ordre » du panier (REC-01 ; déplacer plus haut/plus bas), étiquette de palette et douchette (REC-26), mail commercial et assistante (REC-15). « Plus de colonne « Ordre » (REC-01 refusé) ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : fonctions absentes.
- Sources : spec `[DC] §1, §16` (EX-REC-078) ; ateliers EX-REC-508, 523 ; `[DESIGN] §8` (douchette : contradiction)
- Questions liées : —
- Implémentation : aucune route d’envoi de mail ; aucune colonne Ordre / étiquette de palette — FAIT : REC-P10 (2026-11-04) : fonctions refusées, absentes
- Tests : apps/api/test/reception/audit-rec.int.test.ts (routes absentes : 404)
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — colonne Implémentation corrigée : l'ancienne mention « aucune route d'envoi de mail » était fausse depuis D-19 (MailPort, file d'envoi) ; statut FAIT = absence vérifiée

### RG-REC-194 — Dashboard de réception
- Origine : NOUVELLE
- Énoncé : par semaine/annonceur/thème/plateforme/format : attendu, reçu, reste (et %) ; accessible à Coordination, Pré-Prod, équipes ; remplace le mail aux chefs d'équipe. Écran Pilotage (hors REC).
- Déclencheur : lecture.
- Conditions : —
- Effet / message d'erreur : renvoi Pilotage.
- Sources : ateliers EX-REC-516, 517 (POUR DISCUSSION)
- Questions liées : Q-133
- Implémentation : — — BLOQUÉ D-10 / Q-133 : dashboard de réception non spécifié (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-195 — Taux d'entretien (quantités avec/sans entretien)
- Origine : NOUVELLE
- Énoncé : % d'entretien : 8 % si prépa non envoyée ; celui saisi dans Broadcast si envoyée ; 15 % si campagne contrôlée. Priorité CC/prépa non précisée ; Bus +20 % (contraire).
- Déclencheur : calcul attendu avec entretien.
- Conditions : —
- Effet / message d'erreur : calcul.
- Sources : ateliers EX-REC-518 ; EX-EXI-075
- Questions liées : Q-133
- Implémentation : — — BLOQUÉ D-10 / Q-133 : quantités d’entretien non connues côté Réception (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-196 — Alertes du dashboard (3 types)
- Origine : NOUVELLE
- Énoncé : (1) reçu hors entretien < quantité sans entretien ; (2) (reçu − attendu avec entretien) / attendu avec entretien > ±10 % ; (3) réception sans IP.
- Déclencheur : calcul.
- Conditions : —
- Effet / message d'erreur : alertes.
- Sources : ateliers EX-REC-519
- Questions liées : Q-133
- Implémentation : — — BLOQUÉ D-10 / Q-133 (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-197 — Date prévisionnelle de livraison et commentaires
- Origine : NOUVELLE
- Énoncé : champ saisi par les gestionnaires Pré-Prod avec commentaires pour remplacer les échanges mail jusqu'à J-3 ; source BC si Print Cityz vs saisie manuelle ; Pré-Prod ne travaille pas dans Circé (contradiction).
- Déclencheur : saisie.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-020.
- Sources : ateliers EX-REC-516, 520
- Questions liées : Q-134
- Implémentation : BLOQUÉ (REC-P02, 2026-11-04) — —. Reste : Q-134 (source de la date prévisionnelle, Pré-Prod hors Circé).
- Tests : —

### RG-REC-198 — IP reçues après le 1er fichier de production
- Origine : NOUVELLE
- Énoncé : identifier les dossiers dont les IP arrivent après la génération du premier fichier de prod ; modalité (alerte, tag, mail) non précisée.
- Déclencheur : arrivée des IP.
- Conditions : —
- Effet / message d'erreur : voir RG-X-010.
- Sources : ateliers EX-REC-505 (A revoir Bao) ; EX-COO-503
- Questions liées : Q-131
- Implémentation : — — BLOQUÉ Q-131 : modalité (alerte, tag, mail) non précisée ; « 1er fichier de production » hors Réception (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-199 — Batch d'export des réceptions vers PEX/Broadcast (legacy)
- Origine : CONSERVÉE
- Énoncé : `p_batch_alimentation_circe_pex_reception` : prépas non BC des semaines ≥ courante (a) affiches associées, (b) affiches non associées via `tf_dossier_semaine_depart` ; « 2m2 Scrolling » → « 2m2 » ; quantité = Σ mouvements ; ligne retenue si `IdDAChapeau ≠ null` OU (`cont_num ≠ "0"` ET semaine/année non nulles) ; `IdSiteCCF` = 39 si plt 1 sinon 40 (en dur) ; `EstImportePEX = false`, `Destinataire = "CIRCE"` ; insertion `INTERFACE.CIRCE_PEX_RECEPTION`, puis `affiche.envoye = true`, puis `P_CIRCE_Alim_PEX_ReceptionAffiche('PexCirceReception')` ; pas de filtre `envoye` (rejeu complet) ; erreur dans `tt_log` puis relance. Planification inconnue.
- Déclencheur : exécutable batch.
- Conditions : —
- Effet / message d'erreur : voir Q-151.
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:30-103`, `SP/p_batch_alimentation_circe_pex_reception.sql:33-178` (RG-REC-110 ; RG-INT-020 à 022) · spec EX-TRA-039
- Questions liées : Q-005, Q-151
- Implémentation : — — BLOQUÉ Q-005 / D-16 : batch d’export PEX / Broadcast (étape 8) (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-200 — « EstAssociee » : rattachée ET validée
- Origine : CONSERVÉE
- Énoncé : le retour vers Broadcast marque `EstAssociee = true` seulement si l'affiche est liée à une ligne ET `validationAdmin = true` ; orphelines envoyées `false`. Cible : « reçue et associée » reste envoyé à la validation ; retour BC à définir.
- Déclencheur : batch.
- Conditions : —
- Effet / message d'erreur : RG-X-022.
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:89` (RG-REC-111 ; RG-COO-029) · spec EX-TRA-039, EX-EXI-053
- Questions liées : Q-151
- Implémentation : — — BLOQUÉ Q-005 / D-16 (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-201 — Synchronisation Broadcast depuis l'écran Réception (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : GET `PrepaAfficheBC` remplace `tf_prepa_Broadcast` par dossier ; `sup_id` via `Transaco_Surface_Format` ; `repiquage = Bandeau` ; rafraîchissement si > 5 h non utilisé. Décrite comme code mort (EX-EXI-012) ; cible : alimentation par traitement automatique (module Coordination).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise dans l'écran.
- Sources : legacy `BLL/LivraisonAfficheService.cs:867-926` (RG-REC-081 ; RG-INT-012) · spec EX-EXI-012
- Questions liées : Q-005
- Implémentation : — — BLOQUÉ Q-005 / D-16 (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-202 — Alimentation de `tf_prepa_affiche` (legacy) : propriété Coordination
- Origine : CONSERVÉE
- Énoncé : `p_Alimentation_tf_prepa_affiche` (fenêtre S→S+8, `rpc_statut <> 4`, MERGE inopérant, bandeaux, `IdDAChapeau`) relève de RG-COO (alimentation, RG-COO-003 à 012 provisoires) ; la Réception ne fait que lire.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : renvoi COO.
- Sources : legacy `SP/p_Alimentation_tf_prepa_affiche.sql` (RG-REC-082) · Q-005
- Questions liées : Q-005
- Implémentation : — — BLOQUÉ Q-005 / D-16 (propriété Coordination) (2026-11-04)
- Tests : (rempli à l'étape 5/6)

### RG-REC-203 — Lien « visuel disponible » et modale Visuel
- Origine : NOUVELLE
- Énoncé : un bouton « voir le visuel » (lien bleu) devant chaque visuel dans Réception et Suivi par thème ouvre la modale Visuel (dossier, DA, atelier·site, format, départ, position, repiquage, reçu/attendu, n° d'affiche (allée-rayon) ou « pas encore reçue », exclusion, préparation) ; utile pour vérifier les bandeaux.
- Déclencheur : clic.
- Conditions : visuel disponible dans l'état des réservations.
- Effet / message d'erreur : modale.
- Sources : ateliers EX-REC-510, EX-SCR-513 · écran ECR-REC-12
- Questions liées : —
- Implémentation : PARTIEL (REC-P03, 2026-11-04) — apps/api/src/modules/reception/visuel.ts:lireVisuel ; apps/web/src/components/reception/modale-visuel.tsx. Reste : Position dans le train, préparation, image Broadcast : état des réservations (D-10).
- Tests : apps/api/test/reception/bon-livraison.int.test.ts ; bon-livraison-complement.int.test.ts ; e2e/reception-panier.spec.ts

## 5. Règles inter-modules (RG-X) concernant ce module
Règles RG-X-001…049 initiées par la Réception. Les règles RG-X-050…099 initiées par la Coordination sont dans `COORDINATION_REGLES_METIER.md` §5 et s'appliquent aussi à la Réception (voir l'index en fin de section).

### RG-X-001 — Valider la réception : proposition de rattachement / validation admin
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui (dans RG-REC-046)
- Énoncé : à « Valider la réception », Circé PROPOSE pour chaque affiche créée le rattachement à la ligne attendue (aidé du BL : n° de dossier ou de DA, format, plateforme, semaine, visuel) et pose la validation admin à « À confirmer : proposé » (cas sûr, pré-coché) ou « À confirmer : doute » (motif). Rien n'est validé sans une personne ; nom et date tracés (option A du 02/11, hypothèse retenue avec la cheffe de projet). Les définitions (cas sûr, motifs, confirmation en lot) sont propriété de RG-COO (validation admin).
- Déclencheur : validation d'une réception (voie dossier connu).
- Conditions : cas sûr = rattachée à une ligne active, n° lu = celui de la ligne, même format, un seul thème possible (ou visuel du BL), un seul dossier ; sinon doute.
- Effet / message d'erreur : ligne dans « Validation admin et Instruction OK » ; alerte « Validation admin à confirmer » pour un doute (grave départ S/S+1) ; historique « Rattachement proposé… à confirmer par la Coordination ».
- Sources : spec `[PP] §5`, `[RA]` (EX-COO-004, 006, 007, 008, 015) ; `[DC] §4, §15` (EX-REC-014) ; ateliers EX-COO-506/507 (3 événements : remplacés par option A) · écran ECR-REC-01 ; ECR-COO-01
- Questions liées : Q-125, Q-136
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:affichesDesDossiers ; apps/api/src/modules/reception/bon-livraison.ts (mode BL, Q-184) ; validation.ts:validerReception (aucune validation posée) — PARTIEL : COO-P03 (2026-11-05) : proposition (lien BL) sans validation, état « à confirmer : proposé / doute » calculé ; reste : alerte « Validation admin à confirmer » (COO-P05) · ÉTAPE 7 (2026-11-05) : FAIT — circuit Réception → Coordination vérifié bout en bout (proposition sans validation, motifs de doute, alerte « Validation admin à confirmer »)
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-01, R-02) ; apps/api/test/interactions/atomicite.int.test.ts (A-01, A-02) ; e2e/interactions.spec.ts

### RG-X-002 — Motifs de doute posés par la Réception
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : la Réception fournit à la Coordination : mode de rattachement (BL / VISUEL / MAIN), format du BL ≠ format de la ligne, plusieurs thèmes possibles, répartition à confirmer (visuel de plusieurs dossiers), IP non saisies, validation annulée. Doutes jamais pré-cochés.
- Déclencheur : rattachement.
- Conditions : au moins un motif.
- Effet / message d'erreur : statut VALIDATION_ADMIN.A_FAIRE_DOUTE avec motifs.
- Sources : spec `[PP] §5`, `[PC]` (EX-COO-007) ; RG-REC-032
- Questions liées : Q-136
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:motifsDoute — FAIT : COO-P03 (2026-11-05) : motifs BL / FORMAT / THEME / MULTI / SANS_IP / ANNULEE calculés (Q-185)
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-X-003 — Réception : unités en attente → prêtes à produire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Valider la réception » (et rattachement d'une inconnue) fait passer « prêt à produire » les unités en attente de ces affiches (EN_ATTENTE → PRET quand les affiches attendues sont toutes reçues) ; recalcul automatique dans les deux sens.
- Déclencheur : réception, rattachement, retrait.
- Conditions : toutes les affiches d'une unité reçues.
- Effet / message d'erreur : « n unité(s) prête(s) à produire ».
- Sources : spec `[DC] §4, §15` (EX-REC-014) · écran ECR-REC-01 ; `maquettes-autres-modules.md §0.1`
- Questions liées : Q-102
- Implémentation : apps/api/src/modules/coordination/unites-pretes.ts:statutsTrainsDesDossiers, unitesDevenuesPretes ; apps/api/src/modules/reception/validation.ts:validerReception ; apps/api/src/modules/reception/inconnues.ts:rattacherInconnue ; apps/api/src/modules/coordination/trains.ts:couverture, statutUnite · ÉTAPE 7 (2026-11-05) : FAIT — le statut EN_ATTENTE / PRET est CALCULÉ à la lecture (Q-250) donc recalculé dans les deux sens ; le message « n unité(s) prête(s) à produire » est produit dans la transaction de la réception (HYPOTHÈSE Q-102)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-17)

### RG-X-004 — Statut de la ligne attendue et n° d'affiche lus par la Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : tout événement de réception recalcule le statut de la ligne attendue (RG-REC-018) et le n° d'affiche visible dans l'état des réservations dès la réception (• à confirmer, ✓ validée), dans le suivi de prod dès la prépa.
- Déclencheur : réception, contrôle, rattachement.
- Conditions : —
- Effet / message d'erreur : colonnes Reçu / Reste / N° d'affiche mises à jour.
- Sources : spec `[README] §3` ; EX-COO-014, 048
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/lignes.ts:recalculerLigne ; apps/api/src/modules/coordination/effets-validation.ts:marqueEtatReservations, numeroVisibleSuiviProd · ÉTAPE 7 (2026-11-05) : FAIT — reçu / reste / statut de ligne recalculés à chaque événement de réception, de contrôle ou de lecture de Broadcast
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-05, R-08) ; apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-03)

### RG-X-005 — « Affiche reçue » indépendant de la validation admin
- Origine : MODIFIÉE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Aff. reçues » de l'état des réservations passe à « oui » à la réception physique, sans attendre la validation admin (corrige ANO-05 : legacy = oui seulement après validation).
- Déclencheur : validation de réception.
- Conditions : —
- Effet / message d'erreur : indicateur lu par EDR/suivi.
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:183-187` (RG-COO-028) · spec EX-REC-052, EX-REC-503, EX-EXI-055
- Questions liées : Q-104
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT — « affiche reçue » = mouvement de réception, sans condition de validation admin ; consolidé étape 7
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-01, R-02) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-07) ; e2e/interactions.spec.ts

### RG-X-006 — Réception inconnue créée → alerte Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : création d'une réception inconnue → alerte immédiate « Réception inconnue à identifier » à la Coordination et à la Réception ; pas de mail ; badge du menu Réceptions inconnues.
- Déclencheur : RG-REC-099.
- Conditions : —
- Effet / message d'erreur : alerte ; compteur.
- Sources : spec `[DC] §7, §11` (EX-REC-036, 066) ; EX-COO-017, 047
- Questions liées : Q-110
- Implémentation : apps/api/src/modules/reception/alertes.ts (RG-REC-185) ; apps/api/src/modules/alertes/service.ts · ÉTAPE 7 (2026-11-05) : FAIT — alerte « Réception inconnue à identifier » et badge « Réceptions inconnues » vus par la Coordination (Q-110)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-09, R-13)

### RG-X-007 — Rattachement d'une inconnue : validation selon le rôle
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : rattachée par la Coordination = validation admin faite ; par la réception = reste « à confirmer ».
- Déclencheur : « Rattacher ».
- Conditions : rôle.
- Effet / message d'erreur : voir RG-REC-111.
- Sources : spec `[DC] §7` ; EX-COO-010, 017
- Questions liées : Q-107
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT — coord / admin = validée ; agent de réception = « à confirmer » (motif BL)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-10)

### RG-X-008 — « Dossier introuvable » → alerte Coordination du site
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Signaler » → alerte grave à la Coordination du site (Wissous : équipe Coord. Réception de Boulogne ; Nîmes : Pré-Prod Nîmes ?) ; la Pré-Prod corrige dans Broadcast ; sans mail.
- Déclencheur : RG-REC-112.
- Conditions : —
- Effet / message d'erreur : alerte ; statut introuvable.
- Sources : spec `[DC] §3, §7, §11` (EX-REC-041, 067) ; EX-COO-017
- Questions liées : Q-110
- Implémentation : apps/api/src/modules/reception/inconnues.ts:signalerIntrouvable ; apps/api/src/modules/reception/alertes.ts (RG-REC-186) · ÉTAPE 7 (2026-11-05) : PARTIEL — alerte « Dossier introuvable » sans doublon à un signalement répété ; destinataire de Nîmes non tranché (Q-221, Q-110)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-11) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-06) ; apps/api/test/interactions/concurrence.int.test.ts (K-07)

### RG-X-009 — Réception sur un dossier sans IP → alerte Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : réception sur un dossier dont les IP ne sont pas saisies → alerte grave à la Coordination, qui prévient la Pré-Prod ; persiste tant que les IP manquent.
- Déclencheur : validation de réception sans IP.
- Conditions : IP non saisies.
- Effet / message d'erreur : alerte.
- Sources : spec `[PC] p.2`, `[DC] §11` (EX-COO-031, EX-REC-065)
- Questions liées : Q-111
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts (SANS_IP, RG-COO-071) ; apps/api/src/modules/reception/alertes.ts (RG-REC-184) · ÉTAPE 7 (2026-11-05) : FAIT — intitulé exigé, motif SANS_IP, alerte persistante tant que les IP manquent (Q-111)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-04)

### RG-X-010 — Affiche ou visuel arrivé après la préparation ou la libération
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : un visuel qui arrive après la préparation des trains (déroulant) ou un dossier fixe après la libération de la semaine déclenche une alerte (« Rajout après préparation », grave) vers Coordination/chefs d'équipe, avec mail à la liste de distribution ; pas de raccrochage automatique dans le train.
- Déclencheur : événement de réception/arrivée.
- Conditions : préparation/libération déjà faite.
- Effet / message d'erreur : alerte `APRES_LIBERATION`.
- Sources : spec `[README] §3` (Simuler 1, 2) ; ateliers EX-COO-503, EX-REC-505 ; EX-COO-044
- Questions liées : Q-131
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts (RG-COO-053 / 073 côté préparation ; bloc RG-X-011 côté réception) · ÉTAPE 7 (2026-11-05) : PARTIEL — alerte « Rajout après préparation » côté préparation (COO-P07) ET côté réception d'affiche (étape 7, déroulant) ; dossiers fixe / pliage / bus après libération : BLOQUÉ Q-265 ; mail non envoyé Q-375 ; fenêtre Q-266
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-18) ; apps/api/test/interactions/ecarts-connus.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — mail « Rajout après préparation » NON repris (D-19 : seuls colis, déblocage, correction Broadcast et correction d'intitulé sont mis en file) ; fenêtre Q-266 ; `ecarts-connus` retiré des tests (it.todo non exécuté)

### RG-X-011 — Affiche reçue après l'export des trains
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : après l'export du jeudi 14 h, une affiche arrivée est proposée puis confirmée ; les trains restent figés ; urgences du vendredi à la main ou renvoi.
- Déclencheur : réception après export.
- Conditions : trains exportés.
- Effet / message d'erreur : alerte.
- Sources : spec `[PP] §2` (EX-COO-044)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts (bloc « RX- », RG-X-011) · ÉTAPE 7 (2026-11-05) : FAIT — IMPLÉMENTÉ à l'étape 7 : alerte calculée (APRES_LIBERATION, Important, Coordination + chefs d'équipe) pour une affiche reçue après le 1er export des trains du dossier ; trains figés, aucun raccrochage automatique (HYPOTHÈSE Q-398) ; mail Q-375
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-18)

### RG-X-012 — Thème changé après réception → validation à refaire, feuille à refaire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : thème changé (fiche affiche) : tag « Feuille à refaire » et alerte ; validation à refaire si non-coord (reste validée si coord) ; thème changé après validation : alerte (Q55 source : proposition non tranchée).
- Déclencheur : « Changer de thème… ».
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[RA]` (EX-COO-016) ; `[DC] §10` (EX-REC-062)
- Questions liées : Q-143
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT — thème changé : feuille à refaire + alerte ; validation à refaire si l'auteur n'est pas coord / admin
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-12) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-03) ; apps/api/test/interactions/atomicite.int.test.ts (A-06)
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — rollback démontré (A-10), concurrence NON démontrée (écart consigné)

### RG-X-013 — Retrait d'un rattachement : recalculs
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : retrait (ou dernier dossier retiré) : recalcul du reçu et du statut de la ligne, des unités (PRET ↔ EN_ATTENTE), de la validation admin (annulée) ; l'affiche redevient orpheline et la réception A_IDENTIFIER.
- Déclencheur : RG-REC-137.
- Conditions : —
- Effet / message d'erreur : historique.
- Sources : spec `[DC] §8` ; ECR-REC-05
- Questions liées : Q-108
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT — retrait d'un lien : recalcul, affiche orpheline, palette « À identifier »
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-13) ; e2e/interactions.spec.ts

### RG-X-014 — Rattachement manuel vaut validation si Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : rattachement manuel (fiche, changement de thème) par `coord` = validation admin ; sinon « à confirmer ».
- Déclencheur : RG-REC-135, 136.
- Conditions : rôle.
- Effet / message d'erreur : voir RG-REC-111.
- Sources : spec `[DC] §7` ; maquette reception.js
- Questions liées : Q-107
- Implémentation : apps/api/src/modules/reception/affiches.ts:appliquerValidationSelonRole ; inconnues.ts:rattacherInconnue — FAIT : COO-P04 (2026-11-05) : rattachement manuel par coord = validation (étiquette rack) ; autre rôle = à confirmer
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/reception/affiches.int.test.ts

### RG-X-015 — Valider / Annuler la validation depuis la fiche affiche
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Valider » depuis la fiche affiche équivaut à la validation admin de RG-COO (même effets : n° d'affiche au suivi, retour `EstAssociee` à Broadcast, étiquette rack, sortie de « à traiter ») ; « Annuler la validation » les inverse.
- Déclencheur : boutons.
- Conditions : rôle coord/admin (RG-REC-003).
- Effet / message d'erreur : historique par/le.
- Sources : spec EX-COO-009, 014
- Questions liées : Q-162
- Implémentation : apps/api/src/modules/reception/affiches.ts:changerValidationAdmin (donneesValidation / donneesAnnulation) — FAIT : COO-P04 (2026-11-05) : mêmes écritures et effets que la Coordination · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/reception/affiches.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-15, R-20) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-11)

### RG-X-016 — Rattachement plusieurs-à-plusieurs : reçu compté une fois
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : un visuel commun à plusieurs dossiers : une ligne par dossier, surplus proposé à l'autre dossier, la Coordination confirme ; reçu compté une fois (dossiers multi-semaines).
- Déclencheur : rattachement.
- Conditions : —
- Effet / message d'erreur : « répartition à confirmer ».
- Sources : spec `[PP] §6`, `[RA]` (EX-COO-045, 039)
- Questions liées : Q-419 (la Q-123, quantité par défaut à la reprise des rattachements, était hors sujet)
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — apps/api/src/modules/reception/stock.ts:assertRepartitionPossible (reçu compté une fois). Reste : « Surplus proposé à l’autre dossier, répartition à confirmer » : non implémenté (Q-419). · ÉTAPE 7 (2026-11-05) : PARTIEL — reçu compté une fois, répartition ≤ reçu (testés) ; « Surplus proposé à l'autre dossier » non implémenté (Q-419)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-06) ; apps/api/test/interactions/ecarts-connus.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — « Surplus proposé à l'autre dossier, répartition à confirmer » NON implémenté ; la Q-123 citée auparavant (quantité par défaut à la reprise des rattachements) était HORS SUJET : nouvelle question Q-419 ; seul `it.todo` (non exécuté) en attente

### RG-X-017 — Écart de contrôle → recalcul et alerte
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : le contrôle corrigeant la quantité recalcule reçu, statut de ligne, unités ; alerte écart > 10 % ; la quantité n'est pas condition de validation.
- Déclencheur : RG-REC-059/069.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §5` ; EX-COO-011
- Questions liées : Q-133
- Implémentation : apps/api/src/modules/reception/controle.ts:validerControle ; apps/api/src/modules/reception/alertes.ts (RG-REC-183) · ÉTAPE 7 (2026-11-05) : FAIT — écart de contrôle > 10 % : ligne recalculée « Surplus » + alerte visible de la Coordination (base de l'écart : Q-133 OUVERTE, hypothèse)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-08) ; apps/api/test/interactions/atomicite.int.test.ts (A-03)

### RG-X-018 — Réception partielle : reste et alerte
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : partielle : validée pour ce qu'elle contient ; le reste garde l'alerte « Visuel reçu en partie » ; le complément est proposé puis confirmé à sa réception.
- Déclencheur : réception partielle.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec EX-COO-011 ; EX-REC-059
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/alertes.ts (RG-REC-182) ; apps/api/src/modules/reception/validation.ts (complément) · ÉTAPE 7 (2026-11-05) : PARTIEL — partielle validée pour ce qu'elle contient + alerte « Visuel reçu en partie » ; le COMPLÉMENT proposé puis confirmé = RG-X-061 (non implémenté)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-05)

### RG-X-019 — Dossier livré sur deux plateformes
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : une ligne attendue par plateforme ; les destinataires ne multiplient pas les lignes ; une affiche et sa ligne sont sur la même plateforme.
- Déclencheur : rattachement.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-024.
- Sources : spec EX-COO-045 ; EX-REC-015
- Questions liées : Q-139
- Implémentation : apps/api/src/modules/reception/bon-livraison.ts (RG-REC-024) · ÉTAPE 7 (2026-11-05) : PARTIEL — un BL ne livre qu'une plateforme (testé) ; suffixe « -W » posé par l'alimentation non reproduit (Q-139)
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-06)

### RG-X-020 — Réception avant IP : ligne provisoire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : avant les IP l'affiche se rattache à la ligne au visuel « provisoire » ; aux IP elle est fermée et les lignes par thème créées ; l'affiche est déplacée seule s'il n'y a qu'un thème possible, sinon la Coordination choisit ; aucun candidat : alerte.
- Déclencheur : arrivée des IP.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[RA]` (EX-COO-035)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:fermerProvisoires · ÉTAPE 7 (2026-11-05) : FAIT — IP saisies : provisoire fermée, affiches déplacées seules s'il n'y a qu'un thème, sinon alerte (Q-208)
- Tests : apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-01) ; apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-X-021 — Compteurs des menus Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique non (calcul de lecture)
- Énoncé : les événements de réception alimentent les badges : réceptions inconnues, Validation admin et Instruction OK (dossiers avec quelque chose à faire).
- Déclencheur : événement.
- Conditions : —
- Effet / message d'erreur : compteur.
- Sources : maquette `core.js:373-434`
- Questions liées : —
- Implémentation : apps/api/src/modules/reception/compteurs.ts ; apps/api/src/modules/coordination/dossiers.ts (filtre va=A_CONFIRMER) · ÉTAPE 7 (2026-11-05) : PARTIEL — badges « Réception des affiches », « Réceptions inconnues » et nombre de dossiers « Validation admin à confirmer » testés ; badge « Instruction OK » non testé comme compteur
- Tests : apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-08)

### RG-X-022 — Retour vers Broadcast : affiche reçue et associée
- Origine : CONSERVÉE
- Modules : REC → COO
- Atomicité : transaction unique non (batch)
- Énoncé : affiche « associée » envoyée à Broadcast seulement si liée ET validée admin ; retour de la cible à définir.
- Déclencheur : batch (RG-REC-199).
- Conditions : —
- Effet / message d'erreur : `EstAssociee`.
- Sources : legacy `BatchAlimReceptionBll.cs:89` · spec EX-TRA-039
- Questions liées : Q-151
- Implémentation : apps/api/src/modules/coordination/retour-broadcast.ts:populationRetour · ÉTAPE 7 (2026-11-05) : PARTIEL — population du retour (associée = liée ET validée) testée ; envoi réel / batch PEX non reproduits (Q-151, Q-005)
- Tests : apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-07) ; apps/api/test/interactions/ecarts-connus.int.test.ts

### RG-X-028 — Circuits indépendants : réception et prépa
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique non
- Énoncé : la réception et le contrôle n'attendent ni la prépa ni l'Instruction OK ; l'Instruction OK n'attend pas la validation admin ; fixe comme scro.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucune dépendance bloquante.
- Sources : spec `[PC] p.1` (EX-COO-001, 026) ; legacy EX-EXI-054
- Questions liées : —
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT — circuits indépendants : aucun blocage croisé (contrôle ∥ validation, Instruction OK sans validation)
- Tests : apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-05) ; apps/api/test/interactions/concurrence.int.test.ts (K-08) ; apps/api/test/coordination/effets-validation.int.test.ts (RG-COO-027)

### RG-X-030 — Rattachement d'une inconnue à plusieurs dossiers
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : répartition sur 1..n dossiers (plusieurs semaines) → motif « Répartition à confirmer » si visuel de plusieurs dossiers.
- Déclencheur : « Rattacher » multi-dossiers.
- Conditions : > 1 dossier.
- Effet / message d'erreur : doute.
- Sources : spec EX-COO-007 ; ECR-REC-04
- Questions liées : Q-124
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-10)

## 6. Traitements automatiques
| Traitement | Déclencheur / fréquence | Effet | Règles | Source |
|---|---|---|---|---|
| Calcul des statuts de ligne attendue et du statut Contrôle | À chaque événement de réception, contrôle, rattachement, retrait | Recalcul Attendue / Partielle / Complète / Surplus ; Rien reçu / À contrôler / Contrôlée | RG-REC-017, 018, 019, 176 | EX-REC-050, 051 |
| Pose des tags d'affiche | À chaque événement | À contrôler, Réception inconnue, Complément, Feuille à refaire | RG-REC-127, 128, 129 | EX-REC-054 |
| Détection des palettes en retard | Périodique (fréquence non spécifiée, Q-157) | Indicateur, teinte, alerte grave au double du délai | RG-REC-055, 189 | EX-REC-019, 070 |
| Alertes de réception | À l'événement ou périodique | Visuel non reçu / partiel, écart > 10 %, sans IP, inconnue, introuvable, feuille définitive, feuilles à refaire, palette en retard | RG-REC-182 à 190 | EX-REC-063 à 071 |
| Résumé à 7 h | Quotidien 7 h (forme à définir, Q-131) | Résumé des visuels non reçus | RG-REC-182 | EX-REC-063 |
| Purge des réceptions attendues | Planifié (fréquence non spécifiée) | Purge > 4 semaines sauf conservation à l'année ; une ligne au journal ; sans alerte | RG-REC-180, 181 | EX-REC-075 |
| Recalcul des unités EN_ATTENTE ↔ PRET | À chaque événement de réception | Unités prêtes à produire | RG-X-003 | EX-REC-014 |
| Proposition de rattachement / validation admin | À « Valider la réception » | Proposé (cas sûr) ou doute | RG-X-001, 002 | EX-COO-004 |
| Impression de l'étiquette rack à la validation admin | Passage à « validée » | Impression plateforme | RG-REC-089 | legacy RG-REC-028 |
| Batch d'export des réceptions vers PEX/Broadcast | Planification inconnue | `CIRCE_PEX_RECEPTION`, `affiche.envoye`, SP INTERFACE | RG-REC-199, 200 ; RG-X-022 | legacy RG-REC-110 |
| Alimentation des lignes attendues | Planification inconnue (Q-005) | Propriété Coordination | RG-REC-202 | legacy RG-REC-082 |
| Mise à jour de `date_dernier_depart` | Rattachement / retrait | Date recalculée | RG-REC-143 | legacy RG-REC-032 |
| Historique et journal | Chaque action | Entrées auteur/date | RG-REC-004, 005, 006, 007 | EX-TRA-035 |

## 7. Messages (confirmation / erreur)
Messages exacts quand connus (maquette / legacy) ; « (proposé) » = libellé à valider. HTTP : 400 validation, 401, 403, 404, 409, 422 règle métier.

| Code | Message | Règle |
|---|---|---|
| REC_PANIER_VIDE (422) | Le panier est vide. | RG-REC-037 |
| REC_AUCUNE_LIGNE_COCHEE (422) | Cochez dans le panier les lignes de ce BL. | RG-REC-037 |
| REC_BL_DEUX_PLATEFORMES (422) | Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. | RG-REC-024, 037 |
| REC_PHOTO_BL_MANQUANTE (422) | Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche. | RG-REC-026, 037 |
| REC_BL_CHAMPS_OBLIGATOIRES (422) | N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. | RG-REC-033, 037 |
| REC_ALLEE_RAYON_OBLIGATOIRES (422) | Allée et rayon sont obligatoires pour chaque affiche. | RG-REC-061 |
| REC_CONTROLEUR_OBLIGATOIRE (422) | Le nom du contrôleur est obligatoire (REC-12). | RG-REC-067 |
| REC_QTE_INCONNUE_OBLIGATOIRE (422) | Indiquez la quantité comptée. | RG-REC-096 |
| REC_ALLEE_RAYON_INCONNUE_OBLIGATOIRES (422) | Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire. | RG-REC-097 |
| REC_RATTACHER_SANS_DOSSIER (422) | Choisissez au moins un dossier et une quantité. | RG-REC-107 |
| REC_REPARTITION_DEPASSE (422) | La répartition (x) dépasse la quantité reçue (y). | RG-REC-108 |
| REC_QTE_DOSSIER_OBLIGATOIRE (422) | Indiquez la quantité pour ce dossier. | RG-REC-136 |
| REC_BL_DOUBLON (422, confirmable) | Ce n° de BL a déjà été réceptionné (réception R…). Continuer ? (proposé) | RG-REC-036 |
| REC_DOSSIER_FORMAT (400) | Attention, votre format de saise de dossier est inccorect. Exemple format attendue "100000+120000" (texte legacy, fautes d'origine) | RG-REC-013 |
| REC_SEMAINE_FORMAT (400) | Attention, votre format semaine est inccorect. Exemple format attendue "S41/S42+S41/S42" (legacy) | RG-REC-147 |
| REC_DOSSIER_SEMAINE_NOMBRE (400) | Attention, le nombre de dossier ne correspond pas aux semaines (legacy) | RG-REC-147 |
| REC_NB_SEMAINE (400) | Attention, le nombre de semaine ne correspond pas aux semaines (legacy) | RG-REC-147 |
| REC_QTE_NEGATIVE (400) | La quantité doit être supérieure ou égale à 0. (proposé) | RG-REC-023, 057 |
| REC_REBUT_SUPERIEUR_STOCK (422) | Le rebut dépasse le stock disponible. (proposé) | RG-REC-064 |
| REC_PHOTO_INVALIDE (400) | Format ou taille de photo non accepté. (proposé) | RG-REC-027 |
| REC_REFERENTIEL_INCONNU (422) | Valeur absente du référentiel : à ajouter par l'administrateur. (proposé) | RG-REC-035 |
| REC_ACCES_REFUSE (403) | Vous n'avez pas le droit d'effectuer cette action. (proposé) | RG-REC-002 |
| REC_VALIDATION_RESERVEE (403) | Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation admin et Instruction OK, sans attendre la préparation. | RG-REC-003 |
| REC_PERIMETRE_INTERDIT (403) | Cette plateforme n'est pas dans votre périmètre. (proposé) | RG-REC-001 |
| REC_CONFLIT_VERSION (409) | Cet élément a été modifié par un autre utilisateur : rechargez la page. (proposé) | RG-REC-009 |
| REC_IDEMPOTENCE_CONFLIT (409) | Même clé d'idempotence avec une requête différente. (proposé) | RG-REC-008 |
| REC_CONTROLE_DEJA_FAIT (409) | Ce contrôle est déjà validé. (proposé) | RG-REC-070 |
| REC_CONTROLE_INTERDIT_A_IDENTIFIER (409) | Cette réception est à identifier : rattachez d'abord un dossier. (proposé) | RG-REC-071 |
| REC_FEUILLE_DEFINITIVE_IMPOSSIBLE (409) | Pas de feuille définitive sans dossier. (proposé) | RG-REC-084 |
| REC_AFFICHE_FUSIONNEE_LECTURE_SEULE (409) | Affiche fusionnée (héritée) : lecture seule. (proposé) | RG-REC-169 |
| REC_ERREUR_INTERNE (500) | Une erreur est survenue, merci de contacter le support (texte legacy repris) | RG-REC-046 |
| MSG_AUCUNE_RECEPTION_ATTENDUE | Aucune réception attendue à proposer sur ce site. | RG-REC-014, 029 |
| MSG_TABLEAU_VIDE | Aucune ligne pour ces filtres. | RG-REC-014, 121 |
| MSG_SAS_VIDE | Aucune palette à contrôler : le sas est vide. | RG-REC-053 |
| MSG_DEJA_AU_PANIER | Ce visuel est déjà au panier. | RG-REC-021 |
| MSG_PANIER_AJOUT | n ligne(s) ajoutée(s) au panier. | RG-REC-021 |
| MSG_VISUEL_RECONNU | Visuel reconnu : 1 ligne au panier ; la photo de l'affiche est jointe à la réception. | RG-REC-031 |
| MSG_BL_PRE_REMPLI | n ligne(s) du BL au panier, cochées pour ce BL… ; bon de livraison pré-rempli : vérifiez, puis validez la réception. | RG-REC-028 |
| MSG_RECEPTION_VALIDEE | Réception R… : n ligne(s), « affiche reçue » = oui dès l'arrivée ; n unité(s) prête(s) à produire. La palette passe à l'étape 2 (contrôle). Validation admin : n rattachement(s) proposé(s) à confirmer, n avec un doute… (Coordination). | RG-REC-038 |
| MSG_INCONNUE_CREEE | Réception inconnue R… : affiche n rangée en X-n. La Coordination est prévenue (Pilotage › Alertes). | RG-REC-099 |
| MSG_RATTACHEE | Affiche n° rattachée. n unité(s) passent « Prêt ». La palette R… passe dans le sas de Réception des affiches : la réception valide le contrôle et imprime la feuille définitive. | RG-REC-109 |
| MSG_SIGNALEMENT | Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… | RG-REC-112 |
| MSG_THEME_CORRIGE | Thème corrigé : feuille de stock à refaire. | RG-REC-135 |
| MSG_PALETTES_RETARD | n palette(s) dans le sas depuis plus de 24 h — À contrôler en premier : elles sont en tête de liste. | RG-REC-055 |
| MSG_COMPTAGE_MORCEAU | Comptage par morceau (4 morceaux par affiche) | RG-REC-060 |
| MSG_PURGE | n réception(s) attendue(s) purgée(s). | RG-REC-181 |
| MSG_IMPRESSION | n feuille(s) (…) [et n étiquette(s) rack] envoyées à l'imprimante. | RG-REC-085 |
| MSG_CONFIRMATION_REBUS_LEGACY | Confirmez-vous le vidage du rebus ? (legacy) | RG-REC-158 |
| MSG_ALERTE_QTE_BC_LEGACY | La quantité reçue ne correspondent pas à la quantité BC (legacy, non reprise) | RG-REC-175 |
| MSG_FUSION_OK_LEGACY | La fusion a été effectuée avec succes ! (legacy, non reprise) | RG-REC-167 |
