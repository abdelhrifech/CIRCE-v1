# Analyse du schéma BDD (étape 1) — 2026-11-04

Analyse en LECTURE SEULE. Aucun fichier source modifié.

## 0. Sources et périmètre

| Source | Rôle | Remarque |
|---|---|---|
| `docs-sources/CIRCE SQL.sql` (UTF-16 LE, script SSMS du 03/11/2026 10:34) | **Schéma réel** (prod ou copie prod) | Lu via la copie `docs/_travail/extraits/CIRCE_SQL_utf8.sql` |
| `circe-develop/BDD/DATABASE/DATABASE/dbo/{Tables,Stored Procedures,Views,User Defined Types}` + `DATABASE.sqlproj` | Projet SSDT du repo | 117 tables, 127 procédures, 1 vue, 46 UDT |
| `circe-develop/BDD/DATA/*.sql` | Données initiales / scripts de correction | Seulement 2 scripts de données référencés par `Script.PostDeployment.sql` (destinataires PEX, `MajData`) |
| `circe-develop/docs/REVIEW_Database_proc.md` | Revue interne du 25/09/2026 (APPFR-4286) | Source des bugs de procédures cités |
| `CIRCE.edmx` (DAL) | Mapping EF | 65 entity sets sur 116 tables |
| `docs-sources/2. CIRCE CIBLE + MAQUETTE/{1. RECEPTION,2. COORDINATION}/*.html` | Cible | Utilisés pour le modèle cible |

**Croisement avec `legacy-*.md` / `specs-*.md` : ces fichiers n'existent pas encore** (seuls `inventaire.md` et `extraits/*` sont présents). Le croisement systématique EX/RG reste **à faire**. Les identifiants cités ci-dessous (RG-AT-04, RG-AT-05, RG-AT-08, RG-IOK-02, RG-VA-04, Q60) sont ceux **du document source cible** (`receptions_attendues_doublons_tables_regles.html`), pas des ID projet (`RG-REC-nnn`). Ils sont à convertir.

### Correction des chiffres annoncés
- Le SQL réel contient **116 tables permanentes** (`CREATE TABLE [dbo]`), pas 138. Les 138 occurrences de `CREATE TABLE` comprennent **22 tables de travail créées dans des procédures** (`#temp`, `#res`, `#inserted_lignes`, etc.).
- **126 procédures**, **1 fonction** (`Fn_GetPrepaAffiche`), **1 vue** (`v_support_scrolling`), **46 types** (36 alias + 10 types table), **0 trigger**.
- Le script réel ne contient **aucun index non clusterisé** (un seul `UNIQUE` : `UQ_tr_atelier_droit_prepa`), **aucun CHECK**, **5 DEFAULT**. Les index du repo (19 dans `Tables/*.sql`) ne sont donc pas vérifiables : le script a été exporté sans les index. **À confirmer avec la DSI** (`sys.indexes`).

---

## 1. Inventaire des 116 tables par domaine

