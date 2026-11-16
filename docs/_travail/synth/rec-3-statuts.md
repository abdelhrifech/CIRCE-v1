### 3.1 Statuts

Principe (RG-REC-176, EX-REC-050) : Circé pose chaque statut et chaque tag lui-même à chaque événement ; aucun tag n'est coché à la main. Le schéma réel n'a aucune colonne statut pour l'affiche ni pour la ligne attendue (état dérivé de drapeaux, `bdd.md §4.2-4.3`) : « persisté ou calculé » = Q-f de `bdd.md` (cible : une machine d'états par entité dans le service, historique à chaque changement, CLAUDE.md §6). Les codes ci-dessous sont des PROPOSITIONS de codes techniques ; les libellés sont ceux des sources.

| Statut (objet.code) | Libellé affiché | Signification | Source |
|---|---|---|---|
| RECEPTION.A_IDENTIFIER | « À identifier par la Coordination (zone tampon) » | Réception inconnue créée, aucun dossier rattaché ; HORS du sas de contrôle | EX-REC-053 ; ECR-REC-06 |
| RECEPTION.A_CONTROLER | « Palette à contrôler » | Palette dans le sas, posé à « Valider la réception » ou au rattachement d'une inconnue | EX-REC-053 ; ECR-REC-02 |
| RECEPTION.CONTROLEE | « Contrôlée » (avec date et contrôleur) | « Valider le contrôle » fait ; champs en lecture seule | EX-REC-027, 053 ; ECR-REC-02 |
| LIGNE_ATTENDUE.ATTENDUE | « Attendue » | Reçu = 0 | EX-REC-051 ; ECR-REC-01 |
| LIGNE_ATTENDUE.PARTIELLE | « Partielle » | 0 < reçu < attendu | EX-REC-051 |
| LIGNE_ATTENDUE.COMPLETE | « Complète » | reçu ≥ attendu et reçu ≤ attendu × 1,10 (maquette : seuil codé en dur `reception.js:39`, paramètre `ecartReception` à utiliser) | EX-REC-051 ; ECR-REC-01 « Seuils » |
| LIGNE_ATTENDUE.SURPLUS | « Surplus » | reçu strictement supérieur à attendu × 1,10 | EX-REC-051, 060 |
| LIGNE_ATTENDUE.CONTROLE_RIEN_RECU | « Rien reçu » (colonne Contrôle) | Aucune affiche rattachée | EX-REC-051 ; ECR-REC-01 |
| LIGNE_ATTENDUE.CONTROLE_A_CONTROLER | « À contrôler » (colonne Contrôle) | Au moins une affiche rattachée dont la palette n'est pas contrôlée | EX-REC-051 |
| LIGNE_ATTENDUE.CONTROLE_CONTROLEE | « Contrôlée » (colonne Contrôle) | Affiches contrôlées ; feuille de stock réimprimable | EX-REC-051 ; ECR-REC-01 |
| AFFICHE.IDENTIFIEE | « Identifiée » | Au moins un rattachement actif à un dossier/ligne attendue | EX-REC-054 ; ECR-REC-03 |
| AFFICHE.ORPHELINE | « Orpheline » (statut dans [DC], tag dans [PR] : voir Contradictions) | Aucun lien actif ; = réception inconnue non rattachée | EX-REC-043, 054 |
| AFFICHE.TAG_A_CONTROLER | « À contrôler » | De la réception jusqu'au contrôle | EX-REC-054 |
| AFFICHE.TAG_RECEPTION_INCONNUE | « Réception inconnue » | Affiche issue d'une réception inconnue | EX-REC-054 |
| AFFICHE.TAG_COMPLEMENT | « Complément » | Affiche reçue en au moins deux réceptions | EX-REC-016, 054 |
| AFFICHE.TAG_FEUILLE_A_REFAIRE | « Feuille à refaire » (affiché « Feuille définitive à imprimer » tant qu'une temporaire est posée) | Thème ou rattachement changé après identification ; levé par la réimpression | EX-REC-033, 054 |
| AFFICHE.TAG_AU_REBUT | « Au rebut » | PROPOSÉ (non décidé) | EX-REC-054 ; Q-118 |
| FEUILLE.TEMPORAIRE | « Temporaire » | Posée à la création d'une réception inconnue ; porte allée et rayon de la zone tampon | EX-REC-029, 056 |
| FEUILLE.DEFINITIVE | « Définitive » | Posée au contrôle (dossier connu) ou à l'impression après rattachement ; remplace la temporaire | EX-REC-029, 056 |
| AFFICHE_RECUE.NON / .OUI | « Affiche reçue » = non / oui (EDR) | OUI dès l'arrivée de la palette (sur la quantité du BL) ; V2 : « un mouvement de réception existe » | EX-REC-052, EX-REC-503 ; Q-104 |
| RECEPTION_INCONNUE.A_IDENTIFIER | « À identifier » | Feuille temporaire, zone tampon | EX-REC-055 ; ECR-REC-04 |
| RECEPTION_INCONNUE.INTROUVABLE | « Introuvable : alerte à la Coordination » (+ date) | Après « Signaler à la Coordination » | EX-REC-041, 055 ; ECR-REC-04 |
| RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | « Rattachée, à contrôler » | Rattachée à ≥ 1 dossier ; palette dans le sas | EX-REC-040, 055 |
| RECEPTION_INCONNUE.CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER | « Contrôlée, feuille définitive à imprimer » | Contrôle validé, feuille définitive non encore imprimée | EX-REC-055, 068 |
| RECEPTION_INCONNUE.RATTACHEE_FEUILLE_DEFINITIVE | « Rattachée, feuille définitive » | Terminé (masqué par défaut dans le filtre) | EX-REC-055 ; ECR-REC-04 |
| VALIDATION_ADMIN.RECEPTION_INCONNUE | « Réception inconnue : à rattacher d'abord » | Pas de validation possible tant que non rattachée | ECR-REC-05 (`C.vaEtat`) ; EX-COO-012 |
| VALIDATION_ADMIN.PROPOSEE | « À confirmer : proposé » (cas sûr, pré-coché) | Rattachement proposé par Circé à la réception | EX-COO-004, 006, 012 |
| VALIDATION_ADMIN.A_FAIRE_DOUTE | « À confirmer : doute » | Motif de doute, jamais pré-coché | EX-COO-007, 012 |
| VALIDATION_ADMIN.VALIDEE | « Validée par <user>, le <date> » | Confirmée par une personne ; décochable | EX-COO-009, 012 ; EX-TRA-036 |
| VALIDATION_ADMIN.ANNULEE | « Validation annulée » | « Annuler la validation » ; redevient à confirmer (motif doute) | EX-COO-007, 009 |
| RATTACHEMENT.ACTIF / .RETIRE | actif / retiré (par, le) | Lien affiche ↔ ligne attendue avec quantité ; jamais perdu : retiré et recréé | EX-COO-039 ; EX-REC-080 |
| RATTACHEMENT.MODE_BL / _VISUEL / _MAIN | « n° du BL » / « visuel » / « à la main » | Comment le dossier a été trouvé | EX-REC-004, 080 ; ECR-REC-01 |
| INDICATEUR.CONTROLE_EN_RETARD | « Contrôle en retard » | Palette dans le sas depuis plus de `delaiControle` (24 h) ; grave au double | EX-REC-019, 053 |
| INDICATEUR.ECART_DE_COMPTAGE | « Écart de comptage » | |comptée − BL| > 10 % de la quantité du BL | EX-REC-021, 053 |
| INDICATEUR.PHOTO_BL_JOINTE | « Photo du BL jointe » | Photo du BL attachée à la réception | EX-REC-003 |
| ALERTE.OUVERTE / .ACQUITTEE | ouverte / acquittée | Règles d'acquittement non précisées (Q-TRA-2 maquette) | ECR-TRA-01 |
| LEGACY.AFFICHE (flags) | R Réceptionnée · P Picking · V validée admin · O orpheline · Rb Au rebus · Fc Fusionnée (cible) · Fh Chapeau | États HÉRITÉS (migration) : `rebus`, `zone_Picking`, `validationAdmin`, `est_fusionne`, `fusion_affiche` ; pas de colonne statut | legacy `legacy-reception.md` « Machines d'états » ; `bdd.md §2.1` |
| LEGACY.PREPA | à recevoir · reçue · reçue partielle · FromBroadcast | `ARecevoir`, `affiche_livraison_Id`, `FromBroadcast` (héritage ; remplacé par statuts de ligne attendue) | legacy RG-REC-071/082/091/092 |
| LEGACY.LIVRAISON | Créée (aucun statut, aucune suppression) | Remplacé par RECEPTION.* | legacy « Livraison » |
| LEGACY.ENVOYE | `affiche.envoye` null → true | Drapeau d'envoi PEX, jamais remis à false | legacy RG-REC-110 |

### 3.2 Transitions (toute transition absente est INTERDITE : 409)

Permissions abrégées : coord, cheq, recep, expe, admin, com (voir matrice §2). « * » = hypothèse Q-136. Les transitions de la validation admin sont DÉFINIES par le module Coordination (RG-COO validation admin, EX-COO-004 à 016) ; elles sont reprises ici car déclenchées depuis les écrans Réception.

| De | Action | Vers | Permission | Gardes (RG) | Effets (RG / RG-X) | Source |
|---|---|---|---|---|---|---|
| ∅ | Valider la réception (≥ 1 ligne cochée) | RECEPTION.A_CONTROLER | recep ; coord* | RG-REC-026, 037, 024, 023, 033, 035 | RG-REC-038, 039, 040, 041, 042, 044, 045, 046 ; RG-X-001, 003, 004, 005, 028 | EX-REC-013, 014 |
| ∅ | Créer une réception inconnue | RECEPTION.A_IDENTIFIER (affiche ORPHELINE, feuille TEMPORAIRE) | recep ; coord* | RG-REC-095, 096, 097, 098 | RG-REC-099, 083 ; RG-X-006 | EX-REC-035, 036 |
| RECEPTION.A_IDENTIFIER | Rattacher (≥ 1 dossier, répartition ≤ quantité) | RECEPTION.A_CONTROLER | coord ; recep (reste à confirmer, Q-107) | RG-REC-107, 108, 118 | RG-REC-109, 110, 111 ; RG-X-007, 030 | EX-REC-039, 040 |
| RECEPTION.A_CONTROLER | Valider le contrôle (contrôleur, allée, rayon) | RECEPTION.CONTROLEE | recep | RG-REC-061, 067, 057, 064 | RG-REC-069, 059, 084 ; RG-X-017 | EX-REC-023, 026, 027 |
| RECEPTION.A_CONTROLER | Retirer le dernier dossier d'une affiche de la palette | RECEPTION.A_IDENTIFIER | coord ; recep* | RG-REC-114, 137 | RG-REC-114 ; RG-X-013 | EX-REC-043, 053 ; ECR-REC-05 ; Q-108 |
| RECEPTION.CONTROLEE | Retirer le dernier dossier | RECEPTION.A_IDENTIFIER | coord ; recep* | RG-REC-114 ; HYPOTHÈSE Q-108 (maquette : toute réception sans dossier redevient à identifier) | RG-X-013 | EX-REC-043 (ambigu §9/§10) ; Q-108 |
| RECEPTION.A_CONTROLER | « Valider la réception » d'un complément sur la même palette | (inchangé) | — | — | RG-REC-040 | EX-REC-016 |
| LIGNE_ATTENDUE.ATTENDUE | Réception d'une quantité < attendu | LIGNE_ATTENDUE.PARTIELLE | calculé | RG-REC-018 | RG-X-004 | EX-REC-051 |
| LIGNE_ATTENDUE.ATTENDUE / PARTIELLE | Réception portant le reçu à attendu .. attendu × 1,10 | LIGNE_ATTENDUE.COMPLETE | calculé | RG-REC-018 | RG-X-004 | EX-REC-051 |
| LIGNE_ATTENDUE.ATTENDUE / PARTIELLE / COMPLETE | Réception portant le reçu > attendu × 1,10 | LIGNE_ATTENDUE.SURPLUS | calculé | RG-REC-018, 051 | RG-REC-183 ; RG-X-004, 017 | EX-REC-051, 060 |
| LIGNE_ATTENDUE.PARTIELLE / COMPLETE / SURPLUS | Retrait d'un rattachement, écart de contrôle, rebut qui change le reçu | recalcul (tout statut de la famille) | calculé | RG-REC-017, 018 | RG-X-004, 013 | EX-REC-057 |
| AFFICHE.(∅) | Valider la réception (voie dossier connu) | AFFICHE.IDENTIFIEE (+ TAG_A_CONTROLER) | recep ; coord* | RG-REC-039 | RG-REC-044 | EX-REC-014, 054 |
| AFFICHE.(∅) | Créer une réception inconnue | AFFICHE.ORPHELINE (+ TAG_RECEPTION_INCONNUE, TAG_A_CONTROLER) | recep ; coord* | RG-REC-095 | RG-REC-099 | EX-REC-036 |
| AFFICHE.ORPHELINE | Rattacher | AFFICHE.IDENTIFIEE | coord ; recep (Q-107) | RG-REC-107, 108 | RG-REC-109 | EX-REC-040 |
| AFFICHE.IDENTIFIEE | Retirer le dernier rattachement actif | AFFICHE.ORPHELINE | coord ; recep* | RG-REC-137 | RG-REC-114 | EX-REC-043 |
| AFFICHE.IDENTIFIEE | Changer de thème / ajouter ou retirer un rattachement | AFFICHE.IDENTIFIEE (+ TAG_FEUILLE_A_REFAIRE) | coord ; recep (reste à confirmer) | RG-REC-135, 136 | RG-REC-129 ; RG-X-012, 014 | EX-REC-048, 062 |
| AFFICHE (tag À contrôler) | Valider le contrôle | tag À contrôler levé | recep | RG-REC-069 | — | EX-REC-054 |
| AFFICHE (tag Complément) | 2e réception de l'affiche | TAG_COMPLEMENT posé | calculé | RG-REC-128 | — | EX-REC-016, 054 |
| FEUILLE.(∅) | Créer une réception inconnue (impression temporaire) | FEUILLE.TEMPORAIRE | recep | RG-REC-083 | — | EX-REC-029, 056 |
| FEUILLE.(∅) ou TEMPORAIRE | Valider le contrôle et imprimer (dossier connu, ou inconnue rattachée) | FEUILLE.DEFINITIVE | recep | RG-REC-084, 069 | RG-REC-085 | EX-REC-027, 056 |
| FEUILLE.DEFINITIVE | Réimprimer | FEUILLE.DEFINITIVE (tag Feuille à refaire levé) | recep ; coord* ; cheq* | RG-REC-087 | RG-REC-085 | EX-REC-033, 034 |
| FEUILLE.TEMPORAIRE | « Imprimer dans Réception des affiches » (inconnue contrôlée) | FEUILLE.DEFINITIVE | recep | RG-REC-084 | RG-REC-085, 187 | EX-REC-040 ; ECR-REC-04 |
| RECEPTION_INCONNUE.A_IDENTIFIER | Signaler à la Coordination | RECEPTION_INCONNUE.INTROUVABLE | recep ; coord* | RG-REC-112 | RG-REC-186 ; RG-X-008 | EX-REC-041, 055 |
| RECEPTION_INCONNUE.A_IDENTIFIER | Rattacher | RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | coord ; recep | RG-REC-107, 108 | RG-REC-109 | EX-REC-040, 055 |
| RECEPTION_INCONNUE.INTROUVABLE | Rattacher (après correction Broadcast) | RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | coord ; recep | RG-REC-107, 108 | RG-REC-109 ; Q-109 | EX-REC-055 (« à confirmer ») ; Q-109 |
| RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | Valider le contrôle sans imprimer | RECEPTION_INCONNUE.CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER | recep | RG-REC-072, 069 | RG-REC-187 | EX-REC-055, 068 |
| RECEPTION_INCONNUE.RATTACHEE_A_CONTROLER | Valider le contrôle et imprimer la feuille définitive | RECEPTION_INCONNUE.RATTACHEE_FEUILLE_DEFINITIVE | recep | RG-REC-072, 069, 084 | RG-REC-085 | EX-REC-027, 055 |
| RECEPTION_INCONNUE.CONTROLEE_FEUILLE_DEFINITIVE_A_IMPRIMER | Imprimer la feuille définitive | RECEPTION_INCONNUE.RATTACHEE_FEUILLE_DEFINITIVE | recep | RG-REC-084 | RG-REC-085 | EX-REC-055 |
| RECEPTION_INCONNUE.(RATTACHEE_* ou CONTROLEE_*) | Retirer le dernier dossier | RECEPTION_INCONNUE.A_IDENTIFIER | coord ; recep* | RG-REC-114 ; Q-108 | RG-X-013 | EX-REC-043 |
| AFFICHE_RECUE.NON | Valider la réception | AFFICHE_RECUE.OUI | recep ; coord* | RG-REC-044 | RG-X-005 | EX-REC-052 |
| VALIDATION_ADMIN.(∅) | Valider la réception, cas sûr | VALIDATION_ADMIN.PROPOSEE | système | RG-X-001 | RG-X-001 | EX-COO-004, 006 |
| VALIDATION_ADMIN.(∅) | Valider la réception, cas de doute | VALIDATION_ADMIN.A_FAIRE_DOUTE | système | RG-X-001, 002 | RG-X-001 | EX-COO-007 |
| VALIDATION_ADMIN.RECEPTION_INCONNUE | Rattacher par coord | VALIDATION_ADMIN.VALIDEE | coord | RG-REC-111 | RG-X-007 | EX-COO-010, 017 |
| VALIDATION_ADMIN.RECEPTION_INCONNUE | Rattacher par recep | VALIDATION_ADMIN.A_FAIRE_DOUTE (rattachement MAIN) | recep | RG-REC-111 | RG-X-007 | ECR-REC-04 ; Q-REC-18 maquette |
| VALIDATION_ADMIN.PROPOSEE / A_FAIRE_DOUTE | Valider | VALIDATION_ADMIN.VALIDEE | coord ; admin | RG-REC-003 | RG-X-001, 015 ; RG-COO | EX-COO-008, 010 |
| VALIDATION_ADMIN.VALIDEE | Annuler la validation | VALIDATION_ADMIN.ANNULEE | coord ; admin | RG-REC-003 | RG-X-015 | EX-COO-009 |
| VALIDATION_ADMIN.ANNULEE | Valider | VALIDATION_ADMIN.VALIDEE | coord ; admin | RG-REC-003 | RG-X-015 | EX-COO-009 |
| VALIDATION_ADMIN.VALIDEE | Changer de thème (par non-coord) / thème changé | VALIDATION_ADMIN.A_FAIRE_DOUTE | recep ; coord (si coord : reste validée) | RG-REC-135 | RG-X-012 ; Q-55 source | EX-COO-016 ; ECR-REC-05 |
| RATTACHEMENT.(∅) | Rattacher (auto à la réception, ou manuel) | RATTACHEMENT.ACTIF | recep ; coord | RG-REC-042, 049, 136 | RG-X-016 | EX-COO-039 |
| RATTACHEMENT.ACTIF | Retirer | RATTACHEMENT.RETIRE | coord ; recep* | RG-REC-137 | RG-X-013 | EX-REC-048 |
| MOUVEMENT.(∅) | Réception, complément, écart de contrôle, rebut, ajout/sortie manuel, expédition, fusion, renvoi, destruction | MOUVEMENT créé (append-only) | selon type | RG-REC-151 | — | EX-REC-057 |
| LEGACY.AFFICHE R/P | Mettre au rebus (legacy) | Rb (héritage) | — | RG-REC-157 | MODIFIÉE : remplacée par mouvement Mise au rebut (Q-118) | legacy RG-REC-040 |
| LEGACY.AFFICHE Rb (stock > 0) | Vider le rebus (legacy) | Rb (stock = 0) | — | RG-REC-158 | Q-118 | legacy RG-REC-041 |
| LEGACY.AFFICHE R/P | Fusion (rôle cible / chapeau) | Fc / Fh | — | RG-REC-163 | SUPPRIMÉE (écran) : Q-100 | legacy RG-REC-060/062 |

Transitions interdites notables (HTTP 409, `regle` = ID entre parenthèses) :

| Transition tentée | Pourquoi interdite | Règle |
|---|---|---|
| Contrôler / valider le contrôle d'une réception RECEPTION.A_IDENTIFIER | Elle n'entre pas dans le sas (rattacher d'abord) | RG-REC-071 |
| Valider le contrôle d'une réception déjà RECEPTION.CONTROLEE | Champs en lecture seule après contrôle | RG-REC-070 |
| RECEPTION.CONTROLEE → RECEPTION.A_CONTROLER | Aucun retour arrière décrit | RG-REC-070 |
| Rattacher (écran Réceptions inconnues) une affiche déjà AFFICHE.IDENTIFIEE | « Rattacher » ne s'applique qu'à une affiche orpheline ; ajouter un dossier passe par la fiche (+ Rattacher) | RG-REC-107 |
| Signaler « Dossier introuvable » sur une affiche non RECEPTION_INCONNUE.A_IDENTIFIER | Seul l'état « À identifier » propose le signalement | RG-REC-112 |
| RECEPTION_INCONNUE.INTROUVABLE → RECEPTION_INCONNUE.A_IDENTIFIER | Aucun retour décrit (le signalement ne se retire pas) | RG-REC-112 ; Q-109 |
| Valider (validation admin) une affiche VALIDATION_ADMIN.RECEPTION_INCONNUE | « À rattacher d'abord » | RG-REC-111 |
| Annuler la validation d'une affiche non VALIDEE | Rien à annuler | RG-REC-003 |
| Retirer un rattachement déjà RETIRE | Lien déjà retiré (un rattachement retiré n'est jamais réactivé : un nouveau lien est créé) | RG-REC-137 |
| Imprimer une feuille DEFINITIVE pour une affiche sans aucun dossier (ORPHELINE) | « Temporaire → Définitive dès qu'il y a un dossier » | RG-REC-084 |
| Modifier / ajouter / sortir une affiche héritée « fusionnée » (cible de fusion) | Lecture seule (héritage de l'UI legacy, désormais imposée au serveur) | RG-REC-169 |
| Dé-rebuter / sortir du rebus une affiche héritée | Aucune transition de sortie du rebus n'existe dans l'existant | RG-REC-157 ; Q-118 |
| Toute transition non listée en 3.2 | Table de transitions explicite (CLAUDE.md §6) | — |
