### RG-REC-076 — Feuille de stock = étiquette rack
- Origine : MODIFIÉE
- Énoncé : la feuille de stock est l'étiquette rack de Circé (`Reports/EtiquetteRackAffiche.rdlc`, A4), même modèle, avec la mention « définitive » ou « temporaire » dans le bandeau du haut. Le legacy produit l'étiquette en PDF ou impression directe (RDLC/ReportViewer, côté serveur).
- Déclencheur : toute impression de feuille de stock.
- Conditions : affiche existante.
- Effet / message d'erreur : voir RG-REC-077 à 094. Rendu PDF côté navigateur (CLAUDE.md §3).
- Sources : legacy `W/Reports/Rapport.cs:961-1025` (RG-REC-100 provisoire ; RG-ADM-060) · spec `[DC] §6` (EX-REC-029) ; EX-TRA-024
- Questions liées : Q-002, Q-129
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-077 — Mention « FEUILLE DE STOCK DÉFINITIVE / TEMPORAIRE »
- Origine : NOUVELLE
- Énoncé : bandeau « FEUILLE DE STOCK DÉFINITIVE » (+ « Dossier identifié : n ») ou « TEMPORAIRE » (+ « Réception inconnue · rangée en zone tampon · à remplacer par la feuille définitive… »). Place exacte à valider.
- Déclencheur : impression.
- Conditions : type de feuille de l'affiche.
- Effet / message d'erreur : mention imprimée.
- Sources : spec `[DC] §6` (EX-REC-029) · écran ECR-REC-09
- Questions liées : Q-126
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-078 — Contenu de la feuille
- Origine : CONSERVÉE
- Énoncé : n° d'affiche en très gros (72 pt), format (36 pt), date de réception, adressage (allée - rayon), quantité, code-barres, dossier, semaines, annonceur, thème, repiquage, commentaire, « Affiche à conserver : Oui/Non », 1er départ en gros ; tableau Dossier, Thème, Annonceur, Format, Départ (« S43 /2026 »), Qté prépa., numéro de demande (DA) ; pied « Page 1/1 ». Commentaire = commentaire de l'affiche + deux espaces + commentaire de la réception ; Ref DA = première association ; `Qte_Theorique` NULL forcé à 0.
- Déclencheur : impression.
- Conditions : —
- Effet / message d'erreur : feuille A4.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:332-352`, `REPO/ReceptionListeAfficheRepository.cs:482-501`, `W/Reports/Rapport.cs:961-1025` (RG-REC-100 ; RG-ADM-062) · spec `[DC] §6` (EX-REC-031) · écran ECR-REC-09
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-079 — Code-barres « A- » + id sur 13 caractères
- Origine : CONSERVÉE
- Énoncé : `code_barres` = « A- » suivi de `affiche_id` complété par des zéros à gauche pour atteindre 13 chiffres (id 123 → `A-0000000000123`).
- Déclencheur : impression.
- Conditions : `affiche_id` ≤ 13 chiffres.
- Effet / message d'erreur : code imprimé.
- Sources : legacy `W/Reports/Rapport.cs:961-1025` (RG-ADM-062) ; `SP/p_EditionPicking.sql:22-80` · spec `[DC] §6` (EX-REC-031)
- Questions liées : Q-168
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-080 — Quantité imprimée = somme des mouvements
- Origine : CONSERVÉE
- Énoncé : la quantité de la feuille est la somme des mouvements de l'affiche (pas `affiche.quantite`).
- Déclencheur : impression.
- Conditions : —
- Effet / message d'erreur : 0 si aucun mouvement.
- Sources : legacy `W/Reports/Rapport.cs:961-1025` ; `SP/p_EditionPicking.sql` (RG-REC-023, 101) · spec `[DC] §9` (EX-REC-057)
- Questions liées : Q-103
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-081 — Premier départ en gros
- Origine : CONSERVÉE
- Énoncé : « 1er départ » = minimum des semaines de départ des lignes rattachées.
- Déclencheur : impression.
- Conditions : au moins un rattachement.
- Effet / message d'erreur : semaine en 48 pt.
- Sources : legacy `W/Reports/Rapport.cs:961-1025` (RG-ADM-062) · spec EX-REC-031
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-082 — Fond jaune des dossiers multi-semaines
- Origine : NOUVELLE
- Énoncé : la feuille DÉFINITIVE est imprimée sur fond jaune si le dossier est multi-semaines (REC-13). Legacy : feuille jaune (S41/S42/S43) réimprimée à la main et posée par les chefs d'équipe. Définition de « multi-semaines » et sort de REC-13 face au scan de BL multiples : Q18 source.
- Déclencheur : impression définitive.
- Conditions : ≥ 2 semaines de départ distinctes (HYPOTHÈSE Q-127).
- Effet / message d'erreur : fond jaune.
- Sources : spec `[DC] §6, §10` (EX-REC-030) ; EX-EXI-052
- Questions liées : Q-127
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-083 — Feuille temporaire
- Origine : NOUVELLE
- Énoncé : une feuille TEMPORAIRE est imprimée à la création d'une réception inconnue ; elle porte allée et rayon de la zone tampon.
- Déclencheur : création d'une réception inconnue.
- Conditions : —
- Effet / message d'erreur : affiche FEUILLE.TEMPORAIRE.
- Sources : spec `[DC] §6, §7` (EX-REC-029) · écran ECR-REC-08/09
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-084 — Feuille définitive
- Origine : NOUVELLE
- Énoncé : la feuille DÉFINITIVE est imprimée au contrôle d'une palette de dossier connu ou d'une inconnue rattachée, en lot, avec étiquettes rack ; elle remplace la temporaire. Impossible sans dossier (« Temporaire → Définitive dès qu'il y a un dossier »).
- Déclencheur : « Valider le contrôle et imprimer » ; « Imprimer dans Réception des affiches ».
- Conditions : ≥ 1 rattachement actif.
- Effet / message d'erreur : sans dossier : 409 `REC_FEUILLE_DEFINITIVE_IMPOSSIBLE`.
- Sources : spec `[DC] §5, §6, §9` (EX-REC-027, 056) · écran ECR-REC-02/09
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-085 — Type de feuille noté, tag « Feuille à refaire » levé
- Origine : NOUVELLE
- Énoncé : l'impression note le type de feuille posée (`feuilleImprimee`), écrit l'historique, lève le tag « Feuille à refaire », applique le nouvel intitulé si changement de thème. Stockage du type : « sans place dans la base » (à créer).
- Déclencheur : impression.
- Conditions : —
- Effet / message d'erreur : « n feuille(s) (… ) [et n étiquette(s) rack] envoyées à l'imprimante. ».
- Sources : spec `[DC] §6, §9` (EX-REC-033) · écran ECR-REC-09
- Questions liées : Q-126
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-086 — Impression en lot : exemplaires
- Origine : NOUVELLE
- Énoncé : impression en lot, `exemplairesFeuille` exemplaires par défaut 2 (palette et Coordination), paramétrable de 1 à 5 ; avec ou sans étiquettes rack. Boutons « Imprimer (2 exemplaires) » / « … et les étiquettes rack ».
- Déclencheur : aperçu d'impression.
- Conditions : valeur ∈ [1 ; 5].
- Effet / message d'erreur : hors bornes : 400.
- Sources : spec `[DC] §6, §11, §17` (EX-REC-032) ; `[PR] p.1` · écran ECR-REC-09
- Questions liées : Q-128
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-087 — Réimpressions
- Origine : NOUVELLE
- Énoncé : réimpression possible depuis : Liste des affiches (« Réimprimer les feuilles à refaire (n) », « Imprimer les feuilles de stock », « Étiquettes rack »), ligne attendue « Contrôlée » (« Feuille de stock »), fiche de l'affiche.
- Déclencheur : actions citées.
- Conditions : action « à refaire » seulement si une sélectionnée porte le tag.
- Effet / message d'erreur : RG-REC-085.
- Sources : spec `[DC] §6, §8` (EX-REC-034) · écran ECR-REC-03/05
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-088 — « Ranger avant d'imprimer »
- Origine : NOUVELLE
- Énoncé : si des affiches à réimprimer sont encore en allée X, la modale propose allée/rayon (facultatifs : vide = reste en zone tampon) ; « Ranger et voir les feuilles » met à jour l'emplacement (historique) puis ouvre l'aperçu.
- Déclencheur : « Réimprimer les feuilles à refaire ».
- Conditions : affiches en zone tampon.
- Effet / message d'erreur : historique « Rangée : X-3 → B-7 ».
- Sources : spec `[DC] §8` (EX-REC-045) · écran ECR-REC-10
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-089 — Étiquette rack imprimée à la validation admin
- Origine : MODIFIÉE
- Énoncé : quand la validation admin passe de non validée à validée, l'étiquette rack est envoyée aux imprimantes de la plateforme ; aucun effet au décochage. Legacy : impression sans gestion d'échec (exception après sauvegarde). En cible l'échec n'annule pas la validation (RG-REC-092). Étiquettes en rafale lors d'une confirmation en lot : Q62 source.
- Déclencheur : passage à « validée ».
- Conditions : ancienne valeur ≠ vrai ; imprimante renseignée.
- Effet / message d'erreur : impression ; journal.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:177, 189-192, 454-465` (RG-REC-028 ; RG-COO-027) · spec EX-COO-014
- Questions liées : Q-002, Q-162
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-090 — Impressions multiples en un clic
- Origine : NOUVELLE
- Énoncé : cocher plusieurs lignes de la Liste des affiches et imprimer feuilles/étiquettes rack en un clic (toast « n étiquette(s) rack imprimée(s) en un clic. ») ; fin des 3 clics par dossier et de la 2e icône.
- Déclencheur : actions groupées.
- Conditions : sélection ≥ 1.
- Effet / message d'erreur : journal.
- Sources : ateliers EX-REC-502, EX-REC-515, EX-TRA-507 · écran ECR-REC-03
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-091 — Imprimantes de plateforme et sortie PDF
- Origine : MODIFIÉE
- Énoncé : legacy : l'étiquette est imprimée sur CHAQUE imprimante de la plateforme (`tr_atelier_imprimante`) s'il y en a au moins une non vide ; aucune imprimante → aucune impression ni alerte. Cible : PDF généré côté navigateur ; appel d'un agent local d'impression : Q-002.
- Déclencheur : impression.
- Conditions : imprimante renseignée.
- Effet / message d'erreur : voir Q-002, Q-129.
- Sources : legacy `BLL/AdminPlateformeBll.cs:65-69`, `W/Reports/Rapport.cs:1021-1024` (RG-ADM-041) · CLAUDE.md §3
- Questions liées : Q-002, Q-129
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-092 — Échec d'impression non bloquant
- Origine : MODIFIÉE
- Énoncé : un échec d'impression est signalé mais ne défait ni la validation ni le contrôle déjà enregistrés ; la réimpression reste possible.
- Déclencheur : erreur d'impression.
- Conditions : —
- Effet / message d'erreur : message d'erreur d'impression ; état conservé.
- Sources : legacy `CTRL/ReceptionListeAfficheController.cs:454-465` (RG-REC-028)
- Questions liées : Q-002
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-093 — Édition picking
- Origine : CONSERVÉE
- Énoncé : état imprimé des affiches validées admin (`validationAdmin = 1`), hors zone picking, par plateforme et période de `date_entree` ; quantité = somme des mouvements, groupées par format, triées par annonceur (lettres avant autres, insensible à la casse), `rows = 1` pour la 1re ligne de chaque format, code-barres « A- » + id 13 caractères ; paramètre `historique` ignoré ; la SP déclare un 4e paramètre `@affiches` non passé.
- Déclencheur : « Edition picking ».
- Conditions : voir énoncé.
- Effet / message d'erreur : rapport. Non repris ni retiré par les specs (EX-TRA-025) ; Zone picking non repris.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:678-736`, `SP/p_EditionPicking.sql:22-80` (RG-REC-101) · spec EX-TRA-025
- Questions liées : Q-101
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-095 — Création d'une réception inconnue : formulaire
- Origine : MODIFIÉE
- Énoncé : « Réception inconnue… » (ex « orpheline ») : Site, Format, Annonceur lu sur l'affiche, Thème ou description (propositions de l'autre plateforme), Imprimeur, Quantité comptée, Allée (zone tampon, X par défaut), Rayon, Photo de l'affiche, Photo du BL. Bouton « Créer, ranger et imprimer la feuille temporaire ». Legacy : livraison « orpheline » à panier vide, saisie libre de lignes ; affiche persistée avant les contrôles.
- Déclencheur : bouton ou « Aucun : réception inconnue ».
- Conditions : voir RG-REC-096 à 098.
- Effet / message d'erreur : voir RG-REC-099.
- Sources : legacy `BLL/LivraisonAfficheService.cs:532-624`, `CTRL/LivraisonAfficheController.cs:274-321` (RG-REC-073, 078) · spec `[DC] §7` (EX-REC-035) · écran ECR-REC-08
- Questions liées : Q-163
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-096 — Quantité comptée obligatoire (> 0)
- Origine : NOUVELLE
- Énoncé : la quantité comptée d'une réception inconnue est > 0.
- Déclencheur : création.
- Conditions : quantité ≤ 0.
- Effet / message d'erreur : 422 `REC_QTE_INCONNUE_OBLIGATOIRE` « Indiquez la quantité comptée. ».
- Sources : spec `[DC] §7` (EX-REC-035) · écran ECR-REC-08
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-097 — Allée tampon et rayon obligatoires (réception inconnue)
- Origine : NOUVELLE
- Énoncé : allée (défaut `alleeInconnues` = X, à fixer par site) et rayon obligatoires : ils sont imprimés sur la feuille temporaire.
- Déclencheur : création.
- Conditions : allée ou rayon vide.
- Effet / message d'erreur : 422 `REC_ALLEE_RAYON_INCONNUE_OBLIGATOIRES` « Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire. ».
- Sources : spec `[DC] §7, §11` (EX-REC-035, 073) · écran ECR-REC-08
- Questions liées : Q-105, Q-106
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-098 — Photos de la réception inconnue
- Origine : NOUVELLE
- Énoncé : photo de l'affiche (jointe) ; photo du BL jointe dans tous les cas, sauf palette arrivée sans BL (n° de BL « — »).
- Déclencheur : création.
- Conditions : BL présent sans photo → refus RG-REC-026.
- Effet / message d'erreur : voir RG-REC-027.
- Sources : spec `[DC] §7` (EX-REC-003, 035) · écran ECR-REC-08
- Questions liées : Q-113
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-099 — Effets de la création d'une réception inconnue
- Origine : MODIFIÉE
- Énoncé : réception A_IDENTIFIER hors du sas ; affiche ORPHELINE (tags Réception inconnue, À contrôler), mouvement « Réception », feuille TEMPORAIRE, alerte immédiate à la Coordination (RG-REC-185, RG-X-006) ; pas de mail. Legacy : mail et affiches résiduelles.
- Déclencheur : création.
- Conditions : RG-REC-096/097.
- Effet / message d'erreur : « Réception inconnue R… : affiche n rangée en X-n. La Coordination est prévenue (Pilotage › Alertes). ».
- Sources : spec `[DC] §7, §11` (EX-REC-036) · écran ECR-REC-08
- Questions liées : Q-110
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-REC-100 — Suggestions d'intitulés de l'autre plateforme
- Origine : NOUVELLE
- Énoncé : l'annonceur saisi (dès 3 caractères) déclenche des suggestions d'intitulés déjà saisis par l'autre plateforme (« lib » (site, n° affiche)).
- Déclencheur : saisie annonceur.
- Conditions : ≥ 3 caractères.
- Effet / message d'erreur : boutons de suggestion.
- Sources : spec `[DC] §7` ; ateliers EX-REC-506 · écran ECR-REC-08
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
