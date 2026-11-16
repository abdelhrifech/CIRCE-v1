# DESIGN.md — Circé (cible)

| | |
|---|---|
| **Objet** | Charte d'interface de la refonte de Circé. C'est la référence visuelle de la maquette ; elle est proposée comme point de départ au prestataire (SFER). |
| **Format** | Format `DESIGN.md` (Google Stitch, repris par [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)) : un texte qu'un humain ou un agent IA peut appliquer. Les sections 1 à 9 suivent ce format ; les sections 10 à 12 sont propres à Circé. |
| **Base technique de la maquette** | Tabler 1.6.1 (Bootstrap 5), Tabler Icons, ECharts 6, Tabulator 6. Voir `assets/vendor/VERSIONS.md`. |
| **Version** | V1.2 du 14/10/2026, à valider en atelier. La V1.1 a précisé les règles des indicateurs et des tableaux (§4.4, §4.5, §4.8). La V1.2 remplace le menu latéral par deux bandeaux en haut, avec un onglet par processus (§5), sur décision de la cheffe de projet du 14/10/2026. Le même jour, elle a aussi retiré les onglets internes des pages (§4.9), ajouté le champ « N° de dossier » et validé les filtres « smart » (§4.3). Le 15/10, les onglets ont été repris de Circé : un par type de production et un par domaine partagé, plus un onglet Dossiers pour la Pré-Prod (§5), devenu Pré-production le 25/10 ; depuis le 27/10, c'est le travail de la Coordination : la Pré-Prod ne travaille que dans Broadcast (IP, envoi de la préparation). |

## 0. Le problème à résoudre : un Circé « fouillis »

Constats tirés des captures du kick-off (slides 21 à 53) et du relevé du code existant :

| Constat dans Circé actuel | Effet pour l'utilisateur | Règle de la cible |
|---|---|---|
| Sept menus déroulants (2m² fixe, Pliage, Trains…), des écrans éparpillés (la Pré-Prod dans plusieurs menus, le stock dans la Réception), deux mises en page différentes dans le code | On cherche l'écran au lieu de travailler | Les onglets de Circé, gardés et complétés : un par **type de production** et un par **domaine partagé**, en haut, toujours visibles ; chaque onglet d'atelier contient toute sa chaîne (§5) |
| Grilles Kendo de 15 à 25 colonnes, en-têtes tronqués (« A… », « numéro aff… »), une ligne de filtre sous chaque colonne | Rien ne ressort, l'œil ne sait pas où aller | **8 colonnes visibles au plus** par défaut, une seule recherche, colonnes à la demande (§4.5) |
| Boutons gris tous identiques, alignés par 5 à 7 (Étiquette, Synthèse, Export Préparation, Export Préparation V2…) | Impossible de savoir quelle est l'action principale | **Une action principale** par écran, le reste en secondaire (§4.2) |
| 5 petites icônes d'action par ligne, sans libellé | Erreurs de clic, apprentissage long | **2 actions par ligne au plus**, avec libellé (§4.5) |
| Statuts en texte brut (« A traiter », « En cours », « Préparé »), sens différents selon l'écran | Les exceptions ne se voient pas | **Statut = pastille colorée + libellé**, vocabulaire unique (§2.3, §11) |
| Compteurs dans un petit cadre « Résultat » en haut à droite | Les chiffres clés passent inaperçus | **Indicateurs en tête de page**, cliquables (§4.4) |
| Fenêtres modales empilées (« Modifier une affiche », 4 onglets) | On perd le contexte de la liste | **Détail dans un panneau latéral**, la liste reste visible (§4.8) |
| Police à empattement par défaut, 11 à 12 px, alignements irréguliers | Fatigue visuelle | Police système, 14 px, grille de 4 px (§3, §5) |

## 1. Thème visuel et atmosphère

