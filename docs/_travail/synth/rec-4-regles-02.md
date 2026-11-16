### RG-REC-027 — Photo du BL et pièces jointes : stockage, consultation, contrôles
- Origine : MODIFIÉE
- Énoncé : la photo du BL (et la photo d'une affiche) est stockée, reliée à la réception, et consultable au contrôle (« Voir le BL ») et depuis la fiche de réception. Legacy : upload d'un ou plusieurs fichiers → `photo` (intitulé, taille, extension) + fichier disque `<FileLivraisonPieceJointe>_<Ticks><ext>` + `asso_livraison_photo` ; téléchargement renvoyé en `application/pdf` quel que soit le type ; suppression seulement si le fichier existe sur disque ; AUCUNE validation de type, de taille ni de droit. Cible : type et taille validés, type MIME de téléchargement exact, suppression cohérente base/stockage, droits contrôlés (RG-REC-002).
- Déclencheur : « Photographier le BL », « Reprendre la photo », « Prendre une photo » (réception inconnue), téléchargement, suppression.
- Conditions : fichier d'un type et d'une taille acceptés (valeurs à fixer : Q-113) ; identifiant de réception non nul (le legacy lève une exception si `IdLivraisonPhoto` est nul).
- Effet / message d'erreur : photo rattachée à la réception ; refus 400 `REC_PHOTO_INVALIDE` (type/taille). Les autres pièces jointes de l'écran de livraison actuel ne sont pas confirmées dans la cible (Q-160).
- Sources : legacy `CTRL/LivraisonAfficheController.cs:482-542`, `BLL/LivraisonAfficheService.cs:959-1026`, `REPO/LivraisonAfficheRepository.cs:470-551` (RG-REC-080 provisoire) · spec `[DC] §4, §8` (EX-REC-003, EX-REC-012) ; `bdd.md §10` · écran ECR-REC-07, ECR-REC-11, ECR-REC-06
- Questions liées : Q-113, Q-160
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-028 — Lecture du BL et pré-remplissage
- Origine : NOUVELLE
- Énoncé : Circé lit sur la photo du BL : n° de contrat, annonceur, semaine, format, quantité, vignette du visuel ; il propose les réceptions attendues et pré-remplit le bon de livraison (n° de BL, imprimeur, transporteur, colis). Les lignes lues sont cochées au panier, les autres lignes du panier sont décochées ; l'agent vérifie. Circé retient comment le dossier a été trouvé (RG-REC-032). La technologie de lecture (OCR/vision) n'est pas spécifiée et est SIMULÉE dans la maquette ; le seuil de « lecture sûre » n'est pas défini.
- Déclencheur : « Mettre au panier » dans la modale Photo du BL.
- Conditions : photo fournie.
- Effet / message d'erreur : message « n ligne(s) du BL au panier, cochées pour ce BL… ; bon de livraison pré-rempli : vérifiez, puis validez la réception. » (+ « Une ligne sans dossier : réception inconnue. »). HYPOTHÈSE retenue (Q-112) : en V1 la photo est jointe et la recherche reste manuelle ; la lecture automatique est prévue derrière une interface `LlmProvider` sans implémentation de reconnaissance tant que Q-112 n'est pas tranchée.
- Sources : spec `[DC] §4` (EX-REC-004) ; `[DESIGN] §4.8` ; ateliers EX-REC-507 · écran ECR-REC-07 (mode BL)
- Questions liées : Q-112, Q-125
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-029 — Contrat illisible : candidats
- Origine : NOUVELLE
- Énoncé : si le n° de contrat d'une ligne du BL est illisible (pastille « Contrat illisible »), Circé propose des candidats classés : même annonceur, même semaine, même format, vignette ressemblante ; « Aucun : réception inconnue » ouvre le formulaire de réception inconnue pré-rempli. Algorithme de classement, nombre maximum de candidats et seuil non spécifiés (la maquette utilise un score fictif 0,5/0,2/0,1/0,15, un seuil 0,3 et 3 candidats : valeurs fabriquées, non reprises).
- Déclencheur : lecture du BL avec ligne au contrat illisible.
- Conditions : au moins un candidat au-dessus du seuil (valeur à fixer).
- Effet / message d'erreur : sans candidat : « Aucune réception attendue à proposer sur ce site. ».
- Sources : spec `[DC] §4` (EX-REC-005) · écran ECR-REC-07 (mode BL)
- Questions liées : Q-125
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-030 — Ligne cochée absente du BL photographié
- Origine : NOUVELLE
- Énoncé : pour des lignes trouvées par la recherche (et non par la photo), une ligne cochée qui est absente du BL photographié est signalée par un encadré d'avertissement « n ligne(s) cochée(s) absente(s) du BL photographié ». Le signalement est-il bloquant : non précisé.
- Déclencheur : photo du BL jointe alors que des lignes cochées viennent de la recherche.
- Conditions : ligne cochée non lue sur la photo.
- Effet / message d'erreur : HYPOTHÈSE (Q-167) : signalement NON bloquant, la validation reste possible.
- Sources : spec `[DC] §4, §17 (scénario 3)` (EX-REC-006) · écran ECR-REC-01 (carte Bon de livraison)
- Questions liées : Q-167
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-031 — Photographier une affiche : reconnaissance du visuel
- Origine : NOUVELLE
- Énoncé : « Photographier une affiche » : Circé reconnaît le visuel et propose les dossiers les plus proches (jusqu'à 3 dans la maquette, avec score) ; la photo de l'affiche est jointe à la réception ; la quantité sur la palette est saisie (nombre ≥ 0, défaut = reste du dossier reconnu) ; « Aucun : réception inconnue ». La reconnaissance visuelle (REC-17) est hors périmètre avant le 31/12 et simulée dans la maquette.
- Déclencheur : « Photographier une affiche ».
- Conditions : visuel reconnu ou choisi.
- Effet / message d'erreur : « Visuel reconnu : 1 ligne au panier ; la photo de l'affiche est jointe à la réception. » ; mode de rattachement VISUEL (RG-REC-032).
- Sources : spec `[DC] §4` (EX-REC-002, 507) ; ateliers · écran ECR-REC-07 (mode affiche)
- Questions liées : Q-112, Q-125
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-032 — Mode de rattachement mémorisé (BL, visuel, à la main)
- Origine : NOUVELLE
- Énoncé : chaque rattachement garde `mode_rattachement` : « BL » (contrat lu sur la photo du BL et choisi), « VISUEL » (reconnaissance d'une photo d'affiche), « MAIN » (n° de dossier tapé ou rattachement manuel depuis la fiche ou Réceptions inconnues). Cette valeur alimente la proposition de validation admin (motif de doute « Rattachée sans le n° du BL » pour VISUEL et MAIN, RG-X-002).
- Déclencheur : création d'un rattachement.
- Conditions : —
- Effet / message d'erreur : valeur écrite avec le rattachement (colonne `affiche.mode_rattachement` / `asso_affiche_visuel`).
- Sources : spec `[DC] §13` (EX-REC-080, EX-REC-004) ; EX-COO-005, 007 · écran ECR-REC-01/07, ECR-REC-04
- Questions liées : Q-125
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-033 — Formulaire « Bon de livraison » : champs et obligations
- Origine : MODIFIÉE
- Énoncé : champs : Lignes de ce BL (lecture : nb de lignes et d'affiches) ; Date de livraison (lecture = maintenant) ; N° de BL (texte, OBLIGATOIRE ; BL imprimeur = BL transporteur) ; Transporteur (liste des livreurs, OBLIGATOIRE) ; Imprimeur (liste, OBLIGATOIRE) ; Nombre de colis / palettes (nombre ≥ 1, défaut 1) ; « Déchargé par » (liste des agents de réception, plus de champ libre ; facultatif dans la maquette). Legacy : Référence (BL), Expéditeur (= transporteur), Imprimeur obligatoires + date, nbre de colis, ref dossier, ref DA, commentaire, déchargé par (texte libre).
- Déclencheur : « Valider la réception ».
- Conditions : N° de BL, transporteur ou imprimeur vide.
- Effet / message d'erreur : 422 `REC_BL_CHAMPS_OBLIGATOIRES`, message « N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. ». Messages legacy par champ (clés `Reference`, `Expediteur`, `Imprimeur`) : « Il faut renseigner la réference », « Il faut vérifier l'expéditeur », « Il faut vérifier l'imprimeur ».
- Sources : legacy `CTRL/LivraisonAfficheController.cs:396-447 (430, 440)`, `BLL/LivraisonAfficheService.cs:852-862`, `JS/LivraisonListeAffiche.js:160-168, 211-217` (RG-REC-074 provisoire) · spec `[DC] §4, §14` (EX-REC-012, 013) · écran ECR-REC-01 (carte Bon de livraison)
- Questions liées : Q-116, Q-121, Q-163
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-034 — Date de livraison
- Origine : MODIFIÉE
- Énoncé : la date de livraison est obligatoire et valide ; en cible elle est en LECTURE = date et heure de la validation (la modification de la date de livraison de la fenêtre actuelle n'est pas confirmée dans la cible). La date de livraison devient la `date_entree` des affiches créées.
- Déclencheur : « Valider la réception ».
- Conditions : date ≤ valeur minimale (`DateTime.MinValue`) refusée dans le legacy.
- Effet / message d'erreur : legacy : « La date de livraison n'est pas valide » (clé `DateLivraison`).
- Sources : legacy `CTRL/LivraisonAfficheController.cs:396-447`, `BLL/LivraisonAfficheService.cs:852-862` (RG-REC-074 provisoire) · spec `[DC] §4` (EX-REC-012, ambiguïté) · écran ECR-REC-01 (Date de livraison : lecture = maintenant)
- Questions liées : Q-121
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-035 — Imprimeurs, transporteurs et agents : listes fermées des référentiels
- Origine : MODIFIÉE
- Énoncé : Imprimeur, Transporteur (livreur) et « Déchargé par » / Contrôleur sont choisis dans les référentiels Imprimeurs, Livreurs, Agents de réception (Administration, lot 0). Un transporteur ou imprimeur inconnu n'est JAMAIS créé : la création automatique du legacy est inopérante (condition `Expediteurs == null && !(…).Any(…)` jamais vraie, `CreateNewExpediteur/Imprimeur` jamais appelées) et la saisie libre n'enrichit pas `tr_transposteur_reception` / `tr_imprimeur`.
- Déclencheur : validation d'une réception ; création d'une réception inconnue ; contrôle.
- Conditions : valeur absente du référentiel.
- Effet / message d'erreur : 422 `REC_REFERENTIEL_INCONNU` (HYPOTHÈSE Q-115 : pas de création à la volée ; l'administrateur ajoute la valeur dans Administration).
- Sources : legacy `BLL/LivraisonAfficheService.cs:852-862` (RG-REC-074 provisoire) · spec `[DC] §11, §15` (EX-REC-074, EX-ADM-501) · écran ECR-ADM-07
- Questions liées : Q-115
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-036 — Unicité du n° de BL
- Origine : NOUVELLE
- Énoncé : le n° de BL est contrôlé contre les réceptions existantes. Le legacy n'a aucun contrôle d'unicité de `Reference` et le schéma n'a aucune contrainte (`bdd.md §10` propose d'ajouter l'unicité de `livraison.Reference`). Périmètre d'unicité (BL seul, BL + imprimeur, BL + plateforme) non tranché.
- Déclencheur : « Valider la réception ».
- Conditions : même n° de BL déjà utilisé sur ce périmètre.
- Effet / message d'erreur : HYPOTHÈSE (Q-114) : avertissement avec confirmation explicite (code `REC_BL_DOUBLON`, message « Ce n° de BL a déjà été réceptionné (réception R…). Continuer ? »), non bloquant (un complément arrive sous un autre BL).
- Sources : legacy `BLL/LivraisonAfficheService.cs:852-862` · `bdd.md §10` (contraintes absentes à ajouter)
- Questions liées : Q-114
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-037 — Ordre des refus à « Valider la réception »
- Origine : MODIFIÉE
- Énoncé : « Valider la réception » refuse, dans cet ordre et au premier échec : (1) panier vide ; (2) aucune ligne cochée ; (3) lignes cochées sur deux plateformes ; (4) BL non photographié ; (5) n° de BL, transporteur ou imprimeur vide. Aucune écriture n'est faite en cas de refus (le legacy poursuit : après une erreur de validation il crée quand même des mouvements sur une livraison vide et envoie le mail).
- Déclencheur : clic « Valider la réception ».
- Conditions : voir ordre.
- Effet / message d'erreur : (1) 422 `REC_PANIER_VIDE` « Le panier est vide. » ; (2) 422 `REC_AUCUNE_LIGNE_COCHEE` « Cochez dans le panier les lignes de ce BL. » ; (3) 422 `REC_BL_DEUX_PLATEFORMES` « Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. » ; (4) 422 `REC_PHOTO_BL_MANQUANTE` « Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche. » ; (5) 422 `REC_BL_CHAMPS_OBLIGATOIRES` « N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. ».
- Sources : legacy `CTRL/LivraisonAfficheController.cs:221-250, 285-295` (RG-REC-077 provisoire : erreur non bloquante) · spec `[DC] §4` (EX-REC-013) · écran ECR-REC-01 (règles visibles au clic, `reception.js:503-509`)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-038 — Valider la réception : création de la réception « À contrôler »
- Origine : MODIFIÉE
- Énoncé : « Valider la réception » crée UNE réception (palette = un BL) au statut RECEPTION.A_CONTROLER, avec photo du BL, en-tête (RG-REC-033), date de livraison, `a_controler_depuis` = maintenant ; la palette passe à l'étape 2 sans étiquette de palette. Legacy : création d'une `livraison` sans statut ni plateforme.
- Déclencheur : « Valider la réception » après contrôles (RG-REC-037).
- Conditions : toutes les gardes de RG-REC-037 passées.
- Effet / message d'erreur : confirmation (maquette) « Réception R… : n ligne(s), « affiche reçue » = oui dès l'arrivée ; n unité(s) prête(s) à produire. La palette passe à l'étape 2 (contrôle). Validation admin : n rattachement(s) proposé(s) à confirmer, n avec un doute… (Coordination). [Il reste n ligne(s) au panier…] ».
- Sources : legacy `BLL/LivraisonAfficheService.cs:399-530` (RG-REC-075 provisoire) · spec `[DC] §4, §15` (EX-REC-014, 001) · écran ECR-REC-01 (effets), ECR-REC-02
- Questions liées : Q-102, Q-168
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-039 — Création des affiches à la réception
- Origine : MODIFIÉE
- Énoncé : pour chaque ligne cochée à quantité > 0, une affiche est créée (n° d'affiche généré), statut IDENTIFIEE, tag « À contrôler », en zone tampon (allée/rayon vides), avec : plateforme et support (format) issus de la ligne attendue, `date_entree` = date de livraison, annonceur, dossier, thème (saisi sinon thème de la ligne), repiquage vide par défaut, quantité = quantité du BL, description. Legacy : affiche créée avec `quantite = SaisieQte_Rec`, GUID ; pour un BC saisi à la main (prépa non trouvée) `sup_id` par nom de format (`GetFormatId` renvoie 0 si inconnu → violation de FK probable) : en cible le format est obligatoire et connu.
- Déclencheur : « Valider la réception ».
- Conditions : ligne cochée, quantité > 0, `affiche_id` ≤ 0 (pas de complément, RG-REC-040).
- Effet / message d'erreur : insert `affiche` ; historique `CreationAffiche` pour chaque affiche créée (pas pour une affiche existante ré-associée).
- Sources : legacy `BLL/LivraisonAfficheService.cs:436-478, 490, 496-518` (RG-REC-075 provisoire) · spec `[DC] §4` (EX-REC-014) · écran ECR-REC-01
- Questions liées : Q-168
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-040 — Complément d'une affiche déjà reçue en partie
- Origine : MODIFIÉE
- Énoncé : si le visuel est déjà reçu en partie, la ligne propose la case « Complément de l'affiche N » : la nouvelle quantité s'ajoute à la MÊME affiche (même n° d'affiche), avec un mouvement « Réception (complément) » ; les deux réceptions sont gardées pour la traçabilité ; le tag « Complément » apparaît dès deux réceptions. Le thème ne disparaît pas à la 2e livraison. Legacy : sur une affiche existante, `quantite` et `SaisieQte_Rec` sont REMPLACÉES (non cumulées) et un nouveau mouvement s'ajoute.
- Déclencheur : « Valider la réception » avec case « Complément » cochée.
- Conditions : visuel déjà reçu en partie (statut ligne Partielle).
- Effet / message d'erreur : quantité reçue cumulée par mouvements ; `NumeroLivraison` = nb d'associations + 1 (legacy conservé).
- Sources : legacy `BLL/LivraisonAfficheService.cs:484-485, 787` (RG-REC-075, 023 provisoires) · spec `[DC] §4, §10, §16` (EX-REC-016, REC-22) ; ateliers EX-REC-511 · écran ECR-REC-01 (colonne Livraison en deux fois)
- Questions liées : Q-103
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-041 — Mouvements de réception
- Origine : CONSERVÉE
- Énoncé : pour chaque ligne dont la quantité > 0, un mouvement est créé : quantité = quantité du BL, type « Réception » (ou « Réception (complément) »), récépissé = imprimeur de la réception, expéditeur = transporteur, `comptee`, `livraison_id`, auteur = utilisateur. Les lignes à quantité ≤ 0 ne génèrent aucun mouvement. Un mouvement par affiche créée.
- Déclencheur : « Valider la réception ».
- Conditions : quantité > 0.
- Effet / message d'erreur : insert `mouvement` (append-only). Le legacy fait un `SaveChanges` par ligne ; en cible dans la transaction de RG-REC-046.
- Sources : legacy `CTRL/LivraisonAfficheController.cs:226-232, 257-263, 301-310`, `BLL/LivraisonAfficheService.cs:827-844`, `REPO/LivraisonAfficheRepository.cs:243-261` (RG-REC-076 provisoire) · spec `[DC] §9, §13` (EX-REC-057) ; ateliers EX-STK-501 (réception = entrée de stock des quantités saisies)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-042 — Rattachement initial à la ligne attendue choisie
- Origine : MODIFIÉE
- Énoncé : à la réception, l'affiche créée est rattachée (lien affiche ↔ ligne attendue AVEC quantité = quantité du BL) à la ligne choisie ; le rattachement n'efface jamais un lien existant. Legacy : l'affiche est liée à la ligne choisie ET à toutes les lignes `tf_prepa_affiche` de mêmes (dossier, format texte, annonceur, thème, plateforme, semaine, année), `ARecevoir = true`, `dateModified` mis à jour, SANS filtre sur une association préexistante (peut ré-associer des prépas déjà liées à une autre affiche). En cible il n'y a qu'une ligne active par clé (RG-AT-01 de la Coordination) : plus de lignes jumelles à rattacher.
- Déclencheur : « Valider la réception ».
- Conditions : ligne attendue trouvée ; sinon réception inconnue (RG-REC-095) ou ligne provisoire sans IP (RG-X-020).
- Effet / message d'erreur : lien créé avec `mode_rattachement` (RG-REC-032) ; recalcul du reçu (RG-REC-017) ; proposition de validation admin (RG-X-001).
- Sources : legacy `BLL/LivraisonAfficheService.cs:455-476, 522-527`, `REPO/LivraisonAfficheRepository.cs:392-413` (RG-REC-075 provisoire ; RG-COO-020 provisoire de legacy-coordination.md) · spec `[RA] §5` (EX-COO-039, EX-COO-032) ; EX-EXI-056
- Questions liées : Q-123, Q-147
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-043 — Famille de formats 2 m² (propagation et recherche)
- Origine : CONSERVÉE
- Énoncé : les formats « 2m2 », « 2 m2 », « 2m2 Scrolling », « 2m2 Venusial » forment une famille : (1) à la réception, le rattachement s'étend à toutes les lignes 2 m² du même dossier/annonceur/thème/plateforme/semaine ; (2) dans la recherche de lignes à rattacher, si le support de l'affiche commence par « 2m2 », la liste de supports = tous les supports « 2m2* » + « Scrolling MUI Paris » ; (3) l'affichage renomme « 2m2 Scrolling » et « 2m2 Venusial » en « 2m2 ». Règle legacy non reprise ni retirée par les specs.
- Déclencheur : validation d'une réception ; recherche d'une ligne à rattacher.
- Conditions : format ∈ famille.
- Effet / message d'erreur : voir énoncé. Applicabilité en cible (une ligne par clé, support par `IdSurface × IdFormat`) à confirmer.
- Sources : legacy `BLL/LivraisonAfficheService.cs:458-476`, `BLL/ReceptionListeAfficheBll.cs:420-435`, `FN/Fn_GetPrepaAffiche.sql` (RG-REC-075, 071, 090 provisoires) · spec `[RA] §5` (EX-COO-033)
- Questions liées : Q-147
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-044 — « Affiche reçue » = oui dès l'arrivée de la palette
- Origine : MODIFIÉE
- Énoncé : « Affiche reçue » passe à « oui » dès « Valider la réception », sur la quantité du BL, posé par la réception indépendamment de la validation admin ; le contrôle corrige ensuite la quantité. En V2 : « affiche reçue » = « un mouvement de réception existe ». Legacy (ANO-05) : « Aff. reçues » de l'état des réservations n'affiche « oui » qu'après la validation admin (reçue ET validée), dès qu'UNE affiche validée correspond au dossier, à la semaine, à l'année et au thème exact (sans test de plateforme ni de face).
- Déclencheur : « Valider la réception ».
- Conditions : au moins un mouvement de réception pour l'affiche.
- Effet / message d'erreur : indicateur lu par l'état des réservations et le suivi (RG-X-005). La question source Q31 (« à l'arrivée ou après le contrôle ? ») reste ouverte ; la maquette pose à l'arrivée.
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:172-201` (RG-COO-028 provisoire ; RG-RPR-026) · spec `[DC] §9, §17` (EX-REC-052) ; ateliers EX-REC-503 ; `[README] §6 H14` ; EX-EXI-055
- Questions liées : Q-104
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-045 — Après validation : champs vidés et champs conservés
- Origine : NOUVELLE
- Énoncé : après « Valider la réception », N° de BL, imprimeur et nombre de colis se vident ; transporteur et « Déchargé par » restent ; la photo du BL mémorisée est remise à zéro ; les lignes cochées quittent le panier, les autres restent.
- Déclencheur : succès de la validation.
- Conditions : —
- Effet / message d'erreur : formulaire prêt pour le BL suivant.
- Sources : spec `[DC] §4, §15` (EX-REC-014) · écran ECR-REC-01 (règles visibles : `bl`, `imprimeur`, `nbColis` remis à zéro)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-046 — Atomicité de « Valider la réception »
- Origine : MODIFIÉE
- Énoncé : toute la validation (réception, affiches, rattachements, mouvements, historique/journal, recalcul des lignes attendues et des unités, alertes) s'exécute dans UNE transaction ; en cas d'échec rien n'est enregistré. Legacy : plusieurs `SaveChanges` successifs sans transaction (livraison, affiches, mouvements ; pour la livraison « orpheline » les affiches sont persistées AVANT les contrôles de format, d'où des affiches orphelines sans livraison en cas d'erreur).
- Déclencheur : « Valider la réception » ; « Créer, ranger et imprimer la feuille temporaire ».
- Conditions : —
- Effet / message d'erreur : erreur technique : 500 `REC_ERREUR_INTERNE` sans donnée résiduelle.
- Sources : legacy `BLL/LivraisonAfficheService.cs:399-530, 532-624 (« CLARK : Correction »)`, `CTRL/LivraisonAfficheController.cs:221-321` (RG-REC-075, 078 provisoires) · CLAUDE.md §6
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-047 — Réception sans IP : intitulé saisi
- Origine : MODIFIÉE
- Énoncé : si les IP (instructions de pose = thèmes saisis dans Broadcast) ne sont pas saisies, la ligne affiche le thème « (IP non saisies) » et le panier propose un champ « Intitulé saisi (sans IP) » pré-rempli avec l'intitulé de l'autre plateforme (« déjà saisi par <site> (affiche n°), le 1er qui a parlé ») ; l'agent le valide ou le corrige. Ce n'est PAS une réception inconnue : on reçoit sur le dossier. Une alerte « Réception sans instructions de pose » part à la Coordination (RG-REC-184). Legacy : l'agent saisit manuellement le thème (deux intitulés possibles selon la plateforme, puis un 3e à la saisie des IP).
- Déclencheur : mise au panier d'une ligne dont `ipSaisies = non`.
- Conditions : IP non saisies.
- Effet / message d'erreur : l'intitulé saisi devient le thème de l'affiche (annonceur du dossier conservé).
- Sources : spec `[DC] §4, §7, §10, §11` (EX-REC-017) ; ateliers EX-REC-506, EX-THM-501 ; EX-EXI-079 · écran ECR-REC-01 (carte Lignes du BL)
- Questions liées : Q-111
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-048 — Intitulé de thème : règle du « 1er qui a parlé »
- Origine : NOUVELLE
- Énoncé : si les IP ne sont pas connues à la réception, la 1re plateforme qui reçoit donne un intitulé, proposé à l'autre plateforme si elle attend aussi un visuel pour le dossier (éviter deux thèmes pour le même visuel). Si les thèmes existent déjà (IP saisies) : rien à faire. Réception partielle : retrouver le thème utilisé la 1re fois. À la saisie des IP la Pré-Prod garde « autant que possible » le nom saisi en premier ; si elle corrige l'intitulé, les plateformes sont informées par alerte (RG-REC-188) pour réimprimer les feuilles de stock. Il n'existe pas de règle de nommage.
- Déclencheur : réception d'un dossier commun à deux plateformes sans IP ; saisie des IP.
- Conditions : dossier présent sur deux plateformes sans IP.
- Effet / message d'erreur : suggestion proposée dès 3 caractères d'annonceur dans le formulaire de réception inconnue (maquette).
- Sources : spec `[DC] §4, §7` ; ateliers EX-THM-501, EX-REC-506, EX-REC-520
- Questions liées : Q-143
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-049 — Une affiche pour plusieurs dossiers (plusieurs-à-plusieurs, sans limite)
- Origine : MODIFIÉE
- Énoncé : un même visuel peut servir plusieurs dossiers (33 cité) et plusieurs semaines ; le lien affiche ↔ ligne attendue est plusieurs-à-plusieurs avec une QUANTITÉ par dossier, sans limite de nombre (ANO-12). Legacy : une seule affiche par ligne attendue (`affiche_livraison_Id`) ; la réception ne crée la réception que sur un seul dossier ; les autres (32) sont rattachés par la Pré-Prod dans l'onglet Préparation ; le champ « dossiers » de l'onglet Détail est limité en taille.
- Déclencheur : rattachement (réception, Réceptions inconnues, fiche affiche).
- Conditions : quantité par dossier ≥ 1.
- Effet / message d'erreur : voir RG-REC-108, 136.
- Sources : legacy `bdd.md §2.1` (« une affiche au plus par ligne ») ; EX-EXI-056, 058 · spec `[DC] §10, §13` (EX-REC-058, 048) · écran ECR-REC-05 (annotation ANO-12)
- Questions liées : Q-123
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-050 — Réception partielle
- Origine : NOUVELLE
- Énoncé : on valide ce qui est reçu ; la ligne attendue passe « Partielle » et le reste à recevoir garde son alerte (« Visuel reçu en partie ») ; la quantité n'est pas une condition de la validation admin (le partiel est validé pour ce qu'il contient, exemple 3/3/3 : A 3, B 2, C 0 → A et B validées, rien à valider pour C ; le complément de B est proposé puis confirmé à sa réception).
- Déclencheur : réception d'une quantité inférieure à l'attendu.
- Conditions : reçu < attendu.
- Effet / message d'erreur : voir RG-REC-018, 182, RG-X-018.
- Sources : spec `[DC] §10` (EX-REC-059) ; EX-COO-011 · écran ECR-REC-01
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-051 — Trop reçu : Surplus au-delà de 10 %
- Origine : NOUVELLE
- Énoncé : le reçu est « Surplus » au-delà de attendu × (1 + `ecartReception`) ; une alerte « Écart de réception supérieur à 10 % » est levée (RG-REC-183) ; au contrôle, le surplus des « CG » se compte en entretien (RG-REC-066).
- Déclencheur : réception ou contrôle portant le reçu au-delà du seuil.
- Conditions : reçu > attendu × 1,10 (paramètre).
- Effet / message d'erreur : pastille Surplus (À surveiller), ligne teintée en avertissement.
- Sources : spec `[DC] §10, §11` (EX-REC-060) · écran ECR-REC-01 (statut Surplus)
- Questions liées : Q-105, Q-141
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-052 — Affiche livrée après purge de sa ligne attendue
- Origine : NOUVELLE
- Énoncé : une affiche livrée alors que sa ligne attendue a été purgée (RG-REC-180) passe par « Réception inconnue… » (puis rattachement).
- Déclencheur : arrivée d'une palette sans ligne attendue correspondante.
- Conditions : aucune ligne attendue active ne correspond.
- Effet / message d'erreur : voir RG-REC-095.
- Sources : spec `[DC] §10` (EX-REC-044)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
