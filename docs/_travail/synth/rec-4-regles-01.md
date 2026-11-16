### RG-REC-001 — Périmètre plateforme / site de l'utilisateur
- Origine : CONSERVÉE
- Énoncé : un utilisateur ne voit et n'agit que sur les plateformes (sites) de son périmètre (`tr_utilisateur_data`, N triplets login/plateforme/atelier). Le site choisi dans le bandeau 1 vaut pour toute l'application. L'identifiant de plateforme transmis par le client est REVÉRIFIÉ côté serveur (le legacy ne le revérifie jamais).
- Déclencheur : ouverture de tout écran Réception ; toute requête portant un `plt_id`.
- Conditions : `plt_id` ∈ périmètre de l'utilisateur. Utilisateur sans aucune plateforme : liste vide + message explicite (le legacy lève une NullReference sur `FirstOrDefault().Value`).
- Effet / message d'erreur : hors périmètre : 403 `REC_PERIMETRE_INTERDIT`, message (libellé proposé) « Cette plateforme n'est pas dans votre périmètre. ». Première plateforme présélectionnée.
- Sources : legacy `REPO/ReceptionListeAfficheRepository.cs:29-43`, `BLL/ReceptionListeAfficheBll.cs:41-43`, `REPO/LivraisonAfficheRepository.cs:220-235`, `CTRL/ReceptionListeAfficheController.cs:66-100` (ancien ID provisoire RG-REC-001, legacy-reception.md ; voir aussi RG-ADM-016 de legacy-admin.md) · spec `[README] §2.3, §7` (EX-TRA-006)
- Questions liées : Q-001, Q-137
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-002 — Autorisation par rôle vérifiée dans le service
- Origine : MODIFIÉE
- Énoncé : toute action d'écriture du module Réception est autorisée ou refusée dans le SERVICE selon la matrice profils × actions (section 2), jamais seulement dans la route ni dans le front. Le legacy ne contrôle rien côté serveur (droits = masquage de menus et de boutons).
- Déclencheur : tout appel d'écriture (valider la réception, créer une réception inconnue, rattacher, contrôler, imprimer, rebut, modifier la fiche, paramétrer).
- Conditions : rôle de l'utilisateur non autorisé pour l'action (matrice §2). Lecture seule pour `com` sur tous les écrans.
- Effet / message d'erreur : 403 `REC_ACCES_REFUSE`, message (proposé) « Vous n'avez pas le droit d'effectuer cette action. ».
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:20-540`, `CTRL/LivraisonAfficheController.cs:24-544`, `CTRL/DestructionController.cs:15-67` (RG-REC-121 provisoire) ; legacy-admin.md RG-ADM-015 · spec EX-TRA-002 ; CLAUDE.md §6
- Questions liées : Q-003, Q-136
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-003 — Validation admin et annulation réservées à la Coordination et à l'Administrateur
- Origine : MODIFIÉE
- Énoncé : « Valider » et « Annuler la validation » d'une affiche (fiche affiche, Réceptions inconnues, Validation admin et Instruction OK) ne sont autorisés que pour `coord` et `admin`. L'agent de réception ne valide pas. Legacy : case « Validation Admin » affichée seulement avec le droit `validation_admin`, mais `validationAdmin` écrit sans contrôle serveur.
- Déclencheur : clic « Valider » / « Annuler la validation » ; enregistrement de la fiche affiche.
- Conditions : rôle ∈ {coord, admin}.
- Effet / message d'erreur : autres rôles : 403 `REC_VALIDATION_RESERVEE`, message (maquette, texte d'aide) « Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation admin et Instruction OK, sans attendre la préparation. ». Les effets de la validation relèvent de RG-COO (validation admin) et de RG-X-015.
- Sources : legacy `VIEW/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:24-39`, `BLL/ReceptionListeAfficheBll.cs:867-869` (RG-REC-027 provisoire ; RG-COO-026 provisoire de legacy-coordination.md) · spec `[README] §3, H1` ; EX-COO-010 ; EX-TRA-005 · écran ECR-REC-05 (bloc Validation admin), maquette `instructions.js:16-18`, `reception.js:85-88`
- Questions liées : Q-136
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-004 — Auteur et date tracés sur chaque action de réception
- Origine : NOUVELLE
- Énoncé : chaque action de réception (réception, contrôle, rattachement, retrait, changement de thème, validation, annulation de validation, réimpression, rebut, signalement) enregistre l'utilisateur authentifié (nom de la personne) et la date. La validation admin garde `validationAdmin_par` et `validationAdmin_le` ; chaque rattachement garde créé par/le et retiré par/le. Les comptes génériques partagés de Nîmes sont incompatibles avec cette traçabilité (comptes nominatifs requis).
- Déclencheur : toute écriture du module.
- Conditions : utilisateur authentifié identifiable.
- Effet / message d'erreur : refus 401 si non authentifié ; l'historique ne dit jamais « validée par Circé » (02/11).
- Sources : spec `[PP] §5`, `[RA] §4` (EX-TRA-036) ; `[DC] §2` (EX-TRA-007, EX-ADM-502) ; EX-COO-009 · écran ECR-REC-05 (Historique)
- Questions liées : Q-001, Q-003
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-005 — Journal d'événements de réception
- Origine : NOUVELLE
- Énoncé : un journal (`th_edr_evenement`) enregistre pour chaque événement : réception, contrôle, rattachement, changement de thème, retrait, modification, impression et réimpression de feuille, étiquette rack, purge automatique (une ligne). Il alimente l'onglet Historique de l'affiche et Administration › Journal.
- Déclencheur : chaque événement listé.
- Conditions : —
- Effet / message d'erreur : une ligne (type, objet, auteur, date, ancienne/nouvelle valeur) ; écriture dans la MÊME transaction que l'événement.
- Sources : spec `[DC] §8, §11, §13` (EX-REC-080, EX-TRA-035) · écran ECR-REC-05, ECR-ADM-08
- Questions liées : Q-004
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-006 — Historique d'une affiche : champs et actions historisés
- Origine : MODIFIÉE
- Énoncé : l'historique de l'affiche garde ce qui s'est passé, avec qui et quand. Le legacy historise : dossier, semaines, annonceur, thème, format, validation admin, « à conserver » (`ModificationValidationAdmin` : coché / décoché ; `ModificationAfficherAConserver`), mise en rebus, vidage du rebus, association, création d'affiche. Il N'historise PAS : conservation, allée, rayon, zone picking, date de dernier départ, commentaire. La cible historise aussi les mouvements d'emplacement (allée/rayon) et la non-conformité saisie au contrôle (« Rangée : X-3 → B-7 (sortie de la zone tampon) »).
- Déclencheur : enregistrement de la fiche affiche ; rangement ; contrôle.
- Conditions : valeur modifiée (ancienne ≠ nouvelle).
- Effet / message d'erreur : une entrée `histo_historique_entite` (action, type d'entité 1 = Affiche, id entité, ancienne/nouvelle valeur, auteur, date) par champ modifié.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889 (852-869)`, `BLL/HistorisationBll.cs:16-38`, `legacy-integrations.md RG-INT-046` (RG-REC-024 provisoire) · spec `[DC] §8` (EX-REC-047), `[DC] §5, §10` (EX-REC-024) · écran ECR-REC-05 (onglet Historique), ECR-REC-10
- Questions liées : Q-004
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-007 — Changement de semaines et dissociation historisés avec la bonne action
- Origine : MODIFIÉE
- Énoncé : le retrait d'un rattachement (dissociation) est historisé avec une action de dissociation propre, portant l'identifiant de l'AFFICHE ; un changement de semaines est historisé avec une action « semaines » propre. Le legacy écrit la dissociation avec l'action `AfficheAssocier` (valeurs inversées) et l'id de la PRÉPA comme id d'entité, et historise un changement de `semaines` avec `ModificationDossierAffiche`.
- Déclencheur : retrait d'un rattachement ; modification des semaines.
- Conditions : —
- Effet / message d'erreur : entrées d'historique distinguables ; anomalie legacy non reprise.
- Sources : legacy `BLL/HistorisationBll.cs:16-38 (ligne 22), 68-76 (ligne 70)`, `BLL/ReceptionListeAfficheBll.cs:577-586` (RG-REC-024, RG-REC-092 provisoires) · spec EX-TRA-035 (« dissociation non historisée comme une association (anomalie existante) »)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-008 — Doubles soumissions : clé d'idempotence
- Origine : NOUVELLE
- Énoncé : les POST de création et de transition du module (Valider la réception, Créer une réception inconnue, Rattacher, Valider le contrôle, Signaler, Imprimer) portent un en-tête `Idempotency-Key`. Un rejeu avec la même clé renvoie le résultat initial sans recréer de réception, d'affiche, de mouvement ni d'alerte. Règle d'ingénierie, non métier ; elle répond à l'anomalie de doublons de la Liste des affiches.
- Déclencheur : double clic, rejeu réseau.
- Conditions : même `Idempotency-Key` + même corps.
- Effet / message d'erreur : même réponse ; même clé avec un corps différent : 409 `REC_IDEMPOTENCE_CONFLIT`.
- Sources : CLAUDE.md §6 · spec EX-REC-081 (ANO-01 doublons), EX-REC-501 (doublement d'affiches)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-009 — Verrouillage optimiste des réceptions et des affiches
- Origine : NOUVELLE
- Énoncé : réception et affiche portent un champ `version` ; toute modification (`updateMany where version`) qui ne touche aucune ligne est refusée. Deux utilisateurs qui rattachent, valident ou contrôlent la même palette/affiche en même temps ne s'écrasent pas. Règle d'ingénierie, non métier.
- Déclencheur : toute écriture sur réception ou affiche existante.
- Conditions : `version` envoyée ≠ `version` en base.
- Effet / message d'erreur : 409 `REC_CONFLIT_VERSION`, message « Cet élément a été modifié par un autre utilisateur : rechargez la page. » (libellé proposé).
- Sources : CLAUDE.md §6 · maquette Q-E (« actions de masse sans notion de version »)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-010 — Menu Réception cible et badges
- Origine : MODIFIÉE
- Énoncé : l'onglet Réception propose trois entrées : « Réception des affiches » (étapes 1 et 2 sur une seule page ; badge = nombre de palettes à contrôler), « Liste des affiches », « Réceptions inconnues » (badge rouge = nombre d'affiches orphelines du périmètre). Legacy : menu à quatre entrées (Réception des affiches, Liste des affiches, Zone picking, Fusion des affiches) sous le droit `reception_liste_affiche`. « Zone picking » et « Fusion des affiches » ne sont pas repris. Les pages secondaires du rôle sont grisées (info-bulle « Écran secondaire pour le rôle sélectionné »).
- Déclencheur : rendu du menu.
- Conditions : rôle ; périmètre.
- Effet / message d'erreur : compteurs calculés sur le site choisi ; le compteur de l'onglet = celui de sa première page « chaude ».
- Sources : legacy `VIEW/Shared/_MenuNew.cshtml:122-138`, `BLL/CommunBll.cs:276-303` (RG-REC-120 provisoire) · spec `[README] §3, §7` (EX-REC-079) · écran ECR-REC-01 à 04 ; `maquettes-reception-coordination.md §1.2`
- Questions liées : Q-100, Q-101
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-011 — Trois façons de trouver les dossiers du BL
- Origine : NOUVELLE
- Énoncé : le bandeau « Trouver les dossiers du BL » offre trois voies côte à côte : « Photographier le BL », « Photographier une affiche » (Circé reconnaît le visuel et propose les dossiers les plus proches) et le champ « N° de dossier, de DA, annonceur… » qui filtre les réceptions attendues. Recours : « Rien ne correspond ? » + bouton « Réception inconnue… ». Circé retient comment le dossier a été trouvé (RG-REC-032).
- Déclencheur : arrivée sur l'étape 1.
- Conditions : —
- Effet / message d'erreur : les lignes trouvées arrivent au panier cochées pour ce BL ; message vide du panier (maquette) « Aucune ligne. Trouvez les dossiers du BL en haut (photo du BL, photo d'une affiche, ou n° de dossier puis « Au panier ») : chaque ligne arrive avec sa case, cochée pour ce BL ; décochez celles d'un autre BL. Rien ne correspond : « Réception inconnue ». ».
- Sources : spec `[DC] §4` (EX-REC-002) ; `[PR] p.1` · écran ECR-REC-01
- Questions liées : Q-112
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-012 — Recherche à la frappe sur n° de dossier, DA, annonceur
- Origine : NOUVELLE
- Énoncé : la recherche se lance à la frappe (pas à la touche Entrée). Elle accepte n° de dossier, n° de DA, annonceur ; plusieurs valeurs (puces) ; liste collée ; les n° inconnus sont signalés (« Absents de cette page ») et les dossiers masqués par un filtre sont signalés avec le filtre en cause (« Masqués par <filtre> — Afficher »). Legacy : critères dossier (liste séparée par « + »), annonceur, thème, format, départ « S<n>/<année> » ; la touche Entrée ne lance pas la recherche dans « Ajouter préparation ».
- Déclencheur : saisie dans le champ.
- Conditions : —
- Effet / message d'erreur : filtre immédiat du tableau des Réceptions attendues. Contradiction de sources (README/DESIGN « saisie puis Entrée » vs REC-10) : REC-10 (frappe) retenu.
- Sources : spec `[DC] §7, §14, §16` (EX-REC-007) ; `[DESIGN] §4.3` ; legacy `BLL/ReceptionListeAfficheBll.cs:420-435, 484-531` (RG-REC-090 provisoire) ; EX-COO-506 (Entrée ne lance pas la recherche) · écran ECR-REC-01, maquette §2.2
- Questions liées : Q-165
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-013 — Format du n° de dossier
- Origine : CONSERVÉE
- Énoncé : un n° de dossier saisi ou rattaché comporte exactement 6 chiffres (`^[0-9]{6,6}$` ; avec plusieurs dossiers, séparés par « + » dans la saisie héritée). Le suffixe « -W » de la 2e plateforme est accepté (RG-REC-025).
- Déclencheur : saisie ou rattachement d'un n° de dossier.
- Conditions : valeur non conforme au motif.
- Effet / message d'erreur : refus 400 `REC_DOSSIER_FORMAT`. Message legacy : « Attention, votre format de saise de dossier est inccorect. Exemple format attendue "100000+120000" » (fautes d'orthographe d'origine ; libellé corrigé à valider).
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:136-173`, `TOOLS/Helper/ReggexMatchForRule.cs:12-13, 36-47`, `TOOLS/Constant/Constants.cs:31-35` (RG-REC-026 point 1) · spec `[DC] §2, §10` (EX-REC-015 pour « -W »)
- Questions liées : Q-139, Q-150
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-014 — Réceptions attendues : lignes affichées
- Origine : MODIFIÉE
- Énoncé : le tableau « Réceptions attendues » (« Ce qu'on attend, issu de Broadcast dès la DA activée ») montre UNE ligne par thème (visuel) de dossier, du site choisi, hors dossiers annulés et hors thèmes exclus (« ne pas afficher », « reste en place » repris de Broadcast). Legacy : lignes `tf_prepa_affiche` (a) non reçues (`ARecevoir` 0/NULL) et sans affiche, (b) avec affiche mais `Qte_Theorique` > somme des mouvements ; formats « 2m2 Scrolling »/« 2m2 Venusial » renommés « 2m2 » ; regroupement par (livraison, dossier, format, thème, annonceur, semaine, année) avec `SUM(distinct Qte_Theorique)`.
- Déclencheur : ouverture de l'étape 1 ; modification d'un filtre.
- Conditions : ligne ACTIVE (non annulée), thème non exclu, plateforme = site.
- Effet / message d'erreur : colonnes visibles : Site, Dossier, Visuel, Départ, Reçu / attendu (n° d'affiche cliquable), Reste, Statut, Contrôle, Livraison prévue ; masquées : DA, Annonceur, Thème, Format, Attendu, Reçu, N° d'affiche. Vide : « Aucune ligne pour ces filtres. ». Message de site : « Aucune réception attendue à proposer sur ce site. ».
- Sources : legacy `FN/Fn_GetPrepaAffiche.sql:44-103, 106-221, 224-343`, `SP/p_GetPrepareListAffiches.sql:104-161` (RG-REC-071 provisoire ; RG-COO-013 de legacy-coordination.md) · spec `[DC] §4` (EX-REC-008, 009) ; EX-COO-032, 034 · écran ECR-REC-01 (tableau)
- Questions liées : Q-135, Q-138
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-015 — Filtre Départ et période par défaut
- Origine : MODIFIÉE
- Énoncé : la période est un filtre « Départ » en semaines de départ (options ≥ semaine de production ; défaut : semaine en production et suivantes pour la Réception) ; semaines ISO. Legacy : période par défaut « semaine courante → +8 semaines » avec gestion du changement d'année (52/53 semaines) et validation de la recherche : erreurs « La date de début doit être renseigné », « La date de fin doit être renseigné », « La date de fin doit être postérieur à la date de début » (le test accepte pourtant l'égalité).
- Déclencheur : ouverture de l'étape 1 ; changement du filtre.
- Conditions : au moins une semaine retenue pour afficher des lignes.
- Effet / message d'erreur : la validation à dates début/fin du legacy disparaît avec la liste à cocher (anomalie « postérieur » non reprise). Les semaines sont ISO (le legacy mélange `DATEPART(wk)` et ISO).
- Sources : legacy `BLL/LivraisonAfficheService.cs:52-83, 216-227, 247-272`, `CTRL/LivraisonAfficheController.cs:52-83, 97-128` (RG-REC-070 provisoire) · spec `[DESIGN] §4.3`, `[README] §2.3` ; EX-COO-038 (semaines ISO) · écran ECR-REC-01 (filtre Départ)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-016 — Filtres du tableau des Réceptions attendues et valeurs par défaut
- Origine : NOUVELLE
- Énoncé : filtres en listes à cocher : Statut (par défaut « Attendue » + « Partielle »), Départ, Format ; Contrôle et Annonceur par « + Filtre ». Aucune coche = tout ; OU entre valeurs d'un filtre, ET entre filtres ; compteurs par valeur. Actions par ligne : « Au panier », « Feuille de stock » (réimpression d'une affiche déjà contrôlée) ; en masse : « Ajouter au panier (n) » ; export Excel.
- Déclencheur : arrivée sur l'étape 1.
- Conditions : « Feuille de stock » visible si au moins une affiche contrôlée.
- Effet / message d'erreur : teinte de ligne : Surplus → avertissement, Partielle → important.
- Sources : spec `[DC] §4` (EX-REC-008) ; `[DESIGN] §4.3` · écran ECR-REC-01 (filtres), maquette §2.2
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-017 — Reçu, attendu et reste à recevoir
- Origine : NOUVELLE
- Énoncé : le « reçu » d'un visuel (ligne attendue) = somme des quantités rattachées ACTIVES des affiches (et non somme des mouvements, décision du 21/10) ; un reçu multi-semaines est compté une fois. Reste = max(0, attendu − reçu). L'attendu vient de Broadcast (ligne `BC`) ou de la prépa (ligne `PREPA`). Réception et écart de contrôle comptent dans le reçu ; le rebut ne le réduit pas (il réduit le stock).
- Déclencheur : tout événement qui change un rattachement ou une quantité.
- Conditions : rattachements actifs seulement.
- Effet / message d'erreur : colonne « Reçu / attendu » (« 4 / 7 ») avec n° d'affiche(s) cliquables → fiche affiche. La vision « manquant » est calculée sur UNE ligne par clé (pas de split par type de préparation, anomalie EX-REC-522).
- Sources : spec `[DC] §9, §13` (EX-REC-057, EX-REC-522, EX-EXI-059) ; EX-COO-039 · écran ECR-REC-01 (Reçu / attendu, Reste)
- Questions liées : Q-103, Q-123
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-018 — Statut de la ligne attendue : Attendue, Partielle, Complète, Surplus
- Origine : MODIFIÉE
- Énoncé : statut calculé une fois à chaque événement et lu par tous les écrans : « Attendue » (reçu = 0) ; « Partielle » (0 < reçu < attendu) ; « Complète » (reçu ≥ attendu ET reçu ≤ attendu × (1 + `ecartReception`)) ; « Surplus » (reçu > attendu × (1 + `ecartReception`), strictement). `ecartReception` = paramètre (10 %) : la maquette code 1,10 en dur, à ne pas reprendre. Legacy : seulement « Terminé » / « Partiel » (Σ mouvements ≥ / < `Qte_Théorique`).
- Déclencheur : valider la réception, rattacher/retirer, contrôle avec écart.
- Conditions : attendu > 0.
- Effet / message d'erreur : pastille : Attendue (bleu clair), Partielle (Important), Complète (OK), Surplus (À surveiller). Une ligne Partielle reste proposée à la réception (le thème ne disparaît pas à la 2e livraison, EX-REC-511).
- Sources : legacy `FN/Fn_GetPrepaAffiche.sql:106-221` ; `Partial_GridAfficheList.cshtml:8-20` (EX-EXI-076) · spec `[DC] §9` (EX-REC-051, EX-REC-511) · écran ECR-REC-01 (« Seuils »)
- Questions liées : Q-105, Q-133
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-019 — Colonne Contrôle de la ligne attendue
- Origine : NOUVELLE
- Énoncé : colonne « Contrôle » : « Rien reçu » (aucune affiche rattachée), « À contrôler » (au moins une affiche rattachée dont la palette est à contrôler), « Contrôlée » (affiches contrôlées ; feuille de stock réimprimable). Calculée avec le statut de la ligne.
- Déclencheur : événement de réception ou de contrôle.
- Conditions : —
- Effet / message d'erreur : pastille « À contrôler » en À surveiller, « Contrôlée » en OK ; filtre « Contrôle » dans « + Filtre ».
- Sources : spec `[DC] §9` (EX-REC-051) ; `[PR] p.1` · écran ECR-REC-01
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-020 — Colonne « Livraison prévue »
- Origine : NOUVELLE
- Énoncé : la colonne « Livraison prévue » affiche une date (« jeu. 15/10 »), « Print Cityz » (imprimeur interne) ou « — ». Une date prévisionnelle de livraison saisie manuellement avec commentaire est demandée par les ateliers pour remplacer les échanges mail sur les manquants jusqu'à J-3. Source et auteur de la date non tranchés.
- Déclencheur : affichage ; saisie éventuelle.
- Conditions : —
- Effet / message d'erreur : affichage seul tant que Q-134 n'est pas tranchée.
- Sources : spec `[DC] §4` (EX-REC-008, ambiguïté) ; ateliers (EX-REC-520, EX-REC-516) · écran ECR-REC-01 (colonne Livraison prévue)
- Questions liées : Q-134
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-021 — Panier : composition et actions
- Origine : MODIFIÉE
- Énoncé : le panier (« Lignes du BL ») a une case par ligne, cochée d'office, une case « tout » (état indéterminé) ; colonnes Dossier, « Annonceur · thème » (+ champ « Intitulé saisi (sans IP) » si IP non saisies), Reste attendu, Qté du BL (modifiable), Livraison en deux fois ; actions « Retirer », « Vider le panier ». Il n'y a plus de colonne « Ordre » (RG-REC-193). Ajouter une ligne déjà au panier est refusé. Legacy : empilement en session sans dédoublonnage, vidé après validation d'une livraison ; la liste « à réceptionner » masque les prépas déjà au panier.
- Déclencheur : « Au panier », « Ajouter au panier (n) », « Mettre au panier » (modales photo), « Retirer », « Vider le panier ».
- Conditions : ligne non déjà au panier.
- Effet / message d'erreur : doublon : « Ce visuel est déjà au panier. » ; ajout : « n ligne(s) ajoutée(s) au panier. » ; sous-titre « n cochée(s) sur m pour ce BL… ».
- Sources : legacy `CTRL/LivraisonAfficheController.cs:107-111, 251, 294, 459-479` (RG-REC-072 provisoire) · spec `[DC] §4` (EX-REC-010) · écran ECR-REC-01 (carte Lignes du BL)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-022 — Un BL = une réception ; seules les lignes cochées entrent
- Origine : NOUVELLE
- Énoncé : seules les lignes cochées entrent dans la réception ; les autres restent au panier pour le BL suivant. Une palette avec deux BL donne deux réceptions. Le panier peut réunir plusieurs BL. Le formulaire dit « Pour les n ligne(s) cochée(s) » et le bouton « Valider la réception (n lignes) ».
- Déclencheur : « Valider la réception ».
- Conditions : ≥ 1 ligne cochée (RG-REC-037).
- Effet / message d'erreur : les lignes cochées quittent le panier ; le reste demeure.
- Sources : spec `[DC] §1, §4, §10` (EX-REC-011) · écran ECR-REC-01
- Questions liées : Q-102
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-023 — Quantité du BL d'une ligne
- Origine : NOUVELLE
- Énoncé : « Qté du BL » est un nombre ≥ 0, modifiable, par défaut = reste attendu (ou attendu avec entretien si pas de reste). Une ligne à quantité 0 est ignorée à la validation. Le legacy n'impose aucune validation sur la quantité (Ajout : 0 ou négatif accepté).
- Déclencheur : saisie ; validation de la réception.
- Conditions : valeur < 0 refusée.
- Effet / message d'erreur : refus 400 `REC_QTE_NEGATIVE` (« La quantité doit être supérieure ou égale à 0. », libellé proposé) ; quantité 0 : ligne ignorée (la maquette n'affiche aucun message : Q-166).
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:800-835 (812-818)` (RG-REC-021 provisoire) ; `BLL/LivraisonAfficheService.cs:827-844` (RG-REC-076) · spec EX-REC-010 · écran ECR-REC-01 (carte Lignes du BL) ; Q-REC-5 de la maquette
- Questions liées : Q-166
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-024 — Un BL ne livre qu'une plateforme
- Origine : NOUVELLE
- Énoncé : toutes les lignes cochées d'un BL appartiennent à la même plateforme ; une affiche et sa ligne attendue sont toujours sur la même plateforme. Un dossier livré sur les deux plateformes compte deux lignes (une par plateforme).
- Déclencheur : « Valider la réception » ; rattachement d'une affiche à une ligne.
- Conditions : lignes cochées sur deux plateformes ; rattachement inter-plateformes.
- Effet / message d'erreur : 422 `REC_BL_DEUX_PLATEFORMES`, message « Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. ». Une affiche destinée à l'autre plateforme se transfère puis se réceptionne (EX-COO-045).
- Sources : spec `[DC] §2, §10` (EX-REC-015) ; EX-COO-045 · écran ECR-REC-01 (règle 3)
- Questions liées : Q-139
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-025 — Suffixe « -W » du dossier de la 2e plateforme
- Origine : NOUVELLE
- Énoncé : un dossier livré sur les deux plateformes : la part de la 2e plateforme garde le n° de dossier et la DA avec le suffixe « -W » (maquette : deux dossiers `id` et `id-W`, même n° Broadcast, même DA). La Réception affiche et recherche ce suffixe ; qui le pose, sur quel champ et pour quelle plateforme n'est pas précisé.
- Déclencheur : alimentation des lignes attendues (module Coordination) ; recherche à la réception.
- Conditions : dossier présent sur deux plateformes.
- Effet / message d'erreur : la recherche par n° de dossier retrouve les deux variantes ; « Dossier » affiché avec suffixe.
- Sources : spec `[DC] §2, §10` (EX-REC-015, ambiguïté) · écran ECR-REC-01 (colonne Dossier : « suffixe `-W` pour 2e plateforme ») ; `maquettes-autres-modules.md §C`
- Questions liées : Q-139
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-026 — Photo du BL obligatoire
- Origine : NOUVELLE
- Énoncé : la photo du BL est obligatoire dans TOUS les cas, même si les lignes sont trouvées par la recherche (« Joindre le BL »). Seule exception : palette arrivée sans BL (réception inconnue). Tant que la photo manque, un encadré « BL à photographier » porte le bouton « Photographier le BL » et la validation est refusée. La photo se revoit au contrôle (« Voir le BL ») ; la fiche de réception porte « Photo du BL jointe ».
- Déclencheur : « Valider la réception ».
- Conditions : pas de photo du BL et la réception n'est pas une réception inconnue sans BL.
- Effet / message d'erreur : 422 `REC_PHOTO_BL_MANQUANTE`, message « Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche. ».
- Sources : spec `[DC] §1, §4, §10` (EX-REC-003) ; `[DESIGN] §4.8` · écran ECR-REC-01 (règle 4), ECR-REC-07, ECR-REC-11
- Questions liées : Q-112, Q-113
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
