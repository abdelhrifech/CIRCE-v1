# Legacy — Module COORDINATION (analyse de l'existant, règles provisoires)

> Source analysée : `circe-develop/` (lecture seule). Aucune règle n'est déduite de la cible : les docs-sources ont servi uniquement à choisir le périmètre.
> Chemins abrégés : `[R]` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE` ; `[W]` = `[R]/ClearChannel.CIRCE` (projet Web) ; `[BLL]` = `[R]/ClearChannel.CIRCE.BLL` ; `[REP]` = `[R]/ClearChannel.CIRCE.Repositories` ; `[SQL]` = `circe-develop/BDD/DATABASE/DATABASE/dbo` ; `[W]/Ctrl` = `[W]/Controllers`.
> Les numéros de ligne sont ceux de la branche `develop` présente sur disque (ils diffèrent de ceux cités dans les docs-sources, rédigés sur une autre révision).

## 0. Périmètre retenu (et écarté)

### 0.1 Pourquoi ce périmètre
Le legacy n'a aucun module « Coordination ». La cible (`docs-sources/2. CIRCE CIBLE + MAQUETTE/2. COORDINATION/*.html`) décrit la Coordination comme : (a) fiabilisation des **réceptions attendues** (doublons, tables `tf_prepa_affiche` / `tf_prepa_Broadcast`), (b) **validation admin** des affiches reçues, (c) **Instruction OK** des déroulants, (d) **export des trains** du jeudi, (e) alertes d'écart Broadcast/Circé. J'ai donc cherché dans le legacy les objets qui portent aujourd'hui ces fonctions (flux Broadcast → Circé, rattachement affiche ↔ ligne attendue, instructions, trains, déblocage), sans reprendre aucune règle de la cible.

### 0.2 Retenu (analysé en profondeur)
| Bloc | Objets legacy lus |
|---|---|
| Alimentation des réceptions attendues (batch) | `[SQL]/Stored Procedures/p_Alimentation_tf_prepa_affiche.sql`, `[SQL]/Functions/Fn_GetPrepaAffiche.sql`, `[BLL]/BatchAlimGetInstructionBc.cs` + `BatchAlimPexCirceInsBC/Program.cs`, `[REP]/LivraisonAfficheRepository.cs` (CreateOrUpdatePreparationBC) |
| Rattachement affiche ↔ ligne attendue, validation admin | `[BLL]/LivraisonAfficheService.cs` (CreateLivraison), `[BLL]/ReceptionListeAfficheBll.cs`, `[W]/Ctrl/ReceptionListeAfficheController.cs`, `[BLL]/HistorisationBll.cs`, `[BLL]/BatchAlimReceptionBll.cs`, `[BLL]/FusionAfficheBll.cs` (partiel) |
| État des réservations / suivi | `[BLL]/SuiviEtatReservationBll.cs` + Repository, `[SQL]/Stored Procedures/p_s_adminSuiviRead.sql` (partiel) |
| Intégration prépa fixe/pliage | `[SQL]/Stored Procedures/p_integ_preparation.sql`, `[BLL]/BatchAlimBll.cs` |
| Intégration trains/instructions déroulants | `p_integ_deroulants.sql`, `p_integ_train_affiches.sql`, `p_integ_instructions.sql` |
| Instructions, Instruction OK, trains, export | `p_u_statut_preparation.sql`, `p_u_associe_train.sql`, `[BLL]/TrainListeInstructionBll.cs`, `[W]/Ctrl/Preparation/PreparationController.cs` (L.1230-1391), `[W]/Ctrl/PreparationDeroulants/PreparationDeroulantsController.cs`, `[BLL]/PreparationDeroulantsService.cs`, `[REP]/PreparationRepository.cs` (export/instructions), `[REP]/PreparationDeroulantsRepository.cs` |
| Trains : suivi par thème, préparation, export prépa | `[BLL]/TrainSuiviThemeBll.cs` + Repository, `[BLL]/TrainPreparationBll.cs` + Repository, `[REP]/TrainExportPrepaRepository.cs` |
| Déblocage de préparation | `[BLL]/AdminPreparationDeblocageBll.cs` + Repository + Controller + View, `p_u_statut_repart_deblocage.sql`, `p_s_controle_rendumain.sql`, `[BLL]/AdminSuiviDeblocageBll.cs`, `[BLL]/RepartitionService.cs` + `[REP]/RepartitionRepository.cs` + `RepartitionController.cs`, `circe-develop/docs/regles-inclusion-exclusion-deblocage.md` (document du dépôt, vérifié contre le code) |
| Divers | `DuplicationTrain*` + `p_u_duplication_train.sql`, `AdminContratRepository.cs` (rafraîchir un dossier), droits (`CommunBll.cs`, `_MenuNew.cshtml`) |

### 0.3 Écarté ou survolé (voir aussi §6)
- **Réception pure** (création de livraison, orphelines, rebus, picking, fusion) : module Réception, traité par ailleurs. Je ne cite que les points d'interface avec la coordination.
- **Production/expédition 2 m² fixe et pliage** (`PreparationService` côté UM, `PreparationColis*`, `PreparationColisage*`, `PreparationExpedition*`, `_2m2FixePreparation*`, `Preparation2m2Fixe.js`, `ListeColis*`, Geodis, `BatchEnvoieMailColis`, `BacthCallZoom`) : c'est la **production** (atelier), pas la coordination. Non analysé.
- **Déroulants côté UM/colis** (`PreparationColisTrain*`, `PreparationDeroulantBll` côté colisage) : production. Non analysé.
- **Bus** (`PreparationBusMockRepository`, droits `bus` / `bus_a_traiter`, feature flag `IsBusV3`) : hors périmètre fonctionnel de la cible Coordination. Non analysé.
- **SSIS** `BDD/SSIS_Circe` (`Flux_Repartition_Amt_Ptf`) et procédures `p_integ_ptf_*` (flux Sybase AMT historique) : seulement cités (§6).

---

## 1. Règles — A. Alimentation des « réceptions attendues » (`tf_prepa_affiche`)

### RG-COO-001 (provisoire) — Copie de l'état des réservations Broadcast dans `tf_prepa_Broadcast`
- Description : un batch lit l'état des réservations Broadcast sur une fenêtre de semaines et recopie les lignes dans `tf_prepa_Broadcast`. Pour chaque dossier présent dans la lecture, toutes les lignes existantes du dossier sont supprimées puis recréées.
- Déclencheur : batch `BatchAlimPexCirceGetInstrBc` (fréquence de planification introuvable dans le dépôt).
- Conditions : fenêtre = semaine courante → semaine courante + `weeks` (paramètre de config `weeks`), bascule d'année si dépassement ; semaine calculée avec la culture courante (`CalendarWeekRule` / `FirstDayOfWeek` de la machine). `sup_id` déduit par table `Transaco_Surface_Format` (surface × format) et vaut 0 si introuvable ; `repiquage` = `Bandeau`.
- Effet : `tf_prepa_Broadcast` = image du dernier état lu, par dossier ; les lignes d'un dossier absent de la lecture ne sont pas touchées (jamais purgées).
- Statuts concernés : sans objet (copie ; `StatutPreparation` Broadcast copié tel quel, ex. « Envoyé »).
- Profils : traitement automatique.
- Source : `[BLL]/BatchAlimGetInstructionBc.cs:47-65,96-117,120-129` ; `[REP]/LivraisonAfficheRepository.cs:328-345` (variante SQL `DELETE ... IN (...)` : `:347-361`, concaténation de chaîne).
- Confiance : CERTAINE pour le delete/recreate par dossier ; INCERTAINE sur la variante réellement appelée (`CreateOrUpdatePreparationBC` est appelée en `BatchAlimGetInstructionBc.cs:117`, la variante `...Batch` n'est pas appelée dans ce fichier).

### RG-COO-002 (provisoire) — Fenêtre d'alimentation S → S+8 en semaines « américaines » et branche fin d'année
- Description : la procédure d'alimentation travaille sur la semaine courante + 8 avec `DATEPART(wk)` (non ISO). Si `semaine + 8` dépasse le nombre de semaines de l'année, une branche « fin d'année » est utilisée.
- Déclencheur : exécution de `p_Alimentation_tf_prepa_affiche` (appelant non versionné, voir §6).
- Conditions : `@week + 8 <= @maxWeekPerYear` sinon branche 2.
- Effet : lignes hors fenêtre ignorées ; `Fn_GetPrepaAffiche` utilise aussi `DATEPART(wk)` pour `@maxWeekPerYear`.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `[SQL]/Stored Procedures/p_Alimentation_tf_prepa_affiche.sql:23-25,85-105,153-237` ; `[SQL]/Functions/Fn_GetPrepaAffiche.sql:42,277,315`.
- Confiance : CERTAINE pour le calcul ; INCERTAINE sur le comportement en production à la mi-novembre (le fichier lu a une branche 2 syntaxiquement plausible ; le constat « colonne écrite deux fois » des docs-sources n'est pas vérifiable sur cette révision, non déduit ici).

### RG-COO-003 (provisoire) — Trois sources de lignes attendues
- Description : les lignes de `tf_prepa_affiche` sont créées depuis (1) `tf_repart_calcul` (fixe/pliage, quantité = somme `rpc_qte`), (2) `tf_face_train` (déroulants, quantité = `count(ft_id)`, thème non nul), (3) la copie Broadcast (`FromBroadcast = 1`, quantité = somme).
- Déclencheur : batch d'alimentation.
- Conditions : (1) et (2) `rpc_statut <> 4` ; (3) `StatutPreparation` Broadcast différent de « Envoyé » (ou nul) et destinataire différent de « Plateforme Derichebourg Lyon » / « Plateforme Derichebourg » (valeurs codées en dur).
- Effet : lignes insérées dans une table de travail puis dans `tf_prepa_affiche`.
- Statuts concernés : `FromBroadcast` : (absent) → `1` (source Broadcast) ou `NULL` (source prépa).
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:126-130,157-188,194-235`.
- Confiance : CERTAINE.

### RG-COO-004 (provisoire) — Plateforme d'une ligne Broadcast retrouvée par le nom du destinataire
- Description : `plt_id` = plateforme dont le nom est contenu (LIKE, insensible à la casse) dans `DestinataireEffectif`.
- Déclencheur : batch d'alimentation.
- Conditions : sous-requête scalaire sur `tr_plateforme` ; erreur SQL si plusieurs correspondances, `plt_id` nul si aucune.
- Effet : une ligne sans plateforme n'est jamais reconnue par la règle de non-recréation (RG-COO-005).
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:134-136,187`.
- Confiance : CERTAINE (code) ; effet sur les doublons PROBABLE.

### RG-COO-005 (provisoire) — Une ligne n'est créée que s'il n'existe pas déjà une ligne de mêmes textes
- Description : la non-duplication repose sur un `NOT EXISTS` comparant des **textes** (dossier, annonceur, plateforme, semaine, année, support, thème), pas des identifiants. Pour la source Broadcast, le thème n'est pas dans la comparaison et la quantité est dans le `GROUP BY`.
- Déclencheur : batch d'alimentation.
- Conditions : voir ci-dessus ; la table cible n'a pas de contrainte d'unicité métier (lecture de `tf_prepa_affiche` non faite en détail ; voir §6).
- Effet : deux lignes de textes légèrement différents (casse, espace, quantité) coexistent.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:166-167,178-179,184-188`.
- Confiance : CERTAINE (code) ; PROBABLE pour la conclusion « source des doublons » (à confirmer sur les données).

### RG-COO-006 (provisoire) — `MERGE` d'insertion qui ne peut jamais « matcher »
- Description : le `MERGE` vers `tf_prepa_affiche` joint sur 14 colonnes dont `C.cont_num = S.sup_id`, `dateCreated`, `dateModified` (= NULL côté source) et des colonnes potentiellement NULL ; la clause `WHEN NOT MATCHED BY TARGET` est donc quasi toujours vraie.
- Déclencheur : batch d'alimentation.
- Conditions : égalités SQL (NULL ≠ NULL).
- Effet : insertion systématique de ce que la table de travail contient ; seule la règle RG-COO-005 évite les répétitions.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:239-263`.
- Confiance : PROBABLE (déduit de la lecture du `ON` ; non testé sur données).

### RG-COO-007 (provisoire) — Drapeau `ARecevoir` réarmé quand la prépa arrive sur une ligne déjà reçue
- Description : avant l'insertion, la liste des lignes déjà reçues (`ARecevoir = 1`) est mémorisée ; après insertion, toute ligne de même (dossier, support, semaine, plateforme, thème ou thème nul) passe à `ARecevoir = 1`.
- Déclencheur : batch d'alimentation.
- Conditions : correspondance sur `cont_num`, `sup_id`, `sem_num`, `plt_id` et (`rpc_theme` égal ou nul).
- Effet : une ligne créée après réception est marquée « reçue » (elle sort de la liste des attendues).
- Statuts concernés : `ARecevoir` : 0/NULL → 1.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:139-149,267-271`.
- Confiance : CERTAINE.

### RG-COO-008 (provisoire) — Correctif « Doublon CIRCE Réception » (IT-62195) : mise à jour des lignes Broadcast sans critère de thème
- Description : les lignes `FromBroadcast = 1` reçoivent thème, annonceur et quantité de la copie Broadcast jointe sur dossier, support, année, semaine et plateforme (sans le thème).
- Déclencheur : batch d'alimentation (à chaque passage).
- Conditions : `Table_A.FromBroadcast = 1`.
- Effet : si un dossier a deux thèmes sur la même clé de jointure, chaque ligne a plusieurs correspondances : la valeur retenue est arbitraire en SQL Server.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:273-289`.
- Confiance : CERTAINE (code) ; effet « thème mélangé » PROBABLE.

### RG-COO-009 (provisoire) — Bascule d'une ligne « Broadcast » en ligne « prépa » (IT-62066)
- Description : une ligne `FromBroadcast = 1` repasse à `NULL` quand la prépa correspondante existe (dans `tf_repart_calcul` non annulé, ou dans `tf_face_train` de départ futur non annulé) **et** que toutes les lignes du même groupe de textes sont « Broadcast ».
- Déclencheur : batch d'alimentation.
- Conditions : égalité exacte (dossier, support, annonceur, année, semaine, **thème**) ; `rpc_statut <> 4` ; `total = nb lignes FromBroadcast = 1` du groupe.
- Effet : la ligne perd l'indicateur Broadcast ; si une affiche y est rattachée elle reste rattachée. Si les textes diffèrent, la ligne Broadcast reste et la ligne prépa est ajoutée à côté (cf. RG-COO-005).
- Statuts concernés : `FromBroadcast` 1 → NULL.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:291-354`.
- Confiance : CERTAINE.

### RG-COO-010 (provisoire) — Lignes « bandeau » dédiées (support 100/102/105/107)
- Description : pour les supports 5, 26, 1026 (→ 100), 19 (→ 102), 27 (→ 105) et, côté trains, 29 (→ 107), des lignes attendues « bandeau » sont créées (quantité = somme repiquage), ou mises à jour si elles existent, par (thème-repiquage, support, dossier, semaine, année, atelier).
- Déclencheur : batch d'alimentation.
- Conditions : `rpc_repiquage` / `repiquage` non nul ; `rpc_statut <> 4` ; fenêtre S → S+8.
- Effet : insert/update de `tf_prepa_affiche` avec `ate_id` ; l'`ate_id` est écrasé par celui du bandeau.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:356-546`.
- Confiance : CERTAINE.

### RG-COO-011 (provisoire) — Renseignement de `IdDAChapeau` après insertion
- Description : les lignes nouvellement insérées sans DA chapeau la reprennent de `tf_prepa_Broadcast` par (dossier, semaine, année).
- Déclencheur : batch d'alimentation.
- Conditions : `tf.IdDAChapeau is null`, jointure sur `@inserted`.
- Effet : mise à jour de `IdDAChapeau` (une seule valeur pour tout le triplet, quelle que soit la DA).
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:548-562`.
- Confiance : CERTAINE.

### RG-COO-012 (provisoire) — Transaction et gestion d'erreur de l'alimentation
- Description : toute la procédure est dans une transaction ; le code d'erreur n'est testé qu'une fois en fin de procédure (`@@error` après le dernier bloc), un rollback n'est donc déclenché que si la dernière instruction a échoué.
- Déclencheur : batch d'alimentation.
- Conditions : `select @error = @@error` ligne 566.
- Effet : un échec en milieu de procédure peut laisser la transaction commitée partiellement (comportement SQL Server selon `XACT_ABORT`, non précisé).
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_Alimentation_tf_prepa_affiche.sql:151,566-588`.
- Confiance : INCERTAINE (dépend de la configuration `XACT_ABORT` de la session, non visible).

### RG-COO-013 (provisoire) — Écran des attendues : filtre sur `ARecevoir` / rattachement et reste à recevoir
- Description : la liste des « réceptions attendues » d'une plateforme et d'une plage de semaines contient (a) les lignes non reçues (`ARecevoir` 0/NULL) **et** sans affiche rattachée, (b) les lignes ayant une affiche rattachée mais dont la quantité théorique est supérieure à la somme des mouvements de l'affiche (réception partielle). Aucun filtre sur la source (`FromBroadcast`).
- Déclencheur : écran Réception des affiches (`p_GetPrepareListAffiches` → `Fn_GetPrepaAffiche`).
- Conditions : par plateforme (`plt_id`) ; plage d'années identique ou à cheval (deux branches).
- Effet : lecture seule. Mode « livraison » (`@isLivraison = 1`) : lignes déjà reçues rattachées à une livraison de la période.
- Statuts concernés : sans objet.
- Profils : tout utilisateur ayant accès à l'écran Réception (droit `reception_liste_affiche`).
- Source : `[SQL]/Functions/Fn_GetPrepaAffiche.sql:44-103,106-221,224-343` ; `[BLL]/LivraisonAfficheService.cs:70-75`.
- Confiance : CERTAINE.

## 2. Règles — B. Rattachement affiche ↔ ligne attendue et validation admin (interface réception → coordination)

### RG-COO-020 (provisoire) — La réception rattache l'affiche à toutes les lignes attendues de mêmes textes
- Description : à la création d'une livraison, l'affiche créée est rattachée à la ligne choisie **et** à toutes les lignes de `tf_prepa_affiche` ayant mêmes (dossier, format texte, annonceur, thème, plateforme, semaine, année) ; pour les formats texte « 2m2 », « 2 m2 », « 2m2 Scrolling », « 2m2 Venusial », à toutes les lignes 2 m² de même dossier/annonceur/thème (ou thème nul)/plateforme/semaine, quel que soit le format précis.
- Déclencheur : « Ouvrir Réception » / validation de la fenêtre de création (LivraisonAffiche).
- Conditions : l'affiche n'existe pas encore (`affiche_id <= 0`) ; sinon (affiche existante) la quantité de l'affiche est remplacée par la quantité saisie, sans nouveau rattachement.
- Effet : `tf_prepa_affiche.affiche` = nouvelle affiche et `ARecevoir = true` pour toutes ces lignes ; historique « CreationAffiche ».
- Statuts concernés : ligne attendue : `ARecevoir` 0/NULL → 1 ; `affiche_livraison_Id` NULL → id affiche.
- Profils : Réception.
- Source : `[BLL]/LivraisonAfficheService.cs:427-486,522-527` ; `[REP]/LivraisonAfficheRepository.cs:392-413`.
- Confiance : CERTAINE.

### RG-COO-021 (provisoire) — Réception sans ligne attendue : affiche « orpheline »
- Description : une ligne de réception qui ne correspond à aucune ligne attendue (ajout manuel) crée une affiche sans rattachement ; une réception à panier vide donne une livraison orpheline.
- Déclencheur : création de livraison (LivraisonAffiche).
- Conditions : `prepa_affiches.SingleOrDefault(...)` nul (branche « Grid_Affiche_Broadcast »).
- Effet : affiche avec `plt_id`, `sup_id` déduit du format texte, sans `tf_prepa_affiche_Id`. Elle remonte ensuite dans les listes d'orphelines (`isOrpheline`, `p_GetDataReceptionOrpheline`) tant qu'aucune ligne n'est rattachée.
- Statuts concernés : affiche : (nouvelle) → orpheline.
- Profils : Réception.
- Source : `[BLL]/LivraisonAfficheService.cs:493-518` ; `[REP]/LivraisonAfficheRepository.cs:30-37,597-601`.
- Confiance : CERTAINE.

### RG-COO-022 (provisoire) — Rattachement manuel d'une affiche à des lignes attendues
- Description : depuis la fiche d'une affiche, on associe des lignes attendues trouvées par recherche (dossier / annonceur / thème / format / départ) ; seules les lignes **sans** affiche sont rattachées, les autres sont ignorées sans message.
- Déclencheur : « + Ajouter préparation » (fiche affiche).
- Conditions : `affiche_Id > 0` ; ligne avec `affiche_livraison_Id == null`.
- Effet : `affiche_livraison_Id = afficheId`, `ARecevoir = true`, `date_maj` de l'affiche mise à jour, historique « AfficheAssocier ».
- Statuts concernés : ligne attendue : non rattachée → rattachée/reçue.
- Profils : accès à la fiche affiche (droit `reception_liste_affiche`) ; boutons conditionnés par `validation_admin` (voir RG-COO-026).
- Source : `[BLL]/ReceptionListeAfficheBll.cs:533-555` ; `[W]/Views/Shared/DetailAffiche/Partial/Partial_GridAssoc_prepa_affiche.cshtml:42`.
- Confiance : CERTAINE.

### RG-COO-023 (provisoire) — Dissociation : le lien est supprimé mais `ARecevoir` n'est pas remis à zéro
- Description : la dissociation met `affiche_livraison_Id = NULL` sans toucher `ARecevoir`. La ligne reste « reçue » mais plus rattachée ; elle n'apparaît plus dans les attendues (qui exigent `ARecevoir` 0/NULL, cf. RG-COO-013) ni comme reçue rattachée.
- Déclencheur : action de dissociation (fiche affiche).
- Conditions : aucun contrôle de statut (même après validation admin).
- Effet : historique « AfficheDissocier ».
- Statuts concernés : ligne attendue : rattachée → non rattachée, `ARecevoir` inchangé (1).
- Profils : accès fiche affiche.
- Source : `[BLL]/ReceptionListeAfficheBll.cs:577-586` ; `[SQL]/Functions/Fn_GetPrepaAffiche.sql:159-160`.
- Confiance : PROBABLE (effet sur l'affichage déduit de la lecture croisée ; `ARecevoir` pourrait être remis à jour ailleurs, non trouvé).

### RG-COO-024 (provisoire) — Ouverture de la fiche d'une affiche = rattachement automatique (effet de bord d'une lecture)
- Description : à l'ouverture de « Modifier une affiche » depuis une liste filtrée, si l'affiche n'a **aucune** préparation associée et **n'est pas** validée admin, le contrôleur cherche toutes les lignes attendues du **même dossier / plateforme / support** et les rattache toutes d'office.
- Déclencheur : action `_Modifier(affiche_id, isFiltredList = true)`.
- Conditions : `!preparations.Any() && !validationAdmin && isFiltredList`.
- Effet : appel de `ValiderAssocPrepaAffiche` ; `quantitePrepa` du modèle = somme des quantités théoriques rattachées. Aucune confirmation utilisateur.
- Statuts concernés : lignes attendues du dossier : non rattachées → rattachées (+ `ARecevoir = true` via RG-COO-022).
- Profils : tout utilisateur pouvant ouvrir la fiche.
- Source : `[W]/Ctrl/ReceptionListeAfficheController.cs:218-257`.
- Confiance : CERTAINE (code) ; intention métier INCERTAINE (la fonction `ValiderAssocPrepaAffiche` n'a pas été lue en détail).

### RG-COO-025 (provisoire) — Formats de saisie : dossier, semaines, nombre de semaines (validation côté back, fiche affiche)
- Description : le contrôleur refuse la sauvegarde d'une affiche si : n° de dossier mal formé (séparateur `+`), semaines mal formées (séparateurs `+` ou `/`), nombre de dossiers ≠ nombre de semaines, `nombre_semaine` ≠ nombre de semaines, ou incohérence présence/absence de `nombre_semaine` et `semaines`. Messages : constantes `FormatDossierIncorrect`, `FormatSemaineIncorrect`, `DossierSemaine`, `NombreSemaineSemaine`.
- Déclencheur : validation de la fiche affiche (création/ajout/mise à jour/sortie).
- Conditions : voir description.
- Effet : retour JSON du message, aucune écriture.
- Statuts concernés : sans objet.
- Profils : accès fiche affiche.
- Source : `[W]/Ctrl/ReceptionListeAfficheController.cs:131-173`.
- Confiance : CERTAINE (les textes des constantes n'ont pas été lus).

### RG-COO-026 (provisoire) — Validation admin : case à cocher sans contrôle de cohérence côté serveur
- Description : la validation admin est un booléen `affiche.validationAdmin`, éditable par la fiche affiche. Le front n'affiche la case et les actions d'association que si l'utilisateur a le droit `validation_admin`. Le back (`ModificationReception`) recopie la valeur postée sans vérifier le droit, la présence d'une préparation associée, ni la quantité.
- Déclencheur : enregistrement de la fiche affiche (Liste des affiches / Zone picking).
- Conditions : front : `EstAutorise(validation_admin)` ; back : aucune.
- Effet : `aff.validationAdmin = model.validationAdmin` ; historisation « ModificationValidationAdmin » (coché / décoché) ; date de dernier départ recalculée par ailleurs.
- Statuts concernés : `validationAdmin` : false/NULL ↔ true (cycle libre).
- Profils : droit `validation_admin` (front uniquement).
- Source : `[W]/Views/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:24` ; `[BLL]/ReceptionListeAfficheBll.cs:837-889` (L.867) ; `[BLL]/HistorisationBll.cs:29-32` ; `[BLL]/CommunBll.cs:276-303`.
- Confiance : CERTAINE.

### RG-COO-027 (provisoire) — Passage à « validée » = impression automatique de l'étiquette rack
- Description : quand la validation admin passe de non cochée à cochée, le serveur envoie un rapport (étiquette rack) ; aucun effet au décochage.
- Déclencheur : enregistrement de la fiche affiche (Liste des affiches ; idem Zone picking).
- Conditions : `model.validationAdmin && statutPrecedent != model.validationAdmin`.
- Effet : `EnvoyeReport(model)`.
- Statuts concernés : `validationAdmin` false → true.
- Profils : celui qui coche (droit `validation_admin`).
- Source : `[W]/Ctrl/ReceptionListeAfficheController.cs:177,189-192` ; `[W]/Ctrl/ZonePickingController.cs:133`.
- Confiance : CERTAINE (comportement de `EnvoyeReport` non lu en détail).

### RG-COO-028 (provisoire) — Effets aval de `validationAdmin` : « Aff. reçues » de l'état des réservations
- Description : dans l'état des réservations, une ligne est « reçue » (`oui`) s'il existe une ligne attendue de même (dossier, semaine, année, thème **texte**) dont l'affiche est validée admin et dont le support (`sup_id`) appartient aux supports résolus par (famille du type de préparation × surface). Aucune comparaison de quantité.
- Déclencheur : ouverture / lecture de « Etat des réservations ».
- Conditions : `affiche != null && validationAdmin == true` ; sinon `AffRecus = "no"`.
- Effet : colonne `AffRecus` ; `SupId` déduit de `transcoCategSupport` par surface (premier trouvé).
- Statuts concernés : sans objet (calcul à l'affichage).
- Profils : droit `suivi_suivi_production` (menu Suivi).
- Source : `[BLL]/SuiviEtatReservationBll.cs:172-201`.
- Confiance : CERTAINE.

### RG-COO-029 (provisoire) — Effet aval de `validationAdmin` : retour vers Broadcast (`EstAssociee`)
- Description : le batch de retour vers Broadcast envoie les affiches avec `EstAssociee = true` seulement si une préparation est rattachée **et** que `validationAdmin = true` ; destinataire fixe « CIRCE » ; site déduit de `plt_id` (1 → 39, sinon 40).
- Déclencheur : batch `BatchAlimPexCirceReception`.
- Conditions : ligne envoyée si `IdDAChapeau` non nul, ou (`cont_num != "0"` et semaine/année renseignées).
- Effet : insertion dans `CIRCE_PEX_RECEPTION` (INTERFACE) puis export vers EXTPLAY ; flag « envoyé » posé sur `affiche`.
- Statuts concernés : `affiche` : non envoyée → envoyée.
- Profils : automatique.
- Source : `[BLL]/BatchAlimReceptionBll.cs:41-50,65-95`.
- Confiance : CERTAINE. Note : `plt_id == 1 ? 39 : 40` ignore DBG / DBG Lyon (L.79).

### RG-COO-030 (provisoire) — Effet aval de `validationAdmin` : suivi de production
- Description : le suivi de production présente les affiches reçues (rattachées à une ligne attendue non Broadcast, validées admin) puis les répartitions (`tf_repart_calcul` + UM), puis les faces de trains, limités aux ateliers de l'utilisateur. Un n° d'affiche n'est visible que si validation admin.
- Déclencheur : écran Suivi de production.
- Conditions : `aff.validationAdmin = 1 and (FromBroadcast = 0 or null)` ; périmètre `tr_utilisateur_data.loginWindows`.
- Effet : lecture seule. Statut de la répartition = statut de l'UM si l'UM existe sinon statut de `tf_repart_calcul`.
- Statuts concernés : sans objet.
- Profils : droit `suivi_suivi_production` ; périmètre = ateliers de l'utilisateur.
- Source : `[SQL]/Stored Procedures/p_s_adminSuiviRead.sql:64-67,72-115,117-136` ; `[BLL]/SuiviSuiviProductionBll.cs:112`.
- Confiance : CERTAINE (lecture partielle de la procédure, début du fichier non lu).

### RG-COO-031 (provisoire) — Fusion d'affiches : la validation admin est conservée si l'une des sources l'avait
- Description : l'affiche chapeau est validée si elle l'était ou si l'une des affiches cibles l'était ; les préparations des cibles sont rattachées au chapeau.
- Déclencheur : « Fusionner » (Fusion des affiches, droit `fusion_affiche`).
- Conditions : voir ci-dessus.
- Effet : OR logique sur `validationAdmin` ; `prepa.affiche_livraison_Id = afficheChapeau.affiche_id`.
- Statuts concernés : `validationAdmin` : → true si une cible l'était.
- Profils : `fusion_affiche`.
- Source : `[BLL]/FusionAfficheBll.cs:127,163`.
- Confiance : PROBABLE (fichier lu seulement via grep ; module Réception).

### RG-COO-032 (provisoire) — État des réservations : filtre par sites autorisés et plateformes gérées
- Description : seules les lignes dont `IdSiteCCF` correspond à une plateforme gérée (Wissous, Nîmes, DBG, DBG Lyon) rattachée aux ateliers de l'utilisateur sont affichées.
- Déclencheur : lecture de l'état des réservations (procédure `P_CirceEtatReservation_New` côté Broadcast, paramètre final `true`).
- Conditions : `plateformesGerees` codé en dur ; site autorisé = `id_site_ccf` des plateformes des ateliers de l'utilisateur.
- Effet : lignes d'autres sites exclues.
- Statuts concernés : sans objet.
- Profils : ateliers de l'utilisateur (`p_s_atelier` / `tr_utilisateur_data`).
- Source : `[BLL]/SuiviEtatReservationBll.cs:72-104` ; `[REP]/SuiviEtatReservationRepository.cs:22-36`.
- Confiance : CERTAINE.

## 3. Règles — C. Intégration des préparations Broadcast (fixe/pliage) et des trains/instructions (déroulants)

### RG-COO-040 (provisoire) — Ordre des flux du batch Broadcast → Circé
- Description : le batch enchaîne destinataires → préparations (fixe/pliage) → trains d'affiches (déroulants) ; tout échec trace un log de chargement « Echec » et relance l'exception.
- Déclencheur : batch `BatchAlimPexCirce` (fréquence introuvable).
- Conditions : l'`IdInterface` du premier flux doit être récupéré, sinon exception « IdInterface non récupéré ! ».
- Effet : après la préparation, Broadcast est notifié (`MajStatutGroupePrepa`) ; après les trains, les données intégrées sont supprimées côté PEX.
- Statuts concernés : groupe de préparation Broadcast : « envoyé » (133) → statut « intégré » (valeur côté Broadcast non visible).
- Profils : automatique.
- Source : `[BLL]/BatchAlimBll.cs:34-50,91-124,129-163` ; `[SQL]/Stored Procedures/p_integ_deroulants.sql:21,27`.
- Confiance : CERTAINE.

### RG-COO-041 (provisoire) — Routage d'une prépa fixe/pliage vers un atelier
- Description : type de préparation 23 → atelier pliage (Wissous 2, Nîmes 3, DBG 9, DBG Lyon 10) ; autres types → 2 m² fixe (Wissous 1, Nîmes 4) ; site inconnu → atelier 0. Les déroulants (types 17-21, 28) sont exclus.
- Déclencheur : batch préparation.
- Conditions : `IdSiteCCF` ∈ {39, 40, 43, 44} ; statut Broadcast `IdReferentielStatutPreparation = 133` (prépa envoyée) ; `rpc_statut <> 4`. Le type 28 n'est pas dans la liste d'exclusion du second `update` de statut (17-21 seulement).
- Effet : lignes insérées dans `tf_repart_calcul` avec `rpc_statut = 0` (« A traiter »).
- Statuts concernés : (nouvelle ligne) → 0.
- Profils : automatique.
- Source : `p_integ_preparation.sql:100-147,239-249,260-264`.
- Confiance : CERTAINE.

### RG-COO-042 (provisoire) — Refus des prépas fixe/pliage en doublon tant que la précédente n'est pas annulée
- Description : si une ligne `IdPreparationDetail` + dossier existe déjà dans `tf_repart_calcul` avec `rpc_statut <> 4`, la tentative est journalisée (`tt_log`) et la ligne de travail passe à `rpc_statut = 4` (annulée) ; sinon insertion seulement si `IdPreparationDetail` n'existe pas encore.
- Déclencheur : batch préparation.
- Conditions : voir description.
- Effet : une prépa renvoyée n'est donc intégrée que si la précédente a été annulée (déblocage, RG-COO-082) ; `@result = 1` est commenté (pas d'erreur remontée).
- Statuts concernés : `trav_preparation.rpc_statut` → 4.
- Profils : automatique.
- Source : `p_integ_preparation.sql:31-54,236-247`.
- Confiance : CERTAINE.

### RG-COO-043 (provisoire) — Suivi d'intégration par groupe de préparation (8 statuts attendus)
- Description : après intégration, les lignes de travail correspondantes passent à `rpc_statut = 8` ; un groupe dont le nombre de statuts distincts est différent de 8 est journalisé « integration groupe de preparation partiel ». Archivage dans `histo_preparation`.
- Déclencheur : batch préparation.
- Conditions : `count(distinct rpc_statut) <> 8` (condition étrange : un seul statut distinct est possible par ligne).
- Effet : `tt_log` ; aucun blocage.
- Statuts concernés : `trav_preparation.rpc_statut` → 8.
- Profils : automatique.
- Source : `p_integ_preparation.sql:251-291`.
- Confiance : INCERTAINE (condition `<> 8` quasi toujours vraie, intention non établie).

### RG-COO-044 (provisoire) — Mise à jour des quantités d'entretien selon le jour de la semaine
- Description : du lundi au jeudi, la quantité `rpc_qte` des lignes `rpc_statut` 0/1 dont la date de premier départ est ≥ début de semaine + 14 jours est réalignée sur `QuantiteEntretien` ; les autres jours, seulement pour les départs ≥ + 21 jours **et** sans UM.
- Déclencheur : batch préparation.
- Conditions : `datepart(weekday)` ∈ {2,3,4,5} ; `rpc_statut in (0,1)` ; vendredi-dimanche : `UM_id is null`.
- Effet : `rpc_qte`, `rpc_dat_maj` modifiés.
- Statuts concernés : 0, 1 (inchangés).
- Profils : automatique.
- Source : `p_integ_preparation.sql:15-24,296-331`.
- Confiance : CERTAINE (dépend du paramètre régional `datefirst`, non visible).

### RG-COO-045 (provisoire) — Atelier déroulant déduit de la surface et du site, sinon 0
- Description : (surface 5 / site 39 → atelier 5), (5/40 → 6), (7/39 → 7), (7/40 → 8), (6/39 → 11), (6/40 → 12) ; tout autre cas → atelier 0.
- Déclencheur : intégration des instructions et des faces de trains.
- Conditions : `tyaf_code` / `IdSurface` et `sect_code_centre` / `IdSiteCCF`.
- Effet : détermine l'atelier de l'instruction et des faces.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_integ_instructions.sql:122-131,506-515` ; `p_integ_train_affiches.sql:68-76`.
- Confiance : CERTAINE.

### RG-COO-046 (provisoire) — Code d'instruction = année + semaine + « C0 » + atelier + dossier
- Description : `instr_code` = AAAA + SS (2 chiffres) + `C0` + atelier (2 chiffres) + dossier (8 chiffres).
- Déclencheur : intégration trains / instructions.
- Conditions : `ate_id` doit être correct (atelier 0 produit « C000 »).
- Effet : clé d'une instruction par (dossier, semaine, atelier) ; l'autre plateforme du même format est retrouvée par substitution de l'atelier (5↔6, 7↔8).
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_integ_instructions.sql:155-158,559-562` ; `p_integ_train_affiches.sql:104-109` ; `[BLL]/TrainListeInstructionBll.cs:526-562`.
- Confiance : CERTAINE. Note : `InstructionCodeAutrePlateforme` lit l'atelier avec `Substring(8,1)` (1 caractère) : ne marche pas pour 11/12 (cf. RG-COO-056).

### RG-COO-047 (provisoire) — Création et mise à jour des instructions : statut « En cours », jamais écrasées si prêtes
- Description : une instruction nouvelle (type `contrat` / `reseau`) est créée au statut 1 (En cours), `tsr_repart_code = 0`, entretien par défaut 8, `tip_ins_code = 0`. Si elle existe déjà : si son statut est 2 (Instruction ok) ou 5 (A imprimer) elle est **ignorée** ; si statut 3 (Erreur) elle repasse à 1 ; sinon elle est mise à jour (annonceur, commentaire Broadcast) et remise à 1 sauf statuts 5, 2, 4.
- Déclencheur : batch trains/instructions (`p_integ_instructions`).
- Conditions : `sect_code_centre` non nul ; `talr_trait = '1'`.
- Effet : insert/update `instruction_train` ; mises à jour des visuels (thème, pourcentage) ; annule-et-remplace des `instruction_detail`.
- Statuts concernés : (nouvelle) → 1 ; 3 → 1 ; 0/1 → 1 ; 2, 5, 4 → inchangé (renvoi **ignoré sans alerte**).
- Profils : automatique.
- Source : `p_integ_instructions.sql:175-259,274-284,578-590`.
- Confiance : CERTAINE.

### RG-COO-048 (provisoire) — Type de préparation des visuels d'instruction forcé
- Description : tous les visuels d'instruction reçus sont mis à `tpr_id = 10` (scro) et `sup_id = 26` (la clause `where` est commentée) ; les contrats « bdx » passent à `tpr_id = 2` (bandeau). Pour les détails : type 21 → venusial (11, sup 1026), reste → 10, origine « bdx » → 2.
- Déclencheur : batch instructions.
- Conditions : lignes 142-153 et 543-554.
- Effet : types de visuels homogénéisés, le support 26 est systématique pour les visuels d'en-tête.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_integ_instructions.sql:142-153,543-554`.
- Confiance : INCERTAINE (le `update` sans `where` ligne 142-144 semble volontaire mais le commentaire « venusial => tout sur du scro » est ambigu).

### RG-COO-049 (provisoire) — Intégration des faces de trains : ne touche pas aux faces/instructions déjà préparées
- Description : (1) les faces dont l'instruction est à un statut autre que 0/1 ne sont pas réintégrées ; (2) les anciennes faces (départ futur) du même dossier/semaine aux statuts 0, 1, 3, 4 sont supprimées puis recréées ; (3) la mise à jour des faces existantes ne vaut que si `rpc_statut in (0,1)` ; (4) les nouvelles faces sont créées à `rpc_statut = 0` ; (5) les chapeaux d'instruction manquants sont créés (statut 0, type `contrat`, utilisateur `BC`).
- Déclencheur : batch trains (`p_integ_train_affiches`).
- Conditions : `Traitement = 'E'` et `IdTypeDestinationDA` non nul ; `rdep_datdep > getdate()` pour la suppression.
- Effet : `tf_face_train` reflète Broadcast pour tout ce qui n'a pas dépassé l'« Instruction OK » ; au-delà, les renvois Broadcast sont ignorés silencieusement.
- Statuts concernés : face : (nouvelle) → 0 ; 0/1/3/4 → supprimée puis recréée ; ≥ 2 → inchangée.
- Profils : automatique.
- Source : `p_integ_train_affiches.sql:38-48,119-138,155-221,225-267,278-289`.
- Confiance : CERTAINE.

### RG-COO-050 (provisoire) — Reprise de la ressource (afficheur) des faces « dernière minute »
- Description : une nouvelle face prend l'afficheur, le nom et le destinataire des faces déjà présentes pour le même panel/semaine/année quand ces faces sont aux statuts 2, 5, 6, 7, 8, 9, 10 ; après insertion, les faces 0/1 du même panel/semaine reprennent l'afficheur des faces insérées ; pour les panels dont toutes les faces sont ≤ 4, la ressource est mise à jour (`ft_user_maj = 'UpdateRessource'`).
- Déclencheur : batch trains.
- Conditions : `RefPanel` identique ; statuts cités.
- Effet : cohérence de l'afficheur par panel.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_integ_train_affiches.sql:111-117,141-151,270-274,314-339`.
- Confiance : CERTAINE.

### RG-COO-051 (provisoire) — « Rafraîchir un dossier » : relance manuelle de l'export Broadcast des instructions
- Description : l'écran appelle la procédure Broadcast `ope.P_ExportTrainAfficheTravailCirce` pour un n° de dossier.
- Déclencheur : écran « Rafraichir un dossier » (menu Administration).
- Conditions : droit `train_rafraichir_contrat` (front).
- Effet : ré-alimente la zone de travail ; Circé intègre au prochain passage du batch (RG-COO-040).
- Statuts concernés : sans objet.
- Profils : `train_rafraichir_contrat`.
- Source : `[REP]/AdminContratRepository.cs:21-37` ; `[W]/Views/Shared/_MenuNew.cshtml:176-179`.
- Confiance : CERTAINE (appel) ; PROBABLE (effet, procédure Broadcast non versionnée).

## 4. Règles — D. Liste des instructions, Instruction OK, trains et export

### RG-COO-060 (provisoire) — Statuts d'instruction proposés selon le statut courant (écran Préparation déroulants)
- Description : les statuts sélectionnables dans la fiche d'une instruction dépendent du statut actuel : 0 → {0, 1, 4} ; 1 → {1, 2, 4} ; 2 → {2, 1, 4} ; 5 → {5} (aucun changement) ; 4 → {4, 0} ; autres statuts → liste vide.
- Déclencheur : ouverture de la fiche détail d'instruction (Liste des instructions « Préparation »).
- Conditions : `DetermineTargetStatutPreparation`.
- Effet : filtre de la liste déroulante (front) ; le back (`SaveEnTeteDetailInstructionsTrain`) applique le statut posté **sans contrôle de transition**.
- Statuts concernés : voir machine d'états §5.3.
- Profils : accès à l'écran (droit `pliage_a_traiter` d'après le menu).
- Source : `[W]/Ctrl/Preparation/PreparationController.cs:1267-1302` ; `[W]/Ctrl/PreparationDeroulants/PreparationDeroulantsController.cs:1507-1542,1052-1054` ; `[REP]/PreparationRepository.cs:1020-1111`.
- Confiance : CERTAINE (front) / CERTAINE (absence de contrôle back).

### RG-COO-061 (provisoire) — Deux écrans de liste d'instructions avec des listes de statuts différentes
- Description : l'écran `TrainListeInstruction` ne propose que {En cours (1), Instructions ok (2), Annulé (4)} quel que soit le statut courant ; l'écran `PreparationDeroulants` applique la table de RG-COO-060. Le changement de statut dans `TrainListeInstruction` est appliqué ensemble à plusieurs ateliers cochés (5, 6, 7, 8, 11, 12) de l'instruction.
- Déclencheur : ouverture / enregistrement d'une instruction.
- Conditions : instructions filtrées sur les ateliers de l'utilisateur.
- Effet : l'instruction de chaque atelier coché est mise à jour ; une instruction au statut 5 n'est jamais soumise à `p_u_statut_preparation`.
- Statuts concernés : 1, 2, 4 (écran Train) / voir RG-COO-060.
- Profils : accès à l'écran ; ateliers de l'utilisateur.
- Source : `[BLL]/TrainListeInstructionBll.cs:199-263,266-275,321-383,392-437`.
- Confiance : CERTAINE ; PROBABLE que l'un des deux écrans soit l'écran réel (menu : `Index/TrainListeInstruction` pour « Liste des instructions », `_MenuNew.cshtml:84-87`), l'autre étant un doublon historique.

### RG-COO-062 (provisoire) — Blocage de la saisie entretien / position / annonceur à « Instruction ok » et « A imprimer »
- Description : si le statut courant est 2 ou 5, les champs annonceur, entretien (%), position (`tip_ins_code`) ne sont pas modifiables ; seuls commentaire(s) et statut le sont.
- Déclencheur : enregistrement d'une instruction.
- Conditions : front : `blocageSaisieEntPosAnn = (statut == 2 || statut == 5)` ; back : `instruction.rpc_statut != 2 && != 5` (TrainListe) ou paramètre `blocageSaisieEntPosAnn` posté (Préparation) — dans ce second cas le serveur fait confiance à la valeur postée.
- Effet : annonceur modifié aussi sur toutes les faces de l'instruction quand la saisie n'est pas bloquée.
- Statuts concernés : sans objet.
- Profils : accès à l'écran.
- Source : `[W]/Ctrl/PreparationDeroulants/PreparationDeroulantsController.cs:1096` ; `[REP]/PreparationRepository.cs:1046-1055,1084-1103` ; `[BLL]/TrainListeInstructionBll.cs:405-428`.
- Confiance : CERTAINE.

### RG-COO-063 (provisoire) — Contrôle des 100 % de répartition des thèmes : présent dans un écran, factice dans l'autre
- Description : `TrainListeInstructionBll` refuse la sauvegarde si, pour au moins un couple (dimension, type de préparation), la somme des pourcentages de thèmes ≠ 100 : « La répartition des thèmes n'est pas à 100 % ! ». L'écran `Preparation` appelle `ValidateQuantiteTotalVisuel()` qui renvoie toujours `true` (message « La répartition des visuels par format n'est pas égale à 100 % » inatteignable).
- Déclencheur : enregistrement d'une instruction.
- Conditions : voir description.
- Effet : exception applicative (écran Train) ou aucun contrôle (écran Préparation).
- Statuts concernés : sans objet.
- Profils : accès à l'écran.
- Source : `[BLL]/TrainListeInstructionBll.cs:333-341,472-480` ; `[W]/Ctrl/Preparation/PreparationController.cs:1262-1265,1361-1365`.
- Confiance : CERTAINE.

### RG-COO-064 (provisoire) — Passage à « Instruction ok » = création des trains, des faces d'entretien et répartition des thèmes
- Description : lorsque le statut d'une instruction (≠ 5) change, `p_u_statut_preparation` est appelée pour le code instruction : statut 2 → `p_u_associe_train` ; statuts 0, 1, 4, 5 → suppression des faces d'entretien non à imprimer et remise à blanc des faces non « à imprimer » (thème, répétiquage, train, version vidés ; statut = code demandé).
- Déclencheur : enregistrement de l'instruction (Liste des instructions).
- Conditions : instruction statut initial ≠ 5 et changement de statut ; pour le code 5 les faces `rpc_statut <> 5` sont réécrites en 5 (cas peu probable, la fiche n'offre pas ce statut).
- Effet : voir RG-COO-065 à 069.
- Statuts concernés : instruction et faces (voir §5.3 et §5.4).
- Profils : accès à l'écran.
- Source : `[BLL]/TrainListeInstructionBll.cs:372-380,396-403` ; `[REP]/PreparationRepository.cs:1107` ; `[SQL]/Stored Procedures/p_u_statut_preparation.sql:24-64`.
- Confiance : CERTAINE. Commentaire de la procédure « 5 A préparer » (L.21) contradictoire avec « A imprimer » ailleurs.

### RG-COO-065 (provisoire) — Position dans le train et ordre des faces
- Description : `tip_ins_code` 1 → ordre 0 (début de train) ; 2 → 99 (fin) ; 3 → 98 (FIN-1) ; 4 → 15 (milieu) ; sinon ordre = rang proposé.
- Déclencheur : Instruction OK.
- Conditions : valeur portée par l'instruction.
- Effet : `ordre_propose`, `ordre_reel` des faces.
- Statuts concernés : faces → 2.
- Profils : automatique.
- Source : `p_u_associe_train.sql:132-157` ; `[Entities]/Enums.cs:274-286` (libellés).
- Confiance : CERTAINE.

### RG-COO-066 (provisoire) — Répartition des thèmes sur les faces
- Description : les exceptions (`instruction_detail`) affectent d'abord un thème/repiquage à une face précise (`ft_type = 'exception'`) ; les faces restantes reçoivent les thèmes d'`instruction_visuels` (type 10) au prorata des pourcentages (`nb_tot = int(pourcentage × nb faces)`), en parcourant les faces triées par secteur / département / commune / adresse ; les bandeaux à 100 % non gérés en exception sont affectés à toutes les faces.
- Déclencheur : Instruction OK.
- Conditions : `instruction_visuels.tpr_id = 10` ; des thèmes < 3 caractères sont complétés par `---` ; guillemets/apostrophes remplacés par des espaces.
- Effet : `theme`, `theme_id`, `repiquage`, `insv_id`, `ft_type` ('exception' / 'face') ; statut des faces = 2.
- Statuts concernés : faces 0/1 → 2.
- Profils : automatique.
- Source : `p_u_associe_train.sql:81-111,181-345,347-363,377-394`.
- Confiance : CERTAINE (algorithme détaillé non réécrit ici).

### RG-COO-067 (provisoire) — Identifiant et version de train
- Description : `train_id` = AA(2 derniers chiffres de l'année codés `right('00'+année,2)`) + SS + secteur(3) + département(2) + commune(3) + n° emplacement(4) + n° de train(1) + version(1). La version = max version des faces au statut 5-10 pour le même emplacement/train/semaine + 1, sinon 0.
- Déclencheur : Instruction OK.
- Conditions : statuts 5, 6, 7, 8, 9, 10 pour la recherche de version.
- Effet : une instruction renvoyée après impression crée une nouvelle version du train.
- Statuts concernés : sans objet.
- Profils : automatique.
- Source : `p_u_associe_train.sql:159-179,366-374`.
- Confiance : CERTAINE. Note : `right('00'+convert(varchar(4),dep_anbas),2)` donne les 2 derniers chiffres de l'année.

### RG-COO-068 (provisoire) — Faces d'entretien calculées par pourcentage
- Description : pour chaque (destinataire, thème, secteur, semaine, année, thème-repiquage, support, type), le nombre de faces d'entretien = `round(nb faces × % entretien / 100)` ; % par défaut 8 si nul ; les faces d'une convention de référence `VPS_75 101 0004` sont traitées dans un bloc distinct ; faces d'entretien créées avec l'afficheur littéral « ENTRETIEN ».
- Déclencheur : Instruction OK.
- Conditions : `nb > 0`.
- Effet : lignes `tf_face_train` `ft_type = 'entretien'` ; supprimées au retour à 0/1/4/5 (RG-COO-064) si le statut ≠ 5.
- Statuts concernés : faces entretien : (créées) → 2.
- Profils : automatique.
- Source : `p_u_associe_train.sql:401-439,578-583,534,683` ; `[BLL]/TrainListeInstructionBll.cs:220-221` (entretien affiché).
- Confiance : CERTAINE (bloc Paris : INCERTAINE, lignes 440-697 survolées).

### RG-COO-069 (provisoire) — Garde-fous anti-doublons sur les faces et les afficheurs d'un train
- Description : si deux faces du même train partagent le même cadre (`cadr_ident`), la plus récente est conservée, les autres passent à 4 (annulé) avec `train_id = NULL` ; si un train a plusieurs afficheurs (`pers_ident`), tous prennent l'afficheur de la face la plus récente. Les faces `train_id` nul au statut 2 après traitement sont supprimées (« génère des anomalies »).
- Déclencheur : fin de Instruction OK.
- Conditions : `ft_type <> 'entretien'`.
- Effet : annulation silencieuse de faces.
- Statuts concernés : faces → 4.
- Profils : automatique.
- Source : `p_u_associe_train.sql:703-838`.
- Confiance : CERTAINE.

### RG-COO-070 (provisoire) — Export des trains : seules les faces « Instructions ok » partent, passage à « A imprimer »
- Description : l'export (bouton « Exporter ») ne retient que les faces au statut 2 ; il écrit `tf_train_export` (un enregistrement par train, 6 contrats au maximum), puis passe **instructions** et **faces** exportées au statut 5 (A imprimer). La « Simulation export » génère le même fichier sans changer les statuts. Aucune restriction horaire n'est codée (le « jeudi 14 h » n'apparaît pas dans le code).
- Déclencheur : écran Liste des trains (`PreparationDeroulants`).
- Conditions : `RpcStatut == 2` ; faces issues de la grille en session (`GetFacesTrainsDataGridInSession`).
- Effet : historique `ExporterTrains` ; fichier CSV `ExportTrainsCIRCEversSurf<horodatage>` ; en cas d'exception le message est tracé et l'`idExport` est tout de même retourné (l'erreur n'est pas visible de l'utilisateur).
- Statuts concernés : faces 2 → 5 ; instruction 2 → 5.
- Profils : droit `pliage` (menu « Liste des trains ») ; ateliers de l'utilisateur.
- Source : `[W]/Ctrl/PreparationDeroulants/PreparationDeroulantsController.cs:71-134` ; `[BLL]/PreparationDeroulantsService.cs:109-223` ; `[REP]/PreparationRepository.cs:1287-1440` ; `[REP]/PreparationDeroulantsRepository.cs:1030-1081` ; `[W]/Views/Shared/_MenuNew.cshtml:89-91`.
- Confiance : CERTAINE (statuts) ; INCERTAINE pour le nombre de contrats > 6 (ancienne méthode loguait « Train supérieur à 6 », `PreparationRepository.cs:1251-1260`).

### RG-COO-071 (provisoire) — Trains « Paris » : calcul d'ordre dédié selon `tr_parametre_alternance`
- Description : certaines faces (références de convention incluses/exclues, structures, produits paramétrés dans `tr_parametre_alternance`) suivent un calcul de position spécifique (`CalculTrainParis`), passent à A imprimer avec `ordre_reel`/`ordre_calcule` ; le reste suit l'export standard.
- Déclencheur : export des trains.
- Conditions : `rpc_statut == 2` ; paramètres actifs (`est_actif`).
- Effet : `UpadateTrainParis` : faces et instructions → statut 5.
- Statuts concernés : faces/instruction 2 → 5.
- Profils : idem export.
- Source : `[BLL]/PreparationDeroulantsService.cs:129-172` ; `[REP]/PreparationDeroulantsRepository.cs:1670-1701`.
- Confiance : INCERTAINE (le code de sélection par produit/structure construit `listeWithProduit` sans l'affecter ; `CalculTrainParis` non lue).

### RG-COO-072 (provisoire) — « Changer statut » des faces : transitions autorisées uniquement par le front
- Description : le dialogue ne propose que 2 → 5 (Instructions ok → A imprimer) et 5 → 10 (A imprimer → Au roulage) ; la confirmation applique ensuite le statut choisi à **toutes** les faces de la grille en session sans revérifier le statut courant. L'écran `TrainPreparation` contrôle côté serveur : « Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' ! » (accepte en réalité 10, 5 ou 9) et remet en « A imprimer ».
- Déclencheur : « Changer statut » (Liste des trains) / « Changer statut : A imprimer » (Trains › Préparation).
- Conditions : droits `train_changer_statut` (menu/front).
- Effet : `rpc_statut` des faces mis à jour (+ historique selon l'écran).
- Statuts concernés : 2 → 5, 5 → 10 (Liste des trains) ; 10/5/9 → 5 (Préparation).
- Profils : `train_changer_statut`.
- Source : `[W]/Ctrl/PreparationDeroulants/PreparationDeroulantsController.cs:1417-1431,1544-1556` ; `[BLL]/TrainPreparationBll.cs:234-255` ; `[REP]/TrainPreparationRepository.cs:99-115` ; `[W]/Views/TrainPreparation/Index.cshtml:78`.
- Confiance : CERTAINE.

### RG-COO-073 (provisoire) — Annulation d'un thème de train : uniquement à « A imprimer »
- Description : annuler un thème exige que le statut de la ligne et de toutes les faces du thème soit 5 ; messages : « Le statut du thème ne permet pas l'annulation ! », « Toutes les faces du theme ne sont pas dans le statut 'A Imprimer' ».
- Déclencheur : « Annuler thème » (Suivi par thème).
- Conditions : `ligne.rpc_statut == 5` et toutes faces = 5.
- Effet : faces → 4 (Annulé), `train_id = NULL`, utilisateur/date.
- Statuts concernés : faces 5 → 4.
- Profils : droit `train_annuler_theme` (énuméré ; usage dans les vues non retrouvé).
- Source : `[BLL]/TrainSuiviThemeBll.cs:181-202` ; `[REP]/TrainSuiviThemeRepository.cs:97-114` ; `[W]/Ctrl/TrainSuiviThemeController.cs:90-110`.
- Confiance : CERTAINE (statuts) ; PROBABLE (droit).

### RG-COO-074 (provisoire) — « Débloquer semaine » : tous les trains « A imprimer » d'un atelier repassent à « Instructions ok »
- Description : retour en arrière de masse sur une semaine/atelier ; refusé s'il n'y a ni train ni instruction (« Il n'y a pas de données à traiter ! ») ou si une face n'est pas à 5 (« Toutes les données ne sont pas au statut 'A imprimer' ! »).
- Déclencheur : bouton « Débloquer semaine » (Suivi par thème).
- Conditions : droit `train_debloquer_semaine` (front : `Index.cshtml:105,143`) ; `train_id != null` ; instructions au statut 5.
- Effet : faces et instructions → 2 ; `ft_user_maj`, `instr_user`, dates.
- Statuts concernés : faces 5 → 2 ; instructions 5 → 2.
- Profils : `train_debloquer_semaine`.
- Source : `[BLL]/TrainSuiviThemeBll.cs:496-522` ; `[REP]/TrainSuiviThemeRepository.cs:257-323` ; `[W]/Views/TrainSuiviTheme/Index.cshtml:105-114`.
- Confiance : CERTAINE.

### RG-COO-075 (provisoire) — Fractionner / raccrocher les thèmes d'un train
- Description : le fractionnement (uniquement statut 5) incrémente le dernier chiffre (version) du `train_id` des faces sélectionnées (ressources/jours choisis) si le train contient plusieurs faces ; le raccrochage regroupe les versions supérieures sur la première version, en ignorant les trains dont une face n'est pas à 5 ; messages « Le statut du thème ne permet pas le fractionnement ! », « Pas de données à traiter ! ».
- Déclencheur : Fractionner / Raccrocher (Suivi par thème, droit `train_regrouper`).
- Conditions : statuts 5.
- Effet : mise à jour de `train_id` ; pas de changement de statut.
- Statuts concernés : sans changement (5).
- Profils : `train_regrouper`.
- Source : `[BLL]/TrainSuiviThemeBll.cs:214-262,531-665` ; `[W]/Views/TrainSuiviTheme/Index.cshtml:91`.
- Confiance : CERTAINE.

### RG-COO-076 (provisoire) — Pré-assemblage : bascule par thème
- Description : le bouton inverse l'indicateur `pre_assemblage` face par face (ceux à vrai passent à faux, les autres à vrai) ; aucune condition de statut.
- Déclencheur : « Pré-assemblage » (Suivi par thème).
- Conditions : aucune.
- Effet : `pre_assemblage` inversé ; affichage « Fait » si vrai.
- Statuts concernés : sans objet.
- Profils : accès Suivi par thème.
- Source : `[BLL]/TrainSuiviThemeBll.cs:442-485`.
- Confiance : CERTAINE.

### RG-COO-077 (provisoire) — Export préparation des trains : 2 m² uniquement, plafond de 20 thèmes, contrôle a posteriori
- Description : « Export préparation » (ateliers 5 et 6 uniquement) passe les faces des trains choisis à 9 (Export prepa) ; le compte des couples (thème, repiquage) distincts (déjà 9 + nouveaux) est contrôlé **après** la mise à jour : au-delà de 20, l'exception « Le nombre de thèmes ajouté est supérieur à la capacité de la machine ! » est levée mais la mise à jour n'est pas annulée. Un contrôle préalable exige que les faces soient 5 ou 9 : « Les faces des trains ne sont pas dans le statut 'A imprimer' ! ».
- Déclencheur : « Export préparation » (Trains › Préparation / Export préparation).
- Conditions : `ExportPrepaAutorise = (ate_id == 5 || 6)` ; statuts 5 ou 9 ; `NbMaxThemeExportPrepa = 20`, `NbMaxThemeParTrain = 6` (constante non utilisée dans le fichier lu).
- Effet : faces → 9 ; puis « Au roulage » (10) avec rouleur via `MiseAJourAuRoulage` (faces statut 9 de la semaine/atelier).
- Statuts concernés : 5 → 9 ; 9 → 10 ; 9 → 5 (suppression d'un thème, `MiseAJourAImprimer`).
- Profils : `train_preparation`.
- Source : `[BLL]/TrainPreparationBll.cs:22-23,90-99,257-291` ; `[REP]/TrainPreparationRepository.cs:253-269` ; `[REP]/TrainExportPrepaRepository.cs:43-67,124-151` ; `[W]/Views/Shared/_MenuNew.cshtml:101-107`.
- Confiance : CERTAINE.

### RG-COO-078 (provisoire) — Export Caire : seulement les ateliers 2 m² déroulants
- Description : la génération du fichier Caire ne retient que les faces des ateliers 5 (Wissous 2 m²) et 6 (Nîmes 2 m²) ; le statut écrit pour l'export est « Export prepa » (9).
- Déclencheur : « Exporter Caire » / « Générer fichier V2 ».
- Conditions : `AteId ∈ {5, 6}`.
- Effet : liste de `TrainExport` (6 contrats par train) puis fichier.
- Statuts concernés : faces → 9 (par la suite).
- Profils : `train_preparation`.
- Source : `[BLL]/PreparationDeroulantsService.cs:225-304,236-241,258`.
- Confiance : PROBABLE.

### RG-COO-079 (provisoire) — Duplication d'un train
- Description : « Dupliquer train » copie les faces d'un train source N fois vers des trains cibles dont l'identifiant augmente de 190 à chaque exemplaire ; les copies sont créées au statut 5 (A imprimer) ; le champ « Afficheur » du formulaire est stocké dans `pers_nom` (le paramètre de la procédure s'appelle `@annonceur`). Le paramètre est journalisé dans `tt_log`.
- Déclencheur : écran Administration › Dupliquer train.
- Conditions : droit `duplication_train` (menu) ; aucune validation (le contrôleur capture et relance l'exception).
- Effet : insertion de N × (faces du train source) dans `tf_face_train`.
- Statuts concernés : (nouvelles faces) → 5. Remarque : le `insert` lit `rpc_statut` de `#temp` (valeur 5 forcée).
- Profils : `duplication_train`.
- Source : `[W]/Ctrl/DuplicationTrainController.cs:22-34` ; `[BLL]/DuplicationTrainBll.cs:12-17` ; `[SQL]/Stored Procedures/p_u_duplication_train.sql:13-19,94,100-110`.
- Confiance : CERTAINE ; INCERTAINE sur l'usage métier (cas « trains de remplacement »).

## 5. Règles — E. Déblocage de préparation (dont droits d'inclusion/exclusion)

### RG-COO-080 (provisoire) — La recherche de déblocage exige un n° de préparation ou un n° de dossier
- Description : sans `IdPreparationChapeau` ni `IdDossierDeVenteChapeau`, la grille est vide (aucun chargement massif).
- Déclencheur : écran Déblocage préparations (Administration).
- Conditions : les deux paramètres nuls → liste vide.
- Effet : lecture seule.
- Statuts concernés : sans objet.
- Profils : droit `debloque_repart`.
- Source : `[BLL]/AdminPreparationDeblocageBll.cs:86-89` ; `[W]/Views/Shared/_MenuNew.cshtml:166-169`.
- Confiance : CERTAINE.

### RG-COO-081 (provisoire) — Préparations débloquables filtrées par règles inclusion/exclusion par atelier de l'utilisateur
- Description : une préparation Broadcast est affichée si, pour au moins un atelier de l'utilisateur dont le site CCF est celui de la préparation, au moins une règle d'inclusion `tr_atelier_droit_prepa` correspond **et** aucune règle d'exclusion ne correspond ; une règle correspond si (`tpr_id` nul ou égal à la **famille** du type de préparation) et (`IdSurface` nul ou égal). Un atelier sans aucune règle ne débloque rien (message tracé), de même un atelier sans site CCF résolu.
- Déclencheur : recherche de déblocage.
- Conditions : données de référence (seed APPFR-3878 : ateliers 1/4 tout sauf pliage/scrolling/venusial ; 2/3/9/10 pliage ; 5/6 scrolling+venusial 2 m² ; 7/8 8 m² ; 11/12 4 m²) ; document du dépôt cohérent avec le code lu.
- Effet : liste des groupes de préparation débloquables, avec `InstructionType` UM (si une ligne `tf_repart_calcul` correspond au groupe) sinon TRAIN.
- Statuts concernés : sans objet.
- Profils : ateliers de l'utilisateur (via `p_s_atelier`).
- Source : `[BLL]/AdminPreparationDeblocageBll.cs:91-149,338-351` ; `[REP]/AdminPreparationDeblocageRepository.cs:115-126` ; `circe-develop/docs/regles-inclusion-exclusion-deblocage.md:53-85`.
- Confiance : CERTAINE (le seed SQL `BDD/DATA/APPFR-3878-unlock-prep.sql` n'a pas été relu : valeurs du §5 du doc du dépôt reprises, non revérifiées).

### RG-COO-082 (provisoire) — Statut d'avancement de la préparation (`StatutPrepa`) : UM ou TRAIN
- Description : pour une préparation de type UM : « En cours » si une UM existe pour (dossier, semaine, année, groupe), sinon « None ». Pour TRAIN : faces rapprochées par (dossier, semaine, supports résolus famille × surface, atelier de type scroll du site) ; « None » (débloquable) si toutes les faces sont à 0, 1 ou 4 **et** au moins une face de la semaine d'un atelier Scroll existe, ou s'il n'y a aucune face ; sinon « En cours ». Le site 39 → plateforme 1, tout autre site → plateforme 2.
- Déclencheur : lecture de la grille de déblocage (`ReadInstruction`).
- Conditions : `transcoCategSupport` incomplète → aucune face rapprochée (contrôle impossible) et trace « Deblocage : transcoCategSupport absente… » (fail-open).
- Effet : colonne `StatutPrepa` ; le masquage du bouton « Débloquer » par `ShowBtnDestroy` n'a pas pu être vérifié (fichier JS introuvable dans le dépôt).
- Statuts concernés : faces 0, 1, 4 = débloquable ; ≥ 2 = bloquant (train) ; UM existante = bloquant (affichage).
- Profils : `debloque_repart`.
- Source : `[BLL]/AdminPreparationDeblocageBll.cs:154-250` ; `[REP]/AdminPreparationDeblocageRepository.cs:148-184` ; `[W]/Views/AdminPreparationDeblocage/Index.cshtml:35,37`.
- Confiance : CERTAINE (calcul) ; INCERTAINE (effet UI).

### RG-COO-083 (provisoire) — Blocage du déblocage côté serveur : seules les UM de statut ≥ 6 (Préparé) bloquent
- Description : « Débloquer » refuse avec « Le groupe de preparation n'est pas déblocable ! » si au moins une UM du groupe est à un statut ≥ 6 (Préparé, A expédier, Terminé, Au roulage…). Pour un groupe de type TRAIN, aucun contrôle serveur sur les faces (le contrôle n'existe que dans l'affichage `StatutPrepa`).
- Déclencheur : bouton « Débloquer » (Destroy de la grille).
- Conditions : `p_s_controle_rendumain(IdGroupePreparation)` non vide.
- Effet : exception applicative affichée dans la grille.
- Statuts concernés : sans objet.
- Profils : `debloque_repart` (front/menu).
- Source : `[BLL]/AdminPreparationDeblocageBll.cs:263-267` ; `[SQL]/Stored Procedures/p_s_controle_rendumain.sql:9-21` ; `[W]/Ctrl/AdminPreparationDeblocageController.cs:75-96`.
- Confiance : CERTAINE.

### RG-COO-084 (provisoire) — Effet du déblocage : annulation côté Broadcast et Circé, archivage, historique, mail
- Description : (1) Broadcast : `P_CirceDebloquerGroupePreparation` (avec feature flag « PastillePrepaBus ») ; (2) Circé : `p_u_statut_repart_deblocage` passe à 4 (annulé) les lignes `tf_repart_calcul` du couple (préparation chapeau, groupe) non déjà annulées **et** les UM associées ; (3) archivage `p_i_th_repart_annule` ; (4) historique `DebloquerPreparation` ; (5) mail « Déblocages - groupe préparation… » à `tr_plateforme.plt_mail` du site, préfixé par l'environnement hors production.
- Déclencheur : bouton « Débloquer ».
- Conditions : appels successifs **sans transaction commune** (Broadcast, Circé, archivage, historique, mail) ; le mail est envoyé sans `try/catch` (une panne SMTP fait échouer l'action **après** l'annulation) ; destinataires dérivés d'une liste séparée par virgules ; encodage windows-1250.
- Effet : la préparation annulée peut être renvoyée par Broadcast (cf. RG-COO-042).
- Statuts concernés : `tf_repart_calcul.rpc_statut` ≠ 4 → 4 ; `tf_UM.rpc_statut` ≠ 4 → 4 ; colis non touchés (code commenté).
- Profils : `debloque_repart`.
- Source : `[BLL]/AdminPreparationDeblocageBll.cs:252-333` ; `[REP]/AdminPreparationDeblocageRepository.cs:63-107` ; `[SQL]/Stored Procedures/p_u_statut_repart_deblocage.sql:30-87` ; `[BLL]/HistorisationBll.cs` (DebloquerDossier).
- Confiance : CERTAINE.

### RG-COO-085 (provisoire) — Ancien écran « Répartitions déblocables » (Sybase AMT) : débloque aussi les lignes non cochées
- Description : le contrôleur envoie à `DebloquerRepartitions` toutes les lignes reçues moins celles jugées non déblocables parmi **les cochées** ; les lignes non cochées sont donc débloquées. Le déblocage appelle la procédure Sybase `p_urpfo01` puis les procédures Circé ; le service renvoie 0 si les deux compteurs diffèrent ; un mail est envoyé aux logisticiens (liste tronquée avec `Take(mail.Length-1)`).
- Déclencheur : écran Répartitions déblocables (droits `debloque_repart` / `view_repart`).
- Conditions : `repartAVerifier = ADebloquer == true` pour le seul contrôle `p_s_controle_rendumain`.
- Effet : annulation de répartitions côté AMT et Circé.
- Statuts concernés : `tf_repart_calcul` / `tf_UM` → 4.
- Profils : `debloque_repart`, `view_repart`.
- Source : `[W]/Ctrl/Repartition/RepartitionController.cs:218-242,253-326,328-351` ; `[BLL]/RepartitionService.cs:35-53` ; `[REP]/RepartitionRepository.cs:87-136`.
- Confiance : PROBABLE (le menu actif `_MenuNew.cshtml` ne pointe plus vers `Repartition` : l'écran est probablement mort ; non confirmé).

### RG-COO-086 (provisoire) — Suivi des déblocages : période et libellé « 4m² colle »
- Description : la recherche exige une date de fin ≥ date de début (« La date de fin doit être supérieur à la date de début ! ») ; défaut = dernier mois ; le type « Tole traditionnelle » est affiché « 4m² colle » ; site traduit par `TranscoderLibelleSiteCCF`.
- Déclencheur : écran Préparations débloquées.
- Conditions : droit `view_repart`.
- Effet : lecture (`p_s_th_repart_annule`).
- Statuts concernés : sans objet.
- Profils : `view_repart`.
- Source : `[BLL]/AdminSuiviDeblocageBll.cs:25-65,76-100` ; `[W]/Views/Shared/_MenuNew.cshtml:171-174`.
- Confiance : CERTAINE.

## 6. Règles — F. Droits et périmètre utilisateur

### RG-COO-090 (provisoire) — Les droits n'existent que côté affichage (menu et boutons), aucun contrôle serveur
- Description : `EstAutorise(droit, user)` vérifie qu'une entrée de `tr_utilisateur_menu` (cache en session `droitUtilisateur`) porte le libellé du droit (underscore initial retiré). Aucun attribut `[Authorize]` ni appel à `EstAutorise` n'existe dans les contrôleurs : un appel direct d'URL n'est pas protégé.
- Déclencheur : rendu des menus/vues.
- Conditions : session ; droits chargés une fois par session (non rafraîchis).
- Effet : masquage uniquement.
- Statuts concernés : sans objet.
- Profils : tous.
- Source : `[BLL]/CommunBll.cs:276-303` ; recherche `[Authorize]`/`EstAutorise(` dans `[W]/Controllers` : 0 occurrence.
- Confiance : CERTAINE.

### RG-COO-091 (provisoire) — Correspondance menu ↔ droit pour les écrans de coordination
- Description : « Liste des instructions » exige `pliage_a_traiter` ; « Liste des trains » et « Position Train » exigent `pliage` ; « Suivi par thème » : `train_suivi_theme` ; « Préparation », « Export préparation », « Liste des colis » : `train_preparation` ; « Etat des réservations » et « Suivi de production » : `suivi_suivi_production` ; « Déblocage préparations » : `debloque_repart` ; « Préparations débloquées » : `view_repart` ; « Rafraichir un dossier » : `train_rafraichir_contrat` ; « Dupliquer train » : `duplication_train` ; case validation admin : `validation_admin`. Actions : `train_regrouper`, `train_debloquer_semaine`, `train_changer_statut`, `train_annuler_theme`.
- Déclencheur : rendu du menu / des vues.
- Conditions : voir description.
- Effet : masquage.
- Statuts concernés : sans objet.
- Profils : voir §7.
- Source : `[W]/Views/Shared/_MenuNew.cshtml:84-107,140-152,166-183` ; `[W]/Views/TrainSuiviTheme/Index.cshtml:91,105,143` ; `[W]/Views/TrainPreparation/Index.cshtml:78` ; `[BLL]/CommunBll.cs:31-40`.
- Confiance : CERTAINE.

### RG-COO-092 (provisoire) — Périmètre par atelier de l'utilisateur
- Description : les listes d'instructions, de trains, le suivi par thème, l'état des réservations, le suivi de production et le déblocage ne montrent que les ateliers/sites rattachés à l'utilisateur (`RecupAtelierDeroulant`, `RecupAtelier`, `tr_utilisateur_data.loginWindows`). La liste de choix d'atelier ajoute « Tous » (-1) si plusieurs ateliers.
- Déclencheur : lecture des écrans.
- Conditions : l'écran d'ouverture sélectionne par défaut la semaine suivante et le premier atelier ; les critères sont mémorisés en session.
- Effet : filtrage des lignes.
- Statuts concernés : sans objet.
- Profils : par utilisateur.
- Source : `[BLL]/TrainListeInstructionBll.cs:31-108,117-168` ; `[BLL]/TrainSuiviThemeBll.cs:31-98` ; `[BLL]/TrainPreparationBll.cs:31-109` ; `p_s_adminSuiviRead.sql:91-94,111-113` ; `[BLL]/SuiviEtatReservationBll.cs:75-98`.
- Confiance : CERTAINE.

---

## 5bis. Machines d'états (existant)

### 5.1 Ligne attendue (`tf_prepa_affiche`)
Pas de colonne de statut unique : l'état résulte de `FromBroadcast`, `ARecevoir`, `affiche_livraison_Id`.

| État (ARecevoir / affiche_livraison_Id / FromBroadcast) | Alimentation (batch) | Création réception | Rattachement manuel | Dissociation | Prépa arrive (Broadcast→prépa) |
|---|---|---|---|---|---|
| Attendue (0 ou NULL / NULL / 1 ou NULL) | (reste) | → Reçue : ARecevoir=1, affiche=id (RG-COO-020) | → Reçue (RG-COO-022) | n/a | FromBroadcast 1→NULL (RG-COO-009) |
| Reçue rattachée (1 / id / ·) | quantité mise à jour si Broadcast (RG-COO-008) | affiche existante : quantité remplacée | ignoré (déjà couverte) | → ARecevoir=1, affiche=NULL (« reçue sans affiche », RG-COO-023) | FromBroadcast 1→NULL |
| Reçue partielle (rattachée, Σ mouvements < Qte_Theorique) | idem | idem | idem | idem | idem — reste visible dans les attendues (RG-COO-013) |
| Reçue sans affiche (1 / NULL) | ARecevoir réarmé si nouvelle ligne de même clé (RG-COO-007) | n/a | possible (ARecevoir déjà 1) | n/a | — |
| Annulée / supprimée | **aucune transition** : pas de purge, pas de statut d'annulation (RG-COO-001, 003) | | | | |

### 5.2 Affiche — validation admin (`affiche.validationAdmin`)
| État | Cocher (fiche, droit `validation_admin`) | Décocher | Fusion |
|---|---|---|---|
| NULL / false | → true : impression étiquette rack ; historique ; effets aval (RG-COO-026 à 030) | n/a | idem si une cible l'est |
| true | n/a | → false : historique « décoché », pas d'impression | conservé (OR) |
Aucune transition liée à la présence de préparation, à la quantité, ni au statut de l'instruction.

### 5.3 Instruction (`instruction_train.rpc_statut`)
Libellés `tr_statut` : 0 A traiter, 1 En cours, 2 Instruction Ok, 3 Erreur, 4 Annulé, 5 A imprimer.

| Statut \ Action | Intégration Broadcast (batch) | Enregistrer avec statut cible (fiche, écran Préparation) | Export des trains | Débloquer semaine |
|---|---|---|---|---|
| (absente) | → 1 si type contrat/réseau (RG-COO-047) ; chapeau → 0 (RG-COO-049) | n/a | n/a | n/a |
| 0 A traiter | → 1 | → 0 / 1 / 4 | — | — |
| 1 En cours | reste 1 | → 1 / 2 / 4 | — | — |
| 2 Instruction Ok | **ignoré** | → 2 / 1 / 4 (retour arrière possible) | → 5 | — |
| 3 Erreur | → 1 | (aucun choix proposé) | — | — |
| 4 Annulé | **ignoré** (non mis à jour) | → 4 / 0 | — | — |
| 5 A imprimer | **ignoré** | aucun changement possible | — | → 2 |
Écran `TrainListeInstruction` : cibles 1, 2, 4 depuis n'importe quel statut ≠ 5 (RG-COO-061). Le back ne contrôle pas la transition (RG-COO-060).

### 5.4 Face de train (`tf_face_train.rpc_statut`)
| Statut \ Action | Intégration batch | Instruction ok (p_u_associe_train) | Retour 0/1/4 de l'instruction | Export trains | Changer statut | Annuler thème | Débloquer semaine | Export prépa / roulage |
|---|---|---|---|---|---|---|---|---|
| (nouvelle) | → 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| 0 | supprimée/recréée ou mise à jour | → 2 | remis à blanc | — | — | — | — | — |
| 1 | idem | → 2 | remis à blanc | — | — | — | — | — |
| 2 | non réintégrée | (nouvelle version possible) | remis à blanc (≠5) | → 5 | → 5 | — | — | — |
| 3 | supprimée/recréée | → 2 | — | — | — | — | — | — |
| 4 | supprimée/recréée | — | — | — | — | — | — | — |
| 5 | — | — | conservée | — | → 10 | → 4 | → 2 | → 9 |
| 9 | — | — | — | — | — | — | — | → 10 (MiseAJourAuRoulage) ; → 5 (suppression d'un thème) |
| 10 | — | — | — | — | (« Changer statut A imprimer » → 5) | — | — | — |
| 6, 7, 8 | non réintégrées | nouvelle version de train | — | — | — | — | — | issus du côté production (colis) : non analysé |

### 5.5 Ligne de répartition / UM (fixe, pliage) — partiel
0 (intégration) → … (colisage, 1 ; préparé, 6 ; à expédier, 7 ; terminé, 8 : côté production, non analysé) ; → 4 par déblocage (RG-COO-084) ; une prépa renvoyée n'est intégrée que si la ligne précédente est à 4 (RG-COO-042).

### 5.6 Groupe de préparation Broadcast (déblocage)
Envoyé (133, réf. `IdReferentielStatutPreparation`) → intégré (`MajStatutGroupePrepa`, côté Broadcast) → débloqué (`P_CirceDebloquerGroupePreparation`). Les procédures Broadcast (`ope.P_*`, `P_Circe*`) ne sont pas dans le dépôt : états côté Broadcast non connus.

## 7. Profils / droits et capacités (existant)

Il n'existe pas de profil nommé : des **droits** (table `tr_utilisateur_menu`) et un **périmètre d'ateliers** (`tr_utilisateur_data`). Enum : `[BLL]/CommunBll.cs:31-40`. Aucun contrôle serveur (RG-COO-090).

| Droit | Capacité (côté menu/boutons) |
|---|---|
| `pliage_a_traiter` | Menu Trains › Liste des instructions (écran `TrainListeInstruction`) |
| `pliage` | Trains › Liste des trains (`PreparationDeroulants`), Position Train (CoteCote) ; export des trains, simulation |
| `train_suivi_theme` | Trains › Suivi par thème |
| `train_preparation` | Trains › Préparation, Export préparation, Liste des colis |
| `train_regrouper` | Raccrocher / fractionner (Suivi par thème) |
| `train_debloquer_semaine` | Bouton « Débloquer semaine » |
| `train_changer_statut` | « Changer statut » (A imprimer) |
| `train_annuler_theme` | Annuler un thème (usage dans les vues non retrouvé) |
| `train_rafraichir_contrat` | Administration › Rafraichir un dossier |
| `duplication_train` | Administration › Dupliquer train |
| `debloque_repart` | Administration › Déblocage préparations |
| `view_repart` | Administration › Préparations débloquées (et ancien écran Répartitions) |
| `validation_admin` | Case « validation admin » et actions d'association dans la fiche affiche |
| `reception_liste_affiche` | Menu Réception (ouverture des écrans de réception/rattachement) |
| `suivi_suivi_production` | Menu Suivi (Suivi de production, Etat des réservations) |
| `fusion_affiche`, `Zone_Picking` | Fusion d'affiches (OR sur validation admin) ; Zone picking |
| `admin`, `Super_admin`, `referentiel` | Administration générale, référentiels (hors périmètre) |
| `bus`, `bus_a_traiter`, `_2m2_fixe*`, `pliage*` (fixe/pliage) | Production, hors périmètre Coordination |

Périmètre d'ateliers : toute liste est filtrée sur les ateliers de l'utilisateur (RG-COO-092).

## 8. Dépendances vers d'autres modules

| Module | Nature de la dépendance | Références |
|---|---|---|
| **Réception** | création de livraison → rattachement automatique aux lignes attendues, `ARecevoir`, orphelines ; fiche affiche (validation admin, association/dissociation) ; fusion ; zone picking ; étiquette rack | RG-COO-020 à 027, 031 ; `LivraisonAfficheService.cs`, `ReceptionListeAfficheBll.cs` |
| **Stock** | `mouvement` : quantité reçue d'une ligne attendue = somme des mouvements de l'affiche rattachée (reste à recevoir) | RG-COO-013 ; `Fn_GetPrepaAffiche.sql:190-220` ; `LivraisonAfficheRepository.cs:63-72` |
| **Broadcast / ExtPlay** (hors Circé) | état des réservations (`P_CirceEtatReservation_New`), flux destinataire/préparation/trains/instructions, déblocage (`P_CirceDebloquerGroupePreparation`), retour des réceptions (`CIRCE_PEX_RECEPTION`), rafraîchissement (`ope.P_ExportTrainAfficheTravailCirce`) | RG-COO-001, 029, 040, 051, 084 |
| **Production 2 m² fixe / pliage / colisage / expédition** | `tf_repart_calcul` + `tf_UM` : création des UM, statuts ≥ 6 qui bloquent le déblocage ; colis ; Export préparation → statut 9/10 | RG-COO-041 à 044, 077, 083, 084 |
| **Suivi de production** | consomme affiche validée, répartitions, faces | RG-COO-030 |
| **Administration** | utilisateurs (`tr_utilisateur_menu`, `tr_utilisateur_data`), plateformes (`plt_mail`, `id_site_ccf`), ateliers (`tr_atelier`, `tr_atelier_droit_prepa`), types de préparation / `transcoCategSupport`, `tr_parametre_alternance` | RG-COO-081, 084, 090, 092 |
| **Historique transversal** | `histo_historique_entite` : actions `ModificationValidationAdmin`, `AfficheAssocier`, `AfficheDissocier`, `ChangementStatutInstruction`, `ModificationInstructionPlus`, `ExporterTrains`, `DebloquerPreparation` | `Enums.cs:204-222` ; `HistorisationBll.cs` |
| **Sybase AMT (legacy)** | ancien écran de déblocage des répartitions | RG-COO-085 |
| **Mails** | mail de déblocage (SMTP) | RG-COO-084 |

## 9. Zones NON analysées (et pourquoi)

1. **Ordonnanceur / job SQL** qui lance `p_Alimentation_tf_prepa_affiche` et fréquences des batchs `BatchAlimPexCirce*` : introuvables dans le dépôt (pas de job exporté).
2. **Procédures Broadcast** (`ope.P_*`, `P_CirceEtatReservation_New`, `P_CirceDebloquerGroupePreparation`, `P_CirceRecherchePreparationDeblocable`, `P_ExportPrepaCirce`) : hors dépôt (EXTPLAY.edmx seulement) → états Broadcast inconnus.
3. **Procédures SQL Circé absentes ou non lues** : `p_u_exportTheme`, `p_s_affiche_a_fusionner`, `p_GetPrepareListAffiches`/`p_GetPrepareListLivraison` (non lues ; `Fn_GetPrepaAffiche` lue), `p_s_listeUM_2m2` (n° d'affiche conditionné à `validationAdmin`, vu uniquement via entités), `p_s_th_repart_annule`, `p_i_th_repart_annule`, `p_integ_ptf_*`, `p_archivage_*`, `p_batch` / `p_u_batch`.
4. **Seed et données de référence** : `BDD/DATA/APPFR-3878-unlock-prep.sql`, `transcoCategSupport`, `tr_statut`, `tr_atelier_droit_prepa` : non lus (valeurs reprises du doc du dépôt).
5. **JS non retrouvés / non lus** : `Scripts/site/AdminPreparationDeblocage.js` (`ShowBtnDestroy`, `showStatutPrepa` : règles de masquage du bouton « Débloquer »), `Preparation.js`, `TrainSuiviTheme` JS ; les vues Kendo n'ont été lues que partiellement (colonnes/actions).
6. **Contenu détaillé** de : `TrainExportPrepaBll` (génération des fichiers), `PreparationDeroulantsService.CalculTrainParis`, bloc Paris de `p_u_associe_train.sql:440-697`, `LivraisonAfficheService` (contrôles `ControlRulesValidationLivraison`, mail de réception), `ValiderAssocPrepaAffiche`, `EnvoyeReport`.
7. **Production et expédition** (UM, colisage, colis, Geodis, mails colis, `_2m2FixePreparation*`, `PreparationExpedition*`, `PreparationColis*`) : hors périmètre coordination.
8. **Bus** (droits `bus`, `IsBusV3`, `PreparationBusMock*`, `PreparationServiceBusTest`) : non analysé.
9. **Tests unitaires** (`ClearChannel.Circe.Test`) : non lus, sauf mention ; ils pourraient révéler des règles attendues (ex. `AdminPreparationDeblocageBllTest`, `SuiviEtatReservationBllTest`).
10. **docs-sources `1. CIRCE ACTUEL/*`** (schémas statuts/tags, process de bout en bout) : non lus en détail (j'ai lu le relevé de la maquette `releve-existant-code.md` pour m'orienter, sans en reprendre de règle non revérifiée dans le code).
11. **Tables** (`tf_prepa_affiche`, `tf_prepa_Broadcast`, index/contraintes) : structure non lue ; l'absence de clé unique métier est une hypothèse issue du `MERGE` et de la procédure (non confirmée).
12. **Alertes** (cible) : aucune fonction d'alerte équivalente trouvée dans le code lu (hors mail de déblocage) — non cherché de façon exhaustive (recherche ciblée seulement).

## 10. Points à risque / incertitudes (synthèse)

- **Doublons des attendues** : RG-COO-004, 005, 006, 008, 009 (jointures sur textes, MERGE inopérant, correctif IT-62195).
- **Aucun statut d'annulation** des lignes attendues ; `tf_prepa_Broadcast` supprimé/recréé par dossier (RG-COO-001).
- **Renvois Broadcast ignorés sans alerte** après « Instruction ok » ou « A imprimer » (RG-COO-047, 049).
- **Aucun contrôle serveur** des droits ni des transitions de statut (RG-COO-026, 060, 072, 090).
- **Déblocage** : pas de transaction, contrôle serveur limité aux UM, mail non protégé (RG-COO-083, 084).
- **Deux écrans concurrents** de liste d'instructions avec règles différentes (RG-COO-061, 063).
- **Semaines non ISO** et branche fin d'année à vérifier en production (RG-COO-002).
- **Ouverture d'une fiche = rattachement automatique** (RG-COO-024).