| Domaine | Nb | Tables |
|---|---|---|
| **A. Réception (affiches, livraisons, stock, production)** | 13 | `affiche`, `livraison`, `mouvement`, `photo`, `asso_livraison_affiche`, `asso_livraison_photo`, `fusion_affiche`, `tf_dossier_semaine_depart`, `tf_prepa_affiche` (réceptions attendues), `tf_prepa_Broadcast` (copie de l'état des réservations), `Activite`, `Equipe`, `Machine` |
| **B. Coordination (instructions, répartition, trains, préparations)** | 15 | `instruction_train`, `instruction_detail`, `instruction_visuels`, `tf_face_train`, `tf_repart_calcul`, `tf_train_export`, `tf_anomalies`, `trav_groupePreparation`, `trav_preparation`, `trav_preparationDetail`, `trav_instruction`, `trav_instructionDetail`, `trav_theme`, `trav_trainAffiche`, `trav_adresseLivraisonAfficheur` |
| **C. Colisage / expédition** | 8 | `tf_UM`, `tf_UM_colis`, `tf_colis`, `tf_colis_ext`, `log_colis_transporteur`, `PreparationExterne`, `ColisPreparationExterne`, `RessourcePreparationExterne` |
| **D. Référentiels** | 43 | `tr_categorie_support`, `Surface`, `TypePreparation`, `tr_type_preparation`, `tr_type_dossier`, `tr_type_destination`, `tr_type_adresse`, `tr_type_anomalie`, `tr_typ_aff_amt`, `tr_statut`, `tr_statut_repart`, `tr_statut_colis`, `tr_plateforme`, `tr_atelier`, `tr_atelier_droit_prepa`, `tr_atelier_imprimante`, `tr_atelier_support`, `tr_poste`, `tr_rouleur`, `tr_societe`, `tr_activite`, `tr_jour_depart`, `tr_instruction_plus`, `tr_lien_cote_cote`, `TR_tri_cote_cote`, `tr_parametre_alternance`, `tr_train_convention_a_trier`, `tr_destinataire`, `tr_dest_adresse`, `tr_destination`, `tr_adresseMail_plateforme`, `tr_commune`, `tr_communes_calber`, `tr_agence_geodis`, `tr_format_colis`, `tr_imprimeur`, `tr_transporteur`, `tr_transporteur_atelier`, `tr_trans_tarif`, `tr_ate_dest_trans`, `tr_transposteur_reception`, `Transaco_Surface_Format`, `transcoCategSupport` |
| **E. Utilisateurs / droits** | 4 | `tr_utilisateur`, `tr_utilisateur_data`, `tr_utilisateur_menu`, `tr_profil` |
| **F. Historique / audit / logs applicatifs** | 8 | `histo_historique_entite`, `histo_action_applicative`, `tr_type_entite`, `histo_preparation`, `histo_trainAffiche`, `th_repart_annule`, `tt_log`, `tt_batch` |
| **G. Journaux d'interface AMT (anciens)** | 12 | `th_amt_log_{destination,instruc_det,instruction,repart,statut_repart,train}`, `tra_amt_log_{instruc_det,instruction,statut_repart,train}`, `tw_amt_log_{destination,repart}` |
| **H. Archives / sauvegardes** | 6 | `ARCH_tf_colis`, `ARCH_tf_face_train`, `ARCH_tf_repart_calcul`, `ARCH_Tf_UM`, `ARCH_tf_UM_colis`, `tf_repart_calcul_svg` |
| **I. Temporaires / technique** | 7 | `tmp_instruction_train`, `tmp_tf_colis`, `tmp_tr_dest_adresse`, `tmp_tr_destinataire`, `tmp_tr_transporteur`, `tmp_tr_transporteur_atelier`, `Parametre_Package` |
| **Total** | **116** | |

Vue : `v_support_scrolling` = `tr_categorie_support` filtrée sur `sup_id in (26,1026,1027)` (supports déroulants, **ID codés en dur**).

---

## 2. Tables clés Réception — description et cardinalités

Convention : « n » = plusieurs, FK = contrainte réelle dans le SQL réel, « sans FK » = lien logique non protégé.

### 2.1 `affiche` (une affiche = un lot reçu d'un visuel pour une plateforme)
- PK `affiche_id` int identity. FK : `plt_id`→`tr_plateforme` (tinyint NOT NULL), `sup_id`→`tr_categorie_support` (smallint NOT NULL), `photo_id`→`photo` (NULL).
- Colonnes d'identité métier : `cont_num` **varchar(50)** (n° de dossier, en texte), `cont_annonc`, `theme`, `repiquage`, `quantite` (NOT NULL), `conservation` (int NOT NULL), `date_entree` (NOT NULL), `date_dernier_depart`, `date_derniere_sortie`, `allee`, `rayon`, `semaines` (varchar(200), liste de semaines **en texte**), `nombre_semaine`.
- **Pas de colonne statut.** L'état est porté par des drapeaux bit NULLables : `rebus` (+`date_rebus`), `zone_Picking`, `a_conserver`, `est_fusionne`, `validationAdmin`, `envoye`. L'enum C# `StatutAffiche` (ReceptionAttendu, Receptionnee, Picking) n'existe **que dans le code**.
- Cardinalités : 1 affiche → n `mouvement` (FK), n `asso_livraison_affiche` (FK, 2 FK : affiche reçue et affiche « initiale »), 0..1 `tf_prepa_affiche` via `affiche_livraison_Id` (FK ; **une affiche au plus par ligne**), n `Activite` (FK, 2 FK), n `tf_dossier_semaine_depart` (FK), n `fusion_affiche` (FK ×2 : chapeau / fille).

### 2.2 `livraison` + `asso_livraison_affiche` + `asso_livraison_photo` + `photo`
- `livraison` (BL) : `DateLivraison`, `Expediteur`, `Imprimeur`, `Reference`, `Nbre_colis`, `Ref_dossier`, `Ref_DA`, `Decharge_par`, `Commentaire`. Colonnes tout en texte libre, **aucune FK sortante, aucun champ de statut ni de plateforme**.
- `asso_livraison_affiche` : n–n livraison ↔ affiche (`Id_livraison`, `Id_affiche_livraison`, `id_affiche_initial_livraison`, `NumeroLivraison`). Trois FK.
- `photo` : image stockée en base (`varbinary(max)`), 1 photo → n affiches (FK `affiche.photo_id`), liée aux livraisons par `asso_livraison_photo` (n–n, `intitule`).
- `mouvement` : entrées d'une affiche (`affiche_id` FK, `quantite`, `recepisse`, `expediteur`, `comptee`, `livraison_id` FK, `IdActivite` FK, `id_affiche_initial` FK). 1 affiche → n mouvements.

### 2.3 `tf_prepa_affiche` = « réceptions attendues » (cœur du rapprochement)
- Colonnes : `plt_id` int, `sup_id` int, `cont_num` int, `Format`, `rpc_annonceur`, `rpc_num_aff_amt`, `rpc_theme`, `repiquage`, `Qte_Theorique`, `sem_num`, `sem_annee`, `FromBroadcast` bit, `ARecevoir` bit, `Statut` **varchar(50) libre**, `IdDAChapeau`, `ate_id`, `affiche_livraison_Id`, `affiche_livraison_initial_Id`, `dateCreated/Modified`.
- Seules FK : `affiche_livraison_Id` et `affiche_livraison_initial_Id` → `affiche`. **`plt_id`, `sup_id`, `ate_id`, `cont_num` sans FK.** Aucune clé métier unique (confirmé par la doc cible, `receptions_attendues_doublons_tables_regles.html` §7).
- Alimentée par `p_Alimentation_tf_prepa_affiche` (3 sources : `tf_repart_calcul`, `tf_face_train`, `tf_prepa_Broadcast`) sur une fenêtre semaine courante → +8 semaines. Rapprochement **par textes** (thème, annonceur, format, nom de plateforme par `LIKE`).
- `tf_prepa_Broadcast` : copie brute de l'état des réservations Broadcast (`StatutPreparation` varchar : valeur `'Envoyé'` exclue ; exclusion en dur de `'Plateforme Derichebourg'`/`'… Lyon'`).

### 2.4 Autres
- `fusion_affiche` : (`id_affiche_chapeau`, `id_affiche`) 2 FK ; `qui_creation` varchar(max).
- `tf_dossier_semaine_depart` : (`IdAffiche` FK, `Dossier`, `Semaine`, `Annee`) ; 1 affiche → n semaines de départ (doublonne la colonne texte `affiche.semaines`).
- `Activite` / `Equipe` / `Machine` : production par plateforme ; `Activite` (`IdEquipe`, `IdMachine`, `IdAffiche`, `id_affiche_initial` : 4 FK, `Quantite`, `Rebus`, `DateProduction`).

---

## 3. Tables clés Coordination — description et cardinalités

| Table | Rôle | Clés / cardinalités | Statut |
|---|---|---|---|
| `instruction_train` | Instruction (dossier × semaine contractuelle) venant de Broadcast | PK `instr_code` varchar(18). FK : `ate_id`, `tip_ins_code`→`tr_instruction_plus`, `tsr_repart_code`→`tr_statut_repart`, `rpc_statut`→`tr_statut`. Champs : `cont_num`, `cont_sembas`, `cont_anbas`, `instr_entretien`, `Conservation`, `CoteCote`, `instr_commentaire` | `rpc_statut` (0–10) |
| `instruction_detail` | Lignes de visuel d'une instruction (n par instr_code) | PK `insd_id`. FK seulement `tpr_id`. **`instr_code` sans FK** | — |
| `instruction_visuels` | Visuels d'une instruction avec pourcentage (`insv_pourcentage`, `_ori`) | PK `insv_id`. FK `instr_code`, `sup_id`, `tpr_id`, `rpc_statut` | `rpc_statut` |
| `tf_face_train` | Face d'un train (1 face = 1 affiche à poser) | PK `ft_id`. 80 colonnes. FK `dest_id` (**3 FK redondantes** sur la même colonne), `rpc_statut`, `ate_id`, `sup_id`, `rouleur_id`, `colis_id`, `IdJourDepart`. **`instr_code` sans FK** | `rpc_statut` ; `ft_type` ('entretien'…) ; `version` tinyint |
| `tf_repart_calcul` | Répartition calculée (quantité par destinataire × atelier × semaine) | PK `rpc_id` numeric(9). FK `sup_id`, `ate_id`, `soc_id`, `tpr_id`, `act_id`, `UM_id`, `dest_id`, `rpc_statut`, (`des_id`,`des_type`,`des_type_adr`)→`tr_destination` | `rpc_statut` ; `rpc_retire` char(1) ; `rpc_san_rep` char(1) ; `rpc_tms` timestamp |
| `tf_UM` | Unité de manutention (carton/palette) | PK `UM_id`. FK `ate_id`, `sup_id`, `rpc_statut`, `tpr_id`. 1 UM → n `tf_repart_calcul`, n `tf_UM_colis` | `rpc_statut` |
| `tf_colis` | Colis expédié | PK `colis_id`. FK `ate_id`, `adr_id`, `dest_id`, `fc_col_id`, `rpc_statut`, (`tsp_id`,`tarif_code`) | `rpc_statut` ; `Mailcolis_envoye` bit |
| `tf_UM_colis` | n–n UM ↔ colis | FK `UM_id`, `colis_id` | — |
| `tf_colis_ext` | Suivi transporteur (Zoom/Geodis) par `refUniExp` | PK `refUniExp` bigint ; **pas de FK vers `tf_colis`** (lien par `tf_colis.ref_uni_exp`) | `libelleEtat` texte |
| `trav_*` | Tables de travail d'intégration depuis Broadcast (`insertTrav*` / `purgeTrav*`), **sans FK ni PK** (sauf `trav_groupePreparation`, `trav_preparationDetail`, `trav_theme`) | alimentent `p_integ_preparation`, `p_integ_instructions`, `p_integ_train_affiches` | `rpc_statut` ; `IdReferentielStatutPreparation` (133 = valeur « active » codée en dur dans `p_integ_preparation`) |

---

## 4. Colonnes de statut et valeurs

### 4.1 `rpc_statut` (tinyint) — `tr_statut(rpc_statut, statut_nom)`
FK vers `tr_statut` depuis : `instruction_train`, `instruction_visuels`, `tf_face_train`, `tf_repart_calcul`, `tf_UM`, `tf_colis`. Pas de FK depuis `trav_*`, `histo_*`, `ARCH_*`.
**Le contenu de `tr_statut` n'est pas dans le script** (aucun INSERT dans `BDD/DATA`, cf. REVIEW §3.3). Valeurs lues dans le code C# (`Enums.cs: StatutPreparation / StatutPreparationIds`) :

| Code | Libellé | Observé dans les procédures |
|---|---|---|
| 0 | A traiter | `p_u_statut_preparation` (retour arrière autorisé) ; reset à 0 des intégrations |
| 1 | En cours | `p_batch_auto_instruction_ok` (candidats) ; remise à 1 si statut 3 |
| 2 | Instruction OK | `p_batch_auto_instruction_ok` ; déclenche `p_u_associe_train` |
| 3 | Erreur | repassé à 1 dans `p_integ_*` |
| 4 | Annulé | exclu de `p_Alimentation_tf_prepa_affiche` (`rpc_statut <> 4`) |
| 5 | A imprimer | protégé (`rpc_statut <> 5`) dans `p_u_statut_preparation` |
| 6 | Préparé | — |
| 7 | A expédier | colis ; `p_batch_fin_journee_colis` : colis 7 → UM/trains 8 |
| 8 | Terminé | idem ; `p_integ_preparation` met aussi 8 |
| 9 | Export prépa | `p_u_exportTheme` |
| 10 | Au roulage | `p_u_exportTheme` (REVIEW §2.18) |

**Aucune table de transitions** : les transitions sont dispersées dans les procédures (ci-dessus) et dans le C#. Pour V2 : table de transitions explicite (règle projet).

### 4.2 Autres colonnes de statut
| Colonne | Table | Valeurs connues |
|---|---|---|
| `tsr_repart_code` / `tr_statut_repart` | `instruction_train` | libellés absents du script (alimentés par l'interface AMT : `p_integ_ptf_statut_repart`) ; valeur 0 = initial |
| `tr_statut_colis(Id, Libelle, Ordre)` | aucune FK entrante | **table orpheline** (aucun usage C# ; `tf_colis.libelle_etat` est du texte libre venant du transporteur) |
| `tf_prepa_affiche.Statut` varchar(50) | réceptions attendues | valeurs non contraintes, non documentées |
| `tf_prepa_Broadcast.StatutPreparation` / `PreparationExterne.LibelleStatutPreparation` | textes libres | `'Envoyé'` exclu de l'alimentation |
| `affiche` : `rebus`, `zone_Picking`, `a_conserver`, `est_fusionne`, `validationAdmin`, `envoye` | drapeaux bit NULL | NULL traité comme 0 par le C#, **pas par certaines procédures** (REVIEW §2.1) |
| `tf_colis_ext.estConnu`, `tf_colis.Mailcolis_envoye` | bit | — |
| `tf_face_train.ft_type` | varchar(15) | `'entretien'` (autres valeurs non extraites) |
| `TypePreparation` code C# | `TypeDePreparation` : 2M2FIXE, PLIAGE, DEROULANT, AUTRES, BUS | libellés applicatifs, pas en base |
| `tr_atelier.ate_type` | tinyint | 1 = Fixe, 2 = Scroll (`AtelierType`) ; ateliers 1..8 = Wissous/Nîmes × 2M2 fixe / pliage 12M2 / 2M2 déroulant / 8M2 déroulant |

### 4.3 Statuts cibles (non persistés aujourd'hui) — `process_reception_statuts_actions.html`
Ligne attendue : **Attendue, Partielle, À contrôler, Complète, Surplus, Contrôlée**. Affiche : **À identifier, Rattachée à contrôler, Introuvable (alerte Pré-Prod), Orpheline, Complément, Feuille à refaire, Contrôlée, Rattachée feuille définitive**. Aucun n'existe comme colonne : à calculer ou à persister (cf. §9).

---

## 5. Historique / audit

| Table | Contenu | Remarque |
|---|---|---|
| `histo_historique_entite` | Journal générique : `IdActionApplicative` (FK), `IdTypeEntite` (FK), `IdEntite`, `AncienneValeur`, `NouvelleValeur`, `Complement`, `JsonData`, `QuiAction`, `DateAction` | Alimenté par le C# (`HistorisationBll`). **Seul vrai journal d'audit.** |
| `histo_action_applicative` | Référentiel des actions : codes C# 1..16 (CreationAffiche, ModificationDossier/Semaine/Annonceur/Theme/Format, ModificationValidationAdmin, ModificationAfficherAConserver, AfficheMiseEnRebus, AfficheAssocier/Dissocier, ViderRebus, ChangementStatutInstruction, ModificationInstructionPlus, ExporterTrains, DebloquerPreparation) | Pas de données dans `BDD/DATA` |
| `tr_type_entite` | 1 Affiche, 2 Instruction, 3 Trains, 4 IdDossier (enum C#) | Pas de données dans `BDD/DATA` ; **la FK de `histo_historique_entite` échoue sur base neuve** (REVIEW §3.3) |
| `histo_preparation`, `histo_trainAffiche` | Archivage des `trav_*` avant purge | Sans PK ni FK |
| `th_repart_annule` | Répartitions annulées/débloquées (`p_i_th_repart_annule`, `p_s_th_repart_annule`) | Utilisé par AdminSuiviDeblocage |
| `tt_log` / `tt_batch` | Log technique des procédures / état des batchs | `tt_log` mappé EF ; `tt_batch` via `p_s_batch`/`p_u_batch` |
| `th_amt_log_*`, `tra_amt_log_*`, `tw_amt_log_*` (12) | Journaux de l'ancienne interface AMT | `tra_amt_log_instruction(_det)` encore alimentées par `BatchAlimRepository.cs:318,332` ; les autres ne sont référencées que par les procédures `p_integ_ptf_*` (ancien chemin) |
| `ARCH_*` (5) | Archives 3 ans (`p_archivage_*`) | `tf_repart_calcul` **non archivée** (REVIEW §1.2) ; PK `ARCH_tf_UM`/`ARCH_Tf_UM` différant par la casse |

**Absence d'historique de statut** pour les entités de coordination : `rpc_statut` est écrasé, sans table d'historique (seules `ft_user_maj`, `UM_user`, `instr_user`, `*_dat_maj`). La règle projet « chaque changement de statut écrit un historique » n'a pas d'existant à reprendre sauf `histo_historique_entite` (`ChangementStatutInstruction`).

## 6. Tables de référence

Référentiels alimentés/administrés : `tr_plateforme` (id_site_ccf = lien Broadcast), `tr_atelier`, `tr_atelier_droit_prepa` (UNIQUE, exclusion/inclusion par type de prépa et surface), `tr_categorie_support` (= format/support ; `sup_bandeaux`, `sup_qte_UM`, `reception` bit), `Surface`, `tr_type_preparation` **et** `TypePreparation` (deux tables, la seconde avec FK vers la première + `IdCategoriePreparation` DEFAULT 1), `tr_instruction_plus` (0 Standard, 1 début, 2 fin, 3 fin-1, 4 milieu de train), `tr_jour_depart`, `tr_parametre_alternance` (paramètres inclusion/exclusion de déblocage), `tr_format_colis` (1 Carton, 2 Palette, 3 Vrac, 4 Sachet, 5 À définir), `tr_type_adresse` (STANDARD/URGENTE/AUTRE), `tr_destinataire`/`tr_destination`/`tr_dest_adresse`, `tr_transporteur*`, `tr_agence_geodis`, `tr_profil` + `tr_utilisateur*`.
**Profils (`tr_profil`)** : valeurs non présentes ni dans le script ni dans le C# (seul `prf_id` est lu). **À extraire de la prod** ; à défaut, la CLAUDE.md autorise des rôles provisoires.

---

## 7. Écarts SQL réel ↔ repo (`BDD/DATABASE`) ↔ code

### 7.1 SQL réel ↔ projet SSDT
| # | Écart | Gravité |
|---|---|---|
| E1 | `tf_evenement` : fichier **vide** dans le repo (référencé `Build Include` dans `DATABASE.sqlproj:201`), **absente du SQL réel**. Son seul usage est un trigger `t_iud_UM` **commenté** dans `tf_UM.sql`. Table morte ; le build SSDT crée-t-il une table vide ? À vérifier | Moyenne |
| E2 | Tables : 117 (repo) vs 116 (réel) = E1. Les 116 autres noms concordent (comparaison par noms, pas colonne à colonne) | — |
| E3 | Procédures : 127 (repo) vs 126 (réel). 1 fichier en trop côté repo, non identifié (ex. `GetErrorInfo Proc.sql` ↔ `p_GetErrorInfo` : nom différent). Comparaison corps-à-corps à faire | Faible |
| E4 | **Index** : 19 dans le repo, 0 dans le script réel (export sans index) | À confirmer |
| E5 | `p_batch_auto_instruction_ok` : REVIEW §3.6 dit « non référencée dans le sqlproj » ; **elle est maintenant référencée (`DATABASE.sqlproj:380`) et présente dans le SQL réel** → la revue est périmée sur ce point ; la procédure est déployée | Info |
| E6 | `Parametre_Package` : aucune PK (confirmé) | Faible |
| E7 | `Surface`, `tr_atelier_droit_prepa.IdSurface` : FK présentes ; `Surface` sans données connues | Info |

### 7.2 Schéma ↔ EF (`CIRCE.edmx`)
- 65 entity sets / 116 tables. **Non mappées** (accès par procédures, SSIS ou jamais) : `ARCH_*`, `histo_preparation`, `histo_trainAffiche`, `Parametre_Package`, `Surface`, `tf_anomalies`, `tf_repart_calcul_svg`, `th_*`, `tmp_*`, `tr_activite`, `tr_atelier_support`, `tr_commune`, `tr_societe`, `tr_statut_colis`, `tr_train_convention_a_trier`, `tr_typ_aff_amt`, `tr_type_anomalie`, `tra_*`, `trav_*`, `tt_batch`, `tw_*`.
- `affiche` : le mapping EF contient toutes les colonnes du schéma réel (dont `est_fusionne`, `semaines`, `nombre_semaine`). Comparaison fine des autres tables **non faite**.

### 7.3 Tables sans usage C# (grep `.cs/.cshtml/.dtsx/.sql`, hors SSIS binaire non lu)
`tr_statut_colis`, `tr_societe` (FK depuis `tf_repart_calcul`, alimentée à l'intégration), `tr_atelier_support`, `tr_commune`, `tf_anomalies`, `tr_type_anomalie`, `tr_typ_aff_amt`, `tr_train_convention_a_trier`, `tr_activite` (via `p_s_listeActivite`), `tf_repart_calcul_svg`, `Transaco_Surface_Format`, `transcoCategSupport` (mappées EF, usage C# non recoupé), `th_amt_log_*`, `tw_amt_log_*`, `tra_amt_log_statut_repart`, `tra_amt_log_train`. **À valider avec la DSI avant tout abandon.**
`Fn_GetPrepaAffiche` : aucune référence dans les `.cs` (EF function import ? à vérifier dans l'edmx) alors que la doc cible l'appelle « écran des attendues ».

### 7.4 Colonnes / objets utilisés dans le code mais absents du schéma
Aucun constat bloquant à ce stade (grep partiel). Constats de signature : `p_archivage_allTables` appelle `p_archivage_tf_repart_calcul` avec un paramètre inexistant (REVIEW §1.2) ; `p_s_atelierScro` code en dur `ate_id in (5,6,7,8,11,12)` alors que `tr_atelier` n'a pas de données ateliers 11/12 dans l'enum C# (ateliers 9..12 = pliage/4m² non listés dans `Ateliers`) ; `v_support_scrolling` code `26,1026,1027`.

### 7.5 Écarts schéma ↔ specs (docs-sources)
| Spec (doc cible) | Schéma réel |
|---|---|
| Une seule ligne attendue par dossier × plateforme × format × thème × bandeau × semaine ; index unique | Aucune clé métier ni index unique sur `tf_prepa_affiche` |
| Statut ligne `ACTIVE/ANNULEE`, `source BC/PREPA`, `qte_bc`/`qte_prepa`, `date_vue_bc` | `FromBroadcast` bit ambigu, `Statut` varchar libre, une seule quantité |
| Table `asso_affiche_visuel` (lien affiche ↔ ligne, **avec quantité**, actif, créé/retiré par/le) | Lien 1–1 sans quantité : `tf_prepa_affiche.affiche_livraison_Id` |
| Table `tf_edr_rapprochement` (déplacements proposés) | N'existe pas |
| `affiche.validationAdmin_par/_le`, `mode_rattachement` | Seulement `validationAdmin` bit (qui/quand via `histo_historique_entite`) |
| `tf_prepa_Broadcast` : garder `IdSiteCCF`, `IdSurface`, `IdFormat`, `IdPreparationChapeau`, `IdTypePreparation`, `EstResteEnPlace`, `date_vue`, + `IdTheme` (demandé à Broadcast) | Colonnes jetées ; rapprochement par texte |

---

## 8. Procédures stockées portant des règles métier

(126 au total ; les 20 plus importantes ; les `p_s_*` de lecture simple non listées.)

| Procédure | Rôle / règle |
|---|---|
| `p_Alimentation_tf_prepa_affiche` | Fabrique les réceptions attendues (3 sources, fenêtre S0→S+8, exclusion `rpc_statut=4`, `'Envoyé'`, 2 plateformes en dur). Sources de doublons (MERGE inopérant, jointure sans `ate_id`) |
| `p_integ_preparation` / `p_integ_instructions` / `p_integ_train_affiches` / `p_integ_destinataire` / `p_integ_deroulants` | Intégration Broadcast (préparations, instructions, trains, destinataires/adresses) ; statut 133 actif ; annulation (`rpc_statut=4`) ; instructions et trains **ignorés** si statut 2 ou 5 (« piège actuel », Q60 de la doc cible) |
| `p_batch_auto_instruction_ok` | **RG1–RG6** : passage auto à « Instruction OK » (En cours + commentaire vide + quantité attendue = reçue + normalisation des % de format, ligne « Sans affiche »), user `BATCH_AUTO_INSTR_OK`, transaction |
| `p_u_associe_train` | Passage 2 : associe faces/trains à l'instruction, crée les entretiens (arrondi 8 %, convention `VPS_75 101 0004` en dur) |
| `p_u_statut_preparation` | Retours de statut autorisés (0,1,5,4) avec purge entretiens et remise à blanc des faces ; 2 → `p_u_associe_train` |
| `p_u_statut_repart_deblocage`, `p_i_th_repart_annule`, `p_s_th_repart_annule` | Déblocage de préparation + trace (`regles-inclusion-exclusion-deblocage.md`, `tr_parametre_alternance`) |
| `p_u_exportTheme`, `p_s_face_train_export_caire` | Export CAIRE (top 20 thèmes/machine, statuts 9/10) ; `QteMaxThemeMachineCaire=20` |
| `p_u_duplication_train` | Duplication de train (colonnes manquantes, REVIEW §2.15) |
| `p_batch_fin_journee_colis` | Colis 7 (A expédier) → UM et faces au statut 8 (Terminé) |
| `p_u_statut_colis_UM`, `p_u_expedie_Colis`, `p_u_poidsColis`, `p_u_detail_colis`, `p_updateColisTransporteur`, `P_GetGlobalColisForSend`, `p_s_colis*` | Cycle de vie colis / UM, poids, expédition, intégration du suivi transporteur (CP expéditeur erroné, REVIEW §2.10), envoi mails |
| `p_GetListeAffiche`, `…ATraiter`, `…Rebus`, `…Fusionnees`, `…ParDossierReservation`, `p_GetListeReceptionAffiche`, `p_GetDataReceptionOrpheline` | **Onglets de l'écran Réception** : « statut » d'une affiche calculé par filtres (`rebus`, `zone_Picking`, `est_fusionne`, `a_conserver`) ; bugs REVIEW §2.2, 2.5, 2.6, 2.9 |
| `p_s_destruction`, `p_s_affiche_a_fusionner` | Destruction (rebus) et candidats à fusion (calcul de dernière semaine faux, REVIEW §2.1/2.4) |
| `p_GetPrepareListAffiches`, `p_GetPrepareListLivraison`, `Fn_GetPrepaAffiche` | Écrans de rattachement affiche ↔ attendue (doublons de lignes, REVIEW §2.7/2.8) |
| `p_s_adminSuiviRead` | Suivi de production par jointure texte |
| `p_valid_amt_reparts`, `p_integ_ptf_*` (10) | Ancien chemin d'intégration AMT (probablement hérité, format `instr_code` obsolète, REVIEW §3.7) |
| `p_archivage_*` (6), `p_d_purge_histo`, `purgeTrav*` (3) | Archivage 3 ans / purges |
| `p_batch`, `p_s_batch`, `p_u_batch` | Orchestration et état des batchs (`tt_batch`) |
| `P_UpdateAllLoginMigration` | Migration de logins (tronqués, REVIEW §3.4) |

**Toute règle ci-dessus est à rattacher à un RG** lors du croisement avec `legacy-*.md`.

---

## 9. Proposition de modèle cible (préliminaire)

Principes : conserver les noms métier existants quand cela facilite la migration/recette ; Prisma/PostgreSQL ; `version` (verrou optimiste) et statut + historique sur chaque entité à statut. Aucune source projet (EX/RG) n'existant encore, la colonne « Source » renvoie aux documents.

### 9.1 Conservées (reprises quasi à l'identique)
| Table | Justification | Source |
|---|---|---|
| `tr_plateforme`, `tr_atelier`, `tr_categorie_support`, `Surface`, `tr_type_preparation` (fusionner `TypePreparation`), `tr_statut` (+ données), `tr_instruction_plus`, `tr_jour_depart`, `tr_format_colis`, `tr_type_adresse`, `tr_destinataire`/`tr_destination`/`tr_dest_adresse`, `tr_transporteur*`, `tr_atelier_droit_prepa`, `tr_parametre_alternance` | Référentiels vivants, FK réelles | EDMX, code |
| `affiche`, `livraison`, `mouvement`, `photo`, `asso_livraison_photo`, `fusion_affiche`, `tf_dossier_semaine_depart` | Socle Réception | `process_reception_statuts_actions.html` |
| `instruction_train`, `instruction_visuels`, `tf_face_train`, `tf_repart_calcul`, `tf_UM`, `tf_UM_colis`, `tf_colis`, `tf_colis_ext` | Socle Coordination / colisage (périmètre « Réception + Coordination » ; colisage selon décision) | code |
| `histo_historique_entite`, `histo_action_applicative`, `tr_type_entite`, `tr_utilisateur*`, `tr_profil` | Audit et droits | code |

### 9.2 Modifiées
| Table | Modification | Justification | Source |
|---|---|---|---|
| `tf_prepa_affiche` | + `source` (BC/PREPA, remplace `FromBroadcast`), `etat_ligne` (ACTIVE/ANNULEE), `qte_bc`, `qte_prepa`, `IdThemeBandeau`, `date_vue_bc` ; FK `plt_id`, `sup_id`, `ate_id` ; types alignés (`plt_id` smallint) ; **index unique partiel** (plateforme × dossier × support × thème × bandeau × semaine, lignes ACTIVE) ; second index pour lignes sans thème ; statut typé | Supprimer les doublons, sans suppression de lignes portant une affiche | `receptions_attendues_doublons_tables_regles.html` §4 (RG-AT-04/05) |
| `tf_prepa_Broadcast` | + `IdSiteCCF`, `IdSurface`, `IdFormat`, `IdPreparationChapeau`, `IdTypePreparation`, `EstResteEnPlace`, `date_vue`, `IdTheme` (si Broadcast le fournit) | Rapprochement par identifiants | idem |
| `affiche` | + `validationAdmin_par/_le`, `mode_rattachement`, **colonne `statut` (enum)** et `version` ; `cont_num` en entier ; supprimer `semaines`/`nombre_semaine` (dérivés de `tf_dossier_semaine_depart`) ; bits NOT NULL DEFAULT false ; index (`plt_id`,`quantite`) | Drapeaux NULL incohérents, texte multi-valeurs, verrou optimiste | doc cible RG-VA-04 ; REVIEW §2.1/2.4 |
| `livraison` | + `plt_id`, `statut`, `version`, `Reference` unique par plateforme (si règle confirmée) | BL sans plateforme ni statut | **Q à créer** |
| `instruction_train`, `tf_face_train`, `tf_repart_calcul`, `tf_UM`, `tf_colis` | `rpc_statut` → enum typé + table de transitions + `version` ; FK `tf_face_train.instr_code`, `instruction_detail.instr_code` ; PK `instruction_train` à revoir (voir §10) ; supprimer FK redondantes | Machine d'états, intégrité | CLAUDE.md §6 |
| `tf_colis` | Retirer les colonnes dupliquées de `tf_colis_ext` (`ref_uni_*`, `adresse_*_exp`, `libelle_etat`, `url_*`…) → FK `tf_colis_ext.refUniExp` | Doublon de données | schéma |

### 9.3 Ajoutées
| Table | Contenu | Source |
|---|---|---|
| `asso_affiche_visuel` | affiche ↔ ligne attendue (ou visuel) + **quantité**, actif, créé/retiré le/par | doc cible RG-AT-04/08 (MLD cible du 21/10) |
| `tf_edr_rapprochement` | déplacements de liens proposés/confirmés | idem |
| `statut_historique` (ou `histo_statut_entite`) | (type d'entité, id, ancien, nouveau, par, le, motif) pour chaque transition | CLAUDE.md §6 ; extension du `histo_historique_entite` |
| `idempotency_key` | clés d'idempotence des POST | CLAUDE.md §6 |
| `transition_statut` (référentiel) | table de transitions explicite | CLAUDE.md §6 |
| Référentiel profils/droits | à définir après extraction des profils | CLAUDE.md §8 (à valider) |

### 9.4 Candidates à abandon (NE PAS supprimer sans validation)
`tf_evenement` (vide), `tmp_*` (6), `tf_repart_calcul_svg`, `ARCH_*` (5 → remplacées par une stratégie d'archivage), `th_amt_log_*`/`tw_amt_log_*`/`tra_amt_log_*` (12), `tr_statut_colis`, `tf_anomalies`/`tr_type_anomalie`, `tr_societe`, `tr_atelier_support`, `tr_commune`, `tr_typ_aff_amt`, `tr_train_convention_a_trier`, `Parametre_Package`, `trav_*` (remplacées par l'import API), `histo_preparation`/`histo_trainAffiche`, vue `v_support_scrolling` (→ drapeau `est_deroulant` sur `tr_categorie_support`).

---

## 10. Points de vigilance

### Données legacy probablement incohérentes
1. **Doublons dans `tf_prepa_affiche`** (aucun index unique, MERGE inopérant) : dédoublonnage préalable obligatoire (garder la ligne portant une affiche, reporter le lien, annuler les autres).
2. `affiche` : drapeaux NULL/0/1 mélangés ; `semaines` texte vs `tf_dossier_semaine_depart` ; `cont_num` varchar vs int ailleurs (jointures par conversion implicite) ; `plt_id` renvoyé = `sup_id` (REVIEW §2.5) ; affiches détruites (`rebus`) toujours `a_conserver`.
3. Quantités du bandeau multipliées (jointure sans `ate_id`, REVIEW §2.3).
4. `instruction_train` : **PK = `instr_code` seul**, alors que le commentaire de `p_batch_auto_instruction_ok` dit « `instruction_train` a un `ate_id` → plusieurs lignes par `instr_code` ». Contradiction à lever (lecture de la prod).
5. `tr_statut`, `tr_statut_repart`, `tr_type_entite`, `histo_action_applicative`, `tr_profil` **sans jeu de données dans le repo** : indispensables pour le seed (`pnpm seed:ref`) ; à extraire de la prod.
6. Doublons de FK sur `tf_face_train.dest_id` (3 FK mal nommées, dont `FK_TF_UM_REFERENCE…`) : héritage de copier-coller.
7. Troncatures : `rpc_user` varchar(30) → varchar(20) (archive), `pers_nom` 50 vs annonceur 250, `tf_colis_ext` 50 vs log 1000 (REVIEW §2.11/2.16).
8. Semaines : `DATEPART(wk)` (non ISO) mélangé à `ISO_WEEK` ; année 52 semaines codée en dur ; `@@DATEFIRST` non neutralisé. **Migration vers semaines ISO obligatoire** (la doc cible l'exige).
9. Codes en dur : `sup_id in (26,1026,1027)`, `ate_id in (5,6,7,8,11,12)`, `IdReferentielStatutPreparation = 133`, `'Plateforme Derichebourg'`, `'Sans affiche'`, convention `VPS_75 101 0004`.
10. `tr_utilisateur.loginWindows` (identité Windows/AD) : l'authentification V2 est à décider (question à créer).

### Contraintes absentes à ajouter
- FK : `tf_prepa_affiche.{plt_id,sup_id,ate_id}`, `tf_face_train.instr_code`, `instruction_detail.instr_code`, `tf_colis_ext`↔`tf_colis`, `livraison` ↔ plateforme.
- Unicité : réceptions attendues (cf. §9.2), `livraison.Reference`, `tr_utilisateur` (déjà PK), `tf_UM.UM_code_barre`, `tf_colis.colis_code`.
- NOT NULL / DEFAULT sur drapeaux bit ; CHECK sur `rpc_statut`, `quantite >= 0`, `sem_num between 1 and 53`.
- PK sur `Parametre_Package`, `trav_*`, `histo_*`.
- Versionnement (`version`) sur toutes les entités à statut ; `rpc_tms timestamp` existant n'est utilisé que sur `tf_repart_calcul`.

### À NE PAS faire sans validation
- Supprimer les tables du §9.4 (usage SSIS/batchs externes non vérifié ; `BDD/SSIS_Circe` non analysé ; Zoom/PEX/Sybase lisent ou écrivent peut-être certaines tables).
- Reproduire les bugs de procédures (REVIEW §2) : ils reflètent la prod actuelle ; chaque cas est un **ECART/Q** à trancher (ne pas « corriger en silence »).
- Convertir les statuts texte/numériques existants sans table de correspondance validée.
- Migrer `photo.image_file` (varbinary) : volume inconnu, stratégie de stockage à décider.

### Questions à ouvrir (proposition pour `QUESTIONS_OUVERTES.md`)
Q-a : contenu de `tr_statut`, `tr_statut_repart`, `tr_profil` en prod. Q-b : index réels en prod. Q-c : PK réelle de `instruction_train`. Q-d : tables G/H/I réellement utilisées (SSIS, batchs externes). Q-e : périmètre colisage/expédition dans la V2 (tables C). Q-f : statut persisté ou calculé pour affiche / ligne attendue. Q-g : authentification des utilisateurs. Q-h : volume et stockage des `photo`.

### Reste à faire
- Croiser avec `legacy-*.md` et `specs-*.md` dès leur production (tables ↔ EX/RG).
- Comparaison colonne à colonne SQL réel ↔ SSDT ↔ EDMX pour les 116 tables (seules les clés/colonnes de `affiche`, `tf_UM` ont été comparées).
- Lecture des procédures `p_integ_*`, `p_u_associe_train`, `p_s_adminSuiviRead` en détail pour extraire les RG.
