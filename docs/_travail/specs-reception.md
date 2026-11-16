# Specs RÉCEPTION (cible) — extraction des exigences

Périmètre lu intégralement :
- `1. RECEPTION/20261027 - Réception des affiches, le dossier complet.html` (849 lignes, 18 sections + encadré de mise à jour du 02/11), noté **[DC]**.
- `1. RECEPTION/process_reception_statuts_actions.html` (schéma du 21/10, 2 pages), noté **[PR]**.
- Compléments : `maquette/README.md` **[README]**, `maquette/DESIGN.md` **[DESIGN]**.

Les passages barrés de [DC] (validation admin automatique du 27/10) sont remplacés par l'option A du 02/11 : seule la version 02/11 est retenue ici (voir EX-COO). Les écrans et données de la maquette sont fictifs. La lecture du BL et la reconnaissance visuelle sont **simulées** dans la maquette.

---

## A. Process et étape 1 : arrivée de la palette

### EX-REC-001 — Réception en deux temps sur une seule page
- Énoncé : la réception se fait en deux temps sur la page « Réception › Réception des affiches » : étape 1 (arrivée de la palette, au quai, par l'agent de réception) puis étape 2 (contrôle dans le sas, par le contrôleur). Pas de douchette, pas d'étiquette de palette.
- Type : fonctionnalité
- Source : [DC] §1, §4, §5 ; [PR] p.1 ; [README] §3 (REC-25)
- Ambiguïté : aucune

### EX-REC-002 — Trois façons de trouver les dossiers du BL
- Énoncé : bandeau « Trouver les dossiers du BL » avec trois cadres côte à côte au même format : « Photographier le BL », « Photographier une affiche » (Circé reconnaît le visuel et propose les dossiers les plus proches), champ « n° de dossier, de DA, annonceur… » qui filtre les réceptions attendues. À la ligne : « Rien ne correspond ? » et bouton « Réception inconnue… ».
- Type : fonctionnalité
- Source : [DC] §4 ; [PR] p.1 étape 1 ; [DESIGN] §4.8
- Ambiguïté : aucune

### EX-REC-003 — Photo du BL obligatoire
- Énoncé : la photo du BL est obligatoire dans tous les cas, même si les lignes sont trouvées par la recherche (« Joindre le BL »). Seule exception : palette arrivée sans BL (réception inconnue). Tant que la photo manque, un encadré « BL à photographier » porte le bouton et la validation est refusée. La photo se revoit au contrôle (« Voir le BL ») ; la fiche de réception porte « Photo du BL jointe ».
- Type: règle
- Source : [DC] §1, §4, §10 ; [DESIGN] §4.8
- Ambiguïté : aucune

### EX-REC-004 — Lecture du BL et pré-remplissage
- Énoncé : Circé lit sur la photo : n° de contrat, annonceur, semaine, format, quantité, vignette du visuel ; il propose les réceptions attendues et pré-remplit le bon de livraison (n° de BL, imprimeur, transporteur, colis). Lignes lues cochées, autres lignes du panier décochées. L'agent vérifie. Circé retient comment le dossier a été trouvé (n° du BL ou visuel) pour la proposition de validation admin.
- Type : traitement auto
- Source : [DC] §4 ; [DESIGN] §4.8
- Ambiguïté : la technologie de lecture (OCR/vision) n'est pas spécifiée ; simulée dans la maquette. Le seuil de « lecture sûre » n'est pas défini.

### EX-REC-005 — Contrat illisible : candidats
- Énoncé : si le contrat est illisible, Circé propose des candidats (même annonceur, même semaine, même format, vignette ressemblante). « Aucun : réception inconnue » ouvre le formulaire de réception inconnue.
- Type : fonctionnalité
- Source : [DC] §4
- Ambiguïté : algorithme de classement des candidats et nombre maximum de candidats non spécifiés.

### EX-REC-006 — Ligne cochée absente du BL
- Énoncé : pour des lignes trouvées par la recherche, une ligne cochée absente du BL (photo) est signalée.
- Type : validation
- Source : [DC] §4, §17 (scénario 3)
- Ambiguïté : signalement bloquant ou non non précisé.

### EX-REC-007 — Recherche par n° de dossier à la frappe
- Énoncé : la recherche se lance à la frappe (et non à la touche Entrée). Elle accepte n° de dossier, de DA, annonceur ; plusieurs valeurs possibles ; liste collée possible ; les n° inconnus sont signalés.
- Type : fonctionnalité
- Source : [DC] §7, §14, §16 (REC-10) ; [README] §2.3 ; [DESIGN] §4.3
- Ambiguïté : [DESIGN]/[README] décrivent « saisie puis Entrée » pour le champ « N° de dossier » des filtres, alors que REC-10 impose la frappe pour le raccrochage. Voir Contradictions.

### EX-REC-008 — Tableau « Réceptions attendues »
- Énoncé : « Ce qu'on attend, issu de Broadcast dès la DA activée ». Colonnes visibles : Site, Dossier, Visuel, Départ, « Reçu / attendu » (avec n° d'affiche déjà reçue, cliquable), Reste, Statut, Contrôle, Livraison prévue. Masquées : DA, Annonceur, Thème, Format, Attendu, Reçu, N° d'affiche. Filtres en listes à cocher : Statut (« Attendue » et « Partielle » par défaut), Départ, Format ; Contrôle et Annonceur par « + Filtre ». Actions par ligne : « Au panier », « Feuille de stock » (réimpression d'une affiche déjà contrôlée). En masse : « Ajouter au panier (n) ». Export Excel.
- Type : affichage
- Source : [DC] §4 ; [README] §3
- Ambiguïté : le contenu de « Livraison prévue » (source de la date) n'est pas défini.

### EX-REC-009 — Lignes attendues masquées
- Énoncé : ne sont pas montrés les dossiers annulés et les thèmes exclus.
- Type : règle
- Source : [DC] §4 ; [README] §3 (exclusions « ne pas afficher » et « reste en place » reprises de Broadcast)
- Ambiguïté : « thèmes exclus » = « ne pas afficher » de Broadcast, non défini précisément.

