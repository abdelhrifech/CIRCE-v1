# Analyse des maquettes — Réception et Coordination (+ Alertes)

Source : `docs-sources/2. CIRCE CIBLE + MAQUETTE/maquette/` (HTML/JS statique, aucune image : tout est lu dans le code JS). Fichiers lus en entier : `index.html`, `README.md`, `DESIGN.md` (sections 0 à 4.6), `assets/js/{app,core,ui,data}.js`, `screens/{reception,identification,instructions,trains,unitaire,dispatch,bagues,alertes}.js`.
Tous les écrans sont reconstruits au rendu par du JS : un « écran » = un `M.screen({id,...})` ; une « vue » = un paramètre `?tab=` ou `?pour=`/`?type=`/`?atelier=` de l'ancre `#/ecran?...`.

Légende des renvois : `fichier:ligne` pointe dans `docs-sources/.../maquette/assets/js/`. Les IDs de besoins (REC-xx, PP-xx, SCR-xx...) sont ceux annotés dans la maquette (référentiel de phase 0), pas des EX-xxx de CIRCE V2.

---

## 0. Classement des écrans en modules

Critère : l'onglet du menu sous lequel l'écran est rangé (`core.js:373-434`) et le rôle principal cité dans README §3.

| Écran maquette (id) | Onglet de menu | Module retenu | Justification |
|---|---|---|---|
| `reception` (vues attendues / controle / affiches) | Réception | **REC** | Onglet Réception, rôle agent de réception / contrôle |
| `identification` (Réceptions inconnues) | Réception | **REC** | Onglet Réception ; traité par la Coordination mais appartient au flux de réception (REC-17) |
| `instructions` (Validation admin et Instruction OK / Liste des instructions) | Pré-production (et Déroulant) | **COO** | Rôle `coord` + `admin` uniquement ; la Pré-Prod ne travaille plus dans Circé (27/10), c'est la Coordination |
| `trains` (Liste des trains, Suivi par thème, Préparation, Suivi 8 m²) | Déroulant | **COO** | Rôles `cheq` + `coord` ; fractionner, raccrocher, export du jeudi 14 h par la Coordination |
| `unitaire` (Préparation fixe / pliage / bus) | 2 m² fixe, Pliage, Bus | **COO** | Rôles `cheq` + `coord` ; libération de semaine, rendre la main (Coordination) |
| `dispatch` | Déroulant | **COO** | Rôle `cheq` ; coordination du roulage |
| `bagues` | Déroulant | **COO** | Rôle `cheq` ; unités de production |
| `alertes` | Pilotage | **TRA** (transverse) | Aucun `roles` déclaré : tous profils ; agrège des alertes REC, COO, PP, expédition. Classé ECR-TRA-01 plutôt que COO (convention CLAUDE.md : TRA = transverse). À confirmer. |

Hypothèse de classement signalée : « Coordination » dans la maquette est à la fois un **rôle** (`coord`) et un domaine ; le module COO regroupe ici ce que le chef d'équipe et la Coordination font autour des dossiers, trains et unités (hors Pilotage, Expédition, Stocks, Admin, traités par l'autre agent). Question Q-A en fin de document.

---

## 1. Shell, navigation, menus, profils

