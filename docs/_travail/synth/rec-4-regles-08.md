### RG-REC-176 — Ce qui se calcule ne se coche jamais
- Origine : NOUVELLE
- Énoncé : Circé pose chaque statut et chaque tag lui-même à chaque événement ; aucun tag n'est coché à la main ; les statuts sont calculés une fois et lus par tous les écrans.
- Déclencheur : tout événement.
- Conditions : —
- Effet / message d'erreur : aucune route d'écriture d'un tag.
- Sources : spec `[DC] §9` (EX-REC-050, 051)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-178 — Paramètres « Règles métier › Réception »
- Origine : NOUVELLE
- Énoncé : paramètres : écart signalé 10 % ; purge des attendues 4 semaines (sauf conservation à l'année) ; délai de contrôle du sas 24 h ; comptage par morceau < 30 ; exemplaires de feuille 2 (1 à 5) ; allée des réceptions inconnues X. Valeurs minimales appliquées ; changement s'applique aux prochains traitements.
- Déclencheur : écran Administration.
- Conditions : rôle admin.
- Effet / message d'erreur : « Seuil enregistré (s'applique aux prochaines préparations). ».
- Sources : spec `[DC] §11` (EX-REC-073) · écran ECR-ADM-05
- Questions liées : Q-105
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-179 — Référentiels Imprimeurs, Livreurs, Agents de réception
- Origine : NOUVELLE
- Énoncé : trois référentiels dans Administration (lot 0), utilisés par « Contrôleur » et « Déchargé par » ; ajout par l'administrateur.
- Déclencheur : écran Administration.
- Conditions : rôle admin.
- Effet / message d'erreur : voir RG-REC-035.
- Sources : spec `[DC] §11, §15` (EX-REC-074 ; EX-ADM-501) · écran ECR-ADM-07
- Questions liées : Q-115
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-180 — Purge automatique des réceptions attendues
- Origine : NOUVELLE
- Énoncé : les lignes attendues Attendue/Partielle de plus de 4 semaines sont purgées automatiquement, sauf « conservation à l'année ». Legacy : les lignes « venues de Broadcast » ne sont jamais purgées.
- Déclencheur : traitement planifié.
- Conditions : ancienneté > `purgeAttendues` ; non conservée.
- Effet / message d'erreur : voir RG-REC-181.
- Sources : spec `[DC] §11, §12` (EX-REC-075) ; ateliers EX-REC-512
- Questions liées : Q-130
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-181 — Purge sans alerte, une ligne au journal
- Origine : NOUVELLE
- Énoncé : la purge ne lève aucune alerte, n'exige aucune validation, écrit une ligne au journal.
- Déclencheur : purge.
- Conditions : —
- Effet / message d'erreur : « n réception(s) attendue(s) purgée(s). ».
- Sources : spec `[DC] §11, §12` (EX-TRA-032)
- Questions liées : Q-130
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-182 — Alerte « Visuel non reçu / reçu en partie »
- Origine : NOUVELLE
- Énoncé : départ en S : critique si rien reçu, grave si partiel ; S+1 : à surveiller ; destinataires chefs d'équipe, Coordination, Réception ; bandeau et résumé à 7 h.
- Déclencheur : traitement périodique.
- Conditions : ligne Attendue/Partielle selon la semaine de départ.
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-063) · écran ECR-TRA-01
- Questions liées : Q-131, Q-132
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-183 — Alerte « Écart de réception supérieur à 10 % »
- Origine : NOUVELLE
- Énoncé : « à surveiller » ; Réception et Coordination ; levée quand l'écart dépasse le seuil à la réception ou au contrôle.
- Déclencheur : validation de réception ; contrôle.
- Conditions : écart > 10 %.
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-064) ; ateliers EX-REC-519
- Questions liées : Q-133
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-184 — Alerte « Réception sans instructions de pose »
- Origine : NOUVELLE
- Énoncé : grave ; Coordination (qui prévient la Pré-Prod) ; bandeau (et mail selon canal).
- Déclencheur : réception sur dossier sans IP.
- Conditions : IP non saisies.
- Effet / message d'erreur : alerte ; libellé varie selon sources.
- Sources : spec `[DC] §11` (EX-REC-065) ; EX-COO-031
- Questions liées : Q-111
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-185 — Alerte « Réception inconnue à identifier »
- Origine : NOUVELLE
- Énoncé : dès la création ; importante après 24 h ; Coordination et Réception ; pas de mail.
- Déclencheur : création d'une réception inconnue.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §7, §11` (EX-REC-066)
- Questions liées : Q-110
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-186 — Alerte « Dossier introuvable »
- Origine : NOUVELLE
- Énoncé : grave dès le signalement ; Coordination du site ; sans mail.
- Déclencheur : « Signaler ».
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-067)
- Questions liées : Q-110
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-187 — Alerte « Feuille de stock définitive à imprimer »
- Origine : NOUVELLE
- Énoncé : après rattachement d'une réception inconnue, tant que la feuille n'est pas imprimée ; destinataire : Réception de la plateforme.
- Déclencheur : rattachement.
- Conditions : feuille temporaire posée.
- Effet / message d'erreur : alerte levée à l'impression.
- Sources : spec `[DC] §11` (EX-REC-068)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-188 — Alerte « Feuilles de stock à refaire »
- Origine : NOUVELLE
- Énoncé : thème ou rattachement changé ; à surveiller ; Réception et Coordination.
- Déclencheur : changement de thème.
- Conditions : —
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-069) ; ateliers EX-REC-520
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-189 — Alerte « Palette à contrôler depuis plus de 24 h »
- Origine : NOUVELLE
- Énoncé : grave au double du délai ; Réception et chefs d'équipe.
- Déclencheur : traitement.
- Conditions : durée > délai.
- Effet / message d'erreur : alerte.
- Sources : spec `[DC] §11` (EX-REC-070)
- Questions liées : Q-157
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-190 — Alertes : canal, gravité, destinataires paramétrables
- Origine : NOUVELLE
- Énoncé : canal et gravité se règlent dans Administration › Paramétrage › Alertes et mails ; chaque alerte ouvre l'écran où agir ; gravités Critique, Important, À surveiller.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : voir EX-TRA-027 à 031.
- Sources : spec `[DC] §11` ; EX-TRA-028, 029
- Questions liées : Q-132
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-191 — Mails à la réception : supprimés
- Origine : SUPPRIMÉE
- Énoncé : « le mail au commercial à la réception est désactivé (refusé le 14/10). Le mail « Réception affiche » aux chefs d'équipe est remplacé par le dashboard ; un résumé reste possible. » ; mail Pré-Prod pour inconnue remplacé par alerte. Legacy : mail HTML aux adresses de la plateforme de la 1re affiche (thread, mails perdus si envoi concurrent, erreurs avalées).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucun mail.
- Sources : legacy `CTRL/LivraisonAfficheController.cs:221-250`, `BLL/ToolBll.cs:391-456` (RG-REC-077 ; RG-ADM-043) · spec `[DC] §1, §11` (EX-REC-072, 078)
- Questions liées : Q-131
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-193 — Colonne « Ordre », étiquette de palette, douchette : refusés
- Origine : SUPPRIMÉE
- Énoncé : refusés : colonne « Ordre » du panier (REC-01 ; déplacer plus haut/plus bas), étiquette de palette et douchette (REC-26), mail commercial et assistante (REC-15). « Plus de colonne « Ordre » (REC-01 refusé) ».
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : fonctions absentes.
- Sources : spec `[DC] §1, §16` (EX-REC-078) ; ateliers EX-REC-508, 523 ; `[DESIGN] §8` (douchette : contradiction)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-194 — Dashboard de réception
- Origine : NOUVELLE
- Énoncé : par semaine/annonceur/thème/plateforme/format : attendu, reçu, reste (et %) ; accessible à Coordination, Pré-Prod, équipes ; remplace le mail aux chefs d'équipe. Écran Pilotage (hors REC).
- Déclencheur : lecture.
- Conditions : —
- Effet / message d'erreur : renvoi Pilotage.
- Sources : ateliers EX-REC-516, 517 (POUR DISCUSSION)
- Questions liées : Q-133
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-195 — Taux d'entretien (quantités avec/sans entretien)
- Origine : NOUVELLE
- Énoncé : % d'entretien : 8 % si prépa non envoyée ; celui saisi dans Broadcast si envoyée ; 15 % si campagne contrôlée. Priorité CC/prépa non précisée ; Bus +20 % (contraire).
- Déclencheur : calcul attendu avec entretien.
- Conditions : —
- Effet / message d'erreur : calcul.
- Sources : ateliers EX-REC-518 ; EX-EXI-075
- Questions liées : Q-133
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-196 — Alertes du dashboard (3 types)
- Origine : NOUVELLE
- Énoncé : (1) reçu hors entretien < quantité sans entretien ; (2) (reçu − attendu avec entretien) / attendu avec entretien > ±10 % ; (3) réception sans IP.
- Déclencheur : calcul.
- Conditions : —
- Effet / message d'erreur : alertes.
- Sources : ateliers EX-REC-519
- Questions liées : Q-133
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-197 — Date prévisionnelle de livraison et commentaires
- Origine : NOUVELLE
- Énoncé : champ saisi par les gestionnaires Pré-Prod avec commentaires pour remplacer les échanges mail jusqu'à J-3 ; source BC si Print Cityz vs saisie manuelle ; Pré-Prod ne travaille pas dans Circé (contradiction).
- Déclencheur : saisie.
- Conditions : —
- Effet / message d'erreur : voir RG-REC-020.
- Sources : ateliers EX-REC-516, 520
- Questions liées : Q-134
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-198 — IP reçues après le 1er fichier de production
- Origine : NOUVELLE
- Énoncé : identifier les dossiers dont les IP arrivent après la génération du premier fichier de prod ; modalité (alerte, tag, mail) non précisée.
- Déclencheur : arrivée des IP.
- Conditions : —
- Effet / message d'erreur : voir RG-X-010.
- Sources : ateliers EX-REC-505 (A revoir Bao) ; EX-COO-503
- Questions liées : Q-131
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-199 — Batch d'export des réceptions vers PEX/Broadcast (legacy)
- Origine : CONSERVÉE
- Énoncé : `p_batch_alimentation_circe_pex_reception` : prépas non BC des semaines ≥ courante (a) affiches associées, (b) affiches non associées via `tf_dossier_semaine_depart` ; « 2m2 Scrolling » → « 2m2 » ; quantité = Σ mouvements ; ligne retenue si `IdDAChapeau ≠ null` OU (`cont_num ≠ "0"` ET semaine/année non nulles) ; `IdSiteCCF` = 39 si plt 1 sinon 40 (en dur) ; `EstImportePEX = false`, `Destinataire = "CIRCE"` ; insertion `INTERFACE.CIRCE_PEX_RECEPTION`, puis `affiche.envoye = true`, puis `P_CIRCE_Alim_PEX_ReceptionAffiche('PexCirceReception')` ; pas de filtre `envoye` (rejeu complet) ; erreur dans `tt_log` puis relance. Planification inconnue.
- Déclencheur : exécutable batch.
- Conditions : —
- Effet / message d'erreur : voir Q-151.
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:30-103`, `SP/p_batch_alimentation_circe_pex_reception.sql:33-178` (RG-REC-110 ; RG-INT-020 à 022) · spec EX-TRA-039
- Questions liées : Q-005, Q-151
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-200 — « EstAssociee » : rattachée ET validée
- Origine : CONSERVÉE
- Énoncé : le retour vers Broadcast marque `EstAssociee = true` seulement si l'affiche est liée à une ligne ET `validationAdmin = true` ; orphelines envoyées `false`. Cible : « reçue et associée » reste envoyé à la validation ; retour BC à définir.
- Déclencheur : batch.
- Conditions : —
- Effet / message d'erreur : RG-X-022.
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:89` (RG-REC-111 ; RG-COO-029) · spec EX-TRA-039, EX-EXI-053
- Questions liées : Q-151
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-201 — Synchronisation Broadcast depuis l'écran Réception (legacy)
- Origine : MODIFIÉE
- Énoncé : legacy : GET `PrepaAfficheBC` remplace `tf_prepa_Broadcast` par dossier ; `sup_id` via `Transaco_Surface_Format` ; `repiquage = Bandeau` ; rafraîchissement si > 5 h non utilisé. Décrite comme code mort (EX-EXI-012) ; cible : alimentation par traitement automatique (module Coordination).
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : non reprise dans l'écran.
- Sources : legacy `BLL/LivraisonAfficheService.cs:867-926` (RG-REC-081 ; RG-INT-012) · spec EX-EXI-012
- Questions liées : Q-005
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-202 — Alimentation de `tf_prepa_affiche` (legacy) : propriété Coordination
- Origine : CONSERVÉE
- Énoncé : `p_Alimentation_tf_prepa_affiche` (fenêtre S→S+8, `rpc_statut <> 4`, MERGE inopérant, bandeaux, `IdDAChapeau`) relève de RG-COO (alimentation, RG-COO-003 à 012 provisoires) ; la Réception ne fait que lire.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : renvoi COO.
- Sources : legacy `SP/p_Alimentation_tf_prepa_affiche.sql` (RG-REC-082) · Q-005
- Questions liées : Q-005
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-203 — Lien « visuel disponible » et modale Visuel
- Origine : NOUVELLE
- Énoncé : un bouton « voir le visuel » (lien bleu) devant chaque visuel dans Réception et Suivi par thème ouvre la modale Visuel (dossier, DA, atelier·site, format, départ, position, repiquage, reçu/attendu, n° d'affiche (allée-rayon) ou « pas encore reçue », exclusion, préparation) ; utile pour vérifier les bandeaux.
- Déclencheur : clic.
- Conditions : visuel disponible dans l'état des réservations.
- Effet / message d'erreur : modale.
- Sources : ateliers EX-REC-510, EX-SCR-513 · écran ECR-REC-12
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
