# Analyse de l'architecture existante (circe-develop)

Synthèse de l'étape 1b. Sources : `docs/_travail/inventaire.md`, `legacy-reception.md`, `legacy-coordination.md`, `legacy-repartition-production.md`, `legacy-integrations.md`, `legacy-admin.md`, `bdd.md`, vérifications ponctuelles dans `circe-develop/` (lecture seule). Les identifiants RG-xxx cités entre parenthèses sont des numéros PROVISOIRES des notes d'analyse (voir BRIEF) ; les questions sont dans `docs/QUESTIONS_OUVERTES.md` (Q-001…Q-010, Q-3xx). Aucun secret n'est recopié.

## 1. Vue d'ensemble

### 1.1 Technologies et versions (constats)
| Élément | Constat | Source |
|---|---|---|
| Application web | ASP.NET MVC (README : « MVC 5 ») + Razor (216 `.cshtml`), 47 contrôleurs, grilles Telerik Kendo UI MVC (`DataSourceRequest`, assembly `Kendo.Mvc`) ; un `packages.config` référence pourtant `Microsoft.AspNet.Mvc 4.0.20710.0` : version MVC exacte à vérifier | `README.md`, `ClearChannel.CIRCE.Web.csproj`, `*/packages.config` |
| Framework | .NET Framework 4.5.2 (tous les projets), 4.6.1 pour le projet de tests ; `Web.config` `targetFramework` 4.5 / 4.5.2 | `*.csproj` (`TargetFrameworkVersion`), `Web.config` |
| Accès données | Entity Framework 6.1.2 (EDMX : `CIRCE.edmx`, `INTERFACE.edmx`, `EXTPLAY.edmx` ; 65 entity sets pour 116 tables côté CIRCE) + appels de procédures stockées ; un `packages.config` référence aussi EF 5.0.0 | `bdd.md` §0 et §7.2 ; `packages.config` |
| Base | SQL Server (116 tables, 126 procédures, 1 fonction, 1 vue, 46 types, 0 trigger dans le script réel du 03/11/2026) ; projet SSDT `BDD/DATABASE` (117 tables, 127 procédures) | `bdd.md` §0 |
| ETL | SSIS : `Flux_Repartition_Amt_Ptf.dtsx` (source Sybase AMT) | `legacy-integrations.md` RG-INT-041 |
| Rapports / impression | RDLC (ReportViewer) : 32 `.rdlc` dans `Reports/` + 2 dans `BatchEdition`, rendus côté serveur en PDF/EMF ; impression directe sur imprimantes serveur | `legacy-admin.md` RG-ADM-060 |
| Front | jQuery, jQuery UI, Bootstrap, Kendo ; JS de site `Scripts/site/*.js` ABSENTS du dépôt fourni (sauf `JS/LivraisonListeAffiche.js` lu partiellement) | `legacy-reception.md` zones non analysées n°1 |
| Résilience / divers | Polly 5.0.3 (relances batchs), ConfigCat.Client 9.5.0 (feature flags `PastillePrepaBus`, `IsBusV3`), ELMAH (journal d'erreurs), MemoryCache | `packages.config` ; `legacy-integrations.md` RG-INT-044 ; `legacy-admin.md` RG-ADM-052 |
| Tests | MSTest, 8 fichiers `.cs` (couverture faible ; tests visibles : `SuiviEtatReservationBll`, `AdminPreparationDeblocageBll`, `PreparationDeroulantsService.CalculTrainParis`) | `inventaire.md` §1 ; `legacy-repartition-production.md` §10 n°9 |
| Volumétrie code | 1 589 fichiers dont 562 `.cs`, ~57 000 lignes C# hors entités | `inventaire.md` §1 |
| CI/CD | GitHub Actions : CI (`windows-2022`, restore + msbuild de toute la solution, publie le DACPAC et le site) ; CD (runner `cityz-media`, déploiement du site et du schéma DACPAC vers QUAL1/REC/REF/PROD selon la branche, `dry-run: true` et `execute-sql-script: true` constatés). Scripts `.github/scripts` : `sftp-deploy.sh`, notes `todo-db.md`, `tocheck-ssh.md` (non analysés) | `legacy-integrations.md` §6 ; `.github/` |

### 1.2 Découpage en couches (solution `ClearChannel.CIRCE.sln`)
Web (MVC : contrôleurs, vues, filtres globaux `LogActionFilter` + `ExceptionFilter`) → BLL (`ClearChannel.CIRCE.BLL`, 55 `.cs` : services, `HistorisationBll`, `CommunBll`) → Repositories (59 `.cs`, EF6 + `ExecuteSqlCommand`/procédures) → DAL (EDMX) → SQL Server. Transverses : Entities (186 `.cs` générés), Model (77 ViewModels), Tools (18 `.cs` + ressources). Source : `inventaire.md` §1 ; `legacy-admin.md` « Cartographie rapide ».

Particularité structurante : une part importante des règles métier vit dans les procédures stockées (voir §6.3) et la couche web ne contient aucun contrôle d'accès serveur (RG-ADM-015).

### 1.3 Déploiement connu
- Site : IIS (CD GitHub Actions), authentification Windows (`authentication mode="Windows"`, aucune section `<authorization>`), session InProc, connexion SQL applicative unique (`identity impersonate="false"`). Sources : `Web.config` (cités dans `legacy-admin.md` RG-ADM-001, RG-ADM-053).
- Schéma base : DACPAC déployé par la CD (RG-INT-042 : `p_batch_auto_instruction_ok` initialement notée « non déployée » ; `bdd.md` E5 constate qu'elle est référencée dans `DATABASE.sqlproj:380` et présente dans le SQL réel : voir Q-006).
- Batchs console (.NET 4.5.2) : ni empaquetés ni déployés par le pipeline (déploiement manuel ou hors dépôt) ; AUCUNE planification versionnée (ni SQL Agent, ni Task Scheduler, ni cron) : fréquences inconnues (RG-INT-013, 030, 042 ; Q-005).
- Configuration : `Web.config` tokenisé (`__...__` remplacés par la CD à partir des variables et secrets GitHub) ; les `App.config` des batchs et les transformations `Web.CIRCE-*.config` contiennent des valeurs en dur périmées d'après le README (voir §6.4).

## 2. Cartographie des modules

| Module | Dossiers / packages | Rôle | Dépendances |
|---|---|---|---|
| Réception — livraisons | `Controllers/LivraisonAfficheController.cs`, `BLL/LivraisonAfficheService`, `Repositories/LivraisonAfficheRepository`, `Views/LivraisonAffiche` | Réception des affiches (BL, mouvements, orphelines, panier, pièces jointes) | `affiche`, `livraison`, `mouvement`, `tf_prepa_affiche`, Broadcast (Web API `PrepaAfficheBC`), SMTP, partage de fichiers |
| Réception — liste / détail affiche | `ReceptionListeAfficheController`, `ReceptionListeAfficheBll`, `Views/Shared/DetailAffiche` | Liste (Tous / À traiter / Rebus / Fusionnées), ajout, sortie, rebus, validation admin, association prépa | `affiche`, `histo_historique_entite`, rapports (étiquette rack, édition picking) |
| Réception — fusion, destruction | `FusionAfficheController/Bll`, `DestructionController/Bll` | Fusion chapeau/cibles ; état de destruction | `fusion_affiche`, `affiche`, `mouvement` |
| Zone picking | `ZonePickingController/BLL` | Zone picking (hors périmètre direct) | `affiche.zone_Picking`, `Activite` |
| Coordination — réceptions attendues | `p_Alimentation_tf_prepa_affiche`, `Fn_GetPrepaAffiche`, `BatchAlimGetInstructionBc`, `SuiviEtatReservationController/Bll` | Alimentation de `tf_prepa_affiche` / `tf_prepa_Broadcast`, état des réservations | Broadcast (EXTPLAY), `tf_repart_calcul`, `tf_face_train` |
| Coordination — instructions et trains | `TrainListeInstruction`, `PreparationDeroulants`, `TrainSuiviTheme`, `TrainPreparation`, `TrainExportPrepa`, `DuplicationTrain` (contrôleurs + BLL `TrainListeInstructionBll`, `PreparationDeroulantsService`, `TrainSuiviThemeBll`, `TrainPreparationBll`, `TrainExportPrepaBll`) | Instruction OK, trains, faces, export | `instruction_train`, `instruction_detail`, `instruction_visuels`, `tf_face_train`, `tf_train_export`, procédures `p_u_associe_train`, `p_u_statut_preparation`, `p_u_exportTheme` |
| Coordination — déblocage | `AdminPreparationDeblocage`, `AdminSuiviDeblocage`, `AdminContrat` (rafraîchir un dossier) | Déblocage de préparation, suivi, relance Broadcast | EXTPLAY (`P_CirceDebloquerGroupePreparation`), `th_repart_annule`, `tr_atelier_droit_prepa`, `tr_parametre_alternance` |
| Répartition / UM / colis | `Repartition`, `PreparationColis*`, `PreparationColisage*`, `Expedition*`, `ListeColis` | Production aval (UM, colis, expédition) — hors périmètre prioritaire (interfaces notées) | `tf_repart_calcul`, `tf_UM`, `tf_colis`, `tf_UM_colis`, `tf_colis_ext` |
| Suivi / production | `SuiviSuiviProduction`, `AnalyseProduction`, `Activite` | Suivi de production, activité | `affiche` (validationAdmin), `tf_repart_calcul`, `Activite` |
| Administration | `AdminUtilisateur*`, `AdminPlateforme*`, `AdminEquipe`, `AdminMachine`, `PosteDeTravail`, `InfoPoste`, `AdminInfo`, `Test` | Utilisateurs, droits (27), périmètre, plateformes, mails, imprimantes, postes | `tr_utilisateur*`, `tr_plateforme`, `tr_adresseMail_plateforme`, `tr_atelier_imprimante`, `tr_poste`, `Equipe`, `Machine` |
| Rapports | `Reports/Rapport.cs`, `ReportController`, 32 `.rdlc` | Étiquette rack, feuilles de préparation, bagues, colisage | Imprimantes serveur, RDLC |
| Batchs | 6 projets console (§3.5) | Intégrations Broadcast/PEX, mails colis, Zoom, impression exemple | INTERFACE, EXTPLAY, SMTP, Geodis |
| Base de données | `BDD/DATABASE`, `BDD/DATA`, `BDD/SSIS_Circe`, `BDD/MPD` | Schéma SSDT, scripts de données, SSIS, modèle PowerDesigner | — |

Projets cités par le README mais ABSENTS de l'arbre : `ClearChannel.CIRCE.Web2` et `WebApiGetInstructionsBC` (constaté : le dossier `ClearChannel.CIRCE.root/ClearChannel.CIRCE/` ne les contient pas). Le service appelé par le code (`webapicirce` / `PrepaAfficheBC`) n'est donc pas dans le dépôt (RG-INT-012).

## 3. Flux techniques

### 3.1 Authentification et autorisation
- Identité = compte Windows/AD fourni par IIS (`HttpContext.Current.User.Identity.Name`, majuscules, `DOMAINE\LOGIN`) ; aucun écran de login, aucun mot de passe applicatif ; nom affiché lu dans l'annuaire AD ; plateformes de l'utilisateur chargées en session (InProc) depuis `tr_utilisateur_data` (RG-ADM-001, 004, 006). En compilation DEBUG, le login est figé sur un compte codé en dur (RG-ADM-002).
- Droits = lignes `tr_utilisateur_menu(loginWindows, menu)` : 27 valeurs de l'enum `CommunBll.Droits` (21 proposées par l'écran d'administration) ; `tr_utilisateur.prf_id` / `tr_profil` n'ont aucun effet à l'exécution ; périmètre = `tr_utilisateur_data(loginWindows, plt_id, ate_id)` appliqué par les procédures de lecture (RG-ADM-010 à 016).
- AUCUN contrôle serveur : pas de `[Authorize]`, pas d'appel à `EstAutorise` dans les contrôleurs, pas d'anti-CSRF ; les droits masquent menus et boutons (RG-ADM-015, 023 ; RG-REC-121 ; RG-COO-090). Cible : permissions dans le service (CLAUDE.md §6). Mécanisme d'authentification V2 : Q-001. Profils : Q-003.

### 3.2 Appels front → back
Pages Razor + grilles Kendo en lecture AJAX (`Read([DataSourceRequest] ...)`) ; actions POST/GET de type RPC par contrôleur (pas d'API REST) ; la quasi-totalité des routes sont des actions de contrôleur retournant vues partielles, JSON ou fichiers. État de travail conservé en session (« panier » de lignes de livraison, RG-REC-072) et en `MemoryCache` (expéditeurs, imprimeurs, dossiers). Une lecture a des effets de bord d'écriture : l'ouverture de la fiche affiche déclenche l'auto-association de prépas (RG-REC-093 / RG-COO-024). Aucune notion d'`Idempotency-Key` ni de version de ligne n'a été relevée (constat : non trouvé).

### 3.3 Accès à la base
- EF6 (65 entity sets) pour les CRUD simples ; SQL natif/procédures pour les listes et règles lourdes (les 5 procédures `p_GetListeAffiche*`, `p_GetPrepare*`, `Fn_GetPrepaAffiche`, `p_u_*`, `p_integ_*`) ; types table (UDT) pour les insertions en masse dans `trav_*` ; `CommandTimeout` infini dans le batch d'alimentation (RG-INT-008).
- Transactions : explicites dans certaines procédures (`p_batch_auto_instruction_ok`, alimentation de `tf_prepa_affiche`, RG-COO-012) ; absentes ailleurs (déblocage, fin de journée colis, intégrations, `CreatePreparationBC` ligne par ligne : RG-INT-011, 030).
- Concurrence : aucun verrou optimiste relevé (constat : pas de colonne `version` sauf `tf_face_train.version` tinyint, qui est un numéro de version de train et non un verrou ; `rpc_tms timestamp` seulement sur `tf_repart_calcul`) : `bdd.md` §4, §10.
- Trois bases : CIRCE (EF + SP), INTERFACE (tampon vers PEX/Broadcast), EXTPLAY (Broadcast/PEX : ressources, réservations, préparations), plus une connexion `CnxSybase` (AMT, flux historique). Procédures INTERFACE/EXTPLAY HORS dépôt (seuls les wrappers EDMX sont présents).

### 3.4 Historisation
`HistorisationBll` écrit dans `histo_historique_entite` (actions 1 à 16 : création/modification d'affiche, validation admin, rebus, association, statut d'instruction vers 2 ou 4, export de trains, déblocage) ; les batchs n'écrivent aucun historique de statut (RG-INT-046). `tt_log` (log technique), `tt_batch`, `FluxChargement` (INTERFACE) pour les flux.

### 3.5 Batchs et tâches planifiées (fréquences inconnues)
| Traitement | Point d'entrée | Rôle | Planification |
|---|---|---|---|
| `BatchAlimPexCirce` | `Program.cs:12-39` | Destinataires, préparations fixe/pliage, trains/instructions déroulants (INTERFACE/EXTPLAY → CIRCE) ; 3 flux ordonnés, sans transaction globale | Inconnue |
| `BatchAlimPexCirceInsBC` | `Program.cs:12-26` | `P_CirceEtatReservation_New` (fenêtre S → S+8) → `tf_prepa_Broadcast` | Inconnue |
| `BatchAlimPexCirceReception` | `Program.cs:12-34` | Export des réceptions CIRCE → `INTERFACE.CIRCE_PEX_RECEPTION` → Broadcast ; rejoué en totalité à chaque passage (RG-INT-020) | Inconnue |
| `BatchEnvoieMailColis` | `Program.cs:13-31` | Mails de colis (interne / externe) avec pièce jointe Excel | Inconnue |
| `BacthCallZoom` | `Program.cs:12-27` | Appel Geodis Zoom : réponse jamais enregistrée (défaut `BacthCallZoomBll.cs:61-68`) ; exception avalée + attente d'une touche : non planifiable (RG-INT-031) | Inconnue |
| `BatchEdition` | `Program.cs:17-119` | Exemple d'impression RDLC, sans lien métier (RG-INT-040) | Manuel |
| SQL `p_Alimentation_tf_prepa_affiche` | procédure | Alimente les réceptions attendues ; AUCUN appelant dans le dépôt (RG-INT-013) | Inconnue (Q-005) |
| SQL `p_batch_fin_journee_colis`, `p_batch` (purge historique 2 ans, `tt_log` 2 mois), `p_archivage_*` (3 ans), `p_batch_auto_instruction_ok` | procédures | Bascule fin de journée, purges, archivage, Instruction OK automatique | Inconnue |
| SSIS `Flux_Repartition_Amt_Ptf` | package | Flux historique AMT (Sybase) → CIRCE | Inconnue |

### 3.6 Intégrations externes
| Système | Nature | Mécanisme | Source |
|---|---|---|---|
| Broadcast / PEX (EXTPLAY, INTERFACE) | Entrant : destinataires, préparations, trains, instructions, état des réservations ; sortant : réceptions, accusé de statut de groupe, déblocage | EF + procédures + tables de travail `trav_*` ; Web API `PrepaAfficheBC` depuis l'écran Réception (rafraîchi si > 5 h) | RG-INT-001 à 013, 020 à 022, 044 |
| Zoom / Geodis | Suivi des envois (sortant puis entrant) | HTTPS POST JSON, en-tête `X-GEODIS-Service` avec hachage SHA-256 ; `log_colis_transporteur` → `p_updateColisTransporteur` | RG-INT-031, 032 |
| Sybase (AMT) | Flux historique répartitions / adresses | SSIS + `p_integ_ptf_*` + `CnxSybase` ; usage actuel inconnu | RG-INT-041 |
| SMTP | Mail de réception, mail de déblocage, mails de colis | `SmtpClient` ; exceptions souvent avalées (`catch {}`) ; objet/corps d'environnement incohérent en production | RG-INT-034, 035, 043 ; RG-ADM-043 |
| Imprimantes | Étiquette rack (impression directe serveur), feuilles RDLC ; imprimantes par plateforme (`tr_atelier_imprimante`), postes (`tr_poste`) | Impression côté serveur ; identification du poste par IP + `ping -a` exécuté sur le serveur | RG-ADM-041, 048, 060 ; RG-REC-028, 100 |
| Fichiers | Export CSV des trains (`DirectoryFileExportSurf`, découpe en 6 faces), pièces jointes de livraison (`DirectoryFilePieceJointeReception`), export 2m2 | Partages disque configurés | RG-INT-045 ; RG-REC-080 |
| ConfigCat | Feature flags (`PastillePrepaBus`, `IsBusV3`) | SDK | RG-INT-044 |
| Active Directory | Nom affiché ; recherche LDAP par concaténation (usage inconnu) | `ToolBll.NomUtilisateurDuLoginAd`, `RessourceRepository` | RG-ADM-004 ; zone non analysée n°8 de `legacy-admin.md` |

## 4. Zoom Réception

### 4.1 Composants
| Écran legacy | Contrôleur (actions principales, `Controllers/`) | BLL / Repository | Procédures et fonctions |
|---|---|---|---|
| Réception des affiches | `LivraisonAfficheController` : `Index`, `Rechercher`, `Read`, `Creation` (:131), `ValiderLivraison` (:209), `ValiderLivraisonOrpheline` (:274), `ModifierLivraison` (:324), `ReadLivraisonAffiche` (:374), `GetPreparationBC` (:449), `AjouterPanier` (:460), `DeletePanier` (:474), `DeleteFileUploaded` (:516) | `LivraisonAfficheService`, `LivraisonAfficheRepository`, `ToolBll.SendMail` | `Fn_GetPrepaAffiche`, `p_GetPrepareListLivraison` |
| Liste des affiches + détail | `ReceptionListeAfficheController` : `Read` (:66), `AfficheCreerAjouterMajSortie` (:131), `_Ajouter` (:200), `_Sortir` (:209), `_Modifier` (:218), `MettreAuRebus` (:259), `ViderRebus` (:272), `Imprimer` (:285), `ValiderAssocPrepaAffiche` (:379), `DeleteAssocPrepaAffiche` (:391), `EditionPicking` (:403), `Fusionner` (:425), `FusionNonHomogene` (:497, :514) | `ReceptionListeAfficheBll`, `ReceptionListeAfficheRepository`, `HistorisationBll` | `p_GetListeAffiche`, `p_GetListeAfficheATraiter`, `p_GetListeAfficheRebus`, `p_GetListeAfficheFusionnees`, `p_GetListeAfficheParDossierReservation`, `p_GetPrepareListAffiches`, `p_GetDataReceptionOrpheline`, `p_EditionPicking` |
| Fusion des affiches | `FusionAfficheController` : `Read`, `Fusionner` (:56) | `FusionAfficheBll` | `p_s_affiche_a_fusionner` |
| État de destruction | `DestructionController` : `Read` (:37), `ExportExcelDestruction` (:53), `UpdateStatutRebus` (:60) | `DestructionBll` | `p_s_destruction` |
| Association prépa ↔ affiche | `AssociationPrepaAfficheController.ReadAssocPrepaAffiche` | `ZonePickingBLL` (délégation) | `Fn_GetPrepaAffiche` |
| Batch d'export des réceptions | `BatchAlimPexCirceReception` | `BatchAlimReceptionBll/Repository` | `p_batch_alimentation_circe_pex_reception`, `P_CIRCE_Alim_PEX_ReceptionAffiche` (INTERFACE, hors dépôt) |

### 4.2 Tables touchées
`affiche`, `mouvement`, `livraison`, `asso_livraison_affiche`, `asso_livraison_photo`, `photo`, `tf_prepa_affiche`, `tf_prepa_Broadcast`, `tf_dossier_semaine_depart`, `fusion_affiche`, `histo_historique_entite`, `Activite`/`Machine`/`Equipe` (lecture), `tr_categorie_support`, `tr_plateforme`, `tr_utilisateur_data`, `tr_utilisateur_menu`, `tr_transposteur_reception`, `tr_imprimeur`, `tr_adresseMail_plateforme` ; hors CIRCE : `INTERFACE.CIRCE_PEX_RECEPTION`. Source : `legacy-reception.md` « Cartographie rapide » et « Dépendances ».

### 4.3 Constats d'architecture propres à la Réception
- Entité centrale `affiche` sans colonne statut : l'état est dérivé de six drapeaux bit NULL (`rebus`, `zone_Picking`, `a_conserver`, `est_fusionne`, `validationAdmin`, `envoye`) et des liens (`fusion_affiche`, `tf_prepa_affiche`) ; les « statuts » d'écran sont des filtres dans 4 procédures différentes (`bdd.md` §2.1, §4.2, §8 ; Q-300).
- Aucune garde sur l'état courant côté serveur (rebus rebutable plusieurs fois, ajout/sortie sur rebus ou fusionnée) ; `mouvement` est append-only (`legacy-reception.md`, « Machines d'états »).
- La quantité existe en double (colonne `affiche.quantite` et somme des `mouvement`), avec écrasement vs cumul incohérent selon le chemin (RG-REC-023, 075, 079 ; Q-322).
- Écriture dans une lecture (auto-association à l'ouverture de la fiche, RG-REC-093) ; e-mail de réception d'erreurs avalées (RG-INT-043).
- Voie de création manuelle d'affiche probablement morte (RG-REC-020).

## 5. Zoom Coordination

Le legacy n'a pas de module « Coordination » : les fonctions de la cible sont portées par les objets suivants (`legacy-coordination.md` §0).

### 5.1 Composants
| Fonction cible | Contrôleur / actions | BLL / Repository | Procédures |
|---|---|---|---|
| Réceptions attendues (alimentation) | — (batch) | `BatchAlimGetInstructionBc`, `PrepaAfficheBCRepository`, `LivraisonAfficheRepository.CreateOrUpdatePreparationBC` | `p_Alimentation_tf_prepa_affiche`, `Fn_GetPrepaAffiche`, `P_CirceEtatReservation_New` (EXTPLAY) |
| État des réservations | `SuiviEtatReservationController` (`Index`, `Read` :62, `ShowImage`) | `SuiviEtatReservationBll/Repository` | `P_CirceEtatReservation_New`, `p_s_adminSuiviRead` |
| Intégration prépas / trains | — (batch `BatchAlimPexCirce`) | `BatchAlimBll`, `BatchAlimRepository` | `p_integ_preparation`, `p_integ_deroulants` (`p_integ_train_affiches`, `p_integ_instructions`), `p_integ_destinataire` |
| Liste des instructions | `TrainListeInstructionController` (`Read` :68, `DetailInstruction`, CRUD visuels/détails) ; second écran dans `PreparationDeroulantsController` (`Index`, `ChangerStatut` :1380, `ConfirmChangerStatut` :1417) | `TrainListeInstructionBll`, `PreparationDeroulantsService` | `p_u_statut_preparation`, `p_u_associe_train`, `p_batch_auto_instruction_ok` |
| Suivi par thème | `TrainSuiviThemeController` (`AnnulerTheme`, `FractionnerRaccrocherTheme`, `PreAssemblageTheme`, `DebloquerSemaine` :217, `Raccrocher`, `MajOrdreTheme`) | `TrainSuiviThemeBll/Repository` | — |
| Préparation / roulage | `TrainPreparationController` (`ChangerStatut`, `AuRoulage`, `ExportPreparation`, CRUD `FaceTrain`) | `TrainPreparationBll/Repository` | `p_u_exportTheme`, `p_s_face_train_export_caire` |
| Export des trains | `TrainExportPrepaController` (`MiseAJourAuRoulage`, `SupprimerTrain`, `Exporter`, `ExporterV2`, `ExportComplet`, `ExportOptimise`) ; `PreparationDeroulantsController` (`ExporterTrain` :71, `SimulationExporterTrain` :128, `ExporterCaire` :138) | `TrainExportPrepaBll`, `PreparationDeroulantsService` | `p_u_associe_train` (bloc Paris l.440-697) |
| Duplication / rafraîchir dossier | `DuplicationTrainController`, `AdminContratController` | `AdminContratRepository` | `p_u_duplication_train`, `ope.P_ExportTrainAfficheTravailCirce` (EXTPLAY) |
| Déblocage | `AdminPreparationDeblocageController`, `AdminSuiviDeblocageController` | `AdminPreparationDeblocageBll`, `AdminSuiviDeblocageBll`, `RepartitionService` | `p_u_statut_repart_deblocage`, `p_s_controle_rendumain`, `p_i_th_repart_annule`, `p_s_th_repart_annule` ; EXTPLAY `P_CirceRecherchePreparationDeblocable`, `P_CirceDebloquerGroupePreparation` |

### 5.2 Tables touchées
`tf_prepa_affiche`, `tf_prepa_Broadcast`, `instruction_train`, `instruction_detail`, `instruction_visuels`, `tf_face_train`, `tf_repart_calcul`, `tf_UM` (lecture : statut ≥ 6 bloque le déblocage), `tf_train_export`, `th_repart_annule`, `trav_*` et `histo_*` (intégration), `tr_atelier`, `tr_atelier_droit_prepa`, `tr_parametre_alternance`, `tr_instruction_plus`, `tr_statut`, `tr_destinataire`, `tr_dest_adresse`, `tr_ate_dest_trans`, `Transaco_Surface_Format`, `transcoCategSupport`. Source : `legacy-coordination.md` §0.2, §8 ; `bdd.md` §3.

### 5.3 Constats d'architecture propres à la Coordination
- `rpc_statut` (0 à 10) partagé par 4 tables aux cycles de vie différents et non synchronisés (`legacy-repartition-production.md` en-tête et RG-RPR-012, 015) ; aucune table de transitions : les transitions sont dispersées dans les procédures et le front (RG-COO-060, 072 : « transitions autorisées uniquement par le front »).
- Les renvois Broadcast sont ignorés sans alerte pour les instructions aux statuts 2, 4 (non mis à jour) et 5 (RG-COO-047, 049).
- Deux écrans concurrents de liste d'instructions avec règles et listes de statuts différentes (RG-COO-061, 063).
- Déblocage sans transaction, contrôle serveur limité aux UM, mail non protégé (RG-COO-083, 084 ; RG-RPR-010).
- Alimentation des attendues fondée sur des jointures par texte (thème, annonceur, format, nom de plateforme `LIKE`) ; `MERGE` inopérant, doublons (RG-COO-004 à 009 ; `bdd.md` §2.3).

## 6. Points de vigilance

### 6.1 Dette et défauts structurels
1. Aucun contrôle de droits serveur, aucun anti-CSRF ; `TestController` (imprimantes, ping, upload) et ELMAH ouverts à distance (`allowRemoteAccess="yes"`, `requiresAuthentication=false`) : RG-ADM-015, 050, 052.
2. Connexion SQL applicative unique : les droits SQL ne distinguent pas les utilisateurs (RG-ADM-053).
3. Absence de transactions et d'atomicité multi-systèmes (batchs, déblocage AMT puis CIRCE : RG-INT-002, 006, 011 ; RG-RPR-010).
4. Exceptions avalées (mails, rapports, batch Zoom) : RG-INT-031, 043 ; RG-ADM-063.
5. Fichiers PDF temporaires jamais purgés (RG-ADM-061) ; thread unique pour les mails (RG-ADM-043).
6. Semaines non ISO (`DATEPART(wk)`, culture machine) et année de 52 semaines codée en dur ; probable décalage d'une semaine dans la fenêtre S → S+8 (RG-INT-010 ; `bdd.md` §10 n°8). Q-314.
7. Suppressions physiques sans contrôle d'usage (équipes, machines, utilisateurs : RG-ADM-031, 046) ; pas d'historique des changements de droits.

### 6.2 Code mort ou probablement mort
`BatchEdition` (exemple), `p_GetListeReceptionAffiche` (plus appelée), `tf_evenement` (fichier vide, absente du SQL réel), `p_s_listeAtelier` / `p_s_profilUser` (seuls consommateurs de `prf_id`), `p_batch_u_synchro_adresse` (aucun appelant), procédures `p_integ_ptf_*` et SSIS AMT (usage inconnu), `p_u_numeroReception` (aucun appelant dans le périmètre), `GetRessourceAdresseMail` partiellement, voie `AfficheCreerAjouterMajSortie` en mode Création (RG-REC-020), `tr_statut_colis` (orpheline côté C#, mais requise par `p_updateColisTransporteur`), 12 tables de journaux AMT, 6 tables `tmp_*`. Liste de tables sans usage C# : `bdd.md` §7.3. Aucune suppression sans validation (Q-309).

### 6.3 Règles cachées dans le SQL (à reporter dans les services V2, voir Q-316)
Les procédures portent des règles métier : `p_Alimentation_tf_prepa_affiche` (3 sources, fenêtre S0 → S+8, exclusions en dur), `p_integ_preparation/instructions/train_affiches/destinataire/deroulants` (statut Broadcast 133 « actif », routage atelier, instructions ignorées aux statuts 2 et 5), `p_batch_auto_instruction_ok` (RG1 à RG6), `p_u_associe_train` (entretiens 8 %, convention `VPS_75 101 0004` en dur), `p_u_statut_preparation` (retours autorisés 0, 1, 5, 4), `p_u_statut_repart_deblocage`, `p_u_exportTheme` (20 thèmes par machine), `p_batch_fin_journee_colis`, onglets de l'écran Réception (`p_GetListeAffiche*`). La revue interne `REVIEW_Database_proc.md` (25/09/2026) recense des bugs vérifiés dans ces procédures (quantités multipliées, doublons, `plt_id` renvoyé = `sup_id`, troncatures, paramètre inexistant dans `p_archivage_allTables`) : ils reflètent la production actuelle et ne doivent pas être corrigés en silence (BRIEF, règle 3).

### 6.4 Valeurs codées en dur et secrets
- Codes en dur : `sup_id in (26,1026,1027)` (vue `v_support_scrolling`), `ate_id in (5,6,7,8,11,12)`, `IdReferentielStatutPreparation = 133`, sites 39/40/43/44 (`plt_id = 1` → 39 sinon 40 dans l'export), transporteur/tarif par défaut par atelier (`X24`, `CX`, `CCF`), exclusion de deux plateformes par nom, ligne « Sans affiche », supports bandeau 100/102/105/107, +3 kg pour ateliers 7 et 8 : Q-315.
- Secrets en clair, SANS les recopier : mots de passe SQL (CIRCE, INTERFACE, EXTPLAY) dans les `App.config` de tous les batchs et le package SSIS ; clé et identifiant Geodis dans `BacthCallZoom/App.config:19-22` ; mots de passe dans `BDD/DATABASE/DATABASE/Security/*.sql` ; logins et adresse e-mail codés en dur (écran de tests, DEBUG) ; configuration déclarée « périmée » par le README (Q-010 ; EX-TRA-038).

### 6.5 Logique dupliquée front / back / SQL
- Validations de saisie dossier / semaines côté back ET JS (JS absent : comparaison partielle) : RG-REC-026, RG-COO-025.
- Transitions de statut des faces et instructions : proposées par le front, non contrôlées par le back (RG-COO-060, 072).
- Contrôle des 100 % de répartition des thèmes présent dans un écran, factice dans l'autre (RG-COO-063).
- Semaines de départ : colonne texte `affiche.semaines` ET table `tf_dossier_semaine_depart` ; quantité : `affiche.quantite` ET somme des `mouvement` ; mails de plateforme : deux sources non synchronisées (RG-ADM-044).
- Deux implémentations divergentes de « ouvrir un colis » et du filtre destinataire (RG-RPR-016, 017).

### 6.6 Écarts entre dépôt et base réelle
Voir `docs/ANALYSE_MODELE_DONNEES.md` §1.9 et §2 (index, `tf_evenement`, procédures, `.sqlproj` en double `ClearChannel.CIRCE.Database` non comparé).

## 7. Zones non analysées et pourquoi
| N° | Zone | Pourquoi | Impact |
|---|---|---|---|
| 1 | Procédures INTERFACE et EXTPLAY (`P_CIRCE_Alim_PEX_ReceptionAffiche`, `P_ExportPrepaCirce`, `P_ExportCirceMajFlag`, `ope.P_*`, `P_CirceEtatReservation_New`, `P_CirceDebloquerGroupePreparation`, `res.P_GetRessourceAdresseMail`…) | Hors dépôt : seuls les wrappers EDMX existent | États Broadcast, doublons de réceptions, sémantique des drapeaux `Traitement` non vérifiables (Q-005, Q-326) |
| 2 | Service Web API `webapicirce` (`PrepaAfficheBC`), projets `Web2` et `WebApiGetInstructionsBC` cités par le README | Absents de l'arbre | Mapping réel de la variante interactive incertain (RG-INT-012) |
| 3 | Planification (SQL Agent, Task Scheduler, fréquences, comptes de service, serveur d'exécution) | Aucun fichier versionné | Fréquences de toutes les alimentations inconnues (Q-005, Q-330) |
| 4 | JavaScript de site (`Scripts/site/*.js`, `AppCirce.js`, `Commum.js`, `Administation.js`…) | Absents du dépôt fourni | Validations front, règles de masquage (ex. bouton « Débloquer »), enchaînement de la fusion non homogène : inconnus |
| 5 | Package SSIS `Flux_Repartition_Amt_Ptf.dtsx` | 10 000+ lignes de mappage non lues ; connexion Sybase non évaluée | Usage actuel du flux AMT inconnu (Q-329) |
| 6 | Modèle PowerDesigner `BDD/MPD/logistique_ptf.mpd` | Format binaire propriétaire | Aucun apport hors schéma SQL |
| 7 | Images et captures des ateliers (3 `.pptx` : 70 images ; `BL.png` lue) | Non extraites des `.pptx` (texte seulement) | Q-008 ; règles potentiellement manquantes |
| 8 | Contenu des 32 `.rdlc` (mise en page, expressions, codes-barres) | XML volumineux non lu | Contenu exact des états à refaire en PDF navigateur |
| 9 | Configuration IIS (accès anonyme, groupes AD, pool, session) et transformations `Web.CIRCE-*.config` / `Web.QUALIF.config` | Hors dépôt / non lues | Hypothèse d'authentification Windows seule non vérifiable |
| 10 | Production et expédition (UM, colisage, colis, Geodis, `_2m2FixePreparation*`, `PreparationExpedition*`, `ListeColis`, `EditerBague`), Bus (`IsBusV3`, `PreparationBusMock*`) | Hors périmètre prioritaire (Réception, Coordination) ; relevé partiel des interfaces | Dépendances étape 8 (Q-310) |
| 11 | `circe-develop/docs/regles-inclusion-exclusion-deblocage.md`, `BDD/DATA/APPFR-*.sql`, données de référence (`tr_statut`, `tr_atelier`, `tr_plateforme`…) | Non fournies ou non relues | Q-004, Q-319 |
| 12 | `HistoriqueEntityBuilder`, `ToolBll` (hors `SendMail`, `NomUtilisateurDuLoginAd`), `CommunWebApi.GenerateHash256Key`, `ConfigurationHelper` | Lus partiellement | Format détaillé de l'historique non connu |
| 13 | Projet SQL `ClearChannel.CIRCE.Database/ClearChannel.CIRCE.Database.sqlproj` | Existence constatée, divergences avec `BDD/DATABASE` non comparées | Q-304 |
| 14 | Comparaison colonne à colonne schéma réel / SSDT / EDMX | Seules les clés de `affiche`, `tf_UM` comparées | Q-324 |
| 15 | Tests unitaires `ClearChannel.Circe.Test` | Non exploités | Règles attendues éventuellement non relevées |
| 16 | Les deux copies de `circe-develop` | Identiques sauf assets statiques | Q-007 |
