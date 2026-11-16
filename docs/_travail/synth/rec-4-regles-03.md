### RG-REC-053 — Sas : liste des palettes à contrôler
- Origine : NOUVELLE
- Énoncé : « Palettes à contrôler (sas) » liste les réceptions RECEPTION.A_CONTROLER, la plus ancienne en tête avec son temps d'attente. Colonnes : En attente depuis (« 35 min », « 7 h », « 2 j 3 h »), Réception (tag « réception inconnue »), Arrivée, Site, BL, Imprimeur, Affiches (nb de lignes), Qté du BL, Déchargé par ; bouton « Contrôler ». Recherche par n° de BL ou imprimeur. Une réception RECEPTION.A_IDENTIFIER n'y figure pas.
- Déclencheur : ouverture de l'étape 2.
- Conditions : réception du site choisi, statut A_CONTROLER.
- Effet / message d'erreur : liste vide : « Aucune palette à contrôler : le sas est vide. ». Clic de ligne = ouvre le contrôle.
- Sources : spec `[DC] §5` (EX-REC-018) · écran ECR-REC-02 (tableau du sas)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-054 — Badge du menu : nombre de palettes à contrôler
- Origine : NOUVELLE
- Énoncé : le badge de « Réception des affiches » = nombre de réceptions A_CONTROLER du périmètre ; il baisse à chaque contrôle validé et monte à chaque validation de réception ou rattachement d'une inconnue.
- Déclencheur : tout changement de statut de réception.
- Conditions : —
- Effet / message d'erreur : compteur recalculé (pas de comptage en dur).
- Sources : spec `[DC] §5` (EX-REC-018) · écran ECR-REC-01/02, `maquettes-autres-modules.md §0.1`
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-055 — Palette en retard dans le sas
- Origine : NOUVELLE
- Énoncé : au-delà de `delaiControle` (24 h par défaut, paramétrable) depuis `a_controler_depuis` : la palette est « en retard » (indicateur « Contrôle en retard ») ; encadré « n palette(s) dans le sas depuis plus de 24 h — À contrôler en premier : elles sont en tête de liste. » ; ligne teintée en avertissement au-delà du délai, en « important » au-delà du double ; alerte RG-REC-189.
- Déclencheur : calcul à l'affichage et par traitement périodique.
- Conditions : durée > délai ; comptage en heures calendaires ou ouvrées non précisé.
- Effet / message d'erreur : HYPOTHÈSE Q-157 : heures calendaires.
- Sources : spec `[DC] §5, §11` (EX-REC-019) ; `[PR] p.1` · écran ECR-REC-02 (teintes)
- Questions liées : Q-105, Q-157
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-056 — Contrôle de la palette : un écran, une ligne par affiche
- Origine : NOUVELLE
- Énoncé : le contrôle montre toute la palette (une réception) en un seul écran, une ligne par affiche : N° affiche (tag « complément »), Visuel (annonceur, thème, dossier, format ; ou « annonceur · libellé saisi » + tag « orpheline »), Qté du BL (« Qté saisie » pour une réception inconnue), Qté comptée, Allée, Rayon, Rebut, Non-conformité, Surplus. Hors tableau : Imprimeur (réception inconnue), Contrôleur, « Voir le BL », « Fermer le contrôle ». Le grain du contrôle est la réception (un BL) : HYPOTHÈSE Q-102.
- Déclencheur : « Contrôler » ou clic de ligne du sas.
- Conditions : réception A_CONTROLER.
- Effet / message d'erreur : si déjà contrôlée : champs en lecture seule (RG-REC-070).
- Sources : spec `[DC] §5, §16` (EX-REC-020) ; EX-REC-027 · écran ECR-REC-02 (formulaire)
- Questions liées : Q-102
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-057 — Quantité comptée : défaut et validité
- Origine : NOUVELLE
- Énoncé : « Qté comptée » = quantité du BL par défaut (ou quantité saisie pour une inconnue) ; nombre ≥ 0 ; l'écart s'affiche « ±N par rapport au BL ».
- Déclencheur : saisie au contrôle.
- Conditions : valeur < 0 refusée.
- Effet / message d'erreur : 400 `REC_QTE_NEGATIVE`.
- Sources : spec `[DC] §5` (EX-REC-021) · écran ECR-REC-02
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-058 — Écart de comptage : seuil de 10 %
- Origine : NOUVELLE
- Énoncé : si |comptée − BL| > `ecartReception` × quantité du BL (10 % par défaut), la ligne est teintée et le badge est « Important » (sinon « Info ») ; indicateur « Écart de comptage ». Base de calcul = quantité du BL ; le signalement n'est pas bloquant.
- Déclencheur : saisie de la quantité comptée.
- Conditions : écart relatif > seuil.
- Effet / message d'erreur : validation non bloquée ; alerte RG-REC-183.
- Sources : spec `[DC] §5, §10` (EX-REC-021) · écran ECR-REC-02
- Questions liées : Q-105, Q-133
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-059 — Mouvement « Contrôle (écart au BL) »
- Origine : NOUVELLE
- Énoncé : s'il y a écart (comptée ≠ BL), « Valider le contrôle » ajuste la quantité reçue et crée un mouvement « Contrôle (écart au BL) » de quantité = comptée − BL (signée). Réception et écart de contrôle comptent dans le reçu.
- Déclencheur : « Valider le contrôle et imprimer ».
- Conditions : comptée ≠ BL.
- Effet / message d'erreur : insert `mouvement` ; recalcul RG-REC-017/018 ; RG-X-017.
- Sources : spec `[DC] §5, §9` (EX-REC-021, 057) · écran ECR-REC-02
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-060 — Comptage par morceau
- Origine : NOUVELLE
- Énoncé : sous `comptageMorceau` (30 par défaut, paramétrable) l'écran indique « Comptage par morceau » ; au 8 m², « 4 morceaux par affiche ». Mécanique de saisie non décrite : libellé sans calcul dans la maquette. Même seuil pour tous les formats : non tranché.
- Déclencheur : quantité comptée < seuil.
- Conditions : comptée < 30.
- Effet / message d'erreur : texte « Comptage par morceau (4 morceaux par affiche) ».
- Sources : spec `[DC] §5, §11, §17` (EX-REC-022) ; EX-EXI-051 · écran ECR-REC-02
- Questions liées : Q-105, Q-140
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-061 — Allée et rayon obligatoires au contrôle
- Origine : NOUVELLE
- Énoncé : allée ET rayon sont obligatoires pour chaque affiche contrôlée ; les affiches quittent la zone tampon pour leur emplacement définitif. Allée en majuscules (placeholder « A-F »), rayon placeholder « 1-12 » : valeurs d'exemple, pas de contrôle de domaine (Q-154).
- Déclencheur : « Valider le contrôle et imprimer ».
- Conditions : allée ou rayon vide pour au moins une affiche.
- Effet / message d'erreur : 422 `REC_ALLEE_RAYON_OBLIGATOIRES` « Allée et rayon sont obligatoires pour chaque affiche. ».
- Sources : spec `[DC] §5` (EX-REC-023) ; legacy `affiche.allee`, `affiche.rayon` (RG-REC-024) · écran ECR-REC-02
- Questions liées : Q-106, Q-154
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-062 — Zone tampon et sortie
- Origine : NOUVELLE
- Énoncé : tant qu'une affiche n'est pas contrôlée elle est en zone tampon (allée/rayon définitifs vides ; réception inconnue : allée X). Le contrôle (ou « Ranger avant d'imprimer », RG-REC-088) donne l'emplacement définitif ; l'historique garde « Rangée : X-3 → B-7 (sortie de la zone tampon) ».
- Déclencheur : contrôle ; rangement.
- Conditions : —
- Effet / message d'erreur : mise à jour allée/rayon + historique (RG-REC-006).
- Sources : spec `[DC] §9` (EX-REC-056) · écran ECR-REC-02, ECR-REC-10
- Questions liées : Q-106
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-063 — Contrôleur : agent de réception, du référentiel
- Origine : NOUVELLE
- Énoncé : le contrôleur est un agent de réception choisi dans la liste des agents (REC-12). Un contrôleur lié à l'utilisateur connecté n'est pas spécifié.
- Déclencheur : choix du contrôleur.
- Conditions : valeur ∈ référentiel Agents de réception.
- Effet / message d'erreur : voir RG-REC-067.
- Sources : spec `[DC] §2, §5, §16` (EX-REC-026, 076) ; ateliers EX-REC-514 · écran ECR-REC-02
- Questions liées : Q-145
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-064 — Rebut au contrôle
- Origine : NOUVELLE
- Énoncé : « Rebut » = quantité ≥ 0 avec motif ; crée un mouvement « Mise au rebut » de quantité négative (plafonnée au disponible) ; le motif est la non-conformité choisie. Le rebut est une sortie de stock, ne réduit pas le reçu. Rebut possible plus tard dans Stocks (RG-REC-156).
- Déclencheur : « Valider le contrôle ».
- Conditions : rebut > 0.
- Effet / message d'erreur : insert `mouvement` ; stock = Σ mouvements ; refus si rebut > disponible : 422 `REC_REBUT_SUPERIEUR_STOCK`.
- Sources : spec `[DC] §5, §10` (EX-REC-024, 061) ; EX-STK-501, 504 · écran ECR-REC-02, ECR-STK-01
- Questions liées : Q-118, Q-142
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-065 — Non-conformité
- Origine : NOUVELLE
- Énoncé : non-conformité parmi : Conforme, Visuel non conforme, Quantité, Affiche abîmée, Bandeau manquant, Autre ; elle va dans l'historique (pas de mouvement). Lien vers l'application Process Métier à cadrer ; suivi des non-conformités dans Circé non fait.
- Déclencheur : choix au contrôle.
- Conditions : valeur ∈ liste.
- Effet / message d'erreur : entrée d'historique.
- Sources : spec `[DC] §5, §16` (EX-REC-028, 024) ; EX-QUA-501 · écran ECR-REC-02
- Questions liées : Q-142
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-066 — Surplus en entretien (« CG »)
- Origine : NOUVELLE
- Énoncé : case « +N en entretien » : apparaît seulement si compter ces quantités dépasserait l'attendu entretien compris ; le surplus est noté en entretien (`surplus_entretien`) et affiché « Entretien reçu en plus » dans la fiche. « CG » non défini.
- Déclencheur : saisie de la case au contrôle.
- Conditions : comptée > attendu avec entretien.
- Effet / message d'erreur : champ `surplus_entretien` renseigné.
- Sources : spec `[DC] §5, §10, §13` (EX-REC-025, 060) ; ateliers EX-FIX-506 · écran ECR-REC-02, ECR-REC-05
- Questions liées : Q-141
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-067 — Contrôleur obligatoire
- Origine : NOUVELLE
- Énoncé : « Valider le contrôle » exige un contrôleur.
- Déclencheur : « Valider le contrôle et imprimer ».
- Conditions : contrôleur vide.
- Effet / message d'erreur : 422 `REC_CONTROLEUR_OBLIGATOIRE` « Le nom du contrôleur est obligatoire (REC-12). ».
- Sources : spec `[DC] §2, §5, §16` (EX-REC-026) ; ateliers EX-REC-514 · écran ECR-REC-02
- Questions liées : Q-145
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-068 — Imprimeur corrigé pour une réception inconnue
- Origine : NOUVELLE
- Énoncé : au contrôle d'une réception inconnue rattachée, la quantité et l'imprimeur sont corrigeables (champ Imprimeur affiché seulement pour elle).
- Déclencheur : contrôle d'une inconnue rattachée.
- Conditions : réception inconnue.
- Effet / message d'erreur : imprimeur ∈ référentiel (RG-REC-035).
- Sources : spec `[DC] §5, §6` (EX-REC-027) · écran ECR-REC-02
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-069 — Valider le contrôle : effets
- Origine : NOUVELLE
- Énoncé : « Valider le contrôle et imprimer » dans une transaction : crée les mouvements (écart, rebut) ; enregistre contrôleur et date ; réception → CONTROLEE ; les affiches sortent du sas (tag « À contrôler » levé) ; surplus entretien noté ; non-conformité historisée ; recalcul des lignes et unités (RG-X-017) ; ouverture de l'aperçu d'impression des feuilles définitives avec étiquettes rack (RG-REC-084).
- Déclencheur : clic.
- Conditions : RG-REC-061, 067 ; réception A_CONTROLER.
- Effet / message d'erreur : après : « Imprimer la feuille définitive » ou « Réimprimer les feuilles de stock ».
- Sources : spec `[DC] §5, §6` (EX-REC-027) ; `[PR] p.2 (13-15)` · écran ECR-REC-02
- Questions liées : Q-102
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-070 — Contrôle terminé : lecture seule
- Origine : NOUVELLE
- Énoncé : une réception CONTROLEE est en lecture seule ; re-valider le contrôle ou revenir à A_CONTROLER est interdit (409).
- Déclencheur : tentative de modification.
- Conditions : statut CONTROLEE.
- Effet / message d'erreur : 409 `REC_CONTROLE_DEJA_FAIT`. Corrections ultérieures par mouvements (Q-121).
- Sources : écran ECR-REC-02 (« contrôle déjà fait = champs en lecture seule ») ; table des transitions §3.2
- Questions liées : Q-121
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-071 — Une réception « À identifier » n'est pas contrôlable
- Origine : NOUVELLE
- Énoncé : une réception A_IDENTIFIER n'entre pas dans le sas ; elle doit d'abord être rattachée.
- Déclencheur : tentative de contrôle.
- Conditions : statut A_IDENTIFIER.
- Effet / message d'erreur : 409 `REC_CONTROLE_INTERDIT_A_IDENTIFIER`.
- Sources : spec `[DC] §9` (EX-REC-053) · écran ECR-REC-02 (« A_IDENTIFIER n'entre pas dans le sas »)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-072 — Contrôle d'une réception inconnue rattachée
- Origine : NOUVELLE
- Énoncé : pour une réception inconnue rattachée : corriger quantité et imprimeur, ranger hors zone tampon, puis « Valider le contrôle et imprimer la feuille définitive » ; la feuille définitive remplace la temporaire.
- Déclencheur : contrôle d'une inconnue en A_CONTROLER.
- Conditions : rattachée à ≥ 1 dossier.
- Effet / message d'erreur : voir RG-REC-084.
- Sources : spec `[DC] §5, §6, §7` (EX-REC-027, 040) · écran ECR-REC-02
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-073 — Correction a posteriori des quantités du BL
- Origine : MODIFIÉE
- Énoncé : le legacy permet de modifier une livraison (en-tête, quantités REMPLACÉES, affiches retirées de la grille dissociées, nouveau mouvement créé pour chaque ligne > 0 : risque de doublon de quantité, aucune validation de dossier/semaines). La cible n'a aucune action d'édition de l'en-tête de réception ; qui peut corriger les quantités a posteriori n'est pas défini.
- Déclencheur : modification d'une réception validée.
- Conditions : —
- Effet / message d'erreur : HYPOTHÈSE Q-121 : pas de modification de l'en-tête ; corrections par mouvements d'écart.
- Sources : legacy `BLL/LivraisonAfficheService.cs:763-803`, `CTRL/LivraisonAfficheController.cs:253-264, 323-372` (RG-REC-079 provisoire) · spec `[DC] §4` (EX-REC-012) ; Q-REC-11, Q-REC-23 maquette · écran ECR-REC-06
- Questions liées : Q-121
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-074 — Pas de suppression ni d'annulation de réception
- Origine : CONSERVÉE
- Énoncé : l'existant n'a ni statut, ni suppression, ni annulation de livraison ; la « corbeille inopérante » est une anomalie à ne pas reprendre. En cible aucune suppression de réception n'est prévue.
- Déclencheur : —
- Conditions : —
- Effet / message d'erreur : aucune route de suppression ; 409 sinon.
- Sources : legacy « Livraison — pas de statut ni de suppression » ; spec EX-REC-081 · Q-122
- Questions liées : Q-122
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
