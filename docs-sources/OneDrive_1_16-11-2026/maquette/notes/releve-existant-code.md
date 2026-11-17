# Relevé préliminaire de l'existant (code Circé), fait pour la maquette

| | |
|---|---|
| **Statut** | Note de travail du 13/10/2026, **préalable à la phase 1**. Elle sera reprise et complétée dans `01_cartographie_technique.md` et `02_cartographie_fonctionnelle.md`. |
| **Source** | Dépôt `GIT_circe`, lu en lecture seule dans l'arbre git : branche `main` (HEAD = commit bb575c4 du 19/06/2025), avec `git show`, `git grep` et `git ls-tree`. Aucun fichier n'a été modifié et aucun checkout n'a été fait. |
| **Avertissement** | **Le working tree de `GIT_circe` est incomplet sur disque** (même constat pour la copie du 13/10). Environ 330 fichiers sont présents (contrôleurs Web, Content, App_Start, BDD), alors que git en suit environ 4 500. Manquent notamment les vues, le JavaScript et les projets BLL, DAL, Entities, Model et Repositories. `origin/develop` a 187 commits d'avance sur `main`. Écarts fonctionnels de `develop` : suppression de Web2 et de WebApiGetInstructionsBC, ajout de la colonne `UM_date_aff` à la grille 2 m². |
| **Confidentialité** | Le dépôt contient des chaînes de connexion, des paramètres SMTP, AD et Geodis, ainsi que des logins et une adresse e-mail codés en dur. Seuls leurs emplacements sont donnés (§14), jamais leurs valeurs. |

Abréviations des chemins (relatifs à `GIT_circe`) :

| Abréviation | Chemin |
|---|---|
| [R] | `ClearChannel.CIRCE.root/ClearChannel.CIRCE` |
| [W] | `[R]/ClearChannel.CIRCE` (projet Web) |
| [BLL], [REP], [ENT], [MOD] | `[R]/ClearChannel.CIRCE.BLL`, `.Repositories`, `.Entities`, `.Model` |
| [SP] | `BDD/DATABASE/DATABASE/dbo/Stored Procedures` |
| [T] | `BDD/DATABASE/DATABASE/dbo/Tables` |

## 1. Stack

- C# sur .NET Framework 4.5.2, ASP.NET MVC 4, Razor 2, Web API 4.
- Entity Framework 5 en mode DB-first, avec 3 EDMX : CIRCE, EXTPLAY (Broadcast) et INTERFACE (zone de staging).
- SQL Server : projet SSDT Sql130, plus un package SSIS legacy.
- Front : Kendo UI MVC 2017.2, jQuery 1.9 et 2.0, jQuery UI, Bootstrap 3 (partiel).
- Éditions : RDLC avec ReportViewer 11, sorties PDF et Excel.
- Authentification Windows. CI/CD par GitHub Actions.
- Batchs :
  - `BatchAlimPexCirce*` : flux en provenance de Broadcast ;
  - `BacthCallZoom` : interrogation de l'API Geodis ;
  - `BatchEnvoieMailColis` : mail d'expédition aux afficheurs.

## 2. Menus et droits

Le menu effectif est `[W]/Views/Shared/_MenuNew.cshtml`, avec le layout `_LayoutSansBoostrap`. Ses entrées :

- **2m² fixe** et **Pliage** : A traiter, Préparation, Liste des colis (`Preparation/GetPreparation…?tdp=Fixe2M2|Pliage`, `ListeColis`).
- **Trains** : Liste des instructions, Liste des trains, Position Train, Suivi par thème, Préparation, Export préparation, Liste des colis.
- **Expedition ext**.
- **Réception** : Réception des affiches, Liste des affiches, Zone picking, Fusion des affiches.
- **Suivi** : Suivi de production, Etat des réservations, Analyse Production, Etat de destruction.
- **Administration** : déblocage, rafraîchir un dossier, dupliquer un train, référentiels, plateformes et mails, utilisateurs.

**Droits.**
- Liste : enum `CommunBll.Droits` (`[BLL]/CommunBll.cs:35-43`).
- Stockage : table `tr_utilisateur_menu`. Le périmètre de chaque utilisateur est dans `tr_utilisateur_data`.
- **Aucun attribut `[Authorize]`** : les droits ne font que masquer des menus et des boutons. *Déduit* : une URL appelée directement n'est pas protégée (à traiter en phase 4).

