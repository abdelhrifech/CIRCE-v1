### RG-COO-001 — Deux circuits indépendants : validation admin et Instruction OK
- Origine : MODIFIÉE
- Énoncé : la validation admin part de la réception physique de l'affiche ; l'Instruction OK part de la préparation (prépa envoyée de Broadcast). Aucun des deux ne conditionne l'autre : la validation admin n'attend ni la prépa ni l'Instruction OK ; l'Instruction OK n'attend pas la validation admin. Aucune garde de l'un ne lit l'état de l'autre (tests : valider sans prépa reçue, passer en Instruction OK sans aucune affiche validée).
- Déclencheur : toute transition de validation admin ou d'Instruction OK.
- Conditions : aucune dépendance croisée ; vaut pour fixe, pliage, déroulant (scro) et bus.
- Effet / message d'erreur : aucun rejet fondé sur l'état de l'autre circuit. MODIFIÉE : le legacy n'a pas de test explicite mais, au scro, la validation passe par la liaison aux lignes de prépa du dossier, qui naissent à l'Instruction OK (dépendance indirecte, retour terrain 02/11) ; la cible supprime cette dépendance (« La validation admin n'attend ni la prépa ni l'Instruction OK »).
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:218-257` (liaison des lignes de prépa) · spec [PC] p.1 encadré « Indépendants » ; [PP] encadré 02/11, §3, §8 (EX-COO-001) ; EX-EXI-053, EX-EXI-054
- Questions liées : Q-200
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-002 — Circé propose, une personne confirme (option A du 02/11)
- Origine : MODIFIÉE
- Énoncé : à la réception d'une affiche, Circé propose le rattachement à une ligne attendue de l'état des réservations, aidé du BL (n° de dossier ou de DA, format, plateforme, semaine, visuel). Rien n'est validé sans une personne identifiée : aucun traitement automatique (batch, alimentation, arrivée de la prépa, rattachement proposé) ne pose la validation admin. Hypothèse retenue le 02/11 avec la cheffe de projet.
- Déclencheur : création d'une affiche par la Réception (voir RG-X-050 à 063 pour les conséquences croisées).
- Conditions : l'état « Validée » n'est atteint que par l'action explicite d'un utilisateur autorisé (RG-COO-008, 010, 017).
- Effet / message d'erreur : toute tentative de passer à « Validée » sans utilisateur authentifié et autorisé : 403 (RG-COO-009). MODIFIÉE : legacy = case à cocher libre, éditable sans lien avec une proposition.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` (L.867, case libre ; ancien ID provisoire RG-COO-026) · spec [PP] encadré 02/11, §5 ; [RA] encadré, RG-VA-04 (EX-COO-004) ; écran ECR-COO-01 (« Aucune validation sans vous : Circé propose, vous confirmez »)
- Questions liées : Q-200, Q-234
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-003 — Origine du n° de dossier associé à une affiche
- Origine : MODIFIÉE
- Énoncé : le n° de dossier (ou de DA) associé à l'affiche provient, dans l'ordre : (1) du BL (photo du BL) : cas courant ; (2) sinon du visuel (photo d'une affiche comparée aux visuels de Broadcast), ce qui crée le doute « pas de n° sur le BL » ; (3) sinon d'une saisie (« Par n° de dossier », DA, annonceur, ou traitement d'une réception inconnue). Circé cherche ce n° dans les lignes attendues (dossier, thème, format, semaine). Un visuel commun à plusieurs dossiers donne plusieurs n° : la répartition est à confirmer (motif MULTI). Plusieurs n° s'écrivent séparés par « + » (format conservé du legacy).
- Déclencheur : enregistrement de la réception d'une affiche ; recherche dans la fiche affiche.
- Conditions : voie (1) = cas sûr possible (RG-COO-005) ; voies (2) et (3) = toujours doute (motif BL, RG-COO-006).
- Effet / message d'erreur : formats refusés côté back (aucune écriture) : n° de dossier mal formé (séparateur « + »), semaines mal formées (« + » ou « / »), nombre de dossiers ≠ nombre de semaines, `nombre_semaine` ≠ nombre de semaines (messages legacy : constantes `FormatDossierIncorrect`, `FormatSemaineIncorrect`, `DossierSemaine`, `NombreSemaineSemaine`, textes à relever, Q-228).
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:131-173` (ancien ID provisoire RG-COO-025) · spec [PC] p.1 encadré « Le n° de dossier associé » ; [PP] §5 (EX-COO-005) ; EX-EXI-052
- Questions liées : Q-228, Q-234
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-004 — Proposition de rattachement à la réception d'une affiche
- Origine : NOUVELLE
- Énoncé : à la création d'une affiche, Circé calcule une proposition de rattachement à une ou plusieurs lignes attendues ACTIVES (même plateforme, même semaine de la fenêtre, support compatible avec le format de l'affiche). La proposition est enregistrée sur l'affiche (mode de rattachement BL ou VISUEL, RG-COO-018), n'a aucun effet de validation, et est recalculée si la ligne attendue change (arrivée de la prépa, IP, annulation). Si aucune ligne candidate n'existe : l'affiche est une réception inconnue (traitée par la Coordination, RG-X-054).
- Déclencheur : création d'une affiche ; événement de modification de la ligne attendue ciblée.
- Conditions : ligne attendue `etat_ligne = ACTIVE` ; le format trie les candidats, le doute porte sur le thème (RG-COO-006) ; Circé ne rattache jamais en lecture (pas d'auto-rattachement à l'ouverture d'une fiche, RG-X-062).
- Effet / message d'erreur : création des liens avec `mode_rattachement`, `actif = true`, quantité = quantité proposée (≤ quantité reçue) ; historique « proposé par Circé (automatique) ». Remplace le rattachement systématique du legacy aux lignes de mêmes textes (RG legacy COO-020).
- Sources : legacy `BLL/LivraisonAfficheService.cs:427-486,522-527` ; `REP/LivraisonAfficheRepository.cs:392-413` (ancien ID provisoire RG-COO-020) · spec [PP] §5 ; [RA] encadré, RG-AT-08 (EX-COO-004, EX-COO-039) ; ateliers (EX-COO-506, ex EX-COO-006 : « 3 événements dont la prépa », remplacé par l'option A)
- Questions liées : Q-207, Q-234
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-005 — Cas sûr : conditions d'une proposition pré-cochée
- Origine : NOUVELLE
- Énoncé : une proposition est un « cas sûr » (pré-cochée) si et seulement si les cinq conditions sont réunies : (a) l'affiche est rattachée à une ligne attendue ACTIVE ; (b) le n° de dossier ou de DA lu sur le BL est celui de la ligne ; (c) même format que la ligne ; (d) un seul thème possible (ou le visuel lu sur le BL désigne le thème) ; (e) un seul dossier. La préparation arrivée n'est PAS une condition (supprimée le 02/11). Toute autre proposition est un doute (RG-COO-006).
- Déclencheur : calcul de l'état de validation d'une affiche (RG-COO-007).
- Conditions : les cinq conditions cumulées ; aucun motif de doute présent.
- Effet / message d'erreur : état « À confirmer : proposé » ; éligible au pré-cochage (RG-COO-011).
- Sources : spec [PP] §5 ; [RA] RG-VA-01, RG-VA-04 ; [DC] §15 (EX-COO-006) ; écran ECR-COO-01 (« Cas sûr : uniquement `va` et aucun doute »)
- Questions liées : Q-234
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-006 — Motifs de doute (affiche à doute)
- Origine : NOUVELLE
- Énoncé : une affiche rattachée est « à doute » dès qu'au moins un motif est présent ; les motifs sont calculés, cumulables et affichés ensemble : `BL` « Rattachée sans le n° du BL » (rattachement par le visuel ou à la main) ; `FORMAT` « Format différent » ; `THEME` « Plusieurs thèmes possibles » (dans ce format : visuel à confirmer) ; `MULTI` « Répartition à confirmer » (même visuel pour plusieurs dossiers) ; `SANS_IP` « IP pas saisies » (thème provisoire) ; `ANNULEE` « Validation annulée : à refaire ». Un doute n'est jamais pré-coché et exige une confirmation explicite (RG-COO-012).
- Déclencheur : calcul de l'état de validation (RG-COO-007).
- Conditions : motif = fonction de l'affiche, de ses liens et de la ligne attendue (jamais saisi).
- Effet / message d'erreur : état « À confirmer : doute » ; la fiche dossier affiche les libellés des motifs ; alerte si départ en S ou S+1 (RG-COO-033).
- Sources : spec [PP] §5 ; [PC] p.1 ; [DC] encadré 02/11 ; [README] §3 (EX-COO-007) ; écran ECR-COO-01 (`M.VA_MOTIFS`, `data.js`)
- Questions liées : Q-200
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-007 — États de validation d'une affiche (calcul)
- Origine : NOUVELLE
- Énoncé : l'état de validation d'une affiche est calculé, jamais saisi, dans cet ordre : `RECEPTION_INCONNUE` (aucun dossier rattaché) ; `VALIDEE` (confirmée par une personne : validée, par, le) ; `A_CONFIRMER_DOUTE` (au moins un motif, RG-COO-006) ; `A_CONFIRMER_PROPOSE` (cas sûr, RG-COO-005). Un dossier n'est jamais « Validée » sans affiche reçue. Transitions : voir section 3.
- Déclencheur : toute création/modification d'affiche, de lien ou de ligne attendue ; confirmation ; annulation.
- Conditions : ordre de priorité ci-dessus ; une validation annulée donne `A_CONFIRMER_DOUTE` avec motif ANNULEE.
- Effet / message d'erreur : état persisté en lecture rapide ou recalculé (choix d'implémentation) mais toujours cohérent avec les liens ; toute transition hors table = 409.
- Sources : spec [PC] p.1 ; [DC] encadré 02/11 ; [README] §5 (EX-COO-012) ; legacy `legacy-coordination.md §5.2` (cycle libre false/true, ancien ID RG-COO-026) ; écran ECR-COO-01 (`C.vaEtat`)
- Questions liées : Q-200
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-008 — Confirmation unitaire d'une affiche (fiche dossier)
- Origine : MODIFIÉE
- Énoncé : depuis la fiche du dossier (tableau « Affiches reçues et validation admin »), l'action « Valider » confirme la validation admin d'une affiche `A_CONFIRMER_*` : elle pose validée = vrai, par = utilisateur, le = date/heure, écrit l'historique (RG-COO-015) et déclenche les effets RG-COO-021 à 025. Les doutes se confirment un par un dans la fiche (bouton « Valider (n affiches) » pour le dossier).
- Déclencheur : clic « Valider » (ECR-COO-02) ; API de validation avec `Idempotency-Key` et `version` de l'affiche.
- Conditions : rôle autorisé (RG-COO-009) ; affiche en `A_CONFIRMER_PROPOSE` ou `A_CONFIRMER_DOUTE` ; version conforme (sinon 409).
- Effet / message d'erreur : état `VALIDEE` ; 409 si l'affiche est déjà validée ou version périmée ; 403 si rôle non autorisé ; toast « n affiche(s) confirmée(s) par la Coordination : n° d'affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé. ». MODIFIÉE : legacy = simple recopie de la case postée, sans contrôle de droit, de préparation associée ni de quantité côté serveur.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` ; `BLL/HistorisationBll.cs:29-32` (ancien ID provisoire RG-COO-026) · spec [PC] p.1-2 ; [README] §3 (EX-COO-008) ; écran ECR-COO-02
- Questions liées : Q-203
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-009 — Qui peut valider, annuler la validation, passer l'Instruction OK
- Origine : MODIFIÉE
- Énoncé : les actions « Valider », « Valider la sélection », « Annuler la validation », « Instruction OK (après contrôle) », « Appliquer la version Broadcast » et « Demander une correction à Broadcast » sont réservées aux rôles `coord` (Coordination) et `admin` (provisoire, droit legacy `validation_admin` mappé). Le contrôle est fait dans le service (pas seulement dans le front). L'agent de réception, le chef d'équipe, l'agent d'expédition et le commerce ne valident pas. Un rattachement fait par un autre rôle ne vaut pas validation (RG-COO-017).
- Déclencheur : toute action listée.
- Conditions : rôle de l'utilisateur ∈ {coord, admin}.
- Effet / message d'erreur : 403 `{ code: 'PERMISSION', regle: 'RG-COO-009' }` ; message UI « Réservé à la Coordination : choisissez le rôle « Coordination » en haut de page pour valider » (maquette ; à reformuler en production). MODIFIÉE : legacy = droit `validation_admin` testé dans le front seulement (aucun `[Authorize]` côté serveur).
- Sources : legacy `WEB/Views/Shared/DetailAffiche/Partial/Partial_ModifierDetailsAffiche.cshtml:24` ; `BLL/CommunBll.cs:276-303` (ancien ID provisoire RG-COO-026, RG-COO-090) · spec [README] §3, H1 ; [DC] §7 (EX-COO-010, EX-TRA-005) ; écran ECR-COO-01 (maquette `instructions.js:16-18`, Q-COO-5, Q-COO-6)
- Questions liées : Q-201, Q-003
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-010 — Confirmation en lot « Valider la sélection »
- Origine : NOUVELLE
- Énoncé : sur la page Pré-production › « Validation admin et Instruction OK », « Valider la sélection » confirme en un clic toutes les affiches `A_CONFIRMER_*` des dossiers cochés. L'opération est atomique (une seule transaction pour toute la sélection) ; si une affiche a changé (version) ou n'est plus à confirmer, elle est ignorée et listée dans le résultat sans bloquer les autres (comportement par défaut, Q-203). Chaque affiche confirmée suit RG-COO-008.
- Déclencheur : action groupée (sélection non vide) ; `Idempotency-Key` obligatoire.
- Conditions : rôle autorisé (RG-COO-009) ; au moins une affiche à confirmer dans la sélection (sinon RG-COO-013).
- Effet / message d'erreur : résultat `{ confirmees, ignorees[] }` ; si la sélection contient des doutes → RG-COO-012 ; 403 hors rôle. Aucun plafond de taille de lot spécifié (Q-203).
- Sources : spec [PC] p.1-2 ; [README] §3 ; [DESIGN] §11 (EX-COO-008) ; écran ECR-COO-01 (action « Valider la sélection »)
- Questions liées : Q-203
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-011 — Pré-cochage des cas sûrs et bouton « Cocher les cas sûrs »
- Origine : NOUVELLE
- Énoncé : à l'arrivée sur l'écran (une fois par arrivée, pas à chaque changement de filtre), les dossiers dont il ne reste que des rattachements proposés sans doute (cas sûrs uniquement) sont pré-cochés pour un utilisateur `coord`/`admin`. Le bouton « Cocher les cas sûrs (n) » recoche les premières lignes concernées. Les dossiers comportant au moins un doute ne sont jamais pré-cochés.
- Déclencheur : chargement de l'écran ; clic sur « Cocher les cas sûrs ».
- Conditions : rôle `coord` ou `admin` ; dossier dont toutes les affiches à confirmer sont `A_CONFIRMER_PROPOSE`.
- Effet / message d'erreur : la sélection est un état d'interface (aucune écriture) ; « n » = nombre de dossiers cas sûrs sous le filtre courant.
- Sources : spec [PC] p.1-2 ; [README] §3 (EX-COO-008) ; écran ECR-COO-01 (pré-sélection `M.navSeq`)
- Questions liées : Q-203
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-012 — Confirmation explicite des affiches à doute
- Origine : NOUVELLE
- Énoncé : si la sélection contient des doutes, une confirmation explicite est exigée avant écriture : modale « Confirmer aussi les affiches à doute ? » listant n° · libellé · motifs, avec trois issues : « Annuler » (rien n'est écrit), « Confirmer les n sans doute seulement » (disponible si n > 0), « Confirmer tout (n) ». Côté API, la présence de doutes sans l'indicateur de confirmation explicite (`confirmerDoutes = true`) est refusée.
- Déclencheur : « Valider la sélection » avec au moins un doute.
- Conditions : au moins une affiche `A_CONFIRMER_DOUTE` dans la sélection.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-012' }` si l'API reçoit des doutes sans confirmation explicite ; texte de la modale : « n affiche(s) sans doute et m affiche(s) à doute sont dans la sélection. Rien n'est validé sans vous… ».
- Sources : spec [PC] p.1-2 ; [DESIGN] §11 (EX-COO-007, EX-COO-008) ; écran ECR-COO-03
- Questions liées : Q-203
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-013 — Rien à valider : refus
- Origine : NOUVELLE
- Énoncé : si la sélection ne contient aucune affiche `A_CONFIRMER_*` (validation déjà faite ou aucune affiche encore arrivée), l'action est refusée.
- Déclencheur : « Valider la sélection » / « Valider » sans affiche à confirmer.
- Conditions : zéro affiche à confirmer.
- Effet / message d'erreur : 422 ; messages : « Rien à valider : les dossiers choisis n'ont aucune affiche à confirmer (validation admin déjà faite, ou aucune affiche reçue). » (sélection de dossiers) ; « Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n'est encore arrivée. » (variante).
- Sources : spec [PC] p.1 ; écran ECR-COO-01 (refus) (EX-COO-008, EX-COO-013)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-014 — Annulation de la validation (« Annuler la validation »)
- Origine : MODIFIÉE
- Énoncé : une validation se décoche toujours (« Annuler la validation », bouton de la fiche affiche et de la fiche dossier), sans condition de statut du dossier, de la prépa ou de l'Instruction OK. L'affiche repasse à `A_CONFIRMER_DOUTE` avec le motif ANNULEE (« Validation annulée : à refaire ») ; validée/par/le sont effacés ; l'historique écrit « validation annulée par <nom> ». L'annulation ne remet pas en cause les UM, trains ou colis déjà produits (point de non-retour de production, coo2).
- Déclencheur : clic « Annuler la validation » ; API avec `version` + `Idempotency-Key`.
- Conditions : affiche en `VALIDEE` ; rôle `coord`/`admin` (RG-COO-009).
- Effet / message d'erreur : 409 si l'affiche n'est pas `VALIDEE` ; effets aval retirés : voir RG-X-050 et Q-202 (n° d'affiche du suivi de prod, picking, retour Broadcast `EstAssociee` au prochain passage). MODIFIÉE : legacy = décochage libre, sans impression d'étiquette, historique « décoché » ; cible : nom + date tracés, motif ANNULEE.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` ; `BLL/HistorisationBll.cs:29-32` (ancien ID provisoire RG-COO-026, 027) · spec [PP] §5 ; [RA] RG-VA-04 ; [DC] encadré 02/11 (EX-COO-009) ; écran ECR-COO-02
- Questions liées : Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-015 — Traçabilité de la validation : nom de la personne et date
- Origine : MODIFIÉE
- Énoncé : toute validation ou annulation de validation enregistre `validationAdmin_par` (identité nominative de l'utilisateur) et `validationAdmin_le` (horodatage) sur l'affiche et une ligne d'historique (action ModificationValidationAdmin). L'historique ne dit jamais « validée par Circé » : un acteur automatique ne peut pas être `par`. L'identité doit être nominative (comptes génériques de Nîmes exclus pour cette action, Q-003).
- Déclencheur : RG-COO-008, 010, 014, 017.
- Conditions : utilisateur authentifié nominatif.
- Effet / message d'erreur : refus 403 si l'identité est un compte système ; la frise de la fiche affiche montre « Validée par <nom> le <date> ».
- Sources : legacy `BLL/HistorisationBll.cs:29-32` (ancien ID provisoire RG-COO-026) · spec [PP] §5 ; [RA] §4, RG-VA-04 ; [DC] encadré 02/11, §13 (EX-COO-009, EX-TRA-036) ; EX-TRA-007
- Questions liées : Q-003
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-016 — La quantité n'est pas une condition de la validation (réception partielle)
- Origine : CONSERVÉE
- Énoncé : la validation admin ne compare jamais la quantité reçue à la quantité attendue. Une réception partielle est validée pour ce qu'elle contient ; le manque reste un état de la ligne (« reste à recevoir ») avec son alerte (RG REC). Exemple 3/3/3 réception partielle (A reçue 3, B 2, C 0) : A et B sont validables, rien à valider pour C ; le complément de B est proposé puis confirmé à sa réception.
- Déclencheur : calcul de l'état de validation ; confirmation.
- Conditions : aucune condition de quantité dans les gardes de validation.
- Effet / message d'erreur : aucun rejet pour motif de quantité (test de rejet : une validation avec quantité reçue < attendue est acceptée). Voir RG-X-061 pour le complément.
- Sources : legacy `BLL/ReceptionListeAfficheBll.cs:837-889` (aucun contrôle de quantité ; ancien ID provisoire RG-COO-026) · spec [PP] §5, §6 ; [RA] RG-VA-03, cas 24 (EX-COO-011)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-017 — Le rattachement manuel d'une réception inconnue par la Coordination vaut validation
- Origine : NOUVELLE
- Énoncé : quand un utilisateur `coord`/`admin` rattache une affiche (réception inconnue, fiche affiche, changement de thème) à un ou plusieurs dossiers, la validation admin est faite dans la même opération (validée/par/le, mode MAIN). Si le rattachement est fait par un autre rôle (ex. agent de réception), l'affiche reste « À confirmer » avec le motif BL (« rattachée sans le n° du BL ») et mode MAIN.
- Déclencheur : action « Rattacher » (ECR-REC-04) ou « + Rattacher à un autre dossier » (fiche affiche).
- Conditions : rôle de l'acteur ; quantités > 0 ; total ≤ quantité reçue (règles de saisie côté Réception).
- Effet / message d'erreur : transaction unique rattachement + validation (RG-X-051) ; états : `VALIDEE` (coord/admin) ou `A_CONFIRMER_DOUTE` (autre rôle).
- Sources : spec [README] §3 (Réceptions inconnues), H1 ; [DC] §7 ; [PP] §6 (EX-COO-010, EX-COO-017) ; écran ECR-REC-04 (règles de « Rattacher ») ; legacy `BLL/ReceptionListeAfficheBll.cs:533-555` (ancien ID provisoire RG-COO-022, association libre sans validation)
- Questions liées : Q-201
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-018 — Mode de rattachement enregistré (BL, VISUEL, MAIN)
- Origine : NOUVELLE
- Énoncé : chaque affiche porte le mode de son rattachement : `BL` (n° de dossier lu sur le BL), `VISUEL` (reconnu par le visuel), `MAIN` (choisi par une personne). `VISUEL` et `MAIN` ajoutent le motif BL au calcul du doute (RG-COO-006) tant que l'affiche n'est pas confirmée.
- Déclencheur : création/modification d'un lien affiche ↔ ligne.
- Conditions : un lien actif porte exactement un mode.
- Effet / message d'erreur : champ `mode_rattachement` (V2) renseigné à chaque lien ; question V2 « garder le mode de rattachement » : conservé jusqu'à décision.
- Sources : spec [RA] §4 (EX-COO-046) ; maquette ECR-REC-04, `data.js` (`rattache` BL / VISUEL / MAIN)
- Questions liées : Q-234
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-019 — Pastille « Validation admin » du dossier (calculée)
- Origine : NOUVELLE
- Énoncé : la pastille de validation admin d'un dossier est calculée à partir de ses affiches : `SANS_OBJET` (dossier annulé, « — ») ; `A_CONFIRMER (n[, dont k doute(s)])` si au moins une affiche à confirmer ; `VALIDEE` si au moins une affiche reçue et toutes confirmées ; `AUCUNE_AFFICHE_RECUE` (« Aucune affiche reçue », rien à valider) sinon. Indépendante de la pastille de préparation (À traiter / Préparation reçue / Annulé) : deux pastilles indépendantes.
- Déclencheur : toute modification d'une affiche du dossier.
- Conditions : un dossier sans affiche reçue n'est jamais « Validée ».
- Effet / message d'erreur : lecture seule ; teinte « À surveiller » si doutes, « Info » sinon ; « OK » si validée.
- Sources : spec [PC] p.1 ; [DC] §9 ; [README] §5 ; [DESIGN] §11 (EX-COO-013) ; écran ECR-COO-01 (`C.vaResume`)
- Questions liées : Q-200, Q-215
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-020 — Statut du dossier « Validation admin faite » : calcul, pas de statut persisté
- Origine : MODIFIÉE
- Énoncé : le statut « Validation admin faite » (ex « Validé Pré-Prod ») signifie « toutes les affiches reçues du dossier sont confirmées par une personne » ; il se déduit de RG-COO-019 et n'a pas de valeur persistée distincte de la préparation. Il ne dépend pas de l'arrivée de la prépa (la maquette y ajoutait « préparation reçue », Q-215).
- Déclencheur : lecture du dossier ; affichage dans le suivi et l'état des réservations.
- Conditions : au moins une affiche reçue, toutes `VALIDEE`.
- Effet / message d'erreur : aucune transition de statut dossier n'est déclenchée par la validation ; l'historique du dossier enregistre néanmoins la confirmation (RG-COO-160).
- Sources : legacy `legacy-coordination.md §5.2` (« Aucune transition liée à la présence de préparation, à la quantité, ni au statut de l'instruction ») · spec [PC] p.1 ; [DC] §9 ; [DESIGN] §11 (EX-COO-013) ; maquette `data.js` (`C.majStatutVA`, statut interne `VALIDE`)
- Questions liées : Q-200, Q-215
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-021 — Effet de la validation : n° d'affiche visible au suivi de production
- Origine : CONSERVÉE
- Énoncé : le n° d'affiche n'apparaît dans le suivi de production qu'une fois l'affiche validée ET rattachée à une ligne attendue qui n'est pas de source Broadcast. (Cible : le n° est visible dans l'état des réservations dès la réception — « • à confirmer », « ✓ validée » — et dans le suivi de prod dès la prépa pour les affiches validées.) Le suivi de prod limite l'affichage aux ateliers de l'utilisateur (RG-COO-167).
- Déclencheur : lecture du suivi de production.
- Conditions : `VALIDEE` ET (`source = PREPA`) ; sinon n° masqué.
- Effet / message d'erreur : lecture seule ; une affiche non validée n'expose pas son n° au suivi de prod (test de rejet).
- Sources : legacy `SQL/p_s_adminSuiviRead.sql:64-67,72-115,117-136` ; `BLL/SuiviSuiviProductionBll.cs:112` (ancien ID provisoire RG-COO-030) · spec [PP] §3 ; [PC] p.1-2 ; [README] §3 (EX-COO-014) ; EX-EXI-053, EX-EXI-060
- Questions liées : Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-022 — Effet de la validation : picking (verrou)
- Origine : CONSERVÉE
- Énoncé : la validation admin ouvre l'édition du picking (case « zone picking », édition du picking) ; une affiche non validée n'y est pas traitée. L'annulation de la validation retire cet effet (Q-202).
- Déclencheur : validation / annulation.
- Conditions : droit Zone picking (legacy `Zone_Picking`) ; affiche `VALIDEE`.
- Effet / message d'erreur : 422 `{ regle: 'RG-COO-022' }` si une action picking est tentée sur une affiche non validée (hypothèse de garde, Q-202).
- Sources : legacy `legacy-coordination.md §8` ; `WEB/Views/ZonePicking/Index.cshtml:91` (legacy-admin.md §2) · spec [PP] §3 ; [PC] p.1-2 (EX-COO-014) ; EX-EXI-053
- Questions liées : Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-023 — Effet de la validation : étiquette rack imprimée à la plateforme
- Origine : MODIFIÉE
- Énoncé : à la validation (passage non validée → validée), l'étiquette rack est préparée pour impression à la plateforme de l'affiche ; aucun effet au décochage. Les PDF sont générés côté navigateur, l'impression passe par l'agent local (Q-002). En confirmation en lot, les étiquettes ne partent pas en rafale : elles sont groupées par plateforme avec un bouton « Imprimer » (proposition Q62 non tranchée).
- Déclencheur : RG-COO-008, 010, 017.
- Conditions : transition `non validée → validée` uniquement.
- Effet / message d'erreur : événement « étiquette rack à imprimer » créé ; pas d'impression au retrait de validation. MODIFIÉE : legacy = impression serveur automatique (`EnvoyeReport`) à chaque cochage dans la fiche.
- Sources : legacy `WEB/Controllers/ReceptionListeAfficheController.cs:177,189-192` ; `WEB/Controllers/ZonePickingController.cs:133` (ancien ID provisoire RG-COO-027) · spec [PP] §3 ; [PC] p.1-2 (EX-COO-014 ; Q62) ; EX-TRA-024
- Questions liées : Q-002, Q-202
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-024 — Effet de la validation : « reçue et associée » envoyé à Broadcast
- Origine : CONSERVÉE
- Énoncé : une affiche est envoyée à Broadcast avec `EstAssociee = true` si et seulement si elle est liée à une ligne attendue ET validée admin ; sinon `EstAssociee = false`. L'envoi se fait par le traitement de retour (RG-COO-134). L'annulation de la validation repasse `EstAssociee` à faux au passage suivant.
- Déclencheur : traitement de retour vers Broadcast ; (maquette : « Broadcast informé » à la validation).
- Conditions : `affiche_livraison_Id ≠ 0` (V2 : au moins un lien actif) ET `validationAdmin = true`.
- Effet / message d'erreur : champ `EstAssociee` ; destinataire fixe « CIRCE » ; site déduit de la plateforme (RG-COO-134).
- Sources : legacy `BLL/BatchAlimReceptionBll.cs:41-50,65-95` (ancien ID provisoire RG-COO-029 ; RG-REC-111) · spec [DC] §12 ; EX-TRA-039 ; EX-EXI-053 (mécanisme de retour de la cible « à définir »)
- Questions liées : Q-231
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-025 — Effet de la validation : sortie de la liste « à traiter »
- Origine : CONSERVÉE
- Énoncé : une affiche validée sort de la liste des affiches « à traiter » de la Réception (une affiche est « à traiter » tant qu'elle n'est pas validée ou n'a pas de ligne attendue associée). L'annulation de la validation la fait réapparaître.
- Déclencheur : validation / annulation.
- Conditions : affiche non rebutée, non fusionnée.
- Effet / message d'erreur : filtre « à traiter » = non rebutée, non fusionnée, ET (non validée OU sans prépa associée).
- Sources : legacy legacy-reception.md §« liste à traiter » (`legacy-reception.md:77`, ancien ID RG-REC provisoire) · spec [PP] §3 ; [PC] p.1-2 (EX-COO-014) ; EX-EXI-053
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-026 — « Affiche reçue » de l'état des réservations n'attend plus la validation admin
- Origine : MODIFIÉE
- Énoncé : l'indicateur « Affiche reçue » est posé par la réception (existence d'un mouvement de réception) et non par la validation admin ; la colonne « N° d'affiche » de l'état des réservations affiche « • » (proposé à confirmer) dès la réception et « ✓ » (validée) après confirmation. Legacy : « Aff. reçues = oui » seulement si une affiche validée correspond au dossier, à la semaine, à l'année et au thème texte de la ligne, sans test de plateforme ni de face.
- Déclencheur : lecture de l'état des réservations.
- Conditions : reçu = un mouvement de réception existe pour la ligne (règle de Réception) ; ✓ si `VALIDEE`, • sinon.
- Effet / message d'erreur : lecture seule ; test de rejet : une réception non validée n'affiche pas « non ». MODIFIÉE : legacy RG-COO-028 / ANO-05 (la réception seule laissait « non »).
- Sources : legacy `BLL/SuiviEtatReservationBll.cs:172-201` (ancien ID provisoire RG-COO-028) · spec [README] §3 ; [DC] §15 (EX-COO-048) ; ateliers EX-REC-503 (S L54) ; EX-EXI-055
- Questions liées : Q-231
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-027 — Effet « UM du fixe et du pliage » : non démontré, abandonné
- Origine : SUPPRIMÉE
- Énoncé : la validation admin ne crée, ne libère ni ne conditionne aucune unité de manutention du fixe ou du pliage. Aucune règle d'implémentation : l'effet « UM du fixe et du pliage » ne doit pas exister. Citation : « L'effet « UM du fixe et du pliage » est non démontré, corrigé le 02/11 » ([PP] §3, encadré correction ; contradiction 9 de specs-coordination).
- Déclencheur : sans objet (garde négative).
- Conditions : aucune création d'UM ne lit `validationAdmin`.
- Effet / message d'erreur : test de rejet : créer les UM d'un dossier sans validation admin réussit ; la libération de semaine est indépendante (coo2, RG-COO-2xx). Legacy : « la liste des UM n'est pas filtrée, elle affiche seulement n° d'affiche et oui/non ».
- Sources : spec [PP] §3 encadré correction ; [PC] p.1-2 (EX-COO-014) ; EX-EXI-054 · maquette ECR-COO-09a (« La libération ne valide rien et ne dépend pas de la validation admin »)
- Questions liées : —
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-028 — Validation automatique par Circé à l'arrivée de la prépa : abandonnée
- Origine : SUPPRIMÉE
- Énoncé : la version du 27/10 (« les affiches déjà reçues sont validées dès l'arrivée de la prépa » ; « Circé fait la validation admin quand il n'y a pas de doute ») est supprimée par l'option A du 02/11. Aucun traitement n'écrit `validationAdmin = true`, et l'historique ne contient jamais « validée par Circé ». Citation : « Rien n'est validé sans une personne ; son nom et la date sont tracés » ; « La prépa arrivée n'est plus une condition (supprimée le 02/11) » ([PP] encadré 02/11, §5).
- Déclencheur : arrivée de la prépa ; réception d'une affiche (garde négative).
- Conditions : aucune.
- Effet / message d'erreur : test de rejet : l'arrivée de la prépa avec affiches reçues ne change aucune validation ; l'état reste `A_CONFIRMER_*`. Les passages non barrés de [PP] §1 (tableau « Qui fait quoi ») et §2 (note finale) sont obsolètes.
- Sources : spec [PP] §1, §2, §5, encadré 02/11 ; [PC] p.1 (EX-COO-004, EX-COO-006) ; contradictions 1 et 10 de specs-coordination
- Questions liées : Q-200
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-029 — Fusion d'affiches : la validation admin est conservée si l'une des sources l'avait
- Origine : CONSERVÉE
- Énoncé : lors d'une fusion, l'affiche chapeau est validée si elle l'était ou si l'une des affiches cibles l'était (OU logique) ; les liens (préparations) des cibles sont rattachés au chapeau. Dans la cible, la fusion n'est pas maquettée : règle conservée du legacy, avec attribution `par/le` de la validation d'origine (aucune validation nouvelle n'est créée par la fusion).
- Déclencheur : « Fusionner » (droit legacy `fusion_affiche`).
- Conditions : chapeau et cibles non fusionnés.
- Effet / message d'erreur : `validationAdmin(chapeau) = chapeau OR cibles` ; si le chapeau devient validé par héritage, `par/le` reprennent ceux de la source validée.
- Sources : legacy `BLL/FusionAfficheBll.cs:127,163` (ancien ID provisoire RG-COO-031 ; confiance PROBABLE) · spec EX-TRA-005 (droit `fusion_affiche`) ; ECR-REC (Q-REC-19 : fusion hors maquette)
- Questions liées : Q-REC-19 (maquette), Q-201
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-030 — Thème de la ligne changé après la validation : validation à refaire
- Origine : NOUVELLE
- Énoncé : si le thème d'une ligne attendue change (Broadcast ou IP) alors qu'une affiche y est rattachée et validée, une alerte est levée et la validation est à refaire : l'affiche repasse `A_CONFIRMER_DOUTE` (motif THEME). Proposition non tranchée (Q55), appliquée par hypothèse.
- Déclencheur : lecture de Broadcast modifiant `IdTheme`/thème d'une ligne ayant un lien actif.
- Conditions : ligne avec au moins une affiche `VALIDEE` ; thème différent (comparaison par identifiant, RG-COO-081).
- Effet / message d'erreur : alerte « Thème modifié dans Broadcast » (RG-COO-068) ; effacement de validée/par/le avec historique « validation à refaire (thème modifié) » ; feuille de stock à refaire côté Réception (RG-X-057).
- Sources : spec [RA] RG-VA-02, cas 13 ; [PP] §6, §9 (EX-COO-016)
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-031 — Quantité de la ligne changée après la validation : alerte seule
- Origine : NOUVELLE
- Énoncé : si la quantité d'une ligne change après la validation d'une affiche rattachée, une alerte « Écart Broadcast / Circé » est levée ; la validation n'est pas annulée (hypothèse Q55). La prépa différente de l'état des réservations déclenche aussi l'alerte (RG-COO-067).
- Déclencheur : lecture de Broadcast ; arrivée de la prépa.
- Conditions : `qte` modifiée, thème identique, lien actif validé.
- Effet / message d'erreur : alerte seule ; états inchangés ; test de rejet : la validation reste `VALIDEE`.
- Sources : spec [RA] RG-VA-02, cas 13 ; [PP] §6, §9 (EX-COO-016)
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-032 — Ligne annulée après la validation : alerte à la Coordination
- Origine : NOUVELLE
- Énoncé : si une ligne attendue portant une affiche rattachée passe `ANNULEE` (DA annulée après réception), une alerte est levée à la Coordination ; l'affiche reste rattachée à la ligne fermée tant qu'une personne ne l'a pas déplacée (le lien n'est jamais perdu, RG-COO-088) ; la validation n'est pas retirée automatiquement.
- Déclencheur : passage de la ligne à `ANNULEE` (RG-COO-087).
- Conditions : au moins un lien actif sur la ligne.
- Effet / message d'erreur : alerte (type écart / dossier annulé) ; la fiche dossier montre l'affiche à re-rattacher.
- Sources : spec [RA] RG-AT-06, RG-VA-02, cas 14 ; [PP] §6 (EX-COO-016, EX-COO-037)
- Questions liées : Q-210
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)

