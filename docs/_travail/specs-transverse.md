# Specs TRANSVERSES (cible) — authentification, rôles, menus, impressions, PDF, alertes, notifications, historisation

Sources lues : `maquette/README.md` [README], `maquette/DESIGN.md` [DESIGN], `maquette/notes/releve-existant-code.md` [RELEVE], `docs-sources/00_sommaire.html` [SOM], plus les passages transverses de [DC] (dossier complet Réception), [PC]/[PP]/[RA] (Coordination).
Non traités : `screens/*.js`, `index.html`, `apercu-navigation-haut.html`, `veille_github_composants.md` (hors périmètre ou autre agent).
[SOM] référence des documents non fournis dans ce lot : fichiers `.xlsx`/`.pptx` (dictionnaires V1, EDR vivant, feuille de route, synthèse besoins, CIRCE_Maquette.pptx) : **non lisibles par cet agent** (format binaire) et hors périmètre.

---

## A. Authentification et profils / rôles

### EX-TRA-001 — Authentification et droits par rôle (lot 0)
- Énoncé : le lot 0 (socle) apporte « la connexion et les droits par rôle ». Aucune spec de la cible ne définit le mécanisme de connexion. L'existant utilise l'authentification Windows (AD), droits dans `tr_utilisateur_menu`, périmètre dans `tr_utilisateur_data`.
- Type : permission
- Source : [DC] §15 (lot 0) ; [RELEVE] §1, §2
- Ambiguïté : **mécanisme d'authentification de la cible non spécifié** (SSO/AD, comptes locaux ?). Voir Q à ouvrir.

### EX-TRA-002 — Aucune protection serveur dans l'existant
- Énoncé : l'existant n'a aucun attribut `[Authorize]` ; les droits ne font que masquer menus et boutons ; une URL appelée directement n'est pas protégée (déduit). À traiter en phase 4.
- Type : non-fonctionnel
- Source : [RELEVE] §2
- Ambiguïté : exigence cible implicite (permissions côté serveur) non écrite dans les specs ; elle découle du constat.

### EX-TRA-003 — Profils utilisateurs de la maquette
- Énoncé : sélecteur « Rôle » (bandeau 1) avec six rôles : Coordination, chef d'équipe, agent de réception, agent d'expédition, administrateur, commerce (lecture seule). Le rôle grise les pages secondaires. Autres acteurs cités : Pré-Prod (gestionnaires, Broadcast uniquement, pas utilisateurs Circé), contrôleur (= agent de réception), Circé (automatique).
- Type : permission
- Source : [README] §2.2, H10 ; [DC] §2 ; [DESIGN] §5
- Ambiguïté : le sélecteur de rôle est un outil de maquette ; en production le rôle viendra de l'authentification. Le mapping rôles ↔ droits existants (`CommunBll.Droits`, enum non listé) n'est pas spécifié. « Agent de contrôle » ([README] §3) vs contrôleur.

### EX-TRA-004 — Rôle Commerce en lecture seule
- Énoncé : le rôle Commerce consulte le suivi et les affiches reçues, sans les boutons d'action. Plus de mail à la réception d'un dossier.
- Type : permission
- Source : [README] H10 ; [DESIGN] §8 ; [DC] §2
- Ambiguïté : périmètre exact des écrans consultables non fourni (H10 à valider avec Commerce, AUT-05).

### EX-TRA-005 — Droits spécifiques identifiés
- Énoncé : « Valider » (validation admin) visible seulement pour la Coordination ; la case validation admin visible seulement avec le droit `validation_admin` (existant) ; l'agent de réception ne valide pas ; « Zone picking » (droit `Zone_Picking`) et « Fusion des affiches » (droit `fusion_affiche`) existants.
- Type : permission
- Source : [README] §3 ; [RELEVE] §13, §16
- Ambiguïté : devenir des droits existants dans la cible non spécifié.

