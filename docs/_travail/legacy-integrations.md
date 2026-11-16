# Legacy — Intégrations et batchs (CIRCE historique)

Périmètre : batchs console (.NET 4.5.2), BLL/repositories associés, procédures `p_integ_*` / `p_batch_*` / `P_CIRCE_Alim_PEX_*`, bases INTERFACE et EXTPLAY (EDMX), appel Web API `PrepaAfficheBC`, SSIS, SMTP, planification.
Racine code : `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/` (abrégé `[C]`). Racine SQL : `circe-develop/BDD/DATABASE/DATABASE/dbo/Stored Procedures/` (abrégé `[SQL]`).
Aucune valeur d'identifiant, mot de passe, clé d'API ni nom de serveur n'est recopiée ici (voir §6, sécurité).
Les RG de ce fichier sont des règles d'INTÉGRATION ; les règles métier déjà documentées sont référencées (RG-REC-xxx, RG-COO-xxx) et non dupliquées.

## 0. Cartographie

### 0.1 Exécutables (une solution `[C]/ClearChannel.CIRCE.sln`)

| Projet | Point d'entrée | BLL / Repo | Rôle |
|---|---|---|---|
| `BatchAlimPexCirce` | `Program.cs:12-39` | `BatchAlimBll`, `BatchAlimRepository` | PEX/Broadcast (via INTERFACE/EXTPLAY) → CIRCE : destinataires, préparations fixe/pliage, trains/instructions déroulants |
| `BatchAlimPexCirceInsBC` (assembly `BatchAlimPexCirceGetInstrBc`) | `Program.cs:12-26` | `BatchAlimGetInstructionBc`, `PrepaAfficheBCRepository`, `LivraisonAfficheRepository` | Broadcast (EXTPLAY) → `tf_prepa_Broadcast` |
| `BatchAlimPexCirceReception` | `Program.cs:12-34` | `BatchAlimReceptionBll`, `BatchAlimReceptionRepository` | CIRCE (réceptions d'affiches) → INTERFACE → EXTPLAY/Broadcast |
| `BatchEnvoieMailColis` | `Program.cs:13-31` | `BatchEnvoieMailColisBll`, `BatchEnvoieMailColisRepository` | CIRCE (colis expédiés) + EXTPLAY (adresses mail ressources) → mails avec Excel |
| `BacthCallZoom` | `Program.cs:12-27` | `BacthCallZoomBll` (BLL/BatchBLL/BatchCallZoom), `ZoomWebApi`, `WebApiTools` | Geodis « Zoom » (suivi des envois) → `log_colis_transporteur` → `tf_colis_ext` / `tf_colis` |
| `BatchEdition` | `Program.cs:17-23` | aucune | Impression d'un rapport RDLC (`Report2.rdlc`) sur l'imprimante par défaut ; modèle d'exemple (données `data.xml`), voir RG-INT-040 |
| SSIS `BDD/SSIS_Circe/.../Flux_Repartition_Amt_Ptf.dtsx` | — | procédures `p_integ_ptf_*` | Flux historique AMT (Sybase) → CIRCE ; voir RG-INT-041 |
| Procédures de maintenance SQL | — | `p_batch`, `p_archivage_*`, `p_batch_fin_journee_colis`, `p_batch_auto_instruction_ok`, `p_batch_u_synchro_adresse` | Purges, archivage, bascule fin de journée, auto-statut instructions |

Codes retour des batchs : 0 si OK, -1 si exception (`Program.cs` de chacun) ; sauf `BacthCallZoom` qui avale l'exception, affiche le message et attend une touche (`Program.cs:21-26`) donc non planifiable en l'état (voir RG-INT-032).

### 0.2 Bases et connexions (noms logiques uniquement)

- CIRCE (`CIRCEEntities`, EF6 + SP), INTERFACE (`INTERFACEEntities`, base tampon entre CIRCE et PEX/Broadcast), EXTPLAY (`EXTPLAYEntities`, base Broadcast/PEX : ressources, réservations, préparations).
- Contextes EF : `[C]/ClearChannel.CIRCE.DAL/CIRCE.Context.cs`, `INTERFACE.Context.cs`, `EXTPLAY.Context.cs`.
- Procédures EXTPLAY appelées : `P_GetAdresseLivraisonAfficheur`, `P_CirceEtatReservation_New`, `P_CirceEtatReservation`, `P_CirceRecherchePreparationDeblocable`, `P_CirceDebloquerGroupePreparation`, `ope.P_MajStatutGroupePreparation`, `res.P_GetRessourceAdresseMail` (`EXTPLAY.Context.cs:34-110`, `BatchAlimRepository.cs:265`, `BatchEnvoieMailColisRepository.cs:168`).
- Procédures INTERFACE appelées : `P_LogChargementPackage` (+ `log.P_LogChargementPackage`), `P_ExportPrepaCirce`, `P_ExportCirceMajFlag`, `ope.P_ExportCircePurgeTrainAffiche`, `ope.P_ExportCircePurgeInstructionDetail`, `P_ExportInstructionsCirce` (importée, non appelée), `P_CIRCE_Alim_PEX_ReceptionAffiche`, tables/vues `FluxChargement`, `ExportCirceTrainAffiche`, `ExportCirceInstructionDetail`, `ExportCirceInstruction`, `CIRCE_PEX_RECEPTION` (`INTERFACE.Context.cs:38-97`, `BatchAlimRepository.cs:46-57,284-333,628-672`).
- Le code source de toutes ces procédures INTERFACE/EXTPLAY est HORS dépôt (seuls les wrappers EDMX existent).

### 0.3 Schéma des flux

```
ENTRANT (vers CIRCE)
  EXTPLAY  P_GetAdresseLivraisonAfficheur ─► trav_adresseLivraisonAfficheur ─► p_integ_destinataire ─► tr_destinataire, tr_dest_adresse, tr_ate_dest_trans   [BatchAlimPexCirce / Flux_Destinataire]
  INTERFACE P_ExportPrepaCirce ───────────► trav_preparation ─► p_integ_preparation ─► tf_repart_calcul (+ groupes)    [BatchAlimPexCirce / Flux_Preparation]
            └► EXTPLAY ope.P_MajStatutGroupePreparation (retour d'accusé)
  INTERFACE ExportCirceTrainAffiche/InstructionDetail/Instruction ─► trav_trainAffiche, tra_amt_log_instruc_det, tra_amt_log_instruction ─► p_integ_deroulants (p_integ_train_affiches, p_integ_instructions) ─► tf_face_train, instruction_train…   [BatchAlimPexCirce / Flux_Train_Affiche]
            └► purge côté INTERFACE (ope.P_ExportCircePurge*)
  EXTPLAY  P_CirceEtatReservation_New(…, false) ─► tf_prepa_Broadcast                                       [BatchAlimPexCirceGetInstrBc]
  Web API  GET PrepaAfficheBC ─► tf_prepa_Broadcast (déclenché depuis l'écran Réception)                     [LivraisonAfficheService]
  tf_prepa_Broadcast / tf_repart_calcul / tf_face_train ─► p_Alimentation_tf_prepa_affiche ─► tf_prepa_affiche  (appelant introuvable)
  Geodis Zoom (HTTPS) ─► log_colis_transporteur ─► p_updateColisTransporteur ─► tf_colis_ext, tf_colis        [BacthCallZoom — cassé, RG-INT-031]

SORTANT (depuis CIRCE)
  p_batch_alimentation_circe_pex_reception ─► INTERFACE.CIRCE_PEX_RECEPTION ─► P_CIRCE_Alim_PEX_ReceptionAffiche ─► EXTPLAY/Broadcast ; flag affiche.envoye   [BatchAlimPexCirceReception]
  Écran déblocage ─► EXTPLAY P_CirceDebloquerGroupePreparation (+ mail)                                       [AdminPreparationDeblocageBll/Repository]
  Colis expédiés ─► e-mails (SMTP) avec pièce jointe .xls (interne : manager CCF ; externe : tiers + manager en copie)   [BatchEnvoieMailColis]
  Écran Réception ─► e-mail « Réception affiche »                                                              [ToolBll.SendMail]
  Écran export trains ─► fichier CSV vers répertoire configuré (« Export Surf »/Caire)                         [TrainExportPrepaBll, PreparationDeroulantsService]
```

## 1. Règles — A. Alimentation PEX/Broadcast → CIRCE (BatchAlimPexCirce)

### RG-INT-001 (provisoire) — Prérequis : l'interface doit être déclarée dans INTERFACE.FluxChargement
- Description : avant tout flux, le batch cherche l'`IdInterface` du premier flux (`Flux_Destinataire`) dans la table `FluxChargement` d'INTERFACE ; s'il est nul, le batch s'arrête.
- Déclencheur : lancement `BatchAlimPexCirce`.
- Conditions : `FluxChargement.NomFlux = 'Flux_Destinataire'`.
- Effet : sinon `ApplicationException("IdInterface non récupéré !")` ; si la ligne n'existe pas, `FirstOrDefault().IdInterface` lève une NullReferenceException (aucun message explicite).
- Statuts concernés : sans objet.
- Profils : technique (compte du batch).
- Source : `[C]/ClearChannel.CIRCE.BLL/BatchAlimBll.cs:34-45` ; `[C]/ClearChannel.CIRCE.Repositories/BatchAlimRepository.cs:46-57`.
- Confiance : CERTAINE.

### RG-INT-002 (provisoire) — Ordre fixe des trois flux, sans transaction globale
- Description : destinataires, puis préparations (fixe/pliage), puis trains d'affiches (déroulants). Chaque flux écrit un journal de chargement dans INTERFACE (début : statut 1 ; fin : Success=0, Echec=2 ; Warning=6 défini mais jamais utilisé). En cas d'exception : log `Echec` (apostrophes retirées du message), exception relancée, les flux suivants ne sont pas exécutés ; les flux déjà terminés restent validés.
- Déclencheur : batch.
- Conditions : exception dans un flux.
- Effet : état partiel possible (ex. destinataires à jour, préparations non intégrées). Le message d'erreur est concaténé dans une commande SQL texte (`string.Format`), donc sensible aux caractères spéciaux hors apostrophe.
- Statuts concernés : journal `FluxChargement` (INTERFACE) : 1 → 0 | 2.
- Profils : technique.
- Source : `BatchAlimBll.cs:47-49,55-86,91-124,129-163` ; `BatchAlimRepository.cs:29-30,63-70,89-97`.
- Confiance : CERTAINE. Voir aussi RG-COO-040.

### RG-INT-003 (provisoire) — Flux destinataires : seules les adresses de livraison « actuelles ou futures » sont prises
- Description : les adresses lues dans EXTPLAY sont filtrées côté C# : `DateDebutPivot > now` OU (`DateDebutPivot <= now` ET `now <= DateFinPivot`). Les périodes échues sont ignorées.
- Déclencheur : batch, flux destinataires.
- Conditions : filtre sur l'ensemble renvoyé par `P_GetAdresseLivraisonAfficheur`.
- Effet : les lignes retenues alimentent la table de travail `trav_adresseLivraisonAfficheur` (type table `adresseLivraisonAfficheurTableType`, SP `insertTravAdresseLivraisonAfficheur`) puis `p_integ_destinataire`.
- Statuts concernés : sans objet.
- Profils : technique.
- Source : `BatchAlimRepository.cs:102-110,116-156` ; `BatchAlimBll.cs:60-74`.
- Confiance : CERTAINE (la SP EXTPLAY n'est pas lue).

### RG-INT-004 (provisoire) — Intégration des destinataires par type de destination PEX (création + mise à jour, jamais de suppression)
- Description : `p_integ_destinataire` crée ou met à jour `tr_destinataire` (nom, actif=1, dispatch='O' à la création, mail, téléphone) et `tr_dest_adresse` (adresse principale) selon `IdTypeDestinationDA`, avec une clé PEX différente par type :

| IdTypeDestinationDA | Sens | Clé `des_PexId` | `des_type` utilisé dans les tests d'existence |
|---|---|---|---|
| 1 | Plateforme | `IdSiteCCF` | 4 |
| 2 | Site | `IdSiteCCF` | 1 |
| 3 | Société sous-traitante | `IdTiers` | 2 |
| 4 | Afficheur | `IdRessource` | 0 |
| 5 | Dépôt | `IdDepot` | 3 |

- Déclencheur : batch, flux destinataires.
- Conditions : `not exists` sur (`des_PexId`, `des_type`) pour l'insertion ; l'adresse n'est insérée que si le destinataire n'a encore aucune adresse (`not exists tr_dest_adresse` par `dest_id`) ; mise à jour de l'adresse seulement si `dest_nom = Destinataire`.
- Effet : adresse d'une ligne `lieu_dit` = `LieuDit + PointDeRemise` tronqué à 50 caractères. Un destinataire absent du flux n'est ni désactivé ni supprimé. Défaut documenté : les INSERT d'adresse joignent sur `des_PexId` sans `des_type` (site et plateforme partagent `IdSiteCCF`) : adresse possiblement attribuée au mauvais destinataire.
- Statuts concernés : `dest_actif` → 1 (à chaque passage pour les destinataires reçus).
- Profils : technique.
- Source : `[SQL]/p_integ_destinataire.sql:31-86,152-206,273-327,394-448,514-568` ; défaut : `circe-develop/docs/REVIEW_Database_proc.md:161-163`.
- Confiance : CERTAINE (code) ; le sens métier des codes 1 à 5 vient du commentaire de la SP (`p_integ_destinataire.sql:19-26`).

### RG-INT-005 (provisoire) — Transporteur/tarif par défaut créés pour chaque couple destinataire × atelier
- Description : en fin de `p_integ_destinataire`, pour chaque destinataire et chaque atelier sans ligne `tr_ate_dest_trans`, une ligne est créée : ateliers 1, 2, 5, 7 → transporteur 2, tarif `X24` ; ateliers 3, 4, 6, 8 → transporteur 2, tarif `CX` (commentaire « transporteur par défaut à Nîmes ») ; tous les autres ateliers (hors 0) → transporteur 1, tarif `CCF`.
- Déclencheur : batch, flux destinataires.
- Conditions : `not exists` sur (dest_id, ate_id) ; `ate_id <> 0`.
- Effet : alimente `tr_ate_dest_trans` (consommé par Expédition/Production, hors périmètre). Codes ateliers et tarifs codés en dur.
- Statuts concernés : sans objet.
- Profils : technique.
- Source : `[SQL]/p_integ_destinataire.sql:644-700`.
- Confiance : CERTAINE (valeurs) ; INCERTAINE sur la signification métier des tarifs.

### RG-INT-006 (provisoire) — Flux préparation fixe/pliage : INTERFACE → table de travail → intégration → accusé vers Broadcast
- Description : lecture `P_ExportPrepaCirce` (INTERFACE), insertion dans `trav_preparation` (type `preparationTableType`, 25 colonnes dont `IdReferentielStatut`), exécution de `p_integ_preparation` (paramètre de sortie `result` ≠ 0 → exception « Erreur dans la procédure : p_integ_preparation ! »), puis appel EXTPLAY `ope.P_MajStatutGroupePreparation` avec les `IdGroupePreparation` retournés par la SP, pour indiquer à Broadcast que les données sont intégrées.
- Déclencheur : batch, flux préparation.
- Conditions : règles d'intégration détaillées dans RG-COO-041 à RG-COO-044 (sites 39/40/43/44, statut Broadcast 133, `rpc_statut <> 4`, etc.).
- Effet : écriture de `tf_repart_calcul` ; écriture sortante vers EXTPLAY (statut groupe). Si l'accusé échoue après l'intégration CIRCE, Broadcast n'est pas informé mais CIRCE a déjà intégré (pas de transaction distribuée).
- Statuts concernés : groupe de préparation Broadcast « envoyé » (133) → « intégré » (valeur côté Broadcast non visible).
- Profils : technique.
- Source : `BatchAlimBll.cs:91-124` ; `BatchAlimRepository.cs:162-266` ; `[SQL]/p_integ_preparation.sql` (cf. RG-COO-041..044).
- Confiance : CERTAINE pour la séquence ; INCERTAINE pour la valeur finale du statut Broadcast (SP EXTPLAY hors dépôt).

### RG-INT-007 (provisoire) — Flux trains d'affiches : verrouillage de lot par drapeau, copie en masse, intégration, purge côté PEX
- Description : (1) `P_ExportCirceMajFlag` marque dans INTERFACE le lot à traiter (`Traitement = 'E'` pour les trains ; `talr_trait = '0'` pour instructions et détails) ; (2) purge des tables de travail CIRCE (`purgeTravTrainAffiche`, `purgeTravInstructionDetail`, `purgeTravInstructions`) ; (3) copie en masse (`Insert_Bulk`) des lignes marquées vers `trav_trainAffiche`, `tra_amt_log_instruc_det`, `tra_amt_log_instruction`, en mémorisant les `Id` copiés ; (4) `p_integ_deroulants` (trains puis instructions, arrêt si `result <> 0` avec exception « Erreur dans la procédure : p_integ_deroulants ! ») ; (5) suppression côté INTERFACE des seuls `Id` copiés (`ope.P_ExportCircePurge*` ; instructions supprimées par EF).
- Déclencheur : batch, flux train d'affiches.
- Conditions : l'ordre purge → copie → intégration → suppression ; les lignes arrivées après la capture des Id restent dans INTERFACE pour le passage suivant.
- Effet : alimente `tf_face_train`, `instruction_train`, etc. (règles métier : RG-COO-045 à RG-COO-050). Si `p_integ_deroulants` échoue, rien n'est supprimé côté INTERFACE (rejouable). Si la suppression échoue après intégration, les mêmes données sont ré-envoyées au passage suivant (intégration supposée idempotente, voir RG-COO-049).
- Statuts concernés : INTERFACE `Traitement` / `talr_trait` : « à traiter » → « en cours (E) » → ligne supprimée.
- Profils : technique.
- Source : `BatchAlimBll.cs:129-163` ; `BatchAlimRepository.cs:271-333,432-448,600-672,698-714` ; `[SQL]/p_integ_deroulants.sql:21-30`.
- Confiance : CERTAINE (séquence) ; INCERTAINE (sémantique exacte des valeurs de drapeau : SP INTERFACE hors dépôt ; les valeurs "E" et "0" ne sont pas homogènes entre trains et instructions).

### RG-INT-008 (provisoire) — Délai d'attente et journalisation du batch d'alimentation
- Description : le contexte CIRCE est ouvert avec un `CommandTimeout` infini (`Int32.MaxValue`). Journal fichier `.\BatchAlimPexCirce.log` (Trace, autoflush désactivé : vidé par `ControleFlushLog` en fin de `Fin()` ou dans `LogException`).
- Déclencheur : batch.
- Conditions : en cas de plantage brutal, le journal fichier peut ne pas être vidé.
- Effet : technique.
- Source : `BatchAlimRepository.cs:38` ; `[C]/ClearChannel.CIRCE.BatchAlimPexCirce/App.config:34-40` ; `BatchAlimBll.cs:165-174` ; `ToolBll.cs:57-87`.
- Confiance : CERTAINE.

## 2. Règles — B. Broadcast → `tf_prepa_Broadcast` (BatchAlimPexCirceGetInstrBc) et Web API

### RG-INT-010 (provisoire) — Fenêtre glissante de N semaines (N = 8 par configuration)
- Description : le batch appelle `P_CirceEtatReservation_New(anneeCourante, semaineCourante, anneeFin, semaineFin, false)` sur EXTPLAY. `semaineFin = semaineCourante + weeks` ; `weeks` vient de l'`appSettings` `weeks` (valeur 8 dans `App.config`). Si `semaineFin` dépasse le nombre de semaines de l'année courante, l'année de fin passe à N+1 et `semaineFin = 1 + (semaineFin − max)`. Le dernier paramètre `false` diffère de l'écran « Suivi état des réservations », qui appelle la même SP avec `true`.
- Déclencheur : batch `BatchAlimPexCirceGetInstrBc`.
- Conditions : la semaine courante est calculée avec la culture courante (`CalendarWeekRule`, `FirstDayOfWeek` de la machine) et non en ISO ; le nombre de semaines de l'année vient de `DateTimeHelper.GetWeeksInYear`. Le calcul du débordement donne une semaine de fin supérieure d'une unité au calcul arithmétique (ex. 50 + 8 = 58 ; max 52 ⇒ 1 + 6 = 7 au lieu de 6) : probable décalage d'une semaine.
- Effet : si la lecture est vide, rien n'est écrit.
- Statuts concernés : sans objet.
- Profils : technique.
- Source : `[C]/ClearChannel.CIRCE.BLL/BatchAlimGetInstructionBc.cs:22-34,43-90` ; `[C]/ClearChannel.CIRCE.Repositories/PrepaAfficheBCRepository.cs:25-31` ; `[C]/ClearChannel.CIRCE.Repositories/SuiviEtatReservationRepository.cs:22-27` ; `[C]/ClearChannel.CIRCE.BatchAlimPexCirceInsBC/App.config:10-13`.
- Confiance : CERTAINE (fenêtre) ; PROBABLE (décalage d'une semaine : non testé).

### RG-INT-011 (provisoire) — Remplacement par dossier dans `tf_prepa_Broadcast`
- Description : voir RG-COO-001 (suppression puis recréation de toutes les lignes de chaque `IdDossierDeVenteChapeau` lu ; dossiers non relus jamais purgés). Précisions d'intégration : chaque ligne reçoit `dateCreated`/`dateModified` = maintenant, `sup_id` = correspondance `Transaco_Surface_Format(IdSurface, IdFormat)` ou 0 si aucune, `repiquage` = `Bandeau`, `AssistantCommercial`/`AssistantLogistique` = « Nom Prénom » concaténés (donc « Nom  » si le prénom est nul, et valeurs nulles transformées en texte vide). `IdThemeBandeau` est copié par le batch mais PAS par la variante Web API (RG-INT-012).
- Déclencheur : batch.
- Conditions : lecture non vide.
- Effet : `tf_prepa_Broadcast` ; la sauvegarde se fait ligne par ligne (`Save()` dans `CreatePreparationBC`), sans transaction englobante : une panne en cours laisse un dossier supprimé et partiellement recréé.
- Statuts concernés : `StatutPreparation` Broadcast copié tel quel.
- Profils : technique.
- Source : `BatchAlimGetInstructionBc.cs:92-129` ; `[C]/ClearChannel.CIRCE.Repositories/LivraisonAfficheRepository.cs:328-345,364-369`.
- Confiance : CERTAINE ; variante `...Batch` (DELETE par concaténation, `LivraisonAfficheRepository.cs:347-361`) non appelée par le batch (INCERTAIN si utilisée ailleurs).

### RG-INT-012 (provisoire) — Variante interactive : appel HTTP GET à l'API « PrepaAfficheBC » depuis l'écran Réception
- Description : la BLL web appelle `<WebApiUrl>` + `PrepaAfficheBC` (`Web.config` : `WebApiUrl`), désérialise `IList<EtatReservationBC>` et appelle `CreateOrUpdatePreparationBC`. En cas de code HTTP non succès, rien n'est fait (aucune erreur remontée). `GetPrepaBCStatut()` indique « à rafraîchir » si la dernière mise à jour a plus de 5 h ou est inconnue.
- Déclencheur : écran Réception (action `GetPreparationBC`), voir RG-REC-081.
- Conditions : l'API « webapicirce » est un service tiers dont le code N'EST PAS dans ce dépôt (zone non analysée) ; la clé `WebApiUrl` contient déjà le segment `/api/PrepaAfficheBC` ET le code ajoute `PrepaAfficheBC` : le comportement dépend de la résolution d'URL relative de .NET (l'`BaseAddress` sans `/` final remplace le dernier segment) ; INCERTAIN en pratique.
- Effet : même table que RG-INT-011, mais le mapping diffère (pas de `IdThemeBandeau`, `sup_id` via `GetSup_idPrepaBC`, `dateCreated`/`dateModified` pris sur le DTO puis écrasés dans `CreatePreparationBC`).
- Statuts concernés : sans objet.
- Profils : tout utilisateur de l'écran Réception (contrôle non analysé ici).
- Source : `[C]/ClearChannel.CIRCE.BLL/LivraisonAfficheService.cs:864-926` ; `[C]/ClearChannel.CIRCE/Web.config:52`.
- Confiance : PROBABLE.

### RG-INT-013 (provisoire) — Alimentation de `tf_prepa_affiche` : procédure sans appelant dans le dépôt
- Description : `p_Alimentation_tf_prepa_affiche` (qui alimente `tf_prepa_affiche`, base de la liste des « réceptions attendues » : RG-COO-003 à RG-COO-010, RG-REC-082) n'est appelée ni par un batch C#, ni par une autre SP, ni par un job/SSIS du dépôt. Elle n'est référencée que dans les deux `.sqlproj`.
- Déclencheur : INCONNU (planification externe supposée : SQL Agent ou équivalent non versionné).
- Conditions : recherche exhaustive effectuée (grep `p_Alimentation_tf_prepa_affiche` sur tout le dépôt, hors diagramme) : aucune autre occurrence.
- Effet : si ce traitement n'est pas planifié ailleurs, `tf_prepa_affiche` ne se met jamais à jour.
- Source : `[SQL]/p_Alimentation_tf_prepa_affiche.sql:2` ; `circe-develop/BDD/DATABASE/DATABASE/DATABASE.sqlproj:88` ; `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.Database/ClearChannel.CIRCE.Database.sqlproj:342`.
- Confiance : CERTAINE (absence d'appelant dans le dépôt) ; INCONNU pour la fréquence réelle.

## 3. Règles — C. CIRCE → PEX/Broadcast (BatchAlimPexCirceReception)

Les règles RG-REC-110 et RG-REC-111 décrivent déjà le batch ; ce qui suit complète avec les détails d'intégration.

### RG-INT-020 (provisoire) — Population exportée : toutes les affiches « futures », rejouées à chaque passage
- Description : `p_batch_alimentation_circe_pex_reception` ne filtre PAS sur `affiche.envoye`. Elle renvoie, pour la semaine courante et les suivantes, (a) les affiches associées à une ligne `tf_prepa_affiche` non Broadcast (`FromBroadcast` nul/0) et (b) les affiches non associées présentes dans `tf_dossier_semaine_depart` avec `tf_prepa_affiche` absente. `quantite` = somme des mouvements de l'affiche (0 si aucun mouvement). Le libellé de format « 2m2 Scrolling » est remplacé par « 2m2 ». La semaine courante est `DATEPART(ww)` (pas ISO).
- Déclencheur : batch réception.
- Conditions : `sem_annee = année courante ET sem_num >= semaine courante`, ou `sem_annee > année courante`.
- Effet : à chaque exécution, toutes ces lignes sont réinsérées dans `INTERFACE.CIRCE_PEX_RECEPTION` (`EstImportePEX=false`, `DateImportPEX=DateCreation=now`, `QuiCreation='Batch_Alim_Pex_Circe_Reception'`, `Destinataire='CIRCE'`). Le dédoublonnage éventuel repose sur `P_CIRCE_Alim_PEX_ReceptionAffiche` (hors dépôt, non lue) : INCERTAIN.
- Statuts concernés : `affiche.envoye` null → true (informatif uniquement).
- Profils : technique.
- Source : `[SQL]/p_batch_alimentation_circe_pex_reception.sql:33-178` ; `[C]/ClearChannel.CIRCE.BLL/BatchAlimReceptionBll.cs:59-103` ; `[C]/ClearChannel.CIRCE.Repositories/BatchAlimReceptionRepository.cs:27-75`.
- Confiance : CERTAINE pour le rejeu ; INCERTAINE pour la gestion des doublons côté INTERFACE/EXTPLAY.

### RG-INT-021 (provisoire) — Filtre C# et valeurs dérivées de l'enregistrement exporté
- Description : une ligne n'est exportée que si `IdDAChapeau` est renseigné OU (`cont_num <> "0"` ET `sem_num` et `sem_annee` non nuls). `IdDossierDeVenteChapeau` = `cont_num` converti en entier seulement s'il est ≠ "0" et numérique, sinon nul. `IdSiteCCF` = 39 si `plt_id = 1`, sinon 40 (les plateformes 3 et 4, sites 43/44, sont donc envoyées avec 40, alors que `ToolBll.TranscoderIdSiteCCF` connaît 39/40/43/44). `EstAssociee` = prépa liée (`affiche_livraison_Id` non nul et ≠ 0) ET `validationAdmin = true` (RG-REC-111, RG-COO-029).
- Déclencheur : batch réception.
- Conditions : voir description.
- Effet : lignes sans identification suffisante écartées silencieusement (sans log) ; lignes d'affiches non validées envoyées avec `EstAssociee = false`.
- Statuts concernés : `EstAssociee` calculé : false → true quand l'affiche est associée et validée.
- Profils : technique.
- Source : `BatchAlimReceptionBll.cs:65-95` ; `[C]/ClearChannel.CIRCE.BLL/ToolBll.cs:340-362`.
- Confiance : CERTAINE ; INCERTAINE sur l'intention du « sinon 40 » (hypothèse : deux plateformes historiques).

### RG-INT-022 (provisoire) — Séquence insertion INTERFACE → drapeau `envoye` → export vers EXTPLAY ; échecs
- Description : (1) insertion EF de toute la liste dans `CIRCE_PEX_RECEPTION` (une seule `SaveChanges`) ; (2) si insertion OK, mise à jour de `affiche.envoye = true` pour chaque `AfficheId` (une requête par affiche, une `SaveChanges`) ; (3) `P_CIRCE_Alim_PEX_ReceptionAffiche('PexCirceReception')` (appelée même si la liste est vide). Toute exception est enregistrée dans `tt_log` (module « CIRCE - BatchAlimPexCirceReception », acteur « admin_circe », message sans apostrophes) puis relancée.
- Déclencheur : batch réception.
- Conditions : un `AfficheId` nul ou inconnu fait lever une NullReferenceException dans `UpdateFlagReception` après l'insertion INTERFACE (lignes insérées mais drapeaux non posés, d'où doublons au rejeu).
- Effet : `INTERFACE.CIRCE_PEX_RECEPTION`, `affiche.envoye`, EXTPLAY (via SP), `tt_log`. `InsertReceptionInterface` ne capture que `DbEntityValidationException` ; une autre exception de base remonte brute.
- Statuts concernés : `affiche.envoye` null/false → true ; `EstImportePEX` false → (mis à jour par la SP INTERFACE, hors dépôt).
- Profils : technique.
- Source : `BatchAlimReceptionBll.cs:30-57` ; `BatchAlimReceptionRepository.cs:57-135`.
- Confiance : CERTAINE.

### RG-INT-023 (provisoire) — Aucun journal fichier configuré pour les batchs Réception et Mail colis
- Description : les `App.config` de `BatchAlimPexCirceReception` et `BatchEnvoieMailColis` ne définissent pas de section `system.diagnostics` ; les traces (`Trace.WriteLine`) ne vont qu'à la console (listener ajouté par `AjoutTraceDansConsole`). Pour `BatchAlimPexCirceReception` seul `tt_log` conserve l'erreur ; pour `BatchEnvoieMailColis`, `LogException` ne conserve rien de persistant.
- Déclencheur : batch.
- Effet : diagnostic dépendant de la capture de la sortie console par l'ordonnanceur.
- Source : `[C]/ClearChannel.CIRCE.BatchAlimPexCirceReception/App.config` (aucune section) ; `[C]/ClearChannel.CIRCE.BatchEnvoieMailColis/App.config` ; `ToolBll.cs:57-74,133-140`.
- Confiance : PROBABLE.

## 4. Règles — D. Colis : fin de journée, mails d'expédition, Geodis Zoom

### RG-INT-030 (provisoire) — Bascule « fin de journée » des colis (statut 7 → 8)
- Description : `p_batch_fin_journee_colis` passe à `rpc_statut = 8` les UM (`tf_UM`) et les faces de trains (`tf_face_train`) rattachées à un colis de statut 7, puis le colis lui-même. Erreur : ligne `tt_log` et retour -1 (pas de transaction : un échec intermédiaire laisse UM/trains à 8 et colis à 7).
- Déclencheur : INCONNU (aucun appelant dans le dépôt ; supposé planifié en fin de journée).
- Conditions : `tf_colis.rpc_statut = 7`.
- Effet : les colis passent à 8, condition d'éligibilité de `P_GetGlobalColisForSend` (RG-INT-033).
- Statuts concernés : `tf_colis.rpc_statut` 7 → 8 ; `tf_UM.rpc_statut` → 8 ; `tf_face_train.rpc_statut` → 8.
- Profils : technique (utilisateur SQL).
- Source : `[SQL]/p_batch_fin_journee_colis.sql:22-67`.
- Confiance : CERTAINE (code) ; INCONNU (planification) ; les codes 7 et 8 ne sont pas nommés dans la SP (hors périmètre : Production/Expédition).

### RG-INT-031 (provisoire) — Batch Zoom : appel Geodis par agence active, mais les réponses ne sont jamais enregistrées
- Description : `BacthCallZoomBll.ServiceRechercheEnvois` charge les agences Geodis actives (`tr_agence_geodis.EstActive = true`), lit le transporteur n°2 (`PreparationExpeditionRepository.GetTransporteur(2, "")` : identifiant et clé d'API), et pour chaque agence appelle `ZoomWebApi.RechercheEnvois` (compte client, agence de départ) avec relance Polly 12 × 10 s. MAIS le résultat de l'appel (`var res = policy.Execute(...)`) n'est jamais affecté à `rechercheEnvoisReponseDTOs` ; la liste reste vide, donc le bloc de journalisation (`Mappeur` → `log_colis_transporteur`) n'est jamais exécuté. Seul `p_updateColisTransporteur` est appelé ensuite et ne traite que le contenu déjà présent dans `log_colis_transporteur`.
- Déclencheur : lancement du batch (aucune planification trouvée).
- Conditions : validation préalable `ValidateurRechercheEnvoisDTO` (échec silencieux : appel non fait).
- Effet : appels HTTP sans effet de persistance ; `p_updateColisTransporteur` n'a aucune donnée nouvelle à intégrer par ce chemin.
- Statuts concernés : `tf_colis_ext`/`tf_colis` : libellé d'état transporteur (via RG-INT-032) non mis à jour par ce batch dans l'état actuel du code.
- Profils : technique.
- Source : `[C]/ClearChannel.CIRCE.BLL/BatchBLL/BatchCallZoom/BacthCallZoomBll.cs:33-79` (défaut ligne 61-68) ; `[C]/ClearChannel.CIRCE.Repositories/AgenceGeodisRepository.cs:20-23` ; `[C]/ZoomWebApi/ApiBusiness/ZoomWebApi.cs:23-70`.
- Confiance : CERTAINE (lecture du code) ; INCERTAINE sur le fait que la production exploite une autre version ou un autre chemin d'alimentation de `log_colis_transporteur` (le seul écrivain connu est `LogColisTransporteurRepository.AddRangeLogColisTransporteur`, appelé uniquement ici).

### RG-INT-032 (provisoire) — Protocole d'appel Geodis Zoom (sortant) et intégration des statuts de colis
- Description : requête HTTPS POST JSON vers `<url>` + `urlServiceRechercheEnvois` (`api/zoomclient/recherche-envois`), TLS 1.2, timeout 1 min, en-tête `X-GEODIS-Service` = `Identifiant;horodatageMs;langue;hash` avec `hash = SHA-256(cléApi;identifiant;horodatage;langue;urlService;json)` (méthode `CommunWebApi.GenerateHash256Key`). Réponse : HTTP 200 et `codeErreur` vide, sinon exception (« Une erreur inattendue s'est produite » ou corps de réponse). `p_updateColisTransporteur` : retient le dernier état par `refUniExp` (`max(dateInsertion)`), met à jour/insère `tf_colis_ext`, marque `dateIntegration` dans le log, recopie dans `tf_colis` les champs transporteur sur `tf_colis.ref_uni_exp = refUniExp` ET `colis_code = reference1`, puis choisit pour chaque colis l'état de plus grand `Ordre` dans `tr_statut_colis` (jointure par libellé d'état).
- Déclencheur : batch Zoom (RG-INT-031) ; procédure exposée via `ColisExtRepository.UpdateColis`.
- Conditions : `tr_statut_colis` doit être alimentée (sinon aucun colis mis à jour : REVIEW 3.3). Défauts connus : `codePostalExp` alimenté avec le code postal destinataire ; troncatures (varchar 1000 → 50) faisant échouer toute l'écriture alors que `dateIntegration` est posée ; clé dupliquée si deux lignes ont même `dateInsertion`.
- Effet : colonnes transporteur de `tf_colis_ext` et `tf_colis` (libellé et date d'état, URL d'image et de preuve de livraison).
- Statuts concernés : `tf_colis.libelle_etat` → libellé de plus grand `Ordre` reçu de Geodis.
- Profils : technique.
- Source : `ZoomWebApi.cs:23-70` ; `[C]/WebApiTools/Commun/CommunWebApi.cs` (hash, non relu en détail) ; `[SQL]/p_updateColisTransporteur.sql:8-165` ; `circe-develop/docs/REVIEW_Database_proc.md:105-114,181`.
- Confiance : CERTAINE (flux et SP) ; PROBABLE (détail du hash : `CommunWebApi` non lu ligne à ligne).

### RG-INT-033 (provisoire) — Sélection des colis à notifier par mail
- Description : `P_GetGlobalColisForSend` retourne, pour chaque colis (fixe via `tf_UM_colis`/`tf_UM`, puis trains via `tf_face_train`), la quantité d'affiches, le nombre de rouleaux/trains (`QteRT`), l'afficheur (`pers_ident`) et le destinataire.
- Déclencheur : batch `BatchEnvoieMailColis`.
- Conditions : `ISNULL(tc.Mailcolis_envoye,0) = 0` ET `tc.rpc_statut = 8` ET `tc.colis_dat_expe > Parametre_Package.DateMaj` (ligne `Nom_Package = 'SendMailColis'`, type `Date`). Si la ligne `Parametre_Package` n'existe pas, la date est NULL : aucun colis sélectionné, sans erreur.
- Effet : liste de colis ; `p_GetDetailColis` fournit ensuite le détail par colis (fixe/scrolling).
- Statuts concernés : `tf_colis.rpc_statut` = 8 requis.
- Profils : technique.
- Source : `[SQL]/P_GetGlobalColisForSend.sql:3-56` ; `[C]/ClearChannel.CIRCE.Repositories/BatchEnvoieMailColisRepository.cs:15-48,50-114` ; REVIEW §3.3 (`REVIEW_Database_proc.md:181`).
- Confiance : CERTAINE.

### RG-INT-034 (provisoire) — Destinataires et contenu du mail de colis (interne / externe)
- Description : les colis sont rattachés à une ressource EXTPLAY (`res.P_GetRessourceAdresseMail` : `RessourceId = PersId`, manager CCF, adresse du manager, tiers, adresse du tiers, `EstInterne`). Interne (`EstInterne` vrai) : un mail par manager CCF, À = adresse du manager. Externe (`EstInterne` faux) : un mail par couple (tiers, manager), À = adresse du tiers, CC = adresse du manager. Sujet fixe « Un colis d'affiches vient de vous être expédié ». Corps HTML : tableau (N° colis, quantité trains/rouleaux, quantité affiches) agrégé par `ColisCode` ; signature « Le service Production Clear Channel ». Pièce jointe `DetailsColis_<jj_MM_aaaa>.xls` à deux feuilles : « Fixe » (7 colonnes) et « Scrolling » (23 colonnes). Expéditeur fixe codé en dur (compte « admin_playext »), relais SMTP lu dans `appSettings.HostSMTP`, port 25, identifiants par défaut.
- Déclencheur : batch mail colis.
- Conditions : pour chaque groupe, envoi uniquement si la pièce jointe existe (détail non vide) ; relance Polly 10 × 10 s ; un échec définitif est tracé et n'arrête pas le batch ; ressource introuvable ⇒ `ressource` nul ⇒ NullReferenceException dans `SendMail`, capturée : ce groupe n'est pas envoyé.
- Effet : mails sortants hors CIRCE vers des tiers (sous-traitants) et managers.
- Statuts concernés : voir RG-INT-035.
- Profils : technique ; destinataires = managers CCF internes et sociétés tierces.
- Source : `[C]/ClearChannel.CIRCE.BLL/BatchEnvoieMailColisBll.cs:33-92,94-137,148-181,188-232,236-267` ; `[C]/ClearChannel.CIRCE.BatchEnvoieMailColis/App.config:12-14` ; `BatchEnvoieMailColisRepository.cs:161-195`.
- Confiance : CERTAINE (comportement) ; INCERTAINE pour le traitement d'une ressource introuvable (le type de `EstInterne` dans `GlobalColis` n'est pas relu ; un défaut `false` classe alors le colis en « externe »).

### RG-INT-035 (provisoire) — Marquage « mail envoyé » et avancement de la date de référence
- Description : seuls les colis dont le mail est parti avec succès sont marqués `tf_colis.Mailcolis_envoye = true`. En revanche `P_MajParametre_Package('SendMailColis')` fixe `DateMaj = GETDATE()` à chaque exécution où au moins un colis a été sélectionné, y compris si certains envois ont échoué. Un colis en échec, dont `colis_dat_expe` est antérieur au jour de cette exécution, ne sera plus sélectionné aux passages suivants (filtre `colis_dat_expe > DateMaj`).
- Déclencheur : fin du batch mail colis.
- Conditions : `colis.Count > 0`.
- Effet : `tf_colis.Mailcolis_envoye`, `Parametre_Package.DateMaj`. Un détail à valeur nulle (`pers_ident` ou `UM_qte`) lève une exception qui fait échouer tout le batch (`Int32.Parse` sur NULL).
- Statuts concernés : `Mailcolis_envoye` null/false → true.
- Profils : technique.
- Source : `BatchEnvoieMailColisBll.cs:89-90` ; `BatchEnvoieMailColisRepository.cs:197-220` ; `[SQL]/P_MajParametre_Package.sql:1-7` ; `circe-develop/docs/REVIEW_Database_proc.md:116-117`.
- Confiance : PROBABLE pour la perte de retentative (dépend du type réel de `colis_dat_expe` et du jour d'exécution) ; CERTAINE pour le code.

## 5. Règles — E. Autres traitements, e-mails de l'application et maintenance

### RG-INT-040 (provisoire) — BatchEdition : modèle d'impression sans lien métier
- Description : le projet génère un rapport local `Report2.rdlc`, l'exporte en EMF puis l'imprime sur l'imprimante par défaut de la machine. Chemins relatifs `..\..\` (exécution depuis Visual Studio), `data.xml` d'exemple (« Sales »). Aucun appel de BLL/SQL CIRCE.
- Déclencheur : lancement manuel (README : projet de démarrage conseillé).
- Effet : aucune écriture en base. Rien ne l'alimente à partir de Réception/Coordination.
- Source : `[C]/ClearChannel.CIRCE.BatchEdition/Program.cs:17-119` ; `circe-develop/README.md:61-62`.
- Confiance : PROBABLE (code d'exemple conservé ; usage réel inconnu).

### RG-INT-041 (provisoire) — SSIS AMT → CIRCE : flux historique Sybase, hors chemin Réception/Coordination actuel
- Description : le package `Flux_Repartition_Amt_Ptf` enchaîne des tâches SQL (`p_alim_CIRCE_blocage`, `p_alim_CIRCE_histo_purge`, `p_integ_ptf_reparts`, `p_integ_ptf_trains`, `p_integ_ptf_histo_purge`, `p_integ_ptf_purge`) entre une source `AMT` (Sybase) et la base CIRCE (« PTF »). Les paramètres de connexion sont stockés dans le package (non repris ici). Les procédures `p_integ_ptf_*` utilisent l'ancien format d'`instr_code`. L'ancienne synchronisation `p_batch_u_synchro_adresse` (AMT → `tr_dest_adresse`, avec `WHEN NOT MATCHED BY SOURCE THEN DELETE`) n'a aucun appelant.
- Déclencheur : INCONNU (SSIS exécuté par un ordonnanceur ; remplacé a priori par les flux PEX/Broadcast).
- Effet : si encore exécutés, `tf_repart_calcul`, trains et adresses issus d'AMT cohabiteraient avec ceux de Broadcast.
- Source : `circe-develop/BDD/SSIS_Circe/SSIS_Circe/SSIS_Circe/Flux_Repartition_Amt_Ptf.dtsx:25-45,4902-4909,9465-9472,10090-10148` ; `[SQL]/p_integ_ptf_trains.sql:25-55` ; `[SQL]/p_batch_u_synchro_adresse.sql:19-71` ; `REVIEW_Database_proc.md:185`.
- Confiance : CERTAINE pour la structure ; INCERTAINE sur l'usage actuel (aucune planification, procédure sans appelant).

### RG-INT-042 (provisoire) — Procédures de maintenance sans planification versionnée (purge, archivage, auto-statut)
- Description : (a) `p_batch` : purge de l'historique (`p_d_purge_histo`, 2 ans glissants) et de `tt_log` (2 mois glissants) ; (b) `p_archivage_allTables` (archivage de `tf_repart_calcul`, `tf_face_train`, `tf_UM_colis`, `tf_colis`, `tf_UM`) ; (c) `p_batch_auto_instruction_ok` : passe automatiquement les instructions de statut « En cours » (1) à « Instructions OK » (2) pour les dossiers futurs lorsque : commentaire d'instruction vide, quantité attendue (lignes `instruction_detail`) = quantité réceptionnée (`tf_face_train`), après normalisation automatique des pourcentages de visuels (1 visuel → 100 % ; plusieurs visuels → ligne « Sans affiche » à 100 %, les autres à 0 %) ; trace dans `tt_log` avec l'utilisateur `BATCH_AUTO_INSTR_OK`.
- Déclencheur : INCONNU pour les trois (aucun appelant, aucun job versionné).
- Conditions : (c) la procédure n'est PAS référencée dans `DATABASE.sqlproj` : elle n'est donc pas déployée par le DACPAC de la CD (REVIEW 3.6). (b) `p_archivage_tf_repart_calcul` est appelée avec un paramètre qu'elle ne déclare pas : l'archivage de `tf_repart_calcul` échoue (REVIEW 1.2).
- Effet : (c) `instruction_train.rpc_statut` 1 → 2, `instruction_visuels` ; (a)/(b) suppression de données historiques.
- Statuts concernés : `instruction_train.rpc_statut` 1 → 2 (par batch).
- Profils : technique.
- Source : `[SQL]/p_batch.sql:16-60` ; `[SQL]/p_archivage_allTables.sql:15-19` ; `[SQL]/p_batch_auto_instruction_ok.sql:19-37,156-166,193-249,300-307` ; `circe-develop/docs/REVIEW_Database_proc.md:32-37,184`.
- Confiance : CERTAINE (contenu) ; INCONNU (planification) ; PROBABLE (non déployée : absence de la ligne `Build Include`, non revérifiée à la ligne près).

### RG-INT-043 (provisoire) — E-mail applicatif à la création d'une réception : corps réécrit et erreurs avalées
- Description : `ToolBll.SendMail` construit un tableau HTML (par format) puis envoie via `SmtpClient` (configuration `system.net/mailSettings`, expéditeur par défaut `exploit@…`). Le test « environnement ≠ PRODUCTION » (sujet préfixé) est annulé en partie par l'affectation finale du corps `string.Format(body, Environnement)` (ligne 442) qui s'applique aussi en production : le texte indique alors « sur l'environnement PRODUCTION ». Toute exception d'envoi est ignorée (`catch {}`).
- Déclencheur : validation d'une livraison (RG-REC-077).
- Effet : mail aux adresses de la plateforme (`ListAdresseMail`).
- Source : `[C]/ClearChannel.CIRCE.BLL/ToolBll.cs:391-456` (défaut 431-442, silence 446-453) ; `[C]/ClearChannel.CIRCE/Web.config:256-260`.
- Confiance : CERTAINE.

### RG-INT-044 (provisoire) — Déblocage d'une préparation : écriture sortante dans EXTPLAY et lecture des préparations « déblocables »
- Description : l'écran d'administration lit `P_CirceRecherchePreparationDeblocable` (EXTPLAY), contrôle côté CIRCE les données bloquantes (`p_s_controle_rendumain`), puis débloque côté Broadcast par `P_CirceDebloquerGroupePreparation(idGroupe, user, now, estPastillePrepaBusActif)` (indicateur issu du feature flag ConfigCat « PastillePrepaBus ») et côté CIRCE ; un e-mail est préparé (SMTP `ServerSMTP`, expéditeur `MailSenderCirce`). L'historique `DebloquerPreparation` est écrit via `HistorisationBll.DebloquerDossier`.
- Déclencheur : écran Administration, déblocage.
- Effet : écriture dans EXTPLAY (hors CIRCE), historique.
- Source : `[C]/ClearChannel.CIRCE.Repositories/AdminPreparationDeblocageRepository.cs:35-66` ; `[C]/ClearChannel.CIRCE.BLL/AdminPreparationDeblocageBll.cs:29,302` ; `[C]/ClearChannel.CIRCE.BLL/HistorisationBll.cs:118-127` ; `[C]/ClearChannel.CIRCE.DAL/EXTPLAY.Context.cs:34-65`.
- Confiance : PROBABLE (analyse partielle ; règles métier du déblocage : `circe-develop/docs/regles-inclusion-exclusion-deblocage.md`, non lu).

### RG-INT-045 (provisoire) — Export CSV des trains (« Export Surf » / Caire) : fichier déposé dans un répertoire configuré
- Description : l'export des trains génère un fichier `.csv` (encodage système `Encoding.Default`) dans le répertoire `DirectoryFileExportSurf` ; chaque train est découpé en 6 faces maximum (au-delà, trace `tt_log` « Train supérieur à 6 pour le TrainId » module « CIRCE - Export Surf ») ; les lignes exportées passent au statut « À imprimer » (`tf_train_export`, `instruction_train.rpc_statut`) ; l'historique `ExporterTrains` est écrit.
- Déclencheur : écran d'export des instructions de trains (Coordination/Production).
- Effet : fichier vers un partage externe (consommateur inconnu), mise à jour de statuts.
- Source : `[C]/ClearChannel.CIRCE.BLL/TrainExportPrepaBll.cs:314,429` ; `[C]/ClearChannel.CIRCE.BLL/PreparationDeroulantsService.cs:513-580,772,847` ; `[C]/ClearChannel.CIRCE.Repositories/PreparationRepository.cs:1218-1261` ; `[C]/ClearChannel.CIRCE.BLL/HistorisationBll.cs:107-116`.
- Confiance : PROBABLE (relu partiellement ; non rattaché au périmètre Réception/Coordination stricto sensu).

### RG-INT-046 (provisoire) — Historisation : actions écrites dans `histo_historique_entite`
- Description : `HistorisationBll` produit les enregistrements d'historique pour : modification d'affiche (dossier, semaines, annonceur, thème, format, validation admin, à conserver), mise en rebus, vidage du rebus, association/dissociation affiche ↔ prépa (la dissociation utilise la même action `AfficheAssocier` avec valeurs inversées), changement de statut d'instruction (seulement vers 2 ou 4), modification « Instruction plus », export de trains, déblocage de préparation. Le format détaillé est dans `HistoriqueEntityBuilder` (non lu).
- Déclencheur : actions utilisateurs des écrans Réception et Coordination.
- Effet : `histo_historique_entite` (FK vers `tr_type_entite`, `histo_action_applicative` : sans données initiales dans `BDD/DATA`, REVIEW 3.3). Les batchs d'intégration n'écrivent PAS d'historique : les changements de statut qu'ils causent ne sont tracés que dans `tt_log` et `FluxChargement`.
- Source : `[C]/ClearChannel.CIRCE.BLL/HistorisationBll.cs:16-127` ; voir RG-REC-024, RG-REC-0xx.
- Confiance : CERTAINE (contenu) ; INCERTAINE (format via `HistoriqueEntityBuilder`).

## 6. Planification, déploiement et sécurité (constats)

- Planification : AUCUNE trouvée dans le dépôt. Recherches effectuées : mots-clés SQL Agent (`msdb`, `sp_add_job`), Task Scheduler (`schtasks`, XML de tâches), cron, `planif`, `schedul`, références croisées aux noms de batchs dans `*.yml`, `*.md`, `*.ps1`, `*.sh`, `*.sql`, `*.sqlproj`, `*.dtsx`, `*.sln`. Seuls résultats : la solution (.sln) et le README qui décrivent les projets comme « console jobs ». Les fréquences (et l'ordre relatif) des batchs INCONNUS dans le code ; les mentions de fréquence dans `docs/_travail/specs-existant-process.md` (ex. toutes les 2 h de 8 h à 18 h pour la copie des réservations) sont des témoignages d'ateliers non vérifiés et ne sont pas retenues comme règle.
- CI/CD : `CI.yml:80` compile toute la solution (batchs inclus) ; `CI.yml:109,117` publie seulement le DACPAC et le site Web ; `CD.yml:107-190` déploie le site (IIS) et le schéma base (DACPAC, `dry-run: true`, `execute-sql-script: true`) vers QUAL1/REC/REF/PROD selon la branche. Les exécutables batchs ne sont ni empaquetés ni déployés par le pipeline : leur déploiement est donc manuel ou géré hors dépôt. Le `App.config` des batchs contient des chaînes de connexion par environnement en dur (modèle commenté « dev », « qual 2 », REC/REF), sans jetons de la CD (contrairement à `Web.config`).
- Sécurité (sans recopier les valeurs) : mots de passe de comptes SQL (CIRCE, INTERFACE, EXTPLAY) en clair dans les `App.config` de tous les batchs et dans le package SSIS ; clé d'API et identifiant Geodis en clair dans `[C]/ClearChannel.CIRCE.BacthCallZoom/App.config:19-22` ; mots de passe aussi dans `BDD/DATABASE/DATABASE/Security/*.sql` (REVIEW 3.5). Le batch Zoom lit deux sources de clé différentes (table `transporteur` pour `ServiceRechercheEnvois`, `appSettings` pour le code mort `ServiceSuiviEnvois`/`RechercheEnvoi`).
- Comptes : batchs avec compte d'administration (`admin_*`) en REC/REF ; compte `user_*` en configuration « dev » ; droits `GRANT EXECUTE` portés par `user_circe` ; 17 procédures sans GRANT, dont `p_GetDetailColis` (REVIEW 1.3).

## 7. Machines d'états et statuts touchés par les intégrations

| Entité | Statut / drapeau | Événement d'intégration | Résultat | Source |
|---|---|---|---|---|
| `affiche.envoye` | null/false | batch Réception, insertion INTERFACE réussie | true (jamais remis à false) | `BatchAlimReceptionRepository.cs:76-95` |
| `CIRCE_PEX_RECEPTION.EstImportePEX` | false (à l'insertion) | `P_CIRCE_Alim_PEX_ReceptionAffiche` (hors dépôt) | non visible | `BatchAlimReceptionBll.cs:83` |
| `CIRCE_PEX_RECEPTION.EstAssociee` | calculé | prépa liée ET `validationAdmin = true` | true sinon false | `BatchAlimReceptionBll.cs:89` |
| `tf_prepa_Broadcast` | (absent) | batch/API Broadcast | image du dernier état lu par dossier | `LivraisonAfficheRepository.cs:328-345` |
| `tf_prepa_affiche.FromBroadcast` | (absent) | `p_Alimentation_tf_prepa_affiche` | 1 (Broadcast) ou NULL (prépa) ; 1 → NULL au raccrochage | RG-COO-003, RG-COO-009 |
| Groupe de prépa Broadcast | 133 (envoyé) | `p_integ_preparation` puis `P_MajStatutGroupePreparation` | « intégré » (valeur non visible) | `BatchAlimBll.cs:108-111` ; RG-COO-040 |
| INTERFACE trains/instructions | `Traitement`='E' / `talr_trait`='0' | `P_ExportCirceMajFlag`, copie, intégration | ligne supprimée | `BatchAlimRepository.cs:271-333,628-672` |
| `FluxChargement` (journal) | 1 | fin de flux | 0 (OK) ou 2 (Echec) | `BatchAlimRepository.cs:30,63-97` |
| `tf_colis.rpc_statut` | 7 | `p_batch_fin_journee_colis` | 8 | `p_batch_fin_journee_colis.sql:56-60` |
| `tf_colis.Mailcolis_envoye` | null/0 | mail envoyé avec succès | 1 | `BatchEnvoieMailColisRepository.cs:197-208` |
| `Parametre_Package('SendMailColis').DateMaj` | date précédente | fin batch avec ≥ 1 colis | now | `P_MajParametre_Package.sql:5-6` |
| `tf_colis.libelle_etat` (état Geodis) | — | `p_updateColisTransporteur` (si données dans le log) | libellé d'`Ordre` maximal | `p_updateColisTransporteur.sql:129-165` |
| `instruction_train.rpc_statut` | 1 (En cours) | `p_batch_auto_instruction_ok` | 2 (Instructions OK) | `p_batch_auto_instruction_ok.sql:300-307` |

Aucune transition de statut n'est écrite dans `histo_historique_entite` par les batchs (RG-INT-046).

## 8. Profils et qui peut déclencher quoi

| Intégration | Qui la déclenche | Contrôle de profil |
|---|---|---|
| Batchs console (PEX, GetInstrBc, Réception, Mail colis, Zoom) | Ordonnanceur ou opérateur ; compte technique SQL (`admin_*`/`user_*`) | Aucun contrôle applicatif ; droits SQL uniquement |
| Rafraîchissement Web API `PrepaAfficheBC` | Utilisateur de l'écran Réception | Profil non analysé ici (voir legacy-reception) |
| Déblocage de préparation (EXTPLAY) | Profil d'administration | Non analysé ici (voir `AdminPreparationDeblocageBll`) |
| Export CSV trains | Utilisateur Production/Coordination | Non analysé ici |

## 9. Dépendances vers les autres modules et systèmes

| Cible / source | Nature | Sens |
|---|---|---|
| Réception (`affiche`, `mouvement`, `livraison`, `tf_dossier_semaine_depart`, `tf_prepa_affiche`) | Lecture par `p_batch_alimentation_circe_pex_reception` ; mise à jour de `affiche.envoye` ; alimentation de `tf_prepa_affiche` | Sortant (vers Broadcast) / entrant |
| Coordination (`tf_prepa_Broadcast`, `tf_repart_calcul`, `tf_face_train`, `instruction_train`, `tr_destinataire`, `tr_dest_adresse`, `tr_ate_dest_trans`) | Alimentation par les batchs PEX/Broadcast | Entrant |
| Production/Expédition (`tf_colis`, `tf_UM`, `tf_UM_colis`, `tf_colis_ext`, `log_colis_transporteur`, `tr_agence_geodis`, `tr_statut_colis`, `Parametre_Package`) | Batchs mail colis, Zoom, fin de journée | Sortant (mails, Geodis) |
| Administration (`tr_plateforme`, `tr_adresseMail_plateforme`) | Adresses de notification des réceptions | Lecture |
| Broadcast / PEX (bases EXTPLAY et INTERFACE) | Réservations, préparations, ressources, adresses ; statut groupe ; déblocage ; réceptions | Entrant et sortant |
| Geodis Zoom | API HTTPS de suivi des envois | Sortant puis entrant |
| SMTP | Mails réception, déblocage, colis | Sortant |
| ConfigCat | Feature flag `PastillePrepaBus` (déblocage) | Entrant (config) |
| Partage de fichiers (`DirectoryFileExportSurf`, `...Preparation2m2`, `...PieceJointeReception`) | Exports CSV et pièces jointes | Sortant/stockage |
| Historique / Traçabilité | `histo_historique_entite`, `tt_log`, `FluxChargement` | Écriture |

Dépendances croisées avec les documents précédents : RG-REC-081, RG-REC-082, RG-REC-110, RG-REC-111, RG-COO-001 à RG-COO-010, RG-COO-029, RG-COO-040 à RG-COO-051.

## 10. Écarts et défauts constatés (à ne pas reproduire sans décision)

1. Zoom : résultat jamais enregistré (RG-INT-031, `BacthCallZoomBll.cs:61-68`).
2. Réception : population complète rejouée à chaque passage, sans filtre `envoye` (RG-INT-020).
3. Mail colis : `DateMaj` avancée même en cas d'échec (RG-INT-035).
4. `p_Alimentation_tf_prepa_affiche`, `p_batch_fin_journee_colis`, `p_batch`, archivage : sans appelant (RG-INT-013, 030, 042).
5. `p_batch_auto_instruction_ok` non déployée (RG-INT-042).
6. Code postal expéditeur Geodis = code postal destinataire (RG-INT-032).
7. Fenêtre de semaines du batch GetInstrBc : calcul non ISO et débordement probablement décalé d'une semaine (RG-INT-010).
8. Mapping site 39/40 en dur pour les plateformes (RG-INT-021).

## 11. Zones NON analysées (et pourquoi)

1. Code des procédures INTERFACE/EXTPLAY (`P_CIRCE_Alim_PEX_ReceptionAffiche`, `P_ExportPrepaCirce`, `P_ExportCirceMajFlag`, `ope.P_ExportCircePurge*`, `ope.P_MajStatutGroupePreparation`, `P_CirceEtatReservation_New`, `P_GetAdresseLivraisonAfficheur`, `res.P_GetRessourceAdresseMail`, `P_CirceDebloquerGroupePreparation`) : hors dépôt (seuls les wrappers EDMX sont présents). Doublons de réceptions, valeurs de statuts retour Broadcast, sémantique des drapeaux `Traitement` : non vérifiables.
2. Service Web API `webapicirce` (`PrepaAfficheBC`) : code absent du dépôt (aucun projet WebApi correspondant ; `WebApiTools` n'est qu'une bibliothèque de hash).
3. Planification réelle (SQL Agent, Task Scheduler, serveur d'exécution, fréquences, comptes de service) : aucune trace versionnée ; à confirmer auprès de la DSI.
4. `p_integ_preparation`, `p_integ_train_affiches`, `p_integ_instructions`, `p_Alimentation_tf_prepa_affiche` : règles métier déjà extraites dans legacy-coordination (RG-COO-003..010, 040..050) ; non relues ligne à ligne ici.
5. `p_integ_ptf_*`, `p_alim_CIRCE_*`, `p_archivage_*`, `p_d_purge_histo` : relevés en surface (appelants et rôle), contenu non lu.
6. Package SSIS : seuls noms de tâches et SQL exécutés relevés ; 10 000+ lignes de mappage de colonnes non lues ; connexion AMT (Sybase) non évaluée.
7. `CommunWebApi.GenerateHash256Key`, `ValidateurRechercheEnvoisDTO`, DTO et builders JSON Geodis : relus partiellement (usage), non ligne à ligne.
8. `HistoriqueEntityBuilder`, `ConfigurationHelper` (hors clés citées), `ToolBll.NomUtilisateurDuLoginAd` (LDAP) : non lus.
9. `circe-develop/docs/regles-inclusion-exclusion-deblocage.md` : non lu (déblocage, RG-INT-044 partielle).
10. Exports fichiers (« Surf », 2m2, pièces jointes réception) : seul le point d'écriture CSV des trains a été repéré (RG-INT-045) ; formats de colonnes non analysés.
11. `Web.CIRCE-*.config`, `Web.QUALIF.config` : transformations de configuration non lues (valeurs des environnements, adresses SMTP).
12. Tests unitaires (`ClearChannel.Circe.Test`) : non exploités pour les batchs (seuls `SuiviEtatReservationBll` et `AdminPreparationDeblocageBll` ont des tests visibles).
13. Second projet base de données `ClearChannel.CIRCE.Database/ClearChannel.CIRCE.Database.sqlproj` : existence constatée, divergences avec `BDD/DATABASE` non comparées.