- **Un outil d'exploitation calme.** Fond clair et neutre, une couleur d'accent, aucun dégradé ni ornement. La couleur est réservée à l'**information** : action, statut, alerte.
- **Les exceptions d'abord.** Chaque écran répond d'abord à « qu'est-ce qui ne va pas, et que dois-je faire ? », puis donne le détail.
- **Dense mais aéré.** Les utilisateurs manipulent des centaines de lignes : on garde la densité, mais avec des espacements réguliers, des colonnes alignées et une hiérarchie typographique nette.
- **Identité Cityz discrète.** Le bleu nuit et le cyan de Cityz habillent la navigation et l'accent ; le contenu reste neutre.

## 2. Palette et rôles des couleurs

### 2.1 Couleurs de structure

| Rôle | Jeton | Valeur | Usage | Contraste |
|---|---|---|---|---|
| Navigation | `--cz-navy` | `#1b2a44` | Fond du bandeau du haut (logo, périmètre) | texte blanc 14,4:1 |
| Navigation, survol | `--cz-navy-2` | `#24375a` | Variante foncée du bandeau du haut | — |
| Accent de marque | `--cz-cyan` | `#1fb3d8` | Barre de l'élément actif, « é » du logo. **Jamais en texte sur fond blanc** | sur bleu nuit 5,8:1 |
| Action principale | `--tblr-primary` | `#0a6f93` | Boutons principaux, liens, focus, onglet actif | sur blanc 5,7:1 |
| Fond de page | Tabler | gris très clair | Arrière-plan | — |
| Surface | Tabler | `#ffffff` | Cartes, tableaux, panneaux | — |
| Texte principal | Tabler | `#16191d` environ | Titres, valeurs | 17,6:1 |
| Texte secondaire | `--cz-ink-2` | `#4b5260` | Sous-titres, libellés | 7,9:1 |
| Texte discret | `--cz-ink-3` | `#6f7683` | Aides, horodatages. **Uniquement sur fond blanc** | 4,6:1 |

### 2.2 Gravité des alertes (toujours icône + libellé)

| Gravité | Couleur Tabler | Icône | Emploi |
|---|---|---|---|
| Critique | `red` | triangle d'alerte | Bloque un départ ou une deadline (visuel non reçu pour S, préparation absente après la deadline) |
| Important | `orange` | cercle d'alerte | À traiter dans la journée (partiel, orpheline de plus de 24 h, écart Broadcast) |
| À surveiller | `yellow` | cercle d'alerte | À regarder (écart de plus de 10 %, échéance S+1) |
| OK | `green` | coche | Confirmation |
| Info | `azure` | « i » | Information neutre |

### 2.3 Étapes de production (rampe ordinale bleue)

Un seul bleu, du clair (en amont) au foncé (terminé). Palette validée pour le daltonisme et le contraste avec l'outil de contrôle « dataviz » (lisible aussi en niveaux de gris).

| Étape | Valeur |
|---|---|
| En attente d'affiches | `#86b6ef` |
| Prêt à produire | `#5598e7` |
| En production | `#2a78d6` |
| Colisé · à expédier | `#1c5cab` |
| Expédié · livré | `#0d366b` |

Les états hors flux (« Annulé ») sont en gris barré. Les annotations de la maquette (besoins couverts) sont en violet clair, couleur qui n'a aucune autre signification.

## 3. Typographie

| Élément | Taille | Graisse | Remarque |
|---|---|---|---|
| Police | — | — | Police système (`system-ui`, donc Segoe UI sous Windows) : aucune police à télécharger |
| Titre de page | 20 px | 600 | Un verbe ou un objet métier (« Réception et liste des affiches ») |
| Sur-titre de page | 11 px | 600, majuscules | L'onglet et la page (« Déroulant · Trains ») |
| Titre de carte | 15 px | 600 | — |
| Texte courant | 14 px | 400 | Taille de base de Tabler |
| Tableaux | 13 px | 400 ; en-têtes 11 px en majuscules | Chiffres alignés à droite, à chasse fixe (`tabular-nums`) |
| Indicateur | 24 à 28 px | 600 | Chiffres proportionnels |
| Chiffre principal d'un écran | 48 px | 600 | Un seul par écran (avancement de la semaine) |