### EX-REC-010 — Panier (lignes du BL)
- Énoncé : une case par ligne, cochée d'office, case « tout ». Colonnes : Dossier, « Annonceur · thème », Reste attendu, Qté du BL (modifiable), Livraison en deux fois. Actions « Retirer », « Vider le panier ». Plus de colonne « Ordre » (REC-01 refusé). Le panier peut réunir plusieurs BL.
- Type : fonctionnalité
- Source : [DC] §4 ; [DESIGN] §4.8
- Ambiguïté : aucune

### EX-REC-011 — Un BL = une réception ; seules les lignes cochées entrent
- Énoncé : seules les lignes cochées entrent dans la réception, les autres restent au panier pour le BL suivant. Une palette avec deux BL donne deux réceptions. Le formulaire dit « Pour les n ligne(s) cochée(s) » et le bouton « Valider la réception (n lignes) ».
- Type : règle
- Source : [DC] §1, §4, §10 ; [DESIGN] §4.8
- Ambiguïté : aucune

### EX-REC-012 — Formulaire « Bon de livraison »
- Énoncé : champs : Lignes de ce BL, Date de livraison, N° de BL (BL imprimeur = BL transporteur), Transporteur, Imprimeur, Nombre de colis / palettes, « Déchargé par » (liste des agents de réception, plus de champ libre). Encadré « BL lu par Circé » (+ « Reprendre la photo ») ou « BL à photographier ».
- Type : affichage
- Source : [DC] §4, §14
- Ambiguïté : la modification de la date de livraison, la zone « commentaire » et les pièces jointes de la fenêtre actuelle ([relevé] §16) ne sont pas confirmées dans la cible (relevé : « champs que la maquette n'a pas encore »).

### EX-REC-013 — Refus à la validation de la réception (ordre)
- Énoncé : « Valider la réception » refuse, dans cet ordre : (1) « Le panier est vide. » (2) « Cochez dans le panier les lignes de ce BL. » (3) « Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. » (4) « Photographiez le BL avant de valider… » (5) « N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. »
- Type : validation
- Source : [DC] §4
- Ambiguïté : texte (4) tronqué (« … »).

### EX-REC-014 — Effets de « Valider la réception »
- Énoncé : crée la réception au statut « À contrôler » et, pour chaque ligne cochée, une affiche (n° d'affiche créé) avec la quantité du BL, rangée en zone tampon, avec un mouvement « Réception » (« Réception (complément) » pour un complément). Pose « affiche reçue » = oui. Fait passer « prêt à produire » les unités en attente de ces affiches. Propose la validation admin (voir EX-COO). La palette passe à l'étape 2 sans étiquette. N° de BL, imprimeur, nombre de colis se vident ; transporteur et « Déchargé par » restent.
- Type : traitement auto
- Source : [DC] §4, §15
- Ambiguïté : Q31 (affiche reçue à l'arrivée ou après le contrôle) est ouverte ; la maquette la pose à l'arrivée. Voir EX-REC-052.

### EX-REC-015 — Un BL = une plateforme
- Énoncé : un BL ne livre qu'une plateforme ; refus sinon. Un dossier livré sur les deux plateformes : la part de la 2e plateforme garde le n° de dossier et la DA avec le suffixe « -W ». Une affiche et sa réception attendue sont toujours sur la même plateforme.
- Type : règle
- Source : [DC] §2, §10
- Ambiguïté : formalisation du suffixe « -W » (qui le pose, sur quel champ, pour quelle plateforme) non précisée.

### EX-REC-016 — Complément d'affiche (livraison en deux fois, REC-22)
- Énoncé : le visuel déjà reçu en partie garde son n° d'affiche (case « Complément de l'affiche N ») ; les deux réceptions sont gardées pour la traçabilité ; tag « Complément » dès deux réceptions.
- Type : règle
- Source : [DC] §4, §10, §16 ; [PR] tags
- Ambiguïté : aucune

### EX-REC-017 — Réception sans IP : intitulé (REC-18)
- Énoncé : si les IP ne sont pas saisies, champ « Intitulé saisi (sans IP) » pré-rempli avec l'intitulé de l'autre plateforme ; « le 1er qui a parlé a raison ». Ce n'est pas une réception inconnue : on reçoit sur le dossier. Alerte « Réception sans instructions de pose » à la Coordination, qui prévient la Pré-Prod.
- Type : règle
- Source : [DC] §4, §7, §10, §11
- Ambiguïté : nom de l'alerte différent selon les documents (« Réception sans IP », « Réception sans instructions de pose », « Réception sur un dossier sans IP »).

---

## B. Étape 2 : contrôle dans le sas

### EX-REC-018 — Liste « Palettes à contrôler (sas) »
- Énoncé : la plus ancienne en tête avec son temps d'attente. Colonnes : En attente depuis, Réception (tag « réception inconnue »), Arrivée, Site, BL, Imprimeur, Affiches, Qté du BL, Déchargé par ; bouton « Contrôler ». Recherche par n° de BL ou imprimeur. Le badge du menu compte les palettes à contrôler.
- Type : affichage
- Source : [DC] §5
- Ambiguïté : aucune

### EX-REC-019 — Palette en retard dans le sas
- Énoncé : au-delà du délai (24 h par défaut, paramétrable) : encadré « N palette(s) dans le sas depuis plus de 24 h », compteur « en retard », alerte « Palette à contrôler en retard » ; ligne rouge au double du délai ; gravité « grave » au double du délai.
- Type : traitement auto
- Source : [DC] §5, §11 ; [PR] p.1
- Ambiguïté : Q33 (délai) ouverte ; le comptage est-il en heures calendaires ou ouvrées ? non précisé.

### EX-REC-020 — Contrôle de la palette (un seul écran)
- Énoncé : toute la palette dans un écran (REC-27), une ligne par affiche : N° affiche (tag « complément »), Visuel, Qté du BL (« Qté saisie » pour une réception inconnue), Qté comptée, Allée, Rayon, rebut, non-conformité, surplus, Contrôleur.
- Type : fonctionnalité
- Source : [DC] §5
- Ambiguïté : aucune

### EX-REC-021 — Quantité comptée et écart
- Énoncé : « Qté comptée » = quantité du BL par défaut ; écart affiché « ±N par rapport au BL » ; ligne rouge au-delà de 10 % ; mouvement « Contrôle (écart au BL) » créé s'il y a écart.
- Type : règle
- Source : [DC] §5, §10
- Ambiguïté : seuil de 10 % : base de calcul (qté du BL) non explicitée ; blocage éventuel au-delà non précisé (signalement seulement).

### EX-REC-022 — Comptage par morceau
- Énoncé : « Comptage par morceau » sous un seuil de 30 (paramétrable) ; au 8 m², « 4 morceaux par affiche ».
- Type : règle
- Source : [DC] §5, §11, §17 (Q30)
- Ambiguïté : Q30 ouverte (même seuil pour tous les formats ?). Mécanique de saisie par morceau non décrite.

### EX-REC-023 — Allée et rayon obligatoires
- Énoncé : Allée et Rayon obligatoires pour chaque affiche ; refus « Allée et rayon sont obligatoires pour chaque affiche. » Les affiches quittent la zone tampon pour leur emplacement définitif.
- Type : validation
- Source : [DC] §5
- Ambiguïté : aucune

### EX-REC-024 — Rebut et non-conformité
- Énoncé : rebut (quantité) avec motif ; non-conformité parmi : Conforme, Visuel non conforme, Quantité, Affiche abîmée, Bandeau manquant, Autre. Mouvement « Mise au rebut » (quantité négative) pour le rebut ; la non-conformité va dans l'historique. Rebut possible plus tard dans Stocks (affiche déchirée, mauvais visuel, erreur de quantité, autre).
- Type : règle
- Source : [DC] §5, §10
- Ambiguïté : le motif de rebut au contrôle est-il la liste des non-conformités ou la liste Stocks ? Non précisé.

### EX-REC-025 — Surplus en entretien (« CG »)
- Énoncé : case « +N en entretien » pour le surplus des « CG » (FIX-09) ; le surplus est noté en entretien.
- Type : règle
- Source : [DC] §5, §10 ; §13 (« sans place aujourd'hui »)
- Ambiguïté : aucune table n'existe aujourd'hui pour porter ce champ ; mécanisme de comptage du « CG » non défini (« CG » non défini dans les documents lus).

### EX-REC-026 — Contrôleur obligatoire
- Énoncé : le contrôleur (un agent de réception) est obligatoire, choisi dans la liste des agents de réception (REC-12) ; refus « Le nom du contrôleur est obligatoire (REC-12). »
- Type : validation
- Source : [DC] §2, §5, §16 ; [DESIGN] §11
- Ambiguïté : aucune

### EX-REC-027 — Effets de « Valider le contrôle et imprimer »
- Énoncé : crée les mouvements ; enregistre le contrôleur ; palette → « Contrôlée » ; imprime en lot les feuilles définitives avec étiquettes rack ; ensuite « Imprimer la feuille définitive » ou « Réimprimer les feuilles de stock ». Pour une réception inconnue rattachée : corriger quantité et imprimeur, ranger hors zone tampon, puis « Valider le contrôle et imprimer la feuille définitive ». La feuille définitive remplace la temporaire.
- Type : transition
- Source : [DC] §5, §6 ; [PR] étape 2, p.2 (13-15)
- Ambiguïté : le contrôle est-il par BL ou par palette (grain) : question ouverte « Grain des données ».

### EX-REC-028 — Non-conformité : lien Process Métier
- Énoncé : la non-conformité s'ouvre par un lien vers l'application Process Métier ; le lien reste à cadrer ; le suivi des non-conformités dans Circé n'est pas fait (QUA-03, non couvert).
- Type : fonctionnalité
- Source : [DC] §5, §16
- Ambiguïté : incomplète — hors maquette ; module tiers (Process Métier).

---

## C. Feuille de stock et étiquette rack

### EX-REC-029 — Feuille de stock : modèle et mention
- Énoncé : la feuille de stock = l'étiquette rack de Circé (`Reports/EtiquetteRackAffiche.rdlc`, A4), même modèle, avec la mention « définitive » ou « temporaire » dans le bandeau du haut. Définitive : au contrôle d'une palette de dossier connu ou d'une inconnue rattachée ; temporaire : à la création d'une réception inconnue, porte allée et rayon de la zone tampon.
- Type : règle
- Source : [DC] §6 ; [README] §3
- Ambiguïté : place exacte de la mention et lieu de conservation du type de feuille en V2 « à valider » ([DC] §6).

### EX-REC-030 — Fond jaune des dossiers multi-semaines
- Énoncé : feuille définitive à fond jaune imprimé si dossier multi-semaines (REC-13).
- Type : règle
- Source : [DC] §6, §10
- Ambiguïté : Q18 (REC-13 remplacé ou non par le scan de BL multiples) ouverte ; définition de « multi-semaines » non précisée.

### EX-REC-031 — Champs de la feuille
- Énoncé : n° d'affiche en très gros, format, date de réception, adressage (allée - rayon), quantité, code-barres, dossier, semaines, annonceur, thème, repiquage, commentaire, « affiche à conserver », 1er départ en gros ; tableau Dossier, Thème, Annonceur, Format, Départ, Qté prépa., numéro de demande. Étiquette rack au format « A- » + 13 chiffres (relevé).
- Type : affichage
- Source : [DC] §6 ; relevé §7
- Ambiguïté : aucune

### EX-REC-032 — Impression en lot, exemplaires
- Énoncé : impression en lot, 2 exemplaires par défaut (palette et Coordination), paramétrable de 1 à 5 ; avec ou sans étiquettes rack.
- Type : règle
- Source : [DC] §6, §11, §17 (Q32) ; [PR] p.1 (« palette et Pré-Prod »)
- Ambiguïté : Q32 (2 ou 3 ; destinataire du 3e). [PR] dit « Pré-Prod » au lieu de « Coordination ».

### EX-REC-033 — Type de feuille noté, tag levé
- Énoncé : Circé note le type de feuille posée (temporaire ou définitive). L'impression lève le tag « Feuille à refaire ».
- Type : traitement auto
- Source : [DC] §6, §9
- Ambiguïté : stockage du type de feuille « sans place dans la base » (à décider).

### EX-REC-034 — Réimpressions
- Énoncé : réimpression depuis : Liste des affiches (« Réimprimer les feuilles à refaire (n) », « Imprimer les feuilles de stock », « Étiquettes rack ») ; ligne d'une réception attendue « Contrôlée » (« Feuille de stock ») ; fiche de l'affiche.
- Type : fonctionnalité
- Source : [DC] §6, §8 ; [PR] p.2 (18)
- Ambiguïté : aucune

---

## D. Réception inconnue

### EX-REC-035 — Création d'une réception inconnue
- Énoncé : bouton « Réception inconnue… » (ex « orpheline »). Champs : Site, Format, Annonceur lu sur l'affiche, Thème ou description (avec propositions de l'autre plateforme), Imprimeur, Quantité comptée, Allée (zone tampon, X par défaut), Rayon (obligatoire), Photo de l'affiche, Photo du BL. Bouton « Créer, ranger et imprimer la feuille temporaire ». Refus : « Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire. » ; « Indiquez la quantité comptée. »
- Type : fonctionnalité
- Source : [DC] §7 ; [PR] p.1
- Ambiguïté : allée X « à fixer par site » (question ouverte).

### EX-REC-036 — Effets de la création
- Énoncé : réception « À identifier », hors du sas ; affiche « Orpheline » ; feuille temporaire ; alerte immédiate « Réception inconnue à identifier » à la Coordination (et Réception) ; pas de mail.
- Type : traitement auto
- Source : [DC] §7, §11
- Ambiguïté : destinataire : [PR] dit Pré-Prod ; voir Contradictions.

### EX-REC-037 — Tableau « Réceptions inconnues » (Coordination)
- Énoncé : menu Réception, badge rouge s'il y en a. Colonnes : N° affiche, Lu sur l'affiche, Site, Qté, Reçue le, En attente depuis (rouge > 24 h), Statut, Dossier(s), Emplacement ; bouton « Fiche ». Sous le tableau : photo, annonceur lu, description, quantité, format, imprimeur, emplacement. Un seul tableau avec un statut par ligne (Q35 réglée).
- Type : affichage
- Source : [DC] §7, §17 ; [README] §3
- Ambiguïté : aucune

### EX-REC-038 — Identifier : d'abord par le visuel, sinon par n° de dossier
- Énoncé : « Voir les visuels proposés (n) » ; dossier pré-coché si le visuel est reconnu à coup sûr ; sinon recherche par n° de dossier (à la frappe). Si pas de visuel (photo absente, IP non saisies, aucun visuel proche), la voie « n° de dossier » est proposée d'office.
- Type : fonctionnalité
- Source : [DC] §7 ; [README] §3
- Ambiguïté : reconnaissance visuelle simulée (REC-17 après le 31/12) ; critère « à coup sûr » non défini.

### EX-REC-039 — Rattacher
- Énoncé : cocher un ou plusieurs dossiers avec leur quantité puis « Rattacher ». Refus : « Choisissez au moins un dossier et une quantité. » ; « La répartition (x) dépasse la quantité reçue (y). »
- Type : validation
- Source : [DC] §7
- Ambiguïté : la répartition inférieure à la quantité reçue est-elle permise (surplus restant en stock) ? Non dit pour ce cas ; le doc coordination dit « le surplus reste en stock ».

### EX-REC-040 — Effets de « Rattacher »
- Énoncé : l'affiche passe « Identifiée » ; la réception passe « À contrôler » et entre dans le sas ; rattachement par la Coordination = validation admin ; alerte « Feuille de stock définitive à imprimer » à la réception de la plateforme tant que la feuille n'est pas imprimée ; boutons selon l'état : « Valider et imprimer dans Réception des affiches », « Imprimer dans Réception des affiches », « Réimprimer la feuille définitive ». Rattachée par la réception : reste à vérifier.
- Type : transition
- Source : [DC] §7 ; [PR] p.1
- Ambiguïté : l'agent de réception peut-il rattacher ? [DC] §7 sous-entend oui (« rattachée par la réception »), [README] §3 dit que Réceptions inconnues est utilisé par « Coordination, réception ».

### EX-REC-041 — Signaler « Dossier introuvable »
- Énoncé : bouton « Signaler à la Coordination (alerte) », sans mail ; alerte « Dossier introuvable », gravité grave dès le signalement, à la Coordination du site (Wissous : équipe Coord. Réception de Boulogne). Statut de l'affiche « Introuvable : alerte à la Coordination ».
- Type : transition
- Source : [DC] §3, §7, §11 ; [PR] p.1 (version Pré-Prod)
- Ambiguïté : Q36 (périmètre de « introuvable »), Q37 (qui rattache après correction Broadcast), Q61 (destinataire Nîmes).

### EX-REC-042 — Deux cas à ne pas confondre
- Énoncé : (a) DA activée, IP non saisies : ce n'est pas une réception inconnue (alerte « Réception sans IP » à la Coordination, qui prévient la Pré-Prod). (b) Affiche introuvable alors que le dossier est dans Broadcast : c'est une réception inconnue, reconnue par la photo.
- Type : règle
- Source : [DC] §7, §10
- Ambiguïté : aucune

### EX-REC-043 — Retrait du dernier dossier
- Énoncé : retirer le dernier dossier renvoie l'affiche dans les réceptions inconnues ; la réception redevient « À identifier » (palette). Affiche sans lien actif = orpheline.
- Type : transition
- Source : [DC] §8, §9, §10
- Ambiguïté : état de la palette si elle était déjà « Contrôlée » : « À identifier » ou « À contrôler » ? [DC] §9 dit « le redevient » (À contrôler) alors que §10 dit « redevient À identifier ». Voir Contradictions.

### EX-REC-044 — Affiche livrée après purge de sa ligne attendue
- Énoncé : passe par « Réception inconnue… ».
- Type : règle
- Source : [DC] §10
- Ambiguïté : aucune

---

## E. Liste des affiches et fiche

### EX-REC-045 — Liste des affiches
- Énoncé : colonnes : N° affiche, Reçue le, Visuel, Dossier(s) (tag « N dossiers »), Départ (tag « multi-semaines »), En stock (rebut mis en évidence, REC-08), Emplacement, Statut et tags. Masquées : Réception (cliquable), Site, Annonceur, Thème, Format, Imprimeur (REC-07), Reçu, Rebut, Contrôleur, Feuille de stock. Filtres : n° de dossier, Départ (une affiche sans semaine reste visible), Tag, Format ; Imprimeur par « + Filtre ». En masse : « Réimprimer les feuilles à refaire (n) », « Imprimer les feuilles de stock », « Étiquettes rack », « Ranger avant d'imprimer ».
- Type : affichage
- Source : [DC] §8
- Ambiguïté : aucune

### EX-REC-046 — Deux listes reliées
- Énoncé : on garde deux listes (réceptions attendues et Liste des affiches), reliées par le n° d'affiche, au lieu d'un écran fusionné (REC-03, revu le 21/10).
- Type : règle
- Source : [DC] §8 ; [README] §6 (H18)
- Ambiguïté : le libellé REC-03 du référentiel dit « Fusionner Réception et Liste des affiches » alors que la décision est de ne pas fusionner.

### EX-REC-047 — Fiche de l'affiche
- Énoncé : onglets Détail, Mouvements, Préparations, Historique. Détail : réception(s), annonceur/thème saisis, imprimeur, allée, rayon, quantité reçue, stock disponible, feuille de stock, entretien reçu en plus, « affiche à conserver », encadré « Palette à contrôler » avec « Contrôler la palette », validation admin avec « Validation admin » et « Annuler la validation ». Mouvements et Historique : tout ce qui s'est passé, avec qui et quand. Ouverte en panneau latéral (pas de modales imbriquées).
- Type : affichage
- Source : [DC] §8 ; [DESIGN] §4.8, §4.9
- Ambiguïté : aucune

### EX-REC-048 — Onglet Préparations : changer de thème, rattacher, retirer
- Énoncé : « Changer de thème… » (parmi les thèmes du même dossier), « Retirer », « + Rattacher à un autre dossier » sans limite de dossiers (ANO-12). Chaque changement pose « Feuille à refaire ». Rattachement à plusieurs dossiers avec une quantité chacune (plusieurs-à-plusieurs).
- Type : fonctionnalité
- Source : [DC] §8, §10
- Ambiguïté : aucune

### EX-REC-049 — Fiche de la réception
- Énoncé : montre l'état (« Palette à contrôler », « À identifier par la Coordination (zone tampon) », « Contrôlée »), date, BL, transporteur, imprimeur, colis, « Déchargé par », « Contrôlé par », lignes avec quantité du BL et quantité reçue.
- Type : affichage
- Source : [DC] §8
- Ambiguïté : aucune

---

## F. Statuts, tags, mouvements

### EX-REC-050 — Principe : ce qui se calcule ne se coche jamais
- Énoncé : Circé pose chaque statut et chaque tag lui-même à chaque événement ; aucun tag coché à la main.
- Type : règle
- Source : [DC] §9
- Ambiguïté : le classement calculé / enregistré de chaque statut est dans `statuts_et_tags_calcul_ou_base.html` (non fourni dans ce périmètre).

### EX-REC-051 — Statuts de la ligne attendue
- Énoncé : Attendue (rien reçu) → Partielle (reçu moins qu'attendu) → Complète (tout reçu) / Surplus (plus de 10 % en trop). Colonne Contrôle : À contrôler, Contrôlée, Rien reçu. Calculé une fois et lu par tous les écrans.
- Type : transition
- Source : [DC] §9 ; [PR] p.1
- Ambiguïté : « Complète » exact vs. entre 100 % et 110 % ; « Surplus » = strictement > 10 %.

### EX-REC-052 — « Affiche reçue »
- Énoncé : « Oui » dès l'arrivée de la palette, sur la quantité du BL, posé par la réception (PP-02) indépendamment de la validation admin ; le contrôle corrige ensuite (Q31). En V2 : « un mouvement de réception existe ».
- Type : règle
- Source : [DC] §9, §17 ; [README] §6 (H14)
- Ambiguïté : Q31 ouverte (« à l'arrivée ou après le contrôle ? »), marquée question clé.

### EX-REC-053 — Statuts de la palette (réception)
- Énoncé : À contrôler (posé à « Valider la réception ») → Contrôlée (à « Valider le contrôle »). À identifier (réception inconnue, hors du sas) → À contrôler au rattachement ; revient à À identifier si le dernier dossier est retiré. Indicateurs calculés : « Contrôle en retard » (24 h), « Écart de comptage » (10 %), « Complément », « Photo du BL jointe ».
- Type : transition
- Source : [DC] §9 ; [PR] p.1 ; [README] §5
- Ambiguïté : voir EX-REC-043.

### EX-REC-054 — Statuts et tags de l'affiche
- Énoncé : statut Identifiée / Orpheline. Tags : À contrôler (de la réception jusqu'au contrôle), Réception inconnue, Complément (dès deux réceptions), Feuille à refaire (thème ou rattachement changé ; levé par la réimpression ; affiché « Feuille définitive à imprimer » tant qu'une temporaire est posée). Proposé : tag « Au rebut ».
- Type : transition
- Source : [DC] §9 ; [PR] p.1 (tags « À contrôler », « Orpheline », « Complément », « Feuille à refaire »)
- Ambiguïté : « Orpheline » est statut dans [DC] et tag dans [PR] ; le tag « Au rebut » est « proposé » (non décidé).

### EX-REC-055 — Statuts d'une réception inconnue (affiche)
- Énoncé : À identifier (feuille temporaire, zone tampon) → Introuvable : alerte à la Coordination (après « Signaler ») → Rattachée, à contrôler (palette dans le sas) → Contrôlée, feuille définitive à imprimer → Rattachée, feuille définitive (terminé).
- Type : transition
- Source : [DC] §9 ; [PR] p.1
- Ambiguïté : transition Introuvable → Rattachée à confirmer ; retour d'un statut « Rattachée » vers « À identifier » par retrait non détaillé pour la chaîne d'affiche.

### EX-REC-056 — Emplacement et feuille
- Énoncé : zone tampon → emplacement définitif ; allée X pour une réception inconnue ; feuille Temporaire → Définitive dès qu'il y a un dossier. L'emplacement définitif est saisi au contrôle.
- Type : transition
- Source : [DC] §9
- Ambiguïté : aucune

### EX-REC-057 — Mouvements et stock
- Énoncé : types : Réception, Réception (complément), Contrôle (écart au BL), Mise au rebut. Le stock est la somme des mouvements. Le reçu d'un visuel = somme des quantités rattachées (actives), pas des mouvements (21/10). V2 : `tr_type_mouvement` (réception, écart de contrôle, production, rebut, sortie et ajout manuels, expédition, fusion, renvoi, destruction) ; réception et écart de contrôle comptent dans le reçu.
- Type : règle
- Source : [DC] §9, §13
- Ambiguïté : usage de la colonne `comptee` « à vérifier » ; reprise des rattachements existants (sans quantité) non tranchée.

---

## G. Cas particuliers

### EX-REC-058 — Une affiche pour plusieurs dossiers
- Énoncé : un visuel peut servir plusieurs dossiers (jusqu'à 33 cité) ; rattachement à plusieurs dossiers avec une quantité chacun, sans limite ; en V2 lien plusieurs-à-plusieurs avec quantité.
- Type : règle
- Source : [DC] §10, §13
- Ambiguïté : aucune

### EX-REC-059 — Réception partielle
- Énoncé : on valide ce qui est reçu ; la ligne passe « Partielle » et le reste à recevoir garde son alerte (« Visuel reçu en partie ») ; la quantité n'est pas une condition de la validation admin.
- Type : règle
- Source : [DC] §10
- Ambiguïté : aucune

### EX-REC-060 — Trop reçu
- Énoncé : « Surplus » au-delà de 10 % ; alerte « Écart de réception supérieur à 10 % » ; au contrôle, le surplus des « CG » se compte en entretien.
- Type : règle
- Source : [DC] §10, §11
- Ambiguïté : aucune

### EX-REC-061 — Rebut (sortie de stock)
- Énoncé : rebut = sortie de stock ; le vidage du rebut est à rapprocher de la destruction ; saisi au contrôle (mouvement « Mise au rebut ») ou plus tard dans Stocks.
- Type : règle
- Source : [DC] §10
- Ambiguïté : le lien précis avec la destruction (Fin de campagne) n'est pas décrit ici.

### EX-REC-062 — Thème changé après réception / mauvais thème
- Énoncé : « Changer de thème… » dans la fiche, tag « Feuille à refaire » et alerte « Feuilles de stock à refaire » ; réimpression en lot (REC-06). Purge des anciens thèmes des réceptions attendues après changement de thème (REC-23, « en partie »).
- Type : règle
- Source : [DC] §10, §16
- Ambiguïté : REC-23 couvert en partie : reste à définir.

---

## H. Alertes de réception

Canal et gravité réglés dans Administration › Paramétrage › Alertes et mails. Chaque alerte ouvre l'écran où agir (Pilotage › Alertes). Voir EX-TRA.

### EX-REC-063 — Alerte « Visuel non reçu / reçu en partie »
- Énoncé : départ en S : critique si rien reçu, grave si partiel ; S+1 : à surveiller. Destinataires : chefs d'équipe, Coordination, Réception ; bandeau et résumé à 7 h.
- Type : traitement auto
- Source : [DC] §11
- Ambiguïté : forme du « résumé à 7 h » (mail ? écran ?) non définie.

### EX-REC-064 — Alerte « Écart de réception supérieur à 10 % »
- Énoncé : à surveiller ; destinataires Réception et Coordination.
- Type : traitement auto
- Source : [DC] §11
- Ambiguïté : aucune

### EX-REC-065 — Alerte « Réception sans instructions de pose »
- Énoncé : grave ; destinataire Coordination (qui prévient la Pré-Prod) ; bandeau et mail.
- Type : traitement auto
- Source : [DC] §11
- Ambiguïté : « et mail » alors que le principe est « pas de mail » ; canal paramétrable.

### EX-REC-066 — Alerte « Réception inconnue à identifier »
- Énoncé : dès la création ; importante après 24 h ; Coordination et Réception.
- Type : traitement auto
- Source : [DC] §11 ; [PR] p.1
- Ambiguïté : [PR] : Pré-Prod et Réception.

### EX-REC-067 — Alerte « Dossier introuvable »
- Énoncé : grave dès le signalement ; Coordination du site (Q61) ; plus de mail.
- Type : traitement auto
- Source : [DC] §11
- Ambiguïté : Q61.

### EX-REC-068 — Alerte « Feuille de stock définitive à imprimer »
- Énoncé : après rattachement d'une réception inconnue, tant que la feuille n'est pas imprimée ; destinataire : Réception de la plateforme.
- Type : traitement auto
- Source : [DC] §11 ; [PR] p.1
- Ambiguïté : aucune

### EX-REC-069 — Alerte « Feuilles de stock à refaire »
- Énoncé : thème ou rattachement changé ; à surveiller ; Réception et Coordination.
- Type : traitement auto
- Source : [DC] §11 ; [PR] p.1
- Ambiguïté : aucune

### EX-REC-070 — Alerte « Palette à contrôler depuis plus de 24 h »
- Énoncé : grave au double du délai ; Réception et chefs d'équipe.
- Type : traitement auto
- Source : [DC] §11
- Ambiguïté : [PR] cible uniquement la Réception.

### EX-REC-071 — Alerte « Validation admin à faire »
- Énoncé : grave pour un départ en S ou S+1 ; Coordination. (Voir EX-COO.)
- Type : traitement auto
- Source : [DC] §11
- Ambiguïté : libellé « à confirmer » dans le doc Coordination.

### EX-REC-072 — Mail au commercial désactivé
- Énoncé : le mail au commercial à la réception est désactivé (refusé le 14/10). Le mail « Réception affiche » aux chefs d'équipe est remplacé par le dashboard ; un résumé reste possible. La purge des attendues ne lève pas d'alerte.
- Type : règle
- Source : [DC] §1, §11 ; relevé §9
- Ambiguïté : aucune

---

## I. Paramètres et référentiels

### EX-REC-073 — Paramètres Règles métier › Réception
- Énoncé : écart signalé au-delà de 10 % ; purge automatique des réceptions attendues après 4 semaines (sauf conservation à l'année) ; délai de contrôle du sas 24 h (Q33) ; comptage par morceau si quantité < 30 (Q30) ; exemplaires de feuille 2 (1 à 5) (Q32) ; allée des réceptions inconnues X (à fixer par site).
- Type : fonctionnalité
- Source : [DC] §11
- Ambiguïté : Circé n'a pas de table de paramètres ; modèle de stockage à décider ; portée (par site ?) non précisée sauf pour l'allée.

### EX-REC-074 — Référentiels (REC-14)
- Énoncé : référentiels Imprimeurs, Livreurs (transporteurs), Agents de réception (utilisés dans « Contrôleur » et « Déchargé par »), dans Administration, lot 0. Un transporteur ou imprimeur inconnu n'est aujourd'hui jamais créé.
- Type : fonctionnalité
- Source : [DC] §11, §15 ; [README] §3
- Ambiguïté : création à la volée d'un transporteur/imprimeur inconnu dans la cible non tranchée.

### EX-REC-075 — Purge automatique des réceptions attendues
- Énoncé : automatique au-delà de 4 semaines, sauf conservation à l'année ; sans alerte ni validation ; une ligne au journal. Les lignes « venues de Broadcast » ne sont jamais purgées aujourd'hui.
- Type : traitement auto
- Source : [DC] §12, §11 ; [README] §6 (H17)
- Ambiguïté : « conservation à l'année » non défini (qui la positionne ?). Voir aussi EX-COO (RG-AT-06).

---

## J. Acteurs, sites, divers

### EX-REC-076 — Acteurs de la réception
- Énoncé : Agent de réception (quai, étape 1 ; crée les inconnues ; réimprime les feuilles) ; Contrôleur (un agent de réception, sas) ; Circé (automatique) ; Coordination (identifie, rattache, confirme la validation admin, traite « Dossier introuvable ») ; Pré-Prod (gestionnaires, dans Broadcast seulement, ne travaille pas dans Circé) ; Chefs d'équipe (alertes, consultation) ; Commerce (lecture seule).
- Type : permission
- Source : [DC] §2 ; [README] §2.2
- Ambiguïté : contrôleur = agent de réception (même rôle) mais [README] §3 parle d'un « agent de contrôle ».

### EX-REC-077 — Différences Nîmes / Wissous
- Énoncé : identification des inconnues : Coordination de Nîmes (« Pré-Prod Nîmes », Q61) vs équipe Coord. Réception de Boulogne à Wissous ; informations liées au n° d'affiche saisies par l'agent de réception (Nîmes) vs référent·es 8 m² et MUI (Wissous) ; allée tampon à fixer par site ; comptes : adresses génériques partagées à Nîmes (ADM-01), pas à Wissous.
- Type : règle
- Source : [DC] §2
- Ambiguïté : confirmation de Q61 ; « référent·es 8 m² et MUI » non défini en droits.

### EX-REC-078 — Refusés à ne pas refaire
- Énoncé : colonne « Ordre » du panier (REC-01) ; étiquette de palette et douchette (REC-26) ; mail au commercial et à l'assistante à la réception (REC-15) ; mail à la Pré-Prod pour une réception inconnue (remplacé par une alerte).
- Type : règle
- Source : [DC] §1, §16
- Ambiguïté : aucune

### EX-REC-079 — Menu Réception (cible)
- Énoncé : trois entrées : Réception des affiches (étapes 1 et 2), Liste des affiches, Réceptions inconnues (badge rouge). « Zone picking » et « Fusion des affiches » du menu actuel ne sont pas repris dans la cible ; la fusion est inopérante (ANO-15).
- Type : affichage
- Source : [README] §3, §7 ; relevé §16
- Ambiguïté : devenir de Zone picking et Fusion non spécifié explicitement.

### EX-REC-080 — Données V2 de la réception
- Énoncé : `livraison` + `controle_statut`, `controle_par` (obligatoire), `controle_le` ; `affiche` + `validationAdmin_par/_le`, `mode_rattachement` (n° du BL, visuel, à la main) ; `asso_affiche_visuel` (affiche ↔ dossier/visuel, quantité, origine auto/manuel, actif/retiré, par/quand) ; `tf_edr_rapprochement` ; `th_edr_evenement` (journal : réception, contrôle, rattachement, changement de thème, retrait, modification, impression/réimpression feuille, étiquette rack). Sans place aujourd'hui : type de feuille, non-conformité, surplus entretien, signalement « introuvable », paramètres.
- Type : non-fonctionnel
- Source : [DC] §13
- Ambiguïté : grain à trancher (quantité par dossier si un BL sert plusieurs dossiers ; imprimeur par réception ou par affiche ; contrôle par BL ou par palette). Le schéma de BDD réel est dans une autre source.

### EX-REC-081 — Anomalies de l'existant à corriger
- Énoncé : ANO-01 doublons dans la Liste des affiches ; ANO-05 « affiche reçue » posée par la validation admin ; ANO-08 mauvais thème ; ANO-12 nombre de dossiers limité ; ANO-15 fusion inopérante. Anomalies techniques à ne pas reprendre (relevé §16) : Ref DA effacée à chaque modification, colonnes décalées, corbeille inopérante, transporteur inconnu non créé, etc.
- Type : règle
- Source : [DC] §16 ; relevé §16
- Ambiguïté : aucune

### EX-REC-082 — Poste de travail réception
- Énoncé : réception/expédition : tablette ou PC d'atelier ; boutons ≥ 40 px ; (« avec douchette », « champ de scan toujours prêt »).
- Type : non-fonctionnel
- Source : [DESIGN] §8
- Ambiguïté : contredit « pas de douchette » à la réception (voir Contradictions).

---

## Statuts et transitions (résumé)

| Objet | Statuts | Transitions |
|---|---|---|
| Ligne attendue | Attendue → Partielle → Complète / Surplus (>10 %) ; contrôle : Rien reçu, À contrôler, Contrôlée | calculé à chaque événement |
| Palette | À identifier (inconnue) → À contrôler → Contrôlée | Valider la réception → À contrôler ; Rattacher → À contrôler ; Valider le contrôle → Contrôlée ; retrait dernier dossier → À identifier/À contrôler (ambigu) |
| Affiche | Identifiée / Orpheline ; tags À contrôler, Réception inconnue, Complément, Feuille à refaire, (Au rebut proposé) | rattachement, changement de thème, réimpression |
| Réception inconnue | À identifier → (Introuvable) → Rattachée, à contrôler → Contrôlée, feuille définitive à imprimer → Rattachée, feuille définitive | Signaler, Rattacher, Valider le contrôle, imprimer |
| Feuille | Temporaire → Définitive | au rattachement + contrôle |
| « Affiche reçue » | Non → Oui | à Valider la réception |

## Glossaire
- **BL** : bon de livraison. **DA** : n° de DA (dossier d'affichage, non défini dans les documents lus). **IP** : instructions de pose (« IP saisies » = thèmes saisis dans Broadcast). **Réception inconnue** : ex « orpheline », palette dont aucun dossier ne correspond. **Sas** : liste des palettes à contrôler (zone tampon). **Zone tampon** : allée X des réceptions inconnues / palettes non contrôlées. **Feuille de stock** : étiquette rack avec mention définitive/temporaire. **Réception attendue** : ligne issue de Broadcast. **Contrôleur** : agent de réception qui contrôle. **CG** : non défini (cas à surplus d'entretien). **Broadcast** : système tiers de la Pré-Prod. **Process Métier** : application tierce de non-conformités. **Complément** : seconde livraison d'un visuel déjà reçu en partie.

## Contradictions internes
1. [PR] fait identifier les réceptions inconnues par la **Pré-Prod** (alerte « Dossier introuvable » à la Pré-Prod, 2 exemplaires « palette et Pré-Prod ») ; [DC] (26/10) = **Coordination**. [DC] §18 le signale lui-même. [README] §3 (Réceptions inconnues) contient les deux versions (« alerte pour la Pré-Prod » puis « Coordination »).
2. [DC] §9 (palette « redevient À contrôler » si on retire le dernier dossier) vs §10 (« la réception redevient À identifier »).
3. [DESIGN] §8 (réception : douchette, champ de scan) vs [DC]/[README]/[DESIGN] §4.8 (pas de douchette ni d'étiquette de palette).
4. Recherche : REC-10 (à la frappe) vs [README]/[DESIGN] (champ dossier : saisie puis Entrée).
5. Destinataires de l'alerte « Palette en retard » : [PR] Réception ; [DC] Réception + chefs d'équipe.
6. Nom de l'alerte « sans IP » : trois libellés différents.
7. « Orpheline » : statut de l'affiche [DC] / tag [PR] / statut de validation [DC] encadré.
8. Libellé REC-03 « Fusionner Réception et Liste des affiches » vs décision de garder deux listes.
9. « Réception sans instructions de pose … bandeau et mail » vs principe « les alertes remplacent les mails ».
10. Exemplaires : « palette et Pré-Prod » [PR] / « palette et Coordination » [DC] / « sans doute la Coordination, Q61 » [README].
11. Document [DC] daté du 27/10 conserve des passages « validation admin par Circé » barrés ; [PR] (21/10) et le README conservent des mentions de l'ancienne règle selon l'historique.

## Sections non comprises ou incomplètes
- Reconnaissance visuelle (REC-17 hors périmètre avant 31/12), lecture du BL : comportement simulé uniquement.
- QUA-03 (non-conformités / Process Métier) : non couvert.
- Questions ouvertes non tranchées : Q30, Q31, Q32, Q33, Q36, Q37, Q61, Q18, allée par site, grain des données.
- Place de la mention « définitive/temporaire » ; stockage du type de feuille ; paramètres métier.
- Règles de rattachement automatique (hypothèse retenue le 02/11) : voir EX-COO.
- « CG », « conservation à l'année », « référent·es 8 m² et MUI » non définis.
- Fichiers cités mais hors périmètre : `statuts_et_tags_calcul_ou_base.html`, MCD/MLD, V2 base de données, `00_synthese_powerpoint.md`, `besoins.js` (autre agent).