### EX-TRA-006 — Site (périmètre)
- Énoncé : le site est choisi dans le bandeau 1 et vaut pour toute l'application ; tout le reste se filtre dans la page. Sites : Wissous, Nîmes ; le code connaît aussi DBG et DBG Lyon (absents des decks). Le périmètre de chaque utilisateur est dans `tr_utilisateur_data` (existant).
- Type : règle
- Source : [README] §2.3, §7 ; [RELEVE] §2, §4 ; [DESIGN] §4.3
- Ambiguïté : DBG/DBG Lyon : à trancher ; lien entre périmètre utilisateur et choix de site non précisé.

### EX-TRA-007 — Comptes par site
- Énoncé : Nîmes utilise des adresses génériques partagées (ADM-01) ; Wissous non.
- Type : règle
- Source : [DC] §2
- Ambiguïté : exigence cible (comptes nominatifs ?) non précisée ; or la validation et le contrôle exigent le nom d'une personne (traçabilité).

---

## B. Menus et navigation

### EX-TRA-008 — Deux bandeaux, pas de menu latéral
- Énoncé : bandeau 1 (bleu nuit, 56 px) : logo (retour à Pilotage › Suivi de prod), site, rôle ; à droite : alertes, mails (icône avec compteur), Aide. Bandeau 2 (blanc, 50 px) : 10 onglets. Pas de page d'accueil (la maquette s'ouvre sur Pilotage › Suivi de prod).
- Type : affichage
- Source : [README] §2.1-2.2 ; [DESIGN] §5
- Ambiguïté : « Simuler », « Besoins », « Parcours guidés » sont propres à la maquette (non à reprendre).

### EX-TRA-009 — Onglets
- Énoncé : Pilotage, Réception, Pré-production (ex « Dossiers », renommé le 25/10), Déroulant, 2 m² fixe, Pliage, Bus (cible), Expédition, Stocks, Administration. Onglet par type de production et par domaine partagé. L'onglet en cours est souligné ; son compteur = celui de sa première page en alerte. Chaque onglet liste ses pages, chacune avec compteur, et en retrait les vues/ateliers ; une seule liste ouverte à la fois (clic ailleurs, Échap ou changement d'écran la ferment) ; pages secondaires grisées selon le rôle. Entre 1 280 px et 1 480 px, les onglets se resserrent ; sous 992 px repli en menu (non fait dans la maquette).
- Type : affichage
- Source : [README] §2.1, §3 ; [DESIGN] §5, §8
- Ambiguïté : [DESIGN] §5 schéma ASCII affiche encore « Dossiers » ; nombre d'entrées de menu variable selon les passages de tests (67, 58, 63 vues).

### EX-TRA-010 — Pas d'onglets dans les pages
- Énoncé : une page n'a pas d'onglets internes ; les vues sont des entrées du menu ; un découpage par statut devient un filtre ; un document à imprimer devient un bouton d'en-tête. Seule exception : fiche détaillée d'un objet (affiche) avec onglets dans sa fenêtre.
- Type : règle
- Source : [DESIGN] §4.9 ; [README] §2.1
- Ambiguïté : aucune