## 3. Statuts codés (table `tr_statut`, partagée)

Enum : `[ENT]/Enums.cs:50-75`.

| Code | Libellé | Code | Libellé |
|---|---|---|---|
| 0 | A traiter | 6 | Préparé |
| 1 | En cours | 7 | A expédier |
| 2 | Instruction Ok | 8 | Terminé |
| 3 | Erreur | 9 | Export prepa |
| 4 | Annulé | 10 | Au roulage |
| 5 | A imprimer | | |

**Transitions, 2 m² fixe et pliage :**
- 0 à l'intégration (`[SP]/p_integ_preparation.sql:123`) ;
- 0 → 1 au clic « Colisage », qui **crée les UM** (`[REP]/PreparationRepository.cs:228,266`) ;
- 1 → 0 au clic « Retirer » ;
- → 6 « Préparé » (`[BLL]/PreparationService.cs:278`, ou à l'ajout dans un colis) ;
- → 7 à l'expédition (`[SP]/p_u_expedie_Colis.sql`) ;
- → 8 à la fin de journée (`[REP]/ListeColisRepository.cs:117-133`).

**Transitions, trains :**
- 2 « Instruction Ok » appelle `p_u_associe_train`, qui crée les trains et les faces d'entretien (`[SP]/p_u_statut_preparation.sql:19-24`) ;
- faces → 5, 9, 10 et 6 dans `TrainPreparationRepository`, `TrainExportPrepaRepository` et `PreparationColisTrainRepository` ;
- « Changer statut : A imprimer » n'accepte que 10, 5 et 9 ; « Export préparation » n'accepte que 5 et 9 (`[BLL]/TrainPreparationBll.cs:248,274`).

**Autres valeurs codées :**
- réception : « Réception attendues », « Réceptionnée », « Picking » (`Enums.cs:183-191`) ;
- position dans le train : 0 Standard, 1 début, 2 fin, 3 FIN-1, 4 milieu (`Enums.cs:272-284`).

## 4. Types de préparation et ateliers

- **Types Broadcast** (`BDD/DATA/sprint4.circe.MajData.sql:31-57`) : Vrac (7), Roulee (8), Fixe (9), Affiche fixe (9), Scro-défilant (10), Scro-fixe (10), Scrolling venusial 2 (11), RX8 (12), Tole traditionnelle (1)… Entre parenthèses : le `tpr_id`.
- **Routage à l'intégration** (`p_integ_preparation.sql:96-102`) :
  - type 23 → atelier pliage : Wissous (2), Nîmes (3), DBG (9) ;
  - autres types → 2 m² fixe : Wissous (1), Nîmes (4).
- **Ateliers** (`Enums.cs:249-269`) : 1 Wissous 2M2 Fixe, 2 Wissous Pliage 2M2, **3 Nîmes Pliage 12M2**, 4 Nîmes 2M2 Fixe, 5 Wissous 2M2 Déroulant, 6 Nîmes 2M2 Déroulant, 7 Wissous 8M2 Déroulant, 8 Nîmes 8M2 Déroulant. Il existe aussi des sites **DBG** (9) et **DBG Lyon** (10), et des ateliers 11 et 12.
- **Sites Broadcast** (`IdSiteCCF`) : 39 Wissous, 40 Nîmes, 43 DBG, 44 DBG Lyon (`[BLL]/SuiviEtatReservationBll.cs:89-107`).

> ⚠ **Contradiction code / réponse du 13/10.** Le code prévoit un atelier « Nîmes Pliage 12M2 », alors que la Colle n'est produite qu'à Wissous. Atelier obsolète ? Les sites DBG ne sont mentionnés dans aucun deck.

## 5. Objets et tables clés

| Objet | Table | Notes |
|---|---|---|
| Affiche | `[T]/affiche.sql` | `affiche_id`, `cont_num`, `theme`, `repiquage`, `quantite`, `allee`, `rayon`, `rebus`, `validationAdmin`, `zone_Picking`, `a_conserver`. Colonnes `semaines`, `nombre_semaine` et `est_fusionne` présentes seulement dans l'entité EF. |
| Mouvement | `[T]/mouvement.sql` | Quantités ±. **Le stock = somme des mouvements.** |
| Livraison | `[T]/livraison.sql` | Une livraison = une réception ; table d'association `asso_livraison_affiche`. |
| Réception attendue | `[T]/tf_prepa_affiche.sql` | — |
| Ligne de préparation 2 m² / pliage | `[T]/tf_repart_calcul.sql` | Par destinataire et afficheur. |
| UM | `[T]/tf_UM.sql` | Code-barre « AASS-… ». Créée par le Colisage : rupture destinataire / contrat / format / type / thème / repiquage (et afficheur si `dest_dispatch` = O), découpage selon `tr_categorie_support.sup_qte_UM`. |
| Colis | `[T]/tf_colis.sql` | `no_recepisse`, `url_preuve_livraison`. |
| Train | `[T]/tf_face_train.sql` | Une ligne = une face, avec `pre_assemblage` et `ft_type` = « entretien ». |
| Instruction | `[T]/instruction_train.sql` | `instr_entretien` = 8 par défaut. |

## 6. Entretien

- **Fixe et pliage.** La quantité à préparer `rpc_qte` reçoit `QuantiteEntretien`, fourni par Broadcast pour chaque ligne destinataire / afficheur (`p_integ_preparation.sql:121,160`).
- **Trains.** Le pourcentage est porté par l'instruction. Le calcul (`[SP]/p_u_associe_train.sql:462-500`) :
  - regroupe par destinataire, thème avec repiquage, secteur d'emplacement, semaine et support ;
  - calcule `round(nb faces × % / 100)` ;
  - crée des faces supplémentaires dont l'afficheur vaut « **ENTRETIEN** » (ligne 596).
  - L'entretien n'est donc **pas rattaché à un afficheur** : ce constat éclaire REU-06.

## 7. Exports

**Règles communes aux CSV** : séparateur `;`, sans en-tête, encodage `Encoding.Default` (*déduit* : Windows-1252), suppression des caractères `: , ; * ’`.

- **2 m² fixe, « Export Préparation » (et V2).** Méthode : `[BLL]/PreparationService.cs:341-443`. Fichier `ExportPrepa2m2CIRCE_yyyyMMddHHmmssfff.csv`, une ligne par UM, colonnes dans cet ordre : Theme ; Quantite ; (vide) ; UmCodeBarre ; ContNum ; RpcRepartition ; Annonceur ; SupNom ; TypePrepa ; **SupPoids** ; Afficheur ; Destinataire ; DesAdr1 ; DesAdr2 ; DesLocalite ; DesPostal ; UMComment ; Repiquage.
  - Seule différence de la V2 : la colonne Repiquage est remplie.
  - *Écart* : l'outil Projet 1 décrit la colonne J comme « Qté / 4 arrondi », le code dit SupPoids.
- **Trains, « Export préparation ».** Les faces passent au statut 9. Règle des 20 tiroirs : `NbMaxThemeExportPrepa = 20` (`[BLL]/TrainPreparationBll.cs:22`). Le contrôle porte sur les couples (thème, repiquage) distincts et se fait **après** la mise à jour : le message s'affiche mais rien n'est annulé (`:285-290`). C'est ANO-13. Le code autorise **6 thèmes maximum par train** (`:23`), alors que le deck dit « jusqu'à 4 affiches ».
- **Trains, « Générer fichier V2 ».** Méthode : `[BLL]/TrainExportPrepaBll.cs:203-323` → `PreparationDeroulantsService.GenerateFileExportCaireV2` (`:558-600`). Fichier `ExportPrepaTrainsCIRCE<horodatage>.csv`, **une ligne par train** :
  - en-tête de ligne : TrainId ; Format ; Statut (« A ») ; Origine ; Afficheur ; Zone (« 3 ») ; Section (destinataire) ; Adresse1 ; Adresse2 ; CentreCommercial ; nb de contrats ; date de départ ; SupNom ; NewReferenceBroadcast ;
  - puis, pour chaque contrat (6 au plus) : Contrat ; Réseau ; Annonceur ; Thème ; Repiquage ; Rouleur ; Lettre.
  - La conversion en .ini reste manuelle, avec l'outil Caire.
- **« Export complet » et « Export optimisé ».** Ils appellent `p_u_exportTheme`, **absente du dépôt**.
- **Éditions.** Fiche de préparation détail et synthèse (Excel), bagues (`[W]/Reports/Rapport.cs:325-412`), étiquettes de colis et de rack (`Rapport.cs:174-310`, `731-788`). La « feuille de stock » du deck correspond vraisemblablement à l'étiquette rack, au format « A- » + 13 chiffres.

## 8. Bouton « Colisage » (2 m² fixe, écran A traiter)

Le bouton affiche « Confirmer Colisage ». La confirmation **crée les UM** à partir des lignes **filtrées** de la grille, et non à partir de toutes les lignes (`[W]/Controllers/Preparation/PreparationController.cs:429-477`, `PreparationService.BuildUm` `:101-257`). Les lignes passent alors au statut 1.

C'est cette création qui « fait redescendre » les dossiers dans l'atelier (S37). Le libellé « Colisage » est donc trompeur : voir FIX-06.

## 9. Mails existants

- **« Réception affiche ».** Envoyé à la création d'une réception, aux adresses de la table `tr_adresseMail_plateforme`. Les erreurs d'envoi sont ignorées silencieusement (`[BLL]/ToolBll.cs:383-447`).
- **« Déblocages ».** Envoyé à `tr_plateforme.plt_mail` (`[BLL]/AdminPreparationDeblocageBll.cs:221-267`).
- **« Un colis d'affiches vient de vous être expédié ».** Envoyé par le batch `BatchEnvoieMailColis` au manager ou au tiers afficheur (`[BLL]/BatchEnvoieMailColisBll.cs:33-232`). **Ce mail n'est cité dans aucun deck.**

## 10. Geodis

- **Envoi.** À l'expédition par Geodis, un fichier TXT `Export_<transporteur>_<horodatage>.txt` est généré (lignes « B; » et « I; »), puis l'utilisateur saisit à la main le code externe du colis (`[BLL]/PreparationExpeditionService.cs:150-223`).
- **Suivi.** Le batch `BacthCallZoom` interroge l'API Zoom de Geodis. **Anomalie** : le résultat de l'appel n'est pas affecté (`BacthCallZoomBll.cs:61`), donc le journal de suivi n'est jamais alimenté. La procédure `p_updateColisTransporteur` est absente du dépôt.
- **Statuts.** « Terminé » (8) est posé par la fin de journée, **pas par la preuve de livraison** (`[BLL]/ListeColisBll.cs:199-223`).

## 11. Stock

Le stock est la somme des mouvements. Ce qui le fait bouger :
- réception (+) ;
- ajout et sortie manuels dans la Liste des affiches ;
- « Activité de production » : −(quantité + rebut) (`[BLL]/ActiviteBll.cs:137-153`) ;
- vidage du rebut ;
- fusion d'affiches.

**Aucune sortie de stock automatique à la préparation ni à l'expédition** (constaté). REU-08 décrit donc un manque réel.

## 12. Interface Broadcast

- **Batch `BatchAlimPexCirce`** (`[BLL]/BatchAlimBll.cs:34-163`). Il couvre les flux destinataires, préparations (vers `tf_repart_calcul`, avec retour du statut à BC) et trains (`p_integ_deroulants`).
- **Batch `BatchAlimPexCirceGetInstrBc`.** Il lit l'état des réservations de S à S+8 et l'écrit dans `tf_prepa_Broadcast`.
- **Réceptions attendues.** Elles sont alimentées par `p_Alimentation_tf_prepa_affiche` (*déduit* : par un job SQL).
- **État des réservations.** Lu en direct dans Broadcast.
- **Retour vers Broadcast.** Le batch `BatchAlimPexCirceReception` alimente `CIRCE_PEX_RECEPTION`. Une affiche y est « associée » seulement si elle est liée **et** que `validationAdmin` = 1 (`[BLL]/BatchAlimReceptionBll.cs:89`). C'est le mécanisme d'**ANO-05**.
- **Fréquence de planification** : introuvable dans le dépôt.

## 13. Écran « Modifier une affiche »

- **Onglets** : Details, Mouvements, Préparations, Historique.
- **Validation admin.** La case est portée par `affiche.validationAdmin` (bit). Elle est visible seulement avec le droit `validation_admin`.
- **Pas de champ « affiche reçue » distinct** dans Circé. Le n° d'affiche n'apparaît dans la grille de préparation 2 m² que si `validationAdmin` = 1 (`[SP]/p_s_listeUM_2m2.sql:49-52,133-139`).

## 14. Données sensibles repérées (valeurs non recopiées)

- Chaînes de connexion : `[W]/Web.config:18-35`.
- SMTP, AD, chemins réseau, URL Geodis : `[W]/Web.config:47-83,256-260`, ainsi que les fichiers `Web.*.config` et les `App.config` des batchs.
- Logins codés en dur : `_Layout.cshtml:97-104`, `_LayoutSansBoostrap.cshtml:51-53`, `[W]/Helpers/UserHelperNew.cs:26-34`, `UserHelper.cs:32-34`, `BDD/DATA/sprint4.circe.MajData.sql:31-57`.
- Adresse e-mail codée en dur : `BatchEnvoieMailColisBll.cs:203`.
- Référence Geodis codée en dur : `BacthCallZoomBll.cs:222`.

## 15. Procédures appelées mais absentes du dépôt

`p_u_exportTheme`, `p_updateColisTransporteur`, `p_u_duplication_train`, `p_s_affiche_a_fusionner`, `p_GetListeAfficheFusionnees`, ainsi que les procédures Broadcast `ope.P_*`.

## 16. Réception (relevé du 19/10, branche `develop`, commit c4f24d8)

Lu dans l'historique git, en lecture seule. Préfixes : `[W]` = `ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE/` ; `[B]` = projet BLL ; `[SQL]` = `BDD/DATABASE/DATABASE/dbo/`. Tout est CONSTATÉ.

**Menu Réception** (`[W]/Views/Shared/_MenuNew.cshtml:100-114`) : Réception des affiches (`LivraisonAffiche/Index`), Liste des affiches (`ReceptionListeAffiche/Index`), Zone picking (droit `Zone_Picking`), Fusion des affiches (droit `fusion_affiche`). Écran lié : Suivi › Etat de destruction (:129).

**Réception des affiches** (`[W]/Views/LivraisonAffiche/Index.cshtml`, `LivraisonAfficheController.cs`, `[B]/LivraisonAfficheService.cs`) :
- recherche : site, « Historique » (sans effet de filtre, `[B]:205-227`), semaines et années de début et de fin (par défaut de la semaine courante à +8), « Afficher : Réception Attendues / Réceptions » (`Index.cshtml:12-76`, `LivraisonAfficheModel.cs:48-53`) ;
- cadre « Saisie réception » : nombre de lignes du panier, « Vider le panier » ; bouton « Ouvrir Réception » ; un panier vide donne une réception orpheline (`LivraisonAfficheController.cs:168-176`) ;
- grille des réceptions attendues : « + » par ligne (met au panier et masque la ligne) ; colonnes Dossier, Semaine, Année, DAChapeau, Annonceur, Thème, repiquage, Format, Qte théo, Qte reçues, Statut réception, « Terminé » ou « Partiel » (`Partial_GridAfficheList.cshtml:8-20`, `DefaultLivraisonModel.cs:37`) ;
- grille des réceptions faites : n° de livraison, date, dossier, semaine, année, annonceur, imprimeur, BL, transporteur, thème, format, quantités, statut, crayon de modification (`Partial_GridLivraisonList.cshtml:8-24`) ;
- fenêtre de création (`CreationLivraisonView.cshtml`) : Date de livraison* (:15-24), Nombre de colis (:26-31), BL imprimeur* (:35-44), Ref dossier reçu (:45-51), Transporteur* (:55-67), Déchargé par (:68-74), Imprimeur* (:78-90), Ref DA (:91-97), Commentaire (:101-102), pièces jointes (:104-111). Lignes : Dossier, Nb semaine, Semaines, Annonceur, Format, Thème, repiquage, quantité, bouton « Ajouter » ; pour une orpheline, en plus : Allée, Rayon, Qté reçue, Compté (`Partial_GridAfficheOrpheline.cshtml:19-38`) ;
- fenêtre de modification (`ModifierLivraisonView.cshtml`) : mêmes champs et pièces jointes ; une « Qté reçue » saisie ajoute un mouvement, c'est ainsi qu'on complète une réception (`[B]:763-803`) ;
- règles : une affiche est liée à toutes les préparations de même dossier, format, annonceur, thème, site et semaine (`[B]:434-476`) ; affiche déjà existante : quantité mise à jour et nouvelle association (`[B]:479-486`) ; une réception partielle reste dans les attendues (`[SQL]/Functions/Fn_GetPrepaAffiche.sql:188-218`) ; mail « Réception affiche » (`[B]:930-942`, `ToolBll.cs:383-440`).

**Liste des affiches** (`[W]/Views/ReceptionListeAffiche/Index.cshtml`, `[B]/ReceptionListeAfficheBll.cs`) :
- recherche : site, historique, du / au (un mois glissant), résultat Tous / à traiter / Rebus / Fusionnées (:15-64) ; compteurs : lignes, affiches hors rebut, affiches au rebut ;
- boutons « Vider le rebus » (:86-94), « Edition picking » (:96-98), « Fusionner » (:99-104) ;
- colonnes : N°, Zone (Réceptionnée ou Picking), Format, Date entrée, Dossier, Semaines, Nombre semaine, Annonceur, Validation Admin, Thème, Repiquage, Conservation, Quantité, Dernier départ (en rouge si dépassé), Allée, Rayon, Orpheline, EstFusioné, Rebus, Date de destruction, Dernière sortie (:124-151) ;
- actions de ligne : Modifier, Ajouter (entrée de stock), Sortir (sortie), Mettre au rebus, Imprimer l'étiquette rack (:152-169) ;
- « Modifier une affiche » (`[W]/Views/Shared/DetailAffiche/_DetailAffiche.cshtml`) : onglet Details (date d'entrée, validation admin, affiche à conserver qui force la conservation à 365, campagne, repiquage, semaines, nombre de semaines, annonceur, dernier départ, thème, conservation, format, commentaire, image, quantité, zone picking, allée, rayon) ; Mouvements (référence, date, BL, équipe, machine, transporteur, imprimeur, quantité, comptée) ; Préparations (quantité BC et reçue, « + Ajouter Préparation » par recherche, dissociation) ; Historique (fusions) ;
- impressions : étiquette rack (`[W]/Reports/EtiquetteRackAffiche.rdlc`, `Rapport.cs:731-788`), imprimée d'office quand la validation admin est cochée depuis la Liste (`ReceptionListeAfficheController.cs:177,189-192`) ; liste de picking par semaine (`EditionPicking.rdlc`, `[SQL]/Stored Procedures/p_EditionPicking.sql:46-51`) ;
- règles : vidage du rebus = quantité à 0 et mouvement « Vidage du rebus » (`[B]:297-325`) ; conservation de 20 par défaut (`[B]:213`) ; « Aff. reçues » de l'état des réservations = affiche validée admin (`SuiviEtatReservationBll.cs:177-195`) ; export vers Broadcast si l'affiche est liée et validée admin (`BatchAlimReceptionBll.cs:89`).

**Zone picking** (`[W]/Views/ZonePicking/Index.cshtml`, `[B]/ZonePickingBLL.cs`) : liste des affiches en zone picking ; « Ajouter du Picking » par douchage du code-barres de l'affiche ; « Edition Activité » (fiche activité) et « Douchage Activité » (date, équipe, machine, affiche, quantité, rebut : un mouvement négatif, `ActiviteBll.cs:113-153`).

**Fusion des affiches** (`[W]/Views/FusionAffiche/Index.cshtml`, `[B]/FusionAfficheBll.cs:61-245`) : candidates groupées par affiche chapeau (procédure `p_s_affiche_a_fusionner`, SQL non versionné) ; quantités additionnées, mouvements, préparations et réceptions rattachés à la chapeau.

**Absent du code** : la « feuille de stock » des decks est l'étiquette rack ; pas d'écran « Identification » ; pas de suppression d'une réception ; pas de purge des réceptions attendues.

**Anomalies de l'existant, à ne pas reprendre** : Ref DA effacée à chaque modification (`ModifierLivraisonView.cshtml:97` contre `LivraisonListeAffiche.js:467`) ; colonnes décalées à l'enregistrement d'une modification (`LivraisonListeAffiche.js:508-517`) ; corbeille de modification inopérante (`ModifierLivraisonView.cshtml:191` contre `LivraisonListeAffiche.js:121`) ; transporteur ou imprimeur inconnu jamais créé dans le référentiel (`LivraisonAfficheController.cs:404-414`) ; « Vider le rebus » de la zone picking à 0 (`ZonePickingBLL.cs:483-487`), et sur le site de la dernière recherche partout ; « Edition Activité » sans sélection (`Activite.js:122`) ; statut « Picking » affiché à tort (`ZonePickingBLL.cs:905`) ; case « zone picking » mal ciblée (`ReceptionListeAffiche.js:574-580`) ; erreur JavaScript au message d'une fusion homogène (`ReceptionListeAffiche.js:722`) ; dissociation historisée comme une association (`HistorisationBll.cs:68-75`).
