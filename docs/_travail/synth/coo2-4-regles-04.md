### RG-COO-260 — Construction des UM (agrégation et découpage par quantité d'UM du support)
- Origine : CONSERVÉE
- Énoncé : `BuildUm` trie les lignes de répartition (destinataire, contrat, support, type de préparation, thème, repiquage, afficheur) et les cumule tant que ces clés sont identiques : un changement de destinataire / contrat / support / type / thème / repiquage clôt l'UM ; un changement d'afficheur ne clôt l'UM que si le destinataire est `DesDispatch = 'O'`. Pour `DesDispatch = 'N'` (ou NULL), l'afficheur et `PersIdent` sont effacés. Toute UM dont la quantité dépasse `SupQteUM` (non nul, ≠ 0) est scindée en UM de `SupQteUM` + un reliquat. Un seul thème par UM. Maquette : un UM par ligne destinataire × afficheur au fixe.
- Déclencheur : action « Colisage » (détail / synthèse) legacy ; en cible le déclencheur de création des UM est à trancher (RG-COO-240).
- Conditions : `SupQteUM` renseigné et ≠ 0 ; TODO legacy : « changer l'algorithme pour ne plus effacer la donnée afficheur » (`PreparationService.cs:115-117`).
- Effet / message d'erreur : liste de préparations destinées à `InsertUM` (RG-COO-261). Les 3 `ShallowCopy` de la boucle de découpage partagent la même `currentPrep` (`RpcIdLstUM` partagé) : les répartitions seraient rattachées à la première UM insérée (INCERTAIN, à vérifier par test avant reprise).
- Sources : legacy `PreparationService.cs:81-107,113-269` (ancien ID provisoire RG-RPR-011) ; spec `specs-existant-process.md §D` (EX-EXI-041, EX-EXI-073)
- Questions liées : Q-265, Q-271
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-261 — Création d'une UM : statut 1, code barre, code synthèse, poids, date d'affichage minimale
- Origine : CONSERVÉE
- Énoncé : `InsertUM` insère un `tf_UM` en statut 1 (En cours) puis calcule `UM_code_barre` = `AASS-` + `UM_id` sur 13 chiffres (AA / SS = année / semaine courantes de l'UM) ; `UM_code_synthese` = `AASSMMJJ` + atelier sur 2 + destinataire sur 8 chiffres ; poids = `SupPoids × Quantité`. Chaque `tf_repart_calcul` de l'UM reçoit `UM_id`, `rpc_statut = 1`, date et utilisateur de mise à jour. Puis `UM_date_aff` = minimum de `rpc_dat_aff` des répartitions liées (les UM sans lien reçoivent le minimum du lot).
- Déclencheur : « Colisage » / création d'UM.
- Conditions : chaque UM est créée dans une transaction distincte en legacy (pas d'atomicité globale) ; cible : toutes les écritures d'une opération de colisage dans une transaction unique (CLAUDE.md §6). Flag `IsBusV3` + atelier bus : mock (`PreparationBusMockRepository`), non analysé.
- Effet / message d'erreur : UM créée à 1, répartitions `→ 1` (RG-COO-262 pour le filtre de statut d'origine).
- Sources : legacy `PreparationRepository.cs:190-303,309-330`, `p_u_DateAffMinUM.sql:19-41` (ancien ID provisoire RG-RPR-012) ; spec `specs-existant-process.md §D` (EX-EXI-041)
- Questions liées : Q-271
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-262 — Statuts d'origine admis pour l'entrée d'une répartition dans une UM
- Origine : MODIFIÉE
- Énoncé : legacy : `InsertUM` met `rpc_statut = 1` sur les répartitions de la sélection sans contrôler le statut d'origine : une répartition en 3 (Erreur) ou 4 (Annulé) devient 1 si elle figure dans la sélection (le filtre éventuel est dans l'écran / `p_s_*`, non lu). Cible : table de transitions explicite : seules les répartitions au statut 0 (« A traiter » / à libérer puis libérée) entrent dans une UM ; les répartitions 3 et 4 sont refusées (409), et une répartition déjà dans une UM (statut 1) n'est réaffectée que par « Retirer » (RG-COO-249).
- Déclencheur : création d'UM.
- Conditions : HYPOTHÈSE (Q-271) : écart legacy corrigé conformément à CLAUDE.md §6 (toute transition non listée = 409).
- Effet / message d'erreur : 409 « transition interdite » (`regle` = RG-COO-262) pour les répartitions 3, 4, 6, 7, 8 ; seule la transition 0 → 1 est acceptée.
- Sources : legacy `PreparationRepository.cs:190-303` (ancien ID provisoire RG-RPR-012, tableau §7.1 de legacy-repartition-production.md) ; CLAUDE.md §6
- Questions liées : Q-271
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-263 — Poids d'une UM / d'un colis : minimum 1 kg, +3 kg pour les ateliers 7 et 8
- Origine : CONSERVÉE
- Énoncé : poids du colis = Σ (`uc_qte` × `sup_poids`) des UM du colis ; sans UM, Σ (nombre de faces de train × `sup_poids`) ; si nul, poids du support 0 ; minimum forcé à 1,0 kg (« pour Calberson ») ; ajout de 3,0 kg si `ate_id IN (7, 8)`. Le poids est recalculé depuis zéro (pas de cumul du +3 kg).
- Déclencheur : ajout ou retrait d'UM ; création de colis.
- Conditions : valeurs en dur (ateliers 7 et 8 = 8 m², transporteur Calberson) ; en cible le transporteur est unique (Geodis, ECR-ADM-06) : applicabilité du minimum 1 kg à confirmer.
- Effet / message d'erreur : poids du colis mis à jour.
- Sources : legacy `p_u_poidsColis.sql:18-61` (ancien ID provisoire RG-RPR-022) ; écran `ECR-ADM-06`
- Questions liées : Q-271
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-264 — Fractionnement d'une UM sur plusieurs colis (`uc_qte`)
- Origine : CONSERVÉE
- Énoncé : `tf_UM_colis` (clé UM_id + colis_id, `uc_qte` = quantité de l'UM dans le colis, `UM_qte` = quantité totale) permet le fractionnement d'une UM sur plusieurs colis ; la quantité « préparée » est `uc_qte`, « à préparer » `UM_qte` ; la recherche par code renvoie `ISNULL(uc_qte, UM_qte)`. Legacy : aucune contrainte vérifiant que Σ `uc_qte` ≤ `UM_qte`.
- Déclencheur : ajout d'une UM à un colis ; mise à jour de `uc_qte`.
- Conditions : contrainte Σ `uc_qte` ≤ `UM_qte` non établie (non spécifiée, Q-272).
- Effet / message d'erreur : ligne `tf_UM_colis` créée / mise à jour.
- Sources : legacy `tf_UM_colis.sql:1-11`, `PreparationColisageService.cs:128-135`, `p_s_UM_from_code.sql:39`, `PreparationColisageRepository.cs:356-383` (ancien ID provisoire RG-RPR-023)
- Questions liées : Q-272
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-265 — Rattachement d'une UM à un colis : statuts 1 ou 6, même destinataire
- Origine : MODIFIÉE
- Énoncé : l'ajout d'une UM par code barre (détail ou synthèse) filtre les UM aux statuts 1 (En cours) ou 6 (Préparé) ; le destinataire de l'UM doit être celui du colis (version `PreparationColisBll` : et même atelier) ; une UM déjà dans le colis n'est pas ajoutée. À l'ajout : ligne `tf_UM_colis`, UM → 6, poids du colis recalculé. Messages : « L'UM n'existe pas ou n'est pas en cours ou préparée » ; « Le destinataire de l'UM ne correspond pas à celle du colis » ; « L'UM à ajouter existe déjà dans le colis » ; « Le destinataire des UMs est différent de celui du colis ! ». Une UM Préparée déjà dans un autre colis peut être ajoutée à un second colis. MODIFIÉE : en cible (module EXP) le scan refuse une unité qui n'est pas « Produit » (« … n'est pas « Produit » (statut : …) »), un code inconnu (« Code inconnu : X »), et un destinataire différent (contrôle bloquant) ; la divergence entre les deux implémentations legacy est à unifier.
- Déclencheur : saisie / scan d'une UM sur l'écran Colisage / Préparation colis.
- Conditions : voir Énoncé ; droit `train_preparation` / production selon l'écran (non vérifié côté serveur en legacy).
- Effet / message d'erreur : UM `1|6 → 6` ; 422 avec les messages ci-dessus.
- Sources : legacy `PreparationColisageService.cs:76-148`, `PreparationColisBll.cs:270-324`, `PreparationColisRepository.cs:311-334`, `p_s_UM_from_code.sql` (ancien ID provisoire RG-RPR-016) ; écran `ECR-EXP-01`
- Questions liées : Q-272
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-266 — Création, ouverture et suppression d'un colis
- Origine : MODIFIÉE
- Énoncé : un colis est créé au statut 1 (En cours) avec format « À définir » (5) ; `p_u_detail_colis` fixe l'adresse principale (`adr_principale = '1'`), le code colis `C-` + `colis_id` sur 18 chiffres et le transporteur / tarif (`tr_ate_dest_trans` pour destinataire + atelier). Un colis ne se supprime que s'il ne contient plus d'UM. « Ouvrir » un colis : `PreparationColisageService.OpenColis` met le colis ET toutes ses UM à 1 ; `PreparationColisBll.OuvrirColis` met le colis à 1, vide `colis_dat_expe` et remet les UM à 6 (deux comportements) ; `OpenColis` peut rouvrir un colis déjà Terminé (8) sans contrôle. MODIFIÉE : en cible (maquette EXP-01) un colis clos ne se rouvre pas (décision du 16/10) et le besoin de ré-ouverture (EX-EXP-506) est classé « Refusé » dans la synthèse.
- Déclencheur : écrans Colisage / Colis ; scan du code colis.
- Conditions : suppression : colis vide ; ouverture : voir Q-272.
- Effet / message d'erreur : colis `∅ → 1` ; `7|8 → 1` (ouverture legacy) ; UM `7|8 → 1` ou `→ 6` selon l'écran.
- Sources : legacy `PreparationColisageService.cs:35-54,227-238,329-345`, `PreparationColisBll.cs:139-158`, `p_u_detail_colis.sql:17-41`, `p_u_statut_colis_UM.sql:22-42` (ancien ID provisoire RG-RPR-017) ; spec `specs-ateliers-besoins.md PARTIE 7` (EX-EXP-506), `specs-existant-process.md §G` (EX-EXI-085) ; écran `ECR-EXP-01`
- Questions liées : Q-272
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-267 — Retrait d'une UM d'un colis : retour de l'UM à « En cours » si elle n'est plus dans aucun colis
- Origine : CONSERVÉE
- Énoncé : le retrait supprime la ligne `tf_UM_colis` ; si l'UM n'est plus dans aucun colis non expédié, l'UM repasse à 1 (En cours) ; le poids du colis est recalculé (RG-COO-263). La recherche des colis d'une UM renvoie une liste vide si TOUS ses colis sont au statut 7 (expédié). La sélection multiple pour retirer d'un coup tous les trains / UM d'un colis est demandée (aujourd'hui code par code).
- Déclencheur : retrait d'une UM / d'un train d'un colis (Préparation de train › Préparer).
- Conditions : colis non expédié ; première surcharge `DestroyPrepaUmColis(int umId, …)` : l'objet porte `Colis_statut` au lieu de `RpcStatut`, la valeur écrite pourrait être la valeur par défaut (INCERTAIN). Le statut du `tf_repart_calcul` n'est pas rétabli.
- Effet / message d'erreur : UM `6 → 1` ; poids recalculé.
- Sources : legacy `PreparationColisageService.cs:240-322`, `PreparationColisBll.cs:327-371`, `PreparationRepository.cs:409,418` (ancien ID provisoire RG-RPR-018) ; spec `specs-ateliers-besoins.md PARTIE 7` (EX-EXP-503)
- Questions liées : Q-272, Q-273
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-268 — Expédition d'un colis : colis, UM (ateliers 1 à 4) ou trains → « A expédier »
- Origine : CONSERVÉE
- Énoncé : « Expédier » enregistre transporteur / tarif (`tsp_id_tarif_code`), code externe, commentaire, poids, format, `colis_dat_expe = now` et met le colis à 7. Si l'atelier du colis est 1 à 4 : toutes les UM du colis → 7 ; sinon les `tf_face_train` du colis → 7. En « re-saisie » (colis déjà à 7) seul le code externe est mis à jour. Un code externe « ETIQUETTES » est remis à NULL. Si le transporteur vaut 2 (Calberson en dur) et que le statut avant action est 1, génération d'un fichier BL ; pour `tsp_id = 2` l'écran reste ouvert pour saisir le code externe. Défaut legacy : la clause « NOT EXISTS colis non expédié » de `p_u_expedie_Colis` compare le colis à lui-même ; une UM répartie sur deux colis passe donc à 7 dès l'expédition du premier (contraire au commentaire).
- Déclencheur : écran Expédition colis (module EXP, étape 8).
- Conditions : ateliers 1 à 4 = UM sinon trains (valeurs en dur) ; profils non contrôlés en legacy.
- Effet / message d'erreur : colis `1 → 7` ; UM `1|6 → 7` ; faces `* → 7` ; message « Problème lors de l'expédition » si ≠ 1 ligne. Cible : une UM n'est « A expédier » que lorsque tous ses colis sont expédiés (HYPOTHÈSE, Q-272).
- Sources : legacy `PreparationColisBll.cs:497-560`, `PreparationColisRepository.cs:482-569`, `p_u_expedie_Colis.sql:34-73`, `PreparationColisageService.cs:211-220` (ancien ID provisoire RG-RPR-019) ; écran `ECR-EXP-02`
- Questions liées : Q-272, Q-284
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-269 — Fin de journée : colis « A expédier » → « Terminé » (batch ou unitaire)
- Origine : MODIFIÉE
- Énoncé : `p_batch_fin_journee_colis` passe à 8 les UM des colis à 7 (quel que soit leur statut courant), les `tf_face_train` des colis à 7, puis les colis à 7, sans condition de date ni d'atelier (pas de transaction : un échec intermédiaire laisse UM / trains à 8 et colis à 7). Une action unitaire `SetFinDeJournee` met colis + UM à 8 (sans toucher aux trains), message « Le colis expédié ». MODIFIÉE : en cible « Fin de journée Geodis » passe les colis clos du périmètre à EXPEDIE (récépissé), les unités à EXPEDIE et génère les sorties de stock automatiques ; « Livré » est posé à la réception de la preuve de livraison (H9) ; libellé « Terminé » (8) remplacé par « Expédié » puis « Livré ».
- Déclencheur : batch de fin de journée (planification inconnue) / bouton ; cible : manuel (« qui déclenche ? » ouverte).
- Conditions : colis au statut 7 (A expédier) ; en cible transaction unique.
- Effet / message d'erreur : colis `7 → 8` ; UM `* → 8` ; faces `→ 8` ; sorties de stock : RG-X-087.
- Sources : legacy `p_batch_fin_journee_colis.sql:23-67`, `PreparationExpeditionService.cs:267-276`, `ListeColisBll.cs:199-223` (anciens ID provisoires RG-RPR-020, RG-INT-030) ; écran `ECR-EXP-02` ; spec `specs-existant-process.md §F` (EX-EXI-072)
- Questions liées : Q-272, Q-281
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-270 — Train ajouté à un colis : face à « A expédier » immédiatement
- Origine : CONSERVÉE
- Énoncé : l'ajout d'un train (face) à un colis fixe immédiatement `tf_face_train.rpc_statut = 7` et `colis_id` ; un train déjà rattaché à un colis est refusé (« Il existe déjà un train dans ce colis ») ; le destinataire doit correspondre (« Le destinataire du train ne correspond pas à celui du colis », atelier aussi côté `PreparationColisTrainBll`). Retirer le train : `UpdateFaceTrains` (valeurs non lues). Aucun contrôle du statut d'origine : une face 5, 9 ou 10 passe à 7.
- Déclencheur : Préparation de train › Préparer (module EXP).
- Conditions : destinataire (et atelier) identiques ; en cible la face doit être PRODUIT (HYPOTHÈSE).
- Effet / message d'erreur : face `5|9|10 → 7` ; 422 avec les messages ci-dessus.
- Sources : legacy `PreparationColisageService.cs:154-209`, `PreparationColisTrainBll.cs:160` (ancien ID provisoire RG-RPR-021) ; spec `specs-ateliers-besoins.md PARTIE 7` (EX-EXP-501, EX-EXP-503)
- Questions liées : Q-272, Q-273
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-271 — Mail « Un colis d'affiches vient de vous être expédié » (batch)
- Origine : CONSERVÉE
- Énoncé : le batch sélectionne les colis `rpc_statut = 8`, `Mailcolis_envoye = 0` et `colis_dat_expe > Parametre_Package.DateMaj` (`SendMailColis`) ; mail interne (un par manager CCF) ou externe (un par couple tiers / manager, CC manager), sujet fixe, corps HTML (N° colis, quantités trains / rouleaux, affiches), pièce jointe `DetailsColis_<jj_MM_aaaa>.xls` à deux feuilles (« Fixe » 7 colonnes, « Scrolling » 23 colonnes). Seuls les colis dont le mail est parti sont marqués envoyés ; `DateMaj = now` est cependant posée même si certains envois ont échoué (un colis en échec n'est plus resélectionné). Cible : les alertes remplacent les mails ; ce mail « colis expédié » n'est pas cité dans les decks.
- Déclencheur : batch `BatchEnvoieMailColis` (planification inconnue).
- Conditions : applicabilité à confirmer (EX-TRA-030) ; correction de la perte de retentative si conservé.
- Effet / message d'erreur : `Mailcolis_envoye` null/0 → 1.
- Sources : legacy `P_GetGlobalColisForSend.sql:3-56`, `BatchEnvoieMailColisBll.cs:33-267`, `P_MajParametre_Package.sql:1-7` (anciens ID provisoires RG-INT-033, RG-INT-034, RG-INT-035) ; spec `specs-transverse.md §E` (EX-TRA-030) ; écran `ECR-ADM-04` (« Mails existants dans le code »)
- Questions liées : Q-285
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-272 — Intégration AMT : une répartition déjà active n'est pas réintégrée
- Origine : CONSERVÉE
- Énoncé : si une ligne de log AMT (`tw_amt_log_repart`) porte un `rpfo_ident` déjà présent dans `tf_repart_calcul` avec un statut ≠ 4, la ligne de log est supprimée (ignorée) et « Doublon envoie : <rpfo> » est écrit dans `tt_log`. Le statut 4 (Annulé) est le seul qui libère le `rpfo_ident` (une répartition annulée peut être réintégrée en nouvelle ligne).
- Déclencheur : batch d'intégration (phase 2), `p_integ_ptf_reparts`.
- Conditions : `rc.rpc_rpfo_ident = r.rpfo_ident AND rc.rpc_statut <> 4` ; le test `exists` non corrélé fait supprimer tous les doublons dès qu'un seul existe (sans impact fonctionnel). Applicabilité du flux AMT : Q-274.
- Effet / message d'erreur : suppression des lignes de log ; aucune alerte utilisateur.
- Sources : legacy `p_integ_ptf_reparts.sql:72-90` (ancien ID provisoire RG-RPR-001)
- Questions liées : Q-274
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-273 — Intégration AMT : transcodage du type de préparation et regroupement par afficheur
- Origine : CONSERVÉE
- Énoncé : `tyaf_code` AMT est remplacé par le `tpr_id` logistique via `tr_typ_aff_amt` ; les lignes de log en mode `talr_trait = 'B'` sont regroupées (SUM de `rpty_qte_affich`) par répartition / destination / réaction / type / date / semaine / société / secteur / affiche / annonceur / contrat / afficheur ; seul ce regroupement (`talr_trait = '1'`) alimente `tf_repart_calcul`. `rpc_qte` = quantité cumulée ; `rpc_type = 0` ; `rpc_user = 'user_ptf'` ; `sem_num` = semaine ISO de `rpli_datdep` et `sem_annee` = année de base AMT (`rpli_anbas`, pas l'année ISO de la date de départ) ; `rpc_theme` tronqué à 50 caractères.
- Déclencheur : batch `p_integ_ptf_reparts`.
- Conditions : jointure `tr_atelier.ate_code_amt = sect_code` (une ligne sans atelier correspondant n'est pas traitée) ; incohérence potentielle `sem_num` ISO / `sem_annee` « anbas » en fin d'année (INCERTAIN ; spec cible : semaines ISO partout, EX-COO-038).
- Effet / message d'erreur : création en statut 0 (ou 3, RG-COO-274).
- Sources : legacy `p_integ_ptf_reparts.sql:167-236,240-253,351-401` (ancien ID provisoire RG-RPR-002) ; spec `specs-coordination.md §E` (EX-COO-038)
- Questions liées : Q-274
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-274 — Intégration AMT : contrôles d'anomalie 903 / 905 / 906 / 907 et lignes en erreur « E »
- Origine : CONSERVÉE
- Énoncé : chaque ligne est contrôlée : destinataire inconnu (anomalie 903), support inconnu (905), type de préparation inconnu (906), atelier inconnu (907). 905 / 906 / 907 forcent la valeur à 0 et le statut à 3 (Erreur) ; 903 crée une anomalie mais ne change pas le statut. Les anomalies sont insérées dans `tf_anomalies` (`ano_user = 'user_ptf'`, sans doublon par `rpc_id` / `tan_id`). Si l'atelier est inconnu (907), la répartition n'est PAS insérée mais les anomalies sont rattachées à `@rpc_id` (valeur du tour précédent / NULL : comportement non maîtrisé). Sans destinataire, `dest_id` est NULL et la ligne est insérée au statut 0. Si l'insertion échoue (`@error <> 0` ou `@rpc_id = 0`), la ligne de log passe à `talr_trait = 'E'` ; sinon les lignes `'B'` passent à `'T'`.
- Déclencheur : batch `p_integ_ptf_reparts`.
- Conditions : voir Énoncé.
- Effet / message d'erreur : statuts 0 → 3 (905, 906, 907) ; rattachement incorrect des anomalies 907 à ne pas reproduire.
- Sources : legacy `p_integ_ptf_reparts.sql:269-347,403-473,488-499` (anciens ID provisoires RG-RPR-003, RG-RPR-004)
- Questions liées : Q-274
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-275 — Purge des tables de travail AMT et correction `UM_qte = 0`
- Origine : CONSERVÉE
- Énoncé : `p_integ_ptf_purge` supprime TOUTES les lignes de `tw_amt_log_repart`, `tw_amt_log_destination`, `tra_amt_log_instruction`, `tra_amt_log_instruc_det`, `tra_amt_log_statut_repart`, `tra_amt_log_train` (plus seulement les lignes `'T'`, correctif IT 34650 du 29/03/2016) puis force `tf_UM.UM_qte = 1` là où `UM_qte = 0`, y compris pour des UM déjà expédiées (modification silencieuse). `p_valid_amt_reparts` archive dans `th_amt_log_repart` (côté AMT par serveur lié, côté PTF avec transaction) les lignes `talr_trait = 1` puis les supprime ; usage actuel inconnu.
- Déclencheur : batch `p_integ_ptf_purge` / `p_valid_amt_reparts`.
- Conditions : la correction `UM_qte = 0 → 1` est un effet de bord indésirable à ne pas reproduire sans décision (Q-271) ; applicabilité Q-274.
- Effet / message d'erreur : tables vidées ; aucune alerte.
- Sources : legacy `p_integ_ptf_purge.sql:14-31`, `p_valid_amt_reparts.sql:28-95,102-223` (anciens ID provisoires RG-RPR-005, RG-RPR-007)
- Questions liées : Q-271, Q-274
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-276 — Intégration des statuts de répartition AMT : désactivée
- Origine : CONSERVÉE
- Énoncé : `p_integ_ptf_statut_repart` retourne immédiatement (`return 0`, « SJA => on ne fait plus ») ; le mapping `instruction_train.tsr_repart_code` 1 / 2 / 3 (En cours / Plateforme / Commerce) est du code mort. `tr_statut_repart` n'est plus alimentée par ce flux ; la propriété `StatutRepart` est encore lue par `PreparationRepository.cs:1015` et `PreparationDeroulantsRepository.cs:658`. Aucune spec de la cible ne reprend ce mécanisme.
- Déclencheur : aucun (désactivé).
- Conditions : ne pas reprendre sans décision (Q-274).
- Effet / message d'erreur : aucun.
- Sources : legacy `p_integ_ptf_statut_repart.sql:30-31` (code mort 47-141) (ancien ID provisoire RG-RPR-006) ; bdd.md §4.2
- Questions liées : Q-274
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-277 — Déblocage de répartition : une UM au statut ≥ 6 empêche le déblocage
- Origine : CONSERVÉE
- Énoncé : la liste des préparations « empêchant le déblocage » est celle des `tf_UM` liées (via `tf_repart_calcul.UM_id`) au `rpfo_ident` avec `rpc_statut >= 6` (Préparé, A expédier, Terminé et au-delà). Les répartitions sans UM (statuts 0, 1, 3 sans `UM_id`) ne sont jamais bloquantes ; le statut du `tf_repart_calcul` lui-même n'est pas testé. La liste (plateforme, atelier, code barre UM, contrat, thème, statut) sert de message de refus. Cette règle complète le contrôle de déblocage de préparation de coo1 (RG-COO-083 legacy).
- Déclencheur : contrôle avant déblocage (`ControleRepartitionsDeblocables`).
- Conditions : `tf_UM.rpc_statut >= 6` et `tf_repart_calcul.rpc_rpfo_ident = @rpfo_ident` ; le contrôle serveur est en plus à exiger côté service (le legacy ne contrôle que les UM pour un groupe UM et rien pour un groupe TRAIN).
- Effet / message d'erreur : refus 422 « Le groupe de preparation n'est pas déblocable ! » (message du legacy) avec la liste des UM bloquantes.
- Sources : legacy `p_s_controle_rendumain.sql:15-21`, `RepartitionRepository.cs:138-153`, `RepartitionService.cs:55-60` (ancien ID provisoire RG-RPR-008)
- Questions liées : Q-275
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-278 — Déblocage de répartition : annulation des répartitions et des UM, colis non touchés
- Origine : CONSERVÉE
- Énoncé : `p_u_statut_repart_deblocage` passe à 4 (Annulé) les `tf_repart_calcul` du couple (`rpc_repartition`, `rpc_rpfo_ident`) dont le statut ≠ 4, puis les `tf_UM` associées (statut ≠ 4), avec date et utilisateur fournis par l'appelant (uniformité Broadcast / Circé, US 401). Les lignes `tf_UM_colis` et `tf_colis` sont conservées : un colis contenant des UM annulées garde son statut (l'annulation des colis est commentée). `p_i_th_repart_annule` historise dans `th_repart_annule`. Transaction propre à la procédure ; l'utilisateur passé est « » côté C# (écrit vide). Cible : l'utilisateur est tracé ; le devenir des colis contenant des UM annulées est à décider.
- Déclencheur : action « Débloquer ».
- Conditions : après le contrôle de RG-COO-277.
- Effet / message d'erreur : répartitions `* → 4` ; UM `* → 4` (y compris 0, 1, 3, 5) ; colis inchangés ; historique.
- Sources : legacy `p_u_statut_repart_deblocage.sql:34-73`, `RepartitionRepository.cs:121-136` (ancien ID provisoire RG-RPR-009) ; legacy `AdminPreparationDeblocageBll.cs:252-333` (RG-COO-084, coo1)
- Questions liées : Q-275
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-279 — Ancien déblocage AMT puis Circé : non atomique, retour 0 indifférencié
- Origine : CONSERVÉE
- Énoncé : `DebloquerRepartitions` appelle d'abord Sybase (`p_urpfo01`, `rpfo_valid = 0`) puis Circé ; le résultat n'est retenu que si les deux compteurs sont égaux, sinon retour 0. Si Sybase échoue (exception), le compteur AMT vaut 0 mais le déblocage Circé a lieu quand même ; le retour 0 est alors indifférencié d'un refus ; l'exception n'est journalisée que dans Elmah. Les états AMT et Circé peuvent diverger. L'écran « Répartitions déblocables » (droits `debloque_repart` / `view_repart`) débloque aussi les lignes non cochées et envoie un mail aux logisticiens ; le menu actif ne pointe plus vers cet écran (probablement mort).
- Déclencheur : ancien écran Répartitions (`view_repart`).
- Conditions : applicabilité à confirmer (Q-274, Q-275) ; ne pas reproduire le défaut des lignes non cochées.
- Effet / message d'erreur : annulation de répartitions côté AMT et Circé.
- Sources : legacy `RepartitionService.cs:35-53`, `RepartitionRepository.cs:87-136`, `RepartitionController.cs:218-351` (anciens ID provisoires RG-RPR-010, RG-COO-085)
- Questions liées : Q-274, Q-275
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-280 — Le statut de l'UM prime sur celui de la répartition dans le suivi
- Origine : CONSERVÉE
- Énoncé : après la création de l'UM, l'évolution (7, 8) ne touche que `tf_UM` / `tf_colis`, pas `tf_repart_calcul` ; le suivi de production lit le statut de `tf_UM` s'il existe (`rc.UM_id` renseigné), sinon celui de `tf_repart_calcul`. Conséquence : `tf_repart_calcul.rpc_statut` reste à 1 ou 6 pour des UM terminées ; toute règle lisant ce statut (filtre `rpc_statut <> 4` des attendues, RG-COO-042 legacy) ne voit jamais 7 / 8. La propagation éventuelle par `MiseAJourStatutUm` n'a pas été lue.
- Déclencheur : lecture du suivi de production / de l'état des lignes.
- Conditions : le statut « effectif » = statut de l'UM si UM_id non nul. La cible doit choisir entre propagation des statuts et calcul du statut effectif (Q-273).
- Effet / message d'erreur : lecture seule.
- Sources : legacy `p_s_adminSuiviRead.sql:70-79`, `PreparationRepository.cs:393-429,435-470` (ancien ID provisoire RG-RPR-015)
- Questions liées : Q-273
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