Règles : pas d'abréviation sans infobulle (DA, IP, UM, DM) ; dates au format « jeu. 15/10 16h30 » ; nombres au format français (« 1 284 »).

## 4. Composants (avec leur équivalent Tabler)

### 4.1 En-tête de page
Sur-titre (onglet et page), titre de la vue, une phrase qui dit à quoi sert l'écran, puis **les actions à droite** : une action principale et deux secondaires au plus. Le bouton « Besoins couverts » (violet, en pointillé) n'existe que dans la maquette. Tabler : `page-pretitle`, `page-title`, `btn-list`.

### 4.2 Boutons
| Niveau | Tabler | Règle |
|---|---|---|
| Principal | `btn btn-primary` | **Un seul par zone** ; libellé verbe + objet (« Valider la réception ») |
| Secondaire | `btn` | Actions fréquentes |
| Discret | `btn btn-ghost-secondary` | Actions de ligne, « Acquitter » |
| Destructif | `btn btn-outline-danger` | Toujours confirmé |
| Taille réduite | `btn-sm` | Dans les tableaux et les barres d'outils |

Les icônes accompagnent le libellé, elles ne le remplacent pas (sauf flèches de tri ou de déplacement).

### 4.3 Barre de filtres
Une seule barre, qui s'applique à tout l'écran : indicateurs, graphiques et tableau. **Elle est dans le tableau même** (décision de la cheffe de projet du 19/10, « tous les tableaux de la maquette ») : sur la ligne d'outils du tableau, juste au-dessus des colonnes, avant le nombre de lignes et les boutons Compact, Colonnes et Exporter, qui restent groupés à droite. La maquette l'y pose d'elle-même (`core.js`, `filtresDansLeTableau`) : la barre passe dans le premier tableau qui la suit. Le champ « Dossier » y tient lieu de recherche : la recherche du tableau ne reparaît que si un lien y a posé un texte. À la réception, le champ « Dossier » est dans le bandeau « Trouver les dossiers du BL », avec les deux photos (filtre marqué `dehors`, posé par `F.champ`) : le tableau des réceptions attendues n'a plus de recherche. Exceptions : le dashboard, où la barre pilote aussi les graphiques (option `page` de `ui.filters`), et les pages sans tableau ; la barre y reste sous l'en-tête. Les filtres restent des listes à cocher (pas de puces, essayées puis refusées le 19/10).
- **Filtres à choix multiples** : chaque filtre est une liste de valeurs à cocher ; aucune coche = tout.
- **Filtres cumulés** : les filtres s'additionnent (ET), les valeurs cochées d'un même filtre aussi (OU). Filtrer S42 puis un format garde S42, ce que Circé actuel ne fait pas (réunion du 14/10). La recherche du tableau s'applique en plus.
- **Compteurs** : à côté de chaque valeur, le nombre de lignes qu'elle donnerait avec les autres filtres déjà posés.
- **Filtres « smart »** (ERG-06) : une longue liste (plus de 8 valeurs) ne propose que les valeurs compatibles avec les autres filtres, plus celles déjà cochées. Un lien « Afficher aussi N valeurs sans résultat » donne les autres. Une liste courte et le filtre Départ gardent toutes leurs valeurs, les valeurs à 0 grisées.
- **Champ « N° de dossier »** (ERG-08), en tête de la barre :
  - on y tape un n° de dossier, de DA ou un annonceur ; Entrée ajoute la proposition active ;
  - les dossiers choisis s'affichent en puces (trois, puis « +N ») ; Retour arrière retire la dernière, la croix vide le champ ;
  - un texte collé avec plusieurs n° (mail, Excel) est lu en entier : n° reconnus ajoutés d'un coup, n° absents de la page signalés ;
  - les propositions tiennent compte des autres filtres ; un dossier qu'ils masquent est signalé avec le filtre en cause, et « Afficher » l'ajoute en retirant ce filtre.