### 1.1 Structure de la page (`index.html`, `core.js`)
- `#topbar` (bandeau 1, bleu nuit) : logo « Circé / Maquette cible » (lien vers `#/suivi`), sélecteur **Site** (Tous les sites, Nîmes, Wissous, Nanterre (Bus) (cible)), sélecteur **Rôle**, bouton cloche **Alertes** (badge = nb alertes ouvertes ; rouge si au moins une critique ; clic → `#/alertes`), bouton enveloppe **Mails** (badge = mails non lus ; ouvre une modale boîte d'envoi simulée), bouton **Simuler** (menu d'événements de démonstration), interrupteur **Besoins** (affiche/masque les annotations violettes), menu **Aide** (Parcours guidés, Traçabilité des besoins : pages hors cible).
- `#menubar` (bandeau 2, blanc) : un onglet par domaine, chaque onglet ouvre un menu déroulant de pages et sous-entrées avec compteurs.
- `#main` : une page = en-tête (sur-titre, titre, sous-titre, actions, bouton « Besoins couverts (n) » propre à la maquette) → barre de filtres (qui est déplacée dans la ligne d'outils du premier tableau) → indicateurs → tableaux/cartes.
- `#overlay-root` : modales (`ui.modal`, « lg » ou « xl » si `wide`) et panneau latéral (`ui.drawer`, utilisé seulement pour « Besoins couverts »).
- Toasts (5 s, tons good / critical / mail), info-bulles.
- Routeur par ancre `#/ecran?param=valeur`. Pile « ← Retour : <page> » (jusqu'à 20 entrées) alimentée par `M.go()` (liens internes), vidée par le menu ou un lien direct (`core.js:233-252`).
- État global : `M.state = {site:'ALL', semaine:43, role:'cheq', annot:true}` ; site, rôle et annotations gardés en `sessionStorage`. La semaine n'est plus globale : c'est un filtre de page « Départ ».
- Écran d'ouverture : `suivi` (Pilotage). Pas de page d'accueil.

### 1.2 Menu (extrait lié à ce périmètre ; `core.js:373-434`)
| Onglet | Pages / sous-entrées | Écran |
|---|---|---|
| Pilotage | Suivi de prod ; État des réservations ; **Alertes** | suivi, reservations (autre agent) ; alertes (ECR-TRA-01) |
| **Réception** | **Réception des affiches** (`?tab=attendues`, vues attendues/saisie/controle ; badge = nb palettes à contrôler) ; **Liste des affiches** (`?tab=affiches`, icône package) ; **Réceptions inconnues** (badge rouge = nb affiches orphelines) | reception ×2, identification |
| **Pré-production** | **Validation admin et Instruction OK** (badge = nb dossiers avec quelque chose à faire par la Coordination, rouge si écart BC) ; Vérification des thèmes (sous-entrées Thèmes proches / Annonceurs proches / Thèmes modifiés dans Broadcast, avec compteurs) | instructions ; themes (autre agent) |
| **Déroulant** | Suivi de prod (`?pour=deroulant`) ; **Liste des instructions** (`instructions?pour=deroulant`) ; **Liste des trains** (`trains?tab=trains`) ; **Suivi par thème** (`tab=besoin`) ; **Préparation** (`tab=prepa`) ; **Suivi 8 m² (demies)** (`tab=d8`) ; Fichiers Vendôme (générateur, autre agent) ; **Bagues** ; **Dispatch** (sous-entrées : un atelier déroulant par site) | suivi, instructions, trains, generateur, bagues, dispatch |
| **2 m² fixe** | Suivi de prod ; **Préparation** (sous-entrées par atelier ; badge = dossiers arrivés après libération) ; Fichiers multi-rouleuse | suivi, unitaire, generateur |
| **Pliage** | Suivi de prod ; **Préparation** (sous-entrées par site · atelier) | suivi, unitaire |
| **Bus** | Suivi de prod ; **Préparation par centre** | suivi, unitaire |
| Expédition, Stocks, Administration | (autre agent) | expedition, stock, fincampagne, parametrage |

Le compteur d'un onglet = celui de sa première page « chaude » (rouge) sinon de la première page comptée. Les pages « secondaires » pour le rôle courant sont grisées (`s.roles` non inclus) avec l'info-bulle « Écran secondaire pour le rôle sélectionné » : **aucune interdiction d'accès, seulement du grisé**.

### 1.3 Profils (`M.ROLES`, `core.js:187-194`)
| id | Libellé | Écrans « primaires » du périmètre (champ `roles` de l'écran) |
|---|---|---|
| `coord` | Coordination | reception, identification, instructions, trains, unitaire |
| `cheq` | Chef d'équipe (**rôle par défaut au chargement**) | reception, trains, unitaire, dispatch, bagues |
| `recep` | Agent de réception | reception, identification |
| `expe` | Agent d'expédition | (aucun écran de ce périmètre) |
| `admin` | Administrateur | instructions |
| `com` | Commerce (lecture) | reception (lecture ; H10/AUT-05, pas de contrôle effectif dans le code) |

Seules restrictions réellement codées dans ce périmètre :
- Validation admin d'une affiche (bouton « Valider » / « Annuler la validation » dans la fiche affiche, « Valider la sélection » et « Valider (n affiches) » dans Validation admin et Instruction OK) : `role === 'coord' || 'admin'` ; sinon bouton désactivé avec l'info-bulle « Réservé à la Coordination : choisissez le rôle « Coordination » en haut de page pour valider » (instructions.js:16-18) ou texte d'aide dans la fiche affiche (reception.js:85-88).
- Rattachement manuel (fiche affiche, Réceptions inconnues, changement de thème) : si le rôle est `coord`, vaut validation admin ; sinon l'affiche reste « à confirmer » (rattachement `MAIN`).
- Bouton « Besoins couverts » : pur outil de maquette.
Rien d'autre n'est restreint par rôle (ex. « Exporter les trains » est visible pour tous les rôles ; la Coordination est seulement indiquée dans l'info-bulle). Voir Q-B.

### 1.4 Événements « Simuler » liés à ce périmètre (`app.js:36-238`)
Ils révèlent des règles et des cas limites ; chacun écrit mails/alertes/journal :
1. « Un dossier 2 m² fixe arrive après la libération de la semaine » → crée dossier S43, mail Chefs d'équipe 2 m² fixe + Coordination, alerte `APRES_LIBERATION` (serious).
2. « Un visuel arrive après la préparation des trains (déroulant) » (RP34) → nouveau thème sur dossier validé, statut préparation repasse « Préparation reçue », mail chef d'atelier + admins plateforme + coordinateurs, alerte, pas de raccrochage automatique.
3. « Dernière minute sur un train déjà en production » → modif tracée sur le train, alerte `DM_FICHIER` (critical), mail chefs d'équipe déroulant.
4. « Une livraison arrive sans référence de dossier » → crée une réception inconnue (statut `A_IDENTIFIER`, allée tampon `X`, rayon 1-9, feuille TEMPORAIRE).
5. « Une réception complète un visuel manquant » → réception `A_CONTROLER`, affiche IDENTIFIEE avec rattachement proposé `BL`, unités EN_ATTENTE → PRET.
6. « Fin de journée Geodis » (expédition, autre agent) ; 7. « Preuves de livraison Geodis reçues ».
8. « Broadcast change un thème après la validation » ; 9. « Broadcast renvoie les préparations corrigées » (renvoi de préparation : statut `PREPA_RECUE`, `iok` supprimé si trains pas exportés, alerte `APRES_LIBERATION` serious si déjà exporté) ; 10. « Réinitialiser la maquette ».

---

## 2. Composants transverses (valables pour tous les écrans ci-dessous)

Pour ne pas répéter, les écrans renvoient à cette section.

### 2.1 Tableau (`ui.table`, Tabulator)
- Toolbar : recherche texte (masquée si le champ « Dossier » existe ou `search:false`), filtres de la page injectés ici, actions groupées visibles **seulement quand une sélection existe**, compteur « n ligne(s) [sur total] », boutons **Compact/Confort** (32/40 px), **Colonnes (visibles/disponibles)** (cocher, monter/descendre, « Vue par défaut », « Tout afficher » ; vue gardée dans `localStorage` clé `circe-maquette-vues`), **Exporter** (xlsx écrit à la main ; les `exportName` finissent en `.csv` mais le fichier produit est `.xlsx`), **Effacer les filtres des colonnes**.
- Filtre d'en-tête par colonne (texte sans accents/majuscules ; sur colonnes numériques `>10`, `<5`, `>=3`, `=0`).
- Tri sur toutes les colonnes sauf `sortable:false` ; initial sort selon écran. Colonnes redimensionnables et déplaçables. 8 colonnes visibles au maximum par défaut, autres `hidden:true`.
- Lignes teintées (`tone`: critical/serious/warning/info/good). 2 actions de ligne maximum, figées à droite. Sélection par case, actions groupées.
- État vide : texte `o.empty` sinon « Aucune ligne pour ces filtres. ». Pas d'état « chargement » (données locales) ni « erreur » réseau ; seule erreur : alerte « Erreur d'affichage de l'écran » (`core.js:288-291`) si le rendu JS plante.

### 2.2 Filtres (`ui.filters`)
Listes à cocher multi-valeurs (aucune coche = tout ; OU dans un filtre, ET entre filtres), compteurs par valeur tenant compte des autres filtres, mode « smart » (> 8 valeurs : seules valeurs compatibles, lien « Afficher aussi n valeur(s) sans résultat »), 4 filtres visibles au plus + bouton « + Filtre », « Réinitialiser ». Filtre **N° de dossier** (champ combobox : n° de dossier, de DA ou annonceur ; puces ; collage d'une liste ; signalement « Absents de cette page » et « Masqués par <filtre> — Afficher »). Filtre **Départ** (semaines de départ camion ; options `S42 · expédiée`, `S43 · en production`, `S44 · en préparation`, `S45 · à venir`). Filtres posés par un lien (`preset`) appliqués une fois par arrivée (`M.navSeq`).

### 2.3 Autres composants
- Pastille de statut `ui.pill(code)` (rampe bleue 0-5, « x » gris barré pour Annulé) ; badge de gravité `ui.sev(level)` : Critique (rouge, triangle), Important (orange), À surveiller (jaune), OK (vert), Info (azure).
- Bouton « voir le visuel » (icône photo) devant chaque visuel → modale **Visuel** (ECR-REC-12 ci-dessous).
- Cartes `ui.card`, encadrés `ui.callout` (info/warning/critical/good/cible), indicateurs `ui.stat` (cliquables → posent un filtre), annotations `ui.annot` (violettes, masquables).
- Boîte d'envoi des mails simulés (`ui.mailbox`) : modale large, liste inversée, sujet, À, date, déclencheur, besoins, corps.

---

# PARTIE A — MODULE RÉCEPTION (REC)

## ECR-REC-01 — Réception des affiches, étape 1 : arrivée de la palette
- **Fichier source** : `screens/reception.js` (fonctions `tabReception` → `tabArrivee`, 308-639 ; `M.screen` 927-947). Id écran `reception`, vue `?tab=attendues` (valeur par défaut ; `?tab=saisie` est un alias).
- **Accès** : menu Réception › « Réception des affiches » ; liens depuis alertes (`ECART`, `SANS_IP`), bouton « Contrôler la palette » (étape 2 de la même page).
- **Titre / sur-titre** : sur-titre « Réception », titre « Réception des affiches », intro = repère d'étape « 1 · Arrivée de la palette — trouver les dossiers du BL, valider ». Étape 2 sur la même page, voir ECR-REC-02.
- **Structure** (de haut en bas, une seule page, depuis le 21/10) :
  1. En-tête + bouton « Besoins couverts (37) ».
  2. Bandeau « Trouver les dossiers du BL — trois façons, au choix » : carte **Photo du BL** (bouton « Photographier le BL »), carte **Photo d'une affiche** (bouton « Photographier une affiche »), carte **Par n° de dossier** (champ combobox N° de dossier, de DA, annonceur) ; ligne de recours « Rien ne correspond ? » + bouton « Réception inconnue… ».
  3. Annotation violette (explication de l'étape).
  4. Carte **« Réceptions attendues »** (tableau, filtres dans sa ligne d'outils).
  5. Deux cartes côte à côte (`grid side`) : **« Lignes du BL (panier) »** et **« Bon de livraison »**.
  6. Section **étape 2** (ECR-REC-02), en dessous.
- **Tableau « Réceptions attendues »** (`id recep-attendues`, 330 px de hauteur max, sélection par cases, pas de recherche, un seul tri initial absent) : une ligne par thème (visuel) de dossier non annulé, non exclu, hors Bus semaine > 43, dans le site choisi.
  | Colonne | Type déduit | Tri | Format / contenu |
  |---|---|---|---|
  | Site (masquée si un site est choisi) | texte | oui | libellé site |
  | Dossier | texte (6 chiffres) | oui | `dossier.id` (suffixe `-W` pour 2e plateforme) |
  | Annonceur · thème | texte | oui | annonceur en gras, bouton visuel, thème |
  | Départ | texte | oui | `S43` ou `S43+S44` |
  | Reçu / attendu | nombre (ratio) | oui | « 4 / 7 » ; sous la valeur, n° d'affiche(s) déjà reçu(s), cliquables → fiche affiche |
  | Reste | nombre | oui | `max(0, attendu − reçu)` |
  | Statut | enum | oui | pastille : Attendue (bleu clair s-0), Partielle (Important orange), Complète (OK vert), Surplus (À surveiller jaune) |
  | Contrôle | enum | oui | « — » / « À contrôler » (À surveiller) / « Contrôlée » (OK) |
  | Livraison prévue | date | oui | « jeu. 15/10 » ou « Print Cityz » ou « — » |
  | (masquées) DA, Annonceur, Thème, Format, Attendu, Reçu, N° d'affiche | | | |
  Actions de ligne : **Feuille de stock** (si au moins une affiche contrôlée ; icône imprimante) et **Au panier** (ou « ✓ au panier » si déjà présent). Teinte de ligne : Surplus → warning, Partielle → serious.
  Actions groupées : **Ajouter au panier (n)**.
- **Filtres** (`reception-attendues`) :
  | Filtre | Type | Valeurs | Défaut |
  |---|---|---|---|
  | N° de dossier (hors barre, dans le bandeau) | combobox multi | dossiers présents (`aliases`: DA, annonceur) | vide |
  | Statut | liste | Attendue, Partielle, Complète, Surplus | **Attendue + Partielle** |
  | Départ | liste | S42..S45 filtrés ≥ semaine de production (S42) | S42, S43, S44, S45 |
  | Format | liste | formats des lignes | tous |
  | Contrôle (+ Filtre) | liste | À contrôler, Contrôlée (feuille réimprimable), Rien reçu | tous |
  | Annonceur (+ Filtre) | liste | annonceurs | tous |
- **Formulaires** :
  - *Carte « Lignes du BL (panier) »* : tableau (case par ligne + case « tout » avec état indéterminé ; colonnes Dossier, Annonceur · thème [+ champ « Intitulé saisi (sans IP) » si IP non saisies, avec proposition « déjà saisi par <site> (affiche n°), le 1er qui a parlé »], Reste attendu, **Qté du BL** [nombre ≥ 0, par défaut `reste` ou `qteEnt`], **Livraison en deux fois** [case « Complément de l'affiche n° » seulement si le visuel est déjà reçu en partie], bouton « Retirer »). Sous-titre « n cochée(s) sur m pour ce BL… ». Bouton « Vider le panier ». Message vide : « Aucune ligne. Trouvez les dossiers du BL en haut (photo du BL, photo d'une affiche, ou n° de dossier puis « Au panier ») : chaque ligne arrive avec sa case, cochée pour ce BL ; décochez celles d'un autre BL. Rien ne correspond : « Réception inconnue ». »
  - *Carte « Bon de livraison »* : encadré « BL à photographier » (warning, obligatoire, bouton « Photographier le BL ») ou « BL <num> lu par Circé » (good, bouton « Reprendre la photo ») ; encadré warning « n ligne(s) cochée(s) absente(s) du BL photographié » ; champs : *Lignes de ce BL* (lecture : nb lignes et nb affiches), *Date de livraison* (lecture = maintenant), **N° de BL** (texte, **obligatoire**, « BL imprimeur = BL transporteur », pré-rempli par la photo), **Transporteur** (select, **obligatoire**, défaut `Geodis`, valeurs Geodis / Transports Martin / Messagerie Express / Livraison imprimeur), **Imprimeur** (select, **obligatoire**, 6 valeurs), **Nombre de colis / palettes** (nombre ≥ 1, défaut 1), **Déchargé par** (select Contrôleur A à D, **facultatif** — contrairement à REC-12 contrôleur obligatoire au contrôle). Bouton principal **Valider la réception (n ligne[s])**.
- **Actions** :
  | Action | Effet | Suite |
  |---|---|---|
  | Photographier le BL | ouvre modale Photo du BL (ECR-REC-07, mode bl) | modale |
  | Photographier une affiche | modale Photo d'une affiche (mode affiche) | modale |
  | Champ N° de dossier | filtre la liste des attendues | même page |
  | Réception inconnue… | modale ECR-REC-08 | modale |
  | Au panier / Ajouter au panier (n) | ajoute la ligne cochée au panier (refus silencieux si déjà présente) | même page |
  | Feuille de stock (ligne) | modale ECR-REC-09 (avec étiquettes rack) | modale |
  | Clic n° d'affiche | modale fiche affiche ECR-REC-05 | modale |
  | Cocher/décocher, Retirer, Vider le panier, Tout cocher | gère le panier | même page |
  | Valider la réception | voir règles ci-dessous | toast + la palette apparaît dans le sas (ECR-REC-02) |
  | Colonnes / Compact / Exporter / Effacer les filtres | composants §2.1 | |
- **Règles visibles au clic « Valider la réception »** (ordre des contrôles, reception.js:503-509) : (1) panier vide → toast critique « Le panier est vide. » ; (2) aucune ligne cochée → « Cochez dans le panier les lignes de ce BL. » ; (3) lignes de deux plateformes → « Les lignes cochées sont sur deux plateformes : un BL ne livre qu'une plateforme. » ; (4) BL non photographié → « Photographiez le BL avant de valider : il est joint à chaque réception, même quand les lignes viennent de la recherche. » ; (5) n° de BL / transporteur / imprimeur vides → « N° de BL, transporteur et imprimeur sont obligatoires, comme dans Circé. » Si OK : crée une réception (statut `A_CONTROLER`, `photoBL`), une affiche par ligne cochée (statut `IDENTIFIEE`, quantité = quantité du BL, emplacement `Z-tampon`, `enAttenteControle`, rattachement `BL` ou `VISUEL` selon la voie) ou un complément (même n° d'affiche, `qteRecue += q`, réceptions multiples) ; lignes à quantité 0 ignorées ; mouvement de stock `Réception` ou `Réception (complément)` ; recalcul : unités `EN_ATTENTE` complètes → `PRET` ; historique « Rattachement proposé… à confirmer par la Coordination » ; journal ; dossiers re-synchronisés (validation admin). Les lignes cochées quittent le panier, le reste demeure pour le BL suivant ; `bl`, `imprimeur`, `nbColis` remis à zéro ; transporteur et « Déchargé par » conservés. « Affiche reçue = oui » dès l'arrivée (H14, PP-02).
- **Statuts affichés** : voir tableau ci-dessus (Attendue, Partielle, Complète, Surplus ; Contrôle : À contrôler/Contrôlée) ; positions A-D des trains non concernées ici. Seuils : `Complète` si reçu ≥ attendu et ≤ attendu × 1,10 ; `Surplus` si > × 1,10 (le 1,1 est écrit en dur dans `reception.js:39`, alors que `PARAMS.ecartReception` = 0,10 existe) ; `Partielle` si 0 < reçu < attendu ; `Attendue` si reçu = 0.
- **Messages** (toasts, tous en français dans le JS) : « Aucune réception attendue à proposer sur ce site. » ; « Visuel reconnu : 1 ligne au panier ; la photo de l'affiche est jointe à la réception. » / « Ce visuel est déjà au panier. » ; « n ligne(s) du BL au panier, cochées pour ce BL… ; bon de livraison pré-rempli : vérifiez, puis validez la réception. » (+ « Une ligne sans dossier : réception inconnue. ») ; « n ligne(s) ajoutée(s) au panier. » ; confirmation de validation : « Réception R… : n ligne(s), « affiche reçue » = oui dès l'arrivée ; n unité(s) prête(s) à produire. La palette passe à l'étape 2 (contrôle). Validation admin : n rattachement(s) proposé(s) à confirmer, n avec un doute… (Coordination). [Il reste n ligne(s) au panier…] ».
- **États** : vide → messages ci-dessus (panier vide, tableau vide « Aucune ligne pour ces filtres. »). Chargement : absent. Erreur : seulement via toasts critiques de validation ; pas d'erreur réseau/serveur.
- **Données MOCK observées** :
  - Réception : `R` + 6 chiffres (`R260401…` pour le jeu initial, `R260900+` pour celles créées à l'écran) ; BL `BL` + 7 chiffres ; affiche : 6 chiffres `712001…` (jeu initial), `712900+` (créées) ; thème `TH1…` ; dossier 6 chiffres (`910000 + 37×n`), DA 6 chiffres (`470000 + 53×n`) ; transporteurs entrants (4) ; imprimeurs (6, dont « Print Cityz » = imprimeur interne, quantité attendue avec `livraisonPrevue`) ; agents/contrôleurs « Contrôleur A à D ».
  - Une réception regroupe jusqu'à 4 affiches (même site, imprimeur, fenêtre ≤ 5 h) ; 1 à 6 colis.
  - Dossier livré sur 2 plateformes : même `no` Broadcast, deux dossiers (`id` et `id-W`), même DA.
  - Cas limites : dossier sans IP (thème « (IP non saisies) », intitulé libre saisi par la plateforme), surplus (reçu 112-124 % de l'attendu), partiel (50-90 %), manquant (0), visuel commun à 2 dossiers (MISTRAL, répartition à confirmer), dossiers multi-semaines (S43+S44), dossier annulé (masqué), thème exclu `NE_PAS_AFFICHER`/`RESTE_EN_PLACE` (masqué), Bus au-delà de S43 (masqué), ligne de BL au contrat illisible (modale photo BL), 9 « réceptions attendues anciennes » S36-S39 purgées automatiquement sauf 2 en conservation à l'année (hors tableau, juste une ligne au journal).
  - Volumétrie : ~100 dossiers, 1 à 4 thèmes chacun ; une dizaine d'affiches reçues par semaine.
- **Questions** : Q-REC-1 la photo du BL est simulée : quel format de données doit être extrait (OCR) et qui valide ? Q-REC-2 « Déchargé par » est-il obligatoire (la maquette ne l'impose pas, le code existant le laissait libre) ? Q-REC-3 le seuil Surplus est-il bien le paramètre `ecartReception` (10 %) ? Q-REC-4 règle de purge (4 semaines, conservation à l'année) : quelle clé de conservation ? Q-REC-5 que devient une quantité du BL à 0 (ligne ignorée sans message) ? Q-REC-6 gestion des BL multi-plateformes (refusés) : même règle pour Wissous/Nîmes déjà à plat ?

## ECR-REC-02 — Réception des affiches, étape 2 : contrôle des affiches (sas + contrôle de palette)
- **Fichier source** : `reception.js:641-768` (`sasPalettes`, `controlePalette`). Même page physique que ECR-REC-01, sous le panier et le bon de livraison ; atteignable en ancre `?tab=controle&id=<réception>`.
- **Accès** : même entrée de menu ; clic sur une ligne du sas ou « Contrôler » ; alertes `CONTROLE_RETARD` et `FEUILLE_DEFINITIVE` (lien `tab=controle&id=`) ; bouton « Contrôler la palette » des fiches affiche/réception ; depuis ECR-REC-04 « Valider et imprimer dans Réception des affiches ».
- **Structure** : titre d'étape « 2 · Contrôle des affiches — n palette(s) à contrôler [, dont k en retard] » ; annotation ; encadré warning si palettes au-delà du délai ; carte **« Palettes à contrôler (sas) »** (tableau) ; en dessous, si une réception est ouverte, bloc **« Contrôle de la palette · réception R… »** (ou « Contrôle et feuille définitive · réception… » pour une réception inconnue rattachée).
- **Tableau du sas** (`recep-acontroler`, 300 px, ordre = plus ancienne en tête) : Colonnes : En attente depuis (durée : « 35 min », « 7 h », « 2 j 3 h » ; pastille Important/À surveiller si dépassement), Réception (+ tag « réception inconnue »), Arrivée (jj/mm hh:mm), Site (masqué si site filtré), BL, Imprimeur, Affiches (nb lignes), Qté du BL, Déchargé par. Action de ligne : **Contrôler** (ou « ouverte ci-dessous »). Clic de ligne = ouvre le contrôle. Teinte : ouverte → info ; attente > 2×délai → serious ; > délai → warning. Vide : « Aucune palette à contrôler : le sas est vide. »
- **Paramètres** : `delaiControle` = 24 h (alerte), `comptageMorceau` = 30 (comptage par morceau sous 30 affiches ; « 4 morceaux par affiche » pour les 8 m²), `exemplairesFeuille` = 2, `alleeInconnues` = `X`, `ecartReception` = 10 %.
- **Formulaire de contrôle** (une ligne par ligne de BL de la palette) :
  | Champ | Obligatoire | Type | Remarques |
  |---|---|---|---|
  | N° affiche | — | lecture | tag « complément » si complément |
  | Visuel | — | lecture | annonceur, thème, dossier, format ; ou « annonceur · libellé saisi » + tag « orpheline » |
  | Qté du BL (ou « Qté saisie » pour réception inconnue) | — | lecture | |
  | Qté comptée | oui implicite | nombre ≥ 0 | défaut = quantité du BL ; badge « ±n par rapport au BL (ou à la saisie) » ; **Important (orange)** si écart > 10 % de la quantité du BL, sinon Info ; ligne teintée serious |
  | Allée | **oui** | texte | vide tant que l'affiche est en zone tampon (`Z` ou `X`) ; majuscules ; placeholder « A-F » ; pour réception inconnue affiche « aujourd'hui X-3 » |
  | Rayon | **oui** | texte | placeholder « 1-12 » |
  | Rebut | non | nombre ≥ 0 | |
  | Non-conformité | non | select | Conforme / Visuel non conforme / Quantité / Affiche abîmée / Bandeau manquant / Autre ; texte « à ouvrir dans l'appli Process Métier (lien à cadrer) » |
  | Surplus | non | case | n'apparaît que si compter ces quantités dépasserait l'attendu entretien compris : « +n en entretien » (cas des CG, FIX-09) |
  Hors tableau : **Imprimeur** (select, seulement pour réception inconnue : à corriger), **Contrôleur (obligatoire)** (select Contrôleur A à D), bouton principal **Valider le contrôle et imprimer** (ou « Valider le contrôle et imprimer la feuille définitive »), bouton « Fermer le contrôle » (retour au sas), « Voir le BL » (modale), tags (site, BL, imprimeur, colis, Déchargée par), pastille À contrôler (warning) / Contrôlée (good, avec date et contrôleur).
- **Règles / effets du bouton Valider** (`valider`, 693-724) : contrôleur obligatoire (« Le nom du contrôleur est obligatoire (REC-12). ») ; allée et rayon obligatoires pour chaque affiche (« Allée et rayon sont obligatoires pour chaque affiche. ») ; différence comptée/BL ≠ 0 → ajuste `qteRecue` et crée un mouvement « Contrôle (écart au BL) » ; rebut → mouvement « Mise au rebut » (qté négative, motif = non-conformité) ; non-conformité → historique ; surplus → `surplusEntretien` ; l'affiche sort du sas (`enAttenteControle=false`, contrôleur nommé) ; réception → `CONTROLEE` ; recalcul des unités ; ouverture de l'aperçu d'impression (ECR-REC-09) avec étiquettes rack.
- **Après contrôle** : bouton « Imprimer la feuille définitive » (primaire, si une feuille temporaire est encore posée) ou « Réimprimer les feuilles de stock ».
- **Statuts** : réception `A_CONTROLER` (pastille « Palette à contrôler »), `CONTROLEE` (« Contrôlée ») ; `A_IDENTIFIER` n'entre pas dans le sas.
- **Messages** : toasts « Le nom du contrôleur est obligatoire (REC-12). », « Allée et rayon sont obligatoires pour chaque affiche. » ; encadré « n palette(s) dans le sas depuis plus de 24 h — À contrôler en premier : elles sont en tête de liste. » ; texte « Comptage par morceau (4 morceaux par affiche) » si compté < 30.
- **États** : vide du sas = message ci-dessus ; contrôle déjà fait = champs en lecture seule ; pas de chargement/erreur.
- **Données MOCK observées** : la dernière réception identifiée de chaque plateforme est `A_CONTROLER` en `Z-tampon` (2 palettes) ; les autres sont `CONTROLEE` avec contrôleur `Contrôleur A-D`, allée A-F, rayon 1-12 ; une alerte « Palette à contrôler depuis plus de 24 h » possible selon l'âge. Écarts de comptage non présents dans les données initiales (créés à l'usage).
- **Questions** : Q-REC-7 « non-conformité » : lien réel avec « Process Métier » à cadrer, rien ne part aujourd'hui ; Q-REC-8 le comptage par morceau est-il un simple libellé (aucun calcul) ? Q-REC-9 le contrôleur choisi est-il lié à l'utilisateur connecté ? Q-REC-10 « 3 exemplaires » cités le 19/10 vs 2 paramétré : valeur cible ? Q-REC-11 qui peut corriger les quantités du BL a posteriori ?

## ECR-REC-03 — Liste des affiches
- **Fichier source** : `reception.js:830-925` (`tabAffiches`) ; écran `reception`, vue `?tab=affiches`.
- **Accès** : menu Réception › « Liste des affiches » ; liens d'alertes (`ECART`, `SANS_IP` avec `q=`, `THEME_MODIF` avec `tag=refaire`) ; `?recent=1` (affiches des dernières 24 h).
- **Structure** : en-tête (« Réception » / « Liste des affiches » + sous-titre « Ce qu'on a reçu : chaque affiche, avec sa réception, son emplacement, son stock et ses tags. Feuilles de stock et étiquettes rack en lot. ») ; annotation ; carte tableau avec filtres dans la ligne d'outils.
- **Tableau** (`recep-affiches`, tri initial `date` décroissant, sélection par cases, clic de ligne = fiche affiche) :
  | Colonne | Type | Format |
  |---|---|---|
  | N° affiche | texte (6 chiffres) | |
  | Reçue le | date-heure | jj/mm hh:mm |
  | Annonceur · thème | texte | avec bouton visuel ; pour une affiche orpheline : texte saisi |
  | Dossier(s) | texte | liste ; tag « n dossiers » si > 1 |
  | Départ | texte | `S43+S44` ; tag « multi-semaines » |
  | En stock | nombre | stock disponible (somme des mouvements) ; **badge Important « n rebut »** si rebut |
  | Emplacement | texte | `A-3` (+ site si « Tous les sites ») |
  | Statut · tags | enum | pastille (Identifiée / Orpheline) + tags : « À contrôler » (À surveiller), « Complément » (tag jaune), « Feuille à refaire » / « Feuille définitive à imprimer » (À surveiller, info-bulle ancien/nouveau intitulé) ; le tag « Orpheline » n'a pas de badge (la pastille le dit) |
  | (masquées) Réception (lien → ECR-REC-06), Site, Annonceur, Thème, Format, Imprimeur, Reçu, Rebut, Contrôleur, Feuille de stock (Temporaire : définitive à imprimer / Temporaire / Définitive) |
  Teinte : orpheline → warning ; rebut → serious.
- **Filtres** (`reception-affiches`) : N° de dossier ; Départ (défaut = aucune semaine, `matchEmpty` : les affiches sans semaine restent visibles) ; Tag (À contrôler, Orpheline, Complément, Feuille à refaire) ; Format ; Imprimeur (+ Filtre). Un lien pose `tag`.
- **Actions groupées** (sélection) : **Réimprimer les feuilles à refaire (n)** (si au moins une sélectionnée a le tag) → `refaireFeuilles` (modale « Ranger avant d'imprimer » ECR-REC-10 si des affiches sont encore en zone tampon `X`, sinon directement l'aperçu ECR-REC-09) ; **Imprimer les feuilles de stock** (aperçu ECR-REC-09) ; **Étiquettes rack** (toast « n étiquette(s) rack imprimée(s) en un clic. », journal).
- **Statuts affichés** : Identifiée (rampe 4), Orpheline (rampe 0) ; tags ci-dessus. Définitions (`reception.js:833-843`) : `controle` = palette pas encore contrôlée ; `orpheline` = sans dossier ; `complement` = affiche reçue en plusieurs réceptions ; `refaire` = thème modifié après identification et feuille non réimprimée, ou feuille temporaire sur affiche rattachée.
- **Messages / États** : vide = « Aucune ligne pour ces filtres. » ; pas de chargement/erreur.
- **Données MOCK observées** : ~60 à 90 affiches ; 4 orphelines initiales (2 à Wissous, 1 à Nîmes, 1 « Illisible sur le BL » sans BL) en allée `X`, feuille TEMPORAIRE ; 2 affiches `themeModif` (feuille à refaire, intitulé ancien en majuscules → nouveau) ; rebuts sur 1 affiche sur 9 parmi les 60 premières (1 à 3, motif « Affiche déchirée ») ; affiches S42 en stock marquées « à conserver ».
- **Questions** : Q-REC-12 la liste n'a pas d'action de création (hors Réception) : confirmer qu'elle est en lecture + impression ; Q-REC-13 « étiquettes rack » : sortie réelle (PDF/impression) non décrite ; Q-REC-14 le tag « Complément » vient du nombre de réceptions, y a-t-il un statut explicite ?

## ECR-REC-04 — Réceptions inconnues
- **Fichier source** : `screens/identification.js` (1-244). Id `identification` (ex « Orphelines à identifier »).
- **Accès** : menu Réception › « Réceptions inconnues » (badge rouge = nb affiches `ORPHELINE` dans le périmètre) ; alertes `ORPHELINE` / `DOSSIER_INTROUVABLE` (lien `?id=<affiche>`) ; toast de création d'une réception inconnue.
- **Structure** : en-tête + sous-titre ; annotation ; barre de filtres ; carte tableau ; zone détail sous le tableau (affiche choisie) dont le contenu dépend du statut de la ligne choisie.
- **Tableau** (`inconnues`, clic de ligne = choisit l'affiche ; action de ligne « Fiche » → ECR-REC-05) :
  | Colonne | Type | Format |
  |---|---|---|
  | N° affiche | texte | |
  | Lu sur l'affiche | texte | « annonceur · description » saisis à la réception |
  | Site | texte | masqué si site filtré |
  | Qté | nombre | |
  | Reçue le | date-heure | |
  | En attente depuis | durée | « 7 h », « 2 j 3 h » ; Important si > 24 h ; « — » si rattachée |
  | Statut | enum (5) | voir ci-dessous |
  | Dossier(s) | texte | « — » si aucun |
  | Emplacement | texte | `X-3` (zone tampon) puis définitif |
  | (masquées) Format, Imprimeur, Feuille de stock |
  Teinte : ligne choisie → info ; « À identifier » > 24 h → serious.
- **Filtre** : Statut (stable) avec défaut **À identifier + Introuvable + Rattachée, à contrôler + Contrôlée, feuille définitive à imprimer** (les « Rattachée, feuille définitive » sont masquées par défaut).
- **Statuts** (`STATUT`, identification.js:14-18) : « À identifier » (À surveiller) ; « Introuvable : alerte à la Coordination » (Important, ajoute « le jj/mm hh:mm ») ; « Rattachée, à contrôler » (À surveiller) ; « Contrôlée, feuille définitive à imprimer » (À surveiller) ; « Rattachée, feuille définitive » (OK).
- **Détail selon statut** :
  - *À identifier / Signalée* : carte « Affiche n° · à identifier » (photo fictive prise à la réception, annonceur lu, description saisie, quantité · format, imprimeur · emplacement (« zone tampon »), encadrés : « Visuel reconnu (xx %) — Rattachement proposé directement : il reste à confirmer » si score ≥ 0,9 ; « Plusieurs visuels possibles » si ≥ 0,6 ; « Pas de visuel proche » sinon ; encadré « Signalée à la Coordination le … ») ; bandeau **« Trouver le dossier »** à 2 voies : **Par le visuel** (score = 0,45×texte + 0,55×visuel simulé ; bouton « Voir les visuels proposés (n) », 4 candidats max) et **Par n° de dossier** (champ texte : n° de dossier, DA, annonceur, thème ; 8 résultats max, minimum 2 caractères) ; la voie par défaut est « visuel » si score ≥ 0,6 sinon « dossier » ; ligne de recours **« Personne ne retrouve le dossier ? »** + bouton **Signaler à la Coordination (alerte)** (ou badge « Alerte « Dossier introuvable » mise le … pour … »). Liste de candidats : case, vignette, annonceur · « thème » (ou « IP non saisies »), « Dossier n° · DA n° · atelier · départ · attendu x, reste y », score (« 93 % — texte 80 % · visuel 98 % »), champ **Qté** (nombre ≥ 1, défaut min(quantité reçue, attendu)) ; plusieurs dossiers cochables (répartition) ; pré-coche automatique si score ≥ 0,9. Boutons : « Fiche de l'affiche » (ghost), **Rattacher** (primaire).
  - *Rattachée, à contrôler* : carte avec récapitulatif des dossiers/quantités, bouton « Modifier le rattachement ou le thème » (fiche affiche), encadré « Palette R… dans le sas de contrôle », bouton **Valider et imprimer dans Réception des affiches** (→ ECR-REC-02 avec `id`).
  - *Contrôlée, feuille définitive à imprimer* : bouton **Imprimer dans Réception des affiches**.
  - *Rattachée, feuille définitive* : « Ouvrir la fiche de l'affiche » et « Réimprimer la feuille définitive ».
- **Règles de Rattacher** (`rattacher`, identification.js:55-83) : au moins un dossier et une quantité > 0 (« Choisissez au moins un dossier et une quantité. ») ; total ≤ quantité reçue (« La répartition (n) dépasse la quantité reçue (m). ») ; l'affiche devient `IDENTIFIEE` (`inconnue=true`, `rattacheeLe`), répartie sur 1..n thèmes (plusieurs semaines possibles) ; annonceur remplacé par celui du dossier, libellé remplacé seulement si IP saisies (« le 1er qui a parlé » sinon) ; **rôle Coordination → validation admin faite** ; autre rôle → reste proposée (`rattache='MAIN'`, motif « rattachée sans le n° du BL ») ; la réception passe `A_CONTROLER` (`aControlerDepuis`), entre dans le sas ; recalcul des unités.
- **Messages** : toast de rattachement « Affiche n° rattachée. n unité(s) passent « Prêt ». La palette R… passe dans le sas de Réception des affiches : la réception valide le contrôle et imprime la feuille définitive. » ; toast de signalement « Alerte « Dossier introuvable » mise pour <destinataire>. Une fois l'affiche rattachée, la palette passe à l'étape 2… ». Destinataire : `Coordination <site>`, ou « Coordination (équipe Coord. Réception, Boulogne) » pour Wissous (à confirmer, Q61 de la maquette).
- **États** : vide du tableau « Aucune réception inconnue avec ce statut. » ; zone détail vide « Aucune réception inconnue : utilisez « Simuler » (en haut) pour en créer une. » ; listes de candidats vides : « Aucun visuel proche : cherchez par n° de dossier. » / « Aucun dossier pour « q » sur ce site. » / « Tapez un n° de dossier, de DA, un annonceur ou un thème. » Pas de chargement/erreur.
- **Données MOCK** : 4 affiches orphelines (cf. ECR-REC-03) avec annonceurs « flous » générés (majuscules, pluriel retiré, deux premiers mots, « Illisible sur le BL »), libellés déformés (minuscules, premier mot + « … », « visuel … », « affiche bleue, logo en bas à droite ») ; chacune porte un `verite` (thème réel) servant au score ; candidats restreints au même site, semaine ≥ 43, IP saisies, reste > 0.
- **Questions** : Q-REC-15 les scores sont fabriqués : quel moteur de reconnaissance visuelle, quelles données ? Q-REC-16 destinataire de l'alerte « Dossier introuvable » (Coordination Nîmes vs « Pré-Prod Nîmes » des decks) à confirmer (Q61 maquette) ; Q-REC-17 délai d'alerte d'une orpheline : 24 h ici (sévérité Important au-delà) ; Q-REC-18 une affiche peut-elle être rattachée par l'agent de réception sans validation de la Coordination ? (oui, elle reste « à confirmer ») ; Q-REC-19 fusion d'affiches : hors maquette.

## ECR-REC-05 — Fiche affiche (modale « Affiche n° », 4 onglets)
- **Fichier source** : `reception.js:176-293` (`ui.afficheModal`). Modale large.
- **Accès** : clic sur une ligne de la Liste des affiches (ECR-REC-03) ; clic sur un n° d'affiche (ECR-REC-01, 06) ; bouton « Fiche » (ECR-REC-04) ; autres écrans (suivi, stock) via `ui.afficheModal`.
- **Onglets** (composant `ui.tabs`, dans une modale : exception à la règle « pas d'onglets dans les pages ») : **Détail**, **Mouvements**, **Préparations** (compteur = nb de lignes d'allocation), **Historique**.
- **Détail** : *Réception(s)* (lien « R… du jj/mm hh:mm (ouvrir) » → ECR-REC-06 ; « livraison en n fois » si complément) ; *Annonceur saisi* (texte modifiable) ; *Thème saisi* (texte modifiable) ; *Imprimeur* (select 6 valeurs) ; encadré warning « Palette à contrôler — Quantité du BL, en zone tampon : le comptage et l'emplacement se saisissent au contrôle » + bouton **Contrôler la palette** (→ ECR-REC-02) si en attente ; *Allée* et *Rayon* (texte) ; *Quantité reçue* (lecture) ; *Stock disponible* (lecture) ; *Feuille de stock* (« définitive » / « temporaire (réception inconnue) » / « temporaire posée : imprimer la définitive ») ; *Entretien reçu en plus* (si surplus) ; case **Affiche à conserver (reliquat d'entretien)** ; bloc **Validation admin** (voir ci-dessous).
- **Bloc Validation admin** : pastille selon l'état (`C.vaEtat`) : « Validée par <user>, le … » (OK) ; « À confirmer par la Coordination » (Info) ; « À confirmer par la Coordination : doute » (À surveiller) ; « Réception inconnue : à rattacher d'abord (Réceptions inconnues) » (Important) ; texte « Rattachement proposé au dossier n · « thème » · doute : <motifs> » ; bouton **Valider** (primaire si « sans doute ») ou **Annuler la validation** (ghost) pour `coord`/`admin` ; sinon texte « Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation admin et Instruction OK, sans attendre la préparation. »
- **Mouvements** : tableau Date, Mouvement (type + motif), Quantité (signée), Par, Auto. Types observés : Réception, Réception (complément), Contrôle (écart au BL), Mise au rebut, sorties d'expédition automatiques.
- **Préparations** : annotation (ANO-12 : une affiche peut servir plusieurs dossiers/semaines, sans limite) ; tableau Dossier, Annonceur, Thème, Départ, Quantité + actions **Changer de thème…** (select des autres thèmes du même dossier ; vaut validation seulement si `coord` ; sinon repasse « à confirmer » ; pose « Feuille à refaire ») et **Retirer** (si plus aucune ligne → l'affiche redevient `ORPHELINE` et la réception inconnue `A_IDENTIFIER`) ; bouton **+ Rattacher à un autre dossier** → panneau de recherche (n° de dossier, DA, annonceur, thème ; propositions par défaut = même annonceur, 6 max, triées par reste décroissant ; par ligne : champ **Qté** ≥ 1 et bouton **Rattacher**). Refus « Indiquez la quantité pour ce dossier. » si quantité 0. Rattachement : l'affiche orpheline devient `IDENTIFIEE`, la palette passe `A_CONTROLER`.
- **Historique** : frise des entrées `historique` + `journal` de l'objet, triées par date (« date · action · utilisateur »).
- **Boutons de bas de modale** : Fermer, **Imprimer la feuille de stock** (ECR-REC-09), **Enregistrer** (primaire, note « Fiche affiche modifiée » dans l'historique ; les champs texte s'enregistrent déjà au changement).
- **Messages** : toasts « Affiche n° rattachée au dossier n : feuille de stock à refaire (tag « Feuille à refaire »)[ ; validation admin faite.| ; la Coordination confirmera la validation admin.] » ; « Thème corrigé : feuille de stock à refaire. ».
- **Questions** : Q-REC-20 « Enregistrer » ne valide rien (modifs immédiates) : confirmer le comportement cible ; Q-REC-21 modifier annonceur/thème saisis ne pose pas « Feuille à refaire » alors que Changer de thème le fait ; Q-REC-22 droits sur « Retirer ».

## ECR-REC-06 — Fiche réception (modale « Réception R… »)
- **Fichier source** : `reception.js:294-306` (`ui.receptionModal`).
- **Accès** : lien « Réception » de la fiche affiche ou colonne masquée « Réception » de ECR-REC-03.
- **Contenu** : pastille (Palette à contrôler / À identifier par la Coordination (zone tampon) / Contrôlée), tags « Réception inconnue », « Photo du BL jointe » ou « Scan du BL joint (simulation) » ; champs lecture : Date, BL, Transporteur, Imprimeur, Colis / palettes, Déchargé par, Contrôlé par ; tableau des lignes du BL (N° affiche [+ tag complément], Annonceur, Thème, Qté du BL, Qté reçue, Emplacement, Statut) ; clic de ligne → fiche affiche. Boutons : Fermer, **Contrôler la palette** (si à contrôler).
- **Questions** : Q-REC-23 aucune action d'édition de l'en-tête de réception (date modifiable, références, commentaire, pièces jointes de Circé existant, README §7) : conservées ou supprimées ?

## ECR-REC-07 — Modale « Photo du BL » / « Photo d'une affiche »
- **Fichier source** : `reception.js:309-444` (`photo`, `blFictif`, `rendreBL`, `candidats`, `afficheFictive`).
- **Accès** : boutons de l'étape 1 ; « Photographier le BL » / « Reprendre la photo » dans le bon de livraison (mode « joindre »).
- **Mode BL** (large) : à gauche rendu d'un BL fictif « BON DE COLLECTE » (imprimeur, n° `BL26xxxxx`, date, transporteur, colis, adresse de livraison « Plateforme Cityz Media <site> », tableau Contrat `<dossier> VV`, Article `ART-nnnnn`, Format (code `FIX2M`/`SCR2M`/`MUI2M`/`COL4M`…), Annonceur « S43 NOM EN MAJUSCULES », Thème `VIS_<SLUG>_<id>.pdf`, Qté cerclée, vignette) ; à droite par ligne : pastille « Contrat n lu » (OK) ou « Contrat illisible » (À surveiller) ; si lu : case « Dossier n · annonceur · « thème » (reste x) : correspondance sûre / déjà au panier » ; sinon boutons radio de ≤ 3 candidats notés (score = 0,5 même annonceur + 0,2 même semaine + 0,1 même format + 0,15 vignette ; seuil ≥ 0,3) + « Aucun : réception inconnue ». Bouton **Mettre au panier** (ou **Joindre le BL** en mode joindre) / Annuler.
- **Mode affiche** : vignette fictive de l'affiche + « Visuels reconnus » (radios : jusqu'à 3 dossiers, scores 93 % / 58 % / 31 % fictifs) + « Aucun : réception inconnue » ; champ **Quantité sur la palette** (nombre ≥ 0, défaut = reste du dossier reconnu).
- **Effets** : lignes mises au panier (voie `BL` si contrat lu et choisi, `VISUEL` sinon), autres lignes du panier décochées, formulaire BL pré-rempli, `R.bl` mémorisé ; ligne « Aucun » → ouvre ECR-REC-08 pré-rempli. Refus : « Cochez dans le panier les lignes de ce BL. » (mode joindre sans ligne cochée) ou « Aucune réception attendue à proposer sur ce site. ».
- **Statuts / cas limites illustrés** : 3 lignes dont la 3e a un contrat illisible ; vignettes ; BL fictif construit à partir des 3 premières lignes restantes de la plateforme (Wissous si site = WIS, sinon Nîmes).
- **Questions** : Q-REC-24 modèle réel de BL imprimeur (champs lus) ; Q-REC-25 seuil de proposition 0,3 / validation automatique 0,9 : valeurs cibles ?

## ECR-REC-08 — Modale « Réception inconnue » (création)
- **Fichier source** : `reception.js:771-828` (`orphelineForm`).
- **Accès** : bouton « Réception inconnue… » (ECR-REC-01) ; ligne « Aucun : réception inconnue » des modales photo.
- **Champs** : Site (select Nîmes/Wissous, défaut selon site choisi), Format (select, tous formats d'ateliers), **Annonceur lu sur l'affiche** (texte ; déclenche des suggestions d'intitulés déjà saisis par l'autre plateforme dès 3 caractères), **Thème ou description** (texte + boutons de suggestion « « lib » (site, n° affiche) »), Imprimeur (select), **Quantité comptée** (nombre ≥ 1, défaut 20, **obligatoire > 0**), **Allée (zone tampon des réceptions inconnues)** (texte, défaut `X`, **obligatoire**), **Rayon (obligatoire)** (texte, placeholder 1-12), Photo de l'affiche (bouton simulé « Prendre une photo (simulation) »), Photo du BL (« Photographier le BL » ou « BL … photographié, joint » ; « à joindre dans tous les cas, sauf palette arrivée sans BL »). Bouton primaire **Créer, ranger et imprimer la feuille temporaire**.
- **Règles** : allée et rayon obligatoires (« Allée et rayon sont obligatoires : ils sont imprimés sur la feuille temporaire. ») ; quantité > 0 (« Indiquez la quantité comptée. ») ; crée réception (`A_IDENTIFIER`, `orpheline`, BL `—` si pas de BL, transporteur « Livraison imprimeur » par défaut) et affiche `ORPHELINE` (feuille TEMPORAIRE), mouvement Réception, alerte `ORPHELINE` à la Coordination ; ouvre l'aperçu d'impression temporaire (ECR-REC-09).
- **Message** : « Réception inconnue R… : affiche n rangée en X-n. La Coordination est prévenue (Pilotage › Alertes). »
- **Questions** : Q-REC-26 l'annotation cite « 62 % des réceptions en 2024 » sans BL ni DA : volumétrie cible ; Q-REC-27 le format listé n'est pas lié au dossier inconnu.

## ECR-REC-09 — Aperçu avant impression des feuilles de stock (modale)
- **Fichier source** : `reception.js:94-174` (`ui.feuilleStock`, `ui.printFeuilles`).
- **Accès** : après un contrôle, « Feuille de stock » d'une ligne attendue, actions groupées de ECR-REC-03, « Imprimer la feuille de stock » de ECR-REC-05, création d'une réception inconnue, réimpression en lot.
- **Contenu** : n feuilles A4 reproduisant `Reports/EtiquetteRackAffiche.rdlc` : bandeau « FEUILLE DE STOCK DÉFINITIVE » / « TEMPORAIRE » (+ « Dossier identifié : n » ou « Réception inconnue · rangée en zone tampon · à remplacer par la feuille définitive… »), n° d'affiche (72 pt), format (36 pt), cadre « Date Réception / Adressage (allée - rayon) / Quantité / code `A-` + n° sur 13 chiffres + code-barres factice », corps (Dossier, Semaines, Annonceur, Thème, Repiquage, Commentaire, « Affiche à conserver : Oui/Non », semaine en 48 pt, tableau Dossier / Thème / Annonceur / Format / Départ « S43 /2026 » / Qté prépa. / numéro de demande = DA), pied « Page 1/1 » ; fond jaune si dossier multi-semaines (REC-13). Résumé « n feuille(s) : x définitive(s), y temporaire(s) ». Boutons : Annuler, **Imprimer (2 exemplaires)** ou **Imprimer (2 exemplaires) et les étiquettes rack**.
- **Effets de l'impression** : `feuilleImprimee` = type, historique, lève « Feuille à refaire », applique le nouvel intitulé si changement de thème, toast « n feuille(s) (… ) [et n étiquette(s) rack] envoyées à l'imprimante (simulation). ».
- **Questions** : Q-REC-28 impression PDF côté navigateur (CLAUDE.md) : rendu fidèle au rdlc ? Q-REC-29 nombre d'exemplaires (2 / 3).

## ECR-REC-10 — Modale « Ranger avant d'imprimer »
- **Fichier source** : `reception.js:847-869`. Accès : action groupée « Réimprimer les feuilles à refaire (n) » si des affiches sont encore en allée `X`.
- **Contenu** : tableau N° affiche, Visuel, Aujourd'hui, **Allée**, **Rayon** (textes facultatifs : vide = reste en zone tampon) ; boutons Annuler / **Ranger et voir les feuilles**. Met à jour l'emplacement (historique « Rangée : X-3 → B-7 (sortie de la zone tampon) ») puis ouvre ECR-REC-09.

## ECR-REC-11 — Modale « BL <n> · réception R… » (voir le BL)
- `reception.js:446-449`. Lecture : « Photo du BL prise à l'arrivée… (simulation) », imprimeur, transporteur, nombre de lignes. Accessible depuis le contrôle (« Voir le BL »).

## ECR-REC-12 — Modale « Visuel » (commune à tous les écrans)
- `ui.js:531-554`. Affiche en grand (vignette colorée fictive), lignes : Dossier (DA), Atelier · site, Format, Départ, Position dans le train (déroulant, avec « campagne contrôlée, en tête »), Repiquage, Reçu / attendu, N° d'affiche (`n (allée-rayon)` ou « pas encore reçue »), Exclusion (reste en place / ne pas afficher), Préparation (pastille). Aperçu fictif : en cible, visuel de Broadcast ou photo de réception.

### Écran REC : synthèse des questions transverses
Q-REC-30 Le « n° de panneau Broadcast », le rôle de `com` (lecture seule) et la matrice droits/écrans ne sont pas définis côté serveur. Q-REC-31 Les écrans 01 et 02 sont deux étapes d'une même page physique : la cible doit-elle les séparer (deux routes) ou garder une page (décision du 21/10 vs 19/10 dans l'historique du README) ?

---

# PARTIE B — MODULE COORDINATION (COO)

## ECR-COO-01 — Validation admin et Instruction OK (aussi « Liste des instructions » du Déroulant)
- **Fichier source** : `screens/instructions.js` (1-313). Id `instructions`. Deux entrées de menu : Pré-production › « Validation admin et Instruction OK » (tous ateliers) et Déroulant › « Liste des instructions » (`?pour=deroulant`, titre et sur-titre changés ; idem `?pour=fixe|pliage|bus`, non reliés au menu).
- **Accès** : menu ; alertes `IP_MANQUANTES`, `ECART_BC` (lien `?q=`), `VALIDATION_ADMIN` (lien `?statut=TOUS&q=`), `APRES_LIBERATION` ; callout de Liste des trains « Voir les dossiers » (`?pour=deroulant`) ; liens `?statut=ECART|TOUS|A_TRAITER|PREPA_RECUE`, `?iok=A_FAIRE`, `?va=A_FAIRE`.
- **Structure** : en-tête (sur-titre « Pré-production · tous les ateliers » ou « Déroulant ») ; encadré info « **Aucune validation sans vous : Circé propose, vous confirmez** » ; annotation « Dernières minutes (Q60) » (déroulant ou tous) ; barre de filtres (avec rappel « Deadline Pré-Prod (envoi de la prépa) : jeudi S-2 16h (S44 : jeu. 29/10) ») ; tableau.
- **Tableau** (`instructions`, sélection par cases ; **pré-sélection** des « cas sûrs » à l'arrivée si rôle coord/admin ; clic de ligne = fiche dossier ECR-COO-02) — une ligne par dossier (hors Bus > S43 non applicable ; périmètre : site choisi, toutes semaines) :
  | Colonne | Type | Format / contenu |
  |---|---|---|
  | Dossier | texte (6 chiffres) | |
  | Annonceur | texte | |
  | Atelier | texte | « 2 m² déroulant · Nîmes » |
  | Départ | texte | S43, S43+S44 |
  | Validation admin | enum | pastille : « À confirmer (n)[, dont k doute(s)] » (Info, ou À surveiller si doutes), « Validée » (OK), « Aucune affiche reçue » (Info), « — » (annulé) |
  | Préparation | enum | « Pas encore envoyée · deadline jeu. 15/10 16h » (Info ; **Critique** si deadline dépassée), « Reçue le … » (OK), « Annulé » |
  | Instruction OK (masquée si filtre Préparation = À traiter) | enum | « Instruction ok · automatique » (OK), « En cours · commentaire ou écart » (À surveiller), « Instruction ok · après contrôle » (OK), « À traiter · prépa pas reçue » (Info), « — » (fixe/pliage/bus) |
  | IP (affichée seulement si filtre Préparation = À traiter) | enum | « Saisies » / « Non saisies » (Important) |
  | Écart BC / Circé | nombre | `qte BC − qte Circé` signé, pastille Critique si ≠ 0 |
  | (masquées) Visuels (nb + pastilles « thème proche » À surveiller, « modifié dans BC » Important), Deadline, Affiches reçues, DA, Site, Format, Pôle, Commentaire de prépa, Qté Broadcast, Qté Circé, Entretien %, Contrôlée, Modif. après envoi |
  Teinte : écart BC ou deadline dépassée → critical ; « à faire » → warning ; validation faite → good ; préparation reçue → info.
- **Filtres** : N° de dossier ; Départ (S42 et suivantes) ; Atelier ; **À faire (Coordination)** (stable, **défaut : Validation admin à confirmer + Instruction OK en cours + Écart Broadcast / Circé** ; autre valeur « Rien à faire ») ; Validation admin (À confirmer, Validée, Aucune affiche reçue) ; Instruction OK (5 valeurs) ; Préparation (clé `statut` : Pas encore envoyée (À traiter) / Reçue / Annulé) ; + Filtre : Écart BC / Circé (oui/non), Thèmes à vérifier (oui/non), Format, Pôle (Pôle Direct / Pôle Intermédié), Annonceur. Presets par lien (`statut`, `iok`, `va`).
- **Actions** :
  | Action | Effet | Suite |
  |---|---|---|
  | Clic ligne | ouvre ECR-COO-02 | modale |
  | **Valider la sélection** (action groupée, primaire, désactivée hors coord/admin avec info-bulle) | confirme la validation admin de toutes les affiches « à confirmer » (proposées ou à doute) des dossiers cochés ; si des doutes sont inclus → modale ECR-COO-03 ; sinon confirmation directe | toast « n affiche(s) confirmée(s) par la Coordination : n° d'affiche dans le suivi de prod, picking et étiquette rack débloqués, Broadcast informé. » |
  | **Instruction OK (après contrôle)** (action groupée, si une ligne « En cours ») | pose `iok` (utilisateur/date) sur les dossiers « En cours » | toast « n dossier(s) en Instruction OK : Circé répartit les visuels sur les trains et crée l'entretien. Les trains partent à l'export du jeudi 14 h (Liste des trains). » |
  | **Cocher les cas sûrs (n)** (barre d'outils, coord/admin) | coche les dossiers dont il ne reste que des rattachements proposés sans doute | même page |
  | Colonnes / Compact / Exporter | §2.1 | |
  Refus : « Rien à valider : les dossiers choisis n'ont aucune affiche à confirmer (validation admin déjà faite, ou aucune affiche reçue). » ; « Aucune affiche à confirmer dans la sélection : la validation admin est déjà faite, ou aucune affiche n'est encore arrivée. »
- **Règles de calcul visibles** (data.js) :
  - Validation admin d'une affiche (`C.vaEtat`) : `ORPHELINE` (pas de dossier) ; `MANUELLE` (confirmée par une personne) ; `A_FAIRE` (doute) si au moins un motif ; `PROPOSEE` (cas sûr) sinon. Motifs (`M.VA_MOTIFS`) : `BL` « rattachée sans le n° de dossier du BL (par le visuel ou à la main) » ; `FORMAT` « format de l'affiche différent de celui du dossier » ; `THEME` « plusieurs thèmes possibles dans ce format : visuel à confirmer » ; `MULTI` « même visuel pour plusieurs dossiers : répartition à confirmer » ; `SANS_IP` « IP pas encore saisies dans Broadcast : thème provisoire » ; `ANNULEE` « validation annulée : à refaire ».
  - Validation admin d'un dossier (`C.vaResume`) : `SANS_OBJET` (annulé), `A_FAIRE`, `FAITE` (au moins une affiche reçue, toutes confirmées), `AUCUNE`.
  - Statut du dossier synchronisé (`C.majStatutVA`) : valeur interne `VALIDE` quand préparation reçue + toutes affiches confirmées ; retour à `PREPA_RECUE` dès qu'une affiche à confirmer arrive, qu'une validation est annulée ou qu'aucune affiche n'est reçue ; écrit l'historique (« Circé (automatique) »). À l'écran le statut est « Préparation reçue » : la validation admin a sa pastille propre.
  - Instruction OK (`C.instrOK`, déroulant seulement) : `SANS_OBJET` hors déroulant ou annulé ; `ATTENTE` si préparation non reçue ; `MANUEL` si `iok` posé ; sinon `A_FAIRE` si commentaire de prépa ou écart de quantité BC/Circé (`instrOKMotifs`), `AUTO` sinon (règle de Nariman, 26/10 : sans commentaire ET nombre d'exceptions égal à la quantité).
  - « À faire » Coordination (`aFaire`) : combinaison de `va` (validation à confirmer), `iok` (Instruction OK en cours), `ecart`. « Cas sûr » : uniquement `va` et aucun doute.
  - Deadline Pré-Prod : jeudi S-2 16h00 (`M.deadlinePP`) ; deadline réception : vendredi S-2 16h30.
- **Statuts affichés** : tables ci-dessus (VA affiche 4 : Validée par la Coordination (OK), À confirmer : rattachement proposé (Info), À confirmer : doute (À surveiller), Réception inconnue (Important) ; VA dossier 4 ; Préparation 3 ; Instruction OK 5).
- **Messages** : callouts, toasts ci-dessus ; info-bulle RESERVE ; badge du menu.
- **États** : vide = « Aucune ligne pour ces filtres. » ; pas de chargement/erreur.
- **Données MOCK** : S43 = 84 % VALIDE / 11 % PREPA_RECUE / 5 % A_TRAITER ; S44 = 35/37/28 % ; S45 = 25 % PREPA_RECUE, sinon A_TRAITER ; 1 dossier annulé (WIS, vente annulée) ; 2 dossiers avec écart BC/Circé (−20 faces ; +12) ; commentaires de prépa en clair (« Visuel B en tête de train, à la demande du client », « Répartition par afficheur différente de Broadcast : voir la pièce jointe », « Entretien de 15 % demandé par le client », « Ne pas mettre ce visuel dans le même train que la campagne concurrente ») ; pôles « Pôle Direct »/« Pôle Intermédié » ; `controlee` (campagne contrôlée, 15 % d'entretien, visuel en tête de train, ~12 % des trains) ; entretien 8/10/12 % ; dossier sans IP (« (IP non saisies) ») ; dossier arrivé après libération.
- **Questions** : Q-COO-1 règle de Nariman et « nombre d'exceptions » ne sont pas modélisés (la maquette utilise `qteBCInfo`) : source des exceptions en cible ? Q-COO-2 la confirmation en lot informe « Broadcast » (toast) : interface réelle ? Q-COO-3 durée de la pré-sélection ; Q-COO-4 export Instructions OK le jeudi 14 h : option « règle automatique à 14 h » évoquée (annotation) non tranchée ; Q-COO-5 qui peut annuler une validation (coord/admin seulement dans la maquette) ; Q-COO-6 droits « admin » identiques à « coord ».

## ECR-COO-02 — Fiche dossier (modale « <annonceur> · dossier n »)
- **Fichier source** : `instructions.js:152-211`. Large.
- **Contenu** : ligne de pastilles (Validation admin, Préparation, tags atelier·site, format, départ, « Campagne contrôlée ») ; encadrés selon cas : validation admin à confirmer (info/warning) ; thème modifié dans Broadcast (critical si production lancée / warning) avec bouton **Reprendre la version Broadcast** ; thème proche à vérifier (warning) avec bouton **Vérifier les thèmes** (→ écran `themes?dossier=`, autre agent) ; correction demandée à Broadcast (info) ; écart Broadcast / Circé (critical) avec bouton **Appliquer la version Broadcast** (annule et remplace : `qteBC = bc`, recalcul des trains non produits, trains en production signalés) ; Instruction OK : « En cours » (warning, explication des motifs), « ok après contrôle » (good), « automatique » (good, % d'entretien repris de Broadcast, « campagne contrôlée : 15 % et visuel en tête »), « À traiter : préparation pas reçue » (info) ; tableau **Visuels et position dans le train** (Position A-D, Thème [bouton visuel], Quantité Broadcast, Avec entretien, Traitement : « À produire » ou tag « Ne pas afficher / Reste en place (Broadcast) », cadenas « figé (Instruction OK) » / « repris de Broadcast » au déroulant) ; tableau **Affiches reçues et validation admin** (N° d'affiche, Thème (quantité), Reçue, Validation admin [pastille + motifs], Emplacement, action **Valider** / **Annuler la validation**) + une ligne « Pas encore reçue » par visuel sans affiche ; champ **Entretien (%)** (nombre 0-30, modifiable seulement si l'Instruction OK est « En cours » pour un train ou `statutPP = PREPA_RECUE` au fixe/pliage ; sinon toast critique « Entretien repris de Broadcast : modifiable seulement quand l'Instruction OK se fait après contrôle (dossier « En cours »). » ; recalcule `entretien` par ligne selon seuil/arrondi), « Entretien calculé à l'afficheur » (lecture : règle « rien sous 3 affiches, sinon % arrondi au supérieur ») ; **Historique** (frise).
- **Boutons de bas de modale** : Fermer ; **Demander une correction à Broadcast** (→ ECR-COO-04) ; **Instruction OK (après contrôle)** (déroulant « En cours ») ; **Valider (n affiche[s])** (primaire, désactivé hors coord/admin).
- **Questions** : Q-COO-7 la position des thèmes est « figée » mais la règle de modification manuelle (« début »/« fin de train ») n'a pas d'écran d'édition ; Q-COO-8 « thème proche » : règle du ratio 0,85 (écran thèmes, autre agent).

## ECR-COO-03 — Modale « Confirmer aussi les affiches à doute ? »
- `instructions.js:68-86`. Texte « n affiche(s) sans doute et m affiche(s) à doute sont dans la sélection. Rien n'est validé sans vous… » + liste des doutes (n° · « libellé » : motifs). Boutons : Annuler, **Confirmer les n sans doute seulement** (si > 0), **Confirmer tout (n)** (primaire). Seule confirmation « explicite » demandée.

## ECR-COO-04 — Modale « Demander une correction à Broadcast · dossier n »
- `instructions.js:127-150`. Champ **« Qu'y a-t-il à corriger ? »** (texte libre, facultatif) ; encadrés : « Une demande est déjà partie le … Le mail sera renvoyé. » (si `demandeBC`), « Production lancée — Prévenez aussi l'atelier » (si prod lancée). Bouton **Envoyer le mail** : mail simulé « [Circé] Correction à faire dans Broadcast : dossier n (annonceur) » à « Pré-Prod · gestionnaires <pôle> (Broadcast) » ; `demandeBC` posé ; l'état du dossier ne change pas ; journal.
- **Questions** : Q-COO-9 destinataires réels du mail (liste de distribution, Q10 maquette) ; Q-COO-10 renvoi de la préparation : « annule et remplace » (BC-03) côté API ?

## ECR-COO-05 — Liste des trains
- **Fichier source** : `screens/trains.js` (1-406). Id `trains`, vue `?tab=trains` (défaut). Rôles `cheq`, `coord`.
- **Accès** : menu Déroulant › « Liste des trains » ; alertes `DM_FICHIER`, `APRES_LIBERATION` (lien `?q=`) ; callouts.
- **Structure** : en-tête « Déroulant · Liste des trains » avec sous-titre ; actions d'en-tête : **Fichiers Vendôme** (primaire, → `generateur?machine=`), **Bagues** (→ ECR-COO-11), **Train de pré-test…** (modale ECR-COO-05c), **Exporter les trains…** (modale ECR-COO-05b, seulement dans cette vue) ; barre de filtres (légende A reçu / B manquant / C fractionné) ; encadré « À faire par la Coordination avant l'export du jeudi 14 h » (warning, avec bouton « Voir les dossiers » → `instructions?pour=deroulant`) ou « Rien à faire par la Coordination sur ces dossiers » (good) ; 5 indicateurs (Trains à produire, En attente d'affiches, Prêts à produire, En production [ces trois cliquables → filtre Statut], Colisés ou expédiés) ; tableau. Les 4 vues du menu (trains/besoin/prepa/d8) partagent en-tête, filtres et indicateurs.
- **Tableau** (`trains`, sélection, clic de ligne = fiche train ECR-COO-05a) :
  | Colonne | Type | Format |
  |---|---|---|
  | Train | texte | `TR-0001`, `TR-P0001` (pré-test) + tag « pré-test » / « entretien » |
  | Atelier | texte | « 2 m² déroulant · Nîmes » |
  | Machine | texte | |
  | Destinataire | texte | |
  | Positions | pastilles A-D | vert = reçu (`ok`), hachuré = manquant (`ko`), pointillé = fractionné (`fr`), clic = Visuel ; non triable |
  | Nb trains | nombre | nombre de trains identiques |
  | Départ camion | date | « mar. 20/10 16h30 » |
  | Statut | enum | pastille (EN_ATTENTE, PRET, EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE) |
  | (masquées) Afficheur, N° panneau BC (6 chiffres ; un par train identique), Fichier (G-xxxx), Bague (Imprimée), Modifications |
  Teinte : modif par Broadcast sur train en production → critical ; En attente → serious ; Prêt → info. Outil de barre : **Sélectionner les [60] premiers trains** (nombre, bouton Sélectionner : coche les lignes jusqu'à N trains cumulés, sans couper une ligne).
- **Filtres** : N° de dossier, Départ, Atelier (déroulant seulement), Machine, Statut (7) ; + Filtre : Destinataire, Annonceur, Thème (trains contenant l'un des thèmes), Afficheur, Trains de (1 à 4 visuels).
- **Actions groupées** : **Fractionner** (lance le train sans les visuels manquants ; exige statut `EN_ATTENTE` et au moins un visuel reçu ; passe `PRET`, `fractionne`, historique, journal), **Raccrocher un visuel** (ECR-COO-05d), **Générer les fichiers** (primaire ; pré-sélectionne les trains `PRET` de la machine du premier → `generateur`), **Imprimer les bagues** (→ bagues).
- **Statuts** : voir `M.STATUTS` (§ Entités) ; règle d'unité : `EN_ATTENTE → PRET` automatique quand tous les visuels sont couverts ou fractionnés ; couverture : chaque thème alimente d'abord les unités dont le départ camion est le plus proche ; `EN_PROD` = point de non-retour (modification refusée).
- **Messages** : « Train déjà en production : impossible de le modifier (point de non-retour). » ; « Aucun train fractionnable (il faut au moins un visuel reçu). » ; « n train(s) fractionné(s) : ils passent « Prêt », les visuels manquants seront produits à part. » ; « n train(s) sélectionné(s), sur m ligne(s)… la ligne suivante en compte k et dépasserait N. ».
- **États** : vide tableau standard ; pas de chargement/erreur.
- **Données MOCK** : trains `TR-nnnn` numérotés séquentiellement, 1 à 4 positions (code accepte 6, deck 4 : H5), `nb` de 1 à 9 (2 m²) ou 1 à 4 ; positions triées « campagne contrôlée en tête » ; machine du Venusial = CCM V2 ; MUI/Wissous hors scrolling = tables de roulage ; S42 : 85 % livrés/15 % expédiés ; S43 : proportion de PRET/EN_PROD/PRODUIT/COLISE ; 15 % des trains S43 incomplets sont déjà fractionnés ; « modifs » (dernière minute Broadcast +2 trains).
- **Sous-écrans/modales** :
  - **ECR-COO-05a Fiche train** : pastilles statut, tags (atelier·site, machine, « n train(s) identique(s) », Fractionné, pré-test, « Bague réimprimée n fois »), destinataire · afficheur · départ · boucle · fichier ; N° de panneaux Broadcast ; tableau des positions (Pos., Annonceur, Thème, Dossier, Reçu / attendu, État [Reçu OK / Manquant critique / Fractionné], Emplacement des affiches) ; frise « Modifications tracées » ; boutons Fermer, **Supprimer…** (danger, désactivé si en production), **Réimprimer la bague…** (si bague imprimée), **Raccrocher un visuel**, **Fractionner** (désactivé hors `EN_ATTENTE`).
  - **ECR-COO-05b Exporter les trains · départ Sxx** : « n dossier(s) en Instruction OK : leurs faces passent « A imprimer », le go des plateformes. [n déjà exporté(s)] » ; encadré warning « n dossier(s) « En cours » — Ils ne partent pas… » ; bouton **Exporter** (primaire, désactivé si 0) → `exporte` posé sur chaque dossier (seuls `AUTO`/`MANUEL`, non annulés, préparation reçue), journal. **Jeudi 14 h, par la Coordination** (info-bulle ; aucun contrôle d'heure ni de rôle dans le code).
  - **ECR-COO-05c Créer un train de pré-test ou d'entretien** : champs Atelier (déroulants du site), Départ (S ≥ semaine en prod), Type (Pré-test / Entretien), **Nombre de trains** (1-9), Visuel (thèmes de l'atelier, S ≥ départ), Destinataire (du site) ; refus « Choisissez un visuel et un destinataire. » ; crée `TR-Pnnnn`, statut `EN_ATTENTE`, une position, afficheur = premier du destinataire.
  - **ECR-COO-05d Raccrocher un visuel au train n** (ou « à n train(s) » en masse) : select du visuel (même site, même semaine, même atelier, non exclu, non annulé) ; limite 4 positions (« Train complet ») ; en masse : écarte les trains en production, d'un autre atelier/départ, complets ou qui ont déjà le visuel ; « n train(s) recevront ce visuel » ; ajoute une position + une ligne de préparation (`qte += nb`) ; pas de raccrochage automatique (RP34).
  - **ECR-COO-05e Supprimer le train n** : motif (select : Affichage qui ne se fait pas / Ville de Paris : affiche à ne pas poser / Pré-test annulé / Autre), bouton **Supprimer le train** (danger) ; refus si en production.
- **Questions** : Q-COO-11 limite de positions 4 ou 6 ? Q-COO-12 « Exporter » : heure butoir (jeudi 14 h) à contrôler côté serveur ? Q-COO-13 un train supprimé libère-t-il les quantités de couverture ? (la maquette recalcule) ; Q-COO-14 rôle autorisé à supprimer/créer des trains de pré-test (Coordination dans l'info-bulle).

## ECR-COO-06 — Suivi par thème (Liste des trains, vue besoin)
- **Fichier source** : `trains.js:271-299`. Id `trains`, `?tab=besoin`. Mêmes en-tête, filtres (sans filtre Statut effectif : les indicateurs et le besoin ignorent `statut`) et indicateurs que ECR-COO-05.
- **Tableau** (`trains-besoin`, sélection) : une ligne par thème présent dans les trains filtrés (si un filtre Thème est posé, seuls les thèmes choisis) : Annonceur · thème (bouton visuel), Dossier, **Besoin (trains)** (somme des `nb`), Entretien (qteEnt − qte), Reçu, **Couvert** (Oui OK / Non critique : reçu ≥ attendu), Emplacement (allée-rayon des affiches), **Pré-assemblé** (« Fait » OK / « — » ; initialisé à vrai si un train du thème est en production) ; masquées : Annonceur, Thème, Format, Repiquage. Teinte serious si non couvert.
- **Actions groupées** : **Marquer pré-assemblé** (primaire), **Désassembler** (journal « n visuel(s) pré-assemblé(s) »).
- **Questions** : Q-COO-15 le pré-assemblage est un booléen par thème, non par lot/train ; quelle granularité cible (SCR-07) ?

## ECR-COO-07 — Préparation (Liste des trains, vue prepa)
- **Fichier source** : `trains.js:301-348`. `?tab=prepa`.
- **Tableau** (`trains-prepa`, sélection, clic = fiche train, outil « Sélectionner les N premiers ») : Train, Destinataire, Statut, Positions, Nb trains, **Pré-assemblage** (« Fait » si tous les visuels non fractionnés sont pré-assemblés), **Rouleur** (nom ou « — »), Départ camion ; masquées : Afficheur, Atelier, Machine, Bague, Colis. Teinte : En attente → serious ; Prêt sans rouleur → info.
- **Actions groupées** : **Choisir le rouleur…** (modale « Rouleur de n ligne(s) de trains » : select des opérateurs du site `Rouleur N1…` avec poste `Table k` ; bouton **Affecter**), **Générer les fichiers**, **Imprimer les bagues**.
- **Données MOCK** : opérateurs `NIM-OP1..6` (« Rouleur N1.. », « Table 1.. »), `WIS-OP1..5` (« Rouleur W1.. »).

## ECR-COO-08 — Suivi 8 m² (demies)
- **Fichier source** : `trains.js:350-362`. `?tab=d8`.
- **Tableau** (`trains-8m2`, sans sélection, filtres appliqués aux thèmes 8 m² : Machine, Statut, Destinataire, Afficheur, Trains de = sans objet) : Site (si Tous), Annonceur · thème, Besoin, Reçu, **Demies haut** (nombre ≥ 0, éditable en ligne), **Demies bas** (éditable), **8 m² finales** (éditable), Reste à faire (= besoin − finales). Teinte : reçu < besoin → serious ; reste 0 → good. Chaque modification écrit au journal « 8 m² : <champ> = <valeur> ».
- **Données MOCK** : `d8 {haut, bas, final}` initialisés selon les unités déjà en production ; seul écran où des champs sont saisis directement dans le tableau.
- **Questions** : Q-COO-16 mode de saisie (par ligne, historisation, validation) ; remplace un Excel (PROC-06).

## ECR-COO-09 — Préparation 2 m² fixe / Pliage / Bus (écran « unitaire »)
- **Fichier source** : `screens/unitaire.js` (1-257). Id `unitaire`. Rôles `cheq`, `coord`.
- **Accès** : menu 2 m² fixe › Préparation (`?type=fixe`, sous-entrées par atelier `?atelier=`), Pliage › Préparation, Bus › « Préparation par centre » ; alertes `APRES_LIBERATION` (lien `?atelier=&q=`) ; `?flag=apres`.
- **Structure** : en-tête (sur-titre = type ; titre « Préparation · Nîmes » / « Préparation par centre · Nanterre » / + atelier pour le pliage ; sous-titre dépendant du type) ; actions : **Fiche de synthèse** (icône imprimante, modale ECR-COO-09d), **Quantités à encoller** (Bus seulement, ECR-COO-09e) ; barre de filtres ; un bandeau de **libération par semaine de départ** choisie (callouts) ; annotations ; thèmes exclus sortis automatiquement (liste en annotation) ; tableau. Si aucun atelier du type sur le site : callout info « Pas d'atelier « X » sur ce site. Choisissez « Tous les sites » ou un autre site en haut de page. ».
- **Bandeau de libération** (par semaine) : si libérée : callout good « S43 libérée vers l'atelier le mar. 13/10 15h30 (<utilisateur>) — Toute préparation reçue après déclenche une alerte et un mail. » ou warning avec la liste des dossiers arrivés après (boutons « Voir ces dossiers » [pose le filtre Repère = après libération], « Voir le mail ») ; sinon callout info « S44 pas encore libérée vers l'atelier — Ses lignes sont « à libérer »… » + bouton **Libérer la S44** (primaire).
- **Tableau** (`unitaire-<atelier>`, sélection) : une ligne par unité (UM `UM-nnnn` fixe, lot `PL-nnnn` pliage, `BU-nnnn` bus) :
  | Colonne | Type | Format |
  |---|---|---|
  | UM / Lot | texte | |
  | Annonceur · thème | texte | bouton visuel ; tags « bague modifiée », « corrigé par la plateforme » |
  | Destinataire (ou « Centre bus ») | texte | |
  | Afficheur | texte | `Équipe <nom>` |
  | Qté | nombre | quantité de la ligne |
  | Entretien | nombre | calculé à l'afficheur (info-bulle : % d'entretien, valeur cible, valeur ville de la méthode actuelle) |
  | Total | nombre | qté + entretien |
  | Statut | enum | pastille + repères : « Arrivé après libération » (Important), « main rendue », « à libérer » |
  | (masquées) Type prépa (« 2 m² fixe » / « Bus » / « Collé »), Dossier, Annonceur, Thème, Départ, Colis, Repère |
  Teinte : dossier arrivé après libération → serious ; En attente → warning ; Prêt → info. Action de ligne : **Corriger l'intitulé** (fixe, pliage) ou **Textes de bague** (bus).
- **Filtres** : N° de dossier, Départ, Annonceur, Statut ; + Filtre : Destinataire (ou « Centre bus »), Afficheur, **Repère** (« À libérer (semaine pas encore libérée) », « Arrivé après libération », « Main rendue à la Pré-Prod »).
- **Actions groupées** : **Générer les fichiers multi-rouleuse** (fixe, primaire → `generateur?machine=`), **Plié : saisir le comptage** (pliage, primaire ; sur les unités PRET/EN_PROD), **Imprimer les bagues** (sur les `PRET`, modale ECR-COO-11b), **Rendre la main à la Pré-Prod** (ECR-COO-09b).
- **Modales** :
  - **ECR-COO-09a Libérer la S** : action directe (pas de confirmation) : crée une libération (atelier, semaine, date, utilisateur), historique « Libéré vers l'atelier » des dossiers `PREPA_RECUE`, journal, toast « S44 libérée vers l'atelier … Les préparations reçues ensuite déclencheront une alerte et un mail. [n dossier(s) ont encore des affiches à confirmer…] ». **La libération ne valide rien et ne dépend pas de la validation admin.** Remplace le bouton « Colisage » de Circé (qui créait les UM : H2).
  - **ECR-COO-09b Rendre la main à la Pré-Prod** : champ **Motif** (texte, défaut « Changement de visuel demandé par le client ») ; encadré warning « n unité(s) déjà en production — Elles ne seront pas retirées (point de non-retour) » ; bouton **Rendre la main** : dossiers → `PREPA_RECUE`, unités non lancées → `EN_ATTENTE` + repère `rendu`, enregistrement dans `rendus`.
  - **ECR-COO-09c Corriger l'intitulé** : champs **Annonceur imprimé**, **Thème** (textes, non vides : « Le thème et l'annonceur ne peuvent pas être vides. » ; sans changement : « Rien n'a changé. »), case **Prévenir la Pré-Prod, pour aligner Broadcast si besoin** (cochée) ; callout warning si production lancée ; s'applique à toutes les unités du thème ; pose `corrPlateforme` (n'alerte pas « Broadcast ≠ Circé », H13), pose « Feuille à refaire » sur les affiches, mail à « Pré-Prod <site> » si coché.
  - **ECR-COO-09d Fiche de synthèse** : tableau groupé par destinataire (Destinataire, Dossier, Annonceur, Thème, Repiquage, Format, Qté, Entretien, Total) selon les filtres ; boutons Fermer, **Imprimer la fiche** (toast simulé).
  - **ECR-COO-09e Quantités à encoller (Bus)** : callout « Bus Nanterre : module cible… BC-04, CIR-01 » ; champ **Ajustement global (%)** (nombre) ; tableau Centre bus, Quantité commandée, « Calcul Broadcast (+8 % +20 %) » (= cmd×1,08 + cmd×0,20 arrondis), **Ajustement centre (%)** (éditable), **À encoller** ; bouton **Enregistrer et éditer les états de collage** (journal, toast).
  - **Comptage pliage** (`compter`) : champ **Affiches comptées** (nombre, défaut = attendu) ; **Valider le comptage** : unités → `PRODUIT`, toast « Comptage conforme. » ou « Écart de comptage : n affiche(s). Alerte qualité créée. » (alerte non réellement créée).
- **Données MOCK** : un UM par ligne destinataire × afficheur au fixe ; entretien = 0 sous 3 affiches sinon `ceil(qte × pct/100)` min 1 ; dossier « Librairie Papyrus » arrivé après libération ; dossiers MISTRAL (2 dossiers, 1 affiche) et « Fromagerie Lacombe » (2 thèmes proches) ; dossier multi-semaines S43+S44 ; libérations `NIM-F2 S43` (jeu. 8 oct. 15h30), `WIS-F2`, `WIS-COL` (16h05) ; colle/pliage seulement à Wissous (`WIS-COL`, formats 4/8/12 m² collé) ; Bus seulement à Nanterre (3 dépôts).
- **Questions** : Q-COO-17 libération : qui, quand, annulable ? Q-COO-18 « Rendre la main » — conséquences sur la validation admin et les affiches reçues ; Q-COO-19 pliage : alerte qualité annoncée mais non créée ; Q-COO-20 correction d'intitulé : portée sur les feuilles de stock et fichiers déjà envoyés.

## ECR-COO-10 — Dispatch du roulage
- **Fichier source** : `screens/dispatch.js`. Id `dispatch`. Rôle `cheq`.
- **Accès** : menu Déroulant › Dispatch (sous-entrées = un atelier déroulant par site : `?atelier=`).
- **Structure** : en-tête « Déroulant · Dispatch du roulage » / titre « <site> · <atelier> » ; barre de filtres avec boutons **Proposer une répartition** (primaire) et **Tout désaffecter** ; callout « Moteur de répartition à brancher » (cible) ; callout critical si trains non affectés partent dans moins de 36 h ; callout warning par rouleur dépassant 115 % de la moyenne ; carte « Charge par rouleur » (Rouleur, Poste, Trains, Faces, Charge [jauge], Destinataires, bouton **Liste de picking**) ; carte « À répartir » (3 indicateurs : Trains à rouler, Faces, Non affectés) ; carte « Trains et affectation » (tableau).
- **Tableau** (`dispatch-trains`) : Train, Destinataire, Départ, Positions, Trains, Faces (= nb × positions non fractionnées), Statut, **Rouleur** (select « Non affecté » + opérateurs du site, effet immédiat + journal). Teinte : non affecté < 36 h → critical, non affecté → warning. Périmètre : trains de l'atelier au statut `PRET` ou `EN_PROD`.
- **Filtres** : N° de dossier, Départ, Statut (Prêt/En production) ; + Filtre Destinataire.
- **Règle simulée** : départ le plus proche d'abord, puis rouleur le moins chargé (faces) ; le programme Python existant sera intégré (à transmettre).
- **Modale « Liste des affaires à collecter : <rouleur> »** : Emplacement, N° affiche, Annonceur, Thème, Quantité ; triée par emplacement ; boutons Fermer / **Imprimer** (toast simulé).
- **Messages** : « Répartition proposée : n trains sur m rouleurs. » ; callouts de charge.
- **États** : « Aucun atelier déroulant sur ce site. » ; tableau vide standard.
- **Questions** : Q-COO-21 algorithme de répartition cible ; Q-COO-22 seuils 36 h et +15 % codés en dur ; Q-COO-23 les rouleurs sont des opérateurs, pas des utilisateurs ?

## ECR-COO-11 — Bagues et étiquettes
- **Fichier source** : `screens/bagues.js`. Id `bagues`. Rôle `cheq`.
- **Accès** : menu Déroulant › Bagues ; boutons « Bagues » de la Liste des trains ; « Imprimer les bagues » (trains, préparation).
- **Structure** : en-tête (« Déroulant » / « Bagues et étiquettes ») ; barre de filtres ; tableau.
- **Tableau** (`bagues`, sélection) : unités hors machine Vendôme et hors `EN_ATTENTE` : Unité, Atelier (+ site si Tous), Poste (machine ou « Sans machine »), Destinataire, Textes imprimés (par position A, B… : annonceur · thème + tags « modifié »), Statut ; masquées : Type (Train/UM (rouleau)/Lot), Bague (« Imprimée (rouleur) », « réimprimée n fois »). Actions de ligne : **Aperçu**, **Modifier**. Teinte warning si textes modifiés.
- **Filtres** : N° de dossier, Départ, Atelier, Poste, **Bague** (défaut **À imprimer** ; Imprimées ; Sans bague, déjà en production) ; + Filtre Destinataire.
- **Actions** : action groupée **Imprimer les bagues (n)** (primaire).
- **Modales** :
  - **ECR-COO-11a Imprimer n bague(s)** : champ **Rouleur** (select opérateurs du site) ; aperçu des 6 premières bagues ; bouton **Imprimer** → bague posée, rouleur affecté, unités `PRET` → `EN_PROD` (« Le statut passe automatiquement à « En production » à l'impression ») ; refus « Aucune unité « Prêt à produire » dans la sélection. ».
  - **ECR-COO-11b Textes imprimés sur la bague n** : par position, champs **Annonceur (A)** et **Thème (A)** ; bouton **Enregistrer et réimprimer** (historise, journal) ; vaut en fixe comme en déroulant.
  - **ECR-COO-11c Réimprimer la bague n** (depuis l'aperçu d'une bague déjà imprimée ou la fiche train) : motif (select : Colis perdu, refait / Bague abîmée ou illisible / Autre) ; même numéro, mêmes textes, statut inchangé, compteur `reimpressions`.
  - **Aperçu bague** (`ui.bague`) : code-barres factice, n° d'unité, « Nb aff : n », destinataire en grand, afficheur · atelier, départ · boucle · rouleur, lignes « dossier · annonceur — lettre » et thème (étoile si modifié).
- **Questions** : Q-COO-24 les bagues Vendôme partent avec le fichier : où se règle l'impression ? Q-COO-25 aucune quantité par bague en fixe/lot (nb aff = qté + entretien).

---

# PARTIE C — TRANSVERSE (TRA)

## ECR-TRA-01 — Alertes
- **Fichier source** : `screens/alertes.js` (1-85) + `data.js:987-1088` (génération des alertes). Id `alertes`. Pilotage › Alertes ; cloche du bandeau 1.
- **Structure** : en-tête (« Pilotage » / « Alertes » ; action **Règles et destinataires** → `parametrage?tab=alertes`, autre agent) ; barre de filtres ; 4 indicateurs par gravité (Critiques « à traiter tout de suite », Importantes « dans la journée », À surveiller « avant le départ », Pour information ; cliquables → filtre Gravité) ; barre de pastilles de type avec compteur (« Tous les types » + 17 types, choix multiple) ; tableau.
- **Tableau** (`alertes`, sélection) : Gravité (badge), Alerte (titre en gras + message), Site, Départ, Échéance / date, Besoins (chips non triables) ; masqué : Type. Action de ligne : **Ouvrir** (lien vers l'écran de l'alerte) et **Acquitter** (ou « acquittée »). Action groupée : **Acquitter**.
- **Filtres** : N° de dossier (n° 6 chiffres extraits du message/lien) ; Départ (défaut S42+S43 ; `matchEmpty`) ; Gravité ; **État** (défaut Ouvertes ; Acquittées) ; + Filtre Site ; Type (masqué, piloté par les pastilles).
- **Types d'alertes** (`TYPES`) : Visuel manquant ou partiel (`MANQUANT`) ; Écart de réception > 10 % (`ECART`) ; Réception sans IP (`SANS_IP`) ; Réception inconnue à identifier (`ORPHELINE`) ; Réception inconnue : dossier introuvable (`DOSSIER_INTROUVABLE`) ; Validation admin à confirmer (doute) (`VALIDATION_ADMIN`) ; Palette à contrôler en retard (`CONTROLE_RETARD`) ; Préparation non reçue (`IP_MANQUANTES`) ; Écart Broadcast / Circé (`ECART_BC`) ; Thèmes proches à vérifier ; Annonceurs proches à vérifier ; Thème modifié dans Broadcast ; Dernière minute sur fichier envoyé (`DM_FICHIER`) ; Rajout après préparation (`APRES_LIBERATION`) ; Départ camion à risque ; Feuille de stock à refaire (`THEME_MODIF`) ; Feuille de stock définitive à imprimer (`FEUILLE_DEFINITIVE`).
- **Règles de gravité visibles** : manquant/partiel : S43 → critical si manquant, serious si partiel ; S44 → warning ; écart > 10 % → warning ; sans IP → serious ; orpheline > 24 h → serious sinon warning ; dossier introuvable → serious ; validation à confirmer (doute hors SANS_IP) → serious si départ ≤ S+1 sinon warning ; palette en retard → serious si > 2×24 h, sinon warning ; préparation non reçue → critical si deadline dépassée sinon warning ; écart BC → serious ; départ camion à risque (unités S43 en attente, moins de 72 h) → critical si < 36 h sinon serious ; thème modifié dans Broadcast → critical si production lancée sinon serious ; DM fichier → critical ; rajout après préparation → serious ; feuilles → warning.
- **Destinataires par type** (champ `roles` de l'alerte, non filtrant à l'écran) : coord, cheq, recep selon le type (ex. `CONTROLE_RETARD` : recep + cheq ; `DOSSIER_INTROUVABLE` : coord).
- **États** : vide = message du tableau standard ; pas de chargement/erreur.
- **Données MOCK** : alerte clé = `MQ-<thème>`, `EC-`, `IP-<affiche>`, `OR-`, `DI-`, `VA-`, `PP-<dossier>`, `BC-`, `DEP-<site|boucle|ts>`, `TH-`, `AN-`, `TBC-`, `TMOD`, `FD-`, `CT-<réception>`, `EV-…` ; acquittement stocké en mémoire (`D.ack`) + journal.
- **Questions** : Q-TRA-1 modèle d'une alerte (calculée vs événement daté) ; Q-TRA-2 acquittement par utilisateur ou global ; Q-TRA-3 destinataires/canaux (mail) configurables (Paramétrage › Alertes et mails, autre agent) ; Q-TRA-4 seuils (24 h, 36 h, 72 h, 10 %) paramétrables ?

---

## 3. Graphe de navigation (périmètre + liens vers autres écrans)

```
Menu Pilotage ──► ECR-TRA-01 Alertes ──Ouvrir──► (reservations | reception?tab=affiches | identification?id | reception?tab=controle&id | instructions | themes | trains | unitaire)
                    ▲ cloche bandeau 1 (toutes pages)            └─ Règles et destinataires ──► parametrage?tab=alertes  [autre agent]

Menu Réception ─► ECR-REC-01/02 (page « reception » : étape 1 + sas + contrôle)
   ECR-REC-01 ─Photographier BL/affiche─► ECR-REC-07 ─Mettre au panier/Joindre─► ECR-REC-01
   ECR-REC-01 ─Réception inconnue…─► ECR-REC-08 ─► ECR-REC-09 (feuille temporaire) ; crée ligne dans ECR-REC-04 + alerte
   ECR-REC-01 ─Valider la réception─► sas de ECR-REC-02 ─Contrôler─► contrôle ─Valider─► ECR-REC-09 (feuilles définitives)
   ECR-REC-01/03 ─n° affiche─► ECR-REC-05 ─Réception─► ECR-REC-06 ─Contrôler la palette─► ECR-REC-02
   ECR-REC-05 ─Imprimer la feuille─► ECR-REC-09 ; Voir le visuel ─► ECR-REC-12 (depuis tout écran)
   Menu Réception ─► ECR-REC-03 Liste des affiches ─ligne─► ECR-REC-05 ; action groupée ─► ECR-REC-10 ─► ECR-REC-09
   Menu Réception ─► ECR-REC-04 Réceptions inconnues ─Fiche─► ECR-REC-05 ; ─Rattacher─► palette dans sas ECR-REC-02 ; ─Valider et imprimer─► ECR-REC-02
Menu Pré-production ─► ECR-COO-01 ─ligne─► ECR-COO-02 ─Demander une correction─► ECR-COO-04 ; ─Valider─► (ECR-COO-03 si doutes)
   ECR-COO-02 ─Vérifier les thèmes─► themes?dossier [autre agent]
Menu Déroulant ─► ECR-COO-01 (?pour=deroulant) | ECR-COO-05 | ECR-COO-06 | ECR-COO-07 | ECR-COO-08 | generateur [autre agent] | ECR-COO-11 | ECR-COO-10
   ECR-COO-05 ─ligne─► fiche train (05a) ─Réimprimer bague─► ECR-COO-11c ; Raccrocher─► 05d ; Supprimer─► 05e
   ECR-COO-05 ─Exporter les trains─► 05b ; ─Train de pré-test─► 05c ; ─Fichiers Vendôme / Générer les fichiers─► generateur?machine [autre agent] ; ─Bagues─► ECR-COO-11
   ECR-COO-05 callout ─Voir les dossiers─► ECR-COO-01 (?pour=deroulant)
   ECR-COO-07 ─Choisir le rouleur─► modale rouleur ; ─Imprimer les bagues─► ECR-COO-11
Menus 2 m² fixe / Pliage / Bus ─► ECR-COO-09 ─Libérer, Rendre la main, Corriger l'intitulé, Fiche de synthèse, Quantités à encoller, Comptage─► modales ;
   ─Générer les fichiers multi-rouleuse─► generateur [autre agent] ; ─Imprimer les bagues─► ECR-COO-11a
Bandeau 1 : Site, Rôle, Simuler (11 événements), Mails (modale), Besoins (annotations), Aide (parcours, besoins) [autre agent]
```

Dépendances vers écrans NON analysés ici : `suivi` (Pilotage, et Suivi de prod par atelier), `reservations` (état des réservations, cible des alertes MANQUANT et DEPART_RISQUE), `themes` (vérification des thèmes : proches, annonceurs, modifiés dans Broadcast), `generateur` (fichiers Vendôme / multi-rouleuse, `M.genState.preselect`), `parametrage` (alertes et mails, référentiels, règles métier, journal), `stock` (mouvements, `ui.afficheModal`), `fincampagne`, `expedition` (colis, fin de journée Geodis, preuves), `parcours`, `besoins` (aide).

---

## 4. Entités et champs déduits des MOCK (à confirmer avec le schéma réel de la BDD)

Aucun champ n'est repris comme donnée : liste de structures observées dans `data.js` / écrans. Les noms sont ceux de la maquette (pas de conventions CIRCE V2 imposées).

| Entité | Champs observés | Remarques |
|---|---|---|
| Site | `id` (NIM, WIS, NAN), `label`, `cible` | Nanterre (Bus) = cible |
| Atelier | `id` (NIM-D2…), `site`, `label`, `mode` (train / unitaire), `type` (fixe / pliage / bus), `formats[]`, `machines[]`, `cible` | 10 ateliers |
| Machine | `id`, `site`, `label`, `type` (vendome, ccm, multirouleuse, assemblage, roulage), `fichier`, `tiroirs`, `bagues`, `sortie`, `repertoire` | |
| Destinataire | `id` (3 lettres), `site`, `label`, `boucle`, `canal` (MILK/MESSAGERIE/DIRECT), `jour`, `hh`, `mm` (départ camion relatif au lundi de S-1) | 19 destinataires |
| Afficheur | `id` (AF-<dest><n>), `dest`, `label` | 2-3 par destinataire (1 pour Bus) |
| Opérateur (rouleur) | `id` (NIM-OP1), `site`, `label`, `poste` | |
| Dossier | `id` (6 chiffres ; suffixe `-W` plateforme 2), `da` (6 chiffres), `no` (n° Broadcast pour 2e plateforme), `annonceur`, `site`, `semaine`, `semaines[]`, `atelier`, `format`, `entretienPct`, `print`, `controlee`, `ipSaisies`, `prepaEnvoyee`, `prepaDate`, `statutPP` (A_TRAITER, PREPA_RECUE, VALIDE interne, ANNULE), `qteBC`, `qteBCInfo{bc,circe,date}`, `pole`, `commentPrepa`, `historique[]`, `apresLiberation`, `iok{date,user}`, `exporte{date,user}`, `demandeBC{date,user,note}`, `typeReal`, `daLignes[]`, `ajusteBus` | |
| Thème (visuel) | `id` (TH…), `dossierId`, `libelle`, `position` (A…), `exclu` (NE_PAS_AFFICHER / RESTE_EN_PLACE), `qte`, `qteEnt` (quantité avec entretien), `d8{haut,bas,final}`, `repiquage`, `libelleBC`, `modifBC`, `livraisonPrevue`, `preassemble`, `corrPlateforme`, `annonceurImprime` | |
| Ligne de préparation | `id` (L…), `themeId`, `dossierId`, `site`, `semaine`, `atelier`, `dest`, `afficheur`, `qte`, `entretien` | grain thème × afficheur |
| Unité de production | `id` (TR-nnnn, TR-Pnnnn, UM-nnnn, PL-nnnn, BU-nnnn), `kind` (TRAIN, UM, LOT), `site`, `semaine`, `atelier`, `machine`, `dest`, `afficheur`, `nb`, `positions[{themeId, fr, couvert}]` (trains), `ligneId`/`themeId` (unitaires), `statut` (EN_ATTENTE, PRET, EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE), `bague`, `bagueTexte[]`, `operateur`, `generation`, `modifs[]`, `fractionne`, `pretest`, `reimpressions`, `rendu`, `colis`, `compte`, `complet` | |
| Libération de semaine | `site`, `semaine`, `atelier`, `date`, `user` | |
| Réception (palette) | `id` (R26…), `site`, `date`, `bl`, `transporteur`, `imprimeur`, `nbColis`, `dechargePar`, `controleur`, `affiches[]`, `lignes[{afficheId, qte, complement, themeId}]`, `statut` (A_IDENTIFIER, A_CONTROLER, CONTROLEE), `photoBL`, `orpheline`, `controle{date, controleur}`, `aControlerDepuis`, `ordre` | « ordre » n'est plus affiché |
| Affiche | `id` (712…), `receptionId`, `receptions[]`, `site`, `date`, `statut` (IDENTIFIEE, ORPHELINE), `qteBL`, `qteRecue`, `alloc[{themeId, qte}]`, `rattache` (BL, VISUEL, MAIN), `va{etat (MANUELLE/ANNULEE), user, date, motifs[]}`, `annonceurSaisi`, `libelleSaisi`, `format`, `imprimeur`, `allee`, `rayon`, `rebut`, `aConserver`, `semaines[]`, `controleur`, `enAttenteControle`, `feuilleImprimee` (TEMPORAIRE/DEFINITIVE), `themeModif{ancien, nouveau, date, par, origine, reimprime}`, `surplusEntretien`, `signalePP{date, to, par}`, `inconnue`, `rattacheeLe`, `historique[]` | une affiche peut servir plusieurs dossiers/thèmes/semaines (N à N) |
| Mouvement de stock | `id` (MV-…), `date`, `afficheId`, `type` (Réception, Réception (complément), Contrôle (écart au BL), Mise au rebut, sorties d'expédition), `qte` signée, `user`, `auto`, `motif` | stock = somme |
| Alerte | `key`, `type`, `sev` (critical/serious/warning/info/good), `site`, `semaine`, `date`, `titre`, `message`, `link{screen, params}`, `needs[]`, `roles[]`, `acquittee` | calculée ou événement |
| Mail (boîte d'envoi) | `date`, `to[]`, `subject`, `body`, `trigger`, `needs`, `lu` | |
| Journal | `date`, `user`, `objet`, `action` | |
| Réception attendue ancienne | `id` (RA-<sem>-<k>), `site`, `semaine`, `dossier`, `annonceur`, `theme`, `statut`, `reste`, `conservation` | purge auto 4 semaines |
| Paramètres | `entretien{seuil:3, arrondi: supérieur, grain: afficheur}`, `ecartReception:0.10`, `comptageMorceau:30`, `exemplairesFeuille:2`, `purgeAttendues:4`, `delaiControle:24`, `alleeInconnues:'X'`, `regroupements`, `seuilThemesProches:0.85`, `finCampagne`, `criteres` | |
| Référentiels | `imprimeurs` (6), `transporteursEntrants` (4), `controleurs` (4), `canaux`, `semaines{num, statut}` | listes tenues dans Paramétrage › Référentiels |

**Statuts recensés** (périmètre) — voir aussi `M.STATUTS` (15 codes) : A_TRAITER, PREPA_RECUE, VALIDE (interne), ANNULE ; EN_ATTENTE, PRET, EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE ; ORPHELINE, IDENTIFIEE ; COLIS_OUVERT, COLIS_CLOS ; réception A_IDENTIFIER / A_CONTROLER / CONTROLEE ; attendue Attendue / Partielle / Complète / Surplus ; validation admin affiche (4) et dossier (4) ; Instruction OK (5) ; statuts « réceptions inconnues » (5) ; tags d'affiche (4) ; repères d'unité (3) ; états de thème (`etatTheme` : MANQUANT, PARTIEL, SURPLUS, COMPLET, SANS_ATTENDU, NON_ATTENDU) ; « où en est » de l'état des réservations (DA, IP, AFFICHES, PARTIEL, PREPA, PROD, PRODUIT, EXPEDIE, LIVRE, ANNULE) ; 17 types d'alertes ; 5 niveaux de gravité.

### Remarques de cohérence relevées dans la maquette
- La maquette est une V2 « datée du 14/10/2026 » avec décisions jusqu'au 02/11/2026, mais l'horloge simulée est le **13/10/2026 10h** (semaine de production S42, départ S43) : les dates des MOCK (deadline jeudi 8/10, 15/10, 29/10) n'ont de sens que relativement à cette horloge.
- Plusieurs libellés d'export finissent en `.csv` alors que `Exporter` produit un `.xlsx`.
- Plusieurs seuils sont codés en dur dans l'écran (1,10 pour « Surplus », 36 h, 115 %, 0,9 / 0,6 / 0,3, 60 trains) alors que des paramètres existent pour d'autres (`ecartReception`, `delaiControle`).
- La Coordination est « supposée » seule à pouvoir exporter les trains, supprimer des trains, libérer une semaine : aucun garde-fou de rôle dans la maquette (voir Q-B).
- Le bouton « Valider » de la fiche affiche vaut pour `coord` et `admin`; les rôles `cheq`, `recep`, `expe`, `com` voient le texte « à confirmer dans Pré-production… ».

## 5. Questions transverses (à reporter dans QUESTIONS_OUVERTES.md)
- **Q-A** Classement des écrans en modules (REC/COO/TRA) à valider ; « Coordination » = rôle ET module.
- **Q-B** Matrice profils × écrans × actions : la maquette ne l'applique pas (hors validation admin). À extraire du code historique (`circe-develop`) ou à fournir.
- **Q-C** États « chargement » et « erreur » inexistants : à spécifier (CLAUDE.md impose chargement/vide/erreur).
- **Q-D** Les 4 types de statuts (dossier, validation admin, instruction OK, unité) doivent chacun avoir une machine d'états et un historique : la maquette en montre les transitions implicites (ex. `VALIDE ↔ PREPA_RECUE`, `EN_ATTENTE ↔ PRET` automatiques, `PRET → EN_PROD` à l'impression de la bague ou à l'envoi du fichier) mais pas la table complète.
- **Q-E** Idempotence / concurrence : plusieurs actions de masse (valider la sélection, exporter, affecter) sans notion de version : à encadrer.

## 6. Zones non analysées / limites
- Écrans des autres agents (themes, stock, parametrage, reservations, suivi, expedition, fincampagne, generateur, besoins, parcours) non lus ; seuls les liens/dépendances sont notés.
- `data.js` lu intégralement pour la génération, les règles de calcul des statuts, validation admin, alertes, purge, fin de campagne ; les lignes 799-840 (suite de `C.base`, base unique « Où en est-il », grain DA) et 1099-1213 (thèmes/annonceurs proches) n'ont été que survolées (appartiennent à d'autres écrans).
- `ui.js` lu en totalité sauf rien d'important ; `charts.js`, `besoins.js`, `app.css`, `notes/*.md`, `vendor/*` non lus (hors périmètre ou purement visuel). `DESIGN.md` lu de la section 0 à 4.6 (le reste : icônes, accessibilité, sections 10-12).
- Aucune image dans la maquette : toutes les descriptions viennent du code (le rendu visuel réel n'a pas été vu).
