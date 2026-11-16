# Inventaire des sources (étape 1a) — 2026-11-04

## 1. circe-develop (code historique) — LECTURE SEULE

- Chemin : `circe-develop/` (copie dans circe-cv1). Une 2ᵉ copie existe à `../circe-develop` (répertoire additionnel) : identique sauf `.DS_Store` et `Content/{bootstrap,fonts,images,jquery-ui css}` présents seulement dans la copie externe (assets statiques, sans impact métier).
- 1 589 fichiers : 562 .cs, 216 .cshtml, 311 .sql, 53 .js, 45 .css, 37 .resx, 31 .rdlc (états), 31 .config, 16 .csproj, 135 png / 57 gif.
- ~57 000 lignes C# (hors Entities et Designer).

### Technos
ASP.NET MVC 5 / Web API, .NET Framework 4.5–4.6.1, Entity Framework (EDMX : CIRCE, INTERFACE, EXTPLAY), SQL Server (procédures stockées), SSIS, MSTest, rapports RDLC, jQuery/Bootstrap, CI/CD GitHub Actions (Windows). Intégrations : Zoom (API), Sybase (`CnxSybase`), PEX, mails colis.

### Projets (`ClearChannel.CIRCE.root/ClearChannel.CIRCE/`)
| Projet | .cs | Notes |
|---|---|---|
| ClearChannel.CIRCE (web MVC) | 121 + 216 cshtml | 47 contrôleurs (dont sous-dossiers Administration, Expedition, Preparation, PreparationColisage, PreparationDeroulants, Repartition) |
| ClearChannel.CIRCE.BLL | 55 | logique métier (Reception­ListeAfficheBll, PreparationService, Repartition…) |
| ClearChannel.CIRCE.DAL | 9 (+3 .edmx) | EF |
| ClearChannel.CIRCE.Entities | 186 | entités générées |
| ClearChannel.CIRCE.Model | 77 | ViewModels |
| ClearChannel.CIRCE.Repositories | 59 | |
| ClearChannel.CIRCE.Tools | 18 (289 fichiers) | utilitaires + ressources |
| ClearChannel.CIRCE.Batch* (Edition, AlimPexCirce, AlimPexCirceReception, AlimPexCirceInsBC, EnvoieMailColis, BacthCallZoom) | 2 chacun | batchs / traitements automatiques |
| ZoomWebApi, WebApiTools | 14 / 3 | intégration Zoom |
| ClearChannel.Circe.Test | 8 | MSTest (couverture faible) |
| ClearChannel.CIRCE.Database | 0 cs | projet SQL |
| (README cite WebApiGetInstructionsBC et Web2 — non trouvés dans l'arbre) | | à vérifier |

### Modules fonctionnels (contrôleurs/vues)
Réception : `ReceptionListeAffiche`, `LivraisonAffiche`, `Destruction`, `FusionAffiche`, `AssociationPrepaAffiche`.
Coordination / préparation : `Preparation*` (Colis, ColisTrain, Colisage, Deroulants, Expedition, Pliage), `_2m2FixePreparation`, `Repartition`, `TrainPreparation`, `TrainListeInstruction`, `TrainExportPrepa`, `TrainSuiviTheme`, `DuplicationTrain`, `ListeColis`, `ListeRouleur`, `ZonePicking`, `Colisage`, `CoteCote`.
Suivi : `SuiviEtatReservation`, `SuiviSuiviProduction`, `AnalyseProduction`, `Activite`.
Expédition : `Expedition`, `ExpeditionExterieur`, `DetailDestinataire*`, `EditerBague`.
Admin : `AdminContrat`, `AdminEquipe`, `AdminInfo`, `AdminMachine`, `AdminPlateforme(Mail)`, `AdminPreparationDeblocage`, `AdminSuiviDeblocage`, `AdminUtilisateur(Data/Menu)`, `InfoPoste`, `PosteDeTravail`.

### Base (`BDD/`)
- `BDD/DATABASE/DATABASE/dbo` : 117 tables, 127 procédures stockées, 46 UDT, 1 vue, 1 fonction, 2 rules, 1 default, Security (10).
- `BDD/DATA` : 6 scripts (dont `APPFR-*` unlock-prep, bus-page, doublons tr_utilisateur, MajData).
- `BDD/MPD/logistique_ptf.mpd` (modèle PowerDesigner, format binaire/propriétaire — **non lisible**).
- `BDD/SSIS_Circe` : 7 fichiers (.dtsx probables).
- `docs/regles-inclusion-exclusion-deblocage.md` (138 l.), `docs/REVIEW_Database_proc.md` (208 l.) — documentation interne du legacy.

### Fichiers non lisibles / non exploitables
- `.mpd` (binaire), `.rdlc` (XML lisible mais verbeux), images png/gif (UI legacy), `.vspscc/.scmp/.xss/.xsc` (outillage), DLL éventuelles dans `.nuget`.
- `.edmx` : XML volumineux (lisible via Grep).
- ⚠ Les `.config` contiennent possiblement des identifiants en dur (README : obsolètes) — à ne pas recopier.

---

## 2. docs-sources — LECTURE SEULE

64 fichiers (dont ~40 assets de la maquette).

### Schéma BDD réel
- `CIRCE SQL.sql` (1,29 Mo) — **UTF-16 LE** : illisible tel quel par Grep/Read. Extrait UTF-8 produit : `docs/_travail/extraits/CIRCE_SQL_utf8.sql` (626 Ko, 138 `CREATE TABLE` dont 22 tables de travail créées dans des procédures, soit 116 tables permanentes ; 126 procédures, 1 vue, 0 trigger). Généré le 03/11/2026 10:34 (script SSMS).

### 00_sommaire.html (21 Ko) — sommaire/index des documents

### 1. CIRCE ACTUEL (documentation de l'existant, côté métier)
- `1. PROCESS/20261029 - Pages de Circé par étape du process.html` (56 Ko)
- `1. PROCESS/20261102 - Process de bout en bout, pages et tables (diagrammes).html` (141 Ko)
- `1. PROCESS/20261102 - Process et acteurs, fixe et déroulant.html` (58 Ko)
- `1. PROCESS/schema_dossier_affiche_statuts.html` (29 Ko)
- `1. PROCESS/schema_fixe_scro_apres_prepa.html` (27 Ko)
- `2. STATUTS ET TAGS/schema_tags_par_etape.html` (50 Ko)

### 2. CIRCE CIBLE + MAQUETTE
- `1. RECEPTION/20261027 - Réception des affiches, le dossier complet.html` (96 Ko)
- `1. RECEPTION/process_reception_statuts_actions.html` (39 Ko)
- `2. COORDINATION/process_coordination_statuts_actions.html` (38 Ko)
- `2. COORDINATION/process_preprod_avant_apres.html` (72 Ko)
- `2. COORDINATION/receptions_attendues_doublons_tables_regles.html` (47 Ko)
- `maquette/` : `index.html`, `apercu-navigation-haut.html` (291 Ko), `README.md` (51 Ko), `DESIGN.md` (32 Ko), `notes/releve-existant-code.md` (21 Ko), `notes/veille_github_composants.md` (30 Ko).
  - JS : `assets/js/{app,core,ui,charts,besoins,data}.js` (data.js = 111 Ko de MOCK) + 20 écrans `screens/` : alertes, bagues, besoins, dispatch, expedition, fincampagne, generateur, identification, instructions, parametrage, parcours, **reception (110 Ko)**, reservations, stock, suivi, themes, trains, unitaire.
  - Vendor (tabler, tabulator, echarts, tabler-icons) : bibliothèques tierces, hors périmètre d'analyse.

### Doc_Pilotage_Bao (pilotage / ateliers)
- 3 .pptx (7 Mo, 13 Mo, 2,9 Mo) — **non lisibles par les agents**. Texte extrait (stdlib zip/XML) : `docs/_travail/extraits/atelier_*.md` (19, 34 et 20 slides). **Le contenu visuel (images, schémas) n'est pas extrait** ; le pptx du 14/10 est lourd en médias.
- `20261016 - Synthèse Besoins Circé.xlsx` — extrait : `docs/_travail/extraits/synthese_besoins_20261016.md` (1 feuille, liste des besoins métier).
- `BL.png` (560×420) — image d'un bon de livraison, lisible visuellement via Read (multimodal).

### Constats
- Pas de document .docx/.pdf de spécification : les « specs » sont des pages HTML (process/statuts/règles), les ateliers PPTX et la synthèse XLSX.
- Les extraits ci-dessus sont des copies dérivées ; la source reste la référence (citer le fichier d'origine dans les références).
