# Analyse du modèle de données

Synthèse de l'étape 1b : CONSTAT uniquement, aucun schéma Prisma n'est écrit ici (il est produit à l'étape 3, après tranchage des questions Q-3xx). Sources : `docs/_travail/bdd.md` (analyse du schéma réel), `docs/_travail/extraits/CIRCE_SQL_utf8.sql` (vérifications de colonnes), `legacy-*.md`, `maquettes-reception-coordination.md` §4, `maquettes-autres-modules.md` §C, `specs-transverse.md` §G-H. Les questions Q-001 à Q-010 sont dans `docs/QUESTIONS_OUVERTES.md` ; Q-300 à Q-335 sont proposées dans `docs/_travail/synth/arch-questions.md` (à consolider). Les ID `RG-AT-xx`, `RG-VA-xx`, `RG-IOK-xx`, `Q60` cités par `bdd.md` sont ceux du document source cible `receptions_attendues_doublons_tables_regles.html`, pas des ID projet.

## 1. Schéma réel — constat

### 1.1 Fichiers source
| Source | Rôle | Remarque |
|---|---|---|
| `docs-sources/CIRCE SQL.sql` (UTF-16 LE, script SSMS du 03/11/2026 10:34) | Schéma RÉEL (prod ou copie prod) | Lu via la copie UTF-8 `docs/_travail/extraits/CIRCE_SQL_utf8.sql` |
| `circe-develop/BDD/DATABASE/DATABASE/dbo/{Tables,Stored Procedures,Views,User Defined Types}` + `DATABASE.sqlproj` | Projet SSDT du dépôt | 117 tables, 127 procédures, 1 vue, 46 UDT |
| `circe-develop/BDD/DATA/*.sql` | Données initiales | 6 scripts dont 2 référencés par `Script.PostDeployment.sql` (destinataires PEX, `MajData`) ; AUCUN jeu de données pour `tr_statut`, `tr_statut_repart`, `tr_type_entite`, `histo_action_applicative`, `tr_profil` |
| `circe-develop/docs/REVIEW_Database_proc.md` | Revue interne du 25/09/2026 (APPFR-4286) | Source des bugs de procédures cités |
| `CIRCE.edmx` (DAL) | Mapping EF | 65 entity sets sur 116 tables |
| `BDD/MPD/logistique_ptf.mpd` | Modèle PowerDesigner | Illisible (binaire) : non exploité |
| `docs-sources/2. CIRCE CIBLE + MAQUETTE/{1. RECEPTION,2. COORDINATION}/*.html`, maquette `data.js` | Cible | Utilisés pour le §2 et §3 |

Correction des chiffres annoncés : le script réel contient 116 tables permanentes (`CREATE TABLE [dbo]`, recompté : 116), pas 138 ; les 138 occurrences de `CREATE TABLE` comprennent 22 tables de travail (`#temp`) créées dans des procédures. Le script contient 126 procédures, 1 fonction (`Fn_GetPrepaAffiche`), 1 vue (`v_support_scrolling`), 46 types (36 alias + 10 types table), 0 trigger, aucun index non clusterisé, un seul `UNIQUE` (`UQ_tr_atelier_droit_prepa`), aucun CHECK, 5 DEFAULT (`bdd.md` §0). Le script a donc été exporté sans les index : voir Q-304.

### 1.2 Inventaire des 116 tables par domaine
| Domaine | Nb | Tables |
|---|---|---|
| A. Réception (affiches, livraisons, stock, production) | 13 | `affiche`, `livraison`, `mouvement`, `photo`, `asso_livraison_affiche`, `asso_livraison_photo`, `fusion_affiche`, `tf_dossier_semaine_depart`, `tf_prepa_affiche` (réceptions attendues), `tf_prepa_Broadcast` (copie de l'état des réservations), `Activite`, `Equipe`, `Machine` |
| B. Coordination (instructions, répartition, trains, préparations) | 15 | `instruction_train`, `instruction_detail`, `instruction_visuels`, `tf_face_train`, `tf_repart_calcul`, `tf_train_export`, `tf_anomalies`, `trav_groupePreparation`, `trav_preparation`, `trav_preparationDetail`, `trav_instruction`, `trav_instructionDetail`, `trav_theme`, `trav_trainAffiche`, `trav_adresseLivraisonAfficheur` |
| C. Colisage / expédition | 8 | `tf_UM`, `tf_UM_colis`, `tf_colis`, `tf_colis_ext`, `log_colis_transporteur`, `PreparationExterne`, `ColisPreparationExterne`, `RessourcePreparationExterne` |
| D. Référentiels | 43 | `tr_categorie_support`, `Surface`, `TypePreparation`, `tr_type_preparation`, `tr_type_dossier`, `tr_type_destination`, `tr_type_adresse`, `tr_type_anomalie`, `tr_typ_aff_amt`, `tr_statut`, `tr_statut_repart`, `tr_statut_colis`, `tr_plateforme`, `tr_atelier`, `tr_atelier_droit_prepa`, `tr_atelier_imprimante`, `tr_atelier_support`, `tr_poste`, `tr_rouleur`, `tr_societe`, `tr_activite`, `tr_jour_depart`, `tr_instruction_plus`, `tr_lien_cote_cote`, `TR_tri_cote_cote`, `tr_parametre_alternance`, `tr_train_convention_a_trier`, `tr_destinataire`, `tr_dest_adresse`, `tr_destination`, `tr_adresseMail_plateforme`, `tr_commune`, `tr_communes_calber`, `tr_agence_geodis`, `tr_format_colis`, `tr_imprimeur`, `tr_transporteur`, `tr_transporteur_atelier`, `tr_trans_tarif`, `tr_ate_dest_trans`, `tr_transposteur_reception`, `Transaco_Surface_Format`, `transcoCategSupport` |
| E. Utilisateurs / droits | 4 | `tr_utilisateur`, `tr_utilisateur_data`, `tr_utilisateur_menu`, `tr_profil` |
| F. Historique / audit / logs applicatifs | 8 | `histo_historique_entite`, `histo_action_applicative`, `tr_type_entite`, `histo_preparation`, `histo_trainAffiche`, `th_repart_annule`, `tt_log`, `tt_batch` |
| G. Journaux d'interface AMT (anciens) | 12 | `th_amt_log_{destination,instruc_det,instruction,repart,statut_repart,train}`, `tra_amt_log_{instruc_det,instruction,statut_repart,train}`, `tw_amt_log_{destination,repart}` |
| H. Archives / sauvegardes | 6 | `ARCH_tf_colis`, `ARCH_tf_face_train`, `ARCH_tf_repart_calcul`, `ARCH_Tf_UM`, `ARCH_tf_UM_colis`, `tf_repart_calcul_svg` |
| I. Temporaires / technique | 7 | `tmp_instruction_train`, `tmp_tf_colis`, `tmp_tr_dest_adresse`, `tmp_tr_destinataire`, `tmp_tr_transporteur`, `tmp_tr_transporteur_atelier`, `Parametre_Package` |
| Total | 116 | |

Vue : `v_support_scrolling` = `tr_categorie_support` filtrée sur `sup_id in (26,1026,1027)` (supports déroulants, ID en dur). Le détail des domaines C, D, G, H, I n'a pas été analysé colonne par colonne (seule la liste est établie) : Q-324.

### 1.3 Tables clés Réception : colonnes, clés et cardinalités
Convention : FK = contrainte réelle du script ; « sans FK » = lien logique non protégé.

| Table | Clés et colonnes notables | Cardinalités |
|---|---|---|
| `affiche` | PK `affiche_id` int identity. FK `plt_id`→`tr_plateforme` (tinyint NOT NULL), `sup_id`→`tr_categorie_support` (smallint NOT NULL), `photo_id`→`photo` (NULL). Identité métier : `cont_num` varchar(50), `cont_annonc`, `theme`, `repiquage`, `quantite` NOT NULL, `conservation` int NOT NULL, `date_entree` NOT NULL, `date_dernier_depart`, `date_derniere_sortie`, `allee`, `rayon`, `semaines` varchar(200) (liste de semaines en texte), `nombre_semaine`. AUCUNE colonne statut : drapeaux bit NULL `rebus` (+`date_rebus`), `zone_Picking`, `a_conserver`, `est_fusionne`, `validationAdmin`, `envoye` | 1 affiche → n `mouvement` ; n `asso_livraison_affiche` (2 FK : affiche reçue, affiche initiale) ; 0..1 `tf_prepa_affiche` via `affiche_livraison_Id` (une affiche au plus par ligne attendue) ; n `Activite` (2 FK) ; n `tf_dossier_semaine_depart` ; n `fusion_affiche` (2 FK : chapeau / fille) |
| `livraison` (BL) | `DateLivraison`, `Expediteur`, `Imprimeur`, `Reference`, `Nbre_colis`, `Ref_dossier`, `Ref_DA`, `Decharge_par`, `Commentaire` : tout en texte libre ; aucune FK sortante, aucun statut, aucune plateforme | n–n avec `affiche` par `asso_livraison_affiche` (`Id_livraison`, `Id_affiche_livraison`, `id_affiche_initial_livraison`, `NumeroLivraison`) ; n–n avec `photo` par `asso_livraison_photo` (`intitule`) |
| `photo` | Image en base (`varbinary(max)`) | 1 photo → n affiches (`affiche.photo_id`) |
| `mouvement` | `affiche_id` FK, `quantite`, `recepisse`, `expediteur`, `comptee`, `livraison_id` FK, `IdActivite` FK, `id_affiche_initial` FK ; append-only dans le périmètre lu | 1 affiche → n mouvements |
| `tf_prepa_affiche` (réceptions attendues) | PK `Id` int identity. `plt_id` int, `sup_id` int, `cont_num` int, `Format`, `Description`, `rpc_annonceur`, `rpc_num_aff_amt`, `rpc_theme`, `repiquage`, `Qte_Theorique`, `sem_num`, `sem_annee`, `FromBroadcast` bit, `ARecevoir` bit, `Statut` varchar(50) libre, `IdDAChapeau`, `ate_id` smallint, `affiche_livraison_Id`, `affiche_livraison_initial_Id`, `dateCreated`, `dateModified`. Seules FK : `affiche_livraison_Id` et `affiche_livraison_initial_Id` → `affiche`. `plt_id`, `sup_id`, `ate_id`, `cont_num` SANS FK. Aucune clé métier unique | Alimentée par `p_Alimentation_tf_prepa_affiche` (sources `tf_repart_calcul`, `tf_face_train`, `tf_prepa_Broadcast`) sur la fenêtre semaine courante → +8 ; rapprochement par textes |
| `tf_prepa_Broadcast` | PK `id` numeric(9) identity ; copie brute de l'état des réservations : `IdDossierDeVenteChapeau`, `IdDAChapeau`, `Annonceur`, `Surface`, `StatutPreparation` varchar (valeur `'Envoyé'` exclue de l'alimentation) … | Remplacée par dossier (suppression puis recréation) : RG-INT-011 |
| `fusion_affiche` | `id_affiche_chapeau`, `id_affiche` (2 FK), `qui_creation` varchar(max) | 1 chapeau → n filles |
| `tf_dossier_semaine_depart` | `IdAffiche` FK, `Dossier`, `Semaine`, `Annee` | 1 affiche → n semaines de départ (doublonne `affiche.semaines`) |
| `Activite` / `Equipe` / `Machine` | `Activite` : `IdEquipe`, `IdMachine`, `IdAffiche`, `id_affiche_initial` (4 FK), `Quantite`, `Rebus`, `DateProduction` | Production par plateforme |

### 1.4 Tables clés Coordination
| Table | Rôle | Clés / cardinalités | Statut |
|---|---|---|---|
| `instruction_train` | Instruction (dossier × semaine contractuelle) issue de Broadcast | PK `instr_code` varchar(18) (VÉRIFIÉ dans le script réel : clé primaire sur `instr_code` seul). FK `ate_id`, `tip_ins_code`→`tr_instruction_plus`, `tsr_repart_code`→`tr_statut_repart`, `rpc_statut`→`tr_statut`. Champs : `cont_num`, `cont_sembas`, `cont_anbas`, `instr_entretien`, `Conservation`, `CoteCote`, `instr_commentaire`, `instr_CommentExtPlay`, `instr_user`, `instr_dat_cre/maj` | `rpc_statut` (0 à 10) |
| `instruction_detail` | Lignes de visuel d'une instruction (n par `instr_code`) | PK `insd_id`. FK seulement `tpr_id` ; `instr_code` SANS FK | — |
| `instruction_visuels` | Visuels d'une instruction avec pourcentage (`insv_pourcentage`, `_ori`, `insv_theme`, `insv_theme_ori`) | PK `insv_id`. FK `instr_code`, `sup_id`, `tpr_id`, `rpc_statut` | `rpc_statut` |
| `tf_face_train` | Face d'un train (1 face = 1 affiche à poser) | PK `ft_id`, 80 colonnes. FK `dest_id` (3 FK redondantes sur la même colonne), `rpc_statut`, `ate_id`, `sup_id`, `rouleur_id`, `colis_id`, `IdJourDepart`. `instr_code` SANS FK | `rpc_statut` ; `ft_type` varchar(15) (`'entretien'`…) ; `version` tinyint |
| `tf_repart_calcul` | Répartition calculée (quantité par destinataire × atelier × semaine) | PK `rpc_id` numeric(9). FK `sup_id`, `ate_id`, `soc_id`, `tpr_id`, `act_id`, `UM_id`, `dest_id`, `rpc_statut`, (`des_id`,`des_type`,`des_type_adr`)→`tr_destination` | `rpc_statut` ; `rpc_retire` char(1) ; `rpc_san_rep` char(1) ; `rpc_tms` timestamp |
| `tf_UM` | Unité de manutention | PK `UM_id`. FK `ate_id`, `sup_id`, `rpc_statut`, `tpr_id`. 1 UM → n `tf_repart_calcul`, n `tf_UM_colis` | `rpc_statut` |
| `tf_colis` / `tf_UM_colis` / `tf_colis_ext` | Colis ; n–n UM ↔ colis ; suivi transporteur par `refUniExp` bigint (PAS de FK vers `tf_colis`, lien par `tf_colis.ref_uni_exp`) | FK `ate_id`, `adr_id`, `dest_id`, `fc_col_id`, `rpc_statut`, (`tsp_id`,`tarif_code`) | `rpc_statut` ; `Mailcolis_envoye` bit |
| `trav_*` | Tables de travail d'intégration Broadcast (`insertTrav*` / `purgeTrav*`) | Sans FK ni PK (sauf `trav_groupePreparation`, `trav_preparationDetail`, `trav_theme`) | `rpc_statut` ; `IdReferentielStatutPreparation` (133 = « actif » en dur dans `p_integ_preparation`) |

### 1.5 Contraintes et index (constat)
- Réel : FK présentes pour la plupart des liens `affiche`/`mouvement`/`rpc_statut` ; absentes pour `tf_prepa_affiche.{plt_id,sup_id,ate_id,cont_num}`, `tf_face_train.instr_code`, `instruction_detail.instr_code`, `tf_colis_ext` ↔ `tf_colis`, `livraison` ↔ plateforme. Aucune unicité métier (seul `UQ_tr_atelier_droit_prepa`). Aucun CHECK. 5 DEFAULT. PK absente sur `Parametre_Package` et sur la plupart des `trav_*`, `histo_*`. Index : 0 non clusterisé dans le script réel, 19 dans le dépôt (à confirmer en prod : Q-304).
- Concurrence : aucune colonne de verrou optimiste ; `rpc_tms timestamp` seulement sur `tf_repart_calcul` ; `tf_face_train.version` est une version de train (RG-COO-067), pas un verrou.

### 1.6 Colonnes de statut et valeurs
**`rpc_statut` tinyint → `tr_statut(rpc_statut, statut_nom)`**, FK depuis `instruction_train`, `instruction_visuels`, `tf_face_train`, `tf_repart_calcul`, `tf_UM`, `tf_colis` (pas depuis `trav_*`, `histo_*`, `ARCH_*`). Le CONTENU de `tr_statut` n'est PAS dans le script (aucun INSERT dans `BDD/DATA`) : valeurs déduites de l'enum C# `StatutPreparation` (`Enums.cs:52-77`, `CommunBll.cs:46-59`) : Q-004.

| Code | Libellé | Observé dans les procédures |
|---|---|---|
| 0 | A traiter | `p_u_statut_preparation` (retour arrière autorisé) ; reset à 0 des intégrations |
| 1 | En cours | `p_batch_auto_instruction_ok` (candidats) ; UM créée ; remise à 1 si statut 3 |
| 2 | Instruction OK | `p_batch_auto_instruction_ok` ; déclenche `p_u_associe_train` |
| 3 | Erreur | repassé à 1 dans `p_integ_*` |
| 4 | Annulé | exclu de `p_Alimentation_tf_prepa_affiche` (`rpc_statut <> 4`) ; déblocage |
| 5 | A imprimer | protégé (`<> 5`) dans `p_u_statut_preparation` ; export des trains |
| 6 | Préparé | UM préparée ; bloque le déblocage (statut ≥ 6) |
| 7 | A expédier | colis ; `p_batch_fin_journee_colis` : colis 7 → UM/trains 8 |
| 8 | Terminé | idem ; `p_integ_preparation` met aussi 8 |
| 9 | Export prépa | `p_u_exportTheme` |
| 10 | Au roulage | `p_u_exportTheme` (REVIEW §2.18) |

Aucune table de transitions : elles sont dispersées dans les procédures et le C# (`legacy-coordination.md` §5bis, `legacy-repartition-production.md` §7).

| Autre colonne | Table | Valeurs connues |
|---|---|---|
| `tsr_repart_code` / `tr_statut_repart` | `instruction_train` | Libellés absents du script (alimentés par `p_integ_ptf_statut_repart`) ; 0 = initial |
| `tr_statut_colis(Id, Libelle, Ordre)` | aucune FK entrante | Orpheline côté C#, mais jointe par libellé dans `p_updateColisTransporteur` pour choisir l'état de plus grand `Ordre` (RG-INT-032) |
| `Statut` varchar(50) | `tf_prepa_affiche` | Non contraint, non documenté |
| `StatutPreparation` / `LibelleStatutPreparation` | `tf_prepa_Broadcast`, `PreparationExterne` | Textes libres ; `'Envoyé'` exclu |
| `rebus`, `zone_Picking`, `a_conserver`, `est_fusionne`, `validationAdmin`, `envoye` | `affiche` | bit NULL ; NULL traité comme 0 par le C#, pas par toutes les procédures (REVIEW §2.1) |
| `estConnu`, `Mailcolis_envoye` | `tf_colis_ext`, `tf_colis` | bit |
| `ft_type` | `tf_face_train` | `'entretien'` (autres valeurs non extraites) |
| `ate_type` | `tr_atelier` | tinyint : 1 Fixe, 2 Scroll (`AtelierType`) ; ateliers 1 à 8 = Wissous/Nîmes × 2M2 fixe / pliage 12M2 / 2M2 déroulant / 8M2 déroulant |
| `tip_ins_code` / `tr_instruction_plus` | `instruction_train` | 0 Standard, 1 début, 2 fin, 3 fin-1, 4 milieu de train |
| `TypeDePreparation` (C#) | — | 2M2FIXE, PLIAGE, DEROULANT, AUTRES, BUS : libellés applicatifs, pas en base |

Statuts de la CIBLE (non persistés aujourd'hui) : ligne attendue Attendue / Partielle / À contrôler / Complète / Surplus / Contrôlée ; affiche À identifier / Rattachée à contrôler / Introuvable (alerte Pré-Prod) / Orpheline / Complément / Feuille à refaire / Contrôlée / Rattachée feuille définitive (`process_reception_statuts_actions.html` via `bdd.md` §4.3) ; statuts de la maquette `M.STATUTS` (15 codes : A_TRAITER, PREPA_RECUE, VALIDE, ANNULE, EN_ATTENTE, PRET, EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE, ORPHELINE, IDENTIFIEE, COLIS_OUVERT, COLIS_CLOS…) : `maquettes-reception-coordination.md` §4. Correspondance cible ↔ `rpc_statut` non fournie (« Paramétrage › Statuts », `specs-transverse.md`) : Q-302.

### 1.7 Historique et audit
| Table | Contenu | Remarque |
|---|---|---|
| `histo_historique_entite` | Journal générique : `IdActionApplicative` (FK), `IdTypeEntite` (FK), `IdEntite`, `AncienneValeur`, `NouvelleValeur`, `Complement`, `JsonData`, `QuiAction`, `DateAction` | Alimenté par `HistorisationBll` ; seul vrai journal d'audit |
| `histo_action_applicative` | Codes C# 1 à 16 (CreationAffiche, ModificationDossier/Semaine/Annonceur/Theme/Format, ModificationValidationAdmin, ModificationAfficherAConserver, AfficheMiseEnRebus, AfficheAssocier/Dissocier, ViderRebus, ChangementStatutInstruction, ModificationInstructionPlus, ExporterTrains, DebloquerPreparation) | Sans données dans `BDD/DATA` |
| `tr_type_entite` | 1 Affiche, 2 Instruction, 3 Trains, 4 IdDossier (enum C#) | Sans données ; la FK de `histo_historique_entite` échoue sur base neuve (REVIEW §3.3) |
| `histo_preparation`, `histo_trainAffiche` | Archivage des `trav_*` avant purge | Sans PK ni FK |
| `th_repart_annule` | Répartitions annulées/débloquées | Utilisé par AdminSuiviDeblocage |
| `tt_log`, `tt_batch` | Log technique des procédures ; état des batchs | `tt_log` mappé EF |
| `th_amt_log_*`, `tra_amt_log_*`, `tw_amt_log_*` (12) | Journaux de l'ancienne interface AMT | `tra_amt_log_instruction(_det)` encore alimentées par `BatchAlimRepository.cs:318,332` |
| `ARCH_*` (5) + `tf_repart_calcul_svg` | Archives 3 ans (`p_archivage_*`) | `tf_repart_calcul` non archivée (REVIEW §1.2) ; PK `ARCH_tf_UM` / `ARCH_Tf_UM` différant par la casse |

Absence d'historique de statut pour la coordination : `rpc_statut` est écrasé ; seules `ft_user_maj`, `UM_user`, `instr_user`, `*_dat_maj` existent. Les batchs n'écrivent aucun historique (RG-INT-046). Le changement de statut d'instruction n'est historisé que vers 2 ou 4 ; la dissociation d'affiche réutilise l'action `AfficheAssocier` à valeurs inversées.

### 1.8 Tables de référence
Référentiels vivants : `tr_plateforme` (`id_site_ccf` = lien Broadcast), `tr_atelier`, `tr_atelier_droit_prepa` (UNIQUE ; inclusion/exclusion par type de prépa et surface), `tr_categorie_support` (= format/support ; `sup_bandeaux`, `sup_qte_UM`, `reception` bit), `Surface`, `tr_type_preparation` ET `TypePreparation` (deux tables, la seconde avec FK vers la première + `IdCategoriePreparation` DEFAULT 1), `tr_instruction_plus`, `tr_jour_depart`, `tr_parametre_alternance`, `tr_format_colis` (1 Carton, 2 Palette, 3 Vrac, 4 Sachet, 5 À définir), `tr_type_adresse` (STANDARD/URGENTE/AUTRE), `tr_destinataire` / `tr_destination` / `tr_dest_adresse`, `tr_transporteur*`, `tr_agence_geodis`, `tr_imprimeur`, `tr_transposteur_reception`, `Transaco_Surface_Format`, `transcoCategSupport`, `tr_profil` + `tr_utilisateur*`. Données de ces référentiels : NON fournies dans le dépôt (sauf destinataires PEX et `MajData`) : Q-004, Q-319. Contenu de `tr_profil` : inconnu (seuls 1 = atelier, 2 = plateforme, 3 = administrateur sont décrits en commentaire d'une procédure morte, `legacy-admin.md` RG-ADM-010) : Q-003, Q-320.

### 1.9 Anomalies et écarts du schéma réel
| # | Anomalie | Gravité | Question |
|---|---|---|---|
| A1 | `tf_prepa_affiche` : aucune clé métier unique, `MERGE` inopérant, jointure sans `ate_id` : doublons et quantités de bandeau multipliées | Haute | Q-305 |
| A2 | `affiche` : drapeaux bit NULL mélangés avec 0/1 ; `cont_num` varchar(50) alors que `tf_prepa_affiche.cont_num` est int (conversions implicites) ; `plt_id` renvoyé = `sup_id` dans une liste (REVIEW §2.5) ; affiches détruites toujours `a_conserver` | Haute | Q-312, Q-313 |
| A3 | Semaines : `affiche.semaines` texte vs `tf_dossier_semaine_depart` ; `DATEPART(wk)` mélangé à `ISO_WEEK` ; année de 52 semaines en dur ; `@@DATEFIRST` non neutralisé | Haute | Q-312, Q-314 |
| A4 | `instruction_train` : PK `instr_code` seul (vérifié), alors que le commentaire de `p_batch_auto_instruction_ok` parle de plusieurs lignes par `instr_code` à cause de `ate_id` | Moyenne | Q-303 |
| A5 | `tf_face_train.dest_id` : 3 FK redondantes (copier-coller, dont une mal nommée `FK_TF_UM_REFERENCE…`) ; `instr_code` sans FK | Faible | Q-317 |
| A6 | Tables sans contenu dans le dépôt : `tr_statut`, `tr_statut_repart`, `tr_type_entite`, `histo_action_applicative`, `tr_profil` | Haute (seed) | Q-004, Q-319 |
| A7 | Troncatures : `rpc_user` varchar(30) → varchar(20) (archive), `pers_nom` 50 vs annonceur 250, `tf_colis_ext` 50 vs log 1000 (REVIEW §2.11, 2.16) | Moyenne | Q-312 |
| A8 | Codes en dur : `sup_id in (26,1026,1027)`, `ate_id in (5,6,7,8,11,12)`, 133, plateformes par nom, `'Sans affiche'`, `VPS_75 101 0004` | Moyenne | Q-315 |
| A9 | `tf_evenement` : fichier vide dans le dépôt (référencé `DATABASE.sqlproj:201`), absente du SQL réel ; usage uniquement dans un trigger `t_iud_UM` commenté | Faible | Q-309 |
| A10 | Procédures : 127 (dépôt) vs 126 (réel) ; fichier en trop non identifié ; `p_batch_auto_instruction_ok` présente dans le réel et le `.sqlproj:380` (la revue la disait non référencée : périmée) | Info | Q-006 |
| A11 | `tr_utilisateur.loginWindows` (identité AD) comme clé de `tr_utilisateur_menu` et `tr_utilisateur_data` | Haute | Q-001, Q-320 |
| A12 | Tables sans usage C# (hors SSIS binaire non lu) : `tr_statut_colis` (sauf SP), `tr_societe`, `tr_atelier_support`, `tr_commune`, `tf_anomalies`, `tr_type_anomalie`, `tr_typ_aff_amt`, `tr_train_convention_a_trier`, `tr_activite`, `tf_repart_calcul_svg`, `Transaco_Surface_Format` et `transcoCategSupport` (mappées EF, usage non recoupé), `th_amt_log_*`, `tw_amt_log_*`, `tra_amt_log_statut_repart`, `tra_amt_log_train` ; `Fn_GetPrepaAffiche` sans référence `.cs` | À valider DSI | Q-309 |
| A13 | `photo.image_file` varbinary(max) : volume inconnu | À décider | Q-311 |
| A14 | Procédures avec défauts connus : `p_archivage_allTables` (paramètre inexistant), `p_s_atelierScro` (`ate_id in (5,6,7,8,11,12)` alors que l'enum `Ateliers` ne liste pas 9 à 12), CP expéditeur erroné dans `p_updateColisTransporteur` | Moyenne | Q-316 |

Écarts SQL réel ↔ projet SSDT : E1 `tf_evenement` (A9), E3 procédures (A10), E4 index 19 vs 0 (Q-304), E5 (A10), E6 `Parametre_Package` sans PK (confirmé), E7 `Surface` / `tr_atelier_droit_prepa.IdSurface` FK présentes. Comparaison colonne à colonne SQL réel ↔ SSDT ↔ EDMX NON faite (seules les clés de `affiche` et `tf_UM` l'ont été) : Q-324.

Procédures portant des règles métier (126 au total) : liste et rôle des 20 principales dans `bdd.md` §8 ; synthèse dans `docs/ANALYSE_ARCHITECTURE_EXISTANTE.md` §6.3. Leur report dans les services TypeScript est tracé par Q-316.

## 2. Écarts schéma ↔ code legacy ↔ specs ↔ maquette

Méthode : pour chaque entité, ce que dit le schéma réel (§1), ce que fait le code legacy (`legacy-*.md`), ce que demandent les specs (`specs-*.md`, documents cibles) et ce que suppose la maquette (entités déduites des MOCK, `maquettes-reception-coordination.md` §4 et `maquettes-autres-modules.md` §C). Les valeurs MOCK ne sont jamais reprises comme valeurs métier (BRIEF règle 6). Aucun écart n'est tranché ici : chaque ligne qui exige une décision renvoie à une question Q-3xx. Le croisement fin EX/RG ↔ colonne sera complété avec les fichiers de règles consolidés (étape 1b, matrice).

| # | Entité / sujet | Schéma réel | Code legacy | Specs (cible) | Maquette (MOCK) | Question |
|---|---|---|---|---|---|---|
| 1 | Statut d'une affiche | Aucune colonne ; 6 drapeaux bit NULL | État dérivé de drapeaux et de liens ; « statuts » = filtres de 4 procédures ; enum C# `StatutAffiche` (ReceptionAttendu, Receptionnee, Picking) uniquement dans le code | Statuts affiche cibles (À identifier, Rattachée à contrôler, Introuvable, Orpheline, Complément, Feuille à refaire, Contrôlée, Rattachée feuille définitive) | `statut` IDENTIFIEE / ORPHELINE ; `va.etat` MANUELLE / ANNULEE ; `enAttenteControle`, `feuilleImprimee` TEMPORAIRE / DEFINITIVE | Q-300 |
| 2 | Statut d'une ligne attendue | `Statut` varchar(50) libre ; `FromBroadcast`, `ARecevoir` bit ambigus | Pas de colonne d'état unique ; aucune transition d'annulation (RG-COO-001, 003) | Statut ligne ACTIVE / ANNULEE, `source` BC / PREPA, `qte_bc` / `qte_prepa`, `date_vue_bc` (`receptions_attendues_doublons_tables_regles.html`) ; statuts Attendue / Partielle / À contrôler / Complète / Surplus / Contrôlée | `etatTheme` MANQUANT / PARTIEL / SURPLUS / COMPLET / SANS_ATTENDU / NON_ATTENDU ; `qteBCInfo{bc, circe, date}` | Q-300, Q-305 |
| 3 | Réception / livraison (BL) | `livraison` en texte libre, sans plateforme ni statut ; `photo` n–n | Création de livraison = création des `mouvement` et rattachement des affiches ; aucune modification de statut ni suppression de livraison | Réception en 2 étapes (arrivée de la palette puis contrôle), contrôleur, photo du BL, journal d'événements `th_edr_evenement` (EX-TRA-035) | Entité « Réception (palette) » `R26…` avec `statut` A_IDENTIFIER / A_CONTROLER / CONTROLEE, `controleur`, `photoBL`, `orpheline`, `aControlerDepuis` | Q-307 |
| 4 | Lien affiche ↔ ligne attendue | 1–1 : `tf_prepa_affiche.affiche_livraison_Id` (+ `_initial_Id`) ; pas de quantité | Rattachement automatique à TOUTES les lignes de mêmes textes (RG-COO-020) ; dissociation sans remise à zéro de `ARecevoir` (RG-COO-023) | `asso_affiche_visuel` (affiche ↔ ligne avec QUANTITÉ, actif, créé/retiré par/le) ; `tf_edr_rapprochement` (déplacements proposés) | `affiche.alloc[{themeId, qte}]`, `rattache` BL / VISUEL / MAIN : une affiche sert plusieurs dossiers/thèmes/semaines (N à N) | Q-306 |
| 5 | Unicité des attendues | Aucune clé ni index unique | `MERGE` qui ne « matche » jamais (RG-COO-006), correctif IT-62195 (RG-COO-008) | Une ligne par plateforme × dossier × support × thème × bandeau × semaine ; index unique partiel (lignes ACTIVE) ; second index pour lignes sans thème | Réception attendue « ancienne » `RA-<sem>-<k>` avec purge automatique à 4 semaines | Q-305, Q-323 |
| 6 | Validation admin | `validationAdmin` bit NULL ; qui/quand seulement via `histo_historique_entite` | Case à cocher sans contrôle serveur ; effets aval (retour Broadcast `EstAssociee`, suivi) | `validationAdmin_par`, `validationAdmin_le`, `mode_rattachement` (EX-TRA-036) | `va{etat, user, date, motifs[]}` | Q-300, Q-308 |
| 7 | Quantités et stock | `affiche.quantite` NOT NULL ET `mouvement.quantite` | Double source, écrasement vs cumul selon le chemin (RG-REC-023, 075, 079) ; mouvement sans type | Stock = somme des mouvements (EX-TRA-037) | Mouvement `type` (Réception, Complément, Contrôle écart au BL, Mise au rebut, sorties) avec `qte` signée, `auto`, `motif` | Q-322 |
| 8 | Dossier, thème, ligne de préparation, unité de production, libération de semaine | Pas de table `dossier` (n° de dossier = `cont_num` répété) ; thème = `instruction_visuels.insv_theme` / `tf_face_train` ; ligne de préparation ≈ `tf_repart_calcul` ; unité ≈ `tf_face_train` / `tf_UM` ; libération ≈ passage de statut 5 → 2 (RG-COO-074) sans table | Grain thème × afficheur ; faces d'entretien calculées (RG-COO-068) | Instruction OK, export des trains du jeudi, alertes | Entités `Dossier` (champs `iok{date,user}`, `exporte`, `demandeBC`, `historique[]`), `Thème`, `Ligne de préparation`, `Unité de production` (`kind` TRAIN / UM / LOT), `Libération de semaine` | Q-336 |
| 9 | Statuts d'instruction, de face, d'unité | `rpc_statut` 0 à 10 partagé par 4 tables ; contenu de `tr_statut` absent | Transitions dispersées dans SQL et front (RG-COO-060, 072) | « Paramétrage › Statuts » (correspondance non fournie) ; Instruction OK ; statuts à vocabulaire unique (EX-TRA-018, 019) | Unité `statut` EN_ATTENTE → PRET → EN_PROD → PRODUIT → COLISE → EXPEDIE → LIVRE ; statuts dossier A_TRAITER / PREPA_RECUE / VALIDE / ANNULE ; Instruction OK (5) | Q-301, Q-302, Q-004 |
| 10 | Historique / audit | `histo_historique_entite` générique ; aucun historique de statut pour la coordination | Actions 1 à 16 seulement ; batchs sans historique ; dissociation mal typée | Traçabilité complète (EX-TRA-034), journal `th_edr_evenement` (EX-TRA-035), lot versionné par génération | `Journal{date, user, objet, action}`, `historique[]` sur affiche, dossier, unité | Q-308 |
| 11 | Site, atelier, machine, destinataire, afficheur, opérateur | `tr_plateforme`, `tr_atelier` (`ate_type` 1 / 2), `Machine`/`Equipe` (production), `tr_destinataire`, `tr_rouleur` | Plateformes 1 à 4 ↔ sites 39/40/43/44 (RG-INT-021) ; ateliers 11/12 hors enum ; afficheur = destinataire `des_type` 0 (RG-INT-004) | Site = plateforme (Wissous, Nîmes ; DBG et DBG Lyon dans le code, EX-TRA-006) ; « règles en configuration » (EX-TRA-041) | 10 ateliers (`mode` train / unitaire, `type` fixe / pliage / bus, `formats[]`, `machines[]`) ; machine vendome / ccm / multirouleuse (`tiroirs`, `bagues`, `repertoire`) ; destinataire `canal` MILK / MESSAGERIE / DIRECT, départ camion | Q-335, Q-319 |
| 12 | Utilisateur, rôle, périmètre | `tr_utilisateur(loginWindows, prf_id, ate_id…)`, `tr_utilisateur_menu` (27 droits), `tr_utilisateur_data` | `prf_id` inerte ; aucun contrôle serveur | Connexion et droits par rôle (lot 0), mécanisme non spécifié (EX-TRA-001) ; rôle Commerce lecture seule (EX-TRA-004) | 6 rôles `coord`, `cheq`, `recep`, `expe`, `admin`, `com` | Q-001, Q-003, Q-320 |
| 13 | Semaines | `semaine` / `sem_num` / `sem_annee` ints ; `affiche.semaines` texte ; mélange `DATEPART(wk)` / ISO | Semaines « américaines » et branche fin d'année (RG-COO-002) | Semaines ISO exigées (doc cible, `bdd.md` §10 n°8) | `semaines{num, statut}`, départ camion relatif au lundi de S-1 | Q-314 |
| 14 | Paramètres métier | Aucune table de paramètres (hors `tr_parametre_alternance`, `Parametre_Package`) | Constantes en dur (20 thèmes, 8 %, 133…) | Règles en configuration, Circé « n'a pas de table de paramètres » (EX-TRA-041) | `Paramètres{entretien{seuil, arrondi, grain}, ecartReception, comptageMorceau, exemplairesFeuille, purgeAttendues, delaiControle, alleeInconnues, seuilThemesProches…}` (valeurs MOCK) | Q-337, Q-315 |
| 15 | Alertes, mails (boîte d'envoi) | Aucune table | Mails SMTP ponctuels (réception, déblocage, colis) ; aucune alerte | Alertes (17 types, 5 gravités, acquittement, sans purge, EX-TRA-027 à 032) remplaçant mails et pointages | `Alerte{key, type, sev, acquittee, roles[]}`, `Mail{to, subject, trigger}` | Q-336, Q-327 |
| 16 | Colisage / expédition | Domaine C (8 tables) ; `rpc_statut` 7 / 8 | Hors périmètre prioritaire ; batchs mail et Zoom | Hors Réception/Coordination (EX-TRA-040) | Colis COLIS_OUVERT / COLIS_CLOS ; scan et colisage ; départs camions | Q-310 |
| 17 | Photos | `photo.image_file` varbinary(max) | Photo d'affiche et de BL ; pièces jointes de livraison sur partage disque | Rétention des photos de BL non définie (EX-TRA-042) | « Photo du BL », « Photo d'une affiche » | Q-311, Q-332 |
| 18 | Identifiants d'affichage | `int identity` partout, `instr_code` varchar(18) calculé (RG-COO-046) | Numéros de dossier, de DA, d'affiche | — | `R26…`, `712…`, `TR-nnnn`, `UM-nnnn`, `MV-…` : IDs MOCK sans source | Q-312 |

## 3. Modèle cible (constat préliminaire, pas de Prisma)

Ce paragraphe n'écrit pas le schéma Prisma : il présente les décisions PRÉLIMINAIRES à valider, limitées aux tables clés Réception et Coordination (+ nouvelles tables imposées par CLAUDE.md §6). Principes de départ proposés par `bdd.md` §9 : conserver les noms métier existants quand cela facilite la migration et la recette (hypothèse rattachée à Q-321) ; Prisma + PostgreSQL ; `version` (verrou optimiste) et statut + historique sur chaque entité à statut (CLAUDE.md §6). « Modèle Prisma envisagé » = nom de modèle probable, sans champ.

### 3.1 Tables clés
| Table réelle | Modèle Prisma envisagé | Décision préliminaire | Justification |
|---|---|---|---|
| `affiche` | `Affiche` | MODIFIÉE (à valider) : ajouter `statut` si Q-300 le décide, `version`, `validationAdmin_par/_le`, `mode_rattachement` ; drapeaux bit NOT NULL DEFAULT false ; `cont_num` entier ; `semaines` / `nombre_semaine` dérivés de `tf_dossier_semaine_depart` | EX-TRA-036, EX-TRA-037 ; drapeaux NULL incohérents (REVIEW §2.1) ; Q-300, Q-312, Q-313, Q-322 |
| `livraison`, `asso_livraison_affiche` | `Livraison` (ou `Reception`), `LivraisonAffiche` | À TRANCHER : étendre `livraison` (plateforme, statut, contrôleur, `version`) ou créer l'entité Réception de la maquette | Maquette « Réception (palette) » ; schéma sans statut ni plateforme ; Q-307 |
| `mouvement` | `Mouvement` | CONSERVÉE, avec type de mouvement à confirmer ; append-only | EX-TRA-037 (stock = somme) ; Q-322 |
| `photo`, `asso_livraison_photo` | `Photo`, `LivraisonPhoto` | CONSERVÉE, stockage du binaire à trancher | Q-311 |
| `fusion_affiche`, `tf_dossier_semaine_depart` | `FusionAffiche`, `AfficheSemaineDepart` | CONSERVÉES (semaines ISO) | Socle Réception ; Q-314 |
| `tf_prepa_affiche` | `ReceptionAttendue` | MODIFIÉE (à valider) : FK `plt_id`, `sup_id`, `ate_id` ; `source`, `etat_ligne`, `qte_bc` / `qte_prepa`, `date_vue_bc` ; index unique partiel | Doc cible RG-AT-04/05 (via `bdd.md` §9.2) ; Q-305 |
| lien affiche ↔ attendue | `AfficheAttendue` (ex. `asso_affiche_visuel`) | AJOUTÉE (à valider) : lien n–n avec quantité, actif, créé/retiré par/le | Doc cible RG-AT-04/08 ; maquette `alloc[]` ; Q-306 |
| `tf_prepa_Broadcast` | `PrepaBroadcast` | MODIFIÉE (à valider) : conserver `IdSiteCCF`, `IdSurface`, `IdFormat`, `IdPreparationChapeau`, `IdTypePreparation`, `EstResteEnPlace`, `date_vue` (+ `IdTheme` si Broadcast le fournit) | Rapprochement par identifiants plutôt que par texte ; Q-325 |
| `instruction_train` | `Instruction` | MODIFIÉE (à valider) : `rpc_statut` typé, `version`, FK vers détails/faces ; PK `instr_code` | CLAUDE.md §6 ; A4, A5 ; Q-301, Q-303 |
| `instruction_detail`, `instruction_visuels` | `InstructionDetail`, `InstructionVisuel` | CONSERVÉES, ajouter la FK `instr_code` | A5 ; Q-317 |
| `tf_face_train` | `FaceTrain` | MODIFIÉE (à valider) : statut typé, `version` (verrou, distinct de la version de train), retirer les 2 FK redondantes, FK `instr_code` | A5 ; Q-301, Q-317, Q-324 (80 colonnes à inventorier) |
| `tf_repart_calcul` | `Repartition` | CONSERVÉE (colonnes utiles à la Coordination), statut typé | Dépendance Coordination (déblocage, UM) ; Q-310, Q-324 |
| `tf_UM`, `tf_colis`, `tf_UM_colis`, `tf_colis_ext` | `UniteManutention`, `Colis`… | À TRANCHER : lecture seule limitée (statut ≥ 6 bloque le déblocage) ou périmètre complet | Étape 8 ; Q-310 |
| `tr_statut`, `tr_statut_repart` | enums Prisma ou tables de référence | À TRANCHER | Q-004, Q-301 |
| `tr_plateforme`, `tr_atelier`, `tr_categorie_support`, `Surface`, `tr_type_preparation` + `TypePreparation` (à fusionner), `tr_instruction_plus`, `tr_jour_depart`, `tr_atelier_droit_prepa`, `tr_parametre_alternance`, `tr_destinataire` / `tr_destination` / `tr_dest_adresse` | `Plateforme`, `Atelier`, `CategorieSupport`, `Surface`, `TypePreparation`, `InstructionPlus`, `JourDepart`, `AtelierDroitPrepa`, `ParametreAlternance`, `Destinataire`… | CONSERVÉES (référentiels vivants avec FK réelles) ; `v_support_scrolling` → drapeau `est_deroulant` | Q-318, Q-319, Q-315 ; seed impossible sans export de prod |
| `tr_utilisateur`, `tr_utilisateur_menu`, `tr_utilisateur_data`, `tr_profil` | `Utilisateur`, rôles et périmètre | À TRANCHER | Q-001, Q-003, Q-320 |
| `histo_historique_entite`, `histo_action_applicative`, `tr_type_entite` | `HistoriqueEntite`… | À TRANCHER (étendre l'existant ou historique dédié par entité) | CLAUDE.md §6 ; EX-TRA-034 à 036 ; Q-308 |
| (nouvelle) | `StatutHistorique` (ou équivalent) | AJOUTÉE (proposée) : type d'entité, id, ancien, nouveau, par, le, motif | CLAUDE.md §6 « chaque changement de statut écrit un historique » ; Q-308 |
| (nouvelle) | `IdempotencyKey` | AJOUTÉE (imposée) | CLAUDE.md §6 (`Idempotency-Key` sur les POST de création/transition) |
| (nouvelle) | `Parametre` | À TRANCHER | EX-TRA-041 ; Q-337 |
| (nouvelles, entités implicites de la maquette) | `Alerte`, `Dossier`, … | À TRANCHER | Q-336 |

### 3.2 Choix structurants à trancher
| Choix | Constat | Options | Renvoi |
|---|---|---|---|
| Enums Prisma vs tables de référence | `rpc_statut` = FK vers `tr_statut` (données absentes) ; la cible parle d'un catalogue de statuts paramétrable (« Paramétrage › Statuts ») ; CLAUDE.md §6 impose une table de transitions explicite dans le service | Enums par entité (typage fort, une machine d'états par entité) / table de référence alimentée par seed / les deux | Q-004, Q-301, Q-302 |
| Statut persisté ou calculé | `affiche` et lignes attendues sans statut ; statuts cibles nombreux | Colonne `statut` + historique / dérivation | Q-300 |
| Historiques et audit | Un seul journal générique, sans seed, sans historique de statut côté coordination | Générique étendu / table par entité / table commune de statut | Q-308 |
| Versionnement (verrou optimiste) | Aucun existant (`rpc_tms` marginal) | Colonne `version` Int sur chaque entité à statut (imposé) ; périmètre exact des entités | CLAUDE.md §6 |
| Idempotence | Aucun existant | Table `IdempotencyKey` (clé, empreinte, réponse, expiration) : structure imposée, durée de rétention à fixer à l'étape 4 | CLAUDE.md §6 |
| Clés | Identity int, `instr_code` varchar(18) calculé, `cont_num` varchar vs int | Clés de substitution + clé naturelle unique ; types alignés | Q-303, Q-312, Q-334 |
| Contraintes manquantes | FK, unicités, NOT NULL, CHECK absents | À ajouter sans règle inventée (seules les règles sourcées) | Q-317, Q-334 |
| Quantité | Double source | Calculée / persistée | Q-322 |
| Rétention et archivage | `ARCH_*` 3 ans, historique 2 ans, `tt_log` 2 mois, attendues 4 semaines (cible) | À préciser par entité | Q-323 |
| Multi-sites | Plateforme / atelier / site en trois notions | `Site` ≡ `Plateforme` (EX-TRA-006) ou entité distincte | Q-335 |

### 3.3 Modèle cible implémenté (étape 3)

Source : `apps/api/prisma/schema.prisma`. Décisions : Q-300 (a) statut persisté, Q-306 (a) lien n–n avec quantité, Q-307 (b) entité `Reception`, Q-301 un enum par entité, Q-308 journal + historique de statut, Q-341 noms français avec `@@map`, Q-343 SQLite. « Conservée / Modifiée / Ajoutée » par rapport au schéma réel.

| Modèle Prisma | Table | Décision | Justification (EX / RG / Q) |
|---|---|---|---|
| `Utilisateur`, `Role`, `UtilisateurRole`, `Permission`, `RolePermission`, `UtilisateurPerimetre` | `utilisateur`, `role`, … (réel : `tr_utilisateur`, `tr_utilisateur_menu`, `tr_utilisateur_data`, `tr_profil`) | Modifiée | Q-001 (identifiant neutre), Q-003 (6 rôles provisoires), RG-REC-001/002/003. `Permission` alimentée à l'étape 4. |
| `Plateforme`, `Atelier`, `CategorieSupport`, `Surface`, `TypePreparation`, `AtelierDroitPrepa`, `InstructionPlus`, `JourDepart`, `ParametreAlternance`, `Rouleur`, `Destinataire` | `tr_*`, `surface`, `type_preparation` | Conservée (+ `est_deroulant`, fusion des deux tables de types) | Q-315, Q-318, Q-335 |
| `Imprimeur`, `Livreur` | `tr_imprimeur`, `tr_transposteur_reception` | Conservée | D-04, Q-115 |
| `Parametre` | `parametre` | Ajoutée | Q-337, EX-TRA-041 |
| `JournalAudit`, `StatutHistorique`, `CleIdempotence` | `journal_audit`, `statut_historique`, `cle_idempotence` | Ajoutée (le journal étend `histo_historique_entite`) | Q-308, RG-REC-006/007/008, RG-COO-061/307 |
| `Reception` | `reception` | Ajoutée | Q-307 (b), EX-REC-053, RG-REC-009 |
| `Livraison`, `LivraisonAffiche`, `LivraisonPhoto`, `Photo` | `livraison`, `asso_livraison_*`, `photo` | Modifiée (listes fermées, `version`) | Q-102, Q-115, Q-311 |
| `Affiche` | `affiche` | Modifiée (`statut`, `version`, validation admin par/le, mode de rattachement, type de feuille, drapeaux NOT NULL, sans `semaines`) | Q-300, Q-313, Q-126, EX-TRA-036 |
| `Mouvement` | `mouvement` | Modifiée (`type`, quantité signée, append-only) | RG-REC-151/153, Q-322 |
| `FusionAffiche`, `AfficheSemaineDepart` | `fusion_affiche`, `tf_dossier_semaine_depart` | Conservée (fusion en lecture seule) | Q-100, Q-314 |
| `ReceptionAttendue` | `tf_prepa_affiche` | Modifiée (`source`, `etat_ligne`, `statut`, `qte_bc`/`qte_prepa`, `theme_cle`, index unique partiel) | Q-305, RG-COO-080/087/089 |
| `AfficheAttendue` | `asso_affiche_visuel` | Ajoutée | Q-306, RG-COO-088, RG-REC-137 |
| `PrepaBroadcast` | `tf_prepa_Broadcast` | Modifiée (identifiants, `EstResteEnPlace`, `date_vue`) | Q-325, Q-209 |
| `Dossier` | `dossier` | Ajoutée (minimal : statut de préparation seul) | RG-COO-063, Q-215, Q-336 (hypothèse) |
| `Instruction`, `InstructionDetail`, `InstructionVisuel` | `instruction_train`, `instruction_detail`, `instruction_visuels` | Modifiée (statut enum, `version`, FK `instr_code`) | RG-COO-040/046, Q-303, Q-317 |
| `FaceTrain`, `Repartition`, `UniteManutention` | `tf_face_train`, `tf_repart_calcul`, `tf_UM` | Modifiée, reprise PARTIELLE des colonnes | Q-324, Q-250, Q-301, RG-COO-143 |

**Non reprises** (Q-309, aucune suppression en production) : `Activite`, `Equipe`, `Machine`, `tf_train_export`, `tf_anomalies`, `trav_*`, `histo_preparation`, `histo_trainAffiche`, `th_*`, `tra_*`, `tw_*`, `ARCH_*`, `tmp_*`, `tt_*`, `tf_colis*`, `log_colis_transporteur`, `PreparationExterne*`, `tr_destination`, `tr_dest_adresse`, `tr_statut`, `tr_statut_repart`, `tr_statut_colis`, `tr_type_entite`, `histo_action_applicative` (remplacés par enums), `tr_societe`, `tr_atelier_support`, `tr_commune*`, `Transaco*`, `Parametre_Package`, vue `v_support_scrolling`.

**Limites connues du support SQLite** (Q-343, Q-346) : les enums sont des `TEXT` sans `CHECK` en base (validés par Prisma et par les services) ; les index uniques partiels sont écrits en SQL brut dans la migration (Prisma ne les modélise pas : ne pas les perdre aux migrations suivantes) ; pas de verrou de ligne.

## 4. Journal des évolutions
| Date | Migration | Changement | Justification | Impact données existantes |
|---|---|---|---|---|
| 2026-11-04 | `20261104160802_cree_modele_initial` | Création de 42 tables (SQLite) : utilisateurs/rôles/permissions/périmètre, référentiels (plateforme, atelier, support, surface, type de préparation, instruction plus, jour de départ, imprimeur, livreur, rouleur, destinataire, paramètres), transverse (journal d'audit, historique de statut, clé d'idempotence), Réception (photo, livraison, réception, affiche, mouvement, rattachement, fusion, semaines de départ), lignes attendues (ligne attendue, lien affiche ↔ ligne, copie Broadcast), Coordination (dossier, instruction, détail, visuel, face de train, répartition, UM). 67 clés étrangères `ON DELETE RESTRICT`. Index uniques partiels en SQL brut : ligne attendue ACTIVE par clé, lien actif affiche ↔ ligne, paramètre global, périmètre sans atelier. | Q-300 (a), Q-306 (a), Q-307 (b), Q-305, Q-303, Q-313, Q-322, Q-337, Q-343 ; RG-COO-080/087/088, RG-REC-008/009/137/151/153 ; CLAUDE.md §6 | Aucun : base vide (SQLite neuve). SQL relu : 0 `DROP`. Reprise des données legacy non faite (Q-155, Q-213, Q-321). |
| 2026-11-05 | `20261105200000_ajoute_deblocage_preparation` | Table `deblocage_preparation` (trace d'un déblocage / « Rendre la main » : clé et type du groupe, prépa chapeau, groupe Broadcast, dossier, semaine, site, type, quantité, motif, ids des répartitions et UM annulées, statut du mail, auteur, date) ; CREATE seulement | RG-COO-146, 149, 278 (équivalent de `th_repart_annule` + historique `DebloquerPreparation`) ; Q-191 | Aucun (nouvelle table) |
| 2026-11-05 | `20261105220000_ajoute_trains` | `tf_face_train` : colonnes d'emplacement legacy (`empl_sect_code`, `empl_depa_code`, `comm_numord`, `empl_numord`, `empl_addresse1`), `fractionnee` (position produite à part), `origine_train` (train créé : PRE_TEST / ENTRETIEN_AJOUTE), `motif_suppression` ; ALTER seulement (pas de reconstruction) ; enums `TypeEntite.TRAIN` et 10 actions d'audit des trains (TEXT en SQLite, sans SQL) | RG-COO-200, 202, 209, 221, 224, 225 ; Q-324 (colonnes reprises au besoin), Q-192 | Aucun (colonnes nullables ou avec défaut) |

## 5. Reprise de données
Aucune source ne définit de reprise : ni `MISSION.md` ni les specs lues ne l'exigent explicitement. La décision (reprise de la production, démarrage à vide, ou reprise partielle) est ouverte : Q-321. Points à traiter SI une reprise est décidée :
1. Dédoublonnage préalable de `tf_prepa_affiche` (garder la ligne portant une affiche, reporter le lien, annuler les autres : proposition du doc cible, `bdd.md` §10 n°1) : Q-305, Q-321.
2. Conversion des statuts texte et numériques existants : exige une table de correspondance validée (ne pas convertir sans elle) : Q-004, Q-302.
3. Normalisation : `cont_num` varchar → entier, drapeaux NULL → faux, `semaines` texte → lignes de départ, semaines non ISO → ISO, troncatures : Q-312, Q-313, Q-314.
4. Orphelins avant ajout de FK (`tf_face_train.instr_code`, `instruction_detail.instr_code`, `tf_prepa_affiche.{plt_id,sup_id,ate_id}`) : Q-317.
5. Binaires `photo.image_file` (volume inconnu) : Q-311.
6. Historique (`histo_historique_entite` sans référentiels d'actions) et archives `ARCH_*` : Q-308, Q-323.
7. Référentiels et utilisateurs : seed depuis un export de production (`pnpm seed:ref`) : Q-004, Q-319, Q-320.
8. Tables candidates à abandon (G, H, I, `trav_*`, `tf_evenement`, etc.) : aucune suppression sans validation DSI (usage SSIS et batchs externes non vérifié) : Q-309.
9. Anonymisation / données personnelles : non traitée (les JDD ne doivent pas contenir de données réelles, CLAUDE.md skill `circe-jdd`) ; si reprise, à cadrer : Q-321.

### Journal des évolutions — COO-P10 (2026-11-05)
Migration `20261105240000_ajoute_export_trains` (CREATE / ALTER uniquement) : `instruction_train.exporte_le`, `exporte_par_id` (marquage « exporté », RG-COO-211) ; table `export_trains` (lot d'export : semaine, nature EXPORT_TRAINS / EXPORT_PREPARATION, simulation, nom et contenu du fichier simulé, compteurs, auteur) ; table `tf_train_export` (un enregistrement par train, 6 contrats au maximum en JSON : RG-COO-213, Q-253) ; table `generation_fichiers` (lot « G-nnnn » versionné, trains en JSON, tiroirs, statut PREPARE / ENVOYE : ECR-GEN-01 / 03, RG-COO-307). Enums `ActionAudit` et `TypeEntite` étendus (valeurs TEXT, sans SQL). Paramètres : `trains.ateliersExportPrepa`, `trains.themesMaxExportPrepa`, `trains.tiroirsMax`. Hypothèses : Q-193.

Migration `20261105260000_ajoute_perimetre_lots_export` (ALTER uniquement) : `export_trains.ate_ids` et `generation_fichiers.ate_ids` (JSON des ateliers du lot, défaut `[]` ; RG-COO-167, Q-193 (13)). Le JSON des contrats de `tf_train_export` porte désormais aussi la lettre de position et le rouleur (RG-COO-213).

Migration `20261105280000_ajoute_marquage_simule_versions_lot` (ALTER uniquement) : `export_trains.fichier_simule` (BOOLEAN, défaut vrai : le fichier est SIMULÉ, jamais déposé, D-15 ; audit COO-P10 B1), `generation_fichiers.versions_trains` (JSON { trainId: version } au « Préparer », revérifié à l'envoi : audit B3, RG-COO-308) et `generation_fichiers.machine_envoi` (adaptateur machine de l'envoi ; audit m5).

### Journal des évolutions — COO-P11 (2026-11-05)
Migration `20261105300000_ajoute_roulage_bagues_suivi8m2` (CREATE / ALTER uniquement) : `tr_rouleur.poste` (poste de l'opérateur, « Table 1 » : RG-COO-297, ECR-COO-07) ; table `bague` (une par train : `train_id` UNIQUE, atelier, rouleur, textes imprimés en JSON, `modifiee`, compteur `reimpressions`, date et auteur de l'impression, `version` : RG-COO-299 à 302, Q-195) ; table `suivi_8m2` (demies haut / bas et 8 m² finales par site, dossier et thème normalisé, UNIQUE, `version` : RG-COO-237, Q-264). Enums `ActionAudit` (IMPRESSION_BAGUE, MODIFICATION_BAGUE, REIMPRESSION_BAGUE, AFFECTATION_DISPATCH, PROPOSITION_REPARTITION, DESAFFECTATION_DISPATCH, SUIVI_8M2, CREATION_ROULEUR, MODIFICATION_ROULEUR) et `TypeEntite` (BAGUE, SUIVI_8M2) étendus (valeurs TEXT, sans SQL). Paramètres : `dispatch.seuilDepartHeures` (36), `dispatch.seuilChargePct` (115), `suivi8m2.ateliers` (vide : aucun identifiant legacy supposé, Q-319). Hypothèses : Q-195.

### Journal des évolutions — COO-P12 (2026-11-05)
Migration `20261105320000_ajoute_unitaire` (CREATE / ALTER uniquement ; le SQL généré reconstruisait `tf_repart_calcul`, réécrit en deux `ALTER TABLE … ADD COLUMN`) : `tf_repart_calcul.corrigee_plateforme` (annonceur / thème corrigés par la plateforme : RG-COO-244) et `rendue_le` (repère « main rendue » : RG-COO-243) ; table `rendu_main` (motif, unités en production non retirées, répartitions et dossiers rendus, auteur : RG-COO-243, append-only) ; table `encollage_bus` (ajustement global et par centre bus par plateforme × semaine, UNIQUE, `version` : RG-COO-304, Q-196). Enums `ActionAudit` (CORRECTION_INTITULE, RENDU_MAIN_UNITE, MODIFICATION_QUANTITE_UNITE, RETRAIT_UNITE, PREPARATION_UNITE, COMPTAGE_PLIAGE, QUANTITES_ENCOLLER) et `TypeEntite` (ENCOLLAGE_BUS) étendus (valeurs TEXT, sans SQL). Paramètres : `unitaire.typesPliage`, `unitaire.typesBus` (vides : aucun identifiant legacy supposé, Q-319). Contrat de préparation : `quantiteEntretien`, `datePremierDepart` (RG-COO-124, Q-196 (1)). Hypothèses : Q-196.

### Journal des évolutions — COO-P13 (2026-11-05)
Migration `20261105340000_ajoute_colis` (CREATE uniquement) : table `tf_colis` (`colis_id`, plateforme, atelier, destinataire, statut `StatutProduction` 1 / 7 / 8, format « À définir » (5), `colis_code` unique `C-` + n° sur 18 chiffres, poids, transporteur et tarif, code externe, commentaire, date d'expédition, `mailcolis_envoye`, version, créé / modifié par) et table `tf_UM_colis` (`uc_qte`, unique UM × colis, clés étrangères vers `tf_UM` et `tf_colis`). `tf_face_train.colis_id` reste un lien logique sans clé étrangère (SQLite n'ajoute pas de FK par ALTER, Q-310). `TypeEntite.COLIS` et neuf actions d'audit (création, ajout d'UM / de train, retrait, suppression, expédition, fin de journée, mail, sortie de stock). Paramètre `colis.ateliersMajoration` (vide, RG-COO-263, Q-319). Aucune table AMT (RG-COO-272 à 276 non repris, Q-274).

### Étape 8 lot 1 (2026-11-06) : modèle
- Nouvelle table `tf_liberation_semaine` (Prisma `LiberationSemaine`, migration `20261105360000_ajoute_liberation_semaine`, CREATE seulement) : libération de la semaine de départ d'un atelier fixe / pliage / bus (RG-COO-240) ; colonnes `ate_id` (clé étrangère `tr_atelier`), `sem_annee`, `sem_num`, `liberee_le`, `par_id`, `created_at` ; clé unique (`ate_id`, `sem_annee`, `sem_num`) : une seule libération par couple (atelier, semaine). Sans équivalent legacy (le legacy n'avait que le bouton « Colisage »). Q-265 option (c), Q-404.
- Nouvelles valeurs d'énumération (texte en SQLite, aucune migration) : `TypeEntite.LIBERATION_SEMAINE` ; `ActionAudit.LIBERATION_SEMAINE`, `CREATION_UNITE`, `CREATION_DESTINATAIRE`, `MODIFICATION_DESTINATAIRE`.
- Aucune colonne ajoutée à `tf_repart_calcul` : les repères « à libérer » et « arrivé après libération » sont dérivés (Q-250, Q-404 (4)). `tr_destinataire`, `tr_dest_adresse` et `tr_ate_dest_trans` sont inchangées (D-05, Q-403).

### Journal des évolutions — étape 8 lot 2 (2026-11-06)
- Aucune table ni colonne ajoutée : D-06, D-02 et D-01 réutilisent `parametre`, `tr_plateforme`, `tr_atelier`, `utilisateur`, `role`, `utilisateur_role` et `utilisateur_perimetre` (Q-337, Q-320).
- Nouvelles valeurs d'énumération (texte en SQLite, aucune migration) : `TypeEntite.UTILISATEUR` ; `ActionAudit.CREATION_UTILISATEUR`, `MODIFICATION_UTILISATEUR` (`MODIFICATION_PARAMETRE` existait). Client Prisma régénéré.
- Nouvelle permission `utilisateur.gerer` (catalogue : administrateur) : 56 permissions copiées en base par `seed:ref` (étaient 55).

### Journal des évolutions — étape 8 lot 4 (2026-11-06)
Migration `20261106110000_ajoute_mails_taches` (CREATE uniquement, 0 `DROP`) :
- `mail_file` (D-19, Q-409) : file d'envoi des mails. `cle` UNIQUE (un fait métier = une ligne : idempotence), `type` (COLIS_EXPEDIE, DEBLOCAGE, CORRECTION_BROADCAST, CORRECTION_INTITULE), `source_type` / `source_id` (fait d'origine, sans clé étrangère : colis, trace de déblocage, demande de correction), `destinataires` (adresses validées séparées par « ; »), `sujet`, `corps`, `statut` (EN_ATTENTE, EN_COURS, ENVOYE, ECHEC), `tentatives`, `derniere_erreur`, `canal` (SIMULE ou SMTP), `par_id`, `version` (réservation atomique et relance sous verrou), `cree_le`, `tentative_le`, `envoye_le` ; index `(statut, id)`. Justification : EX-TRA-030, RG-ADM-045 (10 tentatives, marquage seulement si l'envoi réussit), Q-219 (envoi après commit).
- `tache_execution` (D-20, Q-410) : journal d'exécution des traitements planifiés (`tache`, `declencheur` PLANIFIE / MANUEL / COMMANDE, `par_id`, `statut`, `debut`, `fin`, `message`, `resultat` JSON) ; `verrou` UNIQUE (= nom de la tâche tant qu'elle s'exécute : une seule exécution à la fois, comme `passage_integration`) ; index `(tache, debut)`.
- Énumérations étendues (texte en SQLite, aucun SQL) : `TypeEntite.MAIL`, `TACHE` ; `ActionAudit.CREATION_MAIL`, `ENVOI_MAIL`, `ECHEC_MAIL`, `RELANCE_MAIL`, `EXECUTION_TACHE`.
- Données de référence : 4 paramètres `taches.*` (horaires « HH:MM » séparés par « ; », VIDES = désactivé) ajoutés au seed et au registre D-06 (format `horaires`, groupe « Planification »). Compte technique `circe-automatique` (table `utilisateur`, inactif) créé au premier besoin par l'API, pas par la migration.
- Impact sur les données existantes : aucun. Les colonnes existantes `colis.mailcolis_envoye`, `demande_correction.mail_envoye` et `deblocage_preparation.mail_statut` sont désormais mises à jour par l'envoi réel.

### Journal des évolutions — étape 8 lot 5 (2026-11-06)
- Migration `20261106120000_ajoute_complement_generation` (ALTER TABLE seulement) : `generation_fichiers.complement_de_id INTEGER NULL` = lot d'origine d'un « complément » (RG-COO-074, ECR-GEN-03, Q-411) ; lien logique sans clé étrangère (SQLite n'en ajoute pas par ALTER, Q-310). Impact sur les données existantes : aucun (colonne vide).
