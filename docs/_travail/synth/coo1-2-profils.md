Rôles provisoires (Q-003, CLAUDE.md §8) = les 6 rôles de la maquette. Mapping sur les 27 droits legacy (`CommunBll.Droits`, `tr_utilisateur_menu`) : `validation_admin`, `debloque_repart`, `view_repart`, `train_rafraichir_contrat`, `suivi_suivi_production`, `pliage_a_traiter` → `coord` + `admin` (écriture), lecture `cheq`/`com`/`recep` selon l'écran ; `reception_liste_affiche`, `Zone_Picking`, `fusion_affiche` → rôle Réception (autre module) ; droits `pliage`, `train_*`, `duplication_train`, `_2m2_fixe*`, `bus*` → coo2. Aucun droit legacy n'est contrôlé côté serveur : tous les contrôles ci-dessous le sont dans le service (RG-COO-165). Le périmètre site/atelier (`tr_utilisateur_data`) s'applique à toutes les lignes (RG-COO-167). Cellules : ✔ autorisé · ✘ refusé · ✔(cond.) avec condition · ? avec Q.

| Action | coord | cheq | recep | expe | admin | com | Source |
|---|---|---|---|---|---|---|---|
| Consulter « Validation admin et Instruction OK » (liste, fiche dossier) | ✔ | ✔ (lecture) | ✔ (lecture, fiche affiche) | ✘ | ✔ | ✔ (lecture) | maquette `roles` (coord, admin primaires ; autres « secondaires », grisés sans interdiction : Q-B) ; RG-COO-166 ; Q-201 |
| Valider une affiche / « Valider la sélection » | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-009 ; legacy `validation_admin` ; [README] §3, H1 ; Q-COO-6 (admin ≡ coord) ; Q-201 |
| Annuler la validation | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-014 ; maquette Q-COO-5 ; Q-201 |
| Rattacher une réception inconnue / rattachement manuel (fiche affiche) | ✔ (vaut validation) | ? Q-201 | ✔(cond.) : rattachement seul, reste « À confirmer » | ✘ | ✔ (vaut validation) | ✘ | RG-COO-017, RG-X-051, RG-X-063 ; ECR-REC-04 (Q-REC-18) ; legacy `validation_admin` (boutons associer/dissocier) |
| Signaler « Dossier introuvable » | ✔ | ✘ | ✔ | ✘ | ✔ | ✘ | RG-X-054 ; EX-REC-041 |
| Instruction OK (après contrôle) / Instruction OK automatique (lancement manuel du traitement, option a Q-204) | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ | RG-COO-044, 042 ; maquette `instructions.js` ; Q-204 |
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
