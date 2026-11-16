### RG-X-001 — Valider la réception : proposition de rattachement / validation admin
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui (dans RG-REC-046)
- Énoncé : à « Valider la réception », Circé PROPOSE pour chaque affiche créée le rattachement à la ligne attendue (aidé du BL : n° de dossier ou de DA, format, plateforme, semaine, visuel) et pose la validation admin à « À confirmer : proposé » (cas sûr, pré-coché) ou « À confirmer : doute » (motif). Rien n'est validé sans une personne ; nom et date tracés (option A du 02/11, hypothèse retenue avec la cheffe de projet). Les définitions (cas sûr, motifs, confirmation en lot) sont propriété de RG-COO (validation admin).
- Déclencheur : validation d'une réception (voie dossier connu).
- Conditions : cas sûr = rattachée à une ligne active, n° lu = celui de la ligne, même format, un seul thème possible (ou visuel du BL), un seul dossier ; sinon doute.
- Effet / message d'erreur : ligne dans « Validation admin et Instruction OK » ; alerte « Validation admin à confirmer » pour un doute (grave départ S/S+1) ; historique « Rattachement proposé… à confirmer par la Coordination ».
- Sources : spec `[PP] §5`, `[RA]` (EX-COO-004, 006, 007, 008, 015) ; `[DC] §4, §15` (EX-REC-014) ; ateliers EX-COO-506/507 (3 événements : remplacés par option A) · écran ECR-REC-01 ; ECR-COO-01
- Questions liées : Q-125, Q-136
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-002 — Motifs de doute posés par la Réception
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : la Réception fournit à la Coordination : mode de rattachement (BL / VISUEL / MAIN), format du BL ≠ format de la ligne, plusieurs thèmes possibles, répartition à confirmer (visuel de plusieurs dossiers), IP non saisies, validation annulée. Doutes jamais pré-cochés.
- Déclencheur : rattachement.
- Conditions : au moins un motif.
- Effet / message d'erreur : statut VALIDATION_ADMIN.A_FAIRE_DOUTE avec motifs.
- Sources : spec `[PP] §5`, `[PC]` (EX-COO-007) ; RG-REC-032
- Questions liées : Q-136
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-003 — Réception : unités en attente → prêtes à produire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Valider la réception » (et rattachement d'une inconnue) fait passer « prêt à produire » les unités en attente de ces affiches (EN_ATTENTE → PRET quand les affiches attendues sont toutes reçues) ; recalcul automatique dans les deux sens.
- Déclencheur : réception, rattachement, retrait.
- Conditions : toutes les affiches d'une unité reçues.
- Effet / message d'erreur : « n unité(s) prête(s) à produire ».
- Sources : spec `[DC] §4, §15` (EX-REC-014) · écran ECR-REC-01 ; `maquettes-autres-modules.md §0.1`
- Questions liées : Q-102
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-004 — Statut de la ligne attendue et n° d'affiche lus par la Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : tout événement de réception recalcule le statut de la ligne attendue (RG-REC-018) et le n° d'affiche visible dans l'état des réservations dès la réception (• à confirmer, ✓ validée), dans le suivi de prod dès la prépa.
- Déclencheur : réception, contrôle, rattachement.
- Conditions : —
- Effet / message d'erreur : colonnes Reçu / Reste / N° d'affiche mises à jour.
- Sources : spec `[README] §3` ; EX-COO-014, 048
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-005 — « Affiche reçue » indépendant de la validation admin
- Origine : MODIFIÉE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Aff. reçues » de l'état des réservations passe à « oui » à la réception physique, sans attendre la validation admin (corrige ANO-05 : legacy = oui seulement après validation).
- Déclencheur : validation de réception.
- Conditions : —
- Effet / message d'erreur : indicateur lu par EDR/suivi.
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:183-187` (RG-COO-028) · spec EX-REC-052, EX-REC-503, EX-EXI-055
- Questions liées : Q-104
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-006 — Réception inconnue créée → alerte Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : création d'une réception inconnue → alerte immédiate « Réception inconnue à identifier » à la Coordination et à la Réception ; pas de mail ; badge du menu Réceptions inconnues.
- Déclencheur : RG-REC-099.
- Conditions : —
- Effet / message d'erreur : alerte ; compteur.
- Sources : spec `[DC] §7, §11` (EX-REC-036, 066) ; EX-COO-017, 047
- Questions liées : Q-110
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-007 — Rattachement d'une inconnue : validation selon le rôle
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : rattachée par la Coordination = validation admin faite ; par la réception = reste « à confirmer ».
- Déclencheur : « Rattacher ».
- Conditions : rôle.
- Effet / message d'erreur : voir RG-REC-111.
- Sources : spec `[DC] §7` ; EX-COO-010, 017
- Questions liées : Q-107
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-008 — « Dossier introuvable » → alerte Coordination du site
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Signaler » → alerte grave à la Coordination du site (Wissous : équipe Coord. Réception de Boulogne ; Nîmes : Pré-Prod Nîmes ?) ; la Pré-Prod corrige dans Broadcast ; sans mail.
- Déclencheur : RG-REC-112.
- Conditions : —
- Effet / message d'erreur : alerte ; statut introuvable.
- Sources : spec `[DC] §3, §7, §11` (EX-REC-041, 067) ; EX-COO-017
- Questions liées : Q-110
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-009 — Réception sur un dossier sans IP → alerte Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : réception sur un dossier dont les IP ne sont pas saisies → alerte grave à la Coordination, qui prévient la Pré-Prod ; persiste tant que les IP manquent.
- Déclencheur : validation de réception sans IP.
- Conditions : IP non saisies.
- Effet / message d'erreur : alerte.
- Sources : spec `[PC] p.2`, `[DC] §11` (EX-COO-031, EX-REC-065)
- Questions liées : Q-111
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-010 — Affiche ou visuel arrivé après la préparation ou la libération
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : un visuel qui arrive après la préparation des trains (déroulant) ou un dossier fixe après la libération de la semaine déclenche une alerte (« Rajout après préparation », grave) vers Coordination/chefs d'équipe, avec mail à la liste de distribution ; pas de raccrochage automatique dans le train.
- Déclencheur : événement de réception/arrivée.
- Conditions : préparation/libération déjà faite.
- Effet / message d'erreur : alerte `APRES_LIBERATION`.
- Sources : spec `[README] §3` (Simuler 1, 2) ; ateliers EX-COO-503, EX-REC-505 ; EX-COO-044
- Questions liées : Q-131
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-011 — Affiche reçue après l'export des trains
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : après l'export du jeudi 14 h, une affiche arrivée est proposée puis confirmée ; les trains restent figés ; urgences du vendredi à la main ou renvoi.
- Déclencheur : réception après export.
- Conditions : trains exportés.
- Effet / message d'erreur : alerte.
- Sources : spec `[PP] §2` (EX-COO-044)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-012 — Thème changé après réception → validation à refaire, feuille à refaire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : thème changé (fiche affiche) : tag « Feuille à refaire » et alerte ; validation à refaire si non-coord (reste validée si coord) ; thème changé après validation : alerte (Q55 source : proposition non tranchée).
- Déclencheur : « Changer de thème… ».
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[RA]` (EX-COO-016) ; `[DC] §10` (EX-REC-062)
- Questions liées : Q-143
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-013 — Retrait d'un rattachement : recalculs
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : retrait (ou dernier dossier retiré) : recalcul du reçu et du statut de la ligne, des unités (PRET ↔ EN_ATTENTE), de la validation admin (annulée) ; l'affiche redevient orpheline et la réception A_IDENTIFIER.
- Déclencheur : RG-REC-137.
- Conditions : —
- Effet / message d'erreur : historique.
- Sources : spec `[DC] §8` ; ECR-REC-05
- Questions liées : Q-108
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-014 — Rattachement manuel vaut validation si Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : rattachement manuel (fiche, changement de thème) par `coord` = validation admin ; sinon « à confirmer ».
- Déclencheur : RG-REC-135, 136.
- Conditions : rôle.
- Effet / message d'erreur : voir RG-REC-111.
- Sources : spec `[DC] §7` ; maquette reception.js
- Questions liées : Q-107
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-015 — Valider / Annuler la validation depuis la fiche affiche
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : « Valider » depuis la fiche affiche équivaut à la validation admin de RG-COO (même effets : n° d'affiche au suivi, retour `EstAssociee` à Broadcast, étiquette rack, sortie de « à traiter ») ; « Annuler la validation » les inverse.
- Déclencheur : boutons.
- Conditions : rôle coord/admin (RG-REC-003).
- Effet / message d'erreur : historique par/le.
- Sources : spec EX-COO-009, 014
- Questions liées : Q-162
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-016 — Rattachement plusieurs-à-plusieurs : reçu compté une fois
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : un visuel commun à plusieurs dossiers : une ligne par dossier, surplus proposé à l'autre dossier, la Coordination confirme ; reçu compté une fois (dossiers multi-semaines).
- Déclencheur : rattachement.
- Conditions : —
- Effet / message d'erreur : « répartition à confirmer ».
- Sources : spec `[PP] §6`, `[RA]` (EX-COO-045, 039)
- Questions liées : Q-123
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-017 — Écart de contrôle → recalcul et alerte
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : le contrôle corrigeant la quantité recalcule reçu, statut de ligne, unités ; alerte écart > 10 % ; la quantité n'est pas condition de validation.
- Déclencheur : RG-REC-059/069.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §5` ; EX-COO-011
- Questions liées : Q-133
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-018 — Réception partielle : reste et alerte
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : partielle : validée pour ce qu'elle contient ; le reste garde l'alerte « Visuel reçu en partie » ; le complément est proposé puis confirmé à sa réception.
- Déclencheur : réception partielle.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec EX-COO-011 ; EX-REC-059
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-019 — Dossier livré sur deux plateformes
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : une ligne attendue par plateforme ; les destinataires ne multiplient pas les lignes ; une affiche et sa ligne sont sur la même plateforme.
- Déclencheur : rattachement.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-024.
- Sources : spec EX-COO-045 ; EX-REC-015
- Questions liées : Q-139
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-020 — Réception avant IP : ligne provisoire
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : avant les IP l'affiche se rattache à la ligne au visuel « provisoire » ; aux IP elle est fermée et les lignes par thème créées ; l'affiche est déplacée seule s'il n'y a qu'un thème possible, sinon la Coordination choisit ; aucun candidat : alerte.
- Déclencheur : arrivée des IP.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[RA]` (EX-COO-035)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-021 — Compteurs des menus Coordination
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique non (calcul de lecture)
- Énoncé : les événements de réception alimentent les badges : réceptions inconnues, Validation admin et Instruction OK (dossiers avec quelque chose à faire).
- Déclencheur : événement.
- Conditions : —
- Effet / message d'erreur : compteur.
- Sources : maquette `core.js:373-434`
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-022 — Retour vers Broadcast : affiche reçue et associée
- Origine : CONSERVÉE
- Modules : REC → COO
- Atomicité : transaction unique non (batch)
- Énoncé : affiche « associée » envoyée à Broadcast seulement si liée ET validée admin ; retour de la cible à définir.
- Déclencheur : batch (RG-REC-199).
- Conditions : —
- Effet / message d'erreur : `EstAssociee`.
- Sources : legacy `BatchAlimReceptionBll.cs:89` · spec EX-TRA-039
- Questions liées : Q-151
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-028 — Circuits indépendants : réception et prépa
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique non
- Énoncé : la réception et le contrôle n'attendent ni la prépa ni l'Instruction OK ; l'Instruction OK n'attend pas la validation admin ; fixe comme scro.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucune dépendance bloquante.
- Sources : spec `[PC] p.1` (EX-COO-001, 026) ; legacy EX-EXI-054
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-X-030 — Rattachement d'une inconnue à plusieurs dossiers
- Origine : NOUVELLE
- Modules : REC → COO
- Atomicité : transaction unique oui
- Énoncé : répartition sur 1..n dossiers (plusieurs semaines) → motif « Répartition à confirmer » si visuel de plusieurs dossiers.
- Déclencheur : « Rattacher » multi-dossiers.
- Conditions : > 1 dossier.
- Effet / message d'erreur : doute.
- Sources : spec EX-COO-007 ; ECR-REC-04
- Questions liées : Q-124
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