- **Quatre filtres visibles au plus**, les autres s'ajoutent par « + Filtre ». Un filtre actif est teinté et affiche ses valeurs (« Départ S43 + S44 »).
- Le choix s'applique en fermant la liste (« Appliquer », clic ailleurs ou Échap). « Réinitialiser » remet les valeurs par défaut. Les filtres d'un écran sont gardés quand on y revient.
- **Départ** (semaines de départ des camions) est un filtre de page. Par défaut : la semaine en production dans les écrans de production, la semaine en production et les suivantes pour la pré-production (Coordination) et la réception.
- Le **site** reste dans le bandeau du haut et vaut pour toute l'application.
- Un indicateur cliquable pose le filtre correspondant (ex. « En attente d'affiches » → Statut).

Tabler : `card`, boutons de filtre, liste à cocher dans un `dropdown-menu` avec `form-check-input`.

### 4.4 Indicateurs
Une rangée de **cinq tuiles au plus** : libellé (sur-titre), valeur, une ligne de contexte. Une tuile cliquable mène au détail filtré. Tabler : `card card-sm`, `subheader`, `h1`.
- Les chiffres de contexte (attendu, reçu, total à produire) vont dans la ligne de contexte plutôt que dans une tuile de plus.
- Plus de cinq catégories à compter (les dix types d'alerte, par exemple) : quatre ou cinq tuiles pour l'essentiel (les gravités), et les catégories en **filtres compacts avec compteur** sous les tuiles.

### 4.5 Tableaux (Tabulator)
- **8 colonnes visibles au plus** par défaut ; les autres sont disponibles dans « Colonnes ». Le bouton indique « visibles / disponibles » (« Colonnes 8/26 ») et propose « Vue par défaut ».
- Pour tenir en 8 colonnes sans perdre d'information :
  - un visuel se nomme **« Annonceur · thème »** dans une seule colonne, annonceur en gras ; les colonnes séparées restent disponibles ;
  - quand l'écran couvre toutes les plateformes, le site s'ajoute au libellé (« 2 m² déroulant · Nîmes », emplacement « C-6 · Wissous ») au lieu d'une colonne de plus ;
  - « Reçu / attendu » peut tenir dans une colonne (« 4 / 7 »), le reste à côté ;
  - une information rare s'affiche dans la cellule qui la concerne (rebut à côté du stock, « arrivé après libération » à côté du statut).
- Colonnes déplaçables (flèches « monter / descendre » du menu « Colonnes », ou glisser l'en-tête) et redimensionnables ; la vue (ordre et colonnes affichées) est gardée sur le poste, d'une ouverture à l'autre.
- **Voir le visuel** : un petit bouton (icône photo) devant l'intitulé d'un visuel, dans toutes les listes ; les pastilles A-D des trains font de même. Le clic ouvre l'affiche en grand avec son dossier, son format, son départ, son n° d'affiche et son emplacement ; il n'ouvre pas la ligne.
- Flèche de tri seulement sur la colonne triée (discrète au survol des autres) ; en-têtes des colonnes de chiffres alignés à droite, sur les chiffres.
- Texte long : il passe à la ligne, avec une largeur de départ bornée que l'utilisateur peut élargir.
- **Une seule recherche** au-dessus du tableau ; pas de ligne de filtre sous les en-têtes.
- **« Exporter » produit un fichier Excel (.xlsx)**, pas un CSV (demande du 16/10) : les lignes et les colonnes affichées, dans l'ordre de l'écran ; en-tête en gras et figé, filtre automatique, largeurs ajustées ; les nombres restent des nombres et les dates des dates. Seuls les fichiers machine (Vendôme, multi-rouleuse) restent en CSV, le format que lisent les machines.
- Sélection par case à cocher ; les actions groupées apparaissent **quand une sélection existe**.
- Statut en pastille, chiffres à droite, totaux en pied de tableau si utiles.
- Ligne en exception : liseré coloré à gauche (même couleur que sa gravité).
- **Deux actions par ligne au plus**, avec libellé ; le reste est dans le panneau de détail. Elles restent visibles à droite quand le tableau défile en largeur (une ombre signale le défilement).
- Densité « confort » (40 px) par défaut, « compacte » (32 px) au choix.
- Tableau vide : une phrase qui dit pourquoi, et quoi faire.

### 4.6 Statuts et gravités
- Statut d'avancement : pastille ronde de la rampe (§2.3) et libellé. Tabler : `status`.
- Gravité : badge clair (`badge bg-red-lt`…) avec icône et libellé.
- Étiquettes neutres (« Print Cityz », « Campagne contrôlée ») : `badge bg-secondary-lt`.

### 4.7 Alertes dans la page
Encadré pleine largeur (`alert alert-warning`…) avec icône, titre court, une phrase et **une action**. Trois encadrés au plus par écran.

### 4.8 Détail : panneau latéral plutôt que fenêtre
- **Consulter** (fiche dossier, affiche, train) : panneau à droite (`offcanvas-end`), la liste reste visible.
- **Saisir ou confirmer** (réception inconnue, rendu main, rebut) : fenêtre modale courte (`modal`), une action principale.
- **Pas de doublon entre le menu et la page** (19/10) : une action proposée dans la page ne figure pas aussi dans le menu.
- **Parcours en étapes** (réception, 19/10) : une page par étape, le repère des étapes en tête (à droite du titre), les actions dans la page plutôt qu'en boutons d'en-tête. L'action par laquelle on commence a son bandeau, juste sous l'en-tête (« 1 · Trouver les dossiers du BL » : les trois façons côte à côte et au même format, photo du BL, photo d'une affiche, n° de dossier ; puis, à la ligne, « Rien ne correspond ? » et le recours). Pas d'autre numéro dans la page : les cartes « Lignes du BL (panier) » et « Bon de livraison » n'en ont pas, pour ne pas se confondre avec l'étape 2.
- **Filtres dans le tableau** (19/10) : voir §4.3 ; d'abord demandé pour les réceptions attendues, puis pour tous les tableaux.
- **Filtres d'en-tête** (21/10, tous les tableaux) : un champ « Filtrer » sous le titre de chaque colonne, en plus des filtres de la ligne d'outils, qui restent. Texte contenu, sans tenir compte des accents ni des majuscules ; sur une colonne de nombres, « >10 », « <5 », « >=3 », « =0 ». Ils se cumulent avec les autres filtres, restent posés quand la page se redessine (session), et « Effacer les filtres des colonnes » apparaît dès qu'un champ est rempli. L'export Excel les suit. Une colonne peut s'en passer (`filter: false`).
- **Retour** (19/10) : une page ouverte par un lien d'une autre page (indicateur, alerte, ligne, bouton) affiche, au-dessus du fil d'Ariane, « ← Retour : <page quittée> », qui y revient avec ses filtres. Le menu vide la pile ; le bouton n'apparaît donc qu'après un lien.
- **Pas d'étiquette ni de douchette à la réception** (19/10) : validée, la palette passe au sas de l'étape 2 (palettes en zone tampon, la plus ancienne en tête, temps d'attente, alerte au-delà du délai paramétrable) ; on l'ouvre dans la liste.
- **Panier et formulaire liés** (réception, 19/10) : le panier se remplit en masse, une case par ligne (cochée d'office, case « tout » en tête, lignes cochées surlignées) ; le formulaire à côté ne vaut que pour les lignes cochées et le dit (« Pour les 2 ligne(s) cochée(s) », nombre de lignes et d'affiches, bouton « Valider la réception (2 lignes) »). Les lignes non cochées restent au panier pour le formulaire suivant.
- **Le document lu pré-remplit le formulaire** (réception, 19/10) : la photo du BL remplit le bon de livraison (n° de BL, imprimeur, transporteur, colis) et coche ses lignes ; l'humain vérifie et valide. La photo est obligatoire, même quand les lignes viennent de la recherche : tant qu'elle manque, un encadré « BL à photographier » porte le bouton, et la validation est refusée.
- Jamais deux fenêtres l'une sur l'autre : passer d'une fiche à une autre (affiche → réception) ferme la première.
- Changer d'écran ferme les panneaux, fenêtres et menus ouverts.

### 4.9 Pas d'onglets dans les pages
Décision de la cheffe de projet du 14/10/2026 : une page n'a pas d'onglets internes. Elle montre son en-tête, ses filtres, puis son contenu.
- **Les vues d'une page sont des entrées du menu** du bandeau 2 (§5), en retrait sous la page, avec leur compteur quand il aide à décider (« Anciennes à purger 9 »). Exemple : Stocks › Fin de campagne › À décider ou À détruire.
- **L'atelier** (fixe, pliage, bus ; dispatch des déroulants) se choisit aussi dans le menu, et devient le titre de la page.
- **Un découpage par statut devient un filtre** : « À imprimer / Imprimées » (bagues), « Préparation reçue / Validé… » et « Écart BC » (instructions), « Arrivé après libération / Main rendue » (filtre Repère du fixe et du pliage).
- **Un document ou un réglage ponctuel devient un bouton d'en-tête** qui ouvre une fenêtre : fiche de synthèse à imprimer, quantités à encoller du bus.
- Un lien peut ouvrir une page avec des filtres posés (« Écarts Broadcast / Circé » depuis la liste de l'onglet Pré-production, ou le dossier d'une alerte). Ils sont appliqués une fois, à l'arrivée ; l'utilisateur peut ensuite les changer.
- Seule exception : la fiche détaillée d'un objet (affiche) peut garder des onglets à l'intérieur de sa fenêtre.

### 4.10 Étapes
Pour les parcours en plusieurs temps (générateur de fichiers) : Tabler `steps steps-counter`.

### 4.11 Notifications
Confirmation après une action, en bas à droite pendant cinq secondes. Une erreur bloquante reste affichée près du champ concerné.

## 5. Mise en page

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Circé │ Site ▾  Rôle ▾                                alertes  mails  Simuler  Aide │  bandeau 1 (bleu nuit)
├─────────────────────────────────────────────────────────────────────────────────────┤
│ Pilotage Réception Dossiers Déroulant 2m² fixe Pliage Bus Expédition Stocks Adm     │  bandeau 2 (onglets, blanc)
├─────────────────────────────────────────────────────────────────────────────────────┤
│ ONGLET · PAGE                                                                       │
│ Titre de la vue                                            [Secondaire] [Principal] │
│ À quoi sert la vue, en une phrase.                                                  │
│ Filtres [Dossier ...][Départ S43 ▾][Atelier ▾][Format ▾] [+ Filtre]                 │
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐   indicateurs (5 au plus)                  │
│ └──────┘└──────┘└──────┘└──────┘└──────┘                                            │
│ ┌───────────────────────────────────────────────────────────────────────────────┐   │
│ │ contenu : tableau, graphiques, cartes                                         │   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **Deux bandeaux en haut, pas de menu latéral** : le contenu prend toute la largeur.
- **Bandeau 1** (bleu nuit, 56 px) : logo (retour à Pilotage › Suivi de prod, la page d'ouverture : il n'y a pas de page d'accueil, décision du 16/10), site et rôle. À droite : les alertes et les mails (icône avec compteur), puis, propres à la maquette, « Simuler », l'interrupteur « Besoins » et le menu « Aide » (parcours guidés, traçabilité des besoins, date simulée). La semaine de départ n'y est plus : c'est un filtre de page (§4.3).
- **Bandeau 2** (blanc, 50 px) : dix onglets, repris de Circé et complétés (décisions du 15/10) :
  - un par **type de production**, comme les menus actuels et les types du code (`2M2FIXE`, `PLIAGE`, `DEROULANT`) : Déroulant (2, 4 et 8 m²), 2 m² fixe, Pliage, et Bus (cible) ;
  - un par **domaine partagé** : Pilotage, Réception, Expédition, Stocks (le « Suivi des stocks » de RP32 #2, renommé le 16/10), Administration ;
  - **Dossiers**, puis **Pré-production** (25/10) : le travail de la Coordination sur les dossiers, tous ateliers confondus (préparations reçues : Instruction OK et validation admin, indépendantes ; l'Instruction OK est automatique (règle de Nariman) sinon à la main, la validation admin est proposée par Circé à la réception et confirmée par la Coordination, en lot avec les cas sûrs pré-cochés, 02/11 ; vérification des thèmes).
  - Chaque onglet d'atelier contient toute sa chaîne, à commencer par son suivi de prod (décision du 16/10) ; les préparations à valider sont dans l'onglet Pré-production (ex « Dossiers », renommé le 25/10). Le Déroulant garde les tableaux du menu « Trains » de Circé, sous leurs noms : Liste des instructions, Liste des trains, Suivi par thème, Préparation (25/10).
  - Un même écran peut servir plusieurs onglets avec un contexte différent (suivi de prod, préparation, fichiers) : l'onglet actif est celui du contexte de l'adresse.
  - L'onglet en cours est souligné.
  - Son compteur est celui de sa première page en alerte ; le détail par page est dans la liste.
- **Liste d'un onglet** : ses pages, chacune avec son compteur, et en retrait les vues de chaque page, ou ses ateliers. Une entrée mène ainsi à une vue précise (« État des réservations vivant », « Liste des affiches », « Nîmes · 2 m² fixe »…). Les pages n'ont pas d'onglets internes (§4.9).
  - L'entrée en cours est surlignée.
  - Les pages qui servent moins au rôle choisi sont grisées.
  - Une seule liste ouverte à la fois ; clic ailleurs, Échap ou changement d'écran la ferment.
- Grille de 4 px : espacements de 4, 8, 12, 16, 24 et 32 px. Marge de page de 24 px, 16 px entre cartes.
- Ordre vertical constant : en-tête, indicateurs, contenu ; les filtres sont dans le tableau, au-dessus des colonnes (§4.3, 19/10), sauf sur le dashboard, où ils restent sous l'en-tête parce qu'ils pilotent aussi les graphiques.
- Deux colonnes au plus pour le contenu (2/3 et 1/3 pour liste et contexte).

## 6. Profondeur et élévation

- Cartes : bordure fine et ombre très légère (celles de Tabler). Pas d'ombre portée forte.
- Menus déroulants et panneaux : ombre moyenne.
- Fenêtres modales : voile sombre à 45 %.
- L'élévation sert à dire « ceci est au-dessus du reste », jamais à décorer.

## 7. À faire, à éviter

| À faire | À éviter |
|---|---|
| Une action principale par écran, nommée par un verbe | Une rangée de boutons gris identiques |
| 8 colonnes visibles par défaut, les autres à la demande | 20 colonnes tronquées par des « … » |
| Une recherche, et des filtres dans une seule barre | Une ligne de filtre sous chaque en-tête |
| Statut = pastille + libellé, même vocabulaire partout | « En cours » qui veut dire deux choses selon l'écran |
| Exceptions en tête, triées par gravité | Des listes complètes à parcourir pour trouver le problème |
| Détail dans un panneau latéral | Des fenêtres modales imbriquées |
| Libellés complets, infobulles pour les sigles | DA, IP, UM, DM sans explication |
| Couleur + icône + texte | La couleur seule pour porter un sens |
| Une confirmation après chaque action | Une action sans retour visible |
| Un tableau vide qui dit quoi faire | Un tableau vide muet |

## 8. Adaptation aux écrans et aux postes

| Poste | Écran | Adaptations |
|---|---|---|
| Coordination, chef d'équipe | PC 1920 × 1080 | Disposition complète |
| Réception, expédition | Tablette ou PC d'atelier avec douchette | Écrans de scan en grands caractères ; boutons de 40 px au moins ; champ de scan toujours prêt |
| Lecture (commerce) | PC ou portable | Mêmes écrans, sans les boutons d'action |

Écrans plus étroits :
- sous 1280 px de large, le sous-titre du logo disparaît ;
- sous 1200 px, les libellés des listes du bandeau 1 disparaissent et les grilles passent sur une colonne ;
- sous 1480 px, les onglets se resserrent et perdent leur icône, puis encore un peu sous 1300 px : les dix onglets, compteurs compris, tiennent jusqu'à 1280 px ;
- si les onglets ne tiennent pas, leur barre défile horizontalement. Cible : onglets repliés dans un menu sous 992 px (non fait dans la maquette).

## 9. Guide pour un agent IA

Rappel rapide :
- **Navigation** : bandeau du haut bleu nuit `#1b2a44` (périmètre) ; barre d'onglets blanche, un onglet par type de production et par domaine partagé, plus l'onglet Pré-production, onglet actif souligné en bleu d'action `#0a6f93`.
- **Action et liens** : `#0a6f93` ; un seul bouton principal par zone.
- **Avancement** : rampe bleue `#86b6ef` → `#0d366b`.
- **Gravité** : rouge, orange, jaune, vert, toujours avec icône et libellé.
- **Base** : Tabler, police système, 14 px, grille de 4 px.

Formulation type :

> « Construis l'écran *X* de Circé en respectant DESIGN.md : en-tête (sur-titre onglet et page, titre, phrase d'usage, une action principale), une barre de filtres de 3 filtres, une rangée de 4 indicateurs cliquables, puis un tableau Tabulator de 8 colonnes visibles avec sélection et actions groupées. Les exceptions sont signalées par un liseré et une pastille de gravité. Le détail d'une ligne s'ouvre dans un panneau latéral. »

## 10. Graphiques (règles reprises du guide « dataviz »)

- Choisir la forme selon la question. Un chiffre seul se montre en tuile, pas en graphique. Pour comparer des quantités, des barres horizontales. Jamais de camembert pour comparer des valeurs proches, jamais de double axe.
- Barres fines (16 à 18 px), extrémité arrondie, 2 px d'espace entre segments empilés, grille horizontale discrète.
- Légende dès deux séries ; total en bout de barre ; infobulle au survol ; **vue tableau** équivalente pour chaque graphique.
- Couleurs : rampe bleue pour les étapes ; la couleur suit l'objet, jamais son rang.

## 11. Vocabulaire et micro-textes

- **Statuts uniques**, quel que soit l'écran : À traiter, Préparation reçue, Validation admin faite (ex « Validé Pré-Prod », 27/10), À libérer, En attente d'affiches, Prêt à produire, En production, Produit, Colisé · à expédier, Expédié, Livré, Annulé.
- **Un mot, un sens** (02/11) : « À traiter » est réservé au dossier dont la préparation n'est pas reçue (comme dans Broadcast). La ligne 2 m² fixe ou pliage d'une semaine pas encore libérée est « à libérer » (Circé disait aussi « A traiter », pour le moment inverse). La validation admin (Aucune affiche reçue, À confirmer, Validée) a sa pastille à côté du statut de préparation du dossier : elle ne passe plus par l'attente de la prépa, et n'est jamais « Validée » sans affiche reçue.
- **Aucune validation sans une personne, cas sûrs pré-cochés** (02/11, option A) : quand Circé PROPOSE (rattachement d'une affiche à son dossier), une liste d'actions en lot pré-coche à l'arrivée les lignes sans doute (option `preselect` de `ui.table`, une fois par arrivée sur l'écran, M.navSeq) ; les lignes à doute ne sont jamais pré-cochées, et le bouton « Cocher les cas sûrs » recoche les premières. L'action en lot (« Valider la sélection ») demande une confirmation explicite quand la sélection contient des doutes. Le bandeau de la page l'écrit : « Aucune validation sans vous : Circé propose, vous confirmez ».
- Boutons : verbe à l'infinitif + objet (« Proposer les fichiers », « Clore le colis »).
- Messages : ce qui s'est passé, puis ce qui change (« Réception R260912 créée : 3 unités passent « Prêt à produire » »).
- Erreurs : la cause et la correction (« Le nom du contrôleur est obligatoire »).

## 12. Accessibilité

- Contraste du texte de 4,5:1 au moins (valeurs vérifiées au §2.1) ; focus clavier visible (contour de la couleur d'action).
- Aucune information portée par la couleur seule.
- Cibles cliquables de 32 px au moins (40 px sur les postes d'atelier).
- Tableaux et graphiques lisibles au clavier ; chaque graphique a sa vue tableau.
