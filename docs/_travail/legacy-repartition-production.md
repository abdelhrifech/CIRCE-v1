# Legacy — Répartition, UM / colis, production aval (points d'interface Réception / Coordination)

Périmètre : analyse de l'EXISTANT (circe-develop, lecture seule). Aucune règle déduite de la cible.
Racines abrégées : `[SQL]` = `circe-develop/BDD/DATABASE/DATABASE/dbo/Stored Procedures/` (ou `/Tables/`) ; `[BLL]` / `[REPO]` / `[ENT]` = `circe-develop/ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.BLL|Repositories|Entities/`.

Statuts (colonne `rpc_statut`, FK vers `tr_statut`) : enum `[ENT]/Enums.cs:52-77` et `[BLL]/CommunBll.cs:46-59` (« l'ordre correspond aux identifiants de la table », l.43-44) :
0 A traiter · 1 En cours · 2 Instruction ok · 3 Erreur · 4 Annulé · 5 A imprimer · 6 Préparé · 7 A expédier · 8 Terminé · 9 Export prépa · 10 Au roulage.
Les libellés réels de `tr_statut` (données) n'ont pas été lus : seule la correspondance enum/ordre est documentée.

Constat structurant : le même champ `rpc_statut` est porté par 4 tables (`tf_repart_calcul`, `tf_UM`, `tf_colis`, `tf_face_train`), avec des cycles de vie différents et non synchronisés (voir RG-RPR-012).

---

## 1. Règles — intégration des répartitions (flux AMT/Sybase → `tf_repart_calcul`)

### RG-RPR-001 (provisoire) — Une répartition déjà active n'est pas réintégrée (doublon)
- Description : si une ligne de log AMT (`tw_amt_log_repart`) porte un `rpfo_ident` déjà présent dans `tf_repart_calcul` avec un statut différent de 4, la ligne de log est supprimée (donc ignorée) et un message « Doublon envoie : <rpfo> » est écrit dans `tt_log`.
- Déclencheur : batch d'intégration (phase 2), `p_integ_ptf_reparts`.
- Conditions : `rc.rpc_rpfo_ident = r.rpfo_ident AND rc.rpc_statut <> 4`.
- Effet : suppression des lignes de log concernées ; pas d'alerte utilisateur. Une répartition annulée (4) peut donc être réintégrée (nouvelle ligne `tf_repart_calcul`).
- Statuts concernés : aucun changement ; 4 = seul statut qui « libère » le `rpfo_ident`.
- Profils : batch (`log_acteur = 'batch'`).
- Source : `[SQL]/p_integ_ptf_reparts.sql:72-90`.
- Confiance : CERTAINE. (Le test `exists` n'est pas corrélé : un seul doublon déclenche le log et le delete pour tous les doublons — comportement identique, sans impact fonctionnel.)

### RG-RPR-002 (provisoire) — Transcodage du type de préparation AMT et regroupement par afficheur
- Description : `tyaf_code` AMT est remplacé par le `tpr_id` logistique via `tr_typ_aff_amt` ; les lignes de log traitées en mode `talr_trait = 'B'` sont regroupées (SUM de `rpty_qte_affich`) par répartition/destination/réaction/type/date/semaine/société/secteur/affiche/annonceur/contrat/afficheur, et seul ce regroupement (`talr_trait = '1'`) alimente `tf_repart_calcul`.
- Déclencheur : batch `p_integ_ptf_reparts`.
- Conditions : jointure sur `tr_atelier.ate_code_amt = sect_code` (une ligne sans atelier correspondant n'est pas traitée par le curseur).
- Effet : `rpc_qte` = quantité cumulée ; `rpc_type = 0` ; `rpc_user = 'user_ptf'` ; `sem_num = datepart(ISO_WEEK, rpli_datdep)` et `sem_annee = rpli_anbas` (année de base AMT, pas l'année ISO de la date de départ) ; `rpc_theme` tronqué à 50 caractères.
- Statuts concernés : création en 0 (ou 3, RG-RPR-003).
- Profils : batch.
- Source : `[SQL]/p_integ_ptf_reparts.sql:167-236, 240-253, 351-401`.
- Confiance : CERTAINE (SQL lu). Incohérence potentielle `sem_num` ISO vs `sem_annee` « anbas » : INCERTAINE sur l'effet en fin d'année (cf. RG-COO-002).

### RG-RPR-003 (provisoire) — Contrôles d'anomalie à l'intégration (903, 905, 906, 907) et passage en statut 3
- Description : à l'intégration, chaque ligne est contrôlée : destinataire inconnu (anomalie 903), support inconnu (905), type de préparation inconnu (906), atelier inconnu (907). 905/906/907 forcent la valeur à 0 et le statut à 3 (Erreur) ; 903 crée une anomalie mais NE change PAS le statut.
- Déclencheur : batch `p_integ_ptf_reparts`.
- Conditions : `tr_destinataire` (des_id, des_type) introuvable → 903 ; `tr_categorie_support`/`tr_type_preparation`/`tr_atelier` introuvable → 905/906/907.
- Effet : anomalies insérées dans `tf_anomalies` (`ano_user = 'user_ptf'`, sans doublon par `rpc_id`/`tan_id`). Si l'atelier est inconnu (907), la branche `else` n'insère PAS la répartition : les anomalies sont néanmoins rattachées à `@rpc_id` (valeur du tour précédent / NULL) — comportement non maîtrisé. Sans destinataire, `dest_id` est NULL (FK nullable) et la ligne est insérée en statut 0.
- Statuts concernés : → 0 (nominal), → 3 (905/906/907), → 0 avec anomalie 903.
- Profils : batch.
- Source : `[SQL]/p_integ_ptf_reparts.sql:269-347, 439-473`.
- Confiance : CERTAINE (texte SQL) ; effet de bord sur `@rpc_id` = INCERTAINE (non rejoué).
- Remarque interface : le bloc d'insertion est dans le `else` de 907 (l.348-437) ; pas de statut dédié pour 903.

### RG-RPR-004 (provisoire) — Ligne de log en erreur d'insertion marquée « E »
- Description : si l'insertion dans `tf_repart_calcul` échoue (`@error <> 0` ou `@rpc_id = 0`), la ligne de log source passe à `talr_trait = 'E'` ; sinon les lignes `'B'` passent à `'T'` en fin de traitement.
- Déclencheur : batch.
- Source : `[SQL]/p_integ_ptf_reparts.sql:403-436, 488-499`.
- Confiance : CERTAINE. (`@rpc_id = @@identity` peut garder l'ancienne valeur si l'insert échoue — INCERTAINE.)

### RG-RPR-005 (provisoire) — Purge totale des tables de travail et correction UM_qte = 0
- Description : la purge supprime TOUTES les lignes de `tw_amt_log_repart`, `tw_amt_log_destination`, `tra_amt_log_instruction`, `tra_amt_log_instruc_det`, `tra_amt_log_statut_repart`, `tra_amt_log_train` (plus uniquement les lignes `'T'`, correctif IT 34650 / SJA 29/03/2016), puis force `tf_UM.UM_qte = 1` là où `UM_qte = 0`.
- Déclencheur : batch `p_integ_ptf_purge`.
- Effet de bord : modification silencieuse des quantités d'UM (0 → 1) pour tout `tf_UM`, y compris des UM déjà expédiées.
- Statuts : aucun.
- Source : `[SQL]/p_integ_ptf_purge.sql:14-31`.
- Confiance : CERTAINE.

### RG-RPR-006 (provisoire) — Intégration des statuts de répartition AMT désactivée
- Description : `p_integ_ptf_statut_repart` retourne immédiatement (`return 0`, « SJA => on ne fait plus ») ; tout le code suivant (mapping `instruction_train.tsr_repart_code` 1/2/3 En cours/Plateforme/Commerce) est mort. `tr_statut_repart` n'est donc plus alimentée par ce flux.
- Source : `[SQL]/p_integ_ptf_statut_repart.sql:30-31` (code mort : 47-141).
- Confiance : CERTAINE sur le `return 0` ; l'alimentation éventuelle ailleurs de `tsr_repart_code` n'a pas été recherchée (la propriété `StatutRepart` est lue en `[REPO]/PreparationRepository.cs:1015` et `PreparationDeroulantsRepository.cs:658`).

### RG-RPR-007 (provisoire) — Archivage des logs AMT après traitement
- Description : `p_valid_amt_reparts` archive dans `th_amt_log_repart` (côté AMT via serveur lié et côté PTF) les lignes `talr_trait = 1`, puis supprime ces lignes ; archive et vide aussi `tw_amt_log_destination`. Côté PTF : transaction avec rollback ; côté AMT : `exec(@sql)` hors transaction.
- Source : `[SQL]/p_valid_amt_reparts.sql:28-95, 102-223`.
- Confiance : CERTAINE ; usage actuel (appel) non retrouvé → INCERTAINE sur son activité (SSIS `Flux_Repartition_Amt_Ptf.dtsx` non lu).

---

## 2. Règles — déblocage de répartition (interface Coordination, complément de RG-COO-083/084/085)

### RG-RPR-008 (provisoire) — Une répartition n'est pas déblocable si une UM est à un statut ≥ 6
- Description : la liste des préparations « empêchant le déblocage » est celle des `tf_UM` liées (via `tf_repart_calcul.UM_id`) au `rpfo_ident` avec `rpc_statut >= 6` (Préparé, A expédier, Terminé, et au-delà).
- Déclencheur : contrôle avant déblocage (`ControleRepartitionsDeblocables`).
- Conditions : `tf_UM.rpc_statut >= 6` et `tf_repart_calcul.rpc_rpfo_ident = @rpfo_ident`. Les répartitions sans UM (statut 0/1/3 sans UM_id) ne sont jamais bloquantes ; le statut du `tf_repart_calcul` lui-même n'est pas testé.
- Effet : la liste renvoyée (plateforme, atelier, code barre UM, contrat, thème, statut) sert de message de refus.
- Statuts concernés : UM 6, 7, 8 (9/10 n'existent pas sur UM).
- Profils : droit `debloque_repart` côté menu (cf. RG-COO-090 : pas de contrôle serveur).
- Source : `[SQL]/p_s_controle_rendumain.sql:15-21` ; `[REPO]/RepartitionRepository.cs:138-153` ; `[BLL]/RepartitionService.cs:55-60`.
- Confiance : CERTAINE. (Dans la procédure, `return 0` précède le test d'erreur : code mort.)

### RG-RPR-009 (provisoire) — Le déblocage annule répartition et UM mais pas les colis
- Description : `p_u_statut_repart_deblocage` passe à 4 (Annulé) les `tf_repart_calcul` du couple (`rpc_repartition`, `rpc_rpfo_ident`) dont le statut ≠ 4, puis les `tf_UM` associées (statut ≠ 4), avec date/utilisateur fournis par l'appelant (uniformité Broadcast/Circé, US 401). L'annulation des colis est commentée (ancienne colonne `col_statut = 6`, `tf_ordre_preparation` supprimée).
- Déclencheur : action « Débloquer » (`DebloquerRepartitionsCIRCE`).
- Conditions : transaction SQL propre à la procédure (rollback si erreur) ; l'utilisateur passé est `""` côté C# (`rpc_user`/`UM_user` écrits vides).
- Effet : lignes `tf_UM_colis` et `tf_colis` conservées ; un colis contenant des UM annulées garde son statut. Complémentaire : `p_i_th_repart_annule` historise (th_repart_annule).
- Statuts concernés : repart `* → 4` ; UM `* → 4` (y compris 0/1/3/5) ; colis inchangé.
- Profils : cf. RG-RPR-008.
- Source : `[SQL]/p_u_statut_repart_deblocage.sql:34-73` ; `[REPO]/RepartitionRepository.cs:121-136`.
- Confiance : CERTAINE (SQL). Impact sur colis ouverts : conséquence déduite du code commenté, PROBABLE.

### RG-RPR-010 (provisoire) — Déblocage en deux temps AMT puis Circé sans atomicité
- Description : `DebloquerRepartitions` appelle d'abord Sybase (`p_urpfo01`, `rpfo_valid = 0`) puis Circé ; le résultat n'est retenu que si les deux compteurs sont égaux, sinon retour 0. Si Sybase échoue (exception), le compteur AMT vaut 0 mais le déblocage Circé a lieu quand même ; le retour 0 est alors indifférencié d'un refus. Exception Sybase journalisée (Elmah) seulement.
- Déclencheur : ancien écran Répartitions (`view_repart`) — cf. RG-COO-085.
- Effet : états AMT et Circé potentiellement divergents (annulé dans Circé, non débloqué dans AMT, ou inversement).
- Source : `[BLL]/RepartitionService.cs:35-53` ; `[REPO]/RepartitionRepository.cs:87-136`.
- Confiance : CERTAINE sur le code ; usage en production de l'écran AMT : INCERTAINE.

---

## 3. Règles — création des UM (« colisage » des répartitions 2 m² fixe / pliage)

### RG-RPR-011 (provisoire) — Construction des UM : agrégation et découpage par quantité d'UM du support
- Description : `BuildUm` trie les lignes de répartition (destinataire, contrat, support, type de préparation, thème, repiquage, afficheur) et les cumule tant que ces clés sont identiques ; un changement de destinataire/contrat/support/type/thème/repiquage clôt l'UM ; un changement d'afficheur ne clôt l'UM que si le destinataire est `DesDispatch = 'O'`. Pour `DesDispatch = 'N'` (ou NULL), l'afficheur et `PersIdent` sont effacés. Ensuite, toute UM dont la quantité dépasse `SupQteUM` (non nul) est scindée en UM de `SupQteUM` + un reliquat.
- Déclencheur : action « Colisage » (détail / synthèse) — `SetColisageDetail`, `SetColisageSynthese`.
- Conditions : `SupQteUM` renseigné et ≠ 0.
- Effet : liste de préparations destinées à `InsertUM`. TODO du code : « changer l'algorithme pour ne plus effacer la donnée afficheur » (`PreparationService.cs:115-117`).
- Statuts : pas encore de statut (création en RG-RPR-012).
- Profils : droits `_2m2_fixe*`/`pliage*` côté menu (hors périmètre détaillé).
- Source : `[BLL]/PreparationService.cs:81-107, 113-269`.
- Confiance : PROBABLE (algorithme à effets de bord sur `prLast`, partitions non testées ; les 3 `ShallowCopy` de la boucle de découpage partagent la même `currentPrep` pour les UM pleines — `RpcIdLstUM` partagé : les répartitions sont donc toutes rattachées à la première UM insérée ? INCERTAINE).

### RG-RPR-012 (provisoire) — Création d'une UM : statut 1 en cascade sur les répartitions, code barre, date d'affichage minimale
- Description : `InsertUM` insère un `tf_UM` en statut 1 (En cours) puis met à jour son `UM_code_barre` (`AASS-` + `UM_id` sur 13 chiffres, AA/SS = année/semaine courantes de l'UM) ; `UM_code_synthese` = `AASSMMJJ` + atelier sur 2 + destinataire sur 8 chiffres ; poids = `SupPoids × Quantité`. Chaque `tf_repart_calcul` de l'UM reçoit `UM_id`, `rpc_statut = 1`, date et utilisateur de mise à jour. Puis `p_u_DateAffMinUM` renseigne `UM_date_aff` = minimum de `rpc_dat_aff` des répartitions liées (les UM sans lien reçoivent le minimum du lot).
- Déclencheur : « Colisage » / bouton de création d'UM.
- Conditions : chaque UM est créée dans un contexte/transaction distincte (pas d'atomicité globale) ; flag `IsBusV3` + atelier bus → mock (`PreparationBusMockRepository`) — non analysé.
- Effet : répartition `0|3 → 1` sans contrôle du statut d'origine (une répartition en 3 Erreur ou 4 Annulé est transformée en 1 si elle figure dans la sélection).
- Statuts concernés : repart `X → 1`, UM créée à 1.
- Source : `[REPO]/PreparationRepository.cs:190-303, 309-330` ; `[SQL]/p_u_DateAffMinUM.sql:19-41`.
- Confiance : CERTAINE sur le code ; absence de filtre de statut sur l'entrée = PROBABLE (le filtre peut être fait dans l'écran/`p_s_*`, non lu).

### RG-RPR-013 (provisoire) — « Retirer » : suppression des UM et retour des répartitions à 0
- Description : `DeleteUM` remet les `tf_repart_calcul` liées à `rpc_statut = 0`, `UM_id = NULL`, puis supprime physiquement `tf_UM`. Aucune vérification des colis (`tf_UM_colis` référence `tf_UM` : la suppression échoue par FK si l'UM est dans un colis).
- Déclencheur : action « Retirer préparation ».
- Statuts : repart `* → 0` ; UM supprimée.
- Source : `[BLL]/PreparationService.cs:275-288` ; `[REPO]/PreparationRepository.cs:336-387`.
- Confiance : CERTAINE (FK : `[SQL Tables]/tf_UM_colis.sql:10`). `rpc_user` n'est pas mis à jour (seule la date).

### RG-RPR-014 (provisoire) — « Préparer » : UM et répartitions passent à 6
- Description : `PreparerPreparation` fixe le statut cible 6 (Préparé) et `UpdateRepartUM` l'applique à l'UM ET à ses `tf_repart_calcul` (date/utilisateur mis à jour).
- Déclencheur : action « Préparer » (liste des UM).
- Conditions : aucun contrôle du statut d'origine dans le service.
- Statuts : UM et repart `* → 6`.
- Source : `[BLL]/PreparationService.cs:294-299` ; `[REPO]/PreparationRepository.cs:435-470`.
- Confiance : CERTAINE. Garde éventuelle côté vue/JS (`Preparation2m2Fixe.js`, `PreparationColisage.js`) : non lue.

### RG-RPR-015 (provisoire) — Le statut de l'UM prime sur celui de la répartition dans le suivi
- Description : après création de l'UM, l'évolution (7, 8) ne touche que `tf_UM`/`tf_colis`, pas `tf_repart_calcul`. Le suivi de production lit donc le statut de `tf_UM` s'il existe (`rc.UM_id` renseigné), sinon celui de `tf_repart_calcul`.
- Déclencheur : écran Suivi de production.
- Source : `[SQL]/p_s_adminSuiviRead.sql:70-79` (commentaire explicite) ; propagation limitée : `[REPO]/PreparationRepository.cs:393-429` (`UpdateUM` : `tf_UM` seul) vs `435-470` (`UpdateRepartUM` : UM + repart).
- Effet d'interface : les retours de statut (RG-RPR-019/020/021) n'étant pas propagés aux répartitions, `tf_repart_calcul.rpc_statut` reste à 1 ou 6 pour des UM terminées ; toute règle de Coordination qui lit `tf_repart_calcul.rpc_statut` (RG-COO-042 « ligne précédente à 4 », filtre `rpc_statut <> 4`) ne voit jamais 7/8.
- Confiance : CERTAINE sur le code lu ; la propagation éventuelle par `MiseAJourStatutUm` (`PreparationColisRepository.cs:381`) n'a pas été lue → INCERTAINE pour le chemin colisage « nouvelle version ».

---

## 4. Règles — colis, rattachement UM/colis, expédition

Deux implémentations coexistent : `PreparationColisageService` (+ `PreparationColisageRepository`, JS `PreparationColisage.js`) et `PreparationColisBll` (+ `PreparationColisRepository`). Elles divergent (voir RG-RPR-016, 017, 019).

### RG-RPR-016 (provisoire) — Seules les UM En cours (1) ou Préparées (6) du même destinataire peuvent être mises dans un colis
- Description : ajout d'une UM par code barre (détail ou synthèse) : UM filtrées sur statut 1 ou 6 ; destinataire de l'UM = destinataire du colis (version `PreparationColisBll` : ET atelier identique) ; une UM déjà dans le colis n'est pas ajoutée. À l'ajout : ligne `tf_UM_colis` (`uc_qte`), UM → 6, recalcul du poids du colis.
- Déclencheur : saisie/scan de l'UM sur l'écran Colisage / PreparationColis.
- Conditions / messages : « L'UM n'existe pas ou n'est pas en cours ou préparée » ; « Le destinataire de l'UM ne correspond pas à celle du colis » ; « L'UM à ajouter existe déjà dans le colis » (`PreparationColisageService`) ; « Le destinataire des UMs est différent de celui du colis ! » (`PreparationColisBll`, test dest ET ate). Une UM Préparée (6) déjà dans un autre colis peut être ajoutée à un second colis (fractionnement par `uc_qte`).
- Statuts : UM `1|6 → 6`.
- Profils : droit `train_preparation`/production selon écran (non vérifié en serveur).
- Source : `[BLL]/PreparationColisageService.cs:76-148` ; `[BLL]/PreparationColisBll.cs:270-324` ; `[REPO]/PreparationColisRepository.cs:311-334` ; `[SQL]/p_s_UM_from_code.sql` (recherche : id, puis code synthèse, puis code barre).
- Confiance : CERTAINE (messages explicites).

### RG-RPR-017 (provisoire) — Création de colis, ouverture et suppression
- Description : un colis est créé en statut 1 (En cours) avec format « À définir » (5) ; `p_u_detail_colis` fixe ensuite l'adresse principale (`adr_principale = '1'`), le code colis `C-` + `colis_id` sur 18 chiffres, et le transporteur/tarif (`tr_ate_dest_trans` pour dest+atelier). Un colis ne se supprime que s'il ne contient plus d'UM. « Ouvrir » un colis : `PreparationColisageService.OpenColis` met colis ET toutes ses UM à 1 (`p_u_statut_colis_UM`) ; `PreparationColisBll.OuvrirColis` met le colis à 1, vide `colis_dat_expe`, et remet les UM à 6 — deux comportements différents.
- Déclencheur : écrans Colisage / Colis ; ouverture depuis scan du code colis.
- Statuts : colis `∅ → 1` ; `7|8 → 1` (ouverture) ; UM `7|8 → 1` (service Colisage) ou `→ 6` (Bll Colis).
- Source : `[BLL]/PreparationColisageService.cs:35-54, 227-238, 329-345` ; `[BLL]/PreparationColisBll.cs:139-158` ; `[REPO]/PreparationColisRepository.cs:203-225` ; `[SQL]/p_u_detail_colis.sql:17-41` ; `[SQL]/p_u_statut_colis_UM.sql:22-42`.
- Confiance : CERTAINE ; coexistence des deux comportements = point à arbitrer (INCERTAINE sur lequel est exposé en production).
- Remarque : `OpenColis` peut rouvrir un colis déjà Terminé (8) sans contrôle.

### RG-RPR-018 (provisoire) — Retrait d'une UM d'un colis : retour de l'UM à 1 si elle n'est plus dans aucun colis, recalcul du poids
- Description : suppression de la ligne `tf_UM_colis` ; si l'UM n'est plus dans aucun colis non expédié, l'UM repasse à 1 (En cours) ; poids du colis recalculé. `GetColisFromUm` retourne liste vide si TOUS les colis sont au statut 7 (« expédié »).
- Statuts : UM `6 → 1`.
- Source : `[BLL]/PreparationColisageService.cs:240-322` ; `[BLL]/PreparationColisBll.cs:327-371`.
- Confiance : PROBABLE. Dans la 1re surcharge (`DestroyPrepaUmColis(int umId,…)`, l.253-263) l'objet `Um` porte `Colis_statut` et non `RpcStatut` : `UpdateUM` (`[REPO]/PreparationRepository.cs:409,418`) écrirait alors la valeur par défaut de `RpcStatut` au lieu de 1 — INCERTAINE (surcharge possiblement non utilisée, appelants non recherchés). Le statut du `tf_repart_calcul` n'est pas rétabli (cf. RG-RPR-015).

### RG-RPR-019 (provisoire) — Expédition d'un colis : colis, UM (ou trains) → 7 « A expédier »
- Description : l'action « Expédier » enregistre transporteur/tarif (`tsp_id_tarif_code`), code externe, commentaire, poids, format, `colis_dat_expe = now`, et met le colis à 7. Si l'atelier du colis est 1 à 4 : toutes les UM du colis → 7 ; sinon les `tf_face_train` du colis → 7. En « re-saisie » (colis déjà 7) seul le code externe est mis à jour. Un code externe « ETIQUETTES » est remis à NULL. Si le transporteur vaut 2 (Calberson codé en dur) et que le statut avant action est 1, génération d'un fichier BL (`GenerateFileExportBL`) ; pour tsp_id = 2 l'écran reste ouvert pour saisir le code externe.
- Déclencheur : écran Expédition colis.
- Conditions : `model.rpc_statut == 1 && tsp_id == 2` (BL) ; `ate_id` ∈ [1;4] ⇒ UM sinon trains ; la variante `p_u_expedie_Colis` (appelée par `ExpedierColis`, service Colisage) met colis → 7 et UM → 7, la clause « NOT EXISTS colis non expédié » comparant le colis à lui-même (`tf_colis.colis_id = col.colis_id`) : elle est toujours vraie après la mise à jour du colis, donc une UM répartie sur deux colis passe à 7 dès l'expédition du premier (contraire au commentaire l.45-47).
- Statuts : colis `1 → 7` ; UM `1|6 → 7` ; face train `* → 7`.
- Profils : non contrôlés côté serveur.
- Source : `[BLL]/PreparationColisBll.cs:497-560` ; `[REPO]/PreparationColisRepository.cs:482-569` ; `[SQL]/p_u_expedie_Colis.sql:34-73` ; `[BLL]/PreparationColisageService.cs:211-220` (message « Problème lors de l'expédition » si ≠ 1 ligne — or `p_u_expedie_Colis` retourne 0/-1, le test `!= 1` côté C# porte sur le nombre de lignes EF : INCERTAINE).
- Confiance : CERTAINE sur les mises à jour ; PROBABLE sur le défaut NOT EXISTS (lecture du SQL).

### RG-RPR-020 (provisoire) — Fin de journée : tout colis à 7 passe à 8 « Terminé » (batch) ou unitairement
- Description : `p_batch_fin_journee_colis` passe à 8 les UM des colis à 7, les `tf_face_train` des colis à 7, puis les colis à 7 (sans condition de date/atelier). Une action unitaire `SetFinDeJournee` fait colis + UM → 8 via `p_u_statut_colis_UM` (sans toucher aux trains), message « Le colis expédié ».
- Déclencheur : batch quotidien (job introuvable dans le dépôt) / bouton fin de journée.
- Statuts : colis `7 → 8` ; UM `7|autres → 8` (batch : toute UM d'un colis 7, quel que soit son statut courant) ; train `→ 8`.
- Profils : batch (`suser_name()`) ; manuel : non contrôlé.
- Source : `[SQL]/p_batch_fin_journee_colis.sql:23-67` ; `[BLL]/PreparationExpeditionService.cs:267-276`.
- Confiance : CERTAINE. Planification du batch : INCERTAINE (non exporté).

### RG-RPR-021 (provisoire) — Statut 7 pour les trains rattachés à un colis (déroulants)
- Description : l'ajout d'un train (face_train) à un colis fixe immédiatement `tf_face_train.rpc_statut = 7` et `colis_id` ; un train déjà rattaché à un colis est refusé (« Il existe déjà un train dans ce colis ») ; le destinataire doit correspondre (« Le destinataire du train ne correspond pas à celui du colis », `ate_id` aussi côté `PreparationColisTrainBll:160`). Retirer le train : mise à jour via `UpdateFaceTrains` (valeurs non lues).
- Statuts : face train `5|9|10 → 7` (aucun contrôle du statut d'origine dans ce service).
- Source : `[BLL]/PreparationColisageService.cs:154-209` ; `[BLL]/PreparationColisTrainBll.cs:160`.
- Confiance : CERTAINE (messages) ; interface Coordination : la face passe de 5/9/10 à 7 sans contrôle — conséquences sur RG-COO-077/083 à valider.

### RG-RPR-022 (provisoire) — Poids du colis : minimum 1 kg, +3 kg pour les ateliers 7 et 8
- Description : poids = Σ (`uc_qte` × `sup_poids`) des UM du colis ; sans UM, Σ (nombre de faces train × `sup_poids`) ; si nul, poids du support 0 ; minimum forcé à 1,0 kg (« pour Calberson ») ; ajout de 3,0 kg si `ate_id IN (7,8)`.
- Déclencheur : ajout/retrait d'UM ; création colis.
- Source : `[SQL]/p_u_poidsColis.sql:18-61`.
- Confiance : CERTAINE. (Le +3 est réappliqué à chaque recalcul mais le poids est recalculé depuis zéro : pas de cumul.)

### RG-RPR-023 (provisoire) — Colis : statut et quantités d'UM
- Description : `tf_UM_colis` (clé UM_id + colis_id, `uc_qte` = quantité de l'UM dans le colis, UM_qte = quantité totale) permet le fractionnement d'une UM sur plusieurs colis ; la quantité « préparée » est `uc_qte`, « à préparer » `UM_qte` ; `p_s_UM_from_code` renvoie `ISNULL(uc_qte, UM_qte)`. Aucune contrainte vérifiant que Σ `uc_qte` ≤ `UM_qte` n'a été trouvée.
- Source : `[SQL Tables]/tf_UM_colis.sql:1-11` ; `[BLL]/PreparationColisageService.cs:128-135` ; `[SQL]/p_s_UM_from_code.sql:39`.
- Confiance : PROBABLE (la saisie de `uc_qte` via `UpdatePrepaUmColis`, `[REPO]/PreparationColisageRepository.cs:356-383`, n'est pas bornée dans le code lu ; contrôles JS non lus).

---

## 5. Règles — listes UM et suivis (interface Réception)

### RG-RPR-024 (provisoire) — Liste des UM 2 m² : filtres en dur et association à l'affiche reçue validée
- Description : `p_s_listeUM_2m2` liste les UM hors statuts 3 et 4, pour les ateliers 1 et 4 uniquement (en dur), dont l'utilisateur a le droit (`tr_utilisateur_data.loginWindows`), semaine/année facultatives, adresse principale du destinataire. Elle associe `affiche_id` et `validationAdmin` aux UM dont l'affiche livrée (même `cont_num`, plateforme, annonceur, support, thème, hors repiquage) est validée par l'admin (`validationAdmin = 1`) pour la semaine/année passées. L'info est affichée « oui/non » sans bloquer l'action.
- Déclencheur : écran Préparation 2 m² fixe / pliage (liste UM).
- Conditions : `tf_UM.rpc_statut NOT IN (3,4)` ; `tf_UM.ate_id IN (1,4)` ; jointure inner sur `tr_dest_adresse` principale (une UM sans adresse principale disparaît de la liste) ; `SELECT DISTINCT`.
- Effet : aucun changement de statut ; colonne `UM_date_aff` ajoutée (en-tête daté « 04-06-2026 », probablement une erreur de date).
- Profils : périmètre d'ateliers de l'utilisateur.
- Source : `[SQL]/p_s_listeUM_2m2.sql:36-62, 113-142` (variante pliage : `p_s_listeUM_pliage.sql:43-50`) ; affichage : `…/Controllers/Preparation/PreparationController.cs:764-765`.
- Confiance : CERTAINE sur la requête ; l'absence de blocage par `validationAdmin` côté controller/JS : PROBABLE (JS non lus).
- Interface Réception : la réception ne conditionne PAS la création d'UM ni le passage 1 → 6 dans le code lu ; elle n'est qu'un indicateur d'affichage.

### RG-RPR-025 (provisoire) — Suivi de production : « reçu » calculé par dossier, affiche associée par dossier/support/thème/plateforme
- Description : `p_s_adminSuiviRead` agrège les `tf_repart_calcul` (statut UM si UM, sinon statut répartition), les `tf_face_train` de la semaine de départ et les préparations externes `tf_prepa_affiche` pour les supports 100, 102, 105 (en dur). `isReceived = 1` dès qu'une livraison associée à une affiche validée (`validationAdmin = 1`, `FromBroadcast` nul ou 0) existe pour le même `cont_num` (jointure sur `cont_num` seul, sans support ni thème) ; `affiche_Id` et `validationAdmin` sont renseignés si annonceur, support, thème et plateforme coïncident.
- Déclencheur : écran Suivi de production (droit `suivi_suivi_production`).
- Effet : lecture seule. Le libellé « reçu » est donc plus large que l'association affiche (risque de faux « reçu »).
- Source : `[SQL]/p_s_adminSuiviRead.sql:52-67, 72-136, 155-168` ; `[BLL]/SuiviSuiviProductionBll.cs:97-113` (`"oui"/"non"`).
- Confiance : CERTAINE sur les jointures ; qualification « bug » INCERTAINE.

### RG-RPR-026 (provisoire) — État des réservations : « affiche reçue » = affiche validée admin de la famille/format de support
- Description : `AffRecus = "oui"` si une `tf_prepa_affiche` du même contrat/semaine/année/thème a une `affiche` avec `validationAdmin` vrai ET un `sup_id` appartenant aux catégories de support de la famille du type de préparation × format (surface) ; sinon `"no"` (valeur `"no"` et non `"non"` : libellé hétérogène avec `"oui"`).
- Déclencheur : écran Etat des réservations (droit `suivi_suivi_production`).
- Effet : `SupId` déduit de `transcoCategSupport` par surface.
- Source : `[BLL]/SuiviEtatReservationBll.cs:172-201` ; tests associés non lus (`SuiviEtatReservationBllTest.cs`).
- Confiance : CERTAINE.

---

## 6. Règles — trains (bloc Paris et ordonnancement), interface Coordination

### RG-RPR-027 (provisoire) — Génération des faces « entretien » (8 % par défaut) avec bloc spécifique à la convention VPS_75 101 0004
- Description : à l'association des trains, `p_u_associe_train` crée des faces `entretien` en plus des faces commerciales : nb = arrondi(nb faces × `instr_entretien` / 100), avec `instr_entretien` lu sur l'instruction (défaut 8 si NULL). Un premier bloc traite toutes les faces dont `RefConvention` ≠ `'VPS_75 101 0004'`, un second bloc (copie conforme) traite uniquement cette convention (Paris). Les faces créées ont `rpc_statut = 2` (Instruction ok), `cadre_lib = 'entretien'`, `ordre_propose = ordre_reel = 1`, identifiant train se terminant par `19`, repiquage extrait du thème (`repiquage#thème`), `RefConvention` propagée.
- Déclencheur : intégration / association des trains (batch d'instruction).
- Statuts : face entretien `∅ → 2`.
- Source : `[SQL]/p_u_associe_train.sql:65-73, 396-432, 405-419, 555-699`.
- Confiance : CERTAINE (copie de code) ; la différence fonctionnelle Paris/hors Paris se limite au filtre convention (aucune autre divergence dans le bloc lu) → effet métier du « bloc Paris » = INCERTAINE (pas d'autre traitement spécifique trouvé dans la procédure).

### RG-RPR-028 (provisoire) — Export des trains : ordonnancement « Paris » (alternance ville / commercial) et passage à 5 « A imprimer »
- Description : à l'export des trains, les faces dont la convention de référence est incluse (paramétrage `ListeRefConventions`, structures, produits) et au statut 2 sont ordonnées par structure : liste « ville » (`IdTypeDossier == 3`) et liste « commercial » (≠ 3) du panneau de départ (le panneau le plus fourni si deux panneaux), alternées par pas de 10 en commençant par la plus longue liste (`>=` : commercial à égalité), le reliquat étant ajouté à la suite ; puis le second panneau. `UpadateTrainParis` écrit `ordre_reel` (cast en `byte`) et `ordre_calcule`, passe les faces à 5 et les `instruction_train` correspondantes à 5. Les autres trains sont exportés (`ExportTrainsV2`) au statut 5 sans recalcul d'ordre. Historique `ExporterTrains` écrit.
- Déclencheur : action « Export trains » (droit `pliage`, cf. RG-COO-072).
- Conditions : `x.rpc_statut == 2` (statut 2 seul) ; `x.IdProduit.HasValue` pour le calcul.
- Effet : faces `2 → 5` ; instruction `* → 5`.
- Profils : `pliage`.
- Source : `[BLL]/PreparationDeroulantsService.cs:136-171, 175-206, 1068-1246` ; `[REPO]/PreparationDeroulantsRepository.cs:1670-1695`.
- Confiance : CERTAINE sur le flux. Anomalies probables : (a) `listeWithProduit` (l.155-158) calculé mais jamais réaffecté → le filtre produit est sans effet ; (b) pour les exclusions (l.139-141, 147-149) le code AJOUTE les non-exclus au lieu de filtrer ; (c) `ordre_reel` est un `byte` : position = 10 × rang → débordement à partir de 26 faces par structure (INCERTAINE : type de colonne non vérifié).

---

## 7. Machines d'états (existant)

### 7.1 `tf_repart_calcul.rpc_statut` (ligne de répartition)
| Statut courant \ Action | Intégration batch | Anomalie 905-907 | Créer UM (InsertUM) | Retirer (DeleteUM) | Préparer (UpdateRepartUM) | Déblocage | Retours colis/exp. |
|---|---|---|---|---|---|---|---|
| ∅ | → 0 | → 3 (ligne 907 non insérée) | — | — | — | — | — |
| 0 | — | — | → 1 | — (déjà 0) | → 6 | → 4 | — |
| 1 | — | — | → 1 (réaffectation UM) | → 0 | → 6 | → 4 | inchangé |
| 3 | — | — | → 1 (pas de filtre) | → 0 | → 6 | → 4 | — |
| 4 | réintégrable (RG-RPR-001) | — | → 1 (pas de filtre) | → 0 | → 6 | (ignoré, déjà 4) | — |
| 6 | — | — | → 1 | → 0 | → 6 | → 4 | inchangé (reste 6 même si UM 7/8) |
Pas de transition 7/8 sur cette table (RG-RPR-015). Aucun contrôle serveur de la table de transitions : toute transition est possible depuis l'API appelée.

### 7.2 `tf_UM.rpc_statut`
| Statut \ Action | Création | Ajout au colis | Retrait du colis (plus aucun colis) | Préparer | Expédier colis | Fin de journée (batch/manuel) | Ouvrir colis | Déblocage |
|---|---|---|---|---|---|---|---|---|
| ∅ | → 1 | — | — | — | — | — | — | — |
| 1 | — | → 6 | → 1 | → 6 | → 7 | → 8 (batch si colis 7) | → 1 | → 4 |
| 6 | — | → 6 (autre colis) | → 1 | → 6 | → 7 | → 8 | → 1 ou → 6 selon l'écran | → 4 |
| 7 | — | refusé (filtre 1/6) | `GetColisFromUm` vide ⇒ pas de retour | — | → 7 | → 8 | → 1 ou → 6 | → 4 |
| 8 | — | refusé | — | — | — | — | → 1 ou → 6 | → 4 |
| 3, 4 | exclues de `p_s_listeUM_2m2` | refusé | — | — | — | — | — | 4 : ignoré |
Suppression physique via « Retirer » (RG-RPR-013).

### 7.3 `tf_colis.rpc_statut`
| Statut \ Action | Création | Expédier | Fin de journée | Ouvrir | Suppression |
|---|---|---|---|---|---|
| ∅ | → 1 | — | — | — | — |
| 1 | — | → 7 | → 8 (manuel, `p_u_statut_colis_UM`) | → 1 | si vide |
| 7 | — | re-saisie code externe seulement | → 8 (batch ou manuel) | → 1 | — |
| 8 | — | — | — | → 1 (sans contrôle) | — |
Le déblocage de répartition ne modifie pas le colis (RG-RPR-009).

### 7.4 `tf_face_train.rpc_statut` (train, partie aval de la coordination)
| Statut \ Action | Association (p_u_associe_train) | Export trains | Ajout au colis | Expédition colis | Fin de journée |
|---|---|---|---|---|---|
| ∅ | → 2 | — | — | — | — |
| 2 | — | → 5 | → 7 | → 7 | — |
| 5 | — | — | → 7 | → 7 | — |
| 7 | — | — | — | → 7 | → 8 |
9 / 10 (Export prépa / Au roulage) : voir legacy-coordination.md §5.4 ; l'ajout au colis ne vérifie pas ces statuts.

---

## 8. Profils / droits constatés dans cette zone
Aucun contrôle serveur (cf. RG-COO-090) : seuls les menus filtrent par droits `tr_utilisateur_menu`.
| Droit | Usage observé dans cette zone |
|---|---|
| `debloque_repart`, `view_repart` | Déblocage / liste des répartitions (RG-RPR-008 à 010) |
| `pliage`, `_2m2_fixe*`, `pliage*` | Écrans UM / colisage / listes UM (non vérifié dans les vues) |
| `train_preparation` | Liste des colis, préparation des trains |
| `suivi_suivi_production` | Suivi de production, Etat des réservations |
| `Zone_Picking` | Écran zone picking (hors lecture détaillée) |
Périmètre d'ateliers : `tr_utilisateur_data.loginWindows` filtre les listes (`p_s_listeUM_2m2.sql:116,131` ; `p_s_adminSuiviRead.sql:91,94`).

## 9. Dépendances vers les autres modules
| Module | Dépendance | Références |
|---|---|---|
| Coordination | `tf_repart_calcul` (statut, `UM_id`, `rpc_rpfo_ident`) lu par `p_Alimentation_tf_prepa_affiche` (statut ≠ 4) ; déblocage dépend du statut des UM (≥ 6) ; faces train 2→5→7→8 | RG-RPR-008, 009, 015, 028 ; RG-COO-041 à 044, 077, 083, 084 |
| Réception | `validationAdmin`/`affiche_id` joints aux UM, au suivi de production et à l'état des réservations (indicateur seulement) ; `numeroReception` sur `tf_repart_calcul` (écrit par `p_u_numeroReception`, non relu ici) | RG-RPR-024 à 026 |
| Stock | non rencontré dans cette zone | — |
| Expédition externe | transporteur Calberson (tsp_id = 2 en dur), fichier BL (`TraIp`) | RG-RPR-019 |
| Broadcast/AMT | répartitions entrantes (SSIS `Flux_Repartition_Amt_Ptf`), `p_urpfo01` Sybase | RG-RPR-001 à 010 |
| Administration | `tr_atelier` (ateliers 1-4 = UM ; 7-8 = poids +3 kg), `tr_destinataire`, `tr_ate_dest_trans`, `tr_categorie_support` (`sup_poids`, `sup_qte_um`) | RG-RPR-011, 019, 022 |
| Historique | `histo_historique_entite` (`ExporterTrains`) ; `th_repart_annule` | RG-RPR-009, 028 |

## 10. Zones NON analysées (et pourquoi)
1. Procédures/fichiers non lus : `p_i_th_repart_annule`, `p_s_th_repart_annule`, `p_s_Repartition`, `p_s_rechercheRepartRecepAff`, `p_archivage_tf_*` (UM, UM_colis, colis, repart_calcul), `p_s_UM_from_Colis`, `p_s_colis_from_UM`, `p_s_colis*`, `p_s_detail_colis`, `p_integ_ptf_des` ; SSIS `Flux_Repartition_Amt_Ptf.dtsx` (ordonnancement des phases 1-3 inconnu).
2. Contrôleurs/vues/JS : `RepartitionController`, `Repartition.js`, `Preparation2m2Fixe.js`, `PreparationColisage.js`, et les gardes de statut côté UI : non lus (seul l'aval service/SQL l'a été) — les validations front éventuelles sont donc inconnues.
3. Écrans non analysés : `ColisBll`, `ListeColis`, `ListeRouleur`, `CoteCote`, `EditerBague`, `DetailDestinataire*`, `Activite`, `PreparationPliage`, `AnalyseProduction` (`AnalyseProductionBll.cs` ne contient aucun test de statut ni de `validationAdmin` d'après une recherche ciblée), `ZonePicking*` (seule la tête du BLL a été lue ; les règles de réception correspondent au module Réception).
4. `_2m2FixePreparation*` : traité indirectement via `PreparationService`/`PreparationRepository`/`PreparationColis*` ; les contrôleurs dédiés n'ont pas été lus.
5. Gestion bus (`IsBusV3`, `PreparationBusMockRepository`) : non analysé.
6. `PreparationColisRepository.MiseAJourStatutUm` (l.381) et `UpdateFaceTrains` : non lus (propagation vers `tf_repart_calcul`/`tf_face_train` inconnue).
7. Données de référence (`tr_statut`, `tr_atelier`, `tr_type_preparation`, `sup_qte_um`) : valeurs non lues (seul le mapping enum ↔ id est documenté ; les ateliers 1, 4, 7, 8 sont en dur dans le code sans libellé).
8. Jobs planifiés (fin de journée, intégration PTF) : introuvables dans le dépôt.
9. Tests unitaires (`PreparationDeroulantsServiceTest.CalculTrainParisTest`, `AdminPreparationDeblocageBllTest`, `SuiviEtatReservationBllTest`) : non lus ; ils pourraient révéler des règles attendues sur l'ordonnancement Paris.
10. Procédure `p_Alimentation_tf_prepa_affiche` et table `tf_face_train` (structure) : non relues ici (voir legacy-coordination.md).

## 11. Points à risque (synthèse)
- Statuts non synchronisés entre repart/UM/colis/train (RG-RPR-015, 018, 019) ; deux implémentations divergentes de « ouvrir colis » et du filtre destinataire (RG-RPR-016, 017).
- Déblocage : colis non annulés, atomicité AMT/Circé absente, utilisateur vide (RG-RPR-009, 010).
- `p_u_expedie_Colis` : test NOT EXISTS auto-référent (RG-RPR-019).
- Valeurs en dur : ateliers 1/4 (liste UM), 1-4 (UM vs trains), 7/8 (+3 kg), supports 100/102/105, transporteur 2, convention `VPS_75 101 0004`.
- Filtre produit sans effet, union au lieu d'intersection, `ordre_reel` en byte (RG-RPR-028).
- Anomalie 903 sans statut Erreur ; ligne sans atelier non insérée mais anomalies rattachées (RG-RPR-003).
- `isReceived` calculé au niveau du dossier seul (RG-RPR-025).