### EX-TRA-011 — Plan du site (écrans cibles)
- Énoncé : Pilotage (Suivi de prod, État des réservations vivant, Alertes) ; Réception (Réception des affiches, Liste des affiches, Réceptions inconnues) ; Pré-production (Validation admin et Instruction OK, Vérification des thèmes) ; Déroulant (Suivi de prod de l'atelier, Liste des instructions, Liste des trains, Suivi par thème, Préparation, Suivi 8 m², Fichiers Vendôme/multi-rouleuse, Bagues, Dispatch) ; 2 m² fixe/Pliage/Bus (Suivi, Préparation) ; Expédition ; Stocks (Stock, Fin de campagne) ; Administration (Paramétrage) ; Aide (Parcours guidés, Traçabilité des besoins : maquette seulement).
- Type : fonctionnalité
- Source : [README] §3
- Ambiguïté : le détail écran par écran n'est pas dans ce lot (screens/*.js).

### EX-TRA-012 — Menu actuel (existant, référence)
- Énoncé : 2m² fixe, Pliage, Trains, Expedition ext, Réception (4 entrées), Suivi (Suivi de production, État des réservations, Analyse Production, État de destruction), Administration (déblocage, rafraîchir un dossier, dupliquer un train, référentiels, plateformes et mails, utilisateurs).
- Type : affichage
- Source : [RELEVE] §2
- Ambiguïté : « Analyse Production », « Zone picking », « Dupliquer un train », « Rafraîchir un dossier », « Déblocage » : correspondance cible non explicite.

### EX-TRA-013 — Bouton Retour
- Énoncé : une page ouverte par un lien d'une autre page affiche « ← Retour : <page quittée> » au-dessus du fil d'Ariane, qui y revient avec ses filtres ; le menu vide la pile. Un lien peut ouvrir une page avec des filtres posés (appliqués une fois à l'arrivée).
- Type : fonctionnalité
- Source : [DESIGN] §4.8, §4.9 ; [README] §4
- Ambiguïté : aucune

---

## C. Écrans, tableaux, filtres (règles d'UX transverses)

### EX-TRA-014 — Barre de filtres
- Énoncé : une seule barre dans le tableau (ligne d'outils), sauf dashboard/pages sans tableau ; filtres à choix multiples (ET entre filtres, OU entre valeurs) ; compteurs par valeur ; filtres « smart » (> 8 valeurs : seulement compatibles) ; champ « N° de dossier » (dossier, DA, annonceur ; puces ; collage de liste ; dossier masqué signalé avec filtre en cause) ; 4 filtres visibles maximum, « + Filtre » ; « Appliquer »/« Réinitialiser » ; filtres gardés au retour ; « Départ » = filtre de page (défaut : semaine en production, +suivantes pour pré-prod/réception) ; filtre d'en-tête sous chaque colonne (texte sans accents ; nombres >10, <5, >=3, =0).
- Type : fonctionnalité
- Source : [DESIGN] §4.3, §4.8 ; [README] §2.3, §2.7
- Ambiguïté : [DESIGN] §4.5 dit « pas de ligne de filtre sous les en-têtes » vs §4.8 (21/10) « un champ Filtrer sous le titre de chaque colonne » : voir Contradictions.

### EX-TRA-015 — Tableaux
- Énoncé : 8 colonnes visibles au plus ; autres dans « Colonnes » (« 8/26 », « Vue par défaut ») ; colonnes déplaçables, redimensionnables ; vue gardée sur le poste ; « Annonceur · thème » en une colonne ; bouton « voir le visuel » (aperçu en grand avec dossier, format, départ, n° d'affiche, emplacement) ; sélection par cases, actions groupées à la sélection ; 2 actions par ligne au plus ; densité confort 40 px / compacte 32 px ; tableau vide : une phrase qui dit pourquoi et quoi faire ; liseré coloré pour les exceptions ; chiffres à droite, tabular-nums ; totaux en pied si utiles.
- Type : affichage
- Source : [DESIGN] §4.5 ; [README] §2.7
- Ambiguïté : aucune

### EX-TRA-016 — Export Excel
- Énoncé : « Exporter » produit un .xlsx (pas CSV) : lignes et colonnes affichées dans l'ordre de l'écran, en-tête gras et figé, filtre automatique, largeurs ajustées, nombres et dates typés. Seuls les fichiers machine (Vendôme, multi-rouleuse) restent en CSV.
- Type : fonctionnalité
- Source : [DESIGN] §4.5 ; [README] §2.7
- Ambiguïté : génération côté navigateur ou serveur non précisée dans les specs (CLAUDE.md impose le navigateur pour le PDF seulement).

### EX-TRA-017 — En-tête de page, boutons, indicateurs
- Énoncé : en-tête : sur-titre (onglet · page), titre, phrase d'usage, actions à droite (une principale, deux secondaires au plus). Boutons : un principal par zone, verbe + objet, destructifs toujours confirmés. Cinq indicateurs au plus, cliquables (posent le filtre). Alertes dans la page : trois encadrés au plus. Détail : panneau latéral (consulter) ; fenêtre modale courte (saisir/confirmer) ; jamais deux fenêtres empilées ; changer d'écran ferme panneaux/fenêtres/menus.
- Type : affichage
- Source : [DESIGN] §4.1-4.8
- Ambiguïté : aucune

### EX-TRA-018 — Vocabulaire et micro-textes
- Énoncé : statuts uniques : À traiter, Préparation reçue, Validation admin faite, À libérer, En attente d'affiches, Prêt à produire, En production, Produit, Colisé · à expédier, Expédié, Livré, Annulé. « Un mot, un sens ». Boutons : verbe à l'infinitif + objet. Messages : ce qui s'est passé puis ce qui change. Erreurs : cause et correction. Pas d'abréviation sans infobulle (DA, IP, UM, DM) ; dates « jeu. 15/10 16h30 » ; nombres format français (« 1 284 »).
- Type : affichage
- Source : [DESIGN] §3, §11
- Ambiguïté : aucune

### EX-TRA-019 — Statuts : pastille + libellé + gravité
- Énoncé : statut d'avancement = pastille de la rampe bleue + libellé (En attente d'affiches #86b6ef … Expédié·livré #0d366b) ; « Annulé » gris barré ; gravité = badge avec icône et libellé ; jamais la couleur seule.
- Type : affichage
- Source : [DESIGN] §2.2, §2.3, §4.6, §12
- Ambiguïté : aucune

### EX-TRA-020 — Page à états vides/chargement/erreur
- Énoncé : tableau vide : phrase explicative et action ; erreur bloquante près du champ. États « chargement » et « erreur » de page non décrits.
- Type : affichage
- Source : [DESIGN] §4.5, §4.11
- Ambiguïté : états chargement/erreur globaux **non spécifiés** (exigence du projet CLAUDE.md, pas des specs).

### EX-TRA-021 — Postes et responsive
- Énoncé : Coordination/chef d'équipe : PC 1920×1080 ; réception/expédition : tablette ou PC d'atelier, boutons ≥ 40 px ; lecture : mêmes écrans sans boutons d'action. Sous 1280 px : sous-titre du logo masqué ; sous 1200 px : libellés de listes du bandeau 1 masqués et grilles en une colonne.
- Type : non-fonctionnel
- Source : [DESIGN] §8
- Ambiguïté : « avec douchette » pour la réception : contradictoire avec la décision du 19/10.

### EX-TRA-022 — Accessibilité
- Énoncé : contraste ≥ 4,5:1 ; focus clavier visible ; aucune information par la couleur seule ; cibles ≥ 32 px (40 px poste atelier) ; tableaux et graphiques lisibles au clavier ; chaque graphique a sa vue tableau.
- Type : non-fonctionnel
- Source : [DESIGN] §12, §10
- Ambiguïté : aucune

### EX-TRA-023 — Charte visuelle
- Énoncé : police système 14 px ; grille 4 px ; navy `#1b2a44`, accent `#0a6f93`, cyan `#1fb3d8` (jamais en texte sur blanc) ; marge de page 24 px ; ordre vertical : en-tête, indicateurs, contenu ; graphiques : barres horizontales, jamais camembert comparatif ni double axe.
- Type : affichage
- Source : [DESIGN] §1-3, §5, §10
- Ambiguïté : technologie de la maquette (Tabler/Tabulator/ECharts) non imposée à la V2 (charte « proposée comme point de départ au prestataire »).

---

## D. Impressions et PDF

### EX-TRA-024 — Impressions applicatives : feuille de stock et étiquette rack
- Énoncé : feuille de stock (étiquette rack A4, mention définitive/temporaire), impression en lot (1 à 5 exemplaires), avec/sans étiquettes rack ; impression à l'écran par navigateur. Voir EX-REC-029 à 034.
- Type : fonctionnalité
- Source : [DC] §6 ; [RELEVE] §7, §16
- Ambiguïté : format de sortie (PDF, impression directe) non précisé ; existant : RDLC (ReportViewer) PDF/Excel.

### EX-TRA-025 — Autres éditions existantes
- Énoncé : fiche de préparation détail et synthèse (Excel), bagues, étiquettes de colis et de rack, liste de picking par semaine (`EditionPicking.rdlc`), fiche de synthèse (bouton d'en-tête), quantités à encoller du bus. Étiquette rack imprimée d'office quand la validation admin est cochée (existant).
- Type : fonctionnalité
- Source : [RELEVE] §7, §16 ; [README] §3, §2.1 ; [DESIGN] §4.9
- Ambiguïté : conservation à l'identique non précisée ; périmètre hors Réception/Coordination.

### EX-TRA-026 — PDF
- Énoncé : aucune spec de la cible ne définit la génération PDF (existant : RDLC → PDF/Excel). Les documents de spécification eux-mêmes sont imprimables (A3/A4).
- Type : non-fonctionnel
- Source : [RELEVE] §1 ; [SOM]
- Ambiguïté : **exigence PDF non spécifiée** (contrainte « PDF côté navigateur » vient de CLAUDE.md, pas des specs).

---

## E. Alertes

### EX-TRA-027 — Écran Pilotage › Alertes
- Énoncé : exceptions par gravité (4 indicateurs) et par type (filtres avec compteur), acquittement, lien vers l'écran concerné (« chaque alerte ouvre l'écran où agir »). Icône d'alertes avec compteur au bandeau 1.
- Type : fonctionnalité
- Source : [README] §3 ; [DESIGN] §2.2, §4.4 ; [DC] §11
- Ambiguïté : règles d'acquittement (qui, résolution automatique à la correction ?) non précisées.

### EX-TRA-028 — Gravités
- Énoncé : Critique (rouge, triangle) : bloque un départ ou une deadline ; Important (orange) : à traiter dans la journée ; À surveiller (jaune) ; OK (vert) ; Info (azure). Toujours icône + libellé.
- Type : règle
- Source : [DESIGN] §2.2
- Ambiguïté : le dossier Réception utilise « grave » (≈ important ?) ; correspondance « grave » = « critique »/« important » non définie.

### EX-TRA-029 — Alertes configurables
- Énoncé : règles d'alerte en configuration : seuil, gravité, destinataires, canal (Administration › Paramétrage › Alertes et mails) ; listes de distribution (RP34). Mails simulés dans la boîte « Mails » de la maquette (aucun mail ne part).
- Type : fonctionnalité
- Source : [README] §2.5, §3 ; [DC] §11
- Ambiguïté : canaux disponibles (bandeau, mail, résumé 7 h) non listés exhaustivement.

### EX-TRA-030 — Principe « alertes remplacent mails et pointages Excel »
- Énoncé : les alertes remplacent les mails (réception inconnue, dossier introuvable) et pointages Excel ; mails existants : « Réception affiche » (chefs d'équipe, remplacé par dashboard), « Déblocages », « colis expédié » (batch, non cité dans les decks). Mails conservés : demande de correction à la Pré-Prod (Broadcast), mail « rajout après préparation » à la liste de distribution (H3).
- Type : règle
- Source : [DC] §11 ; [RELEVE] §9 ; [README] §6
- Ambiguïté : « résumé à 7 h » et « bandeau et mail » : cohabitation avec « pas de mail ».

### EX-TRA-031 — Catalogue d'alertes (réception et coordination)
- Énoncé : voir EX-REC-063 à 072 et EX-COO-015, 027-029, 031, 047 ; autres : « Arrivé après libération », « Broadcast ≠ Circé », surcharge/départ proche (dispatch), alerte « Visuel arrivé après la préparation des trains ».
- Type : traitement auto
- Source : [README] §3, §4 ; [DC] §11 ; [PC] p.2
- Ambiguïté : table exhaustive des alertes non fournie dans ce lot (data.js : autre agent).

### EX-TRA-032 — Alertes sans purge
- Énoncé : la purge des attendues ne lève pas d'alerte.
- Type : règle
- Source : [DC] §11
- Ambiguïté : aucune

---

## F. Notifications (UI)

### EX-TRA-033 — Notifications d'action
- Énoncé : confirmation après chaque action en bas à droite pendant cinq secondes ; erreur bloquante près du champ concerné ; une action sans retour visible est à éviter.
- Type : affichage
- Source : [DESIGN] §4.11, §7
- Ambiguïté : aucune

---

## G. Historisation et traçabilité

### EX-TRA-034 — Traçabilité complète
- Énoncé : le journal enregistre ce qui a été lancé, modifié ou ajouté ; chaque génération de fichiers est un lot versionné.
- Type : règle
- Source : [README] §2.6
- Ambiguïté : durée de conservation et consultation du journal (Paramétrage › journal) non précisées.

### EX-TRA-035 — Journal d'événements de réception
- Énoncé : `th_edr_evenement` : réception, contrôle, rattachement, changement de thème, retrait, modification, impression et réimpression de feuille, étiquette rack. Ligne au journal pour la purge automatique. Historique de l'affiche (onglet) : avec qui et quand ; non-conformité dans l'historique ; dissociation non historisée comme une association (anomalie existante).
- Type : règle
- Source : [DC] §8, §11, §13 ; [RELEVE] §16
- Ambiguïté : aucune

### EX-TRA-036 — Historique de la validation admin
- Énoncé : nom de la personne et date tracés ; l'historique existant (`HistorisationBll`) garde le changement de la case ; V2 : `validationAdmin_par`, `validationAdmin_le`. Rattachements : par qui et quand, actif/retiré.
- Type : règle
- Source : [PP] §5 ; [RA] §4 ; [DC] §13
- Ambiguïté : aucune

### EX-TRA-037 — Mouvements : stock = somme des mouvements
- Énoncé : le stock est la somme des mouvements ; chaque mouvement est tracé avec référence, date, BL, équipe, machine, transporteur, imprimeur, quantité.
- Type : règle
- Source : [RELEVE] §5, §11, §16 ; [DC] §9
- Ambiguïté : aucune

---

## H. Non-fonctionnel, sécurité, intégration

### EX-TRA-038 — Sécurité : identifiants en clair
- Énoncé : les fichiers de configuration des programmes d'échange contiennent des identifiants en clair ; à traiter dans la refonte, en lien avec la certification ISO 27001. Le dépôt contient des chaînes de connexion, SMTP, AD, Geodis, logins et e-mail codés en dur (valeurs non recopiées).
- Type : non-fonctionnel
- Source : [PP] §11 ; [RELEVE] §14
- Ambiguïté : aucune

### EX-TRA-039 — Intégration Broadcast
- Énoncé : Circé interroge Broadcast à intervalles réguliers (batchs : flux destinataires, préparations, trains, instructions, état des réservations S à S+8) ; retour vers Broadcast : une affiche est « associée » seulement si liée et validation admin = 1 (ANO-05). Circé ne peut pas écrire dans Broadcast (mail/alerte pour toute correction).
- Type : traitement auto
- Source : [RELEVE] §12 ; [README] §2.1 ; [DC] §12
- Ambiguïté : planification inconnue ; mécanisme de retour de la cible : « reçue et associée » reste envoyé à la validation ; ANO-05 corrigé côté « affiche reçue » mais retour BC à définir.

### EX-TRA-040 — Interfaces tierces
- Énoncé : Geodis (API Zoom, fichier TXT d'expédition, preuve de livraison), Broadcast (ExtPlay), Process Métier (non-conformités), Vendôme/Caire (fichiers CSV puis .ini), mail SMTP, AD. Hors périmètre Réception/Coordination sauf Broadcast et Process Métier.
- Type : non-fonctionnel
- Source : [RELEVE] §1, §7, §10 ; [DC] §5
- Ambiguïté : format `.ini` Vendôme non relevé.

### EX-TRA-041 — Paramétrage et référentiels
- Énoncé : Administration › Paramétrage : ateliers et gammes, machines, statuts (catalogue des statuts et tags), règles d'alerte et mails, listes de distribution, règles métier, transport, référentiels (Imprimeurs, Livreurs, Agents), journal. Règles en configuration, non dans le code (machines, alertes, entretien : grain, seuil, arrondi). Circé n'a pas de table de paramètres aujourd'hui.
- Type : fonctionnalité
- Source : [README] §2.5, §3 ; [DC] §11, §13
- Ambiguïté : aucune

### EX-TRA-042 — Purge / rétention
- Énoncé : purge automatique des réceptions attendues à 4 semaines (sauf conservation à l'année) ; conservation de 20 par défaut d'affiches / 365 pour « affiche à conserver » (existant) ; vidage du rebut.
- Type : règle
- Source : [DC] §12 ; [RELEVE] §16
- Ambiguïté : règles de rétention de journal et de photos de BL non définies.

---

## Statuts et transitions transverses
- Statuts uniques du vocabulaire (EX-TRA-018). Statuts existants de `tr_statut` : 0 A traiter, 1 En cours, 2 Instruction Ok, 3 Erreur, 4 Annulé, 5 A imprimer, 6 Préparé, 7 A expédier, 8 Terminé, 9 Export prepa, 10 Au roulage ([RELEVE] §3). Correspondance cible : Paramétrage › Statuts (non fournie dans ce lot).
- Alertes : gravité Critique/Important/À surveiller ; acquittement ; ouverture de l'écran cible.

## Glossaire
- **Bandeau 1 / bandeau 2** : barres de navigation haute. **Site** : plateforme (Wissous, Nîmes). **Rôle** : profil de la maquette. **Gravité** : niveau d'alerte. **Parcours guidés** : scénarios de démo (maquette seulement). **Simuler** : événements de démonstration. **EDR** : état des réservations. **RDLC** : modèle d'édition ReportViewer. **Lot 0** : socle (connexion, droits, référentiels, cadre commun d'écrans, réceptions attendues fiables).

## Contradictions internes
1. [DESIGN] §4.5 (« pas de ligne de filtre sous les en-têtes ») vs §4.8 « Filtres d'en-tête » (21/10, un champ sous chaque colonne) et [README] §2.7.
2. [DESIGN] §8 (réception avec douchette / champ de scan) vs décision 19/10 (pas de douchette).
3. [DESIGN] §5 (onglet « Dossiers » dans le schéma) vs renommage « Pré-production ».
4. [DESIGN] §4.3 « Départ par défaut » vs écrans avec filtres propres : aucune contradiction forte ; [README] « 8 colonnes max » vs Tabulator avec colonnes masquées.
5. Résultats de tests [README] §8 : « 67 entrées », « 58 entrées », « 63 vues » : comptes divers non réconciliés.
6. « Les alertes remplacent les mails » vs alertes « bandeau et mail » ([DC] §11) et mails de correction à la Pré-Prod.
7. Rôle « agent de contrôle » ([README] §3) vs « Contrôleur = un agent de réception » ([DC] §2).
8. [README] ligne « Réceptions inconnues » cite deux destinataires pour l'alerte (Pré-Prod / Coordination).

## Sections non comprises ou incomplètes
- Authentification de la cible, gestion des utilisateurs, mapping rôle ↔ droits : non spécifiés.
- Génération PDF de la cible : non spécifiée.
- Notifications serveur (e-mail, push) : seulement des mails simulés ; canaux non définis.
- Historisation : durée, accès, format du journal incomplets.
- Concurrence, double soumission, atomicité : non traités dans les specs (exigences d'ingénierie CLAUDE.md, pas des specs).
- États chargement/erreur : non décrits au-delà du tableau vide.
- Documents du sommaire non lisibles ou hors périmètre : xlsx/pptx, `statuts_et_tags_calcul_ou_base.html`, MCD/MLD, BDD V1/V2, `00_synthese_powerpoint.md`.
