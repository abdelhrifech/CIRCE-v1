# Specs ateliers et besoins (refonte Circé) — EX-<MOD>

Sources lues intégralement :
- A13 = `atelier_20261013_2m2_fixe_colle.md` (19 slides, 24 images non extraites)
- A14 = `atelier_20261014_reception_preprod_themes_stocks.md` (34 slides, 32 images non extraites ; titre interne « 14-15 octobre »)
- A15 = `atelier_20261015_2m2_8m2_scro_expedition.md` (20 slides, 14 images non extraites ; titre interne « 15 et 16 octobre »)
- S = `synthese_besoins_20261016.md` (Excel « Liste des besoins métier - CIRCE 2 », feuille Feuil1, lignes Excel 6 à 101 ; notation Lnn = ligne Excel nn ; la colonne « # » (B) est vide dans l'extraction : la numérotation d'origine est perdue ; lignes 98 à 100 vides ; L101 sans catégorie ni numéro)
- Contexte projet (A13/A14 slides 2-4) : projet « Refonte Circé » issu d'une démarche IA d'entreprise ; initiative PR-1 « Refonte de CIRCE » parmi 18 initiatives en production, 4 en POC (dont PP-1 « Retravail du process pré-production ») ; objectif : nouveau Circé déployé avant fin 2026 (aujourd'hui = sept. 2026 sur les slides).

Modules (MOD) utilisés : REC = Réception, COO = Coordination/Pré-Prod, TRA = transverse (ergonomie, données, interface BC), FIX = 2 m² fixe et pliage, SCR = scro/déroulant (2 m² et 8 m²) et suivi de prod, EXP = Expédition, STK = Stocks, THM = Thèmes, ADM = Administration/droits, BUS = Bus Nanterre, QUA = Qualité, PIL = Pilotage/reporting (dashboard de suivi de prod). Le périmètre de chaque module n'est pas défini dans les specs : le MOD est choisi d'après la catégorie et le menu de la ligne ; en cas de ligne à cheval le MOD secondaire est noté.

Statuts de lignes de la synthèse (colonne Commentaire) : « A revoir Bao », « A creuser Rayane », « En attente input Patrick », « A revoir Bao - impact CGV 2027 », « A revoir Bao / Rayane », ou vide. Catégorie « Refusé » (L93) et « Besoin Refusé » (A14).

Règle de lecture : un besoin présent à la fois dans un atelier et dans la synthèse est décrit une seule fois ; les sources sont cumulées.

---

# PARTIE 1 — Réception (REC)

### EX-REC-001 — Anomalie : doublement d'affiches dans « liste des affiches »
- Énoncé : cas de doublement d'affiches dans la liste des affiches pour certains dossiers ; vérifier s'il s'agit d'un problème de mise à jour de la donnée.
- Type : fonctionnalité (anomalie)
- Source : S L30 (catégorie Anomalies)
- Menu : Réception / Liste des affiches
- Statut ligne : vide
- Ambiguïté : cause inconnue (point d'interrogation dans la source)

### EX-REC-002 — Impressions multiples dans la liste des affiches
- Énoncé : pouvoir cocher plusieurs lignes de la liste des affiches et les imprimer ; aujourd'hui il faut entrer dans chaque dossier et imprimer (3 clics par dossier).
- Type : fonctionnalité
- Source : A14 slide 27 #6 ; S L48 (Ergonomie)
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : aucune

### EX-REC-003 — « Affiche reçue » posée par la réception et non par la validation admin
- Énoncé : changer l'événement déclencheur qui met le champ « affiche reçue » à oui : ce doit être la réception qui le met à jour, pas la validation admin (la validation peut être tardive par rapport à la réception effective en plateforme).
- Type : règle
- Source : A14 slide 24 #1bis ; S L54
- Menu : Etat des réservations
- Statut ligne : vide
- Ambiguïté : doit être rapproché de la cible « option A » du 02/11 (voir contradictions)

### EX-REC-004 — Modification de thèmes après 1er envoi de préparation
- Énoncé : purger les anciens thèmes de la fenêtre « Ajouter Prépa (validation admin) » et de l'écran de réceptions attendues quand les instructions sont modifiées ; le nouveau thème « n'écrase » pas l'ancien aujourd'hui (doublons de visuels pour un même dossier, raccrochage du nouveau visuel parfois impossible).
- Type : règle
- Source : A14 slide 31 #5 ; S L74 (Pré-Prod)
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : catégorie « Pré-Prod » dans S mais menu Réception ; rattaché ici à REC ; voir aussi THM-004

### EX-REC-005 — Identifier les dossiers ayant reçu des IP après génération du 1er fichier de prod
- Énoncé : identifier les dossiers dont les instructions de pose arrivent après la génération du premier fichier de prod ; sans mail de la PP indiquant que les dossiers en attente d'IP sont renseignés, la plateforme ne sait pas qu'elle a le Go pour préparer le fichier multi-rouleuse.
- Type : fonctionnalité
- Source : A13 slide 16 (« Réception # 6 ») ; S L82
- Menu : Réception
- Statut ligne : A revoir Bao
- Ambiguïté : modalité (alerte, tag, mail) non précisée ; voir aussi COO-003

### EX-REC-006 — Réceptions sans IP : proposer le thème saisi par la 1re plateforme
- Énoncé : quand une réception est faite sans IP saisies dans Broadcast, le thème est saisi par la plateforme ; si le dossier est commun à Nîmes et Wissous, l'intitulé saisi par la 1re plateforme ayant réceptionné doit être proposé dans les thèmes associés au dossier pour la 2e plateforme (éviter 2 thèmes pour le même visuel). Aujourd'hui : saisie manuelle par l'agent, 2 intitulés possibles (Wissous « n° 1234 – BURGER », Nîmes « n° 4321 – Burger »), puis un 3e à la saisie des IP (« Burgers »).
- Type : règle
- Source : A14 slide 24 #2 ; S L83
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : aucune (règle du « 1er qui a parlé » détaillée en THM-001)

### EX-REC-007 — Traitement des affiches orphelines par reconnaissance visuelle
- Énoncé : prendre en photo les affiches livrées, comparer aux visuels disponibles dans Circé ; si rapprochement à 100 % identification immédiate ; si incertitude (plusieurs visuels possibles) identifier les visuels concernés et laisser la main à l'humain ; question ouverte : visuels multi-dossiers / multi-semaines. Étendre éventuellement à toutes les réceptions : scan du BL, rapprochement automatique avec un ou plusieurs dossiers, validation des propositions par l'utilisateur. Problème : l'identification du contrat est très chronophage ; cas Cuisinella (multiples pages par magasin) où un scan aiderait (aujourd'hui un seul dossier saisi puis retraitement manuel).
- Type : fonctionnalité
- Source : A14 slide 27 #4 ; S L84
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : « Quid des visuels multi-dossiers / multi-semaine ? » sans réponse ; recours à un LLM/vision non mentionné explicitement ; précision de la reconnaissance non spécifiée

### EX-REC-008 — Réordonner les lignes (déplacer plus haut/plus bas)
- Énoncé : pouvoir sélectionner une ligne et la déplacer plus haut ou plus bas : l'agent traite les dossiers dans l'ordre des BL papier ; cela permet de classer les fiches et de les imprimer dans l'ordre voulu.
- Type : fonctionnalité
- Source : A14 slide 27 #5 ; S L85
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : écran exact (liste des réceptions ? liste des affiches ?) non précisé ; persistance de l'ordre non précisée

### EX-REC-009 — Fusionner les écrans Réception et Liste des affiches
- Énoncé : fusionner « Réception » et « Liste des affiches » : (a) en « ouvrir réception » puis fenêtre préparation, pas d'accès à l'adressage (allée/rayon), à re-chercher dans Liste des affiches pour chaque réception ; (b) dans « modifier une affiche » > onglet « mouvement », le n° de réception doit être cliquable pour ouvrir la réception ; (c) recherche par imprimeur : l'imprimeur n'est connu que dans la réception, à rendre visible dans la liste des affiches.
- Type : fonctionnalité
- Source : A14 slide 27 #7 ; S L86
- Menu : Réception / Liste des affiches
- Statut ligne : vide
- Ambiguïté : « fusionner » (titre) vs trois demandes ponctuelles (détail) : périmètre exact flou

### EX-REC-010 — Lien bleu « visuel disponible » dans Réception et Suivi par thème
- Énoncé : quand un visuel est disponible dans l'état des réservations, afficher le lien bleu dans le menu Réception et dans l'écran Suivi par thème ; nécessaire en réception pour vérifier s'il y a des bandeaux. (A15 : même vignette de lien vers le visuel dans Suivi par thème pour le 8 m², cf. SCR-013.)
- Type : affichage
- Source : A14 slides 28-29 #8 ; S L87
- Menu : Réception / Suivi par thème
- Statut ligne : vide
- Ambiguïté : A14 slide 29 ne cite que « Réception » ; slide 28 et S ajoutent « Suivi par thème »

### EX-REC-011 — Livraison en deux fois : thème qui disparaît à la 2e livraison
- Énoncé : si livraison en 2 fois sur un même thème ou sur 2 thèmes distincts pour un même annonceur, le thème a disparu pour la réception à la 2e livraison. Cas 1 : complément de quantité sur un même visuel : pouvoir garder un même n° d'affiche pour 2 livraisons (traçabilité). Cas 2 : mauvais thème choisi la 1re fois : ce thème doit rester disponible pour éviter une fausse réception orpheline. Problème associé : supprimer une réception d'une prépa d'affiche dans l'onglet prépa (admins Pré-Prod) fait perdre à la réception la vision de la préparation dans les réceptions attendues.
- Type : règle
- Source : A14 slides 12, 28-29 #9 ; S L88
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : cas 1 contredit en apparence la règle « UNE seule affiche par ligne attendue » de l'existant (EX-EXI-056) : implique un modèle N-à-N

### EX-REC-012 — Purge de l'historique des réceptions attendues/partielles après 4 semaines
- Énoncé : permettre de purger l'historique des réceptions attendues ou partielles au bout de 4 semaines, pour toutes celles qui n'ont pas le flag conservation renseigné ; les « vieux dossiers » restent aujourd'hui dans les listes si des affiches n'y ont pas été rattachées.
- Type : traitement auto
- Source : A14 slides 28-29 #10 ; S L89
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : « Serait-il possible / judicieux » : besoin formulé comme question ; point de départ des 4 semaines non précisé (semaine de pose ? création ?) ; « flag conservation à l'année » non défini

### EX-REC-013 — Colonne « Rebus » plus visible
- Énoncé : faire davantage ressortir la colonne « Rebus » de la liste des affiches (couleur ?).
- Type : affichage
- Source : A14 slides 28-29 #11 ; S L90
- Menu : Réception / Liste des affiches
- Statut ligne : vide
- Ambiguïté : aucune

### EX-REC-014 — Nom du contrôleur obligatoire (menu déroulant)
- Énoncé : rendre obligatoire la saisie du nom du contrôleur en réception, avec un menu déroulant.
- Type : validation
- Source : A14 slides 28-29 #12 ; S L91
- Menu : non précisé (Réception)
- Statut ligne : vide
- Ambiguïté : liste des contrôleurs : source (ADM-001 : où paramétrer un agent de réception)

### EX-REC-015 — Simplifier l'impression des étiquettes rack affiche
- Énoncé : réduire au moins une étape (la 2e icône) : aujourd'hui il faut cliquer sur l'icône imprimante, puis une 2nde icône, puis imprimer.
- Type : fonctionnalité
- Source : A14 slides 28-29 #13 ; S L92
- Menu : Réception / Liste des affiches / Imprimer
- Statut ligne : vide
- Ambiguïté : aucune

### EX-REC-016 — Dashboard de réception (attendu / reçu / reste à recevoir)
- Énoncé : mettre en place un dashboard par semaine / annonceur / thème / plateforme / format : attendu (ex. 100), reçu (60), reste à recevoir (40) et en % (40 %) ; alerte en cas d'écart de +/- 10 % vs l'attendu ; alerte en cas de réception sur un dossier sans IP (réception sur annonceur sans thème) ; champ « date prévisionnelle de livraison » à saisir manuellement ; sert aussi à donner de la visibilité sur l'avancement de la prod. Remplace le mail actuel envoyé aux chefs d'équipe pour informer des réceptions et les échanges mail/extractions Excel sur IP et affiches manquantes à S-X et J-X. Problème actuel : pas d'alerte si le nb d'affiches reçues ou le nb de thèmes ne correspond pas.
- Type : fonctionnalité
- Source : A13 slide 19 ; A14 slides 24-26 #1 ; S L96 (catégorie Reporting)
- Menu : New écran dans Réception
- Statut ligne : vide ; A13 slide 19 marqué « POUR DISCUSSION EN ATELIER »
- Ambiguïté : date prévisionnelle : « si Print Cityz, source BC » (A13) vs « saisie manuelle » (A14, S) ; illustration du dashboard (A14 slide 25) non extraite ; règles détaillées en REC-017 à REC-020

### EX-REC-017 — Dashboard : accès et filtres
- Énoncé : le dashboard est accessible par l'ensemble des coordinatrices et gestionnaires Pré-Prod ainsi que par l'ensemble des équipes de Nîmes et Wissous ; chaque utilisateur peut filtrer uniquement les données qui l'intéressent.
- Type : permission
- Source : A14 slide 26
- Menu : Réception / dashboard
- Statut ligne : non reprise dans S L96 (qui renvoie à « règles de gestion dans le doc 20261014 »)
- Ambiguïté : « filtrer uniquement les données qui l'intéressent » : filtre libre ou restriction de droits ?

### EX-REC-018 — Dashboard : quantités avec/sans entretien et taux d'entretien
- Énoncé : gérer des quantités attendues avec et sans entretien. Pourcentage d'entretien : si la prépa n'est pas encore envoyée de Broadcast : 8 % ; si envoyée : celui saisi dans Broadcast ; si campagne contrôlée : 15 %.
- Type : règle
- Source : A14 slide 26
- Menu : Réception / dashboard
- Statut ligne : (S L96 renvoie à ce doc)
- Ambiguïté : priorité entre « prépa envoyée » et « campagne contrôlée » non précisée (si CC et prépa envoyée avec % BC différent) ; Bus : +20 % d'entretien par défaut (S L35), contraire à 8 %

### EX-REC-019 — Dashboard : trois types d'alertes
- Énoncé : (1) quantité reçue hors entretien : alerte si quantité reçue < quantité sans entretien ; (2) quantité reçue avec entretien : alerte si (quantité reçue − quantité attendue avec entretien) / quantité attendue avec entretien est supérieur à +/- 10 % ; (3) réceptions faites alors que les IP ne sont pas saisies.
- Type : règle
- Source : A14 slide 26 (et slide 24 #1)
- Menu : Réception / dashboard
- Statut ligne : (S L96)
- Ambiguïté : A13 slide 19 et S parlent d'un écart de +/- 10 % « vs l'attendu » sans préciser avec/sans entretien ; destinataires et canal des alertes (écran, mail) non précisés

### EX-REC-020 — Réceptions sans IP : consultation par la Pré-Prod, date prévisionnelle, commentaires
- Énoncé : la Pré-Prod doit consulter le dashboard pour connaître les réceptions sans IP ; à la saisie des IP elle garde autant que possible le nom renseigné par la plateforme ayant saisi en premier ; si elle corrige l'intitulé elle en informe les plateformes pour réimpression des feuilles de stock (une alerte peut suffire vs mail ; à voir si automatisable en suivant les màj de thème). Le champ « dates de livraison prévisionnelle » doit pouvoir être renseigné manuellement par les gestionnaires Pré-Prod, avec commentaires, pour remplacer les échanges mail sur les manquants jusqu'à J-3.
- Type : règle
- Source : A14 slide 26 ; A14 slide 30 #1
- Menu : Réception / dashboard ; Alertes
- Statut ligne : (S L96, L65)
- Ambiguïté : « une alerte peut suffire (vs mail) (voir si on peut automatiser) » : décision non tranchée

### EX-REC-021 — Alerte écart/réception sans IP (rappel atelier 13)
- Énoncé : (doublon fonctionnel de REC-016/019) alerte en cas de réception sur un dossier sans IP = réception sur annonceur sans thème.
- Type : règle
- Source : A13 slide 19
- Menu : dashboard
- Statut ligne : POUR DISCUSSION EN ATELIER
- Ambiguïté : doublon

### EX-REC-022 — Anomalie : vision Circé des manquants erronée (split par type de préparation)
- Énoncé : Circé indique un manquant (écart entre qté reçue 34 et attendu BC 56) alors que la DA BC est de 34 : le split par type de préparation génère trop d'affiches en attente.
- Type : règle (anomalie)
- Source : A14 slide 22
- Menu : Réception (réceptions attendues)
- Statut ligne : absent de S
- Ambiguïté : aucune action explicite demandée ; implicite : corriger le calcul de l'attendu ; lié à FIX-001 (suppression Vrac/Roulée)

### EX-REC-023 — Besoin refusé : mail automatique au commercial et à l'assistante
- Énoncé : lorsque l'on reçoit/affecte/identifie des affiches à un contrat, générer automatiquement un mail au commercial et à l'assistante en charge du dossier. Marqué « Besoin Refusé ».
- Type : fonctionnalité (refusée)
- Source : A14 slides 28-29
- Menu : non précisé
- Statut ligne : Besoin Refusé ; absent de S (L93 « Refusé » concerne un autre besoin, cf. EXP-006)
- Ambiguïté : motif du refus non donné

### EX-REC-024 — Process cible Réception/Pré-Prod (synthèse des décisions)
- Énoncé : process cible (slide 34 A14) : création de la réception attendue dans Circé ; proposition automatique de raccrochage prépa (n° contrat – thème – n° affiche) ; validation humaine de la proposition (= ex Validation Admin) ; Instruction OK mise automatiquement (scro, scro + fixe) ; commentaire préparation vide ? reprise auto du % entretien BC + si CC : 15 % entretien et début de train ; Suivi Thèmes uniquement si commentaire prépa ; contrôle des réceptions sans IP + gestion des DM / mises à jour post envoi des préparations ; go info aux plateformes ; sortie de stock.
- Type : fonctionnalité
- Source : A14 slide 34
- Menu : Réception, Trains, Suivi Thèmes
- Statut ligne : cible du diagramme (éléments détaillés en COO-006 à COO-012)
- Ambiguïté : diagramme (flèches, ordre, légende manuel/auto) non extrait ; libellés seuls

---

# PARTIE 2 — Coordination / Pré-Prod (COO)

### EX-COO-001 — Entretien saisi dans BC pris en compte dans la préparation
- Énoncé : que l'entretien saisi dans BC soit pris en compte dans la préparation (le % d'entretien saisi dans BC est repris, sans ressaisie).
- Type : règle
- Source : S L68 (catégorie Interface BC/Circé) ; A14 slide 32 #3
- Menu : non précisé
- Statut ligne : A revoir Bao
- Ambiguïté : aucune ; lié à COO-008

### EX-COO-002 — Exclure automatiquement les thèmes « ne pas afficher » / « reste en place »
- Énoncé : exclure automatiquement les thèmes « ne pas afficher » ou « reste en place » de la préparation des fixes ; aujourd'hui fait manuellement dans le suivi par thème.
- Type : traitement auto
- Source : A13 slide 17 #13 (seconde moitié) ; A14 slide 32 #4 ; S L70 (Pré-Prod) et L78 (Suivi des thèmes)
- Menu : Trains / Suivi des Thèmes
- Statut ligne : L70 A revoir Bao ; L78 vide
- Ambiguïté : doublon S L70 vs L78 (le fixe vs le suivi des thèmes du déroulant) ; A13 le range avec le déclenchement des sorties de stock dans un même numéro #13

### EX-COO-003 — Alerte rajouts post préparation
- Énoncé : fixe et scro : toute préparation envoyée dans Circé à partir de la nuit du jeudi au vendredi S-2 jusqu'au vendredi de la semaine S doit déclencher un mail au chef d'atelier / admins en plateforme / coordinateurs (liste à établir dans le menu Administration). Pas d'automatisation du raccrochage dans le train pour les trains restant à produire (l'atelier choisit fractionner ou raccrocher). Problèmes : sans mail de la PP indiquant que les IP en attente sont renseignées, la plateforme ne sait pas qu'elle a le Go ; pas d'alerte si DM avec fichier scro validé (fichier à part, sortie systématique en fractionné). Menu : Administration : écran de gestion des listes de distribution, voir si ajouter le type d'alerte (à revoir avec Rayane).
- Type : traitement auto
- Source : A14 slide 33 #1 ; S L71 ; (voir aussi FIX-003)
- Menu : Administration (écran gestion des listes de distribution)
- Statut ligne : A revoir Bao / Rayane
- Ambiguïté : fenêtre « nuit du jeudi au vendredi S-2 jusqu'au vendredi S » vs deadline Pré-Prod jeudi S-2 ; liste de distribution à établir

### EX-COO-004 — Reprendre les dev APPFR-1143 (écran liste des instructions déroulants)
- Énoncé : reprendre dans le nouveau Circé les développements demandés pour simplifier les actions de l'écran « liste des instructions déroulants » (dev n° APPFR-1143, testés en S42, à mettre en prod).
- Type : fonctionnalité
- Source : A14 slide 32 #3 ; A15 slide 9 #1 ; S L72
- Menu : liste des instructions déroulants
- Statut ligne : vide
- Ambiguïté : contenu fonctionnel du dev APPFR-1143 non décrit dans les extraits

### EX-COO-005 — Créer/supprimer des trains (pré-tests, entretien)
- Énoncé : permettre à la Pré-Prod de créer des trains (pré-tests, trains d'entretien : à un moment une campagne devient contrôlée et il faut rajouter de l'entretien) et de supprimer des trains (ex. affichage qui ne s'effectue pas ; Ville de Paris : affiches à ne pas mettre, parfois seule affiche du train). Aujourd'hui les pré-tests sont gérés hors process. A15 slide 10 (en marge du #11) : « Pouvoir supprimer des trains ».
- Type : fonctionnalité
- Source : A14 slide 32 #6 ; A15 slides 9-10 #2 ; S L73
- Menu : liste des instructions déroulants
- Statut ligne : vide
- Ambiguïté : règles de création (qui, quand) non précisées ; statut « Instruction OK » verrouille positions et entretien : impact non traité

### EX-COO-006 — Proposition automatique de raccrochage
- Énoncé : avancer et automatiser le raccrochage de la préparation : proposition de raccrochage dès que 3 événements sont réunis : identification en plateforme (n° affiche associé à n° semaine et n° dossier), IP reçues, préparation du dossier reçue dans Circé ; proposition à valider par un coordinateur logistique. Aujourd'hui on ne peut rattacher des affiches à un dossier que si la préparation est envoyée. Ergonomie : dans « ajouter préparation », la touche Entrée ne lance pas la recherche, il faut cliquer « rechercher ».
- Type : fonctionnalité
- Source : A14 slide 32 #1 ; S L75
- Menu : Réception / Liste des affiches / Modifier / Préparations
- Statut ligne : vide
- Ambiguïté : conditions (3 événements dont la prépa) vs option A du 02/11 (proposition à la réception, sans attendre la prépa) : voir contradictions

### EX-COO-007 — Fusion raccrochage et validation admin
- Énoncé : la validation par un coordinateur de la proposition automatique de raccrochage peut également faire office de validation admin (fusion). Motif : la validation admin est aujourd'hui obligatoire pour le fixe comme pour le scro, suit l'envoi de la prépa dans BC, il n'y a donc pas de raison d'y revenir.
- Type : règle
- Source : A14 slide 32 #2 ; S L76
- Menu : non précisé
- Statut ligne : vide
- Ambiguïté : « obligatoire » contredit les constats de l'existant (ANO-14, code) ; PP-01 propose de supprimer ou conserver

### EX-COO-008 — Simplification du traitement des dossiers déroulants (Instruction OK automatique)
- Énoncé : passer automatiquement en Instruction OK les dossiers ayant un champ commentaire de préparation vide ; reprendre les dev testés en S42 (APPFR-1143) ; reprendre au préalable systématiquement : la répartition par thème de BC, le % d'entretien saisi dans BC, en position 1 le thème d'une CC. Cas des dossiers CP à creuser : faut-il les annuler systématiquement ? Quid des dynamisations ? Problèmes : Instruction OK obligatoire ; Pré-Prod ressaisit répartition et entretien déjà connus de BC ; Pré-Prod change manuellement la position des campagnes contrôlées.
- Type : traitement auto
- Source : A14 slide 32 #3 et slide 34 ; S L77
- Menu : liste des instructions déroulants
- Statut ligne : vide
- Ambiguïté : règle de déclenchement « commentaire vide » (A14/S) vs « pas de commentaire ET exceptions = quantité » (HTML, règle de Nariman) ; CP/dynamisations non tranchés (Q21)

### EX-COO-009 — Simplification du Suivi des thèmes (déroulant)
- Énoncé : Suivi des thèmes uniquement si commentaire de préparation (cible) ; exclure automatiquement les thèmes « ne pas afficher » ou « reste en place » (cf. COO-002).
- Type : règle
- Source : A14 slides 32 #4, 34 ; S L78
- Menu : Trains / Suivi des Thèmes
- Statut ligne : vide
- Ambiguïté : aucune

### EX-COO-010 — Statut intermédiaire « Validation Pré-Prod » entre « En cours » et « A imprimer »
- Énoncé : avoir un statut intermédiaire entre « En cours » et « A imprimer » : si on clique sur « exporter », mettre le statut à « Validation Pré-Prod » ; remplace le mail d'Isa informant les plateformes que le scro a été validé. A15 slide 4 : prévoir une coche « validé Pré-Prod » dans la cible.
- Type : transition
- Source : A14 slide 32 #5 ; A15 slide 4 ; S L79
- Menu : non précisé (Liste des trains / Export)
- Statut ligne : vide
- Ambiguïté : l'existant a déjà un statut « Instruction ok » (2) entre « En cours » (1) et « A imprimer » (5), et l'export fait passer 2 -> 5 : le nouveau statut se situe où ? statut ou coche (A15) ?

### EX-COO-011 — Ne pas autoriser le drag & drop après l'envoi d'une prépa
- Énoncé : ne pas autoriser le drag & drop (déplacement) après l'envoi d'une prépa ; revoir le rétro-planning pour voir s'il s'agit d'un process ou d'un blocage système.
- Type : règle
- Source : S L101 (sans catégorie ni numéro)
- Menu : non précisé
- Statut ligne : A revoir Bao
- Ambiguïté : objet du drag & drop non précisé (positions de trains ? lignes ?) ; ligne isolée

### EX-COO-012 — Contrôle des réceptions sans IP et gestion des DM
- Énoncé : (cible) contrôle des réceptions sans IP + gestion des DM / mises à jour post envoi des préparations (tâches Pré-Prod du process cible).
- Type : fonctionnalité
- Source : A14 slide 34
- Menu : Alertes Pré-Prod / dashboard
- Statut ligne : absent de S en tant que ligne propre
- Ambiguïté : libellés seuls

### EX-COO-013 — Menu « Alertes Pré-Prod » : intitulés de thèmes proches
- Énoncé : (voir THM-002) créer un menu Alertes Pré-Prod ; alerte sur intitulés similaires (« Marché de Noël, Soldes, Vœux » pour différentes villes : source d'erreur) ; rappel aux gestionnaires + alerte Rayane.
- Type : fonctionnalité
- Source : A14 slide 30 #2 ; S L66
- Menu : Créer menu Alertes Pré-Prod
- Statut ligne : vide
- Ambiguïté : voir THM-002

---

# PARTIE 3 — Transverse (TRA)

### EX-TRA-001 — Changer l'ordre des colonnes
- Énoncé : pouvoir changer l'ordre des colonnes (ex. faire venir plus tôt le n° de contrat dans Préparation des trains).
- Type : fonctionnalité
- Source : A13 slide 16 #3 ; A15 slide 11 #4 ; S L42 (Ergonomie) et L23 (8 m² scro)
- Menu : Préparation 2m² Fixe ; Préparation des trains
- Statut ligne : vide
- Ambiguïté : aucune

### EX-TRA-002 — Sélections multiples (annonceurs, lignes)
- Énoncé : pouvoir faire des sélections multiples avec plusieurs annonceurs ; pouvoir faire des sélections multiples de lignes (aujourd'hui sélection unitaire parfois). A15 : choix multiple (idem pour ne sélectionner qu'un afficheur).
- Type : fonctionnalité
- Source : A13 slide 16 #4 ; A15 slide 11 #4 ; S L43, L51
- Menu : Préparation 2m² Fixe, Préparation des trains
- Statut ligne : vide
- Ambiguïté : L51 se termine par « On doit parfois sélectionner chaque ligne unitairement : » (illustration/image non extraite)

### EX-TRA-003 — Filtres intelligents
- Énoncé : faire des filtres « intelligents » : en filtrant sur un annonceur, le champ thèmes doit n'afficher que les thèmes rattachés à cet annonceur (aujourd'hui tous les thèmes).
- Type : fonctionnalité
- Source : A13 slide 16 ; S L44
- Menu : Ergonomie
- Statut ligne : vide
- Ambiguïté : aucune

### EX-TRA-004 — Pas de rafraîchissement à chaque changement de filtre
- Énoncé : quand on change de filtre, pourquoi avoir à rafraîchir ? (le résultat doit se mettre à jour).
- Type : fonctionnalité
- Source : A15 slide 18 #4 ; S L46
- Menu : Ergonomie
- Statut ligne : vide
- Ambiguïté : formulé en question

### EX-TRA-005 — Garder l'extraction Excel
- Énoncé : garder la possibilité de toujours extraire les données dans Excel.
- Type : non-fonctionnel
- Source : A15 slide 18 #5 ; S L47
- Menu : Ergonomie
- Statut ligne : vide
- Ambiguïté : périmètre (tous écrans ?)

### EX-TRA-006 — Supprimer les caches (valeur de filtre mémorisée)
- Énoncé : supprimer les « caches » : la valeur précédemment renseignée dans un filtre reste dans l'écran.
- Type : fonctionnalité
- Source : A13 slide 16 ; S L53
- Menu : Ergonomie
- Statut ligne : vide
- Ambiguïté : formulé « Supprimer les caches ? » ; ne dit pas si la mémorisation est souhaitée dans certains cas

### EX-TRA-007 — Réduire le nombre de clics (impressions, Réception)
- Énoncé : de façon générale réduire le nombre de clics ; exemple : gestion des impressions, menu Réception.
- Type : non-fonctionnel
- Source : S L49
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : non mesurable

### EX-TRA-008 — Vues personnalisables
- Énoncé : permettre de personnaliser les vues (colonnes) car tout le monde ne se sert pas des mêmes informations ; trop de colonnes inutiles.
- Type : fonctionnalité
- Source : S L50
- Menu : Ergonomie
- Statut ligne : vide
- Ambiguïté : voisin de TRA-001 ; stockage par utilisateur non précisé

### EX-TRA-009 — Distinguer chaque ligne par une couleur
- Énoncé : pouvoir distinguer chaque ligne avec une couleur différente.
- Type : affichage
- Source : S L52
- Menu : Ergonomie
- Statut ligne : vide
- Ambiguïté : critère de couleur (manuel ? par statut ?) non précisé

### EX-TRA-010 — Sauvegarde des données de la veille (base REF)
- Énoncé : maintenir la notion de sauvegarde des données de la veille (base REF).
- Type : non-fonctionnel
- Source : A15 slide 10 #9 ; S L57
- Menu : Gestion des données
- Statut ligne : vide
- Ambiguïté : « base REF » non définie

### EX-TRA-011 — Purge de la liste des destinations et reprise de données
- Énoncé : liste des destinations à purger (ex. Brest change d'adresse) dans la reprise des données ; reprise des données (liste des rouleurs, adresses : à purger de l'historique).
- Type : traitement auto
- Source : A15 slides 15 #2, 18 #5 ; S L58, L61
- Menu : Gestion des données
- Statut ligne : vide
- Ambiguïté : périmètre de la reprise (migration vers le nouveau Circé) non défini

### EX-TRA-012 — Dates de validité des données de l'interface BC / Circé
- Énoncé : dans la gestion de l'interface BC/Circé, gérer des dates de validité pour ne garder dans Circé que la dernière donnée valide.
- Type : règle
- Source : A15 slide 15 #2 ; S L59
- Menu : Gestion des données
- Statut ligne : vide
- Ambiguïté : lié à TRA-014

### EX-TRA-013 — Extraction sur longue période
- Énoncé : pouvoir extraire des données sur une période longue (aujourd'hui limité mois par mois), ex. statistiques sur le nb d'affiches sur milk-run.
- Type : fonctionnalité
- Source : A15 slide 18 #5 ; S L60
- Menu : Gestion des données
- Statut ligne : vide
- Ambiguïté : aucune

### EX-TRA-014 — Annule et remplace (interface BC / Circé)
- Énoncé : pouvoir gérer des « annule et remplace » ; exemple : adresses de livraison : Circé garde tout sans savoir quelle est la dernière en vigueur.
- Type : règle
- Source : S L69
- Menu : Interface BC / Circé
- Statut ligne : vide
- Ambiguïté : liste des objets concernés au-delà des adresses non donnée

### EX-TRA-015 — Anomalie : quantités doublées dans l'état des réservations (2 semaines de départ)
- Énoncé : quantités doublées dans l'état des réservations lorsqu'il y a 2 semaines de départ.
- Type : règle (anomalie)
- Source : S L31 (catégorie Anomalies)
- Menu : Suivi / Etat des réservations
- Statut ligne : vide
- Ambiguïté : correspond à ANO-02 / repère « Multi-semaines » (docs HTML)

---

# PARTIE 4 — 2 m² Fixe et Pliage (FIX)

### EX-FIX-001 — Supprimer la distinction Vrac / Roulée
- Énoncé : supprimer la distinction des préparations Vrac / Roulée et fusionner en « 2m² Fixe » : cette distinction n'est plus nécessaire et génère des lignes en plus.
- Type : règle
- Source : A13 slide 16 #1 ; S L6
- Menu : Etat des résa ; Atelier 2 fixe
- Statut ligne : vide
- Ambiguïté : aucune

### EX-FIX-002 — Automatiser la création du fichier de prod de la multi-rouleuse
- Énoncé : intégrer dans l'atelier le dev de Rayane qui automatise la création du fichier de prod alimentant la multi-rouleuse : générer en un seul clic ce qui nécessite 5 étapes × nb de thèmes. Process simplifié décrit : exporter tous les dossiers sans filtre, « Lancer », sélectionner le fichier, tous les fichiers par annonceur sont créés avec un bilan des fichiers fusionnables ; l'atelier confirme.
- Type : fonctionnalité
- Source : A13 slides 6, 16 #2 ; S L7
- Menu : Préparation 2m² Fixe
- Statut ligne : vide
- Ambiguïté : nature de la « moulinette » (hors Circé aujourd'hui) ; règle de fusion annonceur multi-dossiers/mono-thème

### EX-FIX-003 — Alerte mail si envoi d'un dossier fixe après le 1er colisage
- Énoncé : envoyer une alerte (mail) sur tout ce qui tombe dans les préparations du fixe après le jeudi : alerte si la date d'envoi d'un dossier fixe pour la semaine S est supérieure à la date du 1er colisage effectué pour la semaine S. Demandée par Nîmes.
- Type : traitement auto
- Source : A13 slides 17 #10, 18 ; S L8
- Menu : (Pliage) non précisé
- Statut ligne : A revoir Bao
- Ambiguïté : recouvrement avec COO-003 (alerte rajouts post préparation, fenêtre jeudi-vendredi) ; catégorie « 2 m² Fixe / Pliage » ; destinataires non précisés

### EX-FIX-004 — Ajouter les jours d'affichage dans la préparation
- Énoncé : ajouter les jours d'affichage dans la préparation pour prioriser en fonction des jours de départ ; à creuser pour la présentation optimale sans multiplier les lignes (si plusieurs jours de départ, tout dans la même case ?).
- Type : fonctionnalité
- Source : A13 slide 17 #11 ; S L9
- Menu : non précisé (Préparation)
- Statut ligne : A revoir Bao
- Ambiguïté : présentation non tranchée

### EX-FIX-005 — Colonne entretien par afficheur et modification de la quantité à produire
- Énoncé : avoir une colonne avec l'entretien par afficheur et permettre aux ateliers du Fixe et du Pliage de modifier la quantité à produire si la quantité d'entretien reçue est insuffisante : permet de connaître la marge quand on déchire une affiche ou qu'on n'a pas reçu d'entretien, et de ne pas tout utiliser pour les premiers afficheurs (à Nîmes, contrôle dans Broadcast).
- Type : fonctionnalité
- Source : A13 slide 16 #5 ; A14 slide 24 #3 (1/) ; S L10
- Menu : Préparation 2m² Fixe + Pliage
- Statut ligne : vide
- Ambiguïté : règles de recalcul des autres quantités non précisées

### EX-FIX-006 — CG : ajouter des quantités d'entretien reçues
- Énoncé : dans le cas des CG on reçoit parfois plus d'affiches qu'attendu et on les prépare toutes : pouvoir ajouter des quantités d'entretien reçues.
- Type : fonctionnalité
- Source : A13 slide 16 #6 ; S L11
- Menu : Réception ? (point d'interrogation dans la source)
- Statut ligne : vide
- Ambiguïté : « CG » non défini ; menu incertain (Réception ?)

### EX-FIX-007 — Paramétrer la taille de rouleau max de la multi-rouleuse
- Énoncé : pouvoir paramétrer la taille de rouleau max pour la multi-rouleuse (à Wissous la machine atteint difficilement 10 affiches par rouleau).
- Type : fonctionnalité
- Source : A13 slide 17 #12 ; S L13
- Menu : non précisé
- Statut ligne : A creuser Rayane (lien avec la moulinette de construction des fichiers de prod)
- Ambiguïté : valeur par défaut/maximale non fixée

### EX-FIX-008 — Gestion de l'entretien (vision + fichier de prod)
- Énoncé : (1) ajouter la vision de l'entretien dans Circé (au minimum dans le dashboard) et permettre aux ateliers Fixe et Pliage de modifier la quantité à produire si l'entretien reçu est insuffisant ; (2) si l'afficheur doit poser 10 affiches, la 11e est mise dans le rouleau : pouvoir modifier le fichier de prod pour sortir l'entretien si besoin par contrat, par thème et par plateforme. Par défaut 8 %, modifiable à la préparation, le client (notamment les Villes) envoie ce qu'il veut. Aujourd'hui pas de visibilité de l'entretien pour le fixe et le scro.
- Type : fonctionnalité
- Source : A14 slide 24 #3 ; S L80 (catégorie Production)
- Menu : Atelier 2m² Fixe et Pliage ? + dashboard
- Statut ligne : A revoir Bao
- Ambiguïté : menu incertain (point d'interrogation) ; partie 2 non détaillée

### EX-FIX-009 — Modifier thème et annonceur en dernier lieu même si la prod est lancée
- Énoncé : pour le fixe et la Colle, permettre aux plateformes de modifier le thème et l'annonceur en dernier lieu dans Circé même si la prod est lancée : page Suivi des thèmes élargie à tous les ateliers avec droits limités (cf. cas Quick V2). Problèmes : 2 intitulés distincts donnent 2 tiroirs au lieu d'un ; si prépa BC envoyée mais changement de visuel, pour le déroulant on peut changer l'intitulé mais pour le fixe on ne peut plus.
- Type : permission
- Source : A14 slide 30 #4 ; S L12
- Menu : Page Suivi des thèmes
- Statut ligne : vide
- Ambiguïté : droits à limiter non précisés ; contredit A13 slide 14 (voir contradictions) ; « Quick V2 » non défini

### EX-FIX-010 — Conserver le bouton « Colisage » (décision d'atelier)
- Énoncé : décision : plus prudent de garder le bouton Colisage pour l'équipe de Wissous : il distingue les dossiers dont la donnée est figée. Colisage = la Pré-Prod ne peut plus y toucher = la main est aux plateformes ; ce qui a été colisé est identifiable par le statut « En cours ». Voir avec Géraldine si le dev fait pour Nîmes (impression des étiquettes de palette) peut l'intéresser. La maquette l'appelle « Libération de la semaine » (HTML).
- Type : règle
- Source : A13 slide 18 ; D5 (HTML)
- Menu : 2m² fixe / A traiter
- Statut ligne : absent de S
- Ambiguïté : nom du bouton à aligner (Colisage vs Libération de la semaine)

### EX-FIX-011 — Suivi de prod enrichi (synthèse quantités attendues + suivi)
- Énoncé : la synthèse de Circé est trop synthétique : « OK pour avoir quelque chose qui reprendrait à la fois les quantités attendues et le suivi de prod ». Colonnes proposées : Dossier, Annonceur, Thème, Qté attendue sans entretien, Qté attendue avec entretien, Qté Reçue, Reste à recevoir, Reste à recevoir %, IP saisies ?, Format, Plateforme, Date prévisionnelle de livraison, Statut Prod, FAIT, RESTE A FAIRE (exemples chiffrés fournis en mock).
- Type : fonctionnalité
- Source : A13 slide 18
- Menu : Suivi de prod
- Statut ligne : absent de S (rapproché de PIL-001/002)
- Ambiguïté : illustration en mock ; valeurs d'exemple incohérentes (ex. 50,4 en qté reçue)

---

# PARTIE 5 — Scro / Déroulant et suivi de prod (SCR)

### EX-SCR-001 — Intégrer l'Excel « Fichier Vierge »
- Énoncé : intégrer dans Circé l'Excel « Fichier Vierge » : aujourd'hui saisie manuelle, à partir d'un export par opérateur, de tout ce qui a été fait dans la journée (estimation de la charge réalisée et restante, passage d'info entre shifts). N'existe pas à Nîmes (répartition du travail différente).
- Type : fonctionnalité
- Source : A15 slide 9 #4 ; S L14
- Menu : non précisé
- Statut ligne : A creuser Rayane
- Ambiguïté : contenu de l'Excel non fourni

### EX-SCR-002 — Intégrer l'Excel « Tableau de Roulage »
- Énoncé : intégrer le Tableau de Roulage, alimenté automatiquement par l'info de la bague ; aujourd'hui saisie manuelle par jour et par opérateur du nb de trains de 1, 2, 3 ou 4 pour ajuster les primes de prod.
- Type : fonctionnalité
- Source : A15 slide 9 #5 ; S L15
- Menu : non précisé
- Statut ligne : A creuser Rayane
- Ambiguïté : règle de calcul des primes hors périmètre

### EX-SCR-003 — Simplifier la préparation des fichiers de prod Vendôme
- Énoncé : voir quelles améliorations simplifieraient la préparation des fichiers de prod pour les Vendômes (cf. ce qui a été fait pour le fixe).
- Type : fonctionnalité
- Source : A15 slide 9 #6 ; S L16
- Menu : non précisé
- Statut ligne : A creuser Rayane
- Ambiguïté : besoin non défini (à creuser)

### EX-SCR-004 — Revoir les tableaux de suivi de prod (tout en consolidé dans l'outil)
- Énoncé : revoir les tableaux de suivi de prod ; tout le travail d'analyse se fait dans des Excel hors Circé ; pourquoi ne pas tout laisser consolidé dans l'outil, avec la vision du fait (produits finis et trains) et du reste à faire.
- Type : fonctionnalité
- Source : A15 slide 9 #7 ; S L17
- Menu : non précisé
- Statut ligne : A creuser Rayane (A15 : à creuser Bao / Rayane)
- Ambiguïté : voir PIL-001/002

### EX-SCR-005 — « Creuser ce cas » : n° de contrat saisis dans les thèmes
- Énoncé : cas de n° de contrat saisis dans les thèmes, que l'on ne voit qu'à la génération du fichier (@stéphane / @gerald doit envoyer un exemple à Fabrice) ; uniquement 2 m².
- Type : règle
- Source : A14 slide 30 #5 ; S L18
- Menu : non précisé
- Statut ligne : En attente input Patrick
- Ambiguïté : besoin non défini ; attente d'un exemple

### EX-SCR-006 — Raccrochages en masse dans le train
- Énoncé : pouvoir effectuer des raccrochages dans le train en masse ; aujourd'hui, quand il y a trop de lignes, Circé « bugge ».
- Type : fonctionnalité
- Source : A15 slide 9 #3 ; S L19 (2m² Scro / 8m² Scro)
- Menu : liste des instructions déroulants
- Statut ligne : vide
- Ambiguïté : volumétrie cible non précisée

### EX-SCR-007 — Pré-assemblage 8 m² par client ou par destinataire
- Énoncé : pouvoir effectuer un pré-assemblage par client mais aussi par destinataire (idéalement filtre sur n° de département) ; priorité du destinataire pour Nîmes, des gros volumes pour Wissous ; aujourd'hui on choisit un client en totalité.
- Type : fonctionnalité
- Source : A15 slide 11 #1 ; S L20
- Menu : non précisé (pré-assemblage)
- Statut ligne : vide
- Ambiguïté : aucune

### EX-SCR-008 — Page Préparation : colonnes annonceur 1 – thème 1 / annonceur 2 – thème 2
- Énoncé : dans la page Préparation, aujourd'hui colonnes annonceur puis colonnes thèmes puis info bandeaux ; permettre l'affichage annonceur 1 – thème 1 / annonceur 2 – thème 2 (rapprocher les visuels de l'annonceur). Illustration demande n°2 non extraite.
- Type : affichage
- Source : A15 slide 11 #2, slide 12 ; S L21
- Menu : Préparation des trains
- Statut ligne : vide
- Ambiguïté : illustration non extraite

### EX-SCR-009 — Lister tous les trains contenant tel(s) thème(s)
- Énoncé : dans Préparation des trains, lister tous les trains contenant 1 à n thèmes (sélection multiple) pour répartir ces thèmes par opérateur au roulage et réduire les confusions/erreurs.
- Type : fonctionnalité
- Source : A15 slide 11 #3, slide 13 ; S L22
- Menu : Préparation des trains
- Statut ligne : vide
- Ambiguïté : aucune

### EX-SCR-010 — Sélection d'un nombre donné de lignes (ex. 60 trains de 4)
- Énoncé : filtrer les trains de 4 sur une destination (ex. Nanterre, déjà possible) et pouvoir en sélectionner un nombre donné en une fois (ex. 60 = un opérateur), par exemple les 60 premiers ; aujourd'hui sélection un à un parmi plusieurs dizaines de lignes (exemple Wissous).
- Type : fonctionnalité
- Source : A15 slide 11 #5, slide 14 ; S L24
- Menu : Préparation des trains
- Statut ligne : vide
- Ambiguïté : critère de choix des « premiers » (ordre d'affichage) non précisé

### EX-SCR-011 — Sortir automatiquement les feuilles d'activité de bacs et feuilles de stock
- Énoncé : pouvoir sortir automatiquement les feuilles d'activité de bacs mises sur les chariots ainsi que les feuilles de stocks.
- Type : fonctionnalité
- Source : A15 slide 11 #6 ; S L25
- Menu : non précisé
- Statut ligne : (à creuser Rayane dans le texte, pas en colonne Commentaire)
- Ambiguïté : le « à creuser Rayane » figure dans la phrase, pas dans la colonne Commentaire

### EX-SCR-012 — Afficher le n° de panneau BC pour chefs d'équipe et coordinateurs
- Énoncé : dans l'écran Préparation, permettre aux chefs d'équipe et coordinateurs d'afficher le n° de panneau de BC (disponible pour Patrick seulement) pour répondre aux questions en cas de non-conformité.
- Type : permission
- Source : A15 slide 11 #7 ; S L26
- Menu : Préparation des trains
- Statut ligne : vide
- Ambiguïté : « Patrick » : rôle non défini

### EX-SCR-013 — Vignette lien vers le visuel dans Suivi par thème (8 m²)
- Énoncé : avoir dans « suivi par thème » la même vignette de lien vers le visuel que dans l'état des résa (même demande que pour la réception, cf. REC-010).
- Type : affichage
- Source : A15 slide 11 ; S L27
- Menu : Suivi par thème
- Statut ligne : vide
- Ambiguïté : doublon avec REC-010

### EX-SCR-014 — Anomalie : saturation à la génération des fichiers (raccrochage scro)
- Énoncé : générer les fichiers : quand on en a trop fait il y a saturation et on ne peut plus en faire d'autres.
- Type : règle (anomalie)
- Source : S L32 (Anomalies)
- Menu : Raccrochage scro
- Statut ligne : vide
- Ambiguïté : « trop fait » (quel seuil ?) non défini

### EX-SCR-015 — Reporting MUI (réunion du lundi)
- Énoncé : reproduire dans Circé l'Excel de synthèse produit pour la réunion du lundi (reporting des MUI).
- Type : fonctionnalité
- Source : A15 slide 10 #10 ; S L94
- Menu : New écran
- Statut ligne : vide
- Ambiguïté : contenu de l'Excel non fourni

### EX-SCR-016 — Réunion du jeudi : synthèse + commentaires
- Énoncé : réunion du jeudi sur la prod de la semaine suivante : reproduire l'Excel de synthèse et permettre la saisie de commentaires.
- Type : fonctionnalité
- Source : A15 slide 10 #11 ; S L95
- Menu : New écran
- Statut ligne : vide
- Ambiguïté : aucune

### EX-SCR-017 — Scan des codes barre : mise à jour des affiches produites et des stocks
- Énoncé : scanner les codes barre et que Circé mette directement à jour le nb d'affiches produites et les stocks.
- Type : fonctionnalité
- Source : A15 slide 10 #8 ; S L97 (Suivi de Prod)
- Menu : non précisé
- Statut ligne : vide
- Ambiguïté : contredit STK-001/STK-005 (sortie de stock déclenchée par l'expédition et non par le scan) : voir contradictions

### EX-SCR-018 — Fichiers « optimisés » (autres points discutés / abandonnés)
- Énoncé : pourquoi demander à l'utilisateur de supprimer des lignes pour arriver à 20 tiroirs ? l'outil ne pourrait-il pas proposer des fichiers (bouton « Fichier Optimisé ») ? Réponse : c'est au chef d'équipe de savoir comment il veut prioriser selon l'avancement ; cette étape n'est pas la plus chronophage. Second point : au 8 m² on se retrouve avec le visuel du 2 m² alors que ce n'est pas le même : rappels réguliers aux gestionnaires, dépend des clients.
- Type : règle (décision d'abandon)
- Source : A15 slide 19
- Menu : Export préparation
- Statut ligne : abandonné ; absent de S
- Ambiguïté : le second point n'a pas de demande fonctionnelle ; la limite de 20 tiroirs reste donc à saisir à la main

---

# PARTIE 6 — Pilotage / suivi de prod (PIL)

### EX-PIL-001 — Synthèse suivi de prod par atelier et par semaine
- Énoncé : Nb de trains à produire (A = total trains) ; nb de trains OK pour production (B = 100 % visuels reçus) ; nb de trains en attente (= liste des visuels en attente = A − B) ; nb de trains terminés (C = nb de trains scannés) ; % d'avancement = C / A.
- Type : fonctionnalité
- Source : A15 slide 20
- Menu : Suivi de prod
- Statut ligne : POUR DISCUSSION EN ATELIER ; absent de S (rapproché de SCR-004)
- Ambiguïté : aucune sur les formules ; périmètre fixe/pliage non précisé

### EX-PIL-002 — Détail des dossiers par semaine (suivi de prod)
- Énoncé : colonnes : Dossier, Thème, Qté attendue sans entretien, Qté attendue avec entretien, Qté reçue, Reste à recevoir, Reste à recevoir %, IP saisies ?, Format, Plateforme, Date prévisionnelle de livraison, Création demies haut (Nîmes), Création demies bas (Nîmes), Fait, Reste à faire, Destination, Afficheur, Expédié, Preuve de livraison.
- Type : affichage
- Source : A15 slide 20
- Menu : Suivi de prod
- Statut ligne : POUR DISCUSSION EN ATELIER
- Ambiguïté : exemple chiffré en mock ; colonnes « Preuve de livraison » sans source (la preuve de livraison n'existe pas dans l'existant)

---

# PARTIE 7 — Expédition (EXP)

### EX-EXP-001 — Bouton « envoi manuel » dans « Préparer colis pour les trains »
- Énoncé : ajouter dans le menu « Préparer colis pour les trains » le même bouton « envoi manuel » que dans Liste des colis (évite d'aller sur le PC Géodis ; aujourd'hui jonglage entre 2 écrans).
- Type : fonctionnalité
- Source : A15 slides 15-17 #1 ; S L28 (catégorie 8 m² Scro)
- Menu : Préparer colis pour les trains
- Statut ligne : vide
- Ambiguïté : catégorie 8 m² scro dans S, « Expédition » dans A15

### EX-EXP-002 — Milk : comptage des bagues par scan
- Énoncé : pour les Milk, scan des codes barre -> Circé compte le nb de bagues -> l'humain valide et crée le colis Geodis ; si un code barre est détérioré il en comptera 9, l'humain rajoutera la 10e.
- Type : règle
- Source : A14 slide 31 #1 ; S L39
- Menu : non précisé
- Statut ligne : vide
- Ambiguïté : « 10 » bagues par colis milk : règle ou exemple ?

### EX-EXP-003 — Sélection multiple pour supprimer un train d'un colis
- Énoncé : sélection multiple pour tout supprimer le train mis dans le colis ; aujourd'hui on copie/colle code par code les n° de colis de Liste des colis vers Préparation de train / Préparer.
- Type : fonctionnalité
- Source : A15 slide 15 #3 ; S L45
- Menu : Préparation de train / Préparer ; Liste des colis
- Statut ligne : vide
- Ambiguïté : formulation confuse dans la source

### EX-EXP-004 — Consulter le contenu d'un colis depuis Préparation
- Énoncé : depuis l'écran Préparation, pouvoir consulter le contenu d'un colis (par exemple en double-cliquant) ; aujourd'hui copier le n° de colis et le coller dans Liste des colis.
- Type : fonctionnalité
- Source : A13 slide 16 #8 ; S L55
- Menu : Préparation
- Statut ligne : vide
- Ambiguïté : aucune

### EX-EXP-005 — Afficher le BL transporteur Geodis dans Liste des colis
- Énoncé : afficher le BL transporteur Geodis depuis Circé dans Liste des colis ; avant la bascule vers le nouveau logiciel Geodis le code transporteur était souligné en bleu et donnait accès à l'étiquette signée ; réactiver ce lien.
- Type : fonctionnalité
- Source : A13 slide 17 #9 ; S L56
- Menu : Liste des colis
- Statut ligne : vide
- Ambiguïté : dépend de l'API Geodis (non décrite)

### EX-EXP-006 — Ré-ouverture de colis pour ajouter ou retirer un rouleau
- Énoncé : autoriser la ré-ouverture de colis pour ajouter un rouleau oublié ou en enlever ; aujourd'hui Circé considère qu'il n'y a aucune raison de ré-ouvrir un colis et impose la création d'un nouveau colis.
- Type : fonctionnalité
- Source : A13 slide 16 #7 ; S L93 (catégorie « Refusé »)
- Menu : Liste des colis
- Statut ligne : catégorie « Refusé » dans S ; présenté comme besoin #7 sans mention de refus dans A13
- Ambiguïté : refusé ou non ? voir contradictions ; A14 ne fait référence à « Besoin Refusé » que pour le mail au commercial

---

# PARTIE 8 — Stocks (STK)

### EX-STK-001 — Règles de calcul des stocks (événements)
- Énoncé : la quantité d'affiches est mise à jour à chaque événement : réception = entrée de stock des quantités saisies ; si fin de journée Geodis ou scan Milkrun à « Terminé » = sortie de stock des affiches préparées (vs actuellement le scan des codes barre) ; si rebus = sortie de stock de la quantité mise au rebus ; si destruction = sortie de stock de la quantité en stock. Actuellement à Nîmes les stocks ne sont pas mis à jour par le scan en fin de production. À vérifier : les écrans où les stocks s'affichent. A13 #13 : déclencher les sorties de stock à partir des expéditions (vs actuellement au « douchage » des étiquettes de prod).
- Type : règle
- Source : A14 slide 31 #1 ; A13 slide 17 #13 ; S L38, L64
- Menu : À vérifier les écrans où les stocks s'affichent
- Statut ligne : vide
- Ambiguïté : contradiction avec SCR-017 (scan met à jour les stocks) ; « douchage » (douchette ?) ; Terminé « fin de journée Geodis ou scan Milkrun » : deux déclencheurs ; doublon S L64 (catégorie Gestion des stocks) et L38

### EX-STK-002 — Menu « Suivi des stocks » (statuts à conserver / à détruire / à renvoyer / sorti du stock)
- Énoncé : ajouter un menu « Suivi des stocks » pour suivre les quantités par n° d'affiche, avec des écrans de gestion des statuts : A conserver ; À détruire (= état de destruction existant, à sortir de Suivi et remettre dans ce menu) ; A renvoyer (notamment pour Paris) ; Sorti du stock. Les bandeaux doivent aussi apparaître dans ces écrans.
- Type : fonctionnalité
- Source : A14 slide 31 #2 ; S L40
- Menu : Suivi des Stocks (nouveau !)
- Statut ligne : vide
- Ambiguïté : transitions entre statuts non précisées ; « Sorti du stock » = statut ou événement ?

### EX-STK-003 — État des mises en conservation (flag conservation)
- Énoncé : ajouter un état des mises en conservation (mise en conservation = flag conservation) ; prévoir de bien utiliser la coche pour la Ville de Paris.
- Type : fonctionnalité
- Source : A14 slide 31 #3 ; S L41
- Menu : Suivi des Stocks (nouveau !)
- Statut ligne : vide
- Ambiguïté : « la coche » pour la Ville de Paris : comportement précis non décrit

### EX-STK-004 — État de destruction : règles et délais
- Énoncé : reprendre l'état de destruction existant (actuellement dans Suivi) dans le menu Suivi des stocks, avec une coche pour confirmer la destruction. Une affiche n'est proposée à la destruction que s'il n'y a pas de conservation demandée sur le visuel et plus de campagne prévue ; si on détruit on détruit toutes les affiches restantes ; les affiches à conserver (flag saisi) n'apparaissent pas automatiquement dans cet écran ; délai pour le 2 m² = 4 semaines, pour le 8 m² = 2 semaines (faute de place de stockage), à revoir dans les CGV 2027 ; la quantité rebus défalque les stocks.
- Type : règle
- Source : A14 slide 31 #4 ; S L37
- Menu : Suivi des Stocks (nouveau !)
- Statut ligne : A revoir Bao - impact CGV 2027
- Ambiguïté : point de départ des délais 4/2 semaines non précisé ; contredit l'existant (état de destruction : affiches entrées depuis plus d'un an)

### EX-STK-005 — Sorties de stock déclenchées par les expéditions (doublon)
- Énoncé : déclencher les sorties de stock à partir des expéditions (vs actuellement au « douchage » des étiquettes de prod).
- Type : règle
- Source : S L64 ; A13 slide 17 #13
- Menu : Gestion des stocks
- Statut ligne : vide
- Ambiguïté : voir STK-001

---

# PARTIE 9 — Thèmes (THM)

### EX-THM-001 — Règles de gestion des intitulés de thèmes (« 1er qui a parlé »)
- Énoncé : les thèmes sont issus de la saisie des IP par la Pré-Prod ; si retrouvés à la réception : RAS ; si réception partielle : retrouver à la réception le thème utilisé la 1re fois ; si IP non connues à la réception : règle du « 1er qui a parlé qui a raison » : la 1re plateforme qui reçoit sans IP donne un intitulé, proposé à l'autre plateforme si elle attend aussi un visuel pour le dossier ; la Pré-Prod consulte régulièrement les réceptions sans IP pour récupérer les IP auprès du client ; à la saisie des IP elle utilise autant que possible le nom saisi en premier ; si elle corrige elle informe les plateformes pour réimpression des feuilles de stock (une alerte peut suffire vs mail ; voir si on peut automatiser en suivant les màj de thème). Problèmes : pas de règle de nommage ; plusieurs intitulés pour un même thème envoyé de Broadcast (lignes inutiles).
- Type : règle
- Source : A14 slide 30 #1 ; S L65
- Menu : non précisé
- Statut ligne : vide
- Ambiguïté : « autant que possible » (non impératif) ; absence de règle de nommage = pas de règle cible

### EX-THM-002 — Écran d'alerte sur intitulés proches (menu Alertes Pré-Prod)
- Énoncé : créer un écran d'alerte (dans Broadcast selon A14/S : « créer dans Broadcast un écran d'alerte ») pour identifier les intitulés proches ; la Pré-Prod corrige dans Broadcast ou directement dans Circé selon l'avancement. Exemples : Marché de Noël, Soldes, Vœux pour différentes villes ; rappel aux gestionnaires + alerte Rayane sur les intitulés similaires.
- Type : fonctionnalité
- Source : A14 slide 30 #2 ; S L66
- Menu : Créer menu Alertes Pré-Prod
- Statut ligne : vide
- Ambiguïté : « dans Broadcast » vs menu Circé « Alertes Pré-Prod » : où se situe l'écran ? Rapproché de la cible HTML « Thème proche » (calcul par Circé)

### EX-THM-003 — Page des modifications de thème après identification
- Énoncé : identifier les cas de modification d'intitulé de thème intervenant après l'identification en plateforme pour que les plateformes modifient la feuille de stock ; créer une nouvelle page avec les modifications de thème reçues après l'identification, à la disposition de la réception, avec une alerte indiquant d'y aller.
- Type : fonctionnalité
- Source : A14 slide 30 #3 ; S L67
- Menu : Créer nouvel écran à mettre à disposition de la réception + alerte
- Statut ligne : vide
- Ambiguïté : aucune

### EX-THM-004 — Purge des anciens thèmes après modification (rappel)
- Énoncé : voir REC-004 (purger les anciens thèmes des fenêtres « Ajouter Prépa » et des réceptions attendues).
- Type : règle
- Source : A14 slide 31 #5 ; S L74
- Menu : Réception
- Statut ligne : vide
- Ambiguïté : doublon

---

# PARTIE 10 — Administration et droits (ADM)

### EX-ADM-001 — Où paramétrer un nouvel imprimeur, livreur, agent de réception ?
- Énoncé : savoir où l'on paramètre un nouvel imprimeur, un livreur, un agent de réception, etc.
- Type : fonctionnalité
- Source : A14 slide 29 #14 ; S L29 (catégorie Administration)
- Menu : Administration
- Statut ligne : vide
- Ambiguïté : formulé en question ; listes non limitatives (« etc. »)

### EX-ADM-002 — Authentification par adresse mail Cityz (plus de mail générique)
- Énoncé : gestion des utilisateurs : se connecter avec son adresse mail Cityz ; à Nîmes plusieurs personnes utilisent une adresse générique, pas à Wissous.
- Type : permission
- Source : A15 slide 18 #1 ; S L62
- Menu : Gestion des droits / users
- Statut ligne : vide
- Ambiguïté : méthode d'authentification (SSO, mot de passe) non précisée

### EX-ADM-003 — Restreindre la ré-impression des bagues
- Énoncé : revoir les droits qui permettent de ré-imprimer les bagues (= revenir de « Terminé » à « Imprimer ») ; le restreindre aux Directeurs de Plateforme et chefs d'équipe ; possible pour Patrick mais pas pour les ateliers ?
- Type : permission
- Source : A15 slide 18 #2 ; S L63
- Menu : Gestion des droits / users
- Statut ligne : vide
- Ambiguïté : « possible pour Patrick mais pas pour les ateliers ? » : état actuel ambigu ; rôle de Patrick non défini ; statut libellé « Imprimer » vs « A imprimer »

### EX-ADM-004 — Listes de distribution (alertes)
- Énoncé : liste des destinataires des mails d'alerte (chef d'atelier / admins plateforme / coordinateurs) à établir dans Administration ; écran de gestion des listes de distribution, voir si ajouter le type d'alerte.
- Type : fonctionnalité
- Source : A14 slide 33 ; S L71
- Menu : Administration
- Statut ligne : A revoir Bao / Rayane
- Ambiguïté : voir COO-003

---

# PARTIE 11 — Bus Nanterre (BUS)

### EX-BUS-001 — Bus hors Nanterre : écran de réceptions attendues avec saisie des quantités
- Énoncé : interface écran avec les réceptions attendues, un champ de saisie des quantités reçues et possibilité d'alertes.
- Type : fonctionnalité
- Source : S L33 (catégorie Bus Hors Nanterre)
- Menu : non précisé
- Statut ligne : A revoir Bao
- Ambiguïté : « Bus hors Nanterre » : plateformes concernées non précisées

### EX-BUS-002 — Menu Bus pour les affiches reçues à Nanterre
- Énoncé : (spec reprise dans S) Nanterre créée comme plateforme dans Circé, apparaît dans le module Réception ; un dossier Bus répondant aux conditions de transmission du flux existant est transmis à Circé pour Nanterre sans ressaisie (n° de dossier, client, format, semaine de pose, quantités par centre bus saisis dans Broadcast) ; formats Bus intégrés au référentiel Circé, traités dans un onglet Bus dédié (À traiter / Préparation / Liste des colis) aux fonctionnalités identiques aux onglets 2 m² fixe et Pliage ; rapprochement livraison/dossier par le n° de dossier de vente et la semaine portés sur le BL (« rien à développer ») ; statuts attendu / reçu / manquant consultables par dossier et par dépôt : Nanterre voit les affiches attendues et volumes à produire avant la réception des feuilles de route manuelles (lundi et jeudi de S-1), date de visibilité = date de transmission Broadcast, mesurable sur un échantillon ; sur une semaine de pose le total des attendues à Nanterre dans Circé = total des dossiers Bus transmis par Broadcast pour cette semaine. Les règles de délai et le workflow Dernière Minute (formulaire produit sur Process Métiers hors Circé) sont conservés tels quels ; leur paramétrage ne relève pas de cette US. Le magasinier saisit les infos à la réception ; le suivi des délais relève de la production. Traitement des échecs de transmission (reprise, information) = fonctionnement du flux existant.
- Type : fonctionnalité
- Source : S L34 (« cf spec »)
- Menu : Ajouter un menu Bus
- Statut ligne : vide
- Ambiguïté : « le flux existant » pour le Bus : D6 dit qu'il n'existe aucun flux Broadcast pour le Bus aujourd'hui (voir contradictions) ; « conditions de transmission » non listées ; US de référence non fournie

### EX-BUS-003 — Ajuster manuellement la quantité à encoller (Bus)
- Énoncé : pouvoir ajuster à la hausse ou à la baisse la quantité à encoller à l'édition des états de collage, globalement et par centre bus, pour produire selon le parc en exploitation. Aujourd'hui : Broadcast applique +8 % de production figé et +20 % d'entretien par défaut, plateformes sans la main ; le parc Bus est vivant (bus retirés, cadres non reposés).
- Type : fonctionnalité
- Source : S L35
- Menu : état de collage (non précisé)
- Statut ligne : vide
- Ambiguïté : « +8 % de production » vs « 8 % d'entretien » des autres formats : vocabulaire différent

### EX-BUS-004 — Visibilité des anomalies de réception Bus
- Énoncé : vérifier la visibilité dans Circé des anomalies affectant la production Bus : affiches totalement manquantes ; quantité reçue inférieure à l'attendue ; dossier en retard sur le délai de réception ; affiches non conformes (thème).
- Type : fonctionnalité
- Source : S L36
- Menu : non précisé
- Statut ligne : vide
- Ambiguïté : délai de réception (valeur) non fourni

---

# PARTIE 12 — Qualité (QUA)

### EX-QUA-001 — Intégrer le tableau de suivi des non-conformités
- Énoncé : intégrer le tableau de suivi des non-conformités dans Circé et y faire les demandes d'amélioration (ex. pouvoir rouvrir un ticket fermé, ajouter des cas métier dans les listes déroulantes). A14 slide 9 : onglet Mouvements : saisie de non-conformité avec lien vers une appli process métier.
- Type : fonctionnalité
- Source : A15 slide 18 #3 ; S L81 ; A14 slide 9
- Menu : non précisé
- Statut ligne : A revoir Bao
- Ambiguïté : périmètre (remplace ou intègre l'appli « process métier » ?)

---

# Synthèse chiffrée (EX-<MOD>)
| MOD | nb EX |
|---|---|
| REC | 24 |
| COO | 13 |
| TRA | 15 |
| FIX | 11 |
| SCR | 18 |
| PIL | 2 |
| EXP | 6 |
| STK | 5 |
| THM | 4 |
| ADM | 4 |
| BUS | 4 |
| QUA | 1 |
| Total | 107 |

Couverture de la synthèse : lignes Excel 6 à 97 (92 lignes alimentées, toutes rattachées à au moins un EX) + L101. Correspondance des lignes : REC (L30, L48, L54, L74, L82-92, L96), COO (L68, L70-73, L75-79, L101), TRA (L31, L42-47, L49-53, L57-61, L69), FIX (L6-13, L80), SCR (L14-27, L32, L94-95, L97), EXP (L28, L39, L45(dupl.), L55, L56, L93), STK (L37, L38, L40, L41, L64), THM (L65-67), ADM (L29, L62, L63), BUS (L33-36), QUA (L81).

# Statuts de lignes (colonne Commentaire de la synthèse)
- A revoir Bao : FIX-003 (L8), FIX-004 (L9), COO-002 (L70), COO-001 (L68), FIX-008 (L80), QUA-001 (L81), REC-005 (L82), BUS-001 (L33), COO-011 (L101), STK-004 (L37, avec « impact CGV 2027 »)
- A revoir Bao / Rayane : COO-003 (L71)
- A creuser Rayane : FIX-007 (L13), SCR-001 (L14), SCR-002 (L15), SCR-003 (L16), SCR-004 (L17)
- En attente input Patrick : SCR-005 (L18)
- Refusé (catégorie) : EXP-006 (L93) ; Besoin Refusé (A14) : REC-023
- Pour discussion en atelier : REC-016/021 (A13 s19), PIL-001/002 (A15 s20)
- Autres lignes : pas de commentaire (statut non précisé = non qualifié, ni accepté ni refusé)

# Statuts et transitions décrits
Les ateliers décrivent ou proposent :
- Préparation 2m² Fixe (par annonceur/thème/destinataire) : En cours (pas encore fait) -> Préparé (en cours de préparation) -> A expédier (après scan d'envoi) -> Terminé (saisie fin de journée chez Geodis) (A13 slide 10).
- Dossier : A traiter (défaut, prépa pas encore faite) -> En cours (prépa envoyée) (A15 slide 3) -> Instruction OK (déroulant seulement).
- Export préparation : statut A imprimer (par défaut) ; cible : intermédiaire « Validation Pré-Prod » entre En cours et A imprimer (COO-010).
- Réception attendue : Terminé / Partiel (existant).
- Stock : entrée à la réception, sorties au Terminé (fin de journée Geodis / scan Milkrun), au rebus, à la destruction (STK-001). Statuts de stock cibles : A conserver, À détruire, A renvoyer, Sorti du stock (STK-002).
- Bus : attendu / reçu / manquant par dossier et par dépôt (BUS-002).

# Glossaire (ateliers et besoins)
- Rayane : développeur cité pour moulinette/fichiers de prod, alertes (« à creuser Rayane »). Bao : personne qui doit revoir des lignes (rôle non défini ; dossier « Doc_Pilotage_Bao »). Patrick : rôle non défini (droits spéciaux). Isa(belle) : coordination (purge/déblocage, mail de validation scro). Fabrice, Nariman, Géraldine, Alain, Nelly, Arthur/Christine, Stéphane, Gerald : personnes citées.
- IP, DA, DV, BC, EDR : voir glossaire du fichier existant. PP : Pré-Prod. CC : campagne contrôlée ; CG, CP : non définis ; DM : dernière minute ; MUI ; VdP ; REP ; Print CM.
- Rebus : affiches mises au rebut ; flag conservation : indicateur de mise en conservation (visuel conservé à l'année) ; état de destruction : liste des affiches proposées à la destruction ; bagues : codes barre/étiquettes de train ; Milk / Milkrun : tournée de collecte (colis milk vs messagerie) ; Geodis : transporteur ; Vendôme, CCM V2, Venusial : machines/types de production ; multi-rouleuse : machine fixe ; zippage ; demies haut/bas : moitiés d'affiche 8 m² (quart d'affiche).
- Colisage (bouton) vs colisage (expédition) : voir fichier existant. Raccrochage ; fractionner ; orpheline ; rendre la main ; déblocage préparation.
- Print Cityz / Print CM : affiche imprimée par Cityz.

# Contradictions (ateliers entre eux, et ateliers vs HTML / synthèse)
1. Rendre la main sur le fixe : A13 slide 14 « contrairement au déroulant, il est possible de changer les informations même quand la préparation a été envoyée (fixe) » vs A14 slide 30 #4 / S L12 « pour le déroulant on peut changer l'intitulé, mais pour le fixe on ne peut plus ». Sens inverse. (Le HTML D5 va dans le sens de A13 pour « rendre la main ».) Les deux textes parlent peut-être de choses différentes (rendre la main vs modifier l'intitulé du thème) : non tranché.
2. Sorties de stock : A14 slide 31 « actuellement c'est le scan des codes barre qui génère les sorties de stock (mais pas à Nîmes) », A13 #13 « au douchage des étiquettes de prod » vs D6 « sorties de stock automatiques : aucune aujourd'hui (REU-08) » ; cible : A14/S sortie à « Terminé » (fin de journée Geodis / scan Milkrun) et A13 « à partir des expéditions » vs A15 #8 « scanner les codes barre et que Circé mette à jour les affiches produites et les stocks ».
3. Validation admin : A14 slide 32 « obligatoire pour le fixe comme pour le scro » vs HTML (D3 : ne conditionne pas les UM, pas de test dans le code ; ANO-14 « ne semble pas bloquer »; D1 « possible à n'importe quel statut ») ; A14 slide 18 note elle-même « l'absence de lien et de validation admin ne semble pas bloquer la création des affiches ».
4. Cible validation admin : A14/S L75-76 : proposition de raccrochage quand 3 événements sont réunis (identification, IP, prépa reçue), validée par un coordinateur, qui fait office de validation admin vs HTML D3/D4/D5 (02/11) : option A = proposition à la réception, sans attendre prépa ni Instruction OK. Les ateliers (14-16/10) sont antérieurs à la décision du 02/11.
5. Instruction OK automatique : A14/S L77 « commentaire de préparation vide » vs HTML D1/D3 « pas de commentaire ET exceptions = quantité » (règle de Nariman). A15 slide 3 ajoute le contrôle qté BC = nb d'exceptions comme composante de l'Instruction OK.
6. Re-saisie du % de répartition par thème : A15 slide 3 « étape bloquante, mais non nécessaire » vs D3 « répartition à 100 % sinon Circé refuse » et « Circé calcule les trains à partir de l'Instruction OK ».
7. Entretien : A14 slide 24 « pas de visibilité de l'entretien pour le fixe et le scro » vs D6 (entretien fourni par Broadcast pour fixe/pliage, faces ENTRETIEN dans le déroulant) ; entretien par défaut 8 % (A14, HTML) vs +20 % d'entretien par défaut et +8 % de production pour le Bus (S L35) ; 15 % si campagne contrôlée (A14, D6).
8. Destruction : état de destruction existant = affiches entrées depuis plus d'un an (D6) vs délais 4 semaines (2 m²) / 2 semaines (8 m²) (A14 #4, S L37) : point de départ des délais non précisé ; A14 #10 purge des réceptions attendues à 4 semaines hors flag conservation « à l'année ».
9. Date prévisionnelle de livraison : A13 slide 19 « si Print Cityz, source BC » vs A14 « saisie manuelle par les gestionnaires Pré-Prod » (et les HTML : portail print consulté à la main par Nîmes).
10. Bus : S L34 parle de « flux existant » et de « workflow Dernière Minute » vs D6 « aucun flux Broadcast pour le Bus ; Circé ne connaît que 2M2FIXE, PLIAGE, DEROULANT ».
11. Statut « Refusé » : S L93 classe en « Refusé » la ré-ouverture de colis (A13 #7, besoin non marqué refusé) alors que A14 marque « Besoin Refusé » le mail automatique au commercial (absent de S). Probable décalage de ligne.
12. « Colisage » : qui clique (A13 slide 6 sans acteur ; A13 slide 18 « Pré-Prod ne peut plus y toucher » ; D1 « Coordination, à confirmer ») ; statut « En cours = pas encore fait » (A13 slide 10) vs « En cours = colisé » (D1/D4).
13. Statut intermédiaire « Validation Pré-Prod » (A14 #5) : le statut « Instruction ok » (2) existe déjà entre En cours (1) et A imprimer (5) dans le code (D1/D3) ; et A15 propose plutôt une « coche » validé Pré-Prod.
14. Arrivée du dossier fixe dans l'atelier : A14 slide 13 (« Fixe : pas de mise à jour à ce stade » du raccrochage ; menus Fixe/Pliage mis à jour pour Scro / Scro + Fixe) vs D1/D2/D3 (la ligne fixe arrive à l'intégration de la prépa, statut À traiter).
15. Fréquence de l'EDR : « 2 màj/jour » (A14) vs copie toutes les 2 h (HTML).
16. Calendrier : A14 « Deadline = Jeudi S-2 » ; HTML « prépa envoyée le lundi » ; A14 slide 33 alerte « nuit du jeudi au vendredi S-2 jusqu'au vendredi S » ; A13 « Jeudi S-2 : menu 2m² Fixe ».
17. Doublons internes à la synthèse : L12 (thème/annonceur) et L65 ; L70 et L78 (exclure ne pas afficher) ; L45 (catégorie Ergonomie) vs expédition ; L58 et L61 ; L38 et L64 (sorties de stock). Pas des contradictions mais des redondances à dédoublonner.
18. Dates : A14 titre « 14-15 octobre », fichier 20261014 ; A15 titre « 15 et 16 octobre », fichier 20261015 ; S datée 16/10 (nom) ; l'extrait A14 mentionne un « doc 20261014 (Atelier Réception Pré-Prod) » : cohérent avec le nom de fichier.

# Modules tiers mentionnés
EXP (expédition), FIX (2 m² fixe / pliage), SCR (scro 2 m² et 8 m²), STK (suivi des stocks), THM (thèmes / alertes Pré-Prod), ADM (administration, droits, listes de distribution), BUS (Nanterre), QUA (non-conformités), PIL (dashboard / reporting MUI, réunions lundi et jeudi), plus interfaces : Broadcast (BC), Geodis (BL, étiquettes, fin de journée), Process Métiers (formulaire DM, appli non-conformités), Broadcast pour Bus.

# Sections non comprises ou incomplètes — contenu perdu faute d'images
- A13 : 24 images non extraites : copies d'écran « fiche de synthèse » (slides 7-9 : étapes 1 à 4), numérotation 1-8 de l'enchaînement de production (slides 6, 10-12), tableau de la slide 18 partiellement extrait (valeurs du mock), positions du texte de la slide 6 (diagramme).
- A14 : 32 images non extraites : diagramme « Process macro » (slide 6) et « Process cible » (slide 34) : flèches, couleurs manuel/auto, légende « Tâches Pré-Prod / Tâches Ateliers Plateformes » ; matrice des acteurs par étape et par site (slide 7 : les puces ●) : on ne sait pas qui fait quoi à Nîmes/Wissous ; logigrammes slides 8, 9, 13 ; copies d'écran Réception (slides 10-11), Raccrochage (14-17), Validation ADMIN (18) ; slides 19-20 (cas particuliers #1 et #2, captures) ; slide 21 (pointage manquants, codes couleur) ; slide 22 (copie d'écran Circé du manquant) ; slide 25 « Dashboard pour une semaine donnée » (illustration du dashboard : maquette/mock non lisible).
- A15 : 14 images non extraites : diagrammes 4.1, 4.2, 4.3 et 8 m² (numérotation 1 à 10 des étapes), illustrations des demandes 8 m² n°2, 3, 4 (slides 12-14), illustrations du besoin expédition n°1 (slides 16-17 : emplacement du bouton) ; besoins Expédition #4 et #5 : lignes vides dans l'extraction (contenu perdu).
- S : colonne « # » vide ; pas de colonne priorité ; lignes 98-100 vides ; L101 sans catégorie ; texte des cellules concaténé (certaines cellules fusionnées/retours à la ligne). Aucun besoin n'est priorisé ni daté.
- Besoins formulés en question (non tranchés) : TRA-004, TRA-006, ADM-001, REC-012, EXP-006, FIX-006 (« Réception ? »), FIX-008 (menu « ? »).
- Éléments « à creuser » sans spec : SCR-003, SCR-005, FIX-004, FIX-007, SCR-001/002/004.
- Références non résolues : dev APPFR-1143 ; cas « Quick V2 » ; CG, CP ; « Vendôme One / cairenimes » ; PP-1 ; demande à Géraldine sur étiquettes de palette ; « base REF ».
- Parole de décision : aucune ligne de la synthèse n'est marquée « validée » ; seule la catégorie « Refusé » (L93) et « Besoin Refusé » (A14) indiquent un refus.
- Les ateliers contiennent un diagramme de « process cible » (A14 slide 34) dont seule la liste des libellés est extraite ; la décision d'ordonnancement des tâches (raccrochage proposé automatiquement -> validation humaine -> Instruction OK auto -> …) est reconstituée par EX-REC-024/COO-006/COO-008.
