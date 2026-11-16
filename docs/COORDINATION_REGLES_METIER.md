# Règles métier — COORDINATION

Légende origine : CONSERVÉE (legacy = cible) · MODIFIÉE (spec change le legacy) · NOUVELLE (spec seule) · SUPPRIMÉE (spec la retire explicitement)

Conventions : IDs définitifs RG-COO-001…199 (bloc 1 : validation admin, Instruction OK, réceptions attendues, alertes, déblocage, droits, alimentation) et 200…399 (bloc 2 : trains, export, préparation, suivi 8 m², dispatch, bagues, répartition, UM/colis) ; numérotation avec trous. Anciens IDs provisoires = ceux de `docs/_travail/legacy-*.md`. EX issus des ateliers : ID des notes **+500** (cf. Q-350). Rôles provisoires : Q-003.

## 1. Entités et données
### Bloc 1 — dossiers, validation admin, instruction, réceptions attendues
Abréviations de chemins legacy utilisées dans les sources des règles de ce bloc (racine `circe-develop/`) : `BLL/` = `ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.BLL/` · `REP/` = `…/ClearChannel.CIRCE.Repositories/` · `WEB/` = `…/ClearChannel.CIRCE/` (Controllers/, Views/) · `SQL/` = `BDD/DATABASE/DATABASE/dbo/Stored Procedures/` (ou `Functions/`) · `BATCH/` = `ClearChannel.CIRCE.root/ClearChannel.CIRCE/ClearChannel.CIRCE.BatchAlimPexCirce*`. Sigles des specs : [PC] process_coordination_statuts_actions · [PP] process_preprod_avant_apres · [RA] receptions_attendues_doublons_tables_regles · [DC] dossier complet Réception · [README]/[DESIGN] maquette. Les noms de tables/colonnes marqués (V2) sont des PROPOSITIONS issues des specs ([RA] §4, [PP] §7), à figer à l'étape 3 (Q-004).

| Entité | Champs clés | Obligatoire / conditionnel | Source |
|---|---|---|---|
| Ligne attendue (`tf_prepa_affiche`, « réception attendue ») | `plt_id` (plateforme, par `IdSiteCCF`), `sup_id` (support : `IdSurface` × `IdFormat`), `cont_num` (n° de dossier), `rpc_theme` + `IdTheme` (V2, Q-208), `IdThemeBandeau`/`repiquage` (bandeau), `sem_num`/`sem_annee` (semaine ISO), `Qte_Theorique`, (V2) `source` BC/PREPA, `etat_ligne` ACTIVE/ANNULEE, `qte_bc`, `qte_prepa`, `date_vue_bc`, `rpc_num_aff_amt`, `IdDAChapeau`, `ate_id`, `Statut` | Clé active unique : plateforme × dossier × support × thème × bandeau × semaine (index unique, RG-COO-080) ; DA et atelier hors clé (Q-207) ; `IdTheme` conditionnel (Q-208) ; une ligne n'est jamais supprimée | bdd.md §2.3 ; [RA] §4-5 ; legacy `SQL/p_Alimentation_tf_prepa_affiche.sql` ; RG-COO-080 à 099 |
| Lien affiche ↔ ligne attendue (V2 `asso_affiche_visuel`) | `affiche_id`, `ligne_attendue_id`, `quantite`, `actif`, `cree_par/cree_le`, `retire_par/retire_le`, `mode_rattachement` (BL / VISUEL / MAIN) | Plusieurs-à-plusieurs avec quantité ; un lien retiré est conservé inactif (jamais perdu) ; legacy : 1 affiche par ligne sans quantité (`affiche_livraison_Id`) | [RA] §4, RG-AT-08 ; bdd.md §7.5 ; legacy RG-COO-020/022/023 ; RG-COO-088 |
| Rapprochement proposé (V2 `tf_edr_rapprochement`) | `ligne_source_id`, `ligne_cible_id`, `affiche_id`, `etat` (proposé / confirmé / refusé), `motifs` | Déplacements d'affiche proposés au passage provisoire → thèmes (RG-AT-04) ; n'existe pas aujourd'hui | [RA] §4 ; bdd.md §7.5 ; RG-COO-085 |
| Validation admin d'une affiche (portée par `affiche`) | `validationAdmin` (bool legacy), (V2) `validationAdmin_par`, `validationAdmin_le`, `mode_rattachement`, état calculé `ORPHELINE / PROPOSEE / A_FAIRE (doute) / MANUELLE (validée) / ANNULEE`, `motifs[]` (BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE) | `par` et `le` obligatoires dès que validée ; motifs calculés (jamais saisis) ; l'état est calculé, la seule donnée persistée est le triplet (validée, par, le) + historique | [PP] §5 ; [RA] §4, RG-VA-04 ; maquette `data.js` (`C.vaEtat`, `M.VA_MOTIFS`) ; bdd.md §7.5 ; RG-COO-007, 015 |
| Dossier (pré-production) | `cont_num`, `DA chapeau`, annonceur, atelier(s)/plateforme(s), semaines de départ, pôle (Direct / Intermédié), `statut_preparation` (A_TRAITER / PREPARATION_RECUE / ANNULE), `date_preparation`, `ip_saisies` (bool), `commentaire_prepa`, `qte_bc`, `qte_circe`, `campagne_controlee`, `entretien_pct`, `demande_correction_bc{date,user,note}` | Statut de préparation posé par Circé à l'arrivée de la prépa ; pastille « validation admin » du dossier calculée (jamais saisie) | [PC] p.1 ; maquette `data.js` (Dossier) ; RG-COO-019, 040, 063 |
| Instruction (déroulant ; `instruction_train`) | `instr_code` (AAAA + SS + `C0` + atelier(2) + dossier(8)), `cont_num`, semaine, `ate_id`, `rpc_statut` (0 A traiter, 1 En cours, 2 Instruction ok, 3 Erreur (legacy), 4 Annulé, 5 A imprimer = « Prêt à produire »), `mode_instruction_ok` (AUTO / MANUEL), `iok_par`, `iok_le`, `instr_entretien` (%, défaut 8), `tip_ins_code` (position : 0 standard, 1 début, 2 fin, 3 fin-1, 4 milieu), `instr_commentaire` (commentaire de prépa, `instr_CommentExtPlay`), `Conservation`, `CoteCote`, `version` (V2, verrou optimiste) | Grain legacy dossier × semaine × atelier (Q-206) ; `iok_par/iok_le` obligatoires quand statut 2 posé à la main ; commentaire optionnel | bdd.md §3 ; legacy RG-COO-046/047 ; [PC] p.1 ; RG-COO-040 à 064 |
| Détail d'instruction / visuels (`instruction_detail`, `instruction_visuels`) | `instr_code`, `tpr_id`, thème, `theme_id`, `repiquage`, quantité, `insv_pourcentage`(+`_ori`), position A-D, traitement (À produire / Ne pas afficher / Reste en place) | Σ pourcentages = 100 % par (dimension, type de préparation) pour passer en Instruction OK | bdd.md §3 ; legacy RG-COO-063, 066 ; RG-COO-043 |
| Copie de l'état des réservations Broadcast (`tf_prepa_Broadcast`) | `cont_num`, `IdDAChapeau`, `IdSiteCCF`, `IdSurface`, `IdFormat`, `sup_id`, `IdTypePreparation`, `IdPreparationChapeau`, `IdTheme` (demandé, Q-208), `IdThemeBandeau`, `EstResteEnPlace`, `StatutPreparation`, destinataire effectif, semaine/année, quantité, `date_vue`, assistants commercial/logistique | `date_vue` renseignée à chaque lecture ; lignes plus vues → ligne attendue ANNULEE ; colonnes aujourd'hui jetées à conserver (V2) | [RA] §4 ; bdd.md §2.3, §7.5 ; RG-COO-091, 092 |
| Demande de correction à Broadcast | `dossier_id`, `theme_id`/`annonceur`, `date`, `user`, `note`, `destinataires`, état (ENVOYEE / FAITE) | Un mail par pôle ; l'état du dossier ne change pas ; renvoi autorisé (« Le mail sera renvoyé ») | ECR-COO-04 ; ECR-THM-01 ; RG-COO-051, 070 |
| Alerte de coordination | `type`, `cle` (déterministe), `gravite` (critical / serious / warning / info), `site`, `semaine`, `date`, `titre`, `message`, `lien{ecran,params}`, `roles[]`, `etat` (ouverte / acquittée), `acquittee_par/_le` | Clé stable par objet (dédoublonnage) ; seuils et destinataires issus du paramétrage (Q-220) | ECR-TRA-01 ; [PC] p.2 ; RG-COO-033, 066 à 076 |
| Règle d'alerte / liste de distribution | `type_alerte`, déclencheur, seuil, gravité, destinataires (rôles), canal (bandeau / bandeau+mail / digest 7 h / désactivée), liste (ex. « Rajouts après préparation – Nîmes ») | Géré dans Administration › Paramétrage › Alertes et mails (autre module) | ECR-ADM-04 ; EX-TRA-029 ; EX-ADM-504 |
| Groupe de préparation Broadcast / déblocage | `IdGroupePreparation`, `IdPreparationChapeau`, `IdDossierDeVenteChapeau`, site CCF, statut Broadcast (133 envoyé → intégré → débloqué), `InstructionType` (UM / TRAIN), `StatutPrepa` (None / En cours), trace `th_repart_annule` (qui, quand, motif) | Recherche : n° de préparation OU n° de dossier obligatoire | legacy RG-COO-080 à 086 ; bdd.md §5 ; RG-COO-140 à 148 |
| Règles d'inclusion / exclusion de déblocage (`tr_atelier_droit_prepa`) | `ate_id`, `tpr_id` (famille de type de préparation, nul = tous), `IdSurface` (nul = toutes), nature (inclusion / exclusion) | UNIQUE ; un atelier sans règle ne débloque rien | bdd.md §6 ; legacy RG-COO-081 ; `circe-develop/docs/regles-inclusion-exclusion-deblocage.md:53-85` |
| Journal de chargement des flux (`FluxChargement`, `tt_log`) | `IdInterface`, `NomFlux`, début, fin, statut (1 en cours / 0 OK / 2 échec), message | Un enregistrement par flux et par passage | legacy RG-INT-001/002/008 ; RG-COO-115 à 117 |
| Historique d'entité (`histo_historique_entite`) | `IdActionApplicative` (ModificationValidationAdmin, AfficheAssocier, AfficheDissocier, ChangementStatutInstruction, ModificationInstructionPlus, ExporterTrains, DebloquerPreparation…), `IdTypeEntite` (1 Affiche, 2 Instruction, 3 Trains, 4 IdDossier), `IdEntite`, ancienne/nouvelle valeur, `QuiAction` (nom de la personne), `DateAction` | Obligatoire à chaque changement de statut / de rattachement / de validation ; jamais « validée par Circé » | bdd.md §5 ; legacy RG-INT-046 ; EX-TRA-036 ; RG-COO-160 |
| Droit utilisateur / périmètre | `tr_utilisateur_menu` (27 droits), `tr_utilisateur_data` (login × plateforme × atelier) ; V2 : rôle (`coord`, `cheq`, `recep`, `expe`, `admin`, `com`) + périmètre site/atelier | Rôles provisoires (Q-003) ; contrôle côté service | legacy-admin.md §B ; RG-COO-165 à 168 |

### Bloc 2 — trains, préparation, répartition, UM, colis
Périmètre bloc 2 (agent coo2) : trains, préparation, unités de production, répartition, UM / colis (interface), dispatch, bagues. Les entités de validation admin, instruction, réceptions attendues et alertes sont décrites par coo1 (`coo1-1-entites.md`). Les noms de tables/colonnes sont ceux du schéma réel (bdd.md §3-§5) ; les noms de la maquette (ECR-COO-05 à 11) sont donnés entre parenthèses quand ils diffèrent.

| Entité | Champs clés | Obligatoire / conditionnel | Source |
|---|---|---|---|
| Face de train (`tf_face_train`) | `ft_id` (PK), `train_id` (AA + SS + secteur 3 + dép. 2 + commune 3 + n° emplacement 4 + n° train 1 + version 1), `instr_code`, `ate_id`, `dest_id`, `pers_ident`/`pers_nom` (afficheur), `theme`, `theme_id`, `repiquage`, `insv_id`, `ft_type` ('face'/'exception'/'entretien'), `ordre_propose`, `ordre_reel`, `ordre_calcule`, `version`, `rpc_statut`, `rouleur_id`, `colis_id`, `pre_assemblage`, `RefConvention`, `RefPanel`, `cadr_ident`, `ft_user_maj`/dates | `train_id`, `theme`, `ordre_*` renseignés au passage Instruction OK (RG-COO-200 à 202) ; `rouleur_id` obligatoire à « Au roulage » (RG-COO-217) ; `colis_id` seulement si la face est dans un colis (RG-COO-270) ; `ft_type='entretien'` si face d'entretien (RG-COO-203) | bdd.md §3 ; legacy-coordination.md RG-COO-064 à 069 ; legacy-repartition-production.md RG-RPR-021, 027 |
| Train (unité de production « TRAIN », maquette `TR-nnnn`, `TR-Pnnnn`) | identifiant, atelier, machine, destinataire, afficheur, `nb` (nombre de trains identiques), positions[1..4 ou 6] (thème, fractionnée oui/non, couverte oui/non), départ camion, statut d'unité (EN_ATTENTE, PRET, EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE), fichier (G-xxxx), bague imprimée, N° de panneau Broadcast (6 chiffres, un par train identique), `fractionne`, `pretest`, `reimpressions`, modifications tracées | Cible (maquette) : un train = regroupement de faces identiques ; le grain legacy est la face (`tf_face_train`). Persistance de l'entité « train » = Q-250 | maquette ECR-COO-05, 05a ; legacy-repartition-production.md §7.4 ; EX-EXI-073 |
| Export de train (`tf_train_export`) | un enregistrement par train, 6 contrats max (contrat, réseau, annonceur, thème, repiquage, rouleur, lettre), date, utilisateur, `idExport` | écrit à l'export (RG-COO-213) ; historique `ExporterTrains` | legacy-coordination.md RG-COO-070 ; legacy-integrations.md RG-INT-045 |
| Paramètre d'alternance « Paris » (`tr_parametre_alternance`) | références de convention incluses/exclues (`ListeRefConventions`), structures, produits, `est_actif` | lu par l'export (bloc Paris) ; valeur en dur `VPS_75 101 0004` dans `p_u_associe_train` (Q-255) | legacy-coordination.md RG-COO-071 ; legacy-repartition-production.md RG-RPR-027, 028 |
| Thème / visuel de préparation | `theme` (libellé), `repiquage`, position (A à D), `exclu` (NE_PAS_AFFICHER / RESTE_EN_PLACE), `qte`, `qteEnt` (quantité avec entretien), `d8 {haut, bas, final}` (demies 8 m²), `preassemble` (booléen), `corrPlateforme`, `annonceurImprime`, `livraisonPrevue`, `libelleBC`, `modifBC` | `exclu` renseigné par Broadcast (source = Q-263) ; `d8` seulement thèmes 8 m² ; `preassemble` initialisé à vrai si un train du thème est en production (maquette) | maquette ECR-COO-06, 08, 09c ; bdd (maquettes §4) ; EX-COO-502 |
| Ligne de répartition / de préparation (`tf_repart_calcul`) | `rpc_id` (PK), `rpc_rpfo_ident` (n° de répartition AMT), `IdPreparationDetail`, `rpc_repartition`, `UM_id`, `ate_id`, `dest_id`, `sup_id`, `tpr_id`, `rpc_qte` (quantité avec entretien), `rpc_theme` (50 car.), `rpc_repiquage`, `sem_num`/`sem_annee`, `rpc_dat_aff`, `rpc_statut`, `rpc_retire`, `numeroReception`, `rpc_user`/`rpc_dat_maj` | `rpc_qte` > 0 ; `UM_id` nul avant colisage ; `rpc_statut` 0 à l'intégration | bdd.md §3 ; legacy-repartition-production.md RG-RPR-002, 012 |
| Unité de manutention — UM (`tf_UM`, maquette `UM-nnnn`) ; lot pliage (`PL-nnnn`), lot bus (`BU-nnnn`) | `UM_id` (PK), `UM_code_barre` (AASS- + UM_id sur 13 chiffres), `UM_code_synthese` (AASSMMJJ + atelier 2 + destinataire 8), `UM_qte`, `UM_date_aff`, poids, `ate_id`, `sup_id`, `tpr_id`, `rpc_statut`, `UM_user` | une UM porte un seul thème (RG-COO-260) ; `UM_qte` ≠ 0 (RG-COO-275) | bdd.md §3 ; legacy-repartition-production.md RG-RPR-011, 012 |
| Lien UM ↔ colis (`tf_UM_colis`) | `UM_id`, `colis_id`, `uc_qte` (quantité de l'UM dans ce colis) | `uc_qte` = quantité préparée dans le colis (RG-COO-264) | bdd.md §3 ; legacy-repartition-production.md RG-RPR-023 |
| Colis (`tf_colis`, code `C-` + 18 chiffres ; maquette `C-0000000000063`) | `colis_id`, `colis_code`, `ate_id`, `dest_id`, `adr_id`, `tsp_id`/tarif, `colis_dat_expe`, poids, format, `rpc_statut`, `Mailcolis_envoye`, `ref_uni_exp` | interface seulement (module EXP, étape 8) : statuts 1, 7, 8 ; maquette : COLIS_OUVERT / COLIS_CLOS / EXPEDIE / LIVRE | bdd.md §3 ; legacy-repartition-production.md §4 ; maquette ECR-EXP-01, 02 |
| Libération de semaine (maquette `D.liberations`) | atelier, semaine de départ, date, utilisateur | une libération par (atelier, semaine) ; entité NOUVELLE (aucune table legacy) ; schéma à créer (étape 3) | maquette ECR-COO-09a ; EX-COO-025 |
| Rendu à la Pré-Prod (maquette `rendus`) | dossier(s), atelier, semaine, motif (texte, défaut « Changement de visuel demandé par le client »), unités concernées, date, utilisateur | motif facultatif/défaut ; entité NOUVELLE | maquette ECR-COO-09b |
| Rouleur / opérateur (legacy `tr_rouleur`, liste des rouleurs ; maquette `NIM-OP1`) | id, site, libellé (« Rouleur N1 »), poste (« Table 1 »), `rouleur_id` sur la face | référentiel Administration (droit `referentiel`) ; les rouleurs ne sont pas des utilisateurs (Q-276) | maquette ECR-COO-07, 10, ADM-07 ; legacy-admin.md matrice droit × page |
| Bague (maquette : `bague`, `bagueTexte[]`, `reimpressions`, `operateur`) | code-barres, n° d'unité, textes imprimés par position (annonceur, thème), indicateur modifié, rouleur, nombre de réimpressions, motif de réimpression | imprimée avant passage EN_PROD (RG-COO-299) | maquette ECR-COO-11 ; legacy-admin.md RG-ADM-060 |
| Parcours de répartition AMT (`tw_amt_log_repart`, `tw_amt_log_destination`, `tra_amt_log_*`, `th_amt_log_repart`, `tf_anomalies`, `tr_typ_aff_amt`) | `rpfo_ident`, `talr_trait` (B/1/T/E), `rpty_qte_affich`, anomalies 903/905/906/907 | flux historique AMT/Sybase, applicabilité = Q-274 | legacy-repartition-production.md §1 ; bdd.md §5, §7.3 |
| Historique d'annulation (`th_repart_annule`) | répartitions annulées/débloquées (date, utilisateur) | écrit à chaque déblocage | legacy-repartition-production.md RG-RPR-009 ; bdd.md §5 |
| Journal / historique (`histo_historique_entite`) | action (`ExporterTrains`, `ChangementStatutInstruction`, `ModificationInstructionPlus`, `DebloquerPreparation`…), type d'entité (3 = Trains), entité, ancienne/nouvelle valeur, qui, quand | une entrée par changement de statut (CLAUDE.md §6) ; les batchs legacy n'écrivent pas d'historique (RG-INT-046) | bdd.md §5 ; legacy-integrations.md RG-INT-046 ; EX-TRA-034 |
| Paramètres métier du bloc (maquette ADM-05) | entretien (grain, seuil, arrondi), positions max par train, tiroirs max (20), campagne contrôlée (15 %), seuils 36 h / 115 % / 72 h | NOUVEAU ; valeurs par défaut = valeurs de la maquette, à valider (Q-256, Q-253, Q-276) | maquette ECR-ADM-05, ECR-COO-10 |

## 2. Profils × actions
### Bloc 1
Rôles provisoires (Q-003, CLAUDE.md §8) = les 6 rôles de la maquette. Mapping sur les 27 droits legacy (`CommunBll.Droits`, `tr_utilisateur_menu`) : `validation_admin`, `debloque_repart`, `view_repart`, `train_rafraichir_contrat`, `suivi_suivi_production`, `pliage_a_traiter` → `coord` + `admin` (écriture), lecture `cheq`/`com`/`recep` selon l'écran ; `reception_liste_affiche`, `Zone_Picking`, `fusion_affiche` → rôle Réception (autre module) ; droits `pliage`, `train_*`, `duplication_train`, `_2m2_fixe*`, `bus*` → coo2. Aucun droit legacy n'est contrôlé côté serveur : tous les contrôles ci-dessous le sont dans le service (RG-COO-165). Le périmètre site/atelier (`tr_utilisateur_data`) s'applique à toutes les lignes (RG-COO-167). Cellules : ✔ autorisé · ✘ refusé · ✔(cond.) avec condition · ? avec Q.

| Action | coord | cheq | recep | expe | admin | com | Source |
|---|---|---|---|---|---|---|---|
| Consulter « Validation admin et Instruction OK » (liste, fiche dossier) | ✔ | ✔ (lecture) | ✔ (lecture, fiche affiche) | ✘ | ✔ | ✔ (lecture) | maquette `roles` (coord, admin primaires ; autres « secondaires », grisés sans interdiction : Q-B) ; RG-COO-166 ; Q-201 |
| Valider une affiche / « Valider la sélection » | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-009 ; legacy `validation_admin` ; [README] §3, H1 ; Q-COO-6 (admin ≡ coord) ; Q-201 |
| Annuler la validation | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-014 ; maquette Q-COO-5 ; Q-201 |
| Rattacher une réception inconnue / rattachement manuel (fiche affiche) | ✔ (vaut validation) | ? Q-201 | ✔(cond.) : rattachement seul, reste « À confirmer » | ✘ | ✔ (vaut validation) | ✘ | RG-COO-017, RG-X-051, RG-X-063 ; ECR-REC-04 (Q-REC-18) ; legacy `validation_admin` (boutons associer/dissocier) |
| Signaler « Dossier introuvable » | ✔ | ✘ | ✔ | ✘ | ✔ | ✘ | RG-X-054 ; EX-REC-041 |
| Instruction OK (après contrôle) ; l'Instruction OK automatique est posée par Circé dès l'arrivée de la prépa (Q-204 TRANCHÉE, option b : aucun lancement manuel) | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-044, 042 ; maquette `instructions.js` ; Q-204 |
| Modifier l'entretien (%) / la position d'une instruction `EN_COURS` | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-047, 048, 050 ; legacy `pliage_a_traiter` |
| Annuler une instruction / « Annulé » | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-045 ; legacy `pliage_a_traiter` |
| Appliquer la version Broadcast | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-056 ; ECR-COO-02 |
| Demander une correction à Broadcast (mail Pré-Prod) | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-057 ; ECR-COO-04 |
| Reprendre la version Broadcast (thème), « Visuels / annonceurs différents », demander la correction de thème | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-068, 069, 070 ; ECR-THM-01 à 03 (`roles` : coord, admin) |
| Consulter l'état des réservations | ✔ | ✔ | ✔ | ✘ | ✔ | ✔ | RG-COO-107 ; ECR-PIL-03 (`roles` : coord, admin, recep, com, cheq) ; legacy `suivi_suivi_production` |
| Consulter le suivi de production (n° d'affiche visible si validée) | ✔ | ✔ | ? Q-201 | ? Q-201 | ✔ | ✔ (lecture) | RG-COO-021, 106 ; legacy `suivi_suivi_production` |
| Consulter les alertes de coordination (Pilotage › Alertes) | ✔ | ✔ (alertes de leur périmètre) | ✔ (alertes de réception) | ✘ | ✔ | ✔ (lecture) | ECR-TRA-01 (aucun `roles` déclaré) ; RG-COO-033, 066 à 074 ; destinataires par type : RG-COO-072 |
| Acquitter une alerte | ? Q-220 | ? Q-220 | ? Q-220 | ✘ | ? Q-220 | ✘ | ECR-TRA-01 (Q-TRA-2, acquittement par utilisateur ou global) ; Q-220 |
| Lancer une lecture/alimentation Broadcast manuelle (« Rafraîchir un dossier », passage manuel) | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-132, 103 ; legacy `train_rafraichir_contrat` ; Q-201 |
| Débloquer une préparation / « Rendre la main à la Pré-Prod » | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-145, 151, 152 ; legacy `debloque_repart` ; Q-217 |
| Consulter « Préparations débloquées » | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-149, 152 ; legacy `view_repart` ; Q-201 |
| Fusion d'affiches (conservation de la validation admin) | ? Q-REC-19 | ✘ | ✔ (droit `fusion_affiche`) | ✘ | ✔ | ✘ | RG-COO-029 ; legacy `fusion_affiche` ; module Réception |
| Paramétrer règles d'alerte, seuils, canaux, listes de distribution | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ | ECR-ADM-04, ECR-ADM-05 (Administration › Paramétrage) ; EX-TRA-029 ; EX-ADM-504 ; Q-220 |
| Paramétrer les règles d'inclusion/exclusion de déblocage (atelier, famille de type, surface) | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-141 ; legacy `admin`/`referentiel` (données de référence `tr_atelier_droit_prepa`) ; Q-227 |
| Se voir attribuer un compte Pré-Prod dans Circé | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | RG-COO-169 (la Pré-Prod ne travaille que dans Broadcast) |

### Bloc 2
Rôles provisoires (Q-003) : les 6 rôles de la maquette (`M.ROLES`, `core.js:187-194`). La maquette ne restreint par rôle que la validation admin (coo1) ; tout le reste du bloc est « grisé » sans interdiction (info-bulles « Réservé à la Coordination »). Le legacy ne contrôle aucun droit côté serveur (RG-ADM-015) : seules des entrées de menu / boutons selon les 27 droits `tr_utilisateur_menu`. La matrice ci-dessous est donc une HYPOTHÈSE (Q-286) construite sur le champ `roles` des écrans de la maquette (ECR-COO-05 à 11 : `cheq` + `coord`, dispatch / bagues : `cheq`), les info-bulles et le mapping des droits legacy. Les contrôles sont à faire dans le service (CLAUDE.md §6). Les droits `debloque_repart`, `view_repart`, `validation_admin`, `train_rafraichir_contrat` sont traités par coo1.

| Action | coord | cheq | recep | expe | admin | com | Source |
|---|---|---|---|---|---|---|---|
| Consulter Liste des trains, Suivi par thème, Préparation, Suivi 8 m², unitaire (fixe / pliage / bus) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ? Q-286 | maquette `roles` ECR-COO-05 à 09 ; legacy `pliage`, `train_suivi_theme`, `train_preparation`, `_2m2_fixe`, `pliage`, `bus` |
| Exporter les trains (jeudi 14 h) et simulation | ✔ | ? Q-286 | ✘ | ✘ | ✔(cond.) pont `admin` = `coord` (Q-COO-6) | ✘ | ECR-COO-05b info-bulle « par la Coordination » ; legacy droit `pliage` ; RG-COO-212 |
| Créer / supprimer un train (pré-test, entretien) | ✔ | ? Q-286 | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-05c, 05e (Q-COO-14) ; EX-COO-505 ; RG-COO-224, 225 |
| Fractionner / Raccrocher un visuel | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | legacy `train_regrouper` ; RG-COO-221, 222 |
| Changer statut, Annuler un thème, Débloquer semaine (trains) | ✔ | ? Q-286 | ✘ | ✘ | ? Q-286 | ✘ | legacy `train_changer_statut`, `train_annuler_theme`, `train_debloquer_semaine` ; RG-COO-218 à 220 |
| Export préparation, Au roulage, Choisir le rouleur | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | legacy `train_preparation` ; ECR-COO-07 ; RG-COO-215, 217, 236 |
| Pré-assemblage (marquer / désassembler) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-06 ; RG-COO-233 |
| Saisie du Suivi 8 m² (demies haut / bas, finales) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-08 ; RG-COO-237 |
| Afficher le n° de panneau Broadcast | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | EX-SCR-512 ; RG-COO-229 |
| Libérer la semaine (fixe, pliage, bus) | ✔ | ? Q-265 | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09a (« Qui fait la libération ? » ouverte, Q-COO-17) ; RG-COO-240 |
| Rendre la main à la Pré-Prod | ✔ | ? Q-286 | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09b ; EX-EXI-045 ; RG-COO-243 |
| Corriger l'intitulé (annonceur imprimé, thème) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09c ; EX-FIX-509 (droits limités à préciser) ; RG-COO-244 |
| Créer UM, Retirer, Préparer (fixe / pliage / bus) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | legacy `_2m2_fixe*`, `pliage*`, `bus*`, `retirer` ; RG-COO-249, 250, 260 |
| Saisir le comptage du pliage | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09 (« Plié ») ; RG-COO-247 |
| Quantités à encoller (Bus) | ✔ | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-09e ; RG-COO-304 |
| Dispatch : proposer / affecter / désaffecter un rouleur, liste de picking | ? Q-286 | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-10 (`roles: cheq`) ; RG-COO-291 à 296 |
| Imprimer / modifier les bagues | ? Q-286 | ✔ | ✘ | ✘ | ? Q-286 | ✘ | ECR-COO-11 (`roles: cheq`) ; RG-COO-298 à 300 |
| Réimprimer une bague | ? Q-286 | ✔(cond.) directeur de plateforme / chef d'équipe | ✘ | ✘ | ? Q-286 | ✘ | EX-ADM-503 ; RG-COO-301 |
| Dupliquer un train | ? Q-260 | ? Q-260 | ✘ | ✘ | ✔(cond.) droit legacy `duplication_train` non attribuable par l'écran | ✘ | legacy `_MenuNew.cshtml:180-183` ; RG-COO-226 |
| Colis : rattacher UM / train, expédier, fin de journée | ✘ | ✔ | ✘ | ✔ | ? Q-286 | ✘ | maquette ECR-EXP-01 (`roles expe, cheq`) ; legacy `train_preparation`, `expedition_ext` ; RG-COO-265 à 269 |
| Déblocage de répartition (annulation répartitions / UM) | ✔(cond.) pont coo1 | ✘ | ✘ | ✘ | ✔(cond.) pont coo1 | ✘ | legacy `debloque_repart` ; RG-COO-277, 278 |
| Rouleurs (référentiel) | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ | legacy droit `referentiel` ; ECR-ADM-07 ; RG-COO-297 |

## 3. Machine d'états
### Partie A — Dossiers, validation admin, instruction, lignes attendues
Périmètre de ce fragment (coo1) : machines d'états des AFFICHES (validation admin), des DOSSIERS (préparation ; pastille de validation calculée), des INSTRUCTIONS du déroulant, des LIGNES ATTENDUES, des DEMANDES de correction, des ALERTES et du GROUPE DE PRÉPARATION (déblocage). Les statuts des trains, faces, UM, colis, répartitions appartiennent à coo2 : ils ne sont cités que comme « ponts ». Statuts hérités du legacy : `Enums.cs:223-247` (`StatutPreparation` 0 à 10), contenu de `tr_statut` à obtenir (Q-004).

#### 3.1 Statuts

##### 3.1.a Validation admin d'une affiche (calculée, RG-COO-007)
| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| `RECEPTION_INCONNUE` | Réception inconnue | affiche sans dossier rattaché : à identifier d'abord (fiche Réceptions inconnues) | [PC] p.1 ; ECR-REC-04 ; RG-COO-007 |
| `A_CONFIRMER_PROPOSE` | À confirmer : proposé | cas sûr (RG-COO-005), pré-coché | [PC] p.1 ; RG-COO-005 |
| `A_CONFIRMER_DOUTE` | À confirmer : doute | au moins un motif (BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE) ; un par un | [PC] p.1 ; RG-COO-006 |
| `VALIDEE` | Validée par <nom> le <date> | confirmée par une personne | [PC] p.1 ; RG-COO-008, 015 |
| (libellés divergents) | Proposée par Circé / À vérifier / Orpheline ([DC]) | à harmoniser sur les libellés ci-dessus | Q-200 |

##### 3.1.b Dossier — préparation (persisté) et validation admin (pastille calculée)
| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| `A_TRAITER` | À traiter | prépa non envoyée (un mot, un sens) | [PC] p.1 ; RG-COO-063 |
| `PREPARATION_RECUE` | Préparation reçue | prépa envoyée par la Pré-Prod, posé par Circé | [PC] p.1 ; RG-COO-063 |
| `ANNULE` | Annulé | vente annulée ; validation « — » | [PC] p.1 ; RG-COO-062 |
| (calculé) `AUCUNE_AFFICHE_RECUE` | Aucune affiche reçue | rien à valider | RG-COO-019 |
| (calculé) `A_CONFIRMER(n)` | À confirmer (n[, dont k doutes]) | affiches à confirmer | RG-COO-019 |
| (calculé) `VALIDEE` | Validée (« Validation admin faite ») | au moins une affiche reçue, toutes confirmées | RG-COO-019, 020 |
| (calculé) `SANS_OBJET` | « — » | dossier annulé | RG-COO-019 |
| `VALIDE` (interne maquette) | non affiché | préparation reçue + toutes affiches confirmées : NON retenu comme statut persisté | Q-215 |

##### 3.1.c Instruction (déroulant) — grain dossier × semaine × atelier
| Statut (code legacy) | Libellé affiché | Signification | Source |
|---|---|---|---|
| `A_TRAITER` (0) | À traiter · prépa pas reçue (instruction) | faces reçues, instructions pas encore reçues | [PC] p.1 ; EX-EXI-018, 030 ; RG-COO-040 |
| `EN_COURS` (1) | En cours | prépa reçue, posé par Circé ; traité automatiquement (Nariman) ou par la Coordination | RG-COO-040, 041 |
| `INSTRUCTION_OK` (2) | Instruction ok (automatique / après contrôle) | feu vert de composition ; calcule et fige les trains | RG-COO-042, 044 |
| `ERREUR` (3) | Erreur | hérité ; repassé à 1 à l'intégration ; aucun choix proposé | `p_integ_instructions.sql` ; RG-COO-041 |
| `ANNULE` (4) | Annulé | pas à produire, avant l'export | RG-COO-045 |
| `PRET_A_PRODUIRE` (5) | Prêt à produire (ex « A imprimer ») | exportée le jeudi 14 h : posé par l'export (coo2) | [PC] p.1 ; EX-COO-020 |
| 6 à 10 (Préparé, A expédier, Terminé, Export prépa, Au roulage) | (faces/UM) | côté production : coo2, NON statuts d'instruction | EX-EXI-030 |
| mode `AUTO` / `MANUEL` | « Instruction ok · automatique » / « après contrôle » | propriété de la transition vers 2 (`iok_par`, `iok_le`) | RG-COO-042, 044 |

##### 3.1.d Ligne attendue
| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| `source` BC | (repère) | ligne alimentée par la copie Broadcast (prépa non envoyée) | RG-COO-082 |
| `source` PREPA | (repère) | prépa arrivée (`qte_prepa`) | RG-COO-086 |
| `etat_ligne` ACTIVE | — | ligne vivante, une par clé | RG-COO-080 |
| `etat_ligne` ANNULEE | — | fermée avec date, jamais supprimée | RG-COO-087, 089 |
| Attendue / Partielle / Complète / Surplus | (calculé, Réception) | non persisté ; > 10 % en trop = Surplus | EX-REC-051 (module Réception) |

##### 3.1.e Autres objets
| Objet | Statuts | Source |
|---|---|---|
| Demande de correction à Broadcast | `ENVOYEE` (date, user, note) → `FAITE` (« Corrigé par Broadcast » quand Broadcast renvoie la prépa corrigée) ; renvoi autorisé (« Le mail sera renvoyé ») | RG-COO-057, 069 |
| Vérification de thèmes/annonceurs | `A_VERIFIER` → `DEMANDE` → `CORRIGE` ; ou `DIFFERENTS` ; `MEME` ; rouvrable | RG-COO-069, 070 |
| Alerte | `OUVERTE` → `ACQUITTEE` (ou levée automatiquement quand la condition disparaît) ; gravités critical / serious (« Important ») / warning (« À surveiller ») / info | RG-COO-033, 066 à 074 ; Q-220 |
| Groupe de préparation Broadcast | `ENVOYE` (133) → `INTEGRE` (accusé `MajStatutGroupePrepa`) → `DEBLOQUE` (`P_CirceDebloquerGroupePreparation`) ; `StatutPrepa` : None (débloquable) / En cours (bloquant) | RG-COO-125, 142, 145 |
| Chargement de flux | 1 (en cours) → 0 (OK) / 2 (échec) | RG-COO-116 |

#### 3.2 Transitions (toute transition absente est INTERDITE : 409)

##### 3.2.a Affiche — validation admin
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (création) | Création de l'affiche par la Réception | `A_CONFIRMER_PROPOSE` / `A_CONFIRMER_DOUTE` / `RECEPTION_INCONNUE` selon calcul | Réception (action) ; état calculé par Circé | RG-COO-004, 005, 006, 007 | proposition de liens ; aucun effet de validation (RG-COO-002) | [PP] §5 ; [RA] |
| `RECEPTION_INCONNUE` | Rattacher | `VALIDEE` (coord, admin) ou `A_CONFIRMER_DOUTE` (autres rôles) | `coord`, `admin` (validation) ; `recep` (rattachement seul) | RG-COO-017, RG-COO-009 | RG-X-051, RG-X-063 | [README] §3 ; ECR-REC-04 |
| `RECEPTION_INCONNUE` | Signaler (dossier introuvable) | `RECEPTION_INCONNUE` (statut d'affiche « Introuvable ») | `coord`, `recep` | RG-X-054 | alerte « Dossier introuvable » (RG-COO-072) | [DC] §7 |
| `A_CONFIRMER_PROPOSE` | Valider / Valider la sélection | `VALIDEE` | `coord`, `admin` | RG-COO-008, 009, 010 | RG-COO-021 à 025 ; historique RG-COO-015 | [PC] p.1-2 |
| `A_CONFIRMER_DOUTE` | Valider (confirmation explicite) | `VALIDEE` | `coord`, `admin` | RG-COO-012 | idem | ECR-COO-03 |
| `VALIDEE` | Annuler la validation | `A_CONFIRMER_DOUTE` (motif ANNULEE) | `coord`, `admin` | RG-COO-014 | RG-X-050 | [PP] §5 |
| `VALIDEE` | Thème de la ligne changé (Broadcast) | `A_CONFIRMER_DOUTE` (motif THEME) | système (alimentation) | RG-COO-030 | alerte ; RG-X-057 | [RA] RG-VA-02 |
| `A_CONFIRMER_*`, `VALIDEE` | Retrait du dernier dossier | `RECEPTION_INCONNUE` | `coord`, `recep` | RG-X-058 | validation effacée | [DC] §8-10 |
| `A_CONFIRMER_*`, `VALIDEE` | Rattachement manuel (surplus, autre dossier) | état recalculé | `coord`, `admin` (vaut validation du lien) | RG-COO-099, RG-X-052 | historique | [PP] §6 |
| tout état | Fusion d'affiches | `VALIDEE` si une source l'était | droit `fusion_affiche` | RG-COO-029 | héritage `par/le` | legacy `FusionAfficheBll.cs:127` |

##### 3.2.b Dossier — préparation
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (création) | Lecture Broadcast, DA activée | `A_TRAITER` | système | RG-COO-091 | alerte « Préparation non reçue » après deadline (RG-COO-066) | [PC] |
| `A_TRAITER` | Intégration de la prépa | `PREPARATION_RECUE` | système (Circé) | RG-COO-063, 121, 131 | instruction → `EN_COURS` (RG-COO-041) ; historique (RG-COO-061) | [PC] p.1 ; [PP] §2 |
| `PREPARATION_RECUE` | Renvoi de prépa (avant export) | `PREPARATION_RECUE` | système | RG-COO-054 (Q-204), 148 | instruction rouverte ; validation inchangée (RG-X-059) | [PP] §2 jalon 5 |
| `A_TRAITER`, `PREPARATION_RECUE` | DA / vente annulée | `ANNULE` | système | RG-COO-062 | alertes relevées ; RG-X-065 | [PC] p.1 |
| `PREPARATION_RECUE` | Déblocage de la préparation | `PREPARATION_RECUE` (après annulation des lignes) | `coord`, `admin` | RG-COO-143, 144, 145 | RG-X-059 | legacy `AdminPreparationDeblocageBll.cs:252-333` |

##### 3.2.c Instruction (déroulant)
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (absente) | Intégration d'instruction / chapeau | `EN_COURS` (instruction) ou `A_TRAITER` (chapeau de faces) | système | RG-COO-041, 131 | historique | `p_integ_instructions.sql:175-259` |
| `A_TRAITER` | Arrivée des instructions | `EN_COURS` | système | RG-COO-041 | — | EX-EXI-018 |
| `A_TRAITER` | Annuler | `ANNULE` | `coord`, `admin` | RG-COO-045 | historique | legacy `PreparationDeroulantsController.cs:1507-1542` |
| `EN_COURS` | Instruction OK automatique (règle de Nariman) | `INSTRUCTION_OK` (AUTO) | système | RG-COO-042, 043, 052 ; moment Q-204 | calcul des trains (pont coo2) ; RG-COO-047 | [PC] ; [RA] RG-IOK-01 |
| `EN_COURS` | Instruction OK (après contrôle) | `INSTRUCTION_OK` (MANUEL) | `coord`, `admin` | RG-COO-044, 043, 052 | idem | [PC] p.1-2 |
| `EN_COURS` | Annuler | `ANNULE` | `coord`, `admin` | RG-COO-045 | historique | idem |
| `EN_COURS` | Renvoi Broadcast (intégration) | `EN_COURS` | système | RG-COO-041 | mise à jour annonceur/commentaire | `p_integ_instructions.sql:578-590` |
| `INSTRUCTION_OK` | Retour « En cours » / « À traiter » | `EN_COURS` / `A_TRAITER` | `coord`, `admin` | RG-COO-046 | efface le calcul des trains sauf faces 5 (pont coo2) | `p_u_statut_preparation.sql:24-64` |
| `INSTRUCTION_OK` | Annuler | `ANNULE` | `coord`, `admin` | RG-COO-045, 046 | efface le calcul | idem |
| `INSTRUCTION_OK` | Renvoi de prépa avant export | `EN_COURS` | système | RG-COO-054 (Q-204) | recalcul des trains | maquette `renvoiPrepa` |
| `INSTRUCTION_OK` | Export des trains du jeudi 14 h (action coo2) | `PRET_A_PRODUIRE` | `coord` (coo2) | gardes coo2 | historique `ExporterTrains` (RG-COO-160) | [PC] ; `PreparationDeroulantsService.cs:109-223` |
| `INSTRUCTION_OK`, `PRET_A_PRODUIRE`, `ANNULE` | Renvoi de Broadcast | inchangé (ignoré + alerte) | système | RG-COO-053 | alerte « Rajout après préparation » (RG-COO-073) | `p_integ_train_affiches.sql:38-48` |
| `PRET_A_PRODUIRE` | Débloquer semaine (action coo2) | `INSTRUCTION_OK` | droit `train_debloquer_semaine` (coo2) | gardes coo2 | — | `TrainSuiviThemeBll.cs:496-522` |
| `ANNULE` | Remettre à traiter | `A_TRAITER` | `coord`, `admin` | RG-COO-045 | historique | `PreparationRepository.cs:1020-1111` |
| `ERREUR` | Intégration suivante | `EN_COURS` | système | RG-COO-041 | — | `p_integ_*` |

##### 3.2.d Ligne attendue
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (absente) | Lecture Broadcast (prépa non envoyée) | `ACTIVE`, source BC | système | RG-COO-080, 082 | — | [RA] RG-AT-03 |
| `ACTIVE` source BC | Arrivée de la prépa | `ACTIVE`, source PREPA | système | RG-COO-086 | alerte écart si `qte_prepa ≠ qte_bc` | [RA] RG-AT-05 |
| `ACTIVE` | Ligne non revue à la lecture suivante / DA annulée | `ANNULEE` | système | RG-COO-087 | alerte si lien actif ; RG-X-055, 065 | [RA] RG-AT-06 |
| `ACTIVE` (provisoire) | IP saisies | `ANNULEE` + lignes par thème `ACTIVE` | système | RG-COO-085 | RG-X-056 | [RA] RG-AT-04 |
| `ACTIVE` | Doublon (reprise) | `ANNULEE` (autres lignes de la clé) | migration | RG-COO-090 | lien reporté | [RA] §4 |

##### 3.2.e Groupe de préparation Broadcast (déblocage)
| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| `ENVOYE` (133) | Intégration par Circé | `INTEGRE` | système | RG-COO-121, 125 | accusé à Broadcast | `BatchAlimBll.cs:91-124` |
| `INTEGRE` | Débloquer | `DEBLOQUE` | `coord`, `admin` | RG-COO-143, 144, 152 | RG-COO-145 à 147 ; RG-X-059 | `AdminPreparationDeblocageBll.cs:252-333` |
| `INTEGRE` | Débloquer (groupe avec UM ≥ 6 ou faces ≥ 2) | — | — | RG-COO-143, 144 | refus 422 | idem |

##### Transitions interdites notables (409)
| Tentative | Réponse | Règle |
|---|---|---|
| Valider une affiche déjà `VALIDEE` ; annuler une validation d'une affiche non validée | 409 | RG-COO-008, 014 |
| Passer de `RECEPTION_INCONNUE` à `VALIDEE` sans rattachement | 409 | RG-COO-007, 017 |
| Instruction OK depuis un statut autre que `EN_COURS` (`A_TRAITER`, `ANNULE`, `PRET_A_PRODUIRE`, `INSTRUCTION_OK`) | 409 | RG-COO-040, 044 |
| Instruction OK avant l'arrivée de la prépa | 422 | RG-COO-052 |
| Annuler (ou changer de statut) une instruction `PRET_A_PRODUIRE` depuis l'écran des instructions | 409 | RG-COO-040, 045, 046 |
| Modifier annonceur / entretien / position d'une instruction `INSTRUCTION_OK` ou `PRET_A_PRODUIRE` | 409 | RG-COO-047 |
| Rouvrir (« En cours ») une instruction après l'export | 409 | RG-COO-040, 054 |
| Passer un dossier `ANNULE` en `A_TRAITER` / `PREPARATION_RECUE` | 409 | RG-COO-062 |
| Supprimer une ligne attendue ; rouvrir une ligne `ANNULEE` hors migration | 409 | RG-COO-089 |
| Débloquer un groupe avec UM ≥ 6 ou faces ≥ 2 | 422 | RG-COO-143, 144 |

### Partie B — Trains, préparation, répartition, UM, colis
#### 3.1 Statuts du bloc 2 (trains, préparation, répartition, UM, colis)

Périmètre : coo2 est propriétaire des statuts de face de train / train, d'unité de production, de ligne de répartition, d'UM et (interface) de colis ; coo1 est propriétaire des statuts de dossier, de validation admin et d'instruction (mêmes codes `tr_statut` 0 à 5 côté instruction). Les codes sont ceux de l'énumération C# (`Enums.cs:52-77`, `CommunBll.cs:46-59`, 0 à 10) ; le contenu de `tr_statut` n'est pas dans le dépôt (Q-004). La cible (maquette, ECR-ADM-03 et `M.STATUTS`) définit un statut d'unité à 7 valeurs ; leur articulation avec les codes legacy est l'objet de Q-250 (HYPOTHÈSE PRISE : voir cette question).

| Statut | Libellé affiché | Signification | Source |
|---|---|---|---|
| Face de train 0 | A traiter | face intégrée de Broadcast, instruction pas encore passée | legacy RG-COO-049 ; EX-EXI-030 |
| Face de train 1 | En cours | face remise à blanc / instruction en cours (retour de l'Instruction OK) | legacy RG-COO-064 |
| Face de train 2 | Instruction ok | thème posé, train, position, entretien calculés ; seule valeur exportable | RG-COO-200 à 203, 210 |
| Face de train 3 | Erreur | face en erreur, repassée à 1 / supprimée puis recréée à l'intégration | legacy RG-COO-049 ; bdd.md §4.1 |
| Face de train 4 | Annulé | face annulée (anti-doublon, annulation de thème) | RG-COO-205, 219 |
| Face de train 5 | A imprimer (cible : Prêt à produire) | faces exportées le jeudi : go des plateformes | RG-COO-210 ; EX-COO-024 ; maquettes-autres-modules.md §0.6 point 6 |
| Face de train 6 | Préparé (cible : Produit) | posé côté production ; non analysé pour les faces | EX-EXI-030 ; Q-250 |
| Face de train 7 | A expédier (cible : Colisé · à expédier) | face dans un colis | RG-COO-270 |
| Face de train 8 | Terminé (cible : Expédié puis Livré) | fin de journée | RG-COO-269 |
| Face de train 9 | Export prépa (cible : En production) | face exportée pour la préparation 2 m² (ateliers 5 et 6) | RG-COO-215 |
| Face de train 10 | Au roulage (cible : En production) | rouleur affecté, train en roulage | RG-COO-217 |
| Unité EN_ATTENTE | En attente d'affiches | au moins un visuel non couvert ni fractionné (calcul de couverture) | RG-COO-208 ; ECR-COO-05 |
| Unité PRET | Prêt à produire | tous les visuels couverts ou fractionnés (maquette) ; = statut A imprimer après export (spec) | RG-COO-208, 210 ; Q-250, Q-251 |
| Unité EN_PROD | En production | bague imprimée ou fichier envoyé : POINT DE NON-RETOUR | RG-COO-223, 299 |
| Unité PRODUIT | Produit | production terminée (« Préparé » legacy) ; comptage pliage conforme | RG-COO-247, 250 |
| Unité COLISE | Colisé · à expédier | unité scannée dans un colis ouvert | RG-COO-265 ; ECR-EXP-01 |
| Unité EXPEDIE | Expédié | fin de journée Geodis | RG-COO-269 |
| Unité LIVRE | Livré | preuve de livraison reçue | ECR-EXP-02 (module EXP) |
| Repère « à libérer » | à libérer | ligne fixe / pliage / bus d'une semaine non libérée | RG-COO-241 |
| Repère « arrivé après libération » | Arrivé après libération (Important) | préparation reçue après la libération | RG-COO-242 |
| Repère « rendu » / « main rendue » | Main rendue à la Pré-Prod | unité non lancée rendue | RG-COO-243 |
| Ligne de répartition 0 | A traiter | répartition intégrée sans UM | legacy RG-RPR-002 ; EX-EXI-040, 042 |
| Ligne de répartition 1 | En cours | ligne rattachée à une UM (colisée) | RG-COO-261 |
| Ligne de répartition 3 | Erreur | anomalie 905 / 906 / 907 à l'intégration AMT | RG-COO-274 |
| Ligne de répartition 4 | Annulé | déblocage ; libère le `rpfo_ident` | RG-COO-272, 278 |
| Ligne de répartition 6 | Préparé | UM préparée (le statut ne suit pas les 7 / 8 de l'UM) | RG-COO-250, 280 |
| UM 1 | En cours | UM créée / réouverte | RG-COO-261 |
| UM 6 | Préparé | UM préparée ou placée dans un colis | RG-COO-250, 265 |
| UM 7 | A expédier | colis expédié | RG-COO-268 |
| UM 8 | Terminé | fin de journée | RG-COO-269 |
| UM 4 | Annulé | déblocage de répartition | RG-COO-278 |
| Colis 1 | En cours (cible : Colis ouvert) | colis créé | RG-COO-266 |
| Colis 7 | A expédier (cible : Clos · à expédier) | colis expédié (legacy) | RG-COO-268 |
| Colis 8 | Terminé (cible : Expédié, Livré) | fin de journée | RG-COO-269 |

#### 3.2 Transitions (toute transition absente est INTERDITE : 409)

Face de train (`tf_face_train.rpc_statut`)

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (nouvelle) | Intégration Broadcast (coo1) | 0 | batch | pas de réintégration au-delà de l'Instruction OK (RG-COO-049 legacy, coo1) | RG-COO-207 | legacy `p_integ_train_affiches.sql` |
| 0, 1, 3 | Instruction OK (transition coo1) | 2 | `coord` (auto : règle de Nariman) | thèmes à 100 % (coo1) | RG-COO-200 à 205 | `p_u_associe_train.sql` |
| 2 | Retour de l'instruction à 0 / 1 / 4 | remis à blanc (0 / 1 / 4) | `coord` | face non à 5 | RG-COO-206 | `p_u_statut_preparation.sql:24-64` |
| 2 | Exporter les trains | 5 | `coord` | RG-COO-210, 211, 216 | RG-COO-213, 214, RG-X-083 | `PreparationDeroulantsService.cs:109-223` |
| 2 | Changer statut | 5 | `train_changer_statut` | RG-COO-218 | historique | `PreparationDeroulantsController.cs:1417-1431` |
| 5 | Changer statut | 10 | `train_changer_statut` | RG-COO-218 | rouleur : RG-COO-217 | idem |
| 5 | Export préparation (ateliers 5 et 6) | 9 | `cheq`, `coord` | RG-COO-215, 216 | — | `TrainPreparationBll.cs:257-291` |
| 9 | Au roulage | 10 | `cheq`, `coord` | rouleur obligatoire (RG-COO-217) | EN_PROD (RG-COO-299) | `TrainExportPrepaRepository.cs` |
| 9 | Suppression d'un thème de l'export | 5 | `cheq`, `coord` | RG-COO-217 | — | `TrainPreparationRepository.cs` |
| 10, 5, 9 | Changer statut « A imprimer » | 5 | `train_changer_statut` | toutes les faces en 10, 5 ou 9 (RG-COO-218) | restreint aux directeurs de plateforme / chefs d'équipe (EX-ADM-503) | `TrainPreparationBll.cs:234-255` |
| 5 | Annuler thème | 4 | `train_annuler_theme` | thème et faces à 5 (RG-COO-219) | `train_id = NULL` | `TrainSuiviThemeBll.cs:181-202` |
| 5 | Débloquer semaine | 2 | `train_debloquer_semaine` | toutes les faces à 5, aucune EN_PROD (RG-COO-220) | instructions 5 → 2 | `TrainSuiviThemeBll.cs:496-522` |
| 5, 9, 10 | Ajout du train à un colis | 7 | `expe`, `cheq` | RG-COO-270 | — | `PreparationColisageService.cs:154-209` |
| 7 | Fin de journée | 8 | batch / `expe` | RG-COO-269 | RG-X-087 | `p_batch_fin_journee_colis.sql` |
| 5 | Dupliquer train (copies) | 5 (nouvelles faces) | `duplication_train` | RG-COO-226 | — | `p_u_duplication_train.sql` |

Unité de production cible (train, UM, lot) — statut persisté ou dérivé selon Q-250

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| EN_ATTENTE | Couverture complète (automatique) | PRET | système | tous les visuels couverts ou fractionnés (RG-COO-208) | RG-X-079 | ECR-COO-05 |
| EN_ATTENTE | Fractionner | PRET | `coord`, `cheq` | ≥ 1 visuel reçu (RG-COO-221) | position fractionnée, RG-X-086 | ECR-COO-05 |
| PRET | Réception retirée / raccrochage d'un visuel manquant | EN_ATTENTE | système | unité non EN_PROD (RG-COO-208, 222) | — | ECR-COO-05d |
| PRET | Imprimer les bagues / envoyer le fichier à la machine | EN_PROD | `cheq` | au moins une unité PRET (RG-COO-299) | point de non-retour (RG-COO-223) | ECR-COO-11a, ECR-GEN-03 |
| EN_ATTENTE, PRET | Rendre la main à la Pré-Prod | EN_ATTENTE (repère rendu) | `coord` | unités non EN_PROD (RG-COO-243) | RG-X-081 | ECR-COO-09b |
| PRET, EN_PROD | Valider le comptage (pliage) | PRODUIT | `cheq` | RG-COO-247 | alerte qualité si écart | ECR-COO-09 |
| EN_PROD | Préparé / produit (fixe : « Préparer ») | PRODUIT | `cheq` | RG-COO-250 | — | EX-EXI-042 |
| PRODUIT | Scan dans un colis | COLISE | `expe`, `cheq` | RG-COO-265 | — | ECR-EXP-01 |
| COLISE | Fin de journée Geodis | EXPEDIE | `expe` | RG-COO-269 | RG-X-087 | ECR-EXP-02 |
| EXPEDIE | Preuve de livraison reçue | LIVRE | système | module EXP | — | ECR-EXP-02 |
| (train) EN_ATTENTE | Suppression de train | supprimé | `coord` | non EN_PROD, motif (RG-COO-225) | couverture recalculée | ECR-COO-05e |

Ligne de répartition (`tf_repart_calcul.rpc_statut`)

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (nouvelle) | Intégration batch (coo1 ou AMT) | 0 | batch | pas de doublon actif (RG-COO-272) | — | `p_integ_preparation.sql`, `p_integ_ptf_reparts.sql` |
| (nouvelle) | Intégration AMT, anomalie 905 / 906 / 907 | 3 | batch | RG-COO-274 | anomalies | `p_integ_ptf_reparts.sql` |
| 0 | Créer UM (colisage) | 1 | `cheq`, `coord` | seul le statut 0 est admis (RG-COO-262) | UM_id posé | `PreparationRepository.cs:190-303` |
| 1 | Retirer | 0 | `cheq` (droit `retirer`) | UM dans aucun colis (RG-COO-249) | UM supprimée | `PreparationService.cs:275-288` |
| 1 | Préparer | 6 | `cheq`, `coord` | RG-COO-250 | — | `PreparationRepository.cs:435-470` |
| 0, 1, 6 | Déblocage | 4 | `coord`, `admin` (pont coo1) | aucune UM ≥ 6 (RG-COO-277) | UM → 4 (RG-COO-278) | `p_u_statut_repart_deblocage.sql` |
| 4 | Réintégration d'une nouvelle ligne | (nouvelle ligne à 0) | batch | RG-COO-272 | — | `p_integ_ptf_reparts.sql:72-90` |

UM (`tf_UM.rpc_statut`) et colis (`tf_colis.rpc_statut`) — interface

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| (nouvelle) | Création d'UM | UM 1 | `cheq`, `coord` | RG-COO-260, 261 | répartitions 0 → 1 | `PreparationRepository.cs:190-303` |
| UM 1, 6 | Ajout au colis | UM 6 | `expe`, `cheq` | même destinataire (RG-COO-265) | poids du colis (RG-COO-263) | `PreparationColisageService.cs:76-148` |
| UM 6 | Retrait du dernier colis | UM 1 | `expe`, `cheq` | RG-COO-267 | — | `PreparationColisageService.cs:240-322` |
| UM 1, 6 | Préparer | UM 6 | `cheq` | RG-COO-250 | — | `PreparationService.cs:294-299` |
| UM 1, 6 | Expédier le colis | UM 7 | `expe` | RG-COO-268 | — | `PreparationColisBll.cs:497-560` |
| UM 7 (colis 7) | Fin de journée | UM 8 | batch / `expe` | RG-COO-269 | RG-X-087 | `p_batch_fin_journee_colis.sql` |
| UM 7, 8 | Ouvrir le colis | UM 1 ou 6 | `expe` | deux comportements legacy (RG-COO-266) | — | `PreparationColisageService.cs:329-345` |
| UM (tout statut) | Déblocage de répartition | UM 4 | `coord` (pont coo1) | RG-COO-277 | colis inchangés (RG-COO-278) | `p_u_statut_repart_deblocage.sql` |
| (nouveau) | Création de colis | colis 1 | `expe`, `cheq` | RG-COO-266 | — | `PreparationColisRepository.cs:203-225` |
| colis 1 | Expédier | colis 7 | `expe` | RG-COO-268 | UM / faces → 7 | `p_u_expedie_Colis.sql` |
| colis 7 | Fin de journée | colis 8 | batch / `expe` | RG-COO-269 | — | `p_batch_fin_journee_colis.sql` |
| colis 7, 8 | Ouvrir | colis 1 | `expe` | cible : colis clos ne se rouvre pas (RG-COO-266, Q-272) | — | `PreparationColisBll.cs:139-158` |

Transitions interdites notables (409)

| De | Action | Pourquoi | Règle |
|---|---|---|---|
| Face 2 | Annuler thème / Débloquer semaine | seules les faces à 5 | RG-COO-219, 220 |
| Face 0, 1, 3, 4 | Exporter les trains | seules les faces à 2 partent | RG-COO-210 |
| Face ≠ 5 ou 9 | Export préparation | message « Les faces des trains ne sont pas dans le statut 'A imprimer' ! » | RG-COO-215 |
| Face (ateliers ≠ 5, 6) | Export préparation / Caire | ateliers 5 et 6 seulement | RG-COO-215 |
| Unité EN_PROD et au-delà | Modifier, fractionner, raccrocher, supprimer, débloquer semaine, rendre la main (retrait) | point de non-retour : « Train déjà en production : impossible de le modifier (point de non-retour). » | RG-COO-223 |
| Unité autre que EN_ATTENTE | Fractionner | « Aucun train fractionnable (il faut au moins un visuel reçu). » | RG-COO-221 |
| Train complet | Raccrocher un visuel | « Train complet » | RG-COO-209, 222 |
| Unité PRET absente | Imprimer les bagues | « Aucune unité « Prêt à produire » dans la sélection. » | RG-COO-299 |
| Répartition 3, 4, 6, 7, 8 | Créer UM | seule la répartition à 0 entre dans une UM (HYPOTHÈSE) | RG-COO-262 |
| UM dans un colis | Retirer | refus explicite (le legacy échoue par contrainte étrangère) | RG-COO-249 |
| UM 3, 4, 7, 8 | Ajout au colis / Préparer | seules les UM 1 ou 6 | RG-COO-265, 250 |
| Répartition avec UM ≥ 6 | Déblocage | « Le groupe de preparation n'est pas déblocable ! » | RG-COO-277 |
| Libération déjà posée pour (atelier, semaine) | Libérer | HYPOTHÈSE : une seule libération | RG-COO-240 |
| Toute transition non listée ci-dessus | tout | table de transitions explicite (CLAUDE.md §6) | RG-COO-307 |

## 4. Règles
### Bloc 1 (RG-COO-001…199)
### RG-COO-001 — Deux circuits indépendants : validation admin et Instruction OK
- Origine : MODIFIÉE
- Énoncé : la validation admin part de la réception physique de l'affiche ; l'Instruction OK part de la préparation (prépa envoyée de Broadcast). Aucun des deux ne conditionne l'autre : la validation admin n'attend ni la prépa ni l'Instruction OK ; l'Instruction OK n'attend pas la validation admin. Aucune garde de l'un ne lit l'état de l'autre (tests : valider sans prépa reçue, passer en Instruction OK sans aucune affiche validée).
- Déclencheur : toute transition de validation admin ou d'Instruction OK.
- Conditions : aucune dépendance croisée ; vaut pour fixe, pliage, déroulant (scro) et bus.
- Effet / message d'erreur : aucun rejet fondé sur l'état de l'autre circuit. MODIFIÉE : le legacy n'a pas de test explicite mais, au scro, la validation passe par la liaison aux lignes de prépa du dossier, qui naissent à l'Instruction OK (dépendance indirecte, retour terrain 02/11) ; la cible supprime cette dépendance (« La validation admin n'attend ni la prépa ni l'Instruction OK »).
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:218-257` (liaison des lignes de prépa) · spec [PC] p.1 encadré « Indépendants » ; [PP] encadré 02/11, §3, §8 (EX-COO-001) ; EX-EXI-053, EX-EXI-054
- Questions liées : Q-200
- Implémentation : apps/api/src/modules/coordination/instructions.ts (aucune garde sur la validation) ; apps/api/src/modules/reception/affiches.ts (validation sans garde sur l’instruction) — PARTIEL : COO-P01 (2026-11-04) : indépendance testée pour annuler / remettre / retour arrière ; reste le passage en Instruction OK (COO-P02)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-002 — Circé propose, une personne confirme (option A du 02/11)
- Origine : MODIFIÉE
- Énoncé : à la réception d'une affiche, Circé propose le rattachement à une ligne attendue de l'état des réservations, aidé du BL (n° de dossier ou de DA, format, plateforme, semaine, visuel). Rien n'est validé sans une personne identifiée : aucun traitement automatique (batch, alimentation, arrivée de la prépa, rattachement proposé) ne pose la validation admin. Hypothèse retenue le 02/11 avec la cheffe de projet.
- Déclencheur : création d'une affiche par la Réception (voir RG-X-050 à 063 pour les conséquences croisées).
- Conditions : l'état « Validée » n'est atteint que par l'action explicite d'un utilisateur autorisé (RG-COO-008, 010, 017).
- Effet / message d'erreur : toute tentative de passer à « Validée » sans utilisateur authentifié et autorisé : 403 (RG-COO-009). MODIFIÉE : legacy = case à cocher libre, éditable sans lien avec une proposition.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` (L.867, case libre ; ancien ID provisoire RG-COO-026) · spec [PP] encadré 02/11, §5 ; [RA] encadré, RG-VA-04 (EX-COO-004) ; écran ECR-COO-01 (« Aucune validation sans vous : Circé propose, vous confirmez »)
- Questions liées : Q-200, Q-234
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:validerSelection ; apps/api/src/modules/reception/validation.ts (aucune validation à la réception) — FAIT : COO-P03 (2026-11-05) : aucun traitement automatique ne valide (réception, prépa) ; validation par coord / admin seulement
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-COO-003 — Origine du n° de dossier associé à une affiche
- Origine : MODIFIÉE
- Énoncé : le n° de dossier (ou de DA) associé à l'affiche provient, dans l'ordre : (1) du BL (photo du BL) : cas courant ; (2) sinon du visuel (photo d'une affiche comparée aux visuels de Broadcast), ce qui crée le doute « pas de n° sur le BL » ; (3) sinon d'une saisie (« Par n° de dossier », DA, annonceur, ou traitement d'une réception inconnue). Circé cherche ce n° dans les lignes attendues (dossier, thème, format, semaine). Un visuel commun à plusieurs dossiers donne plusieurs n° : la répartition est à confirmer (motif MULTI). Plusieurs n° s'écrivent séparés par « + » (format conservé du legacy).
- Déclencheur : enregistrement de la réception d'une affiche ; recherche dans la fiche affiche.
- Conditions : voie (1) = cas sûr possible (RG-COO-005) ; voies (2) et (3) = toujours doute (motif BL, RG-COO-006).
- Effet / message d'erreur : formats refusés côté back (aucune écriture) : n° de dossier mal formé (séparateur « + »), semaines mal formées (« + » ou « / »), nombre de dossiers ≠ nombre de semaines, `nombre_semaine` ≠ nombre de semaines (messages legacy : constantes `FormatDossierIncorrect`, `FormatSemaineIncorrect`, `DossierSemaine`, `NombreSemaineSemaine`, textes à relever, Q-228).
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:131-173` (ancien ID provisoire RG-COO-025) · spec [PC] p.1 encadré « Le n° de dossier associé » ; [PP] §5 (EX-COO-005) ; EX-EXI-052
- Questions liées : Q-228, Q-234
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:motifsDoute (BL : mode VISUEL / MAIN, n° lu ≠ ligne) ; apps/api/src/modules/reception/bon-livraison.ts (mode BL, Q-184) — PARTIEL : COO-P03 (2026-11-05) : voies BL / saisie → mode du lien ; reste : voie visuel (reconnaissance, Q-112) ; contrôles de format de saisie sans objet en V2 (Q-185 (7))
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-COO-004 — Proposition de rattachement à la réception d'une affiche
- Origine : NOUVELLE
- Énoncé : à la création d'une affiche, Circé calcule une proposition de rattachement à une ou plusieurs lignes attendues ACTIVES (même plateforme, même semaine de la fenêtre, support compatible avec le format de l'affiche). La proposition est enregistrée sur l'affiche (mode de rattachement BL ou VISUEL, RG-COO-018), n'a aucun effet de validation, et est recalculée si la ligne attendue change (arrivée de la prépa, IP, annulation). Si aucune ligne candidate n'existe : l'affiche est une réception inconnue (traitée par la Coordination, RG-X-054).
- Déclencheur : création d'une affiche ; événement de modification de la ligne attendue ciblée.
- Conditions : ligne attendue `etat_ligne = ACTIVE` ; le format trie les candidats, le doute porte sur le thème (RG-COO-006) ; Circé ne rattache jamais en lecture (pas d'auto-rattachement à l'ouverture d'une fiche, RG-X-062).
- Effet / message d'erreur : création des liens avec `mode_rattachement`, `actif = true`, quantité = quantité proposée (≤ quantité reçue) ; historique « proposé par Circé (automatique) ». Remplace le rattachement systématique du legacy aux lignes de mêmes textes (RG legacy COO-020).
- Sources : legacy `BLL/LivraisonAfficheService.cs:427-486,522-527` ; `REP/LivraisonAfficheRepository.cs:392-413` (ancien ID provisoire RG-COO-020) · spec [PP] §5 ; [RA] encadré, RG-AT-08 (EX-COO-004, EX-COO-039) ; ateliers (EX-COO-506, ex EX-COO-006 : « 3 événements dont la prépa », remplacé par l'option A)
- Questions liées : Q-207, Q-234
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:affichesDesDossiers (recalcul à chaque lecture) ; apps/api/src/modules/reception/validation.ts (liens créés avec mode et quantité) — PARTIEL : COO-P03 (2026-11-05) : proposition = lien posé à la réception, sans effet de validation, recalculée à la lecture ; reste : proposition calculée par Circé (lecture du BL / reconnaissance, Q-112)
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-COO-005 — Cas sûr : conditions d'une proposition pré-cochée
- Origine : NOUVELLE
- Énoncé : une proposition est un « cas sûr » (pré-cochée) si et seulement si les cinq conditions sont réunies : (a) l'affiche est rattachée à une ligne attendue ACTIVE ; (b) le n° de dossier ou de DA lu sur le BL est celui de la ligne ; (c) même format que la ligne ; (d) un seul thème possible (ou le visuel lu sur le BL désigne le thème) ; (e) un seul dossier. La préparation arrivée n'est PAS une condition (supprimée le 02/11). Toute autre proposition est un doute (RG-COO-006).
- Déclencheur : calcul de l'état de validation d'une affiche (RG-COO-007).
- Conditions : les cinq conditions cumulées ; aucun motif de doute présent.
- Effet / message d'erreur : état « À confirmer : proposé » ; éligible au pré-cochage (RG-COO-011).
- Sources : spec [PP] §5 ; [RA] RG-VA-01, RG-VA-04 ; [DC] §15 (EX-COO-006) ; écran ECR-COO-01 (« Cas sûr : uniquement `va` et aucun doute »)
- Questions liées : Q-234
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:etatValidation, motifsDoute — FAIT : COO-P03 (2026-11-05) : cinq conditions ; ligne non ACTIVE → doute LIGNE_FERMEE (ANO-028, Q-185 (10))
- Tests : apps/api/src/modules/coordination/validation-admin.test.ts ; apps/api/src/modules/coordination/validation-admin-complement.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-COO-006 — Motifs de doute (affiche à doute)
- Origine : NOUVELLE
- Énoncé : une affiche rattachée est « à doute » dès qu'au moins un motif est présent ; les motifs sont calculés, cumulables et affichés ensemble : `BL` « Rattachée sans le n° du BL » (rattachement par le visuel ou à la main) ; `FORMAT` « Format différent » ; `THEME` « Plusieurs thèmes possibles » (dans ce format : visuel à confirmer) ; `MULTI` « Répartition à confirmer » (même visuel pour plusieurs dossiers) ; `SANS_IP` « IP pas saisies » (thème provisoire) ; `ANNULEE` « Validation annulée : à refaire ». Un doute n'est jamais pré-coché et exige une confirmation explicite (RG-COO-012).
- Déclencheur : calcul de l'état de validation (RG-COO-007).
- Conditions : motif = fonction de l'affiche, de ses liens et de la ligne attendue (jamais saisi).
- Effet / message d'erreur : état « À confirmer : doute » ; la fiche dossier affiche les libellés des motifs ; alerte si départ en S ou S+1 (RG-COO-033).
- Sources : spec [PP] §5 ; [PC] p.1 ; [DC] encadré 02/11 ; [README] §3 (EX-COO-007) ; écran ECR-COO-01 (`M.VA_MOTIFS`, `data.js`)
- Questions liées : Q-200
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:motifsDoute — PARTIEL : COO-P03 (2026-11-05) : motifs calculés, cumulés, affichés (fiche dossier, fiche affiche, modale) ; reste : alerte départ S / S+1 (RG-COO-033, COO-P05)
- Tests : apps/api/src/modules/coordination/validation-admin.test.ts ; apps/api/src/modules/coordination/validation-admin-complement.test.ts ; apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts ; e2e/coordination-validation-admin.spec.ts

### RG-COO-007 — États de validation d'une affiche (calcul)
- Origine : NOUVELLE
- Énoncé : l'état de validation d'une affiche est calculé, jamais saisi, dans cet ordre : `RECEPTION_INCONNUE` (aucun dossier rattaché) ; `VALIDEE` (confirmée par une personne : validée, par, le) ; `A_CONFIRMER_DOUTE` (au moins un motif, RG-COO-006) ; `A_CONFIRMER_PROPOSE` (cas sûr, RG-COO-005). Un dossier n'est jamais « Validée » sans affiche reçue. Transitions : voir section 3.
- Déclencheur : toute création/modification d'affiche, de lien ou de ligne attendue ; confirmation ; annulation.
- Conditions : ordre de priorité ci-dessus ; une validation annulée donne `A_CONFIRMER_DOUTE` avec motif ANNULEE.
- Effet / message d'erreur : état persisté en lecture rapide ou recalculé (choix d'implémentation) mais toujours cohérent avec les liens ; toute transition hors table = 409.
- Sources : spec [PC] p.1 ; [DC] encadré 02/11 ; [README] §5 (EX-COO-012) ; legacy `legacy-coordination.md §5.2` (cycle libre false/true, ancien ID RG-COO-026) ; écran ECR-COO-01 (`C.vaEtat`)
- Questions liées : Q-200
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:etatValidation ; affichesDesDossiers ; etatValidationAffiche — FAIT : COO-P03 (2026-11-05) : état calculé à la lecture (Q-185 (1)) ; motif ANNULEE persisté (affiche.validation_annulee)
- Tests : apps/api/src/modules/coordination/validation-admin.test.ts ; apps/api/src/modules/coordination/validation-admin-complement.test.ts ; apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-COO-008 — Confirmation unitaire d'une affiche (fiche dossier)
- Origine : MODIFIÉE
- Énoncé : depuis la fiche du dossier (tableau « Affiches reçues et validation admin »), l'action « Valider » confirme la validation admin d'une affiche `A_CONFIRMER_*` : elle pose validée = vrai, par = utilisateur, le = date/heure, écrit l'historique (RG-COO-015) et déclenche les effets RG-COO-021 à 025. Les doutes se confirment un par un dans la fiche (bouton « Valider (n affiches) » pour le dossier).
- Déclencheur : clic « Valider » (ECR-COO-02) ; API de validation avec `Idempotency-Key` et `version` de l'affiche.
- Conditions : rôle autorisé (RG-COO-009) ; affiche en `A_CONFIRMER_PROPOSE` ou `A_CONFIRMER_DOUTE` ; version conforme (sinon 409).
- Effet / message d'erreur : état `VALIDEE` ; 409 si l'affiche est déjà validée ou version périmée ; 403 si rôle non autorisé ; toast « n affiche(s) confirmée(s) par la Coordination : n° d'affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé. ». MODIFIÉE : legacy = simple recopie de la case postée, sans contrôle de droit, de préparation associée ni de quantité côté serveur.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` ; `BLL/HistorisationBll.cs:29-32` (ancien ID provisoire RG-COO-026) · spec [PC] p.1-2 ; [README] §3 (EX-COO-008) ; écran ECR-COO-02
- Questions liées : Q-203
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:changerValidationCoordination ; POST /api/coordination/affiches/:id/validation-admin — FAIT : COO-P04 (2026-11-05) : confirmation unitaire (proposée ou doute), 409 déjà validée / version / réception inconnue, idempotence, historique affiche + dossier
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; e2e/coordination-effets-validation.spec.ts

### RG-COO-009 — Qui peut valider, annuler la validation, passer l'Instruction OK
- Origine : MODIFIÉE
- Énoncé : les actions « Valider », « Valider la sélection », « Annuler la validation », « Instruction OK (après contrôle) », « Appliquer la version Broadcast » et « Demander une correction à Broadcast » sont réservées aux rôles `coord` (Coordination) et `admin` (provisoire, droit legacy `validation_admin` mappé). Le contrôle est fait dans le service (pas seulement dans le front). L'agent de réception, le chef d'équipe, l'agent d'expédition et le commerce ne valident pas. Un rattachement fait par un autre rôle ne vaut pas validation (RG-COO-017).
- Déclencheur : toute action listée.
- Conditions : rôle de l'utilisateur ∈ {coord, admin}.
- Effet / message d'erreur : 403 `{ code: 'PERMISSION', regle: 'RG-COO-009' }` ; message UI « Réservé à la Coordination : choisissez le rôle « Coordination » en haut de page pour valider » (maquette ; à reformuler en production). MODIFIÉE : legacy = droit `validation_admin` testé dans le front seulement (aucun `[Authorize]` côté serveur).
- Sources : legacy `WEB/Views/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:24` ; `BLL/CommunBll.cs:276-303` (ancien ID provisoire RG-COO-026, RG-COO-090) · spec [README] §3, H1 ; [DC] §7 (EX-COO-010, EX-TRA-005) ; écran ECR-COO-01 (maquette `instructions.js:16-18`, Q-COO-5, Q-COO-6)
- Questions liées : Q-201, Q-003
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:changerValidationCoordination ; validation-admin.ts:validerSelection ; permissions.ts:assertDroitCoordination — FAIT : COO-P04 (2026-11-05) : valider / annuler unitaire et lot réservés à coord / admin (6 rôles testés) ; l’endpoint Réception garde RG-REC-003 (HYPOTHÈSE Q-186 (1))
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/coordination/validation-admin.int.test.ts

### RG-COO-010 — Confirmation en lot « Valider la sélection »
- Origine : NOUVELLE
- Énoncé : sur la page Pré-production › « Validation admin et Instruction OK », « Valider la sélection » confirme en un clic toutes les affiches `A_CONFIRMER_*` des dossiers cochés. L'opération est atomique (une seule transaction pour toute la sélection) ; si une affiche a changé (version) ou n'est plus à confirmer, elle est ignorée et listée dans le résultat sans bloquer les autres (comportement par défaut, Q-203). Chaque affiche confirmée suit RG-COO-008.
- Déclencheur : action groupée (sélection non vide) ; `Idempotency-Key` obligatoire.
- Conditions : rôle autorisé (RG-COO-009) ; au moins une affiche à confirmer dans la sélection (sinon RG-COO-013).
- Effet / message d'erreur : résultat `{ confirmees, ignorees[] }` ; si la sélection contient des doutes → RG-COO-012 ; 403 hors rôle. Aucun plafond de taille de lot spécifié (Q-203).
- Sources : spec [PC] p.1-2 ; [README] §3 ; [DESIGN] §11 (EX-COO-008) ; écran ECR-COO-01 (action « Valider la sélection »)
- Questions liées : Q-203
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:validerSelection, messageConfirmation — FAIT : COO-P04 (2026-11-05) : toast complet de la maquette (« Broadcast informé au prochain retour », HYPOTHÈSE Q-186 (2)) ; effets RG-COO-021 à 025 posés
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/src/modules/coordination/effets-validation.test.ts ; e2e/coordination-validation-admin.spec.ts

### RG-COO-011 — Pré-cochage des cas sûrs et bouton « Cocher les cas sûrs »
- Origine : NOUVELLE
- Énoncé : à l'arrivée sur l'écran (une fois par arrivée, pas à chaque changement de filtre), les dossiers dont il ne reste que des rattachements proposés sans doute (cas sûrs uniquement) sont pré-cochés pour un utilisateur `coord`/`admin`. Le bouton « Cocher les cas sûrs (n) » recoche les premières lignes concernées. Les dossiers comportant au moins un doute ne sont jamais pré-cochés.
- Déclencheur : chargement de l'écran ; clic sur « Cocher les cas sûrs ».
- Conditions : rôle `coord` ou `admin` ; dossier dont toutes les affiches à confirmer sont `A_CONFIRMER_PROPOSE`.
- Effet / message d'erreur : la sélection est un état d'interface (aucune écriture) ; « n » = nombre de dossiers cas sûrs sous le filtre courant.
- Sources : spec [PC] p.1-2 ; [README] §3 (EX-COO-008) ; écran ECR-COO-01 (pré-sélection `M.navSeq`)
- Questions liées : Q-203
- Implémentation : apps/web/src/routes/coordination/index.tsx (pré-cochage, « Cocher les cas sûrs (n) ») ; apps/api/src/modules/coordination/dossiers.ts:listerDossiers (casSur, casSurs) — FAIT : COO-P03 (2026-11-05) : HYPOTHÈSE Q-185 (4)
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts ; e2e/coordination-validation-admin.spec.ts

### RG-COO-012 — Confirmation explicite des affiches à doute
- Origine : NOUVELLE
- Énoncé : si la sélection contient des doutes, une confirmation explicite est exigée avant écriture : modale « Confirmer aussi les affiches à doute ? » listant n° · libellé · motifs, avec trois issues : « Annuler » (rien n'est écrit), « Confirmer les n sans doute seulement » (disponible si n > 0), « Confirmer tout (n) ». Côté API, la présence de doutes sans l'indicateur de confirmation explicite (`confirmerDoutes = true`) est refusée.
- Déclencheur : « Valider la sélection » avec au moins un doute.
- Conditions : au moins une affiche `A_CONFIRMER_DOUTE` dans la sélection.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-012' }` si l'API reçoit des doutes sans confirmation explicite ; texte de la modale : « n affiche(s) sans doute et m affiche(s) à doute sont dans la sélection. Rien n'est validé sans vous… ».
- Sources : spec [PC] p.1-2 ; [DESIGN] §11 (EX-COO-007, EX-COO-008) ; écran ECR-COO-03
- Questions liées : Q-203
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:validerSelection (422 COO_DOUTES_A_CONFIRMER) ; apps/web/src/components/coordination/valider-selection.tsx (ECR-COO-03) — FAIT : COO-P03 (2026-11-05) : seuls les doutes affichés sont confirmés (Q-185 (6))
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts ; e2e/coordination-validation-admin.spec.ts

### RG-COO-013 — Rien à valider : refus
- Origine : NOUVELLE
- Énoncé : si la sélection ne contient aucune affiche `A_CONFIRMER_*` (validation déjà faite ou aucune affiche encore arrivée), l'action est refusée.
- Déclencheur : « Valider la sélection » / « Valider » sans affiche à confirmer.
- Conditions : zéro affiche à confirmer.
- Effet / message d'erreur : 422 ; messages : « Rien à valider : les dossiers choisis n'ont aucune affiche à confirmer (validation admin déjà faite, ou aucune affiche reçue). » (sélection de dossiers) ; « Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n'est encore arrivée. » (variante).
- Sources : spec [PC] p.1 ; écran ECR-COO-01 (refus) (EX-COO-008, EX-COO-013)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:validerSelection (422 COO_RIEN_A_VALIDER) — FAIT : COO-P03 (2026-11-05)
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts ; e2e/coordination-validation-admin.spec.ts

### RG-COO-014 — Annulation de la validation (« Annuler la validation »)
- Origine : MODIFIÉE
- Énoncé : une validation se décoche toujours (« Annuler la validation », bouton de la fiche affiche et de la fiche dossier), sans condition de statut du dossier, de la prépa ou de l'Instruction OK. L'affiche repasse à `A_CONFIRMER_DOUTE` avec le motif ANNULEE (« Validation annulée : à refaire ») ; validée/par/le sont effacés ; l'historique écrit « validation annulée par <nom> ». L'annulation ne remet pas en cause les UM, trains ou colis déjà produits (point de non-retour de production, coo2).
- Déclencheur : clic « Annuler la validation » ; API avec `version` + `Idempotency-Key`.
- Conditions : affiche en `VALIDEE` ; rôle `coord`/`admin` (RG-COO-009).
- Effet / message d'erreur : 409 si l'affiche n'est pas `VALIDEE` ; effets aval retirés : voir RG-X-050 et Q-202 (n° d'affiche du suivi de prod, picking, retour Broadcast `EstAssociee` au prochain passage). MODIFIÉE : legacy = décochage libre, sans impression d'étiquette, historique « décoché » ; cible : nom + date tracés, motif ANNULEE.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` ; `BLL/HistorisationBll.cs:29-32` (ancien ID provisoire RG-COO-026, 027) · spec [PP] §5 ; [RA] RG-VA-04 ; [DC] encadré 02/11 (EX-COO-009) ; écran ECR-COO-02
- Questions liées : Q-202
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:changerValidationCoordination, donneesAnnulation ; apps/api/src/modules/reception/affiches.ts:changerValidationAdmin — FAIT : COO-P04 (2026-11-05) : VALIDEE → doute ANNULEE, 409 si non validée, sans condition de dossier / prépa / Instruction OK
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/src/modules/coordination/effets-validation.test.ts ; e2e/coordination-effets-validation.spec.ts

### RG-COO-015 — Traçabilité de la validation : nom de la personne et date
- Origine : MODIFIÉE
- Énoncé : toute validation ou annulation de validation enregistre `validationAdmin_par` (identité nominative de l'utilisateur) et `validationAdmin_le` (horodatage) sur l'affiche et une ligne d'historique (action ModificationValidationAdmin). L'historique ne dit jamais « validée par Circé » : un acteur automatique ne peut pas être `par`. L'identité doit être nominative (comptes génériques de Nîmes exclus pour cette action, Q-003).
- Déclencheur : RG-COO-008, 010, 014, 017.
- Conditions : utilisateur authentifié nominatif.
- Effet / message d'erreur : refus 403 si l'identité est un compte système ; la frise de la fiche affiche montre « Validée par <nom> le <date> ».
- Sources : legacy `BLL/HistorisationBll.cs:29-32` (ancien ID provisoire RG-COO-026) · spec [PP] §5 ; [RA] §4, RG-VA-04 ; [DC] encadré 02/11, §13 (EX-COO-009, EX-TRA-036) ; EX-TRA-007
- Questions liées : Q-003
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:donneesValidation (par / le), journal nominatif — PARTIEL : COO-P04 (2026-11-05) : par / le nominatifs, aucun chemin automatique ; reste : exclusion des comptes génériques (aucun marqueur dans le modèle, Q-003 / Q-186 (4))
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/src/modules/coordination/effets-validation.test.ts

### RG-COO-016 — La quantité n'est pas une condition de la validation (réception partielle)
- Origine : CONSERVÉE
- Énoncé : la validation admin ne compare jamais la quantité reçue à la quantité attendue. Une réception partielle est validée pour ce qu'elle contient ; le manque reste un état de la ligne (« reste à recevoir ») avec son alerte (RG REC). Exemple 3/3/3 réception partielle (A reçue 3, B 2, C 0) : A et B sont validables, rien à valider pour C ; le complément de B est proposé puis confirmé à sa réception.
- Déclencheur : calcul de l'état de validation ; confirmation.
- Conditions : aucune condition de quantité dans les gardes de validation.
- Effet / message d'erreur : aucun rejet pour motif de quantité (test de rejet : une validation avec quantité reçue < attendue est acceptée). Voir RG-X-061 pour le complément.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` (aucun contrôle de quantité ; ancien ID provisoire RG-COO-026) · spec [PP] §5, §6 ; [RA] RG-VA-03, cas 24 (EX-COO-011)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:etatValidation (aucune condition de quantité) — FAIT : COO-P03 (2026-11-05)
- Tests : apps/api/src/modules/coordination/validation-admin-complement.test.ts ; apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-COO-017 — Le rattachement manuel d'une réception inconnue par la Coordination vaut validation
- Origine : NOUVELLE
- Énoncé : quand un utilisateur `coord`/`admin` rattache une affiche (réception inconnue, fiche affiche, changement de thème) à un ou plusieurs dossiers, la validation admin est faite dans la même opération (validée/par/le, mode MAIN). Si le rattachement est fait par un autre rôle (ex. agent de réception), l'affiche reste « À confirmer » avec le motif BL (« rattachée sans le n° du BL ») et mode MAIN.
- Déclencheur : action « Rattacher » (ECR-REC-04) ou « + Rattacher à un autre dossier » (fiche affiche).
- Conditions : rôle de l'acteur ; quantités > 0 ; total ≤ quantité reçue (règles de saisie côté Réception).
- Effet / message d'erreur : transaction unique rattachement + validation (RG-X-051) ; états : `VALIDEE` (coord/admin) ou `A_CONFIRMER_DOUTE` (autre rôle).
- Sources : spec [README] §3 (Réceptions inconnues), H1 ; [DC] §7 ; [PP] §6 (EX-COO-010, EX-COO-017) ; écran ECR-REC-04 (règles de « Rattacher ») ; legacy `BLL/ReceptionListeAfficheBll.cs:533-555` (ancien ID provisoire RG-COO-022, association libre sans validation)
- Questions liées : Q-201
- Implémentation : apps/api/src/modules/reception/inconnues.ts:rattacherInconnue ; affiches.ts:appliquerValidationSelonRole — FAIT : COO-P04 (2026-11-05) : coord / admin → VALIDEE (mode MAIN) dans la même transaction ; autre rôle → doute BL
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/reception/inconnues.int.test.ts

### RG-COO-018 — Mode de rattachement enregistré (BL, VISUEL, MAIN)
- Origine : NOUVELLE
- Énoncé : chaque affiche porte le mode de son rattachement : `BL` (n° de dossier lu sur le BL), `VISUEL` (reconnu par le visuel), `MAIN` (choisi par une personne). `VISUEL` et `MAIN` ajoutent le motif BL au calcul du doute (RG-COO-006) tant que l'affiche n'est pas confirmée.
- Déclencheur : création/modification d'un lien affiche ↔ ligne.
- Conditions : un lien actif porte exactement un mode.
- Effet / message d'erreur : champ `mode_rattachement` (V2) renseigné à chaque lien ; question V2 « garder le mode de rattachement » : conservé jusqu'à décision.
- Sources : spec [RA] §4 (EX-COO-046) ; maquette ECR-REC-04, `data.js` (`rattache` BL / VISUEL / MAIN)
- Questions liées : Q-234
- Implémentation : apps/api/src/modules/reception/rattachement.ts:rattacher (mode) ; coordination/validation-admin.ts:motifsDoute — FAIT : COO-P04 (2026-11-05) : mode BL / MAIN enregistré sur chaque lien ; MAIN ajoute le motif BL
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/reception/inconnues.int.test.ts

### RG-COO-019 — Pastille « Validation admin » du dossier (calculée)
- Origine : NOUVELLE
- Énoncé : la pastille de validation admin d'un dossier est calculée à partir de ses affiches : `SANS_OBJET` (dossier annulé, « — ») ; `A_CONFIRMER (n[, dont k doute(s)])` si au moins une affiche à confirmer ; `VALIDEE` si au moins une affiche reçue et toutes confirmées ; `AUCUNE_AFFICHE_RECUE` (« Aucune affiche reçue », rien à valider) sinon. Indépendante de la pastille de préparation (À traiter / Préparation reçue / Annulé) : deux pastilles indépendantes.
- Déclencheur : toute modification d'une affiche du dossier.
- Conditions : un dossier sans affiche reçue n'est jamais « Validée ».
- Effet / message d'erreur : lecture seule ; teinte « À surveiller » si doutes, « Info » sinon ; « OK » si validée.
- Sources : spec [PC] p.1 ; [DC] §9 ; [README] §5 ; [DESIGN] §11 (EX-COO-013) ; écran ECR-COO-01 (`C.vaResume`)
- Questions liées : Q-200, Q-215
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:resumeValidation ; apps/api/src/modules/coordination/dossiers.ts (pastille, filtre va) ; apps/web/src/components/coordination/libelles.ts:pastilleValidation — FAIT : COO-P03 (2026-11-05)
- Tests : apps/api/src/modules/coordination/validation-admin.test.ts ; apps/api/src/modules/coordination/validation-admin-complement.test.ts ; apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts ; e2e/coordination-validation-admin.spec.ts

### RG-COO-020 — Statut du dossier « Validation admin faite » : calcul, pas de statut persisté
- Origine : MODIFIÉE
- Énoncé : le statut « Validation admin faite » (ex « Validé Pré-Prod ») signifie « toutes les affiches reçues du dossier sont confirmées par une personne » ; il se déduit de RG-COO-019 et n'a pas de valeur persistée distincte de la préparation. Il ne dépend pas de l'arrivée de la prépa (la maquette y ajoutait « préparation reçue », Q-215).
- Déclencheur : lecture du dossier ; affichage dans le suivi et l'état des réservations.
- Conditions : au moins une affiche reçue, toutes `VALIDEE`.
- Effet / message d'erreur : aucune transition de statut dossier n'est déclenchée par la validation ; l'historique du dossier enregistre néanmoins la confirmation (RG-COO-160).
- Sources : legacy `legacy-coordination.md §5.2` (« Aucune transition liée à la présence de préparation, à la quantité, ni au statut de l'instruction ») · spec [PC] p.1 ; [DC] §9 ; [DESIGN] §11 (EX-COO-013) ; maquette `data.js` (`C.majStatutVA`, statut interne `VALIDE`)
- Questions liées : Q-200, Q-215
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:resumeValidation (calcul, aucun statut persisté) ; validerSelection (journal du dossier) — PARTIEL : COO-P03 (2026-11-05) : calculé, indépendant de la prépa, historique du dossier ; reste : affichage dans le suivi de production et l’état des réservations (écrans non construits)
- Tests : apps/api/src/modules/coordination/validation-admin.test.ts ; apps/api/src/modules/coordination/validation-admin-complement.test.ts ; apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts

### RG-COO-021 — Effet de la validation : n° d'affiche visible au suivi de production
- Origine : CONSERVÉE
- Énoncé : le n° d'affiche n'apparaît dans le suivi de production qu'une fois l'affiche validée ET rattachée à une ligne attendue qui n'est pas de source Broadcast. (Cible : le n° est visible dans l'état des réservations dès la réception — « • à confirmer », « ✓ validée » — et dans le suivi de prod dès la prépa pour les affiches validées.) Le suivi de prod limite l'affichage aux ateliers de l'utilisateur (RG-COO-167).
- Déclencheur : lecture du suivi de production.
- Conditions : `VALIDEE` ET (`source = PREPA`) ; sinon n° masqué.
- Effet / message d'erreur : lecture seule ; une affiche non validée n'expose pas son n° au suivi de prod (test de rejet).
- Sources : legacy `SQL/p_s_adminSuiviRead.sql:64-67,72-115,117-136` ; `BLL/SuiviSuiviProductionBll.cs:112` (ancien ID provisoire RG-COO-030) · spec [PP] §3 ; [PC] p.1-2 ; [README] §3 (EX-COO-014) ; EX-EXI-053, EX-EXI-060
- Questions liées : Q-202
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:numeroVisibleSuiviProd ; dossiers.ts:lireFicheDossier (lignes[].numerosSuiviProd) — PARTIEL : COO-P04 (2026-11-05) : calcul fait et exposé dans la fiche dossier ; écran de suivi de production non construit (ECR-PIL, D-10)
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/src/modules/coordination/effets-validation.test.ts

### RG-COO-022 — Effet de la validation : picking (verrou)
- Origine : CONSERVÉE
- Énoncé : la validation admin ouvre l'édition du picking (case « zone picking », édition du picking) ; une affiche non validée n'y est pas traitée. L'annulation de la validation retire cet effet (Q-202).
- Déclencheur : validation / annulation.
- Conditions : droit Zone picking (legacy `Zone_Picking`) ; affiche `VALIDEE`.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-022' }` si une action picking est tentée sur une affiche non validée (hypothèse de garde, Q-202).
- Sources : legacy `legacy-coordination.md §8` ; `WEB/Views/ZonePicking/Index.cshtml:91` (legacy-admin.md §2) · spec [PP] §3 ; [PC] p.1-2 (EX-COO-014) ; EX-EXI-053
- Questions liées : Q-202
- Implémentation : apps/api/src/modules/reception/impressions.ts:editionPicking (validées seulement) — FAIT : COO-P04 (2026-11-05) : seule une affiche validée figure à l’édition picking ; l’annulation l’en retire (zone picking legacy non reprise, Q-382)
- Tests : apps/api/test/coordination/effets-validation.int.test.ts

### RG-COO-023 — Effet de la validation : étiquette rack imprimée à la plateforme
- Origine : MODIFIÉE
- Énoncé : à la validation (passage non validée → validée), l'étiquette rack est préparée pour impression à la plateforme de l'affiche ; aucun effet au décochage. Les PDF sont générés côté navigateur, l'impression passe par l'agent local (Q-002). En confirmation en lot, les étiquettes ne partent pas en rafale : elles sont groupées par plateforme avec un bouton « Imprimer » (proposition Q62 non tranchée).
- Déclencheur : RG-COO-008, 010, 017.
- Conditions : transition `non validée → validée` uniquement.
- Effet / message d'erreur : événement « étiquette rack à imprimer » créé ; pas d'impression au retrait de validation. MODIFIÉE : legacy = impression serveur automatique (`EnvoyeReport`) à chaque cochage dans la fiche.
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:177,189-192` ; `WEB/Controllers/ZonePickingController.cs:133` (ancien ID provisoire RG-COO-027) · spec [PP] §3 ; [PC] p.1-2 (EX-COO-014 ; Q62) ; EX-TRA-024
- Questions liées : Q-002, Q-202
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:donneesValidation, listerEtiquettesRack ; reception/impressions.ts:enregistrerImpression ; apps/web/src/components/coordination/etiquettes-rack.tsx — FAIT : COO-P04 (2026-11-05) : drapeau « étiquette rack à imprimer » au passage non validée → validée, groupé par plateforme avec « Imprimer » (PDF navigateur, Q-002), levé à l’impression ; aucun effet au décochage (Q-162 ouverte, non bloquante)
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/src/modules/coordination/effets-validation.test.ts ; e2e/coordination-effets-validation.spec.ts

### RG-COO-024 — Effet de la validation : « reçue et associée » envoyé à Broadcast
- Origine : CONSERVÉE
- Énoncé : une affiche est envoyée à Broadcast avec `EstAssociee = true` si et seulement si elle est liée à une ligne attendue ET validée admin ; sinon `EstAssociee = false`. L'envoi se fait par le traitement de retour (RG-COO-134). L'annulation de la validation repasse `EstAssociee` à faux au passage suivant.
- Déclencheur : traitement de retour vers Broadcast ; (maquette : « Broadcast informé » à la validation).
- Conditions : `affiche_livraison_Id ≠ 0` (V2 : au moins un lien actif) ET `validationAdmin = true`.
- Effet / message d'erreur : champ `EstAssociee` ; destinataire fixe « CIRCE » ; site déduit de la plateforme (RG-COO-134).
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:41-50,65-95` (ancien ID provisoire RG-COO-029 ; RG-REC-111) · spec [DC] §12 ; EX-TRA-039 ; EX-EXI-053 (mécanisme de retour de la cible « à définir »)
- Questions liées : Q-231
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:estAssociee ; validation-admin.ts:affichesDesDossiers (estAssociee) — PARTIEL : COO-P04 (2026-11-05) : valeur calculée (lien actif ET validée) ; envoi par le traitement de retour BLOQUÉ (Q-005, RG-COO-134)
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/src/modules/coordination/effets-validation.test.ts

### RG-COO-025 — Effet de la validation : sortie de la liste « à traiter »
- Origine : CONSERVÉE
- Énoncé : une affiche validée sort de la liste des affiches « à traiter » de la Réception (une affiche est « à traiter » tant qu'elle n'est pas validée ou n'a pas de ligne attendue associée). L'annulation de la validation la fait réapparaître.
- Déclencheur : validation / annulation.
- Conditions : affiche non rebutée, non fusionnée.
- Effet / message d'erreur : filtre « à traiter » = non rebutée, non fusionnée, ET (non validée OU sans prépa associée).
- Sources : legacy legacy-reception.md §« liste à traiter » (`legacy-reception.md:77`, ancien ID RG-REC provisoire) · spec [PP] §3 ; [PC] p.1-2 (EX-COO-014) ; EX-EXI-053
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:aTraiter ; reception/affiches.ts:listerAffiches (aTraiter, filtre ?aTraiter=oui) — FAIT : COO-P04 (2026-11-05) : API : champ et filtre « à traiter » ; aucun écran de la maquette ne montre ce filtre (ECARTS)
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/src/modules/coordination/effets-validation.test.ts

### RG-COO-026 — « Affiche reçue » de l'état des réservations n'attend plus la validation admin
- Origine : MODIFIÉE
- Énoncé : l'indicateur « Affiche reçue » est posé par la réception (existence d'un mouvement de réception) et non par la validation admin ; la colonne « N° d'affiche » de l'état des réservations affiche « • » (proposé à confirmer) dès la réception et « ✓ » (validée) après confirmation. Legacy : « Aff. reçues = oui » seulement si une affiche validée correspond au dossier, à la semaine, à l'année et au thème texte de la ligne, sans test de plateforme ni de face.
- Déclencheur : lecture de l'état des réservations.
- Conditions : reçu = un mouvement de réception existe pour la ligne (règle de Réception) ; ✓ si `VALIDEE`, • sinon.
- Effet / message d'erreur : lecture seule ; test de rejet : une réception non validée n'affiche pas « non ». MODIFIÉE : legacy RG-COO-028 / ANO-05 (la réception seule laissait « non »).
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:172-201` (ancien ID provisoire RG-COO-028) · spec [README] §3 ; [DC] §15 (EX-COO-048) ; ateliers EX-REC-503 (S L54) ; EX-EXI-055
- Questions liées : Q-231
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:marqueEtatReservations ; dossiers.ts:lireFicheDossier ; apps/api/src/modules/coordination/reservations.ts:etatReservations (Affiche reçue calculée du reçu, N° d'affiche • / ✓) — FAIT : COO-P05 (2026-11-05) : « Affiche reçue » de l'état des réservations calculée du reçu (sans attendre la validation), « • » / « ✓ » (ECR-PIL-03)
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/coordination/lignes-attendues.int.test.ts ; e2e/coordination-etat-reservations.spec.ts

### RG-COO-027 — Effet « UM du fixe et du pliage » : non démontré, abandonné
- Origine : SUPPRIMÉE
- Énoncé : la validation admin ne crée, ne libère ni ne conditionne aucune unité de manutention du fixe ou du pliage. Aucune règle d'implémentation : l'effet « UM du fixe et du pliage » ne doit pas exister. Citation : « L'effet « UM du fixe et du pliage » est non démontré, corrigé le 02/11 » ([PP] §3, encadré correction ; contradiction 9 de specs-coordination).
- Déclencheur : sans objet (garde négative).
- Conditions : aucune création d'UM ne lit `validationAdmin`.
- Effet / message d'erreur : test de rejet : créer les UM d'un dossier sans validation admin réussit ; la libération de semaine est indépendante (coo2, RG-COO-2xx). Legacy : « la liste des UM n'est pas filtrée, elle affiche seulement n° d'affiche et oui/non ».
- Sources : spec [PP] §3 encadré correction ; [PC] p.1-2 (EX-COO-014) ; EX-EXI-054 · maquette ECR-COO-09a (« La libération ne valide rien et ne dépend pas de la validation admin »)
- Questions liées : —
- Implémentation : garde négative : aucun code de production ne lit validationAdmin — FAIT : COO-P04 (2026-11-05) : test de non-régression sur les sources (UM, répartition)
- Tests : apps/api/test/coordination/effets-validation.int.test.ts

### RG-COO-028 — Validation automatique par Circé à l'arrivée de la prépa : abandonnée
- Origine : SUPPRIMÉE
- Énoncé : la version du 27/10 (« les affiches déjà reçues sont validées dès l'arrivée de la prépa » ; « Circé fait la validation admin quand il n'y a pas de doute ») est supprimée par l'option A du 02/11. Aucun traitement n'écrit `validationAdmin = true`, et l'historique ne contient jamais « validée par Circé ». Citation : « Rien n'est validé sans une personne ; son nom et la date sont tracés » ; « La prépa arrivée n'est plus une condition (supprimée le 02/11) » ([PP] encadré 02/11, §5).
- Déclencheur : arrivée de la prépa ; réception d'une affiche (garde négative).
- Conditions : aucune.
- Effet / message d'erreur : test de rejet : l'arrivée de la prépa avec affiches reçues ne change aucune validation ; l'état reste `A_CONFIRMER_*`. Les passages non barrés de [PP] §1 (tableau « Qui fait quoi ») et §2 (note finale) sont obsolètes.
- Sources : spec [PP] §1, §2, §5, encadré 02/11 ; [PC] p.1 (EX-COO-004, EX-COO-006) ; contradictions 1 et 10 de specs-coordination
- Questions liées : Q-200
- Implémentation : coordination/integration.ts:integrerPreparation (aucune écriture de validation) — FAIT : COO-P04 (2026-11-05) : l’arrivée de la prépa laisse « à confirmer »
- Tests : apps/api/test/coordination/effets-validation.int.test.ts

### RG-COO-029 — Fusion d'affiches : la validation admin est conservée si l'une des sources l'avait
- Origine : CONSERVÉE
- Énoncé : lors d'une fusion, l'affiche chapeau est validée si elle l'était ou si l'une des affiches cibles l'était (OU logique) ; les liens (préparations) des cibles sont rattachés au chapeau. Dans la cible, la fusion n'est pas maquettée : règle conservée du legacy, avec attribution `par/le` de la validation d'origine (aucune validation nouvelle n'est créée par la fusion).
- Déclencheur : « Fusionner » (droit legacy `fusion_affiche`).
- Conditions : chapeau et cibles non fusionnés.
- Effet / message d'erreur : `validationAdmin(chapeau) = chapeau OR cibles` ; si le chapeau devient validé par héritage, `par/le` reprennent ceux de la source validée.
- Sources : legacy `BLL/FusionAfficheBll.cs:127,163` (ancien ID provisoire RG-COO-031 ; confiance PROBABLE) · spec EX-TRA-005 (droit `fusion_affiche`) ; ECR-REC (Q-REC-19 : fusion hors maquette)
- Questions liées : Q-REC-19 (maquette), Q-201
- Implémentation : reception/affiche.ts:assertAfficheNonFusionnee (fusion héritée en lecture seule) — PARTIEL : COO-P04 (2026-11-05) : fusion non reprise (Q-100 HYPOTHÈSE) : une cible de fusion héritée ne se valide pas (409 RG-REC-169) ; l’OU logique n’a pas d’action V2
- Tests : apps/api/test/coordination/effets-validation.int.test.ts

### RG-COO-030 — Thème de la ligne changé après la validation : validation à refaire
- Origine : NOUVELLE
- Énoncé : si le thème d'une ligne attendue change (Broadcast ou IP) alors qu'une affiche y est rattachée et validée, une alerte est levée et la validation est à refaire : l'affiche repasse `A_CONFIRMER_DOUTE` (motif THEME). Proposition non tranchée (Q55), appliquée par hypothèse.
- Déclencheur : lecture de Broadcast modifiant `IdTheme`/thème d'une ligne ayant un lien actif.
- Conditions : ligne avec au moins une affiche `VALIDEE` ; thème différent (comparaison par identifiant, RG-COO-081).
- Effet / message d'erreur : alerte « Thème modifié dans Broadcast » (RG-COO-068) ; effacement de validée/par/le avec historique « validation à refaire (thème modifié) » ; feuille de stock à refaire côté Réception (RG-X-057).
- Sources : spec [RA] RG-VA-02, cas 13 ; [PP] §6, §9 (EX-COO-016)
- Questions liées : Q-210
- Implémentation : apps/api/src/modules/coordination/lignes-maj.ts:mettreAJourLigneAttendue (déclencheur : integration.ts:integrerPreparation, lignes de la prépa) → apps/api/src/modules/coordination/effets-validation.ts:effetsLigneModifiee ; alerte calculable apps/api/src/modules/coordination/effets-validation.ts:alertesValidation (THEME_MODIFIE) — PARTIEL : COO-P04 (2026-11-05, audit) : effets branchés sur la prépa (validation à refaire, motif THEME, feuille à refaire) ; reste : alerte affichée (Alertes Pré-Prod, COO-P07) ; lecture Broadcast des lignes (Q-005) à brancher sur mettreAJourLigneAttendue ; COO-P06 (2026-11-05) : déclencheurs branchés en production (flux état des réservations et préparations, COO-P06) ; reste : alerte affichée (COO-P07) ; COO-P07 (2026-11-05) : alertes « Thème modifié dans Broadcast » et « Validation admin à confirmer » affichées (Pilotage › Alertes), testées via le passage d’intégration réel → FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/coordination/effets-validation-complement.int.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-031 — Quantité de la ligne changée après la validation : alerte seule
- Origine : NOUVELLE
- Énoncé : si la quantité d'une ligne change après la validation d'une affiche rattachée, une alerte « Écart Broadcast / Circé » est levée ; la validation n'est pas annulée (hypothèse Q55). La prépa différente de l'état des réservations déclenche aussi l'alerte (RG-COO-067).
- Déclencheur : lecture de Broadcast ; arrivée de la prépa.
- Conditions : `qte` modifiée, thème identique, lien actif validé.
- Effet / message d'erreur : alerte seule ; états inchangés ; test de rejet : la validation reste `VALIDEE`.
- Sources : spec [RA] RG-VA-02, cas 13 ; [PP] §6, §9 (EX-COO-016)
- Questions liées : Q-210
- Implémentation : apps/api/src/modules/coordination/lignes-maj.ts:mettreAJourLigneAttendue (déclencheurs : integrerPreparation, edition.ts:appliquerVersionBroadcast) ; apps/api/src/modules/coordination/effets-validation.ts:alertesValidation (ECART_QUANTITE) — PARTIEL : COO-P04 (2026-11-05, audit) : validation conservée via les vrais déclencheurs, alerte calculable ; reste : alerte affichée (COO-P07) ; COO-P06 (2026-11-05) : déclencheurs branchés en production (COO-P06) ; reste : alerte affichée (COO-P07) ; COO-P07 (2026-11-05) : alerte « Écart Broadcast / Circé » affichée (calcul par ligne, RG-COO-086) → FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/coordination/effets-validation-complement.int.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-032 — Ligne annulée après la validation : alerte à la Coordination
- Origine : NOUVELLE
- Énoncé : si une ligne attendue portant une affiche rattachée passe `ANNULEE` (DA annulée après réception), une alerte est levée à la Coordination ; l'affiche reste rattachée à la ligne fermée tant qu'une personne ne l'a pas déplacée (le lien n'est jamais perdu, RG-COO-088) ; la validation n'est pas retirée automatiquement.
- Déclencheur : passage de la ligne à `ANNULEE` (RG-COO-087).
- Conditions : au moins un lien actif sur la ligne.
- Effet / message d'erreur : alerte (type écart / dossier annulé) ; la fiche dossier montre l'affiche à re-rattacher.
- Sources : spec [RA] RG-AT-06, RG-VA-02, cas 14 ; [PP] §6 (EX-COO-016, EX-COO-037)
- Questions liées : Q-210
- Implémentation : integration.ts:annulerDossier → apps/api/src/modules/coordination/effets-validation.ts:effetsLigneModifiee ; apps/api/src/modules/coordination/effets-validation.ts:alertesValidation (LIGNE_ANNULEE), affichesSurLignesAnnulees ; fiche-dossier.tsx (encadré) — PARTIEL : COO-P04 (2026-11-05, audit) : lien et validation conservés, alerte calculable pour tout lien actif (ANO-029), encadré « à re-rattacher » de la fiche ; reste : alerte affichée dans Alertes Pré-Prod (COO-P07) ; COO-P06 (2026-11-05) : annulation de dossier branchée en production (flux instructions / annulations, COO-P06) ; reste : alerte affichée (COO-P07) ; COO-P07 (2026-11-05) : alerte « Ligne annulée : affiche à re-rattacher » affichée (Pilotage › Alertes) → FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/coordination/effets-validation-complement.int.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-033 — Alerte « Validation admin à confirmer »
- Origine : MODIFIÉE
- Énoncé : une alerte par affiche à doute, à destination de la Coordination ; gravité « grave » (Important/serious) pour un départ en S ou S+1, « À surveiller » (warning) au-delà ; le lien ouvre l'écran « Validation admin et Instruction OK » filtré sur le dossier. L'alerte se lève à la confirmation (ou à l'annulation du doute) ; les cas sûrs n'alertent pas. Libellé « à confirmer » (et non « à faire », Q-200).
- Déclencheur : passage d'une affiche à `A_CONFIRMER_DOUTE` ; recalcul quotidien de la gravité.
- Conditions : doute hors motif SANS_IP seul (qui alerte « Réception sans IP », RG-COO-071) ; départ ≤ S+1 → serious.
- Effet / message d'erreur : alerte clé `VA-<affiche>` ; destinataires `coord` ; canal paramétrable (Q-220).
- Sources : spec [PC] p.2 ; [DC] §11 ; [README] §7 (EX-COO-015, EX-COO-047) ; EX-REC-071 · écran ECR-TRA-01 (`VALIDATION_ADMIN`)
- Questions liées : Q-200, Q-220
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts:alertesCoordination (VA-), graviteValidation ; apps/api/src/modules/alertes/service.ts:listerAlertesPilotage — FAIT : COO-P07 (2026-11-05) : alerte calculée par affiche à doute (hors SANS_IP seul), Important si départ ≤ S+n (paramètre alertes.departGraveSemaines), lien vers ECR-COO-01 filtré ; levée à la confirmation ; canal / mail paramétrables : Q-220, D-08 (comme RG-REC-190)
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts ; apps/api/src/modules/coordination/alertes-coordination.test.ts ; e2e/coordination-alertes.spec.ts

### RG-COO-040 — Statuts de l'instruction (déroulant) et table de transitions
- Origine : MODIFIÉE
- Énoncé : l'instruction (grain dossier × semaine × atelier) a les statuts : `A_TRAITER` (0, faces reçues mais pas encore les instructions), `EN_COURS` (1, prépa reçue, posé par Circé), `INSTRUCTION_OK` (2, posé par la règle de Nariman sinon par la Coordination), `PRET_A_PRODUIRE` (5, ex « A imprimer », posé par l'export du jeudi 14 h : action de coo2), `ANNULE` (4, avant l'export), `ERREUR` (3, hérité : repassé à 1 à l'intégration suivante). Table de transitions explicite en section 3.2 ; toute transition non listée = 409. Chaque transition écrit un historique (RG-COO-061).
- Déclencheur : intégration d'instruction (batch), Instruction OK automatique (RG-COO-042), action de la Coordination (RG-COO-044/045/046), export des trains (coo2).
- Conditions : voir section 3.2 ; les valeurs 6 à 10 (Préparé, A expédier, Terminé, Export prépa, Au roulage) appartiennent aux faces/UM (coo2) et ne sont pas des statuts d'instruction.
- Effet / message d'erreur : 409 `{ code: 'TRANSITION_INTERDITE', regle: 'RG-COO-040' }`. MODIFIÉE : legacy = le back applique le statut posté sans contrôle de transition ; la liste des statuts proposés n'est qu'un filtre du front.
- Sources : legacy `WEB/Controllers/Preparation/PreparationController.cs:1267-1302` ; `REP/PreparationRepository.cs:1020-1111` ; `legacy-coordination.md §5.3` (ancien ID provisoire RG-COO-060) · spec [PC] p.1 ; [PP] §3, §12 (EX-COO-020) ; EX-EXI-030, EX-EXI-070
- Questions liées : Q-004, Q-200, Q-206
- Implémentation : apps/api/src/modules/coordination/statuts.ts:TRANSITIONS_INSTRUCTION_UTILISATEUR / SYSTEME ; instructions.ts:changerStatutInstruction — PARTIEL : COO-P01 (2026-11-04) : table explicite, 409 hors table ; reste EN_COURS → INSTRUCTION_OK (COO-P02) et INSTRUCTION_OK ↔ PRET_A_PRODUIRE (coo2, export des trains)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts ; apps/api/src/modules/coordination/statuts.test.ts ; e2e/coordination-socle.spec.ts

### RG-COO-041 — Création et mise à jour de l'instruction à l'intégration (statut initial, renvois ignorés)
- Origine : CONSERVÉE
- Énoncé : une instruction nouvelle (type `contrat` ou `reseau`) est créée au statut `EN_COURS` (1) avec entretien par défaut 8 %, position standard (0) et `tsr_repart_code = 0` ; les chapeaux d'instruction manquants (faces reçues sans instructions) sont créés au statut `A_TRAITER` (0), type `contrat`, utilisateur « BC ». Si l'instruction existe : statut 2 (Instruction ok) ou 5 (A imprimer) → ignorée ; statut 4 (Annulé) → non mise à jour ; statut 3 (Erreur) → repasse à 1 ; autres → annonceur et commentaire Broadcast mis à jour et statut remis à 1. Les ignorés ne sont plus silencieux dans la cible (RG-COO-053).
- Déclencheur : traitement d'intégration des trains/instructions (RG-COO-131).
- Conditions : `sect_code_centre` non nul ; `talr_trait = '1'`.
- Effet / message d'erreur : insert/update de l'instruction ; annule-et-remplace des détails ; mise à jour des visuels (thème, pourcentage) ; transitions 3 → 1, 0/1 → 1 ; 2/4/5 → inchangé.
- Sources : legacy `SQL/p_integ_instructions.sql:175-259,274-284,578-590` ; `SQL/p_integ_train_affiches.sql:155-221` (ancien ID provisoire RG-COO-047, RG-COO-049) · spec [PC] p.1 ; [PP] §3 ; EX-EXI-018 (EX-COO-020)
- Questions liées : Q-216
- Implémentation : apps/api/src/modules/coordination/integration.ts:integrerInstruction, creerChapeauATraiter — FAIT : COO-P01 (2026-11-04) : fonctions de service appelées par l’alimentation (étape 8) ; HYPOTHÈSE Q-182 (5, 6, 7)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts ; apps/api/src/modules/coordination/statuts.test.ts

### RG-COO-042 — Instruction OK automatique (règle de Nariman)
- Origine : MODIFIÉE
- Énoncé : pour chaque ligne atelier × plateforme du déroulant à l'état `EN_COURS`, si (1) il n'y a pas de commentaire de prépa ET (2) le nombre d'exceptions est égal à la quantité (hors entretien), l'instruction passe automatiquement à `INSTRUCTION_OK` (mode AUTO, `iok_par` = « règle automatique », pas un nom de personne) ; Circé répartit les thèmes sur les trains et crée l'entretien (calcul : coo2). Sinon elle reste « En cours » (RG-COO-044). Marquage : « Instruction ok · automatique ».
- Déclencheur : Q-204 TRANCHÉE le 2026-11-04 (décision de l'utilisateur) : option (b), dès l'arrivée de la prépa (intégration de la prépa ou d'une instruction d'un dossier dont la prépa est reçue), avec réouverture sur renvoi avant l'export (RG-COO-054).
- Conditions : prépa reçue (RG-COO-052) ; commentaire vide ; exceptions = quantité hors entretien ; répartition à 100 % (RG-COO-043) ; trains non exportés ; version à jour.
- Effet / message d'erreur : transition `EN_COURS → INSTRUCTION_OK`, historique « Instruction ok automatique » ; si le moment n'est pas tranché, la règle est implémentée comme fonction pure testable, branchée sur le déclencheur retenu (Q-204). MODIFIÉE : legacy = batch `p_batch_auto_instruction_ok` (condition : commentaire vide ET quantité attendue = quantité réceptionnée), non déployé d'après le `.sqlproj` (Q-006) ; ateliers (EX-COO-508) : « commentaire vide » seul.
- Sources : legacy `SQL/p_batch_auto_instruction_ok.sql:19-37,156-166,193-249,300-307` ; `BLL/TrainListeInstructionBll.cs:333-340` (ancien ID provisoire RG-INT-042 c) · spec [PC] p.1 ; [PP] §1, §4 ; [RA] RG-IOK-01, RG-IOK-02 (EX-COO-018, EX-COO-022) ; ateliers EX-COO-508 ; EX-EXI-032 ; écran ECR-COO-01
- Questions liées : Q-204, Q-205, Q-006
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:motifsNariman, evaluerInstructionOkAuto ; integration.ts — FAIT : COO-P02 (2026-11-04) : Q-204 TRANCHÉE (b) ; HYPOTHÈSES Q-183 (1, 8, 11, 13, 15) ; calcul des trains : coo2
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; apps/api/src/modules/coordination/instruction-ok.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — la règle Nariman est appelée à l'Instruction OK manuelle / intégration et par la tâche planifiée INSTRUCTION_OK_AUTO (D-20, rattrapage) désactivée par défaut : `p_batch_auto_instruction_ok` inconnu (Q-006, Q-410)

### RG-COO-043 — Répartition des thèmes à 100 % exigée pour l'Instruction OK
- Origine : CONSERVÉE
- Énoncé : l'Instruction OK (automatique ou manuelle) est refusée si, pour au moins un couple (dimension, type de préparation), la somme des pourcentages de thèmes est différente de 100. L'automatisme fait ce contrôle lui-même. (Le legacy ne l'applique que dans l'écran Train ; l'écran Préparation a un contrôle factice qui renvoie toujours vrai : défaut à ne pas reproduire.)
- Déclencheur : enregistrement d'une instruction avec statut cible `INSTRUCTION_OK` ; règle automatique.
- Conditions : Σ pourcentages = 100 par (dimension, type de préparation).
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-043' }` « La répartition des thèmes n'est pas à 100 % ! » ; en automatique : l'instruction reste « En cours ».
- Sources : legacy `BLL/TrainListeInstructionBll.cs:333-341,472-480` ; `WEB/Controllers/Preparation/PreparationController.cs:1262-1265,1361-1365` (ancien ID provisoire RG-COO-063) · spec [PP] §4, §10 (EX-COO-023) ; EX-EXI-031, EX-EXI-032
- Questions liées : Q-205
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:repartitionA100 — FAIT : COO-P02 (2026-11-04) : HYPOTHÈSE Q-183 (2)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-044 — Instruction OK manuelle (après contrôle) par la Coordination
- Origine : MODIFIÉE
- Énoncé : un dossier `EN_COURS` (commentaire de prépa non vide ou écart de quantité) est traité par la Coordination : lecture du commentaire, contrôle des quantités, des exceptions, de l'entretien et des positions (souvent « début » ou « fin » de train), puis action « Instruction OK (après contrôle) » (individuelle ou groupée) qui pose `INSTRUCTION_OK` mode MANUEL avec `iok_par` (nom) et `iok_le`. Le motif « En cours » (commentaire, écart) est affiché. L'action déclenche le calcul des trains (coo2) puis les fige.
- Déclencheur : action « Instruction OK (après contrôle) » ; `Idempotency-Key` + `version`.
- Conditions : rôle `coord`/`admin` (RG-COO-009) ; statut `EN_COURS` ; prépa reçue ; répartition à 100 % (RG-COO-043) ; trains non exportés.
- Effet / message d'erreur : 409 si statut ≠ `EN_COURS` ou si `ANNULE`/`PRET_A_PRODUIRE` ; 422 si 100 % non respecté ; toast « n dossier(s) en Instruction OK : Circé répartit les visuels sur les trains et crée l'entretien. Les trains partent à l'export du jeudi 14 h (Liste des trains). ». MODIFIÉE : legacy = statut appliqué sans contrôle de transition ; seul le changement vers 2 ou 4 est historisé.
- Sources : legacy `BLL/TrainListeInstructionBll.cs:199-263,321-383,392-437` ; `REP/PreparationRepository.cs:1020-1111` (ancien ID provisoire RG-COO-060, 061, 064) · spec [PC] p.1-2 ; [PP] §4 (EX-COO-019) ; EX-EXI-031, EX-EXI-032 ; écran ECR-COO-01, ECR-COO-02
- Questions liées : Q-206
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:instructionOkManuelle ; apps/web/src/components/coordination/fiche-dossier.tsx ; routes/coordination/index.tsx — FAIT : COO-P02 (2026-11-04) : individuelle ou groupée, tout ou rien (Q-183 (5))
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-045 — Annulation d'un dossier / d'une instruction (« Annulé »)
- Origine : CONSERVÉE
- Énoncé : la Coordination peut passer une instruction à `ANNULE` (« pas à produire », ex. dossiers S48, S54) depuis `A_TRAITER`, `EN_COURS` ou `INSTRUCTION_OK`, tant que les trains ne sont pas exportés ; après l'export (`PRET_A_PRODUIRE`) l'annulation n'est plus possible depuis cet écran (annulation de thème : coo2). Retour possible `ANNULE → A_TRAITER` (legacy). Un dossier annulé : pastille de préparation « Annulé », validation admin « — » (sans objet), aucune ligne attendue active.
- Déclencheur : action « Annulé » ; DA annulée côté Broadcast (RG-COO-087).
- Conditions : rôle autorisé ; statut source ∈ {0, 1, 2} ; trains non exportés.
- Effet / message d'erreur : 409 depuis `PRET_A_PRODUIRE` ; historique ; pour `INSTRUCTION_OK → ANNULE` : calcul des trains effacé (RG-COO-046).
- Sources : legacy `WEB/Controllers/PreparationDeroulants/PreparationDeroulantsController.cs:1507-1542` ; `legacy-coordination.md §5.3` (ancien ID provisoire RG-COO-060) · spec [PC] p.1-2 ; [PP] §4 (EX-COO-019, EX-COO-020) ; EX-EXI-030
- Questions liées : Q-004
- Implémentation : apps/api/src/modules/coordination/instructions.ts:changerStatutInstruction — FAIT : COO-P01 (2026-11-04) : annuler (0, 1, 2 → 4) et remettre à traiter (4 → 0) ; 409 depuis PRET_A_PRODUIRE
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts ; apps/api/src/modules/coordination/statuts.test.ts ; e2e/coordination-socle.spec.ts

### RG-COO-046 — Retour arrière d'une instruction : effacement du calcul des trains
- Origine : CONSERVÉE
- Énoncé : repasser une instruction de `INSTRUCTION_OK` à `EN_COURS` (1), `A_TRAITER` (0) ou `ANNULE` (4) supprime les faces d'entretien non « à imprimer » et remet à blanc (thème, repiquage, train, version vidés ; statut = code demandé) les faces non au statut `PRET_A_PRODUIRE` ; les faces déjà « A imprimer » sont conservées. Une instruction au statut 5 n'est jamais soumise à ce retour.
- Déclencheur : changement de statut de l'instruction (hors 5).
- Conditions : instruction initiale ≠ 5 ; changement effectif de statut.
- Effet / message d'erreur : transaction unique statut + effacement ; effets sur faces : coo2 (RG-COO-2xx, pont) ; 409 si statut initial = 5.
- Sources : legacy `SQL/p_u_statut_preparation.sql:24-64` ; `BLL/TrainListeInstructionBll.cs:372-380,396-403` (ancien ID provisoire RG-COO-064) · spec [PP] §3, §12 ; EX-EXI-030 (EX-COO-020, EX-COO-021)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/instructions.ts:effacerCalculTrains — FAIT : COO-P01 (2026-11-04) : source p_u_statut_preparation.sql:24-64 ; HYPOTHÈSE Q-182 (3)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts ; apps/api/src/modules/coordination/statuts.test.ts ; e2e/coordination-socle.spec.ts

### RG-COO-047 — Instruction OK fige la saisie : annonceur, entretien, position
- Origine : CONSERVÉE
- Énoncé : tant que le statut est `INSTRUCTION_OK` ou `PRET_A_PRODUIRE`, les champs annonceur, entretien (%) et position ne sont plus modifiables ; seuls le commentaire et le statut le restent. Le contrôle est fait côté serveur (le legacy se fie à une valeur postée par le front). Hors blocage, une modification d'annonceur se répercute sur toutes les faces de l'instruction.
- Déclencheur : enregistrement d'une instruction.
- Conditions : statut ∈ {2, 5}.
- Effet / message d'erreur : 409 `{ regle: 'RG-COO-047' }` si champ gelé modifié ; message maquette : « Entretien repris de Broadcast : modifiable seulement quand l'Instruction OK se fait après contrôle (dossier « En cours »). »
- Sources : legacy `WEB/Controllers/PreparationDeroulants/PreparationDeroulantsController.cs:1096` ; `REP/PreparationRepository.cs:1046-1055,1084-1103` ; `BLL/TrainListeInstructionBll.cs:405-428` (ancien ID provisoire RG-COO-062) · spec [PP] §3 ; EX-EXI-031 (EX-COO-021) ; écran ECR-COO-02 (champ Entretien)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/edition.ts:modifierInstruction — FAIT : COO-P02 (2026-11-04) : HYPOTHÈSE Q-183 (6)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-048 — Entretien : repris de Broadcast, 8 % par défaut, campagne contrôlée 15 %
- Origine : MODIFIÉE
- Énoncé : le % d'entretien saisi dans Broadcast est repris à l'intégration sans ressaisie (cible) ; à défaut (prépa pas encore envoyée) 8 % ; campagne contrôlée : 15 % et visuel en tête de train. Le champ « Entretien (%) » (0 à 30) n'est modifiable par la Coordination que si l'Instruction OK se fait après contrôle (dossier `EN_COURS`). Le calcul d'entretien par afficheur (rien sous 3 affiches, sinon % arrondi au supérieur) est de la compétence de coo2.
- Déclencheur : intégration de l'instruction ; saisie dans la fiche dossier.
- Conditions : valeur numérique 0 à 30 ; statut `EN_COURS` pour modification.
- Effet / message d'erreur : `instr_entretien` ; 422 hors bornes. MODIFIÉE : legacy = 8 % par défaut, ressaisi à la main par la Pré-Prod ; fixe/pliage : quantité d'entretien fournie par Broadcast.
- Sources : legacy `SQL/p_integ_instructions.sql:175-259` (entretien 8 par défaut) ; `SQL/p_integ_preparation.sql:121,160` · spec ateliers EX-COO-501, EX-COO-508 (A14 slide 32 #3) ; [PP] §4, §10 (EX-COO-023) ; EX-EXI-075 ; écran ECR-COO-02
- Questions liées : Q-224
- Implémentation : apps/api/src/modules/coordination/edition.ts:modifierInstruction ; integration.ts (entretien repris de Broadcast) — PARTIEL : COO-P02 (2026-11-04) : bornes, « En cours » seulement, repris de Broadcast ; reste 15 % campagne contrôlée (Q-257 ouverte)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-049 — Répartition par thème reprise de Broadcast et position 1 d'une campagne contrôlée
- Origine : NOUVELLE
- Énoncé : à l'intégration d'une instruction, la répartition par thème (pourcentages) de Broadcast est reprise sans ressaisie ; une campagne contrôlée place son thème en position 1 (début de train). Ceci évite la ressaisie de la répartition et le changement manuel de position.
- Déclencheur : intégration de l'instruction.
- Conditions : `campagne_controlee = vrai` pour la position 1.
- Effet / message d'erreur : `instruction_visuels.insv_pourcentage` initialisé avec Broadcast (`_ori` conservé) ; position A (début) pour la campagne contrôlée.
- Sources : spec ateliers EX-COO-508, EX-COO-501 (A14 slide 32 #3, S L77) ; [DC] ; contradiction ateliers 6 (re-saisie « bloquante mais non nécessaire »)
- Questions liées : Q-205
- Implémentation : apps/api/src/modules/coordination/integration.ts:remplacerDetailsEtVisuels — PARTIEL : COO-P02 (2026-11-04) : répartition reprise (_ori conservé) ; reste la position 1 d’une campagne contrôlée (Q-257)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts

### RG-COO-050 — Valeurs de position d'une instruction
- Origine : CONSERVÉE
- Énoncé : la position d'une instruction (`tip_ins_code`) prend les valeurs : 0 standard (rang proposé), 1 début de train (ordre 0), 2 fin de train (ordre 99), 3 fin-1 (ordre 98), 4 milieu (ordre 15). La Coordination peut la changer tant que l'instruction est `EN_COURS`. Le calcul de l'ordre dans les trains est de la compétence de coo2.
- Déclencheur : saisie de la position ; Instruction OK.
- Conditions : valeur ∈ {0, 1, 2, 3, 4} ; statut `EN_COURS` pour la modification (RG-COO-047).
- Effet / message d'erreur : 422 si valeur hors liste ; historique « ModificationInstructionPlus ».
- Sources : legacy `SQL/p_u_associe_train.sql:132-157` ; `Enums.cs:274-286` (ancien ID provisoire RG-COO-065) · spec [PC] p.1-2 (« positions souvent début ou fin de train ») (EX-COO-019) ; écran ECR-COO-02 (Position A-D) ; bdd.md §6
- Questions liées : Q-224
- Implémentation : apps/api/src/modules/coordination/edition.ts:modifierInstruction — FAIT : COO-P02 (2026-11-04) : positions 0 à 4, « En cours » seulement, journal ModificationInstructionPlus
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts

### RG-COO-051 — Grain de l'Instruction OK : atelier × plateforme
- Origine : CONSERVÉE
- Énoncé : l'Instruction OK se fait par ligne atelier × plateforme (ex. 2 m² Wissous, 2 m² Nîmes) : clé d'instruction dossier × semaine × atelier ; l'autre plateforme d'un même format se retrouve par substitution d'atelier (5↔6, 7↔8). L'écran ECR-COO-01 affiche une ligne par dossier en agrégeant les instructions de ses ateliers (HYPOTHÈSE Q-206) ; l'action groupée s'applique à toutes les instructions `EN_COURS` du dossier. Changement de statut appliqué ensemble à plusieurs ateliers cochés (5, 6, 7, 8, 11, 12).
- Déclencheur : lecture/enregistrement des instructions.
- Conditions : ateliers rattachés à l'utilisateur (RG-COO-167).
- Effet / message d'erreur : agrégation du statut du dossier : `EN_COURS` s'il reste une instruction `EN_COURS`.
- Sources : legacy `SQL/p_integ_instructions.sql:155-158,559-562` ; `BLL/TrainListeInstructionBll.cs:526-562,266-275` (ancien ID provisoire RG-COO-046, 061 ; note `Substring(8,1)` à corriger pour les ateliers 11/12) · spec [PP] §10 (EX-COO-049) ; écran ECR-COO-01
- Questions liées : Q-206
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:instructionOkManuelle ; dossiers.ts (agrégation par dossier) — FAIT : COO-P02 (2026-11-04) : grain dossier × semaine × atelier (Q-206), écart par plateforme (Q-183 (11))
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts

### RG-COO-052 — Pas d'Instruction OK avant la prépa
- Origine : NOUVELLE
- Énoncé : une instruction ne peut pas passer `INSTRUCTION_OK` tant que la prépa du dossier n'est pas reçue (état « ATTENTE » : « À traiter · prépa pas reçue »). L'idée d'une Instruction OK avant la prépa est abandonnée.
- Déclencheur : toute tentative de passage à `INSTRUCTION_OK`.
- Conditions : `statut_preparation = PREPARATION_RECUE`.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-052' }` ; l'instruction affichée « À traiter · prépa pas reçue » (Info).
- Sources : spec [PC] p.1 ; [PP] §2 (« Pas d'Instruction OK avant la prépa (abandonné ») (EX-COO-026) ; écran ECR-COO-01 (colonne Instruction OK)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:passerInstructionOk ; dossiers.ts (action proposée après la prépa) — FAIT : COO-P02 (2026-11-04)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts

### RG-COO-053 — Renvoi de Broadcast après l'Instruction OK ou l'export : ignoré mais signalé
- Origine : MODIFIÉE
- Énoncé : les instructions et faces renvoyées par Broadcast alors que l'instruction est à un statut ≥ 2 sont ignorées (aucune mise à jour des trains figés) ; la cible ajoute une alerte à la Coordination (et aux chefs d'équipe après l'export), au lieu de l'oubli silencieux du legacy. Après l'export du jeudi 14 h, les trains exportés ne changent pas.
- Déclencheur : intégration d'une instruction/face dont l'instruction est à 2, 4 ou 5.
- Conditions : statut ∈ {2, 4, 5} (4 : ignoré sans alerte).
- Effet / message d'erreur : alerte « Rajout après préparation » / `APRES_LIBERATION` (serious) si export fait ; écart visible dans ECR-COO-01 (RG-COO-067). MODIFIÉE : legacy RG-COO-047/049 = ignoré silencieusement.
- Sources : legacy `SQL/p_integ_instructions.sql:578-590` ; `SQL/p_integ_train_affiches.sql:38-48,119-138` (ancien ID provisoire RG-COO-047, 049) · spec [PP] §4, §9, §10 (EX-COO-022) ; EX-EXI-033 ; maquette `app.js` `renvoiPrepa`
- Questions liées : Q-204, Q-216
- Implémentation : apps/api/src/modules/coordination/integration.ts:integrerInstruction (journal RENVOI_BROADCAST_IGNORE) — PARTIEL : COO-P01/P02 (2026-11-04) : renvoi après l’export ignoré et tracé ; alerte « Rajout après préparation » : COO-P05
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-054 — Renvoi de prépa avant l'export : réouverture de l'Instruction OK
- Origine : NOUVELLE
- Énoncé : si Broadcast renvoie la prépa d'un dossier alors que les trains ne sont pas exportés, l'Instruction OK du dossier est rouverte (statut `EN_COURS`, calcul des trains recalculé) tandis que la validation admin ne bouge pas. Règle de la maquette ; option (b) de Q-204.
- Déclencheur : arrivée d'un renvoi de prépa (jalon 5 : « renvoi de Broadcast avant jeudi 14 h »).
- Conditions : instruction à `INSTRUCTION_OK` ; trains non exportés ; Q-204 tranchée en faveur de (b).
- Effet / message d'erreur : `INSTRUCTION_OK → EN_COURS` ; `iok` supprimé ; historique ; Q-204 TRANCHÉE le 2026-11-04 (option b, décision de l'utilisateur) : implémentée en COO-P02 (renvoi après l'export : RG-COO-053).
- Sources : spec [PP] §2 jalon 5, §10 (EX-COO-044, EX-COO-022) ; maquette `app.js` `renvoiPrepa` (§1.4 point 9) ; `maquettes-autres-modules.md §A`
- Questions liées : Q-204
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:rouvrirInstructionOk ; integration.ts — FAIT : COO-P02 (2026-11-04) : Q-204 TRANCHÉE (b) ; HYPOTHÈSE Q-183 (13)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-055 — Écart Broadcast / Circé : calcul
- Origine : NOUVELLE
- Énoncé : l'écart d'un dossier est `qte_BC − qte_Circé` (signé) ; il est non nul lorsque la quantité ou le thème sont modifiés dans Broadcast après l'envoi, ou que la prépa diffère de ce qui est reçu. À l'arrivée de la prépa, la ligne bascule en gardant son lien ; seul un écart de thème ou de quantité lève l'alerte (RG-COO-086). Un écart non nul rend l'instruction « En cours » (motif « écart ») et affiche une pastille Critique.
- Déclencheur : lecture de Broadcast ; arrivée de la prépa.
- Conditions : `qte_bc` et `qte_circe` comparables au grain de la ligne (Q-206, Q-209).
- Effet / message d'erreur : colonne « Écart BC / Circé » ; filtre « Écart Broadcast / Circé » ; alerte RG-COO-067.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 ; [RA] RG-AT-05 (EX-COO-028) ; écran ECR-COO-01 (`qteBCInfo{bc,circe,date}`) ; EX-EXI-019 (quantité non recalculée à la bascule, écart non signalé : défaut legacy corrigé)
- Questions liées : Q-209, Q-210
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:ecartDossier ; dossiers.ts ; apps/web/src/routes/coordination/index.tsx — PARTIEL : COO-P02 (2026-11-04) : calcul, colonne, motif « écart », filtre À faire ; HYPOTHÈSES Q-183 (3, 11, 12) ; reste l’alerte RG-COO-067 (COO-P05)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-056 — « Appliquer la version Broadcast » (annule et remplace)
- Origine : NOUVELLE
- Énoncé : pour un écart dû à une erreur, l'action « Appliquer la version Broadcast » aligne Circé sur Broadcast : `qte_BC` remplace la quantité Circé (annule et remplace), recalcul des trains non produits, trains déjà en production signalés à l'atelier. Réservée à `coord`/`admin`. L'action lève l'alerte « Écart Broadcast / Circé ».
- Déclencheur : bouton dans la fiche dossier (écart critique).
- Conditions : instruction non exportée pour le recalcul ; pour un train en production : signalement sans modification (point de non-retour).
- Effet / message d'erreur : transaction unique ; historique ; 403 hors rôle ; 409 si version périmée.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 (EX-COO-019, EX-COO-028) ; écran ECR-COO-02 (« Appliquer la version Broadcast ») ; ateliers EX-TRA-514 (« annule et remplace »)
- Questions liées : Q-225
- Implémentation : apps/api/src/modules/coordination/edition.ts:appliquerVersionBroadcast — PARTIEL : COO-P02 (2026-11-04) : quantité annule et remplace, statut des lignes recalculé (RG-X-064), périmètre ; reste le thème (Q-225), le recalcul / signalement des trains (coo2) et la levée de l’alerte (COO-P05)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-057 — « Demander une correction à Broadcast » (mail à la Pré-Prod)
- Origine : NOUVELLE
- Énoncé : l'action ouvre une modale avec un champ « Qu'y a-t-il à corriger ? » (texte libre, facultatif) et envoie un mail « [Circé] Correction à faire dans Broadcast : dossier n (annonceur) » aux gestionnaires du pôle du dossier (Pré-Prod · gestionnaires <pôle>, liste de distribution, Q-220) ; l'état du dossier ne change pas ; la demande est tracée (date, utilisateur, note) ; si une demande existe déjà, la modale indique « Une demande est déjà partie le … Le mail sera renvoyé. » ; si la production est lancée : « Production lancée — Prévenez aussi l'atelier ». Circé ne peut pas écrire dans Broadcast : le mail est le seul canal.
- Déclencheur : bouton « Demander une correction à Broadcast » ; `Idempotency-Key`.
- Conditions : rôle autorisé ; dossier existant.
- Effet / message d'erreur : mail envoyé après commit (échec d'envoi tracé, n'annule pas la demande, Q-219) ; historique.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 ; EX-TRA-030, EX-TRA-039 (EX-COO-019, EX-COO-028) ; écran ECR-COO-04
- Questions liées : Q-219, Q-220
- Implémentation : apps/api/src/modules/coordination/edition.ts:demanderCorrection ; integration.ts (FAITE) ; apps/web/src/components/coordination/modale-correction.tsx — PARTIEL : COO-P02 (2026-11-04) : demande tracée, renvoi signalé, FAITE à la prépa suivante (Q-183 (17)) ; reste l’envoi du mail (Q-375) et « Production lancée » (coo2)
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-058 — Écart dû à « reste en place » : constat puis Instruction OK
- Origine : NOUVELLE
- Énoncé : si l'écart provient d'un thème « reste en place » (non livré), la Coordination constate l'écart puis passe l'Instruction OK ; proposition à valider (Q63) : si écart = quantité « reste en place » (même dossier, plateforme, semaine), l'Instruction OK devient automatique. Les thèmes « ne pas afficher » / « reste en place » sont exclus automatiquement de la préparation (tag, aucune production).
- Déclencheur : calcul de l'écart (RG-COO-055).
- Conditions : `EstResteEnPlace` conservé de Broadcast (RG-COO-092).
- Effet / message d'erreur : si la proposition est retenue : `EN_COURS → INSTRUCTION_OK` automatique ; sinon action manuelle (RG-COO-044). Non implémenté par défaut (Q-224).
- Sources : spec [PP] §4, §10 ; ateliers EX-COO-502, EX-COO-509 (A14 slide 32 #4) (EX-COO-019, EX-COO-023)
- Questions liées : Q-224, Q-209
- Implémentation : — (Instruction OK manuelle, RG-COO-044) — PARTIEL : COO-P02 (2026-11-04) : proposition « reste en place automatique » non retenue (Q-209, Q-224) ; voir Q-183 (16)
- Tests : —
- Statut matrice (audit final, étape 10, 2026-11-06) : NON REPRIS — décision à valider (Q-209, Q-224) (avant : PARTIEL) — proposition « reste en place automatique » non retenue ; l'Instruction OK reste manuelle (RG-COO-044) ; aucun test ne porte l'identifiant

### RG-COO-059 — Commentaire de prépa libre : affichage et proposition de position
- Origine : NOUVELLE
- Énoncé : le commentaire de prépa est affiché dans la liste « En cours » (colonne masquée disponible) ; si le commentaire demande « début » ou « fin » de train, Circé propose la position correspondante, la Coordination confirme (jamais appliquée seule). Le commentaire rend l'instruction non automatique (RG-COO-042).
- Déclencheur : intégration de l'instruction ; lecture de la fiche dossier.
- Conditions : commentaire non vide.
- Effet / message d'erreur : proposition = information, aucune écriture sans action de la Coordination.
- Sources : spec [PP] §4, §10 ; EX-EXI-031 (EX-COO-023) ; écran ECR-COO-01 (commentaires de prépa MOCK, `Visuel B en tête de train…`)
- Questions liées : Q-224
- Implémentation : apps/api/src/modules/coordination/edition.ts:positionProposee ; apps/web/src/components/coordination/fiche-dossier.tsx — FAIT : COO-P02 (2026-11-04) : proposition jamais appliquée (Q-183 (7))
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; apps/api/src/modules/coordination/instruction-ok.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-060 — Un seul écran de liste d'instructions, filtre « À faire (Coordination) »
- Origine : MODIFIÉE
- Énoncé : un seul écran couvre « Validation admin et Instruction OK » (Pré-production, tous ateliers) et « Liste des instructions » (Déroulant, `?pour=deroulant`), une ligne par dossier. Filtre « À faire (Coordination) » (défaut : Validation admin à confirmer + Instruction OK en cours + Écart Broadcast / Circé ; autre valeur « Rien à faire »). Libellés « un mot, un sens » : « À traiter » désigne la préparation du dossier ; l'instruction non encore traitée s'affiche « À traiter · prépa pas reçue ». MODIFIÉE : le legacy a deux écrans de liste d'instructions avec des listes de statuts différentes (`TrainListeInstruction` : 1, 2, 4 ; `PreparationDeroulants` : table 0→{0,1,4}, 1→{1,2,4}, 2→{2,1,4}, 4→{4,0}).
- Déclencheur : ouverture de l'écran.
- Conditions : périmètre RG-COO-167 ; défaut semaine suivante dans le legacy, filtre « Départ » dans la cible.
- Effet / message d'erreur : liste unique ; actions groupées selon RG-COO-010, 044.
- Sources : legacy `BLL/TrainListeInstructionBll.cs:199-275` ; `WEB/Views/Shared/_MenuNew.cshtml:84-87` (ancien ID provisoire RG-COO-061) · spec [README] §3, [DESIGN] §11 (EX-COO-050, EX-COO-020) ; ateliers EX-COO-504 (APPFR-1143) ; écran ECR-COO-01
- Questions liées : Q-206, Q-200
- Implémentation : apps/api/src/modules/coordination/dossiers.ts (aFaire) ; apps/web/src/routes/coordination/index.tsx — PARTIEL : COO-P02 (2026-11-04) : filtre « À faire » (Instruction OK, écart) par défaut ; reste la validation admin (COO-P03) et la variante ?pour=deroulant
- Tests : apps/api/test/coordination/instruction-ok.int.test.ts ; apps/api/test/coordination/instruction-ok-complement.int.test.ts ; e2e/coordination-instruction-ok.spec.ts

### RG-COO-061 — Historique de tout changement de statut d'instruction / de dossier
- Origine : MODIFIÉE
- Énoncé : tout changement de statut d'une instruction (y compris par un traitement automatique) et tout changement de statut de préparation d'un dossier écrit une ligne d'historique (ancien → nouveau, acteur nominatif ou « Circé (automatique) » pour les traitements, date). MODIFIÉE : legacy = historisation seulement vers 2 ou 4 (`ChangementStatutInstruction`) et aucun historique pour les batchs (`tt_log` / `FluxChargement` seulement).
- Déclencheur : toute transition de la section 3.2.
- Conditions : écriture dans la même transaction que le changement.
- Effet / message d'erreur : l'échec d'écriture de l'historique annule le changement.
- Sources : legacy `BLL/HistorisationBll.cs:16-127` (ancien ID provisoire RG-INT-046) · spec [README] §2.6 ; EX-TRA-034 ; règle projet CLAUDE.md §6 ; bdd.md §5 (absence d'historique de statut pour la coordination)
- Questions liées : Q-004
- Implémentation : apps/api/src/modules/coordination/instructions.ts, integration.ts (ecrireHistoriqueStatut dans la transaction) — FAIT : COO-P01 (2026-11-04) : instruction et dossier, acteur nominatif ou « Circé (automatique) »
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-062 — Dossier annulé : sans objet pour la validation admin et l'Instruction OK
- Origine : NOUVELLE
- Énoncé : un dossier annulé (vente annulée) affiche « Annulé » en préparation, « — » en validation admin et « — » en Instruction OK ; aucune alerte de coordination (validation à confirmer, préparation non reçue, écart) n'est levée pour lui ; les affiches déjà reçues restent en stock (RG-X-065).
- Déclencheur : annulation de la DA/vente par Broadcast.
- Conditions : `statut_preparation = ANNULE`.
- Effet / message d'erreur : alertes existantes du dossier levées ; filtre « À faire » l'exclut.
- Sources : maquette ECR-COO-01 (statuts affichés, dossier annulé WIS) ; [PC] p.1 (Annulé) (EX-COO-013)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/integration.ts:annulerDossier ; dossiers.ts (aucune action) ; instructions.ts (409) — PARTIEL : COO-P01 (2026-11-04) : dossier ANNULE, Instruction OK « — », HYPOTHÈSE Q-182 (4, 9) ; reste la pastille de validation « — » (COO-P03) et la levée des alertes (COO-P05)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts ; e2e/coordination-socle.spec.ts

### RG-COO-063 — Envoi de la prépa : statut de préparation du dossier
- Origine : MODIFIÉE
- Énoncé : le gestionnaire envoie la prépa depuis Broadcast (le lundi : thèmes, exceptions, commentaire) ; à son intégration, le dossier passe `A_TRAITER → PREPARATION_RECUE` (posé par Circé, jamais par un utilisateur de Circé) et l'instruction passe `EN_COURS` (RG-COO-041). Dossier annulé : `ANNULE`. Un dossier ne revient pas à `A_TRAITER` ; un renvoi laisse `PREPARATION_RECUE` (RG-COO-054). La Pré-Prod ne suit plus l'aval.
- Déclencheur : intégration d'une prépa Broadcast (RG-COO-121, 131).
- Conditions : groupe de préparation Broadcast au statut « envoyé » (133) ; dossier non annulé.
- Effet / message d'erreur : historique (RG-COO-061) ; la pastille de validation admin ne change pas. MODIFIÉE : legacy = statut Broadcast « Envoyé » seulement, aucun statut de dossier côté Circé (le statut s'arrête à « Instruction OK », EX-EXI-072).
- Sources : legacy `SQL/p_integ_preparation.sql:100-147` ; `BLL/BatchAlimBll.cs:91-124` · spec [PC] p.1 ; [PP] §1, §2 (EX-COO-026) ; EX-EXI-016, EX-EXI-070, EX-EXI-072
- Questions liées : Q-200, Q-215
- Implémentation : apps/api/src/modules/coordination/integration.ts:integrerPreparation ; statuts.ts:TRANSITIONS_DOSSIER — FAIT : COO-P01 (2026-11-04) : posé par Circé seulement (aucune route) ; HYPOTHÈSE Q-182 (10, 11)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts ; apps/api/src/modules/coordination/statuts.test.ts ; e2e/coordination-socle.spec.ts

### RG-COO-064 — La prépa n'est plus le feu vert de la validation admin
- Origine : MODIFIÉE
- Énoncé : l'arrivée de la prépa reste le feu vert de Broadcast (début du suivi de production) mais ne bloque plus le contrôle des affiches ni la validation admin (RG-COO-001). Aucune garde de validation ne lit `statut_preparation`.
- Déclencheur : validation d'une affiche (garde négative).
- Conditions : aucune.
- Effet / message d'erreur : test de rejet : validation acceptée avec dossier `A_TRAITER`.
- Sources : spec [PC] p.1 ; [PP] §1, §2 (EX-COO-026) ; EX-EXI-053
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:changerValidationCoordination (aucune garde sur la prépa) — FAIT : COO-P04 (2026-11-05) : validation acceptée avec un dossier À traiter
- Tests : apps/api/test/coordination/effets-validation.int.test.ts

### RG-COO-066 — Alerte « Préparation non reçue » (deadline jeudi S-2 16 h)
- Origine : NOUVELLE
- Énoncé : pour un dossier dont la prépa n'est pas reçue, une alerte à la Coordination (qui relance la Pré-Prod) est levée : gravité « À surveiller » (warning) avant la deadline, « Critique » (critical) si la deadline Pré-Prod est dépassée (« préparation absente après la deadline »). Deadline = jeudi S-2 à 16 h (S-2 par rapport à la semaine de départ ; maquette : « jeudi S-2 16h »). Se lève à l'arrivée de la prépa ou à l'annulation du dossier.
- Déclencheur : calcul planifié (au moins horaire) ; arrivée de la prépa.
- Conditions : dossier non annulé, `statut_preparation = A_TRAITER`, DA activée.
- Effet / message d'erreur : alerte clé `PP-<dossier>` ; teinte critique de la ligne (ECR-COO-01) ; destinataires `coord`.
- Sources : spec [PC] p.2 ; [DESIGN] §2.2 (EX-COO-027, EX-COO-047) ; EX-EXI-077 ; écran ECR-TRA-01 (`IP_MANQUANTES`), ECR-COO-01 (Deadline)
- Questions liées : Q-220, Q-222
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts:alertesCoordination (PP-), graviteDeadline ; apps/api/src/modules/coordination/dossiers.ts:ligneDossier (deadlinePrepa, deadlineDepassee) — FAIT : COO-P07 (2026-11-05) : alerte À surveiller puis Critique après la deadline (paramètre coordination.deadlinePrepa), départ S à S+2 (HYPOTHÈSE Q-190 (4)) ; ECR-COO-01 : « Pas encore envoyée · deadline jeu. 15/10 16h » et teinte critique
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts ; apps/api/src/modules/coordination/alertes-coordination.test.ts

### RG-COO-067 — Alerte « Écart Broadcast / Circé »
- Origine : NOUVELLE
- Énoncé : quantité ou thème modifiés dans Broadcast après l'envoi, ou prépa différente de ce qui est reçu, lèvent une alerte « Écart Broadcast / Circé » (gravité Important/serious) à la Coordination ; lien vers ECR-COO-01 filtré ; traitement par RG-COO-056 ou RG-COO-057 ; levée quand l'écart devient nul.
- Déclencheur : lecture de Broadcast ; arrivée de la prépa ; recalcul.
- Conditions : écart non nul (RG-COO-055) ; la correction d'intitulé faite par la plateforme (`corrPlateforme`, coo2) n'alerte pas.
- Effet / message d'erreur : alerte clé `BC-<dossier>`.
- Sources : spec [PC] p.2 ; [PP] encadré 02/11 ; [RA] RG-AT-05 (EX-COO-028, EX-COO-047) ; écran ECR-TRA-01 (`ECART_BC` → serious)
- Questions liées : Q-220
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts:alertesCoordination (BC-) — FAIT : COO-P07 (2026-11-05) : alerte Important si écart dossier ≠ 0 ou une ligne prépa ≠ Broadcast (RG-COO-086), levée quand l’écart est nul ; correction d’intitulé par la plateforme (corrPlateforme, coo2) non modélisée
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-068 — Alerte « Thème modifié dans Broadcast » et « Reprendre la version Broadcast »
- Origine : NOUVELLE
- Énoncé : un thème modifié dans Broadcast après la validation/l'Instruction OK lève une alerte : « Critique » si la production est lancée (l'atelier est prévenu par mail aux chefs d'équipe), « Important » avant la production. L'action « Reprendre la version Broadcast » remplace le thème de Circé par celui de Broadcast, historise, pose « Feuille à refaire » côté Réception (RG-X-057) et, si production lancée, envoie le mail à l'atelier. Reprise automatique ou après clic : à décider (Q-210).
- Déclencheur : comparaison à chaque mise à jour de la copie Broadcast ; clic « Reprendre la version Broadcast ».
- Conditions : thème Broadcast ≠ thème Circé (comparaison par identifiant, RG-COO-081).
- Effet / message d'erreur : alerte `TBC-…` ; toast « Thème « … » repris de Broadcast pour le dossier … Production lancée : l'atelier est prévenu. ».
- Sources : spec [PC] p.2 ; [README] §2.1, §3 (EX-COO-029, EX-COO-047, EX-COO-030) ; écran ECR-THM-03, ECR-COO-02 ; EX-THM-503 (ateliers)
- Questions liées : Q-210, Q-220
- Implémentation : apps/api/src/modules/coordination/themes.ts:lignesThemeModifie, listerThemesModifies, reprendreThemeBroadcast ; alertes-coordination.ts (TBC-) ; apps/web/src/routes/coordination/themes.tsx — PARTIEL : COO-P07 (2026-11-05) : comparaison thème de l’affiche (Circé) / thème de la ligne (Broadcast), alerte Critique si production lancée sinon Important, « Reprendre la version BC » sur clic (Q-210), historique, feuille à refaire ; fiche dossier : toutes les lignes du dossier reprises en une transaction (POST /api/coordination/themes/broadcast/reprendre-dossier, COO-P08) ; reste : mail aux chefs d’équipe de l’atelier (tracé, non envoyé : Q-375)
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts ; e2e/coordination-alertes.spec.ts

### RG-COO-069 — Vérification des thèmes proches entre dossiers
- Origine : NOUVELLE
- Énoncé : dès la saisie des IP, Circé compare les intitulés de thèmes d'un même annonceur de référence (ou groupe d'annonceurs proches non « différents ») : deux intitulés sont proches si, simplifiés (minuscules, sans accents ni ponctuation), identiques, ou l'un contenu dans l'autre (≥ 3 caractères, mots entiers), ou de similarité ≥ seuil 0,85 (paramétrable). Pour un groupe « À vérifier », deux réponses : « Demander la correction dans Broadcast » (mail au gestionnaire du pôle, un mail par pôle, l'état du dossier ne change pas) ou « Visuels différents » (lève l'alerte, rouvrable). Refus si la production est lancée sur tous les dossiers du groupe. Les thèmes sont comparés tant que non tranché.
- Déclencheur : lecture de Broadcast avec nouveaux thèmes ; actions utilisateur ; écran « Vérification des thèmes ».
- Conditions : thèmes de dossiers avec DA activée, départ ≥ semaine en cours ; rôle `coord`/`admin`.
- Effet / message d'erreur : statuts À vérifier / Demande envoyée / Corrigé par Broadcast / Visuels différents / Même intitulé ; messages « Demande envoyée pour n dossier(s) : mail au gestionnaire… », « Noté : ce sont des visuels différents. L'alerte est levée. », « Rien à demander… Voir avec l'atelier » ; le groupe disparaît quand Broadcast renvoie la prépa corrigée.
- Sources : spec [README] §2.1, §3 (PP-08, PP-09) (EX-COO-030) ; ateliers EX-COO-513, EX-THM-502 (A14 slide 30 #2) ; écran ECR-THM-01 ; `maquettes-autres-modules.md §4` ; EX-EXI-079
- Questions liées : Q-220, Q-210
- Implémentation : apps/api/src/modules/coordination/themes.ts:proches, listerThemesProches, demanderCorrectionTheme, trancherVerification ; alertes-coordination.ts (TH-) ; apps/web/src/routes/coordination/themes.tsx — PARTIEL : COO-P07 (2026-11-05) : règle de proximité (simplification, inclusion, similarité ≥ 0,85 paramétrable), groupes par annonceur de référence, statuts, demande par dossier (état inchangé), refus si production lancée, Visuels différents / Rouvrir, alerte ; reste : mail au gestionnaire du pôle (Q-375)
- Tests : apps/api/src/modules/coordination/themes.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts ; e2e/coordination-alertes.spec.ts

### RG-COO-070 — Vérification des annonceurs proches
- Origine : NOUVELLE
- Énoncé : dès la DA activée, Circé repère les annonceurs proches (même règle de proximité, regroupements d'enseignes `*MISTRAL*` → `MISTRAL` en paramètre) ; deux réponses : « Demander la correction » (source Broadcast : demande + mail au gestionnaire du pôle ; source plateforme fixe/colle : alignement du nom imprimé dans Circé) ou « Annonceurs différents » (les thèmes ne sont plus comparés entre eux, rouvrable). Aucun regroupement ajouté par Circé.
- Déclencheur : lecture de Broadcast ; actions utilisateur.
- Conditions : DA activée même sans réception.
- Effet / message d'erreur : statuts À vérifier / Demande envoyée / Corrigé / Annonceurs différents ; messages « Demande envoyée pour n dossier(s) ; n nom(s) imprimé(s) aligné(s)… » ; « Noté : ce sont des annonceurs différents… ».
- Sources : spec [README] §2.1, §3 (EX-COO-030) ; écran ECR-THM-02 ; ECR-ADM-05 (seuil, regroupements)
- Questions liées : Q-220
- Implémentation : apps/api/src/modules/coordination/themes.ts:regrouper, listerAnnonceursProches ; alertes-coordination.ts (AN-) — PARTIEL : COO-P07 (2026-11-05) : noms proches dès la DA activée, regroupements « *MISTRAL* » en paramètre, Annonceurs différents (thèmes non comparés), alerte ; reste : mail (Q-375) et alignement du nom imprimé par la plateforme (fixe / colle, FIX-15 : non modélisé, Q-190 (8))
- Tests : apps/api/src/modules/coordination/themes.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-071 — Alerte « Réception sur un dossier sans IP »
- Origine : NOUVELLE
- Énoncé : une réception sur un dossier dont les IP ne sont pas saisies (réception sur annonceur sans thème ; ligne attendue au visuel provisoire) lève une alerte à la Coordination (gravité grave = Important/serious), qui prévient la Pré-Prod ; elle se lève à la saisie des IP. Ce n'est pas une réception inconnue (le dossier existe dans Broadcast). La Pré-Prod garde autant que possible l'intitulé saisi par la plateforme qui a réceptionné en premier.
- Déclencheur : création d'une affiche rattachée à une ligne provisoire (RG-COO-084) ; recalcul.
- Conditions : au moins une affiche rattachée à une ligne `visuel provisoire`.
- Effet / message d'erreur : alerte clé `IP-<affiche>` ; destinataires `coord` ; lien vers ECR-COO-01 (colonne IP « Non saisies »).
- Sources : spec [PC] p.2 ; [DC] §7, §11 (EX-COO-031, EX-COO-047) ; EX-REC-042, EX-REC-065 ; ateliers EX-COO-512, EX-REC-516/519/520 (A14 slide 26, 34) ; écran ECR-TRA-01 (`SANS_IP`)
- Questions liées : Q-220
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts:alertesCoordination (IP-) — FAIT : COO-P07 (2026-11-05) : une alerte par affiche rattachée à une ligne provisoire / sans thème, Important, levée à la saisie des IP ; remplace RG-REC-184 dans Pilotage › Alertes (même exception, Q-190 (5))
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-072 — Alertes « Réception inconnue à identifier » et « Dossier introuvable » (côté Coordination)
- Origine : NOUVELLE
- Énoncé : (1) la création d'une réception inconnue lève dès la création l'alerte « Réception inconnue à identifier » (Coordination et Réception ; Important après 24 h, À surveiller avant) ; (2) le bouton « Signaler à la Coordination (alerte) » lève l'alerte « Dossier introuvable » (grave dès le signalement, destinataire Coordination du site, sans mail) et pose le statut « Introuvable : alerte à la Coordination ». Rattachée par la Coordination, l'affiche est validée (RG-COO-017) et les alertes se lèvent.
- Déclencheur : création d'une réception inconnue (REC) ; action « Signaler ».
- Conditions : affiche sans dossier rattaché ; délai 24 h paramétrable.
- Effet / message d'erreur : alertes `OR-…`, `DI-…` ; destinataire Nîmes : Coordination du site ou « Pré-Prod Nîmes » (Q-221). Définitions de création : RG-REC (EX-REC-035 à 041, 066, 067).
- Sources : spec [PP] §6 ; [PC] p.2 (EX-COO-017, EX-COO-047) ; EX-REC-036, EX-REC-041, EX-REC-066, EX-REC-067 ; écran ECR-REC-04, ECR-TRA-01
- Questions liées : Q-221, Q-220
- Implémentation : apps/api/src/modules/alertes/service.ts:listerAlertesPilotage (alertes RG-REC-185 / 186 reprises) — FAIT : COO-P07 (2026-11-05) : alertes Réception inconnue à identifier (Important après le délai) et Dossier introuvable reprises dans Pilotage › Alertes, destinataire Coordination du site (Q-221) ; levées au rattachement (RG-COO-017)
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — commentaire `// RG-COO-072` ajouté (alertes/service.ts, reception/alertes.ts) et identifiant ajouté aux tests existants : nominal R-09 (inconnue → alerte « Réception inconnue à identifier »), R-11 (« Dossier introuvable », signalement répété refusé 409), rejet audit-rec-2 (inconnue non signalée : pas de « Dossier introuvable »). FAIT conservé

### RG-COO-073 — Alerte « Rajout après préparation » (mail à la liste de distribution)
- Origine : NOUVELLE
- Énoncé : toute préparation (fixe et scro) envoyée dans Circé à partir de la nuit du jeudi au vendredi S-2 jusqu'au vendredi de la semaine S déclenche une alerte et un mail au chef d'atelier, aux admins de la plateforme et aux coordinateurs (liste de distribution « Rajouts après préparation – <site> » à établir dans Administration) ; aucun raccrochage automatique dans le train pour les trains restant à produire (l'atelier choisit fractionner ou raccrocher) ; mail conservé (H3).
- Déclencheur : intégration d'une prépa/instruction dans la fenêtre.
- Conditions : date d'intégration dans [jeudi→vendredi S-2 nuit ; vendredi S] (fenêtre à confirmer, Q-222) ; fixe : date d'envoi > date du 1er colisage (EX-FIX-503 : coo2).
- Effet / message d'erreur : alerte `APRES_LIBERATION` (serious) ; mail via liste de distribution ; échec d'envoi tracé.
- Sources : spec ateliers EX-COO-503, EX-ADM-504, EX-FIX-503 (A14 slide 33 #1, S L71) ; [DC] §11 (H3) ; EX-TRA-030 ; écran ECR-ADM-04, ECR-TRA-01 ; EX-EXI-078
- Questions liées : Q-222, Q-220
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts:alertesCoordination (RP-), lireFenetre — PARTIEL : COO-P07 (2026-11-05) : prépa intégrée dans la fenêtre (paramètre coordination.fenetreRajout, Q-222) → alerte Important ; reste : mail à la liste de distribution (Q-375, liste dans Administration D-08), critère fixe « date du 1er colisage » (colisage COO-P13)
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts ; apps/api/src/modules/coordination/alertes-coordination.test.ts

### RG-COO-074 — Alerte « Dernière minute sur fichier envoyé » (DM)
- Origine : NOUVELLE
- Énoncé : une dernière minute (DM) sur un train déjà en production (fichier scro validé) lève l'alerte `DM_FICHIER` (Critique) et un mail aux chefs d'équipe du déroulant ; la modification est tracée sur le train ; un fichier complémentaire est généré à part (sortie systématique en fractionné : coo2). Aujourd'hui aucune alerte n'existe pour une DM avec fichier scro validé.
- Déclencheur : intégration d'une instruction/face après le lancement de la production du train.
- Conditions : train `EN_PRODUCTION` (point de non-retour, coo2).
- Effet / message d'erreur : alerte critique ; traçabilité ; « Générer un complément » (générateur, autre agent).
- Sources : spec ateliers EX-COO-503, EX-COO-512 (A14 slide 33, 34) ; EX-EXI-078 ; écran ECR-TRA-01 (`DM_FICHIER`, critical), `maquettes-autres-modules.md §A` point 3
- Questions liées : Q-222
- Implémentation : apps/api/src/modules/coordination/alertes-coordination.ts:alertesCoordination (RB- → DM_FICHIER) — PARTIEL : COO-P07 (2026-11-05) : renvoi Broadcast ignoré sur un dossier en production → alerte Critique, tracé ; reste : mail aux chefs d’équipe (Q-375), « Générer un complément » (générateur D-15) ; « train en production » approché par les statuts de production (Q-190 (1))
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-075 — Menu « Alertes Pré-Prod »
- Origine : NOUVELLE
- Énoncé : un espace « Alertes Pré-Prod » regroupe les alertes de pré-production : intitulés de thèmes proches (RG-COO-069), annonceurs proches (RG-COO-070), thèmes modifiés dans Broadcast (RG-COO-068), réceptions sans IP (RG-COO-071), DM et mises à jour post-envoi (RG-COO-073, 074), avec rappel aux gestionnaires et alerte au développeur référent. Il est servi par Pilotage › Alertes (RG X / ECR-TRA-01) et Pré-production › Vérification des thèmes ; où se situe l'écran (Broadcast ou Circé) reste ouvert (Q19 d'origine, décision provisoire : dans Circé).
- Déclencheur : ouverture du menu.
- Conditions : rôle `coord`/`admin`.
- Effet / message d'erreur : lecture ; chaque entrée ouvre l'écran où agir.
- Sources : spec ateliers EX-COO-513, EX-THM-502, EX-COO-512 (A14 slides 30, 34 ; S L66) ; [README] §2.1 (EX-COO-030) ; écran ECR-TRA-01
- Questions liées : Q-220
- Implémentation : apps/api/src/modules/alertes/service.ts:listerAlertesPilotage ; apps/web/src/routes/pilotage/alertes.tsx ; apps/web/src/routes/coordination/themes.tsx — PARTIEL : COO-P07 (2026-11-05) : Pilotage › Alertes (toutes les alertes REC et COO, filtres, indicateurs, pastilles) et Pré-production › Vérification des thèmes ; reste : rappel aux gestionnaires et alerte au développeur référent (mails, Q-375) ; acquittement refusé tant que Q-220 ne dit pas qui acquitte
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts ; e2e/coordination-alertes.spec.ts

### RG-COO-076 — Calendrier du process : deadlines
- Origine : NOUVELLE
- Énoncé : le calendrier de référence est : envoi de la prépa le lundi (jalon 4) ; deadline Pré-Prod (envoi de la prépa) le jeudi S-2 à 16 h ; deadline réception le vendredi S-2 à 16 h 30 (maquette) ; export des trains le jeudi à 14 h (coo2) ; point de non-retour au Go aux plateformes (jeudi S-2). Ces valeurs sont des paramètres (heure, jour), pas des constantes du code. Aucune restriction horaire n'est codée dans le legacy (« le jeudi 14 h n'apparaît pas dans le code »).
- Déclencheur : calcul des alertes de retard (RG-COO-066) ; affichage des deadlines.
- Conditions : semaine de départ ISO.
- Effet / message d'erreur : paramètres Administration › Règles métier (Q-220).
- Sources : spec [PP] §2 ; [PC] p.2 ; EX-EXI-077 ; maquette `M.deadlinePP` (EX-COO-044) ; legacy `legacy-coordination.md` RG-COO-070 (aucune restriction horaire)
- Questions liées : Q-222, Q-220
- Implémentation : apps/api/src/reference/seed-ref.ts (coordination.deadlinePrepa, deadlineReception, fenetreRajout) ; apps/api/src/modules/coordination/reservations.ts:lireDeadline — PARTIEL : COO-P07 (2026-11-05) : deadlines Pré-Prod, réception et fenêtre des rajouts en paramètres (jamais codées) ; reste : export des trains jeudi 14 h et point de non-retour en paramètres avec l’export (COO-P10)
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts ; apps/api/src/modules/coordination/alertes-coordination.test.ts

### RG-COO-080 — Une seule ligne attendue active par clé (RG-AT-01)
- Origine : MODIFIÉE
- Énoncé : il existe au plus une ligne attendue ACTIVE par (plateforme × dossier × support × thème × bandeau × semaine ISO) ; la DA et l'atelier sont hors clé : leurs quantités s'additionnent sur la ligne. Index unique en base (avec un second index pour les lignes sans thème, avant IP). Toute insertion en conflit est une mise à jour (jamais un doublon). MODIFIÉE : legacy = aucune clé métier ni contrainte d'unicité ; `NOT EXISTS` sur des textes ; la quantité fait partie du regroupement (deux lignes de même clé et de quantités différentes ne s'additionnent pas) ; correctif « IT-62195 » : mise à jour des lignes Broadcast sans critère de thème (thème mélangé quand un dossier a deux thèmes) ; `MERGE` d'insertion qui ne matche jamais.
- Déclencheur : tout traitement qui crée ou met à jour une ligne attendue (RG-COO-082, 084, 086).
- Conditions : clé = identifiants (RG-COO-081) ; DA hors clé (version [RA] RG-AT-01, qui prévaut sur la clé de [PP] R1 incluant la DA : Q-207) ; `etat_ligne = ACTIVE`.
- Effet / message d'erreur : violation d'unicité = erreur technique jamais exposée (le service fusionne) ; test : deux lectures successives identiques ⇒ aucune ligne en plus, quantités inchangées ; deux DA du même dossier ⇒ une ligne, quantités additionnées.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:166-167,178-179,184-188,239-263,273-289` (ancien ID provisoire RG-COO-005, 006, 008) · spec [RA] §5 RG-AT-01 ; [DC] §12 ; [PP] §7 R1 (EX-COO-032) ; bdd.md §2.3, §7.5 ; EX-EXI-013, EX-EXI-014
- Questions liées : Q-207, Q-208, Q-226
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:regrouper, creerLigne, lignes-maj.ts:mettreAJourLigneAttendue (fusion), creerLigne (collision d'unicité → mise à jour), ligneActive ; index unique partiel tf_prepa_affiche_ligne_active_cle_key — FAIT : COO-P05 (2026-11-05) : une ligne active par clé (DA et atelier hors clé, quantités additionnées), relecture identique sans ligne en plus ; fusion d'un thème renommé sur la clé d'une autre ligne active (lignes-maj.ts:mettreAJourLigneAttendue, Q-187 (14)) ; seul l'index unique est actif en production ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production par le passage d’intégration (flux état des réservations / préparations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/src/modules/coordination/alimentation-lignes.test.ts

### RG-COO-081 — Rapprochement par identifiants, jamais par texte (RG-AT-02)
- Origine : MODIFIÉE
- Énoncé : la plateforme est rapprochée par `IdSiteCCF`, le support par `IdSurface` × `IdFormat`, le thème par `IdTheme` ; les textes (annonceur, thème, format) servent à l'affichage seulement. Sans n° de thème (Q-208) : le thème écrit est mis en forme (majuscules, espaces, accents normalisés) et une alerte est levée. MODIFIÉE : legacy = plateforme retrouvée par `LIKE` sur le nom du destinataire (erreur si plusieurs correspondances, `plt_id` nul si aucune ⇒ ligne recréée à chaque passage), `sup_id` = 0 si la correspondance surface × format manque (ligne écartée), thème et annonceur comparés en texte.
- Déclencheur : toute comparaison de lignes (alimentation, rattachement, arrivée de la prépa).
- Conditions : `IdSiteCCF` connu du référentiel plateformes ; `IdSurface`×`IdFormat` connu de `Transaco_Surface_Format`.
- Effet / message d'erreur : identifiant inconnu ⇒ la ligne n'est pas écartée silencieusement : alerte « donnée de référence manquante » (technique) et traitement poursuivi pour les autres lignes ; plusieurs plateformes pour un site ⇒ aucune sous-requête scalaire, jointure sur identifiant.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:134-136,187` ; `BLL/BatchAlimGetInstructionBc.cs:96-117` (ancien ID provisoire RG-COO-004) · spec [RA] §5 RG-AT-02 ; [DC] §12 (EX-COO-033) ; EX-EXI-013
- Questions liées : Q-208, Q-227
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:alimenterDepuisBroadcast (site CCF, CorrespondanceSupport surface × format, n° de thème) ; modèle CorrespondanceSupport (transaco_surface_format) — FAIT : COO-P05 (2026-11-05) : rapprochement par identifiants ; identifiant inconnu → alerte DONNEE_REFERENCE_MANQUANTE journalisée, autres lignes traitées ; thème sans n° → texte normalisé + alerte (Q-208, Q-187 (2)) ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux état des réservations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-082 — Ligne « Broadcast » : créée ou mise à jour à chaque lecture (RG-AT-03)
- Origine : MODIFIÉE
- Énoncé : à chaque lecture de l'état des réservations (fenêtre de la semaine en cours à +8), tant que la prépa du dossier n'est pas envoyée, Circé crée ou met à jour la ligne attendue de source BC (`source = BC`, `qte_bc` = somme des lignes Broadcast de la clé hors « reste en place », `date_vue_bc` = date de lecture). Si la prépa est déjà envoyée (source PREPA), la lecture ne modifie pas `qte_prepa` (RG-COO-086).
- Déclencheur : traitement d'alimentation (RG-COO-103).
- Conditions : statut de préparation Broadcast ≠ « Envoyé » (ou nul) ; clé selon RG-COO-080 ; « reste en place » exclu de la somme (Q-209).
- Effet / message d'erreur : upsert ; la ligne n'est jamais supprimée (RG-COO-089). MODIFIÉE : legacy = `FromBroadcast = 1`, un seul champ de quantité, copie entière.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:126-130,157-188,194-235` (ancien ID provisoire RG-COO-003) · spec [RA] §5 RG-AT-03 (EX-COO-034) ; EX-EXI-013
- Questions liées : Q-209, Q-207
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:alimenterDepuisBroadcast (source BC, qte_bc hors reste en place, date_vue_bc) — FAIT : COO-P05 (2026-11-05) : création / mise à jour BC à chaque lecture ; ligne PREPA : qte_prepa inchangée (Q-209) ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux état des réservations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-083 — Semaines ISO partout, fenêtre S à S+8 en dates
- Origine : MODIFIÉE
- Énoncé : toutes les semaines sont des semaines ISO 8601 (programme d'échange et traitements), la fenêtre d'alimentation S → S+8 est calculée en dates (lundi de la semaine courante + 8 semaines), sans cas particulier de fin d'année ni branche « fin d'année ». MODIFIÉE : legacy = `DATEPART(wk)` (semaines « américaines ») dans la procédure d'alimentation, culture de la machine côté C#, débordement de fin d'année qui donne une semaine de fin supérieure d'une unité au calcul arithmétique (ex. 50 + 8 ⇒ 7 au lieu de 6), branche de fin d'année invalide (colonne écrite deux fois) pouvant échouer dès mi-novembre.
- Déclencheur : toute lecture de fenêtre.
- Conditions : `weeks` = 8 (paramètre).
- Effet / message d'erreur : test : fenêtre du lundi 2026-12-14 = S51/2026 → S07/2027 ; semaine 53 ISO correctement gérée. L'action « vérifier la version en production avant mi-novembre » (EX-COO-042) est sur l'existant, hors lots.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:23-25,85-105,153-237` ; `SQL/Functions/Fn_GetPrepaAffiche.sql:42,277,315` ; `BLL/BatchAlimGetInstructionBc.cs:22-34,43-90` (ancien ID provisoire RG-COO-002, RG-INT-010) · spec [RA] §5 RG-AT-07 (EX-COO-038, EX-COO-042) ; EX-EXI-013
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:fenetreAlimentation, dansFenetre ; packages/shared/src/semaines.ts ; paramètre coordination.fenetreSemaines — FAIT : COO-P05 (2026-11-05) : semaines ISO, fenêtre lundi + 8 semaines, semaine 53 ; exemple de la fiche contradictoire : Q-187 (7) ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux état des réservations, COO-P06)
- Tests : apps/api/src/modules/coordination/alimentation-lignes.test.ts ; apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-084 — Visuel provisoire avant les IP (RG-AT-04)
- Origine : NOUVELLE
- Énoncé : avant la saisie des IP, une seule ligne attendue au visuel « provisoire » est créée par (plateforme × dossier × support × semaine) ; le visuel provisoire est un visuel marqué `provisoire` (V2 `tr_visuel.provisoire`). Une réception sur cette ligne lève l'alerte « Réception sans IP » (RG-COO-071) et le motif de doute SANS_IP (RG-COO-006). L'agent saisit le thème (peut différer de celui des IP ; « le 1er qui a parlé » : intitulé de la première plateforme proposé à l'autre).
- Déclencheur : lecture de Broadcast sans thème pour la clé.
- Conditions : IP non saisies (thème nul dans Broadcast).
- Effet / message d'erreur : ligne `source = BC`, `IdTheme` nul, second index d'unicité (sans thème) ; legacy : la ligne sans thème est un thème « nul » qui s'écrase au retour (EX-EXI-014).
- Sources : spec [RA] §5 RG-AT-04, cas 1-3 ; [PP] §7 R3 (EX-COO-035) ; EX-EXI-014, EX-EXI-057 ; ateliers EX-REC-506 (A14 slide 24 #2) ; EX-THM-501
- Questions liées : Q-208
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:alimenterDepuisBroadcast (ligne provisoire, provisoire = true, thème nul) ; motif SANS_IP (validation-admin.ts) ; intitulé du 1er site proposé : reception/inconnues.ts suggestionsIntitules (RG-REC-047) — PARTIEL : COO-P05 (2026-11-05) : ligne provisoire unique et motif SANS_IP ; reste l'alerte « Réception sans IP » (RG-COO-071, COO-P07) ; COO-P07 (2026-11-05) : alerte « Réception sans IP » affichée (RG-COO-071) → FAIT
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-085 — Saisie des IP : fermeture du provisoire et déplacement de l'affiche rattachée
- Origine : NOUVELLE
- Énoncé : quand les IP sont saisies (lecture avec thèmes), la ligne provisoire est fermée (`etat_ligne = ANNULEE`, date de fermeture, jamais supprimée) et les lignes par thème sont créées. L'affiche rattachée à la ligne provisoire est déplacée seule vers la ligne du thème (lien retiré puis recréé avec qui/quand) s'il n'y a qu'un thème possible ou si le visuel du BL n'en désigne qu'un ; sinon la Coordination choisit (proposition `tf_edr_rapprochement`, motif THEME) ; aucun candidat : alerte. La purge des anciens thèmes des écrans de réceptions attendues s'applique aux lignes fermées.
- Déclencheur : lecture de Broadcast avec IP pour une clé ayant une ligne provisoire.
- Conditions : ligne provisoire active ; thèmes présents.
- Effet / message d'erreur : transaction unique fermeture + création + déplacement ; l'affiche déplacée repasse à confirmer si doute (RG-COO-006) ; historique des liens (RG-COO-088).
- Sources : spec [RA] §5 RG-AT-04, cas 1-3 ; [PP] §7 R3, R5 (EX-COO-035) ; ateliers EX-REC-504 (A14 slide 31 #5) ; EX-THM-504
- Questions liées : Q-208
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:fermerProvisoires, deplacerLien, fermerLigne — FAIT : COO-P05 (2026-11-05) : IP saisies : provisoire fermée (ANNULEE + date), affiche déplacée seule (lien retiré puis recréé) si un thème possible ou désigné par le BL ; sinon lien conservé (LIGNE_FERMEE) + alerte (Q-187 (4)) ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux état des réservations et préparations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-086 — Arrivée de la prépa : la ligne bascule en source PREPA, les liens ne bougent pas (RG-AT-05)
- Origine : MODIFIÉE
- Énoncé : à l'arrivée de la prépa, la ligne de même clé passe en `source = PREPA` et `qte_prepa` est renseignée ; une alerte « écart DA / prépa » est levée si `qte_prepa ≠ qte_bc` ; une ligne n'est créée que si la clé n'existe pas ; les liens affiche ↔ ligne ne changent pas (R4). MODIFIÉE : legacy RG-COO-009 = la ligne `FromBroadcast = 1` repasse à NULL seulement si les textes (dossier, support, annonceur, année, semaine, thème) sont égaux ET que toutes les lignes du groupe sont « Broadcast » ; sinon une ligne de prépa est ajoutée à côté, sans affiche (source de doublons et d'orphelines) ; la quantité n'est pas recalculée à la bascule et l'écart n'est pas signalé.
- Déclencheur : intégration d'une prépa fixe/pliage (RG-COO-121) ou d'instructions/faces du déroulant (RG-COO-131).
- Conditions : ligne active de même clé ; pour le déroulant, moment de la bascule : Q-212.
- Effet / message d'erreur : `source: BC → PREPA`, `qte_prepa` ; alerte RG-COO-067 si écart ; test : une affiche rattachée reste rattachée après la bascule.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:291-354` (ancien ID provisoire RG-COO-009) · spec [RA] §5 RG-AT-05 ; [PP] §7 R4 (EX-COO-036) ; EX-EXI-019
- Questions liées : Q-212, Q-207
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:alimenterDepuisPreparation ; lignes-maj.ts:mettreAJourLigneAttendue (source BC → PREPA, journal) — PARTIEL : COO-P05 (2026-11-05) : bascule BC → PREPA, qte_prepa, liens inchangés, écart DA / prépa signalé ; branché par COO-P06 (flux préparations) ; reste l'affichage de l'alerte (RG-COO-067, COO-P07) ; COO-P06 (2026-11-05) : branchée en production (flux préparations, chemin unique : integrerPreparation bascule aussi en PREPA) ; reste : affichage de l’alerte écart DA / prépa (COO-P07) ; COO-P07 (2026-11-05) : alerte écart affichée (RG-COO-067 / 086) → FAIT
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-087 — Disparition ou annulation d'une ligne : ANNULEE, jamais supprimée (RG-AT-06)
- Origine : MODIFIÉE
- Énoncé : une ligne de source BC qui n'est plus vue par Broadcast passe `ANNULEE` après la lecture suivante (date de fermeture) ; elle n'est jamais supprimée (R2). Une alerte est levée à la Coordination si une affiche y est rattachée (RG-COO-032). Les lignes `ANNULEE` sont exclues du calcul des attendues et des quantités. MODIFIÉE : legacy = aucun statut d'annulation, aucune purge ni transition ; lignes de dossiers non relus jamais touchées.
- Déclencheur : lecture de Broadcast sans la ligne ; annulation de DA.
- Conditions : ligne `ACTIVE` non vue lors de la dernière lecture de la fenêtre ; la lecture suivante confirme (une absence unique ne ferme pas : délai d'une lecture).
- Effet / message d'erreur : `ACTIVE → ANNULEE` ; alerte si lien actif ; aucune alerte pour la purge automatique des attendues (EX-TRA-032).
- Sources : legacy `legacy-coordination.md §5.1` (« Annulée / supprimée : aucune transition ») · spec [RA] §5 RG-AT-06, cas 14 ; [PP] §6, §7 R2 (EX-COO-037) ; EX-TRA-032
- Questions liées : Q-210
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:alimenterDepuisBroadcast (non_vue_le puis fermeture), fermerLigne ; integration.ts:annulerDossier — FAIT : COO-P05 (2026-11-05) : ligne BC plus vue : marquée puis fermée à la lecture suivante (historique RG-COO-087), alerte si lien actif ; dossier annulé (COO-P01) ; Q-187 (12) ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production : lignes non vues (dossiers lus et dossiers absents de la lecture) et dossier annulé (flux instructions / annulations, COO-P06) ; audit COO-P06 (2026-11-05) : lot partiel (`lectureComplete = false`) : aucune ligne d'un dossier absent marquée ni fermée
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-088 — Lien affiche ↔ ligne : plusieurs-à-plusieurs avec quantité, retiré et recréé avec qui/quand (RG-AT-08)
- Origine : MODIFIÉE
- Énoncé : une affiche peut couvrir plusieurs lignes et une ligne peut être couverte par plusieurs affiches, avec une quantité par lien (`asso_affiche_visuel`) ; un lien retiré est conservé inactif avec qui/quand ; un lien est déplacé, jamais perdu, quand une ligne se ferme. La somme des quantités des liens actifs d'une affiche ne dépasse pas la quantité reçue (« La répartition (x) dépasse la quantité reçue (y). »). Rattachement manuel : seules les lignes non entièrement couvertes sont proposées. MODIFIÉE : legacy = une seule affiche par ligne (`affiche_livraison_Id`), sans quantité ; association aux seules lignes sans affiche (les autres sont ignorées sans message) ; dissociation sans contrôle de statut (même après validation) ; historique de dissociation écrit avec l'action d'association.
- Déclencheur : création de proposition, rattachement manuel, dissociation, fermeture de ligne.
- Conditions : somme des quantités ≤ quantité reçue ; ligne `ACTIVE` pour un nouveau lien.
- Effet / message d'erreur : 422 « La répartition (x) dépasse la quantité reçue (y). » ; 422 « Choisissez au moins un dossier et une quantité. » ; historique `AfficheAssocier` / `AfficheDissocier` distincts.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:533-555,577-586` ; `BLL/HistorisationBll.cs:68-76` ; `BLL/LivraisonAfficheService.cs:427-486` (ancien ID provisoire RG-COO-020, 022, 023 ; RG-REC-091, 092) · spec [RA] §4, §5 RG-AT-08 ; [PP] §7 ; [DC] §13 (EX-COO-039) ; EX-EXI-056 ; EX-REC-039
- Questions liées : Q-213, Q-202
- Implémentation : apps/api/src/modules/reception/rattachement.ts:rattacher, retirerRattachement ; reception/stock.ts:assertRepartitionPossible ; apps/api/src/modules/coordination/alimentation-lignes.ts:deplacerLien ; reception/inconnues.ts:chercherCandidats (propositions non couvertes) — FAIT : COO-P05 (2026-11-05) : lien n–n avec quantité, retiré conservé (qui / quand), déplacé jamais perdu, 422 au-delà du reçu, propositions limitées aux lignes non couvertes (Q-187 (13))
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/test/reception/socle.int.test.ts ; apps/api/test/modele-donnees.int.test.ts

### RG-COO-089 — Une ligne attendue n'est jamais supprimée, elle est fermée avec une date (R2)
- Origine : NOUVELLE
- Énoncé : aucune opération (alimentation, purge fonctionnelle, correction) ne supprime physiquement une ligne attendue ayant (ou ayant eu) un lien ou une quantité ; la fermeture écrit `etat_ligne = ANNULEE` et une date de fermeture. (La purge automatique à 4 semaines hors « conservation à l'année » relève de la Réception : RG-REC.)
- Déclencheur : toute suppression demandée.
- Conditions : ligne avec historique.
- Effet / message d'erreur : 409 `{ regle: 'RG-COO-089' }` pour une suppression directe ; la fermeture est la seule voie.
- Sources : spec [PP] §7 R2 ; [RA] §5 (EX-COO-037) ; EX-TRA-032, EX-TRA-042
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/reservations.ts:supprimerLigneAttendue ; DELETE /api/coordination/lignes-attendues/:id ; apps/api/src/modules/coordination/alimentation-lignes.ts:fermerLigne — FAIT : COO-P05 (2026-11-05) : suppression directe 409 ; fermeture ANNULEE + fermee_le seule voie ; aucun code ne supprime une ligne (test de source) ; droit `alimentation.manuelle` vérifié dans le service (403 pour les autres profils, Q-187 (9))
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-090 — Dédoublonnage initial des lignes attendues (reprise)
- Origine : NOUVELLE
- Énoncé : avant l'activation de l'index unique, les doublons existants sont traités : pour chaque clé en double, garder la ligne qui porte une affiche (ou, à défaut, la plus récente), reporter le rattachement des autres sur la ligne gardée, passer les autres en `ANNULEE`. Causes des doublons (à confirmer par les requêtes de la DSI) : correctif sans thème ; bascule ratée au texte ; découpage par champ invisible ; plateforme retrouvée par nom.
- Déclencheur : migration (étape 8/9, reprise de données).
- Conditions : clé selon RG-COO-080.
- Effet / message d'erreur : rapport de reprise (nombre de lignes fermées, liens reportés) ; aucune perte de lien.
- Sources : spec [RA] §2, §4 (EX-COO-041) ; legacy RG-COO-004, 005, 006, 008 (causes) ; bdd.md §10 (données legacy probablement incohérentes)
- Questions liées : Q-226, Q-213
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:planDedoublonnage, dedoublonnerLignes — PARTIEL : COO-P05 (2026-11-05) : fonction de reprise testée (ligne gardée, liens reportés, autres fermées) ; reste son exécution lors de la reprise des données (étape 8/9) et les requêtes de la DSI (Q-226)
- Tests : apps/api/src/modules/coordination/alimentation-lignes.test.ts ; apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-091 — Copie de l'état des réservations Broadcast : image par dossier, lignes plus vues fermées
- Origine : MODIFIÉE
- Énoncé : un traitement lit l'état des réservations Broadcast (fenêtre RG-COO-083) et met à jour la copie `tf_prepa_Broadcast` : pour chaque dossier présent dans la lecture, la copie du dossier devient l'image de la lecture ; les lignes qui ne sont plus vues passent par la fermeture (RG-COO-087) au lieu d'être supprimées. Si la lecture est vide, rien n'est écrit. L'écriture est transactionnelle par dossier. `date_vue` est renseignée à chaque lecture. MODIFIÉE : legacy = suppression puis recréation de toutes les lignes de chaque dossier lu (ligne par ligne, sans transaction englobante : une panne laisse un dossier supprimé et partiellement recréé), dossiers non relus jamais purgés ; `sup_id` = 0 si pas de correspondance ; `repiquage` = `Bandeau` ; assistants « Nom Prénom » concaténés.
- Déclencheur : traitement d'alimentation (RG-COO-103).
- Conditions : lecture non vide ; transaction par dossier ; `IdThemeBandeau` copié (la variante Web API legacy ne le copiait pas).
- Effet / message d'erreur : erreur d'un dossier ⇒ rollback de ce dossier, journalisée, les autres dossiers poursuivent ; test : une panne simulée en milieu de dossier ne laisse aucune ligne partielle.
- Sources : legacy `BLL/BatchAlimGetInstructionBc.cs:47-65,92-129` ; `REP/LivraisonAfficheRepository.cs:328-361,364-369` (ancien ID provisoire RG-COO-001 ; RG-INT-011) · spec [RA] §4 ; [PP] §11 (EX-COO-043, EX-COO-046) ; EX-EXI-012
- Questions liées : Q-005, Q-211
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:integrerEtatReservationsDossier ; apps/api/src/modules/coordination/integration-broadcast.ts:fluxEtatReservations (transaction par dossier) ; alimentation-lignes.ts:traiterDossiersNonLus — FAIT : COO-P06 (2026-11-05) : copie du dossier = image de la lecture (date_vue, IdThemeBandeau, assistants séparés), transaction par dossier (panne simulée : rien d’écrit, autres dossiers poursuivis), lecture vide sans écriture, dossiers absents → RG-COO-087 ; source réelle Q-005 (lot déposé : contrat Q-188 (1)) ; audit COO-P06 (2026-11-05) : dossiers absents traités seulement pour une lecture complète de la fenêtre (`lectureComplete`) ; lot par le connecteur / la commande seulement (Q-188 (1))
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL : comportement implémenté et testé SUR CONTRAT D'ENTRÉE SIMULÉ (Q-188) ; la source réelle (procédures INTERFACE / EXTPLAY / Broadcast, service `webapicirce`) n'est pas dans le dépôt : Q-005 OUVERTE

### RG-COO-092 — Colonnes de Broadcast conservées dans la copie
- Origine : MODIFIÉE
- Énoncé : la copie conserve `IdSiteCCF`, `IdSurface`, `IdFormat`, `IdPreparationChapeau`, `IdTypePreparation`, `EstResteEnPlace`, `date_vue` et, si Broadcast peut le fournir, `IdTheme` (demande formulée, Q-208) ; elles servent aux rapprochements par identifiant (RG-COO-081). Sont aujourd'hui perdus à la copie : site, surface, format (hors support), n° de prépa chapeau, reste en place, Print, campagne contrôlée, photo, description du thème (les trois derniers ne sont pas repris sans spec).
- Déclencheur : copie (RG-COO-091).
- Conditions : colonnes renvoyées par la procédure Broadcast `P_CirceEtatReservation_New`.
- Effet / message d'erreur : colonne attendue absente ⇒ erreur de lecture explicite journalisée (pas de valeur par défaut silencieuse).
- Sources : spec [RA] §4 ; bdd.md §7.5 (EX-COO-046) ; EX-EXI-012 ; legacy `BLL/BatchAlimGetInstructionBc.cs:96-117`
- Questions liées : Q-208
- Implémentation : packages/shared/src/coordination-integration.ts:LigneEtatReservationsSchema ; apps/api/src/modules/coordination/integration-flux.ts:integrerEtatReservationsDossier ; apps/api/src/modules/coordination/integration-broadcast.ts:lancerPassage (LotIntegrationSchema) — FAIT : COO-P06 (2026-11-05) : colonnes conservées (site, surface, format, prépa chapeau, type de prépa, reste en place, n° de thème) ; colonne absente → « Lecture Broadcast invalide » (aucune valeur par défaut silencieuse) ; audit COO-P06 (2026-11-05) : test de rejet nommé (colonne absente)
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-093 — Exclusions de l'alimentation : statut « Envoyé », plateformes Derichebourg, supports
- Origine : CONSERVÉE
- Énoncé : la source Broadcast n'alimente les attendues que si le statut de préparation Broadcast est différent de « Envoyé » (ou nul) et si le destinataire n'est ni « Plateforme Derichebourg Lyon » ni « Plateforme Derichebourg » (valeurs codées en dur dans le legacy ; paramétrables dans la cible, Q-227). Les lignes fixe/pliage et déroulant ne sont prises que si `rpc_statut ≠ 4`.
- Déclencheur : alimentation (RG-COO-082, 094).
- Conditions : voir énoncé.
- Effet / message d'erreur : lignes exclues non créées ; pas d'alerte.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:126-130,157-188` (ancien ID provisoire RG-COO-003) · spec [RA] §5 ; bdd.md §2.3
- Questions liées : Q-227
- Implémentation : alimentation-lignes.ts:estExclue (appelée par le flux) ; apps/api/src/modules/coordination/integration-flux.ts:integrerGroupePreparation (rpc_statut 4) — FAIT : COO-P06 (2026-11-05) : exclusions « Envoyé » / destinataires paramétrés branchées sur le flux ; ligne de travail annulée non prise
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts ; apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-094 — Trois sources de lignes attendues : répartition fixe/pliage, faces du déroulant, copie Broadcast
- Origine : CONSERVÉE
- Énoncé : les lignes attendues proviennent de trois sources : (1) répartitions fixe/pliage (`tf_repart_calcul`, quantité = Σ `rpc_qte`), (2) faces du déroulant (`tf_face_train`, quantité = `count(ft_id)`, thème non nul), (3) la copie Broadcast (source BC, RG-COO-082). (1) et (2) sont les lignes « PREPA » (RG-COO-086). Conditions : `rpc_statut ≠ 4`, fenêtre S → S+8, départ futur.
- Déclencheur : alimentation.
- Conditions : (1)/(2) non annulées ; (2) thème non nul ⇒ la ligne PREPA du déroulant n'existe qu'une fois les faces thématisées (Q-212).
- Effet / message d'erreur : insertion dans la table de travail puis upsert (RG-COO-080) ; les lignes d'un statut 4 sont exclues.
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:157-188,194-235` (ancien ID provisoire RG-COO-003) · spec [RA] §5 RG-AT-03/05 ; EX-EXI-013, EX-EXI-019
- Questions liées : Q-212
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:lignesPrepaDepuisProduction, alimenterDepuisPreparation — FAIT : COO-P05 (2026-11-05) : répartitions (Σ qte), faces (nombre, thème non nul, départ futur), statut ANNULE exclu, fenêtre ; branché par COO-P06 (flux préparations) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux préparations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-095 — Lignes « bandeau » dédiées (supports 100, 102, 105, 107)
- Origine : CONSERVÉE
- Énoncé : pour les supports 5, 26, 1026 (→ 100), 19 (→ 102), 27 (→ 105) et, côté trains, 29 (→ 107), des lignes attendues « bandeau » sont créées (quantité = Σ repiquage) ou mises à jour par (thème-repiquage, support, dossier, semaine, année, atelier) ; l'`ate_id` est celui du bandeau. Le bandeau fait partie de la clé (RG-COO-080).
- Déclencheur : alimentation.
- Conditions : `rpc_repiquage`/`repiquage` non nul ; `rpc_statut ≠ 4` ; fenêtre S → S+8.
- Effet / message d'erreur : upsert avec `ate_id` du bandeau ; correspondance supports → référentiel (Q-227).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:356-546` (ancien ID provisoire RG-COO-010) · spec [RA] §5 RG-AT-01 (bandeau dans la clé)
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:lignesPrepaDepuisProduction, lireSupportsBandeau ; paramètre coordination.supportsBandeau — FAIT : COO-P05 (2026-11-05) : lignes bandeau (support bandeau paramétré, bandeau dans la clé, atelier du bandeau) ; branché par COO-P06 (flux préparations) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; Q-187 (10) (11) ; COO-P06 (2026-11-05) : branchée en production (flux préparations, COO-P06)
- Tests : apps/api/src/modules/coordination/alimentation-lignes.test.ts ; apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-096 — Renseignement de la DA chapeau des lignes attendues
- Origine : CONSERVÉE
- Énoncé : une ligne nouvellement créée sans DA chapeau la reprend de la copie Broadcast par (dossier, semaine, année) ; la DA ne fait pas partie de la clé et plusieurs DA d'un même dossier s'additionnent (RG-COO-080). Le retour vers Broadcast envoie la ligne si `IdDAChapeau` est renseigné (RG-COO-134).
- Déclencheur : alimentation, après insertion.
- Conditions : `IdDAChapeau` nul.
- Effet / message d'erreur : mise à jour de `IdDAChapeau` ; legacy : une seule valeur pour tout le triplet quelle que soit la DA (cause d'imprécision : les DA sont conservées en liste dans la cible, Q-207).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:548-562` (ancien ID provisoire RG-COO-011) · spec [RA] §5 RG-AT-01
- Questions liées : Q-207
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:daChapeauDeLaCopie (création), alimenterDepuisBroadcast (DA renseignée non remplacée) — FAIT : COO-P05 (2026-11-05) : DA chapeau reprise de la copie Broadcast par (dossier, semaine, année) à la création ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux état des réservations / préparations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-097 — Plus de drapeau « ARecevoir » à réarmer : le reçu est calculé
- Origine : MODIFIÉE
- Énoncé : le drapeau legacy `ARecevoir` (posé à la création de livraison ou au rattachement, réarmé par l'alimentation quand la prépa arrive sur une ligne déjà reçue, non remis à zéro à la dissociation) est remplacé par un statut calculé de la ligne : Attendue / Partielle / Complète / Surplus à partir des mouvements de réception des affiches rattachées (règle de la Réception, EX-REC-051). L'alimentation ne pose jamais « reçu » ; une ligne créée après réception est automatiquement « reçue » parce que ses liens existent. La liste des attendues d'une plateforme contient les lignes non reçues et les lignes partielles.
- Déclencheur : lecture de la ligne ; alimentation (aucun effet de bord).
- Conditions : reçu = Σ mouvements des affiches liées (stock = somme des mouvements).
- Effet / message d'erreur : test : après dissociation du dernier lien, la ligne redevient « Attendue » (le legacy la laissait « reçue »).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:139-149,267-271` ; `SQL/Functions/Fn_GetPrepaAffiche.sql:44-103,106-221,224-343` (ancien ID provisoire RG-COO-007, 013, 023) · spec [DC] §9 (« ce qui se calcule ne se coche jamais ») ; EX-REC-050, EX-REC-051, EX-REC-052 ; bdd.md §4.3
- Questions liées : Q-213
- Implémentation : apps/api/src/modules/reception/lignes.ts:recalculerLigne ; apps/api/src/modules/coordination/alimentation-lignes.ts (aucune écriture du statut reçu) — FAIT : COO-P05 (2026-11-05) : reçu calculé ; la lecture ne pose jamais « reçu » ; dissociation du dernier lien → Attendue
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-098 — Même thème sur plusieurs dossiers : une ligne par dossier
- Origine : NOUVELLE
- Énoncé : un même thème présent sur plusieurs dossiers donne une ligne attendue par dossier ; le surplus d'une affiche est proposé à l'autre dossier, la Coordination confirme ; le reçu est compté une seule fois (RG-X-060). Un visuel commun à 33 dossiers : l'affiche est rattachée à tous les dossiers par rattachements manuels (sans limite de nombre de dossiers) avec une quantité chacun.
- Déclencheur : réception d'une affiche dont le visuel est commun ; rattachement manuel.
- Conditions : même `IdTheme` ou visuel commun (motif MULTI).
- Effet / message d'erreur : proposition en doute (MULTI, RG-COO-006) ; confirmation explicite requise.
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-EXI-058 (3) ; EX-REC-048
- Questions liées : Q-208
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:regrouper (dossier dans la clé) ; motif MULTI (validation-admin.ts:motifsDoute) — FAIT : COO-P05 (2026-11-05) : une ligne par dossier ; surplus proposé en doute MULTI, confirmation explicite (COO-P03) ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux état des réservations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/src/modules/coordination/alimentation-lignes.test.ts

### RG-COO-099 — Affiches en plus pour un autre dossier : rattachement manuel du seul surplus
- Origine : NOUVELLE
- Énoncé : des affiches reçues en plus pour un autre dossier se rattachent à la main (historisé, même après la validation ou le début de production) ; seul le surplus est rattaché ; pour une autre plateforme : transfert puis réception. Effet du rattachement sur les validations existantes de l'affiche : voir RG-X-052 (HYPOTHÈSE Q-202 : les validations déjà faites ne sont pas retirées).
- Déclencheur : « + Rattacher à un autre dossier » (fiche affiche).
- Conditions : quantité rattachée ≤ surplus de l'affiche ; ligne cible active.
- Effet / message d'erreur : lien actif avec `mode = MAIN`, historique avec qui/quand ; 422 si le total dépasse la quantité reçue.
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-EXI-058
- Questions liées : Q-202
- Implémentation : apps/api/src/modules/reception/affiches.ts:rattacherAutreDossier (MAIN, historisé) ; reception/stock.ts:assertRepartitionPossible — FAIT : COO-P05 (2026-11-05) : surplus rattaché à la main, 422 au-delà du reçu, ligne cible active (ANO-030)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/test/coordination/effets-validation-complement.int.test.ts

### RG-COO-100 — Dossier sur deux plateformes : une ligne par plateforme
- Origine : NOUVELLE
- Énoncé : un dossier livré sur deux plateformes a une ligne attendue par plateforme ; les destinataires ne multiplient pas les lignes (le grain de la ligne est plateforme × support, pas destinataire). Dans la maquette, le dossier de la 2e plateforme porte un identifiant de suffixe distinct (`…-W`) avec le dossier mère en référence.
- Déclencheur : alimentation.
- Conditions : plateformes distinctes pour un même `cont_num`.
- Effet / message d'erreur : deux lignes actives pour des plateformes différentes autorisées par RG-COO-080 ; le reçu n'est pas réparti par destinataire (Q41 d'origine).
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; écran ECR-PIL-03 (données MOCK)
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:regrouper (plateforme dans la clé, destinataire hors clé) — FAIT : COO-P05 (2026-11-05) : une ligne par plateforme, destinataires sans effet ; suffixe « -W » de la maquette non repris (affichage, Q-227) ; branché par COO-P06 (passage d'intégration) ; source réelle : Q-005 ; données par le connecteur, Q-188 (1) ; COO-P06 (2026-11-05) : branchée en production (flux état des réservations, COO-P06)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/src/modules/coordination/alimentation-lignes.test.ts

### RG-COO-101 — Dossier multi-semaines : quantité comptée une fois
- Origine : NOUVELLE
- Énoncé : un dossier à deux semaines de départ n'a ses quantités comptées qu'une fois dans l'état des réservations ; le tag « multi-semaines » (fond jaune en Réception) signale le cas. Anomalie corrigée : « quantités doublées dans l'état des réservations lorsqu'il y a 2 semaines de départ » (ANO-02).
- Déclencheur : lecture de l'état des réservations ; totaux.
- Conditions : lien affiche ↔ plusieurs semaines (`tf_dossier_semaine_depart`).
- Effet / message d'erreur : test : dossier S43+S44 de quantité 100 ⇒ attendu total 100.
- Sources : ateliers EX-TRA-515 (S L31, ANO-02) ; maquette ECR-PIL-03 (données MOCK, « quantité d'un dossier sur 2 semaines comptée une fois ») ; bdd.md §2.4
- Questions liées : Q-207
- Implémentation : apps/api/src/modules/coordination/reservations.ts:etatReservations (attendu d'un thème = max des semaines) — FAIT : COO-P05 (2026-11-05) : dossier sur deux semaines compté une fois, repère multi-semaines (Q-187 (3))
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; e2e/coordination-etat-reservations.spec.ts

### RG-COO-102 — Atomicité et idempotence de l'alimentation
- Origine : MODIFIÉE
- Énoncé : l'alimentation d'un lot est transactionnelle (par dossier ou par flux) et idempotente : rejouer le même lot ne crée aucune ligne ni quantité supplémentaire (clé RG-COO-080, `Idempotency-Key` de lot pour les déclenchements manuels). Les erreurs sont testées après chaque bloc (et non une seule fois en fin de procédure). MODIFIÉE : legacy = transaction de la procédure dont l'erreur n'est testée qu'en fin (rollback seulement si la dernière instruction a échoué), sauvegarde ligne par ligne sans transaction englobante.
- Déclencheur : tout passage d'alimentation (RG-COO-103), déclenchement manuel.
- Conditions : un seul passage actif à la fois (verrou) ; `version` pour les mises à jour.
- Effet / message d'erreur : 409 si un passage est déjà en cours ; journalisation (RG-COO-116).
- Sources : legacy `SQL/p_Alimentation_tf_prepa_affiche.sql:151,566-588` ; `BLL/BatchAlimGetInstructionBc.cs` (ancien ID provisoire RG-COO-012 ; confiance INCERTAINE) · règle projet CLAUDE.md §6 (atomicité) ; spec [RA] §5
- Questions liées : Q-005, Q-211
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:lancerPassage (verrou unique `passage_integration.verrou`, 409 COO_PASSAGE_EN_COURS, verrou périmé libéré), unite() ; apps/api/src/core/idempotency.ts:withIdempotencyEtapes — FAIT : COO-P06 (2026-11-05) : un seul passage à la fois (409), transaction par dossier / groupe / flux, rejeu idempotent, Idempotency-Key de lot ; HYPOTHÈSE Q-188 (4) verrou périmé
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL : comportement implémenté et testé SUR CONTRAT D'ENTRÉE SIMULÉ (Q-188) ; la source réelle (procédures INTERFACE / EXTPLAY / Broadcast, service `webapicirce`) n'est pas dans le dépôt : Q-005 OUVERTE

### RG-COO-103 — Planification de l'interrogation de Broadcast
- Origine : NOUVELLE
- Énoncé : Circé interroge Broadcast à intervalles réguliers (pas d'événement « DA activée » à écouter) : le traitement d'alimentation lit l'état des réservations et les flux de préparation à des horaires paramétrables, par défaut toutes les 2 heures de 8 h à 18 h (8 h, 10 h, 12 h, 14 h, 16 h, 18 h d'après l'équipe) ; une exécution manuelle est possible pour l'administrateur. La planification réelle du legacy est inconnue (aucun job versionné).
- Déclencheur : horloge de l'API (planificateur interne) ; action manuelle.
- Conditions : horaires paramétrables ; un seul passage à la fois (RG-COO-102).
- Effet / message d'erreur : journal du passage (début, fin, lignes lues/créées/fermées, échec) ; alerte technique si deux passages consécutifs échouent.
- Sources : spec [PP] §11 ; [DC] §12 ; EX-TRA-039 (EX-COO-043) ; EX-EXI-012 (« 2 màj/jour » atelier 14 vs toutes les 2 h) ; legacy RG-INT-013 (aucun appelant dans le dépôt)
- Questions liées : Q-005, Q-211
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:prochainHoraire, demarrerPlanificateur, lancerPassageManuel, alertesIntegration ; apps/api/src/server.ts ; paramètre integration.horaires — PARTIEL : COO-P06 (2026-11-05) : horaires paramétrés (Q-211), passage manuel coord / admin, alerte technique après deux échecs ; reste : le planificateur ne démarre qu’avec une source Broadcast réelle (Q-005) ; affichage de l’alerte (COO-P07) ; audit COO-P06 (2026-11-05) : passage manuel réservé à l'administrateur (droit `integration.passage_manuel`, RG-COO-103 ; conflit avec la matrice §2 : Q-189 OUVERTE) ; aucun dépôt de lot par l'API ; COO-P07 (2026-11-05) : alerte « deux passages consécutifs en échec » affichée ; reste Q-005 (planificateur) → PARTIEL
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts ; e2e/coordination-integration.spec.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-104 — Données reçues de Broadcast (cinq flux)
- Origine : MODIFIÉE
- Énoncé : Circé reçoit de Broadcast : (1) l'état des réservations (copie, S à S+8, par dossier × DA × destinataire × thème/bandeau × format × semaine, avant la prépa) ; (2) les réceptions attendues « Broadcast » calculées (RG-COO-082) ; (3) la prépa fixe/pliage (lundi ; un renvoi est rejeté tant que la précédente n'est pas débloquée, RG-COO-122) ; (4) les faces des trains (un renvoi remplace, sauf Instruction OK faite : RG-COO-129) ; (5) instructions/exceptions/commentaire (dossier « En cours »). Circé ne peut pas écrire dans Broadcast (hors accusé d'intégration et déblocage, RG-COO-125, 145).
- Déclencheur : passages d'alimentation.
- Conditions : voir flux.
- Effet / message d'erreur : voir règles liées ; lien retour « reçue et associée » (RG-COO-024).
- Sources : spec [PP] §11 ; [DC] §12 ; relevé §12 (EX-COO-043) ; EX-TRA-039 ; legacy RG-INT-006, 007
- Questions liées : Q-005, Q-211
- Implémentation : packages/shared/src/coordination-integration.ts:LotIntegrationSchema ; apps/api/src/modules/coordination/integration-broadcast.ts ; apps/api/src/modules/coordination/integration-flux.ts — PARTIEL : COO-P06 (2026-11-05) : cinq flux traités (état des réservations, destinataires, prépa fixe / pliage, trains, instructions / annulations) sur le contrat Q-188 (1) ; reste : réception réelle depuis Broadcast (Q-005)
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-105 — Ligne de production du suivi de prod : n'existe qu'avec la prépa (RG-SP-01)
- Origine : NOUVELLE
- Énoncé : une ligne de production n'existe qu'avec la prépa ; quand elle arrive, l'affiche déjà validée y apparaît avec son n° d'affiche ; la jointure se fait par n° de thème (identifiant, Q-208). Les attendues « Broadcast » n'apparaissent pas dans le suivi de production.
- Déclencheur : arrivée de la prépa ; lecture du suivi de production.
- Conditions : ligne `source = PREPA` ; affiche `VALIDEE`.
- Effet / message d'erreur : lecture ; ligne BC masquée (cohérent avec RG-COO-021).
- Sources : spec [RA] §5 RG-SP-01 (EX-COO-040) ; EX-EXI-060 ; legacy `SQL/p_s_adminSuiviRead.sql:64-67`
- Questions liées : Q-208, Q-212
- Implémentation : apps/api/src/modules/coordination/reservations.ts:suiviProduction ; GET /api/coordination/suivi-production — PARTIEL : COO-P05 (2026-11-05) : seules les lignes PREPA, n° d'affiche validée ; reste l'écran Suivi de prod (ECR-PIL-02, D-10)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-106 — Suivi de production : affiches reçues, répartitions, faces, limité aux ateliers de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : le suivi de production présente les affiches reçues (rattachées à une ligne attendue de source PREPA, validées admin) puis les répartitions (`tf_repart_calcul` + UM), puis les faces de trains ; le statut d'une répartition est celui de l'UM si l'UM existe, sinon celui de `tf_repart_calcul` ; limité aux ateliers de l'utilisateur (RG-COO-167). Le détail des colonnes est du ressort du Pilotage (ECR-PIL-02).
- Déclencheur : lecture du suivi de production.
- Conditions : `validationAdmin = 1 AND source = PREPA` pour le n° d'affiche ; périmètre atelier.
- Effet / message d'erreur : lecture seule.
- Sources : legacy `SQL/p_s_adminSuiviRead.sql:64-67,72-115,117-136` ; `BLL/SuiviSuiviProductionBll.cs:112` (ancien ID provisoire RG-COO-030) · spec EX-EXI-060 ; [PP] §3
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/reservations.ts:suiviProduction (statut de l'UM prioritaire, faces, périmètre atelier) — PARTIEL : COO-P05 (2026-11-05) : API en lecture ; reste l'écran ECR-PIL-02 (D-10)
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-107 — État des réservations vivant : N° d'affiche ✓ / •, « Où en est-il » et grain
- Origine : MODIFIÉE
- Énoncé : l'état des réservations affiche tous les dossiers dont la DA est activée, de la semaine en cours aux suivantes, une ligne par dossier et thème ; colonne « N° d'affiche » (✓ validée, • proposé à confirmer) dès la réception ; « Où en est-il » (DA activée, IP saisies, prépa reçue, affiches attendues / reçues en partie, validation admin à confirmer, prêt/en production, produit, expédié, livré, annulé) ; « Afficher par » dossier, DA, thème, destinataire, afficheur, unité, colis, départ, format ; le reçu reste au visuel (pas par destinataire) ; un dossier compte à l'étape la moins avancée de ses lignes. MODIFIÉE : legacy = lecture de Broadcast en direct à chaque recherche avec seule colonne calculée par Circé « Aff. reçues ».
- Déclencheur : lecture de l'écran Pilotage › État des réservations.
- Conditions : périmètre RG-COO-108 ; détail d'écran : ECR-PIL-03 (autre module).
- Effet / message d'erreur : lecture seule.
- Sources : spec [README] §3 ; [DC] §15 (EX-COO-048) ; écran ECR-PIL-03 ; legacy `BLL/SuiviEtatReservationBll.cs:72-104,172-201` ; EX-EXI-010, EX-EXI-011
- Questions liées : Q-200, Q-231
- Implémentation : apps/api/src/modules/coordination/reservations.ts:etatReservations, etapeLigne, etapeMoinsAvancee ; GET /api/coordination/reservations ; apps/web/src/routes/pilotage/reservations.tsx — PARTIEL : COO-P05 (2026-11-05) : « Où en est-il », N° d'affiche • / ✓, grains Dossier / DA / Thème / Format, indicateurs, filtres ; reste les grains Destinataire / Afficheur / Unité / Colis / Départ camion, « Livré », colonnes masquées et export (Q-187 (5) (6))
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts ; apps/api/src/modules/coordination/alimentation-lignes.test.ts ; e2e/coordination-etat-reservations.spec.ts

### RG-COO-108 — État des réservations : sites autorisés et plateformes gérées
- Origine : CONSERVÉE
- Énoncé : seules les lignes dont `IdSiteCCF` correspond à une plateforme gérée (Wissous, Nîmes, DBG, DBG Lyon ; sites 39, 40, 43, 44) rattachée aux ateliers de l'utilisateur sont affichées ; les lignes d'autres sites sont exclues. La liste des plateformes gérées est un référentiel (codée en dur dans le legacy).
- Déclencheur : lecture de l'état des réservations.
- Conditions : site autorisé = `id_site_ccf` des plateformes des ateliers de l'utilisateur ; choix du site dans le bandeau (EX-TRA-006).
- Effet / message d'erreur : filtrage ; ni exception ni alerte pour les lignes exclues.
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:72-104` ; `REP/SuiviEtatReservationRepository.cs:22-36` (ancien ID provisoire RG-COO-032) · spec EX-TRA-006 ; EX-EXI-003, EX-EXI-010
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/reservations.ts:etatReservations (plateformes du périmètre avec site CCF, site choisi revérifié 403 RG-COO-108) — FAIT : COO-P05 (2026-11-05) : plateformes gérées du périmètre ; lignes d'autres sites exclues sans alerte
- Tests : apps/api/test/coordination/lignes-attendues.int.test.ts

### RG-COO-109 — Variante interactive : lecture Broadcast déclenchée depuis l'écran Réception (API PrepaAfficheBC)
- Origine : CONSERVÉE
- Énoncé : l'écran Réception propose de rafraîchir la copie Broadcast à la demande (appel de l'API `PrepaAfficheBC`) ; « à rafraîchir » si la dernière mise à jour a plus de 5 h ou est inconnue ; un code HTTP d'échec ne remonte aucune erreur (défaut : cible = message d'erreur explicite). Selon les docs de l'existant cette voie est du code mort (EX-EXI-012 : « L'ancienne voie Web API est du code mort ») ; applicabilité à trancher avant tout développement.
- Déclencheur : action utilisateur (Réception).
- Conditions : droit d'accès à l'écran Réception.
- Effet / message d'erreur : si conservée : exécution d'un passage d'alimentation limité aux dossiers de l'écran (RG-COO-091, 102) ; sinon non implémentée.
- Sources : legacy `BLL/LivraisonAfficheService.cs:864-926` ; `WEB/Web.config:52` (ancien ID provisoire RG-INT-012, RG-REC-081) · spec EX-EXI-012
- Questions liées : Q-228
- Implémentation : — — BLOQUÉ : COO-P06 (2026-11-05) : Q-228 : « aucun développement avant décision » (variante Web API PrepaAfficheBC, code mort d’après EX-EXI-012)
- Tests : —

### RG-COO-115 — Prérequis des flux Broadcast → Circé et ordre fixe
- Origine : CONSERVÉE
- Énoncé : le traitement d'intégration vérifie l'existence de l'interface de chargement du premier flux avant tout flux (sinon arrêt avec l'erreur explicite « IdInterface non récupéré ! ») puis enchaîne dans l'ordre fixe : destinataires → préparations fixe/pliage → trains d'affiches/instructions (déroulants). Après la préparation, Broadcast est notifié (RG-COO-125) ; après les trains, les données intégrées sont supprimées côté PEX (RG-COO-131).
- Déclencheur : passage du traitement d'intégration (RG-COO-103).
- Conditions : flux déclaré dans `FluxChargement` (`Flux_Destinataire`).
- Effet / message d'erreur : interface absente ⇒ arrêt explicite (le legacy lève une NullReferenceException sans message si la ligne n'existe pas : défaut corrigé).
- Sources : legacy `BLL/BatchAlimBll.cs:34-50,91-124,129-163` ; `REP/BatchAlimRepository.cs:46-57` (ancien ID provisoire RG-COO-040 ; RG-INT-001, RG-INT-002) · spec EX-TRA-039
- Questions liées : Q-005
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:lancerPassage (« IdInterface non récupéré ! », FLUX_INTEGRATION) — FAIT : COO-P06 (2026-11-05) : prérequis explicite avant tout flux ; ordre fixe destinataires → préparations → trains / instructions (état des réservations en tête, retour en fin : Q-188 (2))
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL : comportement implémenté et testé SUR CONTRAT D'ENTRÉE SIMULÉ (Q-188) ; la source réelle (procédures INTERFACE / EXTPLAY / Broadcast, service `webapicirce`) n'est pas dans le dépôt : Q-005 OUVERTE

### RG-COO-116 — Journal de chargement par flux et échec : état partiel assumé et rejouable
- Origine : MODIFIÉE
- Énoncé : chaque flux écrit un journal de chargement (début : statut 1 ; fin : 0 succès, 2 échec ; le statut 6 « warning » du legacy n'est jamais utilisé). En cas d'exception : journal « Echec » (message nettoyé), les flux suivants ne sont pas exécutés ; les flux déjà terminés restent validés (pas de transaction globale) ; le passage est rejouable car l'intégration est idempotente (RG-COO-102). MODIFIÉE : cible = erreur d'un flux visible dans l'écran de suivi des chargements et alertée (non seulement dans `tt_log`), message d'erreur sans concaténation SQL.
- Déclencheur : exception dans un flux.
- Conditions : exception applicative ou SQL.
- Effet / message d'erreur : journal `FluxChargement` 2 + alerte technique ; rien n'est supprimé côté Broadcast si l'intégration a échoué.
- Sources : legacy `BLL/BatchAlimBll.cs:47-49,55-86` ; `REP/BatchAlimRepository.cs:29-30,63-70,89-97` (ancien ID provisoire RG-INT-002) · règle projet CLAUDE.md §6
- Questions liées : Q-005
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:lancerPassage (flux_chargement 1 / 0 / 2, arrêt des suivants), nettoyerMessage, alertesIntegration ; apps/web/src/routes/coordination/integration.tsx — PARTIEL : COO-P06 (2026-11-05) : journal par flux, échec arrête les flux suivants, précédents validés, message nettoyé, erreurs visibles à l’écran « Chargements Broadcast » ; reste : alerte technique affichée dans les Alertes (COO-P07) ; COO-P07 (2026-11-05) : alerte technique « Intégration Broadcast en échec » affichée, levée par un passage réussi → FAIT
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts ; apps/api/src/modules/coordination/integration-flux.test.ts ; e2e/coordination-integration.spec.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL : comportement implémenté et testé SUR CONTRAT D'ENTRÉE SIMULÉ (Q-188) ; la source réelle (procédures INTERFACE / EXTPLAY / Broadcast, service `webapicirce`) n'est pas dans le dépôt : Q-005 OUVERTE

### RG-COO-117 — Délai d'attente, journalisation et secrets des traitements d'échange
- Origine : MODIFIÉE
- Énoncé : les traitements d'échange (lecture/écriture de grosses volumétries) n'ont pas de délai de commande infini : timeout paramétré, journal écrit à chaque fin de flux (pas de journal non vidé en cas de plantage) ; aucun identifiant ni mot de passe en clair dans la configuration (secrets externalisés, ISO 27001).
- Déclencheur : exécution des traitements.
- Conditions : configuration par environnement.
- Effet / message d'erreur : échec explicite après timeout ; mots de passe absents du dépôt.
- Sources : legacy `REP/BatchAlimRepository.cs:38` (`Int32.MaxValue`) ; `ToolBll.cs:57-87` (ancien ID provisoire RG-INT-008) · spec EX-TRA-038 ; Q-010
- Questions liées : Q-010
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:unite (timeout de transaction), lecture bornée ; paramètre integration.timeoutSecondes — FAIT : COO-P06 (2026-11-05) : délai paramétré (valeur HYPOTHÈSE Q-188 (7)), échec explicite « Délai de lecture Broadcast dépassé. » ; aucun secret dans le dépôt V2 (Q-010 concerne le legacy) ; audit COO-P06 (2026-11-05) : test de rejet nommé (délai dépassé)
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-118 — Flux destinataires : seules les adresses de livraison actuelles ou futures
- Origine : CONSERVÉE
- Énoncé : les adresses lues dans Broadcast sont filtrées : conservées si `DateDebutPivot > maintenant` OU (`DateDebutPivot ≤ maintenant` ET `maintenant ≤ DateFinPivot`) ; les périodes échues sont ignorées. La cible permet de gérer des « annule et remplace » (dates de validité : ne garder que la dernière donnée valide, EX-TRA-512/514).
- Déclencheur : flux destinataires.
- Conditions : filtre sur l'ensemble de `P_GetAdresseLivraisonAfficheur`.
- Effet / message d'erreur : les lignes retenues alimentent la table de travail puis l'intégration ; test : adresse échue ignorée.
- Sources : legacy `REP/BatchAlimRepository.cs:102-110,116-156` ; `BLL/BatchAlimBll.cs:60-74` (ancien ID provisoire RG-INT-003) · spec ateliers EX-TRA-512, EX-TRA-514 (A15 slide 15 #2, S L59, L69) ; EX-EXI-015
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:adresseEnVigueur, destinatairesRetenus — FAIT : COO-P06 (2026-11-05) : adresses actuelles ou futures, périodes échues ignorées, annule et remplace (début le plus récent)
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-119 — Intégration des destinataires par type de destination : création et mise à jour, jamais de suppression
- Origine : CONSERVÉE
- Énoncé : l'intégration crée ou met à jour le destinataire et son adresse principale selon le type de destination Broadcast, avec une clé PEX par type : 1 Plateforme (`IdSiteCCF`), 2 Site (`IdSiteCCF`), 3 Société sous-traitante (`IdTiers`), 4 Afficheur (`IdRessource`), 5 Dépôt (`IdDepot`). Création : actif = 1, dispatch = 'O' ; l'adresse n'est insérée que si le destinataire n'en a aucune ; mise à jour de l'adresse seulement si le nom correspond ; `lieu_dit` = lieu-dit + point de remise tronqué à 50 caractères ; un destinataire absent du flux n'est ni désactivé ni supprimé. Défaut à corriger : l'adresse est jointe sur la clé PEX sans le type (site et plateforme partagent `IdSiteCCF`) ⇒ adresse possiblement affectée au mauvais destinataire.
- Déclencheur : flux destinataires.
- Conditions : existence testée sur (clé PEX, type).
- Effet / message d'erreur : upsert ; la jointure d'adresse inclut le type (correction).
- Sources : legacy `SQL/p_integ_destinataire.sql:31-86,152-206,273-327,394-448,514-568` ; `circe-develop/docs/REVIEW_Database_proc.md:161-163` (ancien ID provisoire RG-INT-004) · spec EX-EXI-015
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:integrerDestinataires, lieuDitDe ; modèle DestinataireAdresse — FAIT : COO-P06 (2026-11-05) : upsert par (clé PEX, TYPE) — défaut legacy corrigé ; adresse insérée si aucune, mise à jour si le nom correspond ; jamais désactivé ; audit COO-P06 (2026-11-05) : mises à jour sous verrou de version
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-120 — Transporteur et tarif par défaut pour chaque couple destinataire × atelier
- Origine : CONSERVÉE
- Énoncé : en fin d'intégration des destinataires, pour chaque destinataire et chaque atelier (≠ 0) sans ligne de transport, une ligne est créée : ateliers 1, 2, 5, 7 → transporteur 2, tarif `X24` ; ateliers 3, 4, 6, 8 → transporteur 2, tarif `CX` ; autres ateliers → transporteur 1, tarif `CCF`. Valeurs en dur dans le legacy, à porter en paramètre (consommé par Expédition/Production, hors périmètre).
- Déclencheur : flux destinataires.
- Conditions : `NOT EXISTS (dest_id, ate_id)` ; `ate_id ≠ 0`.
- Effet / message d'erreur : alimentation de `tr_ate_dest_trans` ; signification métier des tarifs incertaine (INCERTAINE dans l'analyse).
- Sources : legacy `SQL/p_integ_destinataire.sql:644-700` (ancien ID provisoire RG-INT-005) · bdd.md §6
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:integrerDestinataires, lireTransports ; modèle TransportDestinataire (tr_ate_dest_trans) ; paramètre integration.transportParAtelier — FAIT : COO-P06 (2026-11-05) : ligne créée pour chaque destinataire × atelier sans ligne, jamais modifiée ensuite ; valeurs legacy en paramètre (Q-227)
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-121 — Routage d'une prépa fixe/pliage vers un atelier et création des lignes à traiter
- Origine : CONSERVÉE
- Énoncé : une prépa Broadcast est routée : type de préparation 23 → atelier pliage (Wissous 2, Nîmes 3, DBG 9, DBG Lyon 10) ; autres types → 2 m² fixe (Wissous 1, Nîmes 4) ; site inconnu → atelier 0 ; les déroulants (types 17 à 21, 28) sont exclus. Une ligne de répartition est insérée au statut 0 (« À traiter ») pour chaque détail de prépa. Condition : `IdSiteCCF ∈ {39, 40, 43, 44}`, statut Broadcast 133 (envoyée), `rpc_statut ≠ 4`. Le type 28 est absent de la liste d'exclusion du second `update` de statut (17-21 seulement) : à clarifier. Le statut des lignes de répartition/UM après création appartient à coo2.
- Déclencheur : flux préparation (RG-COO-115).
- Conditions : voir énoncé ; correspondances en paramètre (référentiel, Q-227).
- Effet / message d'erreur : insertion `tf_repart_calcul` à 0 ; atelier 0 ⇒ ligne créée mais signalée (donnée de référence manquante) ; bascule des lignes attendues : RG-COO-086.
- Sources : legacy `SQL/p_integ_preparation.sql:100-147,239-249,260-264` (ancien ID provisoire RG-COO-041) · spec EX-EXI-017 (EX-COO-046)
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:routerDetail, integrerGroupePreparation ; paramètres integration.routage*, sitesPreparation, statutPrepaEnvoyee, typesDeroulants — FAIT : COO-P06 (2026-11-05) : routage pliage / fixe, déroulants exclus, lignes « À traiter », atelier absent → atelier 0 + donnée de référence signalée, puis RG-COO-086 / 063
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-122 — Une prépa fixe/pliage renvoyée n'est intégrée que si la précédente est annulée
- Origine : CONSERVÉE
- Énoncé : si une ligne (`IdPreparationDetail` + dossier) existe déjà avec `rpc_statut ≠ 4`, la tentative est journalisée et la ligne de travail passe à 4 (annulée) ; l'intégration n'a lieu que si `IdPreparationDetail` n'existe pas encore. Une prépa renvoyée n'est donc intégrée qu'après annulation de la précédente (déblocage, RG-COO-145). Cible : le renvoi refusé est signalé (alerte « prépa renvoyée non intégrée » à la Coordination, Q-216), non plus journalisé seulement.
- Déclencheur : flux préparation.
- Conditions : ligne existante non annulée.
- Effet / message d'erreur : ligne de travail annulée, tentative journalisée ; pas d'erreur remontée (le `@result = 1` est commenté dans le legacy).
- Sources : legacy `SQL/p_integ_preparation.sql:31-54,236-247` (ancien ID provisoire RG-COO-042) · spec EX-EXI-016, EX-EXI-020 ; [PP] §11 (EX-COO-043)
- Questions liées : Q-216
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:integrerGroupePreparation (PREPA_RENVOYEE_NON_INTEGREE) — PARTIEL : COO-P06 (2026-11-05) : renvoi non intégré tant que la ligne n’est pas annulée, tentative tracée ; intégré après annulation ; reste : alerte « prépa renvoyée non intégrée » affichée (COO-P07, Q-216) ; COO-P07 (2026-11-05) : alerte « Prépa renvoyée non intégrée » affichée (Pilotage › Alertes) → FAIT
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts

### RG-COO-123 — Suivi d'intégration par groupe de préparation
- Origine : CONSERVÉE
- Énoncé : après intégration, les lignes de travail correspondantes passent à `rpc_statut = 8` et sont archivées dans `histo_preparation` ; un groupe dont le nombre de statuts distincts est différent de 8 est journalisé « integration groupe de preparation partiel ». Intention non établie (condition `<> 8` quasi toujours vraie, INCERTAINE) : reproduire à l'identique la journalisation, sans blocage, jusqu'à clarification.
- Déclencheur : flux préparation.
- Conditions : `count(distinct rpc_statut) <> 8`.
- Effet / message d'erreur : `tt_log` ; aucun blocage.
- Sources : legacy `SQL/p_integ_preparation.sql:251-291` (ancien ID provisoire RG-COO-043) · bdd.md §5
- Questions liées : Q-228
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:integrerGroupePreparation (INTEGRATION_GROUPE_PREPARATION) — PARTIEL : COO-P06 (2026-11-05) : suivi journalisé par groupe, sans blocage ; « partiel » si des détails ne sont pas intégrés — la condition legacy count(distinct rpc_statut) <> 8 n’est pas reproduite (INCERTAINE, Q-228) ; pas de table histo_preparation
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-124 — Quantités d'entretien des lignes fixe/pliage réalignées selon le jour de la semaine
- Origine : CONSERVÉE
- Énoncé : du lundi au jeudi, `rpc_qte` des lignes de statut 0/1 dont la date du premier départ est ≥ début de semaine + 14 jours est réalignée sur `QuantiteEntretien` de Broadcast ; vendredi à dimanche : seulement pour les départs ≥ + 21 jours ET sans UM. Dépend du paramètre régional `datefirst` (à remplacer par un calcul explicite ISO).
- Déclencheur : flux préparation.
- Conditions : jour de la semaine ∈ {lun…jeu} ; statut ∈ {0, 1} ; (ven…dim : `UM_id` nul).
- Effet / message d'erreur : `rpc_qte`, `rpc_dat_maj` mis à jour ; l'entretien de Broadcast est repris sans ressaisie (EX-COO-501).
- Sources : legacy `SQL/p_integ_preparation.sql:15-24,296-331` (ancien ID provisoire RG-COO-044) · spec ateliers EX-COO-501 ; EX-EXI-075
- Questions liées : Q-224
- Implémentation : FAIT — apps/api/src/modules/coordination/integration-flux.ts:realignerEntretien (appelée par integrerGroupePreparation, flux préparation du passage d'intégration) (COO-P12 (2026-11-05) : lundi à jeudi, la quantité des lignes « A traiter » / « En cours » dont le premier départ est ≥ lundi + 14 j est réalignée sur la `QuantiteEntretien` de Broadcast ; vendredi à dimanche : départs ≥ + 21 j ET lignes sans UM ; calcul ISO explicite (lundi = début de semaine, sans `datefirst`) ; contrat de préparation étendu de `quantiteEntretien` et `datePremierDepart` (HYPOTHÈSE Q-196 (1), source réelle Q-005, Q-224) ; trace au journal du groupe)
- Tests : apps/api/test/coordination/unitaire.int.test.ts

### RG-COO-125 — Accusé d'intégration vers Broadcast après la prépa
- Origine : CONSERVÉE
- Énoncé : après l'intégration d'une prépa (le paramètre de sortie ≠ 0 provoque l'erreur « Erreur dans la procédure : p_integ_preparation ! »), Circé informe Broadcast du statut « intégré » du groupe de préparation (`MajStatutGroupePrepa`). Si l'accusé échoue après l'intégration, Broadcast n'est pas informé mais Circé a intégré (pas de transaction distribuée) : l'accusé est rejoué au passage suivant. La valeur du statut Broadcast « intégré » n'est pas visible dans le dépôt.
- Déclencheur : fin de l'intégration d'une prépa.
- Conditions : groupe de préparation Broadcast au statut 133.
- Effet / message d'erreur : appel EXTPLAY ; en cas d'échec : tentative rejouée, journalisée.
- Sources : legacy `BLL/BatchAlimBll.cs:91-124` ; `REP/BatchAlimRepository.cs:162-266` (ancien ID provisoire RG-COO-040 ; RG-INT-006) · spec EX-EXI-016
- Questions liées : Q-005
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:fluxPreparations (mise en file ACCUSE_PREPA), envoyerEnAttente ; modèle EnvoiBroadcast ; apps/api/src/core/ports/broadcast.ts — PARTIEL : COO-P06 (2026-11-05) : accusé mis en file dans la transaction du groupe, envoyé après, rejoué tant qu’il échoue ; reste : envoi réel (EXTPLAY MajStatutGroupePrepa, valeur du statut « intégré ») : Q-005
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-126 — Atelier déroulant déduit de la surface et du site, sinon 0
- Origine : CONSERVÉE
- Énoncé : l'atelier d'une instruction/face de déroulant est déduit de (surface, site) : (5, 39) → 5 ; (5, 40) → 6 ; (7, 39) → 7 ; (7, 40) → 8 ; (6, 39) → 11 ; (6, 40) → 12 ; tout autre cas → atelier 0. Valeurs en dur dans le legacy : à porter en référentiel (`tr_atelier`).
- Déclencheur : intégration des instructions et des faces.
- Conditions : `IdSurface` et `IdSiteCCF`.
- Effet / message d'erreur : atelier 0 ⇒ instruction à code `…C000…` signalée (donnée de référence manquante) ; EX-EXI-018 : atelier posé seulement pour les surfaces 5 et 7 de Wissous et Nîmes.
- Sources : legacy `SQL/p_integ_instructions.sql:122-131,506-515` ; `SQL/p_integ_train_affiches.sql:68-76` (ancien ID provisoire RG-COO-045) · spec EX-EXI-018
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:lireAtelierDeroulant, atelierDeroulantDe, integrerFacesInstruction, integrerInstructionLue ; paramètre integration.atelierDeroulant — FAIT : COO-P06 (2026-11-05) : atelier déduit de (surface, site) ; sinon atelier 0 + donnée de référence signalée
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-127 — Code d'instruction : année + semaine + « C0 » + atelier + dossier
- Origine : CONSERVÉE
- Énoncé : `instr_code` = AAAA + SS (2 chiffres) + `C0` + atelier (2 chiffres) + dossier (8 chiffres) ; il identifie une instruction par (dossier, semaine, atelier). L'autre plateforme du même format se retrouve par substitution de l'atelier (5↔6, 7↔8, 11↔12) ; le legacy lit l'atelier avec `Substring(8,1)` (1 caractère) et ne marche pas pour 11/12 : à corriger (2 caractères).
- Déclencheur : intégration trains/instructions.
- Conditions : `ate_id` correct (atelier 0 produit « C000 »).
- Effet / message d'erreur : clé de l'instruction (RG-COO-051).
- Sources : legacy `SQL/p_integ_instructions.sql:155-158,559-562` ; `SQL/p_integ_train_affiches.sql:104-109` ; `BLL/TrainListeInstructionBll.cs:526-562` (ancien ID provisoire RG-COO-046) · bdd.md §3
- Questions liées : Q-206
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:codeInstruction — FAIT : COO-P06 (2026-11-05) : AAAA + SS + C0 + atelier (2 chiffres) + dossier (8 chiffres) ; la substitution 5↔6 / 7↔8 / 11↔12 du legacy n’est pas reprise (grain atelier × plateforme RG-COO-051 par les ateliers V2)
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-128 — Type de préparation des visuels d'instruction forcé
- Origine : CONSERVÉE
- Énoncé : tous les visuels d'instruction reçus sont mis à `tpr_id = 10` (scro) et `sup_id = 26` (la clause `where` du legacy est commentée) ; les contrats « bdx » passent à `tpr_id = 2` (bandeau) ; pour les détails : type 21 → venusial (`tpr_id` 11, support 1026), le reste → 10, origine « bdx » → 2. Sens (« venusial ⇒ tout sur du scro ») ambigu : reprise à l'identique tant que non clarifié.
- Déclencheur : intégration des instructions.
- Conditions : lignes 142-153 et 543-554 de la procédure.
- Effet / message d'erreur : types de visuels homogénéisés ; support 26 systématique pour les visuels d'en-tête.
- Sources : legacy `SQL/p_integ_instructions.sql:142-153,543-554` (ancien ID provisoire RG-COO-048 ; confiance INCERTAINE)
- Questions liées : Q-228
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:lireTypesVisuels, typesForces, integrerInstructionLue ; paramètre integration.typesVisuels — FAIT : COO-P06 (2026-11-05) : reprise à l’identique paramétrée (visuels → scro / support 26, bdx → bandeau, type 21 → venusial / 1026) ; identifiant absent du référentiel → null + donnée de référence signalée ; sens à clarifier (Q-228) ; audit COO-P06 (2026-11-05) : test de rejet nommé (type absent du référentiel)
- Tests : apps/api/src/modules/coordination/integration-flux.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-129 — Intégration des faces de trains : ne touche pas aux faces/instructions déjà préparées
- Origine : MODIFIÉE
- Énoncé : (1) les faces dont l'instruction est à un statut autre que 0/1 ne sont pas réintégrées ; (2) les anciennes faces (départ futur) du même dossier/semaine aux statuts 0, 1, 3, 4 sont supprimées puis recréées ; (3) la mise à jour des faces existantes ne vaut que si `rpc_statut ∈ {0, 1}` ; (4) les nouvelles faces sont créées à `rpc_statut = 0` ; (5) les chapeaux d'instruction manquants sont créés (statut 0, type `contrat`, utilisateur « BC »). MODIFIÉE : au-delà de l'Instruction OK les renvois sont ignorés mais signalés (RG-COO-053) ; la suppression/recréation des faces est transactionnelle par dossier.
- Déclencheur : flux trains (`Traitement = 'E'` et `IdTypeDestinationDA` non nul ; `rdep_datdep > maintenant` pour la suppression).
- Conditions : statuts cités ; atomicité par dossier.
- Effet / message d'erreur : `tf_face_train` reflète Broadcast pour tout ce qui n'a pas dépassé l'Instruction OK ; faces 2/5-10 inchangées.
- Sources : legacy `SQL/p_integ_train_affiches.sql:38-48,119-138,155-221,225-267,278-289` (ancien ID provisoire RG-COO-049) · spec [PP] §3 (EX-COO-021) ; EX-EXI-018
- Questions liées : Q-216
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:integrerFacesInstruction, grouperFaces ; apps/api/src/modules/coordination/integration-broadcast.ts:fluxTrains — FAIT : COO-P06 (2026-11-05) : faces au-delà de « En cours » non réintégrées (renvoi tracé, Q-216), faces 0/1/3/4 au départ futur remplacées par dossier × semaine (transaction), faces engagées intactes, chapeau « À traiter » créé
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-130 — Reprise de l'afficheur des faces « dernière minute » pour un même panel
- Origine : CONSERVÉE
- Énoncé : une nouvelle face prend l'afficheur, le nom et le destinataire des faces déjà présentes pour le même panel/semaine/année quand elles sont aux statuts 2, 5, 6, 7, 8, 9, 10 ; après insertion, les faces 0/1 du même panel/semaine reprennent l'afficheur des faces insérées ; pour les panels dont toutes les faces sont ≤ 4, la ressource est mise à jour (`ft_user_maj = 'UpdateRessource'`).
- Déclencheur : flux trains.
- Conditions : `RefPanel` identique ; statuts cités.
- Effet / message d'erreur : cohérence de l'afficheur par panel ; en lien avec RG-COO-074 (DM).
- Sources : legacy `SQL/p_integ_train_affiches.sql:111-117,141-151,270-274,314-339` (ancien ID provisoire RG-COO-050)
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/integration-flux.ts:integrerFacesInstruction (refPanel, afficheur) ; colonnes tf_face_train.ref_panel, pers_ident, pers_nom — FAIT : COO-P06 (2026-11-05) : afficheur repris des faces engagées du même panel / semaine ; faces 0 / 1 alignées sur l’afficheur inséré ; audit COO-P06 (2026-11-05) : 3e clause « UpdateRessource » faite (panels entièrement aux statuts 0 à 4 : ressource reportée sur tout le panel, journal ; panel avec une face > 4 : rien), clauses 1 et 2 sur la semaine / année du contrat comme le legacy, réaffectation sous verrou de version ; Q-188 (16)
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-131 — Flux trains/instructions : verrou de lot, copie, intégration, purge côté PEX
- Origine : CONSERVÉE
- Énoncé : (1) marquage du lot à traiter côté INTERFACE (`Traitement = 'E'` pour les trains ; `talr_trait = '0'` pour instructions/détails) ; (2) purge des tables de travail Circé ; (3) copie en masse du lot marqué en mémorisant les `Id` copiés ; (4) intégration (trains puis instructions ; erreur « Erreur dans la procédure : p_integ_deroulants ! » si résultat ≠ 0) ; (5) suppression côté INTERFACE des seuls `Id` copiés. Si l'intégration échoue rien n'est supprimé (rejouable) ; les lignes arrivées après la capture restent pour le passage suivant ; si la suppression échoue les mêmes données sont renvoyées (intégration idempotente, RG-COO-102). Valeurs de drapeaux non homogènes (« E » vs « 0 ») : INCERTAIN.
- Déclencheur : flux trains.
- Conditions : ordre purge → copie → intégration → suppression.
- Effet / message d'erreur : voir RG-COO-041, 126, 127, 129.
- Sources : legacy `BLL/BatchAlimBll.cs:129-163` ; `REP/BatchAlimRepository.cs:271-333,432-448,600-672,698-714` ; `SQL/p_integ_deroulants.sql:21-30` (ancien ID provisoire RG-INT-007)
- Questions liées : Q-005
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:fluxTrains, fluxInstructions (PURGE_INTERFACE des seuls Id intégrés) ; apps/api/src/modules/coordination/integration-flux.ts:faceAIntegrer — PARTIEL : COO-P06 (2026-11-05) : lot marqué (Traitement E), Id d’un dossier en erreur non purgés (rejouable) ; reste : marquage / copie / suppression réels côté INTERFACE (Q-005)
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts ; apps/api/src/modules/coordination/integration-flux.test.ts

### RG-COO-132 — « Rafraîchir un dossier » : relance manuelle de l'export Broadcast des instructions
- Origine : CONSERVÉE
- Énoncé : l'écran (menu Administration) appelle la procédure Broadcast `ope.P_ExportTrainAfficheTravailCirce` pour un n° de dossier : la zone de travail est ré-alimentée et Circé intègre au prochain passage (RG-COO-131). Réservé au droit legacy `train_rafraichir_contrat` (mappé coord/admin) ; contrôle côté service.
- Déclencheur : action « Rafraîchir un dossier ».
- Conditions : n° de dossier renseigné ; rôle autorisé.
- Effet / message d'erreur : 403 hors rôle ; effet dépendant d'une procédure Broadcast non versionnée (PROBABLE).
- Sources : legacy `REP/AdminContratRepository.cs:21-37` ; `WEB/Views/Shared/_MenuNew.cshtml:176-179` (ancien ID provisoire RG-COO-051 ; RG-ADM-051) · spec EX-EXI-020
- Questions liées : Q-228, Q-201
- Implémentation : apps/api/src/modules/coordination/integration-broadcast.ts:rafraichirDossier ; apps/api/src/modules/coordination/routes-integration.ts ; apps/web/src/routes/coordination/integration.tsx — PARTIEL : COO-P06 (2026-11-05) : coord / admin (403 sinon), demande tracée et rejouée ; reste : appel réel de ope.P_ExportTrainAfficheTravailCirce (Q-005), applicabilité (Q-228) ; audit COO-P06 (2026-11-05) : contrôle de périmètre sur le dossier (403 COO_PERIMETRE_INTERDIT), dossier inconnu réservé aux utilisateurs de tous les sites (Q-188 (15))
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts ; e2e/coordination-integration.spec.ts

### RG-COO-133 — Instruction OK automatique du legacy : détail des règles du batch (RG1 à RG6)
- Origine : MODIFIÉE
- Énoncé : le batch legacy passe les instructions `EN_COURS` (1) de dossiers futurs à `INSTRUCTION_OK` (2) lorsque : commentaire d'instruction vide ET quantité attendue (Σ `instruction_detail`) = quantité réceptionnée (`tf_face_train`), après normalisation automatique des pourcentages de visuels (1 visuel → 100 % ; plusieurs visuels → une ligne « Sans affiche » à 100 %, les autres à 0 %) ; trace dans `tt_log` avec l'utilisateur `BATCH_AUTO_INSTR_OK` ; transaction. La cible reprend la répartition de Broadcast (RG-COO-049) et la règle de Nariman (RG-COO-042) : la normalisation « Sans affiche » n'est PAS reprise sans décision (Q-205). Non déployée d'après le `.sqlproj` (Q-006).
- Déclencheur : INCONNU (aucun appelant dans le dépôt).
- Conditions : dossiers futurs ; statut 1.
- Effet / message d'erreur : documentaire (référence pour les tests de non-régression de RG-COO-042).
- Sources : legacy `SQL/p_batch_auto_instruction_ok.sql:19-37,156-166,193-249,300-307` (ancien ID provisoire RG-INT-042 c) ; bdd.md §8 (RG1–RG6)
- Questions liées : Q-205, Q-006
- Implémentation : apps/api/src/modules/coordination/instruction-ok.ts:motifsNariman (référence de non-régression) — FAIT : COO-P02 (2026-11-04) : normalisation « Sans affiche » non reprise (Q-205)
- Tests : apps/api/test/coordination/instruction-ok-complement.int.test.ts ; apps/api/src/modules/coordination/instruction-ok.test.ts

### RG-COO-134 — Retour vers Broadcast : population exportée, filtre et séquence (« reçue et associée »)
- Origine : MODIFIÉE
- Énoncé : le traitement de retour exporte, pour la semaine courante et les suivantes (semaines ISO, RG-COO-083), (a) les affiches associées à une ligne non Broadcast et (b) les affiches non associées présentes dans `tf_dossier_semaine_depart` sans ligne attendue ; quantité = somme des mouvements (0 si aucun) ; le format « 2m2 Scrolling » est ramené à « 2m2 » ; une ligne n'est envoyée que si `IdDAChapeau` est renseigné OU (`cont_num ≠ "0"` ET semaine/année renseignées) ; `EstAssociee` = lien ET validée (RG-COO-024) ; site CCF déduit de la plateforme par référentiel (le legacy fait 39 si plateforme 1, sinon 40, ce qui envoie DBG avec 40) ; destinataire fixe « CIRCE ». MODIFIÉE : rejeu de toute la population à chaque passage sans filtre `envoye` (legacy) ⇒ cible : n'envoyer que les changements (clé + quantité + `EstAssociee`) ; séquence : insertion interface → pose du drapeau d'envoi par affiche → appel de la procédure de transfert ; en cas d'erreur d'un `AfficheId` inconnu rien n'est marqué à moitié ; lignes écartées journalisées (pas silencieusement).
- Déclencheur : traitement de retour planifié (RG-COO-103).
- Conditions : voir énoncé ; mapping site par référentiel (Q-227).
- Effet / message d'erreur : `CIRCE_PEX_RECEPTION` ; drapeau `envoye` jamais remis à faux ; erreur journalisée `tt_log`. Chevauche RG-REC-110/111 (provisoires legacy-reception) portées par le module Réception.
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:30-57,59-103` ; `REP/BatchAlimReceptionRepository.cs:27-135` ; `SQL/p_batch_alimentation_circe_pex_reception.sql:33-178` (ancien ID provisoire RG-INT-020, 021, 022 ; RG-REC-110, 111) · spec EX-TRA-039 ; EX-EXI-053
- Questions liées : Q-231, Q-227, Q-005
- Implémentation : apps/api/src/modules/coordination/retour-broadcast.ts:populationRetour, formatRetour ; apps/api/src/modules/coordination/integration-broadcast.ts:fluxRetour, envoyerEnAttente — PARTIEL : COO-P06 (2026-11-05) : population (lignes liées, semaines de départ sans ligne : Q-188 (5)), quantité = somme des mouvements, EstAssociee = lien ET validée (Q-231), « 2m2 Scrolling » → « 2m2 », seuls les changements, drapeau envoye après envoi réussi, lignes écartées journalisées ; reste : envoi réel CIRCE_PEX_RECEPTION (Q-005) ; audit COO-P06 (2026-11-05) : population selon le texte et le legacy : (a) lignes non issues de Broadcast (source PREPA, Q-188 (5)), (b) semaines de départ sans lien vers une telle ligne
- Tests : apps/api/test/coordination/integration-broadcast.int.test.ts ; apps/api/src/modules/coordination/integration-flux.test.ts

### RG-COO-140 — Déblocage : la recherche exige un n° de préparation ou un n° de dossier
- Origine : CONSERVÉE
- Énoncé : l'écran de déblocage des préparations ne charge rien sans `IdPreparationChapeau` ni `IdDossierDeVenteChapeau` : la grille est vide (aucun chargement massif).
- Déclencheur : recherche sur l'écran Déblocage préparations (Administration).
- Conditions : les deux critères nuls ⇒ liste vide.
- Effet / message d'erreur : lecture seule ; message de grille vide « Saisissez un n° de préparation ou de dossier » (libellé à définir).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:86-89` ; `WEB/Views/Shared/_MenuNew.cshtml:166-169` (ancien ID provisoire RG-COO-080)
- Questions liées : Q-217
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:rechercherDeblocables ; apps/web/src/routes/coordination/deblocage.tsx — FAIT : COO-P08 (2026-11-05) : sans n° de préparation ni de dossier, grille vide et message « Saisissez un n° de préparation ou de dossier. »
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts ; e2e/coordination-deblocage.spec.ts

### RG-COO-141 — Préparations débloquables filtrées par les règles d'inclusion/exclusion de l'atelier de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : une préparation Broadcast est affichée si, pour au moins un atelier de l'utilisateur dont le site CCF est celui de la préparation, au moins une règle d'inclusion (`tr_atelier_droit_prepa`) correspond ET aucune règle d'exclusion ne correspond ; une règle correspond si (`tpr_id` nul ou égal à la famille du type de préparation) ET (`IdSurface` nul ou égal). Un atelier sans règle ne débloque rien (message tracé), de même un atelier sans site CCF résolu. Données de référence (seed APPFR-3878) : ateliers 1/4 tout sauf pliage/scrolling/venusial ; 2/3/9/10 pliage ; 5/6 scrolling + venusial 2 m² ; 7/8 8 m² ; 11/12 4 m². Chaque groupe porte `InstructionType` UM si une ligne de répartition correspond, sinon TRAIN.
- Déclencheur : recherche de déblocage.
- Conditions : périmètre atelier de l'utilisateur (RG-COO-167).
- Effet / message d'erreur : liste des groupes débloquables ; valeurs du seed non revérifiées (reprises du document du dépôt).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:91-149,338-351` ; `REP/AdminPreparationDeblocageRepository.cs:115-126` ; `circe-develop/docs/regles-inclusion-exclusion-deblocage.md:53-85` (ancien ID provisoire RG-COO-081) · bdd.md §6
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:groupesAutorises, groupeAutorise, regleCorrespond — FAIT : COO-P08 (2026-11-05) : ateliers du périmètre de l’utilisateur, site CCF de la plateforme de l’atelier, inclusion ET aucune exclusion ; traces « aucune règle » / « site CCF introuvable » renvoyées à l’écran ; famille = type (Q-191 (2)) ; source des groupes Q-191 (1) ; valeurs du seed legacy non reprises (Q-227, Q-319)
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-142 — Statut d'avancement de la préparation (`StatutPrepa`) : UM ou TRAIN
- Origine : CONSERVÉE
- Énoncé : pour une préparation de type UM : « En cours » si une UM existe pour (dossier, semaine, année, groupe), sinon « None » (débloquable). Pour TRAIN : faces rapprochées par (dossier, semaine, supports résolus famille × surface, atelier de type scroll du site) ; « None » si toutes les faces sont à 0, 1 ou 4 ET qu'au moins une face de la semaine d'un atelier scroll existe, ou s'il n'y a aucune face ; sinon « En cours ». Le site 39 → plateforme 1, tout autre site → plateforme 2. Si la table de correspondance support est incomplète : aucune face rapprochée (contrôle impossible) et trace « Deblocage : transcoCategSupport absente… » (fail-open : à remplacer par un refus explicite, RG-COO-144).
- Déclencheur : lecture de la grille de déblocage.
- Conditions : voir énoncé.
- Effet / message d'erreur : colonne `StatutPrepa` ; masquage du bouton « Débloquer » : règle non vérifiable (JS introuvable).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:154-250` ; `REP/AdminPreparationDeblocageRepository.cs:148-184` ; `WEB/Views/AdminPreparationDeblocage/Index.cshtml:35,37` (ancien ID provisoire RG-COO-082) · spec EX-EXI-032
- Questions liées : Q-218
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:construireGroupes, controleTrain — FAIT : COO-P08 (2026-11-05) : UM « En cours » si une UM existe, sinon « None » ; TRAIN « None » si aucune face ou faces à 0, 1, 4, sinon « En cours » ; correspondance support absente : statut inconnu et refus explicite (Q-218, Q-191 (4)) ; plateforme du site déduite du référentiel (site CCF de la plateforme) au lieu de « site 39 → plateforme 1, sinon 2 » (Q-191 (11))
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-143 — Blocage du déblocage côté serveur : une UM au statut ≥ 6 (Préparé) bloque
- Origine : CONSERVÉE
- Énoncé : l'action « Débloquer » est refusée avec « Le groupe de preparation n'est pas déblocable ! » si au moins une UM du groupe est à un statut ≥ 6 (Préparé, A expédier, Terminé, Au roulage…). Contrôle exécuté par `p_s_controle_rendumain(IdGroupePreparation)` (non vide ⇒ refus).
- Déclencheur : action « Débloquer ».
- Conditions : UM au statut ≥ 6 dans le groupe.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-143' }` « Le groupe de preparation n'est pas déblocable ! ».
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:263-267` ; `SQL/p_s_controle_rendumain.sql:9-21` ; `WEB/Controllers/AdminPreparationDeblocageController.cs:75-96` (ancien ID provisoire RG-COO-083)
- Questions liées : Q-217
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe (STATUTS_UM_BLOQUANTS, revérifié dans la transaction) — FAIT : COO-P08 (2026-11-05) : 422 « Le groupe de preparation n'est pas déblocable ! » avec la liste des UM, rien n’est écrit ; contrôle sur le groupe Broadcast ENTIER (toutes ses tranches dossier × semaine, audit B1)
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts ; e2e/coordination-deblocage.spec.ts

### RG-COO-144 — Blocage du déblocage côté serveur pour un groupe TRAIN (contrôle des faces)
- Origine : MODIFIÉE
- Énoncé : pour un groupe de type TRAIN, le service refuse le déblocage si au moins une face du groupe est à un statut ≥ 2 (Instruction OK ou au-delà : trains calculés, exportés, en production) ; le déblocage « uniquement si la prod n'est pas lancée ». MODIFIÉE : legacy = aucun contrôle serveur sur les faces (le contrôle n'existe que dans l'affichage `StatutPrepa`) ; proposition (HYPOTHÈSE Q-218) : appliquer côté serveur la règle d'affichage (faces à 0, 1 ou 4 ⇒ débloquable).
- Déclencheur : action « Débloquer » sur un groupe TRAIN.
- Conditions : faces rapprochées comme en RG-COO-142 ; correspondance support absente ⇒ refus explicite (et non fail-open).
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-144' }`.
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:263-267` (aucun contrôle) · spec EX-EXI-032 (« uniquement si la prod n'est pas lancée »), EX-EXI-045
- Questions liées : Q-218, Q-217
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:controleTrain, debloquerGroupe — FAIT : COO-P08 (2026-11-05) : HYPOTHÈSE Q-218 : face au-delà de « En cours » (≠ 0, 1, 4) ⇒ 422 ; correspondance absente ⇒ refus explicite 422 (pas de fail-open)
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-145 — Effet du déblocage : annulation côté Broadcast et Circé, atomicité côté Circé
- Origine : MODIFIÉE
- Énoncé : « Débloquer » (1) demande à Broadcast `P_CirceDebloquerGroupePreparation` (avec le feature flag « PastillePrepaBus ») ; (2) passe à 4 (annulé) les lignes `tf_repart_calcul` du couple (préparation chapeau, groupe) non déjà annulées ET les UM associées (colis non touchés : code commenté) ; (3) archive (`p_i_th_repart_annule`) ; (4) écrit l'historique `DebloquerPreparation` ; (5) envoie le mail (RG-COO-147). Les écritures Circé (2 à 4) forment une transaction unique ; l'appel Broadcast est ordonné de façon à ne pas laisser Circé annulé si Broadcast refuse. MODIFIÉE : legacy = appels successifs sans transaction commune (Broadcast, Circé, archivage, historique, mail).
- Déclencheur : action « Débloquer » ; rôle autorisé (RG-COO-152).
- Conditions : groupe débloquable (RG-COO-143, 144).
- Effet / message d'erreur : `rpc_statut` ≠ 4 → 4 ; la prépa annulée peut être renvoyée par Broadcast et intégrée (RG-COO-122) ; échec de l'appel Broadcast ⇒ 502 sans écriture Circé.
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:252-333` ; `REP/AdminPreparationDeblocageRepository.cs:63-107` ; `SQL/p_u_statut_repart_deblocage.sql:30-87` ; `BLL/HistorisationBll.cs:118-127` (ancien ID provisoire RG-COO-084 ; RG-INT-044) · spec EX-EXI-020
- Questions liées : Q-217, Q-218
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe ; routes-deblocage.ts (POST /api/coordination/deblocage/groupes, Idempotency-Key) — PARTIEL : COO-P08 (2026-11-05) : une transaction : répartitions et UM annulées, trace, historique, demande Broadcast mise en file (Q-191 (3)) ; transition INTEGRE → DEBLOQUE, 409 sinon ; reste : appel réel à Broadcast `P_CirceDebloquerGroupePreparation` (Q-005) ; demande refusée par Broadcast : alerte « Déblocage non transmis à Broadcast » (Q-191 (12))
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts ; e2e/coordination-deblocage.spec.ts

### RG-COO-146 — Trace du déblocage : qui, quand, quoi
- Origine : CONSERVÉE
- Énoncé : tout déblocage écrit une trace (`th_repart_annule` : répartitions annulées ; historique `DebloquerPreparation` avec nom de l'utilisateur et date) consultable par « Préparations débloquées » (RG-COO-149).
- Déclencheur : déblocage réussi.
- Conditions : même transaction que RG-COO-145.
- Effet / message d'erreur : échec d'écriture ⇒ déblocage annulé.
- Sources : legacy `SQL/p_i_th_repart_annule` ; `BLL/HistorisationBll.cs:118-127` (ancien ID provisoire RG-COO-084) · bdd.md §5
- Questions liées : —
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe (modèle DeblocagePreparation, historique DEBLOQUER_PREPARATION du dossier, historiques de statut) — FAIT : COO-P08 (2026-11-05) : qui, quand, motif, ids annulés ; échec d’écriture ⇒ déblocage annulé (testé par panne simulée)
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-147 — Mail de déblocage : destinataires de la plateforme, envoi non bloquant
- Origine : MODIFIÉE
- Énoncé : après le déblocage, un mail « Déblocages - groupe préparation… » est envoyé aux adresses de la plateforme du site (`tr_plateforme.plt_mail`, liste séparée par virgules), préfixé par l'environnement hors production. L'échec d'envoi (SMTP) est journalisé et n'annule ni ne fait échouer le déblocage déjà committé. MODIFIÉE : legacy = envoi sans `try/catch` (une panne SMTP fait échouer l'action après l'annulation) ; liste tronquée dans l'ancien écran ; encodage windows-1250.
- Déclencheur : fin de RG-COO-145.
- Conditions : au moins une adresse ; sinon avertissement tracé.
- Effet / message d'erreur : mail envoyé après commit ; destinataires paramétrables par liste de distribution (Q-219).
- Sources : legacy `BLL/AdminPreparationDeblocageBll.cs:252-333` (ancien ID provisoire RG-COO-084 ; RG-ADM-042) · spec EX-TRA-030 (« Déblocages » mail existant)
- Questions liées : Q-219
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe (mailStatut, mailDestinataires) — PARTIEL : COO-P08 (2026-11-05) : destinataires = adresses de la plateforme du site (Q-219), sans adresse : avertissement tracé, déblocage fait ; reste : envoi réel (Q-375)
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-148 — Prépa renvoyée après déblocage : intégrée normalement
- Origine : CONSERVÉE
- Énoncé : après un déblocage réussi, Broadcast peut renvoyer la préparation ; elle est intégrée (RG-COO-122) et remet le dossier à `PREPARATION_RECUE` ; les anciennes lignes annulées restent historisées. Sans déblocage, une prépa renvoyée est refusée.
- Déclencheur : flux préparation après déblocage.
- Conditions : lignes précédentes à 4.
- Effet / message d'erreur : voir RG-COO-122, 063.
- Sources : legacy `SQL/p_integ_preparation.sql:31-54,236-247` ; spec EX-EXI-016, EX-EXI-020 ; EX-EXI-045
- Questions liées : Q-216
- Implémentation : integration-flux.ts:integrerGroupePreparation (RG-COO-122) + apps/api/src/modules/coordination/deblocage.ts — FAIT : COO-P08 (2026-11-05) : sans déblocage la prépa renvoyée est refusée ; après déblocage elle est intégrée (nouvelles répartitions, anciennes annulées conservées), dossier « Préparation reçue », groupe de nouveau « intégré » ; source réelle Q-005
- Tests : apps/api/test/coordination/deblocage.int.test.ts

### RG-COO-149 — Suivi des déblocages : période et libellés
- Origine : CONSERVÉE
- Énoncé : l'écran « Préparations débloquées » exige une date de fin ≥ date de début (« La date de fin doit être supérieur à la date de début ! ») ; la période par défaut est le dernier mois ; le type « Tole traditionnelle » est affiché « 4m² colle » ; le site est traduit par `TranscoderLibelleSiteCCF`. Droit legacy `view_repart`.
- Déclencheur : recherche sur l'écran.
- Conditions : fin ≥ début.
- Effet / message d'erreur : 422 « La date de fin doit être supérieur à la date de début ! » ; lecture (`p_s_th_repart_annule`).
- Sources : legacy `BLL/AdminSuiviDeblocageBll.cs:25-65,76-100` ; `WEB/Views/Shared/_MenuNew.cshtml:171-174` (ancien ID provisoire RG-COO-086)
- Questions liées : Q-227
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:listerDeblocages, libelleTypeSuivi ; apps/web/src/routes/coordination/deblocage.tsx (section « Préparations débloquées ») — FAIT : COO-P08 (2026-11-05) : période par défaut = le dernier mois, fin < début ⇒ 422 « La date de fin doit être supérieur à la date de début ! », « Tole traditionnelle » → « 4m² colle », site traduit (nom de la plateforme), périmètre
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts ; e2e/coordination-deblocage.spec.ts

### RG-COO-150 — Ancien écran « Répartitions déblocables » (Sybase AMT) : ne pas reproduire le déblocage des lignes non cochées
- Origine : CONSERVÉE
- Énoncé : l'ancien écran envoyait à `DebloquerRepartitions` toutes les lignes reçues moins celles jugées non déblocables parmi les cochées : les lignes non cochées étaient donc débloquées (défaut) ; appel de la procédure Sybase `p_urpfo01` puis des procédures Circé ; mail aux logisticiens. Le menu actif ne pointe plus vers cet écran (probablement mort) : applicabilité à confirmer (Q-228) ; si conservé, seules les lignes cochées sont débloquées.
- Déclencheur : écran Répartitions déblocables (droits `debloque_repart` / `view_repart`).
- Conditions : lignes cochées uniquement (cible).
- Effet / message d'erreur : annulation de répartitions côté Circé (4) ; non implémenté tant que Q-228 est ouverte.
- Sources : legacy `WEB/Controllers/Repartition/RepartitionController.cs:218-242,253-326,328-351` ; `BLL/RepartitionService.cs:35-53` ; `REP/RepartitionRepository.cs:87-136` (ancien ID provisoire RG-COO-085 ; confiance PROBABLE)
- Questions liées : Q-228
- Implémentation : — BLOQUÉ (Q-228 : « aucun développement avant décision ») : COO-P08 (2026-11-05) : aucun écran ni route « Répartitions déblocables » (test d’absence)
- Tests : apps/api/test/coordination/deblocage.int.test.ts

### RG-COO-151 — « Rendre la main à la Pré-Prod » (fixe) et déblocage : consignes de cohérence
- Origine : NOUVELLE
- Énoncé : « Rendre la main à la Pré-Prod » (écran 2 m² fixe/pliage/bus, motif obligatoire à défaut « Changement de visuel demandé par le client ») équivaut côté Coordination au déblocage du groupe de préparation (RG-COO-145) : le dossier reste `PREPARATION_RECUE`, la validation admin et les affiches reçues ne sont pas modifiées (HYPOTHÈSE Q-217), les unités déjà en production ne sont pas retirées (point de non-retour, coo2). Déroulant : seulement si la production n'est pas lancée (RG-COO-144) ; fixe : possible même après l'envoi de la prépa (retirer, puis débloquer, puis le gestionnaire renvoie la prépa).
- Déclencheur : action « Rendre la main ».
- Conditions : rôle autorisé ; groupe débloquable.
- Effet / message d'erreur : voir RG-COO-145 ; les unités non lancées passent « En attente » (coo2) ; contradiction ateliers (13 vs 14 slide 30 #4) non tranchée.
- Sources : maquette ECR-COO-09b ; spec EX-EXI-045 ; ateliers contradiction 1 ; `maquettes-reception-coordination.md` (Q-COO-18)
- Questions liées : Q-217
- Implémentation : FAIT — apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe ; apps/web/src/routes/coordination/deblocage.tsx ; apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:rendreLaMain (COO-P08 : déblocage du groupe (Q-382), motif par défaut, dossier « Préparation reçue », validation admin et affiches inchangées (RG-X-059) ; COO-P12 (2026-11-05) : l'action « Rendre la main » de l'écran unitaire (ECR-COO-09b) fait passer les unités non lancées « A traiter » (EN_ATTENTE) avec le repère « main rendue » (RG-COO-243))
- Tests : apps/api/test/coordination/deblocage.int.test.ts, apps/api/src/modules/coordination/deblocage.test.ts, e2e/coordination-deblocage.spec.ts, apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-152 — Droits du déblocage et de son suivi
- Origine : MODIFIÉE
- Énoncé : le déblocage (legacy `debloque_repart`) et « Rafraîchir un dossier » (`train_rafraichir_contrat`) sont réservés aux rôles `coord` et `admin` (provisoire) ; « Préparations débloquées » (`view_repart`) est en lecture pour `coord` et `admin` ; contrôle côté service (le legacy masque seulement l'entrée de menu).
- Déclencheur : toute action de déblocage / suivi.
- Conditions : rôle ∈ {coord, admin}.
- Effet / message d'erreur : 403 `{ regle: 'RG-COO-152' }`.
- Sources : legacy `WEB/Views/Shared/_MenuNew.cshtml:155-179` ; `BLL/CommunBll.cs:31-40` ; `legacy-admin.md §B` (ancien ID provisoire RG-COO-091, 090)
- Questions liées : Q-201, Q-217, Q-003
- Implémentation : apps/api/src/modules/coordination/deblocage.ts (assertDroitCoordination deblocage.consulter / deblocage.executer) — FAIT : COO-P08 (2026-11-05) : coord et admin ; cheq, recep, expe : 403 RG-COO-152 ; com : 403 RG-COO-168
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-160 — Historique des actions de coordination
- Origine : MODIFIÉE
- Énoncé : les actions suivantes écrivent une ligne d'historique nominative (acteur, date, ancienne/nouvelle valeur) : validation et annulation de validation (ModificationValidationAdmin), rattachement et retrait (AfficheAssocier / AfficheDissocier distincts), changement de statut d'instruction (tous statuts, ChangementStatutInstruction), modification entretien/position (ModificationInstructionPlus), export des trains (ExporterTrains, coo2), déblocage (DebloquerPreparation), demande de correction à Broadcast, application de la version Broadcast. Les traitements automatiques écrivent aussi (acteur « Circé (automatique) »). Les entités historisées : Affiche, Instruction, Trains, Dossier.
- Déclencheur : chacune des actions listées.
- Conditions : même transaction que l'action.
- Effet / message d'erreur : refus de l'action si l'écriture échoue.
- Sources : legacy `BLL/HistorisationBll.cs:16-127` (ancien ID provisoire RG-INT-046) ; bdd.md §5 · spec EX-TRA-034, EX-TRA-036
- Questions liées : Q-004
- Implémentation : apps/api/src/modules/coordination/instructions.ts, integration.ts (ecrireJournal) — PARTIEL : COO-P01 (2026-11-04) : changements de statut d’instruction et de dossier journalisés ; les autres actions (Instruction OK, export, déblocage, corrections) dans leurs parcours
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-165 — Droits contrôlés côté service (plus seulement masqués)
- Origine : MODIFIÉE
- Énoncé : chaque endpoint de coordination vérifie le rôle de l'utilisateur dans le service ; masquer un bouton ne suffit pas. Un appel direct sans droit est refusé 403. Legacy : `EstAutorise(droit, user)` (entrée `tr_utilisateur_menu` en cache de session) pour le menu et les boutons seulement ; aucun `[Authorize]` ; droits chargés une fois par session ; aucun jeton anti-CSRF.
- Déclencheur : tout appel d'API de coordination.
- Conditions : rôle ∈ matrice section 2 ; session à jour (droits relus à chaque requête ou à durée courte).
- Effet / message d'erreur : 401 sans authentification, 403 sans droit `{ code: 'PERMISSION', regle: 'RG-COO-165' }`.
- Sources : legacy `BLL/CommunBll.cs:276-303` ; recherche `[Authorize]`/`EstAutorise(` dans `WEB/Controllers` : 0 occurrence (ancien ID provisoire RG-COO-090 ; RG-ADM-015) · spec EX-TRA-002 ; EX-TRA-001
- Questions liées : Q-001, Q-003
- Implémentation : apps/api/src/modules/coordination/permissions.ts:assertDroitCoordination — PARTIEL : COO-P01 (2026-11-04) : 401 / 403 côté service ; authentification réelle : Q-001 (fournisseur de dev)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-166 — Correspondance droits legacy ↔ rôles de la cible pour les écrans de coordination
- Origine : MODIFIÉE
- Énoncé : « Liste des instructions » (`pliage_a_traiter`), « Etat des réservations » et « Suivi de production » (`suivi_suivi_production`), case validation admin (`validation_admin`), déblocage (`debloque_repart`), suivi des déblocages (`view_repart`), « Rafraîchir un dossier » (`train_rafraichir_contrat`) sont mappés sur les rôles provisoires de la maquette : `coord` et `admin` pour les actions d'écriture, lecture pour `cheq` et `com` sur les écrans de suivi, `recep` en lecture sur la fiche affiche (motif de doute et état de validation). Les actions de trains (`pliage`, `train_*`) relèvent de coo2. Mapping à refaire si l'équipe choisit d'autres profils (Q-003).
- Déclencheur : contrôle d'accès.
- Conditions : voir section 2.
- Effet / message d'erreur : voir RG-COO-165.
- Sources : legacy `WEB/Views/Shared/_MenuNew.cshtml:84-107,140-152,166-183` ; `BLL/CommunBll.cs:31-40` (ancien ID provisoire RG-COO-091) ; `legacy-admin.md §2, §4` · maquette ECR-COO-01 (`roles` : coord, admin)
- Questions liées : Q-003, Q-201
- Implémentation : apps/api/src/core/permissions/catalogue.ts ; apps/api/src/modules/coordination/permissions.ts — FAIT : COO-P01 (2026-11-04) : instruction.consulter / annuler / instruction_ok
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-167 — Périmètre par atelier / site de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : les listes d'instructions, l'état des réservations, le suivi de production, le déblocage et les alertes de coordination ne montrent que les ateliers/sites rattachés à l'utilisateur ; la liste de choix d'atelier ajoute « Tous » si plusieurs ateliers ; un utilisateur sans périmètre voit une liste vide ; le site choisi dans le bandeau vaut pour toute l'application (filtre « Départ » dans la page, plus de semaine globale). Les critères de filtre sont mémorisés par utilisateur (préférence d'interface, non métier).
- Déclencheur : lecture des écrans.
- Conditions : périmètre = (plateforme, atelier) de l'utilisateur (`tr_utilisateur_data`, V2 : périmètre site/atelier) ; l'`admin` voit tous les sites.
- Effet / message d'erreur : filtrage côté API (pas seulement front) ; 403 sur un identifiant hors périmètre.
- Sources : legacy `BLL/TrainListeInstructionBll.cs:31-108,117-168` ; `BLL/TrainSuiviThemeBll.cs:31-98` ; `SQL/p_s_adminSuiviRead.sql:91-94,111-113` ; `BLL/SuiviEtatReservationBll.cs:75-98` (ancien ID provisoire RG-COO-092 ; RG-ADM-016) · spec EX-TRA-006 (EX-TRA-003)
- Questions liées : Q-003
- Implémentation : apps/api/src/modules/coordination/permissions.ts:assertPerimetreAtelier, peutVoirAtelier ; dossiers.ts — PARTIEL : COO-P01 (2026-11-04) : liste filtrée par site / atelier, 403 hors périmètre (y compris filtre atelier) ; HYPOTHÈSE Q-182 (1) ; reste la mémorisation des filtres par utilisateur et le sélecteur de site (Q-173)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-168 — Rôle Commerce : lecture seule
- Origine : NOUVELLE
- Énoncé : le rôle `com` consulte le suivi, l'état des réservations et les affiches reçues sans aucun bouton d'action de coordination (ni validation, ni Instruction OK, ni demande de correction, ni déblocage). Plus de mail de réception au commercial (besoin refusé le 14/10).
- Déclencheur : toute action d'écriture par `com`.
- Conditions : rôle `com`.
- Effet / message d'erreur : 403 `{ regle: 'RG-COO-168' }`.
- Sources : spec [README] H10 ; [DESIGN] §8 ; [DC] §2 (EX-TRA-004) ; EX-REC-072 ; ateliers EX-REC-523 (« Besoin Refusé »)
- Questions liées : Q-003
- Implémentation : apps/api/src/modules/coordination/permissions.ts:assertDroitCoordination (403 RG-COO-168) — FAIT : COO-P01 (2026-11-04)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### RG-COO-169 — La Pré-Prod n'est pas utilisatrice de Circé
- Origine : NOUVELLE
- Énoncé : la Pré-Prod (gestionnaires) travaille dans Broadcast seulement (saisie des IP, envoi de la prépa) ; elle n'a aucun compte ni rôle dans Circé ; ses interactions avec Circé passent par les mails de demande de correction (RG-COO-057, 069) et par les flux de Broadcast. Les actions « Pré-Prod » du legacy (retirer, rendre la main, valider) sont portées par la Coordination. À Nîmes la Coordination se nomme « Pré-Prod Nîmes » (déduit, Q-221).
- Déclencheur : création de compte / attribution de rôle.
- Conditions : rôle `pre-prod` inexistant.
- Effet / message d'erreur : aucun rôle Pré-Prod n'est attribuable.
- Sources : spec [PP] §1, §2 (EX-COO-003) ; maquettes-autres-modules.md §0.6 point 1 (rôle Pré-Prod supprimé le 27/10)
- Questions liées : Q-221
- Implémentation : packages/shared/src/roles.ts (6 rôles, aucun Pré-Prod) — FAIT : COO-P01 (2026-11-04)
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts

### Bloc 2 (RG-COO-200…399)
### RG-COO-200 — Identifiant et version d'un train
- Origine : CONSERVÉE
- Énoncé : `train_id` = AA (2 derniers chiffres de l'année) + SS (semaine sur 2 chiffres) + secteur (3) + département (2) + commune (3) + n° d'emplacement (4) + n° de train (1) + version (1). La version vaut (max des versions des faces de statut 5 à 10 pour le même emplacement / train / semaine) + 1, sinon 0. Une instruction renvoyée après impression crée donc une nouvelle version du train.
- Déclencheur : passage d'une instruction à « Instruction ok » (transition possédée par coo1 ; effets de calcul décrits ici).
- Conditions : statuts pris en compte pour la recherche de version : 5, 6, 7, 8, 9, 10.
- Effet / message d'erreur : `train_id` et `version` posés sur les faces ; aucune erreur applicative (calcul).
- Sources : legacy `p_u_associe_train.sql:159-179,366-374` (ancien ID provisoire RG-COO-067, legacy-coordination.md) ; spec `specs-coordination.md §C` (EX-COO-021) ; écran `ECR-COO-05`
- Questions liées : Q-250
- Implémentation : FAIT — apps/api/src/modules/coordination/trains-calcul.ts:identifiantTrain, calculerTrains (appelé par instruction-ok.ts:passerInstructionOk) (COO-P09 (2026-11-05) : train_id et version calculés à l’Instruction OK ; emplacement reçu par le contrat de faces, Q-192 (1))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-201 — Position dans le train (début, fin, fin-1, milieu)
- Origine : CONSERVÉE
- Énoncé : le code de position porté par l'instruction (`tip_ins_code`) fixe l'ordre des faces : 1 = début de train (ordre 0) ; 2 = fin de train (ordre 99) ; 3 = fin moins 1 (ordre 98) ; 4 = milieu (ordre 15) ; autre valeur = ordre égal au rang proposé. `ordre_propose` et `ordre_reel` sont alimentés à l'Instruction OK.
- Déclencheur : passage à « Instruction ok ».
- Conditions : le champ position est modifiable seulement tant que l'instruction n'est ni « Instruction ok » ni « A imprimer » (RG-COO-1xx, coo1).
- Effet / message d'erreur : faces passées au statut 2 avec leur ordre. En cible la position d'un visuel est « figée » après Instruction OK ; la règle de modification manuelle (début / fin de train) n'a pas d'écran d'édition dans la maquette (Q-COO-7 de la maquette).
- Sources : legacy `p_u_associe_train.sql:132-157`, `Enums.cs:274-286` (ancien ID provisoire RG-COO-065) ; spec `specs-coordination.md §C` (EX-COO-019, EX-COO-021, EX-COO-023) ; écran `ECR-COO-02`
- Questions liées : Q-261
- Implémentation : FAIT — apps/api/src/modules/coordination/trains-calcul.ts:ordreReel, calculerTrains (COO-P09 : ordre proposé = rang, ordre réel selon la position (0 / 99 / 98 / 15))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-202 — Répartition des thèmes sur les faces d'un train
- Origine : CONSERVÉE
- Énoncé : les exceptions (`instruction_detail`) affectent d'abord un thème / repiquage à une face précise (`ft_type = 'exception'`). Les faces restantes (`ft_type = 'face'`) reçoivent les thèmes d'`instruction_visuels` de type 10 au prorata des pourcentages (`nb_tot = int(pourcentage × nombre de faces)`), en parcourant les faces triées par secteur / département / commune / adresse. Les bandeaux à 100 % non traités en exception sont affectés à toutes les faces. Les thèmes de moins de 3 caractères sont complétés par `---` ; guillemets et apostrophes sont remplacés par des espaces.
- Déclencheur : passage à « Instruction ok » (manuel ou automatique).
- Conditions : `instruction_visuels.tpr_id = 10` ; la répartition doit totaliser 100 % pour chaque (dimension, type de préparation) sinon la sauvegarde est refusée par la règle de contrôle de l'instruction (coo1).
- Effet / message d'erreur : `theme`, `theme_id`, `repiquage`, `insv_id`, `ft_type` posés ; faces 0/1 → 2.
- Sources : legacy `p_u_associe_train.sql:81-111,181-345,347-363,377-394` (ancien ID provisoire RG-COO-066) ; spec `specs-existant-process.md §C` (EX-EXI-031) ; écran `ECR-COO-02`
- Questions liées : Q-257
- Implémentation : FAIT — apps/api/src/modules/coordination/trains-calcul.ts:repartirThemes, nettoyerTheme, calculerTrains (COO-P09 : exceptions, prorata (curseur legacy), bandeaux 100 %, nettoyage ; visuel sans type = visuel, Q-192 (2))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-203 — Faces d'entretien d'un train (pourcentage, afficheur « ENTRETIEN »)
- Origine : MODIFIÉE
- Énoncé : pour chaque (destinataire, thème, secteur, semaine, année, thème-repiquage, support, type), le nombre de faces d'entretien legacy = `round(nombre de faces × % d'entretien / 100)`, % par défaut 8 si nul, `nb > 0` ; faces créées avec `ft_type = 'entretien'`, statut 2, afficheur littéral « ENTRETIEN », identifiant de train finissant par 19, `ordre_propose = ordre_reel = 1`. Un bloc distinct traite la convention `VPS_75 101 0004` (Paris) ; aucune autre différence fonctionnelle n'a été trouvée entre les deux blocs. MODIFIÉE : la cible calcule l'entretien « à l'afficheur » (seuil, arrondi supérieur, voir RG-COO-238) ; le choix legacy (arrondi `round`, grain thème) ou cible (arrondi supérieur, grain afficheur) pour les faces d'entretien de train est à trancher.
- Déclencheur : passage à « Instruction ok ».
- Conditions : les faces d'entretien sont supprimées au retour de l'instruction à 0, 1, 4 ou 5 (RG-COO-206).
- Effet / message d'erreur : lignes `tf_face_train` d'entretien ; aucun message.
- Sources : legacy `p_u_associe_train.sql:401-439,578-583,555-699` (anciens ID provisoires RG-COO-068 et RG-RPR-027) ; spec `specs-existant-process.md §F` (EX-EXI-075), `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-508) ; écran `ECR-COO-02`, `ECR-ADM-05`
- Questions liées : Q-255, Q-256
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains-calcul.ts:nombreEntretien, identifiantTrainEntretien, calculerTrains (COO-P09 : faces d’entretien (grain / seuil / arrondi en paramètres, Q-256 ; départ du groupe, Q-192 (4)). Reste : bloc « Paris » (convention VPS_75 101 0004) non repris, Q-255 OUVERTE)
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-204 — Campagne contrôlée : 15 % d'entretien et visuel en tête de train
- Origine : NOUVELLE
- Énoncé : pour une campagne contrôlée (CC), l'entretien est de 15 % et le visuel de la CC est placé en position 1 (début de train) automatiquement, sans intervention manuelle de la Coordination. Aujourd'hui la Coordination change cette position à la main.
- Déclencheur : Instruction OK automatique ou manuelle.
- Conditions : dossier marqué « campagne contrôlée » (repère « Contrôlée » ; ~12 % des trains dans les données MOCK).
- Effet / message d'erreur : % d'entretien 15 au lieu de 8 ; position 1 sur le visuel de la CC. La source de l'indicateur « contrôlée » n'est pas définie (Broadcast ou saisie).
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-508), `specs-existant-process.md §F` (EX-EXI-075) ; écran `ECR-COO-01` (données MOCK), `ECR-ADM-05` (« Campagne contrôlée (15 % et visuel en début de train) »)
- Questions liées : Q-257
- Implémentation : — — BLOQUÉ : BLOQUÉ Q-257 : source de l’indicateur « campagne contrôlée » inconnue
- Tests : apps/api/test/coordination/instruction-ok-complement.int.test.ts

### RG-COO-205 — Garde-fous anti-doublons sur les faces et les afficheurs d'un train
- Origine : CONSERVÉE
- Énoncé : (1) si deux faces non entretien d'un même train partagent le même cadre (`cadr_ident`), la plus récente est conservée, les autres passent à 4 (Annulé) avec `train_id = NULL` ; (2) si un train a plusieurs afficheurs (`pers_ident`), tous prennent l'afficheur de la face la plus récente ; (3) les faces de statut 2 sans `train_id` après traitement sont supprimées.
- Déclencheur : fin du calcul des trains (Instruction OK).
- Conditions : `ft_type <> 'entretien'`.
- Effet / message d'erreur : annulation silencieuse de faces en legacy. En cible l'annulation d'une face doit écrire un historique (CLAUDE.md §6) et être visible au calcul.
- Sources : legacy `p_u_associe_train.sql:703-838` (ancien ID provisoire RG-COO-069)
- Questions liées : —
- Implémentation : FAIT — apps/api/src/modules/coordination/trains-calcul.ts:calculerTrains (COO-P09 : doublon de cadre annulé avec historique, afficheur unifié, face sans train annulée (pas supprimée, Q-192 (3)) ; faces en production jamais touchées (RG-COO-223))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-206 — Retour arrière de l'instruction : effacement du calcul des trains sauf « A imprimer »
- Origine : CONSERVÉE
- Énoncé : quand l'instruction repasse à 0, 1 ou 4 (ou 5 par la procédure), les faces d'entretien non au statut 5 sont supprimées et les faces non au statut 5 sont remises à blanc (thème, repiquage, train, version vidés, statut = code demandé). Les faces déjà « A imprimer » sont conservées. Pour le code 2, `p_u_associe_train` est rappelée. La transition d'instruction elle-même est possédée par coo1.
- Déclencheur : changement de statut d'instruction autorisé par la table de transitions (coo1).
- Conditions : instruction de statut initial ≠ 5 ; changement de statut effectif.
- Effet / message d'erreur : faces remises à blanc ; l'export des trains (RG-COO-210) ne reprendra que les faces recalculées au statut 2.
- Sources : legacy `p_u_statut_preparation.sql:24-64`, `TrainListeInstructionBll.cs:372-380,396-403` (ancien ID provisoire RG-COO-064) ; spec `specs-coordination.md §C` (EX-COO-020) ; `specs-existant-process.md §C` (EX-EXI-030)
- Questions liées : —
- Implémentation : FAIT — apps/api/src/modules/coordination/instructions.ts:effacerCalculTrains (RG-COO-046) (COO-P09 : effacement testé après un vrai calcul (entretien supprimé, faces à blanc, « A imprimer » conservées) ; la position fractionnée est remise à zéro)
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts ; apps/api/test/coordination/socle*.int.test.ts

### RG-COO-207 — Reprise de l'afficheur d'un panneau pour les faces « dernière minute »
- Origine : CONSERVÉE
- Énoncé : une nouvelle face prend l'afficheur, le nom et le destinataire des faces déjà présentes pour le même panneau (`RefPanel`) / semaine / année lorsque ces faces sont aux statuts 2, 5, 6, 7, 8, 9, 10. Après insertion, les faces 0/1 du même panneau reprennent l'afficheur des faces insérées ; pour les panneaux dont toutes les faces sont ≤ 4, la ressource est mise à jour (`ft_user_maj = 'UpdateRessource'`).
- Déclencheur : intégration des faces de trains (flux d'alimentation, coo1 ; règle d'aval portée ici).
- Conditions : `RefPanel` identique ; statuts cités.
- Effet / message d'erreur : cohérence de l'afficheur par panneau. Ne modifie pas un train en production (RG-COO-223).
- Sources : legacy `p_integ_train_affiches.sql:111-117,141-151,270-274,314-339` (ancien ID provisoire RG-COO-050)
- Questions liées : Q-282
- Implémentation : FAIT — apps/api/src/modules/coordination/integration-flux.ts:integrerFacesInstruction, mettreAJourRessourcesPanels (RG-COO-130) (COO-P09 : même règle que RG-COO-130 (reprise de l’afficheur par panneau), testée sous son ID)
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts ; apps/api/test/coordination/integration-broadcast.int.test.ts

### RG-COO-208 — Couverture des visuels et passage automatique EN_ATTENTE → PRET d'une unité
- Origine : NOUVELLE
- Énoncé : une unité de production (train, UM, lot) est « En attente d'affiches » (EN_ATTENTE) tant que tous ses visuels (positions non fractionnées) ne sont pas couverts par le reçu ; elle passe automatiquement à « Prêt à produire » (PRET) quand tous les visuels sont couverts ou fractionnés. Couverture : chaque thème reçu alimente d'abord les unités dont le départ camion est le plus proche. Le reçu se compte au visuel (thème), pas par destinataire. La couverture est recalculée à chaque événement de réception, de fractionnement, de raccrochage, de suppression de train.
- Déclencheur : réception d'affiche (REC), fractionnement, raccrochage, suppression de train, passage à Instruction OK.
- Conditions : `EN_PROD` et au-delà ne repassent jamais en arrière (RG-COO-223).
- Effet / message d'erreur : statut d'unité mis à jour avec historique ; indicateurs du Suivi de prod (A, B, A−B, C).
- Sources : écran `ECR-COO-05` (« règle d'unité : EN_ATTENTE → PRET automatique ») ; spec `specs-ateliers-besoins.md PARTIE 6` (EX-PIL-501 : B = trains à 100 % de visuels reçus) ; `maquettes-autres-modules.md ECR-PIL-03` (Q41, couverture « départ le plus proche servi d'abord »)
- Questions liées : Q-251, Q-280
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:couverture, construireTrains ; apps/api/src/modules/coordination/statuts-trains.ts:statutUnite (COO-P09 : couverture calculée à la lecture (départ le plus proche servi d’abord, Q-280), statut d’unité EN_ATTENTE / PRET calculé (Q-250). Reste : couverture des UM et lots (COO-P12 / P13) ; le passage EN_ATTENTE → PRET est calculé (pas d’historique persisté, Q-192 (7)))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts ; e2e/coordination-trains.spec.ts

### RG-COO-209 — Positions d'un train : fractionnée, couverte, limite par train
- Origine : NOUVELLE
- Énoncé : un train porte de 1 à N positions (A, B, C, D…). Une position est « fractionnée » quand son visuel est produit à part ; elle n'entre plus dans le besoin, ni dans les tiroirs, ni dans le nombre de faces du dispatch (faces = nombre de trains × positions non fractionnées). La limite N de positions par train est 4 (deck S7) ou 6 (code legacy, 6 contrats par `tf_train_export`) : valeur à trancher. Raccrocher un visuel à un train complet est refusé « Train complet ».
- Déclencheur : création / calcul d'un train, raccrochage, fractionnement.
- Conditions : N paramétrable (ECR-ADM-05).
- Effet / message d'erreur : refus « Train complet » au-delà de N.
- Sources : écran `ECR-COO-05`, `ECR-COO-05d`, `ECR-COO-10`, `ECR-ADM-05` ; legacy `TrainExportPrepaBll` (constante `NbMaxThemeParTrain = 6`, RG-COO-077) ; spec `specs-existant-process.md §C` (EX-EXI-033 : « jusqu'à 4 affiches » contre 6 thèmes)
- Questions liées : Q-253
- Implémentation : FAIT — apps/api/src/modules/coordination/trains.ts:raccrocherVisuel (positions max), couverture (fractionnée hors besoin) ; apps/api/src/modules/coordination/roulage.ts (faces du dispatch) (COO-P09 : positions max en paramètre (6, Q-253), « Train complet », position fractionnée hors besoin et hors couverture ; COO-P10 : tiroirs ; COO-P11 (2026-11-05) : faces du dispatch (nb × positions non fractionnées))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts, apps/api/test/coordination/roulage-dispatch.int.test.ts

### RG-COO-210 — Export des trains : seules les faces « Instruction ok » partent et passent à « A imprimer / Prêt à produire »
- Origine : CONSERVÉE
- Énoncé : le bouton « Exporter les trains » ne retient que les faces au statut 2 (Instruction ok) et passe ces faces ainsi que les instructions exportées au statut 5 (A imprimer, libellé cible « Prêt à produire »). Les autres faces restent en attente. C'est le go des plateformes. Les faces proviennent de la grille filtrée.
- Déclencheur : action « Exporter les trains… » (Liste des trains).
- Conditions : face au statut 2 ; au moins un dossier exportable (RG-COO-211) ; périmètre d'ateliers de l'utilisateur.
- Effet / message d'erreur : faces 2 → 5, instruction 2 → 5, historique `ExporterTrains` (RG-COO-213) ; bouton Exporter désactivé si 0 dossier exportable.
- Sources : legacy `PreparationDeroulantsController.cs:71-134`, `PreparationDeroulantsService.cs:109-223`, `PreparationRepository.cs:1287-1440` (ancien ID provisoire RG-COO-070) ; spec `specs-coordination.md §C` (EX-COO-024), `specs-existant-process.md §C` (EX-EXI-033) ; écran `ECR-COO-05b`
- Questions liées : Q-251, Q-252
- Implémentation : FAIT — apps/api/src/modules/coordination/export-trains.ts:exporterTrains (COO-P10 (2026-11-05) : faces 2 → 5, instructions → Prêt à produire, historiques, journal ; route POST /api/coordination/trains/export et modale ECR-COO-05b)
- Tests : apps/api/test/coordination/export-trains.int.test.ts ; e2e/coordination-export-trains.spec.ts

### RG-COO-211 — Export des trains : dossiers exportables et décompte affiché
- Origine : NOUVELLE
- Énoncé : la modale « Exporter les trains · départ Sxx » annonce « n dossier(s) en Instruction OK : leurs faces passent « A imprimer », le go des plateformes » et « [n déjà exporté(s)] » ; un encadré d'avertissement liste les dossiers « En cours » qui ne partent pas. Le marquage `exporte` (date, utilisateur) n'est posé que sur les dossiers dont l'Instruction OK est AUTO ou MANUEL, non annulés, et dont la préparation est reçue. L'export ne dépend ni de la validation admin ni de la réception complète (RG-X-083).
- Déclencheur : ouverture de la modale puis clic sur « Exporter ».
- Conditions : départ (semaine) choisi ; n ≥ 1.
- Effet / message d'erreur : bouton désactivé si 0 dossier exportable ; journal de l'export.
- Sources : écran `ECR-COO-05b` ; spec `specs-coordination.md §A` (EX-COO-001), `§C` (EX-COO-024)
- Questions liées : Q-252
- Implémentation : FAIT — apps/api/src/modules/coordination/export-trains.ts:facesExportables, apercuExport (COO-P10 (2026-11-05) : dossiers exportables, déjà exportés, « En cours » listés, marquage exporté (instruction + journal dossier) ; RG-X-083 testée (indépendance de la validation admin et de la réception))
- Tests : apps/api/test/coordination/export-trains.int.test.ts ; e2e/coordination-export-trains.spec.ts

### RG-COO-212 — Export des trains : jalon du jeudi 14 h, réservé à la Coordination
- Origine : NOUVELLE
- Énoncé : l'export est fait par la Coordination le jeudi à 14 h (jalon 6 du process) après vérification de la préparation des trains ; on commence par le MUI. Aucune restriction horaire ni de rôle n'est codée dans le legacy ni dans la maquette (info-bulle seulement). Urgences du vendredi : traitées à la main ou par renvoi (jalon 7).
- Déclencheur : action « Exporter les trains… ».
- Conditions : HYPOTHÈSE (Q-252) : pas de blocage serveur sur l'heure ; l'heure est un jalon de process matérialisé par l'alerte « Préparation non reçue » (deadline jeudi S-2 16 h, coo1) ; l'action est réservée aux profils `coord` (et `admin`) côté service.
- Effet / message d'erreur : si l'utilisateur n'est pas autorisé : 403 ; sinon export normal.
- Sources : legacy `PreparationDeroulantsController.cs:71-134` (aucun contrôle horaire, ancien ID provisoire RG-COO-070) ; spec `specs-coordination.md §C` (EX-COO-024), `§D` (EX-COO-044 jalons 6 et 7), `specs-existant-process.md §F` (EX-EXI-077) ; écran `ECR-COO-05b` (« Jeudi 14 h, par la Coordination »)
- Questions liées : Q-252, Q-286
- Implémentation : FAIT — apps/api/src/modules/coordination/export-trains.ts:exporterTrains (train.exporter) (COO-P10 (2026-11-05) : réservé à coord et admin dans le service (403 sinon) ; pas de blocage horaire (HYPOTHÈSE Q-252))
- Tests : apps/api/test/coordination/export-trains.int.test.ts

### RG-COO-213 — Export des trains : fichier, `tf_train_export`, simulation, historique, erreurs visibles
- Origine : MODIFIÉE
- Énoncé : l'export écrit `tf_train_export` (un enregistrement par train, 6 contrats au maximum) et génère le fichier CSV d'export (nom `ExportTrainsCIRCEversSurf<horodatage>`, répertoire configuré). La « Simulation export » génère le même fichier sans changer aucun statut. L'historique `ExporterTrains` est écrit. MODIFIÉE : en legacy, en cas d'exception le message est seulement tracé et l'`idExport` est tout de même retourné (l'erreur n'est pas visible) ; en cible, l'écriture des statuts, de `tf_train_export` et de l'historique se fait dans une transaction unique et une erreur d'export est remontée à l'utilisateur sans changement de statut.
- Déclencheur : « Exporter » / « Simulation export ».
- Conditions : au-delà de 6 contrats par train, le legacy trace « Train supérieur à 6 pour le TrainId » (module « CIRCE - Export Surf ») ; traitement du dépassement à décider (Q-253).
- Effet / message d'erreur : erreur applicative explicite (code 422/500 selon cause) ; aucun statut modifié en cas d'échec.
- Sources : legacy `PreparationRepository.cs:1218-1261,1251-1260`, `PreparationDeroulantsService.cs:513-580` (anciens ID provisoires RG-COO-070, RG-INT-045) ; CLAUDE.md §6 (atomicité) ; spec `specs-transverse.md §G` (EX-TRA-034)
- Questions liées : Q-253
- Implémentation : PARTIEL — apps/api/src/modules/coordination/export-trains.ts:exporterTrains, historiqueExports ; apps/api/src/modules/coordination/export-csv.ts (COO-P10 (2026-11-05) : lot, tf_train_export, simulation sans statut, historique, erreur explicite (train > 6 contrats), atomicité, lettre de position et rouleur de chaque contrat, historique et fichier limités au périmètre (RG-COO-167, Q-193 (13)) ; reste : fichier réel déposé dans le répertoire configuré (D-15, Q-193) : le fichier CSV est SIMULÉ, marqué comme tel (nom `_SIMULE`, `fichierSimule` du résultat, de l'historique et du lot, avertissement à l'écran, journal du lot ; audit B1), « Section » = DestNomOri, « CentreCommercial » = date de départ faute de `Agreement`, Q-193 (1))
- Tests : apps/api/test/coordination/export-trains.int.test.ts ; apps/api/test/coordination/export-trains-complement.int.test.ts ; apps/api/test/coordination/export-trains-audit.int.test.ts ; e2e/coordination-export-trains.spec.ts

### RG-COO-214 — Export : ordonnancement « Paris » par alternance ville / commercial
- Origine : CONSERVÉE
- Énoncé : à l'export, les faces dont la convention de référence est incluse (paramétrage `ListeRefConventions`, structures, produits de `tr_parametre_alternance` actifs) et au statut 2 sont ordonnées par structure : liste « ville » (`IdTypeDossier == 3`) et liste « commercial » (≠ 3) du panneau de départ (le panneau le plus fourni si deux panneaux), alternées par pas de 10 en commençant par la plus longue liste (à égalité, commercial d'abord), le reliquat étant ajouté à la suite ; puis le second panneau. `ordre_reel` et `ordre_calcule` sont écrits, les faces passent à 5 et les instructions correspondantes à 5. Les autres trains sont exportés sans recalcul d'ordre.
- Déclencheur : « Exporter les trains… ».
- Conditions : `rpc_statut == 2` ; `IdProduit` renseigné pour le calcul ; paramètres `est_actif`.
- Effet / message d'erreur : faces 2 → 5. Anomalies du code legacy à ne pas reproduire sans décision : (a) le filtre produit est calculé mais jamais réaffecté ; (b) pour les exclusions, le code ajoute les non-exclus au lieu de filtrer ; (c) `ordre_reel` en `byte` : position = 10 × rang, débordement à partir de 26 faces par structure.
- Sources : legacy `PreparationDeroulantsService.cs:136-171,175-206,1068-1246`, `PreparationDeroulantsRepository.cs:1670-1695` (anciens ID provisoires RG-COO-071, RG-RPR-028)
- Questions liées : Q-255
- Implémentation : PARTIEL — — (non repris : Q-255) (COO-P10 (2026-11-05) : ordonnancement Paris non repris (Q-255 OUVERTE : règle métier attendue inconnue, anomalies legacy) ; les trains sont exportés sans recalcul d’ordre)
- Tests : apps/api/test/coordination/export-trains.int.test.ts (absence de recalcul)

### RG-COO-215 — Export préparation (2 m² déroulants) : ateliers 5 et 6, statut 9 « Export prépa »
- Origine : CONSERVÉE
- Énoncé : « Export préparation » (et génération du fichier Caire) n'est autorisé que pour les ateliers 5 (Wissous 2 m²) et 6 (Nîmes 2 m²) : `ExportPrepaAutorise = (ate_id == 5 || 6)`. Les faces des trains choisis doivent être au statut 5 ou 9, sinon : « Les faces des trains ne sont pas dans le statut 'A imprimer' ! ». Les faces passent à 9 (Export prépa). Le fichier Caire ne retient que les faces des ateliers 5 et 6, avec 6 contrats par train.
- Déclencheur : « Export préparation » / « Exporter Caire » / « Générer fichier V2 ».
- Conditions : droit `train_preparation` (legacy) → profils `cheq`/`coord`.
- Effet / message d'erreur : faces 5 → 9 ; message ci-dessus si statut invalide.
- Sources : legacy `TrainPreparationBll.cs:22-23,90-99,257-291`, `TrainPreparationRepository.cs:253-269`, `TrainExportPrepaRepository.cs:43-67,124-151`, `PreparationDeroulantsService.cs:225-304` (anciens ID provisoires RG-COO-077, RG-COO-078) ; spec `specs-existant-process.md §C` (EX-EXI-035) ; écran `ECR-COO-07`
- Questions liées : Q-254
- Implémentation : PARTIEL — apps/api/src/modules/coordination/export-trains.ts:exportPreparation, ateliersExportPrepa (COO-P10 (2026-11-05) : faces 5 → 9, fichier Caire simulé (nom `_SIMULE`, journal du lot), 403 / 409 / 422, refus d'une sélection sur plusieurs semaines (Q-193 (16)) ; reste : les ateliers 5 et 6 du legacy ne sont pas au référentiel V2 (paramètre trains.ateliersExportPrepa à renseigner à la reprise, Q-319, Q-193))
- Tests : apps/api/test/coordination/export-trains.int.test.ts ; e2e/coordination-export-trains.spec.ts

### RG-COO-216 — Export préparation : plafond de 20 thèmes (couples thème / repiquage)
- Origine : MODIFIÉE
- Énoncé : le nombre de couples (thème, repiquage) distincts (faces déjà à 9 + nouvelles) ne doit pas dépasser 20 (`NbMaxThemeExportPrepa = 20` ; `QteMaxThemeMachineCaire = 20`). Message : « Le nombre de thèmes ajouté est supérieur à la capacité de la machine ! ». MODIFIÉE : en legacy le contrôle est fait après la mise à jour, l'exception est levée mais la mise à jour n'est pas annulée (ANO-13 : ne bloque rien) ; la cible bloque au-delà (README H6, EX-COO-024). L'extension à tous les exports (et non seulement Vendôme) est à confirmer.
- Déclencheur : « Export préparation » / « Exporter les trains… ».
- Conditions : ateliers 5 et 6 (RG-COO-215) ; la limite n'est pas bloquante pour la sélection (la sélection se fait avant), elle l'est pour l'enregistrement.
- Effet / message d'erreur : refus 422 sans aucune modification de statut (contrôle a priori, transaction) ; message ci-dessus.
- Sources : legacy `TrainPreparationBll.cs:22-23,257-291`, `p_u_exportTheme`, `p_s_face_train_export_caire` (anciens ID provisoires RG-COO-077, bdd.md §8) ; spec `specs-coordination.md §C` (EX-COO-024), `specs-existant-process.md §C` (EX-EXI-033, EX-EXI-035), `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-518 : limite saisie à la main) ; écran `ECR-GEN-01` (bloquant à 20 tiroirs, module GEN)
- Questions liées : Q-254
- Implémentation : FAIT — apps/api/src/modules/coordination/export-trains.ts:exportPreparation ; apps/api/src/modules/coordination/generation-fichiers.ts:preparerGeneration (COO-P10 (2026-11-05) : plafond de 20 couples (thème, repiquage) contrôlé a priori (Q-254), et de 20 tiroirs pour le fichier Vendôme (ECR-GEN-01))
- Tests : apps/api/test/coordination/export-trains.int.test.ts ; apps/api/test/coordination/suivi-generation.int.test.ts

### RG-COO-217 — « Au roulage » : affectation du rouleur, point de passage 9 → 10, suppression d'un thème
- Origine : CONSERVÉE
- Énoncé : après l'export préparation, la mise « Au roulage » (statut 10) affecte un rouleur aux faces de statut 9 de la semaine / atelier (`MiseAJourAuRoulage`). La suppression d'un thème de l'export (`MiseAJourAImprimer`) fait repasser ses faces de 9 à 5. En cible l'impression de la bague ou l'envoi du fichier à la machine fait passer l'unité de PRET à EN_PROD (RG-COO-299, point de non-retour).
- Déclencheur : « Au roulage » / suppression d'un thème / impression de bague.
- Conditions : faces au statut 9 ; rouleur obligatoire.
- Effet / message d'erreur : faces 9 → 10 ; 9 → 5 ; historique.
- Sources : legacy `TrainPreparationRepository.cs`, `TrainExportPrepaRepository.cs` (ancien ID provisoire RG-COO-077) ; écran `ECR-COO-07`, `ECR-COO-11a`, `ECR-GEN-03`
- Questions liées : Q-250
- Implémentation : PARTIEL — apps/api/src/modules/coordination/export-trains.ts:auRoulage, supprimerThemeExport ; apps/api/src/modules/coordination/generation-fichiers.ts:envoyerGeneration (COO-P10 (2026-11-05) : Au roulage 9 → 10 avec rouleur obligatoire, thème retiré de l’export 9 → 5 ; « Envoyer à la machine » ne modifie AUCUNE face (audit B2 : le rouleur est obligatoire à « Au roulage », l'effet d'unité « En production » relève de RG-COO-299 / COO-P11 et de la création des unités, Q-265) et revérifie les versions et l'état PRET des trains du lot (audit B3) ; question Q-194 ouverte ; reste : l’impression de la bague (RG-COO-299, COO-P11) et l'effet de l'envoi sur les unités ; COO-P11 (2026-11-05) : l'impression de la bague fait passer les faces « A imprimer » à « Au roulage » avec le rouleur (RG-COO-299) ; reste : effet de l'envoi du fichier à la machine sur l'unité (Q-194, Q-265))
- Tests : apps/api/test/coordination/export-trains.int.test.ts ; apps/api/test/coordination/suivi-generation.int.test.ts ; e2e/coordination-export-trains.spec.ts, apps/api/test/coordination/roulage-bagues.int.test.ts

### RG-COO-218 — « Changer statut » des faces : transitions autorisées contrôlées côté serveur
- Origine : MODIFIÉE
- Énoncé : « Liste des trains » : le dialogue ne propose que 2 → 5 et 5 → 10. « Trains › Préparation » (« Changer statut : A imprimer ») : les faces au statut 10, 5 ou 9 repassent à 5, sous la condition que toutes les faces de la sélection soient en 10, 5 ou 9 ; sinon « Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' ! ». MODIFIÉE : le legacy ne contrôle ces transitions que dans le front (le serveur applique le statut choisi à toutes les faces de la grille en session sans revérifier) ; la cible les contrôle dans le service avec table de transitions explicite (toute autre transition = 409).
- Déclencheur : « Changer statut ».
- Conditions : droit `train_changer_statut` (legacy) ; la ré-impression des bagues (retour de « Terminé » à « Imprimer ») est restreinte aux directeurs de plateforme et chefs d'équipe (EX-ADM-503).
- Effet / message d'erreur : faces mises à jour + historique ; 409 pour transition non listée.
- Sources : legacy `PreparationDeroulantsController.cs:1417-1431,1544-1556`, `TrainPreparationBll.cs:234-255`, `TrainPreparationRepository.cs:99-115` (ancien ID provisoire RG-COO-072) ; CLAUDE.md §6 ; spec `specs-ateliers-besoins.md PARTIE 10` (EX-ADM-503)
- Questions liées : Q-277, Q-286
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:changerStatutFaces ; apps/api/src/modules/coordination/statuts-trains.ts:CHANGER_STATUT_LISTE, CHANGER_STATUT_PREPARATION (COO-P09 : transitions contrôlées côté serveur (Liste 2 → 5, 5 → 10 avec rouleur ; Préparation 10 / 5 / 9 → 5), historique, 409. Reste : bouton « Changer statut » de l’écran Préparation (ECR-COO-07, COO-P10))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-219 — Annulation d'un thème de train : uniquement à « A imprimer »
- Origine : CONSERVÉE
- Énoncé : annuler un thème exige que le statut de la ligne et de toutes les faces du thème soit 5. Messages : « Le statut du thème ne permet pas l'annulation ! » ; « Toutes les faces du theme ne sont pas dans le statut 'A Imprimer' ». Les faces passent à 4 (Annulé), `train_id = NULL`, avec utilisateur et date.
- Déclencheur : « Annuler thème » (Suivi par thème).
- Conditions : `ligne.rpc_statut == 5` et toutes les faces = 5 ; droit `train_annuler_theme` (énuméré, usage dans les vues non retrouvé).
- Effet / message d'erreur : faces 5 → 4 ; messages ci-dessus (409).
- Sources : legacy `TrainSuiviThemeBll.cs:181-202`, `TrainSuiviThemeRepository.cs:97-114`, `TrainSuiviThemeController.cs:90-110` (ancien ID provisoire RG-COO-073)
- Questions liées : —
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:annulerThemeTrain (COO-P09 : API (faces « A imprimer » → ANNULE, train vidé, messages legacy, 409). Reste : bouton « Annuler thème » du Suivi par thème (ECR-COO-06, COO-P10))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts, apps/api/test/coordination/semaines-iso.int.test.ts

### RG-COO-220 — « Débloquer semaine » : trains « A imprimer » d'un atelier repassent à « Instruction ok »
- Origine : CONSERVÉE
- Énoncé : retour en arrière de masse sur une semaine / un atelier : les faces et les instructions au statut 5 repassent à 2. Refus : « Il n'y a pas de données à traiter ! » s'il n'y a ni train ni instruction ; « Toutes les données ne sont pas au statut 'A imprimer' ! » si une face n'est pas à 5.
- Déclencheur : bouton « Débloquer semaine » (Suivi par thème).
- Conditions : droit `train_debloquer_semaine` (legacy) ; `train_id` non nul ; instructions au statut 5 ; aucune face en production (RG-COO-223).
- Effet / message d'erreur : faces et instructions 5 → 2 ; `ft_user_maj`, `instr_user`, dates ; historique. Refus : 409 avec les messages ci-dessus.
- Sources : legacy `TrainSuiviThemeBll.cs:496-522`, `TrainSuiviThemeRepository.cs:257-323`, `TrainSuiviTheme/Index.cshtml:105-114` (ancien ID provisoire RG-COO-074) ; spec `specs-existant-process.md §C` (EX-EXI-030 : retour 5 → 2)
- Questions liées : Q-250
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:debloquerSemaineTrains ; apps/api/src/modules/coordination/statuts-trains.ts:TRANSITIONS_INSTRUCTION_TRAINS (COO-P09 : API (faces et instructions 5 → 2, messages legacy, 409). Reste : bouton « Débloquer semaine » du Suivi par thème (ECR-COO-06, COO-P10))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts, apps/api/test/coordination/semaines-iso.int.test.ts

### RG-COO-221 — Fractionner un train
- Origine : MODIFIÉE
- Énoncé : cible (maquette) : « Fractionner » lance le train sans ses visuels manquants. Exige que le train soit EN_ATTENTE et qu'au moins un visuel soit reçu ; le train passe à PRET, est marqué `fractionne`, les positions manquantes sont marquées fractionnées (produites à part), historique et journal écrits. Message : « Aucun train fractionnable (il faut au moins un visuel reçu). » ; en cas de succès : « n train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part. ». Legacy : le fractionnement (uniquement statut 5) incrémente le dernier chiffre (version) du `train_id` des faces sélectionnées (ressources / jours choisis) si le train contient plusieurs faces ; messages « Le statut du thème ne permet pas le fractionnement ! » et « Pas de données à traiter ! ». Usage métier : un thème en retard est retiré du train d'origine pour créer une ligne à part (livraisons tardives, Nîmes).
- Déclencheur : action « Fractionner » (Liste des trains ; Suivi par thème, droit `train_regrouper`).
- Conditions : maquette : EN_ATTENTE et ≥ 1 visuel reçu ; legacy : statut 5 ; train non en production (RG-COO-223).
- Effet / message d'erreur : voir Énoncé ; 409 si train non fractionnable. La sémantique legacy (version du `train_id`) et cible (position fractionnée + statut d'unité) est à unifier.
- Sources : legacy `TrainSuiviThemeBll.cs:214-262,531-665` (ancien ID provisoire RG-COO-075) ; spec `specs-existant-process.md §C` (EX-EXI-036, EX-EXI-078), `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503) ; écran `ECR-COO-05`
- Questions liées : Q-261
- Implémentation : FAIT — apps/api/src/modules/coordination/trains.ts:fractionnerTrains ; apps/web/src/routes/coordination/trains.tsx (COO-P09 : sémantique cible (positions manquantes fractionnées, train PRÊT), messages de la maquette, 409 ; la version legacy du train_id n’est pas incrémentée (Q-261))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts ; e2e/coordination-trains.spec.ts

### RG-COO-222 — Raccrocher un visuel à un ou plusieurs trains
- Origine : MODIFIÉE
- Énoncé : « Raccrocher un visuel » ajoute un visuel (thème) à un train non encore produit. Cible (maquette) : le visuel proposé est du même site, même semaine, même atelier, non exclu, non annulé ; limite de positions : « Train complet » ; en masse, la fonction écarte les trains en production, d'un autre atelier ou départ, complets, ou qui ont déjà le visuel, et annonce « n train(s) recevront ce visuel » ; le raccrochage ajoute une position et une ligne de préparation (`qte += nb`). Il n'y a pas de raccrochage automatique pour les trains restant à produire : l'atelier choisit fractionner ou raccrocher. Legacy : le raccrochage regroupe les versions supérieures d'un train sur la première version et ignore les trains dont une face n'est pas à 5. Cible : le raccrochage en masse ne doit pas dégrader avec un grand nombre de lignes (le legacy « bugge »).
- Déclencheur : action « Raccrocher un visuel » (unitaire ou en masse) ; événement RG-X-075.
- Conditions : train non EN_PROD (RG-COO-223) ; position disponible (RG-COO-209) ; droit `train_regrouper`.
- Effet / message d'erreur : position + ligne de préparation ajoutées ; couverture recalculée (RG-COO-208) ; 409 si train complet ou en production.
- Sources : legacy `TrainSuiviThemeBll.cs:214-262,531-665` (ancien ID provisoire RG-COO-075) ; spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503), `PARTIE 5` (EX-SCR-506), `specs-existant-process.md §C` (EX-EXI-036) ; écran `ECR-COO-05d`
- Questions liées : Q-253, Q-261
- Implémentation : FAIT — apps/api/src/modules/coordination/trains.ts:raccrocherVisuel, visuelsRaccrochables ; apps/web/src/routes/coordination/trains.tsx (COO-P09 : unitaire et en masse (écartés listés), besoin recalculé depuis les faces (Q-192 (9)))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts ; e2e/coordination-trains.spec.ts

### RG-COO-223 — Point de non-retour : un train EN_PROD ne se modifie, ne se supprime pas
- Origine : NOUVELLE
- Énoncé : `EN_PROD` (« En production », posé à l'impression de la bague ou à l'envoi du fichier à la machine) est un point de non-retour : toute modification du train (raccrochage, fractionnement, changement de positions, suppression) est refusée. Message : « Train déjà en production : impossible de le modifier (point de non-retour). ». Les unités déjà en production ne sont jamais retirées par « Rendre la main » (RG-COO-243). Toute modification Broadcast sur un train en production est seulement tracée et signalée (RG-X-077).
- Déclencheur : toute action de modification de train / d'unité.
- Conditions : statut d'unité ∈ {EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE}.
- Effet / message d'erreur : refus 409 avec le message ci-dessus.
- Sources : écran `ECR-COO-05`, `ECR-COO-05e`, `ECR-COO-09b`, `ECR-GEN-03` ; `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-509 : exception demandée pour fixe et colle)
- Questions liées : Q-268
- Implémentation : FAIT — apps/api/src/modules/coordination/trains.ts:fractionnerTrains, raccrocherVisuel, supprimerTrain ; apps/api/src/modules/coordination/trains-calcul.ts:calculerTrains (COO-P09 : refus 409 « point de non-retour » sur les trains ; rendre la main (COO-P12) et bagues (COO-P11) l’appliquent aussi)
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-224 — Créer un train de pré-test ou d'entretien
- Origine : NOUVELLE
- Énoncé : la Coordination peut créer un train de pré-test ou d'entretien (une campagne devient contrôlée et il faut ajouter de l'entretien). Champs : Atelier (déroulants du site), Départ (S ≥ semaine en production), Type (Pré-test / Entretien), Nombre de trains (1 à 9), Visuel (thèmes de l'atelier, S ≥ départ), Destinataire (du site). Refus : « Choisissez un visuel et un destinataire. ». Crée `TR-Pnnnn`, statut EN_ATTENTE, une position, afficheur = premier afficheur du destinataire.
- Déclencheur : « Train de pré-test… » (Liste des trains).
- Conditions : atelier déroulant du site ; l'Instruction OK verrouille positions et entretien (impact non traité par la spec).
- Effet / message d'erreur : train créé + historique ; message ci-dessus ; couverture recalculée.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-505 : « Aujourd'hui les pré-tests sont gérés hors process ») ; écran `ECR-COO-05c`
- Questions liées : Q-258
- Implémentation : FAIT — apps/api/src/modules/coordination/trains.ts:creerTrain, optionsCreationTrain ; apps/web/src/routes/coordination/trains.tsx (COO-P09 : TR-Pnnnn, face « A imprimer », afficheur du destinataire (Q-192 (5), Q-258))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts, apps/api/test/coordination/semaines-iso.int.test.ts ; e2e/coordination-trains.spec.ts

### RG-COO-225 — Supprimer un train avec motif
- Origine : NOUVELLE
- Énoncé : suppression d'un train avec motif obligatoire choisi parmi : « Affichage qui ne se fait pas », « Ville de Paris : affiche à ne pas poser », « Pré-test annulé », « Autre ». Refus si le train est en production. Après suppression, la maquette recalcule la couverture des quantités.
- Déclencheur : « Supprimer… » (fiche train) puis « Supprimer le train ».
- Conditions : train non EN_PROD (RG-COO-223) ; motif renseigné.
- Effet / message d'erreur : train supprimé (annulé avec historique, pas de suppression physique) ; message « Train déjà en production… » sinon.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-505 : « Ville de Paris : affiches à ne pas mettre, parfois seule affiche du train ») ; écran `ECR-COO-05a`, `ECR-COO-05e`
- Questions liées : Q-259
- Implémentation : FAIT — apps/api/src/modules/coordination/trains.ts:supprimerTrain ; apps/web/src/routes/coordination/trains.tsx (COO-P09 : suppression logique avec motif et historique (Q-259))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-226 — Duplication d'un train (administration)
- Origine : CONSERVÉE
- Énoncé : « Dupliquer train » copie les faces d'un train source N fois vers des trains cibles dont l'identifiant augmente de 190 à chaque exemplaire ; les copies sont créées au statut 5 (A imprimer). Le champ « Afficheur » du formulaire est stocké dans `pers_nom` (le paramètre s'appelle `@annonceur`). Le paramètre est journalisé dans `tt_log`. Aucune validation de saisie en legacy.
- Déclencheur : écran Administration › Dupliquer train.
- Conditions : droit `duplication_train` (non attribuable via l'écran legacy, RG-ADM-013) ; usage métier incertain (« trains de remplacement »).
- Effet / message d'erreur : insertion de N × (faces du train source) ; en cible validations de saisie (train source existant, N ≥ 1). Aucune spec de la cible ne mentionne la duplication.
- Sources : legacy `DuplicationTrainController.cs:22-34`, `DuplicationTrainBll.cs:12-17`, `p_u_duplication_train.sql:13-19,94,100-110` (ancien ID provisoire RG-COO-079) ; legacy-admin.md RG-ADM-013
- Questions liées : Q-260
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:dupliquerTrain (POST /api/coordination/trains/dupliquer) (COO-P09 : duplication legacy (+190, « A imprimer », afficheur saisi) avec validations, réservée à l’admin. Reste : écran d’administration ; conservation à confirmer (Q-260 OUVERTE))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-227 — Sélection d'un nombre donné de trains (« les N premiers »)
- Origine : NOUVELLE
- Énoncé : un outil de la barre du tableau « Sélectionner les [N] premiers trains » (N saisi, défaut 60) coche les lignes jusqu'à N trains cumulés (somme des `nb`), sans couper une ligne ; si la ligne suivante dépasse N : message « n train(s) sélectionné(s), sur m ligne(s)… la ligne suivante en compte k et dépasserait N. ». Cas d'usage : filtrer les trains de 4 sur une destination et en prendre 60 (un opérateur).
- Déclencheur : action de l'outil de sélection (Liste des trains, Préparation).
- Conditions : l'ordre « premiers » = ordre d'affichage courant du tableau (HYPOTHÈSE, spec muette).
- Effet / message d'erreur : sélection modifiée ; aucun effet métier.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-510) ; écran `ECR-COO-05`, `ECR-COO-07`
- Questions liées : —
- Implémentation : FAIT — packages/shared/src/coordination-trains.ts:selectionnerPremiers ; apps/web/src/routes/coordination/trains.tsx (COO-P09 : outil « Sélectionner les N premiers trains » de la Liste des trains (ECR-COO-07 : COO-P10))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-228 — Filtres de la liste des trains : thèmes, nombre de visuels, 20 tiroirs, atelier
- Origine : NOUVELLE
- Énoncé : la liste des trains offre les filtres : N° de dossier, Départ (semaine), Atelier (déroulant), Machine, Statut (7 valeurs), + Destinataire, Annonceur, Thème (trains contenant l'un des thèmes sélectionnés, choix multiple), Afficheur, « Trains de » (1 à 4 visuels). Le filtre Thème permet de répartir un ou plusieurs thèmes par opérateur au roulage et de réduire les confusions. Le périmètre est limité aux ateliers de l'utilisateur ; sélection par défaut = semaine suivante.
- Déclencheur : affichage / filtrage.
- Conditions : périmètre d'ateliers de l'utilisateur (RG-COO-092 legacy, coo1).
- Effet / message d'erreur : lecture seule ; aucune erreur.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-509) ; écran `ECR-COO-05` ; legacy `TrainSuiviThemeBll.cs:31-98` (périmètre, ancien ID provisoire RG-COO-092)
- Questions liées : —
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:listerTrains ; apps/web/src/routes/coordination/trains.tsx (COO-P09 : filtres côté API (dossier, départ, atelier, statut, destinataire, annonceur, thème multiple, afficheur, trains de n), périmètre d’ateliers, semaine suivante par défaut. Reste : filtre Machine (référentiel machine absent, D-02 / Q-319))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts, apps/api/test/coordination/semaines-iso.int.test.ts ; e2e/coordination-trains.spec.ts

### RG-COO-229 — Visibilité du n° de panneau Broadcast pour chefs d'équipe et coordinateurs
- Origine : NOUVELLE
- Énoncé : le n° de panneau Broadcast (6 chiffres, un par train identique) est affichable (colonne masquée par défaut) par les chefs d'équipe et les coordinateurs dans l'écran Préparation / Liste des trains, pour répondre aux questions en cas de non-conformité ; il n'est visible aujourd'hui que d'un seul utilisateur.
- Déclencheur : affichage de la colonne.
- Conditions : profil `cheq` ou `coord` (le rôle visé « Patrick » n'est pas défini : Q-286).
- Effet / message d'erreur : colonne visible ; sinon masquée côté serveur (champ non renvoyé) pour les autres profils.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-512) ; écran `ECR-COO-05`
- Questions liées : Q-286
- Implémentation : FAIT — apps/api/src/modules/coordination/trains.ts:panneaux (COO-P09 : n° de panneau renvoyé seulement avec le droit suivi_8m2.saisir (coord, cheq), Q-192 (11))
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-230 — Suivi par thème (vue besoin) : calcul du besoin, du couvert et du pré-assemblage
- Origine : MODIFIÉE
- Énoncé : une ligne par thème présent dans les trains filtrés (si un filtre Thème est posé, seuls les thèmes choisis ; les indicateurs et le besoin ignorent le filtre Statut). Colonnes : Annonceur · thème, Dossier, Besoin (trains) = somme des `nb`, Entretien = `qteEnt − qte`, Reçu, Couvert = reçu ≥ attendu (Oui / Non), Emplacement (allée-rayon des affiches), Pré-assemblé (« Fait » / « — »). Ligne teintée si non couvert. Legacy : l'écran sert à cocher les affiches reçues, décocher celles à fractionner, supprimer les thèmes inutiles et uniformiser l'intitulé d'un annonceur ; en cible le reçu vient de la Réception (plus de saisie).
- Déclencheur : affichage de la vue besoin.
- Conditions : droit `train_suivi_theme` (legacy) → `cheq` / `coord`.
- Effet / message d'erreur : lecture seule + actions groupées (RG-COO-233).
- Sources : écran `ECR-COO-06` ; spec `specs-existant-process.md §C` (EX-EXI-034, EX-EXI-035), `specs-ateliers-besoins.md PARTIE 2` (EX-COO-509) ; legacy `TrainSuiviThemeBll.cs:31-98`
- Questions liées : Q-263, Q-280
- Implémentation : FAIT — apps/api/src/modules/coordination/suivi-theme.ts:besoinParTheme (COO-P10 (2026-11-05) : besoin, entretien, reçu / couvert / emplacement, pré-assemblé, filtres côté API ; vue « Suivi par thème » ; reste hors règle : bouton visuel (aucune image de visuel en V2) ; écart assumé : « Entretien » = nombre de faces d'entretien du thème, `qteEnt − qte` n'étant pas modélisé sur les faces V2, Q-193 (5))
- Tests : apps/api/test/coordination/suivi-generation.int.test.ts ; e2e/coordination-export-trains.spec.ts

### RG-COO-231 — Exclusion automatique des thèmes « ne pas afficher » et « reste en place »
- Origine : NOUVELLE
- Énoncé : les thèmes « ne pas afficher » et « reste en place » sont exclus automatiquement de la préparation (fixe) et du suivi par thème (déroulant). Aujourd'hui l'exclusion est manuelle dans le suivi par thème (ex. « Paris Privatisé » : 2e thème non envoyé aux plateformes). Les thèmes exclus sortent automatiquement de la liste ; la liste des exclus est affichée en annotation ; au déroulant ils ne sont pas pris en compte dans le besoin (Traitement = tag « Ne pas afficher / Reste en place (Broadcast) »). Le reste en place est aussi retiré de la quantité de la ligne attendue « Broadcast » (RG-AT-03, coo1).
- Déclencheur : intégration de la préparation / affichage de la préparation.
- Conditions : indicateur `exclu` ou `EstResteEnPlace` fourni par Broadcast (source exacte non établie).
- Effet / message d'erreur : thèmes exclus des tableaux ; aucun refus.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-502, EX-COO-509) ; `specs-coordination.md §E` (EX-COO-034, EX-COO-046) ; `specs-existant-process.md §C` (EX-EXI-034) ; écran `ECR-COO-02`, `ECR-COO-09`
- Questions liées : Q-263
- Implémentation : PARTIEL — apps/api/src/modules/coordination/suivi-theme.ts:besoinParTheme (COO-P10 (2026-11-05) : thèmes exclus (indicateur themeExclu de la ligne attendue, RG-REC-014) hors besoin et listés en annotation ; reste : la source exacte de l’exclusion n’est pas établie (Q-263 OUVERTE))
- Tests : apps/api/test/coordination/suivi-generation.int.test.ts

### RG-COO-232 — Suivi par thème réservé aux dossiers avec commentaire de préparation (cible)
- Origine : NOUVELLE
- Énoncé : en cible, le suivi des thèmes n'est nécessaire que si le dossier a un commentaire de préparation ; l'Instruction OK automatique (règle de Nariman : pas de commentaire ET nombre d'exceptions = quantité) dispense de ce suivi. En maquette cependant la vue « Suivi par thème » liste tous les thèmes des trains.
- Déclencheur : affichage / traitement du suivi par thème.
- Conditions : à confirmer (EX-COO-509 contre maquette).
- Effet / message d'erreur : aucun effet tant que Q-263 n'est pas tranchée.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-509, EX-REC-524) ; écran `ECR-COO-06`
- Questions liées : Q-263
- Implémentation : PARTIEL — apps/api/src/modules/coordination/suivi-theme.ts:besoinParTheme (COO-P10 (2026-11-05) : aucun effet tant que Q-263 n’est pas tranchée : le suivi liste tous les thèmes des trains (comme la maquette))
- Tests : apps/api/test/coordination/suivi-generation.int.test.ts

### RG-COO-233 — Pré-assemblage : marquer / désassembler par thème
- Origine : MODIFIÉE
- Énoncé : « Marquer pré-assemblé » (primaire) et « Désassembler » fixent l'indicateur `pre_assemblage` des faces / thèmes sélectionnés ; journal « n visuel(s) pré-assemblé(s) ». L'indicateur est initialisé à vrai si un train du thème est déjà en production. Dans la vue Préparation, « Pré-assemblage » = « Fait » si tous les visuels non fractionnés du train sont pré-assemblés. Legacy : le bouton inverse l'indicateur face par face sans condition de statut.
- Déclencheur : actions groupées du Suivi par thème.
- Conditions : aucune condition de statut en legacy ; la cible peut refuser sur un thème non couvert (non spécifié).
- Effet / message d'erreur : indicateur mis à jour + historique.
- Sources : legacy `TrainSuiviThemeBll.cs:442-485` (ancien ID provisoire RG-COO-076) ; écran `ECR-COO-06`, `ECR-COO-07` ; spec `specs-existant-process.md §C` (EX-EXI-035, EX-EXI-037)
- Questions liées : Q-262
- Implémentation : FAIT — apps/api/src/modules/coordination/suivi-theme.ts:marquerPreAssemblage (COO-P10 (2026-11-05) : booléen par thème (Q-262), verrou de version par thème, journal « n visuel(s) pré-assemblé(s) », initialisé à Fait si un train du thème est en production)
- Tests : apps/api/test/coordination/suivi-generation.int.test.ts ; e2e/coordination-export-trains.spec.ts

### RG-COO-234 — Pré-assemblage 8 m² par client ou par destinataire
- Origine : NOUVELLE
- Énoncé : le pré-assemblage 8 m² peut se faire par client (en totalité, comme aujourd'hui) et par destinataire (idéalement avec filtre sur le n° de département) ; priorité au destinataire pour Nîmes, aux gros volumes pour Wissous.
- Déclencheur : action de pré-assemblage.
- Conditions : thèmes 8 m² (ateliers 7 et 8).
- Effet / message d'erreur : indicateur de pré-assemblage au niveau (thème × destinataire) ; modèle de données à définir.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-507) ; `specs-existant-process.md §C` (EX-EXI-037 : pré-assemblage par client en totalité, pas partiel)
- Questions liées : Q-262
- Implémentation : PARTIEL — apps/api/src/modules/coordination/suivi-theme.ts:marquerPreAssemblage (booléen par thème, RG-COO-233) (COO-P11 (2026-11-05) : pré-assemblage 8 m² par thème (granularité par défaut tant que Q-262 n'est pas tranchée) ; reste : par destinataire (filtre sur le n° de département), non modélisé (Q-262 OUVERTE))
- Tests : apps/api/test/coordination/roulage-8m2-rouleurs.int.test.ts

### RG-COO-235 — Préparation (vue prepa) : colonnes, teinte, filtre par statut A imprimer
- Origine : MODIFIÉE
- Énoncé : le tableau Préparation liste : Train, Destinataire, Statut, Positions, Nb trains, Pré-assemblage, Rouleur (nom ou « — »), Départ camion ; masquées : Afficheur, Atelier, Machine, Bague, Colis. Teinte : En attente → alerte forte ; Prêt sans rouleur → info. Legacy : filtre statut « A imprimer » par défaut, destinataire prioritaire, format 2 m² scro (vs Venusial), pré-assemblé = « Fait » ; encadré résultat (lignes / affiches / tiroirs) ; export Excel (suppression de colonnes B, D, E). Actions groupées : Choisir le rouleur, Générer les fichiers (module GEN), Imprimer les bagues. Vue ligne « annonceur 1 – thème 1 / annonceur 2 – thème 2 » demandée (EX-SCR-508).
- Déclencheur : affichage de la vue prepa.
- Conditions : droit `train_preparation` → `cheq` / `coord`.
- Effet / message d'erreur : lecture + actions groupées (RG-COO-236, RG-COO-299).
- Sources : écran `ECR-COO-07` ; legacy `TrainPreparationBll.cs:31-109` ; spec `specs-existant-process.md §C` (EX-EXI-035), `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-508)
- Questions liées : —
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:listerTrains ; apps/web/src/routes/coordination/trains.tsx (COO-P10 (2026-11-05) : vue Préparation : statut, positions, pré-assemblage, rouleur, départ, colonnes masquées Fichier / Modifications, teinte ; reste : colonnes Bague (COO-P11) et Colis (COO-P13), export Excel (Q-175), vue ligne annonceur 1 – thème 1 (EX-SCR-508) ; COO-P11 (2026-11-05) : colonne masquée « Bague », « Imprimer les bagues » depuis la vue Préparation ; reste : colonne Colis (COO-P13), export Excel (Q-175), vue ligne (EX-SCR-508))
- Tests : apps/api/test/coordination/suivi-generation.int.test.ts ; e2e/coordination-export-trains.spec.ts, apps/api/test/coordination/roulage-bagues.int.test.ts

### RG-COO-236 — Choisir le rouleur d'une ou plusieurs lignes de trains
- Origine : NOUVELLE
- Énoncé : l'action groupée « Choisir le rouleur… » ouvre la modale « Rouleur de n ligne(s) de trains » : liste des opérateurs du site (« Rouleur N1… » avec poste « Table k ») ; « Affecter » écrit le rouleur sur les lignes sélectionnées. Une ligne Prêt sans rouleur est signalée. Legacy : le rouleur est choisi au roulage (`MiseAJourAuRoulage`) et à l'impression de la bague.
- Déclencheur : « Choisir le rouleur… » / « Affecter ».
- Conditions : opérateurs du site de l'atelier ; trains non EN_PROD pour une réaffectation sans effet de bord (HYPOTHÈSE).
- Effet / message d'erreur : `rouleur_id` mis à jour + historique.
- Sources : écran `ECR-COO-07` ; legacy `TrainPreparationRepository.cs` (ancien ID provisoire RG-COO-077) ; spec `specs-existant-process.md §C` (EX-EXI-037 : choix du nom du rouleur)
- Questions liées : Q-276
- Implémentation : FAIT — apps/api/src/modules/coordination/export-trains.ts:listerRouleurs, affecterRouleur ; apps/web/src/components/coordination/trains-export.tsx:ModaleRouleur (COO-P10 (2026-11-05) : liste des rouleurs de l'atelier, affectation sous verrou de version avec journal, refus d'un train en production (HYPOTHÈSE Q-193) ; COO-P11 (2026-11-05) : le poste « Table k » est modélisé (rouleur.poste, RG-COO-297) et affiché dans la modale « Rouleur de n ligne(s) de trains »)
- Tests : apps/api/test/coordination/export-trains.int.test.ts, apps/api/test/coordination/roulage-8m2-rouleurs.int.test.ts, e2e/coordination-export-trains.spec.ts

### RG-COO-237 — Suivi 8 m² (demies) : saisie en ligne et reste à faire
- Origine : NOUVELLE
- Énoncé : le tableau Suivi 8 m² (sans sélection) liste les thèmes 8 m² : Site (si Tous), Annonceur · thème, Besoin, Reçu, Demies haut (nombre ≥ 0, éditable en ligne), Demies bas (éditable), 8 m² finales (éditable), Reste à faire = besoin − finales. Teinte : reçu < besoin → alerte forte ; reste = 0 → OK. Chaque modification écrit au journal « 8 m² : <champ> = <valeur> ». Remplace un Excel hors Circé (PROC-06 ; EX-EXI-037 : création de demies haut / bas, production de l'affiche complète, anticipation possible avant composition des trains).
- Déclencheur : saisie dans une cellule éditable.
- Conditions : valeur entière ≥ 0 ; thèmes d'ateliers 8 m² (7 et 8) ; modification historisée par utilisateur et date. La colonne « Création demies haut / bas (Nîmes) » de la spec peut être propre à Nîmes (Q-264).
- Effet / message d'erreur : valeur enregistrée avec historique ; valeur négative ou non numérique : refus 400.
- Sources : écran `ECR-COO-08` ; spec `specs-ateliers-besoins.md PARTIE 6` (EX-PIL-502) ; `specs-existant-process.md §C` (EX-EXI-037)
- Questions liées : Q-264
- Implémentation : FAIT [étape 8 lot 2 (2026-11-06) : le paramètre `suivi8m2.ateliers` se renseigne par l'écran « Règles métier » (D-06) ; règle prouvée avec le paramètre saisi par l'API d'administration (apps/api/test/admin/parametres-regles.int.test.ts) ; FAIT sous hypothèses Q-195 / Q-264 ; la correspondance avec les ateliers legacy 7 / 8 est une donnée de reprise, Q-319, D-23] · — apps/api/src/modules/coordination/suivi-8m2.ts:suivi8m2, saisir8m2 ; apps/web/src/components/coordination/suivi-8m2.tsx (COO-P11 (2026-11-05) : une ligne par thème des ateliers 8 m² (paramètre `suivi8m2.ateliers` : identifiants legacy 7 et 8 non repris, Q-319, valeur vide par défaut), besoin et reçu du suivi par thème, demies haut / bas et 8 m² finales éditables en ligne (entier ≥ 0, 400 sinon ; saisie libre sans plafond : Q-264 sans réponse), reste à faire = besoin − finales, verrou de version de la saisie, journal « 8 m² : <champ> = <valeur> » ; filtres Machine / Statut / Destinataire / Afficheur sans objet)
- Tests : apps/api/test/coordination/roulage-8m2-rouleurs.int.test.ts, e2e/roulage.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL (critère unique : paramètres vides par défaut) : `suivi8m2.ateliers` est VIDE par défaut (Q-319 / Q-195), l'écran ne suit aucun thème tant que l'administrateur ne l'a pas renseigné ; la règle est prouvée avec le paramètre saisi par l'API d'administration ; saisie sans plafond (Q-264 sans réponse)

### RG-COO-238 — Entretien calculé à l'afficheur (fixe, pliage, bus, trains)
- Origine : MODIFIÉE
- Énoncé : l'entretien est calculé au grain « afficheur » : aucun entretien en dessous de 3 affiches (seuil paramétrable) ; sinon `ceil(quantité × % entretien / 100)` avec minimum 1 (arrondi « supérieur » paramétrable) ; le % par défaut est 8 et modifiable à la préparation (jusqu'à 30 % dans la fiche dossier ; le client, notamment les Villes, envoie ce qu'il veut) ; la quantité à produire = quantité + entretien (« Total »). Le % d'entretien saisi dans Broadcast est repris sans ressaisie. MODIFIÉE : legacy = quantité d'entretien fournie par Broadcast à l'intégration (fixe/pliage, `p_integ_preparation.sql:121,160`), entretien par thème ou par ville, faces d'entretien arrondies par `round` pour le déroulant (RG-COO-203).
- Déclencheur : intégration de la préparation, modification du % d'entretien, calcul des lignes de l'unitaire.
- Conditions : valeurs 3 / supérieur / afficheur = valeurs par défaut de la maquette (à valider) ; pour un dossier de train le % n'est modifiable que si l'Instruction OK est « En cours » (coo1).
- Effet / message d'erreur : colonnes Entretien et Total des lignes ; info-bulle montrant le % d'entretien, la valeur cible et la valeur « ville » de la méthode actuelle.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-501), `PARTIE 4` (EX-FIX-505, EX-FIX-508), `specs-existant-process.md §F` (EX-EXI-075) ; écran `ECR-COO-09`, `ECR-COO-02`, `ECR-ADM-05` ; legacy `p_integ_preparation.sql:121,160` (ancien ID provisoire RG-COO-044 pour les mises à jour de quantité)
- Questions liées : Q-256
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:entretienDeLigne, construireLignes (COO-P12 (2026-11-05) : entretien à l'afficheur (afficheur = destinataire, HYPOTHÈSE Q-196 (2)) : 0 sous le seuil (3, paramètre), sinon quantité × % arrondi (supérieur, paramètre) avec minimum 1 ; % repris de l'instruction du dossier, sinon 8 % ; total = quantité + entretien ; reste : info-bulle « valeur ville » de la méthode actuelle, % modifiable jusqu'à 30 % dans la fiche dossier pour le fixe (Q-256))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-239 — Modifier la quantité à produire par afficheur si l'entretien reçu est insuffisant
- Origine : NOUVELLE
- Énoncé : les ateliers du fixe et du pliage peuvent modifier la quantité à produire d'une ligne (par afficheur) lorsque la quantité d'entretien reçue est insuffisante, afin de connaître la marge (affiche déchirée, entretien non reçu) et de ne pas tout consommer pour les premiers afficheurs ; une colonne « entretien par afficheur » est affichée. Pour les CG, les quantités d'entretien reçues en plus peuvent être ajoutées (EX-FIX-506, module REC).
- Déclencheur : saisie dans la colonne quantité de l'unitaire.
- Conditions : ligne non en production ; règles de recalcul des autres quantités non précisées.
- Effet / message d'erreur : quantité mise à jour avec historique ; refus si valeur négative (400).
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-505, EX-FIX-508, EX-FIX-506) ; `specs-existant-process.md §F` (EX-EXI-075) ; écran `ECR-COO-09`
- Questions liées : Q-269
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:modifierQuantite (COO-P12 (2026-11-05) : quantité à produire d'une ligne modifiable (≥ 0, 400 sinon) tant que l'unité n'est pas en production (409, RG-COO-223), verrou de version, historique, colonne entretien à l'afficheur ; reste : quantités d'entretien reçues en plus pour les CG (EX-FIX-506, module Réception) ; règles de recalcul des autres quantités non précisées (Q-269))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-240 — Libération de la semaine (fixe, pliage, bus) : action sans confirmation, sans lien avec la validation admin
- Origine : MODIFIÉE
- Énoncé : « Libérer la Sxx » (bouton primaire quand la semaine n'est pas libérée) crée une libération (atelier, semaine de départ, date, utilisateur), écrit l'historique « Libéré vers l'atelier » des dossiers « Préparation reçue » (PREPA_RECUE) et le journal ; toast « S44 libérée vers l'atelier … Les préparations reçues ensuite déclencheront une alerte et un mail. [n dossier(s) ont encore des affiches à confirmer…] ». L'action est directe (pas de confirmation). La libération ne valide rien et ne dépend pas de la validation admin. Elle remplace le bouton « Colisage » de Circé legacy. MODIFIÉE : en legacy le bouton « Colisage » crée les UM (RG-COO-260) et fige la donnée (la Pré-Prod ne peut plus y toucher, la main est aux plateformes ; ce qui est colisé est identifiable par le statut « En cours ») ; la cible ne crée plus les UM à la libération (H2 de la maquette), mais l'atelier de Wissous a décidé de garder le bouton « Colisage » (EX-FIX-510) : contradiction à trancher.
- Déclencheur : clic sur « Libérer la Sxx » (Préparation 2 m² fixe / Pliage / Bus).
- Conditions : une seule libération par (atelier, semaine) (HYPOTHÈSE : une seconde libération est refusée 409) ; rôle `coord` (la maquette ne contrôle aucun rôle : « Qui fait la libération ? » question ouverte) ; annulation de libération non prévue.
- Effet / message d'erreur : bandeau « S43 libérée vers l'atelier le mar. 13/10 15h30 (<utilisateur>) — Toute préparation reçue après déclenche une alerte et un mail. » ; lignes de la semaine ne sont plus « à libérer » (RG-COO-241) ; toute préparation reçue ensuite : RG-X-076.
- Sources : écran `ECR-COO-09`, `ECR-COO-09a` ; spec `specs-coordination.md §C` (EX-COO-025), `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-510), `specs-existant-process.md §D` (EX-EXI-041, EX-EXI-043) ; legacy `PreparationService.cs:81-107` (ancien ID provisoire RG-RPR-011)
- Questions liées : Q-265
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire-creation.ts:libererSemaine ; apps/api/src/modules/coordination/routes-unitaire.ts (POST /coordination/unitaire/liberer) ; apps/web/src/routes/coordination/unitaire.tsx (bandeau par semaine, « Libérer la Sxx ») (ÉTAPE 8 (2026-11-05) : HYPOTHÈSE PRISE Q-265, option (c) autorisée par l'utilisateur, à valider : « Libérer » ne crée aucune UM, « Colisage » (RG-COO-260) les crée ; une libération par (atelier fixe, semaine), 409 sinon ; historique « Libéré vers l'atelier » au journal des dossiers de la semaine ; droit `semaine.liberer` (coord) ; reste : annulation non prévue, dossiers « Préparation reçue » approximés (Q-404), mail non envoyé (Q-375))
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts ; e2e/coordination-unitaire.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — PARTIEL pour tout le groupe Q-265 / Q-404 (RG-COO-240 à 242, 250, 260 à 262, RG-X-076, RG-X-084) : fonctions appelées et testées (nominal et rejet) mais HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; Q-265 est une HYPOTHÈSE PRISE (option (c)), plus une question bloquante

### RG-COO-241 — Ligne fixe / pliage « à libérer » tant que la semaine n'est pas libérée
- Origine : MODIFIÉE
- Énoncé : une ligne de préparation 2 m² fixe ou pliage d'une semaine non encore libérée est « à libérer » (et non « A traiter ») ; elle l'est dès l'intégration de la préparation. Repère affiché dans l'unitaire : « à libérer (semaine pas encore libérée) ». Callout : « S44 pas encore libérée vers l'atelier — Ses lignes sont « à libérer »… ». Legacy : la ligne naît au statut 0 « A traiter » et arrive directement dans l'écran de l'atelier (ateliers 1 et 4, `rpc_statut = 0`), sans condition de validation admin, de réception ni de Colisage.
- Déclencheur : intégration de la préparation (statut initial) ; libération (RG-COO-240) pour la sortie de cet état.
- Conditions : ateliers fixe (1, 4) et pliage (2, 3, 9, 10) ; bus.
- Effet / message d'erreur : repère « à libérer » (filtre Repère) ; la maquette n'en fait pas un statut persistant : le repère est dérivé de l'absence de libération (HYPOTHÈSE, voir Q-250).
- Sources : écran `ECR-COO-09` ; spec `specs-coordination.md §C` (EX-COO-025), `specs-existant-process.md §D` (EX-EXI-040, EX-EXI-042, EX-EXI-071) ; legacy `p_s_listeprepa2m2.sql:71-74`, `p_integ_preparation.sql:100-147` (ancien ID provisoire RG-COO-041)
- Questions liées : Q-250, Q-265
- Implémentation : FAIT — apps/api/src/modules/coordination/unitaire.ts:construireLignes (`aLiberer`) ; apps/web/src/routes/coordination/unitaire.tsx (ÉTAPE 8 (2026-11-05) : repère dérivé de l'absence de libération (HYPOTHÈSE Q-250), filtre Repère « À libérer », libellé « À libérer » à la place de « À traiter » ; dépend de l'hypothèse Q-265)
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts ; e2e/coordination-unitaire.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL pour tout le groupe Q-265 / Q-404 (RG-COO-240 à 242, 250, 260 à 262, RG-X-076, RG-X-084) : fonctions appelées et testées (nominal et rejet) mais HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; Q-265 est une HYPOTHÈSE PRISE (option (c)), plus une question bloquante

### RG-COO-242 — Repère « Arrivé après libération » : tag, callout, filtre
- Origine : NOUVELLE
- Énoncé : un dossier dont la préparation est reçue après la libération de sa semaine porte le repère « Arrivé après libération » (niveau Important) ; la ligne est teintée « serious » ; le bandeau de libération affiche un callout d'avertissement avec la liste des dossiers arrivés après et les boutons « Voir ces dossiers » (pose le filtre Repère = après libération) et « Voir le mail ». Un compteur de dossiers arrivés après libération s'affiche en badge du menu Préparation.
- Déclencheur : arrivée d'une préparation sur une semaine déjà libérée (RG-X-076).
- Conditions : libération existante pour (atelier, semaine) et date de réception de la préparation > date de libération.
- Effet / message d'erreur : repère posé ; alerte `APRES_LIBERATION` et mail (RG-X-076).
- Sources : écran `ECR-COO-09` ; spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503), `PARTIE 4` (EX-FIX-503) ; `maquettes-reception-coordination.md §1.4` (événement 1)
- Questions liées : Q-266
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts:construireLignes (`apresLiberation`), semainesLiberation ; apps/api/src/modules/coordination/alertes-coordination.ts (alerte LIB-) (ÉTAPE 8 (2026-11-05) : repère, ligne teintée, callout et filtre « Arrivé après libération », alerte APRES_LIBERATION ; reste : « Voir le mail », badge du menu, mail non envoyé Q-375, fenêtre Q-266)
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts ; e2e/coordination-unitaire.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — PARTIEL pour tout le groupe Q-265 / Q-404 (RG-COO-240 à 242, 250, 260 à 262, RG-X-076, RG-X-084) : fonctions appelées et testées (nominal et rejet) mais HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; Q-265 est une HYPOTHÈSE PRISE (option (c)), plus une question bloquante

### RG-COO-243 — Rendre la main à la Pré-Prod
- Origine : MODIFIÉE
- Énoncé : l'action groupée « Rendre la main à la Pré-Prod » demande un motif (texte, défaut « Changement de visuel demandé par le client ») et affiche « n unité(s) déjà en production — Elles ne seront pas retirées (point de non-retour) » ; « Rendre la main » repasse les dossiers à PREPA_RECUE, les unités non lancées à EN_ATTENTE avec repère « rendu » et enregistre le rendu. Legacy (fixe) : on peut changer les informations même après envoi de la préparation : Préparation 2 m² fixe, sélectionner semaine / dossier / atelier, « Retirer » + confirmer, puis Administration › Déblocage préparations, sélectionner dossier / semaine / plateforme et « rendre la main ». Déroulant : seulement si la production n'est pas lancée. MODIFIÉE : la maquette réunit les deux étapes en une action de l'écran unitaire ; l'effet sur la validation admin et les affiches reçues est une question ouverte (Q-COO-18 maquette).
- Déclencheur : « Rendre la main » (unitaire) ; le déblocage de préparation (coo1) reste l'action d'administration.
- Conditions : unités non EN_PROD (RG-COO-223) ; la préparation concernée doit pouvoir être renvoyée par Broadcast ensuite (la précédente doit être annulée, RG-COO-042 legacy, coo1).
- Effet / message d'erreur : dossiers → PREPA_RECUE, unités → EN_ATTENTE ; historique ; effet sur la validation admin : RG-X-081.
- Sources : écran `ECR-COO-09b` ; spec `specs-existant-process.md §D` (EX-EXI-045), `§B` (EX-EXI-020) ; legacy `AdminPreparationDeblocageBll.cs:252-333` (RG-COO-084 legacy, coo1)
- Questions liées : Q-267
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:rendreLaMain ; apps/web/src/routes/coordination/unitaire.tsx:ModaleMain (COO-P12 (2026-11-05) : « Rendre la main à la Pré-Prod » (coord) : motif (défaut de la maquette), unités non lancées repassent « A traiter » (EN_ATTENTE) avec le repère « main rendue », l'UM est supprimée, rendu enregistré, historique par dossier, unités déjà en production comptées et non retirées (point de non-retour, 422 si toutes le sont) ; le dossier « A traiter » repasse à « Préparation reçue » (unitaire.ts), validation admin et affiches reçues inchangées (RG-X-081, HYPOTHÈSE Q-217) ; reste : annulation côté Circé pour le renvoi de Broadcast (déblocage du groupe, RG-COO-145 : COO-P08) et effet sur la validation admin (Q-267 OUVERTE, Q-COO-18))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-244 — Corriger l'intitulé (annonceur imprimé, thème) par la plateforme
- Origine : NOUVELLE
- Énoncé : l'action de ligne « Corriger l'intitulé » (fixe, pliage) modifie l'annonceur imprimé et le thème d'une unité, appliqué à toutes les unités du thème. Champs non vides : « Le thème et l'annonceur ne peuvent pas être vides. » ; aucune modification : « Rien n'a changé. ». La case « Prévenir la Pré-Prod, pour aligner Broadcast si besoin » est cochée par défaut ; un callout avertit si la production est lancée. L'action pose `corrPlateforme` (n'alerte pas « Broadcast ≠ Circé »), pose « Feuille à refaire » sur les affiches concernées et, si la case est cochée, envoie un mail à « Pré-Prod <site> ». La cible demande que les plateformes puissent modifier thème et annonceur en dernier lieu même si la production est lancée (fixe et colle), avec droits limités.
- Déclencheur : action « Corriger l'intitulé » (fixe, pliage) ; « Textes de bague » pour le bus (RG-COO-300).
- Conditions : profils `cheq` / `coord` ; production lancée autorisée (exception à RG-COO-223 limitée à l'intitulé imprimé, HYPOTHÈSE à confirmer).
- Effet / message d'erreur : voir Énoncé ; effet côté Réception : RG-X-082.
- Sources : écran `ECR-COO-09c` ; spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-509), `specs-existant-process.md §F` (EX-EXI-079)
- Questions liées : Q-268
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:corrigerIntitule ; apps/web/src/routes/coordination/unitaire.tsx:ModaleIntitule (COO-P12 (2026-11-05) : annonceur imprimé et thème de TOUTES les unités du thème (même dossier et site), vides refusés (422 « Le thème et l'annonceur ne peuvent pas être vides. »), « Rien n'a changé. », production lancée autorisée (HYPOTHÈSE Q-196 (3)), repère « corrigé par la plateforme », « Feuille à refaire » sur les affiches rattachées (RG-X-082), historique par unité et par dossier ; reste : le mail à « Pré-Prod <site> » est consigné (NON_ENVOYE) mais pas envoyé (Q-375))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-245 — Jours d'affichage dans la préparation
- Origine : NOUVELLE
- Énoncé : la préparation affiche les jours d'affichage (jour de départ) afin de prioriser selon les jours de départ ; la présentation (sans multiplier les lignes, par exemple plusieurs jours dans la même case) reste à trancher. La maquette fournit « Départ » (semaine, filtre) et « Départ camion » (date-heure, par destinataire × semaine).
- Déclencheur : affichage de l'unitaire.
- Conditions : source du jour de départ = destinataire × semaine (`jour`/`hh`/`mm` relatifs au lundi de S-1) ; non spécifié pour le fixe.
- Effet / message d'erreur : colonne ; aucun refus.
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-504) ; écran `ECR-COO-09`
- Questions liées : Q-270
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx (COO-P12 (2026-11-05) : colonne Départ (semaine) et jour d'affichage de la ligne (`rpc_dat_aff`) ; reste : présentation de plusieurs jours dans une même case (Q-270), départ camion par destinataire × semaine non modélisé)
- Tests : apps/api/test/coordination/unitaire.int.test.ts

### RG-COO-246 — Fiche de synthèse de préparation (groupée par destinataire)
- Origine : MODIFIÉE
- Énoncé : la « Fiche de synthèse » liste, selon les filtres de l'écran, les lignes groupées par destinataire : Destinataire, Dossier, Annonceur, Thème, Repiquage, Format, Qté, Entretien, Total ; bouton « Imprimer la fiche ». Legacy : fiche de préparation (détail et synthèse) téléchargeable en Excel ; l'atelier la donne en V1 à l'atelier avant le Colisage (Jeudi S-2) ; état `PreparationSyntheseUm.rdlc` (en-tête expéditeur = plateforme). La génération est faite côté navigateur (CLAUDE.md §3).
- Déclencheur : « Fiche de synthèse » (icône imprimante).
- Conditions : filtres courants de l'unitaire.
- Effet / message d'erreur : aperçu puis impression ; en legacy l'échec de rendu est avalé (réponse vide) : en cible une erreur doit être affichée.
- Sources : écran `ECR-COO-09d` ; legacy `Rapport.cs:105-172` (état `PreparationSyntheseUm.rdlc`), `ReportController.cs:14-40,44` (anciens ID provisoires RG-ADM-060, RG-ADM-063) ; spec `specs-existant-process.md §D` (EX-EXI-043), `specs-transverse.md §D` (EX-TRA-025)
- Questions liées : Q-287
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:syntheseUnitaire ; apps/web/src/routes/coordination/unitaire.tsx:ModaleSynthese (COO-P12 (2026-11-05) : fiche de synthèse groupée par destinataire (Dossier, Annonceur, Thème, Repiquage, Format, Qté, Entretien, Total, totaux par destinataire et général) selon les filtres ; impression par le navigateur (window.print, RG-COO-306, Q-287) ; reste : fichier Excel du legacy (Q-175), mise en page de l'état `PreparationSyntheseUm.rdlc` (Q-287))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-247 — Pliage : saisie du comptage et passage à PRODUIT
- Origine : NOUVELLE
- Énoncé : l'action groupée « Plié : saisir le comptage » (sur les unités PRET ou EN_PROD) demande « Affiches comptées » (défaut = attendu) ; « Valider le comptage » passe les unités à PRODUIT. Message : « Comptage conforme. » ou « Écart de comptage : n affiche(s). Alerte qualité créée. » (dans la maquette l'alerte n'est pas réellement créée).
- Déclencheur : « Plié : saisir le comptage » (Pliage).
- Conditions : unités de type lot de pliage (`PL-nnnn`) ; pliage sans machine (REU-07).
- Effet / message d'erreur : unités → PRODUIT ; alerte qualité en cas d'écart (comportement cible à confirmer).
- Sources : écran `ECR-COO-09` (« Comptage pliage ») ; spec `specs-existant-process.md §D` (EX-EXI-042 : « Pliage : même processus sans machine »)
- Questions liées : Q-250
- Implémentation : PARTIEL [audit final COO-P11/P12/P13 : dépend de `unitaire.typesPliage` vide par défaut (Q-319) et de la création des UM (Q-265)] · — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:comptagePliage (COO-P12 (2026-11-05) : « Plié : saisir le comptage » (lots de pliage seulement, 409 sinon) : attendu = total des lignes, unités → « Préparé » (Produit), « Comptage conforme. » ou « Écart de comptage : n affiche(s). Alerte qualité créée. » ; l'alerte qualité est une entrée de journal (comportement cible à confirmer, HYPOTHÈSE Q-196 (4)) ; pliage identifié par le paramètre `unitaire.typesPliage` (vide : Q-319))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-248 — 2 m² fixe unique (suppression de la distinction Vrac / Roulée)
- Origine : MODIFIÉE
- Énoncé : les préparations « Vrac » et « Roulée » sont fusionnées en un seul type « 2 m² fixe » ; la distinction n'est plus nécessaire et génère des lignes en plus. Dans la maquette le type de préparation de l'unitaire est « 2 m² fixe », « Collé » ou « Bus ».
- Déclencheur : intégration de la préparation ; affichage de l'état des réservations / de l'atelier fixe.
- Conditions : toute ligne de préparation fixe (types de préparation hors déroulant 17 à 21 et hors pliage 23).
- Effet / message d'erreur : une ligne, pas deux, par (destinataire × afficheur × thème).
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-501) ; legacy `p_integ_preparation.sql:100-147,239-249` (ancien ID provisoire RG-COO-041)
- Questions liées : —
- Implémentation : PARTIEL [audit final COO-P11/P12/P13 : inutilisable sans création des UM (Q-265) ; types vides par défaut (Q-319)] · — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:construireLignes (COO-P12 (2026-11-05) : un seul type « 2 m² fixe » (tout type d'un atelier fixe hors pliage et bus, paramètres `unitaire.typesPliage` / `unitaire.typesBus`) ; les lignes d'un même destinataire × thème × dossier × semaine (ex-Vrac et Roulée) sont fusionnées en une ligne)
- Tests : apps/api/test/coordination/unitaire.int.test.ts

### RG-COO-249 — « Retirer » une préparation : suppression des UM et retour des répartitions à « A traiter »
- Origine : CONSERVÉE
- Énoncé : « Retirer préparation » remet les `tf_repart_calcul` de l'UM à `rpc_statut = 0`, `UM_id = NULL`, puis supprime l'UM. Legacy : aucune vérification des colis (la suppression échoue par contrainte étrangère si l'UM est dans un colis) ; `rpc_user` n'est pas mis à jour (seule la date). Cible : refus explicite si l'UM est dans un colis ; utilisateur tracé.
- Déclencheur : action « Retirer » (Préparation 2 m² fixe / Pliage / Bus), droit `retirer`.
- Conditions : UM dans aucun colis non supprimé ; UM non expédiée.
- Effet / message d'erreur : répartitions `* → 0` ; UM supprimée ; refus 409 si l'UM est dans un colis (« L'UM est dans un colis » : libellé à définir).
- Sources : legacy `PreparationService.cs:275-288`, `PreparationRepository.cs:336-387`, `tf_UM_colis.sql:10` (ancien ID provisoire RG-RPR-013) ; spec `specs-existant-process.md §D` (EX-EXI-042 : retour à 0 si l'UM est supprimée, EX-EXI-045)
- Questions liées : Q-271
- Implémentation : FAIT — apps/api/src/modules/coordination/colis.ts:enregistrerGardeRetraitUnite ; apps/api/src/modules/coordination/unitaire.ts:retirerUnite (COO-P13 (2026-11-05) : la garde « UM dans un colis » (point d'extension de COO-P12) est branchée par le module colis : une UM placée dans un colis ne se retire pas et la main ne se rend pas (409 COO_UM_DANS_COLIS, règle citée = RG-COO-249 ou 243) ; une UM « Annulé » ne se retire pas non plus (409, ANO-052 corrigée : seule l'UM « En cours » se retire))
- Tests : apps/api/test/coordination/colis.int.test.ts ; apps/api/test/coordination/unitaire-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — référence corrigée : la garde est `umDansColis` (unitaire.ts), pas `colis.ts:enregistrerGardeRetraitUnite`

### RG-COO-250 — « Préparer » : l'UM et ses répartitions passent à « Préparé »
- Origine : CONSERVÉE
- Énoncé : l'action « Préparer » (liste des UM) fixe le statut cible 6 (Préparé) et l'applique à l'UM et à ses `tf_repart_calcul` (date et utilisateur mis à jour). Cible : statut d'unité PRODUIT (mapping « Préparé (6) = Produit »). Aucun contrôle du statut d'origine dans le service legacy ; gardes éventuelles côté vue / JS non lues.
- Déclencheur : action « Préparer » (liste des UM).
- Conditions : HYPOTHÈSE (Q-271) : seules les UM au statut 1 (En cours) ou 6 peuvent être préparées ; les UM à 3, 4, 7, 8 sont refusées (409).
- Effet / message d'erreur : UM et répartitions `1 → 6` ; historique.
- Sources : legacy `PreparationService.cs:294-299`, `PreparationRepository.cs:435-470` (ancien ID provisoire RG-RPR-014) ; spec `specs-existant-process.md §D` (EX-EXI-042) ; maquette `maquettes-autres-modules.md §0.6 point 6`
- Questions liées : Q-250, Q-271
- Implémentation : ÉTAPE 8 (2026-11-05) : FAIT sur des UM créées par « Colisage » (Colisage → Préparer, testé, liberation-colisage.int.test.ts) ; dépend de l'hypothèse Q-265 (option (c)) · PARTIEL [audit final COO-P11/P12/P13 : inutilisable sans création des UM (Q-265)] · — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:preparerSelection, preparerUnites (COO-P12 (2026-11-05) : « Préparer » : l'UM et ses répartitions « En cours » passent « Préparé » (Produit) avec historique et journal ; une UM déjà préparée n'est pas réécrite ; HYPOTHÈSE Q-271 : seules les UM « En cours » ou « Préparé » (409 pour 3, 4, 7, 8 et pour une ligne sans UM))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL pour tout le groupe Q-265 / Q-404 (RG-COO-240 à 242, 250, 260 à 262, RG-X-076, RG-X-084) : fonctions appelées et testées (nominal et rejet) mais HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; Q-265 est une HYPOTHÈSE PRISE (option (c)), plus une question bloquante

### RG-COO-251 — Pas de déplacement (drag and drop) après l'envoi d'une préparation
- Origine : NOUVELLE
- Énoncé : le déplacement manuel (drag and drop) d'éléments n'est plus autorisé après l'envoi d'une préparation ; à vérifier s'il s'agit d'un process ou d'un blocage système (revoir le rétro-planning). L'objet du déplacement (positions de trains ? lignes ?) n'est pas précisé ; la position d'un visuel est déjà « figée » à l'Instruction OK (RG-COO-201).
- Déclencheur : tentative de réordonnancement après réception de la préparation.
- Conditions : HYPOTHÈSE (Q-261) : s'applique au réordonnancement des positions / ordre des faces d'un dossier dont la préparation est reçue.
- Effet / message d'erreur : refus 409 ; libellé à définir.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-511 : ligne isolée, statut « A revoir Bao »), `specs-coordination.md §C` (EX-COO-050 : Q46 sur l'ordre des trains)
- Questions liées : Q-261
- Implémentation : PARTIEL [audit final COO-P11/P12/P13 : absence de route ; objet du déplacement non précisé (HYPOTHÈSE Q-261)] · — — (aucun réordonnancement n'existe en V2 : test d'absence) (COO-P12 (2026-11-05) : le déplacement manuel (drag and drop) n'existe pas en V2 : aucune route de réordonnancement ; la position d'un visuel est figée à l'Instruction OK (RG-COO-201) ; objet du déplacement non précisé (HYPOTHÈSE Q-261))
- Tests : apps/api/test/coordination/unitaire.int.test.ts (absence)

### RG-COO-260 — Construction des UM (agrégation et découpage par quantité d'UM du support)
- Origine : CONSERVÉE
- Énoncé : `BuildUm` trie les lignes de répartition (destinataire, contrat, support, type de préparation, thème, repiquage, afficheur) et les cumule tant que ces clés sont identiques : un changement de destinataire / contrat / support / type / thème / repiquage clôt l'UM ; un changement d'afficheur ne clôt l'UM que si le destinataire est `DesDispatch = 'O'`. Pour `DesDispatch = 'N'` (ou NULL), l'afficheur et `PersIdent` sont effacés. Toute UM dont la quantité dépasse `SupQteUM` (non nul, ≠ 0) est scindée en UM de `SupQteUM` + un reliquat. Un seul thème par UM. Maquette : un UM par ligne destinataire × afficheur au fixe.
- Déclencheur : action « Colisage » (détail / synthèse) legacy ; en cible le déclencheur de création des UM est à trancher (RG-COO-240).
- Conditions : `SupQteUM` renseigné et ≠ 0 ; TODO legacy : « changer l'algorithme pour ne plus effacer la donnée afficheur » (`PreparationService.cs:115-117`).
- Effet / message d'erreur : liste de préparations destinées à `InsertUM` (RG-COO-261). Les 3 `ShallowCopy` de la boucle de découpage partagent la même `currentPrep` (`RpcIdLstUM` partagé) : les répartitions seraient rattachées à la première UM insérée (INCERTAIN, à vérifier par test avant reprise).
- Sources : legacy `PreparationService.cs:81-107,113-269` (ancien ID provisoire RG-RPR-011) ; spec `specs-existant-process.md §D` (EX-EXI-041, EX-EXI-073)
- Questions liées : Q-265, Q-271
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire-creation.ts:creerUnites ; routes-unitaire.ts (POST /coordination/unitaire/colisage) ; unitaire.tsx (bouton « Colisage ») (ÉTAPE 8 (2026-11-05) : HYPOTHÈSE PRISE Q-265 option (c) : construction par regroupement (+ atelier et semaine de départ) et découpage par quantité d'UM du support avec reliquat ; l'afficheur étant le destinataire en V2 (Q-196), il ne clôt jamais une UM ; `DesDispatch` N n'efface rien ; la boucle `ShallowCopy` incertaine n'est pas reproduite)
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts ; e2e/coordination-unitaire.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — PARTIEL pour tout le groupe Q-265 / Q-404 (RG-COO-240 à 242, 250, 260 à 262, RG-X-076, RG-X-084) : fonctions appelées et testées (nominal et rejet) mais HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; Q-265 est une HYPOTHÈSE PRISE (option (c)), plus une question bloquante

### RG-COO-261 — Création d'une UM : statut 1, code barre, code synthèse, poids, date d'affichage minimale
- Origine : CONSERVÉE
- Énoncé : `InsertUM` insère un `tf_UM` en statut 1 (En cours) puis calcule `UM_code_barre` = `AASS-` + `UM_id` sur 13 chiffres (AA / SS = année / semaine courantes de l'UM) ; `UM_code_synthese` = `AASSMMJJ` + atelier sur 2 + destinataire sur 8 chiffres ; poids = `SupPoids × Quantité`. Chaque `tf_repart_calcul` de l'UM reçoit `UM_id`, `rpc_statut = 1`, date et utilisateur de mise à jour. Puis `UM_date_aff` = minimum de `rpc_dat_aff` des répartitions liées (les UM sans lien reçoivent le minimum du lot).
- Déclencheur : « Colisage » / création d'UM.
- Conditions : chaque UM est créée dans une transaction distincte en legacy (pas d'atomicité globale) ; cible : toutes les écritures d'une opération de colisage dans une transaction unique (CLAUDE.md §6). Flag `IsBusV3` + atelier bus : mock (`PreparationBusMockRepository`), non analysé.
- Effet / message d'erreur : UM créée à 1, répartitions `→ 1` (RG-COO-262 pour le filtre de statut d'origine).
- Sources : legacy `PreparationRepository.cs:190-303,309-330`, `p_u_DateAffMinUM.sql:19-41` (ancien ID provisoire RG-RPR-012) ; spec `specs-existant-process.md §D` (EX-EXI-041)
- Questions liées : Q-271
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire-creation.ts:creerUnites (ÉTAPE 8 (2026-11-05) : UM « En cours », code barre AASS- + id sur 13 chiffres, code synthèse AASSMMJJ + atelier (2 chiffres au moins) + destinataire (8), poids du support × quantité, date d'affichage minimale, historique et journal, transaction unique ; hypothèses Q-404 : AA / SS = année et semaine ISO du jour, atelier > 99)
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — PARTIEL pour tout le groupe Q-265 / Q-404 (RG-COO-240 à 242, 250, 260 à 262, RG-X-076, RG-X-084) : fonctions appelées et testées (nominal et rejet) mais HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; Q-265 est une HYPOTHÈSE PRISE (option (c)), plus une question bloquante

### RG-COO-262 — Statuts d'origine admis pour l'entrée d'une répartition dans une UM
- Origine : MODIFIÉE
- Énoncé : legacy : `InsertUM` met `rpc_statut = 1` sur les répartitions de la sélection sans contrôler le statut d'origine : une répartition en 3 (Erreur) ou 4 (Annulé) devient 1 si elle figure dans la sélection (le filtre éventuel est dans l'écran / `p_s_*`, non lu). Cible : table de transitions explicite : seules les répartitions au statut 0 (« A traiter » / à libérer puis libérée) entrent dans une UM ; les répartitions 3 et 4 sont refusées (409), et une répartition déjà dans une UM (statut 1) n'est réaffectée que par « Retirer » (RG-COO-249).
- Déclencheur : création d'UM.
- Conditions : HYPOTHÈSE (Q-271) : écart legacy corrigé conformément à CLAUDE.md §6 (toute transition non listée = 409).
- Effet / message d'erreur : 409 « transition interdite » (`regle` = RG-COO-262) pour les répartitions 3, 4, 6, 7, 8 ; seule la transition 0 → 1 est acceptée.
- Sources : legacy `PreparationRepository.cs:190-303` (ancien ID provisoire RG-RPR-012, tableau §7.1 de legacy-repartition-production.md) ; CLAUDE.md §6
- Questions liées : Q-271
- Implémentation : FAIT — apps/api/src/modules/coordination/unitaire-creation.ts:creerUnites ; unitaire.ts:TRANSITIONS_REPARTITION (ÉTAPE 8 (2026-11-05) : seule la transition 0 → 1 est acceptée, 409 (`regle` RG-COO-262) pour tout autre statut ou une ligne déjà dans une UM, sélection mixte annulée en bloc, quantité nulle refusée 422 RG-COO-275)
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL pour tout le groupe Q-265 / Q-404 (RG-COO-240 à 242, 250, 260 à 262, RG-X-076, RG-X-084) : fonctions appelées et testées (nominal et rejet) mais HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; Q-265 est une HYPOTHÈSE PRISE (option (c)), plus une question bloquante

### RG-COO-263 — Poids d'une UM / d'un colis : minimum 1 kg, +3 kg pour les ateliers 7 et 8
- Origine : CONSERVÉE
- Énoncé : poids du colis = Σ (`uc_qte` × `sup_poids`) des UM du colis ; sans UM, Σ (nombre de faces de train × `sup_poids`) ; si nul, poids du support 0 ; minimum forcé à 1,0 kg (« pour Calberson ») ; ajout de 3,0 kg si `ate_id IN (7, 8)`. Le poids est recalculé depuis zéro (pas de cumul du +3 kg).
- Déclencheur : ajout ou retrait d'UM ; création de colis.
- Conditions : valeurs en dur (ateliers 7 et 8 = 8 m², transporteur Calberson) ; en cible le transporteur est unique (Geodis, ECR-ADM-06) : applicabilité du minimum 1 kg à confirmer.
- Effet / message d'erreur : poids du colis mis à jour.
- Sources : legacy `p_u_poidsColis.sql:18-61` (ancien ID provisoire RG-RPR-022) ; écran `ECR-ADM-06`
- Questions liées : Q-271
- Implémentation : PARTIEL [audit final COO-P11/P12/P13 : dépend de la reprise des ateliers (`colis.ateliersMajoration` vide par défaut, Q-319 / Q-195)] · — apps/api/src/modules/coordination/colis.ts:recalculerPoids (COO-P13 (2026-11-05) : poids recalculé depuis zéro à chaque ajout / retrait / expédition (Σ uc_qte × poids du support ; sans UM Σ faces × poids du support ; minimum 1 kg conservé, Q-271) ; reste : la majoration de 3 kg des ateliers 8 m² lit le paramètre `colis.ateliersMajoration`, vide tant que les ateliers ne sont pas repris (Q-319, Q-197 (10)) ; l'applicabilité du minimum 1 kg (Calberson) reste à confirmer (Q-271))
- Tests : apps/api/test/coordination/colis.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — PARTIEL (critère unique : paramètres vides par défaut) : `colis.ateliersMajoration` vide par défaut (Q-319 / Q-195)

### RG-COO-264 — Fractionnement d'une UM sur plusieurs colis (`uc_qte`)
- Origine : CONSERVÉE
- Énoncé : `tf_UM_colis` (clé UM_id + colis_id, `uc_qte` = quantité de l'UM dans le colis, `UM_qte` = quantité totale) permet le fractionnement d'une UM sur plusieurs colis ; la quantité « préparée » est `uc_qte`, « à préparer » `UM_qte` ; la recherche par code renvoie `ISNULL(uc_qte, UM_qte)`. Legacy : aucune contrainte vérifiant que Σ `uc_qte` ≤ `UM_qte`.
- Déclencheur : ajout d'une UM à un colis ; mise à jour de `uc_qte`.
- Conditions : contrainte Σ `uc_qte` ≤ `UM_qte` non établie (non spécifiée, Q-272).
- Effet / message d'erreur : ligne `tf_UM_colis` créée / mise à jour.
- Sources : legacy `tf_UM_colis.sql:1-11`, `PreparationColisageService.cs:128-135`, `p_s_UM_from_code.sql:39`, `PreparationColisageRepository.cs:356-383` (ancien ID provisoire RG-RPR-023)
- Questions liées : Q-272
- Implémentation : FAIT — apps/api/src/modules/coordination/colis.ts:ajouterUnite (COO-P13 (2026-11-05) : une UM se place en plusieurs colis (`tf_UM_colis`, uc_qte = quantité dans CE colis, défaut = reste à placer) ; HYPOTHÈSE Q-197 (6) : Σ uc_qte ≤ UM_qte (422 COO_UM_QUANTITE_DEPASSEE), le legacy ne le contrôlait pas (Q-272))
- Tests : apps/api/test/coordination/colis.int.test.ts

### RG-COO-265 — Rattachement d'une UM à un colis : statuts 1 ou 6, même destinataire
- Origine : MODIFIÉE
- Énoncé : l'ajout d'une UM par code barre (détail ou synthèse) filtre les UM aux statuts 1 (En cours) ou 6 (Préparé) ; le destinataire de l'UM doit être celui du colis (version `PreparationColisBll` : et même atelier) ; une UM déjà dans le colis n'est pas ajoutée. À l'ajout : ligne `tf_UM_colis`, UM → 6, poids du colis recalculé. Messages : « L'UM n'existe pas ou n'est pas en cours ou préparée » ; « Le destinataire de l'UM ne correspond pas à celle du colis » ; « L'UM à ajouter existe déjà dans le colis » ; « Le destinataire des UMs est différent de celui du colis ! ». Une UM Préparée déjà dans un autre colis peut être ajoutée à un second colis. MODIFIÉE : en cible (module EXP) le scan refuse une unité qui n'est pas « Produit » (« … n'est pas « Produit » (statut : …) »), un code inconnu (« Code inconnu : X »), et un destinataire différent (contrôle bloquant) ; la divergence entre les deux implémentations legacy est à unifier.
- Déclencheur : saisie / scan d'une UM sur l'écran Colisage / Préparation colis.
- Conditions : voir Énoncé ; droit `train_preparation` / production selon l'écran (non vérifié côté serveur en legacy).
- Effet / message d'erreur : UM `1|6 → 6` ; 422 avec les messages ci-dessus.
- Sources : legacy `PreparationColisageService.cs:76-148`, `PreparationColisBll.cs:270-324`, `PreparationColisRepository.cs:311-334`, `p_s_UM_from_code.sql` (ancien ID provisoire RG-RPR-016) ; écran `ECR-EXP-01`
- Questions liées : Q-272
- Implémentation : FAIT — apps/api/src/modules/coordination/colis.ts:ajouterUnite ; apps/web/src/routes/expedition/index.tsx (COO-P13 (2026-11-05) : rattachement par code barre (ou UM-<id>) : UM « En cours » ou « Préparé » seulement, même destinataire ET même atelier que le colis, pas déjà dans le colis ; messages du legacy (« L'UM n'existe pas ou n'est pas en cours ou préparée », « Le destinataire de l'UM ne correspond pas à celle du colis », « L'UM à ajouter existe déjà dans le colis ») en 422 ; UM « En cours » → « Préparé » (historique) ; colis clos : 409)
- Tests : apps/api/test/coordination/colis.int.test.ts ; e2e/roulage-expedition.spec.ts

### RG-COO-266 — Création, ouverture et suppression d'un colis
- Origine : MODIFIÉE
- Énoncé : un colis est créé au statut 1 (En cours) avec format « À définir » (5) ; `p_u_detail_colis` fixe l'adresse principale (`adr_principale = '1'`), le code colis `C-` + `colis_id` sur 18 chiffres et le transporteur / tarif (`tr_ate_dest_trans` pour destinataire + atelier). Un colis ne se supprime que s'il ne contient plus d'UM. « Ouvrir » un colis : `PreparationColisageService.OpenColis` met le colis ET toutes ses UM à 1 ; `PreparationColisBll.OuvrirColis` met le colis à 1, vide `colis_dat_expe` et remet les UM à 6 (deux comportements) ; `OpenColis` peut rouvrir un colis déjà Terminé (8) sans contrôle. MODIFIÉE : en cible (maquette EXP-01) un colis clos ne se rouvre pas (décision du 16/10) et le besoin de ré-ouverture (EX-EXP-506) est classé « Refusé » dans la synthèse.
- Déclencheur : écrans Colisage / Colis ; scan du code colis.
- Conditions : suppression : colis vide ; ouverture : voir Q-272.
- Effet / message d'erreur : colis `∅ → 1` ; `7|8 → 1` (ouverture legacy) ; UM `7|8 → 1` ou `→ 6` selon l'écran.
- Sources : legacy `PreparationColisageService.cs:35-54,227-238,329-345`, `PreparationColisBll.cs:139-158`, `p_u_detail_colis.sql:17-41`, `p_u_statut_colis_UM.sql:22-42` (ancien ID provisoire RG-RPR-017) ; spec `specs-ateliers-besoins.md PARTIE 7` (EX-EXP-506), `specs-existant-process.md §G` (EX-EXI-085) ; écran `ECR-EXP-01`
- Questions liées : Q-272
- Implémentation : PARTIEL — apps/api/src/modules/coordination/colis.ts:creerColis, supprimerColis, ouvrirColis (COO-P13 (2026-11-05) : colis créé « Colis ouvert », format « À définir » (5), code `C-` + n° sur 18 chiffres, poids minimum ; suppression seulement si vide (409 COO_COLIS_NON_VIDE) ; « Ouvrir » un colis clos refusé (409 COO_COLIS_NON_ROUVRABLE, décision du 16/10, Q-272) ; le premier scan ouvre un colis (ECR-EXP-01) ; reste : adresse principale du colis (`adr_principale`) non modélisée, transporteur / tarif posés à l'expédition (Q-272, étape 8))
- Tests : apps/api/test/coordination/colis.int.test.ts ; e2e/roulage-expedition.spec.ts

### RG-COO-267 — Retrait d'une UM d'un colis : retour de l'UM à « En cours » si elle n'est plus dans aucun colis
- Origine : CONSERVÉE
- Énoncé : le retrait supprime la ligne `tf_UM_colis` ; si l'UM n'est plus dans aucun colis non expédié, l'UM repasse à 1 (En cours) ; le poids du colis est recalculé (RG-COO-263). La recherche des colis d'une UM renvoie une liste vide si TOUS ses colis sont au statut 7 (expédié). La sélection multiple pour retirer d'un coup tous les trains / UM d'un colis est demandée (aujourd'hui code par code).
- Déclencheur : retrait d'une UM / d'un train d'un colis (Préparation de train › Préparer).
- Conditions : colis non expédié ; première surcharge `DestroyPrepaUmColis(int umId, …)` : l'objet porte `Colis_statut` au lieu de `RpcStatut`, la valeur écrite pourrait être la valeur par défaut (INCERTAIN). Le statut du `tf_repart_calcul` n'est pas rétabli.
- Effet / message d'erreur : UM `6 → 1` ; poids recalculé.
- Sources : legacy `PreparationColisageService.cs:240-322`, `PreparationColisBll.cs:327-371`, `PreparationRepository.cs:409,418` (ancien ID provisoire RG-RPR-018) ; spec `specs-ateliers-besoins.md PARTIE 7` (EX-EXP-503)
- Questions liées : Q-272, Q-273
- Implémentation : FAIT — apps/api/src/modules/coordination/colis.ts:retirerDuColis (COO-P13 (2026-11-05) : retrait d'une UM ou d'un train d'un colis non expédié : UM « Préparé » → « En cours » si elle n'est plus dans aucun colis (« A expédier » si ses autres colis sont clos, Q-197 (5)), face retirée au statut d'avant (5 / 9 / 10, Q-197 (4)), poids recalculé, « Tout retirer », colis vidé supprimé (ECR-EXP-01) ; colis clos : 409)
- Tests : apps/api/test/coordination/colis.int.test.ts ; e2e/roulage-expedition.spec.ts

### RG-COO-268 — Expédition d'un colis : colis, UM (ateliers 1 à 4) ou trains → « A expédier »
- Origine : CONSERVÉE
- Énoncé : « Expédier » enregistre transporteur / tarif (`tsp_id_tarif_code`), code externe, commentaire, poids, format, `colis_dat_expe = now` et met le colis à 7. Si l'atelier du colis est 1 à 4 : toutes les UM du colis → 7 ; sinon les `tf_face_train` du colis → 7. En « re-saisie » (colis déjà à 7) seul le code externe est mis à jour. Un code externe « ETIQUETTES » est remis à NULL. Si le transporteur vaut 2 (Calberson en dur) et que le statut avant action est 1, génération d'un fichier BL ; pour `tsp_id = 2` l'écran reste ouvert pour saisir le code externe. Défaut legacy : la clause « NOT EXISTS colis non expédié » de `p_u_expedie_Colis` compare le colis à lui-même ; une UM répartie sur deux colis passe donc à 7 dès l'expédition du premier (contraire au commentaire).
- Déclencheur : écran Expédition colis (module EXP, étape 8).
- Conditions : ateliers 1 à 4 = UM sinon trains (valeurs en dur) ; profils non contrôlés en legacy.
- Effet / message d'erreur : colis `1 → 7` ; UM `1|6 → 7` ; faces `* → 7` ; message « Problème lors de l'expédition » si ≠ 1 ligne. Cible : une UM n'est « A expédier » que lorsque tous ses colis sont expédiés (HYPOTHÈSE, Q-272).
- Sources : legacy `PreparationColisBll.cs:497-560`, `PreparationColisRepository.cs:482-569`, `p_u_expedie_Colis.sql:34-73`, `PreparationColisageService.cs:211-220` (ancien ID provisoire RG-RPR-019) ; écran `ECR-EXP-02`
- Questions liées : Q-272, Q-284
- Implémentation : PARTIEL — apps/api/src/modules/coordination/colis.ts:expedierColis (COO-P13 (2026-11-05) : « Expédier » (colis 1 → 7) : transporteur et tarif par défaut du couple destinataire × atelier, code externe (« ETIQUETTES » remis à vide), commentaire, format, date ; UM « A expédier » quand TOUS leurs colis sont clos (défaut de `p_u_expedie_Colis` corrigé, Q-197 (7)) ; colis vide : 422 ; reste : fichier BL Calberson (transporteur 2) non repris (transporteur unique Geodis en cible, ECR-ADM-06 : étape 8, Q-284))
- Tests : apps/api/test/coordination/colis.int.test.ts ; e2e/roulage-expedition.spec.ts

### RG-COO-269 — Fin de journée : colis « A expédier » → « Terminé » (batch ou unitaire)
- Origine : MODIFIÉE
- Énoncé : `p_batch_fin_journee_colis` passe à 8 les UM des colis à 7 (quel que soit leur statut courant), les `tf_face_train` des colis à 7, puis les colis à 7, sans condition de date ni d'atelier (pas de transaction : un échec intermédiaire laisse UM / trains à 8 et colis à 7). Une action unitaire `SetFinDeJournee` met colis + UM à 8 (sans toucher aux trains), message « Le colis expédié ». MODIFIÉE : en cible « Fin de journée Geodis » passe les colis clos du périmètre à EXPEDIE (récépissé), les unités à EXPEDIE et génère les sorties de stock automatiques ; « Livré » est posé à la réception de la preuve de livraison (H9) ; libellé « Terminé » (8) remplacé par « Expédié » puis « Livré ».
- Déclencheur : batch de fin de journée (planification inconnue) / bouton ; cible : manuel (« qui déclenche ? » ouverte).
- Conditions : colis au statut 7 (A expédier) ; en cible transaction unique.
- Effet / message d'erreur : colis `7 → 8` ; UM `* → 8` ; faces `→ 8` ; sorties de stock : RG-X-087.
- Sources : legacy `p_batch_fin_journee_colis.sql:23-67`, `PreparationExpeditionService.cs:267-276`, `ListeColisBll.cs:199-223` (anciens ID provisoires RG-RPR-020, RG-INT-030) ; écran `ECR-EXP-02` ; spec `specs-existant-process.md §F` (EX-EXI-072)
- Questions liées : Q-272, Q-281
- Implémentation : PARTIEL — apps/api/src/modules/coordination/colis.ts:finDeJournee ; apps/web/src/routes/expedition/colis.tsx (COO-P13 (2026-11-05) : fin de journée MANUELLE (POST /api/coordination/colis/fin-de-journee, droit `colis.gerer`) en une seule transaction : colis « A expédier » → « Terminé » (« Expédié »), UM → « Terminé » quand tous leurs colis le sont, faces 7 → 8, historique, sorties de stock (RG-X-087), idempotent ; reste : le batch planifié est hors dépôt (Q-005 BLOQUÉE), « Livré » (preuve de livraison Geodis) non modélisé (Q-284))
- Tests : apps/api/test/coordination/colis.int.test.ts ; e2e/roulage-expedition.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — remarque corrigée : Q-005 est OUVERTE (non « BLOQUÉE ») pour le batch planifié ; le volet AMT n'appartient pas à cette règle (RG-COO-272 à 276 : AMT non repris, Q-274) ; la tâche planifiée FIN_JOURNEE_COLIS (D-20) est désactivée par défaut (aucun horaire sourcé, Q-005)

### RG-COO-270 — Train ajouté à un colis : face à « A expédier » immédiatement
- Origine : CONSERVÉE
- Énoncé : l'ajout d'un train (face) à un colis fixe immédiatement `tf_face_train.rpc_statut = 7` et `colis_id` ; un train déjà rattaché à un colis est refusé (« Il existe déjà un train dans ce colis ») ; le destinataire doit correspondre (« Le destinataire du train ne correspond pas à celui du colis », atelier aussi côté `PreparationColisTrainBll`). Retirer le train : `UpdateFaceTrains` (valeurs non lues). Aucun contrôle du statut d'origine : une face 5, 9 ou 10 passe à 7.
- Déclencheur : Préparation de train › Préparer (module EXP).
- Conditions : destinataire (et atelier) identiques ; en cible la face doit être PRODUIT (HYPOTHÈSE).
- Effet / message d'erreur : face `5|9|10 → 7` ; 422 avec les messages ci-dessus.
- Sources : legacy `PreparationColisageService.cs:154-209`, `PreparationColisTrainBll.cs:160` (ancien ID provisoire RG-RPR-021) ; spec `specs-ateliers-besoins.md PARTIE 7` (EX-EXP-501, EX-EXP-503)
- Questions liées : Q-272, Q-273
- Implémentation : FAIT — apps/api/src/modules/coordination/colis.ts:ajouterTrain (COO-P13 (2026-11-05) : un train (toutes ses faces non annulées) s'ajoute à un colis d'atelier déroulant : destinataire et atelier identiques, train déjà rattaché à un colis refusé (« Il existe déjà un train dans ce colis »), faces 5 / 9 / 10 → 7 immédiatement, 409 pour tout autre statut (table de transitions) ; HYPOTHÈSE Q-197 (3) : la condition cible « face PRODUIT » n'est pas appliquée (aucun statut de face PRODUIT))
- Tests : apps/api/test/coordination/colis.int.test.ts ; e2e/roulage-expedition.spec.ts

### RG-COO-271 — Mail « Un colis d'affiches vient de vous être expédié » (batch)
- Origine : CONSERVÉE
- Énoncé : le batch sélectionne les colis `rpc_statut = 8`, `Mailcolis_envoye = 0` et `colis_dat_expe > Parametre_Package.DateMaj` (`SendMailColis`) ; mail interne (un par manager CCF) ou externe (un par couple tiers / manager, CC manager), sujet fixe, corps HTML (N° colis, quantités trains / rouleaux, affiches), pièce jointe `DetailsColis_<jj_MM_aaaa>.xls` à deux feuilles (« Fixe » 7 colonnes, « Scrolling » 23 colonnes). Seuls les colis dont le mail est parti sont marqués envoyés ; `DateMaj = now` est cependant posée même si certains envois ont échoué (un colis en échec n'est plus resélectionné). Cible : les alertes remplacent les mails ; ce mail « colis expédié » n'est pas cité dans les decks.
- Déclencheur : batch `BatchEnvoieMailColis` (planification inconnue).
- Conditions : applicabilité à confirmer (EX-TRA-030) ; correction de la perte de retentative si conservé.
- Effet / message d'erreur : `Mailcolis_envoye` null/0 → 1.
- Sources : legacy `P_GetGlobalColisForSend.sql:3-56`, `BatchEnvoieMailColisBll.cs:33-267`, `P_MajParametre_Package.sql:1-7` (anciens ID provisoires RG-INT-033, RG-INT-034, RG-INT-035) ; spec `specs-transverse.md §E` (EX-TRA-030) ; écran `ECR-ADM-04` (« Mails existants dans le code »)
- Questions liées : Q-285
- Implémentation : PARTIEL — apps/api/src/modules/coordination/colis.ts:finDeJournee (COO-P13 (2026-11-05) : le mail « colis expédié » n'est PAS envoyé (Q-375, Q-285) : la fin de journée le trace au journal (MAIL_COLIS, destinataire) et `mailEnvoye` reste faux : la retentative n'est jamais perdue (défaut legacy corrigé) ; reste : l'envoi réel, l'ouverture du batch et la pièce jointe Excel)
- Tests : apps/api/test/coordination/colis.int.test.ts

### RG-COO-272 — Intégration AMT : une répartition déjà active n'est pas réintégrée
- Origine : CONSERVÉE
- Énoncé : si une ligne de log AMT (`tw_amt_log_repart`) porte un `rpfo_ident` déjà présent dans `tf_repart_calcul` avec un statut ≠ 4, la ligne de log est supprimée (ignorée) et « Doublon envoie : <rpfo> » est écrit dans `tt_log`. Le statut 4 (Annulé) est le seul qui libère le `rpfo_ident` (une répartition annulée peut être réintégrée en nouvelle ligne).
- Déclencheur : batch d'intégration (phase 2), `p_integ_ptf_reparts`.
- Conditions : `rc.rpc_rpfo_ident = r.rpfo_ident AND rc.rpc_statut <> 4` ; le test `exists` non corrélé fait supprimer tous les doublons dès qu'un seul existe (sans impact fonctionnel). Applicabilité du flux AMT : Q-274.
- Effet / message d'erreur : suppression des lignes de log ; aucune alerte utilisateur.
- Sources : legacy `p_integ_ptf_reparts.sql:72-90` (ancien ID provisoire RG-RPR-001)
- Questions liées : Q-274
- Implémentation : NON REPRIS (hypothèse Q-274) [audit final COO-P11/P12/P13 : règle d'origine CONSERVÉE abandonnée sur HYPOTHÈSE Q-274, pas FAIT] · — — (non repris) (COO-P13 (2026-11-05) : intégration AMT NON REPRISE en V2 (HYPOTHÈSE Q-274 : l'alimentation de `tf_repart_calcul` passe par Broadcast) : aucune route ni traitement ; test d'absence)
- Tests : apps/api/test/coordination/colis.int.test.ts (absence de route)

### RG-COO-273 — Intégration AMT : transcodage du type de préparation et regroupement par afficheur
- Origine : CONSERVÉE
- Énoncé : `tyaf_code` AMT est remplacé par le `tpr_id` logistique via `tr_typ_aff_amt` ; les lignes de log en mode `talr_trait = 'B'` sont regroupées (SUM de `rpty_qte_affich`) par répartition / destination / réaction / type / date / semaine / société / secteur / affiche / annonceur / contrat / afficheur ; seul ce regroupement (`talr_trait = '1'`) alimente `tf_repart_calcul`. `rpc_qte` = quantité cumulée ; `rpc_type = 0` ; `rpc_user = 'user_ptf'` ; `sem_num` = semaine ISO de `rpli_datdep` et `sem_annee` = année de base AMT (`rpli_anbas`, pas l'année ISO de la date de départ) ; `rpc_theme` tronqué à 50 caractères.
- Déclencheur : batch `p_integ_ptf_reparts`.
- Conditions : jointure `tr_atelier.ate_code_amt = sect_code` (une ligne sans atelier correspondant n'est pas traitée) ; incohérence potentielle `sem_num` ISO / `sem_annee` « anbas » en fin d'année (INCERTAIN ; spec cible : semaines ISO partout, EX-COO-038).
- Effet / message d'erreur : création en statut 0 (ou 3, RG-COO-274).
- Sources : legacy `p_integ_ptf_reparts.sql:167-236,240-253,351-401` (ancien ID provisoire RG-RPR-002) ; spec `specs-coordination.md §E` (EX-COO-038)
- Questions liées : Q-274
- Implémentation : NON REPRIS (hypothèse Q-274) [audit final COO-P11/P12/P13 : règle d'origine CONSERVÉE abandonnée sur HYPOTHÈSE Q-274, pas FAIT] · — — (non repris) (COO-P13 (2026-11-05) : intégration AMT NON REPRISE (HYPOTHÈSE Q-274) : aucun transcodage ni regroupement ; test d'absence)
- Tests : apps/api/test/coordination/colis.int.test.ts (absence de route)

### RG-COO-274 — Intégration AMT : contrôles d'anomalie 903 / 905 / 906 / 907 et lignes en erreur « E »
- Origine : CONSERVÉE
- Énoncé : chaque ligne est contrôlée : destinataire inconnu (anomalie 903), support inconnu (905), type de préparation inconnu (906), atelier inconnu (907). 905 / 906 / 907 forcent la valeur à 0 et le statut à 3 (Erreur) ; 903 crée une anomalie mais ne change pas le statut. Les anomalies sont insérées dans `tf_anomalies` (`ano_user = 'user_ptf'`, sans doublon par `rpc_id` / `tan_id`). Si l'atelier est inconnu (907), la répartition n'est PAS insérée mais les anomalies sont rattachées à `@rpc_id` (valeur du tour précédent / NULL : comportement non maîtrisé). Sans destinataire, `dest_id` est NULL et la ligne est insérée au statut 0. Si l'insertion échoue (`@error <> 0` ou `@rpc_id = 0`), la ligne de log passe à `talr_trait = 'E'` ; sinon les lignes `'B'` passent à `'T'`.
- Déclencheur : batch `p_integ_ptf_reparts`.
- Conditions : voir Énoncé.
- Effet / message d'erreur : statuts 0 → 3 (905, 906, 907) ; rattachement incorrect des anomalies 907 à ne pas reproduire.
- Sources : legacy `p_integ_ptf_reparts.sql:269-347,403-473,488-499` (anciens ID provisoires RG-RPR-003, RG-RPR-004)
- Questions liées : Q-274
- Implémentation : NON REPRIS (hypothèse Q-274) [audit final COO-P11/P12/P13 : règle d'origine CONSERVÉE abandonnée sur HYPOTHÈSE Q-274, pas FAIT] · — — (non repris) (COO-P13 (2026-11-05) : intégration AMT NON REPRISE (HYPOTHÈSE Q-274) : aucun contrôle d'anomalie 903 / 905 / 906 / 907 ; test d'absence)
- Tests : apps/api/test/coordination/colis.int.test.ts (absence de route)

### RG-COO-275 — Purge des tables de travail AMT et correction `UM_qte = 0`
- Origine : CONSERVÉE
- Énoncé : `p_integ_ptf_purge` supprime TOUTES les lignes de `tw_amt_log_repart`, `tw_amt_log_destination`, `tra_amt_log_instruction`, `tra_amt_log_instruc_det`, `tra_amt_log_statut_repart`, `tra_amt_log_train` (plus seulement les lignes `'T'`, correctif IT 34650 du 29/03/2016) puis force `tf_UM.UM_qte = 1` là où `UM_qte = 0`, y compris pour des UM déjà expédiées (modification silencieuse). `p_valid_amt_reparts` archive dans `th_amt_log_repart` (côté AMT par serveur lié, côté PTF avec transaction) les lignes `talr_trait = 1` puis les supprime ; usage actuel inconnu.
- Déclencheur : batch `p_integ_ptf_purge` / `p_valid_amt_reparts`.
- Conditions : la correction `UM_qte = 0 → 1` est un effet de bord indésirable à ne pas reproduire sans décision (Q-271) ; applicabilité Q-274.
- Effet / message d'erreur : tables vidées ; aucune alerte.
- Sources : legacy `p_integ_ptf_purge.sql:14-31`, `p_valid_amt_reparts.sql:28-95,102-223` (anciens ID provisoires RG-RPR-005, RG-RPR-007)
- Questions liées : Q-271, Q-274
- Implémentation : NON REPRIS (hypothèse Q-274) [audit final COO-P11/P12/P13 : règle d'origine CONSERVÉE abandonnée sur HYPOTHÈSE Q-274, pas FAIT] · — — (non repris) (COO-P13 (2026-11-05) : purge des tables AMT NON REPRISE ; la correction silencieuse `UM_qte = 0 → 1` n'est PAS reproduite (effet de bord indésirable, Q-271) : aucun traitement ne modifie la quantité d'une UM ; test d'absence)
- Tests : apps/api/test/coordination/colis.int.test.ts

### RG-COO-276 — Intégration des statuts de répartition AMT : désactivée
- Origine : CONSERVÉE
- Énoncé : `p_integ_ptf_statut_repart` retourne immédiatement (`return 0`, « SJA => on ne fait plus ») ; le mapping `instruction_train.tsr_repart_code` 1 / 2 / 3 (En cours / Plateforme / Commerce) est du code mort. `tr_statut_repart` n'est plus alimentée par ce flux ; la propriété `StatutRepart` est encore lue par `PreparationRepository.cs:1015` et `PreparationDeroulantsRepository.cs:658`. Aucune spec de la cible ne reprend ce mécanisme.
- Déclencheur : aucun (désactivé).
- Conditions : ne pas reprendre sans décision (Q-274).
- Effet / message d'erreur : aucun.
- Sources : legacy `p_integ_ptf_statut_repart.sql:30-31` (code mort 47-141) (ancien ID provisoire RG-RPR-006) ; bdd.md §4.2
- Questions liées : Q-274
- Implémentation : NON REPRIS (hypothèse Q-274) [audit final COO-P11/P12/P13 : règle d'origine CONSERVÉE abandonnée sur HYPOTHÈSE Q-274, pas FAIT] · — — (non repris) (COO-P13 (2026-11-05) : intégration des statuts de répartition AMT désactivée aussi en V2 (code mort legacy, HYPOTHÈSE Q-274) : aucune route)
- Tests : apps/api/test/coordination/colis.int.test.ts (absence de route)

### RG-COO-277 — Déblocage de répartition : une UM au statut ≥ 6 empêche le déblocage
- Origine : CONSERVÉE
- Énoncé : la liste des préparations « empêchant le déblocage » est celle des `tf_UM` liées (via `tf_repart_calcul.UM_id`) au `rpfo_ident` avec `rpc_statut >= 6` (Préparé, A expédier, Terminé et au-delà). Les répartitions sans UM (statuts 0, 1, 3 sans `UM_id`) ne sont jamais bloquantes ; le statut du `tf_repart_calcul` lui-même n'est pas testé. La liste (plateforme, atelier, code barre UM, contrat, thème, statut) sert de message de refus. Cette règle complète le contrôle de déblocage de préparation de coo1 (RG-COO-083 legacy).
- Déclencheur : contrôle avant déblocage (`ControleRepartitionsDeblocables`).
- Conditions : `tf_UM.rpc_statut >= 6` et `tf_repart_calcul.rpc_rpfo_ident = @rpfo_ident` ; le contrôle serveur est en plus à exiger côté service (le legacy ne contrôle que les UM pour un groupe UM et rien pour un groupe TRAIN).
- Effet / message d'erreur : refus 422 « Le groupe de preparation n'est pas déblocable ! » (message du legacy) avec la liste des UM bloquantes.
- Sources : legacy `p_s_controle_rendumain.sql:15-21`, `RepartitionRepository.cs:138-153`, `RepartitionService.cs:55-60` (ancien ID provisoire RG-RPR-008)
- Questions liées : Q-275
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:construireGroupes, debloquerGroupe — FAIT : COO-P08 (2026-11-05) : UM liées aux répartitions du groupe au statut ≥ 6 bloquent (liste plateforme, atelier, code barre, contrat, thème, statut dans le refus) ; répartitions sans UM jamais bloquantes ; contrôle serveur exigé ; UM de tout le groupe (audit B1)
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-278 — Déblocage de répartition : annulation des répartitions et des UM, colis non touchés
- Origine : CONSERVÉE
- Énoncé : `p_u_statut_repart_deblocage` passe à 4 (Annulé) les `tf_repart_calcul` du couple (`rpc_repartition`, `rpc_rpfo_ident`) dont le statut ≠ 4, puis les `tf_UM` associées (statut ≠ 4), avec date et utilisateur fournis par l'appelant (uniformité Broadcast / Circé, US 401). Les lignes `tf_UM_colis` et `tf_colis` sont conservées : un colis contenant des UM annulées garde son statut (l'annulation des colis est commentée). `p_i_th_repart_annule` historise dans `th_repart_annule`. Transaction propre à la procédure ; l'utilisateur passé est « » côté C# (écrit vide). Cible : l'utilisateur est tracé ; le devenir des colis contenant des UM annulées est à décider.
- Déclencheur : action « Débloquer ».
- Conditions : après le contrôle de RG-COO-277.
- Effet / message d'erreur : répartitions `* → 4` ; UM `* → 4` (y compris 0, 1, 3, 5) ; colis inchangés ; historique.
- Sources : legacy `p_u_statut_repart_deblocage.sql:34-73`, `RepartitionRepository.cs:121-136` (ancien ID provisoire RG-RPR-009) ; legacy `AdminPreparationDeblocageBll.cs:252-333` (RG-COO-084, coo1)
- Questions liées : Q-275
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe — FAIT : COO-P08 (2026-11-05) : répartitions du groupe (statut ≠ 4) → Annulé puis leurs UM (≠ 4), y compris 0, 1, 3, 5 ; utilisateur tracé ; colis non touchés (devenir à décider : Q-275) ; annulation du groupe ENTIER (toutes ses tranches, historique de chaque dossier, audit B1)
- Tests : apps/api/test/coordination/deblocage.int.test.ts ; apps/api/src/modules/coordination/deblocage.test.ts

### RG-COO-279 — Ancien déblocage AMT puis Circé : non atomique, retour 0 indifférencié
- Origine : CONSERVÉE
- Énoncé : `DebloquerRepartitions` appelle d'abord Sybase (`p_urpfo01`, `rpfo_valid = 0`) puis Circé ; le résultat n'est retenu que si les deux compteurs sont égaux, sinon retour 0. Si Sybase échoue (exception), le compteur AMT vaut 0 mais le déblocage Circé a lieu quand même ; le retour 0 est alors indifférencié d'un refus ; l'exception n'est journalisée que dans Elmah. Les états AMT et Circé peuvent diverger. L'écran « Répartitions déblocables » (droits `debloque_repart` / `view_repart`) débloque aussi les lignes non cochées et envoie un mail aux logisticiens ; le menu actif ne pointe plus vers cet écran (probablement mort).
- Déclencheur : ancien écran Répartitions (`view_repart`).
- Conditions : applicabilité à confirmer (Q-274, Q-275) ; ne pas reproduire le défaut des lignes non cochées.
- Effet / message d'erreur : annulation de répartitions côté AMT et Circé.
- Sources : legacy `RepartitionService.cs:35-53`, `RepartitionRepository.cs:87-136`, `RepartitionController.cs:218-351` (anciens ID provisoires RG-RPR-010, RG-COO-085)
- Questions liées : Q-274, Q-275
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe — FAIT (non reproduit) : COO-P08 (2026-11-05) : déblocage atomique d’un seul groupe choisi (aucune ligne non cochée, aucun appel AMT/Sybase : Q-274)
- Tests : apps/api/test/coordination/deblocage.int.test.ts

### RG-COO-280 — Le statut de l'UM prime sur celui de la répartition dans le suivi
- Origine : CONSERVÉE
- Énoncé : après la création de l'UM, l'évolution (7, 8) ne touche que `tf_UM` / `tf_colis`, pas `tf_repart_calcul` ; le suivi de production lit le statut de `tf_UM` s'il existe (`rc.UM_id` renseigné), sinon celui de `tf_repart_calcul`. Conséquence : `tf_repart_calcul.rpc_statut` reste à 1 ou 6 pour des UM terminées ; toute règle lisant ce statut (filtre `rpc_statut <> 4` des attendues, RG-COO-042 legacy) ne voit jamais 7 / 8. La propagation éventuelle par `MiseAJourStatutUm` n'a pas été lue.
- Déclencheur : lecture du suivi de production / de l'état des lignes.
- Conditions : le statut « effectif » = statut de l'UM si UM_id non nul. La cible doit choisir entre propagation des statuts et calcul du statut effectif (Q-273).
- Effet / message d'erreur : lecture seule.
- Sources : legacy `p_s_adminSuiviRead.sql:70-79`, `PreparationRepository.cs:393-429,435-470` (ancien ID provisoire RG-RPR-015)
- Questions liées : Q-273
- Implémentation : FAIT — apps/api/src/modules/coordination/reservations.ts:etatReservations, suiviProduction (statut de la répartition = celui de son UM, RG-COO-106) (COO-P13 (2026-11-05) : le statut de l'UM prime dans le suivi de production sans propagation d'écriture (statut effectif calculé, HYPOTHÈSE Q-273) : la fin de journée passe l'UM à « Terminé » alors que la répartition reste « En cours », et le suivi lit « Terminé »)
- Tests : apps/api/test/coordination/colis.int.test.ts

### RG-COO-290 — Liste des UM 2 m² / pliage : périmètre, exclusions, adresse principale, affiche reçue indicative
- Origine : MODIFIÉE
- Énoncé : `p_s_listeUM_2m2` liste les UM hors statuts 3 et 4, pour les ateliers 1 et 4 uniquement (en dur ; variante pliage `p_s_listeUM_pliage`), dont l'utilisateur a le droit (`tr_utilisateur_data.loginWindows`), semaine / année facultatives, avec l'adresse principale du destinataire (jointure interne : une UM sans adresse principale disparaît de la liste) ; `SELECT DISTINCT`. Elle associe `affiche_id` et `validationAdmin` aux UM dont l'affiche livrée (même `cont_num`, plateforme, annonceur, support, thème, hors repiquage) est validée par l'admin pour la semaine / année passées ; l'information est affichée « oui / non » sans bloquer l'action. Aucun changement de statut ; colonne `UM_date_aff` ajoutée. MODIFIÉE : en cible la création d'UM, la libération et le passage « En cours → Préparé » ne dépendent d'aucune réception ni validation admin (EX-COO-001 ; RG-X-084) ; l'affiche est affichée avec ✓ (validée) ou • (proposée à confirmer) ; les ateliers ne sont plus codés en dur.
- Déclencheur : écran Préparation 2 m² fixe / pliage (liste des UM).
- Conditions : `tf_UM.rpc_statut NOT IN (3, 4)` ; `tf_UM.ate_id IN (1, 4)` en legacy ; périmètre d'ateliers de l'utilisateur.
- Effet / message d'erreur : lecture seule. L'en-tête legacy daté « 04-06-2026 » est probablement une erreur.
- Sources : legacy `p_s_listeUM_2m2.sql:36-62,113-142`, `p_s_listeUM_pliage.sql:43-50`, `PreparationController.cs:764-765` (ancien ID provisoire RG-RPR-024) ; spec `specs-coordination.md §A` (EX-COO-001, EX-COO-014) ; écran `ECR-COO-09`
- Questions liées : Q-273
- Implémentation : FAIT — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:listerUnitaire ; apps/api/src/modules/coordination/unitaire-affiches.ts (COO-P12 (2026-11-05) : unités des ateliers fixes du périmètre (plus de codage en dur des ateliers), hors statuts 3 et 4, filtres dossier / départ / annonceur / statut / destinataire / afficheur / repère « main rendue » côté API, affiche reçue indicative ✓ (validée) / • (proposée) sans bloquer les actions (module de lecture séparé : aucune écriture d'UM ne lit la validation admin, RG-COO-027), thèmes exclus en annotation, libération annoncée non disponible (Q-265) ; l'adresse principale du destinataire n'est plus une condition d'affichage)
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-291 — Dispatch du roulage : périmètre des trains et filtres
- Origine : MODIFIÉE
- Énoncé : l'écran Dispatch d'un atelier déroulant (un par site) liste les trains de l'atelier au statut PRET ou EN_PROD : Train, Destinataire, Départ, Positions, Trains, Faces, Statut, Rouleur. Filtres : N° de dossier, Départ, Statut (Prêt / En production), + Destinataire. Trois indicateurs : Trains à rouler, Faces, Non affectés. Messages : « Aucun atelier déroulant sur ce site. » ; tableau vide standard. Legacy : le dispatch se fait en dehors de Circé (transmission au dispatcheur de l'export Excel imprimé) avec un programme Python existant, à intégrer.
- Déclencheur : menu Déroulant › Dispatch.
- Conditions : profil `cheq` (rôle de l'écran) ; périmètre d'ateliers de l'utilisateur.
- Effet / message d'erreur : lecture + affectation (RG-COO-294).
- Sources : écran `ECR-COO-10` ; spec `specs-existant-process.md §C` (EX-EXI-035 : « transmettre au dispatcheur »)
- Questions liées : Q-276
- Implémentation : FAIT — apps/api/src/modules/coordination/roulage.ts:dispatchRoulage ; apps/web/src/routes/coordination/dispatch.tsx (COO-P11 (2026-11-05) : trains PRET / EN_PROD d'un atelier déroulant du périmètre, trains identiques regroupés, filtres N° de dossier / Départ / Statut / Destinataire côté API, trois indicateurs, « Aucun atelier déroulant sur ce site. » ; profil chef d'équipe seul (Q-286))
- Tests : apps/api/test/coordination/roulage-dispatch.int.test.ts, e2e/roulage.spec.ts

### RG-COO-292 — Dispatch : nombre de faces et charge par rouleur
- Origine : NOUVELLE
- Énoncé : faces d'un train = `nb × nombre de positions non fractionnées` ; charge d'un rouleur = nombre de trains et de faces affectés ; la carte « Charge par rouleur » affiche Rouleur, Poste, Trains, Faces, Charge (jauge) et les destinataires, avec le bouton « Liste de picking » (RG-COO-296). La moyenne de charge est celle des rouleurs du site.
- Déclencheur : affichage / affectation.
- Conditions : positions fractionnées exclues (RG-COO-209).
- Effet / message d'erreur : indicateurs recalculés à chaque affectation.
- Sources : écran `ECR-COO-10`
- Questions liées : Q-276
- Implémentation : FAIT — apps/api/src/modules/coordination/roulage.ts:dispatchRoulage (faces, charge) ; apps/web/src/routes/coordination/dispatch.tsx (COO-P11 (2026-11-05) : faces = nb × positions non fractionnées ; charge par rouleur (trains, faces, destinataires, % de la moyenne des rouleurs de l'atelier) recalculée à chaque lecture ; les rouleurs sans atelier ne sont pas proposés (HYPOTHÈSE Q-195))
- Tests : apps/api/test/coordination/roulage-dispatch.int.test.ts, e2e/roulage.spec.ts

### RG-COO-293 — Dispatch : « Proposer une répartition » (règle simulée en attente du moteur cible)
- Origine : NOUVELLE
- Énoncé : « Proposer une répartition » (bouton primaire) affecte les trains aux rouleurs : départ le plus proche d'abord, puis rouleur le moins chargé (en faces). Message : « Répartition proposée : n trains sur m rouleurs. ». L'algorithme est simulé en maquette ; le moteur cible est le programme Python existant « à transmettre » (callout « Moteur de répartition à brancher »).
- Déclencheur : clic sur « Proposer une répartition ».
- Conditions : trains PRET ou EN_PROD non affectés ; la règle simulée n'est qu'un comportement provisoire jusqu'à réception de l'algorithme (Q-276).
- Effet / message d'erreur : rouleurs affectés (RG-COO-294) ; aucun effet sur les trains EN_PROD déjà affectés (HYPOTHÈSE).
- Sources : écran `ECR-COO-10` (« Règle simulée »)
- Questions liées : Q-276
- Implémentation : PARTIEL — apps/api/src/modules/coordination/roulage.ts:proposerRepartition ; apps/web/src/routes/coordination/dispatch.tsx (COO-P11 (2026-11-05) : règle SIMULÉE de la maquette (départ le plus proche d'abord, puis rouleur le moins chargé en faces ; trains déjà affectés intacts ; 422 sans train à répartir ou sans rouleur : HYPOTHÈSE Q-195) ; reste : moteur de répartition cible (programme Python « à transmettre », Q-276 OUVERTE))
- Tests : apps/api/test/coordination/roulage-dispatch.int.test.ts, e2e/roulage.spec.ts

### RG-COO-294 — Dispatch : affectation manuelle d'un rouleur et « Tout désaffecter »
- Origine : NOUVELLE
- Énoncé : le champ Rouleur de chaque ligne (liste « Non affecté » + opérateurs du site) enregistre l'affectation immédiatement et écrit au journal ; « Tout désaffecter » remet toutes les lignes à « Non affecté ». Teinte : non affecté < 36 h → critique ; non affecté → avertissement.
- Déclencheur : changement du select / « Tout désaffecter ».
- Conditions : opérateurs du site de l'atelier ; train non LIVRE.
- Effet / message d'erreur : `rouleur_id` mis à jour + historique.
- Sources : écran `ECR-COO-10`
- Questions liées : Q-276
- Implémentation : FAIT — apps/api/src/modules/coordination/roulage.ts:affecterDispatch, toutDesaffecter ; apps/web/src/routes/coordination/dispatch.tsx (COO-P11 (2026-11-05) : affectation immédiate sous verrou de version avec journal, « Non affecté », « Tout désaffecter » ; un train en production garde un rouleur (RG-COO-217 : 409 COO_ROULEUR_OBLIGATOIRE, HYPOTHÈSE Q-195) ; teinte critique (< seuil) / avertissement côté écran)
- Tests : apps/api/test/coordination/roulage-dispatch.int.test.ts, e2e/roulage.spec.ts

### RG-COO-295 — Dispatch : alertes de départ proche et de surcharge
- Origine : NOUVELLE
- Énoncé : callout « critique » si des trains non affectés partent dans moins de 36 h ; callout d'avertissement par rouleur dont la charge dépasse 115 % de la moyenne ; les seuils 36 h et +15 % sont codés en dur dans la maquette (paramètres à prévoir).
- Déclencheur : affichage / affectation.
- Conditions : seuils 36 h, 115 % (valeurs de la maquette, non spécifiées) ; l'alerte « Départ camion à risque » (unités en attente, moins de 72 h, critique < 36 h) du catalogue d'alertes est portée par coo1.
- Effet / message d'erreur : callouts.
- Sources : écran `ECR-COO-10`, `ECR-TRA-01` ; spec `specs-transverse.md §E` (EX-TRA-031 : « surcharge / départ proche (dispatch) »)
- Questions liées : Q-276
- Implémentation : FAIT — apps/api/src/modules/coordination/roulage.ts:dispatchRoulage (alertes) ; apps/web/src/routes/coordination/dispatch.tsx (COO-P11 (2026-11-05) : callout critique des trains non affectés partant dans moins de 36 h, callout par rouleur au-delà de 115 % de la moyenne ; seuils en paramètres (`dispatch.seuilDepartHeures`, `dispatch.seuilChargePct`, Q-276) ; ces alertes ne sont pas reprises dans Pilotage › Alertes (Q-220))
- Tests : apps/api/test/coordination/roulage-dispatch.int.test.ts, e2e/roulage.spec.ts

### RG-COO-296 — Liste de picking d'un rouleur (« Liste des affaires à collecter »)
- Origine : MODIFIÉE
- Énoncé : pour un rouleur, la modale liste Emplacement, N° affiche, Annonceur, Thème, Quantité, triée par emplacement ; boutons Fermer / Imprimer. Legacy : édition de la liste de picking par semaine (`EditionPicking.rdlc`) et fiches d'activité de bacs ; l'automatisation de la sortie des feuilles d'activité de bacs et des feuilles de stock est demandée. Cible : PDF généré côté navigateur.
- Déclencheur : « Liste de picking » (carte Charge par rouleur).
- Conditions : emplacement saisi à la réception (RG-X-088).
- Effet / message d'erreur : aperçu puis impression ; lecture seule.
- Sources : écran `ECR-COO-10` ; legacy `Rapport.cs` (`EditionPicking`, `EditionFicheActivite`, ancien ID provisoire RG-ADM-060) ; spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-511)
- Questions liées : Q-287
- Implémentation : FAIT — apps/api/src/modules/coordination/roulage.ts:listePicking ; apps/web/src/routes/coordination/dispatch.tsx (COO-P11 (2026-11-05) : une ligne par affiche rattachée aux visuels des trains du rouleur (emplacement, n° affiche, annonceur, thème, quantité rattachée), triée par emplacement ; lecture seule ; PDF généré par le navigateur (window.print, Q-287) ; quantité = quantité rattachée (HYPOTHÈSE Q-195))
- Tests : apps/api/test/coordination/roulage-dispatch.int.test.ts, e2e/roulage.spec.ts

### RG-COO-297 — Rouleurs : référentiel d'opérateurs rattachés à un site et un poste
- Origine : MODIFIÉE
- Énoncé : les rouleurs sont des opérateurs (id, site, libellé « Rouleur N1 », poste « Table 1 ») gérés dans Administration › Référentiels, distincts des utilisateurs ; le legacy a une « Liste des rouleurs » (droit `referentiel`) et `rouleur_id` sur `tf_face_train`. Équipes et machines sont gérées par plateforme (RG-ADM-046).
- Déclencheur : alimentation des listes de choix de rouleur.
- Conditions : opérateurs du site ; désactivation plutôt que suppression d'un rouleur référencé (HYPOTHÈSE).
- Effet / message d'erreur : listes de choix ; refus de suppression si référencé (409).
- Sources : écran `ECR-ADM-07`, `ECR-COO-07` ; legacy-admin.md matrice droit × page (« Liste des rouleurs ») et RG-ADM-046
- Questions liées : Q-276
- Implémentation : FAIT — apps/api/src/modules/coordination/rouleurs.ts ; apps/web/src/routes/coordination/rouleurs.tsx (COO-P11 (2026-11-05) : référentiel des rouleurs (nom, poste, atelier donc site) géré par l'administrateur : création, modification, désactivation / réactivation sous verrou de version, suppression refusée (409) d'un rouleur référencé par une face ou une bague ; nom unique par atelier (HYPOTHÈSE Q-195) ; écran sans E2E (API testée en intégration) ; équipes et machines par plateforme (RG-ADM-046) non reprises)
- Tests : apps/api/test/coordination/roulage-8m2-rouleurs.int.test.ts

### RG-COO-298 — Bagues et étiquettes : périmètre de la liste et filtre « À imprimer »
- Origine : NOUVELLE
- Énoncé : la liste des bagues contient les unités hors machine Vendôme et hors EN_ATTENTE : Unité, Atelier (+ site si Tous), Poste (machine ou « Sans machine »), Destinataire, Textes imprimés par position (annonceur · thème + tag « modifié »), Statut ; masquées : Type (Train / UM (rouleau) / Lot), Bague (« Imprimée (rouleur) », « réimprimée n fois »). Filtres : N° de dossier, Départ, Atelier, Poste, Bague (défaut « À imprimer » ; Imprimées ; Sans bague, déjà en production), + Destinataire. Les bagues Vendôme partent avec le fichier. Ligne en avertissement si textes modifiés.
- Déclencheur : menu Déroulant › Bagues ; boutons « Imprimer les bagues » de la Liste des trains / Préparation / unitaire.
- Conditions : profil `cheq`.
- Effet / message d'erreur : lecture + actions RG-COO-299 à 301.
- Sources : écran `ECR-COO-11`
- Questions liées : Q-277
- Implémentation : PARTIEL — apps/api/src/modules/coordination/bagues.ts:listerBagues ; apps/web/src/routes/coordination/bagues.tsx ; apps/web/src/components/coordination/bagues.tsx (COO-P11 (2026-11-05) : liste des unités du déroulant hors « En attente » (le train est l'unité, Q-250), filtre « Bague » (À imprimer par défaut, Imprimées, Sans bague déjà en production), dossier / départ / atelier / destinataire, colonnes masquées Type et Bague ; reste : poste (machine) et exclusion des bagues Vendôme (D-02), unités UM (rouleau) et lot (création des UM : Q-265 OUVERTE))
- Tests : apps/api/test/coordination/roulage-bagues.int.test.ts, e2e/roulage.spec.ts

### RG-COO-299 — Impression des bagues : rouleur obligatoire, passage automatique à « En production »
- Origine : MODIFIÉE
- Énoncé : l'action « Imprimer n bague(s) » demande le Rouleur (liste des opérateurs du site), montre l'aperçu des 6 premières bagues et « Imprimer » pose la bague, affecte le rouleur et fait passer les unités PRET à EN_PROD (« Le statut passe automatiquement à « En production » à l'impression »). Refus : « Aucune unité « Prêt à produire » dans la sélection. ». Legacy : l'étiquette bague (`EtiquetteBagueNewCode128.rdlc` si code 128, sinon `EtiquetteBagueNew.rdlc`) est écrite en PDF temporaire, la mise « Au roulage » (10) fixe le rouleur (RG-COO-217). Les unités passées à EN_PROD le sont aussi à l'envoi du fichier à la machine (GEN-03).
- Déclencheur : « Imprimer les bagues (n) ».
- Conditions : au moins une unité PRET dans la sélection ; PDF généré côté navigateur ; agent d'impression local : Q-002.
- Effet / message d'erreur : unités `PRET → EN_PROD` ; bague posée ; historique ; 422 avec le message ci-dessus.
- Sources : écran `ECR-COO-11a` ; legacy `Rapport.cs:463-479,486-508` (ancien ID provisoire RG-ADM-060, RG-ADM-061) ; spec `specs-existant-process.md §C` (EX-EXI-035)
- Questions liées : Q-002, Q-277
- Implémentation : PARTIEL — apps/api/src/modules/coordination/bagues.ts:imprimerBagues ; apps/web/src/components/coordination/bagues.tsx:ModaleImpressionBagues (COO-P11 (2026-11-05) : rouleur obligatoire (400 sinon), bague posée, faces « A imprimer » → « Au roulage » avec le rouleur (point de non-retour, RG-COO-217, historique de statut), unités non imprimables listées avec leur raison, 422 « Aucune unité « Prêt à produire » dans la sélection. » ; l'état « Prêt » est relu dans la même transaction (RG-X : visuel non reçu → refus) ; impression physique non pilotée (aperçu navigateur, Q-002, Q-287) ; reste : effet de l'envoi du fichier à la machine sur l'unité (Q-194), unités UM et lot (Q-265))
- Tests : apps/api/test/coordination/roulage-bagues.int.test.ts, e2e/roulage.spec.ts

### RG-COO-300 — Textes imprimés sur la bague : modification et réimpression automatique
- Origine : NOUVELLE
- Énoncé : « Modifier » une bague ouvre « Textes imprimés sur la bague n » : par position (A, B…), champs Annonceur et Thème ; « Enregistrer et réimprimer » historise et réimprime ; vaut en fixe comme en déroulant ; pour le bus l'action de ligne s'appelle « Textes de bague ». L'unité porte le tag « bague modifiée ».
- Déclencheur : action de ligne « Modifier » / « Textes de bague ».
- Conditions : textes non vides (HYPOTHÈSE, même contrôle que RG-COO-244) ; réimpression soumise à RG-COO-301.
- Effet / message d'erreur : textes enregistrés, historique, compteur de réimpressions.
- Sources : écran `ECR-COO-11b`, `ECR-COO-09`
- Questions liées : Q-277
- Implémentation : PARTIEL — apps/api/src/modules/coordination/bagues.ts:modifierTextesBague ; apps/web/src/components/coordination/bagues.tsx:ModaleTextesBague (COO-P11 (2026-11-05) : textes par position (annonceur, thème), tag « modifié », réimpression automatique (compteur), historique, 422 si vide ou sans changement (HYPOTHÈSE Q-195) ; réservé aux bagues déjà imprimées ; reste : fixe et bus (« Textes de bague », unités UM : Q-265))
- Tests : apps/api/test/coordination/roulage-bagues.int.test.ts, e2e/roulage.spec.ts

### RG-COO-301 — Réimprimer une bague : motif obligatoire, même numéro, statut inchangé
- Origine : MODIFIÉE
- Énoncé : « Réimprimer la bague n » (depuis l'aperçu d'une bague imprimée ou la fiche train) demande un motif : « Colis perdu, refait », « Bague abîmée ou illisible » ou « Autre » ; la bague garde le même numéro et les mêmes textes, le statut est inchangé, le compteur `reimpressions` augmente (tag « Bague réimprimée n fois »). La cible restreint les droits de réimpression (revenir de « Terminé » à « Imprimer ») aux directeurs de plateforme et chefs d'équipe ; l'état actuel (« possible pour Patrick mais pas pour les ateliers ? ») est ambigu.
- Déclencheur : « Réimprimer la bague… ».
- Conditions : bague déjà imprimée ; profil `cheq` ou directeur de plateforme (rôle non défini : Q-286).
- Effet / message d'erreur : compteur incrémenté ; historique avec motif ; 403 si profil non autorisé.
- Sources : écran `ECR-COO-11c`, `ECR-COO-05a` ; spec `specs-ateliers-besoins.md PARTIE 10` (EX-ADM-503)
- Questions liées : Q-277, Q-286
- Implémentation : FAIT — apps/api/src/modules/coordination/bagues.ts:reimprimerBague ; apps/web/src/components/coordination/bagues.tsx:ModaleReimpression ; apps/web/src/routes/coordination/trains.tsx (fiche train) (COO-P11 (2026-11-05) : motif obligatoire (liste fermée), même numéro et mêmes textes, statut inchangé, compteur de réimpressions, historique avec motif ; droit `bague.reimprimer` = chef d'équipe seul (directeur de plateforme non défini : Q-277, Q-286) ; depuis l'aperçu d'une bague imprimée et la fiche du train)
- Tests : apps/api/test/coordination/roulage-bagues.int.test.ts, e2e/roulage.spec.ts

### RG-COO-302 — Contenu de l'étiquette bague
- Origine : MODIFIÉE
- Énoncé : l'aperçu d'une bague contient : code-barres, n° d'unité, « Nb aff : n » (= quantité + entretien pour une UM / un lot), destinataire en grand, afficheur · atelier, départ · boucle · rouleur, lignes « dossier · annonceur — lettre » et thème (étoile si modifié). Legacy : états `EtiquetteBagueNew*.rdlc` (code-barres 128 ou standard). Aucune quantité par bague en fixe / lot (Q-COO-25 de la maquette).
- Déclencheur : aperçu / impression.
- Conditions : mise en page des états RDLC non lue (contenu exact à confirmer).
- Effet / message d'erreur : aperçu ; aucun refus.
- Sources : écran `ECR-COO-11` (« Aperçu bague ») ; legacy `Rapport.cs:463-479` (ancien ID provisoire RG-ADM-060)
- Questions liées : Q-277
- Implémentation : PARTIEL — apps/api/src/modules/coordination/bagues.ts:apercu ; apps/web/src/components/coordination/bagues.tsx:ApercuBagueCarte (COO-P11 (2026-11-05) : aperçu navigateur (code-barres Code 39 du numéro, n°, « Nb aff », destinataire, afficheur · atelier, départ · rouleur, lignes dossier · annonceur — lettre, thème, étoile si modifié) ; reste : « boucle » non modélisée, mise en page des états RDLC non lue (Q-277), code 128)
- Tests : apps/api/test/coordination/roulage-bagues.int.test.ts, e2e/roulage.spec.ts

### RG-COO-303 — Tableau de roulage alimenté par la bague
- Origine : NOUVELLE
- Énoncé : le « Tableau de Roulage » (saisie manuelle par jour et par opérateur du nombre de trains de 1, 2, 3 ou 4 pour ajuster les primes de production) doit être alimenté automatiquement par l'information de la bague. Le calcul des primes est hors périmètre. L'Excel « Fichier Vierge » (suivi par opérateur de ce qui a été fait dans la journée, passage d'information entre shifts ; inexistant à Nîmes) est à intégrer. Statut des lignes de synthèse : « A creuser » (contenu non fourni).
- Déclencheur : impression / affectation de bague.
- Conditions : périmètre non défini.
- Effet / message d'erreur : aucun tant que Q-278 n'est pas tranchée.
- Sources : spec `specs-ateliers-besoins.md PARTIE 5` (EX-SCR-501, EX-SCR-502, EX-SCR-515, EX-SCR-516)
- Questions liées : Q-278
- Implémentation : — BLOQUÉ (Q-278 : hors périmètre initial (contenus des Excel non fournis) ; COO-P11 (2026-11-05) : la bague porte déjà l'atelier, le rouleur, la date et l'auteur qui alimenteraient le tableau)
- Tests : apps/api/test/coordination/roulage-bagues.int.test.ts (absence)

### RG-COO-304 — Bus : quantités à encoller (calcul Broadcast, ajustements global et par centre)
- Origine : NOUVELLE
- Énoncé : la modale « Quantités à encoller » (Bus) affiche par centre bus : Quantité commandée, « Calcul Broadcast (+8 % +20 %) » = commande × 1,08 + commande × 0,20 (arrondis), Ajustement centre (%) éditable, À encoller ; un champ Ajustement global (%) s'applique à tous les centres ; « Enregistrer et éditer les états de collage » écrit au journal. Le besoin est d'ajuster à la hausse ou à la baisse la quantité à encoller, globalement et par centre, selon le parc en exploitation (bus retirés, cadres non reposés) ; aujourd'hui Broadcast applique +8 % de production figé et +20 % d'entretien par défaut, sans que la plateforme ait la main.
- Déclencheur : « Quantités à encoller » (Bus).
- Conditions : les règles d'arrondi, de combinaison des ajustements global et par centre et le vocabulaire (+8 % production / +20 % entretien) ne sont pas spécifiés ; ajustements en pourcentage (valeurs minimales appliquées par `Math.max` dans la maquette).
- Effet / message d'erreur : quantités à encoller enregistrées avec historique.
- Sources : spec `specs-ateliers-besoins.md PARTIE 11` (EX-BUS-503) ; écran `ECR-COO-09e`
- Questions liées : Q-279
- Implémentation : PARTIEL — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx:lireEncollage, enregistrerEncollage ; apps/web/src/routes/coordination/unitaire.tsx:ModaleEncoller (COO-P12 (2026-11-05) : par centre bus : quantité commandée, calcul Broadcast = commande × 1,28 arrondi, ajustement centre (%), ajustement global (%) additif (plancher −100 %), « À encoller », enregistrement sous verrou de version avec journal (HYPOTHÈSES Q-196 (5) : arrondi, combinaison, vocabulaire non spécifiés) ; reste : édition des états de collage (PDF navigateur) non générée, flux d'alimentation du Bus (Q-279))
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-305 — Bus : préparation par centre (onglet Bus, lots `BU-nnnn`)
- Origine : NOUVELLE
- Énoncé : Nanterre est une plateforme de Circé (module Réception) ; un dossier Bus transmis par Broadcast arrive sans ressaisie (n° de dossier, client, format, semaine de pose, quantités par centre bus) ; les formats Bus sont intégrés au référentiel et traités dans un onglet Bus (À traiter / Préparation / Liste des colis) aux fonctionnalités identiques aux onglets 2 m² fixe et Pliage. L'écran « Préparation par centre » a le titre « Préparation par centre · Nanterre », une ligne par lot `BU-nnnn` (« Centre bus » à la place du destinataire), les remises directes au dépôt (« Remis au dépôt » à la place des expéditions). Les règles de délai et le workflow Dernière Minute (formulaire Process Métiers hors Circé) sont conservés tels quels. Le legacy a un menu Bus conditionné par le drapeau ConfigCat `busv3` et un mock (`PreparationBusMockRepository`), non analysés.
- Déclencheur : intégration d'un dossier Bus / ouverture de l'onglet Bus.
- Conditions : site Nanterre (Bus) = cible ; Bus > S43 non applicable dans la liste des instructions (maquette).
- Effet / message d'erreur : voir RG-COO-240 à 251 appliquées au type « Bus » ; flux d'alimentation du Bus : Q-279.
- Sources : spec `specs-ateliers-besoins.md PARTIE 11` (EX-BUS-502, EX-BUS-501, EX-BUS-504) ; écran `ECR-COO-09` ; legacy-admin.md RG-ADM-022 (drapeau `busv3`)
- Questions liées : Q-279
- Implémentation : PARTIEL [audit final COO-P11/P12/P13 : dépend de la reprise des ateliers (`unitaire.typesBus` vide par défaut, Q-319 / Q-195)] · — apps/api/src/modules/coordination/unitaire.ts ; apps/api/src/modules/coordination/routes-unitaire.ts ; apps/web/src/routes/coordination/unitaire.tsx (COO-P12 (2026-11-05) : onglet « Préparation par centre » : lots `BU-nnnn`, « Centre bus » à la place du destinataire, mêmes fonctions que le fixe ; type bus identifié par le paramètre `unitaire.typesBus` (vide : Q-319) ; reste : flux d'alimentation du Bus depuis Broadcast (Q-279), onglets À traiter / Liste des colis (COO-P13), « Remis au dépôt » à la place des expéditions)
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — PARTIEL (critère unique : paramètres vides par défaut) : `unitaire.typesBus` vide par défaut (Q-319 / Q-195) ; flux Bus depuis Broadcast non repris (Q-279)

### RG-COO-306 — Impressions du bloc : PDF généré côté navigateur
- Origine : MODIFIÉE
- Énoncé : fiche de synthèse, bagues, liste de picking, étiquettes de colis / UM, états de fin de journée sont générés côté navigateur (PDF) et non plus par rendu serveur RDLC ; aucune édition n'est enregistrée en base en legacy et aucun contrôle de droit n'existe sur les éditions (RG-ADM-060, RG-ADM-015). L'impression directe sur une imprimante Windows du serveur disparaît (agent local d'impression : Q-002). Les fichiers PDF temporaires legacy (jamais purgés) n'existent plus.
- Déclencheur : action Imprimer / Éditer.
- Conditions : la spec de la cible ne définit pas le format PDF (EX-TRA-026) : contrainte du projet.
- Effet / message d'erreur : PDF généré ; erreur d'impression visible (le legacy avale les exceptions).
- Sources : legacy `Rapport.cs:48-1025` (anciens ID provisoires RG-ADM-060, RG-ADM-061, RG-ADM-063) ; spec `specs-transverse.md §D` (EX-TRA-024, EX-TRA-025, EX-TRA-026) ; CLAUDE.md §3
- Questions liées : Q-002, Q-287
- Implémentation : PARTIEL — apps/web/src/routes/coordination/unitaire.tsx:ModaleSynthese ; apps/web/src/routes/coordination/bagues.tsx ; apps/web/src/routes/coordination/dispatch.tsx (COO-P12 (2026-11-05) : fiche de synthèse, bagues et liste de picking sont imprimées par le navigateur (window.print, Q-002, Q-287) ; reste : étiquettes de colis / UM et états de fin de journée (COO-P13), génération de fichiers PDF, erreur d'impression remontée)
- Tests : apps/api/test/coordination/unitaire.int.test.ts, e2e/coordination-unitaire.spec.ts

### RG-COO-307 — Historisation de chaque changement de statut et action du bloc
- Origine : MODIFIÉE
- Énoncé : chaque changement de statut de face, de train, d'unité, d'UM, de colis et chaque action tracée du bloc (export des trains, annulation de thème, débloquer semaine, libération, rendre la main, fractionnement, raccrochage, création / suppression de train, impression et réimpression de bague, affectation de rouleur, saisie 8 m²) écrit un historique (qui, quand, ancienne et nouvelle valeur, motif) ; chaque génération de fichiers est un lot versionné (GEN). Legacy : `rpc_statut` est écrasé sans historique ; `histo_historique_entite` ne couvre que `ChangementStatutInstruction` (vers 2 ou 4 seulement), `ModificationInstructionPlus`, `ExporterTrains`, `DebloquerPreparation` ; les batchs d'intégration n'écrivent pas d'historique.
- Déclencheur : toute transition de statut / action listée.
- Conditions : transaction unique avec la modification (CLAUDE.md §6).
- Effet / message d'erreur : ligne d'historique ; échec d'écriture = annulation de l'opération.
- Sources : legacy `HistorisationBll.cs:16-127` (ancien ID provisoire RG-INT-046), bdd.md §5 ; spec `specs-transverse.md §G` (EX-TRA-034) ; écran `ECR-COO-05a` (frise « Modifications tracées »), `ECR-ADM-08` ; CLAUDE.md §6
- Questions liées : Q-250
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts ; apps/api/src/modules/coordination/trains-calcul.ts (COO-P09 : historique de chaque statut de face et journal du train (fractionnement, raccrochage, création, suppression, changer statut, annuler thème, débloquer semaine, duplication). Reste : actions des COO-P10 à P13)
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

### RG-COO-308 — Actions de masse : verrou de version et idempotence
- Origine : NOUVELLE
- Énoncé : les actions de masse du bloc (export des trains, fractionner / raccrocher en masse, affecter un rouleur, imprimer des bagues, libérer, rendre la main, valider un comptage) s'exécutent dans une transaction ; chaque entité touchée porte un champ `version` (mise à jour conditionnelle, 409 si 0 ligne) ; les POST de création / transition portent l'en-tête `Idempotency-Key`. La maquette n'a aucune notion de version et laisse les actions de masse sans protection (Q-E de la maquette) ; deux utilisateurs peuvent agir simultanément sur la même sélection.
- Déclencheur : toute action groupée.
- Conditions : conventions du projet (CLAUDE.md §6).
- Effet / message d'erreur : 409 « conflit de version » ; rejouer la même clé d'idempotence renvoie le résultat initial.
- Sources : CLAUDE.md §6 ; `maquettes-reception-coordination.md §5` (Q-E)
- Questions liées : —
- Implémentation : PARTIEL — apps/api/src/modules/coordination/trains.ts:verifierVersions, versionTrain ; routes-trains.ts (idem) (COO-P09 : version d’un train (empreinte de ses faces, Q-192 (8)), 409, idempotence, atomicité testée. Reste : actions de masse des COO-P10 à P13)
- Tests : apps/api/test/coordination/trains.int.test.ts, apps/api/test/coordination/trains-complement.int.test.ts

## 5. Règles inter-modules (RG-X) concernant ce module
Règles RG-X-050…099 initiées par la Coordination ; les RG-X-001…049 (initiées par la Réception) sont dans `RECEPTION_REGLES_METIER.md` §5 et s'appliquent aussi à la Coordination.

### RG-X-050 — Annulation d'une validation admin : conséquences côté Réception
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : quand la Coordination annule la validation d'une affiche (RG-COO-014), dans la même transaction : l'affiche repasse « À confirmer : doute » (motif ANNULEE) ; elle redevient « à traiter » dans la liste des affiches de la Réception ; le n° d'affiche n'apparaît plus dans le suivi de production (✓ → •) ; l'étiquette rack déjà imprimée et le picking ne sont pas détruits (aucun effet sur le stock ni sur la palette) ; l'indicateur « reçue et associée » vers Broadcast repasse à faux au prochain passage (RG-COO-024) ; une alerte « Validation admin à confirmer » est levée selon le départ (RG-COO-033). Le stock, les mouvements et le statut de la palette (À contrôler / Contrôlée) ne sont jamais modifiés par une annulation.
- Déclencheur : action « Annuler la validation » (Coordination).
- Conditions : affiche `VALIDEE` ; rôle `coord`/`admin`.
- Effet / message d'erreur : 409 si l'affiche n'est pas validée ; test de rejet : après annulation, aucun mouvement de stock créé et statut de palette inchangé.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` ; `BLL/SuiviEtatReservationBll.cs:172-201` · spec [PP] §5 ; [DC] encadré 02/11 (EX-COO-009, EX-COO-014) ; écran ECR-COO-02
- Questions liées : Q-202
- Implémentation : apps/api/src/modules/coordination/effets-validation.ts:changerValidationCoordination, donneesAnnulation ; reception/affiches.ts:changerValidationAdmin — PARTIEL : COO-P04 (2026-11-05, audit) : aucun mouvement, palette inchangée, effets de lecture retirés ; reste : alerte « Validation admin à confirmer » levée selon le départ (RG-COO-033, COO-P07) ; COO-P07 (2026-11-05) : alerte « Validation admin à confirmer » levée à l’annulation selon le départ (RG-COO-033) → FAIT · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/coordination/effets-validation-complement.int.test.ts ; apps/api/test/coordination/alertes-preprod.int.test.ts ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-01) ; apps/api/test/interactions/concurrence.int.test.ts (K-02) ; apps/api/test/interactions/atomicite.int.test.ts (A-05) ; e2e/interactions.spec.ts

### RG-X-051 — Rattachement d'une réception inconnue par la Coordination : validation et entrée de la palette dans le sas
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : « Rattacher » (réception inconnue) par un utilisateur `coord`/`admin` écrit dans une seule transaction : les liens affiche ↔ lignes (avec quantités), la validation admin (validée/par/le, mode MAIN, RG-COO-017), le statut d'affiche « Identifiée », le statut de la réception « À contrôler » (la palette entre dans le sas de contrôle), l'annonceur de l'affiche remplacé par celui du dossier (libellé remplacé seulement si les IP sont saisies : « le 1er qui a parlé » sinon), la feuille de stock « définitive à imprimer » (alerte à la Réception de la plateforme) et la levée de l'alerte « Réception inconnue à identifier ». Rattaché par un autre rôle (ex. agent de réception) : mêmes écritures sauf la validation (reste « À confirmer : doute », motif BL, RG-COO-018).
- Déclencheur : action « Rattacher » (ECR-REC-04).
- Conditions : au moins un dossier et une quantité > 0 ; Σ quantités ≤ quantité reçue ; affiche « Orpheline » ou « Introuvable » ; `Idempotency-Key`.
- Effet / message d'erreur : 422 « Choisissez au moins un dossier et une quantité. » ; 422 « La répartition (n) dépasse la quantité reçue (m). » ; 409 si l'affiche est déjà rattachée.
- Sources : spec [PP] §6 ; [DC] §7 ; [README] §3, H1 (EX-COO-010, EX-COO-017) ; EX-REC-039, EX-REC-040 ; écran ECR-REC-04 (« Règles de Rattacher »)
- Questions liées : Q-201
- Implémentation : apps/api/src/modules/reception/inconnues.ts:rattacherInconnue — FAIT : COO-P04 (2026-11-05) : une transaction : liens, validation, IDENTIFIEE, À contrôler, annonceur, feuille à refaire, étiquette rack, alerte levée ; rejets 422 / 409 sans écriture · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-10) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-06) ; apps/api/test/interactions/concurrence.int.test.ts (K-07)

### RG-X-052 — Rattachement manuel du surplus à un autre dossier (même après validation ou début de production)
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : la Coordination peut rattacher à la main le surplus d'une affiche à un autre dossier (« + Rattacher à un autre dossier », sans limite de nombre de dossiers, ANO-12) même si l'affiche est validée ou que la production a commencé ; seul le surplus est rattaché ; le nouveau lien porte la quantité du surplus, est historisé (qui/quand) et, si l'acteur est `coord`/`admin`, vaut validation de ce lien ; les validations déjà faites sur les autres liens ne sont pas retirées (HYPOTHÈSE Q-202) ; changement de thème d'un lien : tag « Feuille à refaire » côté Réception ; autre plateforme : transfert puis réception.
- Déclencheur : action « + Rattacher à un autre dossier » / « Changer de thème… » (fiche affiche).
- Conditions : Σ quantités des liens actifs ≤ quantité reçue ; ligne cible `ACTIVE`.
- Effet / message d'erreur : 422 « La répartition (x) dépasse la quantité reçue (y). » ; historique `AfficheAssocier` ; alerte « Feuilles de stock à refaire » (Réception et Coordination).
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-REC-048, EX-REC-062 ; EX-EXI-058
- Questions liées : Q-202
- Implémentation : apps/api/src/modules/reception/affiches.ts:rattacherAutreDossier — FAIT : COO-P04 (2026-11-05) : surplus rattaché par coord : validation conservée ; par un autre rôle l’affiche repasse à confirmer (validation par affiche, HYPOTHÈSE Q-186 (3)) · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/reception/audit-rec.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-14)
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — ni concurrence ni rollback démontrés (écart consigné)

### RG-X-053 — Affiche à doute : tant que non confirmée, ses effets de validation ne sont pas produits
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique non (invariant de lecture)
- Énoncé : invariant : une affiche en `A_CONFIRMER_PROPOSE` ou `A_CONFIRMER_DOUTE` ne produit aucun des effets réservés à la validation (n° d'affiche « ✓ » dans l'état des réservations et le suivi de prod, retour « reçue et associée » à Broadcast, édition du picking, sortie de la liste « à traiter ») ; en revanche sa réception, son contrôle, son stock, sa feuille de stock et l'impression de son étiquette de stock restent permis (la réception ne dépend pas de la validation, la quantité reçue est comptée dès le mouvement de réception).
- Déclencheur : toute lecture ou action sur une affiche non validée.
- Conditions : état ≠ `VALIDEE`.
- Effet / message d'erreur : 422 sur les actions réservées (picking : RG-COO-022) ; test : une affiche à doute reçue et contrôlée a un stock et une feuille, mais aucun `EstAssociee`.
- Sources : spec [PP] §3, §5 ; [README] §3 (EX-COO-014) ; EX-REC-052 ; legacy `BLL/BatchAlimReceptionBll.cs:89`
- Questions liées : Q-231
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts:etatValidation ; apps/api/src/modules/reception/impressions.ts:editionPicking (validées seulement) — PARTIEL : COO-P03 (2026-11-05) : invariant testé (stock, feuille, étiquette permis ; picking réservé aux validées) ; reste : n° au suivi de prod, retour Broadcast (COO-P04, étape 8) · ÉTAPE 7 (2026-11-05) : FAIT — consolidé : une affiche à doute reçue et contrôlée a stock et feuille, mais ni picking, ni étiquette rack, ni « associée »
- Tests : apps/api/test/coordination/validation-admin.int.test.ts ; apps/api/test/coordination/validation-admin-complement.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-07) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-07)

### RG-X-054 — Réception inconnue traitée par la Coordination : « Signaler » et dossier introuvable
- Origine : NOUVELLE
- Modules : bidirectionnel (action de la Coordination sur une réception créée par REC)
- Atomicité : transaction unique oui
- Énoncé : sur une réception inconnue « À identifier », la Coordination peut : (1) « Voir les visuels proposés (n) » puis rattacher (RG-X-051) ; (2) rechercher par n° de dossier ; (3) « Signaler à la Coordination (alerte) » si personne ne retrouve le dossier : l'affiche passe « Introuvable : alerte à la Coordination » avec date/heure du signalement, une alerte « Dossier introuvable » est levée (grave dès le signalement, Coordination du site, sans mail), et toute correction ultérieure de Broadcast (dossier créé/corrigé) fait apparaître le dossier dans les candidats. Deux cas à ne pas confondre : DA activée mais IP non saisies = pas une réception inconnue (RG-COO-071) ; dossier dans Broadcast mais affiche non reconnue = réception inconnue.
- Déclencheur : bouton « Signaler à la Coordination (alerte) ».
- Conditions : affiche « À identifier » ; un signalement répété met à jour la date, ne duplique pas l'alerte.
- Effet / message d'erreur : transition `A_IDENTIFIER → INTROUVABLE` ; toast « Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… » ; destinataire Nîmes : Q-221 ; qui rattache après la correction Broadcast : Q37 d'origine, hors décision.
- Sources : spec [DC] §3, §7, §10, §11 ; [PR] p.1 ; [PP] §6 (EX-COO-017) ; EX-REC-041, EX-REC-042 ; écran ECR-REC-04
- Questions liées : Q-221, Q-234
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : PARTIEL — signalement et alerte testés ; destinataire de Nîmes (Q-221)
- Tests : (rempli à l'étape 5/6) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-11) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-06)

### RG-X-055 — Ligne fermée ou annulée : le lien de l'affiche est déplacé, jamais perdu
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : quand une ligne attendue se ferme (annulation Broadcast, fermeture du provisoire aux IP, RG-COO-085, 087), les liens d'affiches qu'elle porte restent intacts (liés à la ligne fermée) jusqu'à un déplacement explicite (automatique si un seul candidat, sinon choix de la Coordination) ; l'affiche ne devient jamais « Orpheline » du seul fait de la fermeture d'une ligne ; une alerte à la Coordination signale l'affiche à re-rattacher ; un lien déplacé conserve son historique (retiré/créé, qui, quand).
- Déclencheur : fermeture d'une ligne attendue.
- Conditions : au moins un lien actif.
- Effet / message d'erreur : test de rejet : après fermeture de la ligne, l'affiche reste « Identifiée » et le stock est intact.
- Sources : spec [RA] §5 RG-AT-04, 06, 08 ; [PP] §6, §7 R5 (EX-COO-035, EX-COO-037, EX-COO-039)
- Questions liées : Q-210
- Implémentation : apps/api/src/modules/coordination/validation-admin.ts (LIGNE_FERMEE) ; apps/api/src/modules/coordination/alimentation-lignes.ts (RG-COO-087) · ÉTAPE 7 (2026-11-05) : FAIT — ligne fermée : lien conservé, affiche toujours « Identifiée », stock intact, alerte « à re-rattacher »
- Tests : (rempli à l'étape 5/6) ; apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-02)
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — ni concurrence ni rollback démontrés (écart consigné)

### RG-X-056 — Saisie des IP : déplacement automatique des affiches du provisoire vers le thème
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : le passage « visuel provisoire → lignes par thème » (RG-COO-085) a des conséquences sur les affiches réceptionnées avant les IP : l'affiche est déplacée seule vers le thème s'il n'y a qu'un thème possible ou si le visuel du BL n'en désigne qu'un ; sinon elle reste rattachée au provisoire fermé et la Coordination choisit ; aucun candidat : alerte ; l'intitulé de la plateforme (« 1er qui a parlé ») est conservé autant que possible, et si la Pré-Prod corrige l'intitulé, les feuilles de stock sont à refaire (alerte « Feuilles de stock à refaire » à la Réception).
- Déclencheur : lecture de Broadcast avec IP.
- Conditions : affiche rattachée à une ligne provisoire.
- Effet / message d'erreur : tag « Feuille à refaire » si l'intitulé change ; tout déplacement est historisé.
- Sources : spec [RA] §5 RG-AT-04 ; [PP] §7 R3, R5 (EX-COO-035) ; ateliers EX-THM-501, EX-THM-503 (A14 slide 30 #1, #3) ; EX-REC-062
- Questions liées : Q-208
- Implémentation : apps/api/src/modules/coordination/alimentation-lignes.ts:fermerProvisoires · ÉTAPE 7 (2026-11-05) : FAIT — déplacement historisé ; intitulé de la plateforme conservé (Q-208)
- Tests : (rempli à l'étape 5/6) ; apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-01)
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — ni concurrence ni rollback démontrés (écart consigné)

### RG-X-057 — Thème modifié dans Broadcast après la validation : validation à refaire et feuille de stock à refaire
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : si le thème de la ligne d'une affiche validée est modifié dans Broadcast (RG-COO-030), la Coordination « Reprendre la version Broadcast » (RG-COO-068) : dans la même transaction le thème de la ligne est mis à jour, la validation de l'affiche est à refaire (hypothèse Q-210), le tag « Feuille à refaire » est posé sur l'affiche et l'alerte « Feuilles de stock à refaire » est levée (Réception et Coordination) pour réimpression des feuilles ; une page des modifications de thème reçues après l'identification est mise à disposition de la Réception avec alerte (EX-THM-503).
- Déclencheur : action « Reprendre la version Broadcast » ; lecture de Broadcast modifiant le thème.
- Conditions : thème de Broadcast ≠ thème de Circé ; au moins une affiche rattachée.
- Effet / message d'erreur : si production lancée : mail aux chefs d'équipe (RG-COO-068) ; tags et alertes levés à la réimpression de la feuille.
- Sources : spec [README] §3 ; [PP] §6, §9 (EX-COO-016, EX-COO-029) ; ateliers EX-THM-503 ; écran ECR-THM-03 ; `maquettes-autres-modules.md §0.1` (écriture de THM vers Réception : `noterThemeModifie`)
- Questions liées : Q-210
- Implémentation : apps/api/src/modules/coordination/themes.ts:reprendreThemeBroadcast — PARTIEL : COO-P07 (2026-11-05) : une transaction : thème de l’affiche aligné, feuille à refaire (alerte RG-REC-188 Réception et Coordination), validation à refaire (motif THEME), historique ; refus si l’affiche n’est plus rattachée (409) ; reste : mail si production lancée (Q-375) · ÉTAPE 7 (2026-11-05) : PARTIEL — reprise du thème, validation et feuille à refaire, alerte (testés) ; page « modifications de thème » de la Réception et mail aux chefs d'équipe : Q-375, E8
- Tests : apps/api/test/coordination/alertes-preprod.int.test.ts ; e2e/coordination-alertes.spec.ts ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-03) ; apps/api/test/interactions/atomicite.int.test.ts (A-06)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — rollback démontré (A-06), concurrence NON démontrée (écart consigné)

### RG-X-058 — Retrait ou dissociation du dernier dossier par la Coordination : l'affiche redevient réception inconnue
- Origine : MODIFIÉE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : si la Coordination retire (dissocie) le dernier lien actif d'une affiche, l'affiche redevient orpheline (« Réception inconnue ») avec statut de réception « À identifier » (hors du sas), sa validation est caduque (effacée, historisée), son alerte « Réception inconnue à identifier » est relevée. La dissociation est historisée par une action distincte `AfficheDissocier`. MODIFIÉE : legacy = dissociation sans contrôle de statut, historisée avec l'action d'association (id de la prépa comme id d'entité) ; `ARecevoir` non remis à zéro (voir RG-COO-097) ; état de la palette « À identifier » ou « À contrôler » si elle était déjà contrôlée : contradiction [DC] §9 / §10 (EX-REC-043), traité par le module Réception.
- Déclencheur : action « Retirer » (fiche affiche, onglet Préparations).
- Conditions : un seul lien actif restant.
- Effet / message d'erreur : transition `IDENTIFIEE → ORPHELINE` ; 409 si aucun lien actif.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:577-586` ; `BLL/HistorisationBll.cs:68-76` · spec [DC] §8, §9, §10 (EX-COO-039) ; EX-REC-043
- Questions liées : Q-213
- Implémentation : apps/api/src/modules/reception/rattachement.ts:retirerRattachement — FAIT : COO-P04 (2026-11-05) : dernier lien retiré : orpheline, À identifier, validation caduque, AFFICHE_DISSOCIER · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : apps/api/test/coordination/effets-validation.int.test.ts ; apps/api/test/reception/inconnues.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-13) ; apps/api/test/interactions/concurrence.int.test.ts (K-03) ; e2e/interactions.spec.ts

### RG-X-059 — Déblocage / « Rendre la main » : validation admin et affiches reçues inchangées
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : invariant : le déblocage d'une préparation (RG-COO-145) et le renvoi de prépa (RG-COO-054, 148) n'altèrent ni la validation admin déjà faite, ni les affiches reçues, ni leur stock, ni les liens avec les lignes attendues ; seules les lignes de répartition/UM non lancées sont annulées ou remises en attente (coo2). La validation admin ne bouge pas lors d'un renvoi de prépa (règle `renvoiPrepa` de la maquette). HYPOTHÈSE Q-217 (question Q-COO-18 de la maquette : « conséquences sur la validation admin et les affiches reçues »).
- Déclencheur : déblocage ; renvoi de prépa.
- Conditions : toute validation existante.
- Effet / message d'erreur : test de rejet : un déblocage laisse `VALIDEE` et le stock inchangés.
- Sources : maquette `app.js` `renvoiPrepa` (maquettes-autres-modules.md §A) ; ECR-COO-09b ; spec [PP] §2 jalon 5 (EX-COO-044)
- Questions liées : Q-217
- Implémentation : apps/api/src/modules/coordination/deblocage.ts:debloquerGroupe (aucune écriture sur l’affiche, le stock ni les liens) ; integration-flux.ts (renvoi de prépa) — FAIT : COO-P08 (2026-11-05) : test de rejet : déblocage et renvoi de prépa laissent la validation admin, l’affiche, son stock et ses liens inchangés
- Tests : apps/api/test/coordination/deblocage.int.test.ts

### RG-X-060 — Thème partagé par plusieurs dossiers : le reçu est compté une seule fois
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique non (invariant de calcul)
- Énoncé : invariant : pour un thème présent sur plusieurs dossiers (ou un dossier sur plusieurs semaines), la quantité reçue d'une affiche est la somme de ses mouvements, jamais dupliquée par le nombre de dossiers ; la répartition par dossier est portée par les quantités des liens (RG-COO-088) et leur somme ne dépasse pas la quantité reçue ; les totaux (état des réservations, tableau de bord) comptent le reçu et le reste une fois par thème.
- Déclencheur : calcul d'attendu/reçu/reste.
- Conditions : lien plusieurs-à-plusieurs.
- Effet / message d'erreur : test : une affiche de 100 sur 3 dossiers (50/30/20) ⇒ reçu total 100.
- Sources : spec [PP] §6 ; [RA] cas 21-25 (EX-COO-045) ; EX-REC-058 ; écran ECR-PIL-03 (« Totaux en pied (reçu et reste comptés une fois par thème) ») ; ateliers EX-TRA-515
- Questions liées : Q-208
- Implémentation : PARTIEL (REC-P01, 2026-11-04) — apps/api/src/modules/reception/stock.ts:assertRepartitionPossible + affiche.ts (écriture versionnée contre la concurrence) ; service.ts:lireStockAffiche. Reste : Totaux « une fois par thème » (état des réservations, tableau de bord) : parcours suivants ; « non répartie » négative après rebut : Q-172. · ÉTAPE 7 (2026-11-05) : PARTIEL
- Tests : apps/api/test/reception/socle.int.test.ts ; socle-complement.int.test.ts ; socle-audit.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-06)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — ANO-064 OUVERTE (Q-416) : le comptage à zéro laisse un lien actif de 1 sur une affiche au stock 0 (`Math.max(1, …)`, Q-178) ; `it.todo` NR-064 ; « non répartie » négative après rebut : Q-172

### RG-X-061 — Réception partielle : validation de ce qui est reçu, complément proposé puis confirmé
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique oui
- Énoncé : une réception partielle est validée pour ce qu'elle contient (RG-COO-016) ; le manque reste à l'état « reste à recevoir » de la ligne avec son alerte (Visuel non reçu / reçu en partie : Réception) ; à l'arrivée du complément (nouvelle réception sur la même ligne), la Coordination reçoit une nouvelle proposition (complément proposé) qui est confirmée comme les autres ; l'affiche garde ses liens ; la validation du premier lot n'est pas retirée.
- Déclencheur : réception d'un complément (action Réception).
- Conditions : ligne avec liens actifs et reste à recevoir > 0.
- Effet / message d'erreur : nouvelle proposition `A_CONFIRMER_PROPOSE` pour le complément (tag « Complément » de l'affiche) ; exemple 3/3/3 : A et B validées, rien pour C, complément de B proposé.
- Sources : spec [PP] §5, §6 ; [RA] RG-VA-03, cas 24 (EX-COO-011) ; EX-REC-054, EX-REC-059
- Questions liées : Q-203
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : PARTIEL (requalifié À FAIRE à l'audit final) — la partielle est validée pour ce qu'elle contient (testé) ; la NOUVELLE proposition du complément n'est PAS implémentée (la validation est portée par l'affiche, pas par le lot) : Q-399, ECARTS
- Tests : (rempli à l'étape 5/6) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-05) ; apps/api/test/interactions/ecarts-connus.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : À FAIRE (avant : PARTIEL) — À FAIRE (était PARTIEL à tort) : la NOUVELLE proposition du complément n'est pas implémentée (la validation est portée par l'affiche, pas par le lot) ; seul le complément sur la même affiche (RG-X-018, RG-REC-040) est testé ; il ne reste que `it.todo` (non exécuté) ; décision : Q-399 (OUVERTE, non bloquante)

### RG-X-062 — Aucune écriture en lecture : supprimer l'auto-rattachement à l'ouverture d'une fiche
- Origine : MODIFIÉE
- Modules : COO → REC
- Atomicité : transaction unique non (invariant)
- Énoncé : l'ouverture de la fiche d'une affiche (liste filtrée) ne rattache plus rien automatiquement : toute proposition passe par la création de l'affiche (RG-COO-004) ou une action explicite de rattachement. MODIFIÉE : legacy = si l'affiche n'a aucune préparation et n'est pas validée, l'ouverture depuis une liste filtrée rattache d'office toutes les lignes attendues du même dossier/plateforme/support (`ValiderAssocPrepaAffiche`), sans confirmation. Remplacé par la proposition de l'option A (Q-214, HYPOTHÈSE).
- Déclencheur : lecture de la fiche affiche.
- Conditions : `GET` idempotent sans effet de bord.
- Effet / message d'erreur : test : deux ouvertures successives de la fiche ne créent aucun lien ni historique.
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:218-257` (ancien ID provisoire RG-COO-024 ; RG-REC-093) · spec [PP] §5 ; [RA] RG-AT-08 (EX-COO-004)
- Questions liées : Q-214
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT — deux lectures de la fiche affiche : aucun lien, historique ni mouvement créé
- Tests : (rempli à l'étape 5/6) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-15)

### RG-X-063 — Rattachement par la Réception ne vaut pas validation ; validation possible à tout moment du process
- Origine : NOUVELLE
- Modules : bidirectionnel
- Atomicité : transaction unique oui
- Énoncé : un rattachement fait par l'agent de réception (rôle `recep`) ne pose jamais la validation admin : l'affiche reste « À confirmer » (motif BL, mode MAIN). La validation reste possible à n'importe quel statut de la ligne, de l'instruction et du dossier (y compris après l'export du jeudi 14 h : l'affiche arrivée après l'export est proposée puis confirmée ; urgences du vendredi), sans changer ces statuts.
- Déclencheur : rattachement par `recep` ; validation tardive.
- Conditions : aucune condition de statut du dossier/de l'instruction (RG-COO-001).
- Effet / message d'erreur : test de rejet : rattachement par `recep` ⇒ état `A_CONFIRMER_DOUTE`, jamais `VALIDEE`.
- Sources : spec [README] §3, H1 ; [PP] §2 jalon 7 ; [DC] §7 (EX-COO-010, EX-COO-044) ; EX-EXI-053 ; écran ECR-REC-04 (Q-REC-18)
- Questions liées : Q-201
- Implémentation : voir la matrice de traçabilité · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : (rempli à l'étape 5/6) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-10, R-12) ; e2e/interactions.spec.ts

### RG-X-064 — Quantité Broadcast modifiée après réception : l'attendu se recalcule, les liens et le stock restent
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : une modification de quantité dans Broadcast après réception met à jour `qte_bc` / `qte_prepa` de la ligne et le statut calculé de la ligne (Attendue / Partielle / Complète / Surplus, > 10 % en trop) côté Réception ; les liens, le stock et les validations restent inchangés ; une alerte « Écart Broadcast / Circé » est levée à la Coordination (RG-COO-031, 067).
- Déclencheur : lecture de Broadcast ; arrivée de la prépa.
- Conditions : ligne avec liens actifs.
- Effet / message d'erreur : test : `qte` Broadcast de 100 → 80 avec reçu 90 ⇒ statut « Surplus » (+12,5 %), alerte levée, aucun lien retiré.
- Sources : spec [RA] RG-AT-05, RG-VA-02 ; [PP] §6 (EX-COO-016, EX-COO-028) ; EX-REC-051
- Questions liées : Q-210
- Implémentation : apps/api/src/modules/coordination/edition.ts:appliquerVersionBroadcast (recalculerLigne dans la transaction) — PARTIEL : COO-P02 (2026-11-04) : attendu et statut de ligne recalculés, liens / stock / validation inchangés ; reste l’alerte (COO-P05) et la modification Broadcast à la lecture (étape 8) · ÉTAPE 7 (2026-11-05) : FAIT — 100 → 80 avec 90 reçus : Surplus (+12,5 %), liens et stock inchangés, alerte « Écart Broadcast / Circé »
- Tests : apps/api/test/coordination/instruction-ok-complement.int.test.ts ; apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-03) ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-04)
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — ni concurrence ni rollback démontrés (écart consigné)

### RG-X-065 — Dossier ou DA annulé après réception : affiches conservées en stock, alerte à la Coordination
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : l'annulation d'une DA/d'un dossier après réception (RG-COO-062, 087) ne supprime ni ne rebute les affiches reçues : elles restent en stock (fin de campagne : décision de la Coordination/Réception), leur validation devient sans objet, les alertes de validation levées sont relevées, et une alerte informe la Coordination que des affiches reçues sont rattachées à une ligne fermée (RG-COO-032).
- Déclencheur : passage du dossier à `ANNULE` / ligne `ANNULEE`.
- Conditions : affiches rattachées.
- Effet / message d'erreur : aucun mouvement de stock créé ; test de rejet : le stock de l'affiche est inchangé.
- Sources : spec [RA] RG-AT-06, cas 14 ; [PP] §6 (EX-COO-037) ; maquette ECR-COO-01 (dossier annulé)
- Questions liées : Q-210
- Implémentation : apps/api/src/modules/coordination/integration.ts:annulerDossier — PARTIEL : COO-P01 (2026-11-04) : transaction unique, affiches gardées en stock, aucun mouvement ; reste l’alerte « affiches rattachées à une ligne fermée » (RG-COO-032, COO-P05) · ÉTAPE 7 (2026-11-05) : FAIT — réception refusée sur une ligne fermée (REC_LIGNE_INDISPONIBLE) ; affiches reçues conservées, aucun mouvement
- Tests : apps/api/test/coordination/socle.int.test.ts ; apps/api/test/coordination/socle-complement.int.test.ts ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-03, R-16) ; apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-02) ; apps/api/test/interactions/concurrence.int.test.ts (K-04) ; apps/api/test/interactions/atomicite.int.test.ts (A-04)

Les définitions des types d'alerte (gravité, destinataires, canal) et la machine d'états de l'Instruction OK et de la validation admin sont possédées par coo1 (`RG-COO-1xx`, `RG-X-050` à `RG-X-074`) ; les règles ci-dessous fixent les CONDITIONS de déclenchement côté trains / unités et les effets croisés avec la Réception.

### RG-X-075 — Visuel arrivé après la préparation des trains (déroulant)
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : lorsqu'une affiche est reçue (ou un thème nouveau apparaît) pour un dossier du déroulant dont la préparation est déjà reçue et dont les trains sont déjà calculés (Instruction OK) ou exportés, le thème est ajouté au dossier validé, le statut de préparation du dossier repasse à « Préparation reçue » (PREPA_RECUE), une alerte « Rajout après préparation » (gravité importante) est créée et un mail part à la liste de distribution « Rajouts après préparation » (chef d'atelier, admins de la plateforme, coordinateurs logistique, liste par plateforme). Il n'y a PAS de raccrochage automatique dans les trains restant à produire : l'atelier choisit « Fractionner » ou « Raccrocher » (RG-COO-221, RG-COO-222).
- Déclencheur : réception / rattachement d'une affiche dont le thème n'est couvert par aucune position de train du dossier ; nouvelle préparation Broadcast.
- Conditions : fenêtre de l'alerte : toute préparation envoyée à partir de la nuit du jeudi au vendredi S-2 jusqu'au vendredi de la semaine S (fenêtre contradictoire avec la deadline Pré-Prod du jeudi S-2 16 h : Q-266) ; sans le mail, la plateforme ne sait pas qu'elle a le go ; pas d'alerte pour une dernière minute avec fichier scro validé (RG-X-077).
- Effet / message d'erreur : alerte + mail (liste de distribution gérée dans Administration) ; trains non exportés : couverture recalculée (RG-COO-208) ; trains exportés : figés (RG-COO-223).
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503), `specs-transverse.md §E` (EX-TRA-031 : alerte « Visuel arrivé après la préparation des trains »), `specs-existant-process.md §F` (EX-EXI-078) ; maquette `maquettes-reception-coordination.md §1.4` (événement 2, RP34) ; écran `ECR-TRA-01`, `ECR-ADM-04`
- Questions liées : Q-266
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : PARTIEL — alerte à la réception d'un visuel absent de tous les trains (message dédié) ; fenêtre contradictoire Q-266, mail Q-375 ; apps/api/src/modules/coordination/alertes-coordination.ts (bloc « RX- »)
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-18)

### RG-X-076 — Dossier fixe / pliage / bus arrivé après la libération de la semaine
- Origine : NOUVELLE
- Modules : COO → REC (le déclencheur est l'arrivée de la préparation ; le destinataire est l'atelier / la Coordination)
- Atomicité : transaction unique oui
- Énoncé : si une préparation 2 m² fixe (ou pliage, bus) d'une semaine déjà libérée (RG-COO-240) est reçue après la date de libération, la création de la ligne déclenche : le repère « Arrivé après libération » (RG-COO-242), l'alerte `APRES_LIBERATION` (gravité importante), un mail aux chefs d'équipe du fixe de la plateforme et à la Coordination, et l'inscription du dossier à la liste des « dossiers arrivés après » du bandeau de libération. Cela couvre le besoin de Nîmes : alerte quand la date d'envoi d'un dossier fixe pour la semaine S est postérieure à la date du 1er colisage (libération) effectué pour la semaine S.
- Déclencheur : intégration de la préparation (alimentation, coo1) ou réception d'une affiche sur un dossier de semaine libérée.
- Conditions : libération existante pour (atelier, semaine) ; date de la préparation > date de libération ; la libération ne dépend pas de la validation admin (RG-X-084).
- Effet / message d'erreur : alerte `APRES_LIBERATION` + mail ; aucune modification des UM déjà créées.
- Sources : spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-503), `PARTIE 2` (EX-COO-503), `specs-existant-process.md §F` (EX-EXI-078) ; maquette `maquettes-reception-coordination.md §1.4` (événement 1) ; écran `ECR-COO-09`, `ECR-TRA-01`
- Questions liées : Q-265, Q-266
- Implémentation : PARTIEL — alertes-coordination.ts (alerte LIB-), unitaire.ts (repère) (ÉTAPE 8 (2026-11-05) : alerte APRES_LIBERATION calculée à la lecture, UM déjà créées intactes ; reste : mail non envoyé Q-375, fenêtre Q-266)
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — ni concurrence ni rollback démontrés (alerte calculée à la lecture) (écart consigné)

### RG-X-077 — Dernière minute sur un train déjà en production
- Origine : NOUVELLE
- Modules : COO → REC (bidirectionnel avec Broadcast ; la Réception est informée par l'alerte et la feuille de stock à refaire éventuelle)
- Atomicité : transaction unique oui
- Énoncé : lorsque Broadcast modifie une préparation / un thème d'un train dont l'unité est EN_PROD (fichier déjà généré ou bague imprimée), la modification n'est jamais appliquée au train (point de non-retour, RG-COO-223) : elle est tracée sur le train (« Modifications tracées »), une alerte `DM_FICHIER` (gravité critique) est créée et un mail part aux chefs d'équipe du déroulant ; l'unité est teintée en critique dans la liste des trains ; un « complément » (génération des seules unités modifiées) peut être demandé au générateur. Aujourd'hui une dernière minute avec fichier scro validé n'a pas d'alerte : un fichier à part est envoyé et ces affiches sortent systématiquement en fractionné.
- Déclencheur : intégration d'une modification Broadcast (nouvelle face, thème changé, quantité changée) sur un train EN_PROD.
- Conditions : train au statut EN_PROD ou au-delà ; la reprise de l'afficheur par panneau (RG-COO-207) est neutralisée sur ce train.
- Effet / message d'erreur : modification tracée + alerte critique + mail ; aucun statut modifié.
- Sources : spec `specs-ateliers-besoins.md PARTIE 2` (EX-COO-503, EX-COO-512), `specs-existant-process.md §F` (EX-EXI-078) ; maquette `maquettes-reception-coordination.md §1.4` (événement 3) ; écran `ECR-COO-05`, `ECR-GEN-03`, `ECR-TRA-01`
- Questions liées : Q-282
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : PARTIEL — trace + alerte critique, AUCUN statut de train modifié (testé) ; traitement cible d'une dernière minute : Q-282 OUVERTE ; apps/api/src/modules/coordination/alertes-coordination.ts (DM_FICHIER, RG-COO-074)
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-04) ; apps/api/test/interactions/ecarts-connus.int.test.ts

### RG-X-078 — Préparation renvoyée par Broadcast avant ou après l'export des trains
- Origine : MODIFIÉE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : (maquette) si la préparation est renvoyée par Broadcast et que les trains ne sont pas exportés, l'Instruction OK du dossier est refaite (marque Instruction OK supprimée, statut de préparation « Préparation reçue ») ; la validation admin ne bouge pas ; si les trains sont déjà exportés (« A imprimer »), ils restent figés et une alerte `APRES_LIBERATION` (gravité importante) part à la Coordination et aux chefs d'équipe. Legacy : les instructions et faces renvoyées après « Instruction ok » ou « A imprimer » sont ignorées sans alerte (RG-COO-047 et RG-COO-049 legacy, coo1) et une préparation renvoyée n'est intégrée que si la précédente a été annulée par déblocage.
- Déclencheur : intégration d'une préparation / de faces / d'instructions déjà connues.
- Conditions : le moment de l'Instruction OK automatique (jeudi 14 h par bouton, option (a) recommandée, ou dès l'arrivée de la prépa, option (b)) n'est pas tranché (EX-COO-022, Q60).
- Effet / message d'erreur : voir Énoncé.
- Sources : spec `specs-coordination.md §C` (EX-COO-022, EX-COO-044 jalon 5), `specs-existant-process.md §B` (EX-EXI-016, EX-EXI-018) ; maquette `maquettes-autres-modules.md §A` (règle `renvoiPrepa`) ; legacy `p_integ_instructions.sql:175-259`, `p_integ_train_affiches.sql:38-48` (RG-COO-047, RG-COO-049 legacy)
- Questions liées : Q-251, Q-266
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : PARTIEL — renvoi ignoré après l'Instruction OK + alerte ; moment exact de l'Instruction OK automatique : Q-251, Q-266 ; apps/api/src/modules/coordination/integration.ts ; apps/api/src/modules/coordination/alertes-coordination.ts (RG-COO-053)
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/coordination/instruction-ok-complement.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — D-20 : l'Instruction OK automatique est aussi rejouée en rattrapage par la tâche INSTRUCTION_OK_AUTO, désactivée par défaut (`p_batch_auto_instruction_ok` inconnu : Q-006, Q-410) ; le moment exact de l'Instruction OK reste Q-251 / Q-266 ; plus de « BLOQUÉ Q-265 »

### RG-X-079 — Disponibilité physique des affiches pour la préparation (reçu, contrôle, couverture)
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : le « reçu » d'un thème (somme des quantités des affiches rattachées, par thème, pas par destinataire) alimente la couverture des positions de trains, des UM et des lots (RG-COO-208) et les colonnes Reçu / Couvert / Emplacement du Suivi par thème (RG-COO-230) ; une réception qui complète un visuel manquant fait passer l'unité EN_ATTENTE → PRET sans autre action. La question de savoir si le reçu compte dès la réception (palette en sas « À contrôler ») ou seulement après le contrôle de la palette est ouverte. Les unités EN_PROD ne reviennent jamais en arrière si le reçu diminue (rebut, mise au rebut au stock).
- Déclencheur : réception / contrôle / rebut d'une affiche (REC), changement de rattachement.
- Conditions : reçu = Σ `alloc` des affiches rattachées au thème ; le surplus > 10 % est signalé ; l'entretien est compté dans l'attendu.
- Effet / message d'erreur : recalcul de la couverture (transaction commune avec l'écriture du reçu).
- Sources : maquette `maquettes-reception-coordination.md §1.4` (événement 5), `maquettes-autres-modules.md §0.1` (`C.recu`, `C.etatTheme`, unités EN_ATTENTE → PRET) ; spec `specs-ateliers-besoins.md PARTIE 6` (EX-PIL-501) ; écran `ECR-COO-05`, `ECR-COO-06`
- Questions liées : Q-280
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : FAIT — couverture recalculée à la lecture ; le rebut réduit le stock mais pas le reçu (RG-REC-017)
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-17, R-21)

### RG-X-080 — Le reçu se rattache au visuel, jamais au destinataire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique non
- Énoncé : l'affiche reçue est rattachée au thème (visuel) d'un dossier et non à un destinataire ; la couverture sert d'abord les unités dont le départ camion est le plus proche ; le total reçu d'un thème se compte une seule fois même si le thème sert plusieurs dossiers, plusieurs semaines ou plusieurs trains (reçu et reste comptés une fois par thème dans les pieds de totaux ; quantité d'un dossier sur deux semaines comptée une fois).
- Déclencheur : calcul de couverture / d'indicateurs.
- Conditions : règle de couverture « départ le plus proche servi d'abord » à confirmer (Q41 de la maquette).
- Effet / message d'erreur : indicateurs et statuts d'unité.
- Sources : maquette `maquettes-autres-modules.md ECR-PIL-03` (Q41, ANO-02), `ECR-PIL-04` ; spec `specs-existant-process.md §F` (EX-EXI-073), `specs-ateliers-besoins.md PARTIE 3` (EX-TRA-015 : quantités doublées sur 2 semaines de départ)
- Questions liées : Q-280
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : FAIT — le reçu se rattache au visuel, jamais au destinataire (Q-280)
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-17)

### RG-X-081 — « Rendre la main » : conséquences sur le dossier, les affiches reçues et la validation admin
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : « Rendre la main à la Pré-Prod » (RG-COO-243) repasse les dossiers à PREPA_RECUE et les unités non lancées à EN_ATTENTE ; les unités EN_PROD ne sont pas retirées. HYPOTHÈSE : les affiches reçues, leur rattachement et la validation admin ne sont pas modifiés par cette action (comme pour une préparation renvoyée, RG-X-078) ; la maquette n'indique rien d'autre (Q-COO-18).
- Déclencheur : « Rendre la main » (unitaire) / déblocage de préparation (coo1).
- Conditions : unités non EN_PROD.
- Effet / message d'erreur : statuts de dossier et d'unité ; les affiches restent rattachées.
- Sources : écran `ECR-COO-09b` ; spec `specs-existant-process.md §D` (EX-EXI-045), `specs-coordination.md §A` (EX-COO-001) ; maquette `maquettes-autres-modules.md §A`
- Questions liées : Q-267
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)

### RG-X-082 — Correction d'intitulé par la plateforme : feuille de stock à refaire et alerte Broadcast ≠ Circé
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique oui
- Énoncé : « Corriger l'intitulé » (RG-COO-244) pose `corrPlateforme` sur le thème (ce qui n'alerte pas « Broadcast ≠ Circé »), pose « Feuille à refaire » sur les affiches du thème (alerte `THEME_MODIF`, gravité à surveiller, dans le catalogue d'alertes) et envoie un mail à « Pré-Prod <site> » si la case est cochée ; la portée sur les feuilles de stock et les fichiers déjà envoyés est à préciser. Dans le cas d'une réception sans IP, l'intitulé saisi par la plateforme est conservé comme thème provisoire.
- Déclencheur : validation de la modale « Corriger l'intitulé ».
- Conditions : thème et annonceur non vides.
- Effet / message d'erreur : tag « Feuille à refaire » sur les affiches ; mail éventuel.
- Sources : écran `ECR-COO-09c`, `ECR-TRA-01` (`THEME_MODIF`) ; spec `specs-ateliers-besoins.md PARTIE 4` (EX-FIX-509), `PARTIE 1` (EX-REC-506) ; `maquettes-autres-modules.md §0.1`
- Questions liées : Q-268
- Implémentation : (rempli à l'étape 5/6/7)
- Tests : (rempli à l'étape 5/6/7)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — D-19 : le mail « correction d'intitulé » à la Pré-Prod est mis en file dans la transaction (MailPort, canal SIMULE : il n'est jamais réellement envoyé, Q-375 / Q-409) ; l'alerte « Broadcast ≠ Circé » n'est pas déclenchée par cette correction

### RG-X-083 — L'export des trains ne dépend ni de la validation admin ni de la réception complète
- Origine : NOUVELLE
- Modules : COO → REC
- Atomicité : transaction unique non
- Énoncé : l'export des trains du jeudi ne teste ni l'existence d'une validation admin, ni la complétude du reçu : seules comptent l'Instruction OK (automatique ou manuelle), l'absence d'annulation et la réception de la préparation (RG-COO-211). Les affiches arrivant après l'export sont proposées au rattachement puis confirmées par la Coordination, et les urgences du vendredi se traitent à la main ou par renvoi ; les chefs d'équipe peuvent démarrer avant le jeudi à leurs risques. Inversement, la validation admin n'attend pas l'Instruction OK (deux circuits indépendants).
- Déclencheur : export des trains ; réception d'affiche après export.
- Conditions : aucune condition sur `validationAdmin`.
- Effet / message d'erreur : aucun refus lié à la validation admin ou au reçu.
- Sources : spec `specs-coordination.md §A` (EX-COO-001), `§C` (EX-COO-024), `§D` (EX-COO-044 jalon 7) ; `specs-existant-process.md §E` (EX-EXI-054) ; écran `ECR-COO-05b`
- Questions liées : Q-251
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : FAIT
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-19)

### RG-X-084 — Création des UM, libération et préparation de l'unitaire indépendantes de la réception et de la validation admin
- Origine : CONSERVÉE
- Modules : COO → REC
- Atomicité : transaction unique non
- Énoncé : ni la création d'UM, ni la libération de la semaine, ni le passage « En cours → Préparé », ni l'arrivée de la ligne dans l'atelier ne sont conditionnés par la réception, le lien affiche ↔ ligne attendue ou la validation admin ; la liste des UM n'affiche que l'état de l'affiche reçue (oui / non, ✓ validée, • proposée) sans blocage. L'effet « UM du fixe et du pliage » de la validation admin est « non démontré » et a été corrigé le 02/11.
- Déclencheur : toute action de l'unitaire.
- Conditions : aucune.
- Effet / message d'erreur : aucune interaction bloquante ; la couverture (RG-X-079) pilote seulement EN_ATTENTE → PRET.
- Sources : legacy `p_s_listeUM_2m2.sql:36-62,113-142` (RG-RPR-024 : « la réception ne conditionne PAS la création d'UM ni le passage 1 → 6 ») ; spec `specs-coordination.md §B` (EX-COO-014), `§A` (EX-COO-001), `specs-existant-process.md §E` (EX-EXI-054)
- Questions liées : Q-265
- Implémentation : FAIT — unitaire.ts, unitaire-creation.ts, unitaire-affiches.ts (ÉTAPE 8 (2026-11-05) : Libérer, Colisage et Préparer ne lisent ni la réception ni la validation admin ; démontré sur des UM créées par « Colisage »)
- Tests : apps/api/test/coordination/liberation-colisage.int.test.ts (RG-X-084)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL (groupe Q-265) : HYPOTHÈSE Q-265 (option (c)) / Q-404, à valider par l'utilisateur ; preuve faible : un seul test d'indépendance + garde statique RG-COO-027, pas de test de rejet ; la cellule C-10 reste `it.todo` ; `ecarts-connus` retiré des tests

### RG-X-085 — Affiche arrivée après l'export ou le début de production : rattachement manuel du seul surplus
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : une affiche arrivée après l'export des trains (jalon 7) est d'abord « proposée » au rattachement puis confirmée par la Coordination ; les affiches reçues en plus pour un autre dossier se rattachent manuellement, avec historique, même après la validation ou le début de production, mais seul le surplus peut être rattaché ; pour une autre plateforme : transfert puis réception. La production en cours n'est pas modifiée (RG-COO-223).
- Déclencheur : réception d'affiche / rattachement manuel après export.
- Conditions : voir Énoncé.
- Effet / message d'erreur : rattachement historisé ; couverture recalculée sur les unités non EN_PROD.
- Sources : spec `specs-coordination.md §D` (EX-COO-044 jalon 7), `§E` (EX-COO-045)
- Questions liées : Q-280
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : FAIT — surplus rattaché à la main après export ; alerte ; trains figés (Q-280)
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-14, R-18)

### RG-X-086 — Visuel arrivé après le fractionnement : production à part
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : un visuel fractionné (RG-COO-221) n'est plus attendu dans le train d'origine ; à son arrivée il alimente une ligne de production à part (« ligne à part » ; « les visuels manquants seront produits à part »), sans réintégrer le train fractionné (déjà PRET / EN_PROD) ; pour un train non encore produit, l'atelier peut aussi raccrocher le visuel (RG-COO-222). Cas Nîmes : livraisons tardives.
- Déclencheur : réception d'un visuel dont la position est fractionnée.
- Conditions : position marquée fractionnée.
- Effet / message d'erreur : unité créée ou couverte ; indicateurs mis à jour.
- Sources : écran `ECR-COO-05`, `ECR-COO-05d` ; spec `specs-existant-process.md §C` (EX-EXI-036)
- Questions liées : Q-261
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : FAIT — visuel arrivé après le fractionnement : position fractionnée hors couverture, produite à part ; apps/api/src/modules/coordination/trains.ts:fractionnerTrains
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/broadcast-et-lignes.int.test.ts (B-05) ; apps/api/test/coordination/trains.int.test.ts
- Statut matrice (audit final, étape 10, 2026-11-06) : FAIT — preuve faible : tests B-05 et trains.int.test.ts, pas de test de rejet dédié (écart consigné)

### RG-X-087 — Sorties de stock déclenchées par l'expédition des unités
- Origine : MODIFIÉE
- Modules : COO → REC (stock par affiche, module STK)
- Atomicité : transaction unique oui
- Énoncé : cible : la quantité d'affiches est mise à jour à chaque événement : la réception est une entrée de stock ; la « fin de journée Geodis » (ou le scan Milk run à « Terminé ») est une sortie de stock des affiches préparées, avec mouvements négatifs « Expédition C-… » ; le rebut et la destruction sont aussi des sorties. Legacy : les sorties de stock sont générées par le scan des codes barre de fin de production (« douchage des étiquettes de prod »), mais pas à Nîmes (selon les ateliers) ; selon une autre source il n'y a aucune sortie automatique. La demande « scanner les codes barre et que Circé mette à jour les affiches produites et les stocks » contredit la cible (sortie à l'expédition).
- Déclencheur : « Fin de journée » (RG-COO-269) ; scan Milk run.
- Conditions : stock = somme des mouvements ; une seule sortie par unité expédiée.
- Effet / message d'erreur : mouvements de stock créés dans la même transaction que le passage à EXPEDIE.
- Sources : spec `specs-ateliers-besoins.md PARTIE 8` (EX-STK-001, EX-STK-005), `PARTIE 5` (EX-SCR-517), `specs-transverse.md §G` (EX-TRA-037), `specs-existant-process.md §F` (EX-EXI-076) ; écran `ECR-EXP-02`
- Questions liées : Q-281
- Implémentation : PARTIEL — apps/api/src/modules/coordination/colis.ts:sortiesStock ; apps/api/src/modules/reception/stock.ts:enregistrerMouvementAutomatique (COO-P13 (2026-11-05) : la fin de journée crée, DANS la même transaction que le passage à « Expédié », une sortie de stock « Expédition C-… » par UM expédiée (quantité uc_qte du colis), prélevée FIFO sur les affiches reçues du même dossier, de la même plateforme et du même thème (casse et accents ignorés), sans jamais rendre le stock négatif (manquant tracé STOCK_INSUFFISANT / AUCUNE_AFFICHE, Q-197 (9)) ; reste : ateliers déroulants (faces de train) : aucune sortie automatique, la quantité d'affiches par face n'est pas sourcée (Q-197 (8)) ; déclencheur « fin de journée » en attente de Q-281 (scan Milk run)) · ÉTAPE 7 (2026-11-05) — consolidé étape 7 : sortie prélevée sur l'affiche reçue par le BL ; réception absente / stock insuffisant testés ; échec de la sortie annule colis, UM et stock
- Tests : apps/api/test/coordination/colis.int.test.ts ; apps/api/test/interactions/coordination-vers-reception.int.test.ts (C-09) ; apps/api/test/interactions/atomicite.int.test.ts (A-07)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL — D-20 : la fin de journée est aussi exécutable par la tâche planifiée FIN_JOURNEE_COLIS, DÉSACTIVÉE par défaut (aucun horaire sourcé, Q-005) ; déclencheur « Milk run » : Q-281 ; sortie de stock dans la même transaction (testé, rollback A-07)

### RG-X-088 — Emplacement des affiches (allée, rayon) saisi à la réception et utilisé par les trains et le picking
- Origine : CONSERVÉE
- Modules : REC → COO
- Atomicité : transaction unique non
- Énoncé : l'emplacement (allée-rayon) renseigné à la réception sur l'affiche est affiché dans la fiche train (colonne « Emplacement des affiches »), dans le Suivi par thème (colonne Emplacement) et dans la liste de picking par rouleur (triée par emplacement, RG-COO-296) ; il est aussi porté sur l'étiquette rack (`allee`, `rayon`) et sur la fiche de picking legacy. Les réceptions inconnues sont rangées dans l'allée tampon « X ».
- Déclencheur : affichage / impression.
- Conditions : emplacement renseigné (sinon colonne vide).
- Effet / message d'erreur : lecture seule.
- Sources : écran `ECR-COO-05a`, `ECR-COO-06`, `ECR-COO-10` ; legacy `Rapport.cs:961-1025` (RG-ADM-062) ; maquette `maquettes-reception-coordination.md §1.4` (événement 4)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6/7) · ÉTAPE 7 (2026-11-05) : FAIT — allée / rayon saisis au contrôle lus (lecture seule) par la position du train ; apps/api/src/modules/coordination/trains.ts:ficheTrain (emplacement)
- Tests : (rempli à l'étape 5/6/7) ; apps/api/test/interactions/reception-vers-coordination.int.test.ts (R-22)
- Statut matrice (audit final, étape 10, 2026-11-06) : PARTIEL (avant : FAIT) — PARTIEL (preuve faible) : un seul test nominal (lecture de l'allée et du rayon sur la position du train), aucun test de rejet ; l'usage par le picking n'est pas démontré

## 6. Traitements automatiques
### Bloc 1
Les planifications et fréquences du legacy sont INCONNUES (aucun job versionné, Q-005) ; les fréquences ci-dessous sont des paramètres cibles issus des specs ou des HYPOTHÈSES notées. Acteur d'historique de tous ces traitements : « Circé (automatique) ». Tous sont idempotents, transactionnels (par dossier ou par flux) et journalisés (RG-COO-102, 116).

| ID | Traitement | Déclencheur / fréquence | Entrées → sorties | Règles | Source |
|---|---|---|---|---|---|
| T-COO-01 | Lecture de l'état des réservations Broadcast (copie S → S+8) | Planificateur API : toutes les 2 h de 8 h à 18 h, paramétrable (Q-211, Q-005) ; manuel `admin`/`coord` | `P_CirceEtatReservation_New` (EXTPLAY) → copie `tf_prepa_Broadcast` (colonnes conservées, `date_vue`) | RG-COO-083, 091, 092, 103 | [PP] §11 ; legacy `BatchAlimGetInstructionBc.cs:22-129` ; EX-EXI-012 |
| T-COO-02 | Alimentation des lignes attendues (BC puis PREPA) | Enchaîné après T-COO-01 | copie + répartitions fixe/pliage + faces déroulant → lignes attendues (upsert par clé, `ANNULEE` si plus vues) | RG-COO-080 à 090, 093 à 097 | [RA] §5 ; legacy `p_Alimentation_tf_prepa_affiche.sql` |
| T-COO-03 | Proposition de rattachement d'une affiche | Création d'une affiche (événement Réception) ; modification d'une ligne attendue | affiche + lignes actives → liens `PROPOSEE`/doute (mode BL/VISUEL) | RG-COO-004 à 007, 018 | [PP] §5 ; [RA] |
| T-COO-04 | Fermeture du visuel provisoire et déplacement d'affiches | Lecture avec IP saisies | ligne provisoire → `ANNULEE` ; lignes par thème ; liens déplacés ou proposés | RG-COO-084, 085, RG-X-056 | [RA] RG-AT-04 |
| T-COO-05 | Bascule BC → PREPA et alerte d'écart | Arrivée de la prépa (T-COO-07, T-COO-08) | ligne même clé → `source = PREPA`, `qte_prepa` ; alerte si ≠ `qte_bc` | RG-COO-086, 055, 067 | [RA] RG-AT-05 |
| T-COO-06 | Intégration des destinataires | Premier flux de chaque passage d'intégration | adresses actuelles ou futures → destinataires, adresses, transport par défaut | RG-COO-115, 118, 119, 120 | legacy `BatchAlimBll.cs:34-50` ; `p_integ_destinataire.sql` |
| T-COO-07 | Intégration des préparations fixe/pliage | Passage d'intégration (même fréquence que T-COO-01, Q-005) ; la prépa est envoyée le lundi | `P_ExportPrepaCirce` → `trav_preparation` → lignes de répartition (statut 0) ; accusé `MajStatutGroupePrepa` ; dossier → `PREPARATION_RECUE` | RG-COO-063, 121 à 125 | legacy `p_integ_preparation.sql` ; EX-EXI-017 |
| T-COO-08 | Intégration des trains d'affiches et des instructions (déroulant) | Passage d'intégration | faces + instructions → `tf_face_train`, `instruction_train` (EN_COURS), purge PEX | RG-COO-041, 126 à 131, 053 | legacy `p_integ_train_affiches.sql`, `p_integ_instructions.sql` ; EX-EXI-018 |
| T-COO-09 | Instruction OK automatique (règle de Nariman) | NON TRANCHÉ (Q-204) : (a) bouton « Instruction OK des dossiers conformes » le jeudi 14 h avant l'export, ou (b) à l'arrivée de la prépa avec réouverture avant l'export | instructions `EN_COURS` sans commentaire et exceptions = quantité → `INSTRUCTION_OK` (AUTO) | RG-COO-042, 043, 052, 054, 133 | [PP] §4, §10 ; legacy `p_batch_auto_instruction_ok.sql` (non déployée, Q-006) |
| T-COO-10 | Calcul des pastilles du dossier (préparation, validation admin) et de l'état des réservations | À chaque changement d'affiche, de ligne, de statut | affiches → états calculés | RG-COO-007, 019, 020, 107 | [PC] p.1 |
| T-COO-11 | Calcul des alertes de coordination | À chaque événement (réception, lecture Broadcast, validation) et au moins toutes les heures pour les échéances (deadline jeudi S-2 16 h, 24 h, départ S/S+1) | états → alertes (clé stable, gravité, destinataires), levée automatique quand la condition disparaît | RG-COO-033, 066 à 076 | ECR-TRA-01 ; [PC] p.2 |
| T-COO-12 | Mails d'alerte et de demande de correction (liste de distribution) | Après commit d'une action ou d'une alerte configurée « mail » | alerte → mail (rajout après préparation, thème modifié production lancée, demande de correction Broadcast, déblocage) | RG-COO-057, 068, 073, 147 | ECR-ADM-04 ; EX-TRA-029 |
| T-COO-13 | Retour vers Broadcast de la réception « reçue et associée » | Planifié (Q-211) | affiches (lien + validées) → `CIRCE_PEX_RECEPTION` (changements seulement) → transfert EXTPLAY | RG-COO-024, 134 | legacy `BatchAlimReceptionBll.cs` ; EX-TRA-039 |
| T-COO-14 | Dédoublonnage initial (reprise) | Migration, une fois | lignes en double → `ANNULEE`, liens reportés | RG-COO-090 | [RA] §4 |
| T-COO-15 | Rafraîchissement d'un dossier | Action manuelle | n° de dossier → `ope.P_ExportTrainAfficheTravailCirce` ; intégration au passage suivant | RG-COO-132 | legacy `AdminContratRepository.cs:21-37` |
| T-COO-16 | Journal de chargement des flux | À chaque flux | statut 1 → 0 / 2, message | RG-COO-116 | legacy `BatchAlimRepository.cs:29-97` |

### Bloc 2
Traitements automatiques du bloc 2. Les fréquences et plannings des batchs legacy sont INCONNUS (aucune planification dans le dépôt, legacy-integrations.md §6) ; elles ne sont donc pas des règles (Q-005).

| Traitement | Déclencheur / fréquence | Effet | Règles | Source |
|---|---|---|---|---|
| Calcul des trains (identifiant, version, position, thèmes, entretien, anti-doublons) | à la transition Instruction OK (automatique ou manuelle) | faces 0 / 1 / 3 → 2, faces d'entretien, annulation de faces en doublon | RG-COO-200 à 207 | `p_u_associe_train.sql` ; EX-COO-021 |
| Couverture des visuels et passage EN_ATTENTE ↔ PRET | à chaque réception, fractionnement, raccrochage, suppression de train, Instruction OK | statut d'unité recalculé, indicateurs A / B / C | RG-COO-208 ; RG-X-079, 080 | ECR-COO-05 ; EX-PIL-501 |
| Passage à « En production » | impression de bague / envoi du fichier à la machine | PRET → EN_PROD | RG-COO-223, 299 | ECR-COO-11a, ECR-GEN-03 |
| Alerte « Rajout après préparation » et mail de la liste de distribution | préparation reçue après libération / après préparation des trains | alerte importante + mail | RG-X-075, 076, 078 | EX-COO-503, EX-FIX-503 |
| Alerte « Dernière minute sur fichier envoyé » | modification Broadcast sur train EN_PROD | alerte critique + mail + trace sur le train | RG-X-077 | EX-COO-512 |
| Alerte de départ proche / surcharge (dispatch) | affichage / affectation | callouts 36 h, 115 % | RG-COO-295 | ECR-COO-10 |
| Alerte « Feuille de stock à refaire » | correction d'intitulé | tag sur les affiches + mail | RG-X-082 | ECR-COO-09c |
| Sorties de stock automatiques à l'expédition | fin de journée Geodis | mouvements négatifs « Expédition C-… » | RG-X-087 ; RG-COO-269 | ECR-EXP-02 ; EX-STK-001 |
| Fin de journée des colis (7 → 8) | batch quotidien (planification inconnue) / bouton | colis, UM, faces → 8 | RG-COO-269 | `p_batch_fin_journee_colis.sql` |
| Mail « colis expédié » | batch `BatchEnvoieMailColis` (planification inconnue) | mails managers / tiers + pièce jointe | RG-COO-271 | `BatchEnvoieMailColisBll.cs` |
| Intégration AMT des répartitions (doublons, transcodage, anomalies, purge) | flux SSIS `Flux_Repartition_Amt_Ptf` (phases 1 à 3, planification inconnue) | `tf_repart_calcul` | RG-COO-272 à 276 | `p_integ_ptf_reparts.sql`, `p_integ_ptf_purge.sql` (applicabilité : Q-274) |
| Reprise de l'afficheur par panneau (dernière minute) | intégration des faces de trains | afficheurs alignés par `RefPanel` | RG-COO-207 | `p_integ_train_affiches.sql:111-117` |
| Historisation des changements de statut | à chaque transition | ligne d'historique | RG-COO-307 | CLAUDE.md §6 |
| (Hors bloc, cité) Instruction OK automatique, alimentation des attendues, copie de l'état des réservations, alertes de préparation, déblocage de préparation | voir coo1 | — | `RG-COO-1xx` | coo1 |

## 7. Messages (confirmation / erreur)
### Bloc 1
Messages exacts de la maquette ou du legacy lorsqu'ils sont connus ; les textes marqués « (à définir) » sont proposés sans source et à valider.

| Code | Message | Règle |
|---|---|---|
| COO_VA_BANDEAU | Aucune validation sans vous : Circé propose, vous confirmez | RG-COO-002 |
| COO_VA_RIEN_A_VALIDER | Rien à valider : les dossiers choisis n'ont aucune affiche à confirmer (validation admin déjà faite, ou aucune affiche reçue). | RG-COO-013 |
| COO_VA_RIEN_DANS_SELECTION | Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n'est encore arrivée. | RG-COO-013 |
| COO_VA_CONFIRMER_DOUTES | n affiche(s) sans doute et m affiche(s) à doute sont dans la sélection. Rien n'est validé sans vous… | RG-COO-012 |
| COO_VA_CONFIRMER_SANS_DOUTE | Confirmer les n sans doute seulement | RG-COO-012 |
| COO_VA_CONFIRMER_TOUT | Confirmer tout (n) | RG-COO-012 |
| COO_VA_DOUTES_NON_CONFIRMES | Des affiches à doute sont dans la sélection : confirmez-les explicitement ou retirez-les. (à définir) | RG-COO-012 |
| COO_VA_CONFIRMEES | n affiche(s) confirmée(s) par la Coordination : n° d'affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé. | RG-COO-008, 010 |
| COO_VA_RESERVE | Réservé à la Coordination : choisissez le rôle « Coordination » en haut de page pour valider | RG-COO-009 |
| COO_VA_DEJA_VALIDEE | Cette affiche est déjà validée. (à définir) | RG-COO-008 |
| COO_VA_NON_VALIDEE | Cette affiche n'est pas validée : rien à annuler. (à définir) | RG-COO-014 |
| COO_VA_MOTIF_BL | Rattachée sans le n° du BL | RG-COO-006 |
| COO_VA_MOTIF_FORMAT | Format différent | RG-COO-006 |
| COO_VA_MOTIF_THEME | Plusieurs thèmes possibles | RG-COO-006 |
| COO_VA_MOTIF_MULTI | Répartition à confirmer | RG-COO-006 |
| COO_VA_MOTIF_SANS_IP | IP pas saisies | RG-COO-006 |
| COO_VA_MOTIF_ANNULEE | Validation annulée : à refaire | RG-COO-006, 014 |
| COO_RATT_AUCUN_DOSSIER | Choisissez au moins un dossier et une quantité. | RG-COO-088, RG-X-051 |
| COO_RATT_DEPASSE | La répartition (n) dépasse la quantité reçue (m). | RG-COO-088, RG-X-051, RG-X-052 |
| COO_IOK_FAITES | n dossier(s) en Instruction OK : Circé répartit les visuels sur les trains et crée l'entretien. Les trains partent à l'export du jeudi 14 h (Liste des trains). | RG-COO-044 |
| COO_IOK_REPARTITION | La répartition des thèmes n'est pas à 100 % ! | RG-COO-043 |
| COO_IOK_PREPA_ABSENTE | L'Instruction OK n'est possible qu'après réception de la préparation. (à définir) | RG-COO-052 |
| COO_IOK_ENTRETIEN_GELE | Entretien repris de Broadcast : modifiable seulement quand l'Instruction OK se fait après contrôle (dossier « En cours »). | RG-COO-047, 048 |
| COO_TRANSITION_INTERDITE | Transition de statut interdite : <statut> → <statut>. (à définir) | RG-COO-040 |
| COO_BC_DEMANDE_DEJA | Une demande est déjà partie le … Le mail sera renvoyé. | RG-COO-057 |
| COO_BC_PROD_LANCEE | Production lancée — Prévenez aussi l'atelier | RG-COO-057 |
| COO_BC_MAIL_OBJET | [Circé] Correction à faire dans Broadcast : dossier n (annonceur) | RG-COO-057 |
| COO_THEME_REPRIS | Thème « … » repris de Broadcast pour le dossier … Production lancée : l'atelier est prévenu. | RG-COO-068 |
| COO_THEME_DEMANDE_ENVOYEE | Demande envoyée pour n dossier(s) : mail au gestionnaire… | RG-COO-069 |
| COO_THEME_DIFFERENTS | Noté : ce sont des visuels différents. L'alerte est levée. | RG-COO-069 |
| COO_ANNONCEUR_DIFFERENTS | Noté : ce sont des annonceurs différents… | RG-COO-070 |
| COO_THEME_RIEN_A_DEMANDER | Rien à demander… Voir avec l'atelier | RG-COO-069 |
| COO_ALERTE_DOSSIER_INTROUVABLE | Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… | RG-X-054 |
| COO_DEBLOC_NON_DEBLOCABLE | Le groupe de preparation n'est pas déblocable ! | RG-COO-143, 144 |
| COO_DEBLOC_PERIODE | La date de fin doit être supérieur à la date de début ! | RG-COO-149 |
| COO_DEBLOC_RECHERCHE_VIDE | Saisissez un n° de préparation ou un n° de dossier. (à définir) | RG-COO-140 |
| COO_ALIM_INTERFACE_ABSENTE | IdInterface non récupéré ! | RG-COO-115 |
| COO_ALIM_ERREUR_PREPA | Erreur dans la procédure : p_integ_preparation ! | RG-COO-125 |
| COO_ALIM_ERREUR_DEROULANTS | Erreur dans la procédure : p_integ_deroulants ! | RG-COO-131 |
| COO_ALIM_EN_COURS | Un passage d'alimentation est déjà en cours. (à définir) | RG-COO-102 |
| COO_PERMISSION | Action réservée à la Coordination et aux administrateurs. (à définir ; code `PERMISSION`, `regle` = RG violée) | RG-COO-009, 165, 168 |
| COO_LECTURE_SEULE | Rôle en lecture seule : aucune action n'est possible. (à définir) | RG-COO-168 |
| COO_VIDE_FILTRES | Aucune ligne pour ces filtres. | RG-COO-060 |
| COO_VIDE_THEMES_PROCHES | Aucun thème proche à vérifier avec ces filtres. | RG-COO-069 |
| COO_VIDE_ANNONCEURS | Aucun annonceur proche à vérifier avec ces filtres. | RG-COO-070 |
| COO_VIDE_THEME_BC | Aucun thème modifié dans Broadcast avec ces filtres : Broadcast et Circé ont les mêmes thèmes. | RG-COO-068 |
| COO_PREPA_PAS_ENVOYEE | Préparation pas encore envoyée de Broadcast. | RG-COO-063 |

### Bloc 2
Les messages marqués (legacy) sont repris à l'identique du code ; les messages (maquette) de l'écran cible ; (à définir) = libellé proposé, non source. Les erreurs sont renvoyées au format `{ code, message, details?, regle? }` avec `regle` = ID de la RG violée.

| Code | Message | Règle |
|---|---|---|
| COO2_TRAIN_EN_PRODUCTION | Train déjà en production : impossible de le modifier (point de non-retour). (maquette) | RG-COO-223 |
| COO2_AUCUN_FRACTIONNABLE | Aucun train fractionnable (il faut au moins un visuel reçu). (maquette) | RG-COO-221 |
| COO2_FRACTIONNE_OK | n train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part. (maquette) | RG-COO-221 |
| COO2_FRACTIONNEMENT_STATUT | Le statut du thème ne permet pas le fractionnement ! (legacy) | RG-COO-221 |
| COO2_PAS_DE_DONNEES | Pas de données à traiter ! (legacy) | RG-COO-221 |
| COO2_TRAIN_COMPLET | Train complet (maquette) | RG-COO-209, 222 |
| COO2_RACCROCHAGE_MASSE | n train(s) recevront ce visuel (maquette) | RG-COO-222 |
| COO2_CHOISIR_VISUEL_DEST | Choisissez un visuel et un destinataire. (maquette) | RG-COO-224 |
| COO2_SELECTION_N_TRAINS | n train(s) sélectionné(s), sur m ligne(s)… la ligne suivante en compte k et dépasserait N. (maquette) | RG-COO-227 |
| COO2_ANNULATION_THEME_STATUT | Le statut du thème ne permet pas l'annulation ! (legacy) | RG-COO-219 |
| COO2_ANNULATION_THEME_FACES | Toutes les faces du theme ne sont pas dans le statut 'A Imprimer' (legacy) | RG-COO-219 |
| COO2_DEBLOQUER_SEMAINE_VIDE | Il n'y a pas de données à traiter ! (legacy) | RG-COO-220 |
| COO2_DEBLOQUER_SEMAINE_STATUT | Toutes les données ne sont pas au statut 'A imprimer' ! (legacy) | RG-COO-220 |
| COO2_CHANGER_STATUT_FACES | Toutes les faces des trains ne sont pas dans le statut 'Au roulage' ou 'Export prépa' ! (legacy) | RG-COO-218 |
| COO2_EXPORT_PREPA_STATUT | Les faces des trains ne sont pas dans le statut 'A imprimer' ! (legacy) | RG-COO-215 |
| COO2_EXPORT_CAPACITE | Le nombre de thèmes ajouté est supérieur à la capacité de la machine ! (legacy) | RG-COO-216 |
| COO2_EXPORT_RIEN | Aucun dossier en Instruction OK à exporter (à définir ; bouton Exporter désactivé si 0) | RG-COO-211 |
| COO2_EXPORT_OK | n dossier(s) en Instruction OK : leurs faces passent « A imprimer », le go des plateformes. (maquette) | RG-COO-211 |
| COO2_EXPORT_ERREUR | L'export a échoué : aucun statut n'a été modifié (à définir ; le legacy masque l'erreur) | RG-COO-213 |
| COO2_COUVERTURE | Visuel manquant : le train reste « En attente d'affiches » (à définir) | RG-COO-208 |
| COO2_LIBERATION_OK | S44 libérée vers l'atelier … Les préparations reçues ensuite déclencheront une alerte et un mail. (maquette) | RG-COO-240 |
| COO2_LIBERATION_DEJA | Cette semaine est déjà libérée pour cet atelier (à définir) | RG-COO-240 |
| COO2_RENDRE_MAIN_PROD | n unité(s) déjà en production — Elles ne seront pas retirées (point de non-retour) (maquette) | RG-COO-243 |
| COO2_INTITULE_VIDE | Le thème et l'annonceur ne peuvent pas être vides. (maquette) | RG-COO-244 |
| COO2_INTITULE_INCHANGE | Rien n'a changé. (maquette) | RG-COO-244 |
| COO2_8M2_VALEUR | Valeur invalide : un nombre supérieur ou égal à 0 est attendu (à définir) | RG-COO-237 |
| COO2_COMPTAGE_OK | Comptage conforme. (maquette) | RG-COO-247 |
| COO2_COMPTAGE_ECART | Écart de comptage : n affiche(s). Alerte qualité créée. (maquette) | RG-COO-247 |
| COO2_TRANSITION_INTERDITE | Transition de statut interdite (à définir ; 409, `regle` = RG de la table de transitions) | RG-COO-307 |
| COO2_CONFLIT_VERSION | La donnée a été modifiée par un autre utilisateur : actualisez (à définir ; 409) | RG-COO-308 |
| COO2_UM_STATUT | L'UM n'existe pas ou n'est pas en cours ou préparée (legacy) | RG-COO-265 |
| COO2_UM_DEST | Le destinataire de l'UM ne correspond pas à celle du colis (legacy) | RG-COO-265 |
| COO2_UM_DEJA_COLIS | L'UM à ajouter existe déjà dans le colis (legacy) | RG-COO-265 |
| COO2_UM_DEST_ATELIER | Le destinataire des UMs est différent de celui du colis ! (legacy) | RG-COO-265 |
| COO2_UM_CODE_INCONNU | Code inconnu : X (maquette EXP) | RG-COO-265 |
| COO2_UM_NON_PRODUIT | … n'est pas « Produit » (statut : …) (maquette EXP) | RG-COO-265 |
| COO2_TRAIN_DEJA_COLIS | Il existe déjà un train dans ce colis (legacy) | RG-COO-270 |
| COO2_TRAIN_DEST_COLIS | Le destinataire du train ne correspond pas à celui du colis (legacy) | RG-COO-270 |
| COO2_COLIS_EXPEDITION | Problème lors de l'expédition (legacy) | RG-COO-268 |
| COO2_COLIS_FIN_JOURNEE | Le colis expédié (legacy, action unitaire de fin de journée) | RG-COO-269 |
| COO2_UM_DANS_COLIS | L'UM est dans un colis : retrait impossible (à définir ; le legacy échoue par contrainte étrangère) | RG-COO-249 |
| COO2_REPART_TRANSITION | Seules les répartitions à traiter peuvent être placées dans une UM (à définir) | RG-COO-262 |
| COO2_DEBLOCAGE_REFUSE | Le groupe de preparation n'est pas déblocable ! (legacy) | RG-COO-277 |
| COO2_DOUBLON_REPART | Doublon envoie : <rpfo> (legacy, `tt_log`) | RG-COO-272 |
| COO2_BAGUE_AUCUNE_PRETE | Aucune unité « Prêt à produire » dans la sélection. (maquette) | RG-COO-299 |
| COO2_BAGUE_MOTIF | Motif de réimpression obligatoire (à définir) | RG-COO-301 |
| COO2_DISPATCH_REPARTI | Répartition proposée : n trains sur m rouleurs. (maquette) | RG-COO-293 |
| COO2_DISPATCH_AUCUN_ATELIER | Aucun atelier déroulant sur ce site. (maquette) | RG-COO-291 |
| COO2_ATELIER_ABSENT | Pas d'atelier « X » sur ce site. Choisissez « Tous les sites » ou un autre site en haut de page. (maquette) | RG-COO-291 |
| COO2_TRAIN_DOUBLON_6 | Train supérieur à 6 pour le TrainId (legacy, `tt_log` module « CIRCE - Export Surf ») | RG-COO-213 |