### RG-COO-033 — Alerte « Validation admin à confirmer »
- Origine : MODIFIÉE
- Énoncé : une alerte par affiche à doute, à destination de la Coordination ; gravité « grave » (Important/serious) pour un départ en S ou S+1, « À surveiller » (warning) au-delà ; le lien ouvre l'écran « Validation admin et Instruction OK » filtré sur le dossier. L'alerte se lève à la confirmation (ou à l'annulation du doute) ; les cas sûrs n'alertent pas. Libellé « à confirmer » (et non « à faire », Q-200).
- Déclencheur : passage d'une affiche à `A_CONFIRMER_DOUTE` ; recalcul quotidien de la gravité.
- Conditions : doute hors motif SANS_IP seul (qui alerte « Réception sans IP », RG-COO-071) ; départ ≤ S+1 → serious.
- Effet / message d'erreur : alerte clé `VA-<affiche>` ; destinataires `coord` ; canal paramétrable (Q-220).
- Sources : spec [PC] p.2 ; [DC] §11 ; [README] §7 (EX-COO-015, EX-COO-047) ; EX-REC-071 · écran ECR-TRA-01 (`VALIDATION_ADMIN`)
- Questions liées : Q-200, Q-220
- Implémentation : (rempli à l'étape 5/6)
- Tests : (rempli à l'étape 5/6)
